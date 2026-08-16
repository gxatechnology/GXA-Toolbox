/* Privacy-minimized first-party tool analytics. Never include file metadata or file content. */
(function initializeGxaAnalytics(windowObject) {
  'use strict';

  const allowedEvents = new Set(['tool_open', 'tool_start', 'tool_complete', 'tool_fail', 'tool_download']);
  const allowedCategories = new Set(['pdf', 'image', 'utility', 'zip', 'convert', 'calculator']);
  const allowedDurations = new Set(['under_1s', '1_3s', '3_10s', '10_30s', '30_60s', 'over_60s']);
  const recentEvents = new Map();
  const DEDUPE_WINDOW_MS = 1000;

  function safeText(value, maxLength) {
    return String(value || '').trim().replace(/\s+/g, ' ').slice(0, maxLength);
  }

  function track(eventType, tool, details = {}) {
    const event = safeText(eventType, 32);
    const toolId = safeText(tool?.id, 100).toLowerCase();
    const toolName = safeText(tool?.name, 120);
    const toolCategory = safeText(tool?.category, 40).toLowerCase();
    const durationBucket = safeText(details.durationBucket, 32) || null;
    const status = safeText(details.status, 40) || null;
    if (!allowedEvents.has(event)
      || !/^[a-z0-9-]{1,100}$/.test(toolId)
      || !toolName
      || !allowedCategories.has(toolCategory)
      || (durationBucket && !allowedDurations.has(durationBucket))) return false;

    const payload = {
      event_type: event,
      tool_id: toolId,
      tool_name: toolName,
      tool_category: toolCategory,
      status,
      duration_bucket: durationBucket
    };
    const eventKey = `${event}:${toolId}:${status || ''}:${durationBucket || ''}`;
    const now = Date.now();
    if (now - (recentEvents.get(eventKey) || 0) < DEDUPE_WINDOW_MS) return false;
    recentEvents.set(eventKey, now);
    if (recentEvents.size > 100) {
      for (const [key, timestamp] of recentEvents) if (now - timestamp > DEDUPE_WINDOW_MS) recentEvents.delete(key);
    }
    windowObject.dataLayer = windowObject.dataLayer || [];
    windowObject.dataLayer.push({
      event,
      tool_id: toolId,
      tool_name: toolName,
      tool_category: toolCategory,
      status,
      duration_bucket: durationBucket
    });
    windowObject.fetch('/.netlify/functions/tool-event', {
      method: 'POST',
      credentials: 'same-origin',
      keepalive: true,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    }).catch(() => {});
    return true;
  }

  windowObject.GxaAnalytics = Object.freeze({ track });
})(window);
