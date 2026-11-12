import sharp from 'sharp';
import { join } from 'node:path';
import { cp } from 'node:fs/promises';

const artwork = `<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="630" viewBox="0 0 1200 630">
  <defs>
    <linearGradient id="blue" x1="0" y1="0" x2="1" y2="1"><stop stop-color="#071e54"/><stop offset=".58" stop-color="#104ab5"/><stop offset="1" stop-color="#2474dc"/></linearGradient>
    <radialGradient id="light"><stop stop-color="#71b8ff" stop-opacity=".24"/><stop offset="1" stop-color="#71b8ff" stop-opacity="0"/></radialGradient>
  </defs>
  <rect width="1200" height="630" fill="url(#blue)"/>
  <circle cx="940" cy="104" r="390" fill="url(#light)"/>
  <path d="M0 524C196 460 279 571 447 540S701 469 838 510s246 45 362-14" fill="none" stroke="#c2e1ff" stroke-opacity=".14" stroke-width="3"/>
  <rect x="62" y="62" width="202" height="40" rx="20" fill="#ffffff" fill-opacity=".14"/>
  <text x="84" y="89" font-family="Arial, sans-serif" font-size="20" font-weight="700" fill="#ffffff">GXA TECHNOLOGIES</text>
  <text x="62" y="207" font-family="Arial, sans-serif" font-size="72" font-weight="700" fill="#ffffff">GXA Toolbox</text>
  <text x="65" y="274" font-family="Arial, sans-serif" font-size="34" font-weight="600" fill="#dcecff">Your Complete Digital Toolbox</text>
  <text x="65" y="352" font-family="Arial, sans-serif" font-size="25" fill="#f3f8ff">PDFs  •  Images  •  Converters  •  Calculators</text>
  <text x="65" y="394" font-family="Arial, sans-serif" font-size="25" fill="#f3f8ff">Developer utilities  •  QR  •  ZIP</text>
  <rect x="63" y="497" width="214" height="55" rx="16" fill="#ffffff"/>
  <text x="91" y="533" font-family="Arial, sans-serif" font-size="24" font-weight="700" fill="#1648a0">gxatoolbox.in</text>
  <rect x="843" y="146" width="296" height="296" rx="40" fill="#ffffff"/>
</svg>`;

export async function generateSocialPreview(projectRoot, distRoot) {
  const source = join(projectRoot, 'gxa-social-preview.png');
  await sharp(Buffer.from(artwork))
    .composite([{ input: join(projectRoot, 'gxa-logo.png'), top: 162, left: 859 }])
    .png({ compressionLevel: 9 })
    .toFile(source);
  await cp(source, join(distRoot, 'gxa-social-preview.png'));
}
