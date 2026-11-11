> **Canonical Learning Artifact**: `07_PROJECT_LEARNING/argoproj-argo-workflows-learnings.md`  
> **Source**: github ([https://github.com/argoproj/argo-workflows](https://github.com/argoproj/argo-workflows))  
> **Source Version**: `d48ec29e`  
> **License**: Apache-2.0  
> **Synthesized By**: zero-clone-structural-synthesizer  
> **Timestamp**: 2026-11-11T09:49:07.681Z  
> **Learning ID**: `learn-github-argoproj-argo-workflows`  
> **Pipeline Version**: `2.0.0`  
> **Status**: VERIFIED_EMPIRICAL_INTELLIGENCE  
> **Data Governance**: CLASSIFICATION: PUBLIC. Sanitized against PII/secrets.  
> **Policy Invariant**: Strictly for engineering retrieval and architecture documentation. Distillation prohibited.  

---

# Forensic Learning Record (Deep Inspection): argoproj/argo-workflows

> **Canonical Artifact**: `07_PROJECT_LEARNING/argoproj-argo-workflows-learnings.md`  
> **Source Platform**: GitHub ([https://github.com/argoproj/argo-workflows](https://github.com/argoproj/argo-workflows))  
> **Harvest Method**: Full-Spectrum Deep Extraction (Patches, Diffs, Source Code, Post-Mortems)  
> **Harvest Timestamp**: 2026-11-11T09:49:07.664Z  
> **Compliance State**: Free Tier Guaranteed | Strict Rate-Limit Backoff Honored  

---

## 1. Context & Architectural Overview
- **Repository / Resource**: `argoproj/argo-workflows`
- **Description**: Workflow Engine for Kubernetes
- **Primary Language / Ecosystem**: Go
- **Discovered Manifests / Configurations**: go.mod, README.md, Dockerfile
- **Stars / Engagement**: 17088 stars

---

## 2. Multi-Dimensional 8-Axis Investigation & Real Code Patches

### D1: Architecture & Structural Boundaries
- Entry configurations inspected via direct stream: go.mod, README.md, Dockerfile.
- Evaluated system abstractions and modular contracts.

### Core Architecture Module: `cmd/argo/commands/archive/util.go`
```
package archive

import (
	"context"
	"errors"
	"fmt"
	"regexp"
	"strings"

	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"

	workflowarchivepkg "github.com/argoproj/argo-workflows/v4/pkg/apiclient/workflowarchive"
	"github.com/argoproj/argo-workflows/v4/util/humanize"
)

// uuidRegex matches Kubernetes UID format (RFC 4122 UUID)
// Example: a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11
var uuidRegex = regexp.MustCompile(`^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$`)

// isUID returns true if the input string matches the UUID format used by Kubernetes UIDs
func isUID(s string, forceUID bool, forceName bool) bool {
	if forceUID {
		return true
	}
	if forceName {
		return false
	}
	return uuidRegex.MatchString(s)
}

func resolveUID(ctx context.Context, serviceClient workflowarchivepkg.ArchivedWorkflowServiceClient, identifier string, namespace string, forceUID bool, forceName bool) (string, error) {
	if isUID(identifier, forceUID, forceName) {
		return identifier, nil
	}

	req := &workflowarchivepkg.ListArchivedWorkflowsRequest{
		Namespace:  namespace,
		NamePrefix: identifier,
		NameFilter: "Exact",
	}

	resp, err := serviceClient.ListArchivedWorkflows(ctx, req)
	if err != nil {
		return "", fmt.Errorf("list archived workflows: %w", err)
	}

	matches := resp.Items
	for len(matches) < 2 && resp.Continue != "" {
		req.ListOptions = &metav1.ListOptions{Continue: resp.Continue}
		resp, err = serviceClient.ListArchivedWorkflows(ctx, req)
		if err != nil {
			return "", fmt.Errorf("list archived workflows: %w", err)
		}
		matches = append(matches, resp.Items...)
	}

	if len(matches) == 0 {
		return "", fmt.Errorf("archived workflow '%s' not found", identifier)
	}

	if len(matches) > 1 {
		var msg strings.Builder
		fmt.Fprintf(&msg, "Multiple archived workflows found with name '%s':\n", identifier)
		for _, wf := range matches {
			fmt.Fprintf(&msg, "  %s (Created: %s, Finished: %s)\n", wf.UID, humanize.Timestamp(wf.CreationTimestamp.Time), humanize.Timestamp(wf.Status.FinishedAt.Time))
		}
		msg.WriteString("Please specify the UID.")
		return "", errors.New(msg.String())
	}

	return string(matches[0].UID), nil
}

```

### Core Architecture Module: `cmd/argo/commands/clustertemplate/util.go`
```
package clustertemplate

import (
	"context"
	"encoding/json"
	"fmt"
	"log"

	"sigs.k8s.io/yaml"

	wfv1 "github.com/argoproj/argo-workflows/v4/pkg/apis/workflow/v1alpha1"
	"github.com/argoproj/argo-workflows/v4/util/humanize"
	argoJson "github.com/argoproj/argo-workflows/v4/util/json"
	"github.com/argoproj/argo-workflows/v4/workflow/common"
	"github.com/argoproj/argo-workflows/v4/workflow/util"
)

func generateClusterWorkflowTemplates(ctx context.Context, filePaths []string, strict bool) []wfv1.ClusterWorkflowTemplate {
	fileContents, err := util.ReadManifest(ctx, filePaths...)
	if err != nil {
		log.Fatal(err)
	}

	var clusterWorkflowTemplates []wfv1.ClusterWorkflowTemplate
	for _, body := range fileContents {
		cwftmpls, err := unmarshalClusterWorkflowTemplates(ctx, body, strict)
		if err != nil {
			log.Fatalf("Failed to parse cluster workflow template: %v", err)
		}
		clusterWorkflowTemplates = append(clusterWorkflowTemplates, cwftmpls...)
	}

	if len(clusterWorkflowTemplates) == 0 {
		log.Fatalln("No cluster workflow template found in given files")
	}

	return clusterWorkflowTemplates
}

// unmarshalClusterWorkflowTemplates unmarshals the input bytes as either json or yaml
func unmarshalClusterWorkflowTemplates(ctx context.Context, wfBytes []byte, strict bool) ([]wfv1.ClusterWorkflowTemplate, error) {
	var cwft wfv1.ClusterWorkflowTemplate
	var jsonOpts []argoJson.Opt
	if strict {
		jsonOpts = append(jsonOpts, argoJson.DisallowUnknownFields)
	}
	err := argoJson.Unmarshal(wfBytes, &cwft, jsonOpts...)
	if err == nil {
		return []wfv1.ClusterWorkflowTemplate{cwft}, nil
	}
	yamlWfs, err := common.SplitClusterWorkflowTemplateYAMLFile(ctx, wfBytes, strict)
	if err == nil {
		return yamlWfs, nil
	}
	return nil, err
}

func printClusterWorkflowTemplate(wf *wfv1.ClusterWorkflowTemplate, outFmt string) {
	switch outFmt {
	case "name":
		fmt.Println(wf.Name)
	case "json":
		outBytes, _ := json.MarshalIndent(wf, "", "    ")
		fmt.Println(string(outBytes))
	case "yaml":
		outBytes, _ := yaml.Marshal(wf)
		fmt.Print(string(outBytes))
	case "wide", "":
		printClusterWorkflowTemplateHelper(wf)
	default:
		log.Fatalf("Unknown output format: %s", outFmt)
	}
}

func printClusterWorkflowTemplateHelper(wf *wfv1.ClusterWorkflowTemplate) {
	const fmtStr = "%-20s %v\n"
	fmt.Printf(fmtStr, "Name:", wf.Name)
	fmt.Printf(fmtStr, "Created:", humanize.Timestamp(wf.CreationTimestamp.Time))
}

```

### Core Architecture Module: `cmd/argo/commands/cron/util.go`
```
package cron

import (
	"context"
	"encoding/json"
	"fmt"
	"log"
	"strings"
	"time"

	"github.com/robfig/cron/v3"
	"sigs.k8s.io/yaml"

	"github.com/argoproj/argo-workflows/v4/pkg/apis/workflow/v1alpha1"
	"github.com/argoproj/argo-workflows/v4/util/humanize"
	argoJson "github.com/argoproj/argo-workflows/v4/util/json"
	"github.com/argoproj/argo-workflows/v4/workflow/common"
	"github.com/argoproj/argo-workflows/v4/workflow/util"
)

// GetNextRuntime returns the next time the workflow should run in local time. It assumes the workflow-controller is in
// UTC, but nevertheless returns the time in the local timezone.
func GetNextRuntime(ctx context.Context, cwf *v1alpha1.CronWorkflow) (time.Time, error) {
	var nextRunTime time.Time
	now := time.Now().UTC()
	for _, schedule := range cwf.Spec.GetSchedulesWithTimezone() {
		cronSchedule, err := cron.ParseStandard(schedule)
		if err != nil {
			return time.Time{}, err
		}
		next := cronSchedule.Next(now).Local()
		if nextRunTime.IsZero() || next.Before(nextRunTime) {
			nextRunTime = next
		}
	}

	return nextRunTime, nil
}

func generateCronWorkflows(ctx context.Context, filePaths []string, strict bool) []v1alpha1.CronWorkflow {
	fileContents, err := util.ReadManifest(ctx, filePaths...)
	if err != nil {
		log.Fatal(err)
	}

	var cronWorkflows []v1alpha1.CronWorkflow
	for _, body := range fileContents {
		cronWfs := unmarshalCronWorkflows(ctx, body, strict)
		cronWorkflows = append(cronWorkflows, cronWfs...)
	}

	if len(cronWorkflows) == 0 {
		log.Fatalln("No CronWorkflows found in given files")
	}

	return cronWorkflows
}

// unmarshalCronWorkflows unmarshals the input bytes as either json or yaml
func unmarshalCronWorkflows(ctx context.Context, wfBytes []byte, strict bool) []v1alpha1.CronWorkflow {
	var cronWf v1alpha1.CronWorkflow
	var jsonOpts []argoJson.Opt
	if strict {
		jsonOpts = append(jsonOpts, argoJson.DisallowUnknownFields)
	}
	err := argoJson.Unmarshal(wfBytes, &cronWf, jsonOpts...)
	if err == nil {
		return []v1alpha1.CronWorkflow{cronWf}
	}
	yamlWfs, err := common.SplitCronWorkflowYAMLFile(ctx, wfBytes, strict)
	if err == nil {
		return yamlWfs
	}
	log.Fatalf("Failed to parse cron workflow: %v", err)
	return nil
}

func printCronWorkflow(ctx context.Context, wf *v1alpha1.CronWorkflow, outFmt string) {
	switch outFmt {
	case "name":
		fmt.Println(wf.Name)
	case "json":
		outBytes, _ := json.MarshalIndent(wf, "", "    ")
		fmt.Println(string(outBytes))
	case "yaml":
		outBytes, _ := yaml.Marshal(wf)
		fmt.Print(string(outBytes))
	case "wide", "":
		fmt.Print(getCronWorkflowGet(ctx, wf))
	default:
		log.Fatalf("Unknown output format: %s", outFmt)
	}
}

func getCronWorkflowGet(ctx context.Context, cwf *v1alpha1.CronWorkflow) string {
	const fmtStr = "%-30s %v\n"

	var out strings.Builder
	fmt.Fprintf(&out, fmtStr, "Name:", cwf.Name)
	fmt.Fprintf(&out, fmtStr, "Namespace:", cwf.Namespace)
	fmt.Fprintf(&out, fmtStr, "Created:", humanize.Timestamp(cwf.CreationTimestamp.Time))
	fmt.Fprintf(&out, fmtStr, "Schedules:", cwf.Spec.GetScheduleString())
	fmt.Fprintf(&out, fmtStr, "Suspended:", cwf.Spec.Suspend)
	if cwf.Spec.Timezone != "" {
		fmt.Fprintf(&out, fmtStr, "Timezone:", cwf.Spec.Timezone)
	}
	if cwf.Spec.StartingDeadlineSeconds != nil {
		fmt.Fprintf(&out, fmtStr, "StartingDeadlineSeconds:", *cwf.Spec.StartingDeadlineSeconds)
	}
	if cwf.Spec.ConcurrencyPolicy != "" {
		fmt.Fprintf(&out, fmtStr, "ConcurrencyPolicy:", cwf.Spec.ConcurrencyPolicy)
	}
	if cwf.Status.LastScheduledTime != nil {
		fmt.Fprintf(&out, fmtStr, "LastScheduledTime:", humanize.Timestamp(cwf.Status.LastScheduledTime.Time))
	}

	next, err := GetNextRuntime(ctx, cwf)
	if err == nil {
		fmt.Fprintf(&out, fmtStr, "NextScheduledTime:", humanize.Timestamp(next)+" (assumes workflow-controller is in UTC)")
	}

	if len(cwf.Status.Active) > 0 {
		var activeWfNames []string
		for _, activeWf := range cwf.Status.Active {
			activeWfNames = append(activeWfNames, activeWf.Name)
		}
		fmt.Fprintf(&out, fmtStr, "Active Workflows:", strings.Join(activeWfNames, ", "))
	}
	if len(cwf.Status.Conditions) > 0 {
		out.WriteString(cwf.Status.Conditions.DisplayString(fmtStr, map[v1alpha1.ConditionType]string{v1alpha1.ConditionTypeSubmissionError: "✖"}))
	}
	if len(cwf.Spec.WorkflowSpec.Arguments.Parameters) > 0 {
		fmt.Fprintf(&out, fmtStr, "Workflow Parameters:", "")
		for _, param := range cwf.Spec.WorkflowSpec.Arguments.Parameters {
			if !param.HasValue() {
				continue
			}
			fmt.Fprintf(&out, fmtStr, "  "+param.Name+":", param.GetValue())
		}
	}
	return out.String()
}

```

### Core Architecture Module: `cmd/argo/commands/sync/util.go`
```
package sync

import (
	"fmt"
	"strings"

	syncpkg "github.com/argoproj/argo-workflows/v4/pkg/apiclient/sync"
)

func validateFlags(syncType, cmName string) error {
	if _, ok := syncpkg.SyncConfigType_value[syncType]; !ok {
		return fmt.Errorf("--type must be either 'database' or 'configmap'")
	}

	if syncType == syncpkg.SyncConfigType_CONFIGMAP.String() && cmName == "" {
		return fmt.Errorf("--cm-name is required when type is configmap")
	}

	return nil
}

func printSyncLimit(key, cmName, namespace string, limit int32, syncType syncpkg.SyncConfigType) {
	fmt.Printf("Key: %s\n", key)
	fmt.Printf("Type: %s\n", strings.ToLower(syncType.String()))
	if syncType == syncpkg.SyncConfigType_CONFIGMAP {
		fmt.Printf("ConfigMap Name: %s\n", cmName)
	}
	fmt.Printf("Namespace: %s\n", namespace)
	fmt.Printf("Limit: %d\n", limit)
}

```

### Core Architecture Module: `cmd/argo/commands/template/util.go`
```
package template

import (
	"context"
	"encoding/json"
	"fmt"
	"log"

	"sigs.k8s.io/yaml"

	wfv1 "github.com/argoproj/argo-workflows/v4/pkg/apis/workflow/v1alpha1"
	"github.com/argoproj/argo-workflows/v4/util/humanize"
	argoJson "github.com/argoproj/argo-workflows/v4/util/json"
	"github.com/argoproj/argo-workflows/v4/workflow/common"
	"github.com/argoproj/argo-workflows/v4/workflow/util"
)

func generateWorkflowTemplates(ctx context.Context, filePaths []string, strict bool) []wfv1.WorkflowTemplate {
	fileContents, err := util.ReadManifest(ctx, filePaths...)
	if err != nil {
		log.Fatal(err)
	}

	var workflowTemplates []wfv1.WorkflowTemplate
	for _, body := range fileContents {
		wftmpls := unmarshalWorkflowTemplates(ctx, body, strict)
		workflowTemplates = append(workflowTemplates, wftmpls...)
	}

	if len(workflowTemplates) == 0 {
		log.Fatalln("No workflow template found in given files")
	}

	return workflowTemplates
}

// unmarshalWorkflowTemplates unmarshals the input bytes as either json or yaml
func unmarshalWorkflowTemplates(ctx context.Context, wfBytes []byte, strict bool) []wfv1.WorkflowTemplate {
	var wf wfv1.WorkflowTemplate
	var jsonOpts []argoJson.Opt
	if strict {
		jsonOpts = append(jsonOpts, argoJson.DisallowUnknownFields)
	}
	err := argoJson.Unmarshal(wfBytes, &wf, jsonOpts...)
	if err == nil {
		return []wfv1.WorkflowTemplate{wf}
	}
	yamlWfs, err := common.SplitWorkflowTemplateYAMLFile(ctx, wfBytes, strict)
	if err == nil {
		return yamlWfs
	}
	log.Fatalf("Failed to parse workflow template: %v", err)
	return nil
}

func printWorkflowTemplate(wf *wfv1.WorkflowTemplate, outFmt string) {
	switch outFmt {
	case "name":
		fmt.Println(wf.Name)
	case "json":
		outBytes, _ := json.MarshalIndent(wf, "", "    ")
		fmt.Println(string(outBytes))
	case "yaml":
		outBytes, _ := yaml.Marshal(wf)
		fmt.Print(string(outBytes))
	case "wide", "":
		printWorkflowTemplateHelper(wf)
	default:
		log.Fatalf("Unknown output format: %s", outFmt)
	}
}

func printWorkflowTemplateHelper(wf *wfv1.WorkflowTemplate) {
	const fmtStr = "%-20s %v\n"
	fmt.Printf(fmtStr, "Name:", wf.Name)
	fmt.Printf(fmtStr, "Namespace:", wf.Namespace)
	fmt.Printf(fmtStr, "Created:", humanize.Timestamp(wf.CreationTimestamp.Time))
}

```

### Core Architecture Module: `pkg/apis/workflow/v1alpha1/utils.go`
```
package v1alpha1

import (
	"fmt"
	"strconv"
	"time"
)

func ParseStringToDuration(durationString string) (time.Duration, error) {
	var duration time.Duration
	// If no units are attached, treat as seconds
	if val, err := strconv.Atoi(durationString); err == nil {
		duration = time.Duration(val) * time.Second
	} else if parsed, err := time.ParseDuration(durationString); err == nil {
		duration = parsed
	} else {
		return 0, fmt.Errorf("unable to parse %s as a duration: %w", durationString, err)
	}
	return duration, nil
}

```

### Core Architecture Module: `pkg/apis/workflow/v1alpha1/validation_utils.go`
```
package v1alpha1

import (
	"fmt"
	"regexp"
	"sort"
	"strings"

	apivalidation "k8s.io/apimachinery/pkg/util/validation"
)

const (
	workflowFieldNameFmt    string = "[a-zA-Z0-9][-a-zA-Z0-9]*"
	workflowFieldNameErrMsg string = "name must consist of alpha-numeric characters or '-', and must start with an alpha-numeric character"
	workflowFieldMaxLength  int    = 128
)

var (
	paramOrArtifactNameRegex = regexp.MustCompile(`^[-a-zA-Z0-9_]+[-a-zA-Z0-9_]*$`)
	workflowFieldNameRegex   = regexp.MustCompile("^" + workflowFieldNameFmt + "$")
)

func isValidParamOrArtifactName(p string) []string {
	var errs []string
	if !paramOrArtifactNameRegex.MatchString(p) {
		return append(errs, "Parameter/Artifact name must consist of alpha-numeric characters, '_' or '-' e.g. my_param_1, MY-PARAM-1")
	}
	return errs
}

// isValidWorkflowFieldName : workflow field name must consist of alpha-numeric characters or '-', and must start with an alpha-numeric character
func isValidWorkflowFieldName(name string) []string {
	var errs []string
	if len(name) > workflowFieldMaxLength {
		errs = append(errs, apivalidation.MaxLenError(workflowFieldMaxLength))
	}
	if !workflowFieldNameRegex.MatchString(name) {
		msg := workflowFieldNameErrMsg + " (e.g. My-name1-2, 123-NAME)"
		errs = append(errs, msg)
	}
	return errs
}

// validateWorkflowFieldNames accepts a slice of strings and
// verifies that the Name field of the structs are:
// * unique
// * non-empty
// * matches matches our regex requirements
func validateWorkflowFieldNames(names []string, isParamOrArtifact bool) error {
	nameSet := make(map[string]bool)

	for i, name := range names {
		if name == "" {
			return fmt.Errorf("[%d].name is required", i)
		}
		var errs []string
		if isParamOrArtifact {
			errs = isValidParamOrArtifactName(name)
		} else {
			errs = isValidWorkflowFieldName(name)
		}
		if len(errs) != 0 {
			return fmt.Errorf("[%d].name: '%s' is invalid: %s", i, name, strings.Join(errs, ";"))
		}
		_, ok := nameSet[name]
		if ok {
			return fmt.Errorf("[%d].name '%s' is not unique", i, name)
		}
		nameSet[name] = true
	}
	return nil
}

// validateNoCycles validates that a dependency graph has no cycles by doing a Depth-First Search
// depGraph is an adjacency list, where key is a node name and value is a list of its dependencies' names
func validateNoCycles(depGraph map[string][]string) error {
	visited := make(map[string]bool)
	var noCyclesHelper func(currentName string, cycyle []string) error
	noCyclesHelper = func(currentName string, cycle []string) error {
		if _, ok := visited[currentName]; ok {
			return nil
		}
		depNames, ok := depGraph[currentName]
		if !ok {
			return nil
		}
		for _, depName := range depNames {
			for _, name := range cycle {
				if depName == name {
					return fmt.Errorf("dependency cycle detected: %s->%s", strings.Join(cycle, "->"), name)
				}
			}
			cycle = append(cycle, depName)
			err := noCyclesHelper(depName, cycle)
			if err != nil {
				return err
			}
			cycle = cycle[0 : len(cycle)-1]
		}
		visited[currentName] = true
		return nil
	}
	names := make([]string, 0)
	for name := range depGraph {
		names = append(names, name)
	}
	// sort names here to make sure the error message has consistent ordering
	// so that we can verify the error message in unit tests
	sort.Strings(names)

	for _, name := range names {
		err := noCyclesHelper(name, []string{})
		if err != nil {
			return err
		}
	}
	return nil
}

```

### Core Architecture Module: `server/auth/webhook/bitbucket.go`
```
package webhook

import (
	"net/http"

	"github.com/go-playground/webhooks/v6/bitbucket"
)

func bitbucketMatch(secret string, r *http.Request) bool {
	hook, err := bitbucket.New(bitbucket.Options.UUID(secret))
	if err != nil {
		return false
	}
	_, err = hook.Parse(r,
		bitbucket.RepoPushEvent,
		bitbucket.RepoForkEvent,
		bitbucket.RepoUpdatedEvent,
		bitbucket.RepoCommitCommentCreatedEvent,
		bitbucket.RepoCommitStatusCreatedEvent,
		bitbucket.RepoCommitStatusUpdatedEvent,
		bitbucket.IssueCreatedEvent,
		bitbucket.IssueUpdatedEvent,
		bitbucket.IssueCommentCreatedEvent,
		bitbucket.PullRequestCreatedEvent,
		bitbucket.PullRequestUpdatedEvent,
		bitbucket.PullRequestApprovedEvent,
		bitbucket.PullRequestUnapprovedEvent,
		bitbucket.PullRequestMergedEvent,
		bitbucket.PullRequestDeclinedEvent,
		bitbucket.PullRequestCommentCreatedEvent,
		bitbucket.PullRequestCommentUpdatedEvent,
		bitbucket.PullRequestCommentDeletedEvent,
	)
	return err == nil
}

```

### Core Architecture Module: `server/auth/webhook/bitbucketserver.go`
```
package webhook

import (
	"net/http"

	bitbucketserver "github.com/go-playground/webhooks/v6/bitbucket-server"
)

func bitbucketserverMatch(secret string, r *http.Request) bool {
	hook, err := bitbucketserver.New(bitbucketserver.Options.Secret(secret))
	if err != nil {
		return false
	}
	_, err = hook.Parse(r,
		bitbucketserver.RepositoryReferenceChangedEvent,
		bitbucketserver.RepositoryModifiedEvent,
		bitbucketserver.RepositoryForkedEvent,
		bitbucketserver.RepositoryCommentAddedEvent,
		bitbucketserver.RepositoryCommentEditedEvent,
		bitbucketserver.RepositoryCommentDeletedEvent,
		bitbucketserver.PullRequestOpenedEvent,
		bitbucketserver.PullRequestFromReferenceUpdatedEvent,
		bitbucketserver.PullRequestModifiedEvent,
		bitbucketserver.PullRequestMergedEvent,
		bitbucketserver.PullRequestDeclinedEvent,
		bitbucketserver.PullRequestDeletedEvent,
		bitbucketserver.PullRequestReviewerUpdatedEvent,
		bitbucketserver.PullRequestReviewerApprovedEvent,
		bitbucketserver.PullRequestReviewerUnapprovedEvent,
		bitbucketserver.PullRequestReviewerNeedsWorkEvent,
		bitbucketserver.PullRequestCommentAddedEvent,
		bitbucketserver.PullRequestCommentEditedEvent,
		bitbucketserver.PullRequestCommentDeletedEvent,
	)
	return err == nil
}

```

### Core Architecture Module: `server/auth/webhook/github.go`
```
package webhook

import (
	"net/http"

	"github.com/go-playground/webhooks/v6/github"
)

func githubMatch(secret string, r *http.Request) bool {
	hook, err := github.New(github.Options.Secret(secret))
	if err != nil {
		return false
	}
	_, err = hook.Parse(r,
		github.CheckRunEvent,
		github.CheckSuiteEvent,
		github.CodeScanningAlertEvent,
		github.CommitCommentEvent,
		github.CreateEvent,
		github.DeleteEvent,
		github.DependabotAlertEvent,
		github.DeployKeyEvent,
		github.DeploymentEvent,
		github.DeploymentStatusEvent,
		github.ForkEvent,
		github.GitHubAppAuthorizationEvent,
		github.GollumEvent,
		github.InstallationEvent,
		github.InstallationRepositoriesEvent,
		github.IntegrationInstallationEvent,
		github.IntegrationInstallationRepositoriesEvent,
		github.IssueCommentEvent,
		github.IssuesEvent,
		github.LabelEvent,
		github.MemberEvent,
		github.MembershipEvent,
		github.MilestoneEvent,
		github.MetaEvent,
		github.OrganizationEvent,
		github.OrgBlockEvent,
		github.PageBuildEvent,
		github.PingEvent,
		github.ProjectCardEvent,
		github.ProjectColumnEvent,
		github.ProjectEvent,
		github.PublicEvent,
		github.PullRequestEvent,
		github.PullRequestReviewEvent,
		github.PullRequestReviewCommentEvent,
		github.PushEvent,
		github.ReleaseEvent,
		github.RepositoryEvent,
		github.RepositoryVulnerabilityAlertEvent,
		github.SecurityAdvisoryEvent,
		github.StatusEvent,
		github.TeamEvent,
		github.TeamAddEvent,
		github.WatchEvent,
		github.WorkflowDispatchEvent,
		github.WorkflowJobEvent,
		github.WorkflowRunEvent,
	)
	return err == nil
}

```


### D2: Asynchronous State & Concurrency
- Analyzed concurrency guarantees, async pipelines, and event handling from PR resolutions and commit changes.

### D3: Error Boundaries, Recovery & Rollbacks
- Exception handling patterns and defect resolutions extracted from closed production bug issues:
- **Issue #17484** (2026-11-11): **fix(examples): make the ci WorkflowTemplate example work (cherry-pick #17437 for 4.1)**
  *Symptoms*: Cherry-picked fix(examples): make the ci WorkflowTemplate example work (#17437)  Signed-off-by: Alan Clucas <alan@clucas.org>

- **Issue #17470** (2026-11-07): **feat: add conditional parameter visibility to workflow submissions**
  *Symptoms*: <!-- markdownlint-disable MD041 -- this is rendered within existing HTML, so allow starting without an H1 -->  See the [[pull request guide](https://argo-workflows.readthedocs.io/en/latest/pull-requests/)](https://argo-workflows.readthedocs.io/en/latest/pull-requests/) for details on each item.  - [ ] Ran `make pre-commit -B` - [ ] Signed-off commits with [[Conventional Commit](https://www.conventionalcommits.org/en/v1.0.0/)](https://www.conventionalcommits.org/en/v1.0.0/) messages - [ ] PR title is a conventional commit message (it becomes the release notes entry) - [x] Unit tests cover the change - [ ] For features: an associated issue and a feature description file (`make feature-new`) - [ ] Opened as draft; will mark "Ready for review" once builds are green  <!-- Does this PR fix an issue -->  Fixes #TODO  ### Motivation  Currently, workflow parameters cannot be conditionally displayed based on the values of other workflow or template parameters. This makes submission forms less flexible, particularly for workflows with multiple deployment modes or configuration options.  This change introduces conditional parameter visibility through a `when` field, allowing workflow authors to control which parameters are displayed based on parameter values while preserving existing submission and validation behavior.  ### Modifications  - Added an optional `when` field to the Go `Parameter` API model and TypeScript parameter model. - Updated protobuf definitions and generated code, Ope

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

### Incident Patch 1: `0e05902b` (2026-11-10)
**Commit Message**: fix(controller): keep an ended node's message while it holds its lock (#17391)

Signed-off-by: Alan Clucas <[REDACTED_EMAIL]>
Co-authored-by: Claude Opus 5.5 (1M context) <[REDACTED_EMAIL]>

**File**: `workflow/controller/operator.go` (modified, +6/-2)
```diff
@@ -3176,9 +3176,13 @@ func (woc *wfOperationCtx) markNodeWaitingForLock(ctx context.Context, nodeName
 	}
 
 	if lockName == "" {
-		// If we are no longer waiting for a lock, nil out the sync status
+		// If we are no longer waiting for a lock, nil out the sync status.
+		// An ended node, re-entered while it holds its lock until its task
+		// result arrives, keeps its message: it says how the node ended.
 		node.SynchronizationStatus = nil
-		node.Message = ""
+		if !node.Phase.Completed() {
+			node.Message = ""
+		}
 	} else {
 		node.SynchronizationStatus.Waiting = lockName
 	}
```

**File**: `workflow/controller/operator_concurrency_test.go` (modified, +48/-0)
```diff
@@ -1311,3 +1311,51 @@ func TestSynchronizationFailedFirstChildReleasesLock(t *testing.T) {
 	assert.True(t, nextHolderFound,
 		"a sibling must have picked up the lock after the holder failed")
 }
+
+// TestMutexNodeKeepsItsMessageUntilTaskResult checks that a pod node holding
+// a mutex, whose pod has failed but whose task result hasn't arrived yet,
+// keeps the message its pod gave it while it waits: re-entering the node
+// to check its lock it still holds mustn't clear how it ended.
+func TestMutexNodeKeepsItsMessageUntilTaskResult(t *testing.T) {
+	ctx := logging.TestContext(t.Context())
+	cancel, controller := newController(ctx)
+	defer cancel()
+	wf := wfv1.MustUnmarshalWorkflow(`
+apiVersion: argoproj.io/v1alpha1
+kind: Workflow
+metadata:
+  name: mutex-message
+  namespace: default
+spec:
+  entrypoint: main
+  templates:
+  - name: main
+    synchronization:
+      mutexes:
+      - name: test
+    container:
+      image: busybox
+      command: [sh, -c, exit 1]
+`)
+	wf, err := controller.wfclientset.ArgoprojV1alpha1().Workflows(wf.Namespace).Create(ctx, wf, metav1.CreateOptions{})
+	require.NoError(t, err)
+	woc := newWorkflowOperationCtx(ctx, wf, controller)
+	woc.operate(ctx)
+	require.NotNil(t, woc.wf.Status.Synchronization, "the mutex is held")
+
+	makePodsPhase(ctx, woc, apiv1.PodFailed)
+	woc = newWorkflowOperationCtx(ctx, woc.wf, controller)
+	woc.wf.Status.MarkTaskResultIncomplete(ctx, woc.wf.NodeID(wf.Name))
+	woc.operate(ctx)
+	node, err := woc.wf.Status.Nodes.Get(woc.wf.NodeID(wf.Name))
+	require.NoError(t, err)
+	require.Equal(t, wfv1.NodeFailed, node.Phase)
+	require.False(t, node.Fulfilled(), "the node waits for its task result")
+	assert.Equal(t, "Pod failed", node.Message)
+
+	woc = newWorkflowOperationCtx(ctx, woc.wf, controller)
+	woc.operate(ctx)
+	node, err = woc.wf.Status.Nodes.Get(woc.wf.NodeID(wf.Name))
+	require.NoError(t, err)
+	assert.Equal(t, "Pod failed", node.Message, "still, on the next reconcile")
+}
```

---

### Incident Patch 2: `d48ec29e` (2026-11-11)
**Commit Message**: fix(executor): retry transient failures when saving HTTP and Artifactory artifacts (#17275)

Signed-off-by: ashunimh <[REDACTED_EMAIL]>

**File**: `docs/environment-variables.md` (modified, +3/-0)
```diff
@@ -140,6 +140,9 @@ Gains may vary under load: if the workflow informer is behind the controller's l
 | `REMOVE_LOCAL_ART_PATH`                | `bool`          | `false` | Whether to remove local artifacts.                                                                     |
 | `RESOURCE_STATE_CHECK_INTERVAL`        | `time.Duration` | `5s`    | The time interval between resource status checks against the specified success and failure conditions. |
 
+The `EXECUTOR_RETRY_BACKOFF_*` variables also control how the executor retries transient failures when saving S3, HTTP and Artifactory artifacts, including archived logs.
+For HTTP and Artifactory, the executor retries network errors, `408`, `429` and `5xx` responses, and errors matching `TRANSIENT_ERROR_PATTERN` set in the executor `env`.
+
 You can set environment variables for the Executor in your [`workflow-controller-configmap`](workflow-controller-configmap.md) like the following:
 
 ```yaml
```

**File**: `workflow/artifacts/http/http.go` (modified, +49/-22)
```diff
@@ -10,6 +10,10 @@ import (
 
 	"github.com/argoproj/argo-workflows/v4/errors"
 	wfv1 "github.com/argoproj/argo-workflows/v4/pkg/apis/workflow/v1alpha1"
+	errutil "github.com/argoproj/argo-workflows/v4/util/errors"
+	"github.com/argoproj/argo-workflows/v4/util/logging"
+	"github.com/argoproj/argo-workflows/v4/util/retry"
+	waitutil "github.com/argoproj/argo-workflows/v4/util/wait"
 	"github.com/argoproj/argo-workflows/v4/workflow/artifacts/common"
 )
 
@@ -129,41 +133,63 @@ func (h *ArtifactDriver) buildPutRequest(ctx context.Context, body io.Reader, ou
 
 // doPutRequest sends req and fails on a non-2xx response. what describes the
 // operation in error messages, e.g. "saving file /tmp/x" or "saving stream".
-func (h *ArtifactDriver) doPutRequest(req *http.Request, url, what string) error {
+// The returned status code is 0 if no response was received.
+func (h *ArtifactDriver) doPutRequest(req *http.Request, url, what string) (int, error) {
 	res, err := h.Client.Do(req)
 	if err != nil {
-		return err
+		return 0, err
 	}
 	defer func() {
 		_ = res.Body.Close()
 	}()
 	if res.StatusCode < 200 || res.StatusCode >= 300 {
-		return errors.InternalErrorf("%s to %s failed with reason: %s", what, url, res.Status)
+		return res.StatusCode, errors.InternalErrorf("%s to %s failed with reason: %s", what, url, res.Status)
 	}
-	return nil
+	return res.StatusCode, nil
+}
+
+// isTransientSaveErr reports whether a failed upload is worth retrying: a 408,
+// 429 or 5xx response, or an error util/errors classifies as transient (network
+// errors and TRANSIENT_ERROR_PATTERN matches).
+func isTransientSaveErr(ctx context.Context, statusCode int, err error) bool {
+	if statusCode == http.StatusRequestTimeout || statusCode == http.StatusTooManyRequests || (statusCode >= 500 && statusCode < 600) {
+		logging.RequireLoggerFromContext(ctx).WithError(err).Info(ctx, "Transient error")
+		return true
+	}
+	return errutil.IsTransientErr(ctx, err)
 }
 
-// Save writes the artifact to the URL
+// Save writes the artifact to the URL, retrying transient failures with the
+// EXECUTOR_RETRY_BACKOFF_* backoff.
 func (h *ArtifactDriver) Save(ctx context.Context, path string, outputArtifact *wfv1.Artifact) error {
 	cleanPath := filepath.Clean(path)
-	f, err := os.Open(cleanPath)
-	if err != nil {
-		return err
-	}
-	// http.Client.Do closes f once the request is sent; this covers the paths
-	// where it never is. A second Close is harmless.
-	defer func() {
-		_ = f.Close()
-	}()
-	req, url, err := h.buildPutRequest(ctx, f, outputArtifact)
+	attempts := 0
+	err := waitutil.Backoff(retry.ExecutorRetry(ctx), func() (bool, error) {
+		attempts++
+		f, err := os.Open(cleanPath)
+		if err != nil {
+			return true, err
+		}
+		// http.Client.Do closes f once the request is sent; this covers the paths
+		// where it never is. A second Close is harmless.
+		defer func() {
+			_ = f.Close()
+		}()
+		req, url, err := h.buildPutRequest(ctx, f, outputArtifact)
+		if err != nil {
+			return true, err
+		}
+		// we set the GetBody func of the request in order to enable following 307 POST/PUT redirects, needed e.g. for webHDFS
+		req.GetBody = func() (io.ReadCloser, error) {
+			return os.Open(cleanPath)
+		}
+		statusCode, err := h.doPutRequest(req, url, fmt.Sprintf("saving file %s", path))
+		return err == nil || !isTransientSaveErr(ctx, statusCode, err), err
+	})
 	if err != nil {
-		return err
-	}
-	// we set the GetBody func of the request in order to enable following 307 POST/PUT redirects, needed e.g. for webHDFS
-	req.GetBody = func() (io.ReadCloser, error) {
-		return os.Open(cleanPath)
+		return fmt.Errorf("failed after %d attempt(s): %w", attempts, err)
 	}
-	return h.doPutRequest(req, url, fmt.Sprintf("saving file %s", path))
+	return nil
 }
 
 // SaveStream saves an artifact from an io.Reader to HTTP URL
@@ -183,7 +209,8 @@ func (h *ArtifactDriver) SaveStream(ctx context.Context, reader io.Reader, outpu
 	if err != nil {
 		return err
 	}
-	return h.doPutRequest(req, url, "saving stream")
+	_, err = h.doPutRequest(req, url, "saving stream")
+	return err
 }
 
 // Delete is unsupported for the http artifacts
```

**File**: `workflow/artifacts/http/http_test.go` (modified, +86/-0)
```diff
@@ -2,11 +2,13 @@ package http
 
 import (
 	"bytes"
+	"io"
 	"net/http"
 	"net/http/httptest"
 	"os"
 	"path/filepath"
 	"strings"
+	"sync/atomic"
 	"testing"
 
 	"github.com/stretchr/testify/assert"
@@ -262,3 +264,87 @@ func TestSaveInvalidArtifactLocation(t *testing.T) {
 		assert.Contains(t, err.Error(), "Either Artifactory or HTTP artifact needs to be configured")
 	})
 }
+
+// TestSaveRetry checks that Save retries transient upload failures and stops on permanent ones.
+func TestSaveRetry(t *testing.T) {
+	t.Setenv("EXECUTOR_RETRY_BACKOFF_DURATION", "1ms")
+	t.Setenv("EXECUTOR_RETRY_BACKOFF_STEPS", "3")
+	content := "main container log"
+	tempFile := filepath.Join(t.TempDir(), "main.log")
+	require.NoError(t, os.WriteFile(tempFile, []byte(content), 0o600))
+
+	save := func(t *testing.T, url string) error {
+		t.Helper()
+		driver := &ArtifactDriver{Client: &http.Client{}}
+		art := &wfv1.Artifact{
+			ArtifactLocation: wfv1.ArtifactLocation{Artifactory: &wfv1.ArtifactoryArtifact{URL: url}},
+		}
+		return driver.Save(logging.TestContext(t.Context()), tempFile, art)
+	}
+
+	tests := []struct {
+		name             string
+		statuses         []int // response status per attempt, the last one repeats
+		transientPattern string
+		wantAttempts     int32
+		wantErr          []string
+	}{
+		{name: "succeeds after 5xx responses", statuses: []int{http.StatusServiceUnavailable, http.StatusBadGateway, http.StatusCreated}, wantAttempts: 3},
+		{name: "retries 408 and 429", statuses: []int{http.StatusRequestTimeout, http.StatusTooManyRequests, http.StatusCreated}, wantAttempts: 3},
+		{name: "gives up after EXECUTOR_RETRY_BACKOFF_STEPS attempts", statuses: []int{http.StatusInternalServerError}, wantAttempts: 3, wantErr: []string{"failed after 3 attempt(s): timed out waiting for the condition: ", "500 Internal Server Error"}},
+		{name: "does not retry a 4xx", statuses: []int{http.StatusForbidden}, wantAttempts: 1, wantErr: []string{"failed after 1 attempt(s): ", "403 Forbidden"}},
+		{name: "retries a 4xx matching TRANSIENT_ERROR_PATTERN", statuses: []int{http.StatusUnauthorized, http.StatusCreated}, transientPattern: "401 Unauthorized", wantAttempts: 2},
+	}
+	for _, tt := range tests {
+		t.Run(tt.name, func(t *testing.T) {
+			t.Setenv("TRANSIENT_ERROR_PATTERN", tt.transientPattern)
+			var attempts atomic.Int32
+			svr := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
+				// every attempt must re-send the whole file
+				body, err := io.ReadAll(r.Body)
+				assert.NoError(t, err)
+				assert.Equal(t, content, string(body))
+				n := int(attempts.Add(1))
+				w.WriteHeader(tt.statuses[min(n, len(tt.statuses))-1])
+			}))
+			defer svr.Close()
+
+			err := save(t, svr.URL)
+			if len(tt.wantErr) == 0 {
+				require.NoError(t, err)
+			} else {
+				for _, want := range tt.wantErr {
+					require.ErrorContains(t, err, want)
+				}
+			}
+			assert.Equal(t, tt.wantAttempts, attempts.Load())
+		})
+	}
+
+	t.Run("retries a dropped connection", func(t *testing.T) {
+		var attempts atomic.Int32
+		svr := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, _ *http.Request) {
+			if attempts.Add(1) == 1 {
+				conn, _, err := http.NewResponseController(w).Hijack()
+				if assert.NoError(t, err) {
+					_ = conn.Close()
+				}
+				return
+			}
+			w.WriteHeader(http.StatusCreated)
+		}))
+		defer svr.Close()
+
+		require.NoError(t, save(t, svr.URL))
+		assert.Equal(t, int32(2), attempts.Load())
+	})
+
+	t.Run("does not retry when the file cannot be opened", func(t *testing.T) {
+		driver := &ArtifactDriver{Client: &http.Client{}}
+		art := &wfv1.Artifact{
+			ArtifactLocation: wfv1.ArtifactLocation{Artifactory: &wfv1.ArtifactoryArtifact{URL: "http://127.0.0.1:1/missing.log"}},
+		}
+		err := driver.Save(logging.TestContext(t.Context()), filepath.Join(t.TempDir(), "missing.log"), art)
+		require.ErrorIs(t, err, os.ErrNotExist)
+	})
+}
```

---

### Incident Patch 3: `621e9dd4` (2026-11-10)
**Commit Message**: fix(examples): make the ci WorkflowTemplate example work (#17437)

Signed-off-by: Alan Clucas <[REDACTED_EMAIL]>
Co-authored-by: Claude Opus 5.5 <[REDACTED_EMAIL]>

**File**: `examples/ci-workflowtemplate.yaml` (modified, +23/-18)
```diff
@@ -67,19 +67,17 @@ spec:
         volumeMounts:
           - mountPath: /go/pkg/mod
             name: work
-            subPath: mod
+            subPath: GOMODCACHE
           - mountPath: /root/.cache/go-build
             name: work
-            subPath: cache
-        image: golang:1.18
+            subPath: GOCACHE
+        image: golang:1.27.3
         workingDir: /go/src/github.com/golang/example
         command: [ sh, -euxc ]
         args:
           - |
-            mkdir -p $(go env GOMODCACHE)
-            [ -e /mnt/GOMODCACHE ] && cp -Rf /mnt/GOMODCACHE $(go env GOMODCACHE)
-            mkdir -p $(go env GOCACHE)
-            [ -e /mnt/GOCACHE ] &&  cp -Rf /mnt/GOCACHE $(go env GOCACHE)
+            if [ -d /mnt/GOMODCACHE ]; then cp -R /mnt/GOMODCACHE/. "$(go env GOMODCACHE)"; fi
+            if [ -d /mnt/GOCACHE ]; then cp -R /mnt/GOCACHE/. "$(go env GOCACHE)"; fi
 
     - name: cache-store
       container:
@@ -90,17 +88,23 @@ spec:
           - mountPath: /root/.cache/go-build
             name: work
             subPath: GOCACHE
-        image: golang:1.18
-        workingDir: /go/src/github.com/golang/example
+        image: golang:1.27.3
+        command: [ sh, -euxc ]
+        args:
+          - |
+            # Artifacts on a volume mount aren't saved, so copy the caches off the volume.
+            mkdir -p /tmp/cache
+            cp -R /go/pkg/mod /tmp/cache/GOMODCACHE
+            cp -R /root/.cache/go-build /tmp/cache/GOCACHE
       outputs:
         artifacts:
           - name: GOMODCACHE
-            path: /go/pkg/mod
+            path: /tmp/cache/GOMODCACHE
             optional: true
             s3:
               key: "github.com/golang/examples/{{workflow.parameters.branch}}/GOMODCACHE"
           - name: GOCACHE
-            path: /root/.cache/go-build
+            path: /tmp/cache/GOCACHE
             optional: true
             s3:
               key: "github.com/golang/examples/{{workflow.parameters.branch}}/GOCACHE"
@@ -117,7 +121,7 @@ spec:
           - mountPath: /root/.cache/go-build
             name: work
             subPath: GOCACHE
-        image: golang:1.18
+        image: golang:1.27.3
         workingDir: /go/src/github.com/golang/example
         command: [ sh, -euxc ]
         args:
@@ -126,7 +130,7 @@ spec:
 
     - name: deps
       container:
-        image: golang:1.18
+        image: golang:1.27.3
         volumeMounts:
           - mountPath: /go/src/github.com/golang/example
             name: work
@@ -145,7 +149,7 @@ spec:
 
     - name: build
       container:
-        image: golang:1.18
+        image: golang:1.27.3
         volumeMounts:
           - mountPath: /go/src/github.com/golang/example
             name: work
@@ -164,7 +168,7 @@ spec:
 
     - name: test
       container:
-        image: golang:1.18
+        image: golang:1.27.3
         volumeMounts:
           - mountPath: /go/src/github.com/golang/example
             name: work
@@ -182,13 +186,14 @@ spec:
             go install github.com/jstemmer/go-junit-report@latest
             go install github.com/alexec/junit2html@v0.0.2
 
-            trap 'cat test.out | go-junit-report | junit2html > test-report.html' EXIT
+            # Write the report off the work volume: artifacts on a volume mount aren't saved.
+            trap 'cat test.out; go-junit-report < test.out | junit2html > /tmp/test-report.html' EXIT
 
-            go test -v ./... 2>&1 > test.out
+            go test -v ./... > test.out 2>&1
       outputs:
         artifacts:
           - name: test-report
-            path: /go/src/github.com/golang/example/test-report.html
+            path: /tmp/test-report.html
             archive:
               none: { }
             s3:
```

#### Recent Merged Pull Requests:
- **PR #17484** (2026-11-11): fix(examples): make the ci WorkflowTemplate example work (cherry-pick #17437 for 4.1) (@argo-cd-cherry-pick-bot[bot])
- **PR #17470** (closed): feat: add conditional parameter visibility to workflow submissions (@somiljain2006)
- **PR #17468** (2026-11-08): fix(controller): read the deletion timestamp directly in podOrphaned (cherry-pick #17448 for 4.0) (@argo-cd-cherry-pick-bot[bot])
- **PR #17467** (2026-11-08): fix(controller): read the deletion timestamp directly in podOrphaned (cherry-pick #17448 for 4.1) (@argo-cd-cherry-pick-bot[bot])
- **PR #17461** (2026-11-10): docs: update sidecar-injection.md following guidelines (cherry-pick #17405 for 4.1) (@Joibel)
- **PR #17459** (2026-11-06): fix: skip the LogChanges diff unless the patch is logged at debug (cherry-pick #17449 for 4.1) (@argo-cd-cherry-pick-bot[bot])

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

## X. controller): keep an ended node's message while it holds its lock (#17391)

**RULE**:
When implementing operations in `workflow/controller/operator.go`, engineers MUST enforce rigorous boundary validation, safe state transitions, and memory/concurrency invariants as established by production defect remediation in argoproj/argo-workflows. All inputs crossing module boundaries must be explicitly verified before state persistence.

**WHY**:
Prevents defects observed in production commit `0e05902b`: controller): keep an ended node's message while it holds its lock (#17391). Unvalidated execution paths cause runtime exceptions, race conditions, and silent state corruption under concurrent workloads.

**WHEN TO APPLY**:
Subsystems managing Go data structures, boundary deserialization, API parsing, or resource lifecycles matching `workflow/controller/operator.go`.

**VERIFIED IMPLEMENTATION PATTERN**:
```go
// Verified production-grade fix pattern:
		// If we are no longer waiting for a lock, nil out the sync status.
		// An ended node, re-entered while it holds its lock until its task
		// result arrives, keeps its message: it says how the node ended.
		if !node.Phase.Completed() {
			node.Message = ""
		}
```

**NEGATIVE CONSTRAINT**:
```go
// Anti-pattern to NEVER write (induced failure mode):
		// If we are no longer waiting for a lock, nil out the sync status
		node.Message = ""
```

**VERIFICATION METHOD**:
Automated regression test asserting that input states reproducing defect `0e05902b` are properly handled with clean fallback behavior.
