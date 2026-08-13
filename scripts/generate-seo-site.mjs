import { cp, mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  PRODUCTION_ORIGIN,
  canonicalToolUrl,
  loadBlockedToolIds,
  loadToolRegistry,
  toolDescription,
  toolTitle
} from './tool-registry.mjs';

const projectRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const distRoot = resolve(projectRoot, 'dist');
if (dirname(distRoot) !== projectRoot) throw new Error('Refusing to generate outside the repository root.');

const escapeHtml = value => String(value).replace(/[&<>"']/g, character => ({
  '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
})[character]);
const escapeXml = value => escapeHtml(value);
const escapeScriptJson = value => JSON.stringify(value, null, 2).replace(/</g, '\\u003c');

function replaceHeadValue(html, pattern, replacement, label) {
  if (!pattern.test(html)) throw new Error(`Unable to update ${label} in the HTML template.`);
  return html.replace(pattern, replacement);
}

function pageGraph({ name, description, url, category }) {
  return {
    '@context': 'https://schema.org',
    '@graph': [
      {
        '@type': 'WebApplication',
        '@id': `${url}#application`,
        name,
        description,
        url,
        applicationCategory: category === 'utility' ? 'DeveloperApplication' : 'UtilitiesApplication',
        operatingSystem: 'Any',
        browserRequirements: 'Requires a modern web browser',
        brand: { '@type': 'Brand', name: 'GXA Toolbox' },
        publisher: { '@id': `${PRODUCTION_ORIGIN}/#organization` },
        isPartOf: { '@id': `${PRODUCTION_ORIGIN}/#website` }
      },
      {
        '@type': 'BreadcrumbList',
        '@id': `${url}#breadcrumb`,
        itemListElement: [
          { '@type': 'ListItem', position: 1, name: 'GXA Toolbox', item: `${PRODUCTION_ORIGIN}/` },
          { '@type': 'ListItem', position: 2, name, item: url }
        ]
      }
    ]
  };
}

function homepageGraph() {
  return {
    '@context': 'https://schema.org',
    '@graph': [
      {
        '@type': 'Organization',
        '@id': `${PRODUCTION_ORIGIN}/#organization`,
        name: 'GXA Technologies',
        url: `${PRODUCTION_ORIGIN}/`,
        logo: `${PRODUCTION_ORIGIN}/gxa-logo.png`,
        brand: { '@type': 'Brand', name: 'GXA Toolbox' }
      },
      {
        '@type': 'WebSite',
        '@id': `${PRODUCTION_ORIGIN}/#website`,
        name: 'GXA Toolbox',
        url: `${PRODUCTION_ORIGIN}/`,
        publisher: { '@id': `${PRODUCTION_ORIGIN}/#organization` }
      },
      {
        '@type': 'WebApplication',
        '@id': `${PRODUCTION_ORIGIN}/#application`,
        name: 'GXA Toolbox',
        slogan: 'Your Complete Digital Toolbox',
        description: 'Use browser-based tools for PDFs, images, file conversions, QR codes, ZIP files, developer utilities, and everyday calculations with GXA Toolbox.',
        url: `${PRODUCTION_ORIGIN}/`,
        applicationCategory: 'UtilitiesApplication',
        operatingSystem: 'Any',
        brand: { '@type': 'Brand', name: 'GXA Toolbox' },
        publisher: { '@id': `${PRODUCTION_ORIGIN}/#organization` },
        isPartOf: { '@id': `${PRODUCTION_ORIGIN}/#website` }
      }
    ]
  };
}

