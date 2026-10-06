/**
 * Website-Struktur: Header-/Footer-Bereiche der Quelle einmal scannen. Hier:
 * die Hauptnavigation aus dem ersten <header> bzw. <nav> der Startseite —
 * theme-/builder-seitig site-weit konstant, daher genügt ein Scrape.
 *
 * Bewusst generisch (keine Builder-Klassen): WordPress-Menüs rendern als
 * verschachtelte ul/ol > li > a — dieser Walk funktioniert Theme-unabhängig.
 */

import * as cheerio from 'cheerio';
import { safeUrl } from './extract';

export interface NavItem {
  label: string;
  href: string | null;
  items: NavItem[];
}

export interface SiteStructure {
  baseUrl: string;
  scannedFrom: string;
  scannedAt: string;
  navigation: NavItem[];
  logo: { src: string; alt: string } | null;
  footer: { scannedFrom: string; navigation: NavItem[] } | null;
}

function parseMenu($: cheerio.CheerioAPI, list: cheerio.AnyNode, pageUrl: string): NavItem[] {
  const out: NavItem[] = [];
  $(list).children('li').each((_, li) => {
    const a = $(li).children('a').first();
    const rawHref = a.attr('href') ?? '';
    const href = rawHref ? safeUrl(rawHref, pageUrl) : null;
    const label = a.text().replace(/\s+/g, ' ').trim();
    const nested = $(li).children('ul,ol').first();
    const items = nested.length ? parseMenu($, nested.get(0) as cheerio.AnyNode, pageUrl) : [];
    if (!label && !items.length) return;
    out.push({ label, href, items });
  });
  return out;
}

export function extractNavigation(html: string, pageUrl: string, selector = ''): NavItem[] {
  const $ = cheerio.load(html);
  const trimmed = selector.trim();
  // Auto: erster header- ODER nav-Knoten in Dokument-Reihenfolge
  // (querySelectorAll-Semantik). Oder User-Selektor, wenn Auto nichts findet.
  const region = trimmed ? $(trimmed).first() : $('header, nav').first();
  if (!region.length) {
    throw new Error(
      trimmed
        ? `Navigation selector "${trimmed}" matched nothing on the start page.`
        : 'No <header> or <nav> found on the start page — enter a navigation selector.',
    );
  }
  const list = region.find('ul,ol').first();
  if (!list.length) throw new Error('No menu list found inside the navigation region.');
  const navigation = parseMenu($, list.get(0) as cheerio.AnyNode, pageUrl);
  if (!navigation.length) throw new Error('Menu list inside the navigation region contains no items.');
  return navigation;
}

/** Logo = erstes Bild in der Kopfzeile (erster header/nav). Kein Bild → null
 *  (explizites Ergebnis, z. B. Divi-Menü ohne Logo). */
export function extractLogo(html: string, pageUrl: string): { src: string; alt: string } | null {
  const $ = cheerio.load(html);
  const region = $('header, nav').first();
  const img = region.find('img').first();
  if (!img.length) return null;
  const src = safeUrl(img.attr('src') ?? '', pageUrl);
  if (!src) return null;
  return { src, alt: (img.attr('alt') ?? '').trim() };
}

/** Footer = letzter <footer> (oder User-Selektor), gleicher Listen-Walk wie die
 *  Hauptnavigation. Fail-soft: nichts gefunden → null, kein Fehler. */
export function extractFooter(html: string, pageUrl: string, selector = ''): { scannedFrom: string; navigation: NavItem[] } | null {
  const $ = cheerio.load(html);
  const trimmed = selector.trim();
  const region = trimmed ? $(trimmed).first() : $('footer').last();
  if (!region.length) return null;
  const list = region.find('ul,ol').first();
  if (!list.length) return null;
  const navigation = parseMenu($, list.get(0) as cheerio.AnyNode, pageUrl);
  if (!navigation.length) return null;
  return { scannedFrom: pageUrl, navigation };
}
