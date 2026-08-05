<script lang="ts">
  import { store } from '@/utils/store.ts';
  import type { PlaylistMeta, StoreData } from '@/utils/schema.ts';

  let {
    data,
    reload,
    flash,
  }: { data: StoreData; reload: () => Promise<void>; flash: (message: string) => void } = $props();

  let newPlaylist = $state('');
  const playlists = $derived(Object.values(data.playlists));

  function listId(input: string): string {
    const match = input.match(/[?&]list=([^&#]+)/);
    const id = match?.[1];
    return (id !== undefined ? decodeURIComponent(id) : input).trim();
  }

  async function addPlaylist(): Promise<void> {
    const id = listId(newPlaylist);
    if (!id) return;
    await store.upsertPlaylist({ id });
    newPlaylist = '';
    await reload();
    flash('Playlist added');
  }

  async function savePlaylist(p: PlaylistMeta): Promise<void> {
    await store.upsertPlaylist({
      id: p.id,
      title: p.title,
      privacy: p.privacy,
      cap: Number(p.cap) || 0,
      shuffle: p.shuffle,
    });
    flash('Saved ' + p.id);
  }

  async function removePlaylist(id: string): Promise<void> {
    if (!confirm('Remove ' + id + ' from management? (The YouTube playlist is not touched.)')) return;
    await store.removePlaylist(id);
    await reload();
    flash('Removed');
  }
</script>

<div class="card">
  <div class="row">
    <input
      class="grow"
      type="text"
      placeholder="Playlist URL or id (…/playlist?list=PL… or PL…)"
      bind:value={newPlaylist}
    />
    <button class="btn" onclick={addPlaylist}>Add</button>
  </div>
</div>

{#if playlists.length === 0}
  <p class="muted">No managed playlists yet. Add one above, or open a playlist on YouTube and use the extension button to capture its adder map.</p>
{/if}

{#each playlists as p (p.id)}
  <div class="card">
    <div class="row">
      <strong class="grow mono">{p.id}</strong>
      <span class="pill">{new Set(Object.values(data.adderMap[p.id] ?? {})).size} contributors · {Object.keys(data.adderMap[p.id] ?? {}).length} attributed</span>
      <a class="pill" href={'https://www.youtube.com/playlist?list=' + p.id} target="_blank" rel="noreferrer">open ↗</a>
    </div>
    <div class="lbl">Title</div>
    <input type="text" bind:value={p.title} />
    <div class="row">
      <div>
        <div class="lbl">Cap per contributor (0 = none)</div>
        <input type="number" min="0" bind:value={p.cap} />
      </div>
      <div>
        <div class="lbl">Privacy</div>
        <input type="text" bind:value={p.privacy} placeholder="public / unlisted / private" />
      </div>
    </div>
    <label class="row" style="margin-top:10px;cursor:pointer;gap:6px">
      <input type="checkbox" bind:checked={p.shuffle} />
      <span>Shuffle on “Run maintenance”</span>
    </label>
    <div class="row" style="margin-top:10px">
      <button class="btn" onclick={() => savePlaylist(p)}>Save</button>
      <button class="btn danger" onclick={() => removePlaylist(p.id)}>Remove</button>
    </div>
  </div>
{/each}
