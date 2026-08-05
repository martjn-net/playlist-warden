# Kontext & Übergabe

Vollständiger Wissensstand für die nahtlose Fortsetzung in einer neuen Session.
**Zuerst lesen.** Reihenfolge der Wahrheit: dieser Stand → [extension-plan.md](extension-plan.md)
→ [../AGENTS.md](../AGENTS.md). (Das PHP-Panel `web/` und die Python-Helfer sind entfernt.)

---

## 0. Stand jetzt (in einem Satz)

Die **Browser-Extension „Playlist Warden for YouTube"** (`extension/`, WXT,
Chrome/Firefox/Safari; Untertitel „Fair caps, cleanup & shuffle for shared
playlists") ist als
100%-Ersatz der PHP-Web-App über **M1–M5 (Kern) fertig gebaut und tief refactored** —
alles was headless verifizierbar ist, ist grün. Es fehlt nur noch der **Live-Test
mit echtem Google-Login** (nur der User kann das). `web/` (PHP-Panel) und die
Python-Helfer sind **entfernt** — die Extension ist das Produkt.

### Letzte Session — Rebrand + Cutover (erledigt)
- Rebrand → **„Playlist Warden for YouTube"** (Manifest/UI/Doku).
- **`web/` (PHP-Panel) + Python-Helfer gelöscht**; Doku extension-only. Alles committet +
  gepusht als `1c2362b`.
- **Repo umbenannt** → `martjn-net/playlist-warden`. **Frischer Klon** liegt unter
  `/home/arens/git/playlist-warden` (= hier). Der alte Ordner
  `/home/arens/git/youtube-playlist-manager` kann weg (`rm -rf`).
- **Vor dem ersten Build im frischen Klon:** `cd extension && npm install`
  (`node_modules` ist git-ignoriert, also nicht im Klon enthalten).

## 1. Was gebaut ist — Meilensteine

Plan + Details: **[extension-plan.md](extension-plan.md)** (maßgeblich, enthält
Status + bestätigte Entscheidungen). Kurzfassung:

- **M1 — Adder-Capture:** Content-Script auf `youtube.com/playlist?list=…`, Button
  „Save adder map"; MAIN-World-Reader (`injected.ts` via `injectScript`) liest
  `ytInitialData`; schreibt `{videoId: avatarPhotoId}` direkt in den Store.
- **M2 — Storage + Regeln + UI:** `utils/schema.ts` (pures Modell/Normalisierung),
  `utils/store.ts` (`wxt/storage`: playlists/rules/adderMap/audit/jobs),
  Options-Page (Svelte 5). **Import/Export wurde auf Userwunsch wieder entfernt.**
- **M3 — Checks:** `utils/checks.ts` = verhaltensgleicher Port von
  `web/lib/checks.php` (dead/dupes/content + Duration-Parser, cap/shuffle/prune),
  **Parity-Test gegen dieselben Fälle wie `web/tests/run.php`**.
- **M4 — OAuth + Data-API:** `utils/auth.ts` (pure OAuth-Helfer) + `utils/session.ts`
  (`browser.identity.launchWebAuthFlow`, implicit + silent-renew), `utils/yt.ts`
  (Data-API-v3-Client token-only), `utils/overview.ts` (pure Compose der Checks+Pläne).
- **M5 — Politur + Verteilung:** lesbare API-Fehler + Quota-Hinweis (`ytApiMessage`),
  Error-Jobs bei Fehlern, `wxt zip` → Chrome/Firefox-Store-ZIP + AMO-Sources-ZIP.
- **Ein-Klick-Wartungskette (aktuelle Architektur, ersetzt den Overview-Trigger):**
  Der Button **„Run maintenance"** auf der Playlist-Seite (`content.ts`) capturet Adder
  → stößt den **Background-Service-Worker** (`background.ts`) an, der die Kette
  **Checks → Cap → Prune → Shuffle** ausführt (Data-API-Writes) und den Fortschritt
  per **Port** (`utils/messages.ts`) zurück an den Button streamt. Grund: MV3-Content-
  Scripts dürfen nicht cross-origin fetchen und haben kein `identity`. Owner-gegatet,
  jede Aktion ins Audit/Job-Log. **Confirm-Dialog** vor den Writes.
- **Options-Page = reine Verwaltung, KEINE Trigger:** Tabs **Playlists · Rules · Log ·
  Login**. „Overview" wurde zuerst Settings, jetzt **Login** (nur Sign-in/out;
  Client-ID eingebaut, kein Eingabefeld mehr).
