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

- Converter-Output: `sites/<name>/content/` (HTML + Frontmatter), `sites/<name>/public/` (Medien, pfaderhaltend — Alt-URLs dürfen nicht brechen), `sites/<name>/data/` (site.json: Navigation, Footer, Logo, Meta)
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
- **Backend:** Bun + TypeScript; cheerio (DOM-Extraktion, Sanitizing)
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
- Divi Theme-Builder-Layouts (`.et-l--body`/`--header`/`--footer`) — Blöcke = `et_pb_module`s; kein `<article>`/`.entry-content` auf Posts
- Meta: `og:title`/`<title>` (Suffix ` - [ mslm dvlpmnt ]` — wird beim Build abgeschnitten), `meta[name=description]`, JSON-LD `datePublished`
- Post-Seiten: ~800 kB Divi-HTML (Inline-CSS) — cheerio kommt damit klar

**Site-Entscheidungen:** Kontaktformular entfällt. Design deckungsgleich zum Divi-Ist-Zustand. Client-seitige Suche in JS am Ende. Neue Media-Uploads nach `/media/`.

---

## WIZARD-FLOW (Schritte 1–4 umgesetzt; Details im Code: src/server.ts, src/wizard/*)

**Umgesetzt:**

| Schritt | Kurz | Status |
|---|---|---|
| 1 | Site-Name → `sites/<name>/` + `dist/<name>/` | ✅ |
| 2 | Quelle: Base-URL + Sitemap-Auto-Detect → `data/urls.json` (mslm: 106 URLs) | ✅ |
| 3 | Extract-Preview (1 Fetch) + **Block-Labeling** (Divi-Module als Blöcke, Heuristik-Vorschläge, Regeln site-weit in `data/blocks.json`; Labels: article, meta-\*, featured-image, author-bio, comments, related-posts, share-buttons, newsletter, drop) | ✅ |
| 3b | Structure: Nav + Footer + Logo (1 Scrape) → `data/site.json`; Fallback-Selektoren in `config.json` | ✅ |
| 4 | Voll-Lauf: Freigabe-Gate **pro Content-Gruppe** → Child-Process-Crawl (sequenziell, Delay, Raw-HTML-Cache, Retry, fail-soft) → `content/<typ>/<slug>.html` (HTML + Frontmatter: title, description, datePublished, author, categories, featuredImage) + RSS-Snapshot `data/rss.xml` | ✅ (mslm: 106/106) |

**Offen:**

| Schritt | Plan |
|---|---|
| 5 | **Build-Engine + Templates:** `content/` + `site.json` + `rss.xml` → `dist/<name>/`; URL-Contract 1:1; Templates erst funktional (BEM/Atomic), Design-Transfer separat; Title-Suffix beim Rendern abschneiden; RSS → `/blog/feed/index.xml` + `.htaccess`-301 für `/blog/rss` |
| 6 | `check`: alle 106 mslm-URLs als 200 in `dist/` |
| — | Medien-Download (`/wp-content/uploads/` pfaderhaltend nach `public/`) — **vor Cutover**, Live-Links gelten bis dahin |
| — | Archiv-Pagination — optional vor Build-Generierung |

---

## ROADMAP (Stand 2026-10-06)

1. ✅ Wizard-Gerüst: lokaler Bun-Server + Schritt-UI (Flow, Progress, Freigaben)
2. ✅ Schritt "Quelle": Sitemap-Loader (inkl. Index) → URL-Liste
3. ✅ Schritt "Extraktion": Preview + Block-Labeling (HTML-Content-Layer)
4. ✅ Schritt "Konversion": Voll-Lauf (Child-Process, Gate, Cache) → `content/` + RSS-Snapshot
5. ⏭ **Build-Engine + Templates** (nächster Schritt): `sites/<name>/{content,data}` + Templates → `dist/<name>/`; URL-Contract 1:1; Globals (Nav/Footer/Logo) aus `site.json`; RSS → `/blog/feed/index.xml` + `.htaccess`-301; Title-Suffix abschneiden
6. `check`: alle 106 mslm-URLs als 200 in `dist/`
7. Design-Transfer mit User (Divi-nah; Design = "eigene Abteilung", eigener Zeitslot)
8. Composer MVP (lokal): Editor + Kategorien + Media-Upload + Nav-/Portal-Platzierung
9. Composer Phase 2: Nostr-Relays
10. Client-seitige Suche (JS)
11. Medien-Download (`/wp-content/uploads/` → `public/`, pfaderhaltend) — vor Cutover
12. Cutover mslm am Server (nur auf User-Anweisung)

---

## ERKENNUNGS-ARCHITEKTUR (Zielbild, 2026-10-06)

