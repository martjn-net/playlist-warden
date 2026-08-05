# Playlist Warden for YouTube

> **Fair caps, cleanup & shuffle for shared playlists.**

A browser extension (WXT · Chrome/Firefox/Safari, one codebase) for **collaborative
YouTube playlists**: enforces a limit of *N songs per person*, removes dead links,
duplicates and off-genre entries by configurable rules, and shuffles — **one click**
right on the playlist page. Everything stays local in the browser profile; writes go
through **your own Google sign-in** and only ever touch playlists you **own**.

## Why

Play music **publicly, community-friendly and democratically** — everybody contributes,
no platform silo. The sticking point is the shared base: people use different music
services (Spotify, Apple Music, Amazon Music, …), but **nearly everyone has a Google
account** → the largest common denominator is **YouTube**. A collaboratively curated
YouTube playlist is therefore ideal for public/shared use — fairly capped, shuffled,
and cleaned (dead links/duplicates/content rules).

## What it does

- **Adder attribution** (the unique bit): reads the "added by" avatar image per video
  from the logged-in playlist page (the Data API does not expose this) → the basis for
  the per-person cap.
- **Checks** across the whole playlist (Data API, your OAuth token): dead/unavailable
  (deleted/private/rejected), duplicates, content rules (music category, age-restricted,
  genre allow/deny, title keyword blocklist, deny-channels, min/max duration, region
  block), contributor counts, ownership check.
- **Writes** (only on playlists you own, every action into the audit/job log): **cap**
  (delete per-person surplus), **prune** (duplicates + rule violations), **shuffle**.
- **One-click chain** on the playlist page: capture → checks → cap → prune → shuffle,
  with progress narration; the page reloads afterwards.
- **Auto-pilot**: per-playlist interval; when the browser is running and a list is
  overdue, a notification offers "Run maintenance" or "Open playlist".

## What it (deliberately) doesn't do

- Only modify playlists you **own** (YouTube rule); foreign playlists: read/plan only.
- Adder attribution only on **collaborative** playlists and only for entries rendered
  in the page payload (~first 100; no InnerTube continuation beyond 100). Checks/cap/
  prune always cover the full list.
- No real names of contributors (YouTube only yields a stable avatar photo id + counts).
- No device/user sync (local-first), it does not create playlists, does not toggle
  "collaborative", and never replaces entries (delete only).
- API quota: 10k units/day; a delete/reorder costs ~50 units each.

## Install

Release builds with install instructions:
**[github.com/martjn-net/playlist-warden/releases](https://github.com/martjn-net/playlist-warden/releases)**
(Chrome/Chromium: unzip → `chrome://extensions` → Developer mode → Load unpacked).
The extension id is pinned via a public key, so every install shares the same OAuth
redirect URI. Until Google finishes app verification, sign-in is limited to allow-listed
test users — open an issue if you want in.

## Layout

```
extension/              The extension (WXT, Chrome/Firefox/Safari) — the product
docs/extension-plan.md  Plan, architecture, milestones M1–M5
docs/kontext.md         Hand-off context (read first when switching sessions)
docs/oauth-verifizierung.md  OAuth verification options & publication roadmap
docs/monetarisierung.md      Monetization research & idea catalog
AGENTS.md               Instructions for LLM agents
```

Extension details: **[extension/README.md](extension/README.md)**.

## Development & verification

```bash
cd extension
npm install            # WXT + deps
npm test               # pure unit/parity tests (node --test)
npm run check          # svelte-check (types/props)
npm run build          # Chrome build  -> .output/chrome-mv3
npm run build:firefox  # Firefox build -> .output/firefox-mv2
```

## Live setup (Google OAuth)

One-time: on the built-in **OAuth client** (Google Cloud Console) register the
**redirect URI** `https://<extension-id>.chromiumapp.org/` (extension id, see
`chrome://extensions`) as an *authorized redirect URI* and add the sign-in account as
a test user. The "Run maintenance" button opens Google sign-in on demand (or the
**Login** tab). The chain then runs on playlists you own.

**This is the transitional state:** redirect URI registration + test-user list +
clicking through the "unverified app" screen only applies while the app is in Google's
testing mode. A final, frictionless Google sign-in (verified app, no warning screen,
no test-user list) is planned — background, options and roadmap:
[docs/oauth-verifizierung.md](docs/oauth-verifizierung.md). Details:
[extension/README.md](extension/README.md).
