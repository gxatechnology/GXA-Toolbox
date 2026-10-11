import { ADMIN_PRODUCT_SNAPSHOT } from './_admin-product-snapshot.mjs';

export const USER_CAPABILITIES = Object.freeze({ status_edit: true, role_edit: false, reason: 'Status controls access to GXA account APIs. Identity credentials and provider sessions are managed separately by Netlify Identity.' });
export const SUPPORT_CAPABILITIES = Object.freeze({ email_reply: false, notes: true, statuses: ['new', 'in_progress', 'resolved'], reason: 'Outgoing support email is not configured. Internal notes are private and do not send email.' });

function invalid(message) { const error = new Error(message); error.status = 400; error.adminResourceValidation = true; throw error; }
export function resourceId(value, identity = false) {
  if (typeof value !== 'string' && typeof value !== 'number') invalid('A valid resource ID is required.');
  const id = String(value).trim();
  if (identity ? !id || id.length > 128 || /[\u0000-\u001f\u007f]/u.test(id) : !/^[1-9]\d{0,17}$/u.test(id)) invalid('A valid resource ID is required.');
  return id;
}
export function resourceQuery(params) {
  const resource = params.get('resource') || 'users';
  if (!['users', 'support', 'notifications', 'audit', 'search'].includes(resource)) invalid('Unknown administrator resource.');
  const integer = (key, fallback, max) => {
    const raw = params.get(key);
    if (raw === null) return fallback;
    if (!/^\d+$/u.test(raw) || Number(raw) < 1 || Number(raw) > max) invalid(`Invalid ${key}.`);
    return Number(raw);
  };
  const q = (params.get('q') || '').trim();
  if (q.length > 100 || /[\u0000-\u001f\u007f]/u.test(q)) invalid('Search must contain at most 100 printable characters.');
  const status = params.get('status') || '';
  const statuses = resource === 'users' ? ['active', 'inactive'] : resource === 'support' ? SUPPORT_CAPABILITIES.statuses : [];
  if (status && !statuses.includes(status)) invalid('Invalid status filter.');
  const read = params.get('read') || 'all';
  if (!['all', 'read', 'unread'].includes(read)) invalid('Invalid read filter.');
  const page = integer('page', 1, 10000), pageSize = integer('page_size', 20, 50);
  // Escape LIKE wildcards: a user's search is literal, never an SQL pattern.
  const pattern = `%${q.replace(/[\\%_]/gu, '\\$&')}%`;
  return { resource, q, pattern, status, read, page, pageSize, offset: (page - 1) * pageSize, id: params.has('id') ? resourceId(params.get('id'), resource === 'users') : null };
}
function pagination(query, total) { return { page: query.page, page_size: query.pageSize, total: Number(total) || 0, pages: Math.ceil((Number(total) || 0) / query.pageSize) }; }
function text(value) { return String(value ?? ''); }
function count(value) { return Number(value) || 0; }
function userRow(row) { return { id: text(row.id), name: row.name, email: row.email, provider: row.provider, status: row.status, created_at: row.created_at, last_login_at: row.last_login_at, role: 'user' }; }
function supportRow(row) { return { id: text(row.id), name: row.name, email: row.email, preview: text(row.preview), status: row.status, created_at: row.created_at, updated_at: row.updated_at, is_read: !!row.is_read }; }

export async function loadUser(sql, id) {
  const rows = await sql`SELECT identity_user_id AS id, full_name AS name, email, provider, status, created_at, last_login_at
    FROM public.user_profiles WHERE identity_user_id = ${id} LIMIT 1`;
  if (!rows[0]) return null;
  const usage = await sql`SELECT COUNT(*)::INTEGER AS history_entries,
    COUNT(*) FILTER (WHERE status = 'done')::INTEGER AS successful_jobs,
    COUNT(*) FILTER (WHERE status = 'failed')::INTEGER AS failed_jobs, MAX(created_at) AS last_activity
    FROM public.file_jobs WHERE identity_user_id = ${id}
      OR user_id = (SELECT legacy_user_id FROM public.user_profiles WHERE identity_user_id = ${id})`;
  return { ...userRow(rows[0]), usage: { history_entries: count(usage[0]?.history_entries), successful_jobs: count(usage[0]?.successful_jobs), failed_jobs: count(usage[0]?.failed_jobs), last_activity: usage[0]?.last_activity || null } };
}

