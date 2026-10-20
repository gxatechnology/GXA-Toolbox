# Admin Dashboard recovery and Adsterra reporting

Date: 2026-10-20  
Scope: local source and isolated tests only. No production database, Netlify environment, Google account, Adsterra account, deploy, commit, or push was changed.

## Confirmed architecture and root causes

The Admin Dashboard is a private static shell at `/admin/`. Its data is returned by the administrator-session-protected `admin-data` Netlify Function. First-party operational analytics come from Netlify PostgreSQL through `@netlify/database`; GA4, Search Console, AdSense, and Adsterra are independent reporting APIs. A database failure must not be described as a Google or Adsterra failure, and an external reporting failure must not suppress database data.

The repository already contains the complete first-party event path (`gxa-analytics.js` → `tool-event.mjs` → `public.tool_analytics_events`) and admin queries. The new-account recovery risk is deployment state: the new database previously showed no public tables while migration history reported no pending migrations, and the migrated environment-variable **names** do not prove that their values, account associations, or permissions are correct. Static build success is not evidence of database or reporting connectivity.

Migration `0008_recover_expected_application_schema.sql` remains unchanged. It is additive and defines the 12 expected public tables without inserting, dropping, truncating, or rewriting records.

## Module inventory

| Dashboard module | Frontend | Protected data path | Source | Environment | Local status | Production verification / corrective action |
|---|---|---|---|---|---|---|
| Overview | `public_html/admin/admin.js` | `admin-data` | Combined sources below | Combined | Contract tested | Verify every source independently after deploy. |
| Tool opens, starts, successes, failures, downloads, rankings and trends | `tools()` / `overview()` | `admin-data` → `_admin-tool-analytics.mjs` | `public.tool_analytics_events` | Netlify Database runtime binding | Query and event contracts present | Run protected DB diagnostic; apply 0008 only through an approved isolated database branch/deploy. Do not fabricate history. |
| Users and sign-ins | `users()` | `admin-data` | `public.user_profiles` | Netlify Database runtime binding | Query contract present | Confirm new site is attached to intended production DB branch and tables exist. |
| User history | user dashboard (not admin aggregate) | `auth-history` | `public.file_jobs` | Netlify Database runtime binding | PostgreSQL integration is opt-in | Verify on isolated DB, then with a test account after approved deploy. |
| Feedback/contact support | `support()` | `contact-support` writes; `admin-data` reads | `public.support_messages` | Netlify Database runtime binding | Contract tested | Confirm persisted submission and admin-only read in preview. |
| Admin audit/resources | separate admin resource functions | `_admin-resources.mjs` | `admin_audit_events`, `admin_resource_reads`, `support_message_notes`, `admin_rate_limits`, `admin_profiles` | Netlify Database runtime binding | Schema/recovery contract present | Verify only through protected endpoints. |
| Database diagnostics | System / protected endpoint | `admin-database-diagnostics` | `information_schema`, `netlify.migrations` | Admin session + DB runtime | Read-only contract present | Compare site/deploy identity, search path, 12 tables, and migrations 0001–0008. |
| GA4 | `analytics()` | `_admin-integrations.mjs` | Google Analytics Data API | `GA4_PROPERTY_ID`, `GOOGLE_SERVICE_ACCOUNT_JSON` (or existing email/private-key alternative) | Provider mocks cover data/no-data/auth/permission/outage | Grant service account Viewer access to the numeric GA4 property; verify live request after deploy. |
| Search Console | `seo()` | `_admin-integrations.mjs` | Search Analytics API | `SEARCH_CONSOLE_SITE_URL`, Google service-account credentials | Provider mocks cover report shapes/statuses | Add service-account email as a user of the exact verified property. Respect reporting delay/thresholds. |
| AdSense | `adsense()` | `_admin-integrations.mjs` | AdSense Management API v2 | `ADSENSE_ACCOUNT_ID`, `GOOGLE_ADSENSE_OAUTH_CLIENT_ID`, `GOOGLE_ADSENSE_OAUTH_CLIENT_SECRET`, `GOOGLE_ADSENSE_REFRESH_TOKEN` | Provider mocks cover token refresh/report/statuses | Verify offline token and account permission. Site code approval and reporting OAuth remain distinct. |
| Adsterra | `adsterra()` | `_adsterra-reporting.mjs`, called only by protected `admin-data` | Publisher `stats.json` grouped by date, placement, domain, country | `ADSTERRA_API_TOKEN` | Provider mocks cover all groups, statuses, no-data and zero-activity units | Generate a **publisher** API token, set it server-side, then verify website ID 6091425. |

