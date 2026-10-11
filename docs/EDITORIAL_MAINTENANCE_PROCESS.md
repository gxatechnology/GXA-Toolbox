# Editorial maintenance and publication gate

## Current status

Prepared locally on 2026-10-02. AI assisted the drafts. GXA Technologies is the existing publisher, not an invented expert byline. No named human reviewer, qualification, publication date or completed human-review date is asserted. The owner must review and authorize publication; no deployment is part of this task.

The draft date in `public_html/assets/editorial-pages.js` records an actual drafting event. It is intentionally not named `published` or `updated`. Replace the pending-review notice with an accurate publication/review record only after that event, keeping the source record of the review. Never refresh dates automatically on builds.

## Review a tool description

1. Open the current route and its source processor. Compare supported formats, input limits, controls, output and dependency/network behavior with the copy.
2. Run a harmless valid fixture, an invalid fixture and a representative boundary case. Reopen the downloaded output in an appropriate reader. Record the test and observed limitation; do not use real private user records.
3. Read initial HTML with JavaScript disabled. Verify a single H1, accurate title/meta, practical instructions and genuine links. Confirm that the explanatory text does not require an interaction.
4. Read prose independently of the template. Identify the decision it helps a user make. Remove name-swapped generalities, unsupported features, promises of fidelity and unnecessary repetition.
5. Reconcile privacy text with file-byte handling, account metadata, external services, dependency loading, analytics and ads. Local computation is not a promise of no network requests.
6. Record the reviewer, actual date, source revision, fixture evidence and open issues. Update review dates only when review actually occurs.

## Review a guide

- Test the specific workflow against the current tool; distinguish general technology capabilities from this deployment’s outputs.
- Check citations against official documentation/specifications/regulators. Financial examples are illustrative arithmetic, not current rate recommendations, legal determinations or personalized advice.
- Recompute worked examples. Review consequences of rounding, units, format changes and ambiguous terms.
- Confirm links, attribution, factual accuracy and useful original explanation. Automated word counts and uniqueness checks are not editorial approval.
- Do not claim human-only writing, expert review, user testimonials or traffic that cannot be supported.

## Keep information current

Review affected pages whenever processors, limits, codecs, models, UI controls, service providers or privacy boundaries change. For externally dependent information (tax treatment, browser support, regulatory guidance), schedule owner review and retain the date/evidence in an internal review log. A dependency release is a trigger to investigate, not proof that copy is obsolete.

Use `node scripts/audit-phase4-content.mjs --report` after the production build to refresh the duplication report. Preserve `PHASE4_CONTENT_BASELINE.json`; it is the pre-edit evidence, not a generated current-state file. Run the content contract, SEO contracts and no-JS/browser checks before approving a revision.

## Broken tools and corrections

Keep genuine errors visible and actionable. Do not fabricate outputs or mark an unavailable processor operational. Reassess `tool-quality.js` through a separate evidence-based publication decision; noindex/no-ad is independent of whether a route remains usable for remediation. Keep removed or changed URLs compatible when possible.

Contact Support is the existing correction channel. Its backend validates submissions, persists real messages and restricts retrieval to authorized admin access. Local contract tests verify these boundaries with controlled fixtures; this work does not send fabricated production tickets or claim production delivery verification.

For a correction: record the route, inaccurate statement, implementation/source evidence, replacement, reviewer and actual review date. Correct the source registry, regenerate static pages, test client rendering and check structured data against the visible FAQ. Do not add fake public activity or changelog entries to suggest maintenance occurred.

## Before the owner publishes

Finish the remaining legacy sentence-frame cleanup recorded in `CONTENT_QUALITY_AUDIT.md`; approve the new drafts; run the final checks; inspect actual Auto Ads exclusions and external GTM configuration independently if needed. A local test pass is neither production verification nor a promise of AdSense approval.
