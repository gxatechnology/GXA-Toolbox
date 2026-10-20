(function (root) {
  'use strict';
  // Single production switch. Rebuild after changing to 'adsense' or 'off'.
  const config = Object.freeze({
    network: 'adsterra',
    providerSiteId: 6091425,
    maxPlacements: 6,
    zones: Object.freeze({ top: true, right: true, left: true, afterTool: true, content: true }),
    limits: Object.freeze({ tool: 6, editor: 3, tablet: 3, mobile: 2, editorial: 1 }),
    railTools: Object.freeze(['compress-pdf', 'merge-pdf', 'split-pdf', 'pdf-to-jpg', 'jpg-to-pdf', 'image-to-pdf', 'png-to-pdf', 'svg-to-png', 'compress-image', 'resize-image', 'image-converter', 'calculator', 'scientific-calculator', 'percentage-calculator', 'age-calculator', 'date-calculator', 'emi-calculator', 'loan-calculator', 'interest-calculator', 'gst-calculator', 'sip-calculator', 'bmi-calculator', 'discount-calculator', 'unit-converter', 'currency-converter', 'time-calculator', 'json-tool', 'hash-tool', 'word-counter', 'lorem-ipsum', 'diff-checker', 'regex-tester', 'timestamp-converter']),
    // Explicit opt-in rail list: unknown/new editors never acquire a sidebar.
    interstitial: Object.freeze({ enabled: false, frequencyMinutes: 30, reason: 'No approved interstitial unit; banners must not be repurposed.' }),
    native: Object.freeze({ enabled: true, unitId: 31513079, containerId: 'container-b1b26904317d94da1830e1f5dd69d6d9', src: 'https://bauval.org/21/b1b26904317d94da1830e1f5dd69d6d9' }),
    // Approved inventory. Selection is deterministic; each key runs at most once per document.
    banners: Object.freeze([
      { unitId: 31513011, key: '82dc3dcdb859ef27455f631d49183d07', width: 728, height: 90 },
      { unitId: 31513012, key: '2cc9598f48bdcb102277c47352490483', width: 300, height: 250 },
      { unitId: 31513010, key: 'eb9ac703bb90ff49c53631490a2933f5', width: 320, height: 50 },
      { unitId: 31513009, key: 'a141cf44861510c02f8b814719a223bf', width: 468, height: 60 },
      { unitId: 31513008, key: '983c84b73f5901c5877413ab9680312e', width: 160, height: 600 },
      { unitId: 31513013, key: '900dabd0bb67d683bd5dbc7486b6d25a', width: 160, height: 300 }
    ].map(unit => Object.freeze({ ...unit, enabled: true, src: `https://bauval.org/22/${unit.key}` }))),
    intrusive: Object.freeze({
      smartlink: Object.freeze({ enabled: false, unitId: 31822155, approvedRoutes: Object.freeze([]), activationBlockedReason: 'No approved website placement or verified outbound-link policy.' }),
      popunder: Object.freeze({ enabled: true, unitId: 31513006, approvedRoutes: Object.freeze(['*']), src: 'https://abscloud.org/1/3a66eef4b20eb6bc449cee178926437d' }),
      socialBar: Object.freeze({ enabled: true, unitId: 31513007, approvedRoutes: Object.freeze(['*']), src: 'https://bauval.org/14/fcd69a971630acd0557b6a7e1c55ba85' })
    })
  });
  if (typeof module === 'object' && module.exports) module.exports = config;
  else root.GxaAdConfig = config;
})(globalThis);
