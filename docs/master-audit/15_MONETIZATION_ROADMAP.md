# Monetization Readiness

No monetization change is implemented by this audit.

| Model | Technical feasibility | Already supported | Required work | Advantages | Disadvantages/risks |
|---|---|---|---|---|---|
| Free | High | Public static tools and direct routes | Operating budget/governance | Growth and accessibility | No direct revenue |
| Ad-supported | High | AdSense loader and `ads.txt` installed | Consent, placements, policy/performance monitoring, real slot IDs | Revenue without paywall | CWV, privacy, distraction and policy risk |
| Freemium | Medium | Identity/dashboard/profile/history | Entitlements, billing, quotas and premium UX | Broad funnel + paid value | Complexity and support expectations |
| Subscription | Medium | Identity and database foundation | Stripe/billing, plans, invoices, access checks, customer portal | Recurring revenue | Compliance, churn, authorization work |
| Usage limits | Medium | Tool events/history metadata | Accurate metering, abuse controls, anonymous strategy | Encourages upgrade | Can conflict with browser-local/privacy positioning |
| Pro tools | Medium | Tool routing/registry can expose status | Premium engines/features, entitlement checks | Clear paid differentiation | Requires valuable new functionality |
| API access | Low–medium | Functions/database patterns | Server processing APIs, storage, keys, billing, rate limits, SLAs | Developer revenue | Fundamentally changes cost/privacy architecture |
| Business plan | Medium | Identity/database | Teams, organization model, roles, billing, retention controls | Higher ARPU | Significant account/admin scope |
| Developer plan | Medium | Utility audience and Functions | API/SDK, quotas, documentation, keys | Natural developer fit | Operational/server cost |
| White-label | Low–medium | Static generation/design system | Tenant config, domains, theming, licensing, isolation | B2B deals | Maintenance fragmentation |
| Enterprise | Low | Admin/auth foundations only | SSO/SAML, audit, DPA, SLAs, regional controls, support | Large contracts | Long sales/compliance burden |
| Sponsored placements | High | Registry/tool directory | Clearly labelled placement rules and reporting | Simple incremental revenue | Trust and relevance concerns |

## Recommended sequence

1. Stabilize P0 product/security/trust issues.
2. Measure usage through consent-aware analytics and tool-event metadata.
3. Test restrained ad-supported placement without obstructing tools or mobile controls.
4. Define premium value that is technically real: larger resource budgets, advanced batch flows, richer OCR/languages, persistent project metadata or specialist engines.
5. Add subscription billing/entitlement infrastructure only after value and operating cost are validated.
6. Consider API/business/enterprise plans only after server-processing, storage, governance and support capabilities exist.

## Current readiness summary

- **Ad-supported:** technically prepared at site-code level, pending legal/policy/placement and real ad-unit configuration.
- **Freemium/subscription:** identity/database foundation exists; billing, entitlement and quota enforcement do not.
- **API/business/enterprise:** future architecture, not a current product capability.
- **White-label:** feasible from a product-shell perspective but requires genuine tenancy/isolation work.
