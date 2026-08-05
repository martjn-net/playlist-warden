# TODO

## Offen

### Live-Verifikation (dein Schritt — nicht headless möglich)
- [ ] Google Cloud Console: **OAuth-Client „Web application"** anlegen; die im
  **Settings-Tab** gezeigte Redirect-URI (`https://<ext-id>.chromiumapp.org/`) als
  *Authorized redirect URI* eintragen; Client-ID im Settings-Tab speichern; „Sign in".
- [ ] Als **Owner** auf eigener Playlist die **„Run maintenance"**-Kette live testen
  (Checks → Cap → Prune → Shuffle), Log/Audit prüfen.
- [ ] **Safari-Build** auf macOS (`npm run build:safari` → `xcrun safari-web-extension-converter`).

### Extension — offen
- [ ] **Adder-Paging >100**: `utils/adders.ts` liest nur die vom Seiten-Payload
  gerenderten Einträge (~erste 100). InnerTube-Continuation nachziehen, damit Cap auch
  auf großen Playlists vollständig attribuiert.
- [ ] **Toter Code:** `createPlaylist` in `utils/yt.ts` wird nicht genutzt → entfernen
  (oder ein „Playlist anlegen"-Feature bauen).
- [ ] **Icons + Store-Assets** (git-ignoriert; Binärdateien bereitstellen).
- [ ] **Verteilung/Listing:** Firefox self-signed **unlisted** (`web-ext sign`); Chrome
  unlisted/Web-Store; Safari via Xcode. Store-Beschreibungstext liegt in `extension/README.md`.

## Erledigt
- **M1–M5 (Kern):** Adder-Capture; Store + Regel-Editor + UI (Svelte 5); Checks-Port
  (parity-getestet); Google-OAuth + Data-API-Reads/Writes; Politur + `wxt zip`-Packaging.
- **Ein-Klick-Wartungskette** (Content-Script → Background-Service-Worker, Port-Narration,
  Reload). **Overview → Settings** (nur Sign-in, keine Trigger). Contributor-Namens-Mapping
  entfernt (reine Zählung). Deep-Refactor: `utils/coerce.ts`, Options-Page in Tab-Komponenten
  aufgeteilt, `svelte-check` eingeführt.
- **Rebranding → „Playlist Warden for YouTube"** (Manifest/UI/Doku).
- **PHP `web/` + Python-Helfer entfernt** — die Extension ist das Produkt.
