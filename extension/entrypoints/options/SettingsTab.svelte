<script lang="ts">
  import { onMount } from 'svelte';

  import * as session from '@/utils/session.ts';

  let { flash }: { flash: (message: string) => void } = $props();

  let clientId = $state('');
  let redirect = $state('');
  let signedIn = $state(false);

  onMount(async () => {
    try {
      clientId = await session.getClientId();
      signedIn = await session.isSignedIn();
      redirect = session.redirectUri();
    } catch {
      /* identity/storage only exist in the extension runtime */
    }
  });

  async function saveClientId(): Promise<void> {
    await session.setClientId(clientId);
    flash('Client id saved');
  }
  async function doSignIn(): Promise<void> {
    try {
      const t = await session.signIn(true);
      signedIn = t !== null;
      flash(t ? 'Signed in' : 'Sign-in cancelled');
    } catch (e) {
      flash(e instanceof Error ? e.message : 'Sign-in failed');
    }
  }
  async function doSignOut(): Promise<void> {
    await session.signOut();
    signedIn = false;
    flash('Signed out');
  }
</script>

<div class="card">
  <h2 style="font-size:16px;margin:0 0 8px">Google sign-in</h2>
  <p class="muted">
    Needed for the maintenance chain (checks, cap, prune, shuffle) — that runs from the
    <strong>“Run maintenance"</strong> button on a YouTube playlist page. Results land in the Log.
  </p>

  <div class="lbl">Google OAuth client id (Web application)</div>
  <input type="text" bind:value={clientId} placeholder="…apps.googleusercontent.com" />
  <p class="muted" style="margin-top:6px">
    Register this redirect URI on the client:<br />
    <span class="mono">{redirect || '(open as an installed extension to see the redirect URI)'}</span>
  </p>
  <div class="row" style="margin-top:8px">
    <button class="btn secondary" onclick={saveClientId}>Save client id</button>
    {#if signedIn}
      <span class="pill">signed in</span>
      <button class="btn secondary" onclick={doSignOut}>Sign out</button>
    {:else}
      <button class="btn" onclick={doSignIn}>Sign in with Google</button>
    {/if}
  </div>
</div>
