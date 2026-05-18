---
name: Pro dual-footer mutual exclusion
description: Every Pro site MUST hide the Standard footer by default (hide_on_desktop + hide_on_mobile = "true"); footer_pro is the canonical footer on Pro themes
type: feature
---
On Pro themes (`base_theme` ending in `-pro`) `layouts/theme.liquid` declares BOTH `{% section "footer" %}` and `{% section "footer_pro" %}`, and §4.35's auto-seed populates whichever the design is missing. If both contain content, **Kajabi renders both footers stacked on every page**.

**Rule (no judgment call):** every Pro site ALWAYS hides the Standard `footer` by default. `footer_pro` is the canonical footer on Pro themes (rich block set per §4.27/§4.35e); the Standard `footer` slot only exists because the layout declares both. Set on the Standard `footer` section's props:
```
hide_on_desktop: "true"
hide_on_mobile: "true"
```
Both literal string `"true"` (Kajabi schema enum), not boolean. Only invert (hide `footer_pro` instead) if the expert explicitly asks for the Standard footer — extremely rare; ask first.

Pre-flight on every Pro site build/audit: confirm the Standard `sharedFooter` has BOTH hide flags set to `"true"`. Add to §4.35ae cleanup checklist. Standard themes unaffected (only `footer` exists). See AGENTS §4.35aa.
