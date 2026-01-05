const { VertexAI } = require('@google-cloud/vertexai');

const vertex_ai = new VertexAI({
  project: process.env.GCP_PROJECT, 
  location: process.env.GOOGLE_CLOUD_LOCATION || 'us-central1'
});
const model = vertex_ai.preview.getGenerativeModel({
  model: 'gemini-2.5-flash',
  generationConfig: {
    'maxOutputTokens': 8192,
    'temperature': 0.5,
    'topP': 0.95,
  },
});

const SYSTEM_PROMPT = `
You are an expert React developer.
Your task is to write a SINGLE FILE 'App.jsx' based on the provided Design System and User Context.

STRICT CONSTRAINTS:
1. OUTPUT RAW CODE ONLY. NO MARKDOWN BLOCKS (e.g., \`\`\`jsx ... \`\`\`).
2. NO EXTERNAL CSS IMPORTS (except standard library or './index.css' which is already handled).
3. USE TAILWIND CSS FOR ALL STYLING.
   - USE THE DEFINED THEME COLORS: 'primary', 'secondary', 'accent', 'background', 'text', 'buttonBackground', 'buttonText'.
   - Example: Use "bg-primary" instead of "bg-[#FF5733]". Use "text-accent" instead of "text-[#...]"
   - DO NOT use arbitrary values for main colors anymore. The config is already set up with the Design System colors.
4. TYPOGRAPHY:
   - Use 'font-heading' for all headings (h1, h2, h3, etc.).
   - Use 'font-body' for all body text.
5. BUTTONS:
   - ALWAYS use 'bg-buttonBackground' and 'text-buttonText' for buttons.
6. IMAGES:
   - Use the 'imageUrls' array provided in the Design System.
   - Cycle through these URLs for your images (e.g., imageUrls[0], imageUrls[1], etc.).
   - STRICTLY use the provided URLs. DO NOT generate fake URLs or placeholders.
   - If you run out of images, reuse them from the beginning of the list.
7. Use 'lucide-react' for icons. Import example: import { Home } from 'lucide-react';
8. Use 'framer-motion' for animations.
9. COMPATIBILITY: React 18.2.0, Vite 5.2.0.
10. Make the design complete, beautiful and production-ready.
11. TEXT ON IMAGES:
    - If placing text over a background image, YOU MUST use a dark overlay (e.g., 'bg-black/50') or a strong text shadow to ensure readability.
12. DATA INTEGRATION:
    - The 'USER CONTEXT' may contain specific sections like "Reviews", "Contact Details", "Opening Hours", and "Key Services".
    - IF these sections are present, you MUST implement them in the design.
    - Create a 'Testimonials' section using the real reviews/quotes provided.
    - Create a 'Contact' section displaying the real address, phone, and email.
    - Display 'Opening Hours' in the footer or contact section if available.
13. LOGO IMPLEMENTATION:
    - CRITICAL: Check 'designSystem.logoUrl' in the provided JSON.
    - IF 'designSystem.logoUrl' IS PRESENT (e.g., "./logo.png"): 
      - YOU MUST USE THIS EXACT STRING as the 'src' for the logo image in both the Header and Footer.
      - DO NOT generate a placeholder image URL.
      - DO NOT render the Business Name as text alongside the logo image (unless part of a specific "Logo + Text" design pattern, but prefer Image Only for cleaner look).
      - Example: <img src="./logo.png" alt="Company Logo" className="h-10 w-auto" />
    - IF 'designSystem.logoUrl' IS MISSING: 
      - Use the business name as styled text. Do not invent a logo image.

14. SECTION MARKERS:
    - You MUST add a 'data-section="section-name"' attribute to the outer-most container of EVERY major section (e.g., Hero, Features, Testimonials, Footer).
    - Use descriptive names (e.g., "hero", "about", "contact").
    - This is CRITICAL for the site editor to work.

DESIGN INTERPRETATION:
- STRICTLY IMPLEMENT the 'heroStyle' defined in the Design System. This is critical for visual variety.
- STRICTLY IMPLEMENT the 'headerStyle' and 'footerStyle' defined in the Design System.
  - For "Sidebar Navigation", ensure the main content is wrapped in a container with a left margin (e.g., 'ml-64') so it doesn't overlap.
  - For "Transparent Overlay Header", use 'absolute top-0 w-full z-50' to overlay the hero.
  - For "Floating Pill", ensure it is fixed or sticky with a high z-index.
- Vary the layout of other sections (Features, Testimonials) to match the 'vibe' and chosen styles. Avoid repetitive centered text blocks if the design calls for asymmetry or grid layouts.

RETURN ONLY THE JAVASCRIPT CODE. START WITH IMPORTS.
`;

