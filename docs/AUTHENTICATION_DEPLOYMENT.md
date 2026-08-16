# GXA Toolbox authentication deployment

Normal end-user authentication now uses Netlify Identity through the custom GXA Toolbox modal. The former SQL password/session endpoints are retained only as explicit HTTP 410 compatibility responses and must not be used for new registration, login, or logout.

Use [NETLIFY_IDENTITY_SETUP.md](./NETLIFY_IDENTITY_SETUP.md) for the exact Netlify Identity, Google provider, email confirmation, password recovery, database migration, and production verification steps.

## Architecture boundaries

- Netlify Identity owns end-user email/password credentials, Google OAuth, verification, recovery, `nf_jwt`/refresh cookies, and session refresh.
- `public.user_profiles` stores application-only profile state keyed by `identity_user_id`.
- New `public.file_jobs` records use `identity_user_id`; the legacy numeric `user_id` column and `public.users` rows remain intact. On first Identity session, a same-email legacy account is linked through `user_profiles.legacy_user_id` so its prior job history remains available without copying its password.
- `/api/session.php`, `/api/get-history.php`, and `/api/save-job.php` require a verified Netlify Identity user.
- `/api/register.php`, `/api/login.php`, and `/api/logout.php` are retired compatibility endpoints; the browser uses the official Identity library directly.
- Admin authentication remains independent and continues to use its dedicated admin cookie and environment variables.

Do not paste migrations into the production SQL console. Netlify Database discovers and applies `netlify/database/migrations/0004_link_netlify_identity_profiles.sql` through the supported deployment workflow.
