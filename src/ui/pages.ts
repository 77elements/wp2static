/**
 * Server-seitige HTML-Templates für die Wizard-Schritte.
 * Progressive Enhancement: alles funktioniert ohne JS (normale Form-POSTs).
 */

import { BLOCK_LABELS } from '../wizard/blocks';
import type { NavItem } from '../wizard/structure';

const escapeHtml = (s: string): string =>
  s.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c] ?? c);

export function layout(title: string, body: string): string {
  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${escapeHtml(title)} — wp2static</title>
<link rel="stylesheet" href="/main.css">
<script type="module" src="/main.js"></script>
</head>
<body>
${body}
</body>
</html>`;
}

export function step1(error?: string): string {
  return layout('Convert website', `
<main class="wizard">
  <section class="wizard__card" aria-labelledby="wizard-title">
    <header class="wizard__header">
      <p class="wizard__kicker">wp2static</p>
      <h1 class="h1" id="wizard-title">Convert a website</h1>
    </header>
    <div class="wizard__body">
      <p>Enter the name of the WordPress website. wp2static will create the working directory <code>sites/&lt;name&gt;/</code> and the output directory <code>dist/&lt;name&gt;/</code> from it.</p>
      ${error ? `<p class="wizard__error" role="alert">${escapeHtml(error)}</p>` : ''}
      <form id="wizard-form" method="post" action="/wizard/site">
        <div class="form__row">
          <label for="site-name">Website name</label>
          <input class="input" id="site-name" name="name" type="text" inputmode="url" required
                 autocomplete="off" spellcheck="false" placeholder="e.g. yoursite.com" autofocus>
        </div>
        <p class="form__note">Letters, numbers, dots and dashes are allowed.</p>
      </form>
    </div>
    <footer class="wizard__actions">
      <div class="l-row--end-pair">
        <button class="btn btn--secondary" type="button" disabled>Back</button>
        <button class="btn" type="submit" form="wizard-form">Next</button>
      </div>
    </footer>
  </section>
</main>`);
}

export function step1Done(slug: string, dirs: string[]): string {
  const items = dirs.map((d) => `<li><code>${escapeHtml(d)}/</code></li>`).join('');
  return layout(escapeHtml(slug), `
<main class="wizard">
  <section class="wizard__card">
    <header class="wizard__header">
      <p class="wizard__kicker">wp2static</p>
      <h1 class="h1">Directories created</h1>
    </header>
    <div class="wizard__body">
      <p>Site <strong>${escapeHtml(slug)}</strong> is ready:</p>
      <ul>${items}</ul>
    </div>
    <footer class="wizard__actions">
      <div class="l-row--end-pair">
        <a class="btn btn--secondary" href="/">Back</a>
        <a class="btn" href="/wizard/${escapeHtml(slug)}/source">Next</a>
      </div>
    </footer>
  </section>
</main>`);
}

export function jobPage(
  slug: string,
  job: {
    status: 'running' | 'done';
    title: string;
    updatedAt?: number;
    error?: string;
    doneUrl?: string;
    fallbackUrl?: string;
    items: Array<{ label: string; status: string; count?: number; error?: string }>;
  },
): string {
  const statusText = (status: string, count?: number): string => {
    if (status === 'done') return `${count ?? 0} URL${count === 1 ? '' : 's'}`;
    if (status === 'running') return 'loading…';
    if (status === 'failed') return 'failed';
    return 'waiting';
  };
  const row = (i: { label: string; status: string; count?: number; error?: string }): string => {
    const error = i.error ? ` (${escapeHtml(i.error)})` : '';
    return `<li data-label="${escapeHtml(i.label)}"><code>${escapeHtml(i.label)}</code> — <span data-status>${statusText(i.status, i.count)}</span>${error}</li>`;
  };
  const done = job.items.filter((i) => i.status === 'done' || i.status === 'failed').length;
  const running = job.status === 'running';
  // Stillstand erkennen, BEVOR der Stall-Detektor (180 s) den Job abwürgt —
  // ein tot gelaufener Child-Process sieht sonst minutenlang wie Arbeit aus.
  const stale = running && job.updatedAt !== undefined && Date.now() - job.updatedAt > 60_000;
  const staleHint = stale
    ? `<p class="wizard__error" role="alert">No progress for over a minute — the run may have been interrupted (server restart?). Reload this page: if nothing moves, restart from the Full run page.</p>`
    : '';
  const progress = `<p data-job-progress data-running="${running}">Processed ${done} of ${job.items.length}${running ? ' — updates automatically' : ''}.</p>`;
  const error = job.error
    ? `<pre class="wizard__preview wizard__error" role="alert">${escapeHtml(job.error)}</pre>`
    : '';
  const backHref = job.doneUrl ?? job.fallbackUrl ?? `/wizard/${escapeHtml(slug)}/source`;
  const footer = running
    ? `<a class="btn btn--secondary" href="">Refresh</a>`
    : `<a class="btn" href="${backHref}">Back</a>`;
  return layout(`${job.title} — ${slug}`, `
<main class="wizard">
  <section class="wizard__card">
    <header class="wizard__header">
      <p class="wizard__kicker">wp2static · ${escapeHtml(slug)}</p>
      <h1 class="h1">${escapeHtml(job.title)}</h1>
    </header>
    <div class="wizard__body">
      ${progress}
      ${staleHint}
      ${error}
      <ul data-job-items>${job.items.map(row).join('')}</ul>
    </div>
    <footer class="wizard__actions">
      <div class="l-row--end-pair">${footer}</div>
    </footer>
  </section>
</main>`);
}

export function sourceForm(
  slug: string,
  opts: { baseUrl?: string; sitemapUrl?: string; error?: string } = {},
): string {
  const action = `/wizard/${escapeHtml(slug)}/source`;
  return layout(`Source — ${slug}`, `
<main class="wizard">
  <section class="wizard__card">
    <header class="wizard__header">
      <p class="wizard__kicker">wp2static · ${escapeHtml(slug)}</p>
      <h1 class="h1">Source</h1>
    </header>
    <div class="wizard__body">
      <p>Enter the base URL of the WordPress website. wp2static looks for the sitemap automatically — or you can enter its URL directly.</p>
      ${opts.error ? `<p class="wizard__error" role="alert">${escapeHtml(opts.error)}</p>` : ''}
      <form id="source-form" method="post" action="${action}">
        <div class="form__row">
          <label for="baseurl">Base URL</label>
          <input class="input" id="baseurl" name="baseurl" type="url" required
                 placeholder="https://yoursite.com" value="${escapeHtml(opts.baseUrl ?? '')}">
        </div>
        <div class="form__row">
          <label for="sitemapurl">Sitemap URL (optional)</label>
          <input class="input" id="sitemapurl" name="sitemapurl" type="url"
                 placeholder="e.g. https://yoursite.com/sitemap.xml" value="${escapeHtml(opts.sitemapUrl ?? '')}">
        </div>
        <p class="form__note">Leave the sitemap URL empty to auto-detect (/sitemap.xml, /wp-sitemap.xml, /sitemap_index.xml).</p>
      </form>
    </div>
    <footer class="wizard__actions">
      <div class="l-row--end-pair">
        <a class="btn btn--secondary" href="/">Back</a>
        <button class="btn" type="submit" form="source-form">Look up sitemap</button>
      </div>
    </footer>
  </section>
</main>`);
}

export function sourceSelect(
  slug: string,
  baseUrl: string,
  sitemapUrl: string,
  children: string[],
  error?: string,
): string {
  const boxes = children
    .map(
      (c) => `
      <label class="check-row">
        <input type="checkbox" name="sitemap" value="${escapeHtml(c)}" checked>
        <code>${escapeHtml(c)}</code>
      </label>`,
    )
    .join('');
  return layout(`Select sitemaps — ${slug}`, `
<main class="wizard">
  <section class="wizard__card">
    <header class="wizard__header">
      <p class="wizard__kicker">wp2static · ${escapeHtml(slug)}</p>
      <h1 class="h1">Select sitemaps</h1>
    </header>
    <div class="wizard__body">
      <p>Sitemap index found at <code>${escapeHtml(sitemapUrl)}</code>. Select which sitemaps to collect URLs from.</p>
      ${error ? `<p class="wizard__error" role="alert">${escapeHtml(error)}</p>` : ''}
      <form id="select-form" method="post" action="/wizard/${escapeHtml(slug)}/source/select">
        <input type="hidden" name="baseurl" value="${escapeHtml(baseUrl)}">
        <input type="hidden" name="sitemapurl" value="${escapeHtml(sitemapUrl)}">
        ${boxes}
      </form>
    </div>
    <footer class="wizard__actions">
      <div class="l-row--end-pair">
        <a class="btn btn--secondary" href="/wizard/${escapeHtml(slug)}/source">Back</a>
        <button class="btn" type="submit" form="select-form">Collect URLs</button>
      </div>
    </footer>
  </section>
</main>`);
}

export function sourceSummary(
  slug: string,
  data: { baseUrl: string; groups: Array<{ url: string; count: number }>; total: number; failed?: string[] },
): string {
  const rows = data.groups
    .map((g) => `<li><code>${escapeHtml(g.url)}</code> — ${g.count} URL${g.count === 1 ? '' : 's'}</li>`)
    .join('');
  const failed = data.failed?.length
    ? `<p class="wizard__error" role="alert">Failed: ${escapeHtml(data.failed.join(', '))}</p>`
    : '';
  return layout(`URLs collected — ${slug}`, `
<main class="wizard">
  <section class="wizard__card">
    <header class="wizard__header">
      <p class="wizard__kicker">wp2static · ${escapeHtml(slug)}</p>
      <h1 class="h1">URLs collected</h1>
    </header>
    <div class="wizard__body">
      <p>Total: <strong>${data.total}</strong> URL${data.total === 1 ? '' : 's'} saved to <code>sites/${escapeHtml(slug)}/data/urls.json</code>.</p>
      <ul>${rows}</ul>
      ${failed}
    </div>
    <footer class="wizard__actions">
      <div class="l-row--end-pair">
        <a class="btn btn--secondary" href="/wizard/${escapeHtml(slug)}/source">Back</a>
        <a class="btn" href="/wizard/${escapeHtml(slug)}/extract">Next</a>
      </div>
    </footer>
  </section>
</main>`);
}

export function structurePage(  slug: string,
  opts: {
    structure?: {
      scannedFrom: string;
      scannedAt: string;
      navigation: NavItem[];
      logo: { src: string; alt: string } | null;
      footer: { scannedFrom: string; navigation: NavItem[] } | null;
    } | null;
    navSelector?: string;
    footerSelector?: string;
    error?: string;
  } = {},
): string {
  const { structure = null, navSelector = '', footerSelector = '', error } = opts;
  const renderItems = (items: NavItem[]): string =>
    items.length
      ? `<ul>${items
          .map(
            (i) =>
              `<li>${
                i.href
                  ? `<a href="${escapeHtml(i.href)}">${escapeHtml(i.label || i.href)}</a>`
                  : escapeHtml(i.label)
              }${renderItems(i.items)}</li>`,
          )
          .join('')}</ul>`
      : '';
  const scanned = structure
    ? `<p>Scanned from <code>${escapeHtml(structure.scannedFrom)}</code> at <code>${escapeHtml(structure.scannedAt)}</code>.</p>`
    : '';
  const logo = structure
    ? `<p><strong>Logo:</strong> ${
        structure.logo
          ? `<code>${escapeHtml(structure.logo.src)}</code>${structure.logo.alt ? ` (${escapeHtml(structure.logo.alt)})` : ''}`
          : 'no image found in header'
      }</p>`
    : '';
  const footer = structure
    ? `<h2 class="h3">Footer</h2>${
        structure.footer
          ? `<div class="wizard__nav-preview">${renderItems(structure.footer.navigation)}</div>`
          : '<p>No footer navigation found.</p>'
      }`
    : '';
  const nav = structure
    ? `<h2 class="h3">Main navigation</h2><div class="wizard__nav-preview">${renderItems(structure.navigation)}</div>`
    : '<p>No structure captured yet.</p>';
  return layout(`Structure — ${slug}`, `
<main class="wizard">
  <section class="wizard__card">
    <header class="wizard__header">
      <p class="wizard__kicker">wp2static · ${escapeHtml(slug)}</p>
      <h1 class="h1">Structure</h1>
    </header>
    <div class="wizard__body">
      <p>Scans the start page once: main navigation from the first <code>&lt;header&gt;</code>/<code>&lt;nav&gt;</code>, footer from the last <code>&lt;footer&gt;</code>, logo from the first header image. These regions are site-wide — one scan covers all pages. Saved to <code>data/site.json</code>.</p>
      <p class="form__note">Finds nothing? Enter a container selector, like the content selector in the extraction step. Saved site-wide.</p>
      ${error ? `<p class="wizard__error" role="alert">${escapeHtml(error)}</p>` : ''}
      ${scanned}
      ${logo}
      ${nav}
      ${footer}
      <form id="structure-form" method="post" action="/wizard/${escapeHtml(slug)}/structure">
        <div class="form__row">
          <label for="navselector">Navigation selector (optional)</label>
          <input class="input" id="navselector" name="navselector" type="text"
                 placeholder="empty = first &lt;header&gt;/&lt;nav&gt;" value="${escapeHtml(navSelector)}">
        </div>
        <div class="form__row">
          <label for="footerselector">Footer selector (optional)</label>
          <input class="input" id="footerselector" name="footerselector" type="text"
                 placeholder="empty = last &lt;footer&gt;" value="${escapeHtml(footerSelector)}">
        </div>
      </form>
    </div>
    <footer class="wizard__actions">
      <div class="l-row--end-pair">
        <a class="btn btn--secondary" href="/wizard/${escapeHtml(slug)}/extract">Back</a>
        <a class="btn btn--secondary" href="/wizard/${escapeHtml(slug)}/run">Next</a>
        <button class="btn" type="submit" form="structure-form">Scan structure</button>
      </div>
    </footer>
  </section>
</main>`);
}

export interface RunGroup {
  source: string;
  count: number;
  representative: string;
  previewed: boolean;
  approved: boolean;
}

/** Sitemap-Dateiname → lesbarer Gruppenname: post-sitemap.xml → Posts. */
function groupName(source: string): string {
  const file = source.split('/').pop() ?? source;
  const base = file.replace(/-sitemap\.xml$/i, '').replace(/\.xml$/i, '') || 'page';
  const plural = base.endsWith('y') ? `${base.slice(0, -1)}ies` : `${base}s`;
  return plural.charAt(0).toUpperCase() + plural.slice(1);
}

export function runGatePage(
  slug: string,
  opts: { groups: RunGroup[]; total: number; running: boolean; jobId?: string },
): string {
  const groupRow = (g: RunGroup, index: number): string => {
    const sample = new URL(g.representative).pathname;
    return `
      <li>
        <p><strong>${index + 1}. ${escapeHtml(groupName(g.source))}</strong> — ${g.count} URLs <code>${escapeHtml(g.source.split('/').pop() ?? '')}</code></p>
        <p>
          <a class="btn btn--secondary" href="/wizard/${escapeHtml(slug)}/extract?url=${encodeURIComponent(g.representative)}#preview">Preview sample</a>
          <span>${g.previewed ? '✓ sample checked' : '✗ sample not checked yet'}</span>
        </p>
        <p>
          <form method="post" action="/wizard/${escapeHtml(slug)}/run/approve">
            <input type="hidden" name="group" value="${escapeHtml(g.source)}">
            <button class="btn btn--secondary" type="submit">${g.approved ? 'Revoke approval' : 'Approve this group'}</button>
            ${g.approved ? '<span>✓ approved</span>' : ''}
          </form>
        </p>
      </li>`;
  };
  const allApproved = opts.groups.length > 0 && opts.groups.every((g) => g.approved);
  const status = opts.running
    ? `<p>The run is in progress — <a href="/wizard/${escapeHtml(slug)}/jobs/${escapeHtml(opts.jobId ?? '')}">open the progress page</a>.</p>`
    : allApproved
      ? '<p class="form__note">All groups approved. The run fetches every page sequentially (a few minutes), saves each one to <code>content/</code> and downloads the RSS feed. Nothing is uploaded — deployment is a separate, manual step. Failed pages are collected and listed at the end.</p>'
      : '<p class="form__note">The Start button unlocks once every group shows “✓ approved”. Checking a sample of a group can also be any other URL of that group — the sample link below is just a suggestion.</p>';
  return layout(`Full run — ${slug}`, `
<main class="wizard">
  <section class="wizard__card">
    <header class="wizard__header">
      <p class="wizard__kicker">wp2static · ${escapeHtml(slug)}</p>
      <h1 class="h1">Full run</h1>
    </header>
    <div class="wizard__body">
      <p>This copies your whole site into static files: all <strong>${opts.total}</strong> URLs → <code>content/</code>, plus the RSS feed. Nothing is uploaded or deployed.</p>
      <p>Before it starts, look at <strong>one sample page per group</strong> (to check the block labels) and approve the group:</p>
      <ol>${opts.groups.map(groupRow).join('')}</ol>
      ${status}
      <form id="run-start" method="post" action="/wizard/${escapeHtml(slug)}/run/start"></form>
    </div>
    <footer class="wizard__actions">
      <div class="l-row--end-pair">
        <a class="btn btn--secondary" href="/wizard/${escapeHtml(slug)}/structure">Back</a>
        <button class="btn" type="submit" form="run-start"${allApproved && !opts.running ? '' : ' disabled'}>Start run</button>
      </div>
    </footer>
  </section>
</main>`);
}

export function contentSummaryPage(
  slug: string,
  opts: {
    groups: Array<{ source: string; done: number; failed: number }>;
    total: number;
    failures: Array<{ url: string; error: string }>;
    rss: { status: string; error?: string } | null;
  },
): string {
  const rows = opts.groups
    .map((g) => `<li><code>${escapeHtml(g.source)}</code> — ${g.done} extracted, ${g.failed} failed</li>`)
    .join('');
  const failures = opts.failures.length
    ? `<h2 class="h3">Failed URLs</h2><pre class="wizard__preview">${escapeHtml(
        opts.failures.map((f) => `${f.url} — ${f.error}`).join('\n'),
      )}</pre>`
    : '';
  const processed = opts.groups.reduce((sum, g) => sum + g.done + g.failed, 0);
  const rssDone = !opts.rss || opts.rss.status === 'done';
  const complete = processed === opts.total && !opts.failures.length && rssDone;
  const verdict = complete
    ? '<p>All URLs extracted, RSS feed saved.</p>'
    : `<p class="wizard__error" role="alert">Run incomplete: only ${processed} of ${opts.total} URLs were processed${
        opts.failures.length ? ` (${opts.failures.length} failed — see list below)` : ''
      }${!rssDone ? ', RSS feed not fetched' : ''}. The run was interrupted — restart it from the Full run page; already fetched pages come from the cache and are not downloaded again.</p>`;
  const rss = opts.rss
    ? `<p><strong>RSS feed:</strong> ${
        opts.rss.status === 'done'
          ? `saved to <code>data/rss.xml</code>`
          : `<span class="wizard__error">not fetched (${escapeHtml(opts.rss.error || opts.rss.status)})</span>`
      }</p>`
    : '';
  return layout(`Content extracted — ${slug}`, `
<main class="wizard">
  <section class="wizard__card">
    <header class="wizard__header">
      <p class="wizard__kicker">wp2static · ${escapeHtml(slug)}</p>
      <h1 class="h1">Content extracted</h1>
    </header>
    <div class="wizard__body">
      <p>${opts.total} URL${opts.total === 1 ? '' : 's'} processed into <code>sites/${escapeHtml(slug)}/content/</code>.</p>
      <ul>${rows}</ul>
      ${rss}
      ${verdict}
      ${failures}
    </div>
    <footer class="wizard__actions">
      <div class="l-row--end-pair">
        <a class="btn btn--secondary" href="/wizard/${escapeHtml(slug)}/run">Back</a>
        <button class="btn btn--secondary" type="button" disabled>Build (follows)</button>
      </div>
    </footer>
  </section>
</main>`);
}

export function extractionForm(
  slug: string,
  opts: {
    groups: Array<{ source: string; urls: string[] }>;
    selectedUrl?: string;
    selectors?: string;
    error?: string;
    result?: { url: string; title: string; description: string; datePublished: string; selectorUsed: string; html: string; blocks: Array<{ origClass: string; html: string }> };
    labeledBlocks?: Array<{ origClass: string; html: string; current: string | null; suggested: string }>;
  },
): string {
  const optgroups = opts.groups
    .map((group) => {
      const options = group.urls
        .map(
          (u) =>
            `<option value="${escapeHtml(u)}"${u === opts.selectedUrl ? ' selected' : ''}>${escapeHtml(u)}</option>`,
        )
        .join('');
      const label = escapeHtml(group.source.split('/').pop() ?? group.source);
      return `<optgroup label="${label}">${options}</optgroup>`;
    })
    .join('');

  // result.html ist sanitisiert (Tag-Allowlist, keine Klassen/Events) — darf roh gerendert werden.
  // Gelabelte Blöcke (≠ article) werden abgeblendet, bleiben aber sichtbar (korrigierbar).
  const labelBar = (index: number, origClass: string, current: string | null): string => {
    const options = BLOCK_LABELS.map(
      (l) => `<option value="${l}"${l === (current ?? 'article') ? ' selected' : ''}>${l}</option>`,
    ).join('');
    return `
      <div class="wizard__blocklabel">
        <form method="post" action="/wizard/${escapeHtml(slug)}/label">
          <input type="hidden" name="url" value="${escapeHtml(opts.result!.url)}">
          <input type="hidden" name="block" value="${index}">
          <input type="hidden" name="origclass" value="${escapeHtml(origClass)}">
          <select class="input" name="label" aria-label="Block type">${options}</select>
          <button class="btn" type="submit">Apply</button>
        </form>
      </div>`;
  };
  const labeled = opts.labeledBlocks?.length
    ? opts.labeledBlocks
        .map(
          (b, i) => `
      <div class="wizard__block${b.current && b.current !== 'article' ? ' wizard__block--nonarticle' : ''}" id="block-${i}">
        ${b.html}${labelBar(i, b.origClass, b.current ?? b.suggested)}
      </div>`,
        )
        .join('')
    : (opts.result?.html ?? '');
  const result = opts.result?.html
    ? `
      <section id="preview">
        <h2 class="h3">Preview</h2>
        <p><strong>Title:</strong> ${escapeHtml(opts.result.title)}</p>
        <p><strong>Description:</strong> ${escapeHtml(opts.result.description)}</p>
        <p><strong>Date published:</strong> ${escapeHtml(opts.result.datePublished || '—')}</p>
        <p><strong>Selector used:</strong> <code>${escapeHtml(opts.result.selectorUsed)}</code></p>
        <div class="article-content">${labeled}</div>
        <details>
          <summary>HTML source</summary>
          <pre class="wizard__preview">${escapeHtml(opts.result.html)}</pre>
        </details>
      </section>`
    : '';

  return layout(`Extraction — ${slug}`, `
<main class="wizard">
  <section class="wizard__card">
    <header class="wizard__header">
      <p class="wizard__kicker">wp2static · ${escapeHtml(slug)}</p>
      <h1 class="h1">Extraction</h1>
    </header>
    <div class="wizard__body">
      <p>Pick a URL for a sanitized HTML preview. This fetches exactly one page from the source site.</p>
      ${opts.error ? `<p class="wizard__error" role="alert">${escapeHtml(opts.error)}</p>` : ''}
      <form id="extract-form" method="post" action="/wizard/${escapeHtml(slug)}/extract">
        <div class="form__row">
          <label for="extract-url">URL</label>
          <select class="input" id="extract-url" name="url" size="1">${optgroups}</select>
        </div>
        <div class="form__row">
          <label for="extract-selectors">Content selector(s) — comma-separated, optional</label>
          <input class="input" id="extract-selectors" name="selectors" type="text"
                 placeholder=".entry-content, article" value="${escapeHtml(opts.selectors ?? '')}">
        </div>
        <p class="form__note">Defines the element wrapping the whole article (the innermost such element). Saved with the site and used for every page. Empty = auto-detect (.entry-content, .et_pb_post_content, article, main).</p>
      </form>
      ${result}
    </div>
    <footer class="wizard__actions">
      <div class="l-row--end-pair">
        <a class="btn btn--secondary" href="/wizard/${escapeHtml(slug)}/source">Back</a>
        <a class="btn btn--secondary" href="/wizard/${escapeHtml(slug)}/structure">Next</a>
        <button class="btn" type="submit" form="extract-form">Preview</button>
      </div>
    </footer>
  </section>
</main>`);
}
