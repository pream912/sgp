const { deploySite } = require('./services/deploy');
const path = require('path');
async function run() {
    try {
        const distDir = path.join(__dirname, 'projects_source/1774970985000/dist');
        await deploySite(distDir, '1774970985000', '1774970985000');
        console.log('Deployed sdc site to GCS bucket.');
    } catch(e) {
        console.error(e);
    }
}
run();
