/**
 * Progressive Enhancement only — der Wizard funktioniert ohne JS (Form-POST).
 * Zwei Jobs: Submit-Button gegen Doppelklicks sperren; Job-Fortschritt per
 * JSON-Polling im Page-Inhalt aktualisieren (kein Meta-Refresh, kein Reload).
 */

const form = document.querySelector<HTMLFormElement>('#wizard-form');

form?.addEventListener('submit', () => {
  const submit = form.querySelector<HTMLButtonElement>('button[type="submit"]');
  if (submit) submit.disabled = true;
});

// Extract-Preview holt live eine Seite — sichtbarer Zustand statt stummer Button.
const extractForm = document.querySelector<HTMLFormElement>('#extract-form');

extractForm?.addEventListener('submit', () => {
  const submit = extractForm.querySelector<HTMLButtonElement>('button[type="submit"]');
  if (submit) {
    submit.disabled = true;
    submit.textContent = 'Fetching…';
  }
});

const escapeHtml = (s: string): string =>
  s.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c] ?? c);

const progress = document.querySelector<HTMLElement>('[data-job-progress]');
const list = document.querySelector<HTMLElement>('[data-job-items]');

if (progress && list && progress.dataset.running === 'true') {
  const statusText = (status: string, count?: number): string => {
    if (status === 'done') return `${count ?? 0} URL${count === 1 ? '' : 's'}`;
    if (status === 'running') return 'loading…';
    if (status === 'failed') return 'failed';
    return 'waiting';
  };

  const render = (job: {
    status: string;
    error?: string | null;
    doneUrl?: string | null;
    items: Array<{ label: string; status: string; count?: number; error?: string }>;
  }): void => {
    const done = job.items.filter((i) => i.status === 'done' || i.status === 'failed').length;
    progress.textContent = `Processed ${done} of ${job.items.length} — updates automatically.`;
    list.innerHTML = job.items
      .map((i) => {
        const error = i.error ? ` (${escapeHtml(i.error)})` : '';
        return `<li><code>${escapeHtml(i.label)}</code> — ${statusText(i.status, i.count)}${error}</li>`;
      })
      .join('');
  };

  const statusUrl = `${location.pathname.replace(/\/+$/, '')}/status`;
  const timer = setInterval(() => {
    fetch(statusUrl)
      .then((res) => (res.ok ? res.json() : null))
      .then((job) => {
        if (!job) return;
        render(job);
        if (job.status === 'done') {
          clearInterval(timer);
          // Fehler: statische Job-Seite bleibt stehen (lesbar/kopierbar).
          // Erfolg: Zielseite (doneUrl) laden, Server leitet weiter.
          location.replace(job.error ? location.pathname : (job.doneUrl ?? location.pathname));
        }
      })
      .catch(() => {
        /* Server momentan nicht erreichbar — weiter pollen */
      });
  }, 1500);
}
