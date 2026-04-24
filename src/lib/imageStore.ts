/**
 * Image store — Supabase-backed CRUD for per-site image library.
 * Talks to the master Supabase project (shared backend).
 */
import { supabase } from '@/integrations/supabase/client';

export type ImageSource = 'upload' | 'ai' | 'unsplash';

export interface SiteImage {
  id: string;
  siteId: string;
  source: ImageSource;
  url: string;
  alt: string;
  prompt: string | null;
  slot: string | null;
  width: number | null;
  height: number | null;
  storagePath: string | null;
  createdAt: string;
}

interface SiteImageRow {
  id: string;
  site_id: string;
  source: string;
  url: string;
  alt: string;
  prompt: string | null;
  slot: string | null;
  width: number | null;
  height: number | null;
  storage_path: string | null;
  created_at: string;
}

function rowToImage(row: SiteImageRow): SiteImage {
  return {
    id: row.id,
    siteId: row.site_id,
    source: row.source as ImageSource,
    url: row.url,
    alt: row.alt,
    prompt: row.prompt,
    slot: row.slot,
    width: row.width,
    height: row.height,
    storagePath: row.storage_path,
    createdAt: row.created_at,
  };
}

export async function listSiteImages(siteId: string): Promise<SiteImage[]> {
  const { data, error } = await supabase
    .from('site_images')
    .select('*')
    .eq('site_id', siteId)
    .order('created_at', { ascending: false });
  if (error) {
    console.error('[imageStore] listSiteImages failed', error);
    return [];
  }
  return (data ?? []).map((r) => rowToImage(r as SiteImageRow));
}

export async function uploadSiteImage(
  siteId: string,
  file: File,
  opts: { alt?: string; slot?: string } = {}
): Promise<SiteImage | null> {
  const { data: userData } = await supabase.auth.getUser();
  const userId = userData.user?.id;
  if (!userId) {
    console.error('[imageStore] uploadSiteImage: not authenticated');
    return null;
  }

  const ext = file.name.split('.').pop()?.toLowerCase() || 'jpg';
  const path = `${userId}/${siteId}/${crypto.randomUUID()}.${ext}`;
  const { error: upErr } = await supabase.storage
    .from('site-images')
    .upload(path, file, { contentType: file.type, upsert: false });
  if (upErr) {
    console.error('[imageStore] storage upload failed', upErr);
    return null;
  }
  const { data: pub } = supabase.storage.from('site-images').getPublicUrl(path);

  const { data: row, error: insErr } = await supabase
    .from('site_images')
    .insert({
      site_id: siteId,
      user_id: userId,
      source: 'upload',
      url: pub.publicUrl,
      alt: opts.alt ?? file.name.replace(/\.[^.]+$/, ''),
      slot: opts.slot ?? null,
      storage_path: path,
    })
    .select()
    .single();
  if (insErr) {
    console.error('[imageStore] db insert failed', insErr);
    await supabase.storage.from('site-images').remove([path]);
    return null;
  }
  return rowToImage(row as SiteImageRow);
}

export async function generateSiteImage(
  siteId: string,
  opts: { prompt: string; alt?: string; slot?: string }
): Promise<{ image: SiteImage | null; error: string | null }> {
  const { data, error } = await supabase.functions.invoke('generate-site-image', {
    body: { siteId, prompt: opts.prompt, alt: opts.alt, slot: opts.slot },
  });
  if (error) {
    console.error('[imageStore] generateSiteImage failed', error);
    return { image: null, error: error.message ?? 'AI generation failed' };
  }
  if (!data?.url) {
    return { image: null, error: 'No image returned' };
  }
  const { data: row } = await supabase
    .from('site_images')
    .select('*')
    .eq('id', data.id)
    .maybeSingle();
  return { image: row ? rowToImage(row as SiteImageRow) : null, error: null };
}

export async function updateSiteImage(
  id: string,
  patch: { alt?: string; slot?: string | null }
): Promise<SiteImage | null> {
  const row: { alt?: string; slot?: string | null } = {};
  if (patch.alt !== undefined) row.alt = patch.alt;
  if (patch.slot !== undefined) row.slot = patch.slot;
  const { data, error } = await supabase
    .from('site_images')
    .update(row)
    .eq('id', id)
    .select()
    .single();
  if (error) {
    console.error('[imageStore] updateSiteImage failed', error);
    return null;
  }
  return rowToImage(data as SiteImageRow);
}

export async function deleteSiteImage(image: SiteImage): Promise<void> {
  if (image.storagePath) {
    await supabase.storage.from('site-images').remove([image.storagePath]).catch(() => {});
  }
  const { error } = await supabase.from('site_images').delete().eq('id', image.id);
  if (error) console.error('[imageStore] deleteSiteImage failed', error);
}

export function imagesBySlot(images: SiteImage[]): Record<string, SiteImage> {
  const out: Record<string, SiteImage> = {};
  const sorted = [...images].sort((a, b) => a.createdAt.localeCompare(b.createdAt));
  for (const img of sorted) {
    if (img.slot) out[img.slot] = img;
  }
  return out;
}
