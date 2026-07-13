/**
 * Genni conversation persistence + delivery.
 *
 * Delivery model: POST /message returns 202 immediately; Genni's replies are
 * pushed over the existing SSE hub. Plain text streams as `genni:delta` chunks
 * (typing effect); every message finishes with a terminal `genni:message`
 * carrying the full persisted row. Structured messages (cards/forms/uploads)
 * arrive only as complete `genni:message` events, never streamed.
 */
const crypto = require('crypto');
const db = require('../db');
const { hub } = require('../sse');

const DELTA_CHUNK_CHARS = 24;
const DELTA_INTERVAL_MS = 45;

function rowToMessage(r) {
  if (!r) return null;
  return {
    id: r.id,
    conversationId: r.conversation_id,
    role: r.role,
    type: r.type,
    content: r.content,
    meta: db.parseJSON(r.meta, null),
    createdAt: r.created_at,
  };
}

function rowToConversation(r) {
  if (!r) return null;
  return {
    id: r.id,
    userId: r.user_id,
    kind: r.kind,
    language: r.language,
    state: db.parseJSON(r.state, {}),
    projectId: r.project_id,
    status: r.status,
    createdAt: r.created_at,
    updatedAt: r.updated_at,
  };
}

async function createConversation(userId, kind, language = 'en', state = {}) {
  const id = crypto.randomUUID();
  await db.exec(
    `INSERT INTO genni_conversations (id, user_id, kind, language, state, status, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, 'active', datetime('now'), datetime('now'))`,
    [id, userId, kind, language, db.J(state)]
  );
  return { id, userId, kind, language, state, projectId: null, status: 'active' };
}

async function getConversation(id, userId) {
  const r = await db.one('SELECT * FROM genni_conversations WHERE id = ? AND user_id = ?', [id, userId]);
  return rowToConversation(r);
}

async function getActiveConversation(userId, kind) {
  const r = await db.one(
    `SELECT * FROM genni_conversations WHERE user_id = ? AND kind = ? AND status = 'active'
     ORDER BY updated_at DESC LIMIT 1`,
    [userId, kind]
  );
  return rowToConversation(r);
}

async function updateConversation(id, fields = {}) {
  const sets = ["updated_at = datetime('now')"];
  const params = [];
  if (fields.state !== undefined) { sets.push('state = ?'); params.push(db.J(fields.state)); }
  if (fields.language !== undefined) { sets.push('language = ?'); params.push(fields.language); }
  if (fields.status !== undefined) { sets.push('status = ?'); params.push(fields.status); }
  if (fields.projectId !== undefined) { sets.push('project_id = ?'); params.push(fields.projectId); }
  params.push(id);
  await db.exec(`UPDATE genni_conversations SET ${sets.join(', ')} WHERE id = ?`, params);
}

async function saveMessage(conversationId, userId, role, type, content, meta = null) {
  const id = crypto.randomUUID();
  await db.exec(
    `INSERT INTO genni_messages (id, conversation_id, user_id, role, type, content, meta, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, datetime('now'))`,
    [id, conversationId, userId, role, type, content || null, meta ? db.J(meta) : null]
  );
  return {
    id, conversationId, role, type,
    content: content || null,
    meta: meta || null,
    createdAt: new Date().toISOString(),
  };
}

async function getMessages(conversationId, userId, { before = null, limit = 60 } = {}) {
  const conv = await getConversation(conversationId, userId);
  if (!conv) return null;
  let rows;
  if (before) {
    rows = await db.query(
      `SELECT * FROM genni_messages WHERE conversation_id = ? AND created_at < ?
       ORDER BY created_at DESC LIMIT ?`,
      [conversationId, before, limit]
    );
  } else {
    rows = await db.query(
      `SELECT * FROM genni_messages WHERE conversation_id = ?
       ORDER BY created_at DESC LIMIT ?`,
      [conversationId, limit]
    );
  }
  return rows.map(rowToMessage).reverse();
}

/**
 * Persist and deliver one of Genni's replies.
 * Text messages stream as deltas first (typing effect); structured messages
 * are delivered whole. Always ends with a terminal `genni:message`.
 */
async function sendGenniMessage(userId, conversationId, { type = 'text', content = null, meta = null, stream = true }) {
  const message = await saveMessage(conversationId, userId, 'genni', type, content, meta);

  if (type === 'text' && content && stream) {
    for (let i = 0, seq = 0; i < content.length; i += DELTA_CHUNK_CHARS, seq++) {
      hub.emit(userId, 'genni:delta', {
        conversationId,
        messageId: message.id,
        chunk: content.slice(i, i + DELTA_CHUNK_CHARS),
        i: seq,
      });
      await new Promise(r => setTimeout(r, DELTA_INTERVAL_MS));
    }
  }

  hub.emit(userId, 'genni:message', { conversationId, message });
  return message;
}

/** Signal that Genni is "thinking" (client shows a typing indicator). */
function sendTyping(userId, conversationId, on = true) {
  hub.emit(userId, 'genni:typing', { conversationId, on });
}

module.exports = {
  createConversation, getConversation, getActiveConversation, updateConversation,
  saveMessage, getMessages, sendGenniMessage, sendTyping, rowToMessage,
};
