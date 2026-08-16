import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const read = path => readFile(new URL(`../${path}`, import.meta.url), 'utf8');
const [app, styles] = await Promise.all([
  read('public_html/assets/app.js'),
  read('public_html/assets/style.css')
]);

const registrySource = app.slice(app.indexOf('const toolsList'), app.indexOf('// --- Main Application Controller'));
const tools = [...registrySource.matchAll(/\{\s*id:\s*'([^']+)',\s*name:\s*'([^']+)',\s*category:\s*'([^']+)'/g)]
  .map(([, id, name, category]) => ({ id, name, category }));
assert.ok(tools.length >= 90, 'The navigation registry unexpectedly lost tools.');

for (const category of ['pdf', 'image', 'calculator']) {
  assert(tools.some(tool => tool.category === category), `${category} has no registered tools.`);
  assert(app.includes(`data-nav-category="${category}"`), `${category} desktop trigger is missing.`);
  assert(app.includes(`renderHeaderToolMenu('${category}')`), `${category} dropdown is not generated from the registry.`);
}
assert.match(app, /function renderHeaderToolMenu\(category\)[\s\S]*toolsList\.filter\(tool => tool\.category === category\)/);
assert.match(app, /function initializeCategoryNavigation\(nav\)/);
assert.match(app, /addEventListener\('pointerenter'/);
assert.match(app, /addEventListener\('pointerleave'/);
assert.match(app, /addEventListener\('keydown'[\s\S]*event\.key !== 'Enter'[\s\S]*event\.key !== ' '/);
assert.match(app, /event\.key === 'ArrowDown'[\s\S]*menu\.querySelector\('a'\)\?\.focus\(\)/);
assert.match(app, /setTimeout\([\s\S]*}, 120\)/);
assert.match(app, /menu\.setAttribute\('aria-hidden', 'true'\)/);
assert.match(app, /setAttribute\('aria-hidden', String\(!open\)\)/);
assert.match(app, /document\.addEventListener\('pointerdown'[\s\S]*closeCategoryNavigation/);
assert.match(app, /event\.key === 'Escape'[\s\S]*closeCategoryNavigation/);
assert.match(styles, /@media \(min-width: 1101px\) and \(hover: hover\) and \(pointer: fine\)/);
assert.match(styles, /\.header-nav \.mega-menu\s*\{[\s\S]*position:\s*fixed;[\s\S]*left:\s*50vw;[\s\S]*width:\s*min\(760px, calc\(100vw - 32px\)\)[\s\S]*transform:\s*translateX\(-50%\) translateY\(8px\)/);
assert.match(styles, /\.header-nav \.nav-item\.menu-expanded > \.mega-menu[\s\S]*transform:\s*translateX\(-50%\) translateY\(0\)/);
assert.match(styles, /\.nav-item\.has-mega-menu::after[\s\S]*position:\s*fixed;[\s\S]*width:\s*min\(760px, calc\(100vw - 32px\)\)[\s\S]*height:\s*18px/);
assert.match(styles, /\.nav-item\.has-mega-menu\.menu-expanded::after[\s\S]*pointer-events:\s*auto/);
assert.doesNotMatch(styles, /data-nav-category=["'](?:pdf|image|calculator)["'][^\n]*\.mega-menu/);
assert.doesNotMatch(styles, /nth-child\([^)]*\) \.mega-menu/);
const headerNavigation = app.slice(app.indexOf('function renderHeaderToolMenu'), app.indexOf('function renderFooter'));
assert.doesNotMatch(headerNavigation, /href=["']#["']/);

const calculatorInit = app.slice(app.indexOf('function initializeSimpleCalculator'), app.indexOf('function generateSimpleCalc'));
assert.match(calculatorInit, /simpleCalculatorBound === 'true'/);
assert.match(calculatorInit, /preview\.addEventListener\('click'/);
assert.match(calculatorInit, /closest\('\[data-calc-key\]'\)/);
assert.equal((calculatorInit.match(/addEventListener\('click'/g) || []).length, 1);
const simpleCalculator = app.slice(app.indexOf('function generateSimpleCalc'), app.indexOf('function evaluateSciExpression'));
assert.match(simpleCalculator, /data-calc-key="1"/);
assert.match(simpleCalculator, /data-calc-key="%"/);
assert.doesNotMatch(simpleCalculator, /onclick="pressCalcKey/);
assert.match(app, /generateSimpleCalc\(true\)/);
assert.match(app, /calculator:\s*\(\) => pressCalcKey\('='\)/);

const liveStats = app.slice(app.indexOf('function updatePremiumLiveStats'), app.indexOf('function renderCalculatorFormulaReference'));
assert.doesNotMatch(liveStats, /lucide\.createIcons/);
assert.match(app, /previewUpdateFrame = window\.requestAnimationFrame/);
assert.match(app, /window\.cancelAnimationFrame\(premiumEditorState\.previewUpdateFrame\)/);

console.log('Desktop navigation and calculator contract passed: registry menus, hover persistence, idempotent keypad events, and non-recursive stats updates.');
