import { createHmac } from 'node:crypto';
import { assertSameOrigin, jsonResponse, methodNotAllowed, readJsonBody } from './_auth.mjs';
import { databaseErrorCategory, getDatabaseClient, recordSystemEvent } from './_database.mjs';
import { ADMIN_PRODUCT_SNAPSHOT } from './_admin-product-snapshot.mjs';

const TOOL_IDS = new Set(ADMIN_PRODUCT_SNAPSHOT.tools.map(tool => tool.id));
const REVIEW_LIMIT = 1000;

function enabled() {
  return String(process.env.TOOL_RATINGS_ENABLED || '').toLowerCase() === 'true';
}

function validToolId(value) {
  const toolId = String(value || '').trim().toLowerCase();
  return TOOL_IDS.has(toolId) ? toolId : '';
}

function aggregate(row = {}) {
  const count = Number(row.rating_count) || 0;
  return {
    average: count ? Number(row.average_rating) : null,
    count,
    distribution: {
      1: Number(row.one_star) || 0,
      2: Number(row.two_star) || 0,
      3: Number(row.three_star) || 0,
      4: Number(row.four_star) || 0,
      5: Number(row.five_star) || 0
    },
    updated_at: row.last_updated_at || null
  };
}

async function loadAggregate(sql, toolId) {
  const rows = await sql`
    SELECT rating_count, average_rating, one_star, two_star, three_star, four_star, five_star, last_updated_at
      FROM public.tool_rating_aggregates
     WHERE tool_id = ${toolId}
     LIMIT 1
  `;
  return aggregate(rows[0]);
}

function cleanReview(value) {
  const review = String(value || '').trim().replace(/\r\n?/g, '\n');
  if (review.length > REVIEW_LIMIT) {
    const error = new Error(`Review must be ${REVIEW_LIMIT} characters or fewer.`);
    error.status = 400;
    throw error;
  }
  return review || null;
}

function abuseKey(request, toolId) {
  const secret = String(process.env.RATING_ABUSE_SECRET || '');
  if (secret.length < 32) {
    const error = new Error('Tool ratings are not configured for this deployment.');
    error.status = 503;
    throw error;
  }
  const forwarded = request.headers.get('x-nf-client-connection-ip')
    || request.headers.get('x-forwarded-for')?.split(',')[0]?.trim()
    || 'unknown';
  const agent = request.headers.get('user-agent') || 'unknown';
  return createHmac('sha256', secret).update(`${toolId}\n${forwarded}\n${agent}`).digest('hex');
}

function publicError(error) {
  if (error?.status) return jsonResponse({ success: false, available: error.status !== 503, message: error.message }, error.status);
  return null;
}

export default async function handler(request) {
  if (!['GET', 'POST'].includes(request.method)) return methodNotAllowed(['GET', 'POST']);
  if (!enabled()) return jsonResponse({ success: false, available: false, message: 'Tool ratings are not available yet.' }, 503);

  const requestUrl = new URL(request.url);
  let toolId = validToolId(requestUrl.searchParams.get('toolId'));
  try {
    const { sql } = getDatabaseClient();
    if (request.method === 'GET') {
      if (!toolId) return jsonResponse({ success: false, available: true, message: 'Choose a valid tool.' }, 400);
      return jsonResponse({ success: true, available: true, tool_id: toolId, aggregate: await loadAggregate(sql, toolId) });
    }

    if (!request.headers.get('origin')) return jsonResponse({ success: false, available: true, message: 'Rating request origin is required.' }, 403);
    assertSameOrigin(request);
    const body = await readJsonBody(request);
    toolId = validToolId(body.tool_id);
    const rating = Number(body.rating);
    const review = cleanReview(body.review);
    if (!toolId || !Number.isInteger(rating) || rating < 1 || rating > 5) {
      return jsonResponse({ success: false, available: true, message: 'Choose a rating from 1 to 5 stars.' }, 400);
    }

    const key = abuseKey(request, toolId);
    const moderation = review ? 'pending' : 'accepted';
    const rows = await sql`
      INSERT INTO public.tool_ratings (tool_id, rating, review, moderation_status, abuse_key, submission_day)
      SELECT ${toolId}, ${rating}, ${review}, ${moderation}, ${key}, CURRENT_DATE
       WHERE (SELECT COUNT(*) FROM public.tool_ratings
               WHERE abuse_key = ${key} AND created_at >= CURRENT_TIMESTAMP - INTERVAL '1 hour') < 10
      ON CONFLICT (tool_id, abuse_key, submission_day) DO NOTHING
      RETURNING id
    `;
    if (!rows.length) {
      return jsonResponse({ success: false, available: true, message: 'A rating for this tool was already submitted recently.' }, 409);
    }
    return jsonResponse({
      success: true,
      available: true,
      message: 'Thank you for your feedback!',
      aggregate: await loadAggregate(sql, toolId)
    }, 201);
  } catch (error) {
    const response = publicError(error);
    if (response) return response;
    const category = databaseErrorCategory(error);
    console.error('Tool rating request failed:', error?.code || error?.name || 'unknown');
    await recordSystemEvent('tool_ratings', category);
    return jsonResponse({ success: false, available: false, message: 'Ratings are temporarily unavailable.' }, 503);
  }
}
