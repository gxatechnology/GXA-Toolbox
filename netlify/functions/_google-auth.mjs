import { createHash, sign } from 'node:crypto';

const TOKEN_ENDPOINT = 'https://oauth2.googleapis.com/token';
const REQUEST_TIMEOUT_MS = 10_000;
const tokenCache = new Map();
let serviceAccountCredentialsCache;

export class GoogleIntegrationError extends Error {
  constructor(message, state = 'api_error', status = 0) {
    super(message);
    this.name = 'GoogleIntegrationError';
    this.state = state;
    this.status = status;
  }
}

function required(env, names) {
  const missing = names.filter(name => !String(env[name] || '').trim());
  if (missing.length) throw new GoogleIntegrationError('Server-side reporting configuration is incomplete.', 'configuration_required');
}

function classifyStatus(status) {
  return status === 401 || status === 403 ? 'permission_required' : 'api_error';
}

function normalizeServiceAccountCredentials(credentials) {
  if (!credentials || typeof credentials !== 'object' || Array.isArray(credentials)) {
    throw new GoogleIntegrationError('The service-account JSON is invalid.', 'configuration_required');
  }
  const clientEmail = String(credentials.client_email || '').trim();
  const privateKey = String(credentials.private_key || '').replace(/\\n/g, '\n').trim();
  if (!clientEmail) throw new GoogleIntegrationError('The service-account JSON is missing client_email.', 'configuration_required');
  if (!privateKey) throw new GoogleIntegrationError('The service-account JSON is missing private_key.', 'configuration_required');
  return { client_email: clientEmail, private_key: privateKey, project_id: String(credentials.project_id || '').trim() || null };
}

export function getGoogleServiceAccountCredentials(options = {}) {
  const env = options.env || process.env;
  const rawJson = String(env.GOOGLE_SERVICE_ACCOUNT_JSON || '').trim();
  if (rawJson) {
    const fingerprint = createHash('sha256').update(rawJson).digest('base64url');
    if (serviceAccountCredentialsCache?.fingerprint === fingerprint) return serviceAccountCredentialsCache.credentials;
    let parsed;
    try {
      parsed = JSON.parse(rawJson);
    } catch {
      throw new GoogleIntegrationError('The service-account JSON could not be parsed.', 'configuration_required');
    }
    const credentials = Object.freeze(normalizeServiceAccountCredentials(parsed));
    serviceAccountCredentialsCache = { fingerprint, credentials };
    return credentials;
  }

  // Retain compatibility with older deployments while making the single JSON
  // variable the production source of truth.
  const legacyEmail = String(env.GOOGLE_SERVICE_ACCOUNT_EMAIL || '').trim();
  const legacyPrivateKey = String(env.GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY || '').trim();
  if (legacyEmail || legacyPrivateKey) {
    return normalizeServiceAccountCredentials({ client_email: legacyEmail, private_key: legacyPrivateKey });
  }
  throw new GoogleIntegrationError('Server-side reporting configuration is incomplete.', 'configuration_required');
}

async function tokenRequest(body, fetchImpl) {
  let response;
  try {
    response = await fetchImpl(TOKEN_ENDPOINT, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams(body),
      signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS)
    });
  } catch {
    throw new GoogleIntegrationError('Google authorization could not be reached.');
  }
  if (!response.ok) throw new GoogleIntegrationError('Google authorization rejected the configured credentials.', classifyStatus(response.status), response.status);
  const payload = await response.json();
  if (!payload?.access_token) throw new GoogleIntegrationError('Google authorization returned no access token.');
  return payload;
}

export async function getServiceAccountAccessToken(scopes, options = {}) {
  const env = options.env || process.env;
  const fetchImpl = options.fetchImpl || fetch;
  const credentials = getGoogleServiceAccountCredentials({ env });
  const email = credentials.client_email;
  const scope = [...new Set(scopes)].sort().join(' ');
  const cacheKey = `service:${email}:${scope}`;
  const cached = tokenCache.get(cacheKey);
  if (cached?.expiresAt > Date.now() + 60_000) return cached.token;

  const now = Math.floor(Date.now() / 1000);
  const header = Buffer.from(JSON.stringify({ alg: 'RS256', typ: 'JWT' })).toString('base64url');
  const claim = Buffer.from(JSON.stringify({ iss: email, scope, aud: TOKEN_ENDPOINT, iat: now, exp: now + 3600 })).toString('base64url');
  const unsigned = `${header}.${claim}`;
  let signature;
  try {
    signature = sign('RSA-SHA256', Buffer.from(unsigned), credentials.private_key).toString('base64url');
  } catch {
    throw new GoogleIntegrationError('The service-account private key is invalid.', 'configuration_required');
  }
  const payload = await tokenRequest({
    grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer',
    assertion: `${unsigned}.${signature}`
  }, fetchImpl);
  tokenCache.set(cacheKey, { token: payload.access_token, expiresAt: Date.now() + (Number(payload.expires_in || 3600) * 1000) });
  return payload.access_token;
}

export async function getRefreshTokenAccessToken(options = {}) {
  const env = options.env || process.env;
  const fetchImpl = options.fetchImpl || fetch;
  required(env, ['GOOGLE_ADSENSE_OAUTH_CLIENT_ID', 'GOOGLE_ADSENSE_OAUTH_CLIENT_SECRET', 'GOOGLE_ADSENSE_REFRESH_TOKEN']);
  const cacheKey = `oauth:${String(env.GOOGLE_ADSENSE_OAUTH_CLIENT_ID).trim()}`;
  const cached = tokenCache.get(cacheKey);
  if (cached?.expiresAt > Date.now() + 60_000) return cached.token;
  const payload = await tokenRequest({
    client_id: String(env.GOOGLE_ADSENSE_OAUTH_CLIENT_ID).trim(),
    client_secret: String(env.GOOGLE_ADSENSE_OAUTH_CLIENT_SECRET).trim(),
    refresh_token: String(env.GOOGLE_ADSENSE_REFRESH_TOKEN).trim(),
    grant_type: 'refresh_token'
  }, fetchImpl);
  tokenCache.set(cacheKey, { token: payload.access_token, expiresAt: Date.now() + (Number(payload.expires_in || 3600) * 1000) });
  return payload.access_token;
}

export function resetGoogleTokenCacheForTests() {
  if (process.env.NODE_ENV === 'production') throw new Error('Google token test adapter is unavailable in production.');
  tokenCache.clear();
  serviceAccountCredentialsCache = undefined;
}
