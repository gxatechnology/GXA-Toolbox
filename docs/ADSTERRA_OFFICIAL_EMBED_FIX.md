# Adsterra official embed repair

Local implementation and verification only. Nothing was committed, pushed, or deployed.

## Implementation

The shared runtime in `public_html/assets/ad-network.js` now renders the approved provider patterns directly in each dedicated ad mount:

- Native: asynchronous `bauval.org/21/b1b26904317d94da1830e1f5dd69d6d9` script followed by the exact fixed container ID.
- Fixed banners: an inline `atOptions` script followed by the corresponding `bauval.org/22/<key>` script.
- The six fixed units retain their approved keys and dimensions: 728x90, 300x250, 468x60, 320x50, 160x300, and 160x600.
- Fixed embed pairs are serialized so the provider-global `atOptions` value cannot race another fixed unit.
- The old application-created `about:blank` iframe and `frame.contentWindow.atOptions` adapter were removed.
- Popunder and Social Bar remain configured but disabled.

Placement policy is unchanged: 81 eligible and 14 excluded tool routes, current density limits, editor rail exclusions, responsive selection, lazy loading, and no-fill collapse remain intact.

## Lifecycle repair

- Workspace `pointerdown` no longer collapses pending ads.
- Initial no-fill observation is 30 seconds.
- One bounded five-second delayed recheck follows; there is no retry loop.
- Script failure and no-fill collapse only the affected slot.
- Provider script load is not considered a fill. A real iframe, image, or meaningful link is still required.
- Empty slots collapse to zero visible space and do not obstruct the tool.

## Isolated official-embed verification

Each format was tested alone in basic HTML, using the real provider, no request mocks, and no ad-blocking route. Each test waited 35 seconds. The temporary diagnostic page/script was removed and is not shipped.

| Format | Request | HTTP | Provider creative DOM | Visible | Final state |
| --- | --- | ---: | --- | --- | --- |
| Native | fired | 200 | no | no | empty |
| 728x90 | fired | 200 | no | no | empty |
| 300x250 | fired | 200 | no | no | empty |
| 468x60 | fired | 200 | no | no | empty |
| 320x50 | fired | 200 | no | no | empty |
| 160x300 | fired | 200 | no | no | empty |
| 160x600 | fired | 200 | no | no | empty |

This proves the current absence of visible creatives is not caused solely by the removed GXA iframe adapter. The provider returns its loader successfully but supplies no creative DOM in this test environment. Adsterra should inspect inventory delivery, campaign targeting, geography/IP eligibility, and unit/domain association if this continues after deployment.

Raw evidence: `test-results/adsterra-official-isolated.json`.

## Route and viewport verification

The local production build was served under the `https://gxatoolbox.in` browser origin while provider requests remained real and unmocked. The following routes were checked at 390, 768, 1440, and 1920 pixels:

- Compress PDF
- Compress Image
- Image Converter
- Merge PDF
- Organize PDF

All 20 route/viewport combinations were eligible, fired provider requests, produced no browser errors or provider request failures, and introduced no horizontal overflow. No creative was returned. Slots independently ended as `empty`, remained `waiting` when below the lazy-load threshold, or were still `loading` when queued behind another fixed official embed at the observation boundary.

Raw evidence: `test-results/adsterra-official-runtime.json`.

## Automated verification

- Production build, lint, and full test lifecycle: passed.
- Adsterra source/publication contract: passed; 95 tools, 81 eligible and 14 excluded.
- Expanded ad-layout browser suite: 111 checks passed.
- Adsterra lifecycle browser suite: 154 checks passed.
- Production CSP remains compatible; no broad CSP weakening was added.
- `git diff --check`: passed (line-ending notices only).

## Deployment assessment

The code repair is safe to deploy after owner review: official patterns replace the inferred adapter without changing placement policy or tool UI. Visible inventory cannot be guaranteed from repository code because all seven exact standalone provider embeds returned HTTP 200 without creative DOM during verification.
