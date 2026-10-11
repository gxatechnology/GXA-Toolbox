import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import vm from 'node:vm';
import { JSDOM } from 'jsdom';
import JSZip from 'jszip';

// Execute the production functions, not a second implementation of their formulas.
const app = await readFile(new URL('../../public_html/assets/app.js', import.meta.url), 'utf8');
const dom = new JSDOM('<main id="generator-preview-mount"></main>', { runScripts: 'outside-only' });
const context = dom.getInternalVMContext();
Object.assign(context, { JSZip, Blob, appState: { activeFiles: [], activeToolOptions: {} }, numberWithCommas: value => String(value) });
function load(name) {
  const start = app.search(new RegExp(`^(?:async )?function ${name}\\(`, 'm'));
  assert.ok(start >= 0, name);
  const tail = app.slice(start);
  const next = tail.slice(1).search(/^(?:async )?function \w+\(/m);
  vm.runInContext(next < 0 ? tail : tail.slice(0, next + 1), context);
}
for (const name of ['generateEMICalc', 'generateLoanCalc', 'generateInterestCalc', 'generateSipCalc', 'generatePercentageCalc', 'generateDiscountCalc', 'generateGstCalc', 'evaluateSimpleExpression', 'evaluateSciExpression', 'generateBmiCalc', 'generateUnitConvert', 'generateCurrencyConvert', 'generateTimeCalc', 'generateAgeCalc', 'generateDateCalc', 'generateTimestampConvert', 'runZIPMaker']) load(name);
const mount = context.document.getElementById('generator-preview-mount');
for (const name of ['parseCalculatorDate', 'offsetCalculatorMonths', 'calculatorCalendarDuration']) load(name);
function run(name, fields) {
  for (const input of context.document.querySelectorAll('input')) input.remove();
  for (const [id, value] of Object.entries(fields)) {
    const input = context.document.createElement('input'); input.id = id; input.value = String(value); context.document.body.append(input);
  }
  mount.innerHTML = '';
  context[name]();
  assert.doesNotMatch(mount.textContent, /NaN|Infinity|undefined/, `${name}: invalid numeric output`);
  return mount.textContent.replace(/\s+/g, ' ').trim();
}
const checks = [];
async function check(name, callback) {
  try { await callback(); checks.push({ name, passed: true }); console.log(`PASS ${name}`); }
  catch (error) { checks.push({ name, passed: false }); console.error(`FAIL ${name}: ${error.message}`); }
}
const emi = rate => ({ 'opt-emi-amount': 12000, 'opt-emi-rate': rate, 'opt-emi-years': 1 });
await check('Simple calculator precedence, decimals, divide by zero and invalid tokens', () => {
  assert.equal(Number(context.evaluateSimpleExpression('2+3*4')), 14);
  assert.equal(Number(context.evaluateSimpleExpression('(2+3)*4')), 20);
  assert.ok(Math.abs(Number(context.evaluateSimpleExpression('0.1+0.2')) - 0.3) < 1e-12);
  assert.match(String(context.evaluateSimpleExpression('1/0')), /Error/);
  assert.match(String(context.evaluateSimpleExpression('globalThis')), /Error/);
});
await check('Scientific trig arguments and inverse trig in degrees', () => {
  for (const [input, expected] of [['sin(30)', 0.5], ['sin(30+30)', Math.sqrt(3) / 2], ['asin(0.5)', 30], ['acos(0.5)', 60], ['atan(1)', 45], ['sqrt(9)+log(100)', 5], ['2^3', 8]]) {
    assert.ok(Math.abs(Number(context.evaluateSciExpression(input)) - expected) < 1e-10, input);
  }
  for (const input of ['sqrt(-1)', '1/0', 'globalThis', 'sin.constructor(1)']) assert.match(String(context.evaluateSciExpression(input)), /Error/);
});
await check('BMI metric formula', () => assert.match(run('generateBmiCalc', { 'opt-bmi-units': 'metric', 'opt-bmi-weight': 70, 'opt-bmi-height': 175 }), /22.9.*Healthy Weight/));
await check('Unit exact mile/inch and Celsius conversion', () => {
  assert.match(run('generateUnitConvert', { 'opt-unit-val': 1, 'opt-unit-cat': 'length', 'opt-unit-from': 'mi', 'opt-unit-to': 'm' }), /1609.344 M/);
  assert.match(run('generateUnitConvert', { 'opt-unit-val': 0, 'opt-unit-cat': 'temperature', 'opt-unit-from': 'c', 'opt-unit-to': 'f' }), /32 F/);
});
await check('Currency manual rate and zero', () => {
  assert.match(run('generateCurrencyConvert', { 'opt-curr-val': 10, 'opt-curr-from': 'USD', 'opt-curr-to': 'INR', 'opt-curr-rate': 80 }), /800.00 INR/);
  assert.match(run('generateCurrencyConvert', { 'opt-curr-val': 0, 'opt-curr-from': 'USD', 'opt-curr-to': 'INR', 'opt-curr-rate': 80 }), /0.00 INR/);
});
await check('Duration carry and negative subtraction', () => {
  const fields = { 'opt-time-h1': 1, 'opt-time-m1': 50, 'opt-time-s1': 30, 'opt-time-h2': 2, 'opt-time-m2': 20, 'opt-time-s2': 40, 'opt-time-op': 'add' };
  assert.match(run('generateTimeCalc', fields), /04:11:10/); fields['opt-time-op'] = 'sub'; assert.match(run('generateTimeCalc', fields), /-00:30:10/);
});
await check('Age on exact birthday', () => assert.match(run('generateAgeCalc', { 'opt-age-dob': '2000-10-02', 'opt-age-target': '2026-10-02' }), /26 Years 0 Months 0 Days/));
await check('Date duration spans leap day and date offset', () => {
  assert.match(run('generateDateCalc', { 'opt-date-start': '2024-02-28', 'opt-date-mode': 'duration', 'opt-date-end': '2024-03-01' }), /2 Days/);
  assert.match(run('generateDateCalc', { 'opt-date-start': '2024-02-28', 'opt-date-mode': 'add', 'opt-date-offset': 2, 'opt-date-unit': 'days' }), /March 1, 2024/);
});
await check('Calendar month-end age never has negative days', () => {
  assert.match(run('generateAgeCalc', { 'opt-age-dob': '2023-01-31', 'opt-age-target': '2023-03-01' }), /0 Years 1 Months 1 Days/);
  assert.match(run('generateAgeCalc', { 'opt-age-dob': '2024-02-29', 'opt-age-target': '2025-02-28' }), /1 Years 0 Months 0 Days/);
});
await check('Reversed date duration uses the same positive calendar breakdown', () => {
  assert.match(run('generateDateCalc', { 'opt-date-start': '2023-03-01', 'opt-date-mode': 'duration', 'opt-date-end': '2023-01-31' }), /29 Days in the past.*0 Years, 1 Months, 1 Days/);
});
await check('Calendar month/year offsets clamp to the last valid day', () => {
  assert.match(run('generateDateCalc', { 'opt-date-start': '2023-01-31', 'opt-date-mode': 'add', 'opt-date-offset': 1, 'opt-date-unit': 'months' }), /February 28, 2023/);
  assert.match(run('generateDateCalc', { 'opt-date-start': '2024-02-29', 'opt-date-mode': 'add', 'opt-date-offset': 1, 'opt-date-unit': 'years' }), /February 28, 2025/);
});
await check('Calendar invalid dates and offsets reject instead of normalizing/truncating', () => {
  for (const date of ['2023-02-29', 'not-a-date', '0000-01-01']) {
    assert.doesNotMatch(run('generateAgeCalc', { 'opt-age-dob': date, 'opt-age-target': '2026-10-05' }), /Detailed Age Analysis/);
    assert.doesNotMatch(run('generateDateCalc', { 'opt-date-start': date, 'opt-date-mode': 'add', 'opt-date-offset': 1, 'opt-date-unit': 'days' }), /Offset Date Result/);
  }
  for (const offset of ['', 1.5, '1e20', 'Infinity']) assert.doesNotMatch(run('generateDateCalc', { 'opt-date-start': '2024-01-01', 'opt-date-mode': 'add', 'opt-date-offset': offset, 'opt-date-unit': 'days' }), /Offset Date Result/);
});
await check('Civil date arithmetic across DST, leap years and the supported year bounds', () => {
  assert.match(run('generateDateCalc', { 'opt-date-start': '2024-03-09', 'opt-date-mode': 'add', 'opt-date-offset': 2, 'opt-date-unit': 'days' }), /March 11, 2024/);
  assert.match(run('generateDateCalc', { 'opt-date-start': '2024-03-09', 'opt-date-mode': 'duration', 'opt-date-end': '2024-03-11' }), /2 Days difference/);
  assert.match(run('generateDateCalc', { 'opt-date-start': '2024-03-31', 'opt-date-mode': 'subtract', 'opt-date-offset': 1, 'opt-date-unit': 'months' }), /February 29, 2024/);
  assert.match(run('generateDateCalc', { 'opt-date-start': '0099-12-31', 'opt-date-mode': 'add', 'opt-date-offset': 1, 'opt-date-unit': 'days' }), /January 1, 100/);
  assert.match(run('generateAgeCalc', { 'opt-age-dob': '2000-02-29', 'opt-age-target': '2025-02-28' }), /25 Years 0 Months 0 Days Next Birthday In 0 Months, 0 Days/);
  assert.match(run('generateAgeCalc', { 'opt-age-dob': '2000-02-29', 'opt-age-target': '2024-03-01' }), /24 Years 0 Months 1 Days/);
  for (const [date, mode] of [['9999-12-31', 'add'], ['0001-01-01', 'subtract']]) {
    assert.match(run('generateDateCalc', { 'opt-date-start': date, 'opt-date-mode': mode, 'opt-date-offset': 1, 'opt-date-unit': 'days' }), /outside the supported calendar range/);
  }
  assert.match(run('generateAgeCalc', { 'opt-age-dob': '2000-01-01', 'opt-age-target': '9999-12-31' }), /Outside the supported calendar range/);
});
await check('Epoch zero and out-of-range input', () => {
  assert.match(run('generateTimestampConvert', { 'opt-ts-val': 0 }), /1970-01-01T00:00:00.000Z/);
  assert.doesNotMatch(run('generateTimestampConvert', { 'opt-ts-val': '1e20' }), /Epoch Translation Result/);
  assert.doesNotMatch(run('generateTimestampConvert', { 'opt-ts-val': '' }), /Epoch Translation Result/);
});
await check('EMI zero interest', () => assert.match(run('generateEMICalc', emi(0)), /₹1000\b.*Total Interest:₹0\b/));
await check('EMI standard 12% annuity', () => assert.match(run('generateEMICalc', emi(12)), /₹1066\b/));
await check('EMI blank rate is not zero', () => assert.doesNotMatch(run('generateEMICalc', emi('')), /EMI Amortization Summary/));
await check('EMI nonfinite rejected', () => assert.doesNotMatch(run('generateEMICalc', emi('Infinity')), /EMI Amortization Summary/));
const loan = (rate, months = 12, type = 'reducing') => ({ 'opt-loan-amount': 12000, 'opt-loan-rate': rate, 'opt-loan-months': months, 'opt-loan-type': type });
await check('Loan zero interest and all 12 schedule rows', () => { assert.match(run('generateLoanCalc', loan(0)), /₹1000\b/); assert.equal(mount.querySelectorAll('tbody tr').length, 12); });
await check('Loan flat interest', () => assert.match(run('generateLoanCalc', loan(12, 12, 'flat')), /₹1120\b.*Total Interest ₹1440\b/));
await check('Loan fractional months rejected', () => assert.doesNotMatch(run('generateLoanCalc', loan(12, 12.5)), /Loan Repayment Summary/));
await check('Loan excessive schedule rejected', () => assert.doesNotMatch(run('generateLoanCalc', loan(12, 1201)), /Loan Repayment Summary/));
const interest = (rate, years, type = 'simple') => ({ 'opt-int-principal': 1000, 'opt-int-rate': rate, 'opt-int-years': years, 'opt-int-type': type });
await check('Interest zero rate', () => assert.match(run('generateInterestCalc', interest(0, 2)), /Maturity Amount:₹1000.00/));
await check('Interest zero duration', () => assert.match(run('generateInterestCalc', interest(10, 0)), /Maturity Amount:₹1000.00/));
await check('Simple and compound interest', () => { assert.match(run('generateInterestCalc', interest(10, 2)), /Maturity Amount:₹1200.00/); assert.match(run('generateInterestCalc', interest(10, 2, 'compound-yearly')), /Maturity Amount:₹1210.00/); });
await check('Interest overflow rejected', () => assert.doesNotMatch(run('generateInterestCalc', interest(10000, 10000, 'compound-monthly')), /Interest Calculation Results/));
const sip = rate => ({ 'opt-sip-monthly': 1000, 'opt-sip-rate': rate, 'opt-sip-years': 1 });
await check('SIP zero return', () => assert.match(run('generateSipCalc', sip(0)), /₹12000\b.*Estimated Returns:₹0\b/));
await check('SIP beginning-of-month compounding', () => assert.match(run('generateSipCalc', sip(12)), /₹12809\b/));
await check('SIP blank and negative rate rejected', () => { for (const rate of ['', -1]) assert.doesNotMatch(run('generateSipCalc', sip(rate)), /Future Wealth Projections/); });
const percentage = values => Object.fromEntries(['val1', 'val2', 'a', 'b', 'from', 'to'].map((id, i) => [`opt-pct-${id}`, values[i]]));
await check('Percentage valid calculations', () => assert.match(run('generatePercentageCalc', percentage([25, 200, 25, 100, 100, 120])), /Result: 50.*Result: 25%.*Result: \+20%/));
await check('Percentage zero divisor and zero base', () => { const text = run('generatePercentageCalc', percentage([0, 100, 5, 0, 0, 5])); assert.equal((text.match(/not defined/gi) || []).length, 2); assert.doesNotMatch(text, /500%|\+0%/); });
await check('Percentage missing pairs do not fabricate zeros', () => assert.match(run('generatePercentageCalc', percentage([25, 100, '', '', '', ''])), /Enter both values/));
const discount = pct => ({ 'opt-disc-price': 100, 'opt-disc-pct': pct, 'opt-disc-add': 10, 'opt-disc-tax': 10 });
await check('Sequential discounts and tax', () => assert.match(run('generateDiscountCalc', discount(20)), /₹79.20/));
await check('Invalid discounts rejected', () => { for (const pct of [-1, 101]) assert.doesNotMatch(run('generateDiscountCalc', discount(pct)), /Discount Savings Summary/); });
await check('GST add/remove round trip', () => {
  context.appState.activeToolOptions.gstMode = 'add'; assert.match(run('generateGstCalc', { 'opt-gst-amount': 100, 'opt-gst-rate': 18 }), /Gross Price \(With Tax\):₹118.00/);
  context.appState.activeToolOptions.gstMode = 'remove'; assert.match(run('generateGstCalc', { 'opt-gst-amount': 118, 'opt-gst-rate': 18 }), /Net Price \(Without Tax\):₹100.00/);
});
await check('ZIP duplicate and Unicode filenames retain every file', async () => {
  const files = [['report.txt', 'first'], ['report.txt', 'second'], ['report (2).txt', 'third'], ['हिन्दी.txt', 'नमस्ते']];
  context.appState.activeFiles = files.map(([name, value]) => Object.assign(Buffer.from(value), { name, arrayBuffer: async () => Buffer.from(value) }));
  const blob = await context.runZIPMaker(); assert.equal(blob.type, 'application/zip');
  const bytes = Buffer.from(await blob.arrayBuffer()); assert.equal(bytes.subarray(0, 4).toString('hex'), '504b0304');
  const zip = await JSZip.loadAsync(bytes, { checkCRC32: true });
  const entries = Object.values(zip.files).filter(file => !file.dir); assert.equal(entries.length, files.length);
  assert.deepEqual((await Promise.all(entries.map(file => file.async('string')))).sort(), files.map(([, text]) => text).sort());
  assert.equal(await zip.file('report (2).txt').async('string'), 'third');
  assert.equal(await zip.file('हिन्दी.txt').async('string'), 'नमस्ते');
});
await check('Empty ZIP selection rejected', async () => { context.appState.activeFiles = []; await assert.rejects(context.runZIPMaker(), /select|choose|file/i); });
dom.window.close();
console.log(`${checks.filter(check => check.passed).length}/${checks.length} Phase 4A calculator/archive regressions passed.`);
if (checks.some(check => !check.passed)) process.exitCode = 1;
