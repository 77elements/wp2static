/**
 * Progressive Enhancement only — der Wizard funktioniert ohne JS (Form-POST).
 * Einziger Job: Submit-Button gegen Doppelklicks sperren.
 */

const form = document.querySelector<HTMLFormElement>('#wizard-form');

form?.addEventListener('submit', () => {
  const submit = form.querySelector<HTMLButtonElement>('button[type="submit"]');
  if (submit) submit.disabled = true;
});
