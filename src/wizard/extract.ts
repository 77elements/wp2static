/**
 * Page fetching + content extraction (HTML → metadata + cleaned content HTML).
 *
 * Content-Vertrag: der Artikelinhalt wird als DOM übernommen — bereinigt auf
 * semantische Tags, ohne WP-/Divi-Klassen und Styling-Attribute, gewrappt in
 * ein einziges <div class="article-content">. Design entsteht später aus
 * eigenen Templates (siehe AGENTS.md), nicht aus dem Scrape.
 */

import * as cheerio from 'cheerio';
import type { ContentBlock } from './blocks';

const UA = 'wp2static/0.1 (local converter)';
const AUTO_SELECTORS = ['.entry-content', '.et_pb_post_content', 'article', 'main'];
const MIN_CONTENT_LENGTH = 200;
// Scopes, in denen Page-Builder-Module als Blöcke dienen (erstes Vorkommen gewinnt).
const MODULE_SCOPES = ['.et-l--body', '#main-content', 'main'];
const MODULE_SELECTOR = '.et_pb_module';

// Semantische Tags, die als Knoten erhalten bleiben (ohne Attribute außer den
// hier genannten). b/i werden zu strong/em normalisiert.
const ALLOWED: Record<string, readonly string[]> = {
  a: ['href'],
  img: ['src', 'alt', 'width', 'height'],
  abbr: ['title'],
};
const KEEP = new Set([
  'p', 'h1', 'h2', 'h3', 'h4', 'h5', 'h6',
  'ul', 'ol', 'li',
  'a', 'img', 'figure', 'figcaption',
  'blockquote', 'cite',
  'pre', 'code',
  'strong', 'em', 'br', 'hr', 'abbr',
  'table', 'thead', 'tbody', 'tr', 'th', 'td',
]);
// Komplett samt Kindern entfernen.
const DROP = new Set(['script', 'style', 'noscript', 'link', 'meta', 'iframe', 'button', 'form', 'input', 'select', 'textarea']);

export interface ExtractedPage {
  url: string;
  title: string;
  description: string;
  datePublished: string;
  selectorUsed: string;
  html: string;
  blocks: ContentBlock[];
}

export async function fetchPage(url: string): Promise<string> {
  const res = await fetch(url, {
    headers: { 'user-agent': UA },
    signal: AbortSignal.timeout(30_000),
  });
  if (!res.ok) throw new Error(`HTTP ${res.status} for ${url}`);
  return res.text();
}

function extractDatePublished($: cheerio.CheerioAPI): string {
  let date = '';
  $('script[type="application/ld+json"]').each((_, el) => {
    if (date) return;
    try {
      const json: unknown = JSON.parse($(el).text());
      const nodes = Array.isArray(json) ? json : [json];
      for (const node of nodes) {
        if (node && typeof node === 'object' && 'datePublished' in node) {
          date = String((node as Record<string, unknown>).datePublished);
          return;
        }
        const graph = (node as Record<string, unknown> | null)?.['@graph'];
        if (Array.isArray(graph)) {
          for (const g of graph) {
            if (g && typeof g === 'object' && 'datePublished' in g) {
              date = String((g as Record<string, unknown>).datePublished);
              return;
            }
          }
        }
      }
    } catch {
      // malformed JSON-LD — ignore
    }
  });
  return date;
}

export function safeUrl(raw: string, base: string): string | null {  try {
    const url = new URL(raw, base);
    if (url.protocol !== 'http:' && url.protocol !== 'https:') return null;
    return url.href;
  } catch {
    return null;
  }
}

/** Erlaubte Attribute behalten, Rest strippen; href/src absolutieren. */
function cleanAttrs($: cheerio.CheerioAPI, el: cheerio.Element, tag: string, pageUrl: string): void {
  const allowedAttrs = ALLOWED[tag] ?? [];
  for (const attr of Object.keys(el.attribs ?? {})) {
    if (!allowedAttrs.includes(attr)) {
      $(el).removeAttr(attr);
      continue;
    }
    if (attr === 'href' || attr === 'src') {
      const absolute = safeUrl(el.attribs[attr] ?? '', pageUrl);
      if (absolute) el.attribs[attr] = absolute;
      else $(el).removeAttr(attr);
    }
  }
}

const EMPTY_TRASH = ['p', 'li', 'h1', 'h2', 'h3', 'h4', 'h5', 'h6', 'blockquote', 'cite', 'em', 'strong', 'figure'];

/**
 * Divi erkannt? Liefert dann die Top-Level-Module des Body-Bereichs (keine
 * verschachtelten). Marker ist `.et_pb_module` — nur wenn Module vorhanden
 * sind, gilt eine Seite als Divi-strukturiert; normale WordPress-Sites
 * (klassische Themes mit .entry-content/article) liefern eine leere Liste
 * und nutzen den bisherigen Container-Kinder-Pfad.
 */