export async function loadSupport(sql, session, id) {
  const rows = await sql`SELECT m.id, m.full_name AS name, m.email, m.message, m.status, m.created_at, m.updated_at, r.read_at IS NOT NULL AS is_read
    FROM public.support_messages m LEFT JOIN public.admin_resource_reads r
      ON r.resource_type = 'support' AND r.resource_id = m.id AND r.actor_subject = ${session.sub}
    WHERE m.id = ${id}::BIGINT LIMIT 1`;
  if (!rows[0]) return null;
  const notes = await sql`SELECT id, note AS text, actor_subject AS author, created_at FROM public.support_message_notes
    WHERE support_message_id = ${id}::BIGINT ORDER BY created_at DESC, id DESC LIMIT 100`;
  return { ...supportRow(rows[0]), message: rows[0].message, notes: notes.map(row => ({ ...row, id: text(row.id) })), notes_limit: 100 };
}

export async function listUsers(sql, query) {
  const { q, pattern, status, pageSize, offset } = query;
  const [totals, rows] = await Promise.all([
    sql`SELECT COUNT(*)::INTEGER AS total FROM public.user_profiles
      WHERE (${status} = '' OR status = ${status}) AND (${q} = '' OR full_name ILIKE ${pattern} ESCAPE '\\' OR email ILIKE ${pattern} ESCAPE '\\')`,
    sql`SELECT identity_user_id AS id, full_name AS name, email, provider, status, created_at, last_login_at FROM public.user_profiles
      WHERE (${status} = '' OR status = ${status}) AND (${q} = '' OR full_name ILIKE ${pattern} ESCAPE '\\' OR email ILIKE ${pattern} ESCAPE '\\')
      ORDER BY created_at DESC, identity_user_id ASC LIMIT ${pageSize} OFFSET ${offset}`
  ]);
  return { rows: rows.map(userRow), pagination: pagination(query, totals[0]?.total), capabilities: USER_CAPABILITIES };
}

export async function listSupport(sql, session, query) {
  const { q, pattern, status, read, pageSize, offset } = query;
  const [totals, rows] = await Promise.all([
    sql`SELECT COUNT(*)::INTEGER AS total FROM public.support_messages m LEFT JOIN public.admin_resource_reads r
      ON r.resource_type = 'support' AND r.resource_id = m.id AND r.actor_subject = ${session.sub}
      WHERE (${status} = '' OR m.status = ${status}) AND (${q} = '' OR m.full_name ILIKE ${pattern} ESCAPE '\\' OR m.email ILIKE ${pattern} ESCAPE '\\' OR m.message ILIKE ${pattern} ESCAPE '\\')
      AND (${read} = 'all' OR (${read} = 'read' AND r.read_at IS NOT NULL) OR (${read} = 'unread' AND r.read_at IS NULL))`,
    sql`SELECT m.id, m.full_name AS name, m.email, LEFT(m.message, 180) AS preview, m.status, m.created_at, m.updated_at, r.read_at IS NOT NULL AS is_read
      FROM public.support_messages m LEFT JOIN public.admin_resource_reads r
      ON r.resource_type = 'support' AND r.resource_id = m.id AND r.actor_subject = ${session.sub}
      WHERE (${status} = '' OR m.status = ${status}) AND (${q} = '' OR m.full_name ILIKE ${pattern} ESCAPE '\\' OR m.email ILIKE ${pattern} ESCAPE '\\' OR m.message ILIKE ${pattern} ESCAPE '\\')
      AND (${read} = 'all' OR (${read} = 'read' AND r.read_at IS NOT NULL) OR (${read} = 'unread' AND r.read_at IS NULL))
      ORDER BY m.created_at DESC, m.id DESC LIMIT ${pageSize} OFFSET ${offset}`
  ]);
  return { rows: rows.map(supportRow), pagination: pagination(query, totals[0]?.total), capabilities: SUPPORT_CAPABILITIES };
}

