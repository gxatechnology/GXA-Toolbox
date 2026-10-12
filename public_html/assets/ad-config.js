(function (root) {
  'use strict';
  // Single production switch. Rebuild after changing to 'adsense' or 'off'.
  const config = Object.freeze({
    network: 'adsterra',
    maxPlacements: 4,
    zones: Object.freeze({ top: true, right: true, left: true, afterTool: true, content: true }),
    limits: Object.freeze({ tool: 4, editor: 3, tablet: 3, mobile: 2, editorial: 1 }),
    railTools: Object.freeze(['compress-pdf', 'merge-pdf', 'split-pdf', 'pdf-to-jpg', 'jpg-to-pdf', 'image-to-pdf', 'compress-image', 'resize-image', 'image-converter', 'calculator', 'scientific-calculator', 'percentage-calculator', 'age-calculator', 'date-calculator', 'emi-calculator', 'loan-calculator', 'interest-calculator', 'gst-calculator', 'sip-calculator', 'bmi-calculator', 'discount-calculator', 'unit-converter', 'currency-converter', 'time-calculator', 'json-tool', 'hash-tool', 'word-counter', 'lorem-ipsum', 'diff-checker', 'regex-tester', 'timestamp-converter']),
    // Explicit opt-in rail list: unknown/new editors never acquire a sidebar.
    interstitial: Object.freeze({ enabled: false, frequencyMinutes: 30, reason: 'No approved interstitial unit; banners must not be repurposed.' }),
    native: Object.freeze({ enabled: true, containerId: 'container-b1b26904317d94da1830e1f5dd69d6d9', src: 'https://bauval.org/21/b1b26904317d94da1830e1f5dd69d6d9' }),
    // Approved inventory. Selection is deterministic; each key runs at most once per document.
    banners: Object.freeze([
      { key: '82dc3dcdb859ef27455f631d49183d07', width: 728, height: 90 },
      { key: '2cc9598f48bdcb102277c47352490483', width: 300, height: 250 },
      { key: 'eb9ac703bb90ff49c53631490a2933f5', width: 320, height: 50 },
      { key: 'a141cf44861510c02f8b814719a223bf', width: 468, height: 60 },
      { key: '983c84b73f5901c5877413ab9680312e', width: 160, height: 600 },
      { key: '900dabd0bb67d683bd5dbc7486b6d25a', width: 160, height: 300 }
    ].map(unit => Object.freeze({ ...unit, enabled: true, src: `https://bauval.org/22/${unit.key}` }))),
    intrusive: Object.freeze({
      popunder: Object.freeze({ enabled: false, maxPerSession: 1, minimumIntervalMinutes: 30, approvedRoutes: Object.freeze([]), activationBlockedReason: 'No verified provider adapter for one-shot triggering and upload/download/reset exclusion. Frequency policy is reserved, not an active popup implementation.', src: 'https://abscloud.org/1/3a66eef4b20eb6bc449cee178926437d' }),
      socialBar: Object.freeze({ enabled: false, approvedRoutes: Object.freeze([]), activationBlockedReason: 'Provider overlay positioning, close/focus behavior and action clearance have not been verified. No routes approved.', src: 'https://bauval.org/14/fcd69a971630acd0557b6a7e1c55ba85' })
    })
  });
  if (typeof module === 'object' && module.exports) module.exports = config;
  else root.GxaAdConfig = config;
})(globalThis);
