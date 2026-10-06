/**
 * Verzeichnis-Setup + JSON-State pro Site (idempotent).
 *
 * sites/<name>/            Arbeitsverzeichnis (Config, Templates, content/, public/, data/)
 * dist/<name>/             Build-Output (statische Website, FTP-Quelle)
 */

import { mkdir } from 'node:fs/promises';
import path from 'node:path';

const ROOT = path.resolve(import.meta.dir, '../..');

export async function createSiteDirs(slug: string): Promise<string[]> {
  const targets = [
    path.join(ROOT, 'sites', slug),
    path.join(ROOT, 'sites', slug, 'content'),
    path.join(ROOT, 'sites', slug, 'public'),
    path.join(ROOT, 'sites', slug, 'data'),
    path.join(ROOT, 'dist', slug),
  ];

  const created: string[] = [];
  for (const target of targets) {
    await mkdir(target, { recursive: true });
    const rel = path.relative(ROOT, target);
    if (!created.includes(rel)) created.push(rel);
  }
  return created;
}

export async function saveJson(slug: string, name: string, data: unknown): Promise<void> {
  const file = path.join(ROOT, 'sites', slug, 'data', name);
  await Bun.write(file, JSON.stringify(data, null, 2) + '\n');
}

export async function loadJson<T>(slug: string, name: string): Promise<T | null> {
  const file = Bun.file(path.join(ROOT, 'sites', slug, 'data', name));
  if (await file.exists()) return (await file.json()) as T;
  return null;
}

/** Absolute Pfadbasis einer Site (content/, cache/ etc. hängen daran). */
export function siteDir(slug: string): string {
  return path.join(ROOT, 'sites', slug);
}