function applyMetadata(template, { title, description, canonical, robots, graph, staticContent }) {
  let html = template;
  html = replaceHeadValue(html, /<title>[\s\S]*?<\/title>/, `<title>${escapeHtml(title)}</title>`, 'title');
  html = replaceHeadValue(html, /<meta name="description" content="[^"]*">/, `<meta name="description" content="${escapeHtml(description)}">`, 'description');
  html = replaceHeadValue(html, /<meta name="robots" content="[^"]*">/, `<meta name="robots" content="${escapeHtml(robots)}">`, 'robots');
  html = replaceHeadValue(html, /<meta property="og:title" content="[^"]*">/, `<meta property="og:title" content="${escapeHtml(title)}">`, 'Open Graph title');
  html = replaceHeadValue(html, /<meta property="og:description" content="[^"]*">/, `<meta property="og:description" content="${escapeHtml(description)}">`, 'Open Graph description');
  html = replaceHeadValue(html, /<meta property="og:url" content="[^"]*">/, `<meta property="og:url" content="${escapeHtml(canonical)}">`, 'Open Graph URL');
  html = replaceHeadValue(html, /<meta name="twitter:title" content="[^"]*">/, `<meta name="twitter:title" content="${escapeHtml(title)}">`, 'Twitter title');
  html = replaceHeadValue(html, /<meta name="twitter:description" content="[^"]*">/, `<meta name="twitter:description" content="${escapeHtml(description)}">`, 'Twitter description');
  html = replaceHeadValue(html, /<link rel="canonical" href="[^"]*">/, `<link rel="canonical" href="${escapeHtml(canonical)}">`, 'canonical');
  html = replaceHeadValue(html, /<script id="gxa-structured-data" type="application\/ld\+json">[\s\S]*?<\/script>/, `<script id="gxa-structured-data" type="application/ld+json">\n${escapeScriptJson(graph)}\n  </script>`, 'structured data');
  html = replaceHeadValue(html, /<main id="main-content" class="main-body" role="main">[\s\S]*?<\/main>/, `<main id="main-content" class="main-body" role="main">\n${staticContent}\n    </main>`, 'static route content');
  return html;
}

function toolStaticContent(tool) {
  return `      <section class="container tool-container static-route-shell" data-static-route-shell>
        <nav class="breadcrumb" aria-label="Breadcrumb"><a class="breadcrumb-link" href="/">Home</a><span aria-hidden="true">&gt;</span><span>${escapeHtml(tool.name)}</span></nav>
        <span class="tool-category-label">${escapeHtml(tool.category)} tool</span>
        <h1 class="tool-page-title">${escapeHtml(tool.name)}</h1>
        <p class="tool-page-description">${escapeHtml(tool.desc)}</p>
      </section>`;
}

function homepageStaticContent() {
  return `      <section class="hero-section premium-hero static-route-shell static-home-shell" data-static-route-shell>
        <div class="container hero-content">
          <h1 class="hero-headline">Your Complete <span>Digital Toolbox</span></h1>
          <p class="hero-subheadline">Access powerful browser-based tools for PDFs, images, file conversions, QR codes, ZIP files, developer utilities, and everyday calculations — all in one place.</p>
        </div>
      </section>`;
}

function dashboardStaticContent() {
  return `      <section class="container tool-container static-route-shell" data-static-route-shell>
        <h1 class="tool-page-title">GXA Toolbox Dashboard</h1>
        <p class="tool-page-description">Sign in to access your private GXA Toolbox processing history and account dashboard.</p>
        <p><a class="btn btn-primary" href="/">Return to GXA Toolbox</a></p>
      </section>`;
}

function notFoundHtml() {
  return `<!doctype html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">
  <title>Page Not Found | GXA Toolbox</title>
  <meta name="description" content="The requested GXA Toolbox page could not be found.">
  <meta name="robots" content="noindex, nofollow">
  <meta name="theme-color" content="#2563EB">
  <link rel="icon" href="/favicon-32x32.png" sizes="32x32" type="image/png">
  <link rel="stylesheet" href="/assets/style.css?v=seo-20260813">
</head>
<body class="light-mode">
  <main class="main-body"><section class="container static-route-shell not-found-shell">
    <a class="logo" href="/" aria-label="GXA Toolbox home"><span class="logo-icon"><img src="/gxa-logo.png" width="256" height="256" alt=""></span><span class="logo-text">GXA <span>Toolbox</span></span></a>
    <p class="section-kicker">404 error</p><h1 class="tool-page-title">Page not found</h1>
    <p class="tool-page-description">The address may be incorrect or the page may have moved.</p>
    <p><a class="btn btn-primary" href="/">Return home</a></p>
  </section></main>
</body>
</html>\n`;
}

async function writeRoute(pathname, html) {
  const directory = join(distRoot, pathname);
  await mkdir(directory, { recursive: true });
  await writeFile(join(directory, 'index.html'), html, 'utf8');
}

