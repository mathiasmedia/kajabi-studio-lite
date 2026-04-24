/**
 * Landing Pages Dashboard — list, create, rename, duplicate, delete
 * `kind = 'landing_page'` rows.
 *
 * NOTE: This page is no longer routed by App.tsx — the unified workspace
 * at "/" shows both websites and landing pages. The file is kept for
 * thin-client sync compatibility with master.
 */
import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  listSites,
  createLandingPage,
  duplicateSite,
  deleteSite,
  updateSite,
  slugify,
  type Site,
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
} from '@/components/ui/dropdown-menu';
import { MoreVertical, Plus, Rocket, Copy, Check } from 'lucide-react';
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

export default function LandingPagesDashboard() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [pages, setPages] = useState<Site[]>([]);
  const [createOpen, setCreateOpen] = useState(false);
  const [renameTarget, setRenameTarget] = useState<Site | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<Site | null>(null);

  async function refresh() {
    setPages(await listSites('landing_page'));
  }

  useEffect(() => {
    refresh();
  }, []);

  useEffect(() => {
    const channel = supabase
      .channel('landing-pages-dashboard')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'sites' },
        () => { refresh(); },
      )
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  async function handleCreate(name: string, slug: string) {
    const page = await createLandingPage({ name, brandName: name, slug });
    if (!page) return;
    await refresh();
    setCreateOpen(false);
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

  return (
    <div className="min-h-screen bg-background">
      <AppHeader
        actions={
          <Button onClick={() => setCreateOpen(true)}>
            <Plus className="h-4 w-4" /> New landing page
          </Button>
        }
      />

      <main className="mx-auto max-w-6xl px-6 py-10">
        <div className="mb-8">
          <h2 className="text-2xl font-semibold">Landing pages</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Single-page Kajabi exports with minimal chrome — built for one promise and one CTA.
          </p>
        </div>

        {pages.length === 0 ? (
          <EmptyState onCreate={() => setCreateOpen(true)} />
        ) : (
          <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3">
            {pages.map((page) => {
              const isOwn = page.userId === user?.id;
              return (
                <LandingPageCard
                  key={page.id}
                  page={page}
                  canModify={isOwn}
                  onOpen={() => navigate(`/sites/${page.id}`)}
                  onRename={() => setRenameTarget(page)}
                  onDuplicate={() => handleDuplicate(page.id)}
                  onDelete={() => setDeleteTarget(page)}
                />
              );
            })}
          </div>
        )}
      </main>

      <CreateLandingPageDialog open={createOpen} onOpenChange={setCreateOpen} onCreate={handleCreate} />

      <RenameDialog
        page={renameTarget}
        onOpenChange={(o) => !o && setRenameTarget(null)}
        onRename={handleRename}
      />

      <AlertDialog open={!!deleteTarget} onOpenChange={(o) => !o && setDeleteTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete this landing page?</AlertDialogTitle>
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

function EmptyState({ onCreate }: { onCreate: () => void }) {
  return (
    <Card className="flex flex-col items-center justify-center gap-4 border-dashed py-20 text-center">
      <div className="flex h-14 w-14 items-center justify-center rounded-full bg-muted">
        <Rocket className="h-7 w-7 text-muted-foreground" />
      </div>
      <div>
        <h2 className="text-xl font-semibold">No landing pages yet</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Create a single-page conversion-focused export with logo-only chrome.
        </p>
      </div>
      <Button onClick={onCreate}>
        <Plus className="h-4 w-4" /> Create your first landing page
      </Button>
    </Card>
  );
}

function LandingPageCard({
  page,
  canModify,
  onOpen,
  onRename,
  onDuplicate,
  onDelete,
}: {
  page: Site;
  canModify: boolean;
  onOpen: () => void;
  onRename: () => void;
  onDuplicate: () => void;
  onDelete: () => void;
}) {
  return (
    <Card className="group overflow-hidden transition-shadow hover:shadow-md">
      <button onClick={onOpen} className="block w-full cursor-pointer text-left">
        <SitePreview site={page} />
      </button>
      <div className="flex items-start justify-between gap-2 p-4">
        <div className="min-w-0 flex-1">
          <button
            onClick={onOpen}
            className="block w-full truncate text-left font-semibold hover:underline"
          >
            {page.name}
          </button>
          <p className="mt-0.5 text-xs text-muted-foreground">
            {page.slug ? <span className="font-mono">/{page.slug}</span> : 'no slug'} · Updated {timeAgo(page.updatedAt)}
          </p>
          <CopyIdButton id={page.id} />
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
      title={`Copy landing-page ID: ${id}`}
      className="mt-1.5 inline-flex items-center gap-1.5 rounded border border-border bg-muted/50 px-1.5 py-0.5 font-mono text-[10px] text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
    >
      <span>ID: {short}</span>
      {copied ? <Check className="h-3 w-3 text-primary" /> : <Copy className="h-3 w-3" />}
    </button>
  );
}

function CreateLandingPageDialog({
  open,
  onOpenChange,
  onCreate,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onCreate: (name: string, slug: string) => void;
}) {
  const [name, setName] = useState('');
  const [slug, setSlug] = useState('');
  const [slugDirty, setSlugDirty] = useState(false);

  useEffect(() => {
    if (open) {
      setName('');
      setSlug('');
      setSlugDirty(false);
    }
  }, [open]);

  useEffect(() => {
    if (!slugDirty) setSlug(slugify(name));
  }, [name, slugDirty]);

  const canSubmit = name.trim().length > 0;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Create a new landing page</DialogTitle>
          <DialogDescription>
            Name it and pick a URL-friendly slug. The slug becomes the shareable link.
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
                  if (e.key === 'Enter' && canSubmit) onCreate(name.trim(), slug);
                }}
                className="border-0 px-1 shadow-none focus-visible:ring-0"
              />
            </div>
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button disabled={!canSubmit} onClick={() => canSubmit && onCreate(name.trim(), slug)}>
            Create landing page
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function RenameDialog({
  page,
  onOpenChange,
  onRename,
}: {
  page: Site | null;
  onOpenChange: (open: boolean) => void;
  onRename: (id: string, name: string) => void;
}) {
  const [name, setName] = useState('');

  useEffect(() => {
    if (page) setName(page.name);
  }, [page]);

  return (
    <Dialog open={!!page} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Rename landing page</DialogTitle>
        </DialogHeader>
        <div className="py-2">
          <Input
            autoFocus
            value={name}
            onChange={(e) => setName(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && page && name.trim()) onRename(page.id, name.trim());
            }}
          />
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button onClick={() => page && name.trim() && onRename(page.id, name.trim())}>Save</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
