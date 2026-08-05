<script lang="ts">
  import { onMount } from 'svelte';

  import * as session from '@/utils/session.ts';

  let { flash }: { flash: (message: string) => void } = $props();

  let signedIn = $state(false);

  onMount(async () => {
    try {
      signedIn = await session.isSignedIn();
    } catch {
      /* identity/storage only exist in the extension runtime */
    }
  });

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
  <div class="row">
    {#if signedIn}
      <span class="pill">signed in</span>
      <button class="btn secondary" onclick={doSignOut}>Sign out</button>
    {:else}
      <button class="btn" onclick={doSignIn}>Sign in with Google</button>
    {/if}
  </div>
</div>
