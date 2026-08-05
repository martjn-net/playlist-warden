/**
 * Auto-pilot decision logic (pure — no WXT dependency, unit-tested).
 *
 * An hourly `alarms` tick in the background asks: which managed playlists have
 * `autoIntervalDays` set and whose last maintenance is older than that window?
 * Each overdue playlist produces ONE browser notification per interval (the
 * `lastNotified` map suppresses re-alerts until another full window passed).
 * Nothing runs while the browser is closed — the tick simply fires next time.
 */

import type { Job, PlaylistMeta } from './schema.ts';

export interface AutoDue {
  id: string;
  title: string;
  daysSinceRun: number;
}

export const DAY_MS = 86_400_000;

/**
 * Last maintenance run per playlist (ms epoch): the newest finished `run_all`
 * job, falling back to the playlist's own `updatedAt` so a freshly added list
 * is not instantly "overdue".
 */
export function lastRunByPlaylist(jobs: Job[], playlists: Record<string, PlaylistMeta>): Record<string, number> {
  const out: Record<string, number> = {};
  for (const [id, meta] of Object.entries(playlists)) {
    let anchor = Date.parse(meta.updatedAt) || 0;
    for (const j of jobs) {
      if (j.command !== 'run_all' || j.status !== 'done' || j.playlistId !== id) continue;
      const t = Date.parse(j.createdAt);
      if (t > anchor) anchor = t;
    }
    out[id] = anchor;
  }
  return out;
}

/**
 * Playlists whose interval elapsed AND that were not notified within the same
 * window yet. `autoIntervalDays` 0 / unset = autopilot off for that list.
 */
export function dueForNotification(
  playlists: Record<string, PlaylistMeta>,
  lastRun: Record<string, number>,
  lastNotified: Record<string, number>,
  now: number,
): AutoDue[] {
  const out: AutoDue[] = [];
  for (const [id, meta] of Object.entries(playlists)) {
    const days = Math.floor(meta.autoIntervalDays);
    if (!(days > 0)) continue;
    const run = lastRun[id] ?? 0;
    if (now - run < days * DAY_MS) continue;
    const notified = lastNotified[id] ?? 0;
    if (notified > 0 && now - notified < days * DAY_MS) continue;
    out.push({ id, title: meta.title, daysSinceRun: Math.floor((now - run) / DAY_MS) });
  }
  return out;
}
