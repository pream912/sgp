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
*   **AI Provider:** Google Vertex AI via `@google-cloud/vertexai`
    *   **Model:** `gemini-2.0-flash-exp` (High performance, large context)
    *   **Region:** `us-central1` (Hardcoded for availability)
    *   **Settings:** `maxOutputTokens: 16384` (To prevent truncation)
*   **File Ops:** `fs-extra`
*   **Deployment:** Local Preview / Vercel API

### B. The Generated Sites (The Output)
*Lightweight, high-performance static sites.*

*   **Structure:** Single File HTML5 (`index.html`) + Vanilla JS
*   **Styling:** Tailwind CSS 3.4.1 (Built via CLI)
*   **Icons:** FontAwesome 6.5.1 (CDN)
*   **Fonts:** Google Fonts (Injected dynamically)

---

## 2. Directory Structure

```text
/
├── server.js                 # Express entry point
├── .env                      # GCP_PROJECT, GOOGLE_CLOUD_LOCATION
├── services/
│   ├── ai-architect.js       # Gemini: Generates JSON Design System
│   ├── ai-coder.js           # Gemini: Writes HTML5 Code (HTML generation & validation)
│   ├── builder.js            # Orchestrates: Copy Skeleton -> AI Code -> Tailwind CLI
│   └── ...
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

## 4. Coding Standards (Backend)

*   **Async/Await**: Use for all File I/O and API calls.
*   **Error Handling**: Wrap all builder logic in `try/catch`. 
*   **Model Config**: Use `us-central1` and `gemini-2.0-flash-exp` for reliability.
*   **Security**: Never log raw API keys.

---

## 5. Implementation Tasks (Updated)

**Task: Initialize Project**
> "Scaffold the Node.js project structure, installing backend dependencies (express, fs-extra, @google-cloud/vertexai, dotenv)."

**Task: Create HTML Skeleton**
> "Create `templates/html-skeleton`. Install `tailwindcss` locally. Create `tailwind.config.js` and `src/input.css`."

**Task: Implement AI Service**
> "Write `services/ai-coder.js` using `gemini-2.0-flash-exp`. Implement `generateCode` with a strict system prompt for HTML/Tailwind and a validation check for truncated output."

**Task: Implement Builder**
> "Write `services/builder.js`. Implement the symlink optimization for `node_modules`. Execute the local Tailwind binary directly (`./node_modules/.bin/tailwindcss`) to avoid npx issues."