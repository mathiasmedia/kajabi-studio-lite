/**
 * Re-export SiteDesign type contracts from the engine package so thin clients
 * stay in lockstep with the engine schema.
 */
export {
  SITE_DESIGN_VERSION,
  isSiteDesign,
  isSlotRef,
  type DesignBlock,
  type DesignSection,
  type DesignPage,
  type SiteDesign,
  type SlotRef,
} from "@k-studio-pro/engine";
