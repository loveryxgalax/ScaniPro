# CaseSeal — App Review Kit

Everything needed to get CaseSeal through App Review on the first try: a pre-submission checklist, the exact App Review notes to paste, a screen-recording script, and ready replies for the guidelines that have caused rejections before (2.1, 4.3, 5.2.1, 3.1.1).

---

## 1. Pre-submission checklist

### Accounts and identifiers
- [ ] `npx eas-cli@latest login` as **hyperadrenax**, then `npx eas-cli@latest init` (writes `expo.extra.eas.projectId` into `app.json`).
- [ ] App Store Connect → Apps → **+ New App**: platform iOS, name **CaseSeal: Evidence PDF Scanner**, bundle ID **com.hyperadrenax.caseseal**, SKU `caseseal-ios`, primary language English (U.S.).
- [ ] Copy the numeric **Apple ID** of the app into `eas.json` → `submit.production.ios.ascAppId`.
- [ ] **Agreements, Tax, and Banking**: Paid Apps agreement is *Active* (in-app purchases will not load in review otherwise).
- [x] Support email set: riverlake.raptors@gmail.com (app, privacy and support pages).

### In-app purchase (Guideline 3.1.1 / 2.1)
- [ ] App Store Connect → CaseSeal → **In-App Purchases** → **+** → **Non-Consumable**.
  - Reference name: `CaseSeal Pro` · Product ID: `com.hyperadrenax.caseseal.pro` (must equal `expo.extra.proProductId`).
  - Price: USD 19.99 (or your choice) · Availability: all territories.
  - Localization (en-US): display name `CaseSeal Pro`, description `Unlimited cases, packets & signing`.
  - Review screenshot: `store/screenshots/` has the paywall in the preview, but upload a **real device screenshot of the Pro screen** (Settings › Upgrade to Pro).
  - Review notes: "Unlocks unlimited cases/exhibits, evidence packet export, and signatures. Purchase from Settings › Upgrade to Pro, or any locked feature."
- [ ] Status must be **Ready to Submit**, and the IAP must be **attached to the version** (Version page → In-App Purchases and Subscriptions → select it) before you click *Add for Review*.
- [ ] Test on TestFlight with a Sandbox account: buy, restore, and Ask to Buy (Sandbox → Settings › Developer › StoreKit Testing, or use a sandbox child account).

### Build
- [ ] `npm run check` (typecheck, lint, unit tests) passes.
- [ ] `npm run check:listing` passes (character limits, no third-party marks).
- [ ] `npm run guard:release` passes. It runs automatically on EAS before every **production** build and blocks the build if placeholders remain, the project ID is missing, the privacy manifest declares any collected data, a data-collecting SDK is in `package.json`, or the icon has alpha.
- [ ] `npm run build:prod` then `npm run submit:ios`.
- [ ] Install the TestFlight build on a **physical iPhone** and run the reviewer test plan below end to end (scanner and Face ID do not work in the Simulator).

### Store listing (copy lives in `store/LISTING.md`)
- [ ] Name, subtitle, promotional text, description, keywords, What's New pasted from `store/LISTING.md`.
- [ ] Screenshots: upload the six 1290×2796 PNGs from `store/screenshots/` to the **6.9" iPhone** slot (App Store Connect scales them down for smaller iPhones).
- [ ] Support URL `https://caseseal.pages.dev/support`, Marketing URL `https://caseseal.pages.dev/`, Privacy Policy URL `https://caseseal.pages.dev/privacy` — all live and loading before submission.
- [ ] Category: Business (primary), Productivity (secondary).
- [ ] Age rating questionnaire: answer **None/No** to everything → 4+.
- [ ] Copyright: `2026 <your legal name or company>`.

### App Privacy
- [ ] App Store Connect → App Privacy → **Get Started** → "Do you or your third-party partners collect data from this app?" → **No, we do not collect data from this app**. Publish. Label reads **Data Not Collected**.
- [ ] Privacy manifest is generated from `app.json → ios.privacyManifests` (tracking false, no collected data types, required-reason APIs declared).

