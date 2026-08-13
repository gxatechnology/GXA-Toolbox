# GXA Toolbox browser-engine QA evidence

Date: 2026-08-13

## Test method

The static production entry was served through `tests/browser-qa-server.mjs` at `http://127.0.0.1:4173`. Synthetic files from `tests/fixtures` were selected through the real visible upload controls in the in-app Chromium browser. Each route was allowed to execute its production processing handler. A pass required the real completion screen, a non-empty named output, the Download Result control, no `data-gxa-last-processing-error`, and the route’s output validator.

The browser-generated DOCX-to-PDF result was also downloaded to `C:\Users\tauqe\Downloads\sample_converted.pdf` and independently reopened with `qpdf --check`; qpdf returned exit code 0 with no syntax or stream-encoding errors.

## Baseline dependency-route results

| Route | Fixture | Browser result | Validation / observed limitation |
|---|---|---|---|
| `protect-pdf` | `one-page.pdf` plus synthetic password | Completion screen and Download Result | qpdf worker returned a PDF; direct contract independently verifies a genuine `/Encrypt` dictionary |
| `unlock-pdf` | `encrypted-password.pdf` plus `gxa-fixture` | Completion screen and Download Result | qpdf worker returned a PDF; direct contract verifies `/Encrypt` is removed |
| `word-to-pdf` | `sample.docx` | `sample_converted.pdf`, 936 B | Browser PDF preview opened; downloaded artifact passed independent qpdf syntax/stream check |
| `excel-to-pdf` | `sample.xlsx` | `sample_spreadsheet.pdf`, 970 B | PDF signature/trailer validation and browser PDF preview |
| `epub-to-pdf` | `sample.epub` | `sample_converted.pdf`, 977 B | PDF signature/trailer validation and browser PDF preview |
| `pdf-to-epub` | `text.pdf` | `text_converted.epub`, 1.90 KiB | JSZip CRC plus required EPUB package entries/mimetype |
| `gif-maker` | `landscape.png` + `portrait.png` | `animation_maker.gif`, 81.12 KiB | GIF89a signature and trailer; worker encoding; a second run also decoded the synthetic JPEG fixture |
| `gif-to-png` | `sample.gif` | `sample_frames.zip`, 646 B | Strict two-frame GIF decode; PNG-frame ZIP and manifest generated |
| `extract-images-pdf` | `embedded-image.pdf` | `extracted_images_embedded-image.zip`, 2.42 KiB | Actual PDF.js raster object decoded through its ImageBitmap path; output is not a page-render fallback |
| `ocr-pdf` | `scanned.pdf` | `scanned_ocr.txt`, 34 B | Tesseract worker executed in 5.24 s and returned non-placeholder recognized text; the tiny synthetic bitmap demonstrates normal OCR accuracy limits |
| `pdf-to-excel` | `text.pdf` | `text_tables.xlsx`, 8.95 KiB | Required OOXML workbook entries validated through JSZip |
| `pdf-to-ppt` | `one-page.pdf` | `one-page_presentation.pptx`, 53.95 KiB | Required OOXML presentation entries validated through JSZip; output is explicitly image-based |

`ppt-to-pdf` remains the sole blocker. Its route exposes no file input and shows the specific reason: a faithful PPT/PPTX presentation renderer is not included. It does not fabricate output or upload a file.

## Responsive directory and result checks

| Viewport | Horizontal overflow | GXA Toolbox brand | Directory cards | Listing badges | Search overlap | Category behavior |
|---|---:|---|---:|---:|---|---|
| 1920×1080 | 0 px | Visible | 91 | 0 | None | Inline |
| 1366×768 | 0 px | Visible | 91 | 0 | None | Inline |
| 768×1024 | 0 px | Visible | 91 | 0 | None | Fits available width |
| 390×844 | 0 px | Visible | 91 | 0 | None | Horizontal scroll |
| 360×800 | 0 px | Visible | 91 | 0 | None | Horizontal scroll |

At 390×844 and 360×800, a completed GIF result kept Download Result within the viewport, the settings panel remained within the viewport, and document width matched the viewport. The mobile drawer opened with body scroll lock and exposed Home, All Tools, PDF, Image, Calculators, Converters, ZIP, Developer, Dashboard, language, theme, support, Sign In, and Sign Up actions.

## Automated contracts

- `tests/browser-engine-contract.mjs` enforces the exact 91-row registry/matrix match, exactly one accepted final decision per row, zero directory badge rendering, one blocker, package assets, strict GIF bounds/truncation rejection, real DOCX extraction, and genuine qpdf encrypt/decrypt outputs.
- `tests/phase-one-output-validation.mjs` validates synthetic PNG/JPEG dimensions, WebP/GIF/PDF signatures, PDF page counts, encrypted-PDF presence, and package families.
- The production `validateGeneratedOutputBlob` validates PDF signatures/trailers, decodes images, validates GIF signatures, CRC-checks ZIPs, and checks required EPUB/XLSX/PPTX/DOCX package entries before presenting success.

This evidence is intentionally narrower than claiming native Office fidelity or perfect OCR. The exact supported scope and remaining limitations are recorded in `docs/TOOL_ENGINE_AUDIT.md`.
