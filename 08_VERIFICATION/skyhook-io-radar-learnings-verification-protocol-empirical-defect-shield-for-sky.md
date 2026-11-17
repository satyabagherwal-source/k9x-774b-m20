# Verification Protocol: Verification Protocol: Empirical Defect Shield for skyhook-io-radar-learnings

<!-- PROVENANCE_START
{
  "source_repository": "skyhook-io-radar-learnings",
  "source_url": "unknown",
  "source_version": "HEAD",
  "license": "Open-Source",
  "timestamp": "2026-11-17T03:26:27.842Z",
  "ai_provider": "universal-multi-artifact-distributor",
  "generator_version": "2.0.0-universal",
  "learning_id": "LEARN-EVO-skyhook-io-radar-learnings",
  "canonical_classification": "verification_contract"
}
PROVENANCE_END -->
> **Provenance**: Harvested from [skyhook-io-radar-learnings](unknown) (Revision: `HEAD`).  
> **License**: Open-Source | **Timestamp**: `2026-11-17T03:26:27.842Z`  
> **Learning ID**: `LEARN-EVO-skyhook-io-radar-learnings`


## 1. Scope & Verification Target
- **Target Repository**: `skyhook-io-radar-learnings` (Commit: `HEAD`)
- **Pillar Alignment**: Pillar 11 (Empirical Truth & Mathematical Integrity)

