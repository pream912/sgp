#!/usr/bin/env node
/**
 * Agentic builder prototype — CLI harness.
 *
 * Runs the agentic pipeline (services/agent/orchestrator.buildSiteAgentic) on a
 * real business and, with --compare, runs the CURRENT production pipeline
 * (services/builder.buildSite) on the same input so you can eyeball quality and
 * compare an OBJECTIVE validator-failure count. No D1, no credits, no SSE.
 *
 * Usage:
 *   node scripts/agent-build.js "BeanCraft Coffee Seattle" --pages Home,About,Services --compare --upload
 *   node scripts/agent-build.js --probe                # check CF raw-html + Vertex tool-calling first
 *   node scripts/agent-build.js "<query>" --gemini pro --context-file ./ctx.md
 *   node scripts/agent-build.js --edit-run agent-123 --edit-page index.html --edit "make the hero darker"
 *
 * Env: CF_ACCOUNT_ID, CF_API_TOKEN (rendering + Kimi), GCP_PROJECT + ADC (Gemini),
 *      R2_* (only for --upload), UNSPLASH_ACCESS_KEY/PEXELS_API_KEY (images).
 */
require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });
const path = require('path');
const fs = require('fs-extra');

// --codegen / --codegen-model must reach env BEFORE config is required
// (config captures these at module-load time).
{ const i = process.argv.indexOf('--codegen'); if (i >= 0 && process.argv[i + 1]) process.env.AGENT_CODEGEN = process.argv[i + 1]; }
{ const i = process.argv.indexOf('--codegen-model'); if (i >= 0 && process.argv[i + 1]) process.env.AGENT_CODEGEN_MODEL = process.argv[i + 1]; }
{ const i = process.argv.indexOf('--critique-model'); if (i >= 0 && process.argv[i + 1]) process.env.AGENT_CRITIQUE_MODEL = process.argv[i + 1]; }

const config = require('../services/agent/config');
const { validateHtml } = require('../services/agent/validators');

// ---- arg parsing -----------------------------------------------------------

const argv = process.argv.slice(2);
function flag(name) { return argv.includes(`--${name}`); }
function opt(name, def) { const i = argv.indexOf(`--${name}`); return i >= 0 && argv[i + 1] ? argv[i + 1] : def; }
const positional = argv.filter((a, i) => !a.startsWith('--') && !(i > 0 && argv[i - 1].startsWith('--') && !['compare', 'upload', 'probe'].includes(argv[i - 1].slice(2))));

const query = positional[0];
const pages = opt('pages', 'Home,About,Services').split(',').map(s => s.trim()).filter(Boolean);
const doCompare = flag('compare');
const doUpload = flag('upload');
const doProbe = flag('probe');
const geminiModel = opt('gemini', 'flash') === 'pro' ? config.GEMINI_MODEL_PRO : config.GEMINI_MODEL;
const contextFile = opt('context-file');
const editRun = opt('edit-run');

const BEANCRAFT = `**Business Name**: BeanCraft Coffee
**Business Summary**: A relaxed, modern Seattle coffee shop specializing in cold brew and single-origin Ethiopian beans. Open early mornings and late nights.
**Industry**: Cafe / Coffee Shop
**Selling Points**:
- House-roasted single-origin Ethiopian beans
- 24-hour cold-brew steeping process
- Cozy minimalist interior, free wifi, plenty of outlets
**Contact Details**
*   **Address**: 312 Pine St, Seattle, WA 98101
*   **Phone**: (206) 555-0142
*   **Email**: hello@beancraft.coffee
**Key Services**: Pour-over coffee, Cold brew on tap, Espresso & milk drinks
**Reviews**: "Best cold brew in Seattle." - Alex M. / "Cozy atmosphere, perfect for working." - Sam R.`;

// ---- helpers ---------------------------------------------------------------

function assertEnv(keys) {
    const missing = keys.filter(k => !process.env[k] || String(process.env[k]).startsWith('your_'));
    return missing;
}

async function getUserContext() {
    if (contextFile) return fs.readFile(contextFile, 'utf-8');
    if (!query) { console.log('[harness] No query given — using built-in BeanCraft sample.'); return BEANCRAFT; }
    if (flag('extract')) {
        try {
            const { extractFromUrl } = require('../services/business-extractor');
            const data = await extractFromUrl(query);
            return typeof data === 'string' ? data : (data.userContext || data.context || JSON.stringify(data, null, 2));
        } catch (e) {
            console.warn(`[harness] extraction failed (${e.message}) — using minimal context.`);
        }
    }
    return `**Business Name**: ${query}\n**Business Summary**: ${query}. Generate a professional, modern website appropriate for this business.`;
}

