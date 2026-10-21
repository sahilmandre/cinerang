/**
 * Browser side of account sync. Changes are already applied locally by
 * `commit`; this module uploads the outbox in batches and pulls changes
 * made on other devices. Nothing here ever blocks the UI. Loaded only for
 * signed-in users (SyncProvider imports it on demand).
 */
import { loadAuthClient, refreshSession } from '../session';
import { applyOps, normalizeData } from './reducer';
import {
  clearLocal,
  createOp,
  hasLocalData,
  readLocal,
  readSyncState,
  removeFromOutbox,
  replaceLocal,
  setRecordListener,
  updateSyncState,
  SYNC_EVENT,
} from './local';
import type { Op, SyncData } from './types';

const ENDPOINT = '/api/sync';
const PUSH_DEBOUNCE_MS = 1500;
const PUSH_MAX_WAIT_MS = 10_000;
const PULL_ON_FOCUS_AFTER_MS = 30_000;
const SIGN_OUT_FLUSH_MS = 3000;
const MAX_BATCH_OPS = 100;
const MAX_BATCH_BYTES = 200 * 1024; // server accepts 256 KB
const KEEPALIVE_MAX_BYTES = 60 * 1024; // browsers cap keepalive bodies at 64 KB
const RETRY_MS = [5_000, 15_000, 60_000];

let activeUser: string | null = null;
let queue: Promise<unknown> = Promise.resolve();
let debounceTimer: ReturnType<typeof setTimeout> | undefined;
let maxWaitTimer: ReturnType<typeof setTimeout> | undefined;
let retryTimer: ReturnType<typeof setTimeout> | undefined;
let failures = 0;
let removeListeners: (() => void) | null = null;

/** Runs sync tasks one at a time, so a pull never overlaps a push. */
function enqueue<T>(task: () => Promise<T>): Promise<T> {
  const run = queue.then(task, task);
  queue = run.catch(() => undefined);
  return run;
}

function clearTimers() {
  clearTimeout(debounceTimer);
  clearTimeout(maxWaitTimer);
  clearTimeout(retryTimer);
  debounceTimer = maxWaitTimer = retryTimer = undefined;
}

/** Oldest ops first, at most 100 and ~200 KB (always at least one op). */
function takeBatch(outbox: Op[]): Op[] {
  const batch: Op[] = [];
  let bytes = 0;
  for (const op of outbox) {
    const size = JSON.stringify(op).length;
    if (batch.length && (batch.length >= MAX_BATCH_OPS || bytes + size > MAX_BATCH_BYTES)) break;
    batch.push(op);
    bytes += size;
  }
  return batch;
}

/**
 * 401: the session ended server-side (expired or revoked elsewhere) —
 * re-check it; SyncProvider then clears this device.
 * 403: no longer on the invite list — sign out.
 */
async function onAuthRejected(status: number) {
  stopSync();
  if (status === 403) {
    const { authClient } = await loadAuthClient();
    await authClient.signOut().catch(() => undefined);
    clearLocal();
  }
  await refreshSession();
}

type PushResult = 'ok' | 'pull' | 'retry' | 'stop';

async function pushAll(keepalive = false): Promise<PushResult> {
  const user = activeUser;
  let needPull = false;
  for (;;) {
    if (!user || activeUser !== user) return 'stop';
    const { outbox, rev } = readSyncState();
    if (!outbox.length) return needPull ? 'pull' : 'ok';
    const batch = takeBatch(outbox);
    const body = JSON.stringify({ ops: batch });
    let res: Response;
    try {
      res = await fetch(ENDPOINT, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body,
        keepalive: keepalive && body.length <= KEEPALIVE_MAX_BYTES,
      });
    } catch {
      return 'retry'; // offline — the outbox is persisted, try again later
    }
    if (res.status === 401 || res.status === 403) {
      await onAuthRejected(res.status);
      return 'stop';
    }
    const sent = new Set(batch.map((op) => op.id));
    // A malformed or oversized batch can never succeed; dropping it keeps
    // later changes from queueing behind it forever.
    if (res.status === 400 || res.status === 413) {
      removeFromOutbox(sent);
      continue;
    }
    if (!res.ok) return 'retry';
    const { rev: next } = (await res.json()) as { rev: number };
    removeFromOutbox(sent);
    // rev + 1: only our batch landed, so the device copy already matches.
    // Anything else means another device wrote in between — pull its changes.
    if (next === rev + 1 || next === rev) updateSyncState({ rev: next });
    else needPull = true;
  }
}

