# youtube-playlist-manager

Sammlung kleiner CLI-Tools rund um **YouTube-Playlists** (YouTube Data API v3, nur Python-Standardbibliothek).

Das Projekt ist als Playlist-Manager angelegt: pro Aufgabe ein fokussiertes Kommando. Aktuell implementiert ist der **Contributor-Check**; weitere Kommandos (Export, Diff, Dedupe, ...) sind in [`TODO.md`](TODO.md) geplant.

## Kommandos

| Kommando | Datei | Zweck | Status |
|----------|-------|-------|--------|
| Contributor-Check | [`check_playlist.py`](check_playlist.py) | Zaehlt pro Mitglied die Anzahl beigetragener Videos (z. B. "jeder genau 2 Songs?") | implementiert |

## Voraussetzungen

- Python 3.9+ (keine Dependencies)
- Ein **YouTube Data API v3 Key** — fuer eine *oeffentliche* Playlist reicht ein API-Key, **kein OAuth**:
  1. [Google Cloud Console](https://console.cloud.google.com/) -> Projekt anlegen/waehlen
  2. "YouTube Data API v3" aktivieren
  3. Anmeldedaten -> API-Schluessel erstellen

## Contributor-Check

Prueft, **wie viele Videos jedes Mitglied zu einer Playlist beigetragen hat**.

```bash
export YT_API_KEY=dein_api_key
./check_playlist.py PLTwMRo-WlCUs --expected 2
```

Beispielausgabe (API liefert Contributor):

```
4 videos, 2 distinct contributor id(s)

Alice   2  OK          [UCxxxxxxxxxxxx]
Bob     2  OK          [UCyyyyyyyyyyyy]

All contributors match.
```

### Der API-Haken

Bei einer **kollaborativen** Playlist zeigt die Weboberflaeche pro Video, wer es hinzugefuegt hat. Diese Info ist:

- **nicht** in den ausgeloggt geladenen Playlist-Daten enthalten, und
- laut YouTube Data API v3 zwar dokumentiert (`playlistItems.snippet.channelId` = *"the user that added the item to the playlist"*), liefert in der Praxis aber haeufig fuer **jeden** Eintrag denselben Wert — den **Playlist-Owner** ([bekannte Diskrepanz](https://stackoverflow.com/questions/53373429/how-to-get-channel-id-of-videos-listed-in-playlistitems-in-youtube-api-v3)).

Ob der API-Weg fuer eine konkrete Playlist funktioniert, ist **empirisch**. Das Kommando erkennt und meldet den Owner-only-Fall (Exit-Code 2).

### Exit-Codes

| Code | Bedeutung |
|------|-----------|
| `0`  | Alle Contributor treffen `--expected` |
| `1`  | Mindestens ein Contributor weicht ab |
| `2`  | API gibt keine Contributor-Info her (nur Owner) |
| `3`  | HTTP-/API-Fehler |

### Fallback: eingeloggtes DOM

Gibt die API nur den Owner her (Exit-Code 2), bleibt nur der eingeloggte Weg:
Playlist im Browser als Owner/Teilnehmer oeffnen — dort steht pro Video der Avatar/Name des Hinzufuegenden. Ein Tampermonkey-Userscript, das diese Namen ausliest und zaehlt, ist als naechster Schritt in [`TODO.md`](TODO.md) vermerkt.
