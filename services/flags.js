/**
 * Build pipeline feature flags, admin-flippable via platform_config without a
 * deploy. Read at startBuild time only — running builds finish on the engine
 * they started with.
 *
 *   { engine: 'legacy'|'agent', freeFirstBuild: bool, tailwindRuntimeDrafts: bool }
 *
 * BUILD_ENGINE env acts as a boot-level override for local testing/rollback
 * when the DB is unreachable.
 */
const db = require('./db');

const DEFAULTS = { engine: 'legacy', freeFirstBuild: false, tailwindRuntimeDrafts: false };
const CACHE_TTL_MS = 60 * 1000;

let cached = null; // { flags, at }

async function getBuildFlags() {
    if (cached && Date.now() - cached.at < CACHE_TTL_MS) return cached.flags;

    let flags = { ...DEFAULTS };
    try {
        const row = await db.one(`SELECT value FROM platform_config WHERE key = 'build_pipeline'`);
        if (row) flags = { ...DEFAULTS, ...JSON.parse(row.value) };
    } catch (e) {
        console.warn('[Flags] build_pipeline lookup failed, using defaults:', e.message);
    }
    if (process.env.BUILD_ENGINE) flags.engine = process.env.BUILD_ENGINE;

    cached = { flags, at: Date.now() };
    return flags;
}

function invalidateFlagsCache() {
    cached = null;
}

module.exports = { getBuildFlags, invalidateFlagsCache };
