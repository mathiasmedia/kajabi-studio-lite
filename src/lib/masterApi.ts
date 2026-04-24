/**
 * Master-app fetch helper.
 *
 * The thin client doesn't have its own backend — instead it talks to the
 * master Kajabi Export Kit's Supabase Edge Functions (generate-site-image,
 * firecrawl-scrape) using a shared `X-App-Token` header.
 *
 * Configure via env vars:
 *   - VITE_MASTER_SUPABASE_URL    e.g. https://xxxx.supabase.co
 *   - VITE_THIN_CLIENT_APP_TOKEN  shared secret matching the master's
 *                                  THIN_CLIENT_APP_TOKEN env var
 */
const MASTER_URL = 'https://iqxcgazfrydubrvxmnlv.supabase.co';
const APP_TOKEN = 'tca_live_4f8d9c1a7b2e6f30c5a91d7e8b4f2c6a9e1d3b7f5c8a2e6d';

export function masterConfigured(): boolean {
  return true;
}

export function masterFunctionUrl(name: string): string {
  return `${MASTER_URL.replace(/\/$/, '')}/functions/v1/${name}`;
}

/**
 * POST a JSON body to a master edge function with the X-App-Token header.
 * Returns parsed JSON or throws with the server-supplied error message.
 */
export async function callMaster<T = unknown>(
  fn: 'generate-site-image' | 'firecrawl-scrape',
  body: Record<string, unknown>,
): Promise<T> {
  const res = await fetch(masterFunctionUrl(fn), {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-App-Token': APP_TOKEN,
    },
    body: JSON.stringify(body),
  });
  const text = await res.text();
  let data: unknown = null;
  try {
    data = text ? JSON.parse(text) : null;
  } catch {
    // non-JSON response
  }
  if (!res.ok) {
    const msg =
      (data && typeof data === 'object' && 'error' in data && typeof (data as { error: unknown }).error === 'string'
        ? (data as { error: string }).error
        : null) ?? `Master ${fn} failed: ${res.status}`;
    throw new Error(msg);
  }
  return data as T;
}
