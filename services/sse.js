// Per-user Server-Sent Events fan-out.
// Replaces Firestore onSnapshot listeners on the client side.
const EventEmitter = require('events');

class UserHub {
  constructor() {
    this.bus = new EventEmitter();
    this.bus.setMaxListeners(0);
  }
  emit(uid, event, data) {
    if (!uid) return;
    this.bus.emit(`u:${uid}`, { event, data, ts: Date.now() });
  }
  subscribe(uid, handler) {
    const key = `u:${uid}`;
    this.bus.on(key, handler);
    return () => this.bus.off(key, handler);
  }
}

const hub = new UserHub();

// Express handler. Mount at GET /api/stream (with auth middleware).
function sseHandler(req, res) {
  const uid = req.user && req.user.uid;
  if (!uid) {
    res.status(401).end();
    return;
  }
  res.set({
    'Content-Type': 'text/event-stream',
    'Cache-Control': 'no-cache, no-transform',
    'Connection': 'keep-alive',
    'X-Accel-Buffering': 'no',
  });
  res.flushHeaders && res.flushHeaders();
  res.write('retry: 5000\n\n');
  res.write(`event: ready\ndata: ${JSON.stringify({ uid })}\n\n`);

  const send = (payload) => {
    try {
      res.write(`event: ${payload.event}\n`);
      res.write(`data: ${JSON.stringify(payload.data)}\n\n`);
    } catch (_) {}
  };
  const off = hub.subscribe(uid, send);

  const ping = setInterval(() => {
    try { res.write(`:ping ${Date.now()}\n\n`); } catch (_) {}
  }, 25000);

  const cleanup = () => {
    clearInterval(ping);
    off();
    try { res.end(); } catch (_) {}
  };
  req.on('close', cleanup);
  req.on('aborted', cleanup);
}

module.exports = { hub, sseHandler };
