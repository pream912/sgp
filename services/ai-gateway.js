/**
 * AI gateway — routes generateContent() to Cloudflare Workers AI via a direct
 * HTTPS call (OpenAI-compatible chat-completions endpoint).
 *
 * Why direct HTTPS (not the Workers binding, not the AI Gateway proxy):
 *   - The Express API now runs on Fly.io, not inside a CF Worker — there is no
 *     `env.AI` binding available. The OpenAI-compatible REST endpoint is the
 *     simplest server-side entrypoint.
 *   - Fly VMs have no outbound-fetch cap (CF Containers cut at ~120s), so we
 *     can wait the full 5–15 minutes Kimi K2.6 needs for a coder pass.
 *
 * Default model: @cf/moonshotai/kimi-k2.6
 * Fallback: geminiLegacyFallback (Vertex AI) for the rare case Workers AI errors.
 *
 * Required env: CF_ACCOUNT_ID, CF_API_TOKEN (scoped Workers AI: Read)
 */
require('dotenv').config();

const CF_WORKERS_AI_BASE = 'https://api.cloudflare.com/client/v4/accounts';
const DEFAULT_MODEL = '@cf/moonshotai/kimi-k2.6';
const TIMEOUT_MS = 20 * 60 * 1000; // 20 min — Kimi worst case is ~15 min

/**
 * Generate content via Cloudflare Workers AI (OpenAI-compatible chat-completions).
 *
 * @param {string} prompt
 * @param {object} options
 * @param {number} [options.maxTokens=8192]
 * @param {number} [options.temperature=0.5]
 * @param {string} [options.responseMimeType='text/plain'] - 'application/json' triggers json_object response_format
 * @param {Array}  [options.parts] - Multimodal parts in Gemini shape: [{ text }] or [{ inline_data: { mime_type, data } }]
 * @param {string} [options.model] - Override model id (e.g. '@cf/meta/llama-3.3-70b-instruct-fp8-fast')
 * @returns {Promise<{ text: string, finishReason: string, usage: object|null }>}
 */