async function validateDist(distDir) {
    const files = (await fs.readdir(distDir)).filter(f => f.endsWith('.html'));
    let errors = 0, warnings = 0;
    const perFile = {};
    for (const f of files) {
        const html = await fs.readFile(path.join(distDir, f), 'utf-8');
        const r = validateHtml(html);
        errors += r.counts.errors; warnings += r.counts.warnings;
        perFile[f] = { chars: html.length, ...r.counts, issues: r.issues };
    }
    return { files: files.length, errors, warnings, perFile };
}

// ---- probes ----------------------------------------------------------------

async function runProbes() {
    console.log('\n=== PROBE 1: CF Browser Rendering raw-html support ===');
    const { renderHtml } = require('../services/agent/render');
    const sample = '<!DOCTYPE html><html><head><title>probe</title></head><body><h1 style="color:#111">Probe OK</h1></body></html>';
    const raw = await renderHtml(sample, { runId: 'probe', designSystem: {}, mode: 'raw-html' });
    console.log(raw.ok ? `  raw-html: OK (saved ${raw.screenshotPath})` : `  raw-html: FAILED — ${raw.error}`);
    if (!raw.ok && !assertEnv(['R2_ACCESS_KEY_ID', 'R2_SECRET_ACCESS_KEY']).length) {
        const up = await renderHtml(sample, { runId: 'probe', designSystem: {}, mode: 'upload-first' });
        console.log(up.ok ? `  upload-first fallback: OK (${up.url})` : `  upload-first fallback: FAILED — ${up.error}`);
    }

    console.log('\n=== PROBE 2: Vertex Gemini function-calling ===');
    try {
        const { runGeminiAgent } = require('../services/agent/gemini-agent');
        const res = await runGeminiAgent({
            systemInstruction: 'You can call tools. Use them when asked.',
            userParts: [{ text: 'Call add with a=2 and b=3, then reply with just the number.' }],
            tools: [{ name: 'add', description: 'Add two numbers', parameters: { type: 'object', properties: { a: { type: 'number' }, b: { type: 'number' } }, required: ['a', 'b'] } }],
            toolExecutors: { add: async ({ a, b }) => ({ sum: a + b }) },
            model: geminiModel, maxSteps: 4,
        });
        console.log(`  tool calls: ${JSON.stringify(res.toolCalls)}`);
        console.log(`  final text: "${res.text}"  | steps=${res.steps}`);
        console.log(res.toolCalls.length ? '  function-calling: OK' : '  function-calling: model did NOT call the tool (check format)');
    } catch (e) {
        console.log(`  function-calling: FAILED — ${e.message}`);
    }
    console.log('');
}

// ---- edit mode -------------------------------------------------------------

async function runEdit() {
    const { editSiteAgentic } = require('../services/agent/orchestrator');
    const page = opt('edit-page', 'index.html');
    const instruction = opt('edit');
    if (!instruction) { console.error('--edit "<instruction>" is required with --edit-run'); process.exit(1); }
    console.log(`[harness] Editing ${editRun}/${page}: "${instruction}"`);
    const res = await editSiteAgentic(editRun, page, instruction, { geminiModel });
    console.log(JSON.stringify(res, null, 2));
}

// ---- main ------------------------------------------------------------------

