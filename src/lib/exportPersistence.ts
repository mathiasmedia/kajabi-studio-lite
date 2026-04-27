/**
 * Export persistence — uploads a freshly-built Kajabi theme zip to the
 * `site-exports` storage bucket and updates the site row with a stable
 * public URL pointing at the latest build.
 *
 * Storage layout per export:
 *   <userId>/<siteId>/latest.zip                  ← stable pointer (upserted)
 *   <userId>/<siteId>/history/<ISO-timestamp>.zip ← immutable archive
 *
 * The `latest.zip` URL is stable forever — copy it once, share it anywhere,
 * it always resolves to the most recent export.
 *
 * This runs in parallel with the user-facing local download; failures here
 * never block the local download.
 */
import { supabase } from '@/integrations/supabase/client';
import { updateSite, type Site } from './siteStore';

const BUCKET = 'site-exports';

export interface PersistExportResult {
  ok: boolean;
  /** Public URL of `latest.zip` after the upload, or null if it failed. */
  latestUrl: string | null;
  /** ISO timestamp recorded on the site row, or null if it failed. */
  latestAt: string | null;
  /** Human-readable error if `ok` is false. */
  error?: string;
}

/**
 * Upload `blob` as both the stable `latest.zip` and a timestamped history
 * archive, then patch the site row with the new public URL + timestamp.
 *
 * Returns success status; toasts/UI feedback is the caller's responsibility.
 */
export async function persistExportZip(
  site: Pick<Site, 'id' | 'userId'>,
  blob: Blob,
): Promise<PersistExportResult> {
  try {
    const now = new Date();
    const stamp = now.toISOString().replace(/[:.]/g, '-');
    const folder = `${site.userId}/${site.id}`;
    const latestPath = `${folder}/latest.zip`;
    const historyPath = `${folder}/history/${stamp}.zip`;

    // Upload latest.zip (overwrite). Run history upload in parallel.
    const [latestUp, historyUp] = await Promise.all([
      supabase.storage.from(BUCKET).upload(latestPath, blob, {
        contentType: 'application/zip',
        upsert: true,
        cacheControl: '0', // Never cache — clients should always get the freshest build.
      }),
      supabase.storage.from(BUCKET).upload(historyPath, blob, {
        contentType: 'application/zip',
        upsert: false,
        cacheControl: '31536000', // History items are immutable, cache forever.
      }),
    ]);

    if (latestUp.error) {
      return {
        ok: false,
        latestUrl: null,
        latestAt: null,
        error: `latest.zip upload failed: ${latestUp.error.message}`,
      };
    }
    // History collisions are harmless — keep going.
    if (historyUp.error && !/(already exists|duplicate|conflict)/i.test(historyUp.error.message)) {
      console.warn('[exportPersistence] history upload failed (non-fatal):', historyUp.error);
    }

    const { data: pub } = supabase.storage.from(BUCKET).getPublicUrl(latestPath);
    // Cache-bust the URL we save on the row so consumers who copy it from the
    // editor see the freshest build even if they previously cached latest.zip.
    const latestUrl = `${pub.publicUrl}?v=${stamp}`;
    const latestAt = now.toISOString();

    const updated = await updateSite(site.id, {
      latestExportUrl: latestUrl,
      latestExportAt: latestAt,
    });
    if (!updated) {
      return {
        ok: false,
        latestUrl,
        latestAt,
        error: 'Uploaded but failed to update site row',
      };
    }

    return { ok: true, latestUrl, latestAt };
  } catch (e) {
    const message = e instanceof Error ? e.message : 'Unknown error';
    console.error('[exportPersistence] persistExportZip failed:', e);
    return { ok: false, latestUrl: null, latestAt: null, error: message };
  }
}

/** Format an ISO timestamp as a short relative time (e.g. "2 min ago"). */
export function formatRelativeTime(iso: string | null): string {
  if (!iso) return '';
  const then = new Date(iso).getTime();
  if (Number.isNaN(then)) return '';
  const diffMs = Date.now() - then;
  const sec = Math.max(0, Math.round(diffMs / 1000));
  if (sec < 5) return 'just now';
  if (sec < 60) return `${sec}s ago`;
  const min = Math.round(sec / 60);
  if (min < 60) return `${min} min ago`;
  const hr = Math.round(min / 60);
  if (hr < 24) return `${hr}h ago`;
  const day = Math.round(hr / 24);
  if (day < 30) return `${day}d ago`;
  const mo = Math.round(day / 30);
  if (mo < 12) return `${mo}mo ago`;
  return `${Math.round(mo / 12)}y ago`;
}
