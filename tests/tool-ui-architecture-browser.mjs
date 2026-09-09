// Real-Chromium UI architecture regression without a browser-test dependency.
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { mkdtemp, mkdir, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { createQaServer } from './browser-qa-server.mjs';

const chromeExecutable = process.env.GXA_BROWSER_EXECUTABLE || 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
const evidence = resolve('test-results/tool-ui-architecture');
const profile = await mkdtemp(join(tmpdir(), 'gxa-tool-ui-chrome-'));
await mkdir(evidence, { recursive: true });

class CdpClient {
  constructor(url) {
    this.url = url;
    this.nextId = 1;
    this.pending = new Map();
    this.waiters = new Map();
  }

  async connect() {
    this.socket = new WebSocket(this.url);
    await new Promise((resolveOpen, rejectOpen) => {
      this.socket.addEventListener('open', resolveOpen, { once: true });
      this.socket.addEventListener('error', rejectOpen, { once: true });
    });
    this.socket.addEventListener('message', event => {
      const message = JSON.parse(event.data);
      if (message.id && this.pending.has(message.id)) {
        const { resolve: resolveCall, reject } = this.pending.get(message.id);
        this.pending.delete(message.id);
        if (message.error) reject(new Error(`${message.error.message} (${message.error.code})`));
        else resolveCall(message.result || {});
        return;
      }
      const waiters = this.waiters.get(message.method) || [];
      this.waiters.delete(message.method);
      waiters.forEach(resolveWaiter => resolveWaiter(message.params || {}));
    });
  }

  send(method, params = {}) {
    const id = this.nextId++;
    return new Promise((resolveCall, reject) => {
      this.pending.set(id, { resolve: resolveCall, reject });
      this.socket.send(JSON.stringify({ id, method, params }));
    });
  }

  waitFor(method, timeout = 20000) {
    return new Promise((resolveEvent, reject) => {
      const timer = setTimeout(() => reject(new Error(`Timed out waiting for ${method}`)), timeout);
      const resolveTimed = value => { clearTimeout(timer); resolveEvent(value); };
      this.waiters.set(method, [...(this.waiters.get(method) || []), resolveTimed]);
    });
  }

  close() {
    this.socket?.close();
  }
}

function waitForDebuggerUrl(child) {
  return new Promise((resolveUrl, reject) => {
    let output = '';
    const timer = setTimeout(() => reject(new Error(`Chrome did not expose DevTools. ${output}`)), 20000);
    child.stderr.on('data', chunk => {
      output += chunk.toString();
      const url = output.match(/DevTools listening on (ws:\/\/[^\s]+)/)?.[1];
      if (url) { clearTimeout(timer); resolveUrl(url); }
    });
    child.once('exit', code => { clearTimeout(timer); reject(new Error(`Chrome exited before DevTools was ready (${code}). ${output}`)); });
  });
}

async function evaluate(client, expression) {
  const response = await client.send('Runtime.evaluate', { expression, awaitPromise: true, returnByValue: true });
  if (response.exceptionDetails) throw new Error(response.exceptionDetails.exception?.description || response.exceptionDetails.text);
  return response.result?.value;
}

async function waitFor(client, expression, message, timeout = 20000) {
  const started = Date.now();
  while (Date.now() - started < timeout) {
    if (await evaluate(client, expression)) return;
    await new Promise(resolveWait => setTimeout(resolveWait, 80));
  }
  throw new Error(`Timed out: ${message}`);
}

const server = createQaServer();
await new Promise(done => server.listen(0, '127.0.0.1', done));
const origin = `http://127.0.0.1:${server.address().port}`;
const chrome = spawn(chromeExecutable, [
  '--headless=new', '--remote-debugging-port=0', `--user-data-dir=${profile}`,
  '--disable-background-networking', '--disable-component-update', '--disable-default-apps',
  '--disable-features=Translate,MediaRouter', '--disable-sync', '--no-first-run',
  `--unsafely-treat-insecure-origin-as-secure=${origin}`, 'about:blank'
], { stdio: ['ignore', 'ignore', 'pipe'], windowsHide: true });

let browserClient;
let pageClient;
try {
  const browserWs = await waitForDebuggerUrl(chrome);
  browserClient = new CdpClient(browserWs);
  await browserClient.connect();
  const debugPort = new URL(browserWs).port;
  const target = await (await fetch(`http://127.0.0.1:${debugPort}/json/new?${encodeURIComponent('about:blank')}`, { method: 'PUT' })).json();
  pageClient = new CdpClient(target.webSocketDebuggerUrl);
  await pageClient.connect();
  await Promise.all([
    pageClient.send('Page.enable'),
    pageClient.send('Runtime.enable'),
    pageClient.send('DOM.enable'),
    pageClient.send('Network.enable')
  ]);
  await pageClient.send('Network.setBlockedURLs', { urls: ['*googletagmanager.com*', '*google-analytics.com*', '*googlesyndication.com*', '*doubleclick.net*'] });
  await browserClient.send('Browser.grantPermissions', { origin, permissions: ['clipboardReadWrite', 'clipboardSanitizedWrite'] });

  async function setViewport(width, height) {
    await pageClient.send('Emulation.setDeviceMetricsOverride', {
      width, height, deviceScaleFactor: 1, mobile: width <= 768,
      screenWidth: width, screenHeight: height
    });
  }

  async function open(path, width, height) {
    await setViewport(width, height);
    await pageClient.send('Page.bringToFront');
    const loaded = pageClient.waitFor('Page.loadEventFired').catch(() => null);
    await pageClient.send('Page.navigate', { url: path ? `${origin}/${path}/` : `${origin}/` });
    await loaded;
    await waitFor(pageClient, "document.readyState === 'complete' && Boolean(document.querySelector('h1'))", `${path} heading`);
    await new Promise(resolveWait => setTimeout(resolveWait, 120));
  }

  async function layoutState() {
    return evaluate(pageClient, `(() => ({
      overflow: document.documentElement.scrollWidth - document.documentElement.clientWidth,
      h1: document.querySelector('h1')?.textContent?.trim() || '',
      modeRails: document.querySelectorAll('.phase-one-studio-rail, .studio-mode-button').length,
      technicalHeroBadges: document.querySelectorAll('.tool-header .processing-badge').length,
      toolWorkspace: Boolean(document.querySelector('.tool-workspace, .crop-editor-grid, #edit-pdf-mount, #image-converter-mount, #gps-map-camera-mount, .upload-page .drop-zone, .premium-blocker-card'))
    }))()`);
  }

  async function screenshot(name) {
    const metrics = await pageClient.send('Page.getLayoutMetrics');
    const size = metrics.cssContentSize || metrics.contentSize;
    const width = Math.max(1, Math.ceil(size.width));
    const height = Math.max(1, Math.min(16000, Math.ceil(size.height)));
    const shot = await pageClient.send('Page.captureScreenshot', {
      format: 'png', fromSurface: true, captureBeyondViewport: true,
      clip: { x: 0, y: 0, width, height, scale: 1 }
    });
    await writeFile(resolve(evidence, name), Buffer.from(shot.data, 'base64'));
  }

  const viewports = [
    [320, 568], [360, 800], [375, 812], [390, 844], [412, 915], [430, 932], [768, 1024],
    [1024, 768], [1280, 720], [1366, 768], [1440, 900], [1536, 864], [1920, 1080]
  ];
  for (const [width, height] of viewports) {
    await open('password-generator', width, height);
    await waitFor(pageClient, "Boolean(document.querySelector('#generated-password-value'))", 'password output');
    const state = await layoutState();
    assert.ok(state.h1.includes('Password Generator'));
    assert.ok(state.overflow <= 1, `Password Generator overflows ${width}×${height} by ${state.overflow}px`);
    assert.equal(state.modeRails, 0);
    assert.equal(state.technicalHeroBadges, 0);
    const targets = await evaluate(pageClient, `Array.from(document.querySelectorAll('.password-result-actions .btn')).map(button => button.getBoundingClientRect().height)`);
    assert.ok(targets.every(value => value >= 44), `${width}px password actions need 44px touch/click targets`);
    await screenshot(`password-generator-${width}x${height}.png`);
  }

  await open('password-generator', 390, 844);
  for (const length of [8, 16, 32, 64]) {
    const value = await evaluate(pageClient, `(setPwLength(${length}), document.querySelector('#generated-password-value').textContent)`);
    assert.equal(value.length, length, `Password preset ${length} must render every character`);
  }
  const password = await evaluate(pageClient, "document.querySelector('#generated-password-value').textContent");
  const copiedPassword = await evaluate(pageClient, "(async () => { await copyPasswordToClipboard(); return navigator.clipboard.readText(); })()");
  assert.equal(copiedPassword, password, 'Copy must place the complete 64-character password on the clipboard');
  await screenshot('password-generator-390x844-length-64.png');

  await open('hash-tool', 320, 568);
  const hash = await evaluate(pageClient, `(async () => {
    document.querySelector('#opt-hash-text').value = 'GXA Toolbox architecture regression';
    document.querySelector('#opt-hash-algo').value = 'SHA-512';
    await generateHashTextLive();
    return document.querySelector('#generated-hash-value').textContent.trim();
  })()`);
  assert.equal(hash.length, 128, 'SHA-512 output must remain complete');
  const copiedHash = await evaluate(pageClient, "(async () => { await copyGeneratedHash(); return navigator.clipboard.readText(); })()");
  assert.equal(copiedHash, hash, 'Copy complete hash must preserve all 128 characters');
  assert.ok((await layoutState()).overflow <= 1, 'Hash tool must not overflow at 320px');
  await screenshot('hash-tool-320x568.png');

  await open('merge-pdf', 390, 844);
  const documentNode = await pageClient.send('DOM.getDocument', { depth: 1 });
  const pickerNode = await pageClient.send('DOM.querySelector', { nodeId: documentNode.root.nodeId, selector: '#file-picker' });
  assert.ok(pickerNode.nodeId, 'Merge PDF file picker must exist');
  await pageClient.send('DOM.setFileInputFiles', {
    nodeId: pickerNode.nodeId,
    files: [resolve('tests/fixtures/one-page.pdf'), resolve('tests/fixtures/multi-page.pdf')]
  });
  await waitFor(pageClient, "document.querySelectorAll('.file-card').length === 2", 'two Merge PDF queue cards');
  const mergeState = await evaluate(pageClient, `(() => ({
    family: document.querySelector('.tool-workspace')?.dataset.workspaceFamily,
    action: document.querySelector('#btn-process-action')?.textContent.trim(),
    orderButtons: document.querySelectorAll('.file-card-order-controls button').length,
    removeButtons: document.querySelectorAll('.file-card-remove').length,
    outputName: document.querySelector('#opt-filename')?.value,
    railCount: document.querySelectorAll('.phase-one-studio-rail, .studio-mode-button').length
  }))()`);
  assert.equal(mergeState.family, 'pdf-multi-file');
  assert.equal(mergeState.action, 'Merge PDFs');
  assert.equal(mergeState.orderButtons, 4);
  assert.equal(mergeState.removeButtons, 2);
  assert.equal(mergeState.outputName, 'merged_output.pdf');
  assert.equal(mergeState.railCount, 0);
  const initialOrder = await evaluate(pageClient, "appState.activeFiles.map(file => file.name)");
  await evaluate(pageClient, "document.querySelectorAll('.file-card-order-controls button')[1].click()");
  const reordered = await evaluate(pageClient, "appState.activeFiles.map(file => file.name)");
  assert.deepEqual(reordered, [initialOrder[1], initialOrder[0]], 'visible order control must reorder Merge PDF files');
  await evaluate(pageClient, "document.querySelectorAll('.file-card-remove')[1].click()");
  assert.equal(await evaluate(pageClient, "appState.activeFiles.length"), 1, 'Remove must delete one queued PDF');
  const addDocument = await pageClient.send('DOM.getDocument', { depth: 1 });
  const addPicker = await pageClient.send('DOM.querySelector', { nodeId: addDocument.root.nodeId, selector: '#file-picker' });
  await pageClient.send('DOM.setFileInputFiles', { nodeId: addPicker.nodeId, files: [resolve('tests/fixtures/text.pdf')] });
  await waitFor(pageClient, "appState.activeFiles.length === 2", 'add another PDF after removal');
  await evaluate(pageClient, "document.querySelector('#opt-reverse').click()");
  assert.equal(await evaluate(pageClient, "appState.activeToolOptions.reverse"), true, 'reverse-order option must update the merge state');
  assert.ok((await layoutState()).overflow <= 1, 'Merge PDF queue must not overflow at 390px');
  await screenshot('merge-pdf-390x844-selected.png');
  await evaluate(pageClient, "document.querySelector('#btn-process-action').click()");
  await waitFor(pageClient, "!document.querySelector('#tool-complete-mount').classList.contains('hidden')", 'Merge PDF result', 30000);
  const mergedPdf = await evaluate(pageClient, `(async () => {
    const bytes = new Uint8Array(await premiumEditorState.resultBlob.arrayBuffer());
    return { header: String.fromCharCode(...bytes.slice(0, 5)), size: bytes.length, filename: premiumEditorState.resultFilename };
  })()`);
  assert.equal(mergedPdf.header, '%PDF-', 'Merge PDF must create a real PDF output');
  assert.ok(mergedPdf.size > 100, 'Merge PDF output must not be empty');
  assert.equal(mergedPdf.filename, 'merged_output.pdf');
  await screenshot('merge-pdf-390x844-result.png');

  await open('merge-pdf', 1366, 768);
  await screenshot('merge-pdf-1366x768-pre-upload.png');
  const desktopDocument = await pageClient.send('DOM.getDocument', { depth: 1 });
  const desktopPicker = await pageClient.send('DOM.querySelector', { nodeId: desktopDocument.root.nodeId, selector: '#file-picker' });
  await pageClient.send('DOM.setFileInputFiles', { nodeId: desktopPicker.nodeId, files: [resolve('tests/fixtures/one-page.pdf'), resolve('tests/fixtures/multi-page.pdf')] });
  await waitFor(pageClient, "document.querySelectorAll('.file-card').length === 2", 'desktop Merge PDF queue');
  await screenshot('merge-pdf-1366x768-selected.png');

  async function exerciseCompressImage(width, height, name) {
    await open('compress-image', width, height);
    const documentNode = await pageClient.send('DOM.getDocument', { depth: 1 });
    const pickerNode = await pageClient.send('DOM.querySelector', { nodeId: documentNode.root.nodeId, selector: '#file-picker' });
    await pageClient.send('DOM.setFileInputFiles', { nodeId: pickerNode.nodeId, files: [resolve('tests/fixtures/sample.jpg')] });
    await waitFor(pageClient, "document.querySelectorAll('.file-card').length === 1", 'Compress Image queue');
    await evaluate(pageClient, "document.querySelector('#btn-process-action').click()");
    await waitFor(pageClient, "!document.querySelector('#tool-complete-mount').classList.contains('hidden')", 'Compress Image result', 30000);
    assert.ok((await layoutState()).overflow <= 1, `Compress Image must not overflow at ${width}px`);
    await screenshot(name);
  }
  await exerciseCompressImage(390, 844, 'compress-image-390x844-result.png');
  await exerciseCompressImage(1366, 768, 'compress-image-1366x768-result.png');

  async function exerciseBase64(width, height, name) {
    await open('base64-tool', width, height);
    const output = await evaluate(pageClient, `(() => {
      const input = document.querySelector('#opt-b64-raw');
      input.value = 'GXA Toolbox Base64 regression';
      input.dispatchEvent(new Event('input', { bubbles: true }));
      return document.querySelector('#generator-preview-mount').textContent;
    })()`);
    assert.ok(output.includes('R1hBIFRvb2xib3ggQmFzZTY0IHJlZ3Jlc3Npb24='), 'Base64 output must reflect the entered text');
    assert.ok((await layoutState()).overflow <= 1, `Base64 must not overflow at ${width}px`);
    await screenshot(name);
  }
  await exerciseBase64(390, 844, 'base64-tool-390x844.png');
  await exerciseBase64(1366, 768, 'base64-tool-1366x768.png');

  await open('', 1366, 768);
  await evaluate(pageClient, "document.querySelector('#nav-pdf-trigger').click()");
  await waitFor(pageClient, "document.querySelector('[data-nav-category=\"pdf\"]').classList.contains('menu-expanded')", 'PDF menu');
  await screenshot('mega-menu-pdf-1366x768.png');
  await evaluate(pageClient, "document.querySelector('#nav-image-trigger').click()");
  await waitFor(pageClient, "document.querySelector('[data-nav-category=\"image\"]').classList.contains('menu-expanded')", 'Image menu');
  await screenshot('mega-menu-image-1366x768.png');

  const representatives = [
    'merge-pdf', 'edit-pdf', 'image-converter', 'gps-map-camera', 'crop-image', 'background-remover',
    'compress-image', 'image-ocr', 'password-generator', 'hash-tool', 'barcode-generator', 'calculator',
    'pdf-metadata', 'protect-pdf', 'zip-manager', 'epub-to-pdf'
  ];
  for (const [width, height] of [[390, 844], [1366, 768]]) {
    for (const route of representatives) {
      await open(route, width, height);
      try {
        await waitFor(pageClient, "Boolean(document.querySelector('.tool-workspace, .crop-editor-grid, #edit-pdf-mount, #image-converter-mount, #gps-map-camera-mount, .upload-page .drop-zone, .premium-blocker-card'))", `${route} hydrated route surface`);
      } catch (error) {
        const debug = await evaluate(pageClient, `(() => ({
          url: location.href,
          page: typeof appState === 'object' ? appState.currentPage : 'unavailable',
          mainText: document.querySelector('#main-content')?.textContent?.trim().slice(0, 240) || '',
          mainClasses: Array.from(document.querySelector('#main-content')?.querySelectorAll('[class]') || []).slice(0, 12).map(node => node.className)
        }))()`);
        throw new Error(`${error.message}: ${JSON.stringify(debug)}`);
      }
      const state = await layoutState();
      assert.ok(state.h1, `${route} needs a visible H1 at ${width}px`);
      assert.ok(state.toolWorkspace, `${route} needs its focused workspace at ${width}px`);
      assert.ok(state.overflow <= 1, `${route} overflows ${width}px by ${state.overflow}px`);
      assert.equal(state.modeRails, 0, `${route} must not render cross-tool pseudo-modes`);
    }
  }

  await open('help', 390, 844);
  const help = await evaluate(pageClient, `(() => ({
    h1: document.querySelector('h1')?.textContent.trim(),
    sections: document.querySelectorAll('.content-page-body section').length,
    canonical: document.querySelector('link[rel="canonical"]')?.href,
    overflow: document.documentElement.scrollWidth - document.documentElement.clientWidth
  }))()`);
  assert.equal(help.h1, 'Help Center');
  assert.ok(help.sections >= 6, 'Help Center needs substantive static documentation sections');
  assert.equal(help.canonical, 'https://gxatoolbox.in/help/');
  const helpLinks = await evaluate(pageClient, "document.querySelectorAll('.help-tool-directory a[href]').length");
  assert.equal(helpLinks, 95, 'Help Center must link to every registered tool exactly once');
  assert.ok(help.overflow <= 1, 'Help Center must not overflow at 390px');
  await screenshot('help-center-390x844.png');
  await open('help', 1366, 768);
  assert.equal(await evaluate(pageClient, "document.querySelectorAll('.help-tool-directory a[href]').length"), 95);
  await screenshot('help-center-1366x768.png');

  console.log(`Tool UI real-Chromium QA passed: ${viewports.length} requested viewports, ${representatives.length} cross-family routes at mobile and desktop, complete password/hash clipboard checks, Merge PDF queue checks, and Help Center SEO/layout.`);
} finally {
  pageClient?.close();
  browserClient?.close();
  const chromeExited = new Promise(resolveExit => chrome.once('exit', resolveExit));
  chrome.kill();
  await Promise.race([chromeExited, new Promise(resolveWait => setTimeout(resolveWait, 3000))]);
  await new Promise(done => server.close(done));
  await rm(profile, { recursive: true, force: true, maxRetries: 10, retryDelay: 100 });
}
