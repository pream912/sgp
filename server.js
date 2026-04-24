require('dotenv').config({ override: true });
console.log("Starting Server...");
const express = require('express');
const fs = require('fs-extra');
const path = require('path');
const multer = require('multer');
const nodemailer = require('nodemailer');
const cron = require('node-cron');
const { buildSite, rebuildSite } = require('./services/builder');
const { deploySite, makeBucketPrivate, makeBucketPublic, deleteSiteBucket } = require('./services/deploy');
const { uploadDirectory, downloadDirectory, uploadPreview } = require('./services/storage');
const { createOrder, verifyPayment } = require('./services/payments');
const { extractFromUrl } = require('./services/business-extractor');
const { checkAvailability, purchaseDomain, getSuggestions, setupGCPDomain, verifyDomainDNS, checkSubdomainAvailability, cleanupGCPDomain, listDNSRecords, addDNSRecordGeneric, deleteDNSRecord } = require('./services/domains');
const { generateCode, fixCode, regenerateSection, updateSectionContent, regeneratePage } = require('./services/ai-coder');
const { generateDesign, generatePalette } = require('./services/ai-architect');
const { captureScreenshot } = require('./services/screenshot');
const { getUserCredits, addCredits, deductCredits, getTransactions } = require('./services/credits');
const { db, admin, auth } = require('./services/firebase');
const verifyToken = require('./middleware/auth');
const verifyAdmin = require('./middleware/adminAuth');

const cookieParser = require('cookie-parser'); // Import cookie-parser
const cors = require('cors'); // Import cors

const app = express();
app.use(cors({ origin: true, credentials: true })); // Enable CORS for all origins with credentials
app.use(express.json());
app.use(cookieParser()); // Use cookie-parser

// --- Token Usage Tracking ---
async function saveTokenUsage(entries, projectId, userId) {
    if (!db || !entries || entries.length === 0) return;
    try {
        const batch = db.batch();
        for (const entry of entries) {
            const ref = db.collection('tokenUsage').doc();
            batch.set(ref, {
                projectId: projectId || null,
                userId: userId || null,
                model: entry.model || 'gemini',
                service: entry.service || 'unknown',
                action: entry.action || null,
                inputTokens: entry.promptTokenCount || 0,
                outputTokens: entry.candidatesTokenCount || 0,
                totalTokens: entry.totalTokenCount || 0,
                createdAt: admin.firestore.FieldValue.serverTimestamp()
            });
        }
        await batch.commit();
        console.log(`[TokenUsage] Saved ${entries.length} usage entries for project ${projectId}`);
    } catch (err) {
        console.error('[TokenUsage] Failed to save:', err.message);
    }
}

// --- Retry with Exponential Backoff (for 429 / RESOURCE_EXHAUSTED) ---
async function retryWithBackoff(fn, maxRetries = 3) {
    for (let attempt = 1; attempt <= maxRetries; attempt++) {
        try {
            return await fn();
        } catch (err) {
            const msg = err.message || '';
            const is429 = msg.includes('429') || msg.includes('RESOURCE_EXHAUSTED');
            if (!is429 || attempt === maxRetries) {
                if (is429) {
                    const highDemandError = new Error('Our AI services are currently experiencing high demand. Please try again in a few minutes.');
                    highDemandError.statusCode = 503;
                    throw highDemandError;
                }
                throw err;
            }
            const delay = 10000 * Math.pow(2, attempt - 1) + Math.random() * 2000;
            console.warn(`[Retry] 429 hit, attempt ${attempt}/${maxRetries}. Retrying in ${Math.round(delay / 1000)}s...`);
            await new Promise(resolve => setTimeout(resolve, delay));
        }
    }
}

// --- Analytics Buffer ---
const analyticsBuffer = new Map(); // projectId -> { pageviews, bandwidth }
const projectOwnerCache = new Map(); // projectId -> userId

function trackPageview(projectId, contentLength, userId) {
    const entry = analyticsBuffer.get(projectId) || { pageviews: 0, bandwidth: 0 };
    entry.pageviews += 1;
    entry.bandwidth += (contentLength || 0);
    analyticsBuffer.set(projectId, entry);
    if (userId) projectOwnerCache.set(projectId, userId);
}

async function flushAnalytics() {
    if (!db || analyticsBuffer.size === 0) return;
    const today = new Date().toISOString().slice(0, 10);
    const entries = Array.from(analyticsBuffer.entries());
    analyticsBuffer.clear();

    // Group by userId for userStats aggregation
    const userAgg = new Map(); // userId -> { pageviews, bandwidth }

    for (const [projectId, data] of entries) {
        try {
            // Per-project analytics (kept for per-site breakdown)
            const analyticsRef = db.collection('analytics').doc(projectId);
            const dailyRef = analyticsRef.collection('daily').doc(today);
            const batch = db.batch();
            batch.set(analyticsRef, {
                totalPageviews: admin.firestore.FieldValue.increment(data.pageviews),
                totalBandwidth: admin.firestore.FieldValue.increment(data.bandwidth),
                lastUpdated: admin.firestore.FieldValue.serverTimestamp()
            }, { merge: true });
            batch.set(dailyRef, {
                pageviews: admin.firestore.FieldValue.increment(data.pageviews),
                bandwidth: admin.firestore.FieldValue.increment(data.bandwidth),
                date: today
            }, { merge: true });
            await batch.commit();

            // Accumulate per-user totals
            let userId = projectOwnerCache.get(projectId);
            if (!userId) {
                const snap = await db.collection('projects').where('projectId', '==', projectId).limit(1).get();
                if (!snap.empty) {
                    userId = snap.docs[0].data().userId;
                    projectOwnerCache.set(projectId, userId);
                }
            }
            if (userId) {
                const u = userAgg.get(userId) || { pageviews: 0, bandwidth: 0 };
                u.pageviews += data.pageviews;
                u.bandwidth += data.bandwidth;
                userAgg.set(userId, u);
            }
        } catch (err) {
            console.error(`[Analytics] Flush failed for ${projectId}:`, err.message);
        }
    }

    // Flush user-level aggregates
    for (const [userId, data] of userAgg) {
        try {
            const batch = db.batch();
            const userStatsRef = db.collection('userStats').doc(userId);
            const userDailyRef = userStatsRef.collection('daily').doc(today);
            batch.set(userStatsRef, {
                totalPageviews: admin.firestore.FieldValue.increment(data.pageviews),
                totalBandwidth: admin.firestore.FieldValue.increment(data.bandwidth),
                lastUpdated: admin.firestore.FieldValue.serverTimestamp()
            }, { merge: true });
            batch.set(userDailyRef, {
                pageviews: admin.firestore.FieldValue.increment(data.pageviews),
                bandwidth: admin.firestore.FieldValue.increment(data.bandwidth),
                date: today
            }, { merge: true });
            await batch.commit();
        } catch (err) {
            console.error(`[Analytics] User stats flush failed for ${userId}:`, err.message);
        }
    }

    console.log(`[Analytics] Flushed ${entries.length} project(s), ${userAgg.size} user(s) to Firestore`);
}

setInterval(flushAnalytics, 60000);
process.on('SIGTERM', async () => { await flushAnalytics(); process.exit(0); });
process.on('SIGINT', async () => { await flushAnalytics(); process.exit(0); });

// --- Wildcard Subdomain & Custom Domain Routing ---
app.use(async (req, res, next) => {
    const host = req.headers.host;
    const DOMAIN_SUFFIX = '.genweb.in';
    
    // Exclude reserved subdomains/hosts
    const RESERVED_HOSTS = [`www${DOMAIN_SUFFIX}`, `api${DOMAIN_SUFFIX}`, `app${DOMAIN_SUFFIX}`, `localhost:${PORT}`];

    // Bypass routing for API, Sites, Reserved Hosts, and Cloud Run default domains
    if (!host || RESERVED_HOSTS.includes(host) || host.includes('run.app') || req.path.startsWith('/api/') || req.path.startsWith('/sites/')) {
        return next();
    }

    try {
        let projectId = null;

        let projectUserId = null;

        // 1. Check if it's a *.genweb.in subdomain
        if (host.endsWith(DOMAIN_SUFFIX)) {
            const subdomain = host.slice(0, -DOMAIN_SUFFIX.length);
            console.log(`[Router] Checking subdomain: ${subdomain}`);

            if (db) {
                const snapshot = await db.collection('projects').where('subdomain', '==', subdomain).limit(1).get();
                if (!snapshot.empty) {
                    const pData = snapshot.docs[0].data();
                    projectId = pData.projectId;
                    projectUserId = pData.userId;
                }
            }
        }
        // 2. Check if it's a Custom Domain
        else {
            console.log(`[Router] Checking custom domain: ${host}`);
            if (db) {
                const snapshot = await db.collection('projects').where('customDomain', '==', host).limit(1).get();
                if (!snapshot.empty) {
                    const pData = snapshot.docs[0].data();
                    projectId = pData.projectId;
                    projectUserId = pData.userId;
                }
            }
        }

        // 3. Proxy if Project Found
        if (projectId) {
            console.log(`[Router] Proxying for Project ID: ${projectId}`);
            
            const bucketName = `site-${projectId}`;
            const filePath = req.url === '/' ? '/index.html' : req.url;
            const gcsUrl = `https://storage.googleapis.com/${bucketName}${filePath}`;
            
            const https = require('https');
            
            return https.get(gcsUrl, (proxyRes) => {
                if (proxyRes.statusCode === 404 && req.url !== '/') {
                     res.status(404).send('Not Found');
                     return;
                }

                // Track pageviews for HTML pages
                const contentType = proxyRes.headers['content-type'] || '';
                if (proxyRes.statusCode === 200 && contentType.includes('text/html')) {
                    const cl = parseInt(proxyRes.headers['content-length'] || '0', 10);
                    trackPageview(projectId, cl, projectUserId);
                }

                res.status(proxyRes.statusCode);
                Object.keys(proxyRes.headers).forEach(key => {
                     res.setHeader(key, proxyRes.headers[key]);
                });

                proxyRes.pipe(res);
            }).on('error', (e) => {
                console.error('Proxy Stream Error:', e);
                res.status(502).send('Upstream Error');
            });
        }
        
        // If it was a *.genweb.in request but no project found -> 404
        if (host.endsWith(DOMAIN_SUFFIX)) {
            return res.status(404).send('Site not found');
        }

        // For custom domains not found, we might want to let it fall through 
        // (maybe it's a misconfigured DNS hitting our IP) or 404.
        // If we are the default backend, we should probably 404 if not found in DB.
        // But for safety, let's next() if it's just some random hit, 
        // unless we want to be strict.
        // Being strict is better for a "Catch All" backend.
        if (!projectId && host.includes('.')) { 
             // It looks like a domain request but we don't know it.
             return res.status(404).send('Site not found on GenWeb.');
        }

    } catch (error) {
        console.error('Routing error:', error);
        return res.status(500).send('Internal Server Error');
    }
    
    next();
});

// Configure Multer for file uploads
const upload = multer({ dest: path.join(__dirname, 'temp/uploads') });

// Helper: Ensure Project Source Exists (Download from GCS if missing)
async function ensureProjectSource(id) {
    const projectDir = path.join(__dirname, 'projects_source', id);
    if (await fs.pathExists(projectDir)) {
        return true;
    }
    
    console.log(`[${id}] Project source missing locally. Attempting to download from GCS...`);
    try {
        await fs.ensureDir(projectDir);
        // Download from GCS: prefix 'projects/{id}' -> local 'projects_source/{id}'
        // Our storage structure is projects/{id}/...
        const success = await downloadDirectory(`projects/${id}`, projectDir);
        if (success) {
            console.log(`[${id}] Project source restored.`);

            // Ensure the site is available in public/sites for the editor preview
            try {
                const distPath = path.join(projectDir, 'dist');
                const publicSitePath = path.join(__dirname, 'public/sites', id);
                if (await fs.pathExists(distPath)) {
                    await fs.copy(distPath, publicSitePath);
                    console.log(`[${id}] Restored site copied to public/sites for preview.`);
                }
            } catch (copyErr) {
                 console.warn(`[${id}] Failed to copy to public/sites:`, copyErr.message);
            }

            return true;
        } else {
            console.warn(`[${id}] Project source not found in GCS.`);
            // Cleanup empty dir
            await fs.remove(projectDir); 
            return false;
        }
    } catch (error) {
        console.error(`[${id}] Failed to restore project source:`, error);
        return false;
    }
}

