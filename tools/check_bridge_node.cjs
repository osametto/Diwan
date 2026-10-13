/* File-bridge contract tests in Node. Native SAF behavior is not simulated by an Android device. */
const fs = require('node:fs'), path = require('node:path'), vm = require('node:vm');
const assert = require('node:assert/strict'), crypto = require('node:crypto');
const {File} = require('node:buffer');
const root = path.resolve(__dirname, '..');
const hash = b => crypto.createHash('sha256').update(b).digest('base64');
const tree = 'content://provider/tree/finance';
const folder = {tree, uri: tree + '/document/finance', name: 'Finance', kind: 'directory'};
const docs = new Map(), transfers = new Map(), nodes = new Map(), listeners = new Map();
const notices = [], checks = [];
let serial = 0, printHtml, remembered = false, flushes = 0;
function create(name, bytes = Buffer.alloc(0)) {
  const doc = {tree, uri: tree + '/document/' + encodeURIComponent(name), name, kind: 'file', bytes};
  docs.set(doc.uri, doc); return doc;
}
function describe(d) { const {bytes, ...other} = d; return {...other, size: bytes.length, lastModified: Date.now()}; }
const companion = create('test.studio.json', Buffer.from('{"note":"أسامة"}\n'));
async function dispatch({method, args: a}) {
  switch (method) {
    case 'chooseFolder': return folder;
    case 'restoreFolder': return remembered ? folder : null;
    case 'rememberFolder': assert.equal(a.tree, tree); remembered = true; return true;
    case 'permission': return a.uri === tree || docs.has(a.uri) ? 'granted' : 'denied';
    case 'getFile': {
      let d = [...docs.values()].find(d => d.name === a.name);
      if (!d && a.create) d = create(a.name);
      if (!d) throw Object.assign(new Error('Missing file'), {name: 'NotFoundError'});
      return describe(d);
    }
    case 'readBegin': {
      const d = docs.get(a.uri), token = String(++serial);
      transfers.set(token, {bytes: Buffer.from(d.bytes)});
      return {token, name: d.name, size: d.bytes.length, revision: hash(d.bytes)};
    }
    case 'readChunk': return transfers.get(a.token).bytes.subarray(a.offset, a.offset + 96 * 1024).toString('base64');
    case 'release': transfers.delete(a.token); return true;
    case 'writeBegin': {
      const token = String(++serial); transfers.set(token, {uri: a.uri, revision: a.revision, bytes: Buffer.alloc(0)}); return token;
    }
    case 'writeChunk': {
      const t = transfers.get(a.token); t.bytes = Buffer.concat([t.bytes, Buffer.from(a.data, 'base64')]); return true;
    }
    case 'writeCommit': {
      const t = transfers.get(a.token), d = docs.get(t.uri);
      if (t.revision !== hash(d.bytes)) throw Object.assign(new Error('External modification'), {name: 'InvalidStateError'});
      d.bytes = t.bytes; return {revision: hash(d.bytes)};
    }
    case 'exportTarget': {
      let name = a.name, i = 2;
      while ([...docs.values()].some(d => d.name === name)) name = a.name + ' (' + i++ + ')';
      const d = create(name); return {...describe(d), revision: hash(d.bytes)};
    }
    case 'notify': notices.push(a.message); return true;
    case 'printHtml': printHtml = a.html; return true;
    case 'pickFiles': return [...docs.values()].filter(d => d.name.endsWith('.mmb')).map(describe);
    default: throw new Error('Unexpected method ' + method);
  }
}
class Element {
  constructor(tag) { this.tagName = tag; this.style = {}; this.attrs = {}; this.id = ''; }
  setAttribute(k, v) { this.attrs[k] = v; }
  remove() { nodes.delete(this.id); }
  closest() { return null; }
}
class Anchor extends Element {
  constructor() { super('a'); this.href = ''; this.download = ''; }
  click() { throw new Error('Browser download was reached instead of the Android export adapter.'); }
}
const document = {
  body: {append(node) { nodes.set(node.id, node); }},
  activeElement: {blur() {}},
  createElement(tag) { return tag === 'a' ? new Anchor() : new Element(tag); },
  getElementById(id) { return nodes.get(id) || null; },
  querySelector() { return null; },
  addEventListener(name, fn) { listeners.set(name, fn); }
};
const session = {dirtyCount: 0, archives: [], companionState: {pending: 0, unsaved: false}};
const context = {console, Blob, File, URL: class extends URL {}, DOMException, Uint8Array, Map, WeakSet, Promise, String, JSON,
  atob, btoa, Event, document, HTMLAnchorElement: Anchor};
