import assert from 'node:assert/strict';
import { once } from 'node:events';
import { readFile } from 'node:fs/promises';
import { join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createQaServer } from './browser-qa-server.mjs';

const projectRoot = resolve(fileURLToPath(new URL('../', import.meta.url)));
const distRoot = join(projectRoot, 'dist');
const server = createQaServer({ distRoot });

server.listen(0, '127.0.0.1');
await once(server, 'listening');
const address = server.address();
const origin = `http://127.0.0.1:${address.port}`;

async function request(path, expectedStatus = 200, expectedType) {
  const response = await fetch(`${origin}${path}`, { redirect: 'manual' });
  assert.equal(response.status, expectedStatus, `${path} returned ${response.status}, expected ${expectedStatus}.`);
  if (expectedType) assert.match(response.headers.get('content-type') || '', expectedType, `${path} has the wrong MIME type.`);
  return { response, body: await response.text() };
}

try {
  const representativeRoutes = [
    ['/', 'GXA Toolbox', 'https://gxatoolbox.in/'],
    ['/merge-pdf/', 'Merge PDF', 'https://gxatoolbox.in/merge-pdf/'],
    ['/crop-image/', 'Crop Image', 'https://gxatoolbox.in/crop-image/'],
    ['/image-ocr/', 'Image OCR', 'https://gxatoolbox.in/image-ocr/'],
    ['/json-tool/', 'JSON Formatter', 'https://gxatoolbox.in/json-tool/'],
    ['/emi-calculator/', 'EMI Calculator', 'https://gxatoolbox.in/emi-calculator/'],
    ['/background-remover/', 'Background Remover', 'https://gxatoolbox.in/background-remover/'],
    ['/about/', 'About Us', 'https://gxatoolbox.in/about/'],
    ['/careers/', 'Careers', 'https://gxatoolbox.in/careers/'],
    ['/security/', 'Security Policies', 'https://gxatoolbox.in/security/'],
    ['/privacy-policy/', 'Privacy Policy', 'https://gxatoolbox.in/privacy-policy/'],
    ['/terms/', 'Terms of Service', 'https://gxatoolbox.in/terms/'],
    ['/gdpr/', 'GDPR Compliance', 'https://gxatoolbox.in/gdpr/']
  ];
  for (const [path, heading, canonical] of representativeRoutes) {
    const { body } = await request(path, 200, /^text\/html\b/i);
    assert.match(body, /<h1\b/i, `${path} has no server-rendered H1.`);
    assert.ok(body.includes(heading), `${path} does not render its route identity.`);
    assert.ok(body.includes(`rel="canonical" href="${canonical}"`) || body.includes(`rel='canonical' href='${canonical}'`), `${path} canonical is incorrect.`);
    assert.match(body, /property=["']og:title["']/i, `${path} is missing Open Graph metadata.`);
    assert.match(body, /name=["']twitter:title["']/i, `${path} is missing Twitter metadata.`);
    assert.match(body, /application\/ld\+json/i, `${path} is missing JSON-LD.`);
  }

  const noSlash = await request('/merge-pdf?source=direct-test', 200, /^text\/html\b/i);
  assert.ok(noSlash.body.includes('https://gxatoolbox.in/merge-pdf/'), 'Directory routes without a trailing slash must resolve to their generated shell.');

  const blocked = await request('/ppt-to-pdf/', 200, /^text\/html\b/i);
  assert.match(blocked.body, /name=["']robots["'][^>]*content=["']noindex, follow["']/i, 'Blocked tool must stay reachable but noindex.');

  const missing = await request('/this-route-does-not-exist/', 404, /^text\/html\b/i);
  assert.match(missing.body, /Page not found/i);
  assert.match(missing.body, /noindex, nofollow/i);

  await request('/assets/style.css', 200, /^text\/css\b/i);
  await request('/assets/app.js', 200, /^application\/javascript\b/i);
  await request('/site.webmanifest', 200, /^application\/manifest\+json\b/i);
  await request('/sitemap.xml', 200, /^(?:application|text)\/xml\b/i);
  await request('/robots.txt', 200, /^text\/plain\b/i);
  const adsText = await request('/ads.txt', 200, /^text\/plain\b/i);
  assert.equal(adsText.body.trim(), 'google.com, pub-9226826319752464, DIRECT, f08c47fec0942fa0', 'ads.txt seller authorization is incorrect.');
  const favicon = await fetch(`${origin}/favicon-32x32.png`);
  assert.equal(favicon.status, 200);
  assert.match(favicon.headers.get('content-type') || '', /^image\/png\b/i);
  const faviconBytes = new Uint8Array(await favicon.arrayBuffer());
  assert.deepEqual([...faviconBytes.slice(0, 8)], [137, 80, 78, 71, 13, 10, 26, 10], 'Favicon response is not a PNG.');

  const backgroundHtml = await readFile(join(distRoot, 'background-remover', 'index.html'), 'utf8');
  const backgroundAsset = backgroundHtml.match(/<script\b[^>]*src=["']([^"']+\.js)["']/i)?.[1];
  assert.ok(backgroundAsset, 'Background Remover generated entry has no JS asset.');
  await request(backgroundAsset, 200, /^application\/javascript\b/i);

  for (const sourcePath of [
    '/package.json', '/netlify.toml', '/database.sql', '/public_html/index.php',
    '/api/login.php', '/config/database.php', '/tests/repository-audit.mjs', '/scripts/generate-seo-site.mjs'
  ]) {
    await request(sourcePath, 404, /^text\/html\b/i);
  }

  const head = await fetch(`${origin}/merge-pdf/`, { method: 'HEAD' });
  assert.equal(head.status, 200);
  assert.match(head.headers.get('content-type') || '', /^text\/html\b/i);
  assert.equal((await head.arrayBuffer()).byteLength, 0, 'HEAD responses must not include a body.');

  console.log('Direct-route SEO contract passed: generated routes, 404s, MIME types, assets, and source isolation work over HTTP.');
} finally {
  server.close();
  await once(server, 'close');
}
