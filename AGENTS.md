# wp2static — Generischer WordPress→Statisch-Converter (lokaler Wizard, UI-getrieben)

> **AUDIENCE — READ FIRST.** This file is the single source of instructions for the **OpenCode** agent working on this repo. Wherever the text says "the agent", read it as the active OpenCode instance.

## PROJEKT-ZIEL

**wp2static** konvertiert gerenderte WordPress-Websites zu statischem Content — UI-getriebener **Wizard** (ähnlich der WordPress-Installationsroutine), der alle relevanten Infos abfragt und die Konversion **schritt für Schritt lokal** ausführt. Details folgen — siehe Offene Punkte.

**Monorepo (User-Entscheid 2026-10-01):** Es gibt **keine separaten Consumer-Repos**. Alles lebt hier:

```
wp2static/
├── src/                 # Generisch: Wizard + Converter-Kern + Build-Engine + Composer
├── sites/<name>/        # Pro Website: Config, Templates/Design (SCSS/TS), content/, public/ (Medien), data/
└── dist/<name>/         # Fertige statische Website je Site (Build-Output, FTP-Quelle)
```

- Converter-Output: `sites/<name>/content/` (Markdown + Frontmatter), `sites/<name>/public/` (Medien, pfaderhaltend — Alt-URLs dürfen nicht brechen), `sites/<name>/data/` (site.json: Navigation, Footer, Logo, Meta)
- Build-Output: `dist/<name>/` — das, was per FTP hochgeht
- WP-REST-API ist unbrauchbar bei Page-Buildern (liefert Divi-Shortcodes unverarbeitet) → Scrape der gerenderten Frontend-Seiten

**Erste Site (Testfall & Maßstab):** mslmdvlpmnt.com — siehe Abschnitt "Referenz-Site mslm".

**Vorgehen (User-Entscheid 2026-10-01):** Der Converter wird **zuerst** gebaut und schrittweise angepasst, bis das Endergebnis steht: statische mslm-Site + Composer.

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

1. **Scan existing:** `src/`, `sites/<name>/`, Beispiel-Configs — ⚠️ NEVER re-implement existing helpers!
2. **Find 2-3 similar implementations** in the codebase, read them fully.
3. **DRY:** 2+ usages → extract to helper.
4. **SHOW user what you found** and how it relates to the current task.
5. **WAIT for user confirmation before coding.**

**External Research:**
- cheerio Docs (DOM-Extraktion), Turndown Docs/Plugins (HTML→MD), MDN
- WP-Theme-Realität: Page-Builder-HTML (Divi ~800 kB/Seite, Inline-CSS) — Parser müssen damit umgehen

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
- **Frontend/Wizard/Composer:** plain HTML/CSS/TS, kein Framework
- **Site-Build:** Template-Engine im `src/` (generisch), Templates pro Site unter `sites/<name>/templates/`, SCSS → CSS, Vanilla JS/TS (progressive enhancement — Seiten müssen ohne JS funktionieren)

**Regeln:**
- ❌ Keine Frameworks, keine CDNs, keine externen Fonts/Scripts — self-hosted
- ❌ **Keine Site-spezifischen Pfade/Selektoren im `src/`** — alles Site-spezifische lebt in `sites/<name>/` (Config, Templates)
- ✅ **Deterministisch & idempotent:** gleicher Lauf = gleicher Output; Re-Lauf überschreibt ohne Duplikate
- ✅ **Politeness:** sequenzielle Requests, konfigurierbarer Delay (Standard ≥ 400 ms), Retry mit Backoff — Ziel-Hosts sind oft Shared Hosting mit CPU-Limits
- ✅ **Fail soft pro Seite:** ein kaputtes Dokument bricht den Lauf nicht ab; Fehler sammeln, am Ende reporten
- ✅ **Kein Netzverkehr** außer zur konfigurierten Quelle
- ✅ Raw-HTML-Cache auf Platte (kein Doppel-Fetch bei Re-Läufen/Stichproben)
- ✅ **Styles bedarfsweise:** Selektoren/Klassen entstehen erst, wenn das HTML sie tatsächlich benutzt — kein Vorrat, nichts "auf Vorrat" anlegen
- ✅ **CSS-Architektur wie noornote-v1:** BEM + Atomic Design (abstracts → base → atoms → molecules → organisms); Typografie: genau 3 Schriftgrößen + `.h1`–`.h6`; Abstände nur `$gap`-basiert; Palette zunächst weiß/schwarz/`#efefef`; Grid statt Flex
- ✅ Templates/Partials sind die einzige Quelle für wiederholtes HTML; Design-Tokens in `_variables`/`_mixins`, keine Magic Values

