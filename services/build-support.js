/**
 * Build lifecycle helpers shared by the legacy build path (server.js
 * runBuildProcess) and the agent build runner (services/build-runner.js).
 * Moved out of server.js verbatim — only the __dirname-relative paths changed.
 */
const fs = require('fs-extra');
const path = require('path');
const crypto = require('crypto');

const db = require('./db');
const { sendEmail } = require('./email');
const { uploadDirectory, downloadDirectory, uploadPreview } = require('./storage');
const { captureScreenshot } = require('./screenshot');

const ROOT_DIR = path.join(__dirname, '..');
const PORT = process.env.PORT || 3000;

async function retryWithBackoff(fn, maxRetries = 3) {
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      return await fn();
    } catch (err) {
      const msg = err.message || '';
      const is429 = msg.includes('429') || msg.includes('RESOURCE_EXHAUSTED');
      if (!is429 || attempt === maxRetries) {
        if (is429) {
          const e = new Error('Our AI services are currently experiencing high demand. Please try again in a few minutes.');
          e.statusCode = 503;
          throw e;
        }
        throw err;
      }
      const delay = 10000 * Math.pow(2, attempt - 1) + Math.random() * 2000;
      console.warn(`[Retry] 429 hit, attempt ${attempt}/${maxRetries}. Retrying in ${Math.round(delay / 1000)}s...`);
      await new Promise(r => setTimeout(r, delay));
    }
  }
}

async function ensureProjectSource(id) {
  const projectDir = path.join(ROOT_DIR, 'projects_source', id);
  if (await fs.pathExists(projectDir)) return true;

  console.log(`[${id}] Project source missing locally. Attempting to download from R2...`);
  try {
    await fs.ensureDir(projectDir);
    const success = await downloadDirectory(`projects/${id}`, projectDir);
    if (success) {
      console.log(`[${id}] Project source restored.`);
      try {
        const distPath = path.join(projectDir, 'dist');
        const publicSitePath = path.join(ROOT_DIR, 'public/sites', id);
        if (await fs.pathExists(distPath)) {
          await fs.copy(distPath, publicSitePath);
        }
      } catch (e) {
        console.warn(`[${id}] Failed to copy to public/sites:`, e.message);
      }
      return true;
    }
    await fs.remove(projectDir);
    return false;
  } catch (error) {
    console.error(`[${id}] Failed to restore project source:`, error);
    return false;
  }
}

async function saveTokenUsage(entries, projectId, userId) {
  if (!entries || entries.length === 0) return;
  try {
    const stmts = entries.map(e => ({
      sql: `INSERT INTO token_usage (id, project_id, user_id, model, service, action, input_tokens, output_tokens, total_tokens)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      params: [
        crypto.randomUUID(),
        projectId || null,
        userId || null,
        e.model || 'gemini',
        e.service || 'unknown',
        e.action || null,
        e.promptTokenCount || 0,
        e.candidatesTokenCount || 0,
        e.totalTokenCount || 0,
      ],
    }));
    await db.transaction(stmts);
    console.log(`[TokenUsage] Saved ${entries.length} usage entries for project ${projectId}`);
  } catch (err) {
    console.error('[TokenUsage] Failed to save:', err.message);
  }
}

async function saveBuildArtifacts(id, distPath, userId) {
  try {
    console.log(`[${id}] Saving build artifacts to R2...`);

    const R2_PUB = process.env.R2_PUBLIC_DOMAIN || 'pub-r2.genweb.in';
    const SITES_BUCKET = process.env.R2_SITES_BUCKET || 'genweb-sites';

    // Upload source for retry/regenerate flows.
    await uploadDirectory(distPath, `projects/${id}/dist`);
    // Upload to the public sites bucket so the preview URL actually serves.
    await uploadDirectory(distPath, id, SITES_BUCKET);

    const publicUrl = `https://${R2_PUB}/${SITES_BUCKET}/${id}/index.html`;

    let previewUrl = null;
    try {
      console.log(`[${id}] Auto-generating preview screenshot...`);
      const localSitePath = path.join(ROOT_DIR, 'public/sites', id);
      await fs.ensureDir(localSitePath);
      const previewPath = path.join(localSitePath, 'preview.jpg');
      await captureScreenshot(publicUrl, previewPath);
      previewUrl = await uploadPreview(previewPath, id);
    } catch (e) {
      console.warn(`[${id}] Preview generation/upload failed:`, e.message);
    }

    await db.exec(
      `UPDATE projects SET updated_at = datetime('now'), url = ?, deploy_url = ?, bucket_url = ? WHERE id = ?`,
      [publicUrl, publicUrl, previewUrl || null, id]
    );

    return publicUrl;
  } catch (error) {
    console.error(`[${id}] Save artifacts failed:`, error);
    throw error;
  }
}

async function sendBuildNotification(userId, projectId, projectName, status, errorMessage = null) {
  try {
    const user = await db.one('SELECT email, email_verified FROM users WHERE id = ?', [userId]);
    if (!user || !user.email_verified) {
      console.log(`[Email] Skipping build notification for ${userId} - email not verified`);
      return;
    }
    const userEmail = user.email;
    if (!userEmail) return;

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
      ? `<div style="text-align:center;margin:32px 0;">
           <a href="${baseUrl}/my-sites" style="display:inline-block;background:#f97316;color:#fff;font-size:15px;font-weight:600;text-decoration:none;padding:12px 32px;border-radius:8px;">View Your Site</a>
         </div>`
      : `<div style="background:${statusBg};border:1px solid #fecaca;border-radius:8px;padding:16px;margin:16px 0;">
           <p style="color:#991b1b;font-size:14px;margin:0;"><strong>Error:</strong> ${errorMessage || 'An unexpected error occurred.'}</p>
         </div>
         <div style="text-align:center;margin:32px 0;">
           <a href="${baseUrl}/my-sites" style="display:inline-block;background:#f97316;color:#fff;font-size:15px;font-weight:600;text-decoration:none;padding:12px 32px;border-radius:8px;">Retry Build</a>
         </div>`;

    await sendEmail({
      to: userEmail,
      subject,
      html: `
        <div style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;max-width:560px;margin:0 auto;padding:40px 20px;">
          <div style="text-align:center;margin-bottom:32px;"><h1 style="font-size:24px;font-weight:700;color:#1a1a2e;margin:0;">GenWeb</h1></div>
          <div style="background:#fff;border:1px solid #e5e7eb;border-radius:12px;padding:32px;">
            <div style="text-align:center;margin-bottom:24px;">
              <div style="display:inline-block;width:48px;height:48px;line-height:48px;border-radius:50%;background:${statusBg};color:${statusColor};font-size:24px;font-weight:bold;">${statusIcon}</div>
            </div>
            <h2 style="font-size:20px;font-weight:600;color:#1a1a2e;margin:0 0 8px;text-align:center;">${statusText}</h2>
            <p style="color:#6b7280;font-size:15px;line-height:1.6;margin:0 0 8px;text-align:center;">
              ${isSuccess
                ? `Your website <strong>"${siteName}"</strong> has been built successfully and is ready to preview and publish.`
                : `We couldn't build your website <strong>"${siteName}"</strong>. You can retry the build from your dashboard.`}
            </p>
            ${ctaSection}
          </div>
        </div>`
    });
    console.log(`[Email] Build ${status} notification sent to ${userEmail} for project ${projectId}`);
  } catch (err) {
    console.error(`[Email] Failed to send build notification:`, err.message);
  }
}

async function appendProjectLog(projectId, message) {
  try {
    const row = await db.one('SELECT logs FROM projects WHERE id = ?', [projectId]);
    const logs = row ? db.parseJSON(row.logs, []) : [];
    logs.push({ message, timestamp: new Date().toISOString() });
    await db.exec('UPDATE projects SET logs = ? WHERE id = ?', [db.J(logs), projectId]);
  } catch (e) {
    console.warn(`[${projectId}] Failed to append log:`, e.message);
  }
}

module.exports = { saveTokenUsage, saveBuildArtifacts, sendBuildNotification, appendProjectLog, retryWithBackoff, ensureProjectSource };
