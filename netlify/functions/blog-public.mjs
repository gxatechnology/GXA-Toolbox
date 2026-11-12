import { getDatabaseClient, databaseErrorCategory } from './_database.mjs';
import { BLOG_ORIGIN, escapeHtml, isVisiblePost, isPublicPost, lastModified, postMarkdown, publicArticleUrl, renderMarkdown, validateSlug } from './_blog-core.mjs';

const headers = (tag, article = false) => ({
  'Content-Type': 'text/html; charset=utf-8',
  'Cache-Control': article ? 'no-store' : 'public, max-age=0, must-revalidate',
  'Netlify-CDN-Cache-Control': article ? 'no-store' : 'public, max-age=30',
  'Netlify-Cache-Tag': `gxa-blog-index, ${tag}`,
  'X-Content-Type-Options': 'nosniff'
});
const noStore = { 'Content-Type': 'text/html; charset=utf-8', 'Cache-Control': 'no-store', 'X-Robots-Tag': 'noindex' };
const style = '<link rel="stylesheet" href="/assets/blog.css">';
const shell = (title, description, canonical, robots, body, graph = '', sharing = {}) => `<!doctype html>
<html lang="en"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover">
<title>${escapeHtml(title)}</title><meta name="description" content="${escapeHtml(description)}"><meta name="robots" content="${robots}">
<link rel="canonical" href="${escapeHtml(canonical)}"><link rel="icon" href="/favicon-32x32.png" sizes="32x32" type="image/png">
<meta property="og:site_name" content="GXA Toolbox"><meta property="og:type" content="${graph ? 'article' : 'website'}"><meta property="og:title" content="${escapeHtml(sharing.title || title)}"><meta property="og:description" content="${escapeHtml(sharing.description || description)}"><meta property="og:url" content="${escapeHtml(canonical)}">${sharing.image ? `<meta property="og:image" content="${escapeHtml(sharing.image)}">${sharing.imageAlt ? `<meta property="og:image:alt" content="${escapeHtml(sharing.imageAlt)}">` : ''}` : ''}
<meta name="twitter:card" content="${sharing.image ? 'summary_large_image' : 'summary'}"><meta name="twitter:title" content="${escapeHtml(sharing.title || title)}"><meta name="twitter:description" content="${escapeHtml(sharing.description || description)}">${sharing.image ? `<meta name="twitter:image" content="${escapeHtml(sharing.image)}">` : ''}${style}
${graph ? `<script type="application/ld+json">${JSON.stringify(graph).replaceAll('<', '\\u003c')}</script>` : ''}</head>
<body><a class="blog-skip" href="#blog-main">Skip to content</a><header class="blog-header"><a class="blog-brand" href="/"><img src="/gxa-logo.png" width="38" height="38" alt=""><span>GXA Toolbox</span></a><nav aria-label="Blog navigation"><a href="/blog/">Blog</a><a href="/">All tools</a></nav></header>
<main id="blog-main" class="blog-main">${body}</main><footer class="blog-footer"><span>GXA Toolbox is a product of GXA Technologies.</span><nav aria-label="Footer"><a href="/about/">About</a><a href="/privacy-policy/">Privacy</a><a href="/terms/">Terms</a><a href="/help/">Help</a></nav></footer></body></html>`;

function articleHtml(post) {
  const title = post.meta_title || `${post.title} | GXA Toolbox`;
  const description = post.meta_description || post.excerpt || post.title;
  const canonical = post.canonical_url || publicArticleUrl(post.slug);
  const published = post.published_at || post.scheduled_at;
  const image = post.featured_media_id ? `/blog-media/${post.featured_media_id}` : null;
  const graph = { '@context': 'https://schema.org', '@type': 'Article', headline: post.title, description,
    url: canonical, mainEntityOfPage: canonical, datePublished: new Date(published).toISOString(),
    dateModified: lastModified(post), author: { '@type': 'Organization', name: post.author_name },
    publisher: { '@type': 'Organization', name: 'GXA Technologies', url: BLOG_ORIGIN },
    ...(image ? { image: `${BLOG_ORIGIN}${image}` } : {}) };
  const date = new Date(published).toLocaleDateString('en-IN', { year: 'numeric', month: 'long', day: 'numeric', timeZone: 'UTC' });
  const body = `<nav class="blog-crumbs" aria-label="Breadcrumb"><a href="/">Home</a><span aria-hidden="true">/</span><a href="/blog/">Blog</a><span aria-hidden="true">/</span><span>${escapeHtml(post.title)}</span></nav>
    <article class="blog-article"><header><p class="blog-eyebrow">GXA Toolbox Blog</p><h1>${escapeHtml(post.title)}</h1>${post.excerpt ? `<p class="blog-lead">${escapeHtml(post.excerpt)}</p>` : ''}<p class="blog-byline">By ${escapeHtml(post.author_name)} · <time datetime="${new Date(published).toISOString()}">${date}</time></p></header>
    ${image ? `<figure class="blog-feature"><img src="${image}" alt="${escapeHtml(post.featured_alt || '')}" width="1200" height="630"><figcaption>${escapeHtml(post.featured_caption || '')}</figcaption></figure>` : ''}
    <div class="blog-prose">${renderMarkdown(postMarkdown(post))}</div><p class="blog-back"><a href="/blog/">← More articles</a></p></article>`;
  return shell(title, description, canonical, post.noindex ? 'noindex, follow' : 'index, follow', body, graph,
    { title: post.og_title, description: post.og_description, image: image ? `${BLOG_ORIGIN}${image}` : null,
      imageAlt: post.featured_alt });
}

