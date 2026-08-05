# Playlist Warden for YouTube — Browser-Extension (WXT)

> **Fair caps, cleanup & shuffle for shared playlists.**
> Für kollaborative YouTube-Playlists: Limit *N Songs pro Person* durchsetzen, tote
> Links/Duplikate/Off-Genre nach eigenen Regeln entfernen und mischen — ein Klick
> direkt auf der Playlist-Seite. Writes über deinen Google-Login, nur auf eigenen
> Playlists; alles bleibt lokal im Browser-Profil.

Cross-Browser-WebExtension (Chrome/Firefox/Safari, ein Codebase via **WXT**). Ziel
ist der schrittweise **100%-Ersatz** der PHP-Web-App (`../web/`). Aktueller Stand:
**Meilenstein 5 — Ein-Klick-Wartungskette + Verteilung**. Gesamtplan: [`../docs/extension-plan.md`](../docs/extension-plan.md).

## Was es kann (M1–M5)
Auf einer eingeloggten YouTube-Playlist-Seite (`youtube.com/playlist?list=…`)
erscheint **unten rechts** eine schwebende rote **„Run maintenance"**-Pill (in
`document.body` — Einbetten in YouTubes Action-Zeile scheitert, deren Renderer
entfernt Fremdknoten; ein `MutationObserver` hält die Pill stabil und setzt sie bei
SPA-Navigation sofort neu). Ein Klick startet die
**komplette Wartungs-Kette in einem Rutsch** und der Button erzählt, wo er steht:

1. **Adder capturen** — liest den *added-by*-Avatar je Video aus `ytInitialData`
   (nur die eingeloggte Seite gibt das her) und schreibt `{videoId: avatarPhotoId}`
   in den Store.
2. **Checks** — Dead-Links, Duplikate, Content-Regeln, Contributor-Zählung.
3. **Cap** — löscht Überschuss über dem Cap je Contributor (ältester zuerst).
4. **Prune** — löscht Duplikate + Regel-Verstöße.
5. **Shuffle** — ordnet die verbliebenen Einträge neu (wenn aktiviert).

Schritte 2–5 laufen im **Background-Service-Worker** (MV3: Content-Scripts dürfen
nicht cross-origin an die Data API und haben kein `identity`); der Fortschritt wird
per Port an den Button gestreamt. Jede Löschung/Reorder wird ins **Log** geschrieben.
Voraussetzung: Owner der Playlist + eingeloggt (siehe Tab **Login**).

