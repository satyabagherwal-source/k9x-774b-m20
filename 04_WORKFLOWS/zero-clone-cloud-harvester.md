# Zero-Clone 24/7 Cloud Harvester Architecture & Operational Guide

> **Canonical Reference**: `AI-Builder-Brain/04_WORKFLOWS/zero-clone-cloud-harvester.md`  
> **Engine Executable**: `04_WORKFLOWS/factory-engine/zero-clone-harvester.mjs`  
> **Control Utility**: `04_WORKFLOWS/factory-engine/harvester-control.mjs`  
> **Control State**: `harvest-control.json`  
> **Cloud Workflow**: `.github/workflows/24-7-cloud-harvester.yml`  
> **Platforms Supported**: GitHub REST API & Hugging Face Public API  
> **Cost & Compliance**: 100% Free | Strict Rate-Limit & Terms of Service Adherence  

---

## 1. Executive Summary

The **Zero-Clone 24/7 Cloud Harvester** extracts reusable engineering patterns, architectural bug fixes, and closed PR/issue resolutions **without downloading or cloning repositories to local storage**.

### Key Architectural Invariants:
1. **Zero Local Storage Overhead**: Never downloads gigabytes of `.git` objects. Reads commits, issues, PR discussions, and raw configuration manifests directly over HTTP.
2. **Runs 24 Hours a Day, 7 Days a Week in Cloud**: Governed by GitHub Actions (`.github/workflows/24-7-cloud-harvester.yml`). **Continues harvesting and pushing to GitHub even when your laptop is shut down, closed, or offline.**
3. **Automatic Local Sync on Laptop Boot**: Whenever you boot your laptop, open the IDE, or ask any agent to work, the agent runs `git pull --rebase origin main` to pull all cloud-harvested learnings directly down to your local `C:\AI-Builder-Brain`.
4. **100% Free & Legal**: Strictly uses free official public REST endpoints with standard `User-Agent` headers and polite exponential backoff. Zero paid APIs, zero risk of IP bans or allegations.
5. **Instant Start/Stop Switch**: Controlled via a single command or chat phrase.

---

## 2. Instant Control: How to Start, Stop, and Sync

| Action | Chat Command (Any AI Agent) | Terminal Command |
|---|---|---|
| **Start 24/7 Harvester** | *"Cloud harvester chalu karo"* or *"start harvester"* | `node 04_WORKFLOWS/factory-engine/harvester-control.mjs start` |
| **Stop 24/7 Harvester** | *"Cloud harvester stop karo"* or *"stop harvester"* | `node 04_WORKFLOWS/factory-engine/harvester-control.mjs stop` |
| **Check Harvester Status** | *"Harvester status batao"* | `node 04_WORKFLOWS/factory-engine/harvester-control.mjs status` |
| **Sync Cloud to Laptop** | *"Brain sync kar lo"* | `node 04_WORKFLOWS/factory-engine/harvester-control.mjs sync` |

---

## 3. End-to-End Autonomous Lifecycle

```
[ User pastes GitHub / Hugging Face URLs in repos.txt ]
                        ↓
[ Laptop turned OFF / User sleeping / No local IDE open ]
                        ↓
[ GitHub Actions Cloud Runner wakes up (Cron Schedule) ]
                        ↓
[ Checks harvest-control.json: If ACTIVE, proceeds ]
                        ↓
[ Direct HTTP Stream: Commits, Bug PRs, Closed Issues, Raw Manifests ]
                        ↓
[ Generates 07_PROJECT_LEARNING/<repo>-learnings.md ]
                        ↓
[ Updates sources-registry.json ]
                        ↓
[ Commits & Pushes directly to GitHub origin/main ]
                        ↓
==================== USER TURNS LAPTOP ON ====================
                        ↓
[ User opens IDE / Boots Agent ]
                        ↓
[ Agent Boot Protocol automatically runs: git pull --rebase ]
                        ↓
[ Local C:\AI-Builder-Brain immediately receives all cloud learnings! ]
```

---

## 4. Multi-Platform Support

### GitHub Repositories:
- URL: `https://github.com/owner/repo`
- Data Extracted: Top commits, merged PRs with bug descriptions, closed issues with label `bug`, raw `package.json`, `pyproject.toml`, `Cargo.toml`, and release notes.

### Hugging Face Repositories:
- URL: `https://huggingface.co/owner/model`
- Data Extracted: Model metadata, pipeline tags, architectural specs, `config.json`, parameter sizes, downloads, and author cards.

---

## 5. Compliance & Safety Safeguards

1. **Free-Tier Protection**: Automatically uses GitHub Actions' built-in `GITHUB_TOKEN` (up to 1,000-5,000 requests/hour free) when running in cloud, or anonymous public rate-limits when running locally.
2. **Backoff Mechanism**: Monitored via `x-ratelimit-remaining`. If remaining requests drop below 5, it pauses respectfully before resuming.
3. **No Hallucinations / Token Limits**: Pulls high-density metadata rather than feeding raw multimegabyte bundles to LLM contexts.
