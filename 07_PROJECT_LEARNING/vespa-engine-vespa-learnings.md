# Forensic Learning Record (Deep Inspection): vespa-engine/vespa

> **Canonical Artifact**: `07_PROJECT_LEARNING/vespa-engine-vespa-learnings.md`  
> **Source Platform**: GitHub ([https://github.com/vespa-engine/vespa](https://github.com/vespa-engine/vespa))  
> **Harvest Method**: Full-Spectrum Deep Extraction (Patches, Diffs, Source Code, Post-Mortems)  
> **Harvest Timestamp**: 2026-10-06T03:31:40.461Z  
> **Compliance State**: Free Tier Guaranteed | Strict Rate-Limit Backoff Honored  

---

## 1. Context & Architectural Overview
- **Repository / Resource**: `vespa-engine/vespa`
- **Description**: The AI search platform
- **Primary Language / Ecosystem**: Java
- **Discovered Manifests / Configurations**: README.md
- **Stars / Engagement**: 7119 stars

---

## 2. Multi-Dimensional 8-Axis Investigation & Real Code Patches

### D1: Architecture & Structural Boundaries
- Entry configurations inspected via direct stream: README.md.
- Evaluated system abstractions and modular contracts.

### Core Architecture Module: `client/go/internal/admin/clusterstate/cluster_state.go`
```
// Copyright Vespa.ai. Licensed under the terms of the Apache 2.0 license. See LICENSE in the project root.
// Author: arnej

// utilities to get and manipulate node states in a storage cluster
package clusterstate

import (
	"bytes"
	"encoding/json"
	"fmt"
	"strings"

	"github.com/vespa-engine/vespa/client/go/internal/admin/trace"
	"github.com/vespa-engine/vespa/client/go/internal/osutil"
)

// common struct used various places in the clustercontroller REST api:
type StateAndReason struct {
	State  string `json:"state"`
	Reason string `json:"reason"`
}

func (s *StateAndReason) writeTo(buf *strings.Builder) {
	buf.WriteString(s.State)
	if s.Reason != "" {
		buf.WriteString(" [reason: ")
		buf.WriteString(s.Reason)
		buf.WriteString("]")
	}
}

// cluster state as returned by the clustercontroller REST api:
type ClusterState struct {
	State struct {
		Generated StateAndReason `json:"generated"`
	} `json:"state"`
	Service map[string]struct {
		Node map[string]struct {
			Attributes struct {
				HierarchicalGroup string `json:"hierarchical-group"`
			} `json:"attributes"`
			State struct {
				Generated StateAndReason `json:"generated"`
				Unit      StateAndReason `json:"unit"`
				User      StateAndReason `json:"user"`
			} `json:"state"`
			Metrics struct {
				BucketCount             int `json:"bucket-count"`
				UniqueDocumentCount     int `json:"unique-document-count"`
				UniqueDocumentTotalSize int `json:"unique-document-total-size"`
			} `json:"metrics"`
		} `json:"node"`
	} `json:"service"`
	DistributionStates struct {
		Published struct {
			Baseline     string `json:"baseline"`
			BucketSpaces []struct {
				Name  string `json:"name"`
				State string `json:"state"`
			} `json:"bucket-spaces"`
		} `json:"published"`
	} `json:"distribution-states"`
}

func (cs *ClusterState) String() string {
	if cs == nil {
		return "nil"
	}
	var buf strings.Builder
	buf.WriteString("cluster state: ")
	cs.State.Generated.writeTo(&buf)
	for n, s := range cs.Service {
		buf.WriteString("\n  ")
		buf.WriteString(n)
		buf.WriteString(": [")
		for nn, node := range s.Node {
			buf.WriteString("\n    ")
			buf.WriteString(nn)
			buf.WriteString(" -> {generated: ")
			node.State.Generated.writeTo(&buf)
			buf.WriteString("} {unit: ")
			node.State.Unit.writeTo(&buf)
			buf.WriteString("} {user: ")
			node.State.User.writeTo(&buf)
			buf.WriteString("}")
		}
	}
	buf.WriteString("\n")
	return buf.String()
}

func (model *VespaModelConfig) getClusterState(cluster string) (*ClusterState, *ClusterControllerSpec) {
	errs := make([]string, 0)
	ccs := model.findClusterControllers()
	if len(ccs) == 0 {
		trace.Trace("No cluster controllers found in vespa model:", model)
		errs = append(errs, "No cluster controllers found in vespa model config")
	}
	for _, cc := range ccs {
		url := fmt.Sprintf("http://%s:%d/cluster/v2/%s/?recursive=true",
			cc.host, cc.port, cluster)
		var buf bytes.Buffer
		err := curlGet(url, &buf)
		if err != nil {
			errs = append(errs, "could not get: "+url)
			continue
		}
		codec := json.NewDecoder(&buf)
		var parsedJson ClusterState
		err = codec.Decode(&parsedJson)
		if err != nil {
			trace.Trace("Could not parse JSON >>>", buf.String(), "<<< from", url)
			errs = append(errs, "Bad JSON from "+url+" was: "+buf.String())
			continue
		}
		// success:
		return &parsedJson, &cc
	}
	// no success:
	osutil.ExitMsg(fmt.Sprint(errs))
	panic("unreachable")
}

```

### Core Architecture Module: `client/go/internal/admin/clusterstate/detect_model.go`
```
// Copyright Vespa.ai. Licensed under the terms of the Apache 2.0 license. See LICENSE in the project root.
// Author: arnej

// utilities to get and manipulate node states in a storage cluster
package clusterstate

import (
	"strconv"
	"strings"

	"github.com/vespa-engine/vespa/client/go/internal/admin/trace"
	"github.com/vespa-engine/vespa/client/go/internal/osutil"
	"github.com/vespa-engine/vespa/client/go/internal/vespa"
)

func getConfigServerHosts(s string) []string {
	if s != "" {
		return []string{s}
	}
	backticks := osutil.BackTicksForwardStderr
	got, err := backticks.Run(vespa.FindHome()+"/bin/vespa-print-default", "configservers")
	res := strings.Fields(got)
	if err != nil || len(res) < 1 {
		osutil.ExitMsg("bad configservers: " + got)
	}
	trace.Debug("found", len(res), "configservers:", res)
	return res
}

func getConfigServerPort(i int) int {
	if i > 0 {
		return i
	}
	backticks := osutil.BackTicksForwardStderr
	got, err := backticks.Run(vespa.FindHome()+"/bin/vespa-print-default", "configserver_rpc_port")
	if err == nil {
		i, err = strconv.Atoi(strings.TrimSpace(got))
	}
	if err != nil || i < 1 {
		osutil.ExitMsg("bad configserver_rpc_port: " + got)
	}
	trace.Debug("found configservers rpc port:", i)
	return i
}

func detectModel(opts *Options) *VespaModelConfig {
	vespa.LoadDefaultEnv()
	cfgHosts := getConfigServerHosts(opts.ConfigServerHost)
	cfgPort := getConfigServerPort(opts.ConfigServerPort)
	for _, cfgHost := range cfgHosts {
		args := []string{
			"-j",
			"-n", "cloud.config.model",
			"-i", "admin/model",
			"-p", strconv.Itoa(cfgPort),
			"-s", cfgHost,
		}
		backticks := osutil.BackTicksForwardStderr
		data, err := backticks.Run(vespa.FindHome()+"/bin/vespa-get-config", args...)
		parsed := parseModelConfig(data)
		if err == nil && parsed != nil {
			return parsed
		}
	}
	osutil.ExitMsg("could not get model config")
	panic("unreachable")
}

```

### Core Architecture Module: `client/go/internal/admin/clusterstate/get_cluster_state.go`
```
// Copyright Vespa.ai. Licensed under the terms of the Apache 2.0 license. See LICENSE in the project root.
// code for the "vespa-get-cluster-state" command
// Author: arnej

// utilities to get and manipulate node states in a storage cluster
package clusterstate

import (
	"fmt"
	"os"

	"github.com/fatih/color"
	"github.com/spf13/cobra"
	"github.com/vespa-engine/vespa/client/go/internal/admin/envvars"
	"github.com/vespa-engine/vespa/client/go/internal/admin/trace"
	"github.com/vespa-engine/vespa/client/go/internal/build"
)

func NewGetClusterStateCmd() *cobra.Command {
	var curOptions Options
	cmd := &cobra.Command{
		Use:               "vespa-get-cluster-state [-h] [-v] [-f] [-c cluster]",
		Short:             "Get the cluster state of a given cluster.",
		Long:              `Usage: get-cluster-state [Options]`,
		Version:           build.Version,
		Args:              cobra.MaximumNArgs(0),
		CompletionOptions: cobra.CompletionOptions{DisableDefaultCmd: true},
		Run: func(cmd *cobra.Command, args []string) {
			curOptions.NodeIndex = AllNodes
			runGetClusterState(&curOptions)
		},
	}
	addCommonOptions(cmd, &curOptions)
	return cmd
}

func runGetClusterState(opts *Options) {
	if opts.Silent {
		trace.Silent()
	}
	if opts.NoColors || os.Getenv(envvars.TERM) == "" {
		color.NoColor = true
	}
	trace.Debug("run getClusterState with: ", opts)
	m := detectModel(opts)
	trace.Debug("model:", m)
	sss := m.findSelectedServices(opts)
	clusters := make(map[string]*ClusterState)
	for _, s := range sss {
		trace.Debug("found service: ", s)
		if clusters[s.cluster] == nil {
			state, _ := m.getClusterState(s.cluster)
			trace.Debug("cluster ", s.cluster, state)
			clusters[s.cluster] = state
		}
	}
	for k, v := range clusters {
		globalState := v.State.Generated.State
		if globalState == "up" {
			fmt.Printf("Cluster %s:\n", k)
		} else {
			fmt.Printf("Cluster %s is %s. Too few nodes available.\n", k, color.HiRedString("%s", globalState))
		}
		for serviceType, serviceList := range v.Service {
			for dn, dv := range serviceList.Node {
				nodeState := dv.State.Generated.State
				if nodeState == "up" {
					fmt.Printf("%s/%s/%s: %v\n", k, serviceType, dn, nodeState)
				} else {
					fmt.Printf("%s/%s/%s: %v\n", k, serviceType, dn, color.HiRedString(nodeState))
				}
			}
		}
	}
}

```

### Core Architecture Module: `client/go/internal/admin/clusterstate/get_node_state.go`
```
// Copyright Vespa.ai. Licensed under the terms of the Apache 2.0 license. See LICENSE in the project root.
// code for the "vespa-get-node-state" command
// Author: arnej

// utilities to get and manipulate node states in a storage cluster
package clusterstate

import (
	"fmt"
	"os"
	"strconv"

	"github.com/fatih/color"
	"github.com/spf13/cobra"
	"github.com/vespa-engine/vespa/client/go/internal/admin/envvars"
	"github.com/vespa-engine/vespa/client/go/internal/admin/trace"
	"github.com/vespa-engine/vespa/client/go/internal/build"
)

const (
	longdesc = `Retrieve the state of one or more storage services from the fleet controller. Will list the state of the locally running services, possibly restricted to less by options.`
	header   = `Shows the various states of one or more nodes in a Vespa Storage cluster. There exist three different type of node states. They are:

  Unit state      - The state of the node seen from the cluster controller.
  User state      - The state we want the node to be in. By default up. Can be
                    set by administrators or by cluster controller when it
                    detects nodes that are behaving badly.
  Generated state - The state of a given node in the current cluster state.
                    This is the state all the other nodes know about. This
                    state is a product of the other two states and cluster
                    controller logic to keep the cluster stable.`
)

func NewGetNodeStateCmd() *cobra.Command {
	var curOptions Options
	cmd := &cobra.Command{
		Use:               "vespa-get-node-state [-h] [-v] [-c cluster] [-t type] [-i index]",
		Short:             "Get the state of a node.",
		Long:              longdesc + "\n\n" + header,
		Version:           build.Version,
		Args:              cobra.MaximumNArgs(0),
		CompletionOptions: cobra.CompletionOptions{DisableDefaultCmd: true},
		Run: func(cmd *cobra.Command, args []string) {
			runGetNodeState(&curOptions)
		},
	}
	addCommonOptions(cmd, &curOptions)
	cmd.Flags().StringVarP(&curOptions.NodeType, "type", "t", "",
		"Node type - can either be 'storage' or 'distributor'. If not specified, the operation will use state for both types.")
	cmd.Flags().IntVarP(&curOptions.NodeIndex, "index", "i", OnlyLocalNode,
		"Node index. If not specified, all nodes found running on this host will be used.")
	return cmd
}

func runGetNodeState(opts *Options) {
	if opts.Silent {
		trace.Silent()
	}
	if opts.NoColors || os.Getenv(envvars.TERM) == "" {
		color.NoColor = true
	}
	trace.Info(header)
	m := detectModel(opts)
	sss := m.findSelectedServices(opts)
	clusters := make(map[string]*ClusterState)
	for _, s := range sss {
		state := clusters[s.cluster]
		if state == nil {
			state, _ = m.getClusterState(s.cluster)
			clusters[s.cluster] = state
		}
		if state == nil {
			trace.Warning("no state for cluster: ", s.cluster)
			continue
		}
		if nodes, ok := state.Service[s.serviceType]; ok {
			for name, node := range nodes.Node {
				if name == strconv.Itoa(s.index) {
					fmt.Printf("\n%s/%s.%s:\n", s.cluster, s.serviceType, name)
					dumpState(node.State.Unit, "Unit")
					dumpState(node.State.Generated, "Generated")
					dumpState(node.State.User, "User")
				}
			}
		} else {
			trace.Warning("no nodes for service type: ", s.serviceType)
			continue
		}

	}
}

func dumpState(s StateAndReason, tag string) {
	if s.State != "up" {
		s.State = color.HiRedString(s.State)
	}
	fmt.Printf("%s: %s: %s\n", tag, s.State, s.Reason)
}

```

### Core Architecture Module: `client/go/internal/admin/clusterstate/known_state.go`
```
// Copyright Vespa.ai. Licensed under the terms of the Apache 2.0 license. See LICENSE in the project root.
// Author: arnej

// utilities to get and manipulate node states in a storage cluster
package clusterstate

import (
	"fmt"
)

type KnownState string

// these are all the valid node states:
const (
	StateUp          KnownState = "up"
	StateDown        KnownState = "down"
	StateMaintenance KnownState = "maintenance"
	StateRetired     KnownState = "retired"
)

// verify that a string is one of the known states:
func knownState(s string) (KnownState, error) {
	alternatives := []KnownState{
		StateUp,
		StateDown,
		StateMaintenance,
		StateRetired,
	}
	for _, v := range alternatives {
		if s == string(v) {
			return v, nil
		}
	}
	return KnownState("unknown"), fmt.Errorf("<Wanted State> must be one of %v, was %s\n", alternatives, s)
}

```

### Core Architecture Module: `client/go/internal/admin/clusterstate/model_config.go`
```
// Copyright Vespa.ai. Licensed under the terms of the Apache 2.0 license. See LICENSE in the project root.
// Author: arnej

// utilities to get and manipulate node states in a storage cluster
package clusterstate

import (
	"encoding/json"
	"sort"
	"strings"

	"github.com/vespa-engine/vespa/client/go/internal/admin/trace"
)

type VespaModelConfig struct {
	VespaVersion string `json:"vespaVersion"`
	Hosts        []struct {
		Name     string `json:"name"`
		Services []struct {
			Name        string `json:"name"`
			Type        string `json:"type"`
			Configid    string `json:"configid"`
			Clustertype string `json:"clustertype"`
			Clustername string `json:"clustername"`
			Index       int    `json:"index"`
			Ports       []struct {
				Number int    `json:"number"`
				Tags   string `json:"tags"`
			} `json:"ports"`
		} `json:"services"`
	} `json:"hosts"`
}

func (m *VespaModelConfig) String() string {
	if m == nil {
		return "nil"
	}
	var buf strings.Builder
	buf.WriteString("vespa version: ")
	buf.WriteString(m.VespaVersion)
	for _, h := range m.Hosts {
		buf.WriteString("\n  host: ")
		buf.WriteString(h.Name)
		for _, s := range h.Services {
			buf.WriteString("\n    service: ")
			buf.WriteString(s.Name)
			buf.WriteString(" type: ")
			buf.WriteString(s.Type)
			buf.WriteString(" cluster: ")
			buf.WriteString(s.Clustername)
		}
		buf.WriteString("\n")
	}
	buf.WriteString("\n")
	return buf.String()
}

type ClusterControllerSpec struct {
	host string
	port int
}

func parseModelConfig(input string) *VespaModelConfig {
	codec := json.NewDecoder(strings.NewReader(input))
	var parsedJson VespaModelConfig
	err := codec.Decode(&parsedJson)
	if err != nil {
		trace.Trace("could not decode JSON >>>", input, "<<< error:", err)
		return nil
	}
	return &parsedJson
}

func (m *VespaModelConfig) findClusterControllers() []ClusterControllerSpec {
	res := make([]ClusterControllerSpec, 0, 1)
	for _, h := range m.Hosts {
		for _, s := range h.Services {
			if s.Type == "container-clustercontroller" {
				for _, p := range s.Ports {
					if strings.Contains(p.Tags, "state") {
						res = append(res, ClusterControllerSpec{
							host: h.Name, port: p.Number,
						})
					}
				}
			}
		}
	}
	return res
}

func (m *VespaModelConfig) findSelectedServices(opts *Options) []serviceSpec {
	res := make([]serviceSpec, 0, 5)
	for _, h := range m.Hosts {
		for _, s := range h.Services {
			spec := serviceSpec{
				cluster:     s.Clustername,
				serviceType: s.Type,
				index:       s.Index,
				host:        h.Name,
			}
			if s.Type == "storagenode" {
				// simplify:
				spec.serviceType = "storage"
			}
			if opts.wantService(spec) {
				res = append(res, spec)
			}
		}
	}
	sort.Slice(res, func(i, j int) bool {
		a := res[i]
		b := res[j]
		if a.cluster != b.cluster {
			return a.cluster < b.cluster
		}
		if a.serviceType != b.serviceType {
			return a.serviceType < b.serviceType
		}
		if a.index != b.index {
			return a.index < b.index
		}
		return a.host < b.host
	})
	return res
}

```

### Core Architecture Module: `client/go/internal/admin/clusterstate/options.go`
```
// Copyright Vespa.ai. Licensed under the terms of the Apache 2.0 license. See LICENSE in the project root.
// Author: arnej

// utilities to get and manipulate node states in a storage cluster
package clusterstate

import (
	"strconv"
	"strings"

	"github.com/fatih/color"
	"github.com/spf13/cobra"
	"github.com/vespa-engine/vespa/client/go/internal/admin/trace"
	"github.com/vespa-engine/vespa/client/go/internal/vespa"
)

const (
	OnlyLocalNode int = -2
	AllNodes      int = -1
)

type Options struct {
	Verbose              int
	Silent               bool
	ShowHidden           showHiddenFlag
	Force                bool
	NoColors             bool
	SafeMode             bool
	NoWait               bool
	Cluster              string
	ConfigServerHost     string
	ConfigServerPort     int
	ConfigRequestTimeout int
	NodeType             string
	NodeIndex            int
	WantedState          string
}

func (v *Options) String() string {
	var buf strings.Builder
	buf.WriteString("command-line options [")
	if v.Verbose > 0 {
		buf.WriteString(" verbosity=")
		buf.WriteString(strconv.Itoa(v.Verbose))
	}
	if v.Silent {
		buf.WriteString(" silent")
	}
	if v.ShowHidden.showHidden {
		buf.WriteString(" show-hidden")
	}
	if v.Force {
		buf.WriteString(color.HiYellowString(" force=true"))
	}
	if v.NoColors {
		buf.WriteString(" no-colors")
	}
	if v.SafeMode {
		buf.WriteString(" safe-mode")
	}
	if v.NoWait {
		buf.WriteString(color.HiYellowString(" no-wait=true"))
	}
	if v.Cluster != "" {
		buf.WriteString(" cluster=")
		buf.WriteString(v.Cluster)
	}
	if v.ConfigServerHost != "" {
		buf.WriteString(" config-server=")
		buf.WriteString(v.ConfigServerHost)
	}
	if v.ConfigServerPort != 0 {
		buf.WriteString(" config-server-port=")
		buf.WriteString(strconv.Itoa(v.ConfigServerPort))
	}
	if v.ConfigRequestTimeout != 90 {
		buf.WriteString(" config-request-timeout=")
		buf.WriteString(strconv.Itoa(v.ConfigRequestTimeout))
	}
	if v.NodeType != "" {
		buf.WriteString(" node-type=")
		buf.WriteString(v.NodeType)
	}
	if v.NodeIndex >= 0 {
		buf.WriteString(" node-index=")
		buf.WriteString(strconv.Itoa(int(v.NodeIndex)))
	}
	if v.WantedState != "" {
		buf.WriteString(" WantedState=")
		buf.WriteString(v.WantedState)
	}
	buf.WriteString(" ]")
	return buf.String()
}

type serviceSpec struct {
	cluster     string
	serviceType string
	index       int
	host        string
}

func (o *Options) wantService(s serviceSpec) bool {
	if o.Cluster != "" && o.Cluster != s.cluster {
		return false
	}
	if o.NodeType == "" {
		if s.serviceType != "storage" && s.serviceType != "distributor" {
			return false
		}
	} else if o.NodeType != s.serviceType {
		return false
	}
	switch o.NodeIndex {
	case OnlyLocalNode:
		myName, _ := vespa.FindOurHostname()
		return s.host == "localhost" || s.host == myName
	case AllNodes:
		return true
	case s.index:
		return true
	default:
		return false
	}
}

func addCommonOptions(cmd *cobra.Command, curOptions *Options) {
	cmd.Flags().BoolVar(&curOptions.NoColors, "nocolors", false, "Do not use ansi colors in print.")
	cmd.Flags().BoolVarP(&curOptions.Silent, "silent", "s", false, "Create less verbose output.")
	cmd.Flags().CountVarP(&curOptions.Verbose, "verbose", "v", "Create more verbose output.")
	cmd.Flags().IntVar(&curOptions.ConfigRequestTimeout, "config-request-timeout", 90, "Timeout of config request")
	cmd.Flags().IntVar(&curOptions.ConfigServerPort, "config-server-port", 0, "Port to connect to config server on")
	cmd.Flags().StringVar(&curOptions.ConfigServerHost, "config-server", "", "Host name of config server to query")
	cmd.Flags().StringVarP(&curOptions.Cluster, "cluster", "c", "",
		"Cluster name. If unspecified, and vespa is installed on current node, information will be attempted auto-extracted")
	cmd.Flags().MarkHidden("config-request-timeout")
	cmd.Flags().MarkHidden("config-server-port")
	cmd.Flags().MarkHidden("nocolors")
	curOptions.ShowHidden.cmd = cmd
	flag := cmd.Flags().VarPF(&curOptions.ShowHidden, "show-hidden", "", "Also show hidden undocumented debug options.")
	flag.NoOptDefVal = "true"
	cobra.OnInitialize(func() {
		if curOptions.Silent {
			trace.Silent()
		} else {
			trace.AdjustVerbosity(curOptions.Verbose)
		}
	})
}

```

### Core Architecture Module: `client/go/internal/admin/clusterstate/run_curl.go`
```
// Copyright Vespa.ai. Licensed under the terms of the Apache 2.0 license. See LICENSE in the project root.
// Author: arnej

// utilities to get and manipulate node states in a storage cluster
package clusterstate

import (
	"bytes"
	"fmt"
	"io"
	"os"
	"os/exec"
	"strings"

	"github.com/vespa-engine/vespa/client/go/internal/admin/trace"
	"github.com/vespa-engine/vespa/client/go/internal/curl"
	"github.com/vespa-engine/vespa/client/go/internal/vespa"
)

func curlCommand(url string, args []string) (*curl.Command, error) {
	tls, err := vespa.LoadTlsConfig()
	if err != nil {
		return nil, err
	}
	if tls != nil && strings.HasPrefix(url, "http:") {
		url = "https:" + url[5:]
	}
	cmd, err := curl.RawArgs(url, args...)
	if err != nil {
		return nil, err
	}
	if tls != nil {
		if tls.DisableHostnameValidation {
			cmd, err = curl.RawArgs(url, append(args, "--insecure")...)
			if err != nil {
				return nil, err
			}
		}
		cmd.PrivateKey = tls.Files.PrivateKey
		cmd.Certificate = tls.Files.Certificates
		cmd.CaCertificate = tls.Files.CaCertificates
	}
	return cmd, err
}

func curlGet(url string, output io.Writer) error {
	cmd, err := curlCommand(url, commonCurlArgs())
	if err != nil {
		return err
	}
	trace.Trace("running curl:", cmd.String())
	err = cmd.Run(output, os.Stderr)
	return err
}

func curlPost(url string, input []byte) (string, error) {
	cmd, err := curlCommand(url, commonCurlArgs())
	if err != nil {
		return "", err
	}
	cmd.Method = "POST"
	cmd.Header("Content-Type", "application/json")
	cmd.WithBodyInput(bytes.NewReader(input))
	var out bytes.Buffer
	trace.Debug("POST input: " + string(input))
	trace.Trace("running curl:", cmd.String())
	err = cmd.Run(&out, os.Stderr)
	if err != nil {
		if ee, ok := err.(*exec.ExitError); ok {
			if ee.ProcessState.ExitCode() == 7 {
				return "", fmt.Errorf("HTTP request to %s failed, could not connect", url)
			}
		}
		return "", fmt.Errorf("HTTP request failed with curl %s", err.Error())
	}
	return out.String(), err
}

func commonCurlArgs() []string {
	return []string{
		"-A", "vespa-cluster-state",
		"--silent",
		"--show-error",
		"--connect-timeout", "30",
		"--max-time", "1200",
		"--write-out", "\n%{http_code}",
	}
}

```

### Core Architecture Module: `client/go/internal/admin/clusterstate/set_node_state.go`
```
// Copyright Vespa.ai. Licensed under the terms of the Apache 2.0 license. See LICENSE in the project root.
// code for the "vespa-set-node-state" command
// Author: arnej

// utilities to get and manipulate node states in a storage cluster
package clusterstate

import (
	"encoding/json"
	"fmt"
	"os"
	"strconv"

	"github.com/fatih/color"
	"github.com/spf13/cobra"
	"github.com/vespa-engine/vespa/client/go/internal/admin/envvars"
	"github.com/vespa-engine/vespa/client/go/internal/admin/trace"
	"github.com/vespa-engine/vespa/client/go/internal/build"
	"github.com/vespa-engine/vespa/client/go/internal/osutil"
)

const (
	usageSetNodeState = `vespa-set-node-state  [Options] <Wanted State> [Description]

Arguments:
 Wanted State : User state to set. This must be one of up, down, maintenance or retired.
 Description  : Give a reason for why you are altering the user state, which will show up in various admin tools. (Use double quotes to give a reason
                with whitespace in it)`

	longSetNodeState = `Set the user state of a node. This will set the generated state to the user state if the user state is "better" than the generated state that would
have been created if the user state was up. For instance, a node that is currently in initializing state can be forced into down state, while a node
that is currently down cannot be forced into retired state, but can be forced into maintenance state.`
)

func NewSetNodeStateCmd() *cobra.Command {
	var curOptions Options
	cmd := &cobra.Command{
		Use:     usageSetNodeState,
		Short:   "vespa-set-node-state [Options] <Wanted State> [Description]",
		Long:    longSetNodeState,
		Version: build.Version,
		Args: func(cmd *cobra.Command, args []string) error {
			switch {
			case len(args) < 1:
				return fmt.Errorf("Missing <Wanted State>")
			case len(args) > 2:
				return fmt.Errorf("Too many arguments, maximum is 2")
			}
			_, err := knownState(args[0])
			return err
		},
		CompletionOptions: cobra.CompletionOptions{DisableDefaultCmd: true},
		Run: func(cmd *cobra.Command, args []string) {
			runSetNodeState(&curOptions, args)
		},
	}
	addCommonOptions(cmd, &curOptions)
	cmd.Flags().BoolVarP(&curOptions.Force, "force", "f", false,
		"Force execution")
	cmd.Flags().BoolVarP(&curOptions.NoWait, "no-wait", "n", false,
		"Do not wait for node state changes to be visible in the cluster before returning.")
	cmd.Flags().BoolVarP(&curOptions.SafeMode, "safe", "a", false,
		"Only carries out state changes if deemed safe by the cluster controller.")
	cmd.Flags().StringVarP(&curOptions.NodeType, "type", "t", "",
		"Node type - can either be 'storage' or 'distributor'. If not specified, the operation will set state for both types.")
	cmd.Flags().IntVarP(&curOptions.NodeIndex, "index", "i", OnlyLocalNode,
		"Node index. If not specified, all nodes found running on this host will be used.")
	cmd.Flags().MarkHidden("no-wait")
	return cmd
}

func runSetNodeState(opts *Options, args []string) {
	if opts.Silent {
		trace.Silent()
	}
	if opts.NoColors || os.Getenv(envvars.TERM) == "" {
		color.NoColor = true
	}
	wanted, err := knownState(args[0])
	if err != nil {
		osutil.ExitErr(err)
	}
	reason := ""
	if len(args) > 1 {
		reason = args[1]
	}
	if !opts.Force && wanted == StateMaintenance && opts.NodeType != "storage" {
		fmt.Println(color.HiYellowString(
			`Setting the distributor to maintenance mode may have severe consequences for feeding!
Please specify -t storage to only set the storage node to maintenance mode, or -f to override this error.`))
		return
	}
	m := detectModel(opts)
	sss := m.findSelectedServices(opts)
	if len(sss) == 0 {
		fmt.Println(color.HiYellowString("Attempted setting of user state for no nodes"))
		return
	}
	for _, s := range sss {
		_, cc := m.getClusterState(s.cluster)
		cc.setNodeUserState(s, wanted, reason, opts)
	}
}

type SetNodeStateJson struct {
	State struct {
		User StateAndReason `json:"user"`
	} `json:"state"`
	ResponseWait string `json:"response-wait,omitempty"`
	Condition    string `json:"condition,omitempty"`
}

func splitResultCode(s string) (int, string) {
	for idx := len(s); idx > 0; {
		idx--
		if s[idx] == '\n' {
			resCode, err := strconv.Atoi(s[idx+1:])
			if err != nil {
				return -1, s
			}
			return resCode, s[:idx]
		}
	}
	return -1, s
}

func (cc *ClusterControllerSpec) setNodeUserState(s serviceSpec, wanted KnownState, reason string, opts *Options) error {
	var request SetNodeStateJson
	request.State.User.State = string(wanted)
	request.State.User.Reason = reason
	if opts.NoWait {
		request.ResponseWait = "no-wait"
	}
	if opts.SafeMode {
		request.Condition = "safe"
	}
	jsonBytes, err := json.Marshal(request)
	if err != nil {
		osutil.ExitErr(err)
	}
	url := fmt.Sprintf("http://%s:%d/cluster/v2/%s/%s/%d",
		cc.host, cc.port,
		s.cluster, s.serviceType, s.index)
	result, err := curlPost(url, jsonBytes)
	resCode, output := splitResultCode(result)
	if resCode < 200 || resCode >= 300 {
		fmt.Println(color.HiYellowString("failed with HTTP code %d", resCode))
		fmt.Println(output)
	} else {
		fmt.Print(output, "OK\n")
	}
	return err
}

```

### Core Architecture Module: `client/go/internal/admin/clusterstate/show_hidden.go`
```
// Copyright Vespa.ai. Licensed under the terms of the Apache 2.0 license. See LICENSE in the project root.
// Author: arnej

// utilities to get and manipulate node states in a storage cluster
package clusterstate

import (
	"strconv"

	"github.com/spf13/cobra"
	"github.com/spf13/pflag"
)

// handle CLI flag --show-hidden

type showHiddenFlag struct {
	showHidden bool
	cmd        *cobra.Command
}

func (v *showHiddenFlag) Type() string {
	return ""
}

func (v *showHiddenFlag) String() string {
	return strconv.FormatBool(v.showHidden)
}

func (v *showHiddenFlag) Set(val string) error {
	b, err := strconv.ParseBool(val)
	v.showHidden = b
	v.cmd.Flags().VisitAll(func(f *pflag.Flag) { f.Hidden = false })
	return err
}

func (v *showHiddenFlag) IsBoolFlag() bool { return true }

```

### Core Architecture Module: `client/go/internal/httputil/httputil.go`
```
// Copyright Vespa.ai. Licensed under the terms of the Apache 2.0 license. See LICENSE in the project root.
package httputil

import (
	"context"
	"crypto/tls"
	"crypto/x509"
	"fmt"
	"net"
	"net/http"
	"strings"
	"time"

	"github.com/vespa-engine/vespa/client/go/internal/build"
	"golang.org/x/net/http2"
)

// Client represents a HTTP client usable by the Vespa CLI.
type Client interface {
	Do(request *http.Request, timeout time.Duration) (response *http.Response, error error)
}

type defaultClient struct {
	client *http.Client
}

func (c *defaultClient) Do(request *http.Request, timeout time.Duration) (response *http.Response, error error) {
	if c.client.Timeout != timeout { // Set wanted timeout
		c.client.Timeout = timeout
	}
	if request.Header == nil {
		request.Header = make(http.Header)
	}
	request.Header.Set("User-Agent", fmt.Sprintf("Vespa CLI/%s", build.Version))
	return c.client.Do(request)
}

// ConfigureTLS configures the given client with given certificates and caCertificate. If trustAll is true, the client
// will skip verification of the certificate chain.
func ConfigureTLS(client Client, certificates []tls.Certificate, caCertificate []byte, trustAll bool) {
	c, ok := client.(*defaultClient)
	if !ok {
		return
	}
	var tlsConfig *tls.Config = nil
	if certificates != nil {
		tlsConfig = &tls.Config{
			Certificates:       certificates,
			MinVersion:         tls.VersionTLS12,
			InsecureSkipVerify: trustAll,
		}
		if caCertificate != nil {
			certs := x509.NewCertPool()
			certs.AppendCertsFromPEM(caCertificate)
			tlsConfig.RootCAs = certs
		}
	}
	if tr, ok := c.client.Transport.(*http.Transport); ok {
		tr.TLSClientConfig = tlsConfig
	} else if tr, ok := c.client.Transport.(*http2.Transport); ok {
		tr.TLSClientConfig = tlsConfig
	} else {
		panic(fmt.Sprintf("unknown transport type: %T", c.client.Transport))
	}
}

// ForceHTTP2 configures the given client exclusively with a HTTP/2 transport. The other options are passed to
// ConfigureTLS. If certificates is nil, the client will be configured with H2C (HTTP/2 over clear-text).
func ForceHTTP2(client Client, certificates []tls.Certificate, caCertificate []byte, trustAll bool) {
	c, ok := client.(*defaultClient)
	if !ok {
		return
	}
	var dialFunc func(ctx context.Context, network, addr string, cfg *tls.Config) (net.Conn, error)
	if certificates == nil {
		// No certificate, so force H2C (HTTP/2 over clear-text) by using a non-TLS Dialer
		dialer := net.Dialer{}
		dialFunc = func(ctx context.Context, network, addr string, cfg *tls.Config) (net.Conn, error) {
			return dialer.DialContext(ctx, network, addr)
		}
	}
	// Use HTTP/2 transport explicitly. Connection reuse does not work properly when using regular http.Transport, even
	// though it upgrades to HTTP/2 automatically
	// https://github.com/golang/go/issues/16582
	// https://github.com/golang/go/issues/22091
	c.client.Transport = &http2.Transport{
		DisableCompression: true,
		AllowHTTP:          true,
		DialTLSContext:     dialFunc,
	}
	ConfigureTLS(client, certificates, caCertificate, trustAll)
}

// NewClients creates a new HTTP client the given default timeout.
func NewClient(timeout time.Duration) Client {
	return &defaultClient{
		client: &http.Client{
			Timeout:   timeout,
			Transport: http.DefaultTransport,
		},
	}
}

// ParseHeader parses headers slice into a http.Header. Each element in the slice is expected to contain a string on
// the format "Header: Value".
func ParseHeader(headers []string) (http.Header, error) {
	h := make(http.Header)
	for _, header := range headers {
		kv := strings.SplitN(header, ":", 2)
		if len(kv) < 2 {
			return nil, fmt.Errorf("invalid header %q: missing colon separator", header)
		}
		k := kv[0]
		v := strings.TrimSpace(kv[1])
		h.Add(k, v)
	}
	return h, nil
}

```

### Core Architecture Module: `client/go/internal/ioutil/ioutil.go`
```
// Copyright Vespa.ai. Licensed under the terms of the Apache 2.0 license. See LICENSE in the project root.
// File utilities.
// Author: bratseth

package ioutil

import (
	"bytes"
	"encoding/json"
	"errors"
	"io"
	"math"
	"os"
	"path/filepath"
	"reflect"
	"strings"

	"github.com/fxamacker/cbor/v2"
)

// cborDecMode is configured to decode maps with string keys for JSON compatibility.
var cborDecMode cbor.DecMode

func init() {
	var err error
	cborDecMode, err = cbor.DecOptions{
		DefaultMapType:  reflect.TypeOf(map[string]interface{}(nil)),
		MaxNestedLevels: 1000,
	}.DecMode()
	if err != nil {
		panic("failed to initialize CBOR decoder mode: " + err.Error())
	}
}

// Exists returns true if the given path exists.
func Exists(path string) bool {
	info, err := os.Stat(path)
	return !errors.Is(err, os.ErrNotExist) && info != nil
}

// IsDir returns true if the given path points to an existing directory.
func IsDir(path string) bool {
	info, err := os.Stat(path)
	return !errors.Is(err, os.ErrNotExist) && info != nil && info.IsDir()
}

// IsFile returns true if the given path points to an existing regular file.
func IsFile(path string) bool {
	info, err := os.Stat(path)
	return !errors.Is(err, os.ErrNotExist) && info != nil && info.Mode().IsRegular()
}

// IsExecutable returns true if the given path points to an executable file.
func IsExecutable(path string) bool {
	info, err := os.Stat(path)
	return !errors.Is(err, os.ErrNotExist) &&
		info != nil &&
		info.Mode().IsRegular() &&
		((int(info.Mode()) & 0o111) == 0o111)
}

// ReaderToString Returns the content of reader as a string. Read errors are ignored.
func ReaderToString(reader io.Reader) string {
	var buffer strings.Builder
	io.Copy(&buffer, reader)
	return buffer.String()
}

// ReaderToBytes returns the content of a reader as a byte array. Read errors are ignored.
func ReaderToBytes(reader io.Reader) []byte {
	var buffer bytes.Buffer
	buffer.ReadFrom(reader)
	return buffer.Bytes()
}

// ReaderToJSON returns the contents of reader as indented JSON. Read errors are ignored.
func ReaderToJSON(reader io.Reader) string {
	bodyBytes, _ := io.ReadAll(reader)
	var prettyJSON bytes.Buffer
	parseError := json.Indent(&prettyJSON, bodyBytes, "", "    ")
	if parseError != nil { // Not JSON: Print plainly
		return string(bodyBytes)
	}
	return prettyJSON.String()
}

// StringToJSON returns string s as indented JSON.
func StringToJSON(s string) string { return ReaderToJSON(strings.NewReader(s)) }

// normalizeForJSON replaces non-finite float64 values (NaN, ±Inf) with their
// string representations, since encoding/json does not support these values.
func normalizeForJSON(v interface{}) interface{} {
	switch val := v.(type) {
	case float64:
		if math.IsInf(val, -1) {
			return "-Infinity"
		} else if math.IsInf(val, 1) {
			return "Infinity"
		} else if math.IsNaN(val) {
			return "NaN"
		}
	case map[string]interface{}:
		for k, mv := range val {
			val[k] = normalizeForJSON(mv)
		}
	case []interface{}:
		for i, sv := range val {
			val[i] = normalizeForJSON(sv)
		}
	}
	return v
}

// encodeJSON encodes v as JSON into buf without Go's default HTML escaping of <, >, and &.
func encodeJSON(buf *bytes.Buffer, v interface{}, indent bool) error {
	enc := json.NewEncoder(buf)
	enc.SetEscapeHTML(false)
	if indent {
		enc.SetIndent("", "    ")
	}
	return enc.Encode(v)
}

// CBORToJSON converts CBOR data to indented JSON string.
func CBORToJSON(data []byte) (string, error) {
	var v interface{}
	if err := cborDecMode.Unmarshal(data, &v); err != nil {
		return "", err
	}
	v = normalizeForJSON(v)
	var buf bytes.Buffer
	if err := encodeJSON(&buf, v, true); err != nil {
		return "", err
	}
	return strings.TrimSuffix(buf.String(), "\n"), nil
}

// CBORToJSONCompact converts CBOR data to compact JSON string.
func CBORToJSONCompact(data []byte) (string, error) {
	var v interface{}
	if err := cborDecMode.Unmarshal(data, &v); err != nil {
		return "", err
	}
	v = normalizeForJSON(v)
	var buf bytes.Buffer
	if err := encodeJSON(&buf, v, false); err != nil {
		return "", err
	}
	return strings.TrimSuffix(buf.String(), "\n"), nil
}

// AtomicWriteFile atomically writes data to filename.
func AtomicWriteFile(filename string, data []byte) error {
	dir := filepath.Dir(filename)
	tmpFile, err := os.CreateTemp(dir, "vespa")
	if err != nil {
		return err
	}
	defer os.Remove(tmpFile.Name())
	if _, err := tmpFile.Write(data); err != nil {
		return err
	}
	if err := tmpFile.Close(); err != nil {
		return err
	}
	return os.Rename(tmpFile.Name(), filename)
}

```


### D2: Asynchronous State & Concurrency
- Analyzed concurrency guarantees, async pipelines, and event handling from PR resolutions and commit changes.

### D3: Error Boundaries, Recovery & Rollbacks
- Exception handling patterns and defect resolutions extracted from closed production bug issues:
- **Issue #35165** (2025-11-19): **Segfault in BitVector::getNextFalseBit**
  *Symptoms*: **Describe the bug**  BitVector::GetNextBit heavily relies on guard bit as stop condition of [this cycle](https://github.com/vespa-engine/vespa/blob/c37f89a8c712d734f0f86fb98cfeb83cf346be16/searchlib/src/vespa/searchlib/common/bitvector.h#L383).  As guard bit is one, getNextFalseBit won't stop on the guard bit and continue iteration.  **To Reproduce**  Unit test below fails with `cmake3 . -DVESPA_USE_SANITIZER=address` build.  ```cc TEST(BitVector, guardbit_with_next_false) {     constexpr size_t kBitsPerByte = 8;     // I made BitVector::getAlignment() public for the purpose of this test.     constexpr size_t kBitSize = BitVector::getAlignment() * kBitsPerByte - 1;      // For the vector of aligned size contains only ones,     // bv->getNextFalseBit(0) could read beyond the allocated memory bound.     auto bv = BitVector::create(kBitSize);     for (uint32_t i = 0; i < kBitSize; ++i) {         bv->setBit(i);     }     EXPECT_EQ(bv->getNextFalseBit(0), kBitSize); } ```  **Vespa version** I checked on 8.558.9, but the issue should be reproducible on master.  **Additional context** I haven't tried to reproduce it on the application layer, but it should be doable.
  **Post-Mortem & Fix Analysis**:
  > This has been fixed in Vespa 8.610.20

- **Issue #34514** (2025-08-11): **nearestNeighbor query (with filter) return docs without field embedding value**
  *Symptoms*: **Describe the bug** for field build hnsw index, some doc may not have the value. the nearestNeighbor query run on this field and return the doc which has no embedding value for the field.  bug code  1. https://github.com/vespa-engine/vespa/blob/5974323e8fdbeda031131fe826ed2778e076b2a0/searchlib/src/vespa/searchlib/queryeval/nearest_neighbor_distance_heap.h#L23 2. https://github.com/vespa-engine/vespa/blob/5974323e8fdbeda031131fe826ed2778e076b2a0/searchlib/src/vespa/searchlib/queryeval/exact_nearest_neighbor_iterator.cpp#L53 3. https://github.com/vespa-engine/vespa/blob/5974323e8fdbeda031131fe826ed2778e076b2a0/searchlib/src/vespa/searchlib/tensor/distance_calculator.h#L70  when fallback to exact search.  **To Reproduce**  schema  ``` schema test_ann {      document test_ann {          field docid type long {             indexing: attribute | summary         }          field embed1 type tensor<float>(x[2]) {             indexing: attribute | index | summary             attribute {                 distance-metric: angular             }             index {                 hnsw {                     max-links-per-node: 32                     neighbors-to-explore-at-insert: 400                 }             }         }          field embed2 type tensor<float>(x[2]) {             indexing: attribute | index | summary             attribute {                 distance-metric: angular             }             index {                 hnsw {                     max-links-per-node: 32   
  **Post-Mortem & Fix Analysis**:
  > Dear @luoyetx,  Thank you for reporting this!

- **Issue #34338** (2025-07-01): **Predicate field with more than 255 values crashes content nodes**
  *Symptoms*: **Describe the bug** Seems that there's a hard [limit](https://github.com/vespa-engine/vespa/blob/d5d8cf249c59c5bbcc0828b6890ab1a15576cc2d/searchlib/src/vespa/searchlib/attribute/predicate_attribute.cpp#L292) on the predicate values which is not enforced during feeding time. As a result once a doc with exceeded values is indexed, the content nodes holding the pending document crash until the index is manually cleared.  E.g. ``` [2025-06-11 06:35:06.289] WARNING searchnode       stderr	vespa-proton-bin: /workspace/build/buildkite/vespaai/vespa-engine-vespa/searchlib/src/vespa/searchlib/attribute/predicate_attribute.cpp:292: void search::PredicateAttribute::updateValue(uint32_t, const document::PredicateFieldValue&): Assertion `result.min_feature <= MAX_MIN_FEATURE' failed. [2025-06-11 06:35:06.289] WARNING searchnode       stderr	*** SIGABRT received at time=1749623706 on cpu 32 *** [2025-06-11 06:35:06.302] WARNING searchnode       stderr	PC: @     0x7f102b84ea4f  (unknown)  raise [2025-06-11 06:35:06.302] WARNING searchnode       stderr	    @   0x4d524554474953  (unknown)  (unknown) ```  **To Reproduce** Steps to reproduce the behavior: When feeding a document with predicate field of more than 255 values the feeding goes through leading to the persistent crash.  **Expected behavior** Feeding should be rejected, and/or limit should be increased.  **Vespa version** 8.457.32 
  **Post-Mortem & Fix Analysis**:
  > The assert should only be triggered if a predicate requires at more than 255 values to match. It's limited by the use of an 8-bit data type in a index data structure. Note that use of range attributes in the predicate will implicitly count as multiple values. How ranges are expanded to values can be controlled through [predicate field configuration](https://docs.vespa.ai/en/predicate-fields.html#upper-and-lower-bounds) with `arity`, `lower-bound` and `upper-bound`.  It should be relatively straight forward to fail such feeds gracefully, either while processing the predicate in the container or in proton.  It possible to support larger predicates by modifying the [min_feature](https://github.com/vespa-engine/vespa/blob/d5d8cf249c59c5bbcc0828b6890ab1a15576cc2d/searchlib/src/vespa/searchlib/attribute/predicate_attribute.h#L88-L89) to use a bigger integer type. It may negatively impact performance though.
  > Thanks for looking into this! And good to know about the limit increase option, though I'm not sure it's worth it for our use case.  We've added a protection on our end due to the severe impact, but definitely would be better for the platform to have this considering the low LOE 🙏 
  > We're are working a patch that will fail out the document operation instead.  Let us know if you later determine that the 255 limit is prohibitive for your use case. Feel free to create a new GH issue if so.

- **Issue #33206** (2025-02-12): **An exception is thrown when when a raw type attribute is added to ranking profile summary features**
  *Symptoms*: **Describe the bug** When we query with tmp_msgpacked ranking profile content nodes throw an exception, after which they restart and then join the back the cluster as normal. This is possibly due to this bit attribute(embedding_msgpacked) in the ranking profile. ``` what():  UnsupportedOperationException: The function is not implemented for attribute 'embedding_msgpacked' of type 'search::attribute::SingleRawAttribute'. ``` Everything works fine if we use a document-summary `msgpacked_emb`.    **To Reproduce** create a schema ``` schema test_index {     document test_index {          field item_id type string {             indexing: summary | attribute             attribute: fast-search             rank: filter             dictionary {                 hash                 cased             }             match: cased         }                  field embedding_msgpacked type raw {             indexing: summary | attribute         }                  field embedding type tensor<int8>(d0[512]) {             indexing: attribute | index | summary             attribute {                 distance-metric: innerproduct             }             index {                 hnsw {                     max-links-per-node: 16                     neighbors-to-explore-at-insert: 50                 }             }         }     }      document-summary empty {       summary item_id {           source: item_id       }     }      	 rank-profile tmp_msgpacked inherits unranked {        summary-features
  **Post-Mortem & Fix Analysis**:
  > Fixed in Vespa 8.475.11.  Using an attribute field of type `raw` is not supported in the `attribute()` rank feature. With the fix this will fail already during application deployment.

- **Issue #33088** (2025-01-28): **Same name fields conflict in parent/child documents**
  *Symptoms*: **Describe the bug** in parent/child related schemas if I import field with same name, deployment fails. Here is minimal example      **To Reproduce** ``` users.sd: schema users {     document users {         field id type long {             indexing: summary | attribute         }         field city_ref type reference<cities> {             indexing: attribute         }     }       import field city_ref.id as city_id {} }  cities.sd: schema cities {     document cities {         field id type int {             indexing: summary | attribute         }     } }  service.xml: <?xml version="1.0" encoding="UTF-8" standalone="yes"?> <services version="1.0">   <container id="default" version="1.0">     <search>     </search>     <document-api/>     <accesslog type="disabled"/>     <model-evaluation/>   </container>    <content id="content" version="1.0">     <redundancy>1</redundancy>     <documents>       <document type="cities" mode="index" global="true" />       <document type="users" mode="index" />     </documents>   </content> </services> ```  gives error: ``` For schema 'users', field 'id': Incompatible types. Expected long for attribute 'id', got int. ```  So seems users.id and cities.id fields conflicting. If i remove this line `import field city_ref.id as city_id {}` deployment completes without error.  **Expected behavior** I expect that fields would not conflict.  **Environment (please complete the following infor
  **Post-Mortem & Fix Analysis**:
  > Fixed in Vespa 8.466.14.

- **Issue #32475** (2024-10-07): **ArrayIndexOutOfBoundsException during feeding of large JSON Files containing multiple documents**
  *Symptoms*: I encountered an ArrayIndexOutOfBoundsException while feeding a large JSON file (approx 1GB) containing multiple json documents to a Vespa cluster. The error occurs during the batch feeding process. I am ingesting around 500 such json files of approx. 1GB each but getting errors on a few.  **Error description:** The error log indicates an ArrayIndexOutOfBoundsException during the batch feeding process. The exception is thrown when attempting to copy an array, and the destination index exceeds the array`s bounds.  This issue occurs within the JsonFileFeeder class, specifically in the batchFeed method.  **Error log:**  [FeedThread-14] JsonFileFeeder - ERROR: Error while batch feeding file: local/documents/slice_doc2_1_00004.json java.util.concurrent.CompletionException: ai.vespa.feed.client.FeedException: java.lang.ArrayIndexOutOfBoundsException: arraycopy: last destination index 150862649 out of bounds for byte[134217728]     at java.util.concurrent.CompletableFuture.reportJoin(CompletableFuture.java:413) ~[?:?]     at java.util.concurrent.CompletableFuture.join(CompletableFuture.java:2118) ~[?:?] Caused by: ai.vespa.feed.client.FeedException: java.lang.ArrayIndexOutOfBoundsException: arraycopy: last destination index 150862649 out of bounds for byte[134217728]     at ai.vespa.feed.client.JsonFeeder.wrapException(JsonFeeder.java:229) ~[vespa-feed-client-api-8.301.19.jar:?]     at ai.vespa.feed.client.JsonFeeder.lambda$feedMany$7(JsonFeeder.java:180) ~[vespa-feed-cl
  **Post-Mortem & Fix Analysis**:
  > there was a bug when growing the buffer; did you have very large documents in the feed?  it should be fixed in the next release.
  > Yes, we have large documents in JSON files. I will test the fix with the next release. Thanks
  > @arnej27959  can you share the fix version please? cc: @bratseth 

- **Issue #32353** (2024-10-03): **From sources clause not working as expected in yql**
  *Symptoms*: **Describe the bug** select * from sources * and select * from sources doc1, doc2 returning different results  **To Reproduce** Steps to reproduce the behavior: Difficult to reproduce. It started happening today and we started seeing issues on some queries.  **Expected behaviour** There are only two content clusters which are doc1, doc2 but while running the query we are getting correct count only when we use *. We can see results are coming from doc2 but finding 0 docs when using select * from doc2   **Environment (please complete the following information):**  - RHEL 8  - Podman    **Vespa version** 8.332.5  **Additional context** I have seen this issue mostly in case of multi content clusters. 
  **Post-Mortem & Fix Analysis**:
  > Do you have one, or more content clusters and what are their ids?
  > We have 2 content clusters doc1 and doc2 while querying we query like select * from doc1.* ,doc2.* <query> but it’s giving 0 results whereas when we do the same query with select * from sources * its giving results.
  > You have two content clusters with id's "doc1" and "doc2" and they have schemas named "doc1" and "doc2" respectively?

- **Issue #32016** (2024-08-02): **Support uploading binary files in deploy API**
  *Symptoms*: From Slack:  > Using `PUT /application/v2/tenant/default/session/[session-id]/content/[path]` endpoint, the file content got changed.  It looks like the binary content is read into a string and persisted in a file, the md5 hash is also based on the string content, which is not correct.   Also: > When I use the prepareandactivate endpoint to upload the zip file. The binary files included in the zip file is persisted to file correctly. However, the md5 hash is still calculated based on the string content, which is not correct.  
  **Post-Mortem & Fix Analysis**:
  > Implemented in https://github.com/vespa-engine/vespa/pull/32055, released in 8.382.22

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

### Incident Patch 1: `cd228533` (2026-10-05)
**Commit Message**: Merge pull request #38078 from vespa-engine/andreer/fix-http-byte-metrics

Fix serverBytesSent/serverBytesReceived

**File**: `container-disc/src/main/java/com/yahoo/jdisc/http/server/jetty/JettyRequestContentReader.java` (modified, +1/-1)
```diff
@@ -167,7 +167,7 @@ public void failed(Throwable t) {
                             log.log(Level.FINE, t, () -> "Failed to write chunk to content channel");
                         }
                     });
-                    metricReporter.successfulWrite(bytesRemaining);
+                    metricReporter.successfulRead(bytesRemaining);
                 } catch (Throwable t) {
                     chunkReleaser.complete(null);
                     log.log(Level.FINE, t, () -> "Failed to invoke content channel write");
```

**File**: `container-disc/src/main/java/com/yahoo/jdisc/http/server/jetty/JettyResponseWriter.java` (modified, +3/-1)
```diff
@@ -164,12 +164,14 @@ private void performWrite(WriteTask task) {
                 }
 
                 canWrite = false;
+                // Jetty consumes the buffer, so its size must be captured before the write
+                int bytesToSend = task.buf != null ? task.buf.remaining() : 0;
                 jettyResponse.write(task.buf == null, Objects.requireNonNullElse(task.buf, EMPTY_BUFFER), new Callback() {
                     @Override
                     public void succeeded() {
                         if (task.buf == null) responseCompletion.complete(null);
                         completeAndFinishTask(task.handler, CompletionHandler::completed);
-                        if (task.buf != null) metricReporter.successfulWrite(task.buf.remaining());
+                        if (task.buf != null) metricReporter.successfulWrite(bytesToSend);
                     }
 
                     @Override
```

**File**: `container-disc/src/test/java/com/yahoo/jdisc/http/server/jetty/HttpServerIT.java` (modified, +51/-0)
```diff
@@ -47,6 +47,7 @@
 import org.junit.jupiter.api.Disabled;
 import org.junit.jupiter.api.Test;
 import org.junit.jupiter.api.io.TempDir;
+import org.mockito.ArgumentCaptor;
 import org.mockito.Mockito;
 
 import javax.net.ssl.SSLContext;
@@ -951,6 +952,32 @@ void httpComplianceChecksCanBeDisabled() throws Exception {
         assertTrue(driver.close());
     }
 
+    @Test
+    void requireThatRequestAndResponseBytesAreReported() throws Exception {
+        var metricConsumer = new MetricConsumerMock();
+        int requestSize = 12345;
+        int responseSize = 6789;
+        JettyTestDriver driver = JettyTestDriver.newConfiguredInstance(
+                new ReadThenRespondRequestHandler(responseSize),
+                new ServerConfig.Builder(),
+                new ConnectorConfig.Builder(),
+                binder -> binder.bind(MetricConsumer.class).toInstance(metricConsumer.mockitoMock()));
+        driver.client().newPost("/status.html")
+                .setBinaryContent(new byte[requestSize])
+                .execute()
+                .expectStatusCode(is(OK));
+        assertTrue(driver.close());
+
+        assertEquals(requestSize, sumOfSetValues(metricConsumer, MetricDefinitions.NUM_BYTES_RECEIVED));
+        assertEquals(responseSize, sumOfSetValues(metricConsumer, MetricDefinitions.NUM_BYTES_SENT));
+    }
+
+    private static long sumOfSetValues(MetricConsumerMock metricConsumer, String name) {
+        var values = ArgumentCaptor.forClass(Number.class);
+        verify(metricConsumer.mockitoMock(), atLeast(1)).set(eq(name), values.capture(), any());
+        return values.getAllValues().stream().mapToLong(Number::longValue).sum();
+    }
+
     @Test
     void requestHeaderValueContainingCommaIsInterpretedAsASingleValue() throws IOException {
         JettyTestDriver driver = JettyTestDriver.newInstance(new RequestHeaderEchoingHandler("X-Foo"));
@@ -1132,6 +1159,30 @@ public ContentChannel handleRequest(Request request, ResponseHandler handler) {
         }
     }
 
+    private static class ReadThenRespondRequestHandler extends AbstractRequestHandler implements ContentChannel {
+
+        private final int responseSize;
+        private ResponseHandler responseHandler;
+
+        ReadThenRespondRequestHandler(int responseSize) { this.responseSize = responseSize; }
+
+        @Override
+        public synchronized ContentChannel handleRequest(Request request, ResponseHandler handler) {
+            this.responseHandler = handler;
+            return this;
+        }
+
+        @Override public void write(ByteBuffer buf, CompletionHandler ch) { ch.completed(); }
+
+        @Override
+        public synchronized void close(CompletionHandler completionHandler) {
+            completionHandler.completed();
+            var content = responseHandler.handleResponse(new Response(OK));
+            content.write(ByteBuffer.wrap(new byte[responseSize]), null);
+            content.close(null);
+        }
+    }
+
     private static class OkRequestHandler extends AbstractRequestHandler {
         @Override
         public ContentChannel handleRequest(Request request, ResponseHandler handler) {
```

---

### Incident Patch 2: `6a481310` (2026-10-05)
**Commit Message**: Merge pull request #38084 from vespa-engine/toregge/fix-prepare-for-less-waiting-in-flush-target-init-flush

Call real member function in parent class instead of compat shim.

**File**: `searchcore/src/vespa/searchcore/proton/docsummary/summarymanager.cpp` (modified, +3/-2)
```diff
@@ -81,8 +81,9 @@ void ShrinkSummaryLidSpaceFlushTarget::init_flush(SerialNum
                                                   TaskPromise                          task_promise) {
     std::promise<Task::UP> promise;
     std::future<Task::UP>  future = promise.get_future();
-    _summaryService.execute(makeLambdaTask(
-        [&]() { promise.set_value(ShrinkLidSpaceFlushTarget::initFlush(currentSerial, flush_token)); }));
+    _summaryService.execute(makeLambdaTask([&, promise(std::move(promise))]() mutable {
+        ShrinkLidSpaceFlushTarget::init_flush(currentSerial, flush_token, std::move(promise));
+    }));
     task_promise.set_value(future.get());
 }
 
```

---

### Incident Patch 3: `d08c0857` (2026-10-05)
**Commit Message**: fix serverBytesSent and serverBytesReceived metrics

Request bytes were reported as sent, response bytes were measured
after Jetty consumed the buffer (~0), and serverBytesReceived was
never reported. Regression from the Jetty 12 upgrade.

**File**: `container-disc/src/main/java/com/yahoo/jdisc/http/server/jetty/JettyRequestContentReader.java` (modified, +1/-1)
```diff
@@ -167,7 +167,7 @@ public void failed(Throwable t) {
                             log.log(Level.FINE, t, () -> "Failed to write chunk to content channel");
                         }
                     });
-                    metricReporter.successfulWrite(bytesRemaining);
+                    metricReporter.successfulRead(bytesRemaining);
                 } catch (Throwable t) {
                     chunkReleaser.complete(null);
                     log.log(Level.FINE, t, () -> "Failed to invoke content channel write");
```

**File**: `container-disc/src/main/java/com/yahoo/jdisc/http/server/jetty/JettyResponseWriter.java` (modified, +3/-1)
```diff
@@ -164,12 +164,14 @@ private void performWrite(WriteTask task) {
                 }
 
                 canWrite = false;
+                // Jetty consumes the buffer, so its size must be captured before the write
+                int bytesToSend = task.buf != null ? task.buf.remaining() : 0;
                 jettyResponse.write(task.buf == null, Objects.requireNonNullElse(task.buf, EMPTY_BUFFER), new Callback() {
                     @Override
                     public void succeeded() {
                         if (task.buf == null) responseCompletion.complete(null);
                         completeAndFinishTask(task.handler, CompletionHandler::completed);
-                        if (task.buf != null) metricReporter.successfulWrite(task.buf.remaining());
+                        if (task.buf != null) metricReporter.successfulWrite(bytesToSend);
                     }
 
                     @Override
```

**File**: `container-disc/src/test/java/com/yahoo/jdisc/http/server/jetty/HttpServerIT.java` (modified, +51/-0)
```diff
@@ -47,6 +47,7 @@
 import org.junit.jupiter.api.Disabled;
 import org.junit.jupiter.api.Test;
 import org.junit.jupiter.api.io.TempDir;
+import org.mockito.ArgumentCaptor;
 import org.mockito.Mockito;
 
 import javax.net.ssl.SSLContext;
@@ -951,6 +952,32 @@ void httpComplianceChecksCanBeDisabled() throws Exception {
         assertTrue(driver.close());
     }
 
+    @Test
+    void requireThatRequestAndResponseBytesAreReported() throws Exception {
+        var metricConsumer = new MetricConsumerMock();
+        int requestSize = 12345;
+        int responseSize = 6789;
+        JettyTestDriver driver = JettyTestDriver.newConfiguredInstance(
+                new ReadThenRespondRequestHandler(responseSize),
+                new ServerConfig.Builder(),
+                new ConnectorConfig.Builder(),
+                binder -> binder.bind(MetricConsumer.class).toInstance(metricConsumer.mockitoMock()));
+        driver.client().newPost("/status.html")
+                .setBinaryContent(new byte[requestSize])
+                .execute()
+                .expectStatusCode(is(OK));
+        assertTrue(driver.close());
+
+        assertEquals(requestSize, sumOfSetValues(metricConsumer, MetricDefinitions.NUM_BYTES_RECEIVED));
+        assertEquals(responseSize, sumOfSetValues(metricConsumer, MetricDefinitions.NUM_BYTES_SENT));
+    }
+
+    private static long sumOfSetValues(MetricConsumerMock metricConsumer, String name) {
+        var values = ArgumentCaptor.forClass(Number.class);
+        verify(metricConsumer.mockitoMock(), atLeast(1)).set(eq(name), values.capture(), any());
+        return values.getAllValues().stream().mapToLong(Number::longValue).sum();
+    }
+
     @Test
     void requestHeaderValueContainingCommaIsInterpretedAsASingleValue() throws IOException {
         JettyTestDriver driver = JettyTestDriver.newInstance(new RequestHeaderEchoingHandler("X-Foo"));
@@ -1132,6 +1159,30 @@ public ContentChannel handleRequest(Request request, ResponseHandler handler) {
         }
     }
 
+    private static class ReadThenRespondRequestHandler extends AbstractRequestHandler implements ContentChannel {
+
+        private final int responseSize;
+        private ResponseHandler responseHandler;
+
+        ReadThenRespondRequestHandler(int responseSize) { this.responseSize = responseSize; }
+
+        @Override
+        public synchronized ContentChannel handleRequest(Request request, ResponseHandler handler) {
+            this.responseHandler = handler;
+            return this;
+        }
+
+        @Override public void write(ByteBuffer buf, CompletionHandler ch) { ch.completed(); }
+
+        @Override
+        public synchronized void close(CompletionHandler completionHandler) {
+            completionHandler.completed();
+            var content = responseHandler.handleResponse(new Response(OK));
+            content.write(ByteBuffer.wrap(new byte[responseSize]), null);
+            content.close(null);
+        }
+    }
+
     private static class OkRequestHandler extends AbstractRequestHandler {
         @Override
         public ContentChannel handleRequest(Request request, ResponseHandler handler) {
```

---

### Incident Patch 4: `7984fb1d` (2026-10-05)
**Commit Message**: Merge pull request #38054 from buinauskas/reserve-hash-dictionary-read-snapshot

Reserve vector capacity when filling hash dictionary read snapshot

**File**: `vespalib/src/vespa/vespalib/datastore/unique_store_hash_dictionary_read_snapshot.hpp` (modified, +1/-0)
```diff
@@ -15,6 +15,7 @@ UniqueStoreHashDictionaryReadSnapshot<HashDictionaryT>::UniqueStoreHashDictionar
 }
 
 template <typename HashDictionaryT> void UniqueStoreHashDictionaryReadSnapshot<HashDictionaryT>::fill() {
+    _refs.reserve(_hash.size());
     _hash.foreach_key([this](EntryRef ref) { _refs.push_back(ref); });
 }
 
```

---

### Incident Patch 5: `eb49a776` (2026-10-04)
**Commit Message**: fix(deps): update dependency org.codehaus.woodstox:stax2-api to v4.3.1

**File**: `dependency-versions/pom.xml` (modified, +1/-1)
```diff
@@ -165,7 +165,7 @@
         <velocity.tools.vespa.version>3.1</velocity.tools.vespa.version>
         <wiremock.vespa.version>3.13.2</wiremock.vespa.version>
         <woodstox.vespa.version>7.3.0</woodstox.vespa.version>
-        <stax2-api.vespa.version>4.2.2</stax2-api.vespa.version>
+        <stax2-api.vespa.version>4.3.1</stax2-api.vespa.version>
         <xerces.vespa.version>2.12.2</xerces.vespa.version>
         <zero-allocation-hashing.vespa.version>0.27ea1</zero-allocation-hashing.vespa.version>
         <zookeeper.client.vespa.version>3.9.5</zookeeper.client.vespa.version>
```

---

### Incident Patch 6: `91f6e866` (2026-10-04)
**Commit Message**: fix(deps): update dependency org.xerial.snappy:snappy-java to v1.1.10.10

**File**: `dependency-versions/pom.xml` (modified, +1/-1)
```diff
@@ -157,7 +157,7 @@
         <re2j.vespa.version>1.8</re2j.vespa.version>
         <reactor-core.vespa.version>3.8.7</reactor-core.vespa.version>
         <spifly.vespa.version>1.3.8</spifly.vespa.version>
-        <snappy.vespa.version>1.1.10.8</snappy.vespa.version>
+        <snappy.vespa.version>1.1.10.10</snappy.vespa.version>
         <snakeyaml.vespa.version>2.4</snakeyaml.vespa.version>
         <surefire.vespa.version>3.5.6</surefire.vespa.version>
         <testcontainers.vespa.version>1.21.4</testcontainers.vespa.version>
```

---

### Incident Patch 7: `b719ee59` (2026-10-04)
**Commit Message**: fix(deps): update dependency org.apache.commons:commons-lang3 to v3.21.0

**File**: `dependency-versions/pom.xml` (modified, +1/-1)
```diff
@@ -78,7 +78,7 @@
         <commons-collections.vespa.version>3.2.2</commons-collections.vespa.version>
         <commons-digester.vespa.version>3.2</commons-digester.vespa.version>
         <commons-io.vespa.version>2.22.0</commons-io.vespa.version>
-        <commons-lang3.vespa.version>3.20.0</commons-lang3.vespa.version>
+        <commons-lang3.vespa.version>3.21.0</commons-lang3.vespa.version>
         <commons-logging.vespa.version>1.4.0</commons-logging.vespa.version>  <!-- Bindings exported by jdisc through jcl-over-slf4j. -->
         <commons.math3.vespa.version>3.6.1</commons.math3.vespa.version>
         <commons-compress.vespa.version>1.28.0</commons-compress.vespa.version>
```

---

### Incident Patch 8: `c3782626` (2026-10-04)
**Commit Message**: fix(deps): update mockito monorepo to v5.24.0

**File**: `dependency-versions/pom.xml` (modified, +1/-1)
```diff
@@ -128,7 +128,7 @@
         <maven-xml-impl.vespa.version>4.0.0-beta-5</maven-xml-impl.vespa.version>
         <mcp-sdk.vespa.version>0.18.4</mcp-sdk.vespa.version>
         <micrometer.vespa.version>1.17.1</micrometer.vespa.version>
-        <mockito.vespa.version>5.23.0</mockito.vespa.version>
+        <mockito.vespa.version>5.24.0</mockito.vespa.version>
         <mojo-executor.vespa.version>2.4.1</mojo-executor.vespa.version>
         <netty.vespa.version>4.2.18.Final</netty.vespa.version>
         <netty-tcnative.vespa.version>2.0.84.Final</netty-tcnative.vespa.version>
```

**File**: `integration/logstash-plugins/logstash-output-vespa/build.gradle` (modified, +1/-1)
```diff
@@ -70,7 +70,7 @@ dependencies {
     testImplementation 'org.jruby:jruby-core:10.1.2.0'
     testImplementation "org.apache.logging.log4j:log4j-core:${log4jVersion}"
     testImplementation 'junit:junit:4.13.2'
-    testImplementation 'org.mockito:mockito-core:5.23.0'
+    testImplementation 'org.mockito:mockito-core:5.24.0'
     testImplementation("com.yahoo.vespa:vespa-feed-client:${VESPA_VERSION}")
     testImplementation fileTree(dir: LOGSTASH_CORE_PATH, include: "**/logstash-core.jar")
     testImplementation 'com.fasterxml.jackson.dataformat:jackson-dataformat-cbor:2.22.3'
```

---

### Incident Patch 9: `1b1c0c41` (2026-10-04)
**Commit Message**: fix(deps): update dependency com.fasterxml.woodstox:woodstox-core to v7.3.0

**File**: `dependency-versions/pom.xml` (modified, +1/-1)
```diff
@@ -164,7 +164,7 @@
         <velocity.vespa.version>2.4.1</velocity.vespa.version>
         <velocity.tools.vespa.version>3.1</velocity.tools.vespa.version>
         <wiremock.vespa.version>3.13.2</wiremock.vespa.version>
-        <woodstox.vespa.version>7.2.2</woodstox.vespa.version>
+        <woodstox.vespa.version>7.3.0</woodstox.vespa.version>
         <stax2-api.vespa.version>4.2.2</stax2-api.vespa.version>
         <xerces.vespa.version>2.12.2</xerces.vespa.version>
         <zero-allocation-hashing.vespa.version>0.27ea1</zero-allocation-hashing.vespa.version>
```

---

### Incident Patch 10: `b7b0243a` (2026-10-02)
**Commit Message**: Reduce make output noise in RPM build

Pass --no-print-directory to the make invocations in vespa.spec
(build, test and install). The CMake-generated Makefiles recurse
heavily, and the resulting "Entering/Leaving directory" lines make
up a large part of the build log, burying warnings and errors.
Dropping them makes RPM build logs much easier to read.

**File**: `dist/vespa.spec` (modified, +3/-3)
```diff
@@ -412,7 +412,7 @@ export PATH="%{_prefix}-deps/bin:$PATH"
        %{?_cmake_extra_opts} \
        .
 
-make %{_smp_mflags}
+make --no-print-directory %{_smp_mflags}
 VERSION=%{version} CI=true make -C client/go install-all
 %endif
 
@@ -425,7 +425,7 @@ export JAVA_HOME=/usr/lib/jvm/java-%{_vespa_java_version}-openjdk
 %endif
 export PATH="$JAVA_HOME/bin:$PATH"
 LC_CTYPE=C.UTF-8 %{_mvn_cmd} --batch-mode -nsu -T 1C verify
-make test ARGS="--output-on-failure %{_smp_mflags}"
+make --no-print-directory test ARGS="--output-on-failure %{_smp_mflags}"
 %endif
 
 %install
@@ -437,7 +437,7 @@ cp -r %{installdir} %{buildroot}
 find %{buildroot} -exec file {} \; | grep ': ELF ' | cut -d: -f1 | xargs --no-run-if-empty -n1 /usr/lib/rpm/debugedit -b %{source_base} -d %{_builddir}/%{name}-%{version}
 %endif
 %else
-make install DESTDIR=%{buildroot}
+make --no-print-directory install DESTDIR=%{buildroot}
 cp client/go/bin/vespa %{buildroot}%{_prefix}/bin/vespa
 mkdir -p %{buildroot}/usr/share
 cp -a client/go/share/* %{buildroot}/usr/share
```

---

### Incident Patch 11: `0669ddd1` (2026-10-01)
**Commit Message**: Revert "feat: illegal deployment endpoints give error (#38013)" (#38044)

**File**: `config-model/src/main/java/com/yahoo/vespa/model/application/validation/DeploymentSpecValidator.java` (modified, +0/-6)
```diff
@@ -4,8 +4,6 @@
 import com.yahoo.config.application.api.DeploymentInstanceSpec;
 import com.yahoo.config.application.api.DeploymentSpec;
 import com.yahoo.config.provision.InstanceName;
-import com.yahoo.config.provision.Zone;
-import com.yahoo.config.provision.zone.ZoneId;
 import com.yahoo.vespa.model.application.validation.Validation.Context;
 import com.yahoo.vespa.model.container.ContainerModel;
 
@@ -31,16 +29,12 @@ public void validate(Context context) {
         Reader deploymentReader = deployment.get();
         DeploymentSpec deploymentSpec = DeploymentSpec.fromXml(deploymentReader);
         List<ContainerModel> containers = context.model().getRoot().configModelRepo().getModels(ContainerModel.class);
-        Zone zone = context.deployState().zone();
         requireUniqueInstanceIds(context, deploymentSpec.instances());
         for (DeploymentInstanceSpec instance : deploymentSpec.instances()) {
             instance.endpoints().forEach(endpoint -> {
                 requireClusterId(context, containers, instance.name(),
                                  "Endpoint '" + endpoint.endpointId() + "'", endpoint.containerId());
             });
-            instance.zoneEndpoints(ZoneId.from(zone.environment(), zone.region())).keySet().forEach(cluster -> {
-                requireClusterId(context, containers, instance.name(), "Zone endpoint", cluster.value());
-            });
         }
     }
 
```

**File**: `config-model/src/test/java/com/yahoo/vespa/model/application/validation/DeploymentSpecValidatorTest.java` (modified, +0/-13)
```diff
@@ -34,19 +34,6 @@ void testEndpointNonExistentContainerId() {
                 "deployment.xml does not match any container cluster ID", deploymentXml);
     }
 
-    @Test
-    void testZoneEndpointNonExistentContainerId() {
-        var deploymentXml = """
-                <deployment version='1.0'>
-                  <endpoints>
-                    <endpoint type='private' container-id='non-existing' />
-                  </endpoints>
-                </deployment>
-                """;
-        assertValidationError("Zone endpoint in instance default: 'non-existing' specified in " +
-                "deployment.xml does not match any container cluster ID", deploymentXml);
-    }
-
     @Test
     void requireUniqueInstanceId() {
         String deploymentXml = """
```

---

### Incident Patch 12: `7be74a0e` (2026-09-30)
**Commit Message**: Merge pull request #38041 from vespa-engine/arnej/run-basic-search-in-build-container

Smoke-test the system-test container right after building it

**File**: `.buildkite/build-container.sh` (modified, +11/-0)
```diff
@@ -130,3 +130,14 @@ docker build --progress=plain \
              --target systemtest \
              --tag "$DOCKER_SYSTEMTEST_TAG" \
              --file "$(select_dockerfile)" .
+
+echo "--- Running basic-search system test"
+
+srv="/opt/vespa-systemtests/lib/node_server.rb"
+lib="/opt/vespa-systemtests/lib:/opt/vespa-systemtests/tests"
+bst="/opt/vespa-systemtests/tests/search/basicsearch/basic_search.rb"
+tnm="test_basicsearch__INDEXED"
+lft="/opt/vespa/bin/vespa-logfmt"
+
+docker run --entrypoint /bin/bash -a stdout -a stderr --rm "$DOCKER_SYSTEMTEST_TAG" -lc \
+    "set -x; ${srv} & sleep 3 && RUBYLIB=${lib} ruby ${bst} --run ${tnm} || ($lft -N && false)"
```

---

### Incident Patch 13: `f5bcf986` (2026-09-30)
**Commit Message**: Smoke-test the system-test container right after building it

After building the vespa-systemtest-preview image, run a single
system test (test_basicsearch__INDEXED from basic_search.rb) inside.

**File**: `.buildkite/build-container.sh` (modified, +11/-0)
```diff
@@ -130,3 +130,14 @@ docker build --progress=plain \
              --target systemtest \
              --tag "$DOCKER_SYSTEMTEST_TAG" \
              --file "$(select_dockerfile)" .
+
+echo "--- Running basic-search system test"
+
+srv="/opt/vespa-systemtests/lib/node_server.rb"
+lib="/opt/vespa-systemtests/lib:/opt/vespa-systemtests/tests"
+bst="/opt/vespa-systemtests/tests/search/basicsearch/basic_search.rb"
+tnm="test_basicsearch__INDEXED"
+lft="/opt/vespa/bin/vespa-logfmt"
+
+docker run --entrypoint /bin/bash -a stdout -a stderr --rm "$DOCKER_SYSTEMTEST_TAG" -lc \
+    "set -x; ${srv} & sleep 3 && RUBYLIB=${lib} ruby ${bst} --run ${tnm} || ($lft -N && false)"
```

---

### Incident Patch 14: `6fa0d2c1` (2026-09-30)
**Commit Message**: Add /proc/cpuinfo as default path for Landlock

**File**: `config-model/src/main/java/com/yahoo/vespa/model/Landlock.java` (modified, +1/-1)
```diff
@@ -18,7 +18,7 @@ public static Map<String, String> createEnv(boolean enableLandlock, String... re
             return Map.of();
         }
 
-        StringBuilder paths = new StringBuilder("/dev,ro:/sys,ro:/proc/self,ro");
+        StringBuilder paths = new StringBuilder("/dev,ro:/sys,ro:/proc/self,ro:/proc/cpuinfo,ro");
         for (String path : readOnlyPaths) {
             paths.append(":").append(path).append(",ro");
         }
```

**File**: `config-model/src/test/java/com/yahoo/vespa/model/application/validation/RankSetupValidatorTest.java` (modified, +1/-1)
```diff
@@ -57,7 +57,7 @@ void landlock_env_vars_are_set_when_feature_flag_is_enabled() {
         Map<String, String> env = RankSetupValidator.createEnvForEnablingLandlock(context, schemaDir);
 
         assertEquals("true", env.get("VESPA_ENABLE_LANDLOCK"));
-        assertEquals("/dev,ro:/sys,ro:/proc/self,ro:" + schemaDir + ",ro", env.get("VESPA_LANDLOCK_PATHS"));
+        assertEquals("/dev,ro:/sys,ro:/proc/self,ro:/proc/cpuinfo,ro:" + schemaDir + ",ro", env.get("VESPA_LANDLOCK_PATHS"));
     }
 
     @Test
```

---

### Incident Patch 15: `300b0083` (2026-09-30)
**Commit Message**: Add guidance for using td safely

**File**: `client/go/internal/cli/cmd/inspect.go` (modified, +17/-1)
```diff
@@ -6,6 +6,7 @@ import (
 	"io"
 	"os"
 
+	"github.com/fatih/color"
 	"github.com/spf13/cobra"
 	"github.com/spf13/pflag"
 	"github.com/vespa-engine/vespa/client/go/internal/vespa/slime"
@@ -23,7 +24,20 @@ type inspectProfileOptions struct {
 	showQueryNodes      []int
 }
 
+const inspectProfileDisclaimer = `This command is internal tooling and is not a supported public API.
+Its flags, output format, and behavior may change or be removed without
+notice between releases. Do not rely on it in scripts, integrations, or
+other production workflows.`
+
+func printInspectProfileDisclaimer(cli *CLI) {
+	border := "================================================================"
+	fmt.Fprintln(cli.Stderr, color.YellowString(border))
+	fmt.Fprintln(cli.Stderr, color.YellowString("WARNING: "+inspectProfileDisclaimer))
+	fmt.Fprintln(cli.Stderr, color.YellowString(border))
+}
+
 func inspectProfile(cli *CLI, opts *inspectProfileOptions) error {
+	printInspectProfileDisclaimer(cli)
 	var r io.ReadCloser
 	switch opts.profileFile {
 	case "-":
@@ -73,7 +87,9 @@ func newInspectProfileCmd(cli *CLI) *cobra.Command {
 		Use:    "profile",
 		Hidden: true,
 		Short:  "Inspect profiling results",
-		Long:   `Inspect profiling results previously obtained by vespa query --profile`,
+		Long: `Inspect profiling results previously obtained by vespa query --profile
+
+WARNING: ` + inspectProfileDisclaimer,
 		RunE: func(cmd *cobra.Command, args []string) error {
 			return inspectProfile(cli, &opts)
 		},
```

#### Recent Merged Pull Requests:
- **PR #38086** (2026-10-05): Do not color the parentheses of function declarations as parameters (@johansolbakken)
- **PR #38085** (2026-10-05): Avoid calling compat shim from within a flush target. (@toregge)
- **PR #38084** (2026-10-05): Call real member function in parent class instead of compat shim. (@toregge)
- **PR #38081** (2026-10-05): Restore model feature flag methods for Kubernetes upgrades (@onurkaracali)
- **PR #38080** (2026-10-05): Run searchlib_array_bool_test_app without valgrind (@arnej27959)
- **PR #38079** (closed): Revert "Prepare for fewer threads waiting for proxied flush target init flush." (@toregge)
- **PR #38078** (2026-10-05): Fix serverBytesSent/serverBytesReceived (@andreer)
- **PR #38077** (2026-10-05): Regenerate the Vespa schema TextMate grammar and check it in CI (@johansolbakken)

---

## 3. Empirical Evidence & Compliance Certification
- **Evidence Provenance**: Fetched directly from verified official GitHub REST API.
- **Zero Disk Footprint**: 0 bytes of unnecessary repository bloat stored locally.
- **TOS & Free-Tier Adherence**: Request pace complied with public API guidelines without fee, penalty, or unauthorized scraping.

---

## 4. Promotion & Integration Status
- **Status**: HARVESTED_DEEP_FORENSIC
- **Master Brain Sync**: Auto-committed to local/remote Master Brain repository.
