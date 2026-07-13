/**
 * Credit-charging page operations, shared by the REST routes and Genni's
 * confirmed actions — validation, credit deduction, and rebuild live in ONE
 * place so the chat path can never bypass a rule the route enforces.
 *
 * Both functions verify project ownership (the original route bodies didn't).
 * Errors carry .statusCode for the routes to map onto HTTP responses.
 */
const fs = require('fs-extra');
const path = require('path');

const db = require('./db');
const { deductCredits } = require('./credits');
const { generateCode, regenerateSection } = require('./ai-coder');
const { rebuildForEdit } = require('./builder');
const { saveTokenUsage, saveBuildArtifacts, retryWithBackoff, ensureProjectSource } = require('./build-support');

const ROOT_DIR = path.join(__dirname, '..');

function httpError(statusCode, message) {
  const e = new Error(message);
  e.statusCode = statusCode;
  return e;
}

async function requireOwnedProject(projectId, userId) {
  const row = await db.one('SELECT * FROM projects WHERE id = ? AND user_id = ?', [projectId, userId]);
  if (!row) throw httpError(404, 'Project not found');
  return row;
}

const ADD_PAGE_COST = 100;
const SECTION_REDESIGN_COST = 50;

/**
 * Validate an add-page request WITHOUT charging or generating — used by
 * Genni's start_add_page tool so the confirmation card only appears for
 * actions that will actually succeed.
 */
async function validateAddPage(userId, projectId, { pageName, isSubPage = false }) {
  if (!pageName || !pageName.trim()) throw httpError(400, 'pageName is required');
  await requireOwnedProject(projectId, userId);
  if (!await ensureProjectSource(projectId)) throw httpError(404, 'Project source not found');

  const distDir = path.join(ROOT_DIR, 'projects_source', projectId, 'dist');
  const filename = `${pageName.trim().toLowerCase().replace(/\s+/g, '-')}.html`;
  if (await fs.pathExists(path.join(distDir, filename))) {
    throw httpError(409, `Page "${pageName}" already exists`);
  }

  const config = await readSiteConfig(distDir);
  const mainPages = config.navigation.filter(n => n.name !== 'More');
  const subPages = config.navigation.find(n => n.name === 'More')?.children || [];
  if (isSubPage && subPages.length >= 30) throw httpError(400, 'Maximum of 30 sub-pages reached.');
  if (!isSubPage && mainPages.length >= 7) throw httpError(400, 'Maximum of 7 main pages reached.');

  return { filename, cost: ADD_PAGE_COST };
}

async function readSiteConfig(distDir) {
  const configPath = path.join(distDir, 'site-config.json');
  if (await fs.pathExists(configPath)) return fs.readJson(configPath);
  const files = await fs.readdir(distDir);
  const htmlFiles = files.filter(f => f.endsWith('.html'));
  return {
    businessName: 'Business',
    logo: (await fs.pathExists(path.join(distDir, 'logo.png'))) ? './logo.png' : null,
    navigation: htmlFiles.map(f => ({
      name: f === 'index.html' ? 'Home' : f.replace('.html', '').replace(/-/g, ' ').replace(/\b\w/g, l => l.toUpperCase()),
      path: f,
      children: [],
    })),
  };
}

/**
 * Generate and add a page to a project (charges 100 credits).
 * Mirrors the original /api/project/:id/pages/add body.
 */
