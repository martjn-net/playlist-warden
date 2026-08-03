# youtube-playlist-contributor-check

Anweisungen fuer LLM-Agenten, die an diesem Repo arbeiten.

## Zweck

Prueft, wie viele Videos jedes Mitglied zu einer (kollaborativen) YouTube-Playlist beigetragen hat. Siehe [README.md](README.md) fuer Hintergrund und Nutzung.

## Struktur

```
check_playlist.py   CLI: zaehlt Beitraege pro Contributor via YouTube Data API v3
README.md           Zweck, Voraussetzungen, Nutzung
TODO.md             Offene Aufgaben
AGENTS.md           Diese Datei
CLAUDE.md           Symlink auf AGENTS.md (fuer Claude Code)
```

## Kernwissen (nicht neu herleiten)

- **API-Diskrepanz:** `playlistItems.snippet.channelId` ist als "user that added the item" dokumentiert, liefert in der Praxis aber oft nur den **Playlist-Owner** fuer jeden Eintrag. Ob der API-Weg fuer eine Playlist taugt, ist **empirisch** — das Skript erkennt und meldet den Owner-only-Fall (Exit-Code 2).
- **Auth:** Oeffentliche Playlist -> nur **API-Key**, kein OAuth. OAuth erst fuer private/ungelistete Playlists noetig.
- **Keine 24/7-Notwendigkeit:** Eine Verifikation ist ein Einmal-Lauf. Ein Dauerprozess lohnt nur fuer kontinuierliches Monitoring/Enforcement.

## Konventionen

- **Sprache:** Dokumentation auf Deutsch, Code und Code-Kommentare auf Englisch.
- **Keine Dependencies:** Nur Python-Standardbibliothek. Kein `pip install`, kein Framework, solange es die Standardlib tut.
- **Secrets:** API-Keys niemals committen. Immer ueber `$YT_API_KEY` oder `--api-key` reinreichen.
- **Verifikation:** Aenderungen am Skript gegen `python3 -c "import ast; ast.parse(open('check_playlist.py').read())"` und `--help` smoke-testen; wenn ein API-Key vorliegt, gegen eine echte Playlist.
