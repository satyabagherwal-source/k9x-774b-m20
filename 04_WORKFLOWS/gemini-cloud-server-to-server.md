# Server-to-Server 24/7 Google Gemini AI Engine

This system establishes a direct, autonomous **Server-to-Server connection between GitHub Actions (AI-Builder-Brain) and Google Gemini AI**, operating 24 hours a day, 7 days a week, completely independent of any local machine, laptop, or IDE.

---

## 1. High-Level Architecture

```
+-----------------------------------------------------------------------------------------+
|                                  GITHUB CLOUD (24/7/365)                                |
|                                                                                         |
|  [GitHub Actions Cron Runner] <------ Triggered every 2 hours (or on repos.txt push)   |
|            |                                                                            |
|            v                                                                            |
|  [Auto-Discovery Scout Engine] -----> Scouts trending repos across 4 domains           |
|            |                                                                            |
|            v                                                                            |
|  [Zero-Clone Harvester Engine] -----> Fetches code, commits, bug issues, PRs via REST  |
|            |                                                                            |
+------------|----------------------------------------------------------------------------+
             |
             | HTTPS POST Server-to-Server (Zero Laptop Needed)
             | Payload: Code diffs, closed bug issues, manifests, commits
             v
+-----------------------------------------------------------------------------------------+
|                                GOOGLE GEMINI AI SERVER                                  |
|                                                                                         |
|  [Gemini 2.0 Flash / 1.5 Flash Model API]                                               |
|            |                                                                            |
|            * Performs deep 8-dimensional forensic reasoning (D1-D8)                     |
|            * Uncovers micro-learnings, failure modes, runtime traps                     |
|            * Synthesizes net-new Universal Engineering Rules (Rules 72+)                |
|            * Formulates reusable agent implementation checklists & skills               |
|            |                                                                            |
+------------|----------------------------------------------------------------------------+
             |
             | Returns rich synthesized JSON/Markdown
             v
+-----------------------------------------------------------------------------------------+
|                                  AI-BUILDER-BRAIN GITHUB REPO                           |
|                                                                                         |
|  1. Writes forensic learning record -> 07_PROJECT_LEARNING/[slug]-learnings.md          |
|  2. Promotes net-new universal rules -> 05_KNOWLEDGE/engineering-patterns.md           |
|  3. Synthesizes reusable agent skills -> 03_SKILLS/                                     |
|  4. Updates sources registry -> 04_WORKFLOWS/factory-engine/sources-registry.json       |
|  5. Commits & pushes to 'main' branch automatically                                     |
+-----------------------------------------------------------------------------------------+
             |
             | Auto-Pull on Boot (Step 1 of AGENT_BOOT_PROTOCOL.md)
             v
+-----------------------------------------------------------------------------------------+
|                         LOCAL LAPTOP / ANTIGRAVITY IDE                                  |
|                                                                                         |
|  * User opens laptop anytime: all learnings are already synced and ready!              |
|  * User never has to leave laptop open or manually run learning prompts.                |
+-----------------------------------------------------------------------------------------+
```

---

## 2. 100% Free Tier Guaranteed

Google AI Studio provides a free API tier for Gemini models:
* **Rate Limits**: 15 RPM (Requests Per Minute), 1,000,000 TPM (Tokens Per Minute), 1,500 RPD (Requests Per Day).
* **Cost**: $0.00 (Zero paid API, zero credit card requirement).
* **Compliance**: Respectful pauses (1.5s - 3s) ensure rate limits are never exceeded.

---

## 3. One-Time Setup: Connecting Google Gemini to GitHub Actions

To enable the server-to-server connection between GitHub and Google Gemini, follow these 2 simple steps:

### Step 1: Get Your Free Gemini API Key (30 Seconds)
1. Open [Google AI Studio](https://aistudio.google.com/app/apikey).
2. Click **"Create API key"**.
3. Copy your generated key (starts with `AIza...`).

### Step 2: Add Secret to Your GitHub Repository
1. Navigate to your GitHub repository secrets page:  
   👉 **[https://github.com/satyabagherwal-source/AI-Builder-Brain/settings/secrets/actions](https://github.com/satyabagherwal-source/AI-Builder-Brain/settings/secrets/actions)**
2. Click the green button: **"New repository secret"**.
3. **Name**: `GEMINI_API_KEY`
4. **Secret**: Paste your Gemini API key from Step 1.
5. Click **"Add secret"**.

*That is all!* From this point onward, GitHub Actions and Google Gemini run server-to-server 24/7 autonomously.

---

## 4. Local Testing & Verification

To verify the Server-to-Server connection locally:

```bash
# Diagnostic command
node 04_WORKFLOWS/factory-engine/test-gemini-connection.mjs
```

Or set the key in PowerShell:
```powershell
$env:GEMINI_API_KEY = "your_gemini_api_key_here"
node 04_WORKFLOWS/factory-engine/test-gemini-connection.mjs
```