function routeAuditMarkdown(tools, blockedIds) {
  const rows = tools.map(tool => {
    const indexable = !blockedIds.has(tool.id);
    const remarks = indexable
      ? 'Public tool landing; generated static shell hydrates into the existing tool workspace.'
      : 'Publicly reachable but noindex until the documented presentation-renderer blocker is resolved.';
    return `| \`/${tool.id}/\` | ${tool.name.replace(/\|/g, '\\|')} | ${tool.category} | ${indexable ? 'Yes' : 'No'} | ${canonicalToolUrl(tool.id)} | ${indexable ? 'Yes' : 'No'} | Unique | Unique | Generated HTML + hydration | Crawlable anchors | ${remarks} |`;
  });
  return `# GXA Toolbox SEO route audit\n\nGenerated deterministically from the central 91-tool registry by \`scripts/generate-seo-site.mjs\`. Do not edit the table by hand.\n\n- Registered tools: **${tools.length}**\n- Indexable tool routes: **${tools.length - blockedIds.size}**\n- Noindex tool routes: **${blockedIds.size}**\n- Sitemap URLs: **${1 + tools.length - blockedIds.size}** (homepage plus indexable tools)\n- Category filter states are not separate URLs and are intentionally excluded to avoid thin duplicate pages.\n- \`/all-tools/\` permanently redirects to the homepage tool directory rather than creating a duplicate page.\n- Dashboard, API, authentication state, fragments, query variants, outputs, and unknown paths are excluded.\n\n| Route | Tool name | Category | Indexable | Canonical URL | Sitemap | Title | Description | Direct load | Internal link | Remarks |\n|---|---|---|---|---|---|---|---|---|---|---|\n${rows.join('\n')}\n`;
}

