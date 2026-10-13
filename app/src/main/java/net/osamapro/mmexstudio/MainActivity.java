package net.osamapro.mmexstudio;

import android.app.Activity;
import android.app.AlertDialog;
import android.content.Intent;
import android.graphics.Color;
import android.net.Uri;
import android.os.Bundle;
import android.os.Handler;
import android.os.Looper;
import android.print.PrintAttributes;
import android.print.PrintManager;
import android.util.Base64;
import android.webkit.JavascriptInterface;
import android.webkit.ValueCallback;
import android.webkit.WebChromeClient;
import android.webkit.WebResourceRequest;
import android.webkit.WebResourceResponse;
import android.webkit.WebSettings;
import android.webkit.WebView;
import android.webkit.WebViewClient;
import android.widget.FrameLayout;
import android.widget.Toast;
import androidx.documentfile.provider.DocumentFile;
import androidx.webkit.WebViewAssetLoader;
import org.json.JSONArray;
import org.json.JSONObject;
import java.io.*;
import java.security.MessageDigest;
import java.util.*;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;

/** Offline UI; native I/O is restricted to documents issued from granted SAF trees. */
public class MainActivity extends Activity {
    private static final int TREE_PICKER = 101, INPUT_PICKER = 102;
    private static final String ORIGIN = "https://appassets.androidplatform.net";
    private static final long MAX_BYTES = 256L * 1024 * 1024;
    private final Handler main = new Handler(Looper.getMainLooper());
    private final ExecutorService io = Executors.newSingleThreadExecutor();
    private final Map<String, DocumentFile> folders = new HashMap<>();
    private final Map<String, String> issued = new HashMap<>();
    private final Map<String, Transfer> transfers = new HashMap<>();
    private WebView web, printView;
    private String folderRequest;
    private ValueCallback<Uri[]> inputCallback;

    private static class BridgeException extends IOException {
        final String kind;
        BridgeException(String kind, String message) { super(message); this.kind = kind; }
    }
    private static class Transfer {
        File file;
        DocumentFile document;
        String tree, revision;
        boolean writing;
    }

