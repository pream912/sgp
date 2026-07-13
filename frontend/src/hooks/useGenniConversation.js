import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  openConversation, sendMessage, setLanguage as apiSetLanguage,
  subscribeConversation, fetchConfig, confirmAction, cancelAction,
} from '../lib/genni';

/**
 * Shared Genni conversation state — used by the full-screen chat (GenniChat)
 * and the floating widget (GenniWidget). Opens (or resumes) the active
 * conversation of `mode`, reconciles SSE deltas/messages, and exposes actions.
 *
 * `enabled: false` defers opening until the surface is actually shown
 * (the widget shouldn't open a conversation for every page load).
 */
export default function useGenniConversation(mode, { enabled = true } = {}) {
  const [conversation, setConversation] = useState(null);
  const [messages, setMessages] = useState([]);
  const [pending, setPending] = useState({});
  const [typing, setTyping] = useState(false);
  const [languages, setLanguages] = useState([]);
  const [langCode, setLangCode] = useState('en');
  const [error, setError] = useState('');
  const tempIdRef = useRef(0);

  useEffect(() => {
    if (!enabled) return;
    let cancelled = false;
    (async () => {
      try {
        const [conv, cfg] = await Promise.all([openConversation(mode), fetchConfig()]);
        if (cancelled) return;
        setConversation(conv.conversation);
        setMessages(conv.messages || []);
        setLanguages(cfg.languages || []);
        setLangCode(conv.conversation?.language || 'en');
      } catch {
        if (!cancelled) setError('Could not open the chat. Please refresh.');
      }
    })();
    return () => { cancelled = true; };
  }, [mode, enabled]);

  useEffect(() => {
    if (!conversation?.id) return;
    return subscribeConversation(conversation.id, {
      onDelta: (messageId, chunk) => {
        setPending((p) => ({ ...p, [messageId]: (p[messageId] || '') + chunk }));
      },
      onMessage: (message) => {
        setPending((p) => {
          const { [message.id]: _done, ...rest } = p;
          return rest;
        });
        setMessages((prev) => (prev.some((m) => m.id === message.id) ? prev : [...prev, message]));
      },
      onTyping: (on) => setTyping(!!on),
    });
  }, [conversation?.id]);

  const currentLang = useMemo(
    () => languages.find((l) => l.code === langCode) || { code: 'en', nativeLabel: 'English', label: 'English', speechLang: 'en-IN' },
    [languages, langCode]
  );

  const flashError = useCallback((msg) => {
    setError(msg);
    setTimeout(() => setError(''), 4000);
  }, []);

  const dispatch = useCallback(async (action) => {
    if (!conversation?.id) return;
    if (action.type === 'chip' && action.payload?.id?.startsWith('lang:')) {
      setLangCode(action.payload.id.slice(5));
    }
    if (action.type === 'confirm_action') {
      try { await confirmAction(conversation.id, action.payload.actionId); }
      catch (e) { flashError(e.response?.data?.error || 'Could not confirm. Try again.'); }
      return;
    }
    if (action.type === 'cancel_action') {
      try { await cancelAction(conversation.id, action.payload.actionId); } catch { /* card just stays dismissed locally */ }
      return;
    }
    try {
      await sendMessage(conversation.id, action);
    } catch (e) {
      flashError(e.response?.data?.error || 'Message failed to send. Try again.');
    }
  }, [conversation?.id, flashError]);

  const sendText = useCallback((text) => {
    setMessages((prev) => [...prev, { id: `local-${++tempIdRef.current}`, role: 'user', type: 'text', content: text }]);
    dispatch({ type: 'text', payload: { text } });
  }, [dispatch]);

  const pickLanguage = useCallback(async (code) => {
    setLangCode(code);
    try { await apiSetLanguage(conversation?.id, code); } catch { /* pill already updated */ }
  }, [conversation?.id]);

  return { conversation, messages, pending, typing, languages, currentLang, error, dispatch, sendText, pickLanguage };
}
