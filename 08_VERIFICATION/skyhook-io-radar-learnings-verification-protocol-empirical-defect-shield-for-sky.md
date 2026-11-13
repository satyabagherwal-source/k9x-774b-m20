# Verification Protocol: Verification Protocol: Empirical Defect Shield for skyhook-io-radar-learnings

<!-- PROVENANCE_START
{
  "source_repository": "skyhook-io-radar-learnings",
  "source_url": "unknown",
  "source_version": "HEAD",
  "license": "Open-Source",
  "timestamp": "2026-11-13T12:44:53.203Z",
  "ai_provider": "universal-multi-artifact-distributor",
  "generator_version": "2.0.0-universal",
  "learning_id": "LEARN-REEXTRACT-skyhook-io-radar-learnings",
  "canonical_classification": "verification_contract"
}
PROVENANCE_END -->
> **Provenance**: Harvested from [skyhook-io-radar-learnings](unknown) (Revision: `HEAD`).  
> **License**: Open-Source | **Timestamp**: `2026-11-13T12:44:53.203Z`  
> **Learning ID**: `LEARN-REEXTRACT-skyhook-io-radar-learnings`


## 1. Scope & Verification Target
- **Target Repository**: `skyhook-io-radar-learnings` (Commit: `HEAD`)
- **Pillar Alignment**: Pillar 11 (Empirical Truth & Mathematical Integrity)