## Adsterra implementation

- Endpoint: `https://api3.adsterratools.com/publisher/stats.json`
- Authentication: server-side `X-API-Key`; the token and authorization header never enter public HTML/JavaScript or API responses.
- Website filter: `domain=6091425` as documented by the publisher API.
- Read-only groups: `date`, `placement`, `domain`, and `country`.
- Reporting periods: today, 7, 28, 30, 90 days, or an administrator-selected custom UTC range up to 366 days ending today or earlier.
- Guardrails: 10-second request timeout, two-minute bounded cache/in-flight deduplication, at most six uncached report loads per warm function minute, status-specific safe errors, and independent failure isolation.
- The table always includes the nine configured placement IDs. A unit omitted by the provider is labeled “No activity returned” with zero activity; that is not presented as a failed ad or a fabricated provider row.
- Revenue and traffic values originate only from publisher responses. CTR and CPM totals are derived from reported clicks, impressions, and revenue; advertising impressions/clicks are never called visitors.
- Smartlink 31822155 remains outside this reporting unit list and remains disabled in the site integration.

The current official Adsterra publisher materials describe GET-only publisher access, `X-API-Key`, the `stats.json` endpoint, date/domain/placement/country filters, and grouping by date, placement, domain, or country: [Adsterra API overview](https://adsterra.com/api/) and [publisher API guide](https://adsterra.com/blog/how-to-use-adsterra-publishers-api/).

## Required Netlify environment names

Existing admin/auth/database names remain unchanged. Reporting requires:

- `ADSTERRA_API_TOKEN`
- `GA4_PROPERTY_ID`
- `SEARCH_CONSOLE_SITE_URL`
- `GOOGLE_SERVICE_ACCOUNT_JSON` (preferred existing configuration) or the repository's existing split service-account values
- `ADSENSE_ACCOUNT_ID`
- `GOOGLE_ADSENSE_OAUTH_CLIENT_ID`
- `GOOGLE_ADSENSE_OAUTH_CLIENT_SECRET`
- `GOOGLE_ADSENSE_REFRESH_TOKEN`
- existing `GXA_ADMIN_EMAIL`, `GXA_ADMIN_PASSWORD`, `ADMIN_SESSION_SECRET`

Never expose or paste these values into public scripts, generated HTML, screenshots, support tickets, or logs.

## Database verification checklist

1. Create an isolated deploy preview on the **new** Netlify site and confirm its database branch is isolated before any migration applies.
2. Sign in as administrator and call `/.netlify/functions/admin-database-diagnostics`.
3. Confirm `deployment.site_id`, context, and branch identify the intended new site/deploy.
4. Confirm the database identity/search path and public schema privileges are expected.
5. Confirm all 12 expected public tables and migrations 0001–0008.
6. If migration history and schema disagree, do not edit `netlify.migrations`; deploy the already-reviewed additive 0008 through Netlify's supported migration workflow.
7. Submit one test tool event, support message, account history record, and authenticated login in preview; verify only those real test records appear.
8. Promote to production only after preview results are recorded. Do not restore historical rows into the new database until an old-database export is available and reconciled by stable identifiers.

## Google authorization checklist

1. Confirm the service-account JSON belongs to the intended Google Cloud project and the private key parses server-side.
2. Grant the service-account email access to the configured GA4 property and exact Search Console property.
3. Confirm Analytics Data API and Search Console API are enabled for the project.
4. Confirm the AdSense OAuth client, refresh token, read-only scope, and `ADSENSE_ACCOUNT_ID` refer to the intended publisher account.
5. Verify connected, no-data, authentication, permission, rate-limit/outage states separately; never replace a failed report with zero.

## Historical recovery

Do not recreate old event rows from GA4, Search Console, AdSense, or Adsterra aggregates. If the old Netlify database becomes accessible, export first-party tables read-only, validate counts/checksums and identity keys, import into an isolated branch with conflict-safe statements, verify account isolation, then schedule an explicitly approved production import. Keep the original export immutable for rollback/audit.

## Pending production checks

Live database, Google, and Adsterra authentication cannot be certified without a future approved deploy and the real server-side credentials. The correct pre-deployment state is therefore **code GO / production data NO-GO** until the protected preview checks above pass.
