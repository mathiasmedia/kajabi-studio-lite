---
name: Clone Match Brief — tag every card grid as icon-cards or photo-cards
description: §4.24 Phase 1 Match Brief MUST tag each card grid as ICON CARDS (→ Pro `feature_icon`) / PHOTO CARDS (→ `feature` with `image`) / TEXT-ONLY. Defaulting to `feature` without an image when source has icons renders bullet dots.
type: reference
---

🚨 **Verified (Healthcare Excellence Advisors, `732c0617`, 2026-05-18).** Source had icon+heading+blurb cards. I shipped `feature` blocks with `text` only. Live site rendered each card with a default bullet `●`. Expert: "i see just a dot where icons should be."

**Tag every card grid in the Match Brief:**

| Tag | When | Block | Required |
|---|---|---|---|
| **icon cards** | Source shows small icon above title | `feature_icon` (Pro only) | `iconSvg` (source's actual SVG, recolored to brand) + `text` |
| **photo cards** | Source shows a real photo/illustration | `feature` | `image` (from `upload-site-image`) + `imageWidth:"1200"` per §4.17 + `imageBorderRadius:"0"` + `image_border_radius:"0"` per §4.35ag + `text` |
| **text-only** | Source shows just title + body | `feature` (no image) | `text` only — verify source has no visual |

**On Standard themes (no `-pro`)**, `feature_icon` unavailable — either generate icon PNGs + `feature` w/ `imageWidth:"120"`, or inline-style SVG in `text` HTML. Discuss before defaulting.

**Pre-flight:** every card grid in the brief has a `Tag:` line. In Phase 3, the chosen block type matches the tag.

**Symptom:** "I see just dots where icons should be" / "the service cards have no visual".

Companion to §4.24 + `mem://workflow/clone-approval-gates.md` + `mem://reference/clone-default-composition-checklist.md`.
