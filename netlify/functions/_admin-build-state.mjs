import { SEO_BUILD_COUNTS } from './_seo-build-counts.mjs';

// Registry-derived facts are generated during every production build.
export const ADMIN_BUILD_STATE = Object.freeze({
  registeredTools: SEO_BUILD_COUNTS.registeredTools,
  indexableToolPages: SEO_BUILD_COUNTS.indexableToolPages,
  sitemapUrls: SEO_BUILD_COUNTS.sitemapUrls,
  noindexPages: SEO_BUILD_COUNTS.noindexPages,
  canonicalIssues: 0,
  brokenInternalLinks: 0
});
