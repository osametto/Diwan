/* Android SAF adapter for the exact file-handle subset used by Offline Studio. */
(() => {
  'use strict';
  if (!window.StudioNative) return;
  const pending = new Map();
  const handleCache = new Map();
  let sequence = 0, exportsPending = 0, activeFolder = null, savingDatabase = false;
  function call(method, args = {}) {
    return new Promise((resolve, reject) => {
      const id = String(++sequence);
      pending.set(id, {resolve, reject});
      try { StudioNative.postMessage(JSON.stringify({id, method, args})); }
      catch (error) { pending.delete(id); reject(error); }
    });
  }
  function decode(base64) { return Uint8Array.from(atob(base64), c => c.charCodeAt(0)); }
  function encode(bytes) {
    let string = '';
    for (let i = 0; i < bytes.length; i += 8192) string += String.fromCharCode(...bytes.subarray(i, i + 8192));
    return btoa(string);
  }
  function fromDescription(data) {
    if (!data) return null;
    const existing = handleCache.get(data.uri);
    if (existing) return existing;
    const handle = data.kind === 'directory' ? new FolderHandle(data) : new FileHandle(data);
    handleCache.set(data.uri, handle);
    return handle;
  }
  class BaseHandle {
    constructor(data) { Object.assign(this, data); }
    async queryPermission() { return call('permission', {uri: this.kind === 'directory' ? this.tree : this.uri}); }
    async requestPermission() { return this.queryPermission(); }
    async isSameEntry(other) { return !!other && this.uri === other.uri; }
  }
  class FolderHandle extends BaseHandle {
    async getFileHandle(name, options = {}) {
      return fromDescription(await call('getFile', {tree: this.tree, name, create: !!options.create}));
    }
  }
  class FileHandle extends BaseHandle {
    async getFile() {
      const info = await call('readBegin', {uri: this.uri});
      const chunks = [];
      try {
        for (let offset = 0; offset < info.size;) {
          const chunk = decode(await call('readChunk', {token: info.token, offset}));
          if (!chunk.length) throw new Error('Android provider returned an incomplete file.');
          chunks.push(chunk); offset += chunk.length;
        }
        this.revision = info.revision;
        return new File(chunks, info.name || this.name, {lastModified: info.lastModified || Date.now()});
      } finally { await call('release', {token: info.token}); }
    }
    async createWritable() {
      // Studio reads MMB and existing JSON first. New companions need an empty-file revision.
      if (!this.revision) await this.getFile();
      const target = this;
      let chunks = [], closed = false, token = null;
      return {
        async write(data) {
          if (closed) throw new DOMException('Writer is closed.', 'InvalidStateError');
          if (data && typeof data === 'object' && data.type === 'write') data = data.data;
          chunks.push(data instanceof Blob ? data : new Blob([data]));
        },
        async close() {
          if (closed) throw new DOMException('Writer is closed.', 'InvalidStateError');
          closed = true;
          token = await call('writeBegin', {uri: target.uri, revision: target.revision});
          try {
            const blob = new Blob(chunks);
            for (let offset = 0; offset < blob.size; offset += 96 * 1024) {
              const bytes = new Uint8Array(await blob.slice(offset, offset + 96 * 1024).arrayBuffer());
              await call('writeChunk', {token, data: encode(bytes)});
            }
            const result = await call('writeCommit', {token});
            target.revision = result.revision;
          } finally { await call('release', {token}); chunks = []; }
        },
        async abort() { closed = true; chunks = []; if (token) await call('release', {token}); }
      };
    }
  }
  window.MMEXAndroid = {
    call,
    receive(result) {
      const entry = pending.get(result.id);
      if (!entry) return;
      pending.delete(result.id);
      if (result.ok) entry.resolve(result.value);
      else entry.reject(new DOMException(result.message || 'Android operation failed.', result.name || 'OperationError'));
    },
    async restoreFolder() { activeFolder = fromDescription(await call('restoreFolder')); return activeFolder; },
    async rememberFolder(handle) { activeFolder = handle; return call('rememberFolder', {tree: handle.tree}); },
    printHtml(html) { return call('printHtml', {html}); },
    beginDatabaseSave() {
      if (savingDatabase) return false;
      savingDatabase = true;
      const cover = document.createElement('div');
      cover.id = 'android-save-cover'; cover.setAttribute('role', 'status'); cover.setAttribute('aria-live', 'polite');
      cover.style.cssText = 'position:fixed;inset:0;z-index:2147483647;background:rgba(25,15,35,.8);display:grid;place-content:center;color:#fff;font:600 18px sans-serif;text-align:center;padding:24px;';
      cover.textContent = 'Saving document… Please wait.';
      document.body.append(cover);
      document.activeElement?.blur();
      return true;
    },
    endDatabaseSave() { savingDatabase = false; document.getElementById('android-save-cover')?.remove(); },
    backState() {
      if (savingDatabase) return 'busy';
      const dialog = document.querySelector('dialog[open]');
      if (dialog) { const cancel = new Event('cancel', {cancelable: true}); if(dialog.dispatchEvent(cancel)) dialog.close(); return 'handled'; }
      if (window.DiwanMobile?.back()) return 'handled';
      const nav = document.getElementById('mobile-more-dialog');
      if (nav && !nav.classList.contains('hidden')) { nav.classList.add('hidden'); return 'handled'; }
      const session = window.mmex?.getSession();
      if (exportsPending || pending.size || session?.companionState?.pending) return 'busy';
      if (session?.dirtyCount || session?.archives?.some(a => a.dirty) || session?.companionState?.unsaved) return 'dirty';
      const before = new Event('beforeunload', {cancelable:true});
      window.dispatchEvent(before);
      if(before.defaultPrevented) return 'dirty';
      return 'exit';
    },
    flushOnPause() { window.mmex?.flushCompanion?.().catch(error => console.error(error)); },
    async exportBlob(blob, name) {
      exportsPending++;
      try {
        if (!activeFolder && !await window.mmex.selectWorkingFolder(false)) return;
        const target = fromDescription(await call('exportTarget', {tree: activeFolder.tree, name}));
        const writer = await target.createWritable();
        await writer.write(blob); await writer.close();
        await call('notify', {message: 'Saved to Studio Exports/' + target.name});
      } catch (error) {
        await call('notify', {message: 'Export failed: ' + error.message});
        console.error(error);
      } finally { exportsPending--; }
    }
  };
  window.showDirectoryPicker = async () => {
    activeFolder = fromDescription(await call('chooseFolder'));
    return activeFolder;
  };
  window.showOpenFilePicker = async options => {
    if (!activeFolder && !await window.mmex.selectWorkingFolder(false)) throw new DOMException('No folder selected.', 'AbortError');
    const requestedTree = options?.startIn?.tree || activeFolder.tree;
    return (await call('pickFiles', {tree: requestedTree})).map(fromDescription);
  };

  // Cover all existing Blob exports, including detached anchors and dispatchEvent.
  // Capture the Blob immediately: Studio revokes its object URL after 1–1.2 seconds.
  const blobs = new Map();
  const createUrl = URL.createObjectURL.bind(URL), revokeUrl = URL.revokeObjectURL.bind(URL);
  URL.createObjectURL = blob => { const url = createUrl(blob); blobs.set(url, blob); return url; };
  URL.revokeObjectURL = url => { blobs.delete(url); revokeUrl(url); };
  const click = HTMLAnchorElement.prototype.click;
  const dispatched = new WeakSet();
  function exportAnchor(anchor) {
    if (!anchor.download || !anchor.href.startsWith('blob:')) return false;
    const blob = blobs.get(anchor.href);
    if (!blob) return false;
    MMEXAndroid.exportBlob(blob, anchor.download);
    return true;
  }
  HTMLAnchorElement.prototype.click = function() {
    if (exportAnchor(this)) return;
    dispatched.add(this); try { return click.call(this); } finally { dispatched.delete(this); }
  };
  document.addEventListener('click', event => {
    if (savingDatabase) { event.preventDefault(); event.stopImmediatePropagation(); return; }
    const anchor = event.target.closest?.('a[download]');
    if (anchor && !dispatched.has(anchor) && exportAnchor(anchor)) event.preventDefault();
  }, true);
  document.addEventListener('keydown', event => {
    if (savingDatabase) { event.preventDefault(); event.stopImmediatePropagation(); }
  }, true);
})();
