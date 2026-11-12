import { requireAdminSession } from './_admin-auth.mjs';
import { requireAdminMutation, adminAccountErrorResponse, consumeAdminRateLimit } from './_admin-account.mjs';
import { getDatabaseClient } from './_database.mjs';
import { jsonResponse, methodNotAllowed } from './_auth.mjs';
import { getAdminPost, listAdminPosts, restoreAdminRevision, saveAdminPost, softDeleteAdminPost } from './_blog-store.mjs';
import { invalidateBlogCache } from './_blog-cache.mjs';
import { queueBlogIndexNow } from './_blog-indexnow.mjs';

const privateHeaders = { 'Cache-Control': 'private, no-store, max-age=0', 'X-Robots-Tag': 'noindex, nofollow' };
const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

async function readBody(request) {
  if (!request.headers.get('content-type')?.toLowerCase().includes('application/json')) throw Object.assign(new Error('Send JSON.'), { status: 415 });
  const length = Number(request.headers.get('content-length') || 0);
  if (length > 220000) throw Object.assign(new Error('Article is too large.'), { status: 413 });
  let size = 0;
  const chunks = [];
  if (request.body) {
    for await (const chunk of request.body) {
      size += chunk.byteLength;
      if (size > 220000) throw Object.assign(new Error('Article is too large.'), { status: 413 });
      chunks.push(chunk);
    }
  }
  const raw = Buffer.concat(chunks).toString('utf8');
  try { return JSON.parse(raw); } catch { throw Object.assign(new Error('Invalid JSON.'), { status: 400 }); }
}

export default async function handler(request, context) {
  if (!['GET','POST','PATCH','DELETE'].includes(request.method)) return methodNotAllowed(['GET','POST','PATCH','DELETE']);
  try {
    const session = request.method === 'GET' ? requireAdminSession(request) : requireAdminMutation(request);
    const { pool, sql } = getDatabaseClient();
    const url = new URL(request.url);
    const id = url.searchParams.get('id');
    if (id && !uuid.test(id)) return jsonResponse({ success: false, message: 'Invalid article ID.' }, 400, privateHeaders);
    if (request.method === 'GET') {
      if (id) {
        const post = await getAdminPost(pool, id);
        return post ? jsonResponse({ success: true, post }, 200, privateHeaders)
          : jsonResponse({ success: false, message: 'Article not found.' }, 404, privateHeaders);
      }
      const page = Number(url.searchParams.get('page') || 1);
      if (!Number.isInteger(page) || page < 1 || page > 10000) return jsonResponse({ success: false, message: 'Invalid page.' }, 400, privateHeaders);
      const list = await listAdminPosts(pool, url.searchParams.get('status') || 'all', page);
      return jsonResponse({ success: true, ...list }, 200, privateHeaders);
    }
    await consumeAdminRateLimit(sql, session, 'blog', 60, 300);
    const body = await readBody(request);
    const version = Number(body.version);
    if (id && (!Number.isInteger(version) || version < 1)) return jsonResponse({ success: false, message: 'Article version is required.' }, 400, privateHeaders);
    let result;
    if (request.method === 'DELETE') {
      if (!id) return jsonResponse({ success: false, message: 'Article ID is required.' }, 400, privateHeaders);
      result = await softDeleteAdminPost(pool, session, id, version);
    } else if (body.action === 'restore_revision') {
      if (!id || !Number.isInteger(Number(body.revision))) return jsonResponse({ success: false, message: 'Valid revision is required.' }, 400, privateHeaders);
      result = await restoreAdminRevision(pool, session, id, Number(body.revision), version);
    } else {
      result = await saveAdminPost(pool, session, body, id, id ? version : null);
    }
    const purged = await invalidateBlogCache([result.slug, result.previousSlug]);
    const notification = queueBlogIndexNow(result.indexNow, context);
    if (notification instanceof Promise) await notification;
    delete result.indexNow;
    return jsonResponse({ success: true, post: result, cachePurged: purged,
      message: purged ? 'Article saved.' : 'Article saved; public caches may take up to 30 seconds to refresh.' }, 200, privateHeaders);
  } catch (error) {
    if ([400,404,409,413,415].includes(error?.status)) return jsonResponse({ success: false, message: error.message }, error.status, privateHeaders);
    return adminAccountErrorResponse(error);
  }
}
