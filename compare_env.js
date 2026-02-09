const fs = require('fs');
const dotenv = require('dotenv');
const yaml = require('js-yaml');

const envConfig = dotenv.parse(fs.readFileSync('.env'));
const yamlContent = fs.readFileSync('env.yaml', 'utf8');
let yamlConfig;

try {
    // env.yaml usually is KEY: VALUE, but gcloud expects explicit structure sometimes?
    // The file I saw looks like simple KEY: VALUE pairs.
    yamlConfig = yaml.load(yamlContent);
} catch (e) {
    console.error("YAML parse error:", e);
    process.exit(1);
}

const envKey = envConfig.FIREBASE_SERVICE_ACCOUNT;
const yamlKey = yamlConfig.FIREBASE_SERVICE_ACCOUNT;

console.log("ENV Key length:", envKey.length);
console.log("YAML Key length:", yamlKey.length);

if (envKey === yamlKey) {
    console.log("Keys are IDENTICAL.");
} else {
    console.log("Keys are DIFFERENT.");
    // Find first difference
    for(let i=0; i<Math.max(envKey.length, yamlKey.length); i++) {
        if (envKey[i] !== yamlKey[i]) {
            console.log(`Difference at index ${i}: ENV '${envKey.substring(i, i+10)}...' vs YAML '${yamlKey.substring(i, i+10)}...'`);
            break;
        }
    }
}
