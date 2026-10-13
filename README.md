# Diwan | ديوان — Android, 0.1.0-android.1

**Changes in 0.1.0-android.1 (2026-10-13):**
- Wraps `Diwan-0.1.0.html` (previous source: `MMEX-Offline-Studio-v2.29.html`). All 7 Android hooks and 4 phone-layout hooks applied unchanged.
- Diwan visual identity: app name **Diwan**, brand launcher icons (adaptive, themed monochrome, round, mdpi–xxxhdpi), petrol status/navigation bars, Diwan palette in the phone layout (transfers neutral grey).
- No MMB/MMEX/Studio wording on screen: phone app bar "Diwan", "Open files — select up to 9", "Diwan Exports" folder for copies and exports (was "Studio Exports"), "Diwan report" print title, exit dialog reworded.
- The folder picker lists `.mmb`, `.db` and `.sqlite` files.
- Package ID unchanged (`net.osamapro.mmexstudio`) so the APK updates the installed app in place with the same signing key. Version code base raised to 23000 (> 22902 + earlier runs).
- Checked: Java/XML/JS syntax; `check_bridge_node.cjs` 17/17, `check_bridge.cjs` 13/13 and `check_phone_layout.cjs` 16/16 in Chromium; live open of a disposable test file at 390 px, 0 JS errors, no MMB/MMEX/Studio text on screen. Not built here (no Android SDK in this environment); build with the GitHub workflow below.

---

# MMEX Studio Android — v2.29, mobile layout revision 2

An offline Android wrapper for the supplied MMEX-Offline-Studio-v2.29.html. The web UI, embedded database engine, SQL, calculations, MMB format, and companion JSON schema are retained. A small Java activity and JavaScript adapter replace browser file access with Android's selected-folder access.

## Install and use

1. Install the supplied signed APK on Android 8.0 or later. Android may ask you to allow installation from the browser or file manager used to open the APK.
2. Keep Android System WebView updated. This Studio uses `DecompressionStream` to start its embedded JavaScript.
3. Put your `.mmb` and matching `.studio.json` directly in the same folder, for example `Documents/Finance`. If the JSON does not exist, Studio creates it using the existing companion naming and schema.
4. Open Studio and select that folder, then tap Android's **Use this folder** / **Allow** action.
5. Select one MMB, or up to nine MMB period files together. All selected MMBs must be directly inside the working folder. Choose another working folder when switching to another folder of period files.
6. MMB edits remain in memory until you tap **Save**. Budget, display settings, report presets, SMS staging, and other companion changes use the existing JSON autosave queue.

The selected folder is remembered across launches using Android's persistent URI grant. The app does not automatically reopen an MMB at launch. If permission is revoked, the folder is moved, or a provider becomes unavailable, select the folder again.

Android restricts selection of some locations, including storage roots, the Downloads root, and Android/data on newer releases. Select a dedicated subfolder in Documents instead. A local folder is the most predictable choice; cloud folders depend on the document provider, its connectivity, and whether it supports read/write tree access. Android may not list a cloud service that does not support folder selection.

## Save and export behavior

- **Save** writes the originally selected MMB and any changed, loaded archives. No automatic MMB saving is added.
- **Save copy**, CSV/HTML report exports, SMS exports, and other existing Blob downloads go into `Studio Exports` inside the selected working folder. Existing exports get a different name.
- Companion JSON loads and saves beside the main MMB using its existing filename. The schema and identity validation are unchanged.
- Before overwriting a nonempty file, the bridge stores and verifies its previous contents in `.studio-backups/<original-name>.previous`. This is one previous version per file, not a historical version archive. Some file managers hide this folder.
- If a document has changed since Studio read it, the bridge refuses to overwrite it. Export your MMB edits as a copy and reopen the original. For companion conflicts, the existing browser backup/recovery controls remain available.
- Writes are staged in private temporary files, the recovery copy is verified, the target is written, and the saved bytes are verified. On a write/verification failure, the bridge attempts to restore the original. Android document providers do not offer a universal atomic replacement operation: force-stopping the app, storage failure, or provider failure during a write can still require manual restoration of the recovery copy.
- Editing is blocked while an MMB save is in progress, preventing changes from being made after the save snapshot has been taken.
- Transfers are limited to 256 MiB per file. Usable database size also depends on the device's available WebView memory.

**Print report** uses Android's print dialog, including Save as PDF when available. Desktop **New window** editing is hidden in the APK; linked desktop editing windows are not implemented.

The Android Back button closes an open dialog first. At the main screen it checks for ongoing file operations and unsaved changes before offering to exit. Android may still kill a background app: MMB edits that have not been saved can be lost. Companion autosaves and the existing local backup remain separate from MMB saving.

## Updates and signing

The included GitHub workflow builds a test APK with an automatically generated Android debug signing key. No repository secrets or private signing kit are required. The key is cached for later builds; if the cache is removed or expires, a new key is generated and an existing installation may need to be removed before installing the new APK. Export your data before uninstalling.

