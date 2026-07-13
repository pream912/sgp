/**
 * Production build entry point shared by the /api/build route and Genni.
 *
 * startBuild() owns validation, free-first-build pricing, credit checks, and
 * the project INSERT, then dispatches to the engine the flags select:
 *   - 'agent'  -> runAgentBuildProcess (this file) — the agentic orchestrator
 *                 wired into the same DB/SSE/credits lifecycle as legacy.
 *   - 'legacy' -> the runBuildProcess defined in server.js, registered at boot
 *                 via registerLegacyRunner() (kept there as the rollback path).
 */
const fs = require('fs-extra');
const path = require('path');

const db = require('./db');
const { hub } = require('./sse');
const { getBuildFlags } = require('./flags');
const { getUserCredits, deductCredits } = require('./credits');
const { saveTokenUsage, saveBuildArtifacts, sendBuildNotification } = require('./build-support');
const { buildSiteAgentic } = require('./agent/orchestrator');
const { uploadFile, HOSTING_BUCKET } = require('./storage');
const { toMarkdown, planExtrasFrom } = require('./genni/context-builder');

const ROOT_DIR = path.join(__dirname, '..');

let legacyRunner = null;
function registerLegacyRunner(fn) { legacyRunner = fn; }

/**
 * Validate, price, insert the project row, and kick off the build in the
 * background. Returns { id, cost, isFree, engine } immediately.
 *
 * @param {string} userId
 * @param {object} params
 * @param {object|string} params.userContext - structured context object, or a
 *        pre-rendered markdown string (old frontend payloads)
 * @param {string[]} params.pages
 * @param {object}   [params.logoFile]   - multer-style { path, mimetype }
 * @param {string}   [params.stylePreset]
 * @param {string}   [params.query]
 * @param {string}   [params.source]     - 'api' | 'genni'
 * @param {string}   [params.engineOverride] - admin-only engine override
 */
async function startBuild(userId, params) {
    const { userContext, logoFile = null, stylePreset = null, query = null, source = 'api', engineOverride = null } = params;
    let pages = Array.isArray(params.pages) && params.pages.length ? params.pages : ['Home'];

    if (!userContext) throw httpError(400, 'userContext is required');

    const flags = await getBuildFlags();
    const engine = engineOverride || flags.engine || 'legacy';
    if (engine === 'legacy' && !legacyRunner) throw new Error('Legacy build runner not registered');

    // Free first build: home page only, zero credits, consumed on success only.
    const user = await db.one('SELECT credits, free_build_used FROM users WHERE id = ?', [userId]);
    if (!user) throw httpError(404, 'User not found');

    let cost, isFree = false;
    if (flags.freeFirstBuild && !user.free_build_used) {
        pages = ['Home'];
        cost = 0;
        isFree = true;
    } else {
        cost = pages.length > 1 ? 400 : 200;
        const credits = await getUserCredits(userId);
        if (credits < cost) throw httpError(402, 'Insufficient credits. Please top up your wallet.');
    }

    const id = Date.now().toString();
    const defaultSubdomain = `site-${id}`;

    await db.exec(
        `INSERT INTO projects (id, user_id, query, status, subdomain, logs, build_progress, build_progress_message,
                                is_published, style_preset, user_context, pages, pipeline, is_free_build, created_at)
         VALUES (?, ?, ?, 'starting', ?, ?, 0, 'Starting...', 0, ?, ?, ?, ?, ?, datetime('now'))`,
        [
            id,
            userId,
            query || 'Manual Context',
            defaultSubdomain,
            db.J([]),
            stylePreset || 'standard',
            db.J(userContext),
            db.J(pages),
            engine,
            isFree ? 1 : 0,
        ]
    );

    console.log(`[${id}] Build queued (engine=${engine}, source=${source}, pages=${pages.join(',')}, cost=${cost}${isFree ? ', FREE first build' : ''})`);

    if (engine === 'agent') {
        runAgentBuildProcess(id, userContext, logoFile, pages, userId, cost, query, { isFree })
            .catch(err => console.error(`Background agent build ${id} failed hard:`, err));
    } else {
        legacyRunner(id, userContext, logoFile, pages, userId, cost, query, stylePreset)
            .catch(err => console.error(`Background build ${id} failed hard:`, err));
    }

    return { id, cost, isFree, engine };
}

function httpError(statusCode, message) {
    const e = new Error(message);
    e.statusCode = statusCode;
    return e;
}

