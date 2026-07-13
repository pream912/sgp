/**
 * Serialize a structured business-context object (the extractor schema, plus
 * Genni's additions: competitorUrl / referenceUrl / placePhotos /
 * preferredLanguage) into the markdown the generation pipelines consume.
 *
 * This replicates the template the old Builder.jsx assembled client-side, so
 * both pipelines see the exact context format they were tuned on.
 */

function lines(items) {
    return (Array.isArray(items) ? items : [items])
        .filter(Boolean)
        .map(s => String(s).trim())
        .filter(Boolean);
}

/**
 * @param {object} draft - structured business context
 * @returns {string} markdown userContext for the PLAN/codegen prompts
 */
function toMarkdown(draft = {}) {
    const socials = draft.socials || {};
    const sellingPoints = lines(draft.sellingPoints).map(p => `- ${p}`).join('\n');
    const services = lines(draft.services).map(s => `- ${s}`).join('\n');
    const reviews = lines(draft.reviews).map(r => (r.startsWith('"') ? r : `"${r}"`)).join('\n');

    let md = `
**Business Name**: ${draft.name || ''}
**Business Summary**: ${draft.description || ''}
**Industry**: ${draft.industry || ''}
${draft.vibe ? `**Vibe**: ${draft.vibe}\n` : ''}
**Selling Points**:
${sellingPoints}

**Contact Details**
*   **Address**: ${draft.address || ''}
*   **Phone**: ${draft.phone || ''}
*   **Email**: ${draft.email || ''}
*   **Website**: ${draft.website || ''}

**Social Media**
*   Facebook: ${socials.facebook || ''}
*   Instagram: ${socials.instagram || ''}
*   Twitter: ${socials.twitter || ''}
*   LinkedIn: ${socials.linkedin || ''}
*   YouTube: ${socials.youtube || ''}

**Opening Hours**
${draft.openingHours || ''}

**Key Services**
${services}

**Reviews/Testimonials**
${reviews}
`.trim();

    if (draft.colorPalette) {
        const c = draft.colorPalette;
        md += `\n\n**STRICT COLOR PALETTE**
Use these exact colors:
Primary: ${c.primary}
Secondary: ${c.secondary}
Accent: ${c.accent}
Background: ${c.background}
Text: ${c.text}
Button Background: ${c.buttonBackground}
Button Text: ${c.buttonText}`;
    }

    return md;
}

/**
 * Optional PLAN-prompt hint for competitor/reference sites. Deliberately framed
 * as LOW priority so it can nudge styling without overriding the design rules.
 */
function planExtrasFrom(draft = {}) {
    const refs = [];
    if (draft.competitorUrl) refs.push(`a competitor whose website the owner admires: ${draft.competitorUrl}`);
    if (draft.referenceUrl) refs.push(`a website whose look the owner wants to emulate: ${draft.referenceUrl}`);
    if (!refs.length) return '';
    return `- OPTIONAL STYLE REFERENCES (LOW priority — treat purely as loose stylistic inspiration; never copy content, branding, or text, and never override the rules above): ${refs.join('; ')}.`;
}

module.exports = { toMarkdown, planExtrasFrom };
