/**
 * Render generated page HTML to a screenshot for the vision-critique step,
 * WITHOUT deploying the real site.
 *
 * Why a "preview document" instead of the raw HTML:
 *   The coder emits Tailwind classes but no stylesheet — production compiles
 *   Tailwind into style.css via setupConfig (services/builder.js). Mid-loop we
 *   don't want to run the CLI on every iteration, so we inject the Tailwind CDN
 *   + the same theme config (colors/fonts) so classes resolve in-browser. We
 *   also neutralize AOS (which sets [data-aos] opacity:0 until scroll) so the
 *   whole page is visible in a single static screenshot.
 *
 * Two modes (services/agent/config.js RENDER_MODE):
 *   'raw-html'     — POST { html } to CF Browser Rendering (no upload). Fast.
 *   'upload-first' — upload the preview to R2 and screenshot its public URL.
 *                    Guaranteed-compatible fallback if `html` is unsupported.
 */
const fs = require('fs-extra');
const path = require('path');
const config = require('./config');
require('dotenv').config();

const CF_ENDPOINT = (acct) => `https://api.cloudflare.com/client/v4/accounts/${acct}/browser-rendering/screenshot`;

/**
 * Wrap raw page HTML into a self-contained, fully-visible preview document.
 * `runtimeUrl` is the self-hosted Tailwind Play script (services/tailwind-runtime);
 * cdn.tailwindcss.com is only a last-resort fallback when it isn't resolvable.
 */
function buildPreviewHtml(html, designSystem = {}, runtimeUrl = null) {
    const palette = designSystem.colorPalette || {};
    const fonts = designSystem.googleFonts || {};
    const twConfig = {
        theme: {
            extend: {
                fontFamily: {
                    heading: [fonts.heading || 'sans-serif', 'sans-serif'],
                    body: [fonts.body || 'sans-serif', 'sans-serif'],
                },
                colors: {
                    primary: palette.primary, secondary: palette.secondary, accent: palette.accent,
                    background: palette.background, text: palette.text,
                    buttonBackground: palette.buttonBackground, buttonText: palette.buttonText,
                },
            },
        },
    };

    let fontLink = '';
    if (fonts.heading || fonts.body) {
        const h = (fonts.heading || 'Inter').replace(/\s+/g, '+');
        const b = (fonts.body || 'Inter').replace(/\s+/g, '+');
        fontLink = `<link href="https://fonts.googleapis.com/css2?family=${h}:wght@400;700&family=${b}:wght@300;400;600&display=swap" rel="stylesheet">`;
    }

    const inject = `
${fontLink}
<script src="${runtimeUrl || 'https://cdn.tailwindcss.com'}"></script>
<script>tailwind.config = ${JSON.stringify(twConfig)};</script>
<style>
  /* Neutralize AOS so the full page is captured in a static screenshot */
  [data-aos]{opacity:1 !important;transform:none !important;transition:none !important;}
</style>
`;

    if (/<\/head>/i.test(html)) return html.replace(/<\/head>/i, `${inject}\n</head>`);
    // No <head> (unlikely) — prepend.
    return inject + html;
}

async function cfScreenshot(bodyExtra, outPath) {
    const acct = process.env.CF_ACCOUNT_ID;
    const token = process.env.CF_API_TOKEN || process.env.CF_AI_GATEWAY_TOKEN;
    if (!acct || !token) return { ok: false, error: 'CF_ACCOUNT_ID / CF_API_TOKEN not set' };

    const body = {
        viewport: config.RENDER_VIEWPORT,
        // fullPage so the vision critique reviews the WHOLE page (offerings,
        // testimonials, forms, footer) — not just the hero. The preview document
        // already neutralizes AOS, so below-fold sections are visible in the capture.
        screenshotOptions: { type: 'jpeg', quality: 75, fullPage: true },
        gotoOptions: { waitUntil: 'networkidle0', timeout: 30000 },
        // Settle after network-idle so icon webfonts (FontAwesome) finish painting
        // — otherwise the critique sees unpainted glyphs as "broken/tofu" boxes and
        // wastes fix passes on a phantom problem.
        waitForTimeout: config.RENDER_SETTLE_MS,
        ...bodyExtra,
    };

    const resp = await fetch(CF_ENDPOINT(acct), {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
    });
    if (!resp.ok) {
        const errText = await resp.text();
        return { ok: false, error: `CF Browser Rendering ${resp.status}: ${errText.slice(0, 300)}` };
    }
    const buffer = Buffer.from(await resp.arrayBuffer());
    await fs.ensureDir(path.dirname(outPath));
    await fs.writeFile(outPath, buffer);
    return { ok: true, base64: buffer.toString('base64') };
}

/**
 * Render a page and save a JPEG screenshot.
 * @param {string} html        - raw page HTML (pre-setupConfig)
 * @param {object} opts
 * @param {string} opts.runId
 * @param {string} [opts.label='page']
 * @param {object} [opts.designSystem]
 * @param {string} [opts.mode]  - override config.RENDER_MODE
 * @returns {Promise<{ ok, screenshotPath, base64, mimeType, mode, url?, error? }>}
 */
async function renderHtml(html, opts = {}) {
    const { runId, label = 'page', designSystem = {}, mode = config.RENDER_MODE } = opts;
    let runtimeUrl = null;
    try {
        const { getRuntimeUrl } = require('../tailwind-runtime');
        runtimeUrl = await getRuntimeUrl();
    } catch (e) {
        console.warn('[Render] tailwind-runtime lookup failed, using public CDN:', e.message);
    }
    const preview = buildPreviewHtml(html, designSystem, runtimeUrl);
    const outPath = path.join(__dirname, '../../temp', runId, 'shots', `${label}.jpg`);

    try {
        if (mode === 'upload-first') {
            const { uploadFile } = require('../storage');
            const htmlPath = path.join(__dirname, '../../temp', runId, '_render', `${label}.html`);
            await fs.ensureDir(path.dirname(htmlPath));
            await fs.writeFile(htmlPath, preview);
            const dest = `${config.PROTOTYPE_PREFIX}/${runId}/_render/${label}.html`;
            const url = await uploadFile(htmlPath, dest, config.SITES_BUCKET);
            const shot = await cfScreenshot({ url }, outPath);
            return { ...shot, screenshotPath: shot.ok ? outPath : null, mimeType: 'image/jpeg', mode, url };
        }
        // default: raw-html
        const shot = await cfScreenshot({ html: preview }, outPath);
        return { ...shot, screenshotPath: shot.ok ? outPath : null, mimeType: 'image/jpeg', mode };
    } catch (e) {
        return { ok: false, error: String(e.message || e), mode };
    }
}

module.exports = { renderHtml, buildPreviewHtml };
