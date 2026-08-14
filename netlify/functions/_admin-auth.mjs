import { createHash, createHmac, timingSafeEqual } from 'node:crypto';
import { jsonResponse } from './_auth.mjs';

export const ADMIN_SESSION_COOKIE = 'gxa_admin_session';
const ADMIN_SESSION_TTL_SECONDS = 60 * 60 * 18;
const MAX_ADMIN_BODY_BYTES = 4 * 1024;

class AdminConfigurationError extends Error {}

function requiredEnvironment(name, minimumLength = 1) {
  const value = String(process.env[name] || '');
  if (value.length < minimumLength) throw new AdminConfigurationError(`${name} is not configured.`);
  return value;
}

function digest(value) {
  return createHash('sha256').update(String(value)).digest();
}

function safeEqual(left, right) {
  return timingSafeEqual(digest(left), digest(right));
}

function encode(value) {
  return Buffer.from(value).toString('base64url');
}

function adminSessionSignature(payload) {
  return createHmac('sha256', requiredEnvironment('ADMIN_SESSION_SECRET', 32)).update(payload).digest('base64url');
}

export function assertAdminSameOrigin(request) {
  const origin = request.headers.get('origin');
  if (!origin) return;
  const requestUrl = new URL(request.url);
  const forwardedHost = request.headers.get('x-forwarded-host')?.split(',')[0]?.trim();
  const requestHost = forwardedHost || request.headers.get('host') || requestUrl.host;
  if (new URL(origin).host !== requestHost) {
    const error = new Error('Cross-origin request rejected.');
    error.status = 403;
    throw error;
  }
}

export async function readAdminJson(request) {
  const length = Number(request.headers.get('content-length') || 0);
  if (length > MAX_ADMIN_BODY_BYTES) {
    const error = new Error('Request body is too large.');
    error.status = 413;
    throw error;
  }
  if (!request.headers.get('content-type')?.toLowerCase().includes('application/json')) {
    const error = new Error('Expected a JSON request.');
    error.status = 415;
    throw error;
  }
  try {
    const body = await request.json();
    if (!body || typeof body !== 'object' || Array.isArray(body)) throw new Error('Invalid payload.');
    return body;
  } catch {
    const error = new Error('Invalid JSON request.');
    error.status = 400;
    throw error;
  }
}

export function verifyAdminCredentials(email, password) {
  const configuredEmail = requiredEnvironment('GXA_ADMIN_EMAIL');
  const configuredPassword = requiredEnvironment('GXA_ADMIN_PASSWORD', 8);
  return safeEqual(String(email || '').trim().toLowerCase(), configuredEmail.trim().toLowerCase())
    && safeEqual(String(password || ''), configuredPassword);
}

export function createAdminSessionToken(now = Date.now()) {
  const payload = encode(JSON.stringify({
    sub: 'gxa-administrator',
    iat: Math.floor(now / 1000),
    exp: Math.floor(now / 1000) + ADMIN_SESSION_TTL_SECONDS
  }));
  return `${payload}.${adminSessionSignature(payload)}`;
}

export function verifyAdminSessionToken(token, now = Date.now()) {
  if (!token || !token.includes('.')) return null;
  const [payload, suppliedSignature] = token.split('.');
  if (!payload || !suppliedSignature) return null;
  let expectedSignature;
  try {
    expectedSignature = adminSessionSignature(payload);
  } catch (error) {
    if (error instanceof AdminConfigurationError) throw error;
    return null;
  }
  const expected = Buffer.from(expectedSignature);
  const supplied = Buffer.from(suppliedSignature);
  if (expected.length !== supplied.length || !timingSafeEqual(expected, supplied)) return null;
  try {
    const session = JSON.parse(Buffer.from(payload, 'base64url').toString('utf8'));
    if (session.sub !== 'gxa-administrator' || session.exp <= Math.floor(now / 1000)) return null;
    return session;
  } catch {
    return null;
  }
}

export function readAdminSession(request) {
  const cookies = request.headers.get('cookie') || '';
  const value = cookies
    .split(';')
    .map(part => part.trim())
    .find(part => part.startsWith(`${ADMIN_SESSION_COOKIE}=`))
    ?.slice(ADMIN_SESSION_COOKIE.length + 1);
  return verifyAdminSessionToken(value ? decodeURIComponent(value) : '');
}

export function requireAdminSession(request) {
  const session = readAdminSession(request);
  if (!session) {
    const error = new Error('Administrator authentication required.');
    error.status = 401;
    throw error;
  }
  return session;
}

export function createAdminSessionCookie(request) {
  const secure = new URL(request.url).protocol === 'https:' || process.env.CONTEXT === 'production';
  return [
    `${ADMIN_SESSION_COOKIE}=${encodeURIComponent(createAdminSessionToken())}`,
    'Path=/',
    'HttpOnly',
    'SameSite=Lax',
    secure ? 'Secure' : '',
    `Max-Age=${ADMIN_SESSION_TTL_SECONDS}`
  ].filter(Boolean).join('; ');
}

export function clearAdminSessionCookie(request) {
  const secure = new URL(request.url).protocol === 'https:' || process.env.CONTEXT === 'production';
  return [
    `${ADMIN_SESSION_COOKIE}=`,
    'Path=/',
    'HttpOnly',
    'SameSite=Lax',
    secure ? 'Secure' : '',
    'Max-Age=0'
  ].filter(Boolean).join('; ');
}

export function adminErrorResponse(error) {
  if (error?.status) return jsonResponse({ success: false, message: error.message }, error.status);
  if (error instanceof AdminConfigurationError) {
    console.error('Admin configuration error:', error.message);
    return jsonResponse({ success: false, message: 'Administrator access is not configured for this deployment.' }, 503);
  }
  console.error('Admin service error:', error?.name || 'Error');
  return jsonResponse({ success: false, message: 'The administration service is temporarily unavailable.' }, 503);
}