(async () => {
    if (doProbe) { await runProbes(); return; }
    if (editRun) { await runEdit(); return; }

    // Credential preflight (clear failure, like the brief asks).
    const missGemini = assertEnv(['GCP_PROJECT']);
    const missCF = assertEnv(['CF_ACCOUNT_ID']);
    const cfToken = process.env.CF_API_TOKEN || process.env.CF_AI_GATEWAY_TOKEN;
    if (missGemini.length) { console.error(`[harness] Missing for Gemini planner/critique: ${missGemini.join(', ')} (+ ADC / GOOGLE_APPLICATION_CREDENTIALS).`); process.exit(1); }
    if (missCF.length || !cfToken) { console.error('[harness] Missing CF_ACCOUNT_ID / CF_API_TOKEN (needed for Kimi codegen + rendering).'); process.exit(1); }
    process.env.CF_API_TOKEN = cfToken;

    const userContext = await getUserContext();
    const runId = `agent-${Date.now()}`;
    const onProgress = (m) => console.log(`  ${m}`);

    const codegenLabel = config.CODEGEN_PROVIDER === 'gemini' ? `gemini:${config.CODEGEN_MODEL}` : 'kimi';
    console.log(`\n[harness] Agentic build ${runId} | pages=${pages.join(',')} | codegen=${codegenLabel} | plan=${geminiModel} | critique=${config.CRITIQUE_MODEL} | render=${config.RENDER_MODE}`);
    const t0 = Date.now();
    const { buildSiteAgentic } = require('../services/agent/orchestrator');
    const agent = await buildSiteAgentic(runId, userContext, { pages, geminiModel }, onProgress);
    const agentSecs = ((Date.now() - t0) / 1000).toFixed(1);
    const agentVal = await validateDist(agent.distDir);

    let baseline = null, baselineVal = null, baselineSecs = null, baselineId = null;
    if (doCompare) {
        baselineId = `baseline-${Date.now()}`;
        console.log(`\n[harness] Baseline (current pipeline) build ${baselineId}...`);
        const { buildSite } = require('../services/builder');
        const tb = Date.now();
        try {
            baseline = await buildSite(baselineId, userContext, null, pages, onProgress, 'standard');
            baselineSecs = ((Date.now() - tb) / 1000).toFixed(1);
            baselineVal = await validateDist(baseline.distDir);
        } catch (e) {
            console.error(`[harness] baseline build failed: ${e.message}`);
        }
    }

    // Upload for side-by-side viewing.
    const urls = {};
    if (doUpload) {
        const missR2 = assertEnv(['R2_ACCESS_KEY_ID', 'R2_SECRET_ACCESS_KEY']);
        if (missR2.length) {
            console.warn(`[harness] --upload skipped, missing: ${missR2.join(', ')}`);
        } else {
            const { uploadDirectory } = require('../services/storage');
            await uploadDirectory(agent.distDir, `${config.PROTOTYPE_PREFIX}/${runId}/agent`, config.SITES_BUCKET);
            urls.agent = `https://${config.R2_PUBLIC_DOMAIN}/${config.SITES_BUCKET}/${config.PROTOTYPE_PREFIX}/${runId}/agent/index.html`;
            if (baseline) {
                await uploadDirectory(baseline.distDir, `${config.PROTOTYPE_PREFIX}/${runId}/baseline`, config.SITES_BUCKET);
                urls.baseline = `https://${config.R2_PUBLIC_DOMAIN}/${config.SITES_BUCKET}/${config.PROTOTYPE_PREFIX}/${runId}/baseline/index.html`;
            }
        }
    }

    // ---- report ----
    const row = (label, val, secs, calls) =>
        `  ${label.padEnd(10)} files=${String(val?.files ?? '-').padEnd(3)} errors=${String(val?.errors ?? '-').padEnd(4)} warnings=${String(val?.warnings ?? '-').padEnd(4)} time=${secs ?? '-'}s${calls != null ? ` llmCalls=${calls}` : ''}`;
    console.log('\n================= COMPARISON =================');
    console.log(row('AGENT', agentVal, agentSecs, agent.llmCalls));
    if (baselineVal) console.log(row('BASELINE', baselineVal, baselineSecs, null));
    console.log('==============================================');
    console.log(`  agent stylePreset=${agent.designSystem.stylePreset} | pages critiqued: ${agent.validatorReport.pages.filter(p => p.critiqued).map(p => p.page).join(', ') || 'none (render unavailable)'}`);
    if (urls.agent) { console.log(`\n  AGENT   : ${urls.agent}`); if (urls.baseline) console.log(`  BASELINE: ${urls.baseline}`); }
    else { console.log(`\n  open ${agent.distDir}/index.html`); if (baseline) console.log(`  open ${baseline.distDir}/index.html`); }

    const report = {
        runId, query: query || '(sample)', pages, planModel: geminiModel, critiqueModel: config.CRITIQUE_MODEL, renderMode: config.RENDER_MODE,
        codegen: { provider: config.CODEGEN_PROVIDER, model: config.CODEGEN_PROVIDER === 'gemini' ? config.CODEGEN_MODEL : config.KIMI_MODEL },
        agent: { secs: agentSecs, llmCalls: agent.llmCalls, stylePreset: agent.designSystem.stylePreset, validation: agentVal, transcript: agent.transcript, validatorReport: agent.validatorReport, screenshotPaths: agent.screenshotPaths },
        baseline: baseline ? { id: baselineId, secs: baselineSecs, validation: baselineVal } : null,
        urls,
    };
    const reportPath = path.join(agent.distDir, '..', 'agent-report.json');
    await fs.writeJson(reportPath, report, { spaces: 2 });
    console.log(`\n  full report: ${reportPath}`);
})().catch(e => { console.error('\n[harness] FAILED:', e.message); console.error(e.stack); process.exit(1); });
