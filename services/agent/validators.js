/**
 * Free, deterministic validators for generated page HTML. NO LLM calls.
 *
 * This is gate #1 of the agentic loop and the objective quality metric for the
 * comparison harness. It runs on the RAW model output (before builder.js
 * setupConfig injects style.css / AOS / fonts / nav), so it must not expect
 * those injected assets — and conversely must not flag their absence.
 *
 * Each issue: { type, severity: 'error'|'warning', detail, selector? }.
 *  - 'error'   : will break rendering / JS / the build, or violates a hard rule
 *                (missing </html>, duplicate id, broken image src, missing
 *                required header/footer section).
 *  - 'warning' : quality/accessibility/style-guide problems the vision pass or a
 *                fix can address (missing alt, <style> blocks, arbitrary hex,
 *                low theme contrast, empty section).
 */
const cheerio = require('cheerio');

// ---- WCAG contrast helpers -------------------------------------------------

function parseHex(hex) {
    if (typeof hex !== 'string') return null;
    let h = hex.trim().replace(/^#/, '');
    if (h.length === 3) h = h.split('').map(c => c + c).join('');
    if (!/^[0-9a-fA-F]{6}$/.test(h)) return null;
    return { r: parseInt(h.slice(0, 2), 16), g: parseInt(h.slice(2, 4), 16), b: parseInt(h.slice(4, 6), 16) };
}

function relativeLuminance({ r, g, b }) {
    const lin = (c) => {
        const cs = c / 255;
        return cs <= 0.03928 ? cs / 12.92 : Math.pow((cs + 0.055) / 1.055, 2.4);
    };
    return 0.2126 * lin(r) + 0.7152 * lin(g) + 0.0722 * lin(b);
}

/**
 * WCAG contrast ratio + AA verdicts between two hex colors.
 * @returns {{ valid:boolean, ratio:number|null, passAA:boolean, passAALarge:boolean }}
 */
function checkContrast(fg, bg) {
    const a = parseHex(fg), b = parseHex(bg);
    if (!a || !b) return { valid: false, ratio: null, passAA: false, passAALarge: false };
    const la = relativeLuminance(a), lb = relativeLuminance(b);
    const ratio = (Math.max(la, lb) + 0.05) / (Math.min(la, lb) + 0.05);
    const rounded = Math.round(ratio * 100) / 100;
    return { valid: true, ratio: rounded, passAA: ratio >= 4.5, passAALarge: ratio >= 3 };
}

// ---- HTML validation -------------------------------------------------------

const BROKEN_SRC_MARKERS = ['undefined', 'null', 'placeholder', 'your-image', 'your_image', 'example.com', 'image-url-here'];

function isBrokenSrc(src) {
    if (src === undefined || src === null) return true;
    const s = String(src).trim();
    if (s === '' || s === '#') return true;
    const low = s.toLowerCase();
    return BROKEN_SRC_MARKERS.some(m => low.includes(m));
}

/**
 * Validate a single page's raw HTML.
 * @param {string} html
 * @param {object} [opts]
 * @param {object} [opts.designSystem]  - if given, run contrast checks on its colorPalette
 * @param {boolean}[opts.requireHeaderFooter=true]
 * @returns {{ ok:boolean, issues:Array, counts:{errors:number,warnings:number} }}
 */
function validateHtml(html, opts = {}) {
    const { designSystem = null, requireHeaderFooter = true } = opts;
    const issues = [];
    const add = (type, severity, detail, selector) => issues.push({ type, severity, detail, ...(selector ? { selector } : {}) });

    const trimmed = (html || '').trim();
    if (!trimmed) {
        add('empty_output', 'error', 'Generated HTML is empty.');
        return finalize(issues);
    }
    if (!trimmed.endsWith('</html>')) {
        add('incomplete_html', 'error', 'HTML does not end with </html> — output is likely truncated.');
    }
    if (!/<!DOCTYPE html>/i.test(trimmed)) {
        add('missing_doctype', 'warning', 'Missing <!DOCTYPE html> declaration.');
    }

    let $;
    try {
        $ = cheerio.load(html);
    } catch (e) {
        add('parse_error', 'error', `cheerio could not parse the HTML: ${e.message}`);
        return finalize(issues);
    }

    // Duplicate ids (break anchors / getElementById / JS).
    const idCounts = {};
    $('[id]').each((_, el) => {
        const id = $(el).attr('id');
        if (id) idCounts[id] = (idCounts[id] || 0) + 1;
    });
    Object.entries(idCounts).filter(([, n]) => n > 1).forEach(([id, n]) => {
        add('duplicate_id', 'error', `id="${id}" appears ${n} times.`, `#${id}`);
    });

    // Images: broken src + missing alt.
    $('img').each((_, el) => {
        const src = $(el).attr('src');
        if (isBrokenSrc(src)) add('broken_image', 'error', `<img> has missing/placeholder src ("${src ?? ''}").`, 'img');
        const alt = $(el).attr('alt');
        if (alt === undefined || String(alt).trim() === '') add('missing_alt', 'warning', '<img> is missing alt text.', 'img');
    });

    // Background-image inline styles pointing at nothing real.
    $('[style]').each((_, el) => {
        const style = $(el).attr('style') || '';
        const m = style.match(/background-image:\s*url\((['"]?)(.*?)\1\)/i);
        if (m && isBrokenSrc(m[2])) add('broken_bg_image', 'error', `background-image url is broken ("${m[2]}").`);
    });

    // Required structural sections.
    if (requireHeaderFooter) {
        if ($('[data-section="header"]').length === 0) add('missing_header', 'error', 'No element with data-section="header".');
        if ($('[data-section="footer"]').length === 0) add('missing_footer', 'error', 'No element with data-section="footer".');
    }

    // Empty major sections (no text and no media).
    $('[data-section]').each((_, el) => {
        const $el = $(el);
        const name = $el.attr('data-section');
        const hasText = $el.text().replace(/\s+/g, '').length > 0;
        const hasMedia = $el.find('img, svg, video, i, picture, input, button').length > 0;
        if (!hasText && !hasMedia) add('empty_section', 'warning', `Section data-section="${name}" is empty.`, `[data-section="${name}"]`);
    });

    // Style-guide violations (coder forbids <style> / @apply / arbitrary theme hex).
    if ($('style').length > 0) add('inline_style_block', 'warning', `${$('style').length} <style> block(s) present — custom classes won't be Tailwind-compiled.`);
    if (/@apply\b/.test(html)) add('apply_directive', 'warning', '@apply directive used — not supported in this single-file Tailwind setup.');

    const arbHexClasses = html.match(/\b(?:bg|text|border)-\[#[0-9a-fA-F]{3,8}\]/g) || [];
    if (arbHexClasses.length > 0) {
        add('arbitrary_hex', 'warning', `${arbHexClasses.length} arbitrary-hex color class(es) (e.g. ${arbHexClasses[0]}) — should use theme tokens (bg-primary, text-text, …).`);
    }

    // Theme contrast (only if we have the palette).
    if (designSystem && designSystem.colorPalette) {
        const p = designSystem.colorPalette;
        const pairs = [['text', 'background', p.text, p.background], ['buttonText', 'buttonBackground', p.buttonText, p.buttonBackground]];
        for (const [fgName, bgName, fg, bg] of pairs) {
            const c = checkContrast(fg, bg);
            if (c.valid && !c.passAA) {
                add('low_contrast', 'warning', `${fgName} (${fg}) on ${bgName} (${bg}) has contrast ${c.ratio}:1 (< 4.5:1 WCAG AA).`);
            }
        }
    }

    return finalize(issues);
}

function finalize(issues) {
    const errors = issues.filter(i => i.severity === 'error').length;
    const warnings = issues.filter(i => i.severity === 'warning').length;
    return { ok: errors === 0, issues, counts: { errors, warnings } };
}

/** Render an issues array into a compact, model-friendly bullet log for fixCode. */
function issuesToLog(issues) {
    if (!issues || issues.length === 0) return 'No issues.';
    return issues.map(i => `- [${i.severity.toUpperCase()}] ${i.type}: ${i.detail}${i.selector ? ` (${i.selector})` : ''}`).join('\n');
}

module.exports = { validateHtml, checkContrast, issuesToLog, contrastRatioParts: { parseHex, relativeLuminance } };
