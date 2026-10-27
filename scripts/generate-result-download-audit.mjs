import { readFile, writeFile } from 'node:fs/promises';
import { loadToolRegistry } from './tool-registry.mjs';

const tools = await loadToolRegistry();
const app = await readFile(new URL('../public_html/assets/app.js', import.meta.url), 'utf8');
const generatorSource = app.match(/const generators = \[([\s\S]*?)\];\s*const routeNormallyNeedsFiles/);
if (!generatorSource) throw new Error('Unable to locate the shared tool workflow classification.');
const registered = new Set(tools.map(tool => tool.id));
const directUtilities = new Set([...generatorSource[1].matchAll(/'([^']+)'/g)].map(match => match[1]).filter(id => registered.has(id)));

function classification(tool) {
  if (directUtilities.has(tool.id)) return ['Direct/live output', 'Excluded', 'No intermediate processed-file result screen; existing direct copy/download behavior is retained.'];
  if (tool.id === 'background-remover') return ['Dedicated React editor export', 'Excluded', 'Export remains in the editor dialog; inserting an ad into that critical workflow would obstruct the canvas/export UX.'];
  if (tool.id === 'ppt-to-pdf') return ['Dependency-blocked', 'Excluded', 'Faithful presentation renderer is unavailable; no successful result/download screen is exposed.'];
  if (tool.id === 'image-converter') return ['Specialized image result', 'Updated', 'Preview and verified metadata → gated result ad → labeled download section.'];
  if (tool.id === 'gps-map-camera') return ['Specialized photo export', 'Updated', 'Result metadata → gated result ad → labeled download section.'];
  if (tool.id === 'crop-image') return ['Specialized crop result', 'Updated', 'Preview and output details → gated result ad → download/edit actions.'];
  if (tool.id === 'edit-pdf') return ['Specialized PDF editor result', 'Updated', 'Generated preview → gated result ad → labeled download section.'];
  return ['Shared processed-file result', 'Updated', 'Success and preview/statistics → gated result ad → labeled download/start-over actions.'];
}

const rows = tools.map(tool => {
  const [pattern, status, reason] = classification(tool);
  return `| ${tool.name.replaceAll('|', '\\|')} | /${tool.id}/ | ${tool.category} | ${pattern} | ${status} | ${reason} |`;
});
const updated = rows.filter(row => row.includes('| Updated |')).length;
const excluded = tools.length - updated;
const document = `# GXA Toolbox result/download layout audit

Generated from the central 95-tool registry by \`scripts/generate-result-download-audit.mjs\`.

## Outcome

- Registered tools audited: **${tools.length}**
- Post-processing result workflows updated: **${updated}**
- Intentionally excluded: **${excluded}** (${directUtilities.size} direct/live utilities, Background Remover direct editor export, and dependency-blocked PPT to PDF)
- Popunder: **off**
- Smartlink: **off**
- Social Bar: **on**
- Existing seven display formats and route eligibility policy: **preserved**

The shared result order is success, preview, useful output details, a result-ready advertisement candidate, and a labeled download/export section. The provider request is not sent until the enclosing result is ready. Download access has no countdown, forced view, click requirement, or artificial delay. No-fill uses the existing bounded provider lifecycle and collapses the slot; the download section remains independent.

## Inventory

| Tool | Route | Category | Result/download pattern | Scope | Reason / final behavior |
| --- | --- | --- | --- | --- | --- |
${rows.join('\n')}

## Placement and responsive behavior

- The result placement is central-flow content and does not replace desktop left/right rails.
- Standard, crop, Image Converter, GPS Map Camera, and Edit PDF result views use the same shared advertisement-placeholder renderer.
- Mobile has one normal-flow download action, rather than separate sticky and desktop duplicate buttons.
- Advertisement labels, eligibility, approved-unit selection, lazy loading, fill detection, and collapse behavior remain owned by the central ad runtime.
- The dedicated React Background Remover remains a direct-export exception to protect its canvas and export dialog.

## Verification boundary

Browser suites use clearly identified local provider fixtures to verify layout and lifecycle. They do not claim a fixture is a genuine provider creative. Actual Adsterra fill remains provider-, geography-, inventory-, consent-, and blocker-dependent.
`;
await writeFile(new URL('../docs/RESULT_DOWNLOAD_LAYOUT_AUDIT.md', import.meta.url), document, 'utf8');
console.log(`Wrote result/download audit: ${tools.length} tools, ${updated} updated, ${excluded} excluded.`);
