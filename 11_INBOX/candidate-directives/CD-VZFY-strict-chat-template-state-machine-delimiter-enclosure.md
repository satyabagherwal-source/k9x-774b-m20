# Candidate Directive: [CD-VZFY] Strict Chat-Template State Machine Delimiter Enclosure

<!-- PROVENANCE_START
{
  "source_repository": "hf-unsloth-nvidia-nemotron-3.5-bolt-e4b-gguf-learnings",
  "source_url": "unknown",
  "source_version": "HEAD",
  "license": "Open-Source",
  "timestamp": "2026-11-21T20:52:05.657Z",
  "ai_provider": "universal-multi-artifact-distributor",
  "generator_version": "2.0.0-universal",
  "learning_id": "LEARN-EVO-hf-unsloth-nvidia-nemotron-3.5-bolt-e4b-gguf-learnings",
  "canonical_classification": "candidate_directive"
}
PROVENANCE_END -->
> **Provenance**: Harvested from [hf-unsloth-nvidia-nemotron-3.5-bolt-e4b-gguf-learnings](unknown) (Revision: `HEAD`).  
> **License**: Open-Source | **Timestamp**: `2026-11-21T20:52:05.657Z`  
> **Learning ID**: `LEARN-EVO-hf-unsloth-nvidia-nemotron-3.5-bolt-e4b-gguf-learnings`


## Lifecycle Status
- **Current Status**: `QUARANTINED_REJECT`
- **Rejection / Holding Reason**: Rejected fail-closed: MISSING_SOURCE_URI: Knowledge has no source URL or locator; NO_EVIDENCE_RECORDS: Knowledge item has zero associated evidence records
- **Retry Eligibility**: `YES`
- **Candidate Domain**: Domain G

## Original Learning Payload (100% Preserved)
**RULE**:
Tokenizer chat template engines parsing NVIDIA Nemotron tool-calling markers MUST enforce deterministic token-level state transitions and MUST NOT rely on raw non-delimited substring splitting for special tokens (e.g., `<|tool_call|>`, `</tool_call>`, `<|tool_response|>`). Any unterminated tool marker or missing special control token MUST fail fast into an explicit recovery transition state rather than streaming partial payload tokens to downstream external execution tools.

**WHY**:
Nemotron-3.5-Bolt utilizes explicit control tokens for tool grounding. Unvalidated string replacements can be exploited via Prompt Injection (where user text mimics a tool call delimiter), executing arbitrary or unauthorized external tool operations.

**WHEN TO APPLY**:
All inference loops, conversational wrappers, and LangChain/LlamaIndex tool connectors executing on top of quantized Nemotron-3.5 models.

