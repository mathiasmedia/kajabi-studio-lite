/**
 * Site Editor — single-site preview + multi-page tab switcher + export.
 */
import { useEffect, useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { exportFromTree, triggerDownload } from '@/blocks';
import { supabase } from '@/integrations/supabase/client';
import {
  getSite,
  resolveBaseTheme,
  updateSite,
  type PageKey,
  type Site,
} from '@/lib/siteStore';
import { listSiteImages, imagesBySlot, type SiteImage } from '@/lib/imageStore';
import { renderDesign, designToPageTrees } from '@/lib/siteDesign/render';
import { resolvePreviewFonts } from '@/lib/siteDesign/resolvePreviewFonts';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { ArrowLeft, Download, Link2, Pencil } from 'lucide-react';
import { toast } from 'sonner';
import { persistExportZip, formatRelativeTime } from '@/lib/exportPersistence';

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

  useEffect(() => {
    if (!site?.design) return;
    const resolved = resolvePreviewFonts(site.design);
    if (!resolved) return;
    const { headingFamily, bodyFamily, googleFamilies, rawLinkTags } = resolved;
    const cleanupNodes: HTMLElement[] = [];

    if (googleFamilies.length > 0) {
      const families = googleFamilies.map((k) =>
        `${k.replace(/\s+/g, '+')}:wght@300;400;500;600;700;800`,
      );
      const href = `https://fonts.googleapis.com/css2?${families.map((f) => `family=${f}`).join('&')}&display=swap`;
      const link = document.createElement('link');
      link.rel = 'stylesheet';
      link.href = href;
      if (site.id) link.dataset.previewFonts = site.id;
      document.head.appendChild(link);
      cleanupNodes.push(link);
    }

    rawLinkTags.forEach((href) => {
      const link = document.createElement('link');
      link.rel = 'stylesheet';
      link.href = href;
      if (site.id) link.dataset.previewFonts = site.id;
      document.head.appendChild(link);
      cleanupNodes.push(link);
    });

    const headingStack = headingFamily ? `'${headingFamily}', Georgia, serif` : null;
    const bodyStack = bodyFamily
      ? `'${bodyFamily}', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif`
      : null;
    if (headingStack || bodyStack || resolved.overrideCss) {
      const style = document.createElement('style');
      const scope = '.preview-root';
      const scopeRules = (css: string) =>
        css.replace(/(^|\})\s*([^{}@]+?)\s*\{/g, (_m, brace, sel) => {
          const scoped = sel
            .split(',')
            .map((s: string) => `${scope} ${s.trim()}`)
            .join(', ');
          return `${brace} ${scoped} {`;
        });
      const scopedOverrides = resolved.overrideCss
        ? resolved.overrideCss.replace(/@media[^{]+\{[^}]+\}\s*\}/g, (block) =>
            block.replace(/(\{[^@}]*?)([a-zA-Z][^{}]*?)\s*\{/g, (_m, pre, sel) => {
              const scoped = sel
                .split(',')
                .map((s: string) => `${scope} ${s.trim()}`)
                .join(', ');
              return `${pre} ${scoped} {`;
            }),
          )
        : '';
      const topLevel = resolved.overrideCss.replace(/@media[^{]+\{[^}]+\}\s*\}/g, '').trim();
      style.textContent = [
        bodyStack ? `${scope}, ${scope} * { font-family: ${bodyStack}; }` : '',
        headingStack
          ? `${scope} :is(h1,h2,h3,h4,h5,h6), ${scope} :is(h1,h2,h3,h4,h5,h6) * { font-family: ${headingStack}; }`
          : '',
        topLevel ? scopeRules(topLevel) : '',
        scopedOverrides,
      ]
        .filter(Boolean)
        .join('\n');
      if (site.id) style.dataset.previewFonts = site.id;
      document.head.appendChild(style);
      cleanupNodes.push(style);
    }

    return () => {
      cleanupNodes.forEach((n) => n.remove());
    };
  }, [site?.design, site?.id]);

  useEffect(() => {
    const css = site?.design?.customCss;
    if (!css || typeof css !== 'string' || css.trim() === '') return;
    const style = document.createElement('style');
    style.textContent = css;
    if (site?.id) style.dataset.previewCustomCss = site.id;
    document.head.appendChild(style);
    return () => {
      style.remove();
    };
  }, [site?.design?.customCss, site?.id]);

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
      const blob = await exportFromTree(trees, {
        global,
        themeSettings,
        customCss,
        baseTheme: resolveBaseTheme(site),
      });
      const safe = site.name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'site';
      triggerDownload(blob, `${safe}.zip`);

      persistExportZip(site, blob).then((res) => {
        if (res.ok) {
          toast.success('Latest build link updated');
        } else {
          toast.error('Couldn\u2019t save build to cloud', { description: res.error });
        }
      });
    } catch (err) {
      console.error(err);
      toast.error(`Export failed: ${(err as Error).message}`);
    } finally {
      setBusy(false);
    }
  }

  async function copyLatestLink() {
    if (!site?.latestExportUrl) return;
    try {
      await navigator.clipboard.writeText(site.latestExportUrl);
      toast.success('Download link copied');
    } catch (err) {
      toast.error('Couldn\u2019t copy link', { description: (err as Error).message });
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
  const backHref = '/';
  const exportLabel = isLandingPage ? 'Export landing page' : 'Export theme';

  return (
    <div className="min-h-screen bg-muted/20">
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
            <SlugField key={site.id} initial={site.slug ?? ''} onCommit={commitSlug} />
          ) : (
            <span className="hidden text-xs text-muted-foreground sm:inline">
              · {pageKeys.length} {pageKeys.length === 1 ? 'page' : 'pages'}
            </span>
          )}
        </div>

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

        <div className="flex flex-col items-end gap-1">
          <div className="flex items-center gap-2">
            {site.latestExportUrl && (
              <Button
                variant="outline"
                size="sm"
                onClick={copyLatestLink}
                title={`Copy stable download link\n${site.latestExportUrl}`}
              >
                <Link2 className="h-4 w-4" />
                Copy link
              </Button>
            )}
            <Button onClick={handleExport} disabled={busy || !site.design} size="sm">
              <Download className="h-4 w-4" />
              {busy ? 'Building zip…' : exportLabel}
            </Button>
          </div>
          {site.latestExportAt && (
            <span className="text-[11px] text-muted-foreground">
              Latest build: {formatRelativeTime(site.latestExportAt)}
            </span>
          )}
        </div>
      </div>

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
