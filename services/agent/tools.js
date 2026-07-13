/**
 * Tool registry for the agentic builder. Each tool = a Gemini functionDeclaration
 * (schema the model sees) + a JS executor that wraps EXISTING code. Executors are
 * bound to a per-build context via createToolExecutors(ctx).
 *
 * Tools never write to D1/credits and never deploy. The only side effects are
 * temp-dir screenshots (render) and read-only API calls (images). Final assembly
 * + R2 upload happen in the CLI harness, not here.
 *
 * Most executors are also called directly by the orchestrator (deterministic,
 * bounded loop). The subset actually exposed to the Gemini critique agent is
 * CRITIQUE_TOOL_NAMES — kept tiny (check_contrast) so tool-use stays cheap and
 * side-effect-free: the model can verify a colour it suspects is low-contrast
 * before committing to a fix recommendation.
 */
const { validateHtml, checkContrast, issuesToLog } = require('./validators');
const { renderHtml } = require('./render');
const { fetchImages } = require('../images');
const { generateCode, fixCode } = require('../ai-coder');

// ---- Gemini function declarations -----------------------------------------

const DECLARATIONS = {
    validate_html: {
        name: 'validate_html',
        description: 'Run free structural/accessibility checks on a page\'s HTML (missing </html>, broken image src, duplicate ids, empty sections, missing header/footer, style-guide violations, theme contrast). Returns issues with severity.',
        parameters: {
            type: 'object',
            properties: { html: { type: 'string', description: 'The full page HTML to validate.' } },
            required: ['html'],
        },
    },
    check_contrast: {
        name: 'check_contrast',
        description: 'Compute the WCAG contrast ratio between a foreground and background hex colour and whether it passes AA (>=4.5:1) and AA-large (>=3:1). Use this to confirm a suspected readability problem before recommending a fix.',
        parameters: {
            type: 'object',
            properties: {
                fg: { type: 'string', description: 'Foreground hex colour, e.g. "#1A1A1A".' },
                bg: { type: 'string', description: 'Background hex colour, e.g. "#FFFFFF".' },
            },
            required: ['fg', 'bg'],
        },
    },
    fetch_images: {
        name: 'fetch_images',
        description: 'Fetch real stock image URLs (Unsplash/Pexels) for given keywords. Use when a section needs a real image to replace a broken/placeholder one.',
        parameters: {
            type: 'object',
            properties: {
                keywords: { type: 'array', items: { type: 'string' }, description: 'Search keywords.' },
                count: { type: 'integer', description: 'How many URLs (default 6).' },
            },
            required: ['keywords'],
        },
    },
    fix_html: {
        name: 'fix_html',
        description: 'Ask the code model to return a corrected full HTML document given the current HTML and a list of issues to fix.',
        parameters: {
            type: 'object',
            properties: {
                html: { type: 'string', description: 'Current (broken) HTML.' },
                issues: { type: 'string', description: 'Newline bullet list of issues to fix.' },
            },
            required: ['html', 'issues'],
        },
    },
};

// Tools exposed to the vision-critique agent (cheap, side-effect-free).
const CRITIQUE_TOOL_NAMES = ['check_contrast'];

// ---- Executors -------------------------------------------------------------

/**
 * @param {object} ctx
 * @param {string} ctx.runId
 * @param {object} ctx.designSystem
 * @param {string} ctx.userContext
 * @param {string[]} ctx.pages
 * @param {string} [ctx.stylePreset]
 * @param {object} ctx.budget  - { spend(label):boolean, count, cap }
 */
function createToolExecutors(ctx) {
    return {
        validate_html: async ({ html }) => validateHtml(html, { designSystem: ctx.designSystem }),

        check_contrast: async ({ fg, bg }) => checkContrast(fg, bg),

        fetch_images: async ({ keywords, count }) => {
            const urls = await fetchImages(Array.isArray(keywords) ? keywords : [keywords], count || 6);
            return { urls };
        },

        // Renders to a temp screenshot. Not exposed to the agent (can't return an
        // image into the function-call loop) — used directly by the orchestrator.
        render_html: async ({ html, label }) =>
            renderHtml(html, { runId: ctx.runId, designSystem: ctx.designSystem, label: label || 'page' }),

        generate_page: async ({ pageName, layoutReference }) => {
            if (!ctx.budget.spend(`generate:${pageName}`)) return { error: 'LLM call budget exhausted' };
            const { code, usage } = await generateCode(
                ctx.designSystem, ctx.userContext, pageName, ctx.pages, layoutReference || null, ctx.stylePreset);
            return { html: code, usage };
        },

        fix_html: async ({ html, issues }) => {
            if (!ctx.budget.spend('fix_html')) return { error: 'LLM call budget exhausted' };
            const log = typeof issues === 'string' ? issues : issuesToLog(issues);
            const { code, usage } = await fixCode(html, log, ctx.stylePreset);
            return { html: code, usage };
        },
    };
}

/** Build {declarations, executors} for a named subset (for runGeminiAgent). */
function pickTools(ctx, names) {
    const executors = createToolExecutors(ctx);
    return {
        declarations: names.map(n => DECLARATIONS[n]).filter(Boolean),
        executors: Object.fromEntries(names.map(n => [n, executors[n]]).filter(([, fn]) => fn)),
    };
}

module.exports = { DECLARATIONS, CRITIQUE_TOOL_NAMES, createToolExecutors, pickTools };
