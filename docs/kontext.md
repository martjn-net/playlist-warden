# Kontext & Uebergabe

Vollstaendiger Wissensstand fuer die nahtlose Fortsetzung in einer neuen Session.
Stand: 2026-08-03.

## 1. Worum geht es

Ausgangsfrage des Users: **"Wie kann ich ueberpruefen, dass jedes Playlist-Mitglied genau zwei Songs zu einer YouTube-Playlist hinzugefuegt hat?"**

Daraus wurde dieses Repo: ein **YouTube Playlist Manager** (Sammlung kleiner CLI-Tools). Erstes und einziges bisher implementiertes Kommando ist der **Contributor-Check** (`check_playlist.py`), der genau diese Frage beantworten soll.

(Randnotiz Vorgeschichte, nicht projektrelevant: Die Session begann mit einer Diskussion ueber ritualdissent.com — ein Feedback-Tool fuer Claude-Code-Nutzer. Ohne Bezug zum Projekt.)

## 2. Die konkrete Playlist

- **URL:** https://www.youtube.com/playlist?list=PLTwMRo-WlCUs
- **Playlist-ID:** `PLTwMRo-WlCUs` (ungewoehnlich kurz, aber gueltig)
- **Titel:** "Sportpark Styrum"
- **Sichtbarkeit:** oeffentlich (laedt ausgeloggt nach Consent-Wall)
- **Stats (ausgeloggt gesehen):** 4 Videos, "Keine Aufrufe", "Heute aktualisiert"
- **Owner:** ausgeloggt nicht sichtbar

**Die 4 Videos (Titel ~ Uploader-Kanal):**
1. Touch Me (Extended Version) ~ Playmen Music
2. Won't Forget You ~ SHOUSE
3. The Glitch Mob - We Can Make The World Stop (Official Video) ~ The Glitch Mob
4. The Crystal Method - Play For Real (Dirtyphonics Remix) (Official Video) ~ UKF Drum & Bass

## 3. Das technische Kernproblem (bereits untersucht)

Ziel ist die **"hinzugefuegt von"-Information** pro Video. Dazu drei untersuchte Wege:

### a) Ausgeloggt / Browser-DOM (`ytInitialData`) — GEPRUEFT, negativ
Playlist im Headless-Browser geladen (Consent per Cookie `SOCS=CAI` / `CONSENT=YES+cb` umgangen), `ytInitialData` aus dem HTML geparst. Pro Item (`playlistVideoRenderer`) sind folgende Felder da:
`videoId, thumbnail, title, index, shortBylineText, lengthText, navigationEndpoint, setVideoId, lengthSeconds, trackingParams, isPlayable, menu, thumbnailOverlays, videoInfo`
- `shortBylineText` = **Uploader-Kanal** des Videos (nicht wer es hinzugefuegt hat)
- `videoInfo` = Aufrufe + Alter (z. B. "2,7 Mio. Aufrufe • vor 2 Jahren")
- **Kein "added by"-Feld.** Ausgeloggt nicht ermittelbar.

