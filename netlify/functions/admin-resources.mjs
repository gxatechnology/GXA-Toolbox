import { requireAdminSession } from './_admin-auth.mjs';
import { requireAdminMutation, adminAccountErrorResponse, consumeAdminRateLimit } from './_admin-account.mjs';
import { getDatabaseClient } from './_database.mjs';
import { jsonResponse, methodNotAllowed } from './_auth.mjs';
import { readAdminJson } from './_admin-auth.mjs';
import { resourceQuery, resourceMutation, listUsers, loadUser, listSupport, loadSupport, listNotifications, listAudit, searchResources, mutateResource, USER_CAPABILITIES, SUPPORT_CAPABILITIES } from './_admin-resources.mjs';

export default async function handler(request) {
  if (!['GET', 'PATCH'].includes(request.method)) return methodNotAllowed(['GET', 'PATCH']);
  try {
    const session = request.method === 'GET' ? requireAdminSession(request) : requireAdminMutation(request);
    if (request.method === 'GET') {
      const query = resourceQuery(new URL(request.url).searchParams);
      const { sql } = getDatabaseClient();
      let data;
      if (query.id) {
        if (!['users', 'support'].includes(query.resource)) return jsonResponse({ success: false, message: 'Detail view is not available for this resource.' }, 400);
        const item = query.resource === 'users' ? await loadUser(sql, query.id) : await loadSupport(sql, session, query.id);
        if (!item) return jsonResponse({ success: false, message: 'The requested record was not found.' }, 404);
        data = { item, capabilities: query.resource === 'users' ? USER_CAPABILITIES : SUPPORT_CAPABILITIES };
      } else {
        const loaders = {
          users: () => listUsers(sql, query), support: () => listSupport(sql, session, query),
          notifications: () => listNotifications(sql, session, query), audit: () => listAudit(sql, query), search: () => searchResources(sql, session, query)
        };
        data = await loaders[query.resource]();
      }
      return jsonResponse({ success: true, resource: query.resource, ...data });
    }
    const operation = resourceMutation(await readAdminJson(request));
    const { sql } = getDatabaseClient();
    await consumeAdminRateLimit(sql, session, 'resources', 60, 60);
    if (!await mutateResource(sql, session, operation)) return jsonResponse({ success: false, message: 'The requested record was not found.' }, 404);
    const item = operation.resource === 'users' ? await loadUser(sql, operation.id)
      : operation.resource === 'support' ? await loadSupport(sql, session, operation.id)
      : { id: `${operation.type}:${operation.id}`, is_read: operation.isRead };
    return jsonResponse({ success: true, resource: operation.resource, item, message: 'Change saved.' });
  } catch (error) {
    if (error?.adminResourceValidation) return jsonResponse({ success: false, message: error.message }, 400);
    return adminAccountErrorResponse(error);
  }
}
