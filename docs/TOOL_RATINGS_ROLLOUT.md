# Tool ratings and reviews rollout

## Status and safety gate

The ratings implementation is complete and verified locally, but public production submission is **disabled by default**. The public endpoint returns `503` and the component remains hidden unless `TOOL_RATINGS_ENABLED=true`. Enabling also requires a server-only `RATING_ABUSE_SECRET` of at least 32 characters and migration `0009_create_tool_ratings` on the correctly associated Netlify Database branch.

No rating, review, user count, or aggregate is seeded. Client storage is not an authority. A thank-you state appears only after a successful database insert.

## Inclusion list (94 of 95 tools)

- **PDF (23):** `merge-pdf`, `organize-pdf`, `split-pdf`, `protect-pdf`, `unlock-pdf`, `pdf-to-jpg`, `jpg-to-pdf`, `word-to-pdf`, `pdf-to-word`, `compress-pdf`, `edit-pdf`, `rotate-pdf`, `watermark-pdf`, `pagenumber-pdf`, `pdf-metadata`, `remove-pdf-pages`, `extract-pdf-pages`, `extract-images-pdf`, `crop-pdf`, `header-footer-pdf`, `sign-pdf`, `repair-pdf`, `ocr-pdf`.
- **Image (7):** `compress-image`, `resize-image`, `image-converter`, `gps-map-camera`, `crop-image`, `image-ocr`, `background-remover`.
- **Utility (27):** `password-generator`, `barcode-generator`, `color-extractor`, `text-to-speech`, `qr-reader`, `barcode-reader`, `base64-tool`, `url-tool`, `json-tool`, `hash-tool`, `case-converter`, `word-counter`, `lorem-ipsum`, `diff-checker`, `sql-formatter`, `xml-to-json`, `uuid-generator`, `user-agent`, `regex-tester`, `markdown-editor`, `css-beautifier`, `js-beautifier`, `html-beautifier`, `cron-generator`, `color-converter`, `exif-viewer`, `timestamp-converter`.
- **ZIP (2):** `zip-manager`, `zip-extractor`.
- **Convert (20):** `epub-to-pdf`, `pdf-to-epub`, `gif-maker`, `excel-to-pdf`, `pdf-to-text`, `html-to-pdf`, `pdf-to-html`, `markdown-to-pdf`, `pdf-to-markdown`, `svg-to-png`, `png-to-svg`, `webp-to-jpg`, `gif-to-png`, `image-to-pdf`, `png-to-pdf`, `txt-to-pdf`, `pdf-to-image`, `pdf-to-png`, `pdf-to-excel`, `pdf-to-ppt`.
- **Calculator (15):** `calculator`, `scientific-calculator`, `percentage-calculator`, `age-calculator`, `date-calculator`, `emi-calculator`, `loan-calculator`, `interest-calculator`, `gst-calculator`, `sip-calculator`, `bmi-calculator`, `discount-calculator`, `unit-converter`, `currency-converter`, `time-calculator`.

`ppt-to-pdf` is intentionally excluded because the current deployment cannot provide faithful presentation rendering. Presenting post-success feedback on an unavailable workflow would be misleading.

## Placement

- File/result workflows render one component directly after the existing Download/Export section. It remains hidden until a real result exists.
- Live utilities and calculators render one component after the usable workspace/output area.
- Image Converter, GPS Map Camera, Crop Image and Edit PDF use their specialized result layout.
- Background Remover uses a React component inside the real export dialog and becomes eligible only after export.
- SPA rerenders are protected by a `WeakSet`; direct utilities do not also mount the hidden shared result-shell component.

Ratings do not gate processing or downloading. Existing result-ready advertising remains above the Download/Export section, and no ad is inserted inside the rating form.

## Data model and endpoints

Migration `netlify/database/migrations/0009_create_tool_ratings.sql` is additive. It creates:

- `public.tool_ratings`, with stable tool ID, 1–5 rating, optional review, moderation state, HMAC abuse key, submission day, timestamps and constraints;
- indexes for tool/date, moderation/date and abuse-window lookups;
- `public.tool_rating_aggregates`, a computed view with genuine count, average, distribution and latest update.

It contains no `DROP`, `TRUNCATE`, `DELETE`, data seed, or existing-row update.

- `GET /api/tool-ratings?toolId=...` returns a real aggregate or zero-count state.
- `POST /api/tool-ratings` validates same-origin requests, body size through the shared request reader, stable tool ID, integer rating and optional review up to 1,000 characters.
- `POST /.netlify/functions/admin-tool-ratings` requires an authenticated Admin session, same origin and the shared Admin rate limiter.

Raw IP addresses and user-agent strings are never stored. A server-side HMAC supports one rating per tool/client/day and a bounded hourly submission rate without intrusive fingerprinting. Written reviews begin pending; ratings remain counted unless the complete submission is classified as spam. Hiding a review does not erase a legitimate critical score.

## Admin and schema behavior

The Admin Dashboard adds **Tool Ratings / Reviews** with genuine totals, per-tool averages/counts/distribution, date filtering, search, sort, latest reviews and auditable moderation actions. Missing migration `0009` produces a precise ratings-unavailable state without changing the readiness of the original 12 application tables or breaking other Admin data.

`AggregateRating` is added at runtime only when the API returns a persisted count greater than zero and the matching tool's WebApplication JSON-LD exists. The same values are visible in the component. Static pages contain no fabricated rating schema.

## Trust strip

The homepage has one GXA-owned, 12-item value strip: GXA Toolbox, GXA Technologies, Free PDF Tools, Image Conversion, PDF Editing, Merge PDF, Compress PDF, Image Compression, File Conversion, Mobile Friendly, No-Cost Utilities and Easy Downloads. It pauses on hover/focus, becomes a stable horizontally scrollable row under reduced motion, and contains no third-party logos or unverified endorsements.

## Verified local tests

- `npm run test:ratings` — pass: schema, 95 stable tool IDs, flag gate, validation, same-origin protection, review length, 1-star persistence, privacy-safe HMAC, duplicate rejection, Admin/React/UI contracts and no fake claims.
- `RUN_POSTGRES_INTEGRATION=true node tests/postgres-auth-integration.mjs` — pass against an isolated Netlify development database with migrations 0001–0009, a persisted rating and Admin aggregate.
- `npm run test:ratings:browser` — pass at 320, 360, 390, 430, 768, 1024, 1280, 1440 and 1920: keyboard selection, 44px star targets, preserved state and explicit retry after failure, in-place success, result gating, independent real PDF download, no overflow and reduced motion.

Test API responses are deterministic fixtures and are not presented as production ratings.

## Production rollout (not performed)

1. Resolve and verify the existing Netlify Database association/migration-history mismatch first.
2. Create an isolated Deploy Preview connected to the intended new Netlify site and confirm branch database isolation.
3. Let the supported Netlify deploy workflow apply pending migration `0009`; do not paste SQL into the read-only production explorer.
4. Run the protected database diagnostic and confirm the 12 core tables plus optional `tool_ratings` table; verify migration history identifies `0009_create_tool_ratings`.
5. Set a newly generated server-only `RATING_ABUSE_SECRET`; do not expose it to frontend bundles or logs.
6. Set `TOOL_RATINGS_ENABLED=true` only after preview GET/POST/Admin moderation checks pass.
7. Deploy to production through the approved main-branch workflow, then submit genuine test ratings and verify aggregates/Admin moderation.

Rollback is configuration-only: set `TOOL_RATINGS_ENABLED=false`. Keep the additive table and data; do not roll back with destructive SQL.
