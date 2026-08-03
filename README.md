# youtube-playlist-contributor-check

Kleines Tool, das prueft, **wie viele Videos jedes Mitglied zu einer YouTube-Playlist beigetragen hat** — z. B. um zu verifizieren, dass jeder Teilnehmer genau zwei Songs hinzugefuegt hat.

## Hintergrund

Bei einer **kollaborativen** YouTube-Playlist zeigt die Weboberflaeche pro Video an, wer es hinzugefuegt hat. Diese "hinzugefuegt von"-Info ist aber:

- **nicht** in den ausgeloggt geladenen Playlist-Daten enthalten, und
- laut YouTube Data API v3 zwar dokumentiert (`playlistItems.snippet.channelId` = *"the user that added the item to the playlist"*), in der Praxis liefert die API aber haeufig fuer **jeden** Eintrag denselben Wert — den **Playlist-Owner** ([bekannte Diskrepanz](https://stackoverflow.com/questions/53373429/how-to-get-channel-id-of-videos-listed-in-playlistitems-in-youtube-api-v3)).

Ob der API-Weg fuer eine konkrete Playlist funktioniert, laesst sich nur **empirisch** feststellen. Genau das macht das Skript: es zaehlt pro `channelId` und meldet, wenn alle Eintraege denselben Owner tragen (dann ist der API-Weg unmoeglich).

## Voraussetzungen

- Python 3.9+ (nur Standardbibliothek, keine Dependencies)
- Ein **YouTube Data API v3 Key** — fuer eine *oeffentliche* Playlist reicht ein API-Key, **kein OAuth**:
  1. [Google Cloud Console](https://console.cloud.google.com/) -> Projekt anlegen/waehlen
  2. "YouTube Data API v3" aktivieren
  3. Anmeldedaten -> API-Schluessel erstellen

## Nutzung

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

Wenn die API **keine** Contributor-Info hergibt:

```
4 videos, 1 distinct contributor id(s)

!! All items share one channelId (the playlist owner).
!! The API does NOT expose per-contributor data for this playlist.
!! Fall back to scraping the logged-in web UI (see README).
```

### Exit-Codes

| Code | Bedeutung |
|------|-----------|
| `0`  | Alle Contributor treffen `--expected` |
| `1`  | Mindestens ein Contributor weicht ab |
| `2`  | API gibt keine Contributor-Info her (nur Owner) |
| `3`  | HTTP-/API-Fehler |

## Fallback: eingeloggtes DOM

Gibt die API nur den Owner her (Exit-Code 2), bleibt nur der eingeloggte Weg:
Playlist im Browser als Owner/Teilnehmer oeffnen — dort steht pro Video der Avatar/Name des Hinzufuegenden. Ein Tampermonkey-Userscript, das diese Namen ausliest und zaehlt, ist als naechster Schritt in [`TODO.md`](TODO.md) vermerkt.
