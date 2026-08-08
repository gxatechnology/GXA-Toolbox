const base = import.meta.env.BASE_URL.endsWith('/') ? import.meta.env.BASE_URL : `${import.meta.env.BASE_URL}/`;

export const MODEL_URL = `${base}models/u2netp-web.onnx`;
export const MODEL_CONFIG_URL = `${base}models/model-config.json`;
export const ORT_WASM_PATH = `${base}vendor/ort/`;
export const MODEL_BYTES = 4_574_267;

const requiredAssets = [
  { label: 'U2NetP model', url: MODEL_URL },
  { label: 'ONNX WASM loader', url: `${ORT_WASM_PATH}ort-wasm-simd-threaded.mjs` },
  { label: 'ONNX WASM binary', url: `${ORT_WASM_PATH}ort-wasm-simd-threaded.wasm` },
  { label: 'ONNX WebGPU loader', url: `${ORT_WASM_PATH}ort-wasm-simd-threaded.jsep.mjs` },
  { label: 'ONNX WebGPU binary', url: `${ORT_WASM_PATH}ort-wasm-simd-threaded.jsep.wasm` }
];

let verification: Promise<void> | null = null;

async function assertAsset(label: string, url: string, signal?: AbortSignal): Promise<void> {
  let response: Response;
  try {
    response = await fetch(url, { method: 'HEAD', cache: 'no-store', signal });
  } catch {
    response = await fetch(url, { headers: { Range: 'bytes=0-0' }, cache: 'no-store', signal });
  }
  const contentType = response.headers.get('content-type') || '';
  console.info('[Background Remover]', label, { url, status: response.status, contentType });
  if (!response.ok) throw new Error(`${label} returned HTTP ${response.status}.`);
  if (/text\/html/i.test(contentType)) throw new Error(`${label} was rewritten to HTML. Check the deployment redirects for ${url}.`);
}

export function verifyRuntimeAssets(signal?: AbortSignal): Promise<void> {
  if (!verification) {
    verification = (async () => {
      for (const asset of requiredAssets) await assertAsset(asset.label, asset.url, signal);
    })().catch((error) => {
      verification = null;
      throw error;
    });
  }
  return verification;
}
