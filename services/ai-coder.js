const { VertexAI } = require('@google-cloud/vertexai');
const cheerio = require('cheerio');

const vertex_ai = new VertexAI({
  project: process.env.GCP_PROJECT, 
  location: 'us-central1'
});
const model = vertex_ai.preview.getGenerativeModel({
  model: 'gemini-2.5-pro',
  generationConfig: {
    'maxOutputTokens': 16384,
    'temperature': 0.5,
    'topP': 0.95,
  },
});

const BASE_PROMPT_START = `
You are an expert Frontend Developer specializing in Tailwind CSS and semantic HTML5.
Your task is to write a SINGLE FILE HTML document based on the provided Design System, User Context, and specific Page Requirement.

STRICT CONSTRAINTS:
1. OUTPUT RAW CODE ONLY. NO MARKDOWN BLOCKS (e.g., '''html ... ''').
2. RETURN A COMPLETE, VALID HTML5 DOCUMENT (<!DOCTYPE html>...</html>).
3. USE TAILWIND CSS FOR ALL STYLING.
   - USE THE DEFINED THEME COLORS: 'primary', 'secondary', 'accent', 'background', 'text', 'buttonBackground', 'buttonText'.
   - Example: Use "bg-primary" instead of "bg-[#FF5733]". Use "text-accent" instead of "text-[#...]"
   - DO NOT use arbitrary values for main colors. The config is already set up.
   - **NO TAILWIND CDN OR CONFIG IN HTML.**
   - DO NOT include <script src="https://cdn.tailwindcss.com"></script>.
   - DO NOT include <script>tailwind.config = ...</script> or any variation of it.
   - DO NOT include "demonstration" or "placeholder" tailwind configs.
   - The build process handles the config. You must output PURE HTML classes only.
   - Assume standard Tailwind classes work immediately.
   - **NO <style> BLOCKS:**
     - DO NOT use <style> tags to define custom classes (e.g., .card-neumorphic { ... }).
     - DO NOT use @apply in <style> tags.
     - ALL STYLING MUST BE DONE VIA INLINE TAILWIND CLASSES in the HTML elements themselves.
     - If you need a complex specific shadow or value, USE ARBITRARY VALUES (e.g., shadow-[...]).
     - DO NOT invent new utility classes (like 'shadow-neumorphic'). If it's not standard Tailwind, use an arbitrary value.
   - **NO SCROLL LOCKING:**
     - DO NOT use 'overflow-hidden' on the <body>, <html>, or <main> tags. This breaks scrolling.
     - Only use 'overflow-hidden' on specific small containers (like cards or image wrappers) where absolutely necessary.
4. TYPOGRAPHY:
   - Use 'font-heading' for all headings (h1, h2, h3, etc.).
   - Use 'font-body' for all body text.
5. SCRIPTS & INTERACTIVITY:
   - Include a <script> tag at the end of the body for interactivity (e.g., Mobile Menu toggling, simple scroll effects).
   - Use VANILLA JAVASCRIPT (document.querySelector, addEventListener).
   - NO EXTERNAL JS FRAMEWORKS (No React, Vue, jQuery).
   - **ANIMATIONS:**
     - MUST USE AOS (Animate On Scroll) library.
     - Include CSS in <head>: <link href="https://unpkg.com/aos@2.3.1/dist/aos.css" rel="stylesheet">
     - Include JS before body close: <script src="https://unpkg.com/aos@2.3.1/dist/aos.js"></script>
     - Initialize AOS in script: AOS.init({ duration: 800, once: true });
     - ADD 'data-aos="fade-up"' (or fade-in, zoom-in, fade-left, fade-right) to ALL major elements (headings, cards, images, sections).
     - Ensure animations are applied tastefully (e.g., stagger cards using data-aos-delay).
6. ICONS:
   - Use FontAwesome Free CDN: <link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.5.1/css/all.min.css">
   - Usage: <i class="fa-solid fa-house"></i>
7. IMAGES:
   - Use the 'imageUrls' array provided in the Design System.
   - Cycle through these URLs for your images.
   - STRICTLY use the provided URLs. DO NOT generate fake URLs.
   - For background images, use inline styles: style="background-image: url('...')" or an <img> tag with object-cover.
`;

