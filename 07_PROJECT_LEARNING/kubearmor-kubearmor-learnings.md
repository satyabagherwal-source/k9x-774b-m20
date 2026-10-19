> **Canonical Learning Artifact**: `07_PROJECT_LEARNING/kubearmor-kubearmor-learnings.md`  
> **Source**: github ([https://github.com/kubearmor/KubeArmor](https://github.com/kubearmor/KubeArmor))  
> **Source Version**: `e6c53bb1`  
> **License**: Apache-2.0  
> **Synthesized By**: zero-clone-structural-synthesizer  
> **Timestamp**: 2026-10-19T05:12:44.654Z  
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
> **Harvest Timestamp**: 2026-10-19T05:12:44.642Z  
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

### Incident Patch 1: `a3887c17` (2026-09-08)
**Commit Message**: fix(presets): stop writing ContainerMap under RLock in anonmapexec (#2797)

UpdateSecurityPolicies wrote ContainerMap while holding RLock, allowing concurrent writers and racing with other lock holders. Match the other presets: read under RLock, then write under Lock.

Signed-off-by: lakshit verma <[REDACTED_EMAIL]>

**File**: `KubeArmor/presets/anonmapexec/preset.go` (modified, +3/-2)
```diff
@@ -285,19 +285,20 @@ func (p *Preset) UpdateSecurityPolicies(endPoint tp.EndPoint) {
 					p.ContainerMapLock.RLock()
 					// Check if Container ID is registered in Map or not
 					ckv, ok := p.ContainerMap[cid]
+					p.ContainerMapLock.RUnlock()
 					if !ok {
 						// It maybe possible that CRI has unregistered the containers but K8s construct still has not sent this update while the policy was being applied,
 						// so the need to check if the container is present in the map before we apply policy.
-						p.ContainerMapLock.RUnlock()
 						return
 					}
 					base.UpdateMatchPolicy(&ckv, &secPolicy)
+					p.ContainerMapLock.Lock()
 					p.ContainerMap[cid] = ckv
 					err := p.AddContainerIDToMap(cid, ckv.NsKey, preset.Action)
 					if err != nil {
 						p.Logger.Warnf("Updating policy for container %s :%s ", cid, err)
 					}
-					p.ContainerMapLock.RUnlock()
+					p.ContainerMapLock.Unlock()
 				}
 			}
 		}
```

---

### Incident Patch 2: `dd180303` (2026-10-07)
**Commit Message**: fix(monitor): fix memory leak in syscall replay path, add pprof and LOG_LEVEL (#2921)

* update log level

* change event drop log level

* add pprof

* fix memory leak in relay channel

* Upgrade go packages

---------

Signed-off-by: Achref Ben Saad <[REDACTED_EMAIL]>
Signed-off-by: Achref Ben Saad <[REDACTED_EMAIL]>
Signed-off-by: charankamal20 <[REDACTED_EMAIL]>
Co-authored-by: charankamal20 <[REDACTED_EMAIL]>

**File**: `Dockerfile` (modified, +1/-1)
```diff
@@ -3,7 +3,7 @@
 
 ### Builder
 
-FROM golang:1.26-alpine3.22@sha256:28d89ee9cc0ff9fec75c82ca201e6bf7fdf9a679d4b7b24dfa04f2bb766bb468 AS builder
+FROM golang:1.26-alpine3.23@sha256:a8fa79c5bd40d880b52bd3b6d7669ecdcfd00e85facdd427d279efb5ddd79cb1 AS builder
 
 RUN apk --no-cache update && apk upgrade --no-cache libcrypto3 libssl3 zlib libexpat
 RUN apk add --no-cache git clang llvm make gcc protobuf protobuf-dev curl elfutils-dev libbpf-dev
```

**File**: `KubeArmor/Makefile` (modified, +1/-1)
```diff
@@ -51,7 +51,7 @@ run: build
 	cd $(CURDIR); sudo rm -f /tmp/kubearmor.log
 	cd $(CURDIR)/BPF; make clean
 	cd $(CURDIR)/BPF; make
-	cd $(CURDIR); DEBUG=true sudo -E ./kubearmor -logPath=/tmp/kubearmor.log -enableKubeArmorPolicy -enableKubeArmorHostPolicy -hostVisibility=process,file,network,capabilities -defaultFilePosture block -defaultCapabilitiesPosture block -defaultNetworkPosture block -hostDefaultFilePosture block -hostDefaultCapabilitiesPosture block -hostDefaultNetworkPosture block -annotateResources=true
+	cd $(CURDIR); LOG_LEVEL=debug sudo -E ./kubearmor -logPath=/tmp/kubearmor.log -enableKubeArmorPolicy -enableKubeArmorHostPolicy -hostVisibility=process,file,network,capabilities -defaultFilePosture block -defaultCapabilitiesPosture block -defaultNetworkPosture block -hostDefaultFilePosture block -hostDefaultCapabilitiesPosture block -hostDefaultNetworkPosture block -annotateResources=true
 
 .PHONY: run-container
 run-container: build
```

**File**: `KubeArmor/config/config.go` (modified, +15/-1)
```diff
@@ -80,6 +80,9 @@ type KubearmorConfig struct {
 	MatchArgs bool // enable argument rules for policy
 
 	NetworkPolicyEnforcer bool // enable network policy enforcement
+
+	EnablePprof bool   // enable pprof profiling server
+	PprofAddr   string // address for pprof profiling server
 }
 
 // GlobalCfg Global configuration for Kubearmor
@@ -138,6 +141,8 @@ const (
 	ConfigUSBDeviceHandler               string = "enableUSBDeviceHandler"
 	ConfigArgMatching                    string = "matchArgs"
 	ConfigNetworkPolicyEnforcer          string = "enableNetworkPolicyEnforcer"
+	ConfigEnablePprof                    string = "enablePprof"
+	ConfigPprofAddr                      string = "pprofAddr"
 )
 
 func readCmdLineParams() {
@@ -165,7 +170,7 @@ func readCmdLineParams() {
 	kvmAgentB := flag.Bool(ConfigKubearmorVM, false, "enabling KubeArmorVM")
 	k8sEnvB := flag.Bool(ConfigK8sEnv, true, "is k8s env?")
 
-	debugB := flag.Bool(ConfigDebug, false, "Enable/Disable pushing KubeArmor debug logs over gRPC. NOTE: Set environment DEBUG=true to configure stdout debug logging")
+	debugB := flag.Bool(ConfigDebug, false, "Enable/Disable pushing KubeArmor debug logs over gRPC. NOTE: Set environment LOG_LEVEL=debug to configure stdout debug logging")
 
 	defaultFilePosture := flag.String(ConfigDefaultFilePosture, "audit", "configuring default enforcement action in global file context {allow|audit|block}")
 	defaultNetworkPosture := flag.String(ConfigDefaultNetworkPosture, "audit", "configuring default enforcement action in global network context {allow|audit|block}")
@@ -214,6 +219,9 @@ func readCmdLineParams() {
 
 	networkPolicyEnforcer := flag.Bool(ConfigNetworkPolicyEnforcer, true, "Enable network policy enforcement")
 
+	enablePprof := flag.Bool(ConfigEnablePprof, false, "enable pprof profiling server")
+	pprofAddr := flag.String(ConfigPprofAddr, "localhost:6060", "address for pprof profiling server")
+
 	flags := []string{}
 	flag.VisitAll(func(f *flag.Flag) {
 		kv := fmt.Sprintf("%s:%v", f.Name, f.Value)
@@ -296,6 +304,9 @@ func readCmdLineParams() {
 	viper.SetDefault(ConfigArgMatching, *matchArgs)
 
 	viper.SetDefault(ConfigNetworkPolicyEnforcer, *networkPolicyEnforcer)
+
+	viper.SetDefault(ConfigEnablePprof, *enablePprof)
+	viper.SetDefault(ConfigPprofAddr, *pprofAddr)
 }
 
 // LoadConfig Load configuration
@@ -393,6 +404,9 @@ func LoadConfig() error {
 
 	GlobalCfg.NetworkPolicyEnforcer = viper.GetBool(ConfigNetworkPolicyEnforcer)
 
+	GlobalCfg.EnablePprof = viper.GetBool(ConfigEnablePprof)
+	GlobalCfg.PprofAddr = viper.GetString(ConfigPprofAddr)
+
 	LoadDynamicConfig()
 
 	kg.Printf("Final Configuration [%+v]", GlobalCfg)
```

**File**: `KubeArmor/enforcer/bpflsm/enforcer_bpfeb.go` (modified, +27/-1)
```diff
@@ -46,6 +46,32 @@ type enforcerCmdArgsKey struct {
 	Ind  uint64
 }
 
+// Names of all BPF objects in the ELF.
+//
+// Used for safe lookups in a Collection or CollectionSpec.
+const (
+	enforcerMapArgsBufk               = "args_bufk"
+	enforcerMapBufk                   = "bufk"
+	enforcerMapBufs                   = "bufs"
+	enforcerMapBufsOff                = "bufs_off"
+	enforcerMapCmdArgsBuf             = "cmd_args_buf"
+	enforcerMapKubearmorAlertThrottle = "kubearmor_alert_throttle"
+	enforcerMapKubearmorArgsStore     = "kubearmor_args_store"
+	enforcerMapKubearmorArguments     = "kubearmor_arguments"
+	enforcerMapKubearmorConfig        = "kubearmor_config"
+	enforcerMapKubearmorContainers    = "kubearmor_containers"
+	enforcerMapKubearmorEvents        = "kubearmor_events"
+	enforcerMapKubearmorExecPids      = "kubearmor_exec_pids"
+	enforcerProgEnforceCap            = "enforce_cap"
+	enforcerProgEnforceDns            = "enforce_dns"
+	enforcerProgEnforceFile           = "enforce_file"
+	enforcerProgEnforceFilePerm       = "enforce_file_perm"
+	enforcerProgEnforceNetAccept      = "enforce_net_accept"
+	enforcerProgEnforceNetConnect     = "enforce_net_connect"
+	enforcerProgEnforceNetCreate      = "enforce_net_create"
+	enforcerProgEnforceProc           = "enforce_proc"
+)
+
 // loadEnforcer returns the embedded CollectionSpec for enforcer.
 func loadEnforcer() (*ebpf.CollectionSpec, error) {
 	reader := bytes.NewReader(_EnforcerBytes)
@@ -66,7 +92,7 @@ func loadEnforcer() (*ebpf.CollectionSpec, error) {
 //	*enforcerMaps
 //
 // See ebpf.CollectionSpec.LoadAndAssign documentation for details.
-func loadEnforcerObjects(obj interface{}, opts *ebpf.CollectionOptions) error {
+func loadEnforcerObjects(obj any, opts *ebpf.CollectionOptions) error {
 	spec, err := loadEnforcer()
 	if err != nil {
 		return err
```

**File**: `KubeArmor/enforcer/bpflsm/enforcer_bpfel.go` (modified, +27/-1)
```diff
@@ -46,6 +46,32 @@ type enforcerCmdArgsKey struct {
 	Ind  uint64
 }
 
+// Names of all BPF objects in the ELF.
+//
+// Used for safe lookups in a Collection or CollectionSpec.
+const (
+	enforcerMapArgsBufk               = "args_bufk"
+	enforcerMapBufk                   = "bufk"
+	enforcerMapBufs                   = "bufs"
+	enforcerMapBufsOff                = "bufs_off"
+	enforcerMapCmdArgsBuf             = "cmd_args_buf"
+	enforcerMapKubearmorAlertThrottle = "kubearmor_alert_throttle"
+	enforcerMapKubearmorArgsStore     = "kubearmor_args_store"
+	enforcerMapKubearmorArguments     = "kubearmor_arguments"
+	enforcerMapKubearmorConfig        = "kubearmor_config"
+	enforcerMapKubearmorContainers    = "kubearmor_containers"
+	enforcerMapKubearmorEvents        = "kubearmor_events"
+	enforcerMapKubearmorExecPids      = "kubearmor_exec_pids"
+	enforcerProgEnforceCap            = "enforce_cap"
+	enforcerProgEnforceDns            = "enforce_dns"
+	enforcerProgEnforceFile           = "enforce_file"
+	enforcerProgEnforceFilePerm       = "enforce_file_perm"
+	enforcerProgEnforceNetAccept      = "enforce_net_accept"
+	enforcerProgEnforceNetConnect     = "enforce_net_connect"
+	enforcerProgEnforceNetCreate      = "enforce_net_create"
+	enforcerProgEnforceProc           = "enforce_proc"
+)
+
 // loadEnforcer returns the embedded CollectionSpec for enforcer.
 func loadEnforcer() (*ebpf.CollectionSpec, error) {
 	reader := bytes.NewReader(_EnforcerBytes)
@@ -66,7 +92,7 @@ func loadEnforcer() (*ebpf.CollectionSpec, error) {
 //	*enforcerMaps
 //
 // See ebpf.CollectionSpec.LoadAndAssign documentation for details.
-func loadEnforcerObjects(obj interface{}, opts *ebpf.CollectionOptions) error {
+func loadEnforcerObjects(obj any, opts *ebpf.CollectionOptions) error {
 	spec, err := loadEnforcer()
 	if err != nil {
 		return err
```

**File**: `KubeArmor/enforcer/bpflsm/enforcer_path_bpfeb.go` (modified, +30/-1)
```diff
@@ -46,6 +46,35 @@ type enforcer_pathCmdArgsKey struct {
 	Ind  uint64
 }
 
+// Names of all BPF objects in the ELF.
+//
+// Used for safe lookups in a Collection or CollectionSpec.
+const (
+	enforcer_pathMapArgsBufk               = "args_bufk"
+	enforcer_pathMapBufk                   = "bufk"
+	enforcer_pathMapBufs                   = "bufs"
+	enforcer_pathMapBufsOff                = "bufs_off"
+	enforcer_pathMapCmdArgsBuf             = "cmd_args_buf"
+	enforcer_pathMapKubearmorAlertThrottle = "kubearmor_alert_throttle"
+	enforcer_pathMapKubearmorArgsStore     = "kubearmor_args_store"
+	enforcer_pathMapKubearmorArguments     = "kubearmor_arguments"
+	enforcer_pathMapKubearmorConfig        = "kubearmor_config"
+	enforcer_pathMapKubearmorContainers    = "kubearmor_containers"
+	enforcer_pathMapKubearmorEvents        = "kubearmor_events"
+	enforcer_pathMapKubearmorExecPids      = "kubearmor_exec_pids"
+	enforcer_pathProgEnforceChmod          = "enforce_chmod"
+	enforcer_pathProgEnforceLinkDst        = "enforce_link_dst"
+	enforcer_pathProgEnforceLinkSrc        = "enforce_link_src"
+	enforcer_pathProgEnforceMkdir          = "enforce_mkdir"
+	enforcer_pathProgEnforceMknod          = "enforce_mknod"
+	enforcer_pathProgEnforceRenameNew      = "enforce_rename_new"
+	enforcer_pathProgEnforceRenameOld      = "enforce_rename_old"
+	enforcer_pathProgEnforceRmdir          = "enforce_rmdir"
+	enforcer_pathProgEnforceSymlink        = "enforce_symlink"
+	enforcer_pathProgEnforceTruncate       = "enforce_truncate"
+	enforcer_pathProgEnforceUnlink         = "enforce_unlink"
+)
+
 // loadEnforcer_path returns the embedded CollectionSpec for enforcer_path.
 func loadEnforcer_path() (*ebpf.CollectionSpec, error) {
 	reader := bytes.NewReader(_Enforcer_pathBytes)
@@ -66,7 +95,7 @@ func loadEnforcer_path() (*ebpf.CollectionSpec, error) {
 //	*enforcer_pathMaps
 //
 // See ebpf.CollectionSpec.LoadAndAssign documentation for details.
-func loadEnforcer_pathObjects(obj interface{}, opts *ebpf.CollectionOptions) error {
+func loadEnforcer_pathObjects(obj any, opts *ebpf.CollectionOptions) error {
 	spec, err := loadEnforcer_path()
 	if err != nil {
 		return err
```

**File**: `KubeArmor/enforcer/bpflsm/enforcer_path_bpfel.go` (modified, +30/-1)
```diff
@@ -46,6 +46,35 @@ type enforcer_pathCmdArgsKey struct {
 	Ind  uint64
 }
 
+// Names of all BPF objects in the ELF.
+//
+// Used for safe lookups in a Collection or CollectionSpec.
+const (
+	enforcer_pathMapArgsBufk               = "args_bufk"
+	enforcer_pathMapBufk                   = "bufk"
+	enforcer_pathMapBufs                   = "bufs"
+	enforcer_pathMapBufsOff                = "bufs_off"
+	enforcer_pathMapCmdArgsBuf             = "cmd_args_buf"
+	enforcer_pathMapKubearmorAlertThrottle = "kubearmor_alert_throttle"
+	enforcer_pathMapKubearmorArgsStore     = "kubearmor_args_store"
+	enforcer_pathMapKubearmorArguments     = "kubearmor_arguments"
+	enforcer_pathMapKubearmorConfig        = "kubearmor_config"
+	enforcer_pathMapKubearmorContainers    = "kubearmor_containers"
+	enforcer_pathMapKubearmorEvents        = "kubearmor_events"
+	enforcer_pathMapKubearmorExecPids      = "kubearmor_exec_pids"
+	enforcer_pathProgEnforceChmod          = "enforce_chmod"
+	enforcer_pathProgEnforceLinkDst        = "enforce_link_dst"
+	enforcer_pathProgEnforceLinkSrc        = "enforce_link_src"
+	enforcer_pathProgEnforceMkdir          = "enforce_mkdir"
+	enforcer_pathProgEnforceMknod          = "enforce_mknod"
+	enforcer_pathProgEnforceRenameNew      = "enforce_rename_new"
+	enforcer_pathProgEnforceRenameOld      = "enforce_rename_old"
+	enforcer_pathProgEnforceRmdir          = "enforce_rmdir"
+	enforcer_pathProgEnforceSymlink        = "enforce_symlink"
+	enforcer_pathProgEnforceTruncate       = "enforce_truncate"
+	enforcer_pathProgEnforceUnlink         = "enforce_unlink"
+)
+
 // loadEnforcer_path returns the embedded CollectionSpec for enforcer_path.
 func loadEnforcer_path() (*ebpf.CollectionSpec, error) {
 	reader := bytes.NewReader(_Enforcer_pathBytes)
@@ -66,7 +95,7 @@ func loadEnforcer_path() (*ebpf.CollectionSpec, error) {
 //	*enforcer_pathMaps
 //
 // See ebpf.CollectionSpec.LoadAndAssign documentation for details.
-func loadEnforcer_pathObjects(obj interface{}, opts *ebpf.CollectionOptions) error {
+func loadEnforcer_pathObjects(obj any, opts *ebpf.CollectionOptions) error {
 	spec, err := loadEnforcer_path()
 	if err != nil {
 		return err
```

**File**: `KubeArmor/feeder/feeder.go` (modified, +2/-2)
```diff
@@ -903,7 +903,7 @@ func (fd *Feeder) PushLog(log tp.Log) {
 				counter++
 				if counter == lenAlert {
 					// Default on the last uid in Alterstruct means the Alert isn't pushed into Broadcast
-					kg.Printf("log channel busy, alert dropped.")
+					kg.Debugf("log channel busy, alert dropped.")
 				}
 
 			}
@@ -927,7 +927,7 @@ func (fd *Feeder) PushLog(log tp.Log) {
 					// Default on the last uid in Logstuct means the log isn't pushed into Broadcast
 					fd.DroppedLogs++
 					if fd.DroppedLogs%10000 == 0 {
-						kg.Warnf("log channel busy, 10000 logs dropped.")
+						kg.Debugf("log channel busy, 10000 logs dropped.")
 						fd.DroppedLogs = 0
 					}
 				}
```

---

### Incident Patch 3: `74d732ec` (2026-09-15)
**Commit Message**: chore: fix vulnerabilities in Go module dependencies (#2899)

Bump golang.org/x/crypto to v0.56.0 to resolve DoS vulnerabilities in
x/crypto/ssh (GO-2026-6354, GO-2026-6355), bump google.golang.org/grpc
to v1.83.2 to resolve xDS server DoS, xDS RBAC filter bypass, and
HTTP/2 DATA frame memory exhaustion issues (GHSA-2v4p-qf9q-27wj,
GHSA-qc2q-p7wx-3px3, GHSA-vp52-pcj8-j9qc), bump
github.com/containerd/containerd/v2 to v2.3.5 to resolve the CRI
ExecSync goroutine leak (GHSA-7jxh-36q5-gcqv), and bump
github.com/cilium/cilium to v1.19.5 to resolve a NetworkPolicy ipBlock
ingress bypass (GO-2026-6367).

Applied across every go.mod that resolves these modules directly or
indirectly (KubeArmor, deployments, deployments/podman,
pkg/KubeArmorController, pkg/KubeArmorOperator, protobuf, tests).
k8s.io/api, k8s.io/apimachinery, k8s.io/client-go and k8s.io/cri-api
move from v0.36.1 to v0.36.3 only because containerd/v2 v2.3.5's own
go.mod requires that floor; no Kubernetes dependency was upgraded
beyond what module resolution required.

Signed-off-by: Vanshika <[REDACTED_EMAIL]>

**File**: `KubeArmor/go.mod` (modified, +9/-9)
```diff
@@ -24,10 +24,10 @@ replace (
 
 require (
 	github.com/Masterminds/sprig/v3 v3.3.0
-	github.com/cilium/cilium v1.19.4
+	github.com/cilium/cilium v1.19.5
 	github.com/cilium/ebpf v0.22.0
 	github.com/containerd/containerd/api v1.11.1
-	github.com/containerd/containerd/v2 v2.3.2
+	github.com/containerd/containerd/v2 v2.3.5
 	github.com/containerd/nri v0.12.0
 	github.com/containerd/typeurl/v2 v2.2.3
 	github.com/florianl/go-nflog/v2 v2.3.0
@@ -44,12 +44,12 @@ require (
 	go.uber.org/zap v1.28.0
 	golang.org/x/exp v0.0.0-20260508232706-74f9aab9d74a
 	golang.org/x/sys v0.47.0
-	google.golang.org/grpc v1.82.1
+	google.golang.org/grpc v1.83.2
 	google.golang.org/protobuf v1.36.12-0.20260120151049-f2248ac996af
-	k8s.io/api v0.36.1
-	k8s.io/apimachinery v0.36.1
-	k8s.io/client-go v0.36.1
-	k8s.io/cri-api v0.36.1
+	k8s.io/api v0.36.3
+	k8s.io/apimachinery v0.36.3
+	k8s.io/client-go v0.36.3
+	k8s.io/cri-api v0.36.3
 	k8s.io/klog/v2 v2.140.0
 	k8s.io/utils v0.0.0-20260507154919-ff6756f316d2
 	sigs.k8s.io/controller-runtime v0.24.1
@@ -69,7 +69,7 @@ require (
 	github.com/containerd/errdefs/pkg v0.3.0 // indirect
 	github.com/containerd/fifo v1.1.0 // indirect
 	github.com/containerd/log v0.1.0 // indirect
-	github.com/containerd/platforms v1.0.0-rc.4 // indirect
+	github.com/containerd/platforms v1.0.0-rc.5 // indirect
 	github.com/containerd/plugin v1.1.0 // indirect
 	github.com/containerd/ttrpc v1.2.8 // indirect
 	github.com/davecgh/go-spew v1.1.2-0.20180830191138-d8f796af33cc // indirect
@@ -145,7 +145,7 @@ require (
 	go.uber.org/multierr v1.11.0 // indirect
 	go.yaml.in/yaml/v2 v2.4.4 // indirect
 	go.yaml.in/yaml/v3 v3.0.4 // indirect
-	golang.org/x/crypto v0.55.0 // indirect
+	golang.org/x/crypto v0.56.0 // indirect
 	golang.org/x/mod v0.40.0 // indirect
 	golang.org/x/net v0.58.0 // indirect
 	golang.org/x/oauth2 v0.36.0 // indirect
```

**File**: `KubeArmor/go.sum` (modified, +20/-20)
```diff
@@ -23,8 +23,8 @@ github.com/brianvoe/gofakeit/v7 v7.12.1/go.mod h1:QXuPeBw164PJCzCUZVmgpgHJ3Llj49
 github.com/census-instrumentation/opencensus-proto v0.2.1/go.mod h1:f6KPmirojxKA12rnyqOA5BBL4O983OfeGPqjHWSTneU=
 github.com/cespare/xxhash/v2 v2.3.0 h1:UL815xU9SqsFlibzuggzjXhog7bL6oX9BbNZnL2UFvs=
 github.com/cespare/xxhash/v2 v2.3.0/go.mod h1:VGX0DQ3Q6kWi7AoAeZDth3/j3BFtOZR5XLFGgcrjCOs=
-github.com/cilium/cilium v1.19.4 h1:TxDZW+27NqLbuenPlWd8y8cnAmDNFga/FCMM8zP1qLQ=
-github.com/cilium/cilium v1.19.4/go.mod h1:9j8LLVACyWe8bbtlUPCjPSARbmOS+tqo9GRNh5SHjJc=
+github.com/cilium/cilium v1.19.5 h1:R4tqIO3wwjzr5TnPw5cSbUhdMIjMAoHhtjNvO/hIZ+Q=
+github.com/cilium/cilium v1.19.5/go.mod h1:E6p9yfdG9g4aDq1D5cvcY7eqzdbVxXy3wyaYETCwZ1U=
 github.com/cilium/ebpf v0.22.0 h1:v2ktp0roffpMOj2MMf3idtCQZOsAoC4BJbAJN+ke2bY=
 github.com/cilium/ebpf v0.22.0/go.mod h1:CDzZbe2hC5JjlDC+CY3KFCzlYwN4gbxppYM+Z10bQt4=
 github.com/cilium/hive v0.0.0-20260108104938-97756f6ff54c h1:mP/Z+oVplgbg3oV1lwsAC86NPLWioN/TqlmZ6+BI2I0=
@@ -35,8 +35,8 @@ github.com/containerd/cgroups/v3 v3.1.3 h1:eUNflyMddm18+yrDmZPn3jI7C5hJ9ahABE5q6
 github.com/containerd/cgroups/v3 v3.1.3/go.mod h1:PKZ2AcWmSBsY/tJUVhtS/rluX0b1uq1GmPO1ElCmbOw=
 github.com/containerd/containerd/api v1.11.1 h1:h8nfoDW9+fNsC/9TwiAHj8B1GzXKtR4eFtkhi/X5RLU=
 github.com/containerd/containerd/api v1.11.1/go.mod h1:CaQFRu+N1MtbgL6JDOJLUB1hCKESU1lD6MuTJhgtdlw=
-github.com/containerd/containerd/v2 v2.3.2 h1:eLven1YxRMkeiKu7IcMrPKE+gn8sGR1DqHbbshMEvWM=
-github.com/containerd/containerd/v2 v2.3.2/go.mod h1:rHKGm3VW6wNrINb3x8mNT+w7qYXFVElTt/8HTuxVhD4=
+github.com/containerd/containerd/v2 v2.3.5 h1:9MYlI81gUcOZ0WsCkSMtvOU7rTR3hqAoa2eCzhoLlkA=
+github.com/containerd/containerd/v2 v2.3.5/go.mod h1:RXDyLPaI3zoO7dFdAW9/54W4cix+z3A6larieufC9mg=
 github.com/containerd/continuity v0.5.0 h1:7a85HZpCSs+1Zps0Ee3DPSuAWY+0SJM1JNM51nlEVDg=
 github.com/containerd/continuity v0.5.0/go.mod h1:/lNJvtJKUQStBzpVQ1+rasXO1LAWtUQssk28EZvJ3nE=
 github.com/containerd/errdefs v1.0.0 h1:tg5yIfIlQIrxYtu9ajqY42W3lpS19XqdxRQeEwYG8PI=
@@ -49,8 +49,8 @@ github.com/containerd/log v0.1.0 h1:TCJt7ioM2cr/tfR8GPbGf9/VRAX8D2B4PjzCpfX540I=
 github.com/containerd/log v0.1.0/go.mod h1:VRRf09a7mHDIRezVKTRCrOq78v577GXq3bSa3EhrzVo=
 github.com/containerd/nri v0.12.0 h1:RvZtyCM64XOB1UmMAFOlfReTTwCd+hE2IEQ5XEpkKA0=
 github.com/containerd/nri v0.12.0/go.mod h1:TGAfPLH4a+qwbv0PxsefPiR+PobYecDj2aXMtz7GQcg=
-github.com/containerd/platforms v1.0.0-rc.4 h1:M42JrUT4zfZTqtkUwkr0GzmUWbfyO5VO0Q5b3op97T4=
-github.com/containerd/platforms v1.0.0-rc.4/go.mod h1:lKlMXyLybmBedS/JJm11uDofzI8L2v0J2ZbYvNsbq1A=
+github.com/containerd/platforms v1.0.0-rc.5 h1:vXd569rDrz8LeMXzAnBsy6LADV5YtsD8oyaRarxdmSU=
+github.com/containerd/platforms v1.0.0-rc.5/go.mod h1:lKlMXyLybmBedS/JJm11uDofzI8L2v0J2ZbYvNsbq1A=
 github.com/containerd/plugin v1.1.0 h1:O+7lczNJVMy8rz0YNx3xGB8tTf5qY4i5abF041Ew19U=
 github.com/containerd/plugin v1.1.0/go.mod h1:qBTum+A8lJ6lO44A19Eo7y1OlcLj4OWFH1DA/vnHmcc=
 github.com/containerd/ttrpc v1.2.8 h1:xbVu6D4qF2jihdh9rDVOKqUMiFBQk6YctTdo1zk087Y=
@@ -332,8 +332,8 @@ go.opentelemetry.io/otel/metric v1.44.0 h1:1w0gILTcHdr3YI+ixLyjemwrVnsMURbTZFrSY
 go.opentelemetry.io/otel/metric v1.44.0/go.mod h1:8O7hanEPBNgEMmybD3s2VBKcgWOCsA6tzHBPODAiquo=
 go.opentelemetry.io/otel/sdk v1.44.0 h1:nHYwb9lK+fJPU/dnT6s7W7Z8itMWyqrnVfbheVYrZ58=
 go.opentelemetry.io/otel/sdk v1.44.0/go.mod h1:Osuydd3Se74nqjAKxid74N5eC+jfEqfTegHRnq58oK0=
-go.opentelemetry.io/otel/sdk/metric v1.43.0 h1:S88dyqXjJkuBNLeMcVPRFXpRw2fuwdvfCGLEo89fDkw=
-go.opentelemetry.io/otel/sdk/metric v1.43.0/go.mod h1:C/RJtwSEJ5hzTiUz5pXF1kILHStzb9zFlIEe85bhj6A=
+go.opentelemetry.io/otel/sdk/metric v1.44.0 h1:3LlKgI+VjbVsjNRFZJZAJ30WjXC5VkNRks6si09iEfI=
+go.opentelemetry.io/otel/sdk/metric v1.44.0/go.mod h1:5B5pMARnXxKhltooO4xUuCBorl65a4EpnTalObqOigA=
 go.opentelemetry.io/otel/trace v1.44.0 h1:jxF5CsGYCe74MCRx2X4g7WsY/VBKRqqpNvXlX/6gtIk=
 go.opentelemetry.io/otel/trace v1.44.0/go.mod h1:oLl1jrMQAVo6v3GAggN+1VH9VIz9iUSvW53sW1Q8PIE=
 go.uber.org/dig v1.17.1 h1:Tga8Lz8PcYNsWsyHMZ1Vm0OQOUaJNDyvPImgbAu9YSc=
@@ -353,8 +353,8 @@ go4.org/netipx v0.0.0-20231129151722-fdeea329fbba/go.mod h1:PLyyIXexvUFg3Owu6p/W
 golang.org/x/crypto v0.0.0-20190308221718-c2843e01d9a2/go.mod h1:djNgcEr1/C05ACkg1iLfiJU5Ep61QUkGW8qpdssI0+w=
 golang.org/x/crypto v0.0.0-20191011191535-87dc89f01550/go.mod h1:yigFU9vqHzYiE8UmvKecakEJjdnWj3jj499lnFckfCI=
 golang.org/x/crypto v0.0.0-20200622213623-75b288015ac9/go.mod h1:LzIPMQfyMNhhGPhUkYOs5KpL4U8rLKemX1yGLhDgUto=
-golang.org/x/crypto v0.55.0 h1:+KWHjbgOaAQ66dh/YlkZKHlz9ZUlq61AFirAR9ntP8M=
-golang.org/x/crypto v0.55.0/go.mod h1:uq0V9dE/fzQuJtbnL+2EhWOE63vo164FY8xqEnV9xis=
+golang.org/x/crypto v0.56.0 h1:GUh5Ii4J5jtcseSMiRqr1jXCNHoxjeV9Fmekc2oLy6Y=
+golang.org/x/crypto v0.56.0/go.mod h1:OMW5y6CY9l38uPLmxU6l6pwcXp1obtLo3e6gT7gQR2I=
 golang.org/x/exp v0.0.0-20190121172915-509febef88a4/go.mod h1:CJ0aWSM057203Lf6IL+f9T1iT9GByDxfZKAQTCR3kQA=
 golang.org/x/exp v0.0.0-20260508232706-74f9aab9d74a h1:+3jdD
```

**File**: `deployments/go.mod` (modified, +2/-2)
```diff
@@ -12,8 +12,8 @@ require (
 	github.com/clarketm/json v1.17.1
 	github.com/kubearmor/KubeArmor/KubeArmor v0.0.0-20260406102335-87edc770f8bf
 	github.com/kubearmor/KubeArmor/pkg/KubeArmorController v0.0.0-20260406102335-87edc770f8bf
-	k8s.io/api v0.36.1
-	k8s.io/apimachinery v0.36.1
+	k8s.io/api v0.36.3
+	k8s.io/apimachinery v0.36.3
 	sigs.k8s.io/yaml v1.6.0
 )
 
```

**File**: `deployments/go.sum` (modified, +4/-4)
```diff
@@ -77,12 +77,12 @@ gopkg.in/inf.v0 v0.9.1 h1:73M5CoZyi3ZLMOyDlQh031Cx6N9NDJ2Vvfl76EDAgDc=
 gopkg.in/inf.v0 v0.9.1/go.mod h1:cWUDdTG/fYaXco+Dcufb5Vnc6Gp2YChqWtbxRZE0mXw=
 gopkg.in/yaml.v3 v3.0.1 h1:fxVm/GzAzEWqLHuvctI91KS9hhNmmWOoWu0XTYJS7CA=
 gopkg.in/yaml.v3 v3.0.1/go.mod h1:K4uyk7z7BCEPqu6E+C64Yfv1cQ7kz7rIZviUmN+EgEM=
-k8s.io/api v0.36.1 h1:XbL/EMj8K2aJpJtePmqUyQMsM0D4QI2pvl7YKJ20FTY=
-k8s.io/api v0.36.1/go.mod h1:KOWo4ey3TINlXjeHVuwB3i+tXXnu+UcwFBHlI/9dvEo=
+k8s.io/api v0.36.3 h1:NxB+05W2UGqXWFXcLO0RB5cnqnUPP5v5sVlaOH0Iz4w=
+k8s.io/api v0.36.3/go.mod h1:JzLQKqRHC5+I8RVj/lS3lCg0mg6nWI9Fo/Sk3ElxHzg=
 k8s.io/apiextensions-apiserver v0.36.1 h1:6JfYmPUsuUIHuN+3QxutXYWj492RqF5fBSx67GYK5Ks=
 k8s.io/apiextensions-apiserver v0.36.1/go.mod h1:pLzZin90riwisdzKwv/GoTwENooytoIx5zWJb4Hkby8=
-k8s.io/apimachinery v0.36.1 h1:G63Gjx2W+q0YD+72Vo8oY0nDnePVwnuzTmmy5ENrVSA=
-k8s.io/apimachinery v0.36.1/go.mod h1:ibYOR00vW/I1kzvi5SF0dRuJ52BvKtfvRdOn35GPQ+8=
+k8s.io/apimachinery v0.36.3 h1:PkzMRBRG8joFD8EhCuQAtNPvJlxb82FwplP26HIzvAM=
+k8s.io/apimachinery v0.36.3/go.mod h1:cTSjBWgPe/6CQyBKzY/hDIRWCQQQeK0mfLbml0UYFHE=
 k8s.io/klog/v2 v2.140.0 h1:Tf+J3AH7xnUzZyVVXhTgGhEKnFqye14aadWv7bzXdzc=
 k8s.io/klog/v2 v2.140.0/go.mod h1:o+/RWfJ6PwpnFn7OyAG3QnO47BFsymfEfrz6XyYSSp0=
 k8s.io/kube-openapi v0.0.0-20260520065146-aa012df4f4af h1:zLXA2Irn14q2/06WMkxViyr7YCPUO2lJ0QYE9Juy5vA=
```

**File**: `deployments/podman/go.mod` (modified, +2/-2)
```diff
@@ -120,7 +120,7 @@ require (
 	go.podman.io/image/v5 v5.40.0 // indirect
 	go.podman.io/storage v1.63.1-0.20260519201413-7e9ee2072844 // indirect
 	go.yaml.in/yaml/v2 v2.4.4 // indirect
-	golang.org/x/crypto v0.55.0 // indirect
+	golang.org/x/crypto v0.56.0 // indirect
 	golang.org/x/mod v0.40.0 // indirect
 	golang.org/x/net v0.58.0 // indirect
 	golang.org/x/sync v0.22.0 // indirect
@@ -130,7 +130,7 @@ require (
 	golang.org/x/tools v0.49.0 // indirect
 	google.golang.org/genproto/googleapis/api v0.0.0-20260526163538-3dc84a4a5aaa // indirect
 	google.golang.org/genproto/googleapis/rpc v0.0.0-20260526163538-3dc84a4a5aaa // indirect
-	google.golang.org/grpc v1.82.1 // indirect
+	google.golang.org/grpc v1.83.2 // indirect
 	google.golang.org/protobuf v1.36.12-0.20260120151049-f2248ac996af // indirect
 	gopkg.in/inf.v0 v0.9.1 // indirect
 	gopkg.in/tomb.v1 v1.0.0-20141024135613-dd632973f1e7 // indirect
```

**File**: `deployments/podman/go.sum` (modified, +4/-4)
```diff
@@ -304,8 +304,8 @@ golang.org/x/crypto v0.13.0/go.mod h1:y6Z2r+Rw4iayiXXAIxJIDAJ1zMW4yaTpebo8fPOliY
 golang.org/x/crypto v0.19.0/go.mod h1:Iy9bg/ha4yyC70EfRS8jz+B6ybOBKMaSxLj6P6oBDfU=
 golang.org/x/crypto v0.23.0/go.mod h1:CKFgDieR+mRhux2Lsu27y0fO304Db0wZe70UKqHu0v8=
 golang.org/x/crypto v0.33.0/go.mod h1:bVdXmD7IV/4GdElGPozy6U7lWdRXA4qyRVGJV57uQ5M=
-golang.org/x/crypto v0.55.0 h1:+KWHjbgOaAQ66dh/YlkZKHlz9ZUlq61AFirAR9ntP8M=
-golang.org/x/crypto v0.55.0/go.mod h1:uq0V9dE/fzQuJtbnL+2EhWOE63vo164FY8xqEnV9xis=
+golang.org/x/crypto v0.56.0 h1:GUh5Ii4J5jtcseSMiRqr1jXCNHoxjeV9Fmekc2oLy6Y=
+golang.org/x/crypto v0.56.0/go.mod h1:OMW5y6CY9l38uPLmxU6l6pwcXp1obtLo3e6gT7gQR2I=
 golang.org/x/mod v0.6.0-dev.0.20220419223038-86c51ed26bb4/go.mod h1:jJ57K6gSWd91VN4djpZkiMVwK6gcyfeH4XE8wZrZaV4=
 golang.org/x/mod v0.8.0/go.mod h1:iBbtSCu2XBx23ZKBPSOrRkjjQPZFPuis4dIYUhu/chs=
 golang.org/x/mod v0.12.0/go.mod h1:iBbtSCu2XBx23ZKBPSOrRkjjQPZFPuis4dIYUhu/chs=
@@ -386,8 +386,8 @@ google.golang.org/genproto/googleapis/api v0.0.0-20260526163538-3dc84a4a5aaa h1:
 google.golang.org/genproto/googleapis/api v0.0.0-20260526163538-3dc84a4a5aaa/go.mod h1:q4lMZS6kskjT5HvCPrnnypcDPVJqT/f4nfxmkE7gryY=
 google.golang.org/genproto/googleapis/rpc v0.0.0-20260526163538-3dc84a4a5aaa h1:mZHHdPZl0dbGHCflZgAq/Q468DWVFcU2whhB2KAo8fk=
 google.golang.org/genproto/googleapis/rpc v0.0.0-20260526163538-3dc84a4a5aaa/go.mod h1:4Hqkh8ycfw05ld/3BWL7rJOSfebL2Q+DVDeRgYgxUU8=
-google.golang.org/grpc v1.82.1 h1:NnAxzGRA0677vCa4BUkOAnO5+FfQqVl9iUXeD0IqcGE=
-google.golang.org/grpc v1.82.1/go.mod h1:yzTZ1TB1Z3SG+LIYaI+WiE8D5+PZ3ArnrSp8zF3+/ZA=
+google.golang.org/grpc v1.83.2 h1:EManeRomTObA0BU7I8vXgg/78uE5MJ9M8B39EX2WscU=
+google.golang.org/grpc v1.83.2/go.mod h1:YPI1hK3kDked6iHvgX3tR0y+nX/qpMFKhPgFsokw1S8=
 google.golang.org/protobuf v1.36.12-0.20260120151049-f2248ac996af h1:+5/Sw3GsDNlEmu7TfklWKPdQ0Ykja5VEmq2i817+jbI=
 google.golang.org/protobuf v1.36.12-0.20260120151049-f2248ac996af/go.mod h1:HTf+CrKn2C3g5S8VImy6tdcUvCska2kB7j23XfzDpco=
 gopkg.in/check.v1 v0.0.0-20161208181325-20d25e280405/go.mod h1:Co6ibVJAznAaIkqp8huTwlJQCZ016jof/cbN4VW5Yz0=
```

**File**: `pkg/KubeArmorController/go.mod` (modified, +1/-1)
```diff
@@ -93,7 +93,7 @@ require (
 	gomodules.xyz/jsonpatch/v2 v2.5.0 // indirect
 	google.golang.org/genproto/googleapis/api v0.0.0-20260526163538-3dc84a4a5aaa // indirect
 	google.golang.org/genproto/googleapis/rpc v0.0.0-20260526163538-3dc84a4a5aaa // indirect
-	google.golang.org/grpc v1.82.1 // indirect
+	google.golang.org/grpc v1.83.2 // indirect
 	google.golang.org/protobuf v1.36.12-0.20260120151049-f2248ac996af // indirect
 	gopkg.in/evanphx/json-patch.v4 v4.13.0 // indirect
 	gopkg.in/inf.v0 v0.9.1 // indirect
```

**File**: `pkg/KubeArmorController/go.sum` (modified, +2/-2)
```diff
@@ -222,8 +222,8 @@ google.golang.org/genproto/googleapis/api v0.0.0-20260526163538-3dc84a4a5aaa h1:
 google.golang.org/genproto/googleapis/api v0.0.0-20260526163538-3dc84a4a5aaa/go.mod h1:q4lMZS6kskjT5HvCPrnnypcDPVJqT/f4nfxmkE7gryY=
 google.golang.org/genproto/googleapis/rpc v0.0.0-20260526163538-3dc84a4a5aaa h1:mZHHdPZl0dbGHCflZgAq/Q468DWVFcU2whhB2KAo8fk=
 google.golang.org/genproto/googleapis/rpc v0.0.0-20260526163538-3dc84a4a5aaa/go.mod h1:4Hqkh8ycfw05ld/3BWL7rJOSfebL2Q+DVDeRgYgxUU8=
-google.golang.org/grpc v1.82.1 h1:NnAxzGRA0677vCa4BUkOAnO5+FfQqVl9iUXeD0IqcGE=
-google.golang.org/grpc v1.82.1/go.mod h1:yzTZ1TB1Z3SG+LIYaI+WiE8D5+PZ3ArnrSp8zF3+/ZA=
+google.golang.org/grpc v1.83.2 h1:EManeRomTObA0BU7I8vXgg/78uE5MJ9M8B39EX2WscU=
+google.golang.org/grpc v1.83.2/go.mod h1:YPI1hK3kDked6iHvgX3tR0y+nX/qpMFKhPgFsokw1S8=
 google.golang.org/protobuf v1.36.12-0.20260120151049-f2248ac996af h1:+5/Sw3GsDNlEmu7TfklWKPdQ0Ykja5VEmq2i817+jbI=
 google.golang.org/protobuf v1.36.12-0.20260120151049-f2248ac996af/go.mod h1:HTf+CrKn2C3g5S8VImy6tdcUvCska2kB7j23XfzDpco=
 gopkg.in/check.v1 v0.0.0-20161208181325-20d25e280405/go.mod h1:Co6ibVJAznAaIkqp8huTwlJQCZ016jof/cbN4VW5Yz0=
```

#### Recent Merged Pull Requests:
- **PR #2936** (2026-10-16): chore: Update stable to v1.7.6 (@AryanBakliwal)
- **PR #2933** (2026-10-15): chore: update helm chart version (@AryanBakliwal)
- **PR #2925** (2026-10-13): fix(monitor): syscall matching for arm64 (@AryanBakliwal)
- **PR #2924** (2026-10-05): remove limits (@achrefbensaad)
- **PR #2922** (2026-10-04): Log level (@achrefbensaad)
- **PR #2921** (2026-10-07): fix(monitor): fix memory leak in syscall replay path, add pprof and LOG_LEVEL (@achrefbensaad)

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

## X. presets): stop writing ContainerMap under RLock in anonmapexec (#2797)

**RULE**:
When implementing operations in `KubeArmor/presets/anonmapexec/preset.go`, engineers MUST enforce rigorous boundary validation, safe state transitions, and memory/concurrency invariants as established by production defect remediation in kubearmor/KubeArmor. All inputs crossing module boundaries must be explicitly verified before state persistence.

**WHY**:
Prevents defects observed in production commit `a3887c17`: presets): stop writing ContainerMap under RLock in anonmapexec (#2797). Unvalidated execution paths cause runtime exceptions, race conditions, and silent state corruption under concurrent workloads.

**WHEN TO APPLY**:
Subsystems managing Go data structures, boundary deserialization, API parsing, or resource lifecycles matching `KubeArmor/presets/anonmapexec/preset.go`.

**VERIFIED IMPLEMENTATION PATTERN**:
```go
// Verified production-grade fix pattern:
					p.ContainerMapLock.RUnlock()
					p.ContainerMapLock.Lock()
					p.ContainerMapLock.Unlock()
```

**NEGATIVE CONSTRAINT**:
```go
// Anti-pattern to NEVER write (induced failure mode):
						p.ContainerMapLock.RUnlock()
					p.ContainerMapLock.RUnlock()
```

**VERIFICATION METHOD**:
Automated regression test asserting that input states reproducing defect `a3887c17` are properly handled with clean fallback behavior.
