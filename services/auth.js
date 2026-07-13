// JWT issuance + email-OTP helpers.
const crypto = require('crypto');
const { sendEmail } = require('./email');

const JWT_SECRET = process.env.JWT_SECRET || '';
const JWT_TTL_SECONDS = 60 * 60 * 24 * 7; // 7 days
const OTP_TTL_SECONDS = 60 * 10;          // 10 minutes
const OTP_MAX_ATTEMPTS = 5;

if (!JWT_SECRET) {
  console.warn('[auth] WARNING: JWT_SECRET not set — auth will refuse to issue tokens.');
}

// ---- JWT (HS256, no external deps) ----

function b64url(buf) {
  return Buffer.from(buf).toString('base64')
    .replace(/=+$/g, '').replace(/\+/g, '-').replace(/\//g, '_');
}
function b64urlDecode(s) {
  s = s.replace(/-/g, '+').replace(/_/g, '/');
  while (s.length % 4) s += '=';
  return Buffer.from(s, 'base64');
}
function sign(data) {
  return b64url(crypto.createHmac('sha256', JWT_SECRET).update(data).digest());
}

function issueToken(claims) {
  if (!JWT_SECRET) throw new Error('JWT_SECRET not configured');
  const header = { alg: 'HS256', typ: 'JWT' };
  const now = Math.floor(Date.now() / 1000);
  const payload = { iat: now, exp: now + JWT_TTL_SECONDS, ...claims };
  const h = b64url(JSON.stringify(header));
  const p = b64url(JSON.stringify(payload));
  const s = sign(`${h}.${p}`);
  return `${h}.${p}.${s}`;
}

function verifyToken(token) {
  if (!token || typeof token !== 'string') throw new Error('invalid token');
  const parts = token.split('.');
  if (parts.length !== 3) throw new Error('malformed token');
  const [h, p, s] = parts;
  const expected = sign(`${h}.${p}`);
  // constant-time compare
  if (!crypto.timingSafeEqual(Buffer.from(s), Buffer.from(expected))) {
    throw new Error('bad signature');
  }
  const payload = JSON.parse(b64urlDecode(p).toString('utf8'));
  if (typeof payload.exp === 'number' && payload.exp < Math.floor(Date.now() / 1000)) {
    throw new Error('token expired');
  }
  return payload;
}

// ---- OTP ----

function generateOtp() {
  // 6 random digits, leading zeros preserved
  const n = crypto.randomInt(0, 1000000);
  return n.toString().padStart(6, '0');
}

function hashOtp(email, code) {
  // SHA-256 over email + code + secret. email is salt so codes for different
  // emails can't collide.
  return crypto.createHash('sha256')
    .update(`${email.toLowerCase()}:${code}:${JWT_SECRET}`)
    .digest('hex');
}

async function sendOtpEmail(to, code) {
  const subject = `${code} is your GenWeb login code`;
  const text = `Your GenWeb login code is ${code}. It expires in 10 minutes.\n\nIf you didn't request this, you can ignore this email.`;
  const html = `
    <div style="font-family:system-ui,-apple-system,Segoe UI,sans-serif;max-width:480px;margin:24px auto;padding:24px;border:1px solid #e5e7eb;border-radius:12px;">
      <h2 style="margin:0 0 8px;color:#111827;">Your login code</h2>
      <p style="color:#374151;margin:0 0 16px;">Enter this code to sign in to GenWeb.</p>
      <div style="font-size:32px;font-weight:700;letter-spacing:6px;color:#111827;background:#f3f4f6;border-radius:8px;padding:16px;text-align:center;font-family:ui-monospace,Menlo,monospace;">
        ${code}
      </div>
      <p style="color:#6b7280;font-size:13px;margin:16px 0 0;">Expires in 10 minutes. If you didn't request this, you can safely ignore this email.</p>
    </div>`;
  return sendEmail({ to, subject, html, text });
}

module.exports = {
  issueToken,
  verifyToken,
  generateOtp,
  hashOtp,
  sendOtpEmail,
  JWT_TTL_SECONDS,
  OTP_TTL_SECONDS,
  OTP_MAX_ATTEMPTS,
};
