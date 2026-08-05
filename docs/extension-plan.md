# Playlist Warden for YouTube — Extension-Plan (WXT, Chrome/Firefox/Safari) — Vollausbau „B"

Ziel: die **komplette Playlist-Verwaltung als WebExtension** (Variante **B**) —
Checks, Writes, Regeln, UI, Storage, OAuth **in der Extension**, plus der Teil, den
nur ein Browser kann: den **Adder** aus der eingeloggten YouTube-Seite lesen.
Cross-Browser: **Chrome, Firefox, Safari**. Ein Codebase via **WXT**.

**Konsequenz (bewusst):** „B" **löst die PHP-Web-App ab**. Wir pflegen nicht zwei
volle Codebasen. Das PHP-`web/` bleibt als **Referenz** (die reine Check-/Plan-Logik
`web/lib/checks.php`, Regel-Shape, Owner-Check) und wird nach der Migration
zurückgebaut/archiviert. Der Preis von B: **pro Browser/Profil** statt geteiltem
Server-Zustand — kein Mehrbenutzer/zentrales Audit/durable Server-DB (bewusst
akzeptiert, weil Einzel-Operator-Tool).

Reihenfolge: **M1 zuerst** (kleinster nützlicher Schritt, sofort testbar), dann
schrittweise der Rest — jede Stufe für sich lauffähig.

---

## Was wandert wohin (PHP `web/` → Extension)

| PHP-Panel heute | Extension (Ziel) |
|---|---|
| `web/lib/checks.php` (pure) | `utils/checks.ts` — **1:1-Port** (dead/dupes/content/cap/shuffle/prune) |
| `ytapi.php` (Data API, token-only) | `utils/yt.ts` — `fetch` gegen Data API v3 |
| Adder (collect_adders.py / InnerTube) | Content-Script, **nativ** auf der Playlist-Seite |
| `store.php` (SQLite: playlists/rules/adder_map/contributor/audit/jobs) | `utils/store.ts` über **`browser.storage.local`** (bzw. IndexedDB) |
| OAuth/OIDC (Google-SSO) | `browser.identity.launchWebAuthFlow` + PKCE |
| Owner-Check (`channels.list mine` vs. `playlist.channelId`) | gleich, in `utils/yt.ts` |
| controllers/views/layout | Popup + Options-Page + optional On-Page-Panel (WXT + Svelte) |

Die Check-/Plan-Logik ist **pure Funktionen** und schon einmal portiert
(Python→PHP, paritätsgetestet). PHP→TS ist mechanisch und wird in TS erneut
paritätsgetestet.

---

## Meilenstein 1 — Adder-Capture → Zwischenablage (jetzt)

Kleinste Stufe, unabhängig vom Rest nutzbar; solange das Panel noch existiert,
kann die Map dort eingefügt werden; sobald Storage steht (M2), schreibt die
Extension direkt in ihr eigenes `adder_map`.

- **WXT-Projekt** `extension/` (Vite, TS, MV3).
- **Isolierter Content-Script** (`entrypoints/content.ts`): nur auf
  `youtube.com/playlist?list=…`; Button „Copy adder map"; `yt-navigate-finish`.
- **MAIN-World-Reader** via `injectScript` (`entrypoints/injected.ts`): liest
  `window.ytInitialData`, `postMessage` zurück (cross-browser-sicher).
- **Pure `utils/adders.ts`** (Port aus `check_playlist_web.py`:
  `findAll`/`addedBy`/`ownerFrom`/`extractAdders`), unit-getestet gegen Fixture.
- JSON `{videoId: avatarPhotoId}` in die Zwischenablage.
- Permissions: nur `*://www.youtube.com/*` + `clipboardWrite`.
- Grenzen: erste ~100 Einträge (Paging = M3), nur `/playlist`.

---

## Meilenstein 2 — Storage + Regeln + UI-Gerüst

- **`utils/store.ts`** über `browser.storage.local`: `playlists` (id→title/privacy/
  cap/shuffle), `rules` je Playlist, `adderMap`, `audit`, `jobs`. Schema-Helfer +
  Migrationen (Versionsschlüssel). (Contributor→Name-Mapping später wieder entfernt.)
- **Options-Page** (WXT + **Svelte**, kleiner Bundle): verwaltete Playlists,
  **Regel-Editor** (Felder wie `CONTENT_DEFAULT_RULES`),
  Audit/Job-Ansicht.
- M1-Adder schreibt ab hier direkt in `store.adder_map` (kein Clipboard-Umweg mehr).

## Meilenstein 3 — Checks (read)

