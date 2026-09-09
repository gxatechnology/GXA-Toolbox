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
    let args;
    if (operation === 'protect') {
      args = ['--encrypt', password, password, '256', '--', inputPath, outputPath];
    } else if (operation === 'unlock') {
      args = [`--password=${password}`, '--decrypt', inputPath, outputPath];
    } else if (String(operation).startsWith('compress:')) {
      const mode = String(operation).split(':')[1];
      const common = ['--object-streams=generate', '--stream-data=compress', '--recompress-flate'];
      if (mode === 'low') {
        args = [...common, '--compression-level=6', inputPath, outputPath];
      } else if (mode === 'balanced') {
        args = [...common, '--compression-level=9', '--optimize-images', '--jpeg-quality=82', '--oi-min-width=64', '--oi-min-height=64', '--oi-min-area=4096', inputPath, outputPath];
      } else if (mode === 'high') {
        args = [...common, '--compression-level=9', '--optimize-images', '--jpeg-quality=52', '--oi-min-width=32', '--oi-min-height=32', '--oi-min-area=1024', inputPath, outputPath];
      } else {
        throw new Error('Unsupported PDF compression mode.');
      }
    } else {
      throw new Error('Unsupported qpdf operation.');
    }
    const exitCode = qpdf.callMain(args);
    if (exitCode !== 0) {
      if (operation === 'protect') throw new Error('PDF encryption failed.');
      if (operation === 'unlock') throw new Error('The password is incorrect or this PDF cannot be unlocked.');
      throw new Error('The PDF could not be compressed. It may be corrupt, encrypted, or password protected.');
    }
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
