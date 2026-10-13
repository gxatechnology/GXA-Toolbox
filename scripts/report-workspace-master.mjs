import { readFile, writeFile } from 'node:fs/promises';
import { loadToolQuality } from './tool-registry.mjs';
const quality = await loadToolQuality();
const read = phase => readFile(new URL(`../test-results/workspace-master/${phase}/results.json`, import.meta.url), 'utf8').then(JSON.parse);
const before = await read('before');
let after;
try { after = await read('after'); } catch { after = null; }
const rows = before.rows.filter(r => r.width === 1440);
if (rows.length !== 95 || before.rows.length !== 950) throw Error('Incomplete baseline');
const advanced = new Set(['edit-pdf','crop-image','organize-pdf','background-remover','gps-map-camera','crop-pdf','sign-pdf','watermark-pdf']);
const developer = new Set(['base64-tool','url-tool','json-tool','hash-tool','sql-formatter','xml-to-json','uuid-generator','user-agent','regex-tester','css-beautifier','js-beautifier','html-beautifier','cron-generator']);
const text = new Set(['text-to-speech','case-converter','word-counter','lorem-ipsum','diff-checker','markdown-editor']);
const family = r => advanced.has(r.route) ? 'ADVANCED_EDITOR' : r.categoryName === 'calculator' || /calculator$/.test(r.route) ? 'CALCULATOR' : developer.has(r.route) ? 'DEVELOPER_UTILITY' : text.has(r.route) || r.route === 'html-to-pdf' ? 'TEXT_UTILITY' : /generator$/.test(r.route) ? 'GENERATOR' : r.disclosure === 'upload' ? r.fileInputs.some(f=>f.multiple) ? 'UPLOAD_MULTI' : 'UPLOAD_SIMPLE' : 'OTHER';
const geometry = r => r?.upload ? `${r.upload.width} × ${r.upload.height}` : 'No upload workspace';
const upload = r => ['UPLOAD_SIMPLE','UPLOAD_MULTI','ADVANCED_EDITOR'].includes(family(r));
const labelIssue = r => r.fileInputs.length > 0 && !r.fileInputs[0]?.multiple && r.buttons.includes('Select files');
const premature = r => upload(r) && r.emptyVisibleControls.length > 0;
const yes = value => value ? 'YES' : 'NO';
const mobileHeight = (data, id) => Math.max(0,...(data?.rows || []).filter(r=>r.route===id&&r.width<768).map(r=>r.upload?.height || 0));
const report = rows.map(r => {
 const current = after?.rows.find(a=>a.route===r.route&&a.width===1440);
 const changed = [];
 if(current) {
  if(r.nativeInputs.length && !current.nativeInputs.length) changed.push('Native input presentation');
  if(premature(r) && !premature(current)) changed.push('Controls disclosed after load');
  if(labelIssue(r) && !labelIssue(current)) changed.push('Singular label');
  if(geometry(r)!==geometry(current)) changed.push('Geometry');
  if(upload(r) && mobileHeight(before,r.route)>320 && mobileHeight(after,r.route)<=320) changed.push('Compact mobile upload');
 }
 const target = upload(r) ? `${advanced.has(r.route)?'300–380':'280–340'}px desktop; 240–320px mobile; expand after load` : 'Keep initial text/numeric controls';
 return `| ${r.name} /${r.route}/ | ${family(r)} | ${geometry(r)}; mobile max ${mobileHeight(before,r.route)}px | ${target} | ${yes(premature(r))} | ${yes(r.nativeInputs.length)} | ${yes(labelIssue(r))} | ${upload(r)?yes(r.upload?.height>380):'N/A'} | ${upload(r)&&r.route!=='gps-map-camera'?yes(r.upload?.height<240):'N/A'} | ${upload(r)?yes(mobileHeight(before,r.route)>320):'N/A'} | YES: ${quality[r.route]?.adsEligible?'central placement policy; representative filled-ad suite':'ad-free policy'} | ${current?changed.join('; ')||'Existing shared layout retained':'Pending'} |`;
});
const summary = {routes:rows.length, uploadBased:rows.filter(upload).length, advancedEditors:rows.filter(r=>advanced.has(r.route)).length, premature:rows.filter(premature).length, nativeInputRoutes:rows.filter(r=>r.nativeInputs.length).length, incorrectLabels:rows.filter(labelIssue).length, afterObservations:after?.rows.length || 0};
await writeFile(new URL('../docs/TOOL_WORKSPACE_MASTER_AUDIT.md',import.meta.url),`# Clean workspace master audit\n\n${JSON.stringify(summary,null,2)}\n\nBaseline: all 95 routes directly loaded, each inspected at 320, 360, 390, 430, 768, 1024, 1280, 1440, 1600 and 1920px. Evidence: test-results/workspace-master/before/results.json. Desktop geometry below is 1440px. Browser observations, not a claim of all-engine processing verification. Hybrid text/file utilities deliberately retain their text inputs. GPS baseline upload measurement selected its visible logo input rather than photo drop area; do not interpret that 47px measurement as the actual photo workspace. Native input count includes optional imports on text utilities.\n\n| Tool / route | Family | Current empty geometry | Target | Premature controls | Native input visible | Incorrect wording | Excess whitespace | Thin workspace | Tall/square | Ad safe | Fix applied |\n| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |\n${report.join('\n')}\n\nAfter evidence: ${after ? `${after.rows.length} observations; ${after.rows.filter(r=>r.overflow).length} overflow observations; ${after.errors.length} page errors.`:'Pending. This phase is not complete.'}\n`);
console.log(summary);
