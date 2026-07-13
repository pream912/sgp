/**
 * Genni's tool registry — the "MCP server over GenWeb's services".
 * Mirrors services/agent/tools.js: DECLARATIONS (Gemini functionDeclarations)
 * + createToolExecutors(userCtx). Adding a capability = one declaration + one
 * executor. Every executor is scoped to userCtx.uid — a tool can never touch
 * another user's data.
 *
 * CREDIT SAFETY: no executor spends credits. Actions that cost credits are
 * start_* tools: they validate, mint a signed pending action (10-min expiry)
 * in conversation state, and surface a confirmation card. The spend happens in
 * POST /api/genni/conversations/:id/confirm after full re-validation.
 */
const crypto = require('crypto');
const db = require('../db');
const { getUserCredits, getTransactions } = require('../credits');
const { getSuggestions } = require('../domains');
const pageService = require('../page-service');
const svc = require('./service');

const ACTION_TTL_MS = 10 * 60 * 1000;

const PUBLISH_PRICING = {
  plans: [
    { plan: 'basic', creditsPerYear: 500, includes: 'yourname.genweb.in subdomain, SSL, hosting' },
    { plan: 'single', creditsPerYear: 2000, includes: 'custom domain, single page, no GenWeb branding' },
    { plan: 'multi', creditsPerYear: 3000, includes: 'custom domain, unlimited pages, no GenWeb branding' },
  ],
  discounts: '2 years: 5% off, 3 years: 10% off',
  note: '1 credit = ₹1',
};

const DECLARATIONS = [
  {
    name: 'list_projects',
    description: "List the user's website projects with status, publish state, and URLs.",
    parameters: { type: 'object', properties: {} },
  },
  {
    name: 'get_project_status',
    description: 'Get one project: status, build progress, pages, publish/subscription info.',
    parameters: {
      type: 'object',
      properties: { projectId: { type: 'string', description: 'Project id from list_projects' } },
      required: ['projectId'],
    },
  },
  {
    name: 'get_credits',
    description: "Get the user's current credit balance and recent transactions.",
    parameters: { type: 'object', properties: {} },
  },
  {
    name: 'get_leads_summary',
    description: 'Count of leads received from published sites, plus the latest few.',
    parameters: {
      type: 'object',
      properties: { projectId: { type: 'string', description: 'Optional: limit to one project' } },
    },
  },
  {
    name: 'get_referral_stats',
    description: "The user's referral code, how many friends joined, and credits earned.",
    parameters: { type: 'object', properties: {} },
  },
  {
    name: 'list_domains',
    description: 'List custom domains the user owns through GenWeb.',
    parameters: { type: 'object', properties: {} },
  },
  {
    name: 'suggest_domains',
    description: 'Suggest available domain names for a business name or keyword.',
    parameters: {
      type: 'object',
      properties: { query: { type: 'string', description: 'Business name or keyword, e.g. "saravana bhavan"' } },
      required: ['query'],
    },
  },
  {
    name: 'get_publish_pricing',
    description: 'Publishing plan prices and what each plan includes.',
    parameters: { type: 'object', properties: {} },
  },
  {
    name: 'start_add_page',
    description: 'Start adding a new page to a project (costs 100 credits — the user must confirm on a card before anything is charged).',
    parameters: {
      type: 'object',
      properties: {
        projectId: { type: 'string' },
        pageName: { type: 'string', description: 'e.g. "Contact", "Gallery"' },
        isSubPage: { type: 'boolean', description: 'true to nest under the "More" menu' },
        pagePrompt: { type: 'string', description: 'Optional instructions for the page content' },
      },
      required: ['projectId', 'pageName'],
    },
  },
  {
    name: 'start_section_redesign',
    description: 'Start an AI redesign of one section of a page (costs 50 credits — the user must confirm on a card before anything is charged).',
    parameters: {
      type: 'object',
      properties: {
        projectId: { type: 'string' },
        sectionId: { type: 'string', description: 'The data-section id, e.g. "hero", "testimonials"' },
        instruction: { type: 'string', description: 'What to change' },
        page: { type: 'string', description: 'Optional page file, e.g. "about.html"' },
      },
      required: ['projectId', 'sectionId', 'instruction'],
    },
  },
];

