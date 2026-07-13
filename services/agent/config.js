/**
 * Central config for the agentic builder prototype (services/agent/*).
 *
 * Everything that controls cost / latency lives here so a reviewer can tune the
 * loop without touching logic. All values are overridable via env. Defaults are
 * deliberately TIGHT (single fix pass, single critique pass) per the prototype
 * brief: "keep cost & latency near the current pipeline".
 */
require('dotenv').config();

function intEnv(name, fallback) {
    const v = parseInt(process.env[name], 10);
    return Number.isFinite(v) ? v : fallback;
}

module.exports = {
    // ---- Models ----------------------------------------------------------
    // Gemini drives planning + vision critique (reuses the Vertex auth path
    // already in services/ai-gateway.js). Flash by default for cost/latency.
    GEMINI_MODEL: process.env.AGENT_GEMINI_MODEL || 'gemini-2.5-flash', // planning (cheap, easy task)
    GEMINI_MODEL_PRO: 'gemini-2.5-pro', // reachable via --gemini pro for hard cases
    // Dedicated vision-critique model (the quality gate / reviewer). Default to the
    // stronger Gemini 3.5 Flash so the reviewer is at least as capable as the author.
    CRITIQUE_MODEL: process.env.AGENT_CRITIQUE_MODEL || 'gemini-3.5-flash',
    // Kimi does the bulk HTML generation (unchanged from production).
    KIMI_MODEL: process.env.AGENT_KIMI_MODEL || '@cf/moonshotai/kimi-k2.6',

    // Code generation provider: 'kimi' (Cloudflare Workers AI, cheap but slow,
    // 2-4 min/call) or 'gemini' (via the gateway/BYOK, ~45s/call). When 'gemini',
    // CODEGEN_MODEL is used. Default gemini-3.5-flash (GA, "Gemini 3.5 Flash");
    // gemini-3-flash-preview (its preview alias), gemini-3.1-flash-lite,
    // gemini-flash-latest, gemini-2.5-flash are also valid in this project.
    CODEGEN_PROVIDER: (process.env.AGENT_CODEGEN || 'kimi').toLowerCase(),
    CODEGEN_MODEL: process.env.AGENT_CODEGEN_MODEL || 'gemini-3.5-flash',
    CODEGEN_MAX_TOKENS: intEnv('AGENT_CODEGEN_MAX_TOKENS', 32768), // room for full HTML + Gemini-3 thinking
    // Gemini-3 reasoning effort for codegen/fixes (low|medium|high|''). HTML
    // generation barely benefits from deep reasoning, and last run "thinking" was
    // 38% of tokens (Home codegen thought MORE than it wrote) — 'low' cuts latency.
    CODEGEN_THINKING: process.env.AGENT_CODEGEN_THINKING || 'low',

    // ---- Loop bounds (the cost governors) --------------------------------
    GEN_RETRIES: intEnv('AGENT_GEN_RETRIES', 2),                   // retries for the (slow, timeout-prone) Kimi codegen
    MAX_PROGRAMMATIC_FIX: intEnv('AGENT_MAX_PROGRAMMATIC_FIX', 1), // cheerio-driven Kimi fixes per page
    MAX_VISION_CRITIQUE: intEnv('AGENT_MAX_VISION_CRITIQUE', 1),   // expensive render+vision passes per page (cap 2)
    RENDER_PER_PAGE_CAP: intEnv('AGENT_RENDER_PER_PAGE_CAP', 2),   // initial render + <=1 re-render
    // Hard circuit breaker across a whole site build. On hit, the loop stops
    // spending and assembles the last-known-good HTML rather than hanging.
    TOTAL_LLM_CALL_CAP: intEnv('AGENT_TOTAL_LLM_CALL_CAP', 40),
    // Max function-call turns inside a single Gemini agent invocation.
    MAX_AGENT_STEPS: intEnv('AGENT_MAX_STEPS', 8),

    // ---- Rendering -------------------------------------------------------
    // 'raw-html'      -> POST { html } to CF Browser Rendering (no deploy).
    // 'upload-first'  -> assemble+compile+upload one file, screenshot the URL.
    // raw-html is preferred but unverified for this account; upload-first is the
    // guaranteed fallback (it mirrors the existing post-build screenshot path).
    RENDER_MODE: process.env.AGENT_RENDER_MODE || 'raw-html',
    RENDER_VIEWPORT: { width: 1280, height: 800 },
    RENDER_SETTLE_MS: intEnv('AGENT_RENDER_SETTLE_MS', 1500), // let icon webfonts paint before capture

    // ---- Storage (prototype outputs only; never the live sites prefix) ---
    SITES_BUCKET: process.env.R2_SITES_BUCKET || 'genweb-sites',
    R2_PUBLIC_DOMAIN: process.env.R2_PUBLIC_DOMAIN || 'pub-r2.genweb.in',
    PROTOTYPE_PREFIX: 'prototype', // all uploads land under prototype/<runId>/...

    // ---- Concurrency -----------------------------------------------------
    PAGE_CONCURRENCY: intEnv('AGENT_PAGE_CONCURRENCY', 3), // matches builder.js fan-out
};
