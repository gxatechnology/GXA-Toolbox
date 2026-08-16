# Authentication and Database

## User authentication

Netlify Identity is the current user identity authority. The browser client handles registration, sign-in, logout, verification, password recovery, invitation completion and session persistence. Password hashing/credential storage is provider-managed; no application password hash is exposed to the browser or stored in the application tables.

Authenticated Functions validate the Identity bearer token and synchronize a local application profile. The product must not market the old custom session-cookie architecture as the current normal-user mechanism.

### Auth-related screens

1. Sign in.
2. Create account.
3. Request password recovery.
4. Choose a new password.
5. Complete invitation.

Fields remain empty by default; example name/email values are placeholders only.

## Admin authentication

Admin authentication is separate from user Identity:

- Admin email/password are supplied through environment variables.
- Comparison is constant-time.
- Successful login issues an HMAC-signed `gxa_admin_session` cookie.
- Cookie controls include `Secure`, `HttpOnly` and `SameSite=Lax`.
- Admin session/logout/data endpoints return no-store/noindex security headers.

No brute-force lockout/rate-limiting layer was verified in application code.

## Database schema

| Table | Purpose | Important relationships/data |
|---|---|---|
| `users` | Application mirror of identity/user basics | Stable user identity, email and timestamps |
| `user_profiles` | Display/profile information | One-to-one/linked to user |
| `file_jobs` | User tool/job history metadata | Foreign key to user; tool/status/file metadata, not verified file blobs |
| `tool_analytics_events` | Tool usage telemetry | Event/tool/outcome/context fields |
| `auth_events` | Authentication audit events | Success/failure/type metadata |
| `system_events` | Operational/admin events | Severity/type/message/context |

Four migrations create and extend the schema. A shared timestamp function/trigger updates `updated_at` where configured. Foreign keys and indexes support user/job and event queries. No `DROP TABLE` migration behavior is part of the fresh-schema path.

## Data flows

| Flow | Data destination | Uploaded file bytes? |
|---|---|---|
| Registration/login/recovery | Netlify Identity | No tool file |
| Profile sync/session | Netlify Function + PostgreSQL | No |
| Save job/history | Netlify Function + `file_jobs` | Metadata only in verified schema/API |
| Tool-event telemetry | Function + analytics/event table | Metadata only |
| Admin analytics | Protected Function reads aggregates/events | No |
| PDF/image/conversion processing | Browser/Worker/WASM | Remains client-side |

## Authorization and route behavior

- Dashboard is noindex and presents an authentication state when no session is available.
- Functions enforce identity/admin checks rather than trusting UI visibility.
- Admin and dashboard responses use noindex/no-store architecture.
- Legacy custom register/login/logout endpoints intentionally return 410; they should not be described as active authentication.

## Environment requirements

Required values include Netlify Identity/site context, Netlify Database connection provided by the integration, admin credential values, and the admin session-signing secret. Secret values must remain server-side and are not reproduced here.
