# GXA Toolbox Netlify Identity setup

The application code uses the official `@netlify/identity` package through the existing GXA-branded modal. Netlify Identity owns normal-user passwords, OAuth, confirmation, recovery, cookies, and token refresh. The GXA PostgreSQL database stores only application profiles and tool history linked by the Identity subject.

Admin authentication remains a separate signed-cookie system and is not connected to Netlify Identity.

## Required Netlify dashboard configuration

1. Open the production GXA Toolbox project in Netlify.
2. Go to **Project configuration → Identity** and enable Identity.
3. Under **Registration**, keep registration open and email/password registration enabled.
4. Keep email confirmation required so email/password users verify their address before signing in.
5. Under **External providers**, keep the configured **Google (custom)** provider enabled. Do not enable Facebook or Apple in this phase.
6. Keep the real Google OAuth Client ID and Client Secret only in Netlify's Google provider configuration. Never place either value in frontend source.
7. In the Google OAuth client, keep `https://gxatoolbox.in` as the authorized JavaScript origin and `https://gxatoolbox.in/.netlify/identity/callback` as the authorized redirect URI.
8. In Identity email settings, verify the confirmation, invitation, and password-recovery email templates return users to `https://gxatoolbox.in/`. The root application handles Netlify's confirmation, invitation, and recovery hash callbacks.
9. Add `https://gxatoolbox.in` to any allowed external URL/site URL list shown in the Identity settings. Add Netlify deploy-preview URLs only if preview authentication is intentionally required.
10. Trigger the later normal production deploy. Migration `0004_link_netlify_identity_profiles.sql` will create the application profile link through the existing supported Netlify Database migration workflow.

No direct database SQL-console action is required. Do not paste the migration into the read-only production console.

## Production verification after deployment

- Create a new email account and complete confirmation if enabled.
- Sign out, sign in again, refresh, and verify the account remains signed in.
- Request password recovery, follow the email link, and set a new password in the GXA modal.
- Start **Continue with Google**, verify Google's consent screen returns to `https://gxatoolbox.in/`, then refresh and sign out.
- Run a tool while signed in and confirm its history appears only in that account.
- Confirm a normal Identity user cannot access `/admin/`, and admin login/logout does not affect the normal user session.

Real email delivery and Google OAuth cannot be completed by local static tests; they require the enabled production Identity instance and real provider credentials.
