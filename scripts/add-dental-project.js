#!/usr/bin/env node
/**
 * Seed a sample project (Smile Dental Care) into D1 and R2.
 * Usage: node scripts/add-dental-project.js
 */
require('dotenv').config({ override: true, path: require('path').join(__dirname, '..', '.env') });

const path = require('path');
const fs = require('fs-extra');
const db = require('../services/db');
const { uploadDirectory } = require('../services/storage');

const PROJECT_ID = '1774970985000';
const USER_ID = process.env.SEED_USER_ID || 'PMVxScJKh0ZhhPvlGlNCBYdGcSu2';

const PAGES = [
  'Home', 'About', 'Contact', 'Gallery',
  'RCT & Dental Crowns', 'Implants & Aligners', 'RCT & Pain',
  'Mission & Team', 'Sterilization', 'Unique Features',
  'Radiation Safety', 'Secrets & Protocols', 'SDC Dental Supply',
  'Dental Insurance', 'Statistical Data', 'Performance Report',
  'Re-Treatment Policy', 'Refund Policy', 'Privacy Policy', 'Terms & Disclaimer'
];

async function main() {
  const distPath = path.join(__dirname, '..', 'projects_source', PROJECT_ID, 'dist');
  if (!await fs.pathExists(distPath)) {
    console.error(`Dist path not found: ${distPath}`);
    process.exit(1);
  }
  console.log(`Registering project ${PROJECT_ID} for user ${USER_ID}...`);

  await db.exec(
    `INSERT INTO projects (id, user_id, query, status, subdomain, logs, build_progress, build_progress_message,
                            is_published, style_preset, user_context, pages, url, completed_at, updated_at)
     VALUES (?, ?, ?, 'completed', ?, ?, 100, 'Process Finished Successfully', 0, 'soft', ?, ?, ?, datetime('now'), datetime('now'))
     ON CONFLICT(id) DO UPDATE SET updated_at = datetime('now')`,
    [
      PROJECT_ID,
      USER_ID,
      'Smile Dental Care Trichy',
      `site-${PROJECT_ID}`,
      db.J([
        { message: 'Project created manually', timestamp: new Date().toISOString() },
        { message: 'All pages generated', timestamp: new Date().toISOString() },
        { message: 'Process Finished Successfully.', timestamp: new Date().toISOString() }
      ]),
      db.J('Smile Dental Care - Advanced Multi Speciality Dental Clinic in Trichy.'),
      db.J(PAGES),
      `http://localhost:3000/sites/${PROJECT_ID}/index.html`,
    ]
  );
  console.log('D1 row created.');

  try {
    console.log('Uploading dist to R2...');
    await uploadDirectory(distPath, `projects/${PROJECT_ID}/dist`);
    console.log('R2 upload complete.');
  } catch (err) {
    console.warn('R2 upload failed (may not be configured):', err.message);
  }

  console.log(`\nProject registered successfully!\nProject ID: ${PROJECT_ID}\nPreview: http://localhost:3000/sites/${PROJECT_ID}/index.html`);
}

main().catch((err) => { console.error('Fatal error:', err); process.exit(1); });