- **`utils/checks.ts` (gebaut):** verhaltensgleicher Port von `web/lib/checks.php`
  (`deadReason`, `duplicates`, `contentViolation` + Duration-Parser,
  `planCap`/`planShuffle`/`prunePlanRemovals`), seitenwirkungsfrei. Regel-Merge =
  `schema.normalizeRules` (aus M2). **Parity-Test** in TS (11 Fälle) gegen dieselben
  Fälle wie `web/tests/run.php`.
- **`utils/yt.ts` + „Overview"-UI (an M4 gekoppelt):** Data-API-Reads
  (`playlistItems.list`, `videos.list`) + raw→`VideoInfo`-Shaping + Overview (alle
  Checks + Dry-Run-Pläne). **Reads brauchen den OAuth-Token → zusammen mit M4**
  (ohne Auth nicht live ausführbar). InnerTube-Paging für Adder >100 ebenfalls dort.

## Meilenstein 4 — OAuth + Writes

- **OAuth (cross-browser-heikel) — gebaut (`utils/auth.ts` pure + `utils/session.ts`):**
  ein **Web-Application**-Google-Client; `browser.identity.launchWebAuthFlow` mit
  `redirect_uri = browser.identity.getRedirectURL()`. **Abweichung vom Plan:** statt
  PKCE+Refresh der **implizite Flow** (`response_type=token`) + **stilles Erneuern**
  (`interactive:false`) — ein öffentlicher Extension-Client kann das von Google am
  Token-Endpoint verlangte Secret nicht halten. Chrome/Firefox/Safari haben **je eine
  andere Redirect-URL**, die alle im Google-Client registriert sein müssen. Token in `storage`.
- **Writes** über die **offizielle Data API** (nie interne Edit-Endpoints):
  `playlistItems.delete`/`.update` (cap-shuffle), `.delete` (prune),
  `playlists.insert` (anlegen). **Owner-Check** vor jedem Write (`channels.list
  mine` vs. `playlist.snippet.channelId`).
- **Dry-Run→Apply** mit Bestätigung; jede Löschung ins `audit`.
- **MV3-Lifecycle:** Writes **user-getriggert im Vordergrund** (Popup/Options)
  halten → umgeht die Kurzlebigkeit des Service-Workers; nur falls später
  Hintergrund-/Batch-Läufe nötig, `alarms` + gestückelte Verarbeitung.

## Meilenstein 5 — Politur + Verteilung + Panel-Rückbau

- **Gebaut:** lesbare API-Fehler inkl. Quota-/Rate-Limit-Hinweis (`ytApiMessage`,
  403 quotaExceeded); fehlgeschlagene Apply-Läufe als Error-Job protokolliert
  (Teil-Löschungen bleiben im Audit). **Packaging:** `wxt zip` → Chrome- +
  Firefox-Store-ZIP plus AMO-Sources-ZIP. Bundle ~38 kB gezippt.
- **Verteilung:** Firefox self-signed **unlisted** (empfohlen); Chrome unpacked/
  unlisted; Safari via **Xcode auf macOS**.
- **Offen (bewusst):** Icons + Store-Assets (Binärdateien → git-ignoriert, dein
  Schritt); i18n nicht nötig (App-Ausgaben englisch, Konvention).
- **PHP-`web/`-Rückbau: erledigt.** `web/` + Python-Helfer entfernt; README/AGENTS/TODO
  auf „Extension ist das Produkt" umgestellt.

---

## Cross-Browser & Verifikation

- WXT: `wxt build -b chrome|firefox|safari`, MV3, unifiziertes `browser.*`.
- **Hier baubar/testbar (Linux):** Chrome- + Firefox-Builds; alle **pure**-Unit-/
  Parity-Tests (adders, checks) via `node --test`.
- **Nicht hier:** Safari-Packaging (braucht macOS + Xcode,
  `xcrun safari-web-extension-converter`); Live-Läufe mit echtem Google-Login/
  eingeloggter YouTube-Session (dein Schritt).
- **ToS:** alle Writes/Reads offizielle Data API = sanktioniert; **einzige
  Grauzone bleibt der InnerTube-Adder-Read** (minimal, read-only, user-getriggert).

## WXT-API-Abgleich (geprüft gegen wxt.dev, 2026-08-04)

Bestätigt (Plan/M1 stimmen mit der API überein):
- **`defineConfig`** ist die Config-API (Modul `wxt`). ✓
- **MAIN-World:** WXT hat zwar `world: 'MAIN'` (`MainWorldContentScriptDefinition`),
  aber die Doku sagt explizit: `world:'MAIN'` ist **nur Chromium** und hat **keinen**
  Extension-API-Zugriff. **Empfohlen ist `injectScript`** (MV2+MV3, alle Browser,
  Parent-Content-Script fürs Messaging) — genau der M1-Ansatz. ✓
