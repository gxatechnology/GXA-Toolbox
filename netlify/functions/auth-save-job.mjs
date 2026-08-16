import { assertSameOrigin, jsonResponse, methodNotAllowed, readJsonBody, safeErrorResponse } from './_auth.mjs';
import { getDatabaseClient } from './_database.mjs';
import { requireIdentityUser, syncIdentityProfile } from './_identity-profile.mjs';

export default async function handler(request) {
  if (request.method !== 'POST') return methodNotAllowed(['POST']);

  try {
    assertSameOrigin(request);
    const auth = await requireIdentityUser();
    if (auth.response) return auth.response;
    const body = await readJsonBody(request);
    const toolName = String(body.tool_name || '').trim().slice(0, 100);
    const originalFile = String(body.original_file || '').trim().slice(0, 255);
    const outputFile = String(body.output_file || '').trim().slice(0, 255);
    const status = ['done', 'failed'].includes(body.status) ? body.status : 'done';
    const size = Math.max(0, Number(body.size) || 0);
    const processingTime = Math.max(0, Math.round(Number(body.processing_time_ms) || 0));
    const metadata = body.metadata && typeof body.metadata === 'object' && !Array.isArray(body.metadata)
      ? body.metadata
      : {};
    if (!toolName || !originalFile || !outputFile) {
      return jsonResponse({ success: false, message: 'Invalid processing-history entry.' }, 400);
    }

    const { sql } = getDatabaseClient();
    await syncIdentityProfile(auth.user);
    const inserted = await sql`
      INSERT INTO public.file_jobs
        (identity_user_id, tool_name, original_file, output_file, status, size_mb, processing_time_ms, metadata)
      VALUES
        (${auth.user.id}, ${toolName}, ${originalFile}, ${outputFile}, ${status}, ${size}, ${processingTime}, ${JSON.stringify(metadata)}::JSONB)
      RETURNING id
    `;
    return jsonResponse({ success: true, job_id: Number(inserted[0].id) }, 201);
  } catch (error) {
    return safeErrorResponse(error);
  }
}
