// Singleton SSE manager. Replaces Firestore onSnapshot listeners.
import { getToken } from './auth';

let source = null;
let listeners = new Map(); // event -> Set<cb>
let backoff = 1000;
let closed = false;

function open() {
  const token = getToken();
  if (!token) return;
  if (source) return;

  try {
    source = new EventSource(`/api/stream?token=${encodeURIComponent(token)}`);
  } catch (e) {
    console.warn('[sse] EventSource init failed:', e);
    return;
  }

  source.onopen = () => { backoff = 1000; };
  source.onerror = () => {
    try { source && source.close(); } catch {}
    source = null;
    if (closed) return;
    setTimeout(open, backoff);
    backoff = Math.min(backoff * 2, 30000);
  };

  // Generic message (no event name) fallback.
  source.onmessage = (ev) => dispatch('message', ev.data);

  // Subscribe to known events.
  for (const event of listeners.keys()) bindEvent(event);
}

function bindEvent(event) {
  if (!source) return;
  if (source._bound && source._bound.has(event)) return;
  source._bound = source._bound || new Set();
  source._bound.add(event);
  source.addEventListener(event, (ev) => dispatch(event, ev.data));
}

function dispatch(event, raw) {
  const set = listeners.get(event);
  if (!set || set.size === 0) return;
  let data = raw;
  try { data = JSON.parse(raw); } catch {}
  for (const cb of set) {
    try { cb(data); } catch (e) { console.error('[sse] handler error:', e); }
  }
}

export function subscribe(event, cb) {
  if (!listeners.has(event)) listeners.set(event, new Set());
  listeners.get(event).add(cb);
  closed = false;
  if (!source) open();
  else bindEvent(event);
  return () => {
    const set = listeners.get(event);
    if (set) set.delete(cb);
  };
}

export function close() {
  closed = true;
  if (source) { try { source.close(); } catch {} source = null; }
  listeners.clear();
}
