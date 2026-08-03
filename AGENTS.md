# youtube-playlist-manager

Anweisungen fuer LLM-Agenten, die an diesem Repo arbeiten.

## Zweck

Sammlung kleiner CLI-Tools rund um YouTube-Playlists (YouTube Data API v3). Pro Aufgabe ein fokussiertes Kommando. Siehe [README.md](README.md) fuer Kommando-Uebersicht und Nutzung.

## Struktur

```
check_playlist.py   Kommando "Contributor-Check": Beitraege pro Contributor zaehlen
README.md           Zweck, Kommando-Uebersicht, Nutzung
TODO.md             Offene Aufgaben / geplante Kommandos
AGENTS.md           Diese Datei
CLAUDE.md           Symlink auf AGENTS.md (fuer Claude Code)
docs/kontext.md     Vollstaendiger Kontext- und Uebergabestand (bei Sessionwechsel zuerst lesen)
```

Neue Kommandos als eigene, fokussierte Skripte anlegen (ein Zweck pro Datei) und in der Kommando-Tabelle der README + in TODO.md eintragen.

## Kernwissen (nicht neu herleiten)

- **API-Diskrepanz:** `playlistItems.snippet.channelId` ist als "user that added the item" dokumentiert, liefert in der Praxis aber oft nur den **Playlist-Owner** fuer jeden Eintrag. Ob der API-Weg fuer eine Playlist taugt, ist **empirisch** — der Contributor-Check erkennt und meldet den Owner-only-Fall (Exit-Code 2).
- **Auth:** Oeffentliche Playlist -> nur **API-Key**, kein OAuth. OAuth erst fuer private/ungelistete Playlists oder Schreib-Kommandos noetig.
- **Keine 24/7-Notwendigkeit:** Eine Verifikation ist ein Einmal-Lauf. Ein Dauerprozess lohnt nur fuer kontinuierliches Monitoring/Enforcement.

## Konventionen

- **Sprache:** Dokumentation auf Deutsch, Code und Code-Kommentare auf Englisch.
- **Keine Dependencies:** Nur Python-Standardbibliothek. Kein `pip install`, kein Framework, solange es die Standardlib tut.
- **Secrets:** API-Keys/OAuth-Token niemals committen. Immer ueber `$YT_API_KEY` oder `--api-key` reinreichen.
- **Keine Stubs:** Nur echte, laufende Kommandos einchecken. Geplante Kommandos gehoeren in TODO.md, nicht als leere Platzhalter ins Repo.
- **Verifikation:** Skript-Aenderungen gegen `python3 -c "import ast; ast.parse(open('DATEI').read())"` und `--help` smoke-testen; wenn ein API-Key vorliegt, gegen eine echte Playlist.
