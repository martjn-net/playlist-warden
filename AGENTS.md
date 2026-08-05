# Playlist Warden for YouTube

Anweisungen fuer LLM-Agenten, die an diesem Repo arbeiten.

## Zweck

**Das Produkt ist die Browser-Extension unter `extension/`** (WXT, Chrome/Firefox/Safari,
ein Codebase). Sie haelt **kollaborative YouTube-Playlists** fair und sauber: Cap pro
Contributor, Prune (Dead-Links/Duplikate/Content-Regeln), Shuffle — als Ein-Klick-Kette
auf der Playlist-Seite. Untertitel: „Fair caps, cleanup & shuffle for shared playlists".

Historie: Das Repo begann als CLI-Sammlung, wurde dann ein PHP-Web-Panel (`web/`) + lokale
Python-Helfer. Beides ist **entfernt** — die Extension hat alles uebernommen (Check-/
Plan-Logik in `utils/checks.ts`, Data-API in `utils/yt.ts`, Adder-Read nativ im
Content-Script). Siehe [README.md](README.md), [docs/extension-plan.md](docs/extension-plan.md),
[docs/kontext.md](docs/kontext.md).

## Struktur

```
extension/
  utils/coerce.ts         Kanonische Coercions (unknown -> typed), unit-getestet
  utils/schema.ts         Pures Datenmodell + Normalisierung (Regeln/Playlists), unit-getestet
  utils/store.ts          Persistenz ueber wxt/storage (playlists/rules/adderMap/audit/jobs)
  utils/checks.ts         Pure Check-/Plan-Logik (dead/dupes/content/cap/shuffle/prune), parity-getestet
  utils/overview.ts       Pure Compose: alle Checks + Cap/Prune-Plaene
  utils/yt.ts             Data-API-v3-Client (token-only): reads/writes/owner-check/paging + Shaping
  utils/auth.ts           Pure OAuth-Helfer (Auth-URL, Token-Parse, Expiry)
  utils/session.ts        Sign-in-Binding (identity.launchWebAuthFlow, Token in wxt/storage)
  utils/adders.ts         Adder-Extraktion aus ytInitialData (Avatar-Overlay), unit-getestet
  utils/guards.ts         Kanonischer isRecord-Guard
  utils/messages.ts       Port-Protokoll content <-> background
  entrypoints/background.ts  Service-Worker: Wartungs-Kette (checks->cap->prune->shuffle), Data-API-Writes
  entrypoints/content.ts     Playlist-Seite: "Run maintenance"-Button, capture + Kette anstossen + Narration
  entrypoints/injected.ts    MAIN-World-Reader (ytInitialData)
  entrypoints/popup/         Kurzanleitung + "Open options"
  entrypoints/options/       Options-Page (Svelte 5): App.svelte (Shell) + Tabs Playlists/Rules/Log/Login
  public/icons/              Manifest-Icons (Generator: store-assets/generate-store-assets.py)
  tests/                     node --test (coerce, adders, schema/store, checks-parity, yt/auth/overview)
store-assets/                Icon-/Tile-Generator (Pillow), Promo-Tiles, Screenshots
docs/extension-plan.md     Plan/Architektur/Meilensteine M1–M5
docs/kontext.md            Kontext-/Uebergabestand (bei Sessionwechsel zuerst lesen)
docs/oauth-verifizierung.md OAuth-„nicht überprüft"-Screen: Optionen A–D, Entscheidung (Personal use)
README.md, AGENTS.md, CLAUDE.md(Symlink->AGENTS.md)
```

## Tests / Verifikation (im `extension/`)

- `npm test` — pure Unit-/Parity-Tests (`node --test`). Neue/geaenderte pure Logik dort abdecken.
- `npm run check` — `svelte-check` (Typen + Component-Props); muss 0 Errors sein.
- `npm run build` + `npm run build:firefox` — beide muessen gruen sein.
- Live-Laeufe (Google-OAuth + echte Reads/Writes, Safari-Build) sind der **User-Schritt**.

## Release erstellen (öffentliche Testbuilds via GitHub Releases)

1. In `extension/package.json` die **Version bumpen** (Zip heisst dann
   `playlist-warden-extension-<V>-chrome.zip`).
