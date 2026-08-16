import assert from 'node:assert/strict';
import { readFile, stat } from 'node:fs/promises';
import { setDatabaseClientForTests } from '../netlify/functions/_auth.mjs';
import { setIdentityUserProviderForTests } from '../netlify/functions/_identity-profile.mjs';
import historyHandler from '../netlify/functions/auth-history.mjs';
import loginHandler from '../netlify/functions/auth-login.mjs';
import logoutHandler from '../netlify/functions/auth-logout.mjs';
import registerHandler from '../netlify/functions/auth-register.mjs';
import saveJobHandler from '../netlify/functions/auth-save-job.mjs';
import sessionHandler from '../netlify/functions/auth-session.mjs';

const read = path => readFile(new URL(`../${path}`, import.meta.url), 'utf8');
const [netlifyConfig, redirects, client, styles, migration, packageJson, identityBridge, identityProfile, adminAuth] = await Promise.all([
  read('netlify.toml'),
  read('_redirects'),
  read('public_html/assets/app.js'),
  read('public_html/assets/style.css'),
  read('netlify/database/migrations/0004_link_netlify_identity_profiles.sql'),
  read('package.json'),
  read('src/identity-client.js'),
  read('netlify/functions/_identity-profile.mjs'),
  read('netlify/functions/_admin-auth.mjs')
]);