async function pull(): Promise<void> {
  const user = activeUser;
  const { rev } = readSyncState();
  let res: Response;
  try {
    res = await fetch(ENDPOINT, {
      headers: rev ? { 'If-None-Match': `"${rev}"` } : {},
      cache: 'no-store',
    });
  } catch {
    return;
  }
  if (activeUser !== user) return; // signed out while the request was in flight
  if (res.status === 304) {
    updateSyncState({ lastPullAt: Date.now() });
    return;
  }
  if (res.status === 401 || res.status === 403) return onAuthRejected(res.status);
  if (!res.ok) return;
  const body = (await res.json()) as { rev: number; data: SyncData };
  if (activeUser !== user) return;
  // Rebase: changes made while the request was in flight go on top of the
  // account's copy, so nothing not yet uploaded is lost.
  const changed = replaceLocal(applyOps(normalizeData(body.data), readSyncState().outbox));
  updateSyncState({ rev: body.rev, lastPullAt: Date.now() });
  if (changed) window.dispatchEvent(new Event(SYNC_EVENT));
}

function onPushResult(result: PushResult): Promise<void> | void {
  if (result === 'retry') {
    retryTimer = setTimeout(flush, RETRY_MS[Math.min(failures, RETRY_MS.length - 1)]);
    failures++;
    return;
  }
  failures = 0;
  if (result === 'pull') return pull();
}

/** Upload now, then pull only if another device changed something. */
function flush() {
  clearTimers();
  void enqueue(async () => onPushResult(await pushAll()));
}

/** Upload, then always check the account for changes from other devices. */
function syncNow() {
  clearTimers();
  void enqueue(async () => {
    const result = await pushAll();
    // A failed upload may still have landed; pulling before it is retried
    // could apply those ops twice locally.
    if (result === 'retry' || result === 'stop') return onPushResult(result);
    failures = 0;
    await pull();
  });
}

/** Debounced: 1.5 s after the last change, at most 10 s after the first. */
function schedulePush() {
  // A change while the tab is hidden (the player saving its position as the
  // tab closes) may be the last chance to send anything.
  if (document.visibilityState === 'hidden') {
    clearTimers();
    void enqueue(() => pushAll(true));
    return;
  }
  clearTimeout(debounceTimer);
  debounceTimer = setTimeout(flush, PUSH_DEBOUNCE_MS);
  maxWaitTimer ??= setTimeout(flush, PUSH_MAX_WAIT_MS);
}

/**
 * Starts syncing this device with the signed-in account. Guest data on the
 * device is merged into the account once; data that belongs to a different
 * account is discarded first, so two accounts never mix.
 */
export function startSync(userId: string): () => void {
  if (activeUser === userId && removeListeners) return stopSync;
  stopSync();
  activeUser = userId;

  const state = readSyncState();
  if (state.ownerId !== userId) {
    if (state.ownerId) clearLocal();
    const local = readLocal();
    updateSyncState({
      ownerId: userId,
      rev: 0,
      lastPullAt: 0,
      outbox: !state.ownerId && hasLocalData(local) ? [createOp({ t: 'import', snapshot: local })] : [],
    });
  }

  setRecordListener(schedulePush);
  const onVisibility = () => {
    if (document.visibilityState === 'hidden') {
      // The tab may be closed next: send what's pending with keepalive.
      clearTimers();
      void enqueue(() => pushAll(true));
    } else if (Date.now() - readSyncState().lastPullAt > PULL_ON_FOCUS_AFTER_MS) {
      syncNow();
    }
  };
  window.addEventListener('online', syncNow);
  document.addEventListener('visibilitychange', onVisibility);
  removeListeners = () => {
    window.removeEventListener('online', syncNow);
    document.removeEventListener('visibilitychange', onVisibility);
  };

  syncNow();
  return stopSync;
}

/** Stops network sync. Changes keep queueing locally until it restarts. */
export function stopSync() {
  activeUser = null;
  clearTimers();
  setRecordListener(null);
  removeListeners?.();
  removeListeners = null;
}

const wait = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

/**
 * Uploads pending changes (bounded wait), signs out, then wipes the device
 * copy so the next person on a shared device starts as a fresh guest.
 * `everywhere` also revokes every other session of this account.
 */
export async function signOutAndClear(everywhere = false) {
  const client = loadAuthClient(); // fetch the chunk while uploading
  client.catch(() => undefined);
  if (activeUser) await Promise.race([enqueue(() => pushAll()), wait(SIGN_OUT_FLUSH_MS)]);
  stopSync();
  try {
    const { authClient } = await client;
    if (everywhere) await authClient.revokeSessions();
    await authClient.signOut();
  } catch {
    /* cookie is cleared on the next session check */
  }
  clearLocal();
  await refreshSession();
}