- **Zähl-Fix:** „adders" (= Videos) war irreführend → zeigt jetzt **distinct
  Contributor** (+ „N videos attributed"). `adderMap` = Video→Avatar (Cap-Basis).

## 2. Deep-Refactor dieser Session (verhaltenserhaltend)

- **`svelte-check` eingeführt** (`npm run check`, dev-dep) → type-checkt die ganze
  Extension inkl. `.svelte`-Props. Baseline **0/0**. Dabei 7 latente Strictness-Bugs
  gefixt (u. a. `prunePlanRemovals`-keep, `planShuffle`-Swap, `updateJob`, explizite
  `browser`/`defineContentScript`/`injectScript`-Imports statt Auto-Import — svelte-check
  sah die Auto-Imports nicht). `tests/` ist per `tsconfig.exclude` aus dem Check raus.
- **`utils/coerce.ts`** neu: kanonische Coercions (`asString/asStringOrNull/asBool/
  asInt/asStringArray`), ersetzt die duplizierten Helfer in `schema.ts` (`toStr…` per
  Alias-Import) und `yt.ts` (`str…`). Single source, unit-getestet.
- **Options-Page entflochten:** aus dem ~630-Zeilen-`App.svelte` → schlanke **Shell**
  (`App.svelte`, Tab-Routing) + **4 Tab-Komponenten** (`OverviewTab`, `PlaylistsTab`,
  `RulesTab`, `LogTab`) mit getypten Props (`data`, `reload`,
  `flash`, `bind:selectedPid`). Die 4 gleichartigen Overview-Tabellen → ein `{#snippet}`.
- **Contributor→Name-Mapping entfernt** (Tab + Store-Tabelle `contributors` +
  Content-Script-Seeding): reines Zählen reicht. Overview zählt Contributor via
  Kanal-Spread (rawItems) + `attributed` = Größe der Adder-Map. `adderMap`
  (Video→Avatar-Foto-ID) bleibt als Cap-Basis. `audit.contributorAvatar` bleibt.

## 3. Verifikation (Kommandos + aktuelle Zahlen)

Im `extension/`:
- `npm test` → **38/38 grün** (node --test, pure Logik: coerce, adders, schema/store,
  checks-parity, yt, auth, overview).
- `npm run check` → **0 Errors / 0 Warnings** (svelte-check).
- `npm run build` + `npm run build:firefox` → grün (Chrome MV3, Firefox MV2).
- `npm run zip` / `npm run zip:firefox` → ZIPs in `.output/` (~38 kB).
- Parity-Tests decken die Check-/Plan-Logik ab (Referenz war die inzwischen entfernte PHP-Suite `web/tests/run.php`); die TS-Tests sind eigenständig.
- UI-Smoke (headless, static server auf `.output/chrome-mv3` + Browser): Options-Page
  mountet, Tabs **Playlists · Rules · Log · Login** rendern + schalten. **Kette
  (content→background), Live-OAuth/API + datenabhängige Inhalte brauchen die echte
  Extension-Runtime → nicht headless testbar.**

## 4. Nächste Schritte — DA MORGEN WEITERMACHEN

**A) Live-Verifikation (nur der User, nicht headless möglich):**
1. Google Cloud Console → am eingebauten **OAuth-Client** (Client-ID fest in
   `utils/session.ts`) die **Redirect-URI** `https://<extension-id>.chromiumapp.org/`
   eintragen (Extension-ID siehe `chrome://extensions`). Scope: `.../auth/youtube`;
   Testnutzer = das Login-Konto.
2. Extension laden (Chrome: entpackt aus `.output/chrome-mv3`; Firefox: `about:debugging`).
3. Sign-in kommt von allein: bei fehlendem Token öffnet „Run maintenance" direkt das
   Google-Fenster (alternativ Tab **Login**). „Google hat diese App nicht überprüft"
   einmal pro Konto durchklicken (Erweitert → öffnen) — danach merkt Google die
   Einwilligung und alles läuft still. Details/Entscheidung: [docs/oauth-verifizierung.md](oauth-verifizierung.md).
4. Als **Owner** auf eigener Playlist (z. B. `PLDdaIFxMU8v4`, Cap in Playlists setzen)
   den **„Run maintenance"**-Button klicken → Kette läuft, Button erzählt, Log füllt sich.
5. Safari-Build nur auf macOS (`npm run build:safari` → `xcrun safari-web-extension-converter`).

**B) Erledigt: PHP-`web/` + Python-Helfer entfernt.** Die Extension ist das Produkt;
README/AGENTS/TODO umgestellt. (Historisch war das an den Live-Test gegatet.)

**Danach offen (Plan):** Adder-Paging >100 (InnerTube-Continuation), Icons/Store-Assets
(binär → git-ignoriert, kein Repo-Commit), Listing-Assets.

