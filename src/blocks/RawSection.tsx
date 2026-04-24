/**
 * <RawSection> — injects a raw Kajabi section type directly into the export tree.
 */
import type { ReactNode } from 'react';
import type { KajabiBlock } from './types';

export interface RawSectionProps {
  type: string;
  name?: string;
  settings?: Record<string, unknown>;
  blocks?: Record<string, KajabiBlock>;
  blockOrder?: string[];
  hidden?: 'true' | 'false';
  previewLabel?: string;
  children?: ReactNode;
}

export interface RawSectionComponent {
  (props: RawSectionProps): JSX.Element | null;
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
