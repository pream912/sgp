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
- colorPalette (primary, secondary, accent, background, text, buttonBackground, buttonText - as HEX codes).
  - IMPORTANT: Ensure 'buttonBackground' and 'buttonText' have HIGH CONTRAST (e.g., dark on light or light on dark) to be fully readable.
- typography (fontFamily, scale)
- googleFonts (Object with 'heading' and 'body' fields, containing valid Google Font names e.g., "Inter", "Playfair Display", "Roboto Mono")
- vibe (adjectives describing the look and feel)
- layoutStructure (brief description)
- heroStyle (Choose one: "Split Screen (Text Left/Image Right)", "Centered Text with Large Background Image", "Minimalist Typography-Focused", "Grid Gallery Hero", "Asymmetrical Creative Layout", "Card-Based Hero")
- headerStyle (Choose one: "Simple Logo Left, Links Right", "Centered Logo, Split Navigation", "Full Width with Hamburger Menu", "Minimalist Sticky Header", "Double Navbar (Top Info Bar + Main Nav)")
- footerStyle (Choose one: "Simple Copyright Only", "Multi-Column Links", "Centered Logo & Socials", "Newsletter Focus", "Dark Minimalist")

Output JSON only.
`;

async function generateDesign(userInfo) {
     const result = await model.generateContent({
        contents: [{ role: 'user', parts: [{ text: SYSTEM_PROMPT + "\n" + userInfo }] }],
    });
    
    const response = await result.response;
    return JSON.parse(response.candidates[0].content.parts[0].text);
}

module.exports = { generateDesign };
