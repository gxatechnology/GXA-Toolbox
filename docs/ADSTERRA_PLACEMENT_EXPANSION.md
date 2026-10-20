# Adsterra placement expansion

The later 2026-10-19 109-public-URL coverage audit in `docs/ADSTERRA_109_PAGE_COVERAGE_AUDIT.md` supersedes the four-placement limits below. This file retains the earlier baseline and provider observations for comparison.

## Follow-up local verification (2026-10-19)

The optimization pass adjusted the rail-safe shell: at 1280px a right rail is now planned without compressing the 916px main shell; at 1600px the 1052px shell leaves measured space for both left and right units. A real, non-mocked local browser displayed a homepage 320×50 banner and Compress PDF 728×90 top and 300×250 right creatives. The left 160×300 slot was requested/planned but did not show a creative in the sampled provider window. The older no-fill observations and breakpoint table below describe the earlier baseline, not a guarantee about current provider inventory. Popunder and Social Bar remain disabled. Playwright is now installed as a development dependency; the expanded fixture layout suite passed 111 checks on 2026-10-19.

Date: 2026-10-14  
Scope: eligible public tool pages only. Popunder and Social Bar remain disabled.

## Required status summary

SIMPLE TOOL DESKTOP VISIBLE ADS: **up to 4 planned/mountable; real-provider visible count was 0 during the no-fill audit window**

1920PX RIGHT RAIL: **WORKING in the local production artifact and fixture browser verification**

LEFT RAIL: **WORKING at 1800/1920+ only when measured left space is sufficient**

TOP BANNER: **REQUEST/PLACEMENT WORKING; provider returned no visible fill during the final live sampling window**

AFTER-TOOL: **WORKING WITH ONE CONTROLLED FIXED FALLBACK; Native was NO-FILL in the live sampling window**

CONTENT AD: **WORKING in the local artifact**

MOBILE ADS: **maximum 2; two placements at 360–430px when 320px banner width fits, one Native/fallback candidate at 320px**

EDITOR MAX: **3**

ROOT REASON ONLY 2 ADS WERE SHOWING: **The centered 1280px tool shell left only 304px of measured right gutter at 1920px after the safety inset, below the planner's required 324px for a 300px rail plus 24px separation. At 1440/1600 the gutter was smaller. In addition, the content position reused the same 300x250 unit as the right rail, so provider-key deduplication prevented both positions from coexisting. Native no-fill had no replacement.**

SAFE TO DEPLOY: **NO — code and deterministic layout verification pass, but strict real-provider acceptance still needs at least one visibly filled creative in a post-change provider window.**

## Live production baseline audit

The existing production site was loaded with real Adsterra URLs and no request mocking. Ten routes were tested at 390, 768, 1280, 1440, 1600, and 1920 CSS pixels. Each page was scrolled through to cross lazy-load sentinels. Raw evidence is in `test-results/adsterra-live-placement-audit.json`.

All planned slots were created and all corresponding Adsterra loader requests fired in the sample. The provider returned no visibly filled creative during the eight-second per-page observation window; slots therefore remained in their non-visible loading state. This is recorded as no-fill, not reported as a visible success.

| Routes | 390 | 768 | 1280 | 1440 | 1600 | 1920 baseline | Why a rail was omitted |
| --- | --- | --- | --- | --- | --- | --- | --- |
| Compress PDF, Merge PDF, Image Converter, Compress Image, Resize Image | 2 slots / 2 requests | 3 / 3 | 3 / 3 | 3 / 3 | 3 / 3 | 4 / 4 (left, not right) | Right gutter measured below 324px; left reached 160px-unit threshold at 1920 |
| PNG to PDF, SVG to PNG | 2 / 2 | 3 / 3 | 3 / 3 | 3 / 3 | 3 / 3 | 3 / 3 | Routes were missing from the explicit rail-safe allowlist |
| Organize PDF, Edit PDF, Crop Image | 2 / 2 | 3 / 3 | 3 / 3 | 3 / 3 | 3 / 3 | 3 / 3 | Deliberately editor-classed; rails prohibited |

Formats in the production baseline were 320x50 at mobile top, 468x60 at tablet top, 728x90 at desktop top, Native after-tool, 300x250 in content, and 160x600 on the 1920px left rail where allowed.

## Implemented placement map

| Viewport | Simple tools | Editor tools | Hard limit |
| --- | --- | --- | --- |
| `<768` | 320x50 top when it fits; Native after-tool with 300x250 no-fill fallback | Same, no rails | 2 |
| `768–1279` | 468x60 top; Native after-tool with 320x50 fallback; 300x250 content | Same, no rails | 3 |
| `1280–1599` | 728x90 top; 300x250 right rail where measured gutter fits; Native/fallback; 468x60 content | Top, Native/fallback, content; no rails | 4 simple / 3 editor |
| `1600+` where both gutters fit | 728x90 top; 300x250 right; one 160x300 or 160x600 left; Native/fallback | Top, Native/fallback, content; no rails | 4 simple / 3 editor |

The rail-safe shell remains 1020px wide at 1440, 1100px at 1600, and 1260px at 1920. This preserves a comfortable center workspace while creating a measured 340px right gutter. Only the explicit simple-tool allowlist receives this class. PNG to PDF and SVG to PNG were added to that allowlist; Organize PDF remains excluded.

## Native no-fill fallback

The Native placement receives one replacement attempt only:

- mobile: 300x250;
- tablet/desktop: 320x50.

Native receives a 10-second initial decision window and a 3-second final check. If it has no creative, the same placement is replaced by the fixed unit. This does not add a fifth placement and does not retry repeatedly. Fixed banners retain their 30-second plus 5-second provider window. Provider keys remain document-unique.

## Safety and exclusions

- The existing 81 eligible / 14 denied publication policy is unchanged.
- Popunder and Social Bar remain disabled.
- Edit PDF, Crop Image, Organize PDF, Background Remover, and GPS Map Camera do not receive rails.
- No ad is inserted inside upload, processing, preview, editor, result, or download controls.
- Failed/no-fill slots collapse rather than reserving blank space.
- The recent approved-dimension recognition for Adsterra `about:blank` iframes is preserved.
- Content ads remain between substantial guide sections rather than paragraphs.

## Verification

- Live production baseline: 60 route/viewport combinations, real provider requests, no provider mocks.
- Local production artifact at the production origin: Compress PDF was tested at 390, 768, 1440, 1600, and 1920 with real Adsterra requests and no fill mocks. The expected 2/3/4/4/4 slots were created; the 1440 and 1600 right-rail requests fired, both left and right rail requests fired at 1920, and the Native no-fill replacement request fired once. The provider returned no creative iframe in this window, so visible creatives remained zero. Raw evidence: `test-results/adsterra-local-production-provider-audit.json`.
- Local deterministic browser layout: validates mounted geometry, density, side rails, no overlap, no horizontal overflow, editor exclusions, provider failure, and route policy.
- Repository validation results are reported in the task completion response.

No deployment, push, or commit was performed.