**Clean Code Standards:** Modular (fetch / extract / transform / download / write getrennt), reusable helpers. No dirty hacks. No TODOs in code.

**File Editing:** Use the native `edit` tool for targeted changes; batch multiple edits to the same file where possible. Read a file before overwriting it; keep edits minimal and match surrounding style.

---

### 5. USER SOVEREIGNTY & PRIVACY (Non-Negotiable)

- Wizard + Composer laufen **ausschließlich lokal** (localhost) — **nie deployen**. Build/Deploy müssen technisch sicherstellen, dass Composer-Code nie in `dist/<name>/` landet.
- **Keine Cookies, kein Analytics, kein Tracking, keine externen Endpunkte** in den generierten Sites.
- Kontaktformular entfällt (mslm-Entscheid 2026-09-29); Kontaktseite nur mit direkten Angaben.
- Converter kontaktiert nur die konfigurierte Quelle. Keine Telemetrie.
- Keine Credentials/Secrets im Repo; gitignored.
- **Nostr (Composer Phase 2):** Publishen nur auf explizite User-Anweisung; Keys wie Secrets behandeln.
- Export läuft gegen Live-Sites: nur auf explizite User-Anweisung, Delays respektieren (CPU-Limits!).

---

### 6. WORKFLOW ESSENTIALS

**Communication:** Keep replies short (user reads first paragraph only).

**Iterativ & transparent:** Der User will **jeden Schritt verstehen**. Kleine Schritte; vor jedem Schritt 1–2 Sätze, was passiert und warum; bei Verzweigungen nachfragen statt raten.

**Vor jedem Volllauf:** Dry-Run (Sitemaps + Stichproben) und User-Freigabe. Nichts "einfach mal" gegen eine Live-Site laufen lassen.

**Build gate:** Vor jedem Commit muss der Build der betroffenen Site durchlaufen; `check` (alle URLs als 200 in `dist/`) bei Site-Änderungen.

**Reset:** `bun run reset` leert `sites/` + `dist/` (frischer Wizard-Durchlauf; Dev-Server braucht dafür keinen Neustart — der Wizard ist zustandslos/dateibasiert).

**Deployment:** FTP je Site nach `public_html/` (Shared Hosting, MyNymbox) — nur auf explizite User-Anweisung. Cutover: Docroot-Backup → WP entfernen → statische Files → `.htaccess` minimieren. Rollback = Backup.

**Debug:** Don't leave behind debug logs or traces of unsuccessful code changes.

---

## COMPOSER

Lokaler Artikel-Editor, pro Site nutztbar (`sites/<name>/`). Wird **ausschließlich lokal** aufgerufen — nie auf dem Live-Server.

**Funktionen:**
- Artikel schreiben (Markdown) → `sites/<name>/content/`
- **Speicher-Backend pro Seite wählbar (dual):** `lokal` (Phase 1, zuerst) oder `Nostr-Relays` (Phase 2 — komplexer)
- Kategorien on-the-fly anlegen + wiederverwenden
- Media-Upload → `/media/` der Site (Alt-Bestand bleibt unter `/wp-content/uploads/`)
- Neue Seiten platzieren: Hauptnavigation oder Portalseiten (z. B. Blog-Übersicht)

**Kein Posts/Pages-Unterschied:** intern nur ein Artikel-Typ.

**Loop:** Composer editiert `sites/<name>/{content,data}` → Build → `dist/<name>/` → FTP (manuell, auf User-Anweisung).

---

## REFERENZ-SITE mslm (mslmdvlpmnt.com, erster Testfall)

