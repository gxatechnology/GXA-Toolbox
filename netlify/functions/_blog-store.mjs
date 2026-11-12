import { BLOG_UUID, isPublicPost, validateArticleInput, postMarkdown } from './_blog-core.mjs';

const SELECT_POST = `SELECT p.*, m.alt_text AS featured_alt, m.caption AS featured_caption
  FROM public.blog_posts p LEFT JOIN public.blog_media m ON m.id = p.featured_media_id WHERE p.id = $1`;

export async function listAdminPosts(pool, status = 'all', page = 1) {
  if (!['all','draft','scheduled','published','private','deleted'].includes(status)) throw Object.assign(new Error('Invalid article filter.'), { status: 400 });
  const client = await pool.connect();
  try {
    const result = await client.query(`SELECT id, slug, title, excerpt, status, noindex, published_at, scheduled_at, updated_at, version
      FROM public.blog_posts WHERE ($1 = 'all' OR status = $1) ORDER BY updated_at DESC, id DESC LIMIT 31 OFFSET $2`, [status, (page - 1) * 30]);
    return { items: result.rows.slice(0, 30), hasNext: result.rows.length > 30 };
  } finally { client.release(); }
}

export async function getAdminPost(pool, id) {
  const client = await pool.connect();
  try {
    const result = await client.query(SELECT_POST, [id]);
    if (!result.rows[0]) return null;
    const post = result.rows[0];
    const [revisionResult, categoryResult, tagResult] = await Promise.all([
      client.query('SELECT version, created_at FROM public.blog_post_revisions WHERE post_id = $1 ORDER BY version DESC LIMIT 30', [id]),
      client.query('SELECT c.name FROM public.blog_categories c JOIN public.blog_post_categories pc ON pc.category_id = c.id WHERE pc.post_id = $1 ORDER BY c.name', [id]),
      client.query('SELECT t.name FROM public.blog_tags t JOIN public.blog_post_tags pt ON pt.tag_id = t.id WHERE pt.post_id = $1 ORDER BY t.name', [id])
    ]);
    return { ...post, markdown: postMarkdown(post), categories: categoryResult.rows.map(row => row.name), tags: tagResult.rows.map(row => row.name), revisions: revisionResult.rows };
  } finally { client.release(); }
}

async function syncTerms(client, postId, values, table, joinTable, foreignKey) {
  await client.query(`DELETE FROM public.${joinTable} WHERE post_id = $1`, [postId]);
  for (const term of values) {
    const result = await client.query(`INSERT INTO public.${table} (slug, name) VALUES ($1, $2)
      ON CONFLICT (slug) DO UPDATE SET name = EXCLUDED.name RETURNING id`, [term.slug, term.name]);
    await client.query(`INSERT INTO public.${joinTable} (post_id, ${foreignKey}) VALUES ($1, $2)`, [postId, result.rows[0].id]);
  }
}

async function assertSlugFree(client, slug, ownId = null) {
  await client.query('SELECT pg_advisory_xact_lock(hashtext($1))', [slug]);
  const result = await client.query(`SELECT 1 FROM public.blog_posts WHERE slug = $1 AND ($2::uuid IS NULL OR id <> $2::uuid)
    UNION ALL SELECT 1 FROM public.blog_slug_redirects WHERE old_slug = $1 AND ($2::uuid IS NULL OR post_id <> $2::uuid) LIMIT 1`, [slug, ownId]);
  if (result.rows.length) throw Object.assign(new Error('This URL slug is already used.'), { status: 409 });
}

function rowSnapshot(row) {
  return { slug: row.slug, title: row.title, excerpt: row.excerpt, content: row.content, status: row.status,
    noindex: row.noindex, author_name: row.author_name, featured_media_id: row.featured_media_id,
    meta_title: row.meta_title, meta_description: row.meta_description, og_title: row.og_title,
    og_description: row.og_description, canonical_url: row.canonical_url,
    scheduled_at: row.scheduled_at, published_at: row.published_at, significant_updated_at: row.significant_updated_at };
}

