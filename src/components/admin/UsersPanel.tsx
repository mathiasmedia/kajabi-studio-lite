/**
 * UsersPanel — table of all users with role toggle + expandable site list.
 * Designed to render inside the /admin tabbed shell. Caller is responsible
 * for the surrounding header/chrome.
 */
import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { useToast } from '@/hooks/use-toast';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { Input } from '@/components/ui/input';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { ChevronDown, ChevronRight, Shield, Loader2 } from 'lucide-react';
import { listSites, type Site } from '@/lib/siteStore';

interface AdminUser {
  id: string;
  email: string;
  created_at: string;
  last_sign_in_at: string | null;
  isAdmin: boolean;
  siteCount: number;
}

function fmtDate(iso: string | null): string {
  if (!iso) return '—';
  const d = new Date(iso);
  return d.toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' });
}

export function UsersPanel() {
  const { user } = useAuth();
  const { toast } = useToast();
  const [users, setUsers] = useState<AdminUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [savingId, setSavingId] = useState<string | null>(null);
  const [filter, setFilter] = useState('');
  const [expanded, setExpanded] = useState<string | null>(null);
  const [sitesByUser, setSitesByUser] = useState<Record<string, Site[]>>({});

  async function refresh() {
    setLoading(true);
    const { data, error } = await supabase.functions.invoke('admin-list-users');
    if (error) {
      toast({ title: 'Failed to load users', description: error.message, variant: 'destructive' });
      setLoading(false);
      return;
    }
    setUsers((data?.users ?? []) as AdminUser[]);
    setLoading(false);
  }

  useEffect(() => {
    refresh();
    listSites('all').then((all) => {
      const map: Record<string, Site[]> = {};
      for (const s of all) (map[s.userId] ??= []).push(s);
      setSitesByUser(map);
    });
  }, []);

  async function toggleAdmin(target: AdminUser, makeAdmin: boolean) {
    setSavingId(target.id);
    const { error } = await supabase.functions.invoke('admin-set-role', {
      body: { userId: target.id, makeAdmin },
    });
    setSavingId(null);
    if (error) {
      toast({ title: 'Failed to update role', description: error.message, variant: 'destructive' });
      return;
    }
    setUsers((prev) => prev.map((u) => (u.id === target.id ? { ...u, isAdmin: makeAdmin } : u)));
    toast({
      title: makeAdmin ? 'Granted admin' : 'Revoked admin',
      description: target.email,
    });
  }

  const filtered = useMemo(() => {
    const q = filter.trim().toLowerCase();
    if (!q) return users;
    return users.filter((u) => u.email.toLowerCase().includes(q));
  }, [users, filter]);

  return (
    <div>
      <div className="mb-4 flex items-center justify-between gap-3">
        <Input
          placeholder="Filter by email…"
          value={filter}
          onChange={(e) => setFilter(e.target.value)}
          className="max-w-sm"
        />
        <div className="flex items-center gap-3">
          <span className="text-xs text-muted-foreground">
            {users.length} {users.length === 1 ? 'user' : 'users'}
          </span>
          <Button variant="outline" size="sm" onClick={refresh} disabled={loading}>
            {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Refresh'}
          </Button>
        </div>
      </div>

      <Card>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-8"></TableHead>
              <TableHead>Email</TableHead>
              <TableHead>Role</TableHead>
              <TableHead className="text-right">Sites</TableHead>
              <TableHead>Signed up</TableHead>
              <TableHead>Last sign-in</TableHead>
              <TableHead className="text-right">Admin</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading && users.length === 0 ? (
              <TableRow>
                <TableCell colSpan={7} className="py-10 text-center text-muted-foreground">
                  <Loader2 className="mx-auto h-5 w-5 animate-spin" />
                </TableCell>
              </TableRow>
            ) : filtered.length === 0 ? (
              <TableRow>
                <TableCell colSpan={7} className="py-10 text-center text-muted-foreground">
                  No users match.
                </TableCell>
              </TableRow>
            ) : (
              filtered.map((u) => {
                const isOpen = expanded === u.id;
                const isSelf = u.id === user?.id;
                const sites = sitesByUser[u.id] ?? [];
                return (
                  <>
                    <TableRow key={u.id} className="group">
                      <TableCell>
                        <button
                          onClick={() => setExpanded(isOpen ? null : u.id)}
                          className="flex h-6 w-6 items-center justify-center rounded hover:bg-muted"
                          disabled={u.siteCount === 0}
                          title={u.siteCount === 0 ? 'No sites' : 'Show sites'}
                        >
                          {isOpen ? (
                            <ChevronDown className="h-4 w-4" />
                          ) : (
                            <ChevronRight className="h-4 w-4 opacity-50 group-hover:opacity-100" />
                          )}
                        </button>
                      </TableCell>
                      <TableCell className="font-medium">
                        {u.email || <span className="text-muted-foreground">(no email)</span>}
                        {isSelf && (
                          <span className="ml-2 text-xs text-muted-foreground">(you)</span>
                        )}
                      </TableCell>
                      <TableCell>
                        {u.isAdmin ? (
                          <Badge variant="default" className="gap-1">
                            <Shield className="h-3 w-3" /> Admin
                          </Badge>
                        ) : (
                          <Badge variant="outline">User</Badge>
                        )}
                      </TableCell>
                      <TableCell className="text-right tabular-nums">{u.siteCount}</TableCell>
                      <TableCell className="text-muted-foreground">{fmtDate(u.created_at)}</TableCell>
                      <TableCell className="text-muted-foreground">
                        {fmtDate(u.last_sign_in_at)}
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex items-center justify-end gap-2">
                          {savingId === u.id && (
                            <Loader2 className="h-3 w-3 animate-spin text-muted-foreground" />
                          )}
                          <Switch
                            checked={u.isAdmin}
                            disabled={savingId === u.id || isSelf}
                            onCheckedChange={(v) => toggleAdmin(u, v)}
                            title={isSelf ? "You can't change your own role" : 'Toggle admin'}
                          />
                        </div>
                      </TableCell>
                    </TableRow>
                    {isOpen && sites.length > 0 && (
                      <TableRow key={`${u.id}-sites`} className="bg-muted/30 hover:bg-muted/30">
                        <TableCell />
                        <TableCell colSpan={6} className="py-3">
                          <div className="flex flex-wrap gap-2">
                            {sites.map((s) => (
                              <Link
                                key={s.id}
                                to={`/sites/${s.id}`}
                                className="inline-flex items-center gap-2 rounded border border-border bg-background px-3 py-1.5 text-xs font-medium hover:border-primary hover:text-primary"
                              >
                                {s.name}
                                <span className="text-muted-foreground">· {s.templateId}</span>
                              </Link>
                            ))}
                          </div>
                        </TableCell>
                      </TableRow>
                    )}
                  </>
                );
              })
            )}
          </TableBody>
        </Table>
      </Card>
    </div>
  );
}