// Protect Static Sites
app.use('/sites/:projectId', async (req, res, next) => {
    const { projectId } = req.params;
    
    // Ensure project source and public site files exist (Hydrate from Private Bucket if needed)
    try {
        await ensureProjectSource(projectId);
        
        // Double check: Ensure public/sites/${projectId} exists (Sync from projects_source if needed)
        // ensureProjectSource only copies if it downloads. If source exists but public doesn't, we need to copy.
        const publicSitePath = path.join(__dirname, 'public/sites', projectId);
        const sourceDistPath = path.join(__dirname, 'projects_source', projectId, 'dist');
        
        if (!await fs.pathExists(publicSitePath) && await fs.pathExists(sourceDistPath)) {
            console.log(`[${projectId}] Syncing dist to public/sites for preview...`);
            await fs.copy(sourceDistPath, publicSitePath);
        }
    } catch (err) {
        console.error(`[${projectId}] Failed to ensure site files:`, err);
        // Continue anyway? Or fail? If files are missing, static middleware will 404.
    }
    
    // Allow if verifying ownership via token or if published
    try {
        if (!db) return next(); // Fallback if no DB

        const projectRef = db.collection('projects').where('projectId', '==', projectId);
        const snapshot = await projectRef.get();
        
        if (snapshot.empty) {
            // If project doesn't exist in DB but exists on disk? 
            // Maybe it's a temp one or deleted. Block to be safe.
            return res.status(404).send('Site not found');
        }

        const projectData = snapshot.docs[0].data();

        // 1. Public Access (Published)
        if (projectData.isPublished) {
            return next();
        }

        // 2. Owner Access (via Cookie or Header)
        let token = req.cookies?.access_token || req.headers.authorization?.split(' ')[1];
        
        // Check query param for initial iframe load if cookie fails/cross-site issues (fallback)
        if (!token && req.query.token) {
            token = req.query.token;
        }

        if (token) {
            try {
                const decoded = await admin.auth().verifyIdToken(token);
                if (decoded.uid === projectData.userId) {
                    return next();
                }
            } catch (e) {
                // Token invalid
            }
        }

        return res.status(403).send('Access Denied. This site is not published yet. <a href="/">Go Back</a>');

    } catch (error) {
        console.error('Site protection error:', error);
        return res.status(500).send('Server Error');
    }
});

// Serve generated sites statically (fallback, main hosting is GCS)
app.use('/sites', express.static(path.join(__dirname, 'public/sites')));

const PORT = process.env.PORT || 3000;

// Email Transporter (Configure with your SMTP settings)
const transporter = nodemailer.createTransport({
    host: process.env.BREVO_SMTP_HOST || 'smtp-relay.brevo.com',
    port: parseInt(process.env.BREVO_SMTP_PORT || '587'),
    secure: false,
    auth: {
        user: process.env.BREVO_SMTP_USER,
        pass: process.env.BREVO_SMTP_KEY
    }
});
const SMTP_FROM = process.env.BREVO_SMTP_FROM || 'noreply@genweb.in';

// Helper: Save Artifacts (GCS Only - No Cloudflare Deploy)
async function saveBuildArtifacts(id, distPath, userId) {
    try {
        console.log(`[${id}] Saving build artifacts to GCS...`);
        
        // 1. Upload DIST to GCS (projects/{id}/dist)
        await uploadDirectory(distPath, `projects/${id}/dist`);

        // 2. Update Local Preview (public/sites) & Generate Screenshot
        const localSitePath = path.join(__dirname, 'public/sites', id);
        await fs.copy(distPath, localSitePath);

        // 3. Generate screenshot, upload to GCS, and store URL in Firebase
        let previewUrl = null;
        try {
            console.log(`[${id}] Auto-generating preview screenshot...`);
            const previewPath = path.join(localSitePath, 'preview.jpg');
            await captureScreenshot(path.join(localSitePath, 'index.html'), previewPath);
            previewUrl = await uploadPreview(previewPath, id);
        } catch (e) {
            console.warn(`[${id}] Preview generation/upload failed:`, e.message);
        }

        const localUrl = `http://localhost:${PORT}/sites/${id}/index.html`;

        // Update DB with timestamp and preview URL
        if (db) {
            const updateData = {
                updatedAt: admin.firestore.FieldValue.serverTimestamp()
            };
            if (previewUrl) {
                updateData.previewUrl = previewUrl;
            }

            const snapshot = await db.collection('projects').where('projectId', '==', id).get();
            if (!snapshot.empty) {
                await snapshot.docs[0].ref.update(updateData);
            }
        }

        return localUrl;
    } catch (error) {
        console.error(`[${id}] Save artifacts failed:`, error);
        throw error; 
    }
}

// Dashboard Stats (optimized: reads from pre-aggregated userStats)
app.get('/api/dashboard/stats', verifyToken, async (req, res) => {
    try {
        const userId = req.user.uid;

        // Build date keys for last 7 days
        const now = new Date();
        const dateKeys = [];
        for (let i = 6; i >= 0; i--) {
            const d = new Date(now);
            d.setDate(d.getDate() - i);
            dateKeys.push(d.toISOString().slice(0, 10));
        }

        // Run all reads in parallel: projects, leads count, userStats, 7 daily docs
        const projectsPromise = db.collection('projects').where('userId', '==', userId).get();
        const userStatsPromise = db.collection('userStats').doc(userId).get();
        const dailyPromises = dateKeys.map(date =>
            db.collection('userStats').doc(userId).collection('daily').doc(date).get()
        );

        const [projectsSnap, userStatsDoc, ...dailyDocs] = await Promise.all([
            projectsPromise, userStatsPromise, ...dailyPromises
        ]);

        const totalSites = projectsSnap.size;
        const publishedSites = projectsSnap.docs.filter(d => d.data().isPublished).length;

        // Count leads (single query, not per-project)
        const projectIds = projectsSnap.docs.map(d => d.data().projectId);
        let totalLeads = 0;
        if (projectIds.length > 0) {
            const chunks = [];
            for (let i = 0; i < projectIds.length; i += 30) {
                chunks.push(projectIds.slice(i, i + 30));
            }
            const leadsResults = await Promise.all(
                chunks.map(chunk => db.collection('leads').where('projectId', 'in', chunk).get())
            );
            totalLeads = leadsResults.reduce((sum, snap) => sum + snap.size, 0);
        }

        const statsData = userStatsDoc.exists ? userStatsDoc.data() : {};
        const totalPageviews = statsData.totalPageviews || 0;
        const totalBandwidth = statsData.totalBandwidth || 0;

        const recentPageviews = dateKeys.map((date, i) => ({
            date,
            pageviews: dailyDocs[i].exists ? (dailyDocs[i].data().pageviews || 0) : 0
        }));

        res.json({ totalSites, publishedSites, totalLeads, totalPageviews, totalBandwidth, recentPageviews });
    } catch (error) {
        console.error('Dashboard stats error:', error);
        res.status(500).json({ error: 'Failed to fetch dashboard stats' });
    }
});

// Extract Business Info (Pre-build step)
app.post('/api/extract-info', verifyToken, async (req, res) => {
    const { query } = req.body;
    if (!query) return res.status(400).json({ error: 'Query is required' });

    try {
        console.log(`Extracting info for query: "${query}"...`);
        const extractResult = await retryWithBackoff(() => extractFromUrl(query));
        const userContext = extractResult.data;
        if (extractResult.usageLog) await saveTokenUsage(extractResult.usageLog.map(u => ({ ...u, service: 'extractor' })), null, req.user.uid);
        res.json({ userContext });
    } catch (error) {
        console.error('Extraction failed:', error);
        const status = error.statusCode || 500;
        res.status(status).json({ error: error.message });
    }
});

// Submit Lead (Public Endpoint for Generated Sites)
app.post('/api/submit-lead', async (req, res) => {
    const { projectId, formData } = req.body;
    
    try {
        if (!projectId || !formData) {
            return res.status(400).json({ error: 'Missing projectId or formData' });
        }

        // 1. Get Project Owner
        let userId = null;
        let userEmail = null;
        
        if (db) {
            const projectsRef = db.collection('projects');
            const snapshot = await projectsRef.where('projectId', '==', projectId).get();
            
            if (snapshot.empty) {
                return res.status(404).json({ error: 'Project not found' });
            }
            
            const projectData = snapshot.docs[0].data();
            userId = projectData.userId;
            
            // Get User Email from Auth
            try {
                const userRecord = await admin.auth().getUser(userId);
                userEmail = userRecord.email;
            } catch (err) {
                console.error('Error fetching user for email:', err);
            }
            
            // 2. Save Lead to Firestore
            await db.collection('leads').add({
                projectId,
                userId,
                formData,
                createdAt: admin.firestore.FieldValue.serverTimestamp(),
                status: 'new'
            });
        }

        // 3. Send Email Notification (only if email is verified)
        let emailVerified = false;
        if (userId) {
            try {
                const ownerDoc = await db.collection('users').doc(userId).get();
                emailVerified = ownerDoc.exists && ownerDoc.data().emailVerified === true;
            } catch { /* ignore */ }
        }
        if (userEmail && process.env.BREVO_SMTP_USER && emailVerified) {
            const mailOptions = {
                from: `"GenWeb" <${SMTP_FROM}>`,
                to: userEmail,
                subject: `New Lead for Project ${projectId}`,
                text: `You have a new submission on your website!\n\nDetails:\n${JSON.stringify(formData, null, 2)}`,
                html: `<h3>New Lead Received</h3><p>You have a new submission on your website.</p><pre>${JSON.stringify(formData, null, 2)}</pre>`
            };
            
            transporter.sendMail(mailOptions, (error, info) => {
                if (error) {
                    console.log('Error sending email:', error);
                } else {
                    console.log('Email sent:', info.response);
                }
            });
        } else {
            console.log(`[Mock Email] To: ${userEmail}, Body:`, formData);
        }

        res.json({ success: true });

    } catch (error) {
        console.error('Submit lead failed:', error);
        res.status(500).json({ error: error.message });
    }
});

// Get All Leads for User
app.get('/api/leads', verifyToken, async (req, res) => {
    try {
        if (!db) {
            return res.json([]);
        }

        let snapshot;
        try {
            snapshot = await db.collection('leads')
                .where('userId', '==', req.user.uid)
                .orderBy('createdAt', 'desc')
                .get();
        } catch (queryError) {
            console.warn('Sorted query failed (api/leads), falling back to unsorted:', queryError.message);
            // Fallback to unsorted if index is missing
            snapshot = await db.collection('leads')
                .where('userId', '==', req.user.uid)
                .get();
        }
            
        const leads = snapshot.docs.map(doc => ({
            id: doc.id,
            ...doc.data(),
            createdAt: doc.data().createdAt ? doc.data().createdAt.toDate() : null
        }));
        
        res.json(leads);
        
    } catch (error) {
        console.error('Fetch all leads failed:', error);
        res.status(500).json({ error: error.message });
    }
});

// Get Leads for a Project
app.get('/api/project/:id/leads', verifyToken, async (req, res) => {
    const { id } = req.params;
    
    try {
        if (!db) {
            return res.json([]);
        }

        // Verify ownership
        const projectRef = db.collection('projects').where('projectId', '==', id).where('userId', '==', req.user.uid);
        const projectSnap = await projectRef.get();
        
        if (projectSnap.empty) {
            return res.status(403).json({ error: 'Unauthorized' });
        }

        let snapshot;
        try {
            snapshot = await db.collection('leads')
                .where('projectId', '==', id)
                .orderBy('createdAt', 'desc')
                .get();
        } catch (queryError) {
            console.warn('Sorted query failed, falling back to unsorted:', queryError.message);
            // Fallback to unsorted if index is missing
            snapshot = await db.collection('leads')
                .where('projectId', '==', id)
                .get();
        }
            
        const leads = snapshot.docs.map(doc => ({
            id: doc.id,
            ...doc.data(),
            createdAt: doc.data().createdAt ? doc.data().createdAt.toDate() : null
        }));
        
        res.json(leads);
        
    } catch (error) {
        console.error('Fetch leads failed:', error);
        await fs.appendFile('backend-error.log', `${new Date().toISOString()} - Fetch leads error: ${error.message}\n${error.stack}\n`);
        res.status(500).json({ error: error.message });
    }
});

// Get User's Projects
app.get('/api/projects', verifyToken, async (req, res) => {
    try {
        if (!db) {
            return res.json([]); // Return empty if DB not configured
        }
        const snapshot = await db.collection('projects')
            .where('userId', '==', req.user.uid)
            .orderBy('createdAt', 'desc')
            .get();
        
        const projects = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        res.json(projects);
    } catch (error) {
        console.error('Error fetching projects:', error);
        res.status(500).json({ error: 'Failed to fetch projects' });
    }
});

// Get Pages List
app.get('/api/project/:id/pages', verifyToken, async (req, res) => {
    const { id } = req.params;
    try {
        if (!await ensureProjectSource(id)) return res.status(404).json({ error: 'Project source not found' });
        
        const distPath = path.join(__dirname, 'projects_source', id, 'dist');
        if (!await fs.pathExists(distPath)) {
            return res.status(404).json({ error: 'Dist folder not found' });
        }
        
        const files = await fs.readdir(distPath);
        const htmlFiles = files.filter(f => f.endsWith('.html'));
        
        // Ensure index.html is first
        const sorted = htmlFiles.sort((a, b) => {
            if (a === 'index.html') return -1;
            if (b === 'index.html') return 1;
            return a.localeCompare(b);
        });
        
        res.json({ pages: sorted });
        
    } catch (error) {
        console.error('Fetch pages list failed:', error);
        res.status(500).json({ error: error.message });
    }
});

