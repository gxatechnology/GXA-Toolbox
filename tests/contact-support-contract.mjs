import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

process.env.NODE_ENV = 'test';
const projectRoot = resolve(fileURLToPath(new URL('..', import.meta.url)));
const [{ default: contactHandler }, { setDatabaseClientForTests }] = await Promise.all([
  import('../netlify/functions/contact-support.mjs'),
  import('../netlify/functions/_database.mjs')
]);

const normalize = strings => strings.join('$value').replace(/\s+/g, ' ').trim();
let storedReference = null;
setDatabaseClientForTests({
  sql: async strings => {
    const statement = normalize(strings);
    if (statement.startsWith('INSERT INTO public.support_messages')) {
      if (storedReference) return [];
      storedReference = 42;
      return [{ id: storedReference }];
    }
    if (statement.startsWith('SELECT id FROM public.support_messages')) return [{ id: storedReference }];
    if (statement.startsWith('INSERT INTO public.system_events')) return [];
    throw new Error(`Unexpected Contact Support query: ${statement}`);
  }
});

const request = (body, headers = {}) => new Request('https://gxatoolbox.in/api/contact.php', {
  method: 'POST',
  headers: { Origin: 'https://gxatoolbox.in', 'Content-Type': 'application/json', ...headers },
  body: JSON.stringify(body)
});

assert.equal((await contactHandler(new Request('https://gxatoolbox.in/api/contact.php'))).status, 405);
assert.equal((await contactHandler(new Request('https://gxatoolbox.in/api/contact.php', {
  method: 'POST', headers: { 'Content-Type': 'application/json' }, body: '{}'
}))).status, 403);
assert.equal((await contactHandler(request({ name: 'A', email: 'invalid', message: 'short' }))).status, 400);
assert.equal((await contactHandler(request({ name: 'Contact User', email: 'invalid', message: 'A sufficiently detailed message.' }))).status, 400);

const payload = { name: 'Contact User', email: 'CONTACT@EXAMPLE.TEST', message: 'I need help with a genuine tool workflow.' };
const createdResponse = await contactHandler(request(payload));
assert.equal(createdResponse.status, 201);
assert.deepEqual(await createdResponse.json(), {
  success: true,
  message: 'Message sent successfully.',
  reference_id: '42',
  duplicate: false
});
const duplicateResponse = await contactHandler(request(payload));
assert.equal(duplicateResponse.status, 200);
assert.equal((await duplicateResponse.json()).duplicate, true);

setDatabaseClientForTests({ sql: async () => { throw Object.assign(new Error('private database detail'), { code: 'XX000' }); } });
const originalConsoleError = console.error;
console.error = () => {};
const failureResponse = await contactHandler(request({ name: 'Contact User', email: 'contact@example.test', message: 'Another genuine support request.' }));
console.error = originalConsoleError;
assert.equal(failureResponse.status, 503);
assert.doesNotMatch(JSON.stringify(await failureResponse.json()), /private database detail|XX000/);

const [app, migration, netlify, redirects, adminData, adminHtml] = await Promise.all([
  readFile(join(projectRoot, 'public_html/assets/app.js'), 'utf8'),
  readFile(join(projectRoot, 'netlify/database/migrations/0005_create_support_messages.sql'), 'utf8'),
  readFile(join(projectRoot, 'netlify.toml'), 'utf8'),
  readFile(join(projectRoot, '_redirects'), 'utf8'),
  readFile(join(projectRoot, 'netlify/functions/admin-data.mjs'), 'utf8'),
  readFile(join(projectRoot, 'public_html/admin/index.html'), 'utf8')
]);
assert.match(netlify, /from\s*=\s*"\/api\/contact\.php"[\s\S]*to\s*=\s*"\/\.netlify\/functions\/contact-support"/);
assert.match(redirects, /^\/api\/contact\.php \/\.netlify\/functions\/contact-support 200$/m);
assert.match(migration, /CREATE TABLE IF NOT EXISTS public\.support_messages/);
assert.match(migration, /status IN \('new', 'in_progress', 'resolved'\)/);
assert.doesNotMatch(migration.replace(/^--.*$/gm, ''), /\b(?:DROP\s+(?:TABLE|SCHEMA|DATABASE)|TRUNCATE\s+TABLE|DELETE\s+FROM)\b/i);
assert.match(adminData, /FROM public\.support_messages/);
assert.match(adminHtml, /data-section="support"[\s\S]*Support Messages/);
assert.match(app, /onsubmit="submitContact\(event\)"/);
assert.match(app, /contactSubmissionInFlight/);
assert.match(app, /aria-live="polite"/);
assert.match(app, /Message sent successfully\./);
assert.doesNotMatch(app, /Loading settings panel\.\.\./);
for (const label of ['English', 'Deutsch', 'Español', 'Français', 'हिन्दी', 'العربية']) assert.ok(app.includes(label), `Language selector is missing ${label}.`);
for (const corrupt of ['EspaÃ±ol', 'FranÃ§ais', 'Ø§Ù']) assert.ok(!app.includes(corrupt), `Mojibake remains: ${corrupt}`);

console.log('Contact Support contract passed: validated same-origin persistence, real references, duplicate protection, protected admin visibility, and UTF-8 UI labels.');
