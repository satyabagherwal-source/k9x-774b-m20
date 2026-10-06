# Forensic Learning Record (Deep Inspection): rook/rook

> **Canonical Artifact**: `07_PROJECT_LEARNING/rook-rook-learnings.md`  
> **Source Platform**: GitHub ([https://github.com/rook/rook](https://github.com/rook/rook))  
> **Harvest Method**: Full-Spectrum Deep Extraction (Patches, Diffs, Source Code, Post-Mortems)  
> **Harvest Timestamp**: 2026-10-06T03:31:34.542Z  
> **Compliance State**: Free Tier Guaranteed | Strict Rate-Limit Backoff Honored  

---

## 1. Context & Architectural Overview
- **Repository / Resource**: `rook/rook`
- **Description**: Storage Orchestration for Kubernetes
- **Primary Language / Ecosystem**: Go
- **Discovered Manifests / Configurations**: go.mod, README.md
- **Stars / Engagement**: 13672 stars

---

## 2. Multi-Dimensional 8-Axis Investigation & Real Code Patches

### D1: Architecture & Structural Boundaries
- Entry configurations inspected via direct stream: go.mod, README.md.
- Evaluated system abstractions and modular contracts.

### Core Architecture Module: `cmd/rook/util/cmdreporter.go`
```
/*
Copyright 2019 The Rook Authors. All rights reserved.

Licensed under the Apache License, Version 2.0 (the "License");
you may not use this file except in compliance with the License.
You may obtain a copy of the License at

	http://www.apache.org/licenses/LICENSE-2.0

Unless required by applicable law or agreed to in writing, software
distributed under the License is distributed on an "AS IS" BASIS,
WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
See the License for the specific language governing permissions and
limitations under the License.
*/

package util

import (
	"context"
	"fmt"
	"os/signal"

	"github.com/rook/rook/pkg/daemon/util"
	operator "github.com/rook/rook/pkg/operator/ceph"

	"github.com/rook/rook/cmd/rook/rook"
	"github.com/spf13/cobra"
)

// CmdReporterCmd defines a top-level utility command which runs a given command and stores the
// results in a ConfigMap. Operators are advised to use operator/k8sutil.CmdReporter, which wraps
// this functionality neatly rather than calling this with a custom setup.
var CmdReporterCmd = &cobra.Command{
	Use:   "cmd-reporter",
	Short: "Run a given command to completion, and store the result in a ConfigMap.",
	Long: `Run a given command to completion, and store the Stdout, Stderr, and return code
results of the command in a ConfigMap. If the ConfigMap already exists, the
Stdout, Stderr, and return code data which may be present in the ConfigMap
will be overwritten.

If cmd-reporter succeeds in running the command to completion, no error is
reported, even if the command's return code is nonzero (failure). Run will
terminate if the command could not be run for any reason or if there was an
error storing the command results into the ConfigMap. An application label
is applied to the ConfigMap. Run will also terminate if the label already
exists and has a different application's name; this may indicate that
it is not safe for cmd-reporter to edit the ConfigMap.`,
	Args:   cobra.NoArgs,
	Run:    runCmdReporter,
	Hidden: true, // do not advertise to end users
}

var (
	// run sub-command
	commandString string
	configMapName string
	namespace     string
)

func init() {
	// cmd-reporter
	CmdReporterCmd.Flags().StringVar(&commandString, "command", "",
		"The command to run in JSON list syntax. e.g., '[\"command\", \"--flag\", \"value\", \"arg\"]'")
	if err := CmdReporterCmd.MarkFlagRequired("command"); err != nil {
		panic(err)
	}

	CmdReporterCmd.Flags().StringVar(&configMapName, "config-map-name", "",
		"The name of the ConfigMap into which the result of the command will be stored.")
	if err := CmdReporterCmd.MarkFlagRequired("config-map-name"); err != nil {
		panic(err)
	}

	CmdReporterCmd.Flags().StringVar(&namespace, "namespace", "", "The namespace in which to create the ConfigMap.")
	if err := CmdReporterCmd.MarkFlagRequired("namespace"); err != nil {
		panic(err)
	}
}

func runCmdReporter(cCmd *cobra.Command, cArgs []string) {
	// Initialize the context
	ctx, cancel := signal.NotifyContext(context.Background(), operator.ShutdownSignals...)
	defer cancel()

	cmd, args, err := util.CmdReporterFlagArgumentToCommand(commandString)
	if err != nil {
		rook.TerminateFatal(fmt.Errorf("failed to parse '--command' argument [%s]. %+v", commandString, err))
	}

	context := rook.NewContext()
	reporter, err := util.NewCmdReporter(ctx, context.Clientset, cmd, args, configMapName, namespace)
	if err != nil {
		rook.TerminateFatal(fmt.Errorf("cannot start command-reporter. %+v", err))
	}
	err = reporter.Run()
	if err != nil {
		rook.TerminateFatal(err)
	}
}

```

### Core Architecture Module: `cmd/rook/util/doc.go`
```
/*
Copyright 2019 The Rook Authors. All rights reserved.

Licensed under the Apache License, Version 2.0 (the "License");
you may not use this file except in compliance with the License.
You may obtain a copy of the License at

	http://www.apache.org/licenses/LICENSE-2.0

Unless required by applicable law or agreed to in writing, software
distributed under the License is distributed on an "AS IS" BASIS,
WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
See the License for the specific language governing permissions and
limitations under the License.
*/

// Package util contains top-level utility commands which are neither storage backends nor
// associated with a particular storage backend.
package util

```

### Core Architecture Module: `pkg/daemon/ceph/util/util.go`
```
/*
Copyright 2017 The Rook Authors. All rights reserved.

Licensed under the Apache License, Version 2.0 (the "License");
you may not use this file except in compliance with the License.
You may obtain a copy of the License at

	http://www.apache.org/licenses/LICENSE-2.0

Unless required by applicable law or agreed to in writing, software
distributed under the License is distributed on an "AS IS" BASIS,
WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
See the License for the specific language governing permissions and
limitations under the License.
*/

package util

import (
	"net"
	"strconv"

	"github.com/coreos/pkg/capnslog"
)

var logger = capnslog.NewPackageLogger("github.com/rook/rook", "op-ceph-util")

// GetIPFromEndpoint returns the IP from an endpoint string (192.168.0.1:6789)
func GetIPFromEndpoint(endpoint string) string {
	host, _, err := net.SplitHostPort(endpoint)
	if err != nil {
		logger.Errorf("failed to split ip and port for endpoint %q. %v", endpoint, err)
	}
	return host
}

// GetPortFromEndpoint returns the port from an endpoint string (192.168.0.1:6789)
func GetPortFromEndpoint(endpoint string) int32 {
	var port int64
	_, portString, err := net.SplitHostPort(endpoint)
	if err != nil {
		logger.Errorf("failed to split host and port for endpoint %q, assuming default Ceph port %q. %v", endpoint, portString, err)
	} else {
		//nolint:gosec // using Atoi to convert type into int is not a real risk
		port, err = strconv.ParseInt(portString, 10, 32)
		if err != nil {
			logger.Errorf("failed to convert %q to integer. %v", portString, err)
		}
	}
	//nolint:gosec // G109 No overflow:  we parsed to 32 bits above
	portInt32 := int32(port)
	return portInt32
}

```

### Core Architecture Module: `pkg/daemon/multus/statemachine.go`
```
/*
Copyright 2023 The Rook Authors. All rights reserved.

Licensed under the Apache License, Version 2.0 (the "License");
you may not use this file except in compliance with the License.
You may obtain a copy of the License at

	http://www.apache.org/licenses/LICENSE-2.0

Unless required by applicable law or agreed to in writing, software
distributed under the License is distributed on an "AS IS" BASIS,
WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
See the License for the specific language governing permissions and
limitations under the License.
*/

package multus

import (
	"context"
	"fmt"
	"time"

	meta "k8s.io/apimachinery/pkg/apis/meta/v1"
)

type validationState interface {
	Run(ctx context.Context, vsm *validationStateMachine) (suggestions []string, err error)
}

type validationStateMachine struct {
	vt                *ValidationTest
	state             validationState
	timer             *time.Timer
	stateWasChanged   bool
	resourceOwnerRefs []meta.OwnerReference
	testResults       *ValidationTestResults
	lastSuggestions   []string
	lastErr           error
	done              bool
}

func (vsm *validationStateMachine) SetNextState(nextState validationState) {
	vsm.stateWasChanged = true
	vsm.state = nextState
}

func (vsm *validationStateMachine) Exit() {
	vsm.done = true
}

func (vsm *validationStateMachine) Run(ctx context.Context) (*ValidationTestResults, error) {
	vsm.timer = time.NewTimer(vsm.vt.ResourceTimeout)
	defer func() { vsm.timer.Stop() }()

	for {
		select {
		case <-ctx.Done():
			return vsm.exitContextCanceled(ctx)

		case <-vsm.timer.C:
			vsm.testResults.addSuggestions(vsm.lastSuggestions...)
			return vsm.testResults, fmt.Errorf("multus validation test timed out: %w", vsm.lastErr)

		default:
			// give each state the full resource timeout to run successfully
			if vsm.stateWasChanged {
				vsm.resetTimer()
				vsm.stateWasChanged = false
			}

			// run the state
			suggestions, err := vsm.state.Run(ctx, vsm)

			// if the context was canceled, the error message won't be as useful as one gathered from
			// the last context, so exit before updating the latest suggestions and error
			if ctx.Err() != nil {
				return vsm.exitContextCanceled(ctx)
			}

			// record the latest suggestions and error
			vsm.lastErr = err
			vsm.lastSuggestions = suggestions

			// exit the state machine, error or not
			if vsm.done {
				vsm.testResults.addSuggestions(vsm.lastSuggestions...)
				if vsm.lastErr != nil {
					return vsm.testResults, fmt.Errorf("multus validation test failed: %w", vsm.lastErr)
				}
				return vsm.testResults, nil
			}
			if err != nil {
				vsm.vt.Logger.Infof("continuing: %s", err)
			}

			time.Sleep(2 * time.Second)
		}
	}
}

func (vsm *validationStateMachine) resetTimer() {
	if !vsm.timer.Stop() {
		<-vsm.timer.C
	}
	vsm.timer.Reset(vsm.vt.ResourceTimeout)
}

func (vsm *validationStateMachine) exitContextCanceled(ctx context.Context) (*ValidationTestResults, error) {
	vsm.testResults.addSuggestions(vsm.lastSuggestions...)
	return vsm.testResults, fmt.Errorf("context canceled before multus validation test could complete: %s: %w", ctx.Err().Error(), vsm.lastErr)
}

```

### Core Architecture Module: `pkg/daemon/multus/util.go`
```
/*
Copyright 2023 The Rook Authors. All rights reserved.

Licensed under the Apache License, Version 2.0 (the "License");
you may not use this file except in compliance with the License.
You may obtain a copy of the License at

	http://www.apache.org/licenses/LICENSE-2.0

Unless required by applicable law or agreed to in writing, software
distributed under the License is distributed on an "AS IS" BASIS,
WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
See the License for the specific language governing permissions and
limitations under the License.
*/

package multus

import (
	"fmt"
	"os"

	nadutils "github.com/k8snetworkplumbingwg/network-attachment-definition-client/pkg/utils"
	core "k8s.io/api/core/v1"
	"k8s.io/apimachinery/pkg/types"
)

// Logger defines the log types that this library will use for outputting status information to the
// user. Because this library may be called interactively by a user or programmatically by another
// application, we allow the calling application to make a very simple Logger type that will be
// compatible with this library.
type Logger interface {
	Infof(format string, args ...any)
	Debugf(format string, args ...any)
	Warningf(format string, args ...any)
}

type SimpleStderrLogger struct{}

func (*SimpleStderrLogger) Infof(format string, args ...any) {
	fmt.Fprintf(os.Stderr, " INFO: "+format+"\n", args...)
}

func (*SimpleStderrLogger) Debugf(format string, args ...any) {
	fmt.Fprintf(os.Stderr, "DEBUG: "+format+"\n", args...)
}

func (*SimpleStderrLogger) Warningf(format string, args ...any) {
	fmt.Fprintf(os.Stderr, " WARN: "+format+"\n", args...)
}

func getNetworksFromPod(
	pod *core.Pod,
	desiredPublicNet, desiredClusterNet *types.NamespacedName,
) (
	publicAddr, clusterAddr string, suggestions []string, err error,
) {
	nets, err := nadutils.GetNetworkStatus(pod)
	if err != nil {
		return "", "", unableToProvideAddressSuggestions,
			fmt.Errorf("pod has no network status yet: %w", err)
	}
	if len(nets) == 0 {
		return "", "", unableToProvideAddressSuggestions,
			fmt.Errorf("pod has no attached networks yet")
	}

	// if the pod has networks attached, parse all of them, and report any debugging suggestions
	// associated for each one
	publicAddr, clusterAddr = "", ""
	suggestions = []string{}
	for _, net := range nets {
		nsName, err := networkNamespacedName(net.Name, pod.Namespace)
		if err != nil {
			suggestions = append(suggestions,
				fmt.Sprintf("pod has an attached network with an un-parse-able network name [%s]; "+
					"not sure what to do; this is unlikely to resolve", net.Name),
			)
		}
		if len(net.IPs) == 0 {
			suggestions = append(suggestions,
				fmt.Sprintf("pod has an attached network [%s] with no IP; "+
					"could this be an IPAM issue?", net.Name))
		}

		ip := net.IPs[0] // any IP should work
		if desiredPublicNet != nil && nsName == *desiredPublicNet {
			// FOUND DESIRED PUBLIC ADDR
			publicAddr = ip
		}
		if desiredClusterNet != nil && nsName == *desiredClusterNet {
			// FOUND DESIRED CLUSTER ADDR
			clusterAddr = ip
		}
	}

	if desiredPublicNet != nil && publicAddr == "" {
		suggestions = append(suggestions, "pod does not have a public network attachment")
	}
	if desiredClusterNet != nil && clusterAddr == "" {
		suggestions = append(suggestions, "pod does not have a cluster network attachment")
	}

	// if there are any suggestions, something isn't right
	if len(suggestions) > 0 {
		suggestions = append(suggestions, unableToProvideAddressSuggestions...)
		return publicAddr, clusterAddr, suggestions, fmt.Errorf("did not find all desired networks")
	}

	// found what we were looking for
	return publicAddr, clusterAddr, []string{}, nil
}

func podIsRunning(pod core.Pod) bool {
	return pod.Status.Phase == core.PodRunning
}

func podIsReady(pod core.Pod) bool {
	for _, c := range pod.Status.Conditions {
		if c.Type == core.PodReady {
			return c.Status == core.ConditionTrue
		}
	}
	return false
}

func networkNamespacedName(netName, podNamespace string) (types.NamespacedName, error) {
	nsName := types.NamespacedName{}
	// what we really want is the result of parsePodNetworkObjectText(), a private method.
	// because the network name is in the same format as network annotations, we can
	// at least use ParseNetworkAnnotation() to parse the network name
	netSelections, err := nadutils.ParseNetworkAnnotation(netName, podNamespace)
	if err != nil {
		return nsName, fmt.Errorf("failed to parse network name %q into namespaced name: %w", netName, err)
	}

	if len(netSelections) != 1 {
		return nsName, fmt.Errorf("failed to parse network name %q into a single namespaced network name, instead: %v", netName, netSelections)
	}

	net := netSelections[0]
	nsName.Namespace = net.Namespace
	nsName.Name = net.Name
	return nsName, nil
}

```

### Core Architecture Module: `pkg/daemon/util/cmdreporter.go`
```
/*
Copyright 2019 The Rook Authors. All rights reserved.

Licensed under the Apache License, Version 2.0 (the "License");
you may not use this file except in compliance with the License.
You may obtain a copy of the License at

	http://www.apache.org/licenses/LICENSE-2.0

Unless required by applicable law or agreed to in writing, software
distributed under the License is distributed on an "AS IS" BASIS,
WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
See the License for the specific language governing permissions and
limitations under the License.
*/

package util

import (
	"bytes"
	"context"
	"encoding/json"
	"fmt"
	"io"
	"os"
	"os/exec"
	"syscall"

	"github.com/coreos/pkg/capnslog"
	"github.com/rook/rook/pkg/operator/k8sutil"
	rookexec "github.com/rook/rook/pkg/util/exec"
	v1 "k8s.io/api/core/v1"
	"k8s.io/apimachinery/pkg/api/errors"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/client-go/kubernetes"
)

const (
	// CmdReporterAppName is the app name reported by cmd-reporter, notably on the ConfigMap's application label.
	CmdReporterAppName = "rook-cmd-reporter"

	// CmdReporterConfigMapStdoutKey defines the key in the ConfigMap where stdout is reported.
	CmdReporterConfigMapStdoutKey = "stdout"

	// CmdReporterConfigMapStderrKey defines the key in the ConfigMap where stderr is reported.
	CmdReporterConfigMapStderrKey = "stderr"

	// CmdReporterConfigMapRetcodeKey defines the key in the ConfigMap where the return code is reported.
	CmdReporterConfigMapRetcodeKey = "retcode"
)

var logger = capnslog.NewPackageLogger("github.com/rook/rook", "job-reporter-cmd")

// CmdReporter is a process intended to be run in simple Kubernetes jobs. The CmdReporter runs a
// command in a job and stores the results in a ConfigMap which can be read by the operator.
type CmdReporter struct {
	clientset     kubernetes.Interface
	cmd           []string
	args          []string
	configMapName string
	namespace     string
	context       context.Context
}

// NewCmdReporter creates a new CmdReporter and returns an error if cmd, configMapName, or Namespace aren't specified.
func NewCmdReporter(context context.Context, clientset kubernetes.Interface, cmd, args []string, configMapName, namespace string) (*CmdReporter, error) {
	if clientset == nil {
		return nil, fmt.Errorf("kubernetes client interface was not specified")
	}
	if len(cmd) == 0 || cmd[0] == "" {
		return nil, fmt.Errorf("cmd was not specified")
	}
	if configMapName == "" {
		return nil, fmt.Errorf("the config map name was not specified")
	}
	if namespace == "" {
		return nil, fmt.Errorf("the namespace must be specified")
	}
	return &CmdReporter{
		clientset:     clientset,
		cmd:           cmd,
		args:          args,
		configMapName: configMapName,
		namespace:     namespace,
		context:       context,
	}, nil
}

// Create a simple representation struct for a command and its args so that Go's native JSON
// (un)marshalling can be used to convert a Kubernetes representation of command+args into a string
// representation automatically without the user having to fiddle with specifying their command+args
// in string form manually.
type commandRepresentation struct {
	Cmd  []string `json:"cmd"`
	Args []string `json:"args"`
}

// CommandToCmdReporterFlagArgument converts a command and arguments in typical Kubernetes container format
// into a string representation of the command+args that is compatible with the job reporter's
// command line flag "--command".
// This only returns the argument to "--command" and not the "--command" text itself.
func CommandToCmdReporterFlagArgument(cmd []string, args []string) (string, error) {
	r := &commandRepresentation{Cmd: cmd, Args: args}
	b, err := json.Marshal(r)
	if err != nil {
		return "", fmt.Errorf("failed to marshal command+args into an argument string. %+v", err)
	}
	return string(b), nil
}

// CmdReporterFlagArgumentToCommand converts a string representation of a command compatible with the job
// reporter's command line flag "--command" into a command and arguments in typical Kubernetes
// container format, i.e., a list of command strings and a list of arguments.
// This function processes the argument to "--command" but not the "--command" text itself.
func CmdReporterFlagArgumentToCommand(flagArg string) (cmd []string, args []string, err error) {
	b := []byte(flagArg)
	r := &commandRepresentation{}
	if err := json.Unmarshal(b, r); err != nil {
		return []string{}, []string{}, fmt.Errorf("failed to unmarshal command from argument. %+v", err)
	}
	return r.Cmd, r.Args, nil
}

// Run a given command to completion, and store the Stdout, Stderr, and return code
// results of the command in a ConfigMap. If the ConfigMap already exists, the
// Stdout, Stderr, and return code data which may be present in the ConfigMap
// will be overwritten.
//
// If cmd-reporter succeeds in running the command to completion, no error is
// reported, even if the command's return code is nonzero (failure). Run will
// return an error if the command could not be run for any reason or if there was
// an error storing the command results into the ConfigMap. An application label
// is applied to the ConfigMap, and if the label already exists and has a
// different application's name, this returns an error, as this may indicate
// that it is not safe for cmd-reporter to edit the ConfigMap.
func (r *CmdReporter) Run() error {
	stdout, stderr, retcode, err := r.runCommand()
	if err != nil {
		return fmt.Errorf("system failed to run command. %+v", err)
	}

	if err := r.saveToConfigMap(stdout, stderr, retcode); err != nil {
		return fmt.Errorf("failed to save command output to ConfigMap. %+v", err)
	}

	return nil
}

var execCommand = exec.Command

func (r *CmdReporter) runCommand() (stdout, stderr string, retcode int, err error) {
	retcode = -1 // default retcode to -1

	baseCmd := r.cmd[0]
	fullArgs := append(r.cmd[1:], r.args...)

	var capturedStdout bytes.Buffer
	var capturedStderr bytes.Buffer

	// Capture stdout and stderr, and also send both to the container stdout/stderr, similar to the
	// 'tee' command
	stdoutTee := io.MultiWriter(&capturedStdout, os.Stdout)
	stderrTee := io.MultiWriter(&capturedStderr, os.Stdout)

	c := execCommand(baseCmd, fullArgs...)
	c.Stdout = stdoutTee
	c.Stderr = stderrTee

	cmdStr := rookexec.FormatCommand(c.Path, c.Args[1:]...)
	logger.Infof("running command: %s", cmdStr)

	if err := c.Run(); err != nil {
		if exitError, ok := err.(*exec.ExitError); ok {
			// c.ProcessState.ExitCode is available with Go 1.12 and could replace if block below
			if stat, ok := exitError.Sys().(syscall.WaitStatus); ok {
				retcode = stat.ExitStatus()
			}
			// it's possible the above failed to parse the return code, so report the whole error
			logger.Warningf("command finished unsuccessfully but return code could not be parsed. %+v", err)
		} else {
			return "", "", -1, fmt.Errorf("failed to run command [%s]. %+v", cmdStr, err)
		}
	} else {
		retcode = 0
	}

	return capturedStdout.String(), capturedStderr.String(), retcode, nil
}

func (r *CmdReporter) saveToConfigMap(stdout, stderr string, retcode int) error {
	retcodeStr := fmt.Sprintf("%d", retcode)

	k8s := r.clientset
	cm, err := k8s.CoreV1().ConfigMaps(r.namespace).Get(r.context, r.configMapName, metav1.GetOptions{})
	if err != nil {
		if !errors.IsNotFound(err) {
			return fmt.Errorf("failed to determine if ConfigMap %s is preexisting. %+v", r.configMapName, err)
		}

		// the given config map doesn't exist yet, create it now
		cm = &v1.ConfigMap{
			ObjectMeta: metav1.ObjectMeta{
				Name:      r.configMapName,
				Namespace: r.namespace,
				Labels: map[string]string{
					k8sutil.AppAttr: CmdReporterAppName,
				},
			},
			Data: map[string]string{
				CmdReporterConfigMapStdoutKey:  stdout,
				CmdReporterConfigMapStderrKey:  stderr,
				CmdReporterConfigMapRetcodeKey: retcodeStr,
			},
		}

		if _, err := k8s.CoreV1().ConfigMaps(r.namespace).Create(r.context, cm, metav1.CreateOptions{}); err != nil {
			return fmt.Errorf("failed to create ConfigMap %s. %+v", r.configMapName, err)
		}
		return nil
	}

	// if the operator has created the configmap with a different app name, we assume that we aren't
	// allowed to modify the ConfigMap
	if app, ok := cm.Labels[k8sutil.AppAttr]; !ok || (ok && app == "") {
		// label is unset or set to empty string
		cm.Labels[k8sutil.AppAttr] = CmdReporterAppName
	} else if ok && app != "" && app != CmdReporterAppName {
		// label is set and not equal to the cmd-reporter app name
		return fmt.Errorf("configMap [%s] already has label [%s] that differs from cmd-reporter's "+
			"label [%s]; this may indicate that it is not safe for cmd-reporter to modify the ConfigMap",
			r.configMapName, fmt.Sprintf("%s=%s", k8sutil.AppAttr, app), fmt.Sprintf("%s=%s", k8sutil.AppAttr, CmdReporterAppName))
	}

	for _, k := range []string{CmdReporterConfigMapStdoutKey, CmdReporterConfigMapStderrKey, CmdReporterConfigMapRetcodeKey} {
		if v, ok := cm.Data[k]; ok {
			logger.Warningf("ConfigMap [%s] data key [%s] is already set to [%s] and will be overwritten.", r.configMapName, k, v)
		}
	}

	// given configmap already exists, update it
	cm.Data[CmdReporterConfigMapStdoutKey] = stdout
	cm.Data[CmdReporterConfigMapStderrKey] = stderr
	cm.Data[CmdReporterConfigMapRetcodeKey] = retcodeStr

	if _, err := k8s.CoreV1().ConfigMaps(r.namespace).Update(r.context, cm, metav1.UpdateOptions{}); err != nil {
		return fmt.Errorf("failed to update ConfigMap %s. %+v", r.configMapName, err)
	}

	return nil
}

```

### Core Architecture Module: `pkg/operator/ceph/cluster/mon/util.go`
```
/*
Copyright 2017 The Rook Authors. All rights reserved.

Licensed under the Apache License, Version 2.0 (the "License");
you may not use this file except in compliance with the License.
You may obtain a copy of the License at

	http://www.apache.org/licenses/LICENSE-2.0

Unless required by applicable law or agreed to in writing, software
distributed under the License is distributed on an "AS IS" BASIS,
WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
See the License for the specific language governing permissions and
limitations under the License.
*/

package mon

import (
	"slices"
	"strings"

	"github.com/rook/rook/pkg/daemon/ceph/client"
	"github.com/rook/rook/pkg/operator/k8sutil"
	v1 "k8s.io/api/core/v1"
	"k8s.io/apimachinery/pkg/util/intstr"
)

func monInQuorum(monitor client.MonMapEntry, quorum []int) bool {
	return slices.Contains(quorum, monitor.Rank)
}

func getMonByID(monID string, monMap client.MonStatusResponse) (info client.MonMapEntry, inQuorum bool) {
	for _, mon := range monMap.MonMap.Mons {
		if mon.Name != monID {
			continue
		}
		monRank := mon.Rank
		return mon, slices.Contains(monMap.Quorum, monRank)
	}
	return client.MonMapEntry{}, false
}

// convert the mon name to the numeric mon ID
func fullNameToIndex(name string) (int, error) {
	// remove the "rook-ceph-mon" prefix
	name = strings.TrimPrefix(name, AppName)
	// remove the "-" prefix
	name = strings.TrimPrefix(name, "-")
	return k8sutil.NameToIndex(name)
}

// addServicePort adds a port to a service
func addServicePort(service *v1.Service, name string, port int32) {
	if port == 0 {
		return
	}
	service.Spec.Ports = append(service.Spec.Ports, v1.ServicePort{
		Name:       name,
		Port:       port,
		TargetPort: intstr.FromInt(int(port)),
		Protocol:   v1.ProtocolTCP,
	})
}

```

### Core Architecture Module: `pkg/operator/ceph/cluster/utils.go`
```
/*
Copyright 2020 The Rook Authors. All rights reserved.

Licensed under the Apache License, Version 2.0 (the "License");
you may not use this file except in compliance with the License.
You may obtain a copy of the License at

	http://www.apache.org/licenses/LICENSE-2.0

Unless required by applicable law or agreed to in writing, software
distributed under the License is distributed on an "AS IS" BASIS,
WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
See the License for the specific language governing permissions and
limitations under the License.
*/

// Package cluster to manage a Ceph cluster.
package cluster

import (
	"context"
	"strings"

	"github.com/pkg/errors"
	"github.com/rook/rook/pkg/clusterd"
	"github.com/rook/rook/pkg/operator/k8sutil"
	"github.com/rook/rook/pkg/util/log"
	v1 "k8s.io/api/core/v1"
	kerrors "k8s.io/apimachinery/pkg/api/errors"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
)

// populateConfigOverrideConfigMap creates the "rook-config-override" config map
// Its content allows modifying Ceph configuration flags
func populateConfigOverrideConfigMap(clusterdContext *clusterd.Context, namespace string, ownerInfo *k8sutil.OwnerInfo, clusterMetadata metav1.ObjectMeta) error {
	ctx := context.TODO()

	existingCM, err := clusterdContext.Clientset.CoreV1().ConfigMaps(namespace).Get(ctx, k8sutil.ConfigOverrideName, metav1.GetOptions{})
	if err != nil {
		if !kerrors.IsNotFound(err) {
			log.NamespacedWarning(namespace, logger, "failed to get cm %q to check labels and annotations", k8sutil.ConfigOverrideName)
			return nil
		}

		labels := map[string]string{}
		annotations := map[string]string{}
		initRequiredMetadata(clusterMetadata, labels, annotations)

		// Create the configmap since it doesn't exist yet
		placeholderConfig := map[string]string{
			k8sutil.ConfigOverrideVal: "",
		}
		cm := &v1.ConfigMap{
			ObjectMeta: metav1.ObjectMeta{
				Name:        k8sutil.ConfigOverrideName,
				Namespace:   namespace,
				Labels:      labels,
				Annotations: annotations,
			},
			Data: placeholderConfig,
		}

		err := ownerInfo.SetControllerReference(cm)
		if err != nil {
			return errors.Wrapf(err, "failed to set owner reference to override configmap %q", cm.Name)
		}
		_, err = clusterdContext.Clientset.CoreV1().ConfigMaps(namespace).Create(ctx, cm, metav1.CreateOptions{})
		if err != nil {
			return errors.Wrapf(err, "failed to create override configmap %s", namespace)
		}
		log.NamespacedInfo(namespace, logger, "created placeholder configmap for ceph overrides %q", cm.Name)
		return nil
	}

	// Ensure the annotations and labels are initialized
	if existingCM.Annotations == nil {
		existingCM.Annotations = map[string]string{}
	}
	if existingCM.Labels == nil {
		existingCM.Labels = map[string]string{}
	}

	// Add recommended labels and annotations to the existing configmap if it doesn't have any yet
	updateRequired := initRequiredMetadata(clusterMetadata, existingCM.Labels, existingCM.Annotations)
	if updateRequired {
		_, err = clusterdContext.Clientset.CoreV1().ConfigMaps(namespace).Update(ctx, existingCM, metav1.UpdateOptions{})
		if err != nil {
			log.NamespacedWarning(namespace, logger, "failed to add recommended labels and annotations to configmap %q. %v", existingCM.Name, err)
		} else {
			log.NamespacedInfo(namespace, logger, "added expected labels and annotations to configmap %q", existingCM.Name)
		}
	}
	// Ensure the config string has a trailing newline.
	if existingCM.Data != nil {
		if configVal, ok := existingCM.Data[k8sutil.ConfigOverrideVal]; ok && configVal != "" {
			if !strings.HasSuffix(configVal, "\n") {
				return errors.Errorf("invalid configmap %q: config data must end with a trailing newline", k8sutil.ConfigOverrideName)
			}
		}
	}
	return nil
}

func initRequiredMetadata(metadata metav1.ObjectMeta, labels, annotations map[string]string) bool {
	// Add the helm labels and annotations in case the user wants to install the cluster helm chart to start managing it
	releaseNameAttr := "meta.helm.sh/release-name"
	chartName, ok := metadata.Annotations[releaseNameAttr]
	if !ok {
		log.NamespacedDebug(metadata.Namespace, logger, "cluster helm chart is not configured, not adding helm annotations to configmap")
		return false
	}
	if _, ok := annotations[releaseNameAttr]; ok {
		log.NamespacedDebug(metadata.Namespace, logger, "cluster helm chart helm annotations already added to configmap")
		return false
	}

	log.NamespacedInfo(metadata.Namespace, logger, "adding helm chart name %q annotation to configmap", chartName)
	labels["app.kubernetes.io/managed-by"] = "Helm"
	annotations[releaseNameAttr] = chartName
	annotations["meta.helm.sh/release-namespace"] = metadata.Namespace
	return true
}

```

### Core Architecture Module: `pkg/operator/ceph/controller/controller_utils.go`
```
/*
Copyright 2020 The Rook Authors. All rights reserved.

Licensed under the Apache License, Version 2.0 (the "License");
you may not use this file except in compliance with the License.
You may obtain a copy of the License at

	http://www.apache.org/licenses/LICENSE-2.0

Unless required by applicable law or agreed to in writing, software
distributed under the License is distributed on an "AS IS" BASIS,
WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
See the License for the specific language governing permissions and
limitations under the License.
*/

package controller

import (
	"context"
	"fmt"
	"reflect"
	"runtime/debug"
	"slices"
	"strconv"
	"strings"
	"time"

	cephv1 "github.com/rook/rook/pkg/apis/ceph.rook.io/v1"
	"github.com/rook/rook/pkg/operator/k8sutil"
	"github.com/rook/rook/pkg/util/exec"
	"github.com/rook/rook/pkg/util/log"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/apimachinery/pkg/types"
	"sigs.k8s.io/controller-runtime/pkg/client"
	"sigs.k8s.io/controller-runtime/pkg/reconcile"
)

// OperatorConfig represents the configuration of the operator
type OperatorConfig struct {
	OperatorNamespace string
	Image             string
	ServiceAccount    string
	NamespaceToWatch  string
}

// ClusterHealth is passed to the various monitoring go routines to stop them when the context is cancelled
type ClusterHealth struct {
	InternalCtx    context.Context
	InternalCancel context.CancelFunc
}

const (
	// OperatorSettingConfigMapName refers to ConfigMap that configures rook ceph operator
	OperatorSettingConfigMapName   string = "rook-ceph-operator-config"
	enforceHostNetworkSettingName  string = "ROOK_ENFORCE_HOST_NETWORK"
	enforceHostNetworkDefaultValue string = "false"

	obcAllowAdditionalConfigFieldsSettingName  string = "ROOK_OBC_ALLOW_ADDITIONAL_CONFIG_FIELDS"
	obcAllowAdditionalConfigFieldsDefaultValue string = "maxObjects,maxSize"

	revisionHistoryLimitSettingName string = "ROOK_REVISION_HISTORY_LIMIT"

	// csiOperatorResourcesSettingName controls whether Rook creates the CephConnection and
	// ClientProfile CRs consumed by the ceph-csi-operator. Clusters that use no CSI driver,
	// such as object store only clusters, can disable this and skip installing the
	// ceph-csi-operator and its CRDs entirely.
	csiOperatorResourcesSettingName  string = "ROOK_CREATE_CSI_OPERATOR_RESOURCES"
	csiOperatorResourcesDefaultValue string = "true"

	// UninitializedCephConfigError refers to the error message printed by the Ceph CLI when there is no ceph configuration file
	// This typically is raised when the operator has not finished initializing
	UninitializedCephConfigError = "error calling conf_read_file"

	// OperatorNotInitializedMessage is the message we print when the Operator is not ready to reconcile, typically the ceph.conf has not been generated yet
	OperatorNotInitializedMessage = "skipping reconcile since operator is still initializing"
)

var (
	// ImmediateRetryResult is returned for an immediate retry of the reconciliation loop with the same request object.
	ImmediateRetryResult = reconcile.Result{Requeue: true}

	// WaitForRequeueIfCephClusterNotReady waits for the CephCluster to be ready
	WaitForRequeueIfCephClusterNotReady = reconcile.Result{Requeue: true, RequeueAfter: 10 * time.Second}

	// WaitForRequeueIfCephClusterIsUpgrading waits until the upgrade is complete
	WaitForRequeueIfCephClusterIsUpgrading = reconcile.Result{Requeue: true, RequeueAfter: time.Minute}

	// WaitForRequeueIfFinalizerBlocked waits for resources to be cleaned up before the finalizer can be removed
	WaitForRequeueIfFinalizerBlocked = reconcile.Result{Requeue: true, RequeueAfter: 10 * time.Second}

	// WaitForRequeueIfOperatorNotInitialized waits for the operator to finish initializing
	WaitForRequeueIfOperatorNotInitialized = reconcile.Result{Requeue: true, RequeueAfter: 10 * time.Second}

	// OperatorCephBaseImageVersion is the ceph version in the operator image
	OperatorCephBaseImageVersion string

	// loopDevicesAllowed indicates whether loop devices are allowed to be used
	loopDevicesAllowed          = false
	revisionHistoryLimit *int32 = nil

	// allowed OBC additional config fields
	obcAllowAdditionalConfigFields = strings.Split(obcAllowAdditionalConfigFieldsDefaultValue, ",")
)

func DiscoveryDaemonEnabled() bool {
	return k8sutil.GetOperatorSetting("ROOK_ENABLE_DISCOVERY_DAEMON", "false") == "true"
}

// CSIOperatorResourcesEnabled returns true if Rook should create and update the CephConnection
// and ClientProfile CRs consumed by the ceph-csi-operator. Clusters that use no CSI driver can
// disable this so the ceph-csi-operator and its CRDs are not required.
func CSIOperatorResourcesEnabled() bool {
	return k8sutil.GetOperatorSetting(csiOperatorResourcesSettingName, csiOperatorResourcesDefaultValue) == "true"
}

// SetCephCommandsTimeout sets the timeout value of Ceph commands which are executed from Rook
func SetCephCommandsTimeout() {
	strTimeoutSeconds := k8sutil.GetOperatorSetting("ROOK_CEPH_COMMANDS_TIMEOUT_SECONDS", "15")
	timeoutSeconds, err := strconv.Atoi(strTimeoutSeconds)
	if err != nil || timeoutSeconds < 1 {
		logger.Warningf("ROOK_CEPH_COMMANDS_TIMEOUT is %q but it should be >= 1, set the default value 15", strTimeoutSeconds)
		timeoutSeconds = 15
	}
	exec.CephCommandsTimeout = time.Duration(timeoutSeconds) * time.Second
}

func SetAllowLoopDevices() {
	strLoopDevicesAllowed := k8sutil.GetOperatorSetting("ROOK_CEPH_ALLOW_LOOP_DEVICES", "false")
	var err error
	loopDevicesAllowed, err = strconv.ParseBool(strLoopDevicesAllowed)
	if err != nil {
		logger.Warningf("ROOK_CEPH_ALLOW_LOOP_DEVICES is set to an invalid value %v, set the default value false", strLoopDevicesAllowed)
		loopDevicesAllowed = false
	}
}

func LoopDevicesAllowed() bool {
	return loopDevicesAllowed
}

func SetEnforceHostNetwork() {
	strval := k8sutil.GetOperatorSetting(enforceHostNetworkSettingName, enforceHostNetworkDefaultValue)
	val, err := strconv.ParseBool(strval)
	if err != nil {
		logger.Warningf("failed to parse value %q for %q. assuming false value", strval, enforceHostNetworkSettingName)
		cephv1.SetEnforceHostNetwork(false)
		return
	}
	cephv1.SetEnforceHostNetwork(val)
}

func EnforceHostNetwork() bool {
	return cephv1.EnforceHostNetwork()
}

func SetRevisionHistoryLimit() {
	strval := k8sutil.GetOperatorSetting(revisionHistoryLimitSettingName, "")
	var limit int32
	if strval == "" {
		logger.Debugf("not parsing empty string to int for %q. assuming default value.", revisionHistoryLimitSettingName)
		revisionHistoryLimit = nil
		return
	}
	numval, err := strconv.ParseInt(strval, 10, 32)
	if err != nil {
		logger.Warningf("failed to parse value %q for %q. assuming default value. %v", strval, revisionHistoryLimitSettingName, err)
		revisionHistoryLimit = nil
		return
	}
	limit = int32(numval)
	revisionHistoryLimit = &limit
}

func RevisionHistoryLimit() *int32 {
	return revisionHistoryLimit
}

func SetObcAllowAdditionalConfigFields() {
	strval := k8sutil.GetOperatorSetting(obcAllowAdditionalConfigFieldsSettingName, obcAllowAdditionalConfigFieldsDefaultValue)
	obcAllowAdditionalConfigFields = strings.Split(strval, ",")
}

func ObcAdditionalConfigKeyIsAllowed(configField string) bool {
	return slices.Contains(obcAllowAdditionalConfigFields, configField)
}

// canIgnoreHealthErrStatusInReconcile determines whether a status of HEALTH_ERR in the CephCluster can be ignored safely.
func canIgnoreHealthErrStatusInReconcile(cephCluster cephv1.CephCluster, controllerName string) bool {
	// Get a list of all the keys causing the HEALTH_ERR status.
	healthErrKeys := make([]string, 0)
	for key, health := range cephCluster.Status.CephStatus.Details {
		if health.Severity == "HEALTH_ERR" {
			healthErrKeys = append(healthErrKeys, key)
		}
	}

	// If there are no errors, the caller actually expects false to be returned so the absence
	// of an error doesn't cause the health status to be ignored. In production, if there are no
	// errors, we would anyway expect the health status to be ok or warning. False in this case
	// will cover if the health status is blank.
	if len(healthErrKeys) == 0 {
		return false
	}

	allowedErrStatus := map[string]struct{}{
		"MDS_ALL_DOWN":                            {},
		"MGR_MODULE_ERROR":                        {},
		"AUTH_INSECURE_SERVICE_KEY_TYPE":          {}, // rook can reconcile cephx keys to clear this
		"AUTH_INSECURE_ROTATING_SERVICE_KEY_TYPE": {}, // rook can reconcile cephx keys to clear this
		"AUTH_INSECURE_SERVICE_TICKETS":           {}, // rook can reconcile cephx keys to clear this
	}
	allCanBeIgnored := true
	for _, healthErrKey := range healthErrKeys {
		if _, ok := allowedErrStatus[healthErrKey]; !ok {
			allCanBeIgnored = false
			break
		}
	}
	if allCanBeIgnored {
		logger.Debugf("%q: ignoring ceph error status (full status is %+v)", controllerName, cephCluster.Status.CephStatus)
		return true
	}
	return false
}

// IsReadyToReconcile determines if a controller is ready to reconcile or not
func IsReadyToReconcile(ctx context.Context, c client.Client, namespacedName types.NamespacedName, controllerName string) (cephv1.CephCluster, bool, bool, reconcile.Result) {
	cephClusterExists := false

	// Running ceph commands won't work and the controller will keep re-queuing so I believe it's fine not to check
	// Make sure a CephCluster exists before doing anything
	var cephCluster cephv1.CephCluster
	clusterList := &cephv1.CephClusterList{}
	err := c.List(ctx, clusterList, client.InNamespace(namespacedName.Namespace))
	if err != nil {
		log.NamedError(namespacedName, logger, "%q: failed to fetch CephCluster %v", controllerName, err)
		return cephCluster, false, cephClusterExists, ImmediateRetryResult
	}
	if len(clusterList.Items) == 0 {
		log.NamedDebug(namespacedName, logger, "%q: no CephCluster resource found in namespace", controllerName)
		return cephCluster, false, cephClusterExists, WaitForRequeueIfCephClusterNotReady
	}
	cephCluster = clusterList.Item
```

### Core Architecture Module: `pkg/operator/ceph/object/bucket/util.go`
```
/*
Copyright 2018 The Kubernetes Authors.

Licensed under the Apache License, Version 2.0 (the "License");
you may not use this file except in compliance with the License.
You may obtain a copy of the License at

    http://www.apache.org/licenses/LICENSE-2.0

Unless required by applicable law or agreed to in writing, software
distributed under the License is distributed on an "AS IS" BASIS,
WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
See the License for the specific language governing permissions and
limitations under the License.
*/

package bucket

import (
	"fmt"

	"github.com/coreos/pkg/capnslog"
	bktv1alpha1 "github.com/kube-object-storage/lib-bucket-provisioner/pkg/apis/objectbucket.io/v1alpha1"
	"github.com/kube-object-storage/lib-bucket-provisioner/pkg/provisioner"
	"github.com/pkg/errors"
	cephv1 "github.com/rook/rook/pkg/apis/ceph.rook.io/v1"
	opcontroller "github.com/rook/rook/pkg/operator/ceph/controller"
	cephObject "github.com/rook/rook/pkg/operator/ceph/object"
	"github.com/rook/rook/pkg/util/log"
	storagev1 "k8s.io/api/storage/v1"
	kerrors "k8s.io/apimachinery/pkg/api/errors"
	"k8s.io/apimachinery/pkg/api/resource"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/apimachinery/pkg/types"
	"k8s.io/client-go/rest"
)

var logger = capnslog.NewPackageLogger("github.com/rook/rook", "op-bucket-prov")

const (
	CephUser             = "cephUser"
	ObjectStoreName      = "objectStoreName"
	ObjectStoreNamespace = "objectStoreNamespace"
	objectStoreEndpoint  = "endpoint"
)

func NewBucketController(cfg *rest.Config, p *Provisioner) (*provisioner.Provisioner, error) {
	const allNamespaces = ""
	provName, err := cephObject.GetObjectBucketProvisioner(p.clusterInfo.Namespace)
	if err != nil {
		return nil, errors.Wrap(err, "failed to get provisioner name")
	}

	logger.Infof("ceph bucket provisioner launched watching for provisioner %q", provName)
	return provisioner.NewProvisioner(cfg, provName, p, allNamespaces)
}

func getObjectStoreName(sc *storagev1.StorageClass) string {
	return sc.Parameters[ObjectStoreName]
}

func getObjectStoreEndpoint(sc *storagev1.StorageClass) string {
	return sc.Parameters[objectStoreEndpoint]
}

func getBucketName(ob *bktv1alpha1.ObjectBucket) string {
	return ob.Spec.Endpoint.BucketName
}

func isStaticBucket(sc *storagev1.StorageClass) (string, bool) {
	const key = "bucketName"
	val, ok := sc.Parameters[key]
	return val, ok
}

func getCephUser(ob *bktv1alpha1.ObjectBucket) string {
	return ob.Spec.AdditionalState[CephUser]
}

func (p *Provisioner) getObjectStore() (*cephv1.CephObjectStore, error) {
	ctx := p.clusterInfo.Context
	// Verify the object store API object actually exists
	store, err := p.context.RookClientset.CephV1().CephObjectStores(p.clusterInfo.Namespace).Get(ctx, p.objectStoreName, metav1.GetOptions{})
	if err != nil {
		if kerrors.IsNotFound(err) {
			return nil, errors.Wrap(err, "cephObjectStore not found")
		}
		return nil, errors.Wrapf(err, "failed to get ceph object store %q", p.objectStoreName)
	}
	return store, err
}

func additionalConfigSpecFromMap(config map[string]string) (*additionalConfigSpec, error) {
	var err error
	spec := additionalConfigSpec{}

	if _, ok := config["maxObjects"]; ok {
		if !opcontroller.ObcAdditionalConfigKeyIsAllowed("maxObjects") {
			return nil, errors.Errorf("OBC config %q is not allowed", "maxObjects")
		}
		spec.maxObjects, err = quanityToInt64(config["maxObjects"])
		if err != nil {
			return nil, errors.Wrapf(err, "failed to parse maxObjects quota")
		}
	}

	if _, ok := config["maxSize"]; ok {
		if !opcontroller.ObcAdditionalConfigKeyIsAllowed("maxSize") {
			return nil, errors.Errorf("OBC config %q is not allowed", "maxSize")
		}
		spec.maxSize, err = quanityToInt64(config["maxSize"])
		if err != nil {
			return nil, errors.Wrapf(err, "failed to parse maxSize quota")
		}
	}

	if _, ok := config["bucketMaxObjects"]; ok {
		if !opcontroller.ObcAdditionalConfigKeyIsAllowed("bucketMaxObjects") {
			return nil, errors.Errorf("OBC config %q is not allowed", "bucketMaxObjects")
		}
		spec.bucketMaxObjects, err = quanityToInt64(config["bucketMaxObjects"])
		if err != nil {
			return nil, errors.Wrapf(err, "failed to parse bucketMaxObjects quota")
		}
	}

	if _, ok := config["bucketMaxSize"]; ok {
		if !opcontroller.ObcAdditionalConfigKeyIsAllowed("bucketMaxSize") {
			return nil, errors.Errorf("OBC config %q is not allowed", "bucketMaxSize")
		}
		spec.bucketMaxSize, err = quanityToInt64(config["bucketMaxSize"])
		if err != nil {
			return nil, errors.Wrapf(err, "failed to parse bucketMaxSize quota")
		}
	}

	if _, ok := config["bucketPolicy"]; ok {
		if !opcontroller.ObcAdditionalConfigKeyIsAllowed("bucketPolicy") {
			return nil, errors.Errorf("OBC config %q is not allowed", "bucketPolicy")
		}
		policy := config["bucketPolicy"]
		spec.bucketPolicy = &policy
	}

	if _, ok := config["bucketLifecycle"]; ok {
		if !opcontroller.ObcAdditionalConfigKeyIsAllowed("bucketLifecycle") {
			return nil, errors.Errorf("OBC config %q is not allowed", "bucketLifecycle")
		}
		lifecycle := config["bucketLifecycle"]
		spec.bucketLifecycle = &lifecycle
	}

	if _, ok := config["bucketOwner"]; ok {
		if !opcontroller.ObcAdditionalConfigKeyIsAllowed("bucketOwner") {
			return nil, errors.Errorf("OBC config %q is not allowed", "bucketOwner")
		}
		bucketOwner := config["bucketOwner"]
		spec.bucketOwner = &bucketOwner
	}

	return &spec, nil
}

func GetObjectStoreNameFromBucket(ob *bktv1alpha1.ObjectBucket) (types.NamespacedName, error) {
	// Rook v1.11 OBCs have additional state labels that tell the object store namespace and name.
	// This is critical for CephObjectStores in external mode that connect to RGW endpoints directly
	// which don't have a deterministic domain structure.
	nsName, err := getNSNameFromAdditionalState(ob.Spec.AdditionalState)
	if err == nil {
		return nsName, nil
	}

	// TODO: remove after Rook v1.12
	// Older OBCs don't have the additional state labels, but they will always be configured to use
	// the legacy CephObjectStore Service which has a deterministic domain structure.
	log.NamedDebug(nsName, logger, "falling back to legacy method for determining OBC \"%s/%s\"'s CephObjectStore from endpoint %q",
		ob.Namespace, ob.Name, ob.Spec.Connection.Endpoint.BucketHost)
	nsName, err = cephObject.ParseDomainName(ob.Spec.Connection.Endpoint.BucketHost)
	if err != nil {
		return types.NamespacedName{}, errors.Wrapf(err, "malformed BucketHost %q", ob.Spec.Endpoint.BucketHost)
	}

	return nsName, nil
}

func getNSNameFromAdditionalState(state map[string]string) (types.NamespacedName, error) {
	name, ok := state[ObjectStoreName]
	if !ok {
		return types.NamespacedName{}, fmt.Errorf("failed to get %q from OB additional state: %v", ObjectStoreName, state)
	}
	namespace, ok := state[ObjectStoreNamespace]
	if !ok {
		return types.NamespacedName{}, fmt.Errorf("failed to get %q from OB additional state: %v", ObjectStoreNamespace, state)
	}
	return types.NamespacedName{Name: name, Namespace: namespace}, nil
}

func quanityToInt64(qty string) (*int64, error) {
	n, err := resource.ParseQuantity(qty)
	if err != nil {
		return nil, errors.Wrapf(err, "failed to parse %q as a quantity", qty)
	}

	value := n.Value()

	return &value, nil
}

```

### Core Architecture Module: `pkg/operator/k8sutil/cmdreporter/cmdreporter.go`
```
/*
Copyright 2019 The Rook Authors. All rights reserved.

Licensed under the Apache License, Version 2.0 (the "License");
you may not use this file except in compliance with the License.
You may obtain a copy of the License at

	http://www.apache.org/licenses/LICENSE-2.0

Unless required by applicable law or agreed to in writing, software
distributed under the License is distributed on an "AS IS" BASIS,
WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
See the License for the specific language governing permissions and
limitations under the License.
*/

package cmdreporter

import (
	"context"
	"fmt"
	"path"
	"strconv"
	"time"

	"github.com/coreos/pkg/capnslog"
	"github.com/pkg/errors"
	cephv1 "github.com/rook/rook/pkg/apis/ceph.rook.io/v1"
	"github.com/rook/rook/pkg/daemon/util"
	"github.com/rook/rook/pkg/operator/k8sutil"
	batch "k8s.io/api/batch/v1"
	v1 "k8s.io/api/core/v1"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/apimachinery/pkg/fields"
	watch "k8s.io/apimachinery/pkg/watch"
	"k8s.io/client-go/kubernetes"
)

const (
	// CmdReporterContainerName defines the name of the CmdReporter container which runs the
	// 'rook cmd-reporter' command.
	CmdReporterContainerName = "cmd-reporter"

	// CopyBinariesInitContainerName defines the name of the CmdReporter init container which copies
	// the 'rook' binary.
	CopyBinariesInitContainerName = "init-copy-binaries"

	// CopyBinariesMountDir defines the dir into which the 'rook' binary will be copied
	// in the CmdReporter job pod's containers.
	CopyBinariesMountDir = "/rook/copied-binaries"
)

var logger = capnslog.NewPackageLogger("github.com/rook/rook", "CmdReporter")

type CmdReporterInterface interface {
	Job() *batch.Job
	Run(ctx context.Context, timeout time.Duration) (stdout, stderr string, retcode int, retErr error)
}

// CmdReporter is a wrapper for Rook's cmd-reporter commandline utility allowing operators to use
// the utility without fully specifying the job, pod, and container templates manually.
type CmdReporter struct {
	// inputs
	clientset kubernetes.Interface

	// filled in during creation
	job *batch.Job
}

type cmdReporterCfg struct {
	clientset       kubernetes.Interface
	ownerInfo       *k8sutil.OwnerInfo
	appName         string
	jobName         string
	jobNamespace    string
	cmd             []string
	args            []string
	rookImage       string
	runImage        string
	imagePullPolicy v1.PullPolicy
	resources       cephv1.ResourceSpec
}

// New creates a new CmdReporter.
//
// All parameters must be set with the exception of the arg list which is allowed to be empty.
//
// The common app label will be applied to the job and pod specs which CmdReporter creates
// identified by the app name specified. The job and the configmap which returns the result of the
// job will be identified with the job name specified. Everything will be created in the job
// namespace and will be owned by the owner reference given.
//
// The Rook image defines the Rook image from which the 'rook' binary will be taken in
// order to run the cmd and args in the run image. If the run image is the same as the Rook image,
// then the command will run without the binaries being copied from the same Rook image.
func New(
	clientset kubernetes.Interface,
	ownerInfo *k8sutil.OwnerInfo,
	appName, jobName, jobNamespace string,
	cmd, args []string,
	rookImage, runImage string,
	imagePullPolicy v1.PullPolicy,
	resources cephv1.ResourceSpec,
) (CmdReporterInterface, error) {
	cfg := &cmdReporterCfg{
		clientset:       clientset,
		ownerInfo:       ownerInfo,
		appName:         appName,
		jobName:         jobName,
		jobNamespace:    jobNamespace,
		cmd:             cmd,
		args:            args,
		rookImage:       rookImage,
		runImage:        runImage,
		imagePullPolicy: imagePullPolicy,
		resources:       resources,
	}

	// Validate contents of config struct, not inputs to function to catch any developer errors
	// mis-assigning config items to the struct.
	if cfg.clientset == nil || cfg.ownerInfo == nil {
		return nil, fmt.Errorf("clientset [%+v] and owner info [%+v] must be specified", cfg.clientset, cfg.ownerInfo)
	}
	if cfg.appName == "" || cfg.jobName == "" || cfg.jobNamespace == "" {
		return nil, fmt.Errorf("app name [%s], job name [%s], and job namespace [%s] must be specified", cfg.appName, cfg.jobName, cfg.jobNamespace)
	}
	// at least one command must be set, and it cannot be an empty string
	if len(cfg.cmd) == 0 || cfg.cmd[0] == "" {
		return nil, fmt.Errorf("command [%+v] must be specified", cfg.cmd)
	}
	if cfg.rookImage == "" || cfg.runImage == "" {
		return nil, fmt.Errorf("rook image [%s] and run image [%s] must be specified", cfg.rookImage, cfg.runImage)
	}

	job, err := cfg.initJobSpec()
	if err != nil {
		return nil, fmt.Errorf("failed to create Kubernetes job spec for CmdReporter job %s. %+v", jobName, err)
	}
	return &CmdReporter{
		clientset: cfg.clientset,
		job:       job,
	}, nil
}

// Job returns a pointer to the basic, filled-out Kubernetes job which will run the CmdReporter. The
// operator may add additional information to this spec, such as labels, environment variables,
// volumes, volume mounts, etc. before the CmdReporter is run.
func (cr *CmdReporter) Job() *batch.Job {
	return cr.job
}

// Run runs the Kubernetes job and waits for the output ConfigMap. It returns the stdout, stderr,
// and retcode of the command as long as the image ran it, even if the retcode is nonzero (failure).
// An error is reported only if the command was not run to completion successfully. When this
// returns, the ConfigMap is cleaned up (destroyed).
func (cr *CmdReporter) Run(ctx context.Context, timeout time.Duration) (stdout, stderr string, retcode int, retErr error) {
	jobName := cr.job.Name
	namespace := cr.job.Namespace
	errMsg := fmt.Sprintf("failed to run CmdReporter %s successfully", jobName)

	// the configmap MUST be deleted, because we will wait on its presence to determine when the
	// job is done running
	delOpts := &k8sutil.DeleteOptions{}
	delOpts.Wait = true
	delOpts.ErrorOnTimeout = true
	// configmap's name will be the same as the app
	err := k8sutil.DeleteConfigMap(ctx, cr.clientset, jobName, namespace, delOpts)
	if err != nil {
		return "", "", -1, fmt.Errorf("%s. failed to delete existing results ConfigMap %s. %+v", errMsg, jobName, err)
	}

	if err := k8sutil.RunReplaceableJob(ctx, cr.clientset, cr.job, true); err != nil {
		return "", "", -1, fmt.Errorf("%s. failed to run job. %+v", errMsg, err)
	}

	if err := cr.waitForConfigMap(ctx, timeout); err != nil {
		return "", "", -1, fmt.Errorf("%s. failed waiting for results ConfigMap %s. %+v", errMsg, jobName, err)
	}
	logger.Debugf("job %s has returned results", jobName)

	resultMap, err := cr.clientset.CoreV1().ConfigMaps(namespace).Get(ctx, jobName, metav1.GetOptions{})
	if err != nil {
		return "", "", -1, fmt.Errorf("%s. results ConfigMap %s should be available, but got an error instead. %+v", errMsg, jobName, err)
	}

	if err := k8sutil.DeleteBatchJob(ctx, cr.clientset, namespace, jobName, false); err != nil {
		logger.Errorf("continuing after failing delete job %s; user may need to delete it manually. %+v", jobName, err)
	}

	// just to be explicit: delete idempotently, and don't wait for delete to complete
	delOpts = &k8sutil.DeleteOptions{MustDelete: false, WaitOptions: k8sutil.WaitOptions{Wait: false}}
	if err := k8sutil.DeleteConfigMap(ctx, cr.clientset, jobName, namespace, delOpts); err != nil {
		logger.Errorf("continuing after failing to delete ConfigMap %s for job %s; user may need to delete it manually. %+v",
			jobName, jobName, err)
	}

	dat := resultMap.Data
	var ok bool
	if stdout, ok = dat[util.CmdReporterConfigMapStdoutKey]; !ok {
		return "", "", -1, fmt.Errorf("%s. cmd-reporter did not populate stdout in ConfigMap", errMsg)
	}
	if stderr, ok = dat[util.CmdReporterConfigMapStderrKey]; !ok {
		return "", "", -1, fmt.Errorf("%s. cmd-reporter did not populate stderr in ConfigMap", errMsg)
	}
	var strRetcode string
	if strRetcode, ok = dat[util.CmdReporterConfigMapRetcodeKey]; !ok {
		return "", "", -1, fmt.Errorf("%s. cmd-reporter did not populate retcode in ConfigMap", errMsg)
	}
	if retcode, err = strconv.Atoi(strRetcode); err != nil {
		return "", "", -1, fmt.Errorf("%s. cmd-reporter returned a retcode value [%s] that could not be parsed to an int. %+v", errMsg, strRetcode, err)
	}

	return stdout, stderr, retcode, nil
}

// return a watcher or nil if the configmap exists
func (cr *CmdReporter) newWatcher(ctx context.Context) (watch.Interface, error) {
	jobName := cr.job.Name
	namespace := cr.job.Namespace

	listOpts := metav1.ListOptions{
		TypeMeta: metav1.TypeMeta{
			Kind: "ConfigMap",
		},
		FieldSelector: fields.OneTermEqualSelector("metadata.name", jobName).String(),
	}

	list, err := cr.clientset.CoreV1().ConfigMaps(namespace).List(ctx, listOpts)
	if err != nil {
		return nil, fmt.Errorf("failed to list the current ConfigMaps in order to start ConfigMap watcher. %+v", err)
	}
	if len(list.Items) > 0 {
		return nil, nil // exists
	}

	watchOpts := listOpts.DeepCopy()
	watchOpts.Watch = true
	watchOpts.ResourceVersion = list.ResourceVersion

	watcher, err := cr.clientset.CoreV1().ConfigMaps(namespace).Watch(ctx, *watchOpts)
	if err != nil {
		return nil, fmt.Errorf("failed to start ConfigMap watcher. %+v", err)
	}

	return watcher, nil
}

// return nil when the configmap exists
func (cr *CmdReporter) waitForConfigMap(ctx context.Context, timeout time.Duration) error {
	jobName := cr.job.Name

	watcher, err := cr.newWatcher(ctx)
	if err != nil {
		return fmt.Errorf("failed to start watcher for the results ConfigMap. %+v", err)
	}
	if watcher == nil {
		return nil
	}
	defer func() {
		if watcher != nil {
			watcher.Stop()
		}
	}()

	// timeout timer cannot be started inline in the select statement, or the timeout will be
	// restarted any time k8s hangs up on the watcher and a new watcher is started
	ctxWithTimeout, cancelFunc := conte
```

### Core Architecture Module: `pkg/operator/k8sutil/configmap.go`
```
/*
Copyright 2019 The Rook Authors. All rights reserved.

Licensed under the Apache License, Version 2.0 (the "License");
you may not use this file except in compliance with the License.
You may obtain a copy of the License at

	http://www.apache.org/licenses/LICENSE-2.0

Unless required by applicable law or agreed to in writing, software
distributed under the License is distributed on an "AS IS" BASIS,
WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
See the License for the specific language governing permissions and
limitations under the License.
*/

package k8sutil

import (
	"context"
	"fmt"
	"os"
	"time"

	"github.com/pkg/errors"
	v1 "k8s.io/api/core/v1"
	kerrors "k8s.io/apimachinery/pkg/api/errors"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/apimachinery/pkg/types"
	"k8s.io/client-go/kubernetes"
)

var loadedOperatorSettings bool

// DeleteConfigMap deletes a ConfigMap.
func DeleteConfigMap(ctx context.Context, clientset kubernetes.Interface, cmName, namespace string, opts *DeleteOptions) error {
	k8sOpts := BaseKubernetesDeleteOptions()
	delete := func() error { return clientset.CoreV1().ConfigMaps(namespace).Delete(ctx, cmName, *k8sOpts) }
	verify := func() error {
		_, err := clientset.CoreV1().ConfigMaps(namespace).Get(ctx, cmName, metav1.GetOptions{})
		return err
	}
	resource := fmt.Sprintf("ConfigMap %s", cmName)
	defaultWaitOptions := &WaitOptions{RetryCount: 20, RetryInterval: 2 * time.Second}
	return DeleteResource(delete, verify, resource, opts, defaultWaitOptions)
}

func CreateOrUpdateConfigMap(ctx context.Context, clientset kubernetes.Interface, cm *v1.ConfigMap) (*v1.ConfigMap, error) {
	name := cm.GetName()
	namespace := cm.GetNamespace()
	existingCm, err := clientset.CoreV1().ConfigMaps(namespace).Get(ctx, name, metav1.GetOptions{})
	if err != nil {
		if kerrors.IsNotFound(err) {
			cm, err := clientset.CoreV1().ConfigMaps(namespace).Create(ctx, cm, metav1.CreateOptions{})
			if err != nil {
				return nil, errors.Wrapf(err, "failed to create %q configmap", name)
			}
			return cm, nil
		}

		return nil, errors.Wrapf(err, "failed to retrieve %q configmap.", name)
	}

	existingCm.Data = cm.Data
	existingCm.OwnerReferences = cm.OwnerReferences
	if existingCm, err := clientset.CoreV1().ConfigMaps(namespace).Update(ctx, existingCm, metav1.UpdateOptions{}); err != nil {
		return nil, errors.Wrapf(err, "failed to update existing %q configmap", existingCm.Name)
	}

	return existingCm, nil
}

// GetOperatorSetting gets the operator setting from Env Var merged with ConfigMap
// returns defaultValue if setting is not found
func GetOperatorSetting(settingName, defaultValue string) string {
	if !loadedOperatorSettings {
		logger.Warningf("WARNING: attempting to load operator setting %q before configmap is loaded", settingName)
	}
	if settingValue, ok := os.LookupEnv(settingName); ok {
		return settingValue
	}
	return defaultValue
}

func ApplyOperatorSettingsConfigmap(ctx context.Context, clientset kubernetes.Interface) error {
	namespacedName := types.NamespacedName{Namespace: os.Getenv(PodNamespaceEnvVar), Name: "rook-ceph-operator-config"}
	logger.Debugf("loading operator settings configmap from %v", namespacedName)
	opConfig, err := clientset.CoreV1().ConfigMaps(namespacedName.Namespace).Get(ctx, namespacedName.Name, metav1.GetOptions{})
	if err != nil {
		if kerrors.IsNotFound(err) {
			loadedOperatorSettings = true
			logger.Debug("operator's configmap resource not found. will use default value or env var.")
			return nil
		}
		return err
	}

	for key, value := range opConfig.Data {
		currentValue := os.Getenv(key)
		if currentValue == value {
			continue
		}
		logger.Infof("operator setting %q = %q", key, value)
		if err := os.Setenv(key, value); err != nil {
			logger.Errorf("failed to set env var %q = %q. %v", key, value, err)
		}
	}
	loadedOperatorSettings = true
	logger.Debug("done loading operator settings configmap")
	return nil
}

```


### D2: Asynchronous State & Concurrency
- Analyzed concurrency guarantees, async pipelines, and event handling from PR resolutions and commit changes.

### D3: Error Boundaries, Recovery & Rollbacks
- Exception handling patterns and defect resolutions extracted from closed production bug issues:
- **Issue #18427** (2026-09-21): **`util.retry` is stuck for 600 seconds if the cephCluster is updated while retry is running.**
  *Symptoms*: <!-- **Are you in the right place?** 1. For issues or feature requests, please create an issue in this repository. 2. For general technical and non-technical questions, we are happy to help you on our [Rook.io Slack](https://slack.rook.io/). 3. Did you already search the existing open issues for anything similar? -->  **Is this a bug report or feature request?** * Bug Report  **Deviation from expected behavior:** - util.retry retries with cancelled context.  **Expected behavior:** - util.retry should stop retrying with cancelled context.  **How to reproduce it (minimal and precise):** <!-- Please let us know any circumstances for reproduction of your bug. --> - Update the cephcluster such that operator will check `ok-to-stop` on mons. For example, upgrade cluster.  - Ensure that `ok-to-stop` logic is retried.  - Now update the cephCluster so that operator manager is reloaded.    **File(s) to submit**:  * Cluster CR (custom resource), typically called `cluster.yaml`, if necessary  **Logs to submit**:  ``` 618:  2026-09-07T01:53:51.754194172Z  util: retrying after 1m0s, last error: deployment rook-ceph-mon-a cannot be stopped. . Error EBUSY: not enough monitors would be available (b) after stopping mons a: exit status 16   1434: 2026-09-07T01:54:51.754426823Z  util: retrying after 1m0s, last error: deployment rook-ceph-mon-a cannot be stopped. : context canceled   1500: 2026-09-07T01:55:51.755376250Z  util: retrying after 1m0s, last error: deployment rook-ceph-mon-a cannot be s

- **Issue #18398** (2026-09-16): **Changing the default pool placement makes objects in existing buckets unreadable**
  *Symptoms*: ### Affected versions  all(1.18+)  ### Steps to reproduce  Store with two placements, `p1` default:  ```yaml spec:   sharedPools:     poolPlacements:       - {name: p1, default: true, metadataPoolName: p1-meta, dataPoolName: p1-data}       - {name: p2,                metadataPoolName: p2-meta, dataPoolName: p2-data} ```  ``` PUT /b1   LocationConstraint: <zonegroup>:default-placement PUT /b1/obj   body: DATA GET /b1/obj   -> 200 DATA ```  Move `default: true` from `p1` to `p2`, wait for reconcile, restart the RGW pod:  ``` GET /                  -> 200, b1 still listed GET /b1?list-type=2    -> 200, zero keys GET /b1/obj            -> 404 NoSuchKey ```  Nothing is deleted — the object is still in `p1-data`. Moving `default: true` back to `p1` restores access.  #### Which buckets are affected  Only buckets whose `placement_rule` is `default-placement`. Buckets on a named placement (`p1`, `p2`, …) are never affected — Rook does not re-point those entries.  ### Cause  In RGW, placement is split across the two JSONs:  - **zonegroup** — which placement names exist, and which one is the default:    ```json   {     "default_placement": "p1",     "placement_targets": [       {"name": "default-placement"}, {"name": "p1"}, {"name": "p2"}     ]   }   ```  - **zone** — what pools each of those names actually maps to:    ```json   {     "placement_pools": [       {"key": "default-placement", "val": {"index_pool": "p1-meta:...", "storage_classes": {"STANDARD": {"data_pool": "p1-data:..."}}

- **Issue #18379** (2026-09-14): **osd: callCephVolume logs ceph.cephx_lockbox_secret at DEBUG, the level OSD jobs are pinned to**
  *Symptoms*: > This is @jhoblitt's AI agent.  **Is this a bug report or feature request?** * Bug Report  **Deviation from expected behavior:**  `callCephVolume` logs the full `ceph-volume` response at DEBUG on every successful call:  https://github.com/rook/rook/blob/ed913a842168d8620d972a9563390a294c1930e5/pkg/daemon/ceph/osd/volume.go#L1590  and at ERROR when the call fails:  https://github.com/rook/rook/blob/ed913a842168d8620d972a9563390a294c1930e5/pkg/daemon/ceph/osd/volume.go#L1583  For `ceph-volume lvm list` and `ceph-volume raw list`, that response carries the `ceph.cephx_lockbox_secret` tag for every encrypted OSD, so the lockbox secret lands in the OSD prepare pod log on every reconcile. It is not opt-in: every OSD-side job pins its own log level to DEBUG regardless of what the operator runs at —  - provision: https://github.com/rook/rook/blob/ed913a842168d8620d972a9563390a294c1930e5/pkg/operator/ceph/cluster/osd/provision_spec.go#L206 - key rotation: https://github.com/rook/rook/blob/ed913a842168d8620d972a9563390a294c1930e5/pkg/operator/ceph/cluster/osd/key_rotation.go#L72 - replace: https://github.com/rook/rook/blob/ed913a842168d8620d972a9563390a294c1930e5/pkg/operator/ceph/cluster/osd/replace_job.go#L135  This sits outside the model `pkg/util/logging.go` establishes, where DEBUG is meant to be credential-free and only the undocumented `ROOK_LOG_LEVEL=TRACE_INSECURE` unlocks output that may carry secrets:  https://github.com/rook/rook/blob/ed913a842168d8620d972a9563390a294c1930
  **Post-Mortem & Fix Analysis**:
  > I'd like to work on this.
  > On second look I won't be able to pick this one up right now — leaving it available for someone else.
  > I will take this. Plan: redact the lockbox secret from the ceph-volume response before `callCephVolume` logs it at DEBUG, with a unit test that feeds a response containing `ceph.cephx_lockbox_secret` and asserts the logged text does not.

- **Issue #18370** (2026-09-21): **Ceph mons wedge / never hold quorum on Ubuntu 26.04 HA (kernel 7.0.0-31-generic); identical stack healthy on 22.04**
  *Symptoms*: Is this a bug report or feature request? - Bug Report  Deviation from expected behavior:  On a fresh HA cluster with nodes running Ubuntu 26.04 (kernel 7.0.0-31-generic), the Ceph MONs cannot hold a stable quorum. The cluster briefly reaches HEALTH_OK (~6 minutes) and then flaps to HEALTH_ERR with failed to get status ... timed out. MONs settle into probing/electing and never re-form quorum. At least one MON process wedges: its local admin socket becomes unresponsive (ceph --admin-daemon /run/ceph/ceph-mon.<id>.asok mon_status hangs / times out), while the process sits in State: S on futex_do_wait at ~0% CPU (only a few seconds of CPU over 20+ minutes). MON logs repeatedly show:  cephx server client.admin: handle_request failed to decode CephXAuthenticate: End of buffer [buffer:2]  Because quorum never stabilizes, the operator keeps skipping reconcile since ceph health is HEALTH_ERR, and CephBlockPool/rbdpool never leaves Progressing, so the install blocks waiting for it to become Ready.  Key point: the identical Rook + Ceph + Kubernetes stack is healthy on Ubuntu 22.04 HA, and the same 26.04 image works fine in single-node mode (which does not deploy Ceph). The failure appears only on Ubuntu 26.04 in the HA (multi-MON) configuration.  Expected behavior:  MONs form a stable quorum, the MON admin socket stays responsive, ceph status returns HEALTH_OK with mon: 3 daemons, quorum a,b,c, and CephBlockPool/rbdpool reaches Ready — exactly as it does with the same stack on Ubuntu 22
  **Post-Mortem & Fix Analysis**:
  > If the mons are not maintaining quorum, the kernel or nftables sound like they could be related since those are the main differences in the env. There are no other networking differences? You might open a [Ceph tracker](https://tracker.ceph.com/) to see if the core ceph team knows of any issues with that config. 
  > > If the mons are not maintaining quorum, the kernel or nftables sound like they could be related since those are the main differences in the env. There are no other networking differences? You might open a [Ceph tracker](https://tracker.ceph.com/) to see if the core ceph team knows of any issues with that config.  Thanks — we chased the networking angle you pointed at. Findings:  kube-proxy runs in IPVS mode, and Rook advertises the mons on Service ClusterIPs, so all mon↔mon msgr traffic is IPVS-load-balanced. On Ubuntu 26.04 (Linux 7.0.0-31-generic), kube-proxy's IPVS conntrack workarounds are gated on kernel version and don't recognize 7.0, so it left:    - net.netfilter.nf_conntrack_tcp_be_liberal = 0 (should be 1 for IPVS)    - net.ipv4.vs.conn_reuse_mode = 1 (the classic kubernetes#81775 issue)   We set both correctly on every node (be_liberal=1, conn_reuse_mode=0). It helps but doesn't fully fix it — on a fresh HA install the mon quorum still flaps (quorum_age resets to seconds;
  > Ceph-tracker is here btw. https://tracker.ceph.com/issues/80470  No assigners or replies as of now.

- **Issue #18291** (2026-08-26): **security.cephx.*.keyGeneration CRD schema invalid: uint32 Maximum exceeds int32 format bound**
  *Symptoms*: ## Bug Report  **Is this a bug report or feature request?** * Bug Report  ### Deviation from expected behavior  Setting `spec.security.cephx.daemon.keyRotationPolicy: KeyGeneration` plus any `spec.security.cephx.daemon.keyGeneration` value on a `CephCluster` fails Kubernetes API server validation, regardless of the value supplied:  ``` CephCluster.ceph.rook.io "storage" is invalid: <nil>: Invalid value: "": Maximum boundary value must be of type integer with format int32 in spec.security.cephx.daemon.keyGeneration ```  This makes it impossible to use the new CephX key rotation feature (introduced to remediate CVE-2025-30156) for daemon keys on any cluster running this CRD version. The same struct (`CephxConfig`) is reused for `security.cephx.csi` and `security.cephx.rbdMirrorPeer`, so those are presumably affected identically, though I have only reproduced it against `daemon`.  ### Expected behavior  Setting a valid, increasing `keyGeneration` value (e.g. `2`) with `keyRotationPolicy: KeyGeneration` should be accepted by the API server and trigger key rotation as documented in [CephX Keys and Rotation](https://rook.io/docs/rook/latest-release/Storage-Configuration/Advanced/cephx-key-rotation/).  ### How to reproduce it  1. Run Rook v1.20.6 (bug also present on `master` as of 2026-08-26 — see root cause below). 2. Apply a `CephCluster` (via Helm `rook-ceph-cluster` chart or directly) with:    ```yaml    spec:      security:        cephx:          daemon:            keyRotation
  **Post-Mortem & Fix Analysis**:
  > It appears you are using an old CRD version. The latest has a new kubebuilder directive on the type that resolves the issue: `// +kubebuilder:validation:Format=int64`  https://github.com/rook/rook/blob/ba8a5e4cad2b8267832a3158f379b25888572b19/pkg/apis/ceph.rook.io/v1/types.go#L398-L409 
  > Thanks for confirming and for the quick turnaround!  I can see the +kubebuilder:validation:Format=int64 annotation is already merged on release-1.20/master. 

- **Issue #18287** (2026-08-27): **configureStretchCluster unconditionally sets election strategy, breaking all reconciles on stretch clusters running Ceph Squid**
  *Symptoms*: **Is this a bug report or feature request?** * Bug Report  **Deviation from expected behavior:**  On a stretch cluster that is already in stretch mode, every `CephCluster` reconcile fails after upgrading Ceph from Reef to Squid:  ``` failed to reconcile CephCluster "rook-ceph/rook-ceph": failed to reconcile cluster "rook-ceph": failed to configure local ceph cluster: failed to create cluster: failed to start ceph monitors: failed to configure stretch mons: failed to enable stretch cluster: failed to enable stretch cluster election strategy: exit status 22 ```  The `CephCluster` CR never leaves `Progressing` / `"Configuring Ceph Mons"`. Other controllers (`op-mon`, `ceph-csi`, `cephclient`, `op-config`) keep working and the Ceph cluster stays `HEALTH_OK` and fully serving, but no `CephCluster` spec change is ever applied and Rook will not create or replace mon/OSD daemons.  The underlying Ceph call fails because **Squid added a guard that Reef did not have**:  ``` $ ceph mon set election_strategy connectivity Error EINVAL: Stretch mode is enabled, so you cannot change the election strategy; please disable stretch mode first! ```  Under Reef this call was a harmless no-op when the strategy was already `connectivity`, so the unconditional call went unnoticed.  **Cause:** `pkg/operator/ceph/cluster/mon/mon.go` — `configureStretchCluster()` calls `EnableStretchElectionStrategy()` unconditionally, and `startMons` invokes it on every reconcile whenever `c.spec.IsStretchCluster()`:  
  **Post-Mortem & Fix Analysis**:
  > I see the change in https://github.com/ceph/ceph/pull/59515, which based on the backports recently, expect it's included in: - Squd 19.2.5 - Tentacle 20.2.3  @kamoltat Is it expected that an idempotent request to set the election strategy be rejected? Rook's general pattern is to make idempotent calls, so it seems we need to change this to first check before calling. 
  > Hi @travisn, honestly I should have made it in such a way that idempotent requests are safe. Given the currently situation, it might be faster to fix this on the rook side. However, I can also make the changes on Ceph's side, plus going forward I will make sure Ceph is designed to handle idempotent requests safely.
  > @kamoltat Thanks for the confirmation, we will go ahead with the fix on the Rook side for now. 

- **Issue #18256** (2026-08-27): **muteHealthWarning is applied infinitely in a loop**
  *Symptoms*: <!-- **Are you in the right place?** 1. For issues or feature requests, please create an issue in this repository. 2. For general technical and non-technical questions, we are happy to help you on our [Rook.io Slack](https://slack.rook.io/). 3. Did you already search the existing open issues for anything similar? -->  **Is this a bug report or feature request?** * Bug Report  **Deviation from expected behavior:** As I'm running a cluster on some nodes with kernel <7 - I still need to continue using the older `aes` key format, hence I muted the warnings in the config:  ```yaml     muteHealthWarning:       AUTH_INSECURE_SERVICE_KEY_TYPE:         policy: mute       AUTH_INSECURE_SERVICE_TICKETS:         policy: mute ``` yet, the `INFO` level message is emitted on every loop infinitely now ``` 2026-08-24 01:25:13.189720 I | cephclient: [rook-ceph] successfully configured health warning mute "AUTH_INSECURE_SERVICE_KEY_TYPE"="mute"  2026-08-24 01:25:14.234219 I | cephclient: [rook-ceph] successfully configured health warning mute "AUTH_INSECURE_SERVICE_TICKETS"="mute" ``` The cluster health detail looks as expected - muted as sticky:  ``` (MUTED, STICKY) [ERR] AUTH_INSECURE_SERVICE_KEY_TYPE: 6 auth service entities with insecure key types     entity mon. using insecure key type: aes     entity osd.0 using insecure key type: aes     entity osd.1 using insecure key type: aes     entity osd.2 using insecure key type: aes     entity osd.3 using insecure key type: aes     entity mgr.a u
  **Post-Mortem & Fix Analysis**:
  > @zerkms To be clear, how often are you seeing the log messages? Once every reconcile? Or they are continuously printing and filling up your log?   edit: Nevermind, I see now it's printing every 60s in the log.
  > As a workaround, you could just remove the muteHealthWarning settings from the cephcluster CR and the warnings would remain muted.
  > > remove the muteHealthWarning settings from the cephcluster CR and the warnings would remain muted.  Oh, would that also be an expected behaviour? It almost feels that if you remove a mute - it should remove it from the ceph runtime state.

- **Issue #18254** (2026-08-24): **volume attachment is being deleted after node drain (migrating keys)**
  *Symptoms*: **Is this a bug report or feature request?** * Bug Report  **Deviation from expected behavior:**  After `kubectl drain` and `kubectl uncordon` pods mounting pvcs won't come up.  **Expected behavior:**  pods come up as normal.  **How to reproduce it (minimal and precise):**  After upgrading to v1.20.6 I followed "CephX Keys and Rotation" from the documentation. This went fine until section "Migrating CSI keys to a new key type" number 5.  I did `kubectl drain --ignore-daemonsets --delete-emptydir-data node1` and waited for the node to successfully draining. Then I did `kubectl uncordon node1`. I waited for `ceph status` to show that everything is back to normal (and degradation is treated).  But some pods remained in state 'ContainerCreating'. Looking at describe pod shows something like this: ```   Warning  FailedAttachVolume  4m20s (x739 over 19m)  attachdetach-controller  AttachVolume.Attach failed for volume "pvc-b9dda9de-bbaf-42ae-b68f-accc35d4a12d" : rpc error: code = Internal desc = failed to find volume "0001-0009-rook-ceph-0000000000000002-1ff3d126-80fd-42d8-8ec7-a684a20140e6" for service account check: failed to establish the connection: failed to get connection: connecting failed: rados: ret=-22, Invalid argument ```  After `kubectl delete pod` to force a restart I see:  ```   Warning  FailedAttachVolume  3m15s (x500 over 13m)  attachdetach-controller  AttachVolume.Attach failed for volume "pvc-75b7d4d8-d1ab-484b-bbad-07e71cdab7ce" : volume attachment is being delet
  **Post-Mortem & Fix Analysis**:
  > Since I have trouble uploading the file, here is the cluster.yaml. I'm using helm for deployment.  ```yaml # try solving slow operations in BlueStore warning # see: https://github.com/rook/rook/discussions/15403 # -- Cluster ceph.conf override # configOverride: configOverride: |   [global]   bdev_enable_discard = false   bluestore_slow_ops_warn_lifetime = 60   bluestore_slow_ops_warn_threshold = 10    osd_scrub_begin_hour = 22   osd_scrub_end_hour = 10   osd_scrub_max_interval = 1209600  # 14 days (in seconds)   osd_scrub_min_interval = 259200   # 3 days   osd_deep_scrub_interval = 1209600 # 14 days  # Installs a debugging toolbox deployment toolbox:   # -- Enable Ceph debugging pod deployment. See [toolbox](../Troubleshooting/ceph-toolbox.md)   enabled: true  monitoring:   # -- Enable Prometheus integration, will also create necessary RBAC rules to allow Operator to create ServiceMonitors.   # Monitoring requires Prometheus to be pre-installed   enabled: true   # -- Whether to create 
  > Looking in the logs of the ctrlplugin pods for both cephfs and rbd I see a lot of messages like  ``` E0822 18:24:33.622843       1 utils.go:366] ID: 557 Req-ID: 0001-0009-rook-ceph-0000000000000001-7d0979f7-b39b-42cd-a18c-5730513f91c6 GRPC error: rpc error: code = Internal desc = failed to generate volume from volume ID 0001-0009-rook-ceph-0000000000000001-7d0979f7-b39b-42cd-a18c-5730513f91c6: failed to get connection: connecting failed: rados: ret=-22, Invalid argument E0822 18:24:54.782780       1 utils.go:366] ID: 559 Req-ID: snapshot-7aa56d6b-b913-433e-90e3-9bdae34a0f15 GRPC error: rpc error: code = Internal desc = failed to get connection: connecting failed: rados: ret=-22, Invalid argument ```  Restarting both pods didn't change anything.
  > @pfaelzerchen I think this issue was identified and fixed in Ceph-CSI, with a new release this morning. https://github.com/ceph/ceph-csi/releases/tag/v3.17.1  Can you upgrade CSI to 3.17.1 and see if the issue is resolved?

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

### Incident Patch 1: `9f8960d3` (2026-10-05)
**Commit Message**: Merge pull request #18472 from silentirk/fix-encrypted

osd: respect per-device encryptedDevice config

**File**: `cmd/rook/ceph/osd.go` (modified, +1/-0)
```diff
@@ -415,6 +415,7 @@ func parseDevices(devices string) ([]osddaemon.DesiredDevice, error) {
 		d.DeviceClass = cd.StoreConfig.DeviceClass
 		d.InitialWeight = cd.StoreConfig.InitialWeight
 		d.MetadataDevice = cd.StoreConfig.MetadataDevice
+		d.EncryptedDevice = cd.StoreConfig.EncryptedDevice
 
 		if d.OSDsPerDevice < 1 {
 			return nil, errors.Errorf("osds per device should be greater than 0 (%d)", d.OSDsPerDevice)
```

**File**: `cmd/rook/ceph/osd_test.go` (modified, +5/-1)
```diff
@@ -43,7 +43,8 @@ func TestParseDesiredDevices(t *testing.T) {
 		{
 			ID: "nvme01",
 			StoreConfig: osdcfg.StoreConfig{
-				OSDsPerDevice: 5,
+				OSDsPerDevice:   5,
+				EncryptedDevice: true,
 			},
 		},
 	}
@@ -60,6 +61,9 @@ func TestParseDesiredDevices(t *testing.T) {
 	assert.Equal(t, 1, result[0].OSDsPerDevice)
 	assert.Equal(t, 1, result[1].OSDsPerDevice)
 	assert.Equal(t, 5, result[2].OSDsPerDevice)
+	assert.False(t, result[0].EncryptedDevice)
+	assert.False(t, result[1].EncryptedDevice)
+	assert.True(t, result[2].EncryptedDevice)
 	assert.False(t, result[0].IsFilter)
 	assert.False(t, result[1].IsFilter)
 	assert.False(t, result[2].IsFilter)
```

**File**: `pkg/daemon/ceph/osd/daemon.go` (modified, +6/-1)
```diff
@@ -515,8 +515,13 @@ func getAvailableDevices(context *clusterd.Context, agent *OsdAgent) (*DeviceOsd
 					} else if strings.HasPrefix(desiredDevice.Name, "/dev/") {
 						matched = matchDevLinks(device.DevLinks, desiredDevice.Name)
 					}
+					if matched && device.Type == sys.PartType && desiredDevice.EncryptedDevice {
+						logger.Infof("partition %q is not picked because encrypted OSD on partition is not allowed", device.Name)
+						matched = false
+						continue
+					}
 					if matched && device.Type == sys.LVMType {
-						if agent.storeConfig.EncryptedDevice {
+						if agent.storeConfig.EncryptedDevice || desiredDevice.EncryptedDevice {
 							logger.Infof("logical volume %q is not picked because encrypted OSD on LV is not allowed", device.Name)
 							matched = false
 							continue
```

**File**: `pkg/daemon/ceph/osd/daemon_test.go` (modified, +19/-0)
```diff
@@ -506,6 +506,25 @@ NAME="sdb1" SIZE="30" TYPE="part" PKNAME="sdb"`, nil
 	assert.Equal(t, 1, len(mapping.Entries))
 	assert.Equal(t, -1, mapping.Entries["sdt1"].Data)
 
+	// per-device encryption on a disk
+	agent.devices = []DesiredDevice{{Name: "sdd", EncryptedDevice: true}}
+	mapping, err = getAvailableDevices(context, agent)
+	assert.Nil(t, err)
+	assert.Equal(t, 1, len(mapping.Entries))
+	assert.True(t, mapping.Entries["sdd"].Config.EncryptedDevice)
+
+	// partition with per-device encryption is rejected
+	agent.devices = []DesiredDevice{{Name: "sdt1", EncryptedDevice: true}}
+	mapping, err = getAvailableDevices(context, agent)
+	assert.Nil(t, err)
+	assert.Equal(t, 0, len(mapping.Entries))
+
+	// logical volume with per-device encryption is rejected
+	agent.devices = []DesiredDevice{{Name: "/dev/mapper/vg1-lv1", EncryptedDevice: true}}
+	mapping, err = getAvailableDevices(context, agent)
+	assert.Nil(t, err)
+	assert.Equal(t, 0, len(mapping.Entries))
+
 	// test on PVC
 	context.Devices = []*sys.LocalDisk{
 		{Name: "/mnt/set1-0-data-qfhfk", RealPath: "/dev/xvdcy", Type: "data"},
```

**File**: `pkg/daemon/ceph/osd/device.go` (modified, +1/-0)
```diff
@@ -47,6 +47,7 @@ type DesiredDevice struct {
 	DatabaseSizeMB     int
 	DeviceClass        string
 	InitialWeight      string
+	EncryptedDevice    bool
 	IsFilter           bool
 	IsDevicePathFilter bool
 }
```

**File**: `pkg/daemon/ceph/osd/replace.go` (modified, +1/-1)
```diff
@@ -421,7 +421,7 @@ func (a *OsdAgent) buildReplacementPrepareArgs(osdID int, dataDevice, dbLV strin
 		if dbLV != "" {
 			args = append(args, blockDBFlag, dbLV)
 		}
-		if a.storeConfig.EncryptedDevice {
+		if a.storeConfig.EncryptedDevice || entry.Config.EncryptedDevice {
 			args = append(args, encryptedFlag)
 		}
 	}
```

**File**: `pkg/daemon/ceph/osd/replace_test.go` (modified, +21/-6)
```diff
@@ -472,11 +472,12 @@ func TestBuildReplacementPrepareArgs(t *testing.T) {
 	}
 
 	tests := []struct {
-		name     string
-		store    config.StoreConfig
-		dbLV     string
-		useRaw   bool
-		expected []string
+		name            string
+		store           config.StoreConfig
+		deviceEncrypted bool
+		dbLV            string
+		useRaw          bool
+		expected        []string
 	}{
 		{
 			name:   "raw single-disk",
@@ -520,12 +521,26 @@ func TestBuildReplacementPrepareArgs(t *testing.T) {
 				"--dmcrypt", "--crush-device-class", "hdd",
 			},
 		},
+		{
+			name:            "lvm shared-metadata per-device encrypted",
+			store:           config.StoreConfig{StoreType: "bluestore"},
+			deviceEncrypted: true,
+			dbLV:            "ceph-db-vg/osd-db-y",
+			useRaw:          false,
+			expected: []string{
+				"-oL", "ceph-volume", "--log-path", logPath, "lvm", "prepare", "--bluestore",
+				"--osd-id", "0", "--data", "/dev/vdb", "--block.db", "ceph-db-vg/osd-db-y",
+				"--dmcrypt", "--crush-device-class", "hdd",
+			},
+		},
 	}
 
 	for _, tc := range tests {
 		t.Run(tc.name, func(t *testing.T) {
 			a := &OsdAgent{storeConfig: tc.store}
-			args := a.buildReplacementPrepareArgs(0, "/dev/vdb", tc.dbLV, entry, tc.useRaw, logPath)
+			e := *entry
+			e.Config.EncryptedDevice = tc.deviceEncrypted
+			args := a.buildReplacementPrepareArgs(0, "/dev/vdb", tc.dbLV, &e, tc.useRaw, logPath)
 			assert.Equal(t, tc.expected, args)
 		})
 	}
```

**File**: `pkg/daemon/ceph/osd/volume.go` (modified, +24/-1)
```diff
@@ -532,6 +532,12 @@ func isSafeToUseRawMode(device *DeviceOsdIDEntry) bool {
 		return false
 	}
 
+	// ceph-volume raw mode does not support encryption yet
+	if device.Config.EncryptedDevice {
+		logger.Debugf("won't use raw mode for disk %q since encryption is enabled", device.Config.Name)
+		return false
+	}
+
 	// ceph-volume raw mode does not support more than one OSD per disk
 	if device.Config.OSDsPerDevice > 1 {
 		logger.Debugf("won't use raw mode for disk %q since osd per device is %d", device.Config.Name, device.Config.OSDsPerDevice)
@@ -548,7 +554,7 @@ func isSafeToUseRawMode(device *DeviceOsdIDEntry) bool {
 }
 
 func lvmModeAllowed(device *DeviceOsdIDEntry, storeConfig *config.StoreConfig) bool {
-	if device.DeviceInfo.Type == sys.PartType && storeConfig.EncryptedDevice {
+	if device.DeviceInfo.Type == sys.PartType && (storeConfig.EncryptedDevice || device.Config.EncryptedDevice) {
 		logger.Infof("skipping partition %q for lvm mode since encryption is not supported on partitions with a `metadataDevice` or `osdsPerDevice > 1`", device.Config.Name)
 		return false
 	}
@@ -758,19 +764,25 @@ func (a *OsdAgent) initializeDevicesLVMMode(context *clusterd.Context, devices *
 				}
 
 				logger.Infof("using %s as metadataDevice for device %s and let ceph-volume lvm batch decide how to create volumes", md, deviceArg)
+				deviceEncrypted := strconv.FormatBool(a.storeConfig.EncryptedDevice || device.Config.EncryptedDevice)
 				if _, ok := metadataDevices[md]; ok {
 					// Fail when two devices using the same metadata device have different values for osdsPerDevice
 					metadataDevices[md]["devices"] += " " + deviceArg
 					if deviceOSDCount != metadataDevices[md]["osdsperdevice"] {
 						return errors.Errorf("metadataDevice (%s) has more than 1 osdsPerDevice value set: %s != %s", md, deviceOSDCount, metadataDevices[md]["osdsperdevice"])
 					}
+					// Fail when two devices using the same metadata device have different values for encryptedDevice
+					if deviceEncrypted != metadataDevices[md]["encrypted"] {
+						return errors.Errorf("metadataDevice (%s) has more than 1 encryptedDevice value set: %s != %s", md, deviceEncrypted, metadataDevices[md]["encrypted"])
+					}
 				} else {
 					metadataDevices[md] = make(map[string]string)
 					metadataDevices[md]["osdsperdevice"] = deviceOSDCount
 					if device.Config.DeviceClass != "" {
 						metadataDevices[md]["deviceclass"] = device.Config.DeviceClass
 					}
 					metadataDevices[md]["devices"] = deviceArg
+					metadataDevices[md]["encrypted"] = deviceEncrypted
 				}
 				if metadataDevice.Type == sys.PartType {
 					if a.metadataDevice != "" && device.Config.MetadataDevice == "" {
@@ -804,6 +816,10 @@ func (a *OsdAgent) initializeDevicesLVMMode(context *clusterd.Context, devices *
 					deviceArg,
 				}...)
 
+				if device.Config.EncryptedDevice && !a.storeConfig.EncryptedDevice {
+					immediateExecuteArgs = append(immediateExecuteArgs, encryptedFlag)
+				}
+
 				// assign the device class specific to the device
 				immediateExecuteArgs = a.appendDeviceClassArg(device, immediateExecuteArgs)
 
@@ -899,6 +915,10 @@ func (a *OsdAgent) initializeDevicesLVMMode(context *clusterd.Context, devices *
 			}...)
 		}
 
+		if conf["encrypted"] == "true" && !a.storeConfig.EncryptedDevice {
+			mdArgs = append(mdArgs, encryptedFlag)
+		}
+
 		if _, ok := conf["deviceclass"]; ok {
 			mdArgs = append(mdArgs, []string{
 				crushDeviceClassFlag,
@@ -1237,13 +1257,15 @@ func GetCephVolumeLVMOSDs(context *clusterd.Context, clusterInfo *client.Cluster
 			continue
 		}
 		var osdFSID, osdDeviceClass string
+		var osdEncrypted bool
 		for _, osd := range osdInfo {
 			if osd.Tags.ClusterFSID != cephfsid {
 				logger.Infof("skipping osd%d: %q running on a different ceph cluster %q", id, osd.Tags.OSDFSID, osd.Tags.ClusterFSID)
 				continue
 			}
 			osdFSID = osd.Tags.OSDFSID
 			osdDeviceClass = osd.Tags.CrushDeviceClass
+			osdEncrypted = osd.Tags.Encrypted == "1"
 
 			// If no lv is specified let's take the one we discovered
 			if lv == "" {
@@ -1279,6 +1301,7 @@ func GetCephVolumeLVMOSDs(context *clusterd.Context, clusterInfo *client.Cluster
 			CVMode:        cvMode,
 			Store:         osdStore,
 			DeviceClass:   osdDeviceClass,
+			Encrypted:     osdEncrypted,
 		}
 		osds = append(osds, osd)
 	}
```

---

### Incident Patch 2: `10af0b70` (2026-10-05)
**Commit Message**: Merge pull request #18476 from banlor/fix/nvmeof-cpu-percent-ar007

monitoring: correct NVMe-oF gateway CPU alert percentage

**File**: `.github/workflows/helm-unittests.yaml` (modified, +7/-0)
```diff
@@ -29,3 +29,10 @@ jobs:
 
       - name: Unit test the helm charts
         run: make test.helm
+
+      - name: Unit test Prometheus alert rules
+        run: |
+          docker run --rm --entrypoint promtool \
+            -v "$PWD/deploy/charts/rook-ceph-cluster:/rules:ro" \
+            --workdir /rules prom/prometheus:v3.14.0 \
+            test rules tests/localrules.yaml tests/nvmeof-cpu.yaml
```

**File**: `deploy/charts/rook-ceph-cluster/prometheus/localrules.yaml` (modified, +1/-1)
```diff
@@ -834,7 +834,7 @@ groups:
         annotations:
           description: "Typically, high CPU may indicate degraded performance. Consider increasing the number of reactor cores"
           summary: "CPU used by {{ $labels.instance }} NVMe-oF Gateway is high on cluster {{ $labels.cluster }}"
-        expr: "label_replace(avg by(instance, cluster) (rate(ceph_nvmeof_reactor_seconds_total{mode=\"busy\"}[1m])),\"instance\",\"$1\",\"instance\",\"(.*):.*\") > 80.00"
+        expr: "100 * label_replace(avg by(instance, cluster) (rate(ceph_nvmeof_reactor_seconds_total{mode=\"busy\"}[1m])),\"instance\",\"$1\",\"instance\",\"(.*):.*\") > 80.00"
         for: "10m"
         labels:
           severity: "warning"
```

**File**: `deploy/charts/rook-ceph-cluster/tests/nvmeof-cpu.yaml` (added, +46/-0)
```diff
@@ -0,0 +1,46 @@
+rule_files:
+  - ../prometheus/localrules.yaml
+evaluation_interval: 15s
+fuzzy_compare: true
+tests:
+  - name: busy seconds averaged across poll threads and gateways
+    interval: 15s
+    input_series:
+      - series: 'ceph_nvmeof_reactor_seconds_total{cluster="mycluster",instance="gw-a:10008",name="poll-0",mode="busy"}'
+        values: '0+13.5x80'
+      - series: 'ceph_nvmeof_reactor_seconds_total{cluster="mycluster",instance="gw-a:10008",name="poll-1",mode="busy"}'
+        values: '0+13.5x80'
+      - series: 'ceph_nvmeof_reactor_seconds_total{cluster="mycluster",instance="gw-b:10008",name="poll-0",mode="busy"}'
+        values: '0+7.5x80'
+    promql_expr_test:
+      - expr: '100 * label_replace(avg by(instance, cluster) (rate(ceph_nvmeof_reactor_seconds_total{mode="busy"}[1m])),"instance","$1","instance","(.*):.*")'
+        eval_time: 15m
+        exp_samples:
+          - labels: '{cluster="mycluster",instance="gw-a"}'
+            value: 90
+          - labels: '{cluster="mycluster",instance="gw-b"}'
+            value: 50
+    alert_rule_test:
+      - eval_time: 5m
+        alertname: NVMeoFHighGatewayCPU
+        exp_alerts: []
+      - eval_time: 15m
+        alertname: NVMeoFHighGatewayCPU
+        exp_alerts:
+          - exp_labels:
+              cluster: mycluster
+              instance: gw-a
+              severity: warning
+              type: ceph_default
+            exp_annotations:
+              summary: CPU used by gw-a NVMe-oF Gateway is high on cluster mycluster
+              description: Typically, high CPU may indicate degraded performance. Consider increasing the number of reactor cores
+  - name: exactly 80 percent stays below strict threshold
+    interval: 15s
+    input_series:
+      - series: 'ceph_nvmeof_reactor_seconds_total{cluster="mycluster",instance="gw-c:10008",name="poll-0",mode="busy"}'
+        values: '0+12x80'
+    alert_rule_test:
+      - eval_time: 15m
+        alertname: NVMeoFHighGatewayCPU
+        exp_alerts: []
```

---

### Incident Patch 3: `592015de` (2026-10-05)
**Commit Message**: build(deps): bump sigs.k8s.io/controller-runtime

Bumps the k8s-dependencies group with 1 update: [sigs.k8s.io/controller-runtime](https://github.com/kubernetes-sigs/controller-runtime).


Updates `sigs.k8s.io/controller-runtime` from 0.25.1 to 0.25.2
- [Release notes](https://github.com/kubernetes-sigs/controller-runtime/releases)
- [Changelog](https://github.com/kubernetes-sigs/controller-runtime/blob/main/RELEASE.md)
- [Commits](https://github.com/kubernetes-sigs/controller-runtime/compare/v0.25.1...v0.25.2)

---
updated-dependencies:
- dependency-name: sigs.k8s.io/controller-runtime
  dependency-version: 0.25.2
  dependency-type: direct:production
  update-type: version-update:semver-patch
  dependency-group: k8s-dependencies
...

Signed-off-by: dependabot[bot] <[REDACTED_EMAIL]>

**File**: `go.mod` (modified, +1/-1)
```diff
@@ -53,7 +53,7 @@ require (
 	k8s.io/cloud-provider v0.37.1
 	k8s.io/utils v0.0.0-20260707023825-cf1189d6abe3
 	sigs.k8s.io/container-object-storage-interface/client v0.2.2
-	sigs.k8s.io/controller-runtime v0.25.1
+	sigs.k8s.io/controller-runtime v0.25.2
 	sigs.k8s.io/mcs-api v0.5.2
 	sigs.k8s.io/yaml v1.6.0
 )
```

**File**: `go.sum` (modified, +2/-2)
```diff
@@ -2201,8 +2201,8 @@ sigs.k8s.io/apiserver-network-proxy/konnectivity-client v0.0.14/go.mod h1:LEScyz
 sigs.k8s.io/container-object-storage-interface/client v0.2.2 h1:TARggRey9sQkDv94w3b+aBav0gCgM61sgWVWU8zKMDg=
 sigs.k8s.io/container-object-storage-interface/client v0.2.2/go.mod h1:RQSwGVkJ9vBo02N1tTWmqHqykln8K2d/dHgdXWie2I4=
 sigs.k8s.io/controller-runtime v0.2.2/go.mod h1:9dyohw3ZtoXQuV1e766PHUn+cmrRCIcBh6XIMFNMZ+I=
-sigs.k8s.io/controller-runtime v0.25.1 h1:BKgU9OeE8xv8EbbM8cY0NVzTQs35rokkdq1jh12fMb4=
-sigs.k8s.io/controller-runtime v0.25.1/go.mod h1:4QqLdT6z/L6Olj8JJCtvztid4/fnIiYsfaTFScegctc=
+sigs.k8s.io/controller-runtime v0.25.2 h1:bEkK3PVOIVK9X8QWLGVhJgmFc++47vfT6wakSzAOLsQ=
+sigs.k8s.io/controller-runtime v0.25.2/go.mod h1:4QqLdT6z/L6Olj8JJCtvztid4/fnIiYsfaTFScegctc=
 sigs.k8s.io/json v0.0.0-20211020170558-c049b76a60c6/go.mod h1:p4QtZmO4uMYipTQNzagwnNoseA6OxSUutVw05NhYDRs=
 sigs.k8s.io/json v0.0.0-20220713155537-f223a00ba0e2/go.mod h1:B8JuhiUyNFVKdsE8h686QcCxMaH6HrOAZj4vswFpcB0=
 sigs.k8s.io/json v0.0.0-20250730193827-2d320260d730 h1:IpInykpT6ceI+QxKBbEflcR5EXP7sU1kvOlxwZh5txg=
```

---

### Incident Patch 4: `0c5d5e11` (2026-10-01)
**Commit Message**: build(deps): bump the github-dependencies group across 1 directory with 9 updates

Bumps the github-dependencies group with 9 updates in the / directory:

| Package | From | To |
| --- | --- | --- |
| [github.com/IBM/keyprotect-go-client](https://github.com/IBM/keyprotect-go-client) | `0.17.3` | `1.0.0` |
| [github.com/aws/aws-sdk-go-v2](https://github.com/aws/aws-sdk-go-v2) | `1.47.0` | `1.47.1` |
| [github.com/aws/aws-sdk-go-v2/config](https://github.com/aws/aws-sdk-go-v2) | `1.33.4` | `1.33.6` |
| [github.com/aws/aws-sdk-go-v2/credentials](https://github.com/aws/aws-sdk-go-v2) | `1.20.4` | `1.20.6` |
| [github.com/aws/aws-sdk-go-v2/service/s3](https://github.com/aws/aws-sdk-go-v2) | `1.113.0` | `1.113.4` |
| [github.com/aws/aws-sdk-go-v2/service/sns](https://github.com/aws/aws-sdk-go-v2) | `1.47.0` | `1.47.2` |
| [github.com/aws/smithy-go](https://github.com/aws/smithy-go) | `1.28.1` | `1.28.2` |
| [github.com/prometheus-operator/prometheus-operator/pkg/apis/monitoring](https://github.com/prometheus-operator/prometheus-operator) | `0.94.0` | `0.94.1` |
| [github.com/prometheus-operator/prometheus-operator/pkg/client](https://github.com/prometheus-operator/prometheus-operator) | 

**File**: `go.mod` (modified, +19/-19)
```diff
@@ -11,12 +11,12 @@ replace (
 
 require (
 	github.com/IBM/keyprotect-go-client v0.17.3
-	github.com/aws/aws-sdk-go-v2 v1.47.0
-	github.com/aws/aws-sdk-go-v2/config v1.33.4
-	github.com/aws/aws-sdk-go-v2/credentials v1.20.4
-	github.com/aws/aws-sdk-go-v2/service/s3 v1.113.0
-	github.com/aws/aws-sdk-go-v2/service/sns v1.47.0
-	github.com/aws/smithy-go v1.28.1
+	github.com/aws/aws-sdk-go-v2 v1.47.1
+	github.com/aws/aws-sdk-go-v2/config v1.33.6
+	github.com/aws/aws-sdk-go-v2/credentials v1.20.6
+	github.com/aws/aws-sdk-go-v2/service/s3 v1.113.4
+	github.com/aws/aws-sdk-go-v2/service/sns v1.47.2
+	github.com/aws/smithy-go v1.28.2
 	github.com/banzaicloud/k8s-objectmatcher v1.8.0
 	github.com/ceph/ceph-csi-operator/api v0.0.0-20260701062509-bc21847a37a7
 	github.com/ceph/ceph-csi/api v0.0.0-20241216133622-88b7e0d6684f
@@ -33,8 +33,8 @@ require (
 	github.com/kube-object-storage/lib-bucket-provisioner v0.0.0-20260420161730-5164e3746489
 	github.com/libopenstorage/secrets v0.0.0-20240416031220-a17cf7f72c6c
 	github.com/pkg/errors v0.9.1
-	github.com/prometheus-operator/prometheus-operator/pkg/apis/monitoring v0.94.0
-	github.com/prometheus-operator/prometheus-operator/pkg/client v0.94.0
+	github.com/prometheus-operator/prometheus-operator/pkg/apis/monitoring v0.94.1
+	github.com/prometheus-operator/prometheus-operator/pkg/client v0.94.1
 	github.com/rook/rook/pkg/apis v0.0.0-20241216163035-3170ac6a0c58
 	github.com/sethvargo/go-password v0.4.0
 	github.com/spf13/cobra v1.10.2
@@ -70,18 +70,18 @@ require (
 	github.com/ansel1/merry v1.8.1 // indirect
 	github.com/ansel1/merry/v2 v2.2.2 // indirect
 	github.com/aws/aws-sdk-go-v2/aws/protocol/eventstream v1.7.20 // indirect
-	github.com/aws/aws-sdk-go-v2/feature/ec2/imds v1.20.0 // indirect
-	github.com/aws/aws-sdk-go-v2/internal/configsources v1.5.3 // indirect
-	github.com/aws/aws-sdk-go-v2/internal/endpoints/v2 v2.8.3 // indirect
-	github.com/aws/aws-sdk-go-v2/internal/v4a v1.5.3 // indirect
+	github.com/aws/aws-sdk-go-v2/feature/ec2/imds v1.20.1 // indirect
+	github.com/aws/aws-sdk-go-v2/internal/configsources v1.5.4 // indirect
+	github.com/aws/aws-sdk-go-v2/internal/endpoints/v2 v2.8.4 // indirect
+	github.com/aws/aws-sdk-go-v2/internal/v4a v1.5.4 // indirect
 	github.com/aws/aws-sdk-go-v2/service/internal/accept-encoding v1.13.19 // indirect
-	github.com/aws/aws-sdk-go-v2/service/internal/checksum v1.11.3 // indirect
-	github.com/aws/aws-sdk-go-v2/service/internal/presigned-url v1.14.3 // indirect
-	github.com/aws/aws-sdk-go-v2/service/internal/s3shared v1.20.3 // indirect
-	github.com/aws/aws-sdk-go-v2/service/signin v1.10.0 // indirect
-	github.com/aws/aws-sdk-go-v2/service/sso v1.38.0 // indirect
-	github.com/aws/aws-sdk-go-v2/service/ssooidc v1.43.0 // indirect
-	github.com/aws/aws-sdk-go-v2/service/sts v1.50.0 // indirect
+	github.com/aws/aws-sdk-go-v2/service/internal/checksum v1.11.5 // indirect
+	github.com/aws/aws-sdk-go-v2/service/internal/presigned-url v1.14.4 // indirect
+	github.com/aws/aws-sdk-go-v2/service/internal/s3shared v1.20.4 // indirect
+	github.com/aws/aws-sdk-go-v2/service/signin v1.10.1 // indirect
+	github.com/aws/aws-sdk-go-v2/service/sso v1.38.1 // indirect
+	github.com/aws/aws-sdk-go-v2/service/ssooidc v1.43.1 // indirect
+	github.com/aws/aws-sdk-go-v2/service/sts v1.51.1 // indirect
 	github.com/beorn7/perks v1.0.1 // indirect
 	github.com/blang/semver/v4 v4.0.0 // indirect
 	github.com/cenkalti/backoff/v4 v4.3.0 // indirect
```

**File**: `go.sum` (modified, +38/-38)
```diff
@@ -488,44 +488,44 @@ github.com/armon/go-socks5 v0.0.0-20160902184237-e75332964ef5/go.mod h1:wHh0iHkY
 github.com/asaskevich/govalidator v0.0.0-20180720115003-f9ffefc3facf/go.mod h1:lB+ZfQJz7igIIfQNfa7Ml4HSf2uFQQRzpGGRXenZAgY=
 github.com/asaskevich/govalidator v0.0.0-20190424111038-f61b66f89f4a/go.mod h1:lB+ZfQJz7igIIfQNfa7Ml4HSf2uFQQRzpGGRXenZAgY=
 github.com/aws/aws-sdk-go v1.44.164/go.mod h1:aVsgQcEevwlmQ7qHE9I3h+dtQgpqhFB+i8Phjh7fkwI=
-github.com/aws/aws-sdk-go-v2 v1.47.0 h1:0jsHallhJCeaU0Ko48c/3FK1ctOQ7NpzggxriJOQ8MQ=
-github.com/aws/aws-sdk-go-v2 v1.47.0/go.mod h1:bttEH6JqnUL8LepvDVfdrds/fZ5bCIxzpe3abyUrhDU=
+github.com/aws/aws-sdk-go-v2 v1.47.1 h1:uOIZnp4PK3ZhKI0dNrJrhTEsLxbpXHTAJlwoS1pvAtw=
+github.com/aws/aws-sdk-go-v2 v1.47.1/go.mod h1:bttEH6JqnUL8LepvDVfdrds/fZ5bCIxzpe3abyUrhDU=
 github.com/aws/aws-sdk-go-v2/aws/protocol/eventstream v1.7.20 h1:GPRlPwz40I2B2VrBEASOA3Bi77NyeqejNLkifosX0rs=
 github.com/aws/aws-sdk-go-v2/aws/protocol/eventstream v1.7.20/go.mod h1:g7PNzKcsOKWb4fkSRBA7BZVAS6Y8IcxzN+nRohhQ1Q8=
-github.com/aws/aws-sdk-go-v2/config v1.33.4 h1:FzvkXKSzwqHni4U7nDigHg4jjtqMpVUuHgmZfSoJVQ0=
-github.com/aws/aws-sdk-go-v2/config v1.33.4/go.mod h1:VZqGZnZsCWVfK/iGPptJIyNIX3XEX6iQU2Rel4sLrr8=
-github.com/aws/aws-sdk-go-v2/credentials v1.20.4 h1:hTvrJJseKbvw32kmiE0G+u/9ZqpqscjDrTigHIXP2qs=
-github.com/aws/aws-sdk-go-v2/credentials v1.20.4/go.mod h1:gWp9O1ZBWwpcIrgV+mVHk4gZUurAEDkgypu/OXOlIaw=
-github.com/aws/aws-sdk-go-v2/feature/ec2/imds v1.20.0 h1:AM4hHjww+PSFtt6E+UrBrPlZkWsePCLEt9AjkfQX+yM=
-github.com/aws/aws-sdk-go-v2/feature/ec2/imds v1.20.0/go.mod h1:3x/yXezeQjpOvBb4jEMxrS8SXvpdvJ5abv6l5c1gWM8=
-github.com/aws/aws-sdk-go-v2/internal/configsources v1.5.3 h1:Hp/VgjP0BysR3OgLlR057Vz2LcbbVnoWeJ+3qWiS/fY=
-github.com/aws/aws-sdk-go-v2/internal/configsources v1.5.3/go.mod h1:nwGV5qw7F1IZPgxCvA/ph8N2TAuz+BkRG/bXn808qMA=
-github.com/aws/aws-sdk-go-v2/internal/endpoints/v2 v2.8.3 h1:MUaM4f+kj1ZIBPZfUS8cxP1GKXXZtHJjAthy93AN7SM=
-github.com/aws/aws-sdk-go-v2/internal/endpoints/v2 v2.8.3/go.mod h1:6YmVmEVRI5ZZzRjCSsb9SryKH0hAlMRdgA7kG9aDvBU=
-github.com/aws/aws-sdk-go-v2/internal/v4a v1.5.3 h1:fuSCw4Z2qfRCztMPO3GXJNSiEp6Wee+WOLwrHHUMy9c=
-github.com/aws/aws-sdk-go-v2/internal/v4a v1.5.3/go.mod h1:6SxcHheD1pPR5+kWm1wGvjlL/YqUsh267sAfEmN4K7A=
+github.com/aws/aws-sdk-go-v2/config v1.33.6 h1:MBjkSTLczek/UgiK+EYPIoRTqE7gP8vtW3OFbFo7Nug=
+github.com/aws/aws-sdk-go-v2/config v1.33.6/go.mod h1:grRAFzdAZJrwcbasJRg2MPvIrVjtlfXllHssN6+E1JE=
+github.com/aws/aws-sdk-go-v2/credentials v1.20.6 h1:NpAFXCU7NzXNkdGK3zQTtsRJ+3v9tZQV0xcdRw8uBdw=
+github.com/aws/aws-sdk-go-v2/credentials v1.20.6/go.mod h1:mcZCoiPnyMvP8VMNbygNX5lLqSlkYJIMPODylQMurOk=
+github.com/aws/aws-sdk-go-v2/feature/ec2/imds v1.20.1 h1:8gALAAmacnIXh+z6VkdDanv4/IkG5APdg4DZLDTmLog=
+github.com/aws/aws-sdk-go-v2/feature/ec2/imds v1.20.1/go.mod h1:Z7IJhJU+poOdJjUR2wpyY21ossQ1XS/R3Lk9Msq5kM4=
+github.com/aws/aws-sdk-go-v2/internal/configsources v1.5.4 h1:CLq4+8UHCI+ZZYl/EuJxXovaIVN2xeeT8JV+dsApQ5E=
+github.com/aws/aws-sdk-go-v2/internal/configsources v1.5.4/go.mod h1:Wv4q5sAM04xAMkoOedxLx2inVf6K5FdxYp+A61L+q/0=
+github.com/aws/aws-sdk-go-v2/internal/endpoints/v2 v2.8.4 h1:dD4MR81I7YkpEBRk6UP9rocC2QnT3qVuXwzlYTtfGEs=
+github.com/aws/aws-sdk-go-v2/internal/endpoints/v2 v2.8.4/go.mod h1:EcXV1kAFd5XwSkDHlj94gnF3q5CkJyYiIJfH8N0VmrE=
+github.com/aws/aws-sdk-go-v2/internal/v4a v1.5.4 h1:7Wo47d/xn/7KttCSBd8EGYeZ7ULRFRkUHr6vkZPBzVQ=
+github.com/aws/aws-sdk-go-v2/internal/v4a v1.5.4/go.mod h1:tDB2IVC1xC3vX8o+6uRlzhTxP3g1b77CZXFX/oD2FnQ=
 github.com/aws/aws-sdk-go-v2/service/internal/accept-encoding v1.13.19 h1:bAdDl/HkGCcGPoe25ToSHEw23VIxt6CT5fLcg111BKg=
 github.com/aws/aws-sdk-go-v2/service/internal/accept-encoding v1.13.19/go.mod h1:KaUzbLxv4CeSxh6ZCl9B4m7CuFenS8kUEaDs+f/DQr4=
-github.com/aws/aws-sdk-go-v2/service/internal/checksum v1.11.3 h1:BHKCSX4QXERe8So8rbWqaM7owqOmDJxATXgJwGng22A=
-github.com/aws/aws-sdk-go-v2/service/internal/checksum v1.11.3/go.mod h1:GqWeeKfYfezihA2KfFL9l7ohEdZWe1tuFWh3GfyNSnE=
-github.com/aws/aws-sdk-go-v2/service/internal/presigned-url v1.14.3 h1:bON1rJf67TSTDCKg816AAIE4xSTtoo9tl0XRkO72R+I=
-github.com/aws/aws-sdk-go-v2/service/internal/presigned-url v1.14.3/go.mod h1:c5BBpjJcQXpfeq9iASyVKA3T6vX6B6LEXY4mL/gklDY=
-github.com/aws/aws-sdk-go-v2/service/internal/s3shared v1.20.3 h1:L8vIOxylma91TcR96NFTEC07G3JDwSl+CvK2b+IODms=
-github.com/aws/aws-sdk-go-v2/service/internal/s3shared v1.20.3/go.mod h1:fmPIZQzTExYuBNWFyi1P7IoDjvskgphXqK1yObMzusM=
-github.com/aws/aws-sdk-go-v2/service/s3 v1.113.0 h1:0slwIjBv1sEigSUW4EfTtNw9mbHl0PlOUPX9Y1C/eLE=
-github.com/aws/aws-sdk-go-v2/service/s3 v1.113.0/go.mod h1:/uA+2Qj4jd5qBWagVC1AyzzDFXVK997E7U04w7Kw0wI=
-github.com/aws/aws-sdk-go-v2/service/signin v1.10.0 h1:ZD5qFpWcaOKdTuhBi431pIDkCgrMkMlMT6jlpSPoIRI=
-github.com/aws/aws-sdk-go-v2/service/signin v1.10.0/go.mod h1:8Nuuf+tR346PjJ3MvZPh9pekbLiLQFWJhzMXfwy7alA=
-github.com/aws/aws-sdk-go-v2/service/sns v1.47.0 h1:LG0eB968S17nXOj6wfXasPvRXhlcN0xq26m4kaNbG
```

---

### Incident Patch 5: `63ab8854` (2026-09-29)
**Commit Message**: Merge pull request #18453 from banlor/fix/pool-growth-threshold

monitoring: fix pool growth alert threshold

**File**: `deploy/charts/rook-ceph-cluster/prometheus/localrules.yaml` (modified, +1/-1)
```diff
@@ -566,7 +566,7 @@ groups:
         annotations:
           description: "Pool '{{ $labels.name }}' will be full in less than 5 days assuming the average fill-up rate of the past 48 hours."
           summary: "Pool growth rate may soon exceed capacity on cluster {{ $labels.cluster }}"
-        expr: "(predict_linear(avg by (cluster,pool_id) (ceph_pool_percent_used)[2d:], 3600 * 24 * 5) * on(cluster,pool_id) group_right() avg by (cluster,pool_id, name) (ceph_pool_metadata)) >= 95"
+        expr: "(predict_linear(avg by (cluster,pool_id) (ceph_pool_percent_used)[2d:], 3600 * 24 * 5) * on(cluster,pool_id) group_right() avg by (cluster,pool_id, name) (ceph_pool_metadata)) >= 0.95"
         for: "1h"
         labels:
           oid: "1.3.6.1.4.1.50495.1.2.1.9.2"
```

**File**: `deploy/charts/rook-ceph-cluster/tests/localrules.yaml` (added, +52/-0)
```diff
@@ -0,0 +1,52 @@
+# Run from this directory with: promtool test rules localrules.yaml
+# Do not use the *_test.yaml suffix, which is reserved for helm-unittest suites.
+# Percent-used values from Ceph are fractions. A fast-growing pool must alert,
+# while a flat pool and a slow-growing pool must not.
+rule_files:
+  - ../prometheus/localrules.yaml
+evaluation_interval: 1h
+tests:
+  - interval: 1h
+    input_series:
+      - series: 'ceph_pool_percent_used{cluster="mycluster",pool_id="1",instance="mgr-a"}'
+        values: '0.30+0.01x48'
+      - series: 'ceph_pool_percent_used{cluster="mycluster",pool_id="2",instance="mgr-a"}'
+        values: '0.20+0x48'
+      - series: 'ceph_pool_percent_used{cluster="mycluster",pool_id="3",instance="mgr-a"}'
+        values: '0.20+0.0002x48'
+      - series: 'ceph_pool_metadata{cluster="mycluster",pool_id="1",name="growing",instance="mgr-a"}'
+        values: '1+0x48'
+      - series: 'ceph_pool_metadata{cluster="mycluster",pool_id="2",name="flat",instance="mgr-a"}'
+        values: '1+0x48'
+      - series: 'ceph_pool_metadata{cluster="mycluster",pool_id="3",name="slow",instance="mgr-a"}'
+        values: '1+0x48'
+    alert_rule_test:
+      - eval_time: 1h
+        alertname: CephPoolGrowthWarning
+        exp_alerts: [] # the 1h pending period has not elapsed
+      - eval_time: 2h
+        alertname: CephPoolGrowthWarning
+        exp_alerts:
+          - exp_labels:
+              cluster: mycluster
+              pool_id: "1"
+              name: growing
+              severity: warning
+              type: ceph_default
+              oid: 1.3.6.1.4.1.50495.1.2.1.9.2
+            exp_annotations:
+              summary: Pool growth rate may soon exceed capacity on cluster mycluster
+              description: Pool 'growing' will be full in less than 5 days assuming the average fill-up rate of the past 48 hours.
+      - eval_time: 48h
+        alertname: CephPoolGrowthWarning
+        exp_alerts:
+          - exp_labels:
+              cluster: mycluster
+              pool_id: "1"
+              name: growing
+              severity: warning
+              type: ceph_default
+              oid: 1.3.6.1.4.1.50495.1.2.1.9.2
+            exp_annotations:
+              summary: Pool growth rate may soon exceed capacity on cluster mycluster
+              description: Pool 'growing' will be full in less than 5 days assuming the average fill-up rate of the past 48 hours.
```

**File**: `deploy/examples/monitoring/localrules.yaml` (modified, +1/-1)
```diff
@@ -571,7 +571,7 @@ spec:
           annotations:
             description: "Pool '{{ $labels.name }}' will be full in less than 5 days assuming the average fill-up rate of the past 48 hours."
             summary: "Pool growth rate may soon exceed capacity on cluster {{ $labels.cluster }}"
-          expr: "(predict_linear(avg by (cluster,pool_id) (ceph_pool_percent_used)[2d:], 3600 * 24 * 5) * on(cluster,pool_id) group_right() avg by (cluster,pool_id, name) (ceph_pool_metadata)) >= 95"
+          expr: "(predict_linear(avg by (cluster,pool_id) (ceph_pool_percent_used)[2d:], 3600 * 24 * 5) * on(cluster,pool_id) group_right() avg by (cluster,pool_id, name) (ceph_pool_metadata)) >= 0.95"
           for: "1h"
           labels:
             oid: "1.3.6.1.4.1.50495.1.2.1.9.2"
```

---

### Incident Patch 6: `41c99840` (2026-09-24)
**Commit Message**: monitoring: fix pool growth alert threshold

ceph_pool_percent_used reports a fraction, but the alert threshold
assumes a percentage. Change the threshold from 95 to 0.95 in the
Helm chart rules and example configuration. Keep for: 1h unchanged.

Add tests for fast-growing, slow-growing, and constant pool usage.
Exclude the test file from the packaged Helm chart.

Signed-off-by: Mikhail Basov <[REDACTED_EMAIL]>

**File**: `deploy/charts/rook-ceph-cluster/prometheus/localrules.yaml` (modified, +1/-1)
```diff
@@ -566,7 +566,7 @@ groups:
         annotations:
           description: "Pool '{{ $labels.name }}' will be full in less than 5 days assuming the average fill-up rate of the past 48 hours."
           summary: "Pool growth rate may soon exceed capacity on cluster {{ $labels.cluster }}"
-        expr: "(predict_linear(avg by (cluster,pool_id) (ceph_pool_percent_used)[2d:], 3600 * 24 * 5) * on(cluster,pool_id) group_right() avg by (cluster,pool_id, name) (ceph_pool_metadata)) >= 95"
+        expr: "(predict_linear(avg by (cluster,pool_id) (ceph_pool_percent_used)[2d:], 3600 * 24 * 5) * on(cluster,pool_id) group_right() avg by (cluster,pool_id, name) (ceph_pool_metadata)) >= 0.95"
         for: "1h"
         labels:
           oid: "1.3.6.1.4.1.50495.1.2.1.9.2"
```

**File**: `deploy/charts/rook-ceph-cluster/tests/localrules.yaml` (added, +52/-0)
```diff
@@ -0,0 +1,52 @@
+# Run from this directory with: promtool test rules localrules.yaml
+# Do not use the *_test.yaml suffix, which is reserved for helm-unittest suites.
+# Percent-used values from Ceph are fractions. A fast-growing pool must alert,
+# while a flat pool and a slow-growing pool must not.
+rule_files:
+  - ../prometheus/localrules.yaml
+evaluation_interval: 1h
+tests:
+  - interval: 1h
+    input_series:
+      - series: 'ceph_pool_percent_used{cluster="mycluster",pool_id="1",instance="mgr-a"}'
+        values: '0.30+0.01x48'
+      - series: 'ceph_pool_percent_used{cluster="mycluster",pool_id="2",instance="mgr-a"}'
+        values: '0.20+0x48'
+      - series: 'ceph_pool_percent_used{cluster="mycluster",pool_id="3",instance="mgr-a"}'
+        values: '0.20+0.0002x48'
+      - series: 'ceph_pool_metadata{cluster="mycluster",pool_id="1",name="growing",instance="mgr-a"}'
+        values: '1+0x48'
+      - series: 'ceph_pool_metadata{cluster="mycluster",pool_id="2",name="flat",instance="mgr-a"}'
+        values: '1+0x48'
+      - series: 'ceph_pool_metadata{cluster="mycluster",pool_id="3",name="slow",instance="mgr-a"}'
+        values: '1+0x48'
+    alert_rule_test:
+      - eval_time: 1h
+        alertname: CephPoolGrowthWarning
+        exp_alerts: [] # the 1h pending period has not elapsed
+      - eval_time: 2h
+        alertname: CephPoolGrowthWarning
+        exp_alerts:
+          - exp_labels:
+              cluster: mycluster
+              pool_id: "1"
+              name: growing
+              severity: warning
+              type: ceph_default
+              oid: 1.3.6.1.4.1.50495.1.2.1.9.2
+            exp_annotations:
+              summary: Pool growth rate may soon exceed capacity on cluster mycluster
+              description: Pool 'growing' will be full in less than 5 days assuming the average fill-up rate of the past 48 hours.
+      - eval_time: 48h
+        alertname: CephPoolGrowthWarning
+        exp_alerts:
+          - exp_labels:
+              cluster: mycluster
+              pool_id: "1"
+              name: growing
+              severity: warning
+              type: ceph_default
+              oid: 1.3.6.1.4.1.50495.1.2.1.9.2
+            exp_annotations:
+              summary: Pool growth rate may soon exceed capacity on cluster mycluster
+              description: Pool 'growing' will be full in less than 5 days assuming the average fill-up rate of the past 48 hours.
```

**File**: `deploy/examples/monitoring/localrules.yaml` (modified, +1/-1)
```diff
@@ -571,7 +571,7 @@ spec:
           annotations:
             description: "Pool '{{ $labels.name }}' will be full in less than 5 days assuming the average fill-up rate of the past 48 hours."
             summary: "Pool growth rate may soon exceed capacity on cluster {{ $labels.cluster }}"
-          expr: "(predict_linear(avg by (cluster,pool_id) (ceph_pool_percent_used)[2d:], 3600 * 24 * 5) * on(cluster,pool_id) group_right() avg by (cluster,pool_id, name) (ceph_pool_metadata)) >= 95"
+          expr: "(predict_linear(avg by (cluster,pool_id) (ceph_pool_percent_used)[2d:], 3600 * 24 * 5) * on(cluster,pool_id) group_right() avg by (cluster,pool_id, name) (ceph_pool_metadata)) >= 0.95"
           for: "1h"
           labels:
             oid: "1.3.6.1.4.1.50495.1.2.1.9.2"
```

---

### Incident Patch 7: `2ad3e5d1` (2026-09-28)
**Commit Message**: build(deps): bump github/codeql-action/upload-sarif

Bumps [github/codeql-action/upload-sarif](https://github.com/github/codeql-action) from 4.38.1 to 4.38.2.
- [Release notes](https://github.com/github/codeql-action/releases)
- [Changelog](https://github.com/github/codeql-action/blob/main/CHANGELOG.md)
- [Commits](https://github.com/github/codeql-action/compare/1c5b675653bb5c22dbe9b12b556ec555138e09fd...2892aa5e19bbd11bc0cff5427e3b750a04d9e3c2)

---
updated-dependencies:
- dependency-name: github/codeql-action/upload-sarif
  dependency-version: 4.38.2
  dependency-type: direct:production
  update-type: version-update:semver-patch
...

Signed-off-by: dependabot[bot] <[REDACTED_EMAIL]>

**File**: `.github/workflows/scorecards.yml` (modified, +1/-1)
```diff
@@ -65,6 +65,6 @@ jobs:
       # Upload the results to GitHub's code scanning dashboard (optional).
       # Commenting out will disable upload of results to your repo's Code Scanning dashboard
       - name: "Upload to code-scanning"
-        uses: github/codeql-action/upload-sarif@1c5b675653bb5c22dbe9b12b556ec555138e09fd # v4.38.1
+        uses: github/codeql-action/upload-sarif@2892aa5e19bbd11bc0cff5427e3b750a04d9e3c2 # v4.38.2
         with:
           sarif_file: results.sarif
```

---

### Incident Patch 8: `ed973952` (2026-09-28)
**Commit Message**: build(deps): bump the k8s-dependencies group with 5 updates

Bumps the k8s-dependencies group with 5 updates:

| Package | From | To |
| --- | --- | --- |
| [k8s.io/api](https://github.com/kubernetes/api) | `0.37.0` | `0.37.1` |
| [k8s.io/apimachinery](https://github.com/kubernetes/apimachinery) | `0.37.0` | `0.37.1` |
| [k8s.io/cli-runtime](https://github.com/kubernetes/cli-runtime) | `0.37.0` | `0.37.1` |
| [k8s.io/client-go](https://github.com/kubernetes/client-go) | `0.37.0` | `0.37.1` |
| [k8s.io/cloud-provider](https://github.com/kubernetes/cloud-provider) | `0.37.0` | `0.37.1` |


Updates `k8s.io/api` from 0.37.0 to 0.37.1
- [Commits](https://github.com/kubernetes/api/compare/v0.37.0...v0.37.1)

Updates `k8s.io/apimachinery` from 0.37.0 to 0.37.1
- [Commits](https://github.com/kubernetes/apimachinery/compare/v0.37.0...v0.37.1)

Updates `k8s.io/cli-runtime` from 0.37.0 to 0.37.1
- [Commits](https://github.com/kubernetes/cli-runtime/compare/v0.37.0...v0.37.1)

Updates `k8s.io/client-go` from 0.37.0 to 0.37.1
- [Changelog](https://github.com/kubernetes/client-go/blob/master/CHANGELOG.md)
- [Commits](https://github.com/kubernetes/client-go/compare/v0.37.0...v0.37.1)

Updates `k8

**File**: `go.mod` (modified, +6/-6)
```diff
@@ -45,12 +45,12 @@ require (
 	go.yaml.in/yaml/v3 v3.0.5
 	golang.org/x/sync v0.23.0
 	gopkg.in/ini.v1 v1.67.3
-	k8s.io/api v0.37.0
+	k8s.io/api v0.37.1
 	k8s.io/apiextensions-apiserver v0.37.0
-	k8s.io/apimachinery v0.37.0
-	k8s.io/cli-runtime v0.37.0
-	k8s.io/client-go v0.37.0
-	k8s.io/cloud-provider v0.37.0
+	k8s.io/apimachinery v0.37.1
+	k8s.io/cli-runtime v0.37.1
+	k8s.io/client-go v0.37.1
+	k8s.io/cloud-provider v0.37.1
 	k8s.io/utils v0.0.0-20260707023825-cf1189d6abe3
 	sigs.k8s.io/container-object-storage-interface/client v0.2.2
 	sigs.k8s.io/controller-runtime v0.25.1
@@ -172,7 +172,7 @@ require (
 	gopkg.in/inf.v0 v0.9.1 // indirect
 	k8s.io/klog/v2 v2.140.0 // indirect
 	k8s.io/kube-openapi v0.0.0-20260821135717-be32def86098 // indirect
-	k8s.io/streaming v0.37.0 // indirect
+	k8s.io/streaming v0.37.1 // indirect
 	sigs.k8s.io/json v0.0.0-20250730193827-2d320260d730 // indirect
 	sigs.k8s.io/kustomize/api v0.21.1 // indirect
 	sigs.k8s.io/kustomize/kyaml v0.21.1 // indirect
```

**File**: `go.sum` (modified, +12/-12)
```diff
@@ -2118,8 +2118,8 @@ k8s.io/api v0.20.1/go.mod h1:KqwcCVogGxQY3nBlRpwt+wpAMF/KjaCc7RpywacvqUo=
 k8s.io/api v0.20.4/go.mod h1:++lNL1AJMkDymriNniQsWRkMDzRaX2Y/POTUi8yvqYQ=
 k8s.io/api v0.23.5/go.mod h1:Na4XuKng8PXJ2JsploYYrivXrINeTaycCGcYgF91Xm8=
 k8s.io/api v0.26.0/go.mod h1:k6HDTaIFC8yn1i6pSClSqIwLABIcLV9l5Q4EcngKnQg=
-k8s.io/api v0.37.0 h1:Z//Vj9N7RA/yS2sDmxyeo7h+RR4zbUrd2vrd3Z0TbB4=
-k8s.io/api v0.37.0/go.mod h1:LKXgcJWMc+f4OLbP5SFR8rulEg07zZhpi/zMULiBImk=
+k8s.io/api v0.37.1 h1:l6N77U7tjwB5L056bgrBTJIEdevac/naBZ3iSvDNfpM=
+k8s.io/api v0.37.1/go.mod h1:zSlbB1YpJ1YQlFVQy20UYll81UJSJJUMLhkhvg6Z78M=
 k8s.io/apiextensions-apiserver v0.0.0-20190409022649-727a075fdec8/go.mod h1:IxkesAMoaCRoLrPJdZNZUQp9NfZnzqaVzLhb2VEQzXE=
 k8s.io/apiextensions-apiserver v0.18.3/go.mod h1:TMsNGs7DYpMXd+8MOCX8KzPOCx8fnZMoIGB24m03+JE=
 k8s.io/apiextensions-apiserver v0.20.1/go.mod h1:ntnrZV+6a3dB504qwC5PN/Yg9PBiDNt1EVqbW2kORVk=
@@ -2134,22 +2134,22 @@ k8s.io/apimachinery v0.20.1/go.mod h1:WlLqWAHZGg07AeltaI0MV5uk1Omp8xaN0JGLY6gkRp
 k8s.io/apimachinery v0.20.4/go.mod h1:WlLqWAHZGg07AeltaI0MV5uk1Omp8xaN0JGLY6gkRpU=
 k8s.io/apimachinery v0.23.5/go.mod h1:BEuFMMBaIbcOqVIJqNZJXGFTP4W6AycEpb5+m/97hrM=
 k8s.io/apimachinery v0.26.0/go.mod h1:tnPmbONNJ7ByJNz9+n9kMjNP8ON+1qoAIIC70lztu74=
-k8s.io/apimachinery v0.37.0 h1:Np2AbDtf8x6RDHiD8T9LbKJ9gaegeVNa8yNm5FuGKm0=
-k8s.io/apimachinery v0.37.0/go.mod h1:RN3nhprFSCxOi5Selxd7oMTXOe/c+ZbcE7Im+TS2zkE=
+k8s.io/apimachinery v0.37.1 h1:hGCYyvKHCwtwMitj2vU4vYx0Z16N9GyZk9BBnz0wDAE=
+k8s.io/apimachinery v0.37.1/go.mod h1:jF84AyUi/IRIXRot5f+lm6MpxoWI+F1XgjaMmwCdTFw=
 k8s.io/apiserver v0.18.3/go.mod h1:tHQRmthRPLUtwqsOnJJMoI8SW3lnoReZeE861lH8vUw=
 k8s.io/apiserver v0.20.1/go.mod h1:ro5QHeQkgMS7ZGpvf4tSMx6bBOgPfE+f52KwvXfScaU=
-k8s.io/cli-runtime v0.37.0 h1:U3XakUeirBQJMz5688r04z74SIHSE7V5SIZ6Ho5JyBM=
-k8s.io/cli-runtime v0.37.0/go.mod h1:qiQMFkKwFFuPH6zy953On+nc3qfpEHAIDrJmAuRz5Vg=
+k8s.io/cli-runtime v0.37.1 h1:3mir5bM4XjMJHW3SMRk++3Ylf4YQne0XFFsW+IGT85U=
+k8s.io/cli-runtime v0.37.1/go.mod h1:g3VQOm71f//aNbp79g0az9jBRTrvPjAHz7WxVysbZ4M=
 k8s.io/client-go v0.18.3/go.mod h1:4a/dpQEvzAhT1BbuWW09qvIaGw6Gbu1gZYiQZIi1DMw=
 k8s.io/client-go v0.19.0/go.mod h1:H9E/VT95blcFQnlyShFgnFT9ZnJOAceiUHM3MlRC+mU=
 k8s.io/client-go v0.19.2/go.mod h1:S5wPhCqyDNAlzM9CnEdgTGV4OqhsW3jGO1UM1epwfJA=
 k8s.io/client-go v0.20.0/go.mod h1:4KWh/g+Ocd8KkCwKF8vUNnmqgv+EVnQDK4MBF4oB5tY=
 k8s.io/client-go v0.20.1/go.mod h1:/zcHdt1TeWSd5HoUe6elJmHSQ6uLLgp4bIJHVEuy+/Y=
 k8s.io/client-go v0.23.5/go.mod h1:flkeinTO1CirYgzMPRWxUCnV0G4Fbu2vLhYCObnt/r4=
-k8s.io/client-go v0.37.0 h1:nsN31fy8wBySuZ+QRnKmrjRSQLOG2rvoGN0tKd12zhQ=
-k8s.io/client-go v0.37.0/go.mod h1:FcGqw+Ll/gNQiq+nPGY1Oyt9y7SgDh1d3MW3RFDEbn0=
-k8s.io/cloud-provider v0.37.0 h1:pJpZfsFC3kuFqWODuE6ReZK/oysNu86Bm9IDfsO82wo=
-k8s.io/cloud-provider v0.37.0/go.mod h1:q17nnGXsvnd9o24QY6Mtvs+pSitAMUKOWkx6lT7G9tY=
+k8s.io/client-go v0.37.1 h1:QTv/5ha4jAHtW9qxxVBkQVFBRDb4jHfFopQqqMdc+wM=
+k8s.io/client-go v0.37.1/go.mod h1:dnAPtTnCNY38Ho04D2KdY1F4IKausa9UbqaAZKl60SY=
+k8s.io/cloud-provider v0.37.1 h1:ejOg9OYS7hMNCF34RdVFLeHTURzI8DLi1hWBgsO8WFo=
+k8s.io/cloud-provider v0.37.1/go.mod h1:XyEj6/9SS2oGQMSF6wa7r4Vp2fewx+uAMkhN3UMTiLI=
 k8s.io/code-generator v0.18.3/go.mod h1:TgNEVx9hCyPGpdtCWA34olQYLkh3ok9ar7XfSsr8b6c=
 k8s.io/code-generator v0.19.0/go.mod h1:moqLn7w0t9cMs4+5CQyxnfA/HV8MF6aAVENF+WZZhgk=
 k8s.io/code-generator v0.20.0/go.mod h1:UsqdF+VX4PU2g46NC2JRs4gc+IfrctnwHb76RNbWHJg=
@@ -2181,8 +2181,8 @@ k8s.io/kube-openapi v0.0.0-20211115234752-e816edb12b65/go.mod h1:sX9MT8g7NVZM5lV
 k8s.io/kube-openapi v0.0.0-20221012153701-172d655c2280/go.mod h1:+Axhij7bCpeqhklhUTe3xmOn6bWxolyZEeyaFpjGtl4=
 k8s.io/kube-openapi v0.0.0-20260821135717-be32def86098 h1:z5+pcu1jTyKK5mNTe2/+x+U6Uuv9jRVOJQLaBJJMpeI=
 k8s.io/kube-openapi v0.0.0-20260821135717-be32def86098/go.mod h1:0/mqHCVhlumdJ3BhCfnjSZQE037nAhNodh1/hK0T8/I=
-k8s.io/streaming v0.37.0 h1:iPBUZLZiKt5bV+lxJurASMOV07VuBhNpiwJt2//AWrM=
-k8s.io/streaming v0.37.0/go.mod h1:APlJR26ZWRcVy5bIEj0QRrKUXROtBHPcxl2NT7EAzPU=
+k8s.io/streaming v0.37.1 h1:TpzVfQeFuVndn2g9mFqxy1UcUYPwDzqjUmwR/IzJCWc=
+k8s.io/streaming v0.37.1/go.mod h1:APlJR26ZWRcVy5bIEj0QRrKUXROtBHPcxl2NT7EAzPU=
 k8s.io/utils v0.0.0-20190506122338-8fab8cb257d5/go.mod h1:sZAwmy6armz5eXlNoLmJcl4F1QuKu7sr+mFQ0byX7Ew=
 k8s.io/utils v0.0.0-20200324210504-a9aa75ae1b89/go.mod h1:sZAwmy6armz5eXlNoLmJcl4F1QuKu7sr+mFQ0byX7Ew=
 k8s.io/utils v0.0.0-20200729134348-d5654de09c73/go.mod h1:jPW/WVKK9YHAvNhRxK0md/EJ228hCsBRufyofKtW8HA=
```

**File**: `pkg/apis/go.mod` (modified, +3/-3)
```diff
@@ -16,8 +16,8 @@ require (
 	github.com/openshift/api v0.0.0-20241216151652-de9de05a8e43
 	github.com/pkg/errors v0.9.1
 	github.com/stretchr/testify v1.12.1
-	k8s.io/api v0.37.0
-	k8s.io/apimachinery v0.37.0
+	k8s.io/api v0.37.1
+	k8s.io/apimachinery v0.37.1
 	k8s.io/utils v0.0.0-20260707023825-cf1189d6abe3
 )
 
@@ -81,7 +81,7 @@ require (
 	google.golang.org/protobuf v1.36.12 // indirect
 	gopkg.in/evanphx/json-patch.v4 v4.13.0 // indirect
 	gopkg.in/inf.v0 v0.9.1 // indirect
-	k8s.io/client-go v0.37.0 // indirect
+	k8s.io/client-go v0.37.1 // indirect
 	k8s.io/klog/v2 v2.140.0 // indirect
 	k8s.io/kube-openapi v0.0.0-20260821135717-be32def86098 // indirect
 	sigs.k8s.io/json v0.0.0-20250730193827-2d320260d730 // indirect
```

**File**: `pkg/apis/go.sum` (modified, +6/-6)
```diff
@@ -1435,8 +1435,8 @@ k8s.io/api v0.20.1/go.mod h1:KqwcCVogGxQY3nBlRpwt+wpAMF/KjaCc7RpywacvqUo=
 k8s.io/api v0.20.4/go.mod h1:++lNL1AJMkDymriNniQsWRkMDzRaX2Y/POTUi8yvqYQ=
 k8s.io/api v0.23.5/go.mod h1:Na4XuKng8PXJ2JsploYYrivXrINeTaycCGcYgF91Xm8=
 k8s.io/api v0.26.0/go.mod h1:k6HDTaIFC8yn1i6pSClSqIwLABIcLV9l5Q4EcngKnQg=
-k8s.io/api v0.37.0 h1:Z//Vj9N7RA/yS2sDmxyeo7h+RR4zbUrd2vrd3Z0TbB4=
-k8s.io/api v0.37.0/go.mod h1:LKXgcJWMc+f4OLbP5SFR8rulEg07zZhpi/zMULiBImk=
+k8s.io/api v0.37.1 h1:l6N77U7tjwB5L056bgrBTJIEdevac/naBZ3iSvDNfpM=
+k8s.io/api v0.37.1/go.mod h1:zSlbB1YpJ1YQlFVQy20UYll81UJSJJUMLhkhvg6Z78M=
 k8s.io/apiextensions-apiserver v0.0.0-20190409022649-727a075fdec8/go.mod h1:IxkesAMoaCRoLrPJdZNZUQp9NfZnzqaVzLhb2VEQzXE=
 k8s.io/apiextensions-apiserver v0.18.3/go.mod h1:TMsNGs7DYpMXd+8MOCX8KzPOCx8fnZMoIGB24m03+JE=
 k8s.io/apiextensions-apiserver v0.20.1/go.mod h1:ntnrZV+6a3dB504qwC5PN/Yg9PBiDNt1EVqbW2kORVk=
@@ -1449,8 +1449,8 @@ k8s.io/apimachinery v0.20.1/go.mod h1:WlLqWAHZGg07AeltaI0MV5uk1Omp8xaN0JGLY6gkRp
 k8s.io/apimachinery v0.20.4/go.mod h1:WlLqWAHZGg07AeltaI0MV5uk1Omp8xaN0JGLY6gkRpU=
 k8s.io/apimachinery v0.23.5/go.mod h1:BEuFMMBaIbcOqVIJqNZJXGFTP4W6AycEpb5+m/97hrM=
 k8s.io/apimachinery v0.26.0/go.mod h1:tnPmbONNJ7ByJNz9+n9kMjNP8ON+1qoAIIC70lztu74=
-k8s.io/apimachinery v0.37.0 h1:Np2AbDtf8x6RDHiD8T9LbKJ9gaegeVNa8yNm5FuGKm0=
-k8s.io/apimachinery v0.37.0/go.mod h1:RN3nhprFSCxOi5Selxd7oMTXOe/c+ZbcE7Im+TS2zkE=
+k8s.io/apimachinery v0.37.1 h1:hGCYyvKHCwtwMitj2vU4vYx0Z16N9GyZk9BBnz0wDAE=
+k8s.io/apimachinery v0.37.1/go.mod h1:jF84AyUi/IRIXRot5f+lm6MpxoWI+F1XgjaMmwCdTFw=
 k8s.io/apiserver v0.18.3/go.mod h1:tHQRmthRPLUtwqsOnJJMoI8SW3lnoReZeE861lH8vUw=
 k8s.io/apiserver v0.20.1/go.mod h1:ro5QHeQkgMS7ZGpvf4tSMx6bBOgPfE+f52KwvXfScaU=
 k8s.io/client-go v0.18.3/go.mod h1:4a/dpQEvzAhT1BbuWW09qvIaGw6Gbu1gZYiQZIi1DMw=
@@ -1459,8 +1459,8 @@ k8s.io/client-go v0.19.2/go.mod h1:S5wPhCqyDNAlzM9CnEdgTGV4OqhsW3jGO1UM1epwfJA=
 k8s.io/client-go v0.20.0/go.mod h1:4KWh/g+Ocd8KkCwKF8vUNnmqgv+EVnQDK4MBF4oB5tY=
 k8s.io/client-go v0.20.1/go.mod h1:/zcHdt1TeWSd5HoUe6elJmHSQ6uLLgp4bIJHVEuy+/Y=
 k8s.io/client-go v0.23.5/go.mod h1:flkeinTO1CirYgzMPRWxUCnV0G4Fbu2vLhYCObnt/r4=
-k8s.io/client-go v0.37.0 h1:nsN31fy8wBySuZ+QRnKmrjRSQLOG2rvoGN0tKd12zhQ=
-k8s.io/client-go v0.37.0/go.mod h1:FcGqw+Ll/gNQiq+nPGY1Oyt9y7SgDh1d3MW3RFDEbn0=
+k8s.io/client-go v0.37.1 h1:QTv/5ha4jAHtW9qxxVBkQVFBRDb4jHfFopQqqMdc+wM=
+k8s.io/client-go v0.37.1/go.mod h1:dnAPtTnCNY38Ho04D2KdY1F4IKausa9UbqaAZKl60SY=
 k8s.io/code-generator v0.18.3/go.mod h1:TgNEVx9hCyPGpdtCWA34olQYLkh3ok9ar7XfSsr8b6c=
 k8s.io/code-generator v0.19.0/go.mod h1:moqLn7w0t9cMs4+5CQyxnfA/HV8MF6aAVENF+WZZhgk=
 k8s.io/code-generator v0.20.0/go.mod h1:UsqdF+VX4PU2g46NC2JRs4gc+IfrctnwHb76RNbWHJg=
```

---

### Incident Patch 9: `1880ff34` (2026-09-28)
**Commit Message**: build(deps): bump reviewdog/action-misspell from 1.30.0 to 1.30.1

Bumps [reviewdog/action-misspell](https://github.com/reviewdog/action-misspell) from 1.30.0 to 1.30.1.
- [Release notes](https://github.com/reviewdog/action-misspell/releases)
- [Commits](https://github.com/reviewdog/action-misspell/compare/5f62a0ac088400bd1a3283bbb109efc5a22e8171...7cea3d501cb3834c688e08c89ed77b71764d1784)

---
updated-dependencies:
- dependency-name: reviewdog/action-misspell
  dependency-version: 1.30.1
  dependency-type: direct:production
  update-type: version-update:semver-patch
...

Signed-off-by: dependabot[bot] <[REDACTED_EMAIL]>

**File**: `.github/workflows/codespell.yaml` (modified, +1/-1)
```diff
@@ -57,4 +57,4 @@ jobs:
         with:
           fetch-depth: 0
       - name: misspell
-        uses: reviewdog/action-misspell@5f62a0ac088400bd1a3283bbb109efc5a22e8171 # v1.30.0
+        uses: reviewdog/action-misspell@7cea3d501cb3834c688e08c89ed77b71764d1784 # v1.30.1
```

---

### Incident Patch 10: `91b6b9d8` (2026-08-04)
**Commit Message**: core: make kernelMountOptions conditional on requireMsgr2

The test manifests were unconditionally setting ms_mode to prefer-crc in
kernelMountOptions for all test clusters. The Ceph and Helm upgrade
tests initally run a v1.19.5 cluster, which has requireMsgr2=false, so
monitors serve on port 6789 but the kernel CephFS client uses msgr2,
causing a protocol mismatch. This change makes kernelMountOptions
conditional, ms_mode=prefer-crc is added only when requireMsgr2=true.

Signed-off-by: Prabhala Tara Aasrita <[REDACTED_EMAIL]>

**File**: `tests/framework/installer/ceph_manifests.go` (modified, +9/-6)
```diff
@@ -255,20 +255,23 @@ spec:
 `
 	}
 
-	msMode := "prefer-crc"
 	if m.settings.ConnectionsEncrypted {
-		msMode = "secure"
-	}
-	clusterSpec += `
+		clusterSpec += `
+  csi:
+    cephfs:
+      kernelMountOptions: ms_mode=secure`
+	} else if m.settings.RequireMsgr2 {
+		clusterSpec += `
   csi:
     cephfs:
-      kernelMountOptions: ms_mode=` + msMode + `
+      kernelMountOptions: ms_mode=prefer-crc`
+	}
+	return clusterSpec + `
   priorityClassNames:
     mon: system-node-critical
     osd: system-node-critical
     mgr: system-cluster-critical
 `
-	return clusterSpec
 }
 
 func (m *CephManifestsMaster) GetBlockSnapshotClass(snapshotClassName, reclaimPolicy string) string {
```

---

### Incident Patch 11: `82dbab56` (2026-07-30)
**Commit Message**: core: set msgr2 as required by default

The msgrv2 protocol is required by default. This requires
the v5.11 kernel. If this version or newer of the kernel
is not available, disable msgrv2 with the cephcluster setting
network.connections.requireMsgr2: true.

Signed-off-by: Travis Nielsen <[REDACTED_EMAIL]>

**File**: `PendingReleaseNotes.md` (modified, +3/-0)
```diff
@@ -6,6 +6,9 @@
 - The OSD prepare job now fails, and is retried by Kubernetes, when a freshly prepared device is
   missing from the `ceph-volume raw list` output, instead of silently reporting fewer OSDs than
   were prepared (which left OSDs registered in the osdmap with no OSD deployment created).
+- Ceph msgrv2 is required by default. Msgrv2 requires the 5.11 kernel. If you have an older kernel, disable the msgrv2 protocol
+  with the CephCluster CR setting `network.connections.requireMsgr2: false`. If using the helm chart, this same value is applied
+  under the `cephClusterSpec` of the values.
 
 ## Features
 
```

**File**: `deploy/charts/rook-ceph-cluster/values.yaml` (modified, +1/-1)
```diff
@@ -216,7 +216,7 @@ cephClusterSpec:
       # Whether to require communication over msgr2. If true, the msgr v1 port (6789) will be disabled
       # and clients will be required to connect to the Ceph cluster with the v2 port (3300).
       # Requires a kernel that supports msgr v2 (kernel 5.11 or CentOS 8.4 or newer).
-      requireMsgr2: false
+      requireMsgr2: true
   #   # enable host networking
   #   provider: host
   #   # EXPERIMENTAL: enable the Multus network provider
```

**File**: `deploy/examples/cluster-test.yaml` (modified, +3/-0)
```diff
@@ -36,6 +36,9 @@ spec:
     enabled: true
   crashCollector:
     disable: true
+  network:
+    connections:
+      requireMsgr2: true
   storage:
     useAllNodes: true
     useAllDevices: true
```

**File**: `deploy/examples/cluster.yaml` (modified, +1/-1)
```diff
@@ -130,7 +130,7 @@ spec:
       # Whether to require communication over msgr2. If true, the msgr v1 port (6789) will be disabled
       # and clients will be required to connect to the Ceph cluster with the v2 port (3300).
       # Requires a kernel that supports msgr v2 (kernel 5.11 or CentOS 8.4 or newer).
-      requireMsgr2: false
+      requireMsgr2: true
     # enable host networking
     #provider: host
     # enable the Multus network provider
```

**File**: `tests/integration/ceph_upgrade_test.go` (modified, +2/-2)
```diff
@@ -522,9 +522,9 @@ func (s *UpgradeSuite) upgradeToMaster() {
 	// that the manifests point to master.
 	require.NoError(s.T(), s.installer.CreateNetworkPolicies())
 
+	logger.Info("Requiring msgr2 during helm upgrade to test the port conversion from 6789 to 3300")
+	s.settings.RequireMsgr2 = true
 	if s.settings.UseHelm {
-		logger.Info("Requiring msgr2 during helm upgrade to test the port conversion from 6789 to 3300")
-		s.settings.RequireMsgr2 = true
 		// Upgrade the operator chart
 		err := s.installer.UpgradeRookOperatorViaHelm()
 		require.NoError(s.T(), err, "failed to upgrade the operator chart")
```

---

### Incident Patch 12: `b9392fcc` (2026-09-22)
**Commit Message**: docs: update the upgrade guide for v1.21

This change updates the upgrade guide to reflect v1.21 changes.

Co-authored-by: Blaine Gardner <[REDACTED_EMAIL]>
Signed-off-by: Michael Adam <[REDACTED_EMAIL]>

**File**: `Documentation/Upgrade/rook-upgrade.md` (modified, +35/-54)
```diff
@@ -14,14 +14,15 @@ We welcome feedback and opening issues!
 
 ## Supported Versions
 
-This guide is for upgrading from **Rook v1.19.x to Rook v1.20.x**.
+This guide is for upgrading from **Rook v1.20.x to Rook v1.21.x**.
 
 Please refer to the upgrade guides from previous releases for supported upgrade paths.
 Rook upgrades are only supported between official releases.
 
 For a guide to upgrade previous versions of Rook, please refer to the version of documentation for
 those releases.
 
+* [Upgrade 1.19 to 1.20](https://rook.io/docs/rook/v1.20/Upgrade/rook-upgrade/)
 * [Upgrade 1.18 to 1.19](https://rook.io/docs/rook/v1.19/Upgrade/rook-upgrade/)
 * [Upgrade 1.17 to 1.18](https://rook.io/docs/rook/v1.18/Upgrade/rook-upgrade/)
 * [Upgrade 1.16 to 1.17](https://rook.io/docs/rook/v1.17/Upgrade/rook-upgrade/)
@@ -34,13 +35,16 @@ those releases.
     official releases. Builds from the master branch can have functionality changed or removed at any
     time without compatibility support and without prior notice.
 
-## Breaking changes in v1.20
+## Breaking changes in v1.21
 
-* **CSI drivers are admin-managed via the ceph-csi-operator.** Rook no longer deploys CSI
-    drivers. Existing CSI settings that were configured through the `rook-ceph-operator-config`
-    ConfigMap must be migrated to the ceph-csi-operator resources. The following sections will guide
-    you through this conversion.
 
+* Helm OCI chart tags no longer include the `v` prefix (e.g., `1.21.0` instead of `v1.21.0`). Update any scripts or tooling that reference the chart by tag.
+* Ceph msgrv2 is required by default.
+    * Msgrv2 requires the 5.11 kernel. If you have an older kernel, disable the msgrv2 protocol
+        with the CephCluster CR setting `network.connections.requireMsgr2: false`. If using the helm chart, this same value is applied
+        under the `cephClusterSpec` of the values.
+    * To preserve compatibility, existing volume mounts will continue to use the msgrv1 protocol until they are drained and remounted.
+    * Ceph mons will not exclusively require msgrv2 until new mons are deployed during mon failover.
 * The minimum supported Kubernetes version is v1.32.
 
 ## Considerations
@@ -57,24 +61,24 @@ With this upgrade guide, there are a few notes to consider:
 
 Unless otherwise noted due to extenuating requirements, upgrades from one patch release of Rook to
 another are as simple as updating the common resources and the image of the Rook operator. For
-example, when Rook v1.20.1 is released, the process of updating from v1.20.0 is as simple as running
+example, when Rook v1.21.1 is released, the process of updating from v1.21.0 is as simple as running
 the following:
 
 ```console
-git clone --single-branch --depth=1 --branch v1.20.1 https://github.com/rook/rook.git
+git clone --single-branch --depth=1 --branch v1.21.1 https://github.com/rook/rook.git
 cd rook/deploy/examples
 ```
 
 If the Rook Operator or CephCluster are deployed into a different namespace than
-`rook-ceph`, see the [Update common resources and CRDs](#2-update-common-resources-and-crds)
+`rook-ceph`, see the [Update common resources and CRDs](#1-update-common-resources-and-crds)
 section for instructions on how to change the default namespaces in `common.yaml`.
 
-Then, apply the latest changes from v1.20, update CSI operator resources, and update the Rook
+Then, apply the latest changes from v1.21, update CSI operator resources, and update the Rook
 Operator image.
 
 ```console
 kubectl apply -f common.yaml -f crds.yaml -f csi-operator.yaml
-kubectl -n rook-ceph set image deploy/rook-ceph-operator rook-ceph-operator=rook/ceph:v1.20.1
+kubectl -n rook-ceph set image deploy/rook-ceph-operator rook-ceph-operator=rook/ceph:v1.21.1
 ```
 
 A good practice is to update Rook common resources from the example
@@ -143,9 +147,9 @@ In order to successfully upgrade a Rook cluster, the following prerequisites mus
 
 ## Rook Operator Upgrade
 
-The examples given in this guide upgrade a live Rook cluster running `v1.19.6` to
-the version `v1.20.0`. This upgrade should work from any official patch release of Rook v1.19 to any
-official patch release of v1.20.
+The examples given in this guide upgrade a live Rook cluster running `v1.19.11` to
+the version `v1.21.0`. This upgrade should work from any official patch release of Rook v1.20 to any
+official patch release of v1.21.
 
 Let's get started!
 
@@ -160,31 +164,8 @@ export ROOK_OPERATOR_NAMESPACE=rook-ceph
 export ROOK_CLUSTER_NAMESPACE=rook-ceph
 ```
 
-### **1. Save existing CSI settings**
 
-If custom CSI settings are required, in previous releases they were applied in the ConfigMap `rook-ceph-operator-config`
-as defined in `operator.yaml`, or in the `rook-ceph` helm chart. Starting in Rook v1.18, Rook
-converted these Rook settings in the Ceph-CSI operator settings and automatically created the
-`OperatorConfig` and `Driver` CRs.
-
-Before upgrading to v1.20, retrieve these CRs to get your desired sett
```

---

### Incident Patch 13: `328387d8` (2026-09-04)
**Commit Message**: security: drop command output from unmarshal error text

Three unmarshal failures wrapped their raw input into the returned error, and
that input is a credential-bearing command response in every case: a
radosgw-admin user document, which carries the user's S3 access and secret
keys, and ceph-volume list output, which carries ceph.cephx_lockbox_secret
for encrypted OSDs.

These errors do not stop at the operator log. The object store user error is
reported through ReportReconcileResult, which writes it to a Kubernetes event
and the CephObjectStore status, and the ceph-volume list error becomes
OrchestrationStatus.Message, which the OSD provisioning job writes to a
ConfigMap. Each is readable without the access needed to read the Secret the
value belongs in. The third site is the OSD replacement path, which carries
the same payload from the same command.

Report the response size in place of the response. A type error already names
the offending field, but json.SyntaxError reports only its own message and
never its offset, and a malformed response is the likelier failure for
ceph-volume list calls: callCephVolume avoids combined output precisely
because stderr contamination breaks t

**File**: `pkg/daemon/ceph/osd/replace.go` (modified, +1/-1)
```diff
@@ -51,7 +51,7 @@ func cephVolumeLVMList(context *clusterd.Context, osdID int) ([]cvLVMListEntry,
 	}
 	var listResult map[string][]cvLVMListEntry
 	if err := json.Unmarshal([]byte(result), &listResult); err != nil {
-		return nil, errors.Wrapf(err, "failed to unmarshal ceph-volume lvm list result for osd.%d. %s", osdID, result)
+		return nil, errors.Wrapf(err, "failed to unmarshal ceph-volume lvm list result for osd.%d (%d bytes)", osdID, len(result))
 	}
 	return listResult[strconv.Itoa(osdID)], nil
 }
```

**File**: `pkg/daemon/ceph/osd/replace_test.go` (modified, +21/-0)
```diff
@@ -691,3 +691,24 @@ func TestIsCryptsetupNotActive(t *testing.T) {
 	assert.False(t, isCryptsetupNotActive(errors.New("exit status 1")))
 	assert.False(t, isCryptsetupNotActive(nil))
 }
+
+func TestCephVolumeLVMListParseFailureDoesNotLeakLockboxSecret(t *testing.T) {
+	// the raw ceph-volume response carries ceph.cephx_lockbox_secret even though
+	// osdTags does not map it, so the payload must not ride along with the error
+	const lockboxSecret = "EXAMPLELOCKBOXSECRET00000000000000000001"
+	badResult := `{"3": [{"type": "block", "path": 12345, "tags": {"ceph.encrypted": "1", "ceph.cephx_lockbox_secret": "` + lockboxSecret + `"}}]}`
+
+	executor := &exectest.MockExecutor{}
+	executor.MockExecuteCommandWithOutput = func(command string, args ...string) (string, error) {
+		if command == "stdbuf" && args[4] == "lvm" && args[5] == "list" {
+			return badResult, nil
+		}
+		return "", errors.Errorf("unknown command %s %s", command, args)
+	}
+
+	_, err := cephVolumeLVMList(&clusterd.Context{Executor: executor}, 3)
+
+	require.Error(t, err)
+	assert.NotContains(t, err.Error(), lockboxSecret)
+	assert.Contains(t, err.Error(), "cvLVMListEntry.path of type string")
+}
```

**File**: `pkg/daemon/ceph/osd/volume.go` (modified, +4/-1)
```diff
@@ -1220,7 +1220,10 @@ func GetCephVolumeLVMOSDs(context *clusterd.Context, clusterInfo *client.Cluster
 	var cephVolumeResult map[string][]osdInfo
 	err = json.Unmarshal([]byte(result), &cephVolumeResult)
 	if err != nil {
-		return nil, errors.Wrapf(err, "failed to unmarshal ceph-volume %s list results. %s", cvMode, result)
+		// the payload carries ceph.cephx_lockbox_secret for encrypted OSDs, and this
+		// error reaches the OSD status ConfigMap. A syntax error reports only its
+		// message, so report the response size in place of the response.
+		return nil, errors.Wrapf(err, "failed to unmarshal ceph-volume %s list results (%d bytes)", cvMode, len(result))
 	}
 
 	for name, osdInfo := range cephVolumeResult {
```

**File**: `pkg/daemon/ceph/osd/volume_test.go` (modified, +53/-0)
```diff
@@ -1870,6 +1870,59 @@ func TestCephVolumeResponseIsNotLoggedWithLockboxSecret(t *testing.T) {
 	assert.Contains(t, logOutput, "dbe407e0-c1cb-495e-b30a-02e01de6c8ae")
 }
 
+func TestCephVolumeLVMResultParseFailureDoesNotLeakLockboxSecret(t *testing.T) {
+	// ceph-volume list output carries ceph.cephx_lockbox_secret for encrypted OSDs.
+	// This error becomes OrchestrationStatus.Message, which the OSD provisioning job
+	// writes to a ConfigMap, so the payload must not ride along with it.
+	const lockboxSecret = "EXAMPLELOCKBOXSECRET00000000000000000001"
+	tags := `"tags": {"ceph.osd_fsid": "9ee6a1e7-1c3f-4c1e-9a5b-0c4b1f2d3e4f", "ceph.encrypted": "1", "ceph.cephx_lockbox_secret": "` + lockboxSecret + `"}`
+
+	tests := []struct {
+		name   string
+		result string
+		// the field a type error names; empty when the error is a syntax error,
+		// which reports only its own message
+		namesField string
+	}{
+		{
+			// path is a string in osdInfo, so a number is the shape a ceph-volume
+			// schema change would take
+			name:       "type error",
+			result:     `{"0": [{"name": "osd-block-9ee6a1e7", "path": 12345, ` + tags + `, "type": "block"}]}`,
+			namesField: "osdInfo.path of type string",
+		},
+		{
+			// callCephVolume warns that stderr contamination breaks the unmarshal, so
+			// a malformed response is the likelier failure here
+			name:   "truncated response",
+			result: `{"0": [{"name": "osd-block-9ee6a1e7", ` + tags,
+		},
+	}
+
+	for _, tc := range tests {
+		t.Run(tc.name, func(t *testing.T) {
+			executor := &exectest.MockExecutor{}
+			executor.MockExecuteCommandWithOutput = func(command string, args ...string) (string, error) {
+				if command == "stdbuf" && args[4] == "lvm" && args[5] == "list" {
+					return tc.result, nil
+				}
+				return "", errors.Errorf("unknown command %s %s", command, args)
+			}
+
+			context := &clusterd.Context{Executor: executor}
+			_, err := GetCephVolumeLVMOSDs(context, &cephclient.ClusterInfo{Namespace: "name"}, "4bfe8b72-5e69-4330-b6c0-4d914db8ab89", "", false, false)
+
+			require.Error(t, err)
+			assert.NotContains(t, err.Error(), lockboxSecret)
+			// the response size is the only context a syntax error leaves
+			assert.Contains(t, err.Error(), fmt.Sprintf("(%d bytes)", len(tc.result)))
+			if tc.namesField != "" {
+				assert.Contains(t, err.Error(), tc.namesField)
+			}
+		})
+	}
+}
+
 func TestParseCephVolumeRawResult(t *testing.T) {
 	executor := &exectest.MockExecutor{}
 	executor.MockExecuteCommandWithOutput = func(command string, args ...string) (string, error) {
```

**File**: `pkg/operator/ceph/object/user.go` (modified, +5/-1)
```diff
@@ -56,7 +56,11 @@ func decodeUser(data string) (*ObjectUser, int, error) {
 	var user admin.User
 	err := json.Unmarshal([]byte(data), &user)
 	if err != nil {
-		return nil, RGWErrorParse, errors.Wrapf(err, "failed to unmarshal json. %s", data)
+		// the payload is a radosgw-admin user document, which carries the user's S3
+		// keys. A type error names the offending field, but a syntax error reports
+		// only its message, so report the response size in its place.
+		logger.Tracef("failed to unmarshal user json: %s", data) // only trace(insecure) logged because the response carries the user's S3 keys
+		return nil, RGWErrorParse, errors.Wrapf(err, "failed to unmarshal user json (%d bytes)", len(data))
 	}
 
 	rookUser := ObjectUser{UserID: user.ID, DisplayName: &user.DisplayName, Email: &user.Email}
```

**File**: `pkg/operator/ceph/object/user_test.go` (added, +122/-0)
```diff
@@ -0,0 +1,122 @@
+/*
+Copyright 2026 The Rook Authors. All rights reserved.
+
+Licensed under the Apache License, Version 2.0 (the "License");
+you may not use this file except in compliance with the License.
+You may obtain a copy of the License at
+
+	http://www.apache.org/licenses/LICENSE-2.0
+
+Unless required by applicable law or agreed to in writing, software
+distributed under the License is distributed on an "AS IS" BASIS,
+WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
+See the License for the specific language governing permissions and
+limitations under the License.
+*/
+
+package object
+
+import (
+	"bytes"
+	"fmt"
+	"os"
+	"testing"
+
+	"github.com/coreos/pkg/capnslog"
+	"github.com/stretchr/testify/assert"
+	"github.com/stretchr/testify/require"
+)
+
+func TestDecodeUserDoesNotLeakKeys(t *testing.T) {
+	// decodeUser is handed radosgw-admin user output, which carries the user's S3
+	// keys. Its error reaches a Kubernetes event and the CephObjectStore status by
+	// way of the admin-ops and dashboard user provisioning.
+	const (
+		accessKey = "EXAMPLEACCESSKEYID01"
+		secretKey = "EXAMPLEUSERSECRETKEY0000000000000000000001"
+	)
+	keys := `"keys": [{"user": "my-user", "access_key": "` + accessKey + `", "secret_key": "` + secretKey + `"}]`
+
+	tests := []struct {
+		name string
+		json string
+		// the field a type error names; empty when the error is a syntax error,
+		// which reports only its own message
+		namesField string
+	}{
+		{
+			// max_buckets is an int in admin.User, so a string is the shape a schema
+			// change across Ceph versions would take
+			name:       "type error",
+			json:       `{"user_id": "my-user", "max_buckets": "not-an-int", ` + keys + `}`,
+			namesField: "max_buckets",
+		},
+		{
+			name: "truncated response",
+			json: `{"user_id": "my-user", ` + keys,
+		},
+	}
+
+	for _, tc := range tests {
+		t.Run(tc.name, func(t *testing.T) {
+			_, code, err := decodeUser(tc.json)
+
+			require.Error(t, err)
+			assert.Equal(t, RGWErrorParse, code)
+			assert.NotContains(t, err.Error(), secretKey)
+			assert.NotContains(t, err.Error(), accessKey)
+			// the response size is the only context a syntax error leaves
+			assert.Contains(t, err.Error(), fmt.Sprintf("(%d bytes)", len(tc.json)))
+			if tc.namesField != "" {
+				assert.Contains(t, err.Error(), tc.namesField)
+			}
+		})
+	}
+}
+
+// captureLogsAtLevel redirects the capnslog sink into a buffer at the given level
+// for the duration of the test, restoring the package default afterwards so later
+// tests still log to stderr and never at TRACE.
+func captureLogsAtLevel(t *testing.T, level capnslog.LogLevel) *bytes.Buffer {
+	t.Helper()
+
+	logBuf := bytes.NewBuffer([]byte{})
+	capnslog.SetFormatter(capnslog.NewLogFormatter(logBuf, "", 0))
+	capnslog.SetGlobalLogLevel(level)
+	t.Cleanup(func() {
+		capnslog.SetFormatter(capnslog.NewDefaultFormatter(os.Stderr))
+		capnslog.SetGlobalLogLevel(capnslog.INFO)
+	})
+
+	return logBuf
+}
+
+func TestDecodeUserLogsRawResponseOnlyUnderTrace(t *testing.T) {
+	// the raw response is the only way to tell a truncated document from a schema
+	// change, but it carries the user's S3 keys, so it is logged only at the TRACE
+	// level that ROOK_LOG_LEVEL=TRACE_INSECURE unlocks.
+	const secretKey = "EXAMPLEUSERSECRETKEY0000000000000000000001"
+	badJSON := `{"user_id": "my-user", "keys": [{"secret_key": "` + secretKey + `"}]`
+
+	for _, tc := range []struct {
+		level  capnslog.LogLevel
+		logged bool
+	}{
+		{level: capnslog.DEBUG, logged: false},
+		{level: capnslog.TRACE, logged: true},
+	} {
+		t.Run(tc.level.String(), func(t *testing.T) {
+			logBuf := captureLogsAtLevel(t, tc.level)
+
+			_, _, err := decodeUser(badJSON)
+
+			require.Error(t, err)
+			assert.NotContains(t, err.Error(), secretKey)
+			if tc.logged {
+				assert.Contains(t, logBuf.String(), secretKey)
+			} else {
+				assert.NotContains(t, logBuf.String(), secretKey)
+			}
+		})
+	}
+}
```

---

### Incident Patch 14: `98c1fad2` (2026-09-22)
**Commit Message**: Merge pull request #18208 from jhoblitt/build/crds-mktemp-tmpdir

build: fix TMPDIR handling and mode of generated helm resources.yaml

**File**: `build/crds/build-crds.sh` (modified, +4/-1)
```diff
@@ -70,7 +70,7 @@ EOF
 }
 
 build_helm_resources() {
-  TMP_FILE=$(mktemp -q /tmp/resources.XXXXXX || exit 1)
+  TMP_FILE=$(mktemp "${TMPDIR:-/tmp}/resources.XXXXXX" || exit 1)
   echo "Generating helm resources.yaml to temp file: $TMP_FILE"
   {
     # add header
@@ -85,6 +85,9 @@ build_helm_resources() {
     echo "{{- end }}"
   } >>"$TMP_FILE"
   echo "updating helm crds file $CEPH_HELM_CRDS_FILE_PATH from temp file"
+  # mktemp creates the file 0600 and mv carries that mode over to the
+  # destination, so the mode has to be set before the move.
+  chmod 0644 "$TMP_FILE"
   mv "$TMP_FILE" "$CEPH_HELM_CRDS_FILE_PATH"
 }
 
```

---

### Incident Patch 15: `ff6e5c69` (2026-09-21)
**Commit Message**: Merge pull request #18440 from travisn/fix-mergify-partition-device-v19

ci: fix mergify automerge for release-1.21 backports

**File**: `.mergify.yml` (modified, +1/-1)
```diff
@@ -304,7 +304,7 @@ pull_request_rules:
       - "check-success=canary-tests / multi-cluster-mirroring (quay.io/ceph/ceph:v20, v1.37.0)"
       - "check-success=canary-tests / multus-public-and-cluster (quay.io/ceph/ceph:v20, v1.37.0)"
       - "check-success=canary-tests / osd-with-metadata-device (quay.io/ceph/ceph:v20, v1.37.0)"
-      - "check-success=canary-tests / osd-with-metadata-partition-device (quay.io/ceph/ceph:v20, v1.37.0)"
+      - "check-success=canary-tests / osd-with-metadata-partition-device (quay.io/ceph/ceph:v19, v1.37.0)"
       - "check-success=canary-tests / pvc (quay.io/ceph/ceph:v20, v1.37.0)"
       - "check-success=canary-tests / pvc-db (quay.io/ceph/ceph:v20, v1.37.0)"
       - "check-success=canary-tests / pvc-db-wal (quay.io/ceph/ceph:v20, v1.37.0)"
```

#### Recent Merged Pull Requests:
- **PR #18508** (2026-10-05): osd: filter rbd devices from LVM scans in raw-mode activation (release-1.20) (@jhoblitt)
- **PR #18507** (2026-10-05): osd: respect per-device encryptedDevice config (backport #18472) (@mergify[bot])
- **PR #18505** (2026-10-05): monitoring: correct NVMe-oF gateway CPU alert percentage (backport #18476) (@mergify[bot])
- **PR #18504** (2026-10-05): monitoring: correct NVMe-oF gateway CPU alert percentage (backport #18476) (@mergify[bot])
- **PR #18503** (2026-10-05): csi: add a setting to skip creating the csi operator resources (backport #18373) (@mergify[bot])
- **PR #18502** (2026-10-05): csi: add a setting to skip creating the csi operator resources (backport #18373) (@mergify[bot])
- **PR #18501** (2026-10-05): csi: update csi-driver and ceph-csi-operator (backport #18498) (@mergify[bot])
- **PR #18500** (closed): build(deps): bump the github-dependencies group with 2 updates (@dependabot[bot])

---

## 3. Empirical Evidence & Compliance Certification
- **Evidence Provenance**: Fetched directly from verified official GitHub REST API.
- **Zero Disk Footprint**: 0 bytes of unnecessary repository bloat stored locally.
- **TOS & Free-Tier Adherence**: Request pace complied with public API guidelines without fee, penalty, or unauthorized scraping.

---

## 4. Promotion & Integration Status
- **Status**: HARVESTED_DEEP_FORENSIC
- **Master Brain Sync**: Auto-committed to local/remote Master Brain repository.