export async function listNotifications(sql, session, query) {
  const { read, pageSize, offset } = query;
  // Messages stay private in the inbox; notification summaries carry no message body or email.
  const rows = await sql`WITH events AS (
      SELECT 'support'::TEXT AS type, id, created_at, 'Support message received'::TEXT AS title, status::TEXT AS summary FROM public.support_messages
      UNION ALL SELECT 'system', id, occurred_at, 'System ' || severity, source || ': ' || category FROM public.system_events
    ), filtered AS (SELECT e.*, r.read_at IS NOT NULL AS is_read FROM events e LEFT JOIN public.admin_resource_reads r
      ON r.actor_subject = ${session.sub} AND r.resource_type = e.type AND r.resource_id = e.id
      WHERE (${read} = 'all' OR (${read} = 'read' AND r.read_at IS NOT NULL) OR (${read} = 'unread' AND r.read_at IS NULL)))
    SELECT *, COUNT(*) OVER ()::INTEGER AS total FROM filtered ORDER BY created_at DESC, type, id DESC LIMIT ${pageSize} OFFSET ${offset}`;
  // Empty out-of-range pages must retain their actual total, not claim there are no events.
  let total = rows[0]?.total;
  if (total === undefined) {
    const totals = await sql`WITH events AS (SELECT 'support'::TEXT AS type, id FROM public.support_messages UNION ALL SELECT 'system', id FROM public.system_events)
      SELECT COUNT(*)::INTEGER AS total FROM events e LEFT JOIN public.admin_resource_reads r
        ON r.actor_subject = ${session.sub} AND r.resource_type = e.type AND r.resource_id = e.id
      WHERE (${read} = 'all' OR (${read} = 'read' AND r.read_at IS NOT NULL) OR (${read} = 'unread' AND r.read_at IS NULL))`;
    total = totals[0]?.total;
  }
  return { rows: rows.map(row => ({ id: `${row.type}:${row.id}`, type: row.type, title: row.title, summary: row.summary, created_at: row.created_at, is_read: !!row.is_read, target: { section: row.type, id: text(row.id) } })), pagination: pagination(query, total) };
}

export async function listAudit(sql, query) {
  const [totals, rows] = await Promise.all([
    sql`SELECT COUNT(*)::INTEGER AS total FROM public.admin_audit_events`,
    sql`SELECT id, actor_subject, action, resource_type, resource_id, occurred_at FROM public.admin_audit_events ORDER BY occurred_at DESC, id DESC LIMIT ${query.pageSize} OFFSET ${query.offset}`
  ]);
  return { rows: rows.map(row => ({ ...row, id: text(row.id) })), pagination: pagination(query, totals[0]?.total) };
}

export async function searchResources(sql, session, query) {
  if (query.q.length < 2) return { groups: { tools: [], users: [], support: [] }, minimum_query_length: 2 };
  const limited = { ...query, page: 1, pageSize: 5, offset: 0, status: '', read: 'all' };
  const [users, support] = await Promise.all([listUsers(sql, limited), listSupport(sql, session, limited)]);
  const needle = query.q.toLocaleLowerCase();
  const tools = ADMIN_PRODUCT_SNAPSHOT.tools.filter(tool => `${tool.name} ${tool.category}`.toLocaleLowerCase().includes(needle)).slice(0, 5).map(tool => ({ id: tool.id, name: tool.name, category: tool.category, href: `/${tool.id}` }));
  return { groups: { tools, users: users.rows, support: support.rows }, limit_per_group: 5 };
}

