# GenWeb Cloudflare Deploy Runbook

Run from a workstation with `wrangler` installed and authenticated.

```bash
npm install -g wrangler
wrangler login
```

## 0. Prereqs to confirm

- [ ] `genweb.in` is on Cloudflare DNS already (zone exists, NS records pointing to CF).
- [ ] You're on a CF account that has Workers Paid plan billable contact set.
- [ ] Cloudflare Containers beta is enabled on your account (request via dashboard if not).

## 1. Provision Cloudflare resources (CF dashboard + CLI)

### 1.1 Workers Paid plan
Dashboard → Workers & Pages → Plans → upgrade to Paid ($5/mo).

### 1.2 R2 buckets
```bash
wrangler r2 bucket create genweb-projects
wrangler r2 bucket create genweb-sites
wrangler r2 bucket create genweb-hosting
```

Then in the dashboard: R2 → genweb-projects/genweb-sites/genweb-hosting → Settings → "Public access" → connect a custom domain `pub-r2.genweb.in` (or note the auto-generated `pub-*.r2.dev` URL). Update `R2_PUBLIC_DOMAIN` in container env if you go with a different host.

### 1.3 R2 access key
Dashboard → R2 → Manage R2 API Tokens → Create API token → Read & Write on all three buckets. Save `Access Key ID` and `Secret Access Key`.

### 1.4 KV namespace for domain cache
```bash
wrangler kv namespace create DOMAIN_CACHE
```
Copy the returned `id` into `cf-worker/wrangler.toml` (replaces `REPLACE_WITH_KV_NAMESPACE_ID`).

### 1.5 AI Gateway
Dashboard → AI → AI Gateway → Create Gateway named `genweb`. Configure fallback chain: Workers AI (Kimi K2.6) → Google Vertex AI (Gemini 2.5 Pro). Save the gateway slug as `CF_AI_GATEWAY_ID` and generate a gateway token as `CF_AI_GATEWAY_TOKEN`.

### 1.6 Email Routing
Dashboard → genweb.in zone → Email → Email Routing → Enable. CF will add the SPF/MX records automatically. Add a verified destination address (e.g. your inbox) so the `send_email` binding can use it.

### 1.7 Generate API token
Dashboard → My Profile → API Tokens → Create token. Permissions:
- Workers Scripts: Edit
- Workers Routes: Edit
- Account R2: Edit
- Browser Rendering: Edit
- Workers AI: Run
- AI Gateway: Run
- Zone DNS: Edit (genweb.in)
- Account Email Routing: Edit

Save as `CF_API_TOKEN`.

### 1.8 Record IDs

```bash
# Account ID — top-right of dashboard
CF_ACCOUNT_ID=...

# Zone ID — Overview tab on genweb.in zone
CF_ZONE_ID=...

# AI Gateway ID — from step 1.5
CF_AI_GATEWAY_ID=genweb
```

Replace `REPLACE_WITH_CF_ACCOUNT_ID` in:
- `cf-worker/wrangler.toml`
- `cf-worker/wrangler.email.toml`
- `cf-worker/api-container/wrangler.toml`

## 2. Verify Dockerfile builds locally

```bash
cd /Users/pream/Documents/Projects/sgp1
docker build -t genweb-api .
docker run --rm -p 8080:8080 --env-file .env genweb-api
# in another shell:
curl http://localhost:8080/api/health
```

Confirm image size with `docker images genweb-api`. Target < 800MB compressed.

## 3. Set worker secrets

```bash
cd cf-worker

# site-router secrets
wrangler secret put FIREBASE_API_KEY

# email-worker secrets
wrangler secret put EMAIL_WORKER_SECRET --config wrangler.email.toml
```

```bash
cd cf-worker/api-container

# api container secrets — paste values when prompted
for s in CF_ACCOUNT_ID CF_API_TOKEN CF_AI_GATEWAY_ID CF_AI_GATEWAY_TOKEN \
         R2_ACCESS_KEY_ID R2_SECRET_ACCESS_KEY \
         CF_EMAIL_WORKER_URL CF_EMAIL_WORKER_SECRET \
         FIREBASE_API_KEY FIREBASE_SERVICE_ACCOUNT \
         RAZORPAY_KEY_ID RAZORPAY_KEY_SECRET \
         NAMESILO_KEY NAMESILO_ENV \
         GOOGLE_SEARCH_API_KEY GOOGLE_SEARCH_CX \
         PEXELS_API_KEY UNSPLASH_ACCESS_KEY \
         APP_URL EMAIL_FROM \
         BREVO_SMTP_HOST BREVO_SMTP_PORT BREVO_SMTP_USER BREVO_SMTP_KEY BREVO_SMTP_FROM; do
  wrangler secret put "$s"
done
```

