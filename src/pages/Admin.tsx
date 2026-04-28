/**
 * Admin — tabbed admin console. Shares the global AppHeader with the rest of
 * the app and shows a "Back to dashboard" link below the header. New tabs
 * (System, Stats, etc.) can be added by appending to the tabs list.
 */
import { Link, Navigate } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { ArrowLeft } from 'lucide-react';
import { AppHeader } from '@/components/AppHeader';
import { UsersPanel } from '@/components/admin/UsersPanel';

export default function Admin() {
  const { isAdmin, loading } = useAuth();

  if (loading) return null;
  if (!isAdmin) return <Navigate to="/" replace />;

  return (
    <div className="min-h-screen bg-background">
      <AppHeader />

      <main className="mx-auto max-w-6xl px-6 py-8">
        <div className="mb-6 flex items-center justify-between">
          <Link
            to="/"
            className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground"
          >
            <ArrowLeft className="h-4 w-4" /> Back to dashboard
          </Link>
        </div>

        <div className="mb-6">
          <h2 className="text-2xl font-semibold">Admin</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Manage users and platform settings.
          </p>
        </div>

        <Tabs defaultValue="users">
          <TabsList>
            <TabsTrigger value="users">Users</TabsTrigger>
          </TabsList>
          <TabsContent value="users" className="mt-6">
            <UsersPanel />
          </TabsContent>
        </Tabs>
      </main>
    </div>
  );
}
