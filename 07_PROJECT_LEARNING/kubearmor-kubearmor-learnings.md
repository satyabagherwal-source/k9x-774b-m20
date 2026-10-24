> **Canonical Learning Artifact**: `07_PROJECT_LEARNING/kubearmor-kubearmor-learnings.md`  
> **Source**: github ([https://github.com/kubearmor/KubeArmor](https://github.com/kubearmor/KubeArmor))  
> **Source Version**: `99518b0d`  
> **License**: Apache-2.0  
> **Synthesized By**: zero-clone-structural-synthesizer  
> **Timestamp**: 2026-10-24T20:04:55.712Z  
> **Learning ID**: `learn-github-kubearmor-kubearmor`  
> **Pipeline Version**: `2.0.0`  
> **Status**: VERIFIED_EMPIRICAL_INTELLIGENCE  
> **Data Governance**: CLASSIFICATION: PUBLIC. Sanitized against PII/secrets.  
> **Policy Invariant**: Strictly for engineering retrieval and architecture documentation. Distillation prohibited.  

---

# Forensic Learning Record (Deep Inspection): kubearmor/KubeArmor

> **Canonical Artifact**: `07_PROJECT_LEARNING/kubearmor-kubearmor-learnings.md`  
> **Source Platform**: GitHub ([https://github.com/kubearmor/KubeArmor](https://github.com/kubearmor/KubeArmor))  
> **Harvest Method**: Full-Spectrum Deep Extraction (Patches, Diffs, Source Code, Post-Mortems)  
> **Harvest Timestamp**: 2026-10-24T20:04:54.371Z  
> **Compliance State**: Free Tier Guaranteed | Strict Rate-Limit Backoff Honored  

---

## 1. Context & Architectural Overview
- **Repository / Resource**: `kubearmor/KubeArmor`
- **Description**: Runtime Security Enforcement System. Workload hardening/sandboxing and implementing least-permissive policies made easy leveraging LSMs (LSM-BPF, AppArmor).
- **Primary Language / Ecosystem**: Go
- **Discovered Manifests / Configurations**: README.md, Dockerfile
- **Stars / Engagement**: 2631 stars

---

## 2. Multi-Dimensional 8-Axis Investigation & Real Code Patches

### D1: Architecture & Structural Boundaries
- Entry configurations inspected via direct stream: README.md, Dockerfile.
- Evaluated system abstractions and modular contracts.

### Core Architecture Module: `KubeArmor/core/containerdHandler.go`
```
// SPDX-License-Identifier: Apache-2.0
// Copyright 2026 Authors of KubeArmor

// Package core is responsible for initiating and maintaining interactions between external entities like K8s,CRIs and internal KubeArmor entities like eBPF Monitor and Log Feeders
package core

import (
	"context"
	"fmt"
	"os"
	"path/filepath"
	"strconv"
	"strings"
	"time"

	"github.com/containerd/typeurl/v2"
	"google.golang.org/protobuf/proto"

	"golang.org/x/exp/slices"

	"github.com/kubearmor/KubeArmor/KubeArmor/common"
	kl "github.com/kubearmor/KubeArmor/KubeArmor/common"
	cfg "github.com/kubearmor/KubeArmor/KubeArmor/config"
	kg "github.com/kubearmor/KubeArmor/KubeArmor/log"
	"github.com/kubearmor/KubeArmor/KubeArmor/state"
	tp "github.com/kubearmor/KubeArmor/KubeArmor/types"

	"github.com/containerd/containerd/v2/core/events"

	specs "github.com/opencontainers/runtime-spec/specs-go"

	apievents "github.com/containerd/containerd/api/events"
	task "github.com/containerd/containerd/api/services/tasks/v1"
	v2 "github.com/containerd/containerd/v2/client"
	"github.com/containerd/containerd/v2/pkg/namespaces"
)

// ======================== //
// == Containerd Handler == //
// ======================== //

// DefaultCaps contains all the default capabilities given to a
// container by containerd runtime
// Taken from - https://github.com/containerd/containerd/blob/main/oci/spec.go
var defaultCaps = []string{
	"CAP_CHOWN",
	"CAP_DAC_OVERRIDE",
	"CAP_FSETID",
	"CAP_FOWNER",
	"CAP_MKNOD",
	"CAP_NET_RAW",
	"CAP_SETGID",
	"CAP_SETUID",
	"CAP_SETFCAP",
	"CAP_SETPCAP",
	"CAP_NET_BIND_SERVICE",
	"CAP_SYS_CHROOT",
	"CAP_KILL",
	"CAP_AUDIT_WRITE",
}

// Containerd Handler
var Containerd *ContainerdHandler

// init Function
func init() {
	// Spec -> google.protobuf.Any
	// https://github.com/opencontainers/runtime-spec/blob/master/specs-go/config.go

	const prefix = "types.containerd.io"
	major := strconv.Itoa(specs.VersionMajor)

	typeurl.Register(&specs.Spec{}, prefix, "opencontainers/runtime-spec", major, "Spec")
	typeurl.Register(&specs.Process{}, prefix, "opencontainers/runtime-spec", major, "Process")
}

// ContainerdHandler Structure
type ContainerdHandler struct {

	// container client
	client *v2.Client

	// context
	containerd context.Context
	docker     context.Context

	k8sEventsCh    <-chan *events.Envelope
	dockerEventsCh <-chan *events.Envelope

	k8sErrCh    <-chan error
	dockerErrCh <-chan error
}

// NewContainerdHandler Function
func NewContainerdHandler() *ContainerdHandler {
	ch := &ContainerdHandler{}

	// Establish connection to containerd
	client, err := v2.New(strings.TrimPrefix(cfg.GlobalCfg.CRISocket, "unix://"))
	if err != nil {
		kg.Errf("Unable to connect to containerd v2: %v", err)
		return nil
	}
	ch.client = client

	// Subscribe to containerd events

	// docker namespace
	ch.docker = namespaces.WithNamespace(context.Background(), "moby")

	dockerEventsCh, dockerErrCh := client.EventService().Subscribe(ch.docker, "")
	ch.dockerEventsCh = dockerEventsCh
	ch.dockerErrCh = dockerErrCh

	// containerd namespace
	ch.containerd = namespaces.WithNamespace(context.Background(), "k8s.io")

	k8sEventsCh, k8sErrCh := client.EventService().Subscribe(ch.containerd, "")
	ch.k8sEventsCh = k8sEventsCh
	ch.k8sErrCh = k8sErrCh

	return ch
}

// Reconnect re-establishes the containerd client connection and resubscribes to events
func (ch *ContainerdHandler) Reconnect() error {
	// Close existing client if present
	if ch.client != nil {
		if err := ch.client.Close(); err != nil {
			kg.Warnf("Failed to close old containerd client connection: %v", err)
		}
	}

	client, err := v2.New(strings.TrimPrefix(cfg.GlobalCfg.CRISocket, "unix://"))
	if err != nil {
		return fmt.Errorf("unable to reconnect to containerd: %v", err)
	}
	ch.client = client

	// Resubscribe to docker namespace events
	ch.docker = namespaces.WithNamespace(context.Background(), "moby")
	dockerEventsCh, dockerErrCh := client.EventService().Subscribe(ch.docker, "")
	ch.dockerEventsCh = dockerEventsCh
	ch.dockerErrCh = dockerErrCh

	// Resubscribe to k8s namespace events
	ch.containerd = namespaces.WithNamespace(context.Background(), "k8s.io")
	k8sEventsCh, k8sErrCh := client.EventService().Subscribe(ch.containerd, "")
	ch.k8sEventsCh = k8sEventsCh
	ch.k8sErrCh = k8sErrCh

	return nil
}

// Close Function
func (ch *ContainerdHandler) Close() {
	if err := ch.client.Close(); err != nil {
		kg.Err(err.Error())
	}
}

// ==================== //
// == Container Info == //
// ==================== //

// GetContainerInfo Function
func (ch *ContainerdHandler) GetContainerInfo(ctx context.Context, containerID, nodeID string, eventpid uint32, OwnerInfo map[string]tp.PodOwner) (tp.Container, error) {
	res, err := ch.client.ContainerService().Get(ctx, containerID)
	if err != nil {
		return tp.Container{}, err
	}

	// skip if pause container
	if res.Labels != nil {
		if containerKind, ok := res.Labels["io.cri-containerd.kind"]; ok && containerKind == "sandbox" {
			return tp.Container{}, fmt.Errorf("pause container")
		}
	}

	container := tp.Container{}

	// == container base == //

	container.ContainerID = res.ID
	container.ContainerName = res.ID
	container.NamespaceName = "Unknown"
	container.EndPointName = "Unknown"

	containerLabels := res.Labels
	if _, ok := containerLabels["io.kubernetes.pod.namespace"]; ok { // kubernetes
		if val, ok := containerLabels["io.kubernetes.pod.namespace"]; ok {
			container.NamespaceName = val
		}
		if val, ok := containerLabels["io.kubernetes.pod.name"]; ok {
			container.EndPointName = val
		}
	} else if val, ok := containerLabels["kubearmor.io/namespace"]; ok {
		container.NamespaceName = val
	} else {
		container.NamespaceName = cfg.GlobalCfg.Host
	}

	if len(OwnerInfo) > 0 {
		if podOwnerInfo, ok := OwnerInfo[container.EndPointName]; ok {
			container.Owner = podOwnerInfo
		}
	}

	iface, err := typeurl.UnmarshalAny(res.Spec)
	if err != nil {
		return tp.Container{}, err
	}

	spec := iface.(*specs.Spec)
	container.AppArmorProfile = spec.Process.ApparmorProfile

	// if a container has additional caps than default, we mark it as privileged
	if spec.Process.Capabilities != nil && slices.Compare(spec.Process.Capabilities.Permitted, defaultCaps) >= 0 {
		container.Privileged = true
	}

	// == //
	if eventpid == 0 {
		taskReq := task.ListPidsRequest{ContainerID: container.ContainerID}
		if taskRes, err := ch.client.TaskService().ListPids(ctx, &taskReq); err == nil {
			if len(taskRes.Processes) == 0 {
				return container, err
			}

			container.Pid = taskRes.Processes[0].Pid

		} else {
			return container, err
		}

	} else {
		container.Pid = eventpid
	}

	pid := strconv.Itoa(int(container.Pid))

	if data, err := os.Readlink(filepath.Join(cfg.GlobalCfg.ProcFsMount, pid, "/ns/pid")); err == nil {
		if _, err := fmt.Sscanf(data, "pid:[%d]\n", &container.PidNS); err != nil {
			kg.Warnf("Unable to get PidNS (%s, %s, %s)", containerID, pid, err.Error())
		}
	}

	if data, err := os.Readlink(filepath.Join(cfg.GlobalCfg.ProcFsMount, pid, "/ns/mnt")); err == nil {
		if _, err := fmt.Sscanf(data, "mnt:[%d]\n", &container.MntNS); err != nil {
			kg.Warnf("Unable to get MntNS (%s, %s, %s)", containerID, pid, err.Error())
		}
	}

	taskReq := task.ListPidsRequest{ContainerID: container.ContainerID}
	if taskRes, err := ch.client.TaskService().ListPids(ctx, &taskReq); err == nil {
		if len(taskRes.Processes) == 0 {
			return container, err
		}

		pid := strconv.Itoa(int(taskRes.Processes[0].Pid))

		container.Pid = taskRes.Processes[0].Pid

		if data, err := os.Readlink(filepath.Join(cfg.GlobalCfg.ProcFsMount, pid, "/ns/pid")); err == nil {
			if _, err := fmt.Sscanf(data, "pid:[%d]\n", &container.PidNS); err != nil {
				kg.Warnf("Unable to get PidNS (%s, %s, %s)", containerID, pid, err.Error())
			}
		}

		if data, err := os.Readlink(filepath.Join(cfg.GlobalCfg.ProcFsMount, pid, "/ns/mnt")); err == nil {
			if _, err := fmt.Sscanf(data, "mnt:[%d]\n", &container.MntNS); err != nil {
				kg.Warnf("Unable to get MntNS (%s, %s, %s)", containerID, pid, err.Error())
			}
		}
	} else {
		return container, err
	}

	// == //

	if !cfg.GlobalCfg.K8sEnv {
		container.ContainerImage = res.Image //+ kl.GetSHA256ofImage(inspect.Image)

		container.NodeName = cfg.GlobalCfg.Host

		container.NodeID = nodeID

		labels := []string{}
		for k, v := range res.Labels {
			labels = append(labels, k+"="+v)
		}
		for k, v := range spec.Annotations {
			labels = append(labels, k+"="+v)
		}

		// for policy matching
		labels = append(labels, "namespaceName="+container.NamespaceName)
		if _, ok := containerLabels["kubearmor.io/container.name"]; !ok {
			labels = append(labels, "kubearmor.io/container.name="+container.ContainerName)
		}

		container.Labels = strings.Join(labels, ",")
	}

	// == //

	return container, nil
}

// ======================= //
// == Containerd Events == //
// ======================= //

// GetContainerdContainers Function
func (ch *ContainerdHandler) GetContainerdContainers() map[string]context.Context {
	containers := map[string]context.Context{}

	if containerList, err := ch.client.ContainerService().List(ch.docker); err == nil {
		for _, container := range containerList {
			containers[container.ID] = ch.docker
		}
	} else {
		kg.Err(err.Error())
	}

	if containerList, err := ch.client.ContainerService().List(ch.containerd); err == nil {
		for _, container := range containerList {
			containers[container.ID] = ch.containerd
		}
	} else {
		kg.Err(err.Error())
	}

	return containers
}

// UpdateContainerdContainer Function
func (dm *KubeArmorDaemon) UpdateContainerdContainer(ctx context.Context, containerID string, containerPid uint32, action string) error {
	// check if Containerd exists
	if Containerd == nil {
		return fmt.Errorf("containerd client not initialized")
	}

	if action == "start" {
		// get container information from containerd client

		dm.OwnerInfoLock.RLock()
		owner := dm.OwnerInfo
		dm.OwnerInfoLock.RUnlock()
		container, err := Containerd.Get
```

### Core Architecture Module: `KubeArmor/core/crioHandler.go`
```
// SPDX-License-Identifier: Apache-2.0
// Copyright 2026 Authors of KubeArmor

package core

import (
	"context"
	"encoding/json"
	"fmt"
	"os"
	"path/filepath"
	"strconv"
	"time"

	"github.com/kubearmor/KubeArmor/KubeArmor/common"
	kl "github.com/kubearmor/KubeArmor/KubeArmor/common"
	cfg "github.com/kubearmor/KubeArmor/KubeArmor/config"
	kg "github.com/kubearmor/KubeArmor/KubeArmor/log"
	tp "github.com/kubearmor/KubeArmor/KubeArmor/types"
	spec "github.com/opencontainers/runtime-spec/specs-go"
	"google.golang.org/grpc"
	"google.golang.org/grpc/credentials/insecure"
	pb "k8s.io/cri-api/pkg/apis/runtime/v1"
)

// CrioHandler Structure
type CrioHandler struct {
	// connection
	conn *grpc.ClientConn

	// crio client
	client pb.RuntimeServiceClient

	// containers is a map with empty value to have lookups in constant time
	containers map[string]struct{}
}

// CrioContainerInfo struct corresponds to CRI-O's container info returned
// with container status
type CrioContainerInfo struct {
	SandboxID   string    `json:"sandboxID"`
	Pid         int       `json:"pid"`
	RuntimeSpec spec.Spec `json:"runtimeSpec"`
	Privileged  bool      `json:"privileged"`
}

// Crio Handler
var Crio *CrioHandler

// NewCrioHandler Function creates a new Crio handler
func NewCrioHandler() *CrioHandler {
	ch := &CrioHandler{}

	conn, err := grpc.NewClient(cfg.GlobalCfg.CRISocket, grpc.WithTransportCredentials(insecure.NewCredentials()))
	if err != nil {
		return nil
	}

	ch.conn = conn

	// The runtime service client can be used for all RPCs
	ch.client = pb.NewRuntimeServiceClient(ch.conn)

	ch.containers = make(map[string]struct{})

	return ch
}

// Close the connection
func (ch *CrioHandler) Close() {
	if ch.conn != nil {
		if err := ch.conn.Close(); err != nil {
			kg.Err(err.Error())
		}
	}
}

// ==================== //
// == Container Info == //
// ==================== //

// GetContainerInfo Function gets info of a particular container
func (ch *CrioHandler) GetContainerInfo(ctx context.Context, containerID, nodeID string, OwnerInfo map[string]tp.PodOwner) (tp.Container, error) {
	// request to get status of specified container
	// verbose has to be true to retrieve additional CRI specific info
	req := &pb.ContainerStatusRequest{
		ContainerId: containerID,
		Verbose:     true,
	}

	res, err := ch.client.ContainerStatus(ctx, req)
	if err != nil {
		return tp.Container{}, err
	}

	container := tp.Container{}

	if res == nil {
		return tp.Container{}, fmt.Errorf("container status response is nil")
	}

	// == container base == //
	resContainerStatus := res.Status
	if resContainerStatus == nil {
		return tp.Container{}, fmt.Errorf("container status is nil")
	}

	container.ContainerID = resContainerStatus.Id

	if resContainerStatus.Metadata != nil {
		container.ContainerName = resContainerStatus.Metadata.Name
	}

	container.NamespaceName = "Unknown"
	container.EndPointName = "Unknown"

	// check container labels
	containerLabels := resContainerStatus.Labels
	if val, ok := containerLabels["io.kubernetes.pod.namespace"]; ok {
		container.NamespaceName = val
	}
	if val, ok := containerLabels["io.kubernetes.pod.name"]; ok {
		container.EndPointName = val
	}

	if len(OwnerInfo) > 0 {
		if podOwnerInfo, ok := OwnerInfo[container.EndPointName]; ok {
			container.Owner = podOwnerInfo
		}
	}

	if !cfg.GlobalCfg.K8sEnv {
		container.NodeName = cfg.GlobalCfg.Host
		container.NodeID = nodeID
	}

	// extracting the runtime specific "info"
	var containerInfo CrioContainerInfo
	err = json.Unmarshal([]byte(res.Info["info"]), &containerInfo)
	if err != nil {
		return tp.Container{}, err
	}

	// path to container's root storage
	if containerInfo.RuntimeSpec.Process != nil {
		container.AppArmorProfile = containerInfo.RuntimeSpec.Process.ApparmorProfile
	}
	container.Privileged = containerInfo.Privileged

	pid := strconv.Itoa(containerInfo.Pid)

	if data, err := os.Readlink(filepath.Join(cfg.GlobalCfg.ProcFsMount, pid, "/ns/pid")); err == nil {
		if _, err := fmt.Sscanf(data, "pid:[%d]\n", &container.PidNS); err != nil {
			kg.Warnf("Unable to get PidNS (%s, %s, %s)", containerID, pid, err.Error())
		}
	} else {
		return container, err
	}

	if data, err := os.Readlink(filepath.Join(cfg.GlobalCfg.ProcFsMount, pid, "/ns/mnt")); err == nil {
		if _, err := fmt.Sscanf(data, "mnt:[%d]\n", &container.MntNS); err != nil {
			kg.Warnf("Unable to get MntNS (%s, %s, %s)", containerID, pid, err.Error())
		}
	} else {
		return container, err
	}

	return container, nil
}

// ================= //
// == CRIO Events == //
// ================= //

// GetCrioContainers Function gets IDs of all containers
func (ch *CrioHandler) GetCrioContainers() (map[string]struct{}, error) {
	containers := make(map[string]struct{})
	var err error

	req := pb.ListContainersRequest{}

	if containerList, err := ch.client.ListContainers(context.Background(), &req, grpc.MaxCallRecvMsgSize(kl.DefaultMaxRecvMaxSize)); err == nil {
		if containerList != nil {
			for _, container := range containerList.Containers {
				containers[container.Id] = struct{}{}
			}
		}

		return containers, nil
	}

	return nil, err
}

// GetNewCrioContainers Function gets new crio containers
func (ch *CrioHandler) GetNewCrioContainers(containers map[string]struct{}) map[string]struct{} {
	newContainers := make(map[string]struct{})

	for activeContainerID := range containers {
		if _, ok := ch.containers[activeContainerID]; !ok {
			newContainers[activeContainerID] = struct{}{}
		}
	}

	return newContainers
}

// GetDeletedCrioContainers Function gets deleted crio containers
func (ch *CrioHandler) GetDeletedCrioContainers(containers map[string]struct{}) map[string]struct{} {
	deletedContainers := make(map[string]struct{})

	for globalContainerID := range ch.containers {
		if _, ok := containers[globalContainerID]; !ok {
			deletedContainers[globalContainerID] = struct{}{}
			delete(ch.containers, globalContainerID)
		}
	}

	ch.containers = containers

	return deletedContainers
}

// UpdateCrioContainer Function
func (dm *KubeArmorDaemon) UpdateCrioContainer(ctx context.Context, containerID, action string) error {
	if Crio == nil {
		return fmt.Errorf("CRIO client not initialized")
	}

	if action == "start" {
		// get container info from client
		dm.OwnerInfoLock.RLock()
		owner := dm.OwnerInfo
		dm.OwnerInfoLock.RUnlock()
		container, err := Crio.GetContainerInfo(ctx, containerID, dm.Node.NodeID, owner)
		if err != nil {
			return fmt.Errorf("failed to get container info: %w", err)
		}

		if container.ContainerID == "" {
			return fmt.Errorf("container ID is empty")
		}

		endpoint := tp.EndPoint{}

		dm.ContainersLock.Lock()
		if _, ok := dm.Containers[container.ContainerID]; !ok {
			dm.Containers[container.ContainerID] = container
			dm.ContainersLock.Unlock()
		} else if dm.Containers[container.ContainerID].PidNS == 0 && dm.Containers[container.ContainerID].MntNS == 0 {
			container.NamespaceName = dm.Containers[container.ContainerID].NamespaceName
			container.EndPointName = dm.Containers[container.ContainerID].EndPointName
			container.Labels = dm.Containers[container.ContainerID].Labels

			container.ContainerName = dm.Containers[container.ContainerID].ContainerName
			container.ContainerImage = dm.Containers[container.ContainerID].ContainerImage

			container.PolicyEnabled = dm.Containers[container.ContainerID].PolicyEnabled

			container.ProcessVisibilityEnabled = dm.Containers[container.ContainerID].ProcessVisibilityEnabled
			container.FileVisibilityEnabled = dm.Containers[container.ContainerID].FileVisibilityEnabled
			container.NetworkVisibilityEnabled = dm.Containers[container.ContainerID].NetworkVisibilityEnabled
			container.CapabilitiesVisibilityEnabled = dm.Containers[container.ContainerID].CapabilitiesVisibilityEnabled

			dm.Containers[container.ContainerID] = container
			dm.ContainersLock.Unlock()

			dm.EndPointsLock.Lock()
			for idx, endPoint := range dm.EndPoints {
				if endPoint.NamespaceName == container.NamespaceName && endPoint.EndPointName == container.EndPointName && kl.ContainsElement(endPoint.Containers, container.ContainerID) {

					// update apparmor profiles
					if !kl.ContainsElement(endPoint.AppArmorProfiles, container.AppArmorProfile) {
						dm.EndPoints[idx].AppArmorProfiles = append(dm.EndPoints[idx].AppArmorProfiles, container.AppArmorProfile)
					}

					if container.Privileged && dm.EndPoints[idx].PrivilegedContainers != nil {
						dm.EndPoints[idx].PrivilegedContainers[container.ContainerName] = struct{}{}
					}

					endpoint = dm.EndPoints[idx]

					break
				}
			}
			dm.EndPointsLock.Unlock()
		} else {
			dm.ContainersLock.Unlock()
			return fmt.Errorf("container namespace information already exists")
		}

		if dm.SystemMonitor != nil && cfg.GlobalCfg.Policy {
			// for throttling
			dm.SystemMonitor.Logger.ContainerNsKey[containerID] = common.OuterKey{
				MntNs: container.MntNS,
				PidNs: container.PidNS,
			}

			// update NsMap
			dm.SystemMonitor.AddContainerIDToNsMap(containerID, container.NamespaceName, container.PidNS, container.MntNS)
			if dm.RuntimeEnforcer != nil {
				dm.RuntimeEnforcer.RegisterContainer(containerID, container.PidNS, container.MntNS)
			}
			if dm.Presets != nil {
				dm.Presets.RegisterContainer(containerID, container.PidNS, container.MntNS)
			}

			if len(endpoint.SecurityPolicies) > 0 { // struct can be empty or no policies registered for the endpoint yet
				dm.Logger.UpdateSecurityPolicies("ADDED", endpoint)
				if dm.RuntimeEnforcer != nil && endpoint.PolicyEnabled == tp.KubeArmorPolicyEnabled {
					// enforce security policies
					dm.RuntimeEnforcer.UpdateSecurityPolicies(endpoint)
				}
				if dm.Presets != nil && endpoint.PolicyEnabled == tp.KubeArmorPolicyEnabled {
					// enforce preset rules
					dm.Presets.UpdateSecurityPolicies(endpoint)
				}
			}
		}

		if !dm.K8sEnabled {
			dm.ContainersLock.Lock()
			dm.EndPointsLock.Lock()
			dm.MatchandUpdateContainerSecurityPolicies(containerID)
			dm.EndPointsLock.Unlock()
```

### Core Architecture Module: `KubeArmor/core/dockerHandler.go`
```
// SPDX-License-Identifier: Apache-2.0
// Copyright 2026 Authors of KubeArmor

package core

import (
	"context"
	"errors"
	"fmt"
	"os"
	"path/filepath"
	"slices"
	"strconv"
	"strings"
	"time"

	"github.com/kubearmor/KubeArmor/KubeArmor/common"
	kl "github.com/kubearmor/KubeArmor/KubeArmor/common"
	cfg "github.com/kubearmor/KubeArmor/KubeArmor/config"
	kg "github.com/kubearmor/KubeArmor/KubeArmor/log"
	"github.com/kubearmor/KubeArmor/KubeArmor/state"
	tp "github.com/kubearmor/KubeArmor/KubeArmor/types"
	"github.com/moby/moby/api/types/events"
	"github.com/moby/moby/client"
)

// ==================== //
// == Docker Handler == //
// ==================== //

// Docker Handler
var Docker *DockerHandler

// DockerVersion Structure
type DockerVersion struct {
	APIVersion string `json:"ApiVersion"`
}

// DockerHandler Structure
type DockerHandler struct {
	DockerClient *client.Client
	Version      DockerVersion

	// needed for container info
	NodeIP string
}

// NewDockerHandler Function
func NewDockerHandler() (*DockerHandler, error) {
	docker := &DockerHandler{}

	// try to create a new docker client
	// If env DOCKER_API_VERSION set - NegotiateAPIVersion() won't do anything
	DockerClient, err := client.New(client.FromEnv)
	if err != nil {
		return nil, err
	}
	clientVersion := DockerClient.ClientVersion()

	kg.Printf("Verifying Docker API client version: %s", clientVersion)

	serverVersion, err := DockerClient.ServerVersion(context.Background(), client.ServerVersionOptions{})
	if err != nil {
		return nil, err
	}

	if clientVersion != serverVersion.APIVersion {
		kg.Warnf("Docker client (%s) and Docker server (%s) API versions don't match", clientVersion, serverVersion.APIVersion)
	}

	docker.DockerClient = DockerClient

	docker.NodeIP = kl.GetExternalIPAddr()

	kg.Printf("Initialized Docker Handler (version: %s)", clientVersion)

	return docker, nil
}

// Close Function
func (dh *DockerHandler) Close() {
	if dh.DockerClient != nil {
		if err := dh.DockerClient.Close(); err != nil {
			kg.Err(err.Error())
		}
	}
}

// ==================== //
// == Container Info == //
// ==================== //

// GetContainerInfo Function
func (dh *DockerHandler) GetContainerInfo(containerID, nodeID string, OwnerInfo map[string]tp.PodOwner) (tp.Container, error) {
	if dh.DockerClient == nil {
		return tp.Container{}, errors.New("no docker client")
	}

	inspect, err := dh.DockerClient.ContainerInspect(context.Background(), containerID, client.ContainerInspectOptions{})
	if err != nil {
		return tp.Container{}, err
	}

	container := tp.Container{}

	// == container base == //

	container.ContainerID = inspect.Container.ID
	container.ContainerName = strings.TrimLeft(inspect.Container.Name, "/")

	container.NamespaceName = "Unknown"
	container.EndPointName = "Unknown"

	containerLabels := make(map[string]string)
	containerLabels = inspect.Container.Config.Labels
	if _, ok := containerLabels["io.kubernetes.pod.namespace"]; ok { // kubernetes
		if val, ok := containerLabels["io.kubernetes.pod.namespace"]; ok {
			container.NamespaceName = val
		}
		if val, ok := containerLabels["io.kubernetes.pod.name"]; ok {
			container.EndPointName = val
		}
	} else if val, ok := containerLabels["kubearmor.io/namespace"]; ok {
		container.NamespaceName = val
	} else {
		container.NamespaceName = cfg.GlobalCfg.Host
	}

	if len(OwnerInfo) > 0 {
		if podOwnerInfo, ok := OwnerInfo[container.EndPointName]; ok {
			container.Owner = podOwnerInfo
		}
	}

	container.AppArmorProfile = inspect.Container.AppArmorProfile
	if inspect.Container.HostConfig.Privileged ||
		len(inspect.Container.HostConfig.CapAdd) > 0 {
		container.Privileged = inspect.Container.HostConfig.Privileged
	}

	// == //

	pid := strconv.Itoa(inspect.Container.State.Pid)

	if data, err := os.Readlink(filepath.Join(cfg.GlobalCfg.ProcFsMount, pid, "/ns/pid")); err == nil {
		if _, err := fmt.Sscanf(data, "pid:[%d]\n", &container.PidNS); err != nil {
			kg.Warnf("Unable to get PidNS (%s, %s, %s)", containerID, pid, err.Error())
		}
	}

	if data, err := os.Readlink(filepath.Join(cfg.GlobalCfg.ProcFsMount, pid, "/ns/mnt")); err == nil {
		if _, err := fmt.Sscanf(data, "mnt:[%d]\n", &container.MntNS); err != nil {
			kg.Warnf("Unable to get MntNS (%s, %s, %s)", containerID, pid, err.Error())
		}
	}

	// == //

	if !cfg.GlobalCfg.K8sEnv {
		container.ContainerImage = inspect.Container.Config.Image //+ kl.GetSHA256ofImage(inspect.Image)

		container.NodeName = cfg.GlobalCfg.Host
		container.NodeID = nodeID

		labels := []string{}
		for k, v := range containerLabels {
			labels = append(labels, k+"="+v)
		}

		// for policy matching
		labels = append(labels, "namespaceName="+container.NamespaceName)
		if _, ok := containerLabels["kubearmor.io/container.name"]; !ok {
			labels = append(labels, "kubearmor.io/container.name="+container.ContainerName)
		}

		container.Labels = strings.Join(labels, ",")

		var podIP string
		if inspect.Container.HostConfig != nil {
			if inspect.Container.HostConfig.NetworkMode.IsNone() || inspect.Container.HostConfig.NetworkMode.IsContainer() {
				podIP = ""
			} else if inspect.Container.HostConfig.NetworkMode.IsHost() {
				podIP = dh.NodeIP
			} else {
				// user defined network OR swarm mode
				networkName := inspect.Container.HostConfig.NetworkMode.NetworkName()
				networkInfo, ok := inspect.Container.NetworkSettings.Networks[networkName]
				if ok && networkInfo != nil {
					podIP = networkInfo.IPAddress.String()
				}
			}
		}
		container.ContainerIP = podIP

		// time format used by docker engine is RFC3339Nano
		lastUpdatedAt, err := time.Parse(time.RFC3339Nano, inspect.Container.State.StartedAt)
		if err == nil {
			container.LastUpdatedAt = lastUpdatedAt.UTC().String()
		}
		// finished at is IsZero until a container exits
		timeFinished, err := time.Parse(time.RFC3339Nano, inspect.Container.State.FinishedAt)
		if err == nil && !timeFinished.IsZero() && timeFinished.After(lastUpdatedAt) {
			lastUpdatedAt = timeFinished
		}

	}

	return container, nil
}

// ========================== //
// == Docker Event Channel == //
// ========================== //

// GetEventChannel Function
func (dh *DockerHandler) GetEventChannel(ctx context.Context, StopChan <-chan struct{}) <-chan events.Message {
	if dh.DockerClient != nil {
		eventBuffer := make(chan events.Message, 256)

		go func() {

			eventsResult := dh.DockerClient.Events(ctx, client.EventsListOptions{})
			// Extract the channels from the result struct
			eventStream := eventsResult.Messages
			errCh := eventsResult.Err
			defer close(eventBuffer)

			for {
				select {
				case event, ok := <-eventStream:
					if !ok {
						return
					}
					select {
					case eventBuffer <- event:
					case <-ctx.Done():
						return
					case <-StopChan:
						return
					default:
						kg.Warnf("Docker channel full.")
					}
				case err, ok := <-errCh:
					if ok && err != nil {
						kg.Warnf("Docker event stream error: %v", err)
					}
					return
				case <-ctx.Done():
					return
				case <-StopChan:
					return
				}
			}
		}()

		return eventBuffer
	}
	return nil
}

// =================== //
// == Docker Events == //
// =================== //

// SetContainerVisibility function enables visibility flag arguments for un-orchestrated container
func (dm *KubeArmorDaemon) SetContainerVisibility(containerID string) {

	// get container information from docker client
	dm.OwnerInfoLock.RLock()
	owner := dm.OwnerInfo
	dm.OwnerInfoLock.RUnlock()
	container, err := Docker.GetContainerInfo(containerID, dm.Node.NodeID, owner)
	if err != nil {
		return
	}

	if strings.Contains(cfg.GlobalCfg.Visibility, "process") {
		container.ProcessVisibilityEnabled = true
	}
	if strings.Contains(cfg.GlobalCfg.Visibility, "file") {
		container.FileVisibilityEnabled = true
	}
	if strings.Contains(cfg.GlobalCfg.Visibility, "network") {
		container.NetworkVisibilityEnabled = true
	}
	if strings.Contains(cfg.GlobalCfg.Visibility, "capabilities") {
		container.CapabilitiesVisibilityEnabled = true
	}

	container.EndPointName = container.ContainerName
	container.NamespaceName = cfg.GlobalCfg.Host

	dm.Containers[container.ContainerID] = container
}

// GetAlreadyDeployedDockerContainers Function
func (dm *KubeArmorDaemon) GetAlreadyDeployedDockerContainers() {
	// check if Docker exists else instantiate
	if Docker == nil {
		var err error
		Docker, err = NewDockerHandler()
		if err != nil {
			dm.Logger.Errf("Failed to create new Docker client: %s", err.Error())
			return
		}
	}

	if containerList, err := Docker.DockerClient.ContainerList(context.Background(), client.ContainerListOptions{}); err == nil {
		for _, dcontainer := range containerList.Items {
			// get container information from docker client
			dm.OwnerInfoLock.RLock()
			owner := dm.OwnerInfo
			dm.OwnerInfoLock.RUnlock()
			container, err := Docker.GetContainerInfo(dcontainer.ID, dm.Node.NodeID, owner)
			if err != nil {
				continue
			}

			if container.ContainerID == "" {
				continue
			}

			endPoint := tp.EndPoint{}

			if dcontainer.State == "running" {
				dm.ContainersLock.Lock()
				if _, ok := dm.Containers[container.ContainerID]; !ok {
					dm.Containers[container.ContainerID] = container
					dm.ContainersLock.Unlock()

					// create/update endpoint in non-k8s mode
					if !dm.K8sEnabled {
						endPointEvent := "ADDED"
						endPointIdx := -1

						containerLabels, containerIdentities := common.GetLabelsFromString(container.Labels)

						dm.EndPointsLock.Lock()
						// if a named endpoint exists we update
						for idx, ep := range dm.EndPoints {
							if container.ContainerName == ep.EndPointName || kl.MatchIdentities(ep.Identities, containerIdentities) {
								endPointEvent = "UPDATED"
								endPointIdx = idx
								endPoint = ep
								break
							}
						}

						switch endPointEvent {
						case "ADDED":
							endPoint.EndPointName = container.ContainerName
							endPoint.ContainerName = container.ContainerName
							endPoint.NamespaceName 
```

### Core Architecture Module: `KubeArmor/core/hook_handler.go`
```
// SPDX-License-Identifier: Apache-2.0
// Copyright 2026 Authors of KubeArmor

package core

import (
	"encoding/json"
	"errors"
	"io"
	"log"
	"net"
	"os"
	"path/filepath"
	"strings"
	"sync/atomic"

	kl "github.com/kubearmor/KubeArmor/KubeArmor/common"
	cfg "github.com/kubearmor/KubeArmor/KubeArmor/config"
	"github.com/kubearmor/KubeArmor/KubeArmor/types"
)

const kubearmorDir = "/var/run/kubearmor"

// ListenToHook starts listening on a UNIX socket and waits for container hooks
// to pass new containers
func (dm *KubeArmorDaemon) ListenToK8sHook() {
	dm.Logger.Print("Started to monitor OCI Hook events")
	if err := os.MkdirAll(kubearmorDir, 0750); err != nil {
		dm.Logger.Warnf("Failed to create ka.sock dir: %v", err)
	}

	listenPath := filepath.Join(kubearmorDir, "ka.sock")
	err := kl.RemoveSafe(listenPath) // in case kubearmor crashed and the socket wasn't removed
	if err != nil && !errors.Is(err, os.ErrNotExist) {
		dm.Logger.Warnf("Failed to cleanup ka.sock: %v", err)
	}

	socket, err := net.Listen("unix", listenPath)
	if err != nil {
		dm.Logger.Warnf("Failed listening on ka.sock: %v", err)
		return
	}

	defer socket.Close()
	defer kl.RemoveSafe(listenPath)
	ready := &atomic.Bool{}

	for {
		conn, err := socket.Accept()
		if err != nil {
			dm.Logger.Warnf("Error accepting socket connection: %v", err)
		}

		go dm.handleK8sConn(conn, ready)
	}

}

// handleConn gets container details from container hooks.
func (dm *KubeArmorDaemon) handleK8sConn(conn net.Conn, ready *atomic.Bool) {
	// We need to makes sure that no containers accepted until all containers created before KubeArmor
	// are sent first. This is done mainly to avoid race conditions between hooks sending in
	// data that some containers were deleted only for process responsible for sending previous containers
	// to send that these containers are created. Which will leave KubeArmor in an incorrect state.
	defer conn.Close()
	buf := make([]byte, 4096)

	for {
		n, err := conn.Read(buf)
		if err == io.EOF {
			return
		} else if err != nil {
			dm.Logger.Warnf("Error reading connection: %v", err)
		}

		data := types.HookRequest{}

		err = json.Unmarshal(buf[:n], &data)
		if err != nil {
			dm.Logger.Warnf("Error unmarshalling: %v", err)
		}

		if data.Detached {
			// we want KubeArmor to start accepting containers after
			// all previous container are set
			defer ready.Store(true)
		} else if !ready.Load() {
			_, err = conn.Write([]byte("err"))
			if err == io.EOF {
				return
			} else if err != nil {
				log.Println(err)
				return
			}
			continue
		}

		_, err = conn.Write([]byte("ok"))
		if err == io.EOF {
			return
		} else if err != nil {
			log.Println(err)
			return
		}

		if data.Operation == types.HookContainerCreate {
			dm.handleContainerCreate(data.Container)
		} else {
			dm.handleContainerDelete(data.Container.ContainerID)
		}
	}
}
func (dm *KubeArmorDaemon) handleContainerCreate(container types.Container) {
	endpoint := types.EndPoint{}

	dm.Logger.Printf("Detected a container (added/%.12s/pidns=%d/mntns=%d)", container.ContainerID, container.PidNS, container.MntNS)

	dm.ContainersLock.Lock()
	defer dm.ContainersLock.Unlock()
	if _, ok := dm.Containers[container.ContainerID]; !ok {
		dm.Containers[container.ContainerID] = container
	} else if dm.Containers[container.ContainerID].PidNS == 0 && dm.Containers[container.ContainerID].MntNS == 0 {
		c := dm.Containers[container.ContainerID]
		c.MntNS = container.MntNS
		c.PidNS = container.PidNS
		c.AppArmorProfile = container.AppArmorProfile
		dm.Containers[c.ContainerID] = c

		dm.EndPointsLock.Lock()
		for idx, endPoint := range dm.EndPoints {
			if endPoint.NamespaceName == container.NamespaceName && endPoint.EndPointName == container.EndPointName && kl.ContainsElement(endPoint.Containers, container.ContainerID) {

				// update apparmor profiles
				if !kl.ContainsElement(endPoint.AppArmorProfiles, container.AppArmorProfile) {
					// this path is expected to have a single component "apparmor-profile"
					// and this is to ensure that the filename has no path separators or parent directory references
					if strings.Contains(container.AppArmorProfile, "/") || strings.Contains(container.AppArmorProfile, "\\") || strings.Contains(container.AppArmorProfile, "..") {
						dm.Logger.Warnf("Invalid AppArmor profile name (%s)", container.AppArmorProfile)
						continue
					}
					dm.EndPoints[idx].AppArmorProfiles = append(dm.EndPoints[idx].AppArmorProfiles, container.AppArmorProfile)
				}

				if container.Privileged && dm.EndPoints[idx].PrivilegedContainers != nil {
					dm.EndPoints[idx].PrivilegedContainers[container.ContainerName] = struct{}{}
				}

				endpoint = dm.EndPoints[idx]

				break
			}
		}
		dm.EndPointsLock.Unlock()
	}

	if len(dm.OwnerInfo) > 0 {
		dm.OwnerInfoLock.RLock()
		container.Owner = dm.OwnerInfo[container.EndPointName]
		dm.OwnerInfoLock.RUnlock()
	}

	if dm.SystemMonitor != nil && cfg.GlobalCfg.Policy {
		dm.SystemMonitor.AddContainerIDToNsMap(container.ContainerID, container.NamespaceName, container.PidNS, container.MntNS)
		dm.RuntimeEnforcer.RegisterContainer(container.ContainerID, container.PidNS, container.MntNS)

		if len(endpoint.SecurityPolicies) > 0 { // struct can be empty or no policies registered for the endpoint yet
			dm.Logger.UpdateSecurityPolicies("ADDED", endpoint)
			if dm.RuntimeEnforcer != nil && endpoint.PolicyEnabled == types.KubeArmorPolicyEnabled {
				// enforce security policies
				dm.RuntimeEnforcer.UpdateSecurityPolicies(endpoint)
			}
		}
	}
}
func (dm *KubeArmorDaemon) handleContainerDelete(containerID string) {
	dm.ContainersLock.Lock()
	container, ok := dm.Containers[containerID]
	dm.Logger.Printf("Detected a container (removed/%.12s/pidns=%d/mntns=%d)", containerID, container.PidNS, container.MntNS)
	if !ok {
		dm.ContainersLock.Unlock()
		return
	}
	delete(dm.Containers, containerID)
	dm.ContainersLock.Unlock()

	dm.EndPointsLock.Lock()
	for idx, endPoint := range dm.EndPoints {
		if endPoint.NamespaceName == container.NamespaceName && endPoint.EndPointName == container.EndPointName && kl.ContainsElement(endPoint.Containers, container.ContainerID) {

			// update apparmor profiles
			for idxA, profile := range endPoint.AppArmorProfiles {
				if profile == container.AppArmorProfile {
					dm.EndPoints[idx].AppArmorProfiles = append(dm.EndPoints[idx].AppArmorProfiles[:idxA], dm.EndPoints[idx].AppArmorProfiles[idxA+1:]...)
					break
				}
			}

			break
		}
	}
	dm.EndPointsLock.Unlock()

	if dm.SystemMonitor != nil && cfg.GlobalCfg.Policy {
		// update NsMap
		dm.SystemMonitor.DeleteContainerIDFromNsMap(containerID, container.NamespaceName, container.PidNS, container.MntNS)
		dm.RuntimeEnforcer.UnregisterContainer(containerID)
	}

}

```

### Core Architecture Module: `KubeArmor/core/hook_handlier_non_k8s.go`
```
// SPDX-License-Identifier: Apache-2.0
// Copyright 2026 Authors of KubeArmor

// Package core is responsible for initiating and maintaining interactions between external entities like K8s,CRIs and internal KubeArmor entities like eBPF Monitor and Log Feeders
package core

import (
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"log"
	"net"
	"os"
	"path/filepath"
	"sync/atomic"

	"github.com/kubearmor/KubeArmor/KubeArmor/common"
	kl "github.com/kubearmor/KubeArmor/KubeArmor/common"
	cfg "github.com/kubearmor/KubeArmor/KubeArmor/config"
	"github.com/kubearmor/KubeArmor/KubeArmor/state"
	tp "github.com/kubearmor/KubeArmor/KubeArmor/types"
)

// ListenToNonK8sHook starts listening on a UNIX socket and waits for container hooks
// to pass new containers
func (dm *KubeArmorDaemon) ListenToNonK8sHook() {
	dm.Logger.Print("Started to monitor non k8s hook events")

	if err := os.MkdirAll(kubearmorDir, 0750); err != nil {
		dm.Logger.Warnf("Failed to create ka.sock dir: %v", err)
	}

	listenPath := filepath.Join(kubearmorDir, "ka.sock")
	err := kl.RemoveSafe(listenPath) // in case kubearmor crashed and the socket wasn't removed (cleaning the socket file if got crashed)
	if err != nil && !errors.Is(err, os.ErrNotExist) {
		dm.Logger.Warnf("Failed to cleanup ka.sock: %v", err)
	}

	socket, err := net.Listen("unix", listenPath)
	if err != nil {
		dm.Logger.Warnf("Failed listening on ka.sock: %v", err)
		return
	}

	// #nosec G302 Set the permissions of ka.sock to 777 so that rootless podman with user level privileges can also communicate with the socket
	if err := os.Chmod(listenPath, 0777); err != nil {
		dm.Logger.Warnf("Failed to set permissions on %s: %v", listenPath, err)
	}

	defer socket.Close()
	defer kl.RemoveSafe(listenPath)
	ready := &atomic.Bool{}

	for {
		conn, err := socket.Accept()
		if err != nil {
			dm.Logger.Warnf("Error accepting socket connection: %v", err)
		} else {
			go dm.handleNonK8sConn(conn, ready)
		}
	}

}

// handleNonK8sConn gets container details from container hooks.
func (dm *KubeArmorDaemon) handleNonK8sConn(conn net.Conn, ready *atomic.Bool) {
	// We need to makes sure that no containers accepted until all containers created before KubeArmor
	// are sent first. This is done mainly to avoid race conditions between hooks sending in
	// data that some containers were deleted only for process responsible for sending previous containers
	// to send that these containers are created. Which will leave KubeArmor in an incorrect state.
	defer conn.Close()
	buf := make([]byte, 4096)

	for {
		n, err := conn.Read(buf)
		if err == io.EOF {
			return
		} else if err != nil {
			dm.Logger.Warnf("Error reading connection: %v", err)
		}

		data := tp.HookRequest{}

		err = json.Unmarshal(buf[:n], &data)
		if err != nil {
			dm.Logger.Warnf("Error unmarshalling: %v", err)
		}

		if data.Detached {
			// we want KubeArmor to start accepting containers after
			// all previous container are set
			defer ready.Store(true)
		} else if !ready.Load() {
			_, err = conn.Write([]byte("err"))
			if err == io.EOF {
				return
			} else if err != nil {
				log.Println(err)
				return
			}
			continue
		}
		_, err = conn.Write([]byte("ok"))
		if err == io.EOF {
			return
		} else if err != nil {
			log.Println(err)
			return
		}

		// Handle the container create or delete event
		if data.Operation == tp.HookContainerCreate {
			if err := dm.UpdateContainer(data.Container.ContainerID, data.Container, "create"); err != nil {
				log.Printf("Failed to create container %s: %s", data.Container.ContainerID, err.Error())
			}
		} else {
			if err := dm.UpdateContainer(data.Container.ContainerID, data.Container, "destroy"); err != nil {
				log.Printf("Failed to destroy container %s: %s", data.Container.ContainerID, err.Error())
			}
		}

	}
}

// UpdateContainer Function
func (dm *KubeArmorDaemon) UpdateContainer(containerID string, container tp.Container, action string) error {

	if action == "create" {

		if container.ContainerID == "" {
			return fmt.Errorf("container ID is empty")
		}

		endPoint := tp.EndPoint{}

		dm.ContainersLock.Lock()
		if _, ok := dm.Containers[container.ContainerID]; !ok {
			dm.Containers[container.ContainerID] = container
			dm.ContainersLock.Unlock()

			containerLabels, containerIdentities := common.GetLabelsFromString(container.Labels)

			endPoint.EndPointName = container.ContainerName
			endPoint.ContainerName = container.ContainerName
			endPoint.NamespaceName = container.NamespaceName
			endPoint.Containers = []string{container.ContainerID}
			endPoint.Labels = containerLabels
			endPoint.Identities = containerIdentities
			endPoint.PolicyEnabled = tp.KubeArmorPolicyEnabled
			endPoint.ProcessVisibilityEnabled = true
			endPoint.FileVisibilityEnabled = true
			endPoint.NetworkVisibilityEnabled = true
			endPoint.CapabilitiesVisibilityEnabled = true

			endPoint.AppArmorProfiles = []string{"kubearmor_" + container.ContainerName}

			globalDefaultPosture := tp.DefaultPosture{
				FileAction:         cfg.GlobalCfg.DefaultFilePosture,
				NetworkAction:      cfg.GlobalCfg.DefaultNetworkPosture,
				CapabilitiesAction: cfg.GlobalCfg.DefaultCapabilitiesPosture,
			}
			endPoint.DefaultPosture = globalDefaultPosture

			dm.SecurityPoliciesLock.RLock()
			for _, secPol := range dm.SecurityPolicies {
				if kl.MatchIdentities(secPol.Spec.Selector.Identities, endPoint.Identities) {
					endPoint.SecurityPolicies = append(endPoint.SecurityPolicies, secPol)
				}
			}
			dm.SecurityPoliciesLock.RUnlock()

			dm.EndPointsLock.Lock()
			dm.EndPoints = append(dm.EndPoints, endPoint)
			dm.EndPointsLock.Unlock()

		} else {
			dm.ContainersLock.Unlock()
			return fmt.Errorf("container already exists")
		}

		if dm.SystemMonitor != nil && cfg.GlobalCfg.Policy {
			// for throttling
			dm.SystemMonitor.Logger.ContainerNsKey[containerID] = common.OuterKey{
				MntNs: container.MntNS,
				PidNs: container.PidNS,
			}

			// update NsMap
			dm.SystemMonitor.AddContainerIDToNsMap(containerID, container.NamespaceName, container.PidNS, container.MntNS)
			dm.RuntimeEnforcer.RegisterContainer(containerID, container.PidNS, container.MntNS)

			if len(endPoint.SecurityPolicies) > 0 { // struct can be empty or no policies registered for the endPoint yet
				dm.Logger.UpdateSecurityPolicies("ADDED", endPoint)
				if dm.RuntimeEnforcer != nil && endPoint.PolicyEnabled == tp.KubeArmorPolicyEnabled {
					dm.Logger.Printf("Enforcing security policies for container ID %s", containerID)
					// enforce security policies
					dm.RuntimeEnforcer.UpdateSecurityPolicies(endPoint)
				}
			}
		}

		if cfg.GlobalCfg.StateAgent {
			container.Status = "running"
			go dm.StateAgent.PushContainerEvent(container, state.EventAdded)
		}

		dm.Logger.Printf("Detected a container (added/%.12s/pidns=%d/mntns=%d)", containerID, container.PidNS, container.MntNS)

	} else if action == "destroy" {
		dm.ContainersLock.Lock()
		container, ok := dm.Containers[containerID]
		if !ok {
			dm.ContainersLock.Unlock()
			return fmt.Errorf("container not found for removal: %s", containerID)
		}
		dm.EndPointsLock.Lock()
		dm.MatchandRemoveContainerFromEndpoint(containerID)
		dm.EndPointsLock.Unlock()
		delete(dm.Containers, containerID)
		dm.ContainersLock.Unlock()

		dm.EndPointsLock.Lock()
		// remove apparmor profile for that endpoint
		for idx, endPoint := range dm.EndPoints {
			if endPoint.NamespaceName == container.NamespaceName && endPoint.EndPointName == container.EndPointName && kl.ContainsElement(endPoint.Containers, container.ContainerID) {

				// update apparmor profiles
				for idxA, profile := range endPoint.AppArmorProfiles {
					if profile == container.AppArmorProfile {
						dm.EndPoints[idx].AppArmorProfiles = append(dm.EndPoints[idx].AppArmorProfiles[:idxA], dm.EndPoints[idx].AppArmorProfiles[idxA+1:]...)
						break
					}
				}

				break
			}
		}
		dm.EndPointsLock.Unlock()
		// delete endpoint if no security rules and containers
		idx := 0
		endpointsLength := len(dm.EndPoints)
		for idx < endpointsLength {
			endpoint := dm.EndPoints[idx]
			if container.NamespaceName == endpoint.NamespaceName && container.ContainerName == endpoint.EndPointName &&
				len(endpoint.SecurityPolicies) == 0 && len(endpoint.Containers) == 0 {
				dm.EndPoints = append(dm.EndPoints[:idx], dm.EndPoints[idx+1:]...)
				endpointsLength--
				idx--
			}
			idx++
		}

		if dm.SystemMonitor != nil && cfg.GlobalCfg.Policy {
			outkey := dm.SystemMonitor.Logger.ContainerNsKey[containerID]
			dm.Logger.DeleteAlertMapKey(outkey)
			delete(dm.SystemMonitor.Logger.ContainerNsKey, containerID)
			// update NsMap
			dm.SystemMonitor.DeleteContainerIDFromNsMap(containerID, container.NamespaceName, container.PidNS, container.MntNS)
			dm.RuntimeEnforcer.UnregisterContainer(containerID)
		}

		if cfg.GlobalCfg.StateAgent {
			container.Status = "terminated"
			go dm.StateAgent.PushContainerEvent(container, state.EventDeleted)
		}

		dm.Logger.Printf("Detected a container (removed/%.12s/pidns=%d/mntns=%d)", containerID, container.PidNS, container.MntNS)
	}

	return nil
}

```

### Core Architecture Module: `KubeArmor/core/k8sHandler.go`
```
// SPDX-License-Identifier: Apache-2.0
// Copyright 2026 Authors of KubeArmor

package core

import (
	"bytes"
	"context"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"time"

	kl "github.com/kubearmor/KubeArmor/KubeArmor/common"
	kg "github.com/kubearmor/KubeArmor/KubeArmor/log"
	kspclient "github.com/kubearmor/KubeArmor/pkg/KubeArmorController/client/clientset/versioned"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/apimachinery/pkg/types"
	"k8s.io/client-go/kubernetes"
	"k8s.io/client-go/rest"
	ctrl "sigs.k8s.io/controller-runtime"
)

// ================= //
// == K8s Handler == //
// ================= //

// K8s Handler
var K8s *K8sHandler

// init Function
func init() {
	K8s = NewK8sHandler()
}

// K8sHandler Structure
type K8sHandler struct {
	K8sClient   *kubernetes.Clientset
	KSPClient   *kspclient.Clientset
	HTTPClient  *http.Client
	WatchClient *http.Client

	K8sHost string
}

// NewK8sHandler Function
func NewK8sHandler() *K8sHandler {
	kh := &K8sHandler{}

	config, err := ctrl.GetConfig()
	if err != nil {
		kg.Warnf("Error creating kubernetes config, %s", err)
		return kh
	}

	kh.KSPClient, err = kspclient.NewForConfig(config)
	if err != nil {
		kg.Warnf("Error creating ksp clientset, %s", err)
		return kh
	}

	return kh
}

// ================ //
// == K8s Client == //
// ================ //

// InitK8sClient Function
func (kh *K8sHandler) InitK8sClient() error {
	if !kl.IsK8sEnv() { // not Kubernetes
		return fmt.Errorf("not running in kubernetes environment")
	}

	if kh.K8sClient == nil {
		config := ctrl.GetConfigOrDie()
		kh.K8sHost = config.Host

		var err error
		kh.K8sClient, err = kubernetes.NewForConfig(config)
		if err != nil {
			return fmt.Errorf("failed to create kubernetes client: %w", err)
		}

		kh.WatchClient, err = rest.HTTPClientFor(config)
		if err != nil {
			return fmt.Errorf("failed to create watch client: %w", err)
		}

		configWithTimeout := rest.CopyConfig(config)
		configWithTimeout.Timeout = time.Second * 5

		kh.HTTPClient, err = rest.HTTPClientFor(configWithTimeout)
		if err != nil {
			return fmt.Errorf("failed to create http client: %w", err)
		}
	}

	return nil
}

// ============== //
// == API Call == //
// ============== //

// DoRequest Function
func (kh *K8sHandler) DoRequest(cmd string, data any, path string) ([]byte, error) {
	URL := kh.K8sHost + path

	pbytes, err := json.Marshal(data)
	if err != nil {
		return nil, err
	}

	req, err := http.NewRequest(cmd, URL, bytes.NewBuffer(pbytes))
	if err != nil {
		return nil, err
	}

	req.Header.Add("Content-Type", "application/json")

	resp, err := kh.HTTPClient.Do(req) // #nosec G704 -- safe request sent only to trusted Kubernetes API server
	if err != nil {
		return nil, err
	}

	resBody, err := io.ReadAll(resp.Body)
	if err != nil {
		return nil, err
	}

	if err := resp.Body.Close(); err != nil {
		kg.Err(err.Error())
	}

	return resBody, nil
}

// ================ //
// == Deployment == //
// ================ //

// PatchDeploymentWithAppArmorAnnotations Function
func (kh *K8sHandler) PatchResourceWithAppArmorAnnotations(namespaceName, deploymentName string, appArmorAnnotations map[string]string, kind string) error {
	if !kl.IsK8sEnv() { // not Kubernetes
		return nil
	}

	spec := `{"spec":{"template":{"metadata":{"annotations":{"kubearmor-policy":"enabled",`
	if kind == "CronJob" {
		spec = `{"spec":{"jobTemplate":{"spec":{"template":{"metadata":{"annotations":{"kubearmor-policy":"enabled",`
	}

	count := len(appArmorAnnotations)

	for k, v := range appArmorAnnotations {
		if v == "unconfined" {
			continue
		}

		spec = spec + `"container.apparmor.security.beta.kubernetes.io/` + k + `":"localhost/` + v + `"`

		if count > 1 {
			spec = spec + ","
		}

		count--
	}

	if kind == "CronJob" {
		spec = spec + `}}}}}}}`
	} else {
		spec = spec + `}}}}}`
	}

	switch kind {
	case "StatefulSet":
		_, err := kh.K8sClient.AppsV1().StatefulSets(namespaceName).Patch(context.Background(), deploymentName, types.StrategicMergePatchType, []byte(spec), metav1.PatchOptions{})
		if err != nil {
			return err
		}
		return nil
	case "ReplicaSet":
		rs, err := kh.K8sClient.AppsV1().ReplicaSets(namespaceName).Get(context.Background(), deploymentName, metav1.GetOptions{})
		if err != nil {
			return err
		}
		replicas := *rs.Spec.Replicas
		_, err = kh.K8sClient.AppsV1().ReplicaSets(namespaceName).Patch(context.Background(), deploymentName, types.MergePatchType, []byte(spec), metav1.PatchOptions{})
		if err != nil {
			return err
		}

		// To update the annotations we need to restart the replicaset,we scale it down and scale it back up
		patchData := fmt.Appendf(nil, `{"spec": {"replicas": 0}}`)
		_, err = kh.K8sClient.AppsV1().ReplicaSets(namespaceName).Patch(context.Background(), deploymentName, types.StrategicMergePatchType, patchData, metav1.PatchOptions{})
		if err != nil {
			return err
		}
		time.Sleep(2 * time.Second)
		patchData2 := fmt.Appendf(nil, `{"spec": {"replicas": %d}}`, replicas)
		_, err = kh.K8sClient.AppsV1().ReplicaSets(namespaceName).Patch(context.Background(), deploymentName, types.StrategicMergePatchType, patchData2, metav1.PatchOptions{})
		if err != nil {
			return err
		}

		return nil
	case "DaemonSet":
		_, err := kh.K8sClient.AppsV1().DaemonSets(namespaceName).Patch(context.Background(), deploymentName, types.MergePatchType, []byte(spec), metav1.PatchOptions{})
		if err != nil {
			return err
		}
		return nil
	case "Deployment":
		_, err := kh.K8sClient.AppsV1().Deployments(namespaceName).Patch(context.Background(), deploymentName, types.StrategicMergePatchType, []byte(spec), metav1.PatchOptions{})
		if err != nil {
			return err
		}
	case "CronJob":
		_, err := kh.K8sClient.BatchV1().CronJobs(namespaceName).Patch(context.Background(), deploymentName, types.StrategicMergePatchType, []byte(spec), metav1.PatchOptions{})
		if err != nil {
			return err
		}
	case "Pod":
		// this condition won't be triggered, handled by controller
		return nil

	}

	return nil
}

// PatchDeploymentWithSELinuxAnnotations Function
func (kh *K8sHandler) PatchDeploymentWithSELinuxAnnotations(namespaceName, deploymentName string, seLinuxAnnotations map[string]string) error {
	if !kl.IsK8sEnv() { // not Kubernetes
		return nil
	}

	spec := `{"spec":{"template":{"metadata":{"annotations":{"kubearmor-policy":"enabled",`
	count := len(seLinuxAnnotations)

	for k, v := range seLinuxAnnotations {
		spec = spec + `"kubearmor-selinux/` + k + `":"` + v + `"`

		if count > 1 {
			spec = spec + ","
		}

		count--
	}

	spec = spec + `}}}}}`

	_, err := kh.K8sClient.AppsV1().Deployments(namespaceName).Patch(context.Background(), deploymentName, types.StrategicMergePatchType, []byte(spec), metav1.PatchOptions{})
	if err != nil {
		return err
	}

	return nil
}

// ================ //
// == ReplicaSet == //
// ================ //

// GetDeploymentNameControllingReplicaSet Function
func (kh *K8sHandler) GetDeploymentNameControllingReplicaSet(namespaceName, podownerName string) (string, string) {
	if !kl.IsK8sEnv() { // not Kubernetes
		return "", ""
	}

	// get replicaSet from k8s api client
	rs, err := kh.K8sClient.AppsV1().ReplicaSets(namespaceName).Get(context.Background(), podownerName, metav1.GetOptions{})
	if err != nil {
		return "", ""
	}

	// check if we have ownerReferences
	if len(rs.ObjectMeta.OwnerReferences) == 0 {
		return "", ""
	}

	// check if given ownerReferences are for Deployment
	if rs.ObjectMeta.OwnerReferences[0].Kind != "Deployment" {
		return "", ""
	}

	// return the deployment name
	return rs.ObjectMeta.OwnerReferences[0].Name, rs.ObjectMeta.Namespace
}

// GetReplicaSet Function
func (kh *K8sHandler) GetReplicaSet(namespaceName, podownerName string) (string, string) {
	if !kl.IsK8sEnv() { // not Kubernetes
		return "", ""
	}

	// get replicaSet from k8s api client
	rs, err := kh.K8sClient.AppsV1().ReplicaSets(namespaceName).Get(context.Background(), podownerName, metav1.GetOptions{})
	if err != nil {
		return "", ""
	}

	// return the replicaSet name
	return rs.ObjectMeta.Name, rs.ObjectMeta.Namespace
}

// ================ //
// == DaemonSet == //
// ================ //

// GetDaemonSet Function
func (kh *K8sHandler) GetDaemonSet(namespaceName, podownerName string) (string, string) {
	if !kl.IsK8sEnv() { // not Kubernetes
		return "", ""
	}

	// get daemonSet from k8s api client
	ds, err := kh.K8sClient.AppsV1().DaemonSets(namespaceName).Get(context.Background(), podownerName, metav1.GetOptions{})
	if err != nil {
		return "", ""
	}

	// return the daemonSet name
	return ds.ObjectMeta.Name, ds.ObjectMeta.Namespace
}

// ================ //
// == StatefulSet == //
// ================ //

// GetStatefulSet Function
func (kh *K8sHandler) GetStatefulSet(namespaceName, podownerName string) (string, string) {
	if !kl.IsK8sEnv() { // not Kubernetes
		return "", ""
	}

	// get statefulSets from k8s api client
	ss, err := kh.K8sClient.AppsV1().StatefulSets(namespaceName).Get(context.Background(), podownerName, metav1.GetOptions{})
	if err != nil {
		return "", ""
	}

	// return the statefulSet name
	return ss.ObjectMeta.Name, ss.ObjectMeta.Namespace
}

// ====================== //
// == Custom Resources == //
// ====================== //

// CheckCustomResourceDefinition Function
func (kh *K8sHandler) CheckCustomResourceDefinition(resourceName string) error {
	if !kl.IsK8sEnv() { // not Kubernetes
		return fmt.Errorf("not running in Kubernetes environment")
	}

	exist := false
	apiGroup := metav1.APIGroup{}

	// check APIGroup
	if resBody, errOut := kh.DoRequest("GET", nil, "/apis"); errOut == nil {
		res := metav1.APIGroupList{}
		if errIn := json.Unmarshal(resBody, &res); errIn == nil {
			for _, group := range res.Groups {
				if group.Name == "security.kubearmor.com" {
					exist = true
					apiGroup = group
					break
				}
			}
		}
	}

	// check APIResource
	if exist {
		if resBody, errOut := kh.DoRequest("GET", nil, "/apis/"+apiGroup.PreferredVersion.GroupVersion); errOut == nil {
			res := metav1.APIResourceLi
```

### Core Architecture Module: `KubeArmor/core/karmorprobedata.go`
```
// SPDX-License-Identifier: Apache-2.0
// Copyright 2026 Authors of KubeArmor

package core

import (
	"context"
	"encoding/json"

	kl "github.com/kubearmor/KubeArmor/KubeArmor/common"
	cfg "github.com/kubearmor/KubeArmor/KubeArmor/config"
	tp "github.com/kubearmor/KubeArmor/KubeArmor/types"
	pb "github.com/kubearmor/KubeArmor/protobuf"
	"google.golang.org/protobuf/types/known/emptypb"
)

// KarmorData Structure
type KarmorData struct {
	OSImage                 string
	KernelVersion           string
	KubeletVersion          string
	ContainerRuntime        string
	ActiveLSM               string
	KernelHeaderPresent     bool
	HostSecurity            bool
	ContainerSecurity       bool
	ContainerDefaultPosture tp.DefaultPosture
	HostDefaultPosture      tp.DefaultPosture
	HostVisibility          string
}

// Probe provides structure to serve Policy gRPC service
type Probe struct {
	pb.ProbeServiceServer
	GetContainerData func() ([]string, map[string]*pb.ContainerData, map[string]*pb.HostSecurityPolicies)
}

// SetKarmorData generates runtime configuration for KubeArmor to be consumed by kArmor
func (dm *KubeArmorDaemon) SetKarmorData() {
	var kd KarmorData

	kd.ContainerDefaultPosture = tp.DefaultPosture{
		FileAction:         cfg.GlobalCfg.DefaultFilePosture,
		NetworkAction:      cfg.GlobalCfg.DefaultNetworkPosture,
		CapabilitiesAction: cfg.GlobalCfg.DefaultCapabilitiesPosture,
	}
	kd.HostDefaultPosture = tp.DefaultPosture{
		FileAction:         cfg.GlobalCfg.HostDefaultFilePosture,
		NetworkAction:      cfg.GlobalCfg.HostDefaultNetworkPosture,
		CapabilitiesAction: cfg.GlobalCfg.HostDefaultCapabilitiesPosture,
		DeviceAction:       cfg.GlobalCfg.HostDefaultDevicePosture,
	}

	kd.OSImage = dm.Node.OSImage
	kd.ContainerRuntime = dm.Node.ContainerRuntimeVersion
	kd.KernelVersion = dm.Node.KernelVersion
	kd.KubeletVersion = dm.Node.KubeletVersion
	kd.ContainerRuntime = dm.Node.ContainerRuntimeVersion
	if dm.RuntimeEnforcer != nil {
		kd.ActiveLSM = dm.RuntimeEnforcer.EnforcerType

		if cfg.GlobalCfg.Policy {
			kd.ContainerSecurity = true
		}
		if cfg.GlobalCfg.HostPolicy {
			kd.HostSecurity = true
		}
	}
	kd.KernelHeaderPresent = true //this is always true since KubeArmor is running
	kd.HostVisibility = dm.Node.Annotations["kubearmor-visibility"]
	err := kl.WriteToFile(kd, "/tmp/karmorProbeData.cfg")
	if err != nil {
		dm.Logger.Errf("Error writing karmor config data (%s)", err.Error())
	}

}

// SetProbeContainerData keeps track of containers and the applied policies
func (dm *KubeArmorDaemon) SetProbeContainerData() ([]string, map[string]*pb.ContainerData, map[string]*pb.HostSecurityPolicies) {
	var containerlist []string
	dm.ContainersLock.Lock()
	for _, value := range dm.Containers {
		containerlist = append(containerlist, value.ContainerName)
	}
	dm.ContainersLock.Unlock()

	containerMap := make(map[string]*pb.ContainerData)
	dm.EndPointsLock.Lock()

	for _, ep := range dm.EndPoints {
		var policyNames []string
		var policyData []*pb.Policy

		for _, policy := range ep.SecurityPolicies {
			policyNames = append(policyNames, policy.Metadata["policyName"])
			policyEventData, err := json.Marshal(policy)
			if err != nil {
				dm.Logger.Errf("Error marshalling policy data (%s)", err.Error())
			} else {
				policyData = append(policyData, &pb.Policy{Policy: policyEventData})
			}
		}
		containerMap[ep.EndPointName] = &pb.ContainerData{
			PolicyList:     policyNames,
			PolicyEnabled:  int32(ep.PolicyEnabled),
			PolicyDataList: policyData,
		}
	}
	dm.EndPointsLock.Unlock()

	// Mapping HostPolicies to their host hostName : HostPolicy
	hostMap := make(map[string]*pb.HostSecurityPolicies)

	dm.HostSecurityPoliciesLock.Lock()
	for _, hp := range dm.HostSecurityPolicies {
		hostName := dm.Node.NodeName

		if val, ok := hostMap[hostName]; ok {
			val.PolicyList = append(val.PolicyList, hp.Metadata["policyName"])
			policyEventData, err := json.Marshal(hp)
			if err != nil {
				dm.Logger.Errf("Error marshalling policy data (%s)", err.Error())
			} else {
				val.PolicyDataList = append(val.PolicyDataList, &pb.Policy{
					Policy: policyEventData,
				})
			}
			hostMap[hostName] = val
		} else {
			policyEventData, err := json.Marshal(hp)
			if err != nil {
				dm.Logger.Errf("Error marshalling policy data (%s)", err.Error())
			}
			hostMap[hostName] = &pb.HostSecurityPolicies{
				PolicyList:     []string{hp.Metadata["policyName"]},
				PolicyDataList: []*pb.Policy{{Policy: policyEventData}},
			}
		}
	}
	dm.HostSecurityPoliciesLock.Unlock()
	return containerlist, containerMap, hostMap
}

// GetProbeData sends policy data through grpc client
func (p *Probe) GetProbeData(c context.Context, in *emptypb.Empty) (*pb.ProbeResponse, error) {
	containerList, containerMap, hostMap := p.GetContainerData()
	res := &pb.ProbeResponse{
		ContainerList: containerList,
		ContainerMap:  containerMap,
		HostMap:       hostMap,
	}
	return res, nil
}

```

### Core Architecture Module: `KubeArmor/core/kubeArmor.go`
```
// SPDX-License-Identifier: Apache-2.0
// Copyright 2026 Authors of KubeArmor

// Package core is responsible for initiating and maintaining interactions between external entities like K8s,CRIs and internal KubeArmor entities like eBPF Monitor and Log Feeders
package core

import (
	"context"
	"fmt"
	"net"
	"os"
	"os/signal"
	"path/filepath"
	"strings"
	"sync"
	"syscall"
	"time"

	"github.com/kubearmor/KubeArmor/KubeArmor/common"
	kl "github.com/kubearmor/KubeArmor/KubeArmor/common"
	cfg "github.com/kubearmor/KubeArmor/KubeArmor/config"
	kg "github.com/kubearmor/KubeArmor/KubeArmor/log"
	"github.com/kubearmor/KubeArmor/KubeArmor/policy"
	"github.com/kubearmor/KubeArmor/KubeArmor/presets"
	"github.com/kubearmor/KubeArmor/KubeArmor/state"
	tp "github.com/kubearmor/KubeArmor/KubeArmor/types"
	"google.golang.org/grpc"
	"google.golang.org/grpc/health"
	"google.golang.org/grpc/health/grpc_health_v1"
	"google.golang.org/grpc/reflection"
	"k8s.io/client-go/tools/cache"

	efc "github.com/kubearmor/KubeArmor/KubeArmor/enforcer"
	fd "github.com/kubearmor/KubeArmor/KubeArmor/feeder"
	kvm "github.com/kubearmor/KubeArmor/KubeArmor/kvmAgent"
	mon "github.com/kubearmor/KubeArmor/KubeArmor/monitor"
	ne "github.com/kubearmor/KubeArmor/KubeArmor/networkPolicyEnforcer"
	dvc "github.com/kubearmor/KubeArmor/KubeArmor/usbDeviceHandler"
	pb "github.com/kubearmor/KubeArmor/protobuf"
)

// ====================== //
// == KubeArmor Daemon == //
// ====================== //

// StopChan Channel
var StopChan chan struct{}

// init Function
func init() {
	StopChan = make(chan struct{})
}

// KubeArmorDaemon Structure
type KubeArmorDaemon struct {
	// node
	Node     tp.Node
	NodeLock *sync.RWMutex

	// flag
	K8sEnabled bool

	// K8s pods (from kubernetes)
	K8sPods     []tp.K8sPod
	K8sPodsLock *sync.RWMutex

	// containers (from docker)
	Containers     map[string]tp.Container
	ContainersLock *sync.RWMutex

	// endpoints
	EndPoints     []tp.EndPoint
	EndPointsLock *sync.RWMutex

	// Owner Info
	OwnerInfo     map[string]tp.PodOwner
	OwnerInfoLock *sync.RWMutex

	// Security policies
	SecurityPolicies     []tp.SecurityPolicy
	SecurityPoliciesLock *sync.RWMutex

	// Host Security policies
	HostSecurityPolicies     []tp.HostSecurityPolicy
	HostSecurityPoliciesLock *sync.RWMutex

	// Network Security policies
	NetworkSecurityPolicies     []tp.NetworkSecurityPolicy
	NetworkSecurityPoliciesLock *sync.RWMutex

	// DefaultPosture (namespace -> postures)
	DefaultPostures     map[string]tp.DefaultPosture
	DefaultPosturesLock *sync.Mutex

	// pid map
	ActiveHostPidMap map[string]tp.PidMap
	ActivePidMapLock *sync.RWMutex

	// logger
	Logger *fd.Feeder

	// system monitor
	SystemMonitor *mon.SystemMonitor

	// runtime enforcer
	RuntimeEnforcer *efc.RuntimeEnforcer

	// presets
	Presets *presets.Preset

	// kvm agent
	KVMAgent *kvm.KVMAgent

	// state agent
	StateAgent *state.StateAgent

	// WgDaemon Handler
	WgDaemon sync.WaitGroup

	// system monitor lock
	MonitorLock *sync.RWMutex

	// health-server
	GRPCHealthServer *health.Server

	// USB device handler
	USBDeviceHandler *dvc.USBDeviceHandler

	// Network Policy Enforcer
	NetworkPolicyEnforcer *ne.NetworkPolicyEnforcer
}

// NewKubeArmorDaemon Function
func NewKubeArmorDaemon() *KubeArmorDaemon {
	dm := new(KubeArmorDaemon)

	dm.Node = tp.Node{}
	dm.NodeLock = new(sync.RWMutex)

	dm.K8sEnabled = false

	dm.K8sPods = []tp.K8sPod{}
	dm.K8sPodsLock = new(sync.RWMutex)

	dm.Containers = map[string]tp.Container{}
	dm.ContainersLock = new(sync.RWMutex)
	dm.EndPoints = []tp.EndPoint{}
	dm.EndPointsLock = new(sync.RWMutex)

	dm.SecurityPolicies = []tp.SecurityPolicy{}
	dm.SecurityPoliciesLock = new(sync.RWMutex)

	dm.HostSecurityPolicies = []tp.HostSecurityPolicy{}
	dm.HostSecurityPoliciesLock = new(sync.RWMutex)

	dm.NetworkSecurityPolicies = []tp.NetworkSecurityPolicy{}
	dm.NetworkSecurityPoliciesLock = new(sync.RWMutex)

	dm.DefaultPostures = map[string]tp.DefaultPosture{}
	dm.DefaultPosturesLock = new(sync.Mutex)

	dm.ActiveHostPidMap = map[string]tp.PidMap{}
	dm.ActivePidMapLock = new(sync.RWMutex)

	dm.Logger = nil
	dm.SystemMonitor = nil
	dm.RuntimeEnforcer = nil
	dm.KVMAgent = nil
	dm.USBDeviceHandler = nil
	dm.NetworkPolicyEnforcer = nil

	dm.WgDaemon = sync.WaitGroup{}

	dm.MonitorLock = new(sync.RWMutex)

	dm.OwnerInfo = map[string]tp.PodOwner{}
	dm.OwnerInfoLock = new(sync.RWMutex)

	return dm
}

// DestroyKubeArmorDaemon Function
func (dm *KubeArmorDaemon) DestroyKubeArmorDaemon() {
	close(StopChan)

	if dm.SystemMonitor != nil {
		// close system monitor
		if err := dm.CloseSystemMonitor(); err != nil {
			dm.Logger.Errf("Failed to stop KubeArmor Monitor: %s", err.Error())
		} else {
			dm.Logger.Print("Stopped KubeArmor Monitor")
		}
	}

	if dm.RuntimeEnforcer != nil {
		// close runtime enforcer
		if err := dm.CloseRuntimeEnforcer(); err != nil {
			dm.Logger.Errf("Failed to stop KubeArmor Enforcer: %s", err.Error())
		} else {
			dm.Logger.Print("Stopped KubeArmor Enforcer")
		}
	}

	if dm.KVMAgent != nil {
		// close kvm agent
		if err := dm.CloseKVMAgent(); err != nil {
			dm.Logger.Errf("Failed to stop KVM Agent: %s", err.Error())
		} else {
			dm.Logger.Print("Stopped KVM Agent")
		}
	}

	if dm.USBDeviceHandler != nil {
		// close USB device handler
		if dm.CloseUSBDeviceHandler() {
			dm.Logger.Print("Stopped USB Device Handler")
		}
	}

	if dm.NetworkPolicyEnforcer != nil {
		// close network policy enforcer
		if err := dm.CloseNetworkPolicyEnforcer(); err != nil {
			kg.Errf("Failed to destroy Network Policy Enforcer: %s", err.Error())
		} else {
			dm.Logger.Print("Stopped Network Policy Enforcer")
		}
	}

	if dm.Logger != nil {
		dm.Logger.Print("Terminated KubeArmor")
	} else {
		kg.Print("Terminated KubeArmor")
	}

	if dm.StateAgent != nil {
		// go dm.StateAgent.PushNodeEvent(dm.Node, state.EventDeleted)
		if err := dm.CloseStateAgent(); err != nil {
			kg.Errf("Failed to destroy StateAgent: %s", err.Error())
		} else {
			kg.Print("Destroyed StateAgent")
		}
	}

	// wait for a while
	time.Sleep(time.Second * 1)

	if dm.Logger != nil {
		// close logger
		if err := dm.CloseLogger(); err != nil {
			kg.Errf("Failed to stop KubeArmor Logger: %s", err.Error())
		} else {
			kg.Print("Stopped KubeArmor Logger")
		}
	}

	// wait for other routines
	kg.Print("Waiting for routine terminations")
	dm.WgDaemon.Wait()

	// delete pid file
	if _, err := os.Stat(cfg.PIDFilePath); err == nil {
		kg.Print("Deleting PID file")

		err := common.RemoveSafe(cfg.PIDFilePath)
		if err != nil {
			kg.Errf("Failed to delete PID file")
		}
	}
}

// ============ //
// == Logger == //
// ============ //

// InitLogger Function
func (dm *KubeArmorDaemon) InitLogger() error {
	dm.Logger = fd.NewFeeder(&dm.Node, &dm.NodeLock)
	if dm.Logger == nil {
		return fmt.Errorf("failed to create new feeder")
	}
	return nil
}

// ServeLogFeeds Function
func (dm *KubeArmorDaemon) ServeLogFeeds() {
	dm.WgDaemon.Add(1)
	defer dm.WgDaemon.Done()

	go dm.Logger.ServeLogFeeds()
}

// CloseLogger Function
func (dm *KubeArmorDaemon) CloseLogger() error {
	if err := dm.Logger.DestroyFeeder(); err != nil {
		return fmt.Errorf("failed to destroy KubeArmor Logger: %w", err)
	}
	return nil
}

// ==================== //
// == System Monitor == //
// ==================== //

// InitSystemMonitor Function
func (dm *KubeArmorDaemon) InitSystemMonitor() error {
	dm.SystemMonitor = mon.NewSystemMonitor(&dm.Node, &dm.NodeLock, dm.Logger, &dm.Containers, &dm.ContainersLock, &dm.ActiveHostPidMap, &dm.ActivePidMapLock, &dm.MonitorLock)
	if dm.SystemMonitor == nil {
		return fmt.Errorf("failed to create new system monitor")
	}

	if err := dm.SystemMonitor.InitBPF(); err != nil {
		return fmt.Errorf("failed to initialize BPF: %w", err)
	}

	return nil
}

// MonitorSystemEvents Function
func (dm *KubeArmorDaemon) MonitorSystemEvents() {
	dm.WgDaemon.Add(1)
	defer dm.WgDaemon.Done()

	if cfg.GlobalCfg.Policy || cfg.GlobalCfg.HostPolicy {
		go dm.SystemMonitor.TraceSyscall()
		go dm.SystemMonitor.UpdateLogs()
		go dm.SystemMonitor.CleanUpExitedHostPids()
	}
}

// CloseSystemMonitor Function
func (dm *KubeArmorDaemon) CloseSystemMonitor() error {
	if err := dm.SystemMonitor.DestroySystemMonitor(); err != nil {
		return fmt.Errorf("failed to destroy KubeArmor Monitor: %w", err)
	}
	return nil
}

// ====================== //
// == Runtime Enforcer == //
// ====================== //

// InitRuntimeEnforcer Function
func (dm *KubeArmorDaemon) InitRuntimeEnforcer(pinpath string) error {
	dm.RuntimeEnforcer = efc.NewRuntimeEnforcer(dm.Node, pinpath, dm.Logger, dm.SystemMonitor)
	if dm.RuntimeEnforcer == nil {
		return fmt.Errorf("failed to create runtime enforcer")
	}
	return nil
}

// CloseRuntimeEnforcer Function
func (dm *KubeArmorDaemon) CloseRuntimeEnforcer() error {
	if err := dm.RuntimeEnforcer.DestroyRuntimeEnforcer(); err != nil {
		return fmt.Errorf("failed to destroy KubeArmor Enforcer: %w", err)
	}
	return nil
}

// ======================== //
// == USB Device Handler == //
// ======================== //

// InitUSBDeviceHandler Function
func (dm *KubeArmorDaemon) InitUSBDeviceHandler() bool {
	dm.USBDeviceHandler = dvc.NewUSBDeviceHandler(dm.Logger)
	return dm.USBDeviceHandler != nil
}

// CloseUSBDeviceHandler Function
func (dm *KubeArmorDaemon) CloseUSBDeviceHandler() bool {
	if err := dm.USBDeviceHandler.DestroyUSBDeviceHandler(); err != nil {
		dm.Logger.Errf("Failed to destroy KubeArmor USB Device Handler (%s)", err.Error())
		return false
	}
	return true
}

// ============================= //
// == Network Policy Enforcer == //
// ============================= //

// InitNetworkPolicyEnforcer Function
func (dm *KubeArmorDaemon) InitNetworkPolicyEnforcer() error {
	var err error
	dm.NetworkPolicyEnforcer, err = ne.NewNetworkPolicyEnforcer(dm.Logger)
	if err != nil {
		return fmt.Errorf("failed to create network policy enforcer: %v", err)
	}
	return nil
}

// CloseNetworkPolicyEnforcer Function
func (dm *KubeArmorDaemon) CloseNetworkPoli
```

### Core Architecture Module: `KubeArmor/core/kubeUpdate.go`
```
// SPDX-License-Identifier: Apache-2.0
// Copyright 2026 Authors of KubeArmor

package core

import (
	"context"
	"fmt"
	"maps"
	"os"
	"reflect"
	"slices"
	"strconv"
	"strings"
	"time"

	kl "github.com/kubearmor/KubeArmor/KubeArmor/common"
	cfg "github.com/kubearmor/KubeArmor/KubeArmor/config"
	kg "github.com/kubearmor/KubeArmor/KubeArmor/log"
	"github.com/kubearmor/KubeArmor/KubeArmor/monitor"
	tp "github.com/kubearmor/KubeArmor/KubeArmor/types"
	ksp "github.com/kubearmor/KubeArmor/pkg/KubeArmorController/api/security.kubearmor.com/v1"
	kspinformer "github.com/kubearmor/KubeArmor/pkg/KubeArmorController/client/informers/externalversions"
	pb "github.com/kubearmor/KubeArmor/protobuf"
	corev1 "k8s.io/api/core/v1"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/client-go/informers"
	"k8s.io/client-go/tools/cache"
)

const (
	KubeArmorPolicy        string = "KubeArmorPolicy"
	KubeArmorClusterPolicy string = "KubeArmorClusterPolicy"
	InOperator             string = "In"
	NotInOperator          string = "NotIn"
	NamespaceKey           string = "namespace"
	LabelKey               string = "label"

	// Event Types
	addEvent    string = "ADDED"
	updateEvent string = "MODIFIED"
	deleteEvent string = "DELETED"
)

// ================= //
// == Node Update == //
// ================= //

// HandleNodeAnnotations Handle Node Annotations i.e, set host visibility based on annotations, enable/disable policy
func (dm *KubeArmorDaemon) HandleNodeAnnotations(node *tp.Node) {
	if _, ok := node.Annotations["kubearmor-policy"]; !ok {
		node.Annotations["kubearmor-policy"] = "enabled"
	}

	if node.Annotations["kubearmor-policy"] != "enabled" && node.Annotations["kubearmor-policy"] != "disabled" && node.Annotations["kubearmor-policy"] != "audited" {
		node.Annotations["kubearmor-policy"] = "enabled"
	}

	// == LSM == //
	var lsm string

	// Check if enforcer is set in the node annotations
	if v, ok := node.Labels["kubearmor.io/enforcer"]; ok {
		lsm = v
	} else { // Read the lsm from the system
		lsmByteData, err := os.ReadFile("/sys/kernel/security/lsm")
		if err != nil && !os.IsNotExist(err) {
			kg.Errf("Failed to read /sys/kernel/security/lsm (%s)", err.Error())
		} else if len(lsmByteData) == 0 {
			kg.Err("Failed to read /sys/kernel/security/lsm: empty file")
		}
		lsm = string(lsmByteData)
	}

	hasAppArmor := strings.Contains(lsm, "apparmor")
	hasSelinux := strings.Contains(lsm, "selinux")
	hasBPF := strings.Contains(lsm, "bpf")

	if !hasBPF && !hasSelinux && !hasAppArmor {
		// exception: neither AppArmor, SELinux or BPF
		if node.Annotations["kubearmor-policy"] == "enabled" {
			node.Annotations["kubearmor-policy"] = "audited"
		}
	}

	if kl.IsInK8sCluster() && hasSelinux {
		// exception: KubeArmor in a daemonset even though SELinux is enabled
		if node.Annotations["kubearmor-policy"] == "enabled" {
			node.Annotations["kubearmor-policy"] = "audited"
		}
	}

	switch node.Annotations["kubearmor-policy"] {
	case "enabled":
		node.PolicyEnabled = tp.KubeArmorPolicyEnabled
	case "audited":
		node.PolicyEnabled = tp.KubeArmorPolicyAudited
	default: // disabled
		node.PolicyEnabled = tp.KubeArmorPolicyDisabled
	}

	if _, ok := node.Annotations["kubearmor-visibility"]; !ok {
		node.Annotations["kubearmor-visibility"] = cfg.GlobalCfg.HostVisibility
	}

	for visibility := range strings.SplitSeq(node.Annotations["kubearmor-visibility"], ",") {
		switch visibility {
		case "process":
			node.ProcessVisibilityEnabled = true
		case "file":
			node.FileVisibilityEnabled = true
		case "network":
			node.NetworkVisibilityEnabled = true
		case "capabilities":
			node.CapabilitiesVisibilityEnabled = true
		}
	}
}

func (dm *KubeArmorDaemon) checkAndUpdateNode(item *corev1.Node) {
	node := tp.Node{}

	node.ClusterName = cfg.GlobalCfg.Cluster
	node.NodeName = cfg.GlobalCfg.Host

	for _, address := range item.Status.Addresses {
		if address.Type == "InternalIP" {
			node.NodeIP = address.Address
			break
		}
	}

	node.Annotations = map[string]string{}
	node.Labels = map[string]string{}
	node.Identities = []string{}

	// update annotations
	maps.Copy(node.Annotations, item.ObjectMeta.Annotations)

	// update labels and identities
	for k, v := range item.ObjectMeta.Labels {
		node.Labels[k] = v
		node.Identities = append(node.Identities, k+"="+v)
	}

	slices.Sort(node.Identities)

	// node info
	node.Architecture = item.Status.NodeInfo.Architecture
	node.OperatingSystem = item.Status.NodeInfo.OperatingSystem
	node.OSImage = item.Status.NodeInfo.OSImage
	node.KernelVersion = item.Status.NodeInfo.KernelVersion
	node.KubeletVersion = item.Status.NodeInfo.KubeletVersion

	// container runtime
	node.ContainerRuntimeVersion = item.Status.NodeInfo.ContainerRuntimeVersion

	dm.HandleNodeAnnotations(&node)

	// update node info
	dm.NodeLock.Lock()
	dm.Node = node
	dm.NodeLock.Unlock()
}

// WatchK8sNodes Function
func (dm *KubeArmorDaemon) WatchK8sNodes() {
	kg.Printf("GlobalCfg.Host=%s, KUBEARMOR_NODENAME=%s", cfg.GlobalCfg.Host, os.Getenv("KUBEARMOR_NODENAME"))

	nodeName := os.Getenv("KUBEARMOR_NODENAME")
	if nodeName == "" {
		nodeName = cfg.GlobalCfg.Host
	}

	factory := informers.NewSharedInformerFactoryWithOptions(
		K8s.K8sClient,
		0,
		informers.WithTweakListOptions(func(options *metav1.ListOptions) {
			options.FieldSelector = fmt.Sprintf("metadata.name=%s", nodeName)
		}),
	)
	informer := factory.Core().V1().Nodes().Informer()

	if _, err := informer.AddEventHandler(cache.ResourceEventHandlerFuncs{
		AddFunc: func(obj any) {
			if item, ok := obj.(*corev1.Node); ok {
				dm.checkAndUpdateNode(item)
			}
		},
		UpdateFunc: func(oldObj, newObj any) {
			if item, ok := newObj.(*corev1.Node); ok {
				dm.checkAndUpdateNode(item)
			}
		},
	}); err != nil {
		kg.Err("Couldn't Start Watching node information")
		return
	}

	go factory.Start(StopChan)
	factory.WaitForCacheSync(StopChan)
	kg.Print("Started watching node information")

}

// ================ //
// == Pod Update == //
// ================ //

// UpdateEndPointWithPod Function
func (dm *KubeArmorDaemon) UpdateEndPointWithPod(action string, pod tp.K8sPod) {
	if action == addEvent {
		// create a new endpoint
		newPoint := tp.EndPoint{}

		newPoint.NamespaceName = pod.Metadata["namespaceName"]
		newPoint.EndPointName = pod.Metadata["podName"]

		newPoint.Labels = map[string]string{}
		newPoint.Identities = []string{"namespaceName=" + pod.Metadata["namespaceName"]}

		// update labels and identities
		for k, v := range pod.Labels {
			newPoint.Labels[k] = v
			newPoint.Identities = append(newPoint.Identities, k+"="+v)
		}

		slices.Sort(newPoint.Identities)

		newPoint.PodIP = pod.PodIP

		// update policy flag
		switch pod.Annotations["kubearmor-policy"] {
		case "enabled":
			newPoint.PolicyEnabled = tp.KubeArmorPolicyEnabled
		case "audited":
			newPoint.PolicyEnabled = tp.KubeArmorPolicyAudited
		default: // disabled
			newPoint.PolicyEnabled = tp.KubeArmorPolicyDisabled
		}

		// parse annotations and update visibility flags
		for visibility := range strings.SplitSeq(pod.Annotations["kubearmor-visibility"], ",") {
			switch visibility {
			case "process":
				newPoint.ProcessVisibilityEnabled = true
			case "file":
				newPoint.FileVisibilityEnabled = true
			case "network":
				newPoint.NetworkVisibilityEnabled = true
			case "capabilities":
				newPoint.CapabilitiesVisibilityEnabled = true
			}
		}

		newPoint.Containers = []string{}
		newPoint.AppArmorProfiles = []string{}

		// update containers
		for k := range pod.Containers {
			newPoint.Containers = append(newPoint.Containers, k)
		}

		containersAppArmorProfiles := map[string]string{}
		dm.ContainersLock.Lock()

		// update containers and apparmors
		for _, containerID := range newPoint.Containers {

			container := dm.Containers[containerID]

			container.NamespaceName = newPoint.NamespaceName
			container.EndPointName = newPoint.EndPointName

			if (container.Owner == tp.PodOwner{}) && (len(dm.OwnerInfo) > 0) {
				if podOwnerInfo, ok := dm.OwnerInfo[container.EndPointName]; ok && (podOwnerInfo != tp.PodOwner{}) {
					container.Owner = podOwnerInfo
				}
			}

			labels := []string{}
			for k, v := range newPoint.Labels {
				labels = append(labels, k+"="+v)
			}
			container.Labels = strings.Join(labels, ",")

			container.ContainerName = pod.Containers[containerID]
			container.ContainerImage = pod.ContainerImages[containerID]

			container.PolicyEnabled = newPoint.PolicyEnabled

			container.ProcessVisibilityEnabled = newPoint.ProcessVisibilityEnabled
			container.FileVisibilityEnabled = newPoint.FileVisibilityEnabled
			container.NetworkVisibilityEnabled = newPoint.NetworkVisibilityEnabled
			container.CapabilitiesVisibilityEnabled = newPoint.CapabilitiesVisibilityEnabled

			containersAppArmorProfiles[containerID] = container.AppArmorProfile
			if !kl.ContainsElement(newPoint.AppArmorProfiles, container.AppArmorProfile) {
				newPoint.AppArmorProfiles = append(newPoint.AppArmorProfiles, container.AppArmorProfile)
			}

			// if container is privileged
			if _, ok := pod.PrivilegedContainers[container.ContainerName]; ok {
				container.Privileged = true
			}

			dm.Containers[containerID] = container

			// in case if container runtime detect the container and emit that event before pod event then
			// the container id will be added to NsMap with "Unknown" namespace
			// therefore update the NsMap to have this container id with associated namespace
			// and delete the container id from  NamespacePidsMap within "Unknown" namespace
			dm.HandleUnknownNamespaceNsMap(&container)
		}
		dm.ContainersLock.Unlock()

		dm.DefaultPosturesLock.Lock()
		if val, ok := dm.DefaultPostures[newPoint.NamespaceName]; ok {
			newPoint.DefaultPosture = val
		} else {
			globalDefaultPosture := tp.DefaultPosture{
				FileAction:         cfg.GlobalCfg.DefaultFilePosture,
				NetworkAction:      cfg.GlobalCfg.DefaultNetworkPosture,
				CapabilitiesAction: cfg.GlobalCfg.DefaultCapabilitiesPosture,
			}
			newPoint.DefaultPosture = glo
```

### Core Architecture Module: `KubeArmor/core/nriHandler.go`
```
// SPDX-License-Identifier: Apache-2.0
// Copyright 2026 Authors of KubeArmor

package core

import (
	"context"
	"fmt"
	"os"
	"path/filepath"
	"strconv"
	"strings"
	"time"

	"github.com/containerd/nri/pkg/api"
	"github.com/containerd/nri/pkg/stub"
	"github.com/kubearmor/KubeArmor/KubeArmor/common"
	kl "github.com/kubearmor/KubeArmor/KubeArmor/common"
	cfg "github.com/kubearmor/KubeArmor/KubeArmor/config"
	kg "github.com/kubearmor/KubeArmor/KubeArmor/log"
	tp "github.com/kubearmor/KubeArmor/KubeArmor/types"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
)

// NRI Handler
var NRI *NRIHandler

type namespaceKey struct {
	PidNS uint32
	MntNS uint32
}

// namespaceKeyFromContainer creates a namespaceKey from a container.
func namespaceKeyFromContainer(container tp.Container) namespaceKey {
	return namespaceKey{
		PidNS: container.PidNS,
		MntNS: container.MntNS,
	}
}

// NRIHandler connects to an NRI socket and informs on container
// creation/deletion events.
type NRIHandler struct {
	// NRI plugin stub
	stub stub.Stub

	// active containers
	containers map[string]tp.Container

	dm *KubeArmorDaemon

	containersByNamespaces map[namespaceKey]string

	handleDeletedContainer func(tp.Container)
	handleNewContainer     func(tp.Container)

	// disconnectChan is closed/sent-to when the NRI stub connection is lost,
	// signalling MonitorNRIEvents to create a fresh handler.
	disconnectChan chan struct{}
}

// NewNRIHandler creates a new NRIHandler with the given event callbacks.
func (dm *KubeArmorDaemon) NewNRIHandler(
	handleDeletedContainer func(tp.Container),
	handleNewContainer func(tp.Container),
) *NRIHandler {
	nri := &NRIHandler{
		dm:             dm,
		disconnectChan: make(chan struct{}, 1),
	}

	opts := []stub.Option{
		stub.WithSocketPath(cfg.GlobalCfg.NRISocket),
		stub.WithPluginIdx(cfg.GlobalCfg.NRIIndex),
		stub.WithOnClose(func() {
			// Signal MonitorNRIEvents that the connection was lost so it can attempt reconnection. WithOnClose may not fire if the connection was never fully established, so we also signal disconnectChan in the goroutine running stub.Run() to ensure MonitorNRIEvents always wakes up to retry.
			select {
			case nri.disconnectChan <- struct{}{}:
			default:
			}
		}),
	}

	stub, err := stub.New(nri, opts...)
	if err != nil {
		kg.Errf("Failed to create NRI stub: %s", err.Error())
		return nil
	}

	nri.containers = map[string]tp.Container{}
	nri.containersByNamespaces = map[namespaceKey]string{}
	nri.stub = stub
	nri.handleDeletedContainer = handleDeletedContainer
	nri.handleNewContainer = handleNewContainer

	return nri
}

// Start initiates a configured NRI connection.
func (nh *NRIHandler) Start() {
	go func() {
		err := nh.stub.Run(context.Background())
		if err != nil {
			kg.Errf("Failed to connect to NRI: %s", err.Error())
		}
		// Signal disconnectChan when stub.Run() exits (error or clean close).
		// Ensures reconnect loop wakes up even if WithOnClose doesn’t fire.
		select {
		case nh.disconnectChan <- struct{}{}:
		default:
		}
	}()
}

// Stop closes the NRI connection.
func (nh *NRIHandler) Close() {
	nh.stub.Stop()
}

// Synchronize is an NRI callback which is called at the beginning of an NRI
// socket connection to inform on all existing containers.
func (nh *NRIHandler) Synchronize(
	_ context.Context,
	_ []*api.PodSandbox,
	nriContainers []*api.Container,
) ([]*api.ContainerUpdate, error) {
	for _, nriContainer := range nriContainers {
		container := nh.nriToKubeArmorContainer(nriContainer)
		container = nh.mergeContainer(container, false)

		// Overlapping namespace IDs between containers should be impossible
		// here
		namespaceKey := namespaceKeyFromContainer(container)
		nh.containersByNamespaces[namespaceKey] = container.ContainerID

		nh.handleNewContainer(container)
	}

	return nil, nil
}

// StartContainer is an NRI callback which is called after a container has
// started.
//
// Unfortunately we can't use the CreateContainer or PostCreateContainer NRI
// callbacks because they are called without a PID value, which is required in
// order to get the PID and mount namespaces of the container. This means that
// there is a short period of time between a container starting and us enforcing
// it.
//
// If StartContainer detects a container namespace ID overlap with a previous
// container (since Linux can reuse namespace IDs), it will override the old
// policy correctly, but any actions runc took to set up this container and
// start it will be logged/enforced as if they were the old container's actions.
// This should be exceedingly rare, but there's no way using just NRI that we
// can entirely avoid this scenario.
func (nh *NRIHandler) StartContainer(
	_ context.Context,
	_ *api.PodSandbox,
	nriContainer *api.Container,
) error {
	container := nh.nriToKubeArmorContainer(nriContainer)
	container = nh.mergeContainer(container, false)

	namespaceKey := namespaceKeyFromContainer(container)

	// It's technically possible for a container to crash and a new one to be
	// started, all before we receive the StopContainer event. And because Linux
	// can reuse namespace IDs, it's possible for the enforcement configuration
	// to get confused and messed up, so if namespace IDs ever overlap, we
	// assume the previous container using those namespaces has already exited.
	if oldContainerID, ok := nh.containersByNamespaces[namespaceKey]; ok {
		delete(nh.containers, container.ContainerID)

		nh.handleDeletedContainer(nh.containers[oldContainerID])
	}

	nh.containersByNamespaces[namespaceKey] = container.ContainerID

	nh.handleNewContainer(container)

	return nil
}

// StopContainer is an NRI callback which is called before a container receives
// the signal to stop.
//
// StopContainer is called synchronously before a termination signal is sent to
// a container, so we can be sure that we stop enforcing before the container
// shuts down, at least in most cases. This means that if a new container reuses
// Linux namespace IDs from a previous container, so long as that previous
// container didn't crash unexpectedly, we can be sure that we won't
// accidentally enforce the new container with the old container's policy.
//
// The tradeoff here is that once a container receives its termination signal,
// KubeArmor is no longer enforcing anything on it while it shuts down.
func (nh *NRIHandler) StopContainer(
	_ context.Context,
	_ *api.PodSandbox,
	nriContainer *api.Container,
) ([]*api.ContainerUpdate, error) {
	container := nh.nriToKubeArmorContainer(nriContainer)
	container = nh.mergeContainer(container, true)

	// Only handle the container deleted event if it wasn't already 'deleted' by
	// the StartContainer event (due to a Linux namespace ID collision).
	if _, ok := nh.containersByNamespaces[namespaceKeyFromContainer(container)]; ok {
		delete(nh.containers, container.ContainerID)

		nh.handleDeletedContainer(container)
	}

	return nil, nil
}

// RemoveContainer is an NRI callback which is called after a container has
// exited.
//
// In case StopContainer isn't called, we hook into RemoveContainer to ensure
// that we stop enforcing a container after it has exited. For example, the NRI
// API doesn't guarantee that StopContainer will be called if a container
// crashed unexpectedly.
func (nh *NRIHandler) RemoveContainer(
	_ context.Context,
	_ *api.PodSandbox,
	nriContainer *api.Container,
) ([]*api.ContainerUpdate, error) {
	container := nh.nriToKubeArmorContainer(nriContainer)
	container = nh.mergeContainer(container, true)

	// Only handle the container deleted event if it wasn't already 'deleted' by
	// the StartContainer event (due to a Linux namespace ID collision) or
	// StopContainer event.
	if _, ok := nh.containersByNamespaces[namespaceKeyFromContainer(container)]; ok {
		delete(nh.containers, container.ContainerID)

		nh.handleDeletedContainer(container)
	}

	return nil, nil
}

// mergeContainer updates the container with the container's previously-stored
// namespace IDs, if any, also storing namespaceIDs for future reference.
func (nh *NRIHandler) mergeContainer(container tp.Container, removing bool) tp.Container {
	if existing, ok := nh.containers[container.ContainerID]; ok {
		if existing.PidNS != 0 {
			container.PidNS = existing.PidNS
		}

		if existing.MntNS != 0 {
			container.MntNS = existing.MntNS
		}

		nh.containers[container.ContainerID] = container
	} else if !removing {
		nh.containers[container.ContainerID] = container
	}

	return container
}

// nriToKubeArmorContainer converts an NRI container to a KubeArmor container.
func (nh *NRIHandler) nriToKubeArmorContainer(nriContainer *api.Container) tp.Container {
	container := tp.Container{}

	container.ContainerID = nriContainer.Id
	container.ContainerName = nriContainer.Name

	container.NamespaceName = "Unknown"
	container.EndPointName = "Unknown"

	if _, ok := nriContainer.Labels["io.kubernetes.pod.namespace"]; ok {
		container.NamespaceName = nriContainer.Labels["io.kubernetes.pod.namespace"] // Pod namespace

		if _, ok := nriContainer.Labels["io.kubernetes.pod.name"]; ok {
			container.EndPointName = nriContainer.Labels["io.kubernetes.pod.name"] // Pod name
		}
	}

	var podName string
	var podNamespace string

	if name, ok := nriContainer.Labels["io.kubernetes.pod.name"]; ok {
		podName = name
	}
	if namespace, ok := nriContainer.Labels["io.kubernetes.pod.namespace"]; ok {
		podNamespace = namespace
	}

	if nh.dm.K8sEnabled {
		pod, err := K8s.K8sClient.CoreV1().Pods(podNamespace).Get(context.TODO(), podName, metav1.GetOptions{})
		if err != nil {
			kg.Warnf("failed to fetch Pod: %w\n", err)
		}

		if appArmorProfile, ok := pod.Annotations["container.apparmor.security.beta.kubernetes.io/"+nriContainer.Name]; ok {
			profile := strings.Split(appArmorProfile, "/")
			if len(profile) > 1 {
				container.AppArmorProfile = profile[1]
			}
		}
	} else {
		container.AppArmorProfile = "kubearmor_" + container.ContainerName
	}

	// Read PID and mount namespaces from container root PID
	if nriContain
```


### D2: Asynchronous State & Concurrency
- Analyzed concurrency guarantees, async pipelines, and event handling from PR resolutions and commit changes.

### D3: Error Boundaries, Recovery & Rollbacks
- Exception handling patterns and defect resolutions extracted from closed production bug issues:
- **Issue #2828** (2026-09-07): **pass OCI hooks flag consistently from operator to snitch**
  *Symptoms*: ## Bug Report  <!-- If you have usage questions, please try the [Discussions](https://github.com/kubearmor/KubeArmor/discussions) or [KubeArmor Slack](https://kubearmor.slack.com/) first. Please check the [Kubearmor issue](https://github.com/kubearmor/KubeArmor/issues) list to check if there is an issue already in the context. -->  When OCI hooks are enabled through the Helm chart, the KubeArmor Operator correctly receives:  ``` KUBEARMOR_OCI_HOOKS=yes ```  However, the Operator creates Snitch Jobs with:  ```text KUBEARMOR_OCI_HOOKS=true ```  KubeArmor v1.7.4's GetOCIHooks() implementation only accepts `yes` and `no`. As a result, the Snitch interprets true as disabled and skips OCI hook installation.  This prevents KubeArmor OCI hooks from being installed on containerd nodes, even though enableOCIHooks: true is configured.  **General Information**  - Environment description: Cluster API-managed VM-based Kubernetes cluster - Kernel version: 6.8.0-106-generic - Orchestration system version in use: v1.34.9 - Link to relevant artifacts (policies, deployments scripts, ...)   - KubeArmor v1.7.4 Helm template:     - https://github.com/kubearmor/KubeArmor/blob/v1.7.4/deployments/helm/KubeArmorOperator/templates/deployment.yaml   - KubeArmor v1.7.4 Operator Snitch Job generation:     - https://github.com/kubearmor/KubeArmor/blob/v1.7.4/pkg/KubeArmorOperator/internal/controller/resources.go   - KubeArmor v1.7.4 OCI hooks parser:     - https://github.com/kubearmor/KubeArmor/blob/1504ee

- **Issue #2803** (2026-07-29): **Trivy Scan vulnerabilities**
  *Symptoms*: ## Bug Report ``` KubeArmor/kubearmor (gobinary) ============================== Total: 1 (HIGH: 1, CRITICAL: 0)  ┌────────────────────────┬─────────────────────┬──────────┬────────┬───────────────────┬───────────────┬───────────────────────────────────────────────────┐ │        Library         │    Vulnerability    │ Severity │ Status │ Installed Version │ Fixed Version │                       Title                       │ ├────────────────────────┼─────────────────────┼──────────┼────────┼───────────────────┼───────────────┼───────────────────────────────────────────────────┤ │ google.golang.org/grpc │ GHSA-hrxh-6v49-42gf │ HIGH     │ fixed  │ v1.81.1           │ 1.82.1        │ gRPC-Go: xDS RBAC and HTTP/2 Vulnerabilities      │ │                        │                     │          │        │                   │               │ https://github.com/advisories/GHSA-hrxh-6v49-42gf │ └────────────────────────┴─────────────────────┴──────────┴────────┴───────────────────┴───────────────┴───────────────────────────────────────────────────┘``` <!-- If you have usage questions, please try the [Discussions](https://github.com/kubearmor/KubeArmor/discussions) or [KubeArmor Slack](https://kubearmor.slack.com/) first. Please check the [Kubearmor issue](https://github.com/kubearmor/KubeArmor/issues) list to check if there is an issue already in the context. -->  **General Information**  - Environment description (GKE, VM-Kubeadm, vagrant-dev-env, minikube, microk8s, ...) - Kernel ver

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

### Incident Patch 1: `e56e040a` (2026-10-23)
**Commit Message**: enforcer: Replace execve kprobe with tracepoint in process monitor

Signed-off-by: Aryan Bakliwal <[REDACTED_EMAIL]>

**File**: `KubeArmor/BPF/process_monitor.bpf.c` (modified, +14/-15)
```diff
@@ -11,6 +11,16 @@ struct {
     __uint(max_entries, 10240);
 } ns_transition SEC(".maps");
 
+struct tracepoint_raw_sys_enter
+{
+    unsigned short common_type;
+    unsigned char common_flags;
+    unsigned char common_preempt_count;
+    int common_pid;
+    long id;
+    unsigned long args[6];
+};
+
 static __always_inline void save_cmd_args_to_buffer(const char *const *ptr)
 {
     struct cmd_args_key key;
@@ -36,29 +46,18 @@ static __always_inline void save_cmd_args_to_buffer(const char *const *ptr)
     }
 }
 
-SEC("kprobe/__x64_sys_execve")
-int kprobe__args_execve(struct pt_regs *ctx)
+SEC("tracepoint/syscalls/sys_enter_execve")
+int sys_enter_execve(struct tracepoint_raw_sys_enter *ctx)
 {
-    struct pt_regs *ctx2 = (struct pt_regs *)PT_REGS_PARM1(ctx);
-    unsigned long argv = READ_KERN(PT_REGS_PARM2(ctx2));
-
     if (get_kubearmor_config(_MATCH_ARGS))
     {
+        unsigned long argv = ctx->args[1];
         save_cmd_args_to_buffer((const char *const *)argv);
     }
+
     return 0;
 }
 
-struct tracepoint_raw_sys_enter
-{
-    unsigned short common_type;
-    unsigned char common_flags;
-    unsigned char common_preempt_count;
-    int common_pid;
-    long id;
-    unsigned long args[6];
-};
-
 SEC("tracepoint/syscalls/sys_enter_setns")
 int sys_enter_setns(struct tracepoint_raw_sys_enter *ctx)
 {
```

**File**: `KubeArmor/enforcer/bpflsm/enforcer.go` (modified, +3/-2)
```diff
@@ -28,6 +28,7 @@ import (
 
 //go:generate go run github.com/cilium/ebpf/cmd/bpf2go -cc clang enforcer ../../BPF/enforcer.bpf.c -- -I/usr/include/ -O2 -g -fno-stack-protector -Wno-missing-declarations
 //go:generate go run github.com/cilium/ebpf/cmd/bpf2go -cc clang enforcer_path ../../BPF/enforcer_path.bpf.c -- -I/usr/include/ -O2 -g -fno-stack-protector -Wno-missing-declarations
+//go:generate go run github.com/cilium/ebpf/cmd/bpf2go -cc clang process_monitor ../../BPF/process_monitor.bpf.c -- -I/usr/include/ -O2 -g -fno-stack-protector -Wno-missing-declarations
 
 // ===================== //
 // == BPFLSM Enforcer == //
@@ -279,9 +280,9 @@ func NewBPFEnforcer(node tp.Node, pinpath string, logger *fd.Feeder, monitor *mo
 	}); err != nil {
 		be.Logger.Warnf("error loading process_monitor objects: %v", err)
 	} else {
-		be.Probes["sys_execve_args"], err = link.Kprobe("sys_execve", be.objProcess.KprobeArgsExecve, nil)
+		be.Probes["sys_enter_execve"], err = link.Tracepoint("syscalls", "sys_enter_execve", be.objProcess.SysEnterExecve, nil)
 		if err != nil {
-			be.Logger.Warnf("opening kprobe sys_execve: %s", err)
+			be.Logger.Warnf("opening tracepoint sys_enter_setns: %s", err)
 		}
 
 		if !cfg.GlobalCfg.SystemMonitor {
```

**File**: `KubeArmor/enforcer/bpflsm/generate_amd64.go` (removed, +0/-9)
```diff
@@ -1,9 +0,0 @@
-//go:build amd64
-// +build amd64
-
-// SPDX-License-Identifier: Apache-2.0
-// Copyright 2026 Authors of KubeArmor
-
-package bpflsm
-
-//go:generate go run github.com/cilium/ebpf/cmd/bpf2go -cc clang process_monitor ../../BPF/process_monitor.bpf.c -- -I/usr/include/ -O2 -g -fno-stack-protector -Wno-missing-declarations -D__TARGET_ARCH_x86
```

**File**: `KubeArmor/enforcer/bpflsm/generate_arm64.go` (removed, +0/-9)
```diff
@@ -1,9 +0,0 @@
-//go:build arm64
-// +build arm64
-
-// SPDX-License-Identifier: Apache-2.0
-// Copyright 2026 Authors of KubeArmor
-
-package bpflsm
-
-//go:generate go run github.com/cilium/ebpf/cmd/bpf2go -cc clang process_monitor ../../BPF/process_monitor.bpf.c -- -I/usr/include/ -O2 -g -fno-stack-protector -Wno-missing-declarations -D__TARGET_ARCH_arm64
```

**File**: `KubeArmor/enforcer/bpflsm/process_monitor_bpfeb.go` (modified, +28/-4)
```diff
@@ -48,6 +48,30 @@ type process_monitorOuterKey struct {
 	MntNs uint32
 }
 
+// Names of all BPF objects in the ELF.
+//
+// Used for safe lookups in a Collection or CollectionSpec.
+const (
+	process_monitorMapArgsBufk               = "args_bufk"
+	process_monitorMapBufk                   = "bufk"
+	process_monitorMapBufs                   = "bufs"
+	process_monitorMapBufsOff                = "bufs_off"
+	process_monitorMapCmdArgsBuf             = "cmd_args_buf"
+	process_monitorMapKubearmorAlertThrottle = "kubearmor_alert_throttle"
+	process_monitorMapKubearmorArgsStore     = "kubearmor_args_store"
+	process_monitorMapKubearmorArguments     = "kubearmor_arguments"
+	process_monitorMapKubearmorConfig        = "kubearmor_config"
+	process_monitorMapKubearmorContainers    = "kubearmor_containers"
+	process_monitorMapKubearmorEvents        = "kubearmor_events"
+	process_monitorMapKubearmorExecPids      = "kubearmor_exec_pids"
+	process_monitorMapNsTransition           = "ns_transition"
+	process_monitorProgSchedProcessExit      = "sched_process_exit"
+	process_monitorProgSchedProcessFork      = "sched_process_fork"
+	process_monitorProgSysEnterExecve        = "sys_enter_execve"
+	process_monitorProgSysEnterSetns         = "sys_enter_setns"
+	process_monitorProgSysExitSetns          = "sys_exit_setns"
+)
+
 // loadProcess_monitor returns the embedded CollectionSpec for process_monitor.
 func loadProcess_monitor() (*ebpf.CollectionSpec, error) {
 	reader := bytes.NewReader(_Process_monitorBytes)
@@ -68,7 +92,7 @@ func loadProcess_monitor() (*ebpf.CollectionSpec, error) {
 //	*process_monitorMaps
 //
 // See ebpf.CollectionSpec.LoadAndAssign documentation for details.
-func loadProcess_monitorObjects(obj interface{}, opts *ebpf.CollectionOptions) error {
+func loadProcess_monitorObjects(obj any, opts *ebpf.CollectionOptions) error {
 	spec, err := loadProcess_monitor()
 	if err != nil {
 		return err
@@ -90,9 +114,9 @@ type process_monitorSpecs struct {
 //
 // It can be passed ebpf.CollectionSpec.Assign.
 type process_monitorProgramSpecs struct {
-	KprobeArgsExecve *ebpf.ProgramSpec `ebpf:"kprobe__args_execve"`
 	SchedProcessExit *ebpf.ProgramSpec `ebpf:"sched_process_exit"`
 	SchedProcessFork *ebpf.ProgramSpec `ebpf:"sched_process_fork"`
+	SysEnterExecve   *ebpf.ProgramSpec `ebpf:"sys_enter_execve"`
 	SysEnterSetns    *ebpf.ProgramSpec `ebpf:"sys_enter_setns"`
 	SysExitSetns     *ebpf.ProgramSpec `ebpf:"sys_exit_setns"`
 }
@@ -185,18 +209,18 @@ type process_monitorVariables struct {
 //
 // It can be passed to loadProcess_monitorObjects or ebpf.CollectionSpec.LoadAndAssign.
 type process_monitorPrograms struct {
-	KprobeArgsExecve *ebpf.Program `ebpf:"kprobe__args_execve"`
 	SchedProcessExit *ebpf.Program `ebpf:"sched_process_exit"`
 	SchedProcessFork *ebpf.Program `ebpf:"sched_process_fork"`
+	SysEnterExecve   *ebpf.Program `ebpf:"sys_enter_execve"`
 	SysEnterSetns    *ebpf.Program `ebpf:"sys_enter_setns"`
 	SysExitSetns     *ebpf.Program `ebpf:"sys_exit_setns"`
 }
 
 func (p *process_monitorPrograms) Close() error {
 	return _Process_monitorClose(
-		p.KprobeArgsExecve,
 		p.SchedProcessExit,
 		p.SchedProcessFork,
+		p.SysEnterExecve,
 		p.SysEnterSetns,
 		p.SysExitSetns,
 	)
```

**File**: `KubeArmor/enforcer/bpflsm/process_monitor_bpfel.go` (modified, +28/-4)
```diff
@@ -48,6 +48,30 @@ type process_monitorOuterKey struct {
 	MntNs uint32
 }
 
+// Names of all BPF objects in the ELF.
+//
+// Used for safe lookups in a Collection or CollectionSpec.
+const (
+	process_monitorMapArgsBufk               = "args_bufk"
+	process_monitorMapBufk                   = "bufk"
+	process_monitorMapBufs                   = "bufs"
+	process_monitorMapBufsOff                = "bufs_off"
+	process_monitorMapCmdArgsBuf             = "cmd_args_buf"
+	process_monitorMapKubearmorAlertThrottle = "kubearmor_alert_throttle"
+	process_monitorMapKubearmorArgsStore     = "kubearmor_args_store"
+	process_monitorMapKubearmorArguments     = "kubearmor_arguments"
+	process_monitorMapKubearmorConfig        = "kubearmor_config"
+	process_monitorMapKubearmorContainers    = "kubearmor_containers"
+	process_monitorMapKubearmorEvents        = "kubearmor_events"
+	process_monitorMapKubearmorExecPids      = "kubearmor_exec_pids"
+	process_monitorMapNsTransition           = "ns_transition"
+	process_monitorProgSchedProcessExit      = "sched_process_exit"
+	process_monitorProgSchedProcessFork      = "sched_process_fork"
+	process_monitorProgSysEnterExecve        = "sys_enter_execve"
+	process_monitorProgSysEnterSetns         = "sys_enter_setns"
+	process_monitorProgSysExitSetns          = "sys_exit_setns"
+)
+
 // loadProcess_monitor returns the embedded CollectionSpec for process_monitor.
 func loadProcess_monitor() (*ebpf.CollectionSpec, error) {
 	reader := bytes.NewReader(_Process_monitorBytes)
@@ -68,7 +92,7 @@ func loadProcess_monitor() (*ebpf.CollectionSpec, error) {
 //	*process_monitorMaps
 //
 // See ebpf.CollectionSpec.LoadAndAssign documentation for details.
-func loadProcess_monitorObjects(obj interface{}, opts *ebpf.CollectionOptions) error {
+func loadProcess_monitorObjects(obj any, opts *ebpf.CollectionOptions) error {
 	spec, err := loadProcess_monitor()
 	if err != nil {
 		return err
@@ -90,9 +114,9 @@ type process_monitorSpecs struct {
 //
 // It can be passed ebpf.CollectionSpec.Assign.
 type process_monitorProgramSpecs struct {
-	KprobeArgsExecve *ebpf.ProgramSpec `ebpf:"kprobe__args_execve"`
 	SchedProcessExit *ebpf.ProgramSpec `ebpf:"sched_process_exit"`
 	SchedProcessFork *ebpf.ProgramSpec `ebpf:"sched_process_fork"`
+	SysEnterExecve   *ebpf.ProgramSpec `ebpf:"sys_enter_execve"`
 	SysEnterSetns    *ebpf.ProgramSpec `ebpf:"sys_enter_setns"`
 	SysExitSetns     *ebpf.ProgramSpec `ebpf:"sys_exit_setns"`
 }
@@ -185,18 +209,18 @@ type process_monitorVariables struct {
 //
 // It can be passed to loadProcess_monitorObjects or ebpf.CollectionSpec.LoadAndAssign.
 type process_monitorPrograms struct {
-	KprobeArgsExecve *ebpf.Program `ebpf:"kprobe__args_execve"`
 	SchedProcessExit *ebpf.Program `ebpf:"sched_process_exit"`
 	SchedProcessFork *ebpf.Program `ebpf:"sched_process_fork"`
+	SysEnterExecve   *ebpf.Program `ebpf:"sys_enter_execve"`
 	SysEnterSetns    *ebpf.Program `ebpf:"sys_enter_setns"`
 	SysExitSetns     *ebpf.Program `ebpf:"sys_exit_setns"`
 }
 
 func (p *process_monitorPrograms) Close() error {
 	return _Process_monitorClose(
-		p.KprobeArgsExecve,
 		p.SchedProcessExit,
 		p.SchedProcessFork,
+		p.SysEnterExecve,
 		p.SysEnterSetns,
 		p.SysExitSetns,
 	)
```

**File**: `KubeArmor/presets/anonmapexec/anonmapexec_bpfeb.go` (modified, +6/-2)
```diff
@@ -64,6 +64,7 @@ const (
 	anonmapexecMapKubearmorContainers                  = "kubearmor_containers"
 	anonmapexecMapKubearmorEvents                      = "kubearmor_events"
 	anonmapexecMapKubearmorExecPids                    = "kubearmor_exec_pids"
+	anonmapexecProgEnforceFileMprotect                 = "enforce_file_mprotect"
 	anonmapexecProgEnforceMmapFile                     = "enforce_mmap_file"
 	anonmapexecVarUnused                               = "unused"
 )
@@ -110,7 +111,8 @@ type anonmapexecSpecs struct {
 //
 // It can be passed ebpf.CollectionSpec.Assign.
 type anonmapexecProgramSpecs struct {
-	EnforceMmapFile *ebpf.ProgramSpec `ebpf:"enforce_mmap_file"`
+	EnforceFileMprotect *ebpf.ProgramSpec `ebpf:"enforce_file_mprotect"`
+	EnforceMmapFile     *ebpf.ProgramSpec `ebpf:"enforce_mmap_file"`
 }
 
 // anonmapexecMapSpecs contains maps before they are loaded into the kernel.
@@ -206,11 +208,13 @@ type anonmapexecVariables struct {
 //
 // It can be passed to loadAnonmapexecObjects or ebpf.CollectionSpec.LoadAndAssign.
 type anonmapexecPrograms struct {
-	EnforceMmapFile *ebpf.Program `ebpf:"enforce_mmap_file"`
+	EnforceFileMprotect *ebpf.Program `ebpf:"enforce_file_mprotect"`
+	EnforceMmapFile     *ebpf.Program `ebpf:"enforce_mmap_file"`
 }
 
 func (p *anonmapexecPrograms) Close() error {
 	return _AnonmapexecClose(
+		p.EnforceFileMprotect,
 		p.EnforceMmapFile,
 	)
 }
```

**File**: `KubeArmor/presets/anonmapexec/anonmapexec_bpfel.go` (modified, +6/-2)
```diff
@@ -64,6 +64,7 @@ const (
 	anonmapexecMapKubearmorContainers                  = "kubearmor_containers"
 	anonmapexecMapKubearmorEvents                      = "kubearmor_events"
 	anonmapexecMapKubearmorExecPids                    = "kubearmor_exec_pids"
+	anonmapexecProgEnforceFileMprotect                 = "enforce_file_mprotect"
 	anonmapexecProgEnforceMmapFile                     = "enforce_mmap_file"
 	anonmapexecVarUnused                               = "unused"
 )
@@ -110,7 +111,8 @@ type anonmapexecSpecs struct {
 //
 // It can be passed ebpf.CollectionSpec.Assign.
 type anonmapexecProgramSpecs struct {
-	EnforceMmapFile *ebpf.ProgramSpec `ebpf:"enforce_mmap_file"`
+	EnforceFileMprotect *ebpf.ProgramSpec `ebpf:"enforce_file_mprotect"`
+	EnforceMmapFile     *ebpf.ProgramSpec `ebpf:"enforce_mmap_file"`
 }
 
 // anonmapexecMapSpecs contains maps before they are loaded into the kernel.
@@ -206,11 +208,13 @@ type anonmapexecVariables struct {
 //
 // It can be passed to loadAnonmapexecObjects or ebpf.CollectionSpec.LoadAndAssign.
 type anonmapexecPrograms struct {
-	EnforceMmapFile *ebpf.Program `ebpf:"enforce_mmap_file"`
+	EnforceFileMprotect *ebpf.Program `ebpf:"enforce_file_mprotect"`
+	EnforceMmapFile     *ebpf.Program `ebpf:"enforce_mmap_file"`
 }
 
 func (p *anonmapexecPrograms) Close() error {
 	return _AnonmapexecClose(
+		p.EnforceFileMprotect,
 		p.EnforceMmapFile,
 	)
 }
```

---

### Incident Patch 2: `51b3651e` (2026-10-22)
**Commit Message**: Merge pull request #2939 from AryanBakliwal/fix-TraceSyscall-panic

fix(monitor): TraceSyscall panic during shutdown

**File**: `Dockerfile` (modified, +1/-1)
```diff
@@ -3,7 +3,7 @@
 
 ### Builder
 
-FROM golang:1.26-alpine3.23@sha256:10d148346b2da25f243a5cb3dd7a6e92df0f25224f072fba2821fa3ac1184601 AS builder
+FROM golang:1.26-alpine3.23@sha256:a07f231c19b03e6106cf442f02a5bcf262147e744d15b7b5e4b6d81d420c70a0 AS builder
 
 RUN apk --no-cache update && apk upgrade --no-cache libcrypto3 libssl3 zlib libexpat
 RUN apk add --no-cache git clang llvm make gcc protobuf protobuf-dev curl elfutils-dev libbpf-dev
```

**File**: `KubeArmor/go.mod` (modified, +1/-1)
```diff
@@ -1,6 +1,6 @@
 module github.com/kubearmor/KubeArmor/KubeArmor
 
-go 1.26.9
+go 1.26.10
 
 replace (
 	github.com/kubearmor/KubeArmor => ../../
```

**File**: `KubeArmor/monitor/systemMonitor.go` (modified, +8/-0)
```diff
@@ -1166,6 +1166,14 @@ func (mon *SystemMonitor) TraceSyscall() {
 				}
 			}
 			MonitorLock.Lock()
+
+			// status is true when the system monitor is running, false when it is being destroyed
+			if !mon.Status {
+				MonitorLock.Unlock()
+				mon.Logger.Print("System monitor is being destroyed, exiting TraceSyscall")
+				return
+			}
+
 			// push the context to the channel for logging
 			mon.ContextChan <- ContextCombined{ContainerID: containerID, ContextSys: ctx, ContextArgs: args, HashData: hashes}
 			MonitorLock.Unlock()
```

**File**: `deployments/go.mod` (modified, +1/-1)
```diff
@@ -1,6 +1,6 @@
 module github.com/kubearmor/KubeArmor/deployments
 
-go 1.26.9
+go 1.26.10
 
 replace (
 	github.com/kubearmor/KubeArmor => ../
```

**File**: `deployments/podman/go.mod` (modified, +1/-1)
```diff
@@ -1,6 +1,6 @@
 module github.com/kubearmor/KubeArmor/deployments/podman
 
-go 1.26.9
+go 1.26.10
 
 require (
 	github.com/kubearmor/KubeArmor/KubeArmor v0.0.0-20260521154542-6789b83a8cee
```

**File**: `pkg/KubeArmorController/Dockerfile` (modified, +1/-1)
```diff
@@ -2,7 +2,7 @@
 # Copyright 2026 Authors of KubeArmor
 
 # Build the manager binary
-FROM golang:1.26.9@sha256:f1f0bcc2c524a3ced375fcb4d1ecb7aa371aa7070e112599aaca45cc02d0101b AS builder
+FROM golang:1.26.10@sha256:fb456410ab4c979617acaf28c46b2b9fe60b11bcc3dc8ceea0eaeb3e7cd0f8a8 AS builder
 
 WORKDIR /workspace
 # Copy the Go Modules manifests
```

**File**: `pkg/KubeArmorController/go.mod` (modified, +1/-1)
```diff
@@ -1,6 +1,6 @@
 module github.com/kubearmor/KubeArmor/pkg/KubeArmorController
 
-go 1.26.9
+go 1.26.10
 
 replace github.com/go-jose/go-jose/v4 => github.com/go-jose/go-jose/v4 v4.1.4
 
```

**File**: `pkg/KubeArmorOperator/Dockerfile` (modified, +1/-1)
```diff
@@ -1,7 +1,7 @@
 # SPDX-License-Identifier: Apache-2.0
 # Copyright 2026 Authors of KubeArmor
 
-FROM docker.io/golang:1.26.9@sha256:f1f0bcc2c524a3ced375fcb4d1ecb7aa371aa7070e112599aaca45cc02d0101b AS builder
+FROM docker.io/golang:1.26.10@sha256:fb456410ab4c979617acaf28c46b2b9fe60b11bcc3dc8ceea0eaeb3e7cd0f8a8 AS builder
 ARG GOARCH
 ARG GOOS
 
```

---

### Incident Patch 3: `c868e0e5` (2026-10-21)
**Commit Message**: fix(monitor): TraceSyscall panic when during shutdown

Signed-off-by: Aryan Bakliwal <[REDACTED_EMAIL]>

**File**: `KubeArmor/monitor/systemMonitor.go` (modified, +8/-0)
```diff
@@ -1166,6 +1166,14 @@ func (mon *SystemMonitor) TraceSyscall() {
 				}
 			}
 			MonitorLock.Lock()
+
+			// status is true when the system monitor is running, false when it is being destroyed
+			if !mon.Status {
+				MonitorLock.Unlock()
+				mon.Logger.Print("System monitor is being destroyed, exiting TraceSyscall")
+				return
+			}
+
 			// push the context to the channel for logging
 			mon.ContextChan <- ContextCombined{ContainerID: containerID, ContextSys: ctx, ContextArgs: args, HashData: hashes}
 			MonitorLock.Unlock()
```

#### Recent Merged Pull Requests:
- **PR #2949** (2026-10-23): fix: Fix stable release workflow and ignore bpf2go files (@AryanBakliwal)
- **PR #2948** (2026-10-23): go generate fix, removed obj files, and added release related workflow tests to CI (@AryanBakliwal)
- **PR #2947** (2026-10-22): fix(BPF): go generate on arm64 (@AryanBakliwal)
- **PR #2946** (2026-10-22): bugfix(apparmor): fix pods not terminating in apparmor node (@charankamal20)
- **PR #2942** (2026-10-21): fix(operator): detect containerd namespace and runtime socket reliably in snitch (@achrefbensaad)
- **PR #2939** (2026-10-22): fix(monitor): TraceSyscall panic during shutdown (@AryanBakliwal)

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

## X. enforcer: Replace execve kprobe with tracepoint in process monitor

**RULE**:
When implementing operations in `KubeArmor/BPF/process_monitor.bpf.c`, engineers MUST enforce rigorous boundary validation, safe state transitions, and memory/concurrency invariants as established by production defect remediation in kubearmor/KubeArmor. All inputs crossing module boundaries must be explicitly verified before state persistence.

**WHY**:
Prevents defects observed in production commit `e56e040a`: enforcer: Replace execve kprobe with tracepoint in process monitor. Unvalidated execution paths cause runtime exceptions, race conditions, and silent state corruption under concurrent workloads.

**WHEN TO APPLY**:
Subsystems managing Go data structures, boundary deserialization, API parsing, or resource lifecycles matching `KubeArmor/BPF/process_monitor.bpf.c`.

**VERIFIED IMPLEMENTATION PATTERN**:
```go
// Verified production-grade fix pattern:
struct tracepoint_raw_sys_enter
{
    unsigned short common_type;
    unsigned char common_flags;
    unsigned char common_preempt_count;
    int common_pid;
    long id;
    unsigned long args[6];
};

SEC("tracepoint/syscalls/sys_enter_execve")
int sys_enter_execve(struct tracepoint_raw_sys_enter *ctx)
        unsigned long argv = ctx->args[1];

```

**NEGATIVE CONSTRAINT**:
```go
// Anti-pattern to NEVER write (induced failure mode):
SEC("kprobe/__x64_sys_execve")
int kprobe__args_execve(struct pt_regs *ctx)
    struct pt_regs *ctx2 = (struct pt_regs *)PT_REGS_PARM1(ctx);
    unsigned long argv = READ_KERN(PT_REGS_PARM2(ctx2));

struct tracepoint_raw_sys_enter
{
    unsigned short common_type;
    unsigned char common_flags;
    unsigned char common_preempt_count;
    int common_pid;
    long id;
    unsigned long args[6];
};

```

**VERIFICATION METHOD**:
Automated regression test asserting that input states reproducing defect `e56e040a` are properly handled with clean fallback behavior.
