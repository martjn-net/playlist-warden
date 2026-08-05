# Google-OAuth-Verifizierung — Optionen & Entscheidung

Stand: 2026-08-05. Quellen: Google OAuth Docs (developers.google.com/identity/protocols/oauth2/production-readiness/sensitive-scope-verification, support.google.com/cloud/answer/13461325 — zuletzt aktualisiert 2026-07-17).

## Kontext

Die Extension nutzt den Scope `.../auth/youtube` = **sensitiv** (Googles eigenes
Beispiel: „deleting a YouTube video"). Unverifizierte Apps mit sensitiven Scopes zeigen
beim Consent den Screen **„Google hat diese App nicht überprüft"**. Der Screen ist pro
Konto **einmalig** durchzuklicken (Erweitert → …öffnen (unsicher) → Zulassen); Google
merkt sich die Einwilligung dauerhaft, danach läuft auch silent renew ohne Screen.

Voraussetzung (Testing-Modus): Das Login-Konto muss als **Testnutzer** im Consent
Screen stehen, sonst „Zugriff blockiert".

## Optionen

| Option | Aufwand | Wirkung |
|---|---|---|
| **A) „Personal use"-Ausnahme** | 0 | Screen einmal pro Konto durchklicken; laut Doku offiziell vorgesehen für „nur du / wenige, dir bekannte Nutzer" |
| **B) Internal user type** | 0, kein Screen, keine Verifizierung | Nur unter einer **Google-Workspace-Organisation** verfügbar — nicht für gmail.com-Konten |
| **C) Service Account** | 0 | Nur eigene (Service-)Daten, kein User-Consent — ungeeignet für YouTube-User-Schreibzugriff |
| **D) Formale Verifizierung** | Domain + Homepage + Privacy Policy + Demo-Video + ~10 Tage Review | Screen weg für jedermann, dauerhaft |

## Entscheidung für Playlist Warden

**Option A.** Ein-Nutzer-Tool (Owner + evtl. 1–2 bekannte Konten). D lohnt sich erst,
wenn die Extension je über den Chrome Web Store an Fremde geht. B/C sind technisch
nicht anwendbar.

## Option D im Detail (Referenz für später)

