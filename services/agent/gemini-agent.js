/**
 * Gemini tool-use transport for the agentic builder (Vertex AI generateContent).
 *
 * This is a SIBLING of services/ai-gateway.js — that file's `generateContent`
 * is left untouched. Here we reuse the exact Vertex auth + URL shape from
 * ai-gateway.js `geminiLegacyFallback` (GoogleAuth -> getAccessToken ->
 * .../models/${model}:generateContent) and add the two things it lacks:
 *
 *   1. `callGemini(...)`     — a single structured (optionally multimodal) call,
 *                              used for the PLAN and CRITIQUE steps.
 *   2. `runGeminiAgent(...)` — a bounded function-call loop: the model may call
 *                              JS tools (declared as functionDeclarations) and
 *                              we feed results back until it returns text.
 *
 * Notes on the Gemini wire format (differs from OpenAI):
 *   - Content.role MUST be 'user' or 'model'. Function RESULTS are sent back in
 *     a 'user' turn whose parts contain { functionResponse: { name, response } }.
 *   - `response` must be a JSON object (struct), so we wrap scalars/strings.
 *   - Protobuf-JSON accepts snake_case (inline_data/mime_type — as already used
 *     by ai-architect.js) and camelCase (functionCall/functionDeclarations).
 *
 * Required env: GCP_PROJECT (+ Application Default Credentials, e.g.
 * GOOGLE_APPLICATION_CREDENTIALS or `gcloud auth application-default login`).
 */
require('dotenv').config();
const { GoogleAuth } = require('google-auth-library');

const VERTEX_LOCATION = process.env.GCP_LOCATION || 'global';
const DEFAULT_TIMEOUT_MS = 120000;

// Optional: route Vertex calls through Cloudflare AI Gateway (unified logging,
// caching, rate-limiting, cost tracking alongside the Kimi/Workers AI traffic).
// Set CF_AI_GATEWAY_ID (+ CF_ACCOUNT_ID) to enable; CF_AIG_TOKEN only if the
// gateway is authenticated. The gateway forwards the body verbatim, so
// tool-calling + inline_data screenshots are unaffected.
//
// Two auth modes:
//   - Pass-through (default): we mint a Google OAuth token via ADC and send it
//     in the Authorization header; the gateway proxies it to Vertex.
//   - BYOK (CF_AIG_BYOK=1): Google credentials are STORED IN the gateway, so we
//     send NO Google token and NO ADC is needed — only cf-aig-authorization.
//     This removes the google-auth-library / GOOGLE_APPLICATION_CREDENTIALS
//     requirement entirely. Requires CF_AI_GATEWAY_ID + CF_AIG_TOKEN.
const CF_AI_GATEWAY_ID = process.env.CF_AI_GATEWAY_ID || null;
const CF_AIG_TOKEN = process.env.CF_AIG_TOKEN || null;
const CF_AIG_BYOK = /^(1|true|yes)$/i.test(process.env.CF_AIG_BYOK || '');

let _authClient = null;
async function getVertexToken() {
    if (!_authClient) {
        const auth = new GoogleAuth({ scopes: ['https://www.googleapis.com/auth/cloud-platform'] });
        _authClient = await auth.getClient();
    }
    const { token } = await _authClient.getAccessToken();
    if (!token) throw new Error('Failed to obtain Vertex AI access token (check ADC / GOOGLE_APPLICATION_CREDENTIALS)');
    return token;
}

function vertexUrl(model) {
    const projectId = process.env.GCP_PROJECT;
    if (!projectId) throw new Error('GCP_PROJECT not set — required for the Gemini agent');
    const vertexPath = `/v1/projects/${projectId}/locations/${VERTEX_LOCATION}` +
        `/publishers/google/models/${model}:generateContent`;
    if (CF_AI_GATEWAY_ID) {
        const acct = process.env.CF_ACCOUNT_ID;
        if (!acct) throw new Error('CF_ACCOUNT_ID required when CF_AI_GATEWAY_ID is set');
        return `https://gateway.ai.cloudflare.com/v1/${acct}/${CF_AI_GATEWAY_ID}/google-vertex-ai${vertexPath}`;
    }
    return `https://aiplatform.googleapis.com${vertexPath}`;
}

/**
 * Build the request headers for a Vertex generateContent call, honoring the
 * pass-through vs BYOK auth modes. Exported so the BYOK branch can be tested
 * without ADC. In BYOK mode this never calls getVertexToken().
 */