`CF_EMAIL_WORKER_URL` is `https://email.genweb.in` once the email worker is deployed in the next step.

## 4. Deploy workers (in order)

```bash
# 1) Email worker first (its URL feeds CF_EMAIL_WORKER_URL on container).
cd cf-worker
wrangler deploy --config wrangler.email.toml --env production

# 2) API container — first deploy builds + pushes the docker image.
cd api-container
npm install
wrangler deploy --env production

# 3) Site router (binds to API container by script_name).
cd ..
wrangler deploy --env production
```

## 5. Migrate GCS data → R2

```bash
cd /Users/pream/Documents/Projects/sgp1
npm install --no-save @google-cloud/storage
export GOOGLE_APPLICATION_CREDENTIALS=$PWD/gen-web-484805-firebase-adminsdk-fbsvc-09578b335a.json

# Pass 1: copy everything while traffic still hits GCP
node scripts/migrate-gcs-to-r2.js

# Spot verification
node scripts/migrate-gcs-to-r2.js --verify

# Right before DNS cutover (next step), run delta pass:
# (skips files already present in R2 with matching size)
node scripts/migrate-gcs-to-r2.js
```

## 6. DNS cutover

In CF dashboard → genweb.in zone → DNS:

- [ ] Confirm `*` record (wildcard) is proxied to CF (orange cloud); the worker route handles it.
- [ ] Confirm `@` (apex) record is proxied; handled by worker route.
- [ ] Add/verify `api.genweb.in` proxied A/CNAME — the worker forwards to the container.
- [ ] Add `email.genweb.in` proxied to email worker (handled by route).
- [ ] If you have a `pub-r2.genweb.in` for R2 public access, confirm CNAME → R2 dev URL or attach via R2 → Custom domains.
- [ ] Remove the old GCP LB IP A record (`34.50.155.64`) — keep noted in case of rollback.

Watch traffic for 30 min:
```bash
wrangler tail genweb-site-router --format pretty
wrangler tail genweb-api --format pretty
```

## 7. Verification checklist

- [ ] `curl -I https://{existing-subdomain}.genweb.in` → `200`, `X-Served-By: genweb-cf-worker`.
- [ ] Visit a previously-registered custom domain → page loads, SSL is CF-issued.
- [ ] `curl -I https://api.genweb.in/api/health` → `200` from the container.
- [ ] Pick a Firestore project with `isExpired: true` → returns 403 expired-page HTML.
- [ ] Trigger a build from the UI:
  - [ ] AI Gateway dashboard shows Kimi K2.6 hits.
  - [ ] R2 `genweb-sites/{newProjectId}/` populates.
  - [ ] Preview thumbnail appears in `genweb-hosting/previews/{projectId}.jpg`.
  - [ ] Completion email arrives (sent by `services/email.js` → `email.genweb.in` → Email Routing).
- [ ] Search and purchase a `.com` domain → CF Registrar API used, custom domain auto-attached.
- [ ] Search a `.in` domain → NameSilo path still works.

## 8. GCP teardown (after 1 week of clean operation)

```bash
# Sanity: re-run verify mode and check for mismatches one more time
node scripts/migrate-gcs-to-r2.js --verify

# Then:
gcloud compute url-maps delete genweb-lb --quiet
gcloud compute backend-buckets list --format='value(name)' \
  | grep '^backend-site-' | xargs -I{} gcloud compute backend-buckets delete {} --quiet
gcloud certificate-manager maps delete genweb-cert-map --quiet
gcloud certificate-manager certificates list --format='value(name)' \
  | grep '^cert-' | xargs -I{} gcloud certificate-manager certificates delete {} --quiet
gcloud compute addresses delete genweb-lb-ip --quiet
gsutil ls | grep '^gs://site-' | xargs -I{} gsutil -m rm -r {}
gsutil -m rm -r gs://sgp1-projects-storage gs://sgp1-sites-hosting
gcloud run services delete sgp1-api --region us-central1 --quiet
```

## Rollback

If anything breaks within the cutover window:

1. **Restore old DNS**: in CF dashboard, change apex/wildcard A records back to `34.50.155.64` (DNS only, not proxied) — propagates within minutes.
2. The Cloud Run service is still running until step 8, so traffic returns to it.
3. R2 data is preserved; nothing is destroyed by this rollback.
