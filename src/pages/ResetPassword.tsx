/**
 * Reset password page — destination of the recovery email link.
 *
 * Supabase parses the `type=recovery` access token from the URL hash and
 * fires a PASSWORD_RECOVERY event. We let the user set a new password and
 * then redirect them home.
 */
import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card } from '@/components/ui/card';
import { useToast } from '@/hooks/use-toast';
import { Layers } from 'lucide-react';

export default function ResetPassword() {
  const navigate = useNavigate();
  const { toast } = useToast();
  const [ready, setReady] = useState(false);
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    // Supabase auto-handles the hash; just confirm a recovery session exists.
    const { data: sub } = supabase.auth.onAuthStateChange((event) => {
      if (event === 'PASSWORD_RECOVERY' || event === 'SIGNED_IN') setReady(true);
    });
    supabase.auth.getSession().then(({ data }) => {
      if (data.session) setReady(true);
    });
    return () => sub.subscription.unsubscribe();
  }, []);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    try {
      const { error } = await supabase.auth.updateUser({ password });
      if (error) throw error;
      toast({ title: 'Password updated', description: 'You are now signed in.' });
      navigate('/', { replace: true });
    } catch (err) {
      toast({
        title: 'Could not update password',
        description: err instanceof Error ? err.message : 'Unknown error',
        variant: 'destructive',
      });
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <div className="w-full max-w-md">
        <div className="mb-6 flex items-center justify-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-md bg-primary text-primary-foreground">
            <Layers className="h-5 w-5" />
          </div>
          <div>
            <h1 className="text-lg font-semibold leading-tight">Kajabi Studio</h1>
            <p className="text-xs text-muted-foreground">Reset password</p>
          </div>
        </div>

        <Card className="p-6">
          {!ready ? (
            <p className="text-sm text-muted-foreground">
              Verifying your reset link… If this hangs, request a new link from the sign-in page.
            </p>
          ) : (
            <form onSubmit={handleSubmit} className="flex flex-col gap-4">
              <div className="flex flex-col gap-2">
                <Label htmlFor="password">New password</Label>
                <Input
                  id="password"
                  type="password"
                  autoComplete="new-password"
                  required
                  minLength={6}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                />
              </div>
              <Button type="submit" disabled={busy}>
                {busy ? 'Updating…' : 'Update password'}
              </Button>
            </form>
          )}
        </Card>
      </div>
    </div>
  );
}