## 2. Observed Failure Modes & Defect Traps
> **Canonical Learning Artifact**: `07_PROJECT_LEARNING/skyhook-io-radar-learnings.md`  
> **Source**: github ([https://github.com/skyhook-io/radar](https://github.com/skyhook-io/radar))  
> **Source Version**: `bb49df41`  
> **License**: Apache-2.0  
> **Synthesized By**: zero-clone-structural-synthesizer  
> **Timestamp**: 2026-11-12T03:10:28.967Z  
> **Learning ID**: `learn-github-skyhook-io-radar`  
> **Pipeline Version**: `2.0.0`  
> **Status**: VERIFIED_EMPIRICAL_INTELLIGENCE  
> **Data Governance**: CLASSIFICATION: PUBLIC. Sanitized against PII/secrets.  
> **Policy Invariant**: Strictly for engineering retrieval and architecture documentation. Distillation prohibited.  

---

# Forensic Learning Record (Deep Inspection): skyhook-io/radar

> **Canonical Artifact**: `07_PROJECT_LEARNING/skyhook-io-radar-learnings.md`  
> **Source Platform**: GitHub ([https://github.com/skyhook-io/radar](https://github.com/skyhook-io/radar))  
> **Harvest Method**: Full-Spectrum Deep Extraction (Patches, Diffs, Source Code, Post-Mortems)  
> **Harvest Timestamp**: 2026-11-12T03:10:28.961Z  
> **Compliance State**: Free Tier Guaranteed | Strict Rate-Limit Backoff Honored  

---

## 1. Context & Architectural Overview
- **Repository / Resource**: `skyhook-io/radar`
- **Description**: The missing open-source Kubernetes UI with a built-in MCP server for AI agents. See what's broken, why, and what changed. Issues, Topology, event timeline, Helm, GitOps, live service traffic, and cluster audits - all in one Go binary.
- **Primary Language / Ecosystem**: Go
- **Discovered Manifests / Configurations**: package.json, go.mod, README.md, Dockerfile
- **Stars / Engagement**: 4105 stars

---

## 2. Multi-Dimensional 8-Axis Investigation & Real Code Patches

### D1: Architecture & Structural Boundaries
- Entry configurations inspected via direct stream: package.json, go.mod, README.md, Dockerfile.
- Evaluated system abstractions and modular contracts.

### Core Architecture Module: `.design-sync/previews/EmptyState.tsx`
```
import { EmptyState } from '@skyhook-io/k8s-ui'
import { CircleCheck, Funnel, Plug } from 'lucide-react'
import type { CSSProperties } from 'react'

const panel: CSSProperties = { width: 420, maxWidth: '100%' }
const stack: CSSProperties = { display: 'flex', flexDirection: 'column', gap: 10, width: 460, maxWidth: '100%' }

export function HealthyCard() {
  return (
    <div style={panel}>
      <EmptyState
        tone="healthy"
        icon={CircleCheck}
        headline="All checks passing"
        body="No audit findings across 42 workloads in prod-cluster-us-east1."
      />
    </div>
  )
}

export function FilteredCard() {
  return (
    <div style={panel}>
      <EmptyState
        tone="filtered"
        icon={Funnel}
        headline="No resources match the current filters"
        body="Try widening the namespace scope or clearing the “Warning” severity filter."
      />
    </div>
  )
}

export function NeutralWithAction() {
  return (
    <div style={panel}>
      <EmptyState
        tone="neutral"
        icon={Plug}
        headline="No clusters connected yet"
        body="Connect a kubeconfig context to start exploring your cluster topology."
        action={
          <button type="button" className="btn-brand" style={{ padding: '6px 14px', fontSize: 13, fontWeight: 500 }}>
            Connect cluster
          </button>
        }
      />
    </div>
  )
}

export function InlineVariants() {
  return (
    <div style={stack}>
      <EmptyState variant="inline" tone="healthy" icon={CircleCheck} headline="0 failing pods" body="all Running" />
      <EmptyState variant="inline" tone="filtered" icon={Funnel} headline="No events in the last 15m" />
    </div>
  )
}

```

### Core Architecture Module: `internal/diagnosecli/render.go`
```
package diagnosecli

import (
	"encoding/json"
	"fmt"
	"os"
	"regexp"
	"sort"
	"strings"
	"sync"
	"time"

	"github.com/skyhook-io/radar/internal/ai"
	"github.com/skyhook-io/radar/internal/cliui"
)

const (
	cReset = cliui.Reset
	cDim   = cliui.Dim
	cBold  = cliui.Bold
	cGreen = cliui.Green
	cRed   = cliui.Red
	cAmber = cliui.Amber
	cCyan  = cliui.Cyan

	// clearLine returns the cursor to column 0 and erases the spinner line.
	clearLine = "\r\x1b[K"
)

// renderer writes the live transcript + conclusion to the terminal. In --json mode
// everything human goes to stderr so stdout stays a clean JSON document.
// A single mutex serializes event writes with the spinner goroutine: the model
// goes quiet for long stretches (its own thinking + slow tools), and without a
// live indicator a silent terminal reads as a hang.
type renderer struct {
	w     *os.File
	color bool

	mu          sync.Mutex
	inThinking  bool
	spinnerOn   bool      // spinner line currently drawn (must be erased before real output)
	lastEvent   time.Time // last real output, for the quiet-gap threshold
	activeTool  string    // tool currently running (the spinner speaks its activity verb)
	sawAnything bool      // false until the agent's first output ("starting investigation…")
	watchURL    string
	stopSpin    chan struct{}
	spinStopped bool
}

func newRenderer(jsonMode bool) *renderer {
	w := os.Stdout
	if jsonMode {
		w = os.Stderr
	}
	return &renderer{
		w:         w,
		color:     cliui.ColorEnabled(w),
		lastEvent: time.Now(),
		stopSpin:  make(chan struct{}),
	}
}

var spinnerFrames = []string{"⠋", "⠙", "⠹", "⠸", "⠼", "⠴", "⠦", "⠧", "⠇", "⠏"}

// startSpinner shows a live activity line ("⠙ reading logs… 12s") after a
// second of silence — only on a real terminal (it repaints its own line), and
// never mid-thinking-line.
func (r *renderer) startSpinner() {
	if !r.color {
		return
	}
	go func() {
		t := time.NewTicker(120 * time.Millisecond)
		defer t.Stop()
		frame := 0
		for {
			select {
			case <-r.stopSpin:
				return
			case <-t.C:
			}
			r.mu.Lock()
			quiet := time.Since(r.lastEvent)
			if quiet > time.Second && !r.inThinking {
				fmt.Fprintf(r.w, "%s%s%s %s %ds%s",
					clearLine, cAmber+spinnerFrames[frame%len(spinnerFrames)]+cReset,
					cDim, r.activityVerbLocked(), int(quiet.Seconds()), cReset)
				r.spinnerOn = true
				frame++
			}
			r.mu.Unlock()
		}
	}()
}

func (r *renderer) stopSpinner() {
	r.mu.Lock()
	defer r.mu.Unlock()
	if r.spinStopped {
		return
	}
	r.spinStopped = true
	close(r.stopSpin)
	r.clearSpinnerLocked()
}

// clearSpinnerLocked erases the spinner line before real output. Caller holds r.mu.
func (r *renderer) clearSpinnerLocked() {
	if r.spinnerOn {
		fmt.Fprint(r.w, clearLine)
		r.spinnerOn = false
	}
	r.lastEvent = time.Now()
	r.sawAnything = true
}

// activityVerbLocked mirrors the web panel's live status vocabulary: the wait
// names what the agent is actually doing, not a generic "thinking". Caller
// holds r.mu.
func (r *renderer) activityVerbLocked() string {
	if t := strings.ToLower(r.activeTool); t != "" {
		switch {
		case strings.Contains(t, "log"):
			return "reading logs…"
		case strings.Contains(t, "event"):
			return "checking recent events…"
		case strings.Contains(t, "prometheus") || strings.Contains(t, "metric") || strings.Contains(t, "top"):
			return "checking metrics…"
		case strings.Contains(t, "topology") || strings.Contains(t, "neighborhood") || strings.Contains(t, "graph"):
			return "tracing dependencies…"
		case strings.Contains(t, "list") || strings.Contains(t, "search"):
			return "scanning related resources…"
		case strings.Contains(t, "diagnose"):
			return "collecting evidence…"
		case strings.Contains(t, "resource") || strings.Contains(t, "describe"):
			return "inspecting the resource…"
		}
		return prettyTool(r.activeTool) + "…"
	}
	if !r.sawAnything {
		return "starting investigation…"
	}
	return "thinking…"
}

// toolStarted records the running tool so the spinner narrates it.
func (r *renderer) toolStarted(tool string) {
	r.mu.Lock()
	if tool != "" {
		r.activeTool = tool
	}
	r.mu.Unlock()
}

func (r *renderer) header(run runSummary, base string) {
	r.watchURL = fmt.Sprintf("%s/?ai-run=%s", base, run.ID)
	target := run.Kind
	if run.Group != "" {
		target += "." + run.Group
	}
	target += " "
	if run.Namespace != "" {
		target += run.Namespace + "/"
	}
	target += run.Name
	fmt.Fprintf(r.w, "%s %s\n", r.c(cBold, "◉ Investigating"), r.c(cBold, r.c(cCyan, target)))
	fmt.Fprintf(r.w, "%s\n", r.c(cDim, fmt.Sprintf("%s · via %s · watch: %s", run.ID, ai.AgentLabel(run.Agent), r.watchURL)))
	// Radar's read at start — the concrete issue rows the server captured, shown
	// before the agent produces anything (its boot is the longest silent gap).
	if h := run.Health; h != nil {
		for _, line := range h.Issues {
			sev := r.c(cRed, "●")
			if line.Severity != "critical" {
				sev = r.c(cAmber, "●")
			}
			fmt.Fprintf(r.w, "%s %s — %s\n", sev, r.c(cBold, line.Reason), line.Message)
		}
		if extra := h.IssueCount - len(h.Issues); extra > 0 {
			fmt.Fprintf(r.w, "%s\n", r.c(cDim, fmt.Sprintf("  +%d more active issues", extra)))
		}
		for _, f := range h.AuditFindings {
			fmt.Fprintf(r.w, "%s\n", r.c(cDim, fmt.Sprintf("  audit: %s — %s", f.Reason, f.Message)))
		}
	}
	if run.ManagedBy != "" {
		fmt.Fprintf(r.w, "%s\n", r.c(cDim, "  managed by "+run.ManagedBy))
	}
	fmt.Fprintln(r.w)
}

func (r *renderer) c(code, s string) string {
	if !r.color {
		return s
	}
	return code + s + cReset
}

// thinking streams the agent's interleaved reasoning, dimmed.
func (r *renderer) thinking(token string) {
	if token == "" {
		return
	}
	r.mu.Lock()
	defer r.mu.Unlock()
	r.clearSpinnerLocked()
	if r.color {
		fmt.Fprint(r.w, cDim+token+cReset)
	} else {
		fmt.Fprint(r.w, token)
	}
	r.inThinking = !strings.HasSuffix(token, "\n")
}

// breakThinkingLocked ends a partial reasoning line. Caller holds r.mu.
func (r *renderer) breakThinkingLocked() {
	if r.inThinking {
		fmt.Fprintln(r.w)
		r.inThinking = false
	}
}

// step prints one completed tool call: "  ✓ get resource kind=node name=… 44ms".
func (r *renderer) step(s stepInfo) {
	r.mu.Lock()
	defer r.mu.Unlock()
	r.clearSpinnerLocked()
	r.breakThinkingLocked()
	if s.Tool == r.activeTool {
		r.activeTool = ""
	}
	line := "  " + r.c(cGreen, "✓") + " " + prettyTool(s.Tool)
	if args := prettyArgs(s.Summary); args != "" {
		line += " " + r.c(cDim, args)
	}
	if s.Ms != nil {
		line += r.c(cDim, fmt.Sprintf("  %dms", *s.Ms))
	}
	fmt.Fprintln(r.w, line)
}

func prettyTool(tool string) string {
	return strings.ReplaceAll(tool, "_", " ")
}

// prettyArgs renders a tool's JSON input as terse k=v pairs — raw braces and
// quotes read as noise at a glance. Identity keys lead (kind, namespace, name),
// the rest follow sorted; anything non-JSON falls back to a compacted string.
func prettyArgs(raw string) string {
	raw = strings.TrimSpace(raw)
	if raw == "" {
		return ""
	}
	var m map[string]any
	if err := json.Unmarshal([]byte(raw), &m); err != nil || len(m) == 0 {
		return compact(raw, 80)
	}
	lead := []string{"kind", "namespace", "name"}
	parts := make([]string, 0, len(m))
	seen := map[string]bool{}
	for _, k := range lead {
		if v, ok := m[k]; ok {
			parts = append(parts, fmt.Sprintf("%s=%v", k, v))
			seen[k] = true
		}
	}
	rest := make([]string, 0, len(m))
	for k := range m {
		if !seen[k] {
			rest = append(rest, k)
		}
	}
	sort.Strings(rest)
	for _, k := range rest {
		parts = append(parts, fmt.Sprintf("%s=%v", k, m[k]))
	}
	return compact(strings.Join(parts, " "), 90)
}

func compact(s string, max int) string {
	s = strings.Join(strings.Fields(s), " ")
	if len(s) > max {
		return s[:max-1] + "…"
	}
	return s
}

func (r *renderer) errorLine(msg string) {
	r.mu.Lock()
	defer r.mu.Unlock()
	r.clearSpinnerLocked()
	r.breakThinkingLocked()
	fmt.Fprintf(r.w, "\n%s %s\n", r.c(cRed, "✗"), msg)
}

func (r *renderer) conclusion(d diagnosis) {
	r.mu.Lock()
	defer r.mu.Unlock()
	r.clearSpinnerLocked()
	r.breakThinkingLocked()
	fmt.Fprintln(r.w)
	switch {
	case d.Healthy && d.RootCause == "":
		fmt.Fprintf(r.w, "%s\n", r.c(cGreen, r.c(cBold, "✔ No problems found")))
		if d.Report != "" {
			fmt.Fprintln(r.w, r.md(d.Report))
		}
	case d.Inconclusive && d.RootCause == "":
		fmt.Fprintf(r.w, "%s\n", r.c(cAmber, r.c(cBold, "? Couldn't determine")))
		if d.Report != "" {
			fmt.Fprintln(r.w, r.md(d.Report))
		}
	case d.RootCause != "":
		conf := ""
		if d.Confidence != nil {
			label := confidenceLabel(*d.Confidence)
			col := cGreen
			switch label {
			case "medium":
				col = cAmber
			case "low":
				col = cRed
			}
			conf = r.c(cDim, " · confidence ") + r.c(col, label)
		}
		fmt.Fprintf(r.w, "%s%s\n", r.c(cAmber, r.c(cBold, "▲ Root cause")), conf)
		fmt.Fprintln(r.w, r.md(d.RootCause))
		if len(d.Remediation) > 0 {
			fmt.Fprintf(r.w, "\n%s\n", r.c(cBold, "Remediation"))
			for i, step := range d.Remediation {
				marker := fmt.Sprintf("  %s", r.c(cDim, fmt.Sprintf("%d.", i+1)))
				if d.RecommendedIndex != nil && *d.RecommendedIndex == i+1 {
					marker = "  " + r.c(cGreen, fmt.Sprintf("★%d.", i+1))
				}
				fmt.Fprintf(r.w, "%s %s\n", marker, r.md(step))
			}
			if d.RecommendedIndex != nil && d.RecommendedReason != "" {
				fmt.Fprintf(r.w, "  %s\n", r.c(cDim, "★ recommended — "+d.RecommendedReason))
			}
		}
	default:
		// No structured conclusion — show whatever the agent said.
		if d.Report != "" {
			fmt.Fprintln(r.w, r.md(d.Report))
		} else {
			fmt.Fprintln(r.w, "The investigation finished without a clear conclusion.")
		}
	}
	footer := "AI-generated — review before applying. Continue in the Radar UI or your own agent."
	if r.watchURL != "" {
		footer = "AI-generated — review before applying. Continue in Radar: " + r.watchURL + " — or in your own agent."
	}
	fmt.Fprintf(r.w, "\n%s\n", r.c(cDim, footer))
}

func confidenceLabel(c float64) string {
	switch {
	case c >= 0.8:
		return "high"
	case c >= 0.5:
		return "medium"
	}
	return "low"
}

var (
	mdBo
```

### Core Architecture Module: `internal/helm/hook_evidence.go`
```
package helm

import (
	"context"
	"fmt"
	"io"
	"sort"
	"strings"
	"time"

	"github.com/skyhook-io/radar/internal/podlogs"
	aicontext "github.com/skyhook-io/radar/pkg/ai/context"
	"github.com/skyhook-io/radar/pkg/k8score"
	batchv1 "k8s.io/api/batch/v1"
	corev1 "k8s.io/api/core/v1"
	apierrors "k8s.io/apimachinery/pkg/api/errors"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/apimachinery/pkg/labels"
	"k8s.io/client-go/kubernetes"
)

const (
	maxHookEvidencePods       = 2
	maxHookEvidenceEvents     = 6
	maxHookEvidenceContainers = 3
	maxHookEvidenceLogs       = 4
	hookLogTailLines          = 80
	hookLogReadLimitBytes     = 128 * 1024
	hookLogTimeout            = 4 * time.Second
)

type hookObjectRef struct {
	kind string
	name string
}

// EnrichHookDiagnosticsWithClusterEvidence attaches live Job/Pod/Event/log clues
// for failed or running Helm hooks. It uses the caller's Kubernetes client so
// auth-enabled deployments keep Kubernetes RBAC as the source of truth.
func EnrichHookDiagnosticsWithClusterEvidence(ctx context.Context, detail *HelmReleaseDetail, client kubernetes.Interface) {
	if detail == nil || len(detail.HookDiagnostics) == 0 {
		return
	}
	if client == nil {
		for i := range detail.HookDiagnostics {
			diag := &detail.HookDiagnostics[i]
			diag.EvidenceUnavailable = true
			diag.EvidenceUnavailableReason = "Radar could not read live hook evidence because no Kubernetes client was available for this request."
		}
		return
	}

	hooks := make(map[string]HelmHook, len(detail.Hooks)*2)
	for _, hook := range detail.Hooks {
		hooks[hookDiagnosticKey(hook.Namespace, hook.Kind, hook.Name)] = hook
		hooks[hookDiagnosticKey("", hook.Kind, hook.Name)] = hook
	}

	for i := range detail.HookDiagnostics {
		diag := &detail.HookDiagnostics[i]
		namespace := diag.Namespace
		if namespace == "" {
			namespace = detail.Namespace
		}
		hook, ok := hooks[hookDiagnosticKey(namespace, diag.Kind, diag.Name)]
		if !ok {
			hook = hooks[hookDiagnosticKey("", diag.Kind, diag.Name)]
		}
		if hook.Name == "" {
			hook = HelmHook{
				Name:      diag.Name,
				Namespace: namespace,
				Kind:      diag.Kind,
				Events:    diag.Events,
				Status:    diag.Phase,
			}
		}
		if hook.Namespace == "" {
			hook.Namespace = namespace
		}

		evidence := collectHookEvidence(ctx, client, hook)
		if evidence.hasData() {
			diag.Evidence = &evidence
		}
		if evidence.hasLiveEvidence() {
			diag.EvidenceUnavailable = false
			diag.EvidenceUnavailableReason = ""
			continue
		}
		if hasPrimaryHookEvidenceError(evidence.Errors) {
			diag.EvidenceUnavailable = true
			diag.EvidenceUnavailableReason = "Radar could not read live hook evidence with the current Kubernetes identity."
			continue
		}
		if diag.EvidenceUnavailable {
			continue
		}
		diag.EvidenceUnavailable = true
		diag.EvidenceUnavailableReason = "No live Job/Pod evidence found for this hook; it may have been deleted by a hook policy, TTL controller, or garbage collection."
	}
}

func hookDiagnosticKey(namespace, kind, name string) string {
	return namespace + "/" + strings.ToLower(kind) + "/" + name
}

func collectHookEvidence(ctx context.Context, client kubernetes.Interface, hook HelmHook) HookEvidence {
	namespace := hook.Namespace
	evidence := HookEvidence{}
	refs := []hookObjectRef{{kind: hook.Kind, name: hook.Name}}
	var pods []*corev1.Pod

	switch strings.ToLower(hook.Kind) {
	case "job":
		job, err := client.BatchV1().Jobs(namespace).Get(ctx, hook.Name, metav1.GetOptions{})
		if err == nil {
			evidence.Jobs = append(evidence.Jobs, hookJobEvidence(job))
			refs = append(refs, hookObjectRef{kind: "Job", name: job.Name})
		} else if !apierrors.IsNotFound(err) {
			evidence.Errors = append(evidence.Errors, "job: "+compactHookEvidenceError(err))
		}
		jobPods, errs := listHookPodsForJob(ctx, client, namespace, hook.Name)
		pods = append(pods, jobPods...)
		evidence.Errors = append(evidence.Errors, errs...)
	case "pod":
		pod, err := client.CoreV1().Pods(namespace).Get(ctx, hook.Name, metav1.GetOptions{})
		if err == nil {
			pods = append(pods, pod)
		} else if !apierrors.IsNotFound(err) {
			evidence.Errors = append(evidence.Errors, "pod: "+compactHookEvidenceError(err))
		}
	}

	pods = dedupeAndSortPods(pods)
	for _, pod := range pods {
		evidence.Pods = append(evidence.Pods, hookPodEvidence(pod))
		refs = append(refs, hookObjectRef{kind: "Pod", name: pod.Name})
	}

	events, eventErr := listHookEvents(ctx, client, namespace, refs)
	evidence.Events = events
	if eventErr != "" {
		evidence.Errors = append(evidence.Errors, eventErr)
	}

	logs := collectHookLogs(ctx, client, namespace, pods)
	evidence.Logs = append(evidence.Logs, logs...)
	evidence.Errors = compactHookEvidenceErrors(evidence.Errors)
	evidence.Summary = summarizeHookEvidence(evidence)
	return evidence
}

func hookJobEvidence(job *batchv1.Job) HookJobEvidence {
	out := HookJobEvidence{
		Name:      job.Name,
		Namespace: job.Namespace,
		Active:    job.Status.Active,
		Succeeded: job.Status.Succeeded,
		Failed:    job.Status.Failed,
		Status:    "unknown",
	}
	if job.Status.Active > 0 {
		out.Status = "active"
	}
	if job.Status.Succeeded > 0 {
		out.Status = "succeeded"
	}
	if job.Status.Failed > 0 {
		out.Status = "failed"
	}
	for _, cond := range job.Status.Conditions {
		if cond.Type == batchv1.JobComplete && cond.Status == corev1.ConditionTrue {
			out.Status = "succeeded"
		}
		if cond.Type == batchv1.JobFailed && cond.Status == corev1.ConditionTrue {
			out.Status = "failed"
		}
		parts := []string{string(cond.Type) + "=" + string(cond.Status)}
		if cond.Reason != "" {
			parts = append(parts, cond.Reason)
		}
		if cond.Message != "" {
			parts = append(parts, truncateHookText(aicontext.RedactSecrets(cond.Message), 220))
		}
		out.Conditions = append(out.Conditions, strings.Join(parts, ": "))
	}
	return out
}

func hookPodEvidence(pod *corev1.Pod) HookPodEvidence {
	out := HookPodEvidence{
		Name:      pod.Name,
		Namespace: pod.Namespace,
		Phase:     string(pod.Status.Phase),
		Reason:    pod.Status.Reason,
		Message:   truncateHookText(aicontext.RedactSecrets(pod.Status.Message), 220),
	}
	var ready, total int
	consider := func(status corev1.ContainerStatus) {
		total++
		if status.Ready {
			ready++
		}
		out.RestartCount += status.RestartCount
		if out.Reason == "" {
			if status.State.Waiting != nil {
				out.Reason = status.State.Waiting.Reason
				out.Message = truncateHookText(aicontext.RedactSecrets(status.State.Waiting.Message), 220)
			} else if status.State.Terminated != nil && status.State.Terminated.ExitCode != 0 {
				out.Reason = status.State.Terminated.Reason
				out.Message = truncateHookText(aicontext.RedactSecrets(status.State.Terminated.Message), 220)
			}
		}
	}
	for _, status := range pod.Status.InitContainerStatuses {
		consider(status)
	}
	for _, status := range pod.Status.ContainerStatuses {
		consider(status)
	}
	if total > 0 {
		out.Ready = fmt.Sprintf("%d/%d", ready, total)
	}
	return out
}

func listHookPodsForJob(ctx context.Context, client kubernetes.Interface, namespace, jobName string) ([]*corev1.Pod, []string) {
	var pods []*corev1.Pod
	var errs []string
	selectors := []string{
		labels.Set{"job-name": jobName}.String(),
		labels.Set{"batch.kubernetes.io/job-name": jobName}.String(),
	}
	for _, selector := range selectors {
		list, err := client.CoreV1().Pods(namespace).List(ctx, metav1.ListOptions{LabelSelector: selector})
		if err != nil {
			if !apierrors.IsNotFound(err) {
				errs = append(errs, "pods: "+compactHookEvidenceError(err))
			}
			continue
		}
		for i := range list.Items {
			pod := list.Items[i]
			pods = append(pods, &pod)
		}
	}
	return dedupeAndSortPods(pods), compactHookEvidenceErrors(errs)
}

func dedupeAndSortPods(pods []*corev1.Pod) []*corev1.Pod {
	seen := map[string]bool{}
	out := make([]*corev1.Pod, 0, len(pods))
	for _, pod := range pods {
		if pod == nil {
			continue
		}
		key := pod.Namespace + "/" + pod.Name
		if seen[key] {
			continue
		}
		seen[key] = true
		out = append(out, pod)
	}
	sort.Slice(out, func(i, j int) bool {
		return out[i].Namespace+"/"+out[i].Name < out[j].Namespace+"/"+out[j].Name
	})
	if len(out) > maxHookEvidencePods {
		out = out[:maxHookEvidencePods]
	}
	return out
}

func listHookEvents(ctx context.Context, client kubernetes.Interface, namespace string, refs []hookObjectRef) ([]HookEventEvidence, string) {
	if len(refs) == 0 {
		return nil, ""
	}
	want := map[string]bool{}
	for _, ref := range refs {
		if ref.kind != "" && ref.name != "" {
			want[strings.ToLower(ref.kind)+"/"+ref.name] = true
		}
	}
	list, err := client.CoreV1().Events(namespace).List(ctx, metav1.ListOptions{})
	if err != nil {
		if apierrors.IsNotFound(err) {
			return nil, ""
		}
		return nil, "events: " + compactHookEvidenceError(err)
	}
	events := make([]corev1.Event, 0)
	for _, event := range list.Items {
		key := strings.ToLower(event.InvolvedObject.Kind) + "/" + event.InvolvedObject.Name
		if want[key] {
			events = append(events, event)
		}
	}
	sort.SliceStable(events, func(i, j int) bool {
		leftWarning := events[i].Type == corev1.EventTypeWarning
		rightWarning := events[j].Type == corev1.EventTypeWarning
		if leftWarning != rightWarning {
			return leftWarning
		}
		return hookEventTime(events[i]).After(hookEventTime(events[j]))
	})
	if len(events) > maxHookEvidenceEvents {
		events = events[:maxHookEvidenceEvents]
	}
	out := make([]HookEventEvidence, 0, len(events))
	for _, event := range events {
		out = append(out, HookEventEvidence{
			InvolvedKind: event.InvolvedObject.Kind,
			InvolvedName: event.InvolvedObject.Name,
			Type:         event.Type,
			Reason:       event.Reason,
			Message:      truncateHookText(aicontext.RedactSecrets(event.Message), 260),
			Count:        event.Count,
			LastSeen:     formatHookTime(hookEventTime(event)),
		})
	}
	return out, ""
}

func hookEventTime(event corev1.Event) time.Time {
	if !event.EventTime.Time.IsZero() {
		return event.EventTime.Time
	}
	if !event.LastTimestamp.Time.IsZero()
```

### Core Architecture Module: `internal/imageutil/image.go`
```
package imageutil

import (
	"strings"
)

// Untagged references do not imply a version; an explicit tag remains useful
// even when a digest pins the image.
func ImageTag(image string) string {
	if image == "" {
		return ""
	}
	if at := strings.Index(image, "@"); at >= 0 {
		image = image[:at]
	}
	slash := strings.LastIndex(image, "/")
	colon := strings.LastIndex(image, ":")
	if colon > slash {
		return image[colon+1:]
	}
	return ""
}

// Repository is the image reference without its tag or digest: two workloads
// running the same repository at different tags run the same software.
func Repository(image string) string {
	if image == "" {
		return ""
	}
	if at := strings.Index(image, "@"); at >= 0 {
		image = image[:at]
	}
	slash := strings.LastIndex(image, "/")
	colon := strings.LastIndex(image, ":")
	if colon > slash {
		return image[:colon]
	}
	return image
}

```

### Core Architecture Module: `internal/issues/admission_webhook_candidates.go`
```
package issues

import (
	"fmt"
	"regexp"
	"slices"
	"sort"
	"strings"
	"time"

	"github.com/skyhook-io/radar/internal/k8s"
	"github.com/skyhook-io/radar/pkg/issuesapi"
	"github.com/skyhook-io/radar/pkg/timeutil"
	admissionv1 "k8s.io/api/admissionregistration/v1"
	corev1 "k8s.io/api/core/v1"
	networkingv1 "k8s.io/api/networking/v1"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/apimachinery/pkg/labels"
	"k8s.io/apimachinery/pkg/runtime"
)

// An admission rejection that names a webhook says which call failed but not
// why; one that only says the create timed out names nothing. This pass adds
// what the configuration and the backend's observed state show: failurePolicy,
// timeoutSeconds, the backend Service's ready pods and, for a call that timed
// out, NetworkPolicies that may keep the API server from reaching it.

const (
	factAdmissionWebhookCandidates = "admission_webhook_candidates"
	maxAdmissionWebhookCandidates  = 5
	// recentWebhookConfiguration is how new a configuration must be for its
	// age to be stated and to rank it ahead of long-standing ones.
	recentWebhookConfiguration = 24 * time.Hour
)

// admissionWebhookCallTimedOut matches a webhook call that waited out its
// deadline rather than failing at once (refused, no endpoints, x509): the
// shape a NetworkPolicy dropping the API server's packets produces.
var admissionWebhookCallTimedOut = regexp.MustCompile(`(?i)context deadline exceeded|i/o timeout|Client\.Timeout|TLS handshake timeout`)

// admissionPodCreators are the kinds whose FailedCreate is a Pod create.
// A CronJob row is a Job's failure folded into its CronJob, unless the
// CronJob controller failed creating the Job itself ("Error creating job:").
var admissionPodCreators = map[string]string{
	"ReplicaSet":  "apps",
	"Deployment":  "apps",
	"StatefulSet": "apps",
	"DaemonSet":   "apps",
	"Job":         "batch",
	"CronJob":     "batch",
}

func isPodCreateAdmissionFailure(i Issue) bool {
	if i.Category != issuesapi.CategoryAdmissionWebhookBlocking || (i.Reason != "WebhookUnavailable" && i.Reason != "CreateTimeout") ||
		i.Namespace == "" || admissionPodCreators[i.Kind] != i.Group {
		return false
	}
	if i.Kind == "CronJob" && strings.Contains(strings.ToLower(i.Message), "error creating job:") {
		return false
	}
	// RelatedIssues composes (and so enriches) before grouping, and a grouped
	// row can keep its representative's context.
	return i.DiagnosticContext == nil || !slices.ContainsFunc(i.DiagnosticContext.Facts, func(f issuesapi.DiagnosticFact) bool {
		return f.Type == factAdmissionWebhookCandidates
	})
}

type admissionWebhookCandidateProvider interface {
	admissionWebhookCandidatesFact(Issue, podTemplateAccess) *issuesapi.DiagnosticFact
}

func enrichAdmissionWebhookCandidates(shaped []Issue, p Provider, access podTemplateAccess) []Issue {
	provider, ok := p.(admissionWebhookCandidateProvider)
	if !ok {
		return shaped
	}
	var out []Issue
	for idx := range shaped {
		i := shaped[idx]
		if !isPodCreateAdmissionFailure(i) {
			continue
		}
		fact := provider.admissionWebhookCandidatesFact(i, access)
		if fact == nil {
			continue
		}
		if out == nil {
			out = append([]Issue(nil), shaped...)
		}
		ctx := issuesapi.DiagnosticContext{Role: issuesapi.DiagnosticRoleCandidate}
		if i.DiagnosticContext != nil {
			ctx = *i.DiagnosticContext
			ctx.Role = issuesapi.DiagnosticRoleCandidate
			ctx.Facts = slices.Clone(ctx.Facts)
		}
		ctx.Facts = append(ctx.Facts, *fact)
		out[idx].DiagnosticContext = &ctx
	}
	if out == nil {
		return shaped
	}
	return out
}

// admissionWebhook is one webhook's Pod CREATE scope and call settings.
type admissionWebhook struct {
	configuration   Ref
	created         time.Time
	name            string
	mutating        bool
	podCreate       bool
	namespace       labels.Selector
	objectSelector  bool
	matchConditions bool
	failurePolicy   string
	timeoutSeconds  int32
	service         *admissionv1.ServiceReference
}

type admissionWebhookSet struct {
	webhooks []admissionWebhook
	// unchecked names the configuration kinds that could not be inspected,
	// with the reason.
	unchecked []string
}

func (p *CacheProvider) admissionWebhooks(access podTemplateAccess) admissionWebhookSet {
	var set admissionWebhookSet
	for _, kind := range []string{"MutatingWebhookConfiguration", "ValidatingWebhookConfiguration"} {
		const group = "admissionregistration.k8s.io"
		if access.cluster != nil && !access.cluster(kind, group) {
			set.unchecked = append(set.unchecked, kind+"s were not checked: the caller cannot list them.")
			continue
		}
		if p.dynamic == nil || p.discovery == nil {
			set.unchecked = append(set.unchecked, kind+"s were not checked: Radar has not cached them.")
			continue
		}
		gvr, ok := p.discovery.GetGVRWithGroup(kind, group)
		if !ok || !p.dynamic.IsClusterWideSynced(gvr) {
			set.unchecked = append(set.unchecked, kind+"s were not checked: Radar has not cached them.")
			continue
		}
		items, err := p.dynamic.ListWatched(gvr)
		if err != nil {
			set.unchecked = append(set.unchecked, kind+"s were not checked: Radar has not cached them.")
			continue
		}
		unreadable := false
		for _, item := range items {
			ref := Ref{Group: group, Kind: kind, Name: item.GetName()}
			if !access.canRead(ref) {
				unreadable = true
				continue
			}
			webhooks := compileAdmissionWebhooks(ref, item.Object)
			for idx := range webhooks {
				webhooks[idx].created = item.GetCreationTimestamp().Time
			}
			set.webhooks = append(set.webhooks, webhooks...)
		}
		if unreadable {
			set.unchecked = append(set.unchecked, "Some "+kind+"s are not readable by the caller and were not checked.")
		}
	}
	return set
}

func compileAdmissionWebhooks(ref Ref, obj map[string]any) []admissionWebhook {
	type webhookSpec struct {
		name              string
		rules             []admissionv1.RuleWithOperations
		namespaceSelector *metav1.LabelSelector
		objectSelector    *metav1.LabelSelector
		matchConditions   int
		failurePolicy     *admissionv1.FailurePolicyType
		timeoutSeconds    *int32
		service           *admissionv1.ServiceReference
	}
	var specs []webhookSpec
	if ref.Kind == "MutatingWebhookConfiguration" {
		var config admissionv1.MutatingWebhookConfiguration
		if runtime.DefaultUnstructuredConverter.FromUnstructured(obj, &config) != nil {
			return nil
		}
		for _, w := range config.Webhooks {
			specs = append(specs, webhookSpec{w.Name, w.Rules, w.NamespaceSelector, w.ObjectSelector, len(w.MatchConditions), w.FailurePolicy, w.TimeoutSeconds, w.ClientConfig.Service})
		}
	} else {
		var config admissionv1.ValidatingWebhookConfiguration
		if runtime.DefaultUnstructuredConverter.FromUnstructured(obj, &config) != nil {
			return nil
		}
		for _, w := range config.Webhooks {
			specs = append(specs, webhookSpec{w.Name, w.Rules, w.NamespaceSelector, w.ObjectSelector, len(w.MatchConditions), w.FailurePolicy, w.TimeoutSeconds, w.ClientConfig.Service})
		}
	}
	out := make([]admissionWebhook, 0, len(specs))
	for _, spec := range specs {
		ns := labels.Everything()
		if spec.namespaceSelector != nil {
			selector, err := metav1.LabelSelectorAsSelector(spec.namespaceSelector)
			if err != nil {
				continue
			}
			ns = selector
		}
		// The API server defaults: failurePolicy Fail, timeoutSeconds 10.
		failurePolicy := string(admissionv1.Fail)
		if spec.failurePolicy != nil {
			failurePolicy = string(*spec.failurePolicy)
		}
		timeout := int32(10)
		if spec.timeoutSeconds != nil {
			timeout = *spec.timeoutSeconds
		}
		create, _ := podRuleOperations(spec.rules)
		out = append(out, admissionWebhook{
			configuration: ref, name: spec.name, mutating: ref.Kind == "MutatingWebhookConfiguration",
			podCreate: create, namespace: ns,
			objectSelector:  spec.objectSelector != nil && (len(spec.objectSelector.MatchLabels) > 0 || len(spec.objectSelector.MatchExpressions) > 0),
			matchConditions: spec.matchConditions > 0,
			failurePolicy:   failurePolicy, timeoutSeconds: timeout, service: spec.service,
		})
	}
	return out
}

func (p *CacheProvider) admissionWebhookCandidatesFact(issue Issue, access podTemplateAccess) *issuesapi.DiagnosticFact {
	if p == nil || p.cache == nil {
		return nil
	}
	if issue.Reason == "WebhookUnavailable" {
		return p.namedWebhookFact(issue, access)
	}
	return p.createTimeoutFact(issue, access)
}

// namedWebhookFact describes the webhook a failed call names. The message
// proves the call was made, so its scope is not re-checked.
func (p *CacheProvider) namedWebhookFact(issue Issue, access podTemplateAccess) *issuesapi.DiagnosticFact {
	blocker, ok := k8s.ParseAdmissionBlocker(issue.Message)
	if !ok || blocker.WebhookName == "" {
		return nil
	}
	timedOut := admissionWebhookCallTimedOut.MatchString(issue.Message)
	var lines []string
	var refs []Ref
	for _, w := range p.admissionWebhooks(access).webhooks {
		if w.name != blocker.WebhookName {
			continue
		}
		line, lineRefs, _ := p.describeAdmissionWebhook(w, timedOut, false, access)
		lines = append(lines, line)
		refs = append(refs, lineRefs...)
	}
	if len(lines) == 0 {
		return nil
	}
	return &issuesapi.DiagnosticFact{
		Type:       factAdmissionWebhookCandidates,
		Message:    namedWebhookMessage(blocker.WebhookName, lines),
		Confidence: issuesapi.ConfidenceHigh,
		Refs:       limitRefs(dedupeRefs(refs), maxDiagnosticRefs),
	}
}

// namedWebhookMessage presents the named webhook. Webhook names are unique
// only within a configuration, so when several declare the name the error
// does not say which one was called.
func namedWebhookMessage(name string, lines []string) string {
	if len(lines) == 1 {
		return "Failing call: " + lines[0] + "."
	}
	return fmt.Sprintf("The error names webhook %s, which %d configurations declare; it does not say which one was called: %s.", name, len(lines), strings.Join(lines, ". "))
}

// createTimeoutFact lists the webhooks that match Pod creation in the
// issue's namespace. The timeout names no webhook, so they are candidates.
func (p *CacheProvider) createTimeoutF
```

### Core Architecture Module: `internal/k8s/connection_state.go`
```
package k8s

import (
	"context"
	"crypto/x509"
	"errors"
	"net"
	"strings"
	"sync"
	"time"

	apierrors "k8s.io/apimachinery/pkg/api/errors"
)

// ConnectionState represents the current connection status to the cluster
type ConnectionState string

const (
	StateConnected    ConnectionState = "connected"
	StateDisconnected ConnectionState = "disconnected"
	StateConnecting   ConnectionState = "connecting"
)

// ConnectionStatus holds detailed information about the cluster connection
type ConnectionStatus struct {
	State       ConnectionState `json:"state"`
	Context     string          `json:"context"`
	ClusterName string          `json:"clusterName,omitempty"`
	Error       string          `json:"error,omitempty"`
	ErrorType   string          `json:"errorType,omitempty"` // config, auth, auth-rejected, auth-plugin-stuck, rbac, network, timeout, tls, unknown
	ProgressMsg string          `json:"progressMessage,omitempty"`
	// DisconnectedAt is when this context stopped working (RFC 3339, UTC).
	// It survives retries and their changing errors, and clears on connect,
	// so the UI can say how long the cluster has been down. Set by
	// SetConnectionStatus; callers leave it empty.
	DisconnectedAt string `json:"disconnectedAt,omitempty"`
}

// outageStart carries DisconnectedAt from one status to the next: it starts
// when a context first reports disconnected and holds through retries until
// the context connects or another context takes over.
func outageStart(prev, next ConnectionStatus, now time.Time) string {
	if next.State == StateConnected {
		return ""
	}
	if prev.DisconnectedAt != "" && prev.Context == next.Context {
		return prev.DisconnectedAt
	}
	if next.State == StateDisconnected {
		return now.UTC().Format(time.RFC3339)
	}
	return ""
}

// ConnectionChangeCallback is called when the connection status changes
type ConnectionChangeCallback func(status ConnectionStatus)

var (
	connectionStatus      ConnectionStatus
	connectionStatusMu    sync.RWMutex
	connectionCallbacks   []ConnectionChangeCallback
	connectionCallbacksMu sync.RWMutex
	clusterLivenessProbe  = defaultClusterLivenessProbe
)

// GetConnectionStatus returns the current connection status
func GetConnectionStatus() ConnectionStatus {
	connectionStatusMu.RLock()
	defer connectionStatusMu.RUnlock()
	return connectionStatus
}

// SetConnectionStatus updates the connection status and notifies callbacks
func SetConnectionStatus(status ConnectionStatus) {
	connectionStatusMu.Lock()
	status.DisconnectedAt = outageStart(connectionStatus, status, time.Now())
	if connectionStatus == status {
		connectionStatusMu.Unlock()
		return
	}
	connectionStatus = status
	connectionStatusMu.Unlock()

	// Publish-side recovery ownership: every route into an auth-shaped
	// disconnect (bootstrap with expired credentials, failed retry, failed
	// context switch) must leave a reconnect loop running — the browser no
	// longer auto-retries auth failures. Owed survives later non-auth
	// republications (a hung-plugin retry classifies "timeout") and is only
	// settled by a successful connect.
	switch status.State {
	case StateConnected:
		runtimeAuthRecoveryOwed.Store(false)
		resetInconclusiveStreak()
	case StateDisconnected:
		if isAuthClassification(status.ErrorType) {
			runtimeAuthRecoveryOwed.Store(true)
		}
		if runtimeAuthRecoveryOwed.Load() {
			startRuntimeAuthRecovery()
		}
	}

	notifyConnectionChange(status)
}

func notifyConnectionChange(status ConnectionStatus) {
	connectionCallbacksMu.RLock()
	callbacks := make([]ConnectionChangeCallback, len(connectionCallbacks))
	copy(callbacks, connectionCallbacks)
	connectionCallbacksMu.RUnlock()

	for _, cb := range callbacks {
		cb(status)
	}
}

// MarkDisconnectedIfClusterUnreachable updates the shared connection state when
// a live Kubernetes request proves that the current cluster endpoint is gone.
func MarkDisconnectedIfClusterUnreachable(message string) bool {
	if isAuthClassification(ClassifyError(errors.New(message))) {
		// Credential loss must go through the demotion pipeline — it confirms
		// with a fresh probe, gates on endpoint reachability, and quiesces
		// cluster-backed work. Publishing disconnected directly would skip
		// the teardown AND disarm the pipeline (candidate intake requires
		// StateConnected), leaving informers hammering the dead credential
		// for the whole outage.
		clientMu.RLock()
		generation := activeClientGeneration
		clientMu.RUnlock()
		reportRuntimeAuthFailure(generation, errors.New(message))
		return false
	}
	if !isClusterUnreachableMessage(message) {
		return false
	}
	current := GetConnectionStatus()
	if current.State == StateDisconnected && current.Error == message {
		return true
	}
	if clusterReachableNow(2 * time.Second) {
		return false
	}

	status := ConnectionStatus{
		State:       StateDisconnected,
		Context:     current.Context,
		ClusterName: current.ClusterName,
		Error:       message,
		ErrorType:   ClassifyError(errors.New(message)),
	}
	SetConnectionStatus(status)
	return true
}

func clusterReachableNow(timeout time.Duration) bool {
	ctx, cancel := context.WithTimeout(context.Background(), timeout)
	defer cancel()
	return clusterLivenessProbe(ctx) == nil
}

func defaultClusterLivenessProbe(ctx context.Context) error {
	client := GetClient()
	if client == nil {
		return errors.New("kubernetes client is not initialized")
	}
	restClient := client.Discovery().RESTClient()
	if restClient == nil {
		return errors.New("kubernetes discovery client is not initialized")
	}
	_, err := restClient.Get().AbsPath("/version").Do(ctx).Raw()
	return err
}

func isClusterUnreachableMessage(message string) bool {
	lower := strings.ToLower(message)
	if strings.Contains(lower, "kubernetes cluster unreachable") ||
		strings.Contains(lower, "cluster unreachable") {
		return true
	}
	return isHelmKubernetesOperationError(lower) && isTransportConnectivityError(lower)
}

func isHelmKubernetesOperationError(lower string) bool {
	kubernetesOperationPrefixes := []string{
		"failed to build helm restclientgetter",
		"failed to initialize helm action config",
		"failed to build helm action config",
		"failed to list helm releases",
		"failed to get helm release",
		"failed to get release",
		"failed to get current release",
		"failed to get current values",
		"failed to get helm release history",
		"failed to get helm release manifest",
		"failed to get helm release values",
		"failed to get manifest for revision",
		"failed to get values for revision",
		"failed to get release revision",
		"failed to inspect release storage namespaces",
		"failed to inspect existing release",
		"failed to preview values change",
		"failed to apply values",
		"rollback failed",
		"uninstall failed",
		"upgrade failed",
		"install failed",
	}
	for _, prefix := range kubernetesOperationPrefixes {
		if strings.HasPrefix(lower, prefix) {
			return true
		}
	}
	return false
}

func isTransportConnectivityError(lower string) bool {
	return isTransportNetworkMessage(lower) || isTransportTimeoutMessage(lower)
}

func isTransportNetworkMessage(lower string) bool {
	transportMarkers := []string{
		"connection refused",
		"no such host",
		"dial tcp",
		"dial udp",
		"no route to host",
		"connection reset by peer",
		"network is unreachable",
	}
	for _, marker := range transportMarkers {
		if strings.Contains(lower, marker) {
			return true
		}
	}
	return false
}

func isTransportTimeoutMessage(lower string) bool {
	timeoutMarkers := []string{
		"i/o timeout",
		"context deadline exceeded",
		"tls handshake timeout",
		"timed out",
		"timeout",
	}
	for _, marker := range timeoutMarkers {
		if strings.Contains(lower, marker) {
			return true
		}
	}
	return false
}

// isAuthErrorMessage matches client-side credential acquisition failures (exec
// plugins, SSO sessions) — no request reached the API server, and
// re-authenticating locally is the fix.
func isAuthErrorMessage(lower string) bool {
	authMarkers := []string{
		"token has expired",
		"expired token",
		"sso session",
		"sso token",
		"ssoproviderinvalidtoken",
		"aws sso login",
		"getting credentials",
		"credentials expired",
		"credential plugin",
		"exec credential",
		"exec plugin",
		"gke-gcloud-auth-plugin",
		// client-go's in-tree oidc auth provider returns refresh failures RAW
		// from RoundTrip (no "getting credentials:" wrapper) — Keycloak/Dex/
		// IBM IKS kubeconfigs die here. "invalid_grant" is the RFC 6749 code
		// every IdP emits for an expired/revoked refresh token.
		"failed to refresh token",
		"invalid_grant",
		"cannot refresh without refresh-token",
		// The exec plugin's TLS client-certificate path (e.g. tsh) fails
		// without the "getting credentials:" wrapper; this phrasing is
		// produced only by client-go's exec plugin runner.
		"exec: executable ",
		"failed to read token file",
		"read empty token from file",
	}
	for _, marker := range authMarkers {
		if strings.Contains(lower, marker) {
			return true
		}
	}
	return false
}

// isAuthRejectedMessage matches HTTP 401 responses: the request reached the API
// server but could not be authenticated. Checked only after isAuthErrorMessage
// so exec-plugin stderr that quotes a server error (e.g. "UnauthorizedException")
// still classifies as client-side auth.
func isAuthRejectedMessage(lower string) bool {
	if strings.Contains(lower, "proxy authentication required") {
		return false
	}
	rejectedMarkers := []string{
		"unauthorized",
		"authentication required",
		"the server has asked for the client to provide credentials",
	}
	for _, marker := range rejectedMarkers {
		if strings.Contains(lower, marker) {
			return true
		}
	}
	return false
}

func isRBACErrorMessage(lower string) bool {
	return strings.Contains(lower, " is forbidden") ||
		strings.Contains(lower, "forbidden:") ||
		strings.Contains(lower, "cannot list resource") ||
		strings.Contains(lower, "cannot get resource")
}

func isConfigErrorMessage(lower string) bool {
	configMarkers := []string{
		"no context con
```

### Core Architecture Module: `internal/k8s/restart_loop.go`
```
package k8s

import (
	"fmt"
	"strings"
	"time"

	corev1 "k8s.io/api/core/v1"
	"k8s.io/apimachinery/pkg/types"

	"github.com/skyhook-io/radar/pkg/health"
	"github.com/skyhook-io/radar/pkg/issuesapi"
)

// Restart-loop issue continuity. A container stuck restarting cycles through
// states that each look like a different problem on a single poll: Waiting
// (CrashLoopBackOff), Running but not ready (readiness), Unhealthy events
// (liveness), Terminated with exit 0, and Running+Ready between crashes. Read
// tick by tick, the pod row changed category (and therefore issue id) on every
// cycle and dropped out entirely on the healthy-looking ticks, so downstream
// alerting saw thousands of open/resolve generations for one ongoing problem.
//
// This classifier is issue-layer only. It decides that one crashloop row stays
// present, with stable severity, for the whole loop; it does not change the
// pod's health level (pkg/health), which still reports what the pod is doing
// right now.
const (
	// restartLoopWindow is how long after its last termination a restarting
	// container is still treated as looping. It is the hysteresis: the issue
	// clears this long after the last crash. Long enough to bridge kubelet
	// backoff (max 5m) and loops whose Running phase lasts many minutes before
	// the next liveness kill.
	restartLoopWindow = 30 * time.Minute
	// restartLoopStaleGap separates one continuous loop from an old termination
	// followed by a fresh start, e.g. a node that was down for a while. Twice
	// the kubelet's maximum backoff, matching pkg/health's stale-crash guard.
	restartLoopStaleGap = 10 * time.Minute
	// restartLoopMinRestarts is the restart count from which a recent
	// termination reads as a loop rather than a one-off crash. RestartCount is
	// cumulative over the container's life, so this approximates a rate: a
	// container that restarted three times last month and once a minute ago
	// also qualifies, for at most restartLoopWindow.
	restartLoopMinRestarts = 3
	// restartLoopFastRun is the run length below which a loop is "fast": the
	// container spends most of its time down or in backoff. It is the
	// kubelet's own line: a container that runs longer than 10 minutes has its
	// crash backoff reset.
	restartLoopFastRun = 10 * time.Minute
	// restartLoopImpactShare is the share of a workload's pods that must be
	// looping for a fast loop to be critical.
	restartLoopImpactShare = 0.5
	// restartLoopProbeMessageMax caps the probe output copied into evidence;
	// exec probes can print arbitrary amounts.
	restartLoopProbeMessageMax = 300
)

// restartLoop is the evidence behind an active restart loop, taken from one
// container so every field describes the same termination.
type restartLoop struct {
	container string
	sidecar   bool
	init      bool
	// status is the looping container's status, for diagnoses that need it.
	status corev1.ContainerStatus
	// memoryLimit reports whether the container declares a memory limit.
	memoryLimit bool
	// podMemoryLimit reports a pod-level memory limit (spec.resources), which
	// caps the combined use of every container in the pod, including this one.
	podMemoryLimit bool
	restartCount   int32
	lastExitCode   int32
	lastReason     string
	lastFinishedAt time.Time
	// lastRun is how long the terminated run lasted; zero when the container
	// never started (StartError) or the runtime did not record a start.
	lastRun time.Duration
	// lastStartedAt is when the last terminated run started; zero when it
	// never started.
	lastStartedAt time.Time
	// lastMessage is the runtime's message for the last termination; for a
	// start failure it is the actual error (e.g. exec: no such file).
	lastMessage string
	liveness    *probeFailure
	readiness   *probeFailure
	startup     *probeFailure
}

// activeRestartLoop reports the container keeping this pod in a restart loop.
//
// Eligible containers are those the kubelet keeps restarting: regular
// containers whose effective restartPolicy is Always, native sidecars (init
// containers with restartPolicy=Always), and ordinary init containers that
// keep failing while the pod is still Pending (Init:CrashLoopBackOff). Job
// workers (OnFailure/Never) retry by design and are excluded.
//
// The exit code is deliberately ignored for regular containers and sidecars.
// The kubelet backs off restarts after any exit, and a liveness kill with a
// graceful shutdown ends Completed/0, so requiring a non-zero exit misses the
// loops that flap the most. An ordinary init container that exits 0 has done
// its job, so only its failures count. OOMKilled terminations count too; the
// row then classifies as oom_killed through its last termination reason.
//
// When several containers qualify, the one that terminated most recently is
// the one actively failing; a container that looped earlier and has since
// recovered can still qualify for the rest of the window and must not be the
// one named. Ties keep status order (regular containers before sidecars).
func activeRestartLoop(pod *corev1.Pod, probes map[string]probeFailure, now time.Time) (restartLoop, bool) {
	// A pod being deleted stops its containers on purpose: a rollout or
	// drain SIGTERM ends Completed/0 and is not a crash.
	if pod == nil || pod.DeletionTimestamp != nil || (pod.Status.Phase != corev1.PodRunning && pod.Status.Phase != corev1.PodPending) {
		return restartLoop{}, false
	}
	var best restartLoop
	found := false
	consider := func(loop restartLoop, ok bool) {
		if ok && (!found || loop.lastFinishedAt.After(best.lastFinishedAt)) {
			best, found = loop, true
		}
	}
	for i := range pod.Status.ContainerStatuses {
		cs := &pod.Status.ContainerStatuses[i]
		if containerRestartsAlways(pod, cs.Name) {
			consider(containerRestartLoop(cs, now))
		}
	}
	for i := range pod.Status.InitContainerStatuses {
		cs := &pod.Status.InitContainerStatuses[i]
		loop, ok := containerRestartLoop(cs, now)
		if isNativeSidecarName(pod, cs.Name) {
			loop.sidecar = true
		} else {
			// An ordinary init container blocks the pod until it succeeds;
			// it loops only while the pod is still initializing and its
			// latest attempt failed.
			loop.init = true
			ok = ok && pod.Status.Phase == corev1.PodPending && loop.lastExitCode != 0
		}
		consider(loop, ok)
	}
	if !found {
		return restartLoop{}, false
	}
	best.podMemoryLimit = podHasMemoryLimit(pod)
	best.memoryLimit = containerHasMemoryLimit(pod, best.container)
	if best.podMemoryLimit && !containerDeclaresMemoryLimit(pod, best.container) {
		// The kubelet applies the pod limit to a container that sets none and
		// reports it in the container's status, so status can't tell an
		// inherited limit from the container's own here; the spec can.
		best.memoryLimit = false
	}
	return withProbeEvidence(best, pod, probes), true
}

func containerHasMemoryLimit(pod *corev1.Pod, name string) bool {
	// The enacted limit (status) wins: an in-place resize can set one the
	// spec no longer shows.
	for _, list := range [][]corev1.ContainerStatus{pod.Status.ContainerStatuses, pod.Status.InitContainerStatuses} {
		for i := range list {
			if list[i].Name == name && list[i].Resources != nil {
				if _, ok := list[i].Resources.Limits[corev1.ResourceMemory]; ok {
					return true
				}
			}
		}
	}
	for _, list := range [][]corev1.Container{pod.Spec.Containers, pod.Spec.InitContainers} {
		for i := range list {
			if list[i].Name == name {
				_, ok := list[i].Resources.Limits[corev1.ResourceMemory]
				return ok
			}
		}
	}
	return false
}

func containerDeclaresMemoryLimit(pod *corev1.Pod, name string) bool {
	for _, list := range [][]corev1.Container{pod.Spec.Containers, pod.Spec.InitContainers} {
		for i := range list {
			if list[i].Name == name {
				_, positive := explicitMemoryLimit(list[i].Resources.Limits)
				return positive
			}
		}
	}
	return false
}

// podHasMemoryLimit reports a declared pod-level memory limit. Only a pod whose
// spec.resources sets one has it: the kubelet can fill status.resources from
// the containers' values on a pod without one. When declared, the enacted value
// in status wins over the spec, as for containers. A zero limit sets no cap.
func podHasMemoryLimit(pod *corev1.Pod) bool {
	if pod.Spec.Resources == nil {
		return false
	}
	if _, declared := pod.Spec.Resources.Limits[corev1.ResourceMemory]; !declared {
		return false
	}
	if pod.Status.Resources != nil {
		if _, ok := pod.Status.Resources.Limits[corev1.ResourceMemory]; ok {
			_, positive := explicitMemoryLimit(pod.Status.Resources.Limits)
			return positive
		}
	}
	_, positive := explicitMemoryLimit(pod.Spec.Resources.Limits)
	return positive
}

// otherContainerActiveOOM reports an active OOM on any container other than
// the named one. A sibling's OOM owns the pod's row over a different
// container's loop; the loop container's own OOM does not veto its loop.
func otherContainerActiveOOM(pod *corev1.Pod, name string, now time.Time) bool {
	for _, cs := range health.ActiveOOMKilledContainers(pod, now) {
		if cs.Name != name {
			return true
		}
	}
	// Init containers and native sidecars, as health.PodHasActiveOOMKilled
	// judges them: a current OOM, or a last one not yet recovered from.
	for _, cs := range pod.Status.InitContainerStatuses {
		if cs.Name == name {
			continue
		}
		if cs.State.Terminated != nil && cs.State.Terminated.Reason == "OOMKilled" {
			return true
		}
		if t := cs.LastTerminationState.Terminated; t != nil && t.Reason == "OOMKilled" {
			if cs.State.Terminated != nil && cs.State.Terminated.ExitCode == 0 {
				continue
			}
			if r := cs.State.Running; r != nil && !r.StartedAt.IsZero() && now.Sub(r.StartedAt.Time) > 5*time.Minute {
				continue
			}
			return true
		}
	}
	return false
}

// oomStatuses is the container an OOM loop's limit diagnosis should examine:
// the looping regular container, or nil (the pod's active OOMs) otherwise.
func (l restartLoop) oomStatuses() []corev1.ContainerStatus {
	if l.lastReason != "OOMKilled"
```

### Core Architecture Module: `internal/kueuequeues/membership.go`
```
// Package kueuequeues decides which Kueue Workloads belong to a queue, from
// what the Workloads and LocalQueues say now. It reads no cache and checks no
// access: callers hand it the objects the caller could read, and say where
// the LocalQueues were read.
//
// A Workload belongs to a ClusterQueue in two independent ways. Submission:
// its spec.queueName names a LocalQueue in its namespace whose current
// spec.clusterQueue is the ClusterQueue. Reservation: its
// status.admission.clusterQueue names the ClusterQueue. Submission is a join
// through the LocalQueue as it is now, by name; it says nothing about which
// LocalQueue the Workload was submitted through, nor where it pointed then.
// A Workload belongs to a LocalQueue by submission only: its spec.queueName
// names it, in its namespace.
//
// The cases the two ways disagree on are answered as they are reported:
//   - A LocalQueue re-created to point at another ClusterQueue while a
//     Workload still reports its reservation in the old one: the Workload
//     belongs to the old ClusterQueue by reservation and to the new one by
//     submission, and its row in either names both.
//   - A finished Workload still reporting its admission belongs by
//     reservation: the record names the ClusterQueue, though Kueue released
//     the quota and leaves it out of its own counts.
//   - A Workload being deleted keeps its membership until it is gone: Kueue
//     holds its quota until its finalizer runs.
//   - A Workload belonging both ways is one member with both kinds.
package kueuequeues

import (
	"cmp"
	"slices"
	"strings"

	"k8s.io/apimachinery/pkg/apis/meta/v1/unstructured"
)

type Kind string

const (
	Submission  Kind = "submission"
	Reservation Kind = "reservation"
)

type Member struct {
	Workload  *unstructured.Unstructured
	Kinds     []Kind
	QueueName string
	// SubmittedTo is the ClusterQueue the Workload's LocalQueue points at now,
	// when Radar read that LocalQueue, and LocalQueueUID that LocalQueue's
	// UID: a LocalQueue re-created under the same name is another one.
	SubmittedTo   string
	LocalQueueUID string
	// LocalQueueUnread: the Workload names a LocalQueue in a namespace whose
	// LocalQueues Radar didn't read, so whether it was submitted here is
	// unknown.
	LocalQueueUnread bool
	ReservedIn       string
	// Finished members sort after the others (see Key).
	Finished bool
}

func (m Member) Has(kind Kind) bool { return slices.Contains(m.Kinds, kind) }

type LocalQueues interface {
	// Get returns LocalQueue namespace/name, nil when it doesn't exist, and
	// whether Radar read the LocalQueues in namespace at all.
	Get(namespace, name string) (localQueue *unstructured.Unstructured, read bool)
}

func QueueName(w *unstructured.Unstructured) string {
	name, _, _ := unstructured.NestedString(w.Object, "spec", "queueName")
	return name
}

func ReservedIn(w *unstructured.Unstructured) string {
	name, _, _ := unstructured.NestedString(w.Object, "status", "admission", "clusterQueue")
	return name
}

func LocalQueueTarget(lq *unstructured.Unstructured) string {
	name, _, _ := unstructured.NestedString(lq.Object, "spec", "clusterQueue")
	return name
}

// ClusterQueueMembers returns the workloads that belong to clusterQueue,
// each once, in no particular order: set Finished, then Sort. workloads may hold any Workloads, members or not,
// and the same Workload more than once.
func ClusterQueueMembers(clusterQueue string, workloads []*unstructured.Unstructured, localQueues LocalQueues) []Member {
	members := make([]Member, 0, len(workloads))
	seen := make(map[string]bool, len(workloads))
	for _, w := range workloads {
		if w == nil || seen[identity(w)] {
			continue
		}
		seen[identity(w)] = true
		m := Member{Workload: w, QueueName: QueueName(w), ReservedIn: ReservedIn(w)}
		if m.QueueName != "" {
			lq, read := localQueues.Get(w.GetNamespace(), m.QueueName)
			m.LocalQueueUnread = !read
			if lq != nil {
				m.SubmittedTo, m.LocalQueueUID = LocalQueueTarget(lq), string(lq.GetUID())
			}
		}
		if clusterQueue != "" && m.SubmittedTo == clusterQueue {
			m.Kinds = append(m.Kinds, Submission)
		}
		if clusterQueue != "" && m.ReservedIn == clusterQueue {
			m.Kinds = append(m.Kinds, Reservation)
		}
		if len(m.Kinds) > 0 {
			members = append(members, m)
		}
	}
	return members
}

// LocalQueueMembers returns the workloads submitted to localQueue, each
// once, in no particular order: set Finished, then Sort.
func LocalQueueMembers(localQueue *unstructured.Unstructured, workloads []*unstructured.Unstructured) []Member {
	namespace, name := localQueue.GetNamespace(), localQueue.GetName()
	members := make([]Member, 0, len(workloads))
	seen := make(map[string]bool, len(workloads))
	for _, w := range workloads {
		if w == nil || seen[identity(w)] || w.GetNamespace() != namespace || QueueName(w) != name || name == "" {
			continue
		}
		seen[identity(w)] = true
		members = append(members, Member{Workload: w, Kinds: []Kind{Submission}, QueueName: name, SubmittedTo: LocalQueueTarget(localQueue), LocalQueueUID: string(localQueue.GetUID()), ReservedIn: ReservedIn(w)})
	}
	return members
}

// identity tells Workloads apart: by UID, or by name for an object without
// one.
func identity(w *unstructured.Unstructured) string {
	if uid := string(w.GetUID()); uid != "" {
		return uid
	}
	return w.GetNamespace() + "/" + w.GetName()
}

// Key orders members: unfinished before finished, then namespace, name and
// UID. Alphabetical on purpose within each, so that no order of the list is
// mistaken for the order Kueue admits Workloads in; by default Kueue keeps
// finished Workloads until their owner goes, so they would otherwise bury
// the rest.
func Key(m Member) string {
	rank := "0"
	if m.Finished {
		rank = "1"
	}
	return strings.Join([]string{rank, m.Workload.GetNamespace(), m.Workload.GetName(), string(m.Workload.GetUID())}, "\x00")
}

// Sort orders members by Key, after their Finished flags are set. Each key
// is built once.
func Sort(members []Member) {
	type keyed struct {
		key    string
		member Member
	}
	sorted := make([]keyed, len(members))
	for i, m := range members {
		sorted[i] = keyed{Key(m), m}
	}
	slices.SortFunc(sorted, func(a, b keyed) int { return cmp.Compare(a.key, b.key) })
	for i, k := range sorted {
		members[i] = k.member
	}
}

// Counts are the numbers of members, each way. A member that belongs both
// ways counts once in Members and once in each of the others, so Submission
// and Reservation don't add up to Members. States counts members by the
// state stateOf gives them; a member without one isn't counted there.
type Counts struct {
	Members     int            `json:"members"`
	Submission  int            `json:"submission"`
	Reservation int            `json:"reservation"`
	States      map[string]int `json:"states"`
}

func Count(members []Member, stateOf func(Member) string) Counts {
	c := Counts{Members: len(members), States: map[string]int{}}
	for _, m := range members {
		if m.Has(Submission) {
			c.Submission++
		}
		if m.Has(Reservation) {
			c.Reservation++
		}
		if stateOf == nil {
			continue
		}
		if state := stateOf(m); state != "" {
			c.States[state]++
		}
	}
	return c
}

// Filter keeps the members that belong in kind's way ("" for any) and whose
// state stateOf gives is state ("" for any).
func Filter(members []Member, kind Kind, state string, stateOf func(Member) string) []Member {
	if kind == "" && state == "" {
		return members
	}
	out := make([]Member, 0, len(members))
	for _, m := range members {
		if (kind == "" || m.Has(kind)) && (state == "" || stateOf(m) == state) {
			out = append(out, m)
		}
	}
	return out
}

// Page returns up to limit of members (sorted by Key) whose key sorts after
// after ("" for the first page), and whether more follow. Paging by key
// rather than position keeps a member from appearing twice while its key
// stays the same; a member that joins before the key of a page already read
// is missed until the list is read again from the start. A member's key
// changes once, when it finishes: one returned among the unfinished members
// that finishes before the traversal reaches the finished ones is returned
// again there, so readers merge pages by UID, keeping the later row.
func Page(members []Member, after string, limit int) (page []Member, more bool) {
	start := 0
	if after != "" {
		start, _ = slices.BinarySearchFunc(members, after, func(m Member, key string) int {
			if Key(m) <= key {
				return -1
			}
			return 1
		})
	}
	end := min(start+limit, len(members))
	return members[start:end], end < len(members)
}

```

### Core Architecture Module: `internal/search/score.go`
```
package search

import (
	"net/netip"
	"strings"

	"github.com/skyhook-io/radar/pkg/resourceid"
)

// Site scoring weights. Tuned by intuition; revisit when telemetry exists.
const (
	scoreNameExact      = 100
	scoreNamePrefix     = 60
	scoreNameSubstr     = 40
	scoreNSExact        = 30
	scoreNSSubstr       = 20
	scoreLabelValExact  = 25
	scoreLabelValSubstr = 18
	scoreAnnoSubstr     = 15
	scoreImageSubstr    = 20
	scoreContentExact   = 16
	scoreContentSubstr  = 12
	scoreKindExact      = 10
	scoreKindSubstr     = 5
	maxSnippetRunes     = 180
)

// candidate carries the searchable face of a K8s object: identity,
// labels, annotations, container images. Built once per object so we
// don't repeatedly walk K8s typed structs.
type candidate struct {
	Kind        string
	Group       string
	Resource    string // lowercase plural, e.g. "networkpolicies"
	Namespace   string
	Name        string
	Labels      map[string]string
	Annotations map[string]string
	Images      []string
	IPs         []ipField // addresses the object holds (Pod, Service, Node)
	Content     []ContentField
	// report is a Trivy Operator report's findings, matched in place by
	// scoreToken rather than copied into Content, within findings' limits.
	report   map[string]any
	findings *findingsScan
}

// ContentField is a searchable string extracted from object content, such as
// ConfigMap data, workload env refs, CRD spec fields, or status messages.
type ContentField struct {
	Path  string
	Value string
}

// match runs the parsed query against a candidate and returns the score
// plus which sites matched. Returns (0, nil, false) when filters reject
// the candidate or when at least one free token didn't land anywhere.
func match(q Query, c candidate) (int, []MatchedField, []MatchSnippet, bool) {
	// Hard filters first — cheaper to reject early.
	if !matchesModifiers(q, c) {
		return 0, nil, nil, false
	}

	if len(q.Tokens) == 0 {
		// Pure-filter query: no scoring signal, but the candidate passed
		// every filter, so return a flat score so it shows up.
		return 1, nil, nil, true
	}

	total := 0
	var matched []MatchedField
	var snippets []MatchSnippet
	for _, tok := range q.Tokens {
		var best int
		var site string
		var snippet *MatchSnippet
		var ok bool
		if addr, isIP := q.ips[tok]; isIP {
			best, site, snippet, ok = scoreIPToken(tok, addr, c)
		} else {
			best, site, snippet, ok = scoreToken(tok, c)
		}
		if !ok {
			return 0, nil, nil, false
		}
		total += best
		matched = append(matched, MatchedField{Token: tok, Site: site, Score: best})
		if snippet != nil {
			snippets = append(snippets, *snippet)
		}
	}
	return total, matched, snippets, true
}

// matchesModifiers reports whether a candidate passes the query's hard
// filters (kind:, ns:, label:, image:). It reads identity only, never Content.
func matchesModifiers(q Query, c candidate) bool {
	if len(q.KindFilter) > 0 && !kindMatches(c.Kind, c.Group, c.Resource, q.KindFilter) {
		return false
	}
	if len(q.NSFilter) > 0 && !sliceContainsFold(q.NSFilter, c.Namespace) {
		return false
	}
	for _, lf := range q.LabelFilter {
		v, ok := c.Labels[lf.Key]
		if !ok {
			return false
		}
		if lf.Value != "" && v != lf.Value {
			return false
		}
	}
	for _, img := range q.ImageFilter {
		if !anyContainsFold(c.Images, img) {
			return false
		}
	}
	return true
}

// scoreToken returns the highest-scoring site a single free token matches,
// or (0, "", false) if the token doesn't land on any searchable field.
func scoreToken(tok string, c candidate) (int, string, *MatchSnippet, bool) {
	low := strings.ToLower(tok)
	best := 0
	bestSite := ""
	var bestSnippet *MatchSnippet
	consider := func(score int, site string) {
		if score > best {
			best = score
			bestSite = site
			bestSnippet = nil
		}
	}
	considerSnippet := func(score int, site string, snip MatchSnippet) {
		if score > best {
			best = score
			bestSite = site
			bestSnippet = &snip
		}
	}

	if c.Name != "" {
		nameLow := strings.ToLower(c.Name)
		switch {
		case nameLow == low:
			consider(scoreNameExact, "name")
		case strings.HasPrefix(nameLow, low):
			consider(scoreNamePrefix, "name")
		case strings.Contains(nameLow, low):
			consider(scoreNameSubstr, "name")
		}
	}
	if c.Namespace != "" {
		nsLow := strings.ToLower(c.Namespace)
		switch {
		case nsLow == low:
			consider(scoreNSExact, "namespace")
		case strings.Contains(nsLow, low):
			consider(scoreNSSubstr, "namespace")
		}
	}
	for k, v := range c.Labels {
		vLow := strings.ToLower(v)
		switch {
		case vLow == low:
			consider(scoreLabelValExact, "label:"+k)
		case strings.Contains(vLow, low):
			consider(scoreLabelValSubstr, "label:"+k)
		}
	}
	for k, v := range c.Annotations {
		if strings.Contains(strings.ToLower(v), low) {
			consider(scoreAnnoSubstr, "annotation:"+k)
		}
	}
	for _, img := range c.Images {
		if strings.Contains(strings.ToLower(img), low) {
			consider(scoreImageSubstr, "image")
		}
	}
	for _, cf := range c.Content {
		if cf.Value == "" {
			continue
		}
		vLow := strings.ToLower(cf.Value)
		switch {
		case vLow == low:
			considerSnippet(scoreContentExact, "content:"+cf.Path, MatchSnippet{
				Token:   tok,
				Path:    cf.Path,
				Snippet: snippetForToken(cf.Value, tok),
			})
		case strings.Contains(vLow, low):
			considerSnippet(scoreContentSubstr, "content:"+cf.Path, MatchSnippet{
				Token:   tok,
				Path:    cf.Path,
				Snippet: snippetForToken(cf.Value, tok),
			})
		}
	}
	if c.report != nil {
		eachTrivyFinding(c.report, c.findings, func(f *trivyFinding) bool {
			if score := f.match(low); score > best {
				value := f.value()
				considerSnippet(score, "content:"+f.path(), MatchSnippet{
					Token:   tok,
					Path:    f.path(),
					Snippet: snippetForToken(value, tok),
				})
			}
			return best < scoreContentExact
		})
	}
	if c.Kind != "" {
		kindLow := strings.ToLower(c.Kind)
		switch {
		case kindLow == low:
			consider(scoreKindExact, "kind")
		case strings.Contains(kindLow, low):
			consider(scoreKindSubstr, "kind")
		}
	}

	if best == 0 {
		return 0, "", nil, false
	}
	return best, bestSite, bestSnippet, true
}

// scoreIPToken matches an IP token: an address the object holds scores
// highest, under site ip:<role>; otherwise the name, an image, a label,
// annotation or content value must mention the address whole, so 10.0.1.2
// never matches 10.0.1.23.
func scoreIPToken(tok string, addr netip.Addr, c candidate) (int, string, *MatchSnippet, bool) {
	for _, f := range c.IPs {
		if f.Addr == addr {
			return f.Score, "ip:" + f.Role, nil, true
		}
	}
	v6 := addr.Is6()
	best := 0
	bestSite := ""
	var bestSnippet *MatchSnippet
	consider := func(score int, site string, snip *MatchSnippet) {
		if score > best {
			best, bestSite, bestSnippet = score, site, snip
		}
	}
	// A name spelled as the address only mentions it, below any holder.
	if strings.EqualFold(c.Name, tok) {
		consider(scoreLabelValExact, "name", nil)
	}
	for _, img := range c.Images {
		if indexIP(img, tok, v6) >= 0 {
			consider(scoreImageSubstr, "image", nil)
		}
	}
	for k, v := range c.Labels {
		if indexIP(v, tok, v6) >= 0 {
			consider(scoreLabelValSubstr, "label:"+k, nil)
		}
	}
	for k, v := range c.Annotations {
		if indexIP(v, tok, v6) >= 0 {
			consider(scoreAnnoSubstr, "annotation:"+k, nil)
		}
	}
	for _, cf := range c.Content {
		at := indexIP(cf.Value, tok, v6)
		if at < 0 {
			continue
		}
		score := scoreContentSubstr
		if strings.EqualFold(cf.Value, tok) {
			score = scoreContentExact
		}
		consider(score, "content:"+cf.Path, &MatchSnippet{Token: tok, Path: cf.Path, Snippet: snippetAt(cf.Value, at)})
	}
	if best == 0 {
		return 0, "", nil, false
	}
	return best, bestSite, bestSnippet, true
}

func snippetForToken(value, tok string) string {
	runes := []rune(value)
	if len(runes) <= maxSnippetRunes {
		return value
	}
	valueLow := strings.ToLower(value)
	tokLow := strings.ToLower(tok)
	byteIdx := strings.Index(valueLow, tokLow)
	if byteIdx < 0 {
		return string(runes[:maxSnippetRunes])
	}
	return snippetAt(value, byteIdx)
}

// snippetAt cuts a snippet of value centered on the byte offset byteIdx.
func snippetAt(value string, byteIdx int) string {
	runes := []rune(value)
	if len(runes) <= maxSnippetRunes {
		return value
	}
	prefixRunes := len([]rune(value[:byteIdx]))
	half := maxSnippetRunes / 2
	start := prefixRunes - half
	if start < 0 {
		start = 0
	}
	end := start + maxSnippetRunes
	if end > len(runes) {
		end = len(runes)
		start = end - maxSnippetRunes
		if start < 0 {
			start = 0
		}
	}
	snippet := string(runes[start:end])
	if start > 0 {
		snippet = "..." + snippet
	}
	if end < len(runes) {
		snippet += "..."
	}
	return snippet
}

// kindMatches returns true if any of the kind filters refer to the candidate
// kind. Filters are case-insensitive and accept the singular Kind ("Pod"), a
// trailing-s plural ("pods"), the resource plural ("ingresses",
// "networkpolicies"), or a kubectl alias of a built-in ("netpol", "pvc"). An
// alias names the built-in only, so it doesn't match a CRD that reuses the
// built-in's Kind in another group (kind:svc is not a Knative Service).
func kindMatches(kind, group, resource string, filters []string) bool {
	low := strings.ToLower(kind)
	plural := low + "s"
	for _, f := range filters {
		fLow := strings.ToLower(f)
		if fLow == low || fLow == plural || fLow == strings.TrimSuffix(low, "s") {
			return true
		}
		if resource != "" && fLow == strings.ToLower(resource) {
			return true
		}
		if b, ok := resourceid.BuiltinForName(fLow); ok && b.Kind == kind && b.Group == group {
			return true
		}
	}
	return false
}

func sliceContainsFold(haystack []string, needle string) bool {
	for _, h := range haystack {
		if strings.EqualFold(h, needle) {
			return true
		}
	}
	return false
}

func anyContainsFold(haystack []string, needle string) bool {
	low := strings.ToLower(needle)
	for _, h := range haystack {
		if strings.Contains(strings.ToLower(h), low) {
			return true
		}
	}
	return false
}

```

### Core Architecture Module: `internal/server/ai_engine.go`
```
package server

import (
	"context"
	"log"

	"github.com/skyhook-io/radar/internal/ai"
	"github.com/skyhook-io/radar/internal/k8s"
	prometheuspkg "github.com/skyhook-io/radar/internal/prometheus"
)

// aiEngine returns the AI investigation engine, both nil while it is off.
func (s *Server) aiEngine() (*ai.Diagnoser, *ai.RunManager) {
	s.aiMu.RLock()
	defer s.aiMu.RUnlock()
	return s.aiDiagnoser, s.aiRuns
}

func (s *Server) aiRunManager() *ai.RunManager {
	_, runs := s.aiEngine()
	return runs
}

// aiDeploymentSupported reports whether this Radar can run local AI
// investigations at all, whatever is installed. The engine drives the CLI
// against this server's own investigation MCP mount with no credentials, which
// only works when MCP is mounted and unauthenticated. Under proxy/OIDC auth
// (team and cloud deployments) the MCP requires identity headers a local CLI
// can't supply, and investigations are the embedding host's job (e.g. Radar
// Hub). An operator-managed shared installation is never a user's own machine.
func (s *Server) aiDeploymentSupported() bool {
	return s.configManagement() != "operator" && !s.authConfig.Enabled() &&
		s.mcpInvestigationHandler != nil && s.aiInvestigationRefs != nil
}

// refreshAIEngine brings the engine in line with the agent CLIs installed now:
// it turns the engine on when the first one appears, and keeps a running
// engine's backends current (Diagnoser.Refresh). Called at startup, whenever a
// client asks which agents exist, and before a run or follow-up starts, so
// installing, moving or removing a CLI never needs a Radar restart. Detection
// only resolves paths; it runs nothing.
func (s *Server) refreshAIEngine(ctx context.Context) {
	if !s.aiDeploymentSupported() {
		return
	}
	s.aiMu.Lock()
	defer s.aiMu.Unlock()
	defer func() { s.aiChecked = true }()
	if s.aiDiagnoser != nil {
		if changed := s.aiDiagnoser.Refresh(ctx); len(changed) > 0 {
			log.Printf("[ai] agent CLIs installed, moved or removed since startup: %v (default now %q)",
				changed, s.aiDiagnoser.DefaultAgent())
		}
		return
	}
	d, err := ai.NewDetected(ctx, s.aiInvestigationRefs)
	if err != nil {
		return
	}
	// History store opens only when the engine actually enables, so a
	// disabled feature never creates the DB. Open failure degrades to
	// memory-only runs (the historical behavior), never blocks startup.
	var store ai.RunStore
	historyBroken := false
	if s.aiHistoryDB != "" {
		if st, err := ai.OpenRunStore(s.aiHistoryDB); err != nil {
			log.Printf("[ai] run history disabled: could not open %s: %v", s.aiHistoryDB, err)
			historyBroken = true
		} else {
			store = st
		}
	}
	runs := ai.NewRunManager(d, s.ActualAddr, s.basePath, k8s.GetContextName, store)
	runs.MetricsAvailability = func(ctx context.Context) ai.MetricsAvailability {
		state := prometheuspkg.Availability(ctx)
		return ai.MetricsAvailability{
			Connected: state.State == prometheuspkg.AvailabilityConnected,
			Address:   state.Address,
		}
	}
	if historyBroken {
		// Persistence was requested but isn't working. The UI must say history
		// won't survive a restart, not just a log line.
		runs.MarkHistoryUnavailable(s.aiHistoryDB)
	}
	s.aiDiagnoser, s.aiRuns = d, runs
	if s.aiChecked {
		// The startup block reports the engine chosen at boot; this is the
		// only record of one turned on later.
		log.Printf("[ai] AI investigations enabled via %s (agent CLI found since startup)", d.DefaultAgent())
	}
}

```


### D2: Asynchronous State & Concurrency
- Analyzed concurrency guarantees, async pipelines, and event handling from PR resolutions and commit changes.

### D3: Error Boundaries, Recovery & Rollbacks
- Exception handling patterns and defect resolutions extracted from closed production bug issues:
- **Issue #2592** (2026-11-10): **Applications workload view: clicking any resource chip (cm/secret/svc/ing) or Topology-tab node never opens the resource**
  *Symptoms*: ## Describe the bug  In the Applications section, inside an application's workload view, clicking any resource chip does nothing: `cm/...` and `secret/...` in **Configuration inputs**, `svc/...` in **Serving configuration**, `ing/...` under **Entry point resources**. The click is actually handled — DevTools shows Radar fetching the resource (`/api/resources/configmaps/<ns>/<name>`, `/api/issues/resource/...`) — but no resource panel ever appears.  Same on the workload's **Topology** tab: clicking a resource node (e.g. the ConfigMap) opens nothing, and as a bonus it kicks you back to the Overview tab (`tab=topology` is dropped from the URL).  For comparison, the main **Topology** view (left nav) works fine: clicking any node, including ConfigMaps, opens the resource panel. Pod rows in the workload view also work (they navigate to `/workload/pods/...`).  ## To reproduce  Steps to reproduce the behavior:  1. Open **Applications**, click an app backed by a Deployment (URL becomes `/applications?app=...&workload=Deployment/...`). 2. In the workload Overview, click the `cm/ ...` chip in **Configuration inputs** (or `secret/`, `svc/`, `ing/` — all behave the same). 3. Nothing happens. The URL briefly loses the `workload` param and immediately gets it back (two consecutive `history.replaceState` calls), the resource is fetched from the API, but no panel is shown. 4. Switch the workload view to its **Topology** tab, click the ConfigMap node → same nothing, plus you're returned to the 

- **Issue #2446** (2026-11-09): **Issue detector reports stale Gateway API route conditions as active**
  *Symptoms*: TLDR: I made a HTTPRoute with a bad config, fixed it, but Envoy kept the old status from the previous version as a failure indicator - Radar shows this as an active failure even tho it was for a previous version of the resource.  Radar Desktop - Version 1.19.0  ---  ## Description A route can be correctly attached and accepted by its current Gateway listener while retaining an old `status.parents` entry for a removed parent ref. The issue detector appears to treat the obsolete `Accepted=False` condition as a current failure, without checking whether its `observedGeneration` matches the route’s generation or whether its `parentRef` is still in `spec.parentRefs`.  ## Example  The current route spec references `websecure`:  ```yaml metadata:   generation: 2 spec:   parentRefs:     - group: gateway.networking.k8s.io       kind: Gateway       name: public-gateway       namespace: gateway-system       sectionName: websecure ```  But status retains a failed condition for the old `https` parent, alongside a successful condition for the current parent:  ```yaml status:   parents:     - parentRef:         group: gateway.networking.k8s.io         kind: Gateway         name: public-gateway         namespace: gateway-system         sectionName: https       conditions:         - type: Accepted           status: "False"           reason: NoMatchingParent           observedGeneration: 1           message: No listeners match this parent ref         - type: BackendsAvailable           status: 

### D4: Resource Lifecycle & Leak Defenses
- Memory allocation, socket lifecycle, and handle cleanup observed from bug fixes and PR deltas.

### D5: Boundary Deserialization & Encoding
- Schema deserialization, payload validation, and untrusted input guards.

### D6: Cross-Platform & Runtime Gotchas
- Platform variance, OS-specific gotchas, and environment discrepancies detected in issue reports.

### D7: Build, CI/CD, Deployment & Tooling
- Toolchain requirements, dependencies, and packaging specs verified against remote manifests.

### D8: Forensic Bug Fixes & Real Production Code Patches
Observed empirical fixes and code patches:

### Incident Patch 1: `0de4c586` (2026-11-11)
**Commit Message**: Read pod-level resources in rightsizing, crash-loop OOM, MCP overview and AI metrics (#2596)

Refs #1667

Kubernetes 1.34 turns on pod-level resources by default
(`spec.resources`, KEP-2837): a Pod can set CPU and memory for all its
containers together. Most of Radar already reads them. Four places read
only per-container resources, so for a Pod that sets pod-level values
they give a wrong answer.

To check on main, create a Deployment whose pod template sets
`spec.resources.requests` and no container resources:

1. **Rightsizing** calls every container "Missing request" and suggests
adding container requests. The API server rejects those suggestions:
aggregate container requests can't exceed the pod-level request ("must
be greater than or equal to aggregate container requests of 560m" for a
200m pod, on 1.34 and 1.37).
2. **Crash-loop diagnosis** says an OOMKilled container "has no memory
limit, so the kernel killed it under node memory pressure" when the pod
has a pod-level memory limit. On a test cluster the pod cgroup's
`memory.events` counted the kills as cgroup-limit OOMs (`oom`), which a
node-wide OOM does not increment. With both a container limit and a pod
limit, the advic

**File**: `docs/mcp.md` (modified, +5/-2)
```diff
@@ -827,8 +827,10 @@ Captured Crossplane resource cards keep declared pause as neutral context and re
 | `oom_evidence_unavailable` | Radar could not verify recent OOM history, so it withheld a memory reduction rather than recommend one blind. |
 | `hpa_evidence_unavailable` | Radar could not verify HPA ownership, so it withheld a suggested request. |
 | `recommended_request_exceeds_limit` | The evidence-based request would exceed the container's current limit; the limit is the thing to review first. |
+| `requests_exceed_pod_limit` | The pod has a pod-level limit (`spec.resources.limits`) and no pod-level request, so its request is the sum of its containers' requests. Applying this increase together with the other containers' requests and the workload's other suggested increases would exceed that limit, which the API server rejects, so the suggestion is withheld and `limitConflict` is set. Each withheld increase may fit on its own; decide how to split the pod limit between containers, or raise it. |
 | `request_within_fit_range` | The configured request is already within 30% of the evidence-based target. Nothing to change. |
 | `insufficient_history` | Fewer than six hours of samples. Not a verdict of correctly sized. |
+| `pod_level_request` | The pod sets a fixed pod-level request for this resource (`spec.resources`, Kubernetes 1.34+), shown as `podLevelRequest`. The scheduler reserves that value instead of the containers' requests, so Radar suggests no per-container request and does not size the pod-level one. The row has `fit: pod_level_request` and `needsManualReview` with that review reason. Only an explicit pod-level request counts: with a pod-level limit alone, Kubernetes defaults the request to the limit only while no container sets one, so container requests still decide the reservation and are sized as usual. |
 
 `reductionLimited: true` marks a different case: a recommendation exists, but it is a conservative step toward the demand-based target rather than the target itself. Those rows — and only those — also carry `demandTarget: {value, basis}`, the end state the step is heading toward, with `basis` naming how it was derived (`7d Max x 1.15` for memory, `7d P95 x 1.15` for CPU, or the minimum request). It is **not** a value to apply: apply `recommendedRequest`, observe a full window, then re-check. A memory target comes from the 7-day max, so a monthly or batch peak outside the window is invisible to it. The engine computes a target before its HPA, OOM and limit checks run, so a withheld row has one internally; it is never emitted there, because it would fill the `null` those checks left on purpose. `observedStatistic` names what `observed` is (`P95` for CPU, `Max` for memory). `bursty` and `p99Usage` qualify CPU rows whose P99 ran far above the P95 the recommendation is built on.
 
@@ -882,7 +884,7 @@ A normal call reuses the latest matching scan, retained for up to 15 minutes. Us
 2. **`requestDelta`** — the replica-weighted absolute request change (`{cpu, memory}`, formatted quantities such as `-2250m`), normalized so a CPU change and a memory change are comparable.
 3. Namespace, kind and name, so repeated scans return a stable order.
 
-Rows needing manual review — an HPA, OOM history, a limit conflict, or a reduction against bursty or throttled usage — contribute **no** impact: that saving cannot be applied unattended, so counting it would rank a workload by waste it cannot give back. Unevidenced rows also contribute no delta. Missing evidence for one resource does not hide a known increase or review signal on another resource in the same container. Classification uses evidenced rows; `need_data` applies when none is evidenced, or when the evidenced rows are in range but other rows cannot be judged. Missing CPU/memory delta fields mean zero net change or no eligible evidence; inspect rows to distinguish these. Ranking by the largest *proportional* change instead would put an unrequested 64Mi sidecar above the workload wasting two cores.
+Rows needing manual review — an HPA, OOM history, a limit conflict, a reduction against bursty or throttled usage, or a pod-level request — contribute **no** impact: that saving cannot be applied unattended, so counting it would rank a workload by waste it cannot give back. Unevidenced rows also contribute no delta. Missing evidence for one resource does not hide a known increase or review signal on another resource in the same container. Classification uses evidenced rows; `need_data` applies when none is evidenced, or when the evidenced rows are in range but other rows cannot be judged. Missing CPU/memory delta fields mean zero net change or no eligible evidence; inspect rows to distinguish these. Ranking by the largest *proportional* change instead would put an unrequested 64Mi sidecar above the workload wasting two cores.
 
 `classificationCounts` reports all five classes (`reduction`, `increase`, `review`, `need_data`, `in_range`), including zero c
```

**File**: `internal/k8s/restart_loop.go` (modified, +52/-2)
```diff
@@ -63,7 +63,10 @@ type restartLoop struct {
 	// status is the looping container's status, for diagnoses that need it.
 	status corev1.ContainerStatus
 	// memoryLimit reports whether the container declares a memory limit.
-	memoryLimit    bool
+	memoryLimit bool
+	// podMemoryLimit reports a pod-level memory limit (spec.resources), which
+	// caps the combined use of every container in the pod, including this one.
+	podMemoryLimit bool
 	restartCount   int32
 	lastExitCode   int32
 	lastReason     string
@@ -137,7 +140,14 @@ func activeRestartLoop(pod *corev1.Pod, probes map[string]probeFailure, now time
 	if !found {
 		return restartLoop{}, false
 	}
+	best.podMemoryLimit = podHasMemoryLimit(pod)
 	best.memoryLimit = containerHasMemoryLimit(pod, best.container)
+	if best.podMemoryLimit && !containerDeclaresMemoryLimit(pod, best.container) {
+		// The kubelet applies the pod limit to a container that sets none and
+		// reports it in the container's status, so status can't tell an
+		// inherited limit from the container's own here; the spec can.
+		best.memoryLimit = false
+	}
 	return withProbeEvidence(best, pod, probes), true
 }
 
@@ -164,6 +174,39 @@ func containerHasMemoryLimit(pod *corev1.Pod, name string) bool {
 	return false
 }
 
+func containerDeclaresMemoryLimit(pod *corev1.Pod, name string) bool {
+	for _, list := range [][]corev1.Container{pod.Spec.Containers, pod.Spec.InitContainers} {
+		for i := range list {
+			if list[i].Name == name {
+				_, positive := explicitMemoryLimit(list[i].Resources.Limits)
+				return positive
+			}
+		}
+	}
+	return false
+}
+
+// podHasMemoryLimit reports a declared pod-level memory limit. Only a pod whose
+// spec.resources sets one has it: the kubelet can fill status.resources from
+// the containers' values on a pod without one. When declared, the enacted value
+// in status wins over the spec, as for containers. A zero limit sets no cap.
+func podHasMemoryLimit(pod *corev1.Pod) bool {
+	if pod.Spec.Resources == nil {
+		return false
+	}
+	if _, declared := pod.Spec.Resources.Limits[corev1.ResourceMemory]; !declared {
+		return false
+	}
+	if pod.Status.Resources != nil {
+		if _, ok := pod.Status.Resources.Limits[corev1.ResourceMemory]; ok {
+			_, positive := explicitMemoryLimit(pod.Status.Resources.Limits)
+			return positive
+		}
+	}
+	_, positive := explicitMemoryLimit(pod.Spec.Resources.Limits)
+	return positive
+}
+
 // otherContainerActiveOOM reports an active OOM on any container other than
 // the named one. A sibling's OOM owns the pod's row over a different
 // container's loop; the loop container's own OOM does not veto its loop.
@@ -404,9 +447,16 @@ func (l restartLoop) message() string {
 func (l restartLoop) diagnosis() (cause, action string) {
 	ref := l.ref()
 	if l.lastReason == "OOMKilled" {
-		if !l.memoryLimit {
+		switch {
+		case !l.memoryLimit && l.podMemoryLimit:
+			return fmt.Sprintf("%s keeps being OOMKilled. It has no memory limit of its own, so the pod's memory limit (spec.resources) applies to it: the kernel kills a process in the pod when all its containers together reach that limit.", ref),
+				"Compare the pod's total memory use before each kill with its memory limit: raise spec.resources.limits.memory if that much memory is legitimate, or find the container whose use grows (leak, spike, heap or cache settings). If the pod stayed under its limit, check the node for memory pressure."
+		case !l.memoryLimit:
 			return fmt.Sprintf("%s keeps being OOMKilled. It has no memory limit, so the kernel killed it under node memory pressure.", ref),
 				"Check the node's memory pressure and what else runs there, set a memory request that reflects real usage so the scheduler places it with room, and look for a leak or spike in this container."
+		case l.podMemoryLimit:
+			return fmt.Sprintf("%s keeps being OOMKilled. It has its own memory limit, and the pod's memory limit (spec.resources) also caps all its containers together, so either limit can trigger the kill.", ref),
+				"Compare the container's memory use before each kill with its own limit, and the pod's total use with the pod's memory limit: raise whichever limit was reached if that much memory is legitimate (a container limit can't exceed the pod's, so raising it past the pod limit means raising spec.resources.limits.memory too), or find the leak or spike (heap settings, caches, request bursts). If both stayed under their limits, check the node for memory pressure."
 		}
 		return fmt.Sprintf("%s keeps being OOMKilled.", ref),
 			"Compare the container's memory use before each kill with its limit: raise the limit if the working set is legitimate, or find the leak or spike (heap settings, caches, request bursts). If it stayed under its limit, the node was under memory pressure: check the node."
```

**File**: `internal/k8s/restart_loop_test.go` (modified, +134/-0)
```diff
@@ -494,6 +494,140 @@ func TestRestartLoopDiagnosis_OOMWordingFollowsTheLimit(t *testing.T) {
 	}
 }
 
+func TestRestartLoopDiagnosis_PodLevelMemoryLimit(t *testing.T) {
+	now := time.Now()
+	oomLoop := corev1.ContainerStatus{Name: "app", RestartCount: 4,
+		State:                corev1.ContainerState{Waiting: &corev1.ContainerStateWaiting{Reason: "CrashLoopBackOff"}},
+		LastTerminationState: corev1.ContainerState{Terminated: terminatedAgo(now, 10*time.Second, "OOMKilled", 137)}}
+	podLimit := &corev1.ResourceRequirements{Limits: corev1.ResourceList{corev1.ResourceMemory: resource.MustParse("64Mi")}}
+	ownLimit := corev1.ResourceRequirements{Limits: corev1.ResourceList{corev1.ResourceMemory: resource.MustParse("64Mi")}}
+
+	tests := []struct {
+		name          string
+		pod           func() *corev1.Pod
+		wantCause     []string
+		wantAction    []string
+		wantNotInText []string
+	}{
+		{
+			name: "only the pod sets a memory limit",
+			pod: func() *corev1.Pod {
+				pod := restartLoopPod(now, oomLoop)
+				pod.Spec.Resources = podLimit
+				return pod
+			},
+			wantCause:     []string{"no memory limit of its own", "pod's memory limit"},
+			wantNotInText: []string{"node memory pressure"},
+		},
+		{
+			name: "the enacted pod limit in status counts for a pod that declares pod-level resources",
+			pod: func() *corev1.Pod {
+				pod := restartLoopPod(now, oomLoop)
+				pod.Spec.Resources = &corev1.ResourceRequirements{Limits: corev1.ResourceList{corev1.ResourceMemory: resource.MustParse("128Mi")}}
+				pod.Status.Resources = podLimit
+				return pod
+			},
+			wantCause:     []string{"no memory limit of its own", "pod's memory limit"},
+			wantNotInText: []string{"node memory pressure"},
+		},
+		{
+			name: "a status memory limit does not count when spec.resources sets only CPU",
+			pod: func() *corev1.Pod {
+				pod := restartLoopPod(now, oomLoop)
+				pod.Spec.Resources = &corev1.ResourceRequirements{Limits: corev1.ResourceList{corev1.ResourceCPU: resource.MustParse("1")}}
+				pod.Status.Resources = podLimit
+				return pod
+			},
+			wantCause:     []string{"It has no memory limit, so the kernel killed it under node memory pressure."},
+			wantNotInText: []string{"spec.resources"},
+		},
+		{
+			name: "status resources alone are not a pod-level limit",
+			pod: func() *corev1.Pod {
+				pod := restartLoopPod(now, oomLoop)
+				pod.Status.Resources = podLimit
+				return pod
+			},
+			wantCause:     []string{"It has no memory limit, so the kernel killed it under node memory pressure."},
+			wantNotInText: []string{"spec.resources"},
+		},
+		{
+			name: "a memory limit inherited from the pod in container status is not the container's own",
+			pod: func() *corev1.Pod {
+				status := oomLoop
+				status.Resources = &corev1.ResourceRequirements{Limits: corev1.ResourceList{
+					corev1.ResourceCPU: resource.MustParse("200m"), corev1.ResourceMemory: resource.MustParse("64Mi")}}
+				pod := restartLoopPod(now, status)
+				pod.Spec.Resources = podLimit
+				pod.Spec.Containers[0].Resources = corev1.ResourceRequirements{Limits: corev1.ResourceList{corev1.ResourceCPU: resource.MustParse("200m")}}
+				return pod
+			},
+			wantCause:     []string{"no memory limit of its own", "pod's memory limit"},
+			wantNotInText: []string{"either limit"},
+		},
+		{
+			name: "container and pod both set a memory limit",
+			pod: func() *corev1.Pod {
+				pod := restartLoopPod(now, oomLoop)
+				pod.Spec.Resources = podLimit
+				pod.Spec.Containers[0].Resources = ownLimit
+				return pod
+			},
+			wantCause:     []string{"its own memory limit", "either limit"},
+			wantAction:    []string{"spec.resources.limits.memory"},
+			wantNotInText: []string{"the node was under memory pressure"},
+		},
+		{
+			name: "a zero pod limit sets no cap",
+			pod: func() *corev1.Pod {
+				pod := restartLoopPod(now, oomLoop)
+				pod.Spec.Resources = &corev1.ResourceRequirements{Limits: corev1.ResourceList{corev1.ResourceMemory: resource.MustParse("0")}}
+				return pod
+			},
+			wantCause: []string{"It has no memory limit, so the kernel killed it under node memory pressure."},
+		},
+		{
+			name:      "no limit anywhere is unchanged",
+			pod:       func() *corev1.Pod { return restartLoopPod(now, oomLoop) },
+			wantCause: []string{"It has no memory limit, so the kernel killed it under node memory pressure."},
+		},
+		{
+			name: "container-only limit is unchanged",
+			pod: func() *corev1.Pod {
+				pod := restartLoopPod(now, oomLoop)
+				pod.Spec.Containers[0].Resources = ownLimit
+				return pod
+			},
+			wantCause:     []string{"keeps being OOMKilled."},
+			wantNotInText: []string{"pod's memory limit"},
+		},
+	}
+	for _, tc := range tests {
+		t.Run(tc.name, func(t *testing.T) {
+			loop, ok := activeRestartLoop(tc.pod(), nil, now)
+			if !ok {
+				t.Fatal("expected an OOM restart loop")
+			}
+			cause, action := loop.diagnosis()
+			for _, want := range tc.wantCause {
+				if !strings.Contains(cause, want) {
+					t
```

**File**: `internal/mcp/dashboard_requests_test.go` (added, +38/-0)
```diff
@@ -0,0 +1,38 @@
+package mcp
+
+import (
+	"testing"
+
+	corev1 "k8s.io/api/core/v1"
+	"k8s.io/apimachinery/pkg/api/resource"
+)
+
+func TestDashboardRequestTotals(t *testing.T) {
+	requests := func(cpu, mem string) corev1.ResourceRequirements {
+		return corev1.ResourceRequirements{Requests: corev1.ResourceList{
+			corev1.ResourceCPU: resource.MustParse(cpu), corev1.ResourceMemory: resource.MustParse(mem),
+		}}
+	}
+	podLevel := requests("200m", "128Mi")
+	always := corev1.ContainerRestartPolicyAlways
+	pods := []*corev1.Pod{
+		// Pod-level budget only: the containers set nothing of their own.
+		{Spec: corev1.PodSpec{Resources: &podLevel, Containers: []corev1.Container{{Name: "app"}, {Name: "sidecar"}}}},
+		// Pod-level budget wins over the containers' own values.
+		{Spec: corev1.PodSpec{Resources: &podLevel, Containers: []corev1.Container{{Name: "app", Resources: requests("100m", "64Mi")}}}},
+		// Container-only, with a native sidecar the scheduler also reserves.
+		{Spec: corev1.PodSpec{
+			Containers:     []corev1.Container{{Name: "app", Resources: requests("100m", "64Mi")}},
+			InitContainers: []corev1.Container{{Name: "proxy", RestartPolicy: &always, Resources: requests("50m", "32Mi")}},
+		}},
+		// Finished pods reserve nothing.
+		{Spec: corev1.PodSpec{Resources: &podLevel}, Status: corev1.PodStatus{Phase: corev1.PodSucceeded}},
+	}
+	cpu, mem := dashboardRequestTotals(pods)
+	if want := int64(200 + 200 + 150); cpu != want {
+		t.Errorf("cpu = %dm, want %dm", cpu, want)
+	}
+	if want := int64(128+128+96) * 1024 * 1024; mem != want {
+		t.Errorf("memory = %d, want %d", mem, want)
+	}
+}
```

**File**: `internal/mcp/tools.go` (modified, +17/-15)
```diff
@@ -23,6 +23,7 @@ import (
 	"k8s.io/apimachinery/pkg/runtime/schema"
 	"k8s.io/apimachinery/pkg/types"
 
+	"github.com/skyhook-io/radar/internal/capacity"
 	"github.com/skyhook-io/radar/internal/filter"
 	"github.com/skyhook-io/radar/internal/helm"
 	"github.com/skyhook-io/radar/internal/issues"
@@ -2806,6 +2807,21 @@ func mcpClusterInfoFromInfo(info *k8s.ClusterInfo) mcpClusterInfo {
 	}
 }
 
+// dashboardRequestTotals sums what the scheduler reserves for each live pod:
+// a pod-level budget (spec.resources) when one is set, otherwise its
+// containers, sidecars and init containers counted the way kube-scheduler does.
+func dashboardRequestTotals(pods []*corev1.Pod) (cpuMillis, memBytes int64) {
+	for _, pod := range pods {
+		if pod.Status.Phase == corev1.PodSucceeded || pod.Status.Phase == corev1.PodFailed {
+			continue
+		}
+		requests := capacity.EffectivePodRequests(pod)
+		cpuMillis += requests.Cpu().MilliValue()
+		memBytes += requests.Memory().Value()
+	}
+	return cpuMillis, memBytes
+}
+
 func buildDashboard(ctx context.Context, cache *k8s.ResourceCache, namespace string, includeNodes bool, includeNamespaces bool) mcpDashboard {
 	d := mcpDashboard{
 		ResourceCounts: make(map[string]int),
@@ -3190,21 +3206,7 @@ func buildDashboard(ctx context.Context, cache *k8s.ResourceCache, namespace str
 							var cpuReqMillis, memReqBytes int64
 							if podLister := cache.Pods(); podLister != nil {
 								allPods, _ := podLister.List(labels.Everything())
-								for _, pod := range allPods {
-									if pod.Status.Phase == corev1.PodSucceeded || pod.Status.Phase == corev1.PodFailed {
-										continue
-									}
-									for _, c := range pod.Spec.Containers {
-										if c.Resources.Requests != nil {
-											if cpu, ok := c.Resources.Requests[corev1.ResourceCPU]; ok {
-												cpuReqMillis += cpu.MilliValue()
-											}
-											if mem, ok := c.Resources.Requests[corev1.ResourceMemory]; ok {
-												memReqBytes += mem.Value()
-											}
-										}
-									}
-								}
+								cpuReqMillis, memReqBytes = dashboardRequestTotals(allPods)
 							}
 
 							if cpuCapMillis > 0 && memCapBytes > 0 {
```

**File**: `internal/mcp/tools_rightsizing.go` (modified, +5/-1)
```diff
@@ -60,6 +60,9 @@ type rightsizingRowDTO struct {
 	Confidence     prometheuspkg.RightsizingConfidence `json:"confidence"`
 	CurrentRequest *string                             `json:"currentRequest,omitempty"`
 	CurrentLimit   *string                             `json:"currentLimit,omitempty"`
+	// The pod's fixed pod-level request on fit=pod_level_request rows: what the
+	// scheduler reserves instead of the containers' requests.
+	PodLevelRequest *string `json:"podLevelRequest,omitempty"`
 	// No omitempty: a withheld recommendation must arrive as an explicit null
 	// beside its recommendationReason. Omitting the field turns "Radar declined
 	// to recommend, and here is why" into a key the reader never sees.
@@ -842,6 +845,7 @@ func filterRightsizingRows(rows []prometheuspkg.RightsizingRow, includeAll, keep
 			Confidence:           row.Confidence,
 			CurrentRequest:       row.CurrentRequest,
 			CurrentLimit:         row.CurrentLimit,
+			PodLevelRequest:      row.PodLevelRequest,
 			RecommendedRequest:   row.RecommendedReq,
 			Coverage:             row.Coverage,
 			RecommendationReason: row.RecommendationReason,
@@ -1141,7 +1145,7 @@ func rightsizingGuidance(in rightsizingGuidanceInput) []string {
 		parts = append(parts, "Rows with reductionLimited=true were clamped: recommendedRequest is a bounded step, not the full cut: at most half for memory, for CPU of 1 core or more, and for bursty or throttled CPU; up to three quarters for smaller CPU requests. demandTarget is the demand-based end state, not a value to apply: apply recommendedRequest, observe a full 7-day window, then re-check. For memory, demandTarget comes from the 7-day max, so a monthly or batch peak outside the window is not seen and jumping straight to it risks OOM.")
 	}
 	if in.needsManualReview {
-		parts = append(parts, "Rows with needsManualReview=true are excluded from the workload's requestDelta, and reviewReasons says why — an autoscaler owns the request, the container has OOM history, its limit conflicts with the recommendation, or the cut runs against bursty or throttled usage. Most of those rows carry no recommendedRequest at all, because the same signal withheld it; where one is present, weigh it against the reason instead of applying it unattended. The flag marks a row that needs judgement, not one that must never change: raising a request on a container with OOM history is often exactly what the evidence asks for.")
+		parts = append(parts, "Rows with needsManualReview=true are excluded from the workload's requestDelta, and reviewReasons says why — an autoscaler owns the request, the container has OOM history, its limit conflicts with the recommendation, the cut runs against bursty or throttled usage, or (pod_level_request) the pod sets a fixed pod-level request in spec.resources, which the scheduler reserves instead of container requests and which Radar does not size; podLevelRequest gives its value, and observed usage is still reported per container. Most of those rows carry no recommendedRequest at all, because the same signal withheld it; where one is present, weigh it against the reason instead of applying it unattended. The flag marks a row that needs judgement, not one that must never change: raising a request on a container with OOM history is often exactly what the evidence asks for.")
 	}
 	if in.workloadsShown {
 		parts = append(parts, "requestDelta is replica-weighted request capacity, not bill savings. An absent cpu or memory delta means zero net change or no eligible evidence; read rows to distinguish them. Rows lacking evidence or needing manual review are excluded. If liveInventoryUnavailable=true, currentPodOOM being absent does not establish that no pod has OOMed.")
```

**File**: `internal/prometheus/rightsizing.go` (modified, +191/-29)
```diff
@@ -21,6 +21,7 @@ import (
 	"k8s.io/apimachinery/pkg/api/resource"
 	"k8s.io/apimachinery/pkg/labels"
 	"k8s.io/apimachinery/pkg/types"
+	resourcehelper "k8s.io/component-helpers/resource"
 )
 
 // Sentinel errors distinguish the cache-loading failure modes so handlers can
@@ -74,8 +75,16 @@ const (
 	FitUnderRequested      RightsizingFit = "under_requested"
 	FitMissingRequest      RightsizingFit = "missing_request"
 	FitInsufficientHistory RightsizingFit = "insufficient_history"
+	// FitPodLevelRequest marks a container whose pod sets a fixed pod-level
+	// request (spec.resources) for the resource. The scheduler reserves that
+	// pod-level value instead of the containers' requests, so no per-container
+	// request is suggested.
+	FitPodLevelRequest RightsizingFit = "pod_level_request"
 )
 
+// ReasonPodLevelRequest is the recommendationReason of a FitPodLevelRequest row.
+const ReasonPodLevelRequest = "pod_level_request"
+
 type RightsizingConfidence string
 
 const (
@@ -101,33 +110,37 @@ type ObservedStatistic struct {
 }
 
 type RightsizingRow struct {
-	Container               string                `json:"container"`
-	Resource                string                `json:"resource"`
-	Fit                     RightsizingFit        `json:"fit"`
-	Confidence              RightsizingConfidence `json:"confidence"`
-	CurrentRequest          *string               `json:"currentRequest,omitempty"`
-	CurrentRequestValue     *float64              `json:"currentRequestValue,omitempty"`
-	CurrentLimit            *string               `json:"currentLimit,omitempty"`
-	CurrentLimitValue       *float64              `json:"currentLimitValue,omitempty"`
-	Observed                *ObservedStatistic    `json:"observed,omitempty"`
-	Peak                    *ObservedStatistic    `json:"peak,omitempty"`
-	CalculatedReq           *string               `json:"calculatedRequest,omitempty"`
-	CalculatedRequestValue  *float64              `json:"calculatedRequestValue,omitempty"`
-	RecommendedReq          *string               `json:"recommendedRequest,omitempty"`
-	RecommendedRequestValue *float64              `json:"recommendedRequestValue,omitempty"`
-	ReductionLimited        bool                  `json:"reductionLimited,omitempty"`
-	Bursty                  bool                  `json:"bursty,omitempty"`
-	RecommendationReason    string                `json:"recommendationReason,omitempty"`
-	SampleCount             int                   `json:"sampleCount"`
-	ExpectedSamples         int                   `json:"expectedSamples"`
-	Coverage                float64               `json:"coverage"`
-	HPAManaged              bool                  `json:"hpaManaged"`
-	HPAEvidenceAvailable    bool                  `json:"hpaEvidenceAvailable"`
-	ThrottleAvailable       bool                  `json:"throttleAvailable,omitempty"`
-	ThrottleRatio           *float64              `json:"throttleRatio,omitempty"`
-	CurrentPodOOM           bool                  `json:"currentPodOOM,omitempty"`
-	WindowOOMEvidence       bool                  `json:"windowOomEvidence,omitempty"`
-	OOMEvidenceAvailable    bool                  `json:"oomEvidenceAvailable"`
+	Container           string                `json:"container"`
+	Resource            string                `json:"resource"`
+	Fit                 RightsizingFit        `json:"fit"`
+	Confidence          RightsizingConfidence `json:"confidence"`
+	CurrentRequest      *string               `json:"currentRequest,omitempty"`
+	CurrentRequestValue *float64              `json:"currentRequestValue,omitempty"`
+	CurrentLimit        *string               `json:"currentLimit,omitempty"`
+	CurrentLimitValue   *float64              `json:"currentLimitValue,omitempty"`
+	// PodLevelRequest is the request the pod sets in spec.resources for this
+	// resource, set whenever the pod has one; the value is in the row's units.
+	PodLevelRequest         *string            `json:"podLevelRequest,omitempty"`
+	PodLevelRequestValue    *float64           `json:"podLevelRequestValue,omitempty"`
+	Observed                *ObservedStatistic `json:"observed,omitempty"`
+	Peak                    *ObservedStatistic `json:"peak,omitempty"`
+	CalculatedReq           *string            `json:"calculatedRequest,omitempty"`
+	CalculatedRequestValue  *float64           `json:"calculatedRequestValue,omitempty"`
+	RecommendedReq          *string            `json:"recommendedRequest,omitempty"`
+	RecommendedRequestValue *float64           `json:"recommendedRequestValue,omitempty"`
+	ReductionLimited        bool               `json:"reductionLimited,omitempty"`
+	Bursty                  bool               `json:"bursty,omitempty"`
+	RecommendationReason    string             `json:"recommendationReason,omitempty"`
+	SampleCount             int                `json:"sampleCount"`
+	ExpectedSamples         int                `json:"expectedSamples"`
+	Coverage                float64            `json:"coverage"`
+	HPAManaged    
```

**File**: `internal/prometheus/rightsizing_impact.go` (modified, +6/-0)
```diff
@@ -102,6 +102,12 @@ func ManualReviewReasons(row RightsizingRow) []string {
 	if IsWithheldRecommendationReason(row.RecommendationReason) {
 		reasons = append(reasons, "recommendation_withheld")
 	}
+	// Radar sizes container requests, and this pod's reservation is the
+	// pod-level request it does not size. Left out of review, the workload
+	// would classify in_range: a verdict about a budget nobody evaluated.
+	if row.Fit == FitPodLevelRequest {
+		reasons = append(reasons, "pod_level_request")
+	}
 	// Burst and throttling only matter against a cut: they say the smaller
 	// request would be met by a workload that already wants more.
 	if isReduction(row) {
```

---

### Incident Patch 2: `32b373f0` (2026-11-11)
**Commit Message**: fix(traffic): scope Caretta and Beyla queries to the configured cluster labels (#2282)

## Description

When several clusters share one Prometheus-compatible backend (a hosted
service or a central Mimir/Thanos), each Radar's traffic map shows every
cluster's flows. The Caretta queries are bare `caretta_links_observed`
and the Beyla queries only filter by `job`, so
`--prometheus-cluster-label` / `traffic.prometheusClusterLabels`, which
already scope workload and PVC metrics, have no effect on traffic.

This applies the configured cluster labels to every Caretta and Beyla
selector: Caretta's backend probe (`caretta_links_observed`,
`up{job=~".*caretta.*"}`) and flow query, and all Beyla L4/L7 queries
and detection. The matchers come from the same
`WorkloadMetricsScope.Matchers()` validation as workload metrics.
`--prometheus-single-cluster` adds nothing, since every series already
belongs to the cluster.

Lifetime follows the workload scope. The matchers bind to the first
Kubernetes connection traffic initializes against and survive the
repeated startup initialization; a later init against a different
context name or `rest.Config` clears them, as `prometheus.Reinitialize`
does. `SetM

**File**: `cmd/explorer/main.go` (modified, +1/-1)
```diff
@@ -123,7 +123,7 @@ func main() {
 	prometheusURL := flag.String("prometheus-url", fileCfg.PrometheusURL, "Manual Prometheus/VictoriaMetrics URL (skips auto-discovery)")
 	workloadSingleCluster := flag.Bool("prometheus-single-cluster", false, "Optional workload/PVC metrics scope override: assert that the backend contains only this Kubernetes cluster. Replaces automatic matching; not saved, and cleared when the cluster, backend or credentials change. Does not scope rightsizing, node/HPA or legacy network/storage metrics.")
 	workloadClusterLabels := map[string]string{}
-	flag.Func("prometheus-cluster-label", "Optional workload/PVC metrics scope override: exact label=value identifying this cluster, e.g. cluster=production (repeatable, ANDed). Alternative to --prometheus-single-cluster, with the same lifetime and scope; leave both unset for automatic matching.", func(raw string) error {
+	flag.Func("prometheus-cluster-label", "Optional workload/PVC metrics scope override, also used for the Caretta/Beyla/Istio traffic map on a metrics store you configured: exact label=value identifying this cluster, e.g. cluster=production (repeatable, ANDed). Alternative to --prometheus-single-cluster, with the same lifetime and scope; leave both unset for automatic matching.", func(raw string) error {
 		key, value, ok := strings.Cut(raw, "=")
 		if !ok {
 			return fmt.Errorf("expected label=value")
```

**File**: `deploy/helm/radar/README.md` (modified, +1/-1)
```diff
@@ -445,7 +445,7 @@ trend charts remain unavailable for Kubecost.
 | `traffic.prometheusHeaders` | HTTP headers sent with every Prometheus request (auth-protected backends). Requires `traffic.prometheusUrl` — credentials are never sent to auto-discovered endpoints | `{}` |
 | `traffic.prometheusHeadersFromEnv` | Prometheus headers sourced from environment variables, for secret-backed auth headers. Requires `traffic.prometheusUrl` | `{}` |
 | `traffic.prometheusSingleCluster` | Assert that the backend is dedicated to this cluster for workload metrics and PVC usage. Replaces automatic matching. [Scope limits](../../../docs/workload-metrics.md#optional-operator-override) | `false` |
-| `traffic.prometheusClusterLabels` | Exact cluster label/value constraints for workload metrics and PVC usage, combined with AND. Labels must exist on each affected metric source. Alternative to `prometheusSingleCluster`; leave both unset for automatic matching | `{}` |
+| `traffic.prometheusClusterLabels` | Exact cluster label/value constraints for workload metrics, PVC usage and, when `prometheusUrl` is set, the Caretta/Beyla/Istio traffic map, combined with AND. Labels must exist on each affected metric source. Alternative to `prometheusSingleCluster`; leave both unset for automatic matching | `{}` |
 | `traffic.beylaJobSelector` | Beyla Live Traffic matcher fragment. Workload charts use it only with an explicit scope override and accept one `job` equality or regex matcher; custom workload jobs are normally discovered automatically | `""` |
 | `argocd.existingSecret` | Name of a Secret holding the Argo CD API token (recommended — keeps it out of the release) | `""` |
 | `argocd.existingSecretKey` | Key within `argocd.existingSecret` holding the token | `token` |
```

**File**: `deploy/helm/radar/values.schema.json` (modified, +1/-1)
```diff
@@ -436,7 +436,7 @@
         "prometheusSingleCluster": { "type": "boolean", "description": "Optional workload/PVC metrics scope override for a dedicated backend. Replaces automatic matching; does not scope rightsizing, node/HPA or legacy network/storage metrics. Leave false with empty prometheusClusterLabels for automatic matching." },
         "prometheusClusterLabels": {
           "type": "object",
-          "description": "Optional exact cluster label/value pairs for workload metrics and PVC usage, combined with AND. Labels must exist on each affected metric source. Alternative to prometheusSingleCluster; does not scope rightsizing, node/HPA or legacy network/storage metrics.",
+          "description": "Optional exact cluster label/value pairs for workload metrics, PVC usage and, when prometheusUrl is set, the Caretta/Beyla/Istio traffic map, combined with AND. Labels must exist on each affected metric source. Alternative to prometheusSingleCluster; does not scope rightsizing, node/HPA or legacy network/storage metrics.",
           "propertyNames": {"pattern": "^[a-zA-Z_][a-zA-Z0-9_]*$", "not": {"pattern": "^__"}},
           "additionalProperties": {"type": "string", "minLength": 1}
         },
```

**File**: `deploy/helm/radar/values.yaml` (modified, +2/-0)
```diff
@@ -686,6 +686,8 @@ traffic:
   # Optional workload/PVC metrics scope override, not a feature enable switch.
   # Leave both unset for automatic matching; set at most one mode.
   # Does not scope rightsizing, node/HPA or legacy network/storage queries.
+  # prometheusClusterLabels also scopes the Caretta, Beyla and Istio traffic map
+  # when prometheusUrl is set.
   prometheusSingleCluster: false
   prometheusClusterLabels: {}
   # Beyla Live Traffic matcher fragment. Workload charts use it only with an
```

**File**: `docs/configuration.md` (modified, +24/-1)
```diff
@@ -38,7 +38,7 @@ installed version. Several flags also take a persistent default from `~/.radar/c
 | `--max-scope-candidates` | `20` | Cap on the namespace-fallback probe fanout (used by accounts that can list namespaces cluster-wide but not list a specific kind cluster-wide). Raise above `20` for clusters with more than 20 namespaces. Env: `RADAR_MAX_SCOPE_CANDIDATES`. |
 | `--prometheus-url` | (auto-discover) | Manual PromQL-compatible query URL, including Prometheus, VictoriaMetrics, Thanos, or Mimir (skips auto-discovery). In local CLI/Desktop mode, applies only to the launch's initial context and never inherits saved headers. |
 | `--prometheus-single-cluster` | `false` | Declare the backend dedicated to this cluster for workload metrics and PVC usage, replacing automatic identity matching. Other metrics do not use this override. [Scope and lifetime](workload-metrics.md#optional-operator-override). |
-| `--prometheus-cluster-label` | (automatic matching) | Optional workload/PVC metrics override for a shared backend, e.g. `cluster=production` (repeatable, ANDed). Alternative to `--prometheus-single-cluster`; leave both unset for automatic matching. Not persisted. |
+| `--prometheus-cluster-label` | (automatic matching) | Optional workload/PVC metrics override for a shared backend, also used for the Caretta/Beyla/Istio traffic map on a metrics store you configured, e.g. `cluster=production` (repeatable, ANDed). Alternative to `--prometheus-single-cluster`; leave both unset for automatic matching. Not persisted. |
 | `--prometheus-header` | | HTTP header sent with every Prometheus request, format `Key=Value` (repeatable). Required for auth-protected backends. In local CLI/Desktop mode, requires `--prometheus-url` in the same launch and applies only to the launch's initial context. |
 | `--prometheus-header-from-env` | | HTTP header sent with every Prometheus request, sourced from an environment variable, format `Key=ENV_VAR` (repeatable). In local CLI/Desktop mode, requires `--prometheus-url` in the same launch and applies only to the launch's initial context. |
 | `--beyla-job-selector` | (empty) | Beyla Live Traffic matcher fragment (empty matches Beyla/Alloy jobs there). Workload charts use it only with an explicit scope override and accept one `job` equality or regex matcher. Automatic workload matching discovers custom jobs without it. [Details](workload-metrics.md#request-sources). |
@@ -837,6 +837,10 @@ Leave both unset for automatic matching. Configured labels must exist on each
 affected metric source, including kubelet volume stats. See
 [scope and remedies](workload-metrics.md#pvc-usage-scope).
 
+The same `--prometheus-cluster-label` labels also scope the Caretta, Beyla and
+Istio traffic map when it reads a metrics store you configured. See
+[Traffic map in a shared metrics store](#traffic-map-in-a-shared-metrics-store).
+
 | Run mode | How to configure an explicit override |
 |---|---|
 | Local CLI / `kubectl radar` | Supply the flag on each launch that needs it. These overrides have no `config.json` key or environment-variable equivalent. |
@@ -849,6 +853,25 @@ an active override and resumes automatic matching. A new local port-forward to
 the same discovered Service is not a different backend. Only reapply an override
 after verifying the new connection's scope. See [operator override details](workload-metrics.md#optional-operator-override).
 
+### Traffic map in a shared metrics store
+
+When the traffic map reads Caretta, Beyla or Istio traffic from a metrics store
+you configured (`--prometheus-url`, Helm `traffic.prometheusUrl`, or a URL saved
+in Settings), it tries to keep to this cluster's traffic. It uses the
+`--prometheus-cluster-label` labels when they're set, otherwise the cluster
+label kube-state-metrics carries for this cluster's Pods. Stores Radar finds on
+its own, including Caretta's own store, are read as they are.
+
+When the traffic doesn't match this cluster's labels, may include other
+clusters' traffic, or Radar couldn't check, the map says so and links here. A map
+without a note isn't proof, though: traffic under one cluster name Radar can't
+confirm, or with no cluster label at all, is shown as is. In a shared store,
+label each cluster's traffic where it's scraped or sent to the store (for example
+with a relabel rule or an external label), and set this cluster's label and value
+the same way as for workload metrics
+([by run mode](#workload-metrics-overrides-by-run-mode)). The traffic metrics
+must carry every label you set; traffic without them isn't shown.
+
 ## Startup Context
 
 Which cluster Radar comes up on depends on how you launched it.
```

**File**: `docs/workload-metrics.md` (modified, +6/-0)
```diff
@@ -314,6 +314,12 @@ radar --prometheus-url https://metrics.example.com \
   --prometheus-cluster-label cluster=production
 ```
 
+The same labels scope the Caretta, Beyla and Istio traffic map when it reads a
+store you configured, so each Radar keeps to its own cluster's flows in a shared
+backend. Without them the map uses the labels automatic matching proves for
+this cluster. `--prometheus-single-cluster` adds no traffic filtering. See
+[Traffic map in a shared metrics store](configuration.md#traffic-map-in-a-shared-metrics-store).
+
 Labels must exist on each affected metric source. An empty value is rejected
 because it would also match series without that label. A tenant header alone
 does not prove single-cluster isolation. Use `--prometheus-header-from-env` for credentials.
```

**File**: `internal/prometheus/series_scope.go` (modified, +69/-2)
```diff
@@ -4,6 +4,7 @@ import (
 	"context"
 	"errors"
 	"regexp"
+	"slices"
 	"sort"
 	"strconv"
 	"strings"
@@ -12,6 +13,7 @@ import (
 	"github.com/skyhook-io/radar/internal/errorlog"
 	"github.com/skyhook-io/radar/internal/k8s"
 	"github.com/skyhook-io/radar/pkg/prom"
+	"k8s.io/apimachinery/pkg/labels"
 )
 
 // A series scope keeps a query to this Kubernetes cluster's series in a
@@ -48,6 +50,9 @@ func withScope(selector, matchers string) string {
 	if matchers == "" {
 		return selector
 	}
+	if selector == "" {
+		return matchers
+	}
 	return selector + "," + matchers
 }
 
@@ -88,6 +93,68 @@ func (client *Client) ResolvePVCScope(ctx context.Context, namespace string, cla
 	return client.resolveScope(ctx, namespace, pvcScopeProbe(namespace, claims, window), anchors, nil)
 }
 
+// ResolveTrafficScope decides the cluster-identity matchers for one traffic
+// metric's series (selector narrows them, e.g. to Beyla's jobs) across the
+// whole store. The map has no namespace of its own, so the
+// automatic proof anchors on kube-system, which always runs Pods, or on any
+// namespace the cache holds when it never sees kube-system. On
+// ErrScopeMismatch the isolation still names the proven labels, so a caller
+// can say which cluster the traffic failed to match, and on ErrScopeAmbiguous
+// after a proof it names the labels every ambiguous series already carries.
+func (client *Client) ResolveTrafficScope(ctx context.Context, metric, selector string, cache *k8s.ResourceCache) (string, SeriesIsolation, error) {
+	return client.resolveScope(ctx, trafficAnchorNamespace(cache), trafficScopeProbe(metric, selector), nil, cache)
+}
+
+// TrafficSpansClusters reports whether one traffic metric's series (selector
+// narrows them) carry more than one cluster identity across the whole store,
+// read from the labels ClusterIdentityLabels names. Series without any of
+// those labels count as one identity of their own.
+func (client *Client) TrafficSpansClusters(ctx context.Context, metric, selector string) (bool, error) {
+	if client == nil {
+		return false, errors.New("Prometheus client not initialized")
+	}
+	return trafficSpansClusters(ctx, client, metric, selector)
+}
+
+func trafficSpansClusters(ctx context.Context, q seriesQuerier, metric, selector string) (bool, error) {
+	_, err := readScopePartition(ctx, q, trafficScopeProbe(metric, selector), "")
+	if errors.Is(err, ErrScopeAmbiguous) {
+		return true, nil
+	}
+	return false, err
+}
+
+func trafficScopeProbe(metric, selector string) scopeProbe {
+	return scopeProbe{
+		metric: metric, selectors: []string{selector}, singlePartition: true, allowUnlabeledProof: true,
+		unverifiedNote: "Radar couldn't confirm this traffic belongs to this exact cluster (no cluster label it could check)",
+	}
+}
+
+func trafficAnchorNamespace(cache *k8s.ResourceCache) string {
+	const preferred = "kube-system"
+	if cache == nil || cache.Pods() == nil {
+		return preferred
+	}
+	if pods, err := cache.Pods().Pods(preferred).List(labels.Everything()); err == nil && len(pods) > 0 {
+		return preferred
+	}
+	pods, err := cache.Pods().List(labels.Everything())
+	if err != nil || len(pods) == 0 {
+		return preferred
+	}
+	namespace := pods[0].Namespace
+	for _, pod := range pods[1:] {
+		namespace = min(namespace, pod.Namespace)
+	}
+	return namespace
+}
+
+// ClusterIdentityLabels are the labels Radar reads as a cluster's identity.
+func ClusterIdentityLabels() []string {
+	return slices.Clone(partitionLabels)
+}
+
 func pvcScopeProbe(namespace string, claims []string, window time.Duration) scopeProbe {
 	return scopeProbe{
 		metric: "kubelet_volume_stats_capacity_bytes", additionalMetrics: []string{"kubelet_volume_stats_used_bytes"},
@@ -196,7 +263,7 @@ func decideVerifiedScope(ctx context.Context, q seriesQuerier, probe scopeProbe,
 	if probe.singlePartition {
 		present, err := readScopePartition(ctx, q, probe, m)
 		if err != nil {
-			return "", SeriesIsolation{}, err
+			return "", iso, err
 		}
 		if present {
 			return m, iso, nil
@@ -218,7 +285,7 @@ func decideVerifiedScope(ctx context.Context, q seriesQuerier, probe scopeProbe,
 			return "", SeriesIsolation{}, err
 		}
 		if len(all.Series) > 0 {
-			return "", SeriesIsolation{}, ErrScopeMismatch
+			return "", iso, ErrScopeMismatch
 		}
 	}
 	return m, iso, nil
```

**File**: `internal/prometheus/traffic_scope_test.go` (added, +155/-0)
```diff
@@ -0,0 +1,155 @@
+package prometheus
+
+import (
+	"context"
+	"errors"
+	"maps"
+	"strings"
+	"testing"
+
+	corev1 "k8s.io/api/core/v1"
+	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
+	"k8s.io/apimachinery/pkg/types"
+
+	"github.com/skyhook-io/radar/pkg/k8score"
+	"github.com/skyhook-io/radar/pkg/prom"
+)
+
+func TestWithScopeEmptySelector(t *testing.T) {
+	if got := withScope("", `cluster="a"`); got != `cluster="a"` {
+		t.Errorf("withScope(\"\", m) = %q, want the matchers alone", got)
+	}
+	if got := withScope(`job="x"`, `cluster="a"`); got != `job="x",cluster="a"` {
+		t.Errorf("got %q", got)
+	}
+}
+
+// The traffic map's probe has no selector of its own for Caretta, so every
+// query it builds must still be valid PromQL.
+func TestTrafficScopeQueriesAreValidWithoutSelector(t *testing.T) {
+	q := &fakeCNPGQuerier{instant: func(string) (*prom.QueryResult, error) {
+		return &prom.QueryResult{Series: []prom.Series{vec(map[string]string{"cluster": "a"}, 1)}}, nil
+	}}
+	m, iso, err := decideScope(context.Background(), q, trafficScopeProbe("caretta_links_observed", ""), map[string]string{"cluster": "a"})
+	if err != nil || m != `cluster="a"` || iso.Mode != SeriesIsolationVerified {
+		t.Fatalf("m=%q iso=%+v err=%v", m, iso, err)
+	}
+	for _, query := range q.queries {
+		if strings.Contains(query, "{,") {
+			t.Errorf("invalid selector in %s", query)
+		}
+	}
+}
+
+// The empty-map warning names the cluster labels the traffic failed to match,
+// so a mismatch has to keep them.
+func TestTrafficScopeMismatchKeepsProvenLabels(t *testing.T) {
+	q := &fakeCNPGQuerier{instant: func(query string) (*prom.QueryResult, error) {
+		if strings.Contains(query, `cluster="a"`) {
+			return &prom.QueryResult{}, nil
+		}
+		return &prom.QueryResult{Series: []prom.Series{vec(map[string]string{"cluster": "b"}, 1)}}, nil
+	}}
+	_, iso, err := decideScope(context.Background(), q, trafficScopeProbe("caretta_links_observed", ""), map[string]string{"cluster": "a"})
+	if !errors.Is(err, ErrScopeMismatch) {
+		t.Fatalf("err = %v, want mismatch", err)
+	}
+	if !maps.Equal(iso.Labels, map[string]string{"cluster": "a"}) {
+		t.Errorf("mismatch dropped the proven labels: %+v", iso)
+	}
+}
+
+func TestTrafficScopeWithoutProof(t *testing.T) {
+	probe := trafficScopeProbe("beyla_network_flow_bytes_total", `job=~".*beyla.*"`)
+	one := &fakeCNPGQuerier{instant: func(string) (*prom.QueryResult, error) {
+		return &prom.QueryResult{Series: []prom.Series{vec(nil, 4)}}, nil
+	}}
+	m, iso, err := decideScope(context.Background(), one, probe, nil)
+	if err != nil || m != "" || iso.Mode != SeriesIsolationUnverified {
+		t.Fatalf("one unlabeled identity: m=%q iso=%+v err=%v", m, iso, err)
+	}
+	for _, query := range one.queries {
+		if !strings.Contains(query, `job=~".*beyla.*"`) {
+			t.Errorf("probe lost the source's selector: %s", query)
+		}
+	}
+	two := &fakeCNPGQuerier{instant: func(string) (*prom.QueryResult, error) {
+		return &prom.QueryResult{Series: []prom.Series{vec(map[string]string{"cluster": "a"}, 1), vec(map[string]string{"cluster": "b"}, 1)}}, nil
+	}}
+	if _, _, err := decideScope(context.Background(), two, probe, nil); !errors.Is(err, ErrScopeAmbiguous) {
+		t.Fatalf("two identities: err = %v, want ambiguous", err)
+	}
+}
+
+// The multi-cluster note counts cluster names only from the cluster identity
+// labels, so a region or environment label never splits one cluster in two.
+func TestTrafficSpansClusters(t *testing.T) {
+	for _, tc := range []struct {
+		name   string
+		series []prom.Series
+		want   bool
+	}{
+		{"one cluster name", []prom.Series{vec(map[string]string{"cluster": "a"}, 9)}, false},
+		{"no cluster label", []prom.Series{vec(nil, 9)}, false},
+		{"two cluster names", []prom.Series{vec(map[string]string{"cluster": "a"}, 4), vec(map[string]string{"cluster": "b"}, 5)}, true},
+	} {
+		t.Run(tc.name, func(t *testing.T) {
+			q := &fakeCNPGQuerier{instant: func(string) (*prom.QueryResult, error) {
+				return &prom.QueryResult{Series: tc.series}, nil
+			}}
+			got, err := trafficSpansClusters(context.Background(), q, "beyla_network_flow_bytes_total", `job="beyla"`)
+			if err != nil || got != tc.want {
+				t.Fatalf("got %v, %v; want %v", got, err, tc.want)
+			}
+			for _, query := range q.queries {
+				if !strings.Contains(query, "count by ("+strings.Join(ClusterIdentityLabels(), ",")+")") || !strings.Contains(query, `job="beyla"`) {
+					t.Errorf("query should group by the cluster identity labels only, under the selector: %s", query)
+				}
+			}
+		})
+	}
+	failing := &fakeCNPGQuerier{instant: func(string) (*prom.QueryResult, error) { return nil, errors.New("timeout") }}
+	if _, err := trafficSpansClusters(context.Background(), failing, "m", ""); err == nil {
+		t.Error("a failed query must surface as an error")
+	}
+}
+
+func TestResolveTrafficScopeUsesOperatorLabels(t *testing.T) {
+	c := &Client{workloadScope: &prom.WorkloadMetricsScope{ClusterLabels: map[string]string{"cluster": "east"}}}
+	m, iso, 
```

---

### Incident Patch 3: `18cee311` (2026-11-10)
**Commit Message**: fix(cost): weight OpenCost allocation by time and scale PV cost by size (#1941)

## Description

Two bugs in the PromQL cost path (`pkg/opencost`) make the Cost view
wrong on some clusters.

**1. Short-lived pods are costed for the whole hour.**
The allocation queries take
`avg_over_time(container_cpu_allocation[1h])` (same for memory) for each
series, then sum. `avg_over_time` averages only the samples a series
has. A pod that existed for 5 minutes therefore counts at its full
allocation for the whole hour. On clusters with high pod churn (CI
runners, preview environments), the allocated cost ends up several times
higher than what the nodes cost.

On one of our clusters (GitLab CI runners and ephemeral QA namespaces),
9,363 allocation series appear in one hour, for about 2,100 live
containers:

| | EUR/h |
| --- | --- |
| Summary shown by Radar (`/api/opencost/summary`) | 20.12 |
| Same query recomputed (`avg_over_time … [1h]`) | 20.42 |
| With this PR (`sum_over_time(… [1h:1m]) / 60`) | 2.45 |
| Instantaneous allocation (`container_*_allocation ×
node_*_hourly_cost`) | 2.34 |
| Total node cost (`node_total_hourly_cost`) | 4.18 |

With the current queries, allocation exceeds node 

**File**: `internal/mcp/tools_cost.go` (modified, +21/-9)
```diff
@@ -93,7 +93,7 @@ type costTotals struct {
 	NodeMonthlyProjection      *nullableCost `json:"nodeMonthlyProjection,omitempty"`
 	UnallocatedCost            *nullableCost `json:"unallocatedHourlyCost,omitempty"`
 	UnusedRequestCost          *float64      `json:"unusedRequestHourlyCost,omitempty"`
-	StorageCost                float64       `json:"storageHourlyCost,omitempty"`
+	StorageCost                *nullableCost `json:"storageHourlyCost,omitempty"`
 	NetworkCost                float64       `json:"networkHourlyCost,omitempty"`
 	ClusterEfficiency          *nullableCost `json:"efficiencyPercent,omitempty"`
 }
@@ -112,12 +112,12 @@ func (c nullableCost) MarshalJSON() ([]byte, error) {
 }
 
 type namespaceCostRow struct {
-	Name        string  `json:"name"`
-	HourlyCost  float64 `json:"hourlyCost"`
-	CPUCost     float64 `json:"cpuHourlyCost"`
-	MemoryCost  float64 `json:"memoryHourlyCost"`
-	StorageCost float64 `json:"storageHourlyCost,omitempty"`
-	NetworkCost float64 `json:"networkHourlyCost,omitempty"`
+	Name        string        `json:"name"`
+	HourlyCost  float64       `json:"hourlyCost"`
+	CPUCost     float64       `json:"cpuHourlyCost"`
+	MemoryCost  float64       `json:"memoryHourlyCost"`
+	StorageCost *nullableCost `json:"storageHourlyCost,omitempty"`
+	NetworkCost float64       `json:"networkHourlyCost,omitempty"`
 	// Pointer: nil drops it when usage is unavailable, while a measured 0 stays.
 	UnusedRequestCost *float64 `json:"unusedRequestHourlyCost,omitempty"`
 	// Pointer, not omitempty: 0% is a measurement on a row using nothing.
@@ -398,7 +398,7 @@ func costSummaryView(ctx context.Context, input getCostInput, limit int) (costRe
 	}
 	resp.Totals.UnallocatedCost = &nullableCost{value: summary.TotalUnallocatedCost}
 	resp.Totals.UnusedRequestCost = measuredUnusedRequestCost(summary)
-	resp.Totals.StorageCost = roundHourly(summary.TotalStorageCost)
+	resp.Totals.StorageCost = storageCostField(summary.TotalStorageCost)
 	resp.Totals.NetworkCost = roundHourly(summary.TotalNetworkCost)
 	// Cluster efficiency is derived only from rows that HAVE usage evidence, so
 	// when none of them do the 0 it lands on is an absence, not a measurement.
@@ -413,7 +413,7 @@ func costSummaryView(ctx context.Context, input getCostInput, limit int) (costRe
 			HourlyCost:        roundHourly(row.HourlyCost),
 			CPUCost:           roundHourly(row.CPUCost),
 			MemoryCost:        roundHourly(row.MemoryCost),
-			StorageCost:       roundHourly(row.StorageCost),
+			StorageCost:       storageCostField(row.StorageCost),
 			NetworkCost:       roundHourly(row.NetworkCost),
 			UnusedRequestCost: measuredValue(row.IdleCost, row.UsageUnavailable),
 			Efficiency:        measuredValue(row.Efficiency, row.UsageUnavailable),
@@ -428,6 +428,15 @@ func costSummaryView(ctx context.Context, input getCostInput, limit int) (costRe
 	return resp, nil
 }
 
+// storageCostField omits a measured zero, as before storage could be unknown,
+// and says null when the source could not price a volume.
+func storageCostField(cost *float64) *nullableCost {
+	if cost != nil && roundHourly(*cost) == 0 {
+		return nil
+	}
+	return &nullableCost{value: cost}
+}
+
 // measuredUnusedRequestCost is nil when no row has usage evidence, like
 // efficiencyPercent: a 0 there would claim nothing is wasted rather than that
 // nothing was measured.
@@ -444,6 +453,9 @@ func costSplitGuidance(summary *pkgopencost.CostSummary, scoped bool) []string {
 		parts = append(parts, "On this source namespace rows and allocatedHourlyCost count CPU, memory and storage allocation only; GPU and network cost are not in them.")
 	}
 	parts = append(parts, costWasteExplainer)
+	if summary.TotalStorageCost == nil {
+		parts = append(parts, "storageHourlyCost is null where volume cost could not be calculated, usually because Prometheus lacks kube_persistentvolume_capacity_bytes from kube-state-metrics. Hourly totals on those rows leave storage out; this is not the same as no storage.")
+	}
 	if summary.TotalUnallocatedCost == nil {
 		if scoped {
 			parts = append(parts, "unallocatedHourlyCost is null: unrequested node capacity belongs to the cluster, not to a namespace.")
```

**File**: `internal/opencost/handlers.go` (modified, +11/-3)
```diff
@@ -287,7 +287,6 @@ func FilterCostSummary(resp *pkgopencost.CostSummary, allowed []string) {
 	}
 	filtered := make([]pkgopencost.NamespaceCost, 0, len(resp.Namespaces))
 	resp.TotalHourlyCost = 0
-	resp.TotalStorageCost = 0
 	resp.TotalNetworkCost = 0
 	resp.TotalIdleCost = 0
 	// Unrequested node capacity cannot be attributed to a namespace, so a
@@ -296,14 +295,19 @@ func FilterCostSummary(resp *pkgopencost.CostSummary, allowed []string) {
 	resp.TotalNodeCost = nil
 	resp.TotalUnusedRequestCost = 0
 	resp.HourlyCostBasis = pkgopencost.HourlyCostBasisAllocated
-	var allocated, usage float64
+	var allocated, usage, storage float64
+	storageMeasured := true
 	for _, row := range resp.Namespaces {
 		if _, ok := allow[row.Name]; !ok {
 			continue
 		}
 		filtered = append(filtered, row)
 		resp.TotalHourlyCost += row.HourlyCost
-		resp.TotalStorageCost += row.StorageCost
+		if row.StorageCost == nil {
+			storageMeasured = false
+		} else {
+			storage += *row.StorageCost
+		}
 		resp.TotalNetworkCost += row.NetworkCost
 		resp.TotalIdleCost += row.IdleCost
 		resp.TotalUnusedRequestCost += row.IdleCost
@@ -313,6 +317,10 @@ func FilterCostSummary(resp *pkgopencost.CostSummary, allowed []string) {
 		}
 	}
 	resp.Namespaces = filtered
+	resp.TotalStorageCost = nil
+	if storageMeasured {
+		resp.TotalStorageCost = &storage
+	}
 	resp.TotalAllocatedCost = resp.TotalHourlyCost
 	if sourceAvailable && len(filtered) == 0 {
 		resp.Available = false
```

**File**: `internal/opencost/handlers_test.go` (modified, +25/-0)
```diff
@@ -252,6 +252,31 @@ func TestFilterCostSummaryDropsClusterLevelUnallocatedCost(t *testing.T) {
 	}
 }
 
+func TestFilterCostSummaryKeepsUnknownStorageUnknown(t *testing.T) {
+	known := 0.5
+	newSummary := func() *pkgopencost.CostSummary {
+		return &pkgopencost.CostSummary{
+			Available: true,
+			Namespaces: []pkgopencost.NamespaceCost{
+				{Name: "sized", HourlyCost: 1.5, CPUCost: 0.5, MemoryCost: 0.5, StorageCost: &known},
+				{Name: "unsized", HourlyCost: 1, CPUCost: 0.5, MemoryCost: 0.5},
+			},
+		}
+	}
+
+	resp := newSummary()
+	FilterCostSummary(resp, []string{"sized"})
+	if resp.TotalStorageCost == nil || *resp.TotalStorageCost != 0.5 {
+		t.Fatalf("scope with only sized volumes: TotalStorageCost=%v, want 0.5", resp.TotalStorageCost)
+	}
+
+	resp = newSummary()
+	FilterCostSummary(resp, []string{"sized", "unsized"})
+	if resp.TotalStorageCost != nil {
+		t.Fatalf("scope with an unsized volume: TotalStorageCost=%v, want unknown", *resp.TotalStorageCost)
+	}
+}
+
 func TestFilterCostSummaryExcludesUnavailableUsageFromEfficiency(t *testing.T) {
 	resp := &pkgopencost.CostSummary{
 		Available:         true,
```

**File**: `pkg/opencost/compute.go` (modified, +47/-13)
```diff
@@ -205,7 +205,7 @@ func ComputeCostSummary(ctx context.Context, client *RESTClient, opts SummaryOpt
 			Kind:        aggregate,
 			CPUCost:     a.CPUCost,
 			MemoryCost:  a.RAMCost,
-			StorageCost: a.PVCost,
+			StorageCost: knownCost(a.PVCost),
 			NetworkCost: a.NetworkCost,
 			HourlyCost:  a.TotalCost,
 		}
@@ -240,7 +240,7 @@ func ComputeCostSummary(ctx context.Context, client *RESTClient, opts SummaryOpt
 			totalUsageCost += usageCost
 		}
 		totalHourlyCost += nc.HourlyCost
-		totalStorageCost += nc.StorageCost
+		totalStorageCost += a.PVCost
 		totalNetworkCost += nc.NetworkCost
 		// Per-namespace idle (allocated-not-used) is separate from the
 		// __idle__ row (unassigned node capacity). Both are real waste the
@@ -273,7 +273,7 @@ func ComputeCostSummary(ctx context.Context, client *RESTClient, opts SummaryOpt
 		namespaces[i].HourlyCost = normalize(namespaces[i].HourlyCost)
 		namespaces[i].CPUCost = normalize(namespaces[i].CPUCost)
 		namespaces[i].MemoryCost = normalize(namespaces[i].MemoryCost)
-		namespaces[i].StorageCost = normalize(namespaces[i].StorageCost)
+		namespaces[i].StorageCost = mapCost(namespaces[i].StorageCost, normalize)
 		namespaces[i].NetworkCost = normalize(namespaces[i].NetworkCost)
 		namespaces[i].CPUUsageCost = normalize(namespaces[i].CPUUsageCost)
 		namespaces[i].MemoryUsageCost = normalize(namespaces[i].MemoryUsageCost)
@@ -289,7 +289,7 @@ func ComputeCostSummary(ctx context.Context, client *RESTClient, opts SummaryOpt
 		namespaces[i].HourlyCost = roundTo(namespaces[i].HourlyCost, 4)
 		namespaces[i].CPUCost = roundTo(namespaces[i].CPUCost, 4)
 		namespaces[i].MemoryCost = roundTo(namespaces[i].MemoryCost, 4)
-		namespaces[i].StorageCost = roundTo(namespaces[i].StorageCost, 4)
+		namespaces[i].StorageCost = mapCost(namespaces[i].StorageCost, round4)
 		namespaces[i].NetworkCost = roundTo(namespaces[i].NetworkCost, 4)
 		namespaces[i].CPUUsageCost = roundTo(namespaces[i].CPUUsageCost, 4)
 		namespaces[i].MemoryUsageCost = roundTo(namespaces[i].MemoryUsageCost, 4)
@@ -301,7 +301,7 @@ func ComputeCostSummary(ctx context.Context, client *RESTClient, opts SummaryOpt
 		Currency:          opts.Currency,
 		Window:            opts.Window,
 		TotalHourlyCost:   totalHourlyCost,
-		TotalStorageCost:  totalStorageCost,
+		TotalStorageCost:  knownCost(totalStorageCost),
 		TotalNetworkCost:  totalNetworkCost,
 		TotalIdleCost:     totalIdleCost,
 		ClusterEfficiency: clusterEfficiency,
@@ -342,6 +342,22 @@ func optionalCost(measured bool, value float64) *float64 {
 	return &value
 }
 
+func knownCost(value float64) *float64 {
+	return &value
+}
+
+// mapCost applies f to a measured cost and keeps an unknown one unknown.
+func mapCost(value *float64, f func(float64) float64) *float64 {
+	if value == nil {
+		return nil
+	}
+	return knownCost(f(*value))
+}
+
+func round4(value float64) float64 {
+	return roundTo(value, 4)
+}
+
 // safeRatio returns num/den or 0 when den is non-positive.
 func safeRatio(num, den float64) float64 {
 	if den <= 0 {
@@ -372,7 +388,7 @@ func ComputeCostSummaryFromProm(ctx context.Context, client *prom.Client, opts S
 	}
 
 	cpuResult, err := client.Query(ctx,
-		`sum by (namespace) (label_replace(avg_over_time(container_cpu_allocation{namespace!=""}[1h]), "namespace", "$1", "exported_namespace", "(.+)") * on(node) group_left() `+nodeCPUHourlyCostExpr+`)`)
+		`sum by (namespace) (label_replace((sum_over_time(container_cpu_allocation{namespace!=""}[1h:1m]) / 60), "namespace", "$1", "exported_namespace", "(.+)") * on(node) group_left() `+nodeCPUHourlyCostExpr+`)`)
 	if err != nil {
 		log.Printf("[opencost] CPU allocation query failed, trying opencost_container_cpu_cost_total: %v", err)
 		cpuResult, err = client.Query(ctx,
@@ -384,7 +400,7 @@ func ComputeCostSummaryFromProm(ctx context.Context, client *prom.Client, opts S
 	}
 
 	memResult, err := client.Query(ctx,
-		`sum by (namespace) (label_replace(avg_over_time(container_memory_allocation_bytes{namespace!=""}[1h]), "namespace", "$1", "exported_namespace", "(.+)") / 1073741824 * on(node) group_left() `+nodeRAMHourlyCostExpr+`)`)
+		`sum by (namespace) (label_replace((sum_over_time(container_memory_allocation_bytes{namespace!=""}[1h:1m]) / 60), "namespace", "$1", "exported_namespace", "(.+)") / 1073741824 * on(node) group_left() `+nodeRAMHourlyCostExpr+`)`)
 	if err != nil {
 		log.Printf("[opencost] memory allocation query failed, trying opencost_container_memory_cost_total: %v", err)
 		memResult, err = client.Query(ctx,
@@ -419,21 +435,39 @@ func ComputeCostSummaryFromProm(ctx context.Context, client *prom.Client, opts S
 	storageRes, storageErr := client.Query(ctx,
 		`sum by (namespace) (`+persistentVolumeHourlyCostExpr+` * on(persistentvolume) group_left(namespace) `+persistentVolumeClaimRef+`)`)
 	if storageErr != nil {
-		log.Printf("[opencost] storage cost query failed (storage costs will be 0): %v", storageErr)
+		log.Printf("[opencost] storage cost query failed (storage costs will b
```

**File**: `pkg/opencost/compute_test.go` (modified, +89/-1)
```diff
@@ -97,6 +97,7 @@ func TestComputeCostSummary_HappyPath(t *testing.T) {
 		{contains: "container_memory_allocation_bytes", body: vectorBody(map[string]float64{"checkout": 3.0, "payments": 0.5})},
 		{contains: "container_cpu_usage_seconds_total", body: vectorBody(map[string]float64{"checkout": 0.8, "payments": 0.6})},
 		{contains: "container_memory_working_set_bytes", body: vectorBody(map[string]float64{"checkout": 1.2, "payments": 0.25})},
+		{contains: unsizedPersistentVolumeExpr, body: vectorBody(nil)},
 		{contains: "pv_hourly_cost", body: vectorBody(map[string]float64{"checkout": 0.05})},
 		{contains: "node_total_hourly_cost", body: scalarBody(8.0)}, // exceeds sum of namespaces, so it wins
 		{contains: "node_gpu_count", body: scalarBody(0)},
@@ -112,7 +113,7 @@ func TestComputeCostSummary_HappyPath(t *testing.T) {
 	if got.TotalHourlyCost != 8.0 {
 		t.Errorf("TotalHourlyCost=%v, want 8.0 (node_total_hourly_cost ceiling)", got.TotalHourlyCost)
 	}
-	if got.TotalStorageCost != 0.05 {
+	if got.TotalStorageCost == nil || *got.TotalStorageCost != 0.05 {
 		t.Errorf("TotalStorageCost=%v, want 0.05", got.TotalStorageCost)
 	}
 	// totalAlloc = (2+3) + (1+0.5) = 6.5; totalUsage = (0.8+1.2) + (0.6+0.25) = 2.85
@@ -289,6 +290,93 @@ func TestComputeCostSummary_DedupesPersistentVolumeClaimRefs(t *testing.T) {
 	if !strings.Contains(storageQuery, `label_replace(kube_persistentvolume_claim_ref, "namespace", "$1", "claim_namespace", "(.+)")`) {
 		t.Fatalf("storage query must normalize claim_namespace before namespace aggregation:\n%s", storageQuery)
 	}
+	if !strings.Contains(storageQuery, "kube_persistentvolume_capacity_bytes") {
+		t.Fatalf("storage query must scale the per-GiB pv_hourly_cost by volume size:\n%s", storageQuery)
+	}
+}
+
+// avg_over_time only averages the samples a series has, so a pod that lived
+// five minutes would be billed for the whole hour. Allocation must be
+// weighted by the time each series was present.
+func TestComputeCostSummary_AllocationIsTimeWeighted(t *testing.T) {
+	var queries []string
+	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
+		queries = append(queries, r.URL.Query().Get("query"))
+		w.Header().Set("Content-Type", "application/json")
+		_, _ = w.Write([]byte(vectorBody(map[string]float64{"checkout": 1.0})))
+	}))
+	defer srv.Close()
+	client := prom.NewClient(prom.NewHTTPTransport(srv.URL, "", nil))
+
+	ComputeCostSummaryFromProm(context.Background(), client, SummaryOptions{})
+
+	var checked int
+	for _, q := range queries {
+		if !strings.Contains(q, "container_cpu_allocation") && !strings.Contains(q, "container_memory_allocation_bytes") {
+			continue
+		}
+		checked++
+		if strings.Contains(q, "avg_over_time") {
+			t.Errorf("allocation query must not use avg_over_time:\n%s", q)
+		}
+		if !strings.Contains(q, "[1h:1m]) / 60") {
+			t.Errorf("allocation query must be time-weighted over the hour:\n%s", q)
+		}
+	}
+	if checked != 2 {
+		t.Fatalf("expected CPU and memory allocation queries, saw %d", checked)
+	}
+}
+
+// A volume with a price but no size drops out of the storage join. Its
+// namespace must read as unknown storage, not as having none.
+func TestComputeCostSummary_UnsizedVolumeStorageIsUnknown(t *testing.T) {
+	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
+		q := r.URL.Query().Get("query")
+		w.Header().Set("Content-Type", "application/json")
+		switch {
+		case strings.Contains(q, "container_cpu_allocation"), strings.Contains(q, "container_memory_allocation_bytes"):
+			_, _ = w.Write([]byte(vectorBody(map[string]float64{"db": 1.0, "web": 1.0})))
+		case strings.Contains(q, "unless on (persistentvolume)"):
+			_, _ = w.Write([]byte(vectorBody(map[string]float64{"db": 1})))
+		default:
+			_, _ = w.Write([]byte(vectorBody(nil)))
+		}
+	}))
+	defer srv.Close()
+	client := prom.NewClient(prom.NewHTTPTransport(srv.URL, "", nil))
+
+	got := ComputeCostSummaryFromProm(context.Background(), client, SummaryOptions{})
+	if !got.Available {
+		t.Fatalf("summary unavailable: %+v", got)
+	}
+	raw, err := json.Marshal(got)
+	if err != nil {
+		t.Fatal(err)
+	}
+	var wire struct {
+		TotalStorageCost json.RawMessage `json:"totalStorageCost"`
+		Namespaces       []struct {
+			Name        string          `json:"name"`
+			StorageCost json.RawMessage `json:"storageCost"`
+		} `json:"namespaces"`
+	}
+	if err := json.Unmarshal(raw, &wire); err != nil {
+		t.Fatal(err)
+	}
+	if string(wire.TotalStorageCost) != "null" {
+		t.Errorf("totalStorageCost=%q, want null when a namespace's storage is unknown:\n%s", wire.TotalStorageCost, raw)
+	}
+	storage := map[string]string{}
+	for _, ns := range wire.Namespaces {
+		storage[ns.Name] = string(ns.StorageCost)
+	}
+	if storage["db"] != "null" {
+		t.Errorf("db storageCost=%q, want null:\n%s", storage["db"], raw)
+	}
+	if storage["web"] != "0" {
+		t.Errorf("web storageCost=%q, want 0 for a namespace without volumes:\n%s", storage["w
```

**File**: `pkg/opencost/kubecost_current.go` (modified, +5/-5)
```diff
@@ -62,7 +62,7 @@ func ComputeKubecostSummary(ctx context.Context, client *KubecostClient, opts Ku
 	}
 
 	out := &CostSummary{Available: true, Currency: opts.Currency, Window: window, Source: "kubecost", HourlyCostBasis: HourlyCostBasisAllocated}
-	var totalAlloc, totalUsage, unallocated float64
+	var totalAlloc, totalUsage, unallocated, totalStorage float64
 	sawIdleRow := false
 	for key, allocation := range kubecostAllocationRows(resp) {
 		if allocation == nil {
@@ -109,7 +109,7 @@ func ComputeKubecostSummary(ctx context.Context, client *KubecostClient, opts Ku
 			HourlyCost:       allocation.TotalCost / hours,
 			CPUCost:          cpu,
 			MemoryCost:       ram,
-			StorageCost:      allocation.PVCost / hours,
+			StorageCost:      knownCost(allocation.PVCost / hours),
 			NetworkCost:      (allocation.NetworkCost + allocation.LoadBalancerCost) / hours,
 			CPUUsageCost:     cpuUsage,
 			MemoryUsageCost:  ramUsage,
@@ -128,7 +128,7 @@ func ComputeKubecostSummary(ctx context.Context, client *KubecostClient, opts Ku
 		}
 		roundNamespaceCost(&row)
 		out.TotalHourlyCost += row.HourlyCost
-		out.TotalStorageCost += row.StorageCost
+		totalStorage += *row.StorageCost
 		out.TotalNetworkCost += row.NetworkCost
 		out.TotalIdleCost += row.IdleCost
 		out.TotalUnusedRequestCost += row.IdleCost
@@ -140,7 +140,7 @@ func ComputeKubecostSummary(ctx context.Context, client *KubecostClient, opts Ku
 	}
 	sort.Slice(out.Namespaces, func(i, j int) bool { return out.Namespaces[i].HourlyCost > out.Namespaces[j].HourlyCost })
 	out.TotalHourlyCost = roundTo(out.TotalHourlyCost, 4)
-	out.TotalStorageCost = roundTo(out.TotalStorageCost, 4)
+	out.TotalStorageCost = knownCost(roundTo(totalStorage, 4))
 	out.TotalNetworkCost = roundTo(out.TotalNetworkCost, 4)
 	out.TotalIdleCost = roundTo(out.TotalIdleCost, 4)
 	out.TotalUnusedRequestCost = roundTo(out.TotalUnusedRequestCost, 4)
@@ -623,7 +623,7 @@ func roundNamespaceCost(row *NamespaceCost) {
 	row.HourlyCost = roundTo(row.HourlyCost, 4)
 	row.CPUCost = roundTo(row.CPUCost, 4)
 	row.MemoryCost = roundTo(row.MemoryCost, 4)
-	row.StorageCost = roundTo(row.StorageCost, 4)
+	row.StorageCost = mapCost(row.StorageCost, round4)
 	row.NetworkCost = roundTo(row.NetworkCost, 4)
 	row.CPUUsageCost = roundTo(row.CPUUsageCost, 4)
 	row.MemoryUsageCost = roundTo(row.MemoryUsageCost, 4)
```

**File**: `pkg/opencost/kubecost_current_test.go` (modified, +1/-1)
```diff
@@ -71,7 +71,7 @@ func TestComputeKubecostSummaryFallsBackFromNullHourAndNormalizesActualDuration(
 		t.Fatalf("namespaces = %d, want 1", len(resp.Namespaces))
 	}
 	row := resp.Namespaces[0]
-	if row.Name != "demo" || row.HourlyCost != 2.75 || row.CPUCost != 1 || row.MemoryCost != 1 || row.StorageCost != 0.5 || row.NetworkCost != 0.25 {
+	if row.Name != "demo" || row.HourlyCost != 2.75 || row.CPUCost != 1 || row.MemoryCost != 1 || row.StorageCost == nil || *row.StorageCost != 0.5 || row.NetworkCost != 0.25 {
 		t.Fatalf("unexpected normalized row: %#v", row)
 	}
 	if row.CPUUsageCost != 0.5 || row.MemoryUsageCost != 0.25 || row.IdleCost != 1.25 || row.Efficiency != 37.5 {
```

**File**: `pkg/opencost/queries.go` (modified, +15/-3)
```diff
@@ -1,13 +1,25 @@
 package opencost
 
+// Allocation queries average container_*_allocation over the last hour with
+// sum_over_time(x[1h:1m]) / 60 rather than avg_over_time(x[1h]).
+// avg_over_time only averages the samples a series has, so a pod that lived
+// five minutes counted as if it had run the whole hour; on clusters with
+// short-lived pods (CI runners, preview environments) that inflated costs
+// several times over. The 1m subquery weights each series by the time it
+// was actually present.
+
 const (
 	nodeTotalHourlyCostExpr         = `max by (node) (node_total_hourly_cost)`
 	nodeTotalHourlyCostMetadataExpr = `max by (node, instance_type, region) (node_total_hourly_cost)`
 	nodeCPUHourlyCostExpr           = `max by (node) (node_cpu_hourly_cost)`
 	nodeRAMHourlyCostExpr           = `max by (node) (node_ram_hourly_cost)`
 	// node_gpu_hourly_cost is exported for every node, GPU or not, so GPU
 	// spend is the count times the rate.
-	nodeGPUHourlyCostExpr          = `sum(max by (node) (node_gpu_count) * on (node) max by (node) (node_gpu_hourly_cost))`
-	persistentVolumeHourlyCostExpr = `max by (persistentvolume) (pv_hourly_cost)`
-	persistentVolumeClaimRef       = `max by (persistentvolume, namespace) (label_replace(kube_persistentvolume_claim_ref, "namespace", "$1", "claim_namespace", "(.+)"))`
+	nodeGPUHourlyCostExpr = `sum(max by (node) (node_gpu_count) * on (node) max by (node) (node_gpu_hourly_cost))`
+	// pv_hourly_cost is a per-GiB rate, so it has to be scaled by the volume
+	// size to get the volume's hourly cost.
+	persistentVolumeHourlyCostExpr = `(max by (persistentvolume) (pv_hourly_cost) * on (persistentvolume) max by (persistentvolume) (kube_persistentvolume_capacity_bytes) / 1073741824)`
+	// unsizedPersistentVolumeExpr lists priced volumes whose size is unknown.
+	unsizedPersistentVolumeExpr = `(max by (persistentvolume) (pv_hourly_cost) unless on (persistentvolume) kube_persistentvolume_capacity_bytes)`
+	persistentVolumeClaimRef    = `max by (persistentvolume, namespace) (label_replace(kube_persistentvolume_claim_ref, "namespace", "$1", "claim_namespace", "(.+)"))`
 )
```

#### Recent Merged Pull Requests:
- **PR #2606** (2026-11-11): Refuse to restart a paused Deployment, and show toasts above dialogs (@hisco)
- **PR #2605** (2026-11-11): docs: drop WSL from the shared listener list (@hisco)
- **PR #2604** (2026-11-11): Say when a Cursor policy turns off Run Everything (@hisco)
- **PR #2603** (2026-11-10): Fit a resource table column to its content on resize-handle double-click (@hisco)
- **PR #2602** (2026-11-10): Open resources clicked in a single-workload app's workload view (@hisco)
- **PR #2599** (2026-11-10): Stop list_resources when an MCP client on protocol 2026-07-28 leaves (@hisco)

---

## 3. Empirical Evidence & Compliance Certification
- **Evidence Provenance**: Fetched directly from verified official GitHub REST API.
- **Zero Disk Footprint**: 0 bytes of unnecessary repository bloat stored locally.
- **TOS & Free-Tier Adherence**: Request pace complied with public API guidelines without fee, penalty, or unauthorized scraping.

---

## 4. Promotion & Integration Status
- **Status**: HARVESTED_DEEP_FORENSIC
- **Master Brain Sync**: Auto-committed to local/remote Master Brain repository.


---

## 6. Net-New Universal Engineering Rules (Candidates for Master Brain)

## X. Read pod-level resources in rightsizing, crash-loop OOM, MCP overview and AI met

**RULE**:
When implementing operations in `docs/mcp.md`, engineers MUST enforce rigorous boundary validation, safe state transitions, and memory/concurrency invariants as established by production defect remediation in skyhook-io/radar. All inputs crossing module boundaries must be explicitly verified before state persistence.

**WHY**:
Prevents defects observed in production commit `0de4c586`: Read pod-level resources in rightsizing, crash-loop OOM, MCP overview and AI metrics (#2596). Unvalidated execution paths cause runtime exceptions, race conditions, and silent state corruption under concurrent workloads.

**WHEN TO APPLY**:
Subsystems managing Go data structures, boundary deserialization, API parsing, or resource lifecycles matching `docs/mcp.md`.

**VERIFIED IMPLEMENTATION PATTERN**:
```go
// Verified production-grade fix pattern:
| `requests_exceed_pod_limit` | The pod has a pod-level limit (`spec.resources.limits`) and no pod-level request, so its request is the sum of its containers' requests. Applying this increase together with the other containers' requests and the workload's other suggested increases would exceed that limit, which the API server rejects, so the suggestion is withheld and `limitConflict` is set. Each withheld increase may fit on its own; decide how to split the pod limit between containers, or raise it. |
| `pod_level_request` | The pod sets a fixed pod-level request for this resource (`spec.resources`, Kubernetes 1.34+), shown as `podLevelRequest`. The scheduler reserves that value instead of the containers' requests, so Radar suggests no per-container request and does not size the pod-level one. The row has `fit: pod_level_request` and `needsManualReview` with that review reason. Only an explicit pod-level request counts: with a pod-level limit alone, Kubernetes defaults the request to the limit only while no container sets one, so container requests still decide the reservation and are sized as usual. |
Rows needing manual review — an HPA, OOM history, a limit conflict, a reduction 
```

**NEGATIVE CONSTRAINT**:
```go
// Anti-pattern to NEVER write (induced failure mode):
Rows needing manual review — an HPA, OOM history, a limit conflict, or a reduction against bursty or throttled usage — contribute **no** impact: that saving cannot be applied unattended, so counting it would rank a workload by waste it cannot give back. Unevidenced rows also contribute no delta. Missing evidence for one resource does not hide a known increase or review signal on another resource in the same container. Classification uses evidenced rows; `need_data` applies when none is evidenced, or when the evidenced rows are in range but other rows cannot be judged. Missing CPU/memory delta fields mean zero net change or no eligible evidence; inspect rows to distinguish these. Ranking by the largest *proportional* change instead would put an unrequested 64Mi sidecar above the workload wasting two cores.
```

**VERIFICATION METHOD**:
Automated regression test asserting that input states reproducing defect `0de4c586` are properly handled with clean fallback behavior.


## 3. Independent Verification Protocol
1. Assert state existence before and after execution.
2. Verify deterministic SHA-256 byte digest parity.
3. Validate zero unhandled promise rejections or uncaught exceptions.
