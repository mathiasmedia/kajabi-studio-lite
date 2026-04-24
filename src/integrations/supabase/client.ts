/**
 * Supabase client — points at the MASTER Kajabi Export Kit project.
 *
 * This thin client deliberately does NOT use its own Lovable Cloud backend
 * (no VITE_SUPABASE_* env vars). The master is the single source of truth
 * for users + sites. URL and anon key are public, safe to commit.
 */
import { createClient } from '@supabase/supabase-js';

const MASTER_SUPABASE_URL = 'https://iqxcgazfrydubrvxmnlv.supabase.co';
const MASTER_SUPABASE_ANON_KEY =
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImlxeGNnYXpmcnlkdWJydnhtbmx2Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzY3MTU4MzksImV4cCI6MjA5MjI5MTgzOX0.fQos60vdeCcIV9oUtIsQdU4XJDGlsxjySsNvdA7iL6Q';

export const supabase = createClient(MASTER_SUPABASE_URL, MASTER_SUPABASE_ANON_KEY, {
  auth: {
    storage: localStorage,
    persistSession: true,
    autoRefreshToken: true,
  },
});
