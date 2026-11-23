# Domain L — Deployment & Operations Intelligence: Deployment & Operations Intelligence: loft-sh-vcluster-learnings Core Invariants

<!-- PROVENANCE_START
{
  "source_repository": "loft-sh-vcluster-learnings",
  "source_url": "unknown",
  "source_version": "HEAD",
  "license": "Open-Source",
  "timestamp": "2026-11-23T21:05:01.822Z",
  "ai_provider": "universal-multi-artifact-distributor",
  "generator_version": "2.0.0-universal",
  "learning_id": "LEARN-EVO-loft-sh-vcluster-learnings",
  "canonical_classification": "domain_intelligence"
}
PROVENANCE_END -->
> **Provenance**: Harvested from [loft-sh-vcluster-learnings](unknown) (Revision: `HEAD`).  
> **License**: Open-Source | **Timestamp**: `2026-11-23T21:05:01.822Z`  
> **Learning ID**: `LEARN-EVO-loft-sh-vcluster-learnings`


## 1. Domain Taxonomy & Context
- **Canonical Domain**: Domain L (Deployment & Operations Intelligence)
- **Secondary Corroborating Domains**: M (Feedback & Evolution Intelligence), K (Quality & Verification Intelligence), H (Technical Construction Intelligence), G (Architecture Intelligence), J (Search & Distribution Intelligence), D (Research & Knowledge Intelligence), I (Content & Information Intelligence), A (Human & Need Intelligence)
- **Confidence Rating**: 55%

## 2. Core Domain Invariants & Discovered Laws
The following architectural invariants have been empirically discovered and recorded from loft-sh-vcluster-learnings:

