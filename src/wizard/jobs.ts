/**
 * File-backed Jobs für langlaufende Wizard-Aktionen (Collect, später Crawl).
 * Status liegt in sites/<slug>/data/job.json — sichtbar und robust gegen
 * Server-Reloads (bun --hot). Der Browser sieht den Fortschritt über die
 * Job-Seite (Meta-Refresh, kein JS nötig).
 */

import { saveJson, loadJson } from './sites';

export interface JobItem {
  label: string;
  status: 'pending' | 'running' | 'done' | 'failed';
  count?: number;
  error?: string;
}

export interface Job {
  id: string;
  slug: string;
  title: string;
  items: JobItem[];
  status: 'running' | 'done';
  startedAt: number;
  updatedAt: number;
  finishedAt?: number;
  doneUrl?: string;
  // Wohin bei Abbruch/Stall (Stall-Detektor), wenn doneUrl nie gesetzt wurde.
  fallbackUrl?: string;
  error?: string;
}

export async function createJob(job: Omit<Job, 'id' | 'status' | 'startedAt' | 'updatedAt'>): Promise<Job> {
  const now = Date.now();
  const full: Job = { ...job, id: crypto.randomUUID().slice(0, 8), status: 'running', startedAt: now, updatedAt: now };
  await persist(full);
  return full;
}

export async function persistJob(job: Job): Promise<void> {
  job.updatedAt = Date.now();
  await persist(job);
}

export async function loadJob(slug: string): Promise<Job | null> {
  return loadJson<Job>(slug, 'job.json');
}

async function persist(job: Job): Promise<void> {
  await saveJson(job.slug, 'job.json', job);
}
