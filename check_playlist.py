#!/usr/bin/env python3
"""Verify how many videos each contributor added to a YouTube playlist.

For a *public* playlist only a YouTube Data API v3 key is required (no OAuth).
The script is self-diagnosing: the YouTube API documents
``playlistItems.snippet.channelId`` as "the user that added the item", but in
practice the API frequently returns the *playlist owner* for every item. If all
items share one channelId, per-contributor counting is impossible via the API
and you must fall back to scraping the logged-in web UI.

Usage:
    export YT_API_KEY=...            # or pass --api-key
    ./check_playlist.py PLAYLIST_ID [--expected 2]
"""
from __future__ import annotations

import argparse
import json
import os
import sys
from collections import Counter
from urllib.error import HTTPError
from urllib.parse import urlencode
from urllib.request import urlopen

API_URL = "https://www.googleapis.com/youtube/v3/playlistItems"


def fetch_items(playlist_id: str, api_key: str) -> list[dict]:
    """Page through every playlist item (50 per request)."""
    items: list[dict] = []
    page_token = ""
    while True:
        query = urlencode(
            {
                "part": "snippet",
                "playlistId": playlist_id,
                "maxResults": 50,
                "pageToken": page_token,
                "key": api_key,
            }
        )
        with urlopen(f"{API_URL}?{query}") as resp:
            data = json.load(resp)
        items.extend(data.get("items", []))
        page_token = data.get("nextPageToken", "")
        if not page_token:
            return items


def contributor(item: dict) -> tuple[str, str]:
    """(channelId, channelTitle) of the account that added the item."""
    snip = item.get("snippet", {})
    return snip.get("channelId", "?"), snip.get("channelTitle", "?")


def report(items: list[dict], expected: int) -> int:
    """Print per-contributor counts. Return process exit code."""
    counts: Counter[tuple[str, str]] = Counter(contributor(it) for it in items)
    print(f"{len(items)} videos, {len(counts)} distinct contributor id(s)\n")

    if len(counts) <= 1:
        print("!! All items share one channelId (the playlist owner).")
        print("!! The API does NOT expose per-contributor data for this playlist.")
        print("!! Fall back to scraping the logged-in web UI (see README).")
        return 2

    ok = True
    width = max(len(title) for (_, title) in counts) if counts else 10
    for (cid, title), n in sorted(counts.items(), key=lambda kv: -kv[1]):
        if n == expected:
            status = "OK"
        else:
            status = f"MISMATCH (expected {expected})"
            ok = False
        print(f"{title:<{width}}  {n:>3}  {status}   [{cid}]")

    print()
    print("All contributors match." if ok else "Some contributors deviate from the target.")
    return 0 if ok else 1


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("playlist_id", help="YouTube playlist id, e.g. PLxxxx")
    parser.add_argument(
        "--api-key",
        default=os.environ.get("YT_API_KEY"),
        help="YouTube Data API v3 key (default: $YT_API_KEY)",
    )
    parser.add_argument(
        "--expected",
        type=int,
        default=2,
        help="expected number of videos per contributor (default: 2)",
    )
    args = parser.parse_args()

    if not args.api_key:
        parser.error("no API key: pass --api-key or set $YT_API_KEY")

    try:
        items = fetch_items(args.playlist_id, args.api_key)
    except HTTPError as exc:
        body = exc.read().decode("utf-8", "replace")
        print(f"HTTP {exc.code} from YouTube API:\n{body}", file=sys.stderr)
        return 3

    return report(items, args.expected)


if __name__ == "__main__":
    raise SystemExit(main())