export async function saveAdminPost(pool, session, input, id = null, expectedVersion = null) {
  let article;
  try { article = validateArticleInput(input); }
  catch (error) { throw Object.assign(error, { status: 400 }); }
  if (article.status !== 'draft' && article.status !== 'private' && article.markdown.trim().length < 80) throw Object.assign(new Error('Publishable articles need at least 80 characters of useful content.'), { status: 400 });
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    let prior = null;
    if (id) {
      const existing = await client.query('SELECT * FROM public.blog_posts WHERE id = $1 FOR UPDATE', [id]);
      prior = existing.rows[0];
      if (!prior) throw Object.assign(new Error('Article not found.'), { status: 404 });
      if (prior.version !== expectedVersion) throw Object.assign(new Error('This article changed in another session. Reload before saving.'), { status: 409 });
    }
    await assertSlugFree(client, article.slug, id);
    if (article.featured_media_id) {
      const image = await client.query('SELECT id FROM public.blog_media WHERE id = $1', [article.featured_media_id]);
      if (!image.rows.length) throw Object.assign(new Error('Featured image does not exist.'), { status: 400 });
    }
    const nextVersion = prior ? prior.version + 1 : 1;
    const publishedAt = article.status === 'published' ? (prior?.published_at || new Date()) : null;
    const significantChange = !prior || prior.status !== article.status || prior.slug !== article.slug ||
      prior.title !== article.title || prior.excerpt !== article.excerpt || postMarkdown(prior) !== article.markdown ||
      prior.featured_media_id !== article.featured_media_id || prior.meta_title !== article.meta_title ||
      prior.meta_description !== article.meta_description || prior.canonical_url !== article.canonical_url ||
      prior.noindex !== article.noindex || prior.og_title !== article.og_title ||
      prior.og_description !== article.og_description || prior.author_name !== article.author_name;
    const significantAt = article.status === 'published' || article.status === 'scheduled'
      ? significantChange ? new Date() : prior?.significant_updated_at || new Date()
      : prior?.significant_updated_at || null;
    const content = JSON.stringify([{ type: 'markdown', text: article.markdown }]);
    let result;
    if (prior) {
      result = await client.query(`UPDATE public.blog_posts SET slug=$2,title=$3,excerpt=$4,content=$5::jsonb,status=$6,noindex=$7,
        author_name=$8,featured_media_id=$9,meta_title=$10,meta_description=$11,og_title=$12,og_description=$13,
        canonical_url=$14,scheduled_at=$15,published_at=$16,significant_updated_at=$17,updated_at=CURRENT_TIMESTAMP,version=$18
        WHERE id=$1 RETURNING *`, [id, article.slug, article.title, article.excerpt, content, article.status, article.noindex,
        article.author_name, article.featured_media_id, article.meta_title, article.meta_description, article.og_title,
        article.og_description, article.canonical_url, article.scheduled_at, publishedAt, significantAt, nextVersion]);
    } else {
      result = await client.query(`INSERT INTO public.blog_posts (slug,title,excerpt,content,status,noindex,author_name,featured_media_id,
        meta_title,meta_description,og_title,og_description,canonical_url,scheduled_at,published_at,significant_updated_at)
        VALUES ($1,$2,$3,$4::jsonb,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16) RETURNING *`,
      [article.slug, article.title, article.excerpt, content, article.status, article.noindex, article.author_name,
        article.featured_media_id, article.meta_title, article.meta_description, article.og_title,
        article.og_description, article.canonical_url, article.scheduled_at, publishedAt, significantAt]);
    }
    const row = result.rows[0];
    if (prior?.slug !== article.slug && prior) {
      await client.query('INSERT INTO public.blog_slug_redirects (old_slug, post_id) VALUES ($1,$2) ON CONFLICT (old_slug) DO UPDATE SET post_id=EXCLUDED.post_id', [prior.slug, id]);
      await client.query('DELETE FROM public.blog_slug_redirects WHERE old_slug = $1 AND post_id = $2', [article.slug, id]);
    }
    await syncTerms(client, row.id, article.categories, 'blog_categories', 'blog_post_categories', 'category_id');
    await syncTerms(client, row.id, article.tags, 'blog_tags', 'blog_post_tags', 'tag_id');
    const referencedMedia = [...new Set([...article.markdown.matchAll(/!\[[^\]]*\]\(\/blog-media\/([0-9a-f-]{36})\)/gi)].map(match => match[1].toLowerCase()).filter(value => BLOG_UUID.test(value)))];
    if (article.featured_media_id && !referencedMedia.includes(article.featured_media_id.toLowerCase())) referencedMedia.push(article.featured_media_id.toLowerCase());
    await client.query('DELETE FROM public.blog_post_media WHERE post_id=$1', [row.id]);
    for (const mediaId of referencedMedia) {
      const linked = await client.query('INSERT INTO public.blog_post_media (post_id, media_id) VALUES ($1,$2) RETURNING media_id', [row.id, mediaId]);
      if (!linked.rows.length) throw new Error('Article image could not be linked.');
    }
    await client.query('INSERT INTO public.blog_post_revisions (post_id, version, snapshot, actor_subject) VALUES ($1,$2,$3::jsonb,$4)',
      [row.id, nextVersion, JSON.stringify(rowSnapshot(row)), session.sub]);
    const action = !prior ? 'create' : prior.slug !== row.slug ? 'change_slug' : prior.status !== row.status ?
      row.status === 'published' ? 'publish' : row.status === 'scheduled' ? 'schedule' : 'unpublish' : 'save';
    await client.query('INSERT INTO public.blog_audit_events (post_id, actor_subject, action) VALUES ($1,$2,$3)', [row.id, session.sub, action]);
    await client.query('COMMIT');
    return { id: row.id, slug: row.slug, status: row.status, version: row.version, previousSlug: prior?.slug || null,
      indexNow: { id: row.id, version: row.version, previousSlug: prior?.slug || null, slug: row.slug,
        beforePublic: isPublicPost(prior), afterPublic: isPublicPost(row), significantChange } };
  } catch (error) {
    await client.query('ROLLBACK');
    if (error.code === '23505') throw Object.assign(new Error('This URL slug is already used.'), { status: 409 });
    if (error.code === '23503') throw Object.assign(new Error('An article image does not exist.'), { status: 400 });
    throw error;
  } finally { client.release(); }
}