    // JavaScript is required by the bundled app. Remote resources and navigation stay outside this WebView.
    @android.annotation.SuppressLint("SetJavaScriptEnabled")
    @Override public void onCreate(Bundle state) {
        super.onCreate(state);
        for (File f : Objects.requireNonNull(getCacheDir().listFiles()))
            if (f.getName().startsWith("studio-transfer-")) f.delete();
        FrameLayout root = new FrameLayout(this);
        root.setBackgroundColor(Color.rgb(75, 23, 102));
        web = new WebView(this);
        root.addView(web, new FrameLayout.LayoutParams(-1, -1));
        root.setOnApplyWindowInsetsListener((view, insets) -> {
            view.setPadding(insets.getSystemWindowInsetLeft(), insets.getSystemWindowInsetTop(),
                insets.getSystemWindowInsetRight(), insets.getSystemWindowInsetBottom());
            return insets.consumeSystemWindowInsets();
        });
        setContentView(root);
        WebSettings settings = web.getSettings();
        settings.setJavaScriptEnabled(true);
        settings.setDomStorageEnabled(true);
        settings.setAllowFileAccess(false);
        settings.setAllowContentAccess(true); // Android <input type=file> imports.
        settings.setMixedContentMode(WebSettings.MIXED_CONTENT_NEVER_ALLOW);
        settings.setSupportMultipleWindows(false);
        settings.setJavaScriptCanOpenWindowsAutomatically(false);
        settings.setBuiltInZoomControls(false);
        WebView.setWebContentsDebuggingEnabled(BuildConfig.DEBUG);
        WebViewAssetLoader assets = new WebViewAssetLoader.Builder()
            .addPathHandler("/assets/", new WebViewAssetLoader.AssetsPathHandler(this)).build();
        web.setWebViewClient(new WebViewClient() {
            @Override public WebResourceResponse shouldInterceptRequest(WebView view, WebResourceRequest req) {
                WebResourceResponse result = assets.shouldInterceptRequest(req.getUrl());
                if (result != null) return result;
                // No remote resources are needed. The bridge never visits external pages.
                return new WebResourceResponse("text/plain", "UTF-8", 403, "Blocked", new HashMap<>(), new ByteArrayInputStream(new byte[0]));
            }
            @Override public boolean shouldOverrideUrlLoading(WebView view, WebResourceRequest req) {
                if (req.getUrl().toString().startsWith(ORIGIN + "/assets/")) return false;
                if (req.isForMainFrame() && ("https".equals(req.getUrl().getScheme()) || "http".equals(req.getUrl().getScheme()))) {
                    try { startActivity(new Intent(Intent.ACTION_VIEW, req.getUrl())); } catch (Exception ignored) { }
                }
                return true;
            }
        });
        web.setWebChromeClient(new WebChromeClient() {
            @Override public boolean onShowFileChooser(WebView view, ValueCallback<Uri[]> callback, FileChooserParams params) {
                if (inputCallback != null) inputCallback.onReceiveValue(null);
                inputCallback = callback;
                Intent intent = new Intent(Intent.ACTION_OPEN_DOCUMENT).setType("*/*")
                    .addCategory(Intent.CATEGORY_OPENABLE)
                    .putExtra(Intent.EXTRA_ALLOW_MULTIPLE, params.getMode() == FileChooserParams.MODE_OPEN_MULTIPLE);
                try { startActivityForResult(intent, INPUT_PICKER); }
                catch (Exception e) { inputCallback.onReceiveValue(null); inputCallback = null; }
                return true;
            }
            @Override public boolean onJsAlert(WebView view, String url, String message, android.webkit.JsResult result) {
                new AlertDialog.Builder(MainActivity.this).setMessage(message).setPositiveButton("OK", (d, w) -> result.confirm())
                    .setOnCancelListener(d -> result.cancel()).show(); return true;
            }
            @Override public boolean onJsConfirm(WebView view, String url, String message, android.webkit.JsResult result) {
                new AlertDialog.Builder(MainActivity.this).setMessage(message).setPositiveButton("OK", (d, w) -> result.confirm())
                    .setNegativeButton("Cancel", (d, w) -> result.cancel()).setOnCancelListener(d -> result.cancel()).show(); return true;
            }
        });
        web.addJavascriptInterface(new Object() {
            @JavascriptInterface public void postMessage(String raw) {
                io.execute(() -> {
                    String id = "";
                    try {
                        JSONObject request = new JSONObject(raw); id = request.getString("id");
                        dispatch(id, request.getString("method"), request.optJSONObject("args"));
                    } catch (Exception e) { fail(id, e); }
                });
            }
        }, "StudioNative");
        web.loadUrl(ORIGIN + "/assets/index.html");
    }

