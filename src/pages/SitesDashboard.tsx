/**
 * Unified Workspace Dashboard — shows BOTH "Websites" (kind=site) and
 * "Landing pages" (kind=landing_page) on the same page in two sections.
 *
 * Single "New" button in the header with a dropdown so the expert always
 * sees both options up front — no risk of missing one or the other.
 */
import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  listSites,
  createSite,
  createLandingPage,
  duplicateSite,
  deleteSite,
  updateSite,
  enabledPageCount,
  slugify,
  type Site,
  type BaseThemeId,
} from '@/lib/siteStore';
import { SitePreview } from '@/components/SitePreview';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogDescription,
} from '@/components/ui/dialog';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuSeparator,
  DropdownMenuLabel,
} from '@/components/ui/dropdown-menu';
import {
  MoreVertical,
  Plus,
  FileText,
  Copy,
  Check,
  Globe,
  Rocket,
  ChevronDown,
  Pin,
  PinOff,
} from 'lucide-react';
import { useAuth } from '@/hooks/useAuth';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { AppHeader } from '@/components/AppHeader';

function timeAgo(iso: string): string {
  const ms = Date.now() - new Date(iso).getTime();
  const m = Math.floor(ms / 60000);
  if (m < 1) return 'just now';
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  const d = Math.floor(h / 24);
  return `${d}d ago`;
}

type CreateMode = null | 'site' | 'landing_page';
type TabKind = 'site' | 'landing_page';

const DEFAULT_TAB_PREF_PREFIX = 'workspace.defaultTab.';

function isTabKind(v: unknown): v is TabKind {
  return v === 'site' || v === 'landing_page';
}

