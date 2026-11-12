import { readFile, writeFile } from 'node:fs/promises';
import {
  loadToolRegistry,
  loadToolContentRegistry,
  loadContentPageRegistry,
  loadToolQuality,
  canonicalToolUrl,
  toolTitle,
  toolDescription
} from './tool-registry.mjs';

const prior = JSON.parse(await readFile(new URL('../docs/GXA_95_TOOL_KEYWORD_INTENT_MAP.json', import.meta.url), 'utf8'));
const [tools, content, quality, contentPages] = await Promise.all([
  loadToolRegistry(), loadToolContentRegistry(), loadToolQuality(), loadContentPageRegistry()
]);
const priorById = new Map(prior.inventory.map(entry => [entry.toolId, entry]));
const contentPageIds = new Set(contentPages.map(page => page.id));
if (tools.length !== 95 || priorById.size !== tools.length) throw new Error('The 95-tool intent baseline is incomplete.');

const map = {
  project: 'GXA Toolbox',
  productionOrigin: 'https://gxatoolbox.in',
  source: 'Current tool registry, tool-content registry, publication policy and the existing 95-tool hypothesis map',
  evidence: {
    searchConsoleQueryExport: 'not available locally',
    bingQueryExport: 'not available locally',
    searchVolumeOrRankings: 'not measured',
    allKeywordAndBlogTopicIdeas: 'hypotheses, not observed search demand',
    contentCoverage: 'derived from current visible tool-content source; live rendering is tested separately'
  },
  summary: {
    registeredTools: tools.length,
    indexableTools: tools.filter(tool => quality[tool.id].indexable).length,
    intentionalNoindexTools: tools.filter(tool => !quality[tool.id].indexable).length
  },
  tools: tools.map(tool => {
    const baseline = priorById.get(tool.id);
    const page = content[tool.id];
    if (!baseline || !page) throw new Error(`Missing intent or content: ${tool.id}`);
    const relatedToolPages = [...new Set(page.relatedTools)]
      .filter(id => id !== tool.id && tools.some(candidate => candidate.id === id))
      .map(id => canonicalToolUrl(id));
    for (const guide of page.relatedGuides || []) {
      if (!contentPageIds.has(guide.id)) throw new Error(`Unknown editorial guide for ${tool.id}: ${guide.id}`);
    }
    return {
      toolId: tool.id,
      toolName: tool.name,
      category: tool.category,
      canonicalDestination: canonicalToolUrl(tool.id),
      indexable: Boolean(quality[tool.id].indexable),
      searchIntent: baseline.intent.audienceNeed,
      primaryTopicHypothesis: baseline.intent.primaryKeyword,
      supportingQueryHypotheses: [...new Set([
        ...baseline.intent.secondaryKeywords.slice(0, 2),
        ...baseline.intent.longTailQueries.filter(query => /how to|for |without |on mobile|format|size|quality|privacy/i.test(query)).slice(0, 2)
      ])].filter(query => query.toLowerCase() !== baseline.intent.primaryKeyword.toLowerCase()),
      actualUserQuestionsOnPage: page.faqs.slice(0, 3).map(faq => faq.question),
      currentMetadata: { title: toolTitle(tool), description: toolDescription(tool) },
      existingAnswerCoverage: {
        introduction: page.about.length > 0,
        howToSteps: page.howToUse.length,
        formatInputs: page.supportedFormats.input,
        formatOutputs: page.supportedFormats.output,
        limitations: page.limitations.length,
        faqQuestions: page.faqs.length,
        privacyExplanation: Boolean(page.privacy.description),
        examples: page.examples.length
      },
      relatedToolPages,
      relatedEditorialGuides: (page.relatedGuides || []).map(guide => ({
        topic: guide.label,
        canonicalDestination: `https://gxatoolbox.in/${guide.id}/`
      })),
      relatedBlogTopicHypotheses: (page.relatedGuides || []).map(guide => guide.label),
      contentOpportunity: !quality[tool.id].indexable
        ? 'Preserve intentional noindex; improve factual help only when a user-facing gap is confirmed.'
        : page.examples.length === 0
          ? 'Add a tested, original input/output example if it would clarify this workflow.'
          : 'Validate the current examples and limitations against real output before adding new editorial material.',
      evidenceSource: 'registry and visible content source; query terms are hypotheses'
    };
  })
};

if (map.summary.indexableTools !== 81 || map.summary.intentionalNoindexTools !== 14) {
  throw new Error('The publication policy changed; review the map before regenerating it.');
}
await writeFile(new URL('../docs/GXA_KEYWORD_INTENT_AND_CONTENT_MAP.json', import.meta.url), `${JSON.stringify(map, null, 2)}\n`);
console.log(`Generated intent and content map for ${map.tools.length} tools.`);
