/* Run with PLAYWRIGHT_MODULE=/path/to/playwright node tools/check_bridge.cjs.
 * Tests the real wrapped HTML and JS adapter against a mock Android provider.
 * Does not test Android's SAF provider or modify a financial database.
 */
const {chromium} = require(process.env.PLAYWRIGHT_MODULE || 'playwright');
const fs = require('node:fs');
const path = require('node:path');
const http = require('node:http');
const crypto = require('node:crypto');
const assert = require('node:assert/strict');
const root = path.resolve(__dirname, '../app/src/main/assets');
const digest = bytes => crypto.createHash('sha256').update(bytes).digest('base64');
const owner = 'content://mock/tree/finance';
const folder = {uri: owner + '/document/finance', tree: owner, name: 'Finance', kind: 'directory'};
const docs = new Map();
const transfers = new Map();
const notifications = [];
let remembered = true, seq = 0, printed = null;
function makeDoc(name, bytes = Buffer.alloc(0)) {
  const uri = owner + '/document/' + encodeURIComponent(name);
  const entry = {uri, tree: owner, name, kind: 'file', bytes, lastModified: Date.now()};
  docs.set(uri, entry); return entry;
}
function describe(doc) { return {...doc, bytes: undefined, size: doc.bytes.length}; }
const original = makeDoc('test.studio.json', Buffer.from('{"note":"أسامة"}\n'));
async function dispatch(request) {
  const {method, args: a} = request;
  switch (method) {
    case 'restoreFolder': return remembered ? folder : null;
    case 'rememberFolder': remembered = true; return true;
    case 'chooseFolder': return folder;
    case 'permission': return a.uri === owner || docs.has(a.uri) ? 'granted' : 'denied';
    case 'pickFiles': return [];
    case 'getFile': {
      let d = [...docs.values()].find(d => d.name === a.name);
      if (!d && a.create) d = makeDoc(a.name);
      if (!d) throw Object.assign(new Error('Missing file.'), {name: 'NotFoundError'});
      return describe(d);
    }
    case 'readBegin': {
      const d = docs.get(a.uri), token = String(++seq);
      transfers.set(token, {bytes: Buffer.from(d.bytes)});
      return {token, name: d.name, size: d.bytes.length, revision: digest(d.bytes), lastModified: d.lastModified};
    }
    case 'readChunk': return transfers.get(a.token).bytes.subarray(a.offset, a.offset + 96 * 1024).toString('base64');
    case 'release': transfers.delete(a.token); return true;
    case 'writeBegin': {
      const token = String(++seq); transfers.set(token, {bytes: Buffer.alloc(0), uri: a.uri, revision: a.revision}); return token;
    }
    case 'writeChunk': {
      const t = transfers.get(a.token); t.bytes = Buffer.concat([t.bytes, Buffer.from(a.data, 'base64')]); return true;
    }
    case 'writeCommit': {
      const t = transfers.get(a.token), d = docs.get(t.uri);
      if (digest(d.bytes) !== t.revision) throw Object.assign(new Error('File changed outside Studio.'), {name: 'InvalidStateError'});
      d.bytes = t.bytes; return {revision: digest(d.bytes)};
    }
    case 'exportTarget': {
      let name = a.name, i = 2;
      while ([...docs.values()].some(d => d.name === name)) name = a.name + ' (' + i++ + ')';
      const d = makeDoc(name); return {...describe(d), revision: digest(d.bytes)};
    }
    case 'notify': notifications.push(a.message); return true;
    case 'printHtml': printed = a.html; return true;
    default: throw new Error('Unknown mock method: ' + method);
  }
}
async function main() {
  const server = http.createServer((req, res) => {
    const file = path.join(root, req.url === '/' ? 'index.html' : req.url.slice(1));
    if (!file.startsWith(root + '/') || !fs.existsSync(file)) { res.writeHead(404).end(); return; }
    res.setHeader('Content-Type', file.endsWith('.js') ? 'application/javascript' : 'text/html; charset=utf-8');
    res.end(fs.readFileSync(file));
  });
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  let browser;
  const checks = [], errors = [];
  try {
    browser = await chromium.launch({headless: true, executablePath: process.env.CHROMIUM_EXECUTABLE || chromium.executablePath(), args: ['--no-sandbox','--no-zygote','--single-process','--in-process-gpu']});
    const page = await browser.newPage({viewport: {width: 412, height: 915}, userAgent: 'Mozilla/5.0 (Linux; Android 14) AppleWebKit/537.36 Chrome/140.0.0.0 Mobile Safari/537.36'});
    page.on('pageerror', error => errors.push(error.message));
    await page.exposeFunction('mockNative', async raw => {
      const request = JSON.parse(raw);
      try { return {id: request.id, ok: true, value: await dispatch(request)}; }
      catch (e) { return {id: request.id, ok: false, name: e.name, message: e.message}; }
    });
    await page.addInitScript(() => { window.StudioNative = {postMessage: raw => window.mockNative(raw).then(result => window.MMEXAndroid.receive(result))}; });
    await page.goto('http://127.0.0.1:' + server.address().port);
    await page.waitForFunction(() => window.mmex && document.getElementById('working-folder-button').textContent.includes('Finance'));
    assert.equal(errors.length, 0, errors.join('; ')); checks.push('Wrapped Studio starts at mobile viewport without JS errors.');
    assert.equal(await page.locator('#open-direct-button').isVisible(), true); checks.push('Android exposes the direct-write Open action.');
    assert.equal(await page.evaluate(async () => (await MMEXAndroid.restoreFolder()).queryPermission()), 'granted');
    checks.push('Folder permissions use the tree URI rather than its document URI.');
    const note = await page.evaluate(async () => {
      const folder = await MMEXAndroid.restoreFolder();
      window.testHandle = await folder.getFileHandle('test.studio.json');
      return await (await testHandle.getFile()).text();
    });
    assert.equal(note, '{"note":"أسامة"}\n'); checks.push('Persisted folder restoration and UTF-8 companion read.');
    await page.evaluate(async () => { window.writer = await testHandle.createWritable(); await writer.write('{"note":"updated"}'); });
    assert.equal(original.bytes.toString(), note); checks.push('Writer buffers changes until close; reads do not overwrite files.');
    await page.evaluate(async () => writer.close());
    assert.equal(original.bytes.toString(), '{"note":"updated"}'); checks.push('Close commits the exact prepared payload.');
    const binaryDigest = await page.evaluate(async () => {
      const folder = await MMEXAndroid.restoreFolder(), handle = await folder.getFileHandle('binary-test.bin', {create: true});
      const bytes = Uint8Array.from({length: 300000}, (_, i) => i % 256);
      const writer = await handle.createWritable(); await writer.write(bytes); await writer.close();
      const read = new Uint8Array(await (await handle.getFile()).arrayBuffer());
      return read.length === bytes.length && read.every((value, i) => value === bytes[i]);
    });
    assert.equal(binaryDigest, true); checks.push('Chunked 300,000-byte binary write/read round trip.');
    await page.evaluate(async () => { window.writer = await testHandle.createWritable(); await writer.write('would overwrite'); });
    original.bytes = Buffer.from('External update');
    const conflict = await page.evaluate(async () => { try { await writer.close(); return 'not rejected'; } catch (e) { return e.name; } });
    assert.equal(conflict, 'InvalidStateError'); assert.equal(original.bytes.toString(), 'External update'); checks.push('Stale revision rejects overwrite of an external update.');
    await page.evaluate(async () => { const writer = await testHandle.createWritable(); await writer.write('aborted'); await writer.abort(); });
    assert.equal(original.bytes.toString(), 'External update'); checks.push('Aborting a writer does not change the document.');
    await page.evaluate(() => {
      const a = document.createElement('a'); a.href = URL.createObjectURL(new Blob(['export body'])); a.download = 'report.csv'; a.click(); URL.revokeObjectURL(a.href);
    });
    await page.waitForFunction(() => MMEXAndroid.backState() !== 'busy');
    assert.equal([...docs.values()].find(d => d.name === 'report.csv').bytes.toString(), 'export body'); checks.push('Detached Blob export survives immediate object-URL revocation.');
    await page.evaluate(() => MMEXAndroid.printHtml('<html><body>Report</body></html>'));
    assert.equal(printed, '<html><body>Report</body></html>'); checks.push('Print HTML reaches the native print hook.');
    assert.equal(await page.evaluate(() => {
      const first = MMEXAndroid.beginDatabaseSave(), second = MMEXAndroid.beginDatabaseSave(), busy = MMEXAndroid.backState();
      MMEXAndroid.endDatabaseSave();
      return first && !second && busy === 'busy' && !document.getElementById('android-save-cover');
    }), true);
    checks.push('MMB save blocks concurrent edits and duplicate Save actions until complete.');
    await page.reload(); await page.waitForFunction(() => window.mmex && document.getElementById('working-folder-button').textContent.includes('Finance'));
    checks.push('Folder reconnects after reloading the app.');
    assert.equal(errors.length, 0, errors.join('; '));
    const result = {passed: checks.length, checks, limitations: ['Mocked provider: Android SAF and physical-device behavior are not exercised.', 'No financial database is modified by this test.']};
    fs.writeFileSync(path.resolve(__dirname, '../BROWSER-TEST-RESULTS.json'), JSON.stringify(result, null, 2) + '\n');
    console.log(JSON.stringify(result, null, 2));
  } finally { if (browser) await browser.close(); server.close(); }
}
main().catch(error => { console.error(error); process.exitCode = 1; });
