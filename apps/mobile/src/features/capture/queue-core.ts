/**
 * The upload queue's rules, with no platform in sight.
 *
 * Task 2.2 is "local-first capture + upload queue surviving app kill", and the
 * exit criterion is "airplane-mode capture uploads on reconnect". Both are
 * about what happens when things go wrong, which is exactly the part that
 * cannot be verified by taking a photo once on a good network.
 *
 * So the rules live here as pure functions over a serializable state, and the
 * platform bindings — camera, filesystem, fetch — stay in `queue.ts`. This file
 * is what the tests exercise.
 */

/** `docs/06-ai/image-processing.md` §6: the photo is written locally FIRST. */
export type CaptureStatus =
  | 'pending' // on disk, not yet uploaded
  | 'uploading'
  | 'importing' // bytes are up; the garment is being created
  | 'done'
  | 'failed'; // permanently, after retries

export type CaptureEntry = {
  id: string;
  /** Local file URI. The photograph, which we must not lose (REL-2). */
  localUri: string;
  source: 'camera' | 'photo_library';
  status: CaptureStatus;
  attempts: number;
  /** Set once the upload target has been issued, so a retry reuses it. */
  uploadKey: string | null;
  /** Stable across retries, so a retried import cannot double-create. */
  idempotencyKey: string;
  /** Set when the import succeeds — the optimistic tile's real identity. */
  garmentId: string | null;
  createdAt: number;
  /** Epoch ms; the entry is not eligible before this. */
  nextAttemptAt: number;
  lastError: string | null;
};

export type QueueState = { entries: CaptureEntry[] };

export const EMPTY_QUEUE: QueueState = { entries: [] };

/**
 * Give up after this many attempts.
 *
 * Failure here is not "the photo is gone" — a failed entry keeps its local file
 * and stays visible so the user can retry deliberately. It only stops the
 * automatic loop from retrying a genuinely broken upload forever.
 */
export const MAX_ATTEMPTS = 6;

/** Exponential with a ceiling: 2s, 4s, 8s, 16s, 32s, 60s. */
export function backoffMs(attempts: number): number {
  return Math.min(60_000, 2_000 * 2 ** Math.max(0, attempts - 1));
}

export function enqueue(
  state: QueueState,
  entry: Pick<CaptureEntry, 'id' | 'localUri' | 'source' | 'idempotencyKey'> & { now: number },
): QueueState {
  return {
    entries: [
      ...state.entries,
      {
        id: entry.id,
        localUri: entry.localUri,
        source: entry.source,
        status: 'pending',
        attempts: 0,
        uploadKey: null,
        idempotencyKey: entry.idempotencyKey,
        garmentId: null,
        createdAt: entry.now,
        nextAttemptAt: entry.now,
        lastError: null,
      },
    ],
  };
}

/**
 * What should be worked on next.
 *
 * Oldest first: a queue that drained newest-first would leave the photo taken
 * before a tunnel stranded behind every one taken after it.
 */
export function nextRunnable(state: QueueState, now: number): CaptureEntry | null {
  const candidates = state.entries
    .filter(
      (entry) =>
        (entry.status === 'pending' || entry.status === 'uploading' || entry.status === 'importing') &&
        entry.nextAttemptAt <= now,
    )
    .sort((a, b) => a.createdAt - b.createdAt);

  return candidates[0] ?? null;
}

function patch(state: QueueState, id: string, changes: Partial<CaptureEntry>): QueueState {
  return {
    entries: state.entries.map((entry) => (entry.id === id ? { ...entry, ...changes } : entry)),
  };
}

export function markUploading(state: QueueState, id: string): QueueState {
  return patch(state, id, { status: 'uploading' });
}

/** The bytes are in storage; the garment does not exist yet. */
export function markUploaded(state: QueueState, id: string, uploadKey: string): QueueState {
  return patch(state, id, { status: 'importing', uploadKey, lastError: null });
}

export function markImported(state: QueueState, id: string, garmentId: string): QueueState {
  return patch(state, id, { status: 'done', garmentId, lastError: null });
}

/**
 * A recoverable failure: back off and try again.
 *
 * `retryable: false` is for a server saying the request itself is wrong — a
 * rejected format, a key that will never be valid. Retrying that is just a
 * slower way to fail, and it keeps a broken entry churning the radio.
 */
export function markFailure(
  state: QueueState,
  id: string,
  options: { now: number; error: string; retryable: boolean },
): QueueState {
  const entry = state.entries.find((candidate) => candidate.id === id);
  if (!entry) return state;

  const attempts = entry.attempts + 1;
  const exhausted = !options.retryable || attempts >= MAX_ATTEMPTS;

  return patch(state, id, {
    attempts,
    lastError: options.error,
    status: exhausted ? 'failed' : 'pending',
    nextAttemptAt: exhausted ? entry.nextAttemptAt : options.now + backoffMs(attempts),
  });
}

/** Deliberate, user-initiated retry: clears the backoff and the failed state. */
export function retry(state: QueueState, id: string, now: number): QueueState {
  return patch(state, id, {
    status: 'pending',
    attempts: 0,
    nextAttemptAt: now,
    lastError: null,
  });
}

export function remove(state: QueueState, id: string): QueueState {
  return { entries: state.entries.filter((entry) => entry.id !== id) };
}

/**
 * Entries whose local file can be deleted.
 *
 * Only `done`. A failed entry keeps its file: the photograph is the thing the
 * user actually cares about, and deleting it because an upload failed would
 * turn a network problem into lost data (REL-2).
 */
export function collectable(state: QueueState): CaptureEntry[] {
  return state.entries.filter((entry) => entry.status === 'done');
}

/** Still owed to the user — drives the closet's optimistic tiles. */
export function inFlight(state: QueueState): CaptureEntry[] {
  return state.entries.filter((entry) => entry.status !== 'done');
}

/**
 * Reconcile state loaded from disk.
 *
 * An entry left `uploading` or `importing` was interrupted mid-flight — the app
 * was killed, or the process was suspended and never resumed. It is returned to
 * `pending` so the loop picks it up again. This is safe precisely because the
 * import carries a stable idempotency key: replaying it cannot create a second
 * garment.
 */
export function rehydrate(state: QueueState, now: number): QueueState {
  return {
    entries: state.entries.map((entry) =>
      entry.status === 'uploading' || entry.status === 'importing'
        ? { ...entry, status: 'pending', nextAttemptAt: now }
        : entry,
    ),
  };
}
