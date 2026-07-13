/**
 * Genni onboarding: a deterministic state machine drives the flow; the LLM
 * only writes conversational text (in the user's language) and parses free-
 * text corrections. Bad LLM output can never derail the flow — every step has
 * a deterministic template fallback, and parse failures degrade to forms.
 *
 * Steps:
 *   language -> business_search -> business_select -> details_review
 *     -> manual_details (basics/contact/services_hours/socials)
 *     -> logo -> style_refs (competitor/reference) -> summary -> building -> done
 */
const { callGemini } = require('../agent/gemini-agent');
const { searchBusinessCandidates, extractFromPlace } = require('../business-extractor');
const { getBuildFlags } = require('../flags');
const { startBuild } = require('../build-runner');
const { saveTokenUsage } = require('../build-support');
const db = require('../db');

const { listLanguages, getLanguage, template } = require('./languages');
const { onboardingPrompt, PARSE_SYSTEM } = require('./prompts');
const svc = require('./service');

const GENNI_MODEL = process.env.GENNI_MODEL || 'gemini-3.5-flash';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function skipChip(lang) {
  return { id: 'skip', label: template('skip', lang) };
}

function normalizeUrl(text) {
  const t = (text || '').trim();
  if (!t) return null;
  if (!/^[\w-]+(\.[\w-]+)+/.test(t.replace(/^https?:\/\//, ''))) return null;
  return /^https?:\/\//.test(t) ? t : `https://${t}`;
}

/**
 * One localized conversational line from the LLM, with a deterministic
 * fallback so a model hiccup never blocks the flow.
 */
async function genniLine({ user, lang, step, stepGoal, instruction, fallback, conversationId }) {
  try {
    const res = await callGemini({
      systemInstruction: onboardingPrompt({ user, langCode: lang, step, stepGoal }),
      prompt: instruction,
      model: GENNI_MODEL,
      temperature: 0.7,
      maxTokens: 1024,
      thinkingLevel: 'low',
      timeoutMs: 20000,
    });
    if (res.usage) {
      saveTokenUsage([{ ...res.usage, service: 'genni', action: `onboarding:${step}`, model: GENNI_MODEL }], null, user.uid)
        .catch(() => {});
    }
    const text = (res.text || '').trim();
    if (text) return text;
  } catch (e) {
    console.warn(`[Genni] LLM line failed at ${step} (${e.message}) — using template fallback.`);
  }
  return fallback;
}

// Manual-details form schemas. Field labels stay in English (short, universally
// used in Indian apps); the conversational text around each form is localized.
const DETAIL_FORMS = {
  basics: {
    formId: 'basics',
    title: 'About your business',
    fields: [
      { key: 'name', label: 'Business name', type: 'text', required: true },
      { key: 'industry', label: 'Type of business', type: 'text', placeholder: 'e.g. Restaurant, Salon, Clinic' },
      { key: 'description', label: 'Describe it in a line or two', type: 'textarea' },
    ],
  },
  contact: {
    formId: 'contact',
    title: 'Contact details',
    fields: [
      { key: 'address', label: 'Address', type: 'textarea' },
      { key: 'phone', label: 'Phone', type: 'tel' },
      { key: 'email', label: 'Email', type: 'email' },
      { key: 'website', label: 'Current website (if any)', type: 'url' },
    ],
  },
  services_hours: {
    formId: 'services_hours',
    title: 'Services & timings',
    fields: [
      { key: 'services', label: 'Services (one per line)', type: 'textarea' },
      { key: 'openingHours', label: 'Opening hours', type: 'textarea', placeholder: 'e.g. Mon–Sat: 9am – 9pm' },
    ],
  },
  socials: {
    formId: 'socials',
    title: 'Social media (optional)',
    fields: [
      { key: 'facebook', label: 'Facebook', type: 'url' },
      { key: 'instagram', label: 'Instagram', type: 'url' },
      { key: 'twitter', label: 'Twitter / X', type: 'url' },
      { key: 'youtube', label: 'YouTube', type: 'url' },
    ],
  },
};
const DETAIL_ORDER = ['basics', 'contact', 'services_hours', 'socials'];

function formWithValues(formKey, draft) {
  const schema = DETAIL_FORMS[formKey];
  const values = {};
  for (const f of schema.fields) {
    if (formKey === 'socials') values[f.key] = draft.socials?.[f.key] || '';
    else if (f.key === 'services') values[f.key] = (draft.services || []).join('\n');
    else values[f.key] = draft[f.key] || '';
  }
  return { ...schema, values };
}

function mergeFormValues(draft, formId, values = {}) {
  if (formId === 'socials') {
    draft.socials = { ...(draft.socials || {}) };
    for (const [k, v] of Object.entries(values)) if (v && v.trim()) draft.socials[k] = v.trim();
    return;
  }
  for (const [k, v] of Object.entries(values)) {
    if (v === undefined || v === null || !String(v).trim()) continue;
    if (k === 'services') draft.services = String(v).split('\n').map(s => s.trim()).filter(Boolean);
    else draft[k] = String(v).trim();
  }
}

function draftSummaryMeta(draft, { isFree, cost }) {
  return {
    draft: {
      name: draft.name || '',
      industry: draft.industry || '',
      description: draft.description || '',
      address: draft.address || '',
      phone: draft.phone || '',
      email: draft.email || '',
      website: draft.website || '',
      services: draft.services || [],
      openingHours: draft.openingHours || '',
      socials: draft.socials || {},
      reviewsCount: (draft.reviews || []).length,
      photosCount: (draft.placePhotos || []).length,
      hasLogo: !!draft.logoTmpPath,
      competitorUrl: draft.competitorUrl || '',
      referenceUrl: draft.referenceUrl || '',
    },
    isFree,
    cost,
  };
}

// ---------------------------------------------------------------------------
// Step senders (enter a step = send its message(s) and persist state)
// ---------------------------------------------------------------------------

async function enterStep(ctx, step) {
  const { user, conversation, state } = ctx;
  const lang = conversation.language;
  state.step = step;

  switch (step) {
    case 'language': {
      await svc.sendGenniMessage(user.uid, conversation.id, {
        type: 'text',
        content: template('greeting', lang, { name: user.name || '' }),
      });
      await svc.sendGenniMessage(user.uid, conversation.id, {
        type: 'language_picker',
        meta: { languages: listLanguages() },
        stream: false,
      });
      break;
    }
    case 'business_search': {
      await svc.sendGenniMessage(user.uid, conversation.id, {
        type: 'text',
        content: template('ask_business', lang),
      });
      await svc.sendGenniMessage(user.uid, conversation.id, {
        type: 'chips',
        meta: { options: [{ id: 'manual', label: 'Enter details manually' }] },
        stream: false,
      });
      break;
    }
    case 'manual_details': {
      const formKey = state.detailsStep || 'basics';
      await svc.sendGenniMessage(user.uid, conversation.id, {
        type: 'form',
        meta: { ...formWithValues(formKey, state.draft || {}), skippable: formKey !== 'basics' },
        stream: false,
      });
      break;
    }
    case 'logo': {
      await svc.sendGenniMessage(user.uid, conversation.id, {
        type: 'text',
        content: template('ask_logo', lang),
      });
      await svc.sendGenniMessage(user.uid, conversation.id, {
        type: 'upload',
        meta: { uploadId: 'logo', accept: 'image/*', label: 'Upload logo', skippable: true, skipLabel: template('skip', lang) },
        stream: false,
      });
      break;
    }
    case 'style_refs': {
      state.refsStep = state.refsStep || 'competitor';
      await svc.sendGenniMessage(user.uid, conversation.id, {
        type: 'text',
        content: template(state.refsStep === 'competitor' ? 'ask_competitor' : 'ask_reference', lang),
      });
      await svc.sendGenniMessage(user.uid, conversation.id, {
        type: 'chips',
        meta: { options: [skipChip(lang)] },
        stream: false,
      });
      break;
    }
    case 'summary': {
      const flags = await getBuildFlags();
      const userRow = await db.one('SELECT free_build_used FROM users WHERE id = ?', [user.uid]);
      const isFree = !!(flags.freeFirstBuild && userRow && !userRow.free_build_used);
      const cost = isFree ? 0 : 200;
      state.pendingBuild = { isFree, cost };

      await svc.sendGenniMessage(user.uid, conversation.id, {
        type: 'text',
        content: template('summary_intro', lang),
      });
      await svc.sendGenniMessage(user.uid, conversation.id, {
        type: 'summary',
        meta: {
          ...draftSummaryMeta(state.draft || {}, { isFree, cost }),
          confirmLabel: 'Build my website',
          editLabel: 'Edit details',
        },
        stream: false,
      });
      break;
    }
    case 'building': {
      const draft = state.draft || {};
      const logoFile = draft.logoTmpPath ? { path: draft.logoTmpPath, mimetype: draft.logoMime || 'image/png' } : null;

      // Transient fields stay out of the stored user_context.
      const { logoTmpPath, logoMime, ...contextJson } = draft;
      contextJson.preferredLanguage = conversation.language;

      const { id: projectId, cost, isFree } = await startBuild(user.uid, {
        userContext: contextJson,
        pages: ['Home'],
        logoFile,
        query: draft.name || null,
        source: 'genni',
      });

      await svc.sendGenniMessage(user.uid, conversation.id, {
        type: 'text',
        content: template('build_started', lang),
      });
      await svc.sendGenniMessage(user.uid, conversation.id, {
        type: 'build_started',
        meta: { projectId, cost, isFree },
        stream: false,
      });

      state.step = 'done';
      await svc.updateConversation(conversation.id, { state, status: 'completed', projectId });
      return; // state already persisted
    }
  }

  await svc.updateConversation(conversation.id, { state });
}

// ---------------------------------------------------------------------------
// Input handling
// ---------------------------------------------------------------------------

async function handleInput(user, conversation, input) {
  const state = conversation.state || {};
  state.draft = state.draft || {};
  const ctx = { user, conversation, state };
  const lang = conversation.language;
  const { type, payload = {}, file = null } = input;

  svc.sendTyping(user.uid, conversation.id, true);
  try {
    switch (state.step || 'language') {
      case 'language': {
        if (type === 'chip' && payload.id?.startsWith('lang:')) {
          const code = payload.id.slice(5);
          conversation.language = getLanguage(code).code;
          await svc.updateConversation(conversation.id, { language: conversation.language });
          await db.exec('UPDATE users SET preferred_language = ? WHERE id = ?', [conversation.language, user.uid]).catch(() => {});
          await svc.sendGenniMessage(user.uid, conversation.id, {
            type: 'text',
            content: template('language_set', conversation.language),
          });
          return enterStep(ctx, 'business_search');
        }
        // Any other input: re-show the picker.
        return enterStep(ctx, 'language');
      }

      case 'business_search': {
        if (type === 'chip' && payload.id === 'manual') {
          state.detailsStep = 'basics';
          return enterStep(ctx, 'manual_details');
        }
        if (type === 'text' && payload.text?.trim()) {
          const query = payload.text.trim();
          state.lastQuery = query;
          let candidates = [];
          try {
            candidates = await searchBusinessCandidates(query, 5);
          } catch (e) {
            console.warn('[Genni] business search failed:', e.message);
          }
          if (!candidates.length) {
            await svc.sendGenniMessage(user.uid, conversation.id, { type: 'text', content: template('no_results', lang) });
            state.detailsStep = 'basics';
            state.draft.name = state.draft.name || query.split(',')[0].trim();
            return enterStep(ctx, 'manual_details');
          }
          state.candidates = candidates;
          state.step = 'business_select';
          await svc.sendGenniMessage(user.uid, conversation.id, { type: 'text', content: template('search_results', lang) });
          await svc.sendGenniMessage(user.uid, conversation.id, {
            type: 'business_results',
            meta: { candidates, noneLabel: 'None of these' },
            stream: false,
          });
          return svc.updateConversation(conversation.id, { state });
        }
        return enterStep(ctx, 'business_search');
      }

      case 'business_select': {
        if (type === 'chip' && payload.id === 'none') {
          state.detailsStep = 'basics';
          state.draft.name = state.draft.name || (state.lastQuery || '').split(',')[0].trim();
          return enterStep(ctx, 'manual_details');
        }
        if (type === 'select' && payload.placeId) {
          try {
            const { data, usageLog } = await extractFromPlace(state.lastQuery, payload.placeId);
            if (usageLog?.length) saveTokenUsage(usageLog.map(u => ({ ...u, service: 'extractor' })), null, user.uid).catch(() => {});
            state.draft = { ...state.draft, ...data };
          } catch (e) {
            console.warn('[Genni] extractFromPlace failed:', e.message);
            state.detailsStep = 'basics';
            return enterStep(ctx, 'manual_details');
          }
          state.step = 'details_review';
          const d = state.draft;
          const found = [
            d.address && 'address', d.phone && 'phone', d.openingHours && 'timings',
            (d.reviews || []).length && `${d.reviews.length} customer reviews`,
            (d.placePhotos || []).length && `${d.placePhotos.length} photos`,
          ].filter(Boolean).join(', ');
          const line = await genniLine({
            user, lang, conversationId: conversation.id,
            step: 'details_review',
            stepGoal: 'Confirm what you found about their business from Google (enthusiastically, briefly) and ask them to check it — they can tap "Looks good" or tell you what to correct in their own words.',
            instruction: `You found this business data: ${JSON.stringify({ name: d.name, industry: d.industry, address: d.address, phone: d.phone })}. Also found: ${found || 'basic info only'}. Write your reply.`,
            fallback: `${d.name} — got it! I found your ${found || 'details'} on Google. Check the details below and tap "Looks good", or tell me what to change.`,
          });
          await svc.sendGenniMessage(user.uid, conversation.id, { type: 'text', content: line });
          await svc.sendGenniMessage(user.uid, conversation.id, {
            type: 'summary',
            meta: { ...draftSummaryMeta(state.draft, { isFree: false, cost: null }), compact: true },
            stream: false,
          });
          await svc.sendGenniMessage(user.uid, conversation.id, {
            type: 'chips',
            meta: { options: [{ id: 'confirm_details', label: 'Looks good ✓' }, { id: 'edit_details', label: 'Edit details' }] },
            stream: false,
          });
          return svc.updateConversation(conversation.id, { state });
        }
        return svc.updateConversation(conversation.id, { state });
      }

      case 'details_review': {
        if (type === 'chip' && payload.id === 'confirm_details') return enterStep(ctx, 'logo');
        if (type === 'chip' && payload.id === 'edit_details') {
          state.detailsStep = 'basics';
          state.returnTo = 'logo';
          return enterStep(ctx, 'manual_details');
        }
        if (type === 'text' && payload.text?.trim()) {
          // Free-text correction -> schema parse -> merge. Parse failure degrades to the edit forms.
          try {
            const res = await callGemini({
              systemInstruction: PARSE_SYSTEM,
              prompt: `Current business data: ${JSON.stringify(state.draft)}\n\nUser's correction message: "${payload.text.trim()}"\n\nReturn the fields the user wants changed, with their new values. Include EVERY field the message mentions (a single message may correct several fields); omit fields it doesn't mention.`,
              model: GENNI_MODEL,
              responseSchema: {
                type: 'object',
                properties: {
                  name: { type: 'string' }, industry: { type: 'string' }, description: { type: 'string' },
                  address: { type: 'string' }, phone: { type: 'string' }, email: { type: 'string' },
                  website: { type: 'string' }, openingHours: { type: 'string' },
                  services: { type: 'array', items: { type: 'string' } },
                },
              },
              temperature: 0.1,
              maxTokens: 1024,
              thinkingLevel: 'low',
              timeoutMs: 20000,
            });
            const changes = res.json || {};
            const applied = Object.entries(changes).filter(([, v]) => v && String(v).trim().length);
            if (!applied.length) throw new Error('no fields parsed');
            for (const [k, v] of applied) state.draft[k] = v;
            const line = await genniLine({
              user, lang, conversationId: conversation.id,
              step: 'details_review',
              stepGoal: 'Confirm the corrections you just applied (name the fields) and ask them to tap "Looks good" when ready.',
              instruction: `You updated these fields: ${applied.map(([k]) => k).join(', ')}. Write your short reply.`,
              fallback: `Updated: ${applied.map(([k]) => k).join(', ')}. Anything else, or shall we continue?`,
            });
            await svc.sendGenniMessage(user.uid, conversation.id, { type: 'text', content: line });
            await svc.sendGenniMessage(user.uid, conversation.id, {
              type: 'summary',
              meta: { ...draftSummaryMeta(state.draft, { isFree: false, cost: null }), compact: true },
              stream: false,
            });
            await svc.sendGenniMessage(user.uid, conversation.id, {
              type: 'chips',
              meta: { options: [{ id: 'confirm_details', label: 'Looks good ✓' }, { id: 'edit_details', label: 'Edit details' }] },
              stream: false,
            });
          } catch (e) {
            console.warn('[Genni] correction parse failed:', e.message);
            state.detailsStep = 'basics';
            state.returnTo = 'logo';
            return enterStep(ctx, 'manual_details');
          }
          return svc.updateConversation(conversation.id, { state });
        }
        return svc.updateConversation(conversation.id, { state });
      }

      case 'manual_details': {
        const current = state.detailsStep || 'basics';
        if (type === 'form' && payload.formId === current) {
          mergeFormValues(state.draft, current, payload.values);
        } else if (!(type === 'chip' && payload.id === 'skip')) {
          // Unexpected input: re-show the current form.
          return enterStep(ctx, 'manual_details');
        }
        const idx = DETAIL_ORDER.indexOf(current);
        if (idx < DETAIL_ORDER.length - 1) {
          state.detailsStep = DETAIL_ORDER[idx + 1];
          return enterStep(ctx, 'manual_details');
        }
        state.detailsStep = null;
        const next = state.returnTo === 'logo' ? 'logo' : state.returnTo === 'summary' ? 'summary' : 'logo';
        state.returnTo = null;
        return enterStep(ctx, next);
      }

      case 'logo': {
        if (file) {
          state.draft.logoTmpPath = file.path;
          state.draft.logoMime = file.mimetype;
          return enterStep(ctx, 'style_refs');
        }
        if (type === 'chip' && payload.id === 'skip') return enterStep(ctx, 'style_refs');
        return svc.updateConversation(conversation.id, { state });
      }

      case 'style_refs': {
        const sub = state.refsStep || 'competitor';
        const advance = async () => {
          if (sub === 'competitor') {
            state.refsStep = 'reference';
            return enterStep(ctx, 'style_refs');
          }
          state.refsStep = null;
          return enterStep(ctx, 'summary');
        };
        if (type === 'chip' && payload.id === 'skip') return advance();
        if (type === 'text' && payload.text?.trim()) {
          const url = normalizeUrl(payload.text);
          if (url) {
            if (sub === 'competitor') state.draft.competitorUrl = url;
            else state.draft.referenceUrl = url;
          }
          return advance(); // non-URL text: treat as skip rather than looping
        }
        return svc.updateConversation(conversation.id, { state });
      }

      case 'summary': {
        if (type === 'chip' && payload.id === 'confirm_build') return enterStep(ctx, 'building');
        if (type === 'chip' && payload.id === 'edit_details') {
          state.detailsStep = 'basics';
          state.returnTo = 'summary';
          return enterStep(ctx, 'manual_details');
        }
        return svc.updateConversation(conversation.id, { state });
      }

      case 'done':
      default:
        return svc.updateConversation(conversation.id, { state });
    }
  } finally {
    svc.sendTyping(user.uid, conversation.id, false);
  }
}

async function startOnboarding(user, conversation) {
  const state = conversation.state || {};
  state.draft = state.draft || {};
  return enterStep({ user, conversation, state }, 'language');
}

module.exports = { startOnboarding, handleInput };
