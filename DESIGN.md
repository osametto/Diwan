---
name: DIWAN Android
description: Everyday pocket ledger for Android WebView
colors:
  primary: "#173f46"
  on-primary: "#fff"
  primary-container: "#e2ebe8"
  bg: "#f5f2ea"
  surface: "#fff"
  raised: "#ebe9e1"
  text: "#252b2d"
  muted: "#586260"
  line: "#daddd8"
  income: "#20734b"
  income-bg: "#e4f1e9"
  expense: "#b83a3a"
  expense-bg: "#fbe9e6"
  transfer: "#8a630d"
  transfer-bg: "#f5edd8"
  dark-primary: "#c0d9d8"
  dark-on-primary: "#102b30"
  dark-primary-container: "#284b50"
  dark-bg: "#102b30"
  dark-surface: "#173f46"
  dark-raised: "#244a50"
  dark-text: "#f5f2ea"
  dark-muted: "#bbc9c7"
  dark-line: "#3a5960"
  dark-income: "#74d4a4"
  dark-income-bg: "#194b3b"
  dark-expense: "#ff9a9a"
  dark-expense-bg: "#593437"
  dark-transfer: "#e8c36d"
  dark-transfer-bg: "#4b4227"
typography:
  headline:
    fontFamily: 'Roboto, "Noto Sans Arabic", system-ui, sans-serif'
    fontSize: "1.25rem"
    fontWeight: 700
    lineHeight: 1.3
  body:
    fontFamily: 'Roboto, "Noto Sans Arabic", system-ui, sans-serif'
    fontSize: "1rem"
    fontWeight: 400
    lineHeight: 1.45
  ledger-label:
    fontFamily: 'Roboto, "Noto Sans Arabic", system-ui, sans-serif'
    fontSize: ".875rem"
    fontWeight: 650
    lineHeight: 1.3
  entry-amount:
    fontFamily: 'Roboto, "Noto Sans Arabic", system-ui, sans-serif'
    fontSize: "2.75rem"
    fontWeight: 650
    lineHeight: 1.2
rounded:
  field: "10px"
  control: "12px"
  surface: "16px"
  add: "18px"
  dialog: "20px"
  sheet: "24px 24px 0 0"
spacing:
  step-4: "4px"
  step-8: "8px"
  step-12: "12px"
  step-16: "16px"
  step-20: "20px"
  step-24: "24px"
  step-28: "28px"
  step-32: "32px"
components:
  button-primary:
    backgroundColor: "{colors.primary}"
    textColor: "{colors.on-primary}"
    rounded: "{rounded.control}"
    padding: "12px 20px"
  button-outline:
    textColor: "{colors.primary}"
    rounded: "{rounded.control}"
    padding: "12px 16px"
  field:
    backgroundColor: "{colors.surface}"
    textColor: "{colors.text}"
    rounded: "{rounded.field}"
    padding: "12px"
  summary:
    backgroundColor: "{colors.primary-container}"
    rounded: "{rounded.surface}"
    padding: "20px"
---

# Design System: DIWAN Android

## Overview

**Creative North Star: "Everyday pocket ledger"**

Android-inspired controls inside a Java/WebView application. Compact date-grouped records and clearly separated amounts support daily entry; flat account groups keep balances directly reachable. This replacement mobile world is independent of the desktop DIWAN presentation and Actual Budget repository styling.

**Key Characteristics:**

- Activity and quick entry lead; Accounts remains a main destination.
- Platform sans type, tabular money, explicit signs and currency codes.
- Flat lists, quiet tonal summaries, light/dark/system appearance.

Source of truth: app/src/main/assets/mobile-shell.css and mobile-shell.js. PRODUCT.md, DIRECTION.md and REFERENCE-STUDY.md record the approved mobile direction and supplied screenshot study.

## Colors

### Primary

Cobalt actions and pale blue selected containers anchor light mode; soft blue actions and deep blue containers fill the same roles in dark mode. Unprefixed frontmatter keys map to CSS --m-* properties; dark-* values replace those properties for dark or system-dark appearance.

### Secondary

Income green, expense coral and transfer blue pair foregrounds with tinted icon backgrounds. Keep signs and currency codes alongside color semantics.

