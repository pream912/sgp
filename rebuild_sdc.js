const { rebuildSite } = require('./services/builder');
async function run() {
    try {
        await rebuildSite('1774970985000');
        console.log('Rebuilt sdc site locally.');
    } catch(e) {
        console.error(e);
    }
}
run();
