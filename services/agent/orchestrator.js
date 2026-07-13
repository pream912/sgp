/**
 * Agentic builder orchestration (prototype).
 *
 * Replaces the current "blind single-shot per page" pipeline with a BOUNDED
 * feedback loop. Per page:
 *   PLAN (Gemini, once for the whole site)
 *   -> GENERATE (Kimi)                       services/ai-coder.generateCode
 *   -> VALIDATE (cheerio, free)              -> bounded Kimi fix if errors
 *   -> RENDER (CF Browser Rendering)
 *   -> VISION CRITIQUE (Gemini + check_contrast tool, <=1 pass)
 *      -> bounded Kimi fix if actionable -> re-validate -> re-render for report
 *   ASSEMBLE + COMPILE: reuse builder.setupConfig + builder.compileSite verbatim.
 *
 * Isolation: no D1, no credits, no SSE. Output is a local dist dir (the CLI
 * optionally uploads it under prototype/<runId>/). Gemini reuses the Vertex auth
 * path already in services/ai-gateway.js (via services/agent/gemini-agent.js).
 */
const fs = require('fs-extra');
const path = require('path');

const config = require('./config');
const { callGemini, runGeminiAgent } = require('./gemini-agent');
const { validateHtml, checkContrast, issuesToLog } = require('./validators');
const { renderHtml } = require('./render');
const { pickTools, CRITIQUE_TOOL_NAMES } = require('./tools');
const { genPage, fixPage } = require('./coder');
const { fetchImages } = require('../images');
const { setupConfig, getTailwindConfigFromDesign, compileSite } = require('../builder');

const SKELETON_DIR = path.join(__dirname, '../../templates/html-skeleton');
const VALID_STYLE_PRESETS = ['standard', 'vibrant', 'minimal', 'soft', 'professional', 'neumorphic'];

// ---- small helpers ---------------------------------------------------------

function makeBudget(cap) {
    return {
        count: 0, cap,
        spend(label) { if (this.count >= this.cap) { console.warn(`[agent] budget cap ${this.cap} hit at "${label}"`); return false; } this.count++; return true; },
    };
}

function extractJson(text) {
    if (!text) return null;
    const cleaned = text.replace(/^```(?:json)?\s*/i, '').replace(/\s*```\s*$/i, '').trim();
    try { return JSON.parse(cleaned); } catch (_) {}
    const first = cleaned.indexOf('{'), last = cleaned.lastIndexOf('}');
    if (first >= 0 && last > first) { try { return JSON.parse(cleaned.slice(first, last + 1)); } catch (_) {} }
    return null;
}

function pageFilename(pageName) {
    return pageName === 'Home' ? 'index.html' : `${pageName.toLowerCase().replace(/\s+/g, '-')}.html`;
}

function cleanGeneratedHtml(text) {
    let t = (text || '').replace(/```html/g, '').replace(/```/g, '');
    const end = t.lastIndexOf('</html>');
    return end >= 0 ? t.slice(0, end + 7) : t;
}

function extractLayoutReference(homeCode) {
    const headerMatch = homeCode.match(/<(\w+)[^>]*data-section="header"[^>]*>([\s\S]*?)<\/\1>/);
    const footerMatch = homeCode.match(/<(\w+)[^>]*data-section="footer"[^>]*>([\s\S]*?)<\/\1>/);
    if (headerMatch && footerMatch) return { header: headerMatch[0], footer: footerMatch[0] };
    return null;
}

function contextForPage(userContext, pageSpecs, pageName) {
    const spec = pageSpecs && pageSpecs[pageName];
    if (!spec) return userContext;
    return `${userContext}\n\nPAGE PLAN for "${pageName}" (follow this section order + content guidance):\n${JSON.stringify(spec, null, 2)}`;
}

/** Deterministic, free safety net: force readable text on background if the plan's palette fails AA. */
function enforceContrast(designSystem) {
    const p = designSystem.colorPalette;
    if (!p) return;
    const fix = (fgKey, bgKey) => {
        const c = checkContrast(p[fgKey], p[bgKey]);
        if (c.valid && !c.passAA) {
            // Pick black/near-white based on background luminance.
            const bgC = checkContrast('#FFFFFF', p[bgKey]);
            p[fgKey] = (bgC.ratio || 0) >= 4.5 ? '#F5F5F5' : '#1A1A1A';
            console.log(`[agent] contrast fix: ${fgKey} -> ${p[fgKey]} (was failing AA on ${bgKey})`);
        }
    };
    fix('text', 'background');
    fix('buttonText', 'buttonBackground');
}

