import {
  getDatabaseClient,
  MissingDatabaseConnectionError,
  setDatabaseClientForTests
} from './_database.mjs';

export const SESSION_COOKIE = 'gxa_toolbox_session';
const MAX_AUTH_BODY_BYTES = 8 * 1024;

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

export { getDatabaseClient, setDatabaseClientForTests };

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

export function safeErrorResponse(error) {
  if (error?.status) return jsonResponse({ success: false, message: error.message }, error.status);
  if (error instanceof MissingDatabaseConnectionError) {
    console.error('Authentication configuration error:', error.message);
    return jsonResponse({ success: false, message: 'The account service is not configured for this deployment.' }, 503);
  }
  console.error('Authentication backend error:', error?.code || error?.name || 'unknown');
  return jsonResponse({ success: false, message: 'Unable to connect to the authentication service.' }, 503);
}
