---
name: Chrome props dual-shape — root fix in serializeChromeProps
description: Engine 0.6.25+. blockChrome.ts normalizeChromeProps() bridges snake_case schema fields → camelCase BEFORE serialize/render reads them. Fixes "I edited padding/margin/bg/radius in field editor, save 200, preview ignored it" for EVERY block at once.
type: feature
---
**The bug it fixes:** schema-driven editor (`BlockFieldForm`) writes Kajabi snake_case field IDs (`padding_desktop`, `margin_desktop`, `background_color`, `border_radius`, `box_shadow`, etc.) for any field without a `.deserialize()` alias on the block. But `serializeChromeProps()` and `getBlockChromeStyle()` in `packages/engine/src/blocks/blockChrome.ts` only read camelCase (`props.padding`, `props.backgroundColor`). Result: chrome silently lands as `{}` in `settings_data.json`, Liquid preview emits no rules, editor changes appear to do nothing.

**Affected every chrome-bearing block** (Accordion, Card, CallToAction, Feature, FeatureIcon, Form, Image, ImageIcon, LinkList, Logo, PricingCard, SearchFilter, SearchForm, SocialIcons, Tabs, Text, Video, VideoEmbed, CustomCode, etc.) — they all call `serializeChromeProps(p)` on raw props.

**Per-block `aliasXProps()` calls work but are fragile** — easy to forget on new blocks; FeatureIcon's `.serialize` had to be patched individually before this root fix landed.

**The root fix (engine 0.6.25):** `blockChrome.ts` defines `normalizeChromeProps<T>(props)` that bridges every chrome snake_case key → camelCase (camel always wins; snake fills empty slots only). Both `serializeChromeProps()` and `getBlockChromeStyle()` call it on entry. Mirrors `CHROME_ALIASES` in `propAliases.ts`.

**Maintenance rule:** when adding a new chrome field, add the bridge in BOTH places — `propAliases.ts CHROME_ALIASES` (render-time) AND `blockChrome.ts normalizeChromeProps` (serialize+chrome-style). They must stay in sync.

**Symptom for diagnostics:** if any block ignores an editor change to padding/margin/bg/radius/shadow → check engine version is 0.6.25+, then check the field is in `normalizeChromeProps`.