### Export compliance
- [ ] `ios.config.usesNonExemptEncryption: false` is set, so App Store Connect will not ask. (CaseSeal only uses hashing and iOS's built-in file protection, which are exempt.)

### Final look
- [ ] No placeholder text in the app (search for "REPLACE" / "TODO" — the release guard does this).
- [ ] Paywall shows price, Restore Purchases, Privacy Policy and Terms of Use links.
- [ ] Demo screen recording attached in App Review notes (see section 3).

---

## 2. App Review notes (paste into "Notes" under App Review Information)

> **Sign-in required:** No. CaseSeal has no accounts, login or registration. Leave the demo-account fields empty.
>
> **What the app does:** CaseSeal is a private document scanner for evidence records (paralegals, small law firms, investigators, insurance adjusters, HR). Each scan becomes a numbered "exhibit" inside a "case". At the moment of capture every page is hashed with SHA-256 and an append-only, hash-chained custody log entry is created. Text is recognised on-device and the exhibit is saved as a searchable PDF. Users can export an "evidence packet" PDF (cover page, exhibit index, stamped exhibits, hash manifest) plus CSV/JSON manifests.
>
> **External services / data collection:** None. There is no backend, no analytics, no advertising, no crash reporting and no tracking. OCR uses Apple's on-device Vision framework. All files are stored in the app container with NSFileProtectionComplete. The only network traffic is StoreKit for the optional in-app purchase. App Privacy is "Data Not Collected".
>
> **Permissions:** Camera (only when the user scans a document or a QR code). Photo library (only when the user chooses photos to import; the system picker is used). Face ID (optional app lock; falls back to the device passcode; can be turned off in Settings › Security).
>
> **How to test every feature (physical iPhone required for the camera):**
> 1. Launch → unlock with Face ID or passcode.
> 2. Tap **Create a Case** → enter any title (e.g. "Review Test") → **Create Case**.
> 3. Tap **Scan Exhibit** → point at any printed page → the system document camera captures it → **Save**. The exhibit appears as "EX. 1". "Processing…" changes to "Searchable" within a few seconds.
> 4. Open the exhibit: **Pages** shows the scan; **Text** shows recognised text; **Integrity** shows SHA-256 hashes → tap **Verify Integrity Now** (green "Integrity verified"); **Log** shows the custody chain with timestamps, device, iOS and app version.
> 5. Tap the title to **rename** it; a "Renamed" entry appears in the Log.
> 6. Back on Cases, tap the **magnifier** and search a word from the scanned page.
> 7. **In-app purchase:** the free version allows 1 case and 5 exhibits. Tap **Sign** on an exhibit, or **Export Packet** on the case, or try creating a second case → the CaseSeal Pro screen appears. Buy with the sandbox account; Restore Purchases is on the same screen and in Settings. Product: `com.hyperadrenax.caseseal.pro` (non-consumable).
> 8. With Pro: **Sign** → draw a signature → **Use Signature** → tap the page → **Save** → **Create Version**. The exhibit now shows "Version 2 (derived)"; the original stays as Version 1, and the Log shows "Signed".
> 9. On the case, tap **Export Packet** → **Generate Packet** → tap any file to open the share sheet.
> 10. **Tools** (grid icon at the bottom left of the home screen): Text scan, Book scan, QR Code, import from Files/Photos, export to Text/Image/.docx/.pptx, Merge PDFs, Expense Report, Verify Case, Recently Deleted. All run on-device.
> 11. **Settings** shows the app lock, scanning quality, Restore Purchases, privacy statement and Delete All Data.
>
> A screen recording of this flow on an iPhone is attached / linked here: `<link>`.
>
> Contact: `<name>`, `<phone>`, `<email>`.

---

## 3. Screen-recording script (≈ 90 seconds, physical iPhone)

Record with Control Center › Screen Recording (microphone off). Use a real paper document, such as a printed receipt or letter with no personal data. Start with CaseSeal freshly installed from TestFlight with a sandbox account signed in.

| # | Time | Do this | Show on screen |
|---|---|---|---|
| 1 | 0:00 | Open CaseSeal. Face ID prompt appears; unlock. | Lock screen → Cases (empty state: "Start your first case"). |
| 2 | 0:06 | Tap **Create a Case**. Type `Review Test`, reference `RT-001`. Tap **Create Case**. | New Case form → case screen. |
| 3 | 0:15 | Tap **Scan Exhibit**. Hold over the paper until it captures; tap **Save**. | System document camera → "Sealing 1 page…" → exhibit screen. |
| 4 | 0:28 | Wait for "Searchable". Tap **Text**, then **Integrity**, then **Verify Integrity Now**. | Recognised text; SHA-256 hashes; green "Integrity verified". |
| 5 | 0:40 | Tap **Log (n)**; tap the first entry to expand. | Captured / OCR / PDF generated / Verified entries with ISO timestamps, device, iOS and app version, hashes. |
| 6 | 0:48 | Go back to Cases. Tap the magnifier; type a word from the page. | Highlighted search result → tap it → exhibit opens. |
| 7 | 0:56 | On the exhibit tap **Sign**. | CaseSeal Pro screen with price, Restore Purchases, Privacy/Terms. |
| 8 | 1:02 | Tap **Unlock Pro**; confirm with the sandbox account. | StoreKit sheet → "CaseSeal Pro is unlocked". |
| 9 | 1:10 | **Sign** → draw a signature → **Use Signature** → tap page → **Save** → **Create Version**. | "Version 2 (derived)" badge; Log shows "Signed". |
| 10 | 1:20 | Back to case → **Export Packet** → **Generate Packet** → tap **Evidence packet (PDF)**. | "Packet ready", file list, share sheet. Cancel. |
| 11 | 1:28 | Open **Settings**; scroll to show Restore Purchases and the privacy statement. Turn on Airplane Mode in Control Center and scan another page to show it works offline (optional). | Settings screen. |

Upload the video (unlisted link or file in App Store Connect › App Review Information › Attachment) and paste the link into the notes.

---

## 4. Ready-made replies

Use in Resolution Center. Edit the bracketed parts.

### Guideline 2.1 — Information Needed / App Completeness

> Hello, and thank you for reviewing CaseSeal.
>
> CaseSeal does not use accounts, login or any server; no demo account is required. All features run entirely on the device.
>
> - **Purpose:** an evidence-grade document scanner. Scans are saved as numbered exhibits in cases; each page is hashed with SHA-256 at capture and every later action is written to an append-only custody log.
> - **External services:** none. No backend, analytics, advertising or tracking SDKs. OCR uses Apple's on-device Vision framework. The only network use is StoreKit for the optional "CaseSeal Pro" non-consumable purchase (`com.hyperadrenax.caseseal.pro`), which is attached to this version.
> - **How to test:** step-by-step instructions are in the App Review notes, and a screen recording of the full flow on an iPhone [is attached / is at <link>]. A physical device is needed because the document camera and Face ID are not available in the Simulator.
>
> If anything is unclear or a step doesn't behave as described, please tell us which step and we'll respond the same day.

### Guideline 4.3 — Spam / similar apps

> Thank you for the feedback. CaseSeal is not a repackaged or template scanner; its purpose and feature set are specific to preserving documents as evidence:
>
> 1. **Integrity at capture:** every page image is hashed with SHA-256 the moment it is captured, and an exhibit-level capture digest seals page order.
> 2. **Hash-chained custody log:** every action (capture, OCR, PDF generation, rename, annotation, signature, verification, export, share) records an ISO 8601 timestamp, device model, iOS version, app version and the file's SHA-256, chained to the previous entry. The database rejects edits and deletions, and the app detects tampering on demand.
> 3. **Immutable originals with derived versions:** signatures and annotations create new linked versions with their own hashes; the original never changes.
> 4. **Evidence packets:** a single PDF with cover page, exhibit index, stamped exhibit headers/footers and a hash manifest, with exhibit files embedded for independent verification, plus CSV/JSON manifests.
> 5. **Strictly on-device:** no accounts, cloud or analytics.
>
> These workflows serve paralegals, investigators, adjusters and HR teams, and are not offered by general-purpose scanner apps. It is our only scanner app; we have not submitted similar apps under this or other accounts. We're happy to walk through any of these features.

### Guideline 5.2.1 — Intellectual Property (trademarks)

> Thank you. We have reviewed our metadata:
>
> - **Name:** "CaseSeal: Evidence PDF Scanner". "CaseSeal" is our own coined name. "Evidence", "PDF" (an open ISO 32000 standard) and "Scanner" describe what the app does.
> - **Subtitle:** "Tamper-evident scans with OCR". Generic terms only.
> - **Keywords:** `document, legal, exhibit, custody, proof, court, lawyer, paralegal, claim, insurance, adjuster, hr, receipt, sign`. Generic terms only, with no competitor or third-party brand names.
> - **Screenshots and icon:** our own artwork; no third-party logos or app names.
>
> [If a specific term was flagged:] We have removed "<term>" from the <field> in the attached update. Please let us know if any other term is a concern.

### Guideline 3.1.1 — In-App Purchase

> Thank you. CaseSeal's paid features are unlocked exclusively through Apple In-App Purchase:
>
> - **Product:** `com.hyperadrenax.caseseal.pro`, a **non-consumable**, attached to this version and submitted for review.
> - **What it unlocks:** unlimited cases and exhibits, evidence packet export, signatures/annotations, .docx/.pptx export, merging exhibits and expense reports. Free users keep full access to scanning, OCR, search, hashing, custody logs and verification for 1 case and 5 exhibits.
> - **Restore:** "Restore Purchases" is on the Pro screen and in Settings.
> - **Edge cases handled:** user cancel (no error shown), pending/Ask to Buy (clear "Waiting for approval" state; unlocks automatically when approved), price fails to load (purchase button disabled with a Retry action), already owned (prompts to restore), and refunds/revocations (Pro is removed after the next successful store check).
> - There are no external purchase links, codes, or alternative payment methods in the app or metadata.
>
> [If the IAP could not be found:] We've confirmed the product is "Ready to Submit", the Paid Apps agreement is active, and the IAP is attached to version [1.0.0]. Please try again. We're happy to provide a new build if needed.
