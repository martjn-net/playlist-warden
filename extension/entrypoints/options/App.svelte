<script lang="ts">
  import { onMount } from 'svelte';

  import { store } from '@/utils/store.ts';
  import type { StoreData } from '@/utils/schema.ts';
  import LogTab from './LogTab.svelte';
  import LoginTab from './LoginTab.svelte';
  import PlaylistsTab from './PlaylistsTab.svelte';
  import RulesTab from './RulesTab.svelte';

  type Tab = 'login' | 'playlists' | 'rules' | 'log';

  let tab = $state<Tab>('playlists');
  let data = $state<StoreData | null>(null);
  let selectedPid = $state('');
  let status = $state('');

  function flash(message: string): void {
    status = message;
    setTimeout(() => {
      if (status === message) status = '';
    }, 2500);
  }

  async function reload(): Promise<void> {
    const next = await store.getAll();
    const ids = Object.keys(next.playlists);
    if (!selectedPid || !next.playlists[selectedPid]) selectedPid = ids[0] ?? '';
    data = next;
  }

  onMount(reload);
</script>

<div class="wrap">
  <h1>Playlist Warden <span class="muted" style="font-size:14px;font-weight:400">for YouTube</span></h1>
  <p class="muted">Fair caps, cleanup &amp; shuffle for shared playlists — all data stays in this browser profile.</p>

  <div class="tabs">
    <button class:active={tab === 'playlists'} onclick={() => (tab = 'playlists')}>Playlists</button>
    <button class:active={tab === 'rules'} onclick={() => (tab = 'rules')}>Rules</button>
    <button class:active={tab === 'log'} onclick={() => (tab = 'log')}>Log</button>
    <button class:active={tab === 'login'} onclick={() => (tab = 'login')}>Login</button>
  </div>

  {#if !data}
    <p class="muted">Loading…</p>
  {:else if tab === 'playlists'}
    <PlaylistsTab {data} {reload} {flash} />
  {:else if tab === 'rules'}
    <RulesTab {data} {reload} {flash} bind:selectedPid />
  {:else if tab === 'log'}
    <LogTab {data} />
  {:else if tab === 'login'}
    <LoginTab {flash} />
  {/if}
</div>

{#if status}
  <div class="status">{status}</div>
{/if}
