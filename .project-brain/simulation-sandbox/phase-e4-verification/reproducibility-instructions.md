# Phase E.4 Independent Verification Reproducibility Guide

## Environment Prerequisites
- Node.js >= v20 (Tested on Node.js v26.7.0)
- Operating System: Windows / Linux / macOS
- No network access or credentials required (Pure Offline Sandbox)

## Reproduction Commands
```bash
# 1. Navigate to repository root
cd C:\AI-Builder-Brain

# 2. Run the Phase E.4 Master Verification Suite
node .project-brain/simulation-sandbox/phase-e4-verification/run-phase-e4-master.mjs

# 3. Inspect individual candidate source evidence
ls .project-brain/simulation-sandbox/phase-e4-verification/source-evidence/

# 4. Inspect verification execution logs
cat .project-brain/simulation-sandbox/phase-e4-verification/execution-logs/execution.log
```
