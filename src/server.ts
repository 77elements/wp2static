/**
 * wp2static Wizard — lokaler Bun-Server.
 * Läuft ausschließlich auf localhost (User-Sovereignty-Regel, siehe AGENTS.md).
 *
 * Flow: Post/Redirect/Get — jede Wizard-Stufe hat eine echte GET-Route,
 * Refresh/Navigation bricht nichts.
 *
 * Dev-Modus (NODE_ENV !== "production"): bun --hot lädt Server-/Template-Code
 * bei Änderung neu; ein fs.watch invalidiert CSS/JS-Caches und signalisiert
 * offenen Browser-Tabs über /__reload, dass sie sich neu laden sollen.
 */

import { compileString } from 'sass';
import { watch } from 'node:fs';
import path from 'node:path';
import { step1, step1Done, sourceForm, sourceSelect, sourceSummary, extractionForm, jobPage } from './ui/pages';
import { slugifySiteName } from './wizard/slug';
import { createSiteDirs, saveJson, loadJson } from './wizard/sites';
import { fetchSitemap, detectSitemap, type SitemapDoc } from './wizard/sitemap';
import { fetchPage, extractPage } from './wizard/extract';
import { createJob, persistJob, loadJob, type Job } from './wizard/jobs';

const ROOT = path.resolve(import.meta.dir, '..');
const PORT = Number(process.env.PORT ?? 4321);
const DEV = process.env.NODE_ENV !== 'production';
const STYLES_DIR = path.join(ROOT, 'src/ui/styles');

let cssCache: string | null = null;

async function css(): Promise<string> {
  if (!cssCache) {
    const source = await Bun.file(path.join(STYLES_DIR, 'main.scss')).text();
    cssCache = compileString(source, { loadPaths: [STYLES_DIR] }).css;
  }
  return cssCache;
}

let jsCache: string | null = null;

async function js(): Promise<string> {
  if (!jsCache) {
    const built = await Bun.build({
      entrypoints: [path.join(ROOT, 'src/ui/main.ts')],
      target: 'browser',
    });
    jsCache = await built.outputs[0].text();
  }
  return jsCache;
}

// ---- Dev live reload ----

let reloadToken = Date.now();
const reloadWaiters: Array<() => void> = [];

function onSourceChange(): void {
  cssCache = null;
  jsCache = null;
  reloadToken = Date.now();
  for (const notify of reloadWaiters.splice(0)) notify();
}

// Guard gegen mehrfache Watcher bei bun --hot (Modul wird neu evaluiert).
const globalFlags = globalThis as typeof globalThis & { __wp2staticWatch?: boolean };

if (DEV && !globalFlags.__wp2staticWatch) {
  globalFlags.__wp2staticWatch = true;
  watch(path.join(ROOT, 'src'), { recursive: true }, () => onSourceChange());
}

function html(body: string, status = 200): Response {
  let content = body;
  if (DEV) {
    const script = `<script>(function(){var t=${reloadToken};setInterval(function(){fetch('/__reload').then(function(r){return r.json()}).then(function(d){if(d.t!==t)location.reload()}).catch(function(){})},1000)})();</script>`;
    content = body.includes('</body>') ? body.replace('</body>', `${script}</body>`) : body + script;
  }
  return new Response(content, { status, headers: { 'content-type': 'text/html; charset=utf-8' } });
}

function redirect(location: string): Response {
  return new Response(null, { status: 303, headers: { location } });
}

// ---- Helpers ----

const delay = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

function validHttpUrl(raw: string): URL | null {
  try {
    const url = new URL(raw);
    return url.protocol === 'http:' || url.protocol === 'https:' ? url : null;
  } catch {
    return null;
  }
}

function slugFromPath(pathname: string): string | null {
  const match = pathname.match(/^\/wizard\/([a-z0-9.-]+)(?:\/|$)/);
  if (!match) return null;
  const slug = match[1];
  return slugifySiteName(slug) === slug ? slug : null;
}

interface SourceState {
  baseUrl: string;
  sitemapUrl: string;
  kind: 'index' | 'urlset';
  children: string[];
}

interface UrlEntry {
  url: string;
  sitemap: string;
}

interface UrlsState {
  baseUrl: string;
  sitemapUrl: string;
  generatedAt: string;
  total: number;
  urls: UrlEntry[];
}

function groupBySitemap(urls: UrlEntry[]): Array<{ source: string; urls: string[] }> {
  const map = new Map<string, string[]>();
  for (const entry of urls) {
    const list = map.get(entry.sitemap) ?? [];
    list.push(entry.url);
    map.set(entry.sitemap, list);
  }
  return [...map.entries()].map(([sitemap, list]) => ({ source: sitemap, urls: list }));
}

