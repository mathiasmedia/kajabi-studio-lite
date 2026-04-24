/**
 * Universal block chrome — Kajabi block-level styling shared by ALL block types.
 */
import type { CSSProperties } from 'react';

const SHADOW_MAP: Record<string, string> = {
  none: 'none',
  small: '0 1px 3px rgba(0,0,0,0.10), 0 1px 2px rgba(0,0,0,0.06)',
  medium: '0 4px 12px rgba(0,0,0,0.12), 0 2px 4px rgba(0,0,0,0.08)',
  large: '0 12px 32px rgba(0,0,0,0.18), 0 4px 8px rgba(0,0,0,0.10)',
};

export interface PaddingObject {
  top?: string | number;
  right?: string | number;
  bottom?: string | number;
  left?: string | number;
}

export interface ChromeProps {
  backgroundColor?: string;
  padding?: PaddingObject | string;
  borderRadius?: string | number;
  boxShadow?: 'none' | 'small' | 'medium' | 'large' | string;
}

function asString(v: unknown): string | undefined {
  if (typeof v === 'number' && Number.isFinite(v)) return String(v);
  if (typeof v !== 'string') return undefined;
  const t = v.trim();
  return t.length > 0 ? t : undefined;
}

function normalizePaddingObject(raw: PaddingObject | string | undefined): PaddingObject | undefined {
  if (!raw) return undefined;
  if (typeof raw === 'string') {
    try {
      const parsed = JSON.parse(raw) as unknown;
      return parsed && typeof parsed === 'object' ? (parsed as PaddingObject) : undefined;
    } catch {
      return undefined;
    }
  }
  return typeof raw === 'object' ? raw : undefined;
}

function paddingToCss(raw: PaddingObject | string | undefined): Partial<CSSProperties> {
  const obj = normalizePaddingObject(raw);
  if (!obj || typeof obj !== 'object') return {};
  const out: Partial<CSSProperties> = {};
  const t = asString(obj.top);
  const r = asString(obj.right);
  const b = asString(obj.bottom);
  const l = asString(obj.left);
  if (t) out.paddingTop = `${t}px`;
  if (r) out.paddingRight = `${r}px`;
  if (b) out.paddingBottom = `${b}px`;
  if (l) out.paddingLeft = `${l}px`;
  return out;
}

export function getBlockChromeStyle(props: ChromeProps): CSSProperties | undefined {
  const style: CSSProperties = {};
  let touched = false;

  const bg = asString(props.backgroundColor);
  if (bg && bg.toLowerCase() !== 'transparent') {
    style.backgroundColor = bg;
    touched = true;
  }

  const padCss = paddingToCss(props.padding);
  if (Object.keys(padCss).length > 0) {
    Object.assign(style, padCss);
    touched = true;
  }

  const radius = asString(props.borderRadius);
  if (radius) {
    style.borderRadius = /^\d+$/.test(radius) ? `${radius}px` : radius;
    touched = true;
  }

  const shadow = asString(props.boxShadow);
  if (shadow) {
    if (shadow in SHADOW_MAP) {
      if (shadow !== 'none') {
        style.boxShadow = SHADOW_MAP[shadow];
        touched = true;
      }
    } else {
      style.boxShadow = shadow;
      touched = true;
    }
  }

  return touched ? style : undefined;
}

export function serializeChromeProps(props: ChromeProps): Record<string, unknown> {
  const out: Record<string, unknown> = {};

  const bg = asString(props.backgroundColor);
  if (bg) out.background_color = bg;

  const radius = asString(props.borderRadius);
  if (radius) out.border_radius = radius;

  const shadow = asString(props.boxShadow);
  if (shadow) out.box_shadow = shadow;

  const padding = normalizePaddingObject(props.padding);
  if (padding) {
    const normalized = {
      top: asString(padding.top) ?? '',
      right: asString(padding.right) ?? '',
      bottom: asString(padding.bottom) ?? '',
      left: asString(padding.left) ?? '',
    };
    out.padding_desktop = normalized;
    out.padding_mobile = { ...normalized };
  }

  return out;
}