## 5. Wichtige Entscheidungen / Abweichungen (nicht neu herleiten)

- **OAuth = impliziter Flow + silent renew**, NICHT PKCE+Refresh: ein öffentlicher
  Extension-Client kann das von Google am Token-Endpoint verlangte Secret nicht halten.
  `response_type=token`, Token ~1h in `wxt/storage`, bei Ablauf `launchWebAuthFlow({interactive:false})`.
  Cross-browser über `identity` (kein Chrome-only `getAuthToken`).
- **`injectScript` braucht manuell `web_accessible_resources`** (in `wxt.config.ts` gesetzt);
  `world:'MAIN'` wäre Chromium-only → daher injectScript (alle Browser, MV2+MV3).
- **UI-Framework: Svelte 5** via `@wxt-dev/module-svelte`.
- **Permissions minimal:** `storage`, `identity` + Hosts `*://www.youtube.com/*`,
  `https://www.googleapis.com/*`.
- Pure Logik (schema/checks/coerce/overview/yt-Helfer/auth-Helfer/adders) ist **ohne
  WXT-Abhängigkeit** → läuft unter `node --test`. Browsergebundenes (`store.ts`,
  `session.ts`) importiert `wxt/…` und ist NICHT node-getestet (svelte-check + Live).

## 6. Durable Fakten (Playlists, Auth, Konvention)

- **Kern-Einsicht (warum das Ganze):** Der „hinzugefügt von"-Contributor steht in
  **keinem Textfeld** (Data API liefert für `playlistItems.snippet.channelId` nur den
  Owner; kein InnerTube-Textfeld). Er ist NUR als **Avatar-Bild** pro Item da
  (`thumbnailOverlayAvatarStackViewModel`, aktuelle Client-Version nötig). Die
  ggpht-Foto-ID im Avatar-URL ist pro Konto stabil = Contributor-Schlüssel. Klarname
  nur für den Owner (Header-Byline `by <Owner> and N other(s)`). Deshalb macht das der
  Content-Script lokal, nicht der Server.
- **Kollaborativ-Schalten ist NICHT automatisierbar** (nur Web-UI; kein API-Feld, kein
  `youtubei`-Endpoint). Ohne „Collaborate" keine Adder-Avatare. Invite-Link:
  `playlist?list=…&jct=<token>`.
- **Test-Playlists:** `PLDdaIFxMU8v4` („Sportpark Styrum (Test)", unlisted, Kanal
  **Martjn**) ist **kollaborativ**, 2 Contributor × 2 Videos (Owner Martjn + Arbeits-Account
  Avatar `AIdro_lKfCix…`) → Adder-Attribution + Cap live verifizierbar. Öffentliche
  Referenz-Playlist: `PLTwMRo-WlCUs` („Sportpark Styrum").
- **Admin-/Test-Identitäten:** `***REMOVED***` (Arbeits-Account, Collaborator auf der
  Test-Playlist) und `***REMOVED***`. (Das PHP-Panel-OAuth ist mit `web/` entfernt;
  die Extension nutzt `browser.identity.launchWebAuthFlow` gegen einen eigenen Web-Client.)
- **Repo:** `martjn-net/playlist-warden` (privat; umbenannt von `youtube-playlist-manager`),
  lokal `/home/arens/git/playlist-warden`, Branch `master`. `gh` als `martjn-net` auth.
- **Sprachkonvention:** AI-Chat Deutsch; App-/Skript-Ausgaben Englisch; Doku Deutsch;
  Code + Kommentare Englisch. **Keine Bilder im Repo** (git-ignoriert). Keine Stubs.

## 7. Repo-Struktur (Kurz)

- `extension/` — **das Produkt.** `utils/` (pure Logik + Bindings), `entrypoints/`
  (content, injected, popup, options/ mit Shell + Tab-Komponenten), `tests/` (node --test).
  Verifikation: `npm test` + `npm run check` + `npm run build`. Doku: `extension/README.md`.

## 8. Historie (Anfangsphase, teilweise überholt)

Ursprung: Frage des Users „Hat jedes Playlist-Mitglied genau 2 Songs beigetragen?" →
reine Python-CLI-Sammlung → PHP-Web-Panel (`web/`) → jetzt Browser-Extension. Die
detaillierte Herleitung des Avatar-Ansatzes, der API-Diskrepanz und der verworfenen
Wege (ausgeloggtes DOM, Data-API-`channelId`, Studio-Endpoints, Puppeteer-Profil) ist
in AGENTS.md „Kernwissen" verdichtet. Frühere
Fassungen dieses Dokuments trugen die Langfassung; sie ist mit dem obigen Kernwissen
(§6) abgedeckt.
