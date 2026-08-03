# TODO

## Offen

- [ ] `check_playlist.py` gegen die reale Playlist `PLTwMRo-WlCUs` mit echtem API-Key testen und feststellen, ob `channelId` pro Contributor variiert oder nur den Owner liefert.
- [ ] **Fallback-Userscript** (Tampermonkey/Greasemonkey): liest auf der eingeloggten Playlist-Seite pro Video das "hinzugefuegt von"-Element aus dem DOM, zaehlt pro Person und blendet "Person -> Anzahl (Soll: N)" ein. Noetig, falls der API-Weg nur den Owner hergibt (Exit-Code 2).
- [ ] OAuth-Variante ergaenzen, falls private/ungelistete Playlists geprueft werden muessen.
- [ ] Optionaler `--json`-Output fuer maschinelle Weiterverarbeitung.
- [ ] Optionaler Watch-Modus (nur falls kontinuierliches Monitoring/Enforcement wirklich gebraucht wird).

## Erledigt

- [x] Repo-Grundgeruest (README, AGENTS.md, CLAUDE.md-Symlink, TODO.md).
- [x] `check_playlist.py`: paginiertes Auslesen der Playlist-Items, Zaehlung pro `channelId`, Selbstdiagnose fuer den Owner-only-Fall.
