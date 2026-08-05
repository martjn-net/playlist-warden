/**
 * Message contract between the on-page content script and the background
 * service worker. The maintenance chain (checks → cap → prune → shuffle) runs
 * in the background (MV3 content scripts can't do cross-origin Data API fetches
 * and have no `identity` access); progress is streamed back over a Port so the
 * page button can narrate each step.
 */

export const RUN_PORT = 'ytpl-run';

/** content → background: run the full maintenance chain for this playlist. */
export interface RunRequest {
  playlistId: string;
}

export type RunPhase = 'checks' | 'cap' | 'prune' | 'shuffle' | 'done' | 'error';

/** background → content: one progress update; `text` is shown on the button. */
export interface RunProgress {
  phase: RunPhase;
  text: string;
}
