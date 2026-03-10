const { google } = require('googleapis');
const { VertexAI } = require('@google-cloud/vertexai');

const vertex_ai = new VertexAI({
  project: process.env.GCP_PROJECT,
  location: 'global',
  apiEndpoint: 'aiplatform.googleapis.com'
});
const model = vertex_ai.preview.getGenerativeModel({
  model: 'gemini-3.1-flash-lite-preview',
});

const customsearch = google.customsearch('v1');

// --- PROMPTS ---

const SUMMARY_PROMPT = `
You are an expert data analyst.
Based on the provided structured business data (from Google Places), extract and refine the following fields into a valid JSON object.

Input Data:
{DATA}

Output JSON Format:
{
  "name": "Business Name",
  "industry": "Industry Type",
  "description": "A compelling 2-3 sentence business summary",
  "vibe": "Adjectives describing the atmosphere",
  "sellingPoints": ["Point 1", "Point 2"],
  "services": ["Service 1", "Service 2"],
  "address": "Full Address",
  "phone": "Phone Number",
  "website": "Website URL",
  "email": "Email Address (if found, else empty)",
  "socials": {
    "facebook": "",
    "instagram": "",
    "twitter": "",
    "linkedin": "",
    "youtube": ""
  },
  "openingHours": "Monday: ...",
  "reviews": ["Review 1", "Review 2"]
}

Ensure valid JSON. Do not include markdown code blocks.
`;

const SEARCH_PROMPT = `
You are an expert data extractor.
Analyze the provided search results about a business and synthesize the information into a strict JSON object.

Search Results:
{SEARCH_RESULTS}

Output JSON Format:
{
  "name": "Business Name",
  "industry": "Industry Type",
  "description": "Business Summary",
  "vibe": "Vibe/Atmosphere",
  "sellingPoints": ["Point 1", "Point 2"],
  "services": ["Service 1", "Service 2"],
  "address": "Address",
  "phone": "Phone",
  "website": "Website",
  "email": "Email",
  "socials": {
    "facebook": "",
    "instagram": "",
    "twitter": "",
    "linkedin": "",
    "youtube": ""
  },
  "openingHours": "Formatted opening hours",
  "reviews": ["Review 1", "Review 2"]
}

Ensure valid JSON. Do not include markdown code blocks.
`;

// --- MAIN FUNCTION ---

async function extractFromUrl(query) {
    try {
        console.log(`Extracting info for: "${query}"`);
        const usageLog = [];

        // 1. Try Google Places API (New) - Preferred for local businesses
        try {
            const placesData = await fetchPlacesData(query);
            if (placesData) {
                console.log('Successfully fetched data from Google Places API.');
                const { data, usage } = await formatPlacesData(placesData);
                if (usage) usageLog.push(usage);
                return { data, usageLog };
            }
        } catch (e) {
            console.warn('Google Places API failed or disabled. Falling back to Search.', e.message);
        }

        // 2. Fallback to Custom Search
        console.log('Using Google Custom Search fallback...');
        const { data, usage } = await fetchCustomSearchData(query);
        if (usage) usageLog.push(usage);
        return { data, usageLog };

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
        'places.reviews.rating', // Explicitly request rating
        'places.reviews.text',
        'places.reviews.authorAttribution',
        'places.editorialSummary',
        'places.websiteUri',
        'places.primaryType' 
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
    // 1. Prepare raw data for AI to refine
    // Explicitly format reviews with author names here, filtering for positive ones (4+ stars)
    const reviews = place.reviews
        ?.filter(r => r.rating >= 4) // Only positive reviews
        .slice(0, 5)
        .map(r => {
            const text = r.text?.text || r.originalText?.text || "Great service!";
            const author = r.authorAttribution?.displayName || "Happy Customer";
            return `"${text}" - ${author}`;
        }) || [];

    const rawDataSummary = JSON.stringify({
        name: place.displayName?.text,
        summary: place.editorialSummary?.text,
        type: place.primaryType,
        reviews: reviews,
        address: place.formattedAddress,
        phone: place.nationalPhoneNumber,
        website: place.websiteUri,
        hours: place.regularOpeningHours?.weekdayDescriptions
    });

    const result = await model.generateContent({
        contents: [{ role: 'user', parts: [{ text: SUMMARY_PROMPT.replace('{DATA}', rawDataSummary) }] }],
    });

    const usage = result.response.usageMetadata || null;
    let textResponse = result.response.candidates[0].content.parts[0].text;
    textResponse = textResponse.replace(/```json/g, '').replace(/```/g, '').trim();

    try {
        return { data: JSON.parse(textResponse), usage };
    } catch (e) {
        console.error("Failed to parse AI JSON response", textResponse);
        return {
            data: {
                name: place.displayName?.text || '',
                address: place.formattedAddress || '',
                phone: place.nationalPhoneNumber || '',
                website: place.websiteUri || '',
                description: place.editorialSummary?.text || '',
                reviews: reviews
            },
            usage
        };
    }
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
        contents: [{ role: 'user', parts: [{ text: SEARCH_PROMPT.replace('{SEARCH_RESULTS}', searchContext) }] }],
    });

    const usage = result.response.usageMetadata || null;
    let textResponse = result.response.candidates[0].content.parts[0].text;
    textResponse = textResponse.replace(/```json/g, '').replace(/```/g, '').trim();

    try {
        return { data: JSON.parse(textResponse), usage };
    } catch (e) {
        console.error("Failed to parse AI JSON response (Search)", textResponse);
        return {
            data: {
                name: query,
                description: "Could not automatically extract details."
            },
            usage
        };
    }
}

module.exports = { extractFromUrl };
