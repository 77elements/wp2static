/**
 * Server-seitige HTML-Templates für die Wizard-Schritte.
 * Progressive Enhancement: alles funktioniert ohne JS (normale Form-POSTs).
 */

import { BLOCK_LABELS } from '../wizard/blocks';

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
    error?: string;
    doneUrl?: string;
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
  const progress = `<p data-job-progress data-running="${running}">Processed ${done} of ${job.items.length}${running ? ' — updates automatically' : ''}.</p>`;
  const error = job.error
    ? `<pre class="wizard__preview wizard__error" role="alert">${escapeHtml(job.error)}</pre>`
    : '';
  const backHref = job.doneUrl ?? `/wizard/${escapeHtml(slug)}/source`;
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
      <div class="wizard__block${b.current && b.current !== 'article' ? ' wizard__block--nonarticle' : ''}">
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
      <p>Pick a URL for a Markdown preview. This fetches exactly one page from the source site.</p>
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
        <button class="btn" type="submit" form="extract-form">Preview</button>
      </div>
    </footer>
  </section>
</main>`);
}
