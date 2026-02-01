const queryString = require('querystring');

async function fetchImages(keywords, count = 10) {
    let images = [];

    // 1. Try Unsplash
    if (process.env.UNSPLASH_ACCESS_KEY) {
        try {
            console.log(`[Images] Attempting Unsplash...`);
            images = await fetchUnsplashImages(keywords, count);
            if (images.length > 0) return images;
        } catch (e) {
            console.warn(`[Images] Unsplash failed:`, e.message);
        }
    } else {
        console.warn('[Images] No UNSPLASH_ACCESS_KEY found. Skipping.');
    }

    // 2. Try Pexels (Fallback)
    if (process.env.PEXELS_API_KEY) {
        try {
            console.log(`[Images] Attempting Pexels fallback...`);
            images = await fetchPexelsImages(keywords, count);
            if (images.length > 0) return images;
        } catch (e) {
            console.warn(`[Images] Pexels failed:`, e.message);
        }
    } else {
         console.warn('[Images] No PEXELS_API_KEY found. Skipping.');
    }

    // 3. Final Fallback (Pollinations/Placeholder)
    console.warn('[Images] All APIs failed/missing. Using Pollinations fallback.');
    return generateFallbackImages(keywords, count);
}

async function fetchUnsplashImages(keywords, count) {
    const accessKey = process.env.UNSPLASH_ACCESS_KEY;
    const query = keywords.join(' ');
    const url = `https://api.unsplash.com/photos/random?client_id=${accessKey}&query=${encodeURIComponent(query)}&count=${count}&orientation=landscape`;

    const response = await fetch(url);
    if (!response.ok) {
        throw new Error(`Unsplash API Error: ${response.status}`);
    }

    const data = await response.json();
    return data.map(img => img.urls.regular);
}

async function fetchPexelsImages(keywords, count) {
    const apiKey = process.env.PEXELS_API_KEY;
    // Pexels search query
    const query = keywords.join(' ');
    const url = `https://api.pexels.com/v1/search?query=${encodeURIComponent(query)}&per_page=${count}&orientation=landscape`;

    const response = await fetch(url, {
        headers: {
            'Authorization': apiKey
        }
    });

    if (!response.ok) {
        throw new Error(`Pexels API Error: ${response.status}`);
    }

    const data = await response.json();
    
    // Pexels returns { photos: [...] }
    if (!data.photos || data.photos.length === 0) {
        throw new Error('Pexels returned no images.');
    }

    return data.photos.map(photo => photo.src.large);
}

function generateFallbackImages(keywords, count) {
    console.log('[Images] Generating Pollinations fallback images...');
    // Generate distinct Pollinations URLs as fallback
    return Array.from({ length: count }, (_, i) => {
        const keyword = keywords[i % keywords.length] || 'business';
        // Add a random param to ensure uniqueness if using same keyword
        return `https://pollinations.ai/p/${encodeURIComponent(keyword)}?width=800&height=600&nologo=true&seed=${i}`;
    });
}

module.exports = { fetchImages };