**Quelle:** WordPress 6.x + Divi. 27 Posts, 12 Seiten, 54 Projects, 10 Kategorie-Archive, Kommentare überall geschlossen (ignorieren). Migrationsgrund: CPU-Limit-Warnungen durch Bot-Traffic.

**URL-Contract (1:1, bestätigt 2026-10-01):**

| Inhalt | Anzahl | URL-Form |
|---|---|---|
| Blog-Posts | 27 | `/<slug>/` |
| Seiten | 12 | `/<slug>/` |
| Projects | 54 | `/project/<slug>/` |
| Kategorien | 10 | `/category/<slug>/` |
| RSS-Feed | — | `/blog/rss` ist 301 auf `/blog/feed/` → als `/blog/feed/index.xml` generieren, alter Pfad per 301 in `.htaccess` |
| Bilder | — | `/wp-content/uploads/YYYY/MM/…` pfaderhaltend |

**Bestandsordner im Docroot (NICHT anfassen):** `ebook/`, `fiqh-of-social-media/`, `SearchInNpub/`, `ZapStar/`

**Scrape-Erkenntnisse (getestet, nicht wiederholen):**
- Content-Container: `article .et_pb_post_content` (Posts), `.entry-content` (Seiten, Fallback)
- Meta: `<title>` (Suffix ` - [ mslm dvlpmnt ]` abschneiden), `meta[name=description]`, JSON-LD `datePublished`, `og:image`, Kategorien aus `a[href*="/category/"]` im Artikel
- Post-Seiten: ~800 kB Divi-HTML (Inline-CSS) — cheerio/Turndown kommen damit klar

**Site-Entscheidungen:** Kontaktformular entfällt. Design deckungsgleich zum Divi-Ist-Zustand. Client-seitige Suche in JS am Ende. Neue Media-Uploads nach `/media/`.

---

## WIZARD-FLOW (wird iterativ mit User konkretisiert)

| Schritt | Zweck | Status |
|---|---|---|
| 1 | **Website-Name abfragen** → legt `sites/<name>/` + `dist/<name>/` an (Name slug-sicher normalisieren, z. B. `mslmdvlpmnt.com`) | **funktionsfähig** (Server + Seite + Verzeichnis-Setup getestet) |
| 1a | UI-Grundlagen: weiße Seite, zentrierte `<section>` (Card) mit Beschreibung + Feldern, unten `#efefef`-Action-Bar mit Buttons | bestätigt 2026-10-01 |
| 2 | **Quelle:** Base-URL + optional Sitemap-URL → Auto-Detect (`/sitemap.xml`, `/wp-sitemap.xml`, `/sitemap_index.xml`) → bei Index: Kinder auswählen → URLs nach `sites/<name>/data/urls.json` (mit Quelle je URL), State in `data/source.json` | **funktionsfähig** (getestet gegen lokalen Sitemap-Fixture) |
| 3 | **Extraktion-Preview:** URL aus `urls.json` wählen (Select mit Optgroups je Sitemap) + Content-Selektor(e) kommagetrennt (leer = Auto: `.entry-content`, `article`, `main`, Schwellwert 200 Zeichen) → holt genau diese eine Seite → Meta (Title via og:title/<title>, Description, datePublished via JSON-LD) + Turndown-Markdown-Vorschau | **funktionsfähig** (getestet gegen lokalen Fixture) |
| 4 | folgen — Voll-Lauf (alle URLs, sequenziell + Delay) nach User-Freigabe der Preview-Qualität | offen |

---

## ROADMAP (Converter zuerst — iterativ gegen mslm verifizieren)

1. Wizard-Gerüst: lokaler Bun-Server + Schritt-UI (Flow, Progress, Freigaben)
2. Schritt "Quelle": baseUrl + Sitemap-URLs → Sitemap-Loader (inkl. Index) → URL-Liste
3. Schritt "Extraktion": Selektoren testen, Stichproben als Markdown-Preview → User-Freigabe
4. Schritt "Konversion": Voll-Lauf mit Progress (sequenziell, Delay, Cache, Retry) → `sites/mslmdvlpmnt.com/{content,public,data}`
5. Build-Engine + Templates: `sites/<name>/` → `dist/<name>/` inkl. RSS (`/blog/feed/index.xml`) + `.htaccess`-Snippets
6. `check`: alle ~105 mslm-URLs als 200 in `dist/`
7. Design-Transfer mit User (Divi-nah; Design = "eigene Abteilung", eigener Zeitslot)
8. Composer MVP (lokal): Editor + Kategorien + Media-Upload + Nav-/Portal-Platzierung
9. Composer Phase 2: Nostr-Relays
10. Client-seitige Suche (JS)
11. Cutover mslm am Server (nur auf User-Anweisung)

