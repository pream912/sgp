const queryString = require('querystring');

async function fetchImages(keywords, count = 10) {
    const accessKey = process.env.UNSPLASH_ACCESS_KEY;

    // Fallback if no key provided
    if (!accessKey) {
        console.warn('No UNSPLASH_ACCESS_KEY found. Using fallback images.');
        return generateFallbackImages(keywords, count);
    }

    try {
        // We'll combine keywords or pick a random one to search
        const query = keywords.join(' ');
        const url = `https://api.unsplash.com/photos/random?client_id=${accessKey}&query=${encodeURIComponent(query)}&count=${count}&orientation=landscape`;

        console.log(`[Unsplash] Fetching images for query: "${query}"`);

        const response = await fetch(url);

        if (!response.ok) {
            const errorBody = await response.text();
            console.error(`[Unsplash] API Error: ${response.status} ${response.statusText}`, errorBody);
            throw new Error(`Unsplash API Error: ${response.status} ${response.statusText}`);
        }

        const data = await response.json();
        console.log(`[Unsplash] Success! Got ${data.length} images.`);
        
        // Extract regular URLs
        return data.map(img => img.urls.regular);

    } catch (error) {
        console.error('Failed to fetch images from Unsplash:', error.message);
        return generateFallbackImages(keywords, count);
    }
}

function generateFallbackImages(keywords, count) {
    console.log('[Unsplash] Generating Pollinations fallback images...');
    // Generate distinct Pollinations URLs as fallback
    return Array.from({ length: count }, (_, i) => {
        const keyword = keywords[i % keywords.length] || 'business';
        // Add a random param to ensure uniqueness if using same keyword
        return `https://pollinations.ai/p/${encodeURIComponent(keyword)}?width=800&height=600&nologo=true&seed=${i}`;
    });
}

module.exports = { fetchImages };
