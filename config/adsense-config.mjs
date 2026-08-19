export const ADSENSE_PUBLISHER_ID = 'ca-pub-6705105270847964';
export const ADSENSE_SELLER_ID = 'pub-6705105270847964';
export const ADSENSE_CERTIFICATION_AUTHORITY_ID = 'f08c47fec0942fa0';
export const ADSENSE_TEMPLATE_TOKEN = '__GXA_ADSENSE_PUBLISHER_ID__';
export const ADSENSE_SELLER_LINE = `google.com, ${ADSENSE_SELLER_ID}, DIRECT, ${ADSENSE_CERTIFICATION_AUTHORITY_ID}`;

export function injectAdSensePublisherId(source, label = 'template') {
  const occurrences = source.split(ADSENSE_TEMPLATE_TOKEN).length - 1;
  if (occurrences !== 1) {
    throw new Error(`${label} must contain exactly one AdSense publisher token; found ${occurrences}.`);
  }
  return source.replace(ADSENSE_TEMPLATE_TOKEN, ADSENSE_PUBLISHER_ID);
}
