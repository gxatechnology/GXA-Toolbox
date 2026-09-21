import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import vm from 'node:vm';
import { loadToolRegistry } from '../scripts/tool-registry.mjs';

const read = path => readFile(new URL('../' + path, import.meta.url), 'utf8');
const tools = await loadToolRegistry();
const source = await read('public_html/assets/tool-icons.js');
const context = vm.createContext({});
vm.runInContext(source, context);
const icons = context.GxaToolIcons;
assert.deepEqual(Array.from(icons.ids).sort(), tools.map(tool => tool.id).sort(), 'Every registered tool needs an illustration, without duplicating the route registry');
const drawings = new Set();
for (const tool of tools) {
  const svg = icons.svg(tool.id);
  assert.match(svg, /viewBox="0 0 64 64"/);
  assert.match(svg, /aria-hidden="true" focusable="false"/);
  assert(!/undefined|NaN|<image|<script|https?:|on\w+=/.test(svg), 'Illustrations must be valid self-contained local SVG');
  drawings.add(svg.replace(/data-tool-illustration="[^"]+"/, ''));
}
assert.equal(drawings.size, tools.length, 'Every tool should have a distinct object/action/format illustration');
const cards = await read('public_html/assets/tool-cards.js');
assert.match(cards, /createElement\('article'\)/);
assert.match(cards, /<\/a><button type="button"/);
assert.match(cards, /aria-pressed=/);
assert.match(cards, /href="\/\$\{tool.id\}\//);
const app = await read('public_html/assets/app.js');
assert.match(app, /related\.map\(createToolCard\)/);
assert.match(app, /fragment\.appendChild\(createToolCard\(tool\)\)/);
assert.match(app, /toolBrowseObserver\?\.disconnect\(\)/);
assert.match(app, /id="tool-results-count" role="status" aria-live="polite"/);
const styles = await read('public_html/assets/tool-cards.css');
assert.match(styles, /prefers-reduced-motion: reduce/);
assert.match(styles, /\.tool-card-link:focus-visible/);
assert.match(styles, /--browse-header-height/);
for (const path of ['index.html', 'public_html/index.php', 'dist/index.html', 'dist/crop-image/index.html']) {
  const html = await read(path);
  for (const asset of ['tool-icons.js', 'tool-cards.js', 'tool-cards.css']) {
    assert.equal(html.split('/assets/' + asset).length - 1, 1, path + ' should load ' + asset + ' once');
  }
  assert(html.indexOf('/assets/tool-icons.js') < html.indexOf('/assets/tool-cards.js'));
  assert(html.indexOf('/assets/tool-cards.js') < html.indexOf('/assets/app.js'));
}
assert.equal(await read('dist/assets/tool-icons.js'), source);
assert.equal(await read('dist/assets/tool-cards.js'), cards);
console.log('Tool-card design contracts passed: ' + tools.length + ' distinct illustrations; shared accessible cards, template order and production asset parity.');
