/**
 * SitePreview — thin re-export. The real component lives in the engine
 * package so font + CSS-scope fixes auto-propagate to thin clients via
 * `bun update @kajabi-studio/engine`.
 *
 * If you're tempted to add logic here, add it to
 * `packages/engine/src/siteDesign/SitePreview.tsx` instead.
 */
export { SitePreview } from '@/lib/siteDesign/SitePreview';
