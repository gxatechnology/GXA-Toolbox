# Page and Route Inventory

## Count model

The terms below are intentionally separated.

| Kind | Count | Meaning |
|---|---:|---|
| Registered tool routes | 92 | One route for every central-registry entry |
| Company/legal routes | 6 | About, Careers, Security, Privacy, Terms, GDPR |
| Homepage | 1 | `/` |
| Public direct-route pages | 99 | Home + tools + company/legal |
| Private direct routes | 2 | `/dashboard/`, `/admin/` |
| Generated direct routes | 101 | Public + private |
| Generated HTML entrypoints | 102 | Direct routes + `404.html` |
| Sitemap URLs | 98 | Home + 91 indexable tools + 6 company/legal |
| Noindex generated pages | 3 | PPT to PDF, dashboard, admin |
| Source HTML files | 6 | Templates/generated BG entry/fixtures; not a route count |
| Auth modal screens | 5 | Sign in, sign up, recovery request, new password, invitation |
| Dashboard application screens | 2 top-level | User dashboard and admin dashboard; both can contain multiple panels/states |

The detailed 92-tool route inventory is in `04_91_TOOL_MATRIX.md`. The filename is retained from the requested deliverable; the source registry now contains 92 tools.

## Non-tool routes

| Route | Page | Category | Implementation | Authentication | Indexing | Mobile | Status |
|---|---|---|---|---|---|---|---|
| `/` | Homepage / all-tool directory | Product | Generated static shell + vanilla JS | No | index | Yes | Working |
| `/about/` | About | Company | Generated content route | No | index | Yes | Working |
| `/careers/` | Careers | Company | Generated content route | No | index | Yes | Working |
| `/security/` | Security | Trust | Generated content route | No | index | Yes | Working; session wording needs correction |
| `/privacy-policy/` | Privacy Policy | Legal | Generated content route | No | index | Yes | Working; session wording needs correction |
| `/terms/` | Terms | Legal | Generated content route | No | index | Yes | Working |
| `/gdpr/` | GDPR | Legal | Generated content route | No | index | Yes | Working |
| `/dashboard/` | User dashboard | Private app | Generated shell + authenticated client/API state | Yes for data | noindex | Yes | Working contract; manual signed-in QA needed |
| `/admin/` | Admin dashboard | Private app | Dedicated generated admin entry + admin Functions | Yes | noindex | Yes | Working integration |
| any unknown path | 404 | System | Generated `404.html` | No | noindex | Yes | Real 404 in server contract |

## Authentication UI screens

Authentication is modal/state based rather than five separate indexable routes.

| Screen/state | Provider | Default data | Route/indexing |
|---|---|---|---|
| Sign in | Netlify Identity | Empty email/password; optional remembered email | Modal, not sitemap |
| Create account | Netlify Identity | Empty name/email/password fields | Modal, not sitemap |
| Request password recovery | Netlify Identity | Empty email | Modal, not sitemap |
| Choose new password | Netlify Identity recovery flow | Empty password fields | Modal, not sitemap |
| Complete invitation | Netlify Identity invitation flow | Empty password/profile fields | Modal, not sitemap |

## Function/API route surface

| Area | Current endpoints | Notes |
|---|---:|---|
| User session/profile/history | 4 active | Session/profile synchronization, history and saved-job metadata |
| Admin | 4 active | Login, session, logout and aggregate dashboard data |
| Tool event telemetry | 1 active handler route | Metadata/event record; no uploaded file payload path found |
| Legacy custom user auth | 3 handlers | Preserved compatibility surface; returns 410 |
| Total handler files | 11 | Supported by 8 helper modules |

## Route implementation observations

- All registry IDs are recognized as clean `/{id}/` paths.
- Legacy `#tool-{id}` states are normalized to clean paths at runtime.
- Internal tool cards and related-tool items use real anchors with meaningful `href` values.
- Background Remover is the only dedicated React/Vite tool route; all other tools use the main application shell.
- `/ppt-to-pdf/` remains loadable for compatibility, but is explicitly noindex and excluded from the sitemap because no faithful conversion engine exists.
- Invalid paths are tested as real 404s; they no longer masquerade as homepage-shaped HTTP 200 pages.
- Main favicon, manifest, route assets and canonical URLs use root/absolute-safe paths in the generated build.

## Rendered route verification

Representative local `dist/` pages were rendered at **1366×768** and **390×844**: `/`, `/merge-pdf/`, `/image-ocr/`, `/background-remover/`, `/admin/`, plus an invalid path on desktop. The tested pages had route-specific title/H1 content and no document/body horizontal overflow. The 390 px mobile drawer exposed Home, All Tools, tool categories, Dashboard, language, theme, Contact Support, Sign In and Sign Up; opening it applied body scroll lock.

This is representative QA, not a claim that all 102 entrypoints and every tool interaction were visually exercised.
