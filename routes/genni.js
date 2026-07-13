/**
 * Genni chat API. Mounted at /api/genni behind verifyToken (see server.js).
 *
 * Delivery contract: POST endpoints return 202 immediately; Genni's replies
 * arrive over the existing SSE stream as genni:delta / genni:message /
 * genni:typing events (see services/genni/service.js).
 */
const express = require('express');
const path = require('path');
const multer = require('multer');

const db = require('../services/db');
const { listLanguages, getLanguage, template } = require('../services/genni/languages');
const svc = require('../services/genni/service');
const flow = require('../services/genni/onboarding-flow');
const agent = require('../services/genni/agent');

const router = express.Router();
const upload = multer({ dest: path.join(__dirname, '../temp/uploads') });

async function loadUser(req) {
  const row = await db.one('SELECT id, name, preferred_language FROM users WHERE id = ?', [req.user.uid]);
  return { uid: req.user.uid, name: row?.name || null, preferredLanguage: row?.preferred_language || null };
}

router.get('/config', async (req, res) => {
  res.json({
    languages: listLanguages(),
    etaHint: 'Usually 3–6 minutes',
    freeFirstBuild: true,
  });
});

/**
 * Get-or-create the active conversation of a kind. Returns the conversation
 * plus recent messages so the client can resume mid-flow after a refresh.
 * A brand-new onboarding conversation triggers Genni's greeting (over SSE and
 * also returned inline for first paint).
 */
router.post('/conversations', async (req, res) => {
  const kind = req.body?.kind === 'onboarding' ? 'onboarding' : 'assistant';
  try {
    const user = await loadUser(req);
    let conversation = await svc.getActiveConversation(user.uid, kind);
    let isNew = false;

    if (!conversation) {
      isNew = true;
      const language = user.preferredLanguage || 'en';
      conversation = await svc.createConversation(user.uid, kind, language, kind === 'onboarding' ? { step: 'language', draft: {} } : {});
      if (kind === 'onboarding') {
        await flow.startOnboarding(user, conversation);
      } else {
        await svc.sendGenniMessage(user.uid, conversation.id, {
          type: 'text',
          content: `Hi${user.name ? ' ' + user.name : ''}! I'm Genni — ask me anything about your sites, credits, leads, or domains. 👋`,
          stream: false,
        });
      }
    }

    const messages = await svc.getMessages(conversation.id, user.uid, { limit: 60 });
    res.json({ conversation: { ...conversation, state: undefined }, messages, isNew });
  } catch (e) {
    console.error('[Genni] conversation open failed:', e);
    res.status(500).json({ error: 'Could not open the chat. Please try again.' });
  }
});

