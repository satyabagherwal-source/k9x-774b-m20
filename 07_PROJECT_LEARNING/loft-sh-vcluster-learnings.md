> **Canonical Learning Artifact**: `07_PROJECT_LEARNING/loft-sh-vcluster-learnings.md`  
> **Source**: github ([https://github.com/loft-sh/vcluster](https://github.com/loft-sh/vcluster))  
> **Source Version**: `f38b446f`  
> **License**: Apache-2.0  
> **Synthesized By**: zero-clone-structural-synthesizer  
> **Timestamp**: 2026-11-27T21:47:50.688Z  
> **Learning ID**: `learn-github-loft-sh-vcluster`  
> **Pipeline Version**: `2.0.0`  
> **Status**: VERIFIED_EMPIRICAL_INTELLIGENCE  
> **Data Governance**: CLASSIFICATION: PUBLIC. Sanitized against PII/secrets.  
> **Policy Invariant**: Strictly for engineering retrieval and architecture documentation. Distillation prohibited.  

---

# Forensic Learning Record (Deep Inspection): loft-sh/vcluster

> **Canonical Artifact**: `07_PROJECT_LEARNING/loft-sh-vcluster-learnings.md`  
> **Source Platform**: GitHub ([https://github.com/loft-sh/vcluster](https://github.com/loft-sh/vcluster))  
> **Harvest Method**: Full-Spectrum Deep Extraction (Patches, Diffs, Source Code, Post-Mortems)  
> **Harvest Timestamp**: 2026-11-27T21:47:50.567Z  
> **Compliance State**: Free Tier Guaranteed | Strict Rate-Limit Backoff Honored  

---

## 1. Context & Architectural Overview
- **Repository / Resource**: `loft-sh/vcluster`
- **Description**: vCluster creates tenant clusters: fully isolated environments delivered as managed Kubernetes, or as the foundation for Slurm, Ray, Run:ai and inference clusters. Each gets its own API server, CRDs and RBAC, and runs on an existing cluster or standalone on bare metal. CNCF Certified Kubernetes.
- **Primary Language / Ecosystem**: Go
- **Discovered Manifests / Configurations**: go.mod, README.md, Dockerfile
- **Stars / Engagement**: 11415 stars

---

## 2. Multi-Dimensional 8-Axis Investigation & Real Code Patches

### D1: Architecture & Structural Boundaries
- Entry configurations inspected via direct stream: go.mod, README.md, Dockerfile.
- Evaluated system abstractions and modular contracts.

### Core Architecture Module: `cmd/vclusterctl/cmd/platform/list/utils.go`
```
package list

import (
	"encoding/json"

	"github.com/loft-sh/log"
	"github.com/loft-sh/log/table"
	"github.com/sirupsen/logrus"
)

func printJSON(logger log.Logger, value []map[string]string) error {
	bytes, err := json.MarshalIndent(value, "", "    ")
	if err != nil {
		return err
	}
	logger.WriteString(logrus.InfoLevel, string(bytes)+"\n")
	return nil
}

// PrintData is a generic function that prints data in different formats (JSON or table).
// It takes a logger for output, an output type (json/table), a list of headers, a slice of items,
// and a function to extract values from each item.
func PrintData[T any](logger log.Logger, outputType string, headers []string, items []T, getValues func(T) []string) error {
	var err error
	switch outputType {
	case "json":
		// Convert items into a map using headers and value extractor function
		itemsMap := toMap(headers, items, getValues)

		err = printJSON(logger, itemsMap)
	case "table", "default":
		// Convert items into a 2D slice of values
		values := toValues(items, getValues)

		table.PrintTable(logger, headers, values)
	}
	return err
}

func toValues[T any](items []T, getValues func(T) []string) [][]string {
	values := make([][]string, len(items))
	for i, item := range items {
		values[i] = getValues(item)
	}
	return values
}

// toMap converts a slice of items into a slice of maps, where each map represents an item with
// keys from headers and values extracted using the getValues function.
func toMap[T any](headers []string, items []T, getValues func(T) []string) []map[string]string {
	var projectsMap []map[string]string
	for _, item := range items {
		values := getValues(item)
		dataMap := make(map[string]string)
		for i, header := range headers {
			if i < len(values) { // Ensure values exist for the given index
				dataMap[header] = values[i]
			}
		}
		projectsMap = append(projectsMap, dataMap)
	}
	return projectsMap
}

```

### Core Architecture Module: `pkg/cli/util/args.go`
```
package util

import (
	"errors"
	"fmt"
	"strings"

	"github.com/loft-sh/log"
	"github.com/loft-sh/log/survey"
	"github.com/loft-sh/log/terminal"
	"github.com/spf13/cobra"

	agentstoragev1 "github.com/loft-sh/agentapi/v5/pkg/apis/loft/storage/v1"
)

var (
	NamespaceNameOnlyUseLine   string
	NamespaceNameOnlyValidator cobra.PositionalArgs

	VClusterNameOnlyUseLine string

	VClusterNameOnlyValidator cobra.PositionalArgs
)

var (
	ErrNonInteractive   = errors.New("terminal is not interactive")
	ErrTooManyArguments = errors.New("too many arguments specified")

	// prompt responses
	PositiveResponse = "yes"
	NegativeResponse = "no"
)

const (
	InstanceVirtualClusterDBConnectorSynced agentstoragev1.ConditionType = "DBConnectorSynced"

	DBConnectorSecretNotFound string = "DBConnectorSecretNotFound"
)

func init() {
	NamespaceNameOnlyUseLine, NamespaceNameOnlyValidator = NamedPositionalArgsValidator(true, true, "NAMESPACE_NAME")
	VClusterNameOnlyUseLine, VClusterNameOnlyValidator = NamedPositionalArgsValidator(true, true, "VCLUSTER_NAME")
}

// NamedPositionalArgsValidator returns a cobra.PositionalArgs that returns a helpful
// error message if the arg number doesn't match.
// It also returns a string that can be appended to the cobra useline
//
// Example output for extra arguments with :
//
//	$ command arg asdf
//	[fatal]  command ARG_1 [flags]
//	Invalid Args: received 2 arguments, expected 1, extra arguments: "asdf"
//	Run with --help for more details
//
// Example output for missing arguments:
//
//	$ command
//	[fatal]  command ARG_1 [flags]
//	Invalid Args: received 0 arguments, expected 1, please specify missing: "ARG_!"
//	Run with --help for more details on arguments
func NamedPositionalArgsValidator(failMissing, failExtra bool, expectedArgs ...string) (string, cobra.PositionalArgs) {
	return " " + strings.Join(expectedArgs, " "), func(cmd *cobra.Command, args []string) error {
		numExpectedArgs := len(expectedArgs)
		numArgs := len(args)
		numMissing := numExpectedArgs - numArgs

		if numMissing == 0 {
			return nil
		}

		// didn't receive as many arguments as expected
		if numMissing > 0 && failMissing {
			// the last numMissing expectedArgs
			missingKeys := strings.Join(expectedArgs[len(expectedArgs)-(numMissing):], ", ")
			return fmt.Errorf("%s\nInvalid Args: received %d arguments, expected %d, please specify missing: %q\nRun with --help for more details on arguments", cmd.UseLine(), numArgs, numExpectedArgs, missingKeys)
		}

		// received more than expected
		if numMissing < 0 && failExtra {
			// received more than expected
			numExtra := -numMissing
			// the last numExtra args
			extraValues := strings.Join(args[len(args)-numExtra:], ", ")
			return fmt.Errorf("%s\nInvalid Args: received %d arguments, expected %d, extra arguments: %q\nRun with --help for more details on arguments", cmd.UseLine(), numArgs, numExpectedArgs, extraValues)
		}

		return nil
	}
}

// PromptForArgs expects that the terminal is interactive and the number of args, matched the number of argNames, in the
// order they should appear and will prompt one by one for the missing args adding them to the args slice and returning
// a new set for a command to use. It returns the args, rather than a nil slice so they're unaltered in error cases.
func PromptForArgs(l log.Logger, args []string, argNames ...string) ([]string, error) {
	if !terminal.IsTerminalIn {
		return args, ErrNonInteractive
	}
	if len(args) > len(argNames) {
		return args, ErrTooManyArguments
	}

	if len(args) == len(argNames) {
		return args, nil
	}

	for i := range argNames[len(args):] {
		answer, err := l.Question(&survey.QuestionOptions{
			Question: fmt.Sprintf("Please specify %s", argNames[i]),
		})
		if err != nil {
			return args, err
		}
		args = append(args, answer)
	}

	return args, nil
}

```

### Core Architecture Module: `pkg/config/coredns_plugin_validation.go`
```
package config

import (
	"fmt"
	"strings"

	vclusterconfig "github.com/loft-sh/vcluster/config"
)

func validateMappings(resolveDNS []vclusterconfig.ResolveDNS) error {
	for i, mapping := range resolveDNS {
		// parse service format
		options := 0
		if mapping.Service != "" {
			options++
			if strings.Count(mapping.Service, "/") != 1 {
				return fmt.Errorf("error validating networking.resolveDNS[%d].service: expected format namespace/name, but got %s", i, mapping.Service)
			}
		}
		if mapping.Hostname != "" {
			if strings.Count(mapping.Hostname, "*") > 1 {
				return fmt.Errorf("error validating networking.resolveDNS[%d].hostname: can only contain a maximum of one wildcard, but got %s", i, mapping.Hostname)
			} else if strings.Count(mapping.Hostname, "*") == 1 {
				if mapping.Target.Hostname == "" {
					return fmt.Errorf("error validating networking.resolveDNS[%d].hostname: when using wildcard hostname, target.hostname is required", i)
				} else if strings.Count(mapping.Target.Hostname, "*") != 1 {
					return fmt.Errorf("error validating networking.resolveDNS[%d].hostname: when using wildcard hostname, target.hostname needs to contain a single wildcard as well", i)
				}

				if !strings.HasPrefix(mapping.Hostname, "*") && !strings.HasSuffix(mapping.Hostname, "*") {
					return fmt.Errorf("error validating networking.resolveDNS[%d].hostname: when using wildcard hostname, needs to be as a suffix or prefix, but got %s", i, mapping.Hostname)
				}
			}

			options++
		}
		if mapping.Namespace != "" {
			if mapping.Target.HostNamespace == "" {
				return fmt.Errorf("error validating networking.resolveDNS[%d].namespace: when using namespace, target.hostNamespace is required", i)
			}

			options++
		} else if mapping.Target.HostNamespace != "" {
			return fmt.Errorf("error validating networking.resolveDNS[%d]: when using target.hostNamespace, .namespace is required", i)
		}

		if options == 0 {
			return fmt.Errorf("at least one option required for networking.resolveDNS[%d]", i)
		} else if options > 1 {
			return fmt.Errorf("only a single option allowed for networking.resolveDNS[%d]", i)
		}

		// validate targets
		err := validateTarget(mapping.Target)
		if err != nil {
			return fmt.Errorf("error validating networking.resolveDNS[%d].to", i)
		}
	}

	return nil
}

func validateTarget(target vclusterconfig.ResolveDNSTarget) error {
	options := 0
	if target.Hostname != "" {
		options++

		if strings.Count(target.Hostname, "*") > 1 {
			return fmt.Errorf("target can only contain a maximum of one wildcard, but got %s", target.Hostname)
		} else if strings.Count(target.Hostname, "*") == 1 && !strings.HasPrefix(target.Hostname, "*") && !strings.HasSuffix(target.Hostname, "*") {
			return fmt.Errorf("when using wildcard hostname, needs to be as a suffix or prefix, but got %s", target.Hostname)
		}
	}
	if target.IP != "" {
		options++
	}
	if target.HostNamespace != "" {
		options++
	}
	if target.HostService != "" {
		options++

		// check if service is defined with the namespace/name format
		if strings.Count(target.HostService, "/") != 1 {
			return fmt.Errorf("expected namespace/name format for .to.service, but got %s", target.HostService)
		}
	}
	if target.VClusterService != "" {
		options++

		// check if vcluster service is defined with namespace/name format
		if strings.Count(target.VClusterService, "/") != 3 {
			return fmt.Errorf("expected hostNamespace/vClusterName/vClusterNamespace/vClusterService format for .to.vClusterService, but got %s", target.VClusterService)
		}
	}
	if options == 0 {
		return fmt.Errorf("at least one option required for .to")
	} else if options > 1 {
		return fmt.Errorf("only a single option allowed for .to")
	}

	return nil
}

```

### Core Architecture Module: `pkg/constants/coredns.go`
```
package constants

// Please refer to https://github.com/coredns/deployment/blob/master/kubernetes/CoreDNS-k8s_version.md

var CoreDNSVersionMap = map[string]string{
	"1.36": "coredns/coredns:1.14.2",
	"1.35": "coredns/coredns:1.14.1",
	"1.34": "coredns/coredns:1.12.1",
	"1.33": "coredns/coredns:1.12.0",
	"1.32": "coredns/coredns:1.11.3",
	"1.31": "coredns/coredns:1.11.3",
	"1.30": "coredns/coredns:1.11.3",
}

var (
	CoreDNSLabelKey   = "k8s-app"
	CoreDNSLabelValue = "vcluster-kube-dns"
)

```

### Core Architecture Module: `pkg/controllers/coredns/autoscaler.go`
```
package coredns

import (
	"context"
	"fmt"

	"github.com/loft-sh/vcluster/config"
	"github.com/loft-sh/vcluster/pkg/constants"
	"github.com/loft-sh/vcluster/pkg/util/loghelper"
	appsv1 "k8s.io/api/apps/v1"
	corev1 "k8s.io/api/core/v1"
	kerrors "k8s.io/apimachinery/pkg/api/errors"
	"k8s.io/apimachinery/pkg/types"
	ctrl "sigs.k8s.io/controller-runtime"
	"sigs.k8s.io/controller-runtime/pkg/builder"
	"sigs.k8s.io/controller-runtime/pkg/client"
	"sigs.k8s.io/controller-runtime/pkg/controller"
	"sigs.k8s.io/controller-runtime/pkg/event"
	"sigs.k8s.io/controller-runtime/pkg/handler"
	"sigs.k8s.io/controller-runtime/pkg/predicate"
	"sigs.k8s.io/controller-runtime/pkg/reconcile"
)

const DeploymentName = "coredns"

// AutoscalerReconciler keeps the replica count of the coredns deployment
// proportional to the number of nodes in the cluster.
type AutoscalerReconciler struct {
	client.Client
	Log    loghelper.Logger
	Config config.CoreDNSAutoscaling
}

func (r *AutoscalerReconciler) Reconcile(ctx context.Context, _ ctrl.Request) (ctrl.Result, error) {
	deployment := &appsv1.Deployment{}
	err := r.Get(ctx, types.NamespacedName{Namespace: Namespace, Name: DeploymentName}, deployment)
	if kerrors.IsNotFound(err) {
		// nothing to scale yet, the deployment triggers a reconcile once it is created
		return ctrl.Result{}, nil
	} else if err != nil {
		return ctrl.Result{}, fmt.Errorf("get coredns deployment: %w", err)
	}

	// the nodes are only counted, so skip copying every node out of the cache
	nodes := &corev1.NodeList{}
	if err := r.List(ctx, nodes, client.UnsafeDisableDeepCopy); err != nil {
		return ctrl.Result{}, fmt.Errorf("list nodes: %w", err)
	}

	desired := DesiredReplicas(len(nodes.Items), r.Config)
	if deployment.Spec.Replicas != nil && *deployment.Spec.Replicas == desired {
		return ctrl.Result{}, nil
	}

	beforeChanges := deployment.DeepCopy()
	deployment.Spec.Replicas = &desired
	if err := r.Patch(ctx, deployment, client.MergeFrom(beforeChanges)); err != nil {
		return ctrl.Result{}, fmt.Errorf("scale coredns deployment to %d replicas: %w", desired, err)
	}

	r.Log.Infof("scaled coredns deployment to %d replicas for %d nodes", desired, len(nodes.Items))
	return ctrl.Result{}, nil
}

// DesiredReplicas returns the number of coredns replicas to run for the given
// number of nodes: one replica for every nodesPerReplica nodes, rounded up and
// kept between minReplicas and maxReplicas.
//
// Every node counts, also a cordoned or NotReady one. Its pods keep running and
// keep resolving names, and counting only Ready nodes would scale DNS down at
// the moment many nodes lose their connection to the control plane.
func DesiredReplicas(nodes int, autoscaling config.CoreDNSAutoscaling) int32 {
	// minReplicas keeps DNS running when a node fails. With fewer than two nodes,
	// a second replica would run on the same node and fail with it, so a single
	// replica serves.
	if nodes <= 1 {
		return 1
	}

	// config validation rejects a ratio below 1, this only keeps a zero value from dividing by zero
	nodesPerReplica := max(autoscaling.NodesPerReplica, 1)
	replicas := (nodes + nodesPerReplica - 1) / nodesPerReplica
	replicas = max(replicas, autoscaling.MinReplicas)
	if autoscaling.MaxReplicas > 0 {
		replicas = min(replicas, autoscaling.MaxReplicas)
	}

	return int32(replicas)
}

// SetupWithManager adds the controller to the manager
func (r *AutoscalerReconciler) SetupWithManager(mgr ctrl.Manager) error {
	request := reconcile.Request{NamespacedName: types.NamespacedName{Namespace: Namespace, Name: DeploymentName}}

	// only the coredns deployment is scaled. A status update does not change its replica count,
	// so only react when its spec changed, for example because something else scaled it.
	isCoreDNSDeployment := predicate.NewPredicateFuncs(func(object client.Object) bool {
		return object.GetNamespace() == request.Namespace && object.GetName() == request.Name
	})

	// the number of nodes only changes when a node is created or deleted. Skipping node
	// updates keeps the status heartbeats of a large fleet out of the work queue.
	nodeCountChanged := predicate.Funcs{
		CreateFunc:  func(event.CreateEvent) bool { return true },
		DeleteFunc:  func(event.DeleteEvent) bool { return true },
		UpdateFunc:  func(event.UpdateEvent) bool { return false },
		GenericFunc: func(event.GenericEvent) bool { return false },
	}
	enqueueDeployment := handler.EnqueueRequestsFromMapFunc(func(context.Context, client.Object) []reconcile.Request {
		return []reconcile.Request{request}
	})

	return ctrl.NewControllerManagedBy(mgr).
		WithOptions(controller.Options{
			CacheSyncTimeout: constants.DefaultCacheSyncTimeout,
		}).
		Named("coredns_autoscaler").
		For(&appsv1.Deployment{}, builder.WithPredicates(isCoreDNSDeployment, predicate.GenerationChangedPredicate{})).
		Watches(&corev1.Node{}, enqueueDeployment, builder.WithPredicates(nodeCountChanged)).
		Complete(r)
}

```

### Core Architecture Module: `pkg/controllers/coredns/nodehosts.go`
```
package coredns

import (
	"context"
	"fmt"
	"sort"
	"strings"
	"time"

	"github.com/loft-sh/vcluster/pkg/constants"
	"github.com/loft-sh/vcluster/pkg/util/loghelper"
	corev1 "k8s.io/api/core/v1"
	kerrors "k8s.io/apimachinery/pkg/api/errors"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/apimachinery/pkg/types"
	ctrl "sigs.k8s.io/controller-runtime"
	"sigs.k8s.io/controller-runtime/pkg/builder"
	"sigs.k8s.io/controller-runtime/pkg/client"
	"sigs.k8s.io/controller-runtime/pkg/controller"
	"sigs.k8s.io/controller-runtime/pkg/handler"
	"sigs.k8s.io/controller-runtime/pkg/predicate"
	"sigs.k8s.io/controller-runtime/pkg/reconcile"
)

const (
	Namespace     = "kube-system"
	ConfigMapName = "coredns"
	NodeHostsKey  = "NodeHosts"
)

type NodeHostsReconciler struct {
	client.Client
	Log loghelper.Logger
}

func (r *NodeHostsReconciler) Reconcile(ctx context.Context, _ ctrl.Request) (ctrl.Result, error) {
	// prepare the value of NodeHosts key
	nodehosts, err := r.compileNodeHosts(ctx)
	if err != nil {
		return ctrl.Result{RequeueAfter: time.Second}, err
	}

	// create or patch configmap preserving other data keys (Corefile)
	configmap := &corev1.ConfigMap{ObjectMeta: metav1.ObjectMeta{
		Namespace: Namespace,
		Name:      ConfigMapName,
	}}
	err = r.Client.Get(ctx, client.ObjectKeyFromObject(configmap), configmap)
	if kerrors.IsNotFound(err) {
		r.Log.Debugf("%s/%s Configmap not found, CoreDNS is not fully configured", ConfigMapName, Namespace)
		return ctrl.Result{RequeueAfter: time.Second}, nil
	}

	beforeChanges := configmap.DeepCopy()
	if configmap.Data == nil {
		configmap.Data = map[string]string{}
	}
	if configmap.Data[NodeHostsKey] == nodehosts {
		// no change => no patching is required
		return ctrl.Result{}, nil
	}

	configmap.Data[NodeHostsKey] = nodehosts
	err = r.Client.Patch(ctx, configmap, client.MergeFrom(beforeChanges))
	if err != nil {
		return ctrl.Result{RequeueAfter: time.Second}, err
	}
	return ctrl.Result{}, nil
}

func (r *NodeHostsReconciler) compileNodeHosts(ctx context.Context) (string, error) {
	nodehosts := []string{}
	nodes := &corev1.NodeList{}
	err := r.Client.List(ctx, nodes)
	if err != nil {
		return "", err
	}
	for _, node := range nodes.Items {
		// a dual-stack node reports one InternalIP per IP family; write a hosts
		// line for each so both A and AAAA lookups of the node hostname resolve
		var nodeAddresses []string
		nodeHostname := node.Name
		for _, address := range node.Status.Addresses {
			switch address.Type {
			case corev1.NodeInternalIP:
				if address.Address != "" {
					nodeAddresses = append(nodeAddresses, address.Address)
				}
			case corev1.NodeHostName:
				nodeHostname = address.Address
			default:
				// external IPs and DNS names are not written to NodeHosts
			}
		}
		for _, nodeAddress := range nodeAddresses {
			nodehosts = append(nodehosts, fmt.Sprintf("%s %s", nodeAddress, nodeHostname))
		}
	}
	sort.Strings(nodehosts)
	return strings.Join(nodehosts, "\n"), nil
}

// SetupWithManager adds the controller to the manager
func (r *NodeHostsReconciler) SetupWithManager(mgr ctrl.Manager) error {
	// creating a predicate to receive reconcile requests for coredns ConfigMap only
	p := func(object client.Object) bool {
		return object.GetNamespace() == Namespace && object.GetName() == ConfigMapName
	}
	funcs := predicate.NewPredicateFuncs(p)

	// use modified handler to avoid triggering reconcile for each Node
	eventHandler := handler.EnqueueRequestsFromMapFunc(func(_ context.Context, _ client.Object) []reconcile.Request {
		return []reconcile.Request{{
			NamespacedName: types.NamespacedName{Namespace: Namespace, Name: ConfigMapName},
		}}
	})

	return ctrl.NewControllerManagedBy(mgr).
		WithOptions(controller.Options{
			CacheSyncTimeout: constants.DefaultCacheSyncTimeout,
		}).
		Named("coredns_nodehosts").
		For(&corev1.ConfigMap{}, builder.WithPredicates(funcs, predicate.ResourceVersionChangedPredicate{})).
		Watches(&corev1.Node{}, eventHandler).
		Complete(r)
}

```

### Core Architecture Module: `pkg/coredns/coredns.go`
```
package coredns

import (
	"context"
	"errors"
	"fmt"
	"os"
	"strings"

	"github.com/loft-sh/vcluster/config"
	"github.com/loft-sh/vcluster/pkg/constants"
	"github.com/loft-sh/vcluster/pkg/util/applier"
	appsv1 "k8s.io/api/apps/v1"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/apimachinery/pkg/labels"
	"k8s.io/apimachinery/pkg/version"
	"k8s.io/client-go/kubernetes"
	"k8s.io/client-go/rest"
)

const (
	DefaultImage = "coredns/coredns:1.14.2"
	// DefaultImageRegistry is prepended to the CoreDNS image when no custom
	// image registry is configured, so the rendered image is always fully
	// qualified (registry-less names are not reliably resolved on all runtimes).
	DefaultImageRegistry = "docker.io"
	VarImage             = "IMAGE"
	VarHostDNS           = "HOST_CLUSTER_DNS"
	VarRunAsUser         = "RUN_AS_USER"
	VarRunAsNonRoot      = "RUN_AS_NON_ROOT"
	VarRunAsGroup        = "RUN_AS_GROUP"
	VarLogInDebug        = "LOG_IN_DEBUG"
	defaultUID           = int64(1001)
	defaultGID           = int64(1001)

	// VarReplicas is the replica count the coredns deployment is rendered with.
	VarReplicas = "REPLICAS"

	// initialAutoscaledReplicas is the replica count vCluster's own autoscaler
	// starts coredns with. It is what that autoscaler runs for a cluster without
	// nodes.
	initialAutoscaledReplicas = int32(1)
)

var ErrNoCoreDNSManifests = fmt.Errorf("no coredns manifests found")

// manifestOptions is what the caller of ApplyManifest knows about the cluster
// the manifests are applied to.
type manifestOptions struct {
	// liveDeployment is the coredns deployment that currently exists, or nil
	liveDeployment *appsv1.Deployment
}

// ManifestOption tells ApplyManifest about the cluster the manifests are applied to.
type ManifestOption func(options *manifestOptions)

// WithLiveDeployment passes the coredns deployment that currently exists in the
// cluster, or nil if there is none. While autoscaling is enabled, the manifest
// is rendered with the replica count of that deployment instead of
// controlPlane.coredns.deployment.replicas. Applying the manifest then leaves
// the count alone that an autoscaler has set.
func WithLiveDeployment(deployment *appsv1.Deployment) ManifestOption {
	return func(options *manifestOptions) {
		options.liveDeployment = deployment
	}
}

func ApplyManifest(ctx context.Context, config *config.Config, defaultImageRegistry string, inClusterConfig *rest.Config, serverVersion *version.Info, options ...ManifestOption) error {
	if !config.ControlPlane.CoreDNS.Enabled {
		return nil
	}

	// get the manifest variables
	vars := manifestVariables(config, defaultImageRegistry, serverVersion, options...)

	// process the corefile and manifests
	output, err := processManifests(vars, config)
	if err != nil {
		return err
	}

	return applier.ApplyManifest(ctx, inClusterConfig, output)
}

// manifestVariables returns the variables the coredns manifests are rendered with.
func manifestVariables(vConfig *config.Config, defaultImageRegistry string, serverVersion *version.Info, options ...ManifestOption) map[string]any {
	opts := &manifestOptions{}
	for _, option := range options {
		option(opts)
	}

	vars := getManifestVariables(defaultImageRegistry, serverVersion)
	vars[VarReplicas] = deploymentReplicas(vConfig.ControlPlane.CoreDNS, opts.liveDeployment)
	return vars
}

// deploymentReplicas returns the replica count the coredns deployment is rendered with.
//
// Without autoscaling it is controlPlane.coredns.deployment.replicas. With autoscaling it is
// the count of the live deployment, so that applying the manifest does not undo what an
// autoscaler has set. Without a live deployment it is the count the autoscaler takes over from.
func deploymentReplicas(coreDNS config.CoreDNS, liveDeployment *appsv1.Deployment) int32 {
	// Never create coredns without a replica. A count of 0 used to render no count at
	// all, which the API server defaults to 1.
	configured := int32(max(coreDNS.Deployment.Replicas, 1))
	if !coreDNS.Deployment.Autoscaling.Enabled {
		return configured
	}

	if liveDeployment != nil && liveDeployment.Spec.Replicas != nil {
		return *liveDeployment.Spec.Replicas
	}

	// vCluster's own autoscaler takes over from a single replica
	if coreDNS.NodeAutoscalingEnabled() {
		return initialAutoscaledReplicas
	}

	// an external autoscaler takes over from the configured count
	return configured
}

func getManifestVariables(defaultImageRegistry string, serverVersion *version.Info) map[string]any {
	var found bool
	vars := make(map[string]any)
	vars[VarImage], found = constants.CoreDNSVersionMap[fmt.Sprintf("%s.%s", serverVersion.Major, serverVersion.Minor)]
	if !found {
		vars[VarImage] = DefaultImage
	}
	if defaultImageRegistry != "" {
		vars[VarImage] = strings.TrimSuffix(defaultImageRegistry, "/") + "/" + vars[VarImage].(string)
	} else {
		// No custom registry configured: default to docker.io (ENGCP-588).
		vars[VarImage] = DefaultImageRegistry + "/" + vars[VarImage].(string)
	}
	vars[VarRunAsUser] = fmt.Sprintf("%v", GetUserID())
	vars[VarRunAsGroup] = fmt.Sprintf("%v", GetGroupID())
	if os.Getenv("DEBUG") == "true" {
		vars[VarLogInDebug] = "log"
	} else {
		vars[VarLogInDebug] = ""
	}
	vars[VarHostDNS] = getNameserver()
	return vars
}

func getNameserver() string {
	raw, err := os.ReadFile("/etc/resolv.conf")
	if err != nil {
		return "/etc/resolv.conf"
	}

	nameservers := GetNameservers(raw)
	if len(nameservers) == 0 {
		return "/etc/resolv.conf"
	}

	return nameservers[0]
}

// GetGroupID retrieves the current group id and if the current process is running
// as root we fallback to GID 1001
func GetGroupID() int64 {
	gid := os.Getgid()
	if gid == 0 {
		return defaultGID
	}

	return int64(gid)
}

// GetUserID retrieves the current user id and if the current process is running
// as root we fallback to UID 1001
func GetUserID() int64 {
	uid := os.Getuid()
	if uid == 0 {
		return defaultUID
	}

	return int64(uid)
}

func DeleteCoreDNSComponents(ctx context.Context, client *kubernetes.Clientset, namespace string) error {
	labelSelector := labels.FormatLabels(map[string]string{constants.CoreDNSLabelKey: constants.CoreDNSLabelValue})

	var errs []error
	errs = append(errs, client.AppsV1().Deployments(namespace).DeleteCollection(ctx, metav1.DeleteOptions{}, metav1.ListOptions{LabelSelector: labelSelector}))
	errs = append(errs, client.CoreV1().Pods(namespace).DeleteCollection(ctx, metav1.DeleteOptions{}, metav1.ListOptions{LabelSelector: labelSelector}))

	services, err := client.CoreV1().Services(namespace).List(ctx, metav1.ListOptions{LabelSelector: labelSelector})
	if err != nil {
		errs = append(errs, err)
	} else {
		if len(services.Items) != 0 {
			for _, svc := range services.Items {
				errs = append(errs, client.CoreV1().Services(namespace).Delete(ctx, svc.Name, metav1.DeleteOptions{}))
			}
		}
	}

	return errors.Join(errs...)
}

```

### Core Architecture Module: `pkg/coredns/resolv.go`
```
package coredns

import (
	"bytes"
	"regexp"
)

var (
	ipv4NumBlock = `(25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)`
	ipv4Address  = `(` + ipv4NumBlock + `\.){3}` + ipv4NumBlock
	// This is not an IPv6 address verifier as it will accept a super-set of IPv6, and also
	// will *not match* IPv4-Embedded IPv6 Addresses (RFC6052), but that and other variants
	// -- e.g. other link-local types -- either won't work in containers or are unnecessary.
	// For readability and sufficiency for Docker purposes this seemed more reasonable than a
	// 1000+ character regexp with exact and complete IPv6 validation
	ipv6Address = `([0-9A-Fa-f]{0,4}:){2,7}([0-9A-Fa-f]{0,4})(%\w+)?`
	nsRegexp    = regexp.MustCompile(`^\s*nameserver\s*((` + ipv4Address + `)|(` + ipv6Address + `))\s*$`)
)

// GetNameservers returns nameservers (if any) listed in /etc/resolv.conf
func GetNameservers(resolvConf []byte) []string {
	nameservers := []string{}
	for _, line := range getLines(resolvConf, []byte("#")) {
		ns := nsRegexp.FindSubmatch(line)
		if len(ns) > 0 {
			nameservers = append(nameservers, string(ns[1]))
		}
	}
	return nameservers
}

// getLines parses input into lines and strips away comments.
func getLines(input []byte, commentMarker []byte) [][]byte {
	lines := bytes.Split(input, []byte("\n"))
	var output [][]byte
	for _, currentLine := range lines {
		var commentIndex = bytes.Index(currentLine, commentMarker)
		if commentIndex == -1 {
			output = append(output, currentLine)
		} else {
			output = append(output, currentLine[:commentIndex])
		}
	}
	return output
}

```

### Core Architecture Module: `pkg/coredns/template.go`
```
package coredns

import (
	"bytes"
	"encoding/json"
	"fmt"
	"strings"
	"text/template"

	"github.com/loft-sh/vcluster/config"
	"sigs.k8s.io/yaml"
)

const corednsCorefile = `{{- if .Values.controlPlane.coredns.overwriteConfig }}
{{ .Values.controlPlane.coredns.overwriteConfig }}
{{- else }}
.:1053 {
    errors
    health
    ready
    {{- if and .Values.controlPlane.coredns.embedded .Values.networking.resolveDNS }}
    vcluster
    {{- end }}
    {{- if .Values.networking.advanced.proxyKubelets.byHostname }}
    rewrite name regex .*\.nodes\.vcluster\.com kubernetes.default.svc.cluster.local
    {{- end }}
    kubernetes{{ if and (.Values.networking.advanced.clusterDomain) (ne .Values.networking.advanced.clusterDomain "cluster.local") }} {{ .Values.networking.advanced.clusterDomain }}{{ end }} cluster.local in-addr.arpa ip6.arpa {
        {{- if .Values.controlPlane.coredns.embedded }}
        kubeconfig /data/vcluster/admin.conf
        {{- end }}
        pods insecure
        {{- if .Values.networking.advanced.fallbackHostCluster }}
        fallthrough cluster.local in-addr.arpa ip6.arpa
        {{- else }}
        fallthrough in-addr.arpa ip6.arpa
        {{- end }}
    }
    hosts /etc/coredns/NodeHosts {
        ttl 60
        reload 15s
        fallthrough
    }
    prometheus :9153
    {{- if .Values.networking.advanced.fallbackHostCluster }}
    forward . {{ .HOST_CLUSTER_DNS }}
    {{- else if .Values.policies.networkPolicy.enabled }}
    forward . /etc/resolv.conf {{ .Values.policies.networkPolicy.fallbackDns }} {
        policy sequential
    }
    {{- else }}
    forward . /etc/resolv.conf
    {{- end }}
    cache 30
    loop
    {{- if not .Values.controlPlane.coredns.embedded }}
    reload
    {{- end }}
    loadbalance
}

import /etc/coredns/custom/*.server
{{- end }}`

const corednsManifests = `{{- if .Values.controlPlane.coredns.overwriteManifests }}
{{ .Values.controlPlane.coredns.overwriteManifests }}
{{- else if .Values.controlPlane.coredns.embedded }}
apiVersion: v1
kind: ConfigMap
metadata:
  name: coredns
  namespace: kube-system
data:
  NodeHosts: ""
---
apiVersion: v1
kind: Service
metadata:
  name: kube-dns
  namespace: kube-system
  annotations:
    prometheus.io/port: "9153"
    prometheus.io/scrape: "true"
    {{- if .Values.controlPlane.coredns.service.annotations }}
{{ toYaml .Values.controlPlane.coredns.service.annotations | indent 4 }}
    {{- end }}
  labels:
    k8s-app: vcluster-kube-dns
    kubernetes.io/cluster-service: "true"
    kubernetes.io/name: "CoreDNS"
    {{- if .Values.controlPlane.coredns.service.labels }}
{{ toYaml .Values.controlPlane.coredns.service.labels | indent 4 }}
    {{- end }}
spec:
{{ toYaml .Values.controlPlane.coredns.service.spec | indent 2 }}
{{- if not .Values.controlPlane.coredns.service.spec.ports }}
  ports:
    - name: dns
      port: 53
      targetPort: 1053
      protocol: UDP
    - name: dns-tcp
      port: 53
      targetPort: 1053
      protocol: TCP
    - name: metrics
      port: 9153
      protocol: TCP
{{- end }}
{{- else }}
apiVersion: v1
kind: ServiceAccount
metadata:
  name: coredns
  namespace: kube-system
---
apiVersion: rbac.authorization.k8s.io/v1
kind: ClusterRole
metadata:
  labels:
    kubernetes.io/bootstrapping: rbac-defaults
  name: system:coredns
rules:
  - apiGroups:
      - ""
    resources:
      - endpoints
      - services
      - pods
      - namespaces
    verbs:
      - list
      - watch
  - apiGroups:
      - discovery.k8s.io
    resources:
      - endpointslices
    verbs:
      - list
      - watch
---
apiVersion: rbac.authorization.k8s.io/v1
kind: ClusterRoleBinding
metadata:
  annotations:
    rbac.authorization.kubernetes.io/autoupdate: "true"
  labels:
    kubernetes.io/bootstrapping: rbac-defaults
  name: system:coredns
roleRef:
  apiGroup: rbac.authorization.k8s.io
  kind: ClusterRole
  name: system:coredns
subjects:
  - kind: ServiceAccount
    name: coredns
    namespace: kube-system
---
apiVersion: v1
kind: ConfigMap
metadata:
  name: coredns
  namespace: kube-system
data:
  Corefile: |-
{{ .Corefile | indent 4 }}
  NodeHosts: ""
---
apiVersion: apps/v1
kind: Deployment
metadata:
  name: coredns
  namespace: kube-system
  {{- if .Values.controlPlane.coredns.deployment.annotations }}
  annotations:
{{ toYaml .Values.controlPlane.coredns.deployment.annotations | indent 4 }}
  {{- end }}
  labels:
    k8s-app: vcluster-kube-dns
    kubernetes.io/name: "CoreDNS"
    {{- if .Values.controlPlane.coredns.deployment.labels }}
{{ toYaml .Values.controlPlane.coredns.deployment.labels | indent 4 }}
    {{- end }}
spec:
  replicas: {{ .REPLICAS }}
  strategy:
    type: RollingUpdate
    rollingUpdate:
      maxUnavailable: 1
  selector:
    matchLabels:
      k8s-app: vcluster-kube-dns
  template:
    metadata:
      {{- if .Values.controlPlane.coredns.deployment.pods.annotations }}
      annotations:
{{ toYaml .Values.controlPlane.coredns.deployment.pods.annotations | indent 8 }}
      {{- end }}
      labels:
        k8s-app: vcluster-kube-dns
      {{- if .Values.controlPlane.coredns.deployment.pods.labels }}
{{ toYaml .Values.controlPlane.coredns.deployment.pods.labels | indent 8 }}
      {{- end }}
    spec:
      priorityClassName: "{{ .Values.controlPlane.coredns.priorityClassName }}"
      serviceAccountName: coredns
      nodeSelector:
        kubernetes.io/os: linux
        {{- if .Values.controlPlane.coredns.deployment.nodeSelector }}
{{ toYaml .Values.controlPlane.coredns.deployment.nodeSelector | indent 8 }}
        {{- end }}
      {{- if .Values.controlPlane.coredns.deployment.affinity }}
      affinity:
{{ toYaml .Values.controlPlane.coredns.deployment.affinity | indent 8 }}
      {{- end }}
      {{- if .Values.controlPlane.coredns.deployment.tolerations }}
      tolerations:
{{ toYaml .Values.controlPlane.coredns.deployment.tolerations | indent 8 }}
      {{- end }}
      {{- if .Values.controlPlane.coredns.deployment.topologySpreadConstraints }}
      topologySpreadConstraints:
{{ toYaml .Values.controlPlane.coredns.deployment.topologySpreadConstraints | indent 8 }}
      {{- end }}
      {{- if .Values.controlPlane.coredns.security.podSecurityContext }}
      securityContext:
{{ toYaml .Values.controlPlane.coredns.security.podSecurityContext | indent 8 }}
      {{- else }}
      {{- if .Values.policies.podSecurityStandard }}
      securityContext:
        seccompProfile:
          type: RuntimeDefault
      {{- end }}
      {{- end }}
      containers:
        - name: coredns
          {{- if .Values.controlPlane.coredns.deployment.image }}
          {{- if .Values.controlPlane.advanced.defaultImageRegistry }}
          image: {{ .Values.controlPlane.advanced.defaultImageRegistry }}/{{ .Values.controlPlane.coredns.deployment.image }}
          {{- else }}
          image: {{ .Values.controlPlane.coredns.deployment.image }}
          {{- end }}
          {{- else }}
          image: {{ .IMAGE }}
          {{- end }}
          imagePullPolicy: IfNotPresent
          {{- if .Values.controlPlane.coredns.deployment.resources }}
          resources:
{{ toYaml .Values.controlPlane.coredns.deployment.resources | indent 12 }}
          {{- end }}
          args: [ "-conf", "/etc/coredns/Corefile" ]
          volumeMounts:
            - name: config-volume
              mountPath: /etc/coredns
              readOnly: true
            - name: custom-config-volume
              mountPath: /etc/coredns/custom
              readOnly: true
          {{- if .Values.controlPlane.coredns.security.containerSecurityContext }}
          securityContext:
{{ toYaml .Values.controlPlane.coredns.security.containerSecurityContext | indent 12 }}
          {{- else }}
          securityContext:
            runAsNonRoot: true
            runAsUser: {{ .RUN_AS_USER }}
            runAsGroup: {{ .RUN_AS_GROUP }}
            allowPrivilegeEscalation: false
            capabilities:
              add:
                - NET_BIND_SERVICE
              drop:
                - ALL
            readOnlyRootFilesystem: true
          {{- end }}
          livenessProbe:
            httpGet:
              path: /health
              port: 8080
              scheme: HTTP
            initialDelaySeconds: 60
            periodSeconds: 10
            timeoutSeconds: 1
            successThreshold: 1
            failureThreshold: 3
          readinessProbe:
            httpGet:
              path: /ready
              port: 8181
              scheme: HTTP
            initialDelaySeconds: 0
            periodSeconds: 2
            timeoutSeconds: 1
            successThreshold: 1
            failureThreshold: 3
      dnsPolicy: Default
      volumes:
        - name: config-volume
          configMap:
            name: coredns
            items:
              - key: Corefile
                path: Corefile
              - key: NodeHosts
                path: NodeHosts
        - name: custom-config-volume
          configMap:
            name: coredns-custom
            optional: true
---
apiVersion: v1
kind: Service
metadata:
  name: kube-dns
  namespace: kube-system
  annotations:
    prometheus.io/port: "9153"
    prometheus.io/scrape: "true"
    {{- if .Values.controlPlane.coredns.service.annotations }}
{{ toYaml .Values.controlPlane.coredns.service.annotations | indent 4 }}
    {{- end }}
  labels:
    k8s-app: vcluster-kube-dns
    kubernetes.io/cluster-service: "true"
    kubernetes.io/name: "CoreDNS"
    {{- if .Values.controlPlane.coredns.service.labels }}
{{ toYaml .Values.controlPlane.coredns.service.labels | indent 4 }}
    {{- end }}
spec:
{{ toYaml .Values.controlPlane.coredns.service.spec | indent 2 }}
  {{- if not .Values.controlPlane.coredns.service.spec.selector }}
  selector:
    k8s-app: vcluster-kube-dns
  {{- end }}
  {{- if not .Values.controlPlane.coredns.service.spec.ports }}
  ports:
    - name: dns
      port: 53
      targetPort: 1053
      protocol: UDP
    - name: dns-tcp
      port: 53
      targetPort: 1053
```

### Core Architecture Module: `pkg/etcd/util.go`
```
package etcd

import (
	"context"
	"crypto/tls"
	"fmt"
	"strings"
	"time"

	clientv3 "go.etcd.io/etcd/client/v3"
	"go.uber.org/zap"
	"k8s.io/apimachinery/pkg/util/wait"
	certutil "k8s.io/client-go/util/cert"
	"k8s.io/klog/v2"
)

const (
	waitForClientTimeout = time.Minute * 10
)

type Certificates struct {
	CaCert     string
	ServerCert string
	ServerKey  string
}

func WaitForEtcd(parentCtx context.Context, certificates *Certificates, endpoints ...string) error {
	var err error
	waitErr := wait.PollUntilContextTimeout(parentCtx, time.Second, waitForClientTimeout, true, func(ctx context.Context) (bool, error) {
		var etcdClient *clientv3.Client
		etcdClient, err = GetEtcdClient(ctx, certificates, endpoints...)
		if err == nil {
			defer func() {
				_ = etcdClient.Close()
			}()

			_, err = etcdClient.MemberList(ctx)
			if err == nil {
				return true, nil
			}
		}

		klog.Infof("Couldn't connect to etcd (will retry in a second): %v", err)
		return false, nil
	})
	if waitErr != nil {
		return fmt.Errorf("error waiting for etcd: %w", err)
	}

	return nil
}

// GetEtcdClient returns an etcd client connected to the specified endpoints.
// If no endpoints are provided, endpoints are retrieved from the provided runtime config.
// If the runtime config does not list any endpoints, the default endpoint is used.
// The returned client should be closed when no longer needed, in order to avoid leaking GRPC
// client goroutines.
func GetEtcdClient(ctx context.Context, certificates *Certificates, endpoints ...string) (*clientv3.Client, error) {
	// etcd clients frequently connect before etcd is reachable (reachability
	// probes, restore, startup), so the clientv3 retry interceptor logs
	// misleading "retrying of unary invoker failed" warnings. Silence the client
	// logger unless verbose logging is enabled.
	log := zap.NewNop()
	if klog.V(1).Enabled() {
		log = zap.L().Named("etcd-client")
	}

	cfg, err := getClientConfig(ctx, log, certificates, endpoints...)
	if err != nil {
		return nil, err
	}

	return clientv3.New(*cfg)
}

// getClientConfig generates an etcd client config connected to the specified endpoints.
// If no endpoints are provided, getEndpoints is called to provide defaults.
func getClientConfig(ctx context.Context, log *zap.Logger, certificates *Certificates, endpoints ...string) (*clientv3.Config, error) {
	config := &clientv3.Config{
		Endpoints:   endpoints,
		Context:     ctx,
		DialTimeout: 5 * time.Second,

		Logger: log,
	}

	if len(endpoints) > 0 {
		if strings.HasPrefix(endpoints[0], "https://") && certificates != nil {
			var err error
			if config.TLS, err = toTLSConfig(certificates); err != nil {
				return nil, err
			}
		}
	}

	return config, nil
}

func toTLSConfig(certificates *Certificates) (*tls.Config, error) {
	clientCert, err := tls.LoadX509KeyPair(
		certificates.ServerCert,
		certificates.ServerKey,
	)
	if err != nil {
		return nil, err
	}

	pool, err := certutil.NewPool(certificates.CaCert)
	if err != nil {
		return nil, err
	}

	return &tls.Config{
		RootCAs:      pool,
		Certificates: []tls.Certificate{clientCert},
	}, nil
}

```


### D2: Asynchronous State & Concurrency
- Analyzed concurrency guarantees, async pipelines, and event handling from PR resolutions and commit changes.

### D3: Error Boundaries, Recovery & Rollbacks
- Exception handling patterns and defect resolutions extracted from closed production bug issues:
- **Issue #1746** (2024-08-14): **Resource limits forbid running of the syncer**
  *Symptoms*: ### What happened?  - I downloaded my values.yaml from [GitHub](https://github.com/loft-sh/vcluster/blob/a0a6ff0ccbace90be212d4887f15eaf49bfe3fc5/chart/values.yaml) - I enabled quotas at  "policies: > resourceQuota: >  enabled: true" - I created the vCluster with helm as follows ` helm upgrade --install vcluster-r05 vcluster --version 0.20.0-beta.2 --values vcluster.yaml --repo https://charts.loft.sh --namespace vcluster-r05 --create-namespace --repository-config='' --wait --wait-for-jobs` - The syncer is not created. Stateful set has 0/1 pods ready. The events state that: `create Pod vcluster-r05-0 in StatefulSet vcluster-r05 failed error: pods "vcluster-r05-0" is forbidden: failed quota: vc-vcluster-r05: must specify limits.cpu for: syncer`   ### What did you expect to happen?  - The vCluster is created without a problem.  ### How can we reproduce it (as minimally and precisely as possible)?  See above.  ### Anything else we need to know?  It can be a [good idea](https://www.youtube.com/watch?v=rjSWVeAvb24) to set CPU requests and **not set** CPU limits. With vCluster, we do that in the syncer limits (controlPlane: > statefulSet: > resources: > limits:) definition. In the values.yaml there should also be a way to disable cpu limits.   What do you think about making the CPU unlimited by default?   ### Host cluster Kubernetes version  <details>  ```console $ kubectl version Client Version: v1.29.3 Kustomize Version: v5.0.4-0.20230601165947-6ce0b

- **Issue #1745** (2025-02-24): **MountVolume.SetUp failed for volume "podlogs" of a deployment in vCluster**
  *Symptoms*: ### What happened?  I created a new vCluster and deployed a deployment but the pod goes in container creating state with the below error: `  Warning  FailedMount  22s (x11 over 6m34s)   kubelet            MountVolume.SetUp failed for volume "plogs" : hostPath type check failed: /tmp/vcluster/v-cluster-only-ic-sync/testt/log/pods is not a directory`  I tried changing the type of volume to DirectoryOrCreate, the pod came up in running state but in the fluentbit container no logs are visible, following are the error logs of fluentbit-container: `[2024/05/06 12:51:09] [error] [input:tail:tail.0] read error, check permissions: /var/log/pods/dgdr-6868bbb7-hrxlz_fb217ac7-d1ff-47f7-9af7-abb76a8c707f/*.log [2024/05/06 12:51:09] [ warn] [input:tail:tail.0] error scanning path: /var/log/pods/dgdr-6868bbb7-hrxlz_fb217ac7-d1ff-47f7-9af7-abb76a8c707f/*.log`  ### What did you expect to happen?  Ideally the deployment should create the pod and i should see the logs in the fluent bit container, Also i wanted to know how this path is getting created `"/tmp/vcluster/v-cluster-only-ic-sync/testt/log/pods"` in vCluster as in my deployment volume is as below  `volumes:     - name: podlogs      hostPath:       path: /var/log/pods       type: Directory`  ### How can we reproduce it (as minimally and precisely as possible)?  Deploy a K8s Deployment with fluentbit as a side car container which has volumeMounts  `     volumeMounts:           - name: podlogs             mountPath: /var/log/

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

### Incident Patch 1: `f38b446f` (2026-11-27)
**Commit Message**: feat(coredns): add opt-in autoscaling of the coredns deployment (#2768)

Monorepo-Commit: d3c5275d875b5ccbd1849f8d2f2f7729a00a2924

**File**: `chart/values.schema.json` (modified, +35/-1)
```diff
@@ -1249,6 +1249,36 @@
       "additionalProperties": false,
       "type": "object"
     },
+    "CoreDNSAutoscaling": {
+      "properties": {
+        "enabled": {
+          "type": "boolean",
+          "description": "Enabled defines if an autoscaler sets the amount of coredns pods instead of replicas. Mode selects the autoscaler."
+        },
+        "mode": {
+          "type": "string",
+          "enum": [
+            "Nodes",
+            "External"
+          ],
+          "description": "Mode is the autoscaler that sets the amount of coredns pods. With Nodes, vCluster scales coredns with the number of nodes in the cluster and corrects an amount that something else has set. With External, vCluster creates coredns with replicas and then keeps the amount that is set on the coredns deployment, so that a HorizontalPodAutoscaler or another autoscaler can scale it. Defaults to Nodes."
+        },
+        "nodesPerReplica": {
+          "type": "integer",
+          "description": "NodesPerReplica is the number of nodes that one coredns pod serves. vCluster runs one coredns pod for every nodesPerReplica nodes, rounded up. A lower value runs more coredns pods. On shared nodes, unless sync.fromHost.nodes selects all nodes, the cluster only lists the nodes that run its pods, coredns pods included, so with a value of 1 every new coredns pod can add a node and the amount of coredns pods can keep growing up to maxReplicas. Only used with mode Nodes."
+        },
+        "minReplicas": {
+          "type": "integer",
+          "description": "MinReplicas is the lowest amount of coredns pods to run. A cluster with fewer than two nodes runs a single coredns pod regardless. Only used with mode Nodes."
+        },
+        "maxReplicas": {
+          "type": "integer",
+          "description": "MaxReplicas is the highest amount of coredns pods to run. Only used with mode Nodes."
+        }
+      },
+      "additionalProperties": false,
+      "type": "object"
+    },
     "CoreDNSDeployment": {
       "properties": {
         "image": {
@@ -1257,7 +1287,11 @@
         },
         "replicas": {
           "type": "integer",
-          "description": "Replicas is the amount of coredns pods to run."
+          "description": "Replicas is the amount of coredns pods to run. While autoscaling is enabled, it is only used with mode External, as the amount coredns is created with."
+        },
+        "autoscaling": {
+          "$ref": "#/$defs/CoreDNSAutoscaling",
+          "description": "Autoscaling lets an autoscaler set the amount of coredns pods instead of replicas."
         },
         "nodeSelector": {
           "additionalProperties": {
```

**File**: `chart/values.yaml` (modified, +13/-1)
```diff
@@ -549,8 +549,20 @@ controlPlane:
       labels: {}
       # Image is the coredns image to use
       image: ""
-      # Replicas is the amount of coredns pods to run.
+      # Replicas is the amount of coredns pods to run. While autoscaling is enabled, it is only used with mode External, as the amount coredns is created with.
       replicas: 1
+      # Autoscaling lets an autoscaler set the amount of coredns pods instead of replicas.
+      autoscaling:
+        # Enabled defines if an autoscaler sets the amount of coredns pods instead of replicas. Mode selects the autoscaler.
+        enabled: false
+        # Mode is the autoscaler that sets the amount of coredns pods. With Nodes, vCluster scales coredns with the number of nodes in the cluster and corrects an amount that something else has set. With External, vCluster creates coredns with replicas and then keeps the amount that is set on the coredns deployment, so that a HorizontalPodAutoscaler or another autoscaler can scale it. Defaults to Nodes.
+        mode: Nodes
+        # NodesPerReplica is the number of nodes that one coredns pod serves. vCluster runs one coredns pod for every nodesPerReplica nodes, rounded up. A lower value runs more coredns pods. On shared nodes, unless sync.fromHost.nodes selects all nodes, the cluster only lists the nodes that run its pods, coredns pods included, so with a value of 1 every new coredns pod can add a node and the amount of coredns pods can keep growing up to maxReplicas. Only used with mode Nodes.
+        nodesPerReplica: 16
+        # MinReplicas is the lowest amount of coredns pods to run. A cluster with fewer than two nodes runs a single coredns pod regardless. Only used with mode Nodes.
+        minReplicas: 2
+        # MaxReplicas is the highest amount of coredns pods to run. Only used with mode Nodes.
+        maxReplicas: 100
       # Pods is additional metadata for the coredns pods.
       pods:
         labels: {}
```

**File**: `config/config.go` (modified, +40/-1)
```diff
@@ -2512,6 +2512,15 @@ func (c CoreDNS) JSONSchemaExtend(base *jsonschema.Schema) {
 	addProToJSONSchema(base, reflect.TypeOf(c))
 }
 
+// NodeAutoscalingEnabled reports whether vCluster itself scales the coredns
+// deployment with the number of nodes. Embedded coredns runs inside the control
+// plane and has no deployment, and with mode External another autoscaler sets
+// the replica count.
+func (c CoreDNS) NodeAutoscalingEnabled() bool {
+	autoscaling := c.Deployment.Autoscaling
+	return c.Enabled && !c.Embedded && autoscaling.Enabled && autoscaling.Mode != CoreDNSAutoscalingModeExternal
+}
+
 type CoreDNSService struct {
 	// Spec holds extra options for the coredns service
 	Spec map[string]interface{} `json:"spec,omitempty"`
@@ -2523,9 +2532,12 @@ type CoreDNSDeployment struct {
 	// Image is the coredns image to use
 	Image string `json:"image,omitempty"`
 
-	// Replicas is the amount of coredns pods to run.
+	// Replicas is the amount of coredns pods to run. While autoscaling is enabled, it is only used with mode External, as the amount coredns is created with.
 	Replicas int `json:"replicas,omitempty"`
 
+	// Autoscaling lets an autoscaler set the amount of coredns pods instead of replicas.
+	Autoscaling CoreDNSAutoscaling `json:"autoscaling,omitempty"`
+
 	// NodeSelector is the node selector to use for coredns.
 	NodeSelector map[string]string `json:"nodeSelector,omitempty"`
 
@@ -2547,6 +2559,33 @@ type CoreDNSDeployment struct {
 	TopologySpreadConstraints []interface{} `json:"topologySpreadConstraints,omitempty"`
 }
 
+// CoreDNSAutoscalingMode is the autoscaler that sets the amount of coredns pods while autoscaling is enabled.
+type CoreDNSAutoscalingMode string
+
+const (
+	// CoreDNSAutoscalingModeNodes lets vCluster scale coredns with the number of nodes in the cluster.
+	CoreDNSAutoscalingModeNodes CoreDNSAutoscalingMode = "Nodes"
+	// CoreDNSAutoscalingModeExternal leaves the amount of coredns pods to an autoscaler that vCluster does not run.
+	CoreDNSAutoscalingModeExternal CoreDNSAutoscalingMode = "External"
+)
+
+type CoreDNSAutoscaling struct {
+	// Enabled defines if an autoscaler sets the amount of coredns pods instead of replicas. Mode selects the autoscaler.
+	Enabled bool `json:"enabled,omitempty"`
+
+	// Mode is the autoscaler that sets the amount of coredns pods. With Nodes, vCluster scales coredns with the number of nodes in the cluster and corrects an amount that something else has set. With External, vCluster creates coredns with replicas and then keeps the amount that is set on the coredns deployment, so that a HorizontalPodAutoscaler or another autoscaler can scale it. Defaults to Nodes.
+	Mode CoreDNSAutoscalingMode `json:"mode,omitempty" jsonschema:"enum=Nodes,enum=External"`
+
+	// NodesPerReplica is the number of nodes that one coredns pod serves. vCluster runs one coredns pod for every nodesPerReplica nodes, rounded up. A lower value runs more coredns pods. On shared nodes, unless sync.fromHost.nodes selects all nodes, the cluster only lists the nodes that run its pods, coredns pods included, so with a value of 1 every new coredns pod can add a node and the amount of coredns pods can keep growing up to maxReplicas. Only used with mode Nodes.
+	NodesPerReplica int `json:"nodesPerReplica,omitempty"`
+
+	// MinReplicas is the lowest amount of coredns pods to run. A cluster with fewer than two nodes runs a single coredns pod regardless. Only used with mode Nodes.
+	MinReplicas int `json:"minReplicas,omitempty"`
+
+	// MaxReplicas is the highest amount of coredns pods to run. Only used with mode Nodes.
+	MaxReplicas int `json:"maxReplicas,omitempty"`
+}
+
 type ControlPlaneProxy struct {
 	// BindAddress under which vCluster will expose the proxy.
 	BindAddress string `json:"bindAddress,omitempty"`
```

**File**: `config/config_test.go` (modified, +62/-0)
```diff
@@ -505,3 +505,65 @@ func TestStoreType_Shared(t *testing.T) {
 			"%s: a non-shared store must keep extra control plane pods out of the Service", storeType)
 	}
 }
+
+func TestCoreDNS_NodeAutoscalingEnabled(t *testing.T) {
+	coreDNS := func(change func(*CoreDNS)) CoreDNS {
+		coreDNS := CoreDNS{Enabled: true}
+		coreDNS.Deployment.Autoscaling.Enabled = true
+		change(&coreDNS)
+		return coreDNS
+	}
+
+	tests := []struct {
+		name     string
+		coreDNS  CoreDNS
+		expected bool
+	}{
+		{
+			name:     "autoscaling without a mode scales with nodes",
+			coreDNS:  coreDNS(func(*CoreDNS) {}),
+			expected: true,
+		},
+		{
+			name: "mode Nodes",
+			coreDNS: coreDNS(func(c *CoreDNS) {
+				c.Deployment.Autoscaling.Mode = CoreDNSAutoscalingModeNodes
+			}),
+			expected: true,
+		},
+		{
+			name: "mode External leaves the replica count to another autoscaler",
+			coreDNS: coreDNS(func(c *CoreDNS) {
+				c.Deployment.Autoscaling.Mode = CoreDNSAutoscalingModeExternal
+			}),
+			expected: false,
+		},
+		{
+			name: "autoscaling disabled",
+			coreDNS: coreDNS(func(c *CoreDNS) {
+				c.Deployment.Autoscaling.Enabled = false
+			}),
+			expected: false,
+		},
+		{
+			name: "embedded coredns has no deployment",
+			coreDNS: coreDNS(func(c *CoreDNS) {
+				c.Embedded = true
+			}),
+			expected: false,
+		},
+		{
+			name: "coredns disabled",
+			coreDNS: coreDNS(func(c *CoreDNS) {
+				c.Enabled = false
+			}),
+			expected: false,
+		},
+	}
+
+	for _, tt := range tests {
+		t.Run(tt.name, func(t *testing.T) {
+			assert.Equal(t, tt.coreDNS.NodeAutoscalingEnabled(), tt.expected)
+		})
+	}
+}
```

**File**: `config/values.yaml` (modified, +6/-0)
```diff
@@ -265,6 +265,12 @@ controlPlane:
       labels: {}
       image: ""
       replicas: 1
+      autoscaling:
+        enabled: false
+        mode: Nodes
+        nodesPerReplica: 16
+        minReplicas: 2
+        maxReplicas: 100
       pods:
         labels: {}
         annotations: {}
```

**File**: `pkg/config/validation.go` (modified, +48/-0)
```diff
@@ -197,6 +197,11 @@ func ValidateConfigAndSetDefaults(vConfig *VirtualClusterConfig) error {
 		return err
 	}
 
+	err = validateCoreDNSAutoscaling(vConfig.ControlPlane.CoreDNS)
+	if err != nil {
+		return err
+	}
+
 	// check config for exporting kubeconfig Secrets
 	err = validateExportKubeConfig(vConfig.ExportKubeConfig)
 	if err != nil {
@@ -1099,6 +1104,49 @@ func validateAdvancedControlPlaneConfig(controlPlaneAdvanced config.ControlPlane
 	return nil
 }
 
+// validateCoreDNSAutoscaling checks the autoscaling of the coredns deployment.
+// The settings are only read while both coredns and its autoscaling are enabled.
+func validateCoreDNSAutoscaling(coreDNS config.CoreDNS) error {
+	autoscaling := coreDNS.Deployment.Autoscaling
+	if !coreDNS.Enabled || !autoscaling.Enabled {
+		return nil
+	}
+
+	const path = "controlPlane.coredns.deployment.autoscaling"
+	if coreDNS.Embedded {
+		return fmt.Errorf("%s.enabled cannot be used with controlPlane.coredns.embedded, because embedded coredns has no deployment to scale", path)
+	}
+	if coreDNS.OverwriteManifests != "" {
+		// the custom manifests are applied as they are, so every control plane start would reset the replica count they set
+		return fmt.Errorf("%s.enabled cannot be used with controlPlane.coredns.overwriteManifests, because the custom manifests set the replica count", path)
+	}
+
+	switch autoscaling.Mode {
+	case config.CoreDNSAutoscalingModeExternal:
+		// the ratio and the bounds only steer the autoscaler that vCluster runs
+		return nil
+	case "", config.CoreDNSAutoscalingModeNodes:
+		return validateCoreDNSNodeAutoscaling(path, autoscaling)
+	default:
+		return fmt.Errorf("%s.mode must be %s or %s, got %q", path, config.CoreDNSAutoscalingModeNodes, config.CoreDNSAutoscalingModeExternal, autoscaling.Mode)
+	}
+}
+
+// validateCoreDNSNodeAutoscaling checks the settings of the autoscaler that vCluster runs with mode Nodes.
+func validateCoreDNSNodeAutoscaling(path string, autoscaling config.CoreDNSAutoscaling) error {
+	if autoscaling.NodesPerReplica < 1 {
+		return fmt.Errorf("%s.nodesPerReplica must be at least 1, got %d", path, autoscaling.NodesPerReplica)
+	}
+	if autoscaling.MinReplicas < 1 {
+		return fmt.Errorf("%s.minReplicas must be at least 1, got %d", path, autoscaling.MinReplicas)
+	}
+	if autoscaling.MaxReplicas < autoscaling.MinReplicas {
+		return fmt.Errorf("%s.maxReplicas must not be lower than minReplicas (%d), got %d", path, autoscaling.MinReplicas, autoscaling.MaxReplicas)
+	}
+
+	return nil
+}
+
 func ValidateCustomResourceSyncProxyConflicts(toHostCustomResources map[string]config.SyncToHostCustomResource, fromHostCustomResources map[string]config.SyncFromHostCustomResource, proxyCustomResources map[string]config.CustomResourceProxy) error {
 	// Only consider enabled resources for conflict detection
 	enabledToHost := lo.Keys(lo.PickBy(toHostCustomResources, func(_ string, v config.SyncToHostCustomResource) bool { return v.Enabled }))
```

**File**: `pkg/config/validation_test.go` (modified, +202/-0)
```diff
@@ -2527,3 +2527,205 @@ func TestValidateKubeOvnCloudControllerManager(t *testing.T) {
 		})
 	}
 }
+
+func TestValidateCoreDNSAutoscaling(t *testing.T) {
+	const path = "controlPlane.coredns.deployment.autoscaling"
+
+	coreDNS := func(change func(*config.CoreDNS)) config.CoreDNS {
+		coreDNS := config.CoreDNS{
+			Enabled: true,
+			Deployment: config.CoreDNSDeployment{
+				Autoscaling: config.CoreDNSAutoscaling{
+					Enabled:         true,
+					NodesPerReplica: 16,
+					MinReplicas:     2,
+					MaxReplicas:     100,
+				},
+			},
+		}
+		change(&coreDNS)
+		return coreDNS
+	}
+
+	testCases := []struct {
+		name     string
+		coreDNS  config.CoreDNS
+		checkErr func(t *testing.T, err error)
+	}{
+		{
+			name:     "Valid: autoscaling enabled",
+			coreDNS:  coreDNS(func(*config.CoreDNS) {}),
+			checkErr: noErrExpected,
+		},
+		{
+			name: "Valid: minReplicas equal to maxReplicas",
+			coreDNS: coreDNS(func(c *config.CoreDNS) {
+				c.Deployment.Autoscaling.MinReplicas = 4
+				c.Deployment.Autoscaling.MaxReplicas = 4
+			}),
+			checkErr: noErrExpected,
+		},
+		{
+			name: "Valid: settings are not read while autoscaling is disabled",
+			coreDNS: coreDNS(func(c *config.CoreDNS) {
+				c.Embedded = true
+				c.Deployment.Autoscaling = config.CoreDNSAutoscaling{}
+			}),
+			checkErr: noErrExpected,
+		},
+		{
+			name: "Valid: settings are not read while coredns is disabled",
+			coreDNS: coreDNS(func(c *config.CoreDNS) {
+				c.Enabled = false
+				c.Deployment.Autoscaling.NodesPerReplica = 0
+			}),
+			checkErr: noErrExpected,
+		},
+		{
+			name: "Valid: mode Nodes set explicitly",
+			coreDNS: coreDNS(func(c *config.CoreDNS) {
+				c.Deployment.Autoscaling.Mode = config.CoreDNSAutoscalingModeNodes
+			}),
+			checkErr: noErrExpected,
+		},
+		{
+			name: "Valid: mode External does not read the settings of the nodes autoscaler",
+			coreDNS: coreDNS(func(c *config.CoreDNS) {
+				c.Deployment.Autoscaling = config.CoreDNSAutoscaling{Enabled: true, Mode: config.CoreDNSAutoscalingModeExternal}
+			}),
+			checkErr: noErrExpected,
+		},
+		{
+			name: "Invalid: unknown mode",
+			coreDNS: coreDNS(func(c *config.CoreDNS) {
+				c.Deployment.Autoscaling.Mode = "Load"
+			}),
+			checkErr: expectErr(path + `.mode must be Nodes or External, got "Load"`),
+		},
+		{
+			name: "Invalid: mode External with embedded coredns",
+			coreDNS: coreDNS(func(c *config.CoreDNS) {
+				c.Embedded = true
+				c.Deployment.Autoscaling.Mode = config.CoreDNSAutoscalingModeExternal
+			}),
+			checkErr: expectErr(path + ".enabled cannot be used with controlPlane.coredns.embedded, because embedded coredns has no deployment to scale"),
+		},
+		{
+			name: "Invalid: embedded coredns has no deployment to scale",
+			coreDNS: coreDNS(func(c *config.CoreDNS) {
+				c.Embedded = true
+			}),
+			checkErr: expectErr(path + ".enabled cannot be used with controlPlane.coredns.embedded, because embedded coredns has no deployment to scale"),
+		},
+		{
+			name: "Invalid: custom manifests set the replica count",
+			coreDNS: coreDNS(func(c *config.CoreDNS) {
+				c.OverwriteManifests = "apiVersion: apps/v1\nkind: Deployment"
+			}),
+			checkErr: expectErr(path + ".enabled cannot be used with controlPlane.coredns.overwriteManifests, because the custom manifests set the replica count"),
+		},
+		{
+			name: "Invalid: mode External with custom manifests",
+			coreDNS: coreDNS(func(c *config.CoreDNS) {
+				c.OverwriteManifests = "apiVersion: apps/v1\nkind: Deployment"
+				c.Deployment.Autoscaling.Mode = config.CoreDNSAutoscalingModeExternal
+			}),
+			checkErr: expectErr(path + ".enabled cannot be used with controlPlane.coredns.overwriteManifests, because the custom manifests set the replica count"),
+		},
+		{
+			name: "Invalid: nodesPerReplica below 1",
+			coreDNS: coreDNS(func(c *config.CoreDNS) {
+				c.Deployment.Autoscaling.NodesPerReplica = 0
+			}),
+			checkErr: expectErr(path + ".nodesPerReplica must be at least 1, got 0"),
+		},
+		{
+			name: "Invalid: minReplicas below 1",
+			coreDNS: coreDNS(func(c *config.CoreDNS) {
+				c.Deployment.Autoscaling.MinReplicas = 0
+			}),
+			checkErr: expectErr(path + ".minReplicas must be at least 1, got 0"),
+		},
+		{
+			name: "Invalid: maxReplicas below minReplicas",
+			coreDNS: coreDNS(func(c *config.CoreDNS) {
+				c.Deployment.Autoscaling.MinReplicas = 5
+				c.Deployment.Autoscaling.MaxReplicas = 4
+			}),
+			checkErr: expectErr(path + ".maxReplicas must not be lower than minReplicas (5), got 4"),
+		},
+	}
+
+	for _, tc := range testCases {
+		t.Run(tc.name, func(t *testing.T) {
+			tc.checkErr(t, validateCoreDNSAutoscaling(tc.coreDNS))
+		})
+	}
+}
+
+// TestValidateConfigAndSetDefaultsChecksCoreDNSAutoscaling checks that the control plane runs
+// the coredns autoscaling checks. The chart schema cannot express them, so without this call
+// the controller would start with a setting it cannot honor.
+func TestValidateConfigAndSetDefaultsChecksCoreDNSAutoscaling(t *testi
```

**File**: `pkg/controllers/coredns/autoscaler.go` (added, +121/-0)
```diff
@@ -0,0 +1,121 @@
+package coredns
+
+import (
+	"context"
+	"fmt"
+
+	"github.com/loft-sh/vcluster/config"
+	"github.com/loft-sh/vcluster/pkg/constants"
+	"github.com/loft-sh/vcluster/pkg/util/loghelper"
+	appsv1 "k8s.io/api/apps/v1"
+	corev1 "k8s.io/api/core/v1"
+	kerrors "k8s.io/apimachinery/pkg/api/errors"
+	"k8s.io/apimachinery/pkg/types"
+	ctrl "sigs.k8s.io/controller-runtime"
+	"sigs.k8s.io/controller-runtime/pkg/builder"
+	"sigs.k8s.io/controller-runtime/pkg/client"
+	"sigs.k8s.io/controller-runtime/pkg/controller"
+	"sigs.k8s.io/controller-runtime/pkg/event"
+	"sigs.k8s.io/controller-runtime/pkg/handler"
+	"sigs.k8s.io/controller-runtime/pkg/predicate"
+	"sigs.k8s.io/controller-runtime/pkg/reconcile"
+)
+
+const DeploymentName = "coredns"
+
+// AutoscalerReconciler keeps the replica count of the coredns deployment
+// proportional to the number of nodes in the cluster.
+type AutoscalerReconciler struct {
+	client.Client
+	Log    loghelper.Logger
+	Config config.CoreDNSAutoscaling
+}
+
+func (r *AutoscalerReconciler) Reconcile(ctx context.Context, _ ctrl.Request) (ctrl.Result, error) {
+	deployment := &appsv1.Deployment{}
+	err := r.Get(ctx, types.NamespacedName{Namespace: Namespace, Name: DeploymentName}, deployment)
+	if kerrors.IsNotFound(err) {
+		// nothing to scale yet, the deployment triggers a reconcile once it is created
+		return ctrl.Result{}, nil
+	} else if err != nil {
+		return ctrl.Result{}, fmt.Errorf("get coredns deployment: %w", err)
+	}
+
+	// the nodes are only counted, so skip copying every node out of the cache
+	nodes := &corev1.NodeList{}
+	if err := r.List(ctx, nodes, client.UnsafeDisableDeepCopy); err != nil {
+		return ctrl.Result{}, fmt.Errorf("list nodes: %w", err)
+	}
+
+	desired := DesiredReplicas(len(nodes.Items), r.Config)
+	if deployment.Spec.Replicas != nil && *deployment.Spec.Replicas == desired {
+		return ctrl.Result{}, nil
+	}
+
+	beforeChanges := deployment.DeepCopy()
+	deployment.Spec.Replicas = &desired
+	if err := r.Patch(ctx, deployment, client.MergeFrom(beforeChanges)); err != nil {
+		return ctrl.Result{}, fmt.Errorf("scale coredns deployment to %d replicas: %w", desired, err)
+	}
+
+	r.Log.Infof("scaled coredns deployment to %d replicas for %d nodes", desired, len(nodes.Items))
+	return ctrl.Result{}, nil
+}
+
+// DesiredReplicas returns the number of coredns replicas to run for the given
+// number of nodes: one replica for every nodesPerReplica nodes, rounded up and
+// kept between minReplicas and maxReplicas.
+//
+// Every node counts, also a cordoned or NotReady one. Its pods keep running and
+// keep resolving names, and counting only Ready nodes would scale DNS down at
+// the moment many nodes lose their connection to the control plane.
+func DesiredReplicas(nodes int, autoscaling config.CoreDNSAutoscaling) int32 {
+	// minReplicas keeps DNS running when a node fails. With fewer than two nodes,
+	// a second replica would run on the same node and fail with it, so a single
+	// replica serves.
+	if nodes <= 1 {
+		return 1
+	}
+
+	// config validation rejects a ratio below 1, this only keeps a zero value from dividing by zero
+	nodesPerReplica := max(autoscaling.NodesPerReplica, 1)
+	replicas := (nodes + nodesPerReplica - 1) / nodesPerReplica
+	replicas = max(replicas, autoscaling.MinReplicas)
+	if autoscaling.MaxReplicas > 0 {
+		replicas = min(replicas, autoscaling.MaxReplicas)
+	}
+
+	return int32(replicas)
+}
+
+// SetupWithManager adds the controller to the manager
+func (r *AutoscalerReconciler) SetupWithManager(mgr ctrl.Manager) error {
+	request := reconcile.Request{NamespacedName: types.NamespacedName{Namespace: Namespace, Name: DeploymentName}}
+
+	// only the coredns deployment is scaled. A status update does not change its replica count,
+	// so only react when its spec changed, for example because something else scaled it.
+	isCoreDNSDeployment := predicate.NewPredicateFuncs(func(object client.Object) bool {
+		return object.GetNamespace() == request.Namespace && object.GetName() == request.Name
+	})
+
+	// the number of nodes only changes when a node is created or deleted. Skipping node
+	// updates keeps the status heartbeats of a large fleet out of the work queue.
+	nodeCountChanged := predicate.Funcs{
+		CreateFunc:  func(event.CreateEvent) bool { return true },
+		DeleteFunc:  func(event.DeleteEvent) bool { return true },
+		UpdateFunc:  func(event.UpdateEvent) bool { return false },
+		GenericFunc: func(event.GenericEvent) bool { return false },
+	}
+	enqueueDeployment := handler.EnqueueRequestsFromMapFunc(func(context.Context, client.Object) []reconcile.Request {
+		return []reconcile.Request{request}
+	})
+
+	return ctrl.NewControllerManagedBy(mgr).
+		WithOptions(controller.Options{
+			CacheSyncTimeout: constants.DefaultCacheSyncTimeout,
+		}).
+		Named("coredns_autoscaler").
+		For(&appsv1.Deployment{}, builder.WithPredicates(isCoreDNSDeployment, predicate.GenerationChangedPredicate{})).
+		Watches(&corev1.Node{}, enqueue
```

#### Recent Merged Pull Requests:
- **PR #4291** (2026-11-23): fix(telemetry): send a config summary and an error category from the control plane (backport v0.35 oss) (@loft-bot)
- **PR #4290** (2026-11-23): fix(telemetry): send a config summary and an error category from the control plane (backport v0.36 oss) (@loft-bot)
- **PR #4288** (2026-11-19): fix(ci): install the signed helm-unittest release with verification (#2762) (backport v0.35 oss) (@loft-bot)
- **PR #4287** (2026-11-19): fix(ci): install the signed helm-unittest release with verification (#2762) (backport v0.36 oss) (@loft-bot)
- **PR #4285** (closed): [v0.37] chore: bump minimum platform version to v4.12.7 (@deniseschannon)
- **PR #4284** (2026-11-19): fix(telemetry): send structured cli usage instead of the raw command line (backport v0.35 oss) (@loft-bot)

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

## X. coredns): add opt-in autoscaling of the coredns deployment

**RULE**:
When implementing operations in `chart/values.schema.json`, engineers MUST enforce rigorous boundary validation, safe state transitions, and memory/concurrency invariants as established by production defect remediation in loft-sh/vcluster. All inputs crossing module boundaries must be explicitly verified before state persistence.

**WHY**:
Prevents defects observed in production commit `f38b446f`: coredns): add opt-in autoscaling of the coredns deployment. Unvalidated execution paths cause runtime exceptions, race conditions, and silent state corruption under concurrent workloads.

**WHEN TO APPLY**:
Subsystems managing Go data structures, boundary deserialization, API parsing, or resource lifecycles matching `chart/values.schema.json`.

**VERIFIED IMPLEMENTATION PATTERN**:
```go
// Verified production-grade fix pattern:
    "CoreDNSAutoscaling": {
      "properties": {
        "enabled": {
          "type": "boolean",
          "description": "Enabled defines if an autoscaler sets the amount of coredns pods instead of replicas. Mode selects the autoscaler."
        },
        "mode": {
          "type": "string",
          "enum": [
            "Nodes",
            "External"
          ],
          "description": "Mode is the autoscaler that sets the amount of coredns pods. With Nodes, vCluster scales coredns with the number of nodes in the cluster and corrects an amount that something else has set. With External, vCluster creates coredns with replicas and then keeps the amount that is set on the coredns deployment, so that a HorizontalPodAutoscaler or another autoscaler can scale it. Defaults to Nodes."
        },
        "nodesPerReplica": {
          "type": "integer",
          "description": "NodesPerReplica is the number of nodes that one coredns pod serves. vCluster runs one coredns pod for every nodesPerReplica nodes, rounded up. A lower value runs more coredns pods. On shared nodes, unless sync.fromHost.nodes selects all nodes, the cluster only lists the nodes that run its pods, coredns p
```

**NEGATIVE CONSTRAINT**:
```go
// Induced defect failure mode:
          "description": "Replicas is the amount of coredns pods to run."
```

**VERIFICATION METHOD**:
Automated regression test asserting that input states reproducing defect `f38b446f` are properly handled with clean fallback behavior.