wp2static wird auf 20–30+ bestehende WordPress-Sites angewendet — Divi (mslm) ist nur der erste, eher seltene Fall. **Keine strikten Site-Profile** (User-Entscheid): Themes/Builder kombinieren Markup-Konventionen frei (Fall A kommentiert anders als Fall B, Fall B packt Meta anders ein — Mischformen müssen erkannt werden). Stattdessen: **Score-basierte Musterbibliothek pro Bereich** — jeder Block wird einzeln klassifiziert, nirgends eine Profil-/Site-Auswahl dazwischengeschaltet.

1. **Segmentierung** (Registry, Feature-Sniffing statt Konfig): Divi (`et_pb_module`), Elementor (`elementor-widget-*`), Beaver Builder (`fl-module-*`), Gutenberg (`wp-block-*`), klassische Themes (Kinder von `.entry-content`/`article`) — entscheidet nur, *wie* Blöcke geschnitten werden.
2. **Features je Block** (site-agnostische Signale): normalisierte Klassen-Tokens (`et_pb_comments_0_tb_body` → `et_pb_comments`; Laufnummern/Hashes strippen — das macht Regeln über Sites portabel), Text-/href-Muster (`/category/`, `#respond`), Tag-Struktur, semantische Signale (`<time datetime>`, `itemprop="datePublished"`, Microformats/h-entry, `rel="author"`, aria-label).
3. **Score-Matching statt if-Kette**: Regel = `{ label, Feature-Matcher, Gewicht, Quelle: builtin|site|learned }`. Alle Regeln der gesamten Bibliothek werten jeden Block aus; bester Score gewinnt. Site-bestätigte Regeln (`data/blocks.json`) erhalten Bonus und schlagen eingebaute Muster → Mischformen entstehen automatisch.
4. **Lern-Loop**: bestätigte Labels = Ground Truth. Normalisierte Regeln, die auf ≥ 2 Sites greifen, werden explizit in die mitgelieferte Bibliothek *promotet* (einsehbarer Schritt, kein Blackbox-Training). KI später nur als zusätzliche Signalquelle für Blöcke unter der Score-Schwelle (Vorschlag + User-Bestätigung wie heute; deterministische Basis bleibt).

**Migrationspfad (inkrementell):** 1) Klassen-Normalisierung in bestehende Fingerprint-Regeln → 2) `matchLabel`/`suggestLabel` → Score-Matcher (mslm-Verhalten identisch) → 3) eingebaute Bibliothek (WP-klassisch, Divi, Gutenberg, Elementor …) in `src/` (builder-generisch, kein Site-spezifisches) → 4) Cross-Site-Promotion ab Site #2.

---

## OFFENE PUNKTE (iterativ füllen, jede Antwort → Entscheidungslog)

