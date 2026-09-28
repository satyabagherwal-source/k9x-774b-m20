> **Canonical Learning Artifact**: `07_PROJECT_LEARNING/justjavac-free-programming-books-zh_cn-learnings.md`  
> **Source**: GitHub ([https://github.com/justjavac/free-programming-books-zh_CN](https://github.com/justjavac/free-programming-books-zh_CN))  
> **Synthesized By**: Google Gemini Server-to-Server Autonomous AI Agent  
> **Timestamp**: 2026-09-28T18:54:42.329Z  
> **Status**: VERIFIED_EMPIRICAL_INTELLIGENCE  

---

# Forensic Learning Record: justjavac/free-programming-books-zh_CN

## 1. Executive Forensic Architecture & System Mechanics
This repository functions as a **distributed, human-curated knowledge graph** represented as a static Markdown document. Architecturally, it is a **Content-Addressable Registry** where the "address" is a URL and the "content" is the metadata (title, description). 

The system operates on a **decentralized maintenance model**: it lacks an automated link-checker service, relying instead on community-driven PRs to prune "link rot." The system's primary architectural boundary is the **External Dependency Boundary**—it is entirely dependent on the availability of third-party domains, making it a high-entropy system prone to constant state degradation.

## 2. Deep Micro-Learnings & Runtime Gotchas
*   **Failure Mode: The "Link Rot" Cascade.**
    *   **Root Cause:** External domains (e.g., `readthedocs.io`, `jinbuguo.com`) undergo domain migration, SSL certificate expiration, or project abandonment.
    *   **Prevention:** Implement a CI-based link-checker (e.g., `markdown-link-check`) that runs on a cron schedule to identify 404s/301s before they become stale.
*   **Failure Mode: Protocol Inconsistency.**
    *   **Root Cause:** Mixed HTTP/HTTPS usage leads to browser security warnings and potential MITM vectors.
    *   **Prevention:** Enforce a strict `HTTPS-only` policy for all external references via linting rules.
*   **Failure Mode: Semantic Versioning/Deprecation Neglect.**
    *   **Root Cause:** Retaining links to legacy versions (e.g., Python 2.7) creates "Technical Debt by Proxy" for the reader.
    *   **Prevention:** Establish a "Sunset Policy" in the `CONTRIBUTING.md` that mandates the removal of resources that are no longer supported by their upstream maintainers.
*   **Failure Mode: Metadata Drift.**
    *   **Root Cause:** Repository moves (e.g., `vhf` to `EbookFoundation`) result in broken deep links.
    *   **Prevention:** Use canonical redirectors or organization-level aliases rather than specific repository paths where possible.

## 3. 8-Dimensional Multi-Axis Forensic Analysis
*   **D1: Structural Boundaries**: The repo uses a flat file structure (`README.md`) which creates a single point of failure for merge conflicts.
*   **D2: Asynchronous State**: The "state" of the system is asynchronous relative to the internet; the repo is always "behind" the actual availability of the resources it links to.
*   **D3: Error Boundaries**: The use of `:worried:` labels acts as a manual "circuit breaker" for broken links, allowing users to identify failure without immediate removal.
*   **D4: Resource Lifecycle**: The repository lacks an automated "garbage collection" process for dead links, leading to memory bloat in the form of stale documentation.
*   **D5: Input Sanitization**: PRs act as the input validation layer; the lack of automated schema validation for link formats allows malformed URLs to persist.
*   **D6: Compatibility**: The system is platform-agnostic, but relies on browser-based resolution, making it vulnerable to regional DNS poisoning or censorship.
*   **D7: CI/CD**: The removal of `Travis-CI` badges indicates a shift toward modern, integrated CI workflows, though the repo currently lacks active automated testing.
*   **D8: Forensic Patches**: Recent patches focus on "Domain Normalization" (replacing subdomains with canonical root domains) to increase link longevity.

## 4. Net-New Universal Engineering Rules

## 72. The External Dependency Invariant (Link Rot Defense)

**RULE**:
Any system referencing external resources must treat those resources as "untrusted, volatile state" and implement an automated verification layer that executes at least once per release cycle.

**WHY**:
External dependencies are outside the control of the local system. Without automated verification, the system's internal state (the list of links) will inevitably diverge from reality, leading to "Silent Failure" where the user experience degrades without the maintainer's knowledge.

**WHEN TO APPLY**:
Documentation repositories, API registries, service discovery manifests, and any system relying on external URLs or third-party endpoints.

## 5. Actionable Agent Skill & Implementation Checklist
- [ ] **Automated Link Validation**: Integrate a GitHub Action using `lychee` or `markdown-link-check` to scan for 4xx/5xx status codes.
- [ ] **Canonicalization Engine**: Implement a script to normalize URLs (e.g., force `https`, remove trailing `.git` suffixes, resolve redirects).
- [ ] **Sunset Automation**: Create a "Stale Resource" label that automatically triggers a PR to remove links that have returned 404s for >30 days.
- [ ] **Schema Enforcement**: Use a JSON/YAML schema to validate the structure of new entries (Title, URL, Description) before allowing a PR merge.
- [ ] **Redundancy Mapping**: For critical resources, mandate the inclusion of a secondary "Archive" link (e.g., Internet Archive/Wayback Machine) to mitigate permanent loss.