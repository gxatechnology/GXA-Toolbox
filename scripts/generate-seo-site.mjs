import { cp, mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  ADSENSE_PUBLISHER_ID,
  ADSENSE_SELLER_LINE,
  ADSENSE_TEMPLATE_TOKEN,
  injectAdSensePublisherId
} from '../config/adsense-config.mjs';
import {
  PRODUCTION_ORIGIN,
  canonicalContentUrl,
  canonicalToolUrl,
  loadBlockedToolIds,
  loadContentPageRegistry,
  loadToolContentRegistry,
  loadToolRegistry,
  toolDescription,
  toolTitle
} from './tool-registry.mjs';

const projectRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const distRoot = resolve(projectRoot, 'dist');
const adsenseBlockPattern = /\s*<!-- Google AdSense -->[\s\S]*?<!-- End Google AdSense -->/i;
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

function withoutAdSense(html) {
  if (!adsenseBlockPattern.test(html)) throw new Error('Unable to locate the AdSense loader in the HTML template.');
  return html.replace(adsenseBlockPattern, '');
}

function pageGraph({ name, description, url, category, content }) {
  const graph = [
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
  ];
  if (content?.faqs?.length) graph.push({
    '@type': 'FAQPage',
    '@id': `${url}#faq`,
    mainEntity: content.faqs.map(item => ({ '@type': 'Question', name: item.question, acceptedAnswer: { '@type': 'Answer', text: item.answer } }))
  });
  return {
    '@context': 'https://schema.org',
    '@graph': graph
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

function contentPageGraph(page) {
  const url = canonicalContentUrl(page.id);
  return {
    '@context': 'https://schema.org',
    '@graph': [
      {
        '@type': 'WebPage',
        '@id': `${url}#webpage`,
        name: page.name,
        description: page.description,
        url,
        isPartOf: { '@id': `${PRODUCTION_ORIGIN}/#website` },
        publisher: { '@id': `${PRODUCTION_ORIGIN}/#organization` }
      },
      {
        '@type': 'BreadcrumbList',
        '@id': `${url}#breadcrumb`,
        itemListElement: [
          { '@type': 'ListItem', position: 1, name: 'GXA Toolbox', item: `${PRODUCTION_ORIGIN}/` },
          { '@type': 'ListItem', position: 2, name: page.name, item: url }
        ]
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

function toolStaticContent(tool, content, tools) {
  const section = (title, body) => body ? `<section class="tool-info-section"><h2>${escapeHtml(title)}</h2>${body}</section>` : '';
  const cards = items => items?.length ? `<div class="tool-info-card-grid">${items.map(item => `<article><h3>${escapeHtml(item.title)}</h3><p>${escapeHtml(item.description)}</p></article>`).join('')}</div>` : '';
  const intro = content ? `<section class="tool-preworkspace-intro" aria-labelledby="${escapeHtml(tool.id)}-overview-title">
          <h2 id="${escapeHtml(tool.id)}-overview-title" class="sr-only">${escapeHtml(tool.name)} overview</h2>
          <p>${escapeHtml(content.about[0])}</p>
          <ul>${content.features.slice(0, 3).map(item => `<li><strong>${escapeHtml(item.title)}</strong><span>${escapeHtml(item.description)}</span></li>`).join('')}</ul>
        </section>` : '';
  const guide = content ? `<article class="tool-content-guide" aria-label="${escapeHtml(tool.name)} guide">
        ${section('About This Tool', content.about.map(paragraph => `<p>${escapeHtml(paragraph)}</p>`).join(''))}
        ${section('What You Can Do', cards(content.features))}
        ${section('How to Use', `<ol class="tool-steps">${content.howToUse.map(item => `<li><span>${item.step}</span><div><h3>${escapeHtml(item.title)}</h3><p>${escapeHtml(item.description)}</p></div></li>`).join('')}</ol>`)}
        ${section('Practical Use Cases', cards(content.useCases))}
        ${section('Privacy and File Processing', `<div class="tool-info-note"><strong>${escapeHtml(content.privacy.processingMode)}</strong><p>${escapeHtml(content.privacy.description)}</p></div>`)}
        ${section('Supported Inputs and Outputs', `<div class="tool-format-grid"><div><h3>Input</h3><ul>${content.supportedFormats.input.map(item => `<li>${escapeHtml(item)}</li>`).join('')}</ul></div><div><h3>Output</h3><ul>${content.supportedFormats.output.map(item => `<li>${escapeHtml(item)}</li>`).join('')}</ul></div></div>`)}
        ${content.formula || content.howItWorks ? section(content.formula ? 'Formula / Method' : 'How It Works', `<div class="tool-info-note"><p>${escapeHtml(content.formula || content.howItWorks)}</p></div>`) : ''}
        ${content.inputExplanation?.length ? section('Input Explanation', cards(content.inputExplanation)) : ''}
        ${content.resultExplanation ? section('Understanding the Result', `<div class="tool-info-note"><p>${escapeHtml(content.resultExplanation)}</p></div>`) : ''}
        ${content.assumptions?.length ? section('Assumptions', `<ul>${content.assumptions.map(item => `<li>${escapeHtml(item)}</li>`).join('')}</ul>`) : ''}
        ${content.quality ? section('Quality and Fidelity', `<div class="tool-info-note"><p>${escapeHtml(content.quality)}</p></div>`) : ''}
        ${section('Limitations and Important Notes', `<ul>${content.limitations.map(item => `<li>${escapeHtml(item)}</li>`).join('')}</ul>`)}
        ${content.examples?.length ? section('Worked Example', content.examples.map(item => `<div class="tool-example"><p>${escapeHtml(item)}</p></div>`).join('')) : ''}
        ${content.tips?.length ? section('Helpful Tips', `<ul>${content.tips.map(item => `<li>${escapeHtml(item)}</li>`).join('')}</ul>`) : ''}
        ${section('Frequently Asked Questions', `<div class="faq-list">${content.faqs.map(item => `<article class="faq-item"><h3>${escapeHtml(item.question)}</h3><p>${escapeHtml(item.answer)}</p></article>`).join('')}</div>`)}
        ${section('Related Tools', `<div class="content-related-links">${content.relatedTools.map(id => `<a href="/${escapeHtml(id)}/">${escapeHtml(tools.find(item => item.id === id)?.name || id.replace(/-/g, ' '))}</a>`).join('')}</div>`)}
      </article>` : '';
  return `      <section class="container tool-container static-route-shell" data-static-route-shell>
        <nav class="breadcrumb" aria-label="Breadcrumb"><a class="breadcrumb-link" href="/">Home</a><span aria-hidden="true">&gt;</span><span>${escapeHtml(tool.name)}</span></nav>
        <span class="tool-category-label">${escapeHtml(tool.category)} tool</span>
        <h1 class="tool-page-title">${escapeHtml(tool.name)}</h1>
        <p class="tool-page-description">${escapeHtml(tool.desc)}</p>
        ${intro}
        ${guide}
      </section>`;
}

function homepageStaticContent() {
  return `      <section class="hero-section premium-hero static-route-shell static-home-shell" data-static-route-shell>
        <div class="container hero-content">
          <h1 class="hero-headline">Your Complete <span>Digital Toolbox</span></h1>
          <p class="hero-subheadline">Access powerful browser-based tools for PDFs, images, file conversions, QR codes, ZIP files, developer utilities, and everyday calculations — all in one place.</p>
          <p>GXA Toolbox provides focused utilities that open as direct public routes, so you can choose a task, review its real controls and limitations, and create a result without installing a desktop suite. Many file workflows run in browser memory; tools that use another service disclose that boundary on their own page.</p>
          <div class="content-related-links" aria-label="Popular GXA Toolbox tools"><a href="/compress-pdf/">Compress PDF</a><a href="/edit-pdf/">Edit PDF</a><a href="/image-converter/">Image Converter</a><a href="/background-remover/">Background Remover</a><a href="/json-tool/">JSON Formatter</a><a href="/emi-calculator/">EMI Calculator</a></div>
        </div>
        <div class="container tool-content-guide" aria-label="GXA Toolbox categories and approach">
          <section class="tool-info-section"><h2>Tools for documents, images, data, and calculations</h2><div class="tool-info-card-grid">
            <article><h3>PDF workflows</h3><p>Merge, organize, compress, edit, protect, extract, convert, watermark, or number PDFs with page-aware controls and honest format limits.</p></article>
            <article><h3>Image workflows</h3><p>Compress, resize, crop, convert, inspect metadata, extract colors, run English OCR, or create an editable foreground cutout.</p></article>
            <article><h3>Converters and archives</h3><p>Move supported content between documented formats, or create and inspect ZIP files while retaining the original source for verification.</p></article>
            <article><h3>Developer utilities</h3><p>Format JSON, SQL, HTML, CSS, and JavaScript; encode data; compare text; generate UUIDs; calculate hashes; and inspect timestamps.</p></article>
            <article><h3>QR and barcode tools</h3><p>Create supported QR or barcode graphics and decode compatible symbols when the browser exposes the required detector.</p></article>
            <article><h3>Everyday calculators</h3><p>Work through arithmetic, EMI, loan, GST, interest, SIP, date, age, time, percentage, and unit scenarios with visible formulas and assumptions.</p></article>
          </div></section>
          <section class="tool-info-section"><h2>Built around inspectable results</h2><p>Each public tool page explains its supported inputs and outputs, how the operation works, practical use cases, privacy boundary, limitations, and result checks. GXA Toolbox does not treat a generated file or calculation as automatically correct: important outputs should be opened, compared with the source, and checked in their destination workflow.</p></section>
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

function helpToolDirectoryStaticContent(page, tools) {
  if (!page.toolDirectory) return '';
  const groups = [
    ['pdf', 'PDF Tools'],
    ['image', 'Image Tools'],
    ['convert', 'Converters'],
    ['utility', 'Developer Tools & Generators'],
    ['calculator', 'Calculators'],
    ['zip', 'Archive & ZIP Tools']
  ];
  const workflowFor = tool => {
    if (tool.category === 'calculator') return 'Enter the labelled values, review any units or assumptions, then calculate and check the result.';
    if (tool.category === 'utility') return 'Enter the requested text or options, run or review the live result, then copy or download it when that action is available.';
    if (tool.category === 'zip') return 'Choose the archive or source files, review the entry list and options, then create or extract the requested output.';
    return 'Choose the supported source file, adjust the settings shown for this task, run the named action, then inspect and download the result.';
  };
  return `<section class="help-tool-directory" id="tool-guide" aria-labelledby="tool-guide-title">
            <div class="help-tool-directory__heading"><span class="section-kicker">${tools.length} focused routes</span><h2 id="tool-guide-title">GXA Toolbox tool guide</h2><p>Every item below opens its own task-focused workspace. Use the short workflow as a starting point, then read the supported formats and limitations on that tool page.</p></div>
            ${groups.map(([category, title]) => {
              const categoryTools = tools.filter(tool => tool.category === category);
              return `<details class="help-tool-group"><summary id="help-${category}-title"><span>${escapeHtml(title)}</span><small>${categoryTools.length} tools</small></summary><div class="help-tool-grid">${categoryTools.map(tool => `<article class="help-tool-card"><h4><a href="/${escapeHtml(tool.id)}/">${escapeHtml(tool.name)}</a></h4><p>${escapeHtml(tool.desc)} ${escapeHtml(workflowFor(tool))}</p></article>`).join('')}</div></details>`;
            }).join('')}
          </section>`;
}

function contentPageStaticContent(page, tools) {
  const tableOfContents = page.sections.map(section => `<a href="#${escapeHtml(section.id)}">${escapeHtml(section.title)}</a>`).join('') + (page.toolDirectory ? '<a href="#tool-guide">Tool guide</a>' : '');
  const sections = page.sections.map(section => `
          <section class="content-section" id="${escapeHtml(section.id)}">
            <h2>${escapeHtml(section.title)}</h2>
            ${(section.paragraphs || []).map(paragraph => `<p>${escapeHtml(paragraph)}</p>`).join('')}
            ${section.bullets?.length ? `<ul>${section.bullets.map(item => `<li>${escapeHtml(item)}</li>`).join('')}</ul>` : ''}
            ${section.note ? `<div class="content-note"><p>${escapeHtml(section.note)}</p></div>` : ''}
          </section>`).join('');
  const related = page.related?.length ? `
          <section class="content-related" aria-labelledby="related-information-title">
            <h2 id="related-information-title">Related information</h2>
            <div class="content-related-links">${page.related.map(link => `<a href="/${escapeHtml(link.id)}/">${escapeHtml(link.label)}</a>`).join('')}</div>
          </section>` : '';

  return `      <article class="content-page static-route-shell" data-static-route-shell>
        <header class="content-page-hero">
          <div class="container content-page-hero-inner">
            <nav class="breadcrumb" aria-label="Breadcrumb"><a class="breadcrumb-link" href="/">Home</a><span aria-hidden="true">&gt;</span><span>${escapeHtml(page.name)}</span></nav>
            <span class="section-kicker">${escapeHtml(page.eyebrow)}</span>
            <h1>${escapeHtml(page.name)}</h1>
            <p>${escapeHtml(page.intro)}</p>
            ${page.updated ? `<p class="content-page-updated">Last updated: ${escapeHtml(page.updated)}</p>` : ''}
          </div>
        </header>
        <div class="container content-page-layout">
          <aside class="content-toc" aria-label="On this page"><strong>On this page</strong><nav>${tableOfContents}</nav></aside>
          <div class="content-page-body">
            ${sections}
            ${helpToolDirectoryStaticContent(page, tools)}
            ${related}
            <section class="content-cta">
              <div><span class="section-kicker">Contact</span><h2>${escapeHtml(page.cta.title)}</h2><p>${escapeHtml(page.cta.text)}</p></div>
              <a href="/?support=1" class="btn btn-primary">${escapeHtml(page.cta.label)}</a>
            </section>
          </div>
        </div>
      </article>`;
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

function routeAuditMarkdown(tools, blockedIds, contentPages) {
  const rows = tools.map(tool => {
    const indexable = !blockedIds.has(tool.id);
    const remarks = indexable
      ? 'Public tool landing; generated static shell hydrates into the existing tool workspace.'
      : 'Publicly reachable but noindex until the documented presentation-renderer blocker is resolved.';
    return `| \`/${tool.id}/\` | ${tool.name.replace(/\|/g, '\\|')} | ${tool.category} | ${indexable ? 'Yes' : 'No'} | ${canonicalToolUrl(tool.id)} | ${indexable ? 'Yes' : 'No'} | Unique | Unique | Generated HTML + hydration | Crawlable anchors | ${remarks} |`;
  });
  const contentRows = contentPages.map(page => `| \`/${page.id}/\` | ${page.name.replace(/\|/g, '\\|')} | Yes | ${canonicalContentUrl(page.id)} | Yes | Unique | Unique | Generated HTML + hydration | Global footer | Company/legal information page |`);
  const sitemapCount = 1 + tools.length - blockedIds.size + contentPages.length;
  return `# GXA Toolbox SEO route audit\n\nGenerated deterministically from the central tool and company/legal registries by \`scripts/generate-seo-site.mjs\`. Do not edit the tables by hand.\n\n- Registered tools: **${tools.length}**\n- Indexable tool routes: **${tools.length - blockedIds.size}**\n- Noindex tool routes: **${blockedIds.size}**\n- Company/legal routes: **${contentPages.length}**\n- Sitemap URLs: **${sitemapCount}** (homepage, indexable tools, and company/legal pages)\n- Category filter states are not separate URLs and are intentionally excluded to avoid thin duplicate pages.\n- \`/all-tools/\` permanently redirects to the homepage tool directory rather than creating a duplicate page.\n- Dashboard, API, authentication state, fragments, query variants, outputs, and unknown paths are excluded.\n\n## Tool routes\n\n| Route | Tool name | Category | Indexable | Canonical URL | Sitemap | Title | Description | Direct load | Internal link | Remarks |\n|---|---|---|---|---|---|---|---|---|---|---|\n${rows.join('\n')}\n\n## Company and legal routes\n\n| Route | Page | Indexable | Canonical URL | Sitemap | Title | Description | Direct load | Internal link | Remarks |\n|---|---|---|---|---|---|---|---|---|---|\n${contentRows.join('\n')}\n`;
}

function toolContentInventoryMarkdown(tools, toolContent) {
  const imageFocusedIds = new Set(['compress-image', 'resize-image', 'image-converter', 'gps-map-camera', 'crop-image', 'image-ocr', 'background-remover', 'color-extractor', 'qr-reader', 'barcode-reader', 'exif-viewer']);
  const pdfRelated = tool => tool.category === 'pdf' || (tool.category === 'convert' && tool.id.includes('pdf'));
  const categoryOrder = ['pdf', 'image', 'convert', 'zip', 'utility', 'calculator'];
  const groups = categoryOrder.map(category => {
    const rows = tools.filter(tool => tool.category === category).map(tool => {
      const hasContent = Boolean(toolContent[tool.id]);
      const source = tool.id === 'background-remover' ? 'Dedicated React/Vite route plus shared registry metadata' : 'Shared `renderToolPage` workspace and central registry';
      const notes = tool.id === 'background-remover' ? 'Dedicated application; preserve its independent build.' : tool.id === 'ppt-to-pdf' ? 'Browser-local basic PPTX renderer; advanced PowerPoint fidelity is limited.' : 'Uses the shared browser-first tool workspace.';
      const priority = pdfRelated(tool) ? 'Completed in Part 2 PDF content batch' : imageFocusedIds.has(tool.id) ? 'Completed in Part 3 image content batch' : hasContent && category === 'convert' ? 'Completed in Part 4 conversion content batch' : hasContent && category === 'utility' ? 'Completed in Part 5 developer/utility content batch' : hasContent && category === 'calculator' ? 'Completed in Part 6 calculator content batch' : hasContent && category === 'zip' ? 'Completed in Part 7 ZIP content batch' : 'Later content batch';
      return `| ${tool.name.replace(/\|/g, '\\|')} | \`/${tool.id}/\` | ${category} | ${source} | Yes | ${hasContent ? 'No — expanded' : 'Yes'} | ${notes} | ${priority} |`;
    });
    return `## ${category[0].toUpperCase()}${category.slice(1)} (${rows.length})\n\n| Tool | Route | Category | Page/data source | FAQs | Thin content | Technical notes | Content priority |\n|---|---|---|---|---|---|---|---|\n${rows.join('\n')}`;
  });
  const pdfCount = tools.filter(pdfRelated).length;
  const imageCount = tools.filter(tool => imageFocusedIds.has(tool.id)).length;
  const conversionCount = Object.keys(toolContent).filter(id => tools.find(tool => tool.id === id)?.category === 'convert' && !pdfRelated(tools.find(tool => tool.id === id))).length;
  const utilityCount = tools.filter(tool => tool.category === 'utility' && !imageFocusedIds.has(tool.id) && toolContent[tool.id]).length;
  const calculatorCount = tools.filter(tool => tool.category === 'calculator' && toolContent[tool.id]).length;
  const zipCount = tools.filter(tool => tool.category === 'zip' && toolContent[tool.id]).length;
  return `# GXA Toolbox tool-content inventory\n\nGenerated from the ${tools.length}-tool registry and the shared content model. Expanded entries are maintained centrally and rendered into both the live application and generated SEO pages.\n\n- Registered tools: **${tools.length}**\n- Expanded content pages: **${Object.keys(toolContent).length}**\n- Part 2 PDF-related pages: **${pdfCount}**\n- Part 3 image-focused pages: **${imageCount}**\n- Part 4 additional conversion pages: **${conversionCount}**\n- Part 5 additional developer/utility pages: **${utilityCount}**\n- Part 6 calculator pages: **${calculatorCount}**\n- Part 7 ZIP pages: **${zipCount}**\n- Remaining pages for later content batches: **${tools.length - Object.keys(toolContent).length}**\n\n${groups.join('\n\n')}\n`;
}

async function main() {
  const [tools, blockedIds, contentPages, toolContent, baseTemplateSource] = await Promise.all([
    loadToolRegistry(),
    loadBlockedToolIds(),
    loadContentPageRegistry(),
    loadToolContentRegistry(),
    readFile(join(projectRoot, 'index.html'), 'utf8')
  ]);
  const baseTemplate = injectAdSensePublisherId(baseTemplateSource, 'main public HTML template');
  for (const id of blockedIds) {
    if (!tools.some(tool => tool.id === id)) throw new Error(`Blocker references an unknown tool: ${id}`);
  }
  for (const id of Object.keys(toolContent)) {
    if (!tools.some(tool => tool.id === id)) throw new Error(`Tool content references an unknown tool: ${id}`);
  }

  await rm(distRoot, { recursive: true, force: true });
  await mkdir(distRoot, { recursive: true });
  await cp(join(projectRoot, 'public_html', 'assets'), join(distRoot, 'assets'), { recursive: true });
  const leafletSource = join(projectRoot, 'node_modules', 'leaflet', 'dist');
  const leafletDestination = join(distRoot, 'assets', 'vendor', 'leaflet');
  await mkdir(leafletDestination, { recursive: true });
  await Promise.all([
    cp(join(leafletSource, 'leaflet.js'), join(leafletDestination, 'leaflet.js')),
    cp(join(leafletSource, 'leaflet.css'), join(leafletDestination, 'leaflet.css')),
    cp(join(leafletSource, 'images'), join(leafletDestination, 'images'), { recursive: true })
  ]);
  await cp(join(projectRoot, 'public_html', 'background-remover'), join(distRoot, 'background-remover'), { recursive: true });
  await mkdir(join(distRoot, 'admin'), { recursive: true });
  for (const file of ['index.html', 'admin.css', 'admin.js']) {
    const source = join(projectRoot, 'public_html', 'admin', file);
    const destination = join(distRoot, 'admin', file);
    if (file === 'admin.js') {
      await writeFile(destination, injectAdSensePublisherId(await readFile(source, 'utf8'), 'Admin integration display'), 'utf8');
    } else {
      await cp(source, destination);
    }
  }
  for (const file of ['_headers', '_redirects', 'apple-touch-icon.png', 'favicon-32x32.png', 'favicon-192x192.png', 'favicon-512x512.png', 'gxa-logo.png', 'site.webmanifest']) {
    await cp(join(projectRoot, file), join(distRoot, file));
  }
  await writeFile(join(distRoot, 'ads.txt'), `${ADSENSE_SELLER_LINE}\n`, 'utf8');

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
    const toolTemplate = blockedIds.has(tool.id) ? withoutAdSense(baseTemplate) : baseTemplate;
    await writeRoute(tool.id, applyMetadata(toolTemplate, {
      title: toolTitle(tool),
      description,
      canonical: canonicalToolUrl(tool.id),
      robots: blockedIds.has(tool.id) ? 'noindex, follow' : 'index, follow',
      graph: pageGraph({ name: tool.name, description, url: canonicalToolUrl(tool.id), category: tool.category, content: toolContent[tool.id] }),
      staticContent: toolStaticContent(tool, toolContent[tool.id], tools)
    }));
  }

  for (const page of contentPages) {
    await writeRoute(page.id, applyMetadata(baseTemplate, {
      title: page.title,
      description: page.description,
      canonical: canonicalContentUrl(page.id),
      robots: 'index, follow',
      graph: contentPageGraph(page),
      staticContent: contentPageStaticContent(page, tools)
    }));
  }

  const background = tools.find(tool => tool.id === 'background-remover');
  const backgroundPath = join(distRoot, 'background-remover', 'index.html');
  let backgroundHtml = await readFile(backgroundPath, 'utf8');
  if (!backgroundHtml.includes(ADSENSE_PUBLISHER_ID) || backgroundHtml.includes(ADSENSE_TEMPLATE_TOKEN)) {
    throw new Error('Background Remover build does not contain the canonical AdSense publisher configuration. Run npm run build:bg.');
  }
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
      category: background.category,
      content: toolContent[background.id]
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
    `<div id="root">${toolStaticContent(background, toolContent[background.id], tools)}</div>`,
    'Background Remover static route content'
  );
  backgroundHtml = backgroundHtml.replace(/\r\n/g, '\n');
  await writeFile(backgroundPath, backgroundHtml, 'utf8');

  const dashboardHtml = applyMetadata(withoutAdSense(baseTemplate), {
    title: 'Dashboard | GXA Toolbox',
    description: 'Sign in to access your private GXA Toolbox processing history and account dashboard.',
    canonical: `${PRODUCTION_ORIGIN}/dashboard/`,
    robots: 'noindex, nofollow, noarchive',
    graph: homepageGraph(),
    staticContent: dashboardStaticContent()
  });
  await writeRoute('dashboard', dashboardHtml);

  const indexable = tools.filter(tool => !blockedIds.has(tool.id)).sort((a, b) => a.id.localeCompare(b.id));
  const sitemapUrls = [
    `${PRODUCTION_ORIGIN}/`,
    ...indexable.map(tool => canonicalToolUrl(tool.id)),
    ...contentPages.map(page => canonicalContentUrl(page.id))
  ];
  const sitemap = `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${sitemapUrls.map(url => `  <url><loc>${escapeXml(url)}</loc></url>`).join('\n')}\n</urlset>\n`;
  await writeFile(join(distRoot, 'sitemap.xml'), sitemap, 'utf8');
  const seoCounts = {
    registeredTools: tools.length,
    indexableToolPages: indexable.length,
    noindexToolPages: blockedIds.size,
    companyLegalPages: contentPages.length,
    sitemapUrls: sitemapUrls.length,
    generatedPublicDirectRoutes: 1 + tools.length + contentPages.length,
    generatedNoindexPrivateRoutes: 2,
    generatedDirectRoutes: 1 + tools.length + contentPages.length + 2,
    generatedHtmlEntrypoints: 1 + tools.length + contentPages.length + 2 + 1,
    noindexPages: blockedIds.size + 2
  };
  await writeFile(
    join(projectRoot, 'netlify', 'functions', '_seo-build-counts.mjs'),
    `// Generated from the central registries by scripts/generate-seo-site.mjs.\nexport const SEO_BUILD_COUNTS = Object.freeze(${JSON.stringify(seoCounts, null, 2)});\n`,
    'utf8'
  );
  await cp(join(projectRoot, 'robots.txt'), join(distRoot, 'robots.txt'));
  await writeFile(join(distRoot, '404.html'), notFoundHtml(), 'utf8');
  await writeFile(join(projectRoot, 'docs', 'SEO_ROUTE_AUDIT.md'), routeAuditMarkdown(tools, blockedIds, contentPages), 'utf8');
  await writeFile(join(projectRoot, 'docs', 'TOOL_CONTENT_INVENTORY.md'), toolContentInventoryMarkdown(tools, toolContent), 'utf8');

  console.log(`Generated ${tools.length} tool routes, ${contentPages.length} company/legal routes, ${sitemapUrls.length} sitemap URLs, protected admin shell, Netlify control files, ads.txt, robots.txt, and a real 404 in dist/.`);
}

await main();
