# Phase 4 content quality audit

## Scope and evidence

Compared the preserved initial-HTML baseline with current generated HTML for all 81 indexable tools. Exact checks normalize case and punctuation; near matches use word-set Jaccard >= 0.65. This is a screening threshold, not a Google metric or a substitute for human review. Existing repository tests use a looser 0.78 threshold.

| Measure | Before | After |
|---|---:|---:|
| Duplicate title groups | 0 | 0 |
| Duplicate meta groups | 0 | 0 |
| Duplicate intro groups | 0 | 0 |
| Cross-route identical paragraph groups | 5 | 5 |
| Near intro/how-to/FAQ pairs at 0.65 | 180 | 157 |
| Tools with related-guide links | 0 | 81 |

## Material revisions

- /merge-pdf/
- /split-pdf/
- /pdf-to-jpg/
- /jpg-to-pdf/
- /compress-pdf/
- /image-converter/
- /compress-image/
- /resize-image/
- /crop-image/
- /image-ocr/
- /background-remover/
- /qr-reader/
- /barcode-reader/
- /image-to-pdf/
- /password-generator/
- /barcode-generator/
- /base64-tool/
- /json-tool/
- /emi-calculator/
- /gst-calculator/

Twenty priority routes received new introductions, four-step instructions, practical examples, three tailored FAQs and tips. Three of those routes remain noindex/ad-free: Base64, QR Reader and Barcode Reader. The generic metadata suffix was removed across tools; canonical URLs and the 81/14 tool publication policy are unchanged. New category/guide pages are checked separately by phase4-content-contract.mjs for unique metadata, H1, canonical and real internal destinations.

## Remaining sentence-frame debt

33 indexable tool pages still contain at least one legacy converter/calculator/utility sentence frame in a feature, use-case or explanatory block. They already have actual implementation guidance and examples, but this is not equivalent to completing the requested site-wide editorial rewrite.

- /password-generator/ — review source public_html/assets/tool-content.js and emitted dist/password-generator/index.html
- /barcode-generator/ — review source public_html/assets/tool-content.js and emitted dist/barcode-generator/index.html
- /color-extractor/ — review source public_html/assets/tool-content.js and emitted dist/color-extractor/index.html
- /epub-to-pdf/ — review source public_html/assets/tool-content.js and emitted dist/epub-to-pdf/index.html
- /pdf-to-epub/ — review source public_html/assets/tool-content.js and emitted dist/pdf-to-epub/index.html
- /gif-maker/ — review source public_html/assets/tool-content.js and emitted dist/gif-maker/index.html
- /excel-to-pdf/ — review source public_html/assets/tool-content.js and emitted dist/excel-to-pdf/index.html
- /ppt-to-pdf/ — review source public_html/assets/tool-content.js and emitted dist/ppt-to-pdf/index.html
- /pdf-to-text/ — review source public_html/assets/tool-content.js and emitted dist/pdf-to-text/index.html
- /pdf-to-html/ — review source public_html/assets/tool-content.js and emitted dist/pdf-to-html/index.html
- /markdown-to-pdf/ — review source public_html/assets/tool-content.js and emitted dist/markdown-to-pdf/index.html
- /pdf-to-markdown/ — review source public_html/assets/tool-content.js and emitted dist/pdf-to-markdown/index.html
- /svg-to-png/ — review source public_html/assets/tool-content.js and emitted dist/svg-to-png/index.html
- /png-to-svg/ — review source public_html/assets/tool-content.js and emitted dist/png-to-svg/index.html
- /webp-to-jpg/ — review source public_html/assets/tool-content.js and emitted dist/webp-to-jpg/index.html
- /gif-to-png/ — review source public_html/assets/tool-content.js and emitted dist/gif-to-png/index.html
- /text-to-speech/ — review source public_html/assets/tool-content.js and emitted dist/text-to-speech/index.html
- /json-tool/ — review source public_html/assets/tool-content.js and emitted dist/json-tool/index.html
- /hash-tool/ — review source public_html/assets/tool-content.js and emitted dist/hash-tool/index.html
- /word-counter/ — review source public_html/assets/tool-content.js and emitted dist/word-counter/index.html
- /lorem-ipsum/ — review source public_html/assets/tool-content.js and emitted dist/lorem-ipsum/index.html
- /diff-checker/ — review source public_html/assets/tool-content.js and emitted dist/diff-checker/index.html
- /regex-tester/ — review source public_html/assets/tool-content.js and emitted dist/regex-tester/index.html
- /markdown-editor/ — review source public_html/assets/tool-content.js and emitted dist/markdown-editor/index.html
- /color-converter/ — review source public_html/assets/tool-content.js and emitted dist/color-converter/index.html
- /exif-viewer/ — review source public_html/assets/tool-content.js and emitted dist/exif-viewer/index.html
- /timestamp-converter/ — review source public_html/assets/tool-content.js and emitted dist/timestamp-converter/index.html
- /png-to-pdf/ — review source public_html/assets/tool-content.js and emitted dist/png-to-pdf/index.html
- /txt-to-pdf/ — review source public_html/assets/tool-content.js and emitted dist/txt-to-pdf/index.html
- /pdf-to-image/ — review source public_html/assets/tool-content.js and emitted dist/pdf-to-image/index.html
- /pdf-to-png/ — review source public_html/assets/tool-content.js and emitted dist/pdf-to-png/index.html
- /pdf-to-excel/ — review source public_html/assets/tool-content.js and emitted dist/pdf-to-excel/index.html
- /pdf-to-ppt/ — review source public_html/assets/tool-content.js and emitted dist/pdf-to-ppt/index.html

