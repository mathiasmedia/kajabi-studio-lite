---
name: Clone approval gates — hero, complete homepage, then each inner page
description: §4.24 Phase 3 has THREE approval gates, not one. After hero approval, the next mandatory gate is the COMPLETE HOMEPAGE. Then each inner page individually.
type: workflow
---

🚨 **Verified (Healthcare Excellence Advisors, `732c0617`, 2026-05-18).** Followed hero-only gate correctly. Then built all 6 source pages + 4 service detail pages + 1 placeholder in one continuous run. Came back to ~10 distinct issues — all would have been caught at a "complete homepage" gate before propagating.

**Three gates:**
1. **Gate A — Hero only** (existing §4.24 Phase 3 step 2). Stop. Approve.
2. **Gate B — Complete homepage** (this rule). After hero approval, finish ONLY the homepage. Stop. Approve. **This catches design-language bugs (columns, CTA pairs, palette, typography cascade) before they propagate.**
3. **Gate C — Each inner page individually**. Never build 2+ inner pages in one uninterrupted run.

**Why "complete homepage":** the homepage exercises every section type / CTA pattern / typography level / image grid / footer block. Fix design-language bugs ONCE, not 10 times.

**What "stop" means:** save → §4.31 step 10 screenshot + critique → tell expert "refresh and confirm" → wait.

**Forbidden:**
- ❌ "Hero approved, I'll knock out the rest"
- ❌ Building multiple inner pages in parallel
- ❌ "Saved 12 pages, refresh the editor"

**Symptom:** "~10 issues across the site" / "every page has the same problem" / mass correction after declaring done.

Companion to §4.24 + §4.31 step 10 + §4.30.
