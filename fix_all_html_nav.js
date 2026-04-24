const fs = require('fs');
const path = require('path');

const distDir = path.join(__dirname, 'projects_source/1774970985000/dist');
const files = fs.readdirSync(distDir).filter(f => f.endsWith('.html'));

const desktopInsert = `<a href="extended-consent.html" class="block py-1.5 text-sm text-text/80 hover:text-primary transition">Extended Consent</a>`;
const mobileInsert = `<a href="extended-consent.html" class="block font-body text-sm py-1 hover:text-primary transition">Extended Consent</a>`;

for (const file of files) {
    const filePath = path.join(distDir, file);
    let html = fs.readFileSync(filePath, 'utf-8');

    // Desktop
    html = html.replace(
        /<a href="terms-disclaimer\.html" class="block py\.1\.5 text-sm text-text\/80 hover:text-primary transition">Terms & Disclaimer<\/a>/g,
        `<a href="terms-disclaimer.html" class="block py-1.5 text-sm text-text/80 hover:text-primary transition">Terms & Disclaimer</a>\n                                    ${desktopInsert}`
    );

    // Mobile
    html = html.replace(
        /<a href="terms-disclaimer\.html" class="block font-body text-sm py-1 hover:text-primary transition">Terms & Disclaimer<\/a>/g,
        `<a href="terms-disclaimer.html" class="block font-body text-sm py-1 hover:text-primary transition">Terms & Disclaimer</a>\n                ${mobileInsert}`
    );

    fs.writeFileSync(filePath, html);
    console.log(`Updated ${file}`);
}
