/**
 * Genni assistant-mode turns: multi-turn persona chat with tool calling over
 * the SSE hub. Tools (services/genni/tools.js) are read-only except the
 * start_* pair, which only mint confirmation cards — spends happen exclusively
 * in the /confirm endpoint.
 */
const { runGeminiAgent } = require('../agent/gemini-agent');
const { saveTokenUsage } = require('../build-support');
const { assistantPrompt } = require('./prompts');
const { DECLARATIONS, createToolExecutors } = require('./tools');
const svc = require('./service');

const GENNI_MODEL = process.env.GENNI_MODEL || 'gemini-3.5-flash';
const HISTORY_WINDOW = 16;

const CAPABILITIES = `- Building websites (chat onboarding at /builder; first home page free)
- My Sites: preview, edit in the editor (sections, text, images, theme, pages), retry failed builds
- Publishing: Basic 500 credits/yr (genweb.in subdomain), Single 2000/yr and Multi 3000/yr (custom domains)
- Credits: buy via Credits page (1 credit = ₹1); building costs 200 (single page) / 400 (multi page); adding a page 100; section redesign 50
- Leads from published sites appear in the Leads page
- Domains: buy/connect custom domains in the Domains page
- Referrals: share your code, earn credits when friends make their first purchase`;

async function historyToContents(conversationId, userId) {
  const messages = await svc.getMessages(conversationId, userId, { limit: HISTORY_WINDOW });
  if (!messages) return [];
  return messages
    .filter(m => m.type === 'text' && m.content)
    .map(m => ({ role: m.role === 'user' ? 'user' : 'model', parts: [{ text: m.content }] }));
}

async function handleAssistantTurn(user, conversation, input) {
  const text = input?.payload?.text?.trim();
  if (!text) return;

  svc.sendTyping(user.uid, conversation.id, true);
  try {
    const history = await historyToContents(conversation.id, user.uid);
    // The just-persisted user message is already in history — drop it from the
    // prefix so it becomes the live turn instead.
    if (history.length && history[history.length - 1].role === 'user') history.pop();

    const res = await runGeminiAgent({
      systemInstruction: assistantPrompt({ user, langCode: conversation.language, capabilities: CAPABILITIES }),
      history,
      userParts: [{ text }],
      tools: DECLARATIONS,
      toolExecutors: createToolExecutors({ uid: user.uid, name: user.name, conversationId: conversation.id }),
      model: GENNI_MODEL,
      maxSteps: 6,
      temperature: 0.7,
      maxTokens: 2048,
      thinkingLevel: 'low',
    });

    if (res.usage?.totalTokenCount) {
      saveTokenUsage([{ ...res.usage, service: 'genni', action: 'assistant', model: GENNI_MODEL }], null, user.uid).catch(() => {});
    }

    const reply = (res.text || '').trim() ||
      "Sorry, I lost my train of thought — could you ask that again?";
    await svc.sendGenniMessage(user.uid, conversation.id, { type: 'text', content: reply });
    await svc.updateConversation(conversation.id, {});
  } catch (e) {
    console.error('[Genni] assistant turn failed:', e.message);
    await svc.sendGenniMessage(user.uid, conversation.id, {
      type: 'text',
      content: "Something went wrong on my side. Please try again in a moment.",
    });
  } finally {
    svc.sendTyping(user.uid, conversation.id, false);
  }
}

module.exports = { handleAssistantTurn, CAPABILITIES };
