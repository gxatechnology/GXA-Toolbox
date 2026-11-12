(function (root) {
  'use strict';
  // Pure planner shared by the browser and contracts. Widths are measured CSS pixels.
  function plan(config, { tool, viewport, inlineWidth, leftSpace = 0, rightSpace = 0, railEligible = false, guideSections = [], resultPriority = true }) {
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
    // Reserve the best fitting approved unit for the completed result first.
    // Top/content placements may never reuse its provider key.
    if (!resultPriority && config.zones.afterTool && config.native.enabled && result.length < limit) {
      result.push({ zone: 'after-tool', unit: config.native });
    }
    if (resultPriority && config.zones.afterTool && result.length < limit) {
      if (viewport >= 1280 && inlineWidth >= 728) add('after-tool', 728, 90);
      else if (viewport >= 768 && inlineWidth >= 468) add('after-tool', 468, 60);
      else if (inlineWidth >= 320) add('after-tool', 320, 50);
      else if (viewport >= 768 && inlineWidth >= 300) add('after-tool', 300, 250);
      else if (config.native.enabled) result.push({ zone: 'after-tool', unit: config.native });
    }
    if (config.zones.top) {
      if (!resultPriority && viewport >= 1280 && inlineWidth >= 728) add('top', 728, 90);
      else if (!resultPriority && viewport >= 768 && inlineWidth >= 468) add('top', 468, 60);
      else if (!resultPriority && inlineWidth >= 320) add('top', 320, 50);
      else if (resultPriority && viewport >= 1280 && inlineWidth >= 468) add('top', 468, 60);
      else if (resultPriority && viewport >= 768 && inlineWidth >= 320) add('top', 320, 50);
      else if (config.native.enabled && !result.some(item => item.unit.containerId === config.native.containerId) && result.length < limit) result.push({ zone: 'top', unit: config.native });
    }
    // Keep the functional workspace centered: a rail needs an equally wide
    // opposite gutter even when that gutter has no advertisement.
    if (railAllowed && config.zones.right && viewport >= 1440 && rightSpace >= 300) add('right', 300, 250);
    else if (railAllowed && config.zones.right && viewport >= 1280 && rightSpace >= 160) add('right', 160, 300);
    // One tall format only; 1440px uses the shorter rail while wider layouts
    // have room for the 160x600 unit without narrowing the workspace.
    if (railAllowed && config.zones.left && viewport >= 1440 && leftSpace >= 184) add('left', 160, viewport >= 1600 ? 600 : 300);
    if (config.zones.content && viewport >= 768 && guideSections.length >= 3 && guideSections[0] + guideSections[1] >= 400) {
      if (config.native.enabled && !result.some(item => item.unit.containerId === config.native.containerId) && result.length < limit) result.push({ zone: 'content-middle', unit: config.native });
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
    return result;
  }
  const api = Object.freeze({ plan });
  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.GxaAdLayout = api;
})(globalThis);
