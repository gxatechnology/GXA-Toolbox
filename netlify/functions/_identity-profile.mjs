import { getUser as getNetlifyIdentityUser } from '@netlify/identity';
import { jsonResponse } from './_auth.mjs';
import { databaseErrorCategory, getDatabaseClient, recordSystemEvent } from './_database.mjs';

let identityUserProviderOverride;

function text(value, maxLength) {
  return String(value || '').trim().slice(0, maxLength);
}

export function normalizeIdentityUser(user) {
  if (!user?.id) return null;
  const metadata = user.userMetadata || user.user_metadata || {};
  const email = text(user.email, 254).toLowerCase();
  const fullName = text(user.name || metadata.full_name || metadata.name || email.split('@')[0] || 'GXA Toolbox user', 120);
  return {
    id: text(user.id, 128),
    email,
    name: fullName,
    provider: text(user.provider || user.appMetadata?.provider || user.app_metadata?.provider || 'email', 32)
  };
}

export async function getIdentityUser() {
  const rawUser = identityUserProviderOverride
    ? await identityUserProviderOverride()
    : await getNetlifyIdentityUser();
  return normalizeIdentityUser(rawUser);
}

export function setIdentityUserProviderForTests(provider) {
  if (process.env.NODE_ENV === 'production') throw new Error('Identity test adapter is unavailable in production.');
  identityUserProviderOverride = provider;
}

export async function requireIdentityUser() {
  const user = await getIdentityUser();
  if (!user) return { response: jsonResponse({ success: false, message: 'Sign in to continue.' }, 401) };
  return { user };
}

export async function syncIdentityProfile(user) {
  try {
    const { sql } = getDatabaseClient();
    const rows = await sql`
    INSERT INTO public.user_profiles
      (identity_user_id, legacy_user_id, email, full_name, provider, status, is_premium, last_login_at)
    VALUES
      (${user.id}, (SELECT id FROM public.users WHERE email = ${user.email} LIMIT 1), ${user.email}, ${user.name}, ${user.provider}, 'active', FALSE, CURRENT_TIMESTAMP)
    ON CONFLICT (identity_user_id) DO UPDATE
      SET email = EXCLUDED.email,
          full_name = EXCLUDED.full_name,
          provider = EXCLUDED.provider,
          legacy_user_id = COALESCE(public.user_profiles.legacy_user_id, EXCLUDED.legacy_user_id),
          last_login_at = CURRENT_TIMESTAMP
    RETURNING identity_user_id AS id, full_name AS name, email, status, is_premium
    `;
    return rows[0];
  } catch (error) {
    await recordSystemEvent('identity_profile_sync', databaseErrorCategory(error));
    throw error;
  }
}

export function publicIdentityProfile(profile) {
  return {
    id: String(profile.id),
    name: String(profile.name),
    email: String(profile.email || '').toLowerCase(),
    role: 'user',
    is_premium: Number(profile.is_premium) || 0
  };
}