// ---- PLAN ------------------------------------------------------------------

const PLAN_SYSTEM = `You are a senior brand designer and web architect. Given a business, you produce a complete, tasteful design system AND a per-page section plan. You avoid generic, templated looks: choose a distinctive but appropriate palette, font pairing, and layout style. Output STRICT JSON only — no prose, no markdown.`;

async function planSite({ userContext, pages, logoBuffer, logoMimeType, geminiModel, budget, planExtras = '' }) {
    const shape = `{
  "businessName": string,
  "colorPalette": { "primary": hex, "secondary": hex, "accent": hex, "background": hex, "text": hex, "buttonBackground": hex, "buttonText": hex },
  "googleFonts": { "heading": "valid Google Font name", "body": "valid Google Font name" },
  "vibe": [string],
  "stylePreset": one of ${JSON.stringify(VALID_STYLE_PRESETS)},
  "heroStyle": string, "headerStyle": string, "footerStyle": string, "layoutStructure": string,
  "imageKeywords": [5 strings],
  "pageSpecs": { "<PageName>": { "sections": [{ "name": string, "purpose": string, "contentHints": string }], "notes": string } }
}`;

    const instruction = `Business context:\n${userContext}\n\nPages to design: ${JSON.stringify(pages)}.\n\nReturn JSON exactly in this shape:\n${shape}\n\nRules:\n- colorPalette MUST be WCAG AA: text vs background and buttonText vs buttonBackground each >= 4.5:1.\n- stylePreset MUST be one of ${JSON.stringify(VALID_STYLE_PRESETS)}.\n- pageSpecs MUST include an entry for every page in ${JSON.stringify(pages)}, each with a varied, non-repetitive section list (avoid stacking identical centered blocks).\n- imageKeywords: exactly 5 SHORT generic search terms, 1-2 words each (e.g. ["coffee","cafe","latte","beans","barista"]). NOT full sentences or descriptive phrases — they are sent to a stock-photo search API.${planExtras ? `\n${planExtras}` : ''}`;

    const parts = [{ text: instruction }];
    if (logoBuffer && logoMimeType) {
        parts.push({ inline_data: { mime_type: logoMimeType, data: logoBuffer.toString('base64') } });
        parts.push({ text: 'A logo is attached. Derive a sophisticated, web-ready palette inspired by it (adjust raw/neon colours to be professional). Keep background/text highly readable.' });
    }

    budget.spend('plan');
    const res = await callGemini({ systemInstruction: PLAN_SYSTEM, parts, model: geminiModel, json: true, temperature: 0.6, maxTokens: 8192 });
    const plan = res.json || extractJson(res.text);
    if (!plan || !plan.colorPalette) throw new Error(`Planner returned unusable JSON (finish=${res.finishReason}, len=${res.text?.length || 0})`);
    if (!VALID_STYLE_PRESETS.includes(plan.stylePreset)) plan.stylePreset = 'standard';
    return { plan, usage: res.usage };
}

// ---- VISION CRITIQUE -------------------------------------------------------

const CRITIQUE_SYSTEM = `You are a meticulous senior design reviewer. You look at a screenshot of a rendered web page and report only REAL, visible, fixable defects — readability/contrast, layout problems (overlap, overflow, awkward empty space, misalignment), weak visual hierarchy, broken or missing images, and overall polish. You may call check_contrast to confirm a colour you suspect is unreadable. If the page already looks good, say so. Output STRICT JSON only at the end.`;

async function critiquePage({ pageName, screenshotBase64, mimeType, designSystem, validation, ctx, geminiModel, budget }) {
    const palette = designSystem.colorPalette || {};
    const valSummary = validation.issues.length ? issuesToLog(validation.issues) : 'No programmatic issues.';
    const prompt = `Page: "${pageName}". Business: ${designSystem.businessName || 'n/a'}.
Theme colours: ${JSON.stringify(palette)}.
Programmatic validation (already run): \n${valSummary}\n
Review the attached screenshot. Return JSON exactly:
{ "needsFix": boolean, "severity": "low"|"med"|"high", "issues": [ { "area": string, "problem": string, "fix": string } ] }
Only include issues that are clearly visible in the screenshot and fixable in HTML/Tailwind. If it looks good, return needsFix=false with an empty issues array.`;

    const userParts = [
        { text: prompt },
        { inline_data: { mime_type: mimeType || 'image/jpeg', data: screenshotBase64 } },
    ];
    const { declarations, executors } = pickTools(ctx, CRITIQUE_TOOL_NAMES);

    budget.spend(`critique:${pageName}`);
    const res = await runGeminiAgent({
        systemInstruction: CRITIQUE_SYSTEM, userParts,
        tools: declarations, toolExecutors: executors,
        model: config.CRITIQUE_MODEL, maxSteps: config.MAX_AGENT_STEPS, temperature: 0.3, maxTokens: 4096,
    });
    const verdict = extractJson(res.text) || { needsFix: false, severity: 'low', issues: [] };
    return { verdict, toolCalls: res.toolCalls, usage: res.usage };
}

