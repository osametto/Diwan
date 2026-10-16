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
    mobile_core = (ROOT / "tools/mobile-core.js").read_text(encoding="utf-8")
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
            ('window.mmex = {', mobile_core + '\nwindow.mmex = {\n    mobileSnapshot,mobileTransactions,mobileDetail,mobileBudget,mobileAllocate,flushCompanion,')
        ]
        substitutions += [
            ('enhanceDropdowns(true);prepareListLayout();', 'enhanceDropdowns(true);prepareListLayout();window.DiwanMobile?.refresh();'),
            ('function updateHeader() {', 'function updateHeader() { window.DiwanMobile?.refresh();'),
            ('async function openFiles(list, handles = []) {',
             "async function openFiles(list, handles = []) { if(Array.from(list).some(file=>!/[.](diwan|mmb)$/i.test(file.name))){toast('Android opens .diwan and .mmb files only.','error');return;}"),
            ('if (!currentFileHandle) { downloadDatabase(); return; }',
             'if (!currentFileHandle) { downloadDatabase(); return; }\n    if(window.MMEXAndroid&&!MMEXAndroid.beginDatabaseSave())return;'),
            ('`Could not save in place: ${error.message}`, "error"); }',
             '`Could not save in place: ${error.message}`, "error"); } finally { if(window.MMEXAndroid)MMEXAndroid.endDatabaseSave(); }')
        ]
        for old, new in substitutions:
            js = replace_once(js, old, new)
            hooks.append(old[:100])
        js = js.replace('[".diwan", ".mmb", ".db", ".sqlite"]', '[".diwan", ".mmb"]')
        js = js.replace('.diwan,.mmb,.db,.sqlite', '.diwan,.mmb')
        compressed = base64.b64encode(gzip.compress(js.encode('utf-8'), mtime=0)).decode('ascii')
        return '<script type="application/x-mmex-gzip">' + compressed + '</script>'
    html = re.sub(r'<script type="application/x-mmex-gzip">([^<]+)</script>', convert, html)
    if len(hooks) != 10:
        raise ValueError('Studio payload was not recognized. Refusing to produce a partial adapter.')
    html = replace_once(html, '<head>', '<head>\n  <script src="android-bridge.js"></script>')
    html = html.replace('</head>', '<link rel="stylesheet" href="mobile-shell.css"><script defer src="mobile-shell.js"></script></head>')
    html = html.replace('✓ No installation', '✓ Works offline')
    html = re.sub(r'(<input id="file-input"[^>]*accept=")[^"]*', r'\g<1>.diwan,.mmb', html)
    html = html.replace('Choose a Diwan-compatible finance file from your device.', 'Open a .diwan or .mmb file from your working folder.')
    html = html.replace('Drop one or more files here, or choose them from your device.', 'Choose your .diwan file or one or more .mmb period files.')
    html = re.sub(r'(<small class="build-id">).*?(</small>)', r'\g<1>DIWAN 1.2.12 · Android\2', html)

    html = html.replace('Drop one or more MMB files here, or choose them from your device.',
                        'Select the folder containing your MMB and companion JSON, then open one or several MMB files.')
    html = html.replace('Select several period files (Ctrl+click)', 'Select several period files')
    html = html.replace('Offline Studio v2.29</small>', 'Offline Studio v2.29 · Android 1</small>')
    (ROOT / 'app/src/main/assets/index.html').write_text(html, encoding='utf-8')
    (ROOT / 'SOURCE.json').write_text(json.dumps({
        'source_file': source.name,
        'source_sha256': hashlib.sha256(original).hexdigest(),
        'android_hooks': hooks,
        'financial_logic': 'Unchanged',
        'supported_finance_formats': ['.diwan', '.mmb'],
        'mmb_save': 'Explicit Save button',
        'companion_save': 'Existing queued autosave to selected folder',
    }, indent=2) + '\n')
    print('Android assets created from', source.name)

if __name__ == '__main__':
    parser = argparse.ArgumentParser()
    parser.add_argument('studio_html', type=Path)
    args = parser.parse_args()
    source = args.studio_html
    if not source.is_file() and not source.is_absolute():
        source = ROOT / source
    if not source.is_file():
        parser.error(f"Missing engine input: {args.studio_html}. Restore Diwan-1.2.12.html from the complete source ZIP. The GitHub workflow can also test/build the committed prepared app/src/main/assets without regenerating it.")
    wrap(source)
