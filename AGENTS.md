# wp2static — Generischer WordPress→Statisch-Converter (lokaler Wizard, UI-getrieben)

> **AUDIENCE — READ FIRST.** This file is the single source of instructions for the **OpenCode** agent working on this repo. Wherever the text says "the agent", read it as the active OpenCode instance.

## PROJEKT-ZIEL

**wp2static** konvertiert gerenderte WordPress-Websites zu statischem Content:

- **UI-getriebener Wizard** (ähnlich der WordPress-Installationsroutine): fragt alle relevanten Infos vom User ab (Quelle, Sitemaps, Selektoren, Ziele) und führt die Konversion **schritt für Schritt auf dem lokalen Rechner** aus. Details folgen — siehe Offene Punkte.
- Content → **Markdown + Frontmatter** (`content/`)
- Medien 1:1 spiegeln (`public/`, pfaderhaltend — Alt-URLs dürfen nicht brechen)
- Site-Metadaten → `data/site.json` (Navigation, Footer, Logo, Meta)

**Generisch:** Keine Website-spezifischen Pfade/Selektoren im Code. Jede WP-Site = eine Config (im Wizard abgefragt/gespeichert). WP-REST-API ist unbrauchbar bei Page-Buildern (liefert Divi-Shortcodes unverarbeitet) — deshalb Scrape der gerenderten Frontend-Seiten.

**Erster Consumer:** mslmdvlpmnt.com — Repo: `~/projects/mslmdvlpmnt.com/static/` (AGENTS.md dort: URL-Contract + Site-Recherche, die in die Wizard-Defaults/Config einfließt).

**Vorgehen (User-Entscheid 2026-10-01):** Der Converter wird **zuerst** gebaut — das gewünschte Endergebnis (statische Version der mslm-Site + Composer) ist der Maßstab. Iterativ: Converter-Output ins Consumer-Repo schreiben → prüfen → anpassen, bis es passt.

## ⚠️ CRITICAL BEHAVIOR — READ FIRST, ALWAYS ⚠️

### 1. NO ESSAYS (Answer Like a Human)

⚠️ **DER USER LIEST NUR DEN ERSTEN SATZ.** Jede Antwort muss so gebaut sein, dass der erste Satz allein als Antwort funktioniert. 1-2 Seiten Fachaufsätze = die durch KI eingesparte Zeit wird wieder mit Lesen verbrannt. Erster Satz = Antwort. Alles danach: nur auf explizite Nachfrage.

⚠️ **Keine DIN-A4-Textwüsten. Auf den Punkt. Priorisierend. Schrittweise.** ⚠️

- Lead with the most important point. Cut everything that's not load-bearing.
- Prefer 3–8 short lines over paragraphs. Use a small table or 3-bullet list only when it genuinely clarifies.
- When research yields a lot, present the verdict + 2–3 options, NOT the full transcript.
- No recap of what was just discussed. No "what I'll do next" preface — just do it.

**Critical Rule:** Violating this = wasted work that gets reverted

---

### 2. RESEARCH FIRST (90% Research, 10% Coding)

⚠️ **DON'T GUESS! KNOW! ANALYZE! FIND OUT! LEARN!** ⚠️

**Before writing ANY code:**

1. **Scan existing:** `src/`, Beispiel-Configs, Docs — ⚠️ NEVER re-implement existing helpers!
2. **Find 2-3 similar implementations** in the codebase, read them fully.
3. **DRY:** 2+ usages → extract to helper.
4. **SHOW user what you found** and how it relates to the current task.
5. **WAIT for user confirmation before coding.**

**External Research:**
- cheerio Docs (DOM-Extraktion), Turndown Docs/Plugins (HTML→MD), MDN
- WP-Theme-Realität: Page-Builder-HTML (Divi ~800 kB/Seite, Inline-CSS) — Parser müssen damit umgehen

**Referenz:** Consumer-Repos (mslmdvlpmnt.com/static) + deren AGENTS.md für Site-spezifische Erkenntnisse.

**Critical Rule:** Violating this = wasted work that gets reverted

---

### 3. ANTI-SYCOPHANCY (Honest Disagreement > Fake Agreement)
- Say "I don't know" instead of guessing
- Push back if requirements unclear — ask questions
- CONTRADICT if you have a better solution
- No empty confirmations ("Got it", "Clear", "Exactly")
- Admit mistakes immediately

---

### 4. ARCHITECTURE ENFORCEMENT

**Stack (fixed, no frameworks):**
- **Backend:** Bun + TypeScript; cheerio (DOM), turndown (HTML→MD)
- **Frontend/Wizard:** plain HTML/CSS/TS, kein Framework, kein Build-Overkill
- **Architektur:** lokaler Bun-Server (Wizard-UI + Konvertierungs-API) — Server macht Fetch/Extraktion/Download, UI zeigt Schritte + Fortschritt + Freigaben

