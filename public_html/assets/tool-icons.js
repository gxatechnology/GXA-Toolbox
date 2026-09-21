/* GXA miniatures: original, dependency-free SVG illustrations. Display metadata
   only; the application tool registry remains the authority for routes/tools. */
((root) => {
  'use strict';
  const specs = Object.freeze({
    'merge-pdf':['pages','merge','PDF'], 'organize-pdf':['pages','grid','PDF'],
    'compress-image':['photo','inward',''], 'resize-image':['photo','outward',''],
    'image-converter':['photo','swap',''], 'gps-map-camera':['camera','pin',''],
    'crop-image':['photo','crop',''], 'image-ocr':['scan','text','IMG'],
    'background-remover':['cutout','spark',''], 'password-generator':['lock','spark',''],
    'barcode-generator':['qr','plus',''], 'color-extractor':['palette','dropper',''],
    'zip-manager':['archive','grid','ZIP'], 'split-pdf':['pages','split','PDF'],
    'protect-pdf':['paper','lock','PDF'], 'unlock-pdf':['paper','unlock','PDF'],
    'pdf-to-jpg':['conversion','arrow','JPG'], 'jpg-to-pdf':['photo','arrow','PDF'],
    'word-to-pdf':['paper','arrow','DOC'], 'pdf-to-word':['paper','text','RTF'],
    'epub-to-pdf':['book','arrow','PDF'], 'pdf-to-epub':['paper','arrow','EPUB'],
    'gif-maker':['film','play','GIF'], 'zip-extractor':['archive','outward','ZIP'],
    'compress-pdf':['paper','inward','PDF'], 'edit-pdf':['paper','pen','PDF'],
    'rotate-pdf':['paper','rotate','PDF'], 'watermark-pdf':['paper','stamp','PDF'],
    'pagenumber-pdf':['pages','number','PDF'], 'pdf-metadata':['paper','info','PDF'],
    'excel-to-pdf':['sheet','arrow','PDF'], 'ppt-to-pdf':['slides','arrow','PDF'],
    'pdf-to-text':['paper','arrow','TXT'], 'html-to-pdf':['code','arrow','HTML'],
    'pdf-to-html':['paper','code','HTML'], 'markdown-to-pdf':['code','arrow','MD'],
    'pdf-to-markdown':['paper','arrow','MD'], 'svg-to-png':['vector','arrow','PNG'],
    'png-to-svg':['photo','nodes','SVG'], 'webp-to-jpg':['photo','arrow','JPG'],
    'gif-to-png':['film','split','PNG'], 'text-to-speech':['paper','sound','TXT'],
    'qr-reader':['qr','scan',''], 'barcode-reader':['barcode','scan',''],
    'base64-tool':['code','swap','64'], 'url-tool':['code','link','URL'],
    'json-tool':['code','align','JSON'], 'hash-tool':['code','hash','#'],
    'case-converter':['paper','swap','Aa'], 'word-counter':['paper','number','ABC'],
    'lorem-ipsum':['paper','plus','Aa'], 'diff-checker':['code','split','DIFF'],
    'sql-formatter':['database','align','SQL'], 'xml-to-json':['code','swap','XML'],
    'uuid-generator':['code','spark','ID'], 'user-agent':['monitor','info','UA'],
    'regex-tester':['code','search','.*'], 'markdown-editor':['code','pen','MD'],
    'css-beautifier':['code','align','CSS'], 'js-beautifier':['code','align','JS'],
    'html-beautifier':['code','align','HTML'], 'cron-generator':['clock','grid',''],
    'color-converter':['palette','swap',''], 'exif-viewer':['camera','info',''],
    'timestamp-converter':['clock','swap',''], 'remove-pdf-pages':['pages','minus','PDF'],
    'extract-pdf-pages':['pages','outward','PDF'], 'extract-images-pdf':['paper','photo','PDF'],
    'crop-pdf':['paper','crop','PDF'], 'header-footer-pdf':['paper','bars','PDF'],
    'sign-pdf':['paper','signature','PDF'], 'repair-pdf':['paper','repair','PDF'],
    'ocr-pdf':['scan','text','PDF'], 'image-to-pdf':['photo','plus','PDF'],
    'png-to-pdf':['photo','arrow','PNG'], 'txt-to-pdf':['paper','plus','TXT'],
    'pdf-to-image':['conversion','photo','IMG'], 'pdf-to-png':['conversion','arrow','PNG'],
    'pdf-to-excel':['sheet','swap','XLS'], 'pdf-to-ppt':['slides','swap','PPT'],
    'calculator':['calc','plus',''], 'scientific-calculator':['calc','science',''],
    'percentage-calculator':['calc','percent',''], 'age-calculator':['calendar','heart',''],
    'date-calculator':['calendar','plus',''], 'emi-calculator':['calc','home',''],
    'loan-calculator':['calc','coin',''], 'interest-calculator':['chart','percent',''],
    'gst-calculator':['calc','percent','GST'], 'sip-calculator':['chart','growth',''],
    'bmi-calculator':['scale','heart',''], 'discount-calculator':['tag','percent',''],
    'unit-converter':['ruler','swap',''], 'currency-converter':['coin','swap',''],
    'time-calculator':['clock','plus','']
  });
  const path = d => `<path d="${d}"/>`;
  const rect = (x,y,w,h,r=3,fill='var(--icon-paper, #fff)') => `<rect x="${x}" y="${y}" width="${w}" height="${h}" rx="${r}" fill="${fill}"/>`;
  const circle = (x,y,r,fill='none') => `<circle cx="${x}" cy="${y}" r="${r}" fill="${fill}"/>`;
  const ink = 'var(--icon-accent, #476fd4)', wash = 'var(--icon-wash, #dce7ff)';
  const paper = () => path('M19 10h18l9 9v29a4 4 0 0 1-4 4H19a4 4 0 0 1-4-4V14a4 4 0 0 1 4-4Z')+path('M36 10v10h10');
  const photo = () => rect(10,16,39,32,6)+circle(21,26,3,wash)+path('m12 43 12-12 9 9 6-6 9 9');
  const bodies = {
    paper: () => `<g fill="var(--icon-paper, #fff)">${paper()}</g>`+path('M22 28h16M22 34h10'),
    pages: () => rect(9,17,28,36,4,wash)+rect(18,9,29,36,4)+path('M25 18h14M25 24h14M25 30h9'),
    photo, conversion: () => rect(9,12,26,36,4,wash)+photo(),
    scan: () => rect(17,15,27,33,3)+path('M9 22v-9h9M43 9h10v10M9 43v10h10M24 23h13M24 29h13M24 35h7')+`<path d="M11 39h39" stroke="${ink}" stroke-dasharray="3 3"/>`,
    camera: () => rect(9,20,42,29,6)+path('m17 20 4-8h16l4 8')+circle(30,33,10,wash)+circle(30,33,5)+circle(44,26,1.5,ink),
    cutout: () => rect(11,11,40,40,6)+`<path d="M12 22h38M12 33h38M12 44h38M22 12v38M33 12v38M44 12v38" opacity=".2"/>`+`<path d="M19 48c0-12 7-13 11-13s11 1 11 13" fill="${wash}"/>`+circle(30,26,8,wash),
    lock: () => path('M20 28v-9a11 11 0 0 1 22 0v9')+rect(13,25,36,28,7)+circle(31,36,3,ink)+path('M31 39v5'),
    archive: () => path('M10 21v-6a4 4 0 0 1 4-4h13l6 7h13a4 4 0 0 1 4 4')+rect(9,21,42,30,5)+`<path d="M28 22h7v5h-7v5h7v5h-7" fill="${wash}"/>`+rect(28,39,7,7,2),
    book: () => path('M31 16c-7-5-15-5-22-3v34c8-2 15-2 22 3 7-5 14-5 22-3V13c-8-2-15-2-22 3Z')+path('M31 16v34M15 23l10 2M15 30l10 2M38 23l9-2M38 30l9-2'),
    film: () => rect(10,13,40,38,5)+path('M18 14v36M42 14v36M11 22h6M11 31h6M11 40h6M43 22h6M43 31h6M43 40h6')+`<path d="m25 24 12 8-12 8Z" fill="${wash}"/>`,
    sheet: () => rect(12,10,36,42,4)+rect(13,11,34,10,2,wash)+path('M13 30h34M13 39h34M24 22v28M36 22v28'),
    slides: () => rect(9,11,43,31,4)+path('M30 42v12M20 56l10-7 10 7')+rect(16,25,5,10,1,wash)+rect(25,20,5,15,1,wash)+path('M35 21h10M35 27h8'),
    code: () => rect(9,13,43,37,6)+path('M10 23h41')+circle(16,18,1,ink)+circle(21,18,1,wash)+path('m23 30-6 6 6 6m13-12 6 6-6 6m-5-14-4 17'),
    vector: () => rect(13,13,36,36,0,'none')+path('M14 43q16-38 34-25')+[rect(10,10,6,6,1),rect(46,10,6,6,1),rect(10,46,6,6,1),rect(46,46,6,6,1)].join(''),
    qr: () => rect(9,9,44,44,6)+[rect(15,15,11,11,1,wash),rect(35,15,11,11,1,wash),rect(15,35,11,11,1,wash)].join('')+path('M34 33h5v6h7v7H34v-5'),
    barcode: () => rect(9,14,44,35,6)+`<path d="M17 21v20M23 21v20M31 21v20M36 21v20M44 21v20" stroke-width="3"/>`,
    palette: () => path('M31 9C14 9 7 21 9 33c2 12 12 20 23 19 7-1 6-7 2-9-5-3-1-9 5-8 17 3 22-26-8-26Z')+circle(20,21,3,wash)+circle(32,17,3,ink)+circle(43,23,3,wash)+circle(17,34,3,ink),
    database: () => `<path d="M12 18v27c0 10 36 10 36 0V18" fill="var(--icon-paper,#fff)"/>`+`<ellipse cx="30" cy="18" rx="18" ry="8" fill="${wash}"/>`+path('M12 30c0 10 36 10 36 0M12 40c0 10 36 10 36 0'),
    monitor: () => rect(9,12,43,31,5)+path('M10 36h41M30 44v9M20 54h20')+path('m23 21-5 5 5 5m13-10 5 5-5 5'),
    clock: () => circle(30,30,22,'var(--icon-paper,#fff)')+path('M30 14v3M14 30h3M30 30V20m0 10 10 6')+circle(30,30,2,ink),
    calendar: () => rect(10,14,40,38,6)+path('M10 26h40M21 9v11M39 9v11')+rect(18,32,7,7,2,wash)+path('M32 35h9M18 45h7'),
    calc: () => rect(14,8,33,47,7)+rect(20,15,21,10,3,wash)+[22,32,42].map(y=>path(`M21 ${y+10}h3M31 ${y+10}h3`)).join(''),
    chart: () => rect(10,10,41,41,6)+path('M18 18v26h25')+`<path d="m19 36 8-8 7 4 11-14" stroke="${ink}" stroke-width="3"/>`,
    scale: () => rect(11,10,39,43,9)+path('M20 27a11 11 0 0 1 22 0Z')+path('m31 26 4-6M19 40v6M41 40v6'),
    tag: () => path('m11 32 21-21h17v17L28 49a5 5 0 0 1-7 0l-10-10a5 5 0 0 1 0-7Z')+circle(41,19,3,wash),
    ruler: () => rect(12,11,35,41,5)+path('M13 20h9M13 29h6M13 38h9M13 47h6M36 12v8M28 12v5'),
    coin: () => circle(27,29,19,wash)+circle(27,29,13,'var(--icon-paper,#fff)')+path('M31 21h-7a4 4 0 0 0 0 8h5a4 4 0 0 1 0 8h-7M27 18v22')
  };
  // Action marks are drawn in a consistent 16×16 seal, rather than unrelated stock icons.
  const actions = {
    plus:'M8 2v12M2 8h12', minus:'M2 8h12', arrow:'M2 8h12M9 3l5 5-5 5',
    merge:'M2 2v3l5 3M2 14v-3l5-3h7M11 5l3 3-3 3', split:'M2 8h5l6-5M7 8l6 5M9 2h5v5M9 14h5V9',
    swap:'M2 5h12l-3-3M14 11H2l3 3', inward:'M1 1l5 5M6 1v5H1M15 15l-5-5m0 5v-5h5',
    outward:'M6 6 1 1m0 5V1h5M10 10l5 5m-5 0h5v-5', grid:'M2 2h4v4H2Zm8 0h4v4h-4ZM2 10h4v4H2Zm8 0h4v4h-4Z',
    crop:'M4 1v11h11M1 4h11v11', spark:'m8 1 2 5 5 2-5 2-2 5-2-5-5-2 5-2Z',
    pin:'M8 15S2 10 2 6a6 6 0 0 1 12 0c0 4-6 9-6 9ZM6 6a2 2 0 1 0 4 0 2 2 0 1 0-4 0',
    lock:'M4 7V4a4 4 0 0 1 8 0v3M2 7h12v8H2Z', unlock:'M4 7V4a4 4 0 0 1 7-2M2 7h12v8H2Z',
    pen:'m2 11 9-9 3 3-9 9-4 1Z', rotate:'M13 5a6 6 0 1 0 1 6M13 1v5H8',
    text:'M1 3h14M8 3v11M5 14h6', number:'M6 1 4 15M12 1l-2 14M1 6h14M1 10h14',
    info:'M8 2v1M7 7h2v7M6 14h6', stamp:'M5 10V7c-4-7 10-7 6 0v3M3 10h10v4H3ZM2 16h12',
    code:'m5 3-4 5 4 5m6-10 4 5-4 5', nodes:'M4 3h8v9H4ZM2 1h4v4H2Zm8 9h4v4h-4Z',
    play:'m4 1 10 7-10 7Z', scan:'M1 5V1h4m6 0h4v4M1 11v4h4m6 0h4v-4M1 8h14',
    photo:'M1 2h14v12H1Zm0 10 5-5 4 4 2-2 3 3', sound:'m2 6 5-4v12l-5-4H0V6Zm8-2c4 2 4 6 0 8',
    dropper:'m3 9 7-7 4 4-7 7-5 1ZM8 1l7 7', align:'M1 2h14M1 6h9M1 10h14M1 14h9',
    hash:'M5 1 3 15M12 1l-2 14M1 5h14M1 11h14', link:'m6 4 2-2a4 4 0 0 1 6 6l-3 3M10 12l-2 2a4 4 0 0 1-6-6l3-3M5 11l6-6',
    search:'M10 10l5 5M1 6a5 5 0 1 0 10 0A5 5 0 1 0 1 6', bars:'M1 3h14M1 13h14M4 7h8M4 9h8',
    signature:'M1 13c12-15 6-17 4-6-2 13 4-2 5 3 1 4 3 1 5 0',
    repair:'M10 1a5 5 0 0 0-6 6l-4 5 4 4 5-5a5 5 0 0 0 6-6l-4 3-3-3Z',
    science:'M5 1h6M6 1v5l-5 8h14l-5-8V1M4 10h8', percent:'M2 14 14 2M1 4a3 3 0 1 0 6 0 3 3 0 1 0-6 0m8 8a3 3 0 1 0 6 0 3 3 0 1 0-6 0',
    heart:'M8 14 2 8C-3 2 4-2 8 4c4-6 11-2 6 4Z', home:'m1 7 7-6 7 6M3 6v9h10V6M6 15V9h4v6',
    coin:'M1 8a7 7 0 1 0 14 0A7 7 0 1 0 1 8M10 4H6v4h4v4H6M8 2v12', growth:'M1 13 6 8l3 3 6-9M10 2h5v5'
  };
  const cache = new Map();
  function svg(id) {
    if (cache.has(id)) return cache.get(id);
    const spec = specs[id];
    if (!spec) return '';
    const [body, action, label] = spec;
    const format = label ? `<rect x="5" y="42" width="${label.length>3?32:27}" height="16" rx="5" fill="${ink}" stroke="none"/><text x="${label.length>3?21:18.5}" y="53" text-anchor="middle" fill="white" stroke="none" font-family="system-ui,sans-serif" font-size="8" font-weight="800">${label}</text>` : '';
    const markup = `<svg class="gxa-tool-icon" viewBox="0 0 64 64" width="64" height="64" aria-hidden="true" focusable="false" data-tool-illustration="${id}"><rect x="4" y="7" width="51" height="49" rx="14" transform="rotate(-8 30 31)" fill="${wash}"/><circle cx="56" cy="13" r="2" fill="${ink}" opacity=".45"/><ellipse cx="31" cy="57" rx="21" ry="3" fill="${ink}" opacity=".09"/><g stroke="var(--icon-ink,#3a4660)" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" fill="var(--icon-paper,#fff)">${bodies[body]()}</g>${format}<g transform="translate(38 38)"><rect x="-3" y="-3" width="26" height="26" rx="9" fill="${ink}"/><path d="${actions[action]}" stroke="white" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" fill="none"/></g></svg>`;
    cache.set(id,markup);
    return markup;
  }
  root.GxaToolIcons=Object.freeze({svg, ids:Object.freeze(Object.keys(specs))});
})(typeof window==='undefined'?globalThis:window);