// ---- per-page pipeline -----------------------------------------------------

// Kimi codegen with retry/backoff. Kimi K2.6 is slow (2–4 min/call) and can hit
// the Workers AI server-side timeout; one transient failure shouldn't fail a page.
async function generateWithRetry({ designSystem, pageCtx, pages, layoutReference, stylePreset }, budget, onProgress, runId, pageName) {
    let lastErr;
    for (let attempt = 1; attempt <= config.GEN_RETRIES; attempt++) {
        if (!budget.spend(`generate:${pageName}:${attempt}`)) { lastErr = new Error('LLM call budget exhausted'); break; }
        try {
            const { code, usage } = await genPage(designSystem, pageCtx, pageName, pages, layoutReference, stylePreset);
            const cleaned = cleanGeneratedHtml(code);
            if (!cleaned.trim().endsWith('</html>')) throw new Error('incomplete HTML (no </html>)');
            return { code: cleaned, usage };
        } catch (e) {
            lastErr = e;
            onProgress(`[${runId}] ${pageName} generate attempt ${attempt}/${config.GEN_RETRIES} failed: ${e.message}`);
            if (attempt < config.GEN_RETRIES) await new Promise(r => setTimeout(r, 3000 * attempt));
        }
    }
    throw lastErr || new Error(`generation failed for ${pageName}`);
}

