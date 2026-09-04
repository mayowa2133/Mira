import { describe, expect, it } from 'vitest';
import {
  EMPTY_QUEUE,
  MAX_ATTEMPTS,
  OFFLINE_RETRY_MS,
  backoffMs,
  collectable,
  enqueue,
  inFlight,
  markFailure,
  markImported,
  markUploaded,
  markUploading,
  nextRunnable,
  basename,
  rehydrate,
  remove,
  retry,
  type QueueState,
} from './queue-core';

const T0 = 1_000_000;

function withCapture(state: QueueState, id: string, now = T0): QueueState {
  return enqueue(state, {
    id,
    fileName: `${id}.jpg`,
    source: 'camera',
    idempotencyKey: `idem-${id}`,
    now,
  });
}

describe('enqueue', () => {
  it('records a capture as pending and immediately runnable', () => {
    const state = withCapture(EMPTY_QUEUE, 'a');

    expect(state.entries).toHaveLength(1);
    expect(state.entries[0]).toMatchObject({
      status: 'pending',
      attempts: 0,
      uploadKey: null,
      garmentId: null,
    });
    expect(nextRunnable(state, T0)?.id).toBe('a');
  });
});

describe('nextRunnable', () => {
  it('drains oldest first, so a photo taken before a tunnel is not stranded', () => {
    let state = withCapture(EMPTY_QUEUE, 'older', T0);
    state = withCapture(state, 'newer', T0 + 5_000);

    expect(nextRunnable(state, T0 + 10_000)?.id).toBe('older');
  });

  it('respects the backoff window', () => {
    let state = withCapture(EMPTY_QUEUE, 'a');
    state = markFailure(state, 'a', { now: T0, error: 'offline', retryable: true });

    expect(nextRunnable(state, T0)).toBeNull();
    expect(nextRunnable(state, T0 + backoffMs(1))?.id).toBe('a');
  });

  it('ignores completed and permanently failed work', () => {
    let state = withCapture(EMPTY_QUEUE, 'done');
    state = markImported(state, 'done', 'garment-1');

    state = withCapture(state, 'broken', T0);
    state = markFailure(state, 'broken', {
      now: T0,
      error: 'unsupported_image_format',
      retryable: false,
    });

    expect(nextRunnable(state, T0 + 1_000_000)).toBeNull();
  });
});

describe('failure handling', () => {
  it('backs off exponentially and gives up after MAX_ATTEMPTS', () => {
    let state = withCapture(EMPTY_QUEUE, 'a');

    for (let attempt = 1; attempt < MAX_ATTEMPTS; attempt += 1) {
      state = markFailure(state, 'a', { now: T0, error: 'network', retryable: true });
      expect(state.entries[0]?.status).toBe('pending');
    }

    state = markFailure(state, 'a', { now: T0, error: 'network', retryable: true });
    expect(state.entries[0]?.status).toBe('failed');
    expect(state.entries[0]?.attempts).toBe(MAX_ATTEMPTS);
  });

  it('gives up immediately on an error that retrying cannot fix', () => {
    let state = withCapture(EMPTY_QUEUE, 'a');
    state = markFailure(state, 'a', {
      now: T0,
      error: 'unsupported_image_format',
      retryable: false,
    });

    expect(state.entries[0]?.status).toBe('failed');
    expect(state.entries[0]?.attempts).toBe(1);
  });

  it('never deletes the local file of a failed capture', () => {
    let state = withCapture(EMPTY_QUEUE, 'a');
    state = markFailure(state, 'a', { now: T0, error: 'boom', retryable: false });

    // The photograph is the thing the user cares about: a failed upload must
    // not become lost data.
    expect(collectable(state)).toEqual([]);
    expect(state.entries[0]?.fileName).toBe('a.jpg');
  });

  it('lets a user retry deliberately, clearing the backoff', () => {
    let state = withCapture(EMPTY_QUEUE, 'a');
    state = markFailure(state, 'a', { now: T0, error: 'nope', retryable: false });
    state = retry(state, 'a', T0 + 500);

    expect(state.entries[0]).toMatchObject({ status: 'pending', attempts: 0, lastError: null });
    expect(nextRunnable(state, T0 + 500)?.id).toBe('a');
  });
});

describe('backoffMs', () => {
  it('grows and then holds at a minute', () => {
    expect(backoffMs(1)).toBe(2_000);
    expect(backoffMs(2)).toBe(4_000);
    expect(backoffMs(3)).toBe(8_000);
    expect(backoffMs(20)).toBe(60_000);
  });
});

describe('surviving app kill', () => {
  it('returns interrupted work to pending on rehydrate', () => {
    let state = withCapture(EMPTY_QUEUE, 'mid-upload');
    state = markUploading(state, 'mid-upload');

    // The app dies here. This is what is read back from disk.
    const restored = rehydrate(state, T0 + 60_000);

    expect(restored.entries[0]?.status).toBe('pending');
    expect(nextRunnable(restored, T0 + 60_000)?.id).toBe('mid-upload');
  });

  it('resumes an interrupted import without losing the upload key', () => {
    let state = withCapture(EMPTY_QUEUE, 'mid-import');
    state = markUploaded(state, 'mid-import', 'garments/u/1/original.jpg');

    const restored = rehydrate(state, T0 + 60_000);

    expect(restored.entries[0]?.status).toBe('pending');
    // The bytes are already up; re-uploading them would be waste, and the
    // stable idempotency key is what makes replaying the import safe.
    expect(restored.entries[0]?.uploadKey).toBe('garments/u/1/original.jpg');
    expect(restored.entries[0]?.idempotencyKey).toBe('idem-mid-import');
  });

  it('leaves finished and failed entries alone', () => {
    let state = withCapture(EMPTY_QUEUE, 'done');
    state = markImported(state, 'done', 'g1');
    state = withCapture(state, 'failed', T0);
    state = markFailure(state, 'failed', { now: T0, error: 'x', retryable: false });

    const restored = rehydrate(state, T0 + 1000);

    expect(restored.entries.find((e) => e.id === 'done')?.status).toBe('done');
    expect(restored.entries.find((e) => e.id === 'failed')?.status).toBe('failed');
  });
});

