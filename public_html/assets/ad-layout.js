(function (root) {
  'use strict';
  // Pure planner shared by the browser and contracts. Widths are measured CSS pixels.
  function plan(config, { tool, viewport, inlineWidth, leftSpace = 0, rightSpace = 0 }) {
    if (config.network !== 'adsterra') return [];
    const result = [], used = new Set();
    const railAllowed = config.railTools.includes(tool);
    const limit = Math.min(config.maxPlacements, viewport < 768 ? config.limits.mobile : viewport < 1280 ? config.limits.tablet : railAllowed ? config.limits.tool : config.limits.editor);
    const add = (zone, width, height) => {
      const unit = config.banners.find(item => item.enabled && item.width === width && item.height === height);
      if (!unit || used.has(unit.key) || result.length >= limit) return;
      used.add(unit.key); result.push({ zone, unit });
    };
    if (config.zones.top) {
      if (viewport >= 1280 && inlineWidth >= 728) add('top', 728, 90);
      else if (viewport >= 768 && inlineWidth >= 468) add('top', 468, 60);
      else if (inlineWidth >= 320) add('top', 320, 50);
    }
    // Reserve one place for native; never duplicate its provider-owned fixed ID.
    if (config.zones.afterTool && config.native.enabled && result.length < limit) result.push({ zone: 'after-tool', unit: config.native });
    if (railAllowed && config.zones.right && viewport >= 1280 && rightSpace >= 324) add('right', 300, 250);
    // One tall format only; a shorter secondary unit at the lower wide breakpoint.
    if (railAllowed && config.zones.left && viewport >= 1600 && leftSpace >= 184) add('left', 160, viewport >= 1920 ? 600 : 300);
    if (config.zones.content && viewport >= 768 && inlineWidth >= 300) add('content-middle', 300, 250);
    return result;
  }
  const api = Object.freeze({ plan });
  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.GxaAdLayout = api;
})(globalThis);
