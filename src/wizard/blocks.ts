/**
 * Block-Labeling: die Top-Level-Kinder des Content-Containers werden klassifiziert
 * (Artikel vs. Meta/Kategorien, Datum, Autor-Bio, Kommentare, …).
 *
 * Kein KI-Einsatz: WP/Divi-Templates sind strukturkonstant — die Heuristik
 * schlägt anhand stabiler Marker (Original-Klassen, category-Hrefs) vor,
 * der User bestätigt/korrigiert per Klick in der Preview. Gelandte Regeln
 * (Fingerprint = Original-Klassen-Tokens) gelten site-weit für alle Seiten.
 */

import { loadJson, saveJson } from './sites';

export const BLOCK_LABELS = [
  'article',
  'meta-categories',
  'meta-date',
  'meta-comments',
  'featured-image',
  'author-bio',
  'comments',
  'related-posts',
  'share-buttons',
  'newsletter',
  'drop',
] as const;
export type BlockLabel = (typeof BLOCK_LABELS)[number];

export interface BlockRule {
  // Original-Klassen-Tokens; Regel greift, wenn alle Tokens im Block vorkommen.
  // Leer = Einzelfall-Regel für url+block (Block ohne Original-Klassen).
  match: string[];
  url?: string;
  block?: number;
  label: BlockLabel;
}

export interface ContentBlock {
  origClass: string;
  html: string;
}

export function blockClasses(origClass: string): string[] {
  return origClass.split(/\s+/).filter(Boolean);
}

export async function loadRules(slug: string): Promise<BlockRule[]> {
  const state = await loadJson<{ rules: BlockRule[] }>(slug, 'blocks.json');
  return state?.rules ?? [];
}

async function persistRules(slug: string, rules: BlockRule[]): Promise<void> {
  await saveJson(slug, 'blocks.json', { rules });
}

export async function saveRule(slug: string, rule: BlockRule): Promise<void> {
  const rules = await loadRules(slug);
  const sameFingerprint = (r: BlockRule): boolean =>
    r.match.length > 0 && rule.match.length > 0
      ? r.match.join(' ') === rule.match.join(' ')
      : !r.match.length && !rule.match.length && r.url === rule.url && r.block === rule.block;
  await persistRules(slug, [...rules.filter((r) => !sameFingerprint(r)), rule]);
}

export function matchLabel(rules: BlockRule[], block: ContentBlock, url: string, index: number): BlockLabel | null {
  const tokens = blockClasses(block.origClass);
  for (const rule of rules) {
    if (rule.match.length > 0 && tokens.length > 0 && rule.match.every((t) => tokens.includes(t))) {
      return rule.label;
    }
    if (rule.match.length === 0 && rule.url === url && rule.block === index) {
      return rule.label;
    }
  }
  return null;
}

// Ein Kandidat für "das ist der Seitentitel als eigener Block" muss diese
// Mindestlänge haben, damit kurze Texte nicht versehentlich als Titel präfixen.
const MIN_TITLE_BLOCK_LENGTH = 15;

export function suggestLabel(block: ContentBlock, pageTitle = ''): BlockLabel {
  const cls = block.origClass.toLowerCase();
  // Icon-Fonts (Divi & Co.) stecken Glyphen in Unicode-Private-Use — die dürfen
  // die Text-basierten Heuristiken (Anker am Wortanfang) nicht stören.
  const text = block.html
    .replace(/<[^>]+>/g, ' ')
    .replace(/[\uE000-\uF8FF]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
  if (/comment/.test(cls)) return 'comments';
  if (/post[-_]?nav/.test(cls)) return 'related-posts';
  if (/author|-bio/.test(cls)) return 'author-bio';
  if (/share|social/.test(cls)) return 'share-buttons';
  if (/newsletter|subscribe/.test(cls)) return 'newsletter';
  if (/related/.test(cls)) return 'related-posts';
  if (/^written by/i.test(text)) return 'author-bio';
  // Kommentar-Anker/Count (z. B. Divi-Blurb „Comments: 0" → #respond) — kurz
  // genug, dass echte Artikelabsätze, die mit „Comments:" beginnen, nicht treffen.
  if (text.length < 60 && /^comments?\s*:/i.test(text)) return 'meta-comments';
  if (/(^|[\s_-])post-meta([\s_-]|$)/.test(cls)) return 'meta-categories';
  if (/\/category\//.test(block.html) && text.length < 200) return 'meta-categories';
  if (text.length < 60 && /\b(19|20)\d{2}\b/.test(text)) return 'meta-date';
  if (/^no results found/i.test(text)) return 'drop';
  // Nur-Bild-Block mit Image-Klasse → Cover/Featured Image (Template rendert
  // ihn aus dem Frontmatter, nicht aus dem Content). Echte Textmenge schließt
  // Bild+Unterschrift-Blöcke aus.
  if (/image/.test(cls) && /<img\s/.test(block.html) && text.length < 25) return 'featured-image';
  // Der Titel steht im Frontmatter — ein Block, der nur den Seitentitel
  // enthält, ist im Content redundant (Design rendert ihn aus den Metadaten).
  if (pageTitle && text.length >= MIN_TITLE_BLOCK_LENGTH && pageTitle.toLowerCase().startsWith(text.toLowerCase())) {
    return 'drop';
  }
  return 'article';
}
