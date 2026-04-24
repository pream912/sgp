const fs = require('fs');
const path = './projects_source/1774970985000/dist/site-config.json';
const config = JSON.parse(fs.readFileSync(path, 'utf8'));

const moreNav = config.navigation.find(n => n.name === 'More');
if (moreNav) {
    // Prevent duplicate entries
    const exists = moreNav.children.find(c => c.path === 'extended-consent.html');
    if (!exists) {
        moreNav.children.push({
            name: "Extended Consent",
            path: "extended-consent.html",
            children: []
        });
        fs.writeFileSync(path, JSON.stringify(config, null, 2));
        console.log('Successfully added Extended Consent to More navigation.');
    } else {
        console.log('Extended Consent already exists in navigation.');
    }
} else {
    console.error('More navigation not found');
}
