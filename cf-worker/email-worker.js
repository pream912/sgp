/**
 * GenWeb Email Worker — Cloudflare Email Workers
 *
 * Receives email send requests from the Express API and sends via CF Email Routing.
 *
 * Bindings (in wrangler.email.toml):
 *   - EMAIL_WORKER_SECRET: shared secret for authentication (set via wrangler secret put)
 *   - SEND_EMAIL: Email Routing send_email binding
 */

import { EmailMessage } from 'cloudflare:email';

export default {
    async fetch(request, env) {
        // Only accept POST
        if (request.method !== 'POST') {
            return new Response('Method Not Allowed', { status: 405 });
        }

        // Auth check
        const authHeader = request.headers.get('Authorization');
        const expectedToken = `Bearer ${env.EMAIL_WORKER_SECRET}`;
        if (!authHeader || authHeader !== expectedToken) {
            return new Response('Unauthorized', { status: 401 });
        }

        try {
            const { to, subject, html, text, from } = await request.json();

            if (!to || !subject) {
                return new Response('Missing required fields: to, subject', { status: 400 });
            }

            const fromHeader = from || 'no-reply@genweb.in';
            const envelopeFrom = extractAddress(fromHeader);
            const envelopeTo = extractAddress(to);

            const mime = createMimeMessage({ from: fromHeader, to, subject, html, text });
            const message = new EmailMessage(envelopeFrom, envelopeTo, mime);

            await env.SEND_EMAIL.send(message);

            return Response.json({ success: true });
        } catch (error) {
            console.error('Email Worker error:', error);
            return Response.json({ error: error.message }, { status: 500 });
        }
    },
};

// EmailMessage's third arg must be a string (or ReadableStream).
function createMimeMessage({ from, to, subject, html, text }) {
    const boundary = '----=_Part_' + Date.now();
    let mime = '';
    mime += `From: ${from}\r\n`;
    mime += `To: ${to}\r\n`;
    mime += `Subject: ${subject}\r\n`;
    mime += `Message-ID: <${Date.now()}.${Math.random().toString(36).slice(2)}@genweb.in>\r\n`;
    mime += `Date: ${new Date().toUTCString()}\r\n`;
    mime += `MIME-Version: 1.0\r\n`;
    mime += `Content-Type: multipart/alternative; boundary="${boundary}"\r\n\r\n`;

    if (text) {
        mime += `--${boundary}\r\n`;
        mime += `Content-Type: text/plain; charset=utf-8\r\n\r\n`;
        mime += `${text}\r\n`;
    }
    if (html) {
        mime += `--${boundary}\r\n`;
        mime += `Content-Type: text/html; charset=utf-8\r\n\r\n`;
        mime += `${html}\r\n`;
    }
    mime += `--${boundary}--\r\n`;
    return mime;
}

// Strip "Name <addr>" to bare address for SMTP envelope.
function extractAddress(s) {
    const m = String(s).match(/<([^>]+)>/);
    return m ? m[1] : String(s).trim();
}
