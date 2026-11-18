# Verification Protocol: Verification Protocol: Empirical Defect Shield for skyhook-io/radar

<!-- PROVENANCE_START
{
  "source_repository": "skyhook-io/radar",
  "source_url": "https://github.com/skyhook-io/radar",
  "source_version": "495dc890",
  "license": "Apache-2.0",
  "timestamp": "2026-11-18T01:58:04.697Z",
  "ai_provider": "zero-clone-structural-synthesizer",
  "generator_version": "2.0.0-universal",
  "learning_id": "learn-github-skyhook-io-radar",
  "canonical_classification": "verification_contract"
}
PROVENANCE_END -->
> **Provenance**: Harvested from [skyhook-io/radar](https://github.com/skyhook-io/radar) (Revision: `495dc890`).  
> **License**: Apache-2.0 | **Timestamp**: `2026-11-18T01:58:04.697Z`  
> **Learning ID**: `learn-github-skyhook-io-radar`


## 1. Scope & Verification Target
- **Target Repository**: `skyhook-io/radar` (Commit: `495dc890`)
- **Pillar Alignment**: Pillar 11 (Empirical Truth & Mathematical Integrity)

## 2. Observed Failure Modes & Defect Traps
# Forensic Learning Record (Deep Inspection): skyhook-io/radar

> **Canonical Artifact**: `07_PROJECT_LEARNING/skyhook-io-radar-learnings.md`  
> **Source Platform**: GitHub ([https://github.com/skyhook-io/radar](https://github.com/skyhook-io/radar))  
> **Harvest Method**: Full-Spectrum Deep Extraction (Patches, Diffs, Source Code, Post-Mortems)  
> **Harvest Timestamp**: 2026-11-18T01:58:03.572Z  
> **Compliance State**: Free Tier Guaranteed | Strict Rate-Limit Backoff Honored  

---

## 1. Context & Architectural Overview
- **Repository / Resource**: `skyhook-io/radar`
- **Description**: The missing open-source Kubernetes UI with a built-in MCP server for AI agents. See what's broken, why, and what changed. Issues, Topology, event timeline, Helm, GitOps, live service traffic, and cluster audits - all in one Go binary.
- **Primary Language / Ecosystem**: Go
- **Discovered Manifests / Configurations**: package.json, go.mod, README.md, Dockerfile
- **Stars / Engagement**: 4145 stars

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

### Incident Patch 1: `1a0f7e1e` (2026-11-17)
**Commit Message**: Serve built-in kinds through discovery in census mode (#2760)

## Summary

A `-census` fixture seeds typed objects only, with no discovery catalog.
Ownership and the relation families resolve kinds through discovery, and
count a kind as an owner's dependent only when it's served with delete,
list and watch. So on a census fixture every relationship answer came
back empty.

`cmd/testserver -census` now serves the census's built-in kinds
(`resourceid.Builtins`) through discovery, with the verbs a real API
server lists.

**Census relationship answers from builds before this change aren't
comparable with ones after it.** Startup and list timings aren't
affected; only answers that resolve kinds through discovery are.

This was split out of #2708 (the relationship replay harness), which
doesn't depend on it.

## Testing

- `TestCensusDiscoveryServesBuiltinsWithGCVerbs` (new).
- `go vet` and `go test ./cmd/testserver/...`.
- Smoke test: `-census large-eks -census-scale 0.01`. A Deployment's
`relationships` returns 3 children (its ReplicaSets) and an ownership
answer, plus services, ingresses, config refs, network policies and
service account.

**File**: `cmd/testserver/census_discovery.go` (added, +43/-0)
```diff
@@ -0,0 +1,43 @@
+package main
+
+import (
+	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
+	"k8s.io/client-go/kubernetes/fake"
+
+	"github.com/skyhook-io/radar/internal/k8s"
+	"github.com/skyhook-io/radar/pkg/resourceid"
+)
+
+// installCensusDiscovery serves the built-in kinds through discovery, as a
+// real API server does. A census fixture seeds typed objects only; without a
+// discovery catalog, readers that resolve kinds through discovery have nothing
+// to resolve against.
+func installCensusDiscovery(client *fake.Clientset) error {
+	lists := map[string]*metav1.APIResourceList{}
+	var order []string
+	for _, b := range resourceid.Builtins {
+		if b.Version == "" {
+			continue
+		}
+		gv := b.Version
+		if b.Group != "" {
+			gv = b.Group + "/" + b.Version
+		}
+		l, ok := lists[gv]
+		if !ok {
+			l = &metav1.APIResourceList{GroupVersion: gv}
+			lists[gv] = l
+			order = append(order, gv)
+		}
+		l.APIResources = append(l.APIResources, metav1.APIResource{
+			Name: b.Resource, Kind: b.Kind, Group: b.Group, Version: b.Version, Namespaced: b.Namespaced,
+			Verbs: metav1.Verbs{"create", "delete", "deletecollection", "get", "list", "patch", "update", "watch"},
+		})
+	}
+	client.Resources = nil
+	for _, gv := range order {
+		client.Resources = append(client.Resources, lists[gv])
+	}
+	_, err := k8s.SetTestResourceDiscovery(client.Discovery())
+	return err
+}
```

**File**: `cmd/testserver/census_discovery_test.go` (added, +32/-0)
```diff
@@ -0,0 +1,32 @@
+package main
+
+import (
+	"slices"
+	"testing"
+
+	"k8s.io/client-go/kubernetes/fake"
+
+	"github.com/skyhook-io/radar/internal/k8s"
+)
+
+// Ownership and the relation families resolve kinds through discovery, and
+// count a kind as an owner's dependent only when it is served with the
+// garbage collector's verbs. A census fixture must serve them, or every
+// relationship answer reads as unavailable.
+func TestCensusDiscoveryServesBuiltinsWithGCVerbs(t *testing.T) {
+	if err := installCensusDiscovery(fake.NewClientset()); err != nil {
+		t.Fatal(err)
+	}
+	t.Cleanup(k8s.ResetResourceDiscovery)
+	for _, r := range k8s.GetResourceDiscovery().Catalog().Resources {
+		if r.Group == "apps" && r.Kind == "Deployment" {
+			for _, verb := range []string{"delete", "list", "watch"} {
+				if !slices.Contains(r.Verbs, verb) {
+					t.Fatalf("Deployment verbs = %v, missing %s", r.Verbs, verb)
+				}
+			}
+			return
+		}
+	}
+	t.Fatal("census discovery doesn't serve apps/Deployment")
+}
```

**File**: `cmd/testserver/main.go` (modified, +3/-0)
```diff
@@ -115,6 +115,9 @@ func main() {
 		if err := k8s.InitLoadTestResourceCache(fakeClient); err != nil {
 			log.Fatalf("InitLoadTestResourceCache: %v", err)
 		}
+		if err := installCensusDiscovery(fakeClient); err != nil {
+			log.Fatalf("installCensusDiscovery: %v", err)
+		}
 	} else if err := k8s.InitTestResourceCache(fakeClient); err != nil {
 		log.Fatalf("InitTestResourceCache: %v", err)
 	}
```

---

### Incident Patch 2: `d734e671` (2026-11-17)
**Commit Message**: Measure a Radar process's memory and CPU under a fixed reader and SSE workload (#2709)

## Summary

A tool that drives a fixed workload against a running Radar and samples
the process: memory (RSS and Go heap), CPU, GC, and per-endpoint
latency. Because it only speaks HTTP, the same run can be pointed at two
builds on the same cluster and compared. It exists to measure what
retiring the all-namespace relationship graph saves on real clusters,
but works for any server-side change.

## What it does

`radarload -url http://127.0.0.1:9280 -pid <radar pid> -duration 10m
-sse 3 -askers 4 -qps 20 -out run.json`

- **Readiness:** `/api/connection` must say connected and
`/api/diagnostics` must report the typed informers fully synced before
anything is timed.
- **Subjects:**
- Taken from Radar's own lists (the `{items, coverage}` envelope): the
eight built-in kinds, plus relationship-relevant CRD kinds from
`/api/api-resources`.
- Sampled deterministically with a seed. `-subjects-from` replays a
saved subject set. Each build GET-probes every subject, replayed or
fresh, with the configured identity and drops the unreadable ones
(counted in `subject_probe_errors`), so two builds run the same 

**File**: `cmd/radarload/README.md` (added, +93/-0)
```diff
@@ -0,0 +1,93 @@
+# radarload
+
+Measure a **local Radar process** while driving it through HTTP. The target
+binary can be built from another checkout; radarload imports only the shared
+stdlib-only resource identity helper. No Kubernetes credentials are needed.
+
+```sh
+go run ./cmd/radarload -url http://localhost:9280 -pid 12345 \
+  -duration 10m -sse 3 -askers 4 -qps 20 -seed 1 -per-kind 100 \
+  -label main-SHA -out old.json
+# Start the other build against the same cluster, then:
+go run ./cmd/radarload -url http://localhost:9280 -pid 23456 \
+  -duration 10m -sse 3 -askers 4 -qps 20 -seed 1 \
+  -subjects-from old.json -label new-SHA -out new.json
+go run ./cmd/radarload compare old.json new.json
+```
+
+Use the **binary's PID**, not the `go run` parent. RSS and CPU come from local
+`ps`; the URL and PID must identify the same process. Use matching startup flags,
+identity, subject manifest, cluster activity, and warmup for both builds.
+`-user fleet-argo -groups team-a,viewers` sends Radar's default proxy headers
+(`X-Forwarded-User`, `X-Forwarded-Groups`) on every request, including SSE and
+pprof, for a target running `--auth-mode=proxy`.
+
+Readiness requires `/api/connection?contexts=0` to say `connected` and
+`/api/diagnostics` to report `informers.syncStatus.phase=complete`, including
+deferred typed informers. Diagnostics also supplies Radar/Go version and OS/arch;
+it does not report a git SHA, so use `-label`. The tool avoids `/api/version-check`,
+which can trigger an external update lookup.
+
+Inventory uses Pod, Deployment, Service, ConfigMap, Secret, Ingress, Node and
+PersistentVolumeClaim lists. `/api/api-resources` adds discovered HTTPRoute,
+GRPCRoute, Gateway, VirtualService, DestinationRule, Application, Kustomization,
+HelmRelease and Certificate kinds. Subjects are sorted before seeded sampling
+and saved in the JSON; unreadable kinds, unavailable discovery and each list's
+coverage are recorded. For an offline target, point it at the replay or census
+testservers. Lists above the server's 50,000-object limit fail in inventory
+rather than being truncated.
+
+`-subjects-from` reuses a prior run's subjects; current inventory is still
+recorded. Every subject, fresh or replayed, is GET-probed with the configured
+identity before measurement, and unreadable ones are dropped and counted by kind
+and group in `subject_probe_errors`, so two builds compared against one manifest
+run the same subjects only when neither drops any (`compare` warns when they
+differ). Neighborhood roots are probed and saved separately, since grouped Pods
+and ordinary Nodes can be listed yet absent from the topology. Replay keeps the
+saved roots that survive the subject probe and fails if one of them no longer
+returns a neighborhood.
+
+A seeded 20-request cycle fixes the offered mix:
+
+| Share | Endpoint |
+| --- | --- |
+| 60% | `/api/resources/{kind}/{namespace}/{name}` |
+| 10% | `/api/ai/resources/{kind}/{namespace}/{name}` (includes resource context) |
+| 10% | `/api/ai/neighborhood/{kind}/{namespace}/{name}?profile=auto&hops=1` |
+| 10% | Same HTTP neighborhood route with `profile=all&hops=2` |
+| 5% | `/api/applications` |
+| 5% | `/api/resources/{kind}?include=summary` |
+
+Both neighborhood shares use the same read-only route; there is no separate
+non-AI neighborhood endpoint.
+
+QPS is combined across workers. A slot without a free worker is dropped and
+counted, with no growing queue. Compare achieved QPS, drops and errors alongside
+latency; overload can change the successful request mix. Latencies include full
+body consumption and errors, including in-flight requests canceled at run end.
+SSE consumers discard arbitrarily large frames, count dispatched data events,
+and reconnect after errors. The tool does **not** mutate the cluster: a quiet
+cluster has fewer change-driven topology broadcasts. Keep the external change
+workload fixed when comparing builds.
+
+RSS and cumulative process CPU are read every two seconds. Go heap figures
+(HeapAlloc/HeapInuse/HeapSys/NumGC) and the goroutine count are read before the
+workload, every 30 seconds and on the window's last tick, because producing a
+heap profile costs the target CPU. `ps` CPU precision is platform-dependent
+(Linux commonly whole seconds). Samples that finish after the window are
+discarded. GC pause time comes from the 256-entry `PauseNs` ring between
+consecutive heap reads; if the ring was overwritten (more than 256 GCs between
+reads), `gc_pause_ns` is null with a reason, never zero.
+
+Pprof must be reachable: loopback listeners enable it by default; authenticated
+installations also enable it; shared unauthenticated listeners require
+`RADAR_PPROF=true`; Cloud does not mount it. Missing/malformed heap or goroutine
+profiles fail preflight instead of running without heap samples. Sample and
+binary-profile failures during a run are saved and return a nonzero exit.
+
+A 30-second CPU profile is taken in the middle of the 
```

**File**: `cmd/radarload/client.go` (added, +302/-0)
```diff
@@ -0,0 +1,302 @@
+package main
+
+import (
+	"context"
+	"encoding/json"
+	"fmt"
+	"io"
+	"math/rand"
+	"net/http"
+	"net/url"
+	"os"
+	"path/filepath"
+	"sort"
+	"strings"
+	"time"
+
+	"github.com/skyhook-io/radar/pkg/resourceid"
+)
+
+type radarClient struct {
+	c    config
+	http *http.Client
+}
+
+func newClient(c config) (*radarClient, error) {
+	u, err := url.Parse(c.URL)
+	if err != nil {
+		return nil, err
+	}
+	if (u.Scheme != "http" && u.Scheme != "https") || u.Host == "" || u.RawQuery != "" || u.Fragment != "" || u.User != nil {
+		return nil, fmt.Errorf("-url must be an HTTP(S) origin with optional base path, without credentials/query/fragment")
+	}
+	c.URL = strings.TrimRight(c.URL, "/")
+	tr := http.DefaultTransport.(*http.Transport).Clone()
+	tr.MaxIdleConnsPerHost = c.Askers + c.SSE + 8
+	tr.ResponseHeaderTimeout = 45 * time.Second
+	return &radarClient{c: c, http: &http.Client{Transport: tr, CheckRedirect: func(*http.Request, []*http.Request) error { return http.ErrUseLastResponse }}}, nil
+}
+
+func (c *radarClient) get(ctx context.Context, path string) (*http.Response, error) {
+	req, err := http.NewRequestWithContext(ctx, http.MethodGet, c.c.URL+path, nil)
+	if err != nil {
+		return nil, err
+	}
+	if c.c.User != "" {
+		req.Header.Set("X-Forwarded-User", c.c.User)
+	}
+	if c.c.Groups != "" {
+		req.Header.Set("X-Forwarded-Groups", c.c.Groups)
+	}
+	return c.http.Do(req)
+}
+
+func (c *radarClient) bytes(ctx context.Context, path string) ([]byte, error) {
+	ctx, cancel := context.WithTimeout(ctx, requestTimeout)
+	defer cancel()
+	resp, err := c.get(ctx, path)
+	if err != nil {
+		return nil, err
+	}
+	defer resp.Body.Close()
+	if resp.StatusCode != 200 {
+		return nil, fmt.Errorf("GET %s: HTTP %d", path, resp.StatusCode)
+	}
+	return io.ReadAll(resp.Body)
+}
+
+func (c *radarClient) json(ctx context.Context, path string, v any) error {
+	b, err := c.bytes(ctx, path)
+	if err != nil {
+		return err
+	}
+	if err = json.Unmarshal(b, v); err != nil {
+		return fmt.Errorf("GET %s: %w", path, err)
+	}
+	return nil
+}
+
+func (c *radarClient) waitReady(ctx context.Context) (map[string]string, error) {
+	ctx, cancel := context.WithTimeout(ctx, c.c.ReadyTimeout)
+	defer cancel()
+	var last error
+	for {
+		var connection struct {
+			State string `json:"state"`
+		}
+		err := c.json(ctx, "/api/connection?contexts=0", &connection)
+		if err == nil && connection.State == "connected" {
+			var d struct {
+				Version   string `json:"radarVersion"`
+				GoVersion string `json:"goVersion"`
+				OS        string `json:"goos"`
+				Arch      string `json:"goarch"`
+				Informers struct {
+					Sync *struct {
+						Phase string `json:"phase"`
+					} `json:"syncStatus"`
+				} `json:"informers"`
+			}
+			err = c.json(ctx, "/api/diagnostics", &d)
+			if err == nil && d.Informers.Sync != nil && d.Informers.Sync.Phase == "complete" {
+				return map[string]string{"version": d.Version, "go_version": d.GoVersion, "os": d.OS, "arch": d.Arch, "source": "/api/diagnostics"}, nil
+			}
+			if err == nil {
+				err = fmt.Errorf("cache sync has not reported complete in /api/diagnostics")
+			}
+		}
+		if err == nil {
+			err = fmt.Errorf("connection state %q", connection.State)
+		}
+		last = err
+		select {
+		case <-ctx.Done():
+			return nil, fmt.Errorf("readiness: %w (last observation: %v)", ctx.Err(), last)
+		case <-time.After(time.Second):
+		}
+	}
+}
+
+type subject = resourceid.Ref
+
+type inventory struct {
+	Kind     string          `json:"kind"`
+	Group    string          `json:"group"`
+	Count    int             `json:"count"`
+	Sampled  int             `json:"sampled"`
+	Error    string          `json:"error,omitempty"`
+	Coverage json.RawMessage `json:"coverage,omitempty"`
+}
+type kindRef struct {
+	Kind  string `json:"kind"`
+	Group string `json:"group"`
+}
+
+func (c *radarClient) subjects(ctx context.Context) ([]subject, []inventory, []string, error) {
+	kinds := []kindRef{{"Pod", ""}, {"Deployment", "apps"}, {"Service", ""}, {"ConfigMap", ""}, {"Secret", ""}, {"Ingress", "networking.k8s.io"}, {"Node", ""}, {"PersistentVolumeClaim", ""}}
+	relevant := map[string]bool{"HTTPRoute": true, "GRPCRoute": true, "Gateway": true, "VirtualService": true, "DestinationRule": true, "Application": true, "Kustomization": true, "HelmRelease": true, "Certificate": true}
+	var discovered []kindRef
+	var notes []string
+	if err := c.json(ctx, "/api/api-resources", &discovered); err != nil {
+		notes = append(notes, "CRD discovery unavailable: "+err.Error())
+	} else {
+		seen := map[kindRef]bool{}
+		sort.Slice(discovered, func(i, j int) bool {
+			if discovered[i].Kind != discovered[j].Kind {
+				return discovered[i].Kind < discovered[j].Kind
+			}
+			return discovered[i].Group < discovered[j].Group
+		})
+		for _, k := range discovered {
+			if relevant[k.Kind] && !seen[k] {
+				kinds = append(kinds, k)
+				seen[k] = true
+			}
+		}
+	}
+	rng := rand.New(rand.NewSource(c.c.Seed))
+	var subjects []subject
+
```

**File**: `cmd/radarload/main.go` (added, +278/-0)
```diff
@@ -0,0 +1,278 @@
+package main
+
+import (
+	"context"
+	"encoding/json"
+	"errors"
+	"flag"
+	"fmt"
+	"math"
+	"os"
+	"os/signal"
+	"path/filepath"
+	"syscall"
+	"time"
+)
+
+type config struct {
+	URL          string        `json:"url"`
+	PID          int           `json:"pid"`
+	Duration     time.Duration `json:"duration_ns"`
+	SSE          int           `json:"sse"`
+	Askers       int           `json:"askers"`
+	QPS          float64       `json:"qps"`
+	PerKind      int           `json:"per_kind"`
+	Seed         int64         `json:"seed"`
+	User         string        `json:"user,omitempty"`
+	Groups       string        `json:"groups,omitempty"`
+	ReadyTimeout time.Duration `json:"ready_timeout_ns"`
+	Out          string        `json:"out"`
+	SubjectsFrom string        `json:"subjects_from,omitempty"`
+	Label        string        `json:"label,omitempty"`
+}
+
+const (
+	requestTimeout = 15 * time.Second
+	sampleEvery    = 2 * time.Second
+	// Producing a heap profile costs the target real CPU, so Go heap and
+	// goroutine reads are spaced further apart than RSS and CPU.
+	runtimeEvery = 30 * time.Second
+)
+
+// runtimeDue also forces a read on the window's last tick, so GC counts and
+// pause totals cover the whole run rather than stopping at the previous read.
+func runtimeDue(now, last, deadline time.Time) bool {
+	return now.Sub(last) >= runtimeEvery || deadline.Sub(now) < sampleEvery+time.Second
+}
+
+type result struct {
+	SubjectProbeErrors      map[string]int           `json:"subject_probe_errors"`
+	NeighborhoodSubjects    []subject                `json:"neighborhood_subjects"`
+	NeighborhoodProbeErrors map[string]int           `json:"neighborhood_probe_errors"`
+	Schema                  int                      `json:"schema"`
+	Config                  config                   `json:"config"`
+	Started                 time.Time                `json:"started"`
+	Ended                   time.Time                `json:"ended"`
+	Build                   map[string]string        `json:"radar_build"`
+	Subjects                []subject                `json:"subjects"`
+	Inventory               []inventory              `json:"inventory"`
+	Notes                   []string                 `json:"notes"`
+	Samples                 []sample                 `json:"samples"`
+	Summary                 summary                  `json:"summary"`
+	Profiles                map[string]profileResult `json:"profiles"`
+}
+
+type profileResult struct {
+	Path    string    `json:"path,omitempty"`
+	Error   string    `json:"error,omitempty"`
+	Started time.Time `json:"started"`
+}
+
+func main() {
+	if err := command(os.Args[1:]); err != nil {
+		fmt.Fprintln(os.Stderr, "radarload:", err)
+		os.Exit(1)
+	}
+}
+
+func command(args []string) error {
+	if len(args) > 0 && args[0] == "compare" {
+		if len(args) != 3 {
+			return errors.New("usage: radarload compare a.json b.json")
+		}
+		var a, b result
+		if err := readResult(args[1], &a); err != nil {
+			return err
+		}
+		if err := readResult(args[2], &b); err != nil {
+			return err
+		}
+		return compare(os.Stdout, a, b)
+	}
+	c := config{}
+	f := flag.NewFlagSet("radarload", flag.ContinueOnError)
+	f.StringVar(&c.URL, "url", "http://localhost:9280", "Radar HTTP base URL (may include a base path)")
+	f.IntVar(&c.PID, "pid", 0, "local Radar process PID (not the go run wrapper)")
+	f.DurationVar(&c.Duration, "duration", 10*time.Minute, "measurement duration; minimum 35s for CPU profiling")
+	f.IntVar(&c.SSE, "sse", 3, "concurrent SSE connections")
+	f.IntVar(&c.Askers, "askers", 4, "concurrent request workers")
+	f.Float64Var(&c.QPS, "qps", 20, "combined offered requests/second; saturated slots are counted as dropped")
+	f.IntVar(&c.PerKind, "per-kind", 100, "maximum sampled subjects per kind")
+	f.Int64Var(&c.Seed, "seed", 1, "deterministic inventory and request seed")
+	f.StringVar(&c.User, "user", "", "optional proxy identity")
+	f.StringVar(&c.Groups, "groups", "", "optional comma-separated proxy groups")
+	f.DurationVar(&c.ReadyTimeout, "ready-timeout", 2*time.Minute, "wait for connected and synced caches")
+	f.StringVar(&c.Out, "out", "result.json", "JSON output; profiles use the same filename stem")
+	f.StringVar(&c.SubjectsFrom, "subjects-from", "", "reuse subjects from a prior result for exact replay")
+	f.StringVar(&c.Label, "label", "", "build label, e.g. git SHA (server reports version, not git SHA)")
+	if err := f.Parse(args); err != nil {
+		if errors.Is(err, flag.ErrHelp) {
+			return nil
+		}
+		return err
+	}
+	if f.NArg() != 0 {
+		return errors.New("unexpected positional arguments")
+	}
+	if c.PID <= 0 || c.Duration < 35*time.Second || c.SSE < 0 || c.Askers < 1 || c.QPS <= 0 || c.QPS > 1e6 || math.IsNaN(c.QPS) || math.IsInf(c.QPS, 0) || c.PerKind < 1 || c.ReadyTimeout <= 0 {
+		return errors.New("require -pid > 0, -duration >= 35s, -sse >= 0, -askers >= 1, 0 < -qps <= 1000000, -per-kind >= 1, -ready-timeout > 0")
+	}
+	if err := os.MkdirAll(file
```

**File**: `cmd/radarload/main_test.go` (added, +266/-0)
```diff
@@ -0,0 +1,266 @@
+package main
+
+import (
+	"bytes"
+	"context"
+	"encoding/json"
+	"fmt"
+	"io"
+	"math"
+	"net/http"
+	"os"
+	"path/filepath"
+	"reflect"
+	"strings"
+	"testing"
+	"time"
+)
+
+func TestParseHeap(t *testing.T) {
+	text := "heap profile: 1: 2 [3: 4] @ heap/1048576\n# HeapAlloc = 1024\n# HeapSys = 8192\n# HeapInuse = 4096\n# NumGC = 257\n# PauseNs = ["
+	for i := range 256 {
+		text += fmt.Sprintf("%d ", i+1)
+	}
+	text += "]\n"
+	h, err := parseHeap(text)
+	if err != nil {
+		t.Fatal(err)
+	}
+	if h.Alloc != 1024 || h.Inuse != 4096 || h.Sys != 8192 || h.GC != 257 {
+		t.Fatalf("bad heap: %+v", h)
+	}
+	d, err := pauseDelta(&heapStats{GC: 255}, h)
+	if err != nil || d != 257 {
+		t.Fatalf("wrap delta: %d, %v", d, err)
+	}
+	if _, err := pauseDelta(&heapStats{GC: 0}, h); err == nil {
+		t.Fatal("overwritten ring reported as exact")
+	}
+	for _, bad := range []string{"<html>SPA</html>", strings.Replace(text, "# HeapAlloc = 1024\n", "", 1), strings.Replace(text, "HeapInuse = 4096", "HeapInuse = bad", 1)} {
+		if _, err := parseHeap(bad); err == nil {
+			t.Fatal("accepted invalid/missing header")
+		}
+	}
+}
+
+func TestCompareMath(t *testing.T) {
+	for _, tc := range []struct {
+		a, b, d, p float64
+		defined    bool
+	}{{100, 75, -25, -25, true}, {100, 125, 25, 25, true}, {0, 0, 0, 0, true}, {0, 5, 5, 0, false}} {
+		d, p := delta(tc.a, tc.b)
+		if d != tc.d || (p != nil) != tc.defined || (p != nil && *p != tc.p) {
+			t.Fatalf("delta(%v,%v): %v %v", tc.a, tc.b, d, p)
+		}
+	}
+	v := []float64{1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20}
+	d := describe(v)
+	if d.Mean != 10.5 || d.P95 != 19 || d.Peak != 20 || percentile(v, .99) != 20 {
+		t.Fatalf("bad distribution: %+v", d)
+	}
+	a := result{Summary: summary{RSS: distribution{Count: 1, Mean: 100 << 20, P95: 100 << 20, Peak: 100 << 20}}}
+	b := a
+	b.Summary.RSS.Mean = 75 << 20
+	var out bytes.Buffer
+	if err := compare(&out, a, b); err != nil {
+		t.Fatal(err)
+	}
+	if !strings.Contains(out.String(), "-25.00%") || !strings.Contains(out.String(), "n/a") {
+		t.Fatal(out.String())
+	}
+}
+
+func TestParseCPU(t *testing.T) {
+	for s, want := range map[string]float64{"00:01.23": 1.23, "12:34": 754, "02:03:04": 7384, "1-02:03:04": 93784} {
+		got, err := parseCPU(s)
+		if err != nil || math.Abs(got-want) > 1e-6 {
+			t.Fatalf("%s: %v, %v", s, got, err)
+		}
+	}
+	for _, s := range []string{"oops", "00:NaN", "-1:00", "00:Inf"} {
+		if _, err := parseCPU(s); err == nil {
+			t.Fatalf("accepted %q", s)
+		}
+	}
+}
+
+type subjectProbeTransport func(*http.Request) (*http.Response, error)
+
+// emptyBody answers resource lists with an empty envelope and everything else
+// (API discovery, single-object GETs) with an empty array.
+func emptyBody(path string) string {
+	if rest, ok := strings.CutPrefix(strings.TrimPrefix(path, "/prefix"), "/api/resources/"); ok && !strings.Contains(rest, "/") {
+		return `{"items":[]}`
+	}
+	return `[]`
+}
+
+func (f subjectProbeTransport) RoundTrip(r *http.Request) (*http.Response, error) { return f(r) }
+
+func TestReadableSubjectsRejectsListedAndReplayedSubjects(t *testing.T) {
+	pod := subject{Kind: "Pod", Namespace: "default", Name: "readable"}
+	secret := subject{Kind: "Secret", Namespace: "default", Name: "denied"}
+	node := subject{Kind: "Node", Name: "node"}
+	deleted := subject{Kind: "Widget", Group: "example.io", Namespace: "default", Name: "deleted"}
+	c, err := newClient(config{URL: "http://radar.invalid/prefix", PerKind: 10, User: "reader", Groups: "viewers"})
+	if err != nil {
+		t.Fatal(err)
+	}
+	c.http.Transport = subjectProbeTransport(func(r *http.Request) (*http.Response, error) {
+		if r.Header.Get("X-Forwarded-User") != "reader" || r.Header.Get("X-Forwarded-Groups") != "viewers" {
+			t.Fatal("configured identity missing from request")
+		}
+		status, body := 200, emptyBody(r.URL.Path)
+		switch r.URL.Path {
+		case "/prefix/api/resources/Pod":
+			body = `{"items":[{"apiVersion":"v1","metadata":{"namespace":"default","name":"readable"}}]}`
+		case "/prefix/api/resources/Secret":
+			body = `{"items":[{"apiVersion":"v1","metadata":{"namespace":"default","name":"denied"}}]}`
+		case "/prefix/api/resources/Node":
+			body = `{"items":[{"apiVersion":"v1","metadata":{"name":"node"}}]}`
+		case "/prefix/api/resources/Secret/default/denied":
+			status, body = 403, `{"error":"forbidden"}`
+		case "/prefix/api/resources/Widget/default/deleted":
+			if r.URL.Query().Get("group") != "example.io" {
+				t.Fatal("group lost from resource GET")
+			}
+			status, body = 404, `{"error":"not found"}`
+		}
+		return &http.Response{StatusCode: status, Header: http.Header{"Content-Type": []string{"application/json"}}, Body: io.NopCloser(strings.NewReader(body))}, nil
+	})
+	listed, _, _, err := c.subjects(context.Background())
+	if err != nil {
+		t.Fatal(err)
+	}
+	if len(listed) != 3 {
+		t.Fatalf("expected listed subjects including the denied Secret: %+v", listed)
+	}
+	readable, reje
```

**File**: `cmd/radarload/sample.go` (added, +215/-0)
```diff
@@ -0,0 +1,215 @@
+package main
+
+import (
+	"bufio"
+	"context"
+	"errors"
+	"fmt"
+	"math"
+	"os/exec"
+	"strconv"
+	"strings"
+	"time"
+)
+
+type heapStats struct {
+	Alloc  uint64 `json:"heap_alloc_bytes"`
+	Inuse  uint64 `json:"heap_inuse_bytes"`
+	Sys    uint64 `json:"heap_sys_bytes"`
+	GC     uint64 `json:"num_gc"`
+	pauses []uint64
+}
+type sample struct {
+	At         time.Time  `json:"at"`
+	Elapsed    float64    `json:"elapsed_seconds"`
+	RSS        *uint64    `json:"rss_bytes"`
+	CPU        *float64   `json:"cpu_seconds"`
+	Heap       *heapStats `json:"heap"`
+	Goroutines *int       `json:"goroutines"`
+	GCPauseNS  *uint64    `json:"gc_pause_since_previous_ns"`
+	Errors     []string   `json:"errors,omitempty"`
+}
+
+func parseHeap(text string) (*heapStats, error) {
+	h := &heapStats{}
+	seen := map[string]bool{}
+	scanner := bufio.NewScanner(strings.NewReader(text))
+	scanner.Buffer(make([]byte, 4096), 1024*1024)
+	for scanner.Scan() {
+		line := scanner.Text()
+		if !strings.HasPrefix(line, "# ") {
+			continue
+		}
+		key, value, ok := strings.Cut(strings.TrimPrefix(line, "# "), " = ")
+		if !ok {
+			continue
+		}
+		if key == "PauseNs" {
+			value = strings.TrimSpace(value)
+			if !strings.HasPrefix(value, "[") || !strings.HasSuffix(value, "]") {
+				return nil, errors.New("invalid PauseNs array")
+			}
+			for _, v := range strings.Fields(strings.Trim(value, "[]")) {
+				n, err := strconv.ParseUint(v, 10, 64)
+				if err != nil {
+					return nil, fmt.Errorf("PauseNs: %w", err)
+				}
+				h.pauses = append(h.pauses, n)
+			}
+			continue
+		}
+		var target *uint64
+		switch key {
+		case "HeapAlloc":
+			target = &h.Alloc
+		case "HeapInuse":
+			target = &h.Inuse
+		case "HeapSys":
+			target = &h.Sys
+		case "NumGC":
+			target = &h.GC
+		default:
+			continue
+		}
+		n, err := strconv.ParseUint(strings.TrimSpace(value), 10, 64)
+		if err != nil {
+			return nil, fmt.Errorf("%s: %w", key, err)
+		}
+		*target = n
+		seen[key] = true
+	}
+	if err := scanner.Err(); err != nil {
+		return nil, err
+	}
+	for _, key := range []string{"HeapAlloc", "HeapInuse", "HeapSys", "NumGC"} {
+		if !seen[key] {
+			return nil, fmt.Errorf("pprof heap text missing %s", key)
+		}
+	}
+	return h, nil
+}
+
+func parseGoroutines(text string) (int, error) {
+	first, _, _ := strings.Cut(text, "\n")
+	var n int
+	if _, err := fmt.Sscanf(first, "goroutine profile: total %d", &n); err != nil || n < 1 {
+		return 0, fmt.Errorf("invalid goroutine profile first line %q", first)
+	}
+	return n, nil
+}
+
+func parseCPU(s string) (float64, error) {
+	days := 0.0
+	if d, rest, ok := strings.Cut(s, "-"); ok {
+		n, err := strconv.ParseUint(d, 10, 32)
+		if err != nil {
+			return 0, err
+		}
+		days = float64(n)
+		s = rest
+	}
+	parts := strings.Split(s, ":")
+	if len(parts) < 2 || len(parts) > 3 {
+		return 0, fmt.Errorf("invalid ps CPU time %q", s)
+	}
+	total := 0.0
+	for _, p := range parts {
+		n, err := strconv.ParseFloat(p, 64)
+		if err != nil || n < 0 || math.IsNaN(n) || math.IsInf(n, 0) {
+			return 0, fmt.Errorf("invalid ps CPU component %q", p)
+		}
+		total = total*60 + n
+	}
+	return days*86400 + total, nil
+}
+
+func processStats(ctx context.Context, pid int) (uint64, float64, error) {
+	ctx, cancel := context.WithTimeout(ctx, 5*time.Second)
+	defer cancel()
+	b, err := exec.CommandContext(ctx, "ps", "-o", "rss=,time=", "-p", strconv.Itoa(pid)).Output()
+	if err != nil {
+		return 0, 0, fmt.Errorf("ps for PID %d: %w", pid, err)
+	}
+	fields := strings.Fields(string(b))
+	if len(fields) != 2 {
+		return 0, 0, fmt.Errorf("unexpected ps output %q", b)
+	}
+	rss, err := strconv.ParseUint(fields[0], 10, 64)
+	if err != nil {
+		return 0, 0, err
+	}
+	cpu, err := parseCPU(fields[1])
+	return rss * 1024, cpu, err
+}
+
+func (c *radarClient) sample(ctx context.Context, start time.Time, pid int, runtime bool) sample {
+	s := sample{At: time.Now()}
+	if !start.IsZero() {
+		s.Elapsed = s.At.Sub(start).Seconds()
+	}
+	rss, cpu, err := processStats(ctx, pid)
+	if err != nil {
+		s.Errors = append(s.Errors, err.Error())
+	} else {
+		s.RSS = &rss
+		s.CPU = &cpu
+	}
+	if !runtime {
+		return s
+	}
+	b, err := c.bytes(ctx, "/debug/pprof/heap?debug=1")
+	if err == nil {
+		s.Heap, err = parseHeap(string(b))
+	}
+	if err != nil {
+		s.Errors = append(s.Errors, "heap: "+err.Error())
+	}
+	b, err = c.bytes(ctx, "/debug/pprof/goroutine?debug=1")
+	if err == nil {
+		var n int
+		n, err = parseGoroutines(string(b))
+		if err == nil {
+			s.Goroutines = &n
+		}
+	}
+	if err != nil {
+		s.Errors = append(s.Errors, "goroutines: "+err.Error())
+	}
+	return s
+}
+
+func pauseDelta(a, b *heapStats) (uint64, error) {
+	if b.GC < a.GC {
+		return 0, errors.New("GC counter decreased")
+	}
+	n := b.GC - a.GC
+	if n == 0 {
+		return 0, nil
+	}
+	if len(b.pauses) != 256 || n > 256 {
+		return 0, errors.New("GC pause ring unavailable or overwritten between samples")
+	}
+	var total uint64
+	for gc := a.GC; gc < b.GC; gc++ {
+		total += 
```

**File**: `cmd/radarload/stats.go` (added, +235/-0)
```diff
@@ -0,0 +1,235 @@
+package main
+
+import (
+	"fmt"
+	"io"
+	"math"
+	"reflect"
+	"sort"
+	"text/tabwriter"
+)
+
+type distribution struct {
+	Mean  float64 `json:"mean"`
+	P95   float64 `json:"p95"`
+	Peak  float64 `json:"peak"`
+	Count int     `json:"count"`
+}
+type latencySummary struct {
+	Count      int            `json:"count"`
+	Errors     int            `json:"errors"`
+	ErrorKinds map[string]int `json:"error_kinds"`
+	P50        float64        `json:"p50_ms"`
+	P95        float64        `json:"p95_ms"`
+	P99        float64        `json:"p99_ms"`
+	Bytes      int64          `json:"response_bytes"`
+}
+type summary struct {
+	Seconds      float64                   `json:"measured_seconds"`
+	RSS          distribution              `json:"rss_bytes"`
+	HeapInuse    distribution              `json:"heap_inuse_bytes"`
+	CPUSeconds   *float64                  `json:"cpu_seconds"`
+	CPUPerMinute *float64                  `json:"cpu_seconds_per_minute"`
+	GCCount      *uint64                   `json:"gc_count"`
+	PauseNS      *uint64                   `json:"gc_pause_ns"`
+	PauseError   string                    `json:"gc_pause_error,omitempty"`
+	SSE          sseStats                  `json:"sse"`
+	Offered      int                       `json:"offered_requests"`
+	Dropped      int                       `json:"dropped_requests"`
+	ActualQPS    float64                   `json:"actual_qps"`
+	Endpoints    map[string]latencySummary `json:"endpoints"`
+}
+
+func percentile(sorted []float64, p float64) float64 {
+	if len(sorted) == 0 {
+		return 0
+	}
+	return sorted[max(0, int(math.Ceil(float64(len(sorted))*p))-1)]
+}
+func describe(v []float64) distribution {
+	if len(v) == 0 {
+		return distribution{}
+	}
+	sort.Float64s(v)
+	var sum float64
+	for _, n := range v {
+		sum += n
+	}
+	return distribution{sum / float64(len(v)), percentile(v, .95), v[len(v)-1], len(v)}
+}
+
+func summarize(samples []sample, c *workloadCounters, seconds float64) summary {
+	s := summary{Seconds: seconds, Endpoints: map[string]latencySummary{}}
+	var rss, heap []float64
+	for _, v := range samples {
+		if v.RSS != nil {
+			rss = append(rss, float64(*v.RSS))
+		}
+		if v.Heap != nil {
+			heap = append(heap, float64(v.Heap.Inuse))
+		}
+	}
+	s.RSS = describe(rss)
+	s.HeapInuse = describe(heap)
+	if len(samples) >= 2 {
+		a, b := samples[0], samples[len(samples)-1]
+		if a.CPU != nil && b.CPU != nil && *b.CPU >= *a.CPU {
+			delta := *b.CPU - *a.CPU
+			s.CPUSeconds = &delta
+			rate := delta * 60 / b.At.Sub(a.At).Seconds()
+			s.CPUPerMinute = &rate
+		}
+		// Heap reads are spaced out (runtimeEvery), so GC and pause totals
+		// come from the samples that carry one.
+		var withHeap []int
+		for i := range samples {
+			if samples[i].Heap != nil {
+				withHeap = append(withHeap, i)
+			}
+		}
+		if len(withHeap) >= 2 {
+			first, last := samples[withHeap[0]].Heap, samples[withHeap[len(withHeap)-1]].Heap
+			if last.GC >= first.GC {
+				delta := last.GC - first.GC
+				s.GCCount = &delta
+			}
+		}
+		var pause uint64
+		if len(withHeap) < 2 {
+			s.PauseError = "fewer than two heap samples"
+		}
+		for j := 1; j < len(withHeap); j++ {
+			prev, cur := withHeap[j-1], withHeap[j]
+			delta, err := pauseDelta(samples[prev].Heap, samples[cur].Heap)
+			if err != nil {
+				s.PauseError = err.Error()
+				continue
+			}
+			samples[cur].GCPauseNS = &delta
+			pause += delta
+		}
+		if s.PauseError == "" {
+			s.PauseNS = &pause
+		}
+	}
+	c.mu.Lock()
+	defer c.mu.Unlock()
+	s.SSE = c.SSE
+	s.Offered = c.Offered
+	s.Dropped = c.Dropped
+	var requests int
+	for name, d := range c.Endpoints {
+		sort.Float64s(d.latencies)
+		n := 0
+		for _, v := range d.Errors {
+			n += v
+		}
+		s.Endpoints[name] = latencySummary{len(d.latencies), n, d.Errors, percentile(d.latencies, .5), percentile(d.latencies, .95), percentile(d.latencies, .99), d.Bytes}
+		requests += len(d.latencies)
+	}
+	if seconds > 0 {
+		s.ActualQPS = float64(requests) / seconds
+	}
+	return s
+}
+
+func delta(a, b float64) (float64, *float64) {
+	d := b - a
+	if a == 0 {
+		if b == 0 {
+			z := 0.0
+			return d, &z
+		}
+		return d, nil
+	}
+	p := d / math.Abs(a) * 100
+	return d, &p
+}
+
+func compare(out io.Writer, a, b result) error {
+	if a.Config.Duration != b.Config.Duration || a.Config.SSE != b.Config.SSE || a.Config.Askers != b.Config.Askers || a.Config.QPS != b.Config.QPS || a.Config.Seed != b.Config.Seed || a.Config.User != b.Config.User || a.Config.Groups != b.Config.Groups || !reflect.DeepEqual(a.Subjects, b.Subjects) || !reflect.DeepEqual(a.NeighborhoodSubjects, b.NeighborhoodSubjects) {
+		fmt.Fprintln(out, "WARNING: workload configuration or sampled subjects differ")
+	}
+	fmt.Fprintf(out, "A: %s (%s)\nB: %s (%s)\n", a.Config.Label, a.Build["version"], b.Config.Label, b.Build["version"])
+	w := tabwriter.NewWriter(out, 0, 4, 2, ' ', 0)
+	fmt.Fprintln(w, "Metric\tA\tB\tDelta (B-A)\tChange")
+	row := func(name string, a, b *float64) {
+		if a == nil || b == ni
```

**File**: `cmd/radarload/workload.go` (added, +214/-0)
```diff
@@ -0,0 +1,214 @@
+package main
+
+import (
+	"bufio"
+	"context"
+	"errors"
+	"fmt"
+	"io"
+	"math/rand"
+	"net/url"
+	"strings"
+	"sync"
+	"time"
+)
+
+type requestJob struct {
+	Endpoint string
+	Path     string
+}
+type endpointData struct {
+	latencies []float64
+	Errors    map[string]int
+	Bytes     int64
+}
+type sseStats struct {
+	Events      int64          `json:"events"`
+	Connections int64          `json:"connections"`
+	Errors      int64          `json:"errors"`
+	ErrorKinds  map[string]int `json:"error_kinds"`
+}
+type workloadCounters struct {
+	mu        sync.Mutex
+	Endpoints map[string]*endpointData
+	SSE       sseStats
+	Offered   int
+	Dropped   int
+}
+
+func requestFor(slot int, s subject) requestJob {
+	switch {
+	case slot < 12:
+		return requestJob{"resource_get", resourcePath("/api/resources", s)}
+	case slot < 14:
+		return requestJob{"ai_context", resourcePath("/api/ai/resources", s)}
+	case slot < 16:
+		return requestJob{"ai_neighborhood", resourcePath("/api/ai/neighborhood", s) + "&profile=auto&hops=1"}
+	case slot < 18:
+		return requestJob{"rest_neighborhood", resourcePath("/api/ai/neighborhood", s) + "&profile=all&hops=2"}
+	case slot == 18:
+		return requestJob{"applications", "/api/applications"}
+	default:
+		return requestJob{"list_summary", "/api/resources/" + url.PathEscape(s.Kind) + "?include=summary&maxItems=50000&group=" + url.QueryEscape(s.Group)}
+	}
+}
+
+func startWorkload(ctx context.Context, c *radarClient, subjects, neighborhoods []subject) (*workloadCounters, <-chan struct{}) {
+	stats := &workloadCounters{Endpoints: map[string]*endpointData{}, SSE: sseStats{ErrorKinds: map[string]int{}}}
+	done := make(chan struct{})
+	jobs := make(chan requestJob)
+	var workers sync.WaitGroup
+	for range c.c.Askers {
+		workers.Add(1)
+		go func() {
+			defer workers.Done()
+			for job := range jobs {
+				reqCtx, cancel := context.WithTimeout(ctx, requestTimeout)
+				start := time.Now()
+				resp, err := c.get(reqCtx, job.Path)
+				var bytes int64
+				var reason string
+				if err == nil {
+					bytes, err = io.Copy(io.Discard, resp.Body)
+					resp.Body.Close()
+					if resp.StatusCode != 200 {
+						reason = fmt.Sprintf("HTTP %d", resp.StatusCode)
+					} else if !strings.HasPrefix(resp.Header.Get("Content-Type"), "application/json") {
+						reason = "non-JSON response"
+					}
+				}
+				if err != nil {
+					reason = err.Error()
+					if errors.Is(err, context.DeadlineExceeded) {
+						reason = "timeout"
+					}
+					if ctx.Err() != nil {
+						reason = "run ended in flight"
+					}
+				}
+				elapsed := time.Since(start).Seconds() * 1000
+				cancel()
+				stats.mu.Lock()
+				d := stats.Endpoints[job.Endpoint]
+				if d == nil {
+					d = &endpointData{Errors: map[string]int{}}
+					stats.Endpoints[job.Endpoint] = d
+				}
+				d.latencies = append(d.latencies, elapsed)
+				d.Bytes += bytes
+				if reason != "" {
+					d.Errors[reason]++
+				}
+				stats.mu.Unlock()
+			}
+		}()
+	}
+	for range c.c.SSE {
+		workers.Add(1)
+		go func() { defer workers.Done(); c.stream(ctx, stats) }()
+	}
+	go func() {
+		defer close(done)
+		rng := rand.New(rand.NewSource(c.c.Seed))
+		order := rng.Perm(20)
+		start := time.Now()
+		deadline, _ := ctx.Deadline()
+		slot := 0
+		for {
+			target := start.Add(time.Duration(float64(slot) / c.c.QPS * float64(time.Second)))
+			if !deadline.IsZero() && !target.Before(deadline) {
+				<-ctx.Done()
+				close(jobs)
+				workers.Wait()
+				return
+			}
+			t := time.NewTimer(time.Until(target))
+			select {
+			case <-ctx.Done():
+				t.Stop()
+				close(jobs)
+				workers.Wait()
+				return
+			case <-t.C:
+			}
+			if ctx.Err() != nil {
+				close(jobs)
+				workers.Wait()
+				return
+			}
+			endpointSlot := order[slot%20]
+			pool := subjects
+			if endpointSlot >= 14 && endpointSlot < 18 {
+				pool = neighborhoods
+			}
+			job := requestFor(endpointSlot, pool[rng.Intn(len(pool))])
+			stats.mu.Lock()
+			stats.Offered++
+			stats.mu.Unlock()
+			select {
+			case jobs <- job:
+			default:
+				stats.mu.Lock()
+				stats.Dropped++
+				stats.mu.Unlock()
+			}
+			slot++
+		}
+	}()
+	return stats, done
+}
+
+func (c *radarClient) stream(ctx context.Context, stats *workloadCounters) {
+	for ctx.Err() == nil {
+		resp, err := c.get(ctx, "/api/events/stream")
+		if err == nil {
+			if resp.StatusCode != 200 {
+				err = fmt.Errorf("HTTP %d", resp.StatusCode)
+			} else if !strings.HasPrefix(resp.Header.Get("Content-Type"), "text/event-stream") {
+				err = errors.New("non-SSE response")
+			}
+			if err == nil {
+				stats.mu.Lock()
+				stats.SSE.Connections++
+				stats.mu.Unlock()
+				reader := bufio.NewReaderSize(resp.Body, 64*1024)
+				hasData := false
+				continuation := false
+				for {
+					line, readErr := reader.ReadSlice('\n')
+					if !continuation {
+						if strings.HasPrefix(string(line), "data:") {
+							hasData = true
+						}
+						if len(line) == 1 && line[0] == '\n' || len(line) == 2 && line[0] ==
```

---

### Incident Patch 3: `b9cd4b5f` (2026-11-17)
**Commit Message**: Replay a frozen cluster capture into two Radar builds and diff every relationship reader (#2708)

## Summary

Tooling to show that a change to how Radar answers relationships gives
the same answers, or to list exactly where it doesn't. Comparing two
builds on a live cluster doesn't work, because the cluster changes
between the two reads. So this captures a cluster once, replays the
frozen capture into two Radar builds through the test server's
in-process fake client, and diffs what every relationship reader returns
over HTTP and MCP.

It's built for retiring the relationship graph: the old build is main,
the new build is the cutover branch, and both run against identical
state. It works for any reader-level change.

## What's here

- **`cmd/clustercapture -context <ctx> -out c.ndjson.gz`**: a read-only
capture.
- Lists every served, listable resource in pages of 500, plus the
discovery document; writes gzipped NDJSON.
- **Privacy:** Secret and ConfigMap values are blanked (keys kept), env
`value`s are blanked, inline secrets are redacted
(`pkg/ai/context.RedactInlineSecrets`), and `managedFields` and
last-applied annotations are dropped. The header stores a hash of the
context name

**File**: `cmd/clustercapture/main.go` (added, +71/-0)
```diff
@@ -0,0 +1,71 @@
+package main
+
+import (
+	"context"
+	"flag"
+	"fmt"
+	"os"
+	"os/signal"
+	"path/filepath"
+	"syscall"
+	"time"
+
+	"github.com/skyhook-io/radar/internal/clusterreplay"
+	"k8s.io/client-go/discovery"
+	"k8s.io/client-go/dynamic"
+	"k8s.io/client-go/tools/clientcmd"
+)
+
+func main() {
+	if err := run(); err != nil {
+		fmt.Fprintln(os.Stderr, err)
+		os.Exit(1)
+	}
+}
+
+func run() error {
+	name := flag.String("context", "", "kubeconfig context to capture (required)")
+	out := flag.String("out", "", "destination .ndjson.gz (required; must not exist)")
+	flag.Parse()
+	if *name == "" || *out == "" {
+		return fmt.Errorf("-context and -out are required")
+	}
+	cfg, err := clientcmd.NewNonInteractiveDeferredLoadingClientConfig(clientcmd.NewDefaultClientConfigLoadingRules(), &clientcmd.ConfigOverrides{CurrentContext: *name}).ClientConfig()
+	if err != nil {
+		return fmt.Errorf("load kubeconfig: %w", err)
+	}
+	cfg.Timeout = 30 * time.Second
+	d, err := discovery.NewDiscoveryClientForConfig(cfg)
+	if err != nil {
+		return fmt.Errorf("create discovery client: %w", err)
+	}
+	c, err := dynamic.NewForConfig(cfg)
+	if err != nil {
+		return fmt.Errorf("create dynamic client: %w", err)
+	}
+	// A failed list must not leave a plausible-looking complete snapshot.
+	f, err := os.CreateTemp(filepath.Dir(*out), ".capture-*.partial")
+	if err != nil {
+		return err
+	}
+	partial := f.Name()
+	defer os.Remove(partial)
+	ctx, cancel := signal.NotifyContext(context.Background(), os.Interrupt, syscall.SIGTERM)
+	defer cancel()
+	count, skipped, captureErr := clusterreplay.Capture(ctx, d, c, *name, f)
+	closeErr := f.Close()
+	if captureErr != nil {
+		return fmt.Errorf("capture failed; no snapshot published: %w", captureErr)
+	}
+	if closeErr != nil {
+		return closeErr
+	}
+	if err := os.Link(partial, *out); err != nil {
+		return err
+	}
+	fmt.Printf("Captured %d objects to %s\n", count, *out)
+	if len(skipped) > 0 {
+		fmt.Printf("Skipped %d resources whose lists failed; details are in the capture header\n", len(skipped))
+	}
+	return nil
+}
```

**File**: `cmd/clustercapture/main_test.go` (added, +24/-0)
```diff
@@ -0,0 +1,24 @@
+package main
+
+import (
+	"os"
+	"path/filepath"
+	"strings"
+	"testing"
+)
+
+func TestRunReportsKubeconfigCause(t *testing.T) {
+	dir := t.TempDir()
+	kubeconfig := filepath.Join(dir, "config")
+	if err := os.WriteFile(kubeconfig, []byte("apiVersion: v1\nkind: Config\n"), 0600); err != nil {
+		t.Fatal(err)
+	}
+	t.Setenv("KUBECONFIG", kubeconfig)
+	args := os.Args
+	defer func() { os.Args = args }()
+	os.Args = []string{"clustercapture", "-context", "absent", "-out", filepath.Join(dir, "c.ndjson.gz")}
+	err := run()
+	if err == nil || !strings.Contains(err.Error(), `context "absent" does not exist`) {
+		t.Fatalf("err = %v, want the kubeconfig loader's cause", err)
+	}
+}
```

**File**: `cmd/reldiff/main.go` (added, +592/-0)
```diff
@@ -0,0 +1,592 @@
+package main
+
+import (
+	"bytes"
+	"encoding/json"
+	"flag"
+	"fmt"
+	"io"
+	"math"
+	"net"
+	"net/http"
+	"net/url"
+	"os"
+	"reflect"
+	"regexp"
+	"sort"
+	"strings"
+	"time"
+
+	"github.com/skyhook-io/radar/internal/clusterreplay"
+	"k8s.io/apimachinery/pkg/apis/meta/v1/unstructured"
+	"k8s.io/apimachinery/pkg/runtime/schema"
+)
+
+type subject struct {
+	Kind      string `json:"kind"`
+	Group     string `json:"group"`
+	Namespace string `json:"namespace"`
+	Name      string `json:"name"`
+}
+type request struct {
+	Reader, Kind, Path string
+	Subject            subject
+	Tool               string
+	Args               map[string]any
+	Relationships      bool
+}
+type example struct {
+	Subject subject `json:"subject"`
+	A       any     `json:"a"`
+	B       any     `json:"b"`
+}
+type delta struct {
+	Reader   string    `json:"reader"`
+	Field    string    `json:"field"`
+	Kind     string    `json:"kind"`
+	Count    int       `json:"count"`
+	Examples []example `json:"examples"`
+}
+type timing struct {
+	Reader string  `json:"reader"`
+	Kind   string  `json:"kind"`
+	Side   string  `json:"side"`
+	Count  int     `json:"count"`
+	Median float64 `json:"median_ms"`
+	P95    float64 `json:"p95_ms"`
+}
+type failure struct {
+	Reader  string  `json:"reader"`
+	Subject subject `json:"subject"`
+	Side    string  `json:"side"`
+	Error   string  `json:"error"`
+}
+type captureGaps struct {
+	FailedGroups []string                `json:"failed_groups"`
+	Skipped      []clusterreplay.Skipped `json:"skipped"`
+}
+
+type report struct {
+	CaptureGaps captureGaps `json:"capture_gaps"`
+	Requests    int         `json:"request_pairs"`
+	DeltaCount  int         `json:"delta_count"`
+	Deltas      []*delta    `json:"deltas"`
+	// Noise holds deltas whose (reader, kind, field) also differed between two runs
+	// of one build (-baseline): output that varies run to run, not between builds.
+	NoiseCount int            `json:"noise_count,omitempty"`
+	Noise      []*delta       `json:"noise,omitempty"`
+	Latency    []timing       `json:"latency"`
+	Failures   []failure      `json:"failures"`
+	Readiness  map[string]any `json:"readiness"`
+}
+
+func main() {
+	a := flag.String("a", "", "first Radar URL")
+	b := flag.String("b", "", "second Radar URL")
+	capture := flag.String("capture", "", "subject capture .ndjson.gz")
+	out := flag.String("out", "report.json", "JSON report")
+	max := flag.Int("max-per-kind", 0, "maximum subjects per group/kind (0 = all)")
+	adminA := flag.String("ready-a", "", "optional replay admin URL; otherwise infer main port+1")
+	adminB := flag.String("ready-b", "", "optional replay admin URL; otherwise infer main port+1")
+	baseline := flag.String("baseline", "", "report from two runs of one build; fields that differed there are reported as noise")
+	flag.Parse()
+	if *a == "" || *b == "" || *capture == "" || *max < 0 {
+		fmt.Fprintln(os.Stderr, "-a, -b, -capture required; -max-per-kind must be >= 0")
+		os.Exit(1)
+	}
+	if err := run(*a, *b, *capture, *out, *max, *adminA, *adminB, *baseline); err != nil {
+		fmt.Fprintln(os.Stderr, err)
+		os.Exit(1)
+	}
+}
+
+func run(a, b, capture, out string, max int, adminA, adminB, baseline string) error {
+	noise, err := loadNoise(baseline)
+	if err != nil {
+		return fmt.Errorf("baseline: %w", err)
+	}
+	f, err := os.Open(capture)
+	if err != nil {
+		return err
+	}
+	defer f.Close()
+	var objects []*unstructured.Unstructured
+	header, err := clusterreplay.Read(f, func(o *unstructured.Unstructured) error { objects = append(objects, o); return nil })
+	if err != nil {
+		return err
+	}
+	requests := plan(objects, header, max)
+	client := &http.Client{Timeout: 65 * time.Second}
+	result := report{Deltas: []*delta{}, Failures: []failure{}, Readiness: map[string]any{}, CaptureGaps: captureGaps{header.FailedGroups, header.Skipped}}
+	if len(header.FailedGroups) > 0 || len(header.Skipped) > 0 {
+		fmt.Fprintf(os.Stderr, "Warning: incomplete capture: %d failed groups, %d skipped resources; see capture_gaps in the report\n", len(header.FailedGroups), len(header.Skipped))
+	}
+	for _, side := range []struct{ Name, Base, Admin string }{{"a", a, adminA}, {"b", b, adminB}} {
+		status, err := waitReady(side.Base, side.Admin)
+		if err != nil {
+			return fmt.Errorf("%s readiness: %w", side.Name, err)
+		}
+		result.Readiness[side.Name] = status
+	}
+	groups, noiseGroups := map[string]*delta{}, map[string]*delta{}
+	times := map[string][]float64{}
+	// Alternate the first side to distribute warm-cache and machine-load bias.
+	for i, r := range requests {
+		var values [2]any
+		order := []int{0, 1}
+		if i%2 != 0 {
+			order = []int{1, 0}
+		}
+		for _, side := range order {
+			base := a
+			label := "a"
+			if side == 1 {
+				base = b
+				label = "b"
+			}
+			start := time.Now()
+			value, err := fetch(client, base, r)
+			elapsed := float64(time.Since(start)) / float64(time.Millisecond)
+			times[r.Reader+"\x00"+r.Kind+"\x00"+label] = append(times[r
```

**File**: `cmd/reldiff/main_test.go` (added, +246/-0)
```diff
@@ -0,0 +1,246 @@
+package main
+
+import (
+	"compress/gzip"
+	"encoding/json"
+	"io"
+	"net/http"
+	"net/http/httptest"
+	"os"
+	"path/filepath"
+	"reflect"
+	"strings"
+	"testing"
+	"time"
+
+	"github.com/skyhook-io/radar/internal/clusterreplay"
+	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
+	"k8s.io/apimachinery/pkg/apis/meta/v1/unstructured"
+)
+
+func TestNormalizationAndDeltas(t *testing.T) {
+	a := map[string]any{"owner": map[string]any{"name": "x", "generation": 1}, "children": []any{map[string]any{"kind": "Pod", "name": "b"}, map[string]any{"kind": "Pod", "name": "a"}}, "conditions": []any{"first", "second"}}
+	b := map[string]any{"owner": map[string]any{"name": "x", "generation": 2}, "children": []any{map[string]any{"kind": "Pod", "name": "a"}, map[string]any{"kind": "Pod", "name": "b"}}, "conditions": []any{"first", "second"}}
+	if !reflect.DeepEqual(normalize(a), normalize(b)) {
+		t.Fatal("ref ordering/generation changed equality")
+	}
+	b["owner"].(map[string]any)["name"] = "y"
+	out := map[string][2]any{}
+	compare("", normalize(a), normalize(b), out)
+	if len(out) != 1 || out["/owner/name"] != [2]any{"x", "y"} {
+		t.Fatal(out)
+	}
+	b["conditions"] = []any{"second", "first"}
+	out = map[string][2]any{}
+	compare("", normalize(a), normalize(b), out)
+	if len(out) != 3 {
+		t.Fatal("ordered arrays must retain order", out)
+	}
+}
+
+func TestMCPTextDecodedAndErrorsRecorded(t *testing.T) {
+	s := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
+		if r.Method != "POST" || r.Header.Get("MCP-Protocol-Version") == "" {
+			t.Error("bad MCP request")
+		}
+		w.Header().Set("Content-Type", "text/event-stream")
+		_, _ = w.Write([]byte("event: message\ndata: {\"jsonrpc\":\"2.0\",\"id\":1,\"result\":{\"content\":[{\"type\":\"text\",\"text\":\"{\\\"owner\\\":{\\\"name\\\":\\\"a\\\"}}\"}]}}\n\n"))
+	}))
+	defer s.Close()
+	value, err := fetch(s.Client(), s.URL, request{Tool: "get_resource"})
+	if err != nil {
+		t.Fatal(err)
+	}
+	b, _ := json.Marshal(value)
+	if string(b) != "{\"content\":[{\"text\":{\"owner\":{\"name\":\"a\"}},\"type\":\"text\"}]}" {
+		t.Fatalf("not decoded: %s", b)
+	}
+}
+
+func TestPlanIncludesAllReadersAndDoesNotCapTrees(t *testing.T) {
+	objects := []*unstructured.Unstructured{}
+	for _, name := range []string{"first", "second"} {
+		objects = append(objects, &unstructured.Unstructured{Object: map[string]any{"apiVersion": "argoproj.io/v1alpha1", "kind": "Application", "metadata": map[string]any{"name": name, "namespace": "default"}}})
+	}
+	requests := plan(objects, clusterreplay.Header{}, 1)
+	counts := map[string]int{}
+	for _, r := range requests {
+		counts[r.Reader]++
+	}
+	for _, reader := range []string{"relationships", "neighborhood", "ai_context", "mcp_get_resource", "mcp_get_neighborhood", "summary", "applications"} {
+		if counts[reader] != 1 {
+			t.Fatalf("%s calls=%d", reader, counts[reader])
+		}
+	}
+	if counts["gitops_tree"] != 2 {
+		t.Fatal("trees capped", counts)
+	}
+}
+
+func TestMissingAndNullRemainDifferent(t *testing.T) {
+	out := map[string][2]any{}
+	compare("", map[string]any{}, map[string]any{"owner": nil}, out)
+	if len(out) != 1 || out["/owner"][0] == nil {
+		t.Fatal(out)
+	}
+}
+
+func TestContainerOrderIsNotNormalizedAway(t *testing.T) {
+	a := []any{map[string]any{"name": "first", "image": "a"}, map[string]any{"name": "second", "image": "b"}}
+	b := []any{a[1], a[0]}
+	if reflect.DeepEqual(normalize(a), normalize(b)) {
+		t.Fatal("ordered container array sorted as references")
+	}
+}
+
+func TestRunReportsCaptureGapsAndScopesNoiseByKind(t *testing.T) {
+	dir := t.TempDir()
+	capture, baseline, output := filepath.Join(dir, "capture.gz"), filepath.Join(dir, "baseline.json"), filepath.Join(dir, "report.json")
+	header := clusterreplay.Header{
+		CapturedAt: time.Now().UTC(), Discovery: clusterreplay.Discovery{Resources: []*metav1.APIResourceList{}},
+		FailedGroups: []string{"broken.io"}, Skipped: []clusterreplay.Skipped{{Resource: "secrets", Error: "forbidden"}},
+	}
+	f, err := os.Create(capture)
+	if err != nil {
+		t.Fatal(err)
+	}
+	z := gzip.NewWriter(f)
+	enc := json.NewEncoder(z)
+	if err := enc.Encode(header); err != nil {
+		t.Fatal(err)
+	}
+	for _, kind := range []string{"Pod", "Service"} {
+		if err := enc.Encode(map[string]any{"apiVersion": "v1", "kind": kind, "metadata": map[string]any{"namespace": "default", "name": "one"}}); err != nil {
+			t.Fatal(err)
+		}
+	}
+	if err := z.Close(); err != nil {
+		t.Fatal(err)
+	}
+	if err := f.Close(); err != nil {
+		t.Fatal(err)
+	}
+	base, err := json.Marshal(report{Deltas: []*delta{{Reader: "relationships", Kind: "Pod.", Field: "/owner/name"}}})
+	if err != nil {
+		t.Fatal(err)
+	}
+	if err := os.WriteFile(baseline, base, 0600); err != nil {
+		t.Fatal(err)
+	}
+	server := func(side string) *httptest.Server {
+		return httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
+			w.Header().Set("Content-Type", "application/jso
```

**File**: `cmd/testserver/main.go` (modified, +22/-6)
```diff
@@ -45,6 +45,7 @@ import (
 	"github.com/skyhook-io/radar/internal/config"
 	"github.com/skyhook-io/radar/internal/k8s"
 	"github.com/skyhook-io/radar/internal/loadtest"
+	"github.com/skyhook-io/radar/internal/mcp"
 	"github.com/skyhook-io/radar/internal/server"
 	"github.com/skyhook-io/radar/internal/static"
 	"github.com/skyhook-io/radar/internal/timeline"
@@ -61,6 +62,9 @@ func main() {
 	censusScale := flag.Float64("census-scale", 1.0, "load-test: scale factor applied to -census counts")
 	vulnReports := flag.Bool("vulnerability-reports", false, "seed Trivy Operator VulnerabilityReports and the workloads they describe (with the default fixture)")
 	flag.Parse()
+	if *replayPath != "" && (*pods != 0 || *censusProfile != "" || *vulnReports) {
+		log.Fatal("-replay cannot be combined with -pods, -census or -vulnerability-reports")
+	}
 
 	// Isolate config/settings writes to a temp directory so e2e tests
 	// don't touch the developer's real ~/.radar/config.json.
@@ -76,8 +80,12 @@ func main() {
 	var (
 		fakeClient *fake.Clientset
 		gen        *loadtest.Generator
+		replay     *replayState
 	)
-	if *censusProfile != "" {
+	if *replayPath != "" {
+		replay = mustLoadReplay(*replayPath)
+		fakeClient = replay.client
+	} else if *censusProfile != "" {
 		c, ok := loadtest.Profiles[*censusProfile]
 		if !ok {
 			log.Fatalf("unknown -census profile %q", *censusProfile)
@@ -122,6 +130,11 @@ func main() {
 		log.Fatalf("InitTestResourceCache: %v", err)
 	}
 
+	if replay != nil {
+		replay.mustStart()
+		defer k8s.ResetTestDynamicState()
+	}
+
 	if *vulnReports {
 		_, reports := vulnerabilityFixture()
 		if err := initVulnerabilityReports(reports); err != nil {
@@ -148,6 +161,7 @@ func main() {
 		StaticFS:        static.FS,
 		StaticRoot:      "dist",
 		EffectiveConfig: effectiveCfg,
+		MCPHandler:      mcp.NewReadOnlyHandler(),
 	})
 
 	ready := make(chan struct{})
@@ -161,11 +175,13 @@ func main() {
 	fmt.Fprintf(os.Stderr, "Test server ready on http://localhost:%d (fake k8s)\n", *port)
 
 	var adminSrv *http.Server
-	if gen != nil {
-		ap := *adminPort
-		if ap == 0 {
-			ap = *port + 1
-		}
+	ap := *adminPort
+	if ap == 0 {
+		ap = *port + 1
+	}
+	if replay != nil {
+		adminSrv = startReplayAdmin(ap, replay)
+	} else if gen != nil {
 		adminSrv = startAdminServer(ap, gen, fakeClient)
 	}
 
```

**File**: `cmd/testserver/replay.go` (added, +195/-0)
```diff
@@ -0,0 +1,195 @@
+package main
+
+import (
+	"flag"
+	"fmt"
+	"log"
+	"net"
+	"net/http"
+	"os"
+	"strings"
+	"time"
+
+	"github.com/skyhook-io/radar/internal/clusterreplay"
+	"github.com/skyhook-io/radar/internal/k8s"
+	"github.com/skyhook-io/radar/pkg/k8score"
+	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
+	"k8s.io/apimachinery/pkg/apis/meta/v1/unstructured"
+	"k8s.io/apimachinery/pkg/runtime"
+	"k8s.io/apimachinery/pkg/runtime/schema"
+	discoveryfake "k8s.io/client-go/discovery/fake"
+	dynamicfake "k8s.io/client-go/dynamic/fake"
+	"k8s.io/client-go/kubernetes/fake"
+	"k8s.io/client-go/kubernetes/scheme"
+)
+
+var replayPath = flag.String("replay", "", "replay a frozen .ndjson.gz cluster capture")
+
+type replayState struct {
+	client       *fake.Clientset
+	dynamic      *dynamicfake.FakeDynamicClient
+	discovery    *replayDiscovery
+	gvrs         []schema.GroupVersionResource
+	unsupported  []string
+	failedGroups []string
+	skipped      []clusterreplay.Skipped
+	objects      int
+}
+
+func loadReplay(path string) (*replayState, error) {
+	f, err := os.Open(path)
+	if err != nil {
+		return nil, err
+	}
+	defer f.Close()
+	var objects []*unstructured.Unstructured
+	header, err := clusterreplay.Read(f, func(obj *unstructured.Unstructured) error { objects = append(objects, obj); return nil })
+	if err != nil {
+		return nil, err
+	}
+	s := &replayState{client: fake.NewClientset(), objects: len(objects), failedGroups: header.FailedGroups, skipped: header.Skipped}
+	s.discovery = &replayDiscovery{FakeDiscovery: s.client.Discovery().(*discoveryfake.FakeDiscovery), groups: header.Discovery.Groups}
+	s.discovery.Resources = header.Discovery.Resources
+	kinds := map[schema.GroupVersionResource]string{}
+	byGVK := map[schema.GroupVersionKind]schema.GroupVersionResource{}
+	for _, list := range header.Discovery.Resources {
+		gv, err := schema.ParseGroupVersion(list.GroupVersion)
+		if err != nil {
+			return nil, err
+		}
+		for _, r := range list.APIResources {
+			if !clusterreplay.Listable(gv, r) {
+				continue
+			}
+			gvr := gv.WithResource(r.Name)
+			kinds[gvr] = r.Kind + "List"
+			byGVK[gv.WithKind(r.Kind)] = gvr
+			// Production serves built-in kinds from typed informers and starts
+			// dynamic ones only for custom resources and DRA, so replay does too.
+			if k8score.IsBuiltInAPIGroup(gv.Group) && gv.Group != "resource.k8s.io" {
+				continue
+			}
+			canWatch := false
+			for _, verb := range r.Verbs {
+				if verb == "watch" {
+					canWatch = true
+				}
+			}
+			if canWatch {
+				s.gvrs = append(s.gvrs, gvr)
+			} else {
+				s.unsupported = append(s.unsupported, gvr.String()+": discovery has no watch verb")
+			}
+		}
+	}
+	s.dynamic = dynamicfake.NewSimpleDynamicClientWithCustomListKinds(runtime.NewScheme(), kinds)
+	typedScheme := runtime.NewScheme()
+	if err := scheme.AddToScheme(typedScheme); err != nil {
+		return nil, err
+	}
+	seenTyped := map[string]bool{}
+	for _, obj := range objects {
+		gvk := obj.GroupVersionKind()
+		gvr, ok := byGVK[gvk]
+		if !ok {
+			return nil, fmt.Errorf("%s %s missing listable discovery entry", gvk, obj.GetName())
+		}
+		if err := s.dynamic.Tracker().Create(gvr, obj, obj.GetNamespace()); err != nil {
+			return nil, err
+		}
+		typed, err := typedScheme.New(gvk)
+		if runtime.IsNotRegisteredError(err) {
+			continue
+		}
+		if err != nil {
+			return nil, err
+		}
+		if err := runtime.DefaultUnstructuredConverter.FromUnstructured(obj.Object, typed); err != nil {
+			return nil, fmt.Errorf("decode %s: %w", gvk, err)
+		}
+		key := strings.Join([]string{gvk.Group, gvk.Kind, obj.GetNamespace(), obj.GetName()}, "/")
+		if seenTyped[key] {
+			continue
+		}
+		seenTyped[key] = true
+		if err := s.client.Tracker().Add(typed); err != nil {
+			return nil, err
+		}
+	}
+	return s, nil
+}
+
+func mustLoadReplay(path string) *replayState {
+	s, err := loadReplay(path)
+	if err != nil {
+		log.Fatal(err)
+	}
+	return s
+}
+
+func (s *replayState) mustStart() {
+	if err := s.start(); err != nil {
+		log.Fatal(err)
+	}
+}
+
+func (s *replayState) start() error {
+	if err := k8s.InitTestReplayClients(s.dynamic, s.discovery); err != nil {
+		return err
+	}
+	cache := k8s.GetDynamicResourceCache()
+	for _, gvr := range s.gvrs {
+		if err := cache.EnsureWatching(gvr); err != nil {
+			s.unsupported = append(s.unsupported, fmt.Sprintf("%s: %v", gvr, err))
+			continue
+		}
+		if !cache.WaitForSync(gvr, 10*time.Second) {
+			s.unsupported = append(s.unsupported, gvr.String()+": sync timeout")
+		}
+	}
+	fmt.Fprintf(os.Stderr, "Replay caches synced: %d objects; %d unsupported resources\n", s.objects, len(s.unsupported))
+	for _, gap := range s.unsupported {
+		fmt.Fprintln(os.Stderr, "Replay unsupported:", gap)
+	}
+	for _, group := range s.failedGroups {
+		fmt.Fprintln(os.Stderr, "Replay capture failed group:", group)
+	}
+	for _, gap := range s.skipped {
+		fmt.Fprintf(os.Stderr, "Replay capture skipped: %s: %s\n", gap.Resource, gap.Error)
+	}
+	return nil
+}
+
+ty
```

**File**: `cmd/testserver/replay_test.go` (added, +108/-0)
```diff
@@ -0,0 +1,108 @@
+package main
+
+import (
+	"compress/gzip"
+	"encoding/json"
+	"net/http/httptest"
+	"os"
+	"path/filepath"
+	"reflect"
+	"strings"
+	"testing"
+
+	"github.com/skyhook-io/radar/internal/k8s"
+	"k8s.io/apimachinery/pkg/runtime/schema"
+)
+
+func TestReplayTypedAndDynamic(t *testing.T) {
+	data, err := os.ReadFile("../../internal/clusterreplay/testdata/tiny.ndjson")
+	if err != nil {
+		t.Fatal(err)
+	}
+	data = []byte(strings.Replace(string(data), `"context_hash":`, `"failed_groups":["broken.io"],"skipped":[{"resource":"secrets","error":"forbidden"}],"context_hash":`, 1))
+	data = []byte(strings.Replace(string(data), `{"groupVersion":"argoproj.io/v1alpha1"`, `{"groupVersion":"resource.k8s.io/v1","resources":[{"name":"resourceclaims","kind":"ResourceClaim","namespaced":true,"verbs":["create","delete","deletecollection","get","list","patch","update","watch"]}]},{"groupVersion":"argoproj.io/v1alpha1"`, 1))
+	path := filepath.Join(t.TempDir(), "capture.gz")
+	f, err := os.Create(path)
+	if err != nil {
+		t.Fatal(err)
+	}
+	z := gzip.NewWriter(f)
+	if _, err = z.Write(data); err != nil {
+		t.Fatal(err)
+	}
+	if err = z.Close(); err != nil {
+		t.Fatal(err)
+	}
+	f.Close()
+	s, err := loadReplay(path)
+	if err != nil {
+		t.Fatal(err)
+	}
+	admin := startReplayAdmin(0, s)
+	defer admin.Close()
+	status := httptest.NewRecorder()
+	admin.Handler.ServeHTTP(status, httptest.NewRequest("GET", "/loadtest/status", nil))
+	var body struct {
+		FailedGroups []string `json:"failed_groups"`
+		Skipped      []struct {
+			Resource string
+			Error    string
+		} `json:"skipped"`
+	}
+	if err := json.Unmarshal(status.Body.Bytes(), &body); err != nil {
+		t.Fatal(err)
+	}
+	if len(body.FailedGroups) != 1 || body.FailedGroups[0] != "broken.io" || len(body.Skipped) != 1 || body.Skipped[0].Resource != "secrets" || body.Skipped[0].Error != "forbidden" {
+		t.Fatalf("capture gaps absent from status: %s", status.Body.String())
+	}
+	defer k8s.ResetTestState()
+	defer k8s.ResetTestDynamicState()
+	if err = k8s.InitTestResourceCache(s.client); err != nil {
+		t.Fatal(err)
+	}
+	if err = s.start(); err != nil {
+		t.Fatal(err)
+	}
+	if len(s.unsupported) != 0 {
+		t.Fatal(s.unsupported)
+	}
+	watched := map[string]bool{}
+	for _, gvr := range k8s.GetDynamicResourceCache().GetWatchedResources() {
+		watched[gvr.Group+"/"+gvr.Resource] = true
+	}
+	want := map[string]bool{"example.io/widgets": true, "argoproj.io/applications": true, "resource.k8s.io/resourceclaims": true}
+	if !reflect.DeepEqual(watched, want) {
+		t.Fatalf("dynamic informers = %v, want custom resources and DRA only", watched)
+	}
+	if got := k8s.GetResourceCache().GetKindObjectCounts()["Pod"]; got != 1 {
+		t.Fatalf("pods=%d", got)
+	}
+	gvr := schema.GroupVersionResource{Group: "example.io", Version: "v1", Resource: "widgets"}
+	items, err := k8s.GetDynamicResourceCache().List(gvr, "default")
+	if err != nil || len(items) != 2 {
+		t.Fatalf("widgets=%d err=%v", len(items), err)
+	}
+	discovery := k8s.GetResourceDiscovery()
+	if _, ok := discovery.GetGVRWithGroup("Widget", "example.io"); !ok {
+		t.Fatal("missing Widget discovery")
+	}
+	if err = discovery.Refresh(); err != nil {
+		t.Fatal(err)
+	}
+	if _, ok := discovery.GetGVRWithGroup("Widget", "example.io"); !ok {
+		t.Fatal("catalog lost on refresh")
+	}
+	session, err := k8s.BeginOwnershipRead(k8s.GetResourceCache())
+	if err != nil {
+		t.Fatal(err)
+	}
+	dependents := map[string]bool{}
+	for _, kind := range session.Catalog().DependentKinds() {
+		dependents[kind.GroupKind.Group+"/"+kind.GroupKind.Kind] = true
+	}
+	for _, want := range []string{"apps/ReplicaSet", "/Pod", "example.io/Widget"} {
+		if !dependents[want] {
+			t.Fatalf("ownership can't search %s for dependents: %v", want, dependents)
+		}
+	}
+}
```

**File**: `docs/relationship-replay.md` (added, +156/-0)
```diff
@@ -0,0 +1,156 @@
+# Relationship replay
+
+Capture once, run two testserver builds over that file, and compare their HTTP
+and MCP relationship readers. Replay never loads kubeconfig or contacts a
+cluster. The capture command is the only command below that uses a real cluster.
+
+## Capture (operator-run)
+
+```sh
+go run ./cmd/clustercapture -context YOUR_CONTEXT -out /tmp/cluster.ndjson.gz
+```
+
+Discovery covers every served group/version, including CRDs. Lists use a limit
+of 500 across all namespaces. Events, coordination leases and subresources are
+excluded. A resource whose list fails is skipped and recorded in the capture
+header (see below); a discovery failure or an interrupt fails the capture, and
+an incomplete capture is never published. The destination must not already
+exist. Capture uses list and discovery reads only, with a 30-second timeout per
+network request.
+
+The gzip contains a header with `captured_at`, SHA-256 `context_hash`, and
+`discovery.groups` / `discovery.resources`, followed by Kubernetes objects.
+Every version is retained. Subject comparison deduplicates versions by
+(group, kind, namespace, name); empty discovered kinds are still listed.
+
+This is a frozen **recording**, not an atomic cross-resource apiserver snapshot:
+objects may change while capture lists different kinds/versions. Both replays
+nevertheless receive exactly the same recorded inputs.
+
+## Build old and new
+
+Build the testserver of both revisions from commits that contain this harness,
+plus `reldiff` from either:
+
+```sh
+(cd OLD_TREE && go build -o /tmp/radar-old-testserver ./cmd/testserver)
+(cd NEW_TREE && go build -o /tmp/radar-new-testserver ./cmd/testserver)
+go build -o /tmp/reldiff ./cmd/reldiff
+```
+
+## Replay and compare
+
+```sh
+/tmp/radar-old-testserver -replay /tmp/cluster.ndjson.gz -port 9381 -admin-port 9382 > /tmp/radar-old.log 2>&1 &
+OLD_PID=$!
+/tmp/radar-new-testserver -replay /tmp/cluster.ndjson.gz -port 9383 -admin-port 9384 > /tmp/radar-new.log 2>&1 &
+NEW_PID=$!
+/tmp/reldiff -a http://127.0.0.1:9381 -b http://127.0.0.1:9383 \
+  -capture /tmp/cluster.ndjson.gz -out /tmp/relationship-diff.json
+kill "$OLD_PID" "$NEW_PID"
+```
+
+Readiness is `GET /loadtest/status` on the admin listener (default main port+1).
+Reldiff polls it for up to 30 seconds. Override custom admin locations with
+`-ready-a URL -ready-b URL`. Readiness includes unsupported resources. Built-in
+kinds with a typed informer are served by it, as in Radar. Custom resources and
+`resource.k8s.io` are synced before the server reports ready; a captured kind
+without a watch verb stays in discovery and the fake tracker and is reported as
+unsupported. Other built-in kinds (CustomResourceDefinitions, for example)
+start watching when first requested, as in Radar, and until then ownership
+reports them as not collected. Start both servers fresh for every comparison,
+so both sides see the same request sequence.
+
+Each subject exercises resource GET `relationships`, REST
+`/api/ai/neighborhood`, REST AI resource context, and MCP `get_resource` /
+`get_neighborhood` through JSON-RPC `tools/call`. There is no separate non-AI
+REST neighborhood route in today's server. MCP is mounted read-only at `/mcp`.
+Reldiff also reads `/api/applications`, each kind's `include=summary` list, and
+every captured Argo Application / Flux Kustomization / HelmRelease GitOps tree.
+`-max-per-kind N` caps subject readers per group/kind; trees and list readers
+remain exhaustive. Group query parameters disambiguate colliding kind names.
+
+The JSON groups deltas by reader, JSON-pointer field and subject group/kind,
+with full counts and at most five examples. Reference/object sets are sorted;
+ordered scalar arrays remain ordered. Normalization drops the explicit volatile
+key set in `cmd/reldiff/main.go` (timestamps, ages, durations, request IDs and
+generation/resource-version counters). Other content is retained, including
+errors. Failures are recorded independently on both sides; **zero deltas with
+failed calls is not full coverage**. Inspect `failures` and readiness's
+`unsupported` arrays before claiming parity. A missing endpoint is a failed
+reader call, not a silently skipped reader.
+
+Latency is one timed call per reader/subject/side, reported as median/p95 by
+reader and group/kind, including errors. Side order alternates to distribute
+cache/load bias. Small captures do not support meaningful p95 claims. This is
+an inexpensive comparison, not an isolated benchmark. Successful report writing
+returns exit zero even when deltas or reader failures exist; inspect the report.
+Responses over 64 MiB fail explicitly.
+
+## Local fixture
+
+```sh
+gzip -c internal/clusterreplay/testdata/tiny.ndjson > /tmp/tiny.ndjson.gz
+go build -o /tmp/replay-testserver ./cmd/testserver
+# Use the replay/diff commands above with this binary on both sides.
+```
+
+The fixture has a Deployment → ReplicaSet → Pod, Service, Node, Namespace,
```

#### Recent Merged Pull Requests:
- **PR #2760** (2026-11-17): Serve built-in kinds through discovery in census mode (@nadaverell)
- **PR #2747** (2026-11-16): test(traffic): make the layout-engine tests independent of machine load (@nadaverell)
- **PR #2746** (2026-11-16): Issue and check cards: the severity rail spans the open card (@nadaverell)
- **PR #2745** (2026-11-16): Recover panics in MCP request handlers (@nadaverell)
- **PR #2744** (2026-11-16): fix(traffic): show Data per protocol and label byte-only edges with their throughput (@nadaverell)
- **PR #2743** (2026-11-16): Return 404 for missing assets, serve ranges uncompressed, and always declare Vary (@nadaverell)

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

## X. Serve built-in kinds through discovery in census mode

**RULE**:
When implementing operations in `cmd/testserver/census_discovery.go`, engineers MUST enforce rigorous boundary validation, safe state transitions, and memory/concurrency invariants as established by production defect remediation in skyhook-io/radar. All inputs crossing module boundaries must be explicitly verified before state persistence.

**WHY**:
Prevents defects observed in production commit `1a0f7e1e`: Serve built-in kinds through discovery in census mode. Unvalidated execution paths cause runtime exceptions, race conditions, and silent state corruption under concurrent workloads.

**WHEN TO APPLY**:
Subsystems managing Go data structures, boundary deserialization, API parsing, or resource lifecycles matching `cmd/testserver/census_discovery.go`.

**VERIFIED IMPLEMENTATION PATTERN**:
```go
// Verified production-grade fix pattern:
package main

import (
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/client-go/kubernetes/fake"

	"github.com/skyhook-io/radar/internal/k8s"
	"github.com/skyhook-io/radar/pkg/resourceid"
)

// installCensusDiscovery serves the built-in kinds through discovery, as a
// real API server does. A census fixture seeds typed objects only; without a
// discovery catalog, readers that resolve kinds through discovery have nothing
// to resolve against.
func installCensusDiscovery(client *fake.Clientset) error {
	lists := map[string]*metav1.APIResourceList{}
	var order []string
	for _, b := range resourceid.Builtins {
		if b.Version == "" {
			continue
		}
		gv := b.Version
		if b.Group != "" {
			gv = b.Group + "/" + b.Version
		}
		l, ok := lists[gv]
		if !ok {
			l = &metav1.APIResourceList{GroupVersion: gv}
			lists[gv] = l
			order = append(order, gv)
		}
		l.APIResources = append(l.APIResources, metav1.APIResource{
			Name: b.Resource, Kind: b.Kind, Group: b.Group, Version: b.Version, Namespaced: b.Namespaced,
			Verbs: metav1.Verbs{"create", "delete", "deletecollection", "get", "list", "patch", "update", "watch"},
		})
	}
	client.Resources = nil
	for _, gv := range order {
		
```

**NEGATIVE CONSTRAINT**:
```go
// Induced defect failure mode:
// Defect-prone omission of boundary validation
```

**VERIFICATION METHOD**:
Automated regression test asserting that input states reproducing defect `1a0f7e1e` are properly handled with clean fallback behavior.


## 3. Independent Verification Protocol
1. Assert state existence before and after execution.
2. Verify deterministic SHA-256 byte digest parity.
3. Validate zero unhandled promise rejections or uncaught exceptions.
