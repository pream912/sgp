const { VertexAI } = require('@google-cloud/vertexai');

const vertex_ai = new VertexAI({
  project: process.env.GCP_PROJECT, 
  location: process.env.GOOGLE_CLOUD_LOCATION || 'us-central1'
});
const model = vertex_ai.preview.getGenerativeModel({
  model: 'gemini-2.5-flash',
   generationConfig: {
    'responseMimeType': 'application/json',
  },
});

const SYSTEM_PROMPT = `
You are an AI Architect.
Generate a Design System in JSON format based on the User Business Info.
Include:
- businessName (The name of the business extracted from the info)
- colorPalette (primary, secondary, accent, background, text, buttonBackground, buttonText - as HEX codes).
  - STRICT ACCESSIBILITY RULE: Ensure WCAG AA compliance for contrast.
  - 'background' vs 'text' MUST have a contrast ratio of at least 4.5:1.
  - 'buttonBackground' vs 'buttonText' MUST have a contrast ratio of at least 4.5:1.
  - If background is dark, text MUST be light (e.g., #F0F0F0).
  - If background is light, text MUST be dark (e.g., #1A1A1A).
- typography (fontFamily, scale)
- googleFonts (Object with 'heading' and 'body' fields, containing valid Google Font names e.g., "Inter", "Playfair Display", "Roboto Mono")
- vibe (adjectives describing the look and feel)
- layoutStructure (brief description)
- heroStyle (Choose one: "Split Screen (Text Left/Image Right)", "Centered Text with Large Background Image", "Minimalist Typography-Focused", "Grid Gallery Hero", "Asymmetrical Creative Layout", "Card-Based Hero")
- headerStyle (Choose one: "Simple Logo Left, Links Right", "Centered Logo, Split Navigation", "Full Width with Hamburger Menu", "Minimalist Sticky Header", "Double Navbar (Top Info Bar + Main Nav)", "Sidebar Navigation (Left Aligned)", "Floating Pill Navigation (Centered)", "Mega Menu with Icons", "Transparent Overlay Header", "Brutalist Bordered Header")
- footerStyle (Choose one: "Simple Copyright Only", "Multi-Column Links", "Centered Logo & Socials", "Newsletter Focus", "Dark Minimalist", "Big Typography Footer", "Interactive Map & Contact Footer", "Asymmetrical Grid Footer", "Sticky Bottom Bar", "Gradient Background Footer")
- imageKeywords (Array of 5 strings: relevant search terms for images based on the business, e.g., ["coffee", "cafe", "latte", "beans", "barista"])

Output JSON only.
`;

async function generateDesign(userInfo, logoBuffer, logoMimeType) {
    const parts = [{ text: SYSTEM_PROMPT + "\n" + userInfo }];
    
    if (logoBuffer && logoMimeType) {
        parts.push({
            inline_data: {
                mime_type: logoMimeType,
                data: logoBuffer.toString('base64')
            }
        });
        parts.push({ text: "\nIMPORTANT: The user has provided a logo (attached above). \n1. DERIVE a professional, web-ready color palette inspired by this logo. \n2. DO NOT just extract raw pixel colors if they are too neon/cartoonish. Adjust saturation/brightness to create a sophisticated look suitable for the business type. \n3. Ensure the 'primary' color matches the brand, but 'background' and 'text' remain readable and professional. \n4. The 'vibe' must harmonize with the logo style." });
    }

     const result = await model.generateContent({
        contents: [{ role: 'user', parts: parts }],
    });
    
    const response = await result.response;
    return JSON.parse(response.candidates[0].content.parts[0].text);
}

async function generatePalette(userInfo) {
    const prompt = `
    Based on the following User Context, generate a new Color Palette.
    USER CONTEXT: ${userInfo}
    
    Output JSON object with key 'colorPalette' containing:
    - primary, secondary, accent (HEX)
    - background (HEX)
    - text (HEX, readable on background)
    - buttonBackground (HEX)
    - buttonText (HEX, readable on buttonBackground)
    
    Ensure WCAG AA contrast compliance.
    Vary the style (e.g., Dark Mode, Pastel, High Contrast) to be distinct from a standard look, but appropriate for the business.
    `;
    
    const result = await model.generateContent({
        contents: [{ role: 'user', parts: [{ text: prompt }] }],
    });
    
    const response = await result.response;
    const json = JSON.parse(response.candidates[0].content.parts[0].text);
    return json.colorPalette;
}

module.exports = { generateDesign, generatePalette };
