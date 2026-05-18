---
name: Template build includes images
description: When building a template from a prompt that lists imagery, generate and wire the images in the same loop — never defer to a follow-up
type: preference
---
When the user provides a template/site prompt that lists imagery (per-page image prompts, hero shots, lifestyle scenes, mockups, etc.), generate and wire those images as part of the SAME build, not as a separate step.

**Why:** Imagery is part of the design spec, not an enhancement. A template without images looks broken; the user shouldn't have to ask twice.

**How to apply:**
1. While defining the template, declare every image in `IMAGE_SLOTS` with key, label, defaultPrompt, and aspect.
2. Immediately after creating `src/templates/<id>.tsx` and registering it, generate all images in parallel via a `/tmp/gen_*.py` script that:
   - calls Lovable AI (`google/gemini-2.5-flash-image`, modalities `["image","text"]`)
   - uploads bytes to the `site-images` bucket using `SUPABASE_SERVICE_ROLE_KEY` at path `<userId>/<siteId>/<uuid>.<ext>`
   - inserts a `site_images` row with `site_id`, `user_id`, `source: 'ai'`, `slot`, `url`, `storage_path`
   - clears any existing rows for the same slots first (idempotent re-runs)
3. Use a shared style suffix string appended to every prompt so all images share lighting, palette, and aesthetic.
4. Run with `ThreadPoolExecutor(max_workers=6)` — Lovable AI handles parallel calls fine.

The slots resolve automatically through `imagesBySlot()` in SiteEditor — no extra wiring needed once the rows exist.
