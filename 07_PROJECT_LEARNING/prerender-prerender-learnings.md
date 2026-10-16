# Forensic Learning Dossier: prerender/prerender

## 1. Metadata & Source Provenance
- **Repository**: [prerender/prerender](https://github.com/prerender/prerender)
- **Commit SHA**: `c1202e7a0e3868202d0cf3f11dae605d535ff4b1`
- **License**: MIT License
- **Audit Date**: 2026-10-16
- **Architecture**: Dynamic rendering middleware server utilizing headless Chrome to serve pre-rendered HTML to search engine bots.

## 2. Core Architectural Mechanisms
1. **User-Agent Regex Bot Gatekeeper**:
   - Matches incoming request User-Agents against known crawlers: Googlebot, Bingbot, LinkedInBot, Twitterbot, FacebookExternalHit, Slackbot, WhatsApp.
   - Routes bots to the headless Chrome renderer while serving the standard Single-Page App (SPA) to human browsers.
2. **Page Readiness Detection**:
   - Monitors network idle events (`networkidle2`) and checks for `window.prerenderReady = true` flag set by application code before returning HTML.
3. **HTTP Status Code Mapping**:
   - Intercepts client-side 404 or 301 meta tags (`<meta name="prerender-status-code" content="404">`) and emits the real HTTP status code in the server response headers.

## 3. Production Failure Modes & Anti-Patterns Defended
- **Failure Mode 1**: Returning HTTP 200 OK for SPA 404 pages (Soft 404 penalty in GSC). Solved by status code meta interception.
- **Failure Mode 2**: Headless browser memory leaks on high-volume traffic. Handled by worker process recycling after N requests.
