# Responsive QA — visual guide release

## Browser evidence

The new Playwright suite passed 20 tool/width checks: PDF (`merge-pdf`), image (`crop-image`), converter (`image-converter`), developer (`json-tool`) and calculator (`emi-calculator`) routes at 320, 390, 768 and 1440 CSS-pixel widths. It also passed four homepage checks and the separately built React Background Remover guide at 390px. Assertions include guide count/placement, expected responsive columns and no document-level horizontal overflow. Representative screenshots are generated under ignored `test-results/visual-tool-guides/`. One earlier run timed out during local navigation while the full build was running concurrently; the isolated rerun completed successfully. This is a test-environment flake to monitor, not evidence that every network condition is handled.

The earlier shared responsive DOM suite was rerun successfully with 18 recorded checks, covering the width matrix 320, 360, 375, 390, 412, 414, 430, 480, 600, 768, 820, 1024, 1280, 1440, 1600 and 1920px plus representative workflow checks. It examines mobile navigation, workspaces, results and controls. Browser emulation is not a physical Android or iOS device; mobile keyboard, touch drag and provider ad behavior need device follow-up. Only Chromium is used by the new guide suite. No claim is made that all 95 tool workflows were browser-tested in this pass.

The homepage marquee suite passed at eight widths with reduced-motion and search assertions. The result/download suite passed at 390, 768, 1280 and 1920px on Image Converter and Compress PDF, including two real downloaded files. Its ad creative was a local test fixture, not a live Adsterra fill. The Adsterra browser suite passed 149 route and lifecycle checks with provider responses stubbed. No live third-party creative was inspected in this task.

## Known boundaries

Visual checks do not prove file output fidelity, provider creative fill, screen-reader quality, real ad network behavior or production database health. Guide illustrations are decorative and should be judged with their adjacent text, not as standalone screenshots of tool workflows. Existing result/download and ad suites remain the authority for those areas. Any production release should review the pending unrelated changes and perform representative real-file processing in a Deploy Preview before the one planned deployment.

The fixed Feedback trigger appears over the lower-right edge of an element-only guide screenshot. It did not obscure a processing or download control in the tested pages, but its proximity to reading content is a remaining polish item for a separate targeted UX pass; this task did not alter the pre-existing widget behavior.
