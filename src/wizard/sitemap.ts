/**
 * Sitemap fetching/parsing.
 * Detects sitemapindex vs urlset, resolves locs against the sitemap URL.
 */

import * as cheerio from 'cheerio';

export type SitemapDoc =
  | { kind: 'index'; children: string[] }
  | { kind: 'urlset'; urls: string[] };

const UA = 'wp2static/0.1 (local converter)';

export async function fetchSitemap(url: string): Promise<SitemapDoc> {
  const res = await fetch(url, {
    headers: { 'user-agent': UA },
    signal: AbortSignal.timeout(15_000),
  });
  if (!res.ok) throw new Error(`HTTP ${res.status} for ${url}`);
  return parseSitemap(await res.text(), url);
}

export function parseSitemap(xml: string, baseUrl: string): SitemapDoc {
  const $ = cheerio.load(xml, { xmlMode: true });

  const absolute = (loc: string): string => {
    try {
      return new URL(loc, baseUrl).href;
    } catch {
      return loc;
    }
  };

  if ($('sitemapindex').length > 0) {
    const children = [
      ...new Set($('sitemapindex > sitemap > loc').map((_, el) => absolute($(el).text().trim())).get()),
    ].filter(Boolean);
    if (children.length === 0) throw new Error(`Sitemap index at ${baseUrl} contains no sitemap entries`);
    return { kind: 'index', children };
  }

  if ($('urlset').length > 0) {
    const urls = [
      ...new Set($('urlset > url > loc').map((_, el) => absolute($(el).text().trim())).get()),
    ].filter(Boolean);
    if (urls.length === 0) throw new Error(`Sitemap at ${baseUrl} contains no URLs`);
    return { kind: 'urlset', urls };
  }

  throw new Error(`${baseUrl} is not a sitemap (no sitemapindex/urlset)`);
}

const AUTO_DETECT_PATHS = ['/sitemap.xml', '/wp-sitemap.xml', '/sitemap_index.xml'];

export async function detectSitemap(baseUrl: string): Promise<{ url: string; doc: SitemapDoc }> {
  const base = baseUrl.replace(/\/+$/, '');
  let lastError: Error | null = null;

  for (const candidate of AUTO_DETECT_PATHS) {
    const url = base + candidate;
    try {
      return { url, doc: await fetchSitemap(url) };
    } catch (error) {
      lastError = error as Error;
    }
  }

  throw lastError ?? new Error(`No sitemap found at ${base}`);
}