export default function SitesDashboard() {
  const navigate = useNavigate();
  const { toast } = useToast();
  const { user, isAdmin } = useAuth();
  const [websites, setWebsites] = useState<Site[]>([]);
  const [landingPages, setLandingPages] = useState<Site[]>([]);
  const [owners, setOwners] = useState<Record<string, string>>({});
  const [createMode, setCreateMode] = useState<CreateMode>(null);
  const [renameTarget, setRenameTarget] = useState<Site | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<Site | null>(null);
  const [activeTab, setActiveTab] = useState<TabKind>('site');
  const [defaultTab, setDefaultTabState] = useState<TabKind>('site');

  // Load saved default-tab preference once we know the user.
  useEffect(() => {
    if (!user?.id) return;
    try {
      const saved = localStorage.getItem(DEFAULT_TAB_PREF_PREFIX + user.id);
      if (isTabKind(saved)) {
        setDefaultTabState(saved);
        setActiveTab(saved);
      }
    } catch {
      // ignore (private mode, etc.)
    }
  }, [user?.id]);

  function saveDefaultTab(next: TabKind) {
    setDefaultTabState(next);
    if (!user?.id) return;
    try {
      localStorage.setItem(DEFAULT_TAB_PREF_PREFIX + user.id, next);
    } catch {
      // ignore
    }
    toast({
      title: 'Default updated',
      description:
        next === 'site'
          ? 'Websites will open by default next time.'
          : 'Landing pages will open by default next time.',
    });
  }


  async function refresh() {
    const [sites, lps] = await Promise.all([
      listSites('site'),
      listSites('landing_page'),
    ]);
    setWebsites(sites);
    setLandingPages(lps);
  }

  useEffect(() => {
    refresh();
  }, []);

  // Realtime: refresh on any sites or site_images change.
  useEffect(() => {
    const channel = supabase
      .channel('workspace-dashboard')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'sites' },
        () => { refresh(); },
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'site_images' },
        () => { refresh(); },
      )
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  // When admin, look up owner emails for the visible items.
  useEffect(() => {
    const allItems = [...websites, ...landingPages];
    if (!isAdmin || allItems.length === 0) {
      setOwners({});
      return;
    }
    const userIds = Array.from(new Set(allItems.map((s) => s.userId).filter(Boolean)));
    if (userIds.length === 0) return;
    let cancelled = false;
    (async () => {
      const { data, error } = await supabase.functions.invoke('admin-list-site-owners', {
        body: { userIds },
      });
      if (cancelled) return;
      if (error) {
        console.error('[dashboard] failed to load owner emails:', error);
        return;
      }
      const map = (data?.owners ?? {}) as Record<string, string>;
      setOwners(map);
    })();
    return () => {
      cancelled = true;
    };
  }, [isAdmin, websites, landingPages]);

  async function handleCreateSite(
    name: string,
    baseTheme: Extract<BaseThemeId, 'streamlined-home' | 'streamlined-home-pro'>,
  ) {
    const site = await createSite({ name, brandName: name, baseTheme });
    if (!site) return;
    await refresh();
    setCreateMode(null);
    navigate(`/sites/${site.id}`);
  }

  async function handleCreateLandingPage(
    name: string,
    slug: string,
    baseTheme: Extract<BaseThemeId, 'encore-page' | 'encore-page-pro'>,
  ) {
    const page = await createLandingPage({ name, brandName: name, slug, baseTheme });
    if (!page) return;
    await refresh();
    setCreateMode(null);
    navigate(`/sites/${page.id}`);
  }

  async function handleDuplicate(id: string) {
    await duplicateSite(id);
    await refresh();
  }

  async function handleDelete(id: string) {
    await deleteSite(id);
    setDeleteTarget(null);
    await refresh();
  }

  async function handleRename(id: string, newName: string) {
    await updateSite(id, { name: newName, brandName: newName });
    setRenameTarget(null);
    await refresh();
  }

  const isEmpty = websites.length === 0 && landingPages.length === 0;

  return (
    <div className="min-h-screen bg-background">
      <AppHeader
        actions={
          <NewMenu
            onNewSite={() => setCreateMode('site')}
            onNewLandingPage={() => setCreateMode('landing_page')}
          />
        }
      />

      <main className="mx-auto max-w-6xl px-6 py-10">
        {isEmpty ? (
          <FirstRunEmptyState
            onNewSite={() => setCreateMode('site')}
            onNewLandingPage={() => setCreateMode('landing_page')}
          />
        ) : (
          <div className="flex flex-col gap-6">
            <WorkspaceTabs
              value={activeTab}
              onChange={setActiveTab}
              defaultTab={defaultTab}
              onSetDefault={saveDefaultTab}
              websiteCount={websites.length}
              landingPageCount={landingPages.length}
            />

            {activeTab === 'site' ? (
              <DashboardSection
                icon={<Globe className="h-4 w-4" />}
                title="Websites"
                subtitle="Multi-page Kajabi sites — homepage, about, programs, blog."
                count={websites.length}
                emptyLabel="No websites yet"
                emptyCta="New website"
                onEmptyCta={() => setCreateMode('site')}
              >
                {websites.map((site) => {
                  const isOwn = site.userId === user?.id;
                  return (
                    <ItemCard
                      key={site.id}
                      site={site}
                      kindLabel={`${enabledPageCount(site)} ${enabledPageCount(site) === 1 ? 'page' : 'pages'}`}
                      ownerEmail={isAdmin && !isOwn ? owners[site.userId] : undefined}
                      canModify={isOwn}
                      onOpen={() => navigate(`/sites/${site.id}`)}
                      onRename={() => setRenameTarget(site)}
                      onDuplicate={() => handleDuplicate(site.id)}
                      onDelete={() => setDeleteTarget(site)}
                    />
                  );
                })}
              </DashboardSection>
            ) : (
              <DashboardSection
                icon={<Rocket className="h-4 w-4" />}
                title="Landing pages"
                subtitle="Single-page conversion-focused exports — one promise, one CTA."
                count={landingPages.length}
                emptyLabel="No landing pages yet"
                emptyCta="New landing page"
                onEmptyCta={() => setCreateMode('landing_page')}
              >
                {landingPages.map((page) => {
                  const isOwn = page.userId === user?.id;
                  return (
                    <ItemCard
                      key={page.id}
                      site={page}
                      kindLabel={page.slug ? `/${page.slug}` : 'no slug'}
                      kindLabelMono
                      ownerEmail={isAdmin && !isOwn ? owners[page.userId] : undefined}
                      canModify={isOwn}
                      onOpen={() => navigate(`/sites/${page.id}`)}
                      onRename={() => setRenameTarget(page)}
                      onDuplicate={() => handleDuplicate(page.id)}
                      onDelete={() => setDeleteTarget(page)}
                    />
                  );
                })}
              </DashboardSection>
            )}
          </div>
        )}
      </main>

      <CreateSiteDialog
        open={createMode === 'site'}
        onOpenChange={(o) => !o && setCreateMode(null)}
        onCreate={handleCreateSite}
      />

      <CreateLandingPageDialog
        open={createMode === 'landing_page'}
        onOpenChange={(o) => !o && setCreateMode(null)}
        onCreate={handleCreateLandingPage}
      />

      <RenameDialog
        site={renameTarget}
        onOpenChange={(o) => !o && setRenameTarget(null)}
        onRename={handleRename}
      />

      <AlertDialog open={!!deleteTarget} onOpenChange={(o) => !o && setDeleteTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              Delete this {deleteTarget?.kind === 'landing_page' ? 'landing page' : 'website'}?
            </AlertDialogTitle>
            <AlertDialogDescription>
              "{deleteTarget?.name}" will be permanently removed. This cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => deleteTarget && handleDelete(deleteTarget.id)}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

// ---------- pieces ----------

function NewMenu({
  onNewSite,
  onNewLandingPage,
}: {
  onNewSite: () => void;
  onNewLandingPage: () => void;
}) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button>
          <Plus className="h-4 w-4" /> New <ChevronDown className="h-4 w-4 opacity-70" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-72">
        <DropdownMenuLabel className="text-xs font-normal text-muted-foreground">
          What do you want to create?
        </DropdownMenuLabel>
        <DropdownMenuSeparator />
        <DropdownMenuItem onClick={onNewSite} className="flex-col items-start gap-1 py-3">
          <div className="flex w-full items-center gap-2">
            <Globe className="h-4 w-4 text-primary" />
            <span className="font-medium">New website</span>
          </div>
          <span className="pl-6 text-xs text-muted-foreground">
            Multi-page Kajabi site — homepage, about, programs, blog.
          </span>
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem onClick={onNewLandingPage} className="flex-col items-start gap-1 py-3">
          <div className="flex w-full items-center gap-2">
            <Rocket className="h-4 w-4 text-primary" />
            <span className="font-medium">New landing page</span>
          </div>
          <span className="pl-6 text-xs text-muted-foreground">
            Single page with one promise + one CTA. Custom URL slug.
          </span>
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

function WorkspaceTabs({
  value,
  onChange,
  defaultTab,
  onSetDefault,
  websiteCount,
  landingPageCount,
}: {
  value: TabKind;
  onChange: (v: TabKind) => void;
  defaultTab: TabKind;
  onSetDefault: (v: TabKind) => void;
  websiteCount: number;
  landingPageCount: number;
}) {
  const tabs: { value: TabKind; label: string; icon: React.ReactNode; count: number }[] = [
    { value: 'site', label: 'Websites', icon: <Globe className="h-4 w-4" />, count: websiteCount },
    { value: 'landing_page', label: 'Landing pages', icon: <Rocket className="h-4 w-4" />, count: landingPageCount },
  ];
  const isDefault = value === defaultTab;
  return (
    <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border">
      <div className="flex items-end gap-1">
        {tabs.map((tab) => {
          const active = value === tab.value;
          const isDefaultTab = defaultTab === tab.value;
          return (
            <button
              key={tab.value}
              type="button"
              onClick={() => onChange(tab.value)}
              className={
                'group inline-flex items-center gap-2 border-b-2 px-4 py-3 text-sm transition-colors -mb-px ' +
                (active
                  ? 'border-primary text-foreground font-medium'
                  : 'border-transparent text-muted-foreground hover:text-foreground hover:border-border')
              }
            >
              {tab.icon}
              <span>{tab.label}</span>
              <span
                className={
                  'rounded-full px-2 py-0.5 text-xs ' +
                  (active ? 'bg-primary/10 text-primary' : 'bg-muted text-muted-foreground')
                }
              >
                {tab.count}
              </span>
              {isDefaultTab && (
                <Pin className="h-3 w-3 fill-current text-primary/70" aria-label="Default tab" />
              )}
            </button>
          );
        })}
      </div>
      <button
        type="button"
        onClick={() => onSetDefault(value)}
        disabled={isDefault}
        className={
          'inline-flex items-center gap-1.5 rounded-md px-2.5 py-1.5 text-xs transition-colors ' +
          (isDefault
            ? 'cursor-default text-muted-foreground'
            : 'text-muted-foreground hover:bg-muted hover:text-foreground')
        }
        title={isDefault ? 'This is your default tab' : 'Open this tab by default next time'}
      >
        {isDefault ? (
          <>
            <Pin className="h-3.5 w-3.5 fill-current" />
            Default
          </>
        ) : (
          <>
            <PinOff className="h-3.5 w-3.5" />
            Set as default
          </>
        )}
      </button>
    </div>
  );
}


function DashboardSection({
  icon,
  title,
  subtitle,
  count,
  emptyLabel,
  emptyCta,
  onEmptyCta,
  children,
}: {
  icon: React.ReactNode;
  title: string;
  subtitle: string;
  count: number;
  emptyLabel: string;
  emptyCta: string;
  onEmptyCta: () => void;
  children: React.ReactNode;
}) {
  return (
    <section>
      <div className="mb-5 flex items-end justify-between gap-4">
        <div>
          <h2 className="flex items-center gap-2 text-xl font-semibold">
            <span className="flex h-7 w-7 items-center justify-center rounded-md bg-muted text-foreground">
              {icon}
            </span>
            {title}
            <span className="text-sm font-normal text-muted-foreground">
              ({count})
            </span>
          </h2>
          <p className="mt-1 text-sm text-muted-foreground">{subtitle}</p>
        </div>
      </div>
      {count === 0 ? (
        <Card className="flex flex-col items-center justify-center gap-3 border-dashed py-10 text-center">
          <p className="text-sm text-muted-foreground">{emptyLabel}</p>
          <Button size="sm" variant="outline" onClick={onEmptyCta}>
            <Plus className="h-3.5 w-3.5" /> {emptyCta}
          </Button>
        </Card>
      ) : (
        <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {children}
        </div>
      )}
    </section>
  );
}

function FirstRunEmptyState({
  onNewSite,
  onNewLandingPage,
}: {
  onNewSite: () => void;
  onNewLandingPage: () => void;
}) {
  return (
    <Card className="flex flex-col items-center justify-center gap-6 border-dashed py-16 text-center">
      <div className="flex h-14 w-14 items-center justify-center rounded-full bg-muted">
        <FileText className="h-7 w-7 text-muted-foreground" />
      </div>
      <div className="max-w-md">
        <h2 className="text-xl font-semibold">Build a website or a landing page</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Both export to Kajabi. Pick the right shape for what you're shipping.
        </p>
      </div>
      <div className="grid w-full max-w-2xl grid-cols-1 gap-3 sm:grid-cols-2">
        <button
          onClick={onNewSite}
          className="group rounded-lg border border-border bg-card p-5 text-left transition-all hover:border-primary hover:shadow-md"
        >
          <div className="flex items-center gap-2">
            <Globe className="h-5 w-5 text-primary" />
            <h3 className="font-semibold">Website</h3>
          </div>
          <p className="mt-2 text-sm text-muted-foreground">
            Multi-page site — homepage, about, programs, blog. Full Kajabi theme export.
          </p>
          <span className="mt-4 inline-flex items-center gap-1 text-sm font-medium text-primary">
            <Plus className="h-3.5 w-3.5" /> New website
          </span>
        </button>
        <button
          onClick={onNewLandingPage}
          className="group rounded-lg border border-border bg-card p-5 text-left transition-all hover:border-primary hover:shadow-md"
        >
          <div className="flex items-center gap-2">
            <Rocket className="h-5 w-5 text-primary" />
            <h3 className="font-semibold">Landing page</h3>
          </div>
          <p className="mt-2 text-sm text-muted-foreground">
            Single page, one promise, one CTA. Custom URL slug. Encore-page theme.
          </p>
          <span className="mt-4 inline-flex items-center gap-1 text-sm font-medium text-primary">
            <Plus className="h-3.5 w-3.5" /> New landing page
          </span>
        </button>
      </div>
    </Card>
  );
}

function ItemCard({
  site,
  kindLabel,
  kindLabelMono,
  ownerEmail,
  canModify,
  onOpen,
  onRename,
  onDuplicate,
  onDelete,
}: {
  site: Site;
  kindLabel: string;
  kindLabelMono?: boolean;
  ownerEmail?: string;
  canModify: boolean;
  onOpen: () => void;
  onRename: () => void;
  onDuplicate: () => void;
  onDelete: () => void;
}) {
  return (
    <Card className="group overflow-hidden transition-shadow hover:shadow-md">
      <button
        onClick={onOpen}
        className="block w-full cursor-pointer text-left"
      >
        <SitePreview site={site} />
      </button>
      <div className="flex items-start justify-between gap-2 p-4">
        <div className="min-w-0 flex-1">
          <button
            onClick={onOpen}
            className="block w-full truncate text-left font-semibold hover:underline"
          >
            {site.name}
          </button>
          <p className="mt-0.5 text-xs text-muted-foreground">
            {kindLabelMono ? <span className="font-mono">{kindLabel}</span> : kindLabel}
            {' · Updated '}
            {timeAgo(site.updatedAt)}
          </p>
          {ownerEmail && (
            <p className="mt-0.5 truncate text-xs text-muted-foreground" title={ownerEmail}>
              Owner: <span className="font-medium text-foreground/80">{ownerEmail}</span>
            </p>
          )}
          <CopyIdButton id={site.id} />
        </div>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="icon" className="h-8 w-8 shrink-0">
              <MoreVertical className="h-4 w-4" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem onClick={onOpen}>Open</DropdownMenuItem>
            {canModify && <DropdownMenuItem onClick={onRename}>Rename</DropdownMenuItem>}
            {canModify && <DropdownMenuItem onClick={onDuplicate}>Duplicate</DropdownMenuItem>}
            {canModify && <DropdownMenuSeparator />}
            {canModify && (
              <DropdownMenuItem onClick={onDelete} className="text-destructive focus:text-destructive">
                Delete
              </DropdownMenuItem>
            )}
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </Card>
  );
}

function CopyIdButton({ id }: { id: string }) {
  const [copied, setCopied] = useState(false);
  const { toast } = useToast();
  const short = `${id.slice(0, 8)}…`;

  async function copy(e: React.MouseEvent) {
    e.stopPropagation();
    try {
      await navigator.clipboard.writeText(id);
      setCopied(true);
      toast({ title: 'ID copied', description: id });
      setTimeout(() => setCopied(false), 1500);
    } catch {
      toast({ title: 'Copy failed', variant: 'destructive' });
    }
  }

  return (
    <button
      onClick={copy}
      title={`Copy ID: ${id}`}
      className="mt-1.5 inline-flex items-center gap-1.5 rounded border border-border bg-muted/50 px-1.5 py-0.5 font-mono text-[10px] text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
    >
      <span>ID: {short}</span>
      {copied ? <Check className="h-3 w-3 text-primary" /> : <Copy className="h-3 w-3" />}
    </button>
  );
}

function CreateSiteDialog({
  open,
  onOpenChange,
  onCreate,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onCreate: (
    name: string,
    baseTheme: Extract<BaseThemeId, 'streamlined-home' | 'streamlined-home-pro'>,
  ) => void;
}) {
  const [name, setName] = useState('');
  const [tier, setTier] = useState<'standard' | 'pro'>('standard');

  useEffect(() => {
    if (open) {
      setName('');
      setTier('standard');
    }
  }, [open]);

  const baseTheme = tier === 'pro' ? 'streamlined-home-pro' : 'streamlined-home';

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Globe className="h-5 w-5 text-primary" /> Create a new website
          </DialogTitle>
          <DialogDescription>
            Multi-page Kajabi site. You can add or remove pages later.
          </DialogDescription>
        </DialogHeader>
        <div className="flex flex-col gap-4 py-2">
          <div className="flex flex-col gap-2">
            <Label htmlFor="site-name">Website name</Label>
            <Input
              id="site-name"
              autoFocus
              placeholder="e.g. Acme Co"
              value={name}
              onChange={(e) => setName(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && name.trim()) onCreate(name.trim(), baseTheme);
              }}
            />
          </div>
          <TierToggle value={tier} onChange={setTier} kind="site" />
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button onClick={() => onCreate(name.trim() || 'Untitled site', baseTheme)}>
            Create website
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function CreateLandingPageDialog({
  open,
  onOpenChange,
  onCreate,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onCreate: (
    name: string,
    slug: string,
    baseTheme: Extract<BaseThemeId, 'encore-page' | 'encore-page-pro'>,
  ) => void;
}) {
  const [name, setName] = useState('');
  const [slug, setSlug] = useState('');
  const [slugDirty, setSlugDirty] = useState(false);
  const [tier, setTier] = useState<'standard' | 'pro'>('standard');

  useEffect(() => {
    if (open) {
      setName('');
      setSlug('');
      setSlugDirty(false);
      setTier('standard');
    }
  }, [open]);

  // Auto-derive slug from name unless user has typed in the slug field.
  useEffect(() => {
    if (!slugDirty) setSlug(slugify(name));
  }, [name, slugDirty]);

  const canSubmit = name.trim().length > 0;
  const baseTheme = tier === 'pro' ? 'encore-page-pro' : 'encore-page';

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Rocket className="h-5 w-5 text-primary" /> Create a new landing page
          </DialogTitle>
          <DialogDescription>
            Single page with logo-only chrome. The slug becomes the public URL on Kajabi.
          </DialogDescription>
        </DialogHeader>
        <div className="flex flex-col gap-4 py-2">
          <div className="flex flex-col gap-2">
            <Label htmlFor="lp-name">Page name</Label>
            <Input
              id="lp-name"
              autoFocus
              placeholder="e.g. Spring Launch"
              value={name}
              onChange={(e) => setName(e.target.value)}
            />
          </div>
          <div className="flex flex-col gap-2">
            <Label htmlFor="lp-slug">URL slug</Label>
            <div className="flex items-center gap-1 rounded-md border border-input bg-background px-2 focus-within:ring-2 focus-within:ring-ring">
              <span className="text-sm text-muted-foreground">/</span>
              <Input
                id="lp-slug"
                placeholder="spring-launch"
                value={slug}
                onChange={(e) => {
                  setSlug(slugify(e.target.value));
                  setSlugDirty(true);
                }}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && canSubmit) onCreate(name.trim(), slug, baseTheme);
                }}
                className="border-0 px-1 shadow-none focus-visible:ring-0"
              />
            </div>
          </div>
          <TierToggle value={tier} onChange={setTier} kind="landing_page" />
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button
            disabled={!canSubmit}
            onClick={() => canSubmit && onCreate(name.trim(), slug, baseTheme)}
          >
            Create landing page
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