router.get('/conversations/:id/messages', async (req, res) => {
  try {
    const messages = await svc.getMessages(req.params.id, req.user.uid, {
      before: req.query.before || null,
      limit: Math.min(parseInt(req.query.limit, 10) || 60, 100),
    });
    if (!messages) return res.status(404).json({ error: 'Conversation not found' });
    res.json(messages);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

/**
 * Send a user input into the conversation.
 * JSON body: { type: 'text'|'chip'|'select'|'form', payload: {...} }
 * Multipart:  file field 'file' (+ optional 'type'/'payload' fields) for uploads.
 */
router.post('/conversations/:id/message', upload.single('file'), async (req, res) => {
  try {
    const user = await loadUser(req);
    const conversation = await svc.getConversation(req.params.id, user.uid);
    if (!conversation) return res.status(404).json({ error: 'Conversation not found' });

    let type = req.body?.type || (req.file ? 'upload' : 'text');
    let payload = req.body?.payload || {};
    if (typeof payload === 'string') { try { payload = JSON.parse(payload); } catch { payload = {}; } }

    // Persist the user's turn (uploads store the filename, not the temp path).
    const userContent = type === 'text' ? (payload.text || '') : null;
    const userMeta = type === 'text' ? null
      : type === 'upload' ? { fileName: req.file?.originalname || 'file' }
      : { type, payload };
    const saved = await svc.saveMessage(conversation.id, user.uid, 'user', type, userContent, userMeta);

    res.status(202).json({ ok: true, messageId: saved.id });

    const input = { type, payload, file: req.file || null };
    const dispatch = conversation.kind === 'onboarding'
      ? flow.handleInput(user, conversation, input)
      : agent.handleAssistantTurn(user, conversation, input);
    dispatch.catch(err => {
      console.error(`[Genni] ${conversation.kind} turn failed:`, err);
      svc.sendGenniMessage(user.uid, conversation.id, {
        type: 'text',
        content: 'Something went wrong on my side. Please try again in a moment.',
        stream: false,
      }).catch(() => {});
    });
  } catch (e) {
    console.error('[Genni] message failed:', e);
    if (!res.headersSent) res.status(500).json({ error: e.message });
  }
});

/**
 * Confirm a pending credit-costing action Genni proposed (add page, section
 * redesign). The ONLY chat path that spends credits — full re-validation
 * happens inside executePendingAction.
 */
router.post('/conversations/:id/confirm', async (req, res) => {
  const { actionId } = req.body || {};
  if (!actionId) return res.status(400).json({ error: 'actionId is required' });
  try {
    const user = await loadUser(req);
    const conversation = await svc.getConversation(req.params.id, user.uid);
    if (!conversation) return res.status(404).json({ error: 'Conversation not found' });

    const { executePendingAction } = require('../services/genni/tools');
    res.status(202).json({ ok: true });

    (async () => {
      svc.sendTyping(user.uid, conversation.id, true);
      try {
        const result = await executePendingAction(user, conversation, actionId);
        const done = result.type === 'add_page'
          ? `Done! Your "${result.page.replace('.html', '')}" page is live in the preview — ${result.cost} credits used. Open the editor to fine-tune it.`
          : `Done! The section has a fresh design — ${result.cost} credits used. Take a look and tell me if you want another pass.`;
        await svc.sendGenniMessage(user.uid, conversation.id, { type: 'text', content: done });
      } catch (e) {
        await svc.sendGenniMessage(user.uid, conversation.id, {
          type: 'text',
          content: `That didn't go through: ${e.message}`,
          stream: false,
        }).catch(() => {});
      } finally {
        svc.sendTyping(user.uid, conversation.id, false);
      }
    })();
  } catch (e) {
    if (!res.headersSent) res.status(500).json({ error: e.message });
  }
});

/**
 * Cancel a pending action (dismisses the card without spending anything).
 */
router.post('/conversations/:id/cancel-action', async (req, res) => {
  const { actionId } = req.body || {};
  try {
    const user = await loadUser(req);
    const conversation = await svc.getConversation(req.params.id, user.uid);
    if (!conversation) return res.status(404).json({ error: 'Conversation not found' });
    const state = conversation.state || {};
    if (state.pendingActions?.[actionId]) {
      delete state.pendingActions[actionId];
      await svc.updateConversation(conversation.id, { state });
    }
    res.json({ ok: true });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

/**
 * Switch chat language mid-conversation (also saved as the account preference).
 */
router.put('/language', async (req, res) => {
  const { conversationId, language } = req.body || {};
  const lang = getLanguage(language);
  try {
    const user = await loadUser(req);
    await db.exec('UPDATE users SET preferred_language = ? WHERE id = ?', [lang.code, user.uid]);
    if (conversationId) {
      const conversation = await svc.getConversation(conversationId, user.uid);
      if (conversation) {
        await svc.updateConversation(conversationId, { language: lang.code });
        await svc.sendGenniMessage(user.uid, conversationId, {
          type: 'text',
          content: template('language_set', lang.code),
          stream: false,
        });
      }
    }
    res.json({ ok: true, language: lang.code });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

module.exports = router;
