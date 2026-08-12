import { assertSameOrigin, getDatabaseClient, jsonResponse, methodNotAllowed, readJsonBody, readSession, safeErrorResponse } from './_auth.mjs';

export default async function handler(request) {
  if (request.method !== 'POST') return methodNotAllowed(['POST']);

  try {
    assertSameOrigin(request);
    const session = readSession(request);
    if (!session) return jsonResponse({ success: false, message: 'Sign in to save processing history.' }, 401);
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
    const inserted = await sql`
      INSERT INTO public.file_jobs
        (user_id, tool_name, original_file, output_file, status, size_mb, processing_time_ms, metadata)
      VALUES
        (${session.id}, ${toolName}, ${originalFile}, ${outputFile}, ${status}, ${size}, ${processingTime}, ${JSON.stringify(metadata)}::JSONB)
      RETURNING id
    `;
    return jsonResponse({ success: true, job_id: Number(inserted[0].id) }, 201);
  } catch (error) {
    return safeErrorResponse(error);
  }
}