## 2. Observed Failure Modes & Defect Traps
> **Canonical Learning Artifact**: `07_PROJECT_LEARNING/skyhook-io-radar-learnings.md`  
> **Source**: github ([https://github.com/skyhook-io/radar](https://github.com/skyhook-io/radar))  
> **Source Version**: `2280c280`  
> **License**: Apache-2.0  
> **Synthesized By**: zero-clone-structural-synthesizer  
> **Timestamp**: 2026-11-17T03:26:15.695Z  
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
> **Harvest Timestamp**: 2026-11-17T03:26:15.688Z  
> **Compliance State**: Free Tier Guaranteed | Strict Rate-Limit Backoff Honored  

---

## 1. Context & Architectural Overview
- **Repository / Resource**: `skyhook-io/radar`
- **Description**: The missing open-source Kubernetes UI with a built-in MCP server for AI agents. See what's broken, why, and what changed. Issues, Topology, event timeline, Helm, GitOps, live service traffic, and cluster audits - all in one Go binary.
- **Primary Language / Ecosystem**: Go
- **Discovered Manifests / Configurations**: package.json, go.mod, README.md, Dockerfile
- **Stars / Engagement**: 4138 stars

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
- **Issue #2687** (2026-11-15): **Release Desktop workflow fails during Apple notarization due to missing/expired agreement**
  *Symptoms*: ## Describe the bug  The `Release Desktop` GitHub Actions workflow fails during the Apple notarization step for the macOS release artifact. The job reaches the notarization request, then exits with a 403 from Apple’s notarization service.  ## To reproduce  1. Trigger the `Release Desktop` workflow in `skyhook-io/radar` 2. Wait for the macOS build to finish packaging the app 3. Observe the workflow attempt to submit the artifact for Apple notarization 4. The job fails before finishing the release  ## Expected behavior  The release workflow should successfully submit the signed/notarized macOS artifact to Apple and complete the release process without failing.  ## Screenshots  Not applicable.  ## Diagnostics (optional)  N/A  ## Logs  ```text 2026-11-13T10:14:58.9407140Z Conducting pre-submission checks for radar-desktop_v1.20.3_darwin_universal.zip and initiating connection to the Apple notary service... 2026-11-13T10:15:00.9809290Z Error: HTTP status code: 403. A required agreement is missing or has expired. This request requires an in-effect agreement that has not been signed or has expired. Ensure your team has signed the necessary legal agreements and that they are not expired. 2026-11-13T10:15:00.9857090Z ##[error]Process completed with exit code 1. ```  ## Additional context  The workflow URL is: https://github.com/skyhook-io/radar/actions/runs/43406103414/job/131820798764  This appears to be an Apple Developer / notarization account issue rather than a code-level build f

- **Issue #2670** (2026-11-15): **Timeline: "spec changed (gen N→N+1, fields not specifically tracked)" for every Argo CD Application every few minutes**
  *Symptoms*: ## Describe the bug  The timeline shows "spec changed (gen N→N+1, fields not specifically tracked)" for every Argo CD Application every 2–3 minutes. Nothing in spec changed. The noise hides real events.  Argo CD Applications have no status subresource (argoproj/argo-cd#22967), so each status write (e.g. status.reconciledAt on every reconcile) bumps metadata.generation.  In internal/k8s/cache.go, generationBumpSignalsSpecChange() runs the generic check (genericDesiredState ignores metadata and status) only for kinds without an audited differ. Application has one (diffApplication in history.go), so the check is skipped and the function returns true for any generation bump.  ## To reproduce  1. Install Argo CD 3.6 with a few auto-synced Applications. 2. Install Radar (Helm chart 1.20.2, in-cluster, auth mode oidc). 3. Open the timeline and wait 5–10 minutes without changing anything.  ## Expected behavior  No "spec changed" event when only status/metadata changed, like for kinds without an audited differ. Possible fix: also compare genericDesiredState for audited unstructured kinds.  ## Screenshots  - Radar version: 1.20.2 - Kubernetes: 1.35.8 (kubeadm), Argo CD 3.6.1  <img width="1438" height="742" alt="2026-11-14_184927" src="https://github.com/user-attachments/assets/aff5c3ae-2e9e-468a-8b06-ce4051c041db" /> <img width="1441" height="744" alt="2026-11-14_184842" src="https://github.com/user-attachments/assets/200f14aa-f41c-4f3d-b5d0-bd80db87886a" /> <img width="1439" height="7

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

### Incident Patch 1: `c8f387b4` (2026-11-16)
**Commit Message**: Recover panics in MCP request handlers (#2745)

## Summary

A panic in any MCP tool handler ends the whole Radar process. The MCP
SDK runs each request in its own goroutine and doesn't recover panics,
while Radar's REST routes do. So the same bug that costs a REST caller
one failed request takes Radar down for everyone when an agent hits it
through MCP: every open browser, every SSE stream, every other agent.

This adds a receiving middleware to every Radar MCP server (the full,
read-only, apply and investigation servers all come from `newServer`).
When a handler panics:

- the stack is logged, with the method and tool name;
- a `tools/call` returns a tool error (`isError: true`), which is how
MCP reports a tool failure an agent can act on. The message points at
Radar's log and, since a write tool may have changed something before it
panicked, says to check resource state before retrying;
- any other method returns a JSON-RPC internal error (`-32603`);
- the server keeps answering.

## What changed

- `internal/mcp/recover.go`: `recoverMiddleware`.
- `internal/mcp/server.go`: installed first in `newServer`. The SDK
wraps each later middleware around the earlier ones, so this one si

**File**: `internal/mcp/recover.go` (added, +42/-0)
```diff
@@ -0,0 +1,42 @@
+package mcp
+
+import (
+	"context"
+	"log"
+	"runtime/debug"
+
+	"github.com/modelcontextprotocol/go-sdk/jsonrpc"
+	mcpsdk "github.com/modelcontextprotocol/go-sdk/mcp"
+)
+
+// recoverMiddleware turns a panic in a request handler into a failed request.
+// The SDK runs handlers in their own goroutines without recovering, so a panic
+// in any tool would otherwise end the whole Radar process; the REST routes
+// recover theirs. A tool call reports the failure as a tool error, which is
+// what an agent can act on; other methods return a JSON-RPC internal error.
+// Goroutines a handler starts itself are outside this and must recover their own.
+func recoverMiddleware(next mcpsdk.MethodHandler) mcpsdk.MethodHandler {
+	return func(ctx context.Context, method string, req mcpsdk.Request) (result mcpsdk.Result, err error) {
+		defer func() {
+			rec := recover()
+			if rec == nil {
+				return
+			}
+			name := method
+			if call, ok := req.(*mcpsdk.CallToolRequest); ok && call.Params != nil {
+				name = method + " " + call.Params.Name
+			}
+			log.Printf("[mcp] panic in %s: %v\n%s", name, rec, debug.Stack())
+			if method == "tools/call" {
+				result = &mcpsdk.CallToolResult{
+					IsError: true,
+					Content: []mcpsdk.Content{&mcpsdk.TextContent{Text: "Radar hit an internal error answering this tool call; details are in Radar's log. If the call could change resources, check their state before retrying."}},
+				}
+				err = nil
+				return
+			}
+			result, err = nil, &jsonrpc.Error{Code: jsonrpc.CodeInternalError, Message: "internal error handling " + method}
+		}()
+		return next(ctx, method, req)
+	}
+}
```

**File**: `internal/mcp/recover_test.go` (added, +57/-0)
```diff
@@ -0,0 +1,57 @@
+package mcp
+
+import (
+	"context"
+	"strings"
+	"testing"
+
+	mcpsdk "github.com/modelcontextprotocol/go-sdk/mcp"
+)
+
+// A panicking tool fails its own call and leaves Radar's MCP server answering.
+func TestToolPanicFailsTheCallNotTheServer(t *testing.T) {
+	ctx := context.Background()
+	server := newServer(false, false, "")
+	calls := 0
+	server.AddTool(&mcpsdk.Tool{Name: "boom", InputSchema: map[string]any{"type": "object"}}, func(context.Context, *mcpsdk.CallToolRequest) (*mcpsdk.CallToolResult, error) {
+		calls++
+		var m map[string]any
+		_ = m["pods"].([]map[string]any)
+		return nil, nil
+	})
+	server.AddTool(&mcpsdk.Tool{Name: "ok", InputSchema: map[string]any{"type": "object"}}, func(context.Context, *mcpsdk.CallToolRequest) (*mcpsdk.CallToolResult, error) {
+		return &mcpsdk.CallToolResult{Content: []mcpsdk.Content{&mcpsdk.TextContent{Text: "fine"}}}, nil
+	})
+	client := mcpsdk.NewClient(&mcpsdk.Implementation{Name: "test", Version: "test"}, nil)
+	st, ct := mcpsdk.NewInMemoryTransports()
+	ss, err := server.Connect(ctx, st, nil)
+	if err != nil {
+		t.Fatal(err)
+	}
+	cs, err := client.Connect(ctx, ct, nil)
+	if err != nil {
+		t.Fatal(err)
+	}
+	t.Cleanup(func() { _ = cs.Close(); _ = ss.Wait() })
+	for i := range 2 {
+		res, err := cs.CallTool(ctx, &mcpsdk.CallToolParams{Name: "boom"})
+		if err != nil {
+			t.Fatalf("call %d: %v", i, err)
+		}
+		text := ""
+		if len(res.Content) == 1 {
+			if c, ok := res.Content[0].(*mcpsdk.TextContent); ok {
+				text = c.Text
+			}
+		}
+		if !res.IsError || !strings.Contains(text, "internal error") {
+			t.Fatalf("call %d: result = %+v", i, res)
+		}
+	}
+	if calls != 2 {
+		t.Fatalf("tool ran %d times, want 2", calls)
+	}
+	if res, err := cs.CallTool(ctx, &mcpsdk.CallToolParams{Name: "ok"}); err != nil || res.IsError {
+		t.Fatalf("a normal call after the panics: %+v, %v", res, err)
+	}
+}
```

**File**: `internal/mcp/server.go` (modified, +2/-0)
```diff
@@ -30,6 +30,8 @@ func newServer(includeWrites, includeExec bool, instructions string) *mcpsdk.Ser
 		},
 	)
 
+	server.AddReceivingMiddleware(recoverMiddleware)
+
 	// Repair recognisable argument-name mistakes before schema validation, and
 	// report the accepted argument names when validation still fails. Every tool
 	// schema is additionalProperties:false, so without this one wrong argument
```

---

### Incident Patch 2: `58462cf5` (2026-11-16)
**Commit Message**: fix(ui): readable status banners in light mode (#2705)

## Summary

Status banners were hard to read in light mode. The banner at the top of
a generic resource's drawer (any custom resource without a curated
renderer) used raw Tailwind `-400` hues on a 10% tint: `text-yellow-400`
on pale yellow reads at about 1.5:1, well under the 4.5:1 small text
needs, so a degraded status like "Pending" nearly disappeared. And in
every `AlertBanner`, the 12px message line that says *why* a resource is
in its state used the variant's tint at 80% opacity, about 2.5–3.8:1 on
the light backgrounds. Dark mode was fine, which is how both slipped
through.

## What changed

- **The generic banner renders through the shared `AlertBanner`**, which
carries light and dark pairs for each tone and is what DESIGN.md asks
problem surfaces to use. Each health level maps straight to a variant:
healthy → success, degraded → warning, **alert → the orange alert
variant** (it used to fold into red, losing Radar's three-step degraded
→ alert → unhealthy gradient), unhealthy → error, neutral and unknown →
unknown. Icons stay the same except for alert, which shows AlertCircle
instead of the XCircle it borrowed from unhe

**File**: `packages/k8s-ui/src/components/resources/renderers/GenericRenderer.banner.test.tsx` (added, +42/-0)
```diff
@@ -0,0 +1,42 @@
+import { describe, expect, it } from 'vitest'
+import { renderToString } from 'react-dom/server'
+import { GenericRenderer } from './GenericRenderer'
+import { AlertBanner } from '../../ui/drawer-components'
+
+const widget = (status: Record<string, unknown>) => ({
+  apiVersion: 'example.com/v1', kind: 'Widget', metadata: { name: 'w' }, status,
+})
+
+// The status banner uses the shared AlertBanner's light and dark pairs: a raw
+// -400 hue reads at roughly 1.5:1 on a light tint.
+describe('GenericRenderer status banner', () => {
+  it.each([
+    ['healthy', { conditions: [{ type: 'Ready', status: 'True' }] }, 'text-emerald-700'],
+    ['degraded', { phase: 'Pending' }, 'text-amber-700'],
+    ['unhealthy', { conditions: [{ type: 'Ready', status: 'False' }] }, 'text-red-700'],
+  ])('%s uses theme-paired colors', (_, status, titleClass) => {
+    const html = renderToString(<GenericRenderer data={widget(status)} />)
+    const banner = html.slice(0, html.indexOf('</div></div></div>'))
+    expect(banner).toContain(titleClass)
+    expect(banner).not.toMatch(/text-(yellow|green|red|slate)-400/)
+  })
+
+  it('keeps the detail line in neutral text, readable on every tint', () => {
+    const html = renderToString(<GenericRenderer data={widget({ conditions: [{ type: 'Ready', status: 'False', reason: 'BackendDown', message: 'the backend is down' }] })} />)
+    expect(html).toMatch(/<div class="[^"]*text-theme-text-secondary[^"]*">the backend is down</)
+    expect(html).not.toMatch(/text-red-600\/80/)
+  })
+
+  it('keeps every variant\'s message line neutral, alert included', () => {
+    for (const variant of ['error', 'warning', 'info', 'success', 'alert'] as const) {
+      const html = renderToString(<AlertBanner variant={variant} title="t" message="why" />)
+      expect(html).toMatch(/<div class="[^"]*text-theme-text-secondary[^"]*">why</)
+    }
+  })
+
+  it('renders no detail line when the status has no message', () => {
+    const html = renderToString(<GenericRenderer data={widget({ conditions: [{ type: 'Ready', status: 'True' }] })} />)
+    const banner = html.slice(0, html.indexOf('</div></div></div>'))
+    expect(banner).not.toContain('text-theme-text-secondary')
+  })
+})
```

**File**: `packages/k8s-ui/src/components/resources/renderers/GenericRenderer.conditions.test.tsx` (modified, +3/-3)
```diff
@@ -102,7 +102,7 @@ describe('GenericRenderer conditions', () => {
     const html = render([cond('InvalidRolloutConfig', 'False'), cond('RolloutProgressing', 'False')], appSet)
     expect(chipClass(html, 'InvalidRolloutConfig', 'False')).not.toContain('status-red')
     expect(chipClass(html, 'RolloutProgressing', 'False')).not.toContain('status-red')
-    expect(html).not.toContain('bg-red-500/10')
+    expect(html).not.toContain('bg-red-50 ')
   })
 
   it("doesn't color a healthy service's Stopped=False red", () => {
@@ -113,15 +113,15 @@ describe('GenericRenderer conditions', () => {
   it('shows a deliberately stopped model as stopped, not failed', () => {
     const html = render([cond('Stopped', 'True'), { type: 'Ready', status: 'False', reason: 'Stopped' }], stopRequested)
     expect(html).toContain("This model is stopped and isn&#x27;t serving requests.")
-    expect(html).not.toContain('bg-red-500/10')
+    expect(html).not.toContain('bg-red-50 ')
     expect(chipClass(html, 'Ready', 'False')).not.toContain('status-red')
   })
 
   it("doesn't call a failed resume stopped", () => {
     const html = render([cond('Stopped', 'True'), { type: 'PredictorReady', status: 'False', reason: 'ReconcileFailed' }, { type: 'Ready', status: 'False', reason: 'Stopped' }], stopRequested)
     expect(html).not.toContain('isn&#x27;t serving requests')
     expect(html).toContain('ReconcileFailed')
-    expect(html).toContain('bg-red-500/10')
+    expect(html).toContain('bg-red-50 ')
     expect(chipClass(html, 'PredictorReady', 'False')).toContain('status-red')
   })
 
```

**File**: `packages/k8s-ui/src/components/resources/renderers/GenericRenderer.tsx` (modified, +27/-41)
```diff
@@ -1,7 +1,7 @@
 import { useState } from 'react'
 import { Info, CheckCircle, XCircle, AlertCircle, FileCode, AlertTriangle, Layers, Minus } from 'lucide-react'
 import { clsx } from 'clsx'
-import { Section, PropertyList, Property, isInvertedPolarityCondition } from '../../ui/drawer-components'
+import { AlertBanner, Section, PropertyList, Property, isInvertedPolarityCondition } from '../../ui/drawer-components'
 import { Collapse, CollapseChevron, useDisclosure } from '../../ui/Collapse'
 import { getGenericResourceStatus } from '../generic-status'
 import { isApiGroup } from '../resource-utils-cnpg'
@@ -40,32 +40,12 @@ export function GenericRenderer({ data }: GenericRendererProps) {
       {acknowledgedPause && <CrossplanePauseNotice data={data} />}
       {/* Health Status Banner (if determinable) */}
       {healthStatus && (
-        <div className={clsx(
-          'mb-4 p-3 rounded-lg border flex items-center gap-3',
-          healthStatus.type === 'healthy' && 'bg-green-500/10 border-green-500/30',
-          healthStatus.type === 'degraded' && 'bg-yellow-500/10 border-yellow-500/30',
-          healthStatus.type === 'unhealthy' && 'bg-red-500/10 border-red-500/30',
-          healthStatus.type === 'unknown' && 'bg-slate-500/10 border-slate-500/30'
-        )}>
-          {healthStatus.type === 'healthy' && <CheckCircle className="w-5 h-5 text-green-400 shrink-0" />}
-          {healthStatus.type === 'degraded' && <AlertCircle className="w-5 h-5 text-yellow-400 shrink-0" />}
-          {healthStatus.type === 'unhealthy' && <XCircle className="w-5 h-5 text-red-400 shrink-0" />}
-          {healthStatus.type === 'unknown' && <Info className="w-5 h-5 text-slate-400 shrink-0" />}
-          <div>
-            <div className={clsx(
-              'text-sm font-medium',
-              healthStatus.type === 'healthy' && 'text-green-400',
-              healthStatus.type === 'degraded' && 'text-yellow-400',
-              healthStatus.type === 'unhealthy' && 'text-red-400',
-              healthStatus.type === 'unknown' && 'text-slate-400'
-            )}>
-              {healthStatus.label}
-            </div>
-            {healthStatus.message && (
-              <div className="text-xs text-theme-text-secondary mt-0.5">{healthStatus.message}</div>
-            )}
-          </div>
-        </div>
+        <AlertBanner
+          variant={BANNER_VARIANT[healthStatus.level]}
+          icon={BANNER_ICON[healthStatus.level]}
+          title={healthStatus.label}
+          message={healthStatus.message}
+        />
       )}
 
       {/* Empty state hint */}
@@ -139,36 +119,42 @@ export function GenericRenderer({ data }: GenericRendererProps) {
 // HEALTH STATUS DETECTION
 // ============================================================================
 
-type HealthType = 'healthy' | 'degraded' | 'unhealthy' | 'unknown'
-
 interface HealthStatusResult {
-  type: HealthType
+  level: HealthLevel
   label: string
   message?: string
 }
 
-// This renderer's banner has four tones, while the shared derivation speaks the
-// full HealthLevel vocabulary. `alert` folds into unhealthy and `neutral` into
-// unknown — the banner has no distinct treatment for either.
-const BANNER_TYPE: Record<HealthLevel, HealthType> = {
-  healthy: 'healthy',
-  degraded: 'degraded',
-  alert: 'unhealthy',
-  unhealthy: 'unhealthy',
+// The shared banner carries light and dark pairs for each tone. `alert` keeps
+// its own orange step between degraded and unhealthy; `neutral` reads like
+// unknown.
+const BANNER_VARIANT = {
+  healthy: 'success',
+  degraded: 'warning',
+  alert: 'alert',
+  unhealthy: 'error',
   neutral: 'unknown',
   unknown: 'unknown',
+} as const satisfies Record<HealthLevel, string>
+const BANNER_ICON: Record<HealthLevel, typeof Info> = {
+  healthy: CheckCircle,
+  degraded: AlertCircle,
+  alert: AlertCircle,
+  unhealthy: XCircle,
+  neutral: Info,
+  unknown: Info,
 }
 
 function getHealthStatus(resource: any): HealthStatusResult | null {
   if (resource?.kind === 'InferenceService' && isApiGroup(resource?.apiVersion, 'serving.kserve.io') && isInferenceServiceStopRequested(resource)) {
     const status = getInferenceServiceStatus(resource)
-    if (status.level === 'neutral') return { type: 'unknown', label: 'Stopped', message: "This model is stopped and isn't serving requests." }
-    return { type: BANNER_TYPE[status.level], label: status.text }
+    if (status.level === 'neutral') return { level: 'neutral', label: 'Stopped', message: "This model is stopped and isn't serving requests." }
+    return { level: status.level, label: status.text }
   }
   const acknowledgedPause = getCrossplanePauseState(resource) === 'acknowledged'
   const derived = acknowledgedPause ? getCrossplaneIndependentStatus(resource) : getGenericResourceStatus(resource)
   if (!derived || (acknowledgedPause && derived.tone === 'healthy')) return null
-  return { type: BANNER_TYPE[derived.tone], label: derived.text, message: 
```

**File**: `packages/k8s-ui/src/components/ui/drawer-components.tsx` (modified, +7/-5)
```diff
@@ -398,13 +398,15 @@ export function ConditionsSection({
 // ALERT BANNER
 // ============================================================================
 
+// The message line is 12px body text, so it uses the neutral secondary tone:
+// the variants' tinted tones fall below 4.5:1 on their light backgrounds.
 const ALERT_COLORS = {
-  alert:   { bg: 'status-alert', border: '', title: '', message: '', list: '', bullet: '' },
+  alert:   { bg: 'status-alert', border: '', title: '', message: 'text-theme-text-secondary', list: '', bullet: '' },
   unknown: { bg: 'status-unknown', border: '', title: '', message: '', list: '', bullet: '' },
-  error:   { bg: 'bg-red-50 dark:bg-red-950/30', border: 'border-red-200 dark:border-red-800/30', title: 'text-red-700 dark:text-red-300', message: 'text-red-600/80 dark:text-red-300/70', list: 'text-red-600 dark:text-red-400', bullet: 'text-red-400/60 dark:text-red-400/50' },
-  warning: { bg: 'bg-amber-50 dark:bg-amber-950/30', border: 'border-amber-200 dark:border-amber-800/30', title: 'text-amber-700 dark:text-amber-300', message: 'text-amber-600/80 dark:text-amber-300/70', list: 'text-amber-600 dark:text-amber-400', bullet: 'text-amber-400/60 dark:text-amber-400/50' },
-  info:    { bg: 'bg-sky-50 dark:bg-sky-950/30', border: 'border-sky-200 dark:border-sky-800/30', title: 'text-sky-700 dark:text-sky-300', message: 'text-sky-600/80 dark:text-sky-300/70', list: 'text-sky-600 dark:text-sky-400', bullet: 'text-sky-400/60 dark:text-sky-400/50' },
-  success: { bg: 'bg-emerald-50 dark:bg-emerald-950/30', border: 'border-emerald-200 dark:border-emerald-800/30', title: 'text-emerald-700 dark:text-emerald-300', message: 'text-emerald-600/80 dark:text-emerald-300/70', list: 'text-emerald-600 dark:text-emerald-400', bullet: 'text-emerald-400/60 dark:text-emerald-400/50' },
+  error:   { bg: 'bg-red-50 dark:bg-red-950/30', border: 'border-red-200 dark:border-red-800/30', title: 'text-red-700 dark:text-red-300', message: 'text-theme-text-secondary', list: 'text-red-600 dark:text-red-400', bullet: 'text-red-400/60 dark:text-red-400/50' },
+  warning: { bg: 'bg-amber-50 dark:bg-amber-950/30', border: 'border-amber-200 dark:border-amber-800/30', title: 'text-amber-700 dark:text-amber-300', message: 'text-theme-text-secondary', list: 'text-amber-600 dark:text-amber-400', bullet: 'text-amber-400/60 dark:text-amber-400/50' },
+  info:    { bg: 'bg-sky-50 dark:bg-sky-950/30', border: 'border-sky-200 dark:border-sky-800/30', title: 'text-sky-700 dark:text-sky-300', message: 'text-theme-text-secondary', list: 'text-sky-600 dark:text-sky-400', bullet: 'text-sky-400/60 dark:text-sky-400/50' },
+  success: { bg: 'bg-emerald-50 dark:bg-emerald-950/30', border: 'border-emerald-200 dark:border-emerald-800/30', title: 'text-emerald-700 dark:text-emerald-300', message: 'text-theme-text-secondary', list: 'text-emerald-600 dark:text-emerald-400', bullet: 'text-emerald-400/60 dark:text-emerald-400/50' },
 } as const
 
 const DEFAULT_ICONS: Record<string, React.ComponentType<{ className?: string }>> = {
```

---

### Incident Patch 3: `b7e1536d` (2026-11-16)
**Commit Message**: fix(traffic): show Data per protocol and label byte-only edges with their throughput (#2744)

## Summary

In Istio ambient, a sidecar or ingress client calling an ambient
workload with no waypoint is reported twice: the calling proxy reports
HTTP (request and response body bytes, request and error rates) and
ztunnel reports the connection's TCP bytes. Radar added both into one
Data figure, so that edge, its nodes and the connections table showed a
number no proxy measured. #2733 kept both measurements and flagged the
sum with a "Data may double-count" chip. This removes the sum instead:
every Data figure on the map is per protocol, and bytes are never added
across protocols.

## What changed

**Per-protocol bytes on each aggregate** (`pkg/traffic`).
`AggregatedFlow` gains `bytesByProtocol`, keyed by each flow's protocol
as the source emits it (`http`, `grpc`, `tcp`, `udp`, …), with every
observed protocol present. Aggregation identity, rates, latency and L7
voting are unchanged. `bytesSent`/`bytesRecv` stay on the wire as the
cross-protocol sum for compatibility, documented as not to be shown as
one figure when more than one protocol is present.

**One edge, figures per protocol** 

**File**: `docs/integrations.md` (modified, +2/-2)
```diff
@@ -852,10 +852,10 @@ permits the reference or has produced an artifact.
 
 Service links accept short names in the rule's namespace or full `name.namespace.svc.<domain>` names. Radar reads a unique registry domain from standard observed Istiod Deployments' `--domain` argument, using Istio's `cluster.local` default when no override is observed. Conflicting or unresolved control-plane arguments leave FQDN links unresolved. External control planes and nonstandard launch configurations may therefore need additional domain discovery; arbitrary dotted hosts are not treated as local Services.
 
-**Live Traffic:** the Traffic view reads Istio's standard Prometheus metrics: `istio_requests_total` (with its 5xx rate and request/response bytes) for HTTP and gRPC edges, and `istio_tcp_received_bytes_total` / `istio_tcp_sent_bytes_total` for TCP edges, as rates over the view's time range (5 minutes when it is under a minute). A rate needs two samples per series, so a range shorter than two scrape intervals shows no traffic; the map then says to choose a longer range. TCP edges appear whenever bytes move in the view's range, including on long-lived connections, and show data volume (byte rates × the window) with no request rate. Radar reads the receiving side's report: the destination sidecar (`reporter="destination"`) or, in ambient mode, the destination's waypoint proxy (`reporter="waypoint"`). It never adds the receiving and calling sides' reports together. In ambient mode:
+**Live Traffic:** the Traffic view reads Istio's standard Prometheus metrics: `istio_requests_total` (with its 5xx rate and request/response bytes) for HTTP and gRPC edges, and `istio_tcp_received_bytes_total` / `istio_tcp_sent_bytes_total` for TCP edges, as rates over the view's time range (5 minutes when it is under a minute). A rate needs two samples per series, so a range shorter than two scrape intervals shows no traffic; the map then says to choose a longer range. TCP edges appear whenever bytes move in the view's range, including on long-lived connections, and show data volume (byte rates × the window) with no request rate; on the map, an edge with no request rate is labelled with its throughput per protocol (for example `TCP · 2.4 KB/s`); against an older Radar that sends no per-protocol breakdown those labels stay empty. Radar reads the receiving side's report: the destination sidecar (`reporter="destination"`) or, in ambient mode, the destination's waypoint proxy (`reporter="waypoint"`). It never adds the receiving and calling sides' reports together. In ambient mode:
 - Workloads behind a waypoint get HTTP and gRPC edges from the waypoint's metrics. ztunnel also reports the hops into and out of the waypoint. Radar recognizes waypoint Deployments by their labels, as Kiali does (`gateway.istio.io/managed=istio.io-mesh-controller`, or, without that label, a `gateway.networking.k8s.io/gateway-name` containing "waypoint"), and leaves those hops out, so the map draws client → server without the proxy in between. If Radar cannot list Deployments, it cannot recognize waypoints and the hops stay on the map.
 - A request into an ambient namespace (labeled `istio.io/dataplane-mode=ambient`) that no waypoint reported, such as an ingress gateway or sidecar calling a workload with no waypoint, is read from the calling proxy's report (`reporter="source"`), as Kiali does. Those figures are used only when the receiving side counted none of that client's requests to the same workload, Service and protocol in the view's time range. When it counted some, its figures are used, so requests that skipped the waypoint are not counted. Radar finds ambient namespaces from its Namespace cache; without it, these reports are not read and the ztunnel check below is off. The query names every ambient namespace and is sent in a POST body; when the namespaces are too many to fit Radar's 16 KB query limit (several hundred, depending on name length), Radar skips these reports and the map says so.
-- Traffic between ambient workloads without a waypoint has no L7 metrics. It appears as TCP edges from ztunnel. When a call's HTTP figures come from the calling proxy (no waypoint or sidecar received it) and ztunnel reports TCP between the same workloads, Data includes both the HTTP bytes and ztunnel's TCP bytes, and the map notes that these may count the same calls twice.
+- Traffic between ambient workloads without a waypoint has no L7 metrics. It appears as TCP edges from ztunnel. When a call's HTTP figures come from the calling proxy (no waypoint or sidecar received it) and ztunnel reports TCP between the same workloads, Data shows HTTP payload bytes and ztunnel TCP connection bytes side by side by protocol. These measurements can describe the same calls and are never added together.
 - Prometheus has to scrape ztunnel and the waypoint proxies. When the view includes ambient traffic but Radar finds no ztunnel metrics (no `istio_build{component="ztunnel"}` series and no ztun
```

**File**: `internal/server/traffic_data_note_test.go` (removed, +0/-63)
```diff
@@ -1,63 +0,0 @@
-package server
-
-import (
-	"encoding/json"
-	"net/http"
-	"net/http/httptest"
-	"testing"
-
-	"github.com/skyhook-io/radar/pkg/traffic"
-)
-
-func TestTrafficPayloadDataNote(t *testing.T) {
-	for name, payload := range map[string]func(*traffic.FlowsResponse, []traffic.Flow) map[string]any{
-		"flows": func(response *traffic.FlowsResponse, flows []traffic.Flow) map[string]any {
-			return trafficFlowsPayload(response, flows, false)
-		},
-		"records": trafficRecordsPayload,
-	} {
-		t.Run(name, func(t *testing.T) {
-			flows := []traffic.Flow{
-				{Source: traffic.Endpoint{Namespace: "a"}},
-				{Source: traffic.Endpoint{Namespace: "b"}},
-			}
-			for _, tc := range []struct {
-				name       string
-				note       string
-				namespaces []string
-				source     []traffic.Flow
-				wantNote   bool
-			}{
-				{"carried through", "Reported bytes may overlap.", nil, flows, true},
-				{"all filtered away", "Reported bytes may overlap.", []string{"c"}, flows, false},
-				{"some remain", "Reported bytes may overlap.", []string{"a"}, flows, true},
-				{"source returned none", "Reported bytes may overlap.", nil, nil, true},
-				{"absent", "", nil, flows, false},
-			} {
-				t.Run(tc.name, func(t *testing.T) {
-					response := &traffic.FlowsResponse{Flows: tc.source, DataNote: tc.note}
-					s := &Server{}
-					r := httptest.NewRequest(http.MethodGet, "/", nil)
-					visible := s.visibleFlows(r, response.Flows, tc.namespaces, traffic.DefaultFlowOptions())
-					encoded, err := json.Marshal(payload(response, visible))
-					if err != nil {
-						t.Fatal(err)
-					}
-					var decoded map[string]any
-					if err := json.Unmarshal(encoded, &decoded); err != nil {
-						t.Fatal(err)
-					}
-					note, present := decoded["dataNote"]
-					if present != tc.wantNote || present && note != tc.note {
-						t.Errorf("dataNote = %v (present %v), want %q (present %v)", note, present, tc.note, tc.wantNote)
-					}
-					for _, field := range []string{"warning", "warningKind"} {
-						if _, present := decoded[field]; present {
-							t.Errorf("a data note must not set %s", field)
-						}
-					}
-				})
-			}
-		})
-	}
-}
```

**File**: `internal/server/traffic_handlers.go` (modified, +0/-8)
```diff
@@ -292,7 +292,6 @@ func trafficFlowsPayload(response *traffic.FlowsResponse, flows []traffic.Flow,
 	}
 	addFlowsCoverage(result, response)
 	addFlowsWarning(result, response, flows)
-	addFlowsDataNote(result, response, flows)
 	return result
 }
 
@@ -309,12 +308,6 @@ func addFlowsCoverage(result map[string]any, response *traffic.FlowsResponse) {
 	}
 }
 
-func addFlowsDataNote(result map[string]any, response *traffic.FlowsResponse, flows []traffic.Flow) {
-	if response.DataNote != "" && !(len(flows) == 0 && len(response.Flows) > 0) {
-		result["dataNote"] = response.DataNote
-	}
-}
-
 func addFlowsWarning(result map[string]any, response *traffic.FlowsResponse, flows []traffic.Flow) {
 
 	// A partial-data warning qualifies the flows it came with. If the namespace
@@ -413,7 +406,6 @@ func trafficRecordsPayload(response *traffic.FlowsResponse, flows []traffic.Flow
 	}
 	addFlowsCoverage(result, response)
 	addFlowsWarning(result, response, flows)
-	addFlowsDataNote(result, response, flows)
 	return result
 }
 
```

**File**: `internal/traffic/beyla_test.go` (modified, +30/-0)
```diff
@@ -1851,3 +1851,33 @@ func TestBeylaSource_GetFlows_FailedEnrichmentIsReportedNotZeroed(t *testing.T)
 		})
 	}
 }
+
+func TestBeylaSource_GetFlows_UnorientedProtocolBytes(t *testing.T) {
+	src := &BeylaSource{k8sClient: fake.NewSimpleClientset()}
+	src.queryFn = func(_ context.Context, query string) (*prom.QueryResult, error) {
+		if !strings.Contains(query, `direction="unknown"`) {
+			return emptyResult(), nil
+		}
+		return promResult("vector",
+			promSeries(map[string]string{"k8s_src_owner_name": "client", "k8s_src_namespace": "demo", "k8s_dst_owner_name": "dns", "k8s_dst_namespace": "demo", "transport": "UDP"}, 10),
+			promSeries(map[string]string{"k8s_src_owner_name": "dns", "k8s_src_namespace": "demo", "k8s_dst_owner_name": "client", "k8s_dst_namespace": "demo", "transport": "UDP"}, 25),
+			promSeries(map[string]string{"k8s_src_owner_name": "client", "k8s_src_namespace": "demo", "k8s_dst_owner_name": "dns", "k8s_dst_namespace": "demo", "transport": "TCP"}, 4),
+		), nil
+	}
+	resp, err := src.GetFlows(t.Context(), FlowOptions{})
+	if err != nil {
+		t.Fatal(err)
+	}
+	aggregated := AggregateFlows(resp.Flows)
+	if len(resp.Flows) != 2 || len(aggregated) != 1 {
+		t.Fatalf("flows=%+v, aggregates=%+v", resp.Flows, aggregated)
+	}
+	a := aggregated[0]
+	if !a.DirectionUnknown || len(a.BytesByProtocol) != 2 {
+		t.Fatalf("wrong conversation: %+v", a)
+	}
+	udp, tcp := a.BytesByProtocol["udp"], a.BytesByProtocol["tcp"]
+	if udp.BytesSent != 10*defaultRateWindowSeconds || udp.BytesRecv != 25*defaultRateWindowSeconds || tcp.BytesSent != 4*defaultRateWindowSeconds || tcp.BytesRecv != 0 {
+		t.Errorf("protocol buckets: %+v", a.BytesByProtocol)
+	}
+}
```

**File**: `internal/traffic/istio.go` (modified, +4/-26)
```diff
@@ -333,19 +333,11 @@ func (s *IstioSource) GetFlows(ctx context.Context, opts FlowOptions) (*FlowsRes
 	httpCount := len(httpFlows)
 	tcpFlows, tcpErr := []Flow(nil), errIstioTCPUnchecked
 	ztunnelReported := false
-	byteOverlap := false
 	if !scopes.tcpUnchecked {
 		var reportedInto []string
-		var destinationTCP map[flowKey]bool
-		tcpFlows, reportedInto, destinationTCP, tcpErr = s.queryTCPFlows(ctx, opts, scopes.tcp)
+		tcpFlows, reportedInto, tcpErr = s.queryTCPFlows(ctx, opts, scopes.tcp)
 		ztunnelReported = slices.ContainsFunc(reportedInto, func(ns string) bool { return slices.Contains(ambientKnown, ns) })
 		tcpFlows = withoutWaypointHops(tcpFlows, waypoints)
-		if tcpErr == nil {
-			byteOverlap = slices.ContainsFunc(httpFlows, func(f Flow) bool {
-				return f.BytesSent+f.BytesRecv > 0 && slices.Contains(ambientNamespaces, f.Destination.Namespace) &&
-					destinationTCP[workloadPairOf(f)] && !opts.Excludes(f) && opts.Match.Matches(f)
-			})
-		}
 	}
 	if tcpErr != nil {
 		log.Printf("[istio] Error querying TCP flows (continuing with HTTP only): %v", tcpErr)
@@ -378,9 +370,6 @@ func (s *IstioSource) GetFlows(ctx context.Context, opts FlowOptions) (*FlowsRes
 			response.WarningKind = WarningTransient
 		}
 	}
-	if byteOverlap {
-		noteIstioByteOverlap(response)
-	}
 	mismatch := ""
 	switch {
 	case len(httpFlows) == 0:
@@ -611,12 +600,6 @@ func (s *IstioSource) queryHTTPSeriesRates(ctx context.Context, query string) (m
 	return rates, nil
 }
 
-const istioByteOverlapNote = "Data on some edges may count the same calls twice: when no waypoint receives a call into an ambient workload, Radar can show both the calling proxy's HTTP bytes and ztunnel's TCP bytes."
-
-func noteIstioByteOverlap(response *FlowsResponse) {
-	response.DataNote = istioByteOverlapNote
-}
-
 // queryHTTPFlows queries istio_requests_total for HTTP/gRPC traffic.
 // Response codes are aggregated (not split per-code) and a separate error query
 // provides 5xx error rates per series. Optional figures that cannot be read are
@@ -726,8 +709,7 @@ func (s *IstioSource) queryHTTPFlows(ctx context.Context, opts FlowOptions, sc c
 // queryTCPFlows reads TCP traffic from istio_tcp_received_bytes_total and
 // istio_tcp_sent_bytes_total. reportedInto includes idle series: their presence
 // still shows the reporting proxy is scraped even when no bytes moved.
-// destinationTCP holds the workload pairs whose wire bytes may also cover HTTP.
-func (s *IstioSource) queryTCPFlows(ctx context.Context, opts FlowOptions, sc clusterScope) (flows []Flow, reportedInto []string, destinationTCP map[flowKey]bool, err error) {
+func (s *IstioSource) queryTCPFlows(ctx context.Context, opts FlowOptions, sc clusterScope) (flows []Flow, reportedInto []string, err error) {
 	w := rateWindowFor(opts.Since)
 	const groupBy = "source_workload, source_workload_namespace, destination_workload, destination_workload_namespace, destination_service_name, reporter"
 	type tcpSeriesKey struct {
@@ -741,7 +723,7 @@ func (s *IstioSource) queryTCPFlows(ctx context.Context, opts FlowOptions, sc cl
 	for direction, metric := range []string{istioTCPMetric, "istio_tcp_sent_bytes_total"} {
 		result, err := s.queryFn(ctx, istioRateQuery(groupBy, metric, istioReporterSelector, opts.Namespace, sc, w))
 		if err != nil {
-			return nil, nil, nil, err
+			return nil, nil, err
 		}
 		for _, series := range result.Series {
 			reportedInto = append(reportedInto, series.Labels["destination_workload_namespace"])
@@ -758,13 +740,9 @@ func (s *IstioSource) queryTCPFlows(ctx context.Context, opts FlowOptions, sc cl
 		}
 	}
 
-	destinationTCP = make(map[flowKey]bool)
 	flows = make([]Flow, 0, len(keys))
 	for _, key := range keys {
 		volume := volumes[key]
-		if key.reporter == "destination" {
-			destinationTCP[key.flowKey] = true
-		}
 		flow := Flow{
 			Source: Endpoint{
 				Name: key.srcWorkload, Namespace: key.srcNs,
@@ -795,7 +773,7 @@ func (s *IstioSource) queryTCPFlows(ctx context.Context, opts FlowOptions, sc cl
 		}
 		flows = append(flows, flow)
 	}
-	return flows, reportedInto, destinationTCP, nil
+	return flows, reportedInto, nil
 }
 
 // StreamFlows returns a channel of flows for real-time updates
```

**File**: `internal/traffic/istio_ambient.go` (modified, +0/-10)
```diff
@@ -108,13 +108,3 @@ func withoutWaypointHops(flows []Flow, waypoints map[istioWorkload]bool) []Flow
 	}
 	return kept
 }
-
-// workloadPairOf keys a flow by its workloads alone. ztunnel infers the Service
-// of plaintext traffic from the target port, so its label can differ from the
-// calling proxy's for the same calls, and edges are merged by workloads anyway.
-func workloadPairOf(f Flow) flowKey {
-	return flowKey{
-		srcWorkload: f.Source.Workload, srcNs: f.Source.Namespace,
-		dstWorkload: f.Destination.Workload, dstNs: f.Destination.Namespace,
-	}
-}
```

**File**: `internal/traffic/istio_tcp_test.go` (modified, +18/-32)
```diff
@@ -8,6 +8,7 @@ import (
 	"time"
 
 	"github.com/skyhook-io/radar/pkg/prom"
+	"github.com/skyhook-io/radar/pkg/traffic"
 )
 
 func TestIstioTCPByteActivity(t *testing.T) {
@@ -68,22 +69,22 @@ func TestIstioAmbientHTTPByteOverlap(t *testing.T) {
 	for _, tc := range []struct {
 		name, dstNs, tcpService, tcpSource, tcpSourceNs, tcpDestination string
 		httpReporter, tcpReporter                                       string
-		zeroHTTPBytes, wantOverlap, missingErrors, failTCP              bool
+		zeroHTTPBytes, missingErrors, failTCP                           bool
 		excludeClient, selectOther                                      bool
 	}{
-		{name: "ambient same Service", wantOverlap: true},
+		{name: "ambient same Service"},
 		{name: "waypoint same Service", httpReporter: "waypoint", tcpReporter: "waypoint"},
 		{name: "sidecar same Service", dstNs: "side", httpReporter: "destination"},
-		{name: "sidecar in an ambient namespace, same Service", httpReporter: "destination", wantOverlap: true},
-		{name: "ambient other Service", tcpService: "db", wantOverlap: true},
-		{name: "ambient unknown Service", tcpService: "unknown", wantOverlap: true},
+		{name: "sidecar in an ambient namespace, same Service", httpReporter: "destination"},
+		{name: "ambient other Service", tcpService: "db"},
+		{name: "ambient unknown Service", tcpService: "unknown"},
 		{name: "ambient pair excluded from the view", excludeClient: true},
 		{name: "ambient pair not in the selection", selectOther: true},
 		{name: "ambient other source", tcpSource: "other"},
 		{name: "ambient other source namespace", tcpSourceNs: "other"},
 		{name: "ambient other destination", tcpDestination: "other"},
 		{name: "ambient zero HTTP bytes", zeroHTTPBytes: true},
-		{name: "ambient missing errors", missingErrors: true, wantOverlap: true},
+		{name: "ambient missing errors", missingErrors: true},
 		{name: "ambient failed TCP read", failTCP: true},
 	} {
 		t.Run(tc.name, func(t *testing.T) {
@@ -170,6 +171,14 @@ func TestIstioAmbientHTTPByteOverlap(t *testing.T) {
 			}
 			var aggregateSent, aggregateRecv, recordsSent, recordsRecv int64
 			for _, a := range AggregateFlows(resp.Flows) {
+				for _, f := range resp.Flows {
+					if f.Source.Name == a.Source.Name && f.Source.Namespace == a.Source.Namespace && f.Destination.Name == a.Destination.Name && f.Destination.Namespace == a.Destination.Namespace {
+						want := traffic.ProtocolBytes{BytesSent: f.BytesSent, BytesRecv: f.BytesRecv}
+						if got := a.BytesByProtocol[f.Protocol]; got != want {
+							t.Errorf("%s bucket = %+v, want %+v", f.Protocol, got, want)
+						}
+					}
+				}
 				aggregateSent += a.BytesSent
 				aggregateRecv += a.BytesRecv
 				match := FlowMatch{Pairs: []EndpointPair{{
@@ -187,13 +196,6 @@ func TestIstioAmbientHTTPByteOverlap(t *testing.T) {
 			if aggregateSent != wantTCPSent+wantHTTPSent || aggregateRecv != wantTCPRecv+wantHTTPRecv || recordsSent != aggregateSent || recordsRecv != aggregateRecv {
 				t.Errorf("aggregate bytes %d/%d, records %d/%d; want %d/%d", aggregateSent, aggregateRecv, recordsSent, recordsRecv, wantTCPSent+wantHTTPSent, wantTCPRecv+wantHTTPRecv)
 			}
-			wantNote := ""
-			if tc.wantOverlap {
-				wantNote = istioByteOverlapNote
-			}
-			if resp.DataNote != wantNote {
-				t.Errorf("data note = %q, want %q", resp.DataNote, wantNote)
-			}
 			wantKind := ""
 			if tc.missingErrors {
 				wantKind = WarningPartial
@@ -220,22 +222,6 @@ func TestIstioAmbientHTTPByteOverlap(t *testing.T) {
 	}
 }
 
-func TestIstioByteOverlapPreservesWarning(t *testing.T) {
-	for _, kind := range []string{"", WarningPartial, WarningTransient, WarningIncomplete, WarningCluster} {
-		t.Run(kind, func(t *testing.T) {
-			const warning = "Istio metrics are incomplete: 5xx error rates could not be read."
-			response := &FlowsResponse{Warning: warning, WarningKind: kind}
-			noteIstioByteOverlap(response)
-			if response.DataNote != istioByteOverlapNote {
-				t.Errorf("data note = %q, want %q", response.DataNote, istioByteOverlapNote)
-			}
-			if response.Warning != warning || response.WarningKind != kind {
-				t.Errorf("warning = %q (%s), want unchanged %q (%s)", response.Warning, response.WarningKind, warning, kind)
-			}
-		})
-	}
-}
-
 func TestIstioTCPJoinsDirectionalSeriesByReporter(t *testing.T) {
 	raw := []istioRawSeries{
 		istioSeries(istioTCPMetric, "destination", "side", "curl", "amb", "httpbin", "", 13),
@@ -244,12 +230,12 @@ func TestIstioTCPJoinsDirectionalSeriesByReporter(t *testing.T) {
 		istioSeries("istio_tcp_sent_bytes_total", "waypoint", "side", "curl", "amb", "httpbin", "", 3),
 	}
 	s := newTestIstio(fakeIstioProm(raw, nil))
-	flows, _, destinationTCP, err := s.queryTCPFlows(t.Context(), DefaultFlowOptions(), clusterScope{})
+	flows, _, err := s.queryTCPFlows(t.Context(), DefaultFlowOptions(), clusterScope{})
 	if err != nil {
 		t.Fatal(err)
 	}
-	if len(flows) != 2 || len(destinationTCP) != 1 {
-		t.Fatalf("want two reporter flows and on
```

**File**: `packages/k8s-ui/src/types/core.ts` (modified, +2/-5)
```diff
@@ -1693,6 +1693,8 @@ export interface AggregatedFlow {
   protocol: string
   port: number
   flowCount: number
+  bytesByProtocol?: Record<string, { bytesSent: number; bytesRecv: number }>
+  /** Cross-protocol sums kept for compatibility; display the breakdown when present. */
   bytesSent: number
   bytesRecv: number
   connections: number
@@ -1806,10 +1808,6 @@ export interface TrafficFlowsResponse {
   /** Set when the warning includes a reason tied to keeping the map to this
    *  cluster in a shared metrics store, so the view links to how that works. */
   warningClusterScope?: boolean
-  /** How the Data (byte) figures were measured, when that needs saying: for
-   *  example two reports that may cover the same calls. Not a warning: show it
-   *  quietly and never refetch for it. */
-  dataNote?: string
 }
 
 export type TrafficWarningKind = 'transient' | 'partial' | 'incomplete' | 'cluster'
@@ -1829,7 +1827,6 @@ export interface TrafficRecordsResponse {
   flowLimit?: number
   warning?: string
   warningKind?: TrafficWarningKind
-  dataNote?: string
 }
 
 // Wizard state for traffic setup
```

#### Recent Merged Pull Requests:
- **PR #2747** (2026-11-16): test(traffic): make the layout-engine tests independent of machine load (@nadaverell)
- **PR #2746** (2026-11-16): Issue and check cards: the severity rail spans the open card (@nadaverell)
- **PR #2745** (2026-11-16): Recover panics in MCP request handlers (@nadaverell)
- **PR #2744** (2026-11-16): fix(traffic): show Data per protocol and label byte-only edges with their throughput (@nadaverell)
- **PR #2743** (2026-11-16): Return 404 for missing assets, serve ranges uncompressed, and always declare Vary (@nadaverell)
- **PR #2742** (2026-11-16): Let browsers keep Radar's fingerprinted assets between page loads (@nadaverell)

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

## X. Recover panics in MCP request handlers

**RULE**:
When implementing operations in `internal/mcp/recover.go`, engineers MUST enforce rigorous boundary validation, safe state transitions, and memory/concurrency invariants as established by production defect remediation in skyhook-io/radar. All inputs crossing module boundaries must be explicitly verified before state persistence.

**WHY**:
Prevents defects observed in production commit `c8f387b4`: Recover panics in MCP request handlers. Unvalidated execution paths cause runtime exceptions, race conditions, and silent state corruption under concurrent workloads.

**WHEN TO APPLY**:
Subsystems managing Go data structures, boundary deserialization, API parsing, or resource lifecycles matching `internal/mcp/recover.go`.

**VERIFIED IMPLEMENTATION PATTERN**:
```go
// Verified production-grade fix pattern:
package mcp

import (
	"context"
	"log"
	"runtime/debug"

	"github.com/modelcontextprotocol/go-sdk/jsonrpc"
	mcpsdk "github.com/modelcontextprotocol/go-sdk/mcp"
)

// recoverMiddleware turns a panic in a request handler into a failed request.
// The SDK runs handlers in their own goroutines without recovering, so a panic
// in any tool would otherwise end the whole Radar process; the REST routes
// recover theirs. A tool call reports the failure as a tool error, which is
// what an agent can act on; other methods return a JSON-RPC internal error.
// Goroutines a handler starts itself are outside this and must recover their own.
func recoverMiddleware(next mcpsdk.MethodHandler) mcpsdk.MethodHandler {
	return func(ctx context.Context, method string, req mcpsdk.Request) (result mcpsdk.Result, err error) {
		defer func() {
			rec := recover()
			if rec == nil {
				return
			}
			name := method
			if call, ok := req.(*mcpsdk.CallToolRequest); ok && call.Params != nil {
				name = method + " " + call.Params.Name
			}
			log.Printf("[mcp] panic in %s: %v\n%s", name, rec, debug.Stack())
			if method == "tools/call" {
				result = &mcpsdk.CallToolResult{
					IsError: true,
					Content: [
```

**NEGATIVE CONSTRAINT**:
```go
// Induced defect failure mode:
// Defect-prone omission of boundary validation
```

**VERIFICATION METHOD**:
Automated regression test asserting that input states reproducing defect `c8f387b4` are properly handled with clean fallback behavior.


## 3. Independent Verification Protocol
1. Assert state existence before and after execution.
2. Verify deterministic SHA-256 byte digest parity.
3. Validate zero unhandled promise rejections or uncaught exceptions.