---

## OFFENE PUNKTE (iterativ füllen, jede Antwort → Entscheidungslog)

- [ ] Wizard-Schritte im Detail (welche Infos wann, welche Freigaben wo)
- [ ] Git: was wird committet? (Medien-Altbestand ist groß — Kandidat für gitignore; content/data?)
- [ ] `dist/<name>/` gitignored (reproduzierbar per Build) — bestätigen
- [ ] Output direkt nach `sites/<name>/` schreiben oder Zwischen-Workspace?
- [ ] Config-Profil pro Site speichern/wiederverwenden? Format?
- [ ] Composer-Loop: Auto-Build nach Speichern oder manuell?
- [ ] Nostr Phase 2 (später): NIP-23/kind 30023? Relays? Key-Verwaltung? Wie landen Relay-Artikel im Build?

---

## GIT-WORKFLOW (wie NoorNote)

**Branches:** `development` = Arbeitszweig, `main` = stabiler Stand.

| Command | Purpose |
|---------|---------|
| `/commit` | git add + commit (nur auf explizite Anweisung) |
| `/push` | Merge development → main, push beide, zurück zu development |
| `/pull` | Pull beide Branches, zurück zu development |

Commits: Englisch, kurzer One-Liner, keine Präfixe, keine KI-Signaturen.

---

## ENTSCHEIDUNGSLOG

| Datum | Entscheidung |
|---|---|
| 2026-10-01 | Eigenes Repo, Name `wp2static` (ursprünglich aus mslmdvlpmnt.com/static ausgegliedert) |
| 2026-10-01 | UI-getriebener Wizard (wie WP-Installationsroutine), läuft nur lokal; kein reines CLI. Details folgen |
| 2026-10-01 | Export-Strategie: gerenderte Frontend-Seiten scrapen (WP-REST-API liefert Divi-Shortcodes unverarbeitet) |
| 2026-10-01 | Vorgehen: Converter zuerst bauen, schrittweise anpassen bis Endergebnis (statische mslm-Site + Composer) steht |
| 2026-10-01 | **Monorepo:** kein separates Consumer-Repo — `sites/<name>/` (Quelle) + `dist/<name>/` (Build-Output) hier; static/-Repo wird eingestellt |
| 2026-10-01 | Wizard-Schritt 1: Website-Name abfragen → Verzeichnis-Setup (`sites/<name>/` + `dist/<name>/`) |
| 2026-10-01 | Wizard-UI: weiße Seite, zentrierte Card-Section, `#efefef`-Action-Bar; SCSS-Basis: 3 Schriftgrößen + `.h1`–`.h6`, `$gap`-Abstände, Palette weiß/schwarz/`#efefef`, BEM + Atomic Design (noornote-Vorbild) |
| 2026-10-01 | CSS-Prinzip: Selektoren nur bei Bedarf bauen — kein Vorrat |
| 2026-10-01 | Dev-Live-Reload direkt im Bun-Server (`bun --hot` + `fs.watch` + `/__reload`-Poll-Script, nur im Dev-Modus) — kein Vite, der Wizard ist servergerendert |
| 2026-10-01 | Wizard-State zustandslos über Dateien: `data/source.json` (Zwischenstand) + `data/urls.json` (URL-Liste mit Quell-Sitemap je URL) |
| 2026-10-01 | Langlaufende Aktionen (Collect, später Crawl) laufen als In-Memory-Job mit Fortschrittsseite (Meta-Refresh 1,5 s, funktioniert ohne JS); Wizard-Flow = Post/Redirect/Get (jede Stufe hat GET-Route, refresh-sicher) |
