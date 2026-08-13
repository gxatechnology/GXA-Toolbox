import { createServer } from 'node:http';
import { readFile, stat } from 'node:fs/promises';
import { extname, join, normalize } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('../', import.meta.url));
const port = Number(process.env.GXA_QA_PORT || 4173);
const types = {
  '.css': 'text/css; charset=utf-8', '.html': 'text/html; charset=utf-8', '.js': 'application/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8', '.mjs': 'application/javascript; charset=utf-8', '.onnx': 'application/octet-stream',
  '.png': 'image/png', '.svg': 'image/svg+xml', '.wasm': 'application/wasm', '.webp': 'image/webp'
};

function safePath(base, requested) {
  const path = normalize(join(base, requested));
  return path.startsWith(normalize(base)) ? path : '';
}

createServer(async (request, response) => {
  try {
    const pathname = decodeURIComponent(new URL(request.url, `http://${request.headers.host}`).pathname);
    let file;
    if (pathname.startsWith('/assets/')) file = safePath(join(root, 'public_html', 'assets'), pathname.slice('/assets/'.length));
    else if (pathname.startsWith('/background-remover/')) file = safePath(join(root, 'public_html', 'background-remover'), pathname.slice('/background-remover/'.length));
    else if (pathname === '/background-remover') file = join(root, 'public_html', 'background-remover', 'index.html');
    else file = join(root, 'index.html');
    if (!file || !(await stat(file)).isFile()) throw new Error('Not found');
    response.writeHead(200, { 'Content-Type': types[extname(file).toLowerCase()] || 'application/octet-stream', 'Cache-Control': 'no-store' });
    response.end(await readFile(file));
  } catch (_) {
    response.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' });
    response.end('Not found');
  }
}).listen(port, '127.0.0.1', () => console.log(`GXA browser QA server listening on http://127.0.0.1:${port}`));
