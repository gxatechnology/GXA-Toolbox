const active = new Map();
export function cancelAll() {
  for (const cancel of [...active.values()]) cancel();
}
window.addEventListener('pagehide', cancelAll);
window.GxaEngineJobs = { cancelAll };

export function runJob(kind, input, options = {}, key = kind, timeout = 10000) {
  active.get(key)?.();
  return new Promise((resolve, reject) => {
    let worker, timer, settled = false;
    const finish = (error, result) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      worker?.terminate();
      active.delete(key);
      if (error) reject(error); else resolve(result);
    };
    active.set(key, () => finish(new DOMException('Processing cancelled.', 'AbortError')));
    try {
      worker = new Worker('/assets/engine-worker.js');
      timer = setTimeout(() => finish(new Error('Processing exceeded the safe time limit. Simplify the input and retry.')), timeout);
      worker.onmessage = ({ data }) => finish(data.error ? new Error(data.error) : null, data.result);
      worker.onerror = () => finish(new Error('The local engine could not load. Reload the page and retry.'));
      worker.postMessage({ kind, input, options }, kind === 'trace' ? [input.data.buffer] : []);
    } catch (error) { finish(error); }
  });
}

export async function formatInto(kind, inputId, outputId, title) {
  const input = document.getElementById(inputId);
  const mount = document.getElementById('generator-preview-mount');
  if (!input || !mount) return;
  const revision = (mount.engineRevision || 0) + 1;
  mount.engineRevision = revision;
  active.get('formatter')?.();
  window.GxaToolSafety.textResult(mount, title, 'Formatting locally…', '', false);
  try {
    await new Promise(resolve => setTimeout(resolve, 200));
    if (!mount.isConnected || mount.engineRevision !== revision) return;
    const result = await runJob(kind, input.value, {}, 'formatter');
    if (mount.isConnected && mount.engineRevision === revision) window.GxaToolSafety.textResult(mount, title, result, outputId, true);
  } catch (error) {
    if (error.name === 'AbortError' || !mount.isConnected || mount.engineRevision !== revision) return;
    const alert = document.createElement('p');
    alert.className = 'preview-error-state';
    alert.setAttribute('role', 'alert');
    alert.textContent = error.message;
    mount.replaceChildren(alert);
  }
}
