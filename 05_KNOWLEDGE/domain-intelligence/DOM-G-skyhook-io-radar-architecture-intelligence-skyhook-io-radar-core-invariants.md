# Domain G — Architecture Intelligence: Architecture Intelligence: skyhook-io/radar Core Invariants

<!-- PROVENANCE_START
{
  "source_repository": "skyhook-io/radar",
  "source_url": "https://github.com/skyhook-io/radar",
  "source_version": "ccb8393e",
  "license": "Apache-2.0",
  "timestamp": "2026-11-19T20:55:49.898Z",
  "ai_provider": "zero-clone-structural-synthesizer",
  "generator_version": "2.0.0-universal",
  "learning_id": "learn-github-skyhook-io-radar",
  "canonical_classification": "domain_intelligence"
}
PROVENANCE_END -->
> **Provenance**: Harvested from [skyhook-io/radar](https://github.com/skyhook-io/radar) (Revision: `ccb8393e`).  
> **License**: Apache-2.0 | **Timestamp**: `2026-11-19T20:55:49.898Z`  
> **Learning ID**: `learn-github-skyhook-io-radar`


## 1. Domain Taxonomy & Context
- **Canonical Domain**: Domain G (Architecture Intelligence)
- **Secondary Corroborating Domains**: D (Research & Knowledge Intelligence), I (Content & Information Intelligence), H (Technical Construction Intelligence), L (Deployment & Operations Intelligence), K (Quality & Verification Intelligence), A (Human & Need Intelligence), F (Design Intelligence), J (Search & Distribution Intelligence), M (Feedback & Evolution Intelligence), E (Creative Intelligence), B (Product Intelligence)
- **Confidence Rating**: 53%

## 2. Core Domain Invariants & Discovered Laws
The following architectural invariants have been empirically discovered and recorded from skyhook-io/radar:

# Forensic Learning Record (Deep Inspection): skyhook-io/radar

> **Canonical Artifact**: `07_PROJECT_LEARNING/skyhook-io-radar-learnings.md`  
> **Source Platform**: GitHub ([https://github.com/skyhook-io/radar](https://github.com/skyhook-io/radar))  
> **Harvest Method**: Full-Spectrum Deep Extraction (Patches, Diffs, Source Code, Post-Mortems)  
> **Harvest Timestamp**: 2026-11-19T20:55:48.025Z  
> **Compliance State**: Free Tier Guaranteed | Strict Rate-Limit Backoff Honored  

---

## 1. Context & Architectural Overview
- **Repository / Resource**: `skyhook-io/radar`
- **Description**: The missing open-source Kubernetes UI with a built-in MCP server for AI agents. See what's broken, why, and what changed. Issues, Topology, event timeline, Helm, GitOps, live service traffic, and cluster audits - all in one Go binary.
- **Primary Language / Ecosystem**: Go
- **Discovered Manifests / Configurations**: package.json, go.mod, README.md, Dockerfile
- **Stars / Engagement**: 4171 stars

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

### Incident Patch 1: `640f73a9` (2026-11-19)
**Commit Message**: Answer the REST and MCP neighborhood by walking the relation families, without building a cluster graph (#2713)

> One of three cutover PRs retiring the relationship graph, with #2720
(drawer, AI context) and #2721 (Applications); merges after #2720 and
before #2721.

## Summary

The REST AI neighborhood (`/api/ai/neighborhood/...`) and MCP
`get_neighborhood` each built an all-namespace topology to answer for
one object. REST went through a 5 s memo that held a second copy of the
relationship graph; MCP did a fresh build on every call. Both now walk
outward from the object through the relation families and ownership,
asking only about the objects they reach, so neither builds a cluster
graph.

## What changed

- **`k8s.AnswerNeighborhood`** opens one session on the request's cache,
takes its providers from it, runs `topology.WalkNeighborhood`, and
validates the cache before returning. It refuses an empty discovery
catalog (503 on REST, `cluster_connecting` on MCP) rather than walk a
partial one.
- **The walk:**
- **What each hop asks:** the families' field dispositions and special
producers (the same ones the Related Resources answer uses), plus
ownership's owners, children, record

**File**: `docs/mcp.md` (modified, +5/-1)
```diff
@@ -1180,7 +1180,7 @@ For `get_cost` and `get_rightsizing`, see [Cost and rightsizing evidence limits]
 | `search` | Find resources by content/term match (config keys, env refs, images, label values, CRD fields, webhook configs, status messages). Tokens AND'd; secret values and CA bundles never indexed. Supports `kind:`/`ns:`/`label:`/`image:` modifiers (a Kind, its plural, or a kubectl short name of a built-in such as `netpol`, `ing`, `sa`, `quota`) and CEL `filter`. Searches workloads, Pods, Services, Ingresses, IngressClasses, NetworkPolicies, ConfigMaps, Secrets (names only), PVCs, PVs, StorageClasses, HPAs, PDBs, ResourceQuotas, LimitRanges, ServiceAccounts, Roles, RoleBindings, ClusterRoles, ClusterRoleBindings, Nodes, Namespaces, Events (with `kind:Event`) and watched CRDs; a `kind:` term also searches a large CRD Radar watches only on demand. Endpoints, EndpointSlices and Leases are not searched; use `list_resources`. An IP address, `ip:port` or `[v6]:port` (a client address from a log) matches that whole address only (`10.0.1.2` never matches `10.0.1.23`): a hit with site `ip:<role>` holds it (`podIP`, `hostNetworkPod`, `clusterIP`, `externalIP`, `loadBalancerIP` from status, `node<AddressType>` such as `nodeInternalIP`; `exitedPodIP` is a finished pod's old IP, which a running pod may have been given since, and ranks below a running holder); other sites, such as a Pod's `status.hostIP` or a ConfigMap URL, only mention it. A query of one IP alone whose untruncated hits include no running holder adds `ipHint`: Pod IPs are reused, a deleted pod's IP no longer resolves, and the address may be outside the cluster. Trivy Operator reports match by CVE ID with package and installed/fixed versions, SBOM component, failed check ID and scanned image (`image:`); a secret finding's matched text is never indexed or reachable. Free tokens can land on different findings of one report, so use the CEL `report` binding (`report.vulnerabilities.exists(v, …)`) to match a single finding. A report is scan-time evidence: `summaryContext.managedBy` names the workload and `summaryContext.scanned` the scanned object (`missing` means Radar can't find it). By default Trivy Operator deletes an old ReplicaSet's reports after a rollout; with `vulnerabilityScannerScanOnlyCurrentRevisions: false` they stay, and `scanned.replicas: 0` usually marks one (a Deployment scaled to zero also reads 0). Trivy reports are returned only where the caller may list that report kind. Every result carries `coverage` (`status`, `narrowedBy`, `gaps`), and a partial result, an empty narrowed one, or one with hits that Radar's namespace collection or pin limited adds `coverageHint`; see [Search coverage](#search-coverage-and-cel-object-filters). | `query` (required), `filter` (optional CEL), `limit` (optional) |
 | `get_resource` | Inspect one known resource: minified spec, status, and metadata, plus default-on `resourceContext` with relationships and available resource-specific summaries. Operational issues and static audit posture remain distinct; audit findings are mostly latent risk, though some (expired certificates, dangling references) can be live failures. See [integration documentation](integrations.md) for controller-specific context and limits. Optional supplemental data adds events, metrics, recent changes, rollback revisions, detailed issue context, or a Node drain estimate. `include=drain-plan` reuses the read-only REST drain estimator with the caller’s credentials and the removal drawer’s explicit options; it returns up to 100 current pods, full summary counts, `drainPlanTotalPods` and `drainPlanPodsTruncated`. It evaluates Eviction API/PDB eligibility, not controller-specific policy or eviction history. `include=issues` returns up to three `relatedIssues`, with `relatedIssuesTotal` and `relatedIssuesTruncated`; this is independent of `context=none`. `staleEnv` lists env vars that running containers read from a Secret or ConfigMap key and that started before that key's last data write, so they likely still hold the earlier value until restart: on a Secret or ConfigMap it names the consuming Pods, on a Pod or workload its env vars. It is attached with `context=none` too, shows up to 5 rows with `total`, needs `get` on Pods and on the source's kind, and skips volume mounts, which refresh in place. For a Secret write made before Radar started, the row comes from the Secret's managedFields (`evidenceSource: managed_fields_mtime`), names no key, and says the write may not have touched data; ConfigMap rows come only from changes Radar observed. When every change Radar saw since the container started only reordered the value's comma-separated entries, and its history covers that whole time, the message says only the order changed; reorders of `mon_host` and `mon_initial_members` in Rook's own `rook-ceph-config` Secret (type `kubernetes.io/rook`, controlled by a CephCluster) are left out, since Ceph treats both as sets. For logs use `get_pod_lo
```

**File**: `internal/k8s/collector_errors.go` (added, +31/-0)
```diff
@@ -0,0 +1,31 @@
+package k8s
+
+import (
+	"errors"
+
+	apierrors "k8s.io/apimachinery/pkg/api/errors"
+
+	"github.com/skyhook-io/radar/pkg/k8score"
+	"github.com/skyhook-io/radar/pkg/readreason"
+)
+
+// CollectorErrorCode classifies unambiguous collector refusals and sentinels.
+// Deadlines and cancellation belong to the caller's execution policy.
+func CollectorErrorCode(err error) (readreason.Code, bool) {
+	switch {
+	case errors.Is(err, k8score.ErrResourceListTooLarge):
+		return readreason.ListTooLarge, true
+	case errors.Is(err, k8score.ErrCollectionNotSupported):
+		return readreason.KindNotWatchable, true
+	case apierrors.IsUnauthorized(err):
+		return readreason.RadarCredentialsRejected, true
+	case apierrors.IsForbidden(err):
+		return readreason.RadarForbidden, true
+	case errors.Is(err, ErrUnknownDynamicKind):
+		return readreason.KindUnknown, true
+	case errors.Is(err, ErrDynamicNotReady):
+		return readreason.KindSyncPending, true
+	default:
+		return "", false
+	}
+}
```

**File**: `internal/k8s/neighborhood.go` (added, +130/-0)
```diff
@@ -0,0 +1,130 @@
+package k8s
+
+import (
+	"context"
+	"fmt"
+	"sync"
+
+	"k8s.io/apimachinery/pkg/runtime/schema"
+
+	"github.com/skyhook-io/radar/pkg/k8score"
+	"github.com/skyhook-io/radar/pkg/ownership"
+	"github.com/skyhook-io/radar/pkg/ownership/cachesource"
+	"github.com/skyhook-io/radar/pkg/readreason"
+	"github.com/skyhook-io/radar/pkg/relations"
+	"github.com/skyhook-io/radar/pkg/resourceid"
+	"github.com/skyhook-io/radar/pkg/topology"
+)
+
+// AnswerNeighborhood binds the walk and display data to the request's cache.
+// A root whose custom kind Radar isn't collecting yet starts that kind's
+// watch, as a read of the object would, and is asked about once more after
+// waiting as long as that read waits; it then answers from the watch, or says
+// the kind is still loading or denied to Radar.
+func AnswerNeighborhood(ctx context.Context, cache *ResourceCache, root topology.ResourceRef, opts topology.NeighborhoodOptions) (*topology.Subgraph, error) {
+	sub, caches, err := answerNeighborhood(ctx, cache, root, opts)
+	if err != nil || len(sub.Nodes) > 0 {
+		return sub, err
+	}
+	tried, codes := collectRootKinds(ctx, caches, sub.UncollectedRoots)
+	if !tried {
+		return sub, nil
+	}
+	sub, _, err = answerNeighborhood(ctx, cache, root, opts)
+	if err == nil && len(sub.Nodes) == 0 && sub.RootUnavailable == readreason.RadarKindNotCollected && len(codes) > 0 {
+		// A refusal in the root's namespace is recorded only against that
+		// watch request, and a watch still starting isn't recorded yet, so
+		// the walk's reads see neither.
+		sub.RootUnavailable = readreason.Primary(codes)
+	}
+	return sub, err
+}
+
+func answerNeighborhood(ctx context.Context, cache *ResourceCache, root topology.ResourceRef, opts topology.NeighborhoodOptions) (*topology.Subgraph, cachesource.Caches, error) {
+	session, err := BeginOwnershipRead(cache)
+	if err != nil {
+		return nil, cachesource.Caches{}, err
+	}
+	if len(session.Catalog().DependentKinds()) == 0 {
+		// Discovery hasn't answered yet, as while Radar starts, so no related
+		// kind could be searched or resolved.
+		return nil, cachesource.Caches{}, ownership.ErrNotConnected
+	}
+	rs, ok := session.(relations.Session)
+	if !ok {
+		return nil, cachesource.Caches{}, fmt.Errorf("relation session unavailable")
+	}
+	caches, ok := cachesource.SessionCaches(session)
+	if !ok {
+		return nil, cachesource.Caches{}, fmt.Errorf("relation caches unavailable")
+	}
+	provider := NewTopologyResourceProvider(&ResourceCache{ResourceCache: caches.Typed})
+	var dp topology.DynamicProvider
+	if caches.Dynamic != nil && caches.Discovery != nil {
+		dp = NewTopologyDynamicProvider(&DynamicResourceCache{DynamicResourceCache: caches.Dynamic}, &ResourceDiscovery{ResourceDiscovery: caches.Discovery})
+	}
+	sub, err := topology.WalkNeighborhood(ctx, rs, root, opts, provider, dp)
+	if err != nil {
+		return nil, cachesource.Caches{}, err
+	}
+	if err := session.ValidateCaches(); err != nil {
+		return nil, cachesource.Caches{}, err
+	}
+	return sub, caches, nil
+}
+
+// collectRootKinds starts the watch of each root candidate's custom kind the
+// walk found uncollected (the walk lists only candidates the caller's Allow
+// admitted) and waits for it, the whole step bounded as a read of one object
+// waits: starting a watch otherwise waits as long as CRD discovery takes
+// while Radar starts. It reports whether it tried any, and the codes of the
+// watches Radar was refused or that hadn't started within the bound. Typed
+// kinds are collected or not by configuration, and the kinds Radar reads
+// directly are never watched, so neither is started here.
+func collectRootKinds(ctx context.Context, caches cachesource.Caches, roots []resourceid.Ref) (tried bool, codes []readreason.Code) {
+	if caches.Dynamic == nil || caches.Discovery == nil {
+		return false, nil
+	}
+	bounded, cancel := context.WithTimeout(ctx, k8score.ObjectReadSyncWait)
+	defer cancel()
+	type watch struct {
+		gvr       schema.GroupVersionResource
+		namespace string
+		err       error
+	}
+	var watches []watch
+	for _, r := range roots {
+		if isTypedKind(r.GroupKind()) {
+			continue
+		}
+		gvr, ok := caches.Discovery.GetGVRWithGroup(r.Kind, r.Group)
+		if !ok || ShouldBypassDynamicInformer(gvr) {
+			continue
+		}
+		watches = append(watches, watch{gvr: gvr, namespace: r.Namespace})
+	}
+	// Every watch starts at once, and before any is waited for, so one slow
+	// to start or to load can't keep another, of the same kind in another
+	// group, from starting.
+	var wg sync.WaitGroup
+	for i := range watches {
+		wg.Go(func() {
+			watches[i].err = caches.Dynamic.EnsureWatchingContext(bounded, watches[i].gvr, watches[i].namespace)
+		})
+	}
+	wg.Wait()
+	for _, w := range watches {
+		if w.err == nil {
+			caches.Dynamic.WaitForSyncContext(bounded, w.gvr, w.namespace)
+			continue
+		}
+		if code, ok := CollectorErrorCode(w.err); ok {
+			codes = append(codes, code)
+		} else if bounded.Err() != nil && ctx.Err
```

**File**: `internal/k8s/read_policy.go` (modified, +24/-1)
```diff
@@ -1,8 +1,11 @@
 package k8s
 
 import (
-	aicontext "github.com/skyhook-io/radar/pkg/ai/context"
 	"k8s.io/apimachinery/pkg/runtime/schema"
+
+	aicontext "github.com/skyhook-io/radar/pkg/ai/context"
+	"github.com/skyhook-io/radar/pkg/resourceid"
+	"github.com/skyhook-io/radar/pkg/topology"
 )
 
 // RequiresExactNamespaceAccess reports whether namespace visibility alone is
@@ -26,3 +29,23 @@ func ExactNamespaceAccessResource(kind, requestedGroup string) (group, resource
 	}
 	return "", ""
 }
+
+// ExactNamespaceAccessNode is ExactNamespaceAccessResource for a namespaced
+// neighborhood node, read from the served resource the walk records on it.
+// resolved is false when the node's kind may need that permission but the node
+// records no resource to check it against; the caller must deny the node.
+func ExactNamespaceAccessNode(n *topology.Node) (group, resource string, resolved bool) {
+	apiVersion, _ := n.Data["apiVersion"].(string)
+	resource, _ = n.Data["resource"].(string)
+	group = resourceid.GroupFromAPIVersion(apiVersion)
+	if resource == "" {
+		kind, _ := n.Data["resourceKind"].(string)
+		b, builtin := resourceid.BuiltinForKind(kind)
+		exact := group == aicontext.TrivyGroup || builtin && b.Group == group && RequiresExactNamespaceAccess(schema.GroupVersionResource{Group: b.Group, Resource: b.Resource})
+		return "", "", !exact
+	}
+	if RequiresExactNamespaceAccess(schema.GroupVersionResource{Group: group, Resource: resource}) {
+		return group, resource, true
+	}
+	return "", "", true
+}
```

**File**: `internal/k8s/read_policy_test.go` (modified, +30/-1)
```diff
@@ -1,8 +1,11 @@
 package k8s
 
 import (
-	"k8s.io/apimachinery/pkg/runtime/schema"
 	"testing"
+
+	"k8s.io/apimachinery/pkg/runtime/schema"
+
+	"github.com/skyhook-io/radar/pkg/topology"
 )
 
 func TestRequiresExactNamespaceAccess(t *testing.T) {
@@ -53,3 +56,29 @@ func TestExactNamespaceAccessResource(t *testing.T) {
 		}
 	}
 }
+
+// A node that records no resource is denied when its kind may need the
+// caller's own permission, rather than read as needing none.
+func TestExactNamespaceAccessNodeFailsClosedWithoutResource(t *testing.T) {
+	for _, tc := range []struct {
+		apiVersion, kind, resource string
+		wantGroup, wantResource    string
+		wantResolved               bool
+	}{
+		{"rbac.authorization.k8s.io/v1", "Role", "roles", "rbac.authorization.k8s.io", "roles", true},
+		{"rbac.authorization.k8s.io/v1", "Role", "", "", "", false},
+		{"rbac.authorization.k8s.io/v1", "RoleBinding", "", "", "", false},
+		{"v1", "LimitRange", "", "", "", false},
+		{"v1", "Secret", "", "", "", false},
+		{"aquasecurity.github.io/v1alpha1", "VulnerabilityReport", "", "", "", false},
+		{"v1", "ConfigMap", "", "", "", true},
+		{"example.com/v1", "Role", "", "", "", true},
+		{"rbac.authorization.k8s.io/v1", "ClusterRole", "", "", "", true},
+	} {
+		n := &topology.Node{Data: map[string]any{"apiVersion": tc.apiVersion, "resourceKind": tc.kind, "resource": tc.resource}}
+		group, resource, resolved := ExactNamespaceAccessNode(n)
+		if group != tc.wantGroup || resource != tc.wantResource || resolved != tc.wantResolved {
+			t.Errorf("%s %s %q = %q %q %t, want %q %q %t", tc.apiVersion, tc.kind, tc.resource, group, resource, resolved, tc.wantGroup, tc.wantResource, tc.wantResolved)
+		}
+	}
+}
```

**File**: `internal/k8s/relationship_watches.go` (modified, +9/-2)
```diff
@@ -7,14 +7,21 @@ import (
 	"k8s.io/apimachinery/pkg/runtime/schema"
 )
 
-func relationshipWatchKinds() []schema.GroupKind {
+// typedKinds are the kinds the typed cache holds.
+var typedKinds = func() map[resourceid.GroupKind]bool {
 	typed := map[resourceid.GroupKind]bool{}
 	for _, k := range k8score.AllKindListers() {
 		typed[resourceid.GroupKind{Group: k.Group(), Kind: k.Kind()}] = true
 	}
+	return typed
+}()
+
+func isTypedKind(gk resourceid.GroupKind) bool { return typedKinds[gk] }
+
+func relationshipWatchKinds() []schema.GroupKind {
 	var kinds []schema.GroupKind
 	for _, k := range relations.Kinds() {
-		if !typed[k] {
+		if !isTypedKind(k) {
 			kinds = append(kinds, schema.GroupKind{Group: k.Group, Kind: k.Kind})
 		}
 	}
```

**File**: `internal/mcp/agentlog.go` (modified, +7/-2)
```diff
@@ -39,7 +39,10 @@ type agentLogFields struct {
 //	  est_tokens=539 truncated=false omitted=0 context_tier=none kind=Pod ns=prod
 func emitAgentLog(f agentLogFields) {
 	level := "info"
-	if f.Err != nil {
+	switch {
+	case isTimeout(f.Err):
+		level = "warn"
+	case f.Err != nil:
 		level = "error"
 	}
 	tier := f.ContextTier
@@ -148,7 +151,9 @@ func logToolCall[In any](
 			toolErr = errors.New("tool returned an error result")
 		}
 
-		if toolErr != nil && sensitive {
+		if isTimeout(toolErr) {
+			log.Printf("\033[1;35m[MCP]\033[0m \033[1m%s\033[0m \033[33mTIMEOUT\033[0m (%s)", name, dur.Round(time.Millisecond))
+		} else if toolErr != nil && sensitive {
 			log.Printf("\033[1;35m[MCP]\033[0m \033[1m%s\033[0m \033[31mERROR\033[0m (%s)", name, dur.Round(time.Millisecond))
 		} else if toolErr != nil {
 			log.Printf("\033[1;35m[MCP]\033[0m \033[1m%s\033[0m \033[31mERROR\033[0m (%s) %v", name, dur.Round(time.Millisecond), toolErr)
```

**File**: `internal/mcp/errors.go` (modified, +16/-0)
```diff
@@ -1,6 +1,9 @@
 package mcp
 
 import (
+	"context"
+	"errors"
+
 	"github.com/skyhook-io/radar/internal/k8s"
 	"github.com/skyhook-io/radar/pkg/readreason"
 )
@@ -49,3 +52,16 @@ func requireConnected() error {
 	}
 	return errNotConnected()
 }
+
+// timeoutError is a call cut off by its request's deadline. The caller can
+// narrow the request and retry; it is not a failure of Radar's, so the call
+// log records it as a timeout, not an error.
+type timeoutError struct{ msg string }
+
+func (e *timeoutError) Error() string { return e.msg }
+func (e *timeoutError) Unwrap() error { return context.DeadlineExceeded }
+
+func isTimeout(err error) bool {
+	var t *timeoutError
+	return errors.As(err, &t)
+}
```

---

### Incident Patch 2: `9a5a7034` (2026-11-18)
**Commit Message**: fix(k8s): give informers and list probes their own rate-limited clients (#2719)

## Description

First of the two PRs proposed in #2718. Right after a context switch,
request handlers that call the apiserver as Radar (capability SSARs,
per-user SARs, namespace discovery and LIST, server version) waited in
the same client-go token bucket as the typed informers' LIST/WATCH
calls, and dynamic reads shared a bucket with the list probes and CRD
informers, so they hit their deadlines while the new cluster's caches
started.

- `newSharedKubernetesClients` also builds an informer clientset and an
informer dynamic client on the same observed `http.Client`, so they keep
the transport, the auth observer (401s still drive runtime auth
recovery) and the deadline wrapper, each with its own 50/100 bucket.
- The typed resource cache, the dynamic resource cache, the
supported-CRD fallback probes and the startup list probes use them
through `GetInformerClient()` / `GetInformerDynamicClient()`. Request
handlers keep `GetClient()` / `GetDynamicClient()`, whose buckets now
carry only request traffic.
- The accessors hand out the informer clients only while they belong to
the current request client (set

**File**: `internal/k8s/cache.go` (modified, +3/-3)
```diff
@@ -388,7 +388,7 @@ func InitResourceCache(ctx context.Context) error {
 	var initErr error
 	once, gen := claimCacheInit()
 	once.Do(func() {
-		client := GetClient()
+		client, informerClient := getCacheClients()
 		if client == nil {
 			initErr = fmt.Errorf("cannot create resource cache: k8s client not initialized")
 			return
@@ -443,7 +443,7 @@ func InitResourceCache(ctx context.Context) error {
 		cronJobScheduleObservations := newCronJobScheduleObservationTracker()
 
 		cfg := k8score.CacheConfig{
-			Client:                  client,
+			Client:                  informerClient,
 			ResourceScopes:          scopes,
 			ResourceScopeNamespaces: permResult.ScopeNamespaces,
 			DeferredTypes:           deferredResources,
@@ -2422,7 +2422,7 @@ func bootstrapResourcePermissions(ctx context.Context, probe func(context.Contex
 // hold the very rejection being retried, without bumping the generation, so
 // the first result can still be published if the retry is discarded.
 func freshResourcePermissions(ctx context.Context, retry bool) permissionProbe {
-	return probeResourcePermissions(ctx, retry)
+	return probeResourcePermissions(ctx, retry, GetInformerDynamicClient)
 }
 
 // credentialsRejectedEverywhere reports a probe in which no kind
```

**File**: `internal/k8s/cache_permission_recovery_test.go` (modified, +23/-0)
```diff
@@ -9,6 +9,7 @@ import (
 	apierrors "k8s.io/apimachinery/pkg/api/errors"
 	"k8s.io/apimachinery/pkg/runtime"
 	"k8s.io/apimachinery/pkg/runtime/schema"
+	"k8s.io/client-go/dynamic"
 	dynamicfake "k8s.io/client-go/dynamic/fake"
 	"k8s.io/client-go/kubernetes"
 	kubernetesfake "k8s.io/client-go/kubernetes/fake"
@@ -247,3 +248,25 @@ func bootstrapResult(ctx context.Context, check func(context.Context, bool) *Per
 	})
 	return probe.result, err
 }
+
+// A context switch installs the new client before it bumps the generation, so
+// a probe must read the generation before the client. Otherwise a probe can
+// pick the previous cluster's client, read the bumped generation, and publish
+// the previous cluster's access as the new one's.
+func TestProbeReadsClientAfterGeneration(t *testing.T) {
+	InvalidateResourcePermissionsCache()
+	t.Cleanup(InvalidateResourcePermissionsCache)
+	prevClient := SetTestClient(kubernetes.NewForConfigOrDie(&rest.Config{Host: "http://127.0.0.1:1"}))
+	t.Cleanup(func() { SetTestClient(prevClient) })
+	previousCluster := fakeDyn(t, func(schema.GroupVersionResource, string) bool { return true })
+
+	probe := probeResourcePermissions(context.Background(), false, func() dynamic.Interface {
+		// The switch lands here: the previous client was already picked, and
+		// the generation moves on.
+		InvalidateResourcePermissionsCache()
+		return previousCluster
+	})
+	if publishResourcePermissions(probe) || GetCachedPermissionResult() != nil {
+		t.Fatalf("the previous cluster's result was published under the new generation: %+v", GetCachedPermissionResult())
+	}
+}
```

**File**: `internal/k8s/capabilities.go` (modified, +11/-5)
```diff
@@ -1127,7 +1127,7 @@ func resolveProbeGVRs(p resourceProbe) []schema.GroupVersionResource {
 // SelfSubjectAccessReview is one indirection too many — it can disagree with
 // reality on clusters using webhook authorizers (e.g. GKE IAM).
 func CheckResourcePermissions(ctx context.Context) (*PermissionCheckResult, bool) {
-	probe := probeResourcePermissions(ctx, false)
+	probe := probeResourcePermissions(ctx, false, GetDynamicClient)
 	return probe.result, publishResourcePermissions(probe)
 }
 
@@ -1145,9 +1145,12 @@ type permissionProbe struct {
 	unpublished bool
 }
 
-// probeResourcePermissions probes without publishing. It serves a fresh cached
-// result unless bypassCache is set.
-func probeResourcePermissions(ctx context.Context, bypassCache bool) permissionProbe {
+// probeResourcePermissions probes through the client dynFor returns, without
+// publishing. It serves a fresh cached result unless bypassCache is set.
+// dynFor is called only after the generation is captured. Request handlers pass
+// GetDynamicClient; only the cache's own startup probe spends the informer
+// client's rate limiter, through GetInformerDynamicClient.
+func probeResourcePermissions(ctx context.Context, bypassCache bool, dynFor func() dynamic.Interface) permissionProbe {
 	resourcePermsMu.RLock()
 	if !bypassCache && cachedPermResult != nil && time.Now().Before(resourcePermsExpiry) {
 		result := clonePermissionCheckResult(cachedPermResult)
@@ -1163,13 +1166,16 @@ func probeResourcePermissions(ctx context.Context, bypassCache bool) permissionP
 	// probe exists, and moving them later would need the same treatment.
 	probeGen := resourcePermsGen
 	resourcePermsMu.RUnlock()
+	// After the generation: a context switch installs the new client before it
+	// bumps the generation, so the reverse order can pair the previous
+	// cluster's client with the new generation.
+	dyn := dynFor()
 
 	// Compute probes WITHOUT holding the write lock — concurrent callers
 	// may race but redundant probes are harmless. Holding the lock during
 	// network calls would block InvalidateResourcePermissionsCache() during
 	// context switch.
 
-	dyn := GetDynamicClient()
 	if GetClient() == nil || dyn == nil {
 		log.Printf("Warning: K8s client not initialized, returning no resource permissions")
 		// Current: nothing superseded this, there is simply nothing to probe.
```

**File**: `internal/k8s/client.go` (modified, +66/-0)
```diff
@@ -38,6 +38,7 @@ var (
 	k8sConfig                    *rest.Config
 	discoveryClient              *discovery.DiscoveryClient
 	dynamicClient                dynamic.Interface
+	activeClients                *sharedKubernetesClients
 	initOnce                     sync.Once
 	initErr                      error
 	kubeconfigPath               string
@@ -363,6 +364,7 @@ func doInit(opts InitOptions) error {
 	k8sClient = clients.clientset
 	discoveryClient = clients.discovery
 	dynamicClient = clients.dynamic
+	activeClients = clients
 	activeClientGeneration = clients.generation
 
 	return nil
@@ -828,6 +830,69 @@ func GetDynamicClient() dynamic.Interface {
 	return dynamicClient
 }
 
+// GetInformerClient returns the clientset the informer cache lists and watches
+// through. It shares GetClient()'s http.Client (transport, auth observer,
+// request deadlines) but has its own client-side rate limiter, so informer
+// LIST/WATCH traffic never delays request handlers. Falls back to GetClient()
+// when the active client set has no informer client, e.g. a test that installed
+// only the request client.
+func GetInformerClient() kubernetes.Interface {
+	clientMu.RLock()
+	defer clientMu.RUnlock()
+	return informerClientForLocked(k8sClient)
+}
+
+// getCacheClients reads the request and informer clientsets in one critical
+// section, so a context switch between two reads cannot pair one cluster's
+// observer source with another cluster's informers.
+func getCacheClients() (*kubernetes.Clientset, kubernetes.Interface) {
+	clientMu.RLock()
+	defer clientMu.RUnlock()
+	return k8sClient, informerClientForLocked(k8sClient)
+}
+
+// InformerClientFor maps a request clientset to the informer clientset of the
+// same client set, so a holder of GetClient() can tell whether the resource
+// cache (whose Client() is the informer client) describes its connection.
+func InformerClientFor(client kubernetes.Interface) kubernetes.Interface {
+	clientMu.RLock()
+	defer clientMu.RUnlock()
+	if c, ok := client.(*kubernetes.Clientset); ok {
+		return informerClientForLocked(c)
+	}
+	return client
+}
+
+func informerClientForLocked(client *kubernetes.Clientset) kubernetes.Interface {
+	if client == nil {
+		return nil
+	}
+	// Matching on the request client keeps an informer client from another
+	// client set (a previous cluster) from ever being handed out.
+	if activeClients != nil && activeClients.clientset == client && activeClients.informerClientset != nil {
+		return activeClients.informerClientset
+	}
+	return client
+}
+
+// GetInformerDynamicClient is GetInformerClient for the dynamic informer cache
+// and the startup list probes, falling back to GetDynamicClient().
+func GetInformerDynamicClient() dynamic.Interface {
+	_, informer := getDynamicCacheClients()
+	return informer
+}
+
+// getDynamicCacheClients reads the request and informer dynamic clients in one
+// critical section, for the same reason as getCacheClients.
+func getDynamicCacheClients() (request, informer dynamic.Interface) {
+	clientMu.RLock()
+	defer clientMu.RUnlock()
+	if dynamicClient != nil && activeClients != nil && activeClients.dynamic == dynamicClient && activeClients.informerDynamic != nil {
+		return dynamicClient, activeClients.informerDynamic
+	}
+	return dynamicClient, dynamicClient
+}
+
 func GetDynamicClientSnapshot() (dynamic.Interface, string) {
 	clientMu.RLock()
 	defer clientMu.RUnlock()
@@ -2058,6 +2123,7 @@ func installPreparedContext(p *preparedContext) {
 	k8sClient = p.clients.clientset
 	discoveryClient = p.clients.discovery
 	dynamicClient = p.clients.dynamic
+	activeClients = p.clients
 	activeClientGeneration = p.clients.generation
 	contextName = p.name
 	contextBinding = newContextBinding
```

**File**: `internal/k8s/context_manager.go` (modified, +1/-0)
```diff
@@ -427,6 +427,7 @@ func BlockClusterAccess(err error) {
 	k8sClient = nil
 	discoveryClient = nil
 	dynamicClient = nil
+	activeClients = nil
 }
 
 func contextOperationsBlockedErr() error {
```

**File**: `internal/k8s/dynamic_cache.go` (modified, +3/-2)
```diff
@@ -36,7 +36,7 @@ var (
 func InitDynamicResourceCache(changeCh chan k8score.ResourceChange) error {
 	var initErr error
 	dynamicCacheOnce.Do(func() {
-		client := GetDynamicClient()
+		directClient, client := getDynamicCacheClients()
 		if client == nil {
 			initErr = fmt.Errorf("dynamic client not initialized")
 			return
@@ -84,6 +84,7 @@ func InitDynamicResourceCache(changeCh chan k8score.ResourceChange) error {
 		core, err := k8score.NewDynamicResourceCache(k8score.DynamicCacheConfig{
 			RequiredWatchKinds:          relationshipWatchKinds(),
 			DynamicClient:               client,
+			DirectClient:                directClient,
 			Discovery:                   sharedDiscovery,
 			Changes:                     changeCh,
 			NamespaceFallback:           nsFallback,
@@ -494,7 +495,7 @@ var supportedCRDFallbacks = []supportedCRDResource{
 
 func RegisterSupportedCRDFallbacks() {
 	discovery := GetResourceDiscovery()
-	client := GetDynamicClient()
+	client := GetInformerDynamicClient()
 	if discovery == nil || client == nil {
 		return
 	}
```

**File**: `internal/k8s/informer_client_test.go` (added, +267/-0)
```diff
@@ -0,0 +1,267 @@
+package k8s
+
+import (
+	"context"
+	"errors"
+	"net/http"
+	"net/http/httptest"
+	"sync/atomic"
+	"testing"
+	"time"
+
+	corev1 "k8s.io/api/core/v1"
+	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
+	"k8s.io/apimachinery/pkg/runtime/schema"
+	"k8s.io/client-go/kubernetes"
+	"k8s.io/client-go/kubernetes/fake"
+	"k8s.io/client-go/rest"
+)
+
+// The informer clients must not share a client-side rate limiter with the
+// request clients: a cache start or relist spends the informer bucket, and a
+// handler calling GetClient() must not wait behind it.
+func TestInformerClientsHaveTheirOwnRateLimiters(t *testing.T) {
+	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
+		w.Header().Set("Content-Type", "application/json")
+		_, _ = w.Write([]byte(`{"kind":"NamespaceList","apiVersion":"v1","metadata":{},"items":[]}`))
+	}))
+	defer srv.Close()
+
+	clients, err := newSharedKubernetesClients(&rest.Config{Host: srv.URL, QPS: 1, Burst: 1})
+	if err != nil {
+		t.Fatalf("newSharedKubernetesClients: %v", err)
+	}
+	nsGVR := schema.GroupVersionResource{Version: "v1", Resource: "namespaces"}
+
+	// Spend the single token of each informer bucket.
+	if _, err := clients.informerClientset.CoreV1().Namespaces().List(context.Background(), metav1.ListOptions{}); err != nil {
+		t.Fatalf("informer typed list: %v", err)
+	}
+	if _, err := clients.informerDynamic.Resource(nsGVR).List(context.Background(), metav1.ListOptions{}); err != nil {
+		t.Fatalf("informer dynamic list: %v", err)
+	}
+
+	// With a shared bucket the next token is a second away, so the limiter
+	// refuses a 300ms deadline up front.
+	ctx, cancel := context.WithTimeout(context.Background(), 300*time.Millisecond)
+	defer cancel()
+	if _, err := clients.clientset.CoreV1().Namespaces().List(ctx, metav1.ListOptions{}); err != nil {
+		t.Errorf("request typed list waited behind the informer client: %v", err)
+	}
+	if _, err := clients.dynamic.Resource(nsGVR).List(ctx, metav1.ListOptions{}); err != nil {
+		t.Errorf("request dynamic list waited behind the informer client: %v", err)
+	}
+}
+
+func TestResourceCacheIsBuiltFromInformerClients(t *testing.T) {
+	defer ResetTestState()
+
+	requestClient, err := kubernetes.NewForConfig(&rest.Config{Host: "http://localhost:1"})
+	if err != nil {
+		t.Fatalf("request client: %v", err)
+	}
+	informerClient := fake.NewClientset(
+		&corev1.Namespace{ObjectMeta: metav1.ObjectMeta{Name: "default"}},
+		&corev1.Pod{ObjectMeta: metav1.ObjectMeta{Name: "p", Namespace: "default"}},
+	)
+	requestDyn := fakeDyn(t, func(gvr schema.GroupVersionResource, _ string) bool {
+		t.Errorf("list probe for %s went through the request dynamic client", gvr.Resource)
+		return false
+	})
+	informerDyn := fakeDyn(t, func(gvr schema.GroupVersionResource, _ string) bool {
+		return gvr.Group == "" && gvr.Resource == "pods"
+	})
+
+	clientMu.Lock()
+	k8sClient = requestClient
+	dynamicClient = requestDyn
+	activeClients = &sharedKubernetesClients{
+		clientset:         requestClient,
+		dynamic:           requestDyn,
+		informerClientset: informerClient,
+		informerDynamic:   informerDyn,
+	}
+	clientMu.Unlock()
+
+	// Observers live for the process, so stop recording when the test ends.
+	sources := make(chan kubernetes.Interface, 1)
+	var recording atomic.Bool
+	recording.Store(true)
+	defer recording.Store(false)
+	OnResourceObserved(func(source kubernetes.Interface, _ ResourceChange, _, _ any) {
+		if !recording.Load() {
+			return
+		}
+		select {
+		case sources <- source:
+		default:
+		}
+	})
+
+	ctx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
+	defer cancel()
+	if err := InitResourceCache(ctx); err != nil {
+		t.Fatalf("InitResourceCache: %v", err)
+	}
+	if got := GetResourceCache().Client(); got != kubernetes.Interface(informerClient) {
+		t.Fatalf("cache built from %T, want the informer client", got)
+	}
+	if got := InformerClientFor(requestClient); got != kubernetes.Interface(informerClient) {
+		t.Errorf("InformerClientFor(request client) = %T, want the informer client", got)
+	}
+	// Observers compare source with GetClient() (Prometheus does), so the
+	// cache must report the request client even though it lists through the
+	// informer client.
+	select {
+	case got := <-sources:
+		if got != kubernetes.Interface(requestClient) {
+			t.Errorf("observer source = %T, want the request client", got)
+		}
+	case <-ctx.Done():
+		t.Fatal("no resource observer callback during the initial sync")
+	}
+}
+
+func TestContextSwitchReplacesInformerClients(t *testing.T) {
+	restoreClientGlobals(t)
+	dir := t.TempDir()
+	path := writeKubeconfig(t, dir, "config", "alpha", []kubeEntry{
+		{ctxName: "alpha", userName: "ua", clusterName: "cluster-alpha"},
+		{ctxName: "beta", userName: "ub", clusterName: "cluster-beta"},
+	})
+	if err := doInit(InitOptions{KubeconfigPath: path}); err != nil {
+		t.Fatalf("doInit: %v", err)
+	}
+	alphaInformer, alphaDyn := GetInformerClient(
```

**File**: `internal/k8s/last_context_test.go` (modified, +2/-0)
```diff
@@ -36,6 +36,7 @@ func restoreClientGlobals(t *testing.T) {
 		savedConfig     = k8sConfig
 		savedDiscovery  = discoveryClient
 		savedDynamic    = dynamicClient
+		savedActive     = activeClients
 		savedGeneration = activeClientGeneration
 		savedInit       = initializationStarted
 		savedDirCount   = kubeconfigDirectoryFileCount
@@ -68,6 +69,7 @@ func restoreClientGlobals(t *testing.T) {
 		k8sConfig = savedConfig
 		discoveryClient = savedDiscovery
 		dynamicClient = savedDynamic
+		activeClients = savedActive
 		activeClientGeneration = savedGeneration
 		initializationStarted = savedInit
 		kubeconfigDirectoryFileCount = savedDirCount
```

---

### Incident Patch 3: `c9a16690` (2026-11-18)
**Commit Message**: fix: don't keep a failed apiserver check as the answer (#2722)

## Description

Second of the two PRs proposed in #2718 (the first is #2719). A check
that failed was kept as an answer; now it is reported, cached briefly,
and retried with a back-off.

- **Capabilities.** `CheckCapabilitiesForUser` discarded SAR errors, so
a timed-out check read as denied and the all-false result was cached for
60s (then kept another 60s by `useCapabilities`). It now records errors
from the cluster-wide check and the namespace fallback, as
`CheckNamespaceCapabilitiesForUser` already does: the answer still fails
closed, but it is cached for 5s, and the response carries an optional
`checksIncomplete`. `CheckCapabilities` (auth off) already failed closed
with a 5s TTL and now sets the flag too, as does `handleCapabilities`
when a namespace check errored.
- **Server version.** `GetServerVersion` kept an empty version after a
failed first read until the next context switch (`sync.Once`). Only a
successful read is cached now. Callers arriving during a read share it,
the lock isn't held across the network call, a read a context switch
invalidated isn't cached, and for 5s after a failure callers get `""` at


**File**: `internal/k8s/capabilities.go` (modified, +73/-12)
```diff
@@ -22,6 +22,7 @@ import (
 	pkgauth "github.com/skyhook-io/radar/pkg/auth"
 	"github.com/skyhook-io/radar/pkg/capacityapi"
 	"github.com/skyhook-io/radar/pkg/k8score"
+	"golang.org/x/sync/singleflight"
 )
 
 // ResourcePermissions indicates which resource types the user can list/watch
@@ -138,6 +139,10 @@ type Capabilities struct {
 	Karpenter              IntegrationCapability    `json:"karpenter"`               // Per-request Karpenter discovery + NodePool read state; populated by the HTTP layer after user SAR.
 	PolicyReports          *PolicyReportStatus      `json:"policyReports,omitempty"` // Why the Kyverno PolicyReport index is (or is not) populated, so an empty policy view can say which.
 	CloudConnect           *CloudConnectCapability  `json:"cloudConnect,omitempty"`
+	// ChecksIncomplete: an access check errored, so a false above may be a
+	// failed check rather than a denial. The server re-checks after a short
+	// TTL; the UI should refetch soon.
+	ChecksIncomplete bool `json:"checksIncomplete,omitempty"`
 
 	// HelmWriteUnavailable records a failed or unavailable Helm-write lookup from CheckCapabilities.
 	// It is internal preflight state, not a wire capability.
@@ -450,7 +455,8 @@ func CheckCapabilities(ctx context.Context) (*Capabilities, error) {
 	// Cache the result. Use a short TTL if API errors caused fail-closed results,
 	// so transient K8s API failures don't hide UI controls for a full minute.
 	ttl := capabilitiesTTL
-	if hadErrors.Load() {
+	caps.ChecksIncomplete = hadErrors.Load()
+	if caps.ChecksIncomplete {
 		ttl = capabilitiesErrorTTL
 		log.Printf("Warning: capability checks had API errors, using short cache TTL (%v)", ttl)
 	}
@@ -598,8 +604,18 @@ var (
 type userCapEntry struct {
 	caps      *Capabilities
 	expiresAt time.Time
+	// lastGood is the newest complete result while later checks fail, taken
+	// at goodAt; it is served during a re-check, never past lastGoodMaxAge.
+	lastGood *Capabilities
+	goodAt   time.Time
 }
 
+// userCapabilitiesFlight runs one check per identity at a time: each costs
+// up to two SubjectAccessReviews per capability.
+var userCapabilitiesFlight singleflight.Group
+
+const lastGoodMaxAge = 2 * time.Minute
+
 type userNSCapEntry struct {
 	caps      NamespaceCapabilities
 	expiresAt time.Time
@@ -611,24 +627,50 @@ func userNamespaceCapabilitiesCacheKey(username string, groups []string, namespa
 
 // CheckCapabilitiesForUser runs SubjectAccessReview as the given user
 // to determine what the user can do (exec, logs, delete, helm, etc.)
-// Results are cached per identity (username + groups) with 60s TTL.
+// Results are cached per identity (username + groups) with 60s TTL, or 5s
+// when a check errored (the result then fails closed and says so).
+// Concurrent callers for one identity share a single check; while the
+// re-check after a failed one runs, callers get the last complete result.
 func CheckCapabilitiesForUser(ctx context.Context, username string, groups []string) (*Capabilities, error) {
 	identityKey := pkgauth.IdentityCacheKey(username, groups)
+	var lastGood *Capabilities
 	if entry, ok := userCapabilitiesCache.Load(identityKey); ok {
 		e := entry.(*userCapEntry)
 		if time.Now().Before(e.expiresAt) {
 			caps := *e.caps
 			return &caps, nil
 		}
+		if e.lastGood != nil && time.Since(e.goodAt) < lastGoodMaxAge {
+			lastGood = e.lastGood
+		}
 	}
 
+	ch := userCapabilitiesFlight.DoChan(identityKey, func() (any, error) {
+		return checkCapabilitiesForUser(identityKey, username, groups), nil
+	})
+	var shared *Capabilities
+	if lastGood != nil {
+		select {
+		case r := <-ch:
+			shared = r.Val.(*Capabilities)
+		default:
+			shared = lastGood
+		}
+	} else {
+		shared = (<-ch).Val.(*Capabilities)
+	}
+	caps := *shared
+	return &caps, nil
+}
+
+func checkCapabilitiesForUser(identityKey, username string, groups []string) *Capabilities {
 	k8sClient := GetClient()
 	if k8sClient == nil {
-		return &Capabilities{}, nil
+		return &Capabilities{}
 	}
 
 	if GetConnectionStatus().State == StateDisconnected {
-		return &Capabilities{}, nil
+		return &Capabilities{}
 	}
 
 	checkCtx, cancel := NewOperationContext(10 * time.Second)
@@ -657,28 +699,35 @@ func CheckCapabilitiesForUser(ctx context.Context, username string, groups []str
 		{group: "argoproj.io", resource: "rollouts", verb: "patch", result: &caps.WorkloadWrites.Rollouts},
 	}
 
+	var hadErrors atomic.Bool
 	var wg sync.WaitGroup
 	wg.Add(len(checks))
 
 	for _, check := range checks {
 		go func(c capCheck) {
 			defer wg.Done()
-			allowed, _ := canIAs(checkCtx, k8sClient, username, groups, "", c.group, c.resource, c.verb)
+			allowed, apiErr := canIAs(checkCtx, k8sClient, username, groups, "", c.group, c.resource, c.verb)
 			if allowed {
 				*c.result = true
 				return
 			}
 			// Try namespace-scoped fallback
 			if fallbackNs := capabilityProbeNamespace(); fallbackNs != "" && c.namespaceFallback {
-				allowed, _ = canIAs(checkCtx, k8sClient, username, groups, fal
```

**File**: `internal/k8s/capabilities_user_errors_test.go` (added, +125/-0)
```diff
@@ -0,0 +1,125 @@
+package k8s
+
+import (
+	"encoding/json"
+	"net/http"
+	"net/http/httptest"
+	"sync/atomic"
+	"testing"
+
+	authv1 "k8s.io/api/authorization/v1"
+	"k8s.io/client-go/kubernetes"
+	"k8s.io/client-go/rest"
+)
+
+// A SubjectAccessReview that errors (a timeout behind the informer start)
+// is not a denial: the all-false result must not be served from cache once
+// the apiserver answers, and the response must say the checks were incomplete.
+func TestCheckCapabilitiesForUserDoesNotCacheFailedChecks(t *testing.T) {
+	var failing atomic.Bool
+	failing.Store(true)
+	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
+		if failing.Load() {
+			http.Error(w, "timeout", http.StatusGatewayTimeout)
+			return
+		}
+		var review authv1.SubjectAccessReview
+		if err := json.NewDecoder(r.Body).Decode(&review); err != nil {
+			http.Error(w, "bad review", http.StatusBadRequest)
+			return
+		}
+		review.Status.Allowed = true
+		w.Header().Set("Content-Type", "application/json")
+		_ = json.NewEncoder(w).Encode(review)
+	}))
+	t.Cleanup(server.Close)
+
+	client, err := kubernetes.NewForConfig(&rest.Config{Host: server.URL, ContentConfig: rest.ContentConfig{ContentType: "application/json"}})
+	if err != nil {
+		t.Fatal(err)
+	}
+	clientMu.Lock()
+	oldClient := k8sClient
+	k8sClient = client
+	clientMu.Unlock()
+	InvalidateUserCapabilitiesCache()
+	t.Cleanup(func() {
+		clientMu.Lock()
+		k8sClient = oldClient
+		clientMu.Unlock()
+		InvalidateUserCapabilitiesCache()
+	})
+
+	caps, err := CheckCapabilitiesForUser(t.Context(), "alice", nil)
+	if err != nil {
+		t.Fatal(err)
+	}
+	if caps.Exec || caps.Logs {
+		t.Fatalf("failed checks must fail closed, got exec=%v logs=%v", caps.Exec, caps.Logs)
+	}
+	if !caps.ChecksIncomplete {
+		t.Error("failed checks must be reported as incomplete")
+	}
+
+	failing.Store(false)
+	userCapabilitiesCache.Range(func(key, value any) bool {
+		// Past the short error TTL, still well inside the full one.
+		value.(*userCapEntry).expiresAt = value.(*userCapEntry).expiresAt.Add(-capabilitiesErrorTTL)
+		return true
+	})
+	caps, err = CheckCapabilitiesForUser(t.Context(), "alice", nil)
+	if err != nil {
+		t.Fatal(err)
+	}
+	if !caps.Exec || !caps.Logs || caps.ChecksIncomplete {
+		t.Errorf("after the apiserver answers, got exec=%v logs=%v incomplete=%v; want the real grant", caps.Exec, caps.Logs, caps.ChecksIncomplete)
+	}
+}
+
+// A namespace fallback that grants access is a settled answer even when the
+// cluster-wide check errored: re-checking cannot change what the UI shows.
+func TestCheckCapabilitiesForUserFallbackGrantIsComplete(t *testing.T) {
+	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
+		var review authv1.SubjectAccessReview
+		if err := json.NewDecoder(r.Body).Decode(&review); err != nil {
+			http.Error(w, "bad review", http.StatusBadRequest)
+			return
+		}
+		attrs := review.Spec.ResourceAttributes
+		if attrs != nil && attrs.Subresource == "exec" && attrs.Namespace == "" {
+			http.Error(w, "timeout", http.StatusGatewayTimeout)
+			return
+		}
+		review.Status.Allowed = true
+		w.Header().Set("Content-Type", "application/json")
+		_ = json.NewEncoder(w).Encode(review)
+	}))
+	t.Cleanup(server.Close)
+
+	client, err := kubernetes.NewForConfig(&rest.Config{Host: server.URL, ContentConfig: rest.ContentConfig{ContentType: "application/json"}})
+	if err != nil {
+		t.Fatal(err)
+	}
+	clientMu.Lock()
+	oldClient, oldNs := k8sClient, contextNamespace
+	k8sClient, contextNamespace = client, "team-a"
+	clientMu.Unlock()
+	InvalidateUserCapabilitiesCache()
+	t.Cleanup(func() {
+		clientMu.Lock()
+		k8sClient, contextNamespace = oldClient, oldNs
+		clientMu.Unlock()
+		InvalidateUserCapabilitiesCache()
+	})
+
+	caps, err := CheckCapabilitiesForUser(t.Context(), "alice", nil)
+	if err != nil {
+		t.Fatal(err)
+	}
+	if !caps.Exec {
+		t.Fatal("namespace fallback grant must still be reported")
+	}
+	if caps.ChecksIncomplete {
+		t.Error("a namespace fallback grant must be a settled answer even when the cluster-wide check errored")
+	}
+}
```

**File**: `internal/k8s/capabilities_user_flight_test.go` (added, +157/-0)
```diff
@@ -0,0 +1,157 @@
+package k8s
+
+import (
+	"encoding/json"
+	"net/http"
+	"net/http/httptest"
+	"sync"
+	"sync/atomic"
+	"testing"
+	"time"
+
+	authv1 "k8s.io/api/authorization/v1"
+	"k8s.io/client-go/kubernetes"
+	"k8s.io/client-go/rest"
+)
+
+// sarServer answers every SubjectAccessReview as allowed, or with a 504 while
+// failing is set, after waiting on gate when it is non-nil.
+type sarServer struct {
+	reviews atomic.Int32
+	failing atomic.Bool
+	gate    atomic.Pointer[chan struct{}]
+}
+
+// hold makes reviews wait until the returned release runs (also at cleanup).
+func (s *sarServer) hold(t *testing.T) (release func()) {
+	gate := make(chan struct{})
+	s.gate.Store(&gate)
+	var once sync.Once
+	release = func() { once.Do(func() { s.gate.Store(nil); close(gate) }) }
+	t.Cleanup(release)
+	return release
+}
+
+func useSARServer(t *testing.T) *sarServer {
+	t.Helper()
+	s := &sarServer{}
+	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
+		s.reviews.Add(1)
+		if g := s.gate.Load(); g != nil {
+			<-*g
+		}
+		if s.failing.Load() {
+			http.Error(w, "timeout", http.StatusGatewayTimeout)
+			return
+		}
+		var review authv1.SubjectAccessReview
+		if err := json.NewDecoder(r.Body).Decode(&review); err != nil {
+			http.Error(w, "bad review", http.StatusBadRequest)
+			return
+		}
+		review.Status.Allowed = true
+		w.Header().Set("Content-Type", "application/json")
+		_ = json.NewEncoder(w).Encode(review)
+	}))
+	t.Cleanup(server.Close)
+	client, err := kubernetes.NewForConfig(&rest.Config{Host: server.URL, ContentConfig: rest.ContentConfig{ContentType: "application/json"}})
+	if err != nil {
+		t.Fatal(err)
+	}
+	clientMu.Lock()
+	oldClient, oldNs := k8sClient, contextNamespace
+	k8sClient, contextNamespace = client, ""
+	clientMu.Unlock()
+	InvalidateUserCapabilitiesCache()
+	t.Cleanup(func() {
+		clientMu.Lock()
+		k8sClient, contextNamespace = oldClient, oldNs
+		clientMu.Unlock()
+		InvalidateUserCapabilitiesCache()
+	})
+	return s
+}
+
+func expireUserCapabilities() {
+	userCapabilitiesCache.Range(func(_, value any) bool {
+		value.(*userCapEntry).expiresAt = time.Now().Add(-time.Second)
+		return true
+	})
+}
+
+// Concurrent requests from one identity share one round of reviews.
+func TestCheckCapabilitiesForUserCoalescesConcurrentChecks(t *testing.T) {
+	s := useSARServer(t)
+	if _, err := CheckCapabilitiesForUser(t.Context(), "alice", nil); err != nil {
+		t.Fatal(err)
+	}
+	perRound := s.reviews.Swap(0)
+	InvalidateUserCapabilitiesCache()
+
+	release := s.hold(t)
+	var wg sync.WaitGroup
+	results := make([]*Capabilities, 8)
+	for i := range results {
+		wg.Add(1)
+		go func() {
+			defer wg.Done()
+			results[i], _ = CheckCapabilitiesForUser(t.Context(), "alice", nil)
+		}()
+	}
+	time.Sleep(200 * time.Millisecond)
+	release()
+	wg.Wait()
+	if got := s.reviews.Load(); got != perRound {
+		t.Errorf("8 concurrent checks sent %d reviews, want one round of %d", got, perRound)
+	}
+	for i, caps := range results {
+		if caps == nil || !caps.Exec {
+			t.Fatalf("caller %d got %+v", i, caps)
+		}
+		if i > 0 && caps == results[0] {
+			t.Fatal("callers share one *Capabilities")
+		}
+	}
+}
+
+// After a failed check, the re-check doesn't hold callers or hand them the
+// fail-closed answer while it runs: they get the last complete result.
+func TestCheckCapabilitiesForUserServesLastGoodDuringRecheck(t *testing.T) {
+	s := useSARServer(t)
+	if caps, _ := CheckCapabilitiesForUser(t.Context(), "alice", nil); !caps.Exec || caps.ChecksIncomplete {
+		t.Fatalf("first check = %+v", caps)
+	}
+	s.failing.Store(true)
+	expireUserCapabilities()
+	if caps, _ := CheckCapabilitiesForUser(t.Context(), "alice", nil); caps.Exec || !caps.ChecksIncomplete {
+		t.Fatalf("failed check = %+v, want fail-closed and incomplete", caps)
+	}
+
+	s.failing.Store(false)
+	release := s.hold(t)
+	expireUserCapabilities()
+	done := make(chan *Capabilities, 1)
+	go func() {
+		caps, _ := CheckCapabilitiesForUser(t.Context(), "alice", nil)
+		done <- caps
+	}()
+	select {
+	case caps := <-done:
+		if !caps.Exec || caps.ChecksIncomplete {
+			t.Errorf("during the re-check got %+v, want the last complete result", caps)
+		}
+	case <-time.After(2 * time.Second):
+		t.Fatal("caller waited on the re-check")
+	}
+	release()
+	deadline := time.Now().Add(5 * time.Second)
+	for {
+		if caps, _ := CheckCapabilitiesForUser(t.Context(), "alice", nil); !caps.ChecksIncomplete {
+			break
+		}
+		if time.Now().After(deadline) {
+			t.Fatal("the re-check never replaced the failed answer")
+		}
+		time.Sleep(20 * time.Millisecond)
+	}
+}
```

**File**: `internal/k8s/cluster_detection.go` (modified, +70/-14)
```diff
@@ -23,24 +23,76 @@ var (
 )
 
 var (
-	cachedServerVersion string
-	serverVersionOnce   = new(sync.Once)
-	serverVersionMu     sync.Mutex
+	serverVersionMu       sync.Mutex
+	cachedServerVersion   string
+	serverVersionInFlight *serverVersionRead
+	serverVersionFailedAt time.Time
 )
 
-// GetServerVersion returns the cached Kubernetes server version.
-// The version is fetched once and cached for the lifetime of the context.
+// serverVersionRetryAfter answers "" without a new read for a while after a
+// failure, so callers during an outage don't each wait out the client timeout.
+const serverVersionRetryAfter = 5 * time.Second
+
+type serverVersionRead struct {
+	done        chan struct{}
+	version     string
+	invalidated bool // guarded by serverVersionMu
+}
+
+// GetServerVersion returns the Kubernetes server version, read once per
+// context. A failed read is not kept: a call after serverVersionRetryAfter asks
+// again, while callers that arrive during a read wait for it instead of
+// starting their own.
 func GetServerVersion() string {
 	serverVersionMu.Lock()
-	defer serverVersionMu.Unlock()
-	serverVersionOnce.Do(func() {
-		if client := GetClient(); client != nil {
-			if v, err := client.Discovery().ServerVersion(); err == nil {
-				cachedServerVersion = v.GitVersion
-			}
+	if cachedServerVersion != "" {
+		defer serverVersionMu.Unlock()
+		return cachedServerVersion
+	}
+	if time.Since(serverVersionFailedAt) < serverVersionRetryAfter {
+		serverVersionMu.Unlock()
+		return ""
+	}
+	if read := serverVersionInFlight; read != nil {
+		serverVersionMu.Unlock()
+		<-read.done
+		return serverVersionOrRetry(read)
+	}
+	read := &serverVersionRead{done: make(chan struct{})}
+	serverVersionInFlight = read
+	serverVersionMu.Unlock()
+
+	if client := GetClient(); client != nil {
+		if v, err := client.Discovery().ServerVersion(); err == nil {
+			read.version = v.GitVersion
 		}
-	})
-	return cachedServerVersion
+	}
+
+	serverVersionMu.Lock()
+	// A context switch during the read invalidated it; don't cache the
+	// previous cluster's version.
+	if serverVersionInFlight == read {
+		serverVersionInFlight = nil
+		cachedServerVersion = read.version
+		if read.version == "" {
+			serverVersionFailedAt = time.Now()
+		}
+	}
+	serverVersionMu.Unlock()
+	close(read.done)
+	return serverVersionOrRetry(read)
+}
+
+// serverVersionOrRetry asks again when a context switch invalidated the read,
+// so no caller gets the previous cluster's version.
+func serverVersionOrRetry(read *serverVersionRead) string {
+	serverVersionMu.Lock()
+	invalidated := read.invalidated
+	serverVersionMu.Unlock()
+	if invalidated {
+		return GetServerVersion()
+	}
+	return read.version
 }
 
 // InvalidateServerVersionCache resets the cached server version.
@@ -49,7 +101,11 @@ func InvalidateServerVersionCache() {
 	serverVersionMu.Lock()
 	defer serverVersionMu.Unlock()
 	cachedServerVersion = ""
-	serverVersionOnce = new(sync.Once)
+	if serverVersionInFlight != nil {
+		serverVersionInFlight.invalidated = true
+	}
+	serverVersionInFlight = nil
+	serverVersionFailedAt = time.Time{}
 }
 
 // ClusterInfo contains detected cluster information
```

**File**: `internal/k8s/server_version_test.go` (added, +168/-0)
```diff
@@ -0,0 +1,168 @@
+package k8s
+
+import (
+	"encoding/json"
+	"net/http"
+	"net/http/httptest"
+	"sync"
+	"sync/atomic"
+	"testing"
+
+	"k8s.io/apimachinery/pkg/version"
+	"k8s.io/client-go/kubernetes"
+	"k8s.io/client-go/rest"
+)
+
+func setServerVersionClient(t *testing.T, handler http.HandlerFunc) {
+	t.Helper()
+	server := httptest.NewServer(handler)
+	t.Cleanup(server.Close)
+	client, err := kubernetes.NewForConfig(&rest.Config{Host: server.URL})
+	if err != nil {
+		t.Fatal(err)
+	}
+	InvalidateServerVersionCache()
+	previous := SetTestClient(client)
+	t.Cleanup(func() {
+		SetTestClient(previous)
+		InvalidateServerVersionCache()
+	})
+}
+
+func writeVersion(w http.ResponseWriter) {
+	w.Header().Set("Content-Type", "application/json")
+	_ = json.NewEncoder(w).Encode(version.Info{GitVersion: "v1.31.2"})
+}
+
+// A failed version read (a timeout behind the informer start) must not stick
+// until the next context switch; a successful one is read once.
+func TestGetServerVersionRetriesAfterFailureAndKeepsSuccess(t *testing.T) {
+	var failing atomic.Bool
+	var reads atomic.Int32
+	failing.Store(true)
+	setServerVersionClient(t, func(w http.ResponseWriter, r *http.Request) {
+		reads.Add(1)
+		if failing.Load() {
+			http.Error(w, "timeout", http.StatusGatewayTimeout)
+			return
+		}
+		writeVersion(w)
+	})
+
+	if got := GetServerVersion(); got != "" {
+		t.Fatalf("failed read = %q, want empty", got)
+	}
+	failing.Store(false)
+	expireServerVersionFailure(t)
+	if got := GetServerVersion(); got != "v1.31.2" {
+		t.Fatalf("after the apiserver answers = %q, want v1.31.2", got)
+	}
+	before := reads.Load()
+	if got := GetServerVersion(); got != "v1.31.2" || reads.Load() != before {
+		t.Errorf("a successful version must be kept: got %q, reads %d -> %d", got, before, reads.Load())
+	}
+}
+
+// Concurrent callers share one in-flight read rather than each asking.
+func TestGetServerVersionSharesOneInFlightRead(t *testing.T) {
+	var reads atomic.Int32
+	entered := make(chan struct{})
+	release := make(chan struct{})
+	var once sync.Once
+	setServerVersionClient(t, func(w http.ResponseWriter, r *http.Request) {
+		reads.Add(1)
+		once.Do(func() { close(entered) })
+		<-release
+		writeVersion(w)
+	})
+
+	var wg sync.WaitGroup
+	wg.Add(1)
+	go func() { defer wg.Done(); GetServerVersion() }()
+	<-entered
+	for range 5 {
+		wg.Add(1)
+		go func() { defer wg.Done(); GetServerVersion() }()
+	}
+	close(release)
+	wg.Wait()
+	if n := reads.Load(); n != 1 {
+		t.Errorf("concurrent callers made %d reads, want 1", n)
+	}
+}
+
+func expireServerVersionFailure(t *testing.T) {
+	t.Helper()
+	serverVersionMu.Lock()
+	serverVersionFailedAt = serverVersionFailedAt.Add(-serverVersionRetryAfter)
+	serverVersionMu.Unlock()
+}
+
+// During an outage, callers right after a failed read get "" at once instead
+// of each waiting out the client timeout; the read is retried after the window.
+func TestGetServerVersionAnswersEmptyRightAfterFailure(t *testing.T) {
+	var failing atomic.Bool
+	var reads atomic.Int32
+	failing.Store(true)
+	setServerVersionClient(t, func(w http.ResponseWriter, r *http.Request) {
+		reads.Add(1)
+		if failing.Load() {
+			http.Error(w, "timeout", http.StatusGatewayTimeout)
+			return
+		}
+		writeVersion(w)
+	})
+
+	GetServerVersion()
+	failing.Store(false)
+	if got := GetServerVersion(); got != "" || reads.Load() != 1 {
+		t.Fatalf("right after a failure got %q with %d reads, want \"\" without a new read", got, reads.Load())
+	}
+	expireServerVersionFailure(t)
+	if got := GetServerVersion(); got != "v1.31.2" {
+		t.Errorf("after the retry window = %q, want v1.31.2", got)
+	}
+}
+
+// A context switch during a read: neither the reader nor a waiter returns the
+// previous cluster's version; both read again from the current client.
+func TestGetServerVersionInvalidatedReadAsksTheNewCluster(t *testing.T) {
+	entered := make(chan struct{})
+	release := make(chan struct{})
+	setServerVersionClient(t, func(w http.ResponseWriter, r *http.Request) {
+		close(entered)
+		<-release
+		writeVersion(w) // old cluster: v1.31.2
+	})
+	newServer := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
+		w.Header().Set("Content-Type", "application/json")
+		_ = json.NewEncoder(w).Encode(version.Info{GitVersion: "v1.33.0"})
+	}))
+	t.Cleanup(newServer.Close)
+	newClient, err := kubernetes.NewForConfig(&rest.Config{Host: newServer.URL})
+	if err != nil {
+		t.Fatal(err)
+	}
+
+	results := make(chan string, 2)
+	go func() { results <- GetServerVersion() }()
+	<-entered
+	go func() { results <- GetServerVersion() }()
+	// Let the waiter queue behind the in-flight read before the switch.
+	for {
+		serverVersionMu.Lock()
+		inFlight := serverVersionInFlight != nil
+		serverVersionMu.Unlock()
+		if inFlight {
+			break
+		}
+	}
+	SetTestClient(newClient)
+	InvalidateServerVersionCache()
+	close(release)
+	for range 2 {
+		if got := <-results; got != "v1.33.0" {
+			t.Errorf("after the switch got %q, w
```

**File**: `internal/server/namespaces_failure_test.go` (added, +98/-0)
```diff
@@ -0,0 +1,98 @@
+package server
+
+import (
+	"encoding/json"
+	"net/http"
+	"net/http/httptest"
+	"testing"
+	"time"
+
+	"k8s.io/client-go/kubernetes/fake"
+
+	"github.com/skyhook-io/radar/internal/k8s"
+	"github.com/skyhook-io/radar/pkg/k8score"
+	"github.com/skyhook-io/radar/pkg/readreason"
+)
+
+func decodeNamespacesResponse(t *testing.T, resp *http.Response) (int, any) {
+	t.Helper()
+	defer resp.Body.Close()
+	var body any
+	if err := json.NewDecoder(resp.Body).Decode(&body); err != nil {
+		t.Fatalf("decode: %v", err)
+	}
+	return resp.StatusCode, body
+}
+
+// A caller whose namespace access couldn't be determined is told to retry,
+// not handed an empty list that reads as "no namespaces".
+func TestNamespacesReportsFailedAccessCheck(t *testing.T) {
+	fakeNamespaceAPIServer(t, http.StatusOK, http.StatusInternalServerError, "default")
+	env := newAuthTestServer(t)
+	status, body := decodeNamespacesResponse(t, env.authGet(t, "/api/namespaces", "alice", ""))
+	if m, _ := body.(map[string]any); status != http.StatusServiceUnavailable || m["error_code"] != string(readreason.UserPermissionCheckFailed) {
+		t.Fatalf("got %d %v, want 503 %s", status, body, readreason.UserPermissionCheckFailed)
+	}
+}
+
+// Without a Namespaces informer the list comes from Radar's own LIST. A LIST
+// that failed is reported; one that was denied still answers with the
+// namespaces Radar was configured with.
+func TestNamespacesWithoutInformerReportsFailedList(t *testing.T) {
+	t.Cleanup(func() {
+		k8s.ResetResourceCache()
+		if err := k8s.InitTestResourceCache(testFakeClient); err != nil {
+			t.Fatalf("restore package fixture cache: %v", err)
+		}
+	})
+	k8s.ResetResourceCache()
+	if err := k8s.InitTestResourceCacheFromConfig(k8score.CacheConfig{
+		Client:              fake.NewClientset(),
+		ResourceTypes:       map[string]bool{"configmaps": true},
+		ResourceScopes:      map[string]k8score.ResourceScope{"configmaps": {Enabled: true, Namespace: "default"}},
+		DeferredSyncTimeout: time.Hour,
+	}); err != nil {
+		t.Fatal(err)
+	}
+	if k8s.GetResourceCache().Namespaces() != nil {
+		t.Fatal("fixture must have no Namespaces informer")
+	}
+	prevNs := k8s.SetTestContextNamespace("default")
+	t.Cleanup(func() { k8s.SetTestContextNamespace(prevNs) })
+
+	srv := New(Config{DevMode: true})
+	ts := httptest.NewServer(srv.Handler())
+	t.Cleanup(func() {
+		ts.Close()
+		srv.Stop()
+	})
+
+	for _, tc := range []struct {
+		name       string
+		listStatus int
+		wantStatus int
+		wantCode   string
+	}{
+		{"list fails", http.StatusInternalServerError, http.StatusInternalServerError, string(readreason.ReadError)},
+		{"list denied", http.StatusForbidden, http.StatusOK, ""},
+	} {
+		t.Run(tc.name, func(t *testing.T) {
+			fakeNamespaceAPIServer(t, tc.listStatus, http.StatusForbidden)
+			resp, err := http.Get(ts.URL + "/api/namespaces")
+			if err != nil {
+				t.Fatal(err)
+			}
+			status, body := decodeNamespacesResponse(t, resp)
+			if status != tc.wantStatus {
+				t.Fatalf("status = %d (%v), want %d", status, body, tc.wantStatus)
+			}
+			if tc.wantCode != "" {
+				if m, _ := body.(map[string]any); m["error_code"] != tc.wantCode {
+					t.Errorf("body = %v, want error_code %s", body, tc.wantCode)
+				}
+			} else if list, _ := body.([]any); len(list) != 1 {
+				t.Errorf("denied LIST body = %v, want the context namespace", body)
+			}
+		})
+	}
+}
```

**File**: `internal/server/server.go` (modified, +14/-2)
```diff
@@ -1638,6 +1638,9 @@ func (s *Server) handleCapabilities(w http.ResponseWriter, r *http.Request) {
 			log.Printf("[capabilities] namespace-scoped check for %q failed: %v", ns, err)
 		} else if nsCaps != nil {
 			mergeNamespaceCapabilities(caps, nsCaps)
+			if nsCaps.Errors != (k8s.NamespaceCapabilityErrors{}) {
+				caps.ChecksIncomplete = true
+			}
 		}
 	}
 
@@ -2242,8 +2245,12 @@ func (s *Server) handleNamespaces(w http.ResponseWriter, r *http.Request) {
 	// permCache.Get back after a transient discovery failure conflates
 	// "cluster-admin sentinel" with "cache miss" and would silently leak the
 	// full namespace list to a restricted user during apiserver flakes.
-	allowedNames := s.parseNamespacesForUser(r)
+	allowedNames, discoveryFailed := s.parseNamespacesForUserWithStatus(r)
 	if allowedNames != nil && len(allowedNames) == 0 {
+		if discoveryFailed {
+			s.writeCollectionFailure(w, "namespaces", permissionFailure(false, ""))
+			return
+		}
 		s.writeJSON(w, []map[string]any{})
 		return
 	}
@@ -2261,7 +2268,12 @@ func (s *Server) handleNamespaces(w http.ResponseWriter, r *http.Request) {
 		// GetAccessibleNamespaces (SA-listed). Apply the same per-user
 		// filter so restricted users don't see SA-visible names they
 		// have no access to.
-		accessible, _ := k8s.GetAccessibleNamespaces(r.Context())
+		accessible, source := k8s.GetAccessibleNamespacesWithSource(r.Context())
+		if source == k8s.NamespaceListFailed {
+			// The seeds alone would read as the whole list.
+			s.writeCollectionFailure(w, "namespaces", readFailuref(readreason.ReadError, "Radar couldn't list namespaces; retry shortly"))
+			return
+		}
 		result := make([]map[string]any, 0, len(accessible))
 		for _, name := range accessible {
 			if allowedSet != nil && !allowedSet[name] {
```

**File**: `packages/k8s-ui/src/types/core.ts` (modified, +3/-0)
```diff
@@ -154,6 +154,9 @@ export interface Capabilities {
   // Which Cloud-connect lane this deployment gets. Optional on the wire:
   // older backends don't advertise it — consumers fall back to wizard links.
   cloudConnect?: CloudConnectCapability
+  // An access check errored, so a false above may be unanswered rather than
+  // denied. Older Radars never send it.
+  checksIncomplete?: boolean
 }
 
 // CloudConnectCapability picks the Cloud funnel's connect lane: 'driver'
```

#### Recent Merged Pull Requests:
- **PR #2800** (2026-11-19): Velero: read crons restricting both day fields as the server's Velero version does (@nadaverell)
- **PR #2799** (2026-11-19): Velero: Delete object for a backup Velero never stored (@nadaverell)
- **PR #2798** (2026-11-19): Report the upload script's exit when it ends before the body arrives (@nadaverell)
- **PR #2797** (2026-11-19): Make the mid-upload directory test wait until the script is reading the body (@nadaverell)
- **PR #2795** (2026-11-19): Stop every Managed By at the first GitOps manager above an object (@nadaverell)
- **PR #2794** (2026-11-19): Say what a reference's state means in get_resource; spell an unchecked one access_unverified (@nadaverell)

---

## 3. Empirical Evidence & Compliance Certification
- **Evidence Provenance**: Fetched directly from verified official GitHub REST API.
- **Zero Disk Footprint**: 0 bytes of unnecessary repository bloat stored locally.
- **TOS & Free-Tier Adherence**: Request pace complied with public API guidelines without fee, penalty, or unauthorized scraping.

---

## 4. Promotion & Integration Status
- **Status**: HARVESTED_DEEP_FORENSIC
- **Master Brain Sync**: Auto-committed to local/remote Master Brain repository.


## 3. Application to AI-Builder-Brain Project Construction
- **Applied Blueprints**: `astro-tailwind-v4`, `fullstack-ai-saas`, `universal-native-factory`
- **Regression Shield**: Prevents architectural drift across construction cycles.
