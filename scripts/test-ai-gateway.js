#!/usr/bin/env node
// One-shot smoke test for services/ai-gateway.js
// Usage:
//   node scripts/test-ai-gateway.js                    # Kimi K2.6 (5-15 min)
//   node scripts/test-ai-gateway.js fast               # Llama 3.1 8B (seconds)
//   node scripts/test-ai-gateway.js '@cf/<model>'      # custom model

require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });
const { generateContent } = require('../services/ai-gateway');

const arg = process.argv[2];
let model;
if (!arg) model = '@cf/moonshotai/kimi-k2.6';
else if (arg === 'fast') model = '@cf/meta/llama-3.1-8b-instruct-fast';
else model = arg;

(async () => {
    const startedAt = Date.now();
    try {
        const result = await generateContent(
            'Return only the two characters: OK',
            { model, maxTokens: 32, temperature: 0 }
        );
        const elapsed = ((Date.now() - startedAt) / 1000).toFixed(1);
        console.log(`\n[smoke] ${model} returned in ${elapsed}s`);
        console.log(`[smoke] finishReason=${result.finishReason}`);
        console.log(`[smoke] usage=${JSON.stringify(result.usage)}`);
        console.log(`[smoke] text=${JSON.stringify(result.text)}`);
    } catch (err) {
        console.error(`[smoke] FAILED:`, err.message);
        process.exit(1);
    }
})();