async function authHeaders() {
    const headers = { 'Content-Type': 'application/json' };
    if (CF_AIG_BYOK) {
        if (!CF_AI_GATEWAY_ID || !CF_AIG_TOKEN) {
            throw new Error('CF_AIG_BYOK is set but requires CF_AI_GATEWAY_ID and CF_AIG_TOKEN (gateway holds the Google credentials).');
        }
        headers['cf-aig-authorization'] = `Bearer ${CF_AIG_TOKEN}`; // no Google token / no ADC
        return headers;
    }
    headers['Authorization'] = `Bearer ${await getVertexToken()}`;
    if (CF_AIG_TOKEN) headers['cf-aig-authorization'] = `Bearer ${CF_AIG_TOKEN}`;
    return headers;
}

function mergeUsage(acc, meta) {
    if (!meta) return acc;
    return {
        promptTokenCount: (acc.promptTokenCount || 0) + (meta.promptTokenCount || 0),
        candidatesTokenCount: (acc.candidatesTokenCount || 0) + (meta.candidatesTokenCount || 0),
        totalTokenCount: (acc.totalTokenCount || 0) + (meta.totalTokenCount || 0),
        calls: (acc.calls || 0) + 1,
    };
}

/**
 * Low-level POST to Vertex generateContent. Returns the parsed JSON response.
 */
async function postGenerateContent(model, body, timeoutMs = DEFAULT_TIMEOUT_MS) {
    const headers = await authHeaders();
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), timeoutMs);
    try {
        const resp = await fetch(vertexUrl(model), {
            method: 'POST',
            headers,
            body: JSON.stringify(body),
            signal: ctrl.signal,
        });
        if (!resp.ok) {
            const errText = await resp.text();
            throw new Error(`Gemini (${model}) error ${resp.status}: ${errText.slice(0, 500)}`);
        }
        return await resp.json();
    } catch (e) {
        if (e.name === 'AbortError') throw new Error(`Gemini (${model}) timeout after ${timeoutMs}ms`);
        throw e;
    } finally {
        clearTimeout(timer);
    }
}

function textFromParts(parts = []) {
    return parts.filter(p => typeof p.text === 'string').map(p => p.text).join('');
}

/**
 * Single structured Gemini call (no tool loop). Used for PLAN and CRITIQUE.
 *
 * @param {object} opts
 * @param {string} [opts.systemInstruction]
 * @param {Array}  [opts.parts]   - Gemini-shaped parts: [{text}, {inline_data:{mime_type,data}}]
 * @param {string} [opts.prompt]  - shorthand for parts=[{text:prompt}]
 * @param {string} [opts.model]
 * @param {boolean}[opts.json]    - request application/json output
 * @param {object} [opts.responseSchema] - optional JSON schema for structured output
 * @param {number} [opts.temperature]
 * @param {number} [opts.maxTokens]
 * @param {number} [opts.timeoutMs]
 * @returns {Promise<{ text:string, json:object|null, finishReason:string, usage:object|null }>}
 */
async function callGemini(opts = {}) {
    const {
        systemInstruction, parts, prompt, model = 'gemini-2.5-flash',
        json = false, responseSchema = null, temperature = 0.4,
        maxTokens = 8192, timeoutMs = DEFAULT_TIMEOUT_MS, thinkingLevel = null,
    } = opts;

    const userParts = parts || [{ text: prompt || '' }];
    const generationConfig = { temperature, maxOutputTokens: maxTokens, topP: 0.95 };
    if (json || responseSchema) generationConfig.responseMimeType = 'application/json';
    if (responseSchema) generationConfig.responseSchema = responseSchema;
    // Gemini 3 reasoning effort (low|medium|high). Lowering it cuts latency on
    // straightforward tasks like HTML generation. Nested under thinkingConfig.
    if (thinkingLevel) generationConfig.thinkingConfig = { thinkingLevel };

    const body = { contents: [{ role: 'user', parts: userParts }], generationConfig };
    if (systemInstruction) body.systemInstruction = { parts: [{ text: systemInstruction }] };

    const data = await postGenerateContent(model, body, timeoutMs);
    const candidate = data.candidates?.[0];
    const text = textFromParts(candidate?.content?.parts).trim();
    let parsed = null;
    if (json || responseSchema) {
        try {
            parsed = JSON.parse(text.replace(/^```(?:json)?\s*/i, '').replace(/\s*```\s*$/i, ''));
        } catch (_) { parsed = null; }
    }
    return {
        text,
        json: parsed,
        finishReason: candidate?.finishReason || 'STOP',
        usage: data.usageMetadata || null,
    };
}

