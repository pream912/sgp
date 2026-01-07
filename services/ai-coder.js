const { VertexAI } = require('@google-cloud/vertexai');

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
Your task is to write a SINGLE FILE 'index.html' based on the provided Design System and User Context.

STRICT CONSTRAINTS:
1. OUTPUT RAW CODE ONLY. NO MARKDOWN BLOCKS (e.g., \`\`\`html ... \`\`\`).
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
9. DATA INTEGRATION:
   - Implement "Reviews", "Contact", "Services" if provided in User Context.
   - LOGO: Check 'designSystem.logoUrl'. 
     - If exists: <img src="./logo.png" alt="Logo" class="h-10">
     - If missing: Use text.
10. SECTION MARKERS:
    - You MUST add a 'data-section="section-name"' attribute to the outer-most container of EVERY major section.
    - Example: <section data-section="hero" class="...">
    - This is CRITICAL for the site editor.
11. COMPLETENESS:
    - You must generate the FULL file. Do not stop in the middle.
    - If the file is long, ensure you close all tags properly.

DESIGN INTERPRETATION:
- VARY THE LAYOUTS. Do not just stack centered text. Use grids, varying alignment, and asymmetry where appropriate.
- HEADER: Implement the requested 'headerStyle' (e.g., 'sidebar', 'transparent', 'centered').
- FOOTER: Implement 'footerStyle'.

RETURN ONLY THE HTML CODE.
`;

async function generateCode(designSystem, userContext) {
    const prompt = `
    DESIGN SYSTEM: ${JSON.stringify(designSystem)}
    USER CONTEXT: ${userContext}
    
    Generate the index.html file.
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
    const instruction = type === 'text' 
        ? 
`Find the EXACT text "${originalValue}" within this section and replace it with "${newValue}". Do not change anything else.`
        : 
`Find the image with src "${originalValue}" within this section and replace the src with "${newValue}". Do not change anything else.`;

    const prompt = `
    EXISTING HTML CODE:
    ${code}
    
    TASK:
    Find the HTML Element/Section with the attribute 'data-section="${sectionId}"'.
    ${instruction}
    
    CRITICAL:
    1. Only modify the specific target element.
    2. Maintain the 'data-section="${sectionId}"' attribute.
    3. RETURN THE FULL UPDATED 'index.html' FILE.
    
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

module.exports = { generateCode, fixCode, regenerateSection, updateSectionContent };