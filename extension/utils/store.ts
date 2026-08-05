/**
 * Persistence for the extension — thin async wrappers over `wxt/storage`
 * (`browser.storage.local`). The data model + all validation live in
 * schema.ts (pure, unit-tested); this file only binds it to storage and adds
 * the small stateful operations (upsert/merge/append). Mirrors web/lib/store.php.
 *
 * Storage keys are versioned via defineItem so future shape changes migrate.
 */

import { storage } from 'wxt/utils/storage';

import {
  DEFAULT_CONTENT_RULES,
  emptyStore,
  mergeAdderMap,
  type AuditEntry,
  type ContentRules,
  type Job,
  type PlaylistMeta,
  type StoreData,
} from './schema.ts';

const playlistsItem = storage.defineItem<Record<string, PlaylistMeta>>('local:playlists', {
  fallback: {},
  version: 1,
});
const rulesItem = storage.defineItem<Record<string, ContentRules>>('local:rules', {
  fallback: {},
  version: 1,
});
const adderMapItem = storage.defineItem<Record<string, Record<string, string>>>('local:adderMap', {
  fallback: {},
  version: 1,
});
const auditItem = storage.defineItem<AuditEntry[]>('local:audit', { fallback: [], version: 1 });
const jobsItem = storage.defineItem<Job[]>('local:jobs', { fallback: [], version: 1 });
// Auto-pilot: playlistId -> last notification timestamp (ms), prevents re-alert spam.
const autoNotifyItem = storage.defineItem<Record<string, number>>('local:autoNotify', { fallback: {}, version: 1 });

const AUDIT_CAP = 500; // keep the newest N entries
const JOB_CAP = 200;

function nowIso(): string {
  return new Date().toISOString();
}

export const store = {
  // --- playlists ------------------------------------------------------------
  async getPlaylists(): Promise<Record<string, PlaylistMeta>> {
    return playlistsItem.getValue();
  },

  /** Insert or merge a playlist; preserves existing cap/shuffle/privacy. */
  async upsertPlaylist(patch: Partial<PlaylistMeta> & { id: string }): Promise<void> {
    const all = await playlistsItem.getValue();
    const prev = all[patch.id];
    all[patch.id] = {
      id: patch.id,
      title: patch.title ?? prev?.title ?? '',
      privacy: patch.privacy ?? prev?.privacy ?? '',
      cap: patch.cap ?? prev?.cap ?? 0,
      shuffle: patch.shuffle ?? prev?.shuffle ?? false,
      autoIntervalDays: patch.autoIntervalDays ?? prev?.autoIntervalDays ?? 0,
      updatedAt: nowIso(),
    };
    await playlistsItem.setValue(all);
  },

  async removePlaylist(id: string): Promise<void> {
    const [pl, rl, am, an] = await Promise.all([
      playlistsItem.getValue(),
      rulesItem.getValue(),
      adderMapItem.getValue(),
      autoNotifyItem.getValue(),
    ]);
    delete pl[id];
    delete rl[id];
    delete am[id];
    delete an[id];
    await Promise.all([
      playlistsItem.setValue(pl),
      rulesItem.setValue(rl),
      adderMapItem.setValue(am),
      autoNotifyItem.setValue(an),
    ]);
  },

  // --- rules ----------------------------------------------------------------
  async getRules(playlistId: string): Promise<ContentRules> {
    const all = await rulesItem.getValue();
    return all[playlistId] ?? { ...DEFAULT_CONTENT_RULES };
  },

  async setRules(playlistId: string, rules: ContentRules): Promise<void> {
    const all = await rulesItem.getValue();
    all[playlistId] = rules;
    await rulesItem.setValue(all);
  },

  // --- adder map ------------------------------------------------------------
  async getAdderMap(playlistId: string): Promise<Record<string, string>> {
    const all = await adderMapItem.getValue();
    return all[playlistId] ?? {};
  },

  /** Merge captured {videoId: avatarPhotoId} into a playlist's map. */
  async mergeAdders(playlistId: string, incoming: Record<string, string>): Promise<number> {
    const all = await adderMapItem.getValue();
    all[playlistId] = mergeAdderMap(all[playlistId] ?? {}, incoming);
    await adderMapItem.setValue(all);
    return Object.keys(all[playlistId]).length;
  },

  // --- audit ----------------------------------------------------------------
  async getAudit(): Promise<AuditEntry[]> {
    return auditItem.getValue();
  },

  async appendAudit(entry: Omit<AuditEntry, 'ts'> & { ts?: string }): Promise<void> {
    const all = await auditItem.getValue();
    all.unshift({ ...entry, ts: entry.ts ?? nowIso() });
    await auditItem.setValue(all.slice(0, AUDIT_CAP));
  },

  // --- jobs -----------------------------------------------------------------
  async getJobs(): Promise<Job[]> {
    return jobsItem.getValue();
  },

  async addJob(job: Omit<Job, 'createdAt'> & { createdAt?: string }): Promise<void> {
    const all = await jobsItem.getValue();
    all.unshift({ ...job, createdAt: job.createdAt ?? nowIso() });
    await jobsItem.setValue(all.slice(0, JOB_CAP));
  },

  async updateJob(id: string, patch: Partial<Job>): Promise<void> {
    const all = await jobsItem.getValue();
    const current = all.find((j) => j.id === id);
    if (current) {
      Object.assign(current, patch, { id: current.id });
      await jobsItem.setValue(all);
    }
  },

  // --- auto-pilot notify state -------------------------------------------------
  async getAutoNotify(): Promise<Record<string, number>> {
    return autoNotifyItem.getValue();
  },

  async markAutoNotified(ids: string[], at: number): Promise<void> {
    if (ids.length === 0) return;
    const m = await autoNotifyItem.getValue();
    for (const id of ids) m[id] = at;
    await autoNotifyItem.setValue(m);
  },

  // --- bulk read (for the options UI) ---------------------------------------
  async getAll(): Promise<StoreData> {
    const [playlists, rules, adderMap, audit, jobs] = await Promise.all([
      playlistsItem.getValue(),
      rulesItem.getValue(),
      adderMapItem.getValue(),
      auditItem.getValue(),
      jobsItem.getValue(),
    ]);
    const out = emptyStore();
    return { ...out, playlists, rules, adderMap, audit, jobs };
  },
};
