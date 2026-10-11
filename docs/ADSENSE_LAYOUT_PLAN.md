# Optional AdSense layout plan — Phase 3

This is a local layout framework, not Google approval or an instruction to enable ad units. No ad-unit IDs, mock ads, impressions, external account changes or new ad requests were added.

## Eligible routes

The existing `GxaToolQuality` policy is authoritative: 81 tool routes are eligible, 14 review routes remain noindex/ad-free. Private, dashboard and error routes remain excluded. The existing publisher configuration, Auto Ads loader, GTM and consent architecture are unchanged. Optional containers do not themselves request ads.

## Candidate zones

- `ad-slot-after-tool`: outside the completed shared interaction area, separated from it by normal document flow. No placement inside the tool or output card.
- `ad-slot-content-1`: after the substantial tool guide, before related tools/FAQ. Shared render helper also serves dedicated editors.
- A future `ad-slot-sidebar` or after-FAQ zone requires separate desktop/mobile review and a real approved unit configuration; neither is activated here.

`renderToolAdPlacementPlaceholder(zone)` checks the same eligibility policy before returning a container. Current containers have `hidden`, an empty mount, no `data-ad-slot`, and no `adsbygoogle.push()` call. They have zero height, margin and padding when hidden. The guide's content break is independent of ads, so disabling ads does not leave a hole or make the page incomplete. A future integration must explicitly confirm eligibility and a real filled unit before exposing its container; CSS alone must not infer that a unit has loaded.

## Forbidden zones

Never put an ad inside an upload/drop zone, preview/result, crop canvas or control group. Do not put one beside Select File, Convert, Crop, Download, drag handles, or reorder controls. No floating or sticky ad overlay. Do not use ads as a separator between settings and the processing action.

## Desktop and mobile

Desktop retains the existing preview/settings layout. Optional zones are ordinary document-flow siblings below the interaction, not part of either column. No sidebar ad was added.

Mobile uses upload/preview, settings/action, result, then guidance. Empty zones are absent from layout and focus order. There are no sticky/mobile ad containers. Any future filled placement needs real-device checks for safe separation, readable content and layout shift; this phase does not claim approval or verification of live Google ad placement.

Auto Ads are controlled externally as well as by the existing route/request gate. This local framework does not guarantee or control every placement Google's Auto Ads may choose. Owner review of Auto Ads exclusions remains necessary before introducing manual units.
