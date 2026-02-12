require('dotenv').config();

async function testUnsplash() {
    console.log("\n--- Testing Unsplash API ---");
    const accessKey = process.env.UNSPLASH_ACCESS_KEY;
    if (!accessKey) {
        console.error("❌ UNSPLASH_ACCESS_KEY is missing.");
        return;
    }
    console.log("Key found (ends in):", accessKey.slice(-4));

    const keywords = ['business', 'modern'];
    const count = 1;
    const query = keywords.join(' ');
    const url = `https://api.unsplash.com/photos/random?client_id=${accessKey}&query=${encodeURIComponent(query)}&count=${count}&orientation=landscape`;

    try {
        const response = await fetch(url);
        console.log("Status:", response.status);
        
        if (!response.ok) {
            const text = await response.text();
            console.error("❌ Unsplash Request Failed:", text);
            return;
        }

        const data = await response.json();
        if (data && data.length > 0) {
            console.log("✅ Unsplash Success! Image URL:", data[0].urls.regular);
        } else {
            console.warn("⚠️ Unsplash returned 200 but no images.");
        }
    } catch (error) {
        console.error("❌ Unsplash Network Error:", error.message);
    }
}

async function testPexels() {
    console.log("\n--- Testing Pexels API ---");
    const apiKey = process.env.PEXELS_API_KEY;
    if (!apiKey) {
        console.error("❌ PEXELS_API_KEY is missing.");
        return;
    }
    console.log("Key found (ends in):", apiKey.slice(-4));

    const keywords = ['business', 'modern'];
    const count = 1;
    const query = keywords.join(' ');
    const url = `https://api.pexels.com/v1/search?query=${encodeURIComponent(query)}&per_page=${count}&orientation=landscape`;

    try {
        const response = await fetch(url, {
            headers: { 'Authorization': apiKey }
        });
        console.log("Status:", response.status);

        if (!response.ok) {
            const text = await response.text();
            console.error("❌ Pexels Request Failed:", text);
            return;
        }

        const data = await response.json();
        if (data.photos && data.photos.length > 0) {
            console.log("✅ Pexels Success! Image URL:", data.photos[0].src.large);
        } else {
            console.warn("⚠️ Pexels returned 200 but no images.");
        }
    } catch (error) {
        console.error("❌ Pexels Network Error:", error.message);
    }
}

async function run() {
    await testUnsplash();
    await testPexels();
}

run();
