import { requireAdminMutation, adminAccountErrorResponse } from './_admin-account.mjs';
import { renderMarkdown } from './_blog-core.mjs';

export default async function handler(request) {
  if (request.method !== 'POST') return new Response('', { status: 405, headers: { Allow: 'POST' } });
  try {
    requireAdminMutation(request);
    if (!request.headers.get('content-type')?.includes('text/plain')) return new Response('', { status: 415 });
    if (Number(request.headers.get('content-length') || 0) > 120000) return new Response('', { status: 413 });
    const reader = request.body?.getReader();
    if (!reader) return new Response('', { status: 400 });
    const chunks = []; let size = 0;
    try {
      while (true) {
        const { done, value } = await reader.read(); if (done) break;
        size += value.byteLength;
        if (size > 120000) { await reader.cancel(); return new Response('', { status: 413 }); }
        chunks.push(value);
      }
    } finally { reader.releaseLock(); }
    const source = Buffer.concat(chunks).toString('utf8');
    const html = renderMarkdown(source).replace(/src="\/blog-media\/([0-9a-f-]{36})"/gi, 'src="/.netlify/functions/blog-media-admin?id=$1"');
    return new Response(`<!doctype html><html lang="en"><head><meta charset="UTF-8"><meta name="robots" content="noindex,nofollow"><link rel="stylesheet" href="/assets/blog.css"></head><body><main class="blog-main blog-prose">${html}</main></body></html>`,
      { status: 200, headers: { 'Content-Type': 'text/html; charset=utf-8', 'Cache-Control': 'private, no-store', 'X-Robots-Tag': 'noindex, nofollow', 'Content-Security-Policy': "default-src 'none'; style-src 'self'; img-src 'self'; base-uri 'none'; frame-ancestors 'self'" } });
  } catch (error) { return adminAccountErrorResponse(error); }
}