async function generateCode(designSystem, userContext) {
    const prompt = `
    DESIGN SYSTEM: ${JSON.stringify(designSystem)}
    USER CONTEXT: ${userContext}
    
    Generate the App.jsx file.
    `;
    
    const result = await model.generateContent({
        contents: [{ role: 'user', parts: [{ text: SYSTEM_PROMPT + "\n" + prompt }] }],
    });
    
    const response = await result.response;
    let text = response.candidates[0].content.parts[0].text;
    
    // Clean up markdown just in case
    text = text.replace(/```jsx/g, '').replace(/```javascript/g, '').replace(/```/g, '');
    return text;
}

async function fixCode(badCode, errorLog) {
    const prompt = `
    The following React code failed to build. 
    
    ERROR LOG:
    ${errorLog}
    
    BAD CODE:
    ${badCode}
    
    Fix the errors and return the FULL CORRECTED App.jsx code.
    SAME CONSTRAINTS APPLY: RAW CODE ONLY, NO MARKDOWN.
    `;
    
    const result = await model.generateContent({
        contents: [{ role: 'user', parts: [{ text: SYSTEM_PROMPT + "\n" + prompt }] }],
    });
    
    const response = await result.response;
    let text = response.candidates[0].content.parts[0].text;
    
    text = text.replace(/```jsx/g, '').replace(/```javascript/g, '').replace(/```/g, '');
    return text;
}

async function regenerateSection(code, sectionId, instruction) {
    const prompt = `
    EXISTING CODE:
    ${code}
    
    TASK:
    Find the React Component or JSX Section with the attribute 'data-section="${sectionId}"'.
    Rewrite ONLY the content of that section based on the following instruction:
    "${instruction}"
    
    CRITICAL:
    1. Keep all other sections EXACTLY the same.
    2. Maintain the 'data-section="${sectionId}"' attribute on the container so it stays editable.
    3. Use the same Tailwind theme and design system.
    4. RETURN THE FULL UPDATED 'App.jsx' FILE.
    
    STRICT CONSTRAINTS:
    - OUTPUT RAW CODE ONLY. NO MARKDOWN BLOCKS.
    `;
    
    const result = await model.generateContent({
        contents: [{ role: 'user', parts: [{ text: prompt }] }],
    });
    
    const response = await result.response;
    let text = response.candidates[0].content.parts[0].text;
    
    text = text.replace(/```jsx/g, '').replace(/```javascript/g, '').replace(/```/g, '');
    return text;
}

async function updateSectionContent(code, sectionId, type, originalValue, newValue) {
    const instruction = type === 'text' 
        ? `Find the EXACT text "${originalValue}" within this section and replace it with "${newValue}". Do not change anything else.`
        : `Find the image with src "${originalValue}" within this section and replace the src with "${newValue}". Do not change anything else.`;

    const prompt = `
    EXISTING CODE:
    ${code}
    
    TASK:
    Find the React Component or JSX Section with the attribute 'data-section="${sectionId}"'.
    ${instruction}
    
    CRITICAL:
    1. Only modify the specific target element.
    2. Maintain the 'data-section="${sectionId}"' attribute.
    3. RETURN THE FULL UPDATED 'App.jsx' FILE.
    
    STRICT CONSTRAINTS:
    - OUTPUT RAW CODE ONLY. NO MARKDOWN BLOCKS.
    `;
    
    const result = await model.generateContent({
        contents: [{ role: 'user', parts: [{ text: prompt }] }],
    });
    
    const response = await result.response;
    let text = response.candidates[0].content.parts[0].text;
    
    text = text.replace(/```jsx/g, '').replace(/```javascript/g, '').replace(/```/g, '');
    return text;
}

module.exports = { generateCode, fixCode, regenerateSection, updateSectionContent };