const STYLING_VARIATIONS = {
    'standard': `8. STYLING RULES (STANDARD - MODERN BALANCED):
   - **PHILOSOPHY:** Clean, modern, and accessible. Think Bootstrap 5 met Tailwind but better.
   - **SHADOWS:** Use 'shadow-md' for cards, 'shadow-lg' for floating elements.
   - **CORNERS:** Use 'rounded-xl' for cards and 'rounded-lg' for buttons.
   - **SPACING:** Comfortable spacing. Use 'gap-6' or 'gap-8' in grids.
   - **CONTRAST:** High contrast text on backgrounds. 'bg-white' for cards on 'bg-gray-50' backgrounds.
   - **BORDERS:** Subtle borders 'border border-gray-100'.
   - **BUTTONS:** Solid primary color, standard padding 'px-6 py-3'.
   - **LAYOUT:** Standard Container + Grid layouts.`,

    'vibrant': `8. STYLING RULES (VIBRANT - BRUTALIST POP):
   - **PHILOSOPHY:** High energy, raw, and bold. **Neo-Brutalism**.
   - **SHADOWS:** HARD shadows. Use arbitrary values: 'shadow-[4px_4px_0px_0px_rgba(0,0,0,1)]' or 'shadow-[8px_8px_0px_0px_rgba(0,0,0,1)]'. NO BLUR.
   - **CORNERS:** SHARP or slightly rounded. 'rounded-none' or 'rounded-md'.
   - **BORDERS:** THICK black borders. 'border-2 border-black' or 'border-4 border-black' on CARDS and BUTTONS.
   - **COLORS:** Use High Saturation backgrounds.
   - **TYPOGRAPHY:** LARGE, BOLD headings. 'font-black' or 'font-extrabold'.
   - **BUTTONS:** 'bg-primary border-2 border-black text-black shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] hover:translate-x-[2px] hover:translate-y-[2px] hover:shadow-none transition-all'.
   - **BACKGROUNDS:** Use bold colors or simple patterns.`,

    'minimal': `8. STYLING RULES (MINIMAL - SWISS STYLE):
   - **PHILOSOPHY:** "Less is More". Maximum whitespace, focus on grid and type.
   - **SHADOWS:** REMOVE SHADOWS. 'shadow-none'.
   - **CORNERS:** SHARP or Micro-rounded. 'rounded-none' or 'rounded-sm'.
   - **BORDERS:** THIN, DELICATE lines. 'border-t border-b border-gray-200' or 'border border-gray-200'.
   - **SPACING:** EXTREME spacing. 'gap-12' or 'gap-16'. 'py-20' or 'py-32' for sections.
   - **TYPOGRAPHY:** Use 'tracking-wider'. Headings should be relatively small but bold, or HUGE and thin.
   - **IMAGES:** Use 'grayscale' filters often, or full-width hero images.
   - **DECORATION:** NONE. No background patterns, no blobs. Just Structure.`,

    'soft': `8. STYLING RULES (SOFT - GLASSMORPHISM & AURORA):
   - **PHILOSOPHY:** Ethereal, translucent, and smooth.
   - **BACKGROUNDS:** **CRITICAL:** Use distinct gradient backgrounds (Aurora) on the body or section containers.
   - **CARDS (GLASSMORPHISM):**
     - 'bg-white/10' or 'bg-white/70' (depending on dark/light mode).
     - 'backdrop-blur-xl' or 'backdrop-blur-2xl'.
     - 'border border-white/20'.
     - 'shadow-xl'.
   - **CORNERS:** EXTREMELY ROUNDED. 'rounded-3xl' for cards, 'rounded-full' for buttons.
   - **BUTTONS:** Gradient backgrounds 'bg-gradient-to-r from-primary to-accent'.
   - **TEXT:** Ensure legibility on gradients (use text-shadows if needed).
   - **DECORATION:** Use absolute positioned, blurred circles ('blur-3xl') of 'primary' and 'secondary' colors behind content.`,

    'professional': `8. STYLING RULES (PROFESSIONAL - CORPORATE SaaS):
   - **PHILOSOPHY:** Trustworthy, organized, and scalable. Think Stripe, Linear, or Enterprise SaaS.
   - **LAYOUT:** Strict 12-column grids. 'max-w-7xl mx-auto'.
   - **SHADOWS:** 'shadow-sm' for borders, 'shadow-xl' for dropdowns/modals. "Lift" effect on hover.
   - **CORNERS:** 'rounded-lg' (The industry standard).
   - **BORDERS:** 'border border-gray-200'.
   - **BACKGROUNDS:** 'bg-white' primary, 'bg-slate-50' secondary.
   - **TYPOGRAPHY:** 'font-sans'. Headings 'text-slate-900', Body 'text-slate-600'.
   - **ICONS:** Use small, subtle icons within rounded squares ('bg-primary/10 text-primary p-2 rounded-lg').
   - **GRADIENTS:** Subtle text gradients on H1 only.`,
    
    'neumorphic': `8. STYLING RULES (NEUMORPHISM - SOFT PLASTIC):
   - **PHILOSOPHY:** Soft UI, elements appear to be extruded from the background.
   - **BACKGROUND:** 'bg-gray-200' (or similar mid-light gray). CRITICAL: Neumorphism DOES NOT work on pure white.
   - **CARDS:**
     - 'bg-gray-200' (Same as background).
     - **SHADOWS (THE KEY):** 'shadow-[20px_20px_60px_#d1d5db,-20px_-20px_60px_#ffffff]' (Soft Light/Dark pair).
     - NO BORDERS.
   - **CORNERS:** 'rounded-[50px]' or 'rounded-3xl'.
   - **BUTTONS:** Pressed state styles are critical.
     - Normal: Extruded shadow.
     - Active/Hover: Inset shadow 'shadow-[inset_20px_20px_60px_#d1d5db,inset_-20px_-20px_60px_#ffffff]'.
   - **CONTRAST:** Low contrast UI, High contrast Text. Use 'text-gray-700'.`
};