function indexHtml(rows, page, hasNext) {
  const cards = rows.map(row => `<article class="blog-card"><p class="blog-eyebrow">${escapeHtml(new Date(row.published_at || row.scheduled_at).toLocaleDateString('en-IN', { dateStyle: 'medium', timeZone: 'UTC' }))}</p><h2><a href="/blog/${escapeHtml(row.slug)}/">${escapeHtml(row.title)}</a></h2><p>${escapeHtml(row.excerpt)}</p><a class="blog-read" href="/blog/${escapeHtml(row.slug)}/">Read article →</a></article>`).join('');
  const pagination = `<nav class="blog-pagination" aria-label="Blog pages">${page > 1 ? `<a href="/blog/?page=${page - 1}">← Newer</a>` : ''}${hasNext ? `<a href="/blog/?page=${page + 1}">Older →</a>` : ''}</nav>`;
  return shell('GXA Toolbox Blog', 'Practical guides and updates from GXA Toolbox.', `${BLOG_ORIGIN}/blog/${page > 1 ? `?page=${page}` : ''}`, rows.length ? 'index, follow' : 'noindex, follow', `<section class="blog-intro"><p class="blog-eyebrow">Guides and updates</p><h1>GXA Toolbox Blog</h1><p>Practical guidance for working with documents, images and everyday digital tools.</p></section>${cards ? `<div class="blog-grid">${cards}</div>${pagination}` : '<p class="blog-empty">No articles have been published yet.</p>'}`);
}

export default async function handler(request) {
  if (!['GET','HEAD'].includes(request.method)) return new Response('', { status: 405, headers: { Allow: 'GET, HEAD' } });
  const url = new URL(request.url);
  const rawSlug = url.searchParams.get('slug');
  try {
    const { sql } = getDatabaseClient();
    if (rawSlug) {
      let slug;
      try { slug = validateSlug(rawSlug); } catch { return new Response('', { status: 404, headers: noStore }); }
      const rows = await sql`SELECT p.*, m.alt_text AS featured_alt, m.caption AS featured_caption
        FROM public.blog_posts p LEFT JOIN public.blog_media m ON m.id = p.featured_media_id WHERE p.slug = ${slug} LIMIT 1`;
      const post = rows[0];
      if (isVisiblePost(post)) return new Response(request.method === 'HEAD' ? null : articleHtml(post), { status: 200, headers: headers(`gxa-blog-article-${slug}`, true) });
      if (post?.status === 'deleted') return new Response('', { status: 410, headers: noStore });
      const aliases = await sql`SELECT p.slug, p.status, p.published_at, p.scheduled_at FROM public.blog_slug_redirects r
        JOIN public.blog_posts p ON p.id = r.post_id WHERE r.old_slug = ${slug} LIMIT 1`;
      if (isVisiblePost(aliases[0])) return new Response('', { status: 301, headers: { Location: publicArticleUrl(aliases[0].slug), 'Cache-Control': 'no-store' } });
      return new Response('', { status: 404, headers: noStore });
    }
    const page = Number(url.searchParams.get('page') || 1);
    if (!Number.isInteger(page) || page < 1 || page > 10000) return new Response('', { status: 404, headers: noStore });
    const offset = (page - 1) * 12;
    const rows = await sql`SELECT slug, title, excerpt, published_at, scheduled_at FROM public.blog_posts
      WHERE noindex = FALSE AND ((status = 'published' AND published_at <= CURRENT_TIMESTAMP)
        OR (status = 'scheduled' AND scheduled_at <= CURRENT_TIMESTAMP))
      ORDER BY COALESCE(published_at, scheduled_at) DESC, id DESC LIMIT 13 OFFSET ${offset}`;
    if (page > 1 && rows.length === 0) return new Response('', { status: 404, headers: noStore });
    return new Response(request.method === 'HEAD' ? null : indexHtml(rows.slice(0, 12), page, rows.length > 12), { status: 200, headers: headers('gxa-blog-index') });
  } catch (error) {
    console.error('Public blog unavailable:', databaseErrorCategory(error));
    return new Response('<!doctype html><title>Blog unavailable</title><h1>Blog temporarily unavailable</h1>', { status: 503, headers: noStore });
  }
}
