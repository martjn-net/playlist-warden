# TODO

## Offen

### Live-Verifikation (dein Schritt — nicht headless möglich)
- [ ] **Safari-Build** auf macOS (`npm run build:safari` → `xcrun safari-web-extension-converter`).
  (Erledigt: Live-Kette getestet ✓, Redirect-URI der gepinnten ID registriert ✓)

### Publikation (Roadmap: docs/oauth-verifizierung.md)
- [ ] martjn.net-Produktseite + Privacy **live deployen** (Cutover vom SQL-Terminal).
- [ ] Search-Console-Verifizierung der Domain.
- [ ] OAuth: App **veröffentlichen** (Testing → Production), Branding + Verification
  Center: Scope-Begruendung + Demo-Video → Submit → ~10 Tage Review.
- [ ] CWS: Developer-Account (5 $), Listing (Assets liegen in `store-assets/`:
  Icons, Promo-Tiles 440×280/1400×560, Screenshots 1280×800), Rechte-Begruendungen.
- [ ] AMO/Firefox: erst Redirect-URI-Problem lösen (beim Firefox-Build prüfen,
  `playlist-warden@martjn.net`-Gecko-ID), dann `web-ext sign`.

### Extension — offen
*(aktuell nichts — siehe Publikation/Live oben)*

## Erledigt
- **M1–M5 (Kern):** Adder-Capture; Store + Regel-Editor + UI (Svelte 5); Checks-Port
  (parity-getestet); Google-OAuth + Data-API-Reads/Writes; Politur + `wxt zip`-Packaging.
- **Ein-Klick-Wartungskette** (Content-Script → Background-Service-Worker, Port-Narration,
  Reload). Contributor-Namens-Mapping entfernt (reine Zählung). Deep-Refactor:
  `utils/coerce.ts`, Options-Page in Tab-Komponenten aufgeteilt, `svelte-check` eingeführt.
- **Rebranding → „Playlist Warden for YouTube"** (Manifest/UI/Doku).
- **PHP `web/` + Python-Helfer entfernt** — die Extension ist das Produkt.
- **OAuth final als Übergangszustand:** Client-ID fest verdrahtet (`session.ts`),
  manuelles Eintragen entfernt; fehlender Login öffnet direkt das Google-Fenster
  (kein Anleitungstext); Tab **Login** (Settings entfallen).
- **Icons + Store-Assets:** Generator (Pillow), Icon-Set im Manifest+Zip (CWS-Spec
  96-in-128), Promo-Tiles, Screenshots 1280×800.
- **Öffentlichkeit:** Repo public (Historie vorher auf Secrets/Firmen-Adressen
  gescannt), **GitHub Release v0.1.0** mit Chrome-Testbuild, Extension-ID per
  Public-Key gepinnt, Release-Rezept + Hygiene-Regeln in AGENTS.md.
- **Auto-Pilot:** geplante Wartung via `chrome.alarms` (stündlicher Tick) —
  Notification, wenn die letzte Wartung einer Liste älter ist als deren
  einstellbares Intervall (`autoIntervalDays`, pro Playlist, 0=aus); Buttons
  „Run maintenance" (headless-Lauf im Hintergrund) / „Open playlist";
  Re-Alert-Dedupe pro Intervall; Titel-Fetch beim Add (`yt.playlistMeta`).
- **Adder-Paging >100:** InnerTube-Continuation im Injected-Script (gleicher
  INNERENDPOINT wie die Seite, mit Page-Cookies; bis 50 Seiten ≈ 5k Items,
  Safety-Cap + `truncated`-Flag, Dedupe via Map-Merge). Cap attribuiert jetzt
  große Playlists vollständig. `createPlaylist`-Deadcode aus `yt.ts` entfernt.
