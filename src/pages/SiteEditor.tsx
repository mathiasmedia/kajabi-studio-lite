/**
 * Site Editor — single-site preview + multi-page tab switcher + export.
 *
 * Reads the site by `:siteId` from the database, renders pages from
 * `site.design` JSON via the SiteDesign renderer, and exports the whole
 * multi-page tree as a Kajabi zip.
 */
import { useEffect, useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { exportFromTree, triggerDownload } from '@/blocks';
import { supabase } from '@/integrations/supabase/client';
import {
  getSite,
  updateSite,
  type PageKey,
  type Site,
} from '@/lib/siteStore';
import { listSiteImages, imagesBySlot, type SiteImage } from '@/lib/imageStore';
import { renderDesign, designToPageTrees } from '@/lib/siteDesign/render';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { ArrowLeft, Download, Pencil } from 'lucide-react';

const SYSTEM_PAGE_LABELS: Record<string, string> = {
  index: 'Home',
  about: 'About',
  page: 'Page',
  contact: 'Contact',
  blog: 'Blog',
  blog_post: 'Blog Post',
  thank_you: 'Thank You',
  '404': '404',
};

/** Friendly tab label for any system or custom page key. */
function pageLabel(key: PageKey): string {
  if (SYSTEM_PAGE_LABELS[key]) return SYSTEM_PAGE_LABELS[key];
  return key
    .split(/[-_]/)
    .map((w) => (w.length === 0 ? '' : w[0].toUpperCase() + w.slice(1)))
    .join(' ');
}

export default function SiteEditor() {
  const { siteId } = useParams<{ siteId: string }>();
  const navigate = useNavigate();
  const [site, setSite] = useState<Site | null>(null);
  const [activePage, setActivePage] = useState<PageKey>('index');
  const [busy, setBusy] = useState(false);
  const [editingName, setEditingName] = useState(false);
  const [nameDraft, setNameDraft] = useState('');
  const [images, setImages] = useState<SiteImage[]>([]);

  useEffect(() => {
    if (!siteId) return;
    let cancelled = false;
    (async () => {
      const s = await getSite(siteId);
      if (cancelled) return;
      if (!s) {
        navigate('/');
        return;
      }
      setSite(s);
      setNameDraft(s.name);
      const keys = s.design?.pageKeys ?? [];
      if (keys.length > 0 && !keys.includes('index')) {
        setActivePage(keys[0]);
      }
      const imgs = await listSiteImages(siteId);
      if (cancelled) return;
      setImages(imgs);
    })();
    return () => {
      cancelled = true;
    };
  }, [siteId, navigate]);

  // Realtime: when this site's row OR its site_images change (e.g. the agent
  // saves via update-site-design or generates an image), refetch so the
  // preview updates without the user reloading.
  useEffect(() => {
    if (!siteId) return;
    const channel = supabase
      .channel(`site-editor-${siteId}`)
      .on(
        'postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'sites', filter: `id=eq.${siteId}` },
        async () => {
          const fresh = await getSite(siteId);
          if (fresh) setSite(fresh);
        },
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'site_images', filter: `site_id=eq.${siteId}` },
        async () => {
          const imgs = await listSiteImages(siteId);
          setImages(imgs);
        },
      )
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [siteId]);

  const slotMap = useMemo(() => imagesBySlot(images), [images]);
  const pageKeys = site?.design?.pageKeys ?? [];

  // Preview-time font loading: inject a Google Fonts <link> AND a <style>
  // rule that actually applies the families to the rendered preview tree.
  // Without the style rule, fonts download but the preview still shows the
  // browser default — which then differs from what Kajabi renders after
  // export (where buildFontCssBlock writes real font-family rules).
  useEffect(() => {
    const fonts = site?.design?.fonts;
    if (!fonts) return;
    const families: string[] = [];
    const seen = new Set<string>();
    // Some saved designs encode font weights inline as
    // "Cormorant Garamond:400,500,500i". Strip everything from the first
    // colon onward so both the Google Fonts request AND the CSS
    // font-family declaration use the real family name.
    const cleanName = (name?: string) => (name ? name.split(':')[0].trim() : '');
    const add = (name?: string) => {
      const key = cleanName(name);
      if (!key || seen.has(key.toLowerCase())) return;
      seen.add(key.toLowerCase());
      families.push(`${key.replace(/\s+/g, '+')}:wght@300;400;500;600;700;800`);
    };
    add(fonts.heading);
    add(fonts.body);
    fonts.extras?.forEach(add);
    if (families.length === 0) return;
    const href = `https://fonts.googleapis.com/css2?${families.map(f => `family=${f}`).join('&')}&display=swap`;
    const link = document.createElement('link');
    link.rel = 'stylesheet';
    link.href = href;
    if (site?.id) link.dataset.previewFonts = site.id;
    document.head.appendChild(link);

    // Apply the families. Scope to .preview-root so we don't restyle the
    // editor chrome. Heading wins on h1-h6; body applies to everything else.
    const style = document.createElement('style');
    const headingName = cleanName(fonts.heading);
    const bodyName = cleanName(fonts.body);
    const headingStack = headingName ? `'${headingName}', Georgia, serif` : null;
    const bodyStack = bodyName
      ? `'${bodyName}', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif`
      : null;
    // NOTE: the heading rule must also target descendants (em, span, strong, a)
    // so inline accents like `<em>for everyday life</em>` inherit the heading
    // family instead of being overridden by the broader `.preview-root *` body
    // rule. Without `h1 *, h2 *, ...` the universal body selector wins on those
    // children and the preview falls back to the body font (or serif default).
    style.textContent = [
      bodyStack ? `.preview-root, .preview-root * { font-family: ${bodyStack}; }` : '',
      headingStack ? `.preview-root :is(h1,h2,h3,h4,h5,h6), .preview-root :is(h1,h2,h3,h4,h5,h6) * { font-family: ${headingStack}; }` : '',
    ].filter(Boolean).join('\n');
    if (site?.id) style.dataset.previewFonts = site.id;
    document.head.appendChild(style);

    return () => {
      link.remove();
      style.remove();
    };
  }, [site?.design?.fonts, site?.id]);

  async function commitName() {
    if (!site) return;
    const trimmed = nameDraft.trim();
    if (!trimmed || trimmed === site.name) {
      setEditingName(false);
      setNameDraft(site.name);
      return;
    }
    const updated = await updateSite(site.id, { name: trimmed, brandName: trimmed });
    if (updated) setSite(updated);
    setEditingName(false);
  }

  async function commitSlug(next: string) {
    if (!site) return;
    const updated = await updateSite(site.id, { slug: next });
    if (updated) setSite(updated);
  }

  async function handleExport() {
    if (!site || !site.design) return;
    setBusy(true);
    try {
      const trees = designToPageTrees(site.design, slotMap);
      const fonts = site.design.fonts;
      const themeSettings = site.design.themeSettings;
      const customCss = site.design.customCss;
      const global = fonts
        ? {
            headingFont: fonts.heading,
            bodyFont: fonts.body,
            fontImports: (fonts.extras ?? []).map((name) => {
              const slug = name.trim().replace(/\s+/g, '+');
              return `https://fonts.googleapis.com/css2?family=${slug}:wght@400;500;600;700;800&display=swap`;
            }),
          }
        : undefined;
      const baseTheme = site.kind === 'landing_page' ? 'encore-page' : 'streamlined-home';
      const blob = await exportFromTree(trees, {
        global,
        themeSettings,
        customCss,
        baseTheme,
      });
      const safe = site.name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'site';
      triggerDownload(blob, `${safe}.zip`);
    } catch (err) {
      console.error(err);
      alert(`Export failed: ${(err as Error).message}`);
    } finally {
      setBusy(false);
    }
  }

  if (!site) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background text-muted-foreground">
        Loading site…
      </div>
    );
  }

  const PreviewPage = site.design
    ? renderDesign(site.design, activePage, slotMap)
    : null;

  const isLandingPage = site.kind === 'landing_page';
  const backLabel = isLandingPage ? 'All landing pages' : 'All sites';
  const backHref = isLandingPage ? '/landing-pages' : '/';
  const exportLabel = isLandingPage ? 'Export landing page' : 'Export theme';

  return (
    <div className="min-h-screen bg-muted/20">
      {/* Sticky editor bar */}
      <div className="sticky top-0 z-50 flex flex-wrap items-center justify-between gap-3 border-b border-border bg-background/95 px-4 py-3 backdrop-blur">
        <div className="flex items-center gap-3 min-w-0">
          <Button variant="ghost" size="sm" onClick={() => navigate(backHref)}>
            <ArrowLeft className="h-4 w-4" /> {backLabel}
          </Button>
          <div className="h-6 w-px bg-border" />
          {editingName ? (
            <Input
              autoFocus
              value={nameDraft}
              onChange={(e) => setNameDraft(e.target.value)}
              onBlur={commitName}
              onKeyDown={(e) => {
                if (e.key === 'Enter') commitName();
                if (e.key === 'Escape') {
                  setNameDraft(site.name);
                  setEditingName(false);
                }
              }}
              className="h-8 w-48"
            />
          ) : (
            <button
              onClick={() => setEditingName(true)}
              className="flex items-center gap-1.5 rounded px-1.5 py-0.5 text-sm font-semibold hover:bg-muted"
            >
              {site.name}
              <Pencil className="h-3 w-3 text-muted-foreground" />
            </button>
          )}
          {isLandingPage ? (
            <SlugField
              key={site.id}
              initial={site.slug ?? ''}
              onCommit={commitSlug}
            />
          ) : (
            <span className="hidden text-xs text-muted-foreground sm:inline">
              · {pageKeys.length} {pageKeys.length === 1 ? 'page' : 'pages'}
            </span>
          )}
        </div>

        {/* Page selector — hidden for landing pages (single page only). */}
        {!isLandingPage && (
          <Select value={activePage} onValueChange={(v) => setActivePage(v as PageKey)}>
            <SelectTrigger className="h-9 w-56">
              <SelectValue placeholder="Select page" />
            </SelectTrigger>
            <SelectContent>
              {pageKeys.map((key) => (
                <SelectItem key={key} value={key}>
                  {pageLabel(key)}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        )}

        <Button onClick={handleExport} disabled={busy || !site.design} size="sm">
          <Download className="h-4 w-4" />
          {busy ? 'Building zip…' : exportLabel}
        </Button>
      </div>

      {/* Preview */}
      <div className="preview-root">
        {PreviewPage ?? (
          <div className="flex min-h-[60vh] items-center justify-center text-muted-foreground">
            This site has no design yet.
          </div>
        )}
      </div>
    </div>
  );
}

/**
 * Inline slug editor for landing pages. Stays uncontrolled so the user can
 * type freely; commits onBlur or Enter (slugified server-side too).
 */
function SlugField({
  initial,
  onCommit,
}: {
  initial: string;
  onCommit: (next: string) => void | Promise<void>;
}) {
  const [value, setValue] = useState(initial);
  const [editing, setEditing] = useState(false);

  useEffect(() => {
    setValue(initial);
  }, [initial]);

  function commit() {
    setEditing(false);
    if (value.trim() !== initial) {
      onCommit(value.trim());
    }
  }

  if (editing) {
    return (
      <div className="flex items-center gap-1 rounded-md border border-input bg-background px-2">
        <span className="text-xs text-muted-foreground">/</span>
        <Input
          autoFocus
          value={value}
          onChange={(e) => setValue(e.target.value)}
          onBlur={commit}
          onKeyDown={(e) => {
            if (e.key === 'Enter') commit();
            if (e.key === 'Escape') {
              setValue(initial);
              setEditing(false);
            }
          }}
          className="h-7 w-40 border-0 px-1 text-xs shadow-none focus-visible:ring-0"
          placeholder="slug"
        />
      </div>
    );
  }

  return (
    <button
      onClick={() => setEditing(true)}
      title="Edit slug"
      className="hidden items-center gap-1 rounded px-1.5 py-0.5 font-mono text-xs text-muted-foreground hover:bg-muted hover:text-foreground sm:inline-flex"
    >
      <span>/{initial || 'no-slug'}</span>
      <Pencil className="h-3 w-3" />
    </button>
  );
}
