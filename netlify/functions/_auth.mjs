import bcrypt from 'bcryptjs';
import { createHmac, timingSafeEqual } from 'node:crypto';
import { getDatabase, MissingDatabaseConnectionError } from '@netlify/database';

export const SESSION_COOKIE = 'gxa_toolbox_session';
const SESSION_TTL_SECONDS = 60 * 60 * 24 * 7;
const MAX_AUTH_BODY_BYTES = 8 * 1024;
let databaseClientOverride;

class ConfigurationError extends Error {}

export function jsonResponse(payload, status = 200, headers = {}) {
  return new Response(JSON.stringify(payload), {
    status,
    headers: {
      'Cache-Control': 'no-store',
      'Content-Type': 'application/json; charset=utf-8',
      'Referrer-Policy': 'no-referrer',
      'X-Content-Type-Options': 'nosniff',
      'X-Robots-Tag': 'noindex, nofollow, noarchive',
      ...headers
    }
  });
}

export function methodNotAllowed(allowed) {
  return jsonResponse({ success: false, message: 'Method not allowed.' }, 405, { Allow: allowed.join(', ') });
}

export function assertSameOrigin(request) {
  const origin = request.headers.get('origin');
  if (!origin) return;

  const requestUrl = new URL(request.url);
  const forwardedHost = request.headers.get('x-forwarded-host')?.split(',')[0]?.trim();
  const requestHost = forwardedHost || request.headers.get('host') || requestUrl.host;
  const originUrl = new URL(origin);
  if (originUrl.host !== requestHost) {
    const error = new Error('Cross-origin request rejected.');
    error.status = 403;
    throw error;
  }
}

export async function readJsonBody(request) {
  const contentLength = Number(request.headers.get('content-length') || 0);
  if (contentLength > MAX_AUTH_BODY_BYTES) {
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

export function validateRegistration(body) {
  const name = String(body.name || '').trim().replace(/\s+/g, ' ');
  const email = normalizeEmail(body.email);
  const password = String(body.password || '');
  const errors = {};

  if (name.length < 2 || name.length > 120) errors.name = 'Enter a valid full name.';
  if (!isValidEmail(email)) errors.email = 'Invalid email address.';
  if (password.length < 8 || password.length > 128) errors.password = 'Use a password between 8 and 128 characters.';

  return { name, email, password, errors };
}

export function validateLogin(body) {
  const email = normalizeEmail(body.email);
  const password = String(body.password || '');
  const errors = {};
  if (!isValidEmail(email)) errors.email = 'Invalid email address.';
  if (!password || password.length > 128) errors.password = 'Enter your password.';
  return { email, password, errors };
}

export function normalizeEmail(value) {
  return String(value || '').trim().toLowerCase();
}

function isValidEmail(email) {
  return email.length <= 254 && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

export function getDatabaseClient() {
  return databaseClientOverride || getDatabase();
}

export function setDatabaseClientForTests(client) {
  if (process.env.NODE_ENV === 'production') throw new Error('Database test adapter is unavailable in production.');
  databaseClientOverride = client;
}

export async function hashPassword(password) {
  return bcrypt.hash(password, 12);
}

export async function verifyPassword(password, hash) {
  try {
    return await bcrypt.compare(password, hash);
  } catch {
    return false;
  }
}

function getSessionSecret() {
  const secret = process.env.AUTH_SESSION_SECRET || '';
  if (secret.length < 32) throw new ConfigurationError('AUTH_SESSION_SECRET must contain at least 32 characters.');
  return secret;
}

function encode(value) {
  return Buffer.from(value).toString('base64url');
}

function signature(payload) {
  return createHmac('sha256', getSessionSecret()).update(payload).digest('base64url');
}

export function createSessionToken(user, now = Date.now()) {
  const payload = encode(JSON.stringify({
    id: Number(user.id),
    name: String(user.name),
    email: normalizeEmail(user.email),
    role: String(user.role || 'user'),
    is_premium: Number(user.is_premium) || 0,
    iat: Math.floor(now / 1000),
    exp: Math.floor(now / 1000) + SESSION_TTL_SECONDS
  }));
  return `${payload}.${signature(payload)}`;
}

export function verifySessionToken(token, now = Date.now()) {
  if (!token || !token.includes('.')) return null;
  const [payload, suppliedSignature] = token.split('.');
  if (!payload || !suppliedSignature) return null;

  let expectedSignature;
  try {
    expectedSignature = signature(payload);
  } catch (error) {
    if (error instanceof ConfigurationError) throw error;
    return null;
  }
  const expectedBuffer = Buffer.from(expectedSignature);
  const suppliedBuffer = Buffer.from(suppliedSignature);
  if (expectedBuffer.length !== suppliedBuffer.length || !timingSafeEqual(expectedBuffer, suppliedBuffer)) return null;

  try {
    const session = JSON.parse(Buffer.from(payload, 'base64url').toString('utf8'));
    if (!session.id || !session.exp || session.exp <= Math.floor(now / 1000)) return null;
    return session;
  } catch {
    return null;
  }
}

export function readSession(request) {
  const cookies = request.headers.get('cookie') || '';
  const value = cookies
    .split(';')
    .map(part => part.trim())
    .find(part => part.startsWith(`${SESSION_COOKIE}=`))
    ?.slice(SESSION_COOKIE.length + 1);
  return verifySessionToken(value ? decodeURIComponent(value) : '');
}

export function createSessionCookie(user, request) {
  const secure = new URL(request.url).protocol === 'https:' || process.env.CONTEXT === 'production';
  return [
    `${SESSION_COOKIE}=${encodeURIComponent(createSessionToken(user))}`,
    'Path=/',
    'HttpOnly',
    'SameSite=Lax',
    secure ? 'Secure' : '',
    `Max-Age=${SESSION_TTL_SECONDS}`
  ].filter(Boolean).join('; ');
}

export function clearSessionCookie(request) {
  const secure = new URL(request.url).protocol === 'https:' || process.env.CONTEXT === 'production';
  return [
    `${SESSION_COOKIE}=`,
    'Path=/',
    'HttpOnly',
    'SameSite=Lax',
    secure ? 'Secure' : '',
    'Max-Age=0'
  ].filter(Boolean).join('; ');
}

export function publicUser(user) {
  return {
    id: Number(user.id),
    name: String(user.name),
    email: normalizeEmail(user.email),
    role: String(user.role || 'user'),
    is_premium: Number(user.is_premium) || 0
  };
}

export function safeErrorResponse(error) {
  if (error?.status) return jsonResponse({ success: false, message: error.message }, error.status);
  if (error instanceof ConfigurationError || error instanceof MissingDatabaseConnectionError) {
    console.error('Authentication configuration error:', error.message);
    return jsonResponse({ success: false, message: 'The account service is not configured for this deployment.' }, 503);
  }
  console.error('Authentication backend error:', error);
  return jsonResponse({ success: false, message: 'Unable to connect to the authentication service.' }, 503);
}
