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
   - CRITICAL: You MUST use Tailwind's arbitrary value syntax for ALL colors from the Design System.
   - Example: If primary color is "#FF5733", use "bg-[#FF5733]" or "text-[#FF5733]".
   - DO NOT use generic classes like "bg-primary" or "text-accent" as they are not defined.
4. TYPOGRAPHY:
   - Use 'font-heading' for all headings (h1, h2, h3, etc.).
   - Use 'font-body' for all body text.
   - These classes are pre-configured in the tailwind.config.js with fonts from the Design System.
5. BUTTONS:
   - ALWAYS use the 'buttonBackground' from the Design System for button backgrounds (e.g., bg-[#...]).
   - ALWAYS use the 'buttonText' from the Design System for button text (e.g., text-[#...]).
   - This applies to all CTA buttons in Header, Hero, and Features.
6. Images must use 'https://picsum.photos/seed/' + Math.floor(Math.random() * 1000) + '/800/600' for placeholders.
7. Use 'lucide-react' for icons. Import example: import { Home } from 'lucide-react';
8. Use 'framer-motion' for animations.
9. COMPATIBILITY: React 18.2.0, Vite 5.2.0.
10. Make the design complete, beautiful and production-ready.

DESIGN INTERPRETATION:
- STRICTLY IMPLEMENT the 'heroStyle' defined in the Design System. This is critical for visual variety.
- STRICTLY IMPLEMENT the 'headerStyle' and 'footerStyle' defined in the Design System.
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

module.exports = { generateCode, fixCode };