async function buildPage({ pageName, designSystem, userContext, layoutReference, stylePreset, runId, ctx, geminiModel, budget, onProgress, transcript, distDir }) {
    const record = { page: pageName, fixes: 0, critiqued: false, rendered: false };
    const pageCtx = contextForPage(userContext, designSystem.pageSpecs, pageName);
    const onEvent = ctx.onEvent || (() => {});

    // GENERATE (Kimi) with retry/backoff
    onEvent({ type: 'page', page: pageName, phase: 'generate' });
    onProgress(`[${runId}] Generating ${pageName}...`);
    const gen = await generateWithRetry({ designSystem, pageCtx, pages: ctx.pages, layoutReference, stylePreset }, budget, onProgress, runId, pageName);
    let code = gen.code;
    transcript.push({ page: pageName, step: 'generate', usage: gen.usage });

    // VALIDATE (free) + bounded programmatic fix
    let validation = validateHtml(code, { designSystem });
    record.validationBefore = validation.counts;
    let progFixes = 0;
    while (!validation.ok && progFixes < config.MAX_PROGRAMMATIC_FIX) {
        progFixes++;
        onProgress(`[${runId}] Fixing ${pageName} (${validation.counts.errors} errors)...`);
        if (!budget.spend(`progfix:${pageName}`)) break;
        try {
            const fixed = await fixPage(code, issuesToLog(validation.issues), stylePreset);
            code = cleanGeneratedHtml(fixed.code);
            validation = validateHtml(code, { designSystem });
            record.fixes++;
            transcript.push({ page: pageName, step: 'programmatic-fix', issues: validation.counts, usage: fixed.usage });
        } catch (e) {
            transcript.push({ page: pageName, step: 'programmatic-fix-failed', error: e.message });
            onProgress(`[${runId}] ${pageName} programmatic fix failed (${e.message}) — keeping current HTML.`);
            break;
        }
    }

    // RENDER + VISION CRITIQUE (bounded)
    let renders = 0;
    if (config.MAX_VISION_CRITIQUE > 0 && budget.count < budget.cap) {
        const shot = await renderHtml(code, { runId, designSystem, label: pageName });
        renders++;
        if (shot.ok && shot.base64) {
            record.rendered = true;
            record.screenshotPath = shot.screenshotPath;
            onEvent({ type: 'screenshot', page: pageName, screenshotPath: shot.screenshotPath, seq: ++ctx.shotSeq, phase: 'initial' });
            onEvent({ type: 'page', page: pageName, phase: 'critique' });
            try {
                const { verdict, toolCalls, usage } = await critiquePage({
                    pageName, screenshotBase64: shot.base64, mimeType: shot.mimeType,
                    designSystem, validation, ctx, geminiModel, budget,
                });
                record.critiqued = true;
                record.critique = verdict;
                transcript.push({ page: pageName, step: 'critique', verdict, toolCalls, usage });

                if (verdict.needsFix && Array.isArray(verdict.issues) && verdict.issues.length && budget.count < budget.cap) {
                    onProgress(`[${runId}] Applying ${verdict.issues.length} design fixes to ${pageName}...`);
                    const critiqueLog = verdict.issues.map(i => `- [${i.area}] ${i.problem} -> ${i.fix}`).join('\n');
                    if (budget.spend(`visionfix:${pageName}`)) {
                        try {
                            const fixed = await fixPage(code, critiqueLog, stylePreset);
                            const newCode = cleanGeneratedHtml(fixed.code);
                            const reval = validateHtml(newCode, { designSystem });
                            // Accept the fix only if it doesn't regress structural validity.
                            if (reval.counts.errors <= validation.counts.errors) {
                                code = newCode; validation = reval; record.fixes++;
                                transcript.push({ page: pageName, step: 'vision-fix', issues: reval.counts, usage: fixed.usage });
                                if (renders < config.RENDER_PER_PAGE_CAP) {
                                    const shot2 = await renderHtml(code, { runId, designSystem, label: `${pageName}-fixed` });
                                    if (shot2.ok) {
                                        record.screenshotPath = shot2.screenshotPath;
                                        onEvent({ type: 'screenshot', page: pageName, screenshotPath: shot2.screenshotPath, seq: ++ctx.shotSeq, phase: 'fixed' });
                                    }
                                    renders++;
                                }
                            } else {
                                transcript.push({ page: pageName, step: 'vision-fix-rejected', reason: 'would regress structural validity' });
                            }
                        } catch (e) {
                            transcript.push({ page: pageName, step: 'vision-fix-failed', error: e.message });
                            onProgress(`[${runId}] ${pageName} vision fix failed (${e.message}) — keeping validated HTML.`);
                        }
                    }
                }
            } catch (e) {
                transcript.push({ page: pageName, step: 'critique-failed', error: e.message });
                onProgress(`[${runId}] ${pageName} critique failed (${e.message}) — keeping validated HTML.`);
            }
        } else {
            transcript.push({ page: pageName, step: 'render-skipped', error: shot.error, mode: shot.mode });
            onProgress(`[${runId}] Render unavailable for ${pageName} (${shot.error || 'no creds'}) — keeping validated HTML.`);
        }
    }

    record.validationAfter = validation.counts;
    await fs.writeFile(path.join(distDir, pageFilename(pageName)), code);
    return { code, record };
}

// ---- public: full agentic build -------------------------------------------

/**
 * @param {string} runId
 * @param {string} userContext   - same markdown context the production builder uses
 * @param {object} opts
 * @param {string[]} [opts.pages=['Home']]
 * @param {object} [opts.logoFile]      - { path, mimetype } (multer-style) or null
 * @param {string} [opts.geminiModel]   - override config.GEMINI_MODEL
 * @param {string[]} [opts.businessPhotos] - real photo URLs to prefer over stock
 * @param {string} [opts.planExtras]    - extra low-priority guidance appended to the PLAN prompt
 * @param {boolean} [opts.compile=true] - false: skip CLI compile (draft uses runtime Tailwind)
 * @param {function} [opts.onEvent]     - structured lifecycle events for production wiring:
 *          {type:'stage', stage}  {type:'page', page, phase, attempt?}  {type:'screenshot', page, screenshotPath, seq, phase}
 * @param {function} [onProgress]
 * @returns {Promise<{ distDir, designSystem, transcript, validatorReport, screenshotPaths, llmCalls }>}
 */