**VERIFIED IMPLEMENTATION PATTERN**:
```typescript
export enum ParserState {
  EMITTING_TEXT,
  READING_TOOL_CALL,
  PARSING_ARGUMENTS,
  TERMINATED
}

export interface ToolCallPacket {
  name: string;
  arguments: Record<string, unknown>;
  valid: boolean;
}

export class NemotronStreamParser {
  private static readonly START_MARKER = "<|tool_call|>";
  private static readonly END_MARKER = "</|tool_call|>";
  private state: ParserState = ParserState::EMITTING_TEXT;
  private buffer: string = "";

  public processToken(token: string): { textChunk?: string; toolCall?: ToolCallPacket } {
    this.buffer += token;

    if (this.state === ParserState.EMITTING_TEXT) {
      const startIndex = this.buffer.indexOf(NemotronStreamParser.START_MARKER);
      if (startIndex !== -1) {
        const preText = this.buffer.substring(0, startIndex);
        this.buffer = this.buffer.substring(startIndex + NemotronStreamParser.START_MARKER.length);
        this.state = ParserState.READING_TOOL_CALL;
        return { textChunk: preText.length > 0 ? preText : undefined };
      }
      // Retain sliding window equal to start marker length minus 1 to guard against boundary splits
      const splitGuard = NemotronStreamParser.START_MARKER.length - 1;
      if (this.buffer.length > splitGuard) {
        const emitSlice = this.buffer.substring(0, this.buffer.length - splitGuard);
        this.buffer = this.buffer.substring(this.buffer.length - splitGuard);
        return { textChunk: emitSlice };
      }
      return {};

## Quality Gate Validation Dimensions
```json
{
  "validator_version": "0.1.0",
  "validated_at": "2026-11-21T20:52:05.806Z",
  "decision": "REJECT",
  "decision_reason": "Rejected fail-closed: MISSING_SOURCE_URI: Knowledge has no source URL or locator; NO_EVIDENCE_RECORDS: Knowledge item has zero associated evidence records",
  "recommended_action": "REJECT_FAIL_CLOSED",
  "confidence_score": 0,
  "confidence_justification": "Evaluated across 7 dimensions (Score: 0%). Source=FAIL (UNTRUSTED_EXTERNAL), Evidence=WARN (0 effective sources), Correctness=PASS, Reusability=PASS, Completeness=PASS, Freshness=WARN, Conflict=PASS.",
  "item": {
    "id": "cand-1795294325806",
    "title": "Strict Chat-Template State Machine Delimiter Enclosure",
    "category": "ENGINEERING_PATTERN",
    "domain": "ARCHITECTURE",
    "source_id": "hf-unsloth-nvidia-nemotron-3.5-bolt-e4b-gguf-learnings",
    "source_uri": "",
    "source_version": "HEAD",
    "content_hash": "87e5838804c0f34ef07bbfce000ea91acfd0fd81b1080e3f31d84d9fdc732677"
  },
  "evidence_fingerprint": "NO_EVIDENCE",
  "dimensions": {
    "source_reliability": {
      "status": "FAIL",
      "score": 0,
      "tier": "UNTRUSTED_EXTERNAL",
      "findings": [
        "MISSING_SOURCE_URI: Knowledge has no source URL or locator"
      ],
      "details": [
        "Source is completely untraceable; origin cannot be verified."
      ]
    },
    "evidence_quality": {
      "status": "WARN",
      "score": 0.2,
      "corroboration_tier": "INDEPENDENCE_UNVERIFIED",
      "effective_sources": 0,
      "direct_evidence_ratio": 0,
      "findings": [
        "NO_EVIDENCE_RECORDS: Knowledge item has zero associated evidence records"
      ],
      "details": [
        "Claim is uncorroborated; relies solely on raw unverified source text."
      ]
    },
    "technical_correctness": {
      "status": "PASS",
      "score": 1,
      "is_adversarial": false,
      "has_dangerous_security": false,
      "directive_opposition": false,
      "opposing_rule": null,
      "unsupported_assumptions": [],
      "findings": [],
      "details": [
        "No direct opposition with canonical operating directives",
        "Substantive technical content verified (> 40 chars)"
      ]
    },
    "reusability": {
      "status": "PASS",
      "score": 1,
      "is_generic_pattern": true,
      "has_local_paths": false,
      "findings": [],
      "details": [
        "Free of local workstation path artifacts",
        "Expresses generalized engineering invariants (3 architectural markers)",
        "Explicit WHEN TO APPLY scope defined"
      ]
    },
    "completeness": {
      "status": "PASS",
      "score": 0.85,
      "has_rule": true,
      "has_why": true,
      "has_when": true,
      "missing_fields": [],
      "details": [
        "Preserves normative RULE declaration",
        "Preserves technical rationale (WHY)",
        "Preserves operational boundary (WHEN TO APPLY)"
      ]
    },
    "freshness": {
      "status": "WARN",
      "score": 1,
      "staleness_risk": "MEDIUM",
      "findings": [],
      "details": [
        "Free of known deprecated runtimes (Python 2, Node < 14, Webpack 1-3, React < 16)",
        "Harvested/verified timestamp recorded: 2026-11-21T20:52:05.806Z"
      ]
    },
    "duplication_and_conflict": {
      "status": "PASS",
      "score": 1,
      "is_duplicate": false,
      "duplicate_target": null,
      "is_contradiction": false,
      "conflicting_rule": null,
      "findings": [],
      "details": []
    }
  },
  "detected_contradictions": [],
  "missing_information": [
    "Source provenance",
    "Empirical evidence records"
  ],
  "limitations": [
    "Staleness risk: MEDIUM"
  ],
  "evidence_references": [],
  "auth_token": "b24aafe3e70582b900fa8cd2ce1345ef65f58975784b1000061a12942652858a"
}
```

## Remediation Checklist to Enable Promotion
- [ ] Verify empirical reproducibility on isolated sandbox fixture.
- [ ] Add missing implementation code block or negative constraint.
- [ ] Authorize human signature token if targeting Core laws or Domain M.
