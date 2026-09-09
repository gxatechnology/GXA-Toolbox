import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(fileURLToPath(new URL('../', import.meta.url)));
const read = path => readFile(join(root, path), 'utf8');
const [mainAnalytics, backgroundAnalytics, appSource, backgroundApp, backgroundExport, rootTemplate, backgroundTemplate] = await Promise.all([
  read('public_html/assets/gxa-analytics.js'),
  read('background-remover-app/src/utils/analytics.ts'),
  read('public_html/assets/app.js'),
  read('background-remover-app/src/App.tsx'),
  read('background-remover-app/src/components/ExportDialog.tsx'),
  read('index.html'),
  read('background-remover-app/index.html')
]);

const eventNames = ['tool_open', 'tool_start', 'tool_complete', 'tool_fail', 'tool_download'];
for (const eventName of eventNames) {
  assert.ok(mainAnalytics.includes(`'${eventName}'`), `Main analytics does not allow ${eventName}.`);
  assert.ok(backgroundAnalytics.includes(`'${eventName}'`), `Background Remover analytics does not allow ${eventName}.`);
}
for (const source of [mainAnalytics, backgroundAnalytics]) {
  assert.match(source, /dataLayer\.push\(/, 'Tool analytics must publish a GTM dataLayer event.');
  assert.match(source, /page_path/, 'Tool analytics must include a non-sensitive page_path parameter.');
  assert.doesNotMatch(source, /filename|file_name|file_content|ocr_text|password|email|user_agent|stack_trace/i, 'Tool analytics must not include sensitive processing or account data.');
  assert.doesNotMatch(source, /googletagmanager\.com\/gtag\/js|\bgtag\s*\(|google-analytics\.com/i, 'Tool analytics must not add a direct GA4 installation.');
}
for (const eventName of eventNames) {
  assert.ok(appSource.includes(`recordToolAnalytics('${eventName}'`), `Main application does not emit ${eventName}.`);
  assert.ok((backgroundApp + backgroundExport).includes(`trackBackgroundTool('${eventName}'`), `Background Remover does not emit ${eventName}.`);
}
assert.match(rootTemplate, /<script defer src="\/assets\/gxa-analytics\.js"><\/script>/, 'Main template must load the first-party analytics bridge.');
assert.doesNotMatch(rootTemplate + backgroundTemplate, /googletagmanager\.com\/gtag\/js|\bgtag\s*\(|google-analytics\.com/i, 'Public templates must remain GTM-only for GA4.');

console.log('Analytics contract passed: one GTM-compatible, privacy-minimized tool event contract across the main app and Background Remover.');