async function buildSiteAgentic(runId, userContext, opts = {}, onProgress = () => {}) {
    const {
        pages = ['Home'], logoFile = null, geminiModel = config.GEMINI_MODEL,
        businessPhotos = [], planExtras = '', compile = true, onEvent = () => {},
    } = opts;
    const tempDir = path.join(__dirname, '../../temp', runId);
    const distDir = path.join(tempDir, 'dist');
    const transcript = [];
    const budget = makeBudget(config.TOTAL_LLM_CALL_CAP);

    try {
        let logoBuffer = null, logoMimeType = null;
        if (logoFile) { logoBuffer = await fs.readFile(logoFile.path); logoMimeType = logoFile.mimetype; }

        // 1. PLAN (Gemini)
        onEvent({ type: 'stage', stage: 'plan' });
        onProgress(`[${runId}] Planning design system + page layouts (Gemini ${geminiModel})...`);
        const { plan, usage: planUsage } = await planSite({ userContext, pages, logoBuffer, logoMimeType, geminiModel, budget, planExtras });
        const designSystem = plan;
        enforceContrast(designSystem);
        transcript.push({ step: 'plan', stylePreset: designSystem.stylePreset, usage: planUsage });

        // 2. Images
        onEvent({ type: 'stage', stage: 'images' });
        onProgress(`[${runId}] Fetching images...`);
        designSystem.imageUrls = await fetchImages(designSystem.imageKeywords || ['business'], 12, businessPhotos);

        // 3. Skeleton (mirror builder.js)
        onEvent({ type: 'stage', stage: 'skeleton' });
        onProgress(`[${runId}] Copying skeleton...`);
        await fs.copy(SKELETON_DIR, tempDir, {
            filter: (src) => !src.includes(`${path.sep}node_modules${path.sep}`) && !src.endsWith(`${path.sep}node_modules`),
        });
        try { await fs.ensureSymlink(path.join(SKELETON_DIR, 'node_modules'), path.join(tempDir, 'node_modules')); }
        catch (e) { console.error(`[${runId}] symlink node_modules:`, e.message); }
        await fs.ensureDir(distDir);
        if (logoFile) {
            await fs.copy(logoFile.path, path.join(distDir, 'logo.png'));
            designSystem.logoUrl = './logo.png';
            await fs.remove(logoFile.path).catch(() => {});
        }

        const ctx = { runId, designSystem, userContext, pages, stylePreset: designSystem.stylePreset, budget, onEvent, shotSeq: 0 };
        const records = [];
        const screenshotPaths = {};

        // 4. Home first (anchors shared header/footer), then fan-out.
        const homeName = pages.find(p => p === 'Home') || pages[0];
        const home = await buildPage({ pageName: homeName, designSystem, userContext, layoutReference: null, stylePreset: designSystem.stylePreset, runId, ctx, geminiModel, budget, onProgress, transcript, distDir });
        records.push(home.record);
        if (home.record.screenshotPath) screenshotPaths[homeName] = home.record.screenshotPath;
        const layoutReference = extractLayoutReference(home.code);

        const remaining = pages.filter(p => p !== homeName);
        if (remaining.length) {
            const queue = remaining.slice();
            const workers = Array.from({ length: Math.min(config.PAGE_CONCURRENCY, queue.length) }, async () => {
                while (queue.length) {
                    const pageName = queue.shift();
                    if (!pageName) return;
                    try {
                        const r = await buildPage({ pageName, designSystem, userContext, layoutReference, stylePreset: designSystem.stylePreset, runId, ctx, geminiModel, budget, onProgress, transcript, distDir });
                        records.push(r.record);
                        if (r.record.screenshotPath) screenshotPaths[pageName] = r.record.screenshotPath;
                    } catch (e) {
                        console.error(`[${runId}] page ${pageName} failed: ${e.message}`);
                        records.push({ page: pageName, failed: true, error: e.message });
                        transcript.push({ page: pageName, step: 'page-failed', error: e.message });
                    }
                }
            });
            await Promise.all(workers);
        }

        // 5. site-config.json + site-nav.js (mirror builder.js)
        const siteConfig = {
            businessName: designSystem.businessName || 'Business',
            logo: logoFile ? './logo.png' : null,
            navigation: pages.map(p => ({ name: p, path: pageFilename(p), children: [] })),
        };
        await fs.writeFile(path.join(distDir, 'site-config.json'), JSON.stringify(siteConfig, null, 2));
        await fs.copy(path.join(SKELETON_DIR, 'site-nav.js'), path.join(distDir, 'site-nav.js'));

        // 6. Reuse production assembly + compile
        onEvent({ type: 'stage', stage: 'assemble' });
        onProgress(`[${runId}] Injecting config & compiling CSS (reusing production assembly)...`);
        const tailwindConfigObj = getTailwindConfigFromDesign(designSystem);
        await fs.writeFile(path.join(tempDir, 'tailwind.config.js'), `module.exports = ${JSON.stringify(tailwindConfigObj, null, 2)}`);
        await setupConfig(tempDir, distDir, designSystem, runId, tailwindConfigObj);
        if (compile) {
            onEvent({ type: 'stage', stage: 'compile' });
            await compileSite(tempDir);
        }

        const validatorReport = {
            totalErrors: records.reduce((s, r) => s + (r.validationAfter?.errors || 0), 0),
            totalWarnings: records.reduce((s, r) => s + (r.validationAfter?.warnings || 0), 0),
            pages: records,
        };
        return { distDir, designSystem, transcript, validatorReport, screenshotPaths, llmCalls: budget.count };
    } catch (err) {
        console.error(`[${runId}] agentic build failed:`, err.message);
        throw err;
    }
}

