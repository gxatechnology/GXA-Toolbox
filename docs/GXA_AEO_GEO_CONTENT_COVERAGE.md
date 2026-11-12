# GXA Toolbox answer and AI-discovery content coverage

This is a source-level coverage assessment, not a claim about rankings, AI citations or live Google/Bing performance. The companion `GXA_KEYWORD_INTENT_AND_CONTENT_MAP.json` is generated from the current 95-tool registry, tool-content source, publication policy and the earlier hypothesis map. No Google Search Console or Bing query export was available locally; every keyword or blog-topic idea in that file is a **hypothesis**.

## Current coverage and pages improved

This phase improved the planning map and 25 factual tool-page meta descriptions, not bulk body copy. The existing organic-SEO implementation supplies reviewed metadata to the 81 indexable tool pages; the 14 noindex decisions are preserved. Source inspection found current content entries for all 95 registered tools. Each has an introduction, steps, supported inputs/outputs, limitations, privacy explanation, at least three FAQs, an example, related tools and a related editorial guide. The generated-route and initial-HTML contracts remain the release check for rendered output; source presence alone is not a live crawl test.

| Coverage area | Source-level finding | Action |
|---|---|---|
| Tool introductions and answers | 95/95 content entries | Keep accurate; do not add a second formulaic introduction. |
| Steps, formats, limitations and privacy | 95/95 entries | Recheck when an engine or external dependency changes. |
| FAQs | 298 questions across 95 entries | Review questions against support and search evidence before expanding. |
| Examples | 95/95 entries have at least one | Prefer tested input/output demonstrations and genuine screenshots over more prose. |
| Related tools | 326 relationships in the current content source | Keep links task-relevant; validate generated HTML and destinations. |
| Editorial guides | At least one valid guide reference per tool | Link real guides, not hypothetical blog posts. |
| Meta descriptions | 25 factual descriptions revised; 28/95 current tool descriptions remain under 110 characters | This is a review queue, **not** an automatic error or a length target. Prioritize clarity and accuracy. |

The previously completed 81-tool metadata implementation and guide work are described in `GXA_95_TOOL_ORGANIC_SEO_IMPLEMENTATION.md`. This phase preserves them. Noindex utilities can still have useful answers for users without being newly submitted for indexing.

## Answer gaps that merit original evidence

1. **Conversion fidelity:** For DOCX/PDF, PDF-to-spreadsheet, PDF-to-slides, SVG/raster and GIF workflows, show a real input/output comparison and state what formatting, animation or metadata can be lost. Do not imply a faithful office renderer where the engine does not provide one.
2. **Compression decisions:** Explain why text PDFs, scanned PDFs and already-compressed images respond differently. Use measured sample outputs with provenance before quoting savings.
3. **OCR quality:** A practical scanned-page example can show the original, recognized text, searchable-PDF behavior, language choice and failure cases. Do not claim perfect recognition.
4. **Editor boundaries:** Distinguish visual signatures from cryptographic signatures, visible PDF replacement from native text editing, and crop boundaries from destructive redaction.
5. **Calculator assumptions:** Surface rate period, rounding, inclusive/exclusive GST and fixed-versus-variable assumptions next to worked examples; do not turn arithmetic output into personalized financial advice.
6. **Privacy wording:** Review each tool's actual file-processing path, optional account-history metadata and third-party resources before making stronger claims. A site-wide “nothing leaves your device” claim would be misleading.

These are editorial priorities, not instructions to mass-create articles or repeat the same FAQ on every tool.

## Verified content boundaries

- `scripts/tool-registry.mjs` supplies the current 95 tool identities and canonical destinations.
- `public_html/assets/tool-quality.js` supplies the 81 indexable / 14 intentionally noindex publication decisions.
- `public_html/assets/tool-content.js` supplies visible capabilities, format lists, limitations, privacy text, examples, FAQs and related links.
- `scripts/tool-seo-intents.mjs` supplies reviewed metadata for indexable tools.
- The existing engine/output contracts are stronger evidence for tool behavior than SEO copy. Claims should be revalidated when processing code changes.

The map deliberately does not assign search volume, keyword difficulty, ranking position, CTR, AI visibility scores or expected traffic. It does not treat its related blog topics as published articles.

## Priority editorial sequence

1. Use actual GSC/Bing query and page exports, when supplied, to identify high-impression/low-click pages and observed questions. Keep hypotheses separate from measured demand.
2. Commission a small number of reproducible articles around the existing guides: PDF compression, OCR/searchable PDFs, image formats, image resizing and privacy boundaries. Include genuine sample files or screenshots where permissible.
3. Link each published tutorial back to the specific applicable tool and neighboring guide. Do not link to a draft or scheduled article.
4. Recheck title, description, introduction, FAQ and schema parity after each substantive content or engine change.

No article was drafted or published, no search metric was invented, and no tool page, route, ad, auth or database behavior was changed by this content-mapping work.