## Remaining near matches

- intro: /epub-to-pdf/ ↔ /pdf-to-epub/ (0.68)
- howTo: /epub-to-pdf/ ↔ /pdf-to-epub/ (0.81)
- faq: /epub-to-pdf/ ↔ /pdf-to-epub/ (0.77)
- faq: /epub-to-pdf/ ↔ /excel-to-pdf/ (0.69)
- howTo: /epub-to-pdf/ ↔ /ppt-to-pdf/ (0.7)
- faq: /epub-to-pdf/ ↔ /ppt-to-pdf/ (0.7)
- intro: /epub-to-pdf/ ↔ /pdf-to-text/ (0.66)
- faq: /epub-to-pdf/ ↔ /pdf-to-text/ (0.69)
- faq: /epub-to-pdf/ ↔ /pdf-to-html/ (0.68)
- faq: /epub-to-pdf/ ↔ /markdown-to-pdf/ (0.7)
- faq: /epub-to-pdf/ ↔ /pdf-to-markdown/ (0.66)
- howTo: /epub-to-pdf/ ↔ /svg-to-png/ (0.68)
- faq: /epub-to-pdf/ ↔ /webp-to-jpg/ (0.68)
- howTo: /epub-to-pdf/ ↔ /png-to-pdf/ (0.72)
- faq: /epub-to-pdf/ ↔ /txt-to-pdf/ (0.68)
- howTo: /epub-to-pdf/ ↔ /pdf-to-image/ (0.72)
- faq: /epub-to-pdf/ ↔ /pdf-to-image/ (0.68)
- howTo: /epub-to-pdf/ ↔ /pdf-to-png/ (0.73)
- faq: /epub-to-pdf/ ↔ /pdf-to-png/ (0.67)
- howTo: /epub-to-pdf/ ↔ /pdf-to-excel/ (0.74)
- faq: /epub-to-pdf/ ↔ /pdf-to-excel/ (0.68)
- faq: /epub-to-pdf/ ↔ /pdf-to-ppt/ (0.66)
- howTo: /pdf-to-epub/ ↔ /excel-to-pdf/ (0.67)
- faq: /pdf-to-epub/ ↔ /excel-to-pdf/ (0.69)
- howTo: /pdf-to-epub/ ↔ /ppt-to-pdf/ (0.7)
- faq: /pdf-to-epub/ ↔ /ppt-to-pdf/ (0.73)
- faq: /pdf-to-epub/ ↔ /pdf-to-text/ (0.71)
- intro: /pdf-to-epub/ ↔ /pdf-to-html/ (0.71)
- faq: /pdf-to-epub/ ↔ /pdf-to-html/ (0.74)
- faq: /pdf-to-epub/ ↔ /markdown-to-pdf/ (0.67)
- intro: /pdf-to-epub/ ↔ /pdf-to-markdown/ (0.67)
- faq: /pdf-to-epub/ ↔ /pdf-to-markdown/ (0.68)
- howTo: /pdf-to-epub/ ↔ /svg-to-png/ (0.68)
- faq: /pdf-to-epub/ ↔ /png-to-svg/ (0.66)
- faq: /pdf-to-epub/ ↔ /webp-to-jpg/ (0.71)
- howTo: /pdf-to-epub/ ↔ /png-to-pdf/ (0.68)
- faq: /pdf-to-epub/ ↔ /png-to-pdf/ (0.7)
- intro: /pdf-to-epub/ ↔ /txt-to-pdf/ (0.68)
- faq: /pdf-to-epub/ ↔ /txt-to-pdf/ (0.7)
- howTo: /pdf-to-epub/ ↔ /pdf-to-image/ (0.68)
- faq: /pdf-to-epub/ ↔ /pdf-to-image/ (0.7)
- howTo: /pdf-to-epub/ ↔ /pdf-to-png/ (0.73)
- faq: /pdf-to-epub/ ↔ /pdf-to-png/ (0.7)
- howTo: /pdf-to-epub/ ↔ /pdf-to-excel/ (0.74)
- faq: /pdf-to-epub/ ↔ /pdf-to-excel/ (0.7)
- faq: /pdf-to-epub/ ↔ /pdf-to-ppt/ (0.75)
- howTo: /gif-maker/ ↔ /gif-to-png/ (0.66)
- faq: /excel-to-pdf/ ↔ /webp-to-jpg/ (0.67)
- howTo: /excel-to-pdf/ ↔ /pdf-to-image/ (0.69)
- howTo: /excel-to-pdf/ ↔ /pdf-to-png/ (0.67)
- howTo: /excel-to-pdf/ ↔ /pdf-to-excel/ (0.68)
- faq: /excel-to-pdf/ ↔ /pdf-to-excel/ (0.72)
- faq: /ppt-to-pdf/ ↔ /pdf-to-text/ (0.77)
- faq: /ppt-to-pdf/ ↔ /pdf-to-html/ (0.73)
- faq: /ppt-to-pdf/ ↔ /markdown-to-pdf/ (0.72)
- faq: /ppt-to-pdf/ ↔ /pdf-to-markdown/ (0.67)
- howTo: /ppt-to-pdf/ ↔ /svg-to-png/ (0.65)
- faq: /ppt-to-pdf/ ↔ /svg-to-png/ (0.7)
- faq: /ppt-to-pdf/ ↔ /png-to-svg/ (0.68)
- faq: /ppt-to-pdf/ ↔ /webp-to-jpg/ (0.7)
- faq: /ppt-to-pdf/ ↔ /gif-to-png/ (0.65)
- howTo: /ppt-to-pdf/ ↔ /png-to-pdf/ (0.65)
- faq: /ppt-to-pdf/ ↔ /png-to-pdf/ (0.72)
- faq: /ppt-to-pdf/ ↔ /txt-to-pdf/ (0.73)
- howTo: /ppt-to-pdf/ ↔ /pdf-to-image/ (0.69)
- faq: /ppt-to-pdf/ ↔ /pdf-to-image/ (0.76)
- howTo: /ppt-to-pdf/ ↔ /pdf-to-png/ (0.78)
- faq: /ppt-to-pdf/ ↔ /pdf-to-png/ (0.76)
- howTo: /ppt-to-pdf/ ↔ /pdf-to-excel/ (0.67)
- faq: /ppt-to-pdf/ ↔ /pdf-to-excel/ (0.73)
- intro: /ppt-to-pdf/ ↔ /pdf-to-ppt/ (0.67)
- howTo: /ppt-to-pdf/ ↔ /pdf-to-ppt/ (0.79)
- faq: /ppt-to-pdf/ ↔ /pdf-to-ppt/ (0.77)
- faq: /pdf-to-text/ ↔ /pdf-to-html/ (0.72)
- faq: /pdf-to-text/ ↔ /markdown-to-pdf/ (0.7)
- faq: /pdf-to-text/ ↔ /pdf-to-markdown/ (0.66)
- faq: /pdf-to-text/ ↔ /svg-to-png/ (0.65)
- faq: /pdf-to-text/ ↔ /png-to-svg/ (0.67)
- faq: /pdf-to-text/ ↔ /webp-to-jpg/ (0.65)
- faq: /pdf-to-text/ ↔ /png-to-pdf/ (0.67)
- intro: /pdf-to-text/ ↔ /txt-to-pdf/ (0.71)
- faq: /pdf-to-text/ ↔ /txt-to-pdf/ (0.78)
- faq: /pdf-to-text/ ↔ /pdf-to-image/ (0.75)
- faq: /pdf-to-text/ ↔ /pdf-to-png/ (0.78)
- faq: /pdf-to-text/ ↔ /pdf-to-excel/ (0.71)
- faq: /pdf-to-text/ ↔ /pdf-to-ppt/ (0.69)
- faq: /pdf-to-html/ ↔ /markdown-to-pdf/ (0.7)
- intro: /pdf-to-html/ ↔ /pdf-to-markdown/ (0.72)
- faq: /pdf-to-html/ ↔ /pdf-to-markdown/ (0.66)
- faq: /pdf-to-html/ ↔ /svg-to-png/ (0.66)
- faq: /pdf-to-html/ ↔ /webp-to-jpg/ (0.68)
- faq: /pdf-to-html/ ↔ /png-to-pdf/ (0.67)
- intro: /pdf-to-html/ ↔ /txt-to-pdf/ (0.74)
- faq: /pdf-to-html/ ↔ /txt-to-pdf/ (0.68)
- faq: /pdf-to-html/ ↔ /pdf-to-image/ (0.74)
- faq: /pdf-to-html/ ↔ /pdf-to-png/ (0.67)
- faq: /pdf-to-html/ ↔ /pdf-to-excel/ (0.68)
- faq: /pdf-to-html/ ↔ /pdf-to-ppt/ (0.72)
- intro: /markdown-to-pdf/ ↔ /pdf-to-markdown/ (0.66)
- faq: /markdown-to-pdf/ ↔ /pdf-to-markdown/ (0.65)
- intro: /markdown-to-pdf/ ↔ /txt-to-pdf/ (0.67)
- faq: /markdown-to-pdf/ ↔ /txt-to-pdf/ (0.67)
- faq: /markdown-to-pdf/ ↔ /pdf-to-image/ (0.67)
- faq: /markdown-to-pdf/ ↔ /pdf-to-png/ (0.66)
- faq: /markdown-to-pdf/ ↔ /pdf-to-excel/ (0.7)
- faq: /markdown-to-pdf/ ↔ /pdf-to-ppt/ (0.68)
- faq: /pdf-to-markdown/ ↔ /png-to-pdf/ (0.65)
- faq: /pdf-to-markdown/ ↔ /pdf-to-image/ (0.66)
- faq: /pdf-to-markdown/ ↔ /pdf-to-png/ (0.68)
- faq: /pdf-to-markdown/ ↔ /pdf-to-excel/ (0.68)
- howTo: /svg-to-png/ ↔ /png-to-svg/ (0.67)
- faq: /svg-to-png/ ↔ /png-to-svg/ (0.73)
- faq: /svg-to-png/ ↔ /webp-to-jpg/ (0.66)
- howTo: /svg-to-png/ ↔ /png-to-pdf/ (0.67)
- faq: /svg-to-png/ ↔ /png-to-pdf/ (0.67)
- howTo: /svg-to-png/ ↔ /pdf-to-image/ (0.67)
- faq: /svg-to-png/ ↔ /pdf-to-image/ (0.68)
- howTo: /svg-to-png/ ↔ /pdf-to-png/ (0.76)
- faq: /svg-to-png/ ↔ /pdf-to-png/ (0.67)
- howTo: /svg-to-png/ ↔ /pdf-to-excel/ (0.65)
- faq: /png-to-svg/ ↔ /gif-to-png/ (0.66)
- faq: /png-to-svg/ ↔ /pdf-to-png/ (0.69)
- faq: /png-to-svg/ ↔ /pdf-to-excel/ (0.66)
- faq: /webp-to-jpg/ ↔ /png-to-pdf/ (0.67)
- howTo: /webp-to-jpg/ ↔ /pdf-to-image/ (0.67)
- faq: /webp-to-jpg/ ↔ /pdf-to-image/ (0.68)
- howTo: /webp-to-jpg/ ↔ /pdf-to-png/ (0.65)
- faq: /webp-to-jpg/ ↔ /pdf-to-ppt/ (0.66)
- faq: /gif-to-png/ ↔ /pdf-to-png/ (0.69)
- howTo: /png-to-pdf/ ↔ /pdf-to-image/ (0.74)
- faq: /png-to-pdf/ ↔ /pdf-to-image/ (0.7)
- howTo: /png-to-pdf/ ↔ /pdf-to-png/ (0.72)
- faq: /png-to-pdf/ ↔ /pdf-to-png/ (0.72)
- howTo: /png-to-pdf/ ↔ /pdf-to-excel/ (0.69)
- faq: /png-to-pdf/ ↔ /pdf-to-ppt/ (0.68)
- faq: /txt-to-pdf/ ↔ /pdf-to-image/ (0.74)
- faq: /txt-to-pdf/ ↔ /pdf-to-png/ (0.7)
- faq: /txt-to-pdf/ ↔ /pdf-to-excel/ (0.67)
- faq: /txt-to-pdf/ ↔ /pdf-to-ppt/ (0.68)
- howTo: /pdf-to-image/ ↔ /pdf-to-png/ (0.76)
- faq: /pdf-to-image/ ↔ /pdf-to-png/ (0.73)
- howTo: /pdf-to-image/ ↔ /pdf-to-excel/ (0.65)
- faq: /pdf-to-image/ ↔ /pdf-to-excel/ (0.67)
- faq: /pdf-to-image/ ↔ /pdf-to-ppt/ (0.71)
- howTo: /pdf-to-png/ ↔ /pdf-to-excel/ (0.7)
- faq: /pdf-to-png/ ↔ /pdf-to-excel/ (0.7)
- howTo: /pdf-to-png/ ↔ /pdf-to-ppt/ (0.68)
- faq: /pdf-to-excel/ ↔ /pdf-to-ppt/ (0.66)
- howTo: /percentage-calculator/ ↔ /sip-calculator/ (0.73)
- howTo: /percentage-calculator/ ↔ /discount-calculator/ (0.73)
- howTo: /percentage-calculator/ ↔ /unit-converter/ (0.73)
- howTo: /percentage-calculator/ ↔ /currency-converter/ (0.67)
- howTo: /sip-calculator/ ↔ /discount-calculator/ (0.7)
- howTo: /sip-calculator/ ↔ /unit-converter/ (0.73)
- howTo: /sip-calculator/ ↔ /currency-converter/ (0.67)
- howTo: /discount-calculator/ ↔ /unit-converter/ (0.71)
- howTo: /unit-converter/ ↔ /currency-converter/ (0.74)

## Privacy and shared facts

Most local-tool privacy paragraphs deliberately share the accurate distinction between local file bytes and account-history metadata. Repeated policy is not disguised with synonyms. Specialized map/network disclosures remain separate. Repetition of a shared formula or limitation can be legitimate; repeated generic advice is not treated as an original contribution.

## Human review and release gate

No human editorial approval has occurred in this task. All 123 public pages should receive publisher sign-off in the whole-site review, including 109 indexable pages and the 14 review routes. The 20 new resource/category pages show their actual drafting date and explicitly state that human review is pending. Do not deploy these drafts or describe Phase 4 as fully complete while the remaining sentence-frame work and owner review are outstanding. No AdSense approval is guaranteed.
