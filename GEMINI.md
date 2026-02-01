# GEMINI.md - Project Context & Directives

## Project Overview
**Name:** AI Static Site Generator (The "Headless Builder")
**Goal:** A Node.js backend that generates unique, production-grade static websites (HTML + Tailwind) based on user prompts, builds them using the Tailwind CLI, and deploys them.
**Core Mechanic:** "Just-in-Time" generation with a Robust Build Loop (Design -> HTML Gen -> Validation -> CSS Compile).

---

## 1. The Strict Tech Stack (Bill of Materials)

### A. The Backend (Our Infrastructure)
*   **Runtime:** Node.js 20.x (LTS)
*   **Framework:** Express.js
*   **Hosting:** Google Cloud Run (Containerized)
*   **AI Provider:** Google Vertex AI via `@google-cloud/vertexai`
    *   **Model:** `gemini-2.0-flash-exp` (High performance, large context)
    *   **Region:** `us-central1` (Hardcoded for availability)
    *   **Settings:** `maxOutputTokens: 16384` (To prevent truncation)
*   **Database:** Firebase Firestore & Auth
*   **File Ops:** `fs-extra`
*   **Deployment:** Cloudflare Pages (Direct Upload)

### B. The Generated Sites (The Output)
*Lightweight, high-performance static sites.*

*   **Structure:** Single File HTML5 (`index.html`) + Vanilla JS
*   **Styling:** Tailwind CSS 3.4.1 (Built via CLI)
*   **Icons:** FontAwesome 6.5.1 (CDN)
*   **Fonts:** Google Fonts (Injected dynamically)
*   **Hosting:** Cloudflare Pages (Global CDN, Instant SSL)

---

## 2. Directory Structure

```text
/
├── server.js                 # Express entry point
├── .env                      # GCP_PROJECT, CLOUDFLARE_API_TOKEN
├── services/
│   ├── ai-architect.js       # Gemini: Generates JSON Design System
│   ├── ai-coder.js           # Gemini: Writes HTML5 Code (HTML generation & validation)
│   ├── builder.js            # Orchestrates: Copy Skeleton -> AI Code -> Tailwind CLI
│   ├── cloudflare.js         # Cloudflare Pages & DNS Management
│   └── domains.js            # NameSilo API & Domain Purchasing
├── templates/
│   └── html-skeleton/        # THE SOURCE OF TRUTH
│       ├── node_modules/     # Pre-installed Tailwind CSS v3
│       ├── package.json      # Locked versions
│       ├── tailwind.config.js# Standard config
│       └── src/
│           └── input.css     # Tailwind directives
└── temp/                     # Ephemeral build artifacts
```

---

## 3. Workflow & Logic Rules

### Phase 1: Design (JSON)
*   **Input**: User Business Info.
*   **Process**: AI generates a `DesignSystem` JSON (Colors, Fonts, Layout Vibe).
*   **Rule**: Ensure colors are Tailwind-friendly hex codes and **STRICTLY adhere to WCAG AA contrast standards**.

### Phase 2: Code Generation (HTML)
*   **Input**: `DesignSystem` + `User Context`.
*   **Process**: AI writes a **Single File** `index.html`.
*   **Constraints**:
    1.  Semantic HTML5 (Complete document with `</html>`).
    2.  Vanilla JavaScript for interactivity (no frameworks).
    3.  Tailwind Utility Classes for all styling.
    4.  **No External CSS/Config:** Do NOT use Tailwind CDN or inline config.
    5.  **Output Size:** Ensure `maxOutputTokens` is high (16k+) to avoid truncation.

### Phase 3: The Instant Build Loop
1.  **Setup:** Copy `html-skeleton` to `temp/{id}`.
    *   **Optimization:** Symlink `node_modules` from template to temp (saves copy time).
2.  **Injection:** Write `index.html` and dynamic `tailwind.config.js`.
3.  **Validation:** Check if `index.html` ends with `</html>`. If not, retry generation.
4.  **Compilation:** Run `./node_modules/.bin/tailwindcss -i src/input.css -o dist/style.css --minify`.
5.  **Output:** `dist/` folder ready for deployment.

---

## 4. Architecture & Services

### Hosting & Deployment

#### A. Development & Storage (GCS)
*   **Strategy:** Google Cloud Storage (GCS) for persistence + Local Preview.
*   **Workflow:**
    1.  **Generation/Edit:** When a site is generated or edited, build artifacts (`dist/`) are uploaded to GCS (`projects/{id}/dist`).
    2.  **Preview:** The Editor loads the site from the local `public/sites/{id}` folder. If missing locally, it fetches from GCS.
    3.  **Updates:** Changes (AI edits, manual tweaks) trigger a rebuild and GCS upload. **Cloudflare is NOT updated yet.**

#### B. Production (Cloudflare Pages)
*   **Strategy:** Cloudflare Pages for live hosting.
*   **Trigger:** Only when the user explicitly clicks **"Publish"**.
*   **Process:**
    1.  Backend fetches the latest artifacts (from local source or GCS).
    2.  Uploads directly to Cloudflare Pages (`site-{id}`).
    3.  Updates the live URL (`deployUrl`) in Firestore.
*   **Note:** GCS is strictly for storage/backup. Never serve the live site directly from GCS buckets.

### Custom Domains & SSL (Cloudflare Managed)
*   **Component 1 (DNS & SSL):** Cloudflare handles all DNS and SSL automatically.
*   **Workflow:**
    1.  **Purchase:** User buys domain via NameSilo (Backend API).
    2.  **Zone Creation:** Backend creates a Zone in Cloudflare.
    3.  **Link:** Backend links the Domain to the Cloudflare Pages Project.
    4.  **Config:** User updates NameSilo Nameservers to Cloudflare's NS (or we automate if possible).
*   **Verification:** Cloudflare verifies ownership via NS delegation.
*   **Payments:** Razorpay.

---

## 5. Coding Standards (Backend)

*   **Async/Await**: Use for all File I/O and API calls.
*   **Error Handling**: Wrap all builder logic in `try/catch`. 
*   **Model Config**: Use `us-central1` and `gemini-2.0-flash-exp` for reliability.
*   **Security**: Never log raw API keys.