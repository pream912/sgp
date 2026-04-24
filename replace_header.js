const fs = require('fs');

let consent = fs.readFileSync('projects_source/1774970985000/dist/extended-consent.html', 'utf8');
const header = fs.readFileSync('temp_header.html', 'utf8');

consent = consent.replace(/<header data-section="header"[\s\S]*?<\/header>/, header);
fs.writeFileSync('projects_source/1774970985000/dist/extended-consent.html', consent);
console.log('Replaced header');
