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
    *   **Region:** `asia-south1` (Mumbai)
    *   **Config:** Use `generate_env_yaml.js` to sync `.env` to `env.yaml` before deploy.
*   **AI Provider:** Google Vertex AI via `@google-cloud/vertexai`
    *   **Model:** `gemini-2.5-pro` (High performance, large context)
    *   **Region:** `us-central1` (Hardcoded for availability)
    *   **Settings:** `maxOutputTokens: 16384` (To prevent truncation)
*   **Database:** Firebase Firestore & Auth
*   **File Ops:** `fs-extra`
*   **Deployment:** Google Cloud Storage (Bucket per Site) + GCP External HTTPS LB

### B. The Generated Sites (The Output)
*Lightweight, high-performance static sites.*

*   **Structure:** Single File HTML5 (`index.html`) + Vanilla JS
*   **Styling:** Tailwind CSS 3.4.1 (Built via CLI)
*   **Icons:** FontAwesome 6.5.1 (CDN)
*   **Fonts:** Google Fonts (Injected dynamically)
*   **Hosting:** Google Cloud Storage (Served via Load Balancer)

---

## 2. Directory Structure

```text
/
├── server.js                 # Express entry point
├── .env                      # GCP_PROJECT, GCP_LB_IP
├── services/
│   ├── ai-architect.js       # Gemini: Generates JSON Design System
│   ├── ai-coder.js           # Gemini: Writes HTML5 Code (HTML generation & validation)
│   ├── builder.js            # Orchestrates: Copy Skeleton -> AI Code -> Tailwind CLI
│   ├── deploy.js             # GCS Deployment (Bucket Management)
│   └── domains.js            # NameSilo API & LB DNS Helper
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

### Hosting & Deployment Strategy

We utilize a hybrid hosting strategy leveraging **Google Cloud Storage (GCS)** for content and **Google Cloud Run** for dynamic routing.

#### A. Architecture Diagram
```mermaid
graph LR
    User -->|*.genweb.in| LB[GCP Load Balancer]
    User -->|custom-domain.com| LB
    LB -->|*.genweb.in| CloudRun[Node.js Backend]
    LB -->|custom-domain.com| BackendBucket[GCS Backend Bucket]
    CloudRun -->|Proxy| GCS[GCS Bucket: site-{id}]
```

#### B. Wildcard Subdomains (`*.genweb.in`)
*   **Goal:** Instant provision of unique subdomains (e.g., `myshop.genweb.in`) without modifying LB configuration per site.
*   **Infrastructure:**
    *   **DNS:** Wildcard A Record (`*`) -> GCP Load Balancer IP.
    *   **SSL:** GCP Certificate Manager (Wildcard Cert `*.genweb.in`).
    *   **Routing:** LB routes `*.genweb.in` to the **Cloud Run Backend Service**.
*   **Logic (`server.js`):**
    *   Middleware detects incoming `Host` header ending in `.genweb.in`.
    *   Excludes reserved subdomains (`www`, `app`, `api`).
    *   Extracts subdomain -> Queries Firestore for `projectId`.
    *   Streams content directly from `gs://site-{projectId}/index.html`.

#### C. Custom Domains (Production)
*   **Goal:** User connects their own domain (e.g., `myshop.com`).
*   **Infrastructure:**
    *   **Bucket:** Dedicated GCS Bucket `site-{projectId}` configured as a Website.
    *   **LB Configuration:** Specific Backend Bucket attached to the LB via URL Map.
    *   **SSL:** Google Managed Certificate for the specific domain.
*   **Workflow:**
    1.  User buys/connects domain.
    2.  Backend updates NameSilo DNS (A Record -> LB IP).
    3.  Backend/Admin updates LB URL Map to point `domain.com` -> `site-{id}` bucket.

#### D. Storage (GCS)
*   **Bucket Name:** `site-{projectId}`
*   **Access:** Public (`allUsers` Reader).
*   **Content:** `index.html`, `style.css`, `/assets`.
*   **Website Mode:** Enabled (`MainPageSuffix: index.html`).

---

## 5. Coding Standards (Backend)

*   **Async/Await**: Use for all File I/O and API calls.
*   **Error Handling**: Wrap all builder logic in `try/catch`. 
*   **Model Config**: Use `us-central1` and `gemini-2.0-flash-exp` for reliability.
*   **Security**: Never log raw API keys.