function findDiviModules($: cheerio.CheerioAPI): cheerio.AnyNode[] {
  for (const scopeSel of MODULE_SCOPES) {
    const scope = $(scopeSel).first();
    if (!scope.length) continue;
    const modules = scope
      .find(MODULE_SELECTOR)
      .toArray()
      .filter((el) => !$(el).parents(MODULE_SELECTOR).length);
    if (modules.length) return modules;
  }
  return [];
}

/** Rekursive Bereinigung: erlaubte Tags behalten (samt erlaubter Attribute),
 *  verbotene kinderlos entfernen, Layout-Tags (div, span, …) unwrappen. */
function cleanChildren($: cheerio.CheerioAPI, node: cheerio.AnyNode, pageUrl: string): void {
  for (const child of [...node.children]) {
    if (child.type !== 'tag' && child.type !== 'script' && child.type !== 'style') {
      // Textknoten bleiben; Kommentare und Sonstiges fliegen raus.
      if (child.type !== 'text') $(child).remove();
      continue;
    }
    const tag = child.tagName.toLowerCase();
    if (DROP.has(tag)) {
      $(child).remove();
      continue;
    }
    if (tag === 'b') child.tagName = 'strong';
    if (tag === 'i') child.tagName = 'em';

    const clean = child.tagName.toLowerCase();
    cleanChildren($, child, pageUrl);

    if (!KEEP.has(clean)) {
      $(child).replaceWith(child.children);
      continue;
    }

    // Leere Inhaltsträger (Divi-Spacer & Co.) haben keinen Wert.
    if (EMPTY_TRASH.includes(clean) && !child.children.length) {
      $(child).remove();
      continue;
    }

    cleanAttrs($, child as cheerio.Element, clean, pageUrl);
  }
}

export function extractPage(html: string, url: string, selectors: string[]): ExtractedPage {
  const $ = cheerio.load(html);

  const title = $('meta[property="og:title"]').attr('content')?.trim() || $('title').text().trim();
  const description = $('meta[name="description"]').attr('content')?.trim() ?? '';
  const datePublished = extractDatePublished($);

  const candidates = [...selectors.map((s) => s.trim()).filter(Boolean), ...AUTO_SELECTORS];
  let selectorUsed = '';
  let container: cheerio.AnyNode | null = null;

  for (const selector of candidates) {
    // Page-Builder-Seiten enthalten oft mehrere Fragmente eines Selektors —
    // der erste Treffer ist nicht der Inhaltsreiche. Bester gewinnt.
    let best: { node: cheerio.AnyNode; length: number } | null = null;
    $(selector).each((_, el) => {
      const length = $(el).text().trim().length;
      if (!best || length > best.length) best = { node: el, length };
    });
    if (best && best.length > MIN_CONTENT_LENGTH) {
      selectorUsed = selector;
      container = best.node;
      break;
    }
  }

  if (!container || !selectorUsed) {
    throw new Error(`No content found (tried: ${candidates.join(', ')})`);
  }

  // Block-Quelle — Divi erkannt (Module im Body-Bereich)? Dann sind die
  // Top-Level-Module die Blöcke (Dokument-Reihenfolge): Meta, Autor und
  // Kommentare liegen bei Theme-Builder-Layouts als eigene Module NEBEN dem
  // Content-Container und wären sonst nicht labelbar. Ohne Divi: wie bisher
  // die Top-Level-Kinder des Containers (normale WordPress-Sites).
  // Original-Klassen werden VOR dem Strippen gesichert (Fingerprint fürs
  // Block-Labeling), dann wird jeder Block einzeln bereinigt.
  const diviModules = findDiviModules($);
  const sources = diviModules.length
    ? diviModules
    : [...(container as { children: cheerio.AnyNode[] }).children];
  const blocks: ContentBlock[] = [];
  for (const child of sources) {
    const origClass = child.type === 'tag' ? String(child.attribs?.['class'] ?? '') : '';
    if (child.type === 'tag') {
      const tag = child.tagName.toLowerCase();
      if (tag === 'script' || tag === 'style') continue;
      const isKeep = KEEP.has(tag);
      cleanChildren($, child, url);
      if (isKeep) cleanAttrs($, child as cheerio.Element, tag, url);
      // Nicht-semantisches Block-Tag (div, span, …) selbst auflösen — sein
      // gereinigtes Inneres ist der Block. Semantische Tags bleiben ganz erhalten.
      const html = isKeep ? $.html(child) : $(child).html() ?? '';
      if (html.trim()) blocks.push({ origClass, html });
    } else if (child.type === 'text') {
      const html = String((child as { data?: string }).data ?? '');
      if (html.trim()) blocks.push({ origClass: '', html });
    }
  }

  return {
    url,
    title,
    description,
    datePublished,
    selectorUsed,
    html: `<div class="article-content">\n${blocks.map((b) => b.html).join('\n')}\n</div>`,
    blocks,
  };
}
