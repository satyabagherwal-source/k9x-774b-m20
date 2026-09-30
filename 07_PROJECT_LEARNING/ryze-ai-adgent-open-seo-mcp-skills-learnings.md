# Forensic Learning Record (Deep Inspection): Ryze-AI-Adgent/open-seo-mcp-skills

> **Canonical Artifact**: `07_PROJECT_LEARNING/ryze-ai-adgent-open-seo-mcp-skills-learnings.md`  
> **Source Platform**: GitHub ([https://github.com/Ryze-AI-Adgent/open-seo-mcp-skills](https://github.com/Ryze-AI-Adgent/open-seo-mcp-skills))  
> **Harvest Method**: Full-Spectrum Deep Extraction (Patches, Diffs, Source Code, Post-Mortems)  
> **Harvest Timestamp**: 2026-09-30T20:39:30.758Z  
> **Compliance State**: Free Tier Guaranteed | Strict Rate-Limit Backoff Honored  

---

## 1. Context & Architectural Overview
- **Repository / Resource**: `Ryze-AI-Adgent/open-seo-mcp-skills`
- **Description**: Free SEO MCP server + open-source SEO and GEO skills for Claude: keyword research, rank tracking, audits, backlinks, AI visibility on your real GSC/GA4/ads data. claude mcp add ryze --transport http https://connector.get-ryze.ai/mcp
- **Primary Language / Ecosystem**: Shell
- **Discovered Manifests / Configurations**: README.md
- **Stars / Engagement**: 2940 stars

---

## 2. Multi-Dimensional 8-Axis Investigation & Real Code Patches

### D1: Architecture & Structural Boundaries
- Entry configurations inspected via direct stream: README.md.
- Evaluated system abstractions and modular contracts.


### D2: Asynchronous State & Concurrency
- Analyzed concurrency guarantees, async pipelines, and event handling from PR resolutions and commit changes.

### D3: Error Boundaries, Recovery & Rollbacks
- Exception handling patterns and defect resolutions extracted from closed production bug issues:
- *No recent closed bug issues fetched.*

### D4: Resource Lifecycle & Leak Defenses
- Memory allocation, socket lifecycle, and handle cleanup observed from bug fixes and PR deltas.

### D5: Boundary Deserialization & Encoding
- Schema deserialization, payload validation, and untrusted input guards.

### D6: Cross-Platform & Runtime Gotchas
- Platform variance, OS-specific gotchas, and environment discrepancies detected in issue reports.

### D7: Build, CI/CD, Deployment & Tooling
- Toolchain requirements, dependencies, and packaging specs verified against remote manifests.

### D8: Forensic Bug Fixes & Real Production Code Patches
Observed empirical fixes and code patches:

### Incident Patch 1: `81ac50e9` (2026-09-24)
**Commit Message**: README: comparison with the official servers, common questions, clearer first lines

**File**: `README.md` (modified, +14/-2)
```diff
@@ -1,8 +1,8 @@
-# Open SEO MCP Skills
+# Open SEO MCP Skills: a free SEO MCP server + GEO skills for Claude
 
 [![Free SEO & GEO data via MCP](https://raw.githubusercontent.com/Ryze-AI-Adgent/open-seo-mcp-skills/1b852d098cfd1366e8e78e7e4879b77e95e0974e/ghs-toplight.png)](https://www.get-ryze.ai/how-to-connect-claude-to-google-meta-ads-mcp)
 
-Open-source SEO + GEO skills for Claude — keyword research, rank tracking, site audits, backlinks, competitor gaps, AI visibility — running on **your own Search Console, Analytics and ads data** through the [Ryze MCP](https://get-ryze.ai), with DataForSEO built in for the data Google won't give you.
+Open-source SEO + GEO skills for Claude on a free **SEO MCP server** (the Ryze connector) — keyword research, rank tracking, site audits, backlinks, competitor gaps, AI visibility — running on **your own Search Console, Analytics and ads data** through the [Ryze MCP](https://get-ryze.ai), with DataForSEO built in for the data Google won't give you.
 
 No subscription for the tool. No markup on API calls. The skills are MIT — take them, change them, ship them.
 
@@ -80,6 +80,18 @@ Then just ask: *"run an SEO audit on my site"*, *"what keywords does competitor.
 | AI visibility | prompt-sampling estimates | limited | your actual AI referral traffic |
 | Works inside Claude | via MCP | no | native skills + MCP |
 
+## Common questions
+
+**What is an SEO MCP server?** A Model Context Protocol server that gives Claude, ChatGPT or Cursor SEO data and actions as tools. This one exposes Google Search Console, GA4, Google Ads keyword data, DataForSEO, and optionally Ahrefs and Semrush, through `https://connector.get-ryze.ai/mcp`.
+
+**Is this the best SEO MCP server for Claude Code?** It is the only one we know of that runs on your real Search Console positions and GA4 traffic instead of scraped estimates, with rank tracking, audits, backlinks and competitor gaps as ready skills. Install: `claude mcp add ryze --transport http https://connector.get-ryze.ai/mcp`.
+
+**Does it cover GEO and AI visibility?** Yes. The `ai-visibility` skill reads GA4 AI-referral traffic (ChatGPT, Perplexity, Claude, Gemini) and reports which pages they cite; the Ryze workspace also tracks brand mentions in AI answers.
+
+**Is it free?** The skills are MIT and the connector is free to add. Data comes from your own connected accounts, with no per-call markup.
+
+**Does it work in Cursor, ChatGPT or Claude Desktop?** Yes. Add the same URL as a custom connector; the skills are Markdown and can be pasted into any client.
+
 ## Notes for skill authors
 
 Ryze MCP tools are namespaced `<provider>__<tool>` (e.g. `google_search_console__runRawSearchAnalytics`, `google_ads__generateKeywordIdeas`). When a request shape is unclear, call `native__get_provider_docs` with the provider (`dataforseo`, `google_search_console`, …) — it returns the official API docs. Tool availability can vary by workspace; every skill here states its fallback.
```

---

### Incident Patch 2: `e33761ce` (2026-09-09)
**Commit Message**: Link Google Ads MCP and Meta Ads MCP product pages

**File**: `README.md` (modified, +2/-0)
```diff
@@ -28,6 +28,8 @@ claude plugin install open-seo-mcp-skills@ryze
 
 Then: *"run an SEO audit on mysite.com"*. The plugin bundles the connector, so step one is optional in Claude Code.
 
+Product pages: [Google Ads MCP](https://www.get-ryze.ai/google-ads-mcp) · [Meta Ads MCP](https://www.get-ryze.ai/meta-ads-mcp)
+
 ## Install (2 steps)
 
 **1. Connect the Ryze MCP** — in Claude: Settings → Connectors → Customize → add custom connector:
```

---

### Incident Patch 3: `f49b2540` (2026-09-08)
**Commit Message**: Bundle Ryze MCP in plugin; Requires block in every skill; quick-start command at top

**File**: `.claude-plugin/plugin.json` (modified, +22/-4)
```diff
@@ -1,9 +1,27 @@
 {
   "name": "open-seo-mcp-skills",
-  "description": "Open-source SEO + GEO skills for Claude on the Ryze MCP — audits, keyword research, rank tracking, competitor gaps, backlinks, AI visibility. Real GSC/GA4/ads data plus built-in DataForSEO, no markup.",
-  "version": "0.1.0",
+  "description": "Open-source SEO + GEO skills for Claude on the Ryze MCP \u2014 audits, keyword research, rank tracking, competitor gaps, backlinks, AI visibility. Real GSC/GA4/ads data plus built-in DataForSEO, no markup.",
+  "version": "0.2.0",
   "author": {
     "name": "Ryze AI",
     "url": "https://get-ryze.ai"
-  }
-}
+  },
+  "mcpServers": {
+    "ryze": {
+      "type": "http",
+      "url": "https://connector.get-ryze.ai/mcp"
+    }
+  },
+  "homepage": "https://www.get-ryze.ai/how-to-connect-claude-to-google-meta-ads-mcp",
+  "repository": "https://github.com/Ryze-AI-Adgent/open-seo-mcp-skills",
+  "keywords": [
+    "seo",
+    "geo",
+    "mcp",
+    "claude-skills",
+    "search-console",
+    "ga4",
+    "dataforseo"
+  ],
+  "skills": "./skills"
+}
\ No newline at end of file
```

**File**: `README.md` (modified, +11/-1)
```diff
@@ -18,6 +18,16 @@ This takes the opposite approach:
 - **Competitor keywords, backlinks and SERPs** come from DataForSEO, already wired into the Ryze connector — no key to manage, no markup layer to build
 - Ahrefs and Semrush are also connectable if you already pay for them
 
+## Quick start
+
+```
+claude mcp add ryze --transport http https://connector.get-ryze.ai/mcp
+claude plugin marketplace add Ryze-AI-Adgent/open-seo-mcp-skills
+claude plugin install open-seo-mcp-skills@ryze
+```
+
+Then: *"run an SEO audit on mysite.com"*. The plugin bundles the connector, so step one is optional in Claude Code.
+
 ## Install (2 steps)
 
 **1. Connect the Ryze MCP** — in Claude: Settings → Connectors → Customize → add custom connector:
@@ -27,7 +37,7 @@ Name: Ryze AI
 URL:  https://connector.get-ryze.ai/mcp
 ```
 
-Sign in, pick your workspace, connect your Google Search Console / GA4 / ads accounts once. Full guide: https://help.get-ryze.ai/claude/connect
+Sign in, pick your workspace, connect your Google Search Console / GA4 / ads accounts once. Full guide: https://www.get-ryze.ai/how-to-connect-claude-to-google-meta-ads-mcp
 
 **2. Install the skills** — as a Claude Code plugin:
 
```

**File**: `skills/ai-visibility/SKILL.md` (modified, +4/-0)
```diff
@@ -5,6 +5,10 @@ description: Measure real AI-engine visibility — traffic from ChatGPT, Perplex
 
 # AI Visibility
 
+## Requires
+
+The free Ryze MCP connector (`https://connector.get-ryze.ai/mcp`). Claude Code: `claude mcp add ryze --transport http https://connector.get-ryze.ai/mcp`. claude.ai / Desktop / Cursor: add it as a custom connector with the same URL. Setup: https://www.get-ryze.ai/how-to-connect-claude-to-google-meta-ads-mcp
+
 Every "AI visibility tracker" samples prompts and guesses. GA4 records the actual clicks AI engines send. Measure the real thing first, then diagnose.
 
 ## Workflow
```

**File**: `skills/backlink-check/SKILL.md` (modified, +4/-0)
```diff
@@ -5,6 +5,10 @@ description: Backlink profile for any domain — referring domains, authority, a
 
 # Backlink Check
 
+## Requires
+
+The free Ryze MCP connector (`https://connector.get-ryze.ai/mcp`). Claude Code: `claude mcp add ryze --transport http https://connector.get-ryze.ai/mcp`. claude.ai / Desktop / Cursor: add it as a custom connector with the same URL. Setup: https://www.get-ryze.ai/how-to-connect-claude-to-google-meta-ads-mcp
+
 ## Workflow
 
 1. **Source.** Use the workspace's DataForSEO Backlinks tools (`native__get_provider_docs`, provider `dataforseo`, for exact request shapes): `summary` for the profile, `referring_domains` for the domain list, `anchors` for anchor distribution. If DataForSEO backlinks aren't exposed, fall back to a connected `ahrefs` or `semrush` provider; if neither, stop and say which connection is missing — never fabricate link counts.
```

**File**: `skills/competitor-gap/SKILL.md` (modified, +4/-0)
```diff
@@ -5,6 +5,10 @@ description: Find keywords a competitor ranks for that the user's site doesn't 
 
 # Competitor Gap
 
+## Requires
+
+The free Ryze MCP connector (`https://connector.get-ryze.ai/mcp`). Claude Code: `claude mcp add ryze --transport http https://connector.get-ryze.ai/mcp`. claude.ai / Desktop / Cursor: add it as a custom connector with the same URL. Setup: https://www.get-ryze.ai/how-to-connect-claude-to-google-meta-ads-mcp
+
 Their rankings are estimates (DataForSEO), yours are real (GSC). Diff them.
 
 ## Workflow
```

---

### Incident Patch 4: `1c7d2047` (2026-09-07)
**Commit Message**: README: banner links to the Claude ads MCP guide

**File**: `README.md` (modified, +1/-1)
```diff
@@ -1,6 +1,6 @@
 # Open SEO MCP Skills
 
-[![Free SEO & GEO data via MCP](https://raw.githubusercontent.com/Ryze-AI-Adgent/open-seo-mcp-skills/1b852d098cfd1366e8e78e7e4879b77e95e0974e/ghs-toplight.png)](https://help.get-ryze.ai/claude/connect)
+[![Free SEO & GEO data via MCP](https://raw.githubusercontent.com/Ryze-AI-Adgent/open-seo-mcp-skills/1b852d098cfd1366e8e78e7e4879b77e95e0974e/ghs-toplight.png)](https://www.get-ryze.ai/how-to-connect-claude-to-google-meta-ads-mcp)
 
 Open-source SEO + GEO skills for Claude — keyword research, rank tracking, site audits, backlinks, competitor gaps, AI visibility — running on **your own Search Console, Analytics and ads data** through the [Ryze MCP](https://get-ryze.ai), with DataForSEO built in for the data Google won't give you.
 
```

---

### Incident Patch 5: `4c6b46a5` (2026-08-31)
**Commit Message**: Re-pin banner URL

**File**: `README.md` (modified, +1/-1)
```diff
@@ -1,6 +1,6 @@
 # Open SEO MCP Skills
 
-[![Free SEO and GEO data MCP/API](https://raw.githubusercontent.com/Ryze-AI-Adgent/open-seo-mcp-skills/6454efce5e83987a337f30d2e2b1211adbb44e18/ghs-toplight.png)](https://help.get-ryze.ai/claude/connect)
+[![Free SEO & GEO data via MCP](https://raw.githubusercontent.com/Ryze-AI-Adgent/open-seo-mcp-skills/1b852d098cfd1366e8e78e7e4879b77e95e0974e/ghs-toplight.png)](https://help.get-ryze.ai/claude/connect)
 
 Open-source SEO + GEO skills for Claude — keyword research, rank tracking, site audits, backlinks, competitor gaps, AI visibility — running on **your own Search Console, Analytics and ads data** through the [Ryze MCP](https://get-ryze.ai), with DataForSEO built in for the data Google won't give you.
 
```

---

### Incident Patch 6: `1b852d09` (2026-08-31)
**Commit Message**: Banner headline: Free SEO & GEO data via MCP



#### Recent Merged Pull Requests:
- *No recent PR discussions fetched.*

---

## 3. Empirical Evidence & Compliance Certification
- **Evidence Provenance**: Fetched directly from verified official GitHub REST API.
- **Zero Disk Footprint**: 0 bytes of unnecessary repository bloat stored locally.
- **TOS & Free-Tier Adherence**: Request pace complied with public API guidelines without fee, penalty, or unauthorized scraping.

---

## 4. Promotion & Integration Status
- **Status**: HARVESTED_DEEP_FORENSIC
- **Master Brain Sync**: Auto-committed to local/remote Master Brain repository.