export async function restoreAdminRevision(pool, session, id, version, expectedVersion) {
  const client = await pool.connect();
  let snapshot;
  try {
    const result = await client.query('SELECT snapshot FROM public.blog_post_revisions WHERE post_id=$1 AND version=$2', [id, version]);
    if (!result.rows[0]) throw Object.assign(new Error('Revision not found.'), { status: 404 });
    snapshot = result.rows[0].snapshot;
  } finally { client.release(); }
  const data = { ...snapshot, markdown: postMarkdown(snapshot), status: 'draft', categories: [], tags: [] };
  const saved = await saveAdminPost(pool, session, data, id, expectedVersion);
  await pool.query('INSERT INTO public.blog_audit_events (post_id, actor_subject, action) VALUES ($1,$2,$3)', [id, session.sub, 'restore_revision']);
  return saved;
}

export async function softDeleteAdminPost(pool, session, id, expectedVersion) {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const prior = await client.query('SELECT * FROM public.blog_posts WHERE id=$1 AND version=$2 FOR UPDATE', [id, expectedVersion]);
    if (!prior.rows.length) throw Object.assign(new Error('Article not found or changed in another session.'), { status: 409 });
    const result = await client.query(`UPDATE public.blog_posts SET status='deleted',updated_at=CURRENT_TIMESTAMP,version=version+1
      WHERE id=$1 AND version=$2 RETURNING slug, version`, [id, expectedVersion]);
    if (!result.rows.length) throw Object.assign(new Error('Article not found or changed in another session.'), { status: 409 });
    await client.query('INSERT INTO public.blog_audit_events (post_id, actor_subject, action) VALUES ($1,$2,$3)', [id, session.sub, 'delete']);
    await client.query('COMMIT');
    const row = result.rows[0];
    return { ...row, indexNow: { id, version: row.version, previousSlug: row.slug, slug: row.slug,
      beforePublic: isPublicPost(prior.rows[0]), afterPublic: false, significantChange: true } };
  } catch (error) { await client.query('ROLLBACK'); throw error; } finally { client.release(); }
}
