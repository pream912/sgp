const { deploySite } = require('./services/deploy');
const path = require('path');

const projectId = '1774970985000';
const distPath = path.resolve(__dirname, `projects_source/${projectId}/dist`);

async function run() {
  try {
    console.log(`Deploying dist for project: ${projectId}`);
    const result = await deploySite(distPath, projectId);
    console.log('Deploy Result:', result);
  } catch (err) {
    console.error('Error:', err);
  }
}
run();
