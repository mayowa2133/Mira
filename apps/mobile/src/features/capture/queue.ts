/**
 * The upload queue, bound to the device.
 *
 * Rules live in `queue-core.ts`; this file is the part that touches disk, the
 * network and React. It persists after every transition, because the whole
 * point of task 2.2 is surviving an app kill that can happen between any two
 * lines here.
 */
import { useCallback, useEffect, useMemo, useRef, useSyncExternalStore } from 'react';
import { AppState, type AppStateStatus } from 'react-native';
import { Directory, File, Paths } from 'expo-file-system';
import { ApiError, request } from '@/lib/api';
import { CAPTURE_DIR } from './preprocess-core';
import { discardCapture } from './preprocess';
import {
  EMPTY_QUEUE,
  enqueue as enqueueEntry,
  collectable,
  inFlight,
  markFailure,
  markImported,
  markUploaded,
  markUploading,
  nextRunnable,
  rehydrate,
  remove,
  retry as retryEntry,
  type CaptureEntry,
  type QueueState,
} from './queue-core';

const MANIFEST = 'capture-queue.json';

type UploadTarget = { upload_url: string; upload_key: string; expires_at: string };
type PhotoImportResponse = { garment_id: string; garment_image_id: string; job_id: string };

function manifestFile(): File {
  const directory = new Directory(Paths.document, CAPTURE_DIR);
  if (!directory.exists) directory.create({ intermediates: true });
  return new File(directory, MANIFEST);
}

function load(): QueueState {
  try {
    const file = manifestFile();
    if (!file.exists) return EMPTY_QUEUE;
    const parsed = JSON.parse(file.textSync()) as QueueState;
    // Anything mid-flight when the app died is retried from the start.
    return rehydrate(parsed, Date.now());
  } catch {
    // A corrupt manifest must not brick capture. The photographs themselves are
    // still on disk, and a fresh manifest is recoverable; a crash loop is not.
    return EMPTY_QUEUE;
  }
}

function save(state: QueueState): void {
  try {
    manifestFile().write(JSON.stringify(state));
  } catch {
    // Persisting failed, so this transition will be replayed after a kill.
    // Replay is safe — that is what the idempotency key is for.
  }
}

/**
 * A tiny store, so the closet can render optimistic tiles without a provider.
 *
 * `useSyncExternalStore` rather than context: the queue outlives any screen,
 * runs while nothing is mounted, and must not be reset by navigation.
 */
let state: QueueState = load();
const listeners = new Set<() => void>();

function setState(next: QueueState): void {
  state = next;
  save(next);
  for (const listener of listeners) listener();
}

function subscribe(listener: () => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function getQueueState(): QueueState {
  return state;
}

/** Add a prepared capture and start working immediately. */
export function enqueueCapture(input: {
  id: string;
  localUri: string;
  source: 'camera' | 'photo_library';
}): void {
  setState(
    enqueueEntry(state, {
      ...input,
      // Stable for the life of the entry: every retry of this capture's import
      // carries the same key, so a replay cannot create a second garment.
      idempotencyKey: `capture-${input.id}`,
      now: Date.now(),
    }),
  );
  void drain();
}

let draining = false;

/**
 * Work the queue until nothing is runnable.
 *
 * Serial by design. Parallel uploads from a phone on a weak connection make
 * every one of them slower and are the reason a queue exists at all.
 */
export async function drain(): Promise<void> {
  if (draining) return;
  draining = true;

  try {
    for (;;) {
      const entry = nextRunnable(state, Date.now());
      if (!entry) break;
      await advance(entry);
    }
    sweep();
  } finally {
    draining = false;
  }
}

async function advance(entry: CaptureEntry): Promise<void> {
  try {
    const uploadKey = entry.uploadKey ?? (await upload(entry));
    if (!entry.uploadKey) setState(markUploaded(state, entry.id, uploadKey));

    const imported = await request<PhotoImportResponse>('/imports/photo', {
      method: 'POST',
      idempotencyKey: entry.idempotencyKey,
      body: { upload_key: uploadKey, source: entry.source },
    });

    setState(markImported(state, entry.id, imported.garment_id));
  } catch (error) {
    const retryable = error instanceof ApiError ? error.isRetryable : true;
    setState(
      markFailure(state, entry.id, {
        now: Date.now(),
        error: error instanceof Error ? error.message : 'Upload failed',
        retryable,
      }),
    );
  }
}

/** Get a scoped target and PUT the bytes straight to storage (2.3). */
async function upload(entry: CaptureEntry): Promise<string> {
  setState(markUploading(state, entry.id));

  const target = await request<UploadTarget>('/media/upload-url', {
    method: 'POST',
    body: { purpose: 'garment', content_type: 'image/jpeg', filename: `${entry.id}.jpg` },
  });

  const file = new File(entry.localUri);
  if (!file.exists) throw new Error('The photo is no longer on this device.');

  const response = await fetch(target.upload_url, {
    method: 'PUT',
    headers: { 'content-type': 'image/jpeg' },
    body: file.bytesSync() as unknown as BodyInit,
  });

  if (!response.ok) {
    throw new ApiError(response.status, 'upload_failed', 'That photo did not finish uploading.');
  }

  return target.upload_key;
}

/** Delete local copies of captures that are safely in the closet. */
function sweep(): void {
  const finished = collectable(state);
  if (finished.length === 0) return;

  for (const entry of finished) discardCapture(entry.localUri);
  setState(finished.reduce((next, entry) => remove(next, entry.id), state));
}

export function retryCapture(id: string): void {
  setState(retryEntry(state, id, Date.now()));
  void drain();
}

export function discardFailedCapture(id: string): void {
  const entry = state.entries.find((candidate) => candidate.id === id);
  if (entry) discardCapture(entry.localUri);
  setState(remove(state, id));
}

/**
 * Captures still owed to the user.
 *
 * Drives the optimistic "analyzing" tiles (task 2.6): the photo is in the
 * closet the moment it is taken, whatever the network is doing.
 */
export function usePendingCaptures(): CaptureEntry[] {
  const snapshot = useSyncExternalStore(subscribe, getQueueState, getQueueState);
  return useMemo(() => inFlight(snapshot), [snapshot]);
}

/**
 * Keep the queue moving.
 *
 * Retries on foreground, because that is the moment a phone that spent the
 * afternoon in a pocket rejoins the network — which is what makes the
 * airplane-mode exit criterion true without polling a radio all day.
 */
export function useUploadQueue(): void {
  const timer = useRef<ReturnType<typeof setInterval> | null>(null);

  const tick = useCallback(() => {
    void drain();
  }, []);

  useEffect(() => {
    tick();

    const subscription = AppState.addEventListener('change', (next: AppStateStatus) => {
      if (next === 'active') tick();
    });

    // A slow heartbeat catches entries whose backoff elapses while the app is
    // open and idle. Deliberately slow: the foreground event does the real work.
    timer.current = setInterval(tick, 15_000);

    return () => {
      subscription.remove();
      if (timer.current) clearInterval(timer.current);
    };
  }, [tick]);
}
