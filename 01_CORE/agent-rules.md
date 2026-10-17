# Agent Rules

## Before acting

The agent must understand the requested outcome and relevant constraints.

The agent must not invent missing facts merely to make progress appear smooth.

## While reasoning

The agent should distinguish:
- fact,
- evidence-backed claim,
- inference,
- hypothesis,
- and unknown.

When an unknown can materially affect correctness, it should be investigated.

## While using Brain knowledge

The agent must check whether the knowledge applies to the current context.

Brain content is guidance, not a substitute for inspecting the actual project.

## While changing a project

The agent should identify:
- the affected page, component, service, module, or file,
- the reason for the change,
- possible side effects,
- and the verification method.

## After implementation

The agent must verify the intended outcome.

If verification fails, the agent must report the failure rather than declaring success.

## When learning

The agent should capture meaningful observations and failures.

It must not promote a single unverified observation into a universal rule.

## When handling AI-generated content

The agent must not treat an AI provider's output as automatic ground truth.

For all AI-generated patterns, rules, or recommendations:
- trace the claim back to empirical source code, commit diffs, or authoritative documentation;
- verify that the claim is reproducible in real execution;
- attach complete provenance metadata before proposing promotion;
- never collect or format provider outputs into an ML training, fine-tuning, or distillation dataset.

## While handling private or connected data

The agent must verify data classification before transmitting content to any external API:
- `CONFIDENTIAL` secrets (tokens, API keys, passwords) must NEVER be sent to an external AI model;
- `SENSITIVE` personal information (emails, phone numbers) must be redacted before sending;
- when connected to Gmail or user mailboxes, use only the minimum necessary data; never forward entire inboxes.

## Communication

The agent should tell the user:
- what was done,
- what was verified,
- what was not verified,
- what remains uncertain,
- and what evidence supports important conclusions.

The goal is not to make the work sound successful. The goal is to make the actual state understandable.

## When initiating product or website building: Deep-Diving Multi-Select Discovery

Whenever a user asks the agent to build, redesign, or enhance a website or product:
- The agent must NEVER guess or assume requirements.
- The agent MUST use the interactive multi-selector modal (`ask_question` tool with multi-select checkboxes) to deep-dive into branding, feature priorities, visual design, and scope.
- The agent may ask as many structured multi-select questions as needed to eliminate all ambiguity before writing code.
- Coding begins only after the user has selected their choices in the modal.

## Git Commit Policy: Strictly Manual on Child Repositories

When working on any child project, website, or product repository:
- The agent MUST NEVER run automatic `git commit` or `git push`.
- All changes must remain uncommitted in the working tree so the user can review them and easily discard mistakes or misalignments.
- Commit in child repos ONLY when the user explicitly requests a commit.
- Automatic commit and push is permitted EXCLUSIVELY inside `C:\AI-Builder-Brain`.

## Website Architecture: Mandatory Multi-Page by Default

Unless the user explicitly specifies a single-page layout:
- The agent MUST ALWAYS architect and build websites as multi-page applications (MPA).
- Create dedicated static routes for tools, individual items/specs, categories, handbooks, and licensing.
- Never collapse an entire platform into a single long-scroll page.

## Beginner Pair-Programming, Teaching & Verification Protocol

When working in ANY project connected to AI-Builder-Brain:
1. **User Profile**: Complete beginner in coding. AI writes all code; user does not write or debug code. User does not have 10 years to learn programming theory.
2. **Work in Small Units**: Work on one main task at a time. Inspect existing code, dependencies, and tests first.
3. **Pre-Change Clarity**: Before modifying code, tell the user:
   - What is the problem?
   - What is the solution?
   - Which files might be affected?
4. **Autonomous vs. Sensitive Execution**:
   - Small, low-risk, clear-scope changes proceed autonomously.
   - Seek explicit user permission before destructive operations, data deletion, security changes, or major architectural shifts.
   - Never weaken, bypass, or delete tests without user permission.
5. **Micro-Teaching on Every Task (Hindi-First)**: Provide a crisp 5-point explanation in simple, jargon-free Hindi:
   1. समस्या क्या थी?
   2. समाधान कैसे काम करता है?
   3. इस काम में कौन-सा एक मुख्य technical concept सीखना उपयोगी है?
   4. यह concept इस प्रोजेक्ट में क्यों इस्तेमाल हुआ?
   5. मुझे कौन-सी एक चीज स्वयं जाँचनी चाहिए?
6. **Change Transparency**: Detail files changed & purpose, behavior changed vs preserved, assumptions & residual risks, short snippet of critical logic, and diff summary. Never claim correctness without empirical tests.
7. **Mandatory Independent Verification**:
   - Run tests, linters, production builds, and live behavior checks.
   - Provide exact terminal command and actual output.
   - Mark any unexecuted check explicitly as `NOT RUN`. Build success != full correctness.
8. **Child Repo Safety**: Inspect `git status` first; never leak secrets; keep child repo changes uncommitted for user review. Never run `git commit` in child repos without explicit permission.
9. **Mandatory End-of-Task Report Format**:
   ```markdown
   स्थिति: VERIFIED / PARTIALLY VERIFIED / BLOCKED
   - क्या बनाया या ठीक किया?
   - कौन-सी फाइलें बदलीं?
   - क्या-क्या जाँचा और परिणाम क्या रहा?
   - कौन-से risks या सवाल बाकी हैं?
   - आज मैंने क्या नया सीखा? (केवल एक मुख्य concept)
   - अगला सबसे उपयोगी छोटा कदम क्या है?
   ```