// --- Site Config (Dynamic Navigation) ---

// GET site-config.json (auto-generates from HTML if missing)
app.get('/api/project/:id/site-config', verifyToken, async (req, res) => {
    const { id } = req.params;
    try {
        if (!await ensureProjectSource(id)) return res.status(404).json({ error: 'Project source not found' });

        const distDir = path.join(__dirname, 'projects_source', id, 'dist');
        const configPath = path.join(distDir, 'site-config.json');

        if (await fs.pathExists(configPath)) {
            const config = await fs.readJson(configPath);
            return res.json(config);
        }

        // Auto-generate from existing HTML files (backward compat)
        const files = await fs.readdir(distDir);
        const htmlFiles = files.filter(f => f.endsWith('.html')).sort((a, b) => {
            if (a === 'index.html') return -1;
            if (b === 'index.html') return 1;
            return a.localeCompare(b);
        });

        const navigation = htmlFiles.map(f => ({
            name: f === 'index.html' ? 'Home' : f.replace('.html', '').replace(/-/g, ' ').replace(/\b\w/g, l => l.toUpperCase()),
            path: f,
            children: []
        }));

        const hasLogo = await fs.pathExists(path.join(distDir, 'logo.png'));
        const config = {
            businessName: 'Business',
            logo: hasLogo ? './logo.png' : null,
            navigation
        };

        // Try to extract business name from index.html title
        try {
            const indexHtml = await fs.readFile(path.join(distDir, 'index.html'), 'utf-8');
            const titleMatch = indexHtml.match(/<title>(.*?)<\/title>/);
            if (titleMatch) config.businessName = titleMatch[1].split(' - ')[0].trim();
        } catch (e) { /* ignore */ }

        // Save for future use
        await fs.writeFile(configPath, JSON.stringify(config, null, 2));

        // Also copy site-nav.js if missing
        const navJsPath = path.join(distDir, 'site-nav.js');
        if (!await fs.pathExists(navJsPath)) {
            const templateNavJs = path.join(__dirname, 'templates/html-skeleton/site-nav.js');
            if (await fs.pathExists(templateNavJs)) {
                await fs.copy(templateNavJs, navJsPath);
            }
        }

        res.json(config);
    } catch (error) {
        console.error('Get site-config failed:', error);
        res.status(500).json({ error: error.message });
    }
});

// PUT site-config.json (update nav structure/logo/business name)
app.put('/api/project/:id/site-config', verifyToken, async (req, res) => {
    const { id } = req.params;
    try {
        if (!await ensureProjectSource(id)) return res.status(404).json({ error: 'Project source not found' });

        const distDir = path.join(__dirname, 'projects_source', id, 'dist');
        const configPath = path.join(distDir, 'site-config.json');

        const newConfig = req.body;
        await fs.writeFile(configPath, JSON.stringify(newConfig, null, 2));

        // Sync to public/sites
        const publicConfigPath = path.join(__dirname, 'public/sites', id, 'site-config.json');
        await fs.copy(configPath, publicConfigPath);

        // Upload to GCS
        await uploadDirectory(distDir, `projects/${id}/dist`);

        res.json({ success: true, config: newConfig });
    } catch (error) {
        console.error('Update site-config failed:', error);
        res.status(500).json({ error: error.message });
    }
});

// POST add new page (AI-generated, matching site style)
app.post('/api/project/:id/pages/add', verifyToken, async (req, res) => {
    const { id } = req.params;
    const { pageName, isSubPage, pagePrompt } = req.body;

    if (!pageName) return res.status(400).json({ error: 'pageName is required' });

    try {
        if (!await ensureProjectSource(id)) return res.status(404).json({ error: 'Project source not found' });

        const sourceDir = path.join(__dirname, 'projects_source', id);
        const distDir = path.join(sourceDir, 'dist');
        const configPath = path.join(distDir, 'site-config.json');

        // Read existing config
        let config;
        if (await fs.pathExists(configPath)) {
            config = await fs.readJson(configPath);
        } else {
            const files = await fs.readdir(distDir);
            const htmlFiles = files.filter(f => f.endsWith('.html'));
            config = {
                businessName: 'Business',
                logo: (await fs.pathExists(path.join(distDir, 'logo.png'))) ? './logo.png' : null,
                navigation: htmlFiles.map(f => ({
                    name: f === 'index.html' ? 'Home' : f.replace('.html', '').replace(/-/g, ' ').replace(/\b\w/g, l => l.toUpperCase()),
                    path: f,
                    children: []
                }))
            };
        }

        // Enforce limits
        const mainPages = config.navigation.filter(n => n.name !== 'More');
        const moreItem = config.navigation.find(n => n.name === 'More');
        const subPages = moreItem?.children || [];

        if (isSubPage) {
            if (subPages.length >= 30) {
                return res.status(400).json({ error: 'Maximum of 30 sub-pages reached.' });
            }
        } else {
            if (mainPages.length >= 7) {
                return res.status(400).json({ error: 'Maximum of 7 main pages reached.' });
            }
        }

        // Credit deduction (100 credits for new page)
        try {
            await deductCredits(req.user.uid, 100, `Add page "${pageName}" to project ${id}`);
        } catch (err) {
            return res.status(402).json({ error: 'Insufficient credits. Need 100 credits to add a page.' });
        }

        // Build page filename
        const filename = `${pageName.toLowerCase().replace(/\s+/g, '-')}.html`;
        const newPagePath = path.join(distDir, filename);

        if (await fs.pathExists(newPagePath)) {
            return res.status(409).json({ error: `Page "${pageName}" already exists` });
        }

        // Extract layout reference from index.html
        let layoutReference = null;
        try {
            const homeCode = await fs.readFile(path.join(distDir, 'index.html'), 'utf-8');
            const headerMatch = homeCode.match(/<(\w+)[^>]*data-section="header"[^>]*>([\s\S]*?)<\/\1>/);
            const footerMatch = homeCode.match(/<(\w+)[^>]*data-section="footer"[^>]*>([\s\S]*?)<\/\1>/);
            if (headerMatch && footerMatch) {
                layoutReference = { header: headerMatch[0], footer: footerMatch[0] };
            }
        } catch (e) { console.warn(`[${id}] Could not extract layout reference for new page`); }

        // Get all page names for nav
        const allPageNames = config.navigation.filter(n => n.name !== 'More').map(n => n.name);
        subPages.forEach(s => allPageNames.push(s.name));
        allPageNames.push(pageName);

        // Get designSystem from tailwind config + stylePreset from Firestore
        let stylePreset = null;
        const twConfigPath = path.join(sourceDir, 'tailwind.config.js');
        let designSystem = null;
        if (await fs.pathExists(twConfigPath)) {
            delete require.cache[require.resolve(twConfigPath)];
            const twConfig = require(twConfigPath);
            const colors = twConfig?.theme?.extend?.colors || {};
            const fonts = twConfig?.theme?.extend?.fontFamily || {};
            designSystem = {
                colorPalette: colors,
                googleFonts: {
                    heading: fonts.heading ? fonts.heading[0] : 'sans-serif',
                    body: fonts.body ? fonts.body[0] : 'sans-serif'
                },
                businessName: config.businessName,
                logoUrl: config.logo,
                imageUrls: []
            };
        }

        // Read userContext and stylePreset from Firestore
        let userContext = `Business: ${config.businessName}`;
        try {
            const snapshot = await db.collection('projects').where('projectId', '==', id).get();
            if (!snapshot.empty) {
                const projectData = snapshot.docs[0].data();
                if (projectData.context) userContext = projectData.context;
                if (projectData.stylePreset) stylePreset = projectData.stylePreset;
            }
        } catch (e) { /* ignore */ }

        // Append page-specific prompt to user context if provided
        let pageContext = userContext;
        if (pagePrompt) {
            pageContext += `\n\nSPECIFIC INSTRUCTIONS FOR THIS PAGE ("${pageName}"): ${pagePrompt}`;
        }

        // Generate the new page
        console.log(`[${id}] Generating new page: ${pageName} (${isSubPage ? 'sub-page' : 'main'})...`);
        const codeResult = await retryWithBackoff(() =>
            generateCode(designSystem || {}, pageContext, pageName, allPageNames, layoutReference, stylePreset)
        );

        if (codeResult.usage) {
            await saveTokenUsage([{ ...codeResult.usage, service: 'coder', action: `addPage:${pageName}` }], id, req.user.uid);
        }

        // Write the new page
        await fs.writeFile(newPagePath, codeResult.code);

        // Update site-config.json
        const newNavEntry = { name: pageName, path: filename, children: [] };
        if (isSubPage) {
            // Add under "More" dropdown — create it if it doesn't exist
            let more = config.navigation.find(n => n.name === 'More');
            if (!more) {
                more = { name: 'More', path: '#', children: [] };
                config.navigation.push(more);
            }
            if (!more.children) more.children = [];
            more.children.push(newNavEntry);
        } else {
            config.navigation.push(newNavEntry);
        }
        await fs.writeFile(configPath, JSON.stringify(config, null, 2));

        // Rebuild (injects scripts, syncs)
        const distPath = await rebuildSite(id);
        const previewUrl = await saveBuildArtifacts(id, distPath, req.user.uid);

        res.json({ success: true, page: filename, config, url: previewUrl });
    } catch (error) {
        console.error('Add page failed:', error);
        const status = error.statusCode || 500;
        res.status(status).json({ error: error.message });
    }
});

// POST upload/change logo
app.post('/api/project/:id/logo', verifyToken, upload.single('logo'), async (req, res) => {
    const { id } = req.params;
    try {
        if (!req.file) return res.status(400).json({ error: 'No logo file uploaded' });
        if (!await ensureProjectSource(id)) return res.status(404).json({ error: 'Project source not found' });

        const distDir = path.join(__dirname, 'projects_source', id, 'dist');
        const logoDest = path.join(distDir, 'logo.png');

        // Copy uploaded file to dist
        await fs.copy(req.file.path, logoDest);
        await fs.remove(req.file.path).catch(() => {});

        // Update site-config.json
        const configPath = path.join(distDir, 'site-config.json');
        if (await fs.pathExists(configPath)) {
            const config = await fs.readJson(configPath);
            config.logo = './logo.png';
            await fs.writeFile(configPath, JSON.stringify(config, null, 2));
        }

        // Sync to public/sites and GCS
        const distPath = await rebuildSite(id);
        const previewUrl = await saveBuildArtifacts(id, distPath, req.user.uid);

        res.json({ success: true, logo: './logo.png', url: previewUrl });
    } catch (error) {
        console.error('Logo upload failed:', error);
        res.status(500).json({ error: error.message });
    }
});

// Trigger Manual Screenshot
app.post('/api/project/:id/screenshot', verifyToken, async (req, res) => {
    const { id } = req.params;
    try {
        if (!await ensureProjectSource(id)) return res.status(404).json({ error: 'Project source not found' });
        
        const publicSitePath = path.join(__dirname, 'public/sites', id);
        // Ensure public site exists
        if (!await fs.pathExists(publicSitePath)) {
             const distPath = path.join(__dirname, 'projects_source', id, 'dist');
             await fs.copy(distPath, publicSitePath);
        }
        
        const previewPath = path.join(publicSitePath, 'preview.jpg');
        const indexHtmlPath = path.join(publicSitePath, 'index.html');
        
        const success = await captureScreenshot(indexHtmlPath, previewPath);

        if (success) {
            const previewUrl = await uploadPreview(previewPath, id);
            // Update Firestore with new preview URL
            if (db) {
                const snapshot = await db.collection('projects').where('projectId', '==', id).get();
                if (!snapshot.empty) {
                    await snapshot.docs[0].ref.update({ previewUrl });
                }
            }
            res.json({ success: true, url: previewUrl });
        } else {
            res.status(500).json({ error: 'Screenshot generation failed' });
        }
    } catch (error) {
        console.error('Screenshot endpoint failed:', error);
        res.status(500).json({ error: error.message });
    }
});

// Get Current Theme
app.get('/api/project/:id/theme', verifyToken, async (req, res) => {
    const { id } = req.params;
    try {
        if (!await ensureProjectSource(id)) return res.status(404).json({ error: 'Project source not found' });

        const configPath = path.join(__dirname, 'projects_source', id, 'tailwind.config.js');
        if (!await fs.pathExists(configPath)) {
            return res.status(404).json({ error: 'Project configuration not found' });
        }
        const configContent = await fs.readFile(configPath, 'utf-8');
        
        // Extract colors using regex
        const colors = {};
        const keys = ['primary', 'secondary', 'accent', 'background', 'text', 'buttonBackground', 'buttonText'];
        
        keys.forEach(key => {
            const match = configContent.match(new RegExp(`["']?${key}["']?:\\s*["']([^"']+)["']`));
            if (match) {
                colors[key] = match[1];
            }
        });
        
        res.json({ colors });
    } catch (error) {
        console.error('Get theme failed:', error);
        res.status(500).json({ error: error.message });
    }
});

