# Candidate Directive: [CD-WFI5] address codex review findings on turn telemetry

<!-- PROVENANCE_START
{
  "source_repository": "paperdebugger-paperdebugger-learnings",
  "source_url": "unknown",
  "source_version": "HEAD",
  "license": "Open-Source",
  "timestamp": "2026-11-13T12:43:11.198Z",
  "ai_provider": "universal-multi-artifact-distributor",
  "generator_version": "2.0.0-universal",
  "learning_id": "LEARN-REEXTRACT-paperdebugger-paperdebugger-learnings",
  "canonical_classification": "candidate_directive"
}
PROVENANCE_END -->
> **Provenance**: Harvested from [paperdebugger-paperdebugger-learnings](unknown) (Revision: `HEAD`).  
> **License**: Open-Source | **Timestamp**: `2026-11-13T12:43:11.198Z`  
> **Learning ID**: `LEARN-REEXTRACT-paperdebugger-paperdebugger-learnings`


## Lifecycle Status
- **Current Status**: `STAGED_FOR_HUMAN_REVIEW`
- **Rejection / Holding Reason**: Human approval authorization required before canonical promotion
- **Retry Eligibility**: `YES`
- **Candidate Domain**: Domain M

## Original Learning Payload (100% Preserved)
**RULE**:
When implementing operations in `webapp/_webapp/components/chat-panel.tsx`, engineers MUST enforce rigorous boundary validation, safe state transitions, and memory/concurrency invariants as established by production defect remediation in PaperDebugger/paperdebugger. All inputs crossing module boundaries must be explicitly verified before state persistence.

**WHY**:
Prevents defects observed in production commit `191bd322`: address codex review findings on turn telemetry. Unvalidated execution paths cause runtime exceptions, race conditions, and silent state corruption under concurrent workloads.

**WHEN TO APPLY**:
Subsystems managing TypeScript data structures, boundary deserialization, API parsing, or resource lifecycles matching `webapp/_webapp/components/chat-panel.tsx`.

**VERIFIED IMPLEMENTATION PATTERN**:
```typescript
// Verified production-grade fix pattern:
      } finally {
        // Measured even on failure, so a failed sync's delay isn't misattributed
        // to the bridge span in the turn's trace.
        syncMs = Date.now() - t0;
    // Thinking duration: first reasoning delta → first answer delta (or turn end).
    // Undefined while still thinking — ReasoningPart keys its label off this.
    const think = { start: null as number | null, ms: undefined as number | undefined };
        if (think.start != null && think.ms == null) think.ms = Date.now() - think.start;
        think.start ??= Date.now();
        // Drop stale session ids: if "New chat" re-minted convId while this turn
        // was in flight, pairing the new conversation with this turn's
        // continuation would resume the old thread next turn.
        const store = useConversationStore.getState();
        if (store.convId === convId) store.set({ provider, contId: msg.sessionId });
        if (think.start != null && think.ms == null) think.ms = Date.now() - think.start;
        if (think.start != null && think.ms == null) think.ms = Date.now() - think.start;
    // Each frame re-pins metadata.custom (the runtime takes the last yield's), so
    // thinkMs ri
```

**NEGATIVE CONSTRAINT**:
```typescript
// Anti-pattern to NEVER write (induced failure mode):
        syncMs = Date.now() - t0;
        useConversationStore.getState().set({ provider, contId: msg.sessionId });
      return { content: parts };
        if (ctrl.stat) yield { ...frame(acc), metadata: { custom: { stat: ctrl.stat } } };
// Collapsible "Thinking" block for streamed reasoning/thinking parts.
    <details className="pd-reasoning" style={{ margin: "0 0 8px", fontSize: 13, color: "#6b7280" }}>
      <summary style={{ cursor: "pointer", userSelect: "none" }}>Thinking</summary>
      <div style={{ whiteSpace: "pre-wrap", marginTop: 4 }}>{text}</div>
```

**VERIFICATION METHOD**:
Automated regression test asserting that input states reproducing defect `191bd322` are properly handled with clean fallback behavior.

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