// ---- public: NL edit agent (pain point c) ----------------------------------

const { regenerateSection, regeneratePage, updateSectionContent } = require('../ai-coder');

const EDIT_PLAN_SYSTEM = `You route a natural-language website edit to the cheapest correct tool. Output STRICT JSON only.`;

/**
 * Apply one natural-language edit to an already-built page and verify it.
 * @param {string} runId        - an existing temp/<runId> build
 * @param {string} pageFile     - e.g. 'index.html'
 * @param {string} instruction  - natural-language edit
 * @param {object} [opts]
 */
async function editSiteAgentic(runId, pageFile, instruction, opts = {}) {
    const { geminiModel = config.GEMINI_MODEL } = opts;
    const tempDir = path.join(__dirname, '../../temp', runId);
    const distDir = path.join(tempDir, 'dist');
    const filePath = path.join(distDir, pageFile);
    if (!await fs.pathExists(filePath)) throw new Error(`Page not found: ${filePath}`);

    const original = await fs.readFile(filePath, 'utf-8');
    const designSystem = await fs.readJson(path.join(distDir, 'site-config.json')).catch(() => ({}));

    // 1. Plan the edit (Gemini): pick tool + (for content swaps) the exact values.
    const planRes = await callGemini({
        systemInstruction: EDIT_PLAN_SYSTEM, model: geminiModel, json: true, temperature: 0.2,
        prompt: `Instruction: "${instruction}".
Choose ONE tool:
- "content" for a simple text/image value swap (cheapest, no AI): give sectionId, type ("text"|"image"), originalValue, newValue.
- "section" to restyle/rewrite one section: give sectionId and a refined instruction.
- "page" for whole-page/layout changes: give a refined instruction.
Available section ids (data-section) in this page: ${JSON.stringify(Array.from(new Set((original.match(/data-section="([^"]+)"/g) || []).map(s => s.replace(/data-section="|"/g, '')))))}.
Return JSON: { "tool": "content"|"section"|"page", "sectionId"?: string, "type"?: "text"|"image", "originalValue"?: string, "newValue"?: string, "instruction"?: string }`,
    });
    const plan = planRes.json || extractJson(planRes.text) || { tool: 'page', instruction };

    // 2. Apply
    let edited;
    if (plan.tool === 'content' && plan.sectionId) {
        edited = await updateSectionContent(original, plan.sectionId, plan.type || 'text', plan.originalValue, plan.newValue);
    } else if (plan.tool === 'section' && plan.sectionId) {
        edited = cleanGeneratedHtml((await regenerateSection(original, plan.sectionId, plan.instruction || instruction)).code);
    } else {
        edited = cleanGeneratedHtml((await regeneratePage(original, plan.instruction || instruction)).code);
    }

    // 3. Verify (no structural regression) + render check
    const before = validateHtml(original, { designSystem });
    const after = validateHtml(edited, { designSystem });
    if (after.counts.errors > before.counts.errors) {
        return { applied: false, reason: 'edit introduced structural errors', plan, before: before.counts, after: after.counts };
    }
    await fs.writeFile(filePath, edited);
    await compileSite(tempDir).catch(() => {}); // keep CSS in sync
    const shot = await renderHtml(edited, { runId, designSystem, label: `${pageFile}-edited` }).catch(() => ({ ok: false }));

    return { applied: true, tool: plan.tool, plan, before: before.counts, after: after.counts, screenshotPath: shot.screenshotPath || null };
}

module.exports = { buildSiteAgentic, editSiteAgentic };
