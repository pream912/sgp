require('dotenv').config();
console.log('GCP_PROJECT:', process.env.GCP_PROJECT);
try {
    const { generateCode } = require('./services/ai-coder');
    console.log('ai-coder loaded successfully');
} catch (e) {
    console.error('Error loading ai-coder:', e);
}