/**
 * Standard / Pro tier toggle used in both create dialogs. The chosen tier
 * maps to the underlying Kajabi base-theme zip (set once at creation; never
 * mutated by the editor — see AGENTS.md base-theme rules).
 *
 *   site         → streamlined-home    | streamlined-home-pro
 *   landing_page → encore-page         | encore-page-pro
 *
 * Pro themes are 100% backward compatible (additive blocks + section
 * settings: sliders, animations, column layouts, search/filter blocks,
 * Pro footer). Existing sites are unaffected.
 */
function TierToggle({
  value,
  onChange,
  kind,
}: {
  value: 'standard' | 'pro';
  onChange: (v: 'standard' | 'pro') => void;
  kind: 'site' | 'landing_page';
}) {
  const proHint =
    kind === 'site'
      ? 'Sliders, animations, column layouts, Pro footer, plus extra block types.'
      : 'Sliders, animations, advanced section controls, plus extra block types.';
  return (
    <div className="flex flex-col gap-2">
      <Label>Base template</Label>
      <div className="grid grid-cols-2 gap-2">
        <button
          type="button"
          onClick={() => onChange('standard')}
          className={
            'rounded-md border p-3 text-left transition-colors ' +
            (value === 'standard'
              ? 'border-primary bg-primary/5 ring-1 ring-primary'
              : 'border-border bg-background hover:border-foreground/30')
          }
        >
          <div className="flex items-center justify-between">
            <span className="text-sm font-medium">Standard</span>
            {value === 'standard' && (
              <Check className="h-3.5 w-3.5 text-primary" aria-hidden />
            )}
          </div>
          <p className="mt-1 text-xs text-muted-foreground">
            Battle-tested base template. Recommended for most sites.
          </p>
        </button>
        <button
          type="button"
          onClick={() => onChange('pro')}
          className={
            'rounded-md border p-3 text-left transition-colors ' +
            (value === 'pro'
              ? 'border-primary bg-primary/5 ring-1 ring-primary'
              : 'border-border bg-background hover:border-foreground/30')
          }
        >
          <div className="flex items-center justify-between">
            <span className="text-sm font-medium">
              Pro{' '}
              <span className="ml-0.5 rounded-sm bg-primary/15 px-1 py-0.5 align-middle text-[9px] font-semibold uppercase tracking-wide text-primary">
                New
              </span>
            </span>
            {value === 'pro' && <Check className="h-3.5 w-3.5 text-primary" aria-hidden />}
          </div>
          <p className="mt-1 text-xs text-muted-foreground">{proHint}</p>
        </button>
      </div>
      <p className="text-[11px] text-muted-foreground">
        This choice is set once and can't be changed later.
      </p>
    </div>
  );
}

function RenameDialog({
  site,
  onOpenChange,
  onRename,
}: {
  site: Site | null;
  onOpenChange: (open: boolean) => void;
  onRename: (id: string, name: string) => void;
}) {
  const [name, setName] = useState('');

  useEffect(() => {
    if (site) setName(site.name);
  }, [site]);

  const label = site?.kind === 'landing_page' ? 'landing page' : 'website';

  return (
    <Dialog open={!!site} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Rename {label}</DialogTitle>
        </DialogHeader>
        <div className="py-2">
          <Input
            autoFocus
            value={name}
            onChange={(e) => setName(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && site && name.trim()) onRename(site.id, name.trim());
            }}
          />
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button onClick={() => site && name.trim() && onRename(site.id, name.trim())}>Save</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
