import { defineBackground } from 'wxt/utils/define-background';
import { browser } from 'wxt/browser';

import { isRecord } from '@/utils/guards';
import { store } from '@/utils/store';
import * as session from '@/utils/session';
import * as yt from '@/utils/yt';
import { computeOverview } from '@/utils/overview';
import { planCap, planShuffle, prunePlanRemovals } from '@/utils/checks';
import { RUN_PORT, type RunPhase } from '@/utils/messages';
import { dueForNotification, lastRunByPlaylist } from '@/utils/autopilot';

/**
 * Runs the maintenance chain for one playlist and streams progress back over
 * the Port. Order: checks → cap (delete surplus) → prune (delete dupes/content)
 * → shuffle (reorder what's left). Shuffle is last so the final order is clean.
 * Every write is authenticated with the signed-in user's OAuth token and logged.
 */
async function runPipeline(playlistId: string, port?: { postMessage(message: unknown): void }): Promise<void> {
  const send = (phase: RunPhase, text: string): void => {
    try {
      port?.postMessage({ phase, text });
    } catch {
      /* port closed */
    }
  };

  try {
    send('checks', 'Signing in…');
    let token = await session.getToken();
    if (!token) {
      // No stored/silently-renewable session — open the Google consent window
      // right away instead of sending the user off to the Options page.
      send('checks', 'Opening Google sign-in…');
      token = await session.signIn(true);
    }
    if (!token) {
      send('error', 'Sign-in cancelled');
      return;
    }

    send('checks', 'Checking ownership…');
    const ownership = await yt.ownsPlaylist(playlistId, token);
    if (!ownership.exists) {
      send('error', 'Playlist not found for this account');
      return;
    }
    if (!ownership.owner) {
      send('error', "Read-only — you don't own this playlist, writes skipped");
      return;
    }

    send('checks', 'Fetching playlist…');
    const entries = await yt.playlistEntries(playlistId, token);
    const ids = entries.map((e) => e.video_id).filter(Boolean);
    const [statuses, info, rawItems] = await Promise.all([
      yt.videoStatuses(ids, token),
      yt.videoInfo(ids, token),
      yt.playlistItemsRaw(playlistId, token),
    ]);
    const pl = (await store.getPlaylists())[playlistId];
    const rules = await store.getRules(playlistId);
    const adderMap = await store.getAdderMap(playlistId);
    const cap = pl?.cap ?? 0;
    const shuffleOn = pl?.shuffle ?? false;

    const ov = computeOverview({ entries, statuses, info, rawItems, rules, adderMap, cap, shuffle: shuffleOn });
    const distinctContrib = new Set(Object.values(adderMap)).size;
    send('checks', `Checks: ${entries.length} vids · ${distinctContrib} contrib · cap ${cap || '—'}`);

    const deleted = new Set<string>();

    // --- cap: delete oldest surplus beyond the per-contributor cap ---
    const surplus = cap > 0 && Object.keys(adderMap).length > 0 ? planCap(entries, adderMap, cap) : [];
    let n = 0;
    for (const s of surplus) {
      send('cap', `Cap ${++n}/${surplus.length}…`);
      await yt.deleteItem(s.item_id, token);
      deleted.add(s.item_id);
      await store.appendAudit({
        playlistId, action: 'cap_delete', videoId: s.video_id,
        contributorAvatar: s.avatar, reason: `exceeds cap ${cap}`, detail: `added ${s.added_at}`,
      });
    }
    send('cap', surplus.length ? `Cap: ${surplus.length} removed` : `Cap: none > ${cap || '—'}`);

    // --- prune: delete duplicates + content violations from what's left ---
    let remaining = entries.filter((e) => !deleted.has(e.item_id));
    const removals = prunePlanRemovals(remaining, { duplicates: true, content: true }, info, rules);
    n = 0;
    for (const [e, reason] of removals) {
      send('prune', `Prune: removing ${++n}/${removals.length}…`);
      await yt.deleteItem(e.item_id, token);
      deleted.add(e.item_id);
      await store.appendAudit({
        playlistId, action: 'prune_delete', videoId: e.video_id,
        contributorAvatar: null, reason, detail: null,
      });
    }
    send('prune', `Prune: ${removals.length} removed`);

    // --- shuffle: reorder the survivors ---
    remaining = remaining.filter((e) => !deleted.has(e.item_id));
    let reordered = 0;
    if (shuffleOn && remaining.length > 1) {
      const order = planShuffle(remaining);
      n = 0;
      for (const [pos, it] of order.entries()) {
        send('shuffle', `Shuffle: ${++n}/${order.length}…`);
        await yt.setPosition(it, pos, playlistId, token);
      }
      reordered = order.length;
      await store.appendAudit({
        playlistId, action: 'shuffle', videoId: null,
        contributorAvatar: null, reason: null, detail: `reordered ${reordered}`,
      });
    }

    await store.addJob({
      id: crypto.randomUUID(), command: 'run_all', playlistId,
      apply: true, status: 'done', result: `cap ${surplus.length}, prune ${removals.length}, shuffle ${reordered}`,
    });
    send('done', `✓ cap ${surplus.length} · prune ${removals.length} · shuffle ${reordered}`);
  } catch (e) {
    const msg = e instanceof yt.YtApiError ? e.message : e instanceof Error ? e.message : 'failed';
    send('error', `Stopped: ${msg}`);
    try {
      await store.addJob({
        id: crypto.randomUUID(), command: 'run_all', playlistId,
        apply: true, status: 'error', result: msg,
      });
    } catch {
      /* ignore */
    }
  }
}

