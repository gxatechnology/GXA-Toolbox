import { assertSameOrigin, jsonResponse, methodNotAllowed, readJsonBody } from './_auth.mjs';
import { databaseErrorCategory, getDatabaseClient, recordSystemEvent } from './_database.mjs';

const EVENT_TYPES = new Set(['tool_open', 'tool_start', 'tool_complete', 'tool_fail', 'tool_download']);
const CATEGORIES = new Set(['pdf', 'image', 'utility', 'zip', 'convert', 'calculator']);
const DURATION_BUCKETS = new Set(['under_1s', '1_3s', '3_10s', '10_30s', '30_60s', 'over_60s']);

function cleanLabel(value, maxLength) {
  return String(value || '').trim().replace(/\s+/g, ' ').slice(0, maxLength);
}

export default async function handler(request) {
  if (request.method !== 'POST') return methodNotAllowed(['POST']);
  try {
    if (!request.headers.get('origin')) {
      return jsonResponse({ success: false, message: 'Analytics origin is required.' }, 403);
    }
    assertSameOrigin(request);
    const body = await readJsonBody(request);
    const eventType = cleanLabel(body.event_type, 32);
    const toolId = cleanLabel(body.tool_id, 100).toLowerCase();
    const toolName = cleanLabel(body.tool_name, 120);
    const toolCategory = cleanLabel(body.tool_category, 40).toLowerCase();
    const status = cleanLabel(body.status, 40) || null;
    const durationBucket = cleanLabel(body.duration_bucket, 32) || null;
    if (!EVENT_TYPES.has(eventType)
      || !/^[a-z0-9-]{1,100}$/.test(toolId)
      || !toolName
      || !CATEGORIES.has(toolCategory)
      || (durationBucket && !DURATION_BUCKETS.has(durationBucket))) {
      return jsonResponse({ success: false, message: 'Invalid analytics event.' }, 400);
    }
    const { sql } = getDatabaseClient();
    await sql`
      INSERT INTO public.tool_analytics_events
        (event_type, tool_id, tool_name, tool_category, status, duration_bucket)
      VALUES
        (${eventType}, ${toolId}, ${toolName}, ${toolCategory}, ${status}, ${durationBucket})
    `;
    return jsonResponse({ success: true }, 202);
  } catch (error) {
    console.error('Tool analytics event rejected:', error?.code || error?.name || 'unknown');
    await recordSystemEvent('tool_event', databaseErrorCategory(error));
    return jsonResponse({ success: false, message: 'Analytics event was not recorded.' }, 503);
  }
}
