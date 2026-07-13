#!/usr/bin/env node
// Local AI-pipeline test. Runs builder.buildSite() with fake context.
// No D1, no R2 — just generates HTML into temp/test-build-<id>/dist.
//
// Required env (CLI overrides .env placeholders):
//   CF_ACCOUNT_ID, CF_AI_GATEWAY_TOKEN (or CF_API_TOKEN)
// Optional:
//   PEXELS_API_KEY, UNSPLASH_ACCESS_KEY  (else fetchImages returns empty)

require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });

const path = require('path');
const fs = require('fs');

const args = process.argv.slice(2);
const accountId = args[0] || process.env.CF_ACCOUNT_ID;
const aiToken = args[1] || process.env.CF_AI_GATEWAY_TOKEN || process.env.CF_API_TOKEN;

if (!accountId || accountId.startsWith('your_') || !aiToken || aiToken.startsWith('your_')) {
  console.error('Usage: node scripts/test-build-local.js <CF_ACCOUNT_ID> <CF_AI_GATEWAY_TOKEN>');
  console.error('Or set them in .env (no placeholders).');
  process.exit(1);
}
process.env.CF_ACCOUNT_ID = accountId;
process.env.CF_AI_GATEWAY_TOKEN = aiToken;
process.env.CF_API_TOKEN = aiToken;

const { buildSite } = require('../services/builder');

const id = `test-${Date.now()}`;
const pages = ['Home', 'About', 'Services'];

const userContext = `
**Business Name**: BeanCraft Coffee
**Business Summary**: A relaxed, modern Seattle coffee shop specializing in cold brew and single-origin Ethiopian beans. Open early mornings and late nights.
**Industry**: Cafe / Coffee Shop

**Selling Points**:
- House-roasted single-origin Ethiopian beans
- 24-hour cold-brew steeping process
- Cozy minimalist interior, free wifi, plenty of outlets

**Contact Details**
*   **Address**: 312 Pine St, Seattle, WA 98101
*   **Phone**: (206) 555-0142
*   **Email**: hello@beancraft.coffee
*   **Website**: https://beancraft.coffee

**Opening Hours**
Monday: 6:00 AM - 10:00 PM
Tuesday-Friday: 6:00 AM - 10:00 PM
Saturday-Sunday: 7:00 AM - 11:00 PM

**Key Services**
- Pour-over coffee
- Cold brew on tap
- Espresso & milk drinks
- Single-origin pour-over flights

**Reviews/Testimonials**
"Best cold brew in Seattle, hands down." - Alex M.
"The Ethiopian pour-over is life-changing." - Jamie L.
"Cozy atmosphere, perfect for working." - Sam R.
`;

(async () => {
  console.log(`[test] Starting build ${id} for ${pages.length} pages...`);
  const startedAt = Date.now();

  const onProgress = (msg) => console.log(`[test] ${msg}`);

  try {
    const result = await buildSite(id, userContext, null, pages, onProgress, 'standard');
    const elapsed = ((Date.now() - startedAt) / 1000).toFixed(1);
    console.log(`\n[test] buildSite returned in ${elapsed}s`);
    console.log(`[test] distDir: ${result.distDir}`);

    const files = fs.readdirSync(result.distDir).filter(f => f.endsWith('.html'));
    console.log(`\n[test] Generated ${files.length} HTML files:`);
    for (const f of files) {
      const filepath = path.join(result.distDir, f);
      const content = fs.readFileSync(filepath, 'utf8');
      const hasClosingHtml = content.trim().endsWith('</html>');
      const hasHero = /data-section="hero"/.test(content) || /<header/i.test(content);
      const hasFooter = /data-section="footer"/.test(content) || /<footer/i.test(content);
      const sections = (content.match(/data-section="/g) || []).length;
      console.log(`  ${f}: ${content.length} chars, ${sections} sections, </html>=${hasClosingHtml}, header=${hasHero}, footer=${hasFooter}`);
    }
    console.log(`\n[test] Open files in browser:\n  open ${result.distDir}/index.html`);
  } catch (err) {
    console.error(`\n[test] BUILD FAILED:`, err.message);
    console.error(err.stack);
    process.exit(1);
  }
})();