### Neutral

Canvas, surface and raised roles distinguish the workspace, records and quiet controls. Text, muted and line roles maintain hierarchy. Frontmatter preserves actual CSS source values rather than approximating a new palette.

## Typography

Use the frontmatter's platform sans stack; no custom display face is bundled. Ledger labels use stronger weight, with compact subordinate metadata. Money uses tabular numerals, the tnum feature and negative letter spacing (-.01em). Record amounts use .9375rem; currency and secondary metadata can reach .625rem, a current density limitation rather than a general body-text recommendation.

Entry amounts lead the form. Detail amounts use 2.25rem, budget available uses 1.875rem and ordinary section headings use 1rem. These are working finance hierarchies.

## Layout

The fixed 100dvh flex shell contains a surface app bar, independently scrolling main area and five destinations: Activity, Overview, Accounts, Budget and More. Header and navigation positioning tokens are 76px; safe-area padding accommodates the bottom edge. Content reserves 88px under records and a single Add action floats above navigation.

List padding is commonly 16px; details and summaries use 20px. Transaction rows are at least 84px with icon, flexible description and end-aligned amount columns. Accounts use 80px rows. Navigation targets are at least 58px; chips, type tabs and icon actions keep 48px targets.

At 720px and wider, an 88px left rail replaces bottom navigation, content caps at 900px and the editor becomes a centered 640px dialog up to 960px tall. Below 360px, padding and metadata compress, account icons disappear and detail actions stack.

## Elevation & Depth

Flat rows and one-pixel dividers dominate; tonal containers mark balances and summaries. Only the Add action and bottom sheet carry authored shadows. Dialog backdrops dim the workspace. The sidecar records exact shadow and motion values.

The sheet's upward fade is enabled only when reduced motion is not requested. The scroll container currently uses smooth scrolling independently of that media query.

## Shapes

Fields have tighter rounded corners than controls and summaries. Full-width rows remain flat. Transaction badges are circular and selected navigation icons sit within tonal pills. The compact editor is edge-to-edge with square corners; expanded dialogs are rounded. Sheets round only their top corners.

## Components

Filled and outline actions are at least 52px tall. The Add action is 56px tall with an 18px radius. Focus-visible uses a 3px primary outline with a 3px offset; search has a 2px focus-within outline. No additional hover or active animation is authored.

Account and period chips open focused sheets. Underlined type tabs filter Activity. Navigation pairs labels with authored stroke SVGs and marks the active icon using a tonal pill.

Records open dedicated detail screens with edit and duplicate actions. Account balances open registers including incoming transfers. Overview Recent activity uses current-month real records up to today.

Entry is amount-first and full-screen on compact widths, with Expense/Income/Transfer segments, explicit currency and vertically stacked engine-backed fields, notes and splits. Saving an entry changes the open document; Save file explicitly writes to storage. Preferences retain the engine's queued autosave.

Budget shows one month of real envelope groups and allocation sheets. More exposes adapted existing engine forms in a mobile task container; these secondary tools are not fully rewritten components. Android opening supports only .diwan and .mmb.

The .impeccable/review captures are browser-only synthetic evidence. The reported 15 UI checks and Java compile/release lint do not establish physical-device behavior. Device navigation, IME insets, gestures, SAF providers and printing remain device-test obligations. Delivery is source only; no APK is claimed.

## Do's and Don'ts

### Do:

- Do retain at least 48 CSS-pixel touch controls and visible keyboard focus.
- Do retain explicit currency codes, signs and automatic direction for names.
- Do use the implemented semantic theme variables for new mobile surfaces.

### Don't:

- Don't transplant the desktop sidebar or Actual Budget repository styling.
- Don't rely on color alone to explain transaction direction.
- Don't represent browser synthetic captures as Android device evidence.

## Approved identity v2

Diwan Ledger supplied outlined marks, petrol #173F46, ivory #F5F2EA, copper #B9814B, charcoal #252B2D and semantic finance colors replace the blue theme. Native adaptive, monochrome and legacy launcher resources come directly from the approved v2 package. See brand/BRAND-GUIDE.md.
