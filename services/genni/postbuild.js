/**
 * Post-build follow-up: when a Genni-initiated build completes, Genni comes
 * back to the conversation with available domain suggestions — the natural
 * next step toward publishing. Non-fatal in every branch; a build must never
 * fail because the follow-up did.
 */
const db = require('../db');
const { getSuggestions } = require('../domains');
const { callGemini } = require('../agent/gemini-agent');
const { onboardingPrompt } = require('./prompts');
const svc = require('./service');

const GENNI_MODEL = process.env.GENNI_MODEL || 'gemini-3.5-flash';

async function onBuildCompleted(userId, projectId, businessName) {
  try {
    const conv = await db.one(
      `SELECT id, language FROM genni_conversations WHERE user_id = ? AND project_id = ?
       ORDER BY updated_at DESC LIMIT 1`,
      [userId, projectId]
    );
    if (!conv) return;

    let suggestions = [];
    if (businessName) {
      const clean = businessName.toLowerCase().replace(/[^a-z0-9\s-]/g, '').replace(/\s+/g, '');
      if (clean.length >= 3) {
        try { suggestions = await getSuggestions(clean, 3); } catch (_) {}
      }
    }

    const domainNames = (suggestions || [])
      .map(s => (typeof s === 'string' ? s : s.domain || s.name))
      .filter(Boolean)
      .slice(0, 3);

    const fallback = domainNames.length
      ? `Your website is ready! 🎉 When you want to go live, these domains are available: ${domainNames.join(', ')}. Head to My Sites → Publish whenever you're ready — or just ask me about publishing.`
      : `Your website is ready! 🎉 When you want to go live, head to My Sites → Publish — or just ask me about publishing and domains.`;

    let line = fallback;
    try {
      const res = await callGemini({
        systemInstruction: onboardingPrompt({
          user: { name: null },
          langCode: conv.language || 'en',
          step: 'post_build',
          stepGoal: 'Celebrate that their website is ready and, if domain suggestions are provided, mention them as available for going live. Point them to My Sites → Publish. Keep it to 2 short sentences.',
        }),
        prompt: `The website for "${businessName || 'their business'}" just finished building. Available domains: ${domainNames.join(', ') || 'none found'}. Write your message.`,
        model: GENNI_MODEL,
        temperature: 0.7,
        maxTokens: 512,
        thinkingLevel: 'low',
        timeoutMs: 15000,
      });
      if (res.text?.trim()) line = res.text.trim();
    } catch (_) {}

    await svc.sendGenniMessage(userId, conv.id, { type: 'text', content: line, stream: false });
  } catch (e) {
    console.warn(`[Genni] post-build follow-up failed for ${projectId}:`, e.message);
  }
}

module.exports = { onBuildCompleted };
