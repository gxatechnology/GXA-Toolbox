import { assertSameOrigin, getDatabasePool, jsonResponse, methodNotAllowed, readJsonBody, readSession, safeErrorResponse } from './_auth.mjs';

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
    if (!toolName || !originalFile || !outputFile) {
      return jsonResponse({ success: false, message: 'Invalid processing-history entry.' }, 400);
    }

    const [result] = await getDatabasePool().execute(
      'INSERT INTO file_jobs (user_id, tool_name, original_file, output_file, status, size_mb) VALUES (?, ?, ?, ?, ?, ?)',
      [session.id, toolName, originalFile, outputFile, status, size]
    );
    return jsonResponse({ success: true, job_id: Number(result.insertId) }, 201);
  } catch (error) {
    return safeErrorResponse(error);
  }
}
