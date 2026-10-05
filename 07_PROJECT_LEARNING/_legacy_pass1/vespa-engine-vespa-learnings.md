# Forensic Learning Record (Deep Inspection): vespa-engine/vespa

> **Canonical Artifact**: `07_PROJECT_LEARNING/vespa-engine-vespa-learnings.md`  
> **Source Platform**: GitHub ([https://github.com/vespa-engine/vespa](https://github.com/vespa-engine/vespa))  
> **Harvest Method**: Full-Spectrum Deep Extraction (Patches, Diffs, Source Code, Post-Mortems)  
> **Harvest Timestamp**: 2026-09-30T20:55:50.983Z  
> **Compliance State**: Free Tier Guaranteed | Strict Rate-Limit Backoff Honored  

---

## 1. Context & Architectural Overview
- **Repository / Resource**: `vespa-engine/vespa`
- **Description**: The AI search platform
- **Primary Language / Ecosystem**: Java
- **Discovered Manifests / Configurations**: README.md
- **Stars / Engagement**: 7113 stars

---

## 2. Multi-Dimensional 8-Axis Investigation & Real Code Patches

### D1: Architecture & Structural Boundaries
- Entry configurations inspected via direct stream: README.md.
- Evaluated system abstractions and modular contracts.

### Core Architecture Module: `client/go/cond_make.go`
```
// Copyright Vespa.ai. Licensed under the terms of the Apache 2.0 license. See LICENSE in the project root.
// This is a wrapper around make that runs the given target conditionally, i.e. only when considered necessary.
//
// For example, the Homebrew target only bumps the formula for vespa-cli if no pull request has previously been made
// for the latest release.
//
// This source file is not part of the standard Vespa CLI build and is only used from the Makefile in this directory.

//go:build ignore
// +build ignore

package main

import (
	"bytes"
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"log"
	"net/http"
	"os"
	"os/exec"
	"strings"
)

func init() {
	log.SetPrefix("cond-make: ")
	log.SetFlags(0) // No timestamps
}

func requireEnv(variable string) (string, error) {
	value := os.Getenv(variable)
	if value == "" {
		return "", fmt.Errorf("environment variable %s is not set", variable)
	}
	return value, nil
}

func quote(args []string) string {
	var sb strings.Builder
	for i, arg := range args {
		if strings.Contains(arg, " ") {
			sb.WriteString(fmt.Sprintf("%q", arg))
		} else {
			sb.WriteString(arg)
		}
		if i < len(args)-1 {
			sb.WriteString(" ")
		}
	}
	return sb.String()
}

func newCmd(name string, arg ...string) (*exec.Cmd, *bytes.Buffer, *bytes.Buffer) {
	cmd := exec.Command(name, arg...)
	var stdout bytes.Buffer
	var stderr bytes.Buffer
	cmd.Stdout = io.MultiWriter(os.Stdout, &stdout)
	cmd.Stderr = io.MultiWriter(os.Stderr, &stderr)
	log.Printf("$ %s", quote(cmd.Args))
	return cmd, &stdout, &stderr
}

func runCmd(name string, arg ...string) (string, string, error) {
	cmd, stdout, stderr := newCmd(name, arg...)
	err := cmd.Run()
	return stdout.String(), stderr.String(), err
}

// latestTag returns the most recent tag as determined by sorting local git tags as version numbers.
func latestTag() (string, error) {
	stdout, _, err := runCmd("sh", "-c", "git tag -l 'v[0-9]*' | sort -V | tail -1")
	if err != nil {
		return "", err
	}
	version := strings.TrimSpace(stdout)
	if version == "" {
		return "", fmt.Errorf("no tag found")
	}
	return version, nil
}

// latestReleasedTag returns the tag of the most recent release available on given mirror.
func latestReleasedTag(mirror string) (string, error) {
	switch mirror {
	case "github":
		url := "https://api.github.com/repos/vespa-engine/vespa/releases/latest"
		token := "Bearer " + os.Getenv("GH_TOKEN")

		req, err := http.NewRequest("GET", url, nil)
		if err != nil {
			log.Println("Error on setting up http request.\n[ERROR] -", err)
		}
		req.Header.Add("Authorization", token)

		client := &http.Client{}
		resp, err := client.Do(req)
		if err != nil {
			return "", err
		}
		defer resp.Body.Close()
		if resp.StatusCode != http.StatusOK {
			return "", fmt.Errorf("got status %d from %s", resp.StatusCode, url)
		}
		var release gitHubRelease
		dec := json.NewDecoder(resp.Body)
		if err := dec.Decode(&release); err != nil {
			return "", err
		}
		return release.TagName, nil

	case "homebrew":
		cmd, stdout, _ := newCmd("brew", "info", "--json", "--formula", "vespa-cli")
		cmd.Stdout = stdout // skip printing output to os.Stdout
		if err := cmd.Run(); err != nil {
			return "", err
		}
		var brewInfo []brewFormula
		if err := json.Unmarshal(stdout.Bytes(), &brewInfo); err != nil {
			return "", err
		}
		if len(brewInfo) == 0 {
			return "", fmt.Errorf("vespa-cli formula not found")
		}
		return "v" + brewInfo[0].Versions.Stable, nil
	}
	return "", fmt.Errorf("invalid mirror: %q", mirror)
}

// hasChanges returns true if there are changes to Vespa CLI code between tag1 and tag2.
func hasChanges(tag1, tag2 string) (bool, error) {
	_, _, err := runCmd("git", "diff", "--quiet", tag1, tag2, ".")
	if err != nil {
		var exitErr *exec.ExitError
		if errors.As(err, &exitErr) {
			switch exitErr.ExitCode() {
			case 0:
				return false, nil
			case 1:
				return true, nil
			}
		}
	}
	return false, err
}

// candidateTag returns the latest tag that should be released to mirror. If there is nothing to release, the returned
// tag is empty.
func candidateTag(mirror string) (string, error) {
	latestTag, err := latestTag()
	if err != nil {
		return "", err
	}
	releasedTag, err := latestReleasedTag(mirror)
	if err != nil {
		return "", err
	}
	changes, err := hasChanges(releasedTag, latestTag)
	if err != nil {
		return "", err
	}
	if !changes {
		log.Printf("no changes found between %s and %s: skipping release", releasedTag, latestTag)
		return "", nil
	}
	log.Printf("found changes between %s and %s: creating release", releasedTag, latestTag)
	return latestTag, nil
}

// switchToTag checks out the given tag in git and returns the current branch name. The Makefile and this file always
// preserved from current branch after checking out tag.
func switchToTag(tag string) (string, error) {
	stdout, _, err := runCmd("git", "rev-parse", "--abbrev-ref", "HEAD")
	if err != nil {
		return "", err
	}
	prevBranch := strings.TrimSpace(stdout)
	if err := checkoutRef(tag); err != nil {
		return "", err
	}
	_, _, err = runCmd("git", "checkout", prevBranch, "Makefile", "cond_make.go")
	if err != nil {
		return "", err
	}
	return prevBranch, err
}

func checkoutRef(ref string) error {
	_, _, err := runCmd("git", "checkout", ref)
	return err
}

// releaseToHomebrew releases Vespa CLI to GitHub by calling the given make target, if necessary.
func releaseToHomebrew(target string) error {
	if _, err := requireEnv("HOMEBREW_GITHUB_API_TOKEN"); err != nil {
		return err
	}
	tag, err := candidateTag("homebrew")
	if tag == "" || err != nil {
		return err
	}
	prevBranch, err := switchToTag(tag)
	if err != nil {
		return err
	}
	defer checkoutRef(prevBranch)
	_, stderr, err := runCmd("make", "--", target)
	if err != nil {
		if strings.Contains(stderr, "Duplicate PRs should not be opened") {
			return nil // fine, pull request already created
		}
	}
	return err
}

// releaseToGitHub releases Vespa CLI to GitHub by calling the given make target, if necessary.
func releaseToGitHub(target string) error {
	if _, err := requireEnv("GH_TOKEN"); err != nil {
		return err
	}
	tag, err := candidateTag("github")
	if tag == "" || err != nil {
		return err
	}
	prevBranch, err := switchToTag(tag)
	if err != nil {
		return err
	}
	defer checkoutRef(prevBranch)
	_, _, err = runCmd("make", "--", target)
	return err
}

func main() {
	if len(os.Args) != 2 {
		log.Fatalf("usage: %s TARGET", os.Args[0])
	}
	target := os.Args[1]
	switch target {
	case "--dist-homebrew":
		if err := releaseToHomebrew(target); err != nil {
			log.Fatal(err)
		}
	case "--dist-github":
		if err := releaseToGitHub(target); err != nil {
			log.Fatal(err)
		}
	default:
		log.Fatalf("unsupported target: %s", target)
	}
}

type gitHubRelease struct {
	TagName string `json:"tag_name"`
}

type brewFormula struct {
	Versions brewVersions `json:"versions"`
}

type brewVersions struct {
	Stable string `json:"stable"`
}

```

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

### Incident Patch 1: `3a9d668b` (2026-09-29)
**Commit Message**: fix typo and another mention of rcu vector

**File**: `searchlib/src/vespa/searchlib/attribute/save_utils.h` (modified, +1/-1)
```diff
@@ -12,7 +12,7 @@ namespace search::attribute {
 using EntryRefVectorSnapshot = vespalib::TransientVectorSnapshot<vespalib::datastore::EntryRef>;
 
 /*
- * Create a vector of entry refs from an type stable vector containing atomic
+ * Create a vector of entry refs from a type stable vector containing atomic
  * entry refs. The new vector can be used by a flush thread while
  * saving an attribute vector as long as the proper generation guard
  * is also held.
```

**File**: `vespalib/src/vespa/vespalib/datastore/atomic_entry_ref.h` (modified, +1/-1)
```diff
@@ -12,7 +12,7 @@ namespace vespalib::datastore {
  * A wrapper for std::atomic of type EntryRef that supports copy and move constructors and assignment operator,
  * and uses Release-Acquire ordering for store and load.
  *
- * Use this class when entry refs are stored in data stores or rcu vectors,
+ * Use this class when entry refs are stored in data stores or type stable vectors,
  * where copy and move constructors and assignment operator are needed when resizing underlying buffers.
  * In this case synchronization between the writer thread and reader threads
  * is handled as part of the buffer switch.
```

---

### Incident Patch 2: `2f2e392d` (2026-09-29)
**Commit Message**: fixes

**File**: `searchlib/src/vespa/searchlib/aggregation/group.cpp` (modified, +4/-4)
```diff
@@ -85,9 +85,9 @@ Group* Group::Value::groupSingle(const ResultNode& selectResult, HitRank rank, c
         assert(getChildrenSize() == 0);
         _childInfo._childMap = new GroupHash(1, GroupHasher(&_children), GroupEqual(&_children));
     }
-    GroupHash&  childMap = *_childInfo._childMap;
-    Group*      group = nullptr;
-    const auto& found = childMap.find(selectResult);
+    GroupHash& childMap = *_childInfo._childMap;
+    Group*     group = nullptr;
+    auto       found = childMap.find(selectResult);
     if (found == childMap.end()) { // group not present in child map
         if (level.allowMoreGroups(childMap.size())) {
             group = new Group(level.getGroupPrototype());
@@ -718,7 +718,7 @@ void Group::Value::partialCopy(const Value& rhs) {
     for (size_t i = 0; i < totalAggrSize; i++) {
         _aggregationResults[i] = rhs._aggregationResults[i];
     }
-    for (size_t i(0); i < getAggrSize(); i++) {
+    for (size_t i = 0; i < getAggrSize(); i++) {
         getAggr(i)->reset();
     }
     setAggrSize(rhs.getAggrSize());
```

---

### Incident Patch 3: `3a1d39a3` (2026-09-29)
**Commit Message**: revert loop that became bug

**File**: `searchlib/src/vespa/searchlib/aggregation/grouping.cpp` (modified, +1/-1)
```diff
@@ -210,7 +210,7 @@ void Grouping::preAggregate(bool isOrdered) {
 void Grouping::aggregate(DocId from, DocId to) {
     preAggregate(false);
     if (to > from) {
-        for (DocId i = from; i < i + getMaxN(to - from); i++) {
+        for (DocId i = from, m = i + getMaxN(to - from); i < m; i++) {
             aggregate(i, 0.0);
         }
     }
```

---

### Incident Patch 4: `af00b119` (2026-09-29)
**Commit Message**: Bump brace-expansion override pins in schema-language-server vscode client (#38019)

brace-expansion overrides: 1.1.18 -> 1.1.21, 2.1.4 -> 2.1.7, 5.0.9 -> 5.0.12
(CVE-2026-102276, CVE-2026-102278). Minor/patch bumps of devDependencies
via npm-check-updates --target minor; lock regenerated.

Co-authored-by: Claude Opus 5.5 (1M context) <noreply@anthropic.com>

**File**: `integration/schema-language-server/clients/vscode/package-lock.json` (modified, +287/-316)
```diff
@@ -14,14 +14,14 @@
       "devDependencies": {
         "@types/hasbin": "^1.2.2",
         "@types/mocha": "^10.0.10",
-        "@types/node": "^25.5.0",
+        "@types/node": "^25.9.8",
         "@types/vscode": "^1.110.0",
-        "@typescript-eslint/eslint-plugin": "^8.57.0",
-        "@typescript-eslint/parser": "^8.57.0",
+        "@typescript-eslint/eslint-plugin": "^8.71.0",
+        "@typescript-eslint/parser": "^8.71.0",
         "@vscode/test-electron": "^2.5.2",
-        "@vscode/vsce": "^3.7.1",
-        "esbuild": "^0.28.1",
-        "eslint": "^10.9.0",
+        "@vscode/vsce": "^3.9.2",
+        "esbuild": "^0.28.2",
+        "eslint": "^10.11.0",
         "typescript": "^5.9.3"
       },
       "engines": {
@@ -238,6 +238,30 @@
         "node": ">=6.9.0"
       }
     },
+    "node_modules/@cacheable/memory": {
+      "version": "2.2.0",
+      "resolved": "https://registry.npmjs.org/@cacheable/memory/-/memory-2.2.0.tgz",
+      "integrity": "sha512-CTLKqLItRCEixEAewD3/j9DB3/o96gpTPD4eJ1v+DGOlxZRZncRQkGYqqnAGCscYd6RNeXfGeiuCphsPtqyIfQ==",
+      "dev": true,
+      "license": "MIT",
+      "dependencies": {
+        "@cacheable/utils": "^2.5.0",
+        "@keyv/bigmap": "^1.3.1",
+        "hookified": "^1.15.1",
+        "keyv": "^5.6.0"
+      }
+    },
+    "node_modules/@cacheable/utils": {
+      "version": "2.5.0",
+      "resolved": "https://registry.npmjs.org/@cacheable/utils/-/utils-2.5.0.tgz",
+      "integrity": "sha512-buipgOVDkkPXNR5+xBpDw7Zk2n1EvU7qBJCNUcL7rhQ//kfpOXPAvQ511Os0vpLYJ1pZnvudNytkQt2hst3wqA==",
+      "dev": true,
+      "license": "MIT",
+      "dependencies": {
+        "hashery": "^1.5.1",
+        "keyv": "^5.6.0"
+      }
+    },
     "node_modules/@esbuild/aix-ppc64": {
       "version": "0.28.2",
       "resolved": "https://registry.npmjs.org/@esbuild/aix-ppc64/-/aix-ppc64-0.28.2.tgz",
@@ -681,9 +705,9 @@
       }
     },
     "node_modules/@eslint-community/eslint-utils": {
-      "version": "4.9.1",
-      "resolved": "https://registry.npmjs.org/@eslint-community/eslint-utils/-/eslint-utils-4.9.1.tgz",
-      "integrity": "sha512-phrYmNiYppR7znFEdqgfWHXR6NCkZEK7hwWDHZUjit/2/U0r6XvkDl0SYnoM51Hq7FhCGdLDT6zxCCOY1hexsQ==",
+      "version": "4.10.1",
+      "resolved": "https://registry.npmjs.org/@eslint-community/eslint-utils/-/eslint-utils-4.10.1.tgz",
+      "integrity": "sha512-cuadcxVFE8sDK6iWJbs8Sn0av2Nrh2QSGQhVlBW9AaAHqHwjWsZHT8LJ4hFGPh7ASBV2deFdM7H/DPjulmh8rg==",
       "dev": true,
       "license": "MIT",
       "dependencies": {
@@ -761,9 +785,9 @@
       }
     },
     "node_modules/@eslint/plugin-kit": {
-      "version": "0.7.2",
-      "resolved": "https://registry.npmjs.org/@eslint/plugin-kit/-/plugin-kit-0.7.2.tgz",
-      "integrity": "sha512-+CNAzxglkrpNf/kKywqQfk74QjtceuOE7Qm+AF8miRvPF/wmmK5+OJOgVh3AVTT3RP2mH3+FOaxlE5v72owk0A==",
+      "version": "0.7.3",
+      "resolved": "https://registry.npmjs.org/@eslint/plugin-kit/-/plugin-kit-0.7.3.tgz",
+      "integrity": "sha512-IkO+/KEUvwbVpiURZg+P7zF74z5Jxe0UgJxVni+RtoHQ6IZieXaO02kmadomap/q+l6bc/jdPGGqTjhuZnuz1Q==",
       "dev": true,
       "license": "Apache-2.0",
       "dependencies": {
@@ -840,6 +864,30 @@
         "url": "https://github.com/sponsors/nzakas"
       }
     },
+    "node_modules/@keyv/bigmap": {
+      "version": "1.3.1",
+      "resolved": "https://registry.npmjs.org/@keyv/bigmap/-/bigmap-1.3.1.tgz",
+      "integrity": "sha512-WbzE9sdmQtKy8vrNPa9BRnwZh5UF4s1KTmSK0KUVLo3eff5BlQNNWDnFOouNpKfPKDnms9xynJjsMYjMaT/aFQ==",
+      "dev": true,
+      "license": "MIT",
+      "dependencies": {
+        "hashery": "^1.4.0",
+        "hookified": "^1.15.0"
+      },
+      "engines": {
+        "node": ">= 18"
+      },
+      "peerDependencies": {
+        "keyv": "^5.6.0"
+      }
+    },
+    "node_modules/@keyv/serialize": {
+      "version": "1.1.1",
+      "resolved": "https://registry.npmjs.org/@keyv/serialize/-/serialize-1.1.1.tgz",
+      "integrity": "sha512-dXn3FZhPv0US+7dtJsIi2R+c7qWYiRe
```

**File**: `integration/schema-language-server/clients/vscode/package.json` (modified, +9/-9)
```diff
@@ -87,23 +87,23 @@
   "devDependencies": {
     "@types/hasbin": "^1.2.2",
     "@types/mocha": "^10.0.10",
-    "@types/node": "^25.5.0",
+    "@types/node": "^25.9.8",
     "@types/vscode": "^1.110.0",
-    "@typescript-eslint/eslint-plugin": "^8.57.0",
-    "@typescript-eslint/parser": "^8.57.0",
+    "@typescript-eslint/eslint-plugin": "^8.71.0",
+    "@typescript-eslint/parser": "^8.71.0",
     "@vscode/test-electron": "^2.5.2",
-    "@vscode/vsce": "^3.7.1",
-    "esbuild": "^0.28.1",
-    "eslint": "^10.9.0",
+    "@vscode/vsce": "^3.9.2",
+    "esbuild": "^0.28.2",
+    "eslint": "^10.11.0",
     "typescript": "^5.9.3"
   },
   "dependencies": {
     "hasbin": "^1.2.3",
     "vscode-languageclient": "^9.0.1"
   },
   "overrides": {
-    "brace-expansion@1": "1.1.18",
-    "brace-expansion@2": "2.1.4",
-    "brace-expansion@5": "5.0.9"
+    "brace-expansion@1": "1.1.21",
+    "brace-expansion@2": "2.1.7",
+    "brace-expansion@5": "5.0.12"
   }
 }
```

---

### Incident Patch 5: `830f0552` (2026-09-29)
**Commit Message**: Merge pull request #38015 from vespa-engine/arnej/fix-schema-info-duplicate

Avoid listing extra attribute fields twice in schema-info [MERGEOK]

**File**: `config-model/src/main/java/com/yahoo/schema/derived/SchemaInfo.java` (modified, +5/-0)
```diff
@@ -24,11 +24,13 @@
 import java.io.IOException;
 import java.util.Collection;
 import java.util.Collections;
+import java.util.HashSet;
 import java.util.Iterator;
 import java.util.LinkedHashMap;
 import java.util.List;
 import java.util.Map;
 import java.util.Optional;
+import java.util.Set;
 
 /**
  * Information about a schema.
@@ -103,7 +105,10 @@ public void export(String toDirectory) throws IOException {
     }
 
     private void addFieldsConfig(SchemaInfoConfig.Schema.Builder schemaBuilder) {
+        // Extra fields which are attributes are also added to the document type, so they are listed twice
+        Set<String> added = new HashSet<>();
         for (var field : schema.allFieldsList()) {
+            if ( ! added.add(field.getName())) continue;
             addFieldConfig(field, schemaBuilder);
             for (var index : field.getIndices().values()) {
                 if ( ! index.getName().equals(field.getName())) // additional index
```

**File**: `config-model/src/test/derived/map_attribute/schema-info.cfg` (modified, +68/-73)
```diff
@@ -1,73 +1,68 @@
-schema[0].name "test"
-schema[0].field[0].name "fast_map$fast_lookup"
-schema[0].field[0].type "array<string>"
-schema[0].field[0].attribute true
-schema[0].field[0].index false
-schema[0].field[0].bitPacked false
-schema[0].field[1].name "str_map"
-schema[0].field[1].type "map<string,string>"
-schema[0].field[1].attribute false
-schema[0].field[1].index false
-schema[0].field[1].bitPacked false
-schema[0].field[2].name "int_map"
-schema[0].field[2].type "map<int,int>"
-schema[0].field[2].attribute false
-schema[0].field[2].index false
-schema[0].field[2].bitPacked false
-schema[0].field[3].name "fast_map"
-schema[0].field[3].type "map<string,int>"
-schema[0].field[3].attribute false
-schema[0].field[3].index false
-schema[0].field[3].bitPacked false
-schema[0].field[3].fastMapSearchFields[0].lookupName "fast_lookup"
-schema[0].field[3].fastMapSearchFields[0].keyField "key"
-schema[0].field[3].fastMapSearchFields[0].keyType "string"
-schema[0].field[3].fastMapSearchFields[0].valueField "value"
-schema[0].field[3].fastMapSearchFields[0].valueType "int"
-schema[0].field[4].name "fast_map$fast_lookup"
-schema[0].field[4].type "array<string>"
-schema[0].field[4].attribute true
-schema[0].field[4].index false
-schema[0].field[4].bitPacked false
-schema[0].fieldset[0].name "[document]"
-schema[0].fieldset[0].field[0] "fast_map"
-schema[0].fieldset[0].field[1] "int_map"
-schema[0].fieldset[0].field[2] "str_map"
-schema[0].fieldset[1].name "[internal]"
-schema[0].fieldset[1].field[0] "fast_map$fast_lookup"
-schema[0].summaryclass[0].name "default"
-schema[0].summaryclass[0].fields[0].name "str_map"
-schema[0].summaryclass[0].fields[0].type "jsonstring"
-schema[0].summaryclass[0].fields[0].dynamic false
-schema[0].summaryclass[0].fields[1].name "int_map"
-schema[0].summaryclass[0].fields[1].type "jsonstring"
-schema[0].summaryclass[0].fields[1].dynamic false
-schema[0].summaryclass[0].fields[2].name "rankfeatures"
-schema[0].summaryclass[0].fields[2].type "featuredata"
-schema[0].summaryclass[0].fields[2].dynamic false
-schema[0].summaryclass[0].fields[3].name "summaryfeatures"
-schema[0].summaryclass[0].fields[3].type "featuredata"
-schema[0].summaryclass[0].fields[3].dynamic false
-schema[0].summaryclass[0].fields[4].name "documentid"
-schema[0].summaryclass[0].fields[4].type "longstring"
-schema[0].summaryclass[0].fields[4].dynamic false
-schema[0].rankprofile[0].name "default"
-schema[0].rankprofile[0].hasSummaryFeatures false
-schema[0].rankprofile[0].hasRankFeatures false
-schema[0].rankprofile[0].matchPhaseMaxHits -1
-schema[0].rankprofile[0].totalMatchPhaseMaxHits -1
-schema[0].rankprofile[0].keepRankCount -1
-schema[0].rankprofile[0].totalKeepRankCount -1
-schema[0].rankprofile[0].rerankCount -1
-schema[0].rankprofile[0].totalRerankCount -1
-schema[0].rankprofile[0].significance.useModel false
-schema[0].rankprofile[1].name "unranked"
-schema[0].rankprofile[1].hasSummaryFeatures false
-schema[0].rankprofile[1].hasRankFeatures false
-schema[0].rankprofile[1].matchPhaseMaxHits -1
-schema[0].rankprofile[1].totalMatchPhaseMaxHits -1
-schema[0].rankprofile[1].keepRankCount 0
-schema[0].rankprofile[1].totalKeepRankCount -1
-schema[0].rankprofile[1].rerankCount 0
-schema[0].rankprofile[1].totalRerankCount -1
-schema[0].rankprofile[1].significance.useModel false
+schema[].name "test"
+schema[].field[].name "fast_map$fast_lookup"
+schema[].field[].type "array<string>"
+schema[].field[].attribute true
+schema[].field[].index false
+schema[].field[].bitPacked false
+schema[].field[].name "str_map"
+schema[].field[].type "map<string,string>"
+schema[].field[].attribute false
+schema[].field[].index false
+schema[].field[].bitPacked false
+schema[].field[].name "int_map"
+schema[].field[].type "map<int,int>"
+schema[].field[].attribute false
+schema[].field[].index false
+schema[].field[].bitPacked false
+schema[].field[].name "fast_map"
+schema[].field[].type "map<string,int>"
+schema[].field[].attribute false
+schema[]
```

**File**: `config-model/src/test/derived/schemainheritance/schema-info.cfg` (modified, +0/-10)
```diff
@@ -19,21 +19,11 @@ schema[].field[].type "reference<importedschema>"
 schema[].field[].attribute true
 schema[].field[].index false
 schema[].field[].bitPacked false
-schema[].field[].name "parent_field"
-schema[].field[].type "string"
-schema[].field[].attribute true
-schema[].field[].index true
-schema[].field[].bitPacked false
 schema[].field[].name "cf1"
 schema[].field[].type "string"
 schema[].field[].attribute false
 schema[].field[].index false
 schema[].field[].bitPacked false
-schema[].field[].name "child_field"
-schema[].field[].type "string"
-schema[].field[].attribute true
-schema[].field[].index true
-schema[].field[].bitPacked false
 schema[].field[].name "parent_imported"
 schema[].field[].type "string"
 schema[].field[].attribute true
```

---

### Incident Patch 6: `b6bca3ff` (2026-09-29)
**Commit Message**: Merge pull request #38012 from vespa-engine/arnej/fast-search-map-fix-review-comments

fast-search map: fixes after review

**File**: `config-model/src/main/java/com/yahoo/schema/derived/IndexInfo.java` (modified, +31/-8)
```diff
@@ -14,6 +14,7 @@
 import com.yahoo.schema.document.BooleanIndexDefinition;
 import com.yahoo.schema.document.Case;
 import com.yahoo.schema.document.FastMapSearchFields;
+import com.yahoo.searchlib.document.FastMapSearch;
 import com.yahoo.schema.document.FieldSet;
 import com.yahoo.schema.document.GeoPos;
 import com.yahoo.schema.document.ImmutableSDField;
@@ -30,6 +31,7 @@
 import java.util.Map;
 import java.util.Optional;
 import java.util.Set;
+import java.util.function.Predicate;
 
 /**
  * Per-index commands which should be applied to queries prior to searching
@@ -113,22 +115,43 @@ protected void derive(Schema schema) {
 
     /**
      * A map, or array of struct, with fast map search is queried as field.lookupName, as in
-     * field.lookupName{"key"} = value, with key and value relative to it. These names are given the settings
-     * of the field itself and of its key and value struct fields, so that they are known to the query parser,
-     * and query terms are processed as for the field itself until they are rewritten to a fast map lookup.
+     * field.lookupName{"key"} = value, with key and value relative to it. These names are made known to
+     * the query parser, which is the only use of them: FastMapSearcher rewrites a lookup to a term on the
+     * fieldName$lookupName attribute, and rejects any other query on them.
+     * <p>
+     * The lookup field gets the settings of the field itself. A string key or value is matched as a whole
+     * in the attribute, so it gets the matching settings of the attribute, which keep the parser from
+     * splitting it into several terms. A numeric value gets the settings of its struct field, so that it
+     * is parsed as a number or range.
      */
     private void deriveFastMapLookupField(ImmutableSDField field) {
         var fastMap = field.getFastMapSearch();
         if (fastMap == null) return;
         String lookupField = field.getName() + "." + fastMap.lookupName();
-        copyIndexCommands(field.getName(), lookupField);
-        copyIndexCommands(field.getName() + "." + fastMap.keyField(), lookupField + "." + FastMapSearchFields.MAP_KEY);
-        copyIndexCommands(field.getName() + "." + fastMap.valueField(), lookupField + "." + FastMapSearchFields.MAP_VALUE);
+        String lookupAttribute = FastMapSearch.toLookupFieldName(field.getName(), fastMap.lookupName());
+        copyIndexCommands(field.getName(), lookupField, command -> true);
+        deriveFastMapLookupSubField(field.getName() + "." + fastMap.keyField(), lookupField + "." + FastMapSearchFields.MAP_KEY,
+                                    fastMap.keyType(), lookupAttribute);
+        deriveFastMapLookupSubField(field.getName() + "." + fastMap.valueField(), lookupField + "." + FastMapSearchFields.MAP_VALUE,
+                                    fastMap.valueType(), lookupAttribute);
     }
 
-    private void copyIndexCommands(String fromIndex, String toIndex) {
+    private void deriveFastMapLookupSubField(String structField, String lookupSubField, DataType type, String lookupAttribute) {
+        if (type.equals(DataType.STRING)) {
+            copyIndexCommands(lookupAttribute, lookupSubField, command -> ! isTypeCommand(command));
+            copyIndexCommands(structField, lookupSubField, IndexInfo::isTypeCommand);
+        } else {
+            copyIndexCommands(structField, lookupSubField, command -> true);
+        }
+    }
+
+    private static boolean isTypeCommand(String command) {
+        return command.startsWith("type ");
+    }
+
+    private void copyIndexCommands(String fromIndex, String toIndex, Predicate<String> include) {
         for (IndexCommand command : List.copyOf(commands)) {
-            if (command.index().equals(fromIndex))
+            if (command.index().equals(fromIndex) && include.test(command.command()))
                 addIndexCommand(toIndex, command.command());
         }
     }
```

**File**: `config-model/src/main/java/com/yahoo/schema/parser/ConvertParsedFields.java` (modified, +18/-7)
```diff
@@ -27,6 +27,7 @@
 import java.util.Locale;
 import java.util.Map;
 import java.util.logging.Level;
+import java.util.regex.Pattern;
 
 /**
  * Helper for converting ParsedField etc. to SDField with settings
@@ -259,6 +260,9 @@ private void convertCommonFieldSettings(Schema schema, SDField field, ParsedFiel
         }
     }
 
+    /** A lookup name is queried as field.lookupName and is part of the fieldName$lookupName attribute name. */
+    private static final Pattern validLookupName = Pattern.compile("[a-zA-Z_][a-zA-Z0-9_]*");
+
     private void convertFastMapSearch(Schema schema, SDField field, ParsedField parsed) {
         String lookupName = parsed.getFastMapSearchName();
         FastMapSearchFields fastMapFields;
@@ -279,6 +283,10 @@ private void convertFastMapSearch(Schema schema, SDField field, ParsedField pars
             throw fastMapSearchError(schema, field, "'fast-search map field' requires a map or an array of struct field, " +
                                                     "but the type is " + field.getDataType().getName() + ".");
         }
+        if ( ! validLookupName.matcher(lookupName).matches()) {
+            throw fastMapSearchError(schema, field, "'fast-search map field' must be a letter or underscore followed by " +
+                                                    "letters, digits or underscores, but got '" + lookupName + "'.");
+        }
         if (lookupName.equals(FastMapSearchFields.MAP_KEY) || lookupName.equals(FastMapSearchFields.MAP_VALUE)) {
             throw fastMapSearchError(schema, field, "'fast-search map field' can not be named '" + lookupName +
                                                     "', as 'key' and 'value' name the key and value in a lookup.");
@@ -288,37 +296,40 @@ private void convertFastMapSearch(Schema schema, SDField field, ParsedField pars
                                                     "', which is the name of a field in the " +
                                                     (fastMapFields.isMap() ? "map" : "struct") + ".");
         }
-        validateFastMapSubtype(schema, field, fastMapFields.keyType(), fastMapFields.keyField(), "key", false);
-        validateFastMapSubtype(schema, field, fastMapFields.valueType(), fastMapFields.valueField(), "value", true);
+        validateFastMapSubtype(schema, field, fastMapFields.keyType(), fastMapFields.keyField(), "key");
+        validateFastMapSubtype(schema, field, fastMapFields.valueType(), fastMapFields.valueField(), "value");
         if (!properties.featureFlags().fastMapSearch()) {
             throw fastMapSearchError(schema, field, "'fast-search map field' is an unfinished feature that " +
                                                     "will not be enabled yet. Please remove this property from the field.");
         }
         field.setFastMapSearch(fastMapFields);
     }
 
-    private void validateFastMapSubtype(Schema schema, SDField field, DataType type, String subField, String keyOrValue, boolean allowFloatingPoint) {
+    /** Validates the type of the key or value. Only string keys are supported by the query rewrite so far. */
+    private void validateFastMapSubtype(Schema schema, SDField field, DataType type, String subField, String keyOrValue) {
         if (type == null) {
             throw fastMapSearchError(schema, field, "'fast-search map field' requires " + keyOrValue + " '" + subField +
                                                     "' to be a field in the struct.");
         }
-        if (!isSupportedFastMapKeyValueType(type, allowFloatingPoint)) {
+        boolean isKey = keyOrValue.equals("key");
+        if (isKey ? ! type.equals(DataType.STRING) : ! isSupportedFastMapValueType(type)) {
             throw new IllegalArgumentException(
                     String.format(
                             "For schema '%s', field '%s': 'fast-search map field' requires %s to be of type %s, but the type is %s.",
                             schema.getName()
```

**File**: `config-model/src/test/derived/map_attribute/index-info.cfg` (modified, +8/-0)
```diff
@@ -92,10 +92,18 @@ indexinfo[].command[].command "multivalue"
 indexinfo[].command[].indexname "fast_map.fast_lookup"
 indexinfo[].command[].command "type Map<string,int>"
 indexinfo[].command[].indexname "fast_map.fast_lookup.key"
+indexinfo[].command[].command "lowercase"
+indexinfo[].command[].indexname "fast_map.fast_lookup.key"
 indexinfo[].command[].command "multivalue"
 indexinfo[].command[].indexname "fast_map.fast_lookup.key"
+indexinfo[].command[].command "attribute"
+indexinfo[].command[].indexname "fast_map.fast_lookup.key"
+indexinfo[].command[].command "fast-search"
+indexinfo[].command[].indexname "fast_map.fast_lookup.key"
 indexinfo[].command[].command "string"
 indexinfo[].command[].indexname "fast_map.fast_lookup.key"
+indexinfo[].command[].command "word"
+indexinfo[].command[].indexname "fast_map.fast_lookup.key"
 indexinfo[].command[].command "type string"
 indexinfo[].command[].indexname "fast_map.fast_lookup.value"
 indexinfo[].command[].command "multivalue"
```

**File**: `config-model/src/test/java/com/yahoo/schema/MapFastSearchTestCase.java` (modified, +44/-11)
```diff
@@ -100,16 +100,18 @@ void requireFastMapRejectedForNonMaps() throws ParseException {
     @Test
     void requireFastMapRejectedForUnsupportedKeyAndValueTypes() throws ParseException {
         assertRejected("field m type map<double, string> { fast-search map field: lookup }", true,
-                       "For schema 'test', field 'm': 'fast-search map field' requires key to be of type string, int or long, but the type is double.");
+                       "For schema 'test', field 'm': 'fast-search map field' requires key to be of type string, but the type is double.");
+        assertRejected("field m type map<int, string> { fast-search map field: lookup }", true,
+                       "For schema 'test', field 'm': 'fast-search map field' requires key to be of type string, but the type is int.");
+        assertRejected("field m type map<long, string> { fast-search map field: lookup }", true,
+                       "For schema 'test', field 'm': 'fast-search map field' requires key to be of type string, but the type is long.");
         assertRejected("field m type map<string, bool> { fast-search map field: lookup }", true,
                        "For schema 'test', field 'm': 'fast-search map field' requires value to be of type string, int, long, float or double, but the type is bool.");
     }
 
     @Test
     void requireFastMapAcceptsSupportedKeyAndValueTypes() throws ParseException {
-        assertTrue(fastMapSearchOf("field m type map<int, string> { fast-search map field: lookup }", true));
         assertTrue(fastMapSearchOf("field m type map<string, int> { fast-search map field: lookup }", true));
-        assertTrue(fastMapSearchOf("field m type map<long, string> { fast-search map field: lookup }", true));
         assertTrue(fastMapSearchOf("field m type map<string, long> { fast-search map field: lookup }", true));
         assertTrue(fastMapSearchOf("field m type map<string, float> { fast-search map field: lookup }", true));
         assertTrue(fastMapSearchOf("field m type map<string, double> { fast-search map field: lookup }", true));
@@ -190,7 +192,9 @@ void requireFastSearchOnArrayOfStructRejectedForSameKeyAndValue() {
     @Test
     void requireFastSearchOnArrayOfStructRejectedForUnsupportedTypes() {
         assertRejectedWithEntry("double", "string", fieldWithLookup("array<entry>", "key: mykey", "value: myvalue"), true,
-                                "For schema 'test', field 'm': 'fast-search map field' requires mykey to be of type string, int or long, but the type is double.");
+                                "For schema 'test', field 'm': 'fast-search map field' requires mykey to be of type string, but the type is double.");
+        assertRejectedWithEntry("int", "string", fieldWithLookup("array<entry>", "key: mykey", "value: myvalue"), true,
+                                "For schema 'test', field 'm': 'fast-search map field' requires mykey to be of type string, but the type is int.");
         assertRejectedWithEntry("string", "bool", fieldWithLookup("array<entry>", "key: mykey", "value: myvalue"), true,
                                 "For schema 'test', field 'm': 'fast-search map field' requires myvalue to be of type string, int, long, float or double, but the type is bool.");
     }
@@ -254,29 +258,58 @@ void requireFastArrayOfStructIsListedInIlscriptsConfig() throws ParseException {
         assertEquals(IlscriptsConfig.Ilscript.Complexfield.Why.FAST_MAP_SEARCH, complexFields.get(0).why());
     }
 
-    /** The lookup field and its key and value are given the index settings of the field and its key and value. */
+    /**
+     * The lookup field is given the index settings of the field. A string key or value is given the matching settings
+     * of the lookup attribute, so that it is kept as one term, and a numeric value the settings of its struct field.
+     */
     @Test
     void requireLookupFieldsAreListedInIndexInfo() throws ParseException {
         String fields = join
```

**File**: `container-search/src/main/java/com/yahoo/prelude/query/MapMatchItem.java` (modified, +2/-4)
```diff
@@ -23,10 +23,8 @@ public class MapMatchItem extends NonReducibleCompositeItem implements HasIndexI
 
     public MapMatchItem(String fieldName, Item keyItem, Item valueItem) {
         Validator.ensureNonEmpty("Field name", fieldName);
-        if ( ! (keyItem instanceof TermItem))
-            throw new IllegalArgumentException("The key of a map match must be a term, but got " + keyItem);
-        if ( ! (valueItem instanceof TermItem))
-            throw new IllegalArgumentException("The value of a map match must be a term, but got " + valueItem);
+        Objects.requireNonNull(keyItem, "The key of a map match");
+        Objects.requireNonNull(valueItem, "The value of a map match");
         this.fieldName = fieldName;
         super.addItem(keyItem);
         super.addItem(valueItem);
```

---

### Incident Patch 7: `59686c6c` (2026-09-28)
**Commit Message**: Review fixes for the fast map search lookup field

- The sameElement fallback of FastMapSearcher keeps the weight, ranked
  flag and label of the map lookup it replaces
- MapMatchItem requires its key and value to be terms
- Say why RangeQueryOptimizer skips a map match
- Restore hover documentation on the fast-search map field completion
  snippets, with a documentation key which handles the spaces in the label

Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>

**File**: `container-search/src/main/java/com/yahoo/prelude/query/MapMatchItem.java` (modified, +4/-0)
```diff
@@ -23,6 +23,10 @@ public class MapMatchItem extends NonReducibleCompositeItem implements HasIndexI
 
     public MapMatchItem(String fieldName, Item keyItem, Item valueItem) {
         Validator.ensureNonEmpty("Field name", fieldName);
+        if ( ! (keyItem instanceof TermItem))
+            throw new IllegalArgumentException("The key of a map match must be a term, but got " + keyItem);
+        if ( ! (valueItem instanceof TermItem))
+            throw new IllegalArgumentException("The value of a map match must be a term, but got " + valueItem);
         this.fieldName = fieldName;
         super.addItem(keyItem);
         super.addItem(valueItem);
```

**File**: `container-search/src/main/java/com/yahoo/search/querytransform/FastMapSearcher.java` (modified, +8/-5)
```diff
@@ -123,14 +123,17 @@ private Item tryRewriteMapMatch(MapMatchItem mapMatchItem, SchemaInfo.Session se
         if (lookup != null) {
             return lookup;
         }
-        return toSameElement(keyItem, valueItem, fieldName, fastMap);
+        return toSameElement(mapMatchItem, fieldName, fastMap);
     }
 
-    /** Returns the sameElement on the given field equivalent to a map lookup of the given key and value on its lookup field. */
-    private static SameElementItem toSameElement(Item keyItem, Item valueItem, String fieldName, Field.FastMapSearchFields fastMap) {
+    /** Returns the sameElement on the given field equivalent to the given map lookup on its lookup field. */
+    private static SameElementItem toSameElement(MapMatchItem mapMatchItem, String fieldName, Field.FastMapSearchFields fastMap) {
         SameElementItem sameElement = new SameElementItem(fieldName);
-        sameElement.addItem(withIndex(keyItem.clone(), fastMap.keyField()));
-        sameElement.addItem(withIndex(valueItem.clone(), fastMap.valueField()));
+        sameElement.addItem(withIndex(mapMatchItem.keyItem().clone(), fastMap.keyField()));
+        sameElement.addItem(withIndex(mapMatchItem.valueItem().clone(), fastMap.valueField()));
+        sameElement.setWeight(mapMatchItem.getWeight());
+        sameElement.setRanked(mapMatchItem.isRanked());
+        sameElement.setLabel(mapMatchItem.getLabel());
         return sameElement;
     }
 
```

**File**: `container-search/src/main/java/com/yahoo/search/querytransform/RangeQueryOptimizer.java` (modified, +2/-1)
```diff
@@ -49,7 +49,8 @@ public Result search(Query query, Execution execution) {
     private boolean optimize(Item item, IndexFacts.Session indexFacts) {
         if ( ! (item instanceof CompositeItem composite)) return false;
 
-        // already OK
+        // A map match has a fixed key and value which cannot be removed or added to,
+        // and its single value range has nothing to be consolidated with
         if (item instanceof MapMatchItem)
             return false;
 
```

**File**: `container-search/src/test/java/com/yahoo/prelude/query/MapMatchItemTestCase.java` (modified, +14/-0)
```diff
@@ -32,6 +32,20 @@ void testKeyAndValueAreTheChildren() {
         assertEquals("mymap:{key:foo value:42}", mapMatch.toString());
     }
 
+    @Test
+    void testKeyAndValueMustBeTerms() {
+        var phrase = new PhraseItem();
+        phrase.setIndexName("key");
+        phrase.addItem(new WordItem("foo", "key"));
+        var exception = assertThrows(IllegalArgumentException.class,
+                                     () -> new MapMatchItem("mymap", phrase, new IntItem("42", "value")));
+        assertEquals("The key of a map match must be a term, but got key:\"foo\"", exception.getMessage());
+        exception = assertThrows(IllegalArgumentException.class,
+                                 () -> new MapMatchItem("mymap", new WordItem("foo", "key"), new AndItem()));
+        assertEquals("The value of a map match must be a term, but got AND ", exception.getMessage());
+        assertThrows(IllegalArgumentException.class, () -> new MapMatchItem("mymap", null, new IntItem("42", "value")));
+    }
+
     @Test
     void testChildrenSearchFieldsInsideTheMap() {
         var mapMatch = mapMatch();
```

**File**: `container-search/src/test/java/com/yahoo/search/querytransform/FastMapSearcherTest.java` (modified, +13/-0)
```diff
@@ -184,6 +184,19 @@ public void requireLongValueEncodedInExcessHex() {
                         mapMatch("longvaluemap", new WordItem("foo", "key"), new IntItem(Long.toString(-beyondInt), "value")));
     }
 
+    @Test
+    public void requireFallbackKeepsTheSettingsOfTheMapLookup() {
+        var mapMatch = mapMatch("intvaluemap", new WordItem("foo", "key"), new WordItem("bar", "value"));
+        mapMatch.setWeight(150);
+        mapMatch.setRanked(false);
+        mapMatch.setLabel("my_lookup");
+        var sameElement = (SameElementItem) rewritten(mapMatch);
+        assertEquals(150, sameElement.getWeight());
+        assertFalse(sameElement.isRanked());
+        assertEquals("my_lookup", sameElement.getLabel());
+        assertEquals("intvaluemap:{key:foo value:bar}!150", sameElement.toString());
+    }
+
     @Test
     public void requireFallbackWhenTermsDoNotMatchOneEntry() {
         // Not parseable as an int for an int-valued map
```

---

### Incident Patch 8: `26254091` (2026-09-28)
**Commit Message**: Keep the children of a MapMatchItem fixed

A MapMatchItem must always hold exactly its key and value, but its
children could still be removed, or changed through its item iterator.
Make removeItem() throw, as setItem() does, and return an iterator which
cannot change the children.

Move MapMatchItemTestCase next to MapMatchItem, and test that children
cannot be added, replaced or removed, and that a MapMatchItem is encoded
exactly as the equivalent sameElement, in both the binary and protobuf
forms. Also test that the YQL map access sugar and mapMatch() produce a
MapMatchItem, and the errors for a mapMatch() without exactly one key and
one value.

Co-Authored-By: Claude Opus 5.5 (1M context) <noreply@anthropic.com>

**File**: `container-search/abi-spec.json` (modified, +4/-1)
```diff
@@ -962,7 +962,10 @@
       "public com.yahoo.prelude.query.Item keyItem()",
       "public com.yahoo.prelude.query.Item valueItem()",
       "protected void adding(com.yahoo.prelude.query.Item)",
-      "public com.yahoo.prelude.query.Item setItem(int, com.yahoo.prelude.query.Item)"
+      "public com.yahoo.prelude.query.Item setItem(int, com.yahoo.prelude.query.Item)",
+      "public com.yahoo.prelude.query.Item removeItem(int)",
+      "public boolean removeItem(com.yahoo.prelude.query.Item)",
+      "public java.util.ListIterator getItemIterator()"
     ],
     "fields" : [ ]
   },
```

**File**: `container-search/src/main/java/com/yahoo/prelude/query/MapMatchItem.java` (modified, +18/-0)
```diff
@@ -1,6 +1,8 @@
 // Copyright Vespa.ai. Licensed under the terms of the Apache 2.0 license. See LICENSE in the project root.
 package com.yahoo.prelude.query;
 
+import java.util.ListIterator;
+
 /**
  * This class represents matching both key and value in a map.
  *
@@ -36,4 +38,20 @@ public Item setItem(int index, Item item) {
         throw new UnsupportedOperationException("cannot replace children of MapMatchItem");
     }
 
+    @Override
+    public Item removeItem(int index) {
+        throw new UnsupportedOperationException("cannot remove children of MapMatchItem");
+    }
+
+    @Override
+    public boolean removeItem(Item item) {
+        throw new UnsupportedOperationException("cannot remove children of MapMatchItem");
+    }
+
+    /** Returns an iterator over the children, which cannot be used to change them. */
+    @Override
+    public ListIterator<Item> getItemIterator() {
+        return items().listIterator();
+    }
+
 }
```

**File**: `container-search/src/test/java/com/yahoo/prelude/query/MapMatchItemTestCase.java` (added, +134/-0)
```diff
@@ -0,0 +1,134 @@
+// Copyright Vespa.ai. Licensed under the terms of the Apache 2.0 license. See LICENSE in the project root.
+package com.yahoo.prelude.query;
+
+import org.junit.jupiter.api.Test;
+
+import java.nio.ByteBuffer;
+import java.util.Arrays;
+
+import static org.junit.jupiter.api.Assertions.assertArrayEquals;
+import static org.junit.jupiter.api.Assertions.assertEquals;
+import static org.junit.jupiter.api.Assertions.assertNotEquals;
+import static org.junit.jupiter.api.Assertions.assertNotSame;
+import static org.junit.jupiter.api.Assertions.assertSame;
+import static org.junit.jupiter.api.Assertions.assertThrows;
+
+public class MapMatchItemTestCase {
+
+    @Test
+    void testKeyAndValueAreTheChildren() {
+        var key = new WordItem("foo", "key");
+        var value = new IntItem("42", "value");
+        var mapMatch = new MapMatchItem("mymap", key, value);
+        assertSame(key, mapMatch.keyItem());
+        assertSame(value, mapMatch.valueItem());
+        assertSame(key, mapMatch.getItem(0));
+        assertSame(value, mapMatch.getItem(1));
+        assertEquals("mymap:{key:foo value:42}", mapMatch.toString());
+    }
+
+    @Test
+    void testCloneHasItsOwnKeyAndValue() {
+        var mapMatch = new MapMatchItem("mymap", new WordItem("foo", "key"), new IntItem("42", "value"));
+        var copy = (MapMatchItem) mapMatch.clone();
+
+        assertEquals(mapMatch, copy);
+        assertNotSame(mapMatch.keyItem(), copy.keyItem());
+        assertNotSame(mapMatch.valueItem(), copy.valueItem());
+        assertSame(copy.getItem(0), copy.keyItem());
+        assertSame(copy.getItem(1), copy.valueItem());
+        assertSame(copy, copy.keyItem().getParent());
+        assertSame(copy, copy.valueItem().getParent());
+
+        // Changing the copy leaves the original alone
+        ((WordItem) copy.keyItem()).setWord("bar");
+        assertEquals("mymap:{key:foo value:42}", mapMatch.toString());
+        assertEquals("mymap:{key:bar value:42}", copy.toString());
+    }
+
+    @Test
+    void testCloneCannotGetExtraChildren() {
+        var copy = (MapMatchItem) new MapMatchItem("mymap", new WordItem("foo", "key"), new WordItem("bar", "value")).clone();
+        assertThrows(IllegalArgumentException.class, () -> copy.addItem(new WordItem("baz", "other")));
+    }
+
+    @Test
+    void testChildrenCannotBeAdded() {
+        var mapMatch = mapMatch();
+        assertThrows(IllegalArgumentException.class, () -> mapMatch.addItem(new WordItem("baz", "other")));
+        assertThrows(IllegalArgumentException.class, () -> mapMatch.addItem(0, new WordItem("baz", "other")));
+        assertThrows(UnsupportedOperationException.class, () -> mapMatch.getItemIterator().add(new WordItem("baz", "other")));
+        assertUnchanged(mapMatch);
+    }
+
+    @Test
+    void testChildrenCannotBeReplaced() {
+        var mapMatch = mapMatch();
+        assertThrows(UnsupportedOperationException.class, () -> mapMatch.setItem(0, new WordItem("baz", "key")));
+        assertThrows(UnsupportedOperationException.class, () -> mapMatch.setItem(1, new WordItem("baz", "value")));
+        var iterator = mapMatch.getItemIterator();
+        iterator.next();
+        assertThrows(UnsupportedOperationException.class, () -> iterator.set(new WordItem("baz", "key")));
+        assertUnchanged(mapMatch);
+    }
+
+    @Test
+    void testChildrenCannotBeRemoved() {
+        var mapMatch = mapMatch();
+        assertThrows(UnsupportedOperationException.class, () -> mapMatch.removeItem(0));
+        assertThrows(UnsupportedOperationException.class, () -> mapMatch.removeItem(mapMatch.valueItem()));
+        var iterator = mapMatch.getItemIterator();
+        iterator.next();
+        assertThrows(UnsupportedOperationException.class, iterator::remove);
+        assertUnchanged(mapMatch);
+    }
+
+    @Test
+    void testIsNotEqualToTheEquivalentSameElement() {
+        assertNotEquals(sameElement(), mapMatch());
+        assertNotEquals(mapMatc
```

**File**: `container-search/src/test/java/com/yahoo/prelude/query/test/MapMatchItemTestCase.java` (removed, +0/-61)
```diff
@@ -1,61 +0,0 @@
-// Copyright Vespa.ai. Licensed under the terms of the Apache 2.0 license. See LICENSE in the project root.
-package com.yahoo.prelude.query.test;
-
-import com.yahoo.prelude.query.IntItem;
-import com.yahoo.prelude.query.MapMatchItem;
-import com.yahoo.prelude.query.WordItem;
-import org.junit.jupiter.api.Test;
-
-import static org.junit.jupiter.api.Assertions.assertEquals;
-import static org.junit.jupiter.api.Assertions.assertNotSame;
-import static org.junit.jupiter.api.Assertions.assertSame;
-import static org.junit.jupiter.api.Assertions.assertThrows;
-
-public class MapMatchItemTestCase {
-
-    @Test
-    void testKeyAndValueAreTheChildren() {
-        var key = new WordItem("foo", "key");
-        var value = new IntItem("42", "value");
-        var mapMatch = new MapMatchItem("mymap", key, value);
-        assertSame(key, mapMatch.keyItem());
-        assertSame(value, mapMatch.valueItem());
-        assertSame(key, mapMatch.getItem(0));
-        assertSame(value, mapMatch.getItem(1));
-        assertEquals("mymap:{key:foo value:42}", mapMatch.toString());
-    }
-
-    @Test
-    void testCloneHasItsOwnKeyAndValue() {
-        var mapMatch = new MapMatchItem("mymap", new WordItem("foo", "key"), new IntItem("42", "value"));
-        var copy = (MapMatchItem) mapMatch.clone();
-
-        assertEquals(mapMatch, copy);
-        assertNotSame(mapMatch.keyItem(), copy.keyItem());
-        assertNotSame(mapMatch.valueItem(), copy.valueItem());
-        assertSame(copy.getItem(0), copy.keyItem());
-        assertSame(copy.getItem(1), copy.valueItem());
-        assertSame(copy, copy.keyItem().getParent());
-        assertSame(copy, copy.valueItem().getParent());
-
-        // Changing the copy leaves the original alone
-        ((WordItem) copy.keyItem()).setWord("bar");
-        assertEquals("mymap:{key:foo value:42}", mapMatch.toString());
-        assertEquals("mymap:{key:bar value:42}", copy.toString());
-    }
-
-    @Test
-    void testCloneCannotGetExtraChildren() {
-        var copy = (MapMatchItem) new MapMatchItem("mymap", new WordItem("foo", "key"), new WordItem("bar", "value")).clone();
-        assertThrows(IllegalArgumentException.class, () -> copy.addItem(new WordItem("baz", "other")));
-    }
-
-    @Test
-    void testChildrenCannotBeReplaced() {
-        var mapMatch = new MapMatchItem("mymap", new WordItem("foo", "key"), new WordItem("bar", "value"));
-        assertThrows(UnsupportedOperationException.class, () -> mapMatch.setItem(0, new WordItem("baz", "key")));
-        assertThrows(UnsupportedOperationException.class, () -> mapMatch.setItem(1, new WordItem("baz", "value")));
-        assertEquals("mymap:{key:foo value:bar}", mapMatch.toString());
-    }
-
-}
```

**File**: `container-search/src/test/java/com/yahoo/search/yql/YqlParserTestCase.java` (modified, +44/-0)
```diff
@@ -17,6 +17,7 @@
 import com.yahoo.prelude.query.IndexedItem;
 import com.yahoo.prelude.query.IntItem;
 import com.yahoo.prelude.query.Item;
+import com.yahoo.prelude.query.MapMatchItem;
 import com.yahoo.prelude.query.MarkerWordItem;
 import com.yahoo.prelude.query.NearItem;
 import com.yahoo.prelude.query.NearestNeighborItem;
@@ -821,6 +822,49 @@ void testMapRangeRewritesToSameElement() {
                              "my_map:{key:foo value:[40;50]}");
     }
 
+    @Test
+    void testMapAccessProducesMapMatch() {
+        for (String where : List.of("my_map{'foo'} contains 'bar'", "my_map{'foo'} = 10", "range(my_map{'foo'}, 40, 50)",
+                                    "my_map contains mapMatch(key contains 'foo', value contains 'bar')",
+                                    "my_map contains mapMatch(value contains 'bar', key contains 'foo')")) {
+            MapMatchItem mapMatch = assertInstanceOf(MapMatchItem.class, parse("select * from sources * where " + where).getRoot(), where);
+            assertEquals("my_map", mapMatch.getFieldName(), where);
+            assertEquals("key", ((IndexedItem) mapMatch.keyItem()).getIndexName(), where);
+            assertEquals("foo", ((WordItem) mapMatch.keyItem()).getWord(), where);
+            assertEquals("value", ((IndexedItem) mapMatch.valueItem()).getIndexName(), where);
+        }
+
+        // The key and value are the first and second child, whatever order they are given in
+        assertParse("select * from sources * where my_map contains mapMatch(value contains 'bar', key contains 'foo')",
+                    "my_map:{key:foo value:bar}");
+
+        // A dotted field name, as for the lookup field of a map with fast search, is kept as is
+        MapMatchItem lookup = assertInstanceOf(MapMatchItem.class,
+                                               parse("select * from sources * where my_map.lookup{'foo'} = 10").getRoot());
+        assertEquals("my_map.lookup", lookup.getFieldName());
+        assertEquals("my_map.lookup:{key:foo value:10}", lookup.toString());
+
+        // A plain sameElement is not a map lookup
+        assertEquals(SameElementItem.class,
+                     parse("select * from sources * where my_map contains sameElement(key contains 'foo', value contains 'bar')").getRoot().getClass());
+    }
+
+    @Test
+    void testMapMatchRequiresOneKeyAndOneValue() {
+        assertParseFail("select * from sources * where my_map contains mapMatch(key contains 'foo')",
+                        new IllegalArgumentException("mapMatch requires both a key and a value item"));
+        assertParseFail("select * from sources * where my_map contains mapMatch(value contains 'bar')",
+                        new IllegalArgumentException("mapMatch requires both a key and a value item"));
+        assertParseFail("select * from sources * where my_map contains mapMatch(key contains 'foo', key contains 'baz', value contains 'bar')",
+                        new IllegalArgumentException("unknown or extra item inside mapMatch: key:baz"));
+        assertParseFail("select * from sources * where my_map contains mapMatch(key contains 'foo', value contains 'bar', value contains 'baz')",
+                        new IllegalArgumentException("unknown or extra item inside mapMatch: value:baz"));
+        assertParseFail("select * from sources * where my_map contains mapMatch(key contains 'foo', other contains 'bar')",
+                        new IllegalArgumentException("unknown or extra item inside mapMatch: other:bar"));
+        assertParseFail("select * from sources * where my_map contains mapMatch(key contains 'foo', value contains 'bar' and value contains 'baz')",
+                        new IllegalArgumentException("bad item type inside mapMatch: AND value:bar value:baz"));
+    }
+
     @Test
     void testMapRangeRequiresLiteralKey() {
         assertParseFail("select * from sources * where range(my_map{key_field}, 40, 50)",
```

---

### Incident Patch 9: `8c6f1655` (2026-09-28)
**Commit Message**: fix(build): honor Maven global settings during wrapper setup (#37970)

**File**: `README.md` (modified, +4/-0)
```diff
@@ -124,6 +124,10 @@ mvn -v
 
 Use this if you only need to build the Java modules, otherwise follow the complete development guide above.
 
+When `MAVEN_GLOBAL_SETTINGS` is set, `bootstrap.sh` uses the supplied global Maven
+settings while generating a wrapper. The generated Maven 3.9.16 distribution
+is checked against a pinned SHA-256 independently of its download URL.
+
 ### Run tests for shell scripts (on Mac)
 Shell scripts are tested with [BATS](https://bats-core.readthedocs.io/en/stable/).
 To run the tests locally, install the testing framework and its plugins.
```

**File**: `bootstrap.sh` (modified, +17/-1)
```diff
@@ -67,8 +67,24 @@ if [ "$current_mvn_version" = "$wanted_mvn_version" ]; then
 else
     # Set up maven wrapper.
     echo "Setting up maven wrapper ${wanted_mvn_version} in $(pwd)"
+    maven_wrapper_args=(-B)
+    if [[ -n "${MAVEN_GLOBAL_SETTINGS:-}" ]]; then
+        maven_wrapper_args=(-gs "$MAVEN_GLOBAL_SETTINGS" -B)
+    fi
     # shellcheck disable=SC2086 # allow word splitting for maven extra opts
-    mvn -B wrapper:wrapper -Dmaven="${wanted_mvn_version}" -N ${MAVEN_EXTRA_OPTS}
+    mvn "${maven_wrapper_args[@]}" wrapper:wrapper -Dmaven="${wanted_mvn_version}" -N ${MAVEN_EXTRA_OPTS}
+
+    # Keep verification independent of the mirror used to fetch the wrapper.
+    wrapper_properties=.mvn/wrapper/maven-wrapper.properties
+    distribution_sha256=5af3b743dd8b876b5c45da33b676251e5f1687712644abb4ee519ca56e1d89ce
+    if grep -q '^distributionSha256Sum=' "$wrapper_properties"; then
+        grep -qx "distributionSha256Sum=$distribution_sha256" "$wrapper_properties" || {
+            echo "Unexpected Maven wrapper distribution checksum" >&2
+            exit 1
+        }
+    else
+        printf '\ndistributionSha256Sum=%s\n' "$distribution_sha256" >> "$wrapper_properties"
+    fi
 
     # Proxy allowing you to put $(pwd)/maven-wrapper/bin first in PATH
     # to redirect any plain "mvn" commands so they use the wrapper
```

---

### Incident Patch 10: `7b7c6a31` (2026-09-26)
**Commit Message**: fix(deps): update protobuf monorepo to v4.36.2

**File**: `dependency-versions/pom.xml` (modified, +1/-1)
```diff
@@ -152,7 +152,7 @@
         <plexus-xml.vespa.version>4.2.0</plexus-xml.vespa.version>
         <plexus-classworlds.vespa.version>2.12.1</plexus-classworlds.vespa.version>
         <proto-google-common-protos.vespa.version>2.77.0</proto-google-common-protos.vespa.version>
-        <protobuf.vespa.version>4.36.1</protobuf.vespa.version>
+        <protobuf.vespa.version>4.36.2</protobuf.vespa.version>
         <questdb.vespa.version>7.4.2</questdb.vespa.version>
         <re2j.vespa.version>1.8</re2j.vespa.version>
         <reactor-core.vespa.version>3.8.7</reactor-core.vespa.version>
```

#### Recent Merged Pull Requests:
- **PR #38041** (2026-09-30): Smoke-test the system-test container right after building it (@arnej27959)
- **PR #38040** (2026-09-30): chore(deps): update github actions (major) (@renovate[bot])
- **PR #38039** (2026-09-30): Pass only ClusterSpec (@bratseth)
- **PR #38038** (2026-09-30): Add paths for onnx models and rank profiles to landlock env paths (@hmusum)
- **PR #38037** (2026-09-30): Add guidance for using td safely (@johansolbakken)
- **PR #38035** (2026-09-30): feat(cli): better config get (@BrageHK)
- **PR #38034** (2026-09-30): Make FastMapSearcher cheap for applications without fast map lookups (@arnej27959)
- **PR #38032** (2026-09-30): Allow several fast-search map fields on one field (@johansolbakken)

---

## 3. Empirical Evidence & Compliance Certification
- **Evidence Provenance**: Fetched directly from verified official GitHub REST API.
- **Zero Disk Footprint**: 0 bytes of unnecessary repository bloat stored locally.
- **TOS & Free-Tier Adherence**: Request pace complied with public API guidelines without fee, penalty, or unauthorized scraping.

---

## 4. Promotion & Integration Status
- **Status**: HARVESTED_DEEP_FORENSIC
- **Master Brain Sync**: Auto-committed to local/remote Master Brain repository.
