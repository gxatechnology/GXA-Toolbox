import { createHash } from 'node:crypto';
import { assertSameOrigin, jsonResponse, methodNotAllowed, readJsonBody } from './_auth.mjs';
import { databaseErrorCategory, getDatabaseClient, recordSystemEvent } from './_database.mjs';

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function cleanText(value, maxLength) {
  return String(value || '').trim().replace(/\s+/g, ' ').slice(0, maxLength);
}

function cleanMessage(value) {
  return String(value || '').trim().replace(/\r\n?/g, '\n').slice(0, 4000);
}

function validationError(message) {
  return jsonResponse({ success: false, message }, 400);
}

export default async function handler(request) {
  if (request.method !== 'POST') return methodNotAllowed(['POST']);

  try {
    if (!request.headers.get('origin')) {
      return jsonResponse({ success: false, message: 'Contact request origin is required.' }, 403);
    }
    assertSameOrigin(request);
    const body = await readJsonBody(request);
    const name = cleanText(body.name, 120);
    const email = cleanText(body.email, 254).toLowerCase();
    const message = cleanMessage(body.message);

    if (name.length < 2) return validationError('Enter your full name.');
    if (!EMAIL_PATTERN.test(email)) return validationError('Enter a valid email address.');
    if (message.length < 10) return validationError('Message details must contain at least 10 characters.');

    const hour = new Date().toISOString().slice(0, 13);
    const dedupeKey = createHash('sha256').update(`${email}\n${name.toLowerCase()}\n${message}\n${hour}`).digest('hex');
    const { sql } = getDatabaseClient();
    let rows = await sql`
      INSERT INTO public.support_messages (full_name, email, message, dedupe_key)
      VALUES (${name}, ${email}, ${message}, ${dedupeKey})
      ON CONFLICT (dedupe_key) DO NOTHING
      RETURNING id
    `;
    let duplicate = false;
    if (!rows.length) {
      duplicate = true;
      rows = await sql`
        SELECT id FROM public.support_messages
         WHERE dedupe_key = ${dedupeKey}
         LIMIT 1
      `;
    }
    const referenceId = rows[0]?.id;
    if (!referenceId) throw new Error('Support message reference was not returned.');

    return jsonResponse({
      success: true,
      message: 'Message sent successfully.',
      reference_id: String(referenceId),
      duplicate
    }, duplicate ? 200 : 201);
  } catch (error) {
    if (error?.status) return jsonResponse({ success: false, message: error.message }, error.status);
    const category = databaseErrorCategory(error);
    console.error('Contact support submission failed:', error?.code || error?.name || 'unknown');
    await recordSystemEvent('contact_support', category);
    return jsonResponse({ success: false, message: 'Unable to send your message right now. Please try again.' }, 503);
  }
}
