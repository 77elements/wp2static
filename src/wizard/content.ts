/**
 * Gelabelte Blöcke → Content-Datei: Frontmatter (Metadaten) + Artikel-HTML.
 *
 * Label = Region (AGENTS.md): `article`-Blöcke bilden den Content (Dokument-
 * Reihenfolge, in einem `<div class="article-content">`), `meta-*`/`author-bio`
 * liefern strukturierte Frontmatter-Werte, `comments`/`drop` und alles übrige
 * fliegt raus. Deterministisch, kein KI-Einsatz.
 */

import type { ExtractedPage } from './extract';
import { matchLabel, type BlockRule, type ContentBlock } from './blocks';

export interface CategoryRef {
  name: string;
  href: string;
}

export interface PageContent {
  type: string;
  sourceUrl: string;
  frontmatter: string;
  articleHtml: string;
  stats: { article: number; dropped: number };
}

const yamlStr = (value: string): string =>
  `"${value.replace(/\\/g, '\\\\').replace(/"/g, '\\"')}"`;

const stripTags = (html: string): string =>
  html.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();

/** Autor best-effort: erst Heading „Written by: …" (mslm-Fall), dann erster
 *  Link, sonst erste Textzeile des Blocks — ohne Prefix. */
function extractAuthor(block: ContentBlock): string {
  const heading = block.html.match(/<h[1-6][^>]*>([\s\S]*?)<\/h[1-6]>/i)?.[1];
  if (heading) return stripTags(heading).replace(/^written by:\s*/i, '').trim();
  const link = block.html.match(/<a[^>]*>([\s\S]*?)<\/a>/i)?.[1];
  if (link) return stripTags(link).replace(/^written by:\s*/i, '').trim();
  return stripTags(block.html)
    .replace(/^written by:\s*/i, '')
    .split(/(?<=[.!?])\s/)[0]
    ?.trim() ?? '';
}

/** Featured Image: erstes Bild des Blocks (src ist durch die Extraktion
 *  bereits absolutiert). */
function extractFeaturedImage(block: ContentBlock): { src: string; alt: string } {
  const img = block.html.match(/<img[^>]*>/i)?.[0] ?? '';
  const src = img.match(/\ssrc="([^"]*)"/i)?.[1] ?? '';
  const alt = img.match(/\salt="([^"]*)"/i)?.[1] ?? '';
  return { src, alt };
}

/** Kategorien: Anker mit /category/ aus den meta-categories-Blöcken; Fallback:
 *  solche Anker irgendwo im Extrakt. */function extractCategories(blocks: ContentBlock[], rules: BlockRule[], url: string): CategoryRef[] {
  const labeled = blocks.filter((b) => matchLabel(rules, b, url, blocks.indexOf(b)) === 'meta-categories');
  const pools = labeled.length ? labeled : blocks;
  const out = new Map<string, CategoryRef>();
  for (const block of pools) {
    for (const m of block.html.matchAll(/<a[^>]*href="([^"]*\/category\/[^"]*)"[^>]*>([\s\S]*?)<\/a>/gi)) {
      const name = stripTags(m[2]);
      if (name && !out.has(m[1])) out.set(m[1], { name, href: m[1] });
    }
  }
  return [...out.values()];
}

export function buildContent(page: ExtractedPage, rules: BlockRule[], type: string): PageContent {
  let article = '';
  let author = '';
  let featuredImage: { src: string; alt: string } | null = null;
  let dropped = 0;
  let articleCount = 0;

  page.blocks.forEach((block, index) => {
    const label = matchLabel(rules, block, page.url, index) ?? 'article';
    if (label === 'article') {
      article += (article ? '\n' : '') + block.html;
      articleCount += 1;
      return;
    }
    if (label === 'author-bio' && !author) author = extractAuthor(block);
    if (label === 'featured-image' && !featuredImage) featuredImage = extractFeaturedImage(block);
    dropped += 1;
  });

  const categories = extractCategories(page.blocks, rules, page.url);

  // Kompaktes, deterministisches YAML — nur belegte Felder schreiben.
  const lines: string[] = ['---'];
  lines.push(`type: ${type}`);
  lines.push(`title: ${yamlStr(page.title)}`);
  if (page.description) lines.push(`description: ${yamlStr(page.description)}`);
  if (page.datePublished) lines.push(`datePublished: ${yamlStr(page.datePublished)}`);
  if (author) lines.push(`author: ${yamlStr(author)}`);
  if (featuredImage) {
    lines.push('featuredImage:');
    lines.push(`  src: ${yamlStr(featuredImage.src)}`);
    lines.push(`  alt: ${yamlStr(featuredImage.alt)}`);
  }
  if (categories.length) {
    lines.push('categories:');
    for (const c of categories) {
      lines.push(`  - name: ${yamlStr(c.name)}`);
      lines.push(`    href: ${yamlStr(c.href)}`);
    }
  }
  lines.push(`source: ${yamlStr(page.url)}`);
  lines.push('---');

  return {
    type,
    sourceUrl: page.url,
    frontmatter: lines.join('\n'),
    articleHtml: `<div class="article-content">\n${article}\n</div>`,
    stats: { article: articleCount, dropped },
  };
}

/** Sitemap-Dateiname → Content-Typ: post-sitemap.xml → post (generisch). */
export function typeFromSitemap(sitemap: string): string {
  const file = sitemap.split('/').pop() ?? sitemap;
  return file.replace(/-sitemap\.xml$/i, '').replace(/\.xml$/i, '') || 'page';
}

/** URL → eindeutiger, slug-sicherer Dateistamm (Pfadsegmente joined). */
export function fileSlugFromUrl(url: string): string {
  const segments = new URL(url).pathname.split('/').filter(Boolean);
  const joined = (segments.join('-') || 'index')
    .toLowerCase()
    .replace(/[^a-z0-9-]+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '');
  return joined || 'index';
}
