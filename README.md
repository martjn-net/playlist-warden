# Playlist Warden for YouTube

> **Fair caps, cleanup & shuffle for shared playlists.**

Browser-Extension (WXT · Chrome/Firefox/Safari, ein Codebase) für **kollaborative
YouTube-Playlists**: setzt ein Limit *N Songs pro Person* durch, entfernt tote Links,
Duplikate und Off-Genre-Einträge nach eigenen Regeln und mischt — **ein Klick** direkt
auf der Playlist-Seite. Alles bleibt lokal im Browser-Profil; Schreibzugriffe laufen
über deinen **eigenen Google-Login** und nur auf **eigenen** Playlists.

## Ziel

Playlists **öffentlich, community-freundlich und demokratisch** abspielen — jeder trägt
bei, keine Plattform-Insel. Der Knackpunkt ist die gemeinsame Basis: Menschen nutzen
verschiedene Musikdienste (Spotify, Apple Music, Amazon Music, …), aber **fast alle
haben einen Google-Account** → größte Schnittmenge = **YouTube**. Eine gemeinsam
gepflegte YouTube-Playlist ist damit ideal für den öffentlichen/kollaborativen Einsatz —
fair gedeckelt (Cap), gemischt (Shuffle) und bereinigt (Dead-Links/Duplikate/Content).

## Was sie kann

- **Adder-Attribution** (Alleinstellungsmerkmal): liest das „added by"-Avatarbild je
  Video aus der eingeloggten Playlist-Seite (die Data API gibt das nicht her) → Basis
  für den Cap pro Person.
- **Checks** über die ganze Playlist (Data API, dein OAuth-Token): Dead/Unavailable
  (gelöscht/privat/rejected), Duplikate, Content-Regeln (Musik-Kategorie, Age-Restricted,
  Genre-Allow/Deny, Titel-Keyword-Blocklist, Deny-Channels, Min/Max-Dauer, Region-Block),
  Contributor-Zählung, Owner-Check.
- **Writes** (nur eigene Playlists, jede Aktion ins Audit/Job-Log): **Cap** (Überschuss
  pro Person löschen), **Prune** (Duplikate + Regelverstöße), **Shuffle**.
- **Ein-Klick-Kette** auf der Playlist-Seite: capture → checks → cap → prune → shuffle,
  mit Fortschritts-Narration; danach lädt die Seite neu.

## Was sie (bewusst) nicht kann

- Nur **eigene** Playlists ändern (YouTube-Regel); fremde: nur lesen/planen.
- Adder-Attribution nur bei **kollaborativen** Playlists und nur für vom Seiten-Payload
  gerenderte Einträge (~erste 100; keine InnerTube-Continuation für >100). Checks/Cap/
  Prune decken die ganze Liste ab.
- Keine Klarnamen der Contributor (YouTube liefert nur die stabile Avatar-Foto-ID + Zahl).
- Keine Automatik/Zeitplan (nur auf Klick), kein Geräte-/Nutzer-Sync (lokal), legt keine
  Playlists an, schaltet nichts „kollaborativ", ersetzt Einträge nicht (nur löschen).
- API-Quota (10k Units/Tag; Delete/Reorder je ~50).

## Aufbau

```
extension/              Die Extension (WXT, Chrome/Firefox/Safari) — das Produkt
docs/extension-plan.md  Plan, Architektur, Meilensteine M1–M5
docs/kontext.md         Übergabestand (bei Sessionwechsel zuerst lesen)
AGENTS.md               Anweisungen für LLM-Agenten
```

Extension-Details: **[extension/README.md](extension/README.md)**.

## Entwicklung & Verifikation

```bash
cd extension
npm install            # WXT + Deps
npm test               # pure Unit-/Parity-Tests (node --test)
npm run check          # svelte-check (Typen/Props)
npm run build          # Chrome-Build  -> .output/chrome-mv3
npm run build:firefox  # Firefox-Build -> .output/firefox-mv2
```

## Live-Setup (Google-OAuth)

Einmalig: am eingebauten **OAuth-Client** (Google Cloud Console) die **Redirect-URI**
`https://<extension-id>.chromiumapp.org/` (Extension-ID siehe `chrome://extensions`)
als *Authorized redirect URI* eintragen und den Login-Account als Testnutzer hinterlegen.
Sign-in öffnet der „Run maintenance"-Button bei Bedarf von selbst (oder Tab **Login**).
Danach läuft die Wartungs-Kette auf eigenen Playlists.

**Das ist der Übergangszustand:** Redirect-URI-Registrierung + Testnutzer-Liste +
einmalig den „nicht überprüft"-Screen durchklicken gilt nur, solange die App bei
Google im Testing-Modus ist. Der endgültige, bequeme Google-Login (verifizierte App,
kein Warnscreen, keine Testnutzer-Liste) ist geplant — Hintergrund, Optionen und
Roadmap: [docs/oauth-verifizierung.md](docs/oauth-verifizierung.md). Details:
[extension/README.md](extension/README.md).