Die **Options-Page** (Icon → „Open options") ist reine Verwaltung — **keine Trigger**:
**Playlists** (Cap/Shuffle je Playlist), **Rules** (Content-Regeln), **Log**
(Audit + Jobs) und **Login** (Google-Sign-in; Client-ID ist eingebaut). Alles bleibt lokal.

## Aufbau
- `utils/adders.ts` — reine Adder-Extraktion (Port aus `../check_playlist_web.py`), unit-getestet.
- `utils/schema.ts` — pures Datenmodell + Normalisierung (Regeln/Playlists), unit-getestet.
- `utils/store.ts` — Persistenz über `wxt/storage` (playlists/rules/adderMap/audit/jobs).
- `utils/guards.ts` — kanonischer `isRecord`-Guard; `utils/coerce.ts` — kanonische Coercions (`unknown` → typed).
- `utils/checks.ts` — pure Check-/Plan-Logik (Port aus `web/lib/checks.php`), parity-getestet.
- `utils/overview.ts` — pure Compose aller Checks + Cap/Prune-Pläne (Port aus `overview.php`).
- `utils/yt.ts` — Data-API-v3-Client (token-only): reads/writes/owner-check/paging + Shaping.
- `utils/auth.ts` — pure OAuth-Helfer; `utils/session.ts` — `identity`-Flow + Token in `wxt/storage`.
- `utils/messages.ts` — Port-Protokoll content ↔ background.
- `entrypoints/injected.ts` — MAIN-World-Reader (`ytInitialData`), via `injectScript`.
- `entrypoints/content.ts` — Content-Script: „Run maintenance"-Button, capturet + treibt die Kette, erzählt Fortschritt.
- `entrypoints/background.ts` — Service-Worker: führt die Kette aus (Data-API-Writes), streamt Fortschritt per Port.
- `entrypoints/options/` — Options-Page (Svelte 5): `App.svelte` (Shell/Tab-Routing) + je Tab
  eine Komponente (`PlaylistsTab`, `RulesTab`, `LogTab`, `LoginTab`).
- `entrypoints/popup/` — Kurzanleitung + „Open options".

Permissions: `*://www.youtube.com/*` (Adder-Read) + `https://www.googleapis.com/*`
(Data API) + `storage` (Store/Token) + `identity` (OAuth).

**Setup fürs Live-Testen:** am eingebauten **OAuth-Client** (Google Cloud Console →
Credentials) die **Redirect-URI** `https://<extension-id>.chromiumapp.org/` als
*Authorized redirect URI* eintragen; Extension-ID siehe `chrome://extensions`. Die
Client-ID ist fest in `utils/session.ts` verdrahtet (kein Secret — im impliziten Flow
nicht nötig/möglich). Sign-in öffnet der „Run maintenance"-Button bei Bedarf direkt
(oder Tab **Login**); den Screen „Google hat diese App nicht überprüft" einmal pro
Konto durchklicken (Erweitert → öffnen), danach laeuft alles still. **Hinweis:** die
Redirect-URI haengt an der Extension-ID — bei Neuinstallation/neuem Ladepfad aendert
sie sich und muss erneut im Client registriert werden.

## Testbuilds (GitHub Releases)

Fertige Zips zum manuellen Installieren: [github.com/martjn-net/playlist-warden/releases](https://github.com/martjn-net/playlist-warden/releases)
→ Zip laden + entpacken → `chrome://extensions` → Developer mode → „Load unpacked".
Die Extension-ID ist per **Public-Key gepinnt** (`wxt.config.ts`,
`lmecidnfiiphbljfiphaejhnbkmnjkdi`) — jeder Tester bekommt dieselbe ID und damit
dieselbe OAuth-Redirect-URI; der private `.pem`-Schluessel ist gitignoriert.
Neuer Build: `npm test && npm run check && npm run build && npm run zip`, dann
`gh release create v<X.Y.Z> .output/playlist-warden-<X.Y.Z>-chrome.zip`.
**Achtung Testuser:** solange der Consent Screen im Testing-Modus ist, koennen sich
nur eingetragene Testnutzer einloggen (Limitierung Googles, nicht der Extension);
fremde Tester werden sonst mit „Zugriff blockiert" abgelehnt.

## Entwicklung
```bash
npm install            # installiert WXT + führt `wxt prepare` aus
npm test               # pure Unit-/Parity-Tests (node --test): coerce, adders, schema/store, checks, yt, auth, overview
npm run check          # svelte-check: Typen + Component-Props (Options-Page)
npm run dev            # Chrome-Dev (lädt die Extension automatisch)
npm run dev:firefox    # Firefox-Dev
npm run build          # Chrome-Build -> .output/chrome-mv3
npm run build:firefox  # Firefox-Build -> .output/firefox-mv2|mv3
npm run zip            # Chrome-Store-ZIP -> .output/*-chrome.zip
npm run zip:firefox    # Firefox-ZIP + AMO-Sources-ZIP -> .output/*-firefox.zip, *-sources.zip
```

## Laden zum Testen
- **Chrome:** `chrome://extensions` → Entwicklermodus → „Entpackte Erweiterung laden" → `.output/chrome-mv3`.
- **Firefox:** `about:debugging` → „Dieses Firefox" → „Temporäres Add-on laden" → `.output/firefox-*/manifest.json` (oder `web-ext run`).
- **Safari:** Build/Signing braucht **macOS + Xcode**
  (`npm run build:safari`, dann `xcrun safari-web-extension-converter .output/safari-*`) —
  auf Linux nicht möglich.

## Verteilung
- **Firefox:** self-signed **unlisted** (`web-ext sign` / AMO-API) → ohne öffentliche Review.
- **Chrome:** „unpacked" (dev) bzw. Web-Store **unlisted**.
- **Safari:** über Xcode.
