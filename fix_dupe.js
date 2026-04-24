const fs = require('fs');
const path = require('path');

const dir = './projects_source/1774970985000/dist';
const files = fs.readdirSync(dir).filter(f => f.endsWith('.html'));

for (const file of files) {
    const filePath = path.join(dir, file);
    let content = fs.readFileSync(filePath, 'utf8');

    // Remove duplicate mobile nav line
    content = content.replace(
        /<a href="extended-consent.html" class="block font-body text-sm py-1 hover:text-primary transition">Extended Consent<\/a>\n\s*<a href="extended-consent.html" class="block font-body text-sm py-1 hover:text-primary transition">Extended Consent<\/a>/g,
        '<a href="extended-consent.html" class="block font-body text-sm py-1 hover:text-primary transition">Extended Consent</a>'
    );

    fs.writeFileSync(filePath, content);
}
console.log('Fixed duplicate navs');
