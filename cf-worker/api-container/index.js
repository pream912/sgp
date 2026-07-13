/**
 * GenWeb API Container — entrypoint Worker.
 *
 * Wraps the Express app (server.js) running inside a Cloudflare Container.
 * The site-router Worker binds to this script via `script_name = "genweb-api"`
 * and forwards /api/*, /sites/*, and api.genweb.in traffic to it.
 */

import { Container } from '@cloudflare/containers';

// Keys from the Worker env that get forwarded into the container as env vars.
// We only forward string values (skip bindings like R2 buckets / DOs).
function buildContainerEnv(env) {
    const out = {};
    for (const [k, v] of Object.entries(env || {})) {
        if (typeof v === 'string' || typeof v === 'number' || typeof v === 'boolean') {
            out[k] = String(v);
        }
    }
    return out;
}

export class GenwebApiContainer extends Container {
    defaultPort = 8080;
    sleepAfter = '30m';

    constructor(state, env) {
        super(state, env);
        // Propagate Worker env (vars + secrets) into the container process.
        this.envVars = buildContainerEnv(env);
    }
}

export default {
    async fetch(request, env) {
        const id = env.API_CONTAINER.idFromName('genweb-api');
        const stub = env.API_CONTAINER.get(id);
        return stub.fetch(request);
    },
};