async function runCollectJob(slug: string, baseUrl: string, sitemapUrl: string, job: Job): Promise<void> {
  const groups: Array<{ url: string; urls: string[] }> = [];

  try {
    for (const item of job.items) {
      item.status = 'running';
      await persistJob(job);
      try {
        const doc = await fetchSitemap(item.label);
        const urls = doc.kind === 'urlset' ? doc.urls : [];
        groups.push({ url: item.label, urls });
        item.status = 'done';
        item.count = urls.length;
      } catch (error) {
        item.status = 'failed';
        item.error = (error as Error).message;
      }
      await persistJob(job);
      await delay(200);
    }

    if (groups.length) {
      const urls: UrlEntry[] = groups.flatMap((g) => g.urls.map((u) => ({ url: u, sitemap: g.url })));
      await saveJson(slug, 'urls.json', {
        baseUrl,
        sitemapUrl,
        generatedAt: new Date().toISOString(),
        total: urls.length,
        urls,
      });
      job.doneUrl = `/wizard/${slug}/extracted`;
    } else {
      job.doneUrl = `/wizard/${slug}/source/select`;
    }
  } catch (error) {
    job.error = (error as Error).message;
    job.doneUrl = `/wizard/${slug}/source/select`;
  }

  job.status = 'done';
  job.finishedAt = Date.now();
  await persistJob(job);
}

