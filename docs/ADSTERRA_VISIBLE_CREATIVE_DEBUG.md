# Adsterra visible-creative debug

Date: 2026-10-14  
Scope: visibility diagnosis only; no placement, route-policy, tool, or UI redesign changes.

## Executive finding

The Adsterra dashboard evidence supplied for this investigation confirms counted impressions. A fresh headed Chrome run, with extensions disabled and no provider mocks, also confirmed that the fixed-banner provider requests fired and that Adsterra inserted correctly sized `iframe` elements. The creatives were not visible because the runtime left their parent slots in `data-ad-state="loading"`.

The fixed units use an official provider-created `about:blank` iframe. The previous detector rejected every such iframe because it required a non-blank `src`. The loading-state CSS then made the entire slot `position:absolute`, `visibility:hidden`, and `height:0`. After the timeout, the runtime classified the still-hidden slot as empty and removed it. This permits the provider request/impression path to run while preventing the user from seeing the creative.

## Real browser evidence

The live routes `/compress-pdf/`, `/merge-pdf/`, `/image-converter/`, and `/compress-image/` were inspected at 390, 768, 1440, and 1920 CSS pixels. The raw run is stored in `test-results/adsterra-live-visibility/results.json`; viewport screenshots are in the same directory.

Representative pre-fix geometry:

| Format | Route / viewport | Slot geometry and computed style | Provider iframe geometry and computed style |
| --- | --- | --- | --- |
| 320x50 | `/compress-pdf/`, 390 | 382x0 at (10, 259.33), `display:block`, `visibility:hidden`, `opacity:1`, `position:absolute`, `height:0px`, no transform, no hidden attribute | 320x50 at (10, 259.33), `src=about:blank`, `display:inline`, `visibility:hidden`, `opacity:1`, no transform |
| 468x60 | `/compress-pdf/`, 768 | 760x0 at (0, 243.74), `visibility:hidden`, `position:absolute` | 468x60 at (0, 243.74), `src=about:blank`, `visibility:hidden` |
| 728x90 | `/compress-pdf/`, 1440 | 970x0 at (76, 262.94), `visibility:hidden`, `position:absolute` | 728x90 at (76, 262.94), `src=about:blank`, `visibility:hidden` |
| 300x250 | `/image-converter/`, 1440 | 970x0 at (196, 819.58), `visibility:hidden`, `position:absolute` | 300x250 at (196, 819.58), `src=about:blank`, `visibility:hidden` |

The wrappers had usable horizontal space. Ancestor overflow, stacking order, opacity, transforms, and clipping were not the cause. Provider iframes appeared approximately 2.8–5.7 seconds after navigation. Slots remained loading at the 32-second sample and were collapsed as empty around 35 seconds. No click/interaction handler caused this result.

## Runtime fix

For fixed-size approved units only, an iframe is now considered mounted when all of the following are true:

- its declared width equals the approved unit width;
- its declared height equals the approved unit height;
- its rendered rectangle is at least those approved dimensions.

The detector intentionally does not inspect cross-origin iframe contents and does not require a non-blank iframe URL. Native-banner detection remains separate and retains its stronger content/load checks. The slot also exposes `data-ad-placement`, `data-ad-format`, and `data-ad-collapse-reason` for deterministic diagnostics.

No debug outlines, forced visibility rules, extra placements, or provider mocks ship in production code.

## Timing sequence

1. The route policy selects the eligible placement and the official provider request fires.
2. Adsterra inserts a fixed-size `about:blank` iframe with the correct geometry.
3. Pre-fix, the runtime rejects that iframe solely because of its blank URL.
4. The loading CSS keeps the slot and descendant creative invisible and zero-height.
5. The fallback timer later removes the unrecognized creative as `empty`.

## Validation

- Adsterra contract test: passes, including exact-dimension detection and diagnostic metadata.
- Adsterra browser suite: 154 checks pass, covering route policy, responsive/native fixtures, navigation, failures, CSP, and all 14 excluded routes.
- Targeted expanded-layout regression: passes at `/edit-pdf/` 2400px after removing an unnecessary explicit height reservation.
- Production build: passed before the final narrow height-reservation removal; final commands are reported in the completion response.

The deterministic browser fixture now reproduces the provider's real fixed-unit shape (`iframe`, matching width/height, `src=about:blank`) instead of substituting an anchor.

## Remaining live verification

After the diagnostic run, repeated provider calls stopped returning a fixed iframe, consistent with temporary provider no-fill/rate limiting. Therefore the local code path is fixed and regression-tested, but a post-fix, real-provider creative has not yet been visually observed. Under the strict acceptance rule, deployment readiness remains **NO** until one real fixed creative is observed after deployment or in a later provider-filled test window.

The Windows desktop browser controller could not safely confirm the selected browser URL, so it stopped before interaction. The evidence above was collected in a separate fresh headed Chrome session with extensions disabled.
