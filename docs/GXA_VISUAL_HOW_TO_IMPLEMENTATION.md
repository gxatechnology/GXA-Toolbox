# Visual How-to implementation

The 95 registered tools now share a visual step renderer. It uses the existing, tool-specific `howToUse` instructions as the factual source; it does not invent extra processing steps or force a five-step template. Step 1 uses each tool's existing unique icon. Later steps use lightweight local SVG action symbols selected from the instruction text. The original instruction remains visible as the step description, with a short action title and numbered badge.

The shared renderer is `public_html/assets/tool-guide-visuals.js`. The main app calls it from `public_html/assets/app.js`; `scripts/generate-seo-site.mjs` calls the same renderer so guides exist in initial route HTML before JavaScript executes. The React Background Remover guide uses the same assets and retains its actual four instructions. The visual SVGs are decorative (`aria-hidden`); accessible meaning comes from the numbered text steps. No remote image request, new runtime dependency, or fake UI screenshot was added.

The steps are arranged in three columns on wider desktop, two on tablet, and one on compact phones. Existing workspace, result, ad and download ordering is unchanged. CSS uses the existing palette and no essential information depends on hover or motion.

Verification: `tests/visual-tool-guide-contract.mjs` checks all 95 generated static routes for guide count, unique first illustration, original instruction text, and script ordering. `tests/visual-tool-guide-browser.mjs` samples PDF, image, converter, developer, calculator and Background Remover pages at responsive widths. These tests validate guide presentation, not all 95 processing outputs.

Representative local screenshots are generated under ignored `test-results/visual-tool-guides/` by the browser suite. They are not production assets. More authentic editor screenshots should only be added after each depicted interaction is verified and suitable maintained captures are available.