describe('lifecycle', () => {
  it('walks a capture from pending to done', () => {
    let state = withCapture(EMPTY_QUEUE, 'a');
    state = markUploading(state, 'a');
    state = markUploaded(state, 'a', 'garments/u/a/original.jpg');
    state = markImported(state, 'a', 'garment-7');

    expect(state.entries[0]).toMatchObject({ status: 'done', garmentId: 'garment-7' });
    expect(collectable(state).map((e) => e.id)).toEqual(['a']);
    expect(inFlight(state)).toEqual([]);
  });

  it('reports everything still owed to the user', () => {
    let state = withCapture(EMPTY_QUEUE, 'a');
    state = withCapture(state, 'b', T0 + 1);
    state = markImported(state, 'a', 'g1');

    expect(inFlight(state).map((e) => e.id)).toEqual(['b']);
  });

  it('removes an entry entirely', () => {
    const state = remove(withCapture(EMPTY_QUEUE, 'a'), 'a');
    expect(state.entries).toEqual([]);
  });

  it('ignores updates for an unknown id rather than inventing an entry', () => {
    const state = markFailure(EMPTY_QUEUE, 'ghost', {
      now: T0,
      error: 'x',
      retryable: true,
    });
    expect(state.entries).toEqual([]);
  });
});

describe('offline is not failure', () => {
  /**
   * The bug this pins: backoff burned all six attempts in about a minute, so a
   * capture taken on a plane gave up long before landing and then needed a
   * manual tap. The exit criterion is that it uploads on reconnect, by itself.
   */
  it('never gives up while merely offline', () => {
    let state = withCapture(EMPTY_QUEUE, 'a');
    let now = T0;

    // Twenty minutes of no connectivity — far past MAX_ATTEMPTS.
    for (let i = 0; i < 200; i += 1) {
      state = markFailure(state, 'a', {
        now,
        error: "You're offline.",
        retryable: true,
        offline: true,
      });
      now += 6_000;
    }

    expect(state.entries[0]?.status).toBe('pending');
    expect(state.entries[0]?.attempts).toBe(0);
    expect(nextRunnable(state, now)?.id).toBe('a');
  });

  it('re-checks soon after connectivity returns, not after a long backoff', () => {
    let state = withCapture(EMPTY_QUEUE, 'a');
    state = markFailure(state, 'a', {
      now: T0,
      error: 'offline',
      retryable: true,
      offline: true,
    });

    expect(nextRunnable(state, T0 + OFFLINE_RETRY_MS)?.id).toBe('a');
  });

  it('still gives up on a server that keeps rejecting the request', () => {
    // Offline must not become a blanket excuse: a genuine server failure still
    // exhausts its attempts.
    let state = withCapture(EMPTY_QUEUE, 'a');
    for (let i = 0; i < MAX_ATTEMPTS; i += 1) {
      state = markFailure(state, 'a', { now: T0, error: 'server error', retryable: true });
    }
    expect(state.entries[0]?.status).toBe('failed');
  });

  it('keeps the photo when offline attempts are interleaved with real failures', () => {
    let state = withCapture(EMPTY_QUEUE, 'a');
    state = markFailure(state, 'a', { now: T0, error: 'server', retryable: true });
    state = markFailure(state, 'a', { now: T0, error: 'offline', retryable: true, offline: true });

    // The offline round did not advance the count.
    expect(state.entries[0]?.attempts).toBe(1);
    expect(state.entries[0]?.status).toBe('pending');
  });
});

describe('paths survive an app update', () => {
  /**
   * iOS changes the data-container UUID on reinstall. An absolute path stored
   * before an update points at nothing afterwards, and the queue concludes the
   * photograph was deleted — while it sits in the new container untouched.
   * That is how a capture gets orphaned across an app update (REL-2).
   */
  it('repairs an absolute URI written by an older build', () => {
    const stale: QueueState = {
      entries: [
        {
          id: 'a',
          fileName:
            'file:///var/mobile/Containers/Data/Application/OLD-UUID/Documents/captures/a.jpg',
          source: 'camera',
          status: 'pending',
          attempts: 0,
          uploadKey: null,
          idempotencyKey: 'capture-a',
          garmentId: null,
          createdAt: T0,
          nextAttemptAt: T0,
          lastError: null,
        },
      ],
    };

    expect(rehydrate(stale, T0).entries[0]?.fileName).toBe('a.jpg');
  });

  it('leaves a relative name alone', () => {
    const state = rehydrate(withCapture(EMPTY_QUEUE, 'a'), T0);
    expect(state.entries[0]?.fileName).toBe('a.jpg');
  });
});

describe('basename', () => {
  it('takes the last path segment', () => {
    expect(basename('file:///a/b/c.jpg')).toBe('c.jpg');
    expect(basename('c.jpg')).toBe('c.jpg');
  });

  it('drops a query string', () => {
    expect(basename('file:///a/c.jpg?v=2')).toBe('c.jpg');
  });

  it('returns the input rather than an empty name', () => {
    expect(basename('')).toBe('');
  });
});
