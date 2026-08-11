# GXA Toolbox authentication deployment

GXA Toolbox keeps the existing `users` and `file_jobs` MySQL schema. PHP-capable hosting continues to use the endpoints in `public_html/api`. Netlify uses the matching serverless handlers in `netlify/functions`; the public paths remain `/api/*.php` so the frontend stays same-origin on both `gxatoolbox.in` and the Netlify site domain.

## Required Netlify runtime variables

Configure these as Netlify environment variables with Functions scope. Do not put their values in this repository.

- `AUTH_SESSION_SECRET`: a cryptographically random value of at least 32 characters.
- Either `DATABASE_URL`, or all of `DB_HOST`, `DB_NAME`, `DB_USER`, and `DB_PASS`.
- Optional `DB_PORT` (defaults to `3306`).
- Optional `DB_SSL=true` for database providers that require TLS.
- Optional `DB_SSL_REJECT_UNAUTHORIZED=false` only when the database provider explicitly requires a private/untrusted certificate.

The database server must accept connections from Netlify Functions. Apply `database.sql` to the selected database before deploying. After variables are configured, trigger a fresh production deploy because runtime configuration and functions are captured by the deployment.

## Security contract

- Passwords are hashed with bcrypt (cost 12) and are never returned to the browser.
- Authentication state is held in a signed, seven-day, `HttpOnly`, `Secure`, `SameSite=Lax` cookie.
- Login failures use one generic message for unknown users, wrong passwords, and inactive accounts.
- Same-origin checks protect state-changing requests; no cross-origin auth API is exposed.
- Database errors are logged server-side and returned to users only as a safe service error.

## Production verification

After configuring the runtime variables and deploying, verify both domains:

1. Create a new account through the Sign Up dialog.
2. Confirm `POST /api/register.php` returns `201 application/json` plus the session cookie.
3. Refresh and confirm `GET /api/session.php` returns `authenticated: true`.
4. Sign out, sign back in, and repeat the refresh check.
5. Repeat registration with the same email and confirm `409` without a database error leak.
6. Repeat the flow on `https://gxatoolbox.in` and `https://gxatoolbox.netlify.app`.

