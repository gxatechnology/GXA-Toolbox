# Phase 1 Dependency Integration Specification

> Historical note: Phase 1 originally blocked 13 routes. The current implementation and final 91-tool classification are authoritative in [TOOL_ENGINE_AUDIT.md](TOOL_ENGINE_AUDIT.md).

## Current status (2026-08-13)

Twelve of the 13 baseline dependency blockers now have real browser-side implementations:

- Protect and Unlock PDF use qpdf WebAssembly in an isolated worker, with a 25 MB file cap.
- OCR PDF streams rendered PDF pages through a Tesseract worker and returns extracted TXT. The OCR core and English model download on first use; the PDF stays local.
- Extract Images decodes supported PDF.js raster objects into PNG files in a validated ZIP; it remains intentionally distinct from rendering entire pages.
- Word and Excel to PDF create semantic/data-table PDFs with explicit layout and built-in-font limitations.
- PDF to Excel creates a heuristic XLSX workbook from positioned text.
- PDF to PPT creates a valid, image-based PPTX with one rendered PDF page per slide; the slides are not editable reconstructions.
- EPUB to PDF and PDF to EPUB implement bounded semantic reflow/package conversion.
- GIF Maker encodes real animation frames in a worker; GIF Frame Extractor performs bounded disposal-aware decoding and returns PNG frames in a ZIP.

The sole remaining blocker is `ppt-to-pdf`. Faithful PPT/PPTX rendering still requires a presentation-layout engine such as LibreOffice. The current free static/Netlify architecture does not include a suitably bounded browser renderer or serverless binary. The route therefore shows a specific explanation and does not accept or upload a file.

## Security and resource controls

- Browser engines enforce operation-specific page, file, pixel, cell, entry, and expanded-text limits.
- CPU-heavy qpdf, GIF, OCR, and PDF.js work runs in workers where the selected engine supports it.
- Input files remain in the browser for every newly implemented route.
- Generated PDF, GIF, ZIP, EPUB, XLSX, and PPTX artifacts are signature/package validated before the success state.
- Passwords are passed only to the local qpdf worker and are never logged or persisted.

## Optional high-fidelity service contract

A future high-fidelity Office service should use a separate locked-down worker rather than executing native processes inside the public PHP request:

- `POST /v1/jobs` as `multipart/form-data`: `tool`, `file`, and JSON `options`; returns a queued job identifier.
- `GET /v1/jobs/{job_id}` returns bounded progress and a sanitized public error code.
- `GET /v1/jobs/{job_id}/output?token=...` streams a validated artifact with an expiring token.
- Optional `DELETE /v1/jobs/{job_id}` cancels work and deletes source/output artifacts.

Such a service must use random per-job directories, argument-array process invocation, MIME/signature validation, unprivileged execution, CPU/memory/time limits, no content/password logging, immediate expiry cleanup, and independent output reopen checks. It is not part of the current Netlify deployment.