// ------------------------------------------------------------------
// Agent build lifecycle — mirrors server.js runBuildProcess contract
// ------------------------------------------------------------------

// Stage/page phase -> build_progress percentage. Pages get the 25→70 band,
// split evenly, with sub-phases interpolated inside each page's slice.
const STAGE_PCT = { plan: 10, images: 18, skeleton: 22, assemble: 78, compile: 84 };
const PAGE_BAND = [25, 70];
const PAGE_PHASE_OFFSET = { generate: 0, critique: 0.7 };

async function runAgentBuildProcess(id, userContext, logoFile, pages, userId, cost, query, opts = {}) {
    console.log(`[${id}] Starting agent build process...`);
    const { isFree = false } = opts;

    const isStructured = userContext && typeof userContext === 'object';
    const contextMarkdown = isStructured ? toMarkdown(userContext) : String(userContext);
    const planExtras = isStructured ? planExtrasFrom(userContext) : '';
    const businessPhotos = (isStructured && userContext.placePhotos) || [];

    const logProgress = async (message, progress = null) => {
        console.log(`[${id}] Progress: ${message}${progress !== null ? ` (${progress}%)` : ''}`);
        try {
            const row = await db.one('SELECT logs FROM projects WHERE id = ?', [id]);
            const logs = row ? db.parseJSON(row.logs, []) : [];
            logs.push({ message, timestamp: new Date().toISOString() });
            if (progress !== null) {
                await db.exec(
                    `UPDATE projects SET status = 'processing', logs = ?, build_progress = ?, build_progress_message = ? WHERE id = ?`,
                    [db.J(logs), progress, message.replace(`[${id}] `, ''), id]
                );
            } else {
                await db.exec(`UPDATE projects SET status = 'processing', logs = ? WHERE id = ?`, [db.J(logs), id]);
            }
            hub.emit(userId, 'project:progress', { projectId: id, progress, message: message.replace(`[${id}] `, '') });
        } catch (e) {
            console.warn(`[${id}] Failed to update log:`, e.message);
        }
    };

    // Track per-page progress within the page band.
    const doneWeight = new Map(); // page -> fraction complete (0..1)
    const pagePct = () => {
        const per = (PAGE_BAND[1] - PAGE_BAND[0]) / pages.length;
        let filled = 0;
        for (const frac of doneWeight.values()) filled += frac * per;
        return Math.round(PAGE_BAND[0] + filled);
    };

    let lastPct = 5;
    const bumpTo = async (pct, message) => {
        if (pct <= lastPct) return logProgress(message);
        lastPct = pct;
        return logProgress(message, pct);
    };

    const onEvent = (evt) => {
        (async () => {
            try {
                if (evt.type === 'stage' && STAGE_PCT[evt.stage] !== undefined) {
                    const labels = {
                        plan: 'Designing your website...',
                        images: 'Picking the right images...',
                        skeleton: 'Setting up the project...',
                        assemble: 'Assembling your site...',
                        compile: 'Polishing the styles...',
                    };
                    await bumpTo(STAGE_PCT[evt.stage], labels[evt.stage] || evt.stage);
                } else if (evt.type === 'page') {
                    doneWeight.set(evt.page, Math.max(doneWeight.get(evt.page) || 0, PAGE_PHASE_OFFSET[evt.phase] ?? 0));
                    const labels = { generate: `Writing the ${evt.page} page...`, critique: `Reviewing the ${evt.page} page design...` };
                    await bumpTo(pagePct(), labels[evt.phase] || `${evt.phase}: ${evt.page}`);
                } else if (evt.type === 'screenshot' && evt.screenshotPath) {
                    doneWeight.set(evt.page, evt.phase === 'fixed' ? 1 : 0.9);
                    const dest = `previews/builds/${id}/${evt.page.toLowerCase().replace(/\s+/g, '-')}-${evt.seq}.jpg`;
                    const url = await uploadFile(evt.screenshotPath, dest, HOSTING_BUCKET, { cacheControl: 'no-cache, max-age=0' });
                    hub.emit(userId, 'project:preview', { projectId: id, page: evt.page, url, seq: evt.seq, stage: evt.phase });
                    if (evt.phase === 'fixed') await bumpTo(pagePct(), `Improved the ${evt.page} page design.`);
                }
            } catch (e) {
                console.warn(`[${id}] onEvent(${evt.type}) failed (non-fatal):`, e.message);
            }
        })();
    };

    try {
        await logProgress('Starting build engine...', 5);

        const result = await buildSiteAgentic(
            id,
            contextMarkdown,
            { pages, logoFile, businessPhotos, planExtras, onEvent },
            (message) => { logProgress(message.replace(`[${id}] `, '')).catch(() => {}); }
        );

        // Token usage: transcript entries carry Gemini usageMetadata-shaped usage.
        const usageEntries = (result.transcript || [])
            .filter(t => t.usage && (t.usage.totalTokenCount || t.usage.promptTokenCount))
            .map(t => ({ ...t.usage, service: 'agent', action: t.step + (t.page ? `:${t.page}` : '') }));
        if (usageEntries.length) await saveTokenUsage(usageEntries, id, userId);

        await logProgress('Build success! Saving & Deploying...', 86);

        const sourcePath = path.join(ROOT_DIR, 'projects_source', id);
        const tempPath = path.join(ROOT_DIR, 'temp', id);
        await fs.move(tempPath, sourcePath);
        await logProgress('Source code saved.', 88);

        await logProgress('Saving to Cloud Storage...', 92);
        const savedUrl = await saveBuildArtifacts(id, path.join(sourcePath, 'dist'), userId);

        if (cost > 0) {
            try {
                await deductCredits(userId, cost, `Generate ${pages.length > 1 ? 'Multi-Page' : 'Single-Page'} Site (${id})`);
                await logProgress('Credits deducted.', 96);
            } catch (creditErr) {
                console.error(`[${id}] Failed to deduct credits after success:`, creditErr);
            }
        } else if (isFree) {
            await logProgress('Your first home page is on us — no credits charged.', 96);
        }

        // Consume the free-build entitlement only on success.
        if (isFree) {
            await db.exec('UPDATE users SET free_build_used = 1 WHERE id = ? AND free_build_used = 0', [userId])
                .catch(e => console.error(`[${id}] Failed to mark free build used:`, e.message));
        }

        const row = await db.one('SELECT logs FROM projects WHERE id = ?', [id]);
        const logs = row ? db.parseJSON(row.logs, []) : [];
        logs.push({ message: 'Process Finished Successfully.', timestamp: new Date().toISOString() });
        await db.exec(
            `UPDATE projects SET status = 'completed', is_published = 0, url = ?, completed_at = datetime('now'), logs = ? WHERE id = ?`,
            [savedUrl, db.J(logs), id]
        );

        hub.emit(userId, 'project:updated', { projectId: id, status: 'completed' });
        console.log(`[${id}] Agent build finished successfully (${result.llmCalls} LLM calls).`);

        sendBuildNotification(userId, id, query, 'success').catch(err =>
            console.error(`[${id}] Failed to send success email:`, err.message)
        );

        // Genni's follow-up (domain suggestions) for chat-initiated builds.
        // Lazy require: genni/onboarding-flow imports this module.
        require('./genni/postbuild').onBuildCompleted(userId, id, query)
            .catch(err => console.warn(`[${id}] Post-build follow-up failed:`, err.message));
    } catch (error) {
        console.error(`[${id}] Agent Build Process Failed:`, error);
        const isRateLimited = error.message === 'RATE_LIMITED';
        const userError = isRateLimited
            ? 'We are currently experiencing high demand. Please retry after a few minutes.'
            : error.message;

        try {
            const row = await db.one('SELECT logs FROM projects WHERE id = ?', [id]);
            const logs = row ? db.parseJSON(row.logs, []) : [];
            logs.push({ message: `Error: ${userError}`, timestamp: new Date().toISOString() });
            await db.exec(
                `UPDATE projects SET status = 'failed', build_progress_message = ?, logs = ? WHERE id = ?`,
                [userError, db.J(logs), id]
            );
            hub.emit(userId, 'project:updated', { projectId: id, status: 'failed', error: userError });
        } catch (_) {}

        sendBuildNotification(userId, id, query, 'failed', userError).catch(err =>
            console.error(`[${id}] Failed to send failure email:`, err.message)
        );

        try {
            const tempPath = path.join(ROOT_DIR, 'temp', id);
            if (await fs.pathExists(tempPath)) await fs.remove(tempPath);
        } catch (_) {}
    }
}

module.exports = { startBuild, runAgentBuildProcess, registerLegacyRunner };
