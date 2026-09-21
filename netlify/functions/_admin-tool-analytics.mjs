import { ADMIN_PRODUCT_SNAPSHOT } from './_admin-product-snapshot.mjs';

export const finiteMetric = value => value !== null && value !== undefined && value !== '' && Number.isFinite(Number(value)) ? Number(value) : null;
const rate = (numerator, denominator) => denominator > 0 && numerator !== null ? Math.round(numerator / denominator * 1000) / 10 : null;
export function toolMetrics(row, available = true) {
  const metric = key => available ? finiteMetric(row?.[key] ?? 0) : null;
  const starts = metric('starts'), completions = metric('successful_jobs'), failed = metric('failed_jobs'), downloads = metric('downloads');
  return {
    opens: metric('opens'), starts, successful_jobs: completions, failed_jobs: failed, downloads,
    conversion_rate: rate(completions, starts), failure_rate: rate(failed, starts), download_rate: rate(downloads, completions),
    last_activity: row?.last_activity || null,
    attention: available && starts >= 20 && (failed >= 5 && failed / starts >= .2 || completions / starts < .5)
  };
}
export function buildToolAnalytics(eventRows, available = true, registry = ADMIN_PRODUCT_SNAPSHOT.tools) {
  const recorded = new Map(eventRows.map(row => [row.tool_id, row]));
  const ids = new Set(registry.map(tool => tool.id));
  const rows = registry.map(tool => ({ tool_id: tool.id, tool_name: tool.name, category: tool.category, ...toolMetrics(recorded.get(tool.id), available) }));
  // Keep orphaned historical IDs queryable, but never present them as current tools.
  const historical = eventRows.filter(row => !ids.has(row.tool_id)).map(row => ({ tool_id: /^[a-z0-9-]{1,100}$/.test(row.tool_id) ? row.tool_id : 'unknown', tool_name: 'Historical / unregistered tool', category: 'historical', ...toolMetrics(row, available) }));
  const categories = [...new Set(registry.map(tool => tool.category))].map(category => {
    const group = rows.filter(row => row.category === category);
    return { category, tools: group.length, ...Object.fromEntries(['opens','starts','successful_jobs','failed_jobs','downloads'].map(key => [key, available ? group.reduce((sum,row)=>sum+(row[key] || 0),0) : null])) };
  });
  return { formula: 'Successful Tool Completions / Tool Starts × 100', available, rows, historical, categories, attention: rows.filter(row=>row.attention), threshold: 'At least 20 starts; 5+ failures with failure rate ≥20%, or completion rate below 50%. Event ratios are not session funnels and may exceed 100% across reporting boundaries.' };
}
export function safeRecentEvents(events) {
  const registry = new Map(ADMIN_PRODUCT_SNAPSHOT.tools.map(tool=>[tool.id,tool]));
  const types = new Set(['tool_open','tool_start','tool_complete','tool_fail','tool_download']);
  return events.filter(event=>types.has(event.event_type)).map(event=>({
    tool_name: registry.get(event.tool_id)?.name || 'Historical / unregistered tool',
    category: registry.get(event.tool_id)?.category || 'historical',
    event_type: event.event_type, occurred_at: event.occurred_at
  }));
}
