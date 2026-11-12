import { getDatabaseClient, databaseErrorCategory } from './_database.mjs';
import { BLOG_ORIGIN, blogSitemapXml } from './_blog-core.mjs';

export default async function handler(request) {
  if (request.method !== 'GET' && request.method !== 'HEAD') return new Response('', { status: 405, headers: { Allow: 'GET, HEAD' } });
  try {
    const { sql } = getDatabaseClient();
    const countRows = await sql`SELECT COUNT(*)::INTEGER AS total FROM public.blog_posts
      WHERE noindex = FALSE AND (canonical_url IS NULL OR canonical_url = 'https://gxatoolbox.in/blog/' || slug || '/')
        AND ((status = 'published' AND published_at <= CURRENT_TIMESTAMP)
          OR (status = 'scheduled' AND scheduled_at <= CURRENT_TIMESTAMP))`;
    const total = Number(countRows[0]?.total || 0);
    const pageCount = Math.max(1, Math.ceil(total / 45000));
    const pageValue = new URL(request.url).searchParams.get('page');
    const requestedPage = pageValue === null ? 0 : Number(pageValue);
    if (!Number.isInteger(requestedPage) || requestedPage > pageCount || requestedPage < 0) return new Response('', { status: 404, headers: { 'Cache-Control': 'no-store' } });
    let xml;
    if (pageCount > 1 && !requestedPage) {
      xml = `<?xml version="1.0" encoding="UTF-8"?>\n<sitemapindex xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${Array.from({ length: pageCount }, (_, i) => `  <sitemap><loc>${BLOG_ORIGIN}/blog-sitemap.xml?page=${i + 1}</loc></sitemap>`).join('\n')}\n</sitemapindex>\n`;
    } else {
      const page = requestedPage || 1;
      const offset = (page - 1) * 45000;
      const rows = await sql`SELECT slug, status, noindex, canonical_url, published_at, scheduled_at, significant_updated_at
        FROM public.blog_posts
        WHERE noindex = FALSE AND (canonical_url IS NULL OR canonical_url = 'https://gxatoolbox.in/blog/' || slug || '/')
          AND ((status = 'published' AND published_at <= CURRENT_TIMESTAMP)
            OR (status = 'scheduled' AND scheduled_at <= CURRENT_TIMESTAMP))
        ORDER BY COALESCE(published_at, scheduled_at) DESC, id DESC
        LIMIT 45000 OFFSET ${offset}`;
      xml = blogSitemapXml(rows);
    }
    return new Response(request.method === 'HEAD' ? null : xml, { status: 200, headers: {
      'Content-Type': 'application/xml; charset=utf-8',
      'Cache-Control': 'public, max-age=0, must-revalidate',
      'Netlify-CDN-Cache-Control': 'public, max-age=30',
      'Netlify-Cache-Tag': 'gxa-blog-sitemap'
    } });
  } catch (error) {
    console.error('Blog sitemap unavailable:', databaseErrorCategory(error));
    return new Response('Blog sitemap temporarily unavailable.', { status: 503, headers: { 'Content-Type': 'text/plain; charset=utf-8', 'Cache-Control': 'no-store', 'X-Robots-Tag': 'noindex' } });
  }
}