- [x] **Jobs als Kindprozess härten:** Voll-Lauf läuft als Child-Process, detached; Zustand nur über `data/job.json`; Stall-Detektor 180 s (Details: `src/wizard/crawl-job.ts`, `src/wizard/crawl.ts`)
- [x] Wizard-Schritte im Detail: Schritte 1–4 stehen (inkl. Freigabe-Gate pro Content-Gruppe)
- [x] Output-Ort: direkt nach `sites/<name>/` (`content/`, `cache/`, `data/`) — kein Zwischen-Workspace
- [ ] Git: was wird committet? (content/data ja; `cache/` und Medien-Altbestand als Kandidaten für gitignore)
- [ ] `dist/<name>/` gitignored (reproduzierbar per Build) — bestätigen
- [ ] Composer-Loop: Auto-Build nach Speichern oder manuell?
- [ ] Composer-Authoring bei HTML-Content-Layer: Markdown + `format: md|html`-Flag (angemerkt als Default, nicht final bestätigt)
- [ ] Nostr Phase 2 (später): NIP-23/kind 30023? Relays? Key-Verwaltung? Wie landen Relay-Artikel im Build?
- [ ] Erkennungs-Architektur: Ablageort promoteter Cross-Site-Regeln (committed im Repo vs. nur lokal) — ab Site #2 entscheiden
- [ ] Build: Archiv-Pagination (optional), Title-Suffix-Handling, `.htaccess`-Snippets — mit Schritt 5 klären

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
| 2026-10-01 | Langlaufende Aktionen (Collect, später Crawl) laufen als dateibackender Job (`data/job.json`) mit Fortschrittsseite — JS-Polling eines JSON-Status-Endpunkts (`GET .../jobs/<id>/status`) aktualisiert den Seiteninhalt; **kein Meta-Refresh** (User-Entscheid: Auto-Reloads sind inakzeptabel, Text muss kopierbar sein). Ohne JS: manueller Refresh-Link. Fehlgeschlagene Jobs rendern eine stehende Fehlerseite (Fehler im kopierbaren `<pre>`), statt weiterzuleiten. Wizard-Flow = Post/Redirect/Get (jede Stufe hat GET-Route, refresh-sicher) |
| 2026-10-01 | **Content-Layer: HTML statt Markdown** (User-Entscheid). Artikelinhalt wird als DOM übernommen: sanitisiertes HTML in einem `<div class="article-content">` (Tag-Allowlist: p, h1–h6, Listen, a, img, figure/figcaption, blockquote, pre/code, strong/em, table …; `b→strong`, `i→em`; alle class/style/data-Attribute strippen; href/src absolutiert, nur http/https). Kein Turndown. WP-Export (`wp-export/*.xml`) enthält nur Divi-Shortcodes → taugt nicht als Content-Quelle; Design-Transfer später separat. Output-Contract `content/`: HTML + Frontmatter statt Markdown |
| 2026-10-01 | **Block-Labeling** (User-Entscheid, kein KI-Einsatz): Top-Level-Blöcke des Containers werden in der Preview per Dropdown klassifiziert (article, meta-categories, meta-date, author-bio, comments, related-posts, share-buttons, newsletter, drop — Set erweiterbar). Fingerprint = Original-Klassen-Tokens (vor dem Strippen); Regeln in `data/blocks.json` gelten site-weit. Heuristik macht Vorschläge (category-Hrefs, comment/author-Klassen, kurzer Datumstext), User bestätigt per Klick. Voll-Lauf (Schritt 4): `drop`/`comments` → raus; `meta-*`/`author-bio` → Frontmatter |
| 2026-10-06 | **Block-Quelle: Divi-Module wenn Divi erkannt** (Theme-generisch bleiben): `.et_pb_module` im Body → Top-Level-Module sind die Blöcke (Titel/Autor/Meta/Kommentare liegen NEBEN dem Content-Container); ohne Divi Container-Kinder. Divi-Seiten ohne passenden Container failen nicht mehr hart — Module genügen als Block-Quelle |
| 2026-10-06 | **Label = Region:** Blöcke gleichen Labels werden in Dokument-Reihenfolge zu EINEM Bereich zusammengefügt (3× comments → ein Kommentarbereich; article-Blöcke → ein `article-content`; meta-\*/author-bio → Frontmatter; drop → raus) |
| 2026-10-06 | Label-Set erweitert: `meta-comments` (Kommentar-Anker/Count), `featured-image` (Cover; Nur-Bild-Block mit Image-Klasse → `featuredImage: {src, alt}` im Frontmatter, raus aus dem Content). Icon-Font-Glyphen (Unicode Private Use) werden vor der Text-Heuristik entfernt |
| 2026-10-06 | **Erkennungs-Architektur festgelegt** (User-Entscheid): keine strikten Site-Profile — score-basierte Musterbibliothek pro Bereich (Segmentierung per Builder-Registry, normalisierte Klassen-Tokens, Feature-Matching mit Gewichten, Site-Regeln schlagen Bibliothek, Cross-Site-Promotion; KI später nur als Vorschlagsquelle unter Score-Schwelle). Zielbild + Migrationspfad: Abschnitt „Erkennungs-Architektur" |
| 2026-10-06 | **Schritt 3b „Structure"**: Sitemaps enthalten keine Navigation → Startseite 1× scannen: Nav (erstes `<header>`/`<nav>`, ul/ol-li-Walk), Footer (letzter `<footer>`), Logo (erstes Header-Bild; keins → `null` ist korrekt) → `data/site.json`; Fallback-Selektoren site-weit in `config.json` |
| 2026-10-06 | **Voll-Lauf-Umfang (User):** mslm nimmt ALLE 106 URLs mit (Posts/Pages/Projects/Kategorien; Tool-Fokus zuerst WP-Haus-Typen). Freigabe **pro Content-Gruppe**. Medien-Download deferred (Live-Links bis Cutover). RSS = 1:1 statischer Snapshot. Archiv-Pagination optional vor Build |
| 2026-10-06 | **Schritt 4 umgesetzt:** Crawl als detached Child-Process (Zustand nur in `data/job.json`, Spawn-stderr → `data/crawl.log`, Stall-Detektor 180 s + Fallback-Redirect), Freigabe-Gate `/run` (`run.json`, `previews.json`), Raw-HTML-Cache, Retry+Backoff, Output `content/<typ>/<slug>.html` mit YAML-Frontmatter (author aus „Written by:"-Heading, categories aus `/category/`-Ankern), Dry-Run per `limit`-Arg. UI reagiert auf Stillstand (Warnung ab 60 s, ehrliche „Run incomplete"-Zusammenfassung) |
