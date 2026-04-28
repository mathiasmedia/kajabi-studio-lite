/**
 * AppHeader — shared site-wide header with brand mark, title, and account
 * dropdown. Pages may render extra controls (e.g. "New") via `actions`.
 *
 * Note: there used to be Sites / Landing pages nav tabs here. They were
 * removed when both surfaces were merged into a single workspace dashboard
 * — the brand mark routes to `/` which now shows everything in one place.
 */
import { ReactNode } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuSeparator,
} from '@/components/ui/dropdown-menu';
import { Layers, LogOut, Shield, Users } from 'lucide-react';

export function AppHeader({ actions }: { actions?: ReactNode }) {
  const navigate = useNavigate();
  const { user, isAdmin, signOut } = useAuth();

  return (
    <header className="border-b border-border bg-card">
      <div className="mx-auto flex max-w-6xl items-center justify-between px-6 py-5">
        <button
          onClick={() => navigate('/')}
          className="flex items-center gap-3 text-left"
          title="Go to dashboard"
        >
          <div className="flex h-9 w-9 items-center justify-center rounded-md bg-primary text-primary-foreground">
            <Layers className="h-5 w-5" />
          </div>
          <div>
            <h1 className="m-0 text-lg font-semibold leading-tight">Studio Pro</h1>
            <p className="m-0 text-xs leading-tight text-muted-foreground">
              Build, save, and export Kajabi themes.
            </p>
          </div>
        </button>
        <div className="flex items-center gap-2">
          {isAdmin && (
            <Badge variant="secondary" className="gap-1">
              <Shield className="h-3 w-3" /> Admin
            </Badge>
          )}
          {actions}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="icon" className="rounded-full" title="Account">
                <div className="flex h-8 w-8 items-center justify-center rounded-full bg-muted text-xs font-semibold uppercase text-foreground">
                  {user?.email?.[0] ?? 'U'}
                </div>
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-56">
              {user?.email && (
                <>
                  <div className="px-2 py-1.5">
                    <p className="text-xs text-muted-foreground">Signed in as</p>
                    <p className="truncate text-sm font-medium">{user.email}</p>
                  </div>
                  <DropdownMenuSeparator />
                </>
              )}
              {isAdmin && (
                <>
                  <DropdownMenuItem onClick={() => navigate('/admin')} className="gap-2">
                    <Users className="h-4 w-4" /> Admin
                  </DropdownMenuItem>
                  <DropdownMenuSeparator />
                </>
              )}
              <DropdownMenuItem
                onClick={signOut}
                className="gap-2 text-destructive focus:text-destructive"
              >
                <LogOut className="h-4 w-4" /> Sign out
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>
    </header>
  );
}
