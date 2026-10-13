#!/usr/bin/env python3
"""Apply only Android I/O hooks; leave Studio's SQL and financial logic unchanged."""
import argparse
import base64
import gzip
import hashlib
import json
import re
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]

def replace_once(text, old, new):
    count = text.count(old)
    if count != 1:
        raise ValueError(f'Expected one Android hook, got {count}: {old[:90]}')
    return text.replace(old, new, 1)

def wrap(source):
    original = source.read_bytes()
    html = original.decode('utf-8')
    hooks = []
    def convert(match):
        js = gzip.decompress(base64.b64decode(match.group(1))).decode('utf-8')
        if 'function folderStore' not in js:
            return match.group(0)
        substitutions = [
            ("function folderStore(write=false,handle=null){return new Promise",
             "function folderStore(write=false,handle=null){if(window.MMEXAndroid)return write?MMEXAndroid.rememberFolder(handle):MMEXAndroid.restoreFolder();return new Promise"),
            ('const direct = typeof window.showOpenFilePicker === "function" && !mobile;',
             'const direct = typeof window.showOpenFilePicker === "function" && (!mobile || !!window.MMEXAndroid);'),
            ('function printReport() { if (!reportRows.length&&!reportConfig.baseKind) return;',
             'function printReport() { if (!reportRows.length&&!reportConfig.baseKind) return; if(window.MMEXAndroid){MMEXAndroid.printHtml(standaloneReportHtml()).catch(e=>toast(e.message,"error"));return;}'),
            ('<button class="button secondary small" onclick="mmex.openLinkedWindow()">${uiIcon(\'window\')}<span>New window</span></button>',
             '${window.MMEXAndroid?\'\':`<button class="button secondary small" onclick="mmex.openLinkedWindow()">${uiIcon(\'window\')}<span>New window</span></button>`}'),
            ('window.mmex = {', 'window.mmex = {\n    flushCompanion,')
        ]
        substitutions += [
            ('if (!currentFileHandle) { downloadDatabase(); return; }',
             'if (!currentFileHandle) { downloadDatabase(); return; }\n    if(window.MMEXAndroid&&!MMEXAndroid.beginDatabaseSave())return;'),
            ('`Could not save in place: ${error.message}`, "error"); }',
             '`Could not save in place: ${error.message}`, "error"); } finally { if(window.MMEXAndroid)MMEXAndroid.endDatabaseSave(); }')
        ]
        for old, new in substitutions:
            js = replace_once(js, old, new)
            hooks.append(old[:100])
        compressed = base64.b64encode(gzip.compress(js.encode('utf-8'), mtime=0)).decode('ascii')
        return '<script type="application/x-mmex-gzip">' + compressed + '</script>'
    html = re.sub(r'<script type="application/x-mmex-gzip">([^<]+)</script>', convert, html)
    if len(hooks) != 7:
        raise ValueError('Studio payload was not recognized. Refusing to produce a partial adapter.')
    html = replace_once(html, '<head>', '<head>\n  <script src="android-bridge.js"></script>')
    html = replace_once(html, '✓ No installation', '✓ Works offline')
    html = replace_once(html, 'Drop one or more files here, or choose them from your device.',
                        'Select the folder containing your files and their companion file, then open one or several files.')
    html = html.replace('Select several period files (Ctrl+click)', 'Select several period files')
    html = re.sub(r'(<small class="build-id">Diwan [0-9.]+)</small>', r'\1 · Android</small>', html, count=1)
    (ROOT / 'app/src/main/assets/index.html').write_text(html, encoding='utf-8')
    (ROOT / 'SOURCE.json').write_text(json.dumps({
        'source_file': source.name,
        'source_sha256': hashlib.sha256(original).hexdigest(),
        'android_hooks': hooks,
        'financial_logic': 'Unchanged',
        'file_save': 'Explicit Save button',
        'companion_save': 'Existing queued autosave to selected folder',
    }, indent=2) + '\n')
    print('Android assets created from', source.name)

if __name__ == '__main__':
    parser = argparse.ArgumentParser()
    parser.add_argument('studio_html', type=Path)
    wrap(parser.parse_args().studio_html)
