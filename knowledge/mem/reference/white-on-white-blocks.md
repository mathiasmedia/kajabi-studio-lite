---
name: white-on-white blocks vanish
description: Pricing/accordion/feature/card blocks with white backgroundColor on white sections render edgeless on Kajabi — fix by tinting the BLOCK (not the section) so the page palette stays consistent
type: constraint
---
NEVER place a chrome-bearing block (`pricing_card`, `accordion`, `feature`, `card`) with `backgroundColor: "#FFFFFF"` (or `#FFF`/`white`/`rgb(255,255,255)`) inside a `content` section whose `background` is also white. The card's only edge is its `box-shadow`, and the verified Kajabi shadows (small/medium/large per `mem://reference/preview-shadow-parity.md`) are too gentle to define a boundary on a pure-white surround. Symptom: "the cards have no edges", "the accordions blend into the page", "everything is one flat white blob." Verified 2026-04 on the Pro Functionality landing page.

Why the preview hides this: `PricingCard.tsx` falls back to `border: "1px solid rgba(0,0,0,0.06)"` when chrome border is unset, so the editor preview shows an edge that doesn't exist in the export. `serializeChromeProps` only emits `border` when explicitly authored — so the bug is invisible until the expert opens the live Kajabi site.

**THINK LIKE A DESIGNER. Tint the BLOCK, not the section.** The default fix is to make the card itself a deliberate object on the page — NOT to recolor the room around it. Tinting whole sections creates a blotchy palette where some sections are cream and others are white for no compositional reason, just because of which blocks happen to live inside them. The expert will (correctly) call it out as an afterthought.

**Order of preference:**
1. **Tint the BLOCK** to a brand-family off-white (warm: `#FBF6EC`, cool: `#F7F8FA`). DEFAULT CHOICE. Keeps section rhythm intact, treats the card as a designed light-register object that pairs with any dark "highlight" tier in the same grid.
2. **Hairline border on the block** (warm: `1px solid #E8E2D4`, cool: `1px solid rgba(0,0,0,0.08)`). ⚠️ Engine caveat: `blockChrome.ts` does NOT serialize `border` to Kajabi (only `background`/`border_radius`/`shadow`/`padding`) — preview-only until that's fixed. Prefer option 1.
3. **Tint the SECTION** (cream `#FBF8F2`, ivory `#F8F5F0`). LAST RESORT — only when the section is the only content section on the page, OR the page already alternates tinted/white bands by design. NEVER tint a single isolated section just because it contains a white card.

Dark "highlight" tiers in a multi-card grid are unaffected — they have their own contrast.

**Pre-flight check before saving any page:** walk every `content` section. If `props.background` ∈ {`#FFF`,`#FFFFFF`,`white`,`rgb(255,255,255)`,`rgba(255,255,255,1)`,empty}, scan its blocks; for every `pricing_card`/`accordion`/`feature`/`card` whose `backgroundColor` is also white AND `border` is empty, **tint the BLOCK** (option 1). Reach for option 3 only if you can articulate a compositional reason. Mirror in AGENTS.md §4.23.
