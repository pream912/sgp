const crypto = require('crypto');
const db = require('./db');
const { hub } = require('./sse');

async function getUserCredits(userId) {
  const row = await db.one('SELECT credits FROM users WHERE id = ?', [userId]);
  return row ? (row.credits || 0) : 0;
}

async function addCredits(userId, amount, description, razorpayId = null) {
  const user = await db.one('SELECT credits FROM users WHERE id = ?', [userId]);
  const current = user ? (user.credits || 0) : 0;
  const newBalance = current + amount;
  const txId = crypto.randomUUID();

  await db.transaction([
    {
      sql: 'UPDATE users SET credits = ? WHERE id = ?',
      params: [newBalance, userId],
    },
    {
      sql: `INSERT INTO transactions (id, user_id, amount, type, description, balance_after, razorpay_id)
            VALUES (?, ?, ?, 'credit', ?, ?, ?)`,
      params: [txId, userId, amount, description, newBalance, razorpayId],
    },
  ]);

  hub.emit(userId, 'credits', { balance: newBalance, delta: amount });
  return newBalance;
}

async function deductCredits(userId, amount, description) {
  const user = await db.one('SELECT credits FROM users WHERE id = ?', [userId]);
  const current = user ? (user.credits || 0) : 0;
  if (current < amount) throw new Error('Insufficient credits');
  const newBalance = current - amount;
  const txId = crypto.randomUUID();

  await db.transaction([
    {
      sql: 'UPDATE users SET credits = ? WHERE id = ?',
      params: [newBalance, userId],
    },
    {
      sql: `INSERT INTO transactions (id, user_id, amount, type, description, balance_after)
            VALUES (?, ?, ?, 'debit', ?, ?)`,
      params: [txId, userId, -amount, description, newBalance],
    },
  ]);

  hub.emit(userId, 'credits', { balance: newBalance, delta: -amount });
  return true;
}

async function getTransactions(userId, limit = 50) {
  const rows = await db.query(
    `SELECT id, user_id AS userId, amount, type, description, balance_after AS balanceAfter,
            razorpay_id AS transactionId, created_at AS createdAt
     FROM transactions WHERE user_id = ? ORDER BY created_at DESC LIMIT ?`,
    [userId, limit]
  );
  return rows;
}

module.exports = { getUserCredits, addCredits, deductCredits, getTransactions };
