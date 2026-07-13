/**
 * Email service — Resend HTTP API
 *
 * Sends transactional emails via Resend (https://resend.com).
 *
 * Env vars:
 *   RESEND_API_KEY  — Resend API key (re_...)
 *   EMAIL_FROM      — Verified sender, e.g. "noreply@genweb.in"
 */
require('dotenv').config();

const RESEND_API_KEY = process.env.RESEND_API_KEY;
const EMAIL_FROM = process.env.EMAIL_FROM || 'noreply@genweb.in';
const SENDER_NAME = process.env.EMAIL_SENDER_NAME || 'GenWeb';

async function sendEmail({ to, subject, html, text, from }) {
    if (!RESEND_API_KEY) {
        throw new Error('Email not configured: RESEND_API_KEY missing');
    }

    const sender = from || `${SENDER_NAME} <${EMAIL_FROM}>`;

    const response = await fetch('https://api.resend.com/emails', {
        method: 'POST',
        headers: {
            'Authorization': `Bearer ${RESEND_API_KEY}`,
            'Content-Type': 'application/json',
        },
        body: JSON.stringify({
            from: sender,
            to: Array.isArray(to) ? to : [to],
            subject,
            html,
            text,
        }),
    });

    if (!response.ok) {
        const body = await response.text();
        throw new Error(`Resend error (${response.status}): ${body}`);
    }

    const data = await response.json();
    console.log(`[Email] Sent via Resend to ${to}: "${subject}" (id=${data.id})`);
    return true;
}

module.exports = { sendEmail, EMAIL_FROM };