Download Diwan-Android-Test-APK from the successful run and extract app-debug.apk. This is a testing build, not a production signing setup. The package ID is unchanged.

## Build with GitHub Actions

1. Upload the contents of this folder to your repository root, including .github and tools.
2. Replace .github/workflows/build-apk.yml with the included workflow.
3. Commit, or open Actions → Build Diwan test APK → Run workflow.
4. Download Diwan-Android-Test-APK and extract app-debug.apk.

No signing secrets are needed. Java 17, SDK 35 and Gradle 8.11.1 are installed by the workflow. Local builds can use `gradle :app:assembleDebug` with the same tools installed.

## Build locally

Use JDK 17 and Android SDK platform/build tools 35. Set `ANDROID_HOME` appropriately, or let Android Studio create `local.properties`. Set the signing environment variables from your private signing kit, changing `STUDIO_KEYSTORE` to its absolute path on your machine.

```sh
./gradlew assembleRelease lintRelease
```

Output: `app/build/outputs/apk/release/app-release.apk`.

On Windows, use `gradlew.bat`. Android Studio can open this folder directly. For a development-only build, run `assembleDebug`; a debug build uses a different key and cannot update the supplied release APK.

## Update the HTML later

```sh
python3 tools/wrap_studio.py /path/to/MMEX-Offline-Studio-v2.29.html
python3 tools/apply_phone_layout.py
```

The script recognizes the compressed Studio payload, checks that each expected hook occurs exactly once, and produces `app/src/main/assets/index.html`. If the next Studio changes a hook, it fails rather than silently producing an incomplete wrapper. Update those hooks deliberately for the new source. `SOURCE.json` records the original source hash and the exact adapter hook locations.

The independent `android-bridge.js` stays in the assets directory. Increment `versionName` and `versionCode`, rebuild, and sign with the same key.

## Mobile layout, revision 2

The phone UI uses Bluecoins' public mobile screenshots as a layout reference: a compact app bar, scrollable top tabs, blue controls, pale summary cards, date-grouped transaction rows, colored type circles, and a floating Add button. Studio keeps its own finance model and features; this does not add Bluecoins-only features such as its calendar, bank connections, or chart modes.

- Transaction rows prioritize payee, category, amount, account, and short notes. Tap to open full details; the selection checkbox remains available.
- Search and filters open as a disclosure rather than taking most of the screen.
- Transaction details occupy the phone screen. Android Back dismisses them.
- The editor is full screen, with Expense/Income/Transfer buttons and a large amount field.
- Accounts use grouped balance rows. Categories, payees, tags, reminders, and currencies use stacked records.
- Budget month tabs display one month's existing summary and columns at a time. Month selection is presentation only and does not change the stored month-count preference or budget values.
- Phone layout activates at 760 CSS pixels and below. Desktop rendering remains separate.
- MMB Save, companion JSON autosave, file formats, calculations, and SMS export schema retain their previous behavior.

References: [Bluecoins dashboard](https://www.bluecoinsapp.com/guide/dashboard/) and [Bluecoins transaction guide](https://www.bluecoinsapp.com/guide/transactions/). The reference screenshots and logos are not bundled in the APK.

`PHONE-LAYOUT-TEST-RESULTS.json` records headless Chromium checks with sample data: screen widths 320–740 px, Arabic and long names, grouping, filters, month switching, transaction types, and the full-screen editor. The previews contain sample data. These checks do not exercise a live MMB, Android file providers, or a physical phone.

## Verification

`BRIDGE-TEST-RESULTS.json` records the adapter contract checks. Run them with:

```sh
node tools/check_bridge_node.cjs
```

These use a mock native provider to check folder restoration, UTF-8 and binary data, delayed commit, revision errors, exports, save locking, and queue flushing. They do not exercise Android's real document providers or UI. An optional Playwright script, `tools/check_bridge.cjs`, checks startup with a mobile viewport and the same mock provider in Chromium when Playwright is installed.

Before using the APK for live edits, validate on your phone: open your folder, load the expected companion, save a deliberate MMB change, reopen both files, export a report, print to PDF, and restart the app to check the folder grant. A successful build and mock tests do not replace these physical-device checks.

## References

- [Android: load bundled web content](https://developer.android.com/develop/ui/views/layout/webapps/load-local-content)
- [Android: selected-folder access and persisted URI permissions](https://developer.android.com/training/data-storage/shared/documents-files)
- [Android: file chooser integration](https://developer.android.com/reference/android/webkit/WebChromeClient#onShowFileChooser(android.webkit.WebView,android.webkit.ValueCallback%3Candroid.net.Uri[]%3E,android.webkit.WebChromeClient.FileChooserParams))
- [Android: print HTML documents](https://developer.android.com/training/printing/html-docs)
