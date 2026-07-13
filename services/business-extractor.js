const { google } = require('googleapis');
const { generateContent } = require('./ai-gateway');

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

// --- CANDIDATE SEARCH (multi-result, for Genni's "pick your business" cards) ---

// Places text-search results cached briefly so a user refining their pick
// doesn't burn quota; only populated on explicit submits, never per keystroke.
const searchCache = new Map(); // normalizedQuery -> { at, places }
const SEARCH_CACHE_TTL_MS = 15 * 60 * 1000;
const SEARCH_CACHE_MAX = 200;

function cacheGet(query) {
    const entry = searchCache.get(query);
    if (!entry) return null;
    if (Date.now() - entry.at > SEARCH_CACHE_TTL_MS) {
        searchCache.delete(query);
        return null;
    }
    // Refresh recency for LRU eviction
    searchCache.delete(query);
    searchCache.set(query, entry);
    return entry.places;
}

function cacheSet(query, places) {
    if (searchCache.size >= SEARCH_CACHE_MAX) {
        searchCache.delete(searchCache.keys().next().value);
    }
    searchCache.set(query, { at: Date.now(), places });
}

/**
 * Search Google Places and return up to `maxResults` candidates for user selection.
 * Cheap mapping only — full extraction happens in extractFromPlace() after the pick.
 */
async function searchBusinessCandidates(query, maxResults = 5) {
    const places = await fetchPlacesCandidates(query, maxResults);
    if (!places) return [];
    return places.map(p => ({
        placeId: p.id || null,
        name: p.displayName?.text || '',
        address: p.formattedAddress || '',
        phone: p.nationalPhoneNumber || '',
        rating: p.rating || null,
        ratingCount: p.userRatingCount || 0,
        website: p.websiteUri || '',
        mapsUrl: p.googleMapsUri || '',
        primaryType: prettifyType(p.primaryType),
    }));
}

/**
 * Full extraction for a specific candidate previously returned by
 * searchBusinessCandidates (looked up from the cache by placeId).
 */
async function extractFromPlace(query, placeId) {
    const normalized = query.trim().toLowerCase();
    let places = cacheGet(normalized);
    if (!places) places = await fetchPlacesCandidates(query, 5);
    const place = (places || []).find(p => p.id === placeId);
    if (!place) throw new Error('Selected business not found. Please search again.');
    const { data, usage } = await formatPlacesData(place);
    data.placePhotos = await resolvePlacePhotos(place);
    return { data, usageLog: usage ? [usage] : [] };
}

/**
 * Resolve Places photo references into public image URLs (Places Photo API media
 * redirect). Capped small — these are hero/gallery candidates, not a full album.
 */
async function resolvePlacePhotos(place, max = 6) {
    const key = process.env.GOOGLE_SEARCH_API_KEY;
    if (!key || !Array.isArray(place.photos)) return [];
    return place.photos
        .slice(0, max)
        .filter(p => p.name)
        .map(p => `https://places.googleapis.com/v1/${p.name}/media?maxWidthPx=1200&key=${key}`);
}

function prettifyType(primaryType) {
    // "pizza_restaurant" -> "Pizza Restaurant"
    return (primaryType || '')
        .split('_').filter(Boolean)
        .map(w => w.charAt(0).toUpperCase() + w.slice(1))
        .join(' ');
}

// --- MAIN FUNCTION ---

async function extractFromUrl(query) {
    try {
        console.log(`Extracting info for: "${query}"`);
        const usageLog = [];

        // 1. Try Google Places API (New) - Preferred for local businesses
        try {
            const places = await fetchPlacesCandidates(query, 1);
            if (places && places.length > 0) {
                console.log('Successfully fetched data from Google Places API.');
                const { data, usage } = await formatPlacesData(places[0]);
                data.placePhotos = await resolvePlacePhotos(places[0]);
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

async function fetchPlacesCandidates(query, maxResults = 5) {
    const key = process.env.GOOGLE_SEARCH_API_KEY;
    if (!key) return null;

    const normalized = query.trim().toLowerCase();
    const cached = cacheGet(normalized);
    if (cached) return cached.slice(0, maxResults);

    const url = `https://places.googleapis.com/v1/places:searchText`;
    const fieldMask = [
        'places.id',
        'places.displayName',
        'places.formattedAddress',
        'places.nationalPhoneNumber',
        'places.regularOpeningHours',
        'places.rating',
        'places.userRatingCount',
        'places.googleMapsUri',
        'places.reviews.rating',
        'places.reviews.text',
        'places.reviews.authorAttribution',
        'places.editorialSummary',
        'places.websiteUri',
        'places.primaryType',
        'places.photos.name'
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

    cacheSet(normalized, data.places);
    return data.places.slice(0, maxResults);
}

async function formatPlacesData(place) {
    const reviews = place.reviews
        ?.filter(r => r.rating >= 4)
        .slice(0, 5)
        .map(r => {
            const text = r.text?.text || r.originalText?.text || "Great service!";
            const author = r.authorAttribution?.displayName || "Happy Customer";
            return `"${text}" - ${author}`;
        }) || [];

    const prettyIndustry = prettifyType(place.primaryType);

    return {
        data: {
            name: place.displayName?.text || '',
            industry: prettyIndustry,
            description: place.editorialSummary?.text || '',
            address: place.formattedAddress || '',
            phone: place.nationalPhoneNumber || '',
            website: place.websiteUri || '',
            email: '',
            socials: { facebook: '', instagram: '', twitter: '', linkedin: '', youtube: '' },
            openingHours: place.regularOpeningHours?.weekdayDescriptions?.join('\n') || '',
            reviews,
        },
        usage: null,
    };
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

    let result;
    try {
        result = await generateContent(SEARCH_PROMPT.replace('{SEARCH_RESULTS}', searchContext), {
            model: '@cf/meta/llama-3.1-8b-instruct-fast',
            maxTokens: 1024,
            temperature: 0.3,
            responseMimeType: 'application/json',
        });
    } catch (aiError) {
        console.warn('AI synthesis failed for search results:', aiError.message);
        const first = items[0] || {};
        return {
            data: {
                name: first.title || query,
                description: first.snippet || '',
                website: first.link || ''
            },
            usage: null
        };
    }

    let textResponse = result.text.replace(/```json/g, '').replace(/```/g, '').trim();

    try {
        return { data: JSON.parse(textResponse), usage: result.usage };
    } catch (e) {
        console.error("Failed to parse AI JSON response (Search)", textResponse);
        return {
            data: {
                name: query,
                description: "Could not automatically extract details."
            },
            usage: result.usage
        };
    }
}

module.exports = { extractFromUrl, searchBusinessCandidates, extractFromPlace };
