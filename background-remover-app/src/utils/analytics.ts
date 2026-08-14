type ToolEvent = 'tool_open' | 'tool_start' | 'tool_complete' | 'tool_fail' | 'tool_download';
type DurationBucket = 'under_1s' | '1_3s' | '3_10s' | '10_30s' | '30_60s' | 'over_60s';

const TOOL = Object.freeze({ id: 'background-remover', name: 'Background Remover', category: 'image' });

export function analyticsDurationBucket(startedAt: number): DurationBucket {
  const elapsed = Math.max(0, performance.now() - startedAt);
  if (elapsed < 1000) return 'under_1s';
  if (elapsed < 3000) return '1_3s';
  if (elapsed < 10_000) return '3_10s';
  if (elapsed < 30_000) return '10_30s';
  if (elapsed < 60_000) return '30_60s';
  return 'over_60s';
}

export function trackBackgroundTool(event: ToolEvent, status: string, durationBucket?: DurationBucket): void {
  const payload = {
    event_type: event,
    tool_id: TOOL.id,
    tool_name: TOOL.name,
    tool_category: TOOL.category,
    status: status.slice(0, 40),
    duration_bucket: durationBucket || null
  };
  const analyticsWindow = window as Window & { dataLayer?: Record<string, unknown>[] };
  analyticsWindow.dataLayer = analyticsWindow.dataLayer || [];
  analyticsWindow.dataLayer.push({
    event,
    tool_id: TOOL.id,
    tool_name: TOOL.name,
    tool_category: TOOL.category,
    status: payload.status,
    duration_bucket: payload.duration_bucket
  });
  fetch('/.netlify/functions/tool-event', {
    method: 'POST',
    credentials: 'same-origin',
    keepalive: true,
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload)
  }).catch(() => {});
}