// Regenerate Theme Palette
app.post('/api/project/:id/theme/regenerate', verifyToken, async (req, res) => {
    const { id } = req.params;
    try {
        if (!await ensureProjectSource(id)) return res.status(404).json({ error: 'Project source not found' });

        // Fetch project context
        let context = "Modern Business";
        if (db) {
            const snapshot = await db.collection('projects').where('projectId', '==', id).get();
            if (!snapshot.empty) {
                context = snapshot.docs[0].data().query;
            }
        }
        
        const paletteResult = await retryWithBackoff(() => generatePalette(context));
        if (paletteResult.usage) await saveTokenUsage([{ ...paletteResult.usage, service: 'architect', action: 'generatePalette' }], id, req.user.uid);
        res.json({ colors: paletteResult.palette });

    } catch (error) {
        console.error('Regenerate theme failed:', error);
        const status = error.statusCode || 500;
        res.status(status).json({ error: error.message });
    }
});

// Update a Section (Generic AI Instruction)
app.post('/api/project/:id/section', verifyToken, async (req, res) => {
    const { id } = req.params;
    const { sectionId, instruction, page } = req.body;
    
    try {
        if (!await ensureProjectSource(id)) return res.status(404).json({ error: 'Project source not found' });

        // --- Credit Deduction ---
        try {
            await deductCredits(req.user.uid, 50, `Redesign section ${sectionId} for project ${id}`);
        } catch (err) {
            return res.status(402).json({ error: 'Insufficient credits for AI redesign.' });
        }
        // ------------------------

        const distDir = path.join(__dirname, 'projects_source', id, 'dist');
        let targetFile = 'index.html';

        if (page) {
            targetFile = page;
        } else {
             // Auto-discovery
             try {
                 const files = await fs.readdir(distDir);
                 const htmlFiles = files.filter(f => f.endsWith('.html'));
                 
                 for (const file of htmlFiles) {
                     const content = await fs.readFile(path.join(distDir, file), 'utf-8');
                     if (content.includes(`data-section="${sectionId}"`)) {
                         targetFile = file;
                         break;
                     }
                 }
             } catch (e) {
                 console.warn(`[AutoDiscovery] Failed to scan files: ${e.message}`);
             }
        }

        const sourcePath = path.join(distDir, targetFile);
        
        if (!await fs.pathExists(sourcePath)) {
            return res.status(404).json({ error: `Page ${targetFile} not found` });
        }
        
        const currentCode = await fs.readFile(sourcePath, 'utf-8');
        
        console.log(`Regenerating section '${sectionId}' in file '${targetFile}' for project ${id}...`);
        const sectionResult = await retryWithBackoff(() => regenerateSection(currentCode, sectionId, instruction));
        const newCode = sectionResult.code;
        if (sectionResult.usage) await saveTokenUsage([{ ...sectionResult.usage, service: 'coder', action: 'regenerateSection' }], id, req.user.uid);

        // Backup old code (simple undo)
        await fs.writeFile(sourcePath + '.bak', currentCode);

        // Write new code
        await fs.writeFile(sourcePath, newCode);
        
        // Rebuild & Deploy
        // Rebuild & Save (GCS only)
        const distPath = await rebuildSite(id);
        const previewUrl = await saveBuildArtifacts(id, distPath, req.user.uid);
        
        res.json({ success: true, url: previewUrl });
        
    } catch (error) {
        console.error('Update failed:', error);
        const status = error.statusCode || 500;
        res.status(status).json({ error: error.message });
    }
});

// Regenerate Entire Page (Global AI Instruction)
app.post('/api/project/:id/regenerate-page', verifyToken, async (req, res) => {
    const { id } = req.params;
    const { instruction, page } = req.body;
    
    try {
        if (!await ensureProjectSource(id)) return res.status(404).json({ error: 'Project source not found' });

        // --- Credit Deduction ---
        try {
            await deductCredits(req.user.uid, 100, `Regenerate page for project ${id}`);
        } catch (err) {
            return res.status(402).json({ error: 'Insufficient credits for AI regeneration.' });
        }
        // ------------------------

        const distDir = path.join(__dirname, 'projects_source', id, 'dist');
        const targetFile = page || 'index.html';
        const sourcePath = path.join(distDir, targetFile);
        
        if (!await fs.pathExists(sourcePath)) {
            return res.status(404).json({ error: `Page ${targetFile} not found` });
        }
        
        const currentCode = await fs.readFile(sourcePath, 'utf-8');
        
        console.log(`Regenerating page '${targetFile}' for project ${id}...`);
        const pageResult = await retryWithBackoff(() => regeneratePage(currentCode, instruction));
        const newCode = pageResult.code;
        if (pageResult.usage) await saveTokenUsage([{ ...pageResult.usage, service: 'coder', action: 'regeneratePage' }], id, req.user.uid);

        // Backup old code
        await fs.writeFile(sourcePath + '.bak', currentCode);
        
        // Write new code
        await fs.writeFile(sourcePath, newCode);
        
        // Rebuild & Save (GCS only)
        const distPath = await rebuildSite(id);
        const previewUrl = await saveBuildArtifacts(id, distPath, req.user.uid);
        
        res.json({ success: true, url: previewUrl });
        
    } catch (error) {
        console.error('Page regeneration failed:', error);
        const status = error.statusCode || 500;
        res.status(status).json({ error: error.message });
    }
});

// Update Specific Content (Text/Image)
app.post('/api/project/:id/content', verifyToken, async (req, res) => {
    const { id } = req.params;
    const { sectionId, type, originalValue, newValue, page } = req.body; // type: 'text' | 'image'
    
    try {
        if (!await ensureProjectSource(id)) return res.status(404).json({ error: 'Project source not found' });

        const distDir = path.join(__dirname, 'projects_source', id, 'dist');
        let targetFile = 'index.html';

        if (page) {
            targetFile = page;
        } else {
             // Auto-discovery: Find which file contains the section
             try {
                 const files = await fs.readdir(distDir);
                 const htmlFiles = files.filter(f => f.endsWith('.html'));
                 
                 for (const file of htmlFiles) {
                     const content = await fs.readFile(path.join(distDir, file), 'utf-8');
                     if (content.includes(`data-section="${sectionId}"`)) {
                         targetFile = file;
                         break;
                     }
                 }
             } catch (e) {
                 console.warn(`[AutoDiscovery] Failed to scan files: ${e.message}`);
             }
        }

        const sourcePath = path.join(distDir, targetFile);
        
        if (!await fs.pathExists(sourcePath)) {
            return res.status(404).json({ error: `Page ${targetFile} not found` });
        }
        
        const currentCode = await fs.readFile(sourcePath, 'utf-8');
        
        console.log(`Updating ${type} in section '${sectionId}' in file '${targetFile}' for project ${id}...`);
        const newCode = await updateSectionContent(currentCode, sectionId, type, originalValue, newValue);
        
        // Backup
        await fs.writeFile(sourcePath + '.bak', currentCode);
        
        // Write
        await fs.writeFile(sourcePath, newCode);
        
        // Rebuild & Deploy
        // Rebuild & Save (GCS only)
        const distPath = await rebuildSite(id);
        const previewUrl = await saveBuildArtifacts(id, distPath, req.user.uid);
        
        res.json({ success: true, url: previewUrl });
        
    } catch (error) {
        console.error('Content update failed:', error);
        res.status(500).json({ error: error.message });
    }
});

// Undo Last Change
app.post('/api/project/:id/undo', verifyToken, async (req, res) => {
    const { id } = req.params;
    try {
        if (!await ensureProjectSource(id)) return res.status(404).json({ error: 'Project source not found' });

        const sourcePath = path.join(__dirname, 'projects_source', id, 'dist/index.html');
        const backupPath = sourcePath + '.bak';
        
        if (!await fs.pathExists(backupPath)) {
            return res.status(400).json({ error: 'No undo available' });
        }
        
        // Restore backup
        await fs.copy(backupPath, sourcePath);
        
        console.log(`Undoing changes for project ${id}...`);
        // Rebuild & Save (GCS only)
        const distPath = await rebuildSite(id);
        const previewUrl = await saveBuildArtifacts(id, distPath, req.user.uid);
        
        res.json({ success: true, url: previewUrl });
    } catch (error) {
         console.error('Undo failed:', error);
         res.status(500).json({ error: error.message });
    }
});

// Upload Asset
app.post('/api/project/:id/upload', verifyToken, upload.single('file'), async (req, res) => {
    const { id } = req.params;
    const file = req.file;
    
    if (!file) {
        return res.status(400).json({ error: 'No file uploaded' });
    }

    try {
        if (!await ensureProjectSource(id)) return res.status(404).json({ error: 'Project source not found' });

        // Target: projects_source/<id>/dist/assets/
        const assetsDir = path.join(__dirname, 'projects_source', id, 'dist/assets');
        await fs.ensureDir(assetsDir);
        
        const ext = path.extname(file.originalname);
        const filename = `${Date.now()}${ext}`;
        const destPath = path.join(assetsDir, filename);
        
        // Move from temp upload to assets
        await fs.move(file.path, destPath);
        
        // Return URL relative to site root
        res.json({ url: `./assets/${filename}` });
        
    } catch (error) {
        console.error('Upload failed:', error);
        res.status(500).json({ error: error.message });
    }
});

// Update Theme
app.post('/api/project/:id/theme', verifyToken, async (req, res) => {
    const { id } = req.params;
    const { colors } = req.body; // Expect { primary: '#...', secondary: '#...', ... }
    
    try {
        if (!await ensureProjectSource(id)) return res.status(404).json({ error: 'Project source not found' });

        const configPath = path.join(__dirname, 'projects_source', id, 'tailwind.config.js');
        
        if (!await fs.pathExists(configPath)) {
            return res.status(404).json({ error: 'Project configuration not found' });
        }
        
        let configContent = await fs.readFile(configPath, 'utf-8');
        
        // Simple regex replacement for each color key
        // Assumes format: key: "value",
        Object.entries(colors).forEach(([key, value]) => {
             // Regex looks for: "key": "..." or key: "..." (handles both quoted and unquoted keys)
             const regex = new RegExp(`(["']?)${key}\\1:\\s*["'][^"']*["']`, 'g');
             configContent = configContent.replace(regex, `$1${key}$1: "${value}"`);
        });

        await fs.writeFile(configPath, configContent);
        
        console.log(`Updating theme for project ${id}...`);
        // Rebuild & Save (GCS only)
        const distPath = await rebuildSite(id);
        const previewUrl = await saveBuildArtifacts(id, distPath, req.user.uid);
        
        res.json({ success: true, url: previewUrl });
        
    } catch (error) {
        console.error('Theme update failed:', error);
        res.status(500).json({ error: error.message });
    }
});

// Extract Business Info (Pre-Build)
app.post('/api/extract', verifyToken, async (req, res) => {
    const { query } = req.body;
    try {
        if (!query) return res.status(400).json({ error: 'Query is required' });
        
        console.log(`[API] Extracting info for: "${query}"...`);
        const extractResult = await extractFromUrl(query);
        const userContext = extractResult.data;
        if (extractResult.usageLog) await saveTokenUsage(extractResult.usageLog.map(u => ({ ...u, service: 'extractor' })), null, req.user.uid);

        res.json({ success: true, data: userContext });
    } catch (error) {
        console.error('Extraction failed:', error);
        res.status(500).json({ error: error.message });
    }
});

// Initialize Build (Step 1)
app.post('/api/build', verifyToken, upload.single('logo'), async (req, res) => {
    let { userContext, businessUrl, businessQuery, pages, stylePreset } = req.body;
    const logoFile = req.file; // Get the uploaded logo file

    // Parse pages if it comes as a string (from FormData)
    let parsedPages = ['Home'];
    if (pages) {
        try {
            parsedPages = typeof pages === 'string' ? JSON.parse(pages) : pages;
        } catch (e) {
            console.error('Error parsing pages:', e);
        }
    }

    const id = Date.now().toString();
    
    // Generate default subdomain (project-id based for uniqueness initially)
    // Users can customize this later.
    const defaultSubdomain = `site-${id}`; // e.g. site-176...

    // Allow businessUrl or businessQuery to drive the extraction
    const query = businessQuery || businessUrl;

    try {
        // Only extract if userContext is not provided
        if (!userContext && query) {
            console.log(`Extracting info for query: "${query}"...`);
            const extractResult = await extractFromUrl(query);
            userContext = extractResult.data;
            if (extractResult.usageLog) await saveTokenUsage(extractResult.usageLog.map(u => ({ ...u, service: 'extractor' })), id, req.user.uid);
            console.log('Extracted Context:', userContext);
        }

        if (!userContext) {
            return res.status(400).json({ error: 'userContext or businessQuery is required' });
        }

        // --- Credit Check (Pre-Auth) ---
        const cost = parsedPages.length > 1 ? 400 : 200;
        const currentCredits = await getUserCredits(req.user.uid);
        if (currentCredits < cost) {
            return res.status(402).json({ error: 'Insufficient credits. Please top up your wallet.' });
        }
        // -------------------------------

        console.log(`Initializing build for ${id} (Pages: ${parsedPages.join(', ')})...`);
        
        // Initialize Firestore Document
        if (db) {
            await db.collection('projects').doc(id).set({
                projectId: id,
                userId: req.user.uid,
                query: query || 'Manual Context',
                status: 'starting',
                subdomain: defaultSubdomain,
                logs: [],
                buildProgress: 0,
                buildProgressMessage: 'Starting...',
                createdAt: admin.firestore.FieldValue.serverTimestamp(),
                isPublished: false,
                stylePreset: stylePreset || 'standard',
                userContext: userContext,
                pages: parsedPages,
            });
        }

        // Trigger Background Process (Fire and Forget)
        runBuildProcess(id, userContext, logoFile, parsedPages, req.user.uid, cost, query, stylePreset)
            .catch(err => console.error(`Background build ${id} failed hard:`, err));

        // Return immediately
        res.json({ success: true, id, status: 'processing', message: 'Build started in background.' });
        
    } catch (error) {
        console.error('Build init failed:', error);
        res.status(500).json({ error: error.message });
    }
});

