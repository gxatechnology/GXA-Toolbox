import config from '../public_html/assets/ad-config.js';
export const AD_NETWORK = config.network;
const block = /<!-- Google AdSense -->[\s\S]*?<!-- End Google AdSense -->/;
export function applyAdNetwork(html, network = AD_NETWORK) {
  if (!['adsterra', 'adsense', 'off'].includes(network)) throw new Error('Unknown ad network configuration.');
  // The existing generator removes this block for non-eligible/private pages.
  const eligible = block.test(html);
  if (network !== 'adsense') html = html.replace(block, '');
  if (network === 'adsterra' && eligible) {
    html = html.replace('</head>', '<link rel="stylesheet" href="/assets/ad-network.css">\n<script defer src="/assets/ad-config.js"></script>\n<script defer src="/assets/ad-layout.js"></script>\n<script defer src="/assets/ad-network.js"></script>\n</head>');
  }
  return html;
}
