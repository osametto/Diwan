# DIWAN Android · Mobile 2

Source-only Android redesign based on the DIWAN **1.2.12 financial engine**. The Android UI is a separate presentation, inspired by the supplied Money Manager Ex and Bluecoins screenshots. This source package contains no APK and no signing credentials.

## Mobile experience

- **Activity leads.** Date-grouped transactions, type filters, live search, account and period sheets, explicit account currencies, and one Add action.
- **Accounts remain primary.** Grouped balances, an explicitly converted base-currency total, and one-tap account registers including incoming transfers. Current balances exclude future transactions.
- **Quick entry.** A full-screen amount-first form with Expense / Income / Transfer controls. The existing engine validates and records changes; file saving remains explicit. Cancelling discard keeps an edited draft open.
- **Transaction details.** Dedicated detail screens, edit/duplicate actions, tags, splits and separate source/destination amounts on cross-currency transfers.
- **Budget.** One month at a time, envelope balances, spending progress and allocation sheets using the existing budget engine.
- **Overview.** Existing monthly income/expense totals, account balances and recent activity through today.
- **More.** Scheduled transactions, reports, categories, payees, tags, currencies, SMS staging, audit and file preferences remain functional engine tools. These secondary forms use the original engine in a mobile task container; they are not a rewritten native finance engine.
- Light, dark and system appearance; a navigation rail replaces bottom navigation on expanded width. Arabic content uses automatic text direction.

Android opens **.diwan and .mmb only**. Open one native DIWAN file, or up to nine MMB period files together. Other finance formats are rejected by the Android opening flow. The original 1.2.12 HTML is retained as the reproducible engine input; its dormant converters are not exposed by this Android interface.

## Build on GitHub from another computer

1. Extract this ZIP and upload the **contents** of `DIWAN-Android-Mobile-1.2.12` into a GitHub repository. Include `.github` and `gradle`. `build.gradle` and `package.json` must be at the repository root.
2. Keep the separate private signing kit backed up. Never upload the kit, `.jks`, `signing.env`, or `GitHub-Secrets.txt` to a repository.
3. In repository **Settings > Secrets and variables > Actions**, create `STUDIO_KEYSTORE_BASE64`, `STUDIO_STORE_PASSWORD`, and `STUDIO_KEY_PASSWORD` from the existing signing kit's `GitHub-Secrets.txt`.
4. In **Actions > Build signed Android APK**, choose **Run workflow**. The workflow also runs on pushes to `main`.
5. Download the **DIWAN-Android-APK** artifact from the successful run and extract `app-release.apk`.

The workflow regenerates the embedded assets, runs the Node and Chromium regression checks, compiles, signs and runs Android release lint. It restores the key only in the runner's temporary directory and removes it after the job. This task has not uploaded a repository or executed GitHub Actions.

Package ID stays `net.osamapro.mmexstudio`; version name is `1.2.12-mobile.2`. Local version-code base is **120200**; GitHub adds the workflow run number. Keep version codes increasing in later releases. Using the original signing key permits updating the prior DIWAN/MMEX Studio app without uninstalling it. Minimum Android API 26 (Android 8), target/compile API 35. Keep Android System WebView updated.

## Local development

Requires JDK 17, Android SDK API 35/build tools 35.0.0, Gradle 8.11.1, Node 22 and Python 3. The Gradle wrapper is included.

```
python tools/wrap_studio.py Diwan-1.2.12.html
npm ci
npx playwright install chromium
```

Use `CHROMIUM_CHANNEL=chromium` for the bundled browser. Local browser scripts default to installed Microsoft Edge. Run `npm test`; `DIWAN_CAPTURE=0` disables UI screenshots. `PLAYWRIGHT_MODULE` can point at another installed Playwright module. All fixtures are synthetic and portable; no personal finance files or competitor screenshots are required.

Set `JAVA_HOME` and `ANDROID_HOME`. `gradlew.bat compileReleaseJavaWithJavac lintRelease` checks source without producing an APK. For a signed APK, set `STUDIO_KEYSTORE` to the private JKS path plus `STUDIO_STORE_PASSWORD`, `STUDIO_KEY_PASSWORD`, and optionally `STUDIO_KEY_ALIAS` (default `studio`), then run `gradlew.bat assembleRelease lintRelease`. Output: `app/build/outputs/apk/release/app-release.apk`.

On Windows, a long or unusual TEMP path can cause Java's local socket setup to fail. Use a short writable TEMP/TMP directory or `jdk.net.unixdomain.tmpdir` for the build process. These are local environment settings; no machine-specific SDK paths or secrets are committed.

## Source map

- `Diwan-1.2.12.html`: exact unchanged 1.2.12 engine input.
- `tools/wrap_studio.py`: validates expected hooks, inserts the adapter and mobile-core API, generates the bundled index and source provenance.
- `tools/mobile-core.js`: presentation adapters inside the original engine closure. Reuses its transaction queries, balances, budget rules and validation.
- `app/src/main/assets/mobile-shell.js` / `.css`: Android-only presentation and interaction.
- `app/src/main/assets/android-bridge.js`: native file-handle bridge, buffered writes/exports and Back integration.
- `app/src/main/java/net/osamapro/mmexstudio/MainActivity.java`: native selected-folder access, verified writes/backups and Android printing.
- `PRODUCT.md`, `DESIGN.md`, `DIRECTION.md`, `REFERENCE-STUDY.md`: product constraints, implemented design system and reference decisions.

The HTML preparation must be rerun after changing `mobile-core.js`; CSS and shell JS are separate bundled assets. `SOURCE.json` records the original input hash and adapter hook locations.

## Saving, recovery and verification

Document edits stay in memory until Save file. Preferences use the original queued autosave. Existing `Studio Exports` and `.studio-backups/<filename>.previous` paths are preserved for compatibility. Native writes detect external changes, preserve previous bytes and verify the write; Android providers cannot universally guarantee atomic replacement during power loss. The file bridge retains its 256 MiB transfer limit and memory constraints.

Verification reports cover source compilation, release lint, 18 Node bridge checks, 16 browser bridge/opening checks and 15 mobile workflow checks. `previews/` contains browser-rendered UI using labeled synthetic test data, not emulator/device captures. Native storage providers, IME, Android system Back/predictive gestures, printing, system font scaling and hardware performance still require testing on an Android device. The independent reviewer resolved its two findings (future Recent activity and undersized file/search hit areas) and cleared the source handoff at this browser-evidence scope.
