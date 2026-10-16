# Diwan Ledger | ديوان — Brand identity v2.0

## Purpose / الفكرة
ديوان يحفظ استمرارية تاريخك المالي: استعادة السجلات من ملفات البرامج السابقة ثم مواصلة تحديثها. رمز الصفحات المتتابعة مستوحى من حرف «د». العربية هي الاسم الأساسي واللاتينية اسم ثانوي.

**تاريخك المالي، وسجلّك المستمر.**

English editorial translation: Your financial history. Your continuing record.

## Master assets
- `logos/`: transparent SVG paths and 2× PNG exports. Arabic and Latin lettering are outlined, with no font dependency.
- Horizontal lockup: website navigation, document headers, compact spaces.
- Stacked lockup: welcome screens and large brand placements.
- Standalone symbol: favicon, app icon, small avatar. Do not use the complete wordmark inside a tiny icon.
- Petrol/charcoal versions on light backgrounds; ivory version on petrol/dark backgrounds; black version for one-color printing.
- The vectors are carefully traced and flattened from the approved concept. They are editable paths, not embedded bitmap images. Minor contour refinements are part of production cleanup.

## Clear space and minimum size
Keep empty space of at least one quarter of the symbol width around standalone marks, and at least the height of the Latin letter D around lockups. Never stretch, rotate, recolor arbitrarily, add shadows, or separate the page layers.
Suggested minimum digital widths: symbol 24 px; horizontal logo 180 px; stacked logo 140 px. Use the symbol only below these lockup sizes. At 16 px favicon scale, fine internal details will soften.

## Palette
| Role | Hex |
|---|---|
| Primary petrol | #173F46 |
| Warm ivory | #F5F2EA |
| Copper accent | #B9814B |
| Charcoal text | #252B2D |
| Income | #20734B |
| Expense | #B83A3A |
| Transfer | #8A630D |
| Focus indicator | #0077B6 |

Use copper sparingly for decoration and emphasis. Do not use copper as small body text on ivory; use petrol or charcoal. Never communicate income/expense/status through color alone: pair color with a sign, label, or icon. Dark theme semantic colors are included in CSS.

## Typography / الخطوط
The Arabic lettering is an outlined custom graphic, not an installable font. The Latin lockup uses outlined DejaVu Sans; the text paths do not require font installation. DejaVu attribution and license are included in FONT-LICENSE.txt. For interface text, recommended future typography: Noto Sans Arabic for Arabic, Inter for Latin. Font files are not bundled; the provided offline reference uses Tahoma / Segoe UI / Arial system fallbacks, so no network or font license dependency is introduced. If you add fonts, obtain official files and include their license notices.
Suggested scale: body 16 px; supporting text 14 px; section title 24 px; page title 32 px. Line height 1.6–1.8 for Arabic. Use tabular numbers for financial values. Keep monetary amounts, dates, and codes in separate LTR spans inside RTL layouts.

## Website assets
`web/index.html` is an offline responsive identity reference with working theme switch and download links. It is not a functional finance application or a deployed website.
Copy `web/` assets to your website, adapt paths in `integration-head.html`, and replace the placeholder OG image URL with an absolute public URL. The sample manifest start_url is relative and should be changed to your actual app entry point. A manifest and icons alone do not implement offline storage; no service worker is included.
Open Graph artwork source is 1200×630 SVG; its PNG export is 2400×1260. Wide cover source is 1920×640; PNG is 3840×1280. Rounded profile source is 1080×1080; PNG is 2160×2160.

## App icons
- `app/`: editable square, rounded, and maskable artwork. General SVGs have 2× PNG exports.
- `web/icons/`: exact-size PNGs; 192/512 maskable variants keep the mark inside the central safe region.
- Android: merge `android/res/` into your app resources. Includes density-specific legacy/round PNGs, API 26 adaptive resources, API 33 monochrome themed icons, and named colors. Set application attributes android:icon="@mipmap/ic_launcher" and android:roundIcon="@mipmap/ic_launcher_round". Existing resources with the same names must be reviewed before replacement.
- iOS: merge `ios/Assets.xcassets/AppIcon.appiconset` into your asset catalog. Icons have opaque square backgrounds; iOS applies its own corner mask. This catalog includes iPhone/iPad sizes and the 1024 px App Store icon. Validate with the target Xcode version before release.
- Native platform exports are supplied as integration assets; no Android or iOS build is included or tested.

## Accessibility and interaction
Use minimum 44×44 CSS px interactive targets. Keep visible keyboard focus. Support RTL structurally, not by reversing all icons: playback, numbers and brand marks preserve orientation. Financial statuses require text or symbols in addition to color.

## Package inventory
See `ASSET-INVENTORY.csv` for every asset and pixel dimensions. All logo PNGs are transparent. App icons and sharing artwork are opaque. SVG source sizes and PNG export sizes are deliberately separate.

## Release notes
This package is visual identity and integration artwork. It does not certify trademark availability or implement file readers/importers. Claims about support for a file format should be added only after its reader has been validated in the application.

## Naming and address — v2
Primary English name: **Diwan Ledger**. Primary Arabic name: **ديوان**. Canonical website address: **diwanledger.com**. Arabic tagline stays **تاريخك المالي، وسجلّك المستمر.**
Use the address-bearing lockup for marketing, covers, and externally shared documents. Use the plain horizontal/stacked lockup inside the app. The symbol and palette remain continuous with v1. No website has been published, and ownership or registration of the address has not been checked; the address is used as supplied by the user.

The HTML preview is a brand reference, not the finance app. Manifest paths remain relative for portability. Open Graph metadata now uses https://diwanledger.com/assets/diwanledger/; deploy the referenced assets at that location or adjust the URLs.
