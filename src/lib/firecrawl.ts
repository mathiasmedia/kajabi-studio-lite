/**
 * Firecrawl client — proxies to the master app's `firecrawl-scrape` edge
 * function via X-App-Token. The thin client never holds the Firecrawl key.
 */
import { callMaster } from './masterApi';

type Action = 'scrape' | 'search' | 'map' | 'crawl';

interface FirecrawlResponse<T = unknown> {
  success: boolean;
  error?: string;
  data?: T;
  [k: string]: unknown;
}

async function call<T = unknown>(action: Action, payload: Record<string, unknown>): Promise<FirecrawlResponse<T>> {
  try {
    const data = await callMaster<FirecrawlResponse<T>>('firecrawl-scrape', { action, payload });
    return data ?? { success: false, error: 'Empty response' };
  } catch (e) {
    return { success: false, error: e instanceof Error ? e.message : 'Firecrawl call failed' };
  }
}

export const firecrawlApi = {
  scrape: (url: string, options?: Record<string, unknown>) =>
    call('scrape', { url, ...(options ?? {}) }),
  search: (query: string, options?: Record<string, unknown>) =>
    call('search', { query, ...(options ?? {}) }),
  map: (url: string, options?: Record<string, unknown>) =>
    call('map', { url, ...(options ?? {}) }),
  crawl: (url: string, options?: Record<string, unknown>) =>
    call('crawl', { url, ...(options ?? {}) }),
};
