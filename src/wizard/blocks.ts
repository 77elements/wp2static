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

export function suggestLabel(block: ContentBlock): BlockLabel {
  const cls = block.origClass.toLowerCase();
  const text = block.html
    .replace(/<[^>]+>/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
  if (/comment/.test(cls)) return 'comments';
  if (/author|-bio/.test(cls)) return 'author-bio';
  if (/share|social/.test(cls)) return 'share-buttons';
  if (/newsletter|subscribe/.test(cls)) return 'newsletter';
  if (/related/.test(cls)) return 'related-posts';
  if (/(^|[\s_-])post-meta([\s_-]|$)/.test(cls)) return 'meta-categories';
  if (/\/category\//.test(block.html) && text.length < 200) return 'meta-categories';
  if (text.length < 60 && /\b(19|20)\d{2}\b/.test(text)) return 'meta-date';
  return 'article';
}
