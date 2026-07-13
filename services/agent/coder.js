/**
 * Switchable code generator for the agentic builder.
 *
 *   config.CODEGEN_PROVIDER === 'kimi'   -> services/ai-coder (Cloudflare Workers
 *                                           AI, Kimi K2.6) — unchanged, cheap, slow.
 *   config.CODEGEN_PROVIDER === 'gemini' -> Gemini via the gateway/BYOK
 *                                           (services/agent/gemini-agent.callGemini),
 *                                           reusing the EXACT same coder system
 *                                           prompt so output stays compatible with
 *                                           the assembly pipeline (data-section
 *                                           markers, theme tokens, AOS, nav attrs).
 *
 * Both genPage/fixPage return { code, usage } like ai-coder, so the orchestrator
 * doesn't care which engine produced the HTML.
 */
const config = require('./config');
const aiCoder = require('../ai-coder');
const { getSystemPrompt } = aiCoder;
const { callGemini } = require('./gemini-agent');

function cleanHtml(text) {
    let t = (text || '').replace(/```html/g, '').replace(/```/g, '');
    const end = t.lastIndexOf('</html>');
    return end >= 0 ? t.slice(0, end + 7) : t;
}

// FontAwesome's CSS webfont build does NOT render in CF Browser Rendering (icons
// show as empty "tofu" boxes) — which made the vision critique flag/​fix phantom
// "broken icons" every run, and would also break production preview thumbnails.
// The SVG+JS build replaces <i> tags with real inline SVG at load and renders
// everywhere. This transform deterministically swaps any FA CSS link for the JS
// build (and injects it if icons are used but FA isn't referenced).
const FA_JS = '<script src="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.5.1/js/all.min.js" crossorigin="anonymous"></script>';
function fixFontAwesome(html) {
    let h = html;
    const hadCss = /<link[^>]*font-?awesome[^>]*>/i.test(h);
    h = h.replace(/<link[^>]*font-?awesome[^>]*>\s*/gi, ''); // drop non-rendering CSS webfont build
    const alreadyJs = /font-?awesome[^"']*\/js\/all\.min\.js/i.test(h);
    const usesIcons = hadCss || /<i[^>]*class="[^"]*\bfa-/i.test(h);
    if (usesIcons && !alreadyJs) {
        h = /<\/head>/i.test(h) ? h.replace(/<\/head>/i, `${FA_JS}\n</head>`) : `${FA_JS}\n${h}`;
    }
    return h;
}

// Prototype-only prompt hardening (appended to the shared coder system prompt for
// the Gemini path; production Kimi via ai-coder is untouched). Targets the two
// recurring defects the vision critique kept fixing: text-character star ratings
// and invalid/low-contrast icons.
const CODEGEN_AUGMENT = `

CRITICAL OUTPUT-QUALITY RULES (past generations failed these — follow exactly):
A. STAR RATINGS: Render ratings ONLY as FontAwesome icons, NEVER as text characters.
   - Do NOT use '*', '★', '☆', or '.' characters for stars under any circumstance.
   - Filled: <i class="fa-solid fa-star text-amber-400"></i>  Half: <i class="fa-solid fa-star-half-stroke text-amber-400"></i>  Empty: <i class="fa-regular fa-star text-amber-400"></i>
   - A 5-star rating = five <i> elements wrapped in a flex container.
B. ICONS: Use ONLY real FontAwesome Free v6 class names — never invent names or use Pro-only icons (they render as empty boxes).
   - Prefer these verified Free icons: fa-bars, fa-xmark, fa-arrow-right, fa-arrow-up-right, fa-check, fa-circle-check, fa-star, fa-quote-left, fa-location-dot, fa-phone, fa-envelope, fa-clock, fa-mug-hot, fa-coffee, fa-leaf, fa-heart, fa-seedling, fa-award.
   - Brand/social icons MUST use the brands family, e.g. <i class="fa-brands fa-instagram"></i>, fa-facebook-f, fa-x-twitter, fa-linkedin-in.
   - Every icon needs an explicit color class that CONTRASTS its background (icons inherit text color; on dark sections use a light class like text-white/80, on light sections use text-primary or text-accent). Never leave an icon the same color as its container.
C. FEATURE / VALUE / "WHY US" / STEP cards: each card's icon slot MUST contain a real <i class="fa-solid fa-..."> element. NEVER use an empty or solid-colored <div>/square/circle as a stand-in for an icon — an empty colored box is a defect, not a placeholder.
D. Never output an empty icon container, a placeholder glyph, or leave a stray/literal HTML tag (e.g. a visible "</p>") in text or form fields.`;

function usingGemini() {
    return config.CODEGEN_PROVIDER === 'gemini';
}

async function genPageGemini(designSystem, userContext, pageName, allPages, layoutReference, stylePreset) {
    const system = getSystemPrompt(stylePreset) + CODEGEN_AUGMENT;
    const prompt = `
    DESIGN SYSTEM: ${JSON.stringify(designSystem)}
    USER CONTEXT: ${userContext}

    CURRENT_PAGE: ${pageName}
    ALL_PAGES: ${JSON.stringify(allPages)}
    ${layoutReference ? `LAYOUT_REFERENCE: ${JSON.stringify(layoutReference)}` : ''}

    Generate the COMPLETE HTML file for ${pageName}. Output RAW HTML only — no markdown fences.`;
    const res = await callGemini({
        systemInstruction: system, prompt,
        model: config.CODEGEN_MODEL, temperature: 0.6, maxTokens: config.CODEGEN_MAX_TOKENS,
        thinkingLevel: config.CODEGEN_THINKING,
    });
    return { code: fixFontAwesome(cleanHtml(res.text)), usage: res.usage };
}

async function fixPageGemini(badCode, errorLog, stylePreset) {
    const system = getSystemPrompt(stylePreset) + CODEGEN_AUGMENT;
    const prompt = `
    The following HTML/Tailwind code has issues.

    ISSUE LOG:
    ${errorLog}

    BAD CODE:
    ${badCode}

    Fix the errors and return the FULL CORRECTED HTML document. Keep everything else intact. Output RAW HTML only — no markdown fences.`;
    const res = await callGemini({
        systemInstruction: system, prompt,
        model: config.CODEGEN_MODEL, temperature: 0.5, maxTokens: config.CODEGEN_MAX_TOKENS,
        thinkingLevel: config.CODEGEN_THINKING,
    });
    return { code: fixFontAwesome(cleanHtml(res.text)), usage: res.usage };
}

/** Generate a full page. Signature mirrors ai-coder.generateCode. */
async function genPage(designSystem, userContext, pageName, allPages, layoutReference, stylePreset) {
    return usingGemini()
        ? genPageGemini(designSystem, userContext, pageName, allPages, layoutReference, stylePreset)
        : aiCoder.generateCode(designSystem, userContext, pageName, allPages, layoutReference, stylePreset);
}

/** Fix a full page. Signature mirrors ai-coder.fixCode. */
async function fixPage(badCode, errorLog, stylePreset) {
    return usingGemini()
        ? fixPageGemini(badCode, errorLog, stylePreset)
        : aiCoder.fixCode(badCode, errorLog, stylePreset);
}

module.exports = { genPage, fixPage, fixFontAwesome };
