---
name: Go-to-market plan
description: $500/site premium generator positioning, pricing tiers, build roadmap, distribution playbook, revenue scenarios
type: feature
---

# Go-to-market: $500/site premium AI Kajabi generator

## Positioning

Premium one-time deliverable, NOT a $39/mo SaaS. Tagline: "A custom Kajabi site, designed by AI, delivered in an hour. $500." Selling a finished site, not tool access. Avoids churn, attracts serious buyers, matches market reality (custom Kajabi devs charge $2K–$8K, take weeks).

Math: 300 sites × $500 = $150K upfront vs 300 subs × $39 × 12 = $140K ARR with churn drag.

## Pricing tiers

- **Starter — $500** — 1 site, 5 pages, AI copy + AI images, standard templates, .zip email delivery, 48hr turnaround
- **Pro — $1,500** — 1 site, all pages, AI brand kit, 2 revision rounds, custom color/font work, direct Kajabi push, 24hr turnaround
- **Studio — $3,500** — Unlimited pages, 1-on-1 strategy call, unlimited revisions, custom section design, white-glove setup, 5 days

## Add-ons (high margin)

- Re-skin existing Kajabi site — $750
- Additional landing pages — $150 each
- Brand kit applied to future updates — $200 one-time
- Annual refresh subscription — $300/yr (only recurring play)

## Funnel

Free preview generator on landing page → $500 unlock to download (Stripe one-time) → in-product upsells to Pro/Studio. Conversion moment = customer sees their own brand on a beautiful site.

## Architecture split

- **Lovable = your IDE** — used to build NEW templates, fix blocks/serializer, ship product improvements. Customers never touch it.
- **Customer app = deployed React + Vite + Cloud + edge functions** — runs at kajabi-ai-generator.lovable.app (or custom domain). Static files + edge functions. No Lovable dependency for customers.
- Templates ship as code, customers consume as data. AI fills in `brandName`, every text field, every image URL, theme colors. Existing SiteEditor + export pipeline handles the rest.

## 4-layer build roadmap

**Layer 1 — Foundation (week 1)**
- Multi-user auth (Google OAuth mostly done, polish needed)
- Sites scoped per user in Cloud DB (siteStore.ts already Supabase-backed, RLS in place)

**Layer 2 — AI generation pipeline (week 1–2)** — the new core
- One edge function `generate-site` (~200 lines)
- Input: { businessDescription, niche, brandTone, colorPreference }
- Step 1: Lovable AI picks template (gemini-2.5-flash)
- Step 2: Lovable AI writes copy for every block field (gpt-5-mini), structured JSON matching template's block tree
- Step 3: Generate hero/feature images (gemini-3-pro-image-preview), stored in Cloud storage
- Step 4: Save populated Site to DB, return siteId
- Customer sees result in existing SiteEditor

**Layer 3 — Payment + delivery (week 2)**
- Stripe one-time checkout for $500/$1500/$3500 tiers
- Paywall: preview free + watermarked, download requires paid invoice for that specific site
- Email zip + setup guide via Lovable native transactional email

**Layer 4 — Marketing surface (week 3)**
- Public landing page (no login required for preview)
- "Try the generator" with rate limiting
- Pricing page, template gallery, simple blog
- 2–3 case studies from free design partners

## Distribution playbook

1. **Weekly "Free Kajabi site teardown" posts** — pick a real public Kajabi site, regenerate with tool, post side-by-side in FB groups. Drive to landing page.
2. **5 free sites to Kajabi influencers** — testimonial + portfolio rights. Cost ~$50 AI credits each. Massive social proof ROI.
3. **Kajabi consultants/VAs affiliate program** — 20% commission ($100–$700/sale). They sell hard.
4. **Direct Loom outreach** — find badly-designed Kajabi sites, send 1-min Loom showing redesign, pitch $500. Expected 5–10% conversion with pre-built proof.

## Revenue scenarios (realistic)

| Month | Sites/mo | Avg price | Monthly revenue |
|-------|----------|-----------|-----------------|
| 1     | 5        | $500      | $2,500          |
| 3     | 20       | $650      | $13,000         |
| 6     | 50       | $800      | $40,000         |
| 12    | 100      | $900      | $90,000         |

~$400K year-1 revenue, no churn liability. Profitable enough by month 6 to hire designer for Studio tier.

## What to delete / stop doing

- Stop hand-editing brandName per site — becomes AI input
- Stop hardcoding template content — every text field becomes a prop AI fills
- Don't build visual editor yet — AI generation + "regenerate this section" buttons is 10x simpler, enough for v1

## Open decisions before building

1. **Delivery format** — .zip download vs direct Kajabi API push (higher value, +1 week work)
2. **Free preview gating** — anonymous (lower friction) vs email-required (builds list)
3. **First sprint scope** — all 4 layers in 3 weeks, OR just Layer 1+2 first to validate AI output with design partners before adding payments

Recommendation: Layer 1+2 first (1 week) → 5 design partners → payments week 2 once AI output validated as sellable.
