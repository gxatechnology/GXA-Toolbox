import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import handler from '../netlify/functions/admin-resources.mjs';
import { createAdminSessionToken } from '../netlify/functions/_admin-auth.mjs';
import { setDatabaseClientForTests } from '../netlify/functions/_database.mjs';
import { resourceQuery, resourceMutation, listNotifications, searchResources, mutateResource, SUPPORT_CAPABILITIES } from '../netlify/functions/_admin-resources.mjs';

const savedSecret = process.env.ADMIN_SESSION_SECRET;
process.env.ADMIN_SESSION_SECRET = 'admin-resources-isolated-contract-secret-not-production';
const session = { sub: 'gxa-administrator' };
const cookie = `gxa_admin_session=${createAdminSessionToken()}`;
const calls = [];
let failure = false, rateLimited = false, missing = false;
const row = { id: 'identity-contract', name: 'Contract User', email: 'contract@example.test', provider: 'email', status: 'active', created_at: '2026-01-01T00:00:00Z', last_login_at: null };
const sql = async (strings, ...values) => {
  const query = strings.join('?').replace(/\s+/gu, ' ').trim();
  calls.push({ query, values });
  if (failure) { const error = new Error('postgres://secret:password@private/connection'); error.code = '42P01'; throw error; }
  if (query.includes('INSERT INTO public.admin_rate_limits')) return rateLimited ? [] : [{ attempts: 1 }];
  if (query.startsWith('WITH changed') || query.startsWith('WITH existing')) return missing ? [] : [{ id: '7' }];
  if (query.includes('COUNT(*)::INTEGER AS total')) return [{ total: 41 }];
  if (query.includes('FROM public.file_jobs')) return [{ history_entries: 3, successful_jobs: 2, failed_jobs: 1, last_activity: '2026-01-01T00:00:00Z' }];
  if (query.includes('FROM public.user_profiles')) return missing ? [] : [row];
  if (query.includes('FROM public.support_message_notes')) return [{ id: 1, text: 'Internal test note', author: session.sub, created_at: '2026-01-01T00:00:00Z' }];
  if (query.includes('FROM public.support_messages')) return missing ? [] : [{ id: 7, name: 'Support contract', email: 'support@example.test', message: 'Private contract message', preview: 'Private contract message', status: 'new', is_read: false }];
  if (query.includes('FROM public.admin_audit_events')) return [{ id: 1, actor_subject: session.sub, action: 'mark_read', resource_type: 'support', resource_id: '7' }];
  throw new Error(`Unexpected contract query: ${query}`);
};
setDatabaseClientForTests({ sql });
const request = (params, body, headers = {}) => new Request(`https://gxatoolbox.in/.netlify/functions/admin-resources?${params}`, {
  method: body ? 'PATCH' : 'GET',
  headers: { Cookie: cookie, ...(body ? { Origin: 'https://gxatoolbox.in', 'Content-Type': 'application/json', 'X-GXA-Admin-Request': '1' } : {}), ...headers },
  ...(body ? { body: JSON.stringify(body) } : {})
});
try {
  for (const resource of ['users', 'support', 'notifications', 'audit', 'search']) {
    const before = calls.length;
    assert.equal((await handler(request(`resource=${resource}`, undefined, { Cookie: '' }))).status, 401);
    assert.equal(calls.length, before, 'Unauthorized requests must not query the database.');
  }
  assert.equal((await handler(new Request('https://gxatoolbox.in/.netlify/functions/admin-resources', { method: 'DELETE' }))).status, 405);
  for (const headers of [{ Origin: 'https://evil.example' }, { Origin: '' }, { Origin: 'http://gxatoolbox.in' }, { 'X-GXA-Admin-Request': '' }, { 'Sec-Fetch-Site': 'cross-site' }]) {
    const before = calls.length;
    assert.equal((await handler(request('', { resource: 'support', action: 'read', id: '7', is_read: true }, headers))).status, 403);
    assert.equal(calls.length, before, 'CSRF rejection must precede database access.');
  }
  for (const query of ['page=0', 'page=-1', 'page=10001', 'page_size=51', 'page=1.5', 'page_size=0', 'resource=users&status=admin', 'read=invalid', `q=${'x'.repeat(101)}`, 'resource=users&id=', 'resource=wat']) {
    assert.equal((await handler(request(query))).status, 400, query);
  }
  const search = resourceQuery(new URLSearchParams('resource=users&q=50%25_%5C&page=3&page_size=20'));
  assert.equal(search.pattern, '%50\\%\\_\\\\%');
  assert.equal(search.offset, 40);
  const listResponse = await handler(request('resource=users&page=3'));
  assert.equal(listResponse.status, 200);
  assert.equal(listResponse.headers.get('cache-control'), 'no-store');
  const list = await listResponse.json();
  assert.deepEqual(list.pagination, { page: 3, page_size: 20, total: 41, pages: 3 });
  assert.equal(list.capabilities.status_edit, true);
  assert.equal(list.capabilities.role_edit, false);
  assert.equal(list.rows[0].id, row.id);
  assert.equal('password_hash' in list.rows[0], false);
  const detail = await (await handler(request(`resource=users&id=${row.id}`))).json();
  assert.deepEqual(detail.item.usage, { history_entries: 3, successful_jobs: 2, failed_jobs: 1, last_activity: '2026-01-01T00:00:00Z' });
  assert.equal(calls.filter(call => call.query.includes('FROM public.file_jobs')).every(call => call.values.every(value => value === row.id)), true);
  const support = await (await handler(request('resource=support&id=7'))).json();
  assert.equal(support.item.message, 'Private contract message');
  assert.equal(support.item.notes[0].text, 'Internal test note');
  assert.equal(support.capabilities.email_reply, false);
  assert.equal(SUPPORT_CAPABILITIES.email_reply, false);
  assert.equal((await handler(request('', { resource: 'users', action: 'status', id: row.id, status: 'inactive' }))).status, 400);
  for (const body of [
    { resource: 'users', action: 'role', id: row.id, role: 'admin', confirm: true },
    { resource: 'support', action: 'status', id: '7', status: 'deleted' },
    { resource: 'support', action: 'note', id: '7', text: 'x'.repeat(2001) },
    { resource: 'support', action: 'note', id: '7', text: 'secret\u0000' },
    { resource: 'support', action: 'read', id: '7', is_read: 'true' },
    { resource: 'notifications', action: 'read', id: 'unknown:1', is_read: true },
    { resource: 'support', action: 'reply', id: '7', text: 'Do not fake email.' }
  ]) assert.equal((await handler(request('', body))).status, 400);
  const maliciousNote = "' ; DROP TABLE users; --";
  const note = resourceMutation({ resource: 'support', action: 'note', id: '7', text: maliciousNote });
  await mutateResource(sql, session, note);
  const insertion = calls.at(-1);
  assert.equal(insertion.query.includes(maliciousNote), false, 'Notes must be bound parameters.');
  assert.ok(insertion.values.includes(maliciousNote));
  assert.match(insertion.query, /WITH changed.*INSERT INTO public\.admin_audit_events.*EXISTS/u, 'Note and audit must be atomic.');
  const operations = [
    { resource: 'users', action: 'status', id: row.id, status: 'inactive', confirm: true },
    { resource: 'users', action: 'status', id: row.id, status: 'active', confirm: true },
    { resource: 'support', action: 'status', id: '7', status: 'in_progress' },
    { resource: 'support', action: 'status', id: '7', status: 'resolved' },
    { resource: 'support', action: 'read', id: '7', is_read: true },
    { resource: 'support', action: 'read', id: '7', is_read: false },
    { resource: 'support', action: 'note', id: '7', text: 'Verified private note.' },
    { resource: 'notifications', action: 'read', id: 'system:9', is_read: true }
  ];
  for (const operation of operations) {
    assert.equal((await handler(request('', operation))).status, 200, JSON.stringify(operation));
    const lastMutation = calls.filter(call => call.query.startsWith('WITH changed') || call.query.startsWith('WITH existing')).at(-1);
    assert.match(lastMutation.query, /INSERT INTO public\.admin_audit_events/u);
    assert.ok(lastMutation.values.includes(session.sub));
  }
  rateLimited = true;
  assert.equal((await handler(request('', operations[0]))).status, 429);
  rateLimited = false;
  missing = true;
  assert.equal((await handler(request('resource=users&id=missing'))).status, 404);
  assert.equal((await handler(request('', operations[2]))).status, 404);
  missing = false;
  failure = true;
  const error = await handler(request('resource=users'));
  assert.equal(error.status, 503);
  assert.doesNotMatch(await error.text(), /postgres|password|secret|stack|private\/connection/u);
  failure = false;
  const searchResult = await searchResources(sql, session, resourceQuery(new URLSearchParams('resource=search&q=PDF')));
  assert.ok(searchResult.groups.tools.length > 0 && searchResult.groups.tools.length <= 5);
  assert.equal(searchResult.groups.tools.every(tool => /^\/[a-z0-9-]+$/u.test(tool.href)), true);
  const shortSearch = await searchResources(sql, session, resourceQuery(new URLSearchParams('resource=search&q=p')));
  assert.deepEqual(shortSearch.groups, { tools: [], users: [], support: [] });
  const notificationSql = async (strings, ...values) => {
    assert.ok(values.includes(session.sub));
    return [{ type: 'support', id: 7, title: 'Support message received', summary: 'new', created_at: '2026-01-01T00:00:00Z', is_read: false, total: 1 }];
  };
  const notifications = await listNotifications(notificationSql, session, resourceQuery(new URLSearchParams('resource=notifications')));
  assert.equal(notifications.rows[0].id, 'support:7');
  assert.deepEqual(notifications.rows[0].target, { section: 'support', id: '7' });
  assert.equal('email' in notifications.rows[0], false);
  const migration = await readFile(new URL('../netlify/database/migrations/0007_admin_resource_workflows.sql', import.meta.url), 'utf8');
  assert.match(migration, /CREATE TABLE IF NOT EXISTS public\.admin_resource_reads/u);
  assert.match(migration, /PRIMARY KEY \(actor_subject, resource_type, resource_id\)/u);
  assert.match(migration, /REFERENCES public\.support_messages\(id\) ON DELETE RESTRICT/u);
  assert.doesNotMatch(migration, /DROP TABLE|TRUNCATE|DELETE FROM|INSERT INTO public\.(?:users|user_profiles|support_messages)/u);
  console.log('Admin resource contracts passed: authorization, CSRF, pagination, literal search, details, confirmed status changes, inbox notes/status/read, real notifications, rate limits, atomic audits, and sanitized errors. No production database used.');
} finally {
  setDatabaseClientForTests(undefined);
  if (savedSecret === undefined) delete process.env.ADMIN_SESSION_SECRET; else process.env.ADMIN_SESSION_SECRET = savedSecret;
}
