/**
 * Blank SiteDesign baseline for **landing pages** (kind = 'landing_page').
 *
 * A landing page is a single-page site with deliberately minimal chrome:
 *   - Logo-only header (no nav menu — distractions kill conversion)
 *   - Hero / content slot the operator fills in
 *   - Copyright-only footer (no social links, no link lists)
 *
 * Sites with `kind === 'landing_page'` are exported against Kajabi's
 * **encore-page** base theme — a dedicated single-template landing-page
 * theme that ships only `templates/index.liquid`. The export engine
 * branches on `site.kind` in `SiteEditor.tsx` to pick the right base zip;
 * the rest of the design schema (sections, blocks, fields) is identical
 * to streamlined-home, so no per-block code changes are needed.
 */
import type { SiteDesign, DesignPage, DesignSection } from './types';
import { SITE_DESIGN_VERSION } from './types';

const SANS = `'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif`;

/** Logo-only header. No menu, no CTA — minimal chrome by design. */
function logoOnlyHeader(brand: string): DesignSection {
  return {
    kind: 'header',
    name: 'Header (logo only)',
    props: {
      background: '#FFFFFF',
      textColor: '#111111',
      paddingDesktop: { top: '24', bottom: '24' },
      horizontalAlignment: 'center',
    },
    blocks: [
      { type: 'logo', props: { type: 'text', text: brand, textColor: '#111111' } },
    ],
  };
}

/** Copyright-only footer. No nav columns, no social icons. */
function copyrightFooter(brand: string): DesignSection {
  const year = new Date().getFullYear();
  return {
    kind: 'footer',
    name: 'Footer (copyright only)',
    props: {
      background: '#FAFAFA',
      textColor: '#666666',
      paddingDesktop: { top: '32', bottom: '32' },
      verticalLayout: true,
    },
    blocks: [
      {
        type: 'copyright',
        props: { text: `© ${year} ${brand}. All rights reserved.` },
      },
    ],
  };
}

/** Default landing-page hero — a clear promise + single CTA. */
function landingHero(brand: string): DesignSection {
  const heroHtml = `
    <div style="font-family:${SANS}">
      <h1 style="font-size:64px;line-height:1.05;font-weight:700;color:#0A0A0A;margin:0;letter-spacing:-0.02em">A clear promise.<br/>One next step.</h1>
      <p style="max-width:560px;margin:24px auto 0;font-size:18px;line-height:1.6;color:#444">Replace this with the one thing visitors of ${brand} should know — then ask them to do exactly one thing.</p>
      <a href="#" style="display:inline-flex;margin-top:32px;padding:16px 28px;background:#0A0A0A;color:#fff;text-decoration:none;border-radius:8px;font-weight:600;font-size:15px;letter-spacing:0.01em">Get Started</a>
    </div>
  `;
  return {
    kind: 'content',
    name: 'Hero',
    props: { background: '#FFFFFF', paddingDesktop: { top: '140', bottom: '140' } },
    blocks: [{ type: 'text', props: { align: 'center', width: '12', text: heroHtml } }],
  };
}

/**
 * Build a fresh blank landing-page `SiteDesign` parameterized by brand name.
 * Single page (`index`), logo-only header, copyright footer.
 */
export function buildLandingPageBlankDesign(brandName: string): SiteDesign {
  const page: DesignPage = {
    sections: [
      logoOnlyHeader(brandName),
      landingHero(brandName),
      copyrightFooter(brandName),
    ],
  };
  return {
    version: SITE_DESIGN_VERSION,
    pageKeys: ['index'],
    pages: { index: page },
    fonts: { body: 'Inter' },
  };
}