/**
 * @param {object} userCtx - { uid, name, conversationId }
 */
function createToolExecutors(userCtx) {
  const uid = userCtx.uid;

  async function mintPendingAction(action) {
    const conversation = await svc.getConversation(userCtx.conversationId, uid);
    if (!conversation) throw new Error('Conversation not found');
    const state = conversation.state || {};
    state.pendingActions = state.pendingActions || {};

    const actionId = crypto.randomUUID();
    state.pendingActions[actionId] = { ...action, createdAt: Date.now(), expiresAt: Date.now() + ACTION_TTL_MS };
    // Keep the pending map tidy: drop anything expired.
    for (const [id, a] of Object.entries(state.pendingActions)) {
      if (a.expiresAt < Date.now()) delete state.pendingActions[id];
    }
    await svc.updateConversation(conversation.id, { state });

    await svc.sendGenniMessage(uid, conversation.id, {
      type: 'confirm_action',
      meta: { actionId, action: { type: action.type, label: action.label, cost: action.cost, details: action.details } },
      stream: false,
    });
    return actionId;
  }

  return {
    list_projects: async () => {
      const rows = await db.query(
        `SELECT id, query, status, is_published, subdomain, custom_domain, build_progress, url, created_at
         FROM projects WHERE user_id = ? ORDER BY created_at DESC LIMIT 20`,
        [uid]
      );
      return {
        projects: rows.map(r => ({
          projectId: r.id,
          name: r.query,
          status: r.status,
          published: !!r.is_published,
          buildProgress: r.build_progress,
          address: r.custom_domain || (r.is_published && r.subdomain ? `${r.subdomain}.genweb.in` : null),
          createdAt: r.created_at,
        })),
      };
    },

    get_project_status: async ({ projectId }) => {
      const r = await db.one('SELECT * FROM projects WHERE id = ? AND user_id = ?', [projectId, uid]);
      if (!r) return { error: 'Project not found' };
      return {
        projectId: r.id,
        name: r.query,
        status: r.status,
        buildProgress: r.build_progress,
        buildMessage: r.build_progress_message,
        pages: db.parseJSON(r.pages, []),
        published: !!r.is_published,
        plan: r.published_plan,
        subscriptionExpiry: r.subscription_expiry,
        url: r.url,
        subdomain: r.subdomain,
        customDomain: r.custom_domain,
      };
    },

    get_credits: async () => {
      const balance = await getUserCredits(uid);
      const txns = await getTransactions(uid, 5);
      return {
        balance,
        recentTransactions: (txns || []).map(t => ({
          amount: t.amount, type: t.type, description: t.description, at: t.createdAt || t.created_at,
        })),
      };
    },

    get_leads_summary: async ({ projectId } = {}) => {
      const where = projectId ? 'user_id = ? AND project_id = ?' : 'user_id = ?';
      const params = projectId ? [uid, projectId] : [uid];
      const countRow = await db.one(`SELECT COUNT(*) AS n FROM leads WHERE ${where}`, params);
      const latest = await db.query(
        `SELECT project_id, form_data, created_at FROM leads WHERE ${where} ORDER BY created_at DESC LIMIT 5`,
        params
      );
      return {
        totalLeads: countRow?.n || 0,
        latest: latest.map(l => ({ projectId: l.project_id, data: db.parseJSON(l.form_data, {}), at: l.created_at })),
      };
    },

    get_referral_stats: async () => {
      const user = await db.one('SELECT referral_code FROM users WHERE id = ?', [uid]);
      const stats = await db.one(
        `SELECT COUNT(*) AS invited,
                SUM(CASE WHEN status = 'completed' THEN 1 ELSE 0 END) AS completed,
                SUM(CASE WHEN status = 'completed' THEN reward_amount ELSE 0 END) AS earned
         FROM referrals WHERE referrer_user_id = ?`,
        [uid]
      );
      return {
        referralCode: user?.referral_code || null,
        invited: stats?.invited || 0,
        completed: stats?.completed || 0,
        creditsEarned: stats?.earned || 0,
      };
    },

    list_domains: async () => {
      const rows = await db.query('SELECT domain, status, created_at FROM domains WHERE user_id = ?', [uid]);
      return { domains: rows.map(d => ({ domain: d.domain, status: d.status, since: d.created_at })) };
    },

    suggest_domains: async ({ query }) => {
      if (!query || !query.trim()) return { error: 'query is required' };
      const clean = query.trim().toLowerCase().replace(/[^a-z0-9\s-]/g, '').replace(/\s+/g, '');
      try {
        const suggestions = await getSuggestions(clean, 5);
        return { suggestions };
      } catch (e) {
        return { error: `Domain lookup unavailable right now (${e.message})` };
      }
    },

    get_publish_pricing: async () => PUBLISH_PRICING,

    start_add_page: async ({ projectId, pageName, isSubPage = false, pagePrompt = null }) => {
      try {
        const { cost } = await pageService.validateAddPage(uid, projectId, { pageName, isSubPage });
        const balance = await getUserCredits(uid);
        if (balance < cost) return { error: `Not enough credits: adding a page costs ${cost}, balance is ${balance}.` };
        await mintPendingAction({
          type: 'add_page',
          label: `Add "${pageName}" page`,
          cost,
          details: `New ${isSubPage ? 'sub-' : ''}page "${pageName}" for project ${projectId}`,
          params: { projectId, pageName, isSubPage, pagePrompt },
        });
        return { confirmationShown: true, note: 'A confirmation card is now visible to the user. Tell them to review and confirm it — do not claim the page was added.' };
      } catch (e) {
        return { error: e.message };
      }
    },

    start_section_redesign: async ({ projectId, sectionId, instruction, page = null }) => {
      try {
        const { cost, targetFile } = await pageService.validateSectionRedesign(uid, projectId, { sectionId, page });
        const balance = await getUserCredits(uid);
        if (balance < cost) return { error: `Not enough credits: a section redesign costs ${cost}, balance is ${balance}.` };
        await mintPendingAction({
          type: 'section_redesign',
          label: `Redesign "${sectionId}" section`,
          cost,
          details: `${instruction} (on ${targetFile})`,
          params: { projectId, sectionId, instruction, page },
        });
        return { confirmationShown: true, note: 'A confirmation card is now visible to the user. Tell them to review and confirm it — do not claim the redesign happened.' };
      } catch (e) {
        return { error: e.message };
      }
    },
  };
}

