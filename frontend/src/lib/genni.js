// Genni chat client: REST calls + SSE reconciliation.
// POSTs return 202; Genni's replies arrive as SSE events:
//   genni:delta   { conversationId, messageId, chunk, i }   (typing effect)
//   genni:message { conversationId, message }               (terminal, persisted)
//   genni:typing  { conversationId, on }
import axios from 'axios';
import { subscribe } from './sse';

export async function openConversation(kind) {
  const { data } = await axios.post('/api/genni/conversations', { kind });
  return data; // { conversation, messages, isNew }
}

export async function fetchConfig() {
  const { data } = await axios.get('/api/genni/config');
  return data;
}

export async function sendMessage(conversationId, { type = 'text', payload = {}, file = null }) {
  if (file) {
    const form = new FormData();
    form.append('file', file);
    form.append('type', 'upload');
    form.append('payload', JSON.stringify(payload));
    const { data } = await axios.post(`/api/genni/conversations/${conversationId}/message`, form, {
      headers: { 'Content-Type': 'multipart/form-data' },
    });
    return data;
  }
  const { data } = await axios.post(`/api/genni/conversations/${conversationId}/message`, { type, payload });
  return data;
}

export async function setLanguage(conversationId, language) {
  const { data } = await axios.put('/api/genni/language', { conversationId, language });
  return data;
}

export async function confirmAction(conversationId, actionId) {
  const { data } = await axios.post(`/api/genni/conversations/${conversationId}/confirm`, { actionId });
  return data;
}

export async function cancelAction(conversationId, actionId) {
  const { data } = await axios.post(`/api/genni/conversations/${conversationId}/cancel-action`, { actionId });
  return data;
}

/**
 * Subscribe to a conversation's live events.
 * handlers: { onDelta(messageId, chunk, i), onMessage(message), onTyping(on) }
 * Returns an unsubscribe function.
 */
export function subscribeConversation(conversationId, handlers) {
  const offs = [
    subscribe('genni:delta', (d) => {
      if (d.conversationId === conversationId) handlers.onDelta?.(d.messageId, d.chunk, d.i);
    }),
    subscribe('genni:message', (d) => {
      if (d.conversationId === conversationId) handlers.onMessage?.(d.message);
    }),
    subscribe('genni:typing', (d) => {
      if (d.conversationId === conversationId) handlers.onTyping?.(d.on);
    }),
  ];
  return () => offs.forEach((off) => off());
}