    private void reply(String id, Object value) {
        try {
            JSONObject result = new JSONObject().put("id", id).put("ok", true).put("value", value == null ? JSONObject.NULL : value);
            main.post(() -> { if (!isFinishing()) web.evaluateJavascript("window.MMEXAndroid&&window.MMEXAndroid.receive(" + result + ")", null); });
        } catch (Exception ignored) { }
    }
    private void fail(String id, Exception e) {
        try {
            String kind = e instanceof BridgeException ? ((BridgeException)e).kind : e instanceof SecurityException ? "NotAllowedError" : "OperationError";
            JSONObject result = new JSONObject().put("id", id).put("ok", false).put("name", kind)
                .put("message", e.getMessage() == null ? "Android file operation failed." : e.getMessage());
            main.post(() -> { if (!isFinishing()) web.evaluateJavascript("window.MMEXAndroid&&window.MMEXAndroid.receive(" + result + ")", null); });
        } catch (Exception ignored) { }
    }
    private DocumentFile tree(String key) throws Exception {
        DocumentFile dir = folders.get(key);
        if (dir == null || !dir.exists() || !dir.canRead() || !dir.canWrite())
            throw new BridgeException("NotAllowedError", "Folder access is no longer available. Select the working folder again.");
        return dir;
    }
    private DocumentFile document(String uri) throws Exception {
        String owner = issued.get(uri);
        if (owner == null) throw new BridgeException("NotAllowedError", "This document was not selected through the app.");
        tree(owner);
        DocumentFile doc = DocumentFile.fromSingleUri(this, Uri.parse(uri));
        if (doc == null || !doc.exists()) throw new BridgeException("NotFoundError", "The selected file was moved or deleted.");
        return doc;
    }
    private JSONObject describe(DocumentFile doc, String owner, String kind) throws Exception {
        if ("file".equals(kind)) issued.put(doc.getUri().toString(), owner);
        return new JSONObject().put("uri", doc.getUri().toString()).put("name", doc.getName())
            .put("tree", owner).put("kind", kind).put("size", doc.length()).put("lastModified", doc.lastModified());
    }
    private JSONObject restoreFolder() throws Exception {
        String saved = getPreferences(MODE_PRIVATE).getString("tree", "");
        if (saved.isEmpty()) return null;
        DocumentFile dir = DocumentFile.fromTreeUri(this, Uri.parse(saved));
        if (dir == null || !dir.exists() || !dir.canWrite()) return null;
        folders.put(saved, dir);
        return describe(dir, saved, "directory");
    }
    private void validName(String name) throws Exception {
        if (name.isEmpty() || name.length() > 240 || name.equals(".") || name.equals("..") || name.matches(".*[/\\\\\u0000].*"))
            throw new BridgeException("TypeError", "Invalid file name.");
    }
    private void dispatch(String id, String method, JSONObject a) throws Exception {
        if (a == null) a = new JSONObject();
        switch (method) {
            case "restoreFolder": reply(id, restoreFolder()); break;
            case "rememberFolder": tree(a.getString("tree"));
                getPreferences(MODE_PRIVATE).edit().putString("tree", a.getString("tree")).apply(); reply(id, true); break;
            case "chooseFolder": main.post(() -> chooseFolder(id)); break;
            case "pickFiles": {
                String owner = a.getString("tree"); DocumentFile dir = tree(owner);
                List<DocumentFile> choices = new ArrayList<>();
                for (DocumentFile f : dir.listFiles()) if (f.isFile() && f.getName() != null && f.getName().toLowerCase(Locale.ROOT).matches(".*\\.(mmb|db|sqlite)$")) choices.add(f);
                choices.sort(Comparator.comparing(f -> f.getName().toLowerCase(Locale.ROOT)));
                main.post(() -> pickFiles(id, owner, choices, true)); break;
            }
            case "permission": {
                try { String key = a.getString("uri"); if (folders.containsKey(key)) tree(key); else document(key); reply(id, "granted"); }
                catch (Exception e) { reply(id, "denied"); } break;
            }
            case "getFile": {
                String owner = a.getString("tree"), name = a.getString("name"); validName(name);
                DocumentFile doc = tree(owner).findFile(name);
                if (doc == null && a.optBoolean("create")) doc = tree(owner).createFile(mime(name), name);
                if (doc == null) throw new BridgeException("NotFoundError", "File not found: " + name);
                if (!doc.isFile()) throw new BridgeException("TypeMismatchError", "This name belongs to a folder.");
                reply(id, describe(doc, owner, "file")); break;
            }
            case "readBegin": {
                String uri = a.getString("uri"); DocumentFile doc = document(uri);
                Transfer t = new Transfer(); t.document = doc; t.file = File.createTempFile("studio-transfer-", ".read", getCacheDir());
                try (InputStream in = getContentResolver().openInputStream(doc.getUri()); OutputStream out = new FileOutputStream(t.file)) { copy(in, out); }
                t.revision = hash(t.file); String token = UUID.randomUUID().toString(); transfers.put(token, t);
                reply(id, new JSONObject().put("token", token).put("size", t.file.length()).put("revision", t.revision)
                    .put("name", doc.getName()).put("lastModified", doc.lastModified())); break;
            }
            case "readChunk": {
                Transfer t = transfer(a.getString("token"), false); byte[] buf = new byte[96 * 1024];
                int count; try (RandomAccessFile in = new RandomAccessFile(t.file, "r")) { in.seek(a.getLong("offset")); count = in.read(buf); }
                reply(id, count <= 0 ? "" : Base64.encodeToString(buf, 0, count, Base64.NO_WRAP)); break;
            }
            case "release": { Transfer t = transfers.remove(a.getString("token")); if (t != null) t.file.delete(); reply(id, true); break; }
            case "writeBegin": {
                String uri = a.getString("uri"); DocumentFile doc = document(uri);
                if (!doc.canWrite()) throw new BridgeException("NotAllowedError", "The selected file is read-only.");
                String expected = a.optString("revision", "");
                if (expected.isEmpty()) throw new BridgeException("InvalidStateError", "Read the file before overwriting it.");
                Transfer t = new Transfer(); t.document = doc; t.tree = issued.get(uri); t.revision = expected; t.writing = true;
                t.file = File.createTempFile("studio-transfer-", ".write", getCacheDir());
                String token = UUID.randomUUID().toString(); transfers.put(token, t); reply(id, token); break;
            }
            case "writeChunk": {
                Transfer t = transfer(a.getString("token"), true); byte[] data = Base64.decode(a.getString("data"), Base64.DEFAULT);
                if (data.length > 96 * 1024 || t.file.length() + data.length > MAX_BYTES) throw new IOException("File exceeds the 256 MiB transfer limit.");
                try (FileOutputStream out = new FileOutputStream(t.file, true)) { out.write(data); } reply(id, true); break;
            }
            case "writeCommit": {
                String token = a.getString("token"); Transfer t = transfer(token, true);
                try { reply(id, commit(t)); } finally { transfers.remove(token); t.file.delete(); } break;
            }
            case "exportTarget": {
                String owner = a.getString("tree"), name = a.getString("name"); validName(name);
                DocumentFile root = tree(owner); DocumentFile dir = root.findFile("Diwan Exports");
                if (dir == null) dir = root.createDirectory("Diwan Exports");
                if (dir == null || !dir.isDirectory()) throw new IOException("Could not create Diwan Exports folder.");
                String candidate = name; int dot = name.lastIndexOf('.'); String stem = dot > 0 ? name.substring(0, dot) : name, ext = dot > 0 ? name.substring(dot) : "";
                for (int i = 2; dir.findFile(candidate) != null; i++) candidate = stem + " (" + i + ")" + ext;
                DocumentFile doc = dir.createFile(mime(candidate), candidate);
                if (doc == null) throw new IOException("Could not create export file.");
                JSONObject value = describe(doc, owner, "file").put("revision", hashDocument(doc)); reply(id, value); break;
            }
            case "printHtml": { String html = a.getString("html"); main.post(() -> printHtml(html)); reply(id, true); break; }
            case "notify": { String msg = a.getString("message"); main.post(() -> Toast.makeText(this, msg, Toast.LENGTH_LONG).show()); reply(id, true); break; }
            default: throw new BridgeException("NotSupportedError", "Unknown bridge operation.");
        }
    }

