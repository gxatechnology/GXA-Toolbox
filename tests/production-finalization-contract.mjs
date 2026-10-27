import assert from 'node:assert/strict';
import { readFile, readdir, stat } from 'node:fs/promises';
import { join, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const projectRoot = resolve(fileURLToPath(new URL('..', import.meta.url)));
const read = path => readFile(join(projectRoot, path), 'utf8');

const migrations = (await readdir(join(projectRoot, 'netlify', 'database', 'migrations'))).filter(name => name.endsWith('.sql')).sort();
const expectedMigrations = [
  '0001_create_auth_schema.sql',
  '0002_repair_auth_schema_after_site_reconnect.sql',
  '0003_create_admin_analytics_schema.sql',
  '0004_link_netlify_identity_profiles.sql',
  '0005_create_support_messages.sql',
  '0006_admin_accounts.sql',
  '0007_admin_resource_workflows.sql'
];
if (migrations.includes('0008_recover_expected_application_schema.sql')) {
  expectedMigrations.push('0008_recover_expected_application_schema.sql');
}
if (migrations.includes('0009_create_tool_ratings.sql')) {
  expectedMigrations.push('0009_create_tool_ratings.sql');
}
assert.deepEqual(migrations, expectedMigrations);
for (const migration of migrations) {
  const sql = await read(`netlify/database/migrations/${migration}`);
  assert.doesNotMatch(sql.replace(/^--.*$/gm, ''), /\b(?:DROP\s+(?:TABLE|SCHEMA|DATABASE)|TRUNCATE\s+TABLE|DELETE\s+FROM)\b/i, `${migration} contains a destructive data operation.`);
}

const [database, auth, identity, adminData, integrations, adsterraReporting, googleAuth, analytics, generator, netlify, rootHeaders, rootRedirects, distHeaders, distRedirects] = await Promise.all([
  read('netlify/functions/_database.mjs'), read('netlify/functions/_auth.mjs'), read('netlify/functions/_identity-profile.mjs'),
  read('netlify/functions/admin-data.mjs'), read('netlify/functions/_admin-integrations.mjs'), read('netlify/functions/_adsterra-reporting.mjs'), read('netlify/functions/_google-auth.mjs'),
  read('public_html/assets/gxa-analytics.js'), read('scripts/generate-seo-site.mjs'), read('netlify.toml'), read('_headers'), read('_redirects'),
  read('dist/_headers'), read('dist/_redirects')
]);
assert.match(database, /getDatabase\(\)/);
assert.match(database, /recordSystemEvent/);
assert.doesNotMatch(auth, /from ['"]@netlify\/database['"]/);
assert.match(auth, /from ['"]\.\/_database\.mjs['"]/);
assert.match(identity, /provider/);
assert.match(adminData, /loadAdminIntegrations/);
for (const value of ['GA4_PROPERTY_ID', 'SEARCH_CONSOLE_SITE_URL', 'ADSENSE_ACCOUNT_ID', 'GOOGLE_SERVICE_ACCOUNT_JSON', 'GOOGLE_ADSENSE_OAUTH_CLIENT_ID', 'GOOGLE_ADSENSE_OAUTH_CLIENT_SECRET', 'GOOGLE_ADSENSE_REFRESH_TOKEN']) assert.ok(integrations.includes(value) || googleAuth.includes(value), `Reporting configuration is missing ${value}.`);
for (const endpoint of ['analyticsdata.googleapis.com', 'www.googleapis.com/webmasters/v3', 'adsense.googleapis.com/v2']) assert.ok(integrations.includes(endpoint), `Reporting adapter is missing ${endpoint}.`);
assert.match(adsterraReporting, /api3\.adsterratools\.com\/publisher\/stats\.json/);
assert.match(adsterraReporting, /ADSTERRA_API_TOKEN/);
assert.match(adsterraReporting, /X-API-Key/);
assert.match(analytics, /DEDUPE_WINDOW_MS/);
assert.match(generator, /'_headers', '_redirects'/);
assert.equal(distHeaders, rootHeaders, 'The production build must preserve the authoritative Netlify headers file byte-for-byte.');
assert.equal(distRedirects, rootRedirects, 'The production build must preserve the authoritative Netlify redirects file byte-for-byte.');
assert.match(netlify, /Permissions-Policy\s*=\s*"camera=\(self\), microphone=\(\), geolocation=\(self\), payment=\(\), usb=\(\)"/);
assert.match(distHeaders, /^\/\*/m);
assert.match(distHeaders, /X-Content-Type-Options: nosniff/);
assert.match(distHeaders, /X-Robots-Tag: noindex, nofollow, noarchive/);
assert.match(distRedirects, /^\/api\/tool-event \/\.netlify\/functions\/tool-event 200$/m);
assert.match(distRedirects, /^\/api\/tool-ratings \/\.netlify\/functions\/tool-ratings 200$/m);

async function filesUnder(directory) {
  const paths = [];
  for (const entry of await readdir(directory, { withFileTypes: true })) {
    const path = join(directory, entry.name);
    if (entry.isDirectory()) paths.push(...await filesUnder(path));
    else paths.push(path);
  }
  return paths;
}

const publicFiles = (await filesUnder(join(projectRoot, 'dist'))).filter(path => !/\.(?:png|wasm|onnx|woff2?)$/i.test(path));
const forbiddenPublicTokens = [
  'GOOGLE_SERVICE_ACCOUNT_JSON', 'GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY', 'GOOGLE_ADSENSE_OAUTH_CLIENT_SECRET', 'GOOGLE_ADSENSE_REFRESH_TOKEN', 'ADSTERRA_API_TOKEN',
  'AUTH_SESSION_SECRET', 'ADMIN_SESSION_SECRET', 'GXA_ADMIN_EMAIL', 'GXA_ADMIN_PASSWORD', 'NETLIFY_DATABASE_URL', 'BEGIN PRIVATE KEY'
];
for (const path of publicFiles) {
  const source = await readFile(path, 'utf8');
  for (const token of forbiddenPublicTokens) assert.ok(!source.includes(token), `${relative(projectRoot, path)} exposes server-only configuration ${token}.`);
}
await assert.rejects(
  stat(join(projectRoot, 'public_html', 'api', 'hash.php')),
  error => error?.code === 'ENOENT',
  'A password-hashing utility must not be published under public_html/api.'
);
for (const path of await filesUnder(join(projectRoot, 'netlify', 'functions'))) {
  if (!(await stat(path)).isFile() || !path.endsWith('.mjs')) continue;
  const source = await readFile(path, 'utf8');
  assert.doesNotMatch(source, /-----BEGIN (?:RSA )?PRIVATE KEY-----/i, `${relative(projectRoot, path)} contains a private key.`);
  assert.doesNotMatch(source, /AIza[0-9A-Za-z_-]{30,}/, `${relative(projectRoot, path)} contains a Google API key.`);
}

console.log('Production finalization contract passed: ordered migrations, shared database runtime, real server reporting adapters, published Netlify controls, and public secret boundaries are intact.');
