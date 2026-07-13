/**
 * AI Jobs Worker — async proxy for Workers AI.
 *
 * The genweb-api container can't keep one outbound HTTP request open >120s
 * (Cloudflare Containers cap egress at ~120s). This Worker accepts AI jobs,
 * stores them in D1, runs Workers AI via the in-process binding (no edge
 * timeout), and writes the result back. The container polls /jobs/:id for
 * the result.
 *
 * Routes (auth via shared header `X-Auth: <AI_JOB_WORKER_SECRET>`):
 *   POST /jobs       — submit a job; returns { jobId }
 *   GET  /jobs/:id   — fetch job status + result
 */

function unauthorized() {
    return new Response(JSON.stringify({ error: 'unauthorized' }), {
        status: 401, headers: { 'content-type': 'application/json' },
    });
}

function json(body, status = 200) {
    return new Response(JSON.stringify(body), {
        status, headers: { 'content-type': 'application/json' },
    });
}

function uuid() {
    return crypto.randomUUID();
}

async function runJob(jobId, env) {
    try {
        const row = await env.DB.prepare('SELECT model, prompt FROM ai_jobs WHERE id = ?').bind(jobId).first();
        if (!row) {
            console.warn(`[ai-jobs] job ${jobId} not found`);
            return;
        }

        await env.DB.prepare('UPDATE ai_jobs SET status = ? WHERE id = ?').bind('running', jobId).run();

        const params = JSON.parse(row.prompt);
        const aiInput = {
            messages: params.messages,
            max_tokens: params.max_tokens,
            temperature: params.temperature,
            stream: false,
        };
        if (params.response_format) {
            aiInput.response_format = params.response_format;
        }

        const startedAt = Date.now();
        console.log(`[ai-jobs] ${jobId} calling ${row.model} (maxTokens=${params.max_tokens})`);

        const aiResult = await env.AI.run(row.model, aiInput, {
            gateway: { id: 'genweb' },
        });

        const elapsed = Date.now() - startedAt;

        // Workers AI returns OpenAI-compatible chat shape under .choices[0].message.content
        // OR (older models) a flat .response string. Handle both.
        let text = '';
        let finishReason = 'stop';
        let usage = null;
        if (aiResult?.choices?.[0]?.message?.content) {
            text = aiResult.choices[0].message.content;
            finishReason = aiResult.choices[0].finish_reason || 'stop';
            usage = aiResult.usage || null;
        } else if (typeof aiResult?.response === 'string') {
            text = aiResult.response;
            usage = aiResult.usage || null;
        } else if (typeof aiResult === 'string') {
            text = aiResult;
        } else {
            text = JSON.stringify(aiResult);
        }

        console.log(`[ai-jobs] ${jobId} done in ${elapsed}ms (chars=${text.length})`);

        await env.DB.prepare(
            `UPDATE ai_jobs SET status = ?, result_text = ?, finish_reason = ?, usage_json = ?, completed_at = ? WHERE id = ?`
        ).bind(
            'done',
            text,
            finishReason,
            usage ? JSON.stringify(usage) : null,
            Date.now(),
            jobId,
        ).run();
    } catch (err) {
        console.error(`[ai-jobs] ${jobId} failed:`, err.message);
        try {
            await env.DB.prepare(
                `UPDATE ai_jobs SET status = ?, error = ?, completed_at = ? WHERE id = ?`
            ).bind('failed', String(err.message || err), Date.now(), jobId).run();
        } catch (e2) {
            console.error(`[ai-jobs] ${jobId} also failed to write error:`, e2.message);
        }
    }
}

export default {
    async fetch(request, env, ctx) {
        const expected = env.AI_JOB_WORKER_SECRET;
        if (!expected || request.headers.get('x-auth') !== expected) {
            return unauthorized();
        }

        const url = new URL(request.url);

        // POST /jobs
        if (request.method === 'POST' && url.pathname === '/jobs') {
            let body;
            try { body = await request.json(); } catch { return json({ error: 'invalid json body' }, 400); }
            if (!body.model || !Array.isArray(body.messages)) {
                return json({ error: 'model and messages[] are required' }, 400);
            }

            const jobId = uuid();
            const promptJson = JSON.stringify({
                messages: body.messages,
                max_tokens: body.max_tokens ?? 4096,
                temperature: body.temperature ?? 0.5,
                response_format: body.response_format || null,
            });

            try {
                await env.DB.prepare(
                    `INSERT INTO ai_jobs (id, model, prompt, status, created_at) VALUES (?, ?, ?, ?, ?)`
                ).bind(jobId, body.model, promptJson, 'pending', Date.now()).run();
            } catch (err) {
                return json({ error: `db insert failed: ${err.message}` }, 500);
            }

            ctx.waitUntil(runJob(jobId, env));
            return json({ jobId });
        }

        // GET /jobs/:id
        const getMatch = url.pathname.match(/^\/jobs\/([0-9a-f-]{36})$/i);
        if (request.method === 'GET' && getMatch) {
            const jobId = getMatch[1];
            const row = await env.DB.prepare(
                `SELECT id, model, status, result_text, finish_reason, usage_json, error, created_at, completed_at
                 FROM ai_jobs WHERE id = ?`
            ).bind(jobId).first();
            if (!row) return json({ error: 'not found' }, 404);

            return json({
                id: row.id,
                model: row.model,
                status: row.status,
                text: row.result_text,
                finish_reason: row.finish_reason,
                usage: row.usage_json ? JSON.parse(row.usage_json) : null,
                error: row.error,
                created_at: row.created_at,
                completed_at: row.completed_at,
            });
        }

        return json({ error: 'not found' }, 404);
    },
};
