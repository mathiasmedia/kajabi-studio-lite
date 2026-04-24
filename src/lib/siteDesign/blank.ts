/**
 * Blank SiteDesign baseline — used when creating brand-new sites.
 */
import type { SiteDesign, DesignPage, DesignSection } from './types';
import { SITE_DESIGN_VERSION } from './types';

const SANS = `'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif`;

const NAV_ITEMS = [
  { label: 'Home', url: '/' },
  { label: 'About', url: '/about' },
  { label: 'Page', url: '/page' },
  { label: 'Contact', url: '/contact' },
  { label: 'Blog', url: '/blog' },
  { label: 'Blog Post', url: '/blog/sample-post' },
  { label: 'Thank You', url: '/thank-you' },
  { label: '404', url: '/404' },
];

function header(brand: string): DesignSection {
  return {
    kind: 'header',
    name: 'Header',
    props: {
      background: '#FFFFFF',
      textColor: '#111111',
      paddingDesktop: { top: '20', bottom: '20' },
      horizontalAlignment: 'between',
    },
    blocks: [
      { type: 'logo', props: { type: 'text', text: brand, textColor: '#111111' } },
      { type: 'menu', props: { handle: 'main-menu', alignment: 'right', previewItems: NAV_ITEMS } },
    ],
  };
}

function footer(brand: string): DesignSection {
  return {
    kind: 'footer',
    name: 'Footer',
    props: {
      background: '#111111',
      textColor: 'rgba(255,255,255,0.7)',
      paddingDesktop: { top: '40', bottom: '40' },
      verticalLayout: true,
    },
    blocks: [
      { type: 'logo', props: { type: 'text', text: brand, textColor: '#FFFFFF' } },
      { type: 'copyright', props: { text: `${brand}. All rights reserved.` } },
    ],
  };
}

function heroPage(brand: string, heading: string, subhead: string, ctaLabel = 'Get Started'): DesignPage {
  const heroText = `
    <div style="font-family:${SANS}">
      <h1 style="font-size:60px;line-height:1.1;font-weight:700;color:#111;margin:0">${heading}</h1>
      <p style="max-width:520px;margin:20px auto 0;font-size:17px;line-height:1.6;color:#555">${subhead}</p>
      <a href="#" style="display:inline-flex;margin-top:28px;padding:13px 22px;background:#111;color:#fff;text-decoration:none;border-radius:6px;font-weight:600;font-size:14px">${ctaLabel}</a>
    </div>
  `;
  return {
    sections: [
      header(brand),
      {
        kind: 'content',
        name: 'Hero',
        props: { background: '#FAFAFA', paddingDesktop: { top: '120', bottom: '120' } },
        blocks: [{ type: 'text', props: { align: 'center', width: '12', text: heroText } }],
      },
      footer(brand),
    ],
  };
}

const PAGE_KEYS = ['index', 'about', 'page', 'contact', 'blog', 'blog_post', 'thank_you', '404'] as const;

const PAGE_BUILDERS: Record<(typeof PAGE_KEYS)[number], (brand: string) => DesignPage> = {
  index: (b) => heroPage(b, `Welcome to ${b}`, 'A blank starter site. Edit it to make it yours.'),
  about: (b) => heroPage(b, 'About Us', `Tell visitors what ${b} is about. Replace this with your real story.`, 'Learn More'),
  page: (b) => heroPage(b, 'A Custom Page', 'Use this template for any standalone marketing page in Kajabi.', 'Continue'),
  contact: (b) => heroPage(b, 'Get in Touch', "Drop us a line — we'll get back to you within one business day.", 'Send Message'),
  blog: (b) => heroPage(b, 'The Blog', 'Notes, updates, and field reports. Kajabi will inject your real post list between the header and footer.', 'Subscribe'),
  blog_post: (b) => heroPage(b, 'A Sample Post', 'Kajabi renders the actual post content here. Use this template for the post-page chrome.', 'Read More'),
  thank_you: (b) => heroPage(b, 'Thank You', "We've received your submission. We'll be in touch shortly.", 'Back to Home'),
  '404': (b) => heroPage(b, '404 — Page Not Found', "The page you're looking for doesn't exist or has moved.", 'Back to Home'),
};

export function buildBlankDesign(brandName: string): SiteDesign {
  const pages: Record<string, DesignPage> = {};
  for (const key of PAGE_KEYS) pages[key] = PAGE_BUILDERS[key](brandName);
  return {
    version: SITE_DESIGN_VERSION,
    pageKeys: [...PAGE_KEYS],
    pages,
    fonts: { body: 'Inter' },
  };
}
