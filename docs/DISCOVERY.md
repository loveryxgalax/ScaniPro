# CaseSeal discovery playbook (App Store search + Google)

What is already done in the repo, and what to do after launch to rank faster.

## App Store search (ASO)

Apple indexes the **name**, **subtitle** and **keyword field** (plus the in-app purchase display name). Each word counts once, so the three fields never repeat a word.

| Field | Value | Chars |
|---|---|---|
| Name | CaseSeal: Evidence PDF Scanner | 30/30 |
| Subtitle | Tamper-evident scans with OCR | 29/30 |
| Keywords | document,legal,exhibit,custody,proof,court,lawyer,paralegal,claim,insurance,adjuster,hr,receipt,sign | 100/100 |

Search phrases this covers by combining words across fields: *evidence scanner*, *PDF scanner*, *document scanner*, *legal document scanner*, *evidence app*, *chain of custody*, *exhibit scanner*, *insurance claim scanner*, *receipt scanner*, *OCR scanner*, *tamper evident*, *paralegal app*, *court documents*.

Source of truth: `store/listing.json`. Run `npm run check:listing` after any edit; it enforces limits, the no-repeat rule and the no-third-party-trademark rule.

### After launch
1. **Ratings matter most.** Ask happy users for a rating after a success moment (first packet exported). Apple allows 3 prompts a year via `SKStoreReviewController`. Adding `expo-store-review` takes one small change; ask Claude to add it.
2. **Add a second localization for extra keywords.** On the U.S. storefront Apple is widely reported to also index the *Spanish (Mexico)* listing. Add es-MX with the same screenshots and a different 100-character keyword set, for example: `tenant,landlord,lease,deposit,dispute,investigation,statement,affidavit,record,archive,secure,private,offline`. Add *English (U.K.)*, *English (Australia)* and *English (Canada)* listings for those storefronts.
3. **Promotional text** (170 chars) can change without a new build. Use it for seasonal hooks ("tax season receipts", "storm claim season").
4. **Custom Product Pages**: make one per audience (Tenants, Insurance, HR, Legal) with matching screenshots, and link each from targeted posts.
5. **In-App Events**, for example "Free evidence-organising week", appear in search results.
6. **Review keyword ranking monthly** in App Store Connect › App Analytics › Sources › App Store Search, and swap the weakest keyword.

## Google search (SEO)

Done in `site/`:
- Keyword-focused `<title>` and meta descriptions on every page, canonical URLs and `robots` meta
- Open Graph and Twitter card tags with a 1200×630 share image (`og.png`)
- Structured data: `SoftwareApplication`, `WebSite` and `Organization` on the home page, and `FAQPage` (19 answers) on the support page, so answers can appear as rich results
- `sitemap.xml`, `robots.txt` and a `noindex` 404 page
- Content written around real searches: evidence scanner app, chain of custody app, tamper-evident PDF, SHA-256 document hash, scanning documents for an insurance claim / tenant dispute / HR investigation

### After deploying
1. **Google Search Console**: add `https://caseseal.pages.dev`, verify with the HTML-tag method (send Claude the tag and it'll add it), then submit `https://caseseal.pages.dev/sitemap.xml`.
2. **Bing Webmaster Tools**: import from Search Console in one click (this also feeds ChatGPT search and DuckDuckGo).
3. **Smart App Banner**: once the App Store app ID exists, add `<meta name="apple-itunes-app" content="app-id=NUMBER">` to every page and a real "Download on the App Store" badge link.
4. **A custom domain** (for example `caseseal.app`) ranks and converts better than `pages.dev`. Point it at Cloudflare Pages, then update the URLs in `app.json`, `store/listing.json` and `site/`.
5. **Backlinks**: list CaseSeal in legal-tech directories (Legal Technology Hub, Capterra, AlternativeTo, Product Hunt), and answer questions in tenant-rights, paralegal and insurance-adjuster communities with a link.
6. **Add one helpful article a month** (for example "How to prove a document wasn't altered", "Organising evidence for a deposit dispute"). Each new page is another way to be found.
