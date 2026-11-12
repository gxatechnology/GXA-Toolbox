import { purgeCache } from '@netlify/functions';

let testPurger;
export function setBlogCachePurgerForTests(purger) {
  if (process.env.NODE_ENV === 'production') throw new Error('Blog cache test adapter is unavailable in production.');
  testPurger = purger;
}

export async function invalidateBlogCache(slugs = []) {
  const tags = ['gxa-blog-sitemap', 'gxa-blog-index', ...slugs.filter(Boolean).map(slug => `gxa-blog-article-${slug}`)];
  try { await (testPurger || purgeCache)({ tags }); return true; }
  catch (error) { console.error('Blog cache purge failed:', error?.name || 'Error'); return false; }
}
