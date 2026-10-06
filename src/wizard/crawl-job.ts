/**
 * CLI-Einstieg für den Voll-Lauf als Child-Process.
 *
 * Bewusst eigener Prozess: bun --hot-Reloads/Restarts des Dev-Servers dürfen
 * einen laufenden Crawl nicht killen (In-Process-Jobs starben still — siehe
 * AGENTS.md Offene Punkte). Der ganze Zustand liegt in data/job.json; der
 * Server liest sie nur.
 *
 * Usage: bun src/wizard/crawl-job.ts <slug> <jobId> [limit]
 *   limit > 0 → Dry-Run mit den ersten N URLs (ohne RSS).
 */

import { crawlSite } from './crawl';
import { loadJob, persistJob } from './jobs';

const [slug, jobId, limitArg] = process.argv.slice(2);

if (!slug || !jobId) {
  console.error('Usage: bun src/wizard/crawl-job.ts <slug> <jobId> [limit]');
  process.exit(1);
}

try {
  await crawlSite(slug, jobId, Number(limitArg) || 0);
} catch (error) {
  // Fail-state in den Job schreiben — die Fortschrittsseite bleibt stehen.
  const job = await loadJob(slug);
  if (job && job.id === jobId) {
    job.status = 'done';
    job.error = (error as Error).message;
    job.finishedAt = Date.now();
    await persistJob(job);
  }
  console.error((error as Error).message);
  process.exit(1);
}
