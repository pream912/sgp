# GEMINI.md - Project Context & Directives

## Project Overview
**Name:** AI Static Site Generator (The "Headless Builder")
**Goal:** A Node.js backend that generates unique, production-grade static websites (React + Tailwind) based on user prompts, builds them using Vite, and deploys them to Vercel.
**Core Mechanic:** "Just-in-Time" generation with a Self-Healing Build Loop (Build -> Error -> AI Fix -> Retry).

---

## 1. The Strict Tech Stack (Bill of Materials)

### A. The Backend (Our Infrastructure)
*   **Runtime:** Node.js 20.x (LTS)
*   **Framework:** Express.js
*   **AI Provider:** Google Vertex AI (Gemini 1.5 Pro/Flash) via `@google-cloud/vertexai`
*   **File Ops:** `fs-extra`
*   **Deployment:** Vercel API (REST)

### B. The Generated Sites (The Output)
*All generated code must be compatible with these EXACT versions defined in `skeleton-project/package.json`.*

| Dependency | Version | Constraint |
| :--- | :--- | :--- |
| **React** | `18.2.0` | Functional components + Hooks only. |
| **Vite** | `5.2.0` | Used for the build process. |
| **Tailwind CSS** | `3.4.1` | Use arbitrary values (`bg-[#x]`) and `size-*`. |
| **Framer Motion** | `11.0.8` | `import { motion } from 'framer-motion'` |
| **Lucide React** | `0.363.0` | `import { Icon } from 'lucide-react'` |

---

## 2. Directory Structure

```text
/
├── server.js                 # Express entry point
├── .env                      # GCP_PROJECT, VERCEL_TOKEN, GODADDY_KEY
├── services/
│   ├── ai-architect.js       # Gemini: Generates JSON Design System
│   ├── ai-coder.js           # Gemini: Writes React Code & Fixes Errors
│   ├── builder.js            # Orchestrates Copy -> Write -> Build -> Retry
│   ├── deploy.js             # Uploads 'dist' folder to Vercel
│   └── domains.js            # GoDaddy API wrappers
├── templates/
│   └── skeleton-project/     # THE SOURCE OF TRUTH
│       ├── node_modules/     # Pre-installed dependencies (Speed optimization)
│       ├── package.json      # Locked versions
│       ├── vite.config.js    # Standard build config
│       ├── index.html        # HTML shell
│       └── src/
│           └── index.css     # Tailwind directives
└── temp/                     # Ephemeral build artifacts (Deleted after deploy)
```

---

## 3. Workflow & Logic Rules

### Phase 1: Design (JSON)
*   **Input**: User Business Info.
*   **Process**: AI generates a `DesignSystem` JSON (Colors, Fonts, Layout Vibe).
*   **Rule**: Ensure colors are Tailwind-friendly hex codes and **STRICTLY adhere to WCAG AA contrast standards**.

### Phase 2: Code Generation (JSX)
*   **Input**: `DesignSystem` + `User Context`.
*   **Process**: AI writes a **Single File** `App.jsx`.
*   **Strict constraints for the AI Model**:
    1.  No Markdown blocks in output.
    2.  No external CSS imports (except standard library).
    3.  Images must use the `imageUrls` array provided by the backend (fetched from Unsplash). Fallback to `pollinations.ai` if empty.
    4.  Use defined Tailwind theme colors (e.g., `bg-primary`, `text-secondary`) as configured in `tailwind.config.js`.
    5.  **Text Visibility**: When placing text over background images, use a dark overlay (e.g., `bg-black/50`) or text shadow.

### Phase 3: The Self-Healing Build Loop
1.  Copy `skeleton-project` to `temp/{id}`.
2.  Inject generated `App.jsx` and `main.jsx`.
3.  Inject dynamic `tailwind.config.js` with fonts and color palette.
4.  Run `npm run build` (Vite).
5.  **IF FAIL**:
    *   Capture `stderr`.
    *   Send Code + Error Log back to Gemini (`services/ai-coder.js`).
    *   Overwrite `App.jsx` with the "Fixed" code.
    *   Retry (Max 3 attempts).
6.  **IF SUCCESS**: Return path to `dist/`.

---

## 4. Coding Standards (Backend)

*   **Async/Await**: Use for all File I/O and API calls.
*   **Error Handling**: Wrap all builder logic in `try/catch`. Ensure `temp/` folders are cleaned up in `finally` blocks.
*   **Prompts**: Store long system prompts as constants (`const SYSTEM_PROMPT = ...`) to keep code readable.
*   **Security**: Never log raw API keys.

---

## 5. Implementation Tasks (Copy-Paste for CLI)

**Task: Initialize Project**
> "Scaffold the Node.js project structure defined in GEMINI.md, creating the folders and installing backend dependencies (express, fs-extra, @google-cloud/vertexai, dotenv)."

**Task: Create Skeleton**
> "Create the `templates/skeleton-project` folder. Generate the `package.json` with the STRICT VERSIONS listed in GEMINI.md. Create the `vite.config.js` and `src/index.css` with Tailwind directives."

**Task: Implement AI Service**
> "Write `services/ai-coder.js`. It needs two functions: `generateCode(context)` and `fixCode(badCode, errorLog)`. Use the Vertex AI SDK. Ensure strict system prompts that forbid markdown formatting."

**Task: Implement Builder**
> "Write `services/builder.js`. Implement the 'Self-Healing Loop'. It should copy the skeleton, write the AI code, spawn a child process to run `npm run build`, and handle retries if the exit code is not 0."