context.window = context;
context.mmex = {getSession: () => session, flushCompanion: async () => { flushes++; }};
context.StudioNative = {postMessage(raw) {
  const request = JSON.parse(raw);
  setImmediate(async () => {
    try { context.MMEXAndroid.receive({id: request.id, ok: true, value: await dispatch(request)}); }
    catch (e) { context.MMEXAndroid.receive({id: request.id, ok: false, name: e.name, message: e.message}); }
  });
}};
vm.createContext(context);
vm.runInContext(fs.readFileSync(path.join(root, 'app/src/main/assets/android-bridge.js'), 'utf8'), context);
const api = context.MMEXAndroid;
context.mmex.selectWorkingFolder = async () => { const h = await context.showDirectoryPicker(); await api.rememberFolder(h); return true; };
const done = name => checks.push(name);
const wait = () => new Promise(resolve => setImmediate(resolve));
async function main() {
  assert.equal(await api.restoreFolder(), null);
  const folderHandle = await context.showDirectoryPicker(); await api.rememberFolder(folderHandle);
  assert.equal((await api.restoreFolder()).tree, tree); done('Selected folder is remembered and restored.');
  assert.equal(await folderHandle.queryPermission(), 'granted'); done('Folder permission checks use the granted tree URI.');
  const h = await folderHandle.getFileHandle('test.studio.json');
  assert.equal(await (await h.getFile()).text(), '{"note":"أسامة"}\n'); done('UTF-8 companion bytes are preserved.');
  let writer = await h.createWritable(); await writer.write('first payload');
  assert.equal(companion.bytes.toString(), '{"note":"أسامة"}\n'); done('Writes remain buffered until close.');
  await writer.close(); assert.equal(companion.bytes.toString(), 'first payload'); done('Close commits the exact payload.');
  writer = await h.createWritable(); await writer.write('second payload'); await writer.close();
  assert.equal(companion.bytes.toString(), 'second payload'); done('Consecutive autosaves update the revision token.');
  const binary = await folderHandle.getFileHandle('binary-test.bin', {create: true});
  const bytes = Uint8Array.from({length: 300000}, (_, i) => i % 256);
  writer = await binary.createWritable(); await writer.write(bytes); await writer.close();
  assert.deepEqual(Buffer.from(await (await binary.getFile()).arrayBuffer()), Buffer.from(bytes)); done('300,000-byte binary data survives chunked read/write.');
  writer = await h.createWritable(); await writer.write('stale overwrite'); companion.bytes = Buffer.from('external update');
  await assert.rejects(writer.close(), e => e.name === 'InvalidStateError');
  assert.equal(companion.bytes.toString(), 'external update'); done('Native stale-revision errors propagate without hiding an external update.');
  writer = await h.createWritable(); await writer.write('aborted'); await writer.abort();
  assert.equal(companion.bytes.toString(), 'external update'); done('Abort leaves original bytes unchanged.');
  await assert.rejects(folderHandle.getFileHandle('missing.json'), e => e.name === 'NotFoundError'); done('Missing-file errors retain their DOMException name.');
  const anchor = new Anchor(); anchor.href = context.URL.createObjectURL(new Blob(['report bytes'])); anchor.download = 'report.csv';
  anchor.click(); context.URL.revokeObjectURL(anchor.href);
  while (api.backState() === 'busy') await wait();
  assert.equal([...docs.values()].find(d => d.name === 'report.csv').bytes.toString(), 'report bytes');
  done('Detached Blob export survives immediate URL revocation.');
  await api.exportBlob(new Blob(['next report']), 'report.csv');
  assert.equal([...docs.values()].filter(d => d.name.startsWith('report.csv')).length, 2); done('Exports request a fresh target instead of overwriting an existing export.');
  assert.equal(api.beginDatabaseSave(), true); assert.equal(api.beginDatabaseSave(), false); assert.equal(api.backState(), 'busy');
  let blocked = false; listeners.get('click')({preventDefault() {blocked = true;}, stopImmediatePropagation() {}});
  assert.equal(blocked, true); api.endDatabaseSave(); assert.equal(nodes.size, 0); done('MMB save locks editing, repeat Save, and Back until completion.');
  session.dirtyCount = 1; assert.equal(api.backState(), 'dirty'); session.dirtyCount = 0;
  session.companionState.unsaved = true; assert.equal(api.backState(), 'dirty'); session.companionState.unsaved = false;
  done('Back reports unsaved MMB or companion edits.');
  api.flushOnPause(); await wait(); assert.equal(flushes, 1); done('Pause flushes the existing companion queue without saving the MMB.');
  await api.printHtml('<html>report</html>'); assert.equal(printHtml, '<html>report</html>'); done('Report HTML is handed to native printing.');
  assert.equal(transfers.size, 0); done('Read, commit, failure, and abort leave no pending transfer tokens.');
  const result = {passed: checks.length, checks, limitations: ['Node contract tests with a mock native provider.', 'Android SAF recovery, printing, UI layout, and physical-device behavior require device testing.', 'No financial database was modified.']};
  fs.writeFileSync(path.join(root, 'BRIDGE-TEST-RESULTS.json'), JSON.stringify(result, null, 2) + '\n');
  console.log(JSON.stringify(result, null, 2));
}
main().catch(e => {console.error(e); process.exitCode = 1;});
