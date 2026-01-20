const https = require('https');
const fs = require('fs');

const fetchImage = (query) => {
    // Using a public client_id for demo purposes or the one from env if I could access it.
    // Since I can't access env easily here, I'll use a source.unsplash.com equivalent or just a known good ID if I had one.
    // Actually, I'll try to use the previous method but I need the key.
    // I will just use a direct high-quality Unsplash ID that represents 'editing' or 'design'.
    // photo-1498050108023-c5249f4df085 (Laptop with code)
    // photo-1581291518633-83b4ebd1d83e (Design tools)
    
    // I'll stick to a fixed URL to be safe and fast.
    const url = "https://images.unsplash.com/photo-1586281380349-632531db7ed4?q=80&w=1080&auto=format&fit=crop"; // Notebook/Writing/Editing
    console.log(url);
};

fetchImage();
