# UI Generation Prompt for AI Headless Builder

**Application Concept:**
A modern, professional SaaS dashboard for an AI-powered static website builder. Users can generate complete websites from a single prompt, edit them using a visual interface, and manage hosting/domains.

**Design System & Aesthetic:**
*   **Style:** Clean, Minimalist, Enterprise SaaS (Linear-like or Vercel-like).
*   **Color Palette:**
    *   Primary: Indigo/Violet (`indigo-600`).
    *   Background: White/Gray-50 (Light Mode), Gray-900 (Dark Mode).
    *   Surface: White (Cards, Modals) with subtle shadows.
    *   Text: Slate-900 (Headings), Slate-500 (Body).
*   **Typography:** Inter or System Sans-Serif. Clean, readable, with good hierarchy.
*   **Components:** Rounded corners (`rounded-lg`), subtle borders, skeleton loaders for AI states.

## Screen Descriptions

### 1. Authentication Screen
*   **Layout:** Split screen. Left side contains the login form; Right side is a marketing banner or abstract 3D visual.
*   **Components:**
    *   "Sign in to your account" header.
    *   **Phone Number Input:** Primary login method. Country Code selector (default +91) + Mobile Number field.
    *   "Send OTP" button.
    *   **OTP Verification:** 6-digit input field appearing after sending OTP.
    *   **Additional Info (Post-Signup):** "Email Address" field (Optional/Required for notifications) shown only if it's a new user.

### 2. Main Dashboard
*   **Layout:** Top Navigation Bar + Main Content Area.
*   **Navbar:**
    *   Logo (Left).
    *   Links: "Projects", "Domains".
    *   Right Actions: "Credits: 500" (Badge), Theme Toggle (Sun/Moon), User Avatar.
*   **Content:**
    *   **Header:** "Your Projects" title with "New Project" (Primary CTA) and "Buy Credits" (Secondary) buttons.
    *   **Project Grid:** A responsive grid of cards.
    *   **Project Card:**
        *   **Top:** Project Name/Query (Truncated). Status Badge (Live/Draft/Building).
        *   **Middle:** Date created.
        *   **Bottom Actions:** Row of icons/buttons: "Edit" (Pencil), "Leads" (Inbox), "Connect Domain" (Globe), "Publish" (Cloud).

### 3. Builder Wizard (New Project)
*   **Layout:** Centered modal or focused page.
*   **Steps:**
    1.  **Input:** Large text area for "Describe your business" or Input for "Business URL".
    2.  **Configuration:**
        *   **Pages Selection:** Checkbox group (Home, About, Services, Contact).
        *   **Style Preset:** Radio cards showing mini visual previews of styles (Minimal, Bold, Corporate).
    3.  **Building State:** A terminal-like log view or a progress bar showing steps ("Generating Design...", "Writing Code...", "Compiling CSS...").

### 4. Visual Editor
*   **Layout:** Full-screen interface.
*   **Sidebar (Left/Right):**
    *   **Tabs:** "Content", "Theme", "Settings".
    *   **Content Tab:** List of sections (Hero, Features, Footer). Click to edit.
    *   **Theme Tab:** Color pickers for Primary, Secondary, Background colors. "Regenerate Palette" button.
*   **Main Area:**
    *   **Canvas:** An `iframe` displaying the generated website.
    *   **Overlay Controls:** When hovering over a section in the preview, show "Regenerate Section" (AI Icon) or "Edit Content" buttons.

### 5. Domain Management
*   **Layout:** Two tabs or sections: "Buy Domain" and "My Domains".
*   **Search:** Large search bar "Find your perfect domain".
*   **Results:** List items showing Domain Name, Status (Available/Taken), Price, and "Buy" button.
*   **My Domains:** Table listing purchased domains with Status (Active), Expiry Date, and DNS Settings button.

### 6. Modals
*   **Leads Modal:** A clean list/table of form submissions from the user's website. Columns: Name, Email, Date, Message snippet.
*   **Connect Domain Modal:**
    *   **Header:** "Connect Custom Domain".
    *   **Instruction:** "Add an A Record pointing to [IP_ADDRESS]".
    *   **Input:** Domain name field.
    *   **Action:** "Verify DNS" button (Loading spinner support).
    *   **Feedback:** Success message (Green checkmark) or Error alert (Red text).
