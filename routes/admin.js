const express = require('express');
const router = express.Router();
const verifyAdmin = require('../middleware/adminAuth');
const db = require('../services/db');
const { getUserCredits, addCredits } = require('../services/credits');

router.use(verifyAdmin);

// --- Dashboard Stats ---
router.get('/stats', async (req, res) => {
  try {
    const [users, projects, revenueRow, tokens] = await Promise.all([
      db.one('SELECT COUNT(*) AS c FROM users'),
      db.query('SELECT id, status, is_published FROM projects'),
      db.one(
        `SELECT COALESCE(SUM(amount), 0) AS amt FROM transactions
         WHERE type = 'credit' AND description LIKE 'Purchased%'`
      ),
      db.one(`SELECT COALESCE(SUM(total_tokens), 0) AS total FROM token_usage`),
    ]);

    const totalUsers = users ? (users.c || 0) : 0;
    const totalSites = projects.length;
    const publishedSites = projects.filter(p => p.is_published).length;
    const failedSites = projects.filter(p => p.status === 'failed').length;
    const failureRate = totalSites > 0 ? ((failedSites / totalSites) * 100).toFixed(1) : 0;

    // Revenue: extract from "Purchased X credits for ₹Y" descriptions
    const txRows = await db.query(
      `SELECT description FROM transactions WHERE type = 'credit' AND description LIKE '%₹%'`
    );
    let totalRevenue = 0;
    for (const r of txRows) {
      const m = r.description && r.description.match(/₹(\d+)/);
      if (m) totalRevenue += parseInt(m[1]);
    }

    const totalTokens = tokens ? (tokens.total || 0) : 0;
    const avgTokensPerSite = totalSites > 0 ? Math.round(totalTokens / totalSites) : 0;

    res.json({
      totalUsers,
      totalSites,
      publishedSites,
      totalRevenue,
      totalTokens,
      avgTokensPerSite,
      failureRate: parseFloat(failureRate),
    });
  } catch (error) {
    console.error('Admin stats error:', error);
    res.status(500).json({ error: 'Failed to fetch stats' });
  }
});

// --- Users ---
router.get('/users', async (req, res) => {
  try {
    const { search, limit = 50, offset = 0 } = req.query;
    const lim = Math.min(parseInt(limit) || 50, 100);
    const off = parseInt(offset) || 0;

    let where = '';
    const params = [];
    if (search) {
      where = 'WHERE u.email LIKE ? OR u.name LIKE ? OR u.id LIKE ?';
      const s = `%${search}%`;
      params.push(s, s, s);
    }

    const rows = await db.query(
      `SELECT u.id, u.email, u.name, u.credits, u.referral_code, u.created_at, u.is_admin,
              (SELECT COUNT(*) FROM projects p WHERE p.user_id = u.id) AS sites_count
       FROM users u
       ${where}
       ORDER BY u.created_at DESC
       LIMIT ? OFFSET ?`,
      [...params, lim, off]
    );

    const users = rows.map(r => ({
      uid: r.id,
      email: r.email,
      displayName: r.name,
      credits: r.credits || 0,
      sitesCount: r.sites_count || 0,
      createdAt: r.created_at,
      isAdmin: !!r.is_admin,
      referralCode: r.referral_code,
    }));

    res.json({ users, nextOffset: rows.length === lim ? off + lim : null });
  } catch (error) {
    console.error('Admin users error:', error);
    res.status(500).json({ error: 'Failed to fetch users' });
  }
});

// --- User Detail ---
router.get('/users/:uid', async (req, res) => {
  try {
    const { uid } = req.params;
    const [user, projects, transactions, domains] = await Promise.all([
      db.one('SELECT * FROM users WHERE id = ?', [uid]),
      db.query('SELECT * FROM projects WHERE user_id = ? ORDER BY created_at DESC', [uid]),
      db.query(
        `SELECT id, user_id AS userId, amount, type, description, balance_after AS balanceAfter,
                razorpay_id AS transactionId, created_at AS createdAt
         FROM transactions WHERE user_id = ? ORDER BY created_at DESC LIMIT 50`,
        [uid]
      ),
      db.query(
        `SELECT domain, user_id AS userId, order_id AS orderId, provider, status, created_at AS createdAt
         FROM domains WHERE user_id = ? ORDER BY created_at DESC`,
        [uid]
      ),
    ]);

    if (!user) return res.status(404).json({ error: 'User not found' });

    res.json({
      uid: user.id,
      email: user.email,
      displayName: user.name,
      credits: user.credits || 0,
      referralCode: user.referral_code,
      setupComplete: !!user.setup_complete,
      isAdmin: !!user.is_admin,
      emailVerified: !!user.email_verified,
      createdAt: user.created_at,
      projects,
      transactions,
      domains,
    });
  } catch (error) {
    console.error('Admin user detail error:', error);
    res.status(500).json({ error: 'Failed to fetch user detail' });
  }
});

// --- Add Credits to User ---
router.post('/users/:uid/credits', async (req, res) => {
  try {
    const { uid } = req.params;
    const { amount, description } = req.body;
    if (!amount || amount <= 0) return res.status(400).json({ error: 'Valid amount required' });
    await addCredits(uid, parseInt(amount), description || `Admin credit grant by ${req.user.uid}`);
    const newBalance = await getUserCredits(uid);
    res.json({ success: true, newBalance });
  } catch (error) {
    console.error('Admin add credits error:', error);
    res.status(500).json({ error: 'Failed to add credits' });
  }
});

