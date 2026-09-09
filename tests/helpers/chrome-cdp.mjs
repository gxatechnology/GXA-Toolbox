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


export { CdpClient, waitForDebuggerUrl, evaluate, waitFor };

