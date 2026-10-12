(function (root) {
    'use strict';

    const MAX_BYTES = 25 * 1024 * 1024;
    const FONT_NAMES = { Helvetica: 'Helvetica', HelveticaBold: 'Helvetica-Bold', HelveticaItalic: 'Helvetica-Oblique', HelveticaBoldItalic: 'Helvetica-BoldOblique', TimesRoman: 'Times-Roman', TimesRomanBold: 'Times-Bold', TimesRomanItalic: 'Times-Italic', TimesRomanBoldItalic: 'Times-BoldItalic', Courier: 'Courier', CourierBold: 'Courier-Bold', CourierItalic: 'Courier-Oblique', CourierBoldItalic: 'Courier-BoldOblique' };
    const fontCaches = new WeakMap();
    class EditError extends Error {}
    const fail = message => { throw new EditError(message); };

    function bytesOf(input) {
        let bytes;
        if (input instanceof ArrayBuffer) bytes = new Uint8Array(input);
        else if (ArrayBuffer.isView(input)) bytes = new Uint8Array(input.buffer, input.byteOffset, input.byteLength);
        else fail('Choose a valid PDF file.');
        if (!bytes.byteLength) fail('This PDF is empty. Choose a file containing PDF pages.');
        if (bytes.byteLength > MAX_BYTES) fail('Edit PDF supports PDF files up to 25 MB.');
        if (String.fromCharCode(...bytes.subarray(0, 5)) !== '%PDF-') fail('This file does not have a valid PDF header.');
        return bytes;
    }

    async function load(input, lib) {
        const bytes = bytesOf(input);
        if (!lib || !lib.PDFDocument) fail('The PDF editing engine is unavailable. Reload and try again.');
        let doc;
        try {
            // Read the encryption flag, then reject before inspecting or rewriting encrypted objects.
            doc = await lib.PDFDocument.load(bytes, { ignoreEncryption: true, updateMetadata: false, throwOnInvalidObject: true });
            if (doc.isEncrypted) fail('This PDF is encrypted or password protected. Unlock it with Unlock PDF before editing.');
            // getForm() silently deletes XFA in pdf-lib. Check the original dictionary first.
            const acro = doc.catalog.lookupMaybe(lib.PDFName.of('AcroForm'), lib.PDFDict);
            if (acro && acro.has(lib.PDFName.of('XFA'))) fail('This PDF uses an XFA form, which this browser editor cannot preserve. Use a PDF reader that supports XFA.');
            if (!doc.getPageCount()) fail('This PDF contains no pages.');
        } catch (error) {
            if (error instanceof EditError) throw error;
            if (error && ((lib.EncryptedPDFError && error instanceof lib.EncryptedPDFError) || error.constructor?.name === 'EncryptedPDFError')) fail('This PDF is encrypted or password protected. Unlock it with Unlock PDF before editing.');
            fail('This PDF could not be read. It may be corrupt or use an unsupported PDF structure.');
        }
        return doc;
    }

    function geometry(page) {
        const media = page.getMediaBox();
        const crop = page.getCropBox();
        let x0 = Math.max(media.x, crop.x);
        let y0 = Math.max(media.y, crop.y);
        let x1 = Math.min(media.x + media.width, crop.x + crop.width);
        let y1 = Math.min(media.y + media.height, crop.y + crop.height);
        if (x1 <= x0 || y1 <= y0) {
            x0 = media.x; y0 = media.y; x1 = media.x + media.width; y1 = media.y + media.height;
        }
        const width = x1 - x0;
        const height = y1 - y0;
        const rotation = ((page.getRotation().angle % 360) + 360) % 360;
        if (![0, 90, 180, 270].includes(rotation)) fail('This PDF uses a page rotation that the editor cannot preserve.');
        if (![x0, y0, x1, y1].every(Number.isFinite) || width <= 0 || height <= 0 || width > 14400 || height > 14400) fail('This PDF uses page dimensions outside the supported editing range.');
        const transforms = {
            0: [1, 0, 0, -1, -x0, y1],
            90: [0, 1, 1, 0, -y0, -x0],
            180: [-1, 0, 0, 1, x1, -y0],
            270: [0, -1, -1, 0, y1, x1]
        };
        return { width: page.getWidth(), height: page.getHeight(), rotation, viewBox: [x0, y0, x1, y1], transform: transforms[rotation], visualWidth: rotation % 180 ? height : width, visualHeight: rotation % 180 ? width : height };
    }

    function pdfToVisual(page, x, y) {
        const [a, b, c, d, e, f] = page.transform;
        return [a * x + c * y + e, b * x + d * y + f];
    }

    function visualToPdf(page, x, y) {
        const [a, b, c, d, e, f] = page.transform;
        const determinant = a * d - b * c;
        return [(d * (x - e) - c * (y - f)) / determinant, (-b * (x - e) + a * (y - f)) / determinant];
    }

    function widgetViewport(page, widget) {
        const [x, y, width, height] = widget.rect;
        const rotation = widget.rotation || 0;
        const points = {
            0: [[x, y + height], [x + 1, y + height], [x, y + height - 1]],
            90: [[x, y], [x, y + 1], [x + 1, y]],
            180: [[x + width, y], [x + width - 1, y], [x + width, y + 1]],
            270: [[x + width, y + height], [x + width, y + height - 1], [x + width - 1, y + height]]
        };
        if (!points[rotation]) fail('This form widget uses an unsupported rotation.');
        const [origin, basisX, basisY] = points[rotation].map(point => pdfToVisual(page, ...point));
        return { width: rotation % 180 ? height : width, height: rotation % 180 ? width : height, transform: [basisX[0] - origin[0], basisX[1] - origin[1], basisY[0] - origin[0], basisY[1] - origin[1], ...origin] };
    }

    function fieldType(field, lib) {
        if (field instanceof lib.PDFTextField) return field.isPassword() || field.isFileSelector() || field.isRichFormatted() ? 'unsupported' : 'text';
        if (field instanceof lib.PDFCheckBox) return 'checkbox';
        if (field instanceof lib.PDFRadioGroup) return 'radio';
        if (field instanceof lib.PDFDropdown) return field.isMultiselect() ? 'unsupported' : 'dropdown';
        return 'unsupported';
    }

    function describeFields(doc, lib) {
        const pages = doc.getPages();
        const names = new Set();
        return doc.getForm().getFields().map(field => {
            if (names.has(field.getName())) fail('This PDF contains duplicate field names that cannot be edited safely. Use a standard AcroForm with unique field names.');
            names.add(field.getName());
            let type = fieldType(field, lib);
            const options = ['radio', 'dropdown'].includes(type) ? field.getOptions() : [];
            const choices = type === 'dropdown' ? field.acroField.getOptions() : [];
            const dropdownSelected = type === 'dropdown' ? field.getSelected()[0] || '' : '';
            const selectedChoice = choices.find(choice => choice.value.decodeText() === dropdownSelected);
            const dropdownValue = selectedChoice ? (selectedChoice.display || selectedChoice.value).decodeText() : dropdownSelected;
            if (type === 'dropdown' && (new Set(options).size !== options.length || (dropdownValue && !options.includes(dropdownValue)))) type = 'unsupported';
            const widgets = field.acroField.getWidgets().map((widget, index) => {
                const pageRef = widget.P();
                let pageIndex = pageRef ? pages.findIndex(page => page.ref.toString() === pageRef.toString()) : -1;
                if (pageIndex < 0) pageIndex = pages.findIndex(page => {
                    const annots = page.node.Annots();
                    return annots && annots.asArray().some(ref => doc.context.lookup(ref) === widget.dict);
                });
                const rect = widget.getRectangle();
                const rotation = (((widget.getAppearanceCharacteristics()?.getRotation() || 0) % 360) + 360) % 360;
                const result = { pageIndex, rect: [rect.x, rect.y, rect.width, rect.height], rotation };
                if (type === 'radio') result.option = options[index] || widget.getOnValue()?.decodeText();
                const flags = widget.getFlags();
                result.hidden = Boolean(flags & (1 | 2 | 32));
                return result;
            });
            if (!widgets.length || widgets.some(widget => widget.pageIndex < 0 || ![0, 90, 180, 270].includes(widget.rotation) || widget.rect.some(value => !Number.isFinite(value)) || widget.rect[2] <= 0 || widget.rect[3] <= 0)) type = 'unsupported';
            const value = type === 'text' ? field.getText() || '' : type === 'checkbox' ? field.isChecked() : type === 'radio' ? field.getSelected() || '' : type === 'dropdown' ? dropdownValue : null;
            return { name: field.getName(), type, value, readOnly: field.isReadOnly(), multiline: type === 'text' && field.isMultiline(), maxLength: type === 'text' ? field.getMaxLength() || null : null, options, widgets };
        });
    }

    async function inspect(input, lib) {
        try {
            const doc = await load(input, lib);
            const fields = describeFields(doc, lib);
            const warnings = ['Editing changes the PDF file and can invalidate existing digital signatures.'];
            if (fields.some(field => field.type === 'unsupported')) warnings.push('Unsupported fields are preserved unchanged. They cannot be filled or flattened in this editor.');
            if (fields.some(field => field.readOnly)) warnings.push('Read-only fields remain unchanged. Keep fields editable when this document contains read-only fields.');
            return { pages: doc.getPages().map(geometry), fields, warnings, canFlatten: fields.every(field => field.type !== 'unsupported' && !field.readOnly) };
        } catch (error) {
            if (error instanceof EditError) throw error;
            fail('The form fields in this PDF could not be read safely. Try a standard AcroForm or a flat PDF.');
        }
    }

    async function metricFont(lib, name) {
        if (!Object.hasOwn(FONT_NAMES, name)) fail('Choose one of the supported basic PDF fonts.');
        if (!fontCaches.has(lib)) fontCaches.set(lib, new Map());
        const cache = fontCaches.get(lib);
        if (!cache.has(name)) cache.set(name, lib.PDFDocument.create().then(doc => doc.embedFont(FONT_NAMES[name])));
        return cache.get(name);
    }

    function validText(text, font) {
        if (typeof text !== 'string' || text.length > 5000 || /[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/.test(text)) fail('Text must contain at most 5,000 printable characters.');
        try { font.encodeText(text.replace(/[\r\n\t]/g, ' ')); }
        catch { fail('This text contains characters not supported by the basic PDF fonts. Use Latin-script text or add an image for other scripts.'); }
    }

    function layoutWithFont(text, options, font) {
        validText(text, font);
        const fontSize = Number(options.fontSize ?? 16);
        const width = Number(options.width);
        const height = Number(options.height);
        const align = options.align || 'left';
        if (!Number.isFinite(fontSize) || fontSize < 6 || fontSize > 144 || !Number.isFinite(width) || width <= 0 || !Number.isFinite(height) || height <= 0 || !['left', 'center', 'right'].includes(align)) fail('Choose a text size from 6 to 144 points and a valid text box.');
        const lineSpacing = Number(options.lineSpacing ?? 1.2);
        if (!Number.isFinite(lineSpacing) || lineSpacing < 1 || lineSpacing > 3) fail('Line spacing must be between 1 and 3.');
        const lineHeight = fontSize * lineSpacing;
        const ascent = font.heightAtSize(fontSize, { descender: false });
        const rawLines = [];
        for (const paragraph of text.replace(/\r\n?/g, '\n').replace(/\t/g, '    ').split('\n')) {
            if (!paragraph) { rawLines.push(''); continue; }
            let remaining = paragraph;
            while (remaining) {
                let length = 0;
                while (length < remaining.length && font.widthOfTextAtSize(remaining.slice(0, length + 1), fontSize) <= width) length += 1;
                if (!length) fail('The text box is too narrow for this font size. Enlarge it or reduce the font size.');
                if (length === remaining.length) { rawLines.push(remaining); break; }
                const boundary = remaining.lastIndexOf(' ', length);
                const cut = boundary > 0 ? boundary : length;
                rawLines.push(remaining.slice(0, cut));
                remaining = remaining.slice(cut).replace(/^ +/, '');
            }
        }
        const lines = rawLines.map((line, index) => {
            const lineWidth = font.widthOfTextAtSize(line, fontSize);
            return { text: line, x: align === 'center' ? (width - lineWidth) / 2 : align === 'right' ? width - lineWidth : 0, y: ascent + index * lineHeight, width: lineWidth };
        });
        return { lines, lineHeight, fontSize, ascent, overflow: rawLines.length * lineHeight > height + 0.01 };
    }

    async function layoutText(text, options, lib) {
        const font = await metricFont(lib, options.font || 'Helvetica');
        return layoutWithFont(text, options, font);
    }

    function updateTextAppearances(field, font, lib) {
        const fieldAppearance = field.acroField.getDefaultAppearance() || '';
        const fits = new Map();
        for (const widget of field.acroField.getWidgets()) {
            const appearance = widget.getDefaultAppearance() || fieldAppearance;
            const fontCommands = [...appearance.matchAll(/\/[^\s]+\s+(\d*\.\d+|\d+)\s+Tf/g)];
            const originalSize = Number(fontCommands.at(-1)?.[1]);
            const preferredSize = originalSize >= 6 && originalSize <= 24 ? originalSize : 12;
            const rect = widget.getRectangle();
            const rotation = (((widget.getAppearanceCharacteristics()?.getRotation() || 0) % 360) + 360) % 360;
            const width = rotation % 180 ? rect.height : rect.width;
            const height = rotation % 180 ? rect.width : rect.height;
            const border = widget.getBorderStyle()?.getWidth() || 0;
            const padding = field.isCombed() ? 0 : 1;
            const inset = border + padding;
            const bounds = { x: inset, y: inset, width: width - inset * 2, height: height - inset * 2 };
            if (bounds.width <= 0 || bounds.height <= 0) fail('A form field is too small to display its value safely. Use a larger form field or a PDF reader for this document.');
            let fontSize = preferredSize;
            while (true) {
                const options = { font, fontSize, alignment: field.getAlignment(), bounds };
                const layout = field.isMultiline() ? lib.layoutMultilineText(field.getText() || '', options) : field.isCombed() ? lib.layoutCombedText(field.getText() || '', { ...options, cellCount: field.getMaxLength() }) : lib.layoutSinglelineText(field.getText() || '', options);
                const lines = layout.lines || layout.cells || [layout.line];
                const descent = font.heightAtSize(fontSize) - font.heightAtSize(fontSize, { descender: false });
                const visible = lines.every(line => line.x >= bounds.x - 0.01 && line.y - descent >= bounds.y - 0.01 && line.x + line.width <= bounds.x + bounds.width + 0.01 && line.y + line.height <= bounds.y + bounds.height + 0.01);
                if (visible) { fits.set(widget.dict, { fontSize, appearance }); break; }
                if (fontSize === 6) fail('Some form text cannot fit at a readable size. Shorten the value before exporting.');
                fontSize = Math.max(6, fontSize - 0.25);
            }
        }
        // A blank form can carry an enormous auto-generated /DA font. Fit actual changed
        // values in every original widget, preserving a sensible original size when it fits.
        const minimumSize = Math.min(...[...fits.values()].map(value => value.fontSize));
        field.acroField.setDefaultAppearance(`${fieldAppearance}\n/${font.name} ${minimumSize} Tf`);
        field.updateAppearances(font, (textField, widget, appearanceFont) => {
            const fitted = fits.get(widget.dict);
            widget.setDefaultAppearance(`${fitted.appearance}\n/${appearanceFont.name} ${fitted.fontSize} Tf`);
            return lib.defaultTextFieldAppearanceProvider(textField, widget, appearanceFont);
        });
    }

    function flattenForm(doc, form, lib) {
        for (const field of form.getFields()) {
            const widgets = field.acroField.getWidgets();
            for (const widget of widgets) {
                const page = form.findWidgetPage(widget);
                const widgetRef = doc.context.getObjectRef(widget.dict);
                // Match the PDF viewer's appearance transform: Matrix(BBox) fitted to Rect.
                if (!(widget.getFlags() & (1 | 2 | 32))) {
                    const appearanceRef = form.findWidgetAppearanceRef(field, widget);
                    const appearance = doc.context.lookup(appearanceRef);
                    const box = appearance.dict.lookup(lib.PDFName.of('BBox'), lib.PDFArray).asArray().map(number => number.asNumber());
                    const rawMatrix = appearance.dict.lookupMaybe(lib.PDFName.of('Matrix'), lib.PDFArray);
                    const matrix = rawMatrix ? rawMatrix.asArray().map(number => number.asNumber()) : [1, 0, 0, 1, 0, 0];
                    const [a, b, c, d, e, f] = matrix;
                    const corners = [[box[0], box[1]], [box[0], box[3]], [box[2], box[1]], [box[2], box[3]]].map(([x, y]) => [a * x + c * y + e, b * x + d * y + f]);
                    const left = Math.min(...corners.map(point => point[0]));
                    const bottom = Math.min(...corners.map(point => point[1]));
                    const width = Math.max(...corners.map(point => point[0])) - left;
                    const height = Math.max(...corners.map(point => point[1])) - bottom;
                    if (![width, height].every(value => Number.isFinite(value) && value > 0)) fail('A form appearance cannot be flattened safely. Keep fields editable for this PDF.');
                    const rect = widget.getRectangle();
                    const scaleX = rect.width / width;
                    const scaleY = rect.height / height;
                    const key = page.node.newXObject('FlatWidget', appearanceRef);
                    page.pushOperators(lib.pushGraphicsState(), lib.concatTransformationMatrix(scaleX, 0, 0, scaleY, rect.x - left * scaleX, rect.y - bottom * scaleY), lib.drawObject(key), lib.popGraphicsState());
                }
                // pdf-lib removeField removes appearances, not every widget annotation reference.
                // Preserve the page reference for fields whose original widget omitted /P.
                widget.setP(page.ref);
                if (widgetRef) page.node.removeAnnot(widgetRef);
            }
            form.removeField(field);
        }
    }

    async function fillFields(doc, values, flatten, lib) {
        const form = doc.getForm();
        const descriptions = describeFields(doc, lib);
        const byName = new Map(descriptions.map(field => [field.name, field]));
        if (!values || typeof values !== 'object' || Array.isArray(values)) fail('The form edit state is invalid. Reload the document and try again.');
        if (flatten && descriptions.some(field => field.type === 'unsupported' || field.readOnly)) fail('This PDF has unsupported or read-only fields. Keep fields editable to preserve them.');
        const font = await doc.embedFont(lib.StandardFonts.Helvetica);
        for (const [name, value] of Object.entries(values)) {
            const description = byName.get(name);
            if (!description) fail('A form field no longer matches the original document. Reload the PDF before exporting.');
            if (value === description.value) continue;
            if (description.type === 'unsupported' || description.readOnly) fail('Unsupported or read-only form fields cannot be changed.');
            const field = form.getField(name);
            let dropdownExportValue;
            if (description.type === 'text') {
                validText(value, font);
                if (!description.multiline && /[\r\n]/.test(value)) fail('A single-line form field cannot contain line breaks.');
                if (description.maxLength && value.length > description.maxLength) fail('A form value exceeds the original field length limit. Shorten it before exporting.');
                field.setText(value);
            } else if (description.type === 'checkbox') {
                if (typeof value !== 'boolean') fail('A checkbox value must be checked or unchecked.');
                if (value) field.check(); else field.uncheck();
            } else {
                if (typeof value !== 'string' || (value && !description.options.includes(value))) fail('Choose an existing option from the form field.');
                if (value) { validText(value, font); field.select(value); } else field.clear();
                if (description.type === 'dropdown' && value) dropdownExportValue = field.acroField.getOptions().find(choice => (choice.display || choice.value).decodeText() === value)?.value;
            }
            if (typeof field.updateAppearances === 'function') {
                if (description.type === 'checkbox' || description.type === 'radio') field.updateAppearances();
                else if (description.type === 'text') updateTextAppearances(field, font, lib);
                else field.updateAppearances(font);
            }
            // pdf-lib select() writes display labels to /V. Keep the form's real export code,
            // after generating the appearance from its visible label.
            if (dropdownExportValue) field.acroField.dict.set(lib.PDFName.of('V'), dropdownExportValue);
        }
        if (flatten) {
            // Only build missing appearances, leaving existing supported appearances intact.
            for (const field of form.getFields()) if (field.needsAppearancesUpdate()) field.defaultUpdateAppearances(font);
            flattenForm(doc, form, lib);
        }
    }

    function overlayBox(overlay, pages) {
        const page = pages[overlay.pageIndex];
        if (!Number.isInteger(overlay.pageIndex) || !page) fail('An edit refers to a page that does not exist.');
        const { x, y, width, height } = overlay;
        if (![x, y, width, height].every(Number.isFinite) || x < -0.01 || y < -0.01 || width < 1 || height < 1 || x + width > page.visualWidth + 0.1 || y + height > page.visualHeight + 0.1) fail('An edit is outside the page. Move or resize it inside the visible page before exporting.');
        return page;
    }

    function imageEditGeometry(sourceWidth, sourceHeight, settings = {}) {
        if (![sourceWidth, sourceHeight].every(value => Number.isInteger(value) && value > 0) || sourceWidth * sourceHeight > 16_000_000) fail('Use an image below 16 megapixels.');
        const { left = 0, top = 0, width = 100, height = 100, rotation = 0 } = settings;
        if (![left, top, width, height].every(Number.isFinite) || left < 0 || top < 0 || width <= 0 || height <= 0 || left + width > 100 || top + height > 100) fail('Crop percentages must select a non-empty area inside the original image.');
        if (![0, 90, 180, 270].includes(rotation)) fail('Image rotation must be 0, 90, 180 or 270 degrees clockwise.');
        const x = Math.round(sourceWidth * left / 100), y = Math.round(sourceHeight * top / 100);
        const cropWidth = Math.round(sourceWidth * (left + width) / 100) - x;
        const cropHeight = Math.round(sourceHeight * (top + height) / 100) - y;
        if (cropWidth < 1 || cropHeight < 1) fail('The crop must contain at least one image pixel in each direction.');
        return { x, y, cropWidth, cropHeight, rotation, outputWidth: rotation % 180 ? cropHeight : cropWidth, outputHeight: rotation % 180 ? cropWidth : cropHeight };
    }

    async function drawOverlay(doc, overlay, pages, fonts, lib) {
        if (!['text', 'check', 'cross', 'rectangle', 'ellipse', 'line', 'arrow', 'highlight', 'underline', 'strike', 'image'].includes(overlay.type)) fail('This edit type is not supported.');
        const view = overlayBox(overlay, pages);
        const page = doc.getPage(overlay.pageIndex);
        const { width, height } = overlay;
        const color = overlay.color || '#111827';
        if (!/^#[0-9a-f]{6}$/i.test(color)) fail('Choose a valid text or shape color.');
        const rgb = lib.rgb(...[1, 3, 5].map(offset => parseInt(color.slice(offset, offset + 2), 16) / 255));
        const opacity = Number(overlay.opacity ?? 1);
        const strokeWidth = Number(overlay.strokeWidth ?? 1.5);
        if (!Number.isFinite(opacity) || opacity < 0 || opacity > 1) fail('Opacity must be between 0 and 1.');
        if (!Number.isFinite(strokeWidth) || strokeWidth < .25 || strokeWidth > 20) fail('Stroke width must be between 0.25 and 20 points.');
        if (!['text', 'image', 'highlight'].includes(overlay.type) && strokeWidth >= Math.min(width, height)) fail('Reduce the stroke width or enlarge the shape so the outline stays inside its box.');
        if (overlay.fill && !/^#[0-9a-f]{6}$/i.test(overlay.fill)) fail('Choose a valid fill color.');
        const fill = overlay.fill ? lib.rgb(...[1, 3, 5].map(offset => parseInt(overlay.fill.slice(offset, offset + 2), 16) / 255)) : undefined;
        const origin = visualToPdf(view, overlay.x, overlay.y + height);
        const basisX = visualToPdf(view, overlay.x + 1, overlay.y + height);
        const basisY = visualToPdf(view, overlay.x, overlay.y + height - 1);
        page.pushOperators(lib.pushGraphicsState(), lib.concatTransformationMatrix(basisX[0] - origin[0], basisX[1] - origin[1], basisY[0] - origin[0], basisY[1] - origin[1], origin[0], origin[1]));
        if (overlay.type === 'text') {
            const name = overlay.font || 'Helvetica';
            if (!Object.hasOwn(FONT_NAMES, name)) fail('Choose one of the supported basic PDF fonts.');
            if (!fonts.has(name)) fonts.set(name, await doc.embedFont(FONT_NAMES[name]));
            const font = fonts.get(name);
            const layout = layoutWithFont(overlay.text || '', overlay, font);
            if (layout.overflow) fail('Some added text does not fit its box. Enlarge the box or reduce the font size before exporting.');
            for (const line of layout.lines) if (line.text) {
                page.drawText(line.text, { x: line.x, y: height - line.y, size: layout.fontSize, font, color: rgb, opacity });
                if (overlay.underline) page.drawLine({ start: { x: line.x, y: height - line.y - 1 }, end: { x: line.x + line.width, y: height - line.y - 1 }, thickness: Math.max(.5, layout.fontSize / 18), color: rgb, opacity });
            }
        } else if (overlay.type === 'image') {
            const bytes = overlay.imageBytes;
            if (!bytes || !ArrayBuffer.isView(bytes) || !bytes.byteLength || bytes.byteLength > 5 * 1024 * 1024) fail('Choose a PNG or JPEG image smaller than 5 MB.');
            let image;
            try {
                if (overlay.imageType === 'image/png') image = await doc.embedPng(bytes);
                else if (overlay.imageType === 'image/jpeg') image = await doc.embedJpg(bytes);
                else fail('Only PNG and JPEG images can be added to the PDF.');
            } catch { fail('This image could not be read. Choose a valid PNG or JPEG image.'); }
            page.drawImage(image, { x: 0, y: 0, width, height, opacity });
        } else if (overlay.type === 'rectangle') {
            page.drawRectangle({ x: strokeWidth / 2, y: strokeWidth / 2, width: Math.max(0, width - strokeWidth), height: Math.max(0, height - strokeWidth), borderColor: rgb, borderWidth: strokeWidth, color: fill, opacity, borderOpacity: opacity });
        } else if (overlay.type === 'ellipse') {
            page.drawEllipse({ x: width / 2, y: height / 2, xScale: Math.max(.1, (width - strokeWidth) / 2), yScale: Math.max(.1, (height - strokeWidth) / 2), color: fill, borderColor: rgb, borderWidth: strokeWidth, opacity, borderOpacity: opacity });
        } else if (overlay.type === 'highlight') {
            page.drawRectangle({ x: 0, y: 0, width, height, color: rgb, opacity });
        } else if (['line', 'arrow', 'underline', 'strike'].includes(overlay.type)) {
            const y = overlay.type === 'underline' ? strokeWidth / 2 : height / 2;
            const start = { x: strokeWidth / 2, y }, end = { x: Math.max(strokeWidth / 2, width - strokeWidth / 2), y };
            page.drawLine({ start, end, color: rgb, thickness: strokeWidth, opacity });
            if (overlay.type === 'arrow') {
                const head = Math.min(12, (width - strokeWidth) / 3, (height - strokeWidth) / 2);
                for (const direction of [-1, 1]) page.drawLine({ start: end, end: { x: end.x - head, y: y + direction * head }, color: rgb, thickness: strokeWidth, opacity });
            }
        } else {
            const points = overlay.type === 'check' ? [[0.12, 0.48], [0.39, 0.18], [0.9, 0.87]] : [[0.15, 0.15], [0.85, 0.85], null, [0.15, 0.85], [0.85, 0.15]];
            const at = point => ({ x: strokeWidth / 2 + (width - strokeWidth) * point[0], y: strokeWidth / 2 + (height - strokeWidth) * point[1] });
            for (let index = 1; index < points.length; index += 1) if (points[index] && points[index - 1]) page.drawLine({ start: at(points[index - 1]), end: at(points[index]), thickness: strokeWidth, color: rgb, opacity });
        }
        page.pushOperators(lib.popGraphicsState());
    }

    async function applyPagePlan(doc, plan, lib) {
        if (plan === undefined) return;
        if (!Array.isArray(plan) || !plan.length || plan.length > 500) fail('Keep between 1 and 500 pages in the edited PDF.');
        const originals = doc.getPages();
        const uses = new Map();
        for (const item of plan) {
            if (!item || ![0, 90, 180, 270].includes(item.rotation ?? 0)) fail('Page rotations must be quarter turns.');
            if (item.sourceIndex === null) {
                if (![item.width, item.height].every(value => Number.isFinite(value) && value >= 36 && value <= 14400)) fail('Blank page dimensions must be between 36 and 14,400 points.');
            } else {
                if (!Number.isInteger(item.sourceIndex) || !originals[item.sourceIndex]) fail('The page plan refers to a missing source page.');
                uses.set(item.sourceIndex, (uses.get(item.sourceIndex) || 0) + 1);
            }
        }
        // Retain live field trees and annotation destinations rather than silently orphaning them.
        for (let index = 0; index < originals.length; index++) {
            if ((uses.get(index) || 0) !== 1 && originals[index].node.Annots()?.size()) fail('Pages containing form fields or annotations cannot be duplicated or deleted here. Export a flattened copy first for supported forms.');
        }
        const used = new Set(), arranged = [];
        for (const item of plan) {
            if (item.sourceIndex === null) { arranged.push(null); continue; }
            const original = originals[item.sourceIndex];
            const page = used.has(item.sourceIndex) ? (await doc.copyPages(doc, [item.sourceIndex]))[0] : original;
            used.add(item.sourceIndex);
            arranged.push(page);
        }
        // Copy before removal and before changing rotations so duplicates are independent.
        for (let index = doc.getPageCount() - 1; index >= 0; index--) doc.removePage(index);
        plan.forEach((item, index) => {
            const page = arranged[index] ? doc.addPage(arranged[index]) : doc.addPage([item.width, item.height]);
            page.setRotation(lib.degrees((item.baseRotation + (item.rotation || 0) + 360) % 360));
        });
    }

    async function exportPdf(input, edits, lib) {
        try {
            const doc = await load(input, lib);
            if (!edits || !Array.isArray(edits.overlays || [])) fail('The PDF edit state is invalid.');
            const overlays = edits.overlays || [];
            if (overlays.length > 300) fail('This document has too many edits. Use up to 300 overlay elements.');
            // Flattening adds transformed appearance streams. Rewrite original
            // text before those new streams, rather than weakening native guards.
            const flattenAfterText = Boolean(edits.flatten && edits.nativeEdits?.length);
            await fillFields(doc, edits.fieldValues || {}, Boolean(edits.flatten) && !flattenAfterText, lib);
            const originalRotations = doc.getPages().map(page => page.getRotation().angle);
            const plan = edits.pagePlan?.map(item => ({ ...item, baseRotation: item.sourceIndex === null ? 0 : originalRotations[item.sourceIndex] }));
            await applyPagePlan(doc, plan, lib);
            if (edits.nativeEdits?.length) {
                if (!root.GxaPdfTextCore) fail('The text editing engine is unavailable. Reload the editor.');
                await root.GxaPdfTextCore.apply(doc, edits.nativeEdits, lib);
            }
            if (flattenAfterText) await fillFields(doc, {}, true, lib);
            const pages = doc.getPages().map(geometry);
            const fonts = new Map();
            for (const overlay of overlays) {
                if (overlay.mask) await drawOverlay(doc, { ...overlay.mask, pageIndex: overlay.pageIndex, type: 'rectangle', color: overlay.mask.color || '#ffffff', fill: overlay.mask.color || '#ffffff', strokeWidth: .25, opacity: 1 }, pages, fonts, lib);
                await drawOverlay(doc, overlay, pages, fonts, lib);
            }
            // Prevent save() from rebuilding untouched form appearances or metadata.
            const output = await doc.save({ useObjectStreams: true, updateFieldAppearances: false });
            const reopened = await load(output, lib);
            if (reopened.getPageCount() !== pages.length) fail('The exported page count could not be verified.');
            return output;
        } catch (error) {
            if (error instanceof EditError) throw error;
            fail('The PDF could not be exported safely. Check the field values and edits, or try a standard PDF.');
        }
    }

    root.GxaPdfEditCore = Object.freeze({ inspect, exportPdf, pdfToVisual, visualToPdf, widgetViewport, layoutText, imageEditGeometry, MAX_BYTES });
})(typeof window !== 'undefined' ? window : globalThis);
