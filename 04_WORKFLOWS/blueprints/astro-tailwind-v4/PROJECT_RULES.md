# Project Rules — {{PROJECT_NAME}}

## 1. Operating Rules for AI Agents
1. **Never Guess Command Outputs**: Always run actual commands and inspect logs.
2. **Execute Complete Units**: Never leave code with `// TODO: implement later` or missing imports.
3. **Preserve Provenance**: Always document where a fix or pattern came from.
4. **Enforce Non-Destructive Invariants**: Protect existing responsive styling, tests, and component behavior.
5. **No Silent Master Brain Writes**: Master Brain is strictly read-only. Learnings stay in `.project-brain/` until formal review.
6. **Live Multi-Layer Verification**: Any change to code or styles must pass `npm run verify` before the turn is concluded.
