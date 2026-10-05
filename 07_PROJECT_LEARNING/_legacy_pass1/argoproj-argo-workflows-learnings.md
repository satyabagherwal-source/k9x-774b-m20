# Forensic Learning Record (Deep Inspection): argoproj/argo-workflows

> **Canonical Artifact**: `07_PROJECT_LEARNING/argoproj-argo-workflows-learnings.md`  
> **Source Platform**: GitHub ([https://github.com/argoproj/argo-workflows](https://github.com/argoproj/argo-workflows))  
> **Harvest Method**: Full-Spectrum Deep Extraction (Patches, Diffs, Source Code, Post-Mortems)  
> **Harvest Timestamp**: 2026-09-30T20:16:17.961Z  
> **Compliance State**: Free Tier Guaranteed | Strict Rate-Limit Backoff Honored  

---

## 1. Context & Architectural Overview
- **Repository / Resource**: `argoproj/argo-workflows`
- **Description**: Workflow Engine for Kubernetes
- **Primary Language / Ecosystem**: Go
- **Discovered Manifests / Configurations**: go.mod, README.md, Dockerfile
- **Stars / Engagement**: 17014 stars

---

## 2. Multi-Dimensional 8-Axis Investigation & Real Code Patches

### D1: Architecture & Structural Boundaries
- Entry configurations inspected via direct stream: go.mod, README.md, Dockerfile.
- Evaluated system abstractions and modular contracts.

### Core Architecture Module: `cmd/argo/commands/archive/delete.go`
```
package archive

import (
	"fmt"

	"github.com/spf13/cobra"

	client "github.com/argoproj/argo-workflows/v4/cmd/argo/commands/client"
	workflowarchivepkg "github.com/argoproj/argo-workflows/v4/pkg/apiclient/workflowarchive"
)

func NewDeleteCommand() *cobra.Command {
	var (
		forceName bool
		forceUID  bool
	)
	command := &cobra.Command{
		Use:   "delete WORKFLOW...",
		Short: "delete a workflow in the archive",
		Example: `# Delete an archived workflow by name:
  argo archive delete my-workflow

# Delete an archived workflow by UID (auto-detected):
  argo archive delete a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11

# Delete multiple archived workflows:
  argo archive delete my-workflow my-other-workflow

# Delete an archived workflow by name (forced):
  argo archive delete my-workflow --name

# Delete an archived workflow by UID (forced):
  argo archive delete a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11 --uid
`,
		RunE: func(cmd *cobra.Command, args []string) error {
			ctx, apiClient, err := client.NewAPIClient(cmd.Context())
			if err != nil {
				return err
			}
			serviceClient, err := apiClient.NewArchivedWorkflowServiceClient()
			if err != nil {
				return err
			}
			namespace := client.Namespace(ctx)
			for _, identifier := range args {
				uid, err := resolveUID(ctx, serviceClient, identifier, namespace, forceUID, forceName)
				if err != nil {
					return fmt.Errorf("resolve UID: %w", err)
				}
				if _, err = serviceClient.DeleteArchivedWorkflow(ctx, &workflowarchivepkg.DeleteArchivedWorkflowRequest{Uid: uid}); err != nil {
					return err
				}
				fmt.Printf("Archived workflow '%s' deleted\n", identifier)
			}
			return nil
		},
	}
	command.Flags().BoolVar(&forceName, "name", false, "force the argument to be treated as a name")
	command.Flags().BoolVar(&forceUID, "uid", false, "force the argument to be treated as a UID")
	command.MarkFlagsMutuallyExclusive("name", "uid")
	return command
}

```

### Core Architecture Module: `cmd/argo/commands/archive/get.go`
```
package archive

import (
	"encoding/json"
	"fmt"
	"log"

	"github.com/spf13/cobra"
	"sigs.k8s.io/yaml"

	"github.com/argoproj/argo-workflows/v4/cmd/argo/commands/client"
	"github.com/argoproj/argo-workflows/v4/cmd/argo/commands/common"
	workflowarchivepkg "github.com/argoproj/argo-workflows/v4/pkg/apiclient/workflowarchive"
	wfv1 "github.com/argoproj/argo-workflows/v4/pkg/apis/workflow/v1alpha1"
	"github.com/argoproj/argo-workflows/v4/util/humanize"
)

func NewGetCommand() *cobra.Command {
	var (
		output = common.EnumFlagValue{
			AllowedValues: []string{"json", "yaml", "wide"},
			Value:         "wide",
		}
		forceName bool
		forceUID  bool
	)
	command := &cobra.Command{
		Use:   "get WORKFLOW",
		Short: "get a workflow in the archive",
		Args:  cobra.ExactArgs(1),
		Example: `# Get information about an archived workflow by name:
  argo archive get my-workflow

# Get information about an archived workflow by UID (auto-detected):
  argo archive get a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11

# Get information about an archived workflow in YAML format:
  argo archive get my-workflow -o yaml

# Get information about an archived workflow by name (forced):
  argo archive get my-workflow --name

# Get information about an archived workflow by UID (forced):
  argo archive get a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11 --uid
`,
		RunE: func(cmd *cobra.Command, args []string) error {
			identifier := args[0]

			ctx, apiClient, err := client.NewAPIClient(cmd.Context())
			if err != nil {
				return err
			}
			serviceClient, err := apiClient.NewArchivedWorkflowServiceClient()
			if err != nil {
				return err
			}

			namespace := client.Namespace(ctx)
			uid, err := resolveUID(ctx, serviceClient, identifier, namespace, forceUID, forceName)
			if err != nil {
				return fmt.Errorf("resolve UID: %w", err)
			}

			wf, err := serviceClient.GetArchivedWorkflow(ctx, &workflowarchivepkg.GetArchivedWorkflowRequest{Uid: uid})
			if err != nil {
				return err
			}
			printWorkflow(wf, output.String())
			return nil
		},
	}
	command.Flags().VarP(&output, "output", "o", "Output format. "+output.Usage())
	command.Flags().BoolVar(&forceName, "name", false, "force the argument to be treated as a name")
	command.Flags().BoolVar(&forceUID, "uid", false, "force the argument to be treated as a UID")
	command.MarkFlagsMutuallyExclusive("name", "uid")
	return command
}

func printWorkflow(wf *wfv1.Workflow, output string) {
	switch output {
	case "json":
		output, err := json.Marshal(wf)
		if err != nil {
			log.Fatal(err)
		}
		fmt.Println(string(output))
	case "yaml":
		output, err := yaml.Marshal(wf)
		if err != nil {
			log.Fatal(err)
		}
		fmt.Println(string(output))
	default:
		const fmtStr = "%-20s %v\n"
		fmt.Printf(fmtStr, "Name:", wf.Name)
		fmt.Printf(fmtStr, "Namespace:", wf.Namespace)
		serviceAccount := wf.GetExecSpec().ServiceAccountName
		if serviceAccount == "" {
			// if serviceAccountName was not specified in a submitted Workflow, we will
			// use the serviceAccountName provided in Workflow Defaults (if any). If that
			// also isn't set, we will use the 'default' ServiceAccount in the namespace
			// the workflow will run in.
			serviceAccount = "unset (will run with the default ServiceAccount)"
		}
		fmt.Printf(fmtStr, "ServiceAccount:", serviceAccount)
		fmt.Printf(fmtStr, "Status:", wf.Status.Phase)
		if wf.Status.Message != "" {
			fmt.Printf(fmtStr, "Message:", wf.Status.Message)
		}
		fmt.Printf(fmtStr, "Created:", humanize.Timestamp(wf.CreationTimestamp.Time))
		if !wf.Status.StartedAt.IsZero() {
			fmt.Printf(fmtStr, "Started:", humanize.Timestamp(wf.Status.StartedAt.Time))
		}
		if !wf.Status.FinishedAt.IsZero() {
			fmt.Printf(fmtStr, "Finished:", humanize.Timestamp(wf.Status.FinishedAt.Time))
		}
		if !wf.Status.StartedAt.IsZero() {
			fmt.Printf(fmtStr, "Duration:", humanize.RelativeDuration(wf.Status.StartedAt.Time, wf.Status.FinishedAt.Time))
		}
	}
}

```

### Core Architecture Module: `cmd/argo/commands/archive/list.go`
```
package archive

import (
	"context"
	"os"
	"sort"

	"github.com/spf13/cobra"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"

	"github.com/argoproj/argo-workflows/v4/cmd/argo/commands/client"
	"github.com/argoproj/argo-workflows/v4/cmd/argo/commands/common"
	workflowarchivepkg "github.com/argoproj/argo-workflows/v4/pkg/apiclient/workflowarchive"
	wfv1 "github.com/argoproj/argo-workflows/v4/pkg/apis/workflow/v1alpha1"
	"github.com/argoproj/argo-workflows/v4/util/logging"
	"github.com/argoproj/argo-workflows/v4/util/printer"
)

func NewListCommand() *cobra.Command {
	var (
		selector  string
		output    = common.NewPrintWorkflowOutputValue("wide")
		chunkSize int64
	)
	command := &cobra.Command{
		Use:   "list",
		Short: "list workflows in the archive",
		Example: `# List all archived workflows:
  argo archive list

# List all archived workflows fetched in chunks of 100:
  argo archive list --chunk-size 100

# List all archived workflows in YAML format:
  argo archive list -o yaml

# List archived workflows that have both labels:
  argo archive list -l key1=value1,key2=value2
`,
		RunE: func(cmd *cobra.Command, args []string) error {
			ctx, apiClient, err := client.NewAPIClient(cmd.Context())
			if err != nil {
				return err
			}
			serviceClient, err := apiClient.NewArchivedWorkflowServiceClient()
			if err != nil {
				return err
			}
			namespace := client.Namespace(ctx)
			workflows, err := listArchivedWorkflows(ctx, serviceClient, namespace, selector, chunkSize)
			if err != nil {
				return err
			}
			return printer.PrintWorkflows(workflows, os.Stdout, printer.PrintOpts{Output: output.String(), Namespace: true, UID: true})
		},
	}
	command.Flags().VarP(&output, "output", "o", "Output format. "+output.Usage())
	command.Flags().StringVarP(&selector, "selector", "l", "", "Selector (label query) to filter on, not including uninitialized ones, supports '=', '==', and '!='.(e.g. -l key1=value1,key2=value2)")
	command.Flags().Int64VarP(&chunkSize, "chunk-size", "", 0, "Return large lists in chunks rather than all at once. Pass 0 to disable.")
	return command
}

func listArchivedWorkflows(ctx context.Context, serviceClient workflowarchivepkg.ArchivedWorkflowServiceClient, namespace string, labelSelector string, chunkSize int64) (wfv1.Workflows, error) {
	listOpts := &metav1.ListOptions{
		LabelSelector: labelSelector,
		Limit:         chunkSize,
	}
	var workflows wfv1.Workflows
	for {
		logger := logging.RequireLoggerFromContext(ctx)
		logger.WithField("listOpts", listOpts).Debug(ctx, "Listing archived workflows")
		resp, err := serviceClient.ListArchivedWorkflows(ctx, &workflowarchivepkg.ListArchivedWorkflowsRequest{Namespace: namespace, ListOptions: listOpts})
		if err != nil {
			return nil, err
		}
		workflows = append(workflows, resp.Items...)
		if resp.Continue == "" {
			break
		}
		listOpts.Continue = resp.Continue
	}
	sort.Sort(workflows)

	return workflows, nil
}

```

### Core Architecture Module: `cmd/argo/commands/archive/list_label_keys.go`
```
package archive

import (
	"fmt"

	"github.com/spf13/cobra"

	"github.com/argoproj/argo-workflows/v4/cmd/argo/commands/client"
	workflowarchivepkg "github.com/argoproj/argo-workflows/v4/pkg/apiclient/workflowarchive"
)

func NewListLabelKeyCommand() *cobra.Command {
	command := &cobra.Command{
		Use:   "list-label-keys",
		Short: "list workflows label keys in the archive",
		RunE: func(cmd *cobra.Command, args []string) error {
			ctx, apiClient, err := client.NewAPIClient(cmd.Context())
			if err != nil {
				return err
			}
			serviceClient, err := apiClient.NewArchivedWorkflowServiceClient()
			if err != nil {
				return err
			}
			keys, err := serviceClient.ListArchivedWorkflowLabelKeys(ctx, &workflowarchivepkg.ListArchivedWorkflowLabelKeysRequest{})
			if err != nil {
				return err
			}
			for _, str := range keys.Items {
				fmt.Printf("%s\n", str)
			}
			return nil
		},
	}
	return command
}

```

### Core Architecture Module: `cmd/argo/commands/archive/list_label_values.go`
```
package archive

import (
	"fmt"

	"github.com/spf13/cobra"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"

	"github.com/argoproj/argo-workflows/v4/cmd/argo/commands/client"
	workflowarchivepkg "github.com/argoproj/argo-workflows/v4/pkg/apiclient/workflowarchive"
	"github.com/argoproj/argo-workflows/v4/util/errors"
)

func NewListLabelValueCommand() *cobra.Command {
	var (
		selector string
	)
	command := &cobra.Command{
		Use:   "list-label-values",
		Short: "get workflow label values in the archive",
		RunE: func(cmd *cobra.Command, args []string) error {
			listOpts := &metav1.ListOptions{
				LabelSelector: selector,
			}

			ctx, apiClient, err := client.NewAPIClient(cmd.Context())
			if err != nil {
				return err
			}
			serviceClient, err := apiClient.NewArchivedWorkflowServiceClient()
			if err != nil {
				return err
			}
			labels, err := serviceClient.ListArchivedWorkflowLabelValues(ctx, &workflowarchivepkg.ListArchivedWorkflowLabelValuesRequest{ListOptions: listOpts})
			if err != nil {
				return err
			}

			for _, str := range labels.Items {
				fmt.Printf("%s\n", str)
			}

			return nil
		},
	}
	ctx := command.Context()
	command.Flags().StringVarP(&selector, "selector", "l", "", "Selector (label query) to query on, allows 1 value (e.g. -l key1)")
	err := command.MarkFlagRequired("selector")
	errors.CheckError(ctx, err)
	return command
}

```

### Core Architecture Module: `cmd/argo/commands/archive/resubmit.go`
```
package archive

import (
	"context"
	"fmt"

	"github.com/spf13/cobra"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/apimachinery/pkg/types"

	client "github.com/argoproj/argo-workflows/v4/cmd/argo/commands/client"
	"github.com/argoproj/argo-workflows/v4/cmd/argo/commands/common"
	workflowpkg "github.com/argoproj/argo-workflows/v4/pkg/apiclient/workflow"
	workflowarchivepkg "github.com/argoproj/argo-workflows/v4/pkg/apiclient/workflowarchive"
	wfv1 "github.com/argoproj/argo-workflows/v4/pkg/apis/workflow/v1alpha1"
)

type resubmitOps struct {
	priority      int32  // --priority
	memoized      bool   // --memoized
	namespace     string // --namespace
	labelSelector string // --selector
	fieldSelector string // --field-selector
	forceName     bool   // --name
	forceUID      bool   // --uid
}

// hasSelector returns true if the CLI arguments selects multiple workflows
func (o *resubmitOps) hasSelector() bool {
	if o.labelSelector != "" || o.fieldSelector != "" {
		return true
	}
	return false
}

func NewResubmitCommand() *cobra.Command {
	var (
		resubmitOpts  resubmitOps
		cliSubmitOpts = common.NewCliSubmitOpts()
	)
	command := &cobra.Command{
		Use:   "resubmit [WORKFLOW...]",
		Short: "resubmit one or more workflows",
		Example: `# Resubmit a workflow by name:

  argo archive resubmit my-workflow

# Resubmit a workflow by UID (auto-detected):

  argo archive resubmit a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11

# Resubmit multiple workflows:

  argo archive resubmit my-workflow another-workflow

# Resubmit multiple workflows by label selector:

  argo archive resubmit -l workflows.argoproj.io/test=true

# Resubmit multiple workflows by field selector:

  argo archive resubmit --field-selector metadata.namespace=argo

# Resubmit and wait for completion:

  argo archive resubmit --wait my-workflow

# Resubmit and watch until completion:

  argo archive resubmit --watch my-workflow

# Resubmit and tail logs until completion:

  argo archive resubmit --log my-workflow

# Resubmit a workflow by name (forced):

  argo archive resubmit my-workflow --name

# Resubmit a workflow by UID (forced):

  argo archive resubmit a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11 --uid
`,
		RunE: func(cmd *cobra.Command, args []string) error {
			if cmd.Flag("priority").Changed {
				cliSubmitOpts.Priority = &resubmitOpts.priority
			}

			ctx, apiClient, err := client.NewAPIClient(cmd.Context())
			if err != nil {
				return err
			}
			serviceClient := apiClient.NewWorkflowServiceClient(ctx) // needed for wait watch or log flags
			archiveServiceClient, err := apiClient.NewArchivedWorkflowServiceClient()
			if err != nil {
				return err
			}
			resubmitOpts.namespace = client.Namespace(ctx)
			return resubmitArchivedWorkflows(ctx, archiveServiceClient, serviceClient, resubmitOpts, cliSubmitOpts, args)
		},
	}

	command.Flags().StringArrayVarP(&cliSubmitOpts.Parameters, "parameter", "p", []string{}, "input parameter to override on the original workflow spec")
	command.Flags().Int32Var(&resubmitOpts.priority, "priority", 0, "workflow priority")
	command.Flags().VarP(&cliSubmitOpts.Output, "output", "o", "Output format. "+cliSubmitOpts.Output.Usage())
	command.Flags().BoolVarP(&cliSubmitOpts.Wait, "wait", "w", false, "wait for the workflow to complete, only works when a single workflow is resubmitted")
	command.Flags().BoolVar(&cliSubmitOpts.Watch, "watch", false, "watch the workflow until it completes, only works when a single workflow is resubmitted")
	command.Flags().BoolVar(&cliSubmitOpts.Log, "log", false, "log the workflow until it completes")
	command.Flags().BoolVar(&resubmitOpts.memoized, "memoized", false, "re-use successful steps & outputs from the previous run")
	command.Flags().StringVarP(&resubmitOpts.labelSelector, "selector", "l", "", "Selector (label query) to filter on, not including uninitialized ones, supports '=', '==', and '!='.(e.g. -l key1=value1,key2=value2)")
	command.Flags().StringVar(&resubmitOpts.fieldSelector, "field-selector", "", "Selector (field query) to filter on, supports '=', '==', and '!='.(e.g. --field-selector key1=value1,key2=value2). The server only supports a limited number of field queries per type.")
	command.Flags().BoolVar(&resubmitOpts.forceName, "name", false, "force the argument to be treated as a name")
	command.Flags().BoolVar(&resubmitOpts.forceUID, "uid", false, "force the argument to be treated as a UID")
	command.MarkFlagsMutuallyExclusive("name", "uid")
	return command
}

// resubmitArchivedWorkflows resubmits workflows by given resubmitOpts or workflow names/UIDs
func resubmitArchivedWorkflows(ctx context.Context, archiveServiceClient workflowarchivepkg.ArchivedWorkflowServiceClient, serviceClient workflowpkg.WorkflowServiceClient, resubmitOpts resubmitOps, cliSubmitOpts common.CliSubmitOpts, args []string) error {
	var (
		wfs wfv1.Workflows
		err error
	)

	if resubmitOpts.hasSelector() {
		wfs, err = listArchivedWorkflows(ctx, archiveServiceClient, resubmitOpts.fieldSelector, resubmitOpts.labelSelector, 0)
		if err != nil {
			return err
		}
	}

	// Add workflows from args - auto-detect UID vs NAME
	for _, identifier := range args {
		var uid string
		uid, err = resolveUID(ctx, archiveServiceClient, identifier, resubmitOpts.namespace, resubmitOpts.forceUID, resubmitOpts.forceName)
		if err != nil {
			return fmt.Errorf("resolve UID: %w", err)
		}
		wf := wfv1.Workflow{
			ObjectMeta: metav1.ObjectMeta{
				Namespace: resubmitOpts.namespace,
				UID:       types.UID(uid),
			},
		}
		wfs = append(wfs, wf)
	}

	var lastResubmitted *wfv1.Workflow
	resubmittedIdentifiers := make(map[string]bool)

	for _, wf := range wfs {
		// Use UID if available, otherwise use namespace/name for deduplication
		var identifier string
		if wf.UID != "" {
			identifier = "uid:" + string(wf.UID)
		} else {
			identifier = "name:" + wf.Namespace + "/" + wf.Name
		}

		if _, ok := resubmittedIdentifiers[identifier]; ok {
			// de-duplication in case there is an overlap between the selector and given workflow names
			continue
		}
		resubmittedIdentifiers[identifier] = true

		req := &workflowarchivepkg.ResubmitArchivedWorkflowRequest{
			Namespace:  wf.Namespace,
			Memoized:   resubmitOpts.memoized,
			Parameters: cliSubmitOpts.Parameters,
		}
		if wf.UID != "" {
			req.Uid = string(wf.UID)
		} else {
			req.Name = wf.Name
		}

		lastResubmitted, err = archiveServiceClient.ResubmitArchivedWorkflow(ctx, req)
		if err != nil {
			return err
		}
		printWorkflow(lastResubmitted, cliSubmitOpts.Output.String())
	}

	if len(resubmittedIdentifiers) == 1 {
		// watch or wait when there is only one workflow retried
		return common.WaitWatchOrLog(ctx, serviceClient, lastResubmitted.Namespace, []string{lastResubmitted.Name}, cliSubmitOpts)
	}
	return nil
}

```

### Core Architecture Module: `cmd/argo/commands/archive/retry.go`
```
package archive

import (
	"context"
	"errors"
	"fmt"

	"github.com/spf13/cobra"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/apimachinery/pkg/fields"
	"k8s.io/apimachinery/pkg/types"

	client "github.com/argoproj/argo-workflows/v4/cmd/argo/commands/client"
	"github.com/argoproj/argo-workflows/v4/cmd/argo/commands/common"
	workflowpkg "github.com/argoproj/argo-workflows/v4/pkg/apiclient/workflow"
	workflowarchivepkg "github.com/argoproj/argo-workflows/v4/pkg/apiclient/workflowarchive"
	wfv1 "github.com/argoproj/argo-workflows/v4/pkg/apis/workflow/v1alpha1"
)

type retryOps struct {
	nodeFieldSelector string // --node-field-selector
	restartSuccessful bool   // --restart-successful
	namespace         string // --namespace
	labelSelector     string // --selector
	fieldSelector     string // --field-selector
	forceName         bool   // --name
	forceUID          bool   // --uid
}

// hasSelector returns true if the CLI arguments selects multiple workflows
func (o *retryOps) hasSelector() bool {
	if o.labelSelector != "" || o.fieldSelector != "" {
		return true
	}
	return false
}

func NewRetryCommand() *cobra.Command {
	var (
		cliSubmitOpts = common.NewCliSubmitOpts()
		retryOpts     retryOps
	)
	command := &cobra.Command{
		Use:   "retry [WORKFLOW...]",
		Short: "retry zero or more workflows",
		Example: `# Retry a workflow by name:

  argo archive retry my-workflow

# Retry a workflow by UID (auto-detected):

  argo archive retry a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11

# Retry multiple workflows:

  argo archive retry my-workflow another-workflow

# Retry multiple workflows by label selector:

  argo archive retry -l workflows.argoproj.io/test=true

# Retry multiple workflows by field selector:

  argo archive retry --field-selector metadata.namespace=argo

# Retry and wait for completion:

  argo archive retry --wait my-workflow

# Retry and watch until completion:

  argo archive retry --watch my-workflow
		
# Retry and tail logs until completion:

  argo archive retry --log my-workflow

# Retry a workflow by name (forced):

  argo archive retry my-workflow --name

# Retry a workflow by UID (forced):

  argo archive retry a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11 --uid
`,
		Args: func(cmd *cobra.Command, args []string) error {
			if len(args) == 0 && !retryOpts.hasSelector() {
				return errors.New("requires either selector or workflow")
			}
			return nil
		},
		RunE: func(cmd *cobra.Command, args []string) error {
			ctx, apiClient, err := client.NewAPIClient(cmd.Context())
			if err != nil {
				return err
			}
			serviceClient := apiClient.NewWorkflowServiceClient(ctx)
			archiveServiceClient, err := apiClient.NewArchivedWorkflowServiceClient()
			if err != nil {
				return err
			}
			retryOpts.namespace = client.Namespace(ctx)

			return retryArchivedWorkflows(ctx, archiveServiceClient, serviceClient, retryOpts, cliSubmitOpts, args)
		},
	}

	command.Flags().StringArrayVarP(&cliSubmitOpts.Parameters, "parameter", "p", []string{}, "input parameter to override on the original workflow spec")
	command.Flags().VarP(&cliSubmitOpts.Output, "output", "o", "Output format. "+cliSubmitOpts.Output.Usage())
	command.Flags().BoolVarP(&cliSubmitOpts.Wait, "wait", "w", false, "wait for the workflow to complete, only works when a single workflow is retried")
	command.Flags().BoolVar(&cliSubmitOpts.Watch, "watch", false, "watch the workflow until it completes, only works when a single workflow is retried")
	command.Flags().BoolVar(&cliSubmitOpts.Log, "log", false, "log the workflow until it completes")
	command.Flags().BoolVar(&retryOpts.restartSuccessful, "restart-successful", false, "indicates to restart successful nodes matching the --node-field-selector")
	command.Flags().StringVar(&retryOpts.nodeFieldSelector, "node-field-selector", "", "selector of nodes to reset, eg: --node-field-selector inputs.parameters.myparam.value=abc")
	command.Flags().StringVarP(&retryOpts.labelSelector, "selector", "l", "", "Selector (label query) to filter on, not including uninitialized ones, supports '=', '==', and '!='.(e.g. -l key1=value1,key2=value2)")
	command.Flags().StringVar(&retryOpts.fieldSelector, "field-selector", "", "Selector (field query) to filter on, supports '=', '==', and '!='.(e.g. --field-selector key1=value1,key2=value2). The server only supports a limited number of field queries per type.")
	command.Flags().BoolVar(&retryOpts.forceName, "name", false, "force the argument to be treated as a name")
	command.Flags().BoolVar(&retryOpts.forceUID, "uid", false, "force the argument to be treated as a UID")
	command.MarkFlagsMutuallyExclusive("name", "uid")
	return command
}

// retryArchivedWorkflows retries workflows by given retryArgs or workflow names/UIDs
func retryArchivedWorkflows(ctx context.Context, archiveServiceClient workflowarchivepkg.ArchivedWorkflowServiceClient, serviceClient workflowpkg.WorkflowServiceClient, retryOpts retryOps, cliSubmitOpts common.CliSubmitOpts, args []string) error {
	selector, err := fields.ParseSelector(retryOpts.nodeFieldSelector)
	if err != nil {
		return fmt.Errorf("unable to parse node field selector '%s': %w", retryOpts.nodeFieldSelector, err)
	}
	var wfs wfv1.Workflows
	if retryOpts.hasSelector() {
		wfs, err = listArchivedWorkflows(ctx, archiveServiceClient, retryOpts.fieldSelector, retryOpts.labelSelector, 0)
		if err != nil {
			return err
		}
	}

	// Add workflows from args - auto-detect UID vs NAME
	for _, identifier := range args {
		var uid string
		uid, err = resolveUID(ctx, archiveServiceClient, identifier, retryOpts.namespace, retryOpts.forceUID, retryOpts.forceName)
		if err != nil {
			return fmt.Errorf("resolve UID: %w", err)
		}
		wf := wfv1.Workflow{
			ObjectMeta: metav1.ObjectMeta{
				Namespace: retryOpts.namespace,
				UID:       types.UID(uid),
			},
		}
		wfs = append(wfs, wf)
	}

	var lastRetried *wfv1.Workflow
	retriedIdentifiers := make(map[string]bool)
	for _, wf := range wfs {
		// Use UID if available, otherwise use namespace/name for deduplication
		var identifier string
		if wf.UID != "" {
			identifier = "uid:" + string(wf.UID)
		} else {
			identifier = "name:" + wf.Namespace + "/" + wf.Name
		}

		if _, ok := retriedIdentifiers[identifier]; ok {
			// de-duplication in case there is an overlap between the selector and given workflow names
			continue
		}
		retriedIdentifiers[identifier] = true

		req := &workflowarchivepkg.RetryArchivedWorkflowRequest{
			Namespace:         wf.Namespace,
			RestartSuccessful: retryOpts.restartSuccessful,
			NodeFieldSelector: selector.String(),
			Parameters:        cliSubmitOpts.Parameters,
		}
		if wf.UID != "" {
			req.Uid = string(wf.UID)
		} else {
			req.Name = wf.Name
		}

		lastRetried, err = archiveServiceClient.RetryArchivedWorkflow(ctx, req)
		if err != nil {
			return err
		}
		printWorkflow(lastRetried, cliSubmitOpts.Output.String())
	}
	if len(retriedIdentifiers) == 1 {
		// watch or wait when there is only one workflow retried
		return common.WaitWatchOrLog(ctx, serviceClient, lastRetried.Namespace, []string{lastRetried.Name}, cliSubmitOpts)
	}
	return nil
}

```

### Core Architecture Module: `cmd/argo/commands/archive/root.go`
```
package archive

import (
	"github.com/spf13/cobra"
)

func NewArchiveCommand() *cobra.Command {
	command := &cobra.Command{
		Use:   "archive",
		Short: "manage the workflow archive",
		RunE: func(cmd *cobra.Command, args []string) error {
			return cmd.Help()
		},
	}

	command.AddCommand(NewListCommand())
	command.AddCommand(NewGetCommand())
	command.AddCommand(NewDeleteCommand())
	command.AddCommand(NewListLabelKeyCommand())
	command.AddCommand(NewListLabelValueCommand())
	command.AddCommand(NewResubmitCommand())
	command.AddCommand(NewRetryCommand())
	return command
}

```


### D2: Asynchronous State & Concurrency
- Analyzed concurrency guarantees, async pipelines, and event handling from PR resolutions and commit changes.

### D3: Error Boundaries, Recovery & Rollbacks
- Exception handling patterns and defect resolutions extracted from closed production bug issues:
- **Issue #17106** (2026-09-30): **chore(deps): update module github.com/google/go-containerregistry to v0.22.1 (main)**
  *Symptoms*: This PR contains the following updates:  | Package | Change | [Age](https://docs.renovatebot.com/merge-confidence/) | [Adoption](https://docs.renovatebot.com/merge-confidence/) | [Passing](https://docs.renovatebot.com/merge-confidence/) | [Confidence](https://docs.renovatebot.com/merge-confidence/) | |---|---|---|---|---|---| | [github.com/google/go-containerregistry](https://redirect.github.com/google/go-containerregistry) | `v0.21.9` → `v0.22.1` | ![age](https://developer.mend.io/api/mc/badges/age/go/github.com%2fgoogle%2fgo-containerregistry/v0.22.1?slim=true) | ![adoption](https://developer.mend.io/api/mc/badges/adoption/go/github.com%2fgoogle%2fgo-containerregistry/v0.22.1?slim=true) | ![passing](https://developer.mend.io/api/mc/badges/compatibility/go/github.com%2fgoogle%2fgo-containerregistry/v0.21.9/v0.22.1?slim=true) | ![confidence](https://developer.mend.io/api/mc/badges/confidence/go/github.com%2fgoogle%2fgo-containerregistry/v0.21.9/v0.22.1?slim=true) |  ---  > [!WARNING] > Some dependencies could not be looked up. Check the [Dependency Dashboard](../issues/15285) for more information.  ---  ### Release Notes  <details> <summary>google/go-containerregistry (github.com/google/go-containerregistry)</summary>  ### [`v0.22.1`](https://redirect.github.com/google/go-containerregistry/releases/tag/v0.22.1)  [Compare Source](https://redirect.github.com/google/go-containerregistry/compare/v0.22.0...v0.22.1)  #### What's Changed  - Reject non-canonical IP literals in all SS
  **Post-Mortem & Fix Analysis**:
  > ### ℹ️ Artifact update notice  ##### File name: go.mod  In order to perform the update(s) described in the table above, Renovate ran the `go get` command, which resulted in the following additional change(s):   - 1 additional dependency was updated   Details:   | **Package**             | **Change**                                       | | :---------------------- | :----------------------------------------------- | | `github.com/docker/cli` | `v29.6.2+incompatible` -> `v29.7.2+incompatible` |
  > ## [Codecov](https://app.codecov.io/gh/argoproj/argo-workflows/pull/17106?dropdown=coverage&src=pr&el=h1&utm_medium=referral&utm_source=github&utm_content=comment&utm_campaign=pr+comments&utm_term=argoproj) Report :white_check_mark: All modified and coverable lines are covered by tests. :white_check_mark: Project coverage is 32.79%. Comparing base ([`dadd691`](https://app.codecov.io/gh/argoproj/argo-workflows/commit/dadd69141c570fa678f7d51ee6decfe3fa77f109?dropdown=coverage&el=desc&utm_medium=referral&utm_source=github&utm_content=comment&utm_campaign=pr+comments&utm_term=argoproj)) to head ([`e285336`](https://app.codecov.io/gh/argoproj/argo-workflows/commit/e2853362ef97e47a1be6d002ea4f90dac15395fd?dropdown=coverage&el=desc&utm_medium=referral&utm_source=github&utm_content=comment&utm_campaign=pr+comments&utm_term=argoproj)).  <details><summary>Additional details and impacted files</summary>    ```diff @@             Coverage Diff             @@ ##             main   #17106       +/- 

- **Issue #17105** (2026-09-29): **chore(deps): update google.golang.org/genproto/googleapis/api digest to 8a89bd6 (main)**
  *Symptoms*: This PR contains the following updates:  | Package | Type | Update | Change | |---|---|---|---| | [google.golang.org/genproto/googleapis/api](https://redirect.github.com/googleapis/go-genproto) | require | digest | `b142276` → `8a89bd6` |  ---  > [!WARNING] > Some dependencies could not be looked up. Check the [Dependency Dashboard](../issues/15285) for more information.  ---  ### Configuration  📅 **Schedule**: (UTC)  - Branch creation   - At any time (no schedule defined) - Automerge   - At any time (no schedule defined)  🚦 **Automerge**: Disabled by config. Please merge this manually once you are satisfied.  ♻ **Rebasing**: Whenever PR becomes conflicted, or you tick the rebase/retry checkbox.  🔕 **Ignore**: Close this PR and you won't be reminded about this update again.  ---   - [ ] <!-- rebase-check -->If you want to rebase/retry this PR, check this box  ---  This PR was generated by [Mend Renovate](https://mend.io/renovate/). View the [repository job log](https://developer.mend.io/github/argoproj/argo-workflows). <!--renovate-debug:eyJjcmVhdGVkSW5WZXIiOiI0NC4xMTIuMCIsInVwZGF0ZWRJblZlciI6IjQ0LjExMi4wIiwidGFyZ2V0QnJhbmNoIjoibWFpbiIsImxhYmVscyI6WyJ0eXBlL2RlcGVuZGVuY2llcyJdfQ==--> 
  **Post-Mortem & Fix Analysis**:
  > ### ℹ️ Artifact update notice  ##### File name: go.mod  In order to perform the update(s) described in the table above, Renovate ran the `go get` command, which resulted in the following additional change(s):   - 1 additional dependency was updated   Details:   | **Package**                                 | **Change**                                                                   | | :------------------------------------------ | :--------------------------------------------------------------------------- | | `google.golang.org/genproto/googleapis/rpc` | `v0.0.0-20260918162117-cecb64721679` -> `v0.0.0-20260921155816-b14227669459` |
  > ## [Codecov](https://app.codecov.io/gh/argoproj/argo-workflows/pull/17105?dropdown=coverage&src=pr&el=h1&utm_medium=referral&utm_source=github&utm_content=comment&utm_campaign=pr+comments&utm_term=argoproj) Report :white_check_mark: All modified and coverable lines are covered by tests. :white_check_mark: Project coverage is 44.91%. Comparing base ([`9b6bdff`](https://app.codecov.io/gh/argoproj/argo-workflows/commit/9b6bdff3cf5d08a1cdc728063f7f9e10f418cd19?dropdown=coverage&el=desc&utm_medium=referral&utm_source=github&utm_content=comment&utm_campaign=pr+comments&utm_term=argoproj)) to head ([`3f96edd`](https://app.codecov.io/gh/argoproj/argo-workflows/commit/3f96eddde28c3a18da5ecabf215208918fcbe669?dropdown=coverage&el=desc&utm_medium=referral&utm_source=github&utm_content=comment&utm_campaign=pr+comments&utm_term=argoproj)).  <details><summary>Additional details and impacted files</summary>    ```diff @@            Coverage Diff             @@ ##             main   #17105      +/-   
  > ### Edited/Blocked Notification  Renovate will not automatically rebase this PR, because it does not recognize the last commit author and assumes somebody else may have edited the PR.  You can manually request rebase by checking the rebase/retry box above.   ⚠️ **Warning**: custom changes will be lost.

- **Issue #17104** (2026-09-29): **fix(examples): mark retry-script as flaky so it is skipped in e2e**
  *Symptoms*: - [ ] Ran `make pre-commit -B` - [x] Signed-off commits with [Conventional Commit](https://www.conventionalcommits.org/en/v1.0.0/) messages - [x] PR title is a conventional commit message (it becomes the release notes entry) - [x] Unit or e2e tests cover the change - [ ] For features: an associated issue and a feature description file (`make feature-new`) - [x] Opened as draft; will mark "Ready for review" once builds are green  ### Motivation  `TestExampleWorkflows/../../examples/retry-script.yaml` fails intermittently in CI. The example fails deliberately with a 66% probability per attempt and sets `retryStrategy: limit: "10"`, so all 11 attempts fail about 1.2% of the time — roughly 1 run in 86. When that happens the workflow ends Failed and the e2e examples suite fails with it.  I hit this on #17085:  ``` DONE 199 tests, 96 skipped, 2 failures in 350.686s FAIL test/e2e.TestExampleWorkflows/../../examples/retry-script.yaml (55.14s) ```  with all 11 attempts logged as `main: Error (exit code 1)`.  ### Modifications  Add `workflows.argoproj.io/no-test: "flaky"` to the example, which the examples harness already honours by skipping.  This matches the sibling examples: `retry-container.yaml` is functionally identical (same 66% failure, same `limit: "10"`) and already carries the label, as does `retry-with-steps.yaml`. Eleven examples use it today. `retry-script.yaml` looks like it was simply missed.  If you would rather keep the example under test, the alternative is raising `
  **Post-Mortem & Fix Analysis**:
  > <!-- This is an auto-generated comment: summarize by coderabbit.ai --> <!-- review_stack_entry_start -->  <a href="https://app.coderabbit.ai/change-stack/argoproj/argo-workflows/pull/17104?cs_source=review_comment"><img src="https://storage.googleapis.com/coderabbit_public_assets/review-stack-in-coderabbit-ui-dark.svg?v=2" alt="Review in Change Stack →" width="220" height="32"></a>  Navigate logical layers of code changes, visualize relationships, and explore their blast radius.  <!-- review_stack_entry_end --> <!-- recent_review_start -->  No actionable comments were generated in the recent review. 🎉  <details> <summary>ℹ️ Recent review info</summary>  <details> <summary>⚙️ Run configuration</summary>  **Configuration used**: Repository: argoproj/argo-workflows/.coderabbit.yaml  **Review profile**: CHILL  **Plan**: Advanced  **Run ID**: `237164c9-15ca-4a03-9616-9798bcbad30d`  </details>  <details> <summary>📥 Commits</summary>  Reviewing files that changed from the base of the PR and

- **Issue #17102** (2026-09-29): **fix: tie database queries to the caller's context (cherry-pick #17076 for 4.1)**
  *Symptoms*: Cherry-picked fix: tie database queries to the caller's context (#17076)  Signed-off-by: Alan Clucas <alan@clucas.org>

- **Issue #17101** (2026-09-29): **chore(deps): update module github.com/azure/azure-sdk-for-go/sdk/azcore to v1.23.2 (main)**
  *Symptoms*: This PR contains the following updates:  | Package | Change | [Age](https://docs.renovatebot.com/merge-confidence/) | [Adoption](https://docs.renovatebot.com/merge-confidence/) | [Passing](https://docs.renovatebot.com/merge-confidence/) | [Confidence](https://docs.renovatebot.com/merge-confidence/) | |---|---|---|---|---|---| | [github.com/Azure/azure-sdk-for-go/sdk/azcore](https://redirect.github.com/Azure/azure-sdk-for-go) | `v1.23.1` → `v1.23.2` | ![age](https://developer.mend.io/api/mc/badges/age/go/github.com%2fAzure%2fazure-sdk-for-go%2fsdk%2fazcore/v1.23.2?slim=true) | ![adoption](https://developer.mend.io/api/mc/badges/adoption/go/github.com%2fAzure%2fazure-sdk-for-go%2fsdk%2fazcore/v1.23.2?slim=true) | ![passing](https://developer.mend.io/api/mc/badges/compatibility/go/github.com%2fAzure%2fazure-sdk-for-go%2fsdk%2fazcore/v1.23.1/v1.23.2?slim=true) | ![confidence](https://developer.mend.io/api/mc/badges/confidence/go/github.com%2fAzure%2fazure-sdk-for-go%2fsdk%2fazcore/v1.23.1/v1.23.2?slim=true) |  ---  > [!WARNING] > Some dependencies could not be looked up. Check the [Dependency Dashboard](../issues/15285) for more information.  ---  ### Release Notes  <details> <summary>Azure/azure-sdk-for-go (github.com/Azure/azure-sdk-for-go/sdk/azcore)</summary>  ### [`v1.23.2`](https://redirect.github.com/Azure/azure-sdk-for-go/releases/tag/sdk/azcore/v1.23.2)  #### 1.23.2 (2026-09-28)  ##### Bugs Fixed  - Fixed unmarshalling `datetime.RFC7231` to use a fixed `GMT` zone.  </det
  **Post-Mortem & Fix Analysis**:
  > ## [Codecov](https://app.codecov.io/gh/argoproj/argo-workflows/pull/17101?dropdown=coverage&src=pr&el=h1&utm_medium=referral&utm_source=github&utm_content=comment&utm_campaign=pr+comments&utm_term=argoproj) Report :white_check_mark: All modified and coverable lines are covered by tests. :white_check_mark: Project coverage is 44.81%. Comparing base ([`258ec1b`](https://app.codecov.io/gh/argoproj/argo-workflows/commit/258ec1be469d55ca58cec85716b3900af2f486a5?dropdown=coverage&el=desc&utm_medium=referral&utm_source=github&utm_content=comment&utm_campaign=pr+comments&utm_term=argoproj)) to head ([`c23046a`](https://app.codecov.io/gh/argoproj/argo-workflows/commit/c23046a33ee6f6ea4e3f5d2bb4f5650e6354fa01?dropdown=coverage&el=desc&utm_medium=referral&utm_source=github&utm_content=comment&utm_campaign=pr+comments&utm_term=argoproj)).  <details><summary>Additional details and impacted files</summary>    ```diff @@            Coverage Diff             @@ ##             main   #17101      +/-   
  > ### Edited/Blocked Notification  Renovate will not automatically rebase this PR, because it does not recognize the last commit author and assumes somebody else may have edited the PR.  You can manually request rebase by checking the rebase/retry box above.   ⚠️ **Warning**: custom changes will be lost.

- **Issue #17100** (2026-09-28): **fix: termination of suspended workflow (cherry-pick #17052 for 4.1)**
  *Symptoms*: Cherry-picked fix: termination of suspended workflow (#17052)  Signed-off-by: Gaurang Mishra <gaurang.mishra@amadeus.net>

- **Issue #17099** (2026-09-29): **fix: termination of suspended workflow (cherry-pick #17052 for 4.0)**
  *Symptoms*: Cherry-picked fix: termination of suspended workflow (#17052)  Signed-off-by: Gaurang Mishra <gaurang.mishra@amadeus.net>

- **Issue #17098** (2026-09-29): **chore(deps): update module github.com/dustin/go-humanize to v1.1.0 (main)**
  *Symptoms*: This PR contains the following updates:  | Package | Change | [Age](https://docs.renovatebot.com/merge-confidence/) | [Adoption](https://docs.renovatebot.com/merge-confidence/) | [Passing](https://docs.renovatebot.com/merge-confidence/) | [Confidence](https://docs.renovatebot.com/merge-confidence/) | |---|---|---|---|---|---| | [github.com/dustin/go-humanize](https://redirect.github.com/dustin/go-humanize) | `v1.0.1` → `v1.1.0` | ![age](https://developer.mend.io/api/mc/badges/age/go/github.com%2fdustin%2fgo-humanize/v1.1.0?slim=true) | ![adoption](https://developer.mend.io/api/mc/badges/adoption/go/github.com%2fdustin%2fgo-humanize/v1.1.0?slim=true) | ![passing](https://developer.mend.io/api/mc/badges/compatibility/go/github.com%2fdustin%2fgo-humanize/v1.0.1/v1.1.0?slim=true) | ![confidence](https://developer.mend.io/api/mc/badges/confidence/go/github.com%2fdustin%2fgo-humanize/v1.0.1/v1.1.0?slim=true) |  ---  > [!WARNING] > Some dependencies could not be looked up. Check the [Dependency Dashboard](../issues/15285) for more information.  ---  ### Release Notes  <details> <summary>dustin/go-humanize (github.com/dustin/go-humanize)</summary>  ### [`v1.1.0`](https://redirect.github.com/dustin/go-humanize/compare/v1.0.1...v1.1.0)  [Compare Source](https://redirect.github.com/dustin/go-humanize/compare/v1.0.1...v1.1.0)  </details>  ---  ### Configuration  📅 **Schedule**: (UTC)  - Branch creation   - At any time (no schedule defined) - Automerge   - At any time (no schedule define
  **Post-Mortem & Fix Analysis**:
  > ## [Codecov](https://app.codecov.io/gh/argoproj/argo-workflows/pull/17098?dropdown=coverage&src=pr&el=h1&utm_medium=referral&utm_source=github&utm_content=comment&utm_campaign=pr+comments&utm_term=argoproj) Report :white_check_mark: All modified and coverable lines are covered by tests. :white_check_mark: Project coverage is 32.67%. Comparing base ([`9c3b1f7`](https://app.codecov.io/gh/argoproj/argo-workflows/commit/9c3b1f7ac34420231673b8eac7785ef4b4567336?dropdown=coverage&el=desc&utm_medium=referral&utm_source=github&utm_content=comment&utm_campaign=pr+comments&utm_term=argoproj)) to head ([`ae68942`](https://app.codecov.io/gh/argoproj/argo-workflows/commit/ae68942458dbf50a6f7a4cf5b532db51a4169176?dropdown=coverage&el=desc&utm_medium=referral&utm_source=github&utm_content=comment&utm_campaign=pr+comments&utm_term=argoproj)). :warning: Report is 2 commits behind head on main.  <details><summary>Additional details and impacted files</summary>    ```diff @@             Coverage Diff    
  > ### Edited/Blocked Notification  Renovate will not automatically rebase this PR, because it does not recognize the last commit author and assumes somebody else may have edited the PR.  You can manually request rebase by checking the rebase/retry box above.   ⚠️ **Warning**: custom changes will be lost.

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

### Incident Patch 1: `9b2e8fd2` (2026-09-29)
**Commit Message**: fix(examples): mark retry-script as flaky so it is skipped in e2e (#17104)

Signed-off-by: Jeffery Lofoneh Asamani <jefferyasamani7@gmail.com>
Co-authored-by: Claude Opus 5 <noreply@anthropic.com>

**File**: `examples/retry-script.yaml` (modified, +2/-0)
```diff
@@ -3,6 +3,8 @@ apiVersion: argoproj.io/v1alpha1
 kind: Workflow
 metadata:
   generateName: retry-script-
+  labels:
+    workflows.argoproj.io/no-test: "flaky"
 spec:
   entrypoint: retry-script
   templates:
```

---

### Incident Patch 2: `aa1912fc` (2026-09-29)
**Commit Message**: fix: tie database queries to the caller's context (#17076)

Signed-off-by: Alan Clucas <alan@clucas.org>
Co-authored-by: Claude Opus 5.5 (1M context) <noreply@anthropic.com>

**File**: `persist/sqldb/workflow_archive.go` (modified, +2/-2)
```diff
@@ -119,7 +119,7 @@ func (r *workflowArchive) ArchiveWorkflow(ctx context.Context, wf *wfv1.Workflow
 		workflow = bytes.ReplaceAll(workflow, []byte("\\u0000"), []byte(postgresNullReplacement))
 	}
 	return r.sessionProxy.TxWith(ctx, func(s *sqldb.SessionProxy) error {
-		sess := s.Session()
+		sess := s.Session(ctx)
 		_, err := sess.SQL().
 			DeleteFrom(archiveTableName).
 			Where(r.clusterManagedNamespaceAndInstanceID()).
@@ -679,7 +679,7 @@ func (r *workflowArchive) GetWorkflowForEstimator(ctx context.Context, namespace
 
 	var result *wfv1.Workflow
 	err := r.sessionProxy.With(queryCtx, func(s db.Session) error {
-		selector := s.WithContext(queryCtx).SQL().
+		selector := s.SQL().
 			Select("name", "namespace", "uid", "startedat", "finishedat").
 			From(archiveTableName).
 			Where(r.clusterManagedNamespaceAndInstanceID()).
```

**File**: `persist/sqldb/workflow_archive_mysql_test.go` (modified, +1/-1)
```diff
@@ -68,7 +68,7 @@ func setupMySQLArchiveTest(ctx context.Context, t *testing.T, v usqldb.MySQLVari
 	})
 	require.NoError(t, err)
 
-	err = Migrate(ctx, proxy.Session(), "test", "argo_workflows", proxy.DBType())
+	err = Migrate(ctx, proxy.Session(ctx), "test", "argo_workflows", proxy.DBType())
 	require.NoError(t, err)
 
 	t.Cleanup(func() { proxy.Close() })
```

**File**: `util/sqldb/migrate.go` (modified, +1/-0)
```diff
@@ -36,6 +36,7 @@ func ByType(dbType DBType, changes TypedChanges) Change {
 func Migrate(ctx context.Context, session db.Session, dbType DBType, versionTableName string, changes []Change) error {
 	ctx, logger := logging.RequireLoggerFromContext(ctx).WithField("dbType", dbType).InContext(ctx)
 	logger.Info(ctx, "Migrating database schema")
+	session = session.WithContext(ctx)
 
 	{
 		// poor mans SQL migration
```

**File**: `util/sqldb/session.go` (modified, +18/-8)
```diff
@@ -203,6 +203,12 @@ func (sp *SessionProxy) isNetworkError(err error) bool {
 		return false
 	}
 
+	// context.DeadlineExceeded satisfies net.Error with Timeout() == true, so
+	// check for it before the pattern and net.Error checks below.
+	if errors.Is(err, context.Canceled) || errors.Is(err, context.DeadlineExceeded) {
+		return false
+	}
+
 	errStr := strings.ToLower(err.Error())
 
 	if errors.Is(err, io.ErrUnexpectedEOF) ||
@@ -260,7 +266,8 @@ func (sp *SessionProxy) isNetworkError(err error) bool {
 	return false
 }
 
-// With executes with a db Session
+// With executes fn with a db Session bound to ctx, so cancelling ctx cancels
+// the running statement.
 func (sp *SessionProxy) With(ctx context.Context, fn func(db.Session) error) error {
 	logger := logging.RequireLoggerFromContext(ctx)
 	sp.mu.RLock()
@@ -277,13 +284,13 @@ func (sp *SessionProxy) With(ctx context.Context, fn func(db.Session) error) err
 		return fmt.Errorf("no active session")
 	}
 
-	err := fn(sess)
+	err := fn(sess.WithContext(ctx))
 	if err == nil {
 		return nil
 	}
 
-	// If it's not a network error or inside a tx do not retry
-	if !sp.isNetworkError(err) || sp.insideTransaction {
+	// If the caller has given up, it's not a network error, or inside a tx do not retry
+	if ctx.Err() != nil || !sp.isNetworkError(err) || sp.insideTransaction {
 		return err
 	}
 
@@ -299,7 +306,7 @@ func (sp *SessionProxy) With(ctx context.Context, fn func(db.Session) error) err
 		return fmt.Errorf("no active session after reconnection")
 	}
 
-	if retryErr := fn(sess); retryErr != nil {
+	if retryErr := fn(sess.WithContext(ctx)); retryErr != nil {
 		return fmt.Errorf("operation failed after reconnection: %w", retryErr)
 	}
 
@@ -365,13 +372,16 @@ func (sp *SessionProxy) reconnectLocked(ctx context.Context) error {
 	return fmt.Errorf("reconnection failed after %d retries, last error: %w", sp.maxRetries, err)
 }
 
-// Session returns the underlying session. Use With() for operations that need reconnection.
+// Session returns the underlying session bound to ctx. Use With() for operations that need reconnection.
 // This method is provided for cases where you need direct access to the session,
 // but it won't provide automatic reconnection.
-func (sp *SessionProxy) Session() db.Session {
+func (sp *SessionProxy) Session(ctx context.Context) db.Session {
 	sp.mu.RLock()
 	defer sp.mu.RUnlock()
-	return sp.sess
+	if sp.sess == nil {
+		return nil
+	}
+	return sp.sess.WithContext(ctx)
 }
 
 // Close closes the session proxy and underlying session
```

**File**: `util/sqldb/session_test.go` (modified, +53/-2)
```diff
@@ -2,6 +2,8 @@ package sqldb
 
 import (
 	"context"
+	"errors"
+	"fmt"
 	"net/netip"
 	"runtime"
 	"testing"
@@ -101,11 +103,11 @@ func TestSessionReconnect(t *testing.T) {
 	})
 	require.NoError(t, err)
 
-	err = sessionProxy.Session().Ping()
+	err = sessionProxy.Session(ctx).Ping()
 	require.NoError(t, err)
 	cancel()
 
-	err = sessionProxy.Session().Ping()
+	err = sessionProxy.Session(ctx).Ping()
 	require.Error(t, err)
 
 	doneChan := make(chan struct{})
@@ -130,3 +132,52 @@ func TestSessionReconnect(t *testing.T) {
 	<-doneChan
 	cancel()
 }
+
+func TestIsNetworkErrorIgnoresContextErrors(t *testing.T) {
+	sp := &SessionProxy{}
+	assert.False(t, sp.isNetworkError(context.Canceled))
+	assert.False(t, sp.isNetworkError(context.DeadlineExceeded))
+	assert.False(t, sp.isNetworkError(fmt.Errorf("query: %w", context.DeadlineExceeded)))
+	assert.True(t, sp.isNetworkError(errors.New("read tcp: i/o timeout")))
+}
+
+func TestSessionWithCancelsStatement(t *testing.T) {
+	if runtime.GOOS == "windows" {
+		t.Skip("This test uses the Linux container image and therefore cannot be performed on the Windows platform")
+	}
+
+	ctx := logging.TestContext(t.Context())
+	cfg, cancel, err := setupPostgresContainer(ctx, t)
+	require.NoError(t, err)
+	defer cancel()
+
+	sessionProxy, err := NewSessionProxy(ctx, SessionProxyConfig{
+		DBConfig: cfg,
+		Username: userName,
+		Password: password,
+	})
+	require.NoError(t, err)
+	origSess := sessionProxy.sess
+
+	queryCtx, queryCancel := context.WithTimeout(ctx, 500*time.Millisecond)
+	defer queryCancel()
+	start := time.Now()
+	err = sessionProxy.With(queryCtx, func(s db.Session) error {
+		_, execErr := s.SQL().Exec("SELECT pg_sleep(30)")
+		return execErr
+	})
+	require.Error(t, err)
+	assert.Less(t, time.Since(start), 10*time.Second, "statement should be cancelled with its context")
+	assert.Same(t, origSess, sessionProxy.sess, "a cancelled statement must not trigger a reconnect")
+
+	// The server-side statement is cancelled too, not just abandoned by the client.
+	assert.Eventually(t, func() bool {
+		var count int
+		row, err := sessionProxy.Session(ctx).SQL().QueryRow(
+			"SELECT count(*) FROM pg_stat_activity WHERE state = 'active' AND query = 'SELECT pg_sleep(30)'")
+		if err != nil || row.Scan(&count) != nil {
+			return false
+		}
+		return count == 0
+	}, 10*time.Second, 200*time.Millisecond)
+}
```

---

### Incident Patch 3: `258ec1be` (2026-09-28)
**Commit Message**: fix: termination of suspended workflow (#17052)

Signed-off-by: Gaurang Mishra <gaurang.mishra@amadeus.net>
Co-authored-by: Gaurang Mishra <gaurang.mishra@amadeus.net>

**File**: `ui/src/shared/workflow-operations-map.test.ts` (added, +59/-0)
```diff
@@ -0,0 +1,59 @@
+import {Workflow} from './models';
+import {WorkflowOperationsMap} from './workflow-operations-map';
+
+const suspendedWorkflow = (shutdown?: 'Terminate' | 'Stop'): Workflow =>
+    ({
+        metadata: {name: 'hello-world', namespace: 'argo'},
+        spec: {suspend: true, shutdown},
+        status: {phase: 'Running'}
+    }) as unknown as Workflow;
+
+const terminatedWorkflow = (shutdown?: 'Terminate' | 'Stop'): Workflow =>
+    ({
+        metadata: {name: 'hello-world', namespace: 'argo'},
+        spec: {suspend: true, shutdown},
+        status: {phase: 'Failed'}
+    }) as unknown as Workflow;
+
+const failedWorkflow = (suspend?: boolean): Workflow =>
+    ({
+        metadata: {name: 'hello-world', namespace: 'argo'},
+        spec: {suspend},
+        status: {phase: 'Failed'}
+    }) as unknown as Workflow;
+
+describe('WorkflowOperationsMap RESUME', () => {
+    test('enabled for a suspended workflow with no shutdown strategy', () => {
+        expect(WorkflowOperationsMap.RESUME.disabled(suspendedWorkflow())).toBe(false);
+    });
+
+    test('enabled when the workflow is being terminated', () => {
+        expect(WorkflowOperationsMap.RESUME.disabled(suspendedWorkflow('Terminate'))).toBe(false);
+    });
+
+    test('enabled once the workflow is being stopped', () => {
+        expect(WorkflowOperationsMap.RESUME.disabled(suspendedWorkflow('Stop'))).toBe(false);
+    });
+
+    test('disabled when the workflow is not suspended', () => {
+        const wf = suspendedWorkflow();
+        wf.spec.suspend = false;
+        expect(WorkflowOperationsMap.RESUME.disabled(wf)).toBe(true);
+    });
+
+    test('disabled once the workflow is terminated', () => {
+        expect(WorkflowOperationsMap.RESUME.disabled(terminatedWorkflow('Terminate'))).toBe(true);
+    });
+
+    test('disabled once the workflow is stopped', () => {
+        expect(WorkflowOperationsMap.RESUME.disabled(terminatedWorkflow('Stop'))).toBe(true);
+    });
+
+    test('disabled for a failed workflow', () => {
+        expect(WorkflowOperationsMap.RESUME.disabled(failedWorkflow())).toBe(true);
+    });
+
+    test('disabled for a completed suspended workflow', () => {
+        expect(WorkflowOperationsMap.RESUME.disabled(failedWorkflow(true))).toBe(true);
+    });
+});
```

**File**: `ui/src/shared/workflow-operations-map.ts` (modified, +1/-1)
```diff
@@ -46,7 +46,7 @@ export const WorkflowOperationsMap: WorkflowOperations = {
     RESUME: {
         title: 'RESUME',
         iconClassName: 'fa fa-play',
-        disabled: (wf: Workflow) => !isWorkflowSuspended(wf),
+        disabled: (wf: Workflow) => !isWorkflowRunning(wf) || !isWorkflowSuspended(wf),
         action: (wf: Workflow) => services.workflows.resume(wf.metadata.name, wf.metadata.namespace, null)
     },
     STOP: {
```

**File**: `workflow/controller/operator.go` (modified, +1/-1)
```diff
@@ -374,7 +374,7 @@ func (woc *wfOperationCtx) operate(ctx context.Context) {
 		}
 	}
 
-	if woc.ShouldSuspend() {
+	if woc.ShouldSuspend() && !woc.GetShutdownStrategy().Enabled() {
 		woc.log.Info(ctx, "workflow suspended")
 		return
 	}
```

**File**: `workflow/controller/operator_test.go` (modified, +182/-0)
```diff
@@ -3001,6 +3001,188 @@ func TestSuspendResume(t *testing.T) {
 	assert.Len(t, pods.Items, 2)
 }
 
+func suspendedShutdownWorkflow() *wfv1.Workflow {
+	wf := wfv1.MustUnmarshalWorkflow(noPodsWhenShutdown)
+	wf.Spec.Shutdown = ""
+	wf.Spec.OnExit = "exit-handler"
+	wf.Spec.Templates = append(wf.Spec.Templates, wfv1.Template{
+		Name: "exit-handler",
+		Container: &apiv1.Container{
+			Image:   "docker/whalesay:latest",
+			Command: []string{"cowsay"},
+			Args:    []string{"goodbye world"},
+		},
+	})
+	return wf
+}
+
+func TestTerminateOnSuspendedWorkflow(t *testing.T) {
+	t.Run("StartedSuspended", func(t *testing.T) {
+		wf := suspendedShutdownWorkflow()
+		wf.Spec.Suspend = new(true)
+		cancel, controller := newController(logging.TestContext(t.Context()), wf)
+		defer cancel()
+
+		ctx := logging.TestContext(t.Context())
+		woc := newWorkflowOperationCtx(ctx, wf, controller)
+		woc.operate(ctx)
+		assert.Equal(t, wfv1.WorkflowRunning, woc.wf.Status.Phase)
+		assert.Empty(t, woc.wf.Status.Nodes)
+		pods, err := listPods(ctx, woc)
+		require.NoError(t, err)
+		assert.Empty(t, pods.Items)
+
+		wf = woc.wf.DeepCopy()
+		wf.Spec.Shutdown = wfv1.ShutdownStrategyTerminate
+		woc = newWorkflowOperationCtx(ctx, wf, controller)
+		woc.operate(ctx)
+
+		node := woc.wf.Status.Nodes.FindByDisplayName("hello-world")
+		require.NotNil(t, node)
+		assert.Equal(t, wfv1.NodeFailed, node.Phase)
+		assert.Contains(t, node.Message, "workflow shutdown with strategy")
+		assert.Nil(t, woc.wf.Status.Nodes.FindByDisplayName("hello-world.onExit"), "terminate must not run the exit handler")
+		pods, err = listPods(ctx, woc)
+		require.NoError(t, err)
+		assert.Empty(t, pods.Items)
+
+		assert.Equal(t, wfv1.WorkflowFailed, woc.wf.Status.Phase)
+		assert.Equal(t, "Stopped with strategy 'Terminate'", woc.wf.Status.Message)
+		persistedWf, err := controller.wfclientset.ArgoprojV1alpha1().Workflows(wf.Namespace).Get(ctx, wf.Name, metav1.GetOptions{})
+		require.NoError(t, err)
+		assert.True(t, *persistedWf.Spec.Suspend)
+	})
+
+	t.Run("SuspendedWhileRunning", func(t *testing.T) {
+		wf := suspendedShutdownWorkflow()
+		cancel, controller := newController(logging.TestContext(t.Context()), wf)
+		defer cancel()
+
+		ctx := logging.TestContext(t.Context())
+		woc := newWorkflowOperationCtx(ctx, wf, controller)
+		woc.operate(ctx)
+		node := woc.wf.Status.Nodes.FindByDisplayName("hello-world")
+		require.NotNil(t, node)
+		assert.Equal(t, wfv1.NodePending, node.Phase)
+		makePodsPhase(ctx, woc, apiv1.PodPending)
+
+		wf = woc.wf.DeepCopy()
+		wf.Spec.Suspend = new(true)
+		woc = newWorkflowOperationCtx(ctx, wf, controller)
+		woc.operate(ctx)
+		assert.Equal(t, wfv1.WorkflowRunning, woc.wf.Status.Phase)
+
+		wf = woc.wf.DeepCopy()
+		wf.Spec.Shutdown = wfv1.ShutdownStrategyTerminate
+		woc = newWorkflowOperationCtx(ctx, wf, controller)
+		woc.operate(ctx)
+
+		node = woc.wf.Status.Nodes.FindByDisplayName("hello-world")
+		require.NotNil(t, node)
+		assert.Equal(t, wfv1.NodeFailed, node.Phase)
+		assert.Contains(t, node.Message, "workflow shutdown with strategy")
+		assert.Nil(t, woc.wf.Status.Nodes.FindByDisplayName("hello-world.onExit"), "terminate must not run the exit handler")
+
+		assert.Equal(t, wfv1.WorkflowFailed, woc.wf.Status.Phase)
+		assert.Equal(t, "Stopped with strategy 'Terminate'", woc.wf.Status.Message)
+		persistedWf, err := controller.wfclientset.ArgoprojV1alpha1().Workflows(wf.Namespace).Get(ctx, wf.Name, metav1.GetOptions{})
+		require.NoError(t, err)
+		assert.True(t, *persistedWf.Spec.Suspend)
+	})
+}
+
+func TestStopOnSuspendedWorkflow(t *testing.T) {
+	t.Run("StartedSuspended", func(t *testing.T) {
+		wf := suspendedShutdownWorkflow()
+		wf.Spec.Suspend = new(true)
+		cancel, controller := newController(logging.TestContext(t.Context()), wf)
+		defer cancel()
+
+		ctx := logging.TestContext(t.Context())
+		woc := newWorkflowOperationCtx(ctx, wf, controller)
+		woc.operate(ctx)
+		assert.Equal(t, wfv1.WorkflowRunning, woc.wf.Status.Phas
```

**File**: `workflow/controller/operator_workflow_template_ref_test.go` (modified, +59/-0)
```diff
@@ -491,6 +491,65 @@ func TestWorkflowTemplateRefWithShutdownAndSuspend(t *testing.T) {
 			assert.Contains(t, node.Message, "Stop")
 		}
 	})
+	t.Run("WorkflowTemplateRefWithSuspendWithShutdownTerminate", func(t *testing.T) {
+		wf := wfv1.MustUnmarshalWorkflow(wfWithTmplRef)
+		wf1 := wf.DeepCopy()
+		wf1.Spec.Suspend = new(true)
+		ctx := logging.TestContext(t.Context())
+		cancel, controller := newController(ctx, wf1, wfv1.MustUnmarshalWorkflowTemplate(wfTmpl))
+		defer cancel()
+
+		woc := newWorkflowOperationCtx(ctx, wf1, controller)
+		woc.operate(ctx)
+		assert.Equal(t, wfv1.WorkflowRunning, woc.wf.Status.Phase)
+		assert.Empty(t, woc.wf.Status.Nodes)
+		require.NotNil(t, woc.wf.Status.StoredWorkflowSpec.Suspend)
+		assert.True(t, *woc.wf.Status.StoredWorkflowSpec.Suspend)
+
+		wf2 := woc.wf.DeepCopy()
+		wf2.Spec.Shutdown = wfv1.ShutdownStrategyTerminate
+		woc = newWorkflowOperationCtx(ctx, wf2, controller)
+		woc.operate(ctx)
+
+		node := woc.wf.Status.Nodes.FindByDisplayName(wf.Name)
+		require.NotNil(t, node)
+		assert.Equal(t, wfv1.NodeFailed, node.Phase)
+		assert.Contains(t, node.Message, "workflow shutdown with strategy")
+		assert.Contains(t, node.Message, "Terminate")
+
+		assert.Equal(t, wfv1.WorkflowFailed, woc.wf.Status.Phase)
+		assert.Equal(t, "Stopped with strategy 'Terminate'", woc.wf.Status.Message)
+	})
+
+	t.Run("WorkflowTemplateRefWithSuspendWithShutdownStop", func(t *testing.T) {
+		wf := wfv1.MustUnmarshalWorkflow(wfWithTmplRef)
+		wf1 := wf.DeepCopy()
+		wf1.Spec.Suspend = new(true)
+		ctx := logging.TestContext(t.Context())
+		cancel, controller := newController(ctx, wf1, wfv1.MustUnmarshalWorkflowTemplate(wfTmpl))
+		defer cancel()
+
+		woc := newWorkflowOperationCtx(ctx, wf1, controller)
+		woc.operate(ctx)
+		assert.Equal(t, wfv1.WorkflowRunning, woc.wf.Status.Phase)
+		assert.Empty(t, woc.wf.Status.Nodes)
+		require.NotNil(t, woc.wf.Status.StoredWorkflowSpec.Suspend)
+		assert.True(t, *woc.wf.Status.StoredWorkflowSpec.Suspend)
+
+		wf2 := woc.wf.DeepCopy()
+		wf2.Spec.Shutdown = wfv1.ShutdownStrategyStop
+		woc = newWorkflowOperationCtx(ctx, wf2, controller)
+		woc.operate(ctx)
+
+		node := woc.wf.Status.Nodes.FindByDisplayName(wf.Name)
+		require.NotNil(t, node)
+		assert.Equal(t, wfv1.NodeFailed, node.Phase)
+		assert.Contains(t, node.Message, "workflow shutdown with strategy")
+		assert.Contains(t, node.Message, "Stop")
+
+		assert.Equal(t, wfv1.WorkflowFailed, woc.wf.Status.Phase)
+		assert.Equal(t, "Stopped with strategy 'Stop'", woc.wf.Status.Message)
+	})
 }
 
 var suspendwf = `apiVersion: argoproj.io/v1alpha1
```

---

### Incident Patch 4: `9c3b1f7a` (2026-09-28)
**Commit Message**: test(controller): move DAG fixtures into testdata (#17085)

Signed-off-by: Jeffery Lofoneh Asamani <jefferyasamani7@gmail.com>
Co-authored-by: Claude Opus 5 <noreply@anthropic.com>

**File**: `workflow/controller/testdata/dag/artifact-resolution-when-skipped-dag.yaml` (added, +52/-0)
```diff
@@ -0,0 +1,52 @@
+apiVersion: argoproj.io/v1alpha1
+kind: Workflow
+metadata:
+  generateName: conditional-artifact-passing-
+spec:
+  entrypoint: artifact-example
+  templates:
+  - name: artifact-example
+    dag:
+      tasks:
+      - name: generate-artifact
+        template: whalesay
+        when: "false"
+      - name: consume-artifact
+        dependencies: [generate-artifact]
+        template: print-message
+        when: "false"
+        arguments:
+          artifacts:
+          - name: message
+            from: "{{tasks.generate-artifact.outputs.artifacts.hello-art}}"
+      - name: sequence-param
+        template: print-message
+        dependencies: [generate-artifact]
+        when: "false"
+        arguments:
+          artifacts:
+          - name: message
+            from: "{{tasks.generate-artifact.outputs.artifacts.hello-art}}"
+        withSequence:
+          count: "5"
+
+  - name: whalesay
+    container:
+      image: docker/whalesay:latest
+      command: [sh, -c]
+      args: ["sleep 1; cowsay hello world | tee /tmp/hello_world.txt"]
+    outputs:
+      artifacts:
+      - name: hello-art
+        path: /tmp/hello_world.txt
+
+  - name: print-message
+    inputs:
+      artifacts:
+      - name: message
+        path: /tmp/message
+    container:
+      image: alpine:3.23
+      command: [sh, -c]
+      args: ["cat /tmp/message"]
+
```

**File**: `workflow/controller/testdata/dag/dag-assess-phase-continue-on-expanded-task-variables.yaml` (added, +255/-0)
```diff
@@ -0,0 +1,255 @@
+apiVersion: argoproj.io/v1alpha1
+kind: Workflow
+metadata:
+  name: parameter-aggregation-one-will-fail2-jt776
+spec:
+
+  entrypoint: parameter-aggregation-one-will-fail2
+  templates:
+  -
+    dag:
+      tasks:
+      -
+        continueOn:
+          failed: true
+        name: generate
+        template: gen-number-list
+      - arguments:
+          parameters:
+          - name: num
+            value: '{{item}}'
+        continueOn:
+          failed: true
+        dependencies:
+        - generate
+        name: one-will-fail
+        template: one-will-fail
+        withParam: '{{tasks.generate.outputs.result}}'
+      -
+        continueOn:
+          failed: true
+        dependencies:
+        - one-will-fail
+        name: whalesay
+        template: whalesay
+    inputs: {}
+    metadata: {}
+    name: parameter-aggregation-one-will-fail2
+    outputs: {}
+  -
+    container:
+      args:
+      - |
+        if [ $(({{inputs.parameters.num}})) == 1 ]; then
+          exit 1;
+        else
+          echo {{inputs.parameters.num}}
+        fi
+      command:
+      - sh
+      - -xc
+      image: alpine:3.23
+      name: ""
+      resources: {}
+    inputs:
+      parameters:
+      - name: num
+    metadata: {}
+    name: one-will-fail
+    outputs: {}
+  -
+    container:
+      command:
+      - cowsay
+      image: docker/whalesay:latest
+      name: ""
+      resources: {}
+    inputs: {}
+    metadata: {}
+    name: whalesay
+    outputs: {}
+  -
+    inputs: {}
+    metadata: {}
+    name: gen-number-list
+    outputs: {}
+    script:
+      command:
+      - python
+      image: python:alpine3.23
+      name: ""
+      resources: {}
+      source: |
+        import json
+        import sys
+        json.dump([i for i in range(0, 2)], sys.stdout)
+status:
+  nodes:
+    parameter-aggregation-one-will-fail2-jt776:
+      children:
+      - parameter-aggregation-one-will-fail2-jt776-1457662774
+      displayName: parameter-aggregation-one-will-fail2-jt776
+      id: parameter-aggregation-one-will-fail2-jt776
+      name: parameter-aggregation-one-will-fail2-jt776
+      outboundNodes:
+      - parameter-aggregation-one-will-fail2-jt776-3936077093
+      phase: Running
+      startedAt: "2020-04-20T16:39:00Z"
+      templateName: parameter-aggregation-one-will-fail2
+      templateScope: local/parameter-aggregation-one-will-fail2-jt776
+      type: DAG
+    parameter-aggregation-one-will-fail2-jt776-6921149:
+      boundaryID: parameter-aggregation-one-will-fail2-jt776
+      children:
+      - parameter-aggregation-one-will-fail2-jt776-1842114754
+      - parameter-aggregation-one-will-fail2-jt776-4113411742
+      displayName: one-will-fail
+      finishedAt: "2020-04-20T16:39:09Z"
+      id: parameter-aggregation-one-will-fail2-jt776-6921149
+      name: parameter-aggregation-one-will-fail2-jt776.one-will-fail
+      phase: Failed
+      startedAt: "2020-04-20T16:39:03Z"
+      templateName: one-will-fail
+      templateScope: local/parameter-aggregation-one-will-fail2-jt776
+      type: TaskGroup
+    parameter-aggregation-one-will-fail2-jt776-1457662774:
+      boundaryID: parameter-aggregation-one-will-fail2-jt776
+      children:
+      - parameter-aggregation-one-will-fail2-jt776-6921149
+      displayName: generate
+      finishedAt: "2020-04-20T16:39:02Z"
+      id: parameter-aggregation-one-will-fail2-jt776-1457662774
+      name: parameter-aggregation-one-will-fail2-jt776.generate
+      outputs:
+        artifacts:
+        - archiveLogs: true
+          name: main-logs
+          s3:
+            accessKeySecret:
+              key: accesskey
+              name: my-minio-cred
+            bucket: my-bucket
+            endpoint: minio:9000
+            insecure: true
+            key: parameter-aggregation-one-will-fail2-jt776/parameter-aggregation-one-will-fail2-jt776-1457662774/main.log
+            secretKeySecret:
+              key: secretkey
+              name: my-mi
```

**File**: `workflow/controller/testdata/dag/dag-assess-phase-continue-on-expanded-task.yaml` (added, +202/-0)
```diff
@@ -0,0 +1,202 @@
+apiVersion: argoproj.io/v1alpha1
+kind: Workflow
+metadata:
+  name: parameter-aggregation-one-will-fail-69x7k
+spec:
+
+  entrypoint: parameter-aggregation-one-will-fail
+  templates:
+  -
+    dag:
+      tasks:
+      - arguments:
+          parameters:
+          - name: num
+            value: '{{item}}'
+        continueOn:
+          failed: true
+        name: one-will-fail
+        template: one-will-fail
+        withItems:
+        - 1
+        - 2
+      -
+        continueOn:
+          failed: true
+        dependencies:
+        - one-will-fail
+        name: whalesay
+        template: whalesay
+    inputs: {}
+    metadata: {}
+    name: parameter-aggregation-one-will-fail
+    outputs: {}
+  -
+    container:
+      args:
+      - |
+        if [ $(({{inputs.parameters.num}})) == 1 ]; then
+          exit 1;
+        else
+          echo {{inputs.parameters.num}}
+        fi
+      command:
+      - sh
+      - -xc
+      image: alpine:3.23
+      name: ""
+      resources: {}
+    inputs:
+      parameters:
+      - name: num
+    metadata: {}
+    name: one-will-fail
+    outputs: {}
+  -
+    container:
+      command:
+      - cowsay
+      image: docker/whalesay:latest
+      name: ""
+      resources: {}
+    inputs: {}
+    metadata: {}
+    name: whalesay
+    outputs: {}
+status:
+  nodes:
+    parameter-aggregation-one-will-fail-69x7k:
+      children:
+      - parameter-aggregation-one-will-fail-69x7k-4292161196
+      displayName: parameter-aggregation-one-will-fail-69x7k
+      id: parameter-aggregation-one-will-fail-69x7k
+      name: parameter-aggregation-one-will-fail-69x7k
+      outboundNodes:
+      - parameter-aggregation-one-will-fail-69x7k-3555414042
+      phase: Running
+      startedAt: "2020-04-20T16:47:22Z"
+      templateName: parameter-aggregation-one-will-fail
+      templateScope: local/parameter-aggregation-one-will-fail-69x7k
+      type: DAG
+    parameter-aggregation-one-will-fail-69x7k-1324058456:
+      boundaryID: parameter-aggregation-one-will-fail-69x7k
+      children:
+      - parameter-aggregation-one-will-fail-69x7k-3555414042
+      displayName: one-will-fail(0:1)
+      finishedAt: "2020-04-20T16:47:26Z"
+      id: parameter-aggregation-one-will-fail-69x7k-1324058456
+      inputs:
+        parameters:
+        - name: num
+          value: "1"
+      message: failed with exit code 1
+      name: parameter-aggregation-one-will-fail-69x7k.one-will-fail(0:1)
+      outputs:
+        artifacts:
+        - archiveLogs: true
+          name: main-logs
+          s3:
+            accessKeySecret:
+              key: accesskey
+              name: my-minio-cred
+            bucket: my-bucket
+            endpoint: minio:9000
+            insecure: true
+            key: parameter-aggregation-one-will-fail-69x7k/parameter-aggregation-one-will-fail-69x7k-1324058456/main.log
+            secretKeySecret:
+              key: secretkey
+              name: my-minio-cred
+        exitCode: "1"
+      phase: Failed
+      resourcesDuration:
+        cpu: 2
+        memory: 0
+      startedAt: "2020-04-20T16:47:22Z"
+      templateName: one-will-fail
+      templateScope: local/parameter-aggregation-one-will-fail-69x7k
+      type: Pod
+    parameter-aggregation-one-will-fail-69x7k-3086527730:
+      boundaryID: parameter-aggregation-one-will-fail-69x7k
+      children:
+      - parameter-aggregation-one-will-fail-69x7k-3555414042
+      displayName: one-will-fail(1:2)
+      finishedAt: "2020-04-20T16:47:28Z"
+      id: parameter-aggregation-one-will-fail-69x7k-3086527730
+      inputs:
+        parameters:
+        - name: num
+          value: "2"
+      name: parameter-aggregation-one-will-fail-69x7k.one-will-fail(1:2)
+      outputs:
+        artifacts:
+        - archiveLogs: true
+          name: main-logs
+          s3:
+            accessKeySecret:
+              key: accesskey
+              name: my-minio-cred
+            bucket: my-bucket
+       
```

**File**: `workflow/controller/testdata/dag/dag-http-children-assigned.yaml` (added, +60/-0)
```diff
@@ -0,0 +1,60 @@
+apiVersion: argoproj.io/v1alpha1
+kind: Workflow
+metadata:
+  name: http-template-nv52d
+spec:
+  entrypoint: main
+  templates:
+  - dag:
+      tasks:
+      - arguments:
+          parameters:
+          - name: url
+            value: https://raw.githubusercontent.com/argoproj/argo-workflows/4e450e250168e6b4d51a126b784e90b11a0162bc/pkg/apis/workflow/v1alpha1/generated.swagger.json
+        name: good1
+        template: http
+      - arguments:
+          parameters:
+          - name: url
+            value: https://raw.githubusercontent.com/argoproj/argo-workflows/4e450e250168e6b4d51a126b784e90b11a0162bc/pkg/apis/workflow/v1alpha1/generated.swagger.json
+        dependencies:
+        - good1
+        name: good2
+        template: http
+    name: main
+  - http:
+      url: '{{inputs.parameters.url}}'
+    inputs:
+      parameters:
+      - name: url
+    name: http
+status:
+  nodes:
+    http-template-nv52d:
+      children:
+      - http-template-nv52d-444770636
+      displayName: http-template-nv52d
+      id: http-template-nv52d
+      name: http-template-nv52d
+      outboundNodes:
+      - http-template-nv52d-478325874
+      phase: Running
+      startedAt: "2021-10-27T13:46:08Z"
+      templateName: main
+      templateScope: local/http-template-nv52d
+      type: DAG
+    http-template-nv52d-444770636:
+      boundaryID: http-template-nv52d
+      children:
+      - http-template-nv52d-495103493
+      displayName: good1
+      finishedAt: null
+      id: http-template-nv52d-444770636
+      name: http-template-nv52d.good1
+      phase: Succeeded
+      startedAt: "2021-10-27T13:46:08Z"
+      templateName: http
+      templateScope: local/http-template-nv52d
+      type: HTTP
+  phase: Running
+  startedAt: "2021-10-27T13:46:08Z"
```

**File**: `workflow/controller/testdata/dag/dag-optional-input-artifacts.yaml` (added, +83/-0)
```diff
@@ -0,0 +1,83 @@
+apiVersion: argoproj.io/v1alpha1
+kind: Workflow
+metadata:
+  name: dag-optional-inputartifacts
+spec:
+  entrypoint: test
+  templates:
+  - name: condition
+    outputs:
+      artifacts:
+      - {name: A-out, from: '{{tasks.A.outputs.artifacts.A-out}}'}
+    dag:
+      tasks:
+      - {name: A, template: A}
+  - name: A
+    container:
+      args: ['mkdir -p /tmp/outputs/A && echo "exist" > /tmp/outputs/A/data']
+      command: [sh, -c]
+      image: alpine:3.23
+    outputs:
+      artifacts:
+      - {name: A-out, path: /tmp/outputs/A/data}
+  - name: B
+    container:
+      args: ['[ -f /tmp/outputs/condition/data ] && cat /tmp/outputs/condition/data || echo not exist']
+      command: [sh, -c]
+      image: alpine:3.23
+    inputs:
+      artifacts:
+      - {name: B-in, optional: true,  path: /tmp/outputs/condition/data}
+  - name: test
+    dag:
+      tasks:
+      - name: condition
+        template: condition
+        when: 'false'
+      - name: B
+        template: B
+        dependencies: [condition]
+        arguments:
+          artifacts:
+          - {name: B-in, optional: true, from: '{{tasks.condition.outputs.artifacts.A-out}}'}
+  arguments:
+    parameters: []
+status:
+  conditions:
+  - status: "True"
+    type: Completed
+  finishedAt: "2020-07-21T01:56:24Z"
+  nodes:
+    dag-optional-inputartifacts:
+      children:
+      - dag-optional-inputartifacts-3418089753
+      displayName: dag-optional-inputartifacts
+      finishedAt: "2020-07-21T01:56:24Z"
+      id: dag-optional-inputartifacts
+      name: dag-optional-inputartifacts
+      outboundNodes:
+      - dag-optional-inputartifacts-1920355018
+      phase: Running
+      startedAt: "2020-07-21T01:56:18Z"
+      templateName: test
+      templateScope: local/dag-optional-inputartifacts
+      type: DAG
+    dag-optional-inputartifacts-3418089753:
+      boundaryID: dag-optional-inputartifacts
+      children:
+      - dag-optional-inputartifacts-1920355018
+      displayName: condition
+      finishedAt: "2020-07-21T01:56:18Z"
+      id: dag-optional-inputartifacts-3418089753
+      message: when 'false' evaluated false
+      name: dag-optional-inputartifacts.condition
+      phase: Skipped
+      startedAt: "2020-07-21T01:56:18Z"
+      templateName: condition
+      templateScope: local/dag-optional-inputartifacts
+      type: Skipped
+  phase: Running
+  resourcesDuration:
+    cpu: 1
+    memory: 0
+  startedAt: "2020-07-21T01:56:18Z"
```

---

### Incident Patch 5: `31d00e57` (2026-09-28)
**Commit Message**: test(controller): move controller fixtures into testdata (#17081)

Signed-off-by: Hahhhy <3558509716@qq.com>

**File**: `workflow/controller/testdata/controller/from-expressing.yaml` (added, +27/-0)
```diff
@@ -0,0 +1,27 @@
+
+apiVersion: argoproj.io/v1alpha1
+kind: Workflow
+metadata:
+  name: from-expression
+spec:
+  entrypoint: main
+  arguments:
+    artifacts:
+    - name: foo
+      raw:
+        data: |
+          Hello
+  templates:
+    - name: main
+      inputs:
+        artifacts:
+        - name: foo
+      steps:
+      - - name: hello
+          inline:
+            container:
+              image: docker/whalesay:latest
+      outputs:
+        artifacts:
+        - name: result
+          fromExpression: "1 == 1 ? inputs.artifacts.foo : inputs.artifacts.foo"
```

**File**: `workflow/controller/testdata/controller/hello-daemon.yaml` (added, +21/-0)
```diff
@@ -0,0 +1,21 @@
+
+apiVersion: argoproj.io/v1alpha1
+kind: Workflow
+metadata:
+  name: hello-world
+spec:
+  entrypoint: whalesay
+  templates:
+  - name: whalesay
+    daemon: true
+    metadata:
+      annotations:
+        annotationKey1: "annotationValue1"
+        annotationKey2: "annotationValue2"
+      labels:
+        labelKey1: "labelValue1"
+        labelKey2: "labelValue2"
+    container:
+      image: docker/whalesay:latest
+      command: [cowsay]
+      args: ["hello world"]
```

**File**: `workflow/controller/testdata/controller/hello-world.yaml` (added, +19/-0)
```diff
@@ -0,0 +1,19 @@
+apiVersion: argoproj.io/v1alpha1
+kind: Workflow
+metadata:
+  name: hello-world
+spec:
+  entrypoint: whalesay
+  templates:
+  - name: whalesay
+    metadata:
+      annotations:
+        annotationKey1: "annotationValue1"
+        annotationKey2: "annotationValue2"
+      labels:
+        labelKey1: "labelValue1"
+        labelKey2: "labelValue2"
+    container:
+      image: docker/whalesay:latest
+      command: [cowsay]
+      args: ["hello world"]
\ No newline at end of file
```

**File**: `workflow/controller/testdata/controller/test-default-ttl.yaml` (added, +23/-0)
```diff
@@ -0,0 +1,23 @@
+
+apiVersion: argoproj.io/v1alpha1
+kind: Workflow
+metadata:
+  name: hello-world
+spec:
+  entrypoint: whalesay
+  serviceAccountName: whalesay
+  ttlStrategy:
+    secondsAfterCompletion: 5
+  templates:
+  - name: whalesay
+    metadata:
+      annotations:
+        annotationKey1: "annotationValue1"
+        annotationKey2: "annotationValue2"
+      labels:
+        labelKey1: "labelValue1"
+        labelKey2: "labelValue2"
+    container:
+      image: docker/whalesay:latest
+      command: [cowsay]
+      args: ["hello world"]
```

**File**: `workflow/controller/testdata/controller/test-default-volume-claim-template.yaml` (added, +33/-0)
```diff
@@ -0,0 +1,33 @@
+
+apiVersion: argoproj.io/v1alpha1
+kind: Workflow
+metadata:
+  name: hello-world
+  labels:
+    foo: bar
+spec:
+  volumeClaimTemplates:
+  - metadata:
+      name: workdir
+    spec:
+      accessModes:
+      - ReadWriteOnce
+      resources:
+        requests:
+          storage: 1Mi
+      storageClassName: local-path
+  entrypoint: whalesay
+  serviceAccountName: whalesay
+  templates:
+  - name: whalesay
+    metadata:
+      annotations:
+        annotationKey1: "annotationValue1"
+        annotationKey2: "annotationValue2"
+      labels:
+        labelKey1: "labelValue1"
+        labelKey2: "labelValue2"
+    container:
+      image: docker/whalesay:latest
+      command: [cowsay]
+      args: ["hello world"]
```

---

### Incident Patch 6: `dc610f09` (2026-09-25)
**Commit Message**: test(controller): move template scope fixtures into testdata (#17066)

Signed-off-by: Jeffery Lofoneh Asamani <jefferyasamani7@gmail.com>
Co-authored-by: Claude Opus 5 <noreply@anthropic.com>
Co-authored-by: Alan Clucas <alan@clucas.org>

**File**: `workflow/controller/operator_template_scope_test.go` (modified, +12/-257)
```diff
@@ -11,71 +11,10 @@ import (
 	"github.com/argoproj/argo-workflows/v4/util/logging"
 )
 
-var testTemplateScopeWorkflowYaml = `
-apiVersion: argoproj.io/v1alpha1
-kind: Workflow
-metadata:
-  name: test-template-scope
-  namespace: default
-spec:
-  entrypoint: entry
-  templates:
-  - name: entry
-    steps:
-      - - name: step
-          templateRef:
-            name: test-template-scope-1
-            template: steps
-`
-
-var testTemplateScopeWorkflowTemplateYaml1 = `
-apiVersion: argoproj.io/v1alpha1
-kind: WorkflowTemplate
-metadata:
-  name: test-template-scope-1
-  namespace: default
-spec:
-  templates:
-  - name: steps
-    steps:
-    - - name: hello
-        template: hello
-      - name: other-wftmpl
-        templateRef:
-          name: test-template-scope-2
-          template: steps
-  - name: hello
-    script:
-      image: python:alpine3.23
-      command: [python]
-      source: |
-        print("hello world")
-`
-
-var testTemplateScopeWorkflowTemplateYaml2 = `
-apiVersion: argoproj.io/v1alpha1
-kind: WorkflowTemplate
-metadata:
-  name: test-template-scope-2
-  namespace: default
-spec:
-  templates:
-  - name: steps
-    steps:
-    - - name: hello
-        template: hello
-  - name: hello
-    script:
-      image: python:alpine3.23
-      command: [python]
-      source: |
-        print("hello world")
-`
-
 func TestTemplateScope(t *testing.T) {
-	wf := wfv1.MustUnmarshalWorkflow(testTemplateScopeWorkflowYaml)
-	wftmpl1 := wfv1.MustUnmarshalWorkflowTemplate(testTemplateScopeWorkflowTemplateYaml1)
-	wftmpl2 := wfv1.MustUnmarshalWorkflowTemplate(testTemplateScopeWorkflowTemplateYaml2)
+	wf := wfv1.MustUnmarshalWorkflow("@testdata/operator_template_scope/workflow.yaml")
+	wftmpl1 := wfv1.MustUnmarshalWorkflowTemplate("@testdata/operator_template_scope/workflow-template-1.yaml")
+	wftmpl2 := wfv1.MustUnmarshalWorkflowTemplate("@testdata/operator_template_scope/workflow-template-2.yaml")
 
 	cancel, controller := newController(logging.TestContext(t.Context()), wf, wftmpl1, wftmpl2)
 	defer cancel()
@@ -117,53 +56,9 @@ func TestTemplateScope(t *testing.T) {
 	assert.Equal(t, "namespaced/test-template-scope-2", node.TemplateScope)
 }
 
-var testTemplateScopeWithParamWorkflowYaml = `
-apiVersion: argoproj.io/v1alpha1
-kind: Workflow
-metadata:
-  name: test-template-scope-with-param
-  namespace: default
-spec:
-  entrypoint: main
-  templates:
-    - name: main
-      steps:
-        - - name: step
-            templateRef:
-              name: test-template-scope-with-param-1
-              template: main
-`
-
-var testTemplateScopeWithParamWorkflowTemplateYaml1 = `
-apiVersion: argoproj.io/v1alpha1
-kind: WorkflowTemplate
-metadata:
-  name: test-template-scope-with-param-1
-  namespace: default
-spec:
-  templates:
-    - name: main
-      steps:
-        - - name: print-string
-            template: print-string
-            arguments:
-              parameters:
-               - name: letter
-                 value: '{{item}}'
-            withParam: '["x", "y", "z"]'
-    - name: print-string
-      inputs:
-        parameters:
-         - name: letter
-      container:
-        image: alpine:3.23
-        command: [sh, -c]
-        args: ["echo {{inputs.parameters.letter}}"]
-`
-
 func TestTemplateScopeWithParam(t *testing.T) {
-	wf := wfv1.MustUnmarshalWorkflow(testTemplateScopeWithParamWorkflowYaml)
-	wftmpl := wfv1.MustUnmarshalWorkflowTemplate(testTemplateScopeWithParamWorkflowTemplateYaml1)
+	wf := wfv1.MustUnmarshalWorkflow("@testdata/operator_template_scope/with-param-workflow.yaml")
+	wftmpl := wfv1.MustUnmarshalWorkflowTemplate("@testdata/operator_template_scope/with-param-workflow-template-1.yaml")
 
 	cancel, controller := newController(logging.TestContext(t.Context()), wf, wftmpl)
 	defer cancel()
@@ -202,57 +97,9 @@ func TestTemplateScopeWithParam(t *testing.T) {
 	assert.Equal(t, "namespaced/test-template-scope-with-param-1", node.TemplateScope)
 }
 
-var testTemplateScopeNestedSteps
```

**File**: `workflow/controller/testdata/operator_template_scope/cluster-scope-workflow-template-1.yaml` (added, +20/-0)
```diff
@@ -0,0 +1,20 @@
+apiVersion: argoproj.io/v1alpha1
+kind: ClusterWorkflowTemplate
+metadata:
+  name: test-template-scope-1
+spec:
+  templates:
+  - name: steps
+    steps:
+    - - name: hello
+        template: hello
+      - name: other-wftmpl
+        templateRef:
+          name: test-template-scope-2
+          template: steps
+  - name: hello
+    script:
+      image: python:alpine3.23
+      command: [python]
+      source: |
+        print("hello world")
```

**File**: `workflow/controller/testdata/operator_template_scope/cluster-scope-workflow.yaml` (added, +15/-0)
```diff
@@ -0,0 +1,15 @@
+apiVersion: argoproj.io/v1alpha1
+kind: Workflow
+metadata:
+  name: test-template-scope
+  namespace: default
+spec:
+  entrypoint: entry
+  templates:
+  - name: entry
+    steps:
+      - - name: step
+          templateRef:
+            name: test-template-scope-1
+            template: steps
+            clusterScope: true
```

**File**: `workflow/controller/testdata/operator_template_scope/dag-workflow-template-1.yaml` (added, +31/-0)
```diff
@@ -0,0 +1,31 @@
+apiVersion: argoproj.io/v1alpha1
+kind: WorkflowTemplate
+metadata:
+  name: test-template-scope-dag-1
+  namespace: default
+spec:
+  templates:
+    - name: main
+      dag:
+        tasks:
+        - name: A
+          template: print-string
+          arguments:
+            parameters:
+            - name: letter
+              value: 'A'
+        - name: B
+          template: print-string
+          arguments:
+            parameters:
+            - name: letter
+              value: '{{item}}'
+          withParam: '["x", "y", "z"]'
+    - name: print-string
+      inputs:
+        parameters:
+         - name: letter
+      container:
+        image: alpine:3.23
+        command: [sh, -c]
+        args: ["echo {{inputs.parameters.letter}}"]
```

**File**: `workflow/controller/testdata/operator_template_scope/dag-workflow.yaml` (added, +14/-0)
```diff
@@ -0,0 +1,14 @@
+apiVersion: argoproj.io/v1alpha1
+kind: Workflow
+metadata:
+  name: test-template-scope-dag
+  namespace: default
+spec:
+  entrypoint: main
+  templates:
+    - name: main
+      steps:
+        - - name: step
+            templateRef:
+              name: test-template-scope-dag-1
+              template: main
```

---

### Incident Patch 7: `18149c92` (2026-09-25)
**Commit Message**: fix: run the quick-start artifact repository on pgsty/silo. Fixes #17030 (#17073)

Signed-off-by: Alan Clucas <alan@clucas.org>
Co-authored-by: Claude Opus 5.5 (1M context) <noreply@anthropic.com>

**File**: `manifests/quick-start-minimal.yaml` (modified, +4/-4)
```diff
@@ -192930,17 +192930,17 @@ spec:
       automountServiceAccountToken: false
       containers:
       - command:
-        - minio
+        - silo
         - server
         - --console-address
         - :9001
         - /data
         env:
-        - name: MINIO_ACCESS_KEY
+        - name: MINIO_ROOT_USER
           value: admin
-        - name: MINIO_SECRET_KEY
+        - name: MINIO_ROOT_PASSWORD
           value: password
-        image: quay.io/minio/minio:RELEASE.2022-11-17T23-20-09Z@sha256:b2a98df34c3e8d605a5e96f0bc1657dd440a5bd53d95465a7b342e736da9c6cf
+        image: docker.io/pgsty/silo:RELEASE.2026-09-16T00-00-00Z@sha256:635197cb9f36d01bee221d34d1c7d7960f6a95c48b0b6c01d99cd13bdae51a46
         lifecycle:
           postStart:
             exec:
```

**File**: `manifests/quick-start-mysql.yaml` (modified, +4/-4)
```diff
@@ -192996,17 +192996,17 @@ spec:
       automountServiceAccountToken: false
       containers:
       - command:
-        - minio
+        - silo
         - server
         - --console-address
         - :9001
         - /data
         env:
-        - name: MINIO_ACCESS_KEY
+        - name: MINIO_ROOT_USER
           value: admin
-        - name: MINIO_SECRET_KEY
+        - name: MINIO_ROOT_PASSWORD
           value: password
-        image: quay.io/minio/minio:RELEASE.2022-11-17T23-20-09Z@sha256:b2a98df34c3e8d605a5e96f0bc1657dd440a5bd53d95465a7b342e736da9c6cf
+        image: docker.io/pgsty/silo:RELEASE.2026-09-16T00-00-00Z@sha256:635197cb9f36d01bee221d34d1c7d7960f6a95c48b0b6c01d99cd13bdae51a46
         lifecycle:
           postStart:
             exec:
```

**File**: `manifests/quick-start-postgres.yaml` (modified, +4/-4)
```diff
@@ -192995,17 +192995,17 @@ spec:
       automountServiceAccountToken: false
       containers:
       - command:
-        - minio
+        - silo
         - server
         - --console-address
         - :9001
         - /data
         env:
-        - name: MINIO_ACCESS_KEY
+        - name: MINIO_ROOT_USER
           value: admin
-        - name: MINIO_SECRET_KEY
+        - name: MINIO_ROOT_PASSWORD
           value: password
-        image: quay.io/minio/minio:RELEASE.2022-11-17T23-20-09Z@sha256:b2a98df34c3e8d605a5e96f0bc1657dd440a5bd53d95465a7b342e736da9c6cf
+        image: docker.io/pgsty/silo:RELEASE.2026-09-16T00-00-00Z@sha256:635197cb9f36d01bee221d34d1c7d7960f6a95c48b0b6c01d99cd13bdae51a46
         lifecycle:
           postStart:
             exec:
```

**File**: `manifests/quick-start-telemetry.yaml` (modified, +4/-4)
```diff
@@ -193120,17 +193120,17 @@ spec:
       automountServiceAccountToken: false
       containers:
       - command:
-        - minio
+        - silo
         - server
         - --console-address
         - :9001
         - /data
         env:
-        - name: MINIO_ACCESS_KEY
+        - name: MINIO_ROOT_USER
           value: admin
-        - name: MINIO_SECRET_KEY
+        - name: MINIO_ROOT_PASSWORD
           value: password
-        image: quay.io/minio/minio:RELEASE.2022-11-17T23-20-09Z@sha256:b2a98df34c3e8d605a5e96f0bc1657dd440a5bd53d95465a7b342e736da9c6cf
+        image: docker.io/pgsty/silo:RELEASE.2026-09-16T00-00-00Z@sha256:635197cb9f36d01bee221d34d1c7d7960f6a95c48b0b6c01d99cd13bdae51a46
         lifecycle:
           postStart:
             exec:
```

**File**: `manifests/quick-start/base/minio/minio-deploy.yaml` (modified, +6/-4)
```diff
@@ -16,18 +16,20 @@ spec:
       automountServiceAccountToken: false
       containers:
         - name: main
-          image: quay.io/minio/minio:RELEASE.2022-11-17T23-20-09Z@sha256:b2a98df34c3e8d605a5e96f0bc1657dd440a5bd53d95465a7b342e736da9c6cf
+          # Silo is a maintained fork of the MinIO server (MinIO stopped publishing
+          # community images); it keeps the S3 API, MINIO_* settings and data format.
+          image: docker.io/pgsty/silo:RELEASE.2026-09-16T00-00-00Z@sha256:635197cb9f36d01bee221d34d1c7d7960f6a95c48b0b6c01d99cd13bdae51a46
           env:
-            - name: MINIO_ACCESS_KEY
+            - name: MINIO_ROOT_USER
               value: admin
-            - name: MINIO_SECRET_KEY
+            - name: MINIO_ROOT_PASSWORD
               value: password
           ports:
             - containerPort: 9000
               name: api
             - containerPort: 9001
               name: dashboard
-          command: [minio, server, --console-address, ":9001", /data]
+          command: [silo, server, --console-address, ":9001", /data]
           lifecycle:
             postStart:
               exec:
```

---

### Incident Patch 8: `88a99597` (2026-09-24)
**Commit Message**: test(controller): move workflow pod fixtures into testdata (#17067)

Signed-off-by: Jeffery Lofoneh Asamani <jefferyasamani7@gmail.com>
Co-authored-by: Claude Opus 5 <noreply@anthropic.com>

**File**: `workflow/controller/testdata/workflowpod/container-args-offloading.yaml` (added, +12/-0)
```diff
@@ -0,0 +1,12 @@
+apiVersion: argoproj.io/v1alpha1
+kind: Workflow
+metadata:
+  name: test-large-args
+  namespace: default
+spec:
+  entrypoint: main
+  templates:
+  - name: main
+    container:
+      image: alpine:latest
+      command: ["/bin/sh"]
```

**File**: `workflow/controller/testdata/workflowpod/hello-windows-wf.yaml` (added, +14/-0)
```diff
@@ -0,0 +1,14 @@
+apiVersion: argoproj.io/v1alpha1
+kind: Workflow
+metadata:
+  name: hello-hybrid-win
+spec:
+  entrypoint: hello-win
+  templates:
+    - name: hello-win
+      nodeSelector:
+        kubernetes.io/os: windows
+      container:
+        image: mcr.microsoft.com/windows/nanoserver:1809
+        command: ["cmd", "/c"]
+        args: ["echo", "Hello from Windows Container!"]
```

**File**: `workflow/controller/testdata/workflowpod/hello-world-step-wf-with-patch.yaml` (added, +21/-0)
```diff
@@ -0,0 +1,21 @@
+apiVersion: argoproj.io/v1alpha1
+kind: Workflow
+metadata:
+  name: hello-world
+spec:
+  entrypoint: hello
+  templates:
+  - name: hello
+    steps:
+    - - name: hello
+        template: whalesay
+  - name: whalesay
+    podSpecPatch: '{"containers":[{"name":"main", "resources":{"limits":{"cpu": "800m"}}}]}'
+    container:
+      image: docker/whalesay:latest
+      command: [cowsay]
+      args: ["hello world"]
+    outputs:
+      parameters:
+      - name: pod-name
+        value: "{{pod.name}}"
```

**File**: `workflow/controller/testdata/workflowpod/hello-world-wf-with-env-refer-secret.yaml` (added, +25/-0)
```diff
@@ -0,0 +1,25 @@
+apiVersion: argoproj.io/v1alpha1
+kind: Workflow
+metadata:
+  name: hello-world
+spec:
+  entrypoint: whalesay
+  templates:
+  - name: whalesay
+    metadata:
+      annotations:
+        annotationKey1: "annotationValue1"
+        annotationKey2: "annotationValue2"
+      labels:
+        labelKey1: "labelValue1"
+        labelKey2: "labelValue2"
+    container:
+      image: docker/whalesay:latest
+      command: [cowsay]
+      args: ["hello world"]
+      env:
+      - name: ENV3
+        valueFrom:
+          secretKeyRef:
+            name: mysecret
+            key: sec
```

**File**: `workflow/controller/testdata/workflowpod/hello-world-wf-with-invalid-patch-format.yaml` (added, +13/-0)
```diff
@@ -0,0 +1,13 @@
+apiVersion: argoproj.io/v1alpha1
+kind: Workflow
+metadata:
+  name: hello-world
+spec:
+  entrypoint: whalesay
+  templates:
+  - name: whalesay
+    podSpecPatch: '{"containers"}' # not a valid JSON here
+    container:
+      image: docker/whalesay:latest
+      command: [cowsay]
+      args: ["hello world"]
```

---

### Incident Patch 9: `096976e6` (2026-09-24)
**Commit Message**: fix: resolve node ID collisions made by a memoized resubmit (#17028)

Signed-off-by: Alan Clucas <alan@clucas.org>
Co-authored-by: Claude Opus 5 <noreply@anthropic.com>

**File**: `workflow/util/node_id_collision_test.go` (modified, +67/-0)
```diff
@@ -1,6 +1,7 @@
 package util
 
 import (
+	"strings"
 	"testing"
 
 	"github.com/stretchr/testify/assert"
@@ -105,3 +106,69 @@ func TestFormulateRetryWorkflowWithCollision(t *testing.T) {
 		assert.Contains(t, []string{newWf.NodeID(n.Name), newWf.NodeID64(n.Name)}, n.ID)
 	}
 }
+
+// Two sibling node names of a withItems fan-out that collide under NodeID
+// once the workflow is called custom-job-abcde. Renaming a workflow rehashes
+// every node name, so a resubmit can create a collision that the original
+// workflow did not have; these were found by searching for one.
+const (
+	renamedWfName     = "custom-job-abcde"
+	collidingFanoutA  = "[0].fanout(26094:item26094)"
+	collidingFanoutB  = "[0].fanout(35221:item35221)"
+	uncollidingWfName = "custom-job-thbh7"
+)
+
+func TestNewNodeIDsWidensACollisionMadeByTheRename(t *testing.T) {
+	wf := &wfv1.Workflow{}
+	wf.Name = uncollidingWfName
+	wf.Status.Nodes = wfv1.Nodes{}
+	for _, suffix := range []string{"", collidingFanoutA, collidingFanoutB} {
+		name := wf.Name + suffix
+		wf.Status.Nodes[wf.NodeID(name)] = wfv1.NodeStatus{Name: name, ID: wf.NodeID(name)}
+	}
+	require.Len(t, wf.Status.Nodes, 3, "the names must not collide under the old workflow name")
+
+	newWf := &wfv1.Workflow{}
+	newWf.Name = renamedWfName
+	nameA, nameB := newWf.Name+collidingFanoutA, newWf.Name+collidingFanoutB
+	require.Equal(t, newWf.NodeID(nameA), newWf.NodeID(nameB), "the names must collide under the new workflow name")
+
+	rename := func(name string) string { return newWf.Name + strings.TrimPrefix(name, wf.Name) }
+	newIDs, err := newNodeIDs(wf, newWf, rename)
+	require.NoError(t, err)
+
+	// the first name in name order keeps the 32-bit slot, the loser is widened
+	assert.Equal(t, newWf.NodeID(nameA), newIDs[wf.NodeID(wf.Name+collidingFanoutA)])
+	assert.Equal(t, newWf.NodeID64(nameB), newIDs[wf.NodeID(wf.Name+collidingFanoutB)])
+
+	// which is where the resubmitted workflow can find them again
+	newWf.Status.Nodes = wfv1.Nodes{}
+	for oldID, newID := range newIDs {
+		newWf.Status.Nodes[newID] = wfv1.NodeStatus{Name: rename(wf.Status.Nodes[oldID].Name), ID: newID}
+	}
+	assert.Len(t, newWf.Status.Nodes, len(wf.Status.Nodes), "no node may be lost to a collision")
+	for _, name := range []string{newWf.Name, nameA, nameB} {
+		node, err := newWf.GetNodeByName(name)
+		require.NoError(t, err)
+		assert.Equal(t, name, node.Name)
+	}
+}
+
+func TestNewNodeIDsKeepsDeletedNodesOutOfTheWay(t *testing.T) {
+	wf := collidingWorkflow(t, wfv1.NodeFailed)
+	newWf := &wfv1.Workflow{}
+	newWf.Name = renamedWfName
+	rename := func(name string) string { return newWf.Name + strings.TrimPrefix(name, wf.Name) }
+
+	newIDs, err := newNodeIDs(wf, newWf, rename)
+	require.NoError(t, err)
+
+	// every node is mapped, including ones a reset plan goes on to delete, and
+	// no two share an ID, so a dangling reference cannot alias a kept node
+	assert.Len(t, newIDs, len(wf.Status.Nodes))
+	seen := map[string]bool{}
+	for _, id := range newIDs {
+		assert.False(t, seen[id], "IDs must be unique")
+		seen[id] = true
+	}
+}
```

**File**: `workflow/util/util.go` (modified, +47/-7)
```diff
@@ -859,8 +859,15 @@ func FormulateResubmitWorkflow(ctx context.Context, wf *wfv1.Workflow, memoized
 	// reference has to be rewritten.
 	replaceRegexp := regexp.MustCompile("^" + regexp.QuoteMeta(wf.Name))
 	now := metav1.Time{Time: time.Now().UTC()}
+	rename := func(name string) string {
+		return replaceRegexp.ReplaceAllString(name, newWF.Name)
+	}
+	newIDs, err := newNodeIDs(wf, &newWF, rename)
+	if err != nil {
+		return nil, err
+	}
 	memoize := func(node wfv1.NodeStatus) wfv1.NodeStatus {
-		node.Name = replaceRegexp.ReplaceAllString(node.Name, newWF.Name)
+		node.Name = rename(node.Name)
 		node.StartedAt = now
 		node.FinishedAt = now
 		if node.Type == wfv1.NodeTypePod {
@@ -880,8 +887,10 @@ func FormulateResubmitWorkflow(ctx context.Context, wf *wfv1.Workflow, memoized
 		}
 		return node
 	}
+	// A reference to a node that is not in the status at all maps to no ID,
+	// and applyResetPlan drops it.
 	mapID := func(id string) string {
-		return convertNodeID(&newWF, replaceRegexp, id, wf.Status.Nodes)
+		return newIDs[id]
 	}
 	applyResetPlan(ctx, wf, &newWF, plan, memoize, mapID)
 
@@ -919,11 +928,42 @@ func keepExistingNodeIDs(nodes wfv1.Nodes, ids []string) []string {
 	return kept
 }
 
-// convertNodeID converts an old nodeID to a new nodeID
-func convertNodeID(newWf *wfv1.Workflow, regex *regexp.Regexp, oldNodeID string, oldNodes map[string]wfv1.NodeStatus) string {
-	node := oldNodes[oldNodeID]
-	newNodeName := regex.ReplaceAllString(node.Name, newWf.Name)
-	return newWf.NodeID(newNodeName)
+// newNodeIDs works out the ID each node of wf takes under the name of newWf.
+// A node ID is a hash of the node name, which starts with the workflow name,
+// so renaming the workflow rehashes the whole graph: names that collided
+// before may not any more, and names that did not may now. Nodes are assigned
+// in name order, so the result does not depend on map iteration order, and a
+// name that finds its 32-bit slot taken gets the widened one instead, which is
+// where Workflow.ResolveNode looks for it.
+//
+// Nodes the reset plan deletes are given an ID too, so that a reference to one
+// cannot land on the ID of a node that is kept and so survive the pruning
+// applyResetPlan does.
+func newNodeIDs(wf, newWf *wfv1.Workflow, rename func(name string) string) (map[string]string, error) {
+	oldIDs := make([]string, 0, len(wf.Status.Nodes))
+	for id := range wf.Status.Nodes {
+		oldIDs = append(oldIDs, id)
+	}
+	slices.SortFunc(oldIDs, func(a, b string) int {
+		return strings.Compare(wf.Status.Nodes[a].Name, wf.Status.Nodes[b].Name)
+	})
+	newIDs := make(map[string]string, len(oldIDs))
+	taken := make(map[string]bool, len(oldIDs))
+	for _, oldID := range oldIDs {
+		name := rename(wf.Status.Nodes[oldID].Name)
+		newID := newWf.NodeID(name)
+		if taken[newID] {
+			// the 32-bit slot has gone to another name: widen, as the
+			// controller does when it creates a node
+			newID = newWf.NodeID64(name)
+			if taken[newID] {
+				return nil, errors.Errorf(errors.CodeBadRequest, "cannot resubmit %s as %s: node %s collides with another node at both ID widths", wf.Name, newWf.Name, name)
+			}
+		}
+		taken[newID] = true
+		newIDs[oldID] = newID
+	}
+	return newIDs, nil
 }
 
 func isDescendantNodeSucceeded(ctx context.Context, wf *wfv1.Workflow, node wfv1.NodeStatus, nodeIDsToReset map[string]bool) bool {
```

---

### Incident Patch 10: `084009d5` (2026-09-23)
**Commit Message**: test(controller): move hook fixtures into testdata (#17061)

Signed-off-by: Jeffery Lofoneh Asamani <jefferyasamani7@gmail.com>
Co-authored-by: Claude Opus 5 <noreply@anthropic.com>

**File**: `workflow/controller/hooks_test.go` (modified, +14/-1050)
```diff
@@ -15,128 +15,7 @@ import (
 )
 
 func TestExecuteWfLifeCycleHook(t *testing.T) {
-	wf := wfv1.MustUnmarshalWorkflow(`
-apiVersion: argoproj.io/v1alpha1
-kind: Workflow
-metadata:
-  name: lifecycle-hook-bgsf6
-  namespace: argo
-  resourceVersion: "33638"
-spec:
-  entrypoint: main
-  hooks:
-    exit:
-      template: http
-    error:
-      expression: workflow.status == "Error"
-      template: http
-    running:
-      expression: workflow.status == "Running"
-      template: http
-  templates:
-  - name: main
-    steps:
-    - - name: step1
-        template: heads
-  - container:
-      args:
-      - echo "it was heads"
-      command:
-      - sh
-      - -c
-      image: alpine:3.23
-      name: ""
-    name: heads
-  - http:
-      url: https://raw.githubusercontent.com/argoproj/argo-workflows/4e450e250168e6b4d51a126b784e90b11a0162bc/pkg/apis/workflow/v1alpha1/generated.swagger.json
-    name: http
-status:
-  artifactRepositoryRef:
-    artifactRepository:
-      archiveLogs: true
-      s3:
-        accessKeySecret:
-          key: accesskey
-          name: my-minio-cred
-        bucket: my-bucket
-        endpoint: minio:9000
-        insecure: true
-        secretKeySecret:
-          key: secretkey
-          name: my-minio-cred
-    configMap: artifact-repositories
-    key: default-v1
-    namespace: argo
-  conditions:
-  - status: "False"
-    type: PodRunning
-  - status: "True"
-    type: Completed
-  finishedAt: "2022-01-26T19:25:42Z"
-  nodes:
-    lifecycle-hook-bgsf6:
-      children:
-      - lifecycle-hook-bgsf6-2367710970
-      displayName: lifecycle-hook-bgsf6
-      finishedAt: "2022-01-26T19:25:42Z"
-      id: lifecycle-hook-bgsf6
-      name: lifecycle-hook-bgsf6
-      outboundNodes:
-      - lifecycle-hook-bgsf6-3057272397
-      phase: Error
-      progress: 1/1
-      resourcesDuration:
-        cpu: 4
-        memory: 2
-      startedAt: "2022-01-26T19:23:48Z"
-      templateName: main
-      templateScope: local/lifecycle-hook-bgsf6
-      type: Steps
-    lifecycle-hook-bgsf6-2367710970:
-      boundaryID: lifecycle-hook-bgsf6
-      children:
-      - lifecycle-hook-bgsf6-3057272397
-      displayName: '[0]'
-      finishedAt: "2022-01-26T19:25:42Z"
-      id: lifecycle-hook-bgsf6-2367710970
-      name: lifecycle-hook-bgsf6[0]
-      phase: Error
-      progress: 1/1
-      resourcesDuration:
-        cpu: 4
-        memory: 2
-      startedAt: "2022-01-26T19:23:48Z"
-      templateScope: local/lifecycle-hook-bgsf6
-      type: StepGroup
-    lifecycle-hook-bgsf6-3057272397:
-      boundaryID: lifecycle-hook-bgsf6
-      displayName: step1
-      finishedAt: "2022-01-26T19:25:41Z"
-      hostNodeName: k3d-k3s-default-server-0
-      id: lifecycle-hook-bgsf6-3057272397
-      name: lifecycle-hook-bgsf6[0].step1
-      outputs:
-        artifacts:
-        - name: main-logs
-          s3:
-            key: lifecycle-hook-bgsf6/lifecycle-hook-bgsf6-3057272397/main.log
-        exitCode: "0"
-      phase: Error
-      progress: 1/1
-      resourcesDuration:
-        cpu: 4
-        memory: 2
-      startedAt: "2022-01-26T19:23:48Z"
-      templateName: heads
-      templateScope: local/lifecycle-hook-bgsf6
-      type: Pod
-  phase: Error
-  progress: 1/1
-  resourcesDuration:
-    cpu: 4
-    memory: 2
-  startedAt: "2022-01-26T19:23:48Z"
-`)
+	wf := wfv1.MustUnmarshalWorkflow("@testdata/hooks/execute-wf-life-cycle-hook.yaml")
 
 	ctx := logging.TestContext(t.Context())
 	cancel, controller := newController(ctx, wf)
@@ -153,110 +32,7 @@ status:
 }
 
 func TestExecuteTmplLifeCycleHook(t *testing.T) {
-	wf := wfv1.MustUnmarshalWorkflow(`
-apiVersion: argoproj.io/v1alpha1
-kind: Workflow
-metadata:
-  name: lifecycle-hook-tmpl-levelg8mqq
-  namespace: argo
-spec:
-  entrypoint: main
-  templates:
-  - name: main
-    steps:
-    - - hooks:
-          running:
-            expression: steps.step1.status == "Running"
-            template: http
-          error:
-            expression: st
```

**File**: `workflow/controller/testdata/hooks/execute-tmpl-life-cycle-hook.yaml` (added, +102/-0)
```diff
@@ -0,0 +1,102 @@
+apiVersion: argoproj.io/v1alpha1
+kind: Workflow
+metadata:
+  name: lifecycle-hook-tmpl-levelg8mqq
+  namespace: argo
+spec:
+  entrypoint: main
+  templates:
+  - name: main
+    steps:
+    - - hooks:
+          running:
+            expression: steps.step1.status == "Running"
+            template: http
+          error:
+            expression: steps.step1.status == "Error"
+            template: http
+        name: step1
+        template: echo
+  - container:
+      args:
+      - echo "it was heads"
+      command:
+      - sh
+      - -c
+      image: alpine:3.23
+    name: echo
+  - http:
+      url: https://raw.githubusercontent.com/argoproj/argo-workflows/4e450e250168e6b4d51a126b784e90b11a0162bc/pkg/apis/workflow/v1alpha1/generated.swagger.json
+    name: http
+status:
+  conditions:
+  - status: "False"
+    type: PodRunning
+  - status: "True"
+    type: Completed
+  finishedAt: "2022-01-26T21:28:37Z"
+  nodes:
+    lifecycle-hook-tmpl-levelg8mqq:
+      children:
+      - lifecycle-hook-tmpl-levelg8mqq-2902815070
+      displayName: lifecycle-hook-tmpl-levelg8mqq
+      finishedAt: "2022-01-26T21:28:37Z"
+      id: lifecycle-hook-tmpl-levelg8mqq
+      name: lifecycle-hook-tmpl-levelg8mqq
+      outboundNodes:
+      - lifecycle-hook-tmpl-levelg8mqq-3824639481
+      phase: Running
+      progress: 1/1
+      resourcesDuration:
+        cpu: 1
+        memory: 0
+      startedAt: "2022-01-26T21:28:33Z"
+      templateName: main
+      templateScope: local/lifecycle-hook-tmpl-levelg8mqq
+      type: Steps
+    lifecycle-hook-tmpl-levelg8mqq-2902815070:
+      boundaryID: lifecycle-hook-tmpl-levelg8mqq
+      children:
+      - lifecycle-hook-tmpl-levelg8mqq-3824639481
+      displayName: '[0]'
+      finishedAt: "2022-01-26T21:28:37Z"
+      id: lifecycle-hook-tmpl-levelg8mqq-2902815070
+      name: lifecycle-hook-tmpl-levelg8mqq[0]
+      phase: Running
+      progress: 1/1
+      resourcesDuration:
+        cpu: 1
+        memory: 0
+      startedAt: "2022-01-26T21:28:33Z"
+      templateScope: local/lifecycle-hook-tmpl-levelg8mqq
+      type: StepGroup
+    lifecycle-hook-tmpl-levelg8mqq-3824639481:
+      boundaryID: lifecycle-hook-tmpl-levelg8mqq
+      children:
+      - lifecycle-hook-tmpl-levelg8mqq-4216202210
+      displayName: step1
+      finishedAt: "2022-01-26T21:28:36Z"
+      hostNodeName: k3d-k3s-default-server-0
+      id: lifecycle-hook-tmpl-levelg8mqq-3824639481
+      name: lifecycle-hook-tmpl-levelg8mqq[0].step1
+      outputs:
+        artifacts:
+        - name: main-logs
+          s3:
+            key: lifecycle-hook-tmpl-levelg8mqq/lifecycle-hook-tmpl-levelg8mqq-3824639481/main.log
+        exitCode: "0"
+      phase: Running
+      progress: 1/1
+      resourcesDuration:
+        cpu: 1
+        memory: 0
+      startedAt: "2022-01-26T21:28:33Z"
+      templateName: echo
+      templateScope: local/lifecycle-hook-tmpl-levelg8mqq
+      type: Pod
+  phase: Running
+  progress: 1/1
+  resourcesDuration:
+    cpu: 1
+    memory: 0
+  startedAt: "2022-01-26T21:28:33Z"
```

**File**: `workflow/controller/testdata/hooks/execute-wf-life-cycle-hook.yaml` (added, +120/-0)
```diff
@@ -0,0 +1,120 @@
+apiVersion: argoproj.io/v1alpha1
+kind: Workflow
+metadata:
+  name: lifecycle-hook-bgsf6
+  namespace: argo
+  resourceVersion: "33638"
+spec:
+  entrypoint: main
+  hooks:
+    exit:
+      template: http
+    error:
+      expression: workflow.status == "Error"
+      template: http
+    running:
+      expression: workflow.status == "Running"
+      template: http
+  templates:
+  - name: main
+    steps:
+    - - name: step1
+        template: heads
+  - container:
+      args:
+      - echo "it was heads"
+      command:
+      - sh
+      - -c
+      image: alpine:3.23
+      name: ""
+    name: heads
+  - http:
+      url: https://raw.githubusercontent.com/argoproj/argo-workflows/4e450e250168e6b4d51a126b784e90b11a0162bc/pkg/apis/workflow/v1alpha1/generated.swagger.json
+    name: http
+status:
+  artifactRepositoryRef:
+    artifactRepository:
+      archiveLogs: true
+      s3:
+        accessKeySecret:
+          key: accesskey
+          name: my-minio-cred
+        bucket: my-bucket
+        endpoint: minio:9000
+        insecure: true
+        secretKeySecret:
+          key: secretkey
+          name: my-minio-cred
+    configMap: artifact-repositories
+    key: default-v1
+    namespace: argo
+  conditions:
+  - status: "False"
+    type: PodRunning
+  - status: "True"
+    type: Completed
+  finishedAt: "2022-01-26T19:25:42Z"
+  nodes:
+    lifecycle-hook-bgsf6:
+      children:
+      - lifecycle-hook-bgsf6-2367710970
+      displayName: lifecycle-hook-bgsf6
+      finishedAt: "2022-01-26T19:25:42Z"
+      id: lifecycle-hook-bgsf6
+      name: lifecycle-hook-bgsf6
+      outboundNodes:
+      - lifecycle-hook-bgsf6-3057272397
+      phase: Error
+      progress: 1/1
+      resourcesDuration:
+        cpu: 4
+        memory: 2
+      startedAt: "2022-01-26T19:23:48Z"
+      templateName: main
+      templateScope: local/lifecycle-hook-bgsf6
+      type: Steps
+    lifecycle-hook-bgsf6-2367710970:
+      boundaryID: lifecycle-hook-bgsf6
+      children:
+      - lifecycle-hook-bgsf6-3057272397
+      displayName: '[0]'
+      finishedAt: "2022-01-26T19:25:42Z"
+      id: lifecycle-hook-bgsf6-2367710970
+      name: lifecycle-hook-bgsf6[0]
+      phase: Error
+      progress: 1/1
+      resourcesDuration:
+        cpu: 4
+        memory: 2
+      startedAt: "2022-01-26T19:23:48Z"
+      templateScope: local/lifecycle-hook-bgsf6
+      type: StepGroup
+    lifecycle-hook-bgsf6-3057272397:
+      boundaryID: lifecycle-hook-bgsf6
+      displayName: step1
+      finishedAt: "2022-01-26T19:25:41Z"
+      hostNodeName: k3d-k3s-default-server-0
+      id: lifecycle-hook-bgsf6-3057272397
+      name: lifecycle-hook-bgsf6[0].step1
+      outputs:
+        artifacts:
+        - name: main-logs
+          s3:
+            key: lifecycle-hook-bgsf6/lifecycle-hook-bgsf6-3057272397/main.log
+        exitCode: "0"
+      phase: Error
+      progress: 1/1
+      resourcesDuration:
+        cpu: 4
+        memory: 2
+      startedAt: "2022-01-26T19:23:48Z"
+      templateName: heads
+      templateScope: local/lifecycle-hook-bgsf6
+      type: Pod
+  phase: Error
+  progress: 1/1
+  resourcesDuration:
+    cpu: 4
+    memory: 2
+  startedAt: "2022-01-26T19:23:48Z"
```

**File**: `workflow/controller/testdata/hooks/step-hook-no-expression.yaml` (added, +21/-0)
```diff
@@ -0,0 +1,21 @@
+apiVersion: argoproj.io/v1alpha1
+kind: Workflow
+metadata:
+  name: hook-failures
+  namespace: argo
+spec:
+  entrypoint: main
+  templates:
+    - name: main
+      steps:
+        - - name: step-1
+            template: message
+            hooks:
+              foo:
+                template: message
+    - name: message
+      script:
+        image: alpine:3.23
+        command: [sh]
+        source: |
+          echo Hi
```

**File**: `workflow/controller/testdata/hooks/steps-skipped-ref-exit-hook.yaml` (added, +46/-0)
```diff
@@ -0,0 +1,46 @@
+apiVersion: argoproj.io/v1alpha1
+kind: Workflow
+metadata:
+  name: steps-skipped-ref-exit-hook
+spec:
+  entrypoint: main
+  templates:
+  - name: main
+    steps:
+    - - name: producer
+        template: produce
+        when: "false"
+    - - name: work
+        template: simple
+        hooks:
+          exit:
+            template: consume
+            arguments:
+              parameters:
+              - name: in
+                value: "{{steps.producer.outputs.parameters.msg}}"
+              - name: in2
+                value: "{{= steps.producer.outputs.parameters.msg ?? 'hook-fallback'}}"
+  - name: produce
+    outputs:
+      parameters:
+      - name: msg
+        valueFrom:
+          path: /tmp/out.txt
+    container:
+      image: alpine:3.23
+      command: [sh, -c]
+      args: ["echo hello > /tmp/out.txt"]
+  - name: simple
+    container:
+      image: alpine:3.23
+      command: [echo, "hello"]
+  - name: consume
+    inputs:
+      parameters:
+      - name: in
+        default: "FALLBACK"
+      - name: in2
+    container:
+      image: alpine:3.23
+      command: [echo, "{{inputs.parameters.in}} {{inputs.parameters.in2}}"]
```

#### Recent Merged Pull Requests:
- **PR #17106** (2026-09-30): chore(deps): update module github.com/google/go-containerregistry to v0.22.1 (main) (@renovate[bot])
- **PR #17105** (2026-09-29): chore(deps): update google.golang.org/genproto/googleapis/api digest to 8a89bd6 (main) (@renovate[bot])
- **PR #17104** (2026-09-29): fix(examples): mark retry-script as flaky so it is skipped in e2e (@lofoneh)
- **PR #17102** (2026-09-29): fix: tie database queries to the caller's context (cherry-pick #17076 for 4.1) (@argo-cd-cherry-pick-bot[bot])
- **PR #17101** (2026-09-29): chore(deps): update module github.com/azure/azure-sdk-for-go/sdk/azcore to v1.23.2 (main) (@renovate[bot])
- **PR #17100** (2026-09-28): fix: termination of suspended workflow (cherry-pick #17052 for 4.1) (@argo-cd-cherry-pick-bot[bot])
- **PR #17099** (2026-09-29): fix: termination of suspended workflow (cherry-pick #17052 for 4.0) (@argo-cd-cherry-pick-bot[bot])
- **PR #17098** (2026-09-29): chore(deps): update module github.com/dustin/go-humanize to v1.1.0 (main) (@renovate[bot])

---

## 3. Empirical Evidence & Compliance Certification
- **Evidence Provenance**: Fetched directly from verified official GitHub REST API.
- **Zero Disk Footprint**: 0 bytes of unnecessary repository bloat stored locally.
- **TOS & Free-Tier Adherence**: Request pace complied with public API guidelines without fee, penalty, or unauthorized scraping.

---

## 4. Promotion & Integration Status
- **Status**: HARVESTED_DEEP_FORENSIC
- **Master Brain Sync**: Auto-committed to local/remote Master Brain repository.