/**
 * Bounded function-call loop. The model is given `tools` (functionDeclarations)
 * and may emit functionCall parts; we execute the matching `toolExecutors` and
 * feed results back, looping until the model returns text or `maxSteps` hits.
 *
 * @param {object} opts
 * @param {string} [opts.systemInstruction]
 * @param {Array}  opts.userParts                 - initial user turn parts
 * @param {Array}  [opts.history]                 - prior turns [{role:'user'|'model', parts}] prepended before userParts (multi-turn chat)
 * @param {Array}  opts.tools                      - [{ name, description, parameters }]
 * @param {Object<string,Function>} opts.toolExecutors - name -> async (args) => result
 * @param {string} [opts.model]
 * @param {number} [opts.maxSteps]
 * @param {boolean}[opts.json]
 * @param {object} [opts.responseSchema]
 * @param {Function}[opts.onStep]                  - (info) => void, for logging/transcript
 * @returns {Promise<{ text, json, toolCalls:Array, usage, steps:number }>}
 */
async function runGeminiAgent(opts = {}) {
    const {
        systemInstruction, userParts, history = [], tools = [], toolExecutors = {},
        model = 'gemini-2.5-flash', maxSteps = 8, temperature = 0.4,
        maxTokens = 8192, json = false, responseSchema = null,
        timeoutMs = DEFAULT_TIMEOUT_MS, onStep = () => {}, thinkingLevel = null,
    } = opts;

    const generationConfig = { temperature, maxOutputTokens: maxTokens, topP: 0.95 };
    if (json || responseSchema) generationConfig.responseMimeType = 'application/json';
    if (responseSchema) generationConfig.responseSchema = responseSchema;
    if (thinkingLevel) generationConfig.thinkingConfig = { thinkingLevel };

    const contents = [...history, { role: 'user', parts: userParts }];
    const toolConfig = { functionCallingConfig: { mode: 'AUTO' } };
    const toolBlock = tools.length ? [{ functionDeclarations: tools }] : undefined;

    const toolCalls = [];
    let usage = {};

    for (let step = 0; step < maxSteps; step++) {
        const body = { contents, generationConfig, toolConfig };
        if (systemInstruction) body.systemInstruction = { parts: [{ text: systemInstruction }] };
        if (toolBlock) body.tools = toolBlock;

        const data = await postGenerateContent(model, body, timeoutMs);
        usage = mergeUsage(usage, data.usageMetadata);
        const candidate = data.candidates?.[0];
        const parts = candidate?.content?.parts || [];
        const calls = parts.filter(p => p.functionCall).map(p => p.functionCall);

        if (calls.length === 0) {
            // Terminal: model returned a (possibly empty) text answer.
            const text = textFromParts(parts).trim();
            let parsed = null;
            if (json || responseSchema) {
                try { parsed = JSON.parse(text.replace(/^```(?:json)?\s*/i, '').replace(/\s*```\s*$/i, '')); } catch (_) {}
            }
            onStep({ step, type: 'final', textLen: text.length });
            return { text, json: parsed, toolCalls, usage, steps: step + 1 };
        }

        // Record the model's tool-call turn verbatim, then answer each call.
        contents.push(candidate.content);
        const responseParts = [];
        for (const call of calls) {
            const exec = toolExecutors[call.name];
            let result;
            if (!exec) {
                result = { error: `No executor registered for tool "${call.name}"` };
            } else {
                try {
                    result = await exec(call.args || {});
                } catch (e) {
                    result = { error: String(e.message || e) };
                }
            }
            // functionResponse.response must be a JSON object.
            const responseObj = (result && typeof result === 'object' && !Array.isArray(result))
                ? result : { result };
            toolCalls.push({ name: call.name, args: call.args || {}, result: responseObj });
            onStep({ step, type: 'tool', name: call.name });
            responseParts.push({ functionResponse: { name: call.name, response: responseObj } });
        }
        contents.push({ role: 'user', parts: responseParts });
    }

    // maxSteps exhausted without a terminal text answer — degrade gracefully.
    onStep({ step: maxSteps, type: 'max-steps' });
    return { text: '', json: null, toolCalls, usage, steps: maxSteps };
}

module.exports = { callGemini, runGeminiAgent, getVertexToken, vertexUrl, authHeaders };
