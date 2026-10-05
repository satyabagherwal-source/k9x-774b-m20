# Skill: Agentic Hook Lifecycle & Diagnostic Doctor Coverage Audit

## Metadata
- **Domain**: AI Agent Architectures & Runtime Safety
- **Source**: `modu-ai/moai-adk`
- **Applicability**: Agentic harnesses, CLI automation frameworks, permission boundaries, and tool-execution interceptor pipelines.

## Purpose & Goal
When an AI agent or developer builds complex agentic software (such as subagents, hook pipelines, cost guards, and tool wrappers), hooks can silently fail or get orphaned if files are renamed or handlers are missing. This skill establishes an automated, self-diagnosing Doctor Coverage Table that audits every hook on disk, verifies execution permissions, and ensures no safety or compliance gate is silently bypassed.

## Step-by-Step Execution Protocol

### Step 1: Define Canonical Hook Resolution States
Every hook lifecycle event in the agent harness must declare an explicit resolution enum:
- `KEEP`: Actively used in production runtime.
- `UPGRADE`: Scheduled for feature or schema enhancement.
- `FIX`: Under active defect remediation.
- `RETIRE_OBS_ONLY`: Kept only for non-blocking telemetry logging; bypassed in core pipeline.
- `REMOVE`: Deprecated and slated for pruning.
- `COMPOSITE`: Delegates to multiple sub-handlers.

### Step 2: Implement the Canonical Coverage Table
Maintain a structured table in your agent runtime:
```go
type Resolution string

const (
    ResolutionKeep          Resolution = "KEEP"
    ResolutionUpgrade       Resolution = "UPGRADE"
    ResolutionFix           Resolution = "FIX"
    ResolutionRetireObsOnly Resolution = "RETIRE_OBS_ONLY"
    ResolutionRemove        Resolution = "REMOVE"
    ResolutionComposite     Resolution = "COMPOSITE"
)

type HookEntry struct {
    EventName          string     `json:"event_name"`
    Resolution         Resolution `json:"resolution"`
    IsActive           bool       `json:"is_active"`
    ObservabilityOptIn bool       `json:"observability_opt_in"`
    HandlerFile        string     `json:"handler_file"`
}
```

### Step 3: Implement the `doctor --hooks` CLI Diagnostic Command
Provide human-readable and machine-readable diagnostics:
```bash
# Human readable table
agent doctor --hooks

# JSON verification for CI/CD assertions
agent doctor --hooks --json
```

Output Format:
```text
Hook Coverage Table — SPEC-V3R2 §5.7
────────────────────────────────────────────────────────────────────────────────
Event                               Resolution           Active   Handler
────────────────────────────────────────────────────────────────────────────────
tool:before_execute                 KEEP                 ✓        hooks/pre_tool.sh
cost:threshold_exceeded             UPGRADE              ✓        hooks/cost_fence.sh
agent:subagent_spawn                COMPOSITE            ✓        hooks/subagent_track.sh
telemetry:trace_step                RETIRE_OBS_ONLY      obs      hooks/telemetry.sh
────────────────────────────────────────────────────────────────────────────────
Summary: total=4 KEEP=1 UPGRADE=1 FIX=0 RETIRE=1 REMOVE=0 COMPOSITE=1
```

### Step 4: Add Automated CI Assertions
In your integration test suite:
1. Verify that every file declared in `CoverageTable` exists on disk.
2. Verify that active handlers have executable permissions (`0755` on Unix).
3. If an event is triggered that lacks an active handler or fails validation, fail fast rather than continuing silently.