// --- Projects ---
router.get('/projects', async (req, res) => {
  try {
    const { status, userId, limit = 50 } = req.query;
    const lim = Math.min(parseInt(limit) || 50, 200);
    const conditions = [];
    const params = [];
    if (status) { conditions.push('status = ?'); params.push(status); }
    if (userId) { conditions.push('user_id = ?'); params.push(userId); }
    const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';

    const rows = await db.query(
      `SELECT * FROM projects ${where} ORDER BY created_at DESC LIMIT ?`,
      [...params, lim]
    );
    res.json({ projects: rows });
  } catch (error) {
    console.error('Admin projects error:', error);
    res.status(500).json({ error: 'Failed to fetch projects' });
  }
});

// --- Transactions ---
router.get('/transactions', async (req, res) => {
  try {
    const { userId, type, limit = 50 } = req.query;
    const lim = Math.min(parseInt(limit) || 50, 500);
    const conditions = [];
    const params = [];
    if (userId) { conditions.push('user_id = ?'); params.push(userId); }
    if (type) { conditions.push('type = ?'); params.push(type); }
    const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';

    const rows = await db.query(
      `SELECT id, user_id AS userId, amount, type, description, balance_after AS balanceAfter,
              razorpay_id AS transactionId, created_at AS createdAt
       FROM transactions ${where} ORDER BY created_at DESC LIMIT ?`,
      [...params, lim]
    );
    res.json({ transactions: rows });
  } catch (error) {
    console.error('Admin transactions error:', error);
    res.status(500).json({ error: 'Failed to fetch transactions' });
  }
});

// --- Token Usage ---
router.get('/token-usage', async (req, res) => {
  try {
    const { days = 30 } = req.query;
    const since = new Date();
    since.setDate(since.getDate() - parseInt(days));
    const sinceIso = since.toISOString();

    const rows = await db.query(
      `SELECT service, model, input_tokens, output_tokens, total_tokens
       FROM token_usage WHERE created_at >= ?`,
      [sinceIso]
    );

    let totalInput = 0, totalOutput = 0, totalTokens = 0;
    const byService = {};
    const byModel = {};
    for (const d of rows) {
      totalInput += d.input_tokens || 0;
      totalOutput += d.output_tokens || 0;
      totalTokens += d.total_tokens || 0;

      const svc = d.service || 'unknown';
      if (!byService[svc]) byService[svc] = { input: 0, output: 0, total: 0, count: 0 };
      byService[svc].input += d.input_tokens || 0;
      byService[svc].output += d.output_tokens || 0;
      byService[svc].total += d.total_tokens || 0;
      byService[svc].count += 1;

      const mdl = d.model || 'gemini';
      if (!byModel[mdl]) byModel[mdl] = { input: 0, output: 0, total: 0, count: 0 };
      byModel[mdl].input += d.input_tokens || 0;
      byModel[mdl].output += d.output_tokens || 0;
      byModel[mdl].total += d.total_tokens || 0;
      byModel[mdl].count += 1;
    }

    const estimatedCost = (totalInput * 0.000000075) + (totalOutput * 0.0000003);
    res.json({
      totalInput,
      totalOutput,
      totalTokens,
      totalCalls: rows.length,
      estimatedCost: parseFloat(estimatedCost.toFixed(4)),
      byService,
      byModel,
      days: parseInt(days),
    });
  } catch (error) {
    console.error('Admin token usage error:', error);
    res.status(500).json({ error: 'Failed to fetch token usage' });
  }
});

// --- Referrals ---
router.get('/referrals', async (req, res) => {
  try {
    const { status } = req.query;
    let where = '';
    const params = [];
    if (status) { where = 'WHERE status = ?'; params.push(status); }
    const rows = await db.query(
      `SELECT id, referrer_user_id AS referrerUserId, referred_user_id AS referredUserId,
              status, reward_amount AS rewardAmount,
              created_at AS createdAt, completed_at AS completedAt
       FROM referrals ${where} ORDER BY created_at DESC`,
      params
    );
    res.json({ referrals: rows });
  } catch (error) {
    console.error('Admin referrals error:', error);
    res.status(500).json({ error: 'Failed to fetch referrals' });
  }
});

// --- Platform Config ---
router.get('/config', async (req, res) => {
  try {
    const row = await db.one("SELECT value FROM platform_config WHERE key = 'general'");
    const defaults = {
      signupGiftCredits: 200,
      referralEnabled: true,
      referralRewardAmount: 100,
      referralBonusAmount: 50,
    };
    res.json(row ? { ...defaults, ...db.parseJSON(row.value, {}) } : defaults);
  } catch (error) {
    console.error('Admin config error:', error);
    res.status(500).json({ error: 'Failed to fetch config' });
  }
});

router.put('/config', async (req, res) => {
  try {
    const updates = req.body;
    const existing = await db.one("SELECT value FROM platform_config WHERE key = 'general'");
    const current = existing ? db.parseJSON(existing.value, {}) : {};
    const merged = { ...current, ...updates };
    await db.exec(
      `INSERT INTO platform_config (key, value, updated_at, updated_by)
       VALUES ('general', ?, datetime('now'), ?)
       ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_at = excluded.updated_at, updated_by = excluded.updated_by`,
      [db.J(merged), req.user.uid]
    );
    res.json({ success: true });
  } catch (error) {
    console.error('Admin config update error:', error);
    res.status(500).json({ error: 'Failed to update config' });
  }
});

module.exports = router;
