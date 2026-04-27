/**
 * <RawSection> — injects a raw Kajabi section type (e.g. "products",
 * "blog_listings", "blog_post_body") directly into the export tree.
 *
 * Use this for Kajabi's special section types that render dynamic content
 * (member library product grid, blog post listings, blog post body, etc.).
 * These sections live alongside our composed content sections in the same
 * `content_for_<page>` array, so Kajabi keeps rendering its dynamic data
 * while we wrap it in branded chrome (header / intro / outro / footer).
 *
 * Example — Library page with branded intro + products grid + outro:
 *   <SharedHeader/>
 *   <ContentSection>...intro copy...</ContentSection>
 *   <RawSection
 *     type="products"
 *     name="Products"
 *     settings={{ text_heading: 'My Products', layout: '12', ... }}
 *   />
 *   <ContentSection>...outro CTA...</ContentSection>
 *   <SharedFooter/>
 *
 * Preview-only: renders a thin placeholder card so the editor shows where
 * Kajabi's dynamic content will land. Export-time, the serializer reads the
 * static `__rawKajabiSection` marker and emits the section straight through.
 */
import type { ReactNode } from 'react';
import type { KajabiBlock } from './types';

export interface RawSectionProps {
  /** Kajabi section `type` (e.g. "products", "blog_listings", "blog_post_body"). */
  type: string;
  /** Display name shown in Kajabi editor sidebar. */
  name?: string;
  /** Section-level settings object — passed through verbatim. */
  settings?: Record<string, unknown>;
  /** Optional sidebar/utility blocks (e.g. sidebar_search on blog_listings). */
  blocks?: Record<string, KajabiBlock>;
  /** Order of `blocks` keys. Defaults to insertion order if omitted. */
  blockOrder?: string[];
  /** Hidden from rendering when 'true'. Defaults to 'false'. */
  hidden?: 'true' | 'false';
  /** Optional preview label. Defaults to a description of `type`. */
  previewLabel?: string;
  /** Children are ignored — present only to satisfy JSX typing. */
  children?: ReactNode;
}

export interface RawSectionComponent {
  (props: RawSectionProps): JSX.Element | null;
  /** Marker read by the tree walker — distinguishes from regular sections. */
  __rawKajabiSection: true;
}

export const RawSection: RawSectionComponent = (props) => {
  const label = props.previewLabel ?? `Kajabi dynamic section: ${props.type}`;
  return (
    <div
      style={{
        margin: '24px auto',
        maxWidth: 1170,
        padding: '32px 24px',
        border: '1.5px dashed #cbd5e1',
        borderRadius: 12,
        background: 'repeating-linear-gradient(45deg, #f8fafc, #f8fafc 12px, #f1f5f9 12px, #f1f5f9 24px)',
        textAlign: 'center',
        color: '#64748b',
        fontFamily: 'system-ui, sans-serif',
        fontSize: 14,
        lineHeight: 1.5,
      }}
    >
      <div style={{ fontWeight: 700, color: '#334155', fontSize: 13, letterSpacing: 1.2, textTransform: 'uppercase', marginBottom: 6 }}>
        Dynamic content
      </div>
      <div>{label}</div>
      <div style={{ marginTop: 6, fontSize: 12, color: '#94a3b8' }}>
        Rendered by Kajabi at runtime — content not editable here.
      </div>
    </div>
  );
};
RawSection.__rawKajabiSection = true;
