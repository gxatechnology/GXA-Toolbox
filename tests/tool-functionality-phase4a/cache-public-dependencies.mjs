// Playwright routing (used to block ads/analytics) disables the browser cache.
// Cache exact real CDN responses in memory during a suite so 95 navigations do
// not repeatedly refetch identical runtime libraries/fonts. No engine is mocked.
export async function cachePublicDependencies(context) {
  // Browser QA must never generate real third-party advertising impressions.
  await context.route(/bauval\.org|abscloud\.org/, route => route.abort());
  const responses = new Map();
  await context.route(/^https:\/\/(?:unpkg\.com|cdnjs\.cloudflare\.com|fonts\.googleapis\.com|fonts\.gstatic\.com)\//, async route => {
    try {
      const url = route.request().url();
      if (!responses.has(url)) responses.set(url, (async () => {
        const response = await route.fetch({ timeout: 60000 });
        const result = { status: response.status(), headers: response.headers(), body: await response.body() };
        await response.dispose();
        return result;
      })());
      await route.fulfill(await responses.get(url));
    } catch (error) {
      // A suite may finish while a non-critical worker/font request is still
      // resolving. Closing a Playwright context disposes that request; it is a
      // teardown condition, not an application or dependency failure.
      if (/request context disposed|target.*closed|browser.*closed/i.test(String(error?.message || error))) return;
      throw error;
    }
  });
}