const BASE_PROMPT_END = `
9. DATA INTEGRATION:
   - Implement "Reviews", "Contact", "Services" if provided in User Context.
   - LOGO: Check 'designSystem.logoUrl'. 
     - If exists: <img src="./logo.png" alt="Logo" class="h-10">
       - **CRITICAL:** IF A LOGO IS PRESENT, DO NOT DISPLAY THE BUSINESS NAME TEXT IN THE HEADER OR FOOTER. ONLY SHOW THE LOGO IMAGE.
     - If missing: Use the Business Name as text (typography 'font-heading').
   - **CTA / FORMS:** 
     - ALL CTA (Call to Action) sections MUST BE A FORM, not just a button.
     - The form MUST have an 'onsubmit' attribute: <form onsubmit="handleLeadSubmit(event)">.
     - Include fields relevant to the user context (e.g., Name, Email, Phone, Service Requested, Message).
     - Style the form beautifully using the defined theme (inputs with proper padding, borders, focus states).
     - The submit button should be prominent ('bg-buttonBackground', 'text-buttonText').
     - **SUCCESS MODAL (CRITICAL):**
       - DO NOT use 'alert()' for success messages.
       - You MUST generate a HIDDEN success modal/dialog at the bottom of the <body>.
       - Structure: <div id="successModal" class="hidden fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm">...</div>
       - Content: A beautiful card (using theme colors 'bg-background', 'text-text') with a success icon, a "Thank You" message, and a "Close" button.
       - Javascript: 
         - Function 'handleLeadSubmit(event)' must:
           1. event.preventDefault();
           2. document.getElementById('successModal').classList.remove('hidden');
           3. event.target.reset();
         - Function 'closeModal()' must:
           1. document.getElementById('successModal').classList.add('hidden');
         - Attach 'closeModal()' to the modal's close button and background overlay.
10. SECTION MARKERS:
    - You MUST add a 'data-section="section-name"' attribute to the outer-most container of EVERY major section.
    - **MANDATORY:** The Header MUST have 'data-section="header"'.
    - **MANDATORY:** The Footer MUST have 'data-section="footer"'.
    - Example: <header data-section="header">...</header>
    - This is CRITICAL for the site editor and consistency checks.
11. NAVIGATION & MULTI-PAGE SUPPORT:
    - You will be provided with a list of 'ALL_PAGES' and the 'CURRENT_PAGE' you are generating.
    - **Header/Navigation:**
      - IF 'ALL_PAGES' contains MORE THAN ONE page:
        - Generate a Navigation Menu that includes links to ALL pages in 'ALL_PAGES'.
        - Link format:
          - Home -> 'index.html'
          - About -> 'about.html'
          - Services -> 'services.html'
          - Contact -> 'contact.html'
          - (Convert page names to lowercase + .html).
        - Highlight the link for 'CURRENT_PAGE' (e.g., add 'font-bold text-primary' or an underline).
      - IF 'ALL_PAGES' contains ONLY ONE page (e.g., ['Home']):
        - **STRICTLY DO NOT GENERATE ANY NAVIGATION LINKS OR MENUS IN THE HEADER.**
        - The header should only contain the logo/business name and a CTA button (if appropriate).
    - **CONSISTENCY (CRITICAL):**
      - If 'LAYOUT_REFERENCE' is provided, you **MUST** use the provided Header and Footer HTML structure EXACTLY.
      - **DO NOT CHANGE THE DESIGN, CLASSES, OR LAYOUT OF THE HEADER/FOOTER.**
      - **ONLY** update the "active state" class on the navigation links to reflect the 'CURRENT_PAGE'.
    - **Content Focus:**
      - Generate content SPECIFIC to 'CURRENT_PAGE'.
      - If 'Home': Full landing page with Hero, Features, Testimonials, CTA.
      - If 'About': Focus on company history, team, mission.
      - If 'Services': Detailed list of services.
      - If 'Contact': Contact form, map placeholder, address.
      - If 'Gallery': Grid of images.

12. COMPLETENESS:
    - You must generate the FULL file. Do not stop in the middle.
    - If the file is long, ensure you close all tags properly.

DESIGN INTERPRETATION:
- VARY THE LAYOUTS. Do not just stack centered text. Use grids, varying alignment, and asymmetry where appropriate.
- HEADER: Implement the requested 'headerStyle' (e.g., 'sidebar', 'transparent', 'centered').
- FOOTER: Implement 'footerStyle'.

RETURN ONLY THE HTML CODE.
`;

