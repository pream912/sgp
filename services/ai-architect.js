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
- colorPalette (primary, secondary, accent, background, text - as HEX codes)
- typography (fontFamily, scale)
- googleFonts (Object with 'heading' and 'body' fields, containing valid Google Font names e.g., "Inter", "Playfair Display", "Roboto Mono")
- vibe (adjectives describing the look and feel)
- layoutStructure (brief description)
- heroStyle (Choose one: "Split Screen (Text Left/Image Right)", "Centered Text with Large Background Image", "Minimalist Typography-Focused", "Grid Gallery Hero", "Asymmetrical Creative Layout", "Card-Based Hero")

Output JSON only.
`;

async function generateDesign(userInfo) {
     const result = await model.generateContent({
        contents: [{ role: 'user', parts: [{ text: SYSTEM_PROMPT + "\nUSER INFO: " + userInfo }] }],
    });
    
    const response = await result.response;
    return JSON.parse(response.candidates[0].content.parts[0].text);
}

module.exports = { generateDesign };
