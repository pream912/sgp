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

const SYSTEM_PROMPT = `
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
   - DO NOT include <script>tailwind.config = ...</script>.
   - Assume standard Tailwind classes work immediately.
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
8. STYLING RULES:
   - Ensure specific contrast ratios.
   - When placing text over background images, YOU MUST use a dark overlay (e.g., 'bg-black/50') or a strong text shadow.
   - IMPLEMENT THE 'stylePreset' AND 'gradientStyle' AGGRESSIVELY:
     - **Glassmorphism:** Use 'bg-white/10' or 'bg-black/20', 'backdrop-blur-md' or 'backdrop-blur-lg', 'border-white/20', and subtle 'shadow-lg' for CARDS and SECTIONS.
     - **Neumorphism:** Use soft shadows (e.g., 'shadow-[5px_5px_10px_#bebebe,-5px_-5px_10px_#ffffff]') and low contrast borders.
     - **Aurora:** Use multiple background gradients or absolute positioned colored blobs with high blur ('blur-3xl') behind content.
     - **Bento Grid:** Use 'grid grid-cols-1 md:grid-cols-3 gap-4' with cards spanning different rows/cols ('col-span-2', 'row-span-2').
     - **Brutalist:** Use heavy black borders ('border-2 border-black'), sharp corners ('rounded-none'), and high contrast.
     - **Minimalist:** Use ample whitespace, 'text-sm', and very subtle gray borders.
     - **Luxury:** Use serif fonts, gold/dark colors, and very soft 'shadow-2xl'.
     - **Gradients:** Use 'bg-gradient-to-r' or 'bg-gradient-to-br'. Combine 'primary', 'secondary', 'accent' in gradients.
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
      - Generate a Navigation Menu that includes links to ALL pages in 'ALL_PAGES'.
      - Link format:
        - Home -> 'index.html'
        - About -> 'about.html'
        - Services -> 'services.html'
        - Contact -> 'contact.html'
        - (Convert page names to lowercase + .html).
      - Highlight the link for 'CURRENT_PAGE' (e.g., add 'font-bold text-primary' or an underline).
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

async function generateCode(designSystem, userContext, pageName = 'Home', allPages = ['Home'], layoutReference = null) {
    const prompt = `
    DESIGN SYSTEM: ${JSON.stringify(designSystem)}
    USER CONTEXT: ${userContext}
    
    CURRENT_PAGE: ${pageName}
    ALL_PAGES: ${JSON.stringify(allPages)}
    ${layoutReference ? `LAYOUT_REFERENCE: ${JSON.stringify(layoutReference)}` : ''}
    
    Generate the HTML file for ${pageName}.
    `;
    
    const result = await model.generateContent({
        contents: [{ role: 'user', parts: [{ text: SYSTEM_PROMPT + "\n" + prompt }] }],
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

async function fixCode(badCode, errorLog) {
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
        contents: [{ role: 'user', parts: [{ text: SYSTEM_PROMPT + "\n" + prompt }] }],
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

module.exports = { generateCode, fixCode, regenerateSection, updateSectionContent };