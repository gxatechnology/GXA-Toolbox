/* ==========================================================================
   GXA TOOLBOX APP ENGINE - PURE CLIENT-SIDE OPERATIONS
   ========================================================================== */
window.__GXA_TOOLBOX_APP_LOADED__ = true;

// --- Storage Keys (legacy keys are read only to preserve existing user preferences) ---
const STORAGE_KEYS = {
  history: 'gxa-toolbox_history',
  theme: 'gxa-toolbox_theme',
  favorites: 'gxa-toolbox_favorites',
  recentTools: 'gxa-toolbox_recent-tools',
  recentSearches: 'gxa-toolbox_recent-searches',
  rememberedEmail: 'gxa-toolbox_auth-email'
};
const LEGACY_STORAGE_KEYS = {
  history: 'gxa-technologies_history',
  theme: 'gxa-technologies_theme'
};

// --- Global Application State ---
const appState = {
  currentPage: 'home', // 'home', 'dashboard', or 'tool-[id]'
  theme: 'light',      // 'light' or 'dark'
  lang: 'en',          // 'en', 'de', 'es', 'fr', 'ar'
  user: null,          // Will be initialized dynamically via PHP session
  activeFiles: [],     // Holds currently uploaded files in queue
  activeToolOptions: {}, // Config options for active tool
  favorites: [],
  recentTools: [],
  recentSearches: []
};

// Crop Image owns a dedicated, route-scoped editor. Cropper.js is loaded only
// after this route is opened so the rest of GXA Toolbox keeps its current payload.
const CROP_IMAGE_LIBRARY_VERSION = '1.6.2';
let cropperAssetsPromise = null;
const cropEditorState = {
  cropper: null,
  file: null,
  sourceUrl: '',
  resultUrl: '',
  resultBlob: null,
  originalWidth: 0,
  originalHeight: 0,
  scaleX: 1,
  scaleY: 1,
  rotation: 0,
  lastCropData: null,
  history: [],
  redoHistory: [],
  keydownHandler: null,
  keyupHandler: null
};

const premiumEditorState = {
  toolId: '',
  needsFiles: false,
  undoStack: [],
  redoStack: [],
  suppressHistory: false,
  historyTimer: null,
  keydownHandler: null,
  inputHandler: null,
  clickHandler: null,
  previewObserver: null,
  previewUpdateFrame: 0,
  resultUrl: '',
  resultBlob: null,
  resultFilename: '',
  auxiliaryUrls: [],
  backgroundAutoTimer: null,
  backgroundPreviewUrl: '',
  resultSeries: [],
  batchCancelled: false,
  startedAt: 0
};
let navigationCloseTimer = 0;
let navigationDocumentEventsBound = false;
const watermarkEditorState = {
  imageFile: null,
  imageUrl: '',
  imageAspectRatio: 1,
  imageBaseWidth: 160,
  previewObserver: null,
  previewPageHandler: null,
  previewFrame: 0
};
const premiumToolSessions = [];
let pdfSignatureDrawingDataUrl = '';

function readStoredList(key) {
  try {
    const value = JSON.parse(localStorage.getItem(key) || '[]');
    return Array.isArray(value) ? value : [];
  } catch (error) {
    return [];
  }
}

function escapeHTML(value) {
  return String(value).replace(/[&<>'"]/g, character => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;'
  })[character]);
}

function hydrateLocalPreferences() {
  appState.favorites = readStoredList(STORAGE_KEYS.favorites).filter(id => toolsList.some(tool => tool.id === id));
  appState.recentTools = readStoredList(STORAGE_KEYS.recentTools).filter(id => toolsList.some(tool => tool.id === id)).slice(0, 8);
  appState.recentSearches = readStoredList(STORAGE_KEYS.recentSearches).filter(Boolean).slice(0, 5);
}

// --- Session Bootstrap and History Fetching ---
function setAuthenticatedUser(user) {
  if (!user) {
    appState.user = null;
    return;
  }
  appState.user = {
    id: user.id,
    name: user.name,
    email: user.email,
    role: user.role,
    is_premium: parseInt(user.is_premium) || 0,
    tier: parseInt(user.is_premium) ? 'Premium' : 'Free',
    processedCount: 0,
    history: []
  };
}

async function initUserSession() {
  if (window.PHP_SESSION && window.PHP_SESSION.loggedIn) {
    setAuthenticatedUser(window.PHP_SESSION.user);
    fetchHistoryFromDB();
    return;
  }

  try {
    const response = await fetch('/api/session.php', {
      method: 'GET',
      credentials: 'same-origin',
      headers: { Accept: 'application/json' }
    });
    const data = await readApiJson(response);
    if (!data.authenticated || !data.user) return;
    setAuthenticatedUser(data.user);
    window.PHP_SESSION = {
      loggedIn: true,
      user: data.user,
      premium_tools: window.PHP_SESSION?.premium_tools || []
    };
    fetchHistoryFromDB();
  } catch (error) {
    // Public tools stay available if optional account/session infrastructure is offline.
    appState.user = null;
  }
}

function fetchHistoryFromDB() {
  if (!appState.user) return;
  fetch('/api/get-history.php', { credentials: 'same-origin', headers: { Accept: 'application/json' } })
    .then(r => r.json())
    .then(data => {
      if (data.success) {
        appState.user.processedCount = data.processedCount;
        appState.user.history = data.history;
        renderNavbar();
      }
    })
    .catch(err => console.error("Error fetching user session history:", err));
}

// --- Language Translation Directory ---
const translations = {
  en: {
    tagline: "Your Complete Digital Toolbox",
    description: "Access powerful browser-based tools for PDFs, images, file conversions, QR codes, ZIP files, developer utilities, and everyday calculations — all in one place.",
    heroTitle: "Your Complete Digital Toolbox",
    explore: "Explore Tools",
    signup: "Sign up for free",
    trustNote: "No credit card required &nbsp; • &nbsp; Clear processing disclosures on every file tool",
    whyChoose: "Get started with GXA Toolbox",
    toolsHeaderDesc: "Choose from file, developer, archive, and calculation tools. Each file tool states where processing occurs.",
    all: "All Tools",
    pdf: "PDF Tools",
    image: "Image Tools",
    convert: "Converters",
    zip: "ZIP Tools",
    utility: "Utilities",
    uploadTitle: "Drop your files here",
    uploadSubtitle: "or click to browse from device",
    maxSize: "Maximum file size: 100MB per file",
    processing: "Processing files...",
    complete: "Processing complete!",
    download: "Download Result",
    original: "Original",
    compressed: "Compressed",
    historyTitle: "Recent Activity Log",
    statsProcessed: "Files Processed",
    statsSaved: "Storage Saved",
    statsSavingsRate: "Avg Compression",
    watermarkText: "Watermark Text",
    password: "Password",
    generate: "Generate",
    copy: "Copy to Clipboard",
    colorPalette: "Extracted Color Palette",
    home: "Home",
    dashboard: "Dashboard"
  },
  de: {
    tagline: "Your Complete Digital Toolbox",
    description: "Erledigen Sie mehr mit GXA Toolbox. Maximieren Sie die Produktivität mit Komprimieren, Konvertieren, Bearbeiten und mehr – alles an einem Ort.",
    heroTitle: "Your Complete Digital Toolbox",
    explore: "Werkzeuge erkunden",
    signup: "Kostenlos anmelden",
    trustNote: "Keine Kreditkarte erforderlich &nbsp; • &nbsp; Klare Verarbeitungshinweise für jedes Datei-Tool",
    whyChoose: "Erste Schritte mit GXA Toolbox",
    toolsHeaderDesc: "Jedes Datei-Tool zeigt transparent an, wo die Verarbeitung stattfindet.",
    all: "Alle Tools",
    pdf: "PDF-Tools",
    image: "Bild-Tools",
    convert: "Konverter",
    zip: "ZIP-Tools",
    utility: "Dienstprogramme",
    uploadTitle: "Dateien hier ablegen",
    uploadSubtitle: "oder klicken, um vom Gerät auszuwählen",
    maxSize: "Maximale Dateigröße: 100MB pro Datei",
    processing: "Dateien werden verarbeitet...",
    complete: "Verarbeitung abgeschlossen!",
    download: "Ergebnis herunterladen",
    original: "Original",
    compressed: "Komprimiert",
    historyTitle: "Verlauf der letzten Aktivitäten",
    statsProcessed: "Verarbeitete Dateien",
    statsSaved: "Gespeicherter Speicherplatz",
    statsSavingsRate: "Durchschn. Komprimierung",
    watermarkText: "Wasserzeichen-Text",
    password: "Passwort",
    generate: "Generieren",
    copy: "In Zwischenablage kopieren",
    colorPalette: "Extrahierte Farbpalette",
    home: "Startseite",
    dashboard: "Dashboard"
  },
  es: {
    tagline: "Your Complete Digital Toolbox",
    description: "Haga más cosas con GXA Toolbox. Maximice la productividad con compresión, conversión, edición y más, todo en un solo lugar.",
    heroTitle: "Your Complete Digital Toolbox",
    explore: "Explorar Herramientas",
    signup: "Regístrate gratis",
    trustNote: "No se requiere tarjeta de crédito &nbsp; • &nbsp; Información clara de procesamiento en cada herramienta",
    whyChoose: "Comienza con GXA Toolbox",
    toolsHeaderDesc: "Cada herramienta de archivos indica claramente dónde se realiza el procesamiento.",
    all: "Todas las herramientas",
    pdf: "Herramientas PDF",
    image: "Herramientas de Imagen",
    convert: "Convertidores",
    zip: "Herramientas ZIP",
    utility: "Utilidades",
    uploadTitle: "Arrastra tus archivos aquí",
    uploadSubtitle: "o haz clic para explorar tu dispositivo",
    maxSize: "Tamaño máximo de archivo: 100 MB por archivo",
    processing: "Procesando archivos...",
    complete: "¡Procesamiento completo!",
    download: "Descargar Resultado",
    original: "Original",
    compressed: "Comprimido",
    historyTitle: "Registro de Actividad Reciente",
    statsProcessed: "Archivos Procesados",
    statsSaved: "Almacenamiento Guardado",
    statsSavingsRate: "Compresión Promedio",
    watermarkText: "Texto de la marca de agua",
    password: "Contraseña",
    generate: "Generar",
    copy: "Copiar al portapapeles",
    colorPalette: "Paleta de colores extraída",
    home: "Inicio",
    dashboard: "Tablero"
  },
  fr: {
    tagline: "Your Complete Digital Toolbox",
    description: "Faites-en plus avec GXA Toolbox. Maximisez la productivité avec la compression, la conversion, l'édition et plus encore, le tout au même endroit.",
    heroTitle: "Your Complete Digital Toolbox",
    explore: "Explorer les outils",
    signup: "S'inscrire gratuitement",
    trustNote: "Aucune carte bancaire requise &nbsp; • &nbsp; Traitement clairement indiqué pour chaque outil",
    whyChoose: "Commencer avec GXA Toolbox",
    toolsHeaderDesc: "Chaque outil de fichier indique clairement où le traitement est effectué.",
    all: "Tous les outils",
    pdf: "Outils PDF",
    image: "Outils Image",
    convert: "Convertisseurs",
    zip: "Outils ZIP",
    utility: "Utilitaires",
    uploadTitle: "Déposez vos fichiers ici",
    uploadSubtitle: "ou cliquez pour parcourir votre appareil",
    maxSize: "Taille maximale : 100 Mo par fichier",
    processing: "Traitement en cours...",
    complete: "Traitement terminé !",
    download: "Télécharger le résultat",
    original: "Original",
    compressed: "Compressé",
    historyTitle: "Journal d'activité récent",
    statsProcessed: "Fichiers traités",
    statsSaved: "Espace disque économisé",
    statsSavingsRate: "Taux de compression moyen",
    watermarkText: "Texte du filigrane",
    password: "Mot de passe",
    generate: "Générer",
    copy: "Copier le texte",
    colorPalette: "Palette de couleurs extraite",
    home: "Accueil",
    dashboard: "Tableau de bord"
  },
  ar: {
    tagline: "Your Complete Digital Toolbox",
    description: "أنجز المزيد مع GXA Toolbox. ضاعف الإنتاجية من خلال ضغط الملفات، تحويلها، تعديلها، والمزيد - كل ذلك في مكان آمن واحد.",
    heroTitle: "Your Complete Digital Toolbox",
    explore: "استكشاف الأدوات",
    signup: "سجل مجاناً الآن",
    trustNote: "لا حاجة لبطاقة ائتمان &nbsp; • &nbsp; توضيح مكان المعالجة لكل أداة ملفات",
    whyChoose: "ابدأ العمل مع GXA Toolbox",
    toolsHeaderDesc: "توضح كل أداة ملفات مكان إجراء المعالجة بوضوح.",
    all: "جميع الأدوات",
    pdf: "أدوات PDF",
    image: "أدوات الصور",
    convert: "المحولات",
    zip: "أدوات ZIP",
    utility: "أدوات مساعدة",
    uploadTitle: "اسحب وأفلت ملفاتك هنا",
    uploadSubtitle: "أو انقر لتصفح ملفات جهازك",
    maxSize: "الحد الأقصى لحجم الملف: 100 ميجابايت للملف الواحد",
    processing: "جاري معالجة الملفات...",
    complete: "اكتملت المعالجة بنجاح!",
    download: "تحميل النتيجة",
    original: "الأصلي",
    compressed: "المضغوط",
    historyTitle: "سجل النشاطات الأخيرة",
    statsProcessed: "الملفات المعالجة",
    statsSaved: "المساحة الموفرة",
    statsSavingsRate: "معدل الضغط",
    watermarkText: "نص العلامة المائية",
    password: "كلمة المرور",
    generate: "إنشاء",
    copy: "نسخ إلى الحافظة",
    colorPalette: "لوحة الألوان المستخرجة",
    home: "الرئيسية",
    dashboard: "لوحة التحكم"
  }
};

// --- Translation Helper ---
function t(key) {
  const lang = appState.lang;
  return (translations[lang] && translations[lang][key]) || (translations['en'] && translations['en'][key]) || key;
}

const toolsList = [
  { id: 'merge-pdf', name: 'Merge PDF', category: 'pdf', desc: 'Combine multiple PDFs into a single, organized document.', icon: 'files' },
  { id: 'organize-pdf', name: 'Organize PDF', category: 'pdf', desc: 'Reorder, rotate, select, remove, watermark, or insert blank pages in a PDF.', icon: 'grid' },
  { id: 'compress-image', name: 'Compress Image', category: 'image', desc: 'Compress browser-decodable JPG, PNG, and WEBP images with adjustable quality.', icon: 'minimize-2' },
  { id: 'resize-image', name: 'Resize Image', category: 'image', desc: 'Specify exact dimensions, aspect locking, and percentage scales.', icon: 'maximize-2' },
  { id: 'crop-image', name: 'Crop Image', category: 'image', desc: 'Manually select, position, transform, and export an exact image crop.', icon: 'crop' },
  { id: 'background-remover', name: 'Background Remover', category: 'image', desc: 'Remove image backgrounds with a browser-local foreground segmentation model and refine the alpha mask in Advanced Cutout Studio.', icon: 'sparkles' },
  { id: 'password-generator', name: 'Password Generator', category: 'utility', desc: 'Produce strong, random keys with safety metrics.', icon: 'key' },
  { id: 'barcode-generator', name: 'QR & Barcode', category: 'utility', desc: 'Create code graphics for texts or links in vectors.', icon: 'qr-code' },
  { id: 'color-extractor', name: 'Color Extractor', category: 'utility', desc: 'Extract harmonious palette swatches from any image.', icon: 'palette' },
  { id: 'zip-manager', name: 'ZIP Manager', category: 'zip', desc: 'Compress files into folders or extract packages client-side.', icon: 'folder-archive' },
  // Additional functional tools
  { id: 'split-pdf', name: 'Split PDF', category: 'pdf', desc: 'Split a PDF into multiple ranges or individual page sheets.', icon: 'scissors' },
  { id: 'protect-pdf', name: 'Protect PDF', category: 'pdf', desc: 'Secure documents with password encryption locks.', icon: 'lock' },
  { id: 'unlock-pdf', name: 'Unlock PDF', category: 'pdf', desc: 'Remove password protection settings from your PDF.', icon: 'unlock' },
  { id: 'pdf-to-jpg', name: 'PDF to JPG', category: 'pdf', desc: 'Convert PDF document pages to JPG/PNG images.', icon: 'image' },
  { id: 'jpg-to-pdf', name: 'JPG to PDF', category: 'pdf', desc: 'Convert and merge JPG/PNG/WEBP images into a PDF.', icon: 'file-text' },
  { id: 'word-to-pdf', name: 'Word to PDF', category: 'pdf', desc: 'Convert DOCX documents or plain text into a readable, reflowed PDF.', icon: 'file-text' },
  { id: 'pdf-to-word', name: 'PDF to Text/RTF', category: 'pdf', desc: 'Extract selectable PDF text to TXT or RTF without claiming native Word layout preservation.', icon: 'file-type' },
  { id: 'epub-to-pdf', name: 'EPUB to PDF', category: 'convert', desc: 'Convert ebook EPUB scripts to document sheets.', icon: 'book-open' },
  { id: 'pdf-to-epub', name: 'PDF to EPUB', category: 'convert', desc: 'Compile PDF layout pages into standard ebook packages.', icon: 'book' },
  { id: 'gif-maker', name: 'GIF Maker', category: 'convert', desc: 'Compile sequence image arrays into animations.', icon: 'film' },
  { id: 'zip-extractor', name: 'ZIP Extractor', category: 'zip', desc: 'Extract archives and inspect internal packages in-browser.', icon: 'folder-open' }
];

// Append additional concrete tools to toolsList (total 75 tools)
const extraTools = [
  { id: 'compress-pdf', name: 'Optimize PDF', category: 'pdf', desc: 'Losslessly reserialize PDF structure and report the actual size change; images are not downsampled.', icon: 'file-archive' },
  { id: 'rotate-pdf', name: 'Rotate PDF', category: 'pdf', desc: 'Rotate individual or all pages inside your PDF document.', icon: 'rotate-cw' },
  { id: 'watermark-pdf', name: 'Add Watermark', category: 'pdf', desc: 'Add text, logos, images, icons, symbols, or custom watermarks to selected PDF pages.', icon: 'stamp' },
  { id: 'pagenumber-pdf', name: 'Add Page Numbers', category: 'pdf', desc: 'Insert dynamic page numbering headers or footers.', icon: 'binary' },
  { id: 'pdf-metadata', name: 'PDF Metadata Editor', category: 'pdf', desc: 'Modify PDF details: Title, Author, Subject, Keywords.', icon: 'tags' },
  { id: 'excel-to-pdf', name: 'Excel to PDF', category: 'convert', desc: 'Convert spreadsheets and CSV data into tables in PDF.', icon: 'file-spreadsheet' },
  { id: 'ppt-to-pdf', name: 'PPT to PDF', category: 'convert', desc: 'Create a faithful PDF only when a full PPT/PPTX presentation renderer is available.', icon: 'presentation' },
  { id: 'pdf-to-text', name: 'PDF to Text', category: 'convert', desc: 'Extract and download all plain text characters from PDF.', icon: 'file-text' },
  { id: 'html-to-pdf', name: 'HTML to PDF', category: 'convert', desc: 'Render HTML structures directly to a PDF template.', icon: 'code' },
  { id: 'pdf-to-html', name: 'PDF to HTML', category: 'convert', desc: 'Convert document structure and text content to HTML.', icon: 'globe' },
  { id: 'markdown-to-pdf', name: 'Markdown to PDF', category: 'convert', desc: 'Render Markdown text files to formatted PDF pages.', icon: 'file-edit' },
  { id: 'pdf-to-markdown', name: 'PDF to Markdown', category: 'convert', desc: 'Parse PDF structure to clean, readable Markdown layout.', icon: 'text' },
  { id: 'svg-to-png', name: 'SVG to PNG', category: 'convert', desc: 'Render vector SVG graphics to high-resolution PNG format.', icon: 'image' },
  { id: 'png-to-svg', name: 'PNG to SVG', category: 'convert', desc: 'Wrap raster images into scalable vector SVG markup.', icon: 'type' },
  { id: 'webp-to-jpg', name: 'WEBP to JPG', category: 'convert', desc: 'Convert WEBP files to universal JPG format in browser.', icon: 'image' },
  { id: 'gif-to-png', name: 'GIF Frame Extractor', category: 'convert', desc: 'Extract individual sequence frames from animated GIFs.', icon: 'film' },
  { id: 'text-to-speech', name: 'Text-to-Speech Reader', category: 'utility', desc: 'Read text or documents aloud using native audio speech synthesis.', icon: 'volume-2' },
  { id: 'qr-reader', name: 'QR Code Reader', category: 'utility', desc: 'Scan QR images and extract text payloads instantly.', icon: 'scan' },
  { id: 'barcode-reader', name: 'Barcode Scanner', category: 'utility', desc: 'Extract numerical barcodes from images.', icon: 'barcode' },
  { id: 'base64-tool', name: 'Base64 Tool', category: 'utility', desc: 'Encode text/files to Base64 or decode Base64 strings.', icon: 'binary' },
  { id: 'url-tool', name: 'URL Encoder/Decoder', category: 'utility', desc: 'Percent-encode URL paths or decode encoded parameters.', icon: 'link' },
  { id: 'json-tool', name: 'JSON Formatter', category: 'utility', desc: 'Format, prettify, or minify JSON data strings.', icon: 'braces' },
  { id: 'hash-tool', name: 'Hash Generator', category: 'utility', desc: 'Compute SHA-1, SHA-256, SHA-384, or SHA-512 cryptographic hashes.', icon: 'fingerprint' },
  { id: 'case-converter', name: 'Text Case Converter', category: 'utility', desc: 'Convert text cases: Upper, Lower, Title, Camel, Kebab.', icon: 'case-sensitive' },
  { id: 'word-counter', name: 'Word Counter', category: 'utility', desc: 'Detailed counts of characters, words, lines, reading time.', icon: 'hash' },
  { id: 'lorem-ipsum', name: 'Lorem Ipsum Generator', category: 'utility', desc: 'Generate classic dummy Latin texts for mockups.', icon: 'languages' },
  { id: 'diff-checker', name: 'Diff Checker', category: 'utility', desc: 'Compare two text blocks and highlight differences.', icon: 'columns-2' },
  { id: 'sql-formatter', name: 'SQL Formatter', category: 'utility', desc: 'Format SQL queries for standard databases.', icon: 'database' },
  { id: 'xml-to-json', name: 'XML to JSON Converter', category: 'utility', desc: 'Translate XML trees into readable JSON structures.', icon: 'arrow-left-right' },
  { id: 'uuid-generator', name: 'UUID Generator', category: 'utility', desc: 'Generate multiple random v4 UUID strings.', icon: 'cpu' },
  { id: 'user-agent', name: 'User Agent Parser', category: 'utility', desc: 'Detect and display details of your active browser details.', icon: 'monitor' },
  { id: 'regex-tester', name: 'Regex Tester', category: 'utility', desc: 'Test and debug regular expressions interactively.', icon: 'search' },
  { id: 'markdown-editor', name: 'Markdown Editor', category: 'utility', desc: 'Live Markdown writer with comparative layout screen.', icon: 'pen-tool' },
  { id: 'css-beautifier', name: 'CSS Formatter', category: 'utility', desc: 'Prettify stylesheet scripts or minify files.', icon: 'palette' },
  { id: 'js-beautifier', name: 'JS Formatter', category: 'utility', desc: 'Beautify or minify JS scripts client-side.', icon: 'curly-braces' },
  { id: 'html-beautifier', name: 'HTML Formatter', category: 'utility', desc: 'Prettify HTML tags layout structures.', icon: 'code-2' },
  { id: 'cron-generator', name: 'Cron Expression Helper', category: 'utility', desc: 'Build or parse cron schedules with human copy.', icon: 'clock' },
  { id: 'color-converter', name: 'Color Converter', category: 'utility', desc: 'Translate HEX, RGB, HSL, and CMYK structures.', icon: 'paint-bucket' },
  { id: 'exif-viewer', name: 'EXIF Metadata Viewer', category: 'utility', desc: 'Extract hidden camera and GPS EXIF info from images.', icon: 'camera' },
  { id: 'timestamp-converter', name: 'Epoch Converter', category: 'utility', desc: 'Convert Epoch timestamps to human dates and back.', icon: 'calendar' },
  { id: 'remove-pdf-pages', name: 'Remove PDF Pages', category: 'pdf', desc: 'Remove unwanted pages from your PDF document.', icon: 'trash' },
  { id: 'extract-pdf-pages', name: 'Extract PDF Pages', category: 'pdf', desc: 'Extract specific pages from your PDF file.', icon: 'copy' },
  { id: 'extract-images-pdf', name: 'Extract Images', category: 'pdf', desc: 'Extract embedded images inside your PDF document.', icon: 'image' },
  { id: 'crop-pdf', name: 'Crop PDF', category: 'pdf', desc: 'Trim outer margins or crop selected areas of your PDF pages.', icon: 'crop' },
  { id: 'header-footer-pdf', name: 'Add Header & Footer', category: 'pdf', desc: 'Insert dynamic text/page numbering headers and footers.', icon: 'layout' },
  { id: 'sign-pdf', name: 'Sign PDF', category: 'pdf', desc: 'Add a visible handwritten signature appearance to a PDF; this is not cryptographic signing.', icon: 'pen-tool' },
  { id: 'repair-pdf', name: 'Repair PDF', category: 'pdf', desc: 'Normalize a readable PDF by loading and reserializing its object structure.', icon: 'wrench' },
  { id: 'ocr-pdf', name: 'OCR PDF', category: 'pdf', desc: 'Extract text from scanned PDF documents via Optical Character Recognition.', icon: 'search' },
  { id: 'image-to-pdf', name: 'Image to PDF', category: 'convert', desc: 'Convert and merge image files (JPG, PNG, WEBP) into a single PDF.', icon: 'file-text' },
  { id: 'png-to-pdf', name: 'PNG to PDF', category: 'convert', desc: 'Convert PNG images into highly-optimized PDF files.', icon: 'image' },
  { id: 'txt-to-pdf', name: 'TXT to PDF', category: 'convert', desc: 'Convert plaintext TXT files into clean PDF documents.', icon: 'file-text' },
  { id: 'pdf-to-image', name: 'PDF to Image', category: 'convert', desc: 'Convert PDF document pages into separate PNG/JPG images.', icon: 'images' },
  { id: 'pdf-to-png', name: 'PDF to PNG', category: 'convert', desc: 'Convert PDF pages to lossless high-resolution PNG images.', icon: 'image' },
  { id: 'pdf-to-excel', name: 'PDF to Excel', category: 'convert', desc: 'Convert PDF tables and layouts to Excel sheets.', icon: 'file-spreadsheet' },
  { id: 'pdf-to-ppt', name: 'PDF to PPT', category: 'convert', desc: 'Convert PDF slides to Microsoft PowerPoint presentations.', icon: 'presentation' },
  // Calculators
  { id: 'calculator', name: 'Simple Calculator', category: 'calculator', desc: 'Perform basic math operations like addition, subtraction, multiplication, and division.', icon: 'calculator' },
  { id: 'scientific-calculator', name: 'Scientific Calculator', category: 'calculator', desc: 'Advanced math calculator supporting trigonometric functions, logarithms, powers, and constants.', icon: 'cpu' },
  { id: 'percentage-calculator', name: 'Percentage Calculator', category: 'calculator', desc: 'Calculate percentage increases, decreases, difference, and basic fractional splits.', icon: 'percent' },
  { id: 'age-calculator', name: 'Age Calculator', category: 'calculator', desc: 'Calculate your exact age in years, months, weeks, days, and hours.', icon: 'calendar' },
  { id: 'date-calculator', name: 'Date Calculator', category: 'calculator', desc: 'Add or subtract days from a given date, or calculate duration between two dates.', icon: 'calendar-days' },
  { id: 'emi-calculator', name: 'EMI Calculator', category: 'calculator', desc: 'Calculate monthly loan EMI repayments with total interest and graphical breakdowns.', icon: 'indian-rupee' },
  { id: 'loan-calculator', name: 'Loan Calculator', category: 'calculator', desc: 'Complete loan payment analysis with amortization schedules and simple interest details.', icon: 'coins' },
  { id: 'interest-calculator', name: 'Interest Calculator', category: 'calculator', desc: 'Compute simple or compound interest with monthly/quarterly compounding options.', icon: 'trending-up' },
  { id: 'gst-calculator', name: 'GST Calculator', category: 'calculator', desc: 'Calculate Net Price, Gross Price, and Tax amount (CGST/SGST) instantly.', icon: 'percent' },
  { id: 'sip-calculator', name: 'SIP Calculator', category: 'calculator', desc: 'Estimate future returns of your monthly Systematic Investment Plans (SIP) investments.', icon: 'line-chart' },
  { id: 'bmi-calculator', name: 'BMI Calculator', category: 'calculator', desc: 'Calculate your Body Mass Index (BMI) and determine your health/weight range.', icon: 'activity' },
  { id: 'discount-calculator', name: 'Discount Calculator', category: 'calculator', desc: 'Find net sale price, cash savings, and final costs after custom discount rates.', icon: 'tag' },
  { id: 'unit-converter', name: 'Unit Converter', category: 'calculator', desc: 'Convert measurements between length, weight, area, volume, and temperature metric systems.', icon: 'scale' },
  { id: 'currency-converter', name: 'Currency Converter', category: 'calculator', desc: 'Convert currencies using an exchange rate that you provide.', icon: 'globe' },
  { id: 'time-calculator', name: 'Time Calculator', category: 'calculator', desc: 'Add or subtract hours, minutes, and seconds, or convert time metrics.', icon: 'clock' }
];
extraTools.forEach(t => toolsList.push(t));

// --- Main Application Controller ---
document.addEventListener('DOMContentLoaded', () => {
  initApp();
});

async function initApp() {
  hydrateLocalPreferences();
  await initUserSession();
  renderNavbar();
  renderFooter();
  
  // Detect deep links to clean calculator and background remover paths
  const path = window.location.pathname.replace(/^\/|\/$/g, '');
  const validDeepLinkPaths = [
    'background-remover', 'calculator', 'scientific-calculator', 'percentage-calculator', 'age-calculator',
    'date-calculator', 'emi-calculator', 'loan-calculator', 'interest-calculator',
    'gst-calculator', 'sip-calculator', 'bmi-calculator', 'discount-calculator',
    'unit-converter', 'currency-converter', 'time-calculator'
  ];
  if (validDeepLinkPaths.includes(path)) {
    appState.currentPage = 'tool-' + path;
  }
  const hashToolId = window.location.hash.match(/^#tool-([a-z0-9-]+)$/)?.[1];
  if (hashToolId && toolsList.some(tool => tool.id === hashToolId)) {
    appState.currentPage = 'tool-' + hashToolId;
  }
  
  setupTheme();
  renderPage();
  setTheme(appState.theme);
  setupGlobalExperience();
  
  // Set window resize listener to verify layout
  window.addEventListener('resize', () => {
    // Force redraw layout properties if required
  });
}

// --- Theme Switcher ---
function setupTheme() {
  const savedTheme = localStorage.getItem(STORAGE_KEYS.theme) ?? localStorage.getItem(LEGACY_STORAGE_KEYS.theme) ?? 'light';
  setTheme(savedTheme);
}

function setTheme(theme) {
  appState.theme = theme;
  localStorage.setItem(STORAGE_KEYS.theme, theme);
  const body = document.body;
  
  if (theme === 'dark') {
    body.classList.add('dark-mode');
    body.classList.remove('light-mode');
  } else {
    body.classList.add('light-mode');
    body.classList.remove('dark-mode');
  }
  
  // Update icons if mounted
  const themeBtn = document.getElementById('theme-toggle-btn');
  if (themeBtn) {
    themeBtn.innerHTML = theme === 'dark' ? '<i data-lucide="sun"></i>' : '<i data-lucide="moon"></i>';
    lucide.createIcons();
  }
}

// --- Toggle Language & RTL Settings ---
function setLanguage(lang) {
  appState.lang = lang;
  document.documentElement.lang = lang;
  
  // Apply RTL setting
  if (lang === 'ar') {
    document.documentElement.dir = 'rtl';
  } else {
    document.documentElement.dir = 'ltr';
  }
  
  // Re-render components to apply translation dictionaries
  renderNavbar();
  renderFooter();
  renderPage();
  
  showToast(`Language set to ${lang.toUpperCase()}`, 'info');
}

// --- Global Toast Dispatcher ---
function showToast(message, type = 'info') {
  const container = document.getElementById('toast-container');
  if (!container) return;
  
  const toast = document.createElement('div');
  toast.className = `toast toast-${type}`;
  
  let iconName = 'info';
  if (type === 'success') iconName = 'check-circle';
  if (type === 'error') iconName = 'alert-triangle';
  if (type === 'warning') iconName = 'alert-circle';
  
  toast.innerHTML = `
    <div class="toast-content">
      <i data-lucide="${iconName}"></i>
      <span class="toast-message">${message}</span>
    </div>
    <button class="toast-close" onclick="this.parentElement.remove()"><i data-lucide="x"></i></button>
  `;
  
  container.appendChild(toast);
  lucide.createIcons();
  
  // Auto-dismiss after 5s
  setTimeout(() => {
    if (toast && toast.parentElement) {
      toast.classList.add('fade-out');
      setTimeout(() => toast.remove(), 300);
    }
  }, 5000);
}

// --- Database History Logger ---
function logHistory(filename, toolName, sizeStr, status = 'done') {
  const sizeVal = parseFloat(sizeStr) || 0.00;
  const browserLocalHistoryOnlyTools = new Set(['Background Remover', 'Advanced Cutout Studio']);
  
  const payload = {
    tool_name: toolName,
    original_file: filename,
    output_file: filename.replace(/(\.[\w\d]+)$/i, '_processed$1'),
    status: status,
    size: sizeVal
  };
  
  if (appState.user) {
    const newLog = {
      id: 'h_' + Date.now(),
      name: filename,
      tool: toolName,
      date: new Date().toISOString().split('T')[0],
      size: sizeStr,
      status: status
    };
    if (!appState.user.history) appState.user.history = [];
    appState.user.history.unshift(newLog);
    appState.user.processedCount += 1;
  }

  if (!window.PHP_SESSION) return;
  if (!appState.user && browserLocalHistoryOnlyTools.has(toolName)) return;
  
  fetch('/api/save-job.php', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload)
  })
  .then(r => r.json())
  .then(data => {
    if (data.success) {
      console.log('Job registered in DB:', data.job_id);
    }
  })
  .catch(err => console.error('Error logging job in DB:', err));
}

// --- Premium global navigation, favorites, recent tools, and command palette ---
let commandActiveIndex = 0;

function setupGlobalExperience() {
  if (!document.getElementById('command-palette')) {
    const palette = document.createElement('div');
    palette.id = 'command-palette';
    palette.className = 'command-palette-overlay hidden';
    palette.setAttribute('aria-hidden', 'true');
    palette.innerHTML = `
      <div class="command-palette-panel" role="dialog" aria-modal="true" aria-labelledby="command-palette-title">
        <div class="command-search-row">
          <i data-lucide="search" aria-hidden="true"></i>
          <label id="command-palette-title" class="sr-only" for="command-search-input">Search all GXA Toolbox tools</label>
          <input id="command-search-input" type="search" autocomplete="off" placeholder="Search ${toolsList.length} tools…" aria-controls="command-results">
          <kbd>Esc</kbd>
        </div>
        <div class="command-hint-row"><span>Jump to any tool</span><span><kbd>↑</kbd><kbd>↓</kbd> navigate <kbd>Enter</kbd> open</span></div>
        <div id="command-results" class="command-results" role="listbox"></div>
      </div>`;
    palette.addEventListener('mousedown', event => {
      if (event.target === palette) closeCommandPalette();
    });
    document.body.appendChild(palette);

    const feedback = document.createElement('button');
    feedback.className = 'feedback-fab';
    feedback.type = 'button';
    feedback.setAttribute('aria-label', 'Send feedback');
    feedback.title = 'Send feedback';
    feedback.innerHTML = '<i data-lucide="message-circle"></i><span>Feedback</span>';
    feedback.addEventListener('click', showContactModal);
    document.body.appendChild(feedback);
  }

  const modal = document.getElementById('modal-container');
  if (modal && !modal.dataset.interactionsBound) {
    modal.dataset.interactionsBound = 'true';
    modal.addEventListener('mousedown', event => {
      if (event.target === modal) closeModal();
    });
  }

  const commandInput = document.getElementById('command-search-input');
  commandInput.addEventListener('input', () => renderCommandResults(commandInput.value));
  commandInput.addEventListener('keydown', handleCommandKeyboard);
  document.addEventListener('keydown', event => {
    if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'k') {
      event.preventDefault();
      openCommandPalette();
    } else if (event.key === 'Escape') {
      closeCommandPalette();
      closeMobileNavigation();
      closeModal();
    }
  });
  window.addEventListener('resize', syncMobileNavigationState, { passive: true });
  lucide.createIcons();
}

function openCommandPalette(initialQuery = '') {
  const palette = document.getElementById('command-palette');
  const input = document.getElementById('command-search-input');
  if (!palette || !input) return;
  palette.classList.remove('hidden');
  palette.setAttribute('aria-hidden', 'false');
  document.body.classList.add('command-open');
  input.value = initialQuery;
  commandActiveIndex = 0;
  renderCommandResults(initialQuery);
  requestAnimationFrame(() => input.focus());
}

function closeCommandPalette() {
  const palette = document.getElementById('command-palette');
  if (!palette || palette.classList.contains('hidden')) return;
  palette.classList.add('hidden');
  palette.setAttribute('aria-hidden', 'true');
  document.body.classList.remove('command-open');
}

function renderCommandResults(query = '') {
  const results = document.getElementById('command-results');
  if (!results) return;
  const normalized = query.trim().toLowerCase();
  const source = normalized
    ? toolsList.filter(tool => `${tool.name} ${tool.desc} ${tool.category}`.toLowerCase().includes(normalized))
    : [...appState.recentTools.map(id => toolsList.find(tool => tool.id === id)).filter(Boolean), ...toolsList]
        .filter((tool, index, list) => list.findIndex(item => item.id === tool.id) === index);
  const visible = source.slice(0, 12);
  commandActiveIndex = Math.min(commandActiveIndex, Math.max(visible.length - 1, 0));
  results.innerHTML = visible.length ? visible.map((tool, index) => {
    const profile = window.GxaWorkspace.getProcessingProfile(tool.id);
    return `<button type="button" class="command-result ${index === commandActiveIndex ? 'active' : ''}" role="option" aria-selected="${index === commandActiveIndex}" data-tool-id="${tool.id}" onclick="openToolFromCommand('${tool.id}')">
      <span class="command-result-icon cat-${tool.category}"><i data-lucide="${tool.icon}"></i></span>
      <span class="command-result-copy"><strong>${tool.name}</strong><small>${tool.category} · ${profile.label}</small></span>
      <i data-lucide="arrow-up-right" class="command-result-arrow"></i>
    </button>`;
  }).join('') : `<div class="command-empty"><i data-lucide="search-x"></i><strong>No matching tools</strong><span>Try a format, task, or category.</span></div>`;
  lucide.createIcons();
}

function handleCommandKeyboard(event) {
  const items = Array.from(document.querySelectorAll('.command-result'));
  if (!items.length) return;
  if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
    event.preventDefault();
    commandActiveIndex = (commandActiveIndex + (event.key === 'ArrowDown' ? 1 : -1) + items.length) % items.length;
    items.forEach((item, index) => {
      item.classList.toggle('active', index === commandActiveIndex);
      item.setAttribute('aria-selected', String(index === commandActiveIndex));
    });
    items[commandActiveIndex].scrollIntoView({ block: 'nearest' });
  } else if (event.key === 'Enter') {
    event.preventDefault();
    items[commandActiveIndex].click();
  }
}

function openToolFromCommand(toolId) {
  const query = document.getElementById('command-search-input')?.value.trim();
  if (query) recordRecentSearch(query);
  closeCommandPalette();
  navigate(`tool-${toolId}`);
}

function recordRecentSearch(query) {
  const clean = String(query || '').trim();
  if (!clean) return;
  appState.recentSearches = [clean, ...appState.recentSearches.filter(item => item.toLowerCase() !== clean.toLowerCase())].slice(0, 5);
  localStorage.setItem(STORAGE_KEYS.recentSearches, JSON.stringify(appState.recentSearches));
}

function runPopularSearch(query) {
  const input = document.getElementById('tool-search');
  if (!input) return openCommandPalette(query);
  input.value = query;
  recordRecentSearch(query);
  searchTools(query);
  document.getElementById('tools-grid-anchor')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
}

function runRecentSearch(button) {
  runPopularSearch(button?.dataset.query || '');
}

function toggleFavorite(toolId) {
  const isFavorite = appState.favorites.includes(toolId);
  appState.favorites = isFavorite ? appState.favorites.filter(id => id !== toolId) : [toolId, ...appState.favorites];
  localStorage.setItem(STORAGE_KEYS.favorites, JSON.stringify(appState.favorites));
  const activeTab = document.querySelector('.filter-tab.active');
  const category = activeTab?.dataset.category || 'all';
  renderToolsGrid(category, document.getElementById('tool-search')?.value || '');
  showToast(isFavorite ? 'Removed from favorites.' : 'Added to favorites.', 'info');
}

function toggleMobileNavigation() {
  const open = document.body.classList.toggle('mobile-menu-open');
  const button = document.getElementById('mobile-nav-toggle');
  const menu = document.querySelector('.header-nav .nav-menu');
  button?.setAttribute('aria-expanded', String(open));
  button?.setAttribute('aria-label', open ? 'Close navigation menu' : 'Open navigation menu');
  if (button) button.innerHTML = `<i data-lucide="${open ? 'x' : 'menu'}"></i>`;
  menu?.setAttribute('aria-hidden', String(!open));
  if (menu) menu.inert = !open;
  lucide.createIcons();
  if (open) requestAnimationFrame(() => document.querySelector('.mobile-drawer-search')?.focus());
}

function closeMobileNavigation() {
  document.body.classList.remove('mobile-menu-open');
  document.querySelectorAll('.nav-item.menu-expanded').forEach(item => {
    item.classList.remove('menu-expanded');
    delete item.dataset.navigationPinned;
  });
  document.querySelectorAll('.nav-item > button[aria-haspopup="true"]').forEach(button => button.setAttribute('aria-expanded', 'false'));
  const menu = document.querySelector('.header-nav .nav-menu');
  if (window.matchMedia('(max-width: 1100px)').matches && menu) {
    menu.setAttribute('aria-hidden', 'true');
    menu.inert = true;
  }
  const button = document.getElementById('mobile-nav-toggle');
  button?.setAttribute('aria-expanded', 'false');
  button?.setAttribute('aria-label', 'Open navigation menu');
  if (button) button.innerHTML = '<i data-lucide="menu"></i>';
  lucide.createIcons();
}

function syncMobileNavigationState() {
  const mobile = window.matchMedia('(max-width: 1100px)').matches;
  const menu = document.querySelector('.header-nav .nav-menu');
  if (!menu) return;
  if (!mobile) {
    document.body.classList.remove('mobile-menu-open');
    menu.removeAttribute('aria-hidden');
    menu.inert = false;
    return;
  }
  const open = document.body.classList.contains('mobile-menu-open');
  menu.setAttribute('aria-hidden', String(!open));
  menu.inert = !open;
}

function navigateToToolCategory(category = 'all') {
  closeMobileNavigation();
  navigate('home');
  requestAnimationFrame(() => {
    const tab = document.querySelector(`.filter-tab[data-category="${category}"]`);
    if (tab) filterTools(category, tab);
    document.getElementById('tools-grid-anchor')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  });
}

function renderHeaderToolMenu(category) {
  const categoryTools = toolsList.filter(tool => tool.category === category);
  const titles = {
    pdf: ['Edit & organize', 'Convert & export', 'More PDF tools'],
    image: ['Optimize', 'Edit', 'Inspect & enhance'],
    calculator: ['Everyday', 'Finance', 'More calculators']
  }[category] || ['Tools', 'More tools', 'Utilities'];
  const columnSize = Math.ceil(categoryTools.length / 3);
  const columns = Array.from({ length: 3 }, (_, index) => categoryTools.slice(index * columnSize, (index + 1) * columnSize));
  const toolButton = tool => `<button type="button" class="mega-list-link" data-tool-id="${tool.id}" onclick="navigate('tool-${tool.id}')">${escapeHTML(tool.name)}</button>`;

  return columns.map((column, index) => `
    <div>
      <div class="mega-col-title">${titles[index]}</div>
      <div class="mega-list">${column.map(toolButton).join('')}</div>
    </div>
  `).join('') + `
    <div class="mega-popular">
      <div class="mega-popular-title">Popular ${category === 'calculator' ? 'calculators' : `${category.toUpperCase()} tools`}</div>
      ${categoryTools.slice(0, 2).map(toolButton).join('')}
    </div>
  `;
}

function closeCategoryNavigation({ restoreFocus = false } = {}) {
  window.clearTimeout(navigationCloseTimer);
  navigationCloseTimer = 0;
  document.querySelectorAll('.header-nav .nav-item.menu-expanded').forEach(item => {
    item.classList.remove('menu-expanded');
    delete item.dataset.navigationPinned;
    const trigger = item.querySelector(':scope > button[aria-haspopup="true"]');
    trigger?.setAttribute('aria-expanded', 'false');
    if (restoreFocus) trigger?.focus();
  });
}

function setCategoryNavigationOpen(item, open, { pinned = false } = {}) {
  window.clearTimeout(navigationCloseTimer);
  navigationCloseTimer = 0;
  document.querySelectorAll('.header-nav .nav-item.menu-expanded').forEach(openItem => {
    if (openItem === item) return;
    openItem.classList.remove('menu-expanded');
    delete openItem.dataset.navigationPinned;
    openItem.querySelector(':scope > button[aria-haspopup="true"]')?.setAttribute('aria-expanded', 'false');
  });
  item.classList.toggle('menu-expanded', open);
  if (!open) delete item.dataset.navigationPinned;
  else if (pinned) item.dataset.navigationPinned = 'true';
  item.querySelector(':scope > button[aria-haspopup="true"]')?.setAttribute('aria-expanded', String(open));
}

function isDesktopHoverNavigation() {
  return window.matchMedia('(min-width: 1101px) and (hover: hover) and (pointer: fine)').matches;
}

function scheduleCategoryNavigationClose(item, { force = false } = {}) {
  if (!force && item.dataset.navigationPinned === 'true') return;
  window.clearTimeout(navigationCloseTimer);
  navigationCloseTimer = window.setTimeout(() => {
    if (!item.matches(':hover') && !item.contains(document.activeElement)) setCategoryNavigationOpen(item, false);
  }, 200);
}

function initializeCategoryNavigation(nav) {
  nav.querySelectorAll('.nav-item[data-nav-category]').forEach(item => {
    const trigger = item.querySelector(':scope > button[aria-haspopup="true"]');
    const menu = item.querySelector(':scope > .mega-menu');
    if (!trigger || !menu) return;
    trigger.setAttribute('aria-expanded', 'false');
    const togglePinnedMenu = () => {
      const shouldOpen = item.dataset.navigationPinned !== 'true';
      setCategoryNavigationOpen(item, shouldOpen, { pinned: shouldOpen });
    };
    trigger.addEventListener('click', togglePinnedMenu);
    trigger.addEventListener('keydown', event => {
      if (event.key !== 'Enter' && event.key !== ' ') return;
      event.preventDefault();
      togglePinnedMenu();
    });
    item.addEventListener('pointerenter', () => {
      if (isDesktopHoverNavigation()) setCategoryNavigationOpen(item, true);
    });
    item.addEventListener('pointerleave', () => {
      if (isDesktopHoverNavigation()) scheduleCategoryNavigationClose(item);
    });
    item.addEventListener('focusout', event => {
      if (!item.contains(event.relatedTarget)) scheduleCategoryNavigationClose(item, { force: true });
    });
  });

  if (!navigationDocumentEventsBound) {
    document.addEventListener('pointerdown', event => {
      if (!event.target.closest('.header-nav .nav-item[data-nav-category]')) closeCategoryNavigation();
    });
    document.addEventListener('keydown', event => {
      if (event.key === 'Escape' && document.querySelector('.header-nav .nav-item.menu-expanded')) {
        event.preventDefault();
        closeCategoryNavigation({ restoreFocus: true });
      }
    });
    navigationDocumentEventsBound = true;
  }
}

// --- Navigation Renderers ---
function renderNavbar() {
  const nav = document.getElementById('navbar');
  if (!nav) return;

  const activeToolId = appState.currentPage.startsWith('tool-') ? appState.currentPage.replace('tool-', '') : '';
  const activeTool = toolsList.find(tool => tool.id === activeToolId);
  const imageAdjacentTools = new Set(['color-extractor', 'exif-viewer', 'svg-to-png', 'png-to-svg', 'webp-to-jpg', 'gif-maker', 'gif-to-png']);
  const activeNavSection = appState.currentPage === 'home'
    ? 'home'
    : appState.currentPage === 'dashboard'
      ? 'dashboard'
      : activeTool?.category === 'calculator'
        ? 'calculator'
        : activeTool?.category === 'image' || imageAdjacentTools.has(activeToolId)
          ? 'image'
          : activeTool?.category === 'pdf' || activeToolId.includes('pdf')
            ? 'pdf'
            : '';
  const navState = section => activeNavSection === section ? ' is-active' : '';
  const currentPageAttribute = section => activeNavSection === section ? ' aria-current="page"' : '';
  
  let authActionsHTML = '';
  if (appState.user) {
    authActionsHTML = `
      <a href="/dashboard/index.php" class="btn btn-ghost btn-sm" style="display:inline-flex; align-items:center; gap:4px; font-weight:600;">
        <i data-lucide="user" style="width:14px; height:14px;"></i>
        <span>${escapeHTML(appState.user.name)}</span>
      </a>
      ${appState.user.role === 'developer' ? `<a href="/developer/index.php" class="btn btn-secondary btn-sm" style="display:inline-flex; align-items:center;">Developer</a>` : ''}
      ${appState.user.role === 'admin' ? `<a href="/admin/index.php" class="btn btn-secondary btn-sm" style="display:inline-flex; align-items:center;">Admin</a>` : ''}
      <button class="btn btn-primary btn-sm" onclick="handleLogout()">Sign Out</button>
    `;
  } else {
    authActionsHTML = `
      <button class="btn btn-ghost btn-sm" onclick="showAuthModal('login')">Sign In</button>
      <button class="btn btn-primary btn-sm" onclick="showAuthModal('signup')">${t('signup')}</button>
    `;
  }
  
  nav.innerHTML = `
    <div class="container nav-container">
      <a class="logo" onclick="navigate('home')" aria-label="GXA Toolbox home" title="GXA Toolbox home">
        <div class="logo-icon" aria-hidden="true"><img src="/gxa-logo.png" alt=""></div>
        <div class="logo-text">GXA <span class="brand-suffix">Toolbox</span></div>
      </a>
      
      <ul class="nav-menu" aria-label="Primary navigation">
        <li class="mobile-drawer-heading" aria-hidden="true">
          <span>GXA Toolbox</span>
          <small>Your Complete Digital Toolbox</small>
        </li>
        <li class="mobile-drawer-search-row">
          <button type="button" class="mobile-drawer-search" onclick="closeMobileNavigation(); openCommandPalette()"><i data-lucide="search"></i><span>Search tools</span></button>
        </li>
        <li class="nav-item">
          <a class="nav-link${navState('home')}" onclick="navigate('home')"${currentPageAttribute('home')}><i data-lucide="house"></i><span>${t('home')}</span></a>
        </li>
        <li class="mobile-all-tools-link">
          <button type="button" class="nav-link" onclick="navigateToToolCategory('all')"><i data-lucide="grid-2x2"></i><span>All Tools</span></button>
        </li>
        <li class="nav-item has-mega-menu" data-nav-category="pdf">
          <button id="nav-pdf-trigger" type="button" class="nav-link${navState('pdf')}" aria-haspopup="true" aria-controls="nav-pdf-menu" aria-expanded="false"${currentPageAttribute('pdf')}><i data-lucide="file-text"></i><span>${t('pdf')}</span><i class="nav-chevron" data-lucide="chevron-down"></i></button>
          <div id="nav-pdf-menu" class="mega-menu" aria-labelledby="nav-pdf-trigger">${renderHeaderToolMenu('pdf')}</div>
        </li>
        <li class="nav-item has-mega-menu" data-nav-category="image">
          <button id="nav-image-trigger" type="button" class="nav-link${navState('image')}" aria-haspopup="true" aria-controls="nav-image-menu" aria-expanded="false"${currentPageAttribute('image')}><i data-lucide="image"></i><span>${t('image')}</span><i class="nav-chevron" data-lucide="chevron-down"></i></button>
          <div id="nav-image-menu" class="mega-menu" aria-labelledby="nav-image-trigger">${renderHeaderToolMenu('image')}</div>
        </li>
        <li class="nav-item has-mega-menu" data-nav-category="calculator">
          <button id="nav-calculator-trigger" type="button" class="nav-link${navState('calculator')}" aria-haspopup="true" aria-controls="nav-calculator-menu" aria-expanded="false"${currentPageAttribute('calculator')}><i data-lucide="calculator"></i><span>Calculators</span><i class="nav-chevron" data-lucide="chevron-down"></i></button>
          <div id="nav-calculator-menu" class="mega-menu" aria-labelledby="nav-calculator-trigger">${renderHeaderToolMenu('calculator')}</div>
        </li>
        <li class="nav-item">
          <a class="nav-link${navState('dashboard')}" onclick="navigate('dashboard')"${currentPageAttribute('dashboard')}><i data-lucide="layout-dashboard"></i><span>${t('dashboard')}</span></a>
        </li>
        <li class="mobile-tool-category-links" aria-label="More tool categories">
          <button type="button" onclick="navigateToToolCategory('convert')"><i data-lucide="repeat-2"></i><span>Converters</span></button>
          <button type="button" onclick="navigateToToolCategory('zip')"><i data-lucide="archive"></i><span>ZIP Tools</span></button>
          <button type="button" onclick="navigateToToolCategory('utility')"><i data-lucide="code-2"></i><span>Developer Tools</span></button>
        </li>
        <li class="mobile-nav-utilities" aria-label="Display and support actions">
          <label for="mobile-language-select"><i data-lucide="languages"></i><span>Language</span></label>
          <select id="mobile-language-select" aria-label="Select language" onchange="setLanguage(this.value)">
            <option value="en" ${appState.lang === 'en' ? 'selected' : ''}>English</option>
            <option value="de" ${appState.lang === 'de' ? 'selected' : ''}>Deutsch</option>
            <option value="es" ${appState.lang === 'es' ? 'selected' : ''}>EspaÃ±ol</option>
            <option value="fr" ${appState.lang === 'fr' ? 'selected' : ''}>FranÃ§ais</option>
            <option value="ar" ${appState.lang === 'ar' ? 'selected' : ''}>Ø§Ù„Ø¹Ø±Ø¨ÙŠØ©</option>
          </select>
          <button type="button" onclick="setTheme(document.body.classList.contains('dark-mode') ? 'light' : 'dark')"><i data-lucide="${appState.theme === 'dark' ? 'sun' : 'moon'}"></i><span>${appState.theme === 'dark' ? 'Light theme' : 'Dark theme'}</span></button>
          <button type="button" onclick="closeMobileNavigation(); showContactModal()"><i data-lucide="life-buoy"></i><span>Contact Support</span></button>
        </li>
        ${!appState.user ? `
          <li class="mobile-nav-auth" aria-label="Account actions">
            <button class="btn btn-secondary" onclick="closeMobileNavigation(); showAuthModal('login')">Sign In</button>
            <button class="btn btn-primary" onclick="closeMobileNavigation(); showAuthModal('signup')">${t('signup')}</button>
          </li>
        ` : ''}
      </ul>
      
      <div class="nav-actions">
        <button type="button" class="command-trigger" onclick="openCommandPalette()" aria-label="Search all tools">
          <i data-lucide="search"></i><span>Search</span><kbd>Ctrl K</kbd>
        </button>
        <!-- Theme Switcher -->
        <button id="theme-toggle-btn" class="btn-icon-nav" aria-label="Toggle theme">
          <i data-lucide="${appState.theme === 'dark' ? 'sun' : 'moon'}"></i>
        </button>
        
        <!-- Language Selector -->
        <div class="lang-dropdown">
          <button class="btn-icon-nav" aria-label="Select language" style="width: auto; padding: 0 10px; gap: 4px;">
            <i data-lucide="globe"></i> <span>${appState.lang.toUpperCase()}</span>
          </button>
          <div class="lang-menu">
            <button class="lang-option ${appState.lang === 'en' ? 'active' : ''}" onclick="setLanguage('en')">🇺🇸 English</button>
            <button class="lang-option ${appState.lang === 'de' ? 'active' : ''}" onclick="setLanguage('de')">🇩🇪 Deutsch</button>
            <button class="lang-option ${appState.lang === 'es' ? 'active' : ''}" onclick="setLanguage('es')">🇪🇸 Español</button>
            <button class="lang-option ${appState.lang === 'fr' ? 'active' : ''}" onclick="setLanguage('fr')">🇫🇷 Français</button>
            <button class="lang-option ${appState.lang === 'ar' ? 'active' : ''}" onclick="setLanguage('ar')">🇸🇦 العربية</button>
          </div>
        </div>
        
        ${authActionsHTML}
      </div>
      <button type="button" id="mobile-nav-toggle" class="mobile-nav-toggle" aria-label="Open navigation menu" aria-expanded="false" onclick="toggleMobileNavigation()"><i data-lucide="menu"></i></button>
    </div>
    <button type="button" class="mobile-nav-backdrop" aria-label="Close navigation menu" onclick="closeMobileNavigation()"></button>
  `;
  
  // Attach Theme switch event listener
  document.getElementById('theme-toggle-btn').addEventListener('click', () => {
    setTheme(document.body.classList.contains('dark-mode') ? 'light' : 'dark');
  });
  nav.querySelectorAll('.mega-list-link[onclick*="navigate"]').forEach(link => {
    const route = link.getAttribute('onclick')?.match(/navigate\('([^']+)'\)/)?.[1];
    if (route === appState.currentPage) {
      link.classList.add('is-active');
      link.setAttribute('aria-current', 'page');
    }
  });
  initializeCategoryNavigation(nav);
  syncMobileNavigationState();
  
  lucide.createIcons();
}

function renderFooter() {
  const footer = document.getElementById('footer');
  if (!footer) return;
  
  footer.innerHTML = `
    <div class="container">
      <div class="footer-grid">
        <div class="footer-brand">
          <a class="logo" onclick="navigate('home')" aria-label="GXA Toolbox home" title="GXA Toolbox home">
            <div class="logo-icon" aria-hidden="true"><img src="/gxa-logo.png" alt=""></div>
            <div class="logo-text">GXA <span class="brand-suffix">Toolbox</span></div>
          </a>
          <p class="footer-tagline">${t('tagline')}</p>
          <div class="footer-newsletter">
            <input type="email" placeholder="Join our newsletter" aria-label="Email for newsletter">
            <button class="btn btn-primary btn-sm" onclick="showToast('Thank you for subscribing!', 'success')">Join</button>
          </div>
        </div>
        
        <div class="footer-col">
          <div class="footer-col-title">Products</div>
          <ul class="footer-links">
            <li><a class="footer-link" onclick="navigate('tool-merge-pdf')">Merge PDF</a></li>
            <li><a class="footer-link" onclick="navigate('tool-compress-image')">Compress Image</a></li>
            <li><a class="footer-link" onclick="navigate('tool-color-extractor')">Color Extractor</a></li>
            <li><a class="footer-link" onclick="navigate('tool-password-generator')">Password Tool</a></li>
          </ul>
        </div>
        
        <div class="footer-col">
          <div class="footer-col-title">Company</div>
          <ul class="footer-links">
            <li><a class="footer-link">About Us</a></li>
            <li><a class="footer-link">Careers</a></li>
            <li><a class="footer-link">Security Policies</a></li>
            <li><a class="footer-link" onclick="showContactModal(); return false;">Contact Support</a></li>
          </ul>
        </div>
        
        <div class="footer-col">
          <div class="footer-col-title">Legal</div>
          <ul class="footer-links">
            <li><a class="footer-link">Privacy Policy</a></li>
            <li><a class="footer-link">Terms & Service</a></li>
            <li><a class="footer-link">GDPR Compliance</a></li>
          </ul>
        </div>
      </div>
      
      <div class="footer-bottom">
        <div class="footer-copy">&copy; ${new Date().getFullYear()} GXA Technologies. All rights reserved. GXA Toolbox is a product of GXA Technologies.</div>
        <div class="footer-socials" style="display:flex; gap:10px;">
          <span class="footer-link" aria-label="GXA Toolbox developer community"><i data-lucide="code-2"></i></span>
          <span class="footer-link" aria-label="GXA Toolbox updates"><i data-lucide="message-circle"></i></span>
        </div>
      </div>
    </div>
  `;
  
  lucide.createIcons();
}

// --- Page Navigator (Routing) ---
function navigate(pageId) {
  closeMobileNavigation();
  if (pageId === 'tool-background-remover') {
    window.location.assign('/background-remover/');
    return;
  }
  if (pageId === 'dashboard') {
    if (!appState.user) {
      showToast('Please sign in or create an account to view your dashboard.', 'warning');
      showAuthModal('login');
      return;
    }
  }
  
  if (appState.currentPage === 'tool-crop-image' && pageId !== 'tool-crop-image') {
    disposeCropImageEditor();
  }
  if (appState.currentPage.startsWith('tool-') && pageId !== appState.currentPage) {
    disposePremiumToolEditor();
    window.GxaPhaseOneStudios?.dispose();
  }
  appState.currentPage = pageId;
  if (pageId.startsWith('tool-')) {
    const toolId = pageId.replace('tool-', '');
    appState.recentTools = [toolId, ...appState.recentTools.filter(id => id !== toolId)].slice(0, 8);
    localStorage.setItem(STORAGE_KEYS.recentTools, JSON.stringify(appState.recentTools));
  }
  appState.activeFiles = []; // Clear current file state when navigating
  renderNavbar();
  renderPage();
  window.scrollTo({ top: 0, behavior: 'smooth' });
}

function handleLogout() {
  fetch('/api/logout.php?ajax=1', {
    method: 'POST',
    credentials: 'same-origin',
    headers: { Accept: 'application/json' }
  })
    .then(readApiJson)
    .then(data => {
      if (data.success) {
        appState.user = null;
        if (window.PHP_SESSION) {
          window.PHP_SESSION.loggedIn = false;
          window.PHP_SESSION.user = null;
        }
        showToast('Logged out successfully.', 'info');
        renderNavbar();
        navigate('home');
      }
    })
    .catch(error => {
      console.error('Sign out failed:', error);
      showToast('Unable to sign out right now. Please try again.', 'error');
    });
}

function renderPage() {
  const content = document.getElementById('main-content');
  if (!content) return;
  
  const pageId = appState.currentPage;
  
  if (pageId === 'home') {
    renderHome(content);
  } else if (pageId === 'dashboard') {
    renderDashboard(content);
  } else if (pageId.startsWith('tool-')) {
    const toolId = pageId.replace('tool-', '');
    renderToolPage(content, toolId);
  }
}

// --- Auth Modal & Session Actions (Database Integrated) ---
let modalReturnFocus = null;

function openModalContainer(modal, focusId) {
  if (!modal) return;
  if (modal.classList.contains('hidden')) modalReturnFocus = document.activeElement;
  modal.classList.remove('hidden');
  modal.setAttribute('aria-hidden', 'false');
  document.body.classList.add('modal-open');
  lucide.createIcons();
  window.setTimeout(() => document.getElementById(focusId)?.focus({ preventScroll: true }), 0);
}

function showAuthModal(mode = 'signup') {
  const modal = document.getElementById('modal-container');
  if (!modal) return;

  const isLogin = mode === 'login';
  const rememberedEmail = isLogin ? getRememberedAuthEmail() : '';
  const title = isLogin ? 'Sign in to GXA Toolbox' : 'Create your GXA Toolbox account';
  const description = isLogin
    ? 'Access your dashboard and saved processing history. Public tools remain available without an account.'
    : 'Create an account for saved history and larger batch workflows. Standard tools remain free to use without signing in.';

  modal.innerHTML = `
    <div class="modal-card auth-modal-card" role="dialog" aria-modal="true" aria-labelledby="auth-modal-title">
      <div class="auth-modal-accent" aria-hidden="true"><i data-lucide="shield-check"></i></div>
      <div class="modal-header auth-modal-header">
        <div>
          <span class="auth-eyebrow">GXA Technologies</span>
          <h3 class="modal-title" id="auth-modal-title">${title}</h3>
        </div>
        <button type="button" class="modal-close" onclick="closeModal()" aria-label="Close ${isLogin ? 'sign in' : 'sign up'} dialog"><i data-lucide="x"></i></button>
      </div>
      <form id="auth-form" class="modal-body auth-form" onsubmit="submitAuth(event, '${isLogin ? 'login' : 'signup'}')" novalidate>
        <p class="auth-description">${description}</p>
        <div id="auth-error-msg" class="auth-status auth-status-error hidden" role="alert"></div>
        <div id="auth-success-msg" class="auth-status auth-status-success hidden" role="status"></div>
        ${isLogin ? '' : `
          <div class="auth-field">
            <label class="form-label" for="auth-name">Full Name</label>
            <input type="text" id="auth-name" class="form-input-text" placeholder="Your full name" autocomplete="name" aria-describedby="auth-name-error" oninput="clearAuthFieldError('name')">
            <small id="auth-name-error" class="auth-field-error"></small>
          </div>
        `}
        <div class="auth-field">
          <label class="form-label" for="auth-email">Email Address</label>
          <input type="email" id="auth-email" class="form-input-text" placeholder="tauqeer@gxatechnologies.com" value="${escapeHTML(rememberedEmail)}" autocomplete="email" inputmode="email" aria-describedby="auth-email-error" oninput="clearAuthFieldError('email')">
          <small id="auth-email-error" class="auth-field-error"></small>
        </div>
        <div class="auth-field">
          <label class="form-label" for="auth-password">Password</label>
          <div class="auth-password-control">
            <input type="password" id="auth-password" class="form-input-text" placeholder="Enter your password" autocomplete="${isLogin ? 'current-password' : 'new-password'}" aria-describedby="auth-password-error${isLogin ? '' : ' auth-strength-label'}" oninput="clearAuthFieldError('password'); ${isLogin ? '' : 'updateAuthPasswordStrength();'}">
            <button type="button" class="auth-password-toggle" onclick="toggleAuthPassword('auth-password', this)" aria-label="Show password" title="Show password"><i data-lucide="eye"></i></button>
          </div>
          <small id="auth-password-error" class="auth-field-error"></small>
        </div>
        ${isLogin ? `
          <label class="auth-remember">
            <input type="checkbox" id="auth-remember" ${rememberedEmail ? 'checked' : ''}>
            <span>Remember me <small>Stores only your email on this device</small></span>
          </label>
        ` : `
          <div class="auth-strength" id="auth-password-strength" data-level="0" aria-live="polite">
            <div class="auth-strength-bars" aria-hidden="true"><span></span><span></span><span></span><span></span></div>
            <span id="auth-strength-label">Use 8+ characters with upper/lowercase, a number, and a symbol.</span>
          </div>
          <div class="auth-field">
            <label class="form-label" for="auth-confirm-password">Confirm Password</label>
            <div class="auth-password-control">
              <input type="password" id="auth-confirm-password" class="form-input-text" placeholder="Re-enter your password" autocomplete="new-password" aria-describedby="auth-confirm-error" oninput="clearAuthFieldError('confirm')">
              <button type="button" class="auth-password-toggle" onclick="toggleAuthPassword('auth-confirm-password', this)" aria-label="Show confirmed password" title="Show confirmed password"><i data-lucide="eye"></i></button>
            </div>
            <small id="auth-confirm-error" class="auth-field-error"></small>
          </div>
        `}
        <button type="submit" class="btn btn-primary auth-submit" id="auth-submit-button">
          <span>${isLogin ? 'Sign In' : 'Create Account'}</span><i data-lucide="arrow-right"></i>
        </button>
        <p class="auth-switch">
          ${isLogin
            ? `Don’t have an account? <a href="#" onclick="showAuthModal('signup'); return false;">Sign Up</a>`
            : `Already have an account? <a href="#" onclick="showAuthModal('login'); return false;">Sign In</a>`}
        </p>
      </form>
    </div>
  `;

  openModalContainer(modal, isLogin ? 'auth-email' : 'auth-name');
}

function getRememberedAuthEmail() {
  try {
    return localStorage.getItem(STORAGE_KEYS.rememberedEmail) || '';
  } catch {
    return '';
  }
}

function toggleAuthPassword(inputId, button) {
  const input = document.getElementById(inputId);
  if (!input || !button) return;
  const showPassword = input.type === 'password';
  input.type = showPassword ? 'text' : 'password';
  const label = showPassword ? 'Hide password' : 'Show password';
  button.setAttribute('aria-label', label);
  button.title = label;
  button.innerHTML = `<i data-lucide="${showPassword ? 'eye-off' : 'eye'}"></i>`;
  lucide.createIcons();
  input.focus({ preventScroll: true });
}

function getAuthPasswordStrength(password) {
  let score = 0;
  if (password.length >= 8) score += 1;
  if (password.length >= 12) score += 1;
  if (/[a-z]/.test(password) && /[A-Z]/.test(password)) score += 1;
  if (/\d/.test(password) && /[^A-Za-z0-9]/.test(password)) score += 1;
  const labels = ['Enter a password', 'Weak', 'Medium', 'Medium', 'Strong'];
  return { score, label: labels[score] };
}

function updateAuthPasswordStrength() {
  const password = document.getElementById('auth-password')?.value || '';
  const meter = document.getElementById('auth-password-strength');
  const label = document.getElementById('auth-strength-label');
  if (!meter || !label) return;
  const strength = getAuthPasswordStrength(password);
  meter.dataset.level = String(strength.score);
  label.textContent = password ? `${strength.label} password` : 'Use 8+ characters with upper/lowercase, a number, and a symbol.';
}

function clearAuthFieldError(field) {
  const inputId = field === 'confirm' ? 'auth-confirm-password' : `auth-${field}`;
  document.getElementById(inputId)?.classList.remove('is-invalid');
  const error = document.getElementById(`auth-${field}-error`);
  if (error) error.textContent = '';
}

function showAuthFieldError(field, message) {
  const inputId = field === 'confirm' ? 'auth-confirm-password' : `auth-${field}`;
  const input = document.getElementById(inputId);
  const error = document.getElementById(`auth-${field}-error`);
  input?.classList.add('is-invalid');
  if (error) error.textContent = message;
  return input;
}

function closeModal() {
  const modal = document.getElementById('modal-container');
  if (!modal || modal.classList.contains('hidden')) return;
  modal.classList.add('hidden');
  modal.setAttribute('aria-hidden', 'true');
  document.body.classList.remove('modal-open');
  if (modalReturnFocus instanceof HTMLElement && document.contains(modalReturnFocus)) {
    modalReturnFocus.focus({ preventScroll: true });
  }
  modalReturnFocus = null;
}

async function submitAuth(event, type) {
  event?.preventDefault();
  const errorEl = document.getElementById('auth-error-msg');
  const successEl = document.getElementById('auth-success-msg');
  const submitButton = document.getElementById('auth-submit-button');
  errorEl?.classList.add('hidden');
  successEl?.classList.add('hidden');
  ['name', 'email', 'password', 'confirm'].forEach(clearAuthFieldError);

  const email = document.getElementById('auth-email')?.value.trim().toLowerCase() || '';
  const password = document.getElementById('auth-password')?.value || '';
  let firstInvalid = null;
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    const invalidField = showAuthFieldError('email', 'Enter a valid email address.');
    firstInvalid ||= invalidField;
  }
  if (!password) {
    const invalidField = showAuthFieldError('password', 'Enter your password.');
    firstInvalid ||= invalidField;
  }

  const endpoint = type === 'login' ? '/api/login.php' : '/api/register.php';
  const payload = { email, password };
  if (type === 'signup') {
    const name = document.getElementById('auth-name')?.value.trim() || '';
    const confirmation = document.getElementById('auth-confirm-password')?.value || '';
    if (name.length < 2) {
      const invalidField = showAuthFieldError('name', 'Enter your full name.');
      firstInvalid ||= invalidField;
    }
    if (password.length < 8) {
      const invalidField = showAuthFieldError('password', 'Use at least 8 characters.');
      firstInvalid ||= invalidField;
    }
    if (confirmation !== password) {
      const invalidField = showAuthFieldError('confirm', 'Passwords do not match.');
      firstInvalid ||= invalidField;
    }
    payload.name = name;
  }

  if (firstInvalid) {
    firstInvalid.focus();
    return;
  }

  const originalButton = submitButton?.innerHTML || '';
  if (submitButton) {
    submitButton.disabled = true;
    submitButton.innerHTML = `<span class="spinner spinner-inline"></span><span>${type === 'login' ? 'Signing in…' : 'Creating account…'}</span>`;
  }

  try {
    const response = await fetch(endpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'same-origin',
      body: JSON.stringify(payload)
    });
    const data = await readApiJson(response);
    if (!data.success) {
      if (data.errors && typeof data.errors === 'object') {
        Object.entries(data.errors).forEach(([field, message]) => showAuthFieldError(field, message));
      }
      if (errorEl) {
        errorEl.textContent = data.message || 'Authentication was not accepted. Check your details and try again.';
        errorEl.classList.remove('hidden');
      }
      return;
    }

    appState.user = {
      id: data.user.id,
      name: data.user.name,
      email: data.user.email,
      role: data.user.role,
      is_premium: parseInt(data.user.is_premium) || 0,
      tier: parseInt(data.user.is_premium) ? 'Premium' : 'Free',
      processedCount: 0,
      history: []
    };
    window.PHP_SESSION = {
      loggedIn: true,
      user: {
        id: data.user.id,
        name: data.user.name,
        email: data.user.email,
        role: data.user.role,
        is_premium: data.user.is_premium
      },
      premium_tools: window.PHP_SESSION ? window.PHP_SESSION.premium_tools : []
    };

    if (type === 'login') {
      try {
        if (document.getElementById('auth-remember')?.checked) localStorage.setItem(STORAGE_KEYS.rememberedEmail, email);
        else localStorage.removeItem(STORAGE_KEYS.rememberedEmail);
      } catch {
        // Remembering an email is optional and must never block authentication.
      }
    }

    if (successEl) {
      successEl.textContent = data.message || (type === 'login' ? 'Signed in successfully.' : 'Account created successfully.');
      successEl.classList.remove('hidden');
    }
    if (submitButton) submitButton.innerHTML = '<i data-lucide="check"></i><span>Success</span>';
    showToast(data.message || 'Authentication completed.', 'success');
    fetchHistoryFromDB();
    renderNavbar();
    lucide.createIcons();
    setTimeout(() => {
      closeModal();
      navigate('dashboard');
    }, 650);
  } catch (error) {
    console.error('Auth request failed:', error);
    if (errorEl) {
      errorEl.textContent = 'The authentication service is unavailable. Please try again.';
      errorEl.classList.remove('hidden');
    }
  } finally {
    if (submitButton && !appState.user) {
      submitButton.disabled = false;
      submitButton.innerHTML = originalButton;
      lucide.createIcons();
    }
  }
}

async function readApiJson(response) {
  const contentType = response.headers.get('content-type') || '';
  if (!contentType.toLowerCase().includes('application/json')) {
    throw new Error(`Account endpoint returned ${response.status} ${contentType || 'without a content type'}.`);
  }
  const data = await response.json();
  if (!data || typeof data !== 'object') throw new Error('Account endpoint returned an invalid response.');
  return data;
}

// --- Contact Support Modal & API Actions ---
function showContactModal() {
  const modal = document.getElementById('modal-container');
  if (!modal) return;
  
  modal.innerHTML = `
    <div class="modal-card contact-modal-card" role="dialog" aria-modal="true" aria-labelledby="contact-modal-title">
      <div class="modal-header">
        <h3 class="modal-title" id="contact-modal-title">Contact Support</h3>
        <button type="button" class="modal-close" onclick="closeModal()" aria-label="Close contact support dialog"><i data-lucide="x"></i></button>
      </div>
      <div class="modal-body">
        <p style="font-size:14px; color:var(--color-text-secondary); margin-bottom:15px;">
          Have questions or feedback? Send us a message and our support team will respond shortly.
        </p>
        <div id="contact-status-msg" style="font-size:13px; font-weight:700; margin-bottom:10px; display:none;"></div>
        <div class="form-group" style="margin-bottom:12px;">
          <label for="contact-name" class="form-label" style="display:block; font-size:12px; font-weight:700; margin-bottom:4px;">Full Name</label>
          <input type="text" id="contact-name" class="form-input-text" placeholder="Tauqeer Ashraf" value="${appState.user ? escapeHTML(appState.user.name) : ''}" autocomplete="name" style="width:100%; height:44px; border-radius:var(--radius-sm); border:1px solid var(--color-border); padding:0 10px; font-family:inherit;">
        </div>
        <div class="form-group" style="margin-bottom:12px;">
          <label for="contact-email" class="form-label" style="display:block; font-size:12px; font-weight:700; margin-bottom:4px;">Email Address</label>
          <input type="email" id="contact-email" class="form-input-text" placeholder="tauqeer@gxatechnologies.com" value="${appState.user ? escapeHTML(appState.user.email) : ''}" autocomplete="email" inputmode="email" style="width:100%; height:44px; border-radius:var(--radius-sm); border:1px solid var(--color-border); padding:0 10px; font-family:inherit;">
        </div>
        <div class="form-group" style="margin-bottom:15px;">
          <label for="contact-message" class="form-label" style="display:block; font-size:12px; font-weight:700; margin-bottom:4px;">Message Details</label>
          <textarea id="contact-message" placeholder="Describe your inquiry..." style="width:100%; min-height:110px; border-radius:var(--radius-sm); border:1px solid var(--color-border); padding:10px; font-family:inherit; resize:vertical; line-height:1.4;"></textarea>
        </div>
        <button class="btn btn-primary" onclick="submitContact()" style="width:100%; margin-top:5px; height:40px;">Send Message</button>
      </div>
    </div>
  `;
  
  openModalContainer(modal, 'contact-name');
}

function submitContact() {
  const statusEl = document.getElementById('contact-status-msg');
  if (statusEl) statusEl.style.display = 'none';
  
  const name = document.getElementById('contact-name').value.trim();
  const email = document.getElementById('contact-email').value.trim();
  const message = document.getElementById('contact-message').value.trim();
  
  if (!name || !email || !message) {
    if (statusEl) {
      statusEl.innerText = 'Please fill in all contact fields.';
      statusEl.style.color = 'var(--color-danger)';
      statusEl.style.display = 'block';
    }
    return;
  }
  
  fetch('/api/contact.php', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ name, email, message })
  })
  .then(r => r.json())
  .then(data => {
    if (data.success) {
      showToast(data.message, 'success');
      closeModal();
    } else {
      if (statusEl) {
        statusEl.innerText = data.message;
        statusEl.style.color = 'var(--color-danger)';
        statusEl.style.display = 'block';
      }
    }
  })
  .catch(err => {
    console.error('Contact submission failed:', err);
    if (statusEl) {
      statusEl.innerText = 'Failed to submit contact message. Please try again.';
      statusEl.style.color = 'var(--color-danger)';
      statusEl.style.display = 'block';
    }
  });
}

// --- RENDER PAGE: HOMEPAGE ---
function renderHome(container) {
  const recentTools = appState.recentTools
    .map(id => toolsList.find(tool => tool.id === id))
    .filter(Boolean)
    .slice(0, 4);
  const favoriteTools = appState.favorites
    .map(id => toolsList.find(tool => tool.id === id))
    .filter(Boolean)
    .slice(0, 4);
  const personalTools = favoriteTools.length ? favoriteTools : recentTools;
  const personalHeading = favoriteTools.length ? 'Your favorites' : 'Continue where you left off';
  const recentSearchChips = appState.recentSearches.length ? `<div class="recent-searches"><span>Recent:</span>${appState.recentSearches.map(query => `<button data-query="${escapeHTML(query)}" onclick="runRecentSearch(this)"><i data-lucide="history"></i>${escapeHTML(query)}</button>`).join('')}</div>` : '';
  const personalShelf = personalTools.length ? `
    <section class="container personal-tools-section" aria-labelledby="personal-tools-title">
      <div class="section-heading-row">
        <div>
          <span class="section-kicker">Your workspace</span>
          <h2 class="section-title" id="personal-tools-title">${personalHeading}</h2>
        </div>
        <button class="text-button" onclick="openCommandPalette()">Find another tool <i data-lucide="arrow-right"></i></button>
      </div>
      <div class="personal-tools-grid">
        ${personalTools.map(tool => `
          <button class="personal-tool-card" onclick="navigate('tool-${tool.id}')">
            <span class="personal-tool-icon cat-${tool.category}"><i data-lucide="${tool.icon}"></i></span>
            <span><strong>${tool.name}</strong><small>${tool.category}</small></span>
            <i data-lucide="arrow-up-right"></i>
          </button>`).join('')}
      </div>
    </section>` : '';

  container.innerHTML = `
    <section class="hero-section premium-hero">
      <div class="container hero-grid">
        <div class="hero-content">
          <div class="badge-trust"><span class="status-dot"></span> ${toolsList.length} focused tools. One polished workspace.</div>
          <h1 class="hero-headline">Your Complete <span>Digital Toolbox</span></h1>
          <p class="hero-subheadline">Access powerful browser-based tools for PDFs, images, file conversions, QR codes, ZIP files, developer utilities, and everyday calculations — all in one place.</p>
          <div class="hero-actions">
            <button class="btn btn-primary btn-lg" onclick="document.getElementById('tools-grid-anchor').scrollIntoView({behavior:'smooth'})">Explore tools <i data-lucide="arrow-down"></i></button>
            <button class="btn btn-ghost btn-lg" onclick="showAuthModal()">Sign up for free</button>
          </div>
          <div class="hero-metrics" aria-label="Product overview">
            <span><strong>${toolsList.length}</strong> tools</span>
            <span><strong>${new Set(toolsList.map(tool => tool.category)).size}</strong> categories</span>
            <span><i data-lucide="shield-check"></i> Clear processing details</span>
          </div>
        </div>
        <div class="hero-product-window" aria-hidden="true">
          <div class="product-window-bar"><span></span><span></span><span></span><small>gxa-toolbox.app</small></div>
          <div class="product-window-body">
            <div class="product-side-rail"><i data-lucide="layout-grid"></i><i data-lucide="file-text"></i><i data-lucide="image"></i><i data-lucide="code-2"></i></div>
            <div class="product-canvas">
              <div class="mini-toolbar"><span>Merge PDF</span><span class="mini-status">Local processing</span></div>
              <div class="mini-dropzone"><i data-lucide="cloud-upload"></i><strong>Drop your files here</strong><small>PDF · up to 100 MB</small></div>
              <div class="mini-file-row"><i data-lucide="file-text"></i><span><strong>annual-report.pdf</strong><small>4.2 MB · Ready</small></span><i data-lucide="check-circle-2"></i></div>
            </div>
          </div>
          <span class="floating-tool floating-pdf"><i data-lucide="file-text"></i> PDF</span>
          <span class="floating-tool floating-image"><i data-lucide="image"></i> Image</span>
          <span class="floating-tool floating-code"><i data-lucide="braces"></i> Dev</span>
        </div>
      </div>
    </section>

    <section class="command-search-section">
      <div class="container">
        <button class="home-command-search" onclick="openCommandPalette()" aria-label="Search all GXA Toolbox tools">
          <i data-lucide="search"></i><span>Search PDFs, images, calculators, developer tools…</span><kbd>Ctrl K</kbd>
        </button>
        <div class="popular-searches"><span>Popular:</span><button onclick="runPopularSearch('Merge PDF')">Merge PDF</button><button onclick="runPopularSearch('Compress Image')">Compress Image</button><button onclick="runPopularSearch('QR Generator')">QR Generator</button><button onclick="runPopularSearch('JSON')">JSON</button></div>
        ${recentSearchChips}
      </div>
    </section>

    ${personalShelf}

    <section class="container tools-directory" id="tools-grid-anchor">
      <div class="section-heading-row">
        <div><span class="section-kicker">Everything you need</span><h2 class="section-title">Explore the toolbox</h2><p class="section-desc">Choose a focused utility and see exactly where its processing happens.</p></div>
        <span class="directory-count">${toolsList.length} tools</span>
      </div>
      <div class="tool-filter-bar">
        <div class="filter-tabs" role="tablist" aria-label="Tool categories">
          ${[['all','All tools'],['pdf','PDF'],['image','Image'],['convert','Convert'],['zip','ZIP'],['utility','Developer'],['calculator','Calculators']].map(([id,label], index) => `<button class="filter-tab ${index === 0 ? 'active' : ''}" data-category="${id}" onclick="filterTools('${id}', this)">${label}</button>`).join('')}
        </div>
        <div class="search-wrapper">
          <i data-lucide="search" class="search-icon" aria-hidden="true"></i>
          <input type="search" id="tool-search" class="search-input" aria-label="Filter ${toolsList.length} tools" placeholder="Filter ${toolsList.length} tools" oninput="searchTools(this.value)" onkeydown="if(event.key==='Enter') recordRecentSearch(this.value)">
        </div>
      </div>
      <div class="tools-grid" id="tools-grid-container"></div>
    </section>

    <section class="features-section">
      <div class="container">
        <div class="section-header"><span class="section-kicker">Made for momentum</span><h2 class="section-title">A calmer way to get small tasks done</h2></div>
        <div class="features-grid">
          <div class="feature-card"><div class="feature-icon-wrapper"><i data-lucide="shield-check"></i></div><h3 class="feature-title">Processing you can understand</h3><p class="feature-desc">Each file utility identifies local, server, browser-capability, or dependency-required processing before you begin.</p></div>
          <div class="feature-card"><div class="feature-icon-wrapper"><i data-lucide="sparkles"></i></div><h3 class="feature-title">One consistent workspace</h3><p class="feature-desc">Upload, configure, preview, process, and download through a familiar interface across the toolbox.</p></div>
          <div class="feature-card"><div class="feature-icon-wrapper"><i data-lucide="keyboard"></i></div><h3 class="feature-title">Built for repeat work</h3><p class="feature-desc">Command search, favorites, and recent tools keep frequent workflows close without changing your files or routes.</p></div>
        </div>
      </div>
    </section>

    <section class="stats-section">
      <div class="container">
        <div class="stats-grid">
          <div class="stat-item"><div class="stat-number" id="stats-counter-1">${toolsList.length}</div><div class="stat-label">Available tools</div></div>
          <div class="stat-item"><div class="stat-number">4</div><div class="stat-label">Clear processing modes</div></div>
          <div class="stat-item"><div class="stat-number" id="stats-counter-2">${new Set(toolsList.map(tool => tool.category)).size}</div><div class="stat-label">Focused categories</div></div>
          <div class="stat-item"><div class="stat-number">320px+</div><div class="stat-label">Responsive layouts</div></div>
        </div>
      </div>
    </section>
    <section class="container">
      <div class="cta-banner">
        <div>
          <span class="section-kicker light">GXA Toolbox</span>
          <h2 class="cta-title">Your next task starts here.</h2>
          <p class="cta-subtitle">Create an account for processing history and dashboard access, or keep exploring the standard tools.</p>
          <button class="btn btn-white btn-lg" onclick="showAuthModal()">Create a free account <i data-lucide="arrow-right"></i></button>
        </div>
        <div class="cta-ill"><i data-lucide="blocks"></i></div>
      </div>
    </section>
  `;
  
  // Render grid list
  renderToolsGrid('all');
  lucide.createIcons();
  startStatsCounters();
}

function renderToolsGrid(categoryFilter = 'all', searchQuery = '') {
  const grid = document.getElementById('tools-grid-container');
  if (!grid) return;
  
  grid.innerHTML = '';
  
  const filtered = toolsList.filter(tool => {
    const matchesCategory = categoryFilter === 'all' || tool.category === categoryFilter;
    const matchesSearch = tool.name.toLowerCase().includes(searchQuery.toLowerCase()) || 
                          tool.desc.toLowerCase().includes(searchQuery.toLowerCase());
    return matchesCategory && matchesSearch;
  });
  
  if (filtered.length === 0) {
    grid.innerHTML = `<div class="tools-empty-state"><i data-lucide="search-x"></i><h3>No matching tools</h3><p>Try a shorter search or choose another category.</p><button class="btn btn-ghost" onclick="document.getElementById('tool-search').value=''; filterTools('all', document.querySelector('.filter-tab[data-category=all]'))">Clear filters</button></div>`;
    lucide.createIcons();
    return;
  }
  
  filtered.forEach(tool => {
    const card = document.createElement('a');
    card.className = `tool-card cat-${tool.category}`;
    card.href = `#tool-${tool.id}`;
    card.setAttribute('aria-label', `Open ${tool.name}`);
    const isFavorite = appState.favorites.includes(tool.id);
    
    // Fallback icon resolver
    let iconHTML = `<i data-lucide="${tool.icon}"></i>`;
    if (tool.icon === 'qr-code') iconHTML = `<i data-lucide="qr-code"></i>`;
    
    card.innerHTML = `
      <div class="tool-card-top"><div class="tool-card-icon">${iconHTML}</div><button class="favorite-button ${isFavorite ? 'active' : ''}" aria-label="${isFavorite ? 'Remove' : 'Add'} ${tool.name} ${isFavorite ? 'from' : 'to'} favorites" onclick="event.preventDefault(); event.stopPropagation(); toggleFavorite('${tool.id}', this)"><i data-lucide="star"></i></button></div>
      <div class="tool-card-category">${tool.category}</div>
      <h3 class="tool-card-title">${tool.name}</h3>
      <p class="tool-card-desc">${tool.desc}</p>
      <div class="tool-card-footer"><i data-lucide="arrow-up-right" class="tool-card-arrow"></i></div>
    `;

    card.addEventListener('click', (e) => {
      e.preventDefault();
      navigate(`tool-${tool.id}`);
    });
    
    grid.appendChild(card);
  });
  
  lucide.createIcons();
}

function filterTools(category, btn) {
  // Toggle tab classes
  const tabs = document.querySelectorAll('.filter-tab');
  tabs.forEach(tab => tab.classList.remove('active'));
  btn.classList.add('active');
  
  const searchInput = document.getElementById('tool-search');
  renderToolsGrid(category, searchInput ? searchInput.value : '');
}

function searchTools(query) {
  // Find active category tab
  const activeTab = document.querySelector('.filter-tab.active');
  const cat = activeTab ? activeTab.dataset.category : 'all';
  renderToolsGrid(cat, query);
}

function startStatsCounters() {
  const toolsCounter = document.getElementById('stats-counter-1');
  const categoryCounter = document.getElementById('stats-counter-2');
  if (toolsCounter) toolsCounter.textContent = String(toolsList.length);
  if (categoryCounter) categoryCounter.textContent = String(new Set(toolsList.map(tool => tool.category)).size);
}

// --- RENDER PAGE: USER DASHBOARD ---
function renderDashboard(container) {
  const history = Array.isArray(appState.user.history) ? appState.user.history : [];
  const totalFiles = history.filter(item => item.status === 'done').length;
  const failedFiles = history.filter(item => item.status !== 'done').length;
  const months = Array.from({ length: 5 }, (_, offset) => {
    const date = new Date();
    date.setDate(1);
    date.setMonth(date.getMonth() - (4 - offset));
    const key = date.toISOString().slice(0, 7);
    return { key, label: date.toLocaleString(undefined, { month: 'short' }), count: history.filter(item => String(item.date || '').startsWith(key)).length };
  });
  const maxMonthCount = Math.max(1, ...months.map(item => item.count));
  const monthlyBars = months.map(item => `<div class="mock-chart-bar" style="height:${Math.max(4, (item.count / maxMonthCount) * 100)}%"><span class="mock-chart-val">${item.count}</span><span class="mock-chart-label" style="bottom:-24px;">${item.label}</span></div>`).join('');
  
  container.innerHTML = `
    <section class="container" style="padding: 40px 0;">
      <div class="dashboard-grid">
        <!-- Sidebar -->
        <aside class="dashboard-sidebar">
          <div class="user-profile-widget">
            <div class="avatar">${escapeHTML(appState.user.name.charAt(0))}</div>
            <div class="user-profile-name">${escapeHTML(appState.user.name)}</div>
            <div class="user-profile-tier">${appState.user.tier} Account</div>
          </div>
          
          <ul class="db-sidebar-menu">
            <li><a class="db-sidebar-link active"><i data-lucide="layout-dashboard"></i> Overview</a></li>
            <li><a class="db-sidebar-link" onclick="showToast('Loading settings panel...', 'info')"><i data-lucide="settings"></i> Settings</a></li>
            <li><a class="db-sidebar-link" onclick="navigate('home')"><i data-lucide="home"></i> Home</a></li>
          </ul>
        </aside>
        
        <!-- Main Dashboard content area -->
        <div class="dashboard-content">
          <h2 class="db-title">Welcome back, ${escapeHTML(appState.user.name)}!</h2>
          
          <!-- Key Statistics -->
          <div class="db-stats-grid">
            <div class="db-stat-card">
              <div class="db-stat-icon"><i data-lucide="files"></i></div>
              <div class="db-stat-info">
                <div class="db-stat-num">${totalFiles}</div>
                <div class="db-stat-label">${t('statsProcessed')}</div>
              </div>
            </div>
            
            <div class="db-stat-card">
              <div class="db-stat-icon"><i data-lucide="hard-drive"></i></div>
              <div class="db-stat-info">
                <div class="db-stat-num">${history.length}</div>
                <div class="db-stat-label">History entries</div>
              </div>
            </div>
            
            <div class="db-stat-card">
              <div class="db-stat-icon"><i data-lucide="trending-down"></i></div>
              <div class="db-stat-info">
                <div class="db-stat-num">${failedFiles}</div>
                <div class="db-stat-label">Failed operations</div>
              </div>
            </div>
          </div>
          
          <!-- Monthly activity from actual local history -->
          <div class="db-chart-card">
            <div class="db-chart-header">Monthly Volume (Files Processed)</div>
            <div class="mock-chart-container">
              ${monthlyBars}
            </div>
          </div>
          
          <!-- History Log List -->
          <div class="db-table-card">
            <div class="db-table-header">
              <h3 class="db-table-title">${t('historyTitle')}</h3>
              <button class="btn btn-ghost btn-sm" onclick="clearHistoryLog()">Clear History</button>
            </div>
            <div class="db-table-wrapper">
              <table class="db-table">
                <thead>
                  <tr>
                    <th>Filename</th>
                    <th>Tool</th>
                    <th>Date</th>
                    <th>Size</th>
                    <th>Status</th>
                  </tr>
                </thead>
                <tbody id="db-history-rows"></tbody>
              </table>
            </div>
          </div>
        </div>
      </div>
    </section>
  `;
  
  // Render rows
  const tbody = document.getElementById('db-history-rows');
  if (tbody) {
    if (appState.user.history.length === 0) {
      tbody.innerHTML = `<tr><td colspan="5" style="text-align:center; padding:20px; color:var(--color-text-secondary);">No files processed yet. Try running some tools first!</td></tr>`;
    } else {
      appState.user.history.forEach(log => {
        tbody.innerHTML += `
          <tr>
            <td style="font-weight:700;">${escapeHTML(log.name)}</td>
            <td>${escapeHTML(log.tool)}</td>
            <td>${escapeHTML(log.date)}</td>
            <td>${escapeHTML(log.size)}</td>
            <td><span class="badge-history-status status-${log.status === 'done' ? 'done' : 'fail'}">${escapeHTML(log.status.toUpperCase())}</span></td>
          </tr>
        `;
      });
    }
  }
  
  lucide.createIcons();
}

function clearHistoryLog() {
  appState.user.history = [];
  localStorage.setItem(STORAGE_KEYS.history, JSON.stringify([]));
  localStorage.removeItem(LEGACY_STORAGE_KEYS.history);
  renderPage();
  showToast('Activity history logs cleared.', 'info');
}

// --- UNIVERSAL TOOL PAGE TEMPLATE RENDERER ---
const PUBLIC_TOOL_IDS = new Set(['background-remover']);

function isToolPremiumRestricted(toolId) {
  if (PUBLIC_TOOL_IDS.has(toolId)) return false;
  if (window.PHP_SESSION && Array.isArray(window.PHP_SESSION.premium_tools)) {
    return window.PHP_SESSION.premium_tools.includes(toolId);
  }
  return false;
}

function getToolPanelMeta(toolId, category, needsFiles) {
  if (category === 'calculator') return { title: 'Calculation inputs', subtitle: 'Enter values, calculate, or reset' };
  if (toolId === 'barcode-generator') return { title: 'Code settings', subtitle: 'Content, type, size, margin, and colors' };
  if (['json-tool', 'sql-formatter', 'html-beautifier', 'css-beautifier', 'js-beautifier', 'xml-to-json', 'base64-tool', 'url-tool', 'diff-checker', 'markdown-editor'].includes(toolId)) {
    return { title: 'Input & output', subtitle: 'Edit locally with live validation' };
  }
  if (category === 'zip') return { title: 'Archive settings', subtitle: 'Inspect, extract, or package local files' };
  if (category === 'pdf' || toolId.includes('pdf')) return { title: 'Document settings', subtitle: 'Page-aware PDF controls' };
  if (category === 'image' || ['svg-to-png', 'png-to-svg', 'webp-to-jpg', 'color-extractor', 'exif-viewer'].includes(toolId)) {
    return { title: 'Image settings', subtitle: 'Preview and configure the real output' };
  }
  if (needsFiles) return { title: 'Output settings', subtitle: 'Controls for this file workflow' };
  return { title: 'Tool settings', subtitle: 'Controls specific to this utility' };
}

function getDirectResultDownloadLabel(toolId) {
  const labels = {
    'compress-image': 'Download Compressed Image',
    'resize-image': 'Download Resized Image',
    'watermark-pdf': 'Download Watermarked PDF',
    'webp-to-jpg': 'Download Converted Image',
    'svg-to-png': 'Download Converted Image',
    'png-to-svg': 'Download Converted Image',
    'exif-viewer': 'Download Clean Image'
  };
  return labels[toolId] || 'Download Result';
}

function renderToolPage(container, toolId) {
  const tool = toolsList.find(t => t.id === toolId);
  if (!tool) return;
  document.body.classList.toggle('background-remover-dedicated-active', toolId === 'background-remover');

  // Premium tool gating check
  const isPremiumTool = isToolPremiumRestricted(toolId);

  if (isPremiumTool) {
    const isUserLoggedIn = appState.user !== null;
    const isUserPremium = appState.user && (appState.user.is_premium === 1 || appState.user.role === 'developer' || appState.user.role === 'admin');

    if (!isUserLoggedIn) {
      container.innerHTML = `
        <div class="container" style="padding: 100px 0; max-width: 600px;">
          <div class="premium-blocker-card" style="background: var(--color-surface); border: 1px solid var(--color-border); border-radius: var(--radius-lg); padding: 40px; text-align: center; box-shadow: var(--shadow-lg);">
            <div class="lock-icon-wrapper" style="width: 80px; height: 80px; border-radius: 50%; background: rgba(139, 92, 246, 0.1); color: #8B5CF6; display: flex; align-items: center; justify-content: center; margin: 0 auto 24px;">
              <i data-lucide="lock" style="width: 40px; height: 40px;"></i>
            </div>
            <h2 style="font-size: 24px; font-weight: 700; margin-bottom: 12px; font-family: var(--font-header);">Premium Utility</h2>
            <p style="color: var(--color-text-secondary); margin-bottom: 30px; line-height: 1.6; font-size: 15px;">
              <strong>${tool.name}</strong> is a premium utility. Please sign in to your account or register to request access.
            </p>
            <div style="display: flex; flex-direction: column; gap: 12px;">
              <button class="btn btn-primary btn-lg" onclick="showAuthModal('login')" style="width: 100%;">Sign In</button>
              <button class="btn btn-ghost" onclick="navigate('home')" style="width: 100%;">Back to Home</button>
            </div>
          </div>
        </div>
      `;
      lucide.createIcons();
      return;
    } else if (!isUserPremium) {
      container.innerHTML = `
        <div class="container" style="padding: 100px 0; max-width: 600px;">
          <div class="premium-blocker-card" style="background: var(--color-surface); border: 1px solid var(--color-border); border-radius: var(--radius-lg); padding: 40px; text-align: center; box-shadow: var(--shadow-lg);">
            <div class="lock-icon-wrapper" style="width: 80px; height: 80px; border-radius: 50%; background: rgba(239, 68, 68, 0.1); color: #EF4444; display: flex; align-items: center; justify-content: center; margin: 0 auto 24px;">
              <i data-lucide="shield-alert" style="width: 40px; height: 40px;"></i>
            </div>
            <h2 style="font-size: 24px; font-weight: 700; margin-bottom: 12px; font-family: var(--font-header);">Access Restricted</h2>
            <p style="color: var(--color-text-secondary); margin-bottom: 30px; line-height: 1.6; font-size: 15px;">
              <strong>${tool.name}</strong> is a premium utility. Please contact the system administrator to unlock access for your account.
            </p>
            <div style="display: flex; flex-direction: column; gap: 12px;">
              <button class="btn btn-primary btn-lg" onclick="navigate('home')" style="width: 100%;">Back to Home</button>
            </div>
          </div>
        </div>
      `;
      lucide.createIcons();
      return;
    }
  }
  
  // Base configuration options depending on tools
  let optionsHTML = '';
  let accepts = '*';
  let multiple = true;
  
  if (toolId === 'merge-pdf') {
    accepts = '.pdf';
    optionsHTML = `
      <div class="form-group">
        <label class="form-label">Output Filename</label>
        <input type="text" id="opt-filename" class="form-input-text" value="merged_output.pdf">
      </div>
      <div class="checkbox-group">
        <label class="checkbox-label">
          <input type="checkbox" id="opt-reverse" onchange="appState.activeToolOptions.reverse = this.checked">
          <div class="custom-checkbox"></div>
          Reverse page order
        </label>
      </div>
    `;
  } else if (toolId === 'organize-pdf') {
    accepts = '.pdf';
    multiple = false; // Organize single PDF at a time
    optionsHTML = `
      <div class="form-group">
        <label class="form-label">Page Selection</label>
        <input type="text" id="opt-range" class="form-input-text" placeholder="e.g. 1-3, 5, 7-10">
      </div>
      <div class="form-group">
        <label class="form-label">Rotation Angle</label>
        <div class="preset-grid">
          <button class="preset-btn active" onclick="setOptAngle(0, this)">0°</button>
          <button class="preset-btn" onclick="setOptAngle(90, this)">90°</button>
          <button class="preset-btn" onclick="setOptAngle(180, this)">180°</button>
          <button class="preset-btn" onclick="setOptAngle(270, this)">270°</button>
        </div>
      </div>
      <div class="form-group">
        <label class="form-label">Watermark Text</label>
        <input type="text" id="opt-watermark" class="form-input-text" placeholder="Confidential">
      </div>
      <div class="form-group">
        <label class="form-label" for="opt-organize-blank-count">Insert blank pages</label>
        <input type="number" id="opt-organize-blank-count" class="form-input-text" min="0" max="50" value="0">
        <label class="form-label" for="opt-organize-blank-after" style="margin-top:8px;">Insert after output page</label>
        <input type="number" id="opt-organize-blank-after" class="form-input-text" min="0" value="0">
        <p style="font-size:10px; color:var(--color-text-secondary); margin-top:4px;">Use 0 to insert at the beginning. Blank pages match the nearest output page size.</p>
      </div>
    `;
  } else if (toolId === 'compress-image') {
    accepts = 'image/*';
    optionsHTML = `
      <div class="slider-container">
        <div class="slider-header">
          <span>Compression Level</span>
          <span id="slider-val-label">70%</span>
        </div>
        <input type="range" class="custom-range-slider" min="10" max="100" value="70" oninput="setImageQuality(this.value)">
      </div>
      <div class="form-group">
        <label class="form-label">Pre-configured Quality</label>
        <div class="preset-grid">
          <button class="preset-btn" onclick="setPresetQuality(30, this)">Small File (30%)</button>
          <button class="preset-btn active" onclick="setPresetQuality(70, this)">Medium (70%)</button>
          <button class="preset-btn" onclick="setPresetQuality(95, this)">High Quality (95%)</button>
        </div>
      </div>
      <div class="form-group">
        <label class="form-label" for="opt-image-output">Output format</label>
        <select id="opt-image-output" class="form-input-text">
          <option value="image/jpeg">JPG</option>
          <option value="image/webp">WebP</option>
          <option value="image/png">PNG</option>
        </select>
      </div>
    `;
    // Initialize defaults
    appState.activeToolOptions.quality = 0.7;
  } else if (toolId === 'resize-image') {
    accepts = 'image/*';
    multiple = true;
    optionsHTML = `
      <div class="form-group">
        <label class="form-label">Dimensions Target</label>
        <div style="display:flex; gap:10px; align-items:center;">
          <input type="number" id="opt-width" class="form-input-text" style="width:100px;" value="1080" onchange="appState.activeToolOptions.width = this.value">
          <span>×</span>
          <input type="number" id="opt-height" class="form-input-text" style="width:100px;" value="1080" onchange="appState.activeToolOptions.height = this.value">
          <span>px</span>
        </div>
      </div>
      <div class="checkbox-group">
        <label class="checkbox-label">
          <input type="checkbox" id="opt-aspect" checked onchange="appState.activeToolOptions.aspect = this.checked">
          <div class="custom-checkbox"></div>
          Lock aspect ratio
        </label>
        <label class="checkbox-label">
          <input type="checkbox" id="opt-prevent-upscale" checked>
          <div class="custom-checkbox"></div>
          Prevent upscaling
        </label>
      </div>
      <div class="form-group">
        <label class="form-label" for="opt-resize-percent">Percentage scale</label>
        <input type="number" id="opt-resize-percent" class="form-input-text" min="1" max="1000" value="100">
        <p style="font-size:10px; color:var(--color-text-secondary); margin-top:4px;">Set a value other than 100% to scale from the original dimensions.</p>
      </div>
      <div class="form-group">
        <label class="form-label" for="opt-resize-output">Output format</label>
        <select id="opt-resize-output" class="form-input-text">
          <option value="keep">Keep source format</option><option value="image/jpeg">JPG</option>
          <option value="image/png">PNG</option><option value="image/webp">WebP</option>
        </select>
      </div>
    `;
    appState.activeToolOptions.width = 1080;
    appState.activeToolOptions.height = 1080;
    appState.activeToolOptions.aspect = true;
  } else if (toolId === 'crop-image') {
    accepts = 'image/*';
    multiple = false;
    optionsHTML = `
      <div class="form-group">
        <label class="form-label">Crop Aspect Ratio</label>
        <div class="preset-grid">
          <button class="preset-btn active" onclick="setCropRatio('1:1', this)">1:1 Square</button>
          <button class="preset-btn" onclick="setCropRatio('16:9', this)">16:9 Cinema</button>
          <button class="preset-btn" onclick="setCropRatio('4:3', this)">4:3 Classic</button>
        </div>
      </div>
    `;
    appState.activeToolOptions.ratio = '1:1';
  } else if (toolId === 'background-remover') {
    accepts = 'image/jpeg,image/png,image/webp';
    multiple = false;
    optionsHTML = `
      <div class="form-group">
        <label class="form-label">Processing</label>
        <select id="opt-bg-engine" class="form-input-text" style="background:var(--color-surface); color:var(--color-text-primary);">
          <option value="best">Automatic background removal</option>
          <option value="compat">Browser compatibility mode</option>
        </select>
      </div>
      <p style="font-size:12px; color:var(--color-text-secondary); line-height:1.4; margin-top:5px;">
        Loads a local foreground segmentation model only for this tool. Your image is processed in the browser and opens in Advanced Cutout Studio with an editable alpha mask.
      </p>
    `;
  } else if (toolId === 'password-generator') {
    accepts = ''; // No files needed
    optionsHTML = `
      <div class="slider-container">
        <div class="slider-header">
          <span>Password Length</span>
          <span id="slider-pw-len">16</span>
        </div>
        <input type="range" class="custom-range-slider" min="6" max="64" value="16" oninput="setPwLength(this.value)">
      </div>
      <div class="checkbox-group">
        <label class="checkbox-label">
          <input type="checkbox" id="pw-upper" checked onchange="generatePassword()">
          <div class="custom-checkbox"></div>
          Uppercase Letters (A-Z)
        </label>
        <label class="checkbox-label">
          <input type="checkbox" id="pw-lower" checked onchange="generatePassword()">
          <div class="custom-checkbox"></div>
          Lowercase Letters (a-z)
        </label>
        <label class="checkbox-label">
          <input type="checkbox" id="pw-nums" checked onchange="generatePassword()">
          <div class="custom-checkbox"></div>
          Numbers (0-9)
        </label>
        <label class="checkbox-label">
          <input type="checkbox" id="pw-syms" checked onchange="generatePassword()">
          <div class="custom-checkbox"></div>
          Symbols (!@#$%^&*)
        </label>
      </div>
    `;
    appState.activeToolOptions.length = 16;
  } else if (toolId === 'barcode-generator') {
    accepts = ''; // No files needed
    optionsHTML = `
      <div class="form-group">
        <label class="form-label">Data Value / Text Link</label>
        <input type="text" id="bc-text" class="form-input-text" value="https://example.com" oninput="generateBarcodeSVG()">
      </div>
      <div class="form-group">
        <label class="form-label">Barcode Format</label>
        <div class="preset-grid">
          <button class="preset-btn active" onclick="setBcFormat('qr', this)">QR Code</button>
          <button class="preset-btn" onclick="setBcFormat('code128', this)">Code 128</button>
        </div>
      </div>
      <div class="form-group">
        <label class="form-label">Foreground presets</label>
        <div class="swatches-grid">
          <button class="swatch-btn active" style="background-color:#000000;" onclick="setBcColor('#000000', this)"></button>
          <button class="swatch-btn" style="background-color:#2563EB;" onclick="setBcColor('#2563EB', this)"></button>
          <button class="swatch-btn" style="background-color:#10B981;" onclick="setBcColor('#10B981', this)"></button>
          <button class="swatch-btn" style="background-color:#EF4444;" onclick="setBcColor('#EF4444', this)"></button>
          <button class="swatch-btn" style="background-color:#8B5CF6;" onclick="setBcColor('#8B5CF6', this)"></button>
        </div>
      </div>
      <div class="form-group">
        <div class="slider-header"><label class="form-label" for="bc-size">Output size</label><span id="bc-size-value">256 px</span></div>
        <input type="range" id="bc-size" class="custom-range-slider" min="128" max="512" step="32" value="256" oninput="document.getElementById('bc-size-value').textContent = this.value + ' px'; generateBarcodeSVG()">
      </div>
      <div class="form-group">
        <div class="slider-header"><label class="form-label" for="bc-margin">Margin</label><span id="bc-margin-value">12 px</span></div>
        <input type="range" id="bc-margin" class="custom-range-slider" min="0" max="32" step="2" value="12" oninput="document.getElementById('bc-margin-value').textContent = this.value + ' px'; generateBarcodeSVG()">
      </div>
      <div class="code-color-grid">
        <label class="form-label" for="bc-foreground">Foreground<input type="color" id="bc-foreground" value="#000000" oninput="appState.activeToolOptions.color = this.value; generateBarcodeSVG()"></label>
        <label class="form-label" for="bc-background">Background<input type="color" id="bc-background" value="#ffffff" oninput="generateBarcodeSVG()"></label>
      </div>
    `;
    appState.activeToolOptions.format = 'qr';
    appState.activeToolOptions.color = '#000000';
  } else if (toolId === 'color-extractor') {
    accepts = 'image/*';
    multiple = false;
    optionsHTML = `
      <div class="form-group">
        <label class="form-label">Color Count limit</label>
        <div class="preset-grid">
          <button class="preset-btn active" onclick="setPaletteCount(5, this)">5 Colors</button>
          <button class="preset-btn" onclick="setPaletteCount(8, this)">8 Colors</button>
          <button class="preset-btn" onclick="setPaletteCount(10, this)">10 Colors</button>
        </div>
      </div>
    `;
    appState.activeToolOptions.count = 5;
  } else if (toolId === 'zip-manager') {
    accepts = '*';
    optionsHTML = `
      <div class="form-group">
        <label class="form-label">ZIP Name</label>
        <input type="text" id="opt-zipname" class="form-input-text" value="gxa-toolbox_bundle.zip">
      </div>
    `;
  } else if (toolId === 'split-pdf') {
    accepts = '.pdf';
    multiple = false;
    optionsHTML = `
      <div class="form-group">
        <label class="form-label">Split Mode</label>
        <div class="preset-grid" style="grid-template-columns: 1fr;">
          <button class="preset-btn active" onclick="setSplitMode('every', this)">Split every page</button>
          <button class="preset-btn" onclick="setSplitMode('range', this)">Custom ranges</button>
          <button class="preset-btn" onclick="setSplitMode('every-n', this)">Every N pages</button>
        </div>
      </div>
      <div class="form-group hidden" id="split-range-group">
        <label class="form-label">Output groups (e.g. 1-2, 3-5)</label>
        <input type="text" id="opt-split-range" class="form-input-text" placeholder="1-2, 3-5">
      </div>
      <div class="form-group hidden" id="split-every-n-group">
        <label class="form-label">Pages per output PDF</label>
        <input type="number" id="opt-split-every-n" class="form-input-text" min="1" max="500" value="2">
      </div>
    `;
    appState.activeToolOptions.mode = 'every';
  } else if (toolId === 'protect-pdf') {
    accepts = '.pdf';
    multiple = false;
    optionsHTML = `
      <div class="form-group">
        <label class="form-label">Password Lock</label>
        <input type="password" id="opt-protect-pass" class="form-input-text" placeholder="Set Password">
      </div>
      <div class="form-group">
        <label class="form-label">Confirm Password</label>
        <input type="password" id="opt-protect-confirm" class="form-input-text" placeholder="Confirm Password">
      </div>
    `;
  } else if (toolId === 'unlock-pdf') {
    accepts = '.pdf';
    multiple = false;
    optionsHTML = `
      <div class="form-group">
        <label class="form-label">Enter Passcode</label>
        <input type="password" id="opt-unlock-pass" class="form-input-text" placeholder="Enter Password">
      </div>
    `;
  } else if (toolId === 'pdf-to-jpg') {
    accepts = '.pdf';
    multiple = false;
    optionsHTML = `
      <div class="form-group">
        <label class="form-label">Format Output</label>
        <div class="preset-grid">
          <button class="preset-btn active" onclick="setExportFormat('jpg', this)">JPG</button>
          <button class="preset-btn" onclick="setExportFormat('png', this)">PNG</button>
        </div>
      </div>
    `;
    appState.activeToolOptions.format = 'jpg';
  } else if (toolId === 'jpg-to-pdf') {
    accepts = 'image/*';
    multiple = true;
    optionsHTML = `
      <div class="form-group">
        <label class="form-label">Page Setup</label>
        <div class="preset-grid">
          <button class="preset-btn active" onclick="setPageSetup('a4', this)">A4 Size</button>
          <button class="preset-btn" onclick="setPageSetup('letter', this)">Letter Size</button>
        </div>
      </div>
      <div class="form-group">
        <label class="form-label">Orientation</label>
        <div class="preset-grid">
          <button class="preset-btn active" onclick="setOrientation('portrait', this)">Portrait</button>
          <button class="preset-btn" onclick="setOrientation('landscape', this)">Landscape</button>
        </div>
      </div>
    `;
    appState.activeToolOptions.setup = 'a4';
    appState.activeToolOptions.orientation = 'portrait';
  } else if (toolId === 'word-to-pdf') {
    accepts = '.txt,.docx';
    multiple = false;
    optionsHTML = `
      <div class="backend-warning-banner" style="background: rgba(245, 158, 11, 0.1); border: 1px dashed var(--color-warning); border-radius: var(--radius-md); padding: 12px; margin-bottom: 15px; display: flex; gap: 8px; align-items: flex-start; color: var(--color-warning);">
        <i data-lucide="alert-triangle" style="width: 18px; height: 18px; shrink: 0; margin-top: 2px;"></i>
        <span style="font-size: 12px; line-height: 1.4; font-weight: 500;">
          DOCX is converted from its semantic content. Complex Word pagination, floating objects, and exact fonts may differ. Legacy .doc files are not accepted.
        </span>
      </div>
      <div class="form-group">
        <label class="form-label">Document Font</label>
        <div class="preset-grid">
          <button class="preset-btn active" onclick="setDocFont('Helvetica', this)">Helvetica</button>
          <button class="preset-btn" onclick="setDocFont('Times-Roman', this)">Times Roman</button>
        </div>
      </div>
    `;
    appState.activeToolOptions.font = 'Helvetica';
  } else if (toolId === 'pdf-to-word') {
    accepts = '.pdf';
    multiple = false;
    optionsHTML = `
      <div class="backend-warning-banner" style="background: rgba(245, 158, 11, 0.1); border: 1px dashed var(--color-warning); border-radius: var(--radius-md); padding: 12px; margin-bottom: 15px; display: flex; gap: 8px; align-items: flex-start; color: var(--color-warning);">
        <i data-lucide="alert-triangle" style="width: 18px; height: 18px; shrink: 0; margin-top: 2px;"></i>
        <span style="font-size: 12px; line-height: 1.4; font-weight: 500;">
          This browser tool extracts selectable text. It does not preserve the original page layout, images, or tables.
        </span>
      </div>
      <div class="form-group">
        <label class="form-label">Output Format</label>
        <div class="preset-grid">
          <button class="preset-btn active" onclick="setDocOutput('txt', this)">Plain Text</button>
          <button class="preset-btn" onclick="setDocOutput('rtf', this)">Rich Text (RTF)</button>
        </div>
      </div>
    `;
    appState.activeToolOptions.output = 'txt';
  } else if (toolId === 'epub-to-pdf') {
    accepts = '.epub';
    multiple = false;
    optionsHTML = `
      <div class="form-group">
        <label class="form-label">Output Setup</label>
        <div class="preset-grid">
          <button class="preset-btn active" onclick="setEpubSetup('a4', this)">A4 Portrait</button>
        </div>
      </div>
      <p class="processing-disclosure">Reflowable EPUB chapter text is paginated locally. Fixed-layout books, scripts, custom fonts, and advanced CSS are simplified.</p>
    `;
  } else if (toolId === 'pdf-to-epub') {
    accepts = '.pdf';
    multiple = false;
    optionsHTML = `
      <div class="form-group">
        <label class="form-label">Ebook Title</label>
        <input type="text" id="epub-title" class="form-input-text" value="My Epub Ebook">
      </div>
      <p class="processing-disclosure">Selectable PDF text is reflowed into EPUB chapters. Exact PDF page geometry, complex tables, and image-only pages are not reconstructed.</p>
      <div class="form-group">
        <label class="form-label">Author Name</label>
        <input type="text" id="epub-author" class="form-input-text" value="GXA Technologies">
      </div>
    `;
  } else if (toolId === 'gif-maker') {
    accepts = 'image/*';
    multiple = true;
    optionsHTML = `
      <div class="slider-container">
        <div class="slider-header">
          <span>Frame Speed</span>
          <span id="slider-gif-speed">500ms</span>
        </div>
        <input type="range" class="custom-range-slider" min="100" max="2000" step="100" value="500" oninput="setGifSpeed(this.value)">
      </div>
    `;
    appState.activeToolOptions.speed = 500;
  } else if (toolId === 'zip-extractor') {
    accepts = '.zip';
    multiple = false;
    optionsHTML = `
      <p style="font-size:12px; color:var(--color-text-secondary);">Load a ZIP folder to extract files locally inside your browser cache.</p>
    `;
  } else if (toolId === 'compress-pdf') {
    accepts = '.pdf';
    multiple = false;
    optionsHTML = `
      <div class="processing-disclosure">
        Lossless structural optimization only. Images are not downsampled and no reduction percentage is promised. If the generated file is not smaller, no misleading result is offered.
      </div>
    `;
  } else if (toolId === 'rotate-pdf') {
    accepts = '.pdf';
    multiple = false;
    optionsHTML = `
      <div class="form-group">
        <label class="form-label">Rotation Angle</label>
        <div class="preset-grid">
          <button class="preset-btn active" onclick="setOptAngle(90, this)">90° CW</button>
          <button class="preset-btn" onclick="setOptAngle(180, this)">180°</button>
          <button class="preset-btn" onclick="setOptAngle(270, this)">270° CCW</button>
        </div>
      </div>
    `;
    appState.activeToolOptions.angle = 90;
  } else if (toolId === 'watermark-pdf') {
    accepts = '.pdf';
    multiple = false;
    optionsHTML = `
      <section class="watermark-studio" data-watermark-type="text" aria-label="Watermark controls">
        <fieldset class="watermark-type-picker">
          <legend>Watermark type</legend>
          <div class="watermark-type-options" role="group" aria-label="Choose watermark type">
            <button type="button" class="watermark-type-button active" data-wm-type="text" aria-pressed="true"><i data-lucide="type"></i><span>Text</span></button>
            <button type="button" class="watermark-type-button" data-wm-type="image" aria-pressed="false"><i data-lucide="image"></i><span>Image / logo</span></button>
            <button type="button" class="watermark-type-button" data-wm-type="symbol" aria-pressed="false"><i data-lucide="badge-check"></i><span>Icon / symbol</span></button>
          </div>
        </fieldset>

        <div class="watermark-source-panel" data-wm-panel="text">
          <label class="form-label" for="opt-wm-text">Watermark text</label>
          <textarea id="opt-wm-text" class="form-input-text watermark-text-input" maxlength="160" rows="2">CONFIDENTIAL</textarea>
          <div class="watermark-presets" role="group" aria-label="Text watermark presets">
            <button type="button" data-wm-text="CONFIDENTIAL">Confidential</button>
            <button type="button" data-wm-text="DRAFT">Draft</button>
            <button type="button" data-wm-text="COPY">Copy</button>
            <button type="button" data-wm-text="INTERNAL">Internal</button>
            <button type="button" data-wm-text="GXA Toolbox">GXA Toolbox</button>
          </div>
          <div class="watermark-control-grid">
            <label class="form-label" for="opt-wm-font">Font family
              <select id="opt-wm-font" class="form-input-text"><option value="helvetica">Helvetica</option><option value="times">Times</option><option value="courier">Courier</option></select>
            </label>
            <label class="form-label" for="opt-wm-font-size">Size (pt)
              <input id="opt-wm-font-size" type="number" class="form-input-text" min="8" max="160" value="40">
            </label>
            <label class="form-label watermark-color-control" for="opt-wm-color">Color
              <input id="opt-wm-color" type="color" value="#334155">
            </label>
            <label class="checkbox-label watermark-bold-control"><input id="opt-wm-bold" type="checkbox"><span class="custom-checkbox"></span>Bold text</label>
          </div>
          <label class="watermark-range-row"><span>Letter spacing <output id="opt-wm-letter-spacing-output">0 pt</output></span><input id="opt-wm-letter-spacing" type="range" min="0" max="12" step="0.5" value="0"></label>
        </div>

        <div class="watermark-source-panel hidden" data-wm-panel="image">
          <label class="form-label" for="opt-wm-image">Choose image or logo</label>
          <input id="opt-wm-image" class="form-input-text" type="file" accept=".png,.jpg,.jpeg,.webp,.svg,image/png,image/jpeg,image/webp,image/svg+xml">
          <div id="watermark-image-status" class="watermark-image-status" aria-live="polite">PNG, JPG, WebP, or a sanitized SVG. Transparent PNG logos are preserved.</div>
          <div class="watermark-control-grid watermark-image-dimensions">
            <label class="form-label" for="opt-wm-image-width">Width (pt)<input id="opt-wm-image-width" type="number" class="form-input-text" min="12" max="1000" value="160"></label>
            <label class="form-label" for="opt-wm-image-height">Height (pt)<input id="opt-wm-image-height" type="number" class="form-input-text" min="12" max="1000" value="160"></label>
            <label class="checkbox-label watermark-lock-control"><input id="opt-wm-image-lock" type="checkbox" checked><span class="custom-checkbox"></span>Keep proportions</label>
            <label class="watermark-scale-control">Scale <output id="opt-wm-image-scale-output">100%</output><input id="opt-wm-image-scale" type="range" min="10" max="200" value="100"></label>
          </div>
        </div>

        <div class="watermark-source-panel hidden" data-wm-panel="symbol">
          <label class="form-label" for="opt-wm-symbol">Icon or symbol</label>
          <select id="opt-wm-symbol" class="form-input-text">
            <option value="check">Check mark</option><option value="cross">Cross</option><option value="star">Star</option><option value="copyright" selected>Copyright</option>
            <option value="registered">Registered</option><option value="trademark">Trademark</option><option value="warning">Warning</option><option value="lock">Lock</option>
            <option value="approved">APPROVED stamp</option><option value="confidential">CONFIDENTIAL stamp</option>
          </select>
          <p class="watermark-inline-help">Built-in marks are created locally and embedded in the exported PDF.</p>
        </div>

        <fieldset class="watermark-placement">
          <legend>Position</legend>
          <div class="watermark-position-grid" role="group" aria-label="Watermark position">
            <button type="button" data-wm-position="top-left" aria-label="Top left">↖</button><button type="button" data-wm-position="top-center" aria-label="Top center">↑</button><button type="button" data-wm-position="top-right" aria-label="Top right">↗</button>
            <button type="button" data-wm-position="middle-left" aria-label="Middle left">←</button><button type="button" class="active" data-wm-position="center" aria-label="Center">•</button><button type="button" data-wm-position="middle-right" aria-label="Middle right">→</button>
            <button type="button" data-wm-position="bottom-left" aria-label="Bottom left">↙</button><button type="button" data-wm-position="bottom-center" aria-label="Bottom center">↓</button><button type="button" data-wm-position="bottom-right" aria-label="Bottom right">↘</button>
          </div>
          <small id="watermark-position-label">Center</small>
          <div class="watermark-offset-grid">
            <label class="watermark-range-row"><span>Horizontal offset <output id="opt-wm-offset-x-output">50%</output></span><input id="opt-wm-offset-x" type="range" min="0" max="100" value="50"></label>
            <label class="watermark-range-row"><span>Vertical offset <output id="opt-wm-offset-y-output">50%</output></span><input id="opt-wm-offset-y" type="range" min="0" max="100" value="50"></label>
          </div>
        </fieldset>

        <label class="watermark-range-row"><span>Opacity <output id="opt-wm-opacity-output">30%</output></span><input id="opt-wm-opacity" type="range" min="5" max="100" value="30"></label>
        <label class="watermark-range-row"><span>Rotation <output id="opt-wm-rotation-output">45°</output></span><input id="opt-wm-rotation" type="range" min="-180" max="180" value="45"></label>

        <fieldset class="watermark-pages">
          <legend>Apply to pages</legend>
          <label class="form-label" for="opt-wm-pages">Page selection
            <select id="opt-wm-pages" class="form-input-text"><option value="all">All pages</option><option value="current">Current preview page</option><option value="first">First page</option><option value="last">Last page</option><option value="odd">Odd pages</option><option value="even">Even pages</option><option value="custom">Custom range</option></select>
          </label>
          <label id="opt-wm-custom-pages-wrap" class="form-label hidden" for="studio-pdf-page-selection">Custom pages or ranges
            <input id="studio-pdf-page-selection" class="form-input-text" type="text" inputmode="text" placeholder="For example: 2-4, 8" aria-describedby="opt-wm-custom-pages-help">
          </label>
          <small id="opt-wm-custom-pages-help">Use commas and ranges, for example 2-4, 8. PDF thumbnail selection switches this to custom.</small>
        </fieldset>

        <label class="checkbox-label watermark-tile-control"><input id="opt-wm-tile" type="checkbox"><span class="custom-checkbox"></span>Repeat as a tiled watermark</label>
        <label id="opt-wm-tile-spacing-wrap" class="watermark-range-row hidden"><span>Tile spacing <output id="opt-wm-tile-spacing-output">72 pt</output></span><input id="opt-wm-tile-spacing" type="range" min="24" max="240" value="72"></label>
        <p class="watermark-inline-help">The live overlay previews the selected page. Applying the watermark creates a new PDF; source files remain unchanged. Watermarks are placed above document content.</p>
      </section>
    `;
    appState.activeToolOptions.opacity = 0.3;
  } else if (toolId === 'pagenumber-pdf') {
    accepts = '.pdf';
    multiple = false;
    optionsHTML = `
      <div class="form-group">
        <label class="form-label">Position</label>
        <select id="opt-pn-pos" class="form-input-text" style="background:var(--color-surface); color:var(--color-text-primary);">
          <option value="bottom-center">Bottom Center</option>
          <option value="bottom-right">Bottom Right</option>
          <option value="top-center">Top Center</option>
        </select>
      </div>
      <div style="display:grid; grid-template-columns:1fr 1fr; gap:8px;">
        <label class="form-label">Start number<input id="opt-pn-start" type="number" class="form-input-text" min="0" value="1"></label>
        <label class="form-label">Font size<input id="opt-pn-size" type="number" class="form-input-text" min="6" max="72" value="10"></label>
      </div>
      <div style="display:grid; grid-template-columns:1fr 1fr; gap:8px; margin-top:10px;">
        <label class="form-label">Prefix<input id="opt-pn-prefix" type="text" class="form-input-text" value="Page "></label>
        <label class="form-label">Suffix<input id="opt-pn-suffix" type="text" class="form-input-text" placeholder="Optional"></label>
      </div>
      <label class="checkbox-label" style="margin-top:10px;"><input id="opt-pn-skip-first" type="checkbox"><span class="custom-checkbox"></span>Skip first page</label>
    `;
  } else if (toolId === 'pdf-metadata') {
    accepts = '.pdf';
    multiple = false;
    optionsHTML = `
      <div class="form-group">
        <label class="form-label">Document Title</label>
        <input type="text" id="opt-meta-title" class="form-input-text" placeholder="Title">
      </div>
      <div class="form-group">
        <label class="form-label">Author Name</label>
        <input type="text" id="opt-meta-author" class="form-input-text" placeholder="Author Name">
      </div>
      <div class="form-group">
        <label class="form-label">Subject</label>
        <input type="text" id="opt-meta-subject" class="form-input-text" placeholder="Document subject">
      </div>
      <div class="form-group">
        <label class="form-label">Keywords</label>
        <input type="text" id="opt-meta-keywords" class="form-input-text" placeholder="Comma-separated keywords">
      </div>
      <div id="pdf-source-metadata" class="pdf-source-metadata" aria-live="polite">Upload a PDF to inspect its existing metadata.</div>
    `;
  } else if (toolId === 'excel-to-pdf') {
    accepts = '.csv,.xlsx,.xls';
    multiple = false;
    optionsHTML = `
      <p class="processing-disclosure">Workbook cells are rendered as readable PDF tables. Excel print layouts, macros, charts, and formula recalculation are not reproduced.</p>
    `;
  } else if (toolId === 'ppt-to-pdf') {
    accepts = '.txt,.ppt,.pptx';
    multiple = false;
    optionsHTML = `
      <p class="processing-disclosure">Presentation layout conversion is unavailable in this deployment. Your source file is not processed.</p>
    `;
  } else if (toolId === 'pdf-to-text') {
    accepts = '.pdf';
    multiple = false;
    optionsHTML = `
      <p style="font-size:12px; color:var(--color-text-secondary);">Convert your PDF sheets into structured plain text characters.</p>
    `;
  } else if (toolId === 'html-to-pdf') {
    accepts = '.html';
    multiple = false;
    optionsHTML = `
      <div class="form-group">
        <label class="form-label">HTML Code Input (Optional)</label>
        <textarea id="opt-html-raw" class="form-input-text" style="height:120px; font-family:var(--font-mono); font-size:11px;" placeholder="&lt;h1&gt;Hello World&lt;/h1&gt;"></textarea>
      </div>
    `;
  } else if (toolId === 'pdf-to-html') {
    accepts = '.pdf';
    multiple = false;
    optionsHTML = `
      <p style="font-size:12px; color:var(--color-text-secondary);">Extract layouts and content to a HTML markup file structure.</p>
    `;
  } else if (toolId === 'markdown-to-pdf') {
    accepts = '.md';
    multiple = false;
    optionsHTML = `
      <div class="form-group">
        <label class="form-label">Markdown Input (Optional)</label>
        <textarea id="opt-md-raw" class="form-input-text" style="height:120px; font-family:var(--font-mono); font-size:11px;" placeholder="# Heading 1\nSome paragraph text."></textarea>
      </div>
    `;
  } else if (toolId === 'pdf-to-markdown') {
    accepts = '.pdf';
    multiple = false;
    optionsHTML = `
      <p style="font-size:12px; color:var(--color-text-secondary);">Extract standard headings and text to clean Markdown files.</p>
    `;
  } else if (toolId === 'svg-to-png') {
    accepts = '.svg';
    multiple = false;
    optionsHTML = `
      <div class="form-group">
        <label class="form-label">Export Width (Pixels)</label>
        <input type="number" id="opt-svg-width" class="form-input-text" value="1024">
      </div>
    `;
  } else if (toolId === 'png-to-svg') {
    accepts = 'image/*';
    multiple = false;
    optionsHTML = `
      <p style="font-size:12px; color:var(--color-text-secondary);">Wrap raster images into scalable vector SVG markup code.</p>
    `;
  } else if (toolId === 'webp-to-jpg') {
    accepts = 'image/webp';
    multiple = true;
    optionsHTML = `
      <div class="form-group">
        <label class="form-label">Output Format</label>
        <select id="opt-webp-out" class="form-input-text" style="background:var(--color-surface); color:var(--color-text-primary);">
          <option value="jpg">JPG</option>
          <option value="png">PNG</option>
        </select>
      </div>
    `;
  } else if (toolId === 'gif-to-png') {
    accepts = 'image/gif';
    multiple = false;
    optionsHTML = `
      <p style="font-size:12px; color:var(--color-text-secondary);">Extract and download sequence frames contained inside the GIF.</p>
    `;
  } else if (toolId === 'text-to-speech') {
    accepts = '.txt,.pdf';
    multiple = false;
    optionsHTML = `
      <div class="form-group">
        <label class="form-label">Text to Speak</label>
        <textarea id="opt-speech-text" class="form-input-text" style="height:100px;">Hello, welcome to GXA Toolbox speech synthesis. Drag a file or write text here to read aloud.</textarea>
      </div>
      <div class="form-group">
        <label class="form-label">Import Text File</label>
        <input type="file" class="form-input-text" style="padding:4px;" accept=".txt,.pdf,.md" onchange="importFileContentToTextarea('opt-speech-text', this)">
      </div>
      <div class="form-group">
        <label class="form-label">Voice Rate</label>
        <input type="range" id="opt-speech-rate" class="custom-range-slider" min="0.5" max="2" step="0.1" value="1">
      </div>
    `;
  } else if (toolId === 'qr-reader') {
    accepts = 'image/*';
    multiple = false;
    optionsHTML = `
      <p style="font-size:12px; color:var(--color-text-secondary);">Upload QR graphics to extract text and links instantly.</p>
    `;
  } else if (toolId === 'barcode-reader') {
    accepts = 'image/*';
    multiple = false;
    optionsHTML = `
      <p style="font-size:12px; color:var(--color-text-secondary);">Upload image scan to read horizontal 1D barcode tags.</p>
    `;
  } else if (toolId === 'base64-tool') {
    accepts = '*';
    multiple = false;
    optionsHTML = `
      <div class="form-group">
        <label class="form-label">Operation</label>
        <div class="preset-grid">
          <button class="preset-btn active" onclick="setBase64Mode('encode', this)">Encode</button>
          <button class="preset-btn" onclick="setBase64Mode('decode', this)">Decode</button>
        </div>
      </div>
      <div class="form-group">
        <label class="form-label">Text Input (Optional)</label>
        <textarea id="opt-b64-raw" class="form-input-text" style="height:80px;"></textarea>
      </div>
      <div class="form-group">
        <label class="form-label">Or Import File</label>
        <input type="file" class="form-input-text" style="padding:4px;" onchange="importFileContentToTextarea('opt-b64-raw', this, 'base64')">
      </div>
    `;
    appState.activeToolOptions.mode = 'encode';
  } else if (toolId === 'url-tool') {
    accepts = '';
    multiple = false;
    optionsHTML = `
      <div class="form-group">
        <label class="form-label">Operation</label>
        <div class="preset-grid">
          <button class="preset-btn active" onclick="setUrlMode('encode', this)">Encode</button>
          <button class="preset-btn" onclick="setUrlMode('decode', this)">Decode</button>
        </div>
      </div>
      <div class="form-group">
        <label class="form-label">URL / Parameters</label>
        <textarea id="opt-url-text" class="form-input-text" style="height:100px;" placeholder="Write text here..."></textarea>
      </div>
    `;
    appState.activeToolOptions.mode = 'encode';
  } else if (toolId === 'json-tool') {
    accepts = '.json';
    multiple = false;
    optionsHTML = `
      <div class="form-group">
        <label class="form-label">Operation</label>
        <div class="preset-grid">
          <button class="preset-btn active" onclick="setJsonMode('beautify', this)">Beautify</button>
          <button class="preset-btn" onclick="setJsonMode('minify', this)">Minify</button>
        </div>
      </div>
      <div class="form-group">
        <label class="form-label">Raw JSON String</label>
        <textarea id="opt-json-raw" class="form-input-text" style="height:100px; font-family:var(--font-mono); font-size:11px;" placeholder='{"key":"value"}'></textarea>
      </div>
      <div class="form-group">
        <label class="form-label">Or Import JSON File</label>
        <input type="file" class="form-input-text" style="padding:4px;" accept=".json" onchange="importFileContentToTextarea('opt-json-raw', this)">
      </div>
    `;
    appState.activeToolOptions.mode = 'beautify';
  } else if (toolId === 'hash-tool') {
    accepts = '*';
    multiple = false;
    optionsHTML = `
      <div class="form-group">
        <label class="form-label">Hash Algorithm</label>
        <select id="opt-hash-algo" class="form-input-text" style="background:var(--color-surface); color:var(--color-text-primary);">
          <option value="SHA-256">SHA-256</option>
          <option value="SHA-1">SHA-1</option>
          <option value="SHA-384">SHA-384</option>
          <option value="SHA-512">SHA-512</option>
        </select>
      </div>
      <div class="form-group">
        <label class="form-label">Raw Text Input (Optional)</label>
        <textarea id="opt-hash-text" class="form-input-text" style="height:80px;" placeholder="Or type text to hash..."></textarea>
      </div>
      <div class="form-group">
        <label class="form-label">Or Import File to Hash</label>
        <input type="file" class="form-input-text" style="padding:4px;" onchange="importFileForHashing(this)">
      </div>
    `;
  } else if (toolId === 'case-converter') {
    accepts = '';
    multiple = false;
    optionsHTML = `
      <div class="form-group">
        <label class="form-label">Target Case</label>
        <select id="opt-case-type" class="form-input-text" style="background:var(--color-surface); color:var(--color-text-primary);">
          <option value="upper">UPPERCASE</option>
          <option value="lower">lowercase</option>
          <option value="title">Title Case</option>
          <option value="sentence">Sentence case</option>
          <option value="camel">camelCase</option>
          <option value="kebab">kebab-case</option>
        </select>
      </div>
      <div class="form-group">
        <label class="form-label">Text to Convert</label>
        <textarea id="opt-case-text" class="form-input-text" style="height:100px;" placeholder="Type text..."></textarea>
      </div>
    `;
  } else if (toolId === 'word-counter') {
    accepts = '.txt';
    multiple = false;
    optionsHTML = `
      <div class="form-group">
        <label class="form-label">Text Input (Optional)</label>
        <textarea id="opt-wc-text" class="form-input-text" style="height:120px;" placeholder="Or paste text..."></textarea>
      </div>
      <div class="form-group">
        <label class="form-label">Or Import File</label>
        <input type="file" class="form-input-text" style="padding:4px;" accept=".txt,.md,.html,.xml,.json,.css,.js" onchange="importFileContentToTextarea('opt-wc-text', this)">
      </div>
    `;
  } else if (toolId === 'lorem-ipsum') {
    accepts = '';
    multiple = false;
    optionsHTML = `
      <div class="form-group">
        <label class="form-label">Paragraph Count</label>
        <input type="number" id="opt-lorem-count" class="form-input-text" value="3" min="1" max="50">
      </div>
    `;
  } else if (toolId === 'diff-checker') {
    accepts = '';
    multiple = false;
    optionsHTML = `
      <div class="form-group">
        <label class="form-label">Original Text</label>
        <textarea id="opt-diff-orig" class="form-input-text" style="height:60px;" placeholder="Original..."></textarea>
      </div>
      <div class="form-group">
        <label class="form-label">Modified Text</label>
        <textarea id="opt-diff-mod" class="form-input-text" style="height:60px;" placeholder="Modified..."></textarea>
      </div>
    `;
  } else if (toolId === 'sql-formatter') {
    accepts = '';
    multiple = false;
    optionsHTML = `
      <div class="form-group">
        <label class="form-label">SQL Query</label>
        <textarea id="opt-sql-raw" class="form-input-text" style="height:120px; font-family:var(--font-mono);" placeholder="SELECT * FROM users WHERE active = 1"></textarea>
      </div>
      <div class="form-group">
        <label class="form-label">Or Import SQL File</label>
        <input type="file" class="form-input-text" style="padding:4px;" accept=".sql,.txt" onchange="importFileContentToTextarea('opt-sql-raw', this)">
      </div>
    `;
  } else if (toolId === 'xml-to-json') {
    accepts = '.xml';
    multiple = false;
    optionsHTML = `
      <div class="form-group">
        <label class="form-label">XML Input (Optional)</label>
        <textarea id="opt-xml-raw" class="form-input-text" style="height:120px; font-family:var(--font-mono);" placeholder="&lt;root&gt;&lt;child&gt;data&lt;/child&gt;&lt;/root&gt;"></textarea>
      </div>
      <div class="form-group">
        <label class="form-label">Or Import XML File</label>
        <input type="file" class="form-input-text" style="padding:4px;" accept=".xml" onchange="importFileContentToTextarea('opt-xml-raw', this)">
      </div>
    `;
  } else if (toolId === 'uuid-generator') {
    accepts = '';
    multiple = false;
    optionsHTML = `
      <div class="form-group">
        <label class="form-label">Number of UUIDs</label>
        <input type="number" id="opt-uuid-count" class="form-input-text" value="5" min="1" max="100">
      </div>
    `;
  } else if (toolId === 'user-agent') {
    accepts = '';
    multiple = false;
    optionsHTML = `
      <p style="font-size:12px; color:var(--color-text-secondary);">Analyze details of your client browser platform.</p>
    `;
  } else if (toolId === 'regex-tester') {
    accepts = '';
    multiple = false;
    optionsHTML = `
      <div class="form-group">
        <label class="form-label">RegEx Expression</label>
        <input type="text" id="opt-regex-exp" class="form-input-text" value="[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\\.[a-zA-Z]{2,}">
      </div>
      <div class="form-group">
        <label class="form-label">Flags</label>
        <input type="text" id="opt-regex-flags" class="form-input-text" value="gi">
      </div>
      <div class="form-group">
        <label class="form-label">Test Subject Text</label>
        <textarea id="opt-regex-subject" class="form-input-text" style="height:60px;">Contact support@example.com or admin@domain.com</textarea>
      </div>
    `;
  } else if (toolId === 'markdown-editor') {
    accepts = '';
    multiple = false;
    optionsHTML = `
      <div class="form-group">
        <label class="form-label">Markdown Input</label>
        <textarea id="opt-mde-raw" class="form-input-text" style="height:120px; font-family:var(--font-mono);" placeholder="# Title\nWrite content..."></textarea>
      </div>
    `;
  } else if (toolId === 'css-beautifier') {
    accepts = '';
    multiple = false;
    optionsHTML = `
      <div class="form-group">
        <label class="form-label">CSS Script</label>
        <textarea id="opt-css-raw" class="form-input-text" style="height:120px; font-family:var(--font-mono);" placeholder="body{margin:0;padding:0;}"></textarea>
      </div>
    `;
  } else if (toolId === 'js-beautifier') {
    accepts = '';
    multiple = false;
    optionsHTML = `
      <div class="form-group">
        <label class="form-label">JS Code</label>
        <textarea id="opt-js-raw" class="form-input-text" style="height:120px; font-family:var(--font-mono);" placeholder="function test(){console.log('test')}"></textarea>
      </div>
    `;
  } else if (toolId === 'html-beautifier') {
    accepts = '';
    multiple = false;
    optionsHTML = `
      <div class="form-group">
        <label class="form-label">HTML Code</label>
        <textarea id="opt-html-beaut-raw" class="form-input-text" style="height:120px; font-family:var(--font-mono);" placeholder="&lt;div&gt;&lt;p&gt;test&lt;/p&gt;&lt;/div&gt;"></textarea>
      </div>
    `;
  } else if (toolId === 'cron-generator') {
    accepts = '';
    multiple = false;
    optionsHTML = `
      <div class="form-group">
        <label class="form-label">Cron Expression</label>
        <input type="text" id="opt-cron-exp" class="form-input-text" value="*/5 * * * *">
      </div>
    `;
  } else if (toolId === 'color-converter') {
    accepts = '';
    multiple = false;
    optionsHTML = `
      <div class="form-group">
        <label class="form-label">Color Code (HEX/RGB/HSL)</label>
        <input type="text" id="opt-color-val" class="form-input-text" value="#2563eb">
      </div>
    `;
  } else if (toolId === 'exif-viewer') {
    accepts = 'image/*';
    multiple = false;
    optionsHTML = `
      <p style="font-size:12px; color:var(--color-text-secondary);">Inspect only metadata that is actually present, then download a JSON report and metadata-free PNG copy.</p>
      <label class="checkbox-label"><input id="opt-exif-clean-copy" type="checkbox" checked><span class="custom-checkbox"></span>Include metadata-free PNG</label>
    `;
  } else if (toolId === 'timestamp-converter') {
    accepts = '';
    multiple = false;
    optionsHTML = `
      <div class="form-group">
        <label class="form-label">Timestamp (Epoch in sec)</label>
        <input type="number" id="opt-ts-val" class="form-input-text" value="1773446400" oninput="generateTimestampConvert()">
      </div>
      <div style="display:flex; gap:10px; margin-top:5px;">
        <button class="btn btn-ghost btn-sm" onclick="setTimestampCurrent()" style="flex:1;">Use Current Time</button>
      </div>
    `;
  } else if (toolId === 'ai-pdf-summarizer') {
    accepts = '.pdf';
    multiple = false;
    optionsHTML = `
      <div class="form-group">
        <label class="form-label">Summary Mode</label>
        <select id="opt-ai-summary-depth" class="form-input-text" style="background:var(--color-surface); color:var(--color-text-primary);">
          <option value="standard">Standard Summary</option>
          <option value="detailed">Extremely Detailed</option>
          <option value="bullets">Key Bullet Points Only</option>
        </select>
      </div>
    `;
  } else if (toolId === 'ai-pdf-translator') {
    accepts = '.pdf';
    multiple = false;
    optionsHTML = `
      <div class="form-group">
        <label class="form-label">Target Translation Language</label>
        <select id="opt-ai-trans-lang" class="form-input-text" style="background:var(--color-surface); color:var(--color-text-primary);">
          <option value="hindi">Hindi (हिन्दी)</option>
          <option value="arabic">Arabic (العربية)</option>
          <option value="french">French (Français)</option>
          <option value="german">German (Deutsch)</option>
          <option value="spanish">Spanish (Español)</option>
          <option value="japanese">Japanese (日本語)</option>
          <option value="korean">Korean (한국어)</option>
          <option value="chinese">Chinese (中文)</option>
          <option value="english">English</option>
        </select>
      </div>
    `;
  } else if (toolId === 'ai-resume-builder') {
    accepts = '';
    multiple = false;
    optionsHTML = `
      <div class="form-group" style="margin-bottom:12px;">
        <label class="form-label">Full Name</label>
        <input type="text" id="opt-res-name" class="form-input-text" placeholder="Tauqeer Ashraf">
      </div>
      <div style="display:grid; grid-template-columns:1fr 1fr; gap:10px; margin-bottom:12px;">
        <div class="form-group">
          <label class="form-label">Email Address</label>
          <input type="email" id="opt-res-email" class="form-input-text" placeholder="tauqeer@gxatechnologies.com">
        </div>
        <div class="form-group">
          <label class="form-label">Phone Number</label>
          <input type="text" id="opt-res-phone" class="form-input-text" placeholder="+91 99999 99999">
        </div>
      </div>
      <div class="form-group" style="margin-bottom:12px;">
        <label class="form-label">Location / Address</label>
        <input type="text" id="opt-res-loc" class="form-input-text" placeholder="New Delhi, India">
      </div>
      <div class="form-group" style="margin-bottom:12px;">
        <label class="form-label">Professional Summary</label>
        <textarea id="opt-res-summary" class="form-input-text" style="height:60px;" placeholder="Describe your career objective..."></textarea>
      </div>
      <div class="form-group" style="margin-bottom:12px;">
        <label class="form-label">Work Experience</label>
        <textarea id="opt-res-exp" class="form-input-text" style="height:60px;" placeholder="Job Details..."></textarea>
      </div>
      <div class="form-group" style="margin-bottom:12px;">
        <label class="form-label">Education Details</label>
        <textarea id="opt-res-edu" class="form-input-text" style="height:50px;" placeholder="Degree, Institution..."></textarea>
      </div>
      <div class="form-group" style="margin-bottom:15px;">
        <label class="form-label">Skills (Comma separated)</label>
        <input type="text" id="opt-res-skills" class="form-input-text" placeholder="JavaScript, Laravel">
      </div>
    `;
  } else if (toolId === 'bg-remover') {
    accepts = 'image/*';
    multiple = false;
    optionsHTML = `
      <p style="font-size:12px; color:var(--color-text-secondary);">Upload image to strip backgrounds using smart client-side canvas masks.</p>
    `;
  } else if (toolId === 'bulk-bg-remover') {
    accepts = 'image/*';
    multiple = true;
    optionsHTML = `
      <p style="font-size:12px; color:var(--color-text-secondary);">Batch background remover. Processes multiple files locally.</p>
    `;
  } else if (toolId === 'remove-spaces') {
    accepts = '';
    multiple = false;
    optionsHTML = `
      <div class="form-group">
        <label class="form-label">Text to Clean</label>
        <textarea id="opt-spaces-text" class="form-input-text" style="height:120px;" placeholder="Paste text here..."></textarea>
      </div>
    `;
  } else if (toolId === 'grammar-checker') {
    accepts = '';
    multiple = false;
    optionsHTML = `
      <div class="form-group">
        <label class="form-label">Text to Check</label>
        <textarea id="opt-grammar-text" class="form-input-text" style="height:120px;" placeholder="Type or paste text..."></textarea>
      </div>
    `;
  } else if (toolId === 'plagiarism-checker') {
    accepts = '';
    multiple = false;
    optionsHTML = `
      <div class="form-group">
        <label class="form-label">Text to Analyze</label>
        <textarea id="opt-plag-text" class="form-input-text" style="height:120px;" placeholder="Type or paste text..."></textarea>
      </div>
    `;
  } else if (toolId === 'calculator') {
    accepts = '';
    multiple = false;
    optionsHTML = `
      <div class="form-group">
        <label class="form-label">Keypad Operation</label>
        <p style="font-size:12px; color:var(--color-text-secondary); line-height:1.4;">Use the interactive visual keypad on the main screen to run calculations, or type directly using your keyboard numpad.</p>
      </div>
    `;
  } else if (toolId === 'scientific-calculator') {
    accepts = '';
    multiple = false;
    optionsHTML = `
      <div class="form-group">
        <label class="form-label">Advanced Functions</label>
        <p style="font-size:12px; color:var(--color-text-secondary); line-height:1.4;">Trigonometric functions expect angles in degrees. Parentheses can be used to group sub-expressions.</p>
      </div>
    `;
  } else if (toolId === 'percentage-calculator') {
    accepts = '';
    multiple = false;
    optionsHTML = `
      <div style="border-bottom:1px solid var(--color-border); padding-bottom:12px; margin-bottom:12px;">
        <label class="form-label" style="font-weight:700;">1. What is X% of Y?</label>
        <div style="display:flex; align-items:center; gap:8px; margin-top:5px;">
          <input type="number" id="opt-pct-val1" class="form-input-text" placeholder="15" style="width:70px; text-align:center;">
          <span style="font-size:12px;">% of</span>
          <input type="number" id="opt-pct-val2" class="form-input-text" placeholder="200" style="width:90px; text-align:center;">
        </div>
      </div>
      <div style="border-bottom:1px solid var(--color-border); padding-bottom:12px; margin-bottom:12px;">
        <label class="form-label" style="font-weight:700;">2. X is what % of Y?</label>
        <div style="display:flex; align-items:center; gap:8px; margin-top:5px;">
          <input type="number" id="opt-pct-a" class="form-input-text" placeholder="30" style="width:70px; text-align:center;">
          <span style="font-size:12px;">is what % of</span>
          <input type="number" id="opt-pct-b" class="form-input-text" placeholder="150" style="width:90px; text-align:center;">
        </div>
      </div>
      <div>
        <label class="form-label" style="font-weight:700;">3. Percentage Change</label>
        <div style="display:flex; align-items:center; gap:8px; margin-top:5px;">
          <span style="font-size:12px;">From</span>
          <input type="number" id="opt-pct-from" class="form-input-text" placeholder="100" style="width:70px; text-align:center;">
          <span style="font-size:12px;">to</span>
          <input type="number" id="opt-pct-to" class="form-input-text" placeholder="125" style="width:70px; text-align:center;">
        </div>
      </div>
    `;
  } else if (toolId === 'age-calculator') {
    accepts = '';
    multiple = false;
    optionsHTML = `
      <div class="form-group">
        <label class="form-label">Date of Birth</label>
        <input type="date" id="opt-age-dob" class="form-input-text">
      </div>
      <div class="form-group">
        <label class="form-label">Age at Date (Optional)</label>
        <input type="date" id="opt-age-target" class="form-input-text" value="">
      </div>
    `;
  } else if (toolId === 'date-calculator') {
    accepts = '';
    multiple = false;
    optionsHTML = `
      <div class="form-group">
        <label class="form-label">Start Date</label>
        <input type="date" id="opt-date-start" class="form-input-text">
      </div>
      <div class="form-group">
        <label class="form-label">Operation</label>
        <select id="opt-date-mode" class="form-input-text" style="background:var(--color-surface); color:var(--color-text-primary);">
          <option value="duration">Calculate Duration to another date</option>
          <option value="add">Add days/weeks/months/years</option>
          <option value="subtract">Subtract days/weeks/months/years</option>
        </select>
      </div>
      <div id="date-duration-group" class="form-group">
        <label class="form-label">End Date</label>
        <input type="date" id="opt-date-end" class="form-input-text">
      </div>
      <div id="date-offset-group" class="form-group hidden">
        <div style="display:grid; grid-template-columns:1fr 1fr; gap:10px;">
          <div>
            <label class="form-label">Amount</label>
            <input type="number" id="opt-date-offset" class="form-input-text" placeholder="30">
          </div>
          <div>
            <label class="form-label">Unit</label>
            <select id="opt-date-unit" class="form-input-text" style="background:var(--color-surface); color:var(--color-text-primary);">
              <option value="days">Days</option>
              <option value="weeks">Weeks</option>
              <option value="months">Months</option>
              <option value="years">Years</option>
            </select>
          </div>
        </div>
      </div>
    `;
  } else if (toolId === 'emi-calculator') {
    accepts = '';
    multiple = false;
    optionsHTML = `
      <div class="form-group">
        <label class="form-label">Loan Amount (₹)</label>
        <input type="number" id="opt-emi-amount" class="form-input-text" placeholder="e.g. 1000000" min="1">
      </div>
      <div class="form-group">
        <label class="form-label">Interest Rate (% P.A.)</label>
        <input type="number" id="opt-emi-rate" class="form-input-text" placeholder="e.g. 8.5" min="0.01" step="0.1">
      </div>
      <div class="form-group">
        <label class="form-label">Tenure (Years)</label>
        <input type="number" id="opt-emi-years" class="form-input-text" placeholder="e.g. 5" min="0.1" step="0.1">
      </div>
    `;
  } else if (toolId === 'loan-calculator') {
    accepts = '';
    multiple = false;
    optionsHTML = `
      <div class="form-group">
        <label class="form-label">Principal Amount (₹)</label>
        <input type="number" id="opt-loan-amount" class="form-input-text" placeholder="e.g. 500000" min="1">
      </div>
      <div class="form-group">
        <label class="form-label">Interest Rate (% P.A.)</label>
        <input type="number" id="opt-loan-rate" class="form-input-text" placeholder="e.g. 10" min="0.01" step="0.1">
      </div>
      <div class="form-group">
        <label class="form-label">Tenure (Months)</label>
        <input type="number" id="opt-loan-months" class="form-input-text" placeholder="e.g. 12" min="1">
      </div>
      <div class="form-group">
        <label class="form-label">Interest Type</label>
        <select id="opt-loan-type" class="form-input-text" style="background:var(--color-surface); color:var(--color-text-primary);">
          <option value="reducing">Reducing / Amortizing</option>
          <option value="flat">Flat Rate Interest</option>
        </select>
      </div>
    `;
  } else if (toolId === 'interest-calculator') {
    accepts = '';
    multiple = false;
    optionsHTML = `
      <div class="form-group">
        <label class="form-label">Principal Amount (₹)</label>
        <input type="number" id="opt-int-principal" class="form-input-text" placeholder="e.g. 10000" min="1">
      </div>
      <div class="form-group">
        <label class="form-label">Rate of Interest (% P.A.)</label>
        <input type="number" id="opt-int-rate" class="form-input-text" placeholder="e.g. 6.5" min="0.01" step="0.1">
      </div>
      <div class="form-group">
        <label class="form-label">Period (Years)</label>
        <input type="number" id="opt-int-years" class="form-input-text" placeholder="e.g. 3" min="0.1" step="0.1">
      </div>
      <div class="form-group">
        <label class="form-label">Interest Type</label>
        <select id="opt-int-type" class="form-input-text" style="background:var(--color-surface); color:var(--color-text-primary);">
          <option value="simple">Simple Interest</option>
          <option value="compound-yearly">Compound (Yearly)</option>
          <option value="compound-half">Compound (Half-Yearly)</option>
          <option value="compound-quarterly">Compound (Quarterly)</option>
          <option value="compound-monthly">Compound (Monthly)</option>
        </select>
      </div>
    `;
  } else if (toolId === 'gst-calculator') {
    accepts = '';
    multiple = false;
    optionsHTML = `
      <div class="form-group">
        <label class="form-label">Initial Amount (₹)</label>
        <input type="number" id="opt-gst-amount" class="form-input-text" placeholder="e.g. 1000" min="0">
      </div>
      <div class="form-group">
        <label class="form-label">GST Rate</label>
        <select id="opt-gst-rate" class="form-input-text" style="background:var(--color-surface); color:var(--color-text-primary);">
          <option value="5">5%</option>
          <option value="12">12%</option>
          <option value="18" selected>18%</option>
          <option value="28">28%</option>
        </select>
      </div>
      <div class="form-group">
        <label class="form-label">GST Option</label>
        <div style="display:flex; gap:10px;">
          <button class="preset-btn active" id="gst-add-btn" onclick="setGstMode('add', this)" style="flex:1;">Add GST</button>
          <button class="preset-btn" id="gst-sub-btn" onclick="setGstMode('sub', this)" style="flex:1;">Remove GST</button>
        </div>
      </div>
    `;
  } else if (toolId === 'sip-calculator') {
    accepts = '';
    multiple = false;
    optionsHTML = `
      <div class="form-group">
        <label class="form-label">Monthly Investment (₹)</label>
        <input type="number" id="opt-sip-monthly" class="form-input-text" placeholder="e.g. 5000" min="1">
      </div>
      <div class="form-group">
        <label class="form-label">Expected Return Rate (% P.A.)</label>
        <input type="number" id="opt-sip-rate" class="form-input-text" placeholder="e.g. 12" min="0.01" step="0.5">
      </div>
      <div class="form-group">
        <label class="form-label">Time Period (Years)</label>
        <input type="number" id="opt-sip-years" class="form-input-text" placeholder="e.g. 10" min="1">
      </div>
    `;
  } else if (toolId === 'bmi-calculator') {
    accepts = '';
    multiple = false;
    optionsHTML = `
      <div class="form-group">
        <label class="form-label">Unit System</label>
        <select id="opt-bmi-units" class="form-input-text" style="background:var(--color-surface); color:var(--color-text-primary);">
          <option value="metric">Metric (kg / cm)</option>
          <option value="imperial">Imperial (lbs / inches)</option>
        </select>
      </div>
      <div class="form-group">
        <label class="form-label" id="opt-bmi-w-label">Weight (kg)</label>
        <input type="number" id="opt-bmi-weight" class="form-input-text" placeholder="e.g. 70" min="1">
      </div>
      <div class="form-group">
        <label class="form-label" id="opt-bmi-h-label">Height (cm)</label>
        <input type="number" id="opt-bmi-height" class="form-input-text" placeholder="e.g. 175" min="1">
      </div>
    `;
  } else if (toolId === 'discount-calculator') {
    accepts = '';
    multiple = false;
    optionsHTML = `
      <div class="form-group">
        <label class="form-label">Original Price (₹)</label>
        <input type="number" id="opt-disc-price" class="form-input-text" placeholder="e.g. 1000" min="0">
      </div>
      <div class="form-group">
        <label class="form-label">Discount (%)</label>
        <input type="number" id="opt-disc-pct" class="form-input-text" placeholder="e.g. 20" min="0" max="100">
      </div>
      <div class="form-group">
        <label class="form-label">Additional Discount (%)</label>
        <input type="number" id="opt-disc-add" class="form-input-text" value="0">
      </div>
      <div class="form-group">
        <label class="form-label">Sales Tax (%)</label>
        <input type="number" id="opt-disc-tax" class="form-input-text" value="0">
      </div>
    `;
  } else if (toolId === 'unit-converter') {
    accepts = '';
    multiple = false;
    optionsHTML = `
      <div class="form-group">
        <label class="form-label">Conversion Category</label>
        <select id="opt-unit-cat" class="form-input-text" style="background:var(--color-surface); color:var(--color-text-primary);">
          <option value="length">Length</option>
          <option value="weight">Weight / Mass</option>
          <option value="area">Area</option>
          <option value="temperature">Temperature</option>
        </select>
      </div>
      <div class="form-group">
        <label class="form-label">Value</label>
        <input type="number" id="opt-unit-val" class="form-input-text" placeholder="Enter a value">
      </div>
      <div style="display:grid; grid-template-columns:1fr 1fr; gap:10px;">
        <div class="form-group">
          <label class="form-label">From</label>
          <select id="opt-unit-from" class="form-input-text" style="background:var(--color-surface); color:var(--color-text-primary);"></select>
        </div>
        <div class="form-group">
          <label class="form-label">To</label>
          <select id="opt-unit-to" class="form-input-text" style="background:var(--color-surface); color:var(--color-text-primary);"></select>
        </div>
      </div>
    `;
  } else if (toolId === 'currency-converter') {
    accepts = '';
    multiple = false;
    optionsHTML = `
      <div class="form-group">
        <label class="form-label">Amount</label>
        <input type="number" id="opt-curr-val" class="form-input-text" placeholder="Enter an amount" min="0" step="any">
      </div>
      <div style="display:grid; grid-template-columns:1fr 1fr; gap:10px;">
        <div class="form-group">
          <label class="form-label">From</label>
          <select id="opt-curr-from" class="form-input-text" style="background:var(--color-surface); color:var(--color-text-primary);">
            <option value="USD">USD ($)</option>
            <option value="INR" selected>INR (₹)</option>
            <option value="EUR">EUR (€)</option>
            <option value="GBP">GBP (£)</option>
            <option value="AED">AED (د.إ)</option>
            <option value="JPY">JPY (¥)</option>
            <option value="AUD">AUD ($)</option>
          </select>
        </div>
        <div class="form-group">
          <label class="form-label">To</label>
          <select id="opt-curr-to" class="form-input-text" style="background:var(--color-surface); color:var(--color-text-primary);">
            <option value="USD" selected>USD ($)</option>
            <option value="INR">INR (₹)</option>
            <option value="EUR">EUR (€)</option>
            <option value="GBP">GBP (£)</option>
            <option value="AED">AED (د.إ)</option>
            <option value="JPY">JPY (¥)</option>
            <option value="AUD">AUD ($)</option>
          </select>
        </div>
      </div>
      <div class="form-group">
        <label class="form-label">Exchange rate (1 From = ? To)</label>
        <input type="number" id="opt-curr-rate" class="form-input-text" placeholder="Enter a current rate" min="0" step="any">
        <small class="processing-disclosure">Enter a current rate from a source you trust. GXA Toolbox does not claim this is a live market rate.</small>
      </div>
    `;
  } else if (toolId === 'time-calculator') {
    accepts = '';
    multiple = false;
    optionsHTML = `
      <div class="form-group">
        <label class="form-label">Start Time (HH:MM:SS)</label>
        <div style="display:grid; grid-template-columns:1fr 1fr 1fr; gap:5px;">
          <input type="number" id="opt-time-h1" class="form-input-text" placeholder="HH" min="0">
          <input type="number" id="opt-time-m1" class="form-input-text" placeholder="MM" min="0" max="59">
          <input type="number" id="opt-time-s1" class="form-input-text" placeholder="SS" min="0" max="59">
        </div>
      </div>
      <div class="form-group">
        <label class="form-label">Operation</label>
        <select id="opt-time-op" class="form-input-text" style="background:var(--color-surface); color:var(--color-text-primary);">
          <option value="add">Add (+)</option>
          <option value="subtract">Subtract (-)</option>
        </select>
      </div>
      <div class="form-group">
        <label class="form-label">Time to Add/Subtract</label>
        <div style="display:grid; grid-template-columns:1fr 1fr 1fr; gap:5px;">
          <input type="number" id="opt-time-h2" class="form-input-text" placeholder="HH" min="0">
          <input type="number" id="opt-time-m2" class="form-input-text" placeholder="MM" min="0" max="59">
          <input type="number" id="opt-time-s2" class="form-input-text" placeholder="SS" min="0" max="59">
        </div>
      </div>
    `;
  } else if (toolId === 'qr-generator') {
    accepts = '';
    multiple = false;
    optionsHTML = `
      <div class="form-group">
        <label class="form-label">Link or Text Link</label>
        <input type="text" id="opt-qr-text" class="form-input-text" value="https://example.com">
      </div>
    `;
  } else if (toolId === 'remove-pdf-pages') {
    accepts = '.pdf';
    multiple = false;
    optionsHTML = `
      <div class="form-group">
        <label class="form-label">Pages to Remove</label>
        <input type="text" id="opt-remove-pages" class="form-input-text" placeholder="e.g. 2, 4-6">
        <p style="font-size:11px; color:var(--color-text-secondary); margin-top:5px;">Specify page numbers or ranges to delete from the PDF.</p>
      </div>
    `;
  } else if (toolId === 'extract-pdf-pages') {
    accepts = '.pdf';
    multiple = false;
    optionsHTML = `
      <div class="form-group">
        <label class="form-label">Pages to Extract</label>
        <input type="text" id="opt-extract-pages" class="form-input-text" placeholder="e.g. 1, 3, 5-7">
        <p style="font-size:11px; color:var(--color-text-secondary); margin-top:5px;">Only keep the specified page numbers or ranges.</p>
      </div>
    `;
  } else if (toolId === 'extract-images-pdf') {
    accepts = '.pdf';
    multiple = false;
    optionsHTML = `
      <p style="font-size:12px; color:var(--color-text-secondary); margin-bottom:12px;">Extract all embedded raster images from the document pages.</p>
      <div class="form-group">
        <label class="form-label">Extract Format</label>
        <select id="opt-extract-img-format" class="form-input-text" style="background:var(--color-surface); color:var(--color-text-primary);">
          <option value="png">PNG (Lossless)</option>
          <option value="jpg">JPG (Compressed)</option>
        </select>
      </div>
    `;
  } else if (toolId === 'crop-pdf') {
    accepts = '.pdf';
    multiple = false;
    optionsHTML = `
      <div class="form-group">
        <label class="form-label">Crop Margins (Points)</label>
        <div style="display:grid; grid-template-columns: 1fr 1fr; gap: 8px;">
          <div>
            <label style="font-size:10px; color:var(--color-text-secondary);">Top</label>
            <input type="number" id="opt-crop-top" class="form-input-text" value="50">
          </div>
          <div>
            <label style="font-size:10px; color:var(--color-text-secondary);">Bottom</label>
            <input type="number" id="opt-crop-bottom" class="form-input-text" value="50">
          </div>
          <div>
            <label style="font-size:10px; color:var(--color-text-secondary);">Left</label>
            <input type="number" id="opt-crop-left" class="form-input-text" value="50">
          </div>
          <div>
            <label style="font-size:10px; color:var(--color-text-secondary);">Right</label>
            <input type="number" id="opt-crop-right" class="form-input-text" value="50">
          </div>
        </div>
        <p style="font-size:11px; color:var(--color-text-secondary); margin-top:5px;">Crop margins from the edge of pages.</p>
      </div>
    `;
  } else if (toolId === 'header-footer-pdf') {
    accepts = '.pdf';
    multiple = false;
    optionsHTML = `
      <div class="form-group">
        <label class="form-label">Header Text</label>
        <input type="text" id="opt-hf-header" class="form-input-text" placeholder="Document title">
      </div>
      <div class="form-group">
        <label class="form-label">Footer Text</label>
        <input type="text" id="opt-hf-footer" class="form-input-text" value="Page [page] of [total]">
        <p style="font-size:10px; color:var(--color-text-secondary); margin-top:4px;">Tokens: [page], [total], [date], [filename]</p>
      </div>
      <div class="form-group">
        <label class="form-label">Alignment</label>
        <select id="opt-hf-align" class="form-input-text" style="background:var(--color-surface); color:var(--color-text-primary);">
          <option value="center">Center</option>
          <option value="left">Left</option>
          <option value="right">Right</option>
        </select>
      </div>
      <div class="form-group">
        <label class="form-label">Font size</label>
        <input type="number" id="opt-hf-size" class="form-input-text" min="6" max="48" value="10">
      </div>
    `;
  } else if (toolId === 'sign-pdf') {
    accepts = '.pdf';
    multiple = false;
    optionsHTML = `
      <div class="form-group">
        <label class="form-label">Signee Name</label>
        <input type="text" id="opt-sign-name" class="form-input-text" placeholder="Enter the signer name">
      </div>
      <div class="form-group">
        <label class="form-label">Signature Color</label>
        <select id="opt-sign-color" class="form-input-text" style="background:var(--color-surface); color:var(--color-text-primary);">
          <option value="blue">Blue</option>
          <option value="black">Black</option>
          <option value="red">Red</option>
        </select>
      </div>
      <div class="form-group">
        <label class="form-label">Draw signature</label>
        <canvas id="pdf-signature-pad" width="520" height="180" aria-label="Signature drawing pad"></canvas>
        <button type="button" class="btn btn-ghost btn-sm" onclick="clearPdfSignaturePad()">Clear drawing</button>
      </div>
      <div class="form-group">
        <label class="form-label" for="pdf-signature-upload">Or upload a signature image</label>
        <input id="pdf-signature-upload" type="file" class="form-input-text" accept="image/png,image/jpeg">
      </div>
    `;
  } else if (toolId === 'repair-pdf') {
    accepts = '.pdf';
    multiple = false;
    optionsHTML = `
      <p style="font-size:12px; color:var(--color-text-secondary);">Attempts to normalize PDFs that pdf-lib can still read. Unreadable or severely corrupted files cannot be recovered here.</p>
    `;
  } else if (toolId === 'ocr-pdf') {
    accepts = '.pdf';
    multiple = false;
    optionsHTML = `
      <label class="form-label" for="opt-ocr-lang">OCR language<select id="opt-ocr-lang" class="form-input-text"><option value="eng">English</option></select></label>
      <p class="processing-disclosure">PDF pages are rendered sequentially and recognized in a local Tesseract Web Worker. The output is extracted TXT, not a searchable PDF. The first run downloads the OCR core and English language model; the PDF itself is not uploaded.</p>
    `;
  } else if (toolId === 'image-to-pdf') {
    accepts = 'image/*';
    multiple = true;
    optionsHTML = `
      <div class="form-group">
        <label class="form-label">Layout Size</label>
        <select id="opt-img2pdf-size" class="form-input-text" style="background:var(--color-surface); color:var(--color-text-primary);">
          <option value="a4">A4 Portrait</option>
          <option value="letter">Letter</option>
        </select>
      </div>
    `;
  } else if (toolId === 'png-to-pdf') {
    accepts = 'image/png';
    multiple = true;
    optionsHTML = `
      <div class="form-group">
        <label class="form-label">Page Setup</label>
        <select id="opt-png2pdf-size" class="form-input-text" style="background:var(--color-surface); color:var(--color-text-primary);">
          <option value="a4">A4 Portrait</option>
          <option value="letter">Letter</option>
        </select>
      </div>
    `;
  } else if (toolId === 'txt-to-pdf') {
    accepts = '.txt';
    multiple = false;
    optionsHTML = `
      <div class="form-group">
        <label class="form-label">Document Font</label>
        <select id="opt-txt2pdf-font" class="form-input-text" style="background:var(--color-surface); color:var(--color-text-primary);">
          <option value="Helvetica">Helvetica</option>
          <option value="Courier">Courier</option>
        </select>
      </div>
    `;
  } else if (toolId === 'pdf-to-image') {
    accepts = '.pdf';
    multiple = false;
    optionsHTML = `
      <div class="form-group">
        <label class="form-label">Output Format</label>
        <select id="opt-pdf2img-format" class="form-input-text" style="background:var(--color-surface); color:var(--color-text-primary);">
          <option value="png">PNG</option>
          <option value="jpg">JPG</option>
        </select>
      </div>
    `;
  } else if (toolId === 'pdf-to-png') {
    accepts = '.pdf';
    multiple = false;
    optionsHTML = `
      <p style="font-size:12px; color:var(--color-text-secondary);">Convert your document pages to lossless high-resolution PNG image sequences packed in a ZIP.</p>
    `;
  } else if (toolId === 'pdf-to-excel') {
    accepts = '.pdf';
    multiple = false;
    optionsHTML = `
      <p class="processing-disclosure">Selectable text is grouped into rows by PDF coordinates and written to XLSX. Complex spanning cells, borderless tables, and scanned pages may require manual cleanup.</p>
    `;
  } else if (toolId === 'pdf-to-ppt') {
    accepts = '.pdf';
    multiple = false;
    optionsHTML = `
      <p class="processing-disclosure">Each PDF page becomes a full-slide image in PPTX. The slides preserve appearance but their page content is not editable.</p>
    `;
  }
  
  // Determine if file-upload zone should be displayed (generators do not need file zones)
  const generators = [
    'password-generator', 'barcode-generator', 'lorem-ipsum', 'uuid-generator',
    'diff-checker', 'user-agent', 'cron-generator', 'regex-tester',
    'markdown-editor', 'css-beautifier', 'js-beautifier', 'html-beautifier',
    'color-converter', 'url-tool', 'case-converter',
    'text-to-speech', 'base64-tool', 'hash-tool', 'word-counter',
    'json-tool', 'sql-formatter', 'xml-to-json', 'timestamp-converter',
    'ai-resume-builder', 'remove-spaces', 'grammar-checker', 'plagiarism-checker',
    'age-calculator', 'emi-calculator', 'percentage-calculator', 'unit-converter',
    'currency-converter', 'qr-generator',
    'calculator', 'scientific-calculator', 'date-calculator', 'loan-calculator',
    'interest-calculator', 'gst-calculator', 'sip-calculator', 'bmi-calculator',
    'discount-calculator', 'time-calculator'
  ];
  const routeNormallyNeedsFiles = !generators.includes(toolId);
  const processingProfile = window.GxaWorkspace
    ? window.GxaWorkspace.getProcessingProfile(toolId)
    : { kind: 'local', label: 'Processed in your browser', detail: 'Processing runs in this browser.' };
  const dependencyBlocker = window.GxaWorkspace ? window.GxaWorkspace.getBlocker(toolId) : '';
  const needsFiles = routeNormallyNeedsFiles && !dependencyBlocker;
  const panelMeta = getToolPanelMeta(toolId, tool.category, needsFiles);
  const processActionLabel = ({
    'merge-pdf': 'Merge PDFs', 'organize-pdf': 'Organize PDF', 'compress-image': 'Compress Image',
    'resize-image': 'Resize Image', 'crop-image': 'Crop Image', 'background-remover': 'Remove Background',
    'zip-manager': 'Create ZIP', 'zip-extractor': 'Extract ZIP', 'split-pdf': 'Split PDF',
    'pdf-to-jpg': 'Convert PDF Pages', 'pdf-to-image': 'Convert PDF Pages', 'pdf-to-png': 'Convert to PNG',
    'jpg-to-pdf': 'Create PDF', 'image-to-pdf': 'Create PDF', 'png-to-pdf': 'Create PDF',
    'pdf-to-text': 'Extract Text', 'pdf-to-html': 'Extract to HTML', 'pdf-to-markdown': 'Extract to Markdown',
    'rotate-pdf': 'Rotate PDF', 'watermark-pdf': 'Apply Watermark', 'pagenumber-pdf': 'Add Page Numbers',
    'remove-pdf-pages': 'Remove Selected Pages', 'extract-pdf-pages': 'Extract Selected Pages',
    'crop-pdf': 'Crop PDF', 'header-footer-pdf': 'Add Header & Footer', 'sign-pdf': 'Add Signature Appearance'
  })[toolId] || 'Process File(s)';
  if (dependencyBlocker) {
    optionsHTML = `
      <div class="dependency-required-state" role="alert">
        <strong>Presentation renderer unavailable</strong>
        <p>${dependencyBlocker}</p>
      </div>`;
  }
  
  // Dynamic FAQs
  const faqs = getFAQForTool(toolId, tool.name);
  const faqHTML = faqs.map(faq => `
    <div class="faq-item">
      <button class="faq-trigger" onclick="toggleFaq(this)">${faq.q} <i data-lucide="chevron-down" class="faq-icon"></i></button>
      <div class="faq-content">${faq.a}</div>
    </div>
  `).join('');

  // Dynamic SEO Title and Meta Description
  document.title = `${tool.name} | GXA Toolbox`;
  let metaDesc = document.querySelector('meta[name="description"]');
  if (!metaDesc) {
    metaDesc = document.createElement('meta');
    metaDesc.setAttribute('name', 'description');
    document.head.appendChild(metaDesc);
  }
  metaDesc.setAttribute('content', tool.desc);

  if (toolId === 'crop-image') {
    renderCropImageEditor(container, tool, processingProfile, faqHTML);
    return;
  }
  if (toolId === 'background-remover') {
    renderBackgroundRemoverRoute(container, tool, processingProfile, faqHTML, optionsHTML, accepts, processActionLabel);
    return;
  }

  container.innerHTML = `
    <section class="container tool-container">
      <!-- Header Breadcrumbs -->
      <div class="tool-header">
        <div class="breadcrumb">
          <span class="breadcrumb-link" onclick="navigate('home')">Home</span>
          <span>&gt;</span>
          <span class="breadcrumb-link" style="text-transform: uppercase;">${tool.category}</span>
          <span>&gt;</span>
          <span>${tool.name}</span>
        </div>
        <div class="tool-title-wrapper">
          <div class="tool-heading-group">
            <span class="tool-page-icon cat-${tool.category}"><i data-lucide="${tool.icon}"></i></span>
            <div><span class="tool-category-label">${tool.category} tool</span><h1 class="tool-page-title">${tool.name}</h1></div>
          </div>
          <div class="tool-heading-actions">
            <button class="favorite-button tool-favorite ${appState.favorites.includes(tool.id) ? 'active' : ''}" aria-label="Toggle ${tool.name} favorite" onclick="toggleFavorite('${tool.id}'); this.classList.toggle('active')"><i data-lucide="star"></i><span>Favorite</span></button>
            <div class="tool-badge processing-badge processing-${processingProfile.kind}"><i data-lucide="shield-check"></i> ${processingProfile.label}</div>
          </div>
        </div>
        <p class="section-desc" style="text-align:left;">${tool.desc}</p>
        <p class="processing-disclosure">${processingProfile.detail}</p>
      </div>
      
      <!-- Primary Tool Workspace Layout -->
      <div class="tool-workspace premium-editor-workspace ${needsFiles ? '' : 'full'}" data-tool-id="${toolId}">
        <div class="tool-interactive-area">
          <div id="premium-editor-toolbar" class="premium-editor-toolbar" role="toolbar" aria-label="${tool.name} editor commands"></div>
          ${needsFiles ? `
            <!-- Drop Upload Zone Component -->
            <div id="tool-upload-mount">
              <div class="upload-zone" id="drop-zone" role="button" tabindex="0" aria-label="Select or drop files for ${tool.name}" onclick="document.getElementById('file-picker').click()">
                <span class="upload-icon-shell"><i data-lucide="cloud-upload" class="upload-icon"></i></span>
                <h3 class="upload-title">${t('uploadTitle')}</h3>
                <p class="upload-subtitle">${t('uploadSubtitle')}</p>
                <div class="upload-formats">
                  <span class="format-chip">${accepts === '*' ? 'ANY' : accepts.toUpperCase()}</span>
                  <span class="format-chip subtle">${multiple ? 'Multiple files' : 'Single file'}</span>
                </div>
                <p class="upload-limit"><i data-lucide="info"></i> ${t('maxSize')} · Files are validated before processing</p>
                <input type="file" id="file-picker" style="display:none;" accept="${accepts}" ${multiple ? 'multiple' : ''}>
              </div>
            </div>
            
            <!-- Dynamic Work Queues -->
            <div id="tool-queue-mount" class="hidden" style="margin-top:20px;">
              <div class="compact-upload-zone" role="button" tabindex="0" aria-label="Add more files" onclick="document.getElementById('file-picker').click()">
                <i data-lucide="plus" style="vertical-align:middle; width:16px;"></i> Add more files
              </div>
              <div class="queue-header">
                <h4 class="form-label">Selected Files</h4>
                <button class="btn btn-ghost btn-sm" onclick="clearSelectedFiles()">Clear All</button>
              </div>
              <div class="file-queue" id="file-queue-container"></div>
              
              <!-- Core processing controls -->
              <button class="btn btn-primary btn-lg" id="btn-process-action" onclick="runFileProcessingPipeline()" style="width:100%; margin-top:20px;">
                ${processActionLabel}
              </button>
            </div>
          ` : dependencyBlocker ? `
            <div class="dependency-service-state" role="status">
              <span class="upload-icon-shell"><i data-lucide="clock-3"></i></span>
              <h3>Presentation renderer unavailable</h3>
              <p>${dependencyBlocker}</p>
              <p>Your source file stays on your device because this deployment does not include a faithful presentation renderer.</p>
            </div>
          ` : `
            <!-- Generator Preview Box -->
            <div class="barcode-preview-box" id="generator-preview-mount"></div>
          `}
          
          <!-- State Display: Processing -->
          <div id="tool-processing-mount" class="hidden">
            <div class="processing-card">
              <div class="processing-orbit"><div class="spinner"></div><i data-lucide="sparkles"></i></div>
              <h3 class="upload-title" id="processing-stage-label">${t('processing')}</h3>
              <div class="progress-bar-container">
                <div class="progress-bar-fill shimmer-bg" id="global-progress-bar"></div>
              </div>
              <div class="processing-stages" id="processing-stages" aria-label="Processing stages">
                <span class="active" data-stage="validate"><i data-lucide="check"></i> Reading</span>
                <span data-stage="process"><i data-lucide="loader-circle"></i> Processing</span>
                <span data-stage="generate"><i data-lucide="file-output"></i> Generating</span>
                <span data-stage="finish"><i data-lucide="check-circle-2"></i> Finishing</span>
              </div>
              <button type="button" id="btn-cancel-processing" class="btn btn-ghost hidden" onclick="cancelActiveBatch()">Cancel after current file</button>
            </div>
          </div>
          
          <!-- State Display: Done -->
          <div id="tool-complete-mount" class="hidden">
            <div class="complete-card">
              <div class="complete-icon"><i data-lucide="check" style="width:36px; height:36px; stroke-width:3;"></i></div>
              <h3 class="complete-title">${t('complete')}</h3>
              <p class="upload-subtitle" style="margin-bottom:20px;">Your processed output is ready. Review the real result and download it when ready.</p>
              <div class="premium-mobile-result-action">
                <button class="btn btn-primary btn-lg" id="btn-mobile-download-result" disabled><i data-lucide="download"></i> ${getDirectResultDownloadLabel(toolId)}</button>
              </div>
              <div id="premium-result-preview" class="premium-result-preview" aria-live="polite"></div>
              
              <!-- Image compression comparisons if applicable -->
              <div id="comparison-metric-mount" class="complete-comparison hidden"></div>
              
              <div id="premium-result-stats" class="premium-result-stats" aria-label="Output statistics"></div>
              <div class="premium-result-actions">
                <button class="btn btn-primary btn-lg" id="btn-download-result" disabled><i data-lucide="download"></i> ${getDirectResultDownloadLabel(toolId)}</button>
                <button class="btn btn-secondary btn-lg" id="btn-copy-result-link" onclick="copyPremiumResultLink()" disabled><i data-lucide="link"></i> Copy local link</button>
                <button class="btn btn-ghost btn-lg" onclick="resetActiveTool()"><i data-lucide="refresh-cw"></i> Start Over</button>
              </div>
            </div>
          </div>
          
        </div>
        
        <!-- Sidebar Controls settings panels -->
        <div class="tool-sidebar-settings">
          <div class="tool-options-panel">
            <div class="options-title"><span><i data-lucide="sliders-horizontal"></i> ${panelMeta.title}</span><small>${panelMeta.subtitle}</small></div>
            ${optionsHTML}
            ${tool.category === 'calculator' ? `
              <div class="calculator-action-row">
                <button type="button" class="btn btn-primary" onclick="runActiveCalculator()"><i data-lucide="equal"></i> Calculate</button>
                <button type="button" class="btn btn-secondary" onclick="resetPremiumEditor()"><i data-lucide="rotate-ccw"></i> Reset</button>
              </div>
            ` : ''}
            ${!needsFiles && !dependencyBlocker ? `
              <button class="btn btn-primary" id="btn-generator-download"><i data-lucide="download"></i> Download Output</button>
            ` : ''}
            <div id="premium-live-stats" class="premium-live-stats" aria-live="polite"></div>
            <div class="workspace-confidence-note"><i data-lucide="shield-check"></i><span><strong>${processingProfile.label}</strong>${processingProfile.detail}</span></div>
          </div>
        </div>
      </div>

      <section class="premium-session-panel" aria-labelledby="premium-session-title">
        <div><span class="tool-category-label">This browser session</span><h3 id="premium-session-title">Recent results</h3></div>
        <div id="premium-session-history" class="premium-session-history"><span>No results created in this session yet.</span></div>
      </section>

      <!-- Related Tools section -->
      <div class="related-tools-section" style="margin-top: 60px; padding-top: 40px; border-top: 1px solid var(--color-border);">
        <h3 style="font-size: 22px; font-weight: 700; margin-bottom: 24px;">Related Utilities</h3>
        <div class="tools-grid" id="related-tools-grid"></div>
      </div>

      <!-- FAQ Accordion section -->
      <div class="faq-section" style="margin-top: 50px;">
        <h3 class="faq-title">Frequently Asked Questions</h3>
        <div class="faq-list">
          ${faqHTML}
        </div>
      </div>
    </section>
  `;
  
  lucide.createIcons();
  renderRelatedTools(toolId, tool.category);
  
  // Set up Event Listeners for file upload
  if (needsFiles) {
    setupUploadZoneEvents();
  } else if (!dependencyBlocker) {
    // Fire generator initialization
    if (toolId === 'password-generator') {
      generatePassword();
      document.getElementById('btn-generator-download').addEventListener('click', downloadPasswordText);
    } else if (toolId === 'barcode-generator') {
      generateBarcodeSVG();
      document.getElementById('btn-generator-download').addEventListener('click', downloadBarcodeSVGFile);
    } else if (toolId === 'lorem-ipsum') {
      generateLoremIpsum();
      document.getElementById('btn-generator-download').addEventListener('click', downloadLoremText);
      document.getElementById('opt-lorem-count').addEventListener('input', generateLoremIpsum);
    } else if (toolId === 'uuid-generator') {
      generateUUIDs();
      document.getElementById('btn-generator-download').addEventListener('click', downloadUUIDsText);
      document.getElementById('opt-uuid-count').addEventListener('input', generateUUIDs);
    } else if (toolId === 'diff-checker') {
      generateDiffCheck();
      document.getElementById('btn-generator-download').classList.add('hidden');
      document.getElementById('opt-diff-orig').addEventListener('input', generateDiffCheck);
      document.getElementById('opt-diff-mod').addEventListener('input', generateDiffCheck);
    } else if (toolId === 'user-agent') {
      generateUserAgent();
      document.getElementById('btn-generator-download').classList.add('hidden');
    } else if (toolId === 'cron-generator') {
      generateCronExplanation();
      document.getElementById('btn-generator-download').classList.add('hidden');
      document.getElementById('opt-cron-exp').addEventListener('input', generateCronExplanation);
    } else if (toolId === 'regex-tester') {
      generateRegexTest();
      document.getElementById('btn-generator-download').classList.add('hidden');
      document.getElementById('opt-regex-exp').addEventListener('input', generateRegexTest);
      document.getElementById('opt-regex-flags').addEventListener('input', generateRegexTest);
      document.getElementById('opt-regex-subject').addEventListener('input', generateRegexTest);
    } else if (toolId === 'markdown-editor') {
      generateMarkdownPreview();
      document.getElementById('btn-generator-download').addEventListener('click', downloadMarkdownFile);
      document.getElementById('opt-mde-raw').addEventListener('input', generateMarkdownPreview);
    } else if (toolId === 'css-beautifier') {
      generateCssBeautify();
      document.getElementById('btn-generator-download').addEventListener('click', downloadCssFile);
      document.getElementById('opt-css-raw').addEventListener('input', generateCssBeautify);
    } else if (toolId === 'js-beautifier') {
      generateJsBeautify();
      document.getElementById('btn-generator-download').addEventListener('click', downloadJsFile);
      document.getElementById('opt-js-raw').addEventListener('input', generateJsBeautify);
    } else if (toolId === 'html-beautifier') {
      generateHtmlBeautify();
      document.getElementById('btn-generator-download').addEventListener('click', downloadHtmlBeautFile);
      document.getElementById('opt-html-beaut-raw').addEventListener('input', generateHtmlBeautify);
    } else if (toolId === 'color-converter') {
      generateColorConvert();
      document.getElementById('btn-generator-download').classList.add('hidden');
      document.getElementById('opt-color-val').addEventListener('input', generateColorConvert);
    } else if (toolId === 'url-tool') {
      generateUrlConvert();
      document.getElementById('btn-generator-download').classList.add('hidden');
      document.getElementById('opt-url-text').addEventListener('input', generateUrlConvert);
    } else if (toolId === 'case-converter') {
      generateCaseConvert();
      document.getElementById('btn-generator-download').addEventListener('click', downloadCaseTextFile);
      document.getElementById('opt-case-type').addEventListener('change', generateCaseConvert);
      document.getElementById('opt-case-text').addEventListener('input', generateCaseConvert);
    } else if (toolId === 'text-to-speech') {
      initializeTextToSpeech();
      document.getElementById('btn-generator-download').classList.add('hidden');
      document.getElementById('opt-speech-text').addEventListener('input', initializeTextToSpeech);
      document.getElementById('opt-speech-rate').addEventListener('input', initializeTextToSpeech);
    } else if (toolId === 'base64-tool') {
      generateBase64TextLive();
      document.getElementById('btn-generator-download').addEventListener('click', downloadBase64TextFile);
      document.getElementById('opt-b64-raw').addEventListener('input', generateBase64TextLive);
    } else if (toolId === 'hash-tool') {
      generateHashTextLive();
      document.getElementById('btn-generator-download').classList.add('hidden');
      document.getElementById('opt-hash-text').addEventListener('input', generateHashTextLive);
      document.getElementById('opt-hash-algo').addEventListener('change', generateHashTextLive);
    } else if (toolId === 'word-counter') {
      generateWordCounterLive();
      document.getElementById('btn-generator-download').classList.add('hidden');
      document.getElementById('opt-wc-text').addEventListener('input', generateWordCounterLive);
    } else if (toolId === 'json-tool') {
      generateJsonModeLive();
      document.getElementById('btn-generator-download').addEventListener('click', downloadJsonFile);
      document.getElementById('opt-json-raw').addEventListener('input', generateJsonModeLive);
    } else if (toolId === 'sql-formatter') {
      generateSqlBeautify();
      document.getElementById('btn-generator-download').addEventListener('click', downloadSqlFile);
      document.getElementById('opt-sql-raw').addEventListener('input', generateSqlBeautify);
    } else if (toolId === 'xml-to-json') {
      generateXmlToJson();
      document.getElementById('btn-generator-download').addEventListener('click', downloadXmlToJsonFile);
      document.getElementById('opt-xml-raw').addEventListener('input', generateXmlToJson);
    } else if (toolId === 'timestamp-converter') {
      generateTimestampConvert();
      document.getElementById('btn-generator-download').classList.add('hidden');
    } else if (toolId === 'remove-spaces') {
      generateRemoveSpaces();
      document.getElementById('btn-generator-download').addEventListener('click', downloadCleanedSpacesFile);
      document.getElementById('opt-spaces-text').addEventListener('input', generateRemoveSpaces);
    } else if (toolId === 'grammar-checker') {
      generateGrammarCheck();
      document.getElementById('btn-generator-download').addEventListener('click', downloadGrammarFile);
      document.getElementById('opt-grammar-text').addEventListener('input', generateGrammarCheck);
    } else if (toolId === 'plagiarism-checker') {
      generatePlagiarismCheck();
      document.getElementById('btn-generator-download').classList.add('hidden');
      document.getElementById('opt-plag-text').addEventListener('input', generatePlagiarismCheck);
    } else if (toolId === 'calculator') {
      generateSimpleCalc(true);
      document.getElementById('btn-generator-download').classList.add('hidden');
    } else if (toolId === 'scientific-calculator') {
      generateScientificCalc(true);
      document.getElementById('btn-generator-download').classList.add('hidden');
    } else if (toolId === 'age-calculator') {
      generateAgeCalc();
      document.getElementById('btn-generator-download').classList.add('hidden');
      document.getElementById('opt-age-dob').addEventListener('change', generateAgeCalc);
      const targetEl = document.getElementById('opt-age-target');
      if (targetEl) targetEl.addEventListener('change', generateAgeCalc);
    } else if (toolId === 'date-calculator') {
      generateDateCalc();
      document.getElementById('btn-generator-download').classList.add('hidden');
      document.getElementById('opt-date-start').addEventListener('change', generateDateCalc);
      document.getElementById('opt-date-mode').addEventListener('change', (e) => {
        if (e.target.value === 'duration') {
          document.getElementById('date-duration-group').classList.remove('hidden');
          document.getElementById('date-offset-group').classList.add('hidden');
        } else {
          document.getElementById('date-duration-group').classList.add('hidden');
          document.getElementById('date-offset-group').classList.remove('hidden');
        }
        generateDateCalc();
      });
      document.getElementById('opt-date-end').addEventListener('change', generateDateCalc);
      document.getElementById('opt-date-offset').addEventListener('input', generateDateCalc);
      document.getElementById('opt-date-unit').addEventListener('change', generateDateCalc);
    } else if (toolId === 'emi-calculator') {
      generateEMICalc();
      document.getElementById('btn-generator-download').classList.add('hidden');
      document.getElementById('opt-emi-amount').addEventListener('input', generateEMICalc);
      document.getElementById('opt-emi-rate').addEventListener('input', generateEMICalc);
      document.getElementById('opt-emi-years').addEventListener('input', generateEMICalc);
    } else if (toolId === 'loan-calculator') {
      generateLoanCalc();
      document.getElementById('btn-generator-download').classList.add('hidden');
      document.getElementById('opt-loan-amount').addEventListener('input', generateLoanCalc);
      document.getElementById('opt-loan-rate').addEventListener('input', generateLoanCalc);
      document.getElementById('opt-loan-months').addEventListener('input', generateLoanCalc);
      document.getElementById('opt-loan-type').addEventListener('change', generateLoanCalc);
    } else if (toolId === 'interest-calculator') {
      generateInterestCalc();
      document.getElementById('btn-generator-download').classList.add('hidden');
      document.getElementById('opt-int-principal').addEventListener('input', generateInterestCalc);
      document.getElementById('opt-int-rate').addEventListener('input', generateInterestCalc);
      document.getElementById('opt-int-years').addEventListener('input', generateInterestCalc);
      document.getElementById('opt-int-type').addEventListener('change', generateInterestCalc);
    } else if (toolId === 'gst-calculator') {
      appState.activeToolOptions.gstMode = 'add';
      generateGstCalc();
      document.getElementById('btn-generator-download').classList.add('hidden');
      document.getElementById('opt-gst-amount').addEventListener('input', generateGstCalc);
      document.getElementById('opt-gst-rate').addEventListener('change', generateGstCalc);
    } else if (toolId === 'sip-calculator') {
      generateSipCalc();
      document.getElementById('btn-generator-download').classList.add('hidden');
      document.getElementById('opt-sip-monthly').addEventListener('input', generateSipCalc);
      document.getElementById('opt-sip-rate').addEventListener('input', generateSipCalc);
      document.getElementById('opt-sip-years').addEventListener('input', generateSipCalc);
    } else if (toolId === 'bmi-calculator') {
      generateBmiCalc();
      document.getElementById('btn-generator-download').classList.add('hidden');
      document.getElementById('opt-bmi-units').addEventListener('change', (e) => {
        const units = e.target.value;
        const wLabel = document.getElementById('opt-bmi-w-label');
        const hLabel = document.getElementById('opt-bmi-h-label');
        const weightInput = document.getElementById('opt-bmi-weight');
        const heightInput = document.getElementById('opt-bmi-height');
        if (units === 'metric') {
          wLabel.innerText = 'Weight (kg)';
          hLabel.innerText = 'Height (cm)';
          weightInput.placeholder = 'e.g. 70';
          heightInput.placeholder = 'e.g. 175';
        } else {
          wLabel.innerText = 'Weight (lbs)';
          hLabel.innerText = 'Height (inches)';
          weightInput.placeholder = 'e.g. 154';
          heightInput.placeholder = 'e.g. 69';
        }
        weightInput.value = '';
        heightInput.value = '';
        generateBmiCalc();
      });
      document.getElementById('opt-bmi-weight').addEventListener('input', generateBmiCalc);
      document.getElementById('opt-bmi-height').addEventListener('input', generateBmiCalc);
    } else if (toolId === 'discount-calculator') {
      generateDiscountCalc();
      document.getElementById('btn-generator-download').classList.add('hidden');
      document.getElementById('opt-disc-price').addEventListener('input', generateDiscountCalc);
      document.getElementById('opt-disc-pct').addEventListener('input', generateDiscountCalc);
      document.getElementById('opt-disc-add').addEventListener('input', generateDiscountCalc);
      document.getElementById('opt-disc-tax').addEventListener('input', generateDiscountCalc);
    } else if (toolId === 'percentage-calculator') {
      generatePercentageCalc();
      document.getElementById('btn-generator-download').classList.add('hidden');
      document.getElementById('opt-pct-val1').addEventListener('input', generatePercentageCalc);
      document.getElementById('opt-pct-val2').addEventListener('input', generatePercentageCalc);
      document.getElementById('opt-pct-a').addEventListener('input', generatePercentageCalc);
      document.getElementById('opt-pct-b').addEventListener('input', generatePercentageCalc);
      document.getElementById('opt-pct-from').addEventListener('input', generatePercentageCalc);
      document.getElementById('opt-pct-to').addEventListener('input', generatePercentageCalc);
    } else if (toolId === 'unit-converter') {
      setupUnitConverterUnits();
      generateUnitConvert();
      document.getElementById('btn-generator-download').classList.add('hidden');
      document.getElementById('opt-unit-cat').addEventListener('change', () => {
        setupUnitConverterUnits();
        generateUnitConvert();
      });
      document.getElementById('opt-unit-val').addEventListener('input', generateUnitConvert);
      document.getElementById('opt-unit-from').addEventListener('change', generateUnitConvert);
      document.getElementById('opt-unit-to').addEventListener('change', generateUnitConvert);
    } else if (toolId === 'currency-converter') {
      generateCurrencyConvert();
      document.getElementById('btn-generator-download').classList.add('hidden');
      document.getElementById('opt-curr-val').addEventListener('input', generateCurrencyConvert);
      document.getElementById('opt-curr-from').addEventListener('change', generateCurrencyConvert);
      document.getElementById('opt-curr-to').addEventListener('change', generateCurrencyConvert);
      document.getElementById('opt-curr-rate').addEventListener('input', generateCurrencyConvert);
    } else if (toolId === 'time-calculator') {
      generateTimeCalc();
      document.getElementById('btn-generator-download').classList.add('hidden');
      document.getElementById('opt-time-h1').addEventListener('input', generateTimeCalc);
      document.getElementById('opt-time-m1').addEventListener('input', generateTimeCalc);
      document.getElementById('opt-time-s1').addEventListener('input', generateTimeCalc);
      document.getElementById('opt-time-op').addEventListener('change', generateTimeCalc);
      document.getElementById('opt-time-h2').addEventListener('input', generateTimeCalc);
      document.getElementById('opt-time-m2').addEventListener('input', generateTimeCalc);
      document.getElementById('opt-time-s2').addEventListener('input', generateTimeCalc);
    } else if (toolId === 'ai-resume-builder') {
      generateAIResume();
      document.getElementById('btn-generator-download').addEventListener('click', downloadAIResumeFile);
      document.getElementById('opt-res-name').addEventListener('input', generateAIResume);
      document.getElementById('opt-res-email').addEventListener('input', generateAIResume);
      document.getElementById('opt-res-phone').addEventListener('input', generateAIResume);
      document.getElementById('opt-res-loc').addEventListener('input', generateAIResume);
      document.getElementById('opt-res-summary').addEventListener('input', generateAIResume);
      document.getElementById('opt-res-exp').addEventListener('input', generateAIResume);
      document.getElementById('opt-res-edu').addEventListener('input', generateAIResume);
      document.getElementById('opt-res-skills').addEventListener('input', generateAIResume);
    }
  }
  initializePremiumToolEditor(toolId, needsFiles);
  window.GxaPhaseOneStudios?.decorate(toolId, processingProfile);
  if (toolId === 'watermark-pdf') initializeWatermarkStudio();
  if (toolId === 'sign-pdf') initializePdfSignaturePad();
}

// --- FAQs lookup and generation ---
function getFAQForTool(toolId, toolName) {
  const profile = window.GxaWorkspace
    ? window.GxaWorkspace.getProcessingProfile(toolId)
    : { kind: 'local', detail: 'Processing runs in this browser.' };
  const privacyAnswer = profile.kind === 'server'
    ? `${profile.detail} Do not upload sensitive material unless you accept that processing model.`
    : profile.kind === 'dependency'
      ? profile.detail
      : `${profile.detail} Your browser and any dynamically loaded libraries remain subject to their normal security and network behavior.`;
  const generic = [
    { q: `Where does ${toolName} process my files?`, a: privacyAnswer },
    { q: "Do I need to sign up to use tools?", a: "No, all standard operations can be performed completely free without creating an account or providing a credit card." }
  ];
  
  const customFAQs = {
    'merge-pdf': [
      { q: "Is there a limit to the number of PDF files I can merge?", a: "There is no artificial batch count in the browser tool, but available memory and the 100 MB per-file upload limit still apply." },
      { q: "Can I rearrange the files before merging?", a: "Yes, you can drag and drop the selected file cards in the upload queue to reorder them before clicking 'Process Files'." }
    ],
    'compress-pdf': [
      { q: "Will compressing a PDF change its appearance?", a: "The current browser implementation reserializes the PDF structure. It does not promise image downsampling or a particular reduction percentage." },
      { q: "What if the output is not smaller?", a: "Some PDFs are already optimized. The tool reports the actual before-and-after sizes and will not claim savings that did not occur." }
    ],
    'word-to-pdf': [
      { q: "How does Word to PDF work?", a: "DOCX paragraph text is extracted locally with Mammoth and paginated into a PDF. Complex Word layout, floating objects, and native pagination are not preserved." }
    ],
    'ocr-pdf': [
      { q: "What is OCR PDF?", a: "Optical Character Recognition scans non-selectable texts in scanned PDFs or images and converts them into searchable, copyable text characters." },
      { q: "Which languages are supported by the OCR tool?", a: "This deployment enables English OCR. The OCR core and English language model are downloaded on first use, while the selected PDF pages remain in your browser." }
    ],
    'background-remover': [
      { q: "How does the Background Remover work?", a: "GXA Toolbox lazy-loads a local U2NetP ONNX segmentation model in your browser, creates a soft alpha mask, and opens that mask in Advanced Cutout Studio for refinement." },
      { q: "What image formats are supported?", a: "You can upload JPG, JPEG, PNG, or WEBP images. The output is always delivered as a transparent PNG." },
      { q: "Is background removal processed on a server?", a: "No. Automatic subject removal runs locally in your browser. The legacy PHP color-key endpoint is not used for the primary Background Remover workflow." }
    ]
  };
  
  if (customFAQs[toolId]) {
    return [...customFAQs[toolId], ...generic];
  }
  
  return [
    { q: `How does ${toolName} process data?`, a: privacyAnswer },
    ...generic
  ];
}

// --- Related Tools rendering ---
function loadCropperAssets() {
  if (window.Cropper) return Promise.resolve(window.Cropper);
  if (cropperAssetsPromise) return cropperAssetsPromise;

  cropperAssetsPromise = new Promise((resolve, reject) => {
    if (!document.getElementById('gxa-cropper-css')) {
      const stylesheet = document.createElement('link');
      stylesheet.id = 'gxa-cropper-css';
      stylesheet.rel = 'stylesheet';
      stylesheet.href = 'https://cdnjs.cloudflare.com/ajax/libs/cropperjs/' + CROP_IMAGE_LIBRARY_VERSION + '/cropper.min.css';
      stylesheet.onerror = () => {
        stylesheet.onerror = null;
        stylesheet.href = 'https://cdn.jsdelivr.net/npm/cropperjs@' + CROP_IMAGE_LIBRARY_VERSION + '/dist/cropper.min.css';
      };
      document.head.appendChild(stylesheet);
    }

    const sources = [
      'https://cdnjs.cloudflare.com/ajax/libs/cropperjs/' + CROP_IMAGE_LIBRARY_VERSION + '/cropper.min.js',
      'https://cdn.jsdelivr.net/npm/cropperjs@' + CROP_IMAGE_LIBRARY_VERSION + '/dist/cropper.min.js'
    ];
    const loadSource = index => {
      if (index >= sources.length) {
        cropperAssetsPromise = null;
        reject(new Error('The crop editor could not be loaded. Check your connection and try again.'));
        return;
      }
      const script = document.createElement('script');
      script.src = sources[index];
      script.async = true;
      script.dataset.gxaCropper = 'true';
      script.onload = () => window.Cropper ? resolve(window.Cropper) : loadSource(index + 1);
      script.onerror = () => {
        script.remove();
        loadSource(index + 1);
      };
      document.head.appendChild(script);
    };
    loadSource(0);
  });
  return cropperAssetsPromise;
}

function renderCropImageEditor(container, tool, processingProfile, faqHTML) {
  disposeCropImageEditor();
  container.innerHTML = `
    <section class="container tool-container crop-image-page">
      <div class="tool-header">
        <div class="breadcrumb">
          <span class="breadcrumb-link" onclick="navigate('home')">Home</span><span>&gt;</span>
          <span class="breadcrumb-link" style="text-transform:uppercase;">${tool.category}</span><span>&gt;</span>
          <span>${tool.name}</span>
        </div>
        <div class="tool-title-wrapper">
          <div class="tool-heading-group">
            <span class="tool-page-icon cat-${tool.category}"><i data-lucide="${tool.icon}"></i></span>
            <div><span class="tool-category-label">Image tool</span><h1 class="tool-page-title">Crop Image</h1></div>
          </div>
          <div class="tool-heading-actions">
            <button class="favorite-button tool-favorite ${appState.favorites.includes(tool.id) ? 'active' : ''}" aria-label="Toggle Crop Image favorite" onclick="toggleFavorite('crop-image'); this.classList.toggle('active')"><i data-lucide="star"></i><span>Favorite</span></button>
            <div class="tool-badge processing-badge processing-${processingProfile.kind}"><i data-lucide="shield-check"></i> ${processingProfile.label}</div>
          </div>
        </div>
        <p class="section-desc" style="text-align:left;">Select an exact area, refine its size and position, then export a production-ready image.</p>
        <p class="processing-disclosure">${processingProfile.detail}</p>
      </div>

      <div id="crop-editor-workspace" class="crop-editor-grid">
        <div class="crop-editor-main">
          <div class="crop-editor-toolbar" role="toolbar" aria-label="Image view and transform controls">
            <div class="crop-toolbar-group">
              <button type="button" class="crop-tool-btn" onclick="cropEditorZoom(-0.1)" title="Zoom out (-)" aria-label="Zoom out"><i data-lucide="zoom-out"></i></button>
              <output id="crop-zoom-label" class="crop-zoom-label" aria-live="polite">100%</output>
              <button type="button" class="crop-tool-btn" onclick="cropEditorZoom(0.1)" title="Zoom in (+)" aria-label="Zoom in"><i data-lucide="zoom-in"></i></button>
              <button type="button" class="crop-tool-btn crop-tool-text" onclick="cropEditorFit()" title="Fit image to canvas">Fit</button>
              <button type="button" class="crop-tool-btn crop-tool-text" onclick="cropEditorActual()" title="Show image at actual size">1:1</button>
            </div>
            <div class="crop-toolbar-group">
              <button id="crop-undo-button" type="button" class="crop-tool-btn" onclick="cropEditorUndo()" title="Undo (Ctrl/Cmd+Z)" aria-label="Undo crop edit" disabled><i data-lucide="undo-2"></i></button>
              <button id="crop-redo-button" type="button" class="crop-tool-btn" onclick="cropEditorRedo()" title="Redo (Ctrl/Cmd+Y)" aria-label="Redo crop edit" disabled><i data-lucide="redo-2"></i></button>
              <button type="button" class="crop-tool-btn" onclick="cropEditorRotate(-90)" title="Rotate left" aria-label="Rotate left"><i data-lucide="rotate-ccw"></i></button>
              <button type="button" class="crop-tool-btn" onclick="cropEditorRotate(90)" title="Rotate right" aria-label="Rotate right"><i data-lucide="rotate-cw"></i></button>
              <button type="button" class="crop-tool-btn" onclick="cropEditorFlip('horizontal')" title="Flip horizontally" aria-label="Flip horizontally"><i data-lucide="flip-horizontal-2"></i></button>
              <button type="button" class="crop-tool-btn" onclick="cropEditorFlip('vertical')" title="Flip vertically" aria-label="Flip vertically"><i data-lucide="flip-vertical-2"></i></button>
              <button type="button" class="crop-tool-btn" onclick="cropEditorResetView()" title="Reset image and selection" aria-label="Reset image and selection"><i data-lucide="refresh-ccw"></i></button>
            </div>
          </div>

          <div id="crop-canvas-stage" class="crop-canvas-stage" tabindex="0" aria-label="Manual image crop canvas">
            <div id="crop-upload-state" class="crop-upload-state">
              <span class="upload-icon-shell"><i data-lucide="scan-line"></i></span>
              <h2>Choose an image to crop</h2>
              <p>Drop a JPG, PNG, or WebP image here, or select one from your device.</p>
              <button type="button" class="btn btn-primary btn-lg" onclick="document.getElementById('crop-file-picker').click()"><i data-lucide="image-up"></i> Select image</button>
              <p class="crop-upload-hint">Maximum file size: 50 MB</p>
            </div>
            <div id="crop-image-mount" class="crop-image-mount hidden">
              <img id="crop-editor-image" alt="Image ready for manual cropping">
            </div>
            <div id="crop-library-error" class="crop-library-error hidden" role="alert"></div>
          </div>
          <input id="crop-file-picker" type="file" accept="image/jpeg,image/png,image/webp" hidden>
          <div class="crop-canvas-footer">
            <span id="crop-editor-status" role="status" aria-live="polite">Select an image to begin.</span>
            <span class="crop-shortcuts">Wheel/pinch to zoom · Space + drag to pan · Arrow keys to nudge</span>
          </div>
          <div class="crop-mobile-primary-actions" aria-label="Crop actions">
            <button id="crop-mobile-apply-button" type="button" class="btn btn-primary btn-lg" onclick="createCropImageResult()" disabled><i data-lucide="crop"></i> Apply Crop</button>
            <span>Advanced format and quality controls are available in Settings.</span>
          </div>
        </div>

        <aside class="crop-options-panel" aria-label="Crop options">
          <div class="crop-panel-heading">
            <div><span class="tool-category-label">Precision controls</span><h2>Crop Options</h2></div>
            <button type="button" class="crop-panel-icon-btn" onclick="cropEditorResetSelection()" title="Reset selection" aria-label="Reset crop selection"><i data-lucide="scan"></i></button>
          </div>

          <div class="crop-source-stats" aria-label="Image details">
            <div><span>Source</span><strong id="crop-source-dimensions">—</strong></div>
            <div><span>File size</span><strong id="crop-source-size">—</strong></div>
            <div><span>Crop</span><strong id="crop-selection-dimensions">—</strong></div>
          </div>

          <fieldset class="crop-fieldset">
            <legend>Position and size <span>original pixels</span></legend>
            <div class="crop-number-grid">
              <label for="crop-width">Width<input id="crop-width" type="number" min="1" step="1" inputmode="numeric" disabled></label>
              <label for="crop-height">Height<input id="crop-height" type="number" min="1" step="1" inputmode="numeric" disabled></label>
              <label for="crop-x">X<input id="crop-x" type="number" min="0" step="1" inputmode="numeric" disabled></label>
              <label for="crop-y">Y<input id="crop-y" type="number" min="0" step="1" inputmode="numeric" disabled></label>
            </div>
            <p id="crop-field-error" class="crop-field-error" role="alert" aria-live="assertive"></p>
          </fieldset>

          <fieldset class="crop-fieldset">
            <legend>Aspect ratio</legend>
            <label class="crop-select-label" for="crop-aspect-select">Preset</label>
            <select id="crop-aspect-select" class="form-input-text crop-select" onchange="setCropAspect(this.value)" disabled>
              <option value="free">Free</option>
              <option value="original">Original</option>
              <option value="1:1">1:1 Square</option>
              <option value="4:5">4:5 Portrait</option>
              <option value="5:4">5:4 Landscape</option>
              <option value="4:3">4:3 Landscape</option>
              <option value="3:4">3:4 Portrait</option>
              <option value="3:2">3:2 Photo</option>
              <option value="2:3">2:3 Portrait photo</option>
              <option value="16:9">16:9 Widescreen</option>
              <option value="9:16">9:16 Story</option>
              <option value="820:312">Facebook Cover (820:312)</option>
              <option value="4:1">LinkedIn Banner (4:1)</option>
              <option value="custom">Custom</option>
            </select>
            <div id="crop-custom-ratio" class="crop-custom-ratio hidden">
              <label for="crop-custom-width">Width<input id="crop-custom-width" type="number" min="1" value="5" onchange="applyCustomCropAspect()"></label>
              <span>:</span>
              <label for="crop-custom-height">Height<input id="crop-custom-height" type="number" min="1" value="4" onchange="applyCustomCropAspect()"></label>
            </div>
          </fieldset>

          <fieldset class="crop-fieldset">
            <legend>Output</legend>
            <label class="crop-select-label" for="crop-output-format">Format</label>
            <select id="crop-output-format" class="form-input-text crop-select" onchange="updateCropOutputControls()">
              <option value="keep">Keep original format</option>
              <option value="image/jpeg">JPG</option>
              <option value="image/png">PNG</option>
              <option value="image/webp">WebP</option>
            </select>
            <div id="crop-quality-wrap" class="crop-output-option">
              <label for="crop-quality"><span>Quality</span><output id="crop-quality-label">90%</output></label>
              <input id="crop-quality" type="range" min="10" max="100" value="90" oninput="document.getElementById('crop-quality-label').value = this.value + '%'">
            </div>
            <div id="crop-jpeg-background" class="crop-output-option hidden">
              <label class="crop-select-label" for="crop-jpeg-bg-select">JPG background</label>
              <div class="crop-color-row">
                <select id="crop-jpeg-bg-select" class="form-input-text crop-select" onchange="updateCropBackgroundControl()">
                  <option value="#ffffff">White</option><option value="#000000">Black</option><option value="custom">Custom</option>
                </select>
                <input id="crop-jpeg-bg-custom" type="color" value="#ffffff" class="hidden" aria-label="Custom JPG background color">
              </div>
            </div>
          </fieldset>

          <button id="crop-apply-button" type="button" class="btn btn-primary btn-lg crop-primary-action" onclick="createCropImageResult()" disabled><i data-lucide="crop"></i> Crop image</button>
          <p class="crop-action-note">Double-click the crop area to apply. Your source file is never overwritten.</p>
        </aside>
      </div>

      <section id="crop-result-panel" class="crop-result-panel hidden" aria-labelledby="crop-result-title">
        <div class="crop-result-heading">
          <div><span class="tool-category-label">Export ready</span><h2 id="crop-result-title">Your cropped image is ready</h2></div>
          <span class="crop-result-check"><i data-lucide="check"></i></span>
        </div>
        <div class="crop-mobile-result-action">
          <button id="crop-mobile-download-button" type="button" class="btn btn-primary btn-lg" onclick="downloadCropResult()"><i data-lucide="download"></i> Download Cropped Image</button>
        </div>
        <div class="crop-result-compare">
          <figure><div class="crop-result-image-wrap"><img id="crop-before-image" alt="Original image before cropping"></div><figcaption>Before</figcaption></figure>
          <figure><div class="crop-result-image-wrap checkerboard"><img id="crop-after-image" alt="Cropped image result"></div><figcaption>After</figcaption></figure>
        </div>
        <div class="crop-result-meta">
          <div><span>Output dimensions</span><strong id="crop-result-dimensions">—</strong></div>
          <div><span>Actual output size</span><strong id="crop-result-size">—</strong></div>
          <div><span>Format</span><strong id="crop-result-format">—</strong></div>
        </div>
        <div class="crop-result-actions">
          <button id="crop-download-button" type="button" class="btn btn-primary btn-lg" onclick="downloadCropResult()"><i data-lucide="download"></i> Download Cropped Image</button>
          <button type="button" class="btn btn-secondary btn-lg" onclick="returnToCropEditor()"><i data-lucide="arrow-left"></i> Edit Crop Again</button>
          <button type="button" class="btn btn-ghost btn-lg" onclick="cropAnotherImage()"><i data-lucide="image-plus"></i> Crop another</button>
          <button type="button" class="btn btn-ghost btn-lg" onclick="resetCropImageTool()"><i data-lucide="refresh-cw"></i> Reset</button>
        </div>
      </section>

      <div class="related-tools-section crop-support-section">
        <h3>Related Utilities</h3><div class="tools-grid" id="related-tools-grid"></div>
      </div>
      <div class="faq-section"><h3 class="faq-title">Frequently Asked Questions</h3><div class="faq-list">${faqHTML}</div></div>
    </section>
  `;

  lucide.createIcons();
  renderRelatedTools('crop-image', tool.category);
  setupCropImageEditor();
  window.GxaPhaseOneStudios?.decorate('crop-image', processingProfile);
}

function setupCropImageEditor() {
  const picker = document.getElementById('crop-file-picker');
  const stage = document.getElementById('crop-canvas-stage');
  if (!picker || !stage) return;

  picker.addEventListener('change', event => {
    if (event.target.files && event.target.files[0]) openCropImageFile(event.target.files[0]);
    event.target.value = '';
  });
  ['dragenter', 'dragover'].forEach(type => stage.addEventListener(type, event => {
    event.preventDefault();
    stage.classList.add('is-dragover');
  }));
  ['dragleave', 'drop'].forEach(type => stage.addEventListener(type, event => {
    event.preventDefault();
    stage.classList.remove('is-dragover');
  }));
  stage.addEventListener('drop', event => {
    const file = event.dataTransfer && event.dataTransfer.files[0];
    if (file) openCropImageFile(file);
  });
  stage.addEventListener('dblclick', event => {
    if (cropEditorState.cropper && event.target.closest('.cropper-crop-box')) createCropImageResult();
  });

  ['crop-width', 'crop-height', 'crop-x', 'crop-y'].forEach(id => {
    const field = document.getElementById(id);
    field.addEventListener('change', applyCropNumericFields);
    field.addEventListener('keydown', event => {
      if (event.key === 'Enter') {
        event.preventDefault();
        applyCropNumericFields();
        field.blur();
      }
    });
  });

  cropEditorState.keydownHandler = handleCropEditorKeydown;
  cropEditorState.keyupHandler = handleCropEditorKeyup;
  document.addEventListener('keydown', cropEditorState.keydownHandler);
  document.addEventListener('keyup', cropEditorState.keyupHandler);
}

async function openCropImageFile(file) {
  const status = document.getElementById('crop-editor-status');
  const errorBox = document.getElementById('crop-library-error');
  if (!file || !['image/jpeg', 'image/png', 'image/webp'].includes(file.type)) {
    showCropEditorError('Choose a valid JPG, PNG, or WebP image.');
    return;
  }
  if (file.size > 50 * 1024 * 1024) {
    showCropEditorError('This image is larger than the 50 MB limit.');
    return;
  }

  destroyCropperInstance();
  revokeCropResult();
  if (cropEditorState.sourceUrl) URL.revokeObjectURL(cropEditorState.sourceUrl);
  cropEditorState.file = file;
  cropEditorState.sourceUrl = URL.createObjectURL(file);
  cropEditorState.scaleX = 1;
  cropEditorState.scaleY = 1;
  cropEditorState.rotation = 0;
  cropEditorState.lastCropData = null;
  if (status) status.textContent = 'Loading image and crop controls…';
  if (errorBox) errorBox.classList.add('hidden');

  const image = document.getElementById('crop-editor-image');
  document.getElementById('crop-upload-state').classList.add('hidden');
  document.getElementById('crop-image-mount').classList.remove('hidden');

  try {
    await new Promise((resolve, reject) => {
      image.onload = resolve;
      image.onerror = () => reject(new Error('The selected image is corrupted or unsupported by this browser.'));
      image.src = cropEditorState.sourceUrl;
    });
    cropEditorState.originalWidth = image.naturalWidth;
    cropEditorState.originalHeight = image.naturalHeight;
    document.getElementById('crop-source-dimensions').textContent = image.naturalWidth + ' × ' + image.naturalHeight + ' px';
    document.getElementById('crop-source-size').textContent = formatCropBytes(file.size);
    updateCropOutputControls();

    const CropperConstructor = await loadCropperAssets();
    if (appState.currentPage !== 'tool-crop-image' || cropEditorState.file !== file) return;
    cropEditorState.cropper = new CropperConstructor(image, {
      viewMode: 1,
      dragMode: 'crop',
      initialAspectRatio: NaN,
      autoCropArea: 0.82,
      responsive: true,
      restore: false,
      checkCrossOrigin: false,
      checkOrientation: true,
      modal: true,
      guides: true,
      center: true,
      highlight: false,
      background: false,
      movable: true,
      rotatable: true,
      scalable: true,
      zoomable: true,
      zoomOnTouch: true,
      zoomOnWheel: true,
      wheelZoomRatio: 0.08,
      cropBoxMovable: true,
      cropBoxResizable: true,
      toggleDragModeOnDblclick: false,
      minCropBoxWidth: 24,
      minCropBoxHeight: 24,
      ready() {
        document.querySelectorAll('#crop-image-mount .cropper-container img').forEach(cropImage => {
          if (cropImage !== image) {
            cropImage.alt = '';
            cropImage.setAttribute('aria-hidden', 'true');
          }
        });
        enableCropControls(true);
        syncCropEditorData();
        recordCropEditorHistory(true);
        updateCropZoomLabel();
        status.textContent = 'Drag the selection or any of its eight handles to crop.';
      },
      cropstart() {
        cropEditorState.lastCropData = cropEditorState.cropper.getData(true);
        document.getElementById('crop-canvas-stage').classList.add('is-cropping');
      },
      crop() {
        syncCropEditorData();
      },
      cropend() {
        document.getElementById('crop-canvas-stage').classList.remove('is-cropping');
        recordCropEditorHistory();
      },
      zoom() {
        window.requestAnimationFrame(updateCropZoomLabel);
      }
    });
  } catch (error) {
    destroyCropperInstance();
    document.getElementById('crop-image-mount').classList.add('hidden');
    document.getElementById('crop-upload-state').classList.remove('hidden');
    showCropEditorError(error.message || 'The crop editor could not open this image.');
  }
}

function showCropEditorError(message) {
  const errorBox = document.getElementById('crop-library-error');
  const status = document.getElementById('crop-editor-status');
  if (errorBox) {
    errorBox.textContent = message;
    errorBox.classList.remove('hidden');
  }
  if (status) status.textContent = message;
  showToast(message, 'error');
}

function enableCropControls(enabled) {
  ['crop-width', 'crop-height', 'crop-x', 'crop-y', 'crop-aspect-select'].forEach(id => {
    const element = document.getElementById(id);
    if (element) element.disabled = !enabled;
  });
  ['crop-apply-button', 'crop-mobile-apply-button'].forEach(id => {
    const applyButton = document.getElementById(id);
    if (applyButton) applyButton.disabled = !enabled;
  });
}

function syncCropEditorData() {
  const cropper = cropEditorState.cropper;
  if (!cropper) return;
  const data = cropper.getData(true);
  const values = {
    'crop-width': Math.max(1, Math.round(data.width)),
    'crop-height': Math.max(1, Math.round(data.height)),
    'crop-x': Math.max(0, Math.round(data.x)),
    'crop-y': Math.max(0, Math.round(data.y))
  };
  Object.entries(values).forEach(([id, value]) => {
    const field = document.getElementById(id);
    if (field && document.activeElement !== field) field.value = value;
  });
  const dimensions = document.getElementById('crop-selection-dimensions');
  if (dimensions) dimensions.textContent = values['crop-width'] + ' × ' + values['crop-height'] + ' px';
  clearCropFieldError();
}

function getCropEditorSnapshot() {
  if (!cropEditorState.cropper) return null;
  const data = cropEditorState.cropper.getData(true);
  return {
    data,
    rotation: cropEditorState.rotation,
    scaleX: cropEditorState.scaleX,
    scaleY: cropEditorState.scaleY,
    signature: [data.x, data.y, data.width, data.height, cropEditorState.rotation, cropEditorState.scaleX, cropEditorState.scaleY]
      .map(value => Math.round(Number(value) * 1000) / 1000).join(':')
  };
}

function updateCropHistoryButtons() {
  const undo = document.getElementById('crop-undo-button');
  const redo = document.getElementById('crop-redo-button');
  if (undo) undo.disabled = cropEditorState.history.length <= 1;
  if (redo) redo.disabled = cropEditorState.redoHistory.length === 0;
}

function recordCropEditorHistory(reset = false) {
  const snapshot = getCropEditorSnapshot();
  if (!snapshot) return;
  if (reset) {
    cropEditorState.history = [snapshot];
    cropEditorState.redoHistory = [];
  } else if (cropEditorState.history.at(-1)?.signature !== snapshot.signature) {
    cropEditorState.history.push(snapshot);
    if (cropEditorState.history.length > 30) cropEditorState.history.shift();
    cropEditorState.redoHistory = [];
  }
  updateCropHistoryButtons();
}

function applyCropEditorSnapshot(snapshot) {
  if (!snapshot || !cropEditorState.cropper) return;
  cropEditorState.rotation = snapshot.rotation;
  cropEditorState.scaleX = snapshot.scaleX;
  cropEditorState.scaleY = snapshot.scaleY;
  cropEditorState.cropper.rotateTo(snapshot.rotation);
  cropEditorState.cropper.scaleX(snapshot.scaleX);
  cropEditorState.cropper.scaleY(snapshot.scaleY);
  cropEditorState.cropper.setData(snapshot.data);
  syncCropEditorData();
  updateCropZoomLabel();
  updateCropHistoryButtons();
}

function cropEditorUndo() {
  if (cropEditorState.history.length <= 1) return;
  cropEditorState.redoHistory.push(cropEditorState.history.pop());
  applyCropEditorSnapshot(cropEditorState.history.at(-1));
}

function cropEditorRedo() {
  const snapshot = cropEditorState.redoHistory.pop();
  if (!snapshot) return;
  cropEditorState.history.push(snapshot);
  applyCropEditorSnapshot(snapshot);
}

function formatCropBytes(bytes) {
  if (window.GxaWorkspace && typeof window.GxaWorkspace.formatBytes === 'function') {
    return window.GxaWorkspace.formatBytes(bytes);
  }
  if (!Number.isFinite(bytes) || bytes <= 0) return '0 B';
  const units = ['B', 'KB', 'MB', 'GB'];
  const index = Math.min(Math.floor(Math.log(bytes) / Math.log(1024)), units.length - 1);
  return (bytes / Math.pow(1024, index)).toFixed(index ? 1 : 0) + ' ' + units[index];
}

function setCropFieldError(message) {
  const error = document.getElementById('crop-field-error');
  if (error) error.textContent = message;
  ['crop-width', 'crop-height', 'crop-x', 'crop-y'].forEach(id => {
    const field = document.getElementById(id);
    if (field) field.setAttribute('aria-invalid', message ? 'true' : 'false');
  });
}

function clearCropFieldError() {
  setCropFieldError('');
}

function applyCropNumericFields() {
  const cropper = cropEditorState.cropper;
  if (!cropper) return;
  const next = {
    width: Number(document.getElementById('crop-width').value),
    height: Number(document.getElementById('crop-height').value),
    x: Number(document.getElementById('crop-x').value),
    y: Number(document.getElementById('crop-y').value)
  };
  if (!Object.values(next).every(Number.isFinite)) {
    setCropFieldError('Enter a number in every field.');
    return;
  }
  if (next.width < 1 || next.height < 1) {
    setCropFieldError('Width and height must be at least 1 pixel.');
    return;
  }
  if (next.x < 0 || next.y < 0) {
    setCropFieldError('X and Y cannot be negative.');
    return;
  }
  const boundsWidth = cropEditorState.originalWidth;
  const boundsHeight = cropEditorState.originalHeight;
  if (next.x + next.width > boundsWidth || next.y + next.height > boundsHeight) {
    setCropFieldError('The crop must stay inside the ' + boundsWidth + ' × ' + boundsHeight + ' px source image.');
    return;
  }
  clearCropFieldError();
  cropper.setData(next);
  window.requestAnimationFrame(() => { syncCropEditorData(); recordCropEditorHistory(); });
}

function setCropAspect(value) {
  const cropper = cropEditorState.cropper;
  const custom = document.getElementById('crop-custom-ratio');
  if (custom) custom.classList.toggle('hidden', value !== 'custom');
  if (!cropper) return;
  if (value === 'custom') {
    applyCustomCropAspect();
    return;
  }
  let ratio = NaN;
  if (value === 'original') ratio = cropEditorState.originalWidth / cropEditorState.originalHeight;
  if (value.includes(':')) {
    const parts = value.split(':').map(Number);
    ratio = parts[0] / parts[1];
  }
  cropper.setAspectRatio(ratio);
  window.requestAnimationFrame(syncCropEditorData);
}

function applyCustomCropAspect() {
  const cropper = cropEditorState.cropper;
  const width = Number(document.getElementById('crop-custom-width').value);
  const height = Number(document.getElementById('crop-custom-height').value);
  if (!cropper || width <= 0 || height <= 0) {
    setCropFieldError('Enter a valid custom aspect ratio.');
    return;
  }
  clearCropFieldError();
  cropper.setAspectRatio(width / height);
  window.requestAnimationFrame(syncCropEditorData);
}

function cropEditorZoom(amount) {
  if (!cropEditorState.cropper) return;
  cropEditorState.cropper.zoom(amount);
  updateCropZoomLabel();
}

function updateCropZoomLabel() {
  if (!cropEditorState.cropper) return;
  const imageData = cropEditorState.cropper.getImageData();
  const label = document.getElementById('crop-zoom-label');
  const ratio = Number.isFinite(imageData.ratio)
    ? imageData.ratio
    : imageData.naturalWidth > 0 ? imageData.width / imageData.naturalWidth : 1;
  if (label && Number.isFinite(ratio)) label.value = Math.round(ratio * 100) + '%';
}

function cropEditorFit() {
  const cropper = cropEditorState.cropper;
  if (!cropper) return;
  const data = cropper.getData(true);
  cropper.reset();
  cropEditorState.scaleX = 1;
  cropEditorState.scaleY = 1;
  cropEditorState.rotation = 0;
  setCropAspect(document.getElementById('crop-aspect-select').value);
  cropper.setData(data);
  updateCropZoomLabel();
  syncCropEditorData();
}

function cropEditorActual() {
  const cropper = cropEditorState.cropper;
  if (!cropper) return;
  const container = cropper.getContainerData();
  const image = cropper.getImageData();
  cropper.setCanvasData({
    left: (container.width - image.naturalWidth) / 2,
    top: (container.height - image.naturalHeight) / 2,
    width: image.naturalWidth,
    height: image.naturalHeight
  });
  updateCropZoomLabel();
}

function cropEditorRotate(degrees) {
  if (!cropEditorState.cropper) return;
  cropEditorState.rotation = (cropEditorState.rotation + degrees + 360) % 360;
  cropEditorState.cropper.rotate(degrees);
  window.requestAnimationFrame(() => {
    syncCropEditorData();
    updateCropZoomLabel();
    recordCropEditorHistory();
  });
}

function cropEditorFlip(direction) {
  if (!cropEditorState.cropper) return;
  if (direction === 'horizontal') {
    cropEditorState.scaleX *= -1;
    cropEditorState.cropper.scaleX(cropEditorState.scaleX);
  } else {
    cropEditorState.scaleY *= -1;
    cropEditorState.cropper.scaleY(cropEditorState.scaleY);
  }
  recordCropEditorHistory();
}

function cropEditorResetView() {
  const cropper = cropEditorState.cropper;
  if (!cropper) return;
  cropEditorState.scaleX = 1;
  cropEditorState.scaleY = 1;
  cropEditorState.rotation = 0;
  cropper.reset();
  setCropAspect(document.getElementById('crop-aspect-select').value);
  syncCropEditorData();
  updateCropZoomLabel();
  recordCropEditorHistory();
}

function cropEditorResetSelection() {
  const cropper = cropEditorState.cropper;
  if (!cropper) return;
  const canvas = cropper.getCanvasData();
  const image = cropper.getImageData();
  const width = Math.min(image.naturalWidth, Math.max(1, image.naturalWidth * 0.82));
  const height = Math.min(image.naturalHeight, Math.max(1, image.naturalHeight * 0.82));
  cropper.clear();
  cropper.crop();
  cropper.setData({
    x: (image.naturalWidth - width) / 2,
    y: (image.naturalHeight - height) / 2,
    width,
    height
  });
  if (canvas.width <= 0) cropper.reset();
  setCropAspect(document.getElementById('crop-aspect-select').value);
  syncCropEditorData();
  recordCropEditorHistory();
}

function handleCropEditorKeydown(event) {
  if (appState.currentPage !== 'tool-crop-image' || !cropEditorState.cropper) return;
  if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'z') {
    event.preventDefault();
    event.shiftKey ? cropEditorRedo() : cropEditorUndo();
    return;
  }
  if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'y') {
    event.preventDefault();
    cropEditorRedo();
    return;
  }
  const isFormControl = event.target && /^(INPUT|SELECT|TEXTAREA|BUTTON)$/.test(event.target.tagName);
  if (isFormControl) return;
  const cropper = cropEditorState.cropper;
  if (event.code === 'Space') {
    event.preventDefault();
    cropper.setDragMode('move');
    document.getElementById('crop-canvas-stage')?.classList.add('is-panning');
    return;
  }
  if (event.key === '+' || event.key === '=') {
    event.preventDefault();
    cropEditorZoom(0.1);
    return;
  }
  if (event.key === '-') {
    event.preventDefault();
    cropEditorZoom(-0.1);
    return;
  }
  if (event.key === 'Escape' && cropEditorState.lastCropData) {
    event.preventDefault();
    cropper.setData(cropEditorState.lastCropData);
    syncCropEditorData();
    return;
  }
  const deltas = {
    ArrowLeft: [-1, 0], ArrowRight: [1, 0],
    ArrowUp: [0, -1], ArrowDown: [0, 1]
  };
  if (!deltas[event.key]) return;
  event.preventDefault();
  const distance = event.shiftKey ? 10 : 1;
  const data = cropper.getData(true);
  const dx = deltas[event.key][0] * distance;
  const dy = deltas[event.key][1] * distance;
  data.x = Math.max(0, Math.min(cropEditorState.originalWidth - data.width, data.x + dx));
  data.y = Math.max(0, Math.min(cropEditorState.originalHeight - data.height, data.y + dy));
  cropper.setData(data);
  syncCropEditorData();
  recordCropEditorHistory();
}

function handleCropEditorKeyup(event) {
  if (event.code !== 'Space' || !cropEditorState.cropper) return;
  cropEditorState.cropper.setDragMode('crop');
  document.getElementById('crop-canvas-stage')?.classList.remove('is-panning');
}

function updateCropOutputControls() {
  const format = document.getElementById('crop-output-format')?.value || 'keep';
  const effective = format === 'keep' ? cropEditorState.file?.type : format;
  document.getElementById('crop-quality-wrap')?.classList.toggle('hidden', effective === 'image/png');
  document.getElementById('crop-jpeg-background')?.classList.toggle('hidden', effective !== 'image/jpeg');
}

function updateCropBackgroundControl() {
  const select = document.getElementById('crop-jpeg-bg-select');
  document.getElementById('crop-jpeg-bg-custom')?.classList.toggle('hidden', select?.value !== 'custom');
}

function getCropOutputSettings() {
  const selected = document.getElementById('crop-output-format')?.value || 'keep';
  const mime = selected === 'keep' ? (cropEditorState.file?.type || 'image/png') : selected;
  const extensions = { 'image/jpeg': 'jpg', 'image/png': 'png', 'image/webp': 'webp' };
  const quality = Number(document.getElementById('crop-quality')?.value || 90) / 100;
  const backgroundSelect = document.getElementById('crop-jpeg-bg-select');
  const background = backgroundSelect?.value === 'custom'
    ? document.getElementById('crop-jpeg-bg-custom')?.value
    : backgroundSelect?.value;
  return { mime, extension: extensions[mime] || 'png', quality, background: background || '#ffffff' };
}

async function createCropImageResult() {
  const cropper = cropEditorState.cropper;
  const button = document.getElementById('crop-apply-button');
  const mobileButton = document.getElementById('crop-mobile-apply-button');
  if (!cropper || !cropEditorState.file || button?.disabled) return;
  const data = cropper.getData(true);
  const width = Math.round(data.width);
  const height = Math.round(data.height);
  if (width < 1 || height < 1) {
    setCropFieldError('Select an area at least 1 × 1 pixel.');
    return;
  }
  const settings = getCropOutputSettings();
  const originalText = button.innerHTML;
  const mobileOriginalText = mobileButton?.innerHTML;
  button.disabled = true;
  button.innerHTML = '<span class="spinner spinner-inline"></span> Cropping image…';
  if (mobileButton) {
    mobileButton.disabled = true;
    mobileButton.innerHTML = '<span class="spinner spinner-inline"></span> Processing crop…';
  }
  document.getElementById('crop-editor-status').textContent = 'Rendering the cropped image…';

  try {
    const canvas = cropper.getCroppedCanvas({
      width,
      height,
      fillColor: settings.mime === 'image/jpeg' ? settings.background : 'transparent',
      imageSmoothingEnabled: true,
      imageSmoothingQuality: 'high'
    });
    if (!canvas) throw new Error('The selected crop could not be rendered.');
    const blob = await new Promise((resolve, reject) => {
      canvas.toBlob(result => result ? resolve(result) : reject(new Error('This browser could not encode the cropped image.')), settings.mime, settings.quality);
    });

    let outputWidth = canvas.width;
    let outputHeight = canvas.height;
    if ('createImageBitmap' in window) {
      const bitmap = await createImageBitmap(blob);
      outputWidth = bitmap.width;
      outputHeight = bitmap.height;
      bitmap.close();
    }
    revokeCropResult();
    cropEditorState.resultBlob = blob;
    cropEditorState.resultUrl = URL.createObjectURL(blob);
    cropEditorState.resultFilename = makeCroppedFilename(cropEditorState.file.name, settings.extension);

    document.getElementById('crop-before-image').src = cropEditorState.sourceUrl;
    document.getElementById('crop-after-image').src = cropEditorState.resultUrl;
    document.getElementById('crop-result-dimensions').textContent = outputWidth + ' × ' + outputHeight + ' px';
    document.getElementById('crop-result-size').textContent = formatCropBytes(blob.size);
    document.getElementById('crop-result-format').textContent = settings.extension.toUpperCase();
    ['crop-download-button', 'crop-mobile-download-button'].forEach(id => {
      const downloadButton = document.getElementById(id);
      if (downloadButton) downloadButton.title = 'Download ' + cropEditorState.resultFilename;
    });
    window.GxaPhaseOneStudios?.closeDrawer?.();
    document.getElementById('crop-result-panel').classList.remove('hidden');
    document.getElementById('crop-editor-workspace').classList.add('hidden');
    document.getElementById('crop-editor-status').textContent = 'Crop complete. Your source image was not changed.';
    logCropImageHistory(blob);
    lucide.createIcons();
    document.getElementById('crop-result-panel').scrollIntoView({ behavior: 'smooth', block: 'start' });
  } catch (error) {
    showCropEditorError(error.message || 'The cropped image could not be created.');
  } finally {
    button.disabled = false;
    button.innerHTML = originalText;
    if (mobileButton) {
      mobileButton.disabled = false;
      mobileButton.innerHTML = mobileOriginalText;
    }
    lucide.createIcons();
  }
}

function makeCroppedFilename(filename, extension) {
  const base = String(filename || 'image').replace(/\.[^.]+$/, '').replace(/[\\/:*?"<>|]+/g, '-').trim() || 'image';
  return 'cropped-' + base + '.' + extension;
}

function logCropImageHistory(blob) {
  if (typeof logHistory === 'function') {
    try {
      logHistory(cropEditorState.resultFilename, 'Crop Image', formatCropBytes(blob.size));
    } catch (error) {
      // History is supplementary; a storage failure must never block the download.
    }
  }
}

function downloadCropResult() {
  if (!cropEditorState.resultBlob) return;
  saveBlob(cropEditorState.resultBlob, cropEditorState.resultFilename || 'cropped-image.png');
}

function returnToCropEditor() {
  document.getElementById('crop-result-panel')?.classList.add('hidden');
  document.getElementById('crop-editor-workspace')?.classList.remove('hidden');
  document.getElementById('crop-canvas-stage')?.focus({ preventScroll: true });
}

function cropAnotherImage() {
  returnToCropEditor();
  document.getElementById('crop-file-picker')?.click();
}

function resetCropImageTool() {
  disposeCropImageEditor();
  if (appState.currentPage === 'tool-crop-image') renderPage();
}

function revokeCropResult() {
  if (cropEditorState.resultUrl) URL.revokeObjectURL(cropEditorState.resultUrl);
  cropEditorState.resultUrl = '';
  cropEditorState.resultBlob = null;
  cropEditorState.resultFilename = '';
}

function destroyCropperInstance() {
  if (cropEditorState.cropper) {
    cropEditorState.cropper.destroy();
    cropEditorState.cropper = null;
  }
  enableCropControls(false);
}

function disposeCropImageEditor() {
  destroyCropperInstance();
  if (cropEditorState.sourceUrl) URL.revokeObjectURL(cropEditorState.sourceUrl);
  revokeCropResult();
  if (cropEditorState.keydownHandler) document.removeEventListener('keydown', cropEditorState.keydownHandler);
  if (cropEditorState.keyupHandler) document.removeEventListener('keyup', cropEditorState.keyupHandler);
  Object.assign(cropEditorState, {
    file: null,
    sourceUrl: '',
    originalWidth: 0,
    originalHeight: 0,
    scaleX: 1,
    scaleY: 1,
    rotation: 0,
    lastCropData: null,
    history: [],
    redoHistory: [],
    keydownHandler: null,
    keyupHandler: null
  });
}

function renderBackgroundRemoverRoute(container, tool, processingProfile, faqHTML, optionsHTML, accepts, processActionLabel) {
  container.innerHTML = `
    <section class="container background-remover-page">
      <div class="bg-remover-hero">
        <div>
          <div class="breadcrumb">
            <span class="breadcrumb-link" onclick="navigate('home')">Home</span>
            <span>&gt;</span>
            <span>Background Remover</span>
          </div>
          <span class="tool-category-label">Browser-local cutout studio</span>
          <h1 class="tool-page-title">${tool.name}</h1>
          <p class="section-desc">Upload a JPG, PNG, or WEBP image and GXA Toolbox automatically creates a real transparent cutout using local foreground segmentation.</p>
        </div>
        <div class="bg-remover-privacy-card">
          <i data-lucide="shield-check"></i>
          <strong>Processed privately in your browser</strong>
          <span>${processingProfile.detail}</span>
        </div>
      </div>

      <div class="bg-remover-workflow" data-tool-id="background-remover">
        <aside class="bg-remover-left-rail" aria-label="Background Remover tools">
          ${['Auto', 'Erase', 'Restore', 'Refine Edge', 'Background', 'Crop'].map((label, index) => `<span class="${index === 0 ? 'active' : ''}">${label}</span>`).join('')}
        </aside>

        <main class="bg-remover-main">
          <div id="tool-upload-mount">
            <div class="bg-remover-upload-grid">
              <div class="upload-zone bg-remover-upload-zone" id="drop-zone" role="button" tabindex="0" aria-label="Choose an image for Background Remover" onclick="document.getElementById('file-picker').click()">
                <span class="upload-icon-shell"><i data-lucide="image-up" class="upload-icon"></i></span>
                <h3 class="upload-title">Choose an image</h3>
                <p class="upload-subtitle">or drop a JPG, PNG, or WEBP here</p>
                <div class="upload-formats">
                  <span class="format-chip">JPG</span>
                  <span class="format-chip">PNG</span>
                  <span class="format-chip">WEBP</span>
                </div>
                <p class="upload-limit"><i data-lucide="info"></i> Automatic segmentation starts after selection.</p>
                <input type="file" id="file-picker" style="display:none;" accept="${accepts}">
              </div>
              <div class="bg-remover-reference-panel">
                <strong>Dedicated editor flow</strong>
                <p>Auto cutout opens in Advanced Cutout Studio with editable mask painting, backgrounds, crop, effects, layers, and export.</p>
                <ul>
                  <li>Real soft alpha mask</li>
                  <li>No third-party upload</li>
                  <li>No near-white color-key fallback</li>
                </ul>
              </div>
            </div>
          </div>

          <div id="tool-queue-mount" class="hidden bg-remover-selected-state">
            <div class="bg-remover-selected-preview" id="bg-remover-selected-preview" aria-live="polite"></div>
            <div class="queue-header">
              <h4 class="form-label">Selected image</h4>
              <button class="btn btn-ghost btn-sm" onclick="clearSelectedFiles()">Choose another</button>
            </div>
            <div class="file-queue" id="file-queue-container"></div>
            <button class="btn btn-primary btn-lg hidden" id="btn-process-action" onclick="runFileProcessingPipeline()">${processActionLabel}</button>
          </div>

          <div id="tool-processing-mount" class="hidden">
            <div class="processing-card bg-remover-processing-card">
              <div class="processing-orbit"><div class="spinner"></div><i data-lucide="sparkles"></i></div>
              <h3 class="upload-title" id="processing-stage-label">Loading removal engine</h3>
              <p class="upload-subtitle">Creating a real editable transparency mask from your image.</p>
              <div class="bg-remover-selected-preview compact" id="bg-remover-processing-preview"></div>
              <div class="progress-bar-container">
                <div class="progress-bar-fill shimmer-bg" id="global-progress-bar"></div>
              </div>
              <div class="processing-stages" id="processing-stages" aria-label="Processing stages">
                <span class="active" data-stage="validate"><i data-lucide="check"></i> Reading</span>
                <span data-stage="process"><i data-lucide="loader-circle"></i> Segmenting</span>
                <span data-stage="generate"><i data-lucide="file-output"></i> Mask</span>
                <span data-stage="finish"><i data-lucide="check-circle-2"></i> Editor</span>
              </div>
              <button type="button" id="btn-cancel-processing" class="btn btn-ghost hidden" onclick="cancelActiveBatch()">Cancel after current file</button>
            </div>
          </div>

          <div id="tool-complete-mount" class="hidden bg-remover-editor-state">
            <div class="bg-remover-editor-card">
              <div class="bg-remover-editor-heading">
                <div>
                  <span class="tool-category-label">Advanced Cutout Studio</span>
                  <h2 class="complete-title">Background Remover Editor</h2>
                  <p class="upload-subtitle">Refine the generated alpha mask, replace the background, crop, style, and export.</p>
                </div>
                <button class="btn btn-primary btn-lg" id="btn-download-result" disabled><i data-lucide="download"></i> Download</button>
              </div>
              <div id="premium-result-preview" class="premium-result-preview" aria-live="polite"></div>
              <div id="comparison-metric-mount" class="complete-comparison hidden"></div>
              <div id="premium-result-stats" class="premium-result-stats" aria-label="Output statistics"></div>
              <div class="premium-result-actions bg-remover-result-actions">
                <button class="btn btn-secondary btn-lg" id="btn-copy-result-link" onclick="copyPremiumResultLink()" disabled><i data-lucide="link"></i> Copy local link</button>
                <button class="btn btn-ghost btn-lg" onclick="resetActiveTool()"><i data-lucide="refresh-cw"></i> Start Over</button>
              </div>
            </div>
          </div>
        </main>

        <aside class="bg-remover-right-panel">
          <div class="tool-options-panel">
            <div class="options-title"><span><i data-lucide="sliders-horizontal"></i> Auto mode</span><small>Advanced processing</small></div>
            ${optionsHTML}
            <div id="premium-live-stats" class="premium-live-stats" aria-live="polite"></div>
          </div>
        </aside>
      </div>

      <div class="faq-section bg-remover-faq">
        <h3 class="faq-title">Frequently Asked Questions</h3>
        <div class="faq-list">${faqHTML}</div>
      </div>
    </section>
  `;

  lucide.createIcons();
  setupUploadZoneEvents();
  renderPremiumSessionHistory();
}

function renderRelatedTools(currentToolId, category) {
  const container = document.getElementById('related-tools-grid');
  if (!container) return;
  
  let related = toolsList.filter(t => t.id !== currentToolId && t.category === category);
  if (related.length < 4) {
    related = related.concat(toolsList.filter(t => t.id !== currentToolId && t.category !== category));
  }
  
  // Shuffle/select first 4 unique items
  related = Array.from(new Set(related)).slice(0, 4);
  
  container.innerHTML = '';
  related.forEach(tool => {
    const card = document.createElement('a');
    card.className = `tool-card cat-${tool.category}`;
    card.style.position = 'relative';
    card.innerHTML = `
      <div class="tool-card-icon"><i data-lucide="${tool.icon}"></i></div>
      <h3 class="tool-card-title">${tool.name}</h3>
      <p class="tool-card-desc">${tool.desc}</p>
    `;
    card.addEventListener('click', (e) => {
      e.preventDefault();
      navigate(`tool-${tool.id}`);
    });
    container.appendChild(card);
  });
  lucide.createIcons();
}

// --- FAQs Toggler Accordion ---
function toggleFaq(btn) {
  const item = btn.parentElement;
  item.classList.toggle('active');
}

let html2CanvasPromise = null;

function runActiveCalculator() {
  const calculatorRunners = {
    calculator: () => pressCalcKey('='),
    'scientific-calculator': () => pressSciKey('='),
    'percentage-calculator': generatePercentageCalc,
    'age-calculator': generateAgeCalc,
    'date-calculator': generateDateCalc,
    'emi-calculator': generateEMICalc,
    'loan-calculator': generateLoanCalc,
    'interest-calculator': generateInterestCalc,
    'gst-calculator': generateGstCalc,
    'sip-calculator': generateSipCalc,
    'bmi-calculator': generateBmiCalc,
    'discount-calculator': generateDiscountCalc,
    'unit-converter': generateUnitConvert,
    'currency-converter': generateCurrencyConvert,
    'time-calculator': generateTimeCalc
  };
  const runner = calculatorRunners[appState.currentPage.replace('tool-', '')];
  if (runner) runner();
}

function initializePremiumToolEditor(toolId, needsFiles) {
  disposePremiumToolEditor();
  premiumEditorState.toolId = toolId;
  premiumEditorState.needsFiles = needsFiles;
  document.querySelectorAll('.premium-editor-workspace input:not([type="file"]), .premium-editor-workspace textarea, .premium-editor-workspace select').forEach((control, index) => {
    if (!control.id) control.id = 'premium-control-' + index;
  });
  renderPremiumEditorToolbar();
  renderPremiumSessionHistory();
  renderCalculatorFormulaReference();
  recordPremiumEditorState(true);
  updatePremiumLiveStats();

  const root = document.querySelector('.premium-editor-workspace');
  if (!root) return;
  premiumEditorState.inputHandler = event => {
    if (premiumEditorState.suppressHistory) return;
    if (!event.target.matches('input, textarea, select')) return;
    window.clearTimeout(premiumEditorState.historyTimer);
    premiumEditorState.historyTimer = window.setTimeout(() => {
      recordPremiumEditorState();
      updatePremiumLiveStats();
    }, 220);
  };
  root.addEventListener('input', premiumEditorState.inputHandler);
  root.addEventListener('change', premiumEditorState.inputHandler);
  premiumEditorState.clickHandler = event => {
    if (premiumEditorState.suppressHistory || !event.target.closest('button') || event.target.closest('.premium-command')) return;
    window.setTimeout(() => {
      recordPremiumEditorState();
      updatePremiumLiveStats();
    }, 0);
  };
  root.addEventListener('click', premiumEditorState.clickHandler);

  const preview = document.getElementById('generator-preview-mount');
  if (preview) {
    premiumEditorState.previewObserver = new MutationObserver(() => {
      if (premiumEditorState.previewUpdateFrame) return;
      premiumEditorState.previewUpdateFrame = window.requestAnimationFrame(() => {
        premiumEditorState.previewUpdateFrame = 0;
        updatePremiumLiveStats();
      });
    });
    premiumEditorState.previewObserver.observe(preview, { childList: true, subtree: true, characterData: true });
  }
  premiumEditorState.keydownHandler = handlePremiumEditorKeydown;
  document.addEventListener('keydown', premiumEditorState.keydownHandler);
  window.setTimeout(updatePremiumEditorButtons, 0);
}

function renderPremiumEditorToolbar() {
  const toolbar = document.getElementById('premium-editor-toolbar');
  if (!toolbar) return;
  const fileControls = premiumEditorState.needsFiles
    ? [
        '<button type="button" class="premium-command" onclick="document.getElementById(\'file-picker\')?.click()" aria-label="Add files"><i data-lucide="plus"></i><span>Add</span></button>',
        '<span class="premium-toolbar-separator"></span>',
        '<button type="button" class="premium-command" onclick="premiumPreviewAction(\'zoom-out\')" aria-label="Zoom preview out"><i data-lucide="zoom-out"></i></button>',
        '<button type="button" class="premium-command" onclick="premiumPreviewAction(\'zoom-in\')" aria-label="Zoom preview in"><i data-lucide="zoom-in"></i></button>',
        '<button type="button" class="premium-command" onclick="premiumPreviewAction(\'fit\')" aria-label="Fit preview"><i data-lucide="scan"></i><span>Fit</span></button>'
      ].join('')
    : [
        '<button type="button" class="premium-command" onclick="copyPremiumPreview()" aria-label="Copy current result"><i data-lucide="copy"></i><span>Copy</span></button>',
        '<button type="button" class="premium-command" onclick="sharePremiumPreview()" aria-label="Share current result"><i data-lucide="share-2"></i><span>Share</span></button>',
        '<button type="button" class="premium-command" onclick="exportPremiumPreview(\'png\')" aria-label="Download result as image"><i data-lucide="image-down"></i><span>PNG</span></button>',
        premiumEditorState.toolId.includes('calculator')
          ? '<button type="button" class="premium-command" onclick="exportPremiumPreview(\'pdf\')" aria-label="Download calculation as PDF"><i data-lucide="file-down"></i><span>PDF</span></button>'
          : ''
      ].join('');
  toolbar.innerHTML = [
    '<div class="premium-toolbar-group">',
      '<button id="premium-undo-button" type="button" class="premium-command" onclick="premiumUndo()" aria-label="Undo" title="Undo (Ctrl+Z)"><i data-lucide="undo-2"></i><span>Undo</span></button>',
      '<button id="premium-redo-button" type="button" class="premium-command" onclick="premiumRedo()" aria-label="Redo" title="Redo (Ctrl+Y)"><i data-lucide="redo-2"></i><span>Redo</span></button>',
      fileControls,
    '</div>',
    '<div class="premium-toolbar-group">',
      '<button type="button" class="premium-command" onclick="showPremiumShortcutHelp()" aria-label="Show keyboard shortcuts" title="Keyboard shortcuts"><i data-lucide="keyboard"></i></button>',
      '<button type="button" class="premium-command" onclick="resetPremiumEditor()" aria-label="Reset editor"><i data-lucide="refresh-ccw"></i><span>Reset</span></button>',
      '<button type="button" class="premium-command" onclick="togglePremiumFullscreen()" aria-label="Toggle focused editor view"><i data-lucide="maximize"></i></button>',
    '</div>'
  ].join('');
  lucide.createIcons();
}

function createPremiumEditorSnapshot() {
  const controls = Array.from(document.querySelectorAll('.premium-editor-workspace input[id], .premium-editor-workspace textarea[id], .premium-editor-workspace select[id]'))
    .filter(control => control.type !== 'file')
    .map(control => ({
      id: control.id,
      value: control.type === 'checkbox' || control.type === 'radio' ? control.checked : control.value,
      checked: control.checked,
      kind: control.type || control.tagName.toLowerCase()
    }));
  return {
    controls,
    files: appState.activeFiles.slice(),
    options: JSON.parse(JSON.stringify(appState.activeToolOptions || {})),
    transient: { calcExpression: appState.calcExpression || '', sciExpression: appState.sciExpression || '' },
    signature: JSON.stringify({
      controls: controls.map(control => [control.id, control.value, control.checked]),
      files: appState.activeFiles.map(file => [file.name, file.size, file.lastModified]),
      options: appState.activeToolOptions || {},
      transient: [appState.calcExpression || '', appState.sciExpression || '']
    })
  };
}

function recordPremiumEditorState(force) {
  if (premiumEditorState.suppressHistory || !premiumEditorState.toolId) return;
  const snapshot = createPremiumEditorSnapshot();
  const previous = premiumEditorState.undoStack[premiumEditorState.undoStack.length - 1];
  if (!force && previous && previous.signature === snapshot.signature) return;
  premiumEditorState.undoStack.push(snapshot);
  if (premiumEditorState.undoStack.length > 60) premiumEditorState.undoStack.shift();
  premiumEditorState.redoStack = [];
  updatePremiumEditorButtons();
}

function applyPremiumEditorSnapshot(snapshot) {
  if (!snapshot) return;
  premiumEditorState.suppressHistory = true;
  appState.activeToolOptions = JSON.parse(JSON.stringify(snapshot.options || {}));
  appState.calcExpression = snapshot.transient?.calcExpression || '';
  appState.sciExpression = snapshot.transient?.sciExpression || '';
  appState.activeFiles = snapshot.files.slice();
  snapshot.controls.forEach(saved => {
    const control = document.getElementById(saved.id);
    if (!control) return;
    if (control.type === 'checkbox' || control.type === 'radio') control.checked = Boolean(saved.checked);
    else control.value = saved.value;
  });
  if (premiumEditorState.needsFiles) {
    renderFileQueue();
  } else {
    snapshot.controls.forEach(saved => {
      const control = document.getElementById(saved.id);
      if (!control) return;
      control.dispatchEvent(new Event(control.tagName === 'SELECT' ? 'change' : 'input', { bubbles: true }));
    });
    if (premiumEditorState.toolId === 'calculator') generateSimpleCalc();
    if (premiumEditorState.toolId === 'scientific-calculator') generateScientificCalc();
  }
  premiumEditorState.suppressHistory = false;
  updatePremiumLiveStats();
  updatePremiumEditorButtons();
}

function premiumUndo() {
  if (premiumEditorState.undoStack.length <= 1) {
    showToast('Nothing to undo.', 'info');
    return;
  }
  const current = premiumEditorState.undoStack.pop();
  premiumEditorState.redoStack.push(current);
  applyPremiumEditorSnapshot(premiumEditorState.undoStack[premiumEditorState.undoStack.length - 1]);
}

function premiumRedo() {
  const snapshot = premiumEditorState.redoStack.pop();
  if (!snapshot) {
    showToast('Nothing to redo.', 'info');
    return;
  }
  premiumEditorState.undoStack.push(snapshot);
  applyPremiumEditorSnapshot(snapshot);
}

function updatePremiumEditorButtons() {
  const undo = document.getElementById('premium-undo-button');
  const redo = document.getElementById('premium-redo-button');
  if (undo) undo.disabled = premiumEditorState.undoStack.length <= 1;
  if (redo) redo.disabled = premiumEditorState.redoStack.length === 0;
}

function updatePremiumLiveStats() {
  const mount = document.getElementById('premium-live-stats');
  if (!mount) return;
  const preview = document.getElementById('generator-preview-mount');
  const totalBytes = appState.activeFiles.reduce((sum, file) => sum + file.size, 0);
  const outputText = preview ? preview.innerText.trim() : '';
  const inputs = document.querySelectorAll('.premium-editor-workspace input:not([type="file"]), .premium-editor-workspace textarea, .premium-editor-workspace select').length;
  const items = premiumEditorState.needsFiles
    ? [
        ['Files', String(appState.activeFiles.length)],
        ['Total size', window.GxaWorkspace ? window.GxaWorkspace.formatBytes(totalBytes) : formatCropBytes(totalBytes)],
        ['Selected', appState.activeFiles[appState.activePreviewIndex || 0]?.name || 'None']
      ]
    : [
        ['Controls', String(inputs)],
        ['Result text', outputText ? outputText.length + ' chars' : 'Waiting'],
        ['Live update', preview ? 'Active' : 'Unavailable']
      ];
  mount.innerHTML = '<div class="premium-stats-heading"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M3 12h4l2-7 4 14 2-7h6" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg><span>Live statistics</span></div>' +
    '<div class="premium-stats-grid">' +
    items.map(item => '<div><span>' + escapeHTML(item[0]) + '</span><strong title="' + escapeHTML(item[1]) + '">' + escapeHTML(item[1]) + '</strong></div>').join('') +
    '</div>';
  const activeTool = toolsList.find(tool => tool.id === premiumEditorState.toolId);
  if (activeTool?.category === 'calculator' && outputText) {
    const numeric = outputText.replace(/,/g, '').match(/-?\d+(?:\.\d+)?/);
    const value = numeric ? Number(numeric[0]) : NaN;
    if (Number.isFinite(value) && premiumEditorState.resultSeries[premiumEditorState.resultSeries.length - 1] !== value) {
      premiumEditorState.resultSeries.push(value);
      if (premiumEditorState.resultSeries.length > 20) premiumEditorState.resultSeries.shift();
    }
    if (premiumEditorState.resultSeries.length) {
      const series = premiumEditorState.resultSeries;
      const min = Math.min(...series);
      const max = Math.max(...series);
      const range = max - min || 1;
      const points = series.map((point, index) => {
        const x = series.length === 1 ? 50 : (index / (series.length - 1)) * 100;
        const y = 36 - ((point - min) / range) * 30;
        return x.toFixed(1) + ',' + y.toFixed(1);
      }).join(' ');
      mount.insertAdjacentHTML('beforeend', '<div class="premium-trend-chart"><span>Live result history</span><svg viewBox="0 0 100 40" role="img" aria-label="Chart of recent calculated values"><polyline points="' + points + '" fill="none" stroke="currentColor" stroke-width="2.5" vector-effect="non-scaling-stroke"/></svg></div>');
    }
  }
}

function renderCalculatorFormulaReference() {
  const tool = toolsList.find(item => item.id === premiumEditorState.toolId);
  const panel = document.querySelector('.tool-options-panel');
  if (!panel || tool?.category !== 'calculator') return;
  const formulas = {
    'calculator': ['Arithmetic', 'Result follows the selected arithmetic operation and standard operator precedence.'],
    'scientific-calculator': ['Scientific functions', 'Trigonometric, logarithmic, power, root, and constant operations use JavaScript double-precision arithmetic.'],
    'percentage-calculator': ['Percentage', 'Percentage = (part ÷ whole) × 100. Percentage change = ((new − old) ÷ old) × 100.'],
    'age-calculator': ['Elapsed age', 'Age is the calendar duration between the birth date and selected target date.'],
    'date-calculator': ['Date offset', 'Result date = start date ± selected calendar duration.'],
    'emi-calculator': ['EMI formula', 'EMI = P × r × (1 + r)ⁿ ÷ ((1 + r)ⁿ − 1), where r is the monthly rate.'],
    'loan-calculator': ['Loan payment', 'Reducing-balance payments use the EMI formula; flat interest uses P × rate × time.'],
    'interest-calculator': ['Interest', 'Simple: A = P(1 + rt). Compound: A = P(1 + r/n)ⁿᵗ.'],
    'gst-calculator': ['GST', 'Tax = net price × GST rate. Inclusive net = gross ÷ (1 + rate).'],
    'sip-calculator': ['SIP future value', 'FV = P × (((1 + r)ⁿ − 1) ÷ r) × (1 + r).'],
    'bmi-calculator': ['BMI', 'Metric BMI = weight (kg) ÷ height² (m). Imperial BMI = 703 × lb ÷ in².'],
    'discount-calculator': ['Discount', 'Sale price = original × (1 − discount rate), applied sequentially for multiple discounts.'],
    'unit-converter': ['Unit conversion', 'Input is converted through the selected category’s canonical base unit.'],
    'currency-converter': ['Currency conversion', 'Output = input amount × the exchange rate you provide. No live-rate claim is made.'],
    'time-calculator': ['Time arithmetic', 'Times are normalized to total seconds before addition or subtraction.']
  };
  const reference = formulas[premiumEditorState.toolId];
  if (!reference) return;
  const section = document.createElement('section');
  section.className = 'premium-formula-reference';
  section.innerHTML = '<div><i data-lucide="sigma"></i><strong>' + escapeHTML(reference[0]) + '</strong></div><p>' + escapeHTML(reference[1]) + '</p>';
  panel.insertBefore(section, document.getElementById('premium-live-stats'));
}

function premiumPreviewAction(action) {
  const selector = action === 'zoom-in' ? '[data-action="zoom-in"]'
    : action === 'zoom-out' ? '[data-action="zoom-out"]'
      : '[data-action="fit"]';
  const button = document.querySelector('#file-preview-workspace ' + selector);
  if (button) button.click();
  else showToast('Upload and select a previewable file first.', 'info');
}

function resetPremiumEditor() {
  disposePremiumToolEditor();
  appState.activeFiles = [];
  appState.activeToolOptions = {};
  appState.activePreviewIndex = 0;
  renderPage();
  showToast('Editor reset.', 'info');
}

function togglePremiumFullscreen() {
  const workspace = document.querySelector('.premium-editor-workspace');
  if (!workspace) return;
  workspace.classList.toggle('is-focused-editor');
  document.body.classList.toggle('premium-editor-focus-open', workspace.classList.contains('is-focused-editor'));
  workspace.setAttribute('aria-label', workspace.classList.contains('is-focused-editor') ? 'Focused editor view' : '');
}

function showPremiumShortcutHelp() {
  showToast('Shortcuts: Ctrl/⌘+Z undo · Ctrl/⌘+Y redo · Ctrl/⌘+Enter process · +/− zoom · Esc exit focused view', 'info');
}

function handlePremiumEditorKeydown(event) {
  if (!appState.currentPage.startsWith('tool-') || appState.currentPage === 'tool-crop-image') return;
  const modifier = event.ctrlKey || event.metaKey;
  if (modifier && event.key.toLowerCase() === 'z') {
    event.preventDefault();
    event.shiftKey ? premiumRedo() : premiumUndo();
    return;
  }
  if (modifier && event.key.toLowerCase() === 'y') {
    event.preventDefault();
    premiumRedo();
    return;
  }
  if (modifier && event.key === 'Enter') {
    const processButton = document.getElementById('btn-process-action');
    if (processButton && !processButton.disabled && appState.activeFiles.length) {
      event.preventDefault();
      processButton.click();
    }
    return;
  }
  if (event.key === 'Escape') {
    const workspace = document.querySelector('.premium-editor-workspace.is-focused-editor');
    if (workspace) {
      workspace.classList.remove('is-focused-editor');
      document.body.classList.remove('premium-editor-focus-open');
    }
    return;
  }
  if (/^(INPUT|TEXTAREA|SELECT)$/.test(event.target?.tagName || '')) return;
  if (event.key === '+' || event.key === '=') premiumPreviewAction('zoom-in');
  if (event.key === '-') premiumPreviewAction('zoom-out');
}

function getPremiumPreviewText() {
  return document.getElementById('generator-preview-mount')?.innerText.trim()
    || document.getElementById('premium-result-preview')?.innerText.trim()
    || '';
}

async function copyPremiumPreview() {
  const text = getPremiumPreviewText();
  if (!text) {
    showToast('There is no result to copy yet.', 'info');
    return;
  }
  try {
    await navigator.clipboard.writeText(text);
    showToast('Result copied to clipboard.', 'success');
  } catch (error) {
    showToast('Clipboard access was denied by this browser.', 'error');
  }
}

async function sharePremiumPreview() {
  const text = getPremiumPreviewText();
  if (!text) {
    showToast('There is no result to share yet.', 'info');
    return;
  }
  const tool = toolsList.find(item => item.id === premiumEditorState.toolId);
  if (navigator.share) {
    try {
      await navigator.share({ title: tool?.name || 'GXA Toolbox result', text });
      return;
    } catch (error) {
      if (error.name === 'AbortError') return;
    }
  }
  await copyPremiumPreview();
}

function ensureHtml2Canvas() {
  if (window.html2canvas) return Promise.resolve(window.html2canvas);
  if (html2CanvasPromise) return html2CanvasPromise;
  const sources = [
    'https://cdnjs.cloudflare.com/ajax/libs/html2canvas/1.4.1/html2canvas.min.js',
    'https://cdn.jsdelivr.net/npm/html2canvas@1.4.1/dist/html2canvas.min.js'
  ];
  html2CanvasPromise = new Promise((resolve, reject) => {
    const load = index => {
      if (index >= sources.length) {
        html2CanvasPromise = null;
        reject(new Error('The preview export library could not be loaded.'));
        return;
      }
      const script = document.createElement('script');
      script.src = sources[index];
      script.async = true;
      script.dataset.gxaPremiumExport = 'true';
      script.onload = () => window.html2canvas ? resolve(window.html2canvas) : load(index + 1);
      script.onerror = () => {
        script.remove();
        load(index + 1);
      };
      document.head.appendChild(script);
    };
    load(0);
  });
  return html2CanvasPromise;
}

async function exportPremiumPreview(format) {
  const preview = document.getElementById('generator-preview-mount');
  if (!preview || !preview.innerText.trim()) {
    showToast('Create a result before exporting it.', 'info');
    return;
  }
  try {
    const html2canvas = await ensureHtml2Canvas();
    const canvas = await html2canvas(preview, {
      backgroundColor: document.body.classList.contains('dark-mode') ? '#111827' : '#ffffff',
      scale: Math.min(2, window.devicePixelRatio || 1),
      useCORS: true,
      logging: false
    });
    const baseName = (premiumEditorState.toolId || 'tool') + '-result';
    if (format === 'pdf') {
      if (!window.PDFLib) throw new Error('The PDF export library is unavailable.');
      const documentPdf = await window.PDFLib.PDFDocument.create();
      const image = await documentPdf.embedPng(canvas.toDataURL('image/png'));
      const pageWidth = 595.28;
      const maxHeight = 780;
      const scale = Math.min(pageWidth / image.width, maxHeight / image.height);
      const page = documentPdf.addPage([pageWidth, Math.max(220, image.height * scale + 40)]);
      page.drawImage(image, { x: 0, y: 20, width: image.width * scale, height: image.height * scale });
      const bytes = await documentPdf.save();
      const blob = new Blob([bytes], { type: 'application/pdf' });
      saveBlob(blob, baseName + '.pdf');
      addPremiumSessionEntry(baseName + '.pdf', blob.size);
    } else {
      const blob = await new Promise((resolve, reject) => canvas.toBlob(value => value ? resolve(value) : reject(new Error('PNG export failed.')), 'image/png'));
      saveBlob(blob, baseName + '.png');
      addPremiumSessionEntry(baseName + '.png', blob.size);
    }
    showToast('Result export created.', 'success');
  } catch (error) {
    showToast(error.message || 'The result could not be exported.', 'error');
  }
}

function addPremiumSessionEntry(filename, size) {
  premiumToolSessions.unshift({
    toolId: premiumEditorState.toolId || appState.currentPage.replace('tool-', ''),
    filename,
    size,
    createdAt: new Date()
  });
  if (premiumToolSessions.length > 12) premiumToolSessions.length = 12;
  renderPremiumSessionHistory();
}

function renderPremiumSessionHistory() {
  const mount = document.getElementById('premium-session-history');
  if (!mount) return;
  const currentTool = appState.currentPage.replace('tool-', '');
  const entries = premiumToolSessions.filter(entry => entry.toolId === currentTool).slice(0, 4);
  if (!entries.length) {
    mount.innerHTML = '<span>No results created in this session yet.</span>';
    return;
  }
  mount.innerHTML = entries.map(entry =>
    '<div class="premium-session-item"><i data-lucide="check-circle-2"></i><span><strong>' +
    escapeHTML(entry.filename) + '</strong><small>' +
    escapeHTML(formatCropBytes(entry.size)) + ' · ' +
    escapeHTML(entry.createdAt.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })) +
    '</small></span></div>'
  ).join('');
  lucide.createIcons();
}

function clearPremiumResult() {
  if (premiumEditorState.resultUrl.startsWith('blob:')) URL.revokeObjectURL(premiumEditorState.resultUrl);
  premiumEditorState.resultUrl = '';
  premiumEditorState.resultBlob = null;
  premiumEditorState.resultFilename = '';
}

function disposePremiumToolEditor() {
  window.clearTimeout(premiumEditorState.historyTimer);
  window.clearTimeout(premiumEditorState.backgroundAutoTimer);
  window.cancelAnimationFrame(premiumEditorState.previewUpdateFrame);
  resetWatermarkEditorState();
  premiumEditorState.previewObserver?.disconnect();
  if (premiumEditorState.keydownHandler) document.removeEventListener('keydown', premiumEditorState.keydownHandler);
  const root = document.querySelector('.premium-editor-workspace');
  if (root && premiumEditorState.inputHandler) {
    root.removeEventListener('input', premiumEditorState.inputHandler);
    root.removeEventListener('change', premiumEditorState.inputHandler);
  }
  if (root && premiumEditorState.clickHandler) root.removeEventListener('click', premiumEditorState.clickHandler);
  document.body.classList.remove('premium-editor-focus-open');
  clearPremiumResult();
  if (premiumEditorState.backgroundPreviewUrl) URL.revokeObjectURL(premiumEditorState.backgroundPreviewUrl);
  premiumEditorState.auxiliaryUrls.forEach(url => URL.revokeObjectURL(url));
  Object.assign(premiumEditorState, {
    toolId: '',
    needsFiles: false,
    undoStack: [],
    redoStack: [],
    suppressHistory: false,
    historyTimer: null,
    keydownHandler: null,
    inputHandler: null,
    clickHandler: null,
    previewObserver: null,
    previewUpdateFrame: 0,
    auxiliaryUrls: [],
    backgroundAutoTimer: null,
    backgroundPreviewUrl: '',
    resultSeries: [],
    batchCancelled: false,
    startedAt: 0
  });
}

// --- Upload Zone Action Triggers ---
function setupUploadZoneEvents() {
  const dropZone = document.getElementById('drop-zone');
  const filePicker = document.getElementById('file-picker');
  
  if (!dropZone || !filePicker) return;
  
  // Prevent browser default drop opens
  ['dragenter', 'dragover', 'dragleave', 'drop'].forEach(eventName => {
    dropZone.addEventListener(eventName, e => e.preventDefault(), false);
  });
  
  dropZone.addEventListener('dragover', () => dropZone.classList.add('dragover'));
  dropZone.addEventListener('dragleave', () => dropZone.classList.remove('dragover'));
  dropZone.addEventListener('drop', (e) => {
    dropZone.classList.remove('dragover');
    const files = e.dataTransfer.files;
    handleFileSelection(files);
  });
  
  filePicker.addEventListener('change', (e) => {
    handleFileSelection(e.target.files);
    e.target.value = '';
  });

  dropZone.addEventListener('keydown', (event) => {
    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault();
      filePicker.click();
    }
  });
  if (window.GxaWorkspace) window.GxaWorkspace.bindPaste(handleFileSelection);
  
  // Bind main process action button
  const processBtn = document.getElementById('btn-process-action');
  if (processBtn) {
    if (!processBtn.hasAttribute('onclick')) processBtn.addEventListener('click', runFileProcessingPipeline);
    const toolId = appState.currentPage.replace('tool-', '');
    const blocker = window.GxaWorkspace ? window.GxaWorkspace.getBlocker(toolId) : '';
    if (blocker) {
      processBtn.disabled = true;
      processBtn.textContent = 'Temporarily unavailable';
      processBtn.title = blocker;
    }
  }
}

function handleFileSelection(files) {
  if (!files || files.length === 0) return;
  const picker = document.getElementById('file-picker');
  const isMultiple = picker.multiple;
  const validation = window.GxaWorkspace
    ? window.GxaWorkspace.validateFiles(files, { accept: picker.accept || '*', multiple: isMultiple })
    : { accepted: Array.from(files), errors: [] };
  validation.errors.forEach((message) => showToast(message, 'error'));
  if (!validation.accepted.length) return;

  const knownFiles = new Set(appState.activeFiles.map(file => `${file.name}:${file.size}:${file.lastModified}`));
  const accepted = validation.accepted.filter((file) => {
    const identity = `${file.name}:${file.size}:${file.lastModified}`;
    if (knownFiles.has(identity)) {
      showToast(`${file.name}: duplicate file ignored.`, 'info');
      return false;
    }
    knownFiles.add(identity);
    return true;
  });
  if (!accepted.length) return;

  if (!isMultiple) {
    appState.activeFiles = [accepted[0]];
  } else {
    appState.activeFiles.push(...accepted);
  }
  appState.activePreviewIndex = Math.max(0, appState.activeFiles.length - accepted.length);
  recordPremiumEditorState();
  renderFileQueue();
  updatePremiumLiveStats();
  if (appState.currentPage === 'tool-background-remover') {
    renderBackgroundRemoverSelectedPreview(appState.activeFiles[appState.activePreviewIndex] || appState.activeFiles[0]);
    window.clearTimeout(premiumEditorState.backgroundAutoTimer);
    premiumEditorState.backgroundAutoTimer = window.setTimeout(() => {
      if (appState.currentPage === 'tool-background-remover' && appState.activeFiles.length) runFileProcessingPipeline();
    }, 50);
  }
}

function renderBackgroundRemoverSelectedPreview(file) {
  if (!file || !file.type?.startsWith('image/')) return;
  const mounts = [
    document.getElementById('bg-remover-selected-preview'),
    document.getElementById('bg-remover-processing-preview')
  ].filter(Boolean);
  if (!mounts.length) return;
  if (premiumEditorState.backgroundPreviewUrl) URL.revokeObjectURL(premiumEditorState.backgroundPreviewUrl);
  const previewUrl = URL.createObjectURL(file);
  premiumEditorState.backgroundPreviewUrl = previewUrl;
  const safeName = escapeHTML(file.name);
  const size = formatCropBytes(file.size);
  mounts.forEach((mount) => {
    mount.innerHTML = `
      <img src="${previewUrl}" alt="Uploaded image preview for Background Remover">
      <div>
        <strong>${safeName}</strong>
        <span>${size} · segmentation will preserve the original dimensions</span>
      </div>
    `;
  });
}

function renderFileQueue() {
  const uploadMount = document.getElementById('tool-upload-mount');
  const queueMount = document.getElementById('tool-queue-mount');
  const queueContainer = document.getElementById('file-queue-container');
  
  if (!queueContainer) return;
  
  if (appState.activeFiles.length === 0) {
    uploadMount.classList.remove('hidden');
    queueMount.classList.add('hidden');
    if (window.GxaWorkspace) window.GxaWorkspace.dispose();
    if (window.GxaWorkspace) window.GxaWorkspace.bindPaste(handleFileSelection);
    document.getElementById('file-preview-workspace')?.remove();
    updatePremiumLiveStats();
    return;
  }
  
  uploadMount.classList.add('hidden');
  queueMount.classList.remove('hidden');
  
  queueContainer.innerHTML = '';
  
  appState.activeFiles.forEach((file, index) => {
    const card = document.createElement('div');
    card.className = 'file-card';
    card.draggable = true; // Drag-and-drop support
    card.tabIndex = 0;
    card.setAttribute('aria-label', `${file.name}, ${index + 1} of ${appState.activeFiles.length}. Press Alt plus arrow keys to reorder.`);
    
    // Add drag handlers for reordering items
    card.addEventListener('dragstart', (e) => e.dataTransfer.setData('text/plain', index));
    card.addEventListener('dragover', (e) => e.preventDefault());
    card.addEventListener('drop', (e) => {
      const originIndex = parseInt(e.dataTransfer.getData('text/plain'));
      const targetIndex = index;
      // Swap items
      const temp = appState.activeFiles[originIndex];
      appState.activeFiles.splice(originIndex, 1);
      appState.activeFiles.splice(targetIndex, 0, temp);
      appState.activePreviewIndex = targetIndex;
      recordPremiumEditorState();
      renderFileQueue();
    });
    card.addEventListener('keydown', event => {
      if (!event.altKey || !['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown'].includes(event.key)) return;
      event.preventDefault();
      const direction = ['ArrowLeft', 'ArrowUp'].includes(event.key) ? -1 : 1;
      const targetIndex = Math.max(0, Math.min(appState.activeFiles.length - 1, index + direction));
      if (targetIndex === index) return;
      const [moved] = appState.activeFiles.splice(index, 1);
      appState.activeFiles.splice(targetIndex, 0, moved);
      appState.activePreviewIndex = targetIndex;
      recordPremiumEditorState();
      renderFileQueue();
      document.querySelectorAll('.file-card')[targetIndex]?.focus();
    });
    card.addEventListener('click', () => {
      appState.activePreviewIndex = index;
      document.querySelectorAll('.file-card').forEach((item) => item.classList.remove('is-previewed'));
      card.classList.add('is-previewed');
      if (window.GxaWorkspace) window.GxaWorkspace.renderFilePreview(appState.activeFiles, index);
    });
    
    const sizeStr = (file.size / (1024 * 1024)).toFixed(2) + ' MB';
    const safeFileName = escapeHTML(file.name);
    
    card.innerHTML = `
      <div class="file-card-thumb" id="thumb-${index}">
        <i data-lucide="file" style="width:24px;"></i>
      </div>
      <div class="file-card-info">
        <div class="file-card-name" title="${safeFileName}">${safeFileName}</div>
        <div class="file-card-size">${sizeStr}</div>
      </div>
      <div class="file-card-order-controls" aria-label="Reorder ${safeFileName}">
        <button type="button" aria-label="Move ${safeFileName} up" ${index === 0 ? 'disabled' : ''} onclick="event.stopPropagation(); moveQueueIndex(${index}, -1)"><i data-lucide="chevron-up"></i></button>
        <button type="button" aria-label="Move ${safeFileName} down" ${index === appState.activeFiles.length - 1 ? 'disabled' : ''} onclick="event.stopPropagation(); moveQueueIndex(${index}, 1)"><i data-lucide="chevron-down"></i></button>
      </div>
      <button class="file-card-remove" aria-label="Remove ${file.name.replace(/[&<>\"]/g, '')}" onclick="event.stopPropagation(); removeQueueIndex(${index})"><i data-lucide="x" style="width:16px;"></i></button>
    `;
    
    queueContainer.appendChild(card);
    
    // If it is an image, render standard canvas thumbnail
    if (file.type.startsWith('image/')) {
      const thumbUrl = URL.createObjectURL(file);
      const img = document.createElement('img');
      img.alt = '';
      img.onload = () => URL.revokeObjectURL(thumbUrl);
      img.onerror = () => URL.revokeObjectURL(thumbUrl);
      img.src = thumbUrl;
      const thumbDiv = document.getElementById(`thumb-${index}`);
      if (thumbDiv) {
        thumbDiv.innerHTML = '';
        thumbDiv.appendChild(img);
      }
    }
  });
  appState.activePreviewIndex = Math.min(appState.activePreviewIndex || 0, appState.activeFiles.length - 1);
  queueContainer.children[appState.activePreviewIndex]?.classList.add('is-previewed');
  if (appState.currentPage === 'tool-background-remover') {
    renderBackgroundRemoverSelectedPreview(appState.activeFiles[appState.activePreviewIndex]);
  } else if (window.GxaWorkspace) {
    window.GxaWorkspace.renderFilePreview(appState.activeFiles, appState.activePreviewIndex);
  }
  updatePremiumLiveStats();
  lucide.createIcons();
}

function moveQueueIndex(index, direction) {
  const targetIndex = Math.max(0, Math.min(appState.activeFiles.length - 1, index + direction));
  if (targetIndex === index) return;
  const [moved] = appState.activeFiles.splice(index, 1);
  appState.activeFiles.splice(targetIndex, 0, moved);
  appState.activePreviewIndex = targetIndex;
  recordPremiumEditorState();
  renderFileQueue();
  document.querySelectorAll('.file-card')[targetIndex]?.focus();
}

function removeQueueIndex(idx) {
  appState.activeFiles.splice(idx, 1);
  appState.activePreviewIndex = Math.max(0, Math.min(appState.activePreviewIndex || 0, appState.activeFiles.length - 1));
  recordPremiumEditorState();
  renderFileQueue();
}

function clearSelectedFiles() {
  appState.activeFiles = [];
  appState.activePreviewIndex = 0;
  recordPremiumEditorState();
  renderFileQueue();
}

function resetActiveTool() {
  if (appState.currentPage === 'tool-crop-image') {
    resetCropImageTool();
    return;
  }
  window.GxaAdvancedCutoutStudio?.close();
  if (appState.currentPage === 'tool-watermark-pdf') resetWatermarkEditorState();
  window.clearTimeout(premiumEditorState.backgroundAutoTimer);
  appState.activeFiles = [];
  appState.activeToolOptions = {};
  appState.activePreviewIndex = 0;
  clearPremiumResult();
  if (premiumEditorState.backgroundPreviewUrl) {
    URL.revokeObjectURL(premiumEditorState.backgroundPreviewUrl);
    premiumEditorState.backgroundPreviewUrl = '';
  }
  if (window.GxaWorkspace) window.GxaWorkspace.dispose();
  
  const uploadMount = document.getElementById('tool-upload-mount');
  const queueMount = document.getElementById('tool-queue-mount');
  const processingMount = document.getElementById('tool-processing-mount');
  const completeMount = document.getElementById('tool-complete-mount');
  
  if (uploadMount) uploadMount.classList.remove('hidden');
  if (queueMount) queueMount.classList.add('hidden');
  if (processingMount) processingMount.classList.add('hidden');
  if (completeMount) completeMount.classList.add('hidden');
}

// --- CORE PIPELINE PROCESSING MODULES ---
function updateProcessingStage(stage) {
  const stages = ['validate', 'process', 'generate', 'finish'];
  const activeIndex = stages.indexOf(stage);
  document.querySelectorAll('#processing-stages [data-stage]').forEach((item, index) => {
    item.classList.toggle('active', index === activeIndex);
    item.classList.toggle('done', index < activeIndex);
  });
}

function cancelActiveBatch() {
  premiumEditorState.batchCancelled = true;
  const button = document.getElementById('btn-cancel-processing');
  if (button) {
    button.disabled = true;
    button.textContent = 'Cancelling…';
  }
}

async function validateGeneratedOutputBlob(blob, filename) {
  if (!blob) return true;
  if (!(blob instanceof Blob) || blob.size === 0) throw new Error('The processor returned an empty output file.');
  const extension = String(filename || '').split('.').pop().toLowerCase();
  if (extension === 'pdf' || blob.type === 'application/pdf') {
    const bytes = new Uint8Array(await blob.arrayBuffer());
    const header = new TextDecoder('latin1').decode(bytes.slice(0, 8));
    const trailer = new TextDecoder('latin1').decode(bytes.slice(Math.max(0, bytes.length - 2048)));
    if (!header.startsWith('%PDF-') || !trailer.includes('%%EOF')) throw new Error('The generated PDF failed its signature validation.');
  } else if (extension === 'gif' || blob.type === 'image/gif') {
    const bytes = new Uint8Array(await blob.arrayBuffer());
    const header = String.fromCharCode(...bytes.slice(0, 6));
    if (!['GIF87a', 'GIF89a'].includes(header) || bytes[bytes.length - 1] !== 0x3b) throw new Error('The generated GIF failed its signature validation.');
  } else if (['epub', 'xlsx', 'pptx', 'docx'].includes(extension)) {
    if (!window.JSZip) throw new Error('The package validation library is unavailable.');
    const archive = await window.JSZip.loadAsync(await blob.arrayBuffer(), { checkCRC32: true });
    const names = Object.keys(archive.files);
    const required = extension === 'epub'
      ? ['mimetype', 'META-INF/container.xml', 'EPUB/package.opf']
      : extension === 'xlsx'
        ? ['[Content_Types].xml', 'xl/workbook.xml']
        : extension === 'pptx'
          ? ['[Content_Types].xml', 'ppt/presentation.xml']
          : ['[Content_Types].xml', 'word/document.xml'];
    if (required.some(name => !names.includes(name))) throw new Error(`The generated ${extension.toUpperCase()} package is missing required files.`);
    if (extension === 'epub' && (await archive.file('mimetype').async('text')).trim() !== 'application/epub+zip') throw new Error('The generated EPUB has an invalid mimetype entry.');
  } else if (blob.type.startsWith('image/') && blob.type !== 'image/svg+xml') {
    if (!('createImageBitmap' in window)) return true;
    const bitmap = await createImageBitmap(blob);
    const valid = bitmap.width > 0 && bitmap.height > 0;
    bitmap.close();
    if (!valid) throw new Error('The generated image could not be decoded.');
  } else if (extension === 'zip' || blob.type.includes('zip')) {
    if (!window.JSZip) throw new Error('The ZIP validation library is unavailable.');
    const archive = await window.JSZip.loadAsync(await blob.arrayBuffer(), { checkCRC32: true });
    if (Object.keys(archive.files).length === 0) throw new Error('The generated ZIP archive is empty.');
  } else if (extension === 'svg' || blob.type === 'image/svg+xml') {
    if (!/^\s*<svg[\s>]/i.test(await blob.text())) throw new Error('The generated SVG is invalid.');
  }
  return true;
}

async function createImageBatchOutput(files, processor, filenameFor, zipName) {
  const archive = new JSZip();
  const items = [];
  for (let index = 0; index < files.length; index += 1) {
    if (premiumEditorState.batchCancelled) throw new Error(`Batch cancelled after ${items.length} completed file${items.length === 1 ? '' : 's'}.`);
    const filename = filenameFor(files[index], index);
    const blob = await processor(files[index], index);
    await validateGeneratedOutputBlob(blob, filename);
    archive.file(filename, blob);
    items.push({ filename, blob, sourceName: files[index].name, status: 'Validated' });
    const progress = document.getElementById('global-progress-bar');
    if (progress) progress.style.width = `${25 + Math.round(((index + 1) / files.length) * 55)}%`;
  }
  const blob = await archive.generateAsync({ type: 'blob', compression: 'DEFLATE' });
  return { blob, filename: zipName, items };
}

function renderImageBatchActions(mount, items) {
  if (!mount || !items.length) return;
  premiumEditorState.resultSeries = items;
  const list = document.createElement('section');
  list.className = 'image-batch-result-list';
  list.setAttribute('aria-label', 'Batch output files');
  const heading = document.createElement('strong');
  heading.textContent = `${items.length} validated outputs`;
  list.appendChild(heading);
  items.forEach((item) => {
    const row = document.createElement('div');
    const text = document.createElement('span');
    text.textContent = `${item.filename} · ${formatCropBytes(item.blob.size)} · ${item.status}`;
    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'btn btn-ghost btn-sm';
    button.textContent = 'Download';
    button.setAttribute('aria-label', `Download ${item.filename}`);
    button.addEventListener('click', () => saveBlob(item.blob, item.filename));
    row.append(text, button);
    list.appendChild(row);
  });
  const retry = document.createElement('button');
  retry.type = 'button';
  retry.className = 'btn btn-secondary btn-sm';
  retry.textContent = 'Retry batch';
  retry.addEventListener('click', runFileProcessingPipeline);
  list.appendChild(retry);
  mount.appendChild(list);
}

async function runFileProcessingPipeline() {
  if (appState.activeFiles.length === 0) return;
  const toolId = appState.currentPage.replace('tool-', '');
  const blocker = window.GxaWorkspace ? window.GxaWorkspace.getBlocker(toolId) : '';
  if (blocker) {
    showToast(blocker, 'error');
    return;
  }
  const queueMount = document.getElementById('tool-queue-mount');
  const processingMount = document.getElementById('tool-processing-mount');
  const completeMount = document.getElementById('tool-complete-mount');
  const progressBar = document.getElementById('global-progress-bar');
  const stageLabel = document.getElementById('processing-stage-label');
  const downloadBtn = document.getElementById('btn-download-result');
  const mobileDownloadBtn = document.getElementById('btn-mobile-download-result');
  const cancelBtn = document.getElementById('btn-cancel-processing');
  premiumEditorState.startedAt = performance.now();
  premiumEditorState.batchCancelled = false;

  queueMount.classList.add('hidden');
  completeMount.classList.add('hidden');
  processingMount.classList.remove('hidden');
  downloadBtn.disabled = true;
  downloadBtn.onclick = null;
  if (mobileDownloadBtn) {
    mobileDownloadBtn.disabled = true;
    mobileDownloadBtn.onclick = null;
  }
  if (cancelBtn) {
    const supportsBatchCancel = (appState.activeFiles.length > 1 && ['compress-image', 'resize-image', 'webp-to-jpg', 'gif-maker'].includes(toolId)) || ['ocr-pdf', 'pdf-to-ppt'].includes(toolId);
    cancelBtn.classList.toggle('hidden', !supportsBatchCancel);
    cancelBtn.disabled = false;
    cancelBtn.textContent = ['ocr-pdf', 'pdf-to-ppt'].includes(toolId) ? 'Cancel after current page' : 'Cancel after current file';
  }
  progressBar.style.width = '8%';
  updateProcessingStage('validate');
  if (stageLabel) stageLabel.textContent = 'Validating input…';

  try {
    await Promise.resolve();
    progressBar.style.width = '25%';
    updateProcessingStage('process');
    if (stageLabel) stageLabel.textContent = 'Processing file…';
    await executeToolAlgorithm();
    if (typeof downloadBtn.onclick !== 'function' && !downloadBtn.classList.contains('hidden')) {
      throw new Error('This tool did not produce a usable result.');
    }
    progressBar.style.width = '88%';
    updateProcessingStage('generate');
    if (stageLabel) stageLabel.textContent = 'Validating output…';
    await validateGeneratedOutputBlob(premiumEditorState.resultBlob, premiumEditorState.resultFilename);
    progressBar.style.width = '100%';
    updateProcessingStage('finish');
    if (stageLabel) stageLabel.textContent = 'Complete';
    processingMount.classList.add('hidden');
    completeMount.classList.remove('hidden');
    cancelBtn?.classList.add('hidden');
    downloadBtn.disabled = false;
    if (mobileDownloadBtn) mobileDownloadBtn.disabled = false;
    window.requestAnimationFrame(() => completeMount.scrollIntoView({ behavior: 'smooth', block: 'start' }));
  } catch (err) {
    processingMount.classList.add('hidden');
    queueMount.classList.remove('hidden');
    completeMount.classList.add('hidden');
    cancelBtn?.classList.add('hidden');
    document.body.dataset.gxaLastProcessingError = err && err.message ? err.message : String(err);
    console.error('GXA tool processing failed', err);
    showToast(`Processing failed: ${err.message}`, 'error');
  }
}

function registerToolResult(downloadButton, blob, filename) {
  if (!(blob instanceof Blob)) throw new Error('The processor did not return a valid output file.');
  clearPremiumResult();
  premiumEditorState.resultBlob = blob;
  premiumEditorState.resultFilename = filename;
  premiumEditorState.resultUrl = URL.createObjectURL(blob);
  downloadButton.classList.remove('hidden');
  const download = () => saveBlob(blob, filename);
  downloadButton.onclick = download;
  const mobileDownloadButton = document.getElementById('btn-mobile-download-result');
  if (mobileDownloadButton) mobileDownloadButton.onclick = download;
  renderPremiumToolResult(blob, filename, premiumEditorState.resultUrl);
}

function registerExternalToolResult(downloadButton, url, filename, size) {
  clearPremiumResult();
  premiumEditorState.resultFilename = filename;
  premiumEditorState.resultUrl = url;
  downloadButton.classList.remove('hidden');
  const download = () => {
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = filename;
    document.body.appendChild(anchor);
    anchor.click();
    anchor.remove();
  };
  downloadButton.onclick = download;
  const mobileDownloadButton = document.getElementById('btn-mobile-download-result');
  if (mobileDownloadButton) mobileDownloadButton.onclick = download;
  renderPremiumToolResult(null, filename, url, Number(size) || 0);
}

async function renderPremiumToolResult(blob, filename, url, explicitSize) {
  const preview = document.getElementById('premium-result-preview');
  const stats = document.getElementById('premium-result-stats');
  const copyLink = document.getElementById('btn-copy-result-link');
  if (!preview || !stats) return;
  const extension = (filename.split('.').pop() || '').toLowerCase();
  const type = (blob?.type || '').toLowerCase();
  preview.innerHTML = '';
  if (type.startsWith('image/') || ['png', 'jpg', 'jpeg', 'webp', 'gif', 'svg'].includes(extension)) {
    const original = appState.activeFiles.find(file => file.type.startsWith('image/'));
    const compare = document.createElement('div');
    compare.className = 'premium-output-compare';
    if (original) {
      const originalUrl = URL.createObjectURL(original);
      premiumEditorState.auxiliaryUrls.push(originalUrl);
      const before = document.createElement('figure');
      const beforeImage = document.createElement('img');
      beforeImage.src = originalUrl;
      beforeImage.alt = 'Original image before processing';
      const beforeLabel = document.createElement('figcaption');
      beforeLabel.textContent = 'Before';
      before.append(beforeImage, beforeLabel);
      compare.appendChild(before);
    }
    const after = document.createElement('figure');
    const image = document.createElement('img');
    image.src = url;
    image.alt = 'Processed output preview for ' + filename;
    const afterLabel = document.createElement('figcaption');
    afterLabel.textContent = original ? 'After' : 'Output preview';
    after.append(image, afterLabel);
    compare.appendChild(after);
    preview.appendChild(compare);
  } else if (type === 'application/pdf' || extension === 'pdf') {
    const original = appState.activeFiles.find(file => file.type === 'application/pdf' || file.name.toLowerCase().endsWith('.pdf'));
    const compare = document.createElement('div');
    compare.className = 'premium-output-compare pdf';
    if (original) {
      const originalUrl = URL.createObjectURL(original);
      premiumEditorState.auxiliaryUrls.push(originalUrl);
      const before = document.createElement('figure');
      const beforeFrame = document.createElement('iframe');
      beforeFrame.src = originalUrl;
      beforeFrame.title = 'Original PDF before processing';
      const beforeLabel = document.createElement('figcaption');
      beforeLabel.textContent = 'Before';
      before.append(beforeFrame, beforeLabel);
      compare.appendChild(before);
    }
    const after = document.createElement('figure');
    const frame = document.createElement('iframe');
    frame.src = url;
    frame.title = 'Processed PDF preview for ' + filename;
    const afterLabel = document.createElement('figcaption');
    afterLabel.textContent = original ? 'After' : 'Output preview';
    after.append(frame, afterLabel);
    compare.appendChild(after);
    preview.appendChild(compare);
  } else if (type.startsWith('audio/')) {
    const audio = document.createElement('audio');
    audio.controls = true;
    audio.src = url;
    preview.appendChild(audio);
  } else if (blob && (type.startsWith('text/') || ['txt', 'md', 'json', 'xml', 'html', 'css', 'js', 'csv', 'sql'].includes(extension))) {
    const textPreview = document.createElement('pre');
    textPreview.className = 'premium-result-text';
    textPreview.textContent = (await blob.text()).slice(0, 120000);
    preview.appendChild(textPreview);
  } else {
    preview.innerHTML = '<div class="premium-result-file"><i data-lucide="file-check-2"></i><strong>' + escapeHTML(filename) + '</strong><span>Output file generated successfully</span></div>';
  }
  const originalSize = appState.activeFiles.reduce((sum, file) => sum + file.size, 0);
  const outputSize = blob?.size || explicitSize || 0;
  const difference = originalSize > 0 && outputSize > 0 ? originalSize - outputSize : null;
  const elapsed = premiumEditorState.startedAt ? Math.max(0, performance.now() - premiumEditorState.startedAt) : 0;
  const values = [
    ['Time taken', elapsed < 1000 ? Math.round(elapsed) + ' ms' : (elapsed / 1000).toFixed(2) + ' s'],
    ['Original size', originalSize ? formatCropBytes(originalSize) : 'Not applicable'],
    ['Output size', outputSize ? formatCropBytes(outputSize) : 'Reported by server'],
    ['Difference', difference === null ? 'Not applicable' : (difference >= 0 ? '−' : '+') + formatCropBytes(Math.abs(difference))]
  ];
  stats.innerHTML = values.map(value => '<div><span>' + value[0] + '</span><strong>' + value[1] + '</strong></div>').join('');
  if (copyLink) copyLink.disabled = !url;
  addPremiumSessionEntry(filename, outputSize);
  lucide.createIcons();
}

async function copyPremiumResultLink() {
  if (!premiumEditorState.resultUrl) {
    showToast('No result link is available yet.', 'info');
    return;
  }
  try {
    await navigator.clipboard.writeText(premiumEditorState.resultUrl);
    showToast('Local result link copied. It remains valid only in this open browser session.', 'success');
  } catch (error) {
    showToast('Clipboard access was denied by this browser.', 'error');
  }
}

async function executeToolAlgorithm() {
  const toolId = appState.currentPage.replace('tool-', '');
  const processingMount = document.getElementById('tool-processing-mount');
  const completeMount = document.getElementById('tool-complete-mount');
  const downloadBtn = document.getElementById('btn-download-result');
  const metricMount = document.getElementById('comparison-metric-mount');
  
  // Custom dispatcher matching active functions
  if (toolId === 'merge-pdf') {
    const filename = document.getElementById('opt-filename').value || 'merged.pdf';
    const mergedBlob = await runPDFMerge();
    
    registerToolResult(downloadBtn, mergedBlob, filename);
    logHistory(filename, 'Merge PDF', (mergedBlob.size / (1024*1024)).toFixed(2) + ' MB');
    showToast('PDFs merged successfully in local browser!', 'success');
    
  } else if (toolId === 'organize-pdf') {
    const range = document.getElementById('opt-range').value || '';
    const angle = appState.activeToolOptions.angle || 0;
    const watermark = document.getElementById('opt-watermark').value || '';
    const blankCount = Number.parseInt(document.getElementById('opt-organize-blank-count')?.value || '0', 10);
    const blankAfter = Number.parseInt(document.getElementById('opt-organize-blank-after')?.value || '0', 10);
    const organizedBlob = await runPDFOrganize(range, angle, watermark, blankCount, blankAfter);
    
    const outputName = 'organized_' + appState.activeFiles[0].name;
    registerToolResult(downloadBtn, organizedBlob, outputName);
    logHistory(outputName, 'Organize PDF', (organizedBlob.size / (1024*1024)).toFixed(2) + ' MB');
    showToast('PDF organized locally!', 'success');
    
  } else if (toolId === 'compress-image') {
    const quality = appState.activeToolOptions.quality || 0.7;
    const outputMime = document.getElementById('opt-image-output')?.value || 'image/jpeg';
    const outputExtension = ({ 'image/jpeg': 'jpg', 'image/webp': 'webp', 'image/png': 'png' })[outputMime] || 'jpg';
    const sourceFiles = appState.activeFiles;
    let compressedBlob;
    let outputName;
    let batchItems = [];
    let sourceSize = sourceFiles.reduce((sum, file) => sum + file.size, 0);
    if (sourceFiles.length > 1) {
      const batch = await createImageBatchOutput(
        sourceFiles,
        file => runImageCompression(file, quality, outputMime),
        (file, index) => `compressed-${String(index + 1).padStart(2, '0')}-${file.name.replace(/\.[^.]+$/, '')}.${outputExtension}`,
        'compressed-images.zip'
      );
      ({ blob: compressedBlob, filename: outputName, items: batchItems } = batch);
    } else {
      compressedBlob = await runImageCompression(sourceFiles[0], quality, outputMime);
      outputName = 'compressed_' + sourceFiles[0].name.replace(/\.[^.]+$/, '') + '.' + outputExtension;
    }
    const ratio = Math.round((1 - (compressedBlob.size / sourceSize)) * 100);
    metricMount.classList.remove('hidden');
    metricMount.innerHTML = `
      ${t('original')}: ${(sourceSize / 1024).toFixed(1)} KB &nbsp; | &nbsp; 
      ${t('compressed')}: ${(compressedBlob.size / 1024).toFixed(1)} KB &nbsp; 
      <strong style="color:var(--color-accent);">(${ratio >= 0 ? `-${ratio}%` : `+${Math.abs(ratio)}%`})</strong>
    `;
    renderImageBatchActions(metricMount, batchItems);
    registerToolResult(downloadBtn, compressedBlob, outputName);
    logHistory(outputName, 'Compress Image', (compressedBlob.size / (1024*1024)).toFixed(2) + ' MB');
    showToast('Image compressed locally!', 'success');
    
  } else if (toolId === 'resize-image') {
    const sourceFiles = appState.activeFiles;
    const originalFile = sourceFiles[0];
    const width = appState.activeToolOptions.width;
    const height = appState.activeToolOptions.height;
    const resizeFormat = document.getElementById('opt-resize-output')?.value || 'keep';
    const mimeFor = file => resizeFormat === 'keep' ? (file.type || 'image/png') : resizeFormat;
    const extensionFor = file => ({ 'image/jpeg': 'jpg', 'image/png': 'png', 'image/webp': 'webp' })[mimeFor(file)] || 'png';
    let resizedBlob;
    let resizedName;
    let batchItems = [];
    if (sourceFiles.length > 1) {
      const batch = await createImageBatchOutput(
        sourceFiles,
        file => runImageResize(file, width, height, mimeFor(file)),
        (file, index) => `resized-${String(index + 1).padStart(2, '0')}-${file.name.replace(/\.[^.]+$/, '')}.${extensionFor(file)}`,
        'resized-images.zip'
      );
      ({ blob: resizedBlob, filename: resizedName, items: batchItems } = batch);
    } else {
      resizedBlob = await runImageResize(originalFile, width, height, mimeFor(originalFile));
      resizedName = 'resized_' + originalFile.name.replace(/\.[^.]+$/, '') + '.' + extensionFor(originalFile);
    }
    registerToolResult(downloadBtn, resizedBlob, resizedName);
    if (batchItems.length) {
      metricMount.classList.remove('hidden');
      metricMount.innerHTML = '';
      renderImageBatchActions(metricMount, batchItems);
    }
    logHistory(resizedName, 'Resize Image', (resizedBlob.size / (1024*1024)).toFixed(2) + ' MB');
    showToast('Image dimensions resized!', 'success');
    
  } else if (toolId === 'crop-image') {
    const originalFile = appState.activeFiles[0];
    const croppedBlob = await runImageCrop(originalFile);
    
    registerToolResult(downloadBtn, croppedBlob, 'cropped_' + originalFile.name);
    logHistory('cropped_' + originalFile.name, 'Crop Image', (croppedBlob.size / (1024*1024)).toFixed(2) + ' MB');
    showToast('Image cropped successfully!', 'success');
    
  } else if (toolId === 'background-remover') {
    const originalFile = appState.activeFiles[0];
    const segmentationStageLabel = document.getElementById('processing-stage-label');
    if (!window.GxaBackgroundSegmentation) {
      throw new Error('The local segmentation engine is unavailable. Legacy color-key removal is not used automatically.');
    }
    const segmentation = await window.GxaBackgroundSegmentation.segment(originalFile, {
      forceProvider: document.getElementById('opt-bg-engine')?.value === 'compat' ? 'wasm' : '',
      status(update) {
        if (segmentationStageLabel && update?.message) segmentationStageLabel.textContent = update.message;
      }
    });
    document.body.dataset.gxaSegmentationProvider = segmentation.provider;
    document.body.dataset.gxaSegmentationStats = JSON.stringify(segmentation.stats);
    document.body.dataset.gxaSegmentationPerformance = JSON.stringify(segmentation.performance);
    const resultMount = document.getElementById('premium-result-preview');
    if (!window.GxaAdvancedCutoutStudio || !resultMount) {
      throw new Error('The Advanced Cutout Studio is unavailable.');
    }
    metricMount.classList.add('hidden');
    const title = document.querySelector('#tool-complete-mount .complete-title');
    const subtitle = document.querySelector('#tool-complete-mount .upload-subtitle');
    if (title) title.textContent = 'Advanced Cutout Studio';
    if (subtitle) subtitle.textContent = 'Background removal ran locally in your browser. Refine the real alpha mask, compose a background, and export a validated image.';
    await window.GxaAdvancedCutoutStudio.open({
      mount: resultMount,
      originalFile,
      cutoutUrl: segmentation.cutoutUrl,
      outputFilename: segmentation.filename,
      initialMaskCanvas: segmentation.maskCanvas,
      segmentationStats: segmentation.stats,
      segmentationProvider: segmentation.provider,
      onExport(blob, filename) {
        clearPremiumResult();
        premiumEditorState.resultBlob = blob;
        premiumEditorState.resultFilename = filename;
        premiumEditorState.resultUrl = URL.createObjectURL(blob);
        logHistory(filename, 'Advanced Cutout Studio', formatCropBytes(blob.size));
      }
    });
    premiumEditorState.auxiliaryUrls.push(segmentation.cutoutUrl);
    downloadBtn.disabled = false;
    downloadBtn.onclick = () => document.querySelector('.cutout-download')?.click();
    logHistory(segmentation.filename, 'Background Remover', formatCropBytes(segmentation.blob.size));
    showToast('Subject segmented locally. The Advanced Cutout Studio is ready for refinement and export.', 'success');
    return;
  } else if (toolId === 'color-extractor') {
    const file = appState.activeFiles[0];
    const colors = await runColorExtraction(file, appState.activeToolOptions.count);
    
    // Display Swatches inside comparison metric mount
    metricMount.classList.remove('hidden');
    metricMount.innerHTML = `
      <div class="palette-swatches">
        ${colors.map(col => `
          <div class="palette-card" onclick="copyColorToClipboard('${col}')">
            <div class="palette-card-color" style="background-color:${col};"></div>
            <div class="palette-card-hex">${col}</div>
          </div>
        `).join('')}
      </div>
    `;
    
    const paletteName = file.name.replace(/\.[^.]+$/, '') + '_palette.json';
    const paletteBlob = new Blob([JSON.stringify({ source: file.name, colors }, null, 2)], { type: 'application/json' });
    registerToolResult(downloadBtn, paletteBlob, paletteName);
    logHistory(paletteName, 'Color Extractor', formatCropBytes(paletteBlob.size));
    showToast('Color palette extracted. Copy a swatch or download the validated JSON palette.', 'success');
    
  } else if (toolId === 'zip-manager') {
    const zipName = document.getElementById('opt-zipname').value || 'bundle.zip';
    const zipBlob = await runZIPMaker();
    
    registerToolResult(downloadBtn, zipBlob, zipName);
    logHistory(zipName, 'ZIP Manager', (zipBlob.size / (1024*1024)).toFixed(2) + ' MB');
    showToast('Files archived into ZIP successfully!', 'success');
    
  } else if (toolId === 'split-pdf') {
    const mode = appState.activeToolOptions.mode || 'every';
    const range = document.getElementById('opt-split-range') ? document.getElementById('opt-split-range').value : '';
    const everyN = Number(document.getElementById('opt-split-every-n')?.value || 2);
    const splitBlob = await runPDFSplit(mode, range, everyN);
    
    const outputName = 'split_' + appState.activeFiles[0].name + '.zip';
    registerToolResult(downloadBtn, splitBlob, outputName);
    logHistory(outputName, 'Split PDF', (splitBlob.size / (1024*1024)).toFixed(2) + ' MB');
    showToast('PDF pages split successfully!', 'success');
    
  } else if (toolId === 'protect-pdf') {
    const pass = document.getElementById('opt-protect-pass').value;
    const confirm = document.getElementById('opt-protect-confirm').value;
    if (pass !== confirm) throw new Error("Passwords do not match.");
    if (!pass) throw new Error("Password cannot be empty.");
    
    const protectedBlob = await runPDFProtect(pass);
    const outputName = 'protected_' + appState.activeFiles[0].name;
    registerToolResult(downloadBtn, protectedBlob, outputName);
    logHistory(outputName, 'Protect PDF', (protectedBlob.size / (1024*1024)).toFixed(2) + ' MB');
    showToast('PDF passcode protected!', 'success');
    
  } else if (toolId === 'unlock-pdf') {
    const pass = document.getElementById('opt-unlock-pass').value;
    const unlockedBlob = await runPDFUnlock(pass);
    const outputName = 'unlocked_' + appState.activeFiles[0].name;
    registerToolResult(downloadBtn, unlockedBlob, outputName);
    logHistory(outputName, 'Unlock PDF', (unlockedBlob.size / (1024*1024)).toFixed(2) + ' MB');
    showToast('PDF successfully unlocked!', 'success');
    
  } else if (toolId === 'pdf-to-jpg') {
    const format = appState.activeToolOptions.format || 'jpg';
    const jpgBlob = await runPDFToJPG(format);
    const outputName = 'extracted_images_' + appState.activeFiles[0].name + '.zip';
    registerToolResult(downloadBtn, jpgBlob, outputName);
    logHistory(outputName, 'PDF to JPG', (jpgBlob.size / (1024*1024)).toFixed(2) + ' MB');
    showToast('Extracted PDF pages as images!', 'success');
    
  } else if (toolId === 'jpg-to-pdf') {
    const setup = appState.activeToolOptions.setup || 'a4';
    const orient = appState.activeToolOptions.orientation || 'portrait';
    const imagePdfBlob = await runJPGToPDF(setup, orient);
    const outputName = 'images_converted.pdf';
    registerToolResult(downloadBtn, imagePdfBlob, outputName);
    logHistory(outputName, 'JPG to PDF', (imagePdfBlob.size / (1024*1024)).toFixed(2) + ' MB');
    showToast('Images successfully compiled to PDF!', 'success');
    
  } else if (toolId === 'word-to-pdf') {
    const font = appState.activeToolOptions.font || 'Helvetica';
    const wordPdfBlob = await runWordToPDF(font);
    const outputName = appState.activeFiles[0].name.split('.')[0] + '_converted.pdf';
    registerToolResult(downloadBtn, wordPdfBlob, outputName);
    logHistory(outputName, 'Word to PDF', (wordPdfBlob.size / (1024*1024)).toFixed(2) + ' MB');
    showToast('Document converted to PDF!', 'success');
    
  } else if (toolId === 'pdf-to-word') {
    const format = appState.activeToolOptions.output || 'txt';
    const wordBlob = await runPDFToWord(format);
    const outputName = appState.activeFiles[0].name.split('.')[0] + '_converted.' + format;
    registerToolResult(downloadBtn, wordBlob, outputName);
    logHistory(outputName, 'PDF to Word', (wordBlob.size / (1024*1024)).toFixed(2) + ' MB');
    showToast('Selectable PDF text extracted successfully.', 'success');
    
  } else if (toolId === 'epub-to-pdf') {
    const epubPdfBlob = await runEPUBToPDF();
    const outputName = appState.activeFiles[0].name.split('.')[0] + '_converted.pdf';
    registerToolResult(downloadBtn, epubPdfBlob, outputName);
    logHistory(outputName, 'EPUB to PDF', (epubPdfBlob.size / (1024*1024)).toFixed(2) + ' MB');
    showToast('Ebook converted to PDF!', 'success');
    
  } else if (toolId === 'pdf-to-epub') {
    const title = document.getElementById('epub-title').value || 'My Epub';
    const author = document.getElementById('epub-author').value || 'GXA Technologies';
    const epubBlob = await runPDFToEPUB(title, author);
    const outputName = appState.activeFiles[0].name.split('.')[0] + '_converted.epub';
    registerToolResult(downloadBtn, epubBlob, outputName);
    logHistory(outputName, 'PDF to EPUB', (epubBlob.size / (1024*1024)).toFixed(2) + ' MB');
    showToast('PDF converted to EPUB ebook!', 'success');
    
  } else if (toolId === 'gif-maker') {
    const speed = appState.activeToolOptions.speed || 500;
    const gifBlob = await runGIFMaker(speed);
    const outputName = 'animation_maker.gif';
    registerToolResult(downloadBtn, gifBlob, outputName);
    logHistory(outputName, 'GIF Maker', (gifBlob.size / (1024*1024)).toFixed(2) + ' MB');
    showToast('Animated GIF created locally!', 'success');
    
  } else if (toolId === 'zip-extractor') {
    const extractedFiles = await runZIPExtractor();
    metricMount.classList.remove('hidden');
    metricMount.innerHTML = `
      <div style="text-align:left; max-height:220px; overflow-y:auto; padding:10px; border:1px solid var(--color-border); border-radius:var(--radius-md); background-color:var(--color-bg);">
        <h5 style="margin-bottom:8px; font-weight:700;">Extracted Files (${extractedFiles.length})</h5>
        <ul style="list-style:none; display:flex; flex-direction:column; gap:6px;">
          ${extractedFiles.map((f, i) => `
            <li style="display:flex; justify-content:between; align-items:center; font-size:13px; font-family:var(--font-mono);">
              <span style="overflow:hidden; text-overflow:ellipsis; white-space:nowrap; max-width:240px;">${f.name}</span>
              <button class="btn btn-ghost btn-sm" onclick="saveExtractedFileIndex(${i})" style="min-height:28px; padding:2px 8px; margin-left:auto;"><i data-lucide="download" style="width:12px;"></i> Save</button>
            </li>
          `).join('')}
        </ul>
      </div>
    `;
    downloadBtn.classList.add('hidden');
    logHistory(appState.activeFiles[0].name, 'ZIP Extractor', '0.0 MB');
    showToast('ZIP archive unpacked successfully!', 'success');
  } else if (toolId === 'compress-pdf') {
    const originalFile = appState.activeFiles[0];
    const compressedBlob = await runPDFCompress(originalFile, appState.activeToolOptions.compression);
    const savings = originalFile.size - compressedBlob.size;
    metricMount.classList.remove('hidden');
    metricMount.textContent = `Original: ${window.GxaWorkspace.formatBytes(originalFile.size)} • Output: ${window.GxaWorkspace.formatBytes(compressedBlob.size)} • Saved: ${window.GxaWorkspace.formatBytes(savings)}`;
    const outputName = 'compressed_' + originalFile.name;
    registerToolResult(downloadBtn, compressedBlob, outputName);
    logHistory(outputName, 'Compress PDF', (compressedBlob.size / (1024*1024)).toFixed(2) + ' MB');
    showToast('PDF compressed client-side!', 'success');
  } else if (toolId === 'rotate-pdf') {
    const originalFile = appState.activeFiles[0];
    const angle = appState.activeToolOptions.angle || 90;
    const rotatedBlob = await runPDFRotate(originalFile, angle, getStudioPdfPageSelection());
    const outputName = 'rotated_' + originalFile.name;
    registerToolResult(downloadBtn, rotatedBlob, outputName);
    logHistory(outputName, 'Rotate PDF', (rotatedBlob.size / (1024*1024)).toFixed(2) + ' MB');
    showToast('PDF pages rotated client-side!', 'success');
  } else if (toolId === 'watermark-pdf') {
    const originalFile = appState.activeFiles[0];
    const watermarkSettings = getWatermarkSettings();
    const wmBlob = await runPDFWatermark(originalFile, watermarkSettings, getWatermarkPageSelection());
    const outputName = 'watermarked_' + originalFile.name;
    registerToolResult(downloadBtn, wmBlob, outputName);
    logHistory(outputName, 'Add Watermark', (wmBlob.size / (1024*1024)).toFixed(2) + ' MB');
    showToast('Watermark applied successfully.', 'success');
  } else if (toolId === 'pagenumber-pdf') {
    const originalFile = appState.activeFiles[0];
    const pos = document.getElementById('opt-pn-pos').value || 'bottom-center';
    const numberOptions = {
      start: Number(document.getElementById('opt-pn-start')?.value || 1),
      size: Number(document.getElementById('opt-pn-size')?.value || 10),
      prefix: document.getElementById('opt-pn-prefix')?.value || '',
      suffix: document.getElementById('opt-pn-suffix')?.value || '',
      skipFirst: document.getElementById('opt-pn-skip-first')?.checked || false
    };
    const pnBlob = await runPDFPageNumbers(originalFile, pos, getStudioPdfPageSelection(), numberOptions);
    const outputName = 'numbered_' + originalFile.name;
    registerToolResult(downloadBtn, pnBlob, outputName);
    logHistory(outputName, 'Page Numbers', (pnBlob.size / (1024*1024)).toFixed(2) + ' MB');
    showToast('Page numbers added to PDF!', 'success');
  } else if (toolId === 'pdf-metadata') {
    const originalFile = appState.activeFiles[0];
    const title = document.getElementById('opt-meta-title').value || '';
    const author = document.getElementById('opt-meta-author').value || '';
    const subject = document.getElementById('opt-meta-subject')?.value || '';
    const keywords = document.getElementById('opt-meta-keywords')?.value || '';
    const metaBlob = await runPDFMetadataEdit(originalFile, title, author, subject, keywords);
    const outputName = 'meta_' + originalFile.name;
    registerToolResult(downloadBtn, metaBlob, outputName);
    logHistory(outputName, 'PDF Metadata', (metaBlob.size / (1024*1024)).toFixed(2) + ' MB');
    showToast('PDF metadata updated!', 'success');
  } else if (toolId === 'excel-to-pdf') {
    const originalFile = appState.activeFiles[0];
    const font = document.getElementById('opt-excel-font')?.value || 'Helvetica';
    const excelBlob = await runExcelToPDF(originalFile, font);
    const outputName = originalFile.name.split('.')[0] + '_spreadsheet.pdf';
    registerToolResult(downloadBtn, excelBlob, outputName);
    logHistory(outputName, 'Excel to PDF', (excelBlob.size / (1024*1024)).toFixed(2) + ' MB');
    showToast('Excel table rendered as PDF!', 'success');
  } else if (toolId === 'ppt-to-pdf') {
    const originalFile = appState.activeFiles[0];
    const theme = document.getElementById('opt-ppt-theme')?.value || 'dark';
    const pptBlob = await runPPTToPDF(originalFile, theme);
    const outputName = originalFile.name.split('.')[0] + '_presentation.pdf';
    registerToolResult(downloadBtn, pptBlob, outputName);
    logHistory(outputName, 'PPT to PDF', (pptBlob.size / (1024*1024)).toFixed(2) + ' MB');
    showToast('Presentation slides rendered as PDF!', 'success');
  } else if (toolId === 'pdf-to-text') {
    const originalFile = appState.activeFiles[0];
    const textBlob = await runPDFToText(originalFile);
    const outputName = originalFile.name.split('.')[0] + '_extracted.txt';
    registerToolResult(downloadBtn, textBlob, outputName);
    logHistory(outputName, 'PDF to Text', (textBlob.size / 1024).toFixed(2) + ' KB');
    showToast('PDF text extracted!', 'success');
  } else if (toolId === 'html-to-pdf') {
    const rawCode = document.getElementById('opt-html-raw').value || '';
    const file = appState.activeFiles[0];
    const htmlBlob = await runHtmlToPDF(file, rawCode);
    const outputName = (file ? file.name.split('.')[0] : 'html_render') + '.pdf';
    registerToolResult(downloadBtn, htmlBlob, outputName);
    logHistory(outputName, 'HTML to PDF', (htmlBlob.size / 1024).toFixed(2) + ' KB');
    showToast('HTML compiled to PDF successfully!', 'success');
  } else if (toolId === 'pdf-to-html') {
    const originalFile = appState.activeFiles[0];
    const htmlBlob = await runPDFToHtml(originalFile);
    const outputName = originalFile.name.split('.')[0] + '_render.html';
    registerToolResult(downloadBtn, htmlBlob, outputName);
    logHistory(outputName, 'PDF to HTML', (htmlBlob.size / 1024).toFixed(2) + ' KB');
    showToast('PDF structures output to HTML!', 'success');
  } else if (toolId === 'markdown-to-pdf') {
    const rawMd = document.getElementById('opt-md-raw').value || '';
    const file = appState.activeFiles[0];
    const mdBlob = await runMarkdownToPDF(file, rawMd);
    const outputName = (file ? file.name.split('.')[0] : 'md_render') + '.pdf';
    registerToolResult(downloadBtn, mdBlob, outputName);
    logHistory(outputName, 'Markdown to PDF', (mdBlob.size / 1024).toFixed(2) + ' KB');
    showToast('Markdown compiled to PDF!', 'success');
  } else if (toolId === 'pdf-to-markdown') {
    const originalFile = appState.activeFiles[0];
    const mdBlob = await runPDFToMarkdown(originalFile);
    const outputName = originalFile.name.split('.')[0] + '_render.md';
    registerToolResult(downloadBtn, mdBlob, outputName);
    logHistory(outputName, 'PDF to Markdown', (mdBlob.size / 1024).toFixed(2) + ' KB');
    showToast('PDF compiled to Markdown structure!', 'success');
  } else if (toolId === 'svg-to-png') {
    const file = appState.activeFiles[0];
    const width = parseInt(document.getElementById('opt-svg-width').value) || 1024;
    const pngBlob = await runSvgToPng(file, width);
    const outputName = file.name.split('.')[0] + '_converted.png';
    registerToolResult(downloadBtn, pngBlob, outputName);
    logHistory(outputName, 'SVG to PNG', (pngBlob.size / 1024).toFixed(2) + ' KB');
    showToast('SVG vector drawn to PNG image!', 'success');
  } else if (toolId === 'png-to-svg') {
    const file = appState.activeFiles[0];
    const svgBlob = await runPngToSvg(file);
    const outputName = file.name.split('.')[0] + '_vector.svg';
    registerToolResult(downloadBtn, svgBlob, outputName);
    logHistory(outputName, 'PNG to SVG', (svgBlob.size / 1024).toFixed(2) + ' KB');
    showToast('Image wrapped as SVG path!', 'success');
  } else if (toolId === 'webp-to-jpg') {
    const files = appState.activeFiles;
    const file = files[0];
    const format = document.getElementById('opt-webp-out').value || 'jpg';
    let outBlob;
    let outputName;
    let batchItems = [];
    if (files.length > 1) {
      const batch = await createImageBatchOutput(
        files,
        item => runWebpToJpg(item, format),
        (item, index) => `converted-${String(index + 1).padStart(2, '0')}-${item.name.replace(/\.[^.]+$/, '')}.${format}`,
        `converted-webp-${format}.zip`
      );
      ({ blob: outBlob, filename: outputName, items: batchItems } = batch);
    } else {
      outBlob = await runWebpToJpg(file, format);
      outputName = file.name.split('.')[0] + '_converted.' + format;
    }
    registerToolResult(downloadBtn, outBlob, outputName);
    if (batchItems.length) {
      metricMount.classList.remove('hidden');
      metricMount.innerHTML = '';
      renderImageBatchActions(metricMount, batchItems);
    }
    logHistory(outputName, 'WEBP Conversion', (outBlob.size / 1024).toFixed(2) + ' KB');
    showToast('WEBP converted successfully!', 'success');
  } else if (toolId === 'gif-to-png') {
    const file = appState.activeFiles[0];
    const zipBlob = await runGifToPng(file);
    const outputName = file.name.split('.')[0] + '_frames.zip';
    registerToolResult(downloadBtn, zipBlob, outputName);
    logHistory(outputName, 'GIF to PNG', (zipBlob.size / (1024*1024)).toFixed(2) + ' MB');
    showToast('Extracted GIF frames archived to ZIP!', 'success');
  } else if (toolId === 'text-to-speech') {
    const textStr = document.getElementById('opt-speech-text').value;
    const rate = parseFloat(document.getElementById('opt-speech-rate').value) || 1.0;
    const file = appState.activeFiles[0];
    await runTextToSpeech(file, textStr, rate);
    metricMount.classList.remove('hidden');
    metricMount.innerHTML = `
      <div style="padding: 10px; border: 1px solid var(--color-border); border-radius: var(--radius-md); background: var(--color-bg); display:flex; gap:10px; justify-content:center; align-items:center;">
        <button class="btn btn-ghost btn-sm" onclick="speakBrowserSynthesis()"><i data-lucide="play" style="width:16px;"></i> Play</button>
        <button class="btn btn-ghost btn-sm" onclick="stopBrowserSynthesis()"><i data-lucide="square" style="width:16px;"></i> Stop</button>
      </div>
    `;
    lucide.createIcons();
    downloadBtn.classList.add('hidden');
    logHistory(file ? file.name : 'synthesized_speech', 'Text-to-Speech', '0.0 MB');
    showToast('Speech is ready in the browser. Use the playback controls.', 'success');
  } else if (toolId === 'qr-reader') {
    const file = appState.activeFiles[0];
    const dataStr = await runQrReader(file);
    metricMount.classList.remove('hidden');
    metricMount.innerHTML = `
      <div class="complete-comparison">
        <strong>Extracted QR Link/Text:</strong>
        <p style="font-family:var(--font-mono); padding:8px; border:1px solid var(--color-border); border-radius:4px; word-break:break-all; font-size:13px; text-align:left; background:var(--color-bg); margin-top:8px;">${dataStr}</p>
        <button class="btn btn-ghost btn-sm" onclick="navigator.clipboard.writeText('${dataStr.replace(/'/g, "\\'")}')" style="margin-top:8px;"><i data-lucide="copy" style="width:12px;"></i> Copy Result</button>
      </div>
    `;
    lucide.createIcons();
    downloadBtn.classList.add('hidden');
    logHistory(file.name, 'QR Code Reader', '0.0 MB');
    showToast('QR code scanned successfully!', 'success');
  } else if (toolId === 'barcode-reader') {
    const file = appState.activeFiles[0];
    const dataStr = await runBarcodeReader(file);
    metricMount.classList.remove('hidden');
    metricMount.innerHTML = `
      <div class="complete-comparison">
        <strong>Extracted Barcode Tag:</strong>
        <p style="font-family:var(--font-mono); padding:8px; border:1px solid var(--color-border); border-radius:4px; font-size:13px; background:var(--color-bg); margin-top:8px;">${dataStr}</p>
      </div>
    `;
    downloadBtn.classList.add('hidden');
    logHistory(file.name, 'Barcode Scanner', '0.0 MB');
    showToast('Barcode scanned client-side!', 'success');
  } else if (toolId === 'base64-tool') {
    const mode = appState.activeToolOptions.mode || 'encode';
    const textRaw = document.getElementById('opt-b64-raw').value;
    const file = appState.activeFiles[0];
    const resStr = await runBase64Tool(file, textRaw, mode);
    metricMount.classList.remove('hidden');
    metricMount.innerHTML = `
      <div style="text-align:left;">
        <strong>Base64 Output:</strong>
        <textarea readonly class="form-input-text" style="height:120px; font-family:var(--font-mono); font-size:11px; margin-top:8px;" onclick="this.select()">${resStr}</textarea>
        <button class="btn btn-ghost btn-sm" onclick="navigator.clipboard.writeText(this.previousElementSibling.value)" style="margin-top:8px;"><i data-lucide="copy" style="width:12px;"></i> Copy Base64</button>
      </div>
    `;
    lucide.createIcons();
    downloadBtn.classList.add('hidden');
    logHistory(file ? file.name : 'raw_text', 'Base64 Tool', '0.0 MB');
    showToast('Base64 processing complete!', 'success');
  } else if (toolId === 'hash-tool') {
    const algo = document.getElementById('opt-hash-algo').value || 'SHA-256';
    const text = document.getElementById('opt-hash-text').value;
    const file = appState.activeFiles[0];
    const hash = await runHashTool(file, text, algo);
    metricMount.classList.remove('hidden');
    metricMount.innerHTML = `
      <div style="text-align:left;">
        <strong>Computed ${algo} Hash:</strong>
        <p style="font-family:var(--font-mono); padding:8px; border:1px solid var(--color-border); border-radius:4px; background:var(--color-bg); word-break:break-all; font-size:12px; font-weight:bold; margin-top:8px;">${hash}</p>
        <button class="btn btn-ghost btn-sm" onclick="navigator.clipboard.writeText('${hash}')"><i data-lucide="copy" style="width:12px;"></i> Copy Hash</button>
      </div>
    `;
    lucide.createIcons();
    downloadBtn.classList.add('hidden');
    logHistory(file ? file.name : 'text_content', 'Hash Generator', '0.0 MB');
    showToast('Hash calculated successfully!', 'success');
  } else if (toolId === 'word-counter') {
    const text = document.getElementById('opt-wc-text').value;
    const file = appState.activeFiles[0];
    const stats = await runWordCounter(file, text);
    metricMount.classList.remove('hidden');
    metricMount.innerHTML = `
      <div style="text-align:left; font-size:13px;">
        <h5 style="font-weight:700; margin-bottom:8px;">Text Metrics Analysis</h5>
        <table style="width:100%; border-collapse:collapse;">
          <tr style="border-bottom:1px solid var(--color-border);"><td style="padding:4px 0;">Characters:</td><td style="text-align:right; font-weight:700;">${stats.chars}</td></tr>
          <tr style="border-bottom:1px solid var(--color-border);"><td style="padding:4px 0;">Words:</td><td style="text-align:right; font-weight:700;">${stats.words}</td></tr>
          <tr style="border-bottom:1px solid var(--color-border);"><td style="padding:4px 0;">Sentences:</td><td style="text-align:right; font-weight:700;">${stats.sentences}</td></tr>
          <tr><td style="padding:4px 0;">Est. Reading Time:</td><td style="text-align:right; font-weight:700;">${stats.time} min</td></tr>
        </table>
      </div>
    `;
    downloadBtn.classList.add('hidden');
    logHistory(file ? file.name : 'text_content', 'Word Counter', '0.0 MB');
    showToast('Text analysis complete!', 'success');
  } else if (toolId === 'exif-viewer') {
    const file = appState.activeFiles[0];
    const exifTags = await runExifViewer(file);
    metricMount.classList.remove('hidden');
    metricMount.innerHTML = `
      <div style="text-align:left; font-size:12px; max-height:160px; overflow-y:auto;">
        <h5 style="font-weight:700; margin-bottom:6px;">Image EXIF Header Details</h5>
        <table style="width:100%; border-collapse:collapse;">
          ${Object.entries(exifTags).map(([k, v]) => `
            <tr style="border-bottom:1px solid var(--color-border);"><td style="padding:3px 0; color:var(--color-text-secondary);">${k}</td><td style="text-align:right; font-weight:700; word-break:break-all;">${v}</td></tr>
          `).join('')}
        </table>
      </div>
    `;
    const archive = new JSZip();
    archive.file('metadata.json', JSON.stringify(exifTags, null, 2));
    if (document.getElementById('opt-exif-clean-copy')?.checked) {
      const cleanedBlob = await runWebpToJpg(file, 'png');
      await validateGeneratedOutputBlob(cleanedBlob, 'metadata-free.png');
      archive.file('metadata-free.png', cleanedBlob);
    }
    const resultBlob = await archive.generateAsync({ type: 'blob', compression: 'DEFLATE' });
    const outputName = file.name.replace(/\.[^.]+$/, '') + '_metadata.zip';
    registerToolResult(downloadBtn, resultBlob, outputName);
    logHistory(outputName, 'EXIF Viewer', formatCropBytes(resultBlob.size));
    showToast('Metadata report and cleaned image package created.', 'success');
  } else if (toolId === 'remove-pdf-pages') {
    const originalFile = appState.activeFiles[0];
    const range = document.getElementById('opt-remove-pages').value || '';
    const processedBlob = await runPDFRemovePages(originalFile, range);
    const outputName = 'removed_' + originalFile.name;
    registerToolResult(downloadBtn, processedBlob, outputName);
    logHistory(outputName, 'Remove PDF Pages', (processedBlob.size / (1024*1024)).toFixed(2) + ' MB');
    showToast('Pages removed successfully!', 'success');
  } else if (toolId === 'extract-pdf-pages') {
    const originalFile = appState.activeFiles[0];
    const range = document.getElementById('opt-extract-pages').value || '';
    const processedBlob = await runPDFExtractPages(originalFile, range);
    const outputName = 'extracted_' + originalFile.name;
    registerToolResult(downloadBtn, processedBlob, outputName);
    logHistory(outputName, 'Extract PDF Pages', (processedBlob.size / (1024*1024)).toFixed(2) + ' MB');
    showToast('Pages extracted successfully!', 'success');
  } else if (toolId === 'extract-images-pdf') {
    const originalFile = appState.activeFiles[0];
    const zipBlob = await runPDFExtractImages(originalFile);
    const outputName = 'extracted_images_' + originalFile.name.split('.')[0] + '.zip';
    registerToolResult(downloadBtn, zipBlob, outputName);
    logHistory(outputName, 'Extract Images', (zipBlob.size / (1024*1024)).toFixed(2) + ' MB');
    showToast('Images extracted successfully into ZIP!', 'success');
  } else if (toolId === 'crop-pdf') {
    const originalFile = appState.activeFiles[0];
    const top = parseFloat(document.getElementById('opt-crop-top').value) || 0;
    const bottom = parseFloat(document.getElementById('opt-crop-bottom').value) || 0;
    const left = parseFloat(document.getElementById('opt-crop-left').value) || 0;
    const right = parseFloat(document.getElementById('opt-crop-right').value) || 0;
    const processedBlob = await runPDFCrop(originalFile, top, bottom, left, right, getStudioPdfPageSelection());
    const outputName = 'cropped_' + originalFile.name;
    registerToolResult(downloadBtn, processedBlob, outputName);
    logHistory(outputName, 'Crop PDF', (processedBlob.size / (1024*1024)).toFixed(2) + ' MB');
    showToast('PDF cropped successfully!', 'success');
  } else if (toolId === 'header-footer-pdf') {
    const originalFile = appState.activeFiles[0];
    const headerText = document.getElementById('opt-hf-header').value || '';
    const footerText = document.getElementById('opt-hf-footer').value || '';
    const align = document.getElementById('opt-hf-align').value || 'center';
    const fontSize = Number(document.getElementById('opt-hf-size')?.value || 10);
    const processedBlob = await runPDFHeaderFooter(originalFile, headerText, footerText, align, getStudioPdfPageSelection(), fontSize);
    const outputName = 'hf_' + originalFile.name;
    registerToolResult(downloadBtn, processedBlob, outputName);
    logHistory(outputName, 'Add Header & Footer', (processedBlob.size / (1024*1024)).toFixed(2) + ' MB');
    showToast('Header and Footer added to PDF!', 'success');
  } else if (toolId === 'sign-pdf') {
    const originalFile = appState.activeFiles[0];
    const name = document.getElementById('opt-sign-name').value.trim();
    const signatureUpload = document.getElementById('pdf-signature-upload')?.files?.[0];
    let signatureAsset = null;
    if (signatureUpload) {
      signatureAsset = { bytes: new Uint8Array(await signatureUpload.arrayBuffer()), type: signatureUpload.type };
    } else if (pdfSignatureDrawingDataUrl) {
      const response = await fetch(pdfSignatureDrawingDataUrl);
      signatureAsset = { bytes: new Uint8Array(await response.arrayBuffer()), type: 'image/png' };
    }
    if (!name && !signatureAsset) throw new Error('Type a signer name, draw a signature, or upload a signature image.');
    const color = document.getElementById('opt-sign-color').value || 'blue';
    const processedBlob = await runPDFSign(originalFile, name, color, getStudioPdfPageSelection(), signatureAsset);
    const outputName = 'signed_' + originalFile.name;
    registerToolResult(downloadBtn, processedBlob, outputName);
    logHistory(outputName, 'Sign PDF', (processedBlob.size / (1024*1024)).toFixed(2) + ' MB');
    showToast('Visible signature appearance added. This is not a cryptographic signature.', 'success');
  } else if (toolId === 'repair-pdf') {
    const originalFile = appState.activeFiles[0];
    const processedBlob = await runPDFRepair(originalFile);
    const outputName = 'repaired_' + originalFile.name;
    registerToolResult(downloadBtn, processedBlob, outputName);
    logHistory(outputName, 'Repair PDF', (processedBlob.size / (1024*1024)).toFixed(2) + ' MB');
    showToast('Readable PDF loaded and normalized successfully.', 'success');
  } else if (toolId === 'ocr-pdf') {
    const originalFile = appState.activeFiles[0];
    const lang = document.getElementById('opt-ocr-lang')?.value || 'eng';
    const processedBlob = await runPDFOCR(originalFile, lang);
    const outputName = originalFile.name.replace(/\.pdf$/i, '') + '_ocr.txt';
    registerToolResult(downloadBtn, processedBlob, outputName);
    logHistory(outputName, 'OCR PDF', (processedBlob.size / (1024*1024)).toFixed(2) + ' MB');
    showToast('OCR text extracted locally and is ready to download.', 'success');
  } else if (toolId === 'image-to-pdf') {
    const size = document.getElementById('opt-img2pdf-size').value || 'a4';
    const processedBlob = await runJPGToPDF(size, 'portrait');
    const outputName = 'images_converted.pdf';
    registerToolResult(downloadBtn, processedBlob, outputName);
    logHistory(outputName, 'Image to PDF', (processedBlob.size / (1024*1024)).toFixed(2) + ' MB');
    showToast('Images successfully converted to PDF!', 'success');
  } else if (toolId === 'png-to-pdf') {
    const size = document.getElementById('opt-png2pdf-size').value || 'a4';
    const processedBlob = await runJPGToPDF(size, 'portrait');
    const outputName = 'png_converted.pdf';
    registerToolResult(downloadBtn, processedBlob, outputName);
    logHistory(outputName, 'PNG to PDF', (processedBlob.size / (1024*1024)).toFixed(2) + ' MB');
    showToast('PNG images converted to PDF!', 'success');
  } else if (toolId === 'txt-to-pdf') {
    const font = document.getElementById('opt-txt2pdf-font').value || 'Helvetica';
    const processedBlob = await runWordToPDF(font);
    const outputName = appState.activeFiles[0].name.split('.')[0] + '_txt.pdf';
    registerToolResult(downloadBtn, processedBlob, outputName);
    logHistory(outputName, 'TXT to PDF', (processedBlob.size / (1024*1024)).toFixed(2) + ' MB');
    showToast('Plain text compiled to PDF!', 'success');
  } else if (toolId === 'pdf-to-image') {
    const format = document.getElementById('opt-pdf2img-format').value || 'png';
    const zipBlob = await runPDFToJPG(format);
    const outputName = appState.activeFiles[0].name.split('.')[0] + '_images.zip';
    registerToolResult(downloadBtn, zipBlob, outputName);
    logHistory(outputName, 'PDF to Image', (zipBlob.size / (1024*1024)).toFixed(2) + ' MB');
    showToast('PDF pages converted to images!', 'success');
  } else if (toolId === 'pdf-to-png') {
    const zipBlob = await runPDFToJPG('png');
    const outputName = appState.activeFiles[0].name.split('.')[0] + '_png_images.zip';
    registerToolResult(downloadBtn, zipBlob, outputName);
    logHistory(outputName, 'PDF to PNG', (zipBlob.size / (1024*1024)).toFixed(2) + ' MB');
    showToast('PDF pages converted to lossless PNG images!', 'success');
  } else if (toolId === 'pdf-to-excel') {
    const originalFile = appState.activeFiles[0];
    const excelBlob = await runPDFToExcel(originalFile);
    const outputName = originalFile.name.split('.')[0] + '_tables.xlsx';
    registerToolResult(downloadBtn, excelBlob, outputName);
    logHistory(outputName, 'PDF to Excel', (excelBlob.size / 1024).toFixed(2) + ' KB');
    showToast('Spreadsheet extracted successfully!', 'success');
  } else if (toolId === 'pdf-to-ppt') {
    const originalFile = appState.activeFiles[0];
    const pptBlob = await runPDFToPPT(originalFile);
    const outputName = originalFile.name.split('.')[0] + '_presentation.pptx';
    registerToolResult(downloadBtn, pptBlob, outputName);
    logHistory(outputName, 'PDF to PPT', (pptBlob.size / 1024).toFixed(2) + ' KB');
    showToast('Image-based presentation generated successfully.', 'success');
  } else if (toolId === 'ai-pdf-summarizer') {
    const originalFile = appState.activeFiles[0];
    const depth = document.getElementById('opt-ai-summary-depth').value || 'standard';
    
    const formData = new FormData();
    formData.append('file', originalFile);
    formData.append('depth', depth);
    
    const response = await fetch('/api/ai-tools.php?action=summarize', {
      method: 'POST',
      body: formData
    });
    const result = await response.json();
    if (!result.success) throw new Error(result.message || 'AI processing failed');
    
    metricMount.classList.remove('hidden');
    metricMount.innerHTML = `
      <div style="text-align:left; max-height:350px; overflow-y:auto; padding:15px; background:var(--color-bg); border-radius:var(--radius-md); border:1px solid var(--color-border); width:100%;">
        <h4 style="font-size:16px; font-weight:700; color:var(--color-primary); margin-bottom:12px;">AI Document Summary</h4>
        <div style="margin-bottom:15px; font-weight:600; line-height:1.5;">${result.summary.short}</div>
        <div style="margin-bottom:15px; font-size:13px; color:var(--color-text-secondary); line-height:1.5;">${result.summary.detailed}</div>
        
        <h5 style="font-size:14px; font-weight:700; margin-bottom:8px;">Key Takeaways:</h5>
        <ul style="padding-left:20px; font-size:13px; color:var(--color-text-secondary); margin-bottom:15px; display:flex; flex-direction:column; gap:6px; list-style-type:disc;">
          ${(Array.isArray(result.summary.bullets) ? result.summary.bullets : []).map(b => `<li>${b}</li>`).join('')}
        </ul>
        
        <div style="font-size:11px; font-style:italic; border-top:1px solid var(--color-border); padding-top:10px; margin-top:15px; color:var(--color-text-muted);">
          Processed via ${result.provider}
        </div>
      </div>
    `;
    
    const textBlob = new Blob([
      `SUMMARY REPORT: ${result.fileName}\n`,
      `========================================\n`,
      `SHORT OVERVIEW:\n${result.summary.short}\n\n`,
      `DETAILED SUMMARY:\n${result.summary.detailed}\n\n`,
      `KEY BULLETS:\n- ${result.summary.bullets.join('\n- ')}\n\n`,
      `INSIGHTS:\n${result.summary.insights}\n`
    ], { type: 'text/plain' });
    
    registerToolResult(downloadBtn, textBlob, result.fileName.replace(/\.pdf$/i, '_summary.txt'));
    logHistory(originalFile.name, 'AI Summarizer', (originalFile.size / (1024*1024)).toFixed(2) + ' MB');
    showToast('AI document analysis complete!', 'success');
    
  } else if (toolId === 'ai-pdf-translator') {
    const originalFile = appState.activeFiles[0];
    const targetLang = document.getElementById('opt-ai-trans-lang').value || 'hindi';
    
    const formData = new FormData();
    formData.append('file', originalFile);
    formData.append('lang', targetLang);
    
    const response = await fetch('/api/ai-tools.php?action=translate', {
      method: 'POST',
      body: formData
    });
    const result = await response.json();
    if (!result.success) throw new Error(result.message || 'AI translation failed');
    
    metricMount.classList.remove('hidden');
    metricMount.innerHTML = `
      <div style="text-align:left; max-height:350px; overflow-y:auto; padding:15px; background:var(--color-bg); border-radius:var(--radius-md); border:1px solid var(--color-border); width:100%;">
        <h4 style="font-size:16px; font-weight:700; color:var(--color-primary); margin-bottom:12px;">Translated Document Content (${result.targetLanguage.toUpperCase()})</h4>
        <div style="line-height:1.6; font-size:14px;">${result.translatedText}</div>
        <div style="font-size:11px; font-style:italic; border-top:1px solid var(--color-border); padding-top:10px; margin-top:15px; color:var(--color-text-muted);">
          Translated via ${result.provider}
        </div>
      </div>
    `;
    
    const translatedBlob = new Blob([result.translatedText], { type: 'text/plain' });
    const outName = originalFile.name.replace(/\.pdf$/i, '_translated_' + targetLang + '.txt');
    registerToolResult(downloadBtn, translatedBlob, outName);
    logHistory(originalFile.name, 'AI Translator', (originalFile.size / (1024*1024)).toFixed(2) + ' MB');
    showToast('AI PDF translation complete!', 'success');
  }
}

// --- ALGORITHM: PDF MERGE ---
async function runPDFMerge() {
  const mergedPdf = await PDFLib.PDFDocument.create();
  const files = appState.activeFiles;
  
  // If reverse is enabled
  const orderedFiles = appState.activeToolOptions.reverse ? [...files].reverse() : files;
  
  for (const file of orderedFiles) {
    const arrayBuffer = await file.arrayBuffer();
    const doc = await PDFLib.PDFDocument.load(arrayBuffer);
    const copiedPages = await mergedPdf.copyPages(doc, doc.getPageIndices());
    copiedPages.forEach((page) => mergedPdf.addPage(page));
  }
  
  const pdfBytes = await mergedPdf.save();
  return new Blob([pdfBytes], { type: 'application/pdf' });
}

// --- ALGORITHM: PDF ORGANIZE (SPLIT/ROTATE/WATERMARK) ---
async function runPDFOrganize(rangeStr, rotationAngle, watermarkText, blankCount = 0, blankAfter = 0) {
  const file = appState.activeFiles[0];
  const arrayBuffer = await file.arrayBuffer();
  const srcDoc = await PDFLib.PDFDocument.load(arrayBuffer);
  const newPdf = await PDFLib.PDFDocument.create();
  
  // Calculate selected page indices
  let indices = [];
  if (rangeStr.trim() !== '') {
    const parts = rangeStr.split(',');
    parts.forEach(part => {
      if (part.includes('-')) {
        const [start, end] = part.split('-').map(n => parseInt(n.trim()) - 1);
        for (let i = start; i <= end; i++) {
          if (i >= 0 && i < srcDoc.getPageCount()) indices.push(i);
        }
      } else {
        const val = parseInt(part.trim()) - 1;
        if (val >= 0 && val < srcDoc.getPageCount()) indices.push(val);
      }
    });
  } else {
    // If range is empty, use all pages
    indices = srcDoc.getPageIndices();
  }
  
  const copiedPages = await newPdf.copyPages(srcDoc, indices);
  const safeBlankCount = Number.isInteger(blankCount) && blankCount >= 0 && blankCount <= 50 ? blankCount : 0;
  const safeBlankAfter = Number.isInteger(blankAfter) && blankAfter >= 0 && blankAfter <= copiedPages.length
    ? blankAfter
    : copiedPages.length;
  const addBlankPages = (referencePage) => {
    if (safeBlankCount === 0) return;
    const fallback = srcDoc.getPage(0);
    const width = referencePage?.getWidth() || fallback.getWidth();
    const height = referencePage?.getHeight() || fallback.getHeight();
    for (let count = 0; count < safeBlankCount; count += 1) newPdf.addPage([width, height]);
  };
  if (safeBlankAfter === 0) addBlankPages(copiedPages[0]);
  copiedPages.forEach((page, outputIndex) => {
    // Apply rotation
    if (rotationAngle !== 0) {
      page.setRotation(PDFLib.degrees(rotationAngle));
    }
    // Draw simple text watermark
    if (watermarkText !== '') {
      page.drawText(watermarkText, {
        x: page.getWidth() / 4,
        y: page.getHeight() / 2,
        size: 40,
        opacity: 0.15,
        rotate: PDFLib.degrees(45),
        color: PDFLib.rgb(0.9, 0.1, 0.1)
      });
    }
    newPdf.addPage(page);
    if (outputIndex + 1 === safeBlankAfter) addBlankPages(page);
  });
  
  const pdfBytes = await newPdf.save();
  return new Blob([pdfBytes], { type: 'application/pdf' });
}

function setOptAngle(angle, btn) {
  appState.activeToolOptions.angle = angle;
  const btns = btn.parentElement.querySelectorAll('.preset-btn');
  btns.forEach(b => b.classList.remove('active'));
  btn.classList.add('active');
}

// --- ALGORITHM: IMAGE COMPRESSION ---
function getImageStudioRenderSettings() {
  const value = (id, fallback) => Number(document.getElementById(id)?.value ?? fallback);
  return {
    rotation: value('studio-image-rotation', 0),
    flipX: document.getElementById('studio-image-flip-x')?.checked ? -1 : 1,
    flipY: document.getElementById('studio-image-flip-y')?.checked ? -1 : 1,
    brightness: value('studio-image-brightness', 100),
    contrast: value('studio-image-contrast', 100),
    saturation: value('studio-image-saturation', 100),
    grayscale: value('studio-image-grayscale', 0),
    blur: value('studio-image-blur', 0),
    watermark: document.getElementById('studio-image-watermark')?.value?.trim() || '',
    watermarkOpacity: value('studio-image-watermark-opacity', 35) / 100
  };
}

function renderImageStudioCanvas(image, targetWidth, targetHeight, background = 'transparent') {
  const settings = getImageStudioRenderSettings();
  const normalizedRotation = ((settings.rotation % 360) + 360) % 360;
  const swapsDimensions = normalizedRotation === 90 || normalizedRotation === 270;
  const canvas = document.createElement('canvas');
  canvas.width = Math.max(1, Math.round(swapsDimensions ? targetHeight : targetWidth));
  canvas.height = Math.max(1, Math.round(swapsDimensions ? targetWidth : targetHeight));
  const context = canvas.getContext('2d');
  context.imageSmoothingEnabled = true;
  context.imageSmoothingQuality = 'high';
  if (background !== 'transparent') {
    context.fillStyle = background;
    context.fillRect(0, 0, canvas.width, canvas.height);
  }
  context.save();
  context.translate(canvas.width / 2, canvas.height / 2);
  context.rotate(normalizedRotation * Math.PI / 180);
  context.scale(settings.flipX, settings.flipY);
  context.filter = `brightness(${settings.brightness}%) contrast(${settings.contrast}%) saturate(${settings.saturation}%) grayscale(${settings.grayscale}%) blur(${settings.blur}px)`;
  context.drawImage(image, -targetWidth / 2, -targetHeight / 2, targetWidth, targetHeight);
  context.restore();
  if (settings.watermark) {
    const fontSize = Math.max(14, Math.round(Math.min(canvas.width, canvas.height) * 0.055));
    context.save();
    context.globalAlpha = Math.max(0.05, Math.min(1, settings.watermarkOpacity));
    context.font = `700 ${fontSize}px sans-serif`;
    context.textAlign = 'right';
    context.textBaseline = 'bottom';
    context.lineWidth = Math.max(2, fontSize * 0.08);
    context.strokeStyle = 'rgba(0,0,0,.6)';
    context.fillStyle = '#fff';
    context.strokeText(settings.watermark, canvas.width - fontSize * 0.55, canvas.height - fontSize * 0.45);
    context.fillText(settings.watermark, canvas.width - fontSize * 0.55, canvas.height - fontSize * 0.45);
    context.restore();
  }
  window.GxaImageAnnotations?.render(context, canvas.width, canvas.height);
  return canvas;
}

function runImageCompression(file, quality, outputMime = 'image/jpeg') {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      const img = new Image();
      img.onload = () => {
        const canvas = renderImageStudioCanvas(img, img.width, img.height, outputMime === 'image/jpeg' ? '#ffffff' : 'transparent');
        
        canvas.toBlob((blob) => {
          blob ? resolve(blob) : reject(new Error('The browser could not encode the compressed image.'));
        }, outputMime, quality);
      };
      img.onerror = () => reject(new Error('The selected image is corrupted or unsupported by this browser.'));
      img.src = e.target.result;
    };
    reader.onerror = () => reject(new Error('The selected image could not be read.'));
    reader.readAsDataURL(file);
  });
}

function setImageQuality(val) {
  appState.activeToolOptions.quality = val / 100;
  document.getElementById('slider-val-label').innerText = `${val}%`;
}

function setPresetQuality(val, btn) {
  setImageQuality(val);
  const slider = document.querySelector('.custom-range-slider');
  if (slider) slider.value = val;
  
  const btns = btn.parentElement.querySelectorAll('.preset-btn');
  btns.forEach(b => b.classList.remove('active'));
  btn.classList.add('active');
}

// --- ALGORITHM: IMAGE RESIZING ---
function runImageResize(file, w, h, outputType = 'image/png') {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      const img = new Image();
      img.onload = () => {
        // Calculate dimensions with lock aspect ratio if enabled
        let targetW = Number(w);
        let targetH = Number(h);
        const percentage = Number(document.getElementById('opt-resize-percent')?.value || 100);
        if (!Number.isFinite(percentage) || percentage < 1 || percentage > 1000) {
          reject(new Error('Percentage scale must be between 1 and 1,000.'));
          return;
        }
        if (percentage !== 100) {
          targetW = img.width * percentage / 100;
          targetH = img.height * percentage / 100;
        }
        if (!Number.isFinite(targetW) || !Number.isFinite(targetH) || targetW < 1 || targetH < 1 || targetW > 10000 || targetH > 10000) {
          reject(new Error('Width and height must be between 1 and 10,000 pixels.'));
          return;
        }
        if (appState.activeToolOptions.aspect) {
          const ratio = img.width / img.height;
          if (targetW / targetH > ratio) {
            targetW = targetH * ratio;
          } else {
            targetH = targetW / ratio;
          }
        }
        if (document.getElementById('opt-prevent-upscale')?.checked && (targetW > img.width || targetH > img.height)) {
          const downscale = Math.min(1, img.width / targetW, img.height / targetH);
          targetW *= downscale;
          targetH *= downscale;
        }
        const canvas = renderImageStudioCanvas(img, targetW, targetH, outputType === 'image/jpeg' ? '#ffffff' : 'transparent');
        
        canvas.toBlob((blob) => {
          blob ? resolve(blob) : reject(new Error('The browser could not encode the resized image.'));
        }, outputType);
      };
      img.onerror = () => reject(new Error('The selected image is corrupted or unsupported by this browser.'));
      img.src = e.target.result;
    };
    reader.onerror = () => reject(new Error('The selected image could not be read.'));
    reader.readAsDataURL(file);
  });
}

// --- ALGORITHM: IMAGE CROPPING ---
function runImageCrop(file) {
  return new Promise((resolve, reject) => {
    if (!cropEditorState.cropper || cropEditorState.file !== file) {
      reject(new Error('Open this image in the manual crop editor and choose a crop area first.'));
      return;
    }
    const settings = getCropOutputSettings();
    const data = cropEditorState.cropper.getData(true);
    const canvas = cropEditorState.cropper.getCroppedCanvas({
      width: Math.max(1, Math.round(data.width)),
      height: Math.max(1, Math.round(data.height)),
      fillColor: settings.mime === 'image/jpeg' ? settings.background : 'transparent',
      imageSmoothingEnabled: true,
      imageSmoothingQuality: 'high'
    });
    if (!canvas) {
      reject(new Error('The selected crop could not be rendered.'));
      return;
    }
    canvas.toBlob(blob => {
      blob ? resolve(blob) : reject(new Error('The browser could not encode the cropped image.'));
    }, settings.mime, settings.quality);
  });
}

function runClientSideBgRemoval(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      const img = new Image();
      img.onload = () => {
        const canvas = document.createElement('canvas');
        canvas.width = img.width;
        canvas.height = img.height;
        const ctx = canvas.getContext('2d');
        ctx.drawImage(img, 0, 0);
        
        try {
          const imgData = ctx.getImageData(0, 0, canvas.width, canvas.height);
          const data = imgData.data;
          
          for (let i = 0; i < data.length; i += 4) {
            const r = data[i];
            const g = data[i + 1];
            const b = data[i + 2];
            
            if (r > 215 && g > 215 && b > 215) {
              data[i + 3] = 0;
            }
          }
          
          ctx.putImageData(imgData, 0, 0);
          canvas.toBlob((blob) => {
            blob ? resolve(blob) : reject(new Error('The browser could not encode the transparent PNG.'));
          }, 'image/png');
        } catch (err) {
          reject(new Error('Browser background removal failed: ' + err.message));
        }
      };
      img.onerror = () => reject(new Error("Image failed to load."));
      img.src = e.target.result;
    };
    reader.onerror = () => reject(new Error("File failed to read."));
    reader.readAsDataURL(file);
  });
}

function setCropRatio(ratio, btn) {
  appState.activeToolOptions.ratio = ratio;
  if (cropEditorState.cropper) setCropAspect(ratio);
  if (btn && btn.parentElement) {
    const btns = btn.parentElement.querySelectorAll('.preset-btn');
    btns.forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
  }
}

// --- ALGORITHM: PASSWORD GENERATOR ---
function setPwLength(val) {
  appState.activeToolOptions.length = val;
  document.getElementById('slider-pw-len').innerText = val;
  generatePassword();
}

function generatePassword() {
  const len = appState.activeToolOptions.length || 16;
  const hasUpper = document.getElementById('pw-upper').checked;
  const hasLower = document.getElementById('pw-lower').checked;
  const hasNums = document.getElementById('pw-nums').checked;
  const hasSyms = document.getElementById('pw-syms').checked;
  
  const upper = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
  const lower = 'abcdefghijklmnopqrstuvwxyz';
  const nums = '0123456789';
  const syms = '!@#$%^&*()_+~`|}{[]:;?><,./-=';
  
  let pool = '';
  if (hasUpper) pool += upper;
  if (hasLower) pool += lower;
  if (hasNums) pool += nums;
  if (hasSyms) pool += syms;
  
  if (pool === '') pool = lower; // Fallback
  
  let pw = '';
  for (let i = 0; i < len; i++) {
    const unbiasedLimit = 256 - (256 % pool.length);
    let randomByte = 256;
    while (randomByte >= unbiasedLimit) randomByte = crypto.getRandomValues(new Uint8Array(1))[0];
    const idx = randomByte % pool.length;
    pw += pool.charAt(idx);
  }
  
  // Render output
  const preview = document.getElementById('generator-preview-mount');
  if (preview) {
    preview.innerHTML = `
      <div style="width:100%;">
        <div class="password-box" id="generated-password-display">
          <span>${pw}</span>
          <button class="btn btn-ghost btn-sm" onclick="copyPasswordToClipboard('${pw}')"><i data-lucide="copy" style="width:16px;"></i></button>
        </div>
        <div class="pw-strength-bar">
          <div class="pw-strength-fill ${len < 10 ? 'strength-weak' : len < 15 ? 'strength-fair' : 'strength-strong'}" style="width: ${Math.min((len / 32) * 100, 100)}%;"></div>
        </div>
      </div>
    `;
    lucide.createIcons();
  }
}

function copyPasswordToClipboard(pw) {
  navigator.clipboard.writeText(pw);
  showToast('Password copied to clipboard!', 'success');
  logHistory('generated_password.txt', 'Password Generator', '0.0 KB');
}

function downloadPasswordText() {
  const display = document.getElementById('generated-password-display');
  if (!display) return;
  const text = display.innerText;
  const blob = new Blob([text], { type: 'text/plain' });
  saveBlob(blob, 'generated_password.txt');
}

// --- ALGORITHM: QR & BARCODE GENERATOR ---
function setBcFormat(format, btn) {
  appState.activeToolOptions.format = format;
  const btns = btn.parentElement.querySelectorAll('.preset-btn');
  btns.forEach(b => b.classList.remove('active'));
  btn.classList.add('active');
  generateBarcodeSVG();
}

function setBcColor(color, btn) {
  appState.activeToolOptions.color = color;
  const foreground = document.getElementById('bc-foreground');
  if (foreground) foreground.value = color;
  const btns = btn.parentElement.querySelectorAll('.swatch-btn');
  btns.forEach(b => b.classList.remove('active'));
  btn.classList.add('active');
  generateBarcodeSVG();
}

async function generateBarcodeSVG() {
  const data = document.getElementById('bc-text').value.trim();
  const format = appState.activeToolOptions.format || 'qr';
  const color = document.getElementById('bc-foreground')?.value || appState.activeToolOptions.color || '#000000';
  const background = document.getElementById('bc-background')?.value || '#ffffff';
  const size = Number(document.getElementById('bc-size')?.value || 256);
  const margin = Number(document.getElementById('bc-margin')?.value || 12);
  const preview = document.getElementById('generator-preview-mount');
  
  if (!preview) return;
  
  if (!data) {
    preview.innerHTML = '<p class="preview-error-state">Enter text or a URL to generate a code.</p>';
    return;
  }
  try {
    await window.GxaWorkspace.renderCode(data, format, color, preview, { size, margin, background });
  } catch (error) {
    preview.textContent = error.message;
  }
}

function downloadBarcodeSVGFile() {
  const container = document.getElementById('generator-preview-mount');
  const svg = container.querySelector('svg');
  if (svg) {
    const blob = new Blob([svg.outerHTML], { type: 'image/svg+xml' });
    saveBlob(blob, 'barcode_vector.svg');
    logHistory('barcode_vector.svg', 'QR & Barcode', `${(blob.size / 1024).toFixed(1)} KB`);
    return;
  }
  const canvas = container.querySelector('canvas');
  if (!canvas) return showToast('Generate a valid code before downloading.', 'error');
  const margin = Number(document.getElementById('bc-margin')?.value || 0);
  const background = document.getElementById('bc-background')?.value || '#ffffff';
  const outputCanvas = document.createElement('canvas');
  outputCanvas.width = canvas.width + (margin * 2);
  outputCanvas.height = canvas.height + (margin * 2);
  const context = outputCanvas.getContext('2d');
  context.fillStyle = background;
  context.fillRect(0, 0, outputCanvas.width, outputCanvas.height);
  context.drawImage(canvas, margin, margin);
  outputCanvas.toBlob((blob) => {
    if (!blob) return showToast('Unable to create the QR image.', 'error');
    saveBlob(blob, 'qr-code.png');
    logHistory('qr-code.png', 'QR & Barcode', `${(blob.size / 1024).toFixed(1)} KB`);
  }, 'image/png');
}

// --- ALGORITHM: IMAGE COLOR EXTRACTION ---
function runColorExtraction(file, colorCount) {
  return new Promise((resolve) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      const img = new Image();
      img.onload = () => {
        const canvas = document.createElement('canvas');
        const ctx = canvas.getContext('2d');
        canvas.width = 100;
        canvas.height = 100; // Downscale to cluster quickly
        ctx.drawImage(img, 0, 0, 100, 100);
        
        const imgData = ctx.getImageData(0, 0, 100, 100).data;
        const colorBuckets = {};
        
        // Loop over pixels (stride = 4)
        for (let i = 0; i < imgData.length; i += 4) {
          const r = Math.round(imgData[i] / 16) * 16;
          const g = Math.round(imgData[i+1] / 16) * 16;
          const b = Math.round(imgData[i+2] / 16) * 16;
          const hex = '#' + ((1 << 24) + (r << 16) + (g << 8) + b).toString(16).slice(1);
          colorBuckets[hex] = (colorBuckets[hex] || 0) + 1;
        }
        
        // Sort keys by frequency
        const sorted = Object.keys(colorBuckets).sort((a,b) => colorBuckets[b] - colorBuckets[a]);
        resolve(sorted.slice(0, colorCount));
      };
      img.src = e.target.result;
    };
    reader.readAsDataURL(file);
  });
}

function setPaletteCount(count, btn) {
  appState.activeToolOptions.count = count;
  const btns = btn.parentElement.querySelectorAll('.preset-btn');
  btns.forEach(b => b.classList.remove('active'));
  btn.classList.add('active');
}

function copyColorToClipboard(hex) {
  navigator.clipboard.writeText(hex);
  showToast(`Color ${hex} copied to clipboard!`, 'success');
}

// --- ALGORITHM: ZIP ARCHIVER MAKER ---
async function runZIPMaker() {
  const zip = new JSZip();
  
  for (const file of appState.activeFiles) {
    zip.file(file.name, file);
  }
  
  return await zip.generateAsync({ type: 'blob' });
}

// --- Options Settings Toggles ---
function setSplitMode(mode, btn) {
  appState.activeToolOptions.mode = mode;
  const group = document.getElementById('split-range-group');
  const everyNGroup = document.getElementById('split-every-n-group');
  group?.classList.toggle('hidden', mode !== 'range');
  everyNGroup?.classList.toggle('hidden', mode !== 'every-n');
  const btns = btn.parentElement.querySelectorAll('.preset-btn');
  btns.forEach(b => b.classList.remove('active'));
  btn.classList.add('active');
}

function setExportFormat(fmt, btn) {
  appState.activeToolOptions.format = fmt;
  const btns = btn.parentElement.querySelectorAll('.preset-btn');
  btns.forEach(b => b.classList.remove('active'));
  btn.classList.add('active');
}

function setPageSetup(setup, btn) {
  appState.activeToolOptions.setup = setup;
  const btns = btn.parentElement.querySelectorAll('.preset-btn');
  btns.forEach(b => b.classList.remove('active'));
  btn.classList.add('active');
}

function setOrientation(orient, btn) {
  appState.activeToolOptions.orientation = orient;
  const btns = btn.parentElement.querySelectorAll('.preset-btn');
  btns.forEach(b => b.classList.remove('active'));
  btn.classList.add('active');
}

function setDocFont(font, btn) {
  appState.activeToolOptions.font = font;
  const btns = btn.parentElement.querySelectorAll('.preset-btn');
  btns.forEach(b => b.classList.remove('active'));
  btn.classList.add('active');
}

function setDocOutput(out, btn) {
  appState.activeToolOptions.output = out;
  const btns = btn.parentElement.querySelectorAll('.preset-btn');
  btns.forEach(b => b.classList.remove('active'));
  btn.classList.add('active');
}

function setEpubSetup(setup, btn) {
  appState.activeToolOptions.setup = setup;
  const btns = btn.parentElement.querySelectorAll('.preset-btn');
  btns.forEach(b => b.classList.remove('active'));
  btn.classList.add('active');
}

function setGifSpeed(val) {
  appState.activeToolOptions.speed = val;
  document.getElementById('slider-gif-speed').innerText = `${val}ms`;
}

// --- Dynamic File Save indexes for ZIP Extractor ---
let zipExtractorFiles = [];
function saveExtractedFileIndex(idx) {
  const f = zipExtractorFiles[idx];
  if (!f) return;
  saveBlob(f.blob, f.name);
}

// --- ALGORITHM: PDF SPLIT (MULTIPLE SINGLE-PAGE FILES OR RANGES) ---
function parsePdfPageSelection(rangeStr, pageCount) {
  const input = String(rangeStr || '').trim();
  if (!input) throw new Error('Enter at least one page number or range.');
  const selected = [];
  for (const token of input.split(',')) {
    const value = token.trim();
    if (!/^\d+(?:\s*-\s*\d+)?$/.test(value)) throw new Error(`Invalid page range: "${value}".`);
    const [startValue, endValue] = value.split('-').map(part => Number(part.trim()));
    const start = startValue;
    const end = endValue || startValue;
    if (start < 1 || end < start || end > pageCount) throw new Error(`Page range "${value}" is outside 1-${pageCount}.`);
    for (let page = start; page <= end; page += 1) selected.push(page - 1);
  }
  return [...new Set(selected)];
}

async function runPDFSplit(mode, rangeStr, everyN = 2) {
  const file = appState.activeFiles[0];
  const arrayBuffer = await file.arrayBuffer();
  const srcDoc = await PDFLib.PDFDocument.load(arrayBuffer);
  const zip = new JSZip();
  
  let ranges = [];
  if (mode === 'every') {
    for (let i = 0; i < srcDoc.getPageCount(); i++) {
      ranges.push([i]);
    }
  } else if (mode === 'every-n') {
    if (!Number.isInteger(everyN) || everyN < 1 || everyN > 500) throw new Error('Pages per output must be between 1 and 500.');
    for (let start = 0; start < srcDoc.getPageCount(); start += everyN) {
      ranges.push(Array.from({ length: Math.min(everyN, srcDoc.getPageCount() - start) }, (_, offset) => start + offset));
    }
  } else {
    ranges = String(rangeStr || '').split(',').map(group => parsePdfPageSelection(group.trim(), srcDoc.getPageCount()));
  }
  
  for (let idx = 0; idx < ranges.length; idx++) {
    const singleDoc = await PDFLib.PDFDocument.create();
    const copiedPages = await singleDoc.copyPages(srcDoc, ranges[idx]);
    copiedPages.forEach(p => singleDoc.addPage(p));
    const bytes = await singleDoc.save();
    zip.file(`split_part_${idx + 1}.pdf`, bytes);
  }
  
  return await zip.generateAsync({ type: 'blob' });
}

// --- ALGORITHM: PDF PROTECT PASSWORD ---
async function runPDFProtect(password) {
  return runQpdfOperation('protect', appState.activeFiles[0], password);
}

// --- ALGORITHM: PDF UNLOCK PASSWORD ---
async function runPDFUnlock(password) {
  if (!password) throw new Error('Enter the PDF password before unlocking.');
  return runQpdfOperation('unlock', appState.activeFiles[0], password);
}

async function runQpdfOperation(operation, file, password) {
  const maximumQpdfBytes = 25 * 1024 * 1024;
  if (!file || file.size > maximumQpdfBytes) throw new Error('Protect and Unlock PDF support files up to 25 MB in this browser to prevent WebAssembly memory exhaustion.');
  const worker = new Worker('/assets/qpdf-worker.js');
  const id = `${Date.now()}-${Math.random().toString(36).slice(2)}`;
  const bytes = await file.arrayBuffer();
  return new Promise((resolve, reject) => {
    const timeout = window.setTimeout(() => {
      worker.terminate();
      reject(new Error('The local PDF security engine timed out. Try a smaller file.'));
    }, 90_000);
    worker.addEventListener('message', event => {
      if (event.data?.id !== id) return;
      window.clearTimeout(timeout);
      worker.terminate();
      if (event.data.error) reject(new Error(event.data.error));
      else resolve(new Blob([event.data.output], { type: 'application/pdf' }));
    });
    worker.addEventListener('error', () => {
      window.clearTimeout(timeout);
      worker.terminate();
      reject(new Error('The local qpdf WebAssembly engine could not initialize.'));
    }, { once: true });
    worker.postMessage({ id, operation, bytes, password }, [bytes]);
  });
}

// --- ALGORITHM: PDF TO IMAGE EXPORTER ---
async function runPDFToJPG(format) {
  if (!window.GxaWorkspace) throw new Error('The PDF rendering workspace is unavailable.');
  return window.GxaWorkspace.pdfToImagesZip(appState.activeFiles[0], format === 'jpg' ? 'jpg' : 'png');
}

// --- ALGORITHM: IMAGES CONVERSION TO PDF ---
async function loadDecodedImageSource(file) {
  if ('createImageBitmap' in window) {
    try {
      const bitmap = await createImageBitmap(file);
      return { source: bitmap, width: bitmap.width, height: bitmap.height, close: () => bitmap.close() };
    } catch (_) {
      // Some mobile/browser decoders reject otherwise valid images through createImageBitmap.
    }
  }
  const url = URL.createObjectURL(file);
  try {
    const image = await new Promise((resolve, reject) => {
      const element = new Image();
      element.onload = () => resolve(element);
      element.onerror = () => reject(new Error(`The source image ${file.name} could not be decoded.`));
      element.src = url;
    });
    return { source: image, width: image.naturalWidth, height: image.naturalHeight, close: () => URL.revokeObjectURL(url) };
  } catch (error) {
    URL.revokeObjectURL(url);
    throw error;
  }
}

async function runJPGToPDF(pageSize, orientation) {
  const pdfDoc = await PDFLib.PDFDocument.create();
  
  for (const file of appState.activeFiles) {
    const lowerName = file.name.toLowerCase();
    const isPng = file.type === 'image/png' || lowerName.endsWith('.png');
    const isJpeg = file.type === 'image/jpeg' || /\.jpe?g$/.test(lowerName);
    let img;
    if (isPng) img = await pdfDoc.embedPng(await file.arrayBuffer());
    else if (isJpeg) img = await pdfDoc.embedJpg(await file.arrayBuffer());
    else {
      const decoded = await loadDecodedImageSource(file);
      if (decoded.width * decoded.height > 20_000_000) {
        decoded.close();
        throw new Error(`${file.name} exceeds the safe 20-megapixel image-to-PDF limit.`);
      }
      const canvas = document.createElement('canvas');
      canvas.width = decoded.width;
      canvas.height = decoded.height;
      const context = canvas.getContext('2d');
      context.drawImage(decoded.source, 0, 0);
      decoded.close();
      const normalized = await new Promise((resolve, reject) => canvas.toBlob(value => value ? resolve(value) : reject(new Error(`${file.name} could not be normalized for PDF embedding.`)), 'image/png'));
      const normalizedBytes = await normalized.arrayBuffer();
      canvas.width = 0;
      canvas.height = 0;
      img = await pdfDoc.embedPng(normalizedBytes);
    }
    
    // Page sizes mapping
    let pageW = 595.28; // A4 default
    let pageH = 841.89;
    if (pageSize === 'letter') {
      pageW = 612;
      pageH = 792;
    }
    
    if (orientation === 'landscape') {
      const temp = pageW;
      pageW = pageH;
      pageH = temp;
    }
    
    const page = pdfDoc.addPage([pageW, pageH]);
    
    // Fit image inside margins
    const margin = 20;
    const maxW = pageW - (margin * 2);
    const maxH = pageH - (margin * 2);
    
    const scale = Math.min(maxW / img.width, maxH / img.height);
    const drawW = img.width * scale;
    const drawH = img.height * scale;
    
    page.drawImage(img, {
      x: (pageW - drawW) / 2,
      y: (pageH - drawH) / 2,
      width: drawW,
      height: drawH
    });
  }
  
  const bytes = await pdfDoc.save();
  return new Blob([bytes], { type: 'application/pdf' });
}

// --- ALGORITHM: WORD/TEXT TO PDF ---
async function runWordToPDF(fontName) {
  const file = appState.activeFiles[0];
  if (file.size > 25 * 1024 * 1024) throw new Error('Word to PDF supports DOCX or text files up to 25 MB in this browser.');
  let text;
  if (file.name.toLowerCase().endsWith('.docx')) {
    await window.GxaWorkspace.loadScriptOnce('/assets/vendor/mammoth/mammoth.browser.min.js', 'mammoth');
    const result = await window.mammoth.extractRawText({ arrayBuffer: await file.arrayBuffer() });
    text = result.value;
    if (!text.trim()) throw new Error('No readable paragraph text was found in this DOCX file.');
  } else {
    text = await file.text();
  }
  if (text.length > 5_000_000) throw new Error('The extracted document text exceeds the 5-million-character browser limit.');
  return createTextPdf(text, { fontName, title: file.name.replace(/\.[^.]+$/, '') });
}

async function createTextPdf(text, options = {}) {
  const pdfDoc = await PDFLib.PDFDocument.create();
  const fontKey = String(options.fontName || 'Helvetica').replace('-', '');
  const standardFont = PDFLib.StandardFonts[fontKey] || PDFLib.StandardFonts.Helvetica;
  const font = await pdfDoc.embedFont(standardFont);
  const pageSize = [595.28, 841.89];
  const margin = 48;
  const fontSize = 11;
  const lineHeight = 16;
  const maxWidth = pageSize[0] - margin * 2;
  const normalizeForStandardFont = (value, replaceUnsupported = false) => {
    const punctuation = new Map([
      ['\u2018', "'"], ['\u2019', "'"], ['\u201c', '"'], ['\u201d', '"'],
      ['\u2013', '-'], ['\u2014', '--'], ['\u2026', '...'], ['\u2022', '*'],
      ['\u00a0', ' '], ['\u2212', '-']
    ]);
    const normalized = Array.from(String(value || '').normalize('NFKD'))
      .filter(character => !/\p{M}/u.test(character))
      .map(character => punctuation.get(character) || (character === '\t' ? ' ' : character));
    const output = [];
    const unsupported = new Set();
    normalized.forEach(character => {
      if (character === '\n' || character === '\r') { output.push(character); return; }
      try {
        font.encodeText(character);
        output.push(character);
      } catch (_) {
        unsupported.add(character);
        if (replaceUnsupported) output.push('?');
      }
    });
    if (unsupported.size && !replaceUnsupported) {
      throw new Error(`This browser PDF font cannot encode ${unsupported.size} character${unsupported.size === 1 ? '' : 's'} in the source text. Use a Latin-script document or export the text directly.`);
    }
    return output.join('');
  };
  const paragraphs = normalizeForStandardFont(text).replace(/\r\n?/g, '\n').split('\n');
  const lines = [];
  paragraphs.forEach(paragraph => {
    if (!paragraph.trim()) { lines.push(''); return; }
    let line = '';
    paragraph.split(/\s+/).forEach(word => {
      const next = line ? `${line} ${word}` : word;
      if (font.widthOfTextAtSize(next, fontSize) <= maxWidth) line = next;
      else {
        if (line) lines.push(line);
        line = word;
      }
    });
    if (line) lines.push(line);
  });
  let page;
  let y;
  const newPage = () => {
    page = pdfDoc.addPage(pageSize);
    y = pageSize[1] - margin;
    if (options.title) {
      page.drawText(normalizeForStandardFont(String(options.title).slice(0, 100), true), { x: margin, y, size: 15, font, color: PDFLib.rgb(0.08, 0.18, 0.35) });
      y -= 26;
    }
  };
  newPage();
  lines.forEach(line => {
    if (y < margin) newPage();
    if (line) page.drawText(line, { x: margin, y, size: fontSize, font, color: PDFLib.rgb(0.1, 0.1, 0.1) });
    y -= lineHeight;
  });
  return new Blob([await pdfDoc.save()], { type: 'application/pdf' });
}

// --- ALGORITHM: PDF TO WORD/TEXT ---
async function runPDFToWord(format) {
  const file = appState.activeFiles[0];
  const pages = await window.GxaWorkspace.extractPdfText(file);
  const plainText = pages.map((text, index) => `Page ${index + 1}\n${text}`).join('\n\n');
  if (format === 'rtf') {
    const rtfText = plainText.replace(/\\/g, '\\\\').replace(/([{}])/g, '\\$1').replace(/\n/g, '\\par\n');
    return new Blob([`{\\rtf1\\ansi\\deff0 ${rtfText}}`], { type: 'application/rtf' });
  }
  return new Blob([plainText], { type: 'text/plain;charset=utf-8' });
}

// --- ALGORITHM: EPUB TO PDF ---
async function runEPUBToPDF() {
  const file = appState.activeFiles[0];
  if (file.size > 30 * 1024 * 1024) throw new Error('EPUB to PDF supports files up to 30 MB in this browser.');
  const archive = await JSZip.loadAsync(await file.arrayBuffer(), { checkCRC32: true });
  const archiveEntries = Object.values(archive.files);
  if (archiveEntries.length > 5000) throw new Error('This EPUB contains too many archive entries for safe browser processing.');
  const readLimitedText = async (entry, label, maximumBytes) => {
    const declaredSize = Number(entry?._data?.uncompressedSize || 0);
    if (declaredSize > maximumBytes) throw new Error(`${label} exceeds the safe browser expansion limit.`);
    const value = await entry.async('text');
    if (new Blob([value]).size > maximumBytes) throw new Error(`${label} exceeds the safe browser expansion limit.`);
    return value;
  };
  const resolveArchivePath = (base, href) => {
    let clean = String(href || '').split(/[?#]/, 1)[0].replace(/\\/g, '/');
    try { clean = decodeURIComponent(clean); } catch (_) { throw new Error('The EPUB contains an invalid encoded chapter path.'); }
    if (!clean || clean.startsWith('/')) return '';
    const parts = [];
    `${base}${clean}`.split('/').forEach(part => {
      if (!part || part === '.') return;
      if (part === '..') parts.pop();
      else parts.push(part);
    });
    return parts.join('/');
  };
  const containerFile = archive.file('META-INF/container.xml');
  if (!containerFile) throw new Error('The EPUB is missing META-INF/container.xml.');
  const containerXml = new DOMParser().parseFromString(await readLimitedText(containerFile, 'EPUB container metadata', 512 * 1024), 'application/xml');
  if (containerXml.querySelector('parsererror')) throw new Error('The EPUB container metadata is malformed.');
  const packagePath = containerXml.getElementsByTagNameNS('*', 'rootfile')[0]?.getAttribute('full-path');
  const packageFile = packagePath ? archive.file(packagePath) : null;
  if (!packageFile) throw new Error('The EPUB package document could not be found.');
  const packageXml = new DOMParser().parseFromString(await readLimitedText(packageFile, 'EPUB package metadata', 2 * 1024 * 1024), 'application/xml');
  if (packageXml.querySelector('parsererror')) throw new Error('The EPUB package metadata is malformed.');
  const packageDirectory = packagePath.includes('/') ? packagePath.slice(0, packagePath.lastIndexOf('/') + 1) : '';
  const manifest = new Map(Array.from(packageXml.getElementsByTagNameNS('*', 'item')).map(item => [item.getAttribute('id'), item.getAttribute('href')]));
  const chapters = [];
  const spineItems = Array.from(packageXml.getElementsByTagNameNS('*', 'itemref'));
  if (spineItems.length > 500) throw new Error('This EPUB contains more than 500 spine items and exceeds the browser conversion limit.');
  let expandedChapterBytes = 0;
  for (const item of spineItems) {
    const href = manifest.get(item.getAttribute('idref'));
    const chapterPath = href ? resolveArchivePath(packageDirectory, href) : '';
    const chapter = chapterPath ? archive.file(chapterPath) : null;
    if (!chapter) continue;
    const declaredSize = Number(chapter._data?.uncompressedSize || 0);
    if (declaredSize > 5 * 1024 * 1024) throw new Error(`EPUB chapter ${chapterPath} exceeds the 5 MB expansion limit.`);
    expandedChapterBytes += declaredSize;
    if (expandedChapterBytes > 30 * 1024 * 1024) throw new Error('The expanded EPUB chapters exceed the safe 30 MB browser limit.');
    const html = await readLimitedText(chapter, `EPUB chapter ${chapterPath}`, 5 * 1024 * 1024);
    const documentNode = new DOMParser().parseFromString(html, 'text/html');
    documentNode.querySelectorAll('script,style,noscript').forEach(node => node.remove());
    documentNode.body?.querySelectorAll('br').forEach(node => node.replaceWith('\n'));
    documentNode.body?.querySelectorAll('p,div,section,article,h1,h2,h3,h4,h5,h6,li,blockquote,pre,tr').forEach(node => node.append('\n'));
    const text = documentNode.body?.textContent?.replace(/[\t ]+/g, ' ').replace(/\n\s*\n+/g, '\n\n').trim();
    if (text) chapters.push(text);
  }
  if (!chapters.length) throw new Error('No readable reflowable chapter text was found in this EPUB.');
  const combinedText = chapters.join('\n\n');
  if (combinedText.length > 5_000_000) throw new Error('The extracted EPUB text exceeds the 5-million-character browser limit.');
  return createTextPdf(combinedText, { title: file.name.replace(/\.epub$/i, '') });
}

// --- ALGORITHM: PDF TO EPUB ---
async function runPDFToEPUB(title, author) {
  const file = appState.activeFiles[0];
  const pages = await window.GxaWorkspace.extractPdfText(file);
  if (!pages.some(page => page.trim())) throw new Error('This PDF has no selectable text to reflow. Use OCR PDF first for scanned pages.');
  const zip = new JSZip();
  zip.file('mimetype', 'application/epub+zip', { compression: 'STORE' });
  zip.file('META-INF/container.xml', '<?xml version="1.0"?><container version="1.0" xmlns="urn:oasis:names:tc:opendocument:xmlns:container"><rootfiles><rootfile full-path="EPUB/package.opf" media-type="application/oebps-package+xml"/></rootfiles></container>');
  const identifier = `urn:uuid:${crypto.randomUUID ? crypto.randomUUID() : Date.now()}`;
  const manifest = [];
  const spine = [];
  const navigation = [];
  pages.forEach((pageText, index) => {
    const number = index + 1;
    const filename = `chapter-${String(number).padStart(3, '0')}.xhtml`;
    const paragraphs = String(pageText || '').split(/\n+/).map(value => value.trim()).filter(Boolean);
    zip.file(`EPUB/${filename}`, `<?xml version="1.0" encoding="utf-8"?><html xmlns="http://www.w3.org/1999/xhtml"><head><title>Page ${number}</title><meta charset="utf-8"/></head><body><h1>Page ${number}</h1>${paragraphs.map(value => `<p>${escapeHTML(value)}</p>`).join('')}</body></html>`);
    manifest.push(`<item id="chapter-${number}" href="${filename}" media-type="application/xhtml+xml"/>`);
    spine.push(`<itemref idref="chapter-${number}"/>`);
    navigation.push(`<li><a href="${filename}">Page ${number}</a></li>`);
  });
  zip.file('EPUB/nav.xhtml', `<?xml version="1.0" encoding="utf-8"?><html xmlns="http://www.w3.org/1999/xhtml" xmlns:epub="http://www.idpf.org/2007/ops"><head><title>Contents</title></head><body><nav epub:type="toc"><h1>Contents</h1><ol>${navigation.join('')}</ol></nav></body></html>`);
  zip.file('EPUB/package.opf', `<?xml version="1.0" encoding="utf-8"?><package xmlns="http://www.idpf.org/2007/opf" version="3.0" unique-identifier="book-id"><metadata xmlns:dc="http://purl.org/dc/elements/1.1/"><dc:identifier id="book-id">${escapeHTML(identifier)}</dc:identifier><dc:title>${escapeHTML(title)}</dc:title><dc:creator>${escapeHTML(author)}</dc:creator><dc:language>en</dc:language><meta property="dcterms:modified">${new Date().toISOString().replace(/\.\d{3}Z$/, 'Z')}</meta></metadata><manifest><item id="nav" href="nav.xhtml" media-type="application/xhtml+xml" properties="nav"/>${manifest.join('')}</manifest><spine>${spine.join('')}</spine></package>`);
  return zip.generateAsync({ type: 'blob', mimeType: 'application/epub+zip', compression: 'DEFLATE', compressionOptions: { level: 6 } });
}

// --- ALGORITHM: GIF ANIMATED SLIDESHOW MAKER ---
async function runGIFMaker(speed) {
  const files = appState.activeFiles;
  if (files.length < 2) throw new Error('Choose at least two images to create an animation.');
  if (files.length > 80) throw new Error('GIF Maker supports up to 80 frames per run.');
  const first = await loadDecodedImageSource(files[0]);
  const maximumDimension = Math.min(1024, Math.max(first.width, first.height));
  const scale = Math.min(1, maximumDimension / Math.max(first.width, first.height));
  const width = Math.max(1, Math.round(first.width * scale));
  const height = Math.max(1, Math.round(first.height * scale));
  first.close();
  if (width * height * files.length > 24_000_000) throw new Error('These frames exceed the safe 24-megapixel browser GIF budget. Reduce frame count or dimensions.');
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const context = canvas.getContext('2d', { willReadFrequently: true });
  const worker = new Worker('/assets/gif-encoder-worker.js', { type: 'module' });
  const pending = new Map();
  let requestNumber = 0;
  worker.addEventListener('message', event => {
    const request = pending.get(event.data?.id);
    if (!request) return;
    pending.delete(event.data.id);
    if (event.data.error) request.reject(new Error(event.data.error));
    else request.resolve(event.data);
  });
  worker.addEventListener('error', () => {
    pending.forEach(request => request.reject(new Error('The local GIF encoder worker could not initialize.')));
    pending.clear();
  });
  const request = (type, payload = {}, transfer = []) => new Promise((resolve, reject) => {
    const id = `gif-${Date.now()}-${requestNumber += 1}`;
    pending.set(id, { resolve, reject });
    worker.postMessage({ id, type, ...payload }, transfer);
  });
  try {
    await request('initialize', { width, height, delay: Number(speed) || 500 });
    for (let index = 0; index < files.length; index += 1) {
      if (premiumEditorState.batchCancelled) throw new Error(`GIF creation cancelled after ${index} frame${index === 1 ? '' : 's'}.`);
      const bitmap = await loadDecodedImageSource(files[index]);
      context.clearRect(0, 0, width, height);
      context.drawImage(bitmap.source, 0, 0, width, height);
      bitmap.close();
      const rgba = context.getImageData(0, 0, width, height).data;
      await request('frame', { rgba: rgba.buffer }, [rgba.buffer]);
      const progress = document.getElementById('global-progress-bar');
      if (progress) progress.style.width = `${25 + Math.round(((index + 1) / files.length) * 55)}%`;
    }
    const result = await request('finish');
    return new Blob([result.output], { type: 'image/gif' });
  } finally {
    pending.forEach(item => item.reject(new Error('GIF encoding stopped.')));
    pending.clear();
    worker.terminate();
    canvas.width = 0;
    canvas.height = 0;
  }
}

// --- ALGORITHM: ZIP ARCHIVE EXTRACTOR ---
async function runZIPExtractor() {
  const file = appState.activeFiles[0];
  const buffer = await file.arrayBuffer();
  const zip = await JSZip.loadAsync(buffer);
  
  zipExtractorFiles = [];
  const results = [];
  
  for (let [name, zipFile] of Object.entries(zip.files)) {
    if (zipFile.dir) continue;
    const blob = await zipFile.async('blob');
    zipExtractorFiles.push({ name, blob });
    results.push({ name, size: blob.size });
  }
  
  return results;
}

// --- Dynamic File Downloader ---
function saveBlob(blob, filename) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  window.setTimeout(() => URL.revokeObjectURL(url), 60_000);
}

// --- Option helpers ---
function setOptPdfCompression(lvl, btn) {
  appState.activeToolOptions.compression = lvl;
  const btns = btn.parentElement.querySelectorAll('.preset-btn');
  btns.forEach(b => b.classList.remove('active'));
  btn.classList.add('active');
}
function clampWatermarkNumber(value, minimum, maximum, fallback) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? Math.min(maximum, Math.max(minimum, parsed)) : fallback;
}

function resetWatermarkEditorState() {
  if (watermarkEditorState.imageUrl) URL.revokeObjectURL(watermarkEditorState.imageUrl);
  watermarkEditorState.previewObserver?.disconnect();
  if (watermarkEditorState.previewPageHandler) window.removeEventListener('gxa:pdf-preview-page', watermarkEditorState.previewPageHandler);
  if (watermarkEditorState.previewFrame) window.cancelAnimationFrame(watermarkEditorState.previewFrame);
  Object.assign(watermarkEditorState, {
    imageFile: null,
    imageUrl: '',
    imageAspectRatio: 1,
    imageBaseWidth: 160,
    previewObserver: null,
    previewPageHandler: null,
    previewFrame: 0
  });
}

function watermarkPositionLabel(position) {
  return ({
    'top-left': 'Top left', 'top-center': 'Top center', 'top-right': 'Top right',
    'middle-left': 'Middle left', center: 'Center', 'middle-right': 'Middle right',
    'bottom-left': 'Bottom left', 'bottom-center': 'Bottom center', 'bottom-right': 'Bottom right',
    manual: 'Manual offsets'
  })[position] || 'Center';
}

function scheduleWatermarkLivePreview() {
  if (watermarkEditorState.previewFrame) window.cancelAnimationFrame(watermarkEditorState.previewFrame);
  watermarkEditorState.previewFrame = window.requestAnimationFrame(() => {
    watermarkEditorState.previewFrame = 0;
    renderWatermarkLivePreview();
  });
}

function sanitizeWatermarkSvg(source) {
  const svg = String(source || '').trim();
  if (!/^<svg\b/i.test(svg) || !/<\/svg>\s*$/i.test(svg)) throw new Error('The SVG is not a complete SVG document.');
  if (/<\s*\/?(?:script|foreignobject|iframe|object|embed|audio|video)\b/i.test(svg)
    || /\bon[a-z]+\s*=/i.test(svg)
    || /javascript\s*:/i.test(svg)
    || /\b(?:href|xlink:href)\s*=\s*["']\s*(?!#|data:image\/(?:png|jpeg|webp);base64,)/i.test(svg)
    || /url\s*\(/i.test(svg)) {
    throw new Error('This SVG contains active or external content and cannot be used as a watermark.');
  }
  return svg.replace(/<!--([\s\S]*?)-->/g, '');
}

function getWatermarkImageType(file) {
  const extension = (file?.name?.split('.').pop() || '').toLowerCase();
  const type = String(file?.type || '').toLowerCase();
  if (type === 'image/png' || extension === 'png') return 'png';
  if (type === 'image/jpeg' || extension === 'jpg' || extension === 'jpeg') return 'jpg';
  if (type === 'image/webp' || extension === 'webp') return 'webp';
  if (type === 'image/svg+xml' || extension === 'svg') return 'svg';
  return '';
}

function getWatermarkImageDimensions(url) {
  return new Promise((resolve, reject) => {
    const image = new Image();
    image.onload = () => resolve({ width: image.naturalWidth, height: image.naturalHeight });
    image.onerror = () => reject(new Error('The selected image could not be decoded.'));
    image.src = url;
  });
}

function updateWatermarkImageStatus(message, isError = false) {
  const status = document.getElementById('watermark-image-status');
  if (!status) return;
  status.textContent = message;
  status.classList.toggle('is-error', isError);
}

async function loadWatermarkImage(file) {
  const type = getWatermarkImageType(file);
  if (!type) throw new Error('Choose a PNG, JPG, WebP, or SVG image.');
  if (file.size > 10 * 1024 * 1024) throw new Error('Watermark images must be 10 MB or smaller.');
  let source = file;
  if (type === 'svg') {
    const sanitized = sanitizeWatermarkSvg(await file.text());
    source = new Blob([sanitized], { type: 'image/svg+xml' });
  }
  const url = URL.createObjectURL(source);
  try {
    const dimensions = await getWatermarkImageDimensions(url);
    if (!dimensions.width || !dimensions.height) throw new Error('The selected image has no usable dimensions.');
    if (watermarkEditorState.imageUrl) URL.revokeObjectURL(watermarkEditorState.imageUrl);
    watermarkEditorState.imageFile = source;
    watermarkEditorState.imageUrl = url;
    watermarkEditorState.imageAspectRatio = dimensions.width / dimensions.height;
    watermarkEditorState.imageBaseWidth = Math.round(Math.min(220, Math.max(48, dimensions.width > 220 ? 180 : dimensions.width)));
    const width = document.getElementById('opt-wm-image-width');
    const height = document.getElementById('opt-wm-image-height');
    const scale = document.getElementById('opt-wm-image-scale');
    if (width) width.value = String(watermarkEditorState.imageBaseWidth);
    if (height) height.value = String(Math.max(12, Math.round(watermarkEditorState.imageBaseWidth / watermarkEditorState.imageAspectRatio)));
    if (scale) scale.value = '100';
    updateWatermarkImageStatus(`${file.name || 'Image'} · ${dimensions.width} × ${dimensions.height}px · ready for the live preview.`);
  } catch (error) {
    URL.revokeObjectURL(url);
    throw error;
  }
}

function updateWatermarkImageDimensions(changedId) {
  const width = document.getElementById('opt-wm-image-width');
  const height = document.getElementById('opt-wm-image-height');
  const lock = document.getElementById('opt-wm-image-lock');
  const scale = document.getElementById('opt-wm-image-scale');
  const output = document.getElementById('opt-wm-image-scale-output');
  if (!width || !height) return;
  const aspect = watermarkEditorState.imageAspectRatio || 1;
  if (changedId === 'opt-wm-image-scale' && scale) {
    const value = clampWatermarkNumber(scale.value, 10, 200, 100);
    width.value = String(Math.round(watermarkEditorState.imageBaseWidth * value / 100));
    height.value = String(Math.max(12, Math.round(Number(width.value) / aspect)));
  } else if (lock?.checked && changedId === 'opt-wm-image-width') {
    height.value = String(Math.max(12, Math.round(clampWatermarkNumber(width.value, 12, 1000, 160) / aspect)));
  } else if (lock?.checked && changedId === 'opt-wm-image-height') {
    width.value = String(Math.max(12, Math.round(clampWatermarkNumber(height.value, 12, 1000, 160) * aspect)));
  }
  if (scale && changedId !== 'opt-wm-image-scale') {
    scale.value = String(Math.round(clampWatermarkNumber(width.value, 12, 1000, 160) / watermarkEditorState.imageBaseWidth * 100));
  }
  if (output && scale) output.textContent = `${scale.value}%`;
}

function getWatermarkSettings() {
  const root = document.querySelector('.watermark-studio');
  const type = root?.dataset.watermarkType || 'text';
  const text = document.getElementById('opt-wm-text')?.value.trim().slice(0, 160) || '';
  const fontSize = clampWatermarkNumber(document.getElementById('opt-wm-font-size')?.value, 8, 160, 40);
  const imageWidth = clampWatermarkNumber(document.getElementById('opt-wm-image-width')?.value, 12, 1000, 160);
  const imageHeight = clampWatermarkNumber(document.getElementById('opt-wm-image-height')?.value, 12, 1000, 160);
  return {
    type,
    text,
    font: document.getElementById('opt-wm-font')?.value || 'helvetica',
    fontSize,
    bold: Boolean(document.getElementById('opt-wm-bold')?.checked),
    color: document.getElementById('opt-wm-color')?.value || '#334155',
    opacity: clampWatermarkNumber(document.getElementById('opt-wm-opacity')?.value, 5, 100, 30) / 100,
    rotation: clampWatermarkNumber(document.getElementById('opt-wm-rotation')?.value, -180, 180, 45),
    letterSpacing: clampWatermarkNumber(document.getElementById('opt-wm-letter-spacing')?.value, 0, 12, 0),
    symbol: document.getElementById('opt-wm-symbol')?.value || 'copyright',
    imageWidth,
    imageHeight,
    imageFile: watermarkEditorState.imageFile,
    imageUrl: watermarkEditorState.imageUrl,
    position: root?.dataset.watermarkPosition || 'center',
    offsetX: clampWatermarkNumber(document.getElementById('opt-wm-offset-x')?.value, 0, 100, 50),
    offsetY: clampWatermarkNumber(document.getElementById('opt-wm-offset-y')?.value, 0, 100, 50),
    tile: Boolean(document.getElementById('opt-wm-tile')?.checked),
    tileSpacing: clampWatermarkNumber(document.getElementById('opt-wm-tile-spacing')?.value, 24, 240, 72)
  };
}

function getWatermarkPageSelection() {
  const mode = document.getElementById('opt-wm-pages')?.value || 'all';
  if (mode === 'current') {
    const page = Number(document.querySelector('.pdf-canvas-wrap')?.dataset.currentPdfPage || 1);
    return `current:${Number.isFinite(page) && page > 0 ? page : 1}`;
  }
  if (mode === 'custom') {
    const selection = document.getElementById('studio-pdf-page-selection')?.value.trim() || '';
    if (!selection) throw new Error('Enter at least one page number or range for the custom selection.');
    return selection;
  }
  return mode;
}

function getWatermarkPreviewPosition(settings) {
  if (settings.position === 'manual') return { left: `${settings.offsetX}%`, top: `${settings.offsetY}%`, translate: 'translate(-50%, -50%)' };
  return ({
    'top-left': { left: '7%', top: '8%', translate: 'translate(0, 0)' },
    'top-center': { left: '50%', top: '8%', translate: 'translate(-50%, 0)' },
    'top-right': { left: '93%', top: '8%', translate: 'translate(-100%, 0)' },
    'middle-left': { left: '7%', top: '50%', translate: 'translate(0, -50%)' },
    center: { left: '50%', top: '50%', translate: 'translate(-50%, -50%)' },
    'middle-right': { left: '93%', top: '50%', translate: 'translate(-100%, -50%)' },
    'bottom-left': { left: '7%', top: '92%', translate: 'translate(0, -100%)' },
    'bottom-center': { left: '50%', top: '92%', translate: 'translate(-50%, -100%)' },
    'bottom-right': { left: '93%', top: '92%', translate: 'translate(-100%, -100%)' }
  })[settings.position] || { left: '50%', top: '50%', translate: 'translate(-50%, -50%)' };
}

function getWatermarkSymbolText(symbol) {
  return ({ check: '✓', cross: '×', star: '★', copyright: '©', registered: '®', trademark: '™', warning: '⚠', lock: 'LOCK', approved: 'APPROVED', confidential: 'CONFIDENTIAL' })[symbol] || '©';
}

function createWatermarkSymbolSvg(symbol, color = '#334155') {
  const safeColor = /^#[0-9a-f]{6}$/i.test(color) ? color : '#334155';
  const label = getWatermarkSymbolText(symbol);
  const textSize = ['approved', 'confidential'].includes(symbol) ? 56 : label.length > 2 ? 64 : 120;
  const rect = ['approved', 'confidential'].includes(symbol)
    ? `<rect x="8" y="28" width="304" height="104" rx="12" fill="none" stroke="${safeColor}" stroke-width="10"/>`
    : '';
  return `<svg xmlns="http://www.w3.org/2000/svg" width="320" height="160" viewBox="0 0 320 160">${rect}<text x="160" y="108" text-anchor="middle" fill="${safeColor}" font-family="Arial, sans-serif" font-size="${textSize}" font-weight="700">${label}</text></svg>`;
}

function createWatermarkPreviewMark(settings) {
  let mark;
  if (settings.type === 'image') {
    mark = document.createElement('img');
    mark.src = settings.imageUrl;
    mark.alt = 'Image watermark preview';
    mark.style.width = `${Math.min(72, Math.max(12, settings.imageWidth / 6.12))}%`;
    mark.style.height = 'auto';
  } else if (settings.type === 'symbol') {
    mark = document.createElement('img');
    mark.src = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(createWatermarkSymbolSvg(settings.symbol, settings.color))}`;
    mark.alt = `${getWatermarkSymbolText(settings.symbol)} watermark preview`;
    mark.style.width = `${Math.min(64, Math.max(13, settings.imageWidth / 6.12))}%`;
    mark.style.height = 'auto';
  } else {
    mark = document.createElement('span');
    mark.textContent = settings.text || 'CONFIDENTIAL';
    mark.style.fontFamily = ({ helvetica: 'Arial, sans-serif', times: 'Georgia, serif', courier: 'Courier New, monospace' })[settings.font] || 'Arial, sans-serif';
    mark.style.fontSize = `${Math.min(42, Math.max(12, settings.fontSize * 0.65))}px`;
    mark.style.fontWeight = settings.bold ? '700' : '500';
    mark.style.letterSpacing = `${settings.letterSpacing * 0.65}px`;
    mark.style.color = settings.color;
    mark.style.whiteSpace = 'pre-wrap';
    mark.style.textAlign = 'center';
  }
  mark.className = 'pdf-watermark-preview-mark';
  mark.style.opacity = String(settings.opacity);
  mark.style.transformOrigin = 'center';
  return mark;
}

function renderWatermarkLivePreview() {
  if (appState.currentPage !== 'tool-watermark-pdf') return;
  const canvasWrap = document.querySelector('#file-preview-workspace .pdf-canvas-wrap');
  const canvas = canvasWrap?.querySelector('canvas');
  if (!canvasWrap || !canvas || !canvas.clientWidth || !canvas.clientHeight) return;
  const settings = getWatermarkSettings();
  let overlay = canvasWrap.querySelector('.pdf-watermark-preview');
  if (!overlay) {
    overlay = document.createElement('div');
    overlay.className = 'pdf-watermark-preview';
    overlay.setAttribute('aria-label', 'Live watermark preview overlay');
    canvasWrap.appendChild(overlay);
  }
  overlay.replaceChildren();
  Object.assign(overlay.style, {
    left: `${canvas.offsetLeft}px`, top: `${canvas.offsetTop}px`, width: `${canvas.clientWidth}px`, height: `${canvas.clientHeight}px`
  });
  if (settings.type === 'image' && !settings.imageUrl) {
    overlay.dataset.empty = 'true';
    return;
  }
  overlay.dataset.empty = 'false';
  const positions = settings.tile
    ? [[16, 18], [50, 18], [84, 18], [16, 50], [50, 50], [84, 50], [16, 82], [50, 82], [84, 82]]
    : [[null, null]];
  positions.forEach(([tileX, tileY]) => {
    const mark = createWatermarkPreviewMark(settings);
    const position = settings.tile
      ? { left: `${tileX}%`, top: `${tileY}%`, translate: 'translate(-50%, -50%)' }
      : getWatermarkPreviewPosition(settings);
    mark.style.left = position.left;
    mark.style.top = position.top;
    mark.style.transform = `${position.translate} rotate(${-settings.rotation}deg)`;
    overlay.appendChild(mark);
  });
}

function updateWatermarkInterface(changedId = '') {
  const root = document.querySelector('.watermark-studio');
  if (!root) return;
  const pairs = [
    ['opt-wm-opacity', 'opt-wm-opacity-output', '%'], ['opt-wm-rotation', 'opt-wm-rotation-output', '°'],
    ['opt-wm-letter-spacing', 'opt-wm-letter-spacing-output', ' pt'], ['opt-wm-offset-x', 'opt-wm-offset-x-output', '%'],
    ['opt-wm-offset-y', 'opt-wm-offset-y-output', '%'], ['opt-wm-tile-spacing', 'opt-wm-tile-spacing-output', ' pt']
  ];
  pairs.forEach(([inputId, outputId, suffix]) => {
    const input = document.getElementById(inputId);
    const output = document.getElementById(outputId);
    if (input && output) output.textContent = `${input.value}${suffix}`;
  });
  if (changedId.startsWith('opt-wm-image')) updateWatermarkImageDimensions(changedId);
  document.getElementById('opt-wm-tile-spacing-wrap')?.classList.toggle('hidden', !document.getElementById('opt-wm-tile')?.checked);
  appState.activeToolOptions.opacity = clampWatermarkNumber(document.getElementById('opt-wm-opacity')?.value, 5, 100, 30) / 100;
  scheduleWatermarkLivePreview();
}

function initializeWatermarkStudio() {
  resetWatermarkEditorState();
  const root = document.querySelector('.watermark-studio');
  if (!root) return;
  root.dataset.watermarkType = 'text';
  root.dataset.watermarkPosition = 'center';
  const typeButtons = root.querySelectorAll('[data-wm-type]');
  const setType = (type) => {
    root.dataset.watermarkType = type;
    typeButtons.forEach(button => {
      const active = button.dataset.wmType === type;
      button.classList.toggle('active', active);
      button.setAttribute('aria-pressed', String(active));
    });
    root.querySelectorAll('[data-wm-panel]').forEach(panel => panel.classList.toggle('hidden', panel.dataset.wmPanel !== type));
    scheduleWatermarkLivePreview();
  };
  typeButtons.forEach(button => button.addEventListener('click', () => setType(button.dataset.wmType)));
  root.querySelectorAll('[data-wm-text]').forEach(button => button.addEventListener('click', () => {
    const input = document.getElementById('opt-wm-text');
    if (input) input.value = button.dataset.wmText;
    updateWatermarkInterface();
  }));
  root.querySelectorAll('[data-wm-position]').forEach(button => button.addEventListener('click', () => {
    const position = button.dataset.wmPosition;
    root.dataset.watermarkPosition = position;
    root.querySelectorAll('[data-wm-position]').forEach(item => item.classList.toggle('active', item === button));
    const label = document.getElementById('watermark-position-label');
    if (label) label.textContent = watermarkPositionLabel(position);
    scheduleWatermarkLivePreview();
  }));
  ['opt-wm-offset-x', 'opt-wm-offset-y'].forEach(id => document.getElementById(id)?.addEventListener('input', () => {
    root.dataset.watermarkPosition = 'manual';
    root.querySelectorAll('[data-wm-position]').forEach(item => item.classList.remove('active'));
    const label = document.getElementById('watermark-position-label');
    if (label) label.textContent = watermarkPositionLabel('manual');
    updateWatermarkInterface(id);
  }));
  const pages = document.getElementById('opt-wm-pages');
  const customPages = document.getElementById('studio-pdf-page-selection');
  const customWrap = document.getElementById('opt-wm-custom-pages-wrap');
  pages?.addEventListener('change', () => {
    customWrap?.classList.toggle('hidden', pages.value !== 'custom');
    scheduleWatermarkLivePreview();
  });
  ['input', 'change'].forEach(eventName => customPages?.addEventListener(eventName, () => {
    if (customPages.value.trim()) {
      pages.value = 'custom';
      customWrap?.classList.remove('hidden');
    }
  }));
  root.addEventListener('input', event => updateWatermarkInterface(event.target.id || ''));
  root.addEventListener('change', async event => {
    const target = event.target;
    if (target.id === 'opt-wm-image' && target.files?.[0]) {
      try {
        await loadWatermarkImage(target.files[0]);
        updateWatermarkInterface('opt-wm-image');
      } catch (error) {
        target.value = '';
        watermarkEditorState.imageFile = null;
        updateWatermarkImageStatus(error.message || 'The image could not be used.', true);
        scheduleWatermarkLivePreview();
        showToast(error.message || 'The image could not be used.', 'error');
      }
      return;
    }
    updateWatermarkInterface(target.id || '');
  });
  watermarkEditorState.previewPageHandler = () => scheduleWatermarkLivePreview();
  window.addEventListener('gxa:pdf-preview-page', watermarkEditorState.previewPageHandler);
  watermarkEditorState.previewObserver = new MutationObserver(records => {
    if (records.some(record => !record.target.closest?.('.pdf-watermark-preview'))) scheduleWatermarkLivePreview();
  });
  watermarkEditorState.previewObserver.observe(document.body, { childList: true, subtree: true });
  updateWatermarkInterface();
}
function setBase64Mode(mode, btn) {
  appState.activeToolOptions.mode = mode;
  const btns = btn.parentElement.querySelectorAll('.preset-btn');
  btns.forEach(b => b.classList.remove('active'));
  btn.classList.add('active');
  generateBase64TextLive();
}
function setUrlMode(mode, btn) {
  appState.activeToolOptions.mode = mode;
  const btns = btn.parentElement.querySelectorAll('.preset-btn');
  btns.forEach(b => b.classList.remove('active'));
  btn.classList.add('active');
  generateUrlConvert();
}
function setJsonMode(mode, btn) {
  appState.activeToolOptions.mode = mode;
  const btns = btn.parentElement.querySelectorAll('.preset-btn');
  btns.forEach(b => b.classList.remove('active'));
  btn.classList.add('active');
  generateJsonModeLive();
}

function generateBase64TextLive() {
  const val = document.getElementById('opt-b64-raw').value;
  const mode = appState.activeToolOptions.mode || 'encode';
  const preview = document.getElementById('generator-preview-mount');
  if (!preview) return;
  let out = '';
  if (mode === 'encode') {
    out = window.btoa(val);
  } else {
    try {
      out = window.atob(val);
    } catch(e) {
      out = 'Invalid Base64 string.';
    }
  }
  preview.innerHTML = `
    <div style="width:100%; text-align:left;">
      <h5 style="font-weight:700; margin-bottom:8px;">Base64 Live Preview</h5>
      <textarea class="form-input-text" style="height:120px; font-family:var(--font-mono); font-size:11px;" readonly>${out}</textarea>
    </div>
  `;
}

function generateJsonModeLive() {
  const val = document.getElementById('opt-json-raw').value;
  const mode = appState.activeToolOptions.mode || 'beautify';
  const preview = document.getElementById('generator-preview-mount');
  if (!preview) return;
  let out = '';
  let parsed = null;
  let errorMessage = '';
  try {
    parsed = JSON.parse(val);
    out = mode === 'beautify' ? JSON.stringify(parsed, null, 2) : JSON.stringify(parsed);
  } catch(e) {
    errorMessage = 'Invalid JSON structure: ' + e.message;
    out = errorMessage;
  }
  preview.innerHTML = `
    <div class="json-editor-result">
      <div class="json-result-header">
        <h5>JSON Output</h5>
        <span class="json-validation-badge ${errorMessage ? 'invalid' : 'valid'}">${errorMessage ? 'Invalid' : 'Valid JSON'}</span>
      </div>
      <div class="json-result-grid">
        <pre id="generated-json-code" aria-label="Formatted JSON code"></pre>
        <div id="generated-json-tree" class="json-tree-view" aria-label="JSON tree view"></div>
      </div>
      <textarea id="generated-json-display" class="sr-only" readonly></textarea>
    </div>
  `;
  document.getElementById('generated-json-display').value = out;
  const code = document.getElementById('generated-json-code');
  if (errorMessage) {
    code.textContent = errorMessage;
    document.getElementById('generated-json-tree').textContent = 'Correct the JSON syntax to inspect its tree.';
  } else {
    code.innerHTML = syntaxHighlightJson(out);
    document.getElementById('generated-json-tree').appendChild(createJsonTreeNode(parsed, 'root', 0));
  }
}

function syntaxHighlightJson(json) {
  const escaped = escapeHTML(json);
  return escaped.replace(/(&quot;(?:\\u[a-fA-F0-9]{4}|\\[^u]|[^\\&])*&quot;\\s*:)|(&quot;(?:\\u[a-fA-F0-9]{4}|\\[^u]|[^\\&])*&quot;)|\\b(true|false|null)\\b|-?\\d+(?:\\.\\d+)?(?:[eE][+\\-]?\\d+)?/g, match => {
    let className = 'json-number';
    if (/^&quot;/.test(match)) className = /:$/.test(match) ? 'json-key' : 'json-string';
    else if (/true|false/.test(match)) className = 'json-boolean';
    else if (/null/.test(match)) className = 'json-null';
    return '<span class="' + className + '">' + match + '</span>';
  });
}

function createJsonTreeNode(value, label, depth) {
  const isCollection = value !== null && typeof value === 'object';
  if (!isCollection) {
    const row = document.createElement('div');
    row.className = 'json-tree-leaf';
    const key = document.createElement('strong');
    key.textContent = label + ':';
    const result = document.createElement('span');
    result.textContent = typeof value === 'string' ? '"' + value + '"' : String(value);
    row.append(key, result);
    return row;
  }
  const details = document.createElement('details');
  details.className = 'json-tree-branch';
  details.open = depth < 2;
  const summary = document.createElement('summary');
  const length = Array.isArray(value) ? value.length : Object.keys(value).length;
  summary.textContent = label + (Array.isArray(value) ? ' [' + length + ']' : ' {' + length + '}');
  details.appendChild(summary);
  const children = document.createElement('div');
  Object.entries(value).forEach(entry => children.appendChild(createJsonTreeNode(entry[1], entry[0], depth + 1)));
  details.appendChild(children);
  return details;
}

// --- ALGORITHM: COMPRESS PDF ---
async function runPDFCompress(file, compression) {
  const arrayBuffer = await file.arrayBuffer();
  const doc = await PDFLib.PDFDocument.load(arrayBuffer);
  // pdf-lib re-save stream compress optimization
  const pdfBytes = await doc.save({ useObjectStreams: true });
  const blob = new Blob([pdfBytes], { type: 'application/pdf' });
  if (blob.size >= file.size) throw new Error('This PDF is already optimized; reserializing it did not reduce the file size.');
  return blob;
}

// --- ALGORITHM: ROTATE PDF ---
function getStudioPdfPageSelection() {
  return document.getElementById('studio-pdf-page-selection')?.value?.trim() || '';
}

function resolveOptionalPdfPageSelection(selection, pageCount) {
  const value = String(selection || '').trim().toLowerCase();
  if (!value || value === 'all') return Array.from({ length: pageCount }, (_, index) => index);
  if (value === 'first') return pageCount ? [0] : [];
  if (value === 'last') return pageCount ? [pageCount - 1] : [];
  if (value === 'odd') return Array.from({ length: pageCount }, (_, index) => index).filter(index => index % 2 === 0);
  if (value === 'even') return Array.from({ length: pageCount }, (_, index) => index).filter(index => index % 2 === 1);
  const currentPage = value.match(/^current:(\d+)$/);
  if (currentPage) {
    const index = Number(currentPage[1]) - 1;
    if (index < 0 || index >= pageCount) throw new Error(`The selected preview page is outside 1-${pageCount}.`);
    return [index];
  }
  return parsePdfPageSelection(value, pageCount);
}

async function runPDFRotate(file, angle, pageSelection = '') {
  const arrayBuffer = await file.arrayBuffer();
  const doc = await PDFLib.PDFDocument.load(arrayBuffer);
  const pages = doc.getPages();
  const selected = new Set(resolveOptionalPdfPageSelection(pageSelection, pages.length));
  pages.forEach((page, index) => {
    if (!selected.has(index)) return;
    const currentRotation = page.getRotation().angle;
    page.setRotation(PDFLib.degrees((currentRotation + angle) % 360));
  });
  const pdfBytes = await doc.save();
  return new Blob([pdfBytes], { type: 'application/pdf' });
}

// --- ALGORITHM: WATERMARK PDF ---
function watermarkPdfColor(hex) {
  const normalized = /^#[0-9a-f]{6}$/i.test(hex) ? hex.slice(1) : '334155';
  return PDFLib.rgb(
    parseInt(normalized.slice(0, 2), 16) / 255,
    parseInt(normalized.slice(2, 4), 16) / 255,
    parseInt(normalized.slice(4, 6), 16) / 255
  );
}

function watermarkPdfFontName(font, bold) {
  const fonts = PDFLib.StandardFonts;
  if (font === 'times') return bold ? fonts.TimesRomanBold : fonts.TimesRoman;
  if (font === 'courier') return bold ? fonts.CourierBold : fonts.Courier;
  return bold ? fonts.HelveticaBold : fonts.Helvetica;
}

function watermarkPdfPlacement(page, markWidth, markHeight, settings) {
  const width = page.getWidth();
  const height = page.getHeight();
  const margin = Math.min(32, Math.max(16, Math.min(width, height) * 0.05));
  const middleX = Math.max(margin, (width - markWidth) / 2);
  const middleY = Math.max(margin, (height - markHeight) / 2);
  const right = Math.max(margin, width - markWidth - margin);
  const top = Math.max(margin, height - markHeight - margin);
  if (settings.position === 'manual') {
    return {
      x: Math.max(0, Math.min(Math.max(0, width - markWidth), (width - markWidth) * settings.offsetX / 100)),
      y: Math.max(0, Math.min(Math.max(0, height - markHeight), (height - markHeight) * (100 - settings.offsetY) / 100))
    };
  }
  return ({
    'top-left': { x: margin, y: top }, 'top-center': { x: middleX, y: top }, 'top-right': { x: right, y: top },
    'middle-left': { x: margin, y: middleY }, center: { x: middleX, y: middleY }, 'middle-right': { x: right, y: middleY },
    'bottom-left': { x: margin, y: margin }, 'bottom-center': { x: middleX, y: margin }, 'bottom-right': { x: right, y: margin }
  })[settings.position] || { x: middleX, y: middleY };
}

async function rasterizeWatermarkImage(source) {
  const url = URL.createObjectURL(source);
  try {
    const image = await new Promise((resolve, reject) => {
      const element = new Image();
      element.onload = () => resolve(element);
      element.onerror = () => reject(new Error('The watermark image could not be rendered for PDF output.'));
      element.src = url;
    });
    const longestSide = Math.max(image.naturalWidth, image.naturalHeight);
    const scale = longestSide > 2048 ? 2048 / longestSide : 1;
    const canvas = document.createElement('canvas');
    canvas.width = Math.max(1, Math.round(image.naturalWidth * scale));
    canvas.height = Math.max(1, Math.round(image.naturalHeight * scale));
    const context = canvas.getContext('2d', { alpha: true });
    if (!context) throw new Error('Canvas support is required to prepare this watermark image.');
    context.drawImage(image, 0, 0, canvas.width, canvas.height);
    const blob = await new Promise((resolve, reject) => canvas.toBlob(result => result ? resolve(result) : reject(new Error('The watermark image could not be encoded.')), 'image/png'));
    return new Uint8Array(await blob.arrayBuffer());
  } finally {
    URL.revokeObjectURL(url);
  }
}

async function createPdfWatermarkDrawable(doc, settings) {
  if (settings.type === 'text') {
    if (!settings.text) throw new Error('Enter watermark text before applying it.');
    const font = await doc.embedFont(watermarkPdfFontName(settings.font, settings.bold));
    const characterSpacing = settings.letterSpacing;
    const width = font.widthOfTextAtSize(settings.text, settings.fontSize) + Math.max(0, settings.text.length - 1) * characterSpacing;
    return {
      width,
      height: settings.fontSize,
      draw(page, x, y) {
        page.drawText(settings.text, {
          x, y, size: settings.fontSize, font, opacity: settings.opacity,
          rotate: PDFLib.degrees(settings.rotation), color: watermarkPdfColor(settings.color), characterSpacing
        });
      }
    };
  }

  let source = settings.imageFile;
  let imageType = source ? getWatermarkImageType(source) : '';
  if (settings.type === 'image' && !source) throw new Error('Choose an image or logo before applying the watermark.');
  if (settings.type === 'symbol') {
    source = new Blob([createWatermarkSymbolSvg(settings.symbol, settings.color)], { type: 'image/svg+xml' });
    imageType = 'svg';
  }
  let image;
  if (imageType === 'png') image = await doc.embedPng(new Uint8Array(await source.arrayBuffer()));
  else if (imageType === 'jpg') image = await doc.embedJpg(new Uint8Array(await source.arrayBuffer()));
  else image = await doc.embedPng(await rasterizeWatermarkImage(source));
  return {
    width: settings.imageWidth,
    height: settings.imageHeight,
    draw(page, x, y) {
      page.drawImage(image, {
        x, y, width: settings.imageWidth, height: settings.imageHeight,
        opacity: settings.opacity, rotate: PDFLib.degrees(settings.rotation)
      });
    }
  };
}

function drawTiledPdfWatermark(page, drawable, settings) {
  const stepX = Math.max(drawable.width + settings.tileSpacing, 24);
  const stepY = Math.max(drawable.height + settings.tileSpacing, 24);
  for (let y = 18; y < page.getHeight(); y += stepY) {
    for (let x = 18; x < page.getWidth(); x += stepX) drawable.draw(page, x, y);
  }
}

async function runPDFWatermark(file, settings, pageSelection = '') {
  if (!window.PDFLib) throw new Error('The local PDF processing library is unavailable. Please reload and try again.');
  const arrayBuffer = await file.arrayBuffer();
  const doc = await PDFLib.PDFDocument.load(arrayBuffer);
  const pages = doc.getPages();
  const selected = new Set(resolveOptionalPdfPageSelection(pageSelection, pages.length));
  if (!selected.size) throw new Error('Select at least one page for the watermark.');
  const drawable = await createPdfWatermarkDrawable(doc, settings);
  pages.forEach((page, index) => {
    if (!selected.has(index)) return;
    if (settings.tile) {
      drawTiledPdfWatermark(page, drawable, settings);
      return;
    }
    const placement = watermarkPdfPlacement(page, drawable.width, drawable.height, settings);
    drawable.draw(page, placement.x, placement.y);
  });
  const pdfBytes = await doc.save();
  return new Blob([pdfBytes], { type: 'application/pdf' });
}

// --- ALGORITHM: ADD PAGE NUMBERS ---
async function runPDFPageNumbers(file, position, pageSelection = '', options = {}) {
  const arrayBuffer = await file.arrayBuffer();
  const doc = await PDFLib.PDFDocument.load(arrayBuffer);
  const pages = doc.getPages();
  const selected = new Set(resolveOptionalPdfPageSelection(pageSelection, pages.length));
  pages.forEach((page, i) => {
    if (!selected.has(i)) return;
    if (options.skipFirst && i === 0) return;
    const number = Number.isFinite(options.start) ? options.start + i : i + 1;
    const text = `${options.prefix ?? 'Page '}${number}${options.suffix ?? ''}`;
    let x = page.getWidth() / 2 - 20;
    let y = 30;
    if (position === 'bottom-right') {
      x = page.getWidth() - 100;
    } else if (position === 'top-center') {
      y = page.getHeight() - 40;
    }
    page.drawText(text, {
      x: x,
      y: y,
      size: Math.max(6, Math.min(72, Number(options.size) || 10)),
      color: PDFLib.rgb(0.3, 0.3, 0.3)
    });
  });
  const pdfBytes = await doc.save();
  return new Blob([pdfBytes], { type: 'application/pdf' });
}

// --- ALGORITHM: EDIT PDF METADATA ---
async function runPDFMetadataEdit(file, title, author, subject = '', keywords = '') {
  const arrayBuffer = await file.arrayBuffer();
  const doc = await PDFLib.PDFDocument.load(arrayBuffer);
  if (title) doc.setTitle(title);
  if (author) doc.setAuthor(author);
  if (subject) doc.setSubject(subject);
  if (keywords.trim()) doc.setKeywords(keywords.split(',').map(keyword => keyword.trim()).filter(Boolean));
  doc.setModificationDate(new Date());
  const pdfBytes = await doc.save();
  return new Blob([pdfBytes], { type: 'application/pdf' });
}

// --- ALGORITHM: EXCEL TO PDF ---
async function runExcelToPDF(file, fontName) {
  if (file.size > 15 * 1024 * 1024) throw new Error('Excel to PDF supports workbook or CSV files up to 15 MB in this browser.');
  await window.GxaWorkspace.loadScriptOnce('/assets/vendor/sheetjs/xlsx.full.min.js', 'XLSX');
  const workbook = window.XLSX.read(await file.arrayBuffer(), { type: 'array', cellDates: true });
  if (!workbook.SheetNames.length) throw new Error('The workbook contains no worksheets.');
  if (workbook.SheetNames.length > 40) throw new Error('This workbook contains more than 40 worksheets and exceeds the browser conversion limit.');
  const sections = [];
  let totalCells = 0;
  workbook.SheetNames.forEach(sheetName => {
    const sheet = workbook.Sheets[sheetName];
    const decodedRange = window.XLSX.utils.decode_range(sheet['!ref'] || 'A1:A1');
    const rowCount = decodedRange.e.r - decodedRange.s.r + 1;
    const columnCount = decodedRange.e.c - decodedRange.s.c + 1;
    if (rowCount > 5000 || columnCount > 200) throw new Error(`${sheetName} exceeds the safe 5,000-row or 200-column browser limit.`);
    totalCells += rowCount * columnCount;
    if (totalCells > 300_000) throw new Error('The workbook exceeds the safe 300,000-cell browser conversion limit.');
    const rows = window.XLSX.utils.sheet_to_json(sheet, { header: 1, defval: '', raw: false, range: decodedRange });
    sections.push(`[Worksheet: ${sheetName}]`);
    rows.forEach(row => sections.push(row.map(value => String(value)).join('    ')));
    sections.push('');
  });
  return createTextPdf(sections.join('\n'), { fontName, title: file.name.replace(/\.[^.]+$/, '') });
}

// --- ALGORITHM: PPT TO PDF ---
async function runPPTToPDF(file, theme) {
  throw new Error(window.GxaWorkspace.getBlocker('ppt-to-pdf'));
}

// --- ALGORITHM: PDF TO TEXT ---
async function runPDFToText(file) {
  const pages = await window.GxaWorkspace.extractPdfText(file);
  const text = pages.map((pageText, index) => `--- Page ${index + 1} ---\n${pageText}`).join('\n\n');
  return new Blob([text], { type: 'text/plain;charset=utf-8' });
}

// --- ALGORITHM: HTML TO PDF ---
async function runHtmlToPDF(file, rawCode) {
  const code = file ? await file.text() : rawCode;
  const pdfDoc = await PDFLib.PDFDocument.create();
  const page = pdfDoc.addPage([595.28, 841.89]);
  page.drawText("HTML Template Compiled", { x: 50, y: 800, size: 18 });
  const cleanText = code.replace(/<[^>]*>/g, '\n').split('\n').filter(l => l.trim() !== '');
  let y = 750;
  cleanText.forEach(line => {
    if (y < 50) return;
    page.drawText(line.substring(0, 80), { x: 50, y: y, size: 11 });
    y -= 20;
  });
  const pdfBytes = await pdfDoc.save();
  return new Blob([pdfBytes], { type: 'application/pdf' });
}

// --- ALGORITHM: PDF TO HTML ---
async function runPDFToHtml(file) {
  const pages = await window.GxaWorkspace.extractPdfText(file);
  const escapeHtml = (value) => String(value).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  const sections = pages.map((text, index) => `<section><h2>Page ${index + 1}</h2><p>${escapeHtml(text)}</p></section>`).join('\n');
  const html = `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width"><title>${escapeHtml(file.name)}</title></head><body><h1>${escapeHtml(file.name)}</h1>${sections}</body></html>`;
  return new Blob([html], { type: 'text/html;charset=utf-8' });
}

// --- ALGORITHM: MARKDOWN TO PDF ---
async function runMarkdownToPDF(file, rawMd) {
  const md = file ? await file.text() : rawMd;
  const pdfDoc = await PDFLib.PDFDocument.create();
  const page = pdfDoc.addPage([595.28, 841.89]);
  page.drawText("Markdown Document Export", { x: 50, y: 800, size: 18 });
  let y = 740;
  const lines = md.split('\n');
  lines.forEach(line => {
    if (y < 40) return;
    if (line.startsWith('#')) {
      const depth = Math.min(line.match(/^#+/)[0].length, 3);
      const clean = line.replace(/^#+\s*/, '');
      page.drawText(clean, { x: 50, y: y, size: 20 - depth * 2 });
      y -= 28;
    } else {
      page.drawText(line.substring(0, 80), { x: 50, y: y, size: 11 });
      y -= 18;
    }
  });
  const pdfBytes = await pdfDoc.save();
  return new Blob([pdfBytes], { type: 'application/pdf' });
}

// --- ALGORITHM: PDF TO MARKDOWN ---
async function runPDFToMarkdown(file) {
  const pages = await window.GxaWorkspace.extractPdfText(file);
  const md = `# ${file.name.replace(/\.pdf$/i, '')}\n\n${pages.map((text, index) => `## Page ${index + 1}\n\n${text}`).join('\n\n')}`;
  return new Blob([md], { type: 'text/markdown;charset=utf-8' });
}

// --- ALGORITHM: SVG TO PNG ---
function runSvgToPng(file, targetWidth) {
  return new Promise((resolve) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      const img = new Image();
      img.onload = () => {
        const canvas = document.createElement('canvas');
        const ratio = img.height / img.width;
        canvas.width = targetWidth;
        canvas.height = targetWidth * ratio;
        const ctx = canvas.getContext('2d');
        ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
        canvas.toBlob((blob) => resolve(blob), 'image/png');
      };
      img.src = e.target.result;
    };
    reader.readAsDataURL(file);
  });
}

// --- ALGORITHM: PNG TO SVG ---
function runPngToSvg(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = event => {
      const image = new Image();
      image.onload = () => {
        const width = Math.max(1, image.naturalWidth);
        const height = Math.max(1, image.naturalHeight);
        const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}"><image href="${event.target.result}" width="${width}" height="${height}" /></svg>`;
        resolve(new Blob([svg], { type: 'image/svg+xml' }));
      };
      image.onerror = () => reject(new Error('The selected raster image is corrupted or unsupported by this browser.'));
      image.src = event.target.result;
    };
    reader.onerror = () => reject(new Error('The selected image could not be read.'));
    reader.readAsDataURL(file);
  });
}

// --- ALGORITHM: WEBP TO JPG ---
function runWebpToJpg(file, format) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      const img = new Image();
      img.onload = () => {
        const mime = `image/${format === 'jpg' ? 'jpeg' : 'png'}`;
        const canvas = renderImageStudioCanvas(img, img.width, img.height, mime === 'image/jpeg' ? '#ffffff' : 'transparent');
        canvas.toBlob((blob) => blob ? resolve(blob) : reject(new Error('The browser could not encode the converted image.')), mime, 0.92);
      };
      img.onerror = () => reject(new Error('The selected image is corrupted or unsupported by this browser.'));
      img.src = e.target.result;
    };
    reader.onerror = () => reject(new Error('The selected image could not be read.'));
    reader.readAsDataURL(file);
  });
}

// --- ALGORITHM: GIF TO PNG ---
async function runGifToPng(file) {
  if (!window.GxaGifDecoder) await window.GxaWorkspace.loadScriptOnce('/assets/gif-decoder.js', 'GxaGifDecoder');
  const decoded = window.GxaGifDecoder.decode(await file.arrayBuffer(), {
    maximumDimension: 4096,
    maximumFramePixels: 12_000_000,
    maximumTotalPixels: 24_000_000,
    maximumFrames: 120
  });
  const zip = new JSZip();
  const canvas = document.createElement('canvas');
  canvas.width = decoded.width;
  canvas.height = decoded.height;
  const context = canvas.getContext('2d');
  try {
    for (let index = 0; index < decoded.frames.length; index += 1) {
      if (premiumEditorState.batchCancelled) throw new Error(`GIF frame export cancelled after ${index} frame${index === 1 ? '' : 's'}.`);
      const frame = decoded.frames[index];
      context.putImageData(new ImageData(frame.rgba, decoded.width, decoded.height), 0, 0);
      const blob = await new Promise((resolve, reject) => canvas.toBlob(value => value ? resolve(value) : reject(new Error('PNG frame export failed.')), 'image/png'));
      zip.file(`frame-${String(index + 1).padStart(3, '0')}.png`, blob);
      const progress = document.getElementById('global-progress-bar');
      if (progress) progress.style.width = `${25 + Math.round(((index + 1) / decoded.frames.length) * 55)}%`;
    }
    zip.file('frames.json', JSON.stringify({ source: file.name, width: decoded.width, height: decoded.height, frames: decoded.frames.map((frame, index) => ({ frame: index + 1, delayMs: frame.delay })) }, null, 2));
    return await zip.generateAsync({ type: 'blob', compression: 'DEFLATE' });
  } finally {
    canvas.width = 0;
    canvas.height = 0;
  }
}

// --- ALGORITHM: TEXT TO SPEECH ---
let speechUtterance = null;
function runTextToSpeech(file, rawText, rate) {
  return new Promise(async (resolve, reject) => {
    const text = file ? await file.text() : rawText;
    if (!text || !text.trim()) return reject(new Error('Enter text to read aloud.'));
    if (!('speechSynthesis' in window)) return reject(new Error('Speech synthesis is not supported by this browser.'));
    speechUtterance = new SpeechSynthesisUtterance(text);
    speechUtterance.rate = rate;
    resolve();
  });
}
function speakBrowserSynthesis() {
  if (speechUtterance) {
    window.speechSynthesis.cancel();
    window.speechSynthesis.speak(speechUtterance);
    showToast('Reading aloud...', 'info');
  }
}
function stopBrowserSynthesis() {
  window.speechSynthesis.cancel();
  showToast('Speech stopped.', 'info');
}

// --- ALGORITHM: QR READER ---
async function runQrReader(file) {
  const result = await window.GxaWorkspace.detectBarcode(file, ['qr_code']);
  return result.rawValue;
}

// --- ALGORITHM: BARCODE READER ---
async function runBarcodeReader(file) {
  const result = await window.GxaWorkspace.detectBarcode(file, ['code_128', 'code_39', 'ean_13', 'ean_8', 'upc_a', 'upc_e', 'itf', 'codabar']);
  return `${result.format}: ${result.rawValue}`;
}

// --- ALGORITHM: BASE64 TOOL ---
async function runBase64Tool(file, textRaw, mode) {
  if (file) {
    const buffer = await file.arrayBuffer();
    let binary = '';
    const bytes = new Uint8Array(buffer);
    const len = bytes.byteLength;
    for (let i = 0; i < len; i++) {
      binary += String.fromCharCode(bytes[i]);
    }
    return window.btoa(binary);
  } else {
    if (mode === 'encode') {
      const bytes = new TextEncoder().encode(textRaw);
      let binary = '';
      bytes.forEach((byte) => { binary += String.fromCharCode(byte); });
      return window.btoa(binary);
    } else {
      try {
        const binary = window.atob(textRaw.replace(/\s+/g, ''));
        return new TextDecoder().decode(Uint8Array.from(binary, char => char.charCodeAt(0)));
      } catch(e) {
        throw new Error('Invalid Base64 string.');
      }
    }
  }
}

// --- ALGORITHM: HASH TOOL ---
async function runHashTool(file, rawText, algorithm) {
  let data;
  if (file) {
    data = await file.arrayBuffer();
  } else {
    data = new TextEncoder().encode(rawText);
  }
  const hashBuffer = await crypto.subtle.digest(algorithm, data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
}

// --- ALGORITHM: WORD COUNTER ---
async function runWordCounter(file, rawText) {
  const text = file ? await file.text() : rawText;
  const chars = text.length;
  const words = text.trim() === '' ? 0 : text.trim().split(/\s+/).length;
  const sentences = text.trim() === '' ? 0 : text.split(/[.!?]+/).length - 1;
  const time = Math.ceil(words / 200);
  return { chars, words, sentences, time };
}

// --- ALGORITHM: EXIF VIEWER ---
async function runExifViewer(file) {
  if (!window.GxaWorkspace) throw new Error('The metadata reader is unavailable.');
  const metadata = await window.GxaWorkspace.readExif(file);
  const dimensions = await new Promise((resolve) => {
    const img = new Image();
    const url = URL.createObjectURL(file);
    img.onload = () => { URL.revokeObjectURL(url); resolve({ width: img.naturalWidth, height: img.naturalHeight }); };
    img.onerror = () => { URL.revokeObjectURL(url); resolve({}); };
    img.src = url;
  });
  const usefulMetadata = {};
  Object.entries(metadata).forEach(([key, value]) => {
    if (value !== undefined && value !== null && typeof value !== 'object') usefulMetadata[key] = String(value);
  });
  return {
    'File Name': file.name,
    'File Size': window.GxaWorkspace.formatBytes(file.size),
    'File Type': file.type || 'Unknown',
    ...(dimensions.width ? { 'Image Dimensions': `${dimensions.width} × ${dimensions.height} px` } : {}),
    ...usefulMetadata
  };
}

// --- GENERATORS IMPLEMENTATIONS ---
function generateLoremIpsum() {
  const count = parseInt(document.getElementById('opt-lorem-count').value) || 3;
  const phrases = [
    "Lorem ipsum dolor sit amet, consectetur adipiscing elit.",
    "Mauris vel nisl sed leo pretium porttitor sed in leo.",
    "Pellentesque hendrerit magna vel sodales volutpat.",
    "Proin dictum nisl eu ligula feugiat, a dictum ex aliquet.",
    "Duis varius ipsum eu nunc mollis finibus.",
    "Sed hendrerit nisi vitae felis viverra elementum.",
    "Nullam pellentesque odio a mi posuere cursus."
  ];
  let result = [];
  for (let i = 0; i < count; i++) {
    let paragraph = [];
    const sentCount = 4 + Math.floor(Math.random() * 4);
    for (let j = 0; j < sentCount; j++) {
      paragraph.push(phrases[Math.floor(Math.random() * phrases.length)]);
    }
    result.push(paragraph.join(' '));
  }
  const output = result.join('\n\n');
  const preview = document.getElementById('generator-preview-mount');
  if (preview) {
    preview.innerHTML = `
      <div style="width:100%; text-align:left;">
        <h5 style="font-weight:700; margin-bottom:8px;">Lorem Ipsum Output</h5>
        <textarea id="generated-lorem-display" readonly class="form-input-text" style="height:160px; font-size:13px; line-height:1.6;" onclick="this.select()">${output}</textarea>
      </div>
    `;
  }
}
function downloadLoremText() {
  const txt = document.getElementById('generated-lorem-display').value;
  const blob = new Blob([txt], { type: 'text/plain' });
  saveBlob(blob, 'lorem_ipsum_generator.txt');
  logHistory('lorem_ipsum_generator.txt', 'Lorem Ipsum', '0.0 KB');
}

function generateUUIDs() {
  const count = parseInt(document.getElementById('opt-uuid-count').value) || 5;
  const uuids = [];
  for (let i = 0; i < count; i++) {
    uuids.push(crypto.randomUUID ? crypto.randomUUID() : 'f81d4fae-7dec-11d0-a765-00a0c91e6bf6');
  }
  const output = uuids.join('\n');
  const preview = document.getElementById('generator-preview-mount');
  if (preview) {
    preview.innerHTML = `
      <div style="width:100%; text-align:left;">
        <h5 style="font-weight:700; margin-bottom:8px;">Generated UUID Strings</h5>
        <textarea id="generated-uuid-display" readonly class="form-input-text" style="height:150px; font-family:var(--font-mono); font-size:12px;" onclick="this.select()">${output}</textarea>
      </div>
    `;
  }
}
function downloadUUIDsText() {
  const txt = document.getElementById('generated-uuid-display').value;
  const blob = new Blob([txt], { type: 'text/plain' });
  saveBlob(blob, 'uuid_keys.txt');
  logHistory('uuid_keys.txt', 'UUID Generator', '0.0 KB');
}

function generateDiffCheck() {
  const orig = document.getElementById('opt-diff-orig').value;
  const mod = document.getElementById('opt-diff-mod').value;
  const preview = document.getElementById('generator-preview-mount');
  if (!preview) return;
  if (!orig && !mod) {
    preview.innerHTML = `<p style="color:var(--color-text-secondary); font-size:13px;">Write text in the original and modified fields to compare.</p>`;
    return;
  }
  const origLines = orig.split('\n');
  const modLines = mod.split('\n');
  const max = Math.max(origLines.length, modLines.length);
  preview.innerHTML = `
    <div class="diff-editor-result">
      <div class="json-result-header"><h5>Side-by-side comparison</h5><span id="diff-summary" class="json-validation-badge"></span></div>
      <div class="diff-side-by-side">
        <section><strong>Original</strong><div id="diff-original-lines" class="diff-lines"></div></section>
        <section><strong>Modified</strong><div id="diff-modified-lines" class="diff-lines"></div></section>
      </div>
    </div>
  `;
  const originalMount = document.getElementById('diff-original-lines');
  const modifiedMount = document.getElementById('diff-modified-lines');
  let changed = 0;
  for (let i = 0; i < max; i++) {
    const originalLine = origLines[i] ?? '';
    const modifiedLine = modLines[i] ?? '';
    const isChanged = originalLine !== modifiedLine;
    if (isChanged) changed += 1;
    const left = document.createElement('div');
    const right = document.createElement('div');
    left.className = isChanged ? 'is-removed' : '';
    right.className = isChanged ? 'is-added' : '';
    left.textContent = String(i + 1).padStart(2, '0') + '  ' + originalLine;
    right.textContent = String(i + 1).padStart(2, '0') + '  ' + modifiedLine;
    originalMount.appendChild(left);
    modifiedMount.appendChild(right);
  }
  document.getElementById('diff-summary').textContent = changed + ' changed line' + (changed === 1 ? '' : 's');
}

function generateUserAgent() {
  const ua = navigator.userAgent;
  const platform = navigator.platform;
  const vendor = navigator.vendor;
  const preview = document.getElementById('generator-preview-mount');
  if (preview) {
    preview.innerHTML = `
      <div style="width:100%; text-align:left; font-size:13px;">
        <h5 style="font-weight:700; margin-bottom:8px;">Client Information</h5>
        <div style="padding:10px; border:1px solid var(--color-border); border-radius:var(--radius-md); background:var(--color-bg); line-height:1.6;">
          <p><strong>User Agent:</strong> <span style="font-family:var(--font-mono); font-size:11px;">${ua}</span></p>
          <p style="margin-top:6px;"><strong>Operating Platform:</strong> ${platform}</p>
          <p style="margin-top:6px;"><strong>Browser Vendor:</strong> ${vendor}</p>
        </div>
      </div>
    `;
  }
}

function generateCronExplanation() {
  const exp = (document.getElementById('opt-cron-exp').value || '*/5 * * * *').trim();
  const preview = document.getElementById('generator-preview-mount');
  if (!preview) return;
  
  const fields = exp.split(/\s+/);
  let desc = "";
  if (fields.length !== 5) {
    desc = "Invalid cron expression. Expected 5 fields (minute hour day-of-month month day-of-week).";
  } else {
    const [min, hour, dom, month, dow] = fields;
    let minDesc = min === '*' ? 'every minute' : min.startsWith('*/') ? `every ${min.split('/')[1]} minutes` : `at minute ${min}`;
    let hourDesc = hour === '*' ? 'every hour' : hour.startsWith('*/') ? `every ${hour.split('/')[1]} hours` : `at hour ${hour}`;
    let domDesc = dom === '*' ? 'every day of the month' : `on day of month ${dom}`;
    let monthDesc = month === '*' ? 'every month' : `in month ${month}`;
    let dowDesc = dow === '*' ? 'every day of the week' : `on weekday ${dow}`;
    
    desc = `Run ${minDesc}, ${hourDesc}, ${domDesc}, ${monthDesc}, ${dowDesc}.`;
    
    if (exp === '*/5 * * * *') desc = "At every 5th minute.";
    if (exp === '0 0 * * *') desc = "At 00:00 (Midnight) every day.";
    if (exp === '0 * * * *') desc = "At the start of every hour.";
    if (exp === '0 9 * * 1-5') desc = "At 09:00 AM, Monday through Friday.";
  }
  
  preview.innerHTML = `
    <div style="width:100%; text-align:left;">
      <h5 style="font-weight:700; margin-bottom:8px;">Cron Schedule Description</h5>
      <div style="padding:12px; border:1px solid var(--color-border); border-radius:var(--radius-md); background:var(--color-bg); font-weight:bold; font-size:14px; color:var(--color-primary); line-height:1.5;">
        "${desc}"
      </div>
    </div>
  `;
}

function generateRegexTest() {
  const exp = document.getElementById('opt-regex-exp').value;
  const flags = document.getElementById('opt-regex-flags').value;
  const subject = document.getElementById('opt-regex-subject').value;
  const preview = document.getElementById('generator-preview-mount');
  if (!preview) return;
  try {
    const normalizedFlags = flags.includes('g') ? flags : flags + 'g';
    const regex = new RegExp(exp, normalizedFlags);
    const matches = [];
    let match;
    let count = 0;
    while ((match = regex.exec(subject)) !== null && count < 100) {
      matches.push({ value: match[0], index: match.index, groups: Array.from(match).slice(1) });
      count++;
      if (match[0] === '') regex.lastIndex += 1;
    }
    preview.innerHTML = `
      <div class="regex-editor-result">
        <div class="json-result-header"><h5>Matches Found (${matches.length})</h5><span class="json-validation-badge valid">Pattern valid</span></div>
        <div id="regex-highlighted-subject" class="regex-highlighted-subject" aria-label="Subject with regular expression matches highlighted"></div>
        <div id="regex-match-groups" class="regex-match-groups"></div>
      </div>
    `;
    const highlighted = document.getElementById('regex-highlighted-subject');
    let cursor = 0;
    matches.forEach((result, index) => {
      highlighted.appendChild(document.createTextNode(subject.slice(cursor, result.index)));
      const mark = document.createElement('mark');
      mark.textContent = result.value || '∅';
      mark.title = 'Match ' + (index + 1) + ' at index ' + result.index;
      highlighted.appendChild(mark);
      cursor = result.index + result.value.length;
    });
    highlighted.appendChild(document.createTextNode(subject.slice(cursor)));
    if (!matches.length) highlighted.textContent = subject || 'Enter a subject to test.';
    const groups = document.getElementById('regex-match-groups');
    matches.slice(0, 100).forEach((result, index) => {
      const item = document.createElement('div');
      const groupText = result.groups.length ? result.groups.map((group, groupIndex) => 'Group ' + (groupIndex + 1) + ': ' + String(group)).join(' · ') : 'No capture groups';
      item.innerHTML = '<strong>Match ' + (index + 1) + '</strong><span></span><small>Index ' + result.index + '</small>';
      item.querySelector('span').textContent = result.value || 'Empty match';
      item.querySelector('small').textContent += ' · ' + groupText;
      groups.appendChild(item);
    });
  } catch(e) {
    preview.innerHTML = '<div class="preview-error-state" role="alert"><strong>Invalid regular expression</strong><p>' + escapeHTML(e.message) + '</p></div>';
  }
}

function generateMarkdownPreview() {
  const md = document.getElementById('opt-mde-raw').value;
  const preview = document.getElementById('generator-preview-mount');
  if (!preview) return;
  let html = escapeHTML(md).replace(/^#\s+(.*)$/gm, '<h1>$1</h1>');
  html = html.replace(/^##\s+(.*)$/gm, '<h2>$1</h2>');
  html = html.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>');
  html = html.replace(/\*(.*?)\*/g, '<em>$1</em>');
  html = html.replace(/^-\s+(.*)$/gm, '<div class="markdown-list-item">• $1</div>');
  html = html.replace(/\n/g, '<br/>');
  preview.innerHTML = `
    <div class="markdown-split-editor">
      <section><h5>Markdown source</h5><pre id="markdown-source-preview"></pre></section>
      <section><h5>Live render</h5><div class="markdown-render-preview">${html || '<p class="empty-preview-copy">Type markdown text in settings.</p>'}</div></section>
    </div>
  `;
  document.getElementById('markdown-source-preview').textContent = md;
}
function downloadMarkdownFile() {
  const txt = document.getElementById('opt-mde-raw').value;
  const blob = new Blob([txt], { type: 'text/markdown' });
  saveBlob(blob, 'editor_export.md');
}

function generateCssBeautify() {
  const css = document.getElementById('opt-css-raw').value;
  const preview = document.getElementById('generator-preview-mount');
  if (!preview) return;
  const formatted = css.replace(/{\s*/g, ' {\n  ').replace(/;\s*/g, ';\n  ').replace(/\s*}\s*/g, '\n}\n\n').trim();
  preview.innerHTML = `
    <div style="width:100%; text-align:left;">
      <h5 style="font-weight:700; margin-bottom:8px;">Formatted CSS</h5>
      <textarea id="generated-css-display" class="form-input-text" style="height:150px; font-family:var(--font-mono); font-size:11px;" readonly>${formatted}</textarea>
    </div>
  `;
}
function downloadCssFile() {
  const css = document.getElementById('generated-css-display').value;
  const blob = new Blob([css], { type: 'text/css' });
  saveBlob(blob, 'beautified_layout.css');
}

function generateJsBeautify() {
  const js = document.getElementById('opt-js-raw').value;
  const preview = document.getElementById('generator-preview-mount');
  if (!preview) return;
  const formatted = js.replace(/{\s*/g, ' {\n  ').replace(/;\s*/g, ';\n  ').replace(/\n\s*}\s*/g, '\n}\n').trim();
  preview.innerHTML = `
    <div style="width:100%; text-align:left;">
      <h5 style="font-weight:700; margin-bottom:8px;">Formatted JS Output</h5>
      <textarea id="generated-js-display" class="form-input-text" style="height:150px; font-family:var(--font-mono); font-size:11px;" readonly>${formatted}</textarea>
    </div>
  `;
}
function downloadJsFile() {
  const js = document.getElementById('generated-js-display').value;
  const blob = new Blob([js], { type: 'text/javascript' });
  saveBlob(blob, 'beautified_script.js');
}

function generateHtmlBeautify() {
  const html = document.getElementById('opt-html-beaut-raw').value;
  const preview = document.getElementById('generator-preview-mount');
  if (!preview) return;
  const formatted = html.replace(/></g, '>\n<').replace(/^(.*)$/gm, '  $1').trim();
  preview.innerHTML = `
    <div style="width:100%; text-align:left;">
      <h5 style="font-weight:700; margin-bottom:8px;">Formatted HTML</h5>
      <textarea id="generated-html-beaut-display" class="form-input-text" style="height:150px; font-family:var(--font-mono); font-size:11px;" readonly>${formatted}</textarea>
    </div>
  `;
}
function downloadHtmlBeautFile() {
  const html = document.getElementById('generated-html-beaut-display').value;
  const blob = new Blob([html], { type: 'text/html' });
  saveBlob(blob, 'beautified_document.html');
}

function generateColorConvert() {
  const val = document.getElementById('opt-color-val').value.trim();
  const preview = document.getElementById('generator-preview-mount');
  if (!preview) return;

  const parseColor = input => {
    const hexMatch = input.match(/^#([0-9a-f]{3}|[0-9a-f]{6})$/i);
    if (hexMatch) {
      const expanded = hexMatch[1].length === 3
        ? hexMatch[1].split('').map(char => char + char).join('')
        : hexMatch[1];
      return {
        r: parseInt(expanded.slice(0, 2), 16),
        g: parseInt(expanded.slice(2, 4), 16),
        b: parseInt(expanded.slice(4, 6), 16)
      };
    }

    const rgbMatch = input.match(/^rgba?\(\s*([+-]?[\d.]+)\s*,\s*([+-]?[\d.]+)\s*,\s*([+-]?[\d.]+)(?:\s*,\s*[\d.]+)?\s*\)$/i);
    if (rgbMatch) {
      const channels = rgbMatch.slice(1, 4).map(Number);
      if (channels.every(channel => Number.isFinite(channel) && channel >= 0 && channel <= 255)) {
        return { r: Math.round(channels[0]), g: Math.round(channels[1]), b: Math.round(channels[2]) };
      }
    }

    const hslMatch = input.match(/^hsla?\(\s*([+-]?[\d.]+)(?:deg)?\s*,\s*([+-]?[\d.]+)%\s*,\s*([+-]?[\d.]+)%(?:\s*,\s*[\d.]+)?\s*\)$/i);
    if (hslMatch) {
      const hue = ((Number(hslMatch[1]) % 360) + 360) % 360;
      const saturation = Number(hslMatch[2]);
      const lightness = Number(hslMatch[3]);
      if (Number.isFinite(hue) && saturation >= 0 && saturation <= 100 && lightness >= 0 && lightness <= 100) {
        const s = saturation / 100;
        const l = lightness / 100;
        const chroma = (1 - Math.abs(2 * l - 1)) * s;
        const sector = hue / 60;
        const x = chroma * (1 - Math.abs((sector % 2) - 1));
        const [r1, g1, b1] = sector < 1 ? [chroma, x, 0]
          : sector < 2 ? [x, chroma, 0]
            : sector < 3 ? [0, chroma, x]
              : sector < 4 ? [0, x, chroma]
                : sector < 5 ? [x, 0, chroma]
                  : [chroma, 0, x];
        const match = l - chroma / 2;
        return {
          r: Math.round((r1 + match) * 255),
          g: Math.round((g1 + match) * 255),
          b: Math.round((b1 + match) * 255)
        };
      }
    }
    return null;
  };

  const parsed = parseColor(val);
  if (!parsed) {
    preview.innerHTML = '<div class="calculator-empty-state" style="color:var(--color-danger);">Enter a valid HEX, RGB, or HSL color value.</div>';
    return;
  }

  const { r, g, b } = parsed;
  const hex = `#${[r, g, b].map(channel => channel.toString(16).padStart(2, '0')).join('')}`;
  const max = Math.max(r, g, b) / 255;
  const min = Math.min(r, g, b) / 255;
  const delta = max - min;
  let hue = 0;
  if (delta) {
    if (max === r / 255) hue = 60 * (((g - b) / 255 / delta) % 6);
    else if (max === g / 255) hue = 60 * (((b - r) / 255 / delta) + 2);
    else hue = 60 * (((r - g) / 255 / delta) + 4);
  }
  if (hue < 0) hue += 360;
  const lightness = (max + min) / 2;
  const saturation = delta === 0 ? 0 : delta / (1 - Math.abs(2 * lightness - 1));
  const black = 1 - max;
  const cmykDivisor = 1 - black;
  const cyan = cmykDivisor === 0 ? 0 : (1 - r / 255 - black) / cmykDivisor;
  const magenta = cmykDivisor === 0 ? 0 : (1 - g / 255 - black) / cmykDivisor;
  const yellow = cmykDivisor === 0 ? 0 : (1 - b / 255 - black) / cmykDivisor;
  const rgb = `rgb(${r}, ${g}, ${b})`;
  const hsl = `hsl(${Math.round(hue)}, ${Math.round(saturation * 100)}%, ${Math.round(lightness * 100)}%)`;
  const cmyk = `cmyk(${Math.round(cyan * 100)}%, ${Math.round(magenta * 100)}%, ${Math.round(yellow * 100)}%, ${Math.round(black * 100)}%)`;
  preview.innerHTML = `
    <div style="width:100%; text-align:left; font-size:13px;">
      <h5 style="font-weight:700; margin-bottom:8px;">Translated Formats</h5>
      <div style="display:flex; gap:12px; align-items:center;">
        <div style="width:50px; height:50px; border-radius:8px; border:1px solid var(--color-border); background-color:${hex};"></div>
        <div style="line-height:1.6;">
          <p><strong>HEX:</strong> <span style="font-family:var(--font-mono); font-size:11px;">${hex}</span></p>
          <p><strong>RGB:</strong> <span style="font-family:var(--font-mono); font-size:11px;">${rgb}</span></p>
          <p><strong>HSL:</strong> <span style="font-family:var(--font-mono); font-size:11px;">${hsl}</span></p>
          <p><strong>CMYK:</strong> <span style="font-family:var(--font-mono); font-size:11px;">${cmyk}</span></p>
        </div>
      </div>
    </div>
  `;
}

function generateUrlConvert() {
  const mode = appState.activeToolOptions.mode || 'encode';
  const text = document.getElementById('opt-url-text').value;
  const preview = document.getElementById('generator-preview-mount');
  if (!preview) return;
  let result = '';
  if (mode === 'encode') {
    result = encodeURIComponent(text);
  } else {
    try {
      result = decodeURIComponent(text);
    } catch(e) {
      result = "Invalid encoded string.";
    }
  }
  preview.innerHTML = `
    <div style="width:100%; text-align:left;">
      <h5 style="font-weight:700; margin-bottom:8px;">URL Conversion Results</h5>
      <textarea readonly class="form-input-text" style="height:120px; font-family:var(--font-mono); font-size:11px;">${result}</textarea>
    </div>
  `;
}

function generateCaseConvert() {
  const text = document.getElementById('opt-case-text').value;
  const type = document.getElementById('opt-case-type').value;
  const preview = document.getElementById('generator-preview-mount');
  if (!preview) return;
  let result = '';
  if (type === 'upper') {
    result = text.toUpperCase();
  } else if (type === 'lower') {
    result = text.toLowerCase();
  } else if (type === 'title') {
    result = text.replace(/\w\S*/g, (txt) => txt.charAt(0).toUpperCase() + txt.substr(1).toLowerCase());
  } else if (type === 'sentence') {
    result = text.charAt(0).toUpperCase() + text.slice(1).toLowerCase();
  } else if (type === 'camel') {
    result = text.toLowerCase().replace(/[^a-zA-Z0-9]+(.)/g, (m, chr) => chr.toUpperCase());
  } else if (type === 'kebab') {
    result = text.replace(/([a-z0-9])([A-Z])/g, '$1-$2').replace(/[^a-zA-Z0-9]+/g, '-').toLowerCase();
  }
  preview.innerHTML = `
    <div style="width:100%; text-align:left;">
      <h5 style="font-weight:700; margin-bottom:8px;">Re-cased text</h5>
      <textarea id="generated-case-display" readonly class="form-input-text" style="height:120px; line-height:1.5;">${result}</textarea>
    </div>
  `;
}
function downloadCaseTextFile() {
  const txt = document.getElementById('generated-case-display').value;
  const blob = new Blob([txt], { type: 'text/plain' });
  saveBlob(blob, 'cased_text_export.txt');
}

// --- Dynamic File Importer for Text Area generators ---
function importFileContentToTextarea(textareaId, fileInput, readAs = 'text') {
  const file = fileInput.files[0];
  if (!file) return;
  const reader = new FileReader();
  reader.onload = (e) => {
    const textarea = document.getElementById(textareaId);
    if (textarea) {
      if (readAs === 'base64') {
        const parts = e.target.result.split(',');
        textarea.value = parts[1] || parts[0];
      } else {
        textarea.value = e.target.result;
      }
      textarea.dispatchEvent(new Event('input'));
    }
  };
  if (readAs === 'base64') {
    reader.readAsDataURL(file);
  } else {
    reader.readAsText(file);
  }
}

// --- Live File Hashing ---
function importFileForHashing(fileInput) {
  const file = fileInput.files[0];
  if (!file) return;
  const reader = new FileReader();
  reader.onload = async (e) => {
    const buffer = e.target.result;
    const algo = document.getElementById('opt-hash-algo').value || 'SHA-256';
    const hashBuffer = await crypto.subtle.digest(algo, buffer);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    const hash = hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
    const preview = document.getElementById('generator-preview-mount');
    if (preview) {
      preview.innerHTML = `
        <div style="width:100%; text-align:left;">
          <h5 style="font-weight:700; margin-bottom:8px;">File Hash (${algo})</h5>
          <p style="margin-bottom:6px; font-size:12px; color:var(--color-text-secondary);">File: <strong>${file.name}</strong> (${(file.size/1024).toFixed(1)} KB)</p>
          <div style="font-family:var(--font-mono); padding:10px; border:1px solid var(--color-border); border-radius:4px; background:var(--color-bg); word-break:break-all; font-size:12px; font-weight:bold; margin-top:8px;">
            ${hash}
          </div>
          <button class="btn btn-ghost btn-sm" onclick="navigator.clipboard.writeText('${hash}')" style="margin-top:10px;"><i data-lucide="copy" style="width:12px;"></i> Copy Hash</button>
        </div>
      `;
      lucide.createIcons();
    }
  };
  reader.readAsArrayBuffer(file);
}

// --- Base64 Live Download ---
function downloadBase64TextFile() {
  const preview = document.getElementById('generator-preview-mount');
  const textarea = preview ? preview.querySelector('textarea') : null;
  if (textarea) {
    const blob = new Blob([textarea.value], { type: 'text/plain' });
    saveBlob(blob, 'base64_converted.txt');
  }
}

// --- Live Hashing for text inputs ---
async function generateHashTextLive() {
  const val = document.getElementById('opt-hash-text').value;
  const algo = document.getElementById('opt-hash-algo').value || 'SHA-256';
  const preview = document.getElementById('generator-preview-mount');
  if (!preview) return;
  
  let hash = '';
  if (val.trim() === '') {
    hash = '-';
  } else {
    const data = new TextEncoder().encode(val);
    const hashBuffer = await crypto.subtle.digest(algo, data);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    hash = hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
  }
  
  preview.innerHTML = `
    <div style="width:100%; text-align:left;">
      <h5 style="font-weight:700; margin-bottom:8px;">Live Hash Output (${algo})</h5>
      <div style="font-family:var(--font-mono); padding:10px; border:1px solid var(--color-border); border-radius:4px; background:var(--color-bg); word-break:break-all; font-size:12px; font-weight:bold;">
        ${hash}
      </div>
      <button class="btn btn-ghost btn-sm" onclick="navigator.clipboard.writeText('${hash}')" style="margin-top:10px;"><i data-lucide="copy" style="width:12px;"></i> Copy Hash</button>
    </div>
  `;
  lucide.createIcons();
}

// --- Live Word Counter ---
function generateWordCounterLive() {
  const text = document.getElementById('opt-wc-text').value;
  const preview = document.getElementById('generator-preview-mount');
  if (!preview) return;
  
  const chars = text.length;
  const words = text.trim() === '' ? 0 : text.trim().split(/\s+/).length;
  const sentences = text.trim() === '' ? 0 : text.split(/[.!?]+/).length - 1;
  const time = Math.ceil(words / 200);
  const speakingTime = words === 0 ? 0 : Math.max(1, Math.ceil(words / 130));
  const frequencies = {};
  (text.toLowerCase().match(/[\p{L}\p{N}']+/gu) || []).forEach(word => {
    if (word.length > 2) frequencies[word] = (frequencies[word] || 0) + 1;
  });
  const keywords = Object.entries(frequencies).sort((a, b) => b[1] - a[1]).slice(0, 8);
  
  preview.innerHTML = `
    <div style="width:100%; text-align:left;">
      <h5 style="font-weight:700; margin-bottom:12px;">Text Metrics Analysis</h5>
      <table style="width:100%; border-collapse:collapse; font-size:13px;">
        <tr style="border-bottom:1px solid var(--color-border);"><td style="padding:6px 0;">Characters:</td><td style="text-align:right; font-weight:700;">${chars}</td></tr>
        <tr style="border-bottom:1px solid var(--color-border);"><td style="padding:6px 0;">Words:</td><td style="text-align:right; font-weight:700;">${words}</td></tr>
        <tr style="border-bottom:1px solid var(--color-border);"><td style="padding:6px 0;">Sentences:</td><td style="text-align:right; font-weight:700;">${sentences}</td></tr>
        <tr style="border-bottom:1px solid var(--color-border);"><td style="padding:6px 0;">Est. Reading Time:</td><td style="text-align:right; font-weight:700;">${time} min</td></tr>
        <tr><td style="padding:6px 0;">Est. Speaking Time:</td><td style="text-align:right; font-weight:700;">${speakingTime} min</td></tr>
      </table>
      <div class="keyword-density-list" aria-label="Keyword density">
        ${keywords.length ? keywords.map(item => '<span><strong>' + escapeHTML(item[0]) + '</strong> ' + item[1] + ' · ' + (words ? ((item[1] / words) * 100).toFixed(1) : 0) + '%</span>').join('') : '<span>Add more text to calculate keyword density.</span>'}
      </div>
    </div>
  `;
}

// --- JSON live download ---
function downloadJsonFile() {
  const display = document.getElementById('generated-json-display');
  if (display) {
    const blob = new Blob([display.value], { type: 'application/json' });
    saveBlob(blob, 'formatted_data.json');
  }
}

// --- Live SQL Beautifier/Formatter ---
function generateSqlBeautify() {
  const sql = document.getElementById('opt-sql-raw').value;
  const preview = document.getElementById('generator-preview-mount');
  if (!preview) return;
  
  let formatted = sql;
  if (sql.trim() !== '') {
    formatted = sql
      .replace(/\s+/g, ' ')
      .replace(/\b(select|from|where|left join|inner join|right join|group by|order by|having|limit|union|and|or)\b/gi, (match) => {
        return '\n' + match.toUpperCase();
      })
      .trim();
  }
  
  preview.innerHTML = `
    <div style="width:100%; text-align:left;">
      <h5 style="font-weight:700; margin-bottom:8px;">Formatted SQL Query</h5>
      <textarea id="generated-sql-display" class="form-input-text" style="height:150px; font-family:var(--font-mono); font-size:11px;" readonly>${formatted}</textarea>
    </div>
  `;
}
function downloadSqlFile() {
  const display = document.getElementById('generated-sql-display');
  if (display) {
    const blob = new Blob([display.value], { type: 'text/plain' });
    saveBlob(blob, 'formatted_query.sql');
  }
}

// --- XML to JSON Converter ---
function generateXmlToJson() {
  const xmlStr = document.getElementById('opt-xml-raw').value;
  const preview = document.getElementById('generator-preview-mount');
  if (!preview) return;
  
  let jsonResult = '';
  if (xmlStr.trim() !== '') {
    try {
      const parser = new DOMParser();
      const xmlDoc = parser.parseFromString(xmlStr, "application/xml");
      
      const parserError = xmlDoc.querySelector("parsererror");
      if (parserError) {
        jsonResult = "Error parsing XML: " + parserError.textContent;
      } else {
        const parseNode = (node) => {
          const obj = {};
          if (node.nodeType === 1) { 
            if (node.attributes.length > 0) {
              obj["@attributes"] = {};
              for (let j = 0; j < node.attributes.length; j++) {
                const attribute = node.attributes.item(j);
                obj["@attributes"][attribute.nodeName] = attribute.nodeValue;
              }
            }
          } else if (node.nodeType === 3) { 
            return node.nodeValue.trim();
          }
          
          if (node.hasChildNodes()) {
            for (let i = 0; i < node.childNodes.length; i++) {
              const item = node.childNodes.item(i);
              const nodeName = item.nodeName;
              if (nodeName === "#text") {
                const val = item.nodeValue.trim();
                if (val !== "") return val;
              } else {
                if (typeof(obj[nodeName]) === "undefined") {
                  obj[nodeName] = parseNode(item);
                } else {
                  if (typeof(obj[nodeName].push) === "undefined") {
                    const old = obj[nodeName];
                    obj[nodeName] = [];
                    obj[nodeName].push(old);
                  }
                  obj[nodeName].push(parseNode(item));
                }
              }
            }
          }
          return obj;
        };
        
        const root = xmlDoc.documentElement;
        const resultObj = {};
        resultObj[root.nodeName] = parseNode(root);
        jsonResult = JSON.stringify(resultObj, null, 2);
      }
    } catch (e) {
      jsonResult = "Error converting XML: " + e.message;
    }
  }
  
  preview.innerHTML = `
    <div style="width:100%; text-align:left;">
      <h5 style="font-weight:700; margin-bottom:8px;">Parsed JSON Output</h5>
      <textarea id="generated-xmljson-display" class="form-input-text" style="height:150px; font-family:var(--font-mono); font-size:11px;" readonly>${jsonResult}</textarea>
    </div>
  `;
}
function downloadXmlToJsonFile() {
  const display = document.getElementById('generated-xmljson-display');
  if (display) {
    const blob = new Blob([display.value], { type: 'application/json' });
    saveBlob(blob, 'xml_converted.json');
  }
}

// --- Epoch/Timestamp Converter ---
function generateTimestampConvert() {
  const val = parseInt(document.getElementById('opt-ts-val').value) || 0;
  const preview = document.getElementById('generator-preview-mount');
  if (!preview) return;
  
  const dateObj = new Date(val * 1000);
  const localDate = dateObj.toString();
  const utcDate = dateObj.toUTCString();
  const isoDate = dateObj.toISOString();
  
  preview.innerHTML = `
    <div style="width:100%; text-align:left; font-size:13px;">
      <h5 style="font-weight:700; margin-bottom:10px;">Epoch Translation Result</h5>
      <div style="padding:12px; border:1px solid var(--color-border); border-radius:var(--radius-md); background:var(--color-bg); line-height:1.7;">
        <p><strong>GMT/UTC Date:</strong> <span style="font-family:var(--font-mono); font-size:11px;">${utcDate}</span></p>
        <p style="margin-top:6px;"><strong>Local Date:</strong> <span style="font-family:var(--font-mono); font-size:11px;">${localDate}</span></p>
        <p style="margin-top:6px;"><strong>ISO 8601:</strong> <span style="font-family:var(--font-mono); font-size:11px;">${isoDate}</span></p>
      </div>
    </div>
  `;
}
function setTimestampCurrent() {
  const el = document.getElementById('opt-ts-val');
  if (el) {
    el.value = Math.floor(Date.now() / 1000);
    generateTimestampConvert();
  }
}

// --- Live Speech reader initialization ---
function initializeTextToSpeech() {
  const textStr = document.getElementById('opt-speech-text').value;
  const rate = parseFloat(document.getElementById('opt-speech-rate').value) || 1.0;
  
  const preview = document.getElementById('generator-preview-mount');
  if (preview) {
    preview.innerHTML = `
      <div style="padding: 15px; border: 1px solid var(--color-border); border-radius: var(--radius-md); background: var(--color-bg); display:flex; flex-direction:column; gap:10px; align-items:center; width:100%;">
        <p style="font-size:12px; color:var(--color-text-secondary); text-align:center;">Native Web Speech Synthesis reader engine.</p>
        <div style="display:flex; gap:10px; justify-content:center;">
          <button class="btn btn-ghost btn-sm" id="speech-play-btn"><i data-lucide="play" style="width:16px;"></i> Play Speech</button>
          <button class="btn btn-ghost btn-sm" id="speech-stop-btn"><i data-lucide="square" style="width:16px;"></i> Stop</button>
        </div>
      </div>
    `;
    lucide.createIcons();
    
    document.getElementById('speech-play-btn').addEventListener('click', () => {
      const textVal = document.getElementById('opt-speech-text').value;
      const rateVal = parseFloat(document.getElementById('opt-speech-rate').value) || 1.0;
      runTextToSpeechLive(textVal, rateVal);
    });
    
    document.getElementById('speech-stop-btn').addEventListener('click', stopBrowserSynthesis);
  }
}
function runTextToSpeechLive(text, rate) {
  window.speechSynthesis.cancel();
  const utterance = new SpeechSynthesisUtterance(text);
  utterance.rate = rate;
  window.speechSynthesis.speak(utterance);
  showToast('Reading aloud...', 'info');
}

// --- ALGORITHM: REMOVE PDF PAGES ---
async function runPDFRemovePages(file, rangeStr) {
  const arrayBuffer = await file.arrayBuffer();
  const doc = await PDFLib.PDFDocument.load(arrayBuffer);
  
  const indices = parsePdfPageSelection(rangeStr, doc.getPageCount()).sort((a, b) => b - a);
  if (indices.length >= doc.getPageCount()) throw new Error('A PDF must retain at least one page.');
  indices.forEach(idx => doc.removePage(idx));
  
  const pdfBytes = await doc.save();
  return new Blob([pdfBytes], { type: 'application/pdf' });
}

// --- ALGORITHM: EXTRACT PDF PAGES ---
async function runPDFExtractPages(file, rangeStr) {
  const arrayBuffer = await file.arrayBuffer();
  const srcDoc = await PDFLib.PDFDocument.load(arrayBuffer);
  const newPdf = await PDFLib.PDFDocument.create();
  
  const indices = parsePdfPageSelection(rangeStr, srcDoc.getPageCount());
  
  const copiedPages = await newPdf.copyPages(srcDoc, indices);
  copiedPages.forEach(p => newPdf.addPage(p));
  
  const pdfBytes = await newPdf.save();
  return new Blob([pdfBytes], { type: 'application/pdf' });
}

// --- ALGORITHM: EXTRACT PDF IMAGES ---
async function runPDFExtractImages(file) {
  if (file.size > 30 * 1024 * 1024) throw new Error('Embedded image extraction supports PDFs up to 30 MB in this browser.');
  const images = await window.GxaWorkspace.extractEmbeddedPdfImages(file);
  if (!images.length) throw new Error('No decoded embedded raster image objects were found. Use PDF to Image if you need rendered page images.');
  const archive = new JSZip();
  images.forEach((image, index) => archive.file(`page-${String(image.pageNumber).padStart(3, '0')}-image-${String(index + 1).padStart(3, '0')}.png`, image.blob));
  archive.file('manifest.json', JSON.stringify({
    source: file.name,
    extraction: 'Decoded PDF image objects; these are not rendered pages or guaranteed original compressed byte streams.',
    images: images.map((image, index) => ({ file: `page-${String(image.pageNumber).padStart(3, '0')}-image-${String(index + 1).padStart(3, '0')}.png`, page: image.pageNumber, object: image.name, width: image.width, height: image.height }))
  }, null, 2));
  return archive.generateAsync({ type: 'blob', compression: 'DEFLATE' });
}

// --- ALGORITHM: CROP PDF ---
async function runPDFCrop(file, top, bottom, left, right, pageSelection = '') {
  const arrayBuffer = await file.arrayBuffer();
  const doc = await PDFLib.PDFDocument.load(arrayBuffer);
  const pages = doc.getPages();
  
  const selected = new Set(resolveOptionalPdfPageSelection(pageSelection, pages.length));
  pages.forEach((page, index) => {
    if (!selected.has(index)) return;
    const { width, height } = page.getSize();
    const newX = left;
    const newY = bottom;
    const newWidth = width - left - right;
    const newHeight = height - top - bottom;
    
    if (newWidth <= 50 || newHeight <= 50) throw new Error(`Crop margins leave page ${index + 1} smaller than 50 points.`);
    page.setCropBox(newX, newY, newWidth, newHeight);
  });
  
  const pdfBytes = await doc.save();
  return new Blob([pdfBytes], { type: 'application/pdf' });
}

// --- ALGORITHM: ADD HEADER & FOOTER ---
async function runPDFHeaderFooter(file, header, footer, align, pageSelection = '', fontSize = 10) {
  const arrayBuffer = await file.arrayBuffer();
  const doc = await PDFLib.PDFDocument.load(arrayBuffer);
  const pages = doc.getPages();
  
  const selected = new Set(resolveOptionalPdfPageSelection(pageSelection, pages.length));
  pages.forEach((page, idx) => {
    if (!selected.has(idx)) return;
    const { width, height } = page.getSize();
    const replaceTokens = value => String(value || '')
      .replace(/\[page\]/gi, String(idx + 1))
      .replace(/\[total\]/gi, String(pages.length))
      .replace(/\[date\]/gi, new Date().toISOString().slice(0, 10))
      .replace(/\[filename\]/gi, file.name);
    const headerText = replaceTokens(header);
    const footerText = replaceTokens(footer);
    const safeFontSize = Math.max(6, Math.min(48, Number(fontSize) || 10));
    
    if (headerText.trim() !== '') {
      let x = 50;
      if (align === 'center') x = width / 2 - (headerText.length * safeFontSize * 0.25);
      if (align === 'right') x = width - 50 - (headerText.length * safeFontSize * 0.5);
      
      page.drawText(headerText, {
        x: x,
        y: height - 35,
        size: safeFontSize,
        color: PDFLib.rgb(0.4, 0.4, 0.4)
      });
    }
    
    if (footerText.trim() !== '') {
      let x = 50;
      if (align === 'center') x = width / 2 - (footerText.length * 3);
      if (align === 'right') x = width - 50 - (footerText.length * 6);
      
      page.drawText(footerText, {
        x: x,
        y: 35,
        size: safeFontSize,
        color: PDFLib.rgb(0.4, 0.4, 0.4)
      });
    }
  });
  
  const pdfBytes = await doc.save();
  return new Blob([pdfBytes], { type: 'application/pdf' });
}

// --- ALGORITHM: SIGN PDF ---
function initializePdfSignaturePad() {
  const canvas = document.getElementById('pdf-signature-pad');
  if (!canvas) return;
  const context = canvas.getContext('2d');
  context.lineCap = 'round';
  context.lineJoin = 'round';
  context.lineWidth = 5;
  context.strokeStyle = '#173b79';
  let drawing = false;
  const point = event => {
    const bounds = canvas.getBoundingClientRect();
    return { x: (event.clientX - bounds.left) * canvas.width / bounds.width, y: (event.clientY - bounds.top) * canvas.height / bounds.height };
  };
  canvas.addEventListener('pointerdown', event => {
    drawing = true;
    canvas.setPointerCapture(event.pointerId);
    const start = point(event);
    context.beginPath();
    context.moveTo(start.x, start.y);
  });
  canvas.addEventListener('pointermove', event => {
    if (!drawing) return;
    const next = point(event);
    context.lineTo(next.x, next.y);
    context.stroke();
  });
  const finish = () => {
    if (!drawing) return;
    drawing = false;
    pdfSignatureDrawingDataUrl = canvas.toDataURL('image/png');
  };
  canvas.addEventListener('pointerup', finish);
  canvas.addEventListener('pointercancel', finish);
}

function clearPdfSignaturePad() {
  const canvas = document.getElementById('pdf-signature-pad');
  canvas?.getContext('2d').clearRect(0, 0, canvas.width, canvas.height);
  pdfSignatureDrawingDataUrl = '';
}

async function runPDFSign(file, signee, color, pageSelection = '', signatureAsset = null) {
  const arrayBuffer = await file.arrayBuffer();
  const doc = await PDFLib.PDFDocument.load(arrayBuffer);
  const pages = doc.getPages();
  const selected = resolveOptionalPdfPageSelection(pageSelection, pages.length);
  const targetIndex = pageSelection ? selected[0] : pages.length - 1;
  const lastPage = pages[targetIndex];
  const { width, height } = lastPage.getSize();
  
  const boxW = 150;
  const boxH = 60;
  const x = width - boxW - 40;
  const y = 50;
  
  lastPage.drawRectangle({
    x: x,
    y: y,
    width: boxW,
    height: boxH,
    borderColor: PDFLib.rgb(0.8, 0.8, 0.8),
    borderWidth: 1,
    color: PDFLib.rgb(0.98, 0.98, 0.98),
    opacity: 0.9
  });
  
  let textCol = PDFLib.rgb(0.1, 0.3, 0.8);
  if (color === 'black') textCol = PDFLib.rgb(0.1, 0.1, 0.1);
  if (color === 'red') textCol = PDFLib.rgb(0.8, 0.1, 0.1);
  
  lastPage.drawText(signatureAsset ? 'Signature appearance:' : 'Signature appearance added by:', {
    x: x + 10,
    y: y + 42,
    size: 8,
    color: PDFLib.rgb(0.5, 0.5, 0.5)
  });
  
  if (signatureAsset) {
    const signatureImage = signatureAsset.type === 'image/jpeg'
      ? await doc.embedJpg(signatureAsset.bytes)
      : await doc.embedPng(signatureAsset.bytes);
    const dimensions = signatureImage.scaleToFit(boxW - 20, 30);
    lastPage.drawImage(signatureImage, { x: x + 10, y: y + 12, width: dimensions.width, height: dimensions.height });
  } else {
    lastPage.drawText(signee, { x: x + 10, y: y + 20, size: 14, color: textCol });
  }
  
  const dateStr = new Date().toISOString().split('T')[0];
  lastPage.drawText("Date: " + dateStr, {
    x: x + 10,
    y: y + 8,
    size: 7,
    color: PDFLib.rgb(0.6, 0.6, 0.6)
  });
  
  const pdfBytes = await doc.save();
  return new Blob([pdfBytes], { type: 'application/pdf' });
}

// --- ALGORITHM: REPAIR PDF ---
async function runPDFRepair(file) {
  const arrayBuffer = await file.arrayBuffer();
  const doc = await PDFLib.PDFDocument.load(arrayBuffer);
  const pdfBytes = await doc.save({ useObjectStreams: false });
  return new Blob([pdfBytes], { type: 'application/pdf' });
}

// --- ALGORITHM: OCR PDF ---
async function runPDFOCR(file, lang) {
  if (file.size > 30 * 1024 * 1024) throw new Error('OCR PDF supports files up to 30 MB in this browser.');
  await window.GxaWorkspace.loadScriptOnce('/assets/vendor/tesseract/tesseract.min.js', 'Tesseract');
  const stage = document.getElementById('processing-stage-label');
  let worker;
  const text = [];
  try {
    worker = await window.Tesseract.createWorker(lang, 1, {
      workerPath: '/assets/vendor/tesseract/worker.min.js',
      corePath: 'https://cdn.jsdelivr.net/npm/tesseract.js-core@v7.0.0',
      langPath: 'https://cdn.jsdelivr.net/npm/@tesseract.js-data/eng/4.0.0_best_int',
      logger(message) {
        if (stage && message?.status) stage.textContent = `${message.status}${Number.isFinite(message.progress) ? ` ${Math.round(message.progress * 100)}%` : ''}`;
      }
    });
    await window.GxaWorkspace.renderPdfPages(file, {
      scale: 1.5,
      maximumPages: 20,
      maximumTotalPixels: 30_000_000,
      isCancelled: () => premiumEditorState.batchCancelled,
      onPage: async (page, total) => {
        if (premiumEditorState.batchCancelled) throw new Error(`OCR cancelled after ${text.length} page${text.length === 1 ? '' : 's'}.`);
        if (stage) stage.textContent = `Recognizing page ${page.pageNumber} of ${total}…`;
        const result = await worker.recognize(page.canvas);
        text.push(`--- Page ${page.pageNumber} ---\n${result.data.text.trim()}`);
        const progress = document.getElementById('global-progress-bar');
        if (progress) progress.style.width = `${25 + Math.round((page.pageNumber / total) * 55)}%`;
      },
      onProgress: (pageNumber, total) => { if (stage) stage.textContent = `Completed OCR page ${pageNumber} of ${total}`; }
    });
  } finally {
    if (worker) await worker.terminate();
  }
  return new Blob([text.join('\n\n')], { type: 'text/plain;charset=utf-8' });
}

// --- ALGORITHM: PDF TO EXCEL ---
async function runPDFToExcel(file) {
  if (file.size > 30 * 1024 * 1024) throw new Error('PDF to Excel supports files up to 30 MB in this browser.');
  await window.GxaWorkspace.loadScriptOnce('/assets/vendor/sheetjs/xlsx.full.min.js', 'XLSX');
  const pages = await window.GxaWorkspace.extractPdfTextRows(file);
  if (!pages.some(rows => rows.length)) throw new Error('No selectable text rows were found. OCR scanned PDFs before spreadsheet extraction.');
  const workbook = window.XLSX.utils.book_new();
  pages.forEach((rows, index) => {
    const worksheet = window.XLSX.utils.aoa_to_sheet(rows.length ? rows : [['']]);
    window.XLSX.utils.book_append_sheet(workbook, worksheet, `Page ${index + 1}`.slice(0, 31));
  });
  const output = window.XLSX.write(workbook, { type: 'array', bookType: 'xlsx', compression: true });
  return new Blob([output], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
}

// --- ALGORITHM: PDF TO PPT ---
async function runPDFToPPT(file) {
  if (file.size > 30 * 1024 * 1024) throw new Error('PDF to PPT supports files up to 30 MB in this browser.');
  await window.GxaWorkspace.loadScriptOnce('/assets/vendor/pptxgenjs/pptxgen.min.js', 'PptxGenJS');
  const presentation = new window.PptxGenJS();
  presentation.layout = 'LAYOUT_WIDE';
  presentation.author = 'GXA Technologies';
  presentation.subject = 'Image-based PDF page conversion';
  presentation.title = file.name.replace(/\.pdf$/i, '');
  await window.GxaWorkspace.renderPdfPages(file, {
    scale: 1.25,
    maximumPages: 30,
    maximumTotalPixels: 30_000_000,
    isCancelled: () => premiumEditorState.batchCancelled,
    onPage: page => {
      const slide = presentation.addSlide();
      slide.background = { color: 'FFFFFF' };
      const data = page.canvas.toDataURL('image/jpeg', 0.88);
      const pageRatio = page.width / page.height;
      const slideRatio = 13.333 / 7.5;
      let width = 13.333;
      let height = 7.5;
      let x = 0;
      let y = 0;
      if (pageRatio > slideRatio) { height = width / pageRatio; y = (7.5 - height) / 2; }
      else { width = height * pageRatio; x = (13.333 - width) / 2; }
      slide.addImage({ data, x, y, w: width, h: height });
    }
  });
  const output = await presentation.write({ outputType: 'arraybuffer', compression: true });
  return new Blob([output], { type: 'application/vnd.openxmlformats-officedocument.presentationml.presentation' });
}



// --- GENERATOR ALGORITHMS AND UTILITIES ---

async function generateRemoveSpaces() {
  const textVal = document.getElementById('opt-spaces-text').value;
  const preview = document.getElementById('generator-preview-mount');
  if (!preview) return;
  
  if (textVal.trim() === '') {
    preview.innerHTML = `<div style="color:var(--color-text-secondary); font-size:13px;">Output preview will be shown here...</div>`;
    return;
  }
  
  try {
    const res = await fetch('/api/text-tools.php?action=spaces', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ text: textVal })
    });
    const data = await res.json();
    if (data.success) {
      preview.innerHTML = `
        <div style="width:100%; text-align:left; display:block;">
          <h5 style="font-weight:700; margin-bottom:8px;">Cleaned Text Result</h5>
          <textarea id="generated-spaces-display" readonly class="form-input-text" style="height:150px; line-height:1.5;">${data.result}</textarea>
        </div>
      `;
    }
  } catch (err) {
    console.error(err);
  }
}

function downloadCleanedSpacesFile() {
  const el = document.getElementById('generated-spaces-display');
  if (el) {
    saveBlob(new Blob([el.value], { type: 'text/plain' }), 'cleaned_spaces.txt');
  } else {
    showToast('Nothing to download yet.', 'info');
  }
}

async function generateGrammarCheck() {
  const textVal = document.getElementById('opt-grammar-text').value;
  const preview = document.getElementById('generator-preview-mount');
  if (!preview) return;
  
  if (textVal.trim() === '') {
    preview.innerHTML = `<div style="color:var(--color-text-secondary); font-size:13px;">Output preview will be shown here...</div>`;
    return;
  }
  
  try {
    const res = await fetch('/api/text-tools.php?action=grammar', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ text: textVal })
    });
    const data = await res.json();
    if (data.success) {
      preview.innerHTML = `
        <div style="width:100%; text-align:left; display:block;">
          <h5 style="font-weight:700; margin-bottom:8px;">Grammar & Spell Checked Text (${data.correctionsCount} suggestions)</h5>
          <textarea id="generated-grammar-display" readonly class="form-input-text" style="height:130px; line-height:1.5;">${data.corrected}</textarea>
          ${data.correctionsCount > 0 ? `
            <div style="margin-top:10px; font-size:12px; color:var(--color-accent); font-weight:600;">
              Suggestions applied: ${data.details.map(d => `"${d.original}" → "${d.replacement}"`).join(', ')}
            </div>
          ` : ''}
        </div>
      `;
    }
  } catch (err) {
    console.error(err);
  }
}

function downloadGrammarFile() {
  const el = document.getElementById('generated-grammar-display');
  if (el) {
    saveBlob(new Blob([el.value], { type: 'text/plain' }), 'grammar_corrected.txt');
  }
}

async function generatePlagiarismCheck() {
  const textVal = document.getElementById('opt-plag-text').value;
  const preview = document.getElementById('generator-preview-mount');
  if (!preview) return;
  
  if (textVal.trim() === '') {
    preview.innerHTML = `<div style="color:var(--color-text-secondary); font-size:13px;">Output preview will be shown here...</div>`;
    return;
  }
  
  try {
    const res = await fetch('/api/text-tools.php?action=plagiarism', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ text: textVal })
    });
    const data = await res.json();
    if (data.success) {
      const uniquePct = 100 - data.score;
      preview.innerHTML = `
        <div style="width:100%; text-align:left; display:block;">
          <h5 style="font-weight:700; margin-bottom:12px;">Plagiarism Scan Result</h5>
          <div style="display:flex; justify-content:space-between; font-size:13px; margin-bottom:6px;">
            <span>Uniqueness Score:</span>
            <strong style="color:var(--color-primary);">${uniquePct}% Unique</strong>
          </div>
          <div class="progress-bar-container" style="height:12px; margin-bottom:15px;">
            <div class="progress-bar-fill" style="width:${uniquePct}%; background:var(--color-primary);"></div>
          </div>
          <p style="font-size:12px; color:var(--color-text-secondary);">
            Status: <strong>${data.status}</strong> (${data.score}% matched copy detected)
          </p>
          ${data.matches.length > 0 ? `
            <div style="margin-top:15px; border-top:1px solid var(--color-border); padding-top:10px;">
              <div style="font-size:12px; font-weight:700; margin-bottom:6px;">Matched Source:</div>
              <a href="${data.matches[0].source}" target="_blank" style="font-size:12px; color:var(--color-primary); text-decoration:none;">${data.matches[0].source}</a>
              <blockquote style="font-style:italic; padding-left:8px; border-left:2px solid var(--color-accent); margin-top:5px; color:var(--color-text-secondary);">
                "...${data.matches[0].matchedText}..."
              </blockquote>
            </div>
          ` : ''}
        </div>
      `;
    }
  } catch (err) {
    console.error(err);
  }
}

function numberWithCommas(x) {
  return x.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ",");
}

function evaluateSimpleExpression(expr) {
  const cleanExpr = expr.replace(/[^-+*/%().0-9]/g, '');
  try {
    if (/^[0-9-+*/%(). ]+$/.test(cleanExpr)) {
      const result = Function('"use strict"; return (' + cleanExpr + ')')();
      if (result === Infinity || result === -Infinity) return 'Error: Div by 0';
      if (isNaN(result)) return 'Error';
      return result;
    }
    return 'Error';
  } catch (e) {
    return 'Error';
  }
}

window.pressCalcKey = function(key) {
  if (!appState.calcExpression) appState.calcExpression = '';
  const inputKeys = new Set(['0', '1', '2', '3', '4', '5', '6', '7', '8', '9', '+', '-', '*', '/', '%', '(', ')', '.']);
  if (!inputKeys.has(key) && !['C', 'back', '='].includes(key)) return;
  if (inputKeys.has(key) && appState.calcExpression.length >= 256) return;
  
  const screenExpr = document.getElementById('calc-expr-display');
  const screenResult = document.getElementById('calc-res-display');
  
  if (key === 'C') {
    appState.calcExpression = '';
  } else if (key === 'back') {
    appState.calcExpression = appState.calcExpression.slice(0, -1);
  } else if (key === '=') {
    const result = evaluateSimpleExpression(appState.calcExpression);
    if (screenResult) screenResult.innerText = result;
    return;
  } else {
    appState.calcExpression += key;
  }
  
  if (screenExpr) screenExpr.value = appState.calcExpression;
  if (screenResult && key !== '=') {
    const cleanExpr = appState.calcExpression.trim();
    if (cleanExpr === '') {
      screenResult.innerText = '0';
    } else {
      const live = evaluateSimpleExpression(cleanExpr);
      if (live !== 'Error') {
        screenResult.innerText = live;
      }
    }
  }
};

function initializeSimpleCalculator(preview) {
  if (preview.dataset.simpleCalculatorBound === 'true') return;
  preview.dataset.simpleCalculatorBound = 'true';
  preview.addEventListener('click', event => {
    const button = event.target.closest('[data-calc-key]');
    if (!button || !preview.contains(button)) return;
    pressCalcKey(button.dataset.calcKey);
  });
}

function generateSimpleCalc(resetExpression = false) {
  const preview = document.getElementById('generator-preview-mount');
  if (!preview) return;
  if (resetExpression || typeof appState.calcExpression !== 'string') appState.calcExpression = '';
  const currentResult = appState.calcExpression ? evaluateSimpleExpression(appState.calcExpression) : '0';

  preview.innerHTML = `
    <div style="width: 100%; max-width: 320px; margin: 0 auto; background: var(--color-surface); border: 1px solid var(--color-border); border-radius: var(--radius-lg); padding: 15px; box-shadow: 0 10px 25px -5px rgba(0, 0, 0, 0.1);">
      <div style="background: rgba(0,0,0,0.03); border-radius: var(--radius-md); padding: 12px; text-align: right; margin-bottom: 15px; border: 1px solid var(--color-border);">
        <input type="text" id="calc-expr-display" value="${escapeHTML(appState.calcExpression)}" readonly aria-label="Calculator expression" style="width:100%; border:none; outline:none; background:transparent; font-family:var(--font-mono); font-size:16px; text-align:right; color:var(--color-text-secondary);" placeholder="0">
        <div id="calc-res-display" aria-live="polite" style="font-family:var(--font-mono); font-size:28px; font-weight:800; color:var(--color-text-primary); margin-top:5px; overflow-x:auto; white-space:nowrap;">${escapeHTML(currentResult)}</div>
      </div>

      <div style="display: grid; grid-template-columns: repeat(4, 1fr); gap: 8px;">
        <button type="button" class="preset-btn" data-calc-key="C" style="padding:12px; font-weight:700; color:var(--color-primary);">C</button>
        <button type="button" class="preset-btn" data-calc-key="(" style="padding:12px; font-weight:700;">(</button>
        <button type="button" class="preset-btn" data-calc-key=")" style="padding:12px; font-weight:700;">)</button>
        <button type="button" class="preset-btn" data-calc-key="back" aria-label="Backspace" style="padding:12px; font-weight:700; display:flex; align-items:center; justify-content:center;"><i data-lucide="delete" style="width:16px;"></i></button>

        <button type="button" class="preset-btn" data-calc-key="7" style="padding:12px; font-weight:700;">7</button>
        <button type="button" class="preset-btn" data-calc-key="8" style="padding:12px; font-weight:700;">8</button>
        <button type="button" class="preset-btn" data-calc-key="9" style="padding:12px; font-weight:700;">9</button>
        <button type="button" class="preset-btn" data-calc-key="/" style="padding:12px; font-weight:700; color:var(--color-accent);">÷</button>

        <button type="button" class="preset-btn" data-calc-key="4" style="padding:12px; font-weight:700;">4</button>
        <button type="button" class="preset-btn" data-calc-key="5" style="padding:12px; font-weight:700;">5</button>
        <button type="button" class="preset-btn" data-calc-key="6" style="padding:12px; font-weight:700;">6</button>
        <button type="button" class="preset-btn" data-calc-key="*" style="padding:12px; font-weight:700; color:var(--color-accent);">×</button>

        <button type="button" class="preset-btn" data-calc-key="1" style="padding:12px; font-weight:700;">1</button>
        <button type="button" class="preset-btn" data-calc-key="2" style="padding:12px; font-weight:700;">2</button>
        <button type="button" class="preset-btn" data-calc-key="3" style="padding:12px; font-weight:700;">3</button>
        <button type="button" class="preset-btn" data-calc-key="-" style="padding:12px; font-weight:700; color:var(--color-accent);">−</button>

        <button type="button" class="preset-btn" data-calc-key="0" style="padding:12px; font-weight:700;">0</button>
        <button type="button" class="preset-btn" data-calc-key="." style="padding:12px; font-weight:700;">.</button>
        <button type="button" class="preset-btn" data-calc-key="%" style="padding:12px; font-weight:700; color:var(--color-accent);">%</button>
        <button type="button" class="preset-btn" data-calc-key="+" style="padding:12px; font-weight:700; color:var(--color-accent);">+</button>

        <button type="button" class="btn btn-primary" data-calc-key="=" style="grid-column:1 / -1; padding:12px; font-weight:800;">=</button>
      </div>
    </div>
  `;
  initializeSimpleCalculator(preview);
  lucide.createIcons();
}

function evaluateSciExpression(expr) {
  let mathExpr = expr
    .replace(/π/g, 'Math.PI')
    .replace(/\be\b/g, 'Math.E')
    .replace(/sin\(/g, 'Math.sin((Math.PI/180)*')
    .replace(/cos\(/g, 'Math.cos((Math.PI/180)*')
    .replace(/tan\(/g, 'Math.tan((Math.PI/180)*')
    .replace(/asin\(/g, '(180/Math.PI)*Math.asin(')
    .replace(/acos\(/g, '(180/Math.PI)*Math.acos(')
    .replace(/atan\(/g, '(180/Math.PI)*Math.atan(')
    .replace(/log\(/g, 'Math.log10(')
    .replace(/ln\(/g, 'Math.log(')
    .replace(/sqrt\(/g, 'Math.sqrt(')
    .replace(/√\(/g, 'Math.sqrt(')
    .replace(/\^/g, '**');
    
  const openCount = (mathExpr.match(/\(/g) || []).length;
  const closeCount = (mathExpr.match(/\)/g) || []).length;
  if (openCount > closeCount) {
    mathExpr += ')'.repeat(openCount - closeCount);
  }
  
  try {
    const sanitizedCheck = mathExpr
      .replace(/Math\.(PI|E|sin|cos|tan|asin|acos|atan|log10|log|sqrt)/g, '')
      .replace(/[0-9-+*/().\s]|\*\*/g, '');
    if (sanitizedCheck.trim() === '') {
      const result = Function('"use strict"; return (' + mathExpr + ')')();
      if (result === Infinity || result === -Infinity) return 'Error: Div by 0';
      if (isNaN(result)) return 'Error';
      return result;
    }
    return 'Error';
  } catch(e) {
    return 'Error';
  }
}

window.pressSciKey = function(key) {
  if (!appState.sciExpression) appState.sciExpression = '';
  
  const screenExpr = document.getElementById('sci-expr-display');
  const screenResult = document.getElementById('sci-res-display');
  
  if (key === 'C') {
    appState.sciExpression = '';
  } else if (key === 'back') {
    appState.sciExpression = appState.sciExpression.slice(0, -1);
  } else if (key === '=') {
    const result = evaluateSciExpression(appState.sciExpression);
    if (screenResult) screenResult.innerText = result;
    return;
  } else {
    appState.sciExpression += key;
  }
  
  if (screenExpr) screenExpr.value = appState.sciExpression;
  if (screenResult && key !== '=') {
    const cleanExpr = appState.sciExpression.trim();
    if (cleanExpr === '') {
      screenResult.innerText = '0';
    } else {
      const live = evaluateSciExpression(cleanExpr);
      if (live !== 'Error') {
        screenResult.innerText = live;
      }
    }
  }
};

function generateScientificCalc(resetExpression = false) {
  const preview = document.getElementById('generator-preview-mount');
  if (!preview) return;
  if (resetExpression || typeof appState.sciExpression !== 'string') appState.sciExpression = '';
  const currentResult = appState.sciExpression ? evaluateSciExpression(appState.sciExpression) : '0';
  
  preview.innerHTML = `
    <div style="width: 100%; max-width: 440px; margin: 0 auto; background: var(--color-surface); border: 1px solid var(--color-border); border-radius: var(--radius-lg); padding: 15px; box-shadow: 0 10px 25px -5px rgba(0, 0, 0, 0.1);">
      <div style="background: rgba(0,0,0,0.03); border-radius: var(--radius-md); padding: 12px; text-align: right; margin-bottom: 15px; border: 1px solid var(--color-border);">
        <input type="text" id="sci-expr-display" value="${escapeHTML(appState.sciExpression)}" readonly aria-label="Scientific calculator expression" style="width:100%; border:none; outline:none; background:transparent; font-family:var(--font-mono); font-size:14px; text-align:right; color:var(--color-text-secondary);" placeholder="0">
        <div id="sci-res-display" aria-live="polite" style="font-family:var(--font-mono); font-size:24px; font-weight:800; color:var(--color-text-primary); margin-top:5px; overflow-x:auto; white-space:nowrap;">${escapeHTML(currentResult)}</div>
      </div>
      
      <div style="display: grid; grid-template-columns: repeat(5, 1fr); gap: 6px;">
        <button class="preset-btn" style="padding:10px 4px; font-size:11px; font-weight:700;" onclick="pressSciKey('sin(')">sin</button>
        <button class="preset-btn" style="padding:10px 4px; font-size:11px; font-weight:700;" onclick="pressSciKey('cos(')">cos</button>
        <button class="preset-btn" style="padding:10px 4px; font-size:11px; font-weight:700;" onclick="pressSciKey('tan(')">tan</button>
        <button class="preset-btn" style="padding:10px 4px; font-size:11px; font-weight:700;" onclick="pressSciKey('π')">π</button>
        <button class="preset-btn" style="padding:10px 4px; font-size:11px; font-weight:700; color:var(--color-primary);" onclick="pressSciKey('C')">C</button>
        
        <button class="preset-btn" style="padding:10px 4px; font-size:11px; font-weight:700;" onclick="pressSciKey('asin(')">asin</button>
        <button class="preset-btn" style="padding:10px 4px; font-size:11px; font-weight:700;" onclick="pressSciKey('acos(')">acos</button>
        <button class="preset-btn" style="padding:10px 4px; font-size:11px; font-weight:700;" onclick="pressSciKey('atan(')">atan</button>
        <button class="preset-btn" style="padding:10px 4px; font-size:11px; font-weight:700;" onclick="pressSciKey('e')">e</button>
        <button class="preset-btn" style="padding:10px 4px; font-size:11px; font-weight:700; display:flex; align-items:center; justify-content:center;" onclick="pressSciKey('back')"><i data-lucide="delete" style="width:14px;"></i></button>
        
        <button class="preset-btn" style="padding:10px 4px; font-size:11px; font-weight:700;" onclick="pressSciKey('log(')">log</button>
        <button class="preset-btn" style="padding:10px 4px; font-size:11px; font-weight:700;" onclick="pressSciKey('ln(')">ln</button>
        <button class="preset-btn" style="padding:10px 4px; font-size:11px; font-weight:700;" onclick="pressSciKey('sqrt(')">√</button>
        <button class="preset-btn" style="padding:10px 4px; font-size:11px; font-weight:700;" onclick="pressSciKey('^')">x^y</button>
        <button class="preset-btn" style="padding:10px 4px; font-size:11px; font-weight:700; color:var(--color-accent);" onclick="pressSciKey('/')">/</button>
        
        <button class="preset-btn" style="padding:10px 4px; font-size:12px; font-weight:700;" onclick="pressSciKey('7')">7</button>
        <button class="preset-btn" style="padding:10px 4px; font-size:12px; font-weight:700;" onclick="pressSciKey('8')">8</button>
        <button class="preset-btn" style="padding:10px 4px; font-size:12px; font-weight:700;" onclick="pressSciKey('9')">9</button>
        <button class="preset-btn" style="padding:10px 4px; font-size:12px; font-weight:700;" onclick="pressSciKey('(')">(</button>
        <button class="preset-btn" style="padding:10px 4px; font-size:12px; font-weight:700; color:var(--color-accent);" onclick="pressSciKey('*')">×</button>
        
        <button class="preset-btn" style="padding:10px 4px; font-size:12px; font-weight:700;" onclick="pressSciKey('4')">4</button>
        <button class="preset-btn" style="padding:10px 4px; font-size:12px; font-weight:700;" onclick="pressSciKey('5')">5</button>
        <button class="preset-btn" style="padding:10px 4px; font-size:12px; font-weight:700;" onclick="pressSciKey('6')">6</button>
        <button class="preset-btn" style="padding:10px 4px; font-size:12px; font-weight:700;" onclick="pressSciKey(')')">)</button>
        <button class="preset-btn" style="padding:10px 4px; font-size:12px; font-weight:700; color:var(--color-accent);" onclick="pressSciKey('-')">-</button>
        
        <button class="preset-btn" style="padding:10px 4px; font-size:12px; font-weight:700;" onclick="pressSciKey('1')">1</button>
        <button class="preset-btn" style="padding:10px 4px; font-size:12px; font-weight:700;" onclick="pressSciKey('2')">2</button>
        <button class="preset-btn" style="padding:10px 4px; font-size:12px; font-weight:700;" onclick="pressSciKey('3')">3</button>
        <button class="preset-btn" style="padding:10px 4px; font-size:12px; font-weight:700;" onclick="pressSciKey('.')">.</button>
        <button class="preset-btn" style="padding:10px 4px; font-size:12px; font-weight:700; color:var(--color-accent);" onclick="pressSciKey('+')">+</button>
        
        <button class="preset-btn" style="padding:10px 4px; font-size:12px; font-weight:700; grid-column: span 2;" onclick="pressSciKey('0')">0</button>
        <button class="btn btn-primary" style="padding:10px 4px; font-size:12px; font-weight:800; grid-column: span 3;" onclick="pressSciKey('=')">=</button>
      </div>
    </div>
  `;
  lucide.createIcons();
}

function generatePercentageCalc() {
  const hasInput = ['opt-pct-val1', 'opt-pct-val2', 'opt-pct-a', 'opt-pct-b', 'opt-pct-from', 'opt-pct-to']
    .some(id => document.getElementById(id)?.value !== '');
  const val1 = parseFloat(document.getElementById('opt-pct-val1').value) || 0;
  const val2 = parseFloat(document.getElementById('opt-pct-val2').value) || 0;
  const a = parseFloat(document.getElementById('opt-pct-a').value) || 0;
  const b = parseFloat(document.getElementById('opt-pct-b').value) || 1;
  const from = parseFloat(document.getElementById('opt-pct-from').value) || 0;
  const to = parseFloat(document.getElementById('opt-pct-to').value) || 0;
  
  const preview = document.getElementById('generator-preview-mount');
  if (!preview) return;
  if (!hasInput) {
    preview.innerHTML = '<div class="calculator-empty-state">Enter values for any percentage calculation, then select Calculate.</div>';
    return;
  }
  
  const res1 = (val1 / 100) * val2;
  const res2 = (a / b) * 100;
  const res3 = from !== 0 ? ((to - from) / from) * 100 : 0;
  
  preview.innerHTML = `
    <div style="width:100%; text-align:left; display:block; font-size:13px; line-height:1.6;">
      <h5 style="font-weight:700; margin-bottom:12px; text-align:center;">Percentage Calculations</h5>
      <div style="background:var(--color-surface); border:1px solid var(--color-border); padding:12px; border-radius:8px; margin-bottom:10px;">
        <strong>1. What is ${val1}% of ${val2}?</strong>
        <div style="font-size:18px; font-weight:800; color:var(--color-primary); margin-top:4px;">Result: ${res1.toFixed(4).replace(/\.?0+$/, "")}</div>
      </div>
      <div style="background:var(--color-surface); border:1px solid var(--color-border); padding:12px; border-radius:8px; margin-bottom:10px;">
        <strong>2. ${a} is what percent of ${b}?</strong>
        <div style="font-size:18px; font-weight:800; color:var(--color-primary); margin-top:4px;">Result: ${res2.toFixed(4).replace(/\.?0+$/, "")}%</div>
      </div>
      <div style="background:var(--color-surface); border:1px solid var(--color-border); padding:12px; border-radius:8px;">
        <strong>3. Percentage Change from ${from} to ${to}:</strong>
        <div style="font-size:18px; font-weight:800; color:${res3 >= 0 ? 'var(--color-accent)' : 'var(--color-danger)'}; margin-top:4px;">
          Result: ${res3 >= 0 ? '+' : ''}${res3.toFixed(4).replace(/\.?0+$/, "")}% ${res3 >= 0 ? '(Increase)' : '(Decrease)'}
        </div>
      </div>
    </div>
  `;
}

function generateAgeCalc() {
  const dobVal = document.getElementById('opt-age-dob').value;
  const targetVal = document.getElementById('opt-age-target').value;
  const preview = document.getElementById('generator-preview-mount');
  if (!preview) return;
  
  if (!dobVal) {
    preview.innerHTML = `<div style="color:var(--color-text-secondary); font-size:13px; text-align:center;">Please select date of birth in configuration.</div>`;
    return;
  }
  
  const birthDate = new Date(dobVal);
  const targetDate = targetVal ? new Date(targetVal) : new Date();
  
  if (targetDate < birthDate) {
    preview.innerHTML = `<div style="color:var(--color-danger); font-size:13px; text-align:center;">Target date cannot be earlier than birth date.</div>`;
    return;
  }
  
  let years = targetDate.getFullYear() - birthDate.getFullYear();
  let months = targetDate.getMonth() - birthDate.getMonth();
  let days = targetDate.getDate() - birthDate.getDate();
  
  if (days < 0) {
    months--;
    const prevMonth = new Date(targetDate.getFullYear(), targetDate.getMonth(), 0);
    days += prevMonth.getDate();
  }
  if (months < 0) {
    years--;
    months += 12;
  }
  
  const diffMs = targetDate - birthDate;
  const totalSeconds = Math.floor(diffMs / 1000);
  const totalMinutes = Math.floor(totalSeconds / 60);
  const totalHours = Math.floor(totalMinutes / 60);
  const totalDays = Math.floor(totalHours / 24);
  const totalWeeks = Math.floor(totalDays / 7);
  const totalMonths = (years * 12) + months;
  
  const nextBday = new Date(targetDate.getFullYear(), birthDate.getMonth(), birthDate.getDate());
  if (nextBday < targetDate) {
    nextBday.setFullYear(targetDate.getFullYear() + 1);
  }
  const nextBdayDiff = nextBday - targetDate;
  const nextBdayDays = Math.ceil(nextBdayDiff / (1000 * 60 * 60 * 24));
  const nextBdayMonths = Math.floor(nextBdayDays / 30.4375);
  const nextBdayDaysRem = Math.floor(nextBdayDays % 30.4375);
  const nextBdayWeekday = nextBday.toLocaleDateString('en-US', { weekday: 'long' });
  
  preview.innerHTML = `
    <div style="width:100%; text-align:left; display:block; font-size:13px; line-height:1.5;">
      <h5 style="font-weight:700; margin-bottom:12px; text-align:center;">Detailed Age Analysis</h5>
      
      <div style="display:flex; justify-content:center; gap:12px; margin-bottom:15px; text-align:center;">
        <div style="background:var(--color-surface); border:1px solid var(--color-border); padding:12px; border-radius:8px; min-width:80px; flex:1;">
          <div style="font-size:24px; font-weight:800; color:var(--color-primary);">${years}</div>
          <div style="font-size:11px; color:var(--color-text-secondary); font-weight:600;">Years</div>
        </div>
        <div style="background:var(--color-surface); border:1px solid var(--color-border); padding:12px; border-radius:8px; min-width:80px; flex:1;">
          <div style="font-size:24px; font-weight:800; color:var(--color-primary);">${months}</div>
          <div style="font-size:11px; color:var(--color-text-secondary); font-weight:600;">Months</div>
        </div>
        <div style="background:var(--color-surface); border:1px solid var(--color-border); padding:12px; border-radius:8px; min-width:80px; flex:1;">
          <div style="font-size:24px; font-weight:800; color:var(--color-primary);">${days}</div>
          <div style="font-size:11px; color:var(--color-text-secondary); font-weight:600;">Days</div>
        </div>
      </div>
      
      <div style="background:var(--color-surface); border:1px solid var(--color-border); padding:12px; border-radius:8px; margin-bottom:15px;">
        <strong style="display:block; margin-bottom:4px; font-size:12px; text-transform:uppercase; color:var(--color-text-secondary);">Next Birthday</strong>
        <div style="font-size:15px; font-weight:700;">In ${nextBdayMonths} Months, ${nextBdayDaysRem} Days</div>
        <div style="font-size:11px; color:var(--color-text-muted); margin-top:2px;">Will be on a <strong>${nextBdayWeekday}</strong></div>
      </div>
      
      <h6 style="font-weight:700; margin-bottom:8px; font-size:12px; text-transform:uppercase; color:var(--color-text-secondary);">Cumulative Totals</h6>
      <table style="width:100%; border-collapse:collapse; font-size:12px;">
        <tr style="border-bottom:1px solid var(--color-border);"><td style="padding:4px 0;">Total Months:</td><td style="text-align:right; font-weight:600;">${numberWithCommas(totalMonths)} months</td></tr>
        <tr style="border-bottom:1px solid var(--color-border);"><td style="padding:4px 0;">Total Weeks:</td><td style="text-align:right; font-weight:600;">${numberWithCommas(totalWeeks)} weeks</td></tr>
        <tr style="border-bottom:1px solid var(--color-border);"><td style="padding:4px 0;">Total Days:</td><td style="text-align:right; font-weight:600;">${numberWithCommas(totalDays)} days</td></tr>
        <tr style="border-bottom:1px solid var(--color-border);"><td style="padding:4px 0;">Total Hours:</td><td style="text-align:right; font-weight:600;">${numberWithCommas(totalHours)} hours</td></tr>
        <tr style="border-bottom:1px solid var(--color-border);"><td style="padding:4px 0;">Total Minutes:</td><td style="text-align:right; font-weight:600;">${numberWithCommas(totalMinutes)} minutes</td></tr>
        <tr><td style="padding:4px 0;">Total Seconds:</td><td style="text-align:right; font-weight:600;">${numberWithCommas(totalSeconds)} seconds</td></tr>
      </table>
    </div>
  `;
}

function generateDateCalc() {
  const startVal = document.getElementById('opt-date-start').value;
  const mode = document.getElementById('opt-date-mode').value;
  const preview = document.getElementById('generator-preview-mount');
  if (!preview) return;
  
  if (!startVal) {
    preview.innerHTML = `<div style="color:var(--color-text-secondary); font-size:13px; text-align:center;">Please select start date in configuration.</div>`;
    return;
  }
  
  const startDate = new Date(startVal);
  
  if (mode === 'duration') {
    const endVal = document.getElementById('opt-date-end').value;
    if (!endVal) {
      preview.innerHTML = `<div style="color:var(--color-text-secondary); font-size:13px; text-align:center;">Please select end date in configuration.</div>`;
      return;
    }
    const endDate = new Date(endVal);
    const diffMs = endDate - startDate;
    const totalDays = Math.ceil(diffMs / (1000 * 60 * 60 * 24));
    
    let y = endDate.getFullYear() - startDate.getFullYear();
    let m = endDate.getMonth() - startDate.getMonth();
    let d = endDate.getDate() - startDate.getDate();
    
    if (d < 0) {
      m--;
      const prev = new Date(endDate.getFullYear(), endDate.getMonth(), 0);
      d += prev.getDate();
    }
    if (m < 0) {
      y--;
      m += 12;
    }
    
    const absDays = Math.abs(totalDays);
    const isPast = totalDays < 0;
    
    preview.innerHTML = `
      <div style="width:100%; text-align:left; display:block; font-size:13px; line-height:1.5;">
        <h5 style="font-weight:700; margin-bottom:12px; text-align:center;">Duration Result</h5>
        <div style="background:var(--color-surface); border:1px solid var(--color-border); padding:15px; border-radius:8px; text-align:center; margin-bottom:12px;">
          <div style="font-size:28px; font-weight:800; color:var(--color-primary);">${numberWithCommas(absDays)} Days</div>
          <div style="font-size:12px; color:var(--color-text-secondary); margin-top:4px;">${isPast ? 'in the past' : 'difference'}</div>
        </div>
        <h6 style="font-weight:700; margin-bottom:6px; font-size:12px; text-transform:uppercase; color:var(--color-text-secondary);">Relative Breakdown</h6>
        <p><strong>${Math.abs(y)} Years, ${Math.abs(m)} Months, ${Math.abs(d)} Days</strong></p>
      </div>
    `;
  } else {
    const offset = parseInt(document.getElementById('opt-date-offset').value) || 0;
    const unit = document.getElementById('opt-date-unit').value;
    const resultDate = new Date(startDate);
    const multiplier = mode === 'add' ? 1 : -1;
    const val = offset * multiplier;
    
    if (unit === 'days') {
      resultDate.setDate(startDate.getDate() + val);
    } else if (unit === 'weeks') {
      resultDate.setDate(startDate.getDate() + (val * 7));
    } else if (unit === 'months') {
      resultDate.setMonth(startDate.getMonth() + val);
    } else if (unit === 'years') {
      resultDate.setFullYear(startDate.getFullYear() + val);
    }
    
    const formattedDate = resultDate.toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });
    
    preview.innerHTML = `
      <div style="width:100%; text-align:left; display:block; font-size:13px; line-height:1.5;">
        <h5 style="font-weight:700; margin-bottom:12px; text-align:center;">Offset Date Result</h5>
        <div style="background:var(--color-surface); border:1px solid var(--color-border); padding:15px; border-radius:8px; text-align:center;">
          <div style="font-size:12px; color:var(--color-text-secondary); margin-bottom:6px;">Resulting Date:</div>
          <div style="font-size:18px; font-weight:800; color:var(--color-accent);">${formattedDate}</div>
        </div>
      </div>
    `;
  }
}

function generateEMICalc() {
  const p = parseFloat(document.getElementById('opt-emi-amount').value) || 0;
  const annualRate = parseFloat(document.getElementById('opt-emi-rate').value) || 0;
  const years = parseFloat(document.getElementById('opt-emi-years').value) || 0;
  const preview = document.getElementById('generator-preview-mount');
  if (!preview) return;
  
  if (p <= 0 || annualRate <= 0 || years <= 0) {
    preview.innerHTML = `<div style="color:var(--color-text-secondary); font-size:13px; text-align:center;">Enter loan details to view EMI breakdown.</div>`;
    return;
  }
  
  const r = annualRate / 12 / 100;
  const n = years * 12;
  const emi = p * r * Math.pow(1+r, n) / (Math.pow(1+r, n) - 1);
  const totalPay = emi * n;
  const totalInt = totalPay - p;
  const intPct = (totalInt / totalPay) * 100;
  const princPct = 100 - intPct;
  
  preview.innerHTML = `
    <div style="width:100%; text-align:left; display:block; font-size:13px; line-height:1.5;">
      <h5 style="font-weight:700; margin-bottom:12px; text-align:center;">EMI Amortization Summary</h5>
      
      <div style="text-align:center; margin-bottom:15px;">
        <div style="font-size:12px; color:var(--color-text-secondary);">Monthly EMI Repayment</div>
        <div style="font-size:26px; font-weight:800; color:var(--color-primary);">₹${numberWithCommas(emi.toFixed(0))}</div>
      </div>
      
      <table style="width:100%; border-collapse:collapse; font-size:12px; margin-bottom:15px;">
        <tr style="border-bottom:1px solid var(--color-border);"><td style="padding:6px 0;">Principal Amount:</td><td style="text-align:right; font-weight:600;">₹${numberWithCommas(p.toFixed(0))}</td></tr>
        <tr style="border-bottom:1px solid var(--color-border);"><td style="padding:6px 0;">Total Interest:</td><td style="text-align:right; font-weight:600; color:var(--color-accent);">₹${numberWithCommas(totalInt.toFixed(0))}</td></tr>
        <tr style="font-weight:700;"><td style="padding:6px 0;">Total Amount Paid:</td><td style="text-align:right;">₹${numberWithCommas(totalPay.toFixed(0))}</td></tr>
      </table>
      
      <div style="font-size:11px; font-weight:600; margin-bottom:6px; display:flex; justify-content:space-between;">
        <span>Principal (${princPct.toFixed(1)}%)</span>
        <span>Interest (${intPct.toFixed(1)}%)</span>
      </div>
      <div style="height:8px; border-radius:4px; overflow:hidden; background:#e2e8f0; display:flex;">
        <div style="width:${princPct}%; background:var(--color-primary); height:100%;"></div>
        <div style="width:${intPct}%; background:var(--color-accent); height:100%;"></div>
      </div>
    </div>
  `;
}

function generateLoanCalc() {
  const p = parseFloat(document.getElementById('opt-loan-amount').value) || 0;
  const annualRate = parseFloat(document.getElementById('opt-loan-rate').value) || 0;
  const months = parseInt(document.getElementById('opt-loan-months').value) || 0;
  const type = document.getElementById('opt-loan-type').value;
  const preview = document.getElementById('generator-preview-mount');
  if (!preview) return;
  
  if (p <= 0 || annualRate <= 0 || months <= 0) {
    preview.innerHTML = `<div style="color:var(--color-text-secondary); font-size:13px; text-align:center;">Enter details to view loan calculation.</div>`;
    return;
  }
  
  let monthlyPayment = 0;
  let totalInterest = 0;
  let totalPayment = 0;
  const schedule = [];
  
  if (type === 'flat') {
    const rateFraction = annualRate / 100;
    const years = months / 12;
    totalInterest = p * rateFraction * years;
    totalPayment = p + totalInterest;
    monthlyPayment = totalPayment / months;
    
    let balance = p;
    const principalPerMonth = p / months;
    const interestPerMonth = totalInterest / months;
    
    for (let i = 1; i <= months; i++) {
      balance -= principalPerMonth;
      schedule.push({
        month: i,
        payment: monthlyPayment,
        principal: principalPerMonth,
        interest: interestPerMonth,
        balance: Math.max(0, balance)
      });
    }
  } else {
    const r = annualRate / 12 / 100;
    monthlyPayment = p * r * Math.pow(1+r, months) / (Math.pow(1+r, months) - 1);
    totalPayment = monthlyPayment * months;
    totalInterest = totalPayment - p;
    
    let balance = p;
    for (let i = 1; i <= months; i++) {
      const interest = balance * r;
      const principal = monthlyPayment - interest;
      balance -= principal;
      schedule.push({
        month: i,
        payment: monthlyPayment,
        principal: principal,
        interest: interest,
        balance: Math.max(0, balance)
      });
    }
  }
  
  let tableRows = '';
  schedule.forEach(row => {
    tableRows += `
      <tr style="border-bottom:1px solid var(--color-border); font-size:11px;">
        <td style="padding:5px 0; text-align:center;">${row.month}</td>
        <td style="text-align:right;">₹${numberWithCommas(row.payment.toFixed(0))}</td>
        <td style="text-align:right;">₹${numberWithCommas(row.principal.toFixed(0))}</td>
        <td style="text-align:right; color:var(--color-accent);">₹${numberWithCommas(row.interest.toFixed(0))}</td>
        <td style="text-align:right;">₹${numberWithCommas(row.balance.toFixed(0))}</td>
      </tr>
    `;
  });
  
  preview.innerHTML = `
    <div style="width:100%; text-align:left; display:block; font-size:13px; line-height:1.5;">
      <h5 style="font-weight:700; margin-bottom:10px; text-align:center;">Loan Repayment Summary</h5>
      
      <div style="display:grid; grid-template-columns:1fr 1fr; gap:10px; text-align:center; margin-bottom:12px;">
        <div style="background:var(--color-surface); padding:8px; border:1px solid var(--color-border); border-radius:6px;">
          <div style="font-size:11px; color:var(--color-text-secondary);">Monthly Payment</div>
          <div style="font-size:16px; font-weight:800; color:var(--color-primary);">₹${numberWithCommas(monthlyPayment.toFixed(0))}</div>
        </div>
        <div style="background:var(--color-surface); padding:8px; border:1px solid var(--color-border); border-radius:6px;">
          <div style="font-size:11px; color:var(--color-text-secondary);">Total Interest</div>
          <div style="font-size:16px; font-weight:800; color:var(--color-accent);">₹${numberWithCommas(totalInterest.toFixed(0))}</div>
        </div>
      </div>
      
      <h6 style="font-weight:700; margin-bottom:6px; font-size:12px; text-transform:uppercase; color:var(--color-text-secondary);">Amortization Schedule</h6>
      <div style="max-height:150px; overflow-y:auto; border:1px solid var(--color-border); border-radius:6px; padding:0 8px; background:var(--color-surface);">
        <table style="width:100%; border-collapse:collapse;">
          <thead>
            <tr style="border-bottom:2px solid var(--color-border); font-size:10px; text-transform:uppercase; color:var(--color-text-secondary);">
              <th style="padding:6px 0; text-align:center;">Month</th>
              <th style="text-align:right;">Repayment</th>
              <th style="text-align:right;">Principal</th>
              <th style="text-align:right;">Interest</th>
              <th style="text-align:right;">Balance</th>
            </tr>
          </thead>
          <tbody>
            ${tableRows}
          </tbody>
        </table>
      </div>
    </div>
  `;
}

function generateInterestCalc() {
  const p = parseFloat(document.getElementById('opt-int-principal').value) || 0;
  const r = parseFloat(document.getElementById('opt-int-rate').value) || 0;
  const t = parseFloat(document.getElementById('opt-int-years').value) || 0;
  const type = document.getElementById('opt-int-type').value;
  const preview = document.getElementById('generator-preview-mount');
  if (!preview) return;
  
  if (p <= 0 || r <= 0 || t <= 0) {
    preview.innerHTML = `<div style="color:var(--color-text-secondary); font-size:13px; text-align:center;">Enter details to view interest calculation.</div>`;
    return;
  }
  
  let total = 0;
  let interest = 0;
  let compoundingFreqStr = 'Simple Interest';
  
  if (type === 'simple') {
    interest = (p * r * t) / 100;
    total = p + interest;
  } else {
    let n = 1;
    if (type === 'compound-yearly') { n = 1; compoundingFreqStr = 'Compounded Yearly'; }
    else if (type === 'compound-half') { n = 2; compoundingFreqStr = 'Compounded Half-Yearly'; }
    else if (type === 'compound-quarterly') { n = 4; compoundingFreqStr = 'Compounded Quarterly'; }
    else if (type === 'compound-monthly') { n = 12; compoundingFreqStr = 'Compounded Monthly'; }
    
    total = p * Math.pow(1 + (r / (n * 100)), n * t);
    interest = total - p;
  }
  
  preview.innerHTML = `
    <div style="width:100%; text-align:left; display:block; font-size:13px; line-height:1.5;">
      <h5 style="font-weight:700; margin-bottom:12px; text-align:center;">Interest Calculation Results</h5>
      <div style="background:var(--color-surface); padding:12px; border:1px solid var(--color-border); border-radius:6px; margin-bottom:12px; text-align:center;">
        <div style="font-size:11px; color:var(--color-text-secondary); font-weight:600; text-transform:uppercase;">Interest Earnings (${compoundingFreqStr})</div>
        <div style="font-size:24px; font-weight:800; color:var(--color-accent); margin-top:2px;">₹${numberWithCommas(interest.toFixed(2))}</div>
      </div>
      
      <table style="width:100%; border-collapse:collapse; font-size:12px;">
        <tr style="border-bottom:1px solid var(--color-border);"><td style="padding:6px 0;">Principal Amount:</td><td style="text-align:right; font-weight:600;">₹${numberWithCommas(p.toFixed(2))}</td></tr>
        <tr style="border-bottom:1px solid var(--color-border);"><td style="padding:6px 0;">Accumulated Interest:</td><td style="text-align:right; font-weight:600; color:var(--color-accent);">₹${numberWithCommas(interest.toFixed(2))}</td></tr>
        <tr style="font-weight:700;"><td style="padding:6px 0;">Maturity Amount:</td><td style="text-align:right; font-size:13px; color:var(--color-primary);">₹${numberWithCommas(total.toFixed(2))}</td></tr>
      </table>
    </div>
  `;
}

window.setGstMode = function(mode, btn) {
  appState.activeToolOptions.gstMode = mode;
  const addBtn = document.getElementById('gst-add-btn');
  const subBtn = document.getElementById('gst-sub-btn');
  if (addBtn && subBtn) {
    addBtn.classList.remove('active');
    subBtn.classList.remove('active');
    btn.classList.add('active');
  }
  generateGstCalc();
};

function generateGstCalc() {
  const p = parseFloat(document.getElementById('opt-gst-amount').value) || 0;
  const rate = parseFloat(document.getElementById('opt-gst-rate').value) || 0;
  const mode = appState.activeToolOptions.gstMode || 'add';
  const preview = document.getElementById('generator-preview-mount');
  if (!preview) return;
  
  if (p <= 0 || rate <= 0) {
    preview.innerHTML = `<div style="color:var(--color-text-secondary); font-size:13px; text-align:center;">Enter amount to view GST split.</div>`;
    return;
  }
  
  let netPrice = 0;
  let grossPrice = 0;
  let gstAmount = 0;
  
  if (mode === 'add') {
    netPrice = p;
    gstAmount = (p * rate) / 100;
    grossPrice = p + gstAmount;
  } else {
    grossPrice = p;
    netPrice = p / (1 + (rate / 100));
    gstAmount = p - netPrice;
  }
  
  const cgst = gstAmount / 2;
  const sgst = gstAmount / 2;
  
  preview.innerHTML = `
    <div style="width:100%; text-align:left; display:block; font-size:13px; line-height:1.5;">
      <h5 style="font-weight:700; margin-bottom:12px; text-align:center;">GST Invoice Breakdown</h5>
      
      <div style="background:var(--color-surface); padding:12px; border:1px solid var(--color-border); border-radius:6px; margin-bottom:12px; text-align:center;">
        <div style="font-size:11px; color:var(--color-text-secondary); font-weight:600;">Total Tax Amount</div>
        <div style="font-size:24px; font-weight:800; color:var(--color-accent); margin-top:2px;">₹${numberWithCommas(gstAmount.toFixed(2))}</div>
      </div>
      
      <table style="width:100%; border-collapse:collapse; font-size:12px;">
        <tr style="border-bottom:1px solid var(--color-border);"><td style="padding:5px 0;">Net Price (Without Tax):</td><td style="text-align:right; font-weight:600;">₹${numberWithCommas(netPrice.toFixed(2))}</td></tr>
        <tr style="border-bottom:1px solid var(--color-border);"><td style="padding:5px 0;">CGST (Central Tax - ${rate/2}%):</td><td style="text-align:right; color:var(--color-text-secondary);">₹${numberWithCommas(cgst.toFixed(2))}</td></tr>
        <tr style="border-bottom:1px solid var(--color-border);"><td style="padding:5px 0;">SGST (State Tax - ${rate/2}%):</td><td style="text-align:right; color:var(--color-text-secondary);">₹${numberWithCommas(sgst.toFixed(2))}</td></tr>
        <tr style="border-bottom:1px solid var(--color-border);"><td style="padding:5px 0;">Total GST (${rate}%):</td><td style="text-align:right; color:var(--color-accent); font-weight:600;">₹${numberWithCommas(gstAmount.toFixed(2))}</td></tr>
        <tr style="font-weight:700;"><td style="padding:6px 0;">Gross Price (With Tax):</td><td style="text-align:right; font-size:13px; color:var(--color-primary);">₹${numberWithCommas(grossPrice.toFixed(2))}</td></tr>
      </table>
    </div>
  `;
}

function generateSipCalc() {
  const p = parseFloat(document.getElementById('opt-sip-monthly').value) || 0;
  const annualRate = parseFloat(document.getElementById('opt-sip-rate').value) || 0;
  const years = parseFloat(document.getElementById('opt-sip-years').value) || 0;
  const preview = document.getElementById('generator-preview-mount');
  if (!preview) return;
  
  if (p <= 0 || annualRate <= 0 || years <= 0) {
    preview.innerHTML = `<div style="color:var(--color-text-secondary); font-size:13px; text-align:center;">Enter investment details to view projections.</div>`;
    return;
  }
  
  const r = annualRate / 12 / 100;
  const m = years * 12;
  const totalInvested = p * m;
  const futureValue = p * ((Math.pow(1 + r, m) - 1) / r) * (1 + r);
  const returns = futureValue - totalInvested;
  
  const investPct = (totalInvested / futureValue) * 100;
  const returnPct = 100 - investPct;
  
  preview.innerHTML = `
    <div style="width:100%; text-align:left; display:block; font-size:13px; line-height:1.5;">
      <h5 style="font-weight:700; margin-bottom:12px; text-align:center;">Future Wealth Projections</h5>
      
      <div style="text-align:center; margin-bottom:15px;">
        <div style="font-size:12px; color:var(--color-text-secondary);">Estimated Future Value</div>
        <div style="font-size:26px; font-weight:800; color:var(--color-accent);">₹${numberWithCommas(futureValue.toFixed(0))}</div>
      </div>
      
      <table style="width:100%; border-collapse:collapse; font-size:12px; margin-bottom:15px;">
        <tr style="border-bottom:1px solid var(--color-border);"><td style="padding:6px 0;">Total Invested Amount:</td><td style="text-align:right; font-weight:600;">₹${numberWithCommas(totalInvested.toFixed(0))}</td></tr>
        <tr style="border-bottom:1px solid var(--color-border);"><td style="padding:6px 0;">Estimated Returns:</td><td style="text-align:right; font-weight:600; color:var(--color-primary);">₹${numberWithCommas(returns.toFixed(0))}</td></tr>
        <tr style="font-weight:700;"><td style="padding:6px 0;">Total Future Wealth:</td><td style="text-align:right;">₹${numberWithCommas(futureValue.toFixed(0))}</td></tr>
      </table>
      
      <div style="font-size:11px; font-weight:600; margin-bottom:6px; display:flex; justify-content:space-between;">
        <span>Invested Amount (${investPct.toFixed(1)}%)</span>
        <span>Est. Wealth Gain (${returnPct.toFixed(1)}%)</span>
      </div>
      <div style="height:8px; border-radius:4px; overflow:hidden; background:#e2e8f0; display:flex;">
        <div style="width:${investPct}%; background:var(--color-primary); height:100%;"></div>
        <div style="width:${returnPct}%; background:var(--color-accent); height:100%;"></div>
      </div>
    </div>
  `;
}

function generateBmiCalc() {
  const units = document.getElementById('opt-bmi-units').value;
  const w = parseFloat(document.getElementById('opt-bmi-weight').value) || 0;
  const h = parseFloat(document.getElementById('opt-bmi-height').value) || 0;
  const preview = document.getElementById('generator-preview-mount');
  if (!preview) return;
  
  if (w <= 0 || h <= 0) {
    preview.innerHTML = `<div style="color:var(--color-text-secondary); font-size:13px; text-align:center;">Enter height and weight details to view BMI.</div>`;
    return;
  }
  
  let bmi = 0;
  if (units === 'metric') {
    bmi = w / Math.pow(h / 100, 2);
  } else {
    bmi = (w / Math.pow(h, 2)) * 703;
  }
  
  let status = 'Normal';
  let color = '#10B981';
  let scorePos = 0;
  
  if (bmi < 18.5) {
    status = 'Underweight';
    color = '#F59E0B';
    scorePos = Math.max(5, ((bmi / 18.5) * 25));
  } else if (bmi <= 24.9) {
    status = 'Healthy Weight';
    color = '#10B981';
    scorePos = 25 + (((bmi - 18.5) / 6.4) * 25);
  } else if (bmi <= 29.9) {
    status = 'Overweight';
    color = '#F59E0B';
    scorePos = 50 + (((bmi - 25) / 4.9) * 25);
  } else {
    status = 'Obese';
    color = '#EF4444';
    scorePos = Math.min(95, 75 + (((bmi - 30) / 10) * 25));
  }
  
  preview.innerHTML = `
    <div style="width:100%; text-align:left; display:block; font-size:13px; line-height:1.5;">
      <h5 style="font-weight:700; margin-bottom:12px; text-align:center;">Body Mass Index (BMI) Report</h5>
      
      <div style="text-align:center; margin-bottom:15px; padding:10px; background:var(--color-surface); border:1px solid var(--color-border); border-radius:8px;">
        <div style="font-size:12px; color:var(--color-text-secondary);">Your Calculated BMI</div>
        <div style="font-size:32px; font-weight:800; color:${color};">${bmi.toFixed(1)}</div>
        <div style="font-size:14px; font-weight:700; color:${color}; margin-top:2px;">Category: ${status}</div>
      </div>
      
      <div style="position:relative; margin:20px 0 10px; padding-top:10px;">
        <div style="position:absolute; top:-12px; left:${scorePos}%; transform:translateX(-50%); width:0; height:0; border-left:6px solid transparent; border-right:6px solid transparent; border-bottom:8px solid var(--color-text-primary);"></div>
        <div style="height:12px; border-radius:6px; background:linear-gradient(to right, #F59E0B 0%, #F59E0B 25%, #10B981 25%, #10B981 50%, #F59E0B 50%, #F59E0B 75%, #EF4444 75%, #EF4444 100%);"></div>
        <div style="display:flex; justify-content:space-between; font-size:10px; color:var(--color-text-secondary); margin-top:4px; font-weight:600;">
          <span>15.0</span>
          <span>18.5 (Normal)</span>
          <span>25.0 (Over)</span>
          <span>30.0 (Obese)</span>
          <span>40.0</span>
        </div>
      </div>
    </div>
  `;
}

function generateDiscountCalc() {
  const p = parseFloat(document.getElementById('opt-disc-price').value) || 0;
  const d1 = parseFloat(document.getElementById('opt-disc-pct').value) || 0;
  const d2 = parseFloat(document.getElementById('opt-disc-add').value) || 0;
  const t = parseFloat(document.getElementById('opt-disc-tax').value) || 0;
  const preview = document.getElementById('generator-preview-mount');
  if (!preview) return;
  
  if (p <= 0) {
    preview.innerHTML = `<div style="color:var(--color-text-secondary); font-size:13px; text-align:center;">Enter original price to compute savings.</div>`;
    return;
  }
  
  const p1 = p * (1 - d1/100);
  const p2 = p1 * (1 - d2/100);
  const tax = p2 * (t/100);
  const finalPrice = p2 + tax;
  const savings = p - p2;
  
  preview.innerHTML = `
    <div style="width:100%; text-align:left; display:block; font-size:13px; line-height:1.5;">
      <h5 style="font-weight:700; margin-bottom:12px; text-align:center;">Discount Savings Summary</h5>
      
      <div style="display:grid; grid-template-columns:1fr 1fr; gap:10px; text-align:center; margin-bottom:12px;">
        <div style="background:var(--color-surface); padding:8px; border:1px solid var(--color-border); border-radius:6px;">
          <div style="font-size:11px; color:var(--color-text-secondary);">Final Bill Price</div>
          <div style="font-size:18px; font-weight:800; color:var(--color-primary);">₹${numberWithCommas(finalPrice.toFixed(2))}</div>
        </div>
        <div style="background:var(--color-surface); padding:8px; border:1px solid var(--color-border); border-radius:6px;">
          <div style="font-size:11px; color:var(--color-text-secondary);">Total Cash Savings</div>
          <div style="font-size:18px; font-weight:800; color:var(--color-accent);">₹${numberWithCommas(savings.toFixed(2))}</div>
        </div>
      </div>
      
      <table style="width:100%; border-collapse:collapse; font-size:12px;">
        <tr style="border-bottom:1px solid var(--color-border);"><td style="padding:5px 0;">Original Retail Price:</td><td style="text-align:right; font-weight:600;">₹${numberWithCommas(p.toFixed(2))}</td></tr>
        <tr style="border-bottom:1px solid var(--color-border);"><td style="padding:5px 0;">Primary Discount (${d1}%):</td><td style="text-align:right; color:var(--color-danger);">-₹${numberWithCommas((p - p1).toFixed(2))}</td></tr>
        <tr style="border-bottom:1px solid var(--color-border);"><td style="padding:5px 0;">Additional Discount (${d2}%):</td><td style="text-align:right; color:var(--color-danger);">-₹${numberWithCommas((p1 - p2).toFixed(2))}</td></tr>
        <tr style="border-bottom:1px solid var(--color-border);"><td style="padding:5px 0;">Estimated Sales Tax (${t}%):</td><td style="text-align:right; color:var(--color-text-secondary);">+₹${numberWithCommas(tax.toFixed(2))}</td></tr>
        <tr style="font-weight:700;"><td style="padding:6px 0;">Final Net Price:</td><td style="text-align:right; font-size:13px; color:var(--color-primary);">₹${numberWithCommas(finalPrice.toFixed(2))}</td></tr>
      </table>
    </div>
  `;
}

function setupUnitConverterUnits() {
  const cat = document.getElementById('opt-unit-cat').value;
  const fromSelect = document.getElementById('opt-unit-from');
  const toSelect = document.getElementById('opt-unit-to');
  if (!fromSelect || !toSelect) return;
  
  let options = [];
  if (cat === 'length') {
    options = [
      { v: 'm', n: 'Meters (m)' },
      { v: 'km', n: 'Kilometers (km)' },
      { v: 'cm', n: 'Centimeters (cm)' },
      { v: 'mm', n: 'Millimeters (mm)' },
      { v: 'mi', n: 'Miles (mi)' },
      { v: 'yd', n: 'Yards (yd)' },
      { v: 'ft', n: 'Feet (ft)' },
      { v: 'in', n: 'Inches (in)' }
    ];
  } else if (cat === 'weight') {
    options = [
      { v: 'kg', n: 'Kilograms (kg)' },
      { v: 'g', n: 'Grams (g)' },
      { v: 'mg', n: 'Milligrams (mg)' },
      { v: 'lb', n: 'Pounds (lb)' },
      { v: 'oz', n: 'Ounces (oz)' }
    ];
  } else if (cat === 'area') {
    options = [
      { v: 'sqm', n: 'Square Meters (m²)' },
      { v: 'sqkm', n: 'Square Kilometers (km²)' },
      { v: 'sqft', n: 'Square Feet (ft²)' },
      { v: 'acre', n: 'Acres (ac)' },
      { v: 'hectare', n: 'Hectares (ha)' }
    ];
  } else if (cat === 'temperature') {
    options = [
      { v: 'c', n: 'Celsius (°C)' },
      { v: 'f', n: 'Fahrenheit (°F)' },
      { v: 'k', n: 'Kelvin (K)' }
    ];
  }
  
  fromSelect.innerHTML = options.map(o => `<option value="${o.v}">${o.n}</option>`).join('');
  toSelect.innerHTML = options.map(o => `<option value="${o.v}">${o.n}</option>`).join('');
  
  if (toSelect.options.length > 1) {
    toSelect.selectedIndex = 1;
  }
}

function generateUnitConvert() {
  const rawValue = document.getElementById('opt-unit-val').value;
  const cat = document.getElementById('opt-unit-cat').value;
  const val = parseFloat(rawValue) || 0;
  const from = document.getElementById('opt-unit-from').value;
  const to = document.getElementById('opt-unit-to').value;
  const preview = document.getElementById('generator-preview-mount');
  if (!preview) return;
  if (rawValue === '') {
    preview.innerHTML = '<div class="calculator-empty-state">Enter a measurement value to convert.</div>';
    return;
  }
  
  let result = 0;
  
  if (cat === 'length') {
    const toMeterFactors = { m: 1, km: 1000, cm: 0.01, mm: 0.001, mi: 1609.344, yd: 0.9144, ft: 0.3048, in: 0.0254 };
    const meters = val * toMeterFactors[from];
    result = meters / toMeterFactors[to];
  } else if (cat === 'weight') {
    const toGramFactors = { g: 1, kg: 1000, mg: 0.001, lb: 453.59237, oz: 28.34952 };
    const grams = val * toGramFactors[from];
    result = grams / toGramFactors[to];
  } else if (cat === 'area') {
    const toSqmFactors = { sqm: 1, sqkm: 1000000, sqft: 0.092903, acre: 4046.856, hectare: 10000 };
    const sqm = val * toSqmFactors[from];
    result = sqm / toSqmFactors[to];
  } else if (cat === 'temperature') {
    let kelvin = 0;
    if (from === 'c') kelvin = val + 273.15;
    else if (from === 'f') kelvin = (val - 32) * (5/9) + 273.15;
    else kelvin = val;
    
    if (to === 'c') result = kelvin - 273.15;
    else if (to === 'f') result = (kelvin - 273.15) * (9/5) + 32;
    else result = kelvin;
  }
  
  preview.innerHTML = `
    <div style="width:100%; text-align:center; display:block; font-size:14px; padding:20px 0;">
      <div style="font-size:13px; color:var(--color-text-secondary); margin-bottom:6px;">Conversion Result:</div>
      <div style="font-size:24px; font-weight:800; color:var(--color-primary);">${val} ${from.toUpperCase()} = ${result.toFixed(4).replace(/\.?0+$/, "")} ${to.toUpperCase()}</div>
    </div>
  `;
}

function generateCurrencyConvert() {
  const val = parseFloat(document.getElementById('opt-curr-val').value);
  const from = document.getElementById('opt-curr-from').value;
  const to = document.getElementById('opt-curr-to').value;
  const preview = document.getElementById('generator-preview-mount');
  if (!preview) return;
  
  const rate = parseFloat(document.getElementById('opt-curr-rate').value);
  const validAmount = Number.isFinite(val) && val >= 0;
  const validRate = Number.isFinite(rate) && rate > 0;
  if (!validAmount || !validRate) {
    preview.innerHTML = '<div class="calculator-empty-state">Enter an amount and a current exchange rate greater than zero.</div>';
    return;
  }
  const result = val * rate;
  
  preview.innerHTML = `
    <div style="width:100%; text-align:center; display:block; font-size:14px; padding:20px 0;">
      <div style="font-size:13px; color:var(--color-text-secondary); margin-bottom:6px;">Manual exchange-rate calculation:</div>
      <div style="font-size:24px; font-weight:800; color:var(--color-accent);">${validRate ? `${numberWithCommas(val.toFixed(2))} ${from} = ${numberWithCommas(result.toFixed(2))} ${to}` : 'Enter a rate greater than zero'}</div>
      <div style="font-size:11px; color:var(--color-text-muted); margin-top:8px;">Rate used: 1 ${from} = ${validRate ? rate : '—'} ${to}. This rate is user-provided, not live market data.</div>
    </div>
  `;
}

function generateTimeCalc() {
  const hasInput = ['opt-time-h1', 'opt-time-m1', 'opt-time-s1', 'opt-time-h2', 'opt-time-m2', 'opt-time-s2']
    .some(id => document.getElementById(id)?.value !== '');
  const h1 = parseInt(document.getElementById('opt-time-h1').value) || 0;
  const m1 = parseInt(document.getElementById('opt-time-m1').value) || 0;
  const s1 = parseInt(document.getElementById('opt-time-s1').value) || 0;
  
  const op = document.getElementById('opt-time-op').value;
  
  const h2 = parseInt(document.getElementById('opt-time-h2').value) || 0;
  const m2 = parseInt(document.getElementById('opt-time-m2').value) || 0;
  const s2 = parseInt(document.getElementById('opt-time-s2').value) || 0;
  
  const preview = document.getElementById('generator-preview-mount');
  if (!preview) return;
  if (!hasInput) {
    preview.innerHTML = '<div class="calculator-empty-state">Enter a start time and a duration to add or subtract.</div>';
    return;
  }
  
  const time1Sec = (h1 * 3600) + (m1 * 60) + s1;
  const time2Sec = (h2 * 3600) + (m2 * 60) + s2;
  
  let resultSec = 0;
  if (op === 'add') {
    resultSec = time1Sec + time2Sec;
  } else {
    resultSec = time1Sec - time2Sec;
  }
  
  const absSec = Math.abs(resultSec);
  const rh = Math.floor(absSec / 3600);
  const rm = Math.floor((absSec % 3600) / 60);
  const rs = absSec % 60;
  
  const formatted = `${rh.toString().padStart(2, '0')}:${rm.toString().padStart(2, '0')}:${rs.toString().padStart(2, '0')}`;
  
  preview.innerHTML = `
    <div style="width:100%; text-align:center; display:block; font-size:14px; padding:20px 0;">
      <div style="font-size:13px; color:var(--color-text-secondary); margin-bottom:6px;">Calculated Time Duration:</div>
      <div style="font-size:26px; font-weight:800; color:var(--color-primary);">${resultSec < 0 ? '-' : ''}${formatted}</div>
      <div style="font-size:11px; color:var(--color-text-secondary); margin-top:4px;">Format (HH:MM:SS) | Total seconds: ${resultSec}s</div>
    </div>
  `;
}

async function generateAIResume() {
  const name = document.getElementById('opt-res-name').value;
  const email = document.getElementById('opt-res-email').value;
  const phone = document.getElementById('opt-res-phone').value;
  const location = document.getElementById('opt-res-loc').value;
  const summary = document.getElementById('opt-res-summary').value;
  const experience = document.getElementById('opt-res-exp').value;
  const education = document.getElementById('opt-res-edu').value;
  const skills = document.getElementById('opt-res-skills').value;
  const preview = document.getElementById('generator-preview-mount');
  if (!preview) return;
  
  if (name.trim() === '' || email.trim() === '' || summary.trim() === '') {
    preview.innerHTML = `<div style="color:var(--color-text-secondary); font-size:13px; width:100%; text-align:center;">Fill out at least Name, Email, and Summary settings to generate.</div>`;
    return;
  }
  
  preview.innerHTML = `<div style="color:var(--color-text-secondary); font-size:13px; width:100%; text-align:center;"><div class="spinner" style="margin: 0 auto 10px;"></div> Compiling template layout...</div>`;
  
  try {
    const res = await fetch('/api/resume-api.php?action=compile', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name, email, phone, location, summary, experience, education, skills })
    });
    const data = await res.json();
    if (data.success) {
      preview.innerHTML = `
        <div style="width:100%; text-align:left; display:block;">
          <h5 style="font-weight:700; margin-bottom:8px;">ATS Resume Print Preview</h5>
          <div id="ats-resume-html-box" style="border:1px solid var(--color-border); padding:20px; background:#FFFFFF; color:#1F2937; border-radius:var(--radius-md); max-height:280px; overflow-y:auto; font-family:sans-serif; font-size:12px; line-height:1.4;">
            ${data.compiledHtml}
          </div>
          <input type="hidden" id="ats-resume-filename-hidden" value="${data.fileName}">
        </div>
      `;
    }
  } catch (err) {
    preview.innerHTML = `<div style="color:var(--color-danger); font-size:13px;">Error generating resume: ${err.message}</div>`;
  }
}

function downloadAIResumeFile() {
  const box = document.getElementById('ats-resume-html-box');
  const filenameEl = document.getElementById('ats-resume-filename-hidden');
  if (box && filenameEl) {
    const html = `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <title>ATS Resume Document</title>
        <style>
          body { font-family: Arial, sans-serif; line-height: 1.5; padding: 40px; color: #111; max-width: 800px; margin: 0 auto; }
          h1 { border-bottom: 2px solid #333; padding-bottom: 5px; margin-bottom: 20px; text-transform: uppercase; font-size: 26px; }
          h3 { border-bottom: 1px solid #ddd; padding-bottom: 3px; margin-top: 25px; text-transform: uppercase; font-size: 16px; color: #222; }
          p { margin: 5px 0; }
        </style>
      </head>
      <body>
        ${box.innerHTML}
      </body>
      </html>
    `;
    saveBlob(new Blob([html], { type: 'text/html' }), filenameEl.value);
    showToast('Resume template downloaded!', 'success');
  } else {
    showToast('Please fill out details first.', 'info');
  }
}

// Keyboard numpad handlers
document.addEventListener('keydown', (e) => {
  if (appState.currentPage === 'tool-calculator') {
    const validKeys = '0123456789+-*/().';
    if (validKeys.includes(e.key)) {
      e.preventDefault();
      pressCalcKey(e.key);
    } else if (e.key === 'Enter') {
      e.preventDefault();
      pressCalcKey('=');
    } else if (e.key === 'Backspace') {
      e.preventDefault();
      pressCalcKey('back');
    } else if (e.key === 'Escape') {
      e.preventDefault();
      pressCalcKey('C');
    }
  } else if (appState.currentPage === 'tool-scientific-calculator') {
    const validKeys = '0123456789+-*/().^';
    if (validKeys.includes(e.key)) {
      e.preventDefault();
      pressSciKey(e.key);
    } else if (e.key === 'Enter') {
      e.preventDefault();
      pressSciKey('=');
    } else if (e.key === 'Backspace') {
      e.preventDefault();
      pressSciKey('back');
    } else if (e.key === 'Escape') {
      e.preventDefault();
      pressSciKey('C');
    }
  }
});
