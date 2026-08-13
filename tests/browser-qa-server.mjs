import { createServer } from 'node:http';
import { readFile, stat } from 'node:fs/promises';
import { dirname, extname, relative, resolve, sep } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const projectRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const defaultDistRoot = resolve(projectRoot, 'dist');

const contentTypes = Object.freeze({
  '.css': 'text/css; charset=utf-8',
  '.gif': 'image/gif',
  '.html': 'text/html; charset=utf-8',
  '.ico': 'image/x-icon',
  '.jpeg': 'image/jpeg',
  '.jpg': 'image/jpeg',
  '.js': 'application/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.map': 'application/json; charset=utf-8',
  '.mjs': 'application/javascript; charset=utf-8',
  '.onnx': 'application/octet-stream',
  '.png': 'image/png',
  '.svg': 'image/svg+xml; charset=utf-8',
  '.txt': 'text/plain; charset=utf-8',
  '.wasm': 'application/wasm',
  '.webmanifest': 'application/manifest+json; charset=utf-8',
  '.webp': 'image/webp',
  '.woff': 'font/woff',
  '.woff2': 'font/woff2',
  '.xml': 'application/xml; charset=utf-8'
});

function isInside(root, path) {
  const child = relative(root, path);
  return child === '' || (!child.startsWith(`..${sep}`) && child !== '..' && !child.includes(`:${sep}`));
}

async function isFile(path) {
  try {
    return (await stat(path)).isFile();
  } catch {
    return false;
  }
}

async function resolveStaticFile(distRoot, pathname) {
  const decoded = decodeURIComponent(pathname);
  if (decoded.includes('\0') || decoded.includes('\\')) return '';

  const candidate = resolve(distRoot, `.${decoded}`);
  if (!isInside(distRoot, candidate)) return '';
  if (await isFile(candidate)) return candidate;

  const index = resolve(candidate, 'index.html');
  if (!isInside(distRoot, index)) return '';
  return await isFile(index) ? index : '';
}

async function sendFile(response, file, statusCode, method) {
  const contentType = contentTypes[extname(file).toLowerCase()] || 'application/octet-stream';
  const body = await readFile(file);
  response.writeHead(statusCode, {
    'Cache-Control': 'no-store',
    'Content-Length': body.byteLength,
    'Content-Type': contentType,
    'X-Content-Type-Options': 'nosniff'
  });
  response.end(method === 'HEAD' ? undefined : body);
}

/**
 * Create a deterministic static server for the generated production artifact.
 * The caller owns listen/close so tests can bind an ephemeral port.
 */
export function createQaServer({ distRoot = defaultDistRoot } = {}) {
  const staticRoot = resolve(distRoot);
  return createServer(async (request, response) => {
    const method = request.method || 'GET';
    if (method !== 'GET' && method !== 'HEAD') {
      response.writeHead(405, { Allow: 'GET, HEAD', 'Content-Type': 'text/plain; charset=utf-8' });
      response.end('Method not allowed');
      return;
    }

    try {
      const pathname = new URL(request.url || '/', 'http://127.0.0.1').pathname;
      const file = await resolveStaticFile(staticRoot, pathname);
      if (file) {
        await sendFile(response, file, 200, method);
        return;
      }
    } catch {
      // Malformed and invalid paths use the same deterministic 404 response.
    }

    const notFound = resolve(staticRoot, '404.html');
    if (await isFile(notFound)) {
      await sendFile(response, notFound, 404, method);
      return;
    }
    response.writeHead(404, { 'Cache-Control': 'no-store', 'Content-Type': 'text/plain; charset=utf-8' });
    response.end(method === 'HEAD' ? undefined : 'Not found');
  });
}

const invokedPath = process.argv[1] ? pathToFileURL(resolve(process.argv[1])).href : '';
if (invokedPath === import.meta.url) {
  const port = Number(process.env.GXA_QA_PORT || 4173);
  const host = '127.0.0.1';
  const server = createQaServer();
  server.listen(port, host, () => {
    console.log(`GXA browser QA server serving dist/ at http://${host}:${port}`);
  });
}