// --- auto-pilot ---------------------------------------------------------------

const AUTOPILOT_ALARM = 'ytpl-autopilot';

/** Hourly tick: notify for every playlist whose maintenance interval elapsed. */
async function autoPilotTick(): Promise<void> {
  const [playlists, jobs, notified] = await Promise.all([
    store.getPlaylists(),
    store.getJobs(),
    store.getAutoNotify(),
  ]);
  const due = dueForNotification(playlists, lastRunByPlaylist(jobs, playlists), notified, Date.now());
  if (due.length === 0) return;
  await store.markAutoNotified(
    due.map((d) => d.id),
    Date.now(),
  );
  for (const d of due) {
    await browser.notifications.create(`ytpl-due-${d.id}`, {
      type: 'basic',
      iconUrl: 'icons/icon-128.png',
      title: 'Playlist maintenance due',
      message: `"${d.title || d.id}" — no maintenance for ${d.daysSinceRun} day(s).`,
      buttons: [{ title: 'Run maintenance' }, { title: 'Open playlist' }],
      priority: 1,
    });
  }
}

/** Run the chain without a page port; report the outcome as a notification. */
async function runPipelineHeadless(playlistId: string): Promise<void> {
  const sink: { last: string; postMessage(m: unknown): void } = {
    last: '',
    postMessage(m: unknown) {
      if (isRecord(m) && typeof m.text === 'string') this.last = m.text;
    },
  };
  await runPipeline(playlistId, sink);
  await browser.notifications.create(`ytpl-done-${playlistId}`, {
    type: 'basic',
    iconUrl: 'icons/icon-128.png',
    title: 'Playlist maintenance',
    message: sink.last || 'finished',
    priority: 0,
  });
}

function openPlaylist(playlistId: string): Promise<unknown> {
  return browser.tabs.create({ url: `https://www.youtube.com/playlist?list=${playlistId}` });
}

export default defineBackground(() => {
  void browser.alarms.create(AUTOPILOT_ALARM, { periodInMinutes: 60 });

  browser.runtime.onConnect.addListener((port) => {
    if (port.name !== RUN_PORT) return;
    port.onMessage.addListener((msg: unknown) => {
      if (isRecord(msg) && typeof msg.playlistId === 'string' && msg.playlistId) {
        void runPipeline(msg.playlistId, port);
      }
    });
  });

  browser.alarms.onAlarm.addListener((alarm) => {
    if (alarm.name === AUTOPILOT_ALARM) void autoPilotTick();
  });

  browser.notifications.onClicked.addListener((notifId) => {
    void browser.notifications.clear(notifId);
    const pid = notifId.replace(/^ytpl-(due|done)-/, '');
    if (pid !== notifId) void openPlaylist(pid);
  });

  browser.notifications.onButtonClicked.addListener((notifId, buttonIndex) => {
    void browser.notifications.clear(notifId);
    const pid = notifId.replace(/^ytpl-due-/, '');
    if (pid === notifId) return;
    if (buttonIndex === 0) void runPipelineHeadless(pid);
    else void openPlaylist(pid);
  });
});