assert.match(packageJson, /"@netlify\/identity"/);
assert.match(packageJson, /"build:identity"/);
assert.ok((await stat(new URL('../public_html/assets/identity-client.js', import.meta.url))).isFile(), 'Identity browser bundle was not generated.');
for (const api of ['acceptInvite', 'getUser', 'handleAuthCallback', 'login', 'logout', 'oauthLogin', 'onAuthChange', 'requestPasswordRecovery', 'signup', 'updateUser']) {
  assert.match(identityBridge, new RegExp(`\\b${api}\\b`), `Identity bridge is missing ${api}.`);
}
assert.match(client, /oauthLogin\('google'\)/);
assert.match(client, /identity\.signup\(email, password, \{ full_name: signupName \}\)/);
assert.match(client, /identity\.login\(email, password\)/);
assert.match(client, /requestPasswordRecovery\(email\)/);
assert.match(client, /updateUser\(\{ password \}\)/);
assert.match(client, /acceptInvite\(pendingIdentityInviteToken, password\)/);
assert.match(client, /handleAuthCallback\(\)/);
assert.match(client, /identity\.getUser\(\)/);
assert.match(client, /window\.GxaIdentity\.logout\(\)/);
assert.doesNotMatch(client, /fetch\((?:endpoint|'\/api\/login\.php'|'\/api\/register\.php')/);
assert.match(client, /placeholder="Tauqeer Ashraf"/);
assert.match(client, /placeholder="tauqeer@gxatechnologies\.com"/);
assert.doesNotMatch(client, /value="Tauqeer Ashraf"/);
assert.match(client, /Continue with Google/);
assert.match(client, /Forgot password\?/);
assert.match(client, /clearSensitiveIdentityCallbackHash\(\)/);
assert.match(client, /if \(identityProfileHydrationPromise\) return identityProfileHydrationPromise/);
assert.match(client, /Dashboard \/ My Account/);
assert.match(client, /class="mobile-nav-account"/);
assert.match(identityBridge, /window\.location\.href !== currentLocation/);

for (const route of ['register', 'login', 'session', 'logout', 'get-history', 'save-job']) {
  assert.match(netlifyConfig, new RegExp(`/api/${route}\\.php`), `Netlify ${route} compatibility route is missing.`);
  assert.match(redirects, new RegExp(`/api/${route}\\.php /.netlify/functions/[^ ]+ 200`));
}
assert.match(identityProfile, /getUser as getNetlifyIdentityUser/);
assert.match(identityProfile, /ON CONFLICT \(identity_user_id\) DO UPDATE/);
assert.match(adminAuth, /ADMIN_SESSION_COOKIE/);
assert.doesNotMatch(adminAuth, /@netlify\/identity/, 'Admin authentication must remain separate from Netlify Identity.');

for (const token of [
  'CREATE TABLE IF NOT EXISTS public.user_profiles',
  'identity_user_id TEXT PRIMARY KEY',
  'legacy_user_id BIGINT UNIQUE',
  'CONSTRAINT user_profiles_legacy_user_fk',
  'ADD COLUMN IF NOT EXISTS identity_user_id TEXT',
  'CONSTRAINT file_jobs_identity_user_fk',
  'REFERENCES public.user_profiles (identity_user_id)',
  'CREATE INDEX IF NOT EXISTS file_jobs_identity_user_created_idx',
  'CREATE TRIGGER user_profiles_set_updated_at'
]) assert.ok(migration.includes(token), `Identity profile migration is missing: ${token}`);
assert.doesNotMatch(migration, /DROP\s+(?:TABLE|SCHEMA|DATABASE)/i);
assert.doesNotMatch(migration, /password_hash|password\s+(?:text|varchar)|INSERT\s+INTO\s+public\.users/i);

const profiles = new Map();
const jobs = [];
const normalizeStatement = strings => strings.join('$value').replace(/\s+/g, ' ').trim();
setDatabaseClientForTests({
  sql: async (strings, ...values) => {
    const statement = normalizeStatement(strings);
    if (statement.startsWith('INSERT INTO public.user_profiles')) {
      const existing = profiles.get(values[0]) || { is_premium: false, status: 'active' };
      const profile = { ...existing, id: values[0], email: values[2], name: values[3], provider: values[4], status: 'active' };
      profiles.set(values[0], profile);
      return [profile];
    }
    if (statement.startsWith('INSERT INTO public.file_jobs')) {
      const record = {
        id: jobs.length + 1,
        identity_user_id: values[0],
        tool_name: values[1],
        original_file: values[2],
        output_file: values[3],
        status: values[4],
        size_mb: Number(values[5]),
        metadata: JSON.parse(values[7])
      };
      jobs.push(record);
      return [{ id: record.id }];
    }
    if (statement.startsWith('SELECT COUNT(*)::INTEGER AS processed_count')) {
      return [{ processed_count: jobs.filter(job => job.identity_user_id === values[0] && job.status === 'done').length }];
    }
    if (statement.startsWith('SELECT id, original_file AS name')) {
      return jobs.filter(job => job.identity_user_id === values[0]).map(job => ({
        id: job.id, name: job.original_file, tool: job.tool_name, date: '2026-08-16', size: `${job.size_mb} MB`, status: job.status
      }));
    }
    throw new Error(`Unexpected Identity profile query: ${statement}`);
  }
});

let currentIdentityUser = null;
setIdentityUserProviderForTests(async () => currentIdentityUser);
const unauthenticatedSession = await sessionHandler(new Request('https://gxatoolbox.in/api/session.php'));
assert.deepEqual(await unauthenticatedSession.json(), { success: true, authenticated: false, user: null });

currentIdentityUser = {
  id: 'identity-subject-123',
  email: 'person@example.com',
  provider: 'google',
  userMetadata: { full_name: 'Identity User' }
};
const sessionResponse = await sessionHandler(new Request('https://gxatoolbox.in/api/session.php'));
const session = await sessionResponse.json();
assert.equal(session.authenticated, true);
assert.equal(session.user.id, 'identity-subject-123');
assert.equal(session.user.name, 'Identity User');
assert.equal(session.user.role, 'user');

const post = (path, body) => new Request(`https://gxatoolbox.in${path}`, {
  method: 'POST',
  headers: { 'Content-Type': 'application/json', Origin: 'https://gxatoolbox.in' },
  body: JSON.stringify(body)
});
const saveResponse = await saveJobHandler(post('/api/save-job.php', {
  tool_name: 'Crop Image', original_file: 'before.png', output_file: 'after.png', status: 'done', size: 1.25, metadata: { format: 'png' }
}));
assert.equal(saveResponse.status, 201);
assert.equal(jobs[0].identity_user_id, 'identity-subject-123');
assert.equal(jobs[0].user_id, undefined, 'New jobs must not use a legacy numeric user ID.');

const historyResponse = await historyHandler(new Request('https://gxatoolbox.in/api/get-history.php'));
const history = await historyResponse.json();
assert.equal(history.processedCount, 1);
assert.equal(history.history[0].name, 'before.png');

currentIdentityUser = null;
assert.equal((await saveJobHandler(post('/api/save-job.php', { tool_name: 'Crop Image' }))).status, 401);
assert.equal((await historyHandler(new Request('https://gxatoolbox.in/api/get-history.php'))).status, 401);

assert.equal((await registerHandler(post('/api/register.php', {}))).status, 410);
assert.equal((await loginHandler(post('/api/login.php', {}))).status, 410);
const retiredLogout = await logoutHandler(post('/api/logout.php', {}));
assert.equal(retiredLogout.status, 410);
assert.match(retiredLogout.headers.get('set-cookie'), /Max-Age=0/);

assert.match(styles, /max-height: min\(780px, calc\(100dvh - 32px\)\)/);
assert.match(styles, /\.auth-form \{[^}]*overflow-y: auto/);
assert.match(styles, /\.auth-provider-button/);
assert.match(styles, /\.auth-modal-card \.modal-close \{[^}]*width: 44px; height: 44px/);
assert.match(styles, /\.account-menu-popover/);
assert.match(styles, /\.mobile-nav-account \{[^}]*display: grid/);
assert.match(styles, /\.nav-actions > \.account-menu,[\s\S]*\.nav-actions > \.auth-loading-indicator \{ display: none; \}/);

console.log('Authentication contract passed: Netlify Identity custom UI, Google/email/recovery/invite hooks, deterministic profile hydration, subject-linked history, account menus, retired legacy endpoints, separate admin auth, and mobile modal behavior.');