/**
 * Execute a previously minted pending action after the user's explicit
 * confirmation. Re-validates everything; this is the ONLY place chat-initiated
 * credit spends happen.
 */
async function executePendingAction(user, conversation, actionId) {
  const state = conversation.state || {};
  const action = state.pendingActions?.[actionId];
  if (!action) throw Object.assign(new Error('This action has expired or was already handled.'), { statusCode: 410 });
  if (action.expiresAt < Date.now()) {
    delete state.pendingActions[actionId];
    await svc.updateConversation(conversation.id, { state });
    throw Object.assign(new Error('This action expired. Ask Genni again if you still want it.'), { statusCode: 410 });
  }

  // One-shot: remove before executing so a double-tap can't run it twice.
  delete state.pendingActions[actionId];
  await svc.updateConversation(conversation.id, { state });

  if (action.type === 'add_page') {
    const result = await pageService.addPage(user.uid, action.params.projectId, action.params);
    return { type: action.type, ...result };
  }
  if (action.type === 'section_redesign') {
    const result = await pageService.redesignSection(user.uid, action.params.projectId, action.params);
    return { type: action.type, ...result };
  }
  throw Object.assign(new Error(`Unknown action type "${action.type}"`), { statusCode: 400 });
}

module.exports = { DECLARATIONS, createToolExecutors, executePendingAction };
