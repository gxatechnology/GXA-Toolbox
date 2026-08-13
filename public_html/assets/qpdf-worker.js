/* qpdf is isolated from the UI thread because encryption can be CPU intensive. */
importScripts('/assets/vendor/qpdf/qpdf.js');

let modulePromise;

function getModule() {
  if (!modulePromise) {
    modulePromise = Module({
      noInitialRun: true,
      locateFile: file => file.endsWith('.wasm') ? '/assets/vendor/qpdf/qpdf.wasm' : file,
      print() {},
      printErr() {}
    });
  }
  return modulePromise;
}

self.addEventListener('message', async event => {
  const { id, operation, bytes, password } = event.data || {};
  if (!id || !(bytes instanceof ArrayBuffer)) return;
  const inputPath = `/input-${id}.pdf`;
  const outputPath = `/output-${id}.pdf`;
  try {
    const qpdf = await getModule();
    qpdf.FS.writeFile(inputPath, new Uint8Array(bytes));
    const args = operation === 'protect'
      ? ['--encrypt', password, password, '256', '--', inputPath, outputPath]
      : [`--password=${password}`, '--decrypt', inputPath, outputPath];
    const exitCode = qpdf.callMain(args);
    if (exitCode !== 0) throw new Error(operation === 'protect' ? 'PDF encryption failed.' : 'The password is incorrect or this PDF cannot be unlocked.');
    const output = qpdf.FS.readFile(outputPath).slice().buffer;
    self.postMessage({ id, output }, [output]);
  } catch (error) {
    self.postMessage({ id, error: error?.message || String(error) });
  } finally {
    try {
      const qpdf = await getModule();
      qpdf.FS.unlink(inputPath);
      qpdf.FS.unlink(outputPath);
    } catch (_) {
      // Virtual files may not exist after an early qpdf failure.
    }
  }
});
