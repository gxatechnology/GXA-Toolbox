# Product Feature Inventory

| Feature | Classification | Evidence / remarks |
|---|---|---|
| Central tool registry | IMPLEMENTED | 92 entries in `public_html/assets/app.js`; parsed by `scripts/tool-registry.mjs` |
| Global tool search / command palette | IMPLEMENTED | Search buttons, keyboard-aware palette and searchable registry |
| All-tools filtering | IMPLEMENTED | Six category filters and accessible search label |
| Favorites | IMPLEMENTED | Local persistence and favorite shelf/card controls |
| Recent tools/searches | IMPLEMENTED | Local browser persistence |
| User dashboard | IMPLEMENTED | Generated noindex route with authenticated/guest states |
| Admin dashboard | IMPLEMENTED | Separate protected/noindex route and admin Functions |
| Sign up / sign in / logout | IMPLEMENTED | Netlify Identity flows |
| Recovery and invitation | IMPLEMENTED | Identity recovery/invitation modal states |
| Persistent user session | IMPLEMENTED | Netlify Identity token/session client |
| User profile synchronization | IMPLEMENTED | Identity-profile Function/helper + `user_profiles` |
| File-job/history metadata | IMPLEMENTED | `file_jobs`, authenticated history/save APIs |
| Uploaded-file storage | NOT IMPLEMENTED | No file blob/object storage path found; processing is client-side |
| Dark mode | IMPLEMENTED | Toggle + local preference |
| Language selector | PARTIAL | Selector and labels exist; verified route-localized content/hreflang architecture does not |
| Desktop navigation/mega menus | IMPLEMENTED | Real route anchors and category groups |
| Mobile navigation drawer | IMPLEMENTED | Scrollable drawer, body lock, account/support actions; rendered at 390×844 |
| Responsive tool workspaces | IMPLEMENTED | Shared breakpoint/mobile workspace contracts; representative rendered QA |
| Feedback | IMPLEMENTED | Floating feedback/control surface; delivery backend not independently verified |
| Contact Support | PARTIAL | Modal exists, but `/api/contact.php` has no Netlify mapping/function in audited deployment config |
| Preview/result views | IMPLEMENTED | File previews or textual/numeric result panels by tool |
| Downloads | IMPLEMENTED | Relevant output-producing tools create browser downloads |
| Copy | IMPLEMENTED | Text/code/result tools and selected output summaries |
| Web Share | PARTIAL | Used where browser/platform supports it; fallback varies by tool |
| Undo/redo | PARTIAL | Editor/action tools expose it; not meaningful for one-shot calculators/converters |
| Keyboard/focus support | PARTIAL | Skip link, focus-visible and semantic controls present; exhaustive keyboard E2E absent |
| Accessibility | PARTIAL | Labels, focus states, reduced-motion rules; no axe/assistive-technology audit suite |
| Toast notifications | IMPLEMENTED | Shared success/error feedback |
| Loading/progress | IMPLEMENTED | Processing states and progress for heavy workflows |
| Cancellation | PARTIAL | Important Worker/heavy paths support it; not universal |
| Drag and drop | IMPLEMENTED | Desktop enhancement; visible file inputs remain primary mobile path |
| File validation | IMPLEMENTED | Type/signature/size and route-specific caps; depth varies by format |
| Output validation | PARTIAL | Runtime signature/decode checks and fixture contracts; not every route E2E |
| Error handling | IMPLEMENTED | Route-specific errors, blockers and shared states |
| Local/offline processing | PARTIAL | Processing local; first load and some route assets require network; no Service Worker |
| Privacy messaging | PARTIAL | Strong local-processing descriptions; published auth-session text is stale |
| Route-specific SEO metadata | IMPLEMENTED | Title/description/canonical/robots/OG/Twitter/JSON-LD |
| Sitemap / robots | IMPLEMENTED | Registry-driven `sitemap.xml`; real `robots.txt` |
| Structured data | IMPLEMENTED | Organization/WebSite/WebApplication and route Breadcrumb/Application data |
| Google Tag Manager | IMPLEMENTED | `GTM-TBQN2SJ4`, one loader/noscript on 99 public pages |
| Direct GA4 script | NOT IMPLEMENTED | Correctly absent; GA4 is configured through GTM externally |
| AdSense site loader | IMPLEMENTED | Publisher `ca-pub-9226826319752464`; no fabricated ad units |
| `ads.txt` | IMPLEMENTED | Authorized seller line preserved in source/build |
| PWA manifest | IMPLEMENTED | Branded manifest and icons |
| Service Worker/offline install | NOT IMPLEMENTED | No Service Worker found; do not claim offline app |
| Real 404 | IMPLEMENTED | Generated 404 plus direct-route server test |

## Capability summary

- The interface infrastructure is mature relative to the processing surface: discovery, route identity, upload, status, preview, output and responsive navigation are shared.
- “Implemented” means source-confirmed, not that every browser/device combination was manually exercised.
- Features most in need of product work are Contact Support delivery, true localization, comprehensive accessibility automation, complete cancellation, offline/PWA behavior and real-browser E2E.
