/**
 * <SocialIcons> block — Kajabi `social_icons` type.
 *
 * Real Kajabi schema (snippets/element_social_icons.liquid + block_social_icons.liquid):
 *   Per-platform URL fields (block-level):
 *     - social_icon_link_facebook, _twitter, _instagram, _youtube, _linkedin,
 *       _tiktok, _pinterest, _vimeo, _github, _medium, _spotify, _soundcloud, ...
 *   Appearance:
 *     - social_icon_size (small | medium | large)
 *     - social_icons_background_color  (per-icon BUTTON background)
 *     - social_icon_background_style (none | square | circle)
 *     - new_tab (true | false)
 *
 * NOTE: This block intentionally does NOT extend ChromeProps. The
 * universal `background_color` semantic ("paint the block as a card")
 * collides with Kajabi's per-icon button background field
 * `social_icons_background_color`, and the latter is the meaningful one
 * for this block. Stick with `backgroundColor` = icon-button bg.
 */
import type { BlockComponent } from '../types';
import {
  Facebook, Twitter, Instagram, Youtube, Linkedin, Github,
  Music2, Music, Video, BookOpen, Mail,
} from 'lucide-react';
import type { LucideIcon } from 'lucide-react';

export interface SocialIconsProps {
  // Per-platform URLs — exported as social_icon_link_<platform>
  facebook?: string;
  twitter?: string;
  instagram?: string;
  youtube?: string;
  linkedin?: string;
  tiktok?: string;
  pinterest?: string;
  vimeo?: string;
  github?: string;
  medium?: string;
  spotify?: string;
  soundcloud?: string;
  /** Block-level appearance */
  size?: 'small' | 'medium' | 'large';
  /** Per-icon BUTTON background — Kajabi `social_icons_background_color`. */
  backgroundColor?: string;
  backgroundStyle?: 'none' | 'square' | 'circle';
  /** Open links in new tab — Kajabi `new_tab` */
  newTab?: boolean;
  /** Preview-only alignment */
  align?: 'left' | 'center' | 'right';
  iconColor?: string;
  /** Optional email — rendered as a mail icon, exported via Kajabi field if present */
  email?: string;
}

const ICONS: Record<string, LucideIcon> = {
  facebook: Facebook,
  twitter: Twitter,
  instagram: Instagram,
  youtube: Youtube,
  linkedin: Linkedin,
  tiktok: Music2,
  pinterest: Video,
  vimeo: Video,
  github: Github,
  medium: BookOpen,
  spotify: Music,
  soundcloud: Music,
  email: Mail,
};

const SIZE_PX: Record<string, number> = { small: 28, medium: 38, large: 48 };
const ICON_PX: Record<string, number> = { small: 14, medium: 18, large: 22 };

const ALL_PLATFORMS = [
  'facebook', 'twitter', 'instagram', 'youtube', 'linkedin', 'tiktok',
  'pinterest', 'vimeo', 'github', 'medium', 'spotify', 'soundcloud', 'email',
] as const;

function resolveUrl(props: SocialIconsProps, platform: string): string {
  const explicit = (props as Record<string, unknown>)[platform];
  return typeof explicit === 'string' ? explicit.trim() : '';
}

export const SocialIcons: BlockComponent<SocialIconsProps> = (props) => {
  const align = props.align ?? 'center';
  const sizeKey = props.size ?? 'medium';
  const boxPx = SIZE_PX[sizeKey];
  const iconPx = ICON_PX[sizeKey];
  const bgStyle = props.backgroundStyle ?? 'circle';
  return (
    <div style={{ textAlign: align, padding: '8px 0' }}>
      {ALL_PLATFORMS.map((p) => {
        const url = resolveUrl(props, p);
        if (!url) return null;
        const Icon = ICONS[p];
        if (!Icon) return null;
        return (
          <a
            key={p}
            href={url}
            target={props.newTab !== false ? '_blank' : undefined}
            rel={props.newTab !== false ? 'noopener' : undefined}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              justifyContent: 'center',
              margin: '0 6px',
              color: props.iconColor || '#7A8471',
              backgroundColor: bgStyle === 'none' ? 'transparent' : (props.backgroundColor || '#E5E7EB'),
              border: bgStyle === 'none' ? '1px solid currentColor' : 'none',
              borderRadius: bgStyle === 'circle' ? '50%' : bgStyle === 'square' ? 4 : 0,
              width: boxPx, height: boxPx,
              textDecoration: 'none',
            }}
          >
            <Icon size={iconPx} strokeWidth={1.75} />
          </a>
        );
      })}
    </div>
  );
};

SocialIcons.kajabiType = 'social_icons';
SocialIcons.allowedIn = ['header', 'content', 'footer'];
SocialIcons.serialize = (p) => {
  const out: Record<string, unknown> = {
    social_icon_size: p.size ?? 'medium',
    social_icons_background_color: p.backgroundColor ?? '',
    social_icon_background_style: p.backgroundStyle ?? 'circle',
    new_tab: p.newTab !== false ? 'true' : 'false',
  };
  for (const platform of ALL_PLATFORMS) {
    const url = resolveUrl(p, platform);
    if (!url) continue;
    if (platform === 'email') {
      out['social_icon_link_email'] = url.startsWith('mailto:') ? url : `mailto:${url}`;
    } else {
      out[`social_icon_link_${platform}`] = url;
    }
  }
  return out;
};
