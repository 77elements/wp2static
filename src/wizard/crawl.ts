/**
 * Voll-Lauf: alle URLs einer Site sequenziell scrapen und nach content/
 * schreiben (HTML + Frontmatter), RSS-Feed als statischen Snapshot sichern.
 *
 * Läuft als Child-Process (crawl-job.ts) — überlebt bun --hot-Reloads des
 * Servers; Fortschritt ausschließlich über data/job.json (gleicher Mechanismus
 * wie Collect). Raw-HTML-Cache auf Platte: Re-Läufe fetchen nicht erneut.
 * Politeness: sequenziell, Delay zwischen Requests, Retry mit Backoff,
 * fail-soft pro Seite.
 */

import { fetchPage, extractPage } from './extract';
import { buildContent, fileSlugFromUrl, typeFromSitemap } from './content';
import { loadRules } from './blocks';
import { loadJob, persistJob, type Job } from './jobs';
import { loadJson, siteDir } from './sites';

const delay = (ms: number): Promise<void> => new Promise((resolve) => setTimeout(resolve, ms));

async function fetchWithRetry(url: string, retries = 2): Promise<string> {
  for (let attempt = 0; ; attempt++) {
    try {
      return await fetchPage(url);
    } catch (error) {
      if (attempt >= retries) throw error;
      await delay(2000 * 2 ** attempt);
    }
  }
}

interface CrawlConfig {
  contentSelectors?: string;
  delayMs?: number;
  rssUrl?: string;
}

interface UrlsState {
  baseUrl: string;
  urls: Array<{ url: string; sitemap: string }>;
}

const cachePath = (slug: string, url: string): string => {
  const hasher = new Bun.CryptoHasher('sha256');
  hasher.update(url);
  return `${siteDir(slug)}/cache/${hasher.digest('hex').slice(0, 32)}.html`;
};

/** Raw-HTML-Cache: Key ist der SHA-256 der URL — Re-Läufe berühren das Netz
 *  nur beim Cache-Miss. */
async function cachedFetch(slug: string, url: string): Promise<string> {
  const path = cachePath(slug, url);
  const cached = Bun.file(path);
  if (await cached.exists()) return cached.text();
  const html = await fetchWithRetry(url);
  await Bun.write(path, html);
  return html;
}

const RSS_ITEM_LABEL = 'RSS feed';

async function saveRssFeed(slug: string, baseUrl: string, config: CrawlConfig, item: Job['items'][number]): Promise<void> {
  const candidates = config.rssUrl
    ? [config.rssUrl]
    : [new URL('feed/', baseUrl).href, new URL('blog/feed/', baseUrl).href];
  for (const candidate of candidates) {
    try {
      const xml = await fetchWithRetry(candidate, 1);
      await Bun.write(`${siteDir(slug)}/data/rss.xml`, xml);
      item.status = 'done';
      item.count = 1;
      return;
    } catch {
      // nächster Kandidat
    }
  }
  item.status = 'failed';
  item.error = `No feed at ${candidates.join(', ')}`;
}

export async function crawlSite(slug: string, jobId: string, limit = 0): Promise<void> {
  const job = await loadJob(slug);
  if (!job || job.id !== jobId) throw new Error(`Job ${jobId} not found for ${slug}`);
  const urls = await loadJson<UrlsState>(slug, 'urls.json');
  if (!urls) throw new Error('No URLs collected — run the source step first.');
  const config = (await loadJson<CrawlConfig>(slug, 'config.json')) ?? {};
  const rules = await loadRules(slug);
  const sitemapOf = new Map(urls.urls.map((e) => [e.url, e.sitemap]));
  const delayMs = Math.max(400, config.delayMs ?? 400);

  const urlItems = job.items.filter((i) => i.label !== RSS_ITEM_LABEL);
  const rssItem = job.items.find((i) => i.label === RSS_ITEM_LABEL);
  const targets = limit > 0 ? urlItems.slice(0, limit) : urlItems;

  try {
    for (const item of targets) {
      item.status = 'running';
      await persistJob(job);
      try {
        const html = await cachedFetch(slug, item.label);
        const type = typeFromSitemap(sitemapOf.get(item.label) ?? '');
        const page = extractPage(html, item.label, (config.contentSelectors ?? '').split(','));
        const content = buildContent(page, rules, type);
        const path = `${siteDir(slug)}/content/${type}/${fileSlugFromUrl(item.label)}.html`;
        await Bun.write(path, `${content.frontmatter}\n${content.articleHtml}\n`);
        item.status = 'done';
        item.count = 1;
      } catch (error) {
        item.status = 'failed';
        item.error = (error as Error).message.slice(0, 300);
      }
      await persistJob(job);
      await delay(delayMs);
    }

    // RSS-Feed als 1:1-Snapshot (nur im echten Lauf, nicht im Dry-Run).
    if (rssItem && limit === 0) {
      rssItem.status = 'running';
      await persistJob(job);
      await saveRssFeed(slug, urls.baseUrl, config, rssItem);
      await persistJob(job);
    }

    job.doneUrl = `/wizard/${slug}/content`;
  } catch (error) {
    job.error = (error as Error).message;
    job.doneUrl = `/wizard/${slug}/run`;
  }

  job.status = 'done';
  job.finishedAt = Date.now();
  await persistJob(job);
}
