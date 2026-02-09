const fs = require('fs');
const dotenv = require('dotenv');

// Read .env
const envConfig = dotenv.parse(fs.readFileSync('.env'));

// Manually verify and fix the private_key just in case, though .env seems correct
let serviceAccount = JSON.parse(envConfig.FIREBASE_SERVICE_ACCOUNT);
// We don't need to fix newlines here because we want to write it back as a JSON string for the env var.
// But we must ensure the JSON string in env.yaml is correctly escaped.

// Re-serialize to JSON to ensure it's a valid single-line string
const jsonString = JSON.stringify(serviceAccount);

// Update the config object
envConfig.FIREBASE_SERVICE_ACCOUNT = jsonString;

// Generate YAML content
let yamlContent = '';
for (const [key, value] of Object.entries(envConfig)) {
    // For the long JSON string, we should single-quote it to match previous style,
    // but standard YAML scalar is safer.
    // If we use simple "key: value", and value has special chars, we need quotes.
    // JSON.stringify will add double quotes around the string if we use it again? No.
    
    // Simplest valid YAML for strings:
    // KEY: "value" (with double quotes and escaped internal quotes)
    
    // Use JSON.stringify on the value to get a safe JSON string representation, 
    // which is also valid YAML for scalars!
    yamlContent += `${key}: ${JSON.stringify(value)}\n`;
}

fs.writeFileSync('env.yaml', yamlContent);
console.log('env.yaml regenerated from .env');