async function addPage(userId, projectId, { pageName, isSubPage = false, pagePrompt = null }) {
  const { filename } = await validateAddPage(userId, projectId, { pageName, isSubPage });

  const sourceDir = path.join(ROOT_DIR, 'projects_source', projectId);
  const distDir = path.join(sourceDir, 'dist');
  const configPath = path.join(distDir, 'site-config.json');
  const config = await readSiteConfig(distDir);

  try {
    await deductCredits(userId, ADD_PAGE_COST, `Add page "${pageName}" to project ${projectId}`);
  } catch (_) {
    throw httpError(402, `Insufficient credits. Need ${ADD_PAGE_COST} credits to add a page.`);
  }

  const newPagePath = path.join(distDir, filename);

  let layoutReference = null;
  try {
    const homeCode = await fs.readFile(path.join(distDir, 'index.html'), 'utf-8');
    const headerMatch = homeCode.match(/<(\w+)[^>]*data-section="header"[^>]*>([\s\S]*?)<\/\1>/);
    const footerMatch = homeCode.match(/<(\w+)[^>]*data-section="footer"[^>]*>([\s\S]*?)<\/\1>/);
    if (headerMatch && footerMatch) layoutReference = { header: headerMatch[0], footer: footerMatch[0] };
  } catch (_) {}

  const subPages = config.navigation.find(n => n.name === 'More')?.children || [];
  const allPageNames = config.navigation.filter(n => n.name !== 'More').map(n => n.name);
  subPages.forEach(s => allPageNames.push(s.name));
  allPageNames.push(pageName);

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
        body: fonts.body ? fonts.body[0] : 'sans-serif',
      },
      businessName: config.businessName,
      logoUrl: config.logo,
      imageUrls: [],
    };
  }

  const projRow = await db.one('SELECT user_context, style_preset FROM projects WHERE id = ?', [projectId]);
  let userContext = `Business: ${config.businessName}`;
  let stylePreset = null;
  if (projRow) {
    const parsed = db.parseJSON(projRow.user_context, null);
    if (parsed) userContext = typeof parsed === 'string' ? parsed : JSON.stringify(parsed);
    if (projRow.style_preset) stylePreset = projRow.style_preset;
  }

  let pageContext = userContext;
  if (pagePrompt) pageContext += `\n\nSPECIFIC INSTRUCTIONS FOR THIS PAGE ("${pageName}"): ${pagePrompt}`;

  console.log(`[${projectId}] Generating new page: ${pageName} (${isSubPage ? 'sub-page' : 'main'})...`);
  const codeResult = await retryWithBackoff(() =>
    generateCode(designSystem || {}, pageContext, pageName, allPageNames, layoutReference, stylePreset)
  );
  if (codeResult.usage) {
    await saveTokenUsage([{ ...codeResult.usage, service: 'coder', action: `addPage:${pageName}` }], projectId, userId);
  }
  await fs.writeFile(newPagePath, codeResult.code);

  const newNavEntry = { name: pageName, path: filename, children: [] };
  if (isSubPage) {
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

  const distPath = await rebuildForEdit(projectId);
  const previewUrl = await saveBuildArtifacts(projectId, distPath, userId);

  return { page: filename, config, url: previewUrl, cost: ADD_PAGE_COST };
}

/**
 * Validate a section redesign without charging — ownership + section exists.
 */
async function validateSectionRedesign(userId, projectId, { sectionId, page = null }) {
  if (!sectionId) throw httpError(400, 'sectionId is required');
  await requireOwnedProject(projectId, userId);
  if (!await ensureProjectSource(projectId)) throw httpError(404, 'Project source not found');

  const distDir = path.join(ROOT_DIR, 'projects_source', projectId, 'dist');
  let targetFile = page || null;
  if (!targetFile) {
    const files = await fs.readdir(distDir);
    for (const file of files.filter(f => f.endsWith('.html'))) {
      const content = await fs.readFile(path.join(distDir, file), 'utf-8');
      if (content.includes(`data-section="${sectionId}"`)) { targetFile = file; break; }
    }
  }
  if (!targetFile || !await fs.pathExists(path.join(distDir, targetFile))) {
    throw httpError(404, `Couldn't find a section "${sectionId}" in this project.`);
  }
  return { targetFile, cost: SECTION_REDESIGN_COST };
}

/**
 * AI-redesign one section (charges 50 credits).
 * Mirrors the original /api/project/:id/section body.
 */
async function redesignSection(userId, projectId, { sectionId, instruction, page = null }) {
  const { targetFile } = await validateSectionRedesign(userId, projectId, { sectionId, page });

  try {
    await deductCredits(userId, SECTION_REDESIGN_COST, `Redesign section ${sectionId} for project ${projectId}`);
  } catch (_) {
    throw httpError(402, 'Insufficient credits for AI redesign.');
  }

  const distDir = path.join(ROOT_DIR, 'projects_source', projectId, 'dist');
  const sourcePath = path.join(distDir, targetFile);
  const currentCode = await fs.readFile(sourcePath, 'utf-8');

  console.log(`Regenerating section '${sectionId}' in '${targetFile}' for project ${projectId}...`);
  const sectionResult = await retryWithBackoff(() => regenerateSection(currentCode, sectionId, instruction));
  if (sectionResult.usage) {
    await saveTokenUsage([{ ...sectionResult.usage, service: 'coder', action: 'regenerateSection' }], projectId, userId);
  }

  await fs.writeFile(sourcePath + '.bak', currentCode);
  await fs.writeFile(sourcePath, sectionResult.code);

  const distPath = await rebuildForEdit(projectId);
  const previewUrl = await saveBuildArtifacts(projectId, distPath, userId);

  return { url: previewUrl, page: targetFile, cost: SECTION_REDESIGN_COST };
}

module.exports = {
  addPage, validateAddPage, redesignSection, validateSectionRedesign,
  ADD_PAGE_COST, SECTION_REDESIGN_COST,
};
