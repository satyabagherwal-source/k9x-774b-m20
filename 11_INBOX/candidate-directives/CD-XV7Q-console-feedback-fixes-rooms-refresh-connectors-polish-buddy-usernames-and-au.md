# Candidate Directive: [CD-XV7Q] Console feedback fixes: rooms refresh, connectors polish, buddy usernames and au

<!-- PROVENANCE_START
{
  "source_repository": "sandbox-quantum-switch-learnings",
  "source_url": "unknown",
  "source_version": "HEAD",
  "license": "Open-Source",
  "timestamp": "2026-11-13T12:44:18.228Z",
  "ai_provider": "universal-multi-artifact-distributor",
  "generator_version": "2.0.0-universal",
  "learning_id": "LEARN-REEXTRACT-sandbox-quantum-switch-learnings",
  "canonical_classification": "candidate_directive"
}
PROVENANCE_END -->
> **Provenance**: Harvested from [sandbox-quantum-switch-learnings](unknown) (Revision: `HEAD`).  
> **License**: Open-Source | **Timestamp**: `2026-11-13T12:44:18.228Z`  
> **Learning ID**: `LEARN-REEXTRACT-sandbox-quantum-switch-learnings`


## Lifecycle Status
- **Current Status**: `STAGED_FOR_HUMAN_REVIEW`
- **Rejection / Holding Reason**: Human approval authorization required before canonical promotion
- **Retry Eligibility**: `YES`
- **Candidate Domain**: Domain M

## Original Learning Payload (100% Preserved)
**RULE**:
When implementing operations in `CHANGELOG.md`, engineers MUST enforce rigorous boundary validation, safe state transitions, and memory/concurrency invariants as established by production defect remediation in sandbox-quantum/switch. All inputs crossing module boundaries must be explicitly verified before state persistence.

**WHY**:
Prevents defects observed in production commit `5748caa8`: Console feedback fixes: rooms refresh, connectors polish, buddy usernames and auto-approve (#952). Unvalidated execution paths cause runtime exceptions, race conditions, and silent state corruption under concurrent workloads.

**WHEN TO APPLY**:
Subsystems managing Python data structures, boundary deserialization, API parsing, or resource lifecycles matching `CHANGELOG.md`.

**VERIFIED IMPLEMENTATION PATTERN**:
```python
// Verified production-grade fix pattern:
- **Console links work on chat platforms.** A `switchdash://open/...` link an
  agent posts reaches Slack, Discord, Telegram and Teams as a clickable https
  link to the new public `GET /deeplink/open/{page}`, which opens that page in
  Switch Console. A server with no public address (`GATEWAY_PUBLIC_URL`) sends
  the link's label and the page's name instead. Mattermost servers that allow
  the `switchdash` scheme get the link unchanged.
- **Deleting a room can retire its channel.** `DELETE /gateway/rooms/{id}`
  and bulk delete take `retire_channel` (default false). When it is set,
  Switch archives the room's Slack or Mattermost channel, deletes its Discord
  channel, or has the bot leave its Telegram chat; Teams channels and direct
  messages stay. Without it, the channel is left as it is. The delete
  responses say what happened (`channel`), and room detail says what retiring
  would do (`channel_on_delete`). A channel that could not be retired is
  reported, and the room is still deleted. Disconnecting a messaging app
  leaves channels as they are.
- **The Switch expert is offered only where switch-buddy is not.** A server
  with agent management and switch-buddy on serves swi
```

**NEGATIVE CONSTRAINT**:
```python
// Anti-pattern to NEVER write (induced failure mode):
// Defect-prone omission of boundary validation
```

**VERIFICATION METHOD**:
Automated regression test asserting that input states reproducing defect `5748caa8` are properly handled with clean fallback behavior.

## Quality Gate Validation Dimensions
```json
{
  "decision": "STAGED_FOR_REVIEW",
  "note": "Human approval authorization required before canonical promotion"
}
```

## Remediation Checklist to Enable Promotion
- [ ] Verify empirical reproducibility on isolated sandbox fixture.
- [ ] Add missing implementation code block or negative constraint.
- [ ] Authorize human signature token if targeting Core laws or Domain M.
