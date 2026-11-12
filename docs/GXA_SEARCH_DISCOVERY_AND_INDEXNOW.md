# Search discovery and IndexNow — implementation notes

## Current discovery policy

`robots.txt` allows public pages and points to the existing 109-URL static sitemap plus the dynamic `/blog-sitemap.xml`. It disallows `/api/` and direct `/.netlify/functions/` paths; this is crawl guidance, not access control. Public Blog articles use `/blog/{slug}/` and are server-rendered with a self-canonical URL. Draft, private, deleted and future-scheduled articles are not served as public article HTML. Published `noindex` articles are readable but excluded from the Blog sitemap. The static 109-URL sitemap and the 81-indexable/14-noindex tool policy are unchanged.

There are no crawler-specific `robots.txt` rules in the current source. We did not invent a training opt-out or change public search-crawler access. Search discovery crawlers and model-training crawlers are distinct; see [OpenAI crawler documentation](https://developers.openai.com/api/docs/bots) and [Google crawler documentation](https://developers.google.com/crawling/docs/crawlers-fetchers/overview-google-crawlers). Any future crawler-specific policy requires an explicit owner decision. Keep private and Admin routes protected server-side regardless of robots rules.

## IndexNow integration

The Blog Admin now prepares notifications after a successful, significant database mutation. A newly published indexable post sends its canonical URL; a significant update sends that URL; a slug change sends the former and new canonical URLs; unpublish, noindex or deletion sends the formerly public URL so participating engines can recrawl it. Draft saves, unchanged saves and non-public URLs are not submitted. The notifier accepts only validated `gxatoolbox.in` Blog article slugs and never accepts an arbitrary client URL.

The integration is **disabled until configured**. Set a valid 8–128-character `INDEXNOW_KEY` as a Netlify server-side Function environment variable, scoped to production after review. No key is generated or committed by the project. In production only, `/indexnow-key.txt` serves that key as plain UTF-8 text; the notifier supplies this exact URL as `keyLocation` to the official `https://api.indexnow.org/indexnow` endpoint. Preview and development Functions return 404 for the key route and never send notifications for production URLs. The key file is intentionally public under the [IndexNow verification protocol](https://www.indexnow.org/documentation), so it is not a private authentication credential. Do not place unrelated secrets in that variable.

Submissions use a bounded request timeout, limited backoff for transient errors, `Retry-After` awareness for rate limits, per-mutation duplicate suppression and sanitized status-only logs. The existing Admin rate limit bounds mutation frequency. The local contract uses a mocked provider; **no live IndexNow request was sent during development**. A `200` or `202` means receipt, not indexing. IndexNow is not a direct Google submission mechanism. Google discovery continues through links, the two sitemaps and Search Console.

## Configuration and validation gate

1. Keep `INDEXNOW_KEY` absent until the Blog release, preview database branch and production deployment are approved. Do not set it for Deploy Previews.
2. After production deployment, set the key only in the production Function environment. Confirm `/indexnow-key.txt` returns HTTP 200 with the configured value and `text/plain`; never paste the key into a report or logs.
3. Publish or materially update one genuine, indexable article. Check sanitized Function logs for the IndexNow status and independently confirm the article URL is public and in `/blog-sitemap.xml`.
4. Unpublish the article and confirm its public URL is no longer indexable and no longer in the sitemap. A notification is only a recrawl request, not a deletion guarantee.
5. Use Google Search Console and Bing Webmaster Tools to monitor actual discovery and indexing. No GSC or Bing query export was available locally; opportunity estimates must be labeled hypotheses.

## Limitations

Scheduled posts become available through the dynamic Blog route and sitemap when their publication time arrives, but this implementation does not run a scheduled IndexNow ping at that exact time. In-memory duplicate suppression is per Function instance; the optimistic article version check prevents a repeated stale Admin mutation, but no cross-instance notification ledger exists. Failed submissions are logged without credentials and do not roll back an already-saved article. A later release could add a durable queue if real traffic warrants it. No SEO or IndexNow integration guarantees ranking, indexing or AI citations.

Static tool or editorial page changes are **not** automatically submitted to IndexNow. The build does not have a reliable, reviewed material-change signal for individual canonical URLs, so automatically pinging all 109 sitemap URLs on each build would be noisy and misleading. Their normal discovery remains the static sitemap and internal links; a future release can add a diff-based notification step after an approved production deployment.