export function resourceMutation(body) {
  const { resource, action } = body;
  if (!['users', 'support', 'notifications'].includes(resource)) invalid('This resource cannot be changed.');
  if (resource === 'users') {
    if (action !== 'status' || !['active', 'inactive'].includes(body.status) || body.confirm !== true) invalid('Confirm the active/inactive account-status change.');
    return { resource, action, id: resourceId(body.id, true), status: body.status };
  }
  if (resource === 'notifications') {
    if (action !== 'read' || typeof body.is_read !== 'boolean' || typeof body.id !== 'string' || !/^(support|system):[1-9]\d{0,17}$/u.test(body.id)) invalid('A valid notification and read state are required.');
    const [type, id] = body.id.split(':');
    return { resource, action, type, id, isRead: body.is_read };
  }
  const id = resourceId(body.id);
  if (action === 'status' && SUPPORT_CAPABILITIES.statuses.includes(body.status)) return { resource, action, id, status: body.status };
  if (action === 'read' && typeof body.is_read === 'boolean') return { resource, action, id, type: 'support', isRead: body.is_read };
  if (action === 'note' && typeof body.text === 'string') {
    const note = body.text.trim();
    if (!note || note.length > 2000 || /[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/u.test(note)) invalid('Internal notes must contain 1–2000 characters.');
    return { resource, action, id, note };
  }
  invalid('Unsupported support action or value.');
}

export async function mutateResource(sql, session, operation) {
  const { resource, action, id } = operation;
  // Each mutation and audit insertion are in one PostgreSQL statement. Audit failure rolls back the change.
  if (resource === 'users') {
    const changed = await sql`WITH changed AS (UPDATE public.user_profiles SET status = ${operation.status} WHERE identity_user_id = ${id} RETURNING identity_user_id),
      audited AS (INSERT INTO public.admin_audit_events (actor_subject, action, resource_type, resource_id)
        SELECT ${session.sub}, ${`user_status_${operation.status}`}, 'user', identity_user_id FROM changed RETURNING id)
      SELECT identity_user_id AS id FROM changed WHERE EXISTS (SELECT 1 FROM audited)`;
    return changed.length > 0;
  }
  if (resource === 'support' && action === 'status') {
    const changed = await sql`WITH changed AS (UPDATE public.support_messages SET status = ${operation.status} WHERE id = ${id}::BIGINT RETURNING id),
      audited AS (INSERT INTO public.admin_audit_events (actor_subject, action, resource_type, resource_id)
        SELECT ${session.sub}, ${`support_status_${operation.status}`}, 'support', id::TEXT FROM changed RETURNING id)
      SELECT id FROM changed WHERE EXISTS (SELECT 1 FROM audited)`;
    return changed.length > 0;
  }
  if (resource === 'support' && action === 'note') {
    const changed = await sql`WITH changed AS (INSERT INTO public.support_message_notes (support_message_id, actor_subject, note)
        SELECT id, ${session.sub}, ${operation.note} FROM public.support_messages WHERE id = ${id}::BIGINT RETURNING support_message_id),
      audited AS (INSERT INTO public.admin_audit_events (actor_subject, action, resource_type, resource_id)
        SELECT ${session.sub}, 'support_note_added', 'support', support_message_id::TEXT FROM changed RETURNING id)
      SELECT support_message_id AS id FROM changed WHERE EXISTS (SELECT 1 FROM audited)`;
    return changed.length > 0;
  }
  const changed = await sql`WITH existing AS (
      SELECT id FROM public.support_messages WHERE ${operation.type} = 'support' AND id = ${id}::BIGINT
      UNION ALL SELECT id FROM public.system_events WHERE ${operation.type} = 'system' AND id = ${id}::BIGINT
    ), changed AS (INSERT INTO public.admin_resource_reads (actor_subject, resource_type, resource_id, read_at)
      SELECT ${session.sub}, ${operation.type}, id, CASE WHEN ${operation.isRead} THEN CURRENT_TIMESTAMP ELSE NULL END FROM existing
      ON CONFLICT (actor_subject, resource_type, resource_id) DO UPDATE SET read_at = EXCLUDED.read_at RETURNING resource_id),
    audited AS (INSERT INTO public.admin_audit_events (actor_subject, action, resource_type, resource_id)
      SELECT ${session.sub}, ${operation.isRead ? 'mark_read' : 'mark_unread'}, ${operation.type}, resource_id::TEXT FROM changed RETURNING id)
    SELECT resource_id AS id FROM changed WHERE EXISTS (SELECT 1 FROM audited)`;
  return changed.length > 0;
}
