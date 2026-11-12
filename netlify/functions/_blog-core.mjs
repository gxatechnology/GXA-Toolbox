import { marked } from 'marked';
import sanitizeHtml from 'sanitize-html';

export const BLOG_ORIGIN = 'https://gxatoolbox.in';
export const BLOG_SLUG = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
export const BLOG_UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
export const publicArticleUrl = slug => `${BLOG_ORIGIN}/blog/${slug}/`;
export const isVisiblePost = row => Boolean(row &&
  (row.status === 'published' ? row.published_at && new Date(row.published_at) <= new Date()
    : row.status === 'scheduled' && row.scheduled_at && new Date(row.scheduled_at) <= new Date()));
export const isPublicPost = row => Boolean(isVisiblePost(row) && !row.noindex &&
  (!row.canonical_url || row.canonical_url === publicArticleUrl(row.slug)));

export function validateSlug(value) {
  const slug = String(value || '').trim();
  if (slug.length < 3 || slug.length > 120 || !BLOG_SLUG.test(slug)) throw new Error('Use a lowercase slug of 3–120 letters, numbers or hyphens.');
  return slug;
}

export function escapeHtml(value) {
  return String(value ?? '').replace(/[&<>"']/g, character => ({ '&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;', "'":'&#39;' })[character]);
}

const allowedTags = ['p','br','strong','em','b','i','h2','h3','h4','ul','ol','li','blockquote','pre','code','table','thead','tbody','tr','th','td','a','img','hr'];
export function renderMarkdown(source) {
  const raw = marked.parse(String(source || ''), { gfm: true, breaks: false, async: false });
  return sanitizeHtml(raw, {
    allowedTags,
    allowedAttributes: { a: ['href','title','target','rel'], img: ['src','alt','title'], th: ['align'], td: ['align'] },
    allowedSchemes: ['https','mailto'],
    allowedSchemesByTag: { img: [] },
    transformTags: {
      a: (_tag, attrs) => {
        const href = String(attrs.href || '');
        const internal = href.startsWith('/') && !href.startsWith('//') || href.startsWith(`${BLOG_ORIGIN}/`);
        return { tagName: 'a', attribs: internal ? { href, title: attrs.title || '' }
          : { href, title: attrs.title || '', rel: 'noopener noreferrer', target: '_blank' } };
      },
      img: (_tag, attrs) => ({ tagName: 'img', attribs: {
        src: /^\/blog-media\/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(attrs.src || '') ? attrs.src : '',
        alt: String(attrs.alt || '').slice(0, 240), loading: 'lazy', decoding: 'async'
      } })
    },
    exclusiveFilter: frame => frame.tag === 'img' && !frame.attribs.src
  });
}

export function validateArticleInput(input) {
  const value = input && typeof input === 'object' && !Array.isArray(input) ? input : {};
  const title = String(value.title || '').trim();
  const excerpt = String(value.excerpt || '').trim();
  const markdown = String(value.markdown || '');
  if (title.length < 5 || title.length > 180) throw new Error('Title must be 5–180 characters.');
  if (excerpt.length > 500 || markdown.length > 100000) throw new Error('Article content is too long.');
  const slug = validateSlug(value.slug);
  const short = (name, max) => {
    const text = String(value[name] || '').trim();
    if (text.length > max) throw new Error(`${name} is too long.`);
    return text || null;
  };
  const canonical = short('canonical_url', 500);
  if (canonical && canonical !== publicArticleUrl(slug)) throw new Error('Canonical URL must match this article’s public GXA Toolbox URL.');
  const status = String(value.status || 'draft');
  if (!['draft','published','scheduled','private'].includes(status)) throw new Error('Invalid publishing state.');
  const scheduledAt = value.scheduled_at ? new Date(value.scheduled_at) : null;
  if (status === 'scheduled' && (!scheduledAt || !Number.isFinite(scheduledAt.getTime()))) throw new Error('Choose a valid schedule date.');
  if (status === 'scheduled' && scheduledAt <= new Date()) throw new Error('Scheduled publication must be in the future.');
  const author = short('author_name', 120) || 'GXA Technologies';
  const categories = cleanTerms(value.categories);
  const tags = cleanTerms(value.tags);
  const featured = value.featured_media_id ? String(value.featured_media_id) : null;
  if (featured && !BLOG_UUID.test(featured)) throw new Error('Invalid featured image.');
  return { title, slug, excerpt, markdown, status, noindex: Boolean(value.noindex), author_name: author,
    meta_title: short('meta_title', 180), meta_description: short('meta_description', 320),
    og_title: short('og_title', 180), og_description: short('og_description', 320),
    canonical_url: canonical, scheduled_at: scheduledAt?.toISOString() || null,
    featured_media_id: featured, categories, tags };
}

function cleanTerms(value) {
  if (!Array.isArray(value) || value.length > 12) throw new Error('Use up to 12 categories or tags.');
  return [...new Set(value.map(item => String(item || '').trim()).filter(Boolean))].map(name => {
    if (name.length > 100 || !/^[\p{L}\p{N}][\p{L}\p{N} .&-]*$/u.test(name)) throw new Error('Invalid category or tag.');
    return { name, slug: name.toLowerCase().normalize('NFKD').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 80) };
  }).filter(item => item.slug);
}

export function postMarkdown(row) {
  const blocks = Array.isArray(row.content) ? row.content : JSON.parse(row.content || '[]');
  return blocks.find(block => block?.type === 'markdown')?.text || '';
}

export function lastModified(row) {
  const dates = [row.significant_updated_at, row.published_at, row.scheduled_at].filter(Boolean).map(value => new Date(value).getTime());
  return dates.length ? new Date(Math.max(...dates)).toISOString() : null;
}

export function blogSitemapXml(rows) {
  const entries = rows.filter(isPublicPost).map(row => `  <url><loc>${escapeHtml(publicArticleUrl(row.slug))}</loc><lastmod>${lastModified(row)}</lastmod></url>`);
  return `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${entries.join('\n')}${entries.length ? '\n' : ''}</urlset>\n`;
}
