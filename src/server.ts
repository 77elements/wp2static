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
import { step1, step1Done, sourceForm, sourceSelect, sourceSummary, extractionForm, jobPage, structurePage, runGatePage, contentSummaryPage } from './ui/pages';
import { slugifySiteName } from './wizard/slug';
import { createSiteDirs, saveJson, loadJson, siteDir } from './wizard/sites';
import { fetchSitemap, detectSitemap, type SitemapDoc } from './wizard/sitemap';
import { fetchPage, extractPage } from './wizard/extract';
import { createJob, persistJob, loadJob, type Job } from './wizard/jobs';
import { BLOCK_LABELS, blockClasses, loadRules, matchLabel, saveRule, suggestLabel, type BlockLabel } from './wizard/blocks';
import { extractNavigation, extractLogo, extractFooter, type SiteStructure } from './wizard/structure';

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

function json(data: unknown): Response {
  return new Response(JSON.stringify(data), {
    headers: { 'content-type': 'application/json; charset=utf-8' },
  });
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

interface PreviewState {
  url: string;
  selectors: string;
  generatedAt: string;
  result: {
    url: string;
    title: string;
    description: string;
    datePublished: string;
    selectorUsed: string;
    html: string;
    blocks: Array<{ origClass: string; html: string }>;
  };
}

// Vom User festgelegte Site-Parameter (Wizard-Schritt 3, gilt für alle Seiten).
interface SiteConfig {
  contentSelectors: string;
  navSelector?: string;
  footerSelector?: string;
  delayMs?: number;
  rssUrl?: string;
}

interface RunState {
  groups: Record<string, { approved: boolean; approvedAt?: string }>;
}

interface PreviewsState {
  urls: Array<{ url: string; at: string }>;
}

interface LabeledBlock {
  origClass: string;
  html: string;
  current: string | null;
  suggested: string;
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

// Hängengebliebene Jobs (z. B. Server-Restart unter bun --hot killt den
// laufenden Task) markieren — sonst pollt die Fortschrittsseite für immer.
// 180 s: ein Crawl-Item kann mit Timeouts + Retry-Backoff ~100 s brauchen.
async function resolveJob(slug: string, job: Job): Promise<Job> {
  if (job.status === 'running' && Date.now() - job.updatedAt > 180_000) {
    job.status = 'done';
    job.error = 'Job stalled — no progress for 180 s (server restart?). Restart it from the Full run page.';
    job.doneUrl = job.doneUrl ?? job.fallbackUrl ?? `/wizard/${slug}/source/select`;
    await persistJob(job);
  }
  return job;
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
        fallbackUrl: `/wizard/${slug}/source/select`,
      });
      void runCollectJob(slug, base.href, sitemapUrl, job);

      return redirect(`/wizard/${slug}/jobs/${job.id}`);
    }

    if (req.method === 'GET' && /^\/wizard\/[a-z0-9.-]+\/jobs\/[^/]+\/status$/.test(url.pathname) && slugFromPath(url.pathname)) {
      const slug = slugFromPath(url.pathname)!;
      const id = url.pathname.split('/jobs/')[1]!.split('/')[0]!;
      const job = await loadJob(slug);
      if (!job || job.id !== id) return new Response('Not found', { status: 404 });
      await resolveJob(slug, job);
      return json({
        id: job.id,
        status: job.status,
        error: job.error ?? null,
        doneUrl: job.doneUrl ?? null,
        updatedAt: job.updatedAt,
        items: job.items,
      });
    }

    if (req.method === 'GET' && url.pathname.includes('/jobs/') && slugFromPath(url.pathname)) {
      const slug = slugFromPath(url.pathname)!;
      const id = url.pathname.split('/jobs/')[1] ?? '';
      const job = await loadJob(slug);

      if (!job || job.id !== id) {
        const hasUrls = await loadJson<UrlsState>(slug, 'urls.json');
        return redirect(hasUrls ? `/wizard/${slug}/extracted` : `/wizard/${slug}/source`);
      }

      await resolveJob(slug, job);

      if (job.status === 'done' && !job.error) {
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

    if (req.method === 'POST' && url.pathname.endsWith('/label') && slugFromPath(url.pathname)) {
      const slug = slugFromPath(url.pathname)!;
      const form = await req.formData();
      const target = String(form.get('url') ?? '');
      const block = Number(form.get('block') ?? -1);
      const origClass = String(form.get('origclass') ?? '');
      const label = String(form.get('label') ?? '');
      const base = validHttpUrl(target);
      if (!base || block < 0 || !BLOCK_LABELS.includes(label as BlockLabel)) {
        return html(sourceForm(slug, { error: 'Invalid block label request.' }), 400);
      }
      // Mit Original-Klassen: site-weite Regel (Fingerprint). Ohne: Einzelfall.
      const match = blockClasses(origClass);
      await saveRule(slug, {
        match,
        url: match.length ? undefined : base.href,
        block: match.length ? undefined : block,
        label: label as BlockLabel,
      });
      return redirect(`/wizard/${slug}/extract?url=${encodeURIComponent(base.href)}#block-${block}`);
    }

    if (req.method === 'GET' && url.pathname.endsWith('/extract') && !url.pathname.endsWith('/extracted') && slugFromPath(url.pathname)) {
      const slug = slugFromPath(url.pathname)!;
      const state = await loadJson<UrlsState>(slug, 'urls.json');
      if (!state) {
        return html(sourceForm(slug, { error: 'No URLs collected yet — run the source step first.' }), 400);
      }
      const preview = await loadJson<PreviewState>(slug, 'preview.json');
      const config = await loadJson<SiteConfig>(slug, 'config.json');
      const selectedUrl = url.searchParams.get('url') ?? preview?.url ?? state.urls[0]?.url ?? '';
      let labeledBlocks: LabeledBlock[] = [];
      if (preview?.result.blocks?.length) {
        const rules = await loadRules(slug);
        labeledBlocks = preview.result.blocks.map((block, index) => {
          const current = matchLabel(rules, block, preview.result.url, index);
          return { ...block, current, suggested: current ?? suggestLabel(block, preview.result.title) };
        });
      } else if (preview?.result) {
        labeledBlocks = [{ ...preview.result, origClass: '', current: null, suggested: 'article' }];
      }
      return html(
        extractionForm(slug, {
          groups: groupBySitemap(state.urls),
          selectedUrl,
          selectors: config?.contentSelectors ?? '',
          result: preview?.result,
          labeledBlocks,
        }),
      );
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

      // Der Selektor ist eine Site-Entscheidung — mit jedem Preview-POST
      // gespeichert und später im Voll-Lauf für alle Seiten benutzt.
      const existing = await loadJson<SiteConfig>(slug, 'config.json');
      const config: SiteConfig = { ...existing, contentSelectors: selectors };
      await saveJson(slug, 'config.json', config);

      try {
        const pageHtml = await fetchPage(target);
        const result = extractPage(pageHtml, target, selectors.split(','));
        const preview: PreviewState = {
          url: target,
          selectors,
          result,
          generatedAt: new Date().toISOString(),
        };
        await saveJson(slug, 'preview.json', preview);
        // Preview-Historie für das Voll-Lauf-Gate (pro Content-Gruppe ≥ 1 Preview).
        const history = (await loadJson<PreviewsState>(slug, 'previews.json')) ?? { urls: [] };
        if (!history.urls.some((e) => e.url === target)) {
          history.urls.push({ url: target, at: new Date().toISOString() });
          await saveJson(slug, 'previews.json', history);
        }
        return redirect(`/wizard/${slug}/extract?url=${encodeURIComponent(target)}#preview`);
      } catch (error) {
        return html(extractionForm(slug, { groups, selectedUrl: target, selectors, error: (error as Error).message }), 502);
      }
    }

    // ---- Step 3b: Site structure (navigation) ----

    if (req.method === 'GET' && url.pathname.endsWith('/structure') && slugFromPath(url.pathname)) {
      const slug = slugFromPath(url.pathname)!;
      const structure = await loadJson<SiteStructure>(slug, 'site.json');
      const config = await loadJson<SiteConfig>(slug, 'config.json');
      return html(structurePage(slug, { structure, navSelector: config?.navSelector ?? '', footerSelector: config?.footerSelector ?? '' }));
    }

    if (req.method === 'POST' && url.pathname.endsWith('/structure') && slugFromPath(url.pathname)) {
      const slug = slugFromPath(url.pathname)!;
      const source = await loadJson<SourceState>(slug, 'source.json');
      if (!source) {
        return html(sourceForm(slug, { error: 'No source configured yet — run the source step first.' }), 400);
      }
      const form = await req.formData();
      const navSelector = String(form.get('navselector') ?? '');
      const footerSelector = String(form.get('footerselector') ?? '');
      // Selektoren sind Site-Entscheidungen — site-weit persistiert wie contentSelectors.
      const existing = await loadJson<SiteConfig>(slug, 'config.json');
      await saveJson(slug, 'config.json', { ...existing, navSelector, footerSelector });
      try {
        // Ein einzelner Scrape der Startseite — Header/Footer sind site-weit konstant.
        const pageHtml = await fetchPage(source.baseUrl);
        const structure: SiteStructure = {
          baseUrl: source.baseUrl,
          scannedFrom: source.baseUrl,
          scannedAt: new Date().toISOString(),
          navigation: extractNavigation(pageHtml, source.baseUrl, navSelector),
          logo: extractLogo(pageHtml, source.baseUrl),
          footer: extractFooter(pageHtml, source.baseUrl, footerSelector),
        };
        await saveJson(slug, 'site.json', structure);
        return redirect(`/wizard/${slug}/structure`);
      } catch (error) {
        const prev = await loadJson<SiteStructure>(slug, 'site.json');
        return html(structurePage(slug, { structure: prev, navSelector, footerSelector, error: (error as Error).message }), 502);
      }
    }

    // ---- Step 4: Full run (gate + child-process crawl) ----

    if (req.method === 'GET' && url.pathname.endsWith('/run') && !url.pathname.includes('/run/') && slugFromPath(url.pathname)) {
      const slug = slugFromPath(url.pathname)!;
      const urls = await loadJson<UrlsState>(slug, 'urls.json');
      if (!urls) return redirect(`/wizard/${slug}/extract`);
      // Historie einmalig aus dem letzten Preview befüllen (vor der Funktion
      // gemachte Previews gelten weiter).
      let previews = await loadJson<PreviewsState>(slug, 'previews.json');
      if (!previews) {
        const last = await loadJson<{ url: string }>(slug, 'preview.json');
        previews = { urls: last?.url ? [{ url: last.url, at: new Date().toISOString() }] : [] };
      }
      const previewed = new Set(previews.urls.map((e) => e.url));
      const run = await loadJson<RunState>(slug, 'run.json');
      const job = await loadJob(slug);
      const groups = groupBySitemap(urls.urls).map((g) => ({
        source: g.source,
        count: g.urls.length,
        representative: g.urls[0] ?? '',
        previewed: g.urls.some((u) => previewed.has(u)),
        approved: Boolean(run?.groups?.[g.source]?.approved),
      }));
      return html(runGatePage(slug, { groups, total: urls.total, running: job?.status === 'running', jobId: job?.id }));
    }

    if (req.method === 'POST' && url.pathname.endsWith('/run/approve') && slugFromPath(url.pathname)) {
      const slug = slugFromPath(url.pathname)!;
      const form = await req.formData();
      const group = String(form.get('group') ?? '');
      const urls = await loadJson<UrlsState>(slug, 'urls.json');
      if (!group || !urls?.urls.some((e) => e.sitemap === group)) {
        return html(sourceForm(slug, { error: 'Invalid group approval request.' }), 400);
      }
      const run = (await loadJson<RunState>(slug, 'run.json')) ?? { groups: {} };
      if (run.groups[group]?.approved) {
        delete run.groups[group];
      } else {
        run.groups[group] = { approved: true, approvedAt: new Date().toISOString() };
      }
      await saveJson(slug, 'run.json', run);
      return redirect(`/wizard/${slug}/run`);
    }

    if (req.method === 'POST' && url.pathname.endsWith('/run/start') && slugFromPath(url.pathname)) {
      const slug = slugFromPath(url.pathname)!;
      const urls = await loadJson<UrlsState>(slug, 'urls.json');
      if (!urls) return redirect(`/wizard/${slug}/extract`);
      const run = await loadJson<RunState>(slug, 'run.json');
      const groups = groupBySitemap(urls.urls);
      const job = await loadJob(slug);
      if (job?.status === 'running') return redirect(`/wizard/${slug}/jobs/${job.id}`);
      if (!groups.length || !groups.every((g) => run?.groups?.[g.source]?.approved)) {
        return redirect(`/wizard/${slug}/run`);
      }
      const crawl = await createJob({
        slug,
        title: 'Extracting content',
        items: [
          ...urls.urls.map((e) => ({ label: e.url, status: 'pending' as const })),
          { label: 'RSS feed', status: 'pending' as const },
        ],
        fallbackUrl: `/wizard/${slug}/run`,
      });
      // Child-Process, detached (eigene Prozessgruppe): Server-Neustart,
      // Ctrl-C und bun --hot-Reloads reißen den Crawl nicht ab. Zustand nur
      // über job.json. stderr landet in data/crawl.log — ein still sterbendes
      // Child ist die eine Fehlerklasse, die man sonst nie zu sehen bekommt.
      // src/server.ts → src/wizard/crawl-job.ts (NICHT '../wizard' — das
      // zeigt aus src/ heraus auf <root>/wizard, wo nichts liegt).
      const entry = new URL('./wizard/crawl-job.ts', import.meta.url).pathname;
      const proc = Bun.spawn([process.execPath, entry, slug, crawl.id], {
        stdout: 'ignore',
        stderr: 'pipe',
        stdin: 'ignore',
        detached: true,
      });
      proc.unref();
      void (async () => {
        const stderr = await new Response(proc.stderr).text();
        const code = await proc.exited;
        const sink = Bun.file(`${siteDir(slug)}/data/crawl.log`).writer({ append: true });
        sink.write(`[${new Date().toISOString()}] crawl pid=${proc.pid} exited code=${code}\n${stderr || '(no stderr)'}\n`);
        await sink.end();
      })();
      return redirect(`/wizard/${slug}/jobs/${crawl.id}`);
    }

    if (req.method === 'GET' && url.pathname.endsWith('/content') && slugFromPath(url.pathname)) {
      const slug = slugFromPath(url.pathname)!;
      const urls = await loadJson<UrlsState>(slug, 'urls.json');
      if (!urls) return redirect(`/wizard/${slug}/source`);
      const job = await loadJob(slug);
      if (!job || job.status !== 'done') return redirect(`/wizard/${slug}/run`);
      const sitemapOf = new Map(urls.urls.map((e) => [e.url, e.sitemap]));
      const groups = new Map<string, { done: number; failed: number }>();
      const failures: Array<{ url: string; error: string }> = [];
      for (const item of job.items) {
        if (item.label === 'RSS feed') continue;
        const source = sitemapOf.get(item.label) ?? 'unknown';
        const group = groups.get(source) ?? { done: 0, failed: 0 };
        if (item.status === 'done') group.done += 1;
        if (item.status === 'failed') {
          group.failed += 1;
          failures.push({ url: item.label, error: item.error ?? '' });
        }
        groups.set(source, group);
      }
      const rss = job.items.find((i) => i.label === 'RSS feed') ?? null;
      return html(contentSummaryPage(slug, {
        groups: [...groups.entries()].map(([source, g]) => ({ source, ...g })),
        total: urls.total,
        failures,
        rss: rss ? { status: rss.status, error: rss.error } : null,
      }));
    }

    return new Response('Not found', { status: 404 });
  },
});

// Bewacht den Prozess: ein vergessenes await darf den Wizard nicht silent killen.
process.on('unhandledRejection', (reason) => {
  console.error('Unhandled rejection:', reason);
});

console.log(`wp2static wizard → http://localhost:${PORT}${DEV ? ' (dev, live reload on)' : ''}`);
