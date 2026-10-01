/**
 * Site-Name → slug-sicheres Verzeichnis-Name.
 * "https://www.Example.com/pfad" → "example.com", "Mein Blog!!" → "mein-blog"
 */

const RESERVED = new Set(['site', 'done', 'source', 'select', 'extract', 'extracted']);

export function slugifySiteName(raw: string): string | null {
  let s = raw.trim().toLowerCase();
  s = s.replace(/^https?:\/\//, '').replace(/^www\./, '');
  s = s.replace(/\/.*$/, '');
  s = s.replace(/\s+/g, '-');
  s = s.replace(/[^a-z0-9.-]/g, '');
  s = s.replace(/-{2,}/g, '-').replace(/^[.-]+|[.-]+$/g, '');
  if (!s || !/[a-z0-9]/.test(s) || s.length > 100) return null;
  if (RESERVED.has(s)) return null;
  return s;
}
