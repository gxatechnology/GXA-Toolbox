import { getStore } from '@netlify/blobs';

let testStore;
export function setBlogMediaStoreForTests(store) {
  if (process.env.NODE_ENV === 'production') throw new Error('Blog media test adapter is unavailable in production.');
  testStore = store;
}

export function blogMediaStoreName(context) {
  const deploy = context?.deploy;
  if (deploy?.context === 'production') return 'gxa-blog-media-production';
  if (deploy?.context === 'dev') return 'gxa-blog-media-dev';
  if (['deploy-preview', 'branch-deploy'].includes(deploy?.context) && /^[a-z0-9-]{12,}$/i.test(deploy.id || '')) {
    return `gxa-blog-media-preview-${deploy.id}`;
  }
  throw new Error('Blog media deploy context unavailable.');
}

export function blogMediaStore(context) {
  if (testStore) return testStore;
  return getStore(blogMediaStoreName(context));
}
