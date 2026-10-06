# CLAUDE.md

Guidance for AI agents working in this repo. Also read `AGENTS.md` (Expo's generic rules: use `npx expo install`, never hand-edit `ios/`/`android/`, fetch versioned docs for SDK 57).

## Product invariants (do not break)

1. **Nothing leaves the device** except files the user explicitly shares and StoreKit purchase traffic. Do not add analytics, crash reporting, remote config, OTA updates, RevenueCat, Firebase, or any SDK that phones home. `scripts/release-guard.mjs` has a deny-list; extend it rather than weaken it.
2. **App Privacy label is "Data Not Collected"** and `app.json → ios.privacyManifests.NSPrivacyCollectedDataTypes` stays empty.
3. **Originals are immutable.** Never write to `pages.original_path` files or `versions` files after creation (`writeBytes` refuses to overwrite). Changes produce a new `versions` row (kind `derived`) with `parent_version_id`.
4. **Custody log is append-only and hash-chained.** Only add entries through `appendCustody()` inside `db.withExclusiveTransactionAsync`. Never UPDATE/DELETE `custody_log`; the only exception is full case/data purge, which toggles `purge_guard`. Any user-visible action on an exhibit must append an entry with the SHA-256 of the file after the action.
5. **Exhibit numbers are never reused.** Withdrawal is a soft delete plus a `deleted` custody entry.
6. **Hash what's on disk.** Hash bytes read back from storage, and re-verify before deriving or exporting.
7. SQL migrations in `src/lib/db/schema.ts` are append-only; never edit a shipped migration.

## Layout

- `src/lib/core/*` is pure TypeScript with no React Native imports, unit-tested in `src/lib/core/__tests__` (Jest, node environment). Put new logic here when possible.
- `src/lib/platform/*` wraps native modules; `src/lib/services/*` orchestrates workflows; screens in `src/app/*` stay thin.
- iOS OCR is the local Expo module `modules/vision-ocr` (Swift, Apple Vision). ML Kit is Android-only (`react-native.config.js`).
- Purchases: `src/lib/state/pro.ts` (expo-iap / StoreKit 2). Product ID comes from `app.json → extra.proProductId`.
- Free limits: `src/lib/core/limits.ts`. Gate UI through `passGate()` (opens the paywall).
- Theme tokens: `src/theme/index.ts` (light + dark). The web preview in `preview/index.html` mirrors them.

## Commands

```bash
npm run check          # typecheck + lint + tests (run before every commit)
npm run check:listing  # App Store copy limits + trademark scan
npm run guard:release  # production gate (runs automatically on EAS production builds)
npx expo export --platform ios --output-dir /tmp/x   # quick Metro bundle smoke test
npx expo prebuild --platform ios --no-install --clean # inspect generated native config; ios/ is gitignored
```

## Conventions

- TypeScript strict with `noUncheckedIndexedAccess`; avoid `any`.
- Imports use the `@/` alias for `src/`.
- Timestamps are ISO 8601 UTC (`new Date().toISOString()`); show local time in UI via `src/lib/format.ts`.
- PDF text drawn with standard fonts must go through `toWinAnsi()`.
- Copy: plain, specific, no legal-advice claims ("supports authenticity", never "court-admissible").
- App Store metadata lives in `store/listing.json`; regenerate `store/LISTING.md` with `npm run check:listing`. No third-party trademarks in name, subtitle, or keywords.
