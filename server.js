require('dotenv').config({ override: true });
console.log("Starting Server...");
const express = require('express');
const fs = require('fs-extra');
const path = require('path');
const crypto = require('crypto');
const multer = require('multer');
const cron = require('node-cron');
const cookieParser = require('cookie-parser');
const cors = require('cors');

const { sendEmail, EMAIL_FROM } = require('./services/email');
const { buildSite, rebuildSite, rebuildForEdit, prepareForPublish } = require('./services/builder');
const { deploySite, deleteSiteBucket } = require('./services/deploy');
const { uploadDirectory, downloadDirectory, uploadPreview } = require('./services/storage');
const { createOrder, verifyPayment } = require('./services/payments');
const { extractFromUrl } = require('./services/business-extractor');
const { checkAvailability, purchaseDomain, getSuggestions, setupCFDomain, verifyDomainDNS, checkSubdomainAvailability, cleanupCFDomain, listDNSRecords, addDNSRecordGeneric, deleteDNSRecord } = require('./services/domains');
const { generateCode, fixCode, regenerateSection, updateSectionContent, regeneratePage } = require('./services/ai-coder');
const { generateDesign, generatePalette } = require('./services/ai-architect');
const { captureScreenshot } = require('./services/screenshot');
const { getUserCredits, addCredits, deductCredits, getTransactions } = require('./services/credits');

const db = require('./services/db');
const { issueToken, generateOtp, hashOtp, sendOtpEmail, OTP_TTL_SECONDS, OTP_MAX_ATTEMPTS } = require('./services/auth');
const { hub, sseHandler } = require('./services/sse');
const { saveTokenUsage, saveBuildArtifacts, sendBuildNotification, appendProjectLog, retryWithBackoff, ensureProjectSource } = require('./services/build-support');
const { startBuild, runAgentBuildProcess, registerLegacyRunner } = require('./services/build-runner');
const pageService = require('./services/page-service');
const verifyToken = require('./middleware/auth');
const verifyAdmin = require('./middleware/adminAuth');

const app = express();
app.use(cors({ origin: true, credentials: true }));
app.use(express.json());
app.use(cookieParser());

const PORT = process.env.PORT || 3000;

app.get('/api/health', (req, res) => res.json({ ok: true }));

// ------------------------------------------------------------------
// Helpers — DB row → API JSON shape
// ------------------------------------------------------------------

function projectRow(r) {
  if (!r) return null;
  return {
    id: r.id,
    projectId: r.id,
    userId: r.user_id,
    status: r.status,
    query: r.query,
    subdomain: r.subdomain,
    customDomain: r.custom_domain,
    isPublished: !!r.is_published,
    publishedPlan: r.published_plan,
    subscriptionStartDate: r.subscription_start,
    subscriptionExpiryDate: r.subscription_expiry,
    isExpired: !!r.is_expired,
    pages: db.parseJSON(r.pages, []),
    buildProgress: r.build_progress || 0,
    buildProgressMessage: r.build_progress_message,
    logs: db.parseJSON(r.logs, []),
    url: r.url,
    deployUrl: r.deploy_url,
    bucketUrl: r.bucket_url,
    stylePreset: r.style_preset,
    userContext: db.parseJSON(r.user_context, null),
    pipeline: r.pipeline || 'legacy',
    compileState: r.compile_state || 'compiled',
    isFreeBuild: !!r.is_free_build,
    createdAt: r.created_at,
    updatedAt: r.updated_at,
    completedAt: r.completed_at,
  };
}

function userRow(r) {
  if (!r) return null;
  return {
    id: r.id,
    uid: r.id,
    email: r.email,
    name: r.name,
    credits: r.credits || 0,
    isAdmin: !!r.is_admin,
    emailVerified: !!r.email_verified,
    referralCode: r.referral_code,
    setupComplete: !!r.setup_complete,
    preferredLanguage: r.preferred_language || null,
    freeBuildUsed: !!r.free_build_used,
    createdAt: r.created_at,
  };
}

async function findProjectById(id) {
  const r = await db.one('SELECT * FROM projects WHERE id = ?', [id]);
  return projectRow(r);
}

async function findProjectOwned(id, userId) {
  const r = await db.one('SELECT * FROM projects WHERE id = ? AND user_id = ?', [id, userId]);
  return projectRow(r);
}

// ------------------------------------------------------------------
// Analytics (buffered → D1 batched flush every 60s)
// ------------------------------------------------------------------

const analyticsBuffer = new Map();   // projectId -> { pageviews, bandwidth }
const projectOwnerCache = new Map(); // projectId -> userId

function trackPageview(projectId, contentLength, userId) {
  const entry = analyticsBuffer.get(projectId) || { pageviews: 0, bandwidth: 0 };
  entry.pageviews += 1;
  entry.bandwidth += (contentLength || 0);
  analyticsBuffer.set(projectId, entry);
  if (userId) projectOwnerCache.set(projectId, userId);
}

