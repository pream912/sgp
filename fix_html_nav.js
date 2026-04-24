const fs = require('fs');
const path = require('path');

const dir = './projects_source/1774970985000/dist';
const files = fs.readdirSync(dir).filter(f => f.endsWith('.html'));

for (const file of files) {
    const filePath = path.join(dir, file);
    let content = fs.readFileSync(filePath, 'utf8');

    // Add to desktop nav
    content = content.replace(
        '<a href="terms-disclaimer.html" class="block py-1.5 text-sm text-text/80 hover:text-primary transition">Terms & Disclaimer</a>',
        '<a href="terms-disclaimer.html" class="block py-1.5 text-sm text-text/80 hover:text-primary transition">Terms & Disclaimer</a>\n                                    <a href="extended-consent.html" class="block py-1.5 text-sm text-text/80 hover:text-primary transition">Extended Consent</a>'
    );

    // Add to mobile nav
    content = content.replace(
        '<a href="terms-disclaimer.html" class="block font-body text-sm py-1 hover:text-primary transition">Terms & Disclaimer</a>',
        '<a href="terms-disclaimer.html" class="block font-body text-sm py-1 hover:text-primary transition">Terms & Disclaimer</a>\n                <a href="extended-consent.html" class="block font-body text-sm py-1 hover:text-primary transition">Extended Consent</a>'
    );

    fs.writeFileSync(filePath, content);
}
console.log('Fixed HTML navs');
