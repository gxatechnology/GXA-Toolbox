(function (root) {
  'use strict';
  // Pure planner shared by the browser and contracts. Widths are measured CSS pixels.
  function plan(config, { tool, viewport, inlineWidth, leftSpace = 0, rightSpace = 0, railEligible = false, guideSections = [] }) {
    if (config.network !== 'adsterra') return [];
    const result = [], used = new Set();
    const simpleTool = config.railTools.includes(tool);
    const railAllowed = simpleTool || railEligible;
    const limit = Math.min(config.maxPlacements, viewport < 768 ? config.limits.mobile : viewport < 1280 ? config.limits.tablet : simpleTool ? config.limits.tool : railEligible ? 4 : config.limits.editor);
    const add = (zone, width, height) => {
      const unit = config.banners.find(item => item.enabled && item.width === width && item.height === height);
      if (!unit || used.has(unit.key) || result.length >= limit) return;
      used.add(unit.key); result.push({ zone, unit });
    };
    const find = (width, height) => config.banners.find(item => item.enabled && item.width === width && item.height === height);
    if (config.zones.top) {
      if (viewport >= 1280 && inlineWidth >= 728) add('top', 728, 90);
      else if (viewport >= 768 && inlineWidth >= 468) add('top', 468, 60);
      else if (inlineWidth >= 320) add('top', 320, 50);
    }
    // Reserve one place for native; never duplicate its provider-owned fixed ID.
    if (config.zones.afterTool && config.native.enabled && result.length < limit) {
      // One bounded alternative is reserved for a genuine Native no-fill. It
      // replaces this placement; it never increases the page density.
      const fallbackUnit = viewport < 768 ? find(300, 250) : find(320, 50);
      result.push({ zone: 'after-tool', unit: config.native, fallbackUnit });
    }
    if (railAllowed && config.zones.right && viewport >= 1280 && rightSpace >= 324) add('right', 300, 250);
    // One tall format only; a shorter secondary unit at the lower wide breakpoint.
    if (railAllowed && config.zones.left && viewport >= 1440 && leftSpace >= 184) add('left', 160, viewport >= 1920 ? 600 : 300);
    if (config.zones.content && viewport >= 768 && guideSections.length >= 3 && guideSections[0] + guideSections[1] >= 400) {
      if (viewport >= 1280 && inlineWidth >= 468) add('content-middle', 468, 60);
      else if (inlineWidth >= 300) add('content-middle', 300, 250);
      // The second in-guide placement needs substantial original content on
      // both sides. Never add it to editor layouts or narrow viewports.
      if (railAllowed && viewport >= 1280 && guideSections.length >= 4
        && guideSections[1] >= 700 && guideSections[2] >= 450
        && guideSections[0] + guideSections[1] + guideSections[2] >= 1800
        && inlineWidth >= 320) add('content-lower', 320, 50);
    } else if (config.zones.content && viewport < 768 && guideSections.length >= 4
      && guideSections.reduce((total, length) => total + length, 0) >= 1200
      && inlineWidth >= 300) {
      // Long mobile guides can support one additional in-content rectangle.
      // This stays outside the workspace and uses no desktop-only dimensions.
      add('content-middle', 300, 250);
    }
    // A planned 320x50 lower unit owns that key. Native then collapses on
    // no-fill rather than issuing a duplicate fixed-unit fallback request.
    const after = result.find(item => item.zone === 'after-tool');
    if (after && after.fallbackUnit && used.has(after.fallbackUnit.key)) after.fallbackUnit = null;
    return result;
  }
  const api = Object.freeze({ plan });
  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.GxaAdLayout = api;
})(globalThis);
