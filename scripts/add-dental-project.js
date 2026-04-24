require('dotenv').config({ override: true, path: require('path').join(__dirname, '..', '.env') });

const path = require('path');
const { db, admin } = require('../services/firebase');
const { uploadDirectory } = require('../services/storage');
const fs = require('fs-extra');

const PROJECT_ID = '1774970985000';
const USER_ID = 'PMVxScJKh0ZhhPvlGlNCBYdGcSu2';
const PHONE = '+919999999999';

async function main() {
    if (!db) {
        console.error('Firebase not initialized. Check .env FIREBASE_SERVICE_ACCOUNT.');
        process.exit(1);
    }

    const distPath = path.join(__dirname, '..', 'projects_source', PROJECT_ID, 'dist');

    if (!await fs.pathExists(distPath)) {
        console.error(`Dist path not found: ${distPath}`);
        process.exit(1);
    }

    console.log(`Registering project ${PROJECT_ID} for user ${USER_ID}...`);

    // 1. Create Firestore document
    const projectData = {
        projectId: PROJECT_ID,
        userId: USER_ID,
        query: 'Smile Dental Care Trichy',
        status: 'completed',
        subdomain: `site-${PROJECT_ID}`,
        logs: [
            { message: 'Project created manually', timestamp: new Date().toISOString() },
            { message: 'All pages generated', timestamp: new Date().toISOString() },
            { message: 'Process Finished Successfully.', timestamp: new Date().toISOString() }
        ],
        buildProgress: 100,
        buildProgressMessage: 'Process Finished Successfully',
        createdAt: admin.firestore.FieldValue.serverTimestamp(),
        completedAt: admin.firestore.FieldValue.serverTimestamp(),
        updatedAt: admin.firestore.FieldValue.serverTimestamp(),
        isPublished: false,
        stylePreset: 'soft',
        userContext: 'Smile Dental Care - Advanced Multi Speciality Dental Clinic in Trichy. ISO 9001:2015 Certified. Est. 2016. Dr. Ranjit Chandar BDS, FILD Malaysia. Laser Dentistry, Root Canal, Implants, Orthodontics, Cosmetic Dentistry. Two branches: Kattur and Srirangam.',
        pages: [
            'Home', 'About', 'Contact', 'Gallery',
            'RCT & Dental Crowns', 'Implants & Aligners', 'RCT & Pain',
            'Mission & Team', 'Sterilization', 'Unique Features',
            'Radiation Safety', 'Secrets & Protocols', 'SDC Dental Supply',
            'Dental Insurance', 'Statistical Data', 'Performance Report',
            'Re-Treatment Policy', 'Refund Policy', 'Privacy Policy', 'Terms & Disclaimer'
        ],
        url: `http://localhost:3000/sites/${PROJECT_ID}/index.html`,
        localUrl: `http://localhost:3000/sites/${PROJECT_ID}/index.html`
    };

    await db.collection('projects').doc(PROJECT_ID).set(projectData);
    console.log('Firestore document created.');

    // 2. Upload dist to GCS
    try {
        console.log('Uploading to GCS...');
        await uploadDirectory(distPath, `projects/${PROJECT_ID}/dist`);
        console.log('GCS upload complete.');
    } catch (err) {
        console.warn('GCS upload failed (may not be configured locally):', err.message);
    }

    // 3. Update with preview URL
    try {
        await db.collection('projects').doc(PROJECT_ID).update({
            updatedAt: admin.firestore.FieldValue.serverTimestamp()
        });
    } catch (e) {
        console.warn('Failed to update timestamp:', e.message);
    }

    console.log(`\nProject registered successfully!`);
    console.log(`Project ID: ${PROJECT_ID}`);
    console.log(`User ID: ${USER_ID}`);
    console.log(`Pages: 20`);
    console.log(`Preview: http://localhost:3000/sites/${PROJECT_ID}/index.html`);

    process.exit(0);
}

main().catch(err => {
    console.error('Fatal error:', err);
    process.exit(1);
});