function getSystemPrompt(styleId = null) {
    let selectedStyle;
    
    if (styleId && STYLING_VARIATIONS[styleId]) {
        selectedStyle = STYLING_VARIATIONS[styleId];
        console.log(`[AI Coder] Using selected style: ${styleId}`);
    } else {
        const keys = Object.keys(STYLING_VARIATIONS);
        const randomKey = keys[Math.floor(Math.random() * keys.length)];
        selectedStyle = STYLING_VARIATIONS[randomKey];
        console.log(`[AI Coder] Using random style: ${randomKey}`);
    }

    return BASE_PROMPT_START + "\\n" + selectedStyle + "\\n" + BASE_PROMPT_END;
}

async function generateCode(designSystem, userContext, pageName = 'Home', allPages = ['Home'], layoutReference = null, stylePreset = null) {
    const prompt = `
    DESIGN SYSTEM: ${JSON.stringify(designSystem)}
    USER CONTEXT: ${userContext}
    
    CURRENT_PAGE: ${pageName}
    ALL_PAGES: ${JSON.stringify(allPages)}
    ${layoutReference ? `LAYOUT_REFERENCE: ${JSON.stringify(layoutReference)}` : ''}
    
    Generate the HTML file for ${pageName}.
    `;
    
    const result = await model.generateContent({
        contents: [{ role: 'user', parts: [{ text: getSystemPrompt(stylePreset) + "\n" + prompt }] }],
    });
    
    const response = await result.response;
    const candidate = response.candidates[0];
    
    console.log(`[AI Coder] Finish Reason: ${candidate.finishReason}`);
    if (candidate.finishReason !== 'STOP') {
        console.warn(`[AI Coder] Warning: Generation stopped due to ${candidate.finishReason}`);
    }

    let text = candidate.content.parts[0].text;
    
    // Clean up markdown
    text = text.replace(/```html/g, '').replace(/```/g, '');
    return text;
}

async function fixCode(badCode, errorLog, stylePreset = null) {
    const prompt = `
    The following HTML/Tailwind code has issues. 
    
    ISSUE LOG:
    ${errorLog}
    
    BAD CODE:
    ${badCode}
    
    Fix the errors and return the FULL CORRECTED index.html code.
    SAME CONSTRAINTS APPLY: RAW CODE ONLY, NO MARKDOWN.
    `;
    
    const result = await model.generateContent({
        contents: [{ role: 'user', parts: [{ text: getSystemPrompt(stylePreset) + "\n" + prompt }] }],
    });
    
    const response = await result.response;
    let text = response.candidates[0].content.parts[0].text;
    
    text = text.replace(/```html/g, '').replace(/```/g, '');
    return text;
}

async function regenerateSection(code, sectionId, instruction) {
    const prompt = `
    EXISTING HTML CODE:
    ${code}
    
    TASK:
    Find the HTML Element/Section with the attribute 'data-section="${sectionId}"'.
    Rewrite ONLY the content of that section based on the following instruction:
    "${instruction}"
    
    CRITICAL:
    1. Keep all other sections EXACTLY the same.
    2. Maintain the 'data-section="${sectionId}"' attribute on the container.
    3. Use the same Tailwind theme and design system.
    4. RETURN THE FULL UPDATED 'index.html' FILE.
    
    STRICT CONSTRAINTS:
    - OUTPUT RAW CODE ONLY. NO MARKDOWN BLOCKS.
    `;
    
    const result = await model.generateContent({
        contents: [{ role: 'user', parts: [{ text: prompt }] }],
    });
    
    const response = await result.response;
    let text = response.candidates[0].content.parts[0].text;
    
    text = text.replace(/```html/g, '').replace(/```/g, '');
    return text;
}

