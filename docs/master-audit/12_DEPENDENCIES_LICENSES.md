# Dependencies and License Inventory

## Direct production dependencies

| Dependency | Declared version | License | Purpose | Surface | Note |
|---|---|---|---|---|---|
| `@neslinesli93/qpdf-wasm` | `^0.3.0` | ISC; qpdf Apache-2.0 | PDF protect/unlock assets | Browser Worker/WASM | Preserve both notices |
| `@netlify/database` | `^1.1.0` | MIT | PostgreSQL tagged SQL | Serverless | Direct |
| `@netlify/identity` | `^1.2.0` | MIT | User auth client | Browser/network | Direct |
| `gifenc` | `^1.0.3` | MIT | GIF encoding | Browser Worker | Direct |
| `mammoth` | `^1.12.1` | BSD-2-Clause | DOCX semantic extraction | Browser | Direct |
| `onnxruntime-web` | `^1.23.0` (resolved 1.27 in current install) | MIT | ONNX inference | Browser/WASM/WebGPU | Root + BG versions should stay aligned |
| `tesseract.js` | `^7.0.0` | Apache-2.0 | OCR Worker orchestration | Browser Worker/WASM | Core/language resources separate |
| `react` | `^19.2.8` | MIT | Background Remover UI | Browser | BG app |
| `react-dom` | `^19.2.8` | MIT | Background Remover DOM runtime | Browser | BG app |
| `zustand` | `^5.0.14` | MIT | Background Remover state | Browser | BG app |

Unique direct production packages: **10** (deduplicating ONNX across root/BG manifests).

## Direct development dependencies

Seventeen unique direct development packages support database emulation, bundling, TypeScript/Vite, ESLint, Vitest/jsdom and React Testing Library: `@netlify/database-dev`, `esbuild`, `vite`, `vitest`, `typescript`, `typescript-eslint`, `eslint`, `@eslint/js`, `globals`, `@vitejs/plugin-react`, `@testing-library/react`, `@testing-library/jest-dom`, `jsdom`, `@types/react`, `@types/react-dom`, `eslint-plugin-react-hooks`, and `eslint-plugin-react-refresh`. Their current declared versions and lockfile notices are the package-manager authority. The dominant licenses are MIT; notices should be generated from the lockfile before redistribution.

## Vendored libraries

| Family | Bundle groups | License | Use | Review point |
|---|---:|---|---|---|
| gifenc | 1 | MIT | GIF Maker | Preserve notice |
| Mammoth | 1 | BSD-2-Clause | Word to PDF | Preserve notice |
| ONNX Runtime Web | 2 | MIT | Root/BG inference assets | Duplicate versions/bundles |
| PptxGenJS | 1 | MIT | PDF to PPT | Preserve notice |
| qpdf wrapper/qpdf | 1 | ISC / Apache-2.0 | Protect/Unlock | Dual component notices |
| SheetJS CE | 1 | Apache-2.0 | Excel/PDF conversions | Confirm bundled build/version |
| Tesseract | 1 | Apache-2.0 | OCR | Core/language data notices |

Result: **7 unique families across 8 checked-in bundle groups**.

## Runtime/CDN resources

| Resource | License | Concern |
|---|---|---|
| pdf-lib 1.17.1 | MIT | Initial remote script; pin/integrity/self-host review |
| JSZip 3.10.1 | MIT OR GPL-3.0-or-later | Select/document intended license |
| Lucide | ISC | `@latest` is unpinned; pin exact version |
| PDF.js 3.11.174 | Apache-2.0 | CDN + matching worker required |
| QRCode.js | MIT | Runtime library |
| JsBarcode | MIT | Runtime library |
| exifr | MIT | Version pinning should be explicit |
| Cropper.js | MIT | Runtime fallback consistency |
| html2canvas 1.4.1 | MIT | Runtime library |
| Google Fonts | OFL per family | Retain font-license compliance; consider self-hosting |
| Tesseract core/language data | Component-specific | Confirm data package/source attribution |
| U2NetP ONNX model | UNKNOWN in this audit | Model provenance/license requires explicit documentation |

## Commercial-use review

No AGPL direct dependency was identified. This is not legal clearance. Review JSZip's dual-license selection, the ONNX model license/provenance, Tesseract language assets, font licenses, all transitive lockfile packages and checked-in notice files with qualified counsel before commercial distribution.
