(() => {
  'use strict';
  const $ = id => document.getElementById(id);
  const state = { post: null, view: 'all', autosave: null, busy: false, slugTouched: false };
  const fields = ['title','slug','excerpt','markdown','author','categories','tags','schedule','meta-title','meta-description','og-title','og-description','canonical','featured','noindex'];
  const value = key => $(`post-${key}`)?.value || '';
  const setValue = (key, text) => { const node = $(`post-${key}`); if (node) node.value = text ?? ''; };
  const status = (message, error = false) => { $('studio-status').textContent = message; $('studio-status').classList.toggle('error', error); };
  const slugify = text => String(text).toLowerCase().normalize('NFKD').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 120);
  const terms = text => text.split(',').map(term => term.trim()).filter(Boolean);

  function updateEditorialReview() {
    const markdown = value('markdown');
    const headings = [...markdown.matchAll(/^\s*(#{2,4})\s+\S/gm)].map(match => match[1].length);
    const notes = [];
    if (!value('excerpt').trim()) notes.push('Add a useful excerpt for the article list and fallback description.');
    if (!value('meta-description').trim() && !value('excerpt').trim()) notes.push('Add a distinct meta description or excerpt.');
    if (!headings.includes(2)) notes.push('Consider an H2 to organize the article for readers.');
    if (headings.some((level, index) => level > 2 && (index === 0 || level > headings[index - 1] + 1))) notes.push('Check heading order; avoid jumping over a heading level.');
    if (/!\[\s*\]\(\/blog-media\//.test(markdown)) notes.push('Describe each article image with meaningful alternative text.');
    if (markdown.trim().length < 80) notes.push('Publishable articles need at least 80 characters of useful content.');
    if ($('post-noindex').checked) notes.push('This article is set to noindex and will not appear in the blog sitemap.');
    const list = $('editor-review-list'); list.replaceChildren();
    if (!notes.length) notes.push('No basic editorial issues detected; review accuracy, links and examples before publishing.');
    for (const note of notes) { const item = document.createElement('li'); item.textContent = note; list.append(item); }
    $('seo-preview-title').textContent = value('meta-title').trim() || (value('title').trim() ? `${value('title').trim()} | GXA Toolbox` : 'Article title | GXA Toolbox');
    $('seo-preview-url').textContent = `https://gxatoolbox.in/blog/${value('slug').trim() || 'your-article'}/`;
    $('seo-preview-description').textContent = value('meta-description').trim() || value('excerpt').trim() || 'Add a description to preview how this article may be summarized.';
  }

  async function api(path, options = {}) {
    const response = await fetch(path, { credentials: 'same-origin', cache: 'no-store', ...options,
      headers: { 'x-gxa-admin-request': '1', ...(options.headers || {}) } });
    const data = await response.json().catch(() => ({}));
    if (!response.ok || data.success === false) throw Object.assign(new Error(data.message || `Request failed (${response.status}).`), { status: response.status });
    return data;
  }

  function articlePayload(targetStatus) {
    return { version: state.post?.version, title: value('title'), slug: value('slug'), excerpt: value('excerpt'),
      markdown: value('markdown'), author_name: value('author'), categories: terms(value('categories')),
      tags: terms(value('tags')), scheduled_at: targetStatus === 'scheduled' && value('schedule') ? new Date(value('schedule')).toISOString() : null,
      status: targetStatus, noindex: $('post-noindex').checked, meta_title: value('meta-title'),
      meta_description: value('meta-description'), og_title: value('og-title'), og_description: value('og-description'),
      canonical_url: value('canonical'), featured_media_id: value('featured') };
  }

  function show(section) {
    if (section !== 'editor') clearTimeout(state.autosave);
    state.view = section;
    document.querySelectorAll('.studio-nav [data-view]').forEach(button => button.classList.toggle('active', button.dataset.view === section));
    $('editor').hidden = section !== 'editor'; $('article-list').hidden = section === 'editor' || section === 'media' || section === 'settings';
    $('media-panel').hidden = section !== 'media'; $('settings-panel').hidden = section !== 'settings';
    $('new-post').hidden = section === 'editor' || section === 'media' || section === 'settings';
    $('view-title').textContent = section === 'editor' ? 'Edit Article' : section === 'media' ? 'Media Library' : section === 'settings' ? 'Blog Settings' : section === 'all' ? 'All Articles' : `${section[0].toUpperCase()}${section.slice(1)} Articles`;
  }

  function fillEditor(post = null) {
    state.post = post; state.slugTouched = Boolean(post);
    for (const field of fields) if (field !== 'noindex') setValue(field, '');
    $('post-noindex').checked = Boolean(post?.noindex);
    setValue('author', post?.author_name || 'GXA Technologies');
    if (post) {
      for (const key of ['title','slug','excerpt','markdown','meta_title','meta_description','og_title','og_description','canonical_url','featured_media_id']) {
        const field = ({ meta_title:'meta-title', meta_description:'meta-description', og_title:'og-title', og_description:'og-description', canonical_url:'canonical', featured_media_id:'featured' })[key] || key;
        setValue(field, post[key]);
      }
      setValue('categories', (post.categories || []).join(', ')); setValue('tags', (post.tags || []).join(', '));
      setValue('schedule', post.scheduled_at ? new Date(post.scheduled_at).toISOString().slice(0, 16) : '');
    }
    $('slug-preview').textContent = value('slug') || 'your-article';
    $('unpublish-post').hidden = !post || !['published','scheduled'].includes(post.status);
    $('delete-post').hidden = !post || post.status === 'deleted';
    $('revision-list').replaceChildren();
    if (post?.revisions?.length) {
      const heading = document.createElement('h3'); heading.textContent = 'Revision history'; $('revision-list').append(heading);
      for (const revision of post.revisions) {
        const row = document.createElement('div'); row.className = 'revision-row';
        const label = document.createElement('span'); label.textContent = `Version ${revision.version} · ${new Date(revision.created_at).toLocaleString()}`;
        const button = document.createElement('button'); button.type = 'button'; button.textContent = 'Restore as draft';
        button.disabled = revision.version === post.version; button.addEventListener('click', () => restoreRevision(revision.version));
        row.append(label, button); $('revision-list').append(row);
      }
    }
    show('editor');
    updateEditorialReview();
    status(post ? `Editing version ${post.version}. Current state: ${post.status}.` : 'New articles start as drafts.');
  }

  async function loadList(filter = 'all') {
    show(filter); status('Loading articles…'); $('article-list').replaceChildren();
    try {
      const data = await api(`/.netlify/functions/blog-admin?status=${encodeURIComponent(filter)}`);
      if (!data.items.length) { const empty = document.createElement('p'); empty.textContent = 'No articles in this view.'; $('article-list').append(empty); }
      for (const item of data.items) {
        const row = document.createElement('article'); row.className = 'article-row';
        const copy = document.createElement('div'); const title = document.createElement('h3'); title.textContent = item.title;
        const details = document.createElement('p'); details.textContent = `${item.status} · /blog/${item.slug}/ · Updated ${new Date(item.updated_at).toLocaleString()}`;
        copy.append(title, details); const edit = document.createElement('button'); edit.type = 'button'; edit.textContent = 'Edit'; edit.addEventListener('click', () => loadPost(item.id));
        row.append(copy, edit); $('article-list').append(row);
      }
      status(`${data.items.length} article${data.items.length === 1 ? '' : 's'} loaded.`);
    } catch (error) { status(error.message, true); }
  }

  async function loadPost(id) {
    status('Loading article…');
    try { const data = await api(`/.netlify/functions/blog-admin?id=${encodeURIComponent(id)}`); fillEditor(data.post); }
    catch (error) { status(error.message, true); }
  }

  async function save(targetStatus, automatic = false) {
    if (state.busy) return;
    clearTimeout(state.autosave);
    if (!value('title').trim() || !value('slug').trim()) { if (!automatic) status('Add a title and URL slug.', true); return; }
    if (targetStatus === 'scheduled' && !value('schedule')) { status('Choose a schedule date and time.', true); return; }
    state.busy = true; if (!automatic) status('Saving article…');
    try {
      const path = `/.netlify/functions/blog-admin${state.post ? `?id=${encodeURIComponent(state.post.id)}` : ''}`;
      const result = await api(path, { method: state.post ? 'PATCH' : 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(articlePayload(targetStatus)) });
      const data = await api(`/.netlify/functions/blog-admin?id=${encodeURIComponent(result.post.id)}`);
      fillEditor(data.post);
      status(`${targetStatus === 'published' ? 'Published' : targetStatus === 'scheduled' ? 'Scheduled' : 'Saved as draft'}. ${result.cachePurged ? 'Public caches refreshed.' : 'Public cache refresh may take up to 30 seconds.'}`);
      $('autosave-status').textContent = automatic ? 'Draft autosaved.' : '';
    } catch (error) {
      status(error.status === 409 ? `${error.message} Your unsaved text remains in the editor.` : error.message, true);
      if (automatic) $('autosave-status').textContent = 'Autosave failed. Please save manually.';
    } finally { state.busy = false; }
  }

  async function restoreRevision(version) {
    if (!confirm(`Restore version ${version} as a draft? Your current published version will no longer be public.`)) return;
    try {
      const result = await api(`/.netlify/functions/blog-admin?id=${encodeURIComponent(state.post.id)}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action: 'restore_revision', revision: version, version: state.post.version }) });
      await loadPost(result.post.id); status('Revision restored as a draft.');
    } catch (error) { status(error.message, true); }
  }

  async function removePost() {
    if (!state.post || !confirm('Delete this article? It will return HTTP 410 and leave the public sitemap. This cannot be undone in Blog Studio.')) return;
    try {
      await api(`/.netlify/functions/blog-admin?id=${encodeURIComponent(state.post.id)}`, { method: 'DELETE', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ version: state.post.version }) });
      await loadList('all'); status('Article deleted.');
    } catch (error) { status(error.message, true); }
  }

  async function preview() {
    try {
      const response = await fetch('/.netlify/functions/blog-preview', { method: 'POST', credentials: 'same-origin', cache: 'no-store', headers: { 'Content-Type': 'text/plain; charset=utf-8', 'x-gxa-admin-request': '1' }, body: value('markdown') });
      if (!response.ok) throw new Error('Preview could not be rendered.');
      $('preview-dialog').querySelector('iframe').srcdoc = await response.text(); $('preview-dialog').showModal();
    } catch (error) { status(error.message, true); }
  }

  async function loadMedia() {
    show('media'); status('Loading media…'); $('media-list').replaceChildren();
    try {
      const data = await api('/.netlify/functions/blog-media-admin');
      for (const item of data.items) {
        const card = document.createElement('div'); card.className = 'media-item';
        const img = document.createElement('img'); img.src = `/.netlify/functions/blog-media-admin?id=${item.id}`; img.alt = item.alt_text; img.loading = 'lazy';
        const label = document.createElement('p'); label.textContent = item.alt_text;
        const insert = document.createElement('button'); insert.type = 'button'; insert.textContent = 'Use in article'; insert.addEventListener('click', () => {
          setValue('featured', item.id); const target = $('post-markdown'); target.value += `\n\n![${item.alt_text.replace(/[\[\]()]/g, '')}](/blog-media/${item.id})\n`;
          show('editor'); status('Image inserted in the article and selected as featured image. Save the article to publish it.');
        });
        card.append(img, label, insert); $('media-list').append(card);
      }
      status(`${data.items.length} media item${data.items.length === 1 ? '' : 's'} loaded.`);
    } catch (error) { status(error.message, true); }
  }

  document.querySelectorAll('.studio-nav [data-view]').forEach(button => button.addEventListener('click', () => button.dataset.view === 'media' ? loadMedia() : button.dataset.view === 'settings' ? (show('settings'), status('')) : loadList(button.dataset.view)));
  $('new-post').addEventListener('click', () => fillEditor());
  $('post-title').addEventListener('input', () => { if (!state.slugTouched) setValue('slug', slugify(value('title'))); $('slug-preview').textContent = value('slug') || 'your-article'; });
  $('post-slug').addEventListener('input', () => { state.slugTouched = true; $('slug-preview').textContent = value('slug') || 'your-article'; });
  document.querySelectorAll('.editor-tools [data-insert]').forEach(button => button.addEventListener('click', () => {
    const node = $('post-markdown'); const start = node.selectionStart, end = node.selectionEnd, text = button.dataset.insert;
    node.setRangeText(text, start, end, 'end'); node.focus(); node.dispatchEvent(new Event('input', { bubbles: true }));
  }));
  $('article-form').addEventListener('submit', event => event.preventDefault());
  $('article-form').addEventListener('input', () => {
    updateEditorialReview();
    clearTimeout(state.autosave);
    if (!state.post || state.post.status === 'draft') {
      $('autosave-status').textContent = 'Unsaved draft changes.';
      state.autosave = setTimeout(() => save('draft', true), 20000);
    }
  });
  $('save-draft').addEventListener('click', () => save('draft'));
  $('schedule-post').addEventListener('click', () => save('scheduled'));
  $('publish-post').addEventListener('click', () => save('published'));
  $('unpublish-post').addEventListener('click', () => save('draft'));
  $('delete-post').addEventListener('click', removePost);
  $('preview-post').addEventListener('click', preview);
  $('close-preview').addEventListener('click', () => $('preview-dialog').close());
  $('media-form').addEventListener('submit', async event => {
    event.preventDefault(); const file = $('media-file').files[0]; if (!file) return;
    if (file.size > 6 * 1024 * 1024) return status('Image must be under 6 MB.', true);
    status('Uploading and optimizing image…');
    try {
      const data = await api('/.netlify/functions/blog-media-admin', { method: 'POST', headers: {
        'Content-Type': file.type, 'x-gxa-image-alt': encodeURIComponent($('media-alt').value), 'x-gxa-image-caption': encodeURIComponent($('media-caption').value)
      }, body: file });
      setValue('featured', data.media.id); $('media-form').reset(); await loadMedia(); status('Image uploaded. Select it to insert into an article.');
    } catch (error) { status(error.message, true); }
  });

  api('/.netlify/functions/admin-session').then(data => {
    $('session-loading').hidden = true;
    if (!data.authenticated) { location.assign('/admin/'); return; }
    $('studio-app').hidden = false; loadList('all');
  }).catch(() => { $('session-loading').textContent = 'Administrator session could not be verified. Return to the Admin Dashboard and try again.'; });
})();