    private Transfer transfer(String token, boolean writing) throws Exception {
        Transfer t = transfers.get(token);
        if (t == null || t.writing != writing) throw new BridgeException("InvalidStateError", "File transfer has expired.");
        return t;
    }
    private void chooseFolder(String id) {
        if (folderRequest != null) { fail(id, new BridgeException("InvalidStateError", "A folder picker is already open.")); return; }
        folderRequest = id;
        Intent intent = new Intent(Intent.ACTION_OPEN_DOCUMENT_TREE).addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION |
            Intent.FLAG_GRANT_WRITE_URI_PERMISSION | Intent.FLAG_GRANT_PERSISTABLE_URI_PERMISSION | Intent.FLAG_GRANT_PREFIX_URI_PERMISSION);
        try { startActivityForResult(intent, TREE_PICKER); }
        catch (Exception e) { folderRequest = null; fail(id, e); }
    }
    private void pickFiles(String id, String owner, List<DocumentFile> choices, boolean multiple) {
        if (choices.isEmpty()) { fail(id, new BridgeException("NotFoundError", "No finance files in this folder. Put the file and its companion file directly in the selected folder.")); return; }
        String[] names = choices.stream().map(DocumentFile::getName).toArray(String[]::new);
        boolean[] checked = new boolean[names.length];
        AlertDialog dialog = new AlertDialog.Builder(this).setTitle("Open files — select up to 9")
            .setMultiChoiceItems(names, checked, (d, index, value) -> checked[index] = value)
            .setPositiveButton("Open", null)
            .setNegativeButton("Cancel", (d, w) -> fail(id, new BridgeException("AbortError", "File selection cancelled.")))
            .setOnCancelListener(d -> fail(id, new BridgeException("AbortError", "File selection cancelled."))).create();
        dialog.setOnShowListener(d -> dialog.getButton(AlertDialog.BUTTON_POSITIVE).setOnClickListener(v -> {
            List<DocumentFile> picked = new ArrayList<>(); for (int i = 0; i < checked.length; i++) if (checked[i]) picked.add(choices.get(i));
            if (picked.isEmpty() || picked.size() > 9) { Toast.makeText(this, "Select 1 to 9 files.", Toast.LENGTH_SHORT).show(); return; }
            dialog.dismiss(); io.execute(() -> {
                try { JSONArray result = new JSONArray(); for (DocumentFile doc : picked) result.put(describe(doc, owner, "file")); reply(id, result); }
                catch (Exception e) { fail(id, e); }
            });
        })); dialog.show();
    }
    @Override protected void onActivityResult(int request, int result, Intent data) {
        super.onActivityResult(request, result, data);
        if (request == INPUT_PICKER && inputCallback != null) {
            ArrayList<Uri> uris = new ArrayList<>();
            if (result == RESULT_OK && data != null) {
                if (data.getClipData() != null) for (int i = 0; i < data.getClipData().getItemCount(); i++) uris.add(data.getClipData().getItemAt(i).getUri());
                else if (data.getData() != null) uris.add(data.getData());
            }
            inputCallback.onReceiveValue(uris.isEmpty() ? null : uris.toArray(new Uri[0])); inputCallback = null;
        }
        if (request == TREE_PICKER && folderRequest != null) {
            String id = folderRequest; folderRequest = null;
            if (result != RESULT_OK || data == null || data.getData() == null) { fail(id, new BridgeException("AbortError", "Folder selection cancelled.")); return; }
            Uri uri = data.getData(); int flags = data.getFlags() & (Intent.FLAG_GRANT_READ_URI_PERMISSION | Intent.FLAG_GRANT_WRITE_URI_PERMISSION);
            io.execute(() -> {
                try {
                    int required = Intent.FLAG_GRANT_READ_URI_PERMISSION | Intent.FLAG_GRANT_WRITE_URI_PERMISSION;
                    if ((flags & required) != required) throw new IOException("Select a folder that grants both read and write access.");
                    getContentResolver().takePersistableUriPermission(uri,
                        Intent.FLAG_GRANT_READ_URI_PERMISSION | Intent.FLAG_GRANT_WRITE_URI_PERMISSION);
                    DocumentFile dir = DocumentFile.fromTreeUri(this, uri);
                    if (dir == null || !dir.canWrite()) throw new IOException("Select a folder with write access.");
                    String key = uri.toString(); folders.put(key, dir);
                    reply(id, describe(dir, key, "directory"));
                } catch (Exception e) { fail(id, e); }
            });
        }
    }
    private static String mime(String name) {
        String n = name.toLowerCase(Locale.ROOT);
        return n.endsWith(".json") ? "application/json" : n.endsWith(".csv") ? "text/csv" : n.endsWith(".html") ? "text/html" : "application/octet-stream";
    }
    private void copy(InputStream in, OutputStream out) throws IOException {
        if (in == null) throw new IOException("Provider could not open the file.");
        byte[] buf = new byte[64 * 1024]; int count; long total = 0;
        while ((count = in.read(buf)) != -1) { total += count; if (total > MAX_BYTES) throw new IOException("File exceeds the 256 MiB transfer limit."); out.write(buf, 0, count); }
    }
    private String hash(File file) throws Exception { try (InputStream in = new FileInputStream(file)) { return digest(in); } }
    private String hashDocument(DocumentFile doc) throws Exception { try (InputStream in = getContentResolver().openInputStream(doc.getUri())) { return digest(in); } }
    private String digest(InputStream in) throws Exception {
        if (in == null) throw new IOException("Could not read file for verification.");
        MessageDigest digest = MessageDigest.getInstance("SHA-256"); byte[] buf = new byte[64 * 1024]; int count;
        while ((count = in.read(buf)) != -1) digest.update(buf, 0, count);
        return Base64.encodeToString(digest.digest(), Base64.NO_WRAP);
    }
    private void writeDocument(DocumentFile doc, File from) throws Exception {
        try (InputStream in = new FileInputStream(from); OutputStream out = getContentResolver().openOutputStream(doc.getUri(), "rwt")) {
            if (out == null) throw new IOException("Provider could not open file for writing."); copy(in, out); out.flush();
        }
    }
    private JSONObject commit(Transfer t) throws Exception {
        if (!t.revision.equals(hashDocument(t.document))) throw new BridgeException("InvalidStateError", "File changed outside Diwan. Export a copy of your edits, then reopen the file or companion.");
        // The provider has no universal atomic replace API. Preserve and verify the original first.
        File original = File.createTempFile("studio-transfer-", ".previous", getCacheDir());
        try {
            try (InputStream in = getContentResolver().openInputStream(t.document.getUri()); OutputStream out = new FileOutputStream(original)) { copy(in, out); }
            if (!t.revision.equals(hash(original))) throw new IOException("File changed while preparing the save. Nothing was overwritten.");
            if (original.length() > 0) {
                DocumentFile dir = tree(t.tree).findFile(".studio-backups");
                if (dir == null) dir = tree(t.tree).createDirectory(".studio-backups");
                if (dir == null || !dir.isDirectory()) throw new IOException("Could not create recovery folder. Nothing was overwritten.");
                String name = t.document.getName() + ".previous"; DocumentFile backup = dir.findFile(name);
                if (backup == null) backup = dir.createFile("application/octet-stream", name);
                if (backup == null) throw new IOException("Could not create recovery copy. Nothing was overwritten.");
                writeDocument(backup, original);
                if (!t.revision.equals(hashDocument(backup))) throw new IOException("Recovery copy verification failed. Nothing was overwritten.");
            }
            if (!t.revision.equals(hashDocument(t.document))) throw new IOException("File changed before saving. Nothing was overwritten.");
            String revision = hash(t.file);
            try {
                writeDocument(t.document, t.file);
                if (!revision.equals(hashDocument(t.document))) throw new IOException("Saved bytes did not match the prepared file.");
            } catch (Exception e) {
                try { writeDocument(t.document, original); if (!t.revision.equals(hashDocument(t.document))) throw new IOException("Recovery verification failed."); }
                catch (Exception recovery) { throw new IOException("Save failed and recovery failed. Restore .studio-backups/" + t.document.getName() + ".previous. Your edits remain open in Diwan.", e); }
                throw new IOException("Save failed; the original file was restored. Your edits remain open in Diwan.", e);
            }
            return new JSONObject().put("revision", revision);
        } finally { original.delete(); }
    }
    private void printHtml(String html) {
        if (printView != null) printView.destroy();
        printView = new WebView(this); printView.getSettings().setJavaScriptEnabled(false);
        printView.setWebViewClient(new WebViewClient() {
            boolean started;
            @Override public void onPageFinished(WebView view, String url) {
                if (started) return; started = true;
                PrintManager printer = (PrintManager)getSystemService(PRINT_SERVICE);
                printer.print("Diwan report", view.createPrintDocumentAdapter("Diwan report"), new PrintAttributes.Builder().build());
            }
        });
        printView.loadDataWithBaseURL(ORIGIN + "/assets/", html, "text/html", "UTF-8", null);
    }
    @Override public void onBackPressed() {
        web.evaluateJavascript("window.MMEXAndroid ? window.MMEXAndroid.backState() : 'exit'", result -> {
            if ("\"handled\"".equals(result)) return;
            if ("\"busy\"".equals(result)) { Toast.makeText(this, "Wait for the file operation to finish.", Toast.LENGTH_SHORT).show(); return; }
            boolean dirty = "\"dirty\"".equals(result);
            new AlertDialog.Builder(this).setTitle(dirty ? "Unsaved changes" : "Close Diwan?")
                .setMessage(dirty ? "File changes are not saved. Return and press Save, or exit and discard them. Preferences may already have autosaved." : "Close the app?")
                .setNegativeButton("Stay", null).setPositiveButton(dirty ? "Discard and exit" : "Exit", (d, w) -> finish()).show();
        });
    }
    @Override protected void onPause() {
        web.evaluateJavascript("window.MMEXAndroid&&window.MMEXAndroid.flushOnPause()", null);
        super.onPause();
    }
    @Override protected void onDestroy() {
        if (inputCallback != null) inputCallback.onReceiveValue(null);
        io.execute(() -> { for (Transfer t : transfers.values()) t.file.delete(); transfers.clear(); });
        io.shutdown(); web.removeJavascriptInterface("StudioNative"); web.destroy();
        if (printView != null) printView.destroy(); super.onDestroy();
    }
}
