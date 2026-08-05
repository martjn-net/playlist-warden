<script lang="ts">
  import { store } from '@/utils/store.ts';
  import { DEFAULT_CONTENT_RULES, type ContentRules, type StoreData } from '@/utils/schema.ts';

  let {
    data,
    reload,
    flash,
    selectedPid = $bindable(''),
  }: {
    data: StoreData;
    reload: () => Promise<void>;
    flash: (message: string) => void;
    selectedPid?: string;
  } = $props();

  // Flat editable model (arrays as comma/newline text) for the selected playlist.
  interface RuleEdit {
    require_music_category: boolean;
    block_age_restricted: boolean;
    allow_topics: string;
    deny_topics: string;
    title_blocklist: string;
    deny_channels: string;
    max_duration_seconds: number;
    min_duration_seconds: number;
    block_if_region_blocked: string;
  }

  let ruleEdit = $state<RuleEdit | null>(null);

  const playlists = $derived(Object.values(data.playlists));
  const contributorCount = $derived(selectedPid ? new Set(Object.values(data.adderMap[selectedPid] ?? {})).size : 0);
  const attributedCount = $derived(selectedPid ? Object.keys(data.adderMap[selectedPid] ?? {}).length : 0);

  // Rebuild the editable model whenever the selected playlist (or its stored
  // rules) changes; editing the fields does not retrigger this.
  $effect(() => {
    if (!selectedPid) {
      ruleEdit = null;
      return;
    }
    const r = data.rules[selectedPid] ?? DEFAULT_CONTENT_RULES;
    ruleEdit = {
      require_music_category: r.require_music_category,
      block_age_restricted: r.block_age_restricted,
      allow_topics: r.allow_topics.join(', '),
      deny_topics: r.deny_topics.join(', '),
      title_blocklist: r.title_blocklist.join(', '),
      deny_channels: r.deny_channels.join(', '),
      max_duration_seconds: r.max_duration_seconds,
      min_duration_seconds: r.min_duration_seconds,
      block_if_region_blocked: r.block_if_region_blocked,
    };
  });

  function toList(value: string): string[] {
    return value
      .split(/[\n,]+/)
      .map((x) => x.trim())
      .filter((x) => x !== '');
  }

  async function saveRules(): Promise<void> {
    if (!ruleEdit || !selectedPid) return;
    const rules: ContentRules = {
      require_music_category: ruleEdit.require_music_category,
      block_age_restricted: ruleEdit.block_age_restricted,
      allow_topics: toList(ruleEdit.allow_topics),
      deny_topics: toList(ruleEdit.deny_topics),
      title_blocklist: toList(ruleEdit.title_blocklist),
      deny_channels: toList(ruleEdit.deny_channels),
      max_duration_seconds: Number(ruleEdit.max_duration_seconds) || 0,
      min_duration_seconds: Number(ruleEdit.min_duration_seconds) || 0,
      block_if_region_blocked: ruleEdit.block_if_region_blocked.trim(),
    };
    await store.setRules(selectedPid, rules);
    await reload();
    flash('Rules saved');
  }

  function resetRules(): void {
    ruleEdit = {
      require_music_category: DEFAULT_CONTENT_RULES.require_music_category,
      block_age_restricted: DEFAULT_CONTENT_RULES.block_age_restricted,
      allow_topics: '',
      deny_topics: '',
      title_blocklist: '',
      deny_channels: '',
      max_duration_seconds: 0,
      min_duration_seconds: 0,
      block_if_region_blocked: '',
    };
  }
</script>

<div class="card">
  <div class="lbl">Playlist</div>
  <select bind:value={selectedPid}>
    {#each playlists as p (p.id)}
      <option value={p.id}>{p.title ? p.title + ' — ' : ''}{p.id}</option>
    {/each}
  </select>
</div>

{#if !selectedPid || !ruleEdit}
  <p class="muted">Add a playlist first (Playlists tab).</p>
{:else}
  <div class="card">
    <p class="muted">Content rules decide which entries the content check flags. Empty lists = rule off. Comma- or newline-separated.</p>
    <div><input type="checkbox" bind:checked={ruleEdit.require_music_category} /> require music category (YouTube category 10)</div>
    <div><input type="checkbox" bind:checked={ruleEdit.block_age_restricted} /> flag age-restricted</div>

    <div class="lbl">Allowed topics/genres (allowlist — only these pass)</div>
    <input type="text" bind:value={ruleEdit.allow_topics} placeholder="e.g. Rock music, Pop music" />

    <div class="lbl">Denied topics/genres</div>
    <input type="text" bind:value={ruleEdit.deny_topics} />

    <div class="lbl">Title blocklist (keywords in title/tags)</div>
    <input type="text" bind:value={ruleEdit.title_blocklist} placeholder="e.g. live, remix" />

    <div class="lbl">Denied channels (channelId or name substring)</div>
    <input type="text" bind:value={ruleEdit.deny_channels} />

    <div class="row">
      <div>
        <div class="lbl">Max duration (seconds, 0 = off)</div>
        <input type="number" min="0" bind:value={ruleEdit.max_duration_seconds} />
      </div>
      <div>
        <div class="lbl">Min duration (seconds, 0 = off)</div>
        <input type="number" min="0" bind:value={ruleEdit.min_duration_seconds} />
      </div>
      <div>
        <div class="lbl">Block if region-blocked in (country code)</div>
        <input type="text" bind:value={ruleEdit.block_if_region_blocked} placeholder="e.g. DE" />
      </div>
    </div>

    <div class="row" style="margin-top:12px">
      <button class="btn" onclick={saveRules}>Save rules</button>
      <button class="btn secondary" onclick={resetRules}>Reset to defaults</button>
      <span class="muted">{contributorCount} contributors · {attributedCount} videos attributed</span>
    </div>
  </div>
{/if}
