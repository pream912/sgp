// Cloudflare D1 REST client.
// Used by Express to talk to D1 from outside Workers.
const ACCOUNT_ID = process.env.CF_ACCOUNT_ID;
const DB_ID      = process.env.D1_DATABASE_ID;
const API_TOKEN  = process.env.CF_API_TOKEN;

function endpoint() {
  return `https://api.cloudflare.com/client/v4/accounts/${ACCOUNT_ID}/d1/database/${DB_ID}/query`;
}

async function send(sql, params = []) {
  if (!ACCOUNT_ID || !DB_ID || !API_TOKEN) {
    throw new Error('D1 not configured: set CF_ACCOUNT_ID, D1_DATABASE_ID, CF_API_TOKEN');
  }
  const res = await fetch(endpoint(), {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${API_TOKEN}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({ sql, params })
  });
  const body = await res.json();
  if (!res.ok || !body.success) {
    const msg = (body.errors && body.errors[0] && body.errors[0].message) || `D1 HTTP ${res.status}`;
    const err = new Error(`D1 error: ${msg}`);
    err.detail = body;
    throw err;
  }
  return body.result; // array of { success, results, meta }
}

async function query(sql, params = []) {
  const result = await send(sql, params);
  const first = result[0] || {};
  return first.results || [];
}

async function one(sql, params = []) {
  const rows = await query(sql, params);
  return rows[0] || null;
}

async function exec(sql, params = []) {
  const result = await send(sql, params);
  return (result[0] && result[0].meta) || {};
}

// Atomic multi-statement batch. D1's query endpoint runs all statements
// in a single implicit transaction when separated by ';'.
async function transaction(statements) {
  // statements: [{ sql, params }, ...]
  // Concatenate with positional bindings; D1 binds all params in order.
  const sqls = statements.map(s => s.sql.trim().replace(/;\s*$/, '')).join(';\n');
  const params = [];
  for (const s of statements) {
    if (Array.isArray(s.params)) params.push(...s.params);
  }
  const result = await send(sqls, params);
  return result;
}

// Convenience: upsert a JSON-stringified value into a TEXT column.
function J(v) {
  if (v === undefined || v === null) return null;
  return typeof v === 'string' ? v : JSON.stringify(v);
}

function parseJSON(s, fallback = null) {
  if (s === null || s === undefined) return fallback;
  if (typeof s !== 'string') return s;
  try { return JSON.parse(s); } catch { return fallback; }
}

module.exports = { query, one, exec, transaction, J, parseJSON };