// Retry a failed build
app.post('/api/project/:id/retry', verifyToken, async (req, res) => {
    const { id } = req.params;
    try {
        const doc = await db.collection('projects').doc(id).get();
        if (!doc.exists) return res.status(404).json({ error: 'Project not found' });

        const project = doc.data();
        if (project.userId !== req.user.uid) return res.status(403).json({ error: 'Unauthorized' });
        if (project.status !== 'failed') return res.status(400).json({ error: 'Project is not in failed state' });

        // Reset status
        await db.collection('projects').doc(id).update({
            status: 'starting',
            buildProgress: 0,
            buildProgressMessage: 'Starting...',
            error: admin.firestore.FieldValue.delete(),
            isRateLimited: admin.firestore.FieldValue.delete(),
        });

        // Re-trigger build
        runBuildProcess(id, project.userContext, null, project.pages || ['Home'], req.user.uid, 0, project.query, project.stylePreset)
            .catch(err => console.error(`Retry build ${id} failed:`, err));

        res.json({ success: true, message: 'Build retry started.' });
    } catch (error) {
        console.error('Retry failed:', error);
        res.status(500).json({ error: error.message });
    }
});

// Background Build Processor
async function sendBuildNotification(userId, projectId, projectName, status, errorMessage = null) {
    try {
        // Only send email if user has verified their email
        const userDoc = await db.collection('users').doc(userId).get();
        const userData = userDoc.exists ? userDoc.data() : {};
        if (!userData.emailVerified) {
            console.log(`[Email] Skipping build notification for ${userId} - email not verified`);
            return;
        }

        const userRecord = await admin.auth().getUser(userId);
        const userEmail = userRecord.email;
        if (!userEmail || !process.env.BREVO_SMTP_USER) {
            console.log(`[Email] Skipping build notification - no email or SMTP not configured`);
            return;
        }

        const baseUrl = process.env.APP_URL || `http://localhost:${PORT}`;
        const isSuccess = status === 'success';
        const siteName = projectName || 'your site';

        const statusColor = isSuccess ? '#16a34a' : '#dc2626';
        const statusBg = isSuccess ? '#f0fdf4' : '#fef2f2';
        const statusIcon = isSuccess ? '&#10003;' : '&#10007;';
        const statusText = isSuccess ? 'Your site is ready!' : 'Build failed';
        const subject = isSuccess
            ? `Your site "${siteName}" is ready! - GenWeb`
            : `Build failed for "${siteName}" - GenWeb`;

        const ctaSection = isSuccess
            ? `<div style="text-align: center; margin: 32px 0;">
                    <a href="${baseUrl}/my-sites" style="display: inline-block; background: #f97316; color: #ffffff; font-size: 15px; font-weight: 600; text-decoration: none; padding: 12px 32px; border-radius: 8px;">
                        View Your Site
                    </a>
                </div>`
            : `<div style="background: ${statusBg}; border: 1px solid #fecaca; border-radius: 8px; padding: 16px; margin: 16px 0;">
                    <p style="color: #991b1b; font-size: 14px; margin: 0;"><strong>Error:</strong> ${errorMessage || 'An unexpected error occurred.'}</p>
                </div>
                <div style="text-align: center; margin: 32px 0;">
                    <a href="${baseUrl}/my-sites" style="display: inline-block; background: #f97316; color: #ffffff; font-size: 15px; font-weight: 600; text-decoration: none; padding: 12px 32px; border-radius: 8px;">
                        Retry Build
                    </a>
                </div>`;

        const mailOptions = {
            from: `"GenWeb" <${SMTP_FROM}>`,
            to: userEmail,
            subject,
            html: `
                <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 560px; margin: 0 auto; padding: 40px 20px;">
                    <div style="text-align: center; margin-bottom: 32px;">
                        <h1 style="font-size: 24px; font-weight: 700; color: #1a1a2e; margin: 0;">GenWeb</h1>
                    </div>
                    <div style="background: #ffffff; border: 1px solid #e5e7eb; border-radius: 12px; padding: 32px;">
                        <div style="text-align: center; margin-bottom: 24px;">
                            <div style="display: inline-block; width: 48px; height: 48px; line-height: 48px; border-radius: 50%; background: ${statusBg}; color: ${statusColor}; font-size: 24px; font-weight: bold;">
                                ${statusIcon}
                            </div>
                        </div>
                        <h2 style="font-size: 20px; font-weight: 600; color: #1a1a2e; margin: 0 0 8px; text-align: center;">${statusText}</h2>
                        <p style="color: #6b7280; font-size: 15px; line-height: 1.6; margin: 0 0 8px; text-align: center;">
                            ${isSuccess
                                ? `Your website <strong>"${siteName}"</strong> has been built successfully and is ready to preview and publish.`
                                : `We couldn't build your website <strong>"${siteName}"</strong>. You can retry the build from your dashboard.`
                            }
                        </p>
                        ${ctaSection}
                    </div>
                    <p style="color: #9ca3af; font-size: 12px; text-align: center; margin-top: 24px;">
                        &copy; GenWeb &middot; <a href="https://genweb.in" style="color: #9ca3af;">genweb.in</a>
                    </p>
                </div>
            `
        };

        await transporter.sendMail(mailOptions);
        console.log(`[Email] Build ${status} notification sent to ${userEmail} for project ${projectId}`);
    } catch (err) {
        console.error(`[Email] Failed to send build notification:`, err.message);
    }
}

async function runBuildProcess(id, userContext, logoFile, parsedPages, userId, cost, query, stylePreset) {
    console.log(`[${id}] Starting background build process...`);
    
    const logProgress = async (message, progress = null) => {
        console.log(`[${id}] Progress: ${message}${progress !== null ? ` (${progress}%)` : ''}`);
        if (db) {
            try {
                const updateData = {
                    status: 'processing',
                    logs: admin.firestore.FieldValue.arrayUnion({
                        message,
                        timestamp: new Date().toISOString()
                    })
                };
                if (progress !== null) {
                    updateData.buildProgress = progress;
                    updateData.buildProgressMessage = message.replace(`[${id}] `, '');
                }
                await db.collection('projects').doc(id).update(updateData);
            } catch (e) {
                console.warn(`[${id}] Failed to update firestore log:`, e.message);
            }
        }
    };

    try {
        await logProgress('Starting build engine...', 5);

        const totalPages = parsedPages.length;
        const wrappedProgress = async (message) => {
            // Builder calls onProgress with messages; map them to percentages
            const msg = message.replace(`[${id}] `, '');
            let pct = null;
            if (msg.includes('Generating Design')) pct = 10;
            else if (msg.includes('Fetching Images')) pct = 20;
            else if (msg.includes('Copying skeleton')) pct = 25;
            else if (msg.includes('Generating') && msg.includes('pages')) pct = 30;
            else if (msg.includes('Generating Home') || msg.includes('Generating') && !msg.includes('remaining')) {
                // Individual page generation - distribute 30-70% across pages
                const pageMatch = msg.match(/Generating (.+?)\.\.\./);
                if (pageMatch) {
                    const pageName = pageMatch[1];
                    const pageIndex = parsedPages.indexOf(pageName);
                    if (pageIndex >= 0) {
                        pct = 30 + Math.round((pageIndex / totalPages) * 40);
                    } else {
                        pct = 50; // fallback
                    }
                }
            }
            else if (msg.includes('remaining pages')) pct = 45;
            else if (msg.includes('Injecting configuration')) pct = 75;
            await logProgress(message, pct);
        };

        const buildResult = await buildSite(id, userContext, logoFile, parsedPages, wrappedProgress, stylePreset);
        const distPath = buildResult.distDir;

        // Save token usage from the build
        if (buildResult.tokenUsageLog) await saveTokenUsage(buildResult.tokenUsageLog, id, userId);

        await logProgress('Build success! Saving & Deploying...', 80);

        // 1. Move the entire project (source + dist) to projects_source
        const sourcePath = path.join(__dirname, 'projects_source', id);
        const tempPath = path.join(__dirname, 'temp', id);

        await fs.move(tempPath, sourcePath);
        await logProgress(`Source code saved.`, 85);

        // 2. Post-Build: Save to Storage (GCS) + Preview
        await logProgress('Saving to Cloud Storage...', 90);
        const savedUrl = await saveBuildArtifacts(id, path.join(sourcePath, 'dist'), userId);

        // 4. Deduct Credits (Only on Success)
        try {
            await deductCredits(userId, cost, `Generate ${parsedPages.length > 1 ? 'Multi-Page' : 'Single-Page'} Site (${id})`);
            await logProgress('Credits deducted.', 95);
        } catch (creditErr) {
            console.error(`[${id}] Failed to deduct credits after success:`, creditErr);
            // Don't fail the build for this, but log it critically
        }

        // Final DB Update
        if (db) {
            await db.collection('projects').doc(id).update({
                status: 'completed',
                isPublished: false,
                url: savedUrl, // Default to preview URL until published
                localUrl: savedUrl,
                // deployUrl: null, // Don't wipe it if it exists, but don't set it either
                completedAt: admin.firestore.FieldValue.serverTimestamp(),
                logs: admin.firestore.FieldValue.arrayUnion({
                    message: 'Process Finished Successfully.',
                    timestamp: new Date().toISOString()
                })
            });
        }
        
        console.log(`[${id}] Process Finished Successfully.`);

        // Send success email notification
        sendBuildNotification(userId, id, query, 'success').catch(err =>
            console.error(`[${id}] Failed to send success email:`, err.message)
        );

    } catch (error) {
        console.error(`[${id}] Build Process Failed:`, error);
        const isRateLimited = error.message === 'RATE_LIMITED';
        const userError = isRateLimited
            ? 'We are currently experiencing high demand. Please retry after a few minutes.'
            : error.message;

        if (db) {
            await db.collection('projects').doc(id).update({
                status: 'failed',
                error: userError,
                isRateLimited: isRateLimited,
                logs: admin.firestore.FieldValue.arrayUnion({
                    message: `Error: ${userError}`,
                    timestamp: new Date().toISOString()
                })
            });
        }

        // Send failure email notification
        sendBuildNotification(userId, id, query, 'failed', userError).catch(err =>
            console.error(`[${id}] Failed to send failure email:`, err.message)
        );

        // Cleanup temp if it exists and wasn't moved
        try {
             const tempPath = path.join(__dirname, 'temp', id);
             if (await fs.pathExists(tempPath)) {
                 await fs.remove(tempPath);
             }
        } catch (cleanupErr) { /* ignore */ }
    }
}

// --- Payments (Razorpay) ---

app.post('/api/payments/order', verifyToken, async (req, res) => {
    const { amount, currency } = req.body;
    try {
        const order = await createOrder(amount, currency);
        res.json(order);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

app.post('/api/payments/verify', verifyToken, async (req, res) => {
    const { orderId, paymentId, signature } = req.body;
    const isValid = verifyPayment(orderId, paymentId, signature);
    
    if (isValid) {
        res.json({ success: true });
    } else {
        res.status(400).json({ success: false, error: 'Invalid Signature' });
    }
});

// --- Credit System Endpoints ---

// Get User Credits
app.get('/api/credits', verifyToken, async (req, res) => {
    try {
        const credits = await getUserCredits(req.user.uid);
        res.json({ credits });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Get Credit History
app.get('/api/credits/history', verifyToken, async (req, res) => {
    try {
        const transactions = await getTransactions(req.user.uid);
        res.json(transactions);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Buy Credits (Create Order)
app.post('/api/credits/buy', verifyToken, async (req, res) => {
    const { amount, credits } = req.body; // amount in INR, credits to add
    try {
        // Create Razorpay order (amount in paise)
        const order = await createOrder(amount * 100, 'INR');
        res.json({ order, credits }); // Pass back credits for client context
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Verify Credit Purchase
app.post('/api/credits/verify', verifyToken, async (req, res) => {
    const { orderId, paymentId, signature, credits, amount } = req.body;
    
    try {
        const isValid = verifyPayment(orderId, paymentId, signature);
        
        if (isValid) {
            // Add credits to user wallet
            await addCredits(req.user.uid, parseInt(credits), `Purchased ${credits} credits for ₹${amount}`, paymentId);

            // Referral reward trigger: complete pending referrals on first purchase
            try {
                const referralSnap = await db.collection('referrals')
                    .where('referredUserId', '==', req.user.uid)
                    .where('status', '==', 'pending')
                    .limit(1)
                    .get();

                if (!referralSnap.empty) {
                    const referral = referralSnap.docs[0];
                    const refData = referral.data();
                    await addCredits(refData.referrerUserId, refData.rewardAmount, `Referral reward - referred user made a purchase`);
                    await referral.ref.update({
                        status: 'completed',
                        completedAt: admin.firestore.FieldValue.serverTimestamp()
                    });
                    console.log(`[Referral] Completed referral ${referral.id}: rewarded ${refData.referrerUserId} with ${refData.rewardAmount} credits`);
                }
            } catch (refErr) {
                console.error('[Referral] Failed to process referral reward:', refErr.message);
            }

            res.json({ success: true, message: 'Credits added successfully' });
        } else {
            res.status(400).json({ success: false, error: 'Invalid Signature' });
        }
    } catch (error) {
        console.error('Credit verification failed:', error);
        res.status(500).json({ error: error.message });
    }
});

// Unlock Publishing Plan & Deploy to Cloudflare
app.post('/api/project/:id/publish', verifyToken, async (req, res) => {
    const { id } = req.params;
    const { plan, subdomain, years = 1 } = req.body; // 'basic', 'single', 'multi'; years default 1
    
    const COSTS = {
        'basic': 500,
        'single': 2000,
        'multi': 3000
    };
    
    const cost = COSTS[plan];
    if (!cost) {
        return res.status(400).json({ error: 'Invalid plan' });
    }

    const duration = [1, 2, 3].includes(parseInt(years)) ? parseInt(years) : 1;
    let totalCost = cost * duration;

    // Apply Discounts
    if (duration === 2) totalCost *= 0.95; // 5% off
    if (duration === 3) totalCost *= 0.90; // 10% off
    
    totalCost = Math.round(totalCost);
    
    try {
        if (!await ensureProjectSource(id)) return res.status(404).json({ error: 'Project source not found' });

        const distPath = path.join(__dirname, 'projects_source', id, 'dist');
        if (!await fs.pathExists(distPath)) {
            return res.status(404).json({ error: 'Build artifacts (dist folder) not found. Please rebuild the project.' });
        }

        // 1. Check ownership
        const projectRef = db.collection('projects').where('projectId', '==', id).where('userId', '==', req.user.uid);
        const snapshot = await projectRef.get();
        
        if (snapshot.empty) {
            return res.status(403).json({ error: 'Project not found or unauthorized' });
        }
        
        const projectDoc = snapshot.docs[0];
        const projectData = projectDoc.data();

        // 2. Update Subdomain if provided (and different)
        let finalSubdomain = projectData.subdomain;
        if (subdomain) {
            const cleanName = subdomain.toLowerCase();
            if (cleanName !== finalSubdomain) {
                // Check availability
                const availability = await checkSubdomainAvailability(cleanName);
                if (!availability.available) {
                     const existing = await db.collection('projects').where('subdomain', '==', cleanName).get();
                     if (!existing.empty && existing.docs[0].data().projectId !== id) {
                         return res.status(409).json({ error: availability.error });
                     }
                }
                finalSubdomain = cleanName;
                await projectDoc.ref.update({ subdomain: finalSubdomain });
            }
        }
        
        // 3. Deduct Credits
        // Always deduct for renewal or new plan
        // Note: If user is just changing subdomain without renewal, they shouldn't call this with years?
        // Assuming client calls this ONLY for payment/publish actions.
        await deductCredits(req.user.uid, totalCost, `Unlock/Renew ${plan} plan for project ${id} (${duration} years)`);
        
        // 4. Calculate Expiry
        const now = admin.firestore.Timestamp.now();
        let expiryDate;
        let startDate = projectData.subscriptionStartDate || now;

        // Check if currently active
        const currentExpiry = projectData.subscriptionExpiryDate;
        const isCurrentlyActive = currentExpiry && currentExpiry.toMillis() > Date.now() && !projectData.isExpired;

        if (isCurrentlyActive) {
            // Extend
            const currentExpiryDate = currentExpiry.toDate();
            currentExpiryDate.setFullYear(currentExpiryDate.getFullYear() + duration);
            expiryDate = admin.firestore.Timestamp.fromDate(currentExpiryDate);
        } else {
            // New or Reactivation
            const newExpiryDate = new Date();
            newExpiryDate.setFullYear(newExpiryDate.getFullYear() + duration);
            expiryDate = admin.firestore.Timestamp.fromDate(newExpiryDate);
            startDate = now; // Reset start date if expired/new
        }

        // 5. Deploy to GCP (Ensure bucket is public)
        console.log(`Publishing project ${id} to GCP (Subdomain: ${finalSubdomain})...`);
        const deployResult = await deploySite(distPath, id, projectData.netlifySiteId); 
        
        // Ensure bucket is public (in case it was private due to expiry)
        await makeBucketPublic(`site-${id}`);

        // 6. Construct Public URL
        const publicUrl = `https://${finalSubdomain}.genweb.in`;

        // 7. Update Project Status & URL
        await projectDoc.ref.update({
            publishedPlan: plan,
            isPublished: true,
            isExpired: false,
            subscriptionStartDate: startDate,
            subscriptionExpiryDate: expiryDate,
            subscriptionYears: duration, // Store last purchased duration or total? let's store last purchased
            deployUrl: publicUrl, 
            bucketUrl: deployResult.url,
            publishedAt: admin.firestore.FieldValue.serverTimestamp(),
            updatedAt: admin.firestore.FieldValue.serverTimestamp()
        });
        
        res.json({ success: true, url: publicUrl, expiry: expiryDate.toDate() });
        
    } catch (error) {
        if (error.message === 'Insufficient credits') {
            return res.status(402).json({ error: 'Insufficient credits' });
        }
        console.error('Publish unlock/deploy failed:', error);
        res.status(500).json({ error: error.message });
    }
});