- **`injectScript` braucht manuell `web_accessible_resources`** (Doku-Beispiel) —
  in M1 gesetzt (`injected.js`), Build zeigt es korrekt (Chrome-Objektform,
  Firefox-String-Array). ✓
- **Targets** `wxt build -b chrome|firefox|safari` (`TargetBrowser`), MV2/MV3 aus
  einem Codebase. ✓

Präzisierungen (in die Umsetzung aufnehmen):
- **MV2/Firefox-Caveat:** `injectScript` ist dort **asynchron** (holt den
  Script-Text und injiziert inline; nicht am `run_at`). Für M1 unkritisch, weil
  button-getriggert und via `postMessage` awaited — nicht run_at-abhängig.
- **Storage (M2):** WXT bietet `wxt/storage` (`storage.defineItem(...)`) als
  typisierten Wrapper über `browser.storage` — dem rohen `browser.storage.local`
  vorziehen.
- **UI (M2/M3):** WXT-Content-Script-UI-Helfer (`createShadowRootUi` /
  `createIntegratedUi` / `createIframeUi`) für On-Page-Panels nutzen —
  `createShadowRootUi` isoliert CSS von YouTube.

## Aufwand (grob)
- M1: ~½–1 Tag. M2–M4: mehrere Tage bis **Wochen** (v. a. UI + OAuth cross-browser
  + Parity-Ports). `[INFERENCE]`

## Entscheidungen (bestätigt)
- **Endziel: 100%-Ersatz der PHP-App** durch die Extension (beschlossen).
- **Panel-Rückbau: erledigt** (`web/` + Helfer entfernt — die Extension ist das Repo).
- **UI-Framework: Svelte 5** (entschieden, via `@wxt-dev/module-svelte`). Adder-Paging (>100) später.

## Status
- **M1 gebaut** (`extension/`): Extractor + 5 Unit-Tests grün; Chrome/Firefox-Builds
  grün; `injected.js` als web_accessible_resource.
- **M2 gebaut**: `utils/schema.ts` (pure Datenmodell + Normalisierung, 4 Unit-Tests)
  + `utils/store.ts` (`wxt/storage`: playlists/rules/adderMap/audit/jobs).
  Options-Page in **Svelte 5** (Playlists · Regel-Editor · Log · Overview) —
  mountet + interaktiv (Headless-Smoke). M1-Adder
  schreibt jetzt direkt in `store.adderMap` (kein Clipboard mehr); Permission auf
  nur `storage` reduziert. 9/9 Tests grün, Chrome+Firefox-Builds grün.
- **M3 (Kern) gebaut**: `utils/checks.ts` — pure Check-/Plan-Logik, 11 TS-Parity-Tests
  grün (Referenz `web/tests/run.php` weiterhin 42/42). `yt.ts`/Overview an **M4**
  gekoppelt, weil Data-API-Reads den OAuth-Token brauchen.
- **M4 (Kern) gebaut**: OAuth (`auth.ts` pure + `session.ts`, implicit + silent-renew),
  `utils/yt.ts` (Data-API-Client: reads/writes/owner-check/paging + Shaping),
  `utils/overview.ts` (pure Compose) + **Overview-Tab** (Svelte): Sign-in, alle Checks +
  Cap/Prune-Pläne, owner-gegatete Apply-Buttons mit Audit/Job-Log. 33/33 TS-Tests grün
  (yt/auth/overview pure), Chrome+Firefox-Builds grün, UI-Smoke ok.
- **M5 (Politur/Verteilung) gebaut**: lesbare API-Fehler + Quota-Hinweis (`ytApiMessage`,
  Test), Error-Jobs bei Apply-Fehlern, `wxt zip` → Chrome/Firefox-Store-ZIP +
  AMO-Sources-ZIP. 34/34 TS-Tests grün. Icons/i18n bewusst offen.
- **UX-Umbau (nach M5)**: Trigger raus aus dem Overview → **Ein-Klick-Wartungskette**
  über den **„Run maintenance"**-Button auf der Playlist-Seite. `content.ts` capturet
  Adder + stößt `background.ts` (Service-Worker) an, der **Checks → Cap → Prune →
  Shuffle** ausführt (Data-API) und Fortschritt per Port (`utils/messages.ts`) an den
  Button streamt (MV3: Content-Script darf nicht cross-origin fetchen / kein `identity`).
  **Overview-Tab → Login** (nur Google-Sign-in, keine Trigger); Tabs jetzt
  Playlists · Rules · Log · Login. „N adders" → distinct Contributor + „attributed".
  38/38 TS-Tests grün, svelte-check 0/0, beide Builds grün. Live-Kette = dein Test.
- **Offen (dein Schritt):** Google-Web-Client + Redirect-URIs anlegen, Live-Sign-in +
  echte Reads/Writes testen; Safari-Build (Mac).
