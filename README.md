# ScaniPro: PDF Scanner & OCR

A privacy-first, evidence-grade document scanner for iPhone. Every scan becomes a numbered exhibit with SHA-256 fingerprints, a timestamp and an append-only, hash-chained custody log. Nothing leaves the phone.

**Positioning:** *Your documents never leave your phone.*
**Audience:** paralegals, small law firms, investigators, insurance adjusters, HR teams, and anyone assembling records for a dispute.

## Features

| | |
|---|---|
| Cases & exhibits | Cases (title, reference number, matter date, notes); exhibits auto-numbered per case, numbers never reused |
| Capture | System document camera (VisionKit on iOS). Each page is written, re-read and SHA-256 hashed; a capture digest seals page order |
| Custody log | Append-only (SQLite triggers reject UPDATE/DELETE), hash-chained entries with ISO 8601 timestamp, action, device model, OS version, app version/build and SHA-256 of the file after the action |
| OCR | On-device. iOS: Apple Vision via local Expo module `modules/vision-ocr`. Android: ML Kit |
| Searchable PDF | One PDF per exhibit with page images and an invisible (render mode 3) text layer, built with pdf-lib, deterministic output |
| Search | SQLite FTS5 across titles and OCR text with highlighted snippets |
| Integrity | Verify re-hashes every original page and version file and re-walks the custody chain; the result is logged |
| Derived versions | Signatures, ink and text notes create a new PDF version with its own hash and a provenance footer, linked to its parent. Originals are immutable |
| Evidence packet | Cover page, exhibit index, stamped exhibits (header + page-numbered footer), hash manifest page, optional embedded exhibit files; manifest as CSV and JSON; ZIP bundle with README |
| App lock | Face ID/Touch ID/passcode, re-lock interval, content hidden in app switcher |
| Pro (one-time IAP) | Free: 1 case, 5 exhibits. Pro: unlimited, packet export, signatures. StoreKit 2 via `expo-iap` with pending/Ask to Buy, restore, and price-load failure handling |

## Privacy architecture

- No backend, accounts, analytics, crash reporting or ads. `scripts/release-guard.mjs` fails production builds if a data-collecting SDK appears in `package.json`.
- **OCR on iOS uses Apple Vision, not ML Kit.** Google ML Kit's iOS SDK sends usage telemetry (device info, app info, performance metrics) to Google by default, which would force a non-empty privacy label. ML Kit is excluded from iOS autolinking in `react-native.config.js` and used on Android only. Revisit before shipping on Android (Data safety form).
- **Purchases use StoreKit directly, not RevenueCat.** RevenueCat requires declaring "Purchases" in the App Store privacy label; using StoreKit directly keeps the label at **Data Not Collected**.
- Files live in `Documents/ScaniPro/` with `NSFileProtectionComplete` (entitlement `com.apple.developer.default-data-protection`).
- Privacy manifest is declared in `app.json → ios.privacyManifests` (no tracking, no collected data, required-reason APIs).

## Tech stack

Expo SDK 57 · Expo Router (typed routes) · TypeScript strict · expo-sqlite (FTS5) · expo-file-system · expo-crypto · expo-secure-store · expo-local-authentication · expo-sharing · expo-iap · react-native-document-scanner-plugin · pdf-lib · react-native-svg. Development builds only (native modules don't run in Expo Go).

## Project layout

```
src/app/                 Expo Router screens (cases, case/[id], exhibit/[id], exhibit/annotate, export/[caseId], search, settings, paywall, integrity)
src/components/          UI primitives, LockGate, drawing surface, annotation overlay
src/lib/core/            Pure, unit-tested logic: custody chain, searchable PDF, annotations, packet PDF, manifests, ZIP, limits, FTS query
src/lib/db/              SQLite schema/migrations (append-only triggers), queries, custody writer
src/lib/platform/        Device adapters: files, hashing, device info, OCR, scanner
src/lib/services/        Workflows: capture & processing, exhibits (rename/verify/derive/share/withdraw), cases, packet export
src/lib/state/           App lock and Pro purchase stores
modules/vision-ocr/      Local Expo module (Swift) wrapping VNRecognizeTextRequest
scripts/                 release-guard, listing checker, store-asset renderer
store/                   Listing copy (listing.json → LISTING.md), icon/splash SVG, App Store screenshots
site/                    Static privacy/support site for Cloudflare Pages
preview/                 Single-file interactive UI preview (also renders screenshots)
```

## Getting started

```bash
npm install
npx eas-cli@latest login            # account: hyperadrenax
npx eas-cli@latest init             # writes the EAS projectId into app.json
npm run build:dev                   # EAS development build for a physical iPhone
npm start                           # Metro for the dev client
```

The document camera and Face ID need a physical device. `npm run ios` builds locally if you have Xcode.

## Checks

```bash
npm run check          # tsc --noEmit, expo lint, jest
npm run check:listing  # App Store field limits + trademark scan, regenerates store/LISTING.md
npm run guard:release  # what EAS runs before every production build
```

`pdftotext` (poppler) makes the PDF tests also assert the OCR text layer is extractable; they still pass without it.

## Release

1. Fill the placeholders: support email (`app.json` and `site/*.html`), `eas.json → submit.production.ios.ascAppId`, and the EAS project ID. The release guard lists anything still missing.
2. Create the non-consumable IAP `com.hyperadrenax.scanipro.pro` in App Store Connect.
3. Deploy `site/` to Cloudflare Pages (project name `scanipro` → `https://scanipro.pages.dev`). Framework preset: None, build command: empty, output directory: `site`. If you use another domain, update `app.json → extra.supportUrl/privacyUrl` and `store/listing.json`.
4. `npm run build:prod && npm run submit:ios`.
5. Follow **[APP-REVIEW.md](APP-REVIEW.md)** for listing, privacy label, review notes and the screen recording.

Regenerate store art after UI changes: `node scripts/render-store-assets.mjs` (needs Playwright + Chromium).

## Free vs Pro

| | Free | Pro |
|---|---|---|
| Cases | 1 | Unlimited |
| Exhibits | 5 | Unlimited |
| Scan, OCR, search, hashes, custody log, verify, share PDF | ✓ | ✓ |
| Evidence packet export (PDF + CSV + JSON + ZIP) | | ✓ |
| Signatures & annotations | | ✓ |

## Out of scope

Cloud sync, Word/PowerPoint export, fax, PDF passwords.
