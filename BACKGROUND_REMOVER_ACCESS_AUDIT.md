# Background Remover Access Audit

## Root Cause

The Background Remover route could be blocked before the editor rendered because the shared tool page renderer checked a premium-tools gate for every tool. That gate used the database-backed `window.PHP_SESSION.premium_tools` list when available and a hardcoded fallback list when the PHP session bootstrap was unavailable. The fallback list included `background-remover`, so unauthenticated visitors could see the "Premium Utility" sign-in screen instead of the upload editor.

## Files Involved

- `public_html/assets/app.js`
- `public_html/index.php`
- `database.sql`
- `public_html/api/background-remover.php`
- `public_html/assets/tool-workspace.js`
- `public_html/_redirects`

## Changes Made

- Added an explicit public-tool allowlist in `public_html/assets/app.js` and made `background-remover` bypass premium gating.
- Removed `background-remover` from the frontend hardcoded premium fallback list.
- Updated `public_html/index.php` so database-bootstrapped premium tool IDs exclude `background-remover` even if an existing database row is toggled incorrectly.
- Added `public_html/_redirects` with `/* /index.html 200` so direct Netlify SPA route access can reach the app shell.
- Preserved the existing Background Remover processor, upload flow, navigation link, styling, and authentication flows for dashboard/admin areas.

## Access Restrictions Removed

- Guest blocker card for Background Remover.
- "Premium Utility" sign-in requirement for Background Remover.
- Standard-user premium restriction for Background Remover.
- Hardcoded fallback premium classification for Background Remover.
- Database premium-list influence for Background Remover during PHP bootstrap.

## Testing Completed

- Repository audit/search covered premium/auth/access terms across `public_html`, API handlers, dashboard/admin/developer pages, database seed data, and frontend assets.
- `Invoke-WebRequest http://127.0.0.1:4180/background-remover` returned `200`.
- The `/background-remover` HTML shell contains the app mount and PHP session bootstrap, and does not contain `Premium Utility`, `request access`, or `Please sign in`.
- `curl.exe -F "file=@tests/fixtures/transparent.png" http://127.0.0.1:4180/api/background-remover.php` returned success with `bgremoved_1786172018_1d968282.png`.
- The generated output `public_html/outputs/background-remover/bgremoved_1786172018_1d968282.png` exists, is 2,390 bytes, and has a valid PNG signature.
- `curl.exe -F "file=@tests/fixtures/corrupt-image.png" http://127.0.0.1:4180/api/background-remover.php` returned `success:false` with `The uploaded file is not a supported image.`
- `npm.cmd run lint` passed.
- `npm.cmd test` passed.
- `npm.cmd run build` passed.
- PHP syntax checks passed for `public_html/index.php`, `public_html/developer/index.php`, and `public_html/api/background-remover.php`.
- Direct route fallback exists for Apache in `public_html/.htaccess` and for Netlify/static deploys in `_redirects` and `public_html/_redirects`.

Browser-control note: the in-app browser automation runtime could not be used for the final click-through because its Node-backed browser runtime exited with `EPERM` while trying to access `C:\Users\tauqe\AppData`. The route and processor were still verified through the running local app server and real multipart uploads.

## Build Status

Passed: `npm.cmd run build`.
