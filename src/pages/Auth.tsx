/**
 * Auth page — sign in / sign up against the MASTER Supabase project.
 * Email + password only (no auto-confirm; users verify by email).
 */
import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card } from '@/components/ui/card';

import { useToast } from '@/hooks/use-toast';
import { Layers } from 'lucide-react';

export default function Auth() {
  const navigate = useNavigate();
  const { session, loading } = useAuth();
  const { toast } = useToast();

  const mode = 'signin' as const;
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [resetting, setResetting] = useState(false);

  async function handleForgotPassword() {
    if (!email) {
      toast({
        title: 'Enter your email first',
        description: 'Type the email above, then click "Forgot password" again.',
        variant: 'destructive',
      });
      return;
    }
    setResetting(true);
    try {
      const { error } = await supabase.auth.resetPasswordForEmail(email, {
        redirectTo: `${window.location.origin}/reset-password`,
      });
      if (error) throw error;
      toast({
        title: 'Check your email',
        description: 'We sent you a link to reset your password.',
      });
    } catch (err) {
      toast({
        title: 'Could not send reset email',
        description: err instanceof Error ? err.message : 'Unknown error',
        variant: 'destructive',
      });
    } finally {
      setResetting(false);
    }
  }

  useEffect(() => {
    if (!loading && session) navigate('/', { replace: true });
  }, [loading, session, navigate]);

  async function handleEmail(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    try {
      if (mode === 'signin') {
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) throw error;
        toast({ title: 'Welcome back!' });
        navigate('/', { replace: true });
      } else {
        const { error } = await supabase.auth.signUp({
          email,
          password,
          options: { emailRedirectTo: window.location.origin },
        });
        if (error) throw error;
        toast({
          title: 'Check your email',
          description: 'Click the verification link to finish signing up.',
        });
      }
    } catch (err) {
      toast({
        title: mode === 'signin' ? 'Sign-in failed' : 'Sign-up failed',
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
            <p className="text-xs text-muted-foreground">Thin Client</p>
          </div>
        </div>

        <Card className="p-6">
          <p className="text-sm text-muted-foreground">
            Welcome back — sign in to access your sites.
          </p>

          <form onSubmit={handleEmail} className="mt-5 flex flex-col gap-4">
            <div className="flex flex-col gap-2">
              <Label htmlFor="email">Email</Label>
              <Input
                id="email"
                type="email"
                autoComplete="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
              />
            </div>
            <div className="flex flex-col gap-2">
              <Label htmlFor="password">Password</Label>
              <Input
                id="password"
                type="password"
                autoComplete={mode === 'signin' ? 'current-password' : 'new-password'}
                required
                minLength={6}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
              />
            </div>
            <Button type="submit" disabled={busy}>
              {busy ? 'Working…' : mode === 'signin' ? 'Sign in' : 'Create account'}
            </Button>
            {mode === 'signin' && (
              <button
                type="button"
                onClick={handleForgotPassword}
                disabled={resetting}
                className="self-center text-xs text-muted-foreground underline-offset-4 hover:text-foreground hover:underline disabled:opacity-50"
              >
                {resetting ? 'Sending reset link…' : 'Forgot password?'}
              </button>
            )}
          </form>

        </Card>
      </div>
    </div>
  );
}