async function generateContent(prompt, options = {}) {
    const {
        maxTokens = 8192,
        temperature = 0.5,
        responseMimeType = 'text/plain',
        parts = null,
        model = DEFAULT_MODEL,
    } = options;

    const accountId = process.env.CF_ACCOUNT_ID;
    const apiToken = process.env.CF_API_TOKEN;
    if (!accountId) throw new Error('CF_ACCOUNT_ID not set');
    if (!apiToken) throw new Error('CF_API_TOKEN not set');

    // Convert any Gemini-shaped `parts` into OpenAI-style multimodal content.
    // For text-only callers we just send a single user message with `prompt`.
    let userContent;
    if (parts && parts.length > 0) {
        userContent = parts.map(p => {
            if (p.inline_data) {
                return {
                    type: 'image_url',
                    image_url: { url: `data:${p.inline_data.mime_type};base64,${p.inline_data.data}` },
                };
            }
            return { type: 'text', text: p.text || '' };
        });
    } else {
        userContent = prompt;
    }

    const body = {
        model,
        messages: [{ role: 'user', content: userContent }],
        max_tokens: maxTokens,
        temperature,
        stream: false,
    };
    if (responseMimeType === 'application/json') {
        body.response_format = { type: 'json_object' };
    }

    const url = `${CF_WORKERS_AI_BASE}/${accountId}/ai/v1/chat/completions`;
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), TIMEOUT_MS);
    const startedAt = Date.now();

    try {
        console.log(`[AI Gateway] Calling ${model} (maxTokens=${maxTokens}, json=${responseMimeType === 'application/json'})...`);
        const response = await fetch(url, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${apiToken}`,
                'Content-Type': 'application/json',
            },
            body: JSON.stringify(body),
            signal: ctrl.signal,
        });

        if (!response.ok) {
            const errText = await response.text();
            throw new Error(`Workers AI error (${response.status}): ${errText.slice(0, 500)}`);
        }

        const data = await response.json();
        const choice = data.choices?.[0];
        if (!choice) {
            throw new Error(`No choices in Workers AI response: ${JSON.stringify(data).slice(0, 300)}`);
        }

        const text = choice.message?.content || '';
        const finishReason = (choice.finish_reason || 'stop').toUpperCase() === 'STOP'
            ? 'STOP'
            : (choice.finish_reason || 'stop');
        const usage = data.usage || null;

        console.log(`[AI Gateway] ${model} returned in ${Date.now() - startedAt}ms (chars=${text.length}, finish=${finishReason})`);

        return {
            text,
            finishReason,
            usage: usage ? {
                promptTokenCount: usage.prompt_tokens,
                candidatesTokenCount: usage.completion_tokens,
                totalTokenCount: usage.total_tokens,
                model,
                service: 'cf-workers-ai',
            } : null,
        };
    } catch (error) {
        const elapsed = Date.now() - startedAt;
        const reason = error.name === 'AbortError' ? `timeout after ${TIMEOUT_MS}ms` : error.message;
        console.warn(`[AI Gateway] Workers AI (${model}) failed after ${elapsed}ms: ${reason}. Trying Gemini Vertex fallback...`);
        return geminiLegacyFallback(prompt, options);
    } finally {
        clearTimeout(timer);
    }
}

/**
 * Fallback: call Gemini directly via Vertex AI REST. Only reached when
 * Workers AI errors (network, rate limit, model unavailable).
 */
async function geminiLegacyFallback(prompt, options = {}) {
    const {
        maxTokens = 8192,
        temperature = 0.5,
        responseMimeType = 'text/plain',
        parts = null,
        model = 'gemini-2.5-pro',
    } = options;

    const projectId = process.env.GCP_PROJECT;
    if (!projectId) throw new Error('Workers AI failed and GCP_PROJECT not set for Gemini fallback');

    const { GoogleAuth } = require('google-auth-library');
    const auth = new GoogleAuth({ scopes: ['https://www.googleapis.com/auth/cloud-platform'] });
    const client = await auth.getClient();
    const tokenResponse = await client.getAccessToken();
    const accessToken = tokenResponse.token;

    const url = `https://aiplatform.googleapis.com/v1/projects/${projectId}/locations/global/publishers/google/models/${model}:generateContent`;
    const contentParts = parts || [{ text: prompt }];

    const body = {
        contents: [{ role: 'user', parts: contentParts }],
        generationConfig: {
            maxOutputTokens: maxTokens,
            temperature,
            topP: 0.95,
        },
    };
    if (responseMimeType === 'application/json') {
        body.generationConfig.responseMimeType = 'application/json';
    }

    const GEMINI_TIMEOUT_MS = 120000;
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), GEMINI_TIMEOUT_MS);

    let response;
    try {
        response = await fetch(url, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${accessToken}`,
                'Content-Type': 'application/json',
            },
            body: JSON.stringify(body),
            signal: ctrl.signal,
        });
    } catch (e) {
        clearTimeout(timer);
        if (e.name === 'AbortError') throw new Error(`Gemini fallback timeout after ${GEMINI_TIMEOUT_MS}ms`);
        throw e;
    }
    clearTimeout(timer);

    if (!response.ok) {
        const errText = await response.text();
        throw new Error(`Gemini fallback error (${response.status}): ${errText.slice(0, 300)}`);
    }

    const data = await response.json();
    const candidate = data.candidates?.[0];
    if (!candidate) throw new Error('No response from Gemini fallback');

    return {
        text: candidate.content?.parts?.[0]?.text || '',
        finishReason: candidate.finishReason || 'STOP',
        usage: data.usageMetadata ? {
            promptTokenCount: data.usageMetadata.promptTokenCount,
            candidatesTokenCount: data.usageMetadata.candidatesTokenCount,
            totalTokenCount: data.usageMetadata.totalTokenCount,
            model,
            service: 'vertex-ai-fallback',
        } : null,
    };
}

module.exports = { generateContent };