### b) YouTube Data API v3 (`playlistItems.list`) — Doku vs. Realitaet
Offizielle Doku (geprueft, Stand 2026-06-01, https://developers.google.com/youtube/v3/docs/playlistItems):
- `snippet.channelId` = *"The ID that YouTube uses to uniquely identify **the user that added the item to the playlist**."*  <- klingt exakt nach dem, was wir brauchen
- `snippet.channelTitle` = "channel that the playlist item belongs to"

**ABER bekannte Diskrepanz:** In der Praxis liefert `playlistItems` fuer `channelId` haeufig den **Playlist-Owner** — fuer jeden Eintrag denselben Wert, nicht den einzelnen Beitragenden. Beleg: https://stackoverflow.com/questions/53373429/ ("a call to PlaylistItems returns the channel ID of the playlist owner").

=> **Ob der API-Weg fuer DIESE Playlist taugt, ist ungeklaert und muss empirisch getestet werden.** Genau das macht `check_playlist.py`: variieren die `channelId`s -> API-Weg funktioniert; ist alles derselbe Owner -> Exit-Code 2, API-Weg unmoeglich.

### c) Eingeloggtes DOM — der garantierte Fallback (noch nicht gebaut)
Als Owner/Teilnehmer eingeloggt zeigt die YouTube-UI pro Video den Avatar/Namen des Hinzufuegenden. Ein Tampermonkey/Greasemonkey-Userscript kann diese Namen aus dem DOM lesen und zaehlen. Geplant, siehe TODO. Braucht Login im Browser.

## 4. Getroffene Architektur-Entscheidungen

- **Einmal-Lauf statt 24/7:** Die Verifikation ist eine punktuelle Abfrage. Ein Dauerprozess lohnt nur fuer kontinuierliches Monitoring/Enforcement (dann Watch-Modus, siehe TODO) — nicht fuer die eigentliche Frage.
- **API-Key statt OAuth:** Fuer eine *oeffentliche* Playlist reicht ein simpler API-Key. OAuth erst noetig fuer private/ungelistete Playlists oder Schreib-Kommandos.
- **Keine Dependencies:** Nur Python-Standardbibliothek.
- **Manager-Struktur:** ein fokussiertes Skript pro Aufgabe; geplante Kommandos als TODO, keine leeren Stubs.

## 5. Stand des Repos

- **GitHub:** martjn-net/youtube-playlist-manager (Account `martjn-net`, **privat**)
- **Lokal:** `/home/arens/git/youtube-playlist-manager`
- **Branch:** `master`
- **Umbenennung:** war zuerst `youtube-playlist-contributor-check`, dann zu `youtube-playlist-manager` umgezogen.

Dateien:
- `check_playlist.py` — Kommando Contributor-Check (implementiert, siehe unten)
- `README.md`, `AGENTS.md`, `TODO.md`, `CLAUDE.md`(Symlink->AGENTS.md), `.gitignore`
- `docs/kontext.md` — dieses Dokument

### `check_playlist.py` — was es tut
Paginiert `playlistItems.list?part=snippet` (50/Seite), zaehlt pro `(channelId, channelTitle)`, gibt Tabelle "Contributor -> Anzahl" mit OK/MISMATCH gegen `--expected` (Default 2).
Selbstdiagnose: nur eine `channelId` => Owner-only-Fall gemeldet, Exit 2.
Aufruf: `export YT_API_KEY=...; ./check_playlist.py PLTwMRo-WlCUs --expected 2`
Exit-Codes: 0 = alle treffen Soll, 1 = Abweichung, 2 = keine Contributor-Info (nur Owner), 3 = HTTP-Fehler.

### Verifikationsstand
- Smoke-Test bestanden: Syntax-Parse OK, `--help` OK, fehlender Key wird sauber abgefangen (Exit 2 aus argparse).
- **NOCH NICHT gegen die echte API getestet** — es lag kein API-Key vor. Das ist der erste offene Task.

## 6. Naechste Schritte (morgen)

Prioritaet 1 — **empirischer API-Test:**
1. User besorgt YouTube Data API v3 Key (Google Cloud Console -> API aktivieren -> Key).
2. `export YT_API_KEY=...; ./check_playlist.py PLTwMRo-WlCUs --expected 2` laufen lassen.
3. Auswerten:
   - Exit 0/1 (mehrere channelIds) => API-Weg funktioniert, Frage direkt beantwortet.
   - Exit 2 (nur Owner) => Fallback-Userscript bauen (Prioritaet 2).

Prioritaet 2 (falls noetig) — **Fallback-Userscript** (siehe TODO): eingeloggte Playlist-Seite, pro Zeile "hinzugefuegt von" aus dem DOM lesen, pro Person zaehlen, "Person -> Anzahl (Soll: N)" einblenden.

Weitere Manager-Kommandos: Export (CSV/JSON), Diff, Dedupe, Dead-Link-Check — alle in `TODO.md`.

## 7. Nuetzliche Fakten fuer die Fortsetzung

- gh ist authentifiziert als `martjn-net` (Scopes u. a. `repo`, `delete_repo`, `workflow`).
- Consent-Wall im Headless-Browser umgehbar per Cookies `SOCS=CAI` und `CONSENT=YES+cb` auf `.youtube.com`, dann `page.goto(...)`. `ytInitialData` steht im HTML als `var ytInitialData = {...};</script>` (nicht als window-Global im isolierten evaluate-Kontext -> aus `page.content()` per Regex parsen).
- API-Endpoint: `https://www.googleapis.com/youtube/v3/playlistItems?part=snippet&playlistId=...&maxResults=50&pageToken=...&key=...`
