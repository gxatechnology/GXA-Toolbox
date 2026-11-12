import { readFile, writeFile } from 'node:fs/promises';
import { loadToolContentRegistry, loadToolRegistry } from './tool-registry.mjs';

const [tools, content, prior] = await Promise.all([
  loadToolRegistry(), loadToolContentRegistry(),
  readFile(new URL('../docs/GXA_95_TOOL_ADVANCED_ENGINE_FINAL_AUDIT.json', import.meta.url), 'utf8').then(JSON.parse)
]);
const baseline = new Map(prior.inventory.map(item => [item.id, item]));
if (tools.length !== 95 || baseline.size !== 95) throw new Error('The 95-tool engine baseline must be reconciled before generating this review.');
const inventory = tools.map(tool => {
  const previous = baseline.get(tool.id);
  const copy = content[tool.id];
  if (!previous || !copy) throw new Error(`Missing engine or content evidence: ${tool.id}`);
  return {
    id: tool.id,
    name: tool.name,
    route: previous.route,
    category: tool.category,
    currentEngine: previous.upgradedEngine,
    libraryLicense: previous.license,
    inputTypes: copy.supportedFormats.input,
    outputTypes: copy.supportedFormats.output,
    processingBoundary: copy.privacy.processingMode,
    processingDisclosure: copy.privacy.description,
    explicitSizeLimit: copy.limitations.filter(item => /\b(?:MB|megapixel|million character|page limit|output.page|input limit)\b/i.test(item)),
    validationAndSecurity: previous.security,
    outputEvidence: previous.evidence,
    mobileEvidence: previous.mobile,
    browserEvidence: previous.crossBrowser,
    performanceEvidence: previous.performance,
    knownLimitations: previous.limitations,
    reviewStatus: previous.finalStatus,
    independentlyRetestedForThisVisualGuideTask: false
  };
});
const report = {
  generatedAt: new Date().toISOString(),
  sourceAudit: 'docs/GXA_95_TOOL_ADVANCED_ENGINE_FINAL_AUDIT.json',
  registeredTools: tools.length,
  statusCounts: prior.counts,
  scope: 'Evidence reconciliation for the visual-guide and UX release. Prior engine test results are attributed to their existing audit; this task did not independently rerun every tool workflow.',
  unknowns: ['Cross-browser output fidelity for every tool', 'Low-memory device thresholds', 'Live production dependency availability'],
  inventory
};
await writeFile(new URL('../docs/GXA_95_TOOL_ENGINE_REVIEW.json', import.meta.url), `${JSON.stringify(report, null, 2)}\n`);
console.log(`Generated evidence-qualified engine review for ${inventory.length} tools.`);