Bun.serve({
  port: PORT,
  hostname: 'localhost',
  async fetch(req) {
    const url = new URL(req.url);

    if (req.method === 'GET' && url.pathname === '/') {
      return html(step1());
    }

    if (req.method === 'GET' && url.pathname === '/main.css') {
      return new Response(await css(), {
        headers: { 'content-type': 'text/css; charset=utf-8', 'cache-control': 'no-store' },
      });
    }

    if (req.method === 'GET' && url.pathname === '/main.js') {
      return new Response(await js(), {
        headers: { 'content-type': 'text/javascript; charset=utf-8', 'cache-control': 'no-store' },
      });
    }

    if (DEV && req.method === 'GET' && url.pathname === '/__reload') {
      return new Response(JSON.stringify({ t: reloadToken }), {
        headers: { 'content-type': 'application/json' },
      });
    }

    // ---- Step 1: Site anlegen ----

    if (req.method === 'POST' && url.pathname === '/wizard/site') {
      const form = await req.formData();
      const slug = slugifySiteName(String(form.get('name') ?? ''));
      if (!slug) {
        return html(step1('Please enter a valid name (letters, numbers, dots, dashes).'), 400);
      }
      await createSiteDirs(slug);
      return redirect(`/wizard/${slug}/done`);
    }

    if (req.method === 'GET' && /^\/wizard\/[a-z0-9.-]+\/done$/.test(url.pathname) && slugFromPath(url.pathname)) {
      const slug = slugFromPath(url.pathname)!;
      const dirs = await createSiteDirs(slug);
      return html(step1Done(slug, dirs));
    }

    // ---- Step 2: Source ----

    if (req.method === 'GET' && url.pathname.endsWith('/source') && !url.pathname.endsWith('/source/select') && slugFromPath(url.pathname)) {
      const slug = slugFromPath(url.pathname)!;
      const state = await loadJson<SourceState>(slug, 'source.json');
      return html(sourceForm(slug, { baseUrl: state?.baseUrl, sitemapUrl: state?.sitemapUrl }));
    }

    if (req.method === 'POST' && url.pathname.endsWith('/source') && !url.pathname.endsWith('/source/select') && slugFromPath(url.pathname)) {
      const slug = slugFromPath(url.pathname)!;
      const form = await req.formData();
      const base = validHttpUrl(String(form.get('baseurl') ?? ''));
      if (!base) {
        return html(sourceForm(slug, { error: 'Please enter a valid base URL (http/https).' }), 400);
      }

      const manualSitemap = String(form.get('sitemapurl') ?? '').trim();
      let found: string;
      let doc: SitemapDoc;

      try {
        if (manualSitemap) {
          const manual = validHttpUrl(manualSitemap);
          if (!manual) throw new Error('Invalid sitemap URL.');
          found = manual.href;
          doc = await fetchSitemap(found);
        } else {
          const detected = await detectSitemap(base.href);
          found = detected.url;
          doc = detected.doc;
        }
      } catch (error) {
        return html(
          sourceForm(slug, { baseUrl: base.href, sitemapUrl: manualSitemap, error: (error as Error).message }),
          502,
        );
      }

      const state: SourceState = {
        baseUrl: base.href,
        sitemapUrl: found,
        kind: doc.kind,
        children: doc.kind === 'index' ? doc.children : [],
      };
      await saveJson(slug, 'source.json', state);

      return redirect(doc.kind === 'urlset' ? `/wizard/${slug}/extracted` : `/wizard/${slug}/source/select`);
    }

    if (req.method === 'GET' && url.pathname.endsWith('/source/select') && slugFromPath(url.pathname)) {
      const slug = slugFromPath(url.pathname)!;
      const state = await loadJson<SourceState>(slug, 'source.json');
      if (!state || state.kind !== 'index') {
        return redirect(`/wizard/${slug}/source`);
      }
      return html(sourceSelect(slug, state.baseUrl, state.sitemapUrl, state.children));
    }

    if (req.method === 'POST' && url.pathname.endsWith('/source/select') && slugFromPath(url.pathname)) {
      const slug = slugFromPath(url.pathname)!;
      const form = await req.formData();
      const base = validHttpUrl(String(form.get('baseurl') ?? ''));
      const sitemapUrl = String(form.get('sitemapurl') ?? '');
      const selected = form.getAll('sitemap').map(String).filter((s) => validHttpUrl(s));

      if (!base || !selected.length) {
        return html(
          sourceSelect(slug, base?.href ?? '', sitemapUrl, selected, 'Select at least one sitemap.'),
          400,
        );
      }

      const job = await createJob({
        slug,
        title: 'Collecting URLs',
        items: selected.map((label) => ({ label, status: 'pending' as const })),
      });
      void runCollectJob(slug, base.href, sitemapUrl, job);

      return redirect(`/wizard/${slug}/jobs/${job.id}`);
    }

    if (req.method === 'GET' && url.pathname.includes('/jobs/') && slugFromPath(url.pathname)) {
      const slug = slugFromPath(url.pathname)!;
      const id = url.pathname.split('/jobs/')[1] ?? '';
      const job = await loadJob(slug);

      if (!job || job.id !== id) {
        const hasUrls = await loadJson<UrlsState>(slug, 'urls.json');
        return redirect(hasUrls ? `/wizard/${slug}/extracted` : `/wizard/${slug}/source`);
      }

      if (job.status === 'running' && Date.now() - job.updatedAt > 60_000) {
        job.status = 'done';
        job.error = 'Job stalled (no progress for 60 s).';
        job.doneUrl = `/wizard/${slug}/source/select`;
        await persistJob(job);
      }

      if (job.status === 'done') {
        return redirect(job.doneUrl ?? `/wizard/${slug}/source`);
      }
      return html(jobPage(slug, job));
    }

    if (req.method === 'GET' && url.pathname.endsWith('/extracted') && slugFromPath(url.pathname)) {
      const slug = slugFromPath(url.pathname)!;
      const state = await loadJson<UrlsState>(slug, 'urls.json');
      if (!state) {
        return redirect(`/wizard/${slug}/source`);
      }
      const counts = new Map<string, number>();
      for (const entry of state.urls) {
        counts.set(entry.sitemap, (counts.get(entry.sitemap) ?? 0) + 1);
      }
      return html(
        sourceSummary(slug, {
          baseUrl: state.baseUrl,
          groups: [...counts.entries()].map(([sitemap, count]) => ({ url: sitemap, count })),
          total: state.total,
        }),
      );
    }

    // ---- Step 3: Extraction preview ----

    if (req.method === 'GET' && url.pathname.endsWith('/extract') && !url.pathname.endsWith('/extracted') && slugFromPath(url.pathname)) {
      const slug = slugFromPath(url.pathname)!;
      const state = await loadJson<UrlsState>(slug, 'urls.json');
      if (!state) {
        return html(sourceForm(slug, { error: 'No URLs collected yet — run the source step first.' }), 400);
      }
      const selectedUrl = url.searchParams.get('url') ?? state.urls[0]?.url ?? '';
      return html(extractionForm(slug, { groups: groupBySitemap(state.urls), selectedUrl }));
    }

    if (req.method === 'POST' && url.pathname.endsWith('/extract') && !url.pathname.endsWith('/extracted') && slugFromPath(url.pathname)) {
      const slug = slugFromPath(url.pathname)!;
      const form = await req.formData();
      const state = await loadJson<UrlsState>(slug, 'urls.json');
      if (!state) {
        return html(sourceForm(slug, { error: 'No URLs collected yet — run the source step first.' }), 400);
      }

      const target = String(form.get('url') ?? '');
      const selectors = String(form.get('selectors') ?? '');
      const groups = groupBySitemap(state.urls);

      if (!validHttpUrl(target) || !state.urls.some((e) => e.url === target)) {
        return html(extractionForm(slug, { groups, selectedUrl: target, selectors, error: 'Pick a URL from the list.' }), 400);
      }

      try {
        const pageHtml = await fetchPage(target);
        const result = extractPage(pageHtml, target, selectors.split(','));
        return html(extractionForm(slug, { groups, selectedUrl: target, selectors, result }));
      } catch (error) {
        return html(extractionForm(slug, { groups, selectedUrl: target, selectors, error: (error as Error).message }), 502);
      }
    }

    return new Response('Not found', { status: 404 });
  },
});

// Bewacht den Prozess: ein vergessenes await darf den Wizard nicht silent killen.
process.on('unhandledRejection', (reason) => {
  console.error('Unhandled rejection:', reason);
});

console.log(`wp2static wizard → http://localhost:${PORT}${DEV ? ' (dev, live reload on)' : ''}`);
