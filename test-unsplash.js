require('dotenv').config();

async function testUnsplash() {
    const accessKey = process.env.UNSPLASH_ACCESS_KEY;

    console.log('--- Unsplash API Test ---');
    
    if (!accessKey) {
        console.error('ERROR: UNSPLASH_ACCESS_KEY is missing in .env file.');
        return;
    }

    console.log(`Access Key found: ${accessKey.substring(0, 5)}...`);

    const query = 'coffee shop';
    const count = 3;
    const url = `https://api.unsplash.com/photos/random?client_id=${accessKey}&query=${encodeURIComponent(query)}&count=${count}&orientation=landscape`;

    console.log(`Fetching from: ${url}`);

    try {
        const response = await fetch(url);
        
        console.log(`Response Status: ${response.status} ${response.statusText}`);

        if (!response.ok) {
            const errorText = await response.text();
            console.error('API Error Body:', errorText);
            return;
        }

        const data = await response.json();
        console.log(`Successfully fetched ${data.length} images.`);
        
        data.forEach((img, index) => {
            console.log(`[${index + 1}] ${img.urls.regular}`);
        });

    } catch (error) {
        console.error('Network/Execution Error:', error);
    }
}

testUnsplash();
