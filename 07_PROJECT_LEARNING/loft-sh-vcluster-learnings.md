# Forensic Learning Record (Deep Inspection): loft-sh/vcluster

> **Canonical Artifact**: `07_PROJECT_LEARNING/loft-sh-vcluster-learnings.md`  
> **Source Platform**: GitHub ([https://github.com/loft-sh/vcluster](https://github.com/loft-sh/vcluster))  
> **Harvest Method**: Full-Spectrum Deep Extraction (Patches, Diffs, Source Code, Post-Mortems)  
> **Harvest Timestamp**: 2026-10-05T18:49:48.572Z  
> **Compliance State**: Free Tier Guaranteed | Strict Rate-Limit Backoff Honored  

---

## 1. Context & Architectural Overview
- **Repository / Resource**: `loft-sh/vcluster`
- **Description**: vCluster creates tenant clusters: fully isolated environments delivered as managed Kubernetes, or as the foundation for Slurm, Ray, Run:ai and inference clusters. Each gets its own API server, CRDs and RBAC, and runs on an existing cluster or standalone on bare metal. CNCF Certified Kubernetes.
- **Primary Language / Ecosystem**: Go
- **Discovered Manifests / Configurations**: go.mod, README.md, Dockerfile
- **Stars / Engagement**: 11333 stars

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

	agentstoragev1 "github.com/loft-sh/agentapi/v4/pkg/apis/loft/storage/v1"
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
		var nodeAddress string
		nodeHostname := node.Name
		for _, address := range node.Status.Addresses {
			if address.Type == corev1.NodeInternalIP {
				nodeAddress = address.Address
			} else if address.Type == corev1.NodeHostName {
				nodeHostname = address.Address
			}
		}
		nodehosts = append(nodehosts, fmt.Sprintf("%s %s", nodeAddress, nodeHostname))
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

### Core Architecture Module: `pkg/mappings/store/util.go`
```
package store

import "github.com/loft-sh/vcluster/pkg/syncer/synccontext"

func removeMappingFromNameMap(lookupMap map[synccontext.Object]lookupName, mapping *Mapping, key synccontext.Object) {
	newLookupName, ok := lookupMap[key]
	if !ok {
		return
	}

	// remove from mappings
	newMappings := []*Mapping{}
	for _, otherMapping := range newLookupName.Mappings {
		if otherMapping.String() != mapping.String() {
			newMappings = append(newMappings, otherMapping)
		}
	}
	if len(newMappings) == 0 {
		delete(lookupMap, key)
		return
	}

	newLookupName.Mappings = newMappings
	lookupMap[key] = newLookupName
}

func addMappingToNameMap(lookupMap map[synccontext.Object]lookupName, mapping *Mapping, key, other synccontext.Object) {
	newLookupName, ok := lookupMap[key]
	if !ok {
		newLookupName = lookupName{
			Object: other,
		}
	}

	newLookupName.Mappings = append(newLookupName.Mappings, mapping)
	lookupMap[key] = newLookupName
}

```

### Core Architecture Module: `pkg/pro/integrated_coredns.go`
```
package pro

import (
	"github.com/loft-sh/admin-apis/pkg/licenseapi"
	"github.com/loft-sh/vcluster/pkg/config"
	"github.com/loft-sh/vcluster/pkg/specialservices"
	"github.com/loft-sh/vcluster/pkg/syncer/synccontext"
)

var StartIntegratedCoreDNS = func(_ *synccontext.ControllerContext) error {
	return NewFeatureError(licenseapi.VirtualClusterProDistroBuiltInCoreDNS)
}

var InitDNSServiceSyncing = func(_ *config.VirtualClusterConfig) specialservices.Interface {
	return specialservices.NewDefaultServiceSyncer()
}

```


### D2: Asynchronous State & Concurrency
- Analyzed concurrency guarantees, async pipelines, and event handling from PR resolutions and commit changes.

### D3: Error Boundaries, Recovery & Rollbacks
- Exception handling patterns and defect resolutions extracted from closed production bug issues:
- **Issue #1746** (2024-08-14): **Resource limits forbid running of the syncer**
  *Symptoms*: ### What happened?  - I downloaded my values.yaml from [GitHub](https://github.com/loft-sh/vcluster/blob/a0a6ff0ccbace90be212d4887f15eaf49bfe3fc5/chart/values.yaml) - I enabled quotas at  "policies: > resourceQuota: >  enabled: true" - I created the vCluster with helm as follows ` helm upgrade --install vcluster-r05 vcluster --version 0.20.0-beta.2 --values vcluster.yaml --repo https://charts.loft.sh --namespace vcluster-r05 --create-namespace --repository-config='' --wait --wait-for-jobs` - The syncer is not created. Stateful set has 0/1 pods ready. The events state that: `create Pod vcluster-r05-0 in StatefulSet vcluster-r05 failed error: pods "vcluster-r05-0" is forbidden: failed quota: vc-vcluster-r05: must specify limits.cpu for: syncer`   ### What did you expect to happen?  - The vCluster is created without a problem.  ### How can we reproduce it (as minimally and precisely as possible)?  See above.  ### Anything else we need to know?  It can be a [good idea](https://www.youtube.com/watch?v=rjSWVeAvb24) to set CPU requests and **not set** CPU limits. With vCluster, we do that in the syncer limits (controlPlane: > statefulSet: > resources: > limits:) definition. In the values.yaml there should also be a way to disable cpu limits.   What do you think about making the CPU unlimited by default?   ### Host cluster Kubernetes version  <details>  ```console $ kubectl version Client Version: v1.29.3 Kustomize Version: v5.0.4-0.20230601165947-6ce0b
  **Post-Mortem & Fix Analysis**:
  > Thanks for reporting this. I will discuss it within team.
  > This is a kubernetes limitation, not a vcluster one:    >  If quota is enabled in a namespace for compute resources like cpu and memory, users must specify requests or limits for those values; otherwise, the quota system may reject pod creation. Hint: Use the LimitRanger admission controller to force defaults for pods that make no compute resource requirements.  ( https://kubernetes.io/docs/concepts/policy/resource-quotas/ )
  > Ah's an issue that we don't have a default cpu limit, so enabling resource quotas without writing in an cpu.limit doesn't work

- **Issue #1745** (2025-02-24): **MountVolume.SetUp failed for volume "podlogs" of a deployment in vCluster**
  *Symptoms*: ### What happened?  I created a new vCluster and deployed a deployment but the pod goes in container creating state with the below error: `  Warning  FailedMount  22s (x11 over 6m34s)   kubelet            MountVolume.SetUp failed for volume "plogs" : hostPath type check failed: /tmp/vcluster/v-cluster-only-ic-sync/testt/log/pods is not a directory`  I tried changing the type of volume to DirectoryOrCreate, the pod came up in running state but in the fluentbit container no logs are visible, following are the error logs of fluentbit-container: `[2024/05/06 12:51:09] [error] [input:tail:tail.0] read error, check permissions: /var/log/pods/dgdr-6868bbb7-hrxlz_fb217ac7-d1ff-47f7-9af7-abb76a8c707f/*.log [2024/05/06 12:51:09] [ warn] [input:tail:tail.0] error scanning path: /var/log/pods/dgdr-6868bbb7-hrxlz_fb217ac7-d1ff-47f7-9af7-abb76a8c707f/*.log`  ### What did you expect to happen?  Ideally the deployment should create the pod and i should see the logs in the fluent bit container, Also i wanted to know how this path is getting created `"/tmp/vcluster/v-cluster-only-ic-sync/testt/log/pods"` in vCluster as in my deployment volume is as below  `volumes:     - name: podlogs      hostPath:       path: /var/log/pods       type: Directory`  ### How can we reproduce it (as minimally and precisely as possible)?  Deploy a K8s Deployment with fluentbit as a side car container which has volumeMounts  `     volumeMounts:           - name: podlogs             mountPath: /var/log/
  **Post-Mortem & Fix Analysis**:
  > hostpathmapper needs to be enabled to use fluent-bit logging in vcluster. ref: https://www.vcluster.com/docs/vcluster/configure/vcluster-yaml/control-plane/components/host-path-mapper create a vcluster using the below config. (vcluster version v0.20.1)  ``` controlPlane:   hostPathMapper:     enabled: true ```  2. install the vcluster hostpath mapper helm chart https://github.com/loft-sh/vcluster-hostpath-mapper 3. create the deployment with correct fluent-bit config and check the logs. 
  > @akusingh-tibco Please let us know if the guidance didn't work, but otherwise I'm going to close the issue. 
  > Hi @deniseschannon  I have the same problem and when installing hpm 0.2.0 from the helm charts against the vcluster 0.23.0 I get the following error in the hpm pods:  ``` 2025-03-15 23:09:16.422Z hostpath-mapper-init E0315 23:09:16.422073       1 hostpaths.go:269] unmarshal config.yaml: &errors.errorString{s:"while decoding JSON: json: unknown field \"reuseNamespace\""} 2025-03-15 23:09:16.422Z hostpath-mapper-init Error: find vcluster mode: error unmarshaling JSON: while decoding JSON: json: unknown field "reuseNamespace" 2025-03-15 23:09:16.422Z hostpath-mapper-init Usage: 2025-03-15 23:09:16.422Z hostpath-mapper-init   start [flags] 2025-03-15 23:09:16.422Z hostpath-mapper-init  2025-03-15 23:09:16.422Z hostpath-mapper-init Flags: 2025-03-15 23:09:16.422Z hostpath-mapper-init       --client-ca-cert string     The path to the client ca certificate (default "/data/server/tls/client-certificate") 2025-03-15 23:09:16.422Z hostpath-mapper-init   -h, --help                      help for s

- **Issue #1718** (2024-05-16): **CoreDNS PreemptionPolicy conflicts with host cluster global default Priority Class**
  *Symptoms*: ### What happened?  When trying to deploy a vcluster to my homelab cluster, I found out that the coredns pod fails to sync because it has a preemptionPolicy set that is different from the default PriorityClass on my cluster.  The syncer fails to sync the coredns pod with the following error  ``` syncer 2024-04-25 04:11:12    ERROR    controller/controller.go:329    controller pod: namespace kube-system name coredns-74987d4979-k272p: reconcileID "a0a6be23-8e5e-45bb-886c-414074d250d9": Reconciler error pods "coredns-74987d4979-k272p-x-kube-system-x-vcluster-rf-ebceb13e69" is forbidden: the string value of PreemptionPolicy (PreemptLowerPriority) must not be provided in pod spec; priority admission controller computed Never from the given PriorityClass name    {"component": "vcluster-pro"} ```  ### What did you expect to happen?  For it to successfully sync the pod. Ideally by omitting the preemptionPolicy here. Or mapping it properly to the host's system-cluster-critical PriorityClass.  ### How can we reproduce it (as minimally and precisely as possible)?  1. Have a PriorityClass with globalDefault set to true with a preemption policy set to Never 2. Deploy vcluster with default settings 3. Observe syncer failing to sync coredns pod  ### Anything else we need to know?  After temporarily removing the globalDefault PriorityClass on the host cluster, the pod successfully syncs, and I've observed that the resulting pod has an empty priorityClassName, which causes the host cluster to
  **Post-Mortem & Fix Analysis**:
  > Hello   Thank you for the information regarding the issue you are facing. From the error message provided it seems that there is a conflict, between the preemptionPolicy of the coredns pod and the default PriorityClass set in your host cluster.   This conflict arises because the default PriorityClass of your host cluster has a preemption policy of 'Never' which does not align with the 'PreemptLowerPriority' policy specified in the coredns pod.  At my investigation it may be either a miss-configuration or a real problem close to https://github.com/loft-sh/vcluster/blob/v0.20.0-beta.1/pkg/controllers/resources/priorityclasses/translate.go#L26.  I would recommend to provide any additional logs or configurations that might help our team replicate and address this issue. 
  > What kind of additional logs and/or configurations would be helpful here?  The default preemption policy on my host cluster is indeed intended to never preempt other pods.  As previously stated, I'm using a default configuration of vcluster as deployed via CLI, so I'm not entirely sure how this can be a misconfiguration if the default configuration is producing pod specs that is conflicting with a host cluster default priorityClass preemption policy.

- **Issue #1717** (2025-08-26): **Document what to do when there is noexec available**
  *Symptoms*: ### What happened?  In an environment where any emptyDir is mounted to a partition in host, with noexec, vcluster create will give: ``` 12:07:17 warn Pod my-vcluster-795748b48b-gzbvb: Error: failed to create containerd task: failed to create shim task: OCI runtime create failed: runc create failed: unable to start container process: exec: " /binaries/vcluster": permission denied: unknown (Failed) ``` After editing the pod for debug with strace: ``` / # /binaries/vcluster sh: /binaries/vcluster: Permission denied / # strace /binaries/vcluster execve("/binaries/vcluster", ["/binaries/vcluster"], [/* 27 vars */]) = -1 EACCES (Permission denied) writev(2, [{iov_base="strace: exec: Permission denied", iov_len=31}, {iov_base="\n", iov_len=1}], 2strace: exec: Permission denied ) = 32 writev(2, [{iov_base="", iov_len=0}, {iov_base=NULL, iov_len=0}], 2) = 0 getpid()                                = 18 exit_group(1)                           = ? +++ exited with 1 +++ ``` If copied to /tmp, vcluster works.  Mount command gives: ``` # for /tmp mount | grep "on / " overlay on / type overlay (rw,seclabel,relatime,lowerdir=/var/lib/containerd/io.containerd.snapshotter.v1.overlayfs/snapshots/26481/fs:/var/lib/containerd/io.containerd.snapshotter.v1.overlayfs/snapshots/26480/fs,upperdir=/var/lib/containerd/io.containerd.snapshotter.v1.overlayfs/snapshots/26558/fs,workdir=/var/lib/containerd/io.containerd.snapshotter.v1.overlayfs/snapshots/26558/work)  # for /binaries
  **Post-Mortem & Fix Analysis**:
  > I could ask the kubernetes admin if they can change the behavior of emptyDir, so that the partition are not noexec. It might be difficult for them to lower the security. Moreover, the kubernetes issue https://github.com/kubernetes/kubernetes/issues/48912 might make this a future issue for vcluster anyway.  What if vcluster image directly contains the two binaries? I don't know about licence but that would prevent this trick and we could then have noexec in the image and in emptyDir.
  > @antoinetran Hi, thanks for opening this. to answer your question `What if vcluster image directly contains the two binaries?` the issue here is that we default to the current k8s version of the host (e.g. if you're on 1.27 in the host cluster the image will be pulled from k8s 1.27) and this is also configurable. So we would have to have at least 4 different images just for the k8s distro, plus the images would have to also include the scheduler and the controller even if not in use and BYOI would be harder too  The issue you linked may be a problem indeed for this approach, I will be taking a look 
  > Related docs PR: https://github.com/loft-sh/vcluster-docs/pull/1020

- **Issue #1708** (2024-05-22): **Allow setting enableServiceLinks to false in etcd and syncer**
  *Symptoms*: ### What happened?  We are experimenting using vcluster to shard a cluster with 10K+ services between multiple vclusters.  It has been working perfectly for 2 weeks but we hit the first issue today: the etcd statefulset and the syncer deployment died and failed to start up due to there being too many environment variables. This is a known issue in clusters with too many services, and the workaround we usually employ is to disable pod's service links, as each service ends up as another environment variable to a pod.  Currently, however, there is no way to disable service links in the k8s chart  https://github.com/loft-sh/vcluster/blob/v0.19/charts/k8s/templates/etcd-statefulset.yaml  Edit to add: we have disabled service links manually in the etcd statefulset and syncer deployment and everything seems to be working.  ### What did you expect to happen?  Either: - for enableServiceLinks to be set to false (if vcluster does not work without DNS service discovery in the host cluster, I don't think there is a reason to leave that to the default true value) - a chart value allowing service links to be disabled  ### How can we reproduce it (as minimally and precisely as possible)?  Create 10K+ services in a cluster.  ``` k get svc -A | wc -l 15405 ```  ### Anything else we need to know?  I could open a PR for this (or for the related #1622 which would also fix this issue for us). I just see the charts on the v0.19 branch, is that the branch a potential PR 
  **Post-Mortem & Fix Analysis**:
  > @cezar-guimaraes thanks for creating this issue! Yes I think we can add that option

- **Issue #1704** (2024-08-07): **setup/controller_context.go:225 couldn't find virtual cluster kube-config**
  *Symptoms*: ### What happened?  vCluster Pods are not running,  Deployed in the Anthos Bare Metal Cluster using Helm Chart.  ``` kubectl get pods -n vcluster-dev NAME             READY   STATUS    RESTARTS      AGE vcluster-dev-0   0/1     Running   1 (20m ago)   53m ```  Below are the logs of vcluster Pod.  ``` setup/initialize.go:88  failed to find IPv6 service CIDR, will use IPv4 service CIDR. Error details: couldn't find host cluster Service CIDR ("Service "test-service-m2p76" is invalid: spec.clusterIPs[0]: Invalid value: []string{"2001:DB8::1"}: IPv6 is not configured on this cluster")        {"component": "vcluster-pro"} 2024-04-18 07:54:18     INFO    setup/controller_context.go:225 couldn't find virtual cluster kube-config, will retry in 1 seconds      {"component": "vcluster-pro"} 2024-04-18 07:54:19     INFO    setup/controller_context.go:225 couldn't find virtual cluster kube-config, will retry in 1 seconds      {"component": "vcluster-pro"} ```  ### What did you expect to happen?  vcluster and core dns pods are expected to run.  ### How can we reproduce it (as minimally and precisely as possible)?  Used to deploy k8s VMs in the vCluster.  ### Anything else we need to know?  *No response*  ### Host cluster Kubernetes version  Client Version: v1.27.3 Kustomize Version: v5.0.1 Server Version: v1.28.5-gke.1200  ### Host cluster Kubernetes distribution  <details>  ``` # Anthos on Bare Metal Cluster ```  </details>  ### vlcuster version  <details>  ```console $ vcluster --version 
  **Post-Mortem & Fix Analysis**:
  > @Rockyjr-git thanks for creating this issue! Is this a IPv6 only cluster?
  > Yes, it is.
  > We don't have the problem with `k0sproject/k0s:v1.28.8-k0s.0` but when upgrading to `k0sproject/k0s:v1.29.4-k0s.0` the following logs show up in the syncer (0.18.1 or 0.19.5) container: ``` 2024-05-18 17:26:21	INFO	setup/initialize.go:86	k0s config secret detected, syncer will ensure that it contains service CIDR	{"component": "vcluster"} 2024-05-18 17:26:21	INFO	servicecidr/servicecidr.go:117	failed to find IPv6 service CIDR, will use IPv4 service CIDR. Error details: couldn't find host cluster Service CIDR ("Service "test-service-jmp96" is invalid: spec.clusterIPs[0]: Invalid value: []string{"2001:DB8::1"}: IPv6 is not configured on this cluster")	{"component": "vcluster"} 2024-05-18 17:26:21	INFO	k0s/k0s.go:68	Starting k0s	{"component": "vcluster", "args": "/k0s-binary/k0s controller --config=/etc/k0s/config.yaml --data-dir=/data/k0s --status-socket=/run/k0s/status.sock --disable-components=konnectivity-server,kube-scheduler,csr-approver,kube-proxy,coredns,network-provider,helm,

- **Issue #1682** (2024-04-15): **vcluster connect hangs in airgapped environment when firewall is silently dropping Internet traffic**
  *Symptoms*: ### What happened?  When connecting to a vcluster where the CLI is executed in an airgapped environment, the connect command will hang for approximately 30 seconds while attempting to check for newer versions.  I've turned of telemetry by using vcluster telemetry disable.  Every 1.0s: sudo netstat -anop | grep -i SYN_SENT tcp        0      1 10.bbb.ccc.ddd:56312     140.82.121.6:443        SYN_SENT    1104193/vcluster     on (3.36/3/0)  [username@workstation 0.19.5]$ time vcluster -n namespace connect vcluster 14:03:12 info Using vcluster vcluster load balancer endpoint: 10.ddd.eee.fff 14:03:12 done Switched active kube context to vcluster_vcluster_namespace_clustername - Use `vcluster disconnect` to return to your previous kube context - Use `kubectl get namespaces` to access the vcluster  real    0m30.229s user    0m0.139s sys     0m0.024s    ### What did you expect to happen?  That the command completes within a couple of seconds, which is what happens if I enable proxy using environment variables. But proxy or Internet connection isn't always allowed.  [username@workstation 0.19.5]$ . enable_proxy #shell script for setting environment variables [username@workstation 0.19.5]$ time vcluster -n namespace connect vcluster 14:19:26 info Using vcluster vcluster load balancer endpoint: 10.ddd.eee.fff 14:19:26 done Switched active kube context to vcluster_vcluster_namespace_clustername - Use `vcluster disconnect` to return to your previous kube contex
  **Post-Mortem & Fix Analysis**:
  > Hey @trondvindenes-hvikt, as you pointed out, the connect and create commands will check for newer CLI releases on GitHub.  You can omit this by setting the `VCLUSTER_SKIP_VERSION_CHECK=true` environment variable.

- **Issue #1678** (2024-04-18): **Hard-coded request.cpu 30m for statefulset prevents deployment in some cluster**
  *Symptoms*: ### What happened?  In an OpenShift cluster 4.15 with quota: minimal requests.cpu >= 50m, the deployment of statefulset fails.  ### What did you expect to happen?  Any statefulset deployment, that contains resource fields requests and limits, should not fail because of this error: ``` Error syncing to physical cluster: pods "my-nats-0-x-nats-x-my-vcluster" is forbidden: minimum cpu usage per Container is 50m, but request is 30m ```  ### How can we reproduce it (as minimally and precisely as possible)?  Deploy nats with helm chart, or really any statefulset, in an OpenShift cluster with with quota: minimal requests.cpu >= 50m  ### Anything else we need to know?  https://github.com/loft-sh/vcluster/blob/v0.20.0-alpha.4/pkg/controllers/resources/pods/translate/hosts.go#L50 specifies the hard-coded value of 30m. Linked to https://github.com/loft-sh/vcluster/issues/372 Recommended solution: Add a way in values.yaml of vcluster to specify the resource field for this special initContainer that vcluster runs for each statefulset deployment.  ### Host cluster Kubernetes version  <details>  ```console $ kubectl version Client Version: v1.28.5 Kustomize Version: v5.0.4-0.20230601165947-6ce0bf390ce3 Server Version: v1.28.2-3580+6216ea1e51a212-dirty ```  </details>   ### Host cluster Kubernetes distribution  <details>  ``` OpenShift 4.15, linked to Kubernetes version 1.28. ```  </details>   ### vlcuster version  <details>  ```console $ v
  **Post-Mortem & Fix Analysis**:
  > Anyone sees a workaround? I thought about applying a limitrange, but the fact that vcluster specifies the requests/limits override that limitrange. I don't see a way of editing the vcluster image, because it is written in GO, and it's a compiled language. I can't even patch the initContainer because when it is not schedulable, it does only appear on kubectl events, but not as a Kubernetes resource.
  > @antoinetran thanks for creating this issue! Yes we should add an option for this, I agree

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

### Incident Patch 1: `7d4225ae` (2026-09-29)
**Commit Message**: fix(ci): pass a boolean to oss branch cleanup (#2499)

The weekly cleanup in loft-sh/vcluster failed before any job started on Sep 13, 20 and 27. The staged OSS caller still passes the string expression github.event.inputs.dry_run || 'false' from a choice input to the shared workflow's boolean dry-run input. vcluster-pro#2490 fixed the pro caller (22cefa82a) but did not touch the staged OSS file, so the public mirror kept the broken caller.

Use a boolean dry_run input defaulting to true and pass the typed dispatch context, so manual runs stay dry by default and scheduled runs clean up live.

Monorepo-Commit: 74379aa7589f78340176fd34fc3286390c4b5b3f

**File**: `.github/workflows/cleanup-backport-branches.yaml` (modified, +3/-6)
```diff
@@ -8,11 +8,8 @@ on:
       dry_run:
         description: 'Dry run mode'
         required: false
-        default: 'true'
-        type: choice
-        options:
-          - 'true'
-          - 'false'
+        default: true
+        type: boolean
 
 permissions:
   contents: write
@@ -21,6 +18,6 @@ jobs:
   cleanup-backport-branches:
     uses: loft-sh/github-actions/.github/workflows/cleanup-backport-branches.yaml@cleanup-backport-branches/v1
     with:
-      dry-run: ${{ github.event.inputs.dry_run || 'false' }}
+      dry-run: ${{ github.event_name == 'workflow_dispatch' && inputs.dry_run }}
     secrets:
       gh-access-token: ${{ secrets.GH_ACCESS_TOKEN }}
```

---

### Incident Patch 2: `81b05906` (2026-09-28)
**Commit Message**: fix(deps): bump default kubernetes images to patched releases (#2489)

* fix(deps): bump default kubernetes images to patched releases

Bump the default ghcr.io/loft-sh/kubernetes images to the upstream
patch releases that fix CVE-2026-2270 in kube-controller-manager
(StatefulSet controller restoring more than spec from a
ControllerRevision):

- 1.36: v1.36.0 -> v1.36.5 (also the chart default)
- 1.35: v1.35.0 -> v1.35.9
- 1.34: v1.34.0 -> v1.34.12

Co-Authored-By: Claude Opus 5.5 (1M context) <[REDACTED_EMAIL]>

* fix(cli): pin the kubernetes version the docker driver mounts

The docker driver pulls the kubernetes bundle for the CLI's default
version and bind-mounts it into the control plane container. A vCluster
started with an older --chart-version falls back to its own default,
sees the mounted kube-apiserver at a different version and re-downloads
the bundle into /tmp, which is a noexec tmpfs there, so the first exec
fails with "permission denied" and the node never joins.

Write the version the CLI mounted into the generated vcluster.yaml
unless the user already set controlPlane.distro.k8s.version or
controlPlane.distro.k8s.image.tag.

Co-Authored-By: Claude Opus 5.5 (1M cont

**File**: `chart/tests/statefulset_test.yaml` (modified, +3/-3)
```diff
@@ -520,7 +520,7 @@ tests:
     asserts:
       - equal:
           path: spec.template.spec.initContainers[0].image
-          value: ghcr.io/loft-sh/kubernetes:v1.36.0
+          value: ghcr.io/loft-sh/kubernetes:v1.36.5
 
   - it: k8s override image tag
     set:
@@ -589,7 +589,7 @@ tests:
     asserts:
     - equal:
         path: spec.template.spec.initContainers[0].image
-        value: ghcr.io/loft-sh/kubernetes:v1.36.0
+        value: ghcr.io/loft-sh/kubernetes:v1.36.5
 
   - it: k8s version not set, default tag images used for apiServer and controllerManager (virtual scheduler enabled, deprecated)
     chart:
@@ -605,7 +605,7 @@ tests:
     asserts:
       - equal:
           path: spec.template.spec.initContainers[0].image
-          value: ghcr.io/loft-sh/kubernetes:v1.36.0
+          value: ghcr.io/loft-sh/kubernetes:v1.36.5
 
   - it: k8s version sets image tag for apiServer and controllerManager (virtual scheduler enabled)
     set:
```

**File**: `chart/values.yaml` (modified, +1/-1)
```diff
@@ -322,7 +322,7 @@ controlPlane:
         # Repository is the repository of the container image, e.g. my-repo/my-image
         repository: "loft-sh/kubernetes"
         # Tag is the tag of the container image, and is the default version.
-        tag: "v1.36.0"
+        tag: "v1.36.5"
       # APIServer holds configuration specific to starting the api server.
       apiServer:
         enabled: true
```

**File**: `config/default_extra_values.go` (modified, +3/-3)
```diff
@@ -17,9 +17,9 @@ const (
 
 // K8SVersionMap holds the supported k8s api servers
 var K8SVersionMap = map[string]string{
-	"1.36": "ghcr.io/loft-sh/kubernetes:v1.36.0",
-	"1.35": "ghcr.io/loft-sh/kubernetes:v1.35.0",
-	"1.34": "ghcr.io/loft-sh/kubernetes:v1.34.0",
+	"1.36": "ghcr.io/loft-sh/kubernetes:v1.36.5",
+	"1.35": "ghcr.io/loft-sh/kubernetes:v1.35.9",
+	"1.34": "ghcr.io/loft-sh/kubernetes:v1.34.12",
 	"1.33": "ghcr.io/loft-sh/kubernetes:v1.33.4",
 	"1.32": "ghcr.io/loft-sh/kubernetes:v1.32.1",
 	"1.31": "ghcr.io/loft-sh/kubernetes:v1.31.1",
```

**File**: `config/values.yaml` (modified, +1/-1)
```diff
@@ -142,7 +142,7 @@ controlPlane:
       image:
         registry: ghcr.io
         repository: "loft-sh/kubernetes"
-        tag: "v1.36.0"
+        tag: "v1.36.5"
       apiServer:
         enabled: true
         command: []
```

**File**: `devspace.yaml` (modified, +1/-1)
```diff
@@ -32,7 +32,7 @@ deployments:
           distro:
             k8s:
               image:
-                tag: v1.36.0
+                tag: v1.36.5
           statefulSet:
             image:
               registry: ""
```

**File**: `pkg/cli/create_docker.go` (modified, +35/-0)
```diff
@@ -997,10 +997,45 @@ func loadUserValues(options *CreateOptions, globalFlags *flags.GlobalFlags, log
 		return nil, fmt.Errorf("unmarshal user values: %w", err)
 	}
 
+	// pin the kubernetes version this CLI pulls and mounts into the containers. Without it
+	// a vCluster started with an older --chart-version falls back to its own default, finds
+	// the mounted binaries at a different version and re-downloads them into /tmp, which is
+	// a noexec tmpfs in the control plane container.
+	pinKubernetesVersion(userValuesMap, defaultConfig.ControlPlane.Distro.K8S.Image.Tag)
+
 	// merge the configs
 	return userValuesMap, nil
 }
 
+// pinKubernetesVersion sets controlPlane.distro.k8s.version to version unless the user
+// already chose one via controlPlane.distro.k8s.version or controlPlane.distro.k8s.image.tag.
+func pinKubernetesVersion(values map[string]interface{}, version string) {
+	if version == "" {
+		return
+	}
+
+	k8s := values
+	for _, key := range []string{"controlPlane", "distro", "k8s"} {
+		next, ok := k8s[key].(map[string]interface{})
+		if !ok {
+			next = map[string]interface{}{}
+			k8s[key] = next
+		}
+		k8s = next
+	}
+
+	if v, _ := k8s["version"].(string); v != "" {
+		return
+	}
+	if image, ok := k8s["image"].(map[string]interface{}); ok {
+		if tag, _ := image["tag"].(string); tag != "" {
+			return
+		}
+	}
+
+	k8s["version"] = version
+}
+
 func configureNetwork(ctx context.Context, fullConfigRaw map[string]interface{}, vClusterName string, log log.Logger) (string, []string, error) {
 	// convert the config to a config object
 	fullConfig, _, err := convertConfig(fullConfigRaw)
```

**File**: `pkg/cli/create_docker_test.go` (modified, +62/-0)
```diff
@@ -51,6 +51,68 @@ func TestGetInstallStandaloneScript(t *testing.T) {
 	})
 }
 
+func TestPinKubernetesVersion(t *testing.T) {
+	k8sOf := func(values map[string]interface{}) map[string]interface{} {
+		return values["controlPlane"].(map[string]interface{})["distro"].(map[string]interface{})["k8s"].(map[string]interface{})
+	}
+
+	t.Run("empty values get the version", func(t *testing.T) {
+		values := map[string]interface{}{}
+		pinKubernetesVersion(values, "v1.36.5")
+		assert.Equal(t, k8sOf(values)["version"], "v1.36.5")
+	})
+
+	t.Run("sibling keys are kept", func(t *testing.T) {
+		values := map[string]interface{}{
+			"controlPlane": map[string]interface{}{
+				"standalone": map[string]interface{}{"enabled": true},
+				"distro": map[string]interface{}{
+					"k8s": map[string]interface{}{
+						"image": map[string]interface{}{"registry": "my-registry.io"},
+					},
+				},
+			},
+		}
+		pinKubernetesVersion(values, "v1.36.5")
+		assert.DeepEqual(t, values["controlPlane"].(map[string]interface{})["standalone"], map[string]interface{}{"enabled": true})
+		assert.Equal(t, k8sOf(values)["version"], "v1.36.5")
+		assert.DeepEqual(t, k8sOf(values)["image"], map[string]interface{}{"registry": "my-registry.io"})
+	})
+
+	t.Run("user version wins", func(t *testing.T) {
+		values := map[string]interface{}{
+			"controlPlane": map[string]interface{}{
+				"distro": map[string]interface{}{
+					"k8s": map[string]interface{}{"version": "v1.35.9"},
+				},
+			},
+		}
+		pinKubernetesVersion(values, "v1.36.5")
+		assert.Equal(t, k8sOf(values)["version"], "v1.35.9")
+	})
+
+	t.Run("user image tag wins", func(t *testing.T) {
+		values := map[string]interface{}{
+			"controlPlane": map[string]interface{}{
+				"distro": map[string]interface{}{
+					"k8s": map[string]interface{}{
+						"image": map[string]interface{}{"tag": "v1.34.12"},
+					},
+				},
+			},
+		}
+		pinKubernetesVersion(values, "v1.36.5")
+		_, hasVersion := k8sOf(values)["version"]
+		assert.Assert(t, !hasVersion)
+	})
+
+	t.Run("empty version is a no-op", func(t *testing.T) {
+		values := map[string]interface{}{}
+		pinKubernetesVersion(values, "")
+		assert.Equal(t, len(values), 0)
+	})
+}
+
 func TestLoadBalancerUnsupportedReason(t *testing.T) {
 	t.Run("reachable network keeps the load balancer enabled everywhere", func(t *testing.T) {
 		assert.Equal(t, loadBalancerUnsupportedReason("linux", true, false, false), "")
```

---

### Incident Patch 3: `5d9d4284` (2026-09-23)
**Commit Message**: fix(deps): update module google.golang.org/grpc to v1.83.2 [security] (#2428)

Co-authored-by: renovate[bot] <29139614+renovate[bot]@users.noreply.github.com>
Co-authored-by: Caue Santos <[REDACTED_EMAIL]>
Monorepo-Commit: 28e9e3a95ce6246049131134bd31c58e7e3a4ce5

**File**: `go.mod` (modified, +1/-1)
```diff
@@ -49,7 +49,7 @@ require (
 	go.uber.org/atomic v1.11.0
 	golang.org/x/mod v0.41.0
 	golang.org/x/sync v0.23.0
-	google.golang.org/grpc v1.83.1
+	google.golang.org/grpc v1.83.2
 	google.golang.org/protobuf v1.36.12
 	gopkg.in/yaml.v3 v3.0.1
 	gotest.tools v2.2.0+incompatible
```

**File**: `go.sum` (modified, +2/-2)
```diff
@@ -737,8 +737,8 @@ google.golang.org/genproto/googleapis/api v0.0.0-20260526163538-3dc84a4a5aaa h1:
 google.golang.org/genproto/googleapis/api v0.0.0-20260526163538-3dc84a4a5aaa/go.mod h1:q4lMZS6kskjT5HvCPrnnypcDPVJqT/f4nfxmkE7gryY=
 google.golang.org/genproto/googleapis/rpc v0.0.0-20260630182238-925bb5da69e7 h1:eM/YSd5bBFagF51o1E745Ta7RwzpW0h+z+QDNZOgmQ8=
 google.golang.org/genproto/googleapis/rpc v0.0.0-20260630182238-925bb5da69e7/go.mod h1:4Hqkh8ycfw05ld/3BWL7rJOSfebL2Q+DVDeRgYgxUU8=
-google.golang.org/grpc v1.83.1 h1:HIO0+BEtBP6soyqvqC8sNUjZ7bTs+0hFQuFF+RAy++Y=
-google.golang.org/grpc v1.83.1/go.mod h1:kDyl6SKsiHKt0uylY5gtn5cEjkrIOhQOGDgIc4JGwzQ=
+google.golang.org/grpc v1.83.2 h1:EManeRomTObA0BU7I8vXgg/78uE5MJ9M8B39EX2WscU=
+google.golang.org/grpc v1.83.2/go.mod h1:YPI1hK3kDked6iHvgX3tR0y+nX/qpMFKhPgFsokw1S8=
 google.golang.org/protobuf v1.36.12 h1:pJOKDDOyeXErUroCihFAd5LQuwXBSpVnKGrj5o/fwxc=
 google.golang.org/protobuf v1.36.12/go.mod h1:HTf+CrKn2C3g5S8VImy6tdcUvCska2kB7j23XfzDpco=
 gopkg.in/check.v1 v0.0.0-20161208181325-20d25e280405/go.mod h1:Co6ibVJAznAaIkqp8huTwlJQCZ016jof/cbN4VW5Yz0=
```

**File**: `vendor/google.golang.org/grpc/internal/transport/http2_server.go` (modified, +6/-0)
```diff
@@ -522,6 +522,12 @@ func (t *http2Server) operateHeaders(ctx context.Context, frame *http2.MetaHeade
 		delete(mdata, "host")
 	}
 
+	// If :authority is still missing, i.e. no host or :authority header is
+	// present, reject the request as invalid.
+	if len(mdata[":authority"]) == 0 {
+		t.writeEarlyAbort(streamID, s.contentSubtype, status.New(codes.Internal, "no host or :authority header present"), http.StatusBadRequest, !frame.StreamEnded())
+		return nil
+	}
 	if frame.StreamEnded() {
 		// s is just created by the caller. No lock needed.
 		s.state = streamReadDone
```

**File**: `vendor/google.golang.org/grpc/version.go` (modified, +1/-1)
```diff
@@ -19,4 +19,4 @@
 package grpc
 
 // Version is the current grpc version.
-const Version = "1.83.1"
+const Version = "1.83.2"
```

**File**: `vendor/modules.txt` (modified, +1/-1)
```diff
@@ -1421,7 +1421,7 @@ google.golang.org/genproto/googleapis/api/httpbody
 ## explicit; go 1.25.0
 google.golang.org/genproto/googleapis/rpc/errdetails
 google.golang.org/genproto/googleapis/rpc/status
-# google.golang.org/grpc v1.83.1
+# google.golang.org/grpc v1.83.2
 ## explicit; go 1.25.0
 google.golang.org/grpc
 google.golang.org/grpc/attributes
```

---

### Incident Patch 4: `dcd93ab5` (2026-09-23)
**Commit Message**: fix(deps): update golang.org/x/exp digest to 85c1c22 (#2445)

* fix(deps): update golang.org/x/exp digest to 85c1c22

* fix(deps): sync root vendor for x/exp update

---------

Co-authored-by: renovate[bot] <29139614+renovate[bot]@users.noreply.github.com>
Co-authored-by: Caue Santos <[REDACTED_EMAIL]>
Monorepo-Commit: 8373f3a8b15eff5de243cab3a0531e069e416b0a

**File**: `go.mod` (modified, +9/-9)
```diff
@@ -47,8 +47,8 @@ require (
 	go.etcd.io/etcd/pkg/v3 v3.6.8
 	go.etcd.io/etcd/server/v3 v3.6.8
 	go.uber.org/atomic v1.11.0
-	golang.org/x/mod v0.39.0
-	golang.org/x/sync v0.22.0
+	golang.org/x/mod v0.41.0
+	golang.org/x/sync v0.23.0
 	google.golang.org/grpc v1.83.1
 	google.golang.org/protobuf v1.36.12
 	gopkg.in/yaml.v3 v3.0.1
@@ -283,15 +283,15 @@ require (
 	go.opentelemetry.io/proto/otlp v1.10.0 // indirect
 	go.uber.org/multierr v1.11.0 // indirect
 	go.uber.org/zap v1.27.1
-	golang.org/x/crypto v0.55.0 // indirect
-	golang.org/x/exp v0.0.0-20260824195058-e88cd73687aa
-	golang.org/x/net v0.58.0 // indirect
+	golang.org/x/crypto v0.57.0 // indirect
+	golang.org/x/exp v0.0.0-20260908205506-85c1c2202aba
+	golang.org/x/net v0.59.0 // indirect
 	golang.org/x/oauth2 v0.36.0
-	golang.org/x/sys v0.47.0 // indirect
-	golang.org/x/term v0.45.0 // indirect
-	golang.org/x/text v0.41.0 // indirect
+	golang.org/x/sys v0.48.0 // indirect
+	golang.org/x/term v0.46.0 // indirect
+	golang.org/x/text v0.42.0 // indirect
 	golang.org/x/time v0.15.0 // indirect
-	golang.org/x/tools v0.49.0 // indirect
+	golang.org/x/tools v0.50.0 // indirect
 	gomodules.xyz/jsonpatch/v2 v2.4.0 // indirect
 	gopkg.in/inf.v0 v0.9.1 // indirect
 	gopkg.in/natefinch/lumberjack.v2 v2.2.1 // indirect
```

**File**: `go.sum` (modified, +18/-18)
```diff
@@ -605,19 +605,19 @@ golang.org/x/crypto v0.13.0/go.mod h1:y6Z2r+Rw4iayiXXAIxJIDAJ1zMW4yaTpebo8fPOliY
 golang.org/x/crypto v0.19.0/go.mod h1:Iy9bg/ha4yyC70EfRS8jz+B6ybOBKMaSxLj6P6oBDfU=
 golang.org/x/crypto v0.23.0/go.mod h1:CKFgDieR+mRhux2Lsu27y0fO304Db0wZe70UKqHu0v8=
 golang.org/x/crypto v0.30.0/go.mod h1:kDsLvtWBEx7MV9tJOj9bnXsPbxwJQ6csT/x4KIN4Ssk=
-golang.org/x/crypto v0.55.0 h1:+KWHjbgOaAQ66dh/YlkZKHlz9ZUlq61AFirAR9ntP8M=
-golang.org/x/crypto v0.55.0/go.mod h1:uq0V9dE/fzQuJtbnL+2EhWOE63vo164FY8xqEnV9xis=
-golang.org/x/exp v0.0.0-20260824195058-e88cd73687aa h1:QSyA8ishJCyT21kER9KwNt0b7BM3iRK4x9QXhjN5Fdk=
-golang.org/x/exp v0.0.0-20260824195058-e88cd73687aa/go.mod h1:zeBbvyFKDaLwa7CH/zI8KXt7gTl14SF7sO08Pl5jBCM=
+golang.org/x/crypto v0.57.0 h1:3ZVCjf8Ggz7zneR/EHRVx68Ctf+2pmIMP2UFhh9cC6M=
+golang.org/x/crypto v0.57.0/go.mod h1:Fdz0i5U6CoizGwLda9DttjSk6qlZo25zYNtR+ycvuZA=
+golang.org/x/exp v0.0.0-20260908205506-85c1c2202aba h1:Ck8QetSgk912qxWLMCKxd0in+aiyBQyDSMae6e/xmpU=
+golang.org/x/exp v0.0.0-20260908205506-85c1c2202aba/go.mod h1:50RgIsmK7OwqzTTeqcSXQW8SswW0o8fRcDxmqGluJ8E=
 golang.org/x/mod v0.2.0/go.mod h1:s0Qsj1ACt9ePp/hMypM3fl4fZqREWJwdYDEqhRiZZUA=
 golang.org/x/mod v0.3.0/go.mod h1:s0Qsj1ACt9ePp/hMypM3fl4fZqREWJwdYDEqhRiZZUA=
 golang.org/x/mod v0.6.0-dev.0.20220419223038-86c51ed26bb4/go.mod h1:jJ57K6gSWd91VN4djpZkiMVwK6gcyfeH4XE8wZrZaV4=
 golang.org/x/mod v0.8.0/go.mod h1:iBbtSCu2XBx23ZKBPSOrRkjjQPZFPuis4dIYUhu/chs=
 golang.org/x/mod v0.12.0/go.mod h1:iBbtSCu2XBx23ZKBPSOrRkjjQPZFPuis4dIYUhu/chs=
 golang.org/x/mod v0.15.0/go.mod h1:hTbmBsO62+eylJbnUtE2MGJUyE7QWk4xUqPFrRgJ+7c=
 golang.org/x/mod v0.17.0/go.mod h1:hTbmBsO62+eylJbnUtE2MGJUyE7QWk4xUqPFrRgJ+7c=
-golang.org/x/mod v0.39.0 h1:UF5zwQdCRRUpHfyPwr7d4UrGiVeldIsogtzWVnczL74=
-golang.org/x/mod v0.39.0/go.mod h1:bvIbwjQ0HUFFf5AKukeeYQG4ZBUG9yxQbR9aEweIwYY=
+golang.org/x/mod v0.41.0 h1:qJmnOUb4YB+FsEuM3HcWucdZASCPGhsX6uljO6pog0c=
+golang.org/x/mod v0.41.0/go.mod h1:Ek9pY8RKWXwsWvd3rQiHYtMqkjSUV+s1Rj7j4H5Ur6o=
 golang.org/x/net v0.0.0-20180724234803-3673e40ba225/go.mod h1:mL1N/T3taQHkDXs73rZJwtUhF3w3ftmwwsq0BUmARs4=
 golang.org/x/net v0.0.0-20180906233101-161cd47e91fd/go.mod h1:mL1N/T3taQHkDXs73rZJwtUhF3w3ftmwwsq0BUmARs4=
 golang.org/x/net v0.0.0-20190311183353-d8887717615a/go.mod h1:t9HGtf8HONx5eT2rtn7q6eTqICYqUVnKs3thJo3Qplg=
@@ -634,8 +634,8 @@ golang.org/x/net v0.10.0/go.mod h1:0qNGK6F8kojg2nk9dLZ2mShWaEBan6FAoqfSigmmuDg=
 golang.org/x/net v0.15.0/go.mod h1:idbUs1IY1+zTqbi8yxTbhexhEEk5ur9LInksu6HrEpk=
 golang.org/x/net v0.21.0/go.mod h1:bIjVDfnllIU7BJ2DNgfnXvpSvtn8VRwhlsaeUTyUS44=
 golang.org/x/net v0.25.0/go.mod h1:JkAGAh7GEvH74S6FOH42FLoXpXbE/aqXSrIQjXgsiwM=
-golang.org/x/net v0.58.0 h1:ynWG7rqYi4ccpTEuPZ2QGWHktVEM9DMCj9yzDE0Q7To=
-golang.org/x/net v0.58.0/go.mod h1:YwCddHnFlT7eLQqVprV19OnhLGtc5xOKgE0RyqgfWAU=
+golang.org/x/net v0.59.0 h1:5zfYln+w5XCxwrnMMJPufRgNoXEaGxl0wo5GqPXyues=
+golang.org/x/net v0.59.0/go.mod h1:2DA/G1UfVbCpQPeWTmMPGY7Cs2PkBkwu743bVX5PIVg=
 golang.org/x/oauth2 v0.0.0-20180821212333-d2e6202438be/go.mod h1:N/0e6XlmueqKjAGxoOufVs8QHGRruUQn6yWY3a++T0U=
 golang.org/x/oauth2 v0.0.0-20181106182150-f42d05182288/go.mod h1:N/0e6XlmueqKjAGxoOufVs8QHGRruUQn6yWY3a++T0U=
 golang.org/x/oauth2 v0.36.0 h1:peZ/1z27fi9hUOFCAZaHyrpWG5lwe0RJEEEeH0ThlIs=
@@ -650,8 +650,8 @@ golang.org/x/sync v0.3.0/go.mod h1:FU7BRWz2tNW+3quACPkgCx/L+uEAv1htQ0V83Z9Rj+Y=
 golang.org/x/sync v0.6.0/go.mod h1:Czt+wKu1gCyEFDUtn0jG5QVvpJ6rzVqr5aXyt9drQfk=
 golang.org/x/sync v0.7.0/go.mod h1:Czt+wKu1gCyEFDUtn0jG5QVvpJ6rzVqr5aXyt9drQfk=
 golang.org/x/sync v0.10.0/go.mod h1:Czt+wKu1gCyEFDUtn0jG5QVvpJ6rzVqr5aXyt9drQfk=
-golang.org/x/sync v0.22.0 h1:SZjpbeLmrCk4xhRSZFNZW5gFUeCeFgjekvI/+gfScek=
-golang.org/x/sync v0.22.0/go.mod h1:9xrNwdLfx4jkKbNva9FpL6vEN7evnE43NNNJQ2LF3+0=
+golang.org/x/sync v0.23.0 h1:KameEIfc1IkluZyXWLn39Wd4tURc6GbCiISGiZm2bQk=
+golang.org/x/sync v0.23.0/go.mod h1:sUUOizhqBxiL6pEWpqNLUiaJn1ShEbZ6BBqskPbjZm0=
 golang.org/x/sys v0.0.0-20180909124046-d0be0721c37e/go.mod h1:STP8DvDyc/dI5b8T5hshtkjS+E42TnysNCUPdjciGhY=
 golang.org/x/sys v0.0.0-20190215142949-d0b11bdaac8a/go.mod h1:STP8DvDyc/dI5b8T5hshtkjS+E42TnysNCUPdjciGhY=
 golang.org/x/sys v0.0.0-20190222072716-a9d3bda3a223/go.mod h1:STP8DvDyc/dI5b8T5hshtkjS+E42TnysNCUPdjciGhY=
@@ -681,8 +681,8 @@ golang.org/x/sys v0.12.0/go.mod h1:oPkhp1MJrh7nUepCBck5+mAzfO9JrbApNNgaTdGDITg=
 golang.org/x/sys v0.17.0/go.mod h1:/VUhepiaJMQUp4+oa/7Zr1D23ma6VTLIYjOOTFZPUcA=
 golang.org/x/sys v0.20.0/go.mod h1:/VUhepiaJMQUp4+oa/7Zr1D23ma6VTLIYjOOTFZPUcA=
 golang.org/x/sys v0.28.0/go.mod h1:/VUhepiaJMQUp4+oa/7Zr1D23ma6VTLIYjOOTFZPUcA=
-golang.org/x/sys v0.47.0 h1:o7XGOvZQCADBQQ4Y7VNq2dRWQR7JmOUW8Kxx4ZsNgWs=
-golang.org/x/sys v0.47.0/go.mod h1:4GL1E5IUh+htKOUEOaiffhrAeqysfVGipDYzABqnCmw=
+golang.org/x/sys v0.48.0 h1:bbX/i/6MgT9BVLM9RT1thmxL04yeTAhbEz4SyadbXoo=
+golang.org/x/sys v0.48.0/go.mod h1:hNLxWAXmnKAxqDtdwIYC4bM9oQPEecfsnNMuSxOs3og=
 golang.org/x/telemetry v0.0.0-20240228155512-f48c80bd79b2/go.mod h1:TeRTkGYfJXctD9Ocfy
```

**File**: `vendor/golang.org/x/net/html/escape.go` (modified, +1/-4)
```diff
@@ -154,10 +154,7 @@ func unescapeEntity(s []byte, attribute bool) (rune, rune, int) {
 	} else if x := entity2[entityName]; x[0] != 0 {
 		return x[0], x[1], i
 	} else if !attribute {
-		maxLen := len(entityName) - 1
-		if maxLen > longestEntityWithoutSemicolon {
-			maxLen = longestEntityWithoutSemicolon
-		}
+		maxLen := min(len(entityName)-1, longestEntityWithoutSemicolon)
 		for j := maxLen; j > 1; j-- {
 			if x := entity[entityName[:j]]; x != 0 {
 				return x, 0, j + 1
```

**File**: `vendor/golang.org/x/net/http2/ascii.go` (modified, +13/-1)
```diff
@@ -4,7 +4,9 @@
 
 package http2
 
-import "strings"
+import (
+	"strings"
+)
 
 // The HTTP protocols are defined in terms of ASCII, not Unicode. This file
 // contains helper functions which may use Unicode-aware functions which would
@@ -43,6 +45,16 @@ func isASCIIPrint(s string) bool {
 	return true
 }
 
+// isASCII returns whether s is ASCII.
+func isASCII(s string) bool {
+	for i := 0; i < len(s); i++ {
+		if s[i] > 0x7f {
+			return false
+		}
+	}
+	return true
+}
+
 // asciiToLower returns the lowercase version of s if s is ASCII and printable,
 // and whether or not it was.
 func asciiToLower(s string) (lower string, ok bool) {
```

**File**: `vendor/golang.org/x/net/http2/databuffer.go` (modified, +1/-4)
```diff
@@ -121,10 +121,7 @@ func (b *dataBuffer) Write(p []byte) (int, error) {
 		// If the last chunk is empty, allocate a new chunk. Try to allocate
 		// enough to fully copy p plus any additional bytes we expect to
 		// receive. However, this may allocate less than len(p).
-		want := int64(len(p))
-		if b.expected > want {
-			want = b.expected
-		}
+		want := max(int64(len(p)), b.expected)
 		chunk := b.lastChunkOrAlloc(want)
 		n := copy(chunk[b.w:], p)
 		p = p[n:]
```

**File**: `vendor/golang.org/x/net/http2/server_common.go` (modified, +47/-0)
```diff
@@ -25,6 +25,8 @@ import (
 //
 //	https://golang.org/pkg/net/http/#ResponseWriter
 //	https://golang.org/pkg/net/http/#example_ResponseWriter_trailers
+//
+// Deprecated: Use [http.TrailerPrefix] instead.
 const TrailerPrefix = "Trailer:"
 
 // Push errors.
@@ -38,16 +40,22 @@ var (
 // The configuration conf may be nil.
 //
 // ConfigureServer must be called before s begins serving.
+//
+// Deprecated: Set [http.Server.Protocols] instead.
 func ConfigureServer(s *http.Server, conf *Server) error {
 	return configureServer(s, conf)
 }
 
 // Server is an HTTP/2 server.
+//
+// Deprecated: Use [http.Server] instead.
 type Server struct {
 	// MaxHandlers limits the number of http.Handler ServeHTTP goroutines
 	// which may run at a time over all connections.
 	// Negative or zero no limit.
 	// TODO: implement
+	//
+	// Deprecated: This field has never had any effect.
 	MaxHandlers int
 
 	// MaxConcurrentStreams optionally specifies the number of
@@ -56,64 +64,96 @@ type Server struct {
 	// which may be active globally, which is MaxHandlers.
 	// If zero, MaxConcurrentStreams defaults to at least 100, per
 	// the HTTP/2 spec's recommendations.
+	//
+	// Deprecated: Use [http.Server.HTTP2] and
+	// [http.HTTP2Config.MaxConcurrentStreams] instead.
 	MaxConcurrentStreams uint32
 
 	// MaxDecoderHeaderTableSize optionally specifies the http2
 	// SETTINGS_HEADER_TABLE_SIZE to send in the initial settings frame. It
 	// informs the remote endpoint of the maximum size of the header compression
 	// table used to decode header blocks, in octets. If zero, the default value
 	// of 4096 is used.
+	//
+	// Deprecated: Use [http.Server.HTTP2] and
+	// [http.HTTP2Config.MaxDecoderHeaderTableSize] instead.
 	MaxDecoderHeaderTableSize uint32
 
 	// MaxEncoderHeaderTableSize optionally specifies an upper limit for the
 	// header compression table used for encoding request headers. Received
 	// SETTINGS_HEADER_TABLE_SIZE settings are capped at this limit. If zero,
 	// the default value of 4096 is used.
+	//
+	// Deprecated: Use [http.Server.HTTP2] and
+	// [http.HTTP2Config.MaxEncoderHeaderTableSize] instead.
 	MaxEncoderHeaderTableSize uint32
 
 	// MaxReadFrameSize optionally specifies the largest frame
 	// this server is willing to read. A valid value is between
 	// 16k and 16M, inclusive. If zero or otherwise invalid, a
 	// default value is used.
+	//
+	// Deprecated: Use [http.Server.HTTP2] and
+	// [http.HTTP2Config.MaxReadFrameSize] instead.
 	MaxReadFrameSize uint32
 
 	// PermitProhibitedCipherSuites, if true, permits the use of
 	// cipher suites prohibited by the HTTP/2 spec.
+	//
+	// Deprecated: Use [http.Server.HTTP2] and
+	// [http.HTTP2Config.PermitProhibitedCipherSuites] instead.
 	PermitProhibitedCipherSuites bool
 
 	// IdleTimeout specifies how long until idle clients should be
 	// closed with a GOAWAY frame. PING frames are not considered
 	// activity for the purposes of IdleTimeout.
 	// If zero or negative, there is no timeout.
+	//
+	// Deprecated: Use [http.Server.IdleTimeout] instead.
 	IdleTimeout time.Duration
 
 	// ReadIdleTimeout is the timeout after which a health check using a ping
 	// frame will be carried out if no frame is received on the connection.
 	// If zero, no health check is performed.
+	//
+	// Deprecated: Use [http.Server.HTTP2] and
+	// [http.HTTP2Config.SendPingTimeout] instead.
 	ReadIdleTimeout time.Duration
 
 	// PingTimeout is the timeout after which the connection will be closed
 	// if a response to a ping is not received.
 	// If zero, a default of 15 seconds is used.
+	//
+	// Deprecated: Use [http.Server.HTTP2] and
+	// [http.HTTP2Config.PingTimeout] instead.
 	PingTimeout time.Duration
 
 	// WriteByteTimeout is the timeout after which a connection will be
 	// closed if no data can be written to it. The timeout begins when data is
 	// available to write, and is extended whenever any bytes are written.
 	// If zero or negative, there is no timeout.
+	//
+	// Deprecated: Use [http.Server.HTTP2] and
+	// [http.HTTP2Config.WriteByteTimeout] instead.
 	WriteByteTimeout time.Duration
 
 	// MaxUploadBufferPerConnection is the size of the initial flow
 	// control window for each connections. The HTTP/2 spec does not
 	// allow this to be smaller than 65535 or larger than 2^32-1.
 	// If the value is outside this range, a default value will be
 	// used instead.
+	//
+	// Deprecated: Use [http.Server.HTTP2] and
+	// [http.HTTP2Config.MaxReceiveBufferPerConnection] instead.
 	MaxUploadBufferPerConnection int32
 
 	// MaxUploadBufferPerStream is the size of the initial flow control
 	// window for each stream. The HTTP/2 spec does not allow this to
 	// be larger than 2^32-1. If the value is zero or larger than the
 	// maximum, a default value will be used instead.
+	//
+	// Deprecated: Use [http.Server.HTTP2] and
+	// [http.HTTP2Config.MaxReceiveBufferPerStream] instead.
 	MaxUploadBufferPerStream int32
 
 	// NewWriteScheduler constructs a write scheduler fo
```

**File**: `vendor/golang.org/x/net/http2/transport.go` (modified, +2/-0)
```diff
@@ -184,6 +184,8 @@ func (t *Transport) initConnPool() {
 
 // ClientConn is the state of a single HTTP/2 client connection to an
 // HTTP/2 server.
+//
+// Deprecated: Use [http.ClientConn] instead.
 type ClientConn struct {
 	t             *Transport
 	tconn         net.Conn             // usually *tls.Conn, except specialized impls
```

**File**: `vendor/golang.org/x/net/http2/transport_common.go` (modified, +74/-5)
```diff
@@ -24,13 +24,17 @@ import (
 // It returns an error if t1 has already been HTTP/2-enabled.
 //
 // Use ConfigureTransports instead to configure the HTTP/2 Transport.
+//
+// Deprecated: Set [http.Transport.Protocols] instead.
 func ConfigureTransport(t1 *http.Transport) error {
 	return configureTransport(t1)
 }
 
 // ConfigureTransports configures a net/http HTTP/1 Transport to use HTTP/2.
 // It returns a new HTTP/2 Transport for further configuration.
 // It returns an error if t1 has already been HTTP/2-enabled.
+//
+// Deprecated: Set [http.Transport.Protocols] instead.
 func ConfigureTransports(t1 *http.Transport) (*Transport, error) {
 	return configureTransports(t1)
 }
@@ -39,6 +43,8 @@ func ConfigureTransports(t1 *http.Transport) (*Transport, error) {
 //
 // A Transport internally caches connections to servers. It is safe
 // for concurrent use by multiple goroutines.
+//
+// Deprecated: Use [http.Transport] instead.
 type Transport struct {
 	// DialTLSContext specifies an optional dial function with context for
 	// creating TLS connections for requests.
@@ -47,24 +53,30 @@ type Transport struct {
 	//
 	// If the returned net.Conn has a ConnectionState method like tls.Conn,
 	// it will be used to set http.Response.TLS.
+	//
+	// Deprecated: Use [http.Transport.DialTLSContext] instead.
 	DialTLSContext func(ctx context.Context, network, addr string, cfg *tls.Config) (net.Conn, error)
 
 	// DialTLS specifies an optional dial function for creating
 	// TLS connections for requests.
 	//
 	// If DialTLSContext and DialTLS is nil, tls.Dial is used.
 	//
-	// Deprecated: Use DialTLSContext instead, which allows the transport
-	// to cancel dials as soon as they are no longer needed.
-	// If both are set, DialTLSContext takes priority.
+	// Deprecated: Use [http.Transport.DialTLSContext] instead.
 	DialTLS func(network, addr string, cfg *tls.Config) (net.Conn, error)
 
 	// TLSClientConfig specifies the TLS configuration to use with
 	// tls.Client. If nil, the default configuration is used.
+	//
+	// Deprecated: Use [http.Transport.TLSClientConfig] instead.
 	TLSClientConfig *tls.Config
 
 	// ConnPool optionally specifies an alternate connection pool to use.
 	// If nil, the default is used.
+	//
+	// Deprecated: To create a custom connection pool, implement
+	// [http.RoundTripper]. Use [http.Transport.NewClientConn]
+	// to create connections for the pool.
 	ConnPool ClientConnPool
 
 	// DisableCompression, if true, prevents the Transport from
@@ -75,10 +87,14 @@ type Transport struct {
 	// decoded in the Response.Body. However, if the user
 	// explicitly requested gzip it is not automatically
 	// uncompressed.
+	//
+	// Deprecated: Use [http.Transport.DisableCompression] instead.
 	DisableCompression bool
 
 	// AllowHTTP, if true, permits HTTP/2 requests using the insecure,
 	// plain-text "http" scheme. Note that this does not enable h2c support.
+	//
+	// Deprecated: Use [http.Transport.Protocols] instead.
 	AllowHTTP bool
 
 	// MaxHeaderListSize is the http2 SETTINGS_MAX_HEADER_LIST_SIZE to
@@ -88,6 +104,8 @@ type Transport struct {
 	// want to advertise an unlimited value to the peer, Transport
 	// interprets the highest possible value here (0xffffffff or 1<<32-1)
 	// to mean no limit.
+	//
+	// Deprecated: Use [http.Transport.MaxResponseHeaderBytes] instead.
 	MaxHeaderListSize uint32
 
 	// MaxReadFrameSize is the http2 SETTINGS_MAX_FRAME_SIZE to send in the
@@ -97,19 +115,28 @@ type Transport struct {
 	// according to the spec:
 	// https://datatracker.ietf.org/doc/html/rfc7540#section-6.5.2.
 	// Values are bounded in the range 16k to 16M.
+	//
+	// Deprecated: Use [http.Transport.HTTP2] and
+	// [http.HTTP2Config.MaxReadFrameSize] instead.
 	MaxReadFrameSize uint32
 
 	// MaxDecoderHeaderTableSize optionally specifies the http2
 	// SETTINGS_HEADER_TABLE_SIZE to send in the initial settings frame. It
 	// informs the remote endpoint of the maximum size of the header compression
 	// table used to decode header blocks, in octets. If zero, the default value
 	// of 4096 is used.
+	//
+	// Deprecated: Use [http.Transport.HTTP2] and
+	// [http.HTTP2Config.MaxDecoderHeaderTableSize] instead.
 	MaxDecoderHeaderTableSize uint32
 
 	// MaxEncoderHeaderTableSize optionally specifies an upper limit for the
 	// header compression table used for encoding request headers. Received
 	// SETTINGS_HEADER_TABLE_SIZE settings are capped at this limit. If zero,
 	// the default value of 4096 is used.
+	//
+	// Deprecated: Use [http.Transport.HTTP2] and
+	// [http.HTTP2Config.MaxEncoderHeaderTableSize] instead.
 	MaxEncoderHeaderTableSize uint32
 
 	// StrictMaxConcurrentStreams controls whether the server's
@@ -120,12 +147,17 @@ type Transport struct {
 	// server's SETTINGS_MAX_CONCURRENT_STREAMS is interpreted as
 	// a global limit and callers of RoundTrip block when needed,
 	// waiting for their turn.
+	//
+	// Deprecated: Use [http.Transport.HTTP2] and
+	// [http.HTTP2Config.StrictMaxCo
```

---

### Incident Patch 5: `70085485` (2026-09-23)
**Commit Message**: fix(deps): update module github.com/kubernetes-csi/external-snapshotter/client/v8 to v8.6.0 (#2449)

* fix(deps): update module github.com/kubernetes-csi/external-snapshotter/client/v8 to v8.6.0

* chore(deps): sync root vendor metadata

---------

Co-authored-by: renovate[bot] <29139614+renovate[bot]@users.noreply.github.com>
Co-authored-by: Caue Santos <[REDACTED_EMAIL]>
Monorepo-Commit: 7a4d28ac4b261300bc83011e1d19940a2bc9aacc

**File**: `go.mod` (modified, +1/-1)
```diff
@@ -20,7 +20,7 @@ require (
 	github.com/hashicorp/go-plugin v1.8.0
 	github.com/hashicorp/golang-lru/v2 v2.0.7
 	github.com/invopop/jsonschema v0.14.0
-	github.com/kubernetes-csi/external-snapshotter/client/v8 v8.2.0
+	github.com/kubernetes-csi/external-snapshotter/client/v8 v8.6.0
 	github.com/loft-sh/admin-apis v0.0.0-20260721223200-58c89e54604e
 	github.com/loft-sh/agentapi/v4 v4.12.0-rc.3
 	github.com/loft-sh/analytics-client v0.0.0-20240219162240-2f4c64b2494e
```

**File**: `go.sum` (modified, +2/-2)
```diff
@@ -338,8 +338,8 @@ github.com/kr/pty v1.1.1/go.mod h1:pFQYn66WHrOpPYNljwOMqo10TkYh1fy3cYio2l3bCsQ=
 github.com/kr/text v0.1.0/go.mod h1:4Jbv+DJW3UT/LiOwJeYQe1efqtUx/iVham/4vfdArNI=
 github.com/kr/text v0.2.0 h1:5Nx0Ya0ZqY2ygV366QzturHI13Jq95ApcVaJBhpS+AY=
 github.com/kr/text v0.2.0/go.mod h1:eLer722TekiGuMkidMxC/pM04lWEeraHUUmBw8l2grE=
-github.com/kubernetes-csi/external-snapshotter/client/v8 v8.2.0 h1:Q3jQ1NkFqv5o+F8dMmHd8SfEmlcwNeo1immFApntEwE=
-github.com/kubernetes-csi/external-snapshotter/client/v8 v8.2.0/go.mod h1:E3vdYxHj2C2q6qo8/Da4g7P+IcwqRZyy3gJBzYybV9Y=
+github.com/kubernetes-csi/external-snapshotter/client/v8 v8.6.0 h1:FtGewu2k6HWw6evLGXY8JqUZ9eHpti1kd3e4amj+ilA=
+github.com/kubernetes-csi/external-snapshotter/client/v8 v8.6.0/go.mod h1:Vxl89NySJ45J+ah3NTMan/KJXW+NpcGHE2Tw0GSw53k=
 github.com/kylelemons/godebug v1.1.0 h1:RPNrshWIDI6G2gRW9EHilWtl7Z6Sb1BR0xunSBf0SNc=
 github.com/kylelemons/godebug v1.1.0/go.mod h1:9/0rRGxNHcop5bhtWyNeEfOS8JIWk580+fNqagV/RAw=
 github.com/liggitt/tabwriter v0.0.0-20181228230101-89fcab3d43de h1:9TO3cAIGXtEhnIaL+V+BEER86oLrvS+kWobKpbJuye0=
```

**File**: `vendor/github.com/kubernetes-csi/external-snapshotter/client/v8/apis/volumegroupsnapshot/v1/doc.go` (added, +20/-0)
```diff
@@ -0,0 +1,20 @@
+/*
+Copyright 2026 The Kubernetes Authors.
+
+Licensed under the Apache License, Version 2.0 (the "License");
+you may not use this file except in compliance with the License.
+You may obtain a copy of the License at
+
+    http://www.apache.org/licenses/LICENSE-2.0
+
+Unless required by applicable law or agreed to in writing, software
+distributed under the License is distributed on an "AS IS" BASIS,
+WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
+See the License for the specific language governing permissions and
+limitations under the License.
+*/
+
+// +k8s:deepcopy-gen=package
+// +groupName=groupsnapshot.storage.k8s.io
+
+package v1
```

**File**: `vendor/github.com/kubernetes-csi/external-snapshotter/client/v8/apis/volumegroupsnapshot/v1/register.go` (added, +57/-0)
```diff
@@ -0,0 +1,57 @@
+/*
+Copyright 2026 The Kubernetes Authors.
+Licensed under the Apache License, Version 2.0 (the "License");
+you may not use this file except in compliance with the License.
+You may obtain a copy of the License at
+    http://www.apache.org/licenses/LICENSE-2.0
+Unless required by applicable law or agreed to in writing, software
+distributed under the License is distributed on an "AS IS" BASIS,
+WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
+See the License for the specific language governing permissions and
+limitations under the License.
+*/
+
+package v1
+
+import (
+	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
+	"k8s.io/apimachinery/pkg/runtime"
+	"k8s.io/apimachinery/pkg/runtime/schema"
+)
+
+// GroupName is the group name use in this package.
+const GroupName = "groupsnapshot.storage.k8s.io"
+
+var (
+	// SchemeBuilder is the new scheme builder
+	SchemeBuilder = runtime.NewSchemeBuilder(addKnownTypes)
+	// AddToScheme adds to scheme
+	AddToScheme = SchemeBuilder.AddToScheme
+	// SchemeGroupVersion is the group version used to register these objects.
+	SchemeGroupVersion = schema.GroupVersion{Group: GroupName, Version: "v1"}
+)
+
+func Resource(resource string) schema.GroupResource {
+	return SchemeGroupVersion.WithResource(resource).GroupResource()
+}
+
+func init() {
+	// We only register manually written functions here. The registration of the
+	// generated functions takes place in the generated files. The separation
+	// makes the code compile even when the generated files are missing.
+	SchemeBuilder.Register(addKnownTypes)
+}
+
+// addKnownTypes adds the set of types defined in this package to the supplied scheme.
+func addKnownTypes(scheme *runtime.Scheme) error {
+	scheme.AddKnownTypes(SchemeGroupVersion,
+		&VolumeGroupSnapshotClass{},
+		&VolumeGroupSnapshotClassList{},
+		&VolumeGroupSnapshot{},
+		&VolumeGroupSnapshotList{},
+		&VolumeGroupSnapshotContent{},
+		&VolumeGroupSnapshotContentList{},
+	)
+	metav1.AddToGroupVersion(scheme, SchemeGroupVersion)
+	return nil
+}
```

**File**: `vendor/github.com/kubernetes-csi/external-snapshotter/client/v8/apis/volumegroupsnapshot/v1/types.go` (added, +444/-0)
```diff
@@ -0,0 +1,444 @@
+/*
+Copyright 2026 The Kubernetes Authors.
+
+Licensed under the Apache License, Version 2.0 (the "License");
+you may not use this file except in compliance with the License.
+You may obtain a copy of the License at
+
+    http://www.apache.org/licenses/LICENSE-2.0
+
+Unless required by applicable law or agreed to in writing, software
+distributed under the License is distributed on an "AS IS" BASIS,
+WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
+See the License for the specific language governing permissions and
+limitations under the License.
+*/
+// +kubebuilder:object:generate=true
+package v1
+
+import (
+	core_v1 "k8s.io/api/core/v1"
+	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
+
+	snapshotv1 "github.com/kubernetes-csi/external-snapshotter/client/v8/apis/volumesnapshot/v1"
+)
+
+// VolumeGroupSnapshotSpec defines the desired state of a volume group snapshot.
+type VolumeGroupSnapshotSpec struct {
+	// Source specifies where a group snapshot will be created from.
+	// This field is immutable after creation.
+	// Required.
+	Source VolumeGroupSnapshotSource `json:"source" protobuf:"bytes,1,opt,name=source"`
+
+	// VolumeGroupSnapshotClassName is the name of the VolumeGroupSnapshotClass
+	// requested by the VolumeGroupSnapshot.
+	// VolumeGroupSnapshotClassName may be left nil to indicate that the default
+	// class will be used.
+	// Empty string is not allowed for this field.
+	// +optional
+	// +kubebuilder:validation:XValidation:rule="size(self) > 0",message="volumeGroupSnapshotClassName must not be the empty string when set"
+	VolumeGroupSnapshotClassName *string `json:"volumeGroupSnapshotClassName,omitempty" protobuf:"bytes,2,opt,name=volumeGroupSnapshotClassName"`
+}
+
+// VolumeGroupSnapshotSource specifies whether the underlying group snapshot should be
+// dynamically taken upon creation or if a pre-existing VolumeGroupSnapshotContent
+// object should be used.
+// Exactly one of its members must be set.
+// Members in VolumeGroupSnapshotSource are immutable.
+// +kubebuilder:validation:XValidation:rule="!has(oldSelf.selector) || has(self.selector)", message="selector is required once set"
+// +kubebuilder:validation:XValidation:rule="!has(oldSelf.volumeGroupSnapshotContentName) || has(self.volumeGroupSnapshotContentName)", message="volumeGroupSnapshotContentName is required once set"
+// +kubebuilder:validation:XValidation:rule="(has(self.selector) && !has(self.volumeGroupSnapshotContentName)) || (!has(self.selector) && has(self.volumeGroupSnapshotContentName))", message="exactly one of selector and volumeGroupSnapshotContentName must be set"
+type VolumeGroupSnapshotSource struct {
+	// Selector is a label query over persistent volume claims that are to be
+	// grouped together for snapshotting.
+	// This labelSelector will be used to match the label added to a PVC.
+	// If the label is added or removed to a volume after a group snapshot
+	// is created, the existing group snapshots won't be modified.
+	// Once a VolumeGroupSnapshotContent is created and the sidecar starts to process
+	// it, the volume list will not change with retries.
+	// +optional
+	// +kubebuilder:validation:XValidation:rule="self == oldSelf",message="selector is immutable"
+	Selector *metav1.LabelSelector `json:"selector,omitempty" protobuf:"bytes,1,opt,name=selector"`
+
+	// VolumeGroupSnapshotContentName specifies the name of a pre-existing VolumeGroupSnapshotContent
+	// object representing an existing volume group snapshot.
+	// This field should be set if the volume group snapshot already exists and
+	// only needs a representation in Kubernetes.
+	// This field is immutable.
+	// +optional
+	// +kubebuilder:validation:XValidation:rule="self == oldSelf",message="volumeGroupSnapshotContentName is immutable"
+	VolumeGroupSnapshotContentName *string `json:"volumeGroupSnapshotContentName,omitempty" protobuf:"bytes,2,opt,name=volumeGroupSnapshotContentName"`
+}
+
+// VolumeGroupSnapshotStatus defines the observed state of volume group snapshot.
+type VolumeGroupSnapshotStatus struct {
+	// BoundVolumeGroupSnapshotContentName is the name of the VolumeGroupSnapshotContent
+	// object to which this VolumeGroupSnapshot object intends to bind to.
+	// If not specified, it indicates that the VolumeGroupSnapshot object has not
+	// been successfully bound to a VolumeGroupSnapshotContent object yet.
+	// NOTE: To avoid possible security issues, consumers must verify binding between
+	// VolumeGroupSnapshot and VolumeGroupSnapshotContent objects is successful
+	// (by validating that both VolumeGroupSnapshot and VolumeGroupSnapshotContent
+	// point at each other) before using this object.
+	// +kubebuilder:validation:XValidation:rule="self == oldSelf",message="boundVolumeGroupSnapshotContentName is immutable once set"
+	// +optional
+	BoundVolumeGroupSnapshotContentName *string `json:"boundVolumeGroupSnapshotContentName,omitempty" protobuf:"bytes,1,opt,name=boundVolumeGroupSn
```

**File**: `vendor/github.com/kubernetes-csi/external-snapshotter/client/v8/apis/volumegroupsnapshot/v1/zz_generated.deepcopy.go` (added, +466/-0)
```diff
@@ -0,0 +1,466 @@
+//go:build !ignore_autogenerated
+// +build !ignore_autogenerated
+
+/*
+Copyright 2026 The Kubernetes Authors.
+
+Licensed under the Apache License, Version 2.0 (the "License");
+you may not use this file except in compliance with the License.
+You may obtain a copy of the License at
+
+    http://www.apache.org/licenses/LICENSE-2.0
+
+Unless required by applicable law or agreed to in writing, software
+distributed under the License is distributed on an "AS IS" BASIS,
+WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
+See the License for the specific language governing permissions and
+limitations under the License.
+*/
+
+// Code generated by deepcopy-gen. DO NOT EDIT.
+
+package v1
+
+import (
+	volumesnapshotv1 "github.com/kubernetes-csi/external-snapshotter/client/v8/apis/volumesnapshot/v1"
+	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
+	runtime "k8s.io/apimachinery/pkg/runtime"
+)
+
+// DeepCopyInto is an autogenerated deepcopy function, copying the receiver, writing into out. in must be non-nil.
+func (in *GroupSnapshotHandles) DeepCopyInto(out *GroupSnapshotHandles) {
+	*out = *in
+	if in.VolumeSnapshotHandles != nil {
+		in, out := &in.VolumeSnapshotHandles, &out.VolumeSnapshotHandles
+		*out = make([]string, len(*in))
+		copy(*out, *in)
+	}
+	return
+}
+
+// DeepCopy is an autogenerated deepcopy function, copying the receiver, creating a new GroupSnapshotHandles.
+func (in *GroupSnapshotHandles) DeepCopy() *GroupSnapshotHandles {
+	if in == nil {
+		return nil
+	}
+	out := new(GroupSnapshotHandles)
+	in.DeepCopyInto(out)
+	return out
+}
+
+// DeepCopyInto is an autogenerated deepcopy function, copying the receiver, writing into out. in must be non-nil.
+func (in *VolumeGroupSnapshot) DeepCopyInto(out *VolumeGroupSnapshot) {
+	*out = *in
+	out.TypeMeta = in.TypeMeta
+	in.ObjectMeta.DeepCopyInto(&out.ObjectMeta)
+	in.Spec.DeepCopyInto(&out.Spec)
+	if in.Status != nil {
+		in, out := &in.Status, &out.Status
+		*out = new(VolumeGroupSnapshotStatus)
+		(*in).DeepCopyInto(*out)
+	}
+	return
+}
+
+// DeepCopy is an autogenerated deepcopy function, copying the receiver, creating a new VolumeGroupSnapshot.
+func (in *VolumeGroupSnapshot) DeepCopy() *VolumeGroupSnapshot {
+	if in == nil {
+		return nil
+	}
+	out := new(VolumeGroupSnapshot)
+	in.DeepCopyInto(out)
+	return out
+}
+
+// DeepCopyObject is an autogenerated deepcopy function, copying the receiver, creating a new runtime.Object.
+func (in *VolumeGroupSnapshot) DeepCopyObject() runtime.Object {
+	if c := in.DeepCopy(); c != nil {
+		return c
+	}
+	return nil
+}
+
+// DeepCopyInto is an autogenerated deepcopy function, copying the receiver, writing into out. in must be non-nil.
+func (in *VolumeGroupSnapshotClass) DeepCopyInto(out *VolumeGroupSnapshotClass) {
+	*out = *in
+	out.TypeMeta = in.TypeMeta
+	in.ObjectMeta.DeepCopyInto(&out.ObjectMeta)
+	if in.Parameters != nil {
+		in, out := &in.Parameters, &out.Parameters
+		*out = make(map[string]string, len(*in))
+		for key, val := range *in {
+			(*out)[key] = val
+		}
+	}
+	return
+}
+
+// DeepCopy is an autogenerated deepcopy function, copying the receiver, creating a new VolumeGroupSnapshotClass.
+func (in *VolumeGroupSnapshotClass) DeepCopy() *VolumeGroupSnapshotClass {
+	if in == nil {
+		return nil
+	}
+	out := new(VolumeGroupSnapshotClass)
+	in.DeepCopyInto(out)
+	return out
+}
+
+// DeepCopyObject is an autogenerated deepcopy function, copying the receiver, creating a new runtime.Object.
+func (in *VolumeGroupSnapshotClass) DeepCopyObject() runtime.Object {
+	if c := in.DeepCopy(); c != nil {
+		return c
+	}
+	return nil
+}
+
+// DeepCopyInto is an autogenerated deepcopy function, copying the receiver, writing into out. in must be non-nil.
+func (in *VolumeGroupSnapshotClassList) DeepCopyInto(out *VolumeGroupSnapshotClassList) {
+	*out = *in
+	out.TypeMeta = in.TypeMeta
+	in.ListMeta.DeepCopyInto(&out.ListMeta)
+	if in.Items != nil {
+		in, out := &in.Items, &out.Items
+		*out = make([]VolumeGroupSnapshotClass, len(*in))
+		for i := range *in {
+			(*in)[i].DeepCopyInto(&(*out)[i])
+		}
+	}
+	return
+}
+
+// DeepCopy is an autogenerated deepcopy function, copying the receiver, creating a new VolumeGroupSnapshotClassList.
+func (in *VolumeGroupSnapshotClassList) DeepCopy() *VolumeGroupSnapshotClassList {
+	if in == nil {
+		return nil
+	}
+	out := new(VolumeGroupSnapshotClassList)
+	in.DeepCopyInto(out)
+	return out
+}
+
+// DeepCopyObject is an autogenerated deepcopy function, copying the receiver, creating a new runtime.Object.
+func (in *VolumeGroupSnapshotClassList) DeepCopyObject() runtime.Object {
+	if c := in.DeepCopy(); c != nil {
+		return c
+	}
+	return nil
+}
+
+// DeepCopyInto is an autogenerated deepcopy function, copying the receiver, writing into out. in must be non-nil.
+func (in *VolumeGroupSnapshotContent) DeepCopyInto(out *VolumeGroupSnapshotContent) {
+	*out = *in
+	out.TypeMeta = in.TypeMeta
+	in.ObjectMeta.DeepCopyInto(&out.Obj
```

**File**: `vendor/github.com/kubernetes-csi/external-snapshotter/client/v8/apis/volumegroupsnapshot/v1beta1/types.go` (modified, +3/-0)
```diff
@@ -119,6 +119,7 @@ type VolumeGroupSnapshotStatus struct {
 // +kubebuilder:object:root=true
 // +kubebuilder:resource:scope=Namespaced,shortName=vgs
 // +kubebuilder:subresource:status
+// +kubebuilder:deprecatedversion
 // +kubebuilder:printcolumn:name="ReadyToUse",type=boolean,JSONPath=`.status.readyToUse`,description="Indicates if all the individual snapshots in the group are ready to be used to restore a group of volumes."
 // +kubebuilder:printcolumn:name="VolumeGroupSnapshotClass",type=string,JSONPath=`.spec.volumeGroupSnapshotClassName`,description="The name of the VolumeGroupSnapshotClass requested by the VolumeGroupSnapshot."
 // +kubebuilder:printcolumn:name="VolumeGroupSnapshotContent",type=string,JSONPath=`.status.boundVolumeGroupSnapshotContentName`,description="Name of the VolumeGroupSnapshotContent object to which the VolumeGroupSnapshot object intends to bind to. Please note that verification of binding actually requires checking both VolumeGroupSnapshot and VolumeGroupSnapshotContent to ensure both are pointing at each other. Binding MUST be verified prior to usage of this object."
@@ -162,6 +163,7 @@ type VolumeGroupSnapshotList struct {
 // is used by specifying its name in a VolumeGroupSnapshot object.
 // VolumeGroupSnapshotClasses are non-namespaced.
 // +kubebuilder:object:root=true
+// +kubebuilder:deprecatedversion
 // +kubebuilder:resource:scope=Cluster,shortName=vgsclass;vgsclasses
 // +kubebuilder:printcolumn:name="Driver",type=string,JSONPath=`.driver`
 // +kubebuilder:printcolumn:name="DeletionPolicy",type=string,JSONPath=`.deletionPolicy`,description="Determines whether a VolumeGroupSnapshotContent created through the VolumeGroupSnapshotClass should be deleted when its bound VolumeGroupSnapshot is deleted."
@@ -218,6 +220,7 @@ type VolumeGroupSnapshotClassList struct {
 // in the underlying storage system
 // +kubebuilder:object:root=true
 // +kubebuilder:resource:scope=Cluster,shortName=vgsc;vgscs
+// +kubebuilder:deprecatedversion
 // +kubebuilder:subresource:status
 // +kubebuilder:printcolumn:name="ReadyToUse",type=boolean,JSONPath=`.status.readyToUse`,description="Indicates if all the individual snapshots in the group are ready to be used to restore a group of volumes."
 // +kubebuilder:printcolumn:name="DeletionPolicy",type=string,JSONPath=`.spec.deletionPolicy`,description="Determines whether this VolumeGroupSnapshotContent and its physical group snapshot on the underlying storage system should be deleted when its bound VolumeGroupSnapshot is deleted."
```

**File**: `vendor/github.com/kubernetes-csi/external-snapshotter/client/v8/apis/volumegroupsnapshot/v1beta1/zz_generated.deepcopy.go` (modified, +1/-1)
```diff
@@ -2,7 +2,7 @@
 // +build !ignore_autogenerated
 
 /*
-Copyright 2024 The Kubernetes Authors.
+Copyright 2026 The Kubernetes Authors.
 
 Licensed under the Apache License, Version 2.0 (the "License");
 you may not use this file except in compliance with the License.
```

---

### Incident Patch 6: `615844ee` (2026-09-21)
**Commit Message**: fix(etcd): make embedded etcd defragmentation timeout configurable (#2293)

* fix(etcd): make embedded etcd defragmentation timeout configurable

* fix(etcd): only blame the defrag timeout on a deadline

ctx.Err() is also set when the syncer shuts down or Stop() is called during a
snapshot restore. Telling the user to raise defragTimeout is wrong in that case,
so match context.DeadlineExceeded instead of any context error.

Co-Authored-By: Claude Opus 5 (1M context) <[REDACTED_EMAIL]>

* test(e2e): assert the default etcd defragTimeout path end to end

Nothing exercised defragTimeout on a running vCluster, so the config key could
stop reaching the syncer without any test noticing.

The default PR-gating embedded-etcd suite leaves the key unset and asserts the
syncer took an enabled branch, which pins the config-to-runtime path without a
new vCluster. The "0s" end needs the field in the OSS mirror the e2e CLI and
chart are built from, so it lands in a stacked follow-up PR.

The asserted log lines become exported constants in pkg/etcd so a rewording
breaks the build instead of leaving a test green against a string the product no
longer emits.

Co-Authored-By: Claude Opus 5 (1M contex

**File**: `chart/values.schema.json` (modified, +5/-0)
```diff
@@ -1982,6 +1982,11 @@
           "type": "integer",
           "description": "SnapshotCount defines the number of snapshots to keep for the embedded etcd. Defaults to 10000 if less than 1."
         },
+        "defragTimeout": {
+          "type": "string",
+          "description": "DefragTimeout defines how long the etcd defragmentation on startup may take, e.g. \"5m\".\nvCluster fails to start if exceeded. Set to \"0s\" to skip defragmentation entirely.",
+          "pro": true
+        },
         "extraArgs": {
           "items": {
             "type": "string"
```

**File**: `chart/values.yaml` (modified, +3/-0)
```diff
@@ -401,6 +401,9 @@ controlPlane:
         enabled: false
         # MigrateFromDeployedEtcd signals that vCluster should migrate from the deployed external etcd to embedded etcd.
         migrateFromDeployedEtcd: false
+        # DefragTimeout defines how long the etcd defragmentation on startup may take, e.g. "5m".
+        # vCluster fails to start if exceeded. Set to "0s" to skip defragmentation entirely.
+        defragTimeout: 5m
         # ExtraArgs are additional arguments to pass to the embedded etcd.
         extraArgs: []
       # External defines to use a self-hosted external etcd that is not deployed by the helm chart
```

**File**: `config/config.go` (modified, +4/-0)
```diff
@@ -2375,6 +2375,10 @@ type EtcdEmbedded struct {
 	// SnapshotCount defines the number of snapshots to keep for the embedded etcd. Defaults to 10000 if less than 1.
 	SnapshotCount int `json:"snapshotCount,omitempty"`
 
+	// DefragTimeout defines how long the etcd defragmentation on startup may take, e.g. "5m".
+	// vCluster fails to start if exceeded. Set to "0s" to skip defragmentation entirely.
+	DefragTimeout Duration `json:"defragTimeout,omitempty" product:"pro"`
+
 	// ExtraArgs are additional arguments to pass to the embedded etcd.
 	ExtraArgs []string `json:"extraArgs,omitempty"`
 }
```

**File**: `config/values.yaml` (modified, +1/-0)
```diff
@@ -183,6 +183,7 @@ controlPlane:
       embedded:
         enabled: false
         migrateFromDeployedEtcd: false
+        defragTimeout: 5m
         extraArgs: []
       external:
         enabled: false
```

---

### Incident Patch 7: `99d686f3` (2026-09-18)
**Commit Message**: chore: ignore the schema build artifact (#2469)

go build ./hack/schema drops an executable named schema at the tree root. One reached v0.37 that way; main has only ever been lucky. Same root-artifact rule as /vcluster.

Monorepo-Commit: b4750b5465cca33250bab8d01dfe1922aceb2e42

**File**: `.gitignore` (modified, +1/-0)
```diff
@@ -7,6 +7,7 @@ profile.out
 coverage.out
 *.swp
 /vcluster
+/schema
 /zzz
 /cmd/vclusterctl/__debug_bin
 /release
```

---

### Incident Patch 8: `105f5537` (2026-09-18)
**Commit Message**: fix(cli): drop kubeconfig url path when port-forwarding

portForwardServer rewrote only the host and re-serialized the parsed
url, so a path, query or user info on the kubeconfig server survived
into the port-forwarded address. Port-forwarding tunnels to the pod
API, which serves at the root, so those components point at an endpoint
that does not serve them and requests 404 until connect hits its
deadline.

Build the forwarded address from the scheme and the local host instead,
so only components that survive the rewrite are carried over.

Monorepo-Commit: 5067a595cbf31a11c0df7ed1fde572b7b76ca929

**File**: `pkg/cli/connect_helm.go` (modified, +8/-2)
```diff
@@ -469,8 +469,14 @@ func portForwardServer(server string, localPort int) (string, string, error) {
 		return "", "", err
 	}
 
-	parsed.Host = net.JoinHostPort("localhost", strconv.Itoa(localPort))
-	return parsed.String(), remotePort, nil
+	// Port-forwarding tunnels to the pod API, which serves at the root, so only
+	// the scheme carries over. Any path, query or user info from an ingress-facing
+	// server would be sent to an endpoint that does not serve it.
+	forwarded := &url.URL{
+		Scheme: parsed.Scheme,
+		Host:   net.JoinHostPort("localhost", strconv.Itoa(localPort)),
+	}
+	return forwarded.String(), remotePort, nil
 }
 
 func serverPort(parsed *url.URL) (string, error) {
```

**File**: `pkg/cli/connect_helm_test.go` (modified, +21/-0)
```diff
@@ -136,6 +136,27 @@ func TestPortForwardServer(t *testing.T) {
 			expectedServer: "https://localhost:10443",
 			expectedPort:   "9443",
 		},
+		{
+			name:           "server with path",
+			server:         "https://example.com:443/prefix",
+			localPort:      10443,
+			expectedServer: "https://localhost:10443",
+			expectedPort:   "443",
+		},
+		{
+			name:           "server with path and no explicit port",
+			server:         "https://example.com/prefix/deeper",
+			localPort:      10443,
+			expectedServer: "https://localhost:10443",
+			expectedPort:   "8443",
+		},
+		{
+			name:           "server with query and user info",
+			server:         "https://user:pw@example.com:443/prefix?foo=bar",
+			localPort:      10443,
+			expectedServer: "https://localhost:10443",
+			expectedPort:   "443",
+		},
 	}
 
 	for _, tt := range tests {
```

---

### Incident Patch 9: `05813082` (2026-09-14)
**Commit Message**: fix(syncer): skip the cache wait when apply returns no resourceVersion (#2440)

* fix(syncer): skip the cache wait when apply returns no resourceVersion

* test(e2e): cover a metrics-server control plane restart with workloads

* test(e2e): bind the metrics proxy polls to the spec context

* test(e2e): pin the metrics proxy restart workload image

* test(e2e): verify workload pod metrics after the metrics proxy restart

Monorepo-Commit: b55f89a0388948eec7daa6c6c65f03e872e3d2b7

**File**: `e2e/suite_metricsproxy_test.go` (modified, +2/-0)
```diff
@@ -38,6 +38,8 @@ func suiteMetricsProxyVCluster() {
 			})
 
 			metricsproxy.MetricsProxySpec()
+			// last, because it restarts the control plane and the suite connection does not survive that
+			metricsproxy.MetricsProxyRestartSpec()
 		},
 	)
 }
```

**File**: `e2e/test_integration/metricsproxy/test_metricsproxy.go` (modified, +47/-24)
```diff
@@ -9,6 +9,7 @@ import (
 	"github.com/loft-sh/vcluster/e2e/labels"
 	. "github.com/onsi/ginkgo/v2"
 	. "github.com/onsi/gomega"
+	gomegatypes "github.com/onsi/gomega/types"
 	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
 	"k8s.io/client-go/rest"
 	apiregistrationv1 "k8s.io/kube-aggregator/pkg/apis/apiregistration/v1"
@@ -33,39 +34,61 @@ func MetricsProxySpec() {
 			})
 
 			It("should register and expose the metrics API service as Available", func(ctx context.Context) {
-				apiRegistrationClient := apiregistrationv1clientset.NewForConfigOrDie(vClusterConfig)
-
-				Eventually(func(g Gomega) {
-					apiService, err := apiRegistrationClient.APIServices().Get(ctx, "v1beta1.metrics.k8s.io", metav1.GetOptions{})
-					g.Expect(err).To(Succeed(), "failed to get APIService v1beta1.metrics.k8s.io")
-					g.Expect(apiService.Status.Conditions).To(ContainElement(SatisfyAll(
-						HaveField("Type", apiregistrationv1.Available),
-						HaveField("Status", apiregistrationv1.ConditionTrue),
-					)), "APIService v1beta1.metrics.k8s.io not yet Available=True, conditions: %v", apiService.Status.Conditions)
-				}).WithPolling(constants.PollingInterval).WithTimeout(constants.PollingTimeoutLong).Should(Succeed())
+				waitForMetricsAPIServiceAvailable(ctx, vClusterConfig)
 			})
 
 			It("should return non-empty node metrics and pod metrics from kube-system", func(ctx context.Context) {
-				metricsClient := metricsv1beta1client.NewForConfigOrDie(vClusterConfig)
-
 				By("waiting for node metrics to be available", func() {
-					Eventually(func(g Gomega) {
-						nodeMetricsList, err := metricsClient.NodeMetricses().List(ctx, metav1.ListOptions{})
-						g.Expect(err).To(Succeed(), "failed to list node metrics")
-						g.Expect(nodeMetricsList.Items).NotTo(BeEmpty(),
-							"expected at least one node metrics entry, got %d", len(nodeMetricsList.Items))
-					}).WithPolling(constants.PollingInterval).WithTimeout(constants.PollingTimeoutLong).Should(Succeed())
+					waitForNodeMetrics(ctx, vClusterConfig)
 				})
 
 				By("waiting for pod metrics in kube-system to be available", func() {
-					Eventually(func(g Gomega) {
-						podMetricsList, err := metricsClient.PodMetricses("kube-system").List(ctx, metav1.ListOptions{})
-						g.Expect(err).To(Succeed(), "failed to list pod metrics in kube-system")
-						g.Expect(podMetricsList.Items).NotTo(BeEmpty(),
-							"expected at least one pod metrics entry in kube-system, got %d", len(podMetricsList.Items))
-					}).WithPolling(constants.PollingInterval).WithTimeout(constants.PollingTimeoutLong).Should(Succeed())
+					waitForPodMetrics(ctx, vClusterConfig, "kube-system", Not(BeEmpty()))
 				})
 			})
 		},
 	)
 }
+
+// waitForMetricsAPIServiceAvailable waits until the metrics APIService in the
+// tenant cluster reports Available=True.
+func waitForMetricsAPIServiceAvailable(ctx context.Context, vClusterConfig *rest.Config) {
+	GinkgoHelper()
+	apiRegistrationClient := apiregistrationv1clientset.NewForConfigOrDie(vClusterConfig)
+	Eventually(func(g Gomega) {
+		apiService, err := apiRegistrationClient.APIServices().Get(ctx, "v1beta1.metrics.k8s.io", metav1.GetOptions{})
+		g.Expect(err).To(Succeed(), "failed to get APIService v1beta1.metrics.k8s.io")
+		g.Expect(apiService.Status.Conditions).To(ContainElement(SatisfyAll(
+			HaveField("Type", apiregistrationv1.Available),
+			HaveField("Status", apiregistrationv1.ConditionTrue),
+		)), "APIService v1beta1.metrics.k8s.io not yet Available=True, conditions: %v", apiService.Status.Conditions)
+	}).WithContext(ctx).WithPolling(constants.PollingInterval).WithTimeout(constants.PollingTimeoutLong).Should(Succeed())
+}
+
+// waitForNodeMetrics waits until the metrics proxy serves at least one node
+// metrics entry.
+func waitForNodeMetrics(ctx context.Context, vClusterConfig *rest.Config) {
+	GinkgoHelper()
+	metricsClient := metricsv1beta1client.NewForConfigOrDie(vClusterConfig)
+	Eventually(func(g Gomega) {
+		nodeMetricsList, err := metricsClient.NodeMetricses().List(ctx, metav1.ListOptions{})
+		g.Expect(err).To(Succeed(), "failed to list node metrics")
+		g.Expect(nodeMetricsList.Items).NotTo(BeEmpty(),
+			"expected at least one node metrics entry, got %d", len(nodeMetricsList.Items))
+	}).WithContext(ctx).WithPolling(constants.PollingInterval).WithTimeout(constants.PollingTimeoutLong).Should(Succeed())
+}
+
+// waitForPodMetrics waits until the pod metrics the metrics proxy serves for a
+// tenant namespace satisfy matchItems. The proxy rewrites every host entry back
+// to its tenant pod name and drops the ones it cannot map, so the items only
+// ever carry tenant names and a pod that fails to map is simply missing.
+func waitForPodMetrics(ctx context.Context, vClusterConfig *rest.Config, namespace string, matchItems gomegatypes.GomegaMatcher) {
+	GinkgoHelper()
+	metricsClient := metricsv1beta1client.NewForConfigOrDie(vClusterConfig)
+	Eventually(func(g Gomega) {
+		podMetricsList, err := metricsClient.PodMetricses(n
```

**File**: `e2e/test_integration/metricsproxy/test_metricsproxy_restart.go` (added, +256/-0)
```diff
@@ -0,0 +1,256 @@
+package metricsproxy
+
+import (
+	"context"
+	"fmt"
+	"os"
+	"strings"
+
+	"github.com/loft-sh/e2e-framework/pkg/setup/cluster"
+	loftlog "github.com/loft-sh/log"
+	connectcmd "github.com/loft-sh/vcluster/cmd/vclusterctl/cmd"
+	"github.com/loft-sh/vcluster/e2e/constants"
+	"github.com/loft-sh/vcluster/e2e/labels"
+	"github.com/loft-sh/vcluster/pkg/cli"
+	"github.com/loft-sh/vcluster/pkg/cli/config"
+	"github.com/loft-sh/vcluster/pkg/cli/flags"
+	"github.com/loft-sh/vcluster/pkg/util/random"
+	. "github.com/onsi/ginkgo/v2"
+	. "github.com/onsi/gomega"
+	"github.com/spf13/cobra"
+	corev1 "k8s.io/api/core/v1"
+	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
+	"k8s.io/apimachinery/pkg/types"
+	"k8s.io/client-go/kubernetes"
+	"k8s.io/client-go/rest"
+	"k8s.io/client-go/tools/clientcmd"
+	clientpkg "sigs.k8s.io/controller-runtime/pkg/client"
+)
+
+// MetricsProxyRestartSpec registers the control plane restart test for the
+// metrics proxy integration. On every start the syncer re-applies the
+// deletion protection policy for the metrics APIService. Once the policy
+// exists that apply changes nothing, and the control plane used to crash-loop
+// waiting for a cache update that never came (ENGCP-1458).
+//
+// The spec deletes the control plane pod, so the suite connection is dead
+// afterwards. Register it after the other metrics proxy specs.
+func MetricsProxyRestartSpec() {
+	Describe("Metrics proxy integration after a control plane restart",
+		labels.Integration,
+		func() {
+			var (
+				vClusterName      string
+				vClusterNamespace string
+				hostKubeconfig    string
+				hostClient        kubernetes.Interface
+				vClusterClient    kubernetes.Interface
+			)
+
+			BeforeEach(func(ctx context.Context) context.Context {
+				vClusterName = cluster.CurrentClusterNameFrom(ctx)
+				vClusterNamespace = "vcluster-" + vClusterName
+				hostKubeconfig = cluster.From(ctx, constants.GetHostClusterName()).GetKubeconfig()
+				hostClient = cluster.KubeClientFrom(ctx, constants.GetHostClusterName())
+				Expect(hostClient).NotTo(BeNil())
+				vClusterClient = cluster.CurrentKubeClientFrom(ctx)
+				Expect(vClusterClient).NotTo(BeNil())
+				return ctx
+			})
+
+			It("should come back with the metrics API available after the control plane pod is deleted", func(ctx context.Context) {
+				suffix := random.String(6)
+				workloadNamespace := "metrics-restart-" + suffix
+				workloadPodName := "metrics-restart-workload-" + suffix
+
+				By("Running a workload so the control plane restarts on a non-empty tenant cluster", func() {
+					_, err := vClusterClient.CoreV1().Namespaces().Create(ctx, &corev1.Namespace{
+						ObjectMeta: metav1.ObjectMeta{Name: workloadNamespace},
+					}, metav1.CreateOptions{})
+					Expect(err).To(Succeed(), "creating namespace %s", workloadNamespace)
+					DeferCleanup(func(ctx context.Context) {
+						// vClusterClient is replaced by a fresh connection after the restart
+						err := vClusterClient.CoreV1().Namespaces().Delete(ctx, workloadNamespace, metav1.DeleteOptions{})
+						Expect(clientpkg.IgnoreNotFound(err)).To(Succeed(), "deleting namespace %s", workloadNamespace)
+					})
+
+					_, err = vClusterClient.CoreV1().Pods(workloadNamespace).Create(ctx, &corev1.Pod{
+						ObjectMeta: metav1.ObjectMeta{Name: workloadPodName},
+						Spec: corev1.PodSpec{
+							Containers: []corev1.Container{{Name: "nginx", Image: "nginx:1.25.0"}},
+						},
+					}, metav1.CreateOptions{})
+					Expect(err).To(Succeed(), "creating pod %s/%s", workloadNamespace, workloadPodName)
+
+					Eventually(func(g Gomega) {
+						pod, err := vClusterClient.CoreV1().Pods(workloadNamespace).Get(ctx, workloadPodName, metav1.GetOptions{})
+						g.Expect(err).To(Succeed(), "getting pod %s/%s", workloadNamespace, workloadPodName)
+						g.Expect(pod.Status.Phase).To(Equal(corev1.PodRunning),
+							"pod %s/%s is %s, expected Running", workloadNamespace, workloadPodName, pod.Status.Phase)
+					}).WithContext(ctx).WithPolling(constants.PollingInterval).WithTimeout(constants.PollingTimeoutLong).Should(Succeed())
+				})
+
+				var deletedPodUID types.UID
+				By("Deleting the control plane pod", func() {
+					pods, err := hostClient.CoreV1().Pods(vClusterNamespace).List(ctx, metav1.ListOptions{
+						LabelSelector: "app=vcluster,release=" + vClusterName,
+					})
+					Expect(err).To(Succeed(), "listing control plane pods in %s", vClusterNamespace)
+					Expect(pods.Items).To(HaveLen(1), "expected exactly one control plane pod in %s, got %d", vClusterNamespace, len(pods.Items))
+
+					deletedPodUID = pods.Items[0].UID
+					err = hostClient.CoreV1().Pods(vClusterNamespace).Delete(ctx, pods.Items[0].Name, metav1.DeleteOptions{})
+					Expect(err).To(Succeed(), "deleting control plane pod %s/%s", vClusterNamespace, pods.Items[0].Name)
+				})
+
+				By("Waiting for the replacement control plane pod to become ready without restarting", func() {
+					waitForControlPlaneReplacement(ctx, ho
```

**File**: `pkg/util/blockingcacheclient/client.go` (modified, +8/-0)
```diff
@@ -190,6 +190,14 @@ func (c *CacheClient) blockApply(ctx context.Context, obj runtime.ApplyConfigura
 		return err
 	}
 
+	// controller-runtime before v0.24 never decodes the apply response into a
+	// typed ApplyConfiguration, see kubernetes-sigs/controller-runtime#3475, so
+	// the applied object carries no resource version. Then there is nothing to
+	// wait for, and polling would only ever run into the timeout.
+	if applied.GetResourceVersion() == "" {
+		return nil
+	}
+
 	return c.poll(ctx, applied, func(newObj client.Object, appliedAccessor metav1.Object) (bool, error) {
 		err := c.Client.Get(ctx, types.NamespacedName{Namespace: appliedAccessor.GetNamespace(), Name: appliedAccessor.GetName()}, newObj)
 		if err != nil {
```

**File**: `pkg/util/blockingcacheclient/client_test.go` (modified, +36/-0)
```diff
@@ -31,6 +31,9 @@ type applyServer struct {
 	response *unstructured.Unstructured
 	// getErr, when set, is what every Get returns instead of consulting cached.
 	getErr error
+	// responseNotWrittenBack makes Apply leave the ApplyConfiguration untouched,
+	// the way controller-runtime before v0.24 handled typed ApplyConfigurations.
+	responseNotWrittenBack bool
 }
 
 func (s *applyServer) Get(_ context.Context, key client.ObjectKey, obj client.Object, _ ...client.GetOption) error {
@@ -51,6 +54,10 @@ func (s *applyServer) Apply(_ context.Context, obj runtime.ApplyConfiguration, _
 	s.mu.Lock()
 	defer s.mu.Unlock()
 
+	if s.responseNotWrittenBack {
+		return nil
+	}
+
 	body, err := json.Marshal(s.response.Object)
 	if err != nil {
 		return err
@@ -135,6 +142,35 @@ func TestStatusApplyNoOpReturnsWithoutWaitingForACacheChange(t *testing.T) {
 	}
 }
 
+func TestApplySkipsTheCacheWaitWhenTheResponseIsNotWrittenBack(t *testing.T) {
+	// controller-runtime before v0.24 leaves a typed ApplyConfiguration
+	// untouched, so the applied object has no resource version to wait for.
+	// The cache is behind here, yet waiting could only run into the timeout.
+	server := &applyServer{cached: policyObject("uid-1", "10"), responseNotWrittenBack: true}
+	c := &CacheClient{Client: server}
+
+	start := time.Now()
+	if err := c.Apply(context.Background(), policyApplyConfiguration(), client.FieldOwner("test")); err != nil {
+		t.Fatalf("apply returned %v, expected nil", err)
+	}
+	if elapsed := time.Since(start); elapsed > time.Second {
+		t.Fatalf("apply blocked for %s although the response was not written back", elapsed)
+	}
+}
+
+func TestStatusApplySkipsTheCacheWaitWhenTheResponseIsNotWrittenBack(t *testing.T) {
+	server := &applyServer{cached: policyObject("uid-1", "10"), responseNotWrittenBack: true}
+	c := &CacheClient{Client: server}
+
+	start := time.Now()
+	if err := c.Status().Apply(context.Background(), policyApplyConfiguration(), client.FieldOwner("test")); err != nil {
+		t.Fatalf("status apply returned %v, expected nil", err)
+	}
+	if elapsed := time.Since(start); elapsed > time.Second {
+		t.Fatalf("status apply blocked for %s although the response was not written back", elapsed)
+	}
+}
+
 func TestApplyWaitsUntilCacheReachesReturnedResourceVersion(t *testing.T) {
 	server := &applyServer{cached: policyObject("uid-1", "10"), response: policyObject("uid-1", "11")}
 	c := &CacheClient{Client: server}
```

---

### Incident Patch 10: `33a99045` (2026-09-09)
**Commit Message**: fix(syncer): make no-op apply return instead of timing out the cache wait (#2432)

* fix(syncer): make no-op apply return instead of timing out the cache wait

* test(syncer): drop the unused scheme from the blocking cache client tests

* test(syncer): cover the poll error branches of the blocking apply wait

* fix(syncer): let resource versions settle a delete and recreate in the apply wait

* fix(syncer): match opaque resource versions exactly in the apply wait

Monorepo-Commit: 4cdd829a6bb86362bacfea4c413369eb245a7d2a

**File**: `pkg/util/blockingcacheclient/client.go` (modified, +28/-78)
```diff
@@ -3,6 +3,7 @@ package blockingcacheclient
 import (
 	"context"
 	"fmt"
+	"strconv"
 	"time"
 
 	"github.com/loft-sh/vcluster/pkg/util"
@@ -175,94 +176,57 @@ func (c *CacheClient) Delete(ctx context.Context, obj client.Object, opts ...cli
 }
 
 func (c *CacheClient) Apply(ctx context.Context, obj runtime.ApplyConfiguration, opts ...client.ApplyOption) error {
-	clientObj, err := util.ExtractClientObjectFromApplyConfiguration(obj)
+	err := c.Client.Apply(ctx, obj, opts...)
 	if err != nil {
 		return err
 	}
 
-	var preApplyMeta metav1.Object
-	nn := types.NamespacedName{Namespace: clientObj.GetNamespace(), Name: clientObj.GetName()}
-	preApplyObj, err := c.newEmptyObjectFor(clientObj)
-	if err != nil {
-		return err
-	}
-	if getErr := c.Client.Get(ctx, nn, preApplyObj); getErr == nil {
-		preApplyMeta, _ = meta.Accessor(preApplyObj)
-	}
-
-	err = c.Client.Apply(ctx, obj, opts...)
-	if err != nil {
-		return err
-	}
-	return c.blockApply(ctx, obj, clientObj, preApplyMeta)
+	return c.blockApply(ctx, obj)
 }
 
-// newEmptyObjectFor returns an empty client.Object with the same GVK as from, for use with Get.
-func (c *CacheClient) newEmptyObjectFor(from client.Object) (client.Object, error) {
-	if u, ok := from.(*unstructured.Unstructured); ok {
-		out := &unstructured.Unstructured{}
-		out.GetObjectKind().SetGroupVersionKind(u.GetObjectKind().GroupVersionKind())
-		return out, nil
-	}
-	gvk, err := apiutil.GVKForObject(from, c.scheme)
-	if err != nil {
-		return nil, fmt.Errorf("get GVK for object: %w", err)
-	}
-	created, err := c.scheme.New(gvk)
-	if err != nil {
-		return nil, fmt.Errorf("create object for GVK %s: %w", gvk, err)
-	}
-	return created.(client.Object), nil
-}
-
-// blockApply waits until the applied object appears in the cache with the expected state.
-// clientObj must be non-nil (caller must have extracted it from the ApplyConfiguration).
-// preApplyMeta is the object's metadata from a GET before Apply; if nil (e.g. object did not exist),
-// we consider the cache updated once the object exists. Otherwise we compare until UID/Generation/ResourceVersion
-// differ so the cache has observed the Apply.
-func (c *CacheClient) blockApply(ctx context.Context, obj runtime.ApplyConfiguration, clientObj client.Object, preApplyMeta metav1.Object) error {
-	nn := types.NamespacedName{Namespace: clientObj.GetNamespace(), Name: clientObj.GetName()}
-	newObj, err := c.newEmptyObjectFor(clientObj)
+func (c *CacheClient) blockApply(ctx context.Context, obj runtime.ApplyConfiguration) error {
+	applied, err := util.ExtractClientObjectFromApplyConfiguration(obj)
 	if err != nil {
 		return err
 	}
 
-	return wait.PollUntilContextTimeout(ctx, time.Millisecond*10, time.Second*2, true, func(context.Context) (bool, error) {
-		err := c.Client.Get(ctx, nn, newObj)
+	return c.poll(ctx, applied, func(newObj client.Object, appliedAccessor metav1.Object) (bool, error) {
+		err := c.Client.Get(ctx, types.NamespacedName{Namespace: appliedAccessor.GetNamespace(), Name: appliedAccessor.GetName()}, newObj)
 		if err != nil {
 			if runtime.IsNotRegisteredError(err) {
-				// If the type is not registered in the scheme, we consider it a success
-				// to avoid blocking indefinitely.
 				return true, nil
 			} else if !kerrors.IsNotFound(err) {
-				// Return other errors (e.g. connection issues, permission errors) to stop polling.
 				return false, err
 			}
-			// If the object is not found, keep polling (return false, nil).
-			// For an Apply operation, we expect the object to exist eventually.
-			return false, nil
-		}
 
-		if preApplyMeta == nil {
-			// Object did not exist before Apply; it now exists in cache.
-			return true, nil
+			return false, nil
 		}
 
 		newAccessor, err := meta.Accessor(newObj)
 		if err != nil {
 			return false, err
 		}
-		// Cache has applied state when UID/Generation/ResourceVersion changed from pre-apply.
-		// Condition 1: UID changed - object was deleted and recreated
-		// Condition 2: Generation increased - spec was updated
-		// Condition 3: ResourceVersion changed - any update occurred (metadata, spec, or status)
-		// If any of these conditions are true, the Apply operation is reflected in the cache.
-		return preApplyMeta.GetUID() != newAccessor.GetUID() ||
-			newAccessor.GetGeneration() > preApplyMeta.GetGeneration() ||
-			newAccessor.GetResourceVersion() != preApplyMeta.GetResourceVersion(), nil
+
+		return resourceVersionReached(newAccessor.GetResourceVersion(), appliedAccessor.GetResourceVersion()), nil
 	})
 }
 
+// resourceVersionReached reports whether the cache has observed the write that
+// returned the given resource version. kube-apiserver versions are a global
+// decimal counter, so those compare numerically, which also settles a delete
+// and recreate: an older incarnation has a lower version, a replacement
+// written after the apply a higher one. Any other version is opaque, and the
+// only ordering-free evidence is the cache serving exactly that vers
```

**File**: `pkg/util/blockingcacheclient/client_test.go` (added, +297/-0)
```diff
@@ -0,0 +1,297 @@
+package blockingcacheclient
+
+import (
+	"context"
+	"encoding/json"
+	"errors"
+	"sync"
+	"testing"
+	"time"
+
+	admissionregistrationv1 "k8s.io/api/admissionregistration/v1"
+	kerrors "k8s.io/apimachinery/pkg/api/errors"
+	"k8s.io/apimachinery/pkg/apis/meta/v1/unstructured"
+	"k8s.io/apimachinery/pkg/runtime"
+	"k8s.io/apimachinery/pkg/runtime/schema"
+	admissionregistrationv1ac "k8s.io/client-go/applyconfigurations/admissionregistration/v1"
+	"sigs.k8s.io/controller-runtime/pkg/client"
+)
+
+const testPolicyName = "vcluster-protected-apiservices"
+
+// applyServer stands in for the manager client underneath CacheClient. Apply
+// answers with a fixed server response the way controller-runtime does, by
+// decoding it into the ApplyConfiguration, and Get serves whatever the test
+// says the informer cache currently holds.
+type applyServer struct {
+	client.Client
+
+	mu       sync.Mutex
+	cached   *unstructured.Unstructured
+	response *unstructured.Unstructured
+	// getErr, when set, is what every Get returns instead of consulting cached.
+	getErr error
+}
+
+func (s *applyServer) Get(_ context.Context, key client.ObjectKey, obj client.Object, _ ...client.GetOption) error {
+	s.mu.Lock()
+	defer s.mu.Unlock()
+
+	if s.getErr != nil {
+		return s.getErr
+	}
+	if s.cached == nil {
+		return kerrors.NewNotFound(schema.GroupResource{Group: "admissionregistration.k8s.io", Resource: "validatingadmissionpolicies"}, key.Name)
+	}
+	obj.(*unstructured.Unstructured).Object = s.cached.DeepCopy().Object
+	return nil
+}
+
+func (s *applyServer) Apply(_ context.Context, obj runtime.ApplyConfiguration, _ ...client.ApplyOption) error {
+	s.mu.Lock()
+	defer s.mu.Unlock()
+
+	body, err := json.Marshal(s.response.Object)
+	if err != nil {
+		return err
+	}
+	return json.Unmarshal(body, obj)
+}
+
+func (s *applyServer) Status() client.SubResourceWriter {
+	return &applyStatusWriter{server: s}
+}
+
+func (s *applyServer) setCached(obj *unstructured.Unstructured) {
+	s.mu.Lock()
+	defer s.mu.Unlock()
+
+	s.cached = obj
+}
+
+type applyStatusWriter struct {
+	client.SubResourceWriter
+
+	server *applyServer
+}
+
+func (w *applyStatusWriter) Apply(ctx context.Context, obj runtime.ApplyConfiguration, _ ...client.SubResourceApplyOption) error {
+	return w.server.Apply(ctx, obj)
+}
+
+func policyObject(uid, resourceVersion string) *unstructured.Unstructured {
+	return &unstructured.Unstructured{Object: map[string]interface{}{
+		"apiVersion": "admissionregistration.k8s.io/v1",
+		"kind":       "ValidatingAdmissionPolicy",
+		"metadata": map[string]interface{}{
+			"name":            testPolicyName,
+			"uid":             uid,
+			"resourceVersion": resourceVersion,
+		},
+	}}
+}
+
+func policyApplyConfiguration() *admissionregistrationv1ac.ValidatingAdmissionPolicyApplyConfiguration {
+	return admissionregistrationv1ac.ValidatingAdmissionPolicy(testPolicyName).
+		WithSpec(admissionregistrationv1ac.ValidatingAdmissionPolicySpec().
+			WithFailurePolicy(admissionregistrationv1.Fail))
+}
+
+// catchUpAfter makes the fake cache serve obj once delay has passed, standing
+// in for the informer receiving the watch event for the write.
+func catchUpAfter(server *applyServer, delay time.Duration, obj *unstructured.Unstructured) {
+	go func() {
+		time.Sleep(delay)
+		server.setCached(obj)
+	}()
+}
+
+func TestApplyNoOpReturnsWithoutWaitingForACacheChange(t *testing.T) {
+	// an apply that changes nothing is skipped by the apiserver, which answers
+	// with the live object at its current resource version. The cache already
+	// holds that version, so there is nothing to wait for.
+	server := &applyServer{cached: policyObject("uid-1", "10"), response: policyObject("uid-1", "10")}
+	c := &CacheClient{Client: server}
+
+	start := time.Now()
+	if err := c.Apply(context.Background(), policyApplyConfiguration(), client.FieldOwner("test")); err != nil {
+		t.Fatalf("no-op apply returned %v, expected nil", err)
+	}
+	if elapsed := time.Since(start); elapsed > time.Second {
+		t.Fatalf("no-op apply blocked for %s", elapsed)
+	}
+}
+
+func TestStatusApplyNoOpReturnsWithoutWaitingForACacheChange(t *testing.T) {
+	server := &applyServer{cached: policyObject("uid-1", "10"), response: policyObject("uid-1", "10")}
+	c := &CacheClient{Client: server}
+
+	start := time.Now()
+	if err := c.Status().Apply(context.Background(), policyApplyConfiguration(), client.FieldOwner("test")); err != nil {
+		t.Fatalf("no-op status apply returned %v, expected nil", err)
+	}
+	if elapsed := time.Since(start); elapsed > time.Second {
+		t.Fatalf("no-op status apply blocked for %s", elapsed)
+	}
+}
+
+func TestApplyWaitsUntilCacheReachesReturnedResourceVersion(t *testing.T) {
+	server := &applyServer{cached: policyObject("uid-1", "10"), response: policyObject("uid-1", "11")}
+	c := &CacheClient{Client: server}
+	catchUpAfter(server, 150*time.Millisecond, policyObject("uid-1", "11"))
+
+	start := time.Now()
+	if err := c.Apply(context.Background(), po
```

---

### Incident Patch 11: `b673c35f` (2026-09-08)
**Commit Message**: fix(deps): update module google.golang.org/grpc to v1.83.1 [security] (#2404)

* fix(deps): update module google.golang.org/grpc to v1.83.1 [security]

* fix(deps): sync root vendor for grpc update

---------

Co-authored-by: renovate[bot] <29139614+renovate[bot]@users.noreply.github.com>
Co-authored-by: Caue Santos <[REDACTED_EMAIL]>
Monorepo-Commit: 8b0c71f37b0dc694aeb470866645a18d60a39fd4

**File**: `go.mod` (modified, +2/-2)
```diff
@@ -49,7 +49,7 @@ require (
 	go.uber.org/atomic v1.11.0
 	golang.org/x/mod v0.39.0
 	golang.org/x/sync v0.22.0
-	google.golang.org/grpc v1.82.1
+	google.golang.org/grpc v1.83.1
 	google.golang.org/protobuf v1.36.12
 	gopkg.in/yaml.v3 v3.0.1
 	gotest.tools v2.2.0+incompatible
@@ -78,7 +78,7 @@ require (
 )
 
 require (
-	cel.dev/expr v0.25.1 // indirect
+	cel.dev/expr v0.25.2 // indirect
 	github.com/AlecAivazis/survey/v2 v2.3.7 // indirect
 	github.com/Azure/azure-sdk-for-go/sdk/azcore v1.23.0 // indirect
 	github.com/Azure/azure-sdk-for-go/sdk/azidentity v1.14.0 // indirect
```

**File**: `go.sum` (modified, +4/-4)
```diff
@@ -1,5 +1,5 @@
-cel.dev/expr v0.25.1 h1:1KrZg61W6TWSxuNZ37Xy49ps13NUovb66QLprthtwi4=
-cel.dev/expr v0.25.1/go.mod h1:hrXvqGP6G6gyx8UAHSHJ5RGk//1Oj5nXQ2NI02Nrsg4=
+cel.dev/expr v0.25.2 h1:K6j46C81hXtZQfuX60cVWQFBJahKSE2gfRbNuvr5bFs=
+cel.dev/expr v0.25.2/go.mod h1:hrXvqGP6G6gyx8UAHSHJ5RGk//1Oj5nXQ2NI02Nrsg4=
 github.com/AlecAivazis/survey/v2 v2.3.7 h1:6I/u8FvytdGsgonrYsVn2t8t4QiRnh6QSTqkkhIiSjQ=
 github.com/AlecAivazis/survey/v2 v2.3.7/go.mod h1:xUTIdE4KCOIjsBAE1JYsUPoCqYdZ1reCfTwbto0Fduo=
 github.com/Azure/azure-sdk-for-go/sdk/azcore v1.23.0 h1:4gRPBpN1f6xt88yi4WR26m7XaD9OlWtVT6bWPdGUIok=
@@ -737,8 +737,8 @@ google.golang.org/genproto/googleapis/api v0.0.0-20260526163538-3dc84a4a5aaa h1:
 google.golang.org/genproto/googleapis/api v0.0.0-20260526163538-3dc84a4a5aaa/go.mod h1:q4lMZS6kskjT5HvCPrnnypcDPVJqT/f4nfxmkE7gryY=
 google.golang.org/genproto/googleapis/rpc v0.0.0-20260630182238-925bb5da69e7 h1:eM/YSd5bBFagF51o1E745Ta7RwzpW0h+z+QDNZOgmQ8=
 google.golang.org/genproto/googleapis/rpc v0.0.0-20260630182238-925bb5da69e7/go.mod h1:4Hqkh8ycfw05ld/3BWL7rJOSfebL2Q+DVDeRgYgxUU8=
-google.golang.org/grpc v1.82.1 h1:NnAxzGRA0677vCa4BUkOAnO5+FfQqVl9iUXeD0IqcGE=
-google.golang.org/grpc v1.82.1/go.mod h1:yzTZ1TB1Z3SG+LIYaI+WiE8D5+PZ3ArnrSp8zF3+/ZA=
+google.golang.org/grpc v1.83.1 h1:HIO0+BEtBP6soyqvqC8sNUjZ7bTs+0hFQuFF+RAy++Y=
+google.golang.org/grpc v1.83.1/go.mod h1:kDyl6SKsiHKt0uylY5gtn5cEjkrIOhQOGDgIc4JGwzQ=
 google.golang.org/protobuf v1.36.12 h1:pJOKDDOyeXErUroCihFAd5LQuwXBSpVnKGrj5o/fwxc=
 google.golang.org/protobuf v1.36.12/go.mod h1:HTf+CrKn2C3g5S8VImy6tdcUvCska2kB7j23XfzDpco=
 gopkg.in/check.v1 v0.0.0-20161208181325-20d25e280405/go.mod h1:Co6ibVJAznAaIkqp8huTwlJQCZ016jof/cbN4VW5Yz0=
```

**File**: `vendor/google.golang.org/grpc/clientconn.go` (modified, +4/-19)
```diff
@@ -24,12 +24,10 @@ import (
 	"fmt"
 	"math"
 	"net/url"
-	"os"
 	"slices"
 	"strings"
 	"sync"
 	"sync/atomic"
-	"syscall"
 	"time"
 
 	"google.golang.org/grpc/balancer"
@@ -1573,26 +1571,13 @@ func (ac *addrConn) createTransport(ctx context.Context, addr resolver.Address,
 // to the provided transport.GoAwayInfo, as specified by gRFC A94:
 // https://github.com/grpc/proposal/blob/master/A94-grpc-subchannel-disconnections-metrics.md
 func disconnectErrorString(info transport.GoAwayInfo) string {
-	err := info.Err
-	var sysErr syscall.Errno
-	switch {
-	case info.Reason != transport.GoAwayInvalid:
+	if info.Reason != transport.GoAwayInvalid {
 		return fmt.Sprintf("GOAWAY %s", info.GoAwayCode.String())
-	case err == nil:
-		return "unknown"
-	case errors.Is(err, context.Canceled):
-		return "subchannel shutdown"
-	case errors.Is(err, syscall.ECONNRESET):
-		return "connection reset"
-	case errors.Is(err, syscall.ETIMEDOUT), errors.Is(err, context.DeadlineExceeded), errors.Is(err, os.ErrDeadlineExceeded):
-		return "connection timed out"
-	case errors.Is(err, syscall.ECONNABORTED):
-		return "connection aborted"
-	case errors.As(err, &sysErr):
-		return "socket error"
-	default:
+	}
+	if info.Err == nil {
 		return "unknown"
 	}
+	return disconnectErrorLabel(info.Err)
 }
 
 // startHealthCheck starts the health checking stream (RPC) to watch the health
```

**File**: `vendor/google.golang.org/grpc/clientconn_disconnect_reason_noplan9.go` (added, +48/-0)
```diff
@@ -0,0 +1,48 @@
+//go:build !plan9
+
+/*
+ *
+ * Copyright 2026 gRPC authors.
+ *
+ * Licensed under the Apache License, Version 2.0 (the "License");
+ * you may not use this file except in compliance with the License.
+ * You may obtain a copy of the License at
+ *
+ *     http://www.apache.org/licenses/LICENSE-2.0
+ *
+ * Unless required by applicable law or agreed to in writing, software
+ * distributed under the License is distributed on an "AS IS" BASIS,
+ * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
+ * See the License for the specific language governing permissions and
+ * limitations under the License.
+ *
+ */
+
+package grpc
+
+import (
+	"context"
+	"errors"
+	"os"
+	"syscall"
+)
+
+// disconnectErrorLabel returns the grpc.disconnect_error metric label for a
+// transport error, as specified by gRFC A94.
+func disconnectErrorLabel(err error) string {
+	var sysErr syscall.Errno
+	switch {
+	case errors.Is(err, context.Canceled):
+		return "subchannel shutdown"
+	case errors.Is(err, syscall.ECONNRESET):
+		return "connection reset"
+	case errors.Is(err, syscall.ETIMEDOUT), errors.Is(err, context.DeadlineExceeded), errors.Is(err, os.ErrDeadlineExceeded):
+		return "connection timed out"
+	case errors.Is(err, syscall.ECONNABORTED):
+		return "connection aborted"
+	case errors.As(err, &sysErr):
+		return "socket error"
+	default:
+		return "unknown"
+	}
+}
```

**File**: `vendor/google.golang.org/grpc/clientconn_disconnect_reason_plan9.go` (added, +39/-0)
```diff
@@ -0,0 +1,39 @@
+/*
+ *
+ * Copyright 2026 gRPC authors.
+ *
+ * Licensed under the Apache License, Version 2.0 (the "License");
+ * you may not use this file except in compliance with the License.
+ * You may obtain a copy of the License at
+ *
+ *     http://www.apache.org/licenses/LICENSE-2.0
+ *
+ * Unless required by applicable law or agreed to in writing, software
+ * distributed under the License is distributed on an "AS IS" BASIS,
+ * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
+ * See the License for the specific language governing permissions and
+ * limitations under the License.
+ *
+ */
+
+package grpc
+
+import (
+	"context"
+	"errors"
+	"os"
+)
+
+// disconnectErrorLabel returns the grpc.disconnect_error metric label for a
+// transport error, as specified by gRFC A94. syscall.Errno does not exist on
+// plan9, so only the portable classifications are available.
+func disconnectErrorLabel(err error) string {
+	switch {
+	case errors.Is(err, context.Canceled):
+		return "subchannel shutdown"
+	case errors.Is(err, context.DeadlineExceeded), errors.Is(err, os.ErrDeadlineExceeded):
+		return "connection timed out"
+	default:
+		return "unknown"
+	}
+}
```

**File**: `vendor/google.golang.org/grpc/internal/envconfig/envconfig.go` (modified, +11/-1)
```diff
@@ -150,8 +150,18 @@ var (
 	// throttling limit if unforeseen issues arise, and it will be removed in a
 	// future release.
 	//
-	// TODO: Remove this env var once v1.83.0 is release.
+	// TODO: Remove this env var once v1.83.0 is released.
 	ControlBufferThrottleLimit = uint64FromEnv("GRPC_GO_EXPERIMENTAL_CONTROL_BUFFER_THROTTLE_LIMIT", 100, 1, 10000)
+
+	// EnableReceiveBufferCompaction enables the compaction of data buffers
+	// to reduce the number of buffers in the receive buffer.
+	//
+	// This environment variable serves as an escape hatch to disable the
+	// feature if unforeseen issues arise, and it will be removed in a future
+	// release.
+	//
+	// TODO: Remove this env var once v1.85.0 is released.
+	EnableReceiveBufferCompaction = boolFromEnv("GRPC_GO_EXPERIMENTAL_ENABLE_RECEIVE_BUFFER_COMPACTION", true)
 )
 
 func boolFromEnv(envVar string, def bool) bool {
```

**File**: `vendor/google.golang.org/grpc/internal/envconfig/xds.go` (modified, +3/-4)
```diff
@@ -69,9 +69,8 @@ var (
 	// https://github.com/grpc/proposal/blob/master/A87-mtls-spiffe-support.md
 	XDSSPIFFEEnabled = boolFromEnv("GRPC_EXPERIMENTAL_XDS_MTLS_SPIFFE", false)
 
-	// XDSHTTPConnectEnabled is true if gRPC should parse custom Metadata
-	// configuring use of an HTTP CONNECT proxy via xDS from cluster resources.
-	// For more details, see:
+	// XDSHTTPConnectEnabled controls support for dynamic HTTP CONNECT proxying
+	// configured via the xDS control plane. For more details, see:
 	// https://github.com/grpc/proposal/blob/master/A86-xds-http-connect.md
 	XDSHTTPConnectEnabled = boolFromEnv("GRPC_EXPERIMENTAL_XDS_HTTP_CONNECT", false)
 
@@ -88,7 +87,7 @@ var (
 	// XDSORCAToLRSPropEnabled controls whether ORCA metrics are explicitly
 	// filtered and prefix-propagated to the LRS server. For more details, see:
 	// https://github.com/grpc/proposal/blob/master/A85-lrs-custom-metrics-changes.md
-	XDSORCAToLRSPropEnabled = boolFromEnv("GRPC_EXPERIMENTAL_XDS_ORCA_LRS_PROPAGATION", false)
+	XDSORCAToLRSPropEnabled = boolFromEnv("GRPC_EXPERIMENTAL_XDS_ORCA_LRS_PROPAGATION", true)
 
 	// XDSClientExtProcEnabled indicates whether ExtProc filter is enabled on
 	// the client side. For more details, see:
```

**File**: `vendor/google.golang.org/grpc/internal/grpcsync/callback_serializer.go` (modified, +26/-0)
```diff
@@ -20,10 +20,15 @@ package grpcsync
 
 import (
 	"context"
+	"errors"
 
 	"google.golang.org/grpc/internal/buffer"
 )
 
+// ErrSerializerClosed is returned by ScheduleAndWait if the CallbackSerializer
+// was closed before the callback could be scheduled.
+var ErrSerializerClosed = errors.New("callback serializer is closed")
+
 // CallbackSerializer provides a mechanism to schedule callbacks in a
 // synchronized manner. It provides a FIFO guarantee on the order of execution
 // of scheduled callbacks. New callbacks can be scheduled by invoking the
@@ -77,6 +82,27 @@ func (cs *CallbackSerializer) ScheduleOr(f func(ctx context.Context), onFailure
 	}
 }
 
+// ScheduleAndWait schedules the provided callback function f to be executed in
+// the order it was added and blocks until f has run. If the context passed to
+// NewCallbackSerializer was canceled before this method is called, f is not run
+// and ScheduleAndWait returns ErrSerializerClosed.
+//
+// Callbacks are expected to honor the context when performing any blocking
+// operations, and should return early when the context is canceled.
+func (cs *CallbackSerializer) ScheduleAndWait(f func(ctx context.Context)) error {
+	done := make(chan struct{})
+	var err error
+	cs.ScheduleOr(func(ctx context.Context) {
+		f(ctx)
+		close(done)
+	}, func() {
+		err = ErrSerializerClosed
+		close(done)
+	})
+	<-done
+	return err
+}
+
 func (cs *CallbackSerializer) run(ctx context.Context) {
 	defer close(cs.done)
 
```

---

### Incident Patch 12: `9504cfd6` (2026-09-08)
**Commit Message**: fix(deps): update golang.org/x/exp digest to e88cd73 (#2405)

* fix(deps): update golang.org/x/exp digest to e88cd73

* fix(deps): sync root vendor for x/exp update

---------

Co-authored-by: renovate[bot] <29139614+renovate[bot]@users.noreply.github.com>
Co-authored-by: Caue Santos <[REDACTED_EMAIL]>
Monorepo-Commit: 946305f8e5a71d23bdbdb5dbbdbed41a44cf4b42

**File**: `go.mod` (modified, +6/-6)
```diff
@@ -47,7 +47,7 @@ require (
 	go.etcd.io/etcd/pkg/v3 v3.6.8
 	go.etcd.io/etcd/server/v3 v3.6.8
 	go.uber.org/atomic v1.11.0
-	golang.org/x/mod v0.37.0
+	golang.org/x/mod v0.39.0
 	golang.org/x/sync v0.22.0
 	google.golang.org/grpc v1.82.1
 	google.golang.org/protobuf v1.36.12
@@ -283,15 +283,15 @@ require (
 	go.opentelemetry.io/proto/otlp v1.10.0 // indirect
 	go.uber.org/multierr v1.11.0 // indirect
 	go.uber.org/zap v1.27.1
-	golang.org/x/crypto v0.54.0 // indirect
-	golang.org/x/exp v0.0.0-20251219203646-944ab1f22d93
-	golang.org/x/net v0.57.0 // indirect
+	golang.org/x/crypto v0.55.0 // indirect
+	golang.org/x/exp v0.0.0-20260824195058-e88cd73687aa
+	golang.org/x/net v0.58.0 // indirect
 	golang.org/x/oauth2 v0.36.0
 	golang.org/x/sys v0.47.0 // indirect
 	golang.org/x/term v0.45.0 // indirect
-	golang.org/x/text v0.40.0 // indirect
+	golang.org/x/text v0.41.0 // indirect
 	golang.org/x/time v0.15.0 // indirect
-	golang.org/x/tools v0.47.0 // indirect
+	golang.org/x/tools v0.49.0 // indirect
 	gomodules.xyz/jsonpatch/v2 v2.4.0 // indirect
 	gopkg.in/inf.v0 v0.9.1 // indirect
 	gopkg.in/natefinch/lumberjack.v2 v2.2.1 // indirect
```

**File**: `go.sum` (modified, +12/-12)
```diff
@@ -605,19 +605,19 @@ golang.org/x/crypto v0.13.0/go.mod h1:y6Z2r+Rw4iayiXXAIxJIDAJ1zMW4yaTpebo8fPOliY
 golang.org/x/crypto v0.19.0/go.mod h1:Iy9bg/ha4yyC70EfRS8jz+B6ybOBKMaSxLj6P6oBDfU=
 golang.org/x/crypto v0.23.0/go.mod h1:CKFgDieR+mRhux2Lsu27y0fO304Db0wZe70UKqHu0v8=
 golang.org/x/crypto v0.30.0/go.mod h1:kDsLvtWBEx7MV9tJOj9bnXsPbxwJQ6csT/x4KIN4Ssk=
-golang.org/x/crypto v0.54.0 h1:YLIA59K4fiNzHzjnZt2tUJQjQtUWfWbeHBqKtk3eScw=
-golang.org/x/crypto v0.54.0/go.mod h1:KWL8ny2AZdGR2cWmzeHrp2azQPGogOv+HeQaVEXC2dk=
-golang.org/x/exp v0.0.0-20251219203646-944ab1f22d93 h1:fQsdNF2N+/YewlRZiricy4P1iimyPKZ/xwniHj8Q2a0=
-golang.org/x/exp v0.0.0-20251219203646-944ab1f22d93/go.mod h1:EPRbTFwzwjXj9NpYyyrvenVh9Y+GFeEvMNh7Xuz7xgU=
+golang.org/x/crypto v0.55.0 h1:+KWHjbgOaAQ66dh/YlkZKHlz9ZUlq61AFirAR9ntP8M=
+golang.org/x/crypto v0.55.0/go.mod h1:uq0V9dE/fzQuJtbnL+2EhWOE63vo164FY8xqEnV9xis=
+golang.org/x/exp v0.0.0-20260824195058-e88cd73687aa h1:QSyA8ishJCyT21kER9KwNt0b7BM3iRK4x9QXhjN5Fdk=
+golang.org/x/exp v0.0.0-20260824195058-e88cd73687aa/go.mod h1:zeBbvyFKDaLwa7CH/zI8KXt7gTl14SF7sO08Pl5jBCM=
 golang.org/x/mod v0.2.0/go.mod h1:s0Qsj1ACt9ePp/hMypM3fl4fZqREWJwdYDEqhRiZZUA=
 golang.org/x/mod v0.3.0/go.mod h1:s0Qsj1ACt9ePp/hMypM3fl4fZqREWJwdYDEqhRiZZUA=
 golang.org/x/mod v0.6.0-dev.0.20220419223038-86c51ed26bb4/go.mod h1:jJ57K6gSWd91VN4djpZkiMVwK6gcyfeH4XE8wZrZaV4=
 golang.org/x/mod v0.8.0/go.mod h1:iBbtSCu2XBx23ZKBPSOrRkjjQPZFPuis4dIYUhu/chs=
 golang.org/x/mod v0.12.0/go.mod h1:iBbtSCu2XBx23ZKBPSOrRkjjQPZFPuis4dIYUhu/chs=
 golang.org/x/mod v0.15.0/go.mod h1:hTbmBsO62+eylJbnUtE2MGJUyE7QWk4xUqPFrRgJ+7c=
 golang.org/x/mod v0.17.0/go.mod h1:hTbmBsO62+eylJbnUtE2MGJUyE7QWk4xUqPFrRgJ+7c=
-golang.org/x/mod v0.37.0 h1:vF1DjpVEshcIqoEaauuHebaLk1O1forxjxBaVn884JQ=
-golang.org/x/mod v0.37.0/go.mod h1:m8S8VeM9r4dzDwjrKO0a1sZP3YjeMamRRlD+fmR2Q/0=
+golang.org/x/mod v0.39.0 h1:UF5zwQdCRRUpHfyPwr7d4UrGiVeldIsogtzWVnczL74=
+golang.org/x/mod v0.39.0/go.mod h1:bvIbwjQ0HUFFf5AKukeeYQG4ZBUG9yxQbR9aEweIwYY=
 golang.org/x/net v0.0.0-20180724234803-3673e40ba225/go.mod h1:mL1N/T3taQHkDXs73rZJwtUhF3w3ftmwwsq0BUmARs4=
 golang.org/x/net v0.0.0-20180906233101-161cd47e91fd/go.mod h1:mL1N/T3taQHkDXs73rZJwtUhF3w3ftmwwsq0BUmARs4=
 golang.org/x/net v0.0.0-20190311183353-d8887717615a/go.mod h1:t9HGtf8HONx5eT2rtn7q6eTqICYqUVnKs3thJo3Qplg=
@@ -634,8 +634,8 @@ golang.org/x/net v0.10.0/go.mod h1:0qNGK6F8kojg2nk9dLZ2mShWaEBan6FAoqfSigmmuDg=
 golang.org/x/net v0.15.0/go.mod h1:idbUs1IY1+zTqbi8yxTbhexhEEk5ur9LInksu6HrEpk=
 golang.org/x/net v0.21.0/go.mod h1:bIjVDfnllIU7BJ2DNgfnXvpSvtn8VRwhlsaeUTyUS44=
 golang.org/x/net v0.25.0/go.mod h1:JkAGAh7GEvH74S6FOH42FLoXpXbE/aqXSrIQjXgsiwM=
-golang.org/x/net v0.57.0 h1:K5+3DljvIuDG9/Jv9rvyMywYNFCQ9RSUY6OOTTkT+tE=
-golang.org/x/net v0.57.0/go.mod h1:KpXc8iv+r3XplLAG/f7Jsf9RPszJzdR0f58q9vGOuEU=
+golang.org/x/net v0.58.0 h1:ynWG7rqYi4ccpTEuPZ2QGWHktVEM9DMCj9yzDE0Q7To=
+golang.org/x/net v0.58.0/go.mod h1:YwCddHnFlT7eLQqVprV19OnhLGtc5xOKgE0RyqgfWAU=
 golang.org/x/oauth2 v0.0.0-20180821212333-d2e6202438be/go.mod h1:N/0e6XlmueqKjAGxoOufVs8QHGRruUQn6yWY3a++T0U=
 golang.org/x/oauth2 v0.0.0-20181106182150-f42d05182288/go.mod h1:N/0e6XlmueqKjAGxoOufVs8QHGRruUQn6yWY3a++T0U=
 golang.org/x/oauth2 v0.36.0 h1:peZ/1z27fi9hUOFCAZaHyrpWG5lwe0RJEEEeH0ThlIs=
@@ -709,8 +709,8 @@ golang.org/x/text v0.13.0/go.mod h1:TvPlkZtksWOMsz7fbANvkp4WM8x/WCo/om8BMLbz+aE=
 golang.org/x/text v0.14.0/go.mod h1:18ZOQIKpY8NJVqYksKHtTdi31H5itFRjB5/qKTNYzSU=
 golang.org/x/text v0.15.0/go.mod h1:18ZOQIKpY8NJVqYksKHtTdi31H5itFRjB5/qKTNYzSU=
 golang.org/x/text v0.21.0/go.mod h1:4IBbMaMmOPCJ8SecivzSH54+73PCFmPWxNTLm+vZkEQ=
-golang.org/x/text v0.40.0 h1:Ub2Z6/xjgF1WrYQz2nuITOEegKFtiIy+rieRJ5lHZKs=
-golang.org/x/text v0.40.0/go.mod h1:hpnzDAfGV753zIKo+wk3u1bVKCGPbrnF7+7LBF/UHVY=
+golang.org/x/text v0.41.0 h1:vz/seA0lnX87Othu2f/0L24RcgrXD9/YFTSuGjj3rH8=
+golang.org/x/text v0.41.0/go.mod h1:jvf1O8ajNzZqhSrQBPbutR/EB83Cc0CFrezNQIwbb5M=
 golang.org/x/time v0.15.0 h1:bbrp8t3bGUeFOx08pvsMYRTCVSMk89u4tKbNOZbp88U=
 golang.org/x/time v0.15.0/go.mod h1:Y4YMaQmXwGQZoFaVFk4YpCt4FLQMYKZe9oeV/f4MSno=
 golang.org/x/tools v0.0.0-20180917221912-90fa682c2a6e/go.mod h1:n7NCudcB/nEzxVGmLbDWY5pfWTLqBcC2KZ6jyYvM4mQ=
@@ -721,8 +721,8 @@ golang.org/x/tools v0.1.12/go.mod h1:hNGJHUnrk76NpqgfD5Aqm5Crs+Hm0VOH/i9J2+nxYbc
 golang.org/x/tools v0.6.0/go.mod h1:Xwgl3UAJ/d3gWutnCtw505GrjyAbvKui8lOU390QaIU=
 golang.org/x/tools v0.13.0/go.mod h1:HvlwmtVNQAhOuCjW7xxvovg8wbNq7LwfXh/k7wXUl58=
 golang.org/x/tools v0.21.1-0.20240508182429-e35e4ccd0d2d/go.mod h1:aiJjzUbINMkxbQROHiO6hDPo2LHcIPhhQsa9DLh0yGk=
-golang.org/x/tools v0.47.0 h1:7Kn5x/d1svx/PzryTsqeoZN4TZwqeH5pGWjefhLi/1Q=
-golang.org/x/tools v0.47.0/go.mod h1:dFHnyTvFWY212G+h7ZY4Vsp/K3U4/7W9TyVaAul8uCA=
+golang.org/x/tools v0.49.0 h1:3NI7VXzL9+1WZD52Dx2ttoPwD5DWrFGpl9mFZDlmisI=
+golang.org/x/tools v0.49.0/go.mod h1:SJNXV9DBKT0UbdttsQjbfJlAE/q+y36++zo3uL3N0Oo=
 golang.org/x/xerrors v0.0.0-20190717185122-a985d3407aa7/go.mod h1:I/5z698sn9Ka8TeJc9MKroUUfqBBau
```

**File**: `vendor/golang.org/x/crypto/internal/poly1305/mac_noasm.go` (modified, +1/-1)
```diff
@@ -2,7 +2,7 @@
 // Use of this source code is governed by a BSD-style
 // license that can be found in the LICENSE file.
 
-//go:build (!amd64 && !loong64 && !ppc64le && !ppc64 && !s390x) || !gc || purego
+//go:build (!amd64 && !loong64 && !ppc64le && !ppc64 && !riscv64 && !s390x) || !gc || purego
 
 package poly1305
 
```

**File**: `vendor/golang.org/x/crypto/internal/poly1305/sum_asm.go` (modified, +1/-1)
```diff
@@ -2,7 +2,7 @@
 // Use of this source code is governed by a BSD-style
 // license that can be found in the LICENSE file.
 
-//go:build gc && !purego && (amd64 || loong64 || ppc64 || ppc64le)
+//go:build gc && !purego && (amd64 || loong64 || ppc64 || ppc64le || riscv64)
 
 package poly1305
 
```

**File**: `vendor/golang.org/x/crypto/internal/poly1305/sum_riscv64.s` (added, +158/-0)
```diff
@@ -0,0 +1,158 @@
+// Copyright 2026 The Go Authors. All rights reserved.
+// Use of this source code is governed by a BSD-style
+// license that can be found in the LICENSE file.
+
+//go:build gc && !purego
+
+#define LOAD64U(base, offset, t0, t1, t2, t3, dst) \
+	MOVBU	(offset+0*1)(base), t0; \
+	MOVBU	(offset+1*1)(base), t1; \
+	MOVBU	(offset+2*1)(base), t2; \
+	MOVBU	(offset+3*1)(base), t3; \
+	SLL	$8, t1; \
+	SLL	$16, t2; \
+	SLL	$24, t3; \
+	OR	t1, t0; \
+	OR	t3, t2; \
+	OR	t2, t0, dst; \
+	MOVBU	(offset+4*1)(base), t0; \
+	MOVBU	(offset+5*1)(base), t1; \
+	MOVBU	(offset+6*1)(base), t2; \
+	MOVBU	(offset+7*1)(base), t3; \
+	SLL	$32, t0; \
+	SLL	$40, t1; \
+	SLL	$48, t2; \
+	SLL	$56, t3; \
+	OR	t1, t0; \
+	OR	t3, t2; \
+	OR	t2, t0; \
+	OR	t0, dst
+
+// func update(state *macState, msg []byte)
+TEXT ·update(SB), $0-32
+	MOV	state+0(FP), X5
+	MOV	msg_base+8(FP), X6
+	MOV	msg_len+16(FP), X7
+
+	MOV	$16, X8
+
+	AND	$7, X6, X28
+
+	MOV	(0*8)(X5), X9		// h0
+	MOV	(1*8)(X5), X10		// h1
+	MOV	(2*8)(X5), X11		// h2
+	MOV	(3*8)(X5), X12		// r0
+	MOV	(4*8)(X5), X13		// r1
+
+	BLT	X7, X8, tail
+
+loop:
+	BEQZ	X28, aligned_load
+
+	LOAD64U(X6, 0*8, X16, X18, X19, X20, X15)	// msg[0:8]
+	LOAD64U(X6, 1*8, X16, X18, X19, X20, X17)	// msg[8:16]
+	JMP	block
+
+aligned_load:
+	MOV	(0*8)(X6), X15		// msg[0:8]
+	MOV	(1*8)(X6), X17		// msg[8:16]
+
+block:
+	ADD	X15, X9		// h0 (x1 + y1 = z1', if z1' < x1 then z1' overflow)
+	SLTU	X15, X9, X19	// h0.carry
+	ADD	X17, X10, X22
+	SLTU	X17, X22, X23
+	ADD	X22, X19, X10	// h1
+	SLTU	X22, X10, X19
+	OR	X23, X19	// h1.carry
+	ADD	$1, X19
+	ADD	X19, X11	// h2
+
+	ADD	$16, X6		// msg = msg[16:]
+
+multiply:
+	MULHU	X9, X12, X16	// h0r0.hi
+	MUL	X9, X12, X15	// h0r0.lo
+	MULHU	X10, X12, X17	// h1r0.hi
+	MUL	X10, X12, X14	// h1r0.lo
+	ADD	X14, X16
+	SLTU	X14, X16, X19
+	ADD	X19, X17
+	MUL	X11, X12, X20
+	ADD	X17, X20
+	MULHU	X9, X13, X17	// h0r1.hi
+	MUL	X9, X13, X14	// h0r1.lo
+	ADD	X14, X16
+	SLTU	X14, X16, X19
+	ADD	X19, X17
+	MOV	X17, X9
+	MUL	X11, X13, X21	// h2r1
+	MULHU	X10, X13, X17	// h1r1.hi
+	MUL	X10, X13, X14	// h1r1.lo
+	ADD	X14, X20
+	ADD	X17, X21, X22
+	SLTU	X14, X20, X19
+	ADD	X22, X19, X21
+	ADD	X9, X20
+	SLTU	X9, X20, X19
+	ADD	X19, X21
+	AND	$3, X20, X11
+	AND	$-4, X20, X18
+	ADD	X18, X15, X9
+	ADD	X21, X16, X22
+	SLTU	X18, X9, X19
+	SLTU	X21, X22, X23
+	ADD	X22, X19, X10
+	SLTU	X22, X10, X19
+	OR	X19, X23, X19
+	ADD	X19, X11
+	SLL	$62, X21, X22
+	SRL	$2, X20, X23
+	SRL	$2, X21, X21
+	OR	X22, X23, X20
+	ADD	X20, X9, X9
+	ADD	X21, X10, X22
+	SLTU	X20, X9, X19
+	SLTU	X21, X22, X23
+	ADD	X22, X19, X10
+	SLTU	X22, X10, X19
+	OR	X19, X23, X19
+	ADD	X19, X11, X11
+
+	SUB	$16, X7, X7
+	BGE	X7, X8, loop
+
+tail:
+	BEQ	X7, X0, done
+	MOV	$1, X15
+	MOV $0, X16
+	ADD	X7, X6, X6
+
+flush_buffer:
+	MOVBU	-1(X6), X20
+	SRL	$56, X15, X19
+	SLL	$8, X16, X23
+	SLL	$8, X15, X15
+	OR	X19, X23, X16
+	XOR	X20, X15
+	SUB	$1, X7, X7
+	SUB	$1, X6, X6
+	BNE	X7, X0, flush_buffer
+
+	ADD	X15, X9
+	SLTU	X15, X9, X19
+	ADD	X16, X10, X22
+	SLTU	X16, X22, X23
+	ADD	X22, X19, X10
+	SLTU	X22, X10, X19
+	OR	X23, X19
+	ADD	X19, X11
+
+	MOV	$16, X7
+	JMP	multiply
+
+done:
+	MOV	X9, (0*8)(X5)	// h0
+	MOV	X10, (1*8)(X5)
+	MOV	X11, (2*8)(X5)
+	RET
```

**File**: `vendor/golang.org/x/net/http2/hpack/encode.go` (modified, +0/-1)
```diff
@@ -39,7 +39,6 @@ func NewEncoder(w io.Writer) *Encoder {
 		tableSizeUpdate: false,
 		w:               w,
 	}
-	e.dynTab.table.init()
 	e.dynTab.setMaxSize(initialHeaderTableSize)
 	return e
 }
```

**File**: `vendor/golang.org/x/net/http2/hpack/hpack.go` (modified, +0/-1)
```diff
@@ -105,7 +105,6 @@ func NewDecoder(maxDynamicTableSize uint32, emitFunc func(f HeaderField)) *Decod
 		emitEnabled: true,
 		firstField:  true,
 	}
-	d.dynTab.table.init()
 	d.dynTab.allowedMaxSize = maxDynamicTableSize
 	d.dynTab.setMaxSize(maxDynamicTableSize)
 	return d
```

**File**: `vendor/golang.org/x/net/http2/hpack/tables.go` (modified, +37/-14)
```diff
@@ -31,20 +31,36 @@ type headerFieldTable struct {
 
 	// byName maps a HeaderField name to the unique id of the newest entry with
 	// the same name. See above for a definition of "unique id".
+	//
+	// byName and byNameValue are used only by search, which is only called
+	// for tables used by encoders. For tables used only by decoders, the
+	// maps are never built, as a memory optimization for servers with many
+	// mostly-idle connections, each pinning a dynamic table. The maps are
+	// built lazily by the first search call and are nil until then. The two
+	// maps are always both nil or both non-nil.
 	byName map[string]uint64
 
 	// byNameValue maps a HeaderField name/value pair to the unique id of the newest
 	// entry with the same name and value. See above for a definition of "unique id".
+	// See byName for when this map is non-nil.
 	byNameValue map[pairNameValue]uint64
 }
 
 type pairNameValue struct {
 	name, value string
 }
 
-func (t *headerFieldTable) init() {
-	t.byName = make(map[string]uint64)
-	t.byNameValue = make(map[pairNameValue]uint64)
+// buildMaps initializes byName and byNameValue from ents.
+func (t *headerFieldTable) buildMaps() {
+	t.byName = make(map[string]uint64, len(t.ents))
+	t.byNameValue = make(map[pairNameValue]uint64, len(t.ents))
+	for k, f := range t.ents {
+		// Map to the newest matching entry: later (newer) entries
+		// overwrite earlier ones, matching addEntry's behavior.
+		id := t.evictCount + uint64(k) + 1
+		t.byName[f.Name] = id
+		t.byNameValue[pairNameValue{f.Name, f.Value}] = id
+	}
 }
 
 // len reports the number of entries in the table.
@@ -54,9 +70,11 @@ func (t *headerFieldTable) len() int {
 
 // addEntry adds a new entry.
 func (t *headerFieldTable) addEntry(f HeaderField) {
-	id := uint64(t.len()) + t.evictCount + 1
-	t.byName[f.Name] = id
-	t.byNameValue[pairNameValue{f.Name, f.Value}] = id
+	if t.byName != nil {
+		id := uint64(t.len()) + t.evictCount + 1
+		t.byName[f.Name] = id
+		t.byNameValue[pairNameValue{f.Name, f.Value}] = id
+	}
 	t.ents = append(t.ents, f)
 }
 
@@ -65,14 +83,16 @@ func (t *headerFieldTable) evictOldest(n int) {
 	if n > t.len() {
 		panic(fmt.Sprintf("evictOldest(%v) on table with %v entries", n, t.len()))
 	}
-	for k := 0; k < n; k++ {
-		f := t.ents[k]
-		id := t.evictCount + uint64(k) + 1
-		if t.byName[f.Name] == id {
-			delete(t.byName, f.Name)
-		}
-		if p := (pairNameValue{f.Name, f.Value}); t.byNameValue[p] == id {
-			delete(t.byNameValue, p)
+	if t.byName != nil {
+		for k := 0; k < n; k++ {
+			f := t.ents[k]
+			id := t.evictCount + uint64(k) + 1
+			if t.byName[f.Name] == id {
+				delete(t.byName, f.Name)
+			}
+			if p := (pairNameValue{f.Name, f.Value}); t.byNameValue[p] == id {
+				delete(t.byNameValue, p)
+			}
 		}
 	}
 	copy(t.ents, t.ents[n:])
@@ -100,6 +120,9 @@ func (t *headerFieldTable) evictOldest(n int) {
 //
 // See Section 2.3.3.
 func (t *headerFieldTable) search(f HeaderField) (i uint64, nameValueMatch bool) {
+	if t.byName == nil {
+		t.buildMaps()
+	}
 	if !f.Sensitive {
 		if id := t.byNameValue[pairNameValue{f.Name, f.Value}]; id != 0 {
 			return t.idToIndex(id), true
```

---

### Incident Patch 13: `bb48ef88` (2026-09-08)
**Commit Message**: fix(deps): update module github.com/docker/cli to v29.8.0+incompatible (#2409)

* fix(deps): update module github.com/docker/cli to v29.8.0+incompatible

* fix(deps): sync docker cli vendor state

---------

Co-authored-by: renovate[bot] <29139614+renovate[bot]@users.noreply.github.com>
Co-authored-by: Caue Santos <[REDACTED_EMAIL]>
Monorepo-Commit: 0b86e0b737929e224aa6ebdc8cecf1764dec995e

**File**: `go.mod` (modified, +1/-1)
```diff
@@ -6,7 +6,7 @@ require (
 	github.com/blang/semver v3.5.1+incompatible
 	github.com/blang/semver/v4 v4.0.0
 	github.com/denisbrodbeck/machineid v1.0.1
-	github.com/docker/cli v29.2.0+incompatible
+	github.com/docker/cli v29.8.0+incompatible
 	github.com/docker/docker v28.5.2+incompatible
 	github.com/evanphx/json-patch/v5 v5.9.11
 	github.com/ghodss/yaml v1.0.0
```

**File**: `go.sum` (modified, +2/-2)
```diff
@@ -139,8 +139,8 @@ github.com/denisbrodbeck/machineid v1.0.1 h1:geKr9qtkB876mXguW2X6TU4ZynleN6ezuMS
 github.com/denisbrodbeck/machineid v1.0.1/go.mod h1:dJUwb7PTidGDeYyUBmXZ2GphQBbjJCrnectwCyxcUSI=
 github.com/distribution/reference v0.6.0 h1:0IXCQ5g4/QMHHkarYzh5l+u8T3t73zM5QvfrDyIgxBk=
 github.com/distribution/reference v0.6.0/go.mod h1:BbU0aIcezP1/5jX/8MP0YiH4SdvB5Y4f/wlDRiLyi3E=
-github.com/docker/cli v29.2.0+incompatible h1:9oBd9+YM7rxjZLfyMGxjraKBKE4/nVyvVfN4qNl9XRM=
-github.com/docker/cli v29.2.0+incompatible/go.mod h1:JLrzqnKDaYBop7H2jaqPtU4hHvMKP+vjCwu2uszcLI8=
+github.com/docker/cli v29.8.0+incompatible h1:ih0c2jq/nN7QfES8zIfwSzIhRScjs4ehER+kZ60aeSk=
+github.com/docker/cli v29.8.0+incompatible/go.mod h1:JLrzqnKDaYBop7H2jaqPtU4hHvMKP+vjCwu2uszcLI8=
 github.com/docker/distribution v2.8.3+incompatible h1:AtKxIZ36LoNK51+Z6RpzLpddBirtxJnzDrHLEKxTAYk=
 github.com/docker/distribution v2.8.3+incompatible/go.mod h1:J2gT2udsDAN96Uj4KfcMRqY0/ypR+oyYUYmja8H+y+w=
 github.com/docker/docker v28.5.2+incompatible h1:DBX0Y0zAjZbSrm1uzOkdr1onVghKaftjlSWt4AFexzM=
```

**File**: `vendor/github.com/docker/cli/AUTHORS` (modified, +29/-0)
```diff
@@ -2,6 +2,7 @@
 # This file lists all contributors to the repository.
 # See scripts/docs/generate-authors.sh to make modifications.
 
+4RH1T3CT0R7 <iprintercanon@gmail.com>
 A. Lester Buck III <github-reg@nbolt.com>
 Aanand Prasad <aanand.prasad@gmail.com>
 Aaron L. Xu <liker.xu@foxmail.com>
@@ -42,6 +43,8 @@ Alexander Larsson <alexl@redhat.com>
 Alexander Morozov <lk4d4math@gmail.com>
 Alexander Ryabov <i@sepa.spb.ru>
 Alexandre González <agonzalezro@gmail.com>
+Alexandre Levavasseur <alexandre+oss@13x.fr>
+Alexandre Vallières-Lagacé <alexandre.valliereslagace@docker.com>
 Alexey Igrychev <alexey.igrychev@flant.com>
 Alexis Couvreur <alexiscouvreur.pro@gmail.com>
 Alfred Landrum <alfred.landrum@docker.com>
@@ -64,6 +67,7 @@ Andres G. Aragoneses <knocte@gmail.com>
 Andres Leon Rangel <aleon1220@gmail.com>
 Andrew France <andrew@avito.co.uk>
 Andrew He <he.andrew.mail@gmail.com>
+Andrew Hopp <andrew.hopp@me.com>
 Andrew Hsu <andrewhsu@docker.com>
 Andrew Macpherson <hopscotch23@gmail.com>
 Andrew McDonnell <bugs@andrewmcdonnell.net>
@@ -127,6 +131,7 @@ Brian Goff <cpuguy83@gmail.com>
 Brian Tracy <brian.tracy33@gmail.com>
 Brian Wieder <brian@4wieders.com>
 Bruno Sousa <bruno.sousa@docker.com>
+Bruno Verachten <gounthar@gmail.com>
 Bryan Bess <squarejaw@bsbess.com>
 Bryan Boreham <bjboreham@gmail.com>
 Bryan Murphy <bmurphy1976@gmail.com>
@@ -157,6 +162,7 @@ Chen Chuanliang <chen.chuanliang@zte.com.cn>
 Chen Hanxiao <chenhanxiao@cn.fujitsu.com>
 Chen Mingjie <chenmingjie0828@163.com>
 Chen Qiu <cheney-90@hotmail.com>
+Ching Wei Kang <164879897+WilliamK112@users.noreply.github.com>
 Chris Chinchilla <chris@chrischinchilla.com>
 Chris Couzens <ccouzens@gmail.com>
 Chris Gavin <chris@chrisgavin.me>
@@ -178,6 +184,7 @@ Christopher Svensson <stoffus@stoffus.com>
 Christy Norman <christy@linux.vnet.ibm.com>
 Chun Chen <ramichen@tencent.com>
 Clinton Kitson <clintonskitson@gmail.com>
+Codex <codex@openai.com>
 Coenraad Loubser <coenraad@wish.org.za>
 Colin Hebert <hebert.colin@gmail.com>
 Collin Guarino <collin.guarino@gmail.com>
@@ -234,13 +241,15 @@ David Sheets <dsheets@docker.com>
 David Williamson <david.williamson@docker.com>
 David Xia <dxia@spotify.com>
 David Young <yangboh@cn.ibm.com>
+Davlat Davydov <literally_user@hotmail.com>
 Deng Guangxing <dengguangxing@huawei.com>
 Denis Defreyne <denis@soundcloud.com>
 Denis Gladkikh <denis@gladkikh.email>
 Denis Ollier <larchunix@users.noreply.github.com>
 Dennis Docter <dennis@d23.nl>
 dependabot[bot] <49699333+dependabot[bot]@users.noreply.github.com>
 Derek McGowan <derek@mcg.dev>
+Derek Misler <derek.misler@docker.com>
 Des Preston <despreston@gmail.com>
 Deshi Xiao <dxiao@redhat.com>
 Dharmit Shah <shahdharmit@gmail.com>
@@ -260,6 +269,7 @@ Dominik Braun <dominik.braun@nbsp.de>
 Don Kjer <don.kjer@gmail.com>
 Dong Chen <dongluo.chen@docker.com>
 DongGeon Lee <secmatth1996@gmail.com>
+Dorin Geman <dorin.geman@docker.com>
 Doug Davis <dug@us.ibm.com>
 Drew Erny <derny@mirantis.com>
 Ed Costello <epc@epcostello.com>
@@ -471,6 +481,7 @@ Justyn Temme <justyntemme@gmail.com>
 Jyrki Puttonen <jyrkiput@gmail.com>
 Jérémie Drouet <jeremie.drouet@gmail.com>
 Jérôme Petazzoni <jerome.petazzoni@docker.com>
+Jörg Sommer <joerg@jo-so.de>
 Jörg Thalheim <joerg@higgsboson.tk>
 Kai Blin <kai@samba.org>
 Kai Qiang Wu (Kennan) <wkq5325@gmail.com>
@@ -539,10 +550,13 @@ Lovekesh Kumar <lovekesh.kumar@rtcamp.com>
 Luca Favatella <luca.favatella@erlang-solutions.com>
 Luca Marturana <lucamarturana@gmail.com>
 Lucas Chan <lucas-github@lucaschan.com>
+Ludovic Temgoua Abanda <abandaludovic500@gmail.com>
 Luis Henrique Mulinari <luis.mulinari@gmail.com>
 Luka Hartwig <mail@lukahartwig.de>
 Lukas Heeren <lukas-heeren@hotmail.com>
+Lukas Michael <lukas.23022005@gmail.com>
 Lukasz Zajaczkowski <Lukasz.Zajaczkowski@ts.fujitsu.com>
+Luo Jiyin <luojiyin@hotmail.com>
 Lydell Manganti <LydellManganti@users.noreply.github.com>
 Lénaïc Huard <lhuard@amadeus.com>
 Ma Shimiao <mashimiao.fnst@cn.fujitsu.com>
@@ -551,6 +565,7 @@ Maciej Kalisz <maciej.d.kalisz@gmail.com>
 Madhav Puri <madhav.puri@gmail.com>
 Madhu Venugopal <madhu@socketplane.io>
 Madhur Batra <madhurbatra097@gmail.com>
+Mahesh Thakur <maheshthakur9152@gmail.com>
 Malte Janduda <mail@janduda.net>
 Manjunath A Kumatagi <mkumatag@in.ibm.com>
 Mansi Nahar <mmn4185@rit.edu>
@@ -578,10 +593,12 @@ Mathieu Rollet <matletix@gmail.com>
 Matt Gucci <matt9ucci@gmail.com>
 Matt Robenolt <matt@ydekproductions.com>
 Matteo Orefice <matteo.orefice@bites4bits.software>
+Matteo Panzeri <matteo1782@gmail.com>
 Matthew Heon <mheon@redhat.com>
 Matthieu Hauglustaine <matt.hauglustaine@gmail.com>
 Matthieu MOREL <matthieu.morel35@gmail.com>
 Mauro Porras P <mauroporrasp@gmail.com>
+Max Morozov <gtmax.yo@gmail.com>
 Max Shytikov <mshytikov@gmail.com>
 Max-Julian Pogner <max-julian@pogner.at>
 Maxime Petazzoni <max@signalfuse.com>
@@ -603,8 +620,10 @@ Michael Spetsiotis <michael_spets@hotmail.com>
 Michael Steinert <mike.steinert@gmail.com>
 Michael T
```

**File**: `vendor/github.com/docker/cli/cli/config/config.go` (modified, +5/-4)
```diff
@@ -7,7 +7,6 @@ import (
 	"os/user"
 	"path/filepath"
 	"runtime"
-	"strings"
 	"sync"
 
 	"github.com/docker/cli/cli/config/configfile"
@@ -98,9 +97,11 @@ func SetDir(dir string) {
 
 // Path returns the path to a file relative to the config dir
 func Path(p ...string) (string, error) {
-	path := filepath.Join(append([]string{Dir()}, p...)...)
-	if !strings.HasPrefix(path, Dir()+string(filepath.Separator)) {
-		return "", fmt.Errorf("path %q is outside of root config directory %q", path, Dir())
+	root := Dir()
+	path := filepath.Join(append([]string{root}, p...)...)
+
+	if rel, err := filepath.Rel(root, path); err != nil || !filepath.IsLocal(rel) {
+		return "", fmt.Errorf("path %q is outside of root config directory %q", path, root)
 	}
 	return path, nil
 }
```

**File**: `vendor/github.com/docker/cli/cli/config/configfile/file.go` (modified, +86/-56)
```diff
@@ -1,3 +1,6 @@
+// FIXME(thaJeztah): remove once we are a module; the go:build directive prevents go from downgrading language version to go1.16:
+//go:build go1.26
+
 package configfile
 
 import (
@@ -6,6 +9,7 @@ import (
 	"errors"
 	"fmt"
 	"io"
+	"maps"
 	"os"
 	"path/filepath"
 	"strings"
@@ -16,6 +20,34 @@ import (
 	"github.com/sirupsen/logrus"
 )
 
+// authConfigKey is the key used to store credentials for Docker Hub. It is
+// a copy of [registry.IndexServer].
+//
+// [registry.IndexServer]: https://pkg.go.dev/github.com/docker/docker@v28.5.1+incompatible/registry#IndexServer
+const authConfigKey = "https://index.docker.io/v1/"
+
+// getAuthConfigKey returns the canonical key used to look up stored
+// registry credentials for the given registry domain.
+//
+// For the official Docker Hub registry ("docker.io"), credentials are stored
+// under the historical full index address ("https://index.docker.io/v1/").
+//
+// For all other registries, the input is domainName to already be a normalized
+// hostname (optionally including ":port") and is returned unchanged.
+//
+// This function performs key normalization only; it does not validate or parse
+// the input.
+//
+// It is similar to [registry.GetAuthConfigKey] in the daemon.
+//
+// [registry.GetAuthConfigKey]: https://pkg.go.dev/github.com/docker/docker@v28.5.1+incompatible/registry#GetAuthConfigKey
+func getAuthConfigKey(domainName string) string {
+	if domainName == "docker.io" || domainName == "index.docker.io" {
+		return authConfigKey
+	}
+	return domainName
+}
+
 // ConfigFile ~/.docker/config.json file info
 type ConfigFile struct {
 	AuthConfigs          map[string]types.AuthConfig  `json:"auths"`
@@ -92,12 +124,12 @@ func New(fn string) *ConfigFile {
 
 // LoadFromReader reads the configuration data given and sets up the auth config
 // information with given directory and populates the receiver object
-func (configFile *ConfigFile) LoadFromReader(configData io.Reader) error {
-	if err := json.NewDecoder(configData).Decode(configFile); err != nil && !errors.Is(err, io.EOF) {
+func (c *ConfigFile) LoadFromReader(configData io.Reader) error {
+	if err := json.NewDecoder(configData).Decode(c); err != nil && !errors.Is(err, io.EOF) {
 		return err
 	}
 	var err error
-	for addr, ac := range configFile.AuthConfigs {
+	for addr, ac := range c.AuthConfigs {
 		if ac.Auth != "" {
 			ac.Username, ac.Password, err = decodeAuth(ac.Auth)
 			if err != nil {
@@ -106,33 +138,33 @@ func (configFile *ConfigFile) LoadFromReader(configData io.Reader) error {
 		}
 		ac.Auth = ""
 		ac.ServerAddress = addr
-		configFile.AuthConfigs[addr] = ac
+		c.AuthConfigs[addr] = ac
 	}
 	return nil
 }
 
 // ContainsAuth returns whether there is authentication configured
 // in this file or not.
-func (configFile *ConfigFile) ContainsAuth() bool {
-	return configFile.CredentialsStore != "" ||
-		len(configFile.CredentialHelpers) > 0 ||
-		len(configFile.AuthConfigs) > 0
+func (c *ConfigFile) ContainsAuth() bool {
+	return c.CredentialsStore != "" ||
+		len(c.CredentialHelpers) > 0 ||
+		len(c.AuthConfigs) > 0
 }
 
 // GetAuthConfigs returns the mapping of repo to auth configuration
-func (configFile *ConfigFile) GetAuthConfigs() map[string]types.AuthConfig {
-	if configFile.AuthConfigs == nil {
-		configFile.AuthConfigs = make(map[string]types.AuthConfig)
+func (c *ConfigFile) GetAuthConfigs() map[string]types.AuthConfig {
+	if c.AuthConfigs == nil {
+		c.AuthConfigs = make(map[string]types.AuthConfig)
 	}
-	return configFile.AuthConfigs
+	return c.AuthConfigs
 }
 
 // SaveToWriter encodes and writes out all the authorization information to
 // the given writer
-func (configFile *ConfigFile) SaveToWriter(writer io.Writer) error {
+func (c *ConfigFile) SaveToWriter(writer io.Writer) error {
 	// Encode sensitive data into a new/temp struct
-	tmpAuthConfigs := make(map[string]types.AuthConfig, len(configFile.AuthConfigs))
-	for k, authConfig := range configFile.AuthConfigs {
+	tmpAuthConfigs := make(map[string]types.AuthConfig, len(c.AuthConfigs))
+	for k, authConfig := range c.AuthConfigs {
 		authCopy := authConfig
 		// encode and save the authstring, while blanking out the original fields
 		authCopy.Auth = encodeAuth(&authCopy)
@@ -142,18 +174,18 @@ func (configFile *ConfigFile) SaveToWriter(writer io.Writer) error {
 		tmpAuthConfigs[k] = authCopy
 	}
 
-	saveAuthConfigs := configFile.AuthConfigs
-	configFile.AuthConfigs = tmpAuthConfigs
-	defer func() { configFile.AuthConfigs = saveAuthConfigs }()
+	saveAuthConfigs := c.AuthConfigs
+	c.AuthConfigs = tmpAuthConfigs
+	defer func() { c.AuthConfigs = saveAuthConfigs }()
 
 	// User-Agent header is automatically set, and should not be stored in the configuration
-	for v := range configFile.HTTPHeaders {
+	for v := range c.HTTPHeaders {
 		if strings.EqualFold(v, "User-Agent") {
-			delete(configFile.HTTPHeaders, v)
+			delete(c.HTTPHeaders, v)
 		}
 	}
 
-	data, err := json.MarshalIndent(configFile, "", "\t")
+	da
```

**File**: `vendor/github.com/docker/cli/cli/config/credentials/default_store.go` (modified, +12/-5)
```diff
@@ -2,12 +2,19 @@ package credentials
 
 import "os/exec"
 
-// DetectDefaultStore return the default credentials store for the platform if
-// no user-defined store is passed, and the store executable is available.
-func DetectDefaultStore(store string) string {
-	if store != "" {
+// DetectDefaultStore returns the credentials store to use if no user-defined
+// custom helper is passed.
+//
+// Some platforms define a preferred helper, in which case it attempts to look
+// up the helper binary before falling back to the platform's default.
+//
+// If no user-defined helper is passed, and no helper is found, it returns an
+// empty string, which means credentials are stored unencrypted in the CLI's
+// config-file without the use of a credentials store.
+func DetectDefaultStore(customStore string) string {
+	if customStore != "" {
 		// use user-defined
-		return store
+		return customStore
 	}
 
 	platformDefault := defaultCredentialsStore()
```

**File**: `vendor/github.com/docker/cli/cli/config/credentials/file_store.go` (modified, +49/-3)
```diff
@@ -99,9 +99,14 @@ func (c *fileStore) Store(authConfig types.AuthConfig) error {
 	return nil
 }
 
-// ConvertToHostname converts a registry url which has http|https prepended
-// to just an hostname.
-// Copied from github.com/docker/docker/registry.ConvertToHostname to reduce dependencies.
+// ConvertToHostname normalizes a registry URL which has http|https prepended
+// to just its hostname. It is used to match credentials, which may be either
+// stored as hostname or as hostname including scheme (in legacy configuration
+// files).
+//
+// It's based on [registry.ConvertToHostname] from Moby daemon.
+//
+// [registry.ConvertToHostname]: https://pkg.go.dev/github.com/moby/moby/v2@v2.0.0-beta.7/daemon/pkg/registry#ConvertToHostname
 func ConvertToHostname(maybeURL string) string {
 	stripped := maybeURL
 	if strings.Contains(stripped, "://") {
@@ -112,7 +117,48 @@ func ConvertToHostname(maybeURL string) string {
 			}
 			return net.JoinHostPort(u.Hostname(), u.Port())
 		}
+
+		if hostName := hostFromURLFallback(stripped); hostName != "" {
+			return hostName
+		}
 	}
 	hostName, _, _ := strings.Cut(stripped, "/")
 	return hostName
 }
+
+// hostFromURLFallback extracts a host from scheme URLs that net/url rejects.
+// Go rejects unbracketed IPv6 literals in URL hosts since
+// https://github.com/golang/go/commit/0c28789bd7dfc55099cac86a3212dda0d6c091f6
+func hostFromURLFallback(maybeURL string) string {
+	_, rest, ok := strings.Cut(maybeURL, "://")
+	if !ok {
+		return ""
+	}
+
+	hostName, _, _ := strings.Cut(rest, "/")
+	if hostName == "" {
+		return ""
+	}
+
+	if strings.Count(hostName, ":") > 1 && !strings.HasPrefix(hostName, "[") {
+		portStart := strings.LastIndex(hostName, ":")
+		addr, port := hostName[:portStart], hostName[portStart+1:]
+		if addr != "" && isPort(port) {
+			return net.JoinHostPort(addr, port)
+		}
+	}
+
+	return hostName
+}
+
+func isPort(port string) bool {
+	if port == "" {
+		return false
+	}
+	for _, r := range port {
+		if r < '0' || r > '9' {
+			return false
+		}
+	}
+	return true
+}
```

**File**: `vendor/github.com/docker/cli/cli/config/memorystore/store.go` (modified, +1/-1)
```diff
@@ -1,5 +1,5 @@
 // FIXME(thaJeztah): remove once we are a module; the go:build directive prevents go from downgrading language version to go1.16:
-//go:build go1.24
+//go:build go1.26
 
 package memorystore
 
```

---

### Incident Patch 14: `b617ebfd` (2026-09-08)
**Commit Message**: fix(deps): update k8s-go-deps (#2242)

Rebuilt on top of main: the branch's generated vendor tree conflicted with
changes that have since landed, and rebasing a generated tree is not
meaningful. go.mod, go.sum and both vendor trees are regenerated from
current main via hack/update-vendor.sh.

sigs.k8s.io/e2e-framework is held at its current version rather than moving
to v0.7.0. That release adds GenerateKubeconfig to E2EClusterProvider, which
github.com/loft-sh/e2e-framework does not implement yet, so bumping it breaks
the build. The rest of the group is unaffected.

Co-authored-by: Caue Santos <[REDACTED_EMAIL]>
Monorepo-Commit: cf9eca0864862ae113b83f048b559c6938ac7e4b

**File**: `go.mod` (modified, +30/-28)
```diff
@@ -54,26 +54,26 @@ require (
 	gopkg.in/yaml.v3 v3.0.1
 	gotest.tools v2.2.0+incompatible
 	gotest.tools/v3 v3.5.2
-	k8s.io/api v0.36.0
-	k8s.io/apiextensions-apiserver v0.36.0
-	k8s.io/apimachinery v0.36.0
-	k8s.io/apiserver v0.36.0
-	k8s.io/cli-runtime v0.36.0
-	k8s.io/client-go v0.36.0
-	k8s.io/cluster-bootstrap v0.36.0
-	k8s.io/component-helpers v0.36.0
+	k8s.io/api v0.36.3
+	k8s.io/apiextensions-apiserver v0.36.3
+	k8s.io/apimachinery v0.36.3
+	k8s.io/apiserver v0.36.3
+	k8s.io/cli-runtime v0.36.3
+	k8s.io/client-go v0.36.3
+	k8s.io/cluster-bootstrap v0.36.3
+	k8s.io/component-helpers v0.36.3
 	k8s.io/klog/v2 v2.140.0
-	k8s.io/kube-aggregator v0.36.0
-	k8s.io/kubectl v0.36.0
-	k8s.io/kubelet v0.36.0
-	k8s.io/kubernetes v1.36.0
-	k8s.io/metrics v0.36.0
-	k8s.io/pod-security-admission v0.36.0
-	k8s.io/utils v0.0.0-20260210185600-b8788abfbbc2
+	k8s.io/kube-aggregator v0.36.3
+	k8s.io/kubectl v0.36.3
+	k8s.io/kubelet v0.36.3
+	k8s.io/kubernetes v1.36.3
+	k8s.io/metrics v0.36.3
+	k8s.io/pod-security-admission v0.36.3
+	k8s.io/utils v0.0.0-20260707023825-cf1189d6abe3
 	modernc.org/sqlite v1.29.10
-	sigs.k8s.io/controller-runtime v0.23.1-0.20260424122448-c8b4b9d61fbd
+	sigs.k8s.io/controller-runtime v0.24.1
 	sigs.k8s.io/e2e-framework v0.6.0
-	sigs.k8s.io/gateway-api v1.5.1
+	sigs.k8s.io/gateway-api v1.6.1
 	sigs.k8s.io/yaml v1.6.0
 )
 
@@ -134,10 +134,14 @@ require (
 	github.com/fxamacker/cbor/v2 v2.9.2 // indirect
 	github.com/go-jose/go-jose/v4 v4.1.4 // indirect
 	github.com/go-logr/stdr v1.2.2 // indirect
+	github.com/go-openapi/swag/cmdutils v0.26.0 // indirect
 	github.com/go-openapi/swag/conv v0.28.0 // indirect
+	github.com/go-openapi/swag/fileutils v0.26.0 // indirect
+	github.com/go-openapi/swag/jsonname v0.26.0 // indirect
 	github.com/go-openapi/swag/jsonutils v0.28.0 // indirect
 	github.com/go-openapi/swag/loading v0.28.0 // indirect
 	github.com/go-openapi/swag/mangling v0.28.0 // indirect
+	github.com/go-openapi/swag/netutils v0.26.0 // indirect
 	github.com/go-openapi/swag/pools v0.28.0 // indirect
 	github.com/go-openapi/swag/stringutils v0.27.3 // indirect
 	github.com/go-openapi/swag/typeutils v0.28.0 // indirect
@@ -146,7 +150,7 @@ require (
 	github.com/go-viper/mapstructure/v2 v2.5.0 // indirect
 	github.com/golang-jwt/jwt/v5 v5.3.1 // indirect
 	github.com/google/cel-go v0.29.0 // indirect
-	github.com/google/gnostic-models v0.7.0 // indirect
+	github.com/google/gnostic-models v0.7.1 // indirect
 	github.com/gorilla/mux v1.8.1 // indirect
 	github.com/grpc-ecosystem/go-grpc-middleware/providers/prometheus v1.1.0 // indirect
 	github.com/grpc-ecosystem/go-grpc-middleware/v2 v2.3.3 // indirect
@@ -190,17 +194,17 @@ require (
 	go.opentelemetry.io/auto/sdk v1.2.1 // indirect
 	go.opentelemetry.io/otel/exporters/otlp/otlptrace v1.44.0 // indirect
 	go.opentelemetry.io/otel/exporters/otlp/otlptrace/otlptracegrpc v1.44.0 // indirect
-	go.yaml.in/yaml/v2 v2.4.3 // indirect
+	go.yaml.in/yaml/v2 v2.4.4 // indirect
 	go.yaml.in/yaml/v3 v3.0.5 // indirect
 	go.yaml.in/yaml/v4 v4.0.0-rc.2 // indirect
 	google.golang.org/genproto/googleapis/api v0.0.0-20260526163538-3dc84a4a5aaa // indirect
 	google.golang.org/genproto/googleapis/rpc v0.0.0-20260630182238-925bb5da69e7 // indirect
 	gopkg.in/evanphx/json-patch.v4 v4.13.0 // indirect
 	k8s.io/cri-api v0.36.0 // indirect
 	k8s.io/cri-client v0.36.0 // indirect
-	k8s.io/kms v0.36.0 // indirect
-	k8s.io/kube-proxy v0.33.0 // indirect
-	k8s.io/streaming v0.36.0 // indirect
+	k8s.io/kms v0.36.3 // indirect
+	k8s.io/kube-proxy v0.36.3 // indirect
+	k8s.io/streaming v0.36.3 // indirect
 	modernc.org/gc/v3 v3.0.0-20240107210532-573471604cb6 // indirect
 	modernc.org/libc v1.49.3 // indirect
 	modernc.org/mathutil v1.6.0 // indirect
@@ -210,7 +214,7 @@ require (
 	mvdan.cc/sh/v3 v3.6.0 // indirect
 	oras.land/oras-go/v2 v2.6.2 // indirect
 	sigs.k8s.io/randfill v1.0.0 // indirect
-	sigs.k8s.io/structured-merge-diff/v6 v6.3.2 // indirect
+	sigs.k8s.io/structured-merge-diff/v6 v6.4.0 // indirect
 )
 
 require (
@@ -235,7 +239,7 @@ require (
 	github.com/go-openapi/jsonreference v1.0.0 // indirect
 	github.com/go-openapi/spec v0.22.9 // indirect
 	github.com/go-openapi/strfmt v0.27.0 // indirect
-	github.com/go-openapi/swag v0.23.1 // indirect
+	github.com/go-openapi/swag v0.26.0 // indirect
 	github.com/gogo/protobuf v1.3.2 // indirect
 	github.com/golang/protobuf v1.5.4 // indirect
 	github.com/google/btree v1.1.3 // indirect
@@ -247,12 +251,10 @@ require (
 	github.com/inconshreveable/go-update v0.0.0-20160112193335-8152e7eb6ccf // indirect
 	github.com/inconshreveable/mousetrap v1.1.0 // indirect
 	github.com/jonboulle/clockwork v0.5.0 // indirect
-	github.com/josharian/intern v1.0.0 // indirect
 	github.com/json-iterator/go v1.1.12 // indirect
 	github.com/kballard/go-shellquote v0.0.0-20180428030007-95032a82bc51
 	github.com/liggitt/tabwriter v0.0.0-20181228230101-89fcab3d43de // indirect
 	github.com/loft-sh/log v0.0.0-20260812120051-874a69680b18
-	git
```

**File**: `go.sum` (modified, +60/-56)
```diff
@@ -210,10 +210,16 @@ github.com/go-openapi/spec v0.22.9 h1:/vKIFDcGKp0ktZWGbym/tJEWbk6/XOEmAVU0kqKMH+
 github.com/go-openapi/spec v0.22.9/go.mod h1:b/mNUYIOQOyIiUzUzXEE8xzyZqf93KvM9hQGP91yfl0=
 github.com/go-openapi/strfmt v0.27.0 h1:kbcTeaD9TXuXD0hhMXzuYa1sdTo6+dWGvwjW93E80IM=
 github.com/go-openapi/strfmt v0.27.0/go.mod h1:s/qhDqfY72irigXUGJmtgid2Rm+3tnz3k8hZaRmvWYc=
-github.com/go-openapi/swag v0.23.1 h1:lpsStH0n2ittzTnbaSloVZLuB5+fvSY/+hnagBjSNZU=
-github.com/go-openapi/swag v0.23.1/go.mod h1:STZs8TbRvEQQKUA+JZNAm3EWlgaOBGpyFDqQnDHMef0=
+github.com/go-openapi/swag v0.26.0 h1:GVDXCmfvhfu1BxiHo8/FA+BbKmhecHnG3varjON5/RI=
+github.com/go-openapi/swag v0.26.0/go.mod h1:82g3193sZJRbocs7bNCqGfIgq8pkuwVwCfhKIRlEQF0=
+github.com/go-openapi/swag/cmdutils v0.26.0 h1:iowihOcvq7y4egO8cOq0dmfohz6wfeQ63U1EnuhO2TU=
+github.com/go-openapi/swag/cmdutils v0.26.0/go.mod h1:Sm1MVFMkF6guJJ+pQqHnQA3N0j9qALV3NxzDSv6bETM=
 github.com/go-openapi/swag/conv v0.28.0 h1:GtqqbyFe7vR5Y7ehxG9W6/OvrSFdf1OLeTGp40TqxH8=
 github.com/go-openapi/swag/conv v0.28.0/go.mod h1:mbUE+mzctnhxi864m0Q07SpN8OowD9JhxmxuYvZZD/k=
+github.com/go-openapi/swag/fileutils v0.26.0 h1:WJoPRvsA7QRiiWluowkLJa9jaYR7FCuxmDvnCgaRRxU=
+github.com/go-openapi/swag/fileutils v0.26.0/go.mod h1:0WDJ7lp67eNjPMO50wAWYlKvhOb6CQ37rzR7wrgI8Tc=
+github.com/go-openapi/swag/jsonname v0.26.0 h1:gV1NFX9M8avo0YSpmWogqfQISigCmpaiNci8cGECU5w=
+github.com/go-openapi/swag/jsonname v0.26.0/go.mod h1:urBBR8bZNoDYGr653ynhIx+gTeIz0ARZxHkAPktJK2M=
 github.com/go-openapi/swag/jsonutils v0.28.0 h1:YIch6FwO7RXzeAnbO8Tu7dWBZeUEH+4nA0HXltVTnv4=
 github.com/go-openapi/swag/jsonutils v0.28.0/go.mod h1:CYM3WlTUcagR2ZoHdz54di/cbBqt82tuxuXgAjxw+mg=
 github.com/go-openapi/swag/jsonutils/fixtures_test v0.28.0 h1:qV+VVUAx5Oro8WjVWpZeql7YReTKhT4smR4zhcOQZr0=
@@ -222,6 +228,8 @@ github.com/go-openapi/swag/loading v0.28.0 h1:td8QZdZC9MIYGGSnSPKShKiK22I2tU5UQv
 github.com/go-openapi/swag/loading v0.28.0/go.mod h1:rXB0QiQX5mMveXEA7ouM4KiiM9jVJe4K6BVbwhD1M4k=
 github.com/go-openapi/swag/mangling v0.28.0 h1:pH8eyeNO9SLYsTMWJrurnNfKmDa28XrlA+HePVD53VM=
 github.com/go-openapi/swag/mangling v0.28.0/go.mod h1:jtBE2+V+3pILxOR7Vgce+Cwp6A2PgZbvVqfNntbVs0w=
+github.com/go-openapi/swag/netutils v0.26.0 h1:CmZp+ZT7HrmFwrC3GdGsXBq2+42T1bjKBapcqVpIs3c=
+github.com/go-openapi/swag/netutils v0.26.0/go.mod h1:5iK+Ok3ZohWWex1C50BFTPexi03UaPwjW4Oj8kgrpwo=
 github.com/go-openapi/swag/pools v0.28.0 h1:HPMZWSAfce3rdVTFcjFiCIBtDg9h4x2QlRrHipwhxeU=
 github.com/go-openapi/swag/pools v0.28.0/go.mod h1:kVQefhSK5RWuRe7BXsL8htgBPAMpN7HDGpGEknqugeE=
 github.com/go-openapi/swag/stringutils v0.27.3 h1:Ru28hnbAvN5wycALQYy8IobHvASq+FUFMlp1QzLM0JI=
@@ -252,8 +260,8 @@ github.com/google/btree v1.1.3 h1:CVpQJjYgC4VbzxeGVHfvZrv1ctoYCAI8vbl07Fcxlyg=
 github.com/google/btree v1.1.3/go.mod h1:qOPhT0dTNdNzV6Z/lhRX0YXUafgPLFUh+gZMl761Gm4=
 github.com/google/cel-go v0.29.0 h1:fEG+Ja3YRwNOqnQxTyJwoByAUAvTuxUGiro/jhrm4F4=
 github.com/google/cel-go v0.29.0/go.mod h1:X0bD6iVNR8pkROSOoHVdgTkzmRcosof7WQqCD6wcMc8=
-github.com/google/gnostic-models v0.7.0 h1:qwTtogB15McXDaNqTZdzPJRHvaVJlAl+HVQnLmJEJxo=
-github.com/google/gnostic-models v0.7.0/go.mod h1:whL5G0m6dmc5cPxKc5bdKdEN3UjI7OUGxBlw57miDrQ=
+github.com/google/gnostic-models v0.7.1 h1:SisTfuFKJSKM5CPZkffwi6coztzzeYUhc3v4yxLWH8c=
+github.com/google/gnostic-models v0.7.1/go.mod h1:whL5G0m6dmc5cPxKc5bdKdEN3UjI7OUGxBlw57miDrQ=
 github.com/google/go-cmp v0.5.2/go.mod h1:v8dTdLbMG2kIc/vJvl+f65V22dbkXbowE6jgT/gNBxE=
 github.com/google/go-cmp v0.5.9/go.mod h1:17dUlkBOakJ0+DkrSSNjCkIjxS6bF9zb3elmeNGIjoY=
 github.com/google/go-cmp v0.6.0/go.mod h1:17dUlkBOakJ0+DkrSSNjCkIjxS6bF9zb3elmeNGIjoY=
@@ -306,8 +314,6 @@ github.com/jhump/protoreflect v1.17.0 h1:qOEr613fac2lOuTgWN4tPAtLL7fUSbuJL5X5Xum
 github.com/jhump/protoreflect v1.17.0/go.mod h1:h9+vUUL38jiBzck8ck+6G/aeMX8Z4QUY/NiJPwPNi+8=
 github.com/jonboulle/clockwork v0.5.0 h1:Hyh9A8u51kptdkR+cqRpT1EebBwTn1oK9YfGYbdFz6I=
 github.com/jonboulle/clockwork v0.5.0/go.mod h1:3mZlmanh0g2NDKO5TWZVJAfofYk64M7XN3SzBPjZF60=
-github.com/josharian/intern v1.0.0 h1:vlS4z54oSdjm0bgjRigI+G1HpF+tI+9rE5LLzOg8HmY=
-github.com/josharian/intern v1.0.0/go.mod h1:5DoeVV0s6jJacbCEi61lwdGj/aVlrQvzHFFd8Hwg//Y=
 github.com/joshdk/go-junit v1.0.0 h1:S86cUKIdwBHWwA6xCmFlf3RTLfVXYQfvanM5Uh+K6GE=
 github.com/joshdk/go-junit v1.0.0/go.mod h1:TiiV0PqkaNfFXjEiyjWM3XXrhVyCa1K4Zfga6W52ung=
 github.com/json-iterator/go v1.1.12 h1:PV8peI4a0ysnczrg+LtxykD8LfKY9ML6u2jnxaEnrnM=
@@ -360,8 +366,6 @@ github.com/loft-sh/log v0.0.0-20260812120051-874a69680b18 h1:sbARcX5vFUv8E/x6q6Z
 github.com/loft-sh/log v0.0.0-20260812120051-874a69680b18/go.mod h1:YImeRjXH34Yf5E79T7UHBQpDZl9fIaaFRgyZ/bkY+UQ=
 github.com/loft-sh/utils v0.0.29 h1:P/MObccXToAZy2QoJSQDJ+OJx1qHitpFHEVj3QBSNJs=
 github.com/loft-sh/utils v0.0.29/go.mod h1:9hlX9cGpWHg3mNi/oBlv3X4ePGDMK66k8MbOZGFMDTI=
-github.com/mailru/easyjson v0.9.1 h1:LbtsOm5WAswyWbvTEOqhypdPeZzHavpZx96/n553mR8=
-github.com/mailru/easyjson v0.9.1/go.mod h1:1+xMtQp2MRNVL/V1bOzuP3aP8
```

**File**: `vendor/github.com/go-openapi/swag/.codecov.yml` (added, +4/-0)
```diff
@@ -0,0 +1,4 @@
+ignore:
+  - jsonutils/fixtures_test
+  - jsonutils/adapters/ifaces/mocks
+  - jsonutils/adapters/testintegration/benchmarks
```

**File**: `vendor/github.com/go-openapi/swag/.gitignore` (modified, +1/-0)
```diff
@@ -3,3 +3,4 @@ vendor
 Godeps
 .idea
 *.out
+.mcp.json
```

**File**: `vendor/github.com/go-openapi/swag/.golangci.yml` (modified, +70/-48)
```diff
@@ -1,56 +1,78 @@
-linters-settings:
-  gocyclo:
-    min-complexity: 45
-  dupl:
-    threshold: 200
-  goconst:
-    min-len: 2
-    min-occurrences: 3
-
+version: "2"
 linters:
-  enable-all: true
+  default: all
   disable:
-    - recvcheck
-    - unparam
-    - lll
-    - gochecknoinits
-    - gochecknoglobals
+    - cyclop
+    - depguard
+    - errchkjson
+    - errorlint
+    - exhaustruct
+    - forcetypeassert
     - funlen
-    - godox
+    - gochecknoglobals
+    - gochecknoinits
     - gocognit
-    - whitespace
-    - wsl
-    - wrapcheck
-    - testpackage
-    - nlreturn
-    - errorlint
-    - nestif
     - godot
-    - gofumpt
+    - godox
+    - gomoddirectives
+    - gosmopolitan
+    - inamedparam
+    - intrange
+    - ireturn
+    - lll
+    - musttag
+    - modernize
+    - nestif
+    - nlreturn
+    - nonamedreturns
+    - noinlineerr
     - paralleltest
-    - tparallel
+    - recvcheck
+    - testpackage
     - thelper
-    - exhaustruct
+    - tagliatelle
+    - tparallel
+    - unparam
     - varnamelen
-    - gci
-    - depguard
-    - errchkjson
-    - inamedparam
-    - nonamedreturns
-    - musttag
-    - ireturn
-    - forcetypeassert
-    - cyclop
-    # deprecated linters
-    #- deadcode
-    #- interfacer
-    #- scopelint
-    #- varcheck
-    #- structcheck
-    #- golint
-    #- nosnakecase
-    #- maligned
-    #- goerr113
-    #- ifshort
-    #- gomnd
-    #- exhaustivestruct
+    - whitespace
+    - wrapcheck
+    - wsl
+    - wsl_v5
+  settings:
+    dupl:
+      threshold: 200
+    goconst:
+      min-len: 2
+      min-occurrences: 3
+    gocyclo:
+      min-complexity: 45
+  exclusions:
+    generated: lax
+    presets:
+      - comments
+      - common-false-positives
+      - legacy
+      - std-error-handling
+    paths:
+      - third_party$
+      - builtin$
+      - examples$
+formatters:
+  enable:
+    - gofmt
+    - goimports
+  exclusions:
+    generated: lax
+    paths:
+      - third_party$
+      - builtin$
+      - examples$
+issues:
+  # Maximum issues count per one linter.
+  # Set to 0 to disable.
+  # Default: 50
+  max-issues-per-linter: 0
+  # Maximum count of issues with the same text.
+  # Set to 0 to disable.
+  # Default: 3
+  max-same-issues: 0
```

**File**: `vendor/github.com/go-openapi/swag/.mockery.yml` (added, +30/-0)
```diff
@@ -0,0 +1,30 @@
+all: false
+dir: '{{.InterfaceDir}}'
+filename: mocks_test.go
+force-file-write: true
+formatter: goimports
+include-auto-generated: false
+log-level: info
+structname: '{{.Mock}}{{.InterfaceName}}'
+pkgname: '{{.SrcPackageName}}'
+recursive: false
+require-template-schema-exists: true
+template: matryer
+template-schema: '{{.Template}}.schema.json'
+packages:
+  github.com/go-openapi/swag/jsonutils/adapters/ifaces:
+    config:
+      dir: jsonutils/adapters/ifaces/mocks
+      filename: mocks.go
+      pkgname: 'mocks'
+      force-file-write: true
+      all: true
+  github.com/go-openapi/swag/jsonutils/adapters/testintegration:
+    config:
+      inpackage: true
+      dir: jsonutils/adapters/testintegration
+      force-file-write: true
+      all: true
+    interfaces:
+      EJMarshaler:
+      EJUnmarshaler:
```

**File**: `vendor/github.com/go-openapi/swag/BENCHMARK.md` (removed, +0/-52)
```diff
@@ -1,52 +0,0 @@
-# Benchmarks
-
-## Name mangling utilities
-
-```bash
-go test -bench XXX -run XXX -benchtime 30s
-```
-
-### Benchmarks at b3e7a5386f996177e4808f11acb2aa93a0f660df
-
-```
-goos: linux
-goarch: amd64
-pkg: github.com/go-openapi/swag
-cpu: Intel(R) Core(TM) i5-6200U CPU @ 2.30GHz
-BenchmarkToXXXName/ToGoName-4         	  862623	     44101 ns/op	   10450 B/op	     732 allocs/op
-BenchmarkToXXXName/ToVarName-4        	  853656	     40728 ns/op	   10468 B/op	     734 allocs/op
-BenchmarkToXXXName/ToFileName-4       	 1268312	     27813 ns/op	    9785 B/op	     617 allocs/op
-BenchmarkToXXXName/ToCommandName-4    	 1276322	     27903 ns/op	    9785 B/op	     617 allocs/op
-BenchmarkToXXXName/ToHumanNameLower-4 	  895334	     40354 ns/op	   10472 B/op	     731 allocs/op
-BenchmarkToXXXName/ToHumanNameTitle-4 	  882441	     40678 ns/op	   10566 B/op	     749 allocs/op
-```
-
-### Benchmarks after PR #79
-
-~ x10 performance improvement and ~ /100 memory allocations.
-
-```
-goos: linux
-goarch: amd64
-pkg: github.com/go-openapi/swag
-cpu: Intel(R) Core(TM) i5-6200U CPU @ 2.30GHz
-BenchmarkToXXXName/ToGoName-4         	 9595830	      3991 ns/op	      42 B/op	       5 allocs/op
-BenchmarkToXXXName/ToVarName-4        	 9194276	      3984 ns/op	      62 B/op	       7 allocs/op
-BenchmarkToXXXName/ToFileName-4       	17002711	      2123 ns/op	     147 B/op	       7 allocs/op
-BenchmarkToXXXName/ToCommandName-4    	16772926	      2111 ns/op	     147 B/op	       7 allocs/op
-BenchmarkToXXXName/ToHumanNameLower-4 	 9788331	      3749 ns/op	      92 B/op	       6 allocs/op
-BenchmarkToXXXName/ToHumanNameTitle-4 	 9188260	      3941 ns/op	     104 B/op	       6 allocs/op
-```
-
-```
-goos: linux
-goarch: amd64
-pkg: github.com/go-openapi/swag
-cpu: AMD Ryzen 7 5800X 8-Core Processor             
-BenchmarkToXXXName/ToGoName-16         	18527378	      1972 ns/op	      42 B/op	       5 allocs/op
-BenchmarkToXXXName/ToVarName-16        	15552692	      2093 ns/op	      62 B/op	       7 allocs/op
-BenchmarkToXXXName/ToFileName-16       	32161176	      1117 ns/op	     147 B/op	       7 allocs/op
-BenchmarkToXXXName/ToCommandName-16    	32256634	      1137 ns/op	     147 B/op	       7 allocs/op
-BenchmarkToXXXName/ToHumanNameLower-16 	18599661	      1946 ns/op	      92 B/op	       6 allocs/op
-BenchmarkToXXXName/ToHumanNameTitle-16 	17581353	      2054 ns/op	     105 B/op	       6 allocs/op
-```
```

**File**: `vendor/github.com/go-openapi/swag/CODE_OF_CONDUCT.md` (modified, +4/-2)
```diff
@@ -23,7 +23,9 @@ include:
 Examples of unacceptable behavior by participants include:
 
 * The use of sexualized language or imagery and unwelcome sexual attention or
+
 advances
+
 * Trolling, insulting/derogatory comments, and personal or political attacks
 * Public or private harassment
 * Publishing others' private information, such as a physical or electronic
@@ -55,7 +57,7 @@ further defined and clarified by project maintainers.
 ## Enforcement
 
 Instances of abusive, harassing, or otherwise unacceptable behavior may be
-reported by contacting the project team at ivan+abuse@flanders.co.nz. All
+reported by contacting the project team at <ivan+abuse@flanders.co.nz>. All
 complaints will be reviewed and investigated and will result in a response that
 is deemed necessary and appropriate to the circumstances. The project team is
 obligated to maintain confidentiality with regard to the reporter of an incident.
@@ -68,7 +70,7 @@ members of the project's leadership.
 ## Attribution
 
 This Code of Conduct is adapted from the [Contributor Covenant][homepage], version 1.4,
-available at [http://contributor-covenant.org/version/1/4][version]
+available at [<http://contributor-covenant.org/version/1/4>][version]
 
 [homepage]: http://contributor-covenant.org
 [version]: http://contributor-covenant.org/version/1/4/
```

---

### Incident Patch 15: `9794938c` (2026-09-08)
**Commit Message**: fix(docker): support running the docker driver on podman (#2291)

* fix(docker): support running the docker driver on podman

- Fall back to Podman's Docker-compatible API socket by setting
  DOCKER_HOST for the process when the docker daemon is unreachable,
  so `vcluster create --driver docker` works out of the box with a
  rootful podman machine.
- Detect the docker socket inside the VM via well-known paths first:
  in a podman machine /var/run/docker.sock is a symlink to podman.sock
  that never shows up in netstat, so the previous netstat-only scan
  failed with "no docker socket path found". Also disable the load
  balancer with a warning instead of failing the whole create when no
  socket is found.
- Load the overlay, bridge and br_netfilter kernel modules inside the
  container runtime VM on non-linux hosts. Docker Desktop preloads
  them, podman machine (Fedora CoreOS) does not, which made node join
  and Flannel fail.
- Download install-standalone.sh on the host instead of inside the
  container, cache it under the vcluster config directory and allow a
  local override via VCLUSTER_INSTALL_STANDALONE_SCRIPT. Corporate
  proxies often block direct github downloads from co

**File**: `cmd/vclusterctl/cmd/node/load-docker-image.go` (modified, +6/-0)
```diff
@@ -7,6 +7,7 @@ import (
 	"os/exec"
 
 	"github.com/loft-sh/log"
+	"github.com/loft-sh/vcluster/pkg/cli"
 	"github.com/loft-sh/vcluster/pkg/cli/flags"
 	"github.com/loft-sh/vcluster/pkg/snapshot/pod"
 	"github.com/spf13/cobra"
@@ -67,6 +68,11 @@ func (o *LoadImageOptions) Run(ctx context.Context, nodeName string) error {
 
 	// save image to archive
 	if o.Image != "" {
+		// make sure a docker daemon is reachable, falling back to podman if available
+		if err := cli.EnsureDockerDaemon(ctx, o.Log); err != nil {
+			return err
+		}
+
 		o.Log.Infof("Saving image %s to archive...", o.Image)
 		if err := runCommand("docker", "save", "-o", "image.tar.gz", o.Image); err != nil {
 			return fmt.Errorf("failed to save image: %w", err)
```

**File**: `pkg/cli/connect_docker.go` (modified, +6/-0)
```diff
@@ -52,6 +52,12 @@ type connectDocker struct {
 }
 
 func ConnectDocker(ctx context.Context, options *ConnectOptions, globalFlags *flags.GlobalFlags, vClusterName string, command []string, log log.Logger) error {
+	// make sure a docker daemon is reachable, falling back to podman if available
+	err := EnsureDockerDaemon(ctx, log)
+	if err != nil {
+		return err
+	}
+
 	cmd := &connectDocker{
 		GlobalFlags:    globalFlags,
 		ConnectOptions: options,
```

**File**: `pkg/cli/create_docker.go` (modified, +187/-61)
```diff
@@ -2,12 +2,15 @@ package cli
 
 import (
 	"bufio"
+	"bytes"
 	"context"
 	"encoding/binary"
 	"encoding/json"
 	"errors"
 	"fmt"
+	"io"
 	"net"
+	"net/http"
 	"net/url"
 	"os"
 	"os/exec"
@@ -72,6 +75,12 @@ func CreateDocker(ctx context.Context, options *CreateOptions, globalFlags *flag
 		os.Remove(hostnameFile)
 	}
 
+	// make sure a docker daemon is reachable, falling back to podman if available
+	err := EnsureDockerDaemon(ctx, log)
+	if err != nil {
+		return err
+	}
+
 	// check if container exists
 	exists, err := containerExists(ctx, getControlPlaneContainerName(vClusterName))
 	if err != nil {
@@ -108,29 +117,9 @@ func CreateDocker(ctx context.Context, options *CreateOptions, globalFlags *flag
 		return fmt.Errorf("failed to load docker config: %w", err)
 	}
 
-	// On Linux, load kernel modules required for node join (bridge, br_netfilter, overlay).
-	// Only run modprobe for modules not already loaded (check via /proc/modules, no sudo).
-	if runtime.GOOS == "linux" {
-		required := []string{"overlay", "bridge", "br_netfilter"}
-		loaded := make(map[string]bool)
-		if data, err := os.ReadFile("/proc/modules"); err == nil {
-			scanner := bufio.NewScanner(strings.NewReader(string(data)))
-			for scanner.Scan() {
-				fields := strings.Fields(scanner.Text())
-				if len(fields) > 0 {
-					loaded[fields[0]] = true
-				}
-			}
-		}
-		for _, mod := range required {
-			if loaded[mod] {
-				continue
-			}
-			if err := exec.CommandContext(ctx, "modprobe", mod).Run(); err != nil {
-				log.Warnf("Could not load kernel module %s: %v. If node join fails, run: sudo modprobe overlay && sudo modprobe bridge && sudo modprobe br_netfilter", mod, err)
-			}
-		}
-	}
+	// load kernel modules required for node join (bridge, br_netfilter, overlay),
+	// either on the host or inside the VM the container daemon runs in
+	ensureKernelModules(ctx, log)
 
 	// configure the network and update user values if needed
 	networkName, extraDockerArgs, err := configureNetwork(ctx, userValuesRaw, vClusterName, log)
@@ -234,7 +223,7 @@ func CreateDocker(ctx context.Context, options *CreateOptions, globalFlags *flag
 
 	// install vCluster standalone
 	if !exists {
-		err = installVClusterStandalone(ctx, vClusterName, vClusterVersion, vConfig, extraVClusterArgs, log)
+		err = installVClusterStandalone(ctx, vClusterName, vClusterVersion, vConfig, globalFlags, extraVClusterArgs, log)
 		if err != nil {
 			return err
 		}
@@ -350,11 +339,13 @@ func addVClusterDocker(ctx context.Context, name string, vClusterConfig *config.
 }
 
 // runDockerCommand runs a docker command and captures its combined output.
-// If the command runs longer than streamDelay, all buffered output is flushed
-// to the logger and subsequent lines are streamed in real time.
-func runDockerCommand(ctx context.Context, args []string, streamDelay time.Duration, logger log.Logger) (string, error) {
+// If stdin is not nil, it is passed to the command. If the command runs longer
+// than streamDelay, all buffered output is flushed to the logger and subsequent
+// lines are streamed in real time.
+func runDockerCommand(ctx context.Context, args []string, stdin io.Reader, streamDelay time.Duration, logger log.Logger) (string, error) {
 	logger.Debugf("Running command: docker %s", strings.Join(args, " "))
 	cmd := exec.CommandContext(ctx, "docker", args...)
+	cmd.Stdin = stdin
 
 	pr, pw, err := os.Pipe()
 	if err != nil {
@@ -419,16 +410,25 @@ func runDockerCommand(ctx context.Context, args []string, streamDelay time.Durat
 	return allOutput, nil
 }
 
-func installVClusterStandalone(ctx context.Context, vClusterName, vClusterVersion string, vClusterConfig *config.Config, extraArgs []string, log log.Logger) error {
+func installVClusterStandalone(ctx context.Context, vClusterName, vClusterVersion string, vClusterConfig *config.Config, globalFlags *flags.GlobalFlags, extraArgs []string, log log.Logger) error {
 	log.Infof("Starting vCluster standalone %s", vClusterName)
+
+	// get the install script on the host instead of downloading it inside the
+	// container, since corporate proxies often block direct github downloads
+	// from containers while the host has the proxy and CA configuration
+	installScript, err := getInstallStandaloneScript(ctx, vClusterVersion, globalFlags)
+	if err != nil {
+		return fmt.Errorf("failed to get install-standalone script: %w", err)
+	}
+
 	containerName := getControlPlaneContainerName(vClusterName)
 	joinedArgs := strings.Join(extraArgs, " ")
 	args := []string{
-		"exec", containerName,
-		"bash", "-c", fmt.Sprintf(`set -e -o pipefail; for i in $(seq 1 120); do state=$(systemctl is-system-running 2>/dev/null || true); [ "$state" = "running" ] || [ "$state" = "degraded" ] && break; sleep 0.5; done; curl -sfLk "https://github.com/loft-sh/vcluster/releases/download/v%s/install-standalone.sh" | sh -s -- --skip-download --skip-wait %s`, vClusterVersion, joinedArgs),
+		"exec", "-i", containerName,
+		"bash", "-c", fmt.Sprintf(`set -e 
```

**File**: `pkg/cli/create_docker_test.go` (added, +85/-0)
```diff
@@ -0,0 +1,85 @@
+package cli
+
+import (
+	"os"
+	"path/filepath"
+	"strings"
+	"testing"
+
+	"github.com/loft-sh/vcluster/pkg/cli/flags"
+	"gotest.tools/v3/assert"
+)
+
+func TestGetInstallStandaloneScript(t *testing.T) {
+	ctx := t.Context()
+
+	t.Run("environment variable override", func(t *testing.T) {
+		scriptPath := filepath.Join(t.TempDir(), "install-standalone.sh")
+		assert.NilError(t, os.WriteFile(scriptPath, []byte("#!/bin/sh\necho override"), 0644))
+		t.Setenv(installStandaloneScriptEnv, scriptPath)
+
+		globalFlags := &flags.GlobalFlags{Config: filepath.Join(t.TempDir(), "config.json")}
+		script, err := getInstallStandaloneScript(ctx, "0.31.0", globalFlags)
+		assert.NilError(t, err)
+		assert.Equal(t, string(script), "#!/bin/sh\necho override")
+	})
+
+	t.Run("environment variable override with missing file", func(t *testing.T) {
+		t.Setenv(installStandaloneScriptEnv, filepath.Join(t.TempDir(), "does-not-exist.sh"))
+
+		globalFlags := &flags.GlobalFlags{Config: filepath.Join(t.TempDir(), "config.json")}
+		_, err := getInstallStandaloneScript(ctx, "0.31.0", globalFlags)
+		assert.ErrorContains(t, err, installStandaloneScriptEnv)
+	})
+
+	t.Run("script validation", func(t *testing.T) {
+		assert.NilError(t, validateInstallStandaloneScript([]byte("#!/bin/sh\necho ok")))
+		assert.ErrorContains(t, validateInstallStandaloneScript([]byte("<html>proxy error page</html>")), "shebang")
+		assert.ErrorContains(t, validateInstallStandaloneScript(nil), "shebang")
+	})
+
+	t.Run("cached script is used without downloading", func(t *testing.T) {
+		configDir := t.TempDir()
+		cachePath := filepath.Join(configDir, "docker", "install-standalone", "v0.31.0", "install-standalone.sh")
+		assert.NilError(t, os.MkdirAll(filepath.Dir(cachePath), 0755))
+		assert.NilError(t, os.WriteFile(cachePath, []byte("#!/bin/sh\necho cached"), 0644))
+
+		globalFlags := &flags.GlobalFlags{Config: filepath.Join(configDir, "config.json")}
+		script, err := getInstallStandaloneScript(ctx, "0.31.0", globalFlags)
+		assert.NilError(t, err)
+		assert.Equal(t, string(script), "#!/bin/sh\necho cached")
+	})
+}
+
+func TestLoadBalancerUnsupportedReason(t *testing.T) {
+	t.Run("reachable network keeps the load balancer enabled everywhere", func(t *testing.T) {
+		assert.Equal(t, loadBalancerUnsupportedReason("linux", true, false, false), "")
+		assert.Equal(t, loadBalancerUnsupportedReason("darwin", true, false, false), "")
+	})
+
+	t.Run("unreachable network disables it outside darwin", func(t *testing.T) {
+		reason := loadBalancerUnsupportedReason("linux", false, false, false)
+		assert.Assert(t, strings.Contains(reason, "only supported on macOS"), "got: %s", reason)
+	})
+
+	t.Run("darwin without privileged ports on podman names the podman limitation", func(t *testing.T) {
+		// this is the customer-facing half of loft-sh/vind#5: when the load
+		// balancer must be disabled, the warning has to explain the podman
+		// limitation instead of offering Docker Desktop advice
+		reason := loadBalancerUnsupportedReason("darwin", false, false, true)
+		assert.Assert(t, strings.Contains(reason, "Podman"), "got: %s", reason)
+		assert.Assert(t, strings.Contains(reason, "containers/podman/issues/28009"), "got: %s", reason)
+		assert.Assert(t, !strings.Contains(reason, "Docker Desktop"), "got: %s", reason)
+	})
+
+	t.Run("darwin without privileged ports on docker names the docker desktop setting", func(t *testing.T) {
+		reason := loadBalancerUnsupportedReason("darwin", false, false, false)
+		assert.Assert(t, strings.Contains(reason, "Docker Desktop"), "got: %s", reason)
+		assert.Assert(t, !strings.Contains(reason, "Podman"), "got: %s", reason)
+		assert.Assert(t, !strings.Contains(reason, "podman/issues/28009"), "got: %s", reason)
+	})
+
+	t.Run("darwin with privileged ports keeps it enabled", func(t *testing.T) {
+		assert.Equal(t, loadBalancerUnsupportedReason("darwin", false, true, false), "")
+	})
+}
```

**File**: `pkg/cli/delete_docker.go` (modified, +6/-0)
```diff
@@ -25,6 +25,12 @@ type deleteDocker struct {
 }
 
 func DeleteDocker(ctx context.Context, platformClient platform.Client, options *DeleteOptions, globalFlags *flags.GlobalFlags, vClusterName string, log log.Logger) error {
+	// make sure a docker daemon is reachable, falling back to podman if available
+	err := EnsureDockerDaemon(ctx, log)
+	if err != nil {
+		return err
+	}
+
 	cmd := &deleteDocker{
 		GlobalFlags:   globalFlags,
 		DeleteOptions: options,
```

**File**: `pkg/cli/describe_docker.go` (modified, +6/-0)
```diff
@@ -85,6 +85,12 @@ type dockerInspectDetails struct {
 }
 
 func DescribeDocker(ctx context.Context, flags *flags.GlobalFlags, output io.Writer, l log.Logger, name string, configOnly bool, format string) error {
+	// make sure a docker daemon is reachable, falling back to podman if available
+	err := EnsureDockerDaemon(ctx, l)
+	if err != nil {
+		return err
+	}
+
 	containerName := getControlPlaneContainerName(name)
 
 	// inspect the container
```

**File**: `pkg/cli/docker_runtime.go` (added, +216/-0)
```diff
@@ -0,0 +1,216 @@
+package cli
+
+import (
+	"context"
+	"errors"
+	"fmt"
+	"os"
+	"os/exec"
+	"runtime"
+	"strings"
+	"sync"
+
+	"github.com/loft-sh/log"
+)
+
+var (
+	ensureDockerDaemonOnce sync.Once
+	errEnsureDockerDaemon  error
+
+	// set by findDockerDaemon inside ensureDockerDaemonOnce, so it needs no extra synchronization
+	isPodmanBackend bool
+)
+
+// EnsureDockerDaemon makes sure the docker CLI can reach a container daemon before
+// any docker command is run. If the default docker daemon is not reachable, it falls
+// back to Podman's Docker-compatible API socket by setting DOCKER_HOST for this
+// process, which every subsequent docker command inherits.
+func EnsureDockerDaemon(ctx context.Context, log log.Logger) error {
+	ensureDockerDaemonOnce.Do(func() {
+		errEnsureDockerDaemon = findDockerDaemon(ctx, log)
+	})
+	return errEnsureDockerDaemon
+}
+
+func findDockerDaemon(ctx context.Context, log log.Logger) error {
+	if _, err := exec.LookPath("docker"); err != nil {
+		return fmt.Errorf("couldn't find the docker CLI, please make sure docker (or podman plus the docker CLI) is installed: %w", err)
+	}
+
+	// check if the docker daemon is already reachable
+	pingErr := pingDockerDaemon(ctx)
+	if pingErr == nil {
+		return nil
+	}
+
+	// if the user explicitly configured a docker endpoint, don't second-guess it
+	if dockerHost := os.Getenv("DOCKER_HOST"); dockerHost != "" {
+		return fmt.Errorf("docker daemon at DOCKER_HOST=%s is not reachable: %w", dockerHost, pingErr)
+	}
+
+	// the docker daemon is not reachable, try to fall back to podman's
+	// docker-compatible API socket
+	socketPath, err := findPodmanSocket(ctx)
+	if err != nil {
+		log.Debugf("Podman fallback not available: %v", err)
+		return fmt.Errorf("docker daemon is not reachable, please make sure docker is running (if you are using podman, make sure the podman machine is running): %w", pingErr)
+	}
+
+	err = os.Setenv("DOCKER_HOST", "unix://"+socketPath)
+	if err != nil {
+		return fmt.Errorf("set DOCKER_HOST: %w", err)
+	}
+
+	err = pingDockerDaemon(ctx)
+	if err != nil {
+		return fmt.Errorf("podman socket %s is not reachable via the docker CLI, please make sure the podman machine is running and rootful: %w", socketPath, err)
+	}
+
+	isPodmanBackend = true
+
+	// use Warnf so the notice goes to stderr and doesn't corrupt commands that
+	// print machine readable output (e.g. vcluster list --output json)
+	log.Warnf("Docker daemon not found, using Podman's Docker-compatible API at %s", socketPath)
+	return nil
+}
+
+func pingDockerDaemon(ctx context.Context) error {
+	out, err := exec.CommandContext(ctx, "docker", "version", "--format", "{{.Server.Version}}").CombinedOutput()
+	if err != nil {
+		return fmt.Errorf("%s: %w", strings.TrimSpace(string(out)), err)
+	}
+
+	return nil
+}
+
+// findPodmanSocket returns the host path of Podman's Docker-compatible API socket.
+func findPodmanSocket(ctx context.Context) (string, error) {
+	if _, err := exec.LookPath("podman"); err != nil {
+		return "", fmt.Errorf("podman not found: %w", err)
+	}
+
+	args, err := podmanSocketCommandArgs(runtime.GOOS)
+	if err != nil {
+		return "", err
+	}
+
+	out, err := exec.CommandContext(ctx, "podman", args...).Output()
+	if err != nil {
+		var exitErr *exec.ExitError
+		if errors.As(err, &exitErr) {
+			return "", fmt.Errorf("podman %s: %s: %w", strings.Join(args, " "), strings.TrimSpace(string(exitErr.Stderr)), err)
+		}
+		return "", fmt.Errorf("podman %s: %w", strings.Join(args, " "), err)
+	}
+
+	return parsePodmanSocketPath(string(out))
+}
+
+// podmanSocketCommandArgs returns the podman arguments that resolve the
+// Docker-compatible API socket on the given platform. Split out of
+// findPodmanSocket so the platform branches can be unit tested on any OS.
+func podmanSocketCommandArgs(goos string) ([]string, error) {
+	switch goos {
+	case "windows":
+		// podman machine on windows exposes a named pipe instead of a unix
+		// socket, which the fallback doesn't handle
+		return nil, fmt.Errorf("automatic podman fallback is not supported on windows, please set DOCKER_HOST to the podman machine's docker API endpoint manually")
+	case "linux":
+		// podman serves the API directly on the host
+		return []string{"info", "--format", "{{.Host.RemoteSocket.Path}}"}, nil
+	default:
+		// podman runs inside a podman machine that forwards a socket to the host
+		return []string{"machine", "inspect", "--format", "{{.ConnectionInfo.PodmanSocket.Path}}"}, nil
+	}
+}
+
+// parsePodmanSocketPath extracts the socket path from the output of the command
+// built by podmanSocketCommandArgs, e.g. "unix:///run/podman/podman.sock" or a
+// bare path. Empty and "<nil>" outputs are what podman prints when no machine is
+// running, so they map to the error the user can act on.
+func parsePodmanSocketPath(out string) (string, error) {
+	socketPath := strings.TrimPrefix(strings.TrimSpace(out), "unix://")
+	if socketPath == "" || strings.Contains(socketPath, "<nil>") {
+
```

**File**: `pkg/cli/docker_runtime_test.go` (added, +96/-0)
```diff
@@ -0,0 +1,96 @@
+package cli
+
+import (
+	"strings"
+	"testing"
+
+	"gotest.tools/v3/assert"
+)
+
+// The podman fallback and VM kernel module paths only execute on macOS and
+// windows hosts, which CI doesn't run. These tests cover the platform branches
+// and output parsing directly so the darwin podman machine case - the platform
+// loft-sh/vind#5 was reported from - doesn't ship blind.
+
+func TestPodmanSocketCommandArgs(t *testing.T) {
+	t.Run("darwin resolves the podman machine's forwarded socket", func(t *testing.T) {
+		args, err := podmanSocketCommandArgs("darwin")
+		assert.NilError(t, err)
+		assert.DeepEqual(t, args, []string{"machine", "inspect", "--format", "{{.ConnectionInfo.PodmanSocket.Path}}"})
+	})
+
+	t.Run("linux resolves the host socket", func(t *testing.T) {
+		args, err := podmanSocketCommandArgs("linux")
+		assert.NilError(t, err)
+		assert.DeepEqual(t, args, []string{"info", "--format", "{{.Host.RemoteSocket.Path}}"})
+	})
+
+	t.Run("windows is unsupported and says how to proceed", func(t *testing.T) {
+		_, err := podmanSocketCommandArgs("windows")
+		assert.ErrorContains(t, err, "not supported on windows")
+		assert.ErrorContains(t, err, "DOCKER_HOST")
+	})
+}
+
+func TestParsePodmanSocketPath(t *testing.T) {
+	tests := []struct {
+		name     string
+		output   string
+		expected string
+		errPart  string
+	}{
+		{
+			name:     "unix scheme is stripped",
+			output:   "unix:///run/podman/podman.sock\n",
+			expected: "/run/podman/podman.sock",
+		},
+		{
+			name:     "bare path from podman machine inspect",
+			output:   "/var/folders/5w/T/podman/podman-machine-default-api.sock\n",
+			expected: "/var/folders/5w/T/podman/podman-machine-default-api.sock",
+		},
+		{
+			name:    "nil template result means no machine is running",
+			output:  "<nil>\n",
+			errPart: "is the podman machine running",
+		},
+		{
+			name:    "empty output means no machine is running",
+			output:  "\n",
+			errPart: "is the podman machine running",
+		},
+	}
+	for _, tt := range tests {
+		t.Run(tt.name, func(t *testing.T) {
+			path, err := parsePodmanSocketPath(tt.output)
+			if tt.errPart != "" {
+				assert.ErrorContains(t, err, tt.errPart)
+				return
+			}
+			assert.NilError(t, err)
+			assert.Equal(t, path, tt.expected)
+		})
+	}
+}
+
+func TestHostNamespaceCommand(t *testing.T) {
+	cmd := hostNamespaceCommand(t.Context(), "echo probe")
+
+	// the command must enter every namespace of PID 1 through a privileged
+	// container sharing the daemon host's PID namespace
+	assert.DeepEqual(t, cmd.Args, []string{
+		"docker", "run", "-q", "--rm", "--privileged", "--pid=host",
+		"alpine", "nsenter", "-t", "1", "-m", "-p", "-u", "-i", "-n",
+		"sh", "-c", "echo probe",
+	})
+}
+
+func TestVMKernelModulesScript(t *testing.T) {
+	// node join needs all three modules, and the sysctls must stay gated on a
+	// module having been loaded so already configured machines are not modified
+	for _, mod := range []string{"overlay", "bridge", "br_netfilter"} {
+		assert.Assert(t, strings.Contains(vmKernelModulesScript, mod), "script must handle module %s", mod)
+	}
+	assert.Assert(t, strings.Contains(vmKernelModulesScript, `if [ -n "$loaded" ]`), "sysctls must be gated on a module having been loaded")
+	assert.Assert(t, strings.Contains(vmKernelModulesScript, "net.bridge.bridge-nf-call-iptables=1"), "bridge netfilter sysctl must be set for fresh VMs")
+}
```

#### Recent Merged Pull Requests:
- **PR #4187** (2026-09-24): feat(chart): make ServiceMonitor scrape interval configurable (backport v0.36 oss) (@loft-bot)
- **PR #4185** (closed): fix(syncer): skip load balancer status for headless mappings (@avinashgola)
- **PR #4184** (closed): [v0.37] chore: bump minimum platform version to v4.12.1 (@deniseschannon)
- **PR #4183** (2026-09-22): chore: replay the pending v0.37 commits from vcluster-pro (@sydorovdmytro)
- **PR #4182** (2026-09-17): chore: refactor codeowners (backport v0.36 oss) (@loft-bot)
- **PR #4181** (2026-09-17): chore: refactor codeowners (backport v0.34 oss) (@loft-bot)
- **PR #4180** (2026-09-17): chore: refactor codeowners (backport v0.35 oss) (@loft-bot)
- **PR #4172** (2026-09-08): chore(platform): bump minimum vcluster platform version to v4.9.5 (@deniseschannon)

---

## 3. Empirical Evidence & Compliance Certification
- **Evidence Provenance**: Fetched directly from verified official GitHub REST API.
- **Zero Disk Footprint**: 0 bytes of unnecessary repository bloat stored locally.
- **TOS & Free-Tier Adherence**: Request pace complied with public API guidelines without fee, penalty, or unauthorized scraping.

---

## 4. Promotion & Integration Status
- **Status**: HARVESTED_DEEP_FORENSIC
- **Master Brain Sync**: Auto-committed to local/remote Master Brain repository.