async function flushAnalytics() {
  if (analyticsBuffer.size === 0) return;
  const today = new Date().toISOString().slice(0, 10);
  const entries = Array.from(analyticsBuffer.entries());
  analyticsBuffer.clear();

  const userAgg = new Map();
  for (const [projectId, data] of entries) {
    try {
      await db.transaction([
        {
          sql: `INSERT INTO analytics_totals (project_id, total_pageviews, total_bandwidth, last_updated)
                VALUES (?, ?, ?, datetime('now'))
                ON CONFLICT(project_id) DO UPDATE SET
                  total_pageviews = total_pageviews + excluded.total_pageviews,
                  total_bandwidth = total_bandwidth + excluded.total_bandwidth,
                  last_updated = datetime('now')`,
          params: [projectId, data.pageviews, data.bandwidth],
        },
        {
          sql: `INSERT INTO analytics_daily (project_id, date, pageviews, bandwidth)
                VALUES (?, ?, ?, ?)
                ON CONFLICT(project_id, date) DO UPDATE SET
                  pageviews = pageviews + excluded.pageviews,
                  bandwidth = bandwidth + excluded.bandwidth`,
          params: [projectId, today, data.pageviews, data.bandwidth],
        },
      ]);

      let userId = projectOwnerCache.get(projectId);
      if (!userId) {
        const owner = await db.one('SELECT user_id FROM projects WHERE id = ?', [projectId]);
        if (owner) {
          userId = owner.user_id;
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

  for (const [userId, data] of userAgg) {
    try {
      await db.transaction([
        {
          sql: `INSERT INTO user_stats_totals (user_id, total_pageviews, total_bandwidth, last_updated)
                VALUES (?, ?, ?, datetime('now'))
                ON CONFLICT(user_id) DO UPDATE SET
                  total_pageviews = total_pageviews + excluded.total_pageviews,
                  total_bandwidth = total_bandwidth + excluded.total_bandwidth,
                  last_updated = datetime('now')`,
          params: [userId, data.pageviews, data.bandwidth],
        },
        {
          sql: `INSERT INTO user_stats_daily (user_id, date, pageviews, bandwidth)
                VALUES (?, ?, ?, ?)
                ON CONFLICT(user_id, date) DO UPDATE SET
                  pageviews = pageviews + excluded.pageviews,
                  bandwidth = bandwidth + excluded.bandwidth`,
          params: [userId, today, data.pageviews, data.bandwidth],
        },
      ]);
    } catch (err) {
      console.error(`[Analytics] User stats flush failed for ${userId}:`, err.message);
    }
  }

  console.log(`[Analytics] Flushed ${entries.length} project(s), ${userAgg.size} user(s)`);
}

setInterval(flushAnalytics, 60000);
process.on('SIGTERM', async () => { await flushAnalytics(); process.exit(0); });
process.on('SIGINT', async () => { await flushAnalytics(); process.exit(0); });

// ------------------------------------------------------------------
// Pageview tracking (called by CF Worker site-router)
// ------------------------------------------------------------------

app.post('/api/analytics/pageview', async (req, res) => {
  const { projectId } = req.body;
  if (!projectId) return res.status(400).json({ error: 'Missing projectId' });
  trackPageview(projectId, 0, null);
  res.json({ ok: true });
});

const upload = multer({ dest: path.join(__dirname, 'temp/uploads') });

// ------------------------------------------------------------------
// Protect Static Sites
// ------------------------------------------------------------------

app.use('/sites/:projectId', async (req, res, next) => {
  const { projectId } = req.params;

  try {
    await ensureProjectSource(projectId);
    const publicSitePath = path.join(__dirname, 'public/sites', projectId);
    const sourceDistPath = path.join(__dirname, 'projects_source', projectId, 'dist');
    if (!await fs.pathExists(publicSitePath) && await fs.pathExists(sourceDistPath)) {
      console.log(`[${projectId}] Syncing dist to public/sites for preview...`);
      await fs.copy(sourceDistPath, publicSitePath);
    }
  } catch (err) {
    console.error(`[${projectId}] Failed to ensure site files:`, err);
  }

  try {
    const project = await findProjectById(projectId);
    if (!project) return res.status(404).send('Site not found');

    if (project.isPublished) return next();

    let token = req.cookies?.access_token || req.headers.authorization?.split(' ')[1];
    if (!token && req.query.token) token = req.query.token;

    if (token) {
      try {
        const { verifyToken: verifyJwt } = require('./services/auth');
        const claims = verifyJwt(token);
        if (claims.uid === project.userId) return next();
      } catch (_) { /* invalid token */ }
    }

    return res.status(403).send('Access Denied. This site is not published yet. <a href="/">Go Back</a>');
  } catch (error) {
    console.error('Site protection error:', error);
    return res.status(500).send('Server Error');
  }
});

app.use('/sites', express.static(path.join(__dirname, 'public/sites')));

// ------------------------------------------------------------------
// Dashboard stats
// ------------------------------------------------------------------

app.get('/api/dashboard/stats', verifyToken, async (req, res) => {
  try {
    const userId = req.user.uid;

    const now = new Date();
    const dateKeys = [];
    for (let i = 6; i >= 0; i--) {
      const d = new Date(now);
      d.setDate(d.getDate() - i);
      dateKeys.push(d.toISOString().slice(0, 10));
    }

    const [projects, totals, daily, leadsCount] = await Promise.all([
      db.query('SELECT id, is_published FROM projects WHERE user_id = ?', [userId]),
      db.one('SELECT total_pageviews, total_bandwidth FROM user_stats_totals WHERE user_id = ?', [userId]),
      db.query(
        `SELECT date, pageviews FROM user_stats_daily WHERE user_id = ? AND date IN (${dateKeys.map(() => '?').join(',')})`,
        [userId, ...dateKeys]
      ),
      db.one('SELECT COUNT(*) AS c FROM leads WHERE user_id = ?', [userId]),
    ]);

    const totalSites = projects.length;
    const publishedSites = projects.filter(p => p.is_published).length;
    const totalLeads = leadsCount ? (leadsCount.c || 0) : 0;
    const totalPageviews = totals ? (totals.total_pageviews || 0) : 0;
    const totalBandwidth = totals ? (totals.total_bandwidth || 0) : 0;

    const dailyMap = new Map(daily.map(d => [d.date, d.pageviews]));
    const recentPageviews = dateKeys.map(date => ({ date, pageviews: dailyMap.get(date) || 0 }));

    res.json({ totalSites, publishedSites, totalLeads, totalPageviews, totalBandwidth, recentPageviews });
  } catch (error) {
    console.error('Dashboard stats error:', error);
    res.status(500).json({ error: 'Failed to fetch dashboard stats' });
  }
});

// ------------------------------------------------------------------
// Business extraction
// ------------------------------------------------------------------

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

// ------------------------------------------------------------------
// Submit lead (public)
// ------------------------------------------------------------------

app.post('/api/submit-lead', async (req, res) => {
  const { projectId, formData } = req.body;

  try {
    if (!projectId || !formData) {
      return res.status(400).json({ error: 'Missing projectId or formData' });
    }

    const project = await findProjectById(projectId);
    if (!project) return res.status(404).json({ error: 'Project not found' });

    const userId = project.userId;
    const owner = await db.one('SELECT email, email_verified FROM users WHERE id = ?', [userId]);

    await db.exec(
      `INSERT INTO leads (id, project_id, user_id, form_data) VALUES (?, ?, ?, ?)`,
      [crypto.randomUUID(), projectId, userId, db.J(formData)]
    );

    if (owner && owner.email && owner.email_verified) {
      sendEmail({
        to: owner.email,
        subject: `New Lead for Project ${projectId}`,
        text: `You have a new submission on your website!\n\nDetails:\n${JSON.stringify(formData, null, 2)}`,
        html: `<h3>New Lead Received</h3><p>You have a new submission on your website.</p><pre>${JSON.stringify(formData, null, 2)}</pre>`
      }).catch(err => console.error('Error sending lead email:', err.message));
    }

    res.json({ success: true });
  } catch (error) {
    console.error('Submit lead failed:', error);
    res.status(500).json({ error: error.message });
  }
});

app.get('/api/leads', verifyToken, async (req, res) => {
  try {
    const rows = await db.query(
      `SELECT id, project_id AS projectId, user_id AS userId, form_data, created_at AS createdAt
       FROM leads WHERE user_id = ? ORDER BY created_at DESC`,
      [req.user.uid]
    );
    res.json(rows.map(r => ({ ...r, formData: db.parseJSON(r.form_data, {}), form_data: undefined })));
  } catch (error) {
    console.error('Fetch all leads failed:', error);
    res.status(500).json({ error: error.message });
  }
});

app.get('/api/project/:id/leads', verifyToken, async (req, res) => {
  const { id } = req.params;
  try {
    const project = await findProjectOwned(id, req.user.uid);
    if (!project) return res.status(403).json({ error: 'Unauthorized' });

    const rows = await db.query(
      `SELECT id, project_id AS projectId, user_id AS userId, form_data, created_at AS createdAt
       FROM leads WHERE project_id = ? ORDER BY created_at DESC`,
      [id]
    );
    res.json(rows.map(r => ({ ...r, formData: db.parseJSON(r.form_data, {}), form_data: undefined })));
  } catch (error) {
    console.error('Fetch leads failed:', error);
    res.status(500).json({ error: error.message });
  }
});

// ------------------------------------------------------------------
// Projects
// ------------------------------------------------------------------

app.get('/api/projects', verifyToken, async (req, res) => {
  try {
    const rows = await db.query(
      'SELECT * FROM projects WHERE user_id = ? ORDER BY created_at DESC',
      [req.user.uid]
    );
    res.json(rows.map(projectRow));
  } catch (error) {
    console.error('Error fetching projects:', error);
    res.status(500).json({ error: 'Failed to fetch projects' });
  }
});

app.get('/api/project/:id', verifyToken, async (req, res) => {
  try {
    const project = await findProjectOwned(req.params.id, req.user.uid);
    if (!project) return res.status(404).json({ error: 'Project not found' });
    res.json(project);
  } catch (error) {
    console.error('Error fetching project:', error);
    res.status(500).json({ error: 'Failed to fetch project' });
  }
});

app.get('/api/project/:id/pages', verifyToken, async (req, res) => {
  const { id } = req.params;
  try {
    if (!await ensureProjectSource(id)) return res.status(404).json({ error: 'Project source not found' });
    const distPath = path.join(__dirname, 'projects_source', id, 'dist');
    if (!await fs.pathExists(distPath)) return res.status(404).json({ error: 'Dist folder not found' });

    const files = await fs.readdir(distPath);
    const htmlFiles = files.filter(f => f.endsWith('.html'));
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

// ------------------------------------------------------------------
// Site config
// ------------------------------------------------------------------

app.get('/api/project/:id/site-config', verifyToken, async (req, res) => {
  const { id } = req.params;
  try {
    if (!await ensureProjectSource(id)) return res.status(404).json({ error: 'Project source not found' });
    const distDir = path.join(__dirname, 'projects_source', id, 'dist');
    const configPath = path.join(distDir, 'site-config.json');

    if (await fs.pathExists(configPath)) {
      return res.json(await fs.readJson(configPath));
    }

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
    const config = { businessName: 'Business', logo: hasLogo ? './logo.png' : null, navigation };

    try {
      const indexHtml = await fs.readFile(path.join(distDir, 'index.html'), 'utf-8');
      const titleMatch = indexHtml.match(/<title>(.*?)<\/title>/);
      if (titleMatch) config.businessName = titleMatch[1].split(' - ')[0].trim();
    } catch (_) {}

    await fs.writeFile(configPath, JSON.stringify(config, null, 2));

    const navJsPath = path.join(distDir, 'site-nav.js');
    if (!await fs.pathExists(navJsPath)) {
      const templateNavJs = path.join(__dirname, 'templates/html-skeleton/site-nav.js');
      if (await fs.pathExists(templateNavJs)) await fs.copy(templateNavJs, navJsPath);
    }

    res.json(config);
  } catch (error) {
    console.error('Get site-config failed:', error);
    res.status(500).json({ error: error.message });
  }
});

app.put('/api/project/:id/site-config', verifyToken, async (req, res) => {
  const { id } = req.params;
  try {
    if (!await ensureProjectSource(id)) return res.status(404).json({ error: 'Project source not found' });
    const distDir = path.join(__dirname, 'projects_source', id, 'dist');
    const configPath = path.join(distDir, 'site-config.json');
    const newConfig = req.body;
    await fs.writeFile(configPath, JSON.stringify(newConfig, null, 2));
    const publicConfigPath = path.join(__dirname, 'public/sites', id, 'site-config.json');
    await fs.copy(configPath, publicConfigPath);
    await uploadDirectory(distDir, `projects/${id}/dist`);
    res.json({ success: true, config: newConfig });
  } catch (error) {
    console.error('Update site-config failed:', error);
    res.status(500).json({ error: error.message });
  }
});

app.post('/api/project/:id/pages/add', verifyToken, async (req, res) => {
  const { id } = req.params;
  const { pageName, isSubPage, pagePrompt } = req.body;
  try {
    const result = await pageService.addPage(req.user.uid, id, { pageName, isSubPage, pagePrompt });
    res.json({ success: true, page: result.page, config: result.config, url: result.url });
  } catch (error) {
    console.error('Add page failed:', error);
    res.status(error.statusCode || 500).json({ error: error.message });
  }
});

app.post('/api/project/:id/logo', verifyToken, upload.single('logo'), async (req, res) => {
  const { id } = req.params;
  try {
    if (!req.file) return res.status(400).json({ error: 'No logo file uploaded' });
    if (!await ensureProjectSource(id)) return res.status(404).json({ error: 'Project source not found' });

    const distDir = path.join(__dirname, 'projects_source', id, 'dist');
    const logoDest = path.join(distDir, 'logo.png');
    await fs.copy(req.file.path, logoDest);
    await fs.remove(req.file.path).catch(() => {});

    const configPath = path.join(distDir, 'site-config.json');
    if (await fs.pathExists(configPath)) {
      const config = await fs.readJson(configPath);
      config.logo = './logo.png';
      await fs.writeFile(configPath, JSON.stringify(config, null, 2));
    }

    const distPath = await rebuildForEdit(id);
    const previewUrl = await saveBuildArtifacts(id, distPath, req.user.uid);
    res.json({ success: true, logo: './logo.png', url: previewUrl });
  } catch (error) {
    console.error('Logo upload failed:', error);
    res.status(500).json({ error: error.message });
  }
});

app.post('/api/project/:id/screenshot', verifyToken, async (req, res) => {
  const { id } = req.params;
  try {
    if (!await ensureProjectSource(id)) return res.status(404).json({ error: 'Project source not found' });

    const publicSitePath = path.join(__dirname, 'public/sites', id);
    if (!await fs.pathExists(publicSitePath)) {
      const distPath = path.join(__dirname, 'projects_source', id, 'dist');
      await fs.copy(distPath, publicSitePath);
    }

    const previewPath = path.join(publicSitePath, 'preview.jpg');
    const R2_PUB = process.env.R2_PUBLIC_DOMAIN || 'pub-r2.genweb.in';
    const SITES_BUCKET = process.env.R2_SITES_BUCKET || 'genweb-sites';
    const liveSiteUrl = `https://${R2_PUB}/${SITES_BUCKET}/${id}/index.html`;

    const success = await captureScreenshot(liveSiteUrl, previewPath);
    if (success) {
      const previewUrl = await uploadPreview(previewPath, id);
      await db.exec(`UPDATE projects SET url = ? WHERE id = ?`, [previewUrl, id]);
      res.json({ success: true, url: previewUrl });
    } else {
      res.status(500).json({ error: 'Screenshot generation failed' });
    }
  } catch (error) {
    console.error('Screenshot endpoint failed:', error);
    res.status(500).json({ error: error.message });
  }
});

app.get('/api/project/:id/theme', verifyToken, async (req, res) => {
  const { id } = req.params;
  try {
    if (!await ensureProjectSource(id)) return res.status(404).json({ error: 'Project source not found' });
    const configPath = path.join(__dirname, 'projects_source', id, 'tailwind.config.js');
    if (!await fs.pathExists(configPath)) return res.status(404).json({ error: 'Project configuration not found' });
    const configContent = await fs.readFile(configPath, 'utf-8');
    const colors = {};
    const keys = ['primary', 'secondary', 'accent', 'background', 'text', 'buttonBackground', 'buttonText'];
    keys.forEach(key => {
      const match = configContent.match(new RegExp(`["']?${key}["']?:\\s*["']([^"']+)["']`));
      if (match) colors[key] = match[1];
    });
    res.json({ colors });
  } catch (error) {
    console.error('Get theme failed:', error);
    res.status(500).json({ error: error.message });
  }
});

app.post('/api/project/:id/theme/regenerate', verifyToken, async (req, res) => {
  const { id } = req.params;
  try {
    if (!await ensureProjectSource(id)) return res.status(404).json({ error: 'Project source not found' });

    const proj = await findProjectById(id);
    const context = (proj && proj.query) || 'Modern Business';

    const paletteResult = await retryWithBackoff(() => generatePalette(context));
    if (paletteResult.usage) await saveTokenUsage([{ ...paletteResult.usage, service: 'architect', action: 'generatePalette' }], id, req.user.uid);
    res.json({ colors: paletteResult.palette });
  } catch (error) {
    console.error('Regenerate theme failed:', error);
    const status = error.statusCode || 500;
    res.status(status).json({ error: error.message });
  }
});

app.post('/api/project/:id/section', verifyToken, async (req, res) => {
  const { id } = req.params;
  const { sectionId, instruction, page } = req.body;
  try {
    const result = await pageService.redesignSection(req.user.uid, id, { sectionId, instruction, page });
    res.json({ success: true, url: result.url });
  } catch (error) {
    console.error('Update failed:', error);
    res.status(error.statusCode || 500).json({ error: error.message });
  }
});

app.post('/api/project/:id/regenerate-page', verifyToken, async (req, res) => {
  const { id } = req.params;
  const { instruction, page } = req.body;
  try {
    if (!await ensureProjectSource(id)) return res.status(404).json({ error: 'Project source not found' });

    try {
      await deductCredits(req.user.uid, 100, `Regenerate page for project ${id}`);
    } catch (_) {
      return res.status(402).json({ error: 'Insufficient credits for AI regeneration.' });
    }

    const distDir = path.join(__dirname, 'projects_source', id, 'dist');
    const targetFile = page || 'index.html';
    const sourcePath = path.join(distDir, targetFile);
    if (!await fs.pathExists(sourcePath)) return res.status(404).json({ error: `Page ${targetFile} not found` });

    const currentCode = await fs.readFile(sourcePath, 'utf-8');
    console.log(`Regenerating page '${targetFile}' for project ${id}...`);
    const pageResult = await retryWithBackoff(() => regeneratePage(currentCode, instruction));
    if (pageResult.usage) await saveTokenUsage([{ ...pageResult.usage, service: 'coder', action: 'regeneratePage' }], id, req.user.uid);

    await fs.writeFile(sourcePath + '.bak', currentCode);
    await fs.writeFile(sourcePath, pageResult.code);

    const distPath = await rebuildForEdit(id);
    const previewUrl = await saveBuildArtifacts(id, distPath, req.user.uid);
    res.json({ success: true, url: previewUrl });
  } catch (error) {
    console.error('Page regeneration failed:', error);
    const status = error.statusCode || 500;
    res.status(status).json({ error: error.message });
  }
});

app.post('/api/project/:id/content', verifyToken, async (req, res) => {
  const { id } = req.params;
  const { sectionId, type, originalValue, newValue, page } = req.body;
  try {
    if (!await ensureProjectSource(id)) return res.status(404).json({ error: 'Project source not found' });

    const distDir = path.join(__dirname, 'projects_source', id, 'dist');
    let targetFile = 'index.html';
    if (page) {
      targetFile = page;
    } else {
      try {
        const files = await fs.readdir(distDir);
        const htmlFiles = files.filter(f => f.endsWith('.html'));
        for (const file of htmlFiles) {
          const content = await fs.readFile(path.join(distDir, file), 'utf-8');
          if (content.includes(`data-section="${sectionId}"`)) { targetFile = file; break; }
        }
      } catch (e) {
        console.warn(`[AutoDiscovery] Failed: ${e.message}`);
      }
    }

    const sourcePath = path.join(distDir, targetFile);
    if (!await fs.pathExists(sourcePath)) return res.status(404).json({ error: `Page ${targetFile} not found` });

    const currentCode = await fs.readFile(sourcePath, 'utf-8');
    const newCode = await updateSectionContent(currentCode, sectionId, type, originalValue, newValue);
    await fs.writeFile(sourcePath + '.bak', currentCode);
    await fs.writeFile(sourcePath, newCode);

    const distPath = await rebuildForEdit(id);
    const previewUrl = await saveBuildArtifacts(id, distPath, req.user.uid);
    res.json({ success: true, url: previewUrl });
  } catch (error) {
    console.error('Content update failed:', error);
    res.status(500).json({ error: error.message });
  }
});

app.post('/api/project/:id/undo', verifyToken, async (req, res) => {
  const { id } = req.params;
  try {
    if (!await ensureProjectSource(id)) return res.status(404).json({ error: 'Project source not found' });
    const sourcePath = path.join(__dirname, 'projects_source', id, 'dist/index.html');
    const backupPath = sourcePath + '.bak';
    if (!await fs.pathExists(backupPath)) return res.status(400).json({ error: 'No undo available' });
    await fs.copy(backupPath, sourcePath);
    const distPath = await rebuildForEdit(id);
    const previewUrl = await saveBuildArtifacts(id, distPath, req.user.uid);
    res.json({ success: true, url: previewUrl });
  } catch (error) {
    console.error('Undo failed:', error);
    res.status(500).json({ error: error.message });
  }
});

app.post('/api/project/:id/upload', verifyToken, upload.single('file'), async (req, res) => {
  const { id } = req.params;
  const file = req.file;
  if (!file) return res.status(400).json({ error: 'No file uploaded' });
  try {
    if (!await ensureProjectSource(id)) return res.status(404).json({ error: 'Project source not found' });
    const assetsDir = path.join(__dirname, 'projects_source', id, 'dist/assets');
    await fs.ensureDir(assetsDir);
    const ext = path.extname(file.originalname);
    const filename = `${Date.now()}${ext}`;
    const destPath = path.join(assetsDir, filename);
    await fs.move(file.path, destPath);
    res.json({ url: `./assets/${filename}` });
  } catch (error) {
    console.error('Upload failed:', error);
    res.status(500).json({ error: error.message });
  }
});

app.post('/api/project/:id/theme', verifyToken, async (req, res) => {
  const { id } = req.params;
  const { colors } = req.body;
  try {
    if (!await ensureProjectSource(id)) return res.status(404).json({ error: 'Project source not found' });
    const configPath = path.join(__dirname, 'projects_source', id, 'tailwind.config.js');
    if (!await fs.pathExists(configPath)) return res.status(404).json({ error: 'Project configuration not found' });

    let configContent = await fs.readFile(configPath, 'utf-8');
    Object.entries(colors).forEach(([key, value]) => {
      const regex = new RegExp(`(["']?)${key}\\1:\\s*["'][^"']*["']`, 'g');
      configContent = configContent.replace(regex, `$1${key}$1: "${value}"`);
    });
    await fs.writeFile(configPath, configContent);

    const distPath = await rebuildForEdit(id);
    const previewUrl = await saveBuildArtifacts(id, distPath, req.user.uid);
    res.json({ success: true, url: previewUrl });
  } catch (error) {
    console.error('Theme update failed:', error);
    res.status(500).json({ error: error.message });
  }
});

app.post('/api/extract', verifyToken, async (req, res) => {
  const { query } = req.body;
  try {
    if (!query) return res.status(400).json({ error: 'Query is required' });
    const extractResult = await extractFromUrl(query);
    if (extractResult.usageLog) await saveTokenUsage(extractResult.usageLog.map(u => ({ ...u, service: 'extractor' })), null, req.user.uid);
    res.json({ success: true, data: extractResult.data });
  } catch (error) {
    console.error('Extraction failed:', error);
    res.status(500).json({ error: error.message });
  }
});

// ------------------------------------------------------------------
// Build
// ------------------------------------------------------------------

app.post('/api/build', verifyToken, upload.single('logo'), async (req, res) => {
  let { userContext, businessUrl, businessQuery, pages, stylePreset } = req.body;
  const logoFile = req.file;

  let parsedPages = ['Home'];
  if (pages) {
    try { parsedPages = typeof pages === 'string' ? JSON.parse(pages) : pages; } catch (_) {}
  }

  const query = businessQuery || businessUrl;

  try {
    if (!userContext && query) {
      console.log(`Extracting info for query: "${query}"...`);
      const extractResult = await extractFromUrl(query);
      userContext = extractResult.data;
      if (extractResult.usageLog) await saveTokenUsage(extractResult.usageLog.map(u => ({ ...u, service: 'extractor' })), null, req.user.uid);
    }
    if (!userContext) return res.status(400).json({ error: 'userContext or businessQuery is required' });

    // Engine override is admin-only (used for staged rollout testing).
    const engineOverride = req.user.is_admin && req.headers['x-build-engine'] ? req.headers['x-build-engine'] : null;

    const { id, cost, isFree } = await startBuild(req.user.uid, {
      userContext, pages: parsedPages, logoFile, stylePreset, query, source: 'api', engineOverride,
    });

    res.json({ success: true, id, status: 'processing', cost, isFree, message: 'Build started in background.' });
  } catch (error) {
    console.error('Build init failed:', error);
    res.status(error.statusCode || 500).json({ error: error.message });
  }
});

app.post('/api/project/:id/retry', verifyToken, async (req, res) => {
  const { id } = req.params;
  try {
    const project = await findProjectOwned(id, req.user.uid);
    if (!project) return res.status(404).json({ error: 'Project not found' });
    if (project.status !== 'failed') return res.status(400).json({ error: 'Project is not in failed state' });

    await db.exec(
      `UPDATE projects SET status = 'starting', build_progress = 0, build_progress_message = 'Starting...' WHERE id = ?`,
      [id]
    );

    // Retry on the engine that built the project — semantics stay consistent per
    // project. isFree carries through so a successful retry of the free first
    // build still consumes the entitlement.
    if (project.pipeline === 'agent') {
      runAgentBuildProcess(id, project.userContext, null, project.pages || ['Home'], req.user.uid, 0, project.query, { isFree: project.isFreeBuild })
        .catch(err => console.error(`Retry agent build ${id} failed:`, err));
    } else {
      runBuildProcess(id, project.userContext, null, project.pages || ['Home'], req.user.uid, 0, project.query, project.stylePreset)
        .catch(err => console.error(`Retry build ${id} failed:`, err));
    }

    res.json({ success: true, message: 'Build retry started.' });
  } catch (error) {
    console.error('Retry failed:', error);
    res.status(500).json({ error: error.message });
  }
});

// Resync a completed project's build artifacts from genweb-projects to genweb-sites
// so the public preview URL works. Idempotent — safe to call multiple times.
app.post('/api/project/:id/resync-preview', verifyToken, async (req, res) => {
  const { id } = req.params;
  try {
    const project = await findProjectOwned(id, req.user.uid);
    if (!project) return res.status(404).json({ error: 'Project not found' });
    if (project.status !== 'completed') return res.status(400).json({ error: 'Project is not completed' });

    const { S3Client, ListObjectsV2Command, CopyObjectCommand } = require('@aws-sdk/client-s3');
    const SOURCE_BUCKET = process.env.R2_BUCKET_NAME || 'genweb-projects';
    const DEST_BUCKET = process.env.R2_SITES_BUCKET || 'genweb-sites';
    const R2_PUB = process.env.R2_PUBLIC_DOMAIN || 'pub-r2.genweb.in';

    const s3 = new S3Client({
      region: 'auto',
      endpoint: `https://${process.env.CF_ACCOUNT_ID}.r2.cloudflarestorage.com`,
      credentials: { accessKeyId: process.env.R2_ACCESS_KEY_ID, secretAccessKey: process.env.R2_SECRET_ACCESS_KEY },
    });

    const sourcePrefix = `projects/${id}/dist/`;
    let continuationToken, total = 0;
    do {
      const listed = await s3.send(new ListObjectsV2Command({ Bucket: SOURCE_BUCKET, Prefix: sourcePrefix, ContinuationToken: continuationToken }));
      for (const obj of (listed.Contents || [])) {
        const destKey = `${id}/${obj.Key.slice(sourcePrefix.length)}`;
        await s3.send(new CopyObjectCommand({
          Bucket: DEST_BUCKET,
          Key: destKey,
          CopySource: `/${SOURCE_BUCKET}/${encodeURIComponent(obj.Key).replace(/%2F/g, '/')}`,
        }));
        total++;
      }
      continuationToken = listed.IsTruncated ? listed.NextContinuationToken : undefined;
    } while (continuationToken);

    if (total === 0) return res.status(404).json({ error: 'No source artifacts found in genweb-projects' });

    const publicUrl = `https://${R2_PUB}/${DEST_BUCKET}/${id}/index.html`;
    await db.exec(`UPDATE projects SET url = ?, deploy_url = ?, updated_at = datetime('now') WHERE id = ?`, [publicUrl, publicUrl, id]);

    res.json({ success: true, copied: total, url: publicUrl });
  } catch (error) {
    console.error('Resync preview failed:', error);
    res.status(500).json({ error: error.message });
  }
});

async function runBuildProcess(id, userContext, logoFile, parsedPages, userId, cost, query, stylePreset) {
  console.log(`[${id}] Starting background build process...`);

  const logProgress = async (message, progress = null) => {
    console.log(`[${id}] Progress: ${message}${progress !== null ? ` (${progress}%)` : ''}`);
    try {
      const row = await db.one('SELECT logs FROM projects WHERE id = ?', [id]);
      const logs = row ? db.parseJSON(row.logs, []) : [];
      logs.push({ message, timestamp: new Date().toISOString() });
      if (progress !== null) {
        await db.exec(
          `UPDATE projects SET status = 'processing', logs = ?, build_progress = ?, build_progress_message = ? WHERE id = ?`,
          [db.J(logs), progress, message.replace(`[${id}] `, ''), id]
        );
      } else {
        await db.exec(
          `UPDATE projects SET status = 'processing', logs = ? WHERE id = ?`,
          [db.J(logs), id]
        );
      }
      hub.emit(userId, 'project:progress', { projectId: id, progress, message });
    } catch (e) {
      console.warn(`[${id}] Failed to update log:`, e.message);
    }
  };

  try {
    await logProgress('Starting build engine...', 5);

    const totalPages = parsedPages.length;
    const wrappedProgress = async (message) => {
      const msg = message.replace(`[${id}] `, '');
      let pct = null;
      if (msg.includes('Generating Design')) pct = 10;
      else if (msg.includes('Fetching Images')) pct = 20;
      else if (msg.includes('Copying skeleton')) pct = 25;
      else if (msg.includes('Generating') && msg.includes('pages')) pct = 30;
      else if (msg.includes('Generating Home') || (msg.includes('Generating') && !msg.includes('remaining'))) {
        const pageMatch = msg.match(/Generating (.+?)\.\.\./);
        if (pageMatch) {
          const pageIndex = parsedPages.indexOf(pageMatch[1]);
          pct = pageIndex >= 0 ? 30 + Math.round((pageIndex / totalPages) * 40) : 50;
        }
      } else if (msg.includes('remaining pages')) pct = 45;
      else if (msg.includes('Injecting configuration')) pct = 75;
      await logProgress(message, pct);
    };

    const buildResult = await buildSite(id, userContext, logoFile, parsedPages, wrappedProgress, stylePreset);
    const distPath = buildResult.distDir;
    if (buildResult.tokenUsageLog) await saveTokenUsage(buildResult.tokenUsageLog, id, userId);

    await logProgress('Build success! Saving & Deploying...', 80);

    const sourcePath = path.join(__dirname, 'projects_source', id);
    const tempPath = path.join(__dirname, 'temp', id);
    await fs.move(tempPath, sourcePath);
    await logProgress('Source code saved.', 85);

    await logProgress('Saving to Cloud Storage...', 90);
    const savedUrl = await saveBuildArtifacts(id, path.join(sourcePath, 'dist'), userId);

    try {
      await deductCredits(userId, cost, `Generate ${parsedPages.length > 1 ? 'Multi-Page' : 'Single-Page'} Site (${id})`);
      await logProgress('Credits deducted.', 95);
    } catch (creditErr) {
      console.error(`[${id}] Failed to deduct credits after success:`, creditErr);
    }

    const row = await db.one('SELECT logs FROM projects WHERE id = ?', [id]);
    const logs = row ? db.parseJSON(row.logs, []) : [];
    logs.push({ message: 'Process Finished Successfully.', timestamp: new Date().toISOString() });
    await db.exec(
      `UPDATE projects SET status = 'completed', is_published = 0, url = ?, completed_at = datetime('now'), logs = ? WHERE id = ?`,
      [savedUrl, db.J(logs), id]
    );

    hub.emit(userId, 'project:updated', { projectId: id, status: 'completed' });
    console.log(`[${id}] Process Finished Successfully.`);

    sendBuildNotification(userId, id, query, 'success').catch(err =>
      console.error(`[${id}] Failed to send success email:`, err.message)
    );
  } catch (error) {
    console.error(`[${id}] Build Process Failed:`, error);
    const isRateLimited = error.message === 'RATE_LIMITED';
    const userError = isRateLimited
      ? 'We are currently experiencing high demand. Please retry after a few minutes.'
      : error.message;

    try {
      const row = await db.one('SELECT logs FROM projects WHERE id = ?', [id]);
      const logs = row ? db.parseJSON(row.logs, []) : [];
      logs.push({ message: `Error: ${userError}`, timestamp: new Date().toISOString() });
      await db.exec(
        `UPDATE projects SET status = 'failed', build_progress_message = ?, logs = ? WHERE id = ?`,
        [userError, db.J(logs), id]
      );
      hub.emit(userId, 'project:updated', { projectId: id, status: 'failed', error: userError });
    } catch (_) {}

    sendBuildNotification(userId, id, query, 'failed', userError).catch(err =>
      console.error(`[${id}] Failed to send failure email:`, err.message)
    );

    try {
      const tempPath = path.join(__dirname, 'temp', id);
      if (await fs.pathExists(tempPath)) await fs.remove(tempPath);
    } catch (_) {}
  }
}

// ------------------------------------------------------------------
// Payments (Razorpay)
// ------------------------------------------------------------------

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
  if (isValid) res.json({ success: true });
  else res.status(400).json({ success: false, error: 'Invalid Signature' });
});

// ------------------------------------------------------------------
// Credits
// ------------------------------------------------------------------

app.get('/api/credits', verifyToken, async (req, res) => {
  try {
    const credits = await getUserCredits(req.user.uid);
    res.json({ credits });
  } catch (error) { res.status(500).json({ error: error.message }); }
});

app.get('/api/credits/history', verifyToken, async (req, res) => {
  try {
    res.json(await getTransactions(req.user.uid));
  } catch (error) { res.status(500).json({ error: error.message }); }
});

app.post('/api/credits/buy', verifyToken, async (req, res) => {
  const { amount, credits } = req.body;
  try {
    const order = await createOrder(amount * 100, 'INR');
    res.json({ order, credits });
  } catch (error) { res.status(500).json({ error: error.message }); }
});

app.post('/api/credits/verify', verifyToken, async (req, res) => {
  const { orderId, paymentId, signature, credits, amount } = req.body;
  try {
    const isValid = verifyPayment(orderId, paymentId, signature);
    if (!isValid) return res.status(400).json({ success: false, error: 'Invalid Signature' });

    await addCredits(req.user.uid, parseInt(credits), `Purchased ${credits} credits for ₹${amount}`, paymentId);

    try {
      const referral = await db.one(
        `SELECT id, referrer_user_id, reward_amount FROM referrals
         WHERE referred_user_id = ? AND status = 'pending' LIMIT 1`,
        [req.user.uid]
      );
      if (referral) {
        await addCredits(referral.referrer_user_id, referral.reward_amount, 'Referral reward - referred user made a purchase');
        await db.exec(
          `UPDATE referrals SET status = 'completed', completed_at = datetime('now') WHERE id = ?`,
          [referral.id]
        );
        console.log(`[Referral] Completed referral ${referral.id}`);
      }
    } catch (refErr) {
      console.error('[Referral] Failed to process referral reward:', refErr.message);
    }

    res.json({ success: true, message: 'Credits added successfully' });
  } catch (error) {
    console.error('Credit verification failed:', error);
    res.status(500).json({ error: error.message });
  }
});

// ------------------------------------------------------------------
// Publish
// ------------------------------------------------------------------

app.post('/api/project/:id/publish', verifyToken, async (req, res) => {
  const { id } = req.params;
  const { plan, subdomain, years = 1 } = req.body;
  const COSTS = { basic: 500, single: 2000, multi: 3000 };
  const cost = COSTS[plan];
  if (!cost) return res.status(400).json({ error: 'Invalid plan' });

  const duration = [1, 2, 3].includes(parseInt(years)) ? parseInt(years) : 1;
  let totalCost = cost * duration;
  if (duration === 2) totalCost *= 0.95;
  if (duration === 3) totalCost *= 0.90;
  totalCost = Math.round(totalCost);

  try {
    if (!await ensureProjectSource(id)) return res.status(404).json({ error: 'Project source not found' });
    const distPath = path.join(__dirname, 'projects_source', id, 'dist');
    if (!await fs.pathExists(distPath)) {
      return res.status(404).json({ error: 'Build artifacts (dist folder) not found. Please rebuild the project.' });
    }

    const project = await findProjectOwned(id, req.user.uid);
    if (!project) return res.status(403).json({ error: 'Project not found or unauthorized' });

    let finalSubdomain = project.subdomain;
    if (subdomain) {
      const cleanName = subdomain.toLowerCase();
      if (cleanName !== finalSubdomain) {
        const availability = await checkSubdomainAvailability(cleanName);
        if (!availability.available) {
          const existing = await db.one('SELECT id FROM projects WHERE subdomain = ?', [cleanName]);
          if (existing && existing.id !== id) {
            return res.status(409).json({ error: availability.error });
          }
        }
        finalSubdomain = cleanName;
        await db.exec('UPDATE projects SET subdomain = ? WHERE id = ?', [finalSubdomain, id]);
      }
    }

    await deductCredits(req.user.uid, totalCost, `Unlock/Renew ${plan} plan for project ${id} (${duration} years)`);

    const nowIso = new Date().toISOString();
    let startDate = project.subscriptionStartDate || nowIso;
    let expiryDate;
    const currentExpiry = project.subscriptionExpiryDate ? new Date(project.subscriptionExpiryDate) : null;
    const isCurrentlyActive = currentExpiry && currentExpiry.getTime() > Date.now() && !project.isExpired;

    if (isCurrentlyActive) {
      currentExpiry.setFullYear(currentExpiry.getFullYear() + duration);
      expiryDate = currentExpiry.toISOString();
    } else {
      const e = new Date();
      e.setFullYear(e.getFullYear() + duration);
      expiryDate = e.toISOString();
      startDate = nowIso;
    }

    // Draft sites carry the runtime Tailwind script; live customer sites must
    // ship compiled static CSS. Compile + strip runtime before deploying.
    if (project.compileState === 'runtime') {
      console.log(`[${id}] Compiling draft CSS for publish...`);
      await prepareForPublish(id);
    }

    console.log(`Publishing project ${id} (Subdomain: ${finalSubdomain})...`);
    const deployResult = await deploySite(distPath, id);

    const publicUrl = `https://${finalSubdomain}.genweb.in`;

    await db.exec(
      `UPDATE projects SET
         published_plan = ?, is_published = 1, is_expired = 0,
         subscription_start = ?, subscription_expiry = ?,
         deploy_url = ?, bucket_url = ?,
         updated_at = datetime('now')
       WHERE id = ?`,
      [plan, startDate, expiryDate, publicUrl, deployResult.url, id]
    );

    hub.emit(req.user.uid, 'project:updated', { projectId: id, isPublished: true });
    res.json({ success: true, url: publicUrl, expiry: expiryDate });
  } catch (error) {
    if (error.message === 'Insufficient credits') {
      return res.status(402).json({ error: 'Insufficient credits' });
    }
    console.error('Publish unlock/deploy failed:', error);
    res.status(500).json({ error: error.message });
  }
});

// ------------------------------------------------------------------
// Domains
// ------------------------------------------------------------------

app.get('/api/domains/check', verifyToken, async (req, res) => {
  const { domain } = req.query;
  if (!domain) return res.status(400).json({ error: 'Domain is required' });
  try { res.json(await checkAvailability(domain)); }
  catch (error) { res.status(500).json({ error: error.message }); }
});

app.get('/api/domains/suggest', verifyToken, async (req, res) => {
  const { query } = req.query;
  if (!query) return res.status(400).json({ error: 'Query is required' });
  try { res.json(await getSuggestions(query)); }
  catch (error) { res.status(500).json({ error: error.message }); }
});

app.get('/api/domains', verifyToken, async (req, res) => {
  try {
    const rows = await db.query(
      `SELECT domain, user_id AS userId, order_id AS orderId, provider, status,
              auto_renew AS autoRenew, lb_status AS lbStatus, ip, created_at AS createdAt
       FROM domains WHERE user_id = ? ORDER BY created_at DESC`,
      [req.user.uid]
    );
    res.json(rows.map(r => ({ ...r, lbStatus: db.parseJSON(r.lbStatus, null) })));
  } catch (error) {
    console.error('Fetch domains failed:', error);
    res.status(500).json({ error: error.message });
  }
});

app.get('/api/domains/:domain/dns', verifyToken, async (req, res) => {
  const { domain } = req.params;
  try {
    const own = await db.one('SELECT 1 FROM domains WHERE domain = ? AND user_id = ?', [domain, req.user.uid]);
    if (!own) return res.status(403).json({ error: 'Unauthorized: Domain not found in your account.' });
    res.json(await listDNSRecords(domain));
  } catch (error) {
    console.error(`List DNS failed for ${domain}:`, error);
    res.status(500).json({ error: error.message });
  }
});

app.post('/api/domains/:domain/dns', verifyToken, async (req, res) => {
  const { domain } = req.params;
  const { type, host, value, ttl, distance } = req.body;
  if (!type || !value) return res.status(400).json({ error: 'Type and Value are required.' });
  try {
    const own = await db.one('SELECT 1 FROM domains WHERE domain = ? AND user_id = ?', [domain, req.user.uid]);
    if (!own) return res.status(403).json({ error: 'Unauthorized' });
    res.json(await addDNSRecordGeneric(domain, { type, host, value, ttl, distance }));
  } catch (error) {
    console.error(`Add DNS failed for ${domain}:`, error);
    res.status(500).json({ error: error.message });
  }
});

app.delete('/api/domains/:domain/dns/:rrid', verifyToken, async (req, res) => {
  const { domain, rrid } = req.params;
  try {
    const own = await db.one('SELECT 1 FROM domains WHERE domain = ? AND user_id = ?', [domain, req.user.uid]);
    if (!own) return res.status(403).json({ error: 'Unauthorized' });
    await deleteDNSRecord(domain, rrid);
    res.json({ success: true });
  } catch (error) {
    console.error(`Delete DNS failed for ${domain}:`, error);
    res.status(500).json({ error: error.message });
  }
});

app.post('/api/domains/buy', verifyToken, async (req, res) => {
  const { domain, contactInfo, projectId } = req.body;
  if (!domain || !contactInfo) return res.status(400).json({ error: 'Domain and contactInfo are required' });
  const ip = req.headers['x-forwarded-for'] || req.socket.remoteAddress;

  try {
    const details = { ip, contact: contactInfo };
    const result = await purchaseDomain(domain, details);

    let cfStatus = null;
    try {
      if (projectId) cfStatus = await setupCFDomain(domain, projectId, true);
    } catch (cfError) {
      console.error('Auto-CF setup failed during purchase:', cfError);
      cfStatus = { status: 'SETUP_FAILED', error: cfError.message };
    }

    await db.exec(
      `INSERT INTO domains (domain, user_id, order_id, provider, status, auto_renew, lb_status, ip)
       VALUES (?, ?, ?, 'namesilo', 'active', 1, ?, ?)`,
      [domain, req.user.uid, result.orderId || 'unknown', db.J(cfStatus), cfStatus?.ip || null]
    );

    res.json({ success: true, order: result, lbStatus: cfStatus });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.get('/api/subdomain/check', verifyToken, async (req, res) => {
  const { name } = req.query;
  if (!name) return res.status(400).json({ error: 'Name is required' });
  try { res.json(await checkSubdomainAvailability(name.toLowerCase())); }
  catch (error) { res.status(500).json({ error: error.message }); }
});

app.post('/api/project/:id/subdomain', verifyToken, async (req, res) => {
  const { id } = req.params;
  const { subdomain } = req.body;
  if (!subdomain) return res.status(400).json({ error: 'Subdomain is required' });
  const cleanName = subdomain.toLowerCase();

  try {
    const availability = await checkSubdomainAvailability(cleanName);
    if (!availability.available) {
      const existing = await db.one('SELECT id FROM projects WHERE subdomain = ?', [cleanName]);
      if (existing && existing.id === id) return res.json({ success: true, subdomain: cleanName });
      return res.status(409).json({ error: availability.error });
    }

    const project = await findProjectOwned(id, req.user.uid);
    if (!project) return res.status(403).json({ error: 'Project not found or unauthorized' });

    await db.exec(
      `UPDATE projects SET subdomain = ?, updated_at = datetime('now') WHERE id = ?`,
      [cleanName, id]
    );
    res.json({ success: true, subdomain: cleanName });
  } catch (error) {
    console.error('Update subdomain failed:', error);
    res.status(500).json({ error: error.message });
  }
});

app.delete('/api/projects/:id', verifyToken, async (req, res) => {
  const { id } = req.params;
  try {
    const project = await findProjectOwned(id, req.user.uid);
    if (!project) return res.status(404).json({ error: 'Project not found or unauthorized' });

    console.log(`[Delete Project] Starting deletion for ${id}...`);

    if (project.customDomain) {
      try { await cleanupCFDomain(project.customDomain, id); }
      catch (err) { console.warn(`[Delete Project] Failed to clean up custom domain:`, err.message); }
    }
    try { await deleteSiteBucket(id); }
    catch (err) { console.warn(`[Delete Project] Failed to delete storage bucket:`, err.message); }

    await db.transaction([
      { sql: 'DELETE FROM leads WHERE project_id = ?', params: [id] },
      { sql: 'DELETE FROM projects WHERE id = ?', params: [id] },
    ]);

    hub.emit(req.user.uid, 'project:updated', { projectId: id, deleted: true });
    res.json({ success: true, message: 'Project deleted' });
  } catch (error) {
    console.error('[Delete Project] Error:', error);
    res.status(500).json({ error: 'Failed to delete project: ' + error.message });
  }
});

app.get('/api/domains/verify-setup', verifyToken, async (req, res) => {
  const { domain } = req.query;
  if (!domain) return res.status(400).json({ error: 'Domain is required' });
  try { res.json(await verifyDomainDNS(domain)); }
  catch (error) { res.status(500).json({ error: error.message }); }
});

app.post('/api/project/:id/domain', verifyToken, async (req, res) => {
  const { id } = req.params;
  const { domain } = req.body;
  if (!domain) return res.status(400).json({ error: 'Domain is required' });
  const cleanDomain = domain.toLowerCase().trim();

  try {
    const dup = await db.one('SELECT id FROM projects WHERE custom_domain = ?', [cleanDomain]);
    if (dup) {
      if (dup.id === id) return res.json({ success: true, message: 'Domain already assigned.' });
      return res.status(409).json({ error: 'Domain already connected to another site.' });
    }

    const project = await findProjectOwned(id, req.user.uid);
    if (!project) return res.status(403).json({ error: 'Project not found or unauthorized' });

    let isManaged = false;
    const domainRec = await db.one(
      'SELECT provider FROM domains WHERE domain = ? AND user_id = ?',
      [cleanDomain, req.user.uid]
    );
    if (domainRec && domainRec.provider === 'namesilo') isManaged = true;

    const cfResult = await setupCFDomain(cleanDomain, id, isManaged);

    await db.exec(
      `UPDATE projects SET custom_domain = ?, updated_at = datetime('now') WHERE id = ?`,
      [cleanDomain, id]
    );

    res.json({
      success: true,
      domain: cleanDomain,
      ip: cfResult.ip,
      message: cfResult.message,
      managed: isManaged,
    });
  } catch (error) {
    console.error('Assign domain failed:', error);
    res.status(500).json({ error: error.message });
  }
});

app.post('/api/domains/claim', verifyToken, async (req, res) => {
  const { domain, projectId, contact } = req.body;
  if (!domain || !projectId) return res.status(400).json({ error: 'Domain and Project ID are required' });
  if (!contact || !contact.nameFirst || !contact.nameLast || !contact.email || !contact.phone || !contact.address1 || !contact.city || !contact.state || !contact.postalCode || !contact.country) {
    return res.status(400).json({ error: 'Incomplete contact details provided for domain registration.' });
  }
  const cleanDomain = domain.toLowerCase().trim();
  if (!cleanDomain.endsWith('.in') && !cleanDomain.endsWith('.com')) {
    return res.status(400).json({ error: 'Only .in and .com domains are allowed for free claim.' });
  }

  try {
    const project = await findProjectOwned(projectId, req.user.uid);
    if (!project) return res.status(403).json({ error: 'Project not found or unauthorized' });

    const availability = await checkAvailability(cleanDomain);
    if (!availability.available) return res.status(400).json({ error: 'Domain is not available.' });
    const priceINR = availability.priceDisplay ? availability.priceDisplay.amount : 9999;
    if (priceINR > 1000) return res.status(400).json({ error: `Domain price (₹${priceINR}) exceeds the free claim limit of ₹1000.` });

    const contactInfo = {
      nameFirst: contact.nameFirst, nameLast: contact.nameLast, email: contact.email, phone: contact.phone,
      addressMailing: { address1: contact.address1, city: contact.city, state: contact.state, postalCode: contact.postalCode, country: contact.country }
    };

    const purchaseResult = await purchaseDomain(cleanDomain, { contact: contactInfo });

    let cfResult = { status: 'PENDING' };
    try { cfResult = await setupCFDomain(cleanDomain, projectId, true); }
    catch (e) { console.error('Post-claim setup failed:', e); }

    await db.exec(
      `INSERT INTO domains (domain, user_id, order_id, provider, status, auto_renew, lb_status, ip)
       VALUES (?, ?, ?, 'namesilo', 'active', 1, ?, ?)`,
      [cleanDomain, req.user.uid, purchaseResult.orderId || 'FREE_CLAIM', db.J(cfResult), cfResult?.ip || null]
    );
    await db.exec(
      `UPDATE projects SET custom_domain = ?, updated_at = datetime('now') WHERE id = ?`,
      [cleanDomain, projectId]
    );

    res.json({ success: true, domain: cleanDomain, message: 'Domain claimed and configuring.' });
  } catch (error) {
    console.error('Claim domain failed:', error);
    res.status(500).json({ error: error.message });
  }
});

// ------------------------------------------------------------------
// Cron: expire published projects
// ------------------------------------------------------------------

cron.schedule('0 1 * * *', async () => {
  console.log('[Cron] Checking for expired subscriptions...');
  try {
    const nowIso = new Date().toISOString();
    const expired = await db.query(
      `SELECT id FROM projects WHERE is_published = 1 AND is_expired = 0 AND subscription_expiry < ?`,
      [nowIso]
    );
    if (expired.length === 0) {
      console.log('[Cron] No expired subscriptions found.');
      return;
    }
    for (const { id } of expired) {
      try {
        await db.exec(`UPDATE projects SET is_expired = 1 WHERE id = ?`, [id]);
      } catch (err) {
        console.error(`[Cron] Failed to expire project ${id}:`, err);
      }
    }
    console.log(`[Cron] Expired ${expired.length} site(s).`);
  } catch (error) {
    console.error('[Cron] Expiry check failed:', error);
  }
});

// ------------------------------------------------------------------
// Auth — Email OTP
// ------------------------------------------------------------------

function genReferralCode(uid) {
  return 'GW' + uid.slice(-4).toUpperCase() + Math.random().toString(36).slice(2, 6).toUpperCase();
}

app.post('/api/auth/send-otp', async (req, res) => {
  let { email } = req.body || {};
  if (!email || typeof email !== 'string') return res.status(400).json({ error: 'Email is required' });
  email = email.trim().toLowerCase();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return res.status(400).json({ error: 'Invalid email' });

  try {
    const code = generateOtp();
    const codeHash = hashOtp(email, code);
    const now = Math.floor(Date.now() / 1000);
    const expiresAt = now + OTP_TTL_SECONDS;

    await db.exec(
      `INSERT INTO email_otps (email, code_hash, expires_at, attempts, created_at)
       VALUES (?, ?, ?, 0, ?)
       ON CONFLICT(email) DO UPDATE SET
         code_hash = excluded.code_hash,
         expires_at = excluded.expires_at,
         attempts = 0,
         created_at = excluded.created_at`,
      [email, codeHash, expiresAt, now]
    );

    sendOtpEmail(email, code).catch(err => console.error('[OTP] send failed:', err.message));
    res.json({ success: true, expiresIn: OTP_TTL_SECONDS });
  } catch (error) {
    console.error('send-otp error:', error);
    res.status(500).json({ error: 'Failed to send OTP' });
  }
});

app.post('/api/auth/verify-otp', async (req, res) => {
  let { email, code, name, referralCode } = req.body || {};
  if (!email || !code) return res.status(400).json({ error: 'Email and code are required' });
  email = email.trim().toLowerCase();

  try {
    const otp = await db.one('SELECT code_hash, expires_at, attempts FROM email_otps WHERE email = ?', [email]);
    if (!otp) return res.status(400).json({ error: 'No active code. Request a new one.' });

    const now = Math.floor(Date.now() / 1000);
    if (otp.expires_at < now) {
      await db.exec('DELETE FROM email_otps WHERE email = ?', [email]);
      return res.status(400).json({ error: 'Code expired. Request a new one.' });
    }
    if (otp.attempts >= OTP_MAX_ATTEMPTS) {
      await db.exec('DELETE FROM email_otps WHERE email = ?', [email]);
      return res.status(429).json({ error: 'Too many attempts. Request a new code.' });
    }

    const expected = hashOtp(email, String(code).trim());
    if (expected !== otp.code_hash) {
      await db.exec('UPDATE email_otps SET attempts = attempts + 1 WHERE email = ?', [email]);
      return res.status(401).json({ error: 'Incorrect code' });
    }

    // Code valid — consume it.
    await db.exec('DELETE FROM email_otps WHERE email = ?', [email]);

    let user = await db.one('SELECT * FROM users WHERE email = ?', [email]);
    let isNew = false;

    if (!user) {
      isNew = true;
      const uid = crypto.randomUUID();
      const refCode = genReferralCode(uid);
      await db.exec(
        `INSERT INTO users (id, email, name, credits, is_admin, email_verified, referral_code, setup_complete)
         VALUES (?, ?, ?, 0, 0, 1, ?, 0)`,
        [uid, email, name ? String(name).trim() : null, refCode]
      );

      // Apply signup gift + referral bonus
      const cfgRow = await db.one("SELECT value FROM platform_config WHERE key = 'general'");
      const cfg = cfgRow ? db.parseJSON(cfgRow.value, {}) : {};
      const giftAmount = cfg.signupGiftCredits || 200;
      const referralBonusAmount = cfg.referralBonusAmount || 50;
      const referralRewardAmount = cfg.referralRewardAmount || 100;

      try { await addCredits(uid, giftAmount, 'Welcome bonus credits'); } catch (_) {}

      if (referralCode) {
        try {
          const referrer = await db.one('SELECT id FROM users WHERE referral_code = ?', [String(referralCode).toUpperCase()]);
          if (referrer && referrer.id !== uid) {
            await db.exec(
              `INSERT INTO referrals (id, referrer_user_id, referred_user_id, status, reward_amount)
               VALUES (?, ?, ?, 'pending', ?)`,
              [crypto.randomUUID(), referrer.id, uid, referralRewardAmount]
            );
            try { await addCredits(uid, referralBonusAmount, 'Referral signup bonus'); } catch (_) {}
          }
        } catch (e) {
          console.warn('[Referral] Apply failed:', e.message);
        }
      }

      await db.exec('UPDATE users SET setup_complete = 1 WHERE id = ?', [uid]);
      user = await db.one('SELECT * FROM users WHERE id = ?', [uid]);
    } else if (name && !user.name) {
      await db.exec('UPDATE users SET name = ? WHERE id = ?', [String(name).trim(), user.id]);
      user.name = String(name).trim();
    }

    const token = issueToken({ uid: user.id, email: user.email, is_admin: !!user.is_admin });
    res.json({ token, user: userRow(user), isNew });
  } catch (error) {
    console.error('verify-otp error:', error);
    res.status(500).json({ error: 'Failed to verify code' });
  }
});

app.post('/api/auth/logout', verifyToken, (_req, res) => res.json({ success: true }));

app.get('/api/auth/me', verifyToken, async (req, res) => {
  try {
    const user = await db.one('SELECT * FROM users WHERE id = ?', [req.user.uid]);
    if (!user) return res.status(404).json({ error: 'User not found' });
    res.json({ user: userRow(user) });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// ------------------------------------------------------------------
// SSE stream
// ------------------------------------------------------------------

// Allow token via query string for EventSource (no custom headers possible).
app.get('/api/stream', (req, res, next) => {
  if (!req.headers.authorization && req.query.token) {
    req.headers.authorization = `Bearer ${req.query.token}`;
  }
  return verifyToken(req, res, next);
}, sseHandler);

// ------------------------------------------------------------------
// Profile / Referrals
// ------------------------------------------------------------------

app.get('/api/profile', verifyToken, async (req, res) => {
  try {
    const user = await db.one('SELECT * FROM users WHERE id = ?', [req.user.uid]);
    const billing = await db.one("SELECT value FROM platform_config WHERE key = ?", [`billing:${req.user.uid}`]);
    res.json({
      name: user?.name || '',
      email: user?.email || '',
      emailVerified: !!user?.email_verified,
      createdAt: user?.created_at || null,
      preferredLanguage: user?.preferred_language || null,
      freeBuildUsed: !!user?.free_build_used,
      billingAddress: billing ? db.parseJSON(billing.value, null) : null,
    });
  } catch (error) {
    console.error('Get profile error:', error);
    res.status(500).json({ error: error.message });
  }
});

app.put('/api/profile', verifyToken, async (req, res) => {
  try {
    const { name, preferredLanguage } = req.body;
    if (name !== undefined) {
      if (!name || !name.trim()) return res.status(400).json({ error: 'Name is required' });
      await db.exec('UPDATE users SET name = ? WHERE id = ?', [name.trim(), req.user.uid]);
    }
    if (preferredLanguage !== undefined) {
      const { getLanguage } = require('./services/genni/languages');
      await db.exec('UPDATE users SET preferred_language = ? WHERE id = ?', [getLanguage(preferredLanguage).code, req.user.uid]);
    }
    res.json({ success: true });
  } catch (error) {
    console.error('Update profile error:', error);
    res.status(500).json({ error: error.message });
  }
});

app.put('/api/profile/billing-address', verifyToken, async (req, res) => {
  try {
    const { firstName, lastName, email, phone, address1, city, state, postalCode, country } = req.body;
    const required = { firstName, lastName, email, phone, address1, city, state, postalCode, country };
    const missing = Object.entries(required).filter(([, v]) => !v || !v.trim());
    if (missing.length > 0) {
      return res.status(400).json({ error: `Missing fields: ${missing.map(([k]) => k).join(', ')}` });
    }
    const payload = {
      firstName: firstName.trim(), lastName: lastName.trim(), email: email.trim(),
      phone: phone.trim(), address1: address1.trim(), city: city.trim(), state: state.trim(),
      postalCode: postalCode.trim(), country: country.trim().toUpperCase(),
    };
    await db.exec(
      `INSERT INTO platform_config (key, value, updated_at, updated_by)
       VALUES (?, ?, datetime('now'), ?)
       ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_at = excluded.updated_at, updated_by = excluded.updated_by`,
      [`billing:${req.user.uid}`, db.J(payload), req.user.uid]
    );
    res.json({ success: true });
  } catch (error) {
    console.error('Update billing address error:', error);
    res.status(500).json({ error: error.message });
  }
});

app.post('/api/referral/generate', verifyToken, async (req, res) => {
  try {
    const user = await db.one('SELECT referral_code FROM users WHERE id = ?', [req.user.uid]);
    if (user && user.referral_code) return res.json({ code: user.referral_code });
    const code = genReferralCode(req.user.uid);
    await db.exec('UPDATE users SET referral_code = ? WHERE id = ?', [code, req.user.uid]);
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

    const referrer = await db.one('SELECT id FROM users WHERE referral_code = ?', [String(code).toUpperCase()]);
    if (!referrer) return res.status(404).json({ error: 'Invalid referral code' });
    if (referrer.id === req.user.uid) return res.status(400).json({ error: 'Cannot refer yourself' });

    const existing = await db.one('SELECT id FROM referrals WHERE referred_user_id = ?', [req.user.uid]);
    if (existing) return res.json({ success: true, message: 'Referral already applied' });

    const cfgRow = await db.one("SELECT value FROM platform_config WHERE key = 'general'");
    const cfg = cfgRow ? db.parseJSON(cfgRow.value, {}) : {};
    const rewardAmount = cfg.referralRewardAmount || 100;

    await db.exec(
      `INSERT INTO referrals (id, referrer_user_id, referred_user_id, status, reward_amount)
       VALUES (?, ?, ?, 'pending', ?)`,
      [crypto.randomUUID(), referrer.id, req.user.uid, rewardAmount]
    );
    res.json({ success: true });
  } catch (error) {
    console.error('Apply referral error:', error);
    res.status(500).json({ error: error.message });
  }
});

app.get('/api/referral/stats', verifyToken, async (req, res) => {
  try {
    const user = await db.one('SELECT referral_code FROM users WHERE id = ?', [req.user.uid]);
    const referralCode = user ? user.referral_code : null;

    const referralRows = await db.query(
      `SELECT r.id, r.referrer_user_id, r.referred_user_id, r.status, r.reward_amount, r.created_at,
              u.name AS referred_name,
              EXISTS (SELECT 1 FROM transactions t WHERE t.user_id = r.referred_user_id AND t.type = 'credit' AND t.razorpay_id IS NOT NULL) AS has_paid
       FROM referrals r
       LEFT JOIN users u ON u.id = r.referred_user_id
       WHERE r.referrer_user_id = ?
       ORDER BY r.created_at DESC`,
      [req.user.uid]
    );

    let totalCompleted = 0;
    let totalCreditsEarned = 0;
    const referrals = referralRows.map(d => {
      if (d.status === 'completed') {
        totalCompleted++;
        totalCreditsEarned += (d.reward_amount || 0);
      }
      return {
        id: d.id,
        referredUserName: d.referred_name || 'User',
        hasPaid: !!d.has_paid,
        status: d.status || 'pending',
        rewardAmount: d.reward_amount || 0,
        createdAt: d.created_at || null,
      };
    });

    const cfgRow = await db.one("SELECT value FROM platform_config WHERE key = 'general'");
    const cfg = cfgRow ? db.parseJSON(cfgRow.value, {}) : {};

    res.json({
      referralCode,
      totalReferred: referrals.length,
      totalCompleted,
      totalCreditsEarned,
      referrals,
      program: {
        referrerReward: cfg.referralRewardAmount || 100,
        signupBonus: cfg.referralBonusAmount || 50,
      },
    });
  } catch (error) {
    console.error('Referral stats error:', error);
    res.status(500).json({ error: error.message });
  }
});

// ------------------------------------------------------------------
// Admin routes
// ------------------------------------------------------------------

const adminRoutes = require('./routes/admin');
app.use('/api/admin', adminRoutes);

const genniRoutes = require('./routes/genni');
app.use('/api/genni', verifyToken, genniRoutes);

// The legacy pipeline stays the rollback path while the agent engine soaks;
// build-runner dispatches to it when flags say engine='legacy'.
registerLegacyRunner(runBuildProcess);

// Crash-orphan sweep: builds are in-process, so a server restart strands
// 'starting'/'processing' projects forever. Fail anything stale so the user
// gets a Retry button instead of a stuck progress bar.
async function sweepOrphanedBuilds() {
  try {
    const rows = await db.query(
      `SELECT id, user_id FROM projects
       WHERE status IN ('starting', 'processing')
         AND created_at < datetime('now', '-45 minutes')`
    );
    for (const row of rows) {
      const message = 'Build interrupted — please retry.';
      await db.exec(
        `UPDATE projects SET status = 'failed', build_progress_message = ? WHERE id = ?`,
        [message, row.id]
      );
      hub.emit(row.user_id, 'project:updated', { projectId: row.id, status: 'failed', error: message });
      console.log(`[Sweep] Marked orphaned build ${row.id} as failed.`);
    }
    if (rows.length) console.log(`[Sweep] Failed ${rows.length} orphaned build(s).`);
  } catch (e) {
    console.warn('[Sweep] Orphaned-build sweep failed:', e.message);
  }
}
sweepOrphanedBuilds();

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
