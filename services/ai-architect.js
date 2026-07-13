const { generateContent } = require('./ai-gateway');

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
- vibe (adjectives describing the look and feel, e.g., "Clean", "Professional", "Playful", "Elegant")
- stylePreset (Choose one: "Glassmorphism", "Neumorphism", "Bento Grid", "Aurora", "Brutalist", "Minimalist", "Luxury")
- gradientStyle (Choose one: "Linear Fade", "Mesh/Aurora", "Subtle Radial", "High Contrast Diagonal", "Glassy Blur", "None")
- layoutStructure (brief description, e.g., "Bento Grid Layout", "Asymmetrical Split", "Single Column Scroll", "Parallax Sections")
- heroStyle (Choose one: "Split Screen (Text Left/Image Right)", "Centered Text with Large Background Image", "Grid Gallery Hero", "Asymmetrical Creative Layout", "Card-Based Hero", "Floating 3D Elements")
- headerStyle (Choose one: "Simple Logo Left, Links Right", "Centered Logo, Split Navigation", "Full Width with Hamburger Menu", "Minimalist Sticky Header", "Double Navbar (Top Info Bar + Main Nav)", "Sidebar Navigation (Left Aligned)", "Floating Pill Navigation (Centered)", "Mega Menu with Icons", "Transparent Overlay Header", "Brutalist Bordered Header", "Glassmorphic Strip")
- footerStyle (Choose one: "Simple Copyright Only", "Multi-Column Links", "Centered Logo & Socials", "Newsletter Focus", "Dark Minimalist", "Big Typography Footer", "Interactive Map & Contact Footer", "Asymmetrical Grid Footer", "Sticky Bottom Bar", "Gradient Background Footer")
- imageKeywords (Array of 5 strings: relevant search terms for images based on the business, e.g., ["coffee", "cafe", "latte", "beans", "barista"])

Output JSON only.
`;

async function generateDesign(userInfo, logoBuffer, logoMimeType) {
    let prompt = SYSTEM_PROMPT + "\n" + userInfo;
    let parts = null;

    if (logoBuffer && logoMimeType) {
        parts = [
            { text: SYSTEM_PROMPT + "\n" + userInfo },
            {
                inline_data: {
                    mime_type: logoMimeType,
                    data: logoBuffer.toString('base64')
                }
            },
            { text: "\nIMPORTANT: The user has provided a logo (attached above). \n1. DERIVE a professional, web-ready color palette inspired by this logo. \n2. DO NOT just extract raw pixel colors if they are too neon/cartoonish. Adjust saturation/brightness to create a sophisticated look suitable for the business type. \n3. Ensure the 'primary' color matches the brand, but 'background' and 'text' remain readable and professional. \n4. The 'vibe' must harmonize with the logo style." }
        ];
    }

    // Llama 3.3 70B Fast is text-only; switch to Gemma 3 12B (multimodal) when a logo is provided.
    const model = parts
        ? '@cf/google/gemma-3-12b-it'
        : '@cf/meta/llama-3.3-70b-instruct-fp8-fast';

    const result = await generateContent(prompt, {
        model,
        maxTokens: 8192,
        temperature: 0.7,
        responseMimeType: 'application/json',
        parts,
    });

    const cleaned = (result.text || '').replace(/^```(?:json)?\s*/i, '').replace(/\s*```\s*$/i, '').trim();
    try {
        return { design: JSON.parse(cleaned), usage: result.usage };
    } catch (e) {
        console.error('[architect] JSON parse failed. finishReason=%s, len=%d, head=%s', result.finishReason, cleaned.length, cleaned.slice(0, 200));
        throw new Error(`Architect returned invalid JSON (${e.message}; finishReason=${result.finishReason}; len=${cleaned.length})`);
    }
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
    Vary the style (e.g., Dark Mode, Pastel, High Contrast, Modern Gradient-Ready, Glassmorphic Base) to be distinct from a standard look, but appropriate for the business.
    `;

    const result = await generateContent(prompt, {
        model: '@cf/meta/llama-3.3-70b-instruct-fp8-fast',
        maxTokens: 4096,
        temperature: 0.7,
        responseMimeType: 'application/json',
    });

    const cleaned = (result.text || '').replace(/^```(?:json)?\s*/i, '').replace(/\s*```\s*$/i, '').trim();
    const json = JSON.parse(cleaned);
    return { palette: json.colorPalette, usage: result.usage };
}

module.exports = { generateDesign, generatePalette };
