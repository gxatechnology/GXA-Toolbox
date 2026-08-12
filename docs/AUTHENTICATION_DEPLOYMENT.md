# GXA Toolbox authentication deployment

GXA Toolbox has two deliberately separate database paths:

- Netlify production: the stable `/api/*.php` routes rewrite to handlers under `netlify/functions`, which query Netlify Database/PostgreSQL through the official `@netlify/database` client.
- PHP-capable hosting: the files under `public_html/api` continue to query the original MySQL schema through PDO.

The frontend API paths and response field names remain unchanged. PostgreSQL stores `full_name` and `password_hash`; the Netlify queries alias `full_name` to the frontend's existing `name` field and never return `password_hash`.

## Automatic Netlify Database migration

The production SQL Console is read-only and must not be used to apply this schema. The canonical migration is:

`netlify/database/migrations/0001_create_auth_schema.sql`

Netlify detects migrations in `netlify/database/migrations` and applies pending migrations automatically during its deploy lifecycle. The migration runs immediately before the target deploy is published; if it fails, Netlify blocks that deploy from being published. It creates only `public.users` and `public.file_jobs`, their constraints, indexes, foreign key, and PostgreSQL `updated_at` function/triggers. It contains no `DROP TABLE`, demo account, or password record.

The old `docs/NETLIFY_DATABASE_SCHEMA.sql` file now points to the canonical migration and must not be pasted into the production console.

### Exact steps after pushing

1. Before deploying, configure `AUTH_SESSION_SECRET` for the Netlify Functions runtime with at least 32 cryptographically random characters.
2. Commit and push `netlify/database/migrations/0001_create_auth_schema.sql` together with the PostgreSQL-backed Netlify Functions.
3. Recommended: open a pull request so Netlify creates a deploy preview and its isolated database branch. Netlify automatically applies the migration to that preview branch.
4. Test signup, login, session, logout, job saving, and history on the deploy preview.
5. Merge the source branch into the Git branch configured for Netlify production, or otherwise trigger a production deploy from that commit.
6. Publish the production deploy if automatic publishing is disabled. Netlify applies the pending migration to the production database immediately before publishing.
7. In the production Database dashboard, use read-only inspection to confirm `public.users` and `public.file_jobs` exist. Do not run `CREATE TABLE` in the SQL Console.
8. Complete the live authentication lifecycle checks on both production domains.

No separate database-branch promotion or merge is required for schema migrations. The deploy preview database branch is disposable validation infrastructure; merging the code causes the migration to be applied independently to production during the production deploy. Do not run a CLI command against production to apply this migration. `netlify database migrations apply` is the supported local-development command, while production and deploy-preview migrations are deploy-managed.

For optional local CLI validation after installing or invoking the current Netlify CLI, run `netlify database migrations apply`. The automated repository test uses `@netlify/database-dev` directly and verifies the same canonical migrations directory without contacting production.

## Required Netlify runtime variable

Configure this as a Netlify environment variable available to Functions. Do not put its value in this repository.

- `AUTH_SESSION_SECRET`: a cryptographically random value containing at least 32 characters.

Netlify Database supplies the correct database branch automatically through `@netlify/database`. Do not manually configure `DB_HOST`, `DB_NAME`, `DB_USER`, `DB_PASS`, `DB_PORT`, `DB_SSL`, or the old generic `DATABASE_URL` for the Netlify Functions path. Netlify internally provides its managed database binding/`NETLIFY_DB_URL`; application code does not read or expose that value.

## Security contract

- Passwords are hashed with bcrypt cost 12 and are never returned to the browser.
- Authentication state is held in a signed, seven-day, `HttpOnly`, `Secure`, `SameSite=Lax` cookie.
- Emails are trimmed and lowercased before queries, and the database enforces normalized unique email values.
- Login failures use one generic response for unknown users, wrong passwords, and inactive accounts.
- Same-origin checks protect state-changing requests; no cross-origin auth API is exposed.
- Every API handler returns JSON and logs database details only server-side.
- History queries derive `user_id` only from the verified session, preventing callers from selecting another user's jobs.

## Production verification after deployment

The source must be pushed/deployed before these checks can pass; this document does not authorize a deployment.

1. Confirm `POST /api/register.php` returns `201 application/json` and a session cookie.
2. Refresh and confirm `GET /api/session.php` returns `authenticated: true`.
3. Save one processing-history entry and confirm only that account can retrieve it.
4. Sign out, sign back in, and repeat the refresh check.
5. Repeat registration with the same normalized email and confirm `409` without SQL details.
6. Repeat the complete lifecycle on `https://gxatoolbox.in` and `https://gxatoolbox.netlify.app`.

Do not describe production authentication as live until the schema is applied, `AUTH_SESSION_SECRET` is configured, the source is deployed, and both-domain lifecycle testing succeeds.