async function main() {
  const [tools, blockedIds, baseTemplate] = await Promise.all([
    loadToolRegistry(),
    loadBlockedToolIds(),
    readFile(join(projectRoot, 'index.html'), 'utf8')
  ]);
  for (const id of blockedIds) {
    if (!tools.some(tool => tool.id === id)) throw new Error(`Blocker references an unknown tool: ${id}`);
  }

  await rm(distRoot, { recursive: true, force: true });
  await mkdir(distRoot, { recursive: true });
  await cp(join(projectRoot, 'public_html', 'assets'), join(distRoot, 'assets'), { recursive: true });
  await cp(join(projectRoot, 'public_html', 'background-remover'), join(distRoot, 'background-remover'), { recursive: true });
  for (const file of ['apple-touch-icon.png', 'favicon-32x32.png', 'favicon-192x192.png', 'favicon-512x512.png', 'gxa-logo.png', 'site.webmanifest']) {
    await cp(join(projectRoot, file), join(distRoot, file));
  }

  const homeDescription = 'Use browser-based tools for PDFs, images, file conversions, QR codes, ZIP files, developer utilities, and everyday calculations with GXA Toolbox.';
  const homeHtml = applyMetadata(baseTemplate, {
    title: 'GXA Toolbox — Your Complete Digital Toolbox',
    description: homeDescription,
    canonical: `${PRODUCTION_ORIGIN}/`,
    robots: 'index, follow',
    graph: homepageGraph(),
    staticContent: homepageStaticContent()
  });
  await writeFile(join(distRoot, 'index.html'), homeHtml, 'utf8');

  for (const tool of tools) {
    if (tool.id === 'background-remover') continue;
    const description = toolDescription(tool);
    await writeRoute(tool.id, applyMetadata(baseTemplate, {
      title: toolTitle(tool),
      description,
      canonical: canonicalToolUrl(tool.id),
      robots: blockedIds.has(tool.id) ? 'noindex, follow' : 'index, follow',
      graph: pageGraph({ name: tool.name, description, url: canonicalToolUrl(tool.id), category: tool.category }),
      staticContent: toolStaticContent(tool)
    }));
  }

  const background = tools.find(tool => tool.id === 'background-remover');
  const backgroundPath = join(distRoot, 'background-remover', 'index.html');
  let backgroundHtml = await readFile(backgroundPath, 'utf8');
  const backgroundDescription = toolDescription(background);
  const backgroundCanonical = canonicalToolUrl(background.id);
  const removableHeadEntries = [
    /\s*<meta\s+name="(?:description|robots|twitter:card|twitter:title|twitter:description|twitter:image|twitter:image:alt)"[^>]*\/>?/gi,
    /\s*<meta\s+property="(?:og:site_name|og:type|og:title|og:description|og:url|og:image|og:image:alt)"[^>]*\/>?/gi,
    /\s*<link\s+rel="canonical"[^>]*\/>?/gi,
    /\s*<script\s+id="gxa-structured-data"[^>]*>[\s\S]*?<\/script>/gi
  ];
  for (const pattern of removableHeadEntries) backgroundHtml = backgroundHtml.replace(pattern, '');
  const backgroundHead = `
    <meta name="description" content="${escapeHtml(backgroundDescription)}" />
    <meta name="robots" content="index, follow" />
    <link rel="canonical" href="${backgroundCanonical}" />
    <meta property="og:site_name" content="GXA Toolbox" />
    <meta property="og:type" content="website" />
    <meta property="og:title" content="${escapeHtml(toolTitle(background))}" />
    <meta property="og:description" content="${escapeHtml(backgroundDescription)}" />
    <meta property="og:url" content="${backgroundCanonical}" />
    <meta property="og:image" content="${PRODUCTION_ORIGIN}/gxa-logo.png" />
    <meta property="og:image:alt" content="GXA Toolbox logo" />
    <meta name="twitter:card" content="summary" />
    <meta name="twitter:title" content="${escapeHtml(toolTitle(background))}" />
    <meta name="twitter:description" content="${escapeHtml(backgroundDescription)}" />
    <meta name="twitter:image" content="${PRODUCTION_ORIGIN}/gxa-logo.png" />
    <meta name="twitter:image:alt" content="GXA Toolbox logo" />
    <script id="gxa-structured-data" type="application/ld+json">${escapeScriptJson(pageGraph({
      name: background.name,
      description: backgroundDescription,
      url: backgroundCanonical,
      category: background.category
    }))}</script>`;
  backgroundHtml = replaceHeadValue(
    backgroundHtml,
    /<title>[\s\S]*?<\/title>/,
    `<title>${escapeHtml(toolTitle(background))}</title>`,
    'Background Remover title'
  );
  backgroundHtml = replaceHeadValue(backgroundHtml, /<\/head>/, `${backgroundHead}\n  </head>`, 'Background Remover head');
  backgroundHtml = replaceHeadValue(
    backgroundHtml,
    /<div id="root">[\s\S]*?<\/div>/,
    `<div id="root"><main class="static-background-shell"><h1>${escapeHtml(background.name)}</h1><p>${escapeHtml(background.desc)}</p></main></div>`,
    'Background Remover static route content'
  );
  await writeFile(backgroundPath, backgroundHtml, 'utf8');

  const dashboardHtml = applyMetadata(baseTemplate, {
    title: 'Dashboard | GXA Toolbox',
    description: 'Sign in to access your private GXA Toolbox processing history and account dashboard.',
    canonical: `${PRODUCTION_ORIGIN}/dashboard/`,
    robots: 'noindex, nofollow, noarchive',
    graph: homepageGraph(),
    staticContent: dashboardStaticContent()
  });
  await writeRoute('dashboard', dashboardHtml);

  const indexable = tools.filter(tool => !blockedIds.has(tool.id)).sort((a, b) => a.id.localeCompare(b.id));
  const sitemapUrls = [`${PRODUCTION_ORIGIN}/`, ...indexable.map(tool => canonicalToolUrl(tool.id))];
  const sitemap = `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${sitemapUrls.map(url => `  <url><loc>${escapeXml(url)}</loc></url>`).join('\n')}\n</urlset>\n`;
  await writeFile(join(distRoot, 'sitemap.xml'), sitemap, 'utf8');
  await cp(join(projectRoot, 'robots.txt'), join(distRoot, 'robots.txt'));
  await writeFile(join(distRoot, '404.html'), notFoundHtml(), 'utf8');
  await writeFile(join(projectRoot, 'docs', 'SEO_ROUTE_AUDIT.md'), routeAuditMarkdown(tools, blockedIds), 'utf8');

  console.log(`Generated ${tools.length} tool routes, ${sitemapUrls.length} sitemap URLs, robots.txt, and a real 404 in dist/.`);
}

await main();
