# Monetarisierung — Recherche & Ideenkatalog (Deep Research 2026-08-06)

Ausgangslage: lokale Erweiterung, kein Backend, Open Source (public repo), Ziel „ein paar Euro pro Monat". Quellen in den Abschnitten verlinkt.

## 1. Was der Markt belegt

### Der passende Blaupause-Case: PocketTube
- **~2.332 zahlende Patreons ab 3 €/Monat** ([patreon.com/ysub](https://www.patreon.com/ysub)) auf
  ~350k Nutzer (CWS 200k+ + Firefox ~21k + Website-Angabe 300k) ⇒ **Conversion ~0,7 %,
  grob €7–9k/Monat** vor Patreon-Fee (~8–12 %) `[Umrechnung]`.
- Gate-Mechanik **ohne eigenes Backend**: eingebauter Patreon-OAuth im Extension-Menü
  („Sign in using Patreon"), Freischaltung clientseitig; gilt für beide Extensions + Apps.
  Gated: u. a. **alle Playlist-Features**, Sub-Gruppen, Sortierung, unlimitiertes Watched.
- Reviews: **kein Paywall-Groll** beobachtbar — Unmut richtet sich gegen Sync-Brüche,
  Performance, 100-Item-Bugs. Gehasst wird, wenn **früher freie Kernfeatures** hinter
  Paywall rutschen („used to be free"-Muster).

### Zahlungsbereitschaft in unserer direkten Nische
- **Playlist Guard**: Monitoring + Snapshots + Lösch-Alarm — **$0.99/Mo (2 Playlists),
  $2.99/Mo (15), $29/Jahr** ([playlistguard.com](https://playlistguard.com)).
- **RecoverMy.Video**: stellt Titel gelöschter/privater Videos wieder her („Lost"-Tab)
  ([recovermy.video](https://recovermy.video)) — zahlende Nutzer für Dead-Link-Aufklärung.
- **MyFreshTools**: „Weekly Auto Backup" (wöchentlicher Scheduler, CSV per Mail) als
  explizites Paid-Feature ([myfreshtools.com](https://myfreshtools.com)) — Automatisierung
  als Gate ist bewiesen.
- Donation-only-Spur (Multiselect: €5-Kaffee, ausdrücklich anti-paywall; Unhook: PayPal)
  ⇒ Spenden allein tragen nichts, Feature-Gates sind das Muster, das trägt.
- Creator-SaaS-Anker (TubeBuddy Pro ~$3–5/Mo, vidIQ ~$16/Mo) zielen auf Kanal-Revenue —
  für ein Pflege-Tool ohne Geld-Hebel **nicht** übertragbar; Consumer-Preispunkt ist
  **2–4 €/Monat bzw. 20–30 €/Jahr**, davon zeugen Playlist Guard und PocketTube.

### Nachfrage-Muster (r/youtube, WebApps SE, Reviews)
- **Dead Links/„unavailable" entfernen** — stark, wiederkehrend, YouTube informiert
  kaum (kein Titel); Extremfall: YT löscht ganze Playlists wegen eines Videos.
- **Watch-Later-Aufräumen/Bulk** — stark; User pasten sogar fremde Console-Snippets.
- **Dedupe** — mittel; ständige Eigenbauten (Deduper-Extensions, Skripte).
- **Backup/Snapshot + Lösch-Alarm** — stark, mit belegter Zahlungsbereitschaft (s.o.).
- **Sync zwischen Geräten** — mittel; PocketTube nutzt es als Pitch, Reviews zeigen,
  dass Drive-Sync regelmäßig bricht ⇒ **Anti-Feature: wir bleiben local-first.**
- **Kollaborative Moderation (Caps/Regeln)** — quasi unbesetzte Nische (YT nativ: nur
  Owner-Remove-All + Voting), aber Nachfrage-Belege = Einzelstimmen ⇒ Alleinstellung
  im **Free-Tier**, nicht Paid-Kern.

## 2. Regeln & Mechanik

- **CWS Policies:** Drittanbieter-Payments erlaubt; Disclosure für bezahlte Kernfunktion;
  AdSense/Crypto-Mining verboten
  ([accepting-payment](https://developer.chrome.com/docs/webstore/program-policies/accepting-payment),
  [ads](https://developer.chrome.com/docs/webstore/program-policies/ads)).
- **YouTube API ToS:** kein Verkauf/Weiterverkauf von API-Daten oder Zugriff; Quota
  nicht übertragbar (bei uns: je User eigene Quota — kompatibel); 30-Tage-Speicherlimit
  für API-Daten (relevant erst bei Backend-Sync)
  ([ToS](https://developers.google.com/youtube/terms/api-services-terms-of-service)).
- **Payment-Rails:**
  - **Patreon** = billigster Einstieg: kein eigenes Backend, EUR-fähig, Fee ~8–12 %,
    Gate via `launchWebAuthFlow` + PKCE, Tier-Check `patron_status === 'active_patron'`
    (Scopes `identity`, `identity.memberships`). Ko-fi hat **keine** brauchbare Tier-API.
  - **Lemon Squeezy / Paddle** = Merchant of Record (MwSt. erledigt): 5 % + $0.50/Transaktion
    ⇒ Fixgebühr killt €2/Monat → **Jahres- oder Lifetime-Preis** wählen; Payout ab
    $50 (LS, 2×/Monat) / $100 (Paddle). License-Key-Check via deren Verify-API aus der
    Extension (Key in `chrome.storage`).
- **Open-Core-Realität:** Repo ist public — Gate ist honor-basiert (Fork kann es
  entfernen). PocketTube akzeptiert exakt das; Wertversprechen = Bequemlichkeit +
  Updates, nicht Schutz durch Geheimhaltung.

## 3. Empfohlener Free/Paid-Schnitt

**Free bleibt großzügig** (Vertrauen + kein „used to be free"-Groll):
- Komplette Kette manuell: checks → cap → prune → shuffle
- Content-Regeln, Log/Audit, **kollaborative Caps** (Alleinstellung)
- bis 2 verwaltete Playlists
- Robustheit frei: **>100-Item-Paging** (eigener TODO-Punkt — bewusst frei, weil
  Konkurrenz genau an diesem Bug hängt; guter Marketing-Punkt „funktioniert auch
  bei großen Playlists")

**Paid (Arbeitstitel „Warden+", 3 €/Monat oder 25–29 €/Jahr; Lifetime ~35 € als Test):**
1. **Auto-Pilot** — geplante Wartung (täglich/wöchentlich) via `chrome.alarms`,
   läuft bei offenem Browser ohne Klick. *(Kern-Paid; Muster bei MyFreshTools/Guard belegt)*
2. **Bulk-Run** — Kette über **alle** verwalteten Playlists + unbegrenzte Playlist-Zahl.
3. **Backup & Restore** — vollständiger Snapshot (Einträge, Regeln, adderMap) als
   JSON-Datei Export/Import + versionierte lokale Snapshots mit Aufbewahrung.
4. **Analytics-Tab** — Contributor-Statistik (Wer füllt die Liste? Cap-Druck,
   Audit-Auswertung über Zeit).
5. **Power-Regeln** — Regex-Titel-Filter, komplexe Region/Age-Profile (ohne Kernregeln
   wegzunehmen — die bleiben frei).
6. **Lösch-Alarm** — Mini-Monitoring: meldet, wenn Videos in verwalteten Listen
   sterben (läuft im Scheduler mit).

Nicht gaten: manuelle Kern-Pruning/Caps, Offline-Funktion, Sign-in.

## 4. Stufenplan (Aufwand grob `[EINSCHÄTZUNG]`)

| Phase | Inhalt | Aufwand | Ziel |
|---|---|---|---|
| 0 | Ko-fi/BMC-Link auf martjn.net-Produktseite + README | ½ Tag | Erwartungs-Management + erste Spenden |
| **1 (Voraussetzung!)** | **OAuth-Verifizierung + CWS-Veröffentlichung** — ohne sie hängt jeder Fremde an der Testnutzer-Mauer; Volumen entsteht nur über den Store | siehe `docs/oauth-verifizierung.md` | Installierbarkeit für alle |
| 2 | Freemium v1: **Patreon-Gate** + Auto-Pilot + Bulk-Run | ~2–3 Tage | Erste zahlende Nutzer |
| 3 | Backup/Restore + Analytics in Warden+ | ~2 Tage | Retention, mehr Value |
| 4 (optional) | LS/Paddle-License-Keys statt Patreon (bessere Marge/Branding), evtl. eigener Sync-Service | 3+ Tage | nur bei echter Traktion |

**Umsatz-Realismus** (0,7 %-Conversion-Anker PocketTube): 500 Installs → ~10 €/Mo;
5.000 Installs → ~100–150 €/Mo. „Ein paar Euro/Monat" ist mit Phase 2 erreichbar;
PocketTube-Niveau ist ein Mehrjahrespfad.

## 5. Risiken / Nicht-Ziele
- **Kein Backend-Sync** vorerst: Drive-Sync-Brüche zeigen das Support-Fass; widerspricht
  local-first; erst bei nachgewiesener Nachfrage (bedeutet zudem OAuth-Offline-Zugriff
  mit Refresh-Tokens + 30-Tage-Datendisziplin + DSGVO-Briefcase).
- Keine Ads/Affiliate in YouTube-Seiten; kein Verkauf von API-Daten (ToS).
- Gate-Code gehört nicht obfuskiert — Fork-Bypass akzeptieren, wie PocketTube.
