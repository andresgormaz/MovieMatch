// A pragmatic, check/uncheck-only offline queue -- not a full IndexedDB
// mutation log with conflict resolution. Good enough for the volume this
// sees (a handful of toggles per shopping trip) and keeps a real IndexedDB
// queue a pure client-side upgrade later, since clientMutationId already
// exists on ListItem from Fase 0.
export interface PendingCheckMutation {
  itemId: string;
  checked: boolean;
  clientMutationId: string;
}

function storageKey(listId: string) {
  return `misuper-pending-checks-${listId}`;
}

export function loadPendingQueue(listId: string): PendingCheckMutation[] {
  try {
    const raw = localStorage.getItem(storageKey(listId));
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function savePendingQueue(listId: string, queue: PendingCheckMutation[]): void {
  try {
    if (queue.length === 0) {
      localStorage.removeItem(storageKey(listId));
    } else {
      localStorage.setItem(storageKey(listId), JSON.stringify(queue));
    }
  } catch {
    // localStorage can throw (private browsing, quota) -- offline support
    // is a best-effort convenience, not something worth surfacing an error
    // for.
  }
}

// Replaces any earlier queued mutation for the same item -- only the final
// intended state matters, so a rapid check/uncheck while offline collapses
// into a single request instead of replaying every intermediate toggle.
export function enqueuePendingCheck(listId: string, mutation: PendingCheckMutation): PendingCheckMutation[] {
  const queue = loadPendingQueue(listId).filter((m) => m.itemId !== mutation.itemId);
  queue.push(mutation);
  savePendingQueue(listId, queue);
  return queue;
}

export function removePendingCheck(listId: string, itemId: string): PendingCheckMutation[] {
  const queue = loadPendingQueue(listId).filter((m) => m.itemId !== itemId);
  savePendingQueue(listId, queue);
  return queue;
}