**Vorbereitung:**
1. App im Consent Screen **veröffentlichen** (Testing → Production, „Publish App") —
   Verifizierung nur im Production-Status möglich.
2. **Öffentliche Homepage** (kein Login, beschreibt klar die App, verlinkt Privacy
   Policy; reine Store-/Repo-Links sind nicht sicher zulässig).
3. **Privacy Policy auf derselben Domain** — muss offenlegen, wie Google-Nutzerdaten
   abgerufen, verwendet, gespeichert, geteilt werden.
4. **Authorized Domains** in der **Search Console** verifizieren (Konto muss
   Owner/Editor des GCP-Projekts sein).
5. Console → OAuth **Branding**: App-Name, Logo, Support-Mail, Kontakte → „Verify
   Branding" (automatisch, meist Minuten) → „Publish branding".

**Einreichung (Verification Center):**

6. Alle Scopes deklarieren; pro sensitivem Scope **schriftliche Begründung** (wofür
   genau + warum kein schmalerer Scope reicht).
7. **Demo-Video** (unlisted auf YouTube, auf Englisch): OAuth-Flow mit Consent-Screen
   (App-Name sichtbar, **Client-ID in der Adresszeile** sichtbar) + Demonstration der
   Funktion je sensitivem Scope (hier: ein „Run maintenance"-Lauf). Bis zu 3
   Doku-Links optional.
8. „Submit for Verification" → Trust-&-Safety-Review **bis ~10 Tage**, Rückfragen per
   Mail an Projekt-Owner/Editor.

**Danach dauerhaft:** Kontaktdaten aktuell halten; **jeder neue Scope** löst erneute
Prüfung aus; Policy-Verstöße gegen die API-Services-User-Data-Policy riskieren Sperrung.

## Vergleich: wie lösen es Chrome-Store-Extensions? (Recherche 2026-08-05)

Vergleichbare YouTube-Playlist-Extensions nutzen fast alle **gar kein OAuth**:

| Extension | Nutzer | Login/OAuth | Website |
|---|---|---|---|
| PocketTube PlayList Manager | 40k | keins — Löschen/Sortieren/Bewegen direkt im YouTube-Frontend (DOM/InnerTube) | pockettube.io |
| PocketTube Subscription Manager | 300k | nur *optionaler* Sync (Google Drive `drive.appdata`, nicht-sensitiv / Chrome-Profil) | pockettube.io |
| YouTube Playlist Quick Delete | 4k | keins — Delete-Button im DOM | **keine**, nur E-Mail; deklariert „sammelt keine Daten" → keine Privacy-Policy nötig |
| Playlist alphabetical A-Z | 2k | keins — sortiert nur DOM | keine eigene (PP-Link vom anderen Produkt des Entwicklers) |

**Muster:**
1. **Frontend statt API:** Writes laufen ueber das YouTube-UI (InnerTube) im Kontext der
   eingeloggten Seite — kein Token, kein Consent-Screen, kein Verifizierungsproblem.
2. **OAuth nur optional + nicht-sensitiv:** Cloud-Sync ueber `drive.appdata` o. Ae.
   Non-sensitive Scopes loesen keinen „unverified"-Screen aus.
3. **Domain** haben nur Produkte (Store-Publisher-Verifikation, CWS-Privacy-Pflicht bei
   Datenverarbeitung, Support/Patreon) — **nicht wegen OAuth**. Extensions ohne
   Datenverarbeitung brauchen weder Website noch Privacy-Policy.

**Konsequenz fuer Playlist Warden:** Option A bleibt richtig. Falls der Consent-Screen
je stoert, waere der architektonische Ausweg wie die Konkurrenz: Kette ueber
InnerTube/Frontend statt Data API. Kostet Funktionen — unsere Checks brauchen
`videos.list`-Daten (Kategorie, Region-Block, Age-Restriction, Dauer), und InnerTube-
Writes sind undokumentiert/instabil. Nur ernsthaft diskutieren, wenn publiziert werden soll.

## Roadmap Publikation (Entscheidung: publizieren) — Mindestanforderungen

**A) Chrome Web Store (Listing):**
- Developer-Account: 5 $ einmalig; als Privatperson **Non-trader** moeglich (kein
  Impressum/Adress-Offenlegung; DSA-Trader-Pflicht gilt nur Gewerbliche).
- Assets: 128×128-Icon, mind. 1 Screenshot 1280×800, Beschreibung, Single-Purpose +
  Permission-Begruendungen (`*://www.youtube.com/*`, googleapis, `identity`, `storage`).
- **Privacy-Praktiken** deklarieren (wir verarbeiten Website-Inhalte → „user activity")
  + **Privacy-Policy-URL** — beliebige oeffentliche URL, KEINE Domain-Gleichheit noetig.

**B) OAuth-Verifizierung (DAS ist der bindende Track):**
- Unverifiziert publiziert = Warn-Screen + **Cap: max. 100 neue Nutzer**
  (support.google.com/cloud/answer/7454865) → ohne Verifizierung sinnlos.
- **Pflicht: oeffentliche Homepage + Privacy-Policy auf derselben Domain**, Domain in
  der **Search Console** verifiziert (Account = Projekt-Owner/-Editor).
- Branding + Scope-Begruendung + Demo-Video (en, unlisted), Review ~10 Tage (teils
  deutlich laenger); neue Scopes/Redirect-URIs/Produktname → Re-Verifizierung.

**Domain-Strategie (bestaetigt):** die bestehende Domain **martjn.net** deckt alles ab —
keine neue Domain noetig. Unterseiten-Schema pro App:
- Application home page: `martjn.net/playlist-warden` (oeffffentlich, beschreibt die
  App, verlinkt die PP) — muss **nicht** die Domain-Root sein; Google prueft die
  eingegebene URL selbst.
- Privacy Policy: `martjn.net/playlist-warden/privacy` — **app-spezifisch** halten
  (Reviewer prueft die Limited-Use-Punkte gegen genau diese App).
- Search-Console-Verifizierung laeuft auf **Domain-Ebene**: einmal verifiziert, deckt
  ALLE Unterseiten/kuenftigen Apps (martjn.net/next-app) ohne Neuverifizierung ab.
- Achtung: Consent Screen (App-Name, Logo, URLs) ist **pro GCP-Projekt** konfiguriert —
  pro App eigenes Projekt, die Domain wird nur geteilt.

**Minimalsetup (ein Nachmittag + Wartezeit):**
1. Domain ~10–15 €/Jahr zulegen.
2. Kostenloses Static-Hosting auf eigener Domain (GitHub Pages/CF Pages/Netlify;
   Free-Subdomains wie `user.github.io` sind fuer die Search-Console-Domainpruefung
   unsicher → eigene Domain ist der sichere Weg) `[INFERENCE]`.
3. Zwei statische Seiten, **Englisch**: `/` (was die Extension tut + Store-Link +
   Privacy-Link) und `/privacy` (ehrlich: alles lokal, kein Server, keine Analytics,
   Token lokal, YouTube Data API, Limited-Use-Satz). Unsere „no data leaves the
   device"-Wahrheit ist die staerkste moegliche Policy.
4. Search-Console-Domainproperty per TXT-Record → Consent Screen: Branding +
   URLs + Authorized Domain → „Verify Branding" → Publish branding.
5. Demo-Video: Run-maintenance-Klick → Consent (App-Name + Client-ID in Adresszeile
   sichtbar) → Kette laeuft.
6. Verification Center: `.../auth/youtube` + Begruendung + Video → Submit → warten.
7. Parallel CWS-Einreichung vorbereiten (Review bei breiten Host-Permissions dauert).
