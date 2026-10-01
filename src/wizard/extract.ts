/**
 * Page fetching + content extraction (HTML → metadata + Markdown).
 */

import * as cheerio from 'cheerio';
import TurndownService from 'turndown';

const UA = 'wp2static/0.1 (local converter)';
const AUTO_SELECTORS = ['.entry-content', 'article', 'main'];
const MIN_CONTENT_LENGTH = 200;

export interface ExtractedPage {
  url: string;
  title: string;
  description: string;
  datePublished: string;
  selectorUsed: string;
  markdown: string;
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

export function extractPage(html: string, url: string, selectors: string[]): ExtractedPage {
  const $ = cheerio.load(html);

  const title = $('meta[property="og:title"]').attr('content')?.trim() || $('title').text().trim();
  const description = $('meta[name="description"]').attr('content')?.trim() ?? '';
  const datePublished = extractDatePublished($);

  const candidates = [...selectors.map((s) => s.trim()).filter(Boolean), ...AUTO_SELECTORS];
  let selectorUsed = '';
  let contentHtml = '';

  for (const selector of candidates) {
    const el = $(selector).first();
    if (el.text().trim().length > MIN_CONTENT_LENGTH) {
      selectorUsed = selector;
      contentHtml = el.html() ?? '';
      break;
    }
  }

  if (!selectorUsed) {
    throw new Error(`No content found (tried: ${candidates.join(', ')})`);
  }

  const turndown = new TurndownService({
    headingStyle: 'atx',
    codeBlockStyle: 'fenced',
    bulletListMarker: '-',
  });
  const markdown = turndown.turndown(contentHtml).trim();

  return { url, title, description, datePublished, selectorUsed, markdown };
}