async function regeneratePage(code, instruction) {
    const prompt = `
    EXISTING HTML CODE:
    ${code}
    
    TASK:
    Modify the ENTIRE HTML document based on the following instruction:
    "${instruction}"
    
    CRITICAL:
    1. You can add, remove, or modify sections, styles, and content as needed to fulfill the request.
    2. Maintain the overall structure (<html>, <head>, <body>).
    3. Use the same Tailwind theme and design system.
    4. RETURN THE FULL UPDATED 'index.html' FILE.
    
    STRICT CONSTRAINTS:
    - OUTPUT RAW CODE ONLY. NO MARKDOWN BLOCKS.
    `;
    
    const result = await model.generateContent({
        contents: [{ role: 'user', parts: [{ text: prompt }] }],
    });
    
    const response = await result.response;
    let text = response.candidates[0].content.parts[0].text;
    
    text = text.replace(/```html/g, '').replace(/```/g, '');
    return text;
}

async function updateSectionContent(code, sectionId, type, originalValue, newValue) {
    const $ = cheerio.load(code);
    const $section = $(`[data-section="${sectionId}"]`);
    
    if ($section.length === 0) {
        throw new Error(`Section ${sectionId} not found`);
    }

    if (type === 'text') {
        const normalize = (str) => str.replace(/\s+/g, ' ').trim();
        const normalizeLower = (str) => normalize(str).toLowerCase();
        
        const targetText = normalizeLower(originalValue);
        
        console.log(`[Update] Searching for text: "${targetText}" (original: "${originalValue}") in section: ${sectionId}`);

        // Find all elements that contain the target text (Case Insensitive)
        const candidates = [];
        $section.find('*').each((i, el) => {
            const $el = $(el);
            const text = normalizeLower($el.text());
            if (text.includes(targetText)) {
                candidates.push({ el: $el, length: text.length, text });
            }
        });

        // Sort by length ascending (shortest text means closest match/deepest node)
        candidates.sort((a, b) => a.length - b.length);

        if (candidates.length > 0) {
            const best = candidates[0];
            const $el = best.el;
            console.log(`[Update] Best match: <${$el.prop('tagName')}> containing "${best.text}"`);

            // Try to find and update the specific text node to preserve siblings (icons, etc.)
            let updated = false;
            
            const updateTextNode = (node) => {
                if (updated) return;
                if (node.type === 'text') {
                    const nodeText = normalizeLower(node.data || '');
                    // Check if this text node is the one holding our target
                    if (nodeText.includes(targetText)) {
                        node.data = newValue;
                        updated = true;
                    }
                } else if (node.children) {
                    node.children.forEach(updateTextNode);
                }
            };

            // Search children of the best match
            if ($el[0].children) {
                $el[0].children.forEach(updateTextNode);
            }

            if (!updated) {
                // Fallback: If no specific text node matched (maybe text is split across nodes?),
                // and the element has no other tag children, safe to replace all text.
                if ($el.children().length === 0) {
                     console.log(`[Update] No text node match, replacing full text of leaf element.`);
                     $el.text(newValue);
                } else {
                     console.warn(`[Update] Could not safely update text in <${$el.prop('tagName')}> (Complex structure).`);
                     // Forced update: If the text length is very close, just do it.
                     const originalLen = normalizeLower($el.text()).length;
                     const targetLen = targetText.length;
                     if (Math.abs(originalLen - targetLen) < 5) {
                         console.log(`[Update] Forced update on complex element (length match close).`);
                         $el.text(newValue);
                     }
                }
            }
            
        } else {
             console.warn(`[Update] Text match not found for: "${targetText}"`);
             // Debug: Print first few chars of section text
             console.log(`[Update] Section text snippet: ${normalize($section.text()).substring(0, 100)}...`);
        }

    } else if (type === 'image') {
        // 1. IMG Tags
        $section.find('img').each((i, el) => {
            const src = $(el).attr('src');
            if (src === originalValue || (src && src.endsWith(originalValue))) {
                $(el).attr('src', newValue);
            }
        });

        // 2. Background Images
        $section.find('*').each((i, el) => {
            const style = $(el).attr('style');
            if (style && style.includes('background-image')) {
                if (style.includes(originalValue)) {
                    const newStyle = style.replace(originalValue, newValue);
                    $(el).attr('style', newStyle);
                }
            }
        });
    }

    return $.html();
}

module.exports = { generateCode, fixCode, regenerateSection, updateSectionContent, regeneratePage };