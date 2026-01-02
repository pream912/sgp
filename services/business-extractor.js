const { google } = require('googleapis');
const { VertexAI } = require('@google-cloud/vertexai');

const vertex_ai = new VertexAI({
  project: process.env.GCP_PROJECT, 
  location: process.env.GOOGLE_CLOUD_LOCATION || 'us-central1'
});
const model = vertex_ai.preview.getGenerativeModel({
  model: 'gemini-2.5-flash',
});

const customsearch = google.customsearch('v1');

// --- PROMPTS ---

const SUMMARY_PROMPT = `
You are an expert copywriter.
Based on the provided structured business data (from Google Places), generate a catchy "Business Summary" and identify the "Vibe".

Input Data:
{DATA}

Output Format (Markdown):
**Business Summary**: [A compelling 2-3 sentence description]
**Industry**: [Best guess]
**Vibe**: [Adjectives]
**Selling Points**: [Bullet points based on reviews/summary]
`;

const SEARCH_PROMPT = `
You are an expert data extractor.
Analyze the provided search results about a business, including snippets and structured data.
Synthesize the information into a comprehensive Business Profile.

Structure:
1. **Business Summary**: Name, Industry, Vibe, Selling Points.
2. **Contact Details**: Address, Phone, Email.
3. **Opening Hours**: (if found).
4. **Reviews/Testimonials**: Extract quotes/ratings.
5. **Key Services**: Bullet points.

Output plain text (Markdown).
`;

// --- MAIN FUNCTION ---

async function extractFromUrl(query) {
    try {
        console.log(`Extracting info for: "${query}"`);
        
        // 1. Try Google Places API (New) - Preferred for local businesses
        try {
            const placesData = await fetchPlacesData(query);
            if (placesData) {
                console.log('Successfully fetched data from Google Places API.');
                return await formatPlacesData(placesData);
            }
        } catch (e) {
            console.warn('Google Places API failed or disabled. Falling back to Search.', e.message);
        }

        // 2. Fallback to Custom Search
        console.log('Using Google Custom Search fallback...');
        return await fetchCustomSearchData(query);

    } catch (error) {
        console.error('Extraction failed:', error);
        throw new Error(`Could not extract business info: ${error.message}`);
    }
}

// --- PLACES API STRATEGY ---

async function fetchPlacesData(query) {
    const key = process.env.GOOGLE_SEARCH_API_KEY;
    if (!key) return null;

    const url = `https://places.googleapis.com/v1/places:searchText`;
    const fieldMask = [
        'places.displayName',
        'places.formattedAddress',
        'places.nationalPhoneNumber',
        'places.regularOpeningHours',
        'places.reviews',
        'places.editorialSummary',
        'places.websiteUri',
        'places.primaryType' // e.g. "dental_clinic"
    ].join(',');

    const response = await fetch(url, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'X-Goog-Api-Key': key,
            'X-Goog-FieldMask': fieldMask
        },
        body: JSON.stringify({ textQuery: query })
    });

    const data = await response.json();
    
    if (data.error) {
        throw new Error(data.error.message);
    }

    if (!data.places || data.places.length === 0) {
        return null; 
    }

    return data.places[0];
}

async function formatPlacesData(place) {
    // We use AI to generate the "Creative" parts (Summary, Vibe) from the raw data
    const rawDataSummary = JSON.stringify({
        name: place.displayName?.text,
        summary: place.editorialSummary?.text,
        type: place.primaryType,
        reviews: place.reviews?.slice(0, 5).map(r => r.text?.text).join(' | ')
    });

    const result = await model.generateContent({
        contents: [{ role: 'user', parts: [{ text: SUMMARY_PROMPT.replace('{DATA}', rawDataSummary) }] }],
    });
    const aiSummary = await result.response.candidates[0].content.parts[0].text;

    // --- CLEANUP LOGIC ---
    
    // 1. Truncate Reviews (Max 180 chars)
    const MAX_REVIEW_LEN = 180;
    const reviews = place.reviews?.slice(0, 3).map(r => {
        let text = r.text?.text || r.originalText?.text || "";
        if (text.length > MAX_REVIEW_LEN) {
            text = text.substring(0, MAX_REVIEW_LEN) + "...";
        }
        const author = r.authorAttribution?.displayName || 'Customer';
        return `"${text}" - ${author}`;
    }).join('\n\n') || "No reviews found.";
    
    // 2. Format Hours (Simplify if possible, otherwise list)
    // The API returns "Monday: 9AM-5PM". We leave this but ensure no extra junk.
    const hours = place.regularOpeningHours?.weekdayDescriptions?.join('\n') || "Hours not available.";

    // 3. Address (Clean up if needed, currently using formattedAddress)
    const address = place.formattedAddress || 'N/A';

    return `
${aiSummary}

**Contact Details**
*   **Address**: ${address}
*   **Phone**: ${place.nationalPhoneNumber || 'N/A'}
*   **Website**: ${place.websiteUri || 'N/A'}

**Opening Hours**
${hours}

**Reviews/Testimonials**
${reviews}
    `;
}

// --- CUSTOM SEARCH STRATEGY ---

async function fetchCustomSearchData(query) {
    if (!process.env.GOOGLE_SEARCH_API_KEY || !process.env.GOOGLE_SEARCH_CX) {
        throw new Error('Missing Google Search API Key or CX ID');
    }

    const res = await customsearch.cse.list({
        cx: process.env.GOOGLE_SEARCH_CX,
        q: query,
        auth: process.env.GOOGLE_SEARCH_API_KEY,
    });

    const items = res.data.items;
    if (!items || items.length === 0) {
        throw new Error('No search results found');
    }

    const searchContext = items.map(item => {
        const schema = item.pagemap ? JSON.stringify(item.pagemap) : '';
        return `
Title: ${item.title}
Snippet: ${item.snippet}
Link: ${item.link}
SchemaData: ${schema}
        `;
    }).join('\n---\n');

    const result = await model.generateContent({
        contents: [{ role: 'user', parts: [{ text: SEARCH_PROMPT + "\n\nSEARCH RESULTS:\n" + searchContext }] }],
    });

    return result.response.candidates[0].content.parts[0].text;
}

module.exports = { extractFromUrl };
