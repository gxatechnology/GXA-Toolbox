# Phase 1 Dependency Integration Specification

The nine routes below intentionally generate no output in the current deployment. Their public pages disable uploads and show only: **“This conversion service is temporarily unavailable.”** (or the equally concise secure-PDF/OCR variant). Technical diagnostics belong in server logs and administration tooling, not the public route.

## Shared isolated document-service contract

All integrations use a separate locked-down worker rather than executing native processes inside the public PHP request.

- `POST /v1/jobs` as `multipart/form-data`: `tool`, `file`, and JSON `options`. Returns `202 { "job_id": "uuid", "status": "queued" }`.
- `GET /v1/jobs/{job_id}` returns `queued|processing|complete|failed`, integer progress, a public error code, and an expiring output token only when complete.
- `GET /v1/jobs/{job_id}/output?token=...` streams the validated artifact with `Content-Disposition: attachment`.
- Optional `DELETE /v1/jobs/{job_id}` cancels queued work and deletes source/output artifacts.

Environment variables:

- `GXA_DOCUMENT_SERVICE_URL`
- `GXA_DOCUMENT_SERVICE_TOKEN`
- `GXA_DOCUMENT_MAX_BYTES` (recommended initial limit: `104857600`)
- `GXA_DOCUMENT_TIMEOUT_SECONDS` (recommended: `120`)
- `GXA_DOCUMENT_TEMP_ROOT` (dedicated non-web directory)
- `GXA_DOCUMENT_RETENTION_SECONDS` (recommended: `900`)

The PHP application sends an authenticated server-to-server request and never exposes the service token or a native command to browser code.

## Exact route dependencies

| Route | Required engine | Why the current browser stack is insufficient | Open-source installation | Options/API payload | Included now |
|---|---|---|---|---|---|
| `protect-pdf` | qpdf 11+ | pdf-lib does not write standard password-encrypted PDFs | Debian/Ubuntu: `apt-get install qpdf` | `{ "user_password": "...", "owner_password": "...", "key_bits": 256 }` | Polished unavailable state and contract included; worker deferred |
| `unlock-pdf` | qpdf 11+ | pdf-lib cannot reliably decrypt encrypted PDFs | `apt-get install qpdf` | `{ "password": "user-supplied" }`; a password is always required | Polished unavailable state and contract included; worker deferred |
| `ocr-pdf` | OCRmyPDF, Tesseract language packs, Ghostscript, qpdf | No OCR model, page worker, language data, or searchable text-layer writer is bundled | `apt-get install ocrmypdf tesseract-ocr tesseract-ocr-eng ghostscript qpdf` | `{ "languages": ["eng"], "deskew": true, "output": "txt|searchable-pdf" }` | Polished unavailable state and contract included; worker deferred |
| `extract-images-pdf` | Poppler `pdfimages` | PDF.js page rendering is not direct extraction of embedded raster objects | `apt-get install poppler-utils` | `{ "format": "original|png|jpg" }`; output is ZIP plus manifest | Polished unavailable state and contract included; worker deferred |
| `word-to-pdf` | LibreOffice headless | Browser parsers cannot reproduce DOC/DOCX layout, fonts, pagination, fields, and embedded objects | `apt-get install libreoffice-writer fonts-liberation` | `{ "output": "pdf" }` | Polished unavailable state and contract included; worker deferred |
| `excel-to-pdf` | LibreOffice headless | Spreadsheet print areas, formulas, pagination, charts, and fonts require a workbook renderer | `apt-get install libreoffice-calc fonts-liberation` | `{ "output": "pdf", "sheet": "all" }` | Polished unavailable state and contract included; worker deferred |
| `ppt-to-pdf` | LibreOffice headless | Presentation layout, fonts, media, and slide rendering require a presentation engine | `apt-get install libreoffice-impress fonts-liberation` | `{ "output": "pdf" }` | Polished unavailable state and contract included; worker deferred |
| `pdf-to-excel` | pdfplumber + openpyxl; OCR service for scanned tables | Table boundaries and reading order require recognition plus workbook generation | `python -m pip install pdfplumber openpyxl` | `{ "pages": "all|range", "table_strategy": "lines|text" }` | Polished unavailable state and contract included; worker deferred |
| `pdf-to-ppt` | Poppler renderer + python-pptx | Faithful editable layout reconstruction is not available in PDF.js; reliable baseline output is page-per-slide imagery | `apt-get install poppler-utils` and `python -m pip install python-pptx Pillow` | `{ "pages": "all|range", "mode": "page-image" }`; public UI must disclose non-editable page imagery | Polished unavailable state and contract included; worker deferred |

Package licensing must be reviewed for the chosen hosting/distribution model before deployment. The listed packages are integration candidates, not bundled binaries in this repository.

## Native worker execution rules

- Create a random per-job directory beneath `GXA_DOCUMENT_TEMP_ROOT`; resolve and verify that every source/output path remains inside it.
- Generate server filenames; retain the user filename only as sanitized display metadata.
- Verify extension, declared MIME, and magic bytes before queueing work.
- Invoke executables through an argument-array API. Never construct a shell string and never interpolate a filename or password into shell text.
- Run as an unprivileged user with no network access, read-only application files, a writable job directory, CPU/memory/process limits, and a hard timeout.
- Do not log document contents or passwords. Password fields are held only for the job lifetime and are never stored in analytics.
- Enforce per-user/IP rate limits and concurrent-job limits. Reject archives and documents that exceed decompression/page limits.
- Delete input, output, logs containing filenames, and temporary profiles after download expiry, cancellation, or failure.
- Convert native error output to stable public error codes. Never return stack traces, native paths, commands, or executable output.

## Output validation

- PDF: `%PDF-` header, EOF marker, parser reopen, expected page count, and—where relevant—password-open tests.
- Protect: opening without the password must fail; opening with the supplied password must succeed.
- Unlock: the correct supplied password must produce an output that reopens without a password. Unknown-password bypass is never supported.
- OCR: TXT must contain recognized page text; searchable PDF must contain a real text layer verified by extraction.
- Image extraction: ZIP CRC validation, nonempty manifest, image magic-byte validation, and decoded nonzero dimensions.
- Office to PDF: parser reopen and page count greater than zero.
- XLSX/PPTX: ZIP/OOXML package validation plus reopening with an independent library.

## Hosting requirements

A Linux container or VM is recommended because ordinary shared PHP hosting generally cannot install or safely execute these engines. The worker needs isolated temporary storage, a queue, resource limits, monitoring, TLS, and private connectivity from the PHP application. qpdf/Poppler jobs are typically lightweight; LibreOffice and OCR workers require materially higher memory and startup allowances. None of these requirements weaken or block the 31 browser-capable Phase 1 routes.
