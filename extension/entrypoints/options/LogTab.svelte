<script lang="ts">
  import type { StoreData } from '@/utils/schema.ts';

  let { data }: { data: StoreData } = $props();
</script>

<div class="card">
  <h2 style="font-size:16px;margin:0 0 8px">Audit ({data.audit.length})</h2>
  {#if data.audit.length === 0}
    <p class="muted">No writes recorded yet.</p>
  {:else}
    <table>
      <thead><tr><th>Time</th><th>Playlist</th><th>Action</th><th>Video</th><th>Reason</th></tr></thead>
      <tbody>
        {#each data.audit.slice(0, 100) as a (a.ts + (a.videoId ?? ''))}
          <tr>
            <td class="mono">{a.ts.slice(0, 19).replace('T', ' ')}</td>
            <td class="mono">{a.playlistId}</td>
            <td>{a.action}</td>
            <td class="mono">{a.videoId ?? ''}</td>
            <td class="muted">{a.reason ?? ''}</td>
          </tr>
        {/each}
      </tbody>
    </table>
  {/if}
</div>
<div class="card">
  <h2 style="font-size:16px;margin:0 0 8px">Jobs ({data.jobs.length})</h2>
  {#if data.jobs.length === 0}
    <p class="muted">No jobs yet.</p>
  {:else}
    <table>
      <thead><tr><th>Created</th><th>Command</th><th>Playlist</th><th>Apply</th><th>Status</th></tr></thead>
      <tbody>
        {#each data.jobs.slice(0, 100) as j (j.id)}
          <tr>
            <td class="mono">{j.createdAt.slice(0, 19).replace('T', ' ')}</td>
            <td>{j.command}</td>
            <td class="mono">{j.playlistId ?? ''}</td>
            <td>{j.apply ? 'apply' : 'dry-run'}</td>
            <td>{j.status}</td>
          </tr>
        {/each}
      </tbody>
    </table>
  {/if}
</div>