> **Canonical Learning Artifact**: `07_PROJECT_LEARNING/loft-sh-vcluster-learnings.md`  
> **Source**: github ([https://github.com/loft-sh/vcluster](https://github.com/loft-sh/vcluster))  
> **Source Version**: `1671d54b`  
> **License**: Apache-2.0  
> **Synthesized By**: zero-clone-structural-synthesizer  
> **Timestamp**: 2026-11-23T21:04:48.568Z  
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
> **Harvest Timestamp**: 2026-11-23T21:04:48.563Z  
> **Compliance State**: Free Tier Guaranteed | Strict Rate-Limit Backoff Honored  

---

## 1. Context & Architectural Overview
- **Repository / Resource**: `loft-sh/vcluster`
- **Description**: vCluster creates tenant clusters: fully isolated environments delivered as managed Kubernetes, or as the foundation for Slurm, Ray, Run:ai and inference clusters. Each gets its own API server, CRDs and RBAC, and runs on an existing cluster or standalone on bare metal. CNCF Certified Kubernetes.
- **Primary Language / Ecosystem**: Go
- **Discovered Manifests / Configurations**: go.mod, README.md, Dockerfile
- **Stars / Engagement**: 11397 stars

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
)

var ErrNoCoreDNSManifests = fmt.Errorf("no coredns manifests found")

func ApplyManifest(ctx context.Context, config *config.Config, defaultImageRegistry string, inClusterConfig *rest.Config, serverVersion *version.Info) error {
	if !config.ControlPlane.CoreDNS.Enabled {
		return nil
	}

	// get the manifest variables
	vars := getManifestVariables(defaultImageRegistry, serverVersion)

	// process the corefile and manifests
	output, err := processManifests(vars, config)
	if err != nil {
		return err
	}

	return applier.ApplyManifest(ctx, inClusterConfig, output)
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
  replicas: {{ .Values.controlPlane.coredns.deployment.replicas }}
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
    - name: dns-tc
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

### Core Architecture Module: `pkg/lifecycle/lifecycle.go`
```
package lifecycle

import (
	"context"
	"fmt"
	"strconv"
	"time"

	"github.com/loft-sh/log"
	vclusterconfig "github.com/loft-sh/vcluster/pkg/config"
	"github.com/loft-sh/vcluster/pkg/constants"
	"github.com/loft-sh/vcluster/pkg/kube"
	"github.com/loft-sh/vcluster/pkg/util/translate"
	"github.com/pkg/errors"
	appsv1 "k8s.io/api/apps/v1"
	kerrors "k8s.io/apimachinery/pkg/api/errors"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/apimachinery/pkg/labels"
	"k8s.io/apimachinery/pkg/types"
	"k8s.io/apimachinery/pkg/util/wait"
	"k8s.io/client-go/kubernetes"
	"sigs.k8s.io/controller-runtime/pkg/client"
)

// PauseVCluster pauses a running vcluster
func PauseVCluster(ctx context.Context, kubeClient *kubernetes.Clientset, name, namespace string, isRestore bool, log log.BaseLogger) error {
	// scale down vcluster itself
	labelSelector := "app=vcluster,release=" + name
	found, err := scaleDownStatefulSet(ctx, kubeClient, labelSelector, namespace, isRestore, log)
	if err != nil {
		return err
	} else if !found {
		found, err = scaleDownDeployment(ctx, kubeClient, labelSelector, namespace, isRestore, log)
		if err != nil {
			return err
		} else if !found {
			return errors.Errorf("couldn't find vcluster %s in namespace %s", name, namespace)
		}

		// scale down kube api server
		_, err = scaleDownDeployment(ctx, kubeClient, "app=vcluster-api,release="+name, namespace, isRestore, log)
		if err != nil {
			return err
		}

		// scale down kube controller
		_, err = scaleDownDeployment(ctx, kubeClient, "app=vcluster-controller,release="+name, namespace, isRestore, log)
		if err != nil {
			return err
		}

		// scale down etcd
		if !isRestore {
			_, err = scaleDownStatefulSet(ctx, kubeClient, "app=vcluster-etcd,release="+name, namespace, isRestore, log)
			if err != nil {
				return err
			}
		}
	}

	return nil
}

// DeletePods deletes all pods associated with a running vcluster
func DeletePods(ctx context.Context, kubeClient *kubernetes.Clientset, labelSelector, namespace string) error {
	list, err := kubeClient.CoreV1().Pods(namespace).List(ctx, metav1.ListOptions{LabelSelector: labelSelector})
	if err != nil {
		return err
	}

	if len(list.Items) > 0 {
		for _, item := range list.Items {
			err = kubeClient.CoreV1().Pods(namespace).Delete(ctx, item.Name, metav1.DeleteOptions{})
			if err != nil {
				if kerrors.IsNotFound(err) {
					continue
				}
				return errors.Wrapf(err, "delete pod %s/%s", namespace, item.Name)
			}
		}
	}

	return nil
}

func DeleteMultiNamespaceVClusterWorkloads(ctx context.Context, client *kubernetes.Clientset, vclusterName, vclusterNamespace string, _ log.BaseLogger) error {
	// get all host namespaces managed by this multinamespace mode enabled vcluster
	namespaces, err := client.CoreV1().Namespaces().List(ctx, metav1.ListOptions{
		LabelSelector: labels.FormatLabels(map[string]string{
			translate.MarkerLabel: translate.SafeConcatName(vclusterNamespace, "x", vclusterName),
		}),
	})
	if err != nil && !kerrors.IsForbidden(err) {
		return fmt.Errorf("list namespaces: %w", err)
	}
	if namespaces == nil {
		return errors.New("list namespaces: nil result")
	}

	// delete all pods inside the above returned namespaces
	for _, ns := range namespaces.Items {
		podList, podListErr := client.CoreV1().Pods(ns.Name).List(ctx, metav1.ListOptions{})
		if podListErr != nil {
			return errors.Wrapf(err, "error listing pods in namespace %s", ns.Name)
		}

		for _, pod := range podList.Items {
			err := client.CoreV1().Pods(ns.Name).Delete(ctx, pod.Name, metav1.DeleteOptions{})
			if err != nil && !kerrors.IsNotFound(err) {
				return errors.Wrapf(err, "error deleting pod %s/%s", ns.Name, pod.Name)
			}
		}
	}

	return nil
}

func scaleDownDeployment(ctx context.Context, kubeClient kubernetes.Interface, labelSelector, namespace string, isRestore bool, log log.BaseLogger) (bool, error) {
	list, err := kubeClient.AppsV1().Deployments(namespace).List(ctx, metav1.ListOptions{LabelSelector: labelSelector})
	if err != nil {
		return false, err
	} else if len(list.Items) == 0 {
		return false, nil
	}

	for _, item := range list.Items {
		if IsPaused(&item) {
			log.Infof("vcluster %s/%s is already paused", namespace, item.Name)
			return true, nil
		}

		result, err := prepareScaleDown(ctx, kubeClient, &item, isRestore)
		if err != nil {
			return false, fmt.Errorf("prepare deployment scale down: %w", err)
		}

		log.Infof("Scale down deployment %s/%s...", namespace, item.Name)
		_, err = kubeClient.AppsV1().Deployments(namespace).Patch(ctx, item.Name, result.patchType, result.patchData, metav1.PatchOptions{})
		if err != nil {
			return false, fmt.Errorf("patch deployment: %w", err)
		}

		if result.alreadyScaledDown {
			log.Infof("Deployment %s/%s was already scaled down, set annotation %s on it", namespace, item.Name, constants.PausedAnnotation(isRestore))
		} else {
			err = wait.PollUntilContextTimeout(ctx, time.Second, time.Minute*3, true, func(ctx context.Context) (done bool, err error) {
				deployment, err := kubeClient.AppsV1().Deployments(namespace).Get(ctx, item.Name, metav1.GetOptions{})
				if err != nil {
					return false, err
				}

				return deployment.Status.Replicas == 0, nil
			})
			if err != nil {
				return false, fmt.Errorf("wait for deployment scaled down: %w", err)
			}
		}
	}

	return true, nil
}

func scaleDownStatefulSet(ctx context.Context, kubeClient kubernetes.Interface, labelSelector, namespace string, isRestore bool, log log.BaseLogger) (bool, error) {
	list, err := kubeClient.AppsV1().StatefulSets(namespace).List(ctx, metav1.ListOptions{LabelSelector: labelSelector})
	if err != nil {
		return false, err
	} else if len(list.Items) == 0 {
		return false, nil
	}

	for _, item := range list.Items {
		if IsPaused(&item) {
			log.Infof("vcluster %s/%s is already paused", namespace, item.Name)
			return true, nil
		}

		result, err := prepareScaleDown(ctx, kubeClient, &item, isRestore)
		if err != nil {
			return false, fmt.Errorf("prepare statefulSet scale down: %w", err)
		}

		log.Infof("Scale down statefulSet %s/%s...", namespace, item.Name)
		_, err = kubeClient.AppsV1().StatefulSets(namespace).Patch(ctx, item.Name, result.patchType, result.patchData, metav1.PatchOptions{})
		if err != nil {
			return false, fmt.Errorf("patch statefulSet: %w", err)
		}

		if result.alreadyScaledDown {
			log.Infof("StatefulSet %s/%s was already scaled down, set annotation %s on it", namespace, item.Name, constants.PausedAnnotation(isRestore))
		} else {
			err = wait.PollUntilContextTimeout(ctx, time.Second, time.Minute*3, true, func(ctx context.Context) (done bool, err error) {
				obj, err := kubeClient.AppsV1().StatefulSets(namespace).Get(ctx, item.Name, metav1.GetOptions{})
				if err != nil {
					return false, err
				}

				return obj.Status.Replicas == 0, nil
			})
			if err != nil {
				return false, fmt.Errorf("wait for statefulSet scaled down: %w", err)
			}
		}
	}

	return true, nil
}

type scaleDownResult struct {
	alreadyScaledDown bool
	patchData         []byte
	patchType         types.PatchType
}

// prepareScaleDown computes the pause annotations and patch data for a
// StatefulSet or Deployment that is about to be scaled down.
func prepareScaleDown(ctx context.Context, kubeClient kubernetes.Interface, object client.Object, isRestore bool) (*scaleDownResult, error) {
	replicas := getReplicas(object)
	alreadyScaledDown := replicas != nil && *replicas == 0

	original := object.DeepCopyObject().(client.Object)

	annotations := object.GetAnnotations()
	if annotations == nil {
		annotations = map[string]string{}
	}

	replicaCount := 1
	if alreadyScaledDown {
		// The workload was already scaled to 0 before we're pausing it.
		// Read the configured replica count from the vCluster config so
		// that resume restores the correct HA replica count.
		replicaCount = getConfiguredReplicas(ctx, kubeClient, object.GetNamespace(), object.GetLabels()["release"])
	} else if replicas != nil {
		replicaCount = int(*replicas)
	}

	annotations[constants.PausedAnnotation(isRestore)] = "true"
	annotations[constants.PausedReplicasAnnotation] = strconv.Itoa(replicaCount)
	annotations[constants.PausedDateAnnotation] = time.Now().Format("2006-01-02T15:04:05.000Z")
	object.SetAnnotations(annotations)

	zero := int32(0)
	setReplicas(object, &zero)

	patch := client.MergeFrom(original)
	data, err := patch.Data(object)
	if err != nil {
		return nil, fmt.Errorf("create patch: %w", err)
	}

	return &scaleDownResult{
		alreadyScaledDown: alreadyScaledDown,
		patchData:         data,
		patchType:         patch.Type(),
	}, nil
}

func getReplicas(obj client.Object) *int32 {
	switch o := obj.(type) {
	case *appsv1.Deployment:
		return o.Spec.Replicas
	case *appsv1.StatefulSet:
		return o.Spec.Replicas
	}
	return nil
}

func setReplicas(obj client.Object, r *int32) {
	switch o := obj.(type) {
	case *appsv1.Deployment:
		o.Spec.Replicas = r
	case *appsv1.StatefulSet:
		o.Spec.Replicas = r
	}
}

// ResumeVCluster resumes a paused vcluster
func ResumeVCluster(ctx context.Context, kubeClient *kubernetes.Clientset, name, namespace string, isRestore bool, log log.BaseLogger) error {
	// scale up vcluster itself
	labelSelector := "app=vcluster,release=" + name
	found, err := scaleUpStatefulSet(ctx, kubeClient, labelSelector, namespace, isRestore, log)
	if err != nil {
		return err
	} else if !found {
		found, err = scaleUpDeployment(ctx, kubeClient, labelSelector, namespace, isRestore, log)
		if err != nil {
			return err
		} else if !found {
			return errors.Errorf("couldn't find a paused vcluster %s in namespace %s. Make sure the vcluster exists and was paused previously", name, namespace)
		}

		// scale up kube api server
		_, err = scaleUpDeployment(ctx, kubeClient, "app=vcluster-api,release="+name, namespace, isRestore, log)
		if err != nil {
			return err
		}

		// scale up kube controller
		_, err = scaleUpDeployment(ctx, kubeClient, "app=vcluster-controller,release="+name, namespace, isRestore, log)
		if err 
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

### Incident Patch 1: `1671d54b` (2026-11-23)
**Commit Message**: fix(syncer): skip host objects that belong to another virtual object (#2754)

* fix(syncer): skip host objects that belong to another virtual object

Co-Authored-By: Claude Opus 5.5 <[REDACTED_EMAIL]>

* fix(syncer): check the host object owner before endpoint deletes

The endpoints and endpointslices ReconcileStart hooks run before
getObjects and delete the host object under the computed name. When two
virtual objects map to the same host name, that deleted the host object
of the other virtual object. Run the same owner check there.

Move the check to translate.BelongsToOtherVirtualObject so the syncer
and the hooks share it, and keep the host name out of the SyncError
event, which is visible inside the virtual cluster.

Co-Authored-By: Claude Opus 5.5 <[REDACTED_EMAIL]>

* test(syncer): cover host name collisions in reconcile and e2e

Assert the SyncError event, the different-kind branch, and that the
owning virtual object still syncs or replaces a stale host copy. Add a
service collision test through Reconcile and an e2e spec that applies a
colliding service with server-side apply, which skips the service
create filter.

Co-Authored-By: Claude Opus 5.5 <[REDACTED_EMAIL]>

* fix(

**File**: `e2e/suite_e2e_test.go` (modified, +1/-0)
```diff
@@ -37,6 +37,7 @@ func suiteCommonVCluster() {
 
 			test_core.PodSyncSpec()
 			test_core.SyncErrorSanitisationSpec()
+			test_core.HostNameCollisionSpec()
 			test_core.NetworkPolicySyncSpec()
 			test_core.PVCSyncSpec()
 			test_core.K8sDefaultEndpointSpec()
```

**File**: `e2e/test_core/sync/test_host_name_collision.go` (added, +176/-0)
```diff
@@ -0,0 +1,176 @@
+package test_core
+
+import (
+	"context"
+
+	"github.com/loft-sh/e2e-framework/pkg/setup/cluster"
+	"github.com/loft-sh/vcluster/e2e/constants"
+	"github.com/loft-sh/vcluster/e2e/labels"
+	"github.com/loft-sh/vcluster/pkg/util/random"
+	"github.com/loft-sh/vcluster/pkg/util/translate"
+	. "github.com/onsi/ginkgo/v2"
+	. "github.com/onsi/gomega"
+	corev1 "k8s.io/api/core/v1"
+	kerrors "k8s.io/apimachinery/pkg/api/errors"
+	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
+	corev1apply "k8s.io/client-go/applyconfigurations/core/v1"
+	"k8s.io/client-go/kubernetes"
+)
+
+// HostNameCollisionSpec verifies that two virtual services whose names translate to the same
+// host name can't touch each other's host service. prod-x-<team>/web and <team>/web-x-prod both
+// translate to web-x-prod-x-<team>-x-<vcluster>, so the second service, created with server-side
+// apply, must stay unsynced with a SyncError event instead of taking over or deleting the host
+// service of the first, and must not change the type of that host service.
+func HostNameCollisionSpec() {
+	Describe("Host name collision between virtual objects",
+		labels.Core, labels.Sync, labels.Events,
+		func() {
+			var (
+				hostClient     kubernetes.Interface
+				vClusterClient kubernetes.Interface
+				vClusterName   string
+			)
+
+			BeforeEach(func(ctx context.Context) {
+				hostClient = cluster.KubeClientFrom(ctx, constants.GetHostClusterName())
+				Expect(hostClient).NotTo(BeNil())
+				vClusterClient = cluster.CurrentKubeClientFrom(ctx)
+				Expect(vClusterClient).NotTo(BeNil())
+				vClusterName = cluster.CurrentClusterNameFrom(ctx)
+			})
+
+			It("should not let a colliding service take over or delete another namespace's host service", labels.PR, func(ctx context.Context) {
+				team := "team-" + random.String(6)
+				victimNS, victimName := "prod-x-"+team, "web"
+				attackerNS, attackerName := team, "web-x-prod"
+				hostNS := vClusterHostNamespace(vClusterName)
+				hostName := translate.SingleNamespaceHostName(victimName, victimNS, vClusterName)
+				Expect(translate.SingleNamespaceHostName(attackerName, attackerNS, vClusterName)).To(Equal(hostName),
+					"test names must translate to the same host name")
+
+				for _, ns := range []string{victimNS, attackerNS} {
+					By("creating namespace "+ns+" in the virtual cluster", func() {
+						_, err := vClusterClient.CoreV1().Namespaces().Create(ctx, &corev1.Namespace{
+							ObjectMeta: metav1.ObjectMeta{Name: ns},
+						}, metav1.CreateOptions{})
+						Expect(err).To(Succeed())
+						DeferCleanup(func(ctx context.Context) {
+							err := vClusterClient.CoreV1().Namespaces().Delete(ctx, ns, metav1.DeleteOptions{})
+							if !kerrors.IsNotFound(err) {
+								Expect(err).To(Succeed())
+							}
+						})
+					})
+				}
+
+				expectHostServiceOfVictim := func(g Gomega, ctx context.Context) {
+					hostSvc, err := hostClient.CoreV1().Services(hostNS).Get(ctx, hostName, metav1.GetOptions{})
+					g.Expect(err).NotTo(HaveOccurred(), "host service %s/%s of %s/%s should exist", hostNS, hostName, victimNS, victimName)
+					g.Expect(hostSvc.Annotations).To(HaveKeyWithValue(translate.NamespaceAnnotation, victimNS))
+					g.Expect(hostSvc.Annotations).To(HaveKeyWithValue(translate.NameAnnotation, victimName))
+					g.Expect(hostSvc.Spec.Ports).To(HaveLen(1))
+					g.Expect(hostSvc.Spec.Ports[0].Port).To(Equal(int32(80)))
+				}
+
+				By("creating the first service and waiting for its host service", func() {
+					_, err := vClusterClient.CoreV1().Services(victimNS).Create(ctx, collisionService(victimName, 80), metav1.CreateOptions{})
+					Expect(err).To(Succeed())
+
+					Eventually(expectHostServiceOfVictim).WithContext(ctx).
+						WithPolling(constants.PollingInterval).
+						WithTimeout(constants.PollingTimeout).
+						Should(Succeed())
+				})
+
+				By("verifying a plain create of the colliding service is rejected", func() {
+					// the service create filter (pkg/server/filters/service.go) creates the host service first
+					_, err := vClusterClient.CoreV1().Services(attackerNS).Create(ctx, collisionService(attackerName, 9999), metav1.CreateOptions{})
+					Expect(kerrors.IsAlreadyExists(err)).To(BeTrue(), "expected AlreadyExists, got %v", err)
+				})
+
+				By("creating the colliding service with server-side apply", func() {
+					// server-side apply is a patch, so it bypasses the service create filter and leaves the collision to the syncer
+					_, err := vClusterClient.CoreV1().Services(attackerNS).Apply(ctx,
+						corev1apply.Service(attackerName, attackerNS).WithSpec(corev1apply.ServiceSpec().
+							WithType(corev1.ServiceTypeExternalName).
+							WithExternalName("example.com").
+							WithPorts(corev1apply.ServicePort().WithName("http").WithPort(9999).WithProtocol(corev1.ProtocolTCP)),
+						),
+						metav1.ApplyOptions{FieldManager: "e2e-host-name-collision"},
+					)
+					Expect(err).To(Succeed())
+				})
+
+				By("waiting for a SyncError
```

**File**: `pkg/controllers/resources/endpoints/syncer.go` (modified, +14/-0)
```diff
@@ -178,6 +178,11 @@ func (s *endpointsSyncer) ReconcileStart(ctx *synccontext.SyncContext, req ctrl.
 			return true, nil
 		}
 
+		// another virtual object might map to the same host name, so don't delete its endpoints
+		if translate.BelongsToOtherVirtualObject(endpoints, req.NamespacedName, s.GroupVersionKind().String()) {
+			return true, nil
+		}
+
 		// check if endpoints were created by us
 		if endpoints.Annotations != nil && endpoints.Annotations[translate.NameAnnotation] != "" {
 			// Deleting the endpoints is necessary here as some clusters would not correctly maintain
@@ -196,6 +201,15 @@ func (s *endpointsSyncer) ReconcileStart(ctx *synccontext.SyncContext, req ctrl.
 		return true, nil
 	}
 
+	// another virtual service might map to the same host name, so don't touch the endpoints of its host service
+	hostService := &corev1.Service{}
+	err = ctx.HostClient.Get(ctx, mappings.VirtualToHost(ctx, req.Name, req.Namespace, mappings.Services()), hostService)
+	if err != nil && !kerrors.IsNotFound(err) {
+		return true, err
+	} else if err == nil && translate.BelongsToOtherVirtualObject(hostService, req.NamespacedName, corev1.SchemeGroupVersion.WithKind("Service").String()) {
+		return true, nil
+	}
+
 	// check if it was a Kubernetes managed endpoints object before and delete it
 	endpoints := &corev1.Endpoints{}
 	err = ctx.HostClient.Get(ctx, s.VirtualToHost(ctx, req.NamespacedName, nil), endpoints)
```

**File**: `pkg/controllers/resources/endpoints/syncer_collision_test.go` (added, +127/-0)
```diff
@@ -0,0 +1,127 @@
+package endpoints
+
+import (
+	"testing"
+
+	"gotest.tools/assert"
+	corev1 "k8s.io/api/core/v1"
+	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
+	"k8s.io/apimachinery/pkg/runtime"
+	"k8s.io/apimachinery/pkg/types"
+	ctrl "sigs.k8s.io/controller-runtime"
+
+	"github.com/loft-sh/vcluster/pkg/syncer"
+	syncertesting "github.com/loft-sh/vcluster/pkg/syncer/testing"
+	testingutil "github.com/loft-sh/vcluster/pkg/util/testing"
+	"github.com/loft-sh/vcluster/pkg/util/translate"
+)
+
+// prod-x-team/web and team/web-x-prod translate to the same host name. Reconciling the endpoints of
+// team/web-x-prod, a service with a selector, must not delete the host endpoints of prod-x-team/web.
+//
+//nolint:staticcheck // SA1019: corev1.Endpoints is deprecated, but still required for compatibility
+func TestReconcileDoesNotDeleteCollidingHostEndpoints(t *testing.T) {
+	translate.Default = translate.NewSingleNamespaceTranslator(testingutil.DefaultTestTargetNamespace)
+
+	victim := types.NamespacedName{Namespace: "prod-x-team", Name: "web"}
+	attacker := types.NamespacedName{Namespace: "team", Name: "web-x-prod"}
+	hostName := translate.Default.HostName(nil, victim.Name, victim.Namespace)
+	assert.Equal(t, hostName, translate.Default.HostName(nil, attacker.Name, attacker.Namespace), "test names don't collide")
+
+	test := syncertesting.SyncTest{
+		InitialVirtualState: []runtime.Object{
+			&corev1.Namespace{ObjectMeta: metav1.ObjectMeta{Name: victim.Namespace}},
+			&corev1.Namespace{ObjectMeta: metav1.ObjectMeta{Name: attacker.Namespace}},
+			&corev1.Service{ObjectMeta: metav1.ObjectMeta{Namespace: victim.Namespace, Name: victim.Name}},
+			&corev1.Endpoints{
+				ObjectMeta: metav1.ObjectMeta{Namespace: victim.Namespace, Name: victim.Name},
+				Subsets:    []corev1.EndpointSubset{{Addresses: []corev1.EndpointAddress{{IP: "1.1.1.1"}}}},
+			},
+			&corev1.Service{
+				ObjectMeta: metav1.ObjectMeta{Namespace: attacker.Namespace, Name: attacker.Name},
+				Spec:       corev1.ServiceSpec{Selector: map[string]string{"app": "web"}},
+			},
+		},
+	}
+	pClient, vClient, vConfig := test.Setup()
+	registerContext := syncertesting.NewFakeRegisterContext(vConfig, pClient, vClient)
+	_, s := newFakeSyncer(t, registerContext)
+	controller, err := syncer.NewSyncController(registerContext, s)
+	assert.NilError(t, err)
+
+	reconcile := func(req types.NamespacedName) {
+		_, err := controller.Reconcile(t.Context(), ctrl.Request{NamespacedName: req})
+		assert.NilError(t, err)
+	}
+	hostOwner := func() types.NamespacedName {
+		pEndpoints := &corev1.Endpoints{}
+		assert.NilError(t, pClient.Get(t.Context(), hostName, pEndpoints), "host endpoints of %s were deleted", victim)
+		return types.NamespacedName{Namespace: pEndpoints.Annotations[translate.NamespaceAnnotation], Name: pEndpoints.Annotations[translate.NameAnnotation]}
+	}
+
+	reconcile(victim)
+	assert.Equal(t, hostOwner(), victim)
+
+	reconcile(attacker)
+	assert.Equal(t, hostOwner(), victim)
+}
+
+// prod-x-team/web, a service with a selector, has host endpoints that the host cluster maintains.
+// Reconciling the endpoints of team/web-x-prod, a service without a selector, must neither delete
+// nor take over these host endpoints.
+//
+//nolint:staticcheck // SA1019: corev1.Endpoints is deprecated, but still required for compatibility
+func TestReconcileDoesNotDeleteHostManagedEndpointsOfCollidingService(t *testing.T) {
+	translate.Default = translate.NewSingleNamespaceTranslator(testingutil.DefaultTestTargetNamespace)
+
+	victim := types.NamespacedName{Namespace: "prod-x-team", Name: "web"}
+	attacker := types.NamespacedName{Namespace: "team", Name: "web-x-prod"}
+	hostName := translate.Default.HostName(nil, victim.Name, victim.Namespace)
+	assert.Equal(t, hostName, translate.Default.HostName(nil, attacker.Name, attacker.Namespace), "test names don't collide")
+
+	test := syncertesting.SyncTest{
+		InitialVirtualState: []runtime.Object{
+			&corev1.Namespace{ObjectMeta: metav1.ObjectMeta{Name: victim.Namespace}},
+			&corev1.Namespace{ObjectMeta: metav1.ObjectMeta{Name: attacker.Namespace}},
+			&corev1.Service{
+				ObjectMeta: metav1.ObjectMeta{Namespace: victim.Namespace, Name: victim.Name},
+				Spec:       corev1.ServiceSpec{Selector: map[string]string{"app": "web"}},
+			},
+			&corev1.Service{ObjectMeta: metav1.ObjectMeta{Namespace: attacker.Namespace, Name: attacker.Name}},
+			&corev1.Endpoints{
+				ObjectMeta: metav1.ObjectMeta{Namespace: attacker.Namespace, Name: attacker.Name},
+				Subsets:    []corev1.EndpointSubset{{Addresses: []corev1.EndpointAddress{{IP: "2.2.2.2"}}}},
+			},
+		},
+		InitialPhysicalState: []runtime.Object{
+			&corev1.Service{
+				ObjectMeta: metav1.ObjectMeta{
+					Namespace: hostName.Namespace,
+					Name:      hostName.Name,
+					Annotations: map[string]string{
+						translate.NameAnnotation:      victim.Name,
+						translate.NamespaceAnnotation: victim.Namespace,
+						translate.KindAnnotation:      corev1.Schem
```

**File**: `pkg/controllers/resources/endpointslices/syncer.go` (modified, +18/-0)
```diff
@@ -139,6 +139,10 @@ func (s *endpointSliceSyncer) ReconcileStart(ctx *synccontext.SyncContext, req c
 				}
 				return true, nil
 			}
+			// another virtual object might map to the same host name, so don't delete its endpointSlice
+			if translate.BelongsToOtherVirtualObject(hostEps, req.NamespacedName, s.GroupVersionKind().String()) {
+				return true, nil
+			}
 			err = ctx.HostClient.Delete(ctx, hostEps)
 			if err != nil {
 				return true, fmt.Errorf("error deleting endpointSlice from host %s: %w", eps.Name, err)
@@ -177,6 +181,11 @@ func (s *endpointSliceSyncer) ReconcileStart(ctx *synccontext.SyncContext, req c
 			return true, nil
 		}
 
+		// another virtual object might map to the same host name, so don't delete its endpointSlice
+		if translate.BelongsToOtherVirtualObject(endpointSlice, req.NamespacedName, s.GroupVersionKind().String()) {
+			return true, nil
+		}
+
 		// check if endpoints were created by us
 		if endpointSlice.Annotations != nil && endpointSlice.Annotations[translate.NameAnnotation] != "" {
 			// Deleting the endpointSlice is necessary here as some clusters would not correctly maintain
@@ -194,6 +203,15 @@ func (s *endpointSliceSyncer) ReconcileStart(ctx *synccontext.SyncContext, req c
 		return true, nil
 	}
 
+	// another virtual service might map to the same host name, so don't touch the endpointSlices of its host service
+	hostService := &corev1.Service{}
+	err = ctx.HostClient.Get(ctx, mappings.VirtualToHost(ctx, svcName, req.Namespace, mappings.Services()), hostService)
+	if err != nil && !kerrors.IsNotFound(err) {
+		return true, fmt.Errorf("error retrieving host service: %w", err)
+	} else if err == nil && translate.BelongsToOtherVirtualObject(hostService, types.NamespacedName{Namespace: req.Namespace, Name: svcName}, corev1.SchemeGroupVersion.WithKind("Service").String()) {
+		return true, nil
+	}
+
 	// check if it was a Kubernetes managed endpointSlice object before and delete it
 	endpointSlice := &discoveryv1.EndpointSlice{}
 	err = ctx.HostClient.Get(ctx, s.VirtualToHost(ctx, req.NamespacedName, nil), endpointSlice)
```

**File**: `pkg/controllers/resources/endpointslices/syncer_collision_test.go` (added, +176/-0)
```diff
@@ -0,0 +1,176 @@
+package endpointslices
+
+import (
+	"testing"
+
+	"gotest.tools/assert"
+	corev1 "k8s.io/api/core/v1"
+	discoveryv1 "k8s.io/api/discovery/v1"
+	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
+	"k8s.io/apimachinery/pkg/runtime"
+	"k8s.io/apimachinery/pkg/types"
+	ctrl "sigs.k8s.io/controller-runtime"
+
+	"github.com/loft-sh/vcluster/pkg/syncer"
+	syncertesting "github.com/loft-sh/vcluster/pkg/syncer/testing"
+	testingutil "github.com/loft-sh/vcluster/pkg/util/testing"
+	"github.com/loft-sh/vcluster/pkg/util/translate"
+)
+
+// prod-x-team/web-1 and team/web-1-x-prod translate to the same host name. Reconciling
+// team/web-1-x-prod must not delete the host endpoint slice of prod-x-team/web-1.
+func TestReconcileDoesNotDeleteCollidingHostEndpointSlice(t *testing.T) {
+	victim := types.NamespacedName{Namespace: "prod-x-team", Name: "web-1"}
+	attacker := types.NamespacedName{Namespace: "team", Name: "web-1-x-prod"}
+
+	testCases := []struct {
+		name         string
+		virtualState []runtime.Object
+	}{
+		{
+			name: "attacker endpoint slice is missing",
+		},
+		{
+			name: "attacker service has a selector",
+			virtualState: []runtime.Object{
+				endpointSlice(attacker, "svc"),
+				&corev1.Service{
+					ObjectMeta: metav1.ObjectMeta{Namespace: attacker.Namespace, Name: "svc"},
+					Spec:       corev1.ServiceSpec{Selector: map[string]string{"app": "web"}},
+				},
+			},
+		},
+	}
+
+	for _, tc := range testCases {
+		t.Run(tc.name, func(t *testing.T) {
+			translate.Default = translate.NewSingleNamespaceTranslator(testingutil.DefaultTestTargetNamespace)
+			hostName := translate.Default.HostName(nil, victim.Name, victim.Namespace)
+			assert.Equal(t, hostName, translate.Default.HostName(nil, attacker.Name, attacker.Namespace), "test names don't collide")
+
+			test := syncertesting.SyncTest{
+				InitialVirtualState: append([]runtime.Object{
+					&corev1.Namespace{ObjectMeta: metav1.ObjectMeta{Name: victim.Namespace}},
+					&corev1.Namespace{ObjectMeta: metav1.ObjectMeta{Name: attacker.Namespace}},
+					&corev1.Service{ObjectMeta: metav1.ObjectMeta{Namespace: victim.Namespace, Name: "web"}},
+					endpointSlice(victim, "web"),
+				}, tc.virtualState...),
+			}
+			pClient, vClient, vConfig := test.Setup()
+			registerContext := syncertesting.NewFakeRegisterContext(vConfig, pClient, vClient)
+			_, s := newFakeSyncer(t, registerContext)
+			controller, err := syncer.NewSyncController(registerContext, s)
+			assert.NilError(t, err)
+
+			reconcile := func(req types.NamespacedName) {
+				_, err := controller.Reconcile(t.Context(), ctrl.Request{NamespacedName: req})
+				assert.NilError(t, err)
+			}
+			hostOwner := func() types.NamespacedName {
+				pEndpointSlice := &discoveryv1.EndpointSlice{}
+				assert.NilError(t, pClient.Get(t.Context(), hostName, pEndpointSlice), "host endpoint slice of %s was deleted", victim)
+				return types.NamespacedName{Namespace: pEndpointSlice.Annotations[translate.NamespaceAnnotation], Name: pEndpointSlice.Annotations[translate.NameAnnotation]}
+			}
+
+			reconcile(victim)
+			assert.Equal(t, hostOwner(), victim)
+
+			reconcile(attacker)
+			assert.Equal(t, hostOwner(), victim)
+		})
+	}
+}
+
+// prod-x-team/web, a service with a selector, and team/web-x-prod, a service without a selector,
+// translate to the same host service name. Reconciling an endpoint slice of team/web-x-prod must
+// neither delete a host endpoint slice nor sync a host endpoint slice that would add endpoints to
+// the host service of prod-x-team/web.
+func TestReconcileDoesNotSyncEndpointSliceOfCollidingService(t *testing.T) {
+	victimService := types.NamespacedName{Namespace: "prod-x-team", Name: "web"}
+	attackerService := types.NamespacedName{Namespace: "team", Name: "web-x-prod"}
+	attacker := types.NamespacedName{Namespace: attackerService.Namespace, Name: "web-x-prod-abcde"}
+
+	testCases := []struct {
+		name          string
+		physicalState []runtime.Object
+	}{
+		{
+			name: "host endpoint slice is missing",
+		},
+		{
+			name: "host endpoint slice is maintained by the host cluster",
+			physicalState: []runtime.Object{
+				&discoveryv1.EndpointSlice{
+					ObjectMeta: metav1.ObjectMeta{
+						Namespace: testingutil.DefaultTestTargetNamespace,
+						Name:      translate.SingleNamespaceHostName(attacker.Name, attacker.Namespace, translate.VClusterName),
+						Labels:    map[string]string{translate.K8sServiceNameLabel: "other"},
+					},
+					AddressType: discoveryv1.AddressTypeIPv4,
+				},
+			},
+		},
+	}
+
+	for _, tc := range testCases {
+		t.Run(tc.name, func(t *testing.T) {
+			translate.Default = translate.NewSingleNamespaceTranslator(testingutil.DefaultTestTargetNamespace)
+			hostServiceName := translate.Default.HostName(nil, victimService.Name, victimService.Namespace)
+			assert.Equal(t, hostServiceName, translate.Default.HostName(nil, attackerService.Name, attackerService.Namespace), "test names don't collide")
+
+			test := syncertesting.SyncTes
```

**File**: `pkg/controllers/resources/pods/syncer_collision_test.go` (added, +75/-0)
```diff
@@ -0,0 +1,75 @@
+package pods
+
+import (
+	"testing"
+
+	"gotest.tools/assert"
+	corev1 "k8s.io/api/core/v1"
+	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
+	"k8s.io/apimachinery/pkg/runtime"
+	"k8s.io/apimachinery/pkg/types"
+	ctrl "sigs.k8s.io/controller-runtime"
+
+	"github.com/loft-sh/vcluster/pkg/specialservices"
+	"github.com/loft-sh/vcluster/pkg/syncer"
+	syncertesting "github.com/loft-sh/vcluster/pkg/syncer/testing"
+	syncertypes "github.com/loft-sh/vcluster/pkg/syncer/types"
+	testingutil "github.com/loft-sh/vcluster/pkg/util/testing"
+	"github.com/loft-sh/vcluster/pkg/util/translate"
+)
+
+// prod-x-team/creds and team/creds-x-prod translate to the same host name. A pod in team that
+// mounts creds-x-prod must not get the host secret of prod-x-team/creds.
+func TestSecretReferenceDoesNotResolveToCollidingHostSecret(t *testing.T) {
+	translate.Default = translate.NewSingleNamespaceTranslator(testingutil.DefaultTestTargetNamespace)
+	specialservices.Default = specialservices.NewDefaultServiceSyncer()
+
+	victimSecret := types.NamespacedName{Namespace: "prod-x-team", Name: "creds"}
+	attackerSecret := types.NamespacedName{Namespace: "team", Name: "creds-x-prod"}
+	victimHostSecret := translate.Default.HostName(nil, victimSecret.Name, victimSecret.Namespace).Name
+	assert.Equal(t, victimHostSecret, translate.Default.HostName(nil, attackerSecret.Name, attackerSecret.Namespace).Name, "test names don't collide")
+
+	victimPod := podWithSecretVolume(types.NamespacedName{Namespace: victimSecret.Namespace, Name: "web"}, victimSecret.Name)
+	attackerPod := podWithSecretVolume(types.NamespacedName{Namespace: attackerSecret.Namespace, Name: "app"}, attackerSecret.Name)
+	test := syncertesting.SyncTest{
+		InitialVirtualState: []runtime.Object{
+			&corev1.Namespace{ObjectMeta: metav1.ObjectMeta{Name: victimSecret.Namespace}},
+			&corev1.Namespace{ObjectMeta: metav1.ObjectMeta{Name: attackerSecret.Namespace}},
+			&corev1.Secret{ObjectMeta: metav1.ObjectMeta{Namespace: victimSecret.Namespace, Name: victimSecret.Name}},
+			&corev1.Secret{ObjectMeta: metav1.ObjectMeta{Namespace: attackerSecret.Namespace, Name: attackerSecret.Name}},
+			victimPod,
+			attackerPod,
+		},
+		InitialPhysicalState: []runtime.Object{pVclusterService.DeepCopy(), pDNSService.DeepCopy()},
+	}
+	pClient, vClient, vConfig := test.Setup()
+	registerContext := syncertesting.NewFakeRegisterContext(vConfig, pClient, vClient)
+	_, s := syncertesting.FakeStartSyncer(t, registerContext, New)
+	controller, err := syncer.NewSyncController(registerContext, s.(syncertypes.Syncer))
+	assert.NilError(t, err)
+
+	hostSecretName := func(vPod *corev1.Pod) string {
+		_, err := controller.Reconcile(t.Context(), ctrl.Request{NamespacedName: types.NamespacedName{Namespace: vPod.Namespace, Name: vPod.Name}})
+		assert.NilError(t, err)
+
+		pPod := &corev1.Pod{}
+		assert.NilError(t, pClient.Get(t.Context(), translate.Default.HostName(nil, vPod.Name, vPod.Namespace), pPod))
+		return pPod.Spec.Volumes[0].Secret.SecretName
+	}
+
+	assert.Equal(t, hostSecretName(victimPod), victimHostSecret)
+	assert.Equal(t, hostSecretName(attackerPod), "", "attacker pod got the host secret of another namespace")
+}
+
+func podWithSecretVolume(name types.NamespacedName, secretName string) *corev1.Pod {
+	return &corev1.Pod{
+		ObjectMeta: metav1.ObjectMeta{Namespace: name.Namespace, Name: name.Name, UID: types.UID(name.String())},
+		Spec: corev1.PodSpec{
+			Containers: []corev1.Container{{Name: "c1", Image: "nginx"}},
+			Volumes: []corev1.Volume{{
+				Name:         "creds",
+				VolumeSource: corev1.VolumeSource{Secret: &corev1.SecretVolumeSource{SecretName: secretName}},
+			}},
+		},
+	}
+}
```

**File**: `pkg/controllers/resources/services/syncer_collision_test.go` (added, +77/-0)
```diff
@@ -0,0 +1,77 @@
+package services
+
+import (
+	"testing"
+
+	"gotest.tools/assert"
+	corev1 "k8s.io/api/core/v1"
+	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
+	"k8s.io/apimachinery/pkg/runtime"
+	"k8s.io/apimachinery/pkg/types"
+	ctrl "sigs.k8s.io/controller-runtime"
+
+	"github.com/loft-sh/vcluster/pkg/specialservices"
+	"github.com/loft-sh/vcluster/pkg/syncer"
+	syncertesting "github.com/loft-sh/vcluster/pkg/syncer/testing"
+	syncertypes "github.com/loft-sh/vcluster/pkg/syncer/types"
+	testingutil "github.com/loft-sh/vcluster/pkg/util/testing"
+	"github.com/loft-sh/vcluster/pkg/util/translate"
+)
+
+// a-x-b/svc and b/svc-x-a translate to the same host name. Services skip the UID check, so
+// reconciling or deleting b/svc-x-a must neither take over nor delete the host service of a-x-b/svc.
+func TestReconcileDoesNotTouchCollidingHostService(t *testing.T) {
+	translate.Default = translate.NewSingleNamespaceTranslator(testingutil.DefaultTestTargetNamespace)
+	specialservices.Default = specialservices.NewDefaultServiceSyncer()
+
+	victim := types.NamespacedName{Namespace: "a-x-b", Name: "svc"}
+	attacker := types.NamespacedName{Namespace: "b", Name: "svc-x-a"}
+	hostName := translate.Default.HostName(nil, victim.Name, victim.Namespace)
+	assert.Equal(t, hostName, translate.Default.HostName(nil, attacker.Name, attacker.Namespace), "test names don't collide")
+
+	attackerService := serviceWithPort(attacker, 9999)
+	test := syncertesting.SyncTest{
+		InitialVirtualState: []runtime.Object{
+			&corev1.Namespace{ObjectMeta: metav1.ObjectMeta{Name: victim.Namespace}},
+			&corev1.Namespace{ObjectMeta: metav1.ObjectMeta{Name: attacker.Namespace}},
+			serviceWithPort(victim, 80),
+			attackerService,
+		},
+	}
+	pClient, vClient, vConfig := test.Setup()
+	registerContext := syncertesting.NewFakeRegisterContext(vConfig, pClient, vClient)
+	_, s := syncertesting.FakeStartSyncer(t, registerContext, New)
+	controller, err := syncer.NewSyncController(registerContext, s.(syncertypes.Syncer))
+	assert.NilError(t, err)
+
+	reconcile := func(req types.NamespacedName) {
+		_, err := controller.Reconcile(t.Context(), ctrl.Request{NamespacedName: req})
+		assert.NilError(t, err)
+	}
+	assertHostServiceOfVictim := func() {
+		pService := &corev1.Service{}
+		assert.NilError(t, pClient.Get(t.Context(), hostName, pService), "host service of %s was deleted", victim)
+		assert.Equal(t, pService.Annotations[translate.NamespaceAnnotation], victim.Namespace)
+		assert.Equal(t, pService.Annotations[translate.NameAnnotation], victim.Name)
+		assert.Equal(t, pService.Spec.Ports[0].Port, int32(80))
+	}
+
+	reconcile(victim)
+	assertHostServiceOfVictim()
+
+	reconcile(attacker)
+	assertHostServiceOfVictim()
+
+	assert.NilError(t, vClient.Delete(t.Context(), attackerService))
+	reconcile(attacker)
+	assertHostServiceOfVictim()
+}
+
+func serviceWithPort(name types.NamespacedName, port int32) *corev1.Service {
+	return &corev1.Service{
+		ObjectMeta: metav1.ObjectMeta{Namespace: name.Namespace, Name: name.Name, UID: types.UID(name.String())},
+		Spec: corev1.ServiceSpec{
+			Ports: []corev1.ServicePort{{Name: "http", Port: port, Protocol: corev1.ProtocolTCP}},
+		},
+	}
+}
```

---

### Incident Patch 2: `6ba83b53` (2026-11-23)
**Commit Message**: fix(telemetry): send a config summary and an error category from the control plane (#2764)

* fix(telemetry): send a config summary and an error category from the control plane

Build vcluster_start and vcluster_error from a summary of the config and
an error category instead of the raw config and error text. The summary
keeps the vcluster.yaml keys, booleans, numbers, list and map sizes and a
few checked values. Kubernetes versions are trimmed to their release form,
and panics carry function names and lines.

* fix(telemetry): send the vcluster version with control plane errors

* refactor(telemetry): use plain keys for the control plane properties

Monorepo-Commit: e35fb25dbe0063b115173c8692a3f4fc6f57daf0

**File**: `pkg/leaderelection/leaderelection.go` (modified, +1/-1)
```diff
@@ -141,7 +141,7 @@ func StartLeaderElection(ctx *synccontext.ControllerContext, scheme *runtime.Sch
 				klog.Info("leader election lost")
 
 				// vcluster_error
-				telemetry.CollectorControlPlane.RecordError(ctx, ctx.Config, telemetry.WarningSeverity, fmt.Errorf("leader election lost"))
+				telemetry.CollectorControlPlane.RecordError(ctx, ctx.Config, telemetry.WarningSeverity, telemetry.ErrLeaderElectionLost)
 				telemetry.CollectorControlPlane.Flush()
 
 				osutil.Exit(1)
```

**File**: `pkg/telemetry/cli_event.go` (modified, +2/-0)
```diff
@@ -97,6 +97,8 @@ func errorCategory(err error) string {
 	)
 
 	switch {
+	case errors.Is(err, ErrLeaderElectionLost):
+		return "leader_election_lost"
 	case errors.Is(err, context.Canceled):
 		return "canceled"
 	case errors.Is(err, context.DeadlineExceeded):
```

**File**: `pkg/telemetry/cli_event_test.go` (modified, +2/-0)
```diff
@@ -395,6 +395,8 @@ func TestErrorCategory(t *testing.T) {
 		expected string
 	}{
 		{name: "plain error", err: errors.New(commandLineValue), expected: "other"},
+		{name: "leader election lost", err: wrap(ErrLeaderElectionLost), expected: "leader_election_lost"},
+		{name: "text of the leader election error without its value", err: errors.New(ErrLeaderElectionLost.Error()), expected: "other"},
 		{name: "vcluster not found", err: wrap(&find.VClusterNotFoundError{Name: commandLineValue}), expected: "vcluster_not_found"},
 		{name: "kubernetes unauthorized", err: wrap(kerrors.NewUnauthorized(commandLineValue)), expected: "kubernetes_unauthorized"},
 		{name: "kubernetes forbidden", err: wrap(kerrors.NewForbidden(secretsResource, commandLineValue, errors.New(commandLineValue))), expected: "kubernetes_forbidden"},
```

**File**: `pkg/telemetry/collect_controlplane.go` (modified, +45/-22)
```diff
@@ -3,7 +3,9 @@ package telemetry
 import (
 	"context"
 	"encoding/json"
+	"errors"
 	"runtime"
+	"strconv"
 	"time"
 
 	"github.com/loft-sh/analytics-client/client"
@@ -20,8 +22,20 @@ import (
 
 var CollectorControlPlane ControlPlaneCollector = &noopCollector{}
 
+// ErrLeaderElectionLost is what RecordError is given when the control plane
+// stops because it lost the leader election.
+var ErrLeaderElectionLost = errors.New("leader election lost")
+
+// isInstanceCreator accepts what the CLI and the platform write to
+// telemetry.instanceCreator.
+var isInstanceCreator = oneOf("vclusterctl", "loft")
+
 type ControlPlaneCollector interface {
 	RecordStart(ctx context.Context, config *config.VirtualClusterConfig)
+
+	// RecordError records the kind of err, never its text. With PanicSeverity
+	// it has to be called from the deferred function that recovered the panic,
+	// because it records the functions on the stack of its caller.
 	RecordError(ctx context.Context, config *config.VirtualClusterConfig, severity ErrorSeverityType, err error)
 
 	// Flush makes sure all events are sent to the backend
@@ -117,18 +131,19 @@ func (d *controlPlaneCollector) RecordStart(ctx context.Context, config *config.
 		return
 	}
 
-	chartInfo := d.getChartInfo(config)
+	creationMethod := config.Telemetry.InstanceCreator
+	if creationMethod != "" && !isInstanceCreator(creationMethod) {
+		creationMethod = "other"
+	}
 	properties := map[string]interface{}{
 		"vcluster_version":            SyncerVersion,
 		"vcluster_k8s_distro_version": d.getVirtualClusterVersion(),
 		"host_cluster_k8s_version":    d.getHostClusterVersion(),
 		"os_arch":                     runtime.GOOS + "/" + runtime.GOARCH,
-		"creation_method":             config.Telemetry.InstanceCreator,
+		"creation_method":             creationMethod,
 		"creation_timestamp":          d.getVClusterCreationTimestamp(ctx),
-	}
-	if chartInfo != nil {
-		properties["vcluster_k8s_distro"] = chartInfo.Name
-		properties["helm_values"] = chartInfo.Values
+		"vcluster_k8s_distro":         translate.VClusterName,
+		"helm_values":                 configSummary(&config.Config),
 	}
 
 	// build the event and record
@@ -157,16 +172,15 @@ func (d *controlPlaneCollector) RecordError(ctx context.Context, config *config.
 	}
 
 	properties := map[string]interface{}{
-		"severity": string(severity),
-		"message":  err.Error(),
+		"vcluster_version": SyncerVersion,
+		"severity":         string(severity),
+		"message":          errorCategory(err),
 	}
-
-	// if panic or fatal we add the helm values
 	if severity == PanicSeverity || severity == FatalSeverity {
-		chartInfo := d.getChartInfo(config)
-		if chartInfo != nil {
-			properties["helm_values"] = chartInfo.Values
-		}
+		properties["helm_values"] = configSummary(&config.Config)
+	}
+	if severity == PanicSeverity {
+		properties["stack"] = callerFunctions()
 	}
 
 	// build the event and record
@@ -210,14 +224,6 @@ func (d *controlPlaneCollector) getHostClusterVersion() *KubernetesVersion {
 	return hostVersion
 }
 
-func (d *controlPlaneCollector) getChartInfo(config *config.VirtualClusterConfig) *ChartInfo {
-	return &ChartInfo{
-		Name:    translate.VClusterName,
-		Version: SyncerVersion,
-		Values:  config,
-	}
-}
-
 func (d *controlPlaneCollector) getVClusterID(ctx context.Context) string {
 	if d.hostClient == nil {
 		return ""
@@ -281,3 +287,20 @@ func (d *controlPlaneCollector) getMetrics(ctx context.Context) map[string]inter
 
 	return retMap
 }
+
+// callerFunctions names the functions on the stack of the goroutine, starting
+// at the caller of the function that calls it, each with its line. Unlike a
+// stack trace it has no argument values and no panic message.
+func callerFunctions() []string {
+	programCounters := make([]uintptr, 64)
+	frames := runtime.CallersFrames(programCounters[:runtime.Callers(3, programCounters)])
+
+	functions := []string{}
+	for {
+		frame, more := frames.Next()
+		functions = append(functions, frame.Function+":"+strconv.Itoa(frame.Line))
+		if !more {
+			return functions
+		}
+	}
+}
```

**File**: `pkg/telemetry/collect_controlplane_test.go` (added, +334/-0)
```diff
@@ -0,0 +1,334 @@
+package telemetry
+
+import (
+	"context"
+	"encoding/json"
+	"fmt"
+	goruntime "runtime"
+	"runtime/debug"
+	"strings"
+	"testing"
+	"time"
+
+	"github.com/loft-sh/analytics-client/client"
+	vclusterconfig "github.com/loft-sh/vcluster/config"
+	"github.com/loft-sh/vcluster/pkg/config"
+	"github.com/loft-sh/vcluster/pkg/strvals"
+	"github.com/loft-sh/vcluster/pkg/util/loghelper"
+	"github.com/loft-sh/vcluster/pkg/util/translate"
+	"gotest.tools/v3/assert"
+	corev1 "k8s.io/api/core/v1"
+	kerrors "k8s.io/apimachinery/pkg/api/errors"
+	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
+	"k8s.io/apimachinery/pkg/runtime"
+	"k8s.io/apimachinery/pkg/runtime/schema"
+	"k8s.io/apimachinery/pkg/version"
+	fakediscovery "k8s.io/client-go/discovery/fake"
+	"k8s.io/client-go/kubernetes/fake"
+	"sigs.k8s.io/yaml"
+)
+
+// Plain alphanumeric on purpose, see commandLineValue.
+const configValue = "c0nf1gvalue"
+
+// userValues is what a user passes to helm install, with configValue in free
+// text of every kind the config has: secrets, hostnames, map keys, manifests
+// and env values.
+const userValues = `
+controlPlane:
+  backingStore:
+    database:
+      external:
+        enabled: true
+        dataSource: mysql://admin:c0nf1gvalue@tcp(db.internal:3306)/vcluster
+  statefulSet:
+    highAvailability:
+      replicas: 3
+    labels:
+      team-c0nf1gvalue: payments
+    env:
+      - name: HTTPS_PROXY
+        value: http://proxy:c0nf1gvalue@proxy.internal:3128
+  ingress:
+    enabled: true
+    host: c0nf1gvalue.example.com
+sync:
+  toHost:
+    ingresses:
+      enabled: true
+    customResources:
+      certificates.c0nf1gvalue.io:
+        enabled: true
+  fromHost:
+    nodes:
+      enabled: true
+      selector:
+        labels:
+          pool: c0nf1gvalue
+privateNodes:
+  joinNode:
+    containerd:
+      registry:
+        auth:
+          registry.c0nf1gvalue.internal:
+            username: puller
+            password: c0nf1gvalue
+            identityToken: c0nf1gvalue
+policies:
+  podSecurityStandard: baseline
+  resourceQuota:
+    enabled: true
+logging:
+  encoding: c0nf1gvalue
+experimental:
+  deploy:
+    vcluster:
+      manifests: |
+        apiVersion: v1
+        kind: Secret
+        metadata:
+          name: registry-creds
+        stringData:
+          password: c0nf1gvalue
+      helm:
+        - chart:
+            name: internal-app
+            repo: https://charts.internal
+            username: deploy
+            password: c0nf1gvalue
+telemetry:
+  instanceCreator: vclusterctl
+`
+
+// parseChartConfig returns the config the control plane loads after a helm
+// install with values: the chart writes its defaults merged with the values
+// to the config secret, and the control plane parses that.
+func parseChartConfig(t *testing.T, values string) *config.VirtualClusterConfig {
+	t.Helper()
+
+	chartValues, overrides := map[string]interface{}{}, map[string]interface{}{}
+	assert.NilError(t, yaml.Unmarshal([]byte(vclusterconfig.Values), &chartValues))
+	assert.NilError(t, yaml.Unmarshal([]byte(values), &overrides))
+
+	rawConfig, err := yaml.Marshal(strvals.MergeMaps(chartValues, overrides))
+	assert.NilError(t, err)
+
+	vConfig, err := config.ParseConfigBytes(rawConfig, "my-vcluster", nil)
+	assert.NilError(t, err)
+	vConfig.HostNamespace = "namespace-" + configValue
+	vConfig.Path = "/" + configValue + "/config.yaml"
+
+	return vConfig
+}
+
+// lookup returns the value at a dotted path of nested maps, nil if there is
+// none.
+func lookup(values map[string]interface{}, path string) interface{} {
+	var current interface{} = values
+	for _, key := range strings.Split(path, ".") {
+		object, _ := current.(map[string]interface{})
+		current = object[key]
+	}
+
+	return current
+}
+
+func toJSONObject(t *testing.T, value interface{}) map[string]interface{} {
+	t.Helper()
+
+	raw, err := json.Marshal(value)
+	assert.NilError(t, err)
+	object := map[string]interface{}{}
+	assert.NilError(t, json.Unmarshal(raw, &object))
+
+	return object
+}
+
+func TestKubernetesVersion(t *testing.T) {
+	testCases := []struct {
+		name     string
+		reported version.Info
+		expected KubernetesVersion
+	}{
+		{name: "upstream", reported: version.Info{Major: "1", Minor: "36", GitVersion: "v1.36.6"}, expected: KubernetesVersion{Major: "1", Minor: "36", GitVersion: "v1.36.6"}},
+		{name: "release candidate", reported: version.Info{Major: "1", Minor: "37", GitVersion: "v1.37.0-rc.1"}, expected: KubernetesVersion{Major: "1", Minor: "37", GitVersion: "v1.37.0-rc.1"}},
+		{name: "eks", reported: version.Info{Major: "1", Minor: "33+", GitVersion: "v1.33.5-eks-113cf36"}, expected: KubernetesVersion{Major: "1", Minor: "33+", GitVersion: "v1.33.5-eks"}},
+		{name: "gke", reported: version.Info{Major: "1", Minor: "33", GitVersion: "v1.33.5-gke.1162000"}, expected: KubernetesVersion{Major: "1", Minor: "33", GitVersion: "v1.33.5-gke"}},
+		{name: "k3s", reported: version.Info{Major: "1", Minor: "3
```

**File**: `pkg/telemetry/config_summary.go` (added, +150/-0)
```diff
@@ -0,0 +1,150 @@
+package telemetry
+
+import (
+	"maps"
+	"reflect"
+	"strings"
+
+	"github.com/loft-sh/vcluster/config"
+)
+
+// sentConfigTypes lists the string types of the config whose value is sent,
+// and the check a value has to pass.
+var sentConfigTypes = map[reflect.Type]func(string) bool{
+	reflect.TypeOf(config.StrBool("")): oneOf("true", "false", "auto"),
+	reflect.TypeOf(config.DNSPolicy("")): oneOf(string(config.DNSClusterFirstWithHostNet), string(config.DNSClusterFirst),
+		string(config.DNSDefault), string(config.DNSNone)),
+}
+
+// sentConfigValues lists, by config path, the plain string fields whose value
+// is sent, and the check a value has to pass. A path belongs here only if
+// every value its check accepts is safe to send. Paths below a list or a map
+// cannot be listed: those are sent as a count.
+var sentConfigValues = map[string]func(string) bool{
+	"controlPlane.distro.k8s.version":                                  releaseVersion.MatchString,
+	"controlPlane.distro.k8s.image.tag":                                releaseVersion.MatchString,
+	"controlPlane.statefulSet.scheduling.podManagementPolicy":          oneOf("Parallel", "OrderedReady"),
+	"controlPlane.statefulSet.persistence.volumeClaim.retentionPolicy": oneOf("Retain", "Delete"),
+	"policies.podSecurityStandard":                                     oneOf("privileged", "baseline", "restricted"),
+	"logging.encoding":                                                 oneOf("console", "json"),
+}
+
+// configSummary describes what is configured without any free-form value. It
+// follows the config types, so the result has the keys of vcluster.yaml and
+// nothing a user wrote:
+//   - booleans and numbers are sent as they are
+//   - a string is sent as true, meaning it is set, unless its type is in
+//     sentConfigTypes or its path in sentConfigValues and the value passes
+//     the check
+//   - lists and maps are sent as their number of entries, so the keys of a
+//     map are never sent
+//
+// Values that are empty, false or zero are left out, except behind a pointer
+// or in an untyped field, where false and zero were set on purpose.
+func configSummary(vConfig *config.Config) map[string]interface{} {
+	summary, _ := summarizeConfigValue(reflect.ValueOf(vConfig), "").(map[string]interface{})
+	return summary
+}
+
+// summarizeConfigValue returns nil for a value that is left out.
+func summarizeConfigValue(value reflect.Value, path string) interface{} {
+	switch value.Kind() {
+	case reflect.Pointer, reflect.Interface:
+		if value.IsNil() {
+			return nil
+		}
+
+		elem := value.Elem()
+		switch {
+		case elem.Kind() == reflect.Bool:
+			return elem.Bool()
+		case elem.CanInt():
+			return elem.Int()
+		case elem.CanUint():
+			return elem.Uint()
+		case elem.CanFloat():
+			return elem.Float()
+		case value.Kind() == reflect.Pointer:
+			return summarizeConfigValue(elem, path)
+		case elem.Kind() == reflect.Map || elem.Kind() == reflect.Slice:
+			return nonZero(elem.Len())
+		default:
+			return true
+		}
+	case reflect.Struct:
+		summary := map[string]interface{}{}
+		for i := range value.NumField() {
+			field := value.Type().Field(i)
+			name, _, _ := strings.Cut(field.Tag.Get("json"), ",")
+			if !field.IsExported() || name == "-" {
+				continue
+			}
+
+			// an embedded struct has its fields at the level of the struct
+			// holding it, as in vcluster.yaml
+			if field.Anonymous && name == "" {
+				embedded, _ := summarizeConfigValue(value.Field(i), path).(map[string]interface{})
+				maps.Copy(summary, embedded)
+				continue
+			}
+
+			if name == "" {
+				name = field.Name
+			}
+			if fieldSummary := summarizeConfigValue(value.Field(i), strings.TrimPrefix(path+"."+name, ".")); fieldSummary != nil {
+				summary[name] = fieldSummary
+			}
+		}
+		if len(summary) == 0 {
+			return nil
+		}
+		return summary
+	case reflect.Map, reflect.Slice, reflect.Array:
+		return nonZero(value.Len())
+	case reflect.Bool:
+		if !value.Bool() {
+			return nil
+		}
+		return true
+	case reflect.Int, reflect.Int8, reflect.Int16, reflect.Int32, reflect.Int64:
+		return nonZero(value.Int())
+	case reflect.Uint, reflect.Uint8, reflect.Uint16, reflect.Uint32, reflect.Uint64:
+		return nonZero(value.Uint())
+	case reflect.Float32, reflect.Float64:
+		return nonZero(value.Float())
+	case reflect.String:
+		text := value.String()
+		if text == "" {
+			return nil
+		}
+
+		isValid := sentConfigTypes[value.Type()]
+		if isValid == nil {
+			isValid = sentConfigValues[path]
+		}
+		isStrBool := value.Type() == reflect.TypeOf(config.StrBool(""))
+		if isValid != nil && isValid(text) {
+			// config.StrBool.MarshalJSON writes these two as booleans
+			if isStrBool && (text == "true" || text == "false") {
+				return text == "true"
+			}
+			return text
+		}
+		// true would read as enabled, which the control plane only does for
+		// "true"
+		if isStrBool {
+			return "other"
+		}
+		return true
+	default:
+		return nil
+	}
+
```

**File**: `pkg/telemetry/config_summary_test.go` (added, +346/-0)
```diff
@@ -0,0 +1,346 @@
+package telemetry
+
+import (
+	"encoding/json"
+	"fmt"
+	"reflect"
+	"strings"
+	"testing"
+
+	vclusterconfig "github.com/loft-sh/vcluster/config"
+	"gotest.tools/v3/assert"
+)
+
+// fillWithText sets every string, map key and untyped value below value to
+// text, with one entry in every map and list, every boolean true and every
+// number 1.
+func fillWithText(value reflect.Value, text string, depth int) {
+	// the config types that contain themselves do so through lists and maps
+	if depth > 30 || !value.CanSet() {
+		return
+	}
+
+	switch value.Kind() {
+	case reflect.Pointer:
+		value.Set(reflect.New(value.Type().Elem()))
+		fillWithText(value.Elem(), text, depth+1)
+	case reflect.Interface:
+		if value.NumMethod() == 0 {
+			value.Set(reflect.ValueOf(map[string]interface{}{text: []interface{}{text}}))
+		}
+	case reflect.Struct:
+		for i := range value.NumField() {
+			fillWithText(value.Field(i), text, depth+1)
+		}
+	case reflect.Map:
+		key := reflect.New(value.Type().Key()).Elem()
+		fillWithText(key, text, depth+1)
+		elem := reflect.New(value.Type().Elem()).Elem()
+		fillWithText(elem, text, depth+1)
+		value.Set(reflect.MakeMap(value.Type()))
+		value.SetMapIndex(key, elem)
+	case reflect.Slice:
+		value.Set(reflect.MakeSlice(value.Type(), 1, 1))
+		fillWithText(value.Index(0), text, depth+1)
+	case reflect.Bool:
+		value.SetBool(true)
+	case reflect.Int, reflect.Int8, reflect.Int16, reflect.Int32, reflect.Int64:
+		value.SetInt(1)
+	case reflect.Uint, reflect.Uint8, reflect.Uint16, reflect.Uint32, reflect.Uint64:
+		value.SetUint(1)
+	case reflect.Float32, reflect.Float64:
+		value.SetFloat(1)
+	case reflect.String:
+		value.SetString(text)
+	default:
+	}
+}
+
+func TestConfigSummaryOfChartConfig(t *testing.T) {
+	vConfig := parseChartConfig(t, userValues)
+
+	// the whole config holds the text, so the fixture can show it is not sent
+	full, err := json.Marshal(vConfig)
+	assert.NilError(t, err)
+	assert.Assert(t, strings.Count(string(full), configValue) >= 12, "config holds %d values", strings.Count(string(full), configValue))
+
+	summary := toJSONObject(t, configSummary(&vConfig.Config))
+	raw, err := json.Marshal(summary)
+	assert.NilError(t, err)
+	assert.Assert(t, !strings.Contains(string(raw), configValue), "summary carries a config value: %s", raw)
+
+	expected := map[string]interface{}{
+		// from the values
+		"controlPlane.backingStore.database.external.enabled":    true,
+		"controlPlane.backingStore.database.external.dataSource": true,
+		"controlPlane.statefulSet.highAvailability.replicas":     3.0,
+		"controlPlane.statefulSet.labels":                        1.0,
+		"controlPlane.statefulSet.env":                           1.0,
+		"controlPlane.ingress.enabled":                           true,
+		"controlPlane.ingress.host":                              true,
+		"sync.toHost.ingresses.enabled":                          true,
+		"sync.toHost.customResources":                            1.0,
+		"sync.fromHost.nodes.enabled":                            true,
+		"sync.fromHost.nodes.selector.labels":                    1.0,
+		"privateNodes.joinNode.containerd.registry.auth":         1.0,
+		"policies.podSecurityStandard":                           "baseline",
+		"policies.resourceQuota.enabled":                         true,
+		"experimental.deploy.vcluster.manifests":                 true,
+		"experimental.deploy.vcluster.helm":                      1.0,
+		"telemetry.instanceCreator":                              true,
+		// a listed path with a value outside its set
+		"logging.encoding": true,
+		// from the chart defaults
+		"controlPlane.statefulSet.scheduling.podManagementPolicy":          "Parallel",
+		"controlPlane.statefulSet.persistence.volumeClaim.retentionPolicy": "Retain",
+		"controlPlane.statefulSet.persistence.volumeClaim.enabled":         "auto",
+		"sync.toHost.pods.enabled":                                         true,
+		"telemetry.enabled":                                                true,
+		"controlPlane.statefulSet.enableServiceLinks":                      true,
+		// false, empty and zero are left out
+		"privateNodes.enabled":                            nil,
+		"controlPlane.backingStore.etcd.embedded.enabled": nil,
+		"controlPlane.distro.k8s.version":                 nil,
+		"experimental.deploy.host":                        nil,
+		"sync.toHost.networkPolicies":                     nil,
+		"controlPlane.statefulSet.scheduling.affinity":    nil,
+	}
+	for path, value := range expected {
+		assert.DeepEqual(t, lookup(summary, path), value)
+	}
+
+	tag, isText := lookup(summary, "controlPlane.distro.k8s.image.tag").(string)
+	assert.Assert(t, isText && releaseVersion.MatchString(tag), "kubernetes image tag is %v", lookup(summary, "controlPlane.distro.k8s.image.tag"))
+}
+
+func TestConfigSummaryHasNoText(t *testing.T) {
+	vConfig := &vclusterconfig.Config{}
+	fillWithText(reflect.ValueOf(vConfig).Elem(), configValue, 0)
+
+	// the
```

**File**: `pkg/telemetry/helpers.go` (modified, +13/-3)
```diff
@@ -5,6 +5,7 @@ import (
 	"crypto/hmac"
 	"crypto/sha256"
 	"fmt"
+	"regexp"
 
 	"github.com/denisbrodbeck/machineid"
 	managementv1 "github.com/loft-sh/api/v5/pkg/apis/management/v1"
@@ -18,6 +19,15 @@ import (
 
 var SyncerVersion = "dev"
 
+// What a Kubernetes server reports as its version is text its operator can
+// set, so only the part with a fixed form is sent. For the git version that is
+// the start, up to the name of the distribution if it is one of these.
+var (
+	kubernetesMajorVersion = regexp.MustCompile(`^\d{1,3}$`)
+	kubernetesMinorVersion = regexp.MustCompile(`^\d{1,3}\+?$`)
+	kubernetesGitVersion   = regexp.MustCompile(`^v\d{1,3}\.\d{1,3}\.\d{1,5}(-(alpha|beta|rc)\.\d{1,4})?([-+](eks|gke|k3s|rke2|k0s))?`)
+)
+
 // getVClusterID provides instance ID based on the UID of the service
 func getVClusterID(ctx context.Context, hostClient kubernetes.Interface, vClusterNamespace, vClusterService string) (string, error) {
 	if hostClient == nil || vClusterService == "" {
@@ -79,9 +89,9 @@ func toKubernetesVersion(vi *version.Info) *KubernetesVersion {
 		return nil
 	}
 	return &KubernetesVersion{
-		Major:      vi.Major,
-		Minor:      vi.Minor,
-		GitVersion: vi.GitVersion,
+		Major:      kubernetesMajorVersion.FindString(vi.Major),
+		Minor:      kubernetesMinorVersion.FindString(vi.Minor),
+		GitVersion: kubernetesGitVersion.FindString(vi.GitVersion),
 	}
 }
 
```

---

### Incident Patch 3: `2b3e0a3d` (2026-11-20)
**Commit Message**: fix: Only warn when a browser is not available on login (#2769)

Monorepo-Commit: 858be09158c43a4ef541352130ea47c4dcbb80e5

**File**: `pkg/cli/start/login.go` (modified, +24/-30)
```diff
@@ -4,12 +4,10 @@ import (
 	"bytes"
 	"crypto/tls"
 	"encoding/json"
-	"errors"
 	"fmt"
 	"io"
 	"net/http"
 	netUrl "net/url"
-	"os/exec"
 	"strings"
 
 	types "github.com/loft-sh/api/v5/pkg/auth"
@@ -21,6 +19,15 @@ import (
 )
 
 const defaultUser = "admin"
+const retryCount = 3
+
+// Variables for testing purposes. They are set to the default implementations, but can be overridden in tests.
+var (
+	// openURL opens a URL in the default browser.
+	openURL = open.Run
+	// cliLogin logs the CLI into the platform.
+	cliLogin = (*LoftStarter).loginViaCLI
+)
 
 func (l *LoftStarter) login(url string) error {
 	if !strings.HasPrefix(url, "https://") {
@@ -29,30 +36,18 @@ func (l *LoftStarter) login(url string) error {
 
 	// check if we are already logged in
 	if l.isLoggedIn(url) {
-		// still open the UI
-		err := open.Run(url)
-		if errors.Is(err, exec.ErrNotFound) {
-			l.Log.Warnf("Couldn't open the login page in a browser. No browser found: %v", err)
-		} else if err != nil {
-			return fmt.Errorf("couldn't open the login page in a browser: %w", err)
-		}
-
-		l.Log.Infof("If the browser does not open automatically, please navigate to %s", url)
-
+		// still open the browser
+		l.openBrowser(url, url)
 		return nil
 	}
 
 	// log into the CLI
-	err := l.loginViaCLI(url)
-	if err != nil {
+	if err := cliLogin(l, url); err != nil {
 		return err
 	}
 
 	// log into the UI
-	err = l.loginUI(url)
-	if err != nil {
-		return err
-	}
+	l.loginUI(url)
 
 	return nil
 }
@@ -71,9 +66,8 @@ func (l *LoftStarter) loginViaCLI(url string) error {
 		TLSClientConfig: &tls.Config{InsecureSkipVerify: config.Platform.Insecure},
 	}}
 
-	// try a couple of times to login
 	accessKey := &types.AccessKey{}
-	for i := 0; i < 3; i++ {
+	for range retryCount {
 		resp, err := httpClient.Post(url+"/auth/password/login", "application/json", bytes.NewBuffer(loginRequestBytes))
 		if err != nil {
 			return err
@@ -113,18 +107,18 @@ func (l *LoftStarter) loginViaCLI(url string) error {
 	return nil
 }
 
-func (l *LoftStarter) loginUI(url string) error {
+func (l *LoftStarter) loginUI(url string) {
 	queryString := fmt.Sprintf("username=%s&password=%s", defaultUser, netUrl.QueryEscape(l.Password))
 	loginURL := fmt.Sprintf("%s/login#%s", url, queryString)
 
-	err := open.Run(loginURL)
-	if errors.Is(err, exec.ErrNotFound) {
-		l.Log.Warnf("Couldn't open the login page in a browser. No browser found: %v", err)
-	} else if err != nil {
-		return fmt.Errorf("couldn't open the login page in a browser: %w", err)
-	}
-
-	l.Log.Infof("If the browser does not open automatically, please navigate to %s", url)
+	l.openBrowser(loginURL, url)
+}
 
-	return nil
+// openBrowser tries to open target in the default browser. Failures are logged, not returned.
+// displayURL is what gets logged, and it differs from target when target holds secrets such as a password.
+func (l *LoftStarter) openBrowser(target, displayURL string) {
+	if err := openURL(target); err != nil {
+		l.Log.Warnf("Couldn't open %s in a browser: %v", displayURL, err)
+	}
+	l.Log.Infof("If the browser does not open automatically, please navigate to %s", displayURL)
 }
```

**File**: `pkg/cli/start/login_test.go` (added, +175/-0)
```diff
@@ -0,0 +1,175 @@
+package start
+
+import (
+	"bytes"
+	"errors"
+	"path/filepath"
+	"testing"
+
+	"github.com/loft-sh/log"
+	"github.com/loft-sh/vcluster/pkg/cli/flags"
+	"github.com/sirupsen/logrus"
+	"gotest.tools/v3/assert"
+)
+
+// stubOpenURL replaces openURL for the duration of the test and records the URL it was called with.
+func stubOpenURL(t *testing.T, err error) *string {
+	t.Helper()
+
+	var opened string
+	original := openURL
+	openURL = func(input string) error {
+		opened = input
+		return err
+	}
+	t.Cleanup(func() { openURL = original })
+
+	return &opened
+}
+
+func newTestStarter(password string) (*LoftStarter, *bytes.Buffer) {
+	out := &bytes.Buffer{}
+	l := &LoftStarter{}
+	l.Log = log.NewStreamLogger(out, out, logrus.InfoLevel)
+	l.Password = password
+	return l, out
+}
+
+func TestOpenBrowser(t *testing.T) {
+	const (
+		url        = "https://localhost:9898"
+		infoLog    = "If the browser does not open automatically, please navigate to " + url
+		warningLog = "Couldn't open " + url + " in a browser: open failed"
+	)
+
+	testCases := []struct {
+		name        string
+		openErr     error
+		wantWarning bool
+	}{
+		{
+			name:        "browser opens",
+			openErr:     nil,
+			wantWarning: false,
+		},
+		{
+			name:        "browser fails to open",
+			openErr:     errors.New("open failed"),
+			wantWarning: true,
+		},
+	}
+
+	for _, tc := range testCases {
+		t.Run(tc.name, func(t *testing.T) {
+			opened := stubOpenURL(t, tc.openErr)
+			l, out := newTestStarter("")
+
+			l.openBrowser(url, url)
+
+			assert.Equal(t, *opened, url)
+			assert.Assert(t, bytes.Contains(out.Bytes(), []byte(infoLog)), "log output: %q", out.String())
+			assert.Equal(t, bytes.Contains(out.Bytes(), []byte(warningLog)), tc.wantWarning, "log output: %q", out.String())
+		})
+	}
+}
+
+// stubCLILogin replaces cliLogin with a no-op for the duration of the test and reports whether it was called.
+func stubCLILogin(t *testing.T) *bool {
+	t.Helper()
+
+	called := false
+	original := cliLogin
+	cliLogin = func(*LoftStarter, string) error {
+		called = true
+		return nil
+	}
+	t.Cleanup(func() { cliLogin = original })
+
+	return &called
+}
+
+// setLoggedInHost sets the platform host in the CLI config, which is what isLoggedIn compares against.
+// config.Read caches a single config for the whole process, so this edits the loaded config instead of writing a file.
+func setLoggedInHost(t *testing.T, l *LoftStarter, host string) {
+	t.Helper()
+
+	l.GlobalFlags = &flags.GlobalFlags{Config: filepath.Join(t.TempDir(), "config.json")}
+	cfg := l.LoadedConfig(l.Log)
+	original := cfg.Platform.Host
+	cfg.Platform.Host = host
+	t.Cleanup(func() { cfg.Platform.Host = original })
+}
+
+func TestLoginSucceedsWhenBrowserFailsToOpen(t *testing.T) {
+	const url = "https://localhost:9898"
+
+	testCases := []struct {
+		name         string
+		loggedInHost string
+		wantCLILogin bool
+		wantOpened   string
+	}{
+		{
+			name:         "not logged in yet",
+			loggedInHost: "",
+			wantCLILogin: true,
+			wantOpened:   url + "/login#username=admin&password=password",
+		},
+		{
+			name:         "already logged in",
+			loggedInHost: url,
+			wantCLILogin: false,
+			wantOpened:   url,
+		},
+	}
+
+	for _, tc := range testCases {
+		t.Run(tc.name, func(t *testing.T) {
+			opened := stubOpenURL(t, errors.New("open failed"))
+			cliLoginCalled := stubCLILogin(t)
+			l, out := newTestStarter("password")
+			setLoggedInHost(t, l, tc.loggedInHost)
+
+			err := l.login(url)
+
+			assert.NilError(t, err)
+			assert.Equal(t, *cliLoginCalled, tc.wantCLILogin)
+			assert.Equal(t, *opened, tc.wantOpened)
+			assert.Assert(t, bytes.Contains(out.Bytes(), []byte("Couldn't open "+url+" in a browser")), "log output: %q", out.String())
+		})
+	}
+}
+
+func TestLoginUIDoesNotLogPassword(t *testing.T) {
+	const (
+		url      = "https://localhost:9898"
+		password = "s3cr&t pass"
+	)
+
+	testCases := []struct {
+		name    string
+		openErr error
+	}{
+		{
+			name:    "browser opens",
+			openErr: nil,
+		},
+		{
+			name:    "browser fails to open",
+			openErr: errors.New("open failed"),
+		},
+	}
+
+	for _, tc := range testCases {
+		t.Run(tc.name, func(t *testing.T) {
+			opened := stubOpenURL(t, tc.openErr)
+			l, out := newTestStarter(password)
+
+			l.loginUI(url)
+
+			assert.Equal(t, *opened, url+"/login#username=admin&password=s3cr%26t+pass")
+			assert.Assert(t, bytes.Contains(out.Bytes(), []byte(url)), "log output: %q", out.String())
+			assert.Assert(t, !bytes.Contains(out.Bytes(), []byte("s3cr")), "password leaked into log output: %q", out.String())
+		})
+	}
+}
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

## X. syncer): skip host objects that belong to another virtual object

**RULE**:
When implementing operations in `e2e/suite_e2e_test.go`, engineers MUST enforce rigorous boundary validation, safe state transitions, and memory/concurrency invariants as established by production defect remediation in loft-sh/vcluster. All inputs crossing module boundaries must be explicitly verified before state persistence.

**WHY**:
Prevents defects observed in production commit `1671d54b`: syncer): skip host objects that belong to another virtual object. Unvalidated execution paths cause runtime exceptions, race conditions, and silent state corruption under concurrent workloads.

**WHEN TO APPLY**:
Subsystems managing Go data structures, boundary deserialization, API parsing, or resource lifecycles matching `e2e/suite_e2e_test.go`.

**VERIFIED IMPLEMENTATION PATTERN**:
```go
// Verified production-grade fix pattern:
			test_core.HostNameCollisionSpec()
```

**NEGATIVE CONSTRAINT**:
```go
// Induced defect failure mode:
// Defect-prone omission of boundary validation
```

**VERIFICATION METHOD**:
Automated regression test asserting that input states reproducing defect `1671d54b` are properly handled with clean fallback behavior.


## 3. Application to AI-Builder-Brain Project Construction
- **Applied Blueprints**: `astro-tailwind-v4`, `fullstack-ai-saas`, `universal-native-factory`
- **Regression Shield**: Prevents architectural drift across construction cycles.
