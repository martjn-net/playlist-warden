# TODO

## Offen

### Contributor-Check
- [ ] `check_playlist.py` gegen die reale Playlist `PLTwMRo-WlCUs` mit echtem API-Key testen und feststellen, ob `channelId` pro Contributor variiert oder nur den Owner liefert.
- [ ] **Fallback-Userscript** (Tampermonkey/Greasemonkey): liest auf der eingeloggten Playlist-Seite pro Video das "hinzugefuegt von"-Element aus dem DOM, zaehlt pro Person und blendet "Person -> Anzahl (Soll: N)" ein. Noetig, falls der API-Weg nur den Owner hergibt (Exit-Code 2).

### Weitere geplante Kommandos (Manager)
- [ ] **Export**: Playlist als CSV/JSON ausgeben (Titel, Video-ID, Kanal, Hinzufuegedatum, Position).
- [ ] **Diff**: zwei Snapshots einer Playlist vergleichen (hinzugefuegt/entfernt/verschoben).
- [ ] **Dedupe**: doppelte Videos in einer Playlist finden (und optional entfernen -> OAuth).
- [ ] **Dead-Link-Check**: nicht mehr verfuegbare/private Videos in einer Playlist melden.

### Infrastruktur
- [ ] OAuth-Variante fuer private/ungelistete Playlists und Schreib-Kommandos (Dedupe etc.).
- [ ] Gemeinsame Helfer (API-Paginierung, Key-Handling) in ein Modul ziehen, sobald ein zweites Kommando existiert.
- [ ] Optionaler `--json`-Output fuer maschinelle Weiterverarbeitung.

## Erledigt

- [x] Repo-Grundgeruest (README, AGENTS.md, CLAUDE.md-Symlink, TODO.md).
- [x] Projekt als Playlist-Manager ausgerichtet (Kommando-Struktur).
- [x] Kommando **Contributor-Check** (`check_playlist.py`): paginiertes Auslesen der Playlist-Items, Zaehlung pro `channelId`, Selbstdiagnose fuer den Owner-only-Fall.
