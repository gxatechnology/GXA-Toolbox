# GXA Toolbox production finalization

This document is the one-time owner checklist for the consolidated production release. Never place credential values in source files, browser code, build logs, screenshots, or support messages.

## Netlify Database

The authoritative migrations are applied in filename order by the supported Netlify Database deployment workflow:

1. `0001_create_auth_schema.sql`
2. `0002_repair_auth_schema_after_site_reconnect.sql`
3. `0003_create_admin_analytics_schema.sql`
4. `0004_link_netlify_identity_profiles.sql`

Migration 0004 adds the Netlify Identity profile link, provider field, file-job relationship, indexes, and update trigger without dropping user data. Do not paste these migrations into the read-only production SQL console. Trigger the later normal production deploy and confirm in the Netlify deploy log that migration 0004 was discovered and applied.

## Netlify environment variables

Configure each value only in Netlify's server-side environment settings. Use production scope for the production site and do not expose these variables to browser bundles.

### Application and administrator access

- `GXA_ADMIN_EMAIL`: administrator sign-in email.
- `GXA_ADMIN_PASSWORD`: strong unique administrator password.
- `ADMIN_SESSION_SECRET`: independent random administrator-session secret of at least 32 characters.

### GA4 and Search Console reporting

- `GA4_PROPERTY_ID`: numeric GA4 property ID, optionally prefixed with `properties/`.
- `SEARCH_CONSOLE_SITE_URL`: the exact verified property, normally `sc-domain:gxatoolbox.in` for the verified domain property.
- `GOOGLE_SERVICE_ACCOUNT_JSON`: the complete service-account JSON object. The server parses `client_email`, `private_key`, and `project_id` in memory; escaped `\n` line breaks are normalized server-side.

Grant the service-account email Viewer access in GA4 and access to the verified Search Console property. Search Console Restricted users can view Performance data, so Restricted access is expected to support the implemented Search Analytics query; a production 401/403 is still reported truthfully as Permission Required. The website continues to collect GA4 browser events only through GTM container `GTM-TBQN2SJ4`; do not add direct `gtag.js` in parallel.

### AdSense reporting

- `ADSENSE_ACCOUNT_ID`: AdSense account resource ID, with or without the `accounts/` prefix.
- `GOOGLE_ADSENSE_OAUTH_CLIENT_ID`: server-side OAuth client ID.
- `GOOGLE_ADSENSE_OAUTH_CLIENT_SECRET`: server-side OAuth client secret.
- `GOOGLE_ADSENSE_REFRESH_TOKEN`: offline refresh token issued to a user authorized for the AdSense account with read-only reporting scope.

The public publisher identity remains `ca-pub-9226826319752464`, and `/ads.txt` remains exactly:

`google.com, pub-9226826319752464, DIRECT, f08c47fec0942fa0`

AdSense approval, policy state, and Auto Ads configuration remain external Google states. The Admin dashboard reports them only when authenticated API reporting is available and never fabricates earnings.

## Netlify Identity

Keep registration open, email confirmation required, and the configured Google provider enabled. Confirm the external provider callback uses the Netlify Identity callback URL shown in the Netlify UI. The main application and administrator portal remain separate authentication systems.

## Post-deploy verification

1. Confirm the deploy publishes `dist` and the log shows all database migrations successful.
2. Confirm `/`, representative tool routes, `/admin/`, `/robots.txt`, `/sitemap.xml`, `/ads.txt`, `/_headers` behavior, and real 404 behavior.
3. Sign up and sign in with email/password and Google; confirm email verification, recovery, logout, dashboard, and history.
4. Sign in to `/admin/`; confirm the database card is Connected and each external report shows Connected, Connected · No Data, Configuration Required, Permission Required, or Error truthfully.
5. Confirm GA4 DebugView/Realtime receives one GTM-driven page view and intended tool events without a direct GA4 loader.
6. Confirm Search Console and AdSense reporting permissions from their respective Google consoles.
7. Run a representative PDF, image, Background Remover, calculator, ZIP, and developer tool and confirm processing/download behavior.

Do not deploy until local lint, tests, production build, PostgreSQL integration, responsive Admin QA, secret scan, and `git diff --check` all pass.