2. Alles gruen: `npm test && npm run check && npm run build && npm run zip`.
3. `gh release create v<V> extension/.output/playlist-warden-extension-<V>-chrome.zip \
   --repo martjn-net/playlist-warden --title "Playlist Warden for YouTube v<V>" \
   --notes-file <notizen.md>` (Asset austauschen: `gh release delete-asset` +
   `gh release upload`).
4. Die Extension-ID ist per Public-Key **gepinnt** (`wxt.config.ts`), Tester bekommen
   alle dieselbe ID/Redirect-URI. Der private Schluessel `extension/.chrome-key.pem`
   (gitignoriert, kuenftige Store-Signatur) darf **niemals** committet werden.
5. Consent Screen im Testing-Modus → Fremde muessen als **Testnutzer** eingetragen
   werden, sonst „Zugriff blockiert".

## Konventionen

- **Sprache:** AI-Chat Deutsch; App-/UI-Ausgaben Englisch; Doku Deutsch; Code + Kommentare Englisch.
- **Reine Logik** (schema/checks/coerce/overview/adders + yt/auth-Helfer) **ohne WXT-Abhaengigkeit**
  halten → laeuft unter `node --test`. Browsergebundenes (`store.ts`, `session.ts`, entrypoints)
  importiert `wxt/…` und ist nicht node-getestet (svelte-check + Live).
- **Coercions/Guards** aus `utils/coerce.ts` + `utils/guards.ts` nutzen — keine per-call-site-Dubletten.
- **Secrets** nie committen (kein Client-Secret; die Client-ID ist kein Secret). Kein `token.json`.
- **Commit-Identitaet:** immer `mail@martjn.net` (repo-lokal via `git config user.email`).
- **Keine Arbeits-/Firmen-Adressen** (z. B. sipgate) irgendwo im Repo — auch nicht in Historie/Commits.
- **Icons/Store-Assets gehoeren INS Repo:** `store-assets/generate-store-assets.py`
  (Pillow, reproduzierbar) schreibt `extension/public/icons/` (Manifest-Icons) +
  `store-assets/` (Promo-Tiles, Screenshots). CWS-Spec: Icon-Artwork 96×96 auf
  128×128-Canvas (16px Padding), Promo small 440×280 (Pflicht) + marquee 1400×560,
  Screenshots 1280×800, mind. 1. **Keine Stubs** — nur echtes, laufendes Zeug.

## Kernwissen (nicht neu herleiten)

- **API-Diskrepanz:** `playlistItems.snippet.channelId` ist als „user that added the item"
  dokumentiert, liefert praktisch aber den **Playlist-Owner**. Der echte „hinzugefuegt von"
  steht in **keinem Textfeld** (weder Data API noch InnerTube).
- **Adder nur als Avatar:** Wer einen Eintrag hinzugefuegt hat, erscheint nur als **Avatar-Bild**
  pro Item (`thumbnailOverlayAvatarStackViewModel` in `ytInitialData`). Die ggpht-Foto-ID ist
  pro Konto stabil = Contributor-Schluessel; ein Klarname ist nicht in den Daten. Deshalb liest
  das der Content-Script nativ auf der eingeloggten Seite (`utils/adders.ts` + `injected.ts`).
- **Kollaborativ noetig:** Adder-Avatare gibt es nur bei kollaborativen Playlists; Umschalten
  geht nur in YouTubes Web-UI (kein API-/InnerTube-Weg).
- **OAuth = impliziter Flow + silent renew** (nicht PKCE+Refresh): ein oeffentlicher
  Extension-Client kann kein Secret halten. `identity.launchWebAuthFlow`, Redirect =
  `identity.getRedirectURL()` (`https://<ext-id>.chromiumapp.org/`), Token in `wxt/storage`.
- **MV3-Grenzen:** Content-Scripts duerfen nicht cross-origin an die Data API fetchen und haben
  kein `identity` → Writes/Reads der Kette laufen im **Background-Service-Worker**; Fortschritt
  per Port an den Button. Writes **nur auf eigenen** Playlists (Owner-Check `channels.list mine`).
- **Button-Platzierung:** YouTubes Renderer entfernt in seine Action-Zeile injizierte
  Fremdknoten → der Button haengt via MutationObserver stabil unter der Zeile (Floating-Fallback).