// --- Domain Management Endpoints ---

// Check Domain Availability
app.get('/api/domains/check', verifyToken, async (req, res) => {
    const { domain } = req.query;
    if (!domain) {
        return res.status(400).json({ error: 'Domain is required' });
    }

    try {
        const result = await checkAvailability(domain);
        res.json(result);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Get Domain Suggestions
app.get('/api/domains/suggest', verifyToken, async (req, res) => {
    const { query } = req.query;
    if (!query) {
        return res.status(400).json({ error: 'Query is required' });
    }

    try {
        const result = await getSuggestions(query);
        res.json(result);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Get User's Domains
app.get('/api/domains', verifyToken, async (req, res) => {
    try {
        if (!db) {
            return res.json([]);
        }
        
        const snapshot = await db.collection('domains')
            .where('userId', '==', req.user.uid)
            .orderBy('createdAt', 'desc')
            .get();
            
        const domains = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        res.json(domains);
    } catch (error) {
        console.error('Fetch domains failed:', error);
        res.status(500).json({ error: error.message });
    }
});

// --- DNS Management (NameSilo) ---

// List DNS Records
app.get('/api/domains/:domain/dns', verifyToken, async (req, res) => {
    const { domain } = req.params;
    try {
        if (!db) return res.status(503).json({ error: 'DB unavailable' });

        // Verify Ownership
        const snapshot = await db.collection('domains')
            .where('domain', '==', domain)
            .where('userId', '==', req.user.uid)
            .get();

        if (snapshot.empty) {
            return res.status(403).json({ error: 'Unauthorized: Domain not found in your account.' });
        }

        const records = await listDNSRecords(domain);
        res.json(records);

    } catch (error) {
        console.error(`List DNS failed for ${domain}:`, error);
        res.status(500).json({ error: error.message });
    }
});

// Add DNS Record
app.post('/api/domains/:domain/dns', verifyToken, async (req, res) => {
    const { domain } = req.params;
    const { type, host, value, ttl, distance } = req.body;

    if (!type || !value) {
        return res.status(400).json({ error: 'Type and Value are required.' });
    }

    try {
        if (!db) return res.status(503).json({ error: 'DB unavailable' });

        // Verify Ownership
        const snapshot = await db.collection('domains')
            .where('domain', '==', domain)
            .where('userId', '==', req.user.uid)
            .get();

        if (snapshot.empty) {
            return res.status(403).json({ error: 'Unauthorized' });
        }

        const result = await addDNSRecordGeneric(domain, { type, host, value, ttl, distance });
        res.json(result);

    } catch (error) {
        console.error(`Add DNS failed for ${domain}:`, error);
        res.status(500).json({ error: error.message });
    }
});

// Delete DNS Record
app.delete('/api/domains/:domain/dns/:rrid', verifyToken, async (req, res) => {
    const { domain, rrid } = req.params;

    try {
        if (!db) return res.status(503).json({ error: 'DB unavailable' });

        // Verify Ownership
        const snapshot = await db.collection('domains')
            .where('domain', '==', domain)
            .where('userId', '==', req.user.uid)
            .get();

        if (snapshot.empty) {
            return res.status(403).json({ error: 'Unauthorized' });
        }

        await deleteDNSRecord(domain, rrid);
        res.json({ success: true });

    } catch (error) {
        console.error(`Delete DNS failed for ${domain}:`, error);
        res.status(500).json({ error: error.message });
    }
});

// Purchase Domain
app.post('/api/domains/buy', verifyToken, async (req, res) => {
    const { domain, contactInfo, projectId } = req.body;

    if (!domain || !contactInfo) {
        return res.status(400).json({ error: 'Domain and contactInfo are required' });
    }

    // Capture IP for 'agreedBy' field
    const ip = req.headers['x-forwarded-for'] || req.socket.remoteAddress;

    try {
        // Prepare details object
        const details = {
            ip,
            contact: contactInfo // Assuming contactInfo has the required fields (nameFirst, nameLast, etc.)
        };

        const result = await purchaseDomain(domain, details);
        
        let cfStatus = null;
        
        // If projectId is provided, we can auto-setup Cloudflare immediately
        // Otherwise, user will have to "Connect" it later.
        // For now, let's assume we want to setup Cloudflare Zone regardless to get NS.
        // We use a placeholder project ID if none provided, or just init the zone.
        
        try {
            // true = isManagedByUs (Auto update DNS)
            // If no project ID, we might fail linking, but we can still Add DNS if we knew the IP.
            // But setupGCPDomain requires projectId to know the target bucket.
            // If no projectId, we can't fully setup the LB mapping, but we can point the A record if we assume a shared LB.
            
            if (projectId) {
                 cfStatus = await setupGCPDomain(domain, projectId, true);
            }
        } catch (cfError) {
            console.error("Auto-GCP setup failed during purchase:", cfError);
            // Don't fail the purchase response, just log it.
            cfStatus = { status: 'SETUP_FAILED', error: cfError.message };
        }
        
        // Save to Firestore
        if (db) {
            await db.collection('domains').add({
                domain,
                userId: req.user.uid,
                orderId: result.orderId || 'unknown',
                createdAt: admin.firestore.FieldValue.serverTimestamp(),
                provider: 'namesilo',
                status: 'active',
                autoRenew: true,
                lbStatus: cfStatus,
                ip: cfStatus?.ip || null
            });
        }

        res.json({ success: true, order: result, lbStatus: cfStatus });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// --- Subdomain Management (*.genweb.in) ---

// Check Subdomain Availability
app.get('/api/subdomain/check', verifyToken, async (req, res) => {
    const { name } = req.query;
    if (!name) return res.status(400).json({ error: 'Name is required' });
    
    try {
        const result = await checkSubdomainAvailability(name.toLowerCase());
        res.json(result);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Update Project Subdomain
app.post('/api/project/:id/subdomain', verifyToken, async (req, res) => {
    const { id } = req.params;
    const { subdomain } = req.body;
    
    if (!subdomain) return res.status(400).json({ error: 'Subdomain is required' });
    
    const cleanName = subdomain.toLowerCase();
    
    try {
        if (!db) return res.status(503).json({ error: 'DB unavailable' });
        
        // 1. Check availability
        const availability = await checkSubdomainAvailability(cleanName);
        
        // If it's taken, check if it's taken by THIS project (idempotent)
        if (!availability.available) {
             const existing = await db.collection('projects').where('subdomain', '==', cleanName).get();
             if (!existing.empty && existing.docs[0].data().projectId === id) {
                 // Same project, do nothing
                 return res.json({ success: true, subdomain: cleanName });
             }
             return res.status(409).json({ error: availability.error });
        }

        // 2. Verify Ownership
        const projectRef = db.collection('projects').where('projectId', '==', id).where('userId', '==', req.user.uid);
        const snapshot = await projectRef.get();
        
        if (snapshot.empty) {
            return res.status(403).json({ error: 'Project not found or unauthorized' });
        }

        // 3. Update
        await snapshot.docs[0].ref.update({
            subdomain: cleanName,
            updatedAt: admin.firestore.FieldValue.serverTimestamp()
        });
        
        res.json({ success: true, subdomain: cleanName });

    } catch (error) {
        console.error('Update subdomain failed:', error);
        res.status(500).json({ error: error.message });
    }
});

// Delete Project
app.delete('/api/projects/:id', verifyToken, async (req, res) => {
    const { id } = req.params;
    
    try {
        if (!db) return res.status(503).json({ error: 'DB unavailable' });

        // Query by projectId (not doc ID if they differ, but usually id param is projectId)
        // Wait, standard route is /api/projects/:id where id is projectId
        const projectRef = db.collection('projects').where('projectId', '==', id).where('userId', '==', req.user.uid);
        const snapshot = await projectRef.get();
        
        if (snapshot.empty) {
            return res.status(404).json({ error: 'Project not found or unauthorized' });
        }

        const projectDoc = snapshot.docs[0];
        const projectData = projectDoc.data();

        console.log(`[Delete Project] Starting deletion for ${id} (Owner: ${req.user.uid})...`);

        // 1. Cleanup Custom Domain Resources (if any)
        if (projectData.customDomain) {
            console.log(`[Delete Project] Cleaning up custom domain: ${projectData.customDomain}`);
            try {
                // This removes BackendBucket, URL Map rules, SSL Certs
                await cleanupGCPDomain(projectData.customDomain, id);
            } catch (err) {
                console.warn(`[Delete Project] Failed to clean up custom domain resources:`, err.message);
                // Continue deletion anyway
            }
        }

        // 2. Cleanup Storage Bucket (site-{projectId})
        // Even if not published, the bucket might exist if they ever tried to deploy
        // Or if it's a draft, maybe it's just in temp. But deleteSiteBucket checks existence.
        try {
            await deleteSiteBucket(id);
        } catch (err) {
            console.warn(`[Delete Project] Failed to delete storage bucket site-${id}:`, err.message);
        }

        // 3. Delete Firestore Document
        await projectDoc.ref.delete();

        console.log(`[Delete Project] Project ${id} deleted successfully.`);
        res.json({ success: true, message: 'Project deleted' });

    } catch (error) {
        console.error(`[Delete Project] Error:`, error);
        res.status(500).json({ error: 'Failed to delete project: ' + error.message });
    }
});

// --- Custom Domain Hosting (Caddy Integration) ---



// Verify Domain DNS Setup (GCP LB Check)
app.get('/api/domains/verify-setup', verifyToken, async (req, res) => {
    const { domain } = req.query;

    if (!domain) {
        return res.status(400).json({ error: 'Domain is required' });
    }

    try {
        const result = await verifyDomainDNS(domain);
        res.json(result);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Assign Custom Domain to Project (GCP LB)
app.post('/api/project/:id/domain', verifyToken, async (req, res) => {
    const { id } = req.params;
    const { domain } = req.body; 

    if (!domain) {
        return res.status(400).json({ error: 'Domain is required' });
    }

    const cleanDomain = domain.toLowerCase().trim();

    try {
        if (!db) return res.status(503).json({ error: 'DB unavailable' });

        // 1. Check if domain is taken
        const duplicateCheck = await db.collection('projects')
            .where('customDomain', '==', cleanDomain)
            .get();

        if (!duplicateCheck.empty) {
            if (duplicateCheck.docs[0].data().projectId === id) {
                return res.json({ success: true, message: 'Domain already assigned.' });
            }
            return res.status(409).json({ error: 'Domain already connected to another site.' });
        }

        // 2. Verify Ownership
        const projectRef = db.collection('projects').where('projectId', '==', id).where('userId', '==', req.user.uid);
        const snapshot = await projectRef.get();

        if (snapshot.empty) {
            return res.status(403).json({ error: 'Project not found or unauthorized' });
        }

        const projectDoc = snapshot.docs[0];

        // 3. Setup GCP Domain
        // Check if we manage this domain in our 'domains' collection to set isManagedByUs
        let isManaged = false;
        const domainDoc = await db.collection('domains').where('domain', '==', cleanDomain).where('userId', '==', req.user.uid).get();
        if (!domainDoc.empty && domainDoc.docs[0].data().provider === 'namesilo') {
            isManaged = true;
        }

        const cfResult = await setupGCPDomain(cleanDomain, id, isManaged);

        // 4. Update Project
        await projectDoc.ref.update({
            customDomain: cleanDomain,
            domainUpdatedAt: admin.firestore.FieldValue.serverTimestamp(),
            lbIp: cfResult.ip, // Store the IP
            domainStatus: cfResult.status // 'CONFIGURED' or 'ACTION_REQUIRED'
        });

        res.json({ 
            success: true, 
            domain: cleanDomain,
            ip: cfResult.ip,
            message: cfResult.message,
            managed: isManaged
        });

    } catch (error) {
        console.error('Assign domain failed:', error);
        res.status(500).json({ error: error.message });
    }
});

// Claim Free Domain
app.post('/api/domains/claim', verifyToken, async (req, res) => {
    const { domain, projectId, contact } = req.body;

    if (!domain || !projectId) {
        return res.status(400).json({ error: 'Domain and Project ID are required' });
    }

    if (!contact || !contact.nameFirst || !contact.nameLast || !contact.email || !contact.phone || !contact.address1 || !contact.city || !contact.state || !contact.postalCode || !contact.country) {
        return res.status(400).json({ error: 'Incomplete contact details provided for domain registration.' });
    }

    const cleanDomain = domain.toLowerCase().trim();
    if (!cleanDomain.endsWith('.in') && !cleanDomain.endsWith('.com')) {
        return res.status(400).json({ error: 'Only .in and .com domains are allowed for free claim.' });
    }

    try {
        // 1. Verify Project Ownership
        const projectRef = db.collection('projects').where('projectId', '==', projectId).where('userId', '==', req.user.uid);
        const snapshot = await projectRef.get();
        if (snapshot.empty) {
            return res.status(403).json({ error: 'Project not found or unauthorized' });
        }
        const projectDoc = snapshot.docs[0];

        // 2. Check Availability & Price
        const availability = await checkAvailability(cleanDomain);
        if (!availability.available) {
            return res.status(400).json({ error: 'Domain is not available.' });
        }

        // Price Check (Max 1000 INR)
        const priceINR = availability.priceDisplay ? availability.priceDisplay.amount : 9999;
        if (priceINR > 1000) {
            return res.status(400).json({ error: `Domain price (₹${priceINR}) exceeds the free claim limit of ₹1000.` });
        }

        // 3. Purchase Domain (Using Backend Wallet)
        const contactInfo = {
            nameFirst: contact.nameFirst,
            nameLast: contact.nameLast,
            email: contact.email,
            phone: contact.phone,
            addressMailing: {
                address1: contact.address1,
                city: contact.city,
                state: contact.state,
                postalCode: contact.postalCode,
                country: contact.country
            }
        };

        const purchaseResult = await purchaseDomain(cleanDomain, { contact: contactInfo });

        // 4. Setup GCP & DNS (Automated)
        let cfResult = { status: 'PENDING', ip: process.env.GCP_LB_IP || '34.50.155.64' };
        try {
            cfResult = await setupGCPDomain(cleanDomain, projectId, true);
        } catch (e) {
            console.error("Post-claim setup failed:", e);
            // Don't fail the whole request, as domain is bought.
        }

        // 5. Save to DB
        // Add to User's Domains
        await db.collection('domains').add({
            domain: cleanDomain,
            userId: req.user.uid,
            projectId: projectId, // Linked Project
            orderId: purchaseResult.orderId || 'FREE_CLAIM',
            createdAt: admin.firestore.FieldValue.serverTimestamp(),
            provider: 'namesilo',
            status: 'active',
            autoRenew: true,
            isFreeClaim: true,
            price: priceINR,
            lbStatus: cfResult
        });

        // Update Project
        await projectDoc.ref.update({
            customDomain: cleanDomain,
            domainUpdatedAt: admin.firestore.FieldValue.serverTimestamp(),
            lbIp: cfResult.ip,
            domainStatus: cfResult.status
        });

        res.json({ success: true, domain: cleanDomain, message: 'Domain claimed and configuring.' });

    } catch (error) {
        console.error('Claim domain failed:', error);
        res.status(500).json({ error: error.message });
    }
});

// --- Cron Jobs ---
// Check for expired sites daily at 1 AM
cron.schedule('0 1 * * *', async () => {
    console.log('[Cron] Checking for expired subscriptions...');
    if (!db) return;

    try {
        const now = admin.firestore.Timestamp.now();
        
        // Query projects that are published and have passed expiry date
        // Note: Projects without subscriptionExpiryDate (legacy) will be ignored by the '<' filter
        const snapshot = await db.collection('projects')
            .where('isPublished', '==', true)
            .where('subscriptionExpiryDate', '<', now)
            .get();

        if (snapshot.empty) {
            console.log('[Cron] No expired subscriptions found.');
            return;
        }

        let expiredCount = 0;

        for (const doc of snapshot.docs) {
            const project = doc.data();
            
            // Skip if already marked expired
            if (project.isExpired === true) continue;

            const projectId = project.projectId;
            console.log(`[Cron] Expiring project ${projectId}...`);
            
            try {
                // 1. Make Bucket Private
                // This will remove public access
                await makeBucketPrivate(`site-${projectId}`);
                
                // 2. Update Firestore
                await doc.ref.update({ 
                    isExpired: true, 
                    expiredAt: now 
                });
                
                expiredCount++;
            } catch (err) {
                console.error(`[Cron] Failed to expire project ${projectId}:`, err);
            }
        }
        
        console.log(`[Cron] Expiry check complete. Expired ${expiredCount} sites.`);

    } catch (error) {
        console.error('[Cron] Expiry check failed:', error);
    }
});

// --- Email Verification ---
const crypto = require('crypto');

function generateVerificationToken() {
    return crypto.randomBytes(32).toString('hex');
}

async function sendVerificationEmail(email, token, userName) {
    const baseUrl = process.env.APP_URL || `http://localhost:${PORT}`;
    const verifyLink = `${baseUrl}/api/auth/verify-email?token=${token}`;

    const mailOptions = {
        from: `"GenWeb" <${SMTP_FROM}>`,
        to: email,
        subject: 'Verify your email address - GenWeb',
        html: `
            <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 560px; margin: 0 auto; padding: 40px 20px;">
                <div style="text-align: center; margin-bottom: 32px;">
                    <h1 style="font-size: 24px; font-weight: 700; color: #1a1a2e; margin: 0;">GenWeb</h1>
                </div>
                <div style="background: #ffffff; border: 1px solid #e5e7eb; border-radius: 12px; padding: 32px;">
                    <h2 style="font-size: 20px; font-weight: 600; color: #1a1a2e; margin: 0 0 12px;">Verify your email</h2>
                    <p style="color: #6b7280; font-size: 15px; line-height: 1.6; margin: 0 0 24px;">
                        Hi${userName ? ' ' + userName : ''}, please verify your email address to start using GenWeb. Click the button below to confirm your email.
                    </p>
                    <div style="text-align: center; margin: 32px 0;">
                        <a href="${verifyLink}" style="display: inline-block; background: #f97316; color: #ffffff; font-size: 15px; font-weight: 600; text-decoration: none; padding: 12px 32px; border-radius: 8px;">
                            Verify Email
                        </a>
                    </div>
                    <p style="color: #9ca3af; font-size: 13px; line-height: 1.5; margin: 0;">
                        If the button doesn't work, copy and paste this link into your browser:<br/>
                        <a href="${verifyLink}" style="color: #f97316; word-break: break-all;">${verifyLink}</a>
                    </p>
                    <p style="color: #9ca3af; font-size: 13px; margin: 24px 0 0;">This link expires in 24 hours.</p>
                </div>
                <p style="color: #9ca3af; font-size: 12px; text-align: center; margin-top: 24px;">
                    &copy; GenWeb &middot; <a href="https://genweb.in" style="color: #9ca3af;">genweb.in</a>
                </p>
            </div>
        `
    };

    await transporter.sendMail(mailOptions);
    console.log(`[Email] Verification email sent to ${email}`);
}

// Send verification email
app.post('/api/auth/send-verification-email', verifyToken, async (req, res) => {
    try {
        const userId = req.user.uid;
        const userRef = db.collection('users').doc(userId);
        const userDoc = await userRef.get();

        if (!userDoc.exists) {
            return res.status(404).json({ error: 'User not found' });
        }

        const userData = userDoc.data();
        const email = req.body.email || userData.email;

        if (!email) {
            return res.status(400).json({ error: 'No email address provided' });
        }

        // Generate token and store
        const token = generateVerificationToken();
        const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000); // 24 hours

        await userRef.set({
            emailVerificationToken: token,
            emailVerificationExpires: expiresAt.toISOString(),
            emailVerified: false,
            email: email
        }, { merge: true });

        await sendVerificationEmail(email, token, userData.name);

        res.json({ success: true, message: 'Verification email sent' });
    } catch (error) {
        console.error('Send verification email error:', error);
        res.status(500).json({ error: 'Failed to send verification email' });
    }
});

// Verify email (clicked from email link — no auth required)
app.get('/api/auth/verify-email', async (req, res) => {
    const { token } = req.query;

    if (!token) {
        return res.status(400).send('Invalid verification link.');
    }

    try {
        // Find user with this token
        const usersSnap = await db.collection('users')
            .where('emailVerificationToken', '==', token)
            .limit(1)
            .get();

        if (usersSnap.empty) {
            return res.send(verificationResultPage('Invalid or expired verification link.', false));
        }

        const userDoc = usersSnap.docs[0];
        const userData = userDoc.data();

        // Check expiry
        if (userData.emailVerificationExpires && new Date(userData.emailVerificationExpires) < new Date()) {
            return res.send(verificationResultPage('This verification link has expired. Please request a new one from your account.', false));
        }

        // Mark email as verified
        await userDoc.ref.update({
            emailVerified: true,
            emailVerifiedAt: new Date().toISOString(),
            emailVerificationToken: admin.firestore.FieldValue.delete(),
            emailVerificationExpires: admin.firestore.FieldValue.delete()
        });

        console.log(`[Email] Email verified for user ${userDoc.id}: ${userData.email}`);
        return res.send(verificationResultPage('Your email has been verified successfully! You can now close this page and continue using GenWeb.', true));
    } catch (error) {
        console.error('Email verification error:', error);
        return res.status(500).send(verificationResultPage('Something went wrong. Please try again.', false));
    }
});

function verificationResultPage(message, success) {
    return `<!DOCTYPE html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Email Verification - GenWeb</title></head>
    <body style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;display:flex;align-items:center;justify-content:center;min-height:100vh;margin:0;background:#f9fafb;">
        <div style="text-align:center;max-width:420px;padding:40px 24px;">
            <div style="font-size:48px;margin-bottom:16px;">${success ? '&#9989;' : '&#10060;'}</div>
            <h1 style="font-size:22px;font-weight:700;color:#1a1a2e;margin:0 0 12px;">Email Verification</h1>
            <p style="color:#6b7280;font-size:15px;line-height:1.6;margin:0 0 24px;">${message}</p>
            <a href="${process.env.APP_URL || 'https://app.genweb.in'}" style="display:inline-block;background:#f97316;color:#fff;font-size:14px;font-weight:600;text-decoration:none;padding:10px 24px;border-radius:8px;">Go to GenWeb</a>
        </div>
    </body></html>`;
}

// Check email verification status
app.get('/api/auth/email-status', verifyToken, async (req, res) => {
    try {
        const userId = req.user.uid;
        const userDoc = await db.collection('users').doc(userId).get();

        if (!userDoc.exists) {
            return res.json({ emailVerified: false, email: null });
        }

        const data = userDoc.data();
        res.json({
            emailVerified: data.emailVerified === true,
            email: data.email || null
        });
    } catch (error) {
        console.error('Email status check error:', error);
        res.status(500).json({ error: error.message });
    }
});

// Update email (requires re-verification)
app.post('/api/auth/update-email', verifyToken, async (req, res) => {
    const { email } = req.body;
    if (!email) return res.status(400).json({ error: 'Email is required' });

    try {
        const userId = req.user.uid;
        const userRef = db.collection('users').doc(userId);

        const token = generateVerificationToken();
        const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000);

        const userDoc = await userRef.get();
        const userName = userDoc.exists ? userDoc.data().name : '';

        await userRef.set({
            email: email,
            emailVerified: false,
            emailVerificationToken: token,
            emailVerificationExpires: expiresAt.toISOString()
        }, { merge: true });

        await sendVerificationEmail(email, token, userName);

        res.json({ success: true, message: 'Verification email sent to new address' });
    } catch (error) {
        console.error('Update email error:', error);
        res.status(500).json({ error: 'Failed to update email' });
    }
});

// --- New User Setup (Signup Gift Credits + Referral Bonus) ---
app.post('/api/auth/setup-new-user', verifyToken, async (req, res) => {
    try {
        const userId = req.user.uid;
        const userRef = db.collection('users').doc(userId);
        const userDoc = await userRef.get();

        if (userDoc.exists && userDoc.data().setupComplete) {
            return res.json({ success: true, message: 'Already setup' });
        }

        // Read platform config for gift amount
        const configDoc = await db.collection('platformConfig').doc('general').get();
        const config = configDoc.exists ? configDoc.data() : {};
        const giftAmount = config.signupGiftCredits || 200;

        // Add welcome credits
        await addCredits(userId, giftAmount, 'Welcome bonus credits');

        // Check for pending referral bonus (referred user bonus)
        const referralBonusAmount = config.referralBonusAmount || 50;
        const referralSnap = await db.collection('referrals')
            .where('referredUserId', '==', userId)
            .where('status', '==', 'pending')
            .limit(1)
            .get();

        const hasReferral = !referralSnap.empty;
        if (hasReferral) {
            await addCredits(userId, referralBonusAmount, 'Referral signup bonus');
        }

        // Mark setup complete
        await userRef.set({ setupComplete: true }, { merge: true });

        res.json({
            success: true,
            giftCredits: giftAmount,
            hasReferral,
            referralBonusAmount: hasReferral ? referralBonusAmount : 0,
            referrerReward: config.referralRewardAmount || 100
        });
    } catch (error) {
        console.error('Setup new user error:', error);
        res.status(500).json({ error: error.message });
    }
});

// --- Referral System ---
app.post('/api/referral/generate', verifyToken, async (req, res) => {
    try {
        const userId = req.user.uid;
        const userRef = db.collection('users').doc(userId);
        const userDoc = await userRef.get();

        if (userDoc.exists && userDoc.data().referralCode) {
            return res.json({ code: userDoc.data().referralCode });
        }

        // Generate unique code
        const code = 'GW' + userId.slice(-4).toUpperCase() + Math.random().toString(36).slice(2, 6).toUpperCase();
        await userRef.set({ referralCode: code }, { merge: true });

        res.json({ code });
    } catch (error) {
        console.error('Generate referral error:', error);
        res.status(500).json({ error: error.message });
    }
});

app.post('/api/referral/apply', verifyToken, async (req, res) => {
    try {
        const { code } = req.body;
        if (!code) return res.status(400).json({ error: 'Referral code required' });

        const referredUserId = req.user.uid;

        // Find referrer by code
        const referrerSnap = await db.collection('users')
            .where('referralCode', '==', code.toUpperCase())
            .limit(1)
            .get();

        if (referrerSnap.empty) {
            return res.status(404).json({ error: 'Invalid referral code' });
        }

        const referrerDoc = referrerSnap.docs[0];
        if (referrerDoc.id === referredUserId) {
            return res.status(400).json({ error: 'Cannot refer yourself' });
        }

        // Check if already referred
        const existingSnap = await db.collection('referrals')
            .where('referredUserId', '==', referredUserId)
            .limit(1)
            .get();

        if (!existingSnap.empty) {
            return res.json({ success: true, message: 'Referral already applied' });
        }

        // Read config for reward amount
        const configDoc = await db.collection('platformConfig').doc('general').get();
        const config = configDoc.exists ? configDoc.data() : {};
        const rewardAmount = config.referralRewardAmount || 100;

        // Create referral record
        await db.collection('referrals').add({
            referrerUserId: referrerDoc.id,
            referredUserId,
            referralCode: code.toUpperCase(),
            status: 'pending',
            rewardAmount,
            createdAt: admin.firestore.FieldValue.serverTimestamp()
        });

        res.json({ success: true });
    } catch (error) {
        console.error('Apply referral error:', error);
        res.status(500).json({ error: error.message });
    }
});

// --- Profile & Billing Address ---
app.get('/api/profile', verifyToken, async (req, res) => {
    try {
        const userId = req.user.uid;
        const userDoc = await db.collection('users').doc(userId).get();
        const data = userDoc.exists ? userDoc.data() : {};
        res.json({
            name: data.name || '',
            email: data.email || '',
            phoneNumber: data.phoneNumber || req.user.phone_number || '',
            emailVerified: data.emailVerified || false,
            createdAt: data.createdAt || null,
            billingAddress: data.billingAddress || null
        });
    } catch (error) {
        console.error('Get profile error:', error);
        res.status(500).json({ error: error.message });
    }
});

app.put('/api/profile', verifyToken, async (req, res) => {
    try {
        const userId = req.user.uid;
        const { name } = req.body;
        if (!name || !name.trim()) return res.status(400).json({ error: 'Name is required' });
        await db.collection('users').doc(userId).set({ name: name.trim() }, { merge: true });
        res.json({ success: true });
    } catch (error) {
        console.error('Update profile error:', error);
        res.status(500).json({ error: error.message });
    }
});

app.put('/api/profile/billing-address', verifyToken, async (req, res) => {
    try {
        const userId = req.user.uid;
        const { firstName, lastName, email, phone, address1, city, state, postalCode, country } = req.body;
        const required = { firstName, lastName, email, phone, address1, city, state, postalCode, country };
        const missing = Object.entries(required).filter(([, v]) => !v || !v.trim());
        if (missing.length > 0) {
            return res.status(400).json({ error: `Missing fields: ${missing.map(([k]) => k).join(', ')}` });
        }
        await db.collection('users').doc(userId).set({
            billingAddress: { firstName: firstName.trim(), lastName: lastName.trim(), email: email.trim(), phone: phone.trim(), address1: address1.trim(), city: city.trim(), state: state.trim(), postalCode: postalCode.trim(), country: country.trim().toUpperCase() }
        }, { merge: true });
        res.json({ success: true });
    } catch (error) {
        console.error('Update billing address error:', error);
        res.status(500).json({ error: error.message });
    }
});

// --- Referral Stats ---
app.get('/api/referral/stats', verifyToken, async (req, res) => {
    try {
        const userId = req.user.uid;
        const userDoc = await db.collection('users').doc(userId).get();
        const userData = userDoc.exists ? userDoc.data() : {};
        const referralCode = userData.referralCode || null;

        const referralsSnap = await db.collection('referrals')
            .where('referrerUserId', '==', userId)
            .orderBy('createdAt', 'desc')
            .get();

        const referrals = [];
        let totalCompleted = 0;
        let totalCreditsEarned = 0;

        // Collect referred user IDs to batch-fetch names
        const referralDocs = [];
        referralsSnap.forEach(doc => {
            referralDocs.push({ id: doc.id, ...doc.data() });
        });

        // Fetch referred user names in parallel
        const userNameMap = {};
        const uniqueUserIds = [...new Set(referralDocs.map(d => d.referredUserId).filter(Boolean))];
        if (uniqueUserIds.length > 0) {
            const userFetches = uniqueUserIds.map(async (uid) => {
                try {
                    const uDoc = await db.collection('users').doc(uid).get();
                    if (uDoc.exists && uDoc.data().name) {
                        userNameMap[uid] = uDoc.data().name;
                    } else {
                        // Fallback to Firebase Auth display name
                        const authUser = await admin.auth().getUser(uid);
                        userNameMap[uid] = authUser.displayName || 'User';
                    }
                } catch { userNameMap[uid] = 'User'; }
            });
            await Promise.all(userFetches);
        }

        // Check which referred users have made a payment
        const paidUserSet = new Set();
        if (uniqueUserIds.length > 0) {
            const txFetches = uniqueUserIds.map(async (uid) => {
                try {
                    const txSnap = await db.collection('transactions')
                        .where('userId', '==', uid)
                        .where('type', '==', 'purchase')
                        .limit(1)
                        .get();
                    if (!txSnap.empty) paidUserSet.add(uid);
                } catch { /* ignore */ }
            });
            await Promise.all(txFetches);
        }

        for (const d of referralDocs) {
            referrals.push({
                id: d.id || d.__id,
                referredUserName: userNameMap[d.referredUserId] || 'User',
                hasPaid: paidUserSet.has(d.referredUserId),
                status: d.status || 'pending',
                rewardAmount: d.rewardAmount || 0,
                createdAt: d.createdAt ? d.createdAt.toDate().toISOString() : null
            });
            if (d.status === 'completed') {
                totalCompleted++;
                totalCreditsEarned += (d.rewardAmount || 0);
            }
        }

        const configDoc = await db.collection('platformConfig').doc('general').get();
        const config = configDoc.exists ? configDoc.data() : {};

        res.json({
            referralCode,
            totalReferred: referrals.length,
            totalCompleted,
            totalCreditsEarned,
            referrals,
            program: {
                referrerReward: config.referralRewardAmount || 100,
                signupBonus: config.referralBonusAmount || 50
            }
        });
    } catch (error) {
        console.error('Referral stats error:', error);
        res.status(500).json({ error: error.message });
    }
});

// --- Admin Routes ---
const adminRoutes = require('./routes/admin');
app.use('/api/admin', adminRoutes);

app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
});
