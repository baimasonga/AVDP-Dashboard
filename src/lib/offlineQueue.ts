// Minimal offline write queue for indicator edits. When the device is offline,
// edits are stored locally and replayed (in order) once connectivity returns.

export interface QueuedUpdate {
  id: string;
  baseline: number;
  achieved: number;
  queuedAt: string;
}

const KEY = "avdp_pending_updates";

export function getQueue(): QueuedUpdate[] {
  try {
    return JSON.parse(localStorage.getItem(KEY) || "[]");
  } catch {
    return [];
  }
}

function setQueue(q: QueuedUpdate[]) {
  localStorage.setItem(KEY, JSON.stringify(q));
}

// Enqueue an edit, collapsing any earlier pending edit for the same indicator.
export function enqueue(update: Omit<QueuedUpdate, "queuedAt">): QueuedUpdate[] {
  const q = getQueue().filter((u) => u.id !== update.id);
  q.push({ ...update, queuedAt: new Date().toISOString() });
  setQueue(q);
  return q;
}

export function removeFromQueue(id: string): QueuedUpdate[] {
  const q = getQueue().filter((u) => u.id !== id);
  setQueue(q);
  return q;
}

export function clearQueue() {
  setQueue([]);
}