**Regeln:**
- ❌ Keine Frameworks, keine CDNs, keine externen Fonts/Scripts
- ❌ Keine Site-spezifischen Pfade/Selektoren im Converter-Code — alles über Config
- ✅ **Deterministisch & idempotent:** gleicher Lauf = gleicher Output; Re-Lauf überschreibt ohne Duplikate
- ✅ **Politeness:** sequenzielle Requests, konfigurierbarer Delay (Standard ≥ 400 ms), Retry mit Backoff — Ziel-Hosts sind oft Shared Hosting mit CPU-Limits
- ✅ **Fail soft pro Seite:** ein kaputtes Dokument bricht den Lauf nicht ab; Fehler sammeln, am Ende reporten
- ✅ **Kein Netzverkehr** außer zur konfigurierten Quelle
- ✅ Raw-HTML-Cache auf Platte (kein Doppel-Fetch bei Re-Läufen/Stichproben)

**Clean Code Standards:** Modular (fetch / extract / transform / download / write getrennt), reusable helpers. No dirty hacks. No TODOs in code.

**File Editing:** Use the native `edit` tool for targeted changes; batch multiple edits to the same file where possible. Read a file before overwriting it; keep edits minimal and match surrounding style.

---

### 5. USER SOVEREIGNTY & PRIVACY (Non-Negotiable)

- Der Wizard läuft **ausschließlich lokal** (localhost) — **nie deployen**, analog Composer im Consumer-Repo.
- Converter kontaktiert nur die konfigurierte Quelle. Keine Telemetrie, keine externen Endpunkte, keine Updates-Checks.
- Keine Credentials/Secrets im Repo; Konfigurationsdateien mit sensiblen Daten sind gitignored.
- Export läuft gegen Live-Sites: nur auf explizite User-Anweisung, Delays respektieren (CPU-Limits!).

---

### 6. WORKFLOW ESSENTIALS

**Communication:** Keep replies short (user reads first paragraph only).

**Iterativ & transparent:** Der User will **jeden Schritt verstehen**. Kleine Schritte; vor jedem Schritt 1–2 Sätze, was passiert und warum; bei Verzweigungen nachfragen statt raten.

**Vor jedem Volllauf:** Dry-Run (Sitemaps + Stichproben) und User-Freigabe. Nichts "einfach mal" gegen eine Live-Site laufen lassen.

**Process:** Commit/push nur auf explizite Anweisung (`/commit`, `/push`). Debug-Spuren aufräumen.

---

## GIT-WORKFLOW (wie NoorNote)

**Branches:** `development` = Arbeitszweig, `main` = stabiler Stand.

| Command | Purpose |
|---------|---------|
| `/commit` | git add + commit (nur auf explizite Anweisung; erster Commit legt main + development an) |
| `/push` | Merge development → main, push beide, zurück zu development |
| `/pull` | Pull beide Branches, zurück zu development |

Commits: Englisch, kurzer One-Liner, keine Präfixe, keine KI-Signaturen.

---

## ROADMAP (Converter zuerst — iterativ gegen mslm verifizieren)

1. Wizard-Gerüst: lokaler Bun-Server + Schritt-UI (Flow, Progress, Freigaben)
2. Schritt "Quelle": baseUrl + Sitemap-URLs abfragen → Sitemap-Loader (inkl. Sitemap-Index) → URL-Liste
3. Schritt "Extraktion": Content-Selektoren testen, 2–3 Stichproben als Markdown-Preview zeigen → User-Freigabe
4. Schritt "Konversion": Voll-Lauf mit Progress (sequenziell, Delay, Cache, Retry)
5. Medien-Mirror (pfaderhaltend) + `data/site.json` (Nav/Footer/Logo/Meta)
6. Summary/Report (ok/failed, Medien gezählt) + URL-Check im Output
7. Erste Nutzung: mslmdvlpmnt.com

---

## OFFENE PUNKTE (User konkretisiert noch)

- [ ] Wizard-Schritte im Detail (welche Infos wann abgefragt, welche Freigaben wo)
- [ ] Output-Vertrag: schreibt der Wizard direkt ins Consumer-Repo (Zielpfade aus Config) oder erst in Workspace + Kopierschritt?
- [ ] Config speichern/wiederverwendbar machen (Profil pro Site)? Format?
- [ ] CLI-Fallback für Automatisierung nötig oder Wizard-only?

---

## ENTSCHEIDUNGSLOG

| Datum | Entscheidung |
|---|---|
| 2026-10-01 | Eigenes Repo, Name `wp2static` (aus mslmdvlpmnt.com/static ausgegliedert) |
| 2026-10-01 | UI-getriebener Wizard (wie WP-Installationsroutine), läuft nur lokal; kein reines CLI. Details folgen |
| 2026-10-01 | Export-Strategie: gerenderte Frontend-Seiten scrapen (WP-REST-API liefert Divi-Shortcodes unverarbeitet) |
| 2026-10-01 | Vorgehen: Converter zuerst bauen, schrittweise anpassen bis Endergebnis (statische mslm-Site + Composer) steht |
