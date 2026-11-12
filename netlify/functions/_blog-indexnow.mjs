import { BLOG_ORIGIN, BLOG_SLUG, publicArticleUrl } from './_blog-core.mjs';

const ENDPOINT = 'https://api.indexnow.org/indexnow';
const KEY_LOCATION = `${BLOG_ORIGIN}/indexnow-key.txt`;
const KEY_PATTERN = /^[A-Za-z0-9-]{8,128}$/;
const recentNotifications = new Map();

export function indexNowKey(context) {
  if (context?.deploy?.context !== 'production') return null;
  const key = String(process.env.INDEXNOW_KEY || '').trim();
  return KEY_PATTERN.test(key) ? key : null;
}

export function indexNowUrls(change) {
  if (!change?.significantChange) return [];
  const urls = [];
  if (change.beforePublic && BLOG_SLUG.test(change.previousSlug || '')) urls.push(publicArticleUrl(change.previousSlug));
  if (change.afterPublic && BLOG_SLUG.test(change.slug || '')) urls.push(publicArticleUrl(change.slug));
  return [...new Set(urls)];
}

export async function submitBlogIndexNow(change, context, options = {}) {
  const key = indexNowKey(context);
  const urls = indexNowUrls(change);
  if (!key || !urls.length) return { state: 'skipped', count: 0 };
  const now = options.now || Date.now();
  const eventId = `${change.id}:${change.version}:${urls.join('|')}`;
  for (const [id, expires] of recentNotifications) if (expires <= now) recentNotifications.delete(id);
  if (recentNotifications.has(eventId)) return { state: 'duplicate', count: 0 };
  recentNotifications.set(eventId, now + 10 * 60 * 1000);
  const request = options.fetch || fetch;
  const pause = options.pause || (ms => new Promise(resolve => setTimeout(resolve, ms)));
  const body = JSON.stringify({ host: 'gxatoolbox.in', key, keyLocation: KEY_LOCATION, urlList: urls });
  for (let attempt = 0; attempt < 3; attempt++) {
    let response;
    try {
      response = await request(ENDPOINT, { method: 'POST', headers: { 'Content-Type': 'application/json; charset=utf-8' }, body,
        signal: AbortSignal.timeout(5000) });
      if (response.status === 200 || response.status === 202) return { state: 'accepted', count: urls.length };
      if (response.status === 429) {
        const retryAfter = Number(response.headers?.get('retry-after'));
        if (Number.isFinite(retryAfter) && retryAfter > 4) return { state: 'rate_limited', count: urls.length, status: 429 };
      }
      if (response.status !== 429 && response.status < 500) return { state: 'rejected', count: urls.length, status: response.status };
    } catch { /* Retry transient network failures without logging URLs or credentials. */ }
    if (attempt < 2) {
      const retryAfter = Number(response?.headers?.get('retry-after'));
      await pause(response?.status === 429 && Number.isFinite(retryAfter) && retryAfter > 0
        ? Math.min(retryAfter * 1000, 4000) : 300 * 2 ** attempt);
    }
  }
  recentNotifications.delete(eventId);
  return { state: 'failed', count: urls.length };
}

export function queueBlogIndexNow(change, context) {
  if (!indexNowKey(context) || !indexNowUrls(change).length) return false;
  const task = submitBlogIndexNow(change, context).then(result => {
    if (result.state !== 'accepted' && result.state !== 'duplicate') console.error('IndexNow notification:', result.state, result.status || '');
  }).catch(() => console.error('IndexNow notification failed.'));
  if (typeof context.waitUntil === 'function') context.waitUntil(task);
  else return task;
  return true;
}
