# Genni Redesign — Deploy Checklist

Everything below requires the production environment (local `.env` has placeholder D1 credentials, so these could not run locally).

## 1. Database migration (before deploying the new server)
```bash
# Backup first
wrangler d1 export genweb-db --remote --output backup-pre-genni.sql
# Apply (additive-only; old server keeps working against the new schema)
wrangler d1 execute genweb-db --remote --file=cf-worker/migrations/0002-genni-redesign.sql
```
Adds: `users.preferred_language` / `free_build_used`, `projects.pipeline` / `compile_state` / `is_free_build`, tables `genni_conversations` + `genni_messages`, seeds `platform_config.build_pipeline`, and backfills `free_build_used=1` for users with existing projects.

## 2. Environment (already in env.yaml / .env)
- `AGENT_CODEGEN=gemini` — agent pipeline codegen (~3–6 min single-page builds)
- `AGENT_RENDER_MODE=raw-html`
- Optional: `GENNI_MODEL` (default `gemini-3.5-flash`), `TAILWIND_RUNTIME_URL` (default resolves via platform_config → pinned fallback)

## 3. Tailwind runtime config pointer (one-time, optional)
The asset is already live at
`https://pub-r2.genweb.in/genweb-hosting/assets/tailwind/v3.4.17/play.min.js`
(uploaded with immutable caching). To also record it in platform_config:
```bash
node scripts/update-tailwind-runtime.js   # run where D1 creds are available
```
Not strictly required — the code falls back to the pinned URL.

## 4. Staged rollout (flags in platform_config `build_pipeline`)
Start state (as seeded): `{"engine":"legacy","freeFirstBuild":false,"tailwindRuntimeDrafts":false}`

1. **Admin testing**: admins can force the agent engine per-request with header `X-Build-Engine: agent` on POST /api/build. Build 5–10 sites, open each in the editor, run a section edit.
2. **Flip the engine**: set `"engine":"agent"` — new builds use the agent pipeline (per-project `pipeline` column keeps retry semantics for old projects).
3. **Enable free first build**: set `"freeFirstBuild":true` — new users' first build = home page only, 0 credits (consumed only on success).
4. **Enable runtime drafts**: set `"tailwindRuntimeDrafts":true` — editor edits skip the Tailwind CLI (draft rebuild ~0.3s vs ~1.2s+); publish always compiles static CSS and strips the runtime script.
5. Keep legacy `runBuildProcess` for a 30-day soak before deleting.

## 5. Post-deploy verification
- `curl -N "https://api.genweb.in/api/stream?token=..."` during a build → expect `project:progress` and `project:preview` events.
- New-user signup → language picker → Tamil search "A2B Adyar Chennai" → select → skip through → build starts free → `/build/:id` shows live screenshots.
- Genni widget: "how many credits do I have" → tool round-trip; "add a contact page to <site>" → confirmation card → confirm deducts exactly 100 via the `credits` SSE event.
- Publish a runtime-draft project → live HTML must reference `style.css` and contain no `play.min.js`.
- Mobile: 360×740 viewport — chat input stays visible with keyboard open, build screen single-column.

## Notes
- `services/page-service.js` now enforces project **ownership** on add-page / section-redesign (the old route bodies didn't) — worth mentioning in release notes.
- Boot sweep marks `starting/processing` projects older than 45 min as failed ("Build interrupted — please retry").
- Genni conversations/messages accumulate in D1; consider a retention cron later.
