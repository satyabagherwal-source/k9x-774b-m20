# Forensic Learning Record (Deep Inspection): kubearmor/KubeArmor

> **Canonical Artifact**: `07_PROJECT_LEARNING/kubearmor-kubearmor-learnings.md`  
> **Source Platform**: GitHub ([https://github.com/kubearmor/KubeArmor](https://github.com/kubearmor/KubeArmor))  
> **Harvest Method**: Full-Spectrum Deep Extraction (Patches, Diffs, Source Code, Post-Mortems)  
> **Harvest Timestamp**: 2026-10-06T03:05:15.167Z  
> **Compliance State**: Free Tier Guaranteed | Strict Rate-Limit Backoff Honored  

---

## 1. Context & Architectural Overview
- **Repository / Resource**: `kubearmor/KubeArmor`
- **Description**: Runtime Security Enforcement System. Workload hardening/sandboxing and implementing least-permissive policies made easy leveraging LSMs (LSM-BPF, AppArmor).
- **Primary Language / Ecosystem**: Go
- **Discovered Manifests / Configurations**: README.md, Dockerfile
- **Stars / Engagement**: 2624 stars

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

### Core Architecture Module: `KubeArmor/core/unorchestratedUpdates.go`
```
// SPDX-License-Identifier: Apache-2.0
// Copyright 2026 Authors of KubeArmor

package core

import (
	"encoding/json"
	"os"
	"regexp"
	"slices"
	"strings"

	"github.com/fsnotify/fsnotify"
	"github.com/spf13/viper"

	kl "github.com/kubearmor/KubeArmor/KubeArmor/common"
	cfg "github.com/kubearmor/KubeArmor/KubeArmor/config"
	kg "github.com/kubearmor/KubeArmor/KubeArmor/log"
	tp "github.com/kubearmor/KubeArmor/KubeArmor/types"
	pb "github.com/kubearmor/KubeArmor/protobuf"
)

// SetContainerVisibility function enables visibility flag arguments for un-orchestrated container and updates the visibility map
func (dm *KubeArmorDaemon) SetContainerNSVisibility() {

	visibility := tp.Visibility{}

	if strings.Contains(cfg.GlobalCfg.Visibility, "process") {
		visibility.Process = true
	}
	if strings.Contains(cfg.GlobalCfg.Visibility, "file") {
		visibility.File = true
	}
	if strings.Contains(cfg.GlobalCfg.Visibility, "network") {
		visibility.Network = true
	}
	if strings.Contains(cfg.GlobalCfg.Visibility, "capabilities") {
		visibility.Capabilities = true
	}
	if strings.Contains(cfg.GlobalCfg.Visibility, "dns") {
		visibility.DNS = true
	}
	if strings.Contains(cfg.GlobalCfg.Visibility, "ima") {
		visibility.IMA = true
	}
	dm.UpdateVisibility("ADDED", cfg.GlobalCfg.Host, visibility)
}

// =================== //
// == Config Update == //
// =================== //

// WatchConfigChanges watches for configuration changes and updates the default posture
func (dm *KubeArmorDaemon) WatchConfigChanges() {
	viper.OnConfigChange(func(e fsnotify.Event) {
		dm.Logger.Printf("Config file changed: %s", e.Name)
		cfg.LoadDynamicConfig()

		// Update the default posture
		globalPosture := tp.DefaultPosture{
			FileAction:         validateGlobalDefaultPosture(cfg.GlobalCfg.DefaultFilePosture),
			NetworkAction:      validateGlobalDefaultPosture(cfg.GlobalCfg.DefaultNetworkPosture),
			CapabilitiesAction: validateGlobalDefaultPosture(cfg.GlobalCfg.DefaultCapabilitiesPosture),
			DeviceAction:       validateGlobalDefaultPosture(cfg.GlobalCfg.HostDefaultDevicePosture),
		}
		// Update the visibility
		visibility := tp.Visibility{
			File:         dm.validateVisibility("file", cfg.GlobalCfg.Visibility),
			Process:      dm.validateVisibility("process", cfg.GlobalCfg.Visibility),
			Network:      dm.validateVisibility("network", cfg.GlobalCfg.Visibility),
			Capabilities: dm.validateVisibility("capabilities", cfg.GlobalCfg.Visibility),
			DNS:          dm.validateVisibility("dns", cfg.GlobalCfg.Visibility),
			IMA:          dm.validateVisibility("ima", cfg.GlobalCfg.Visibility),
		}

		// Apply the changes to the daemon
		dm.UpdateGlobalPosture(globalPosture)

		// Update default posture for endpoints
		for _, ep := range dm.EndPoints {
			dm.Logger.Printf("Updating Default Posture for endpoint %s", ep.EndPointName)
			dm.UpdateDefaultPosture("MODIFIED", ep.NamespaceName, globalPosture, false)
			dm.UpdateVisibility("MODIFIED", ep.NamespaceName, visibility)
		}

		// Update throttling configs
		dm.SystemMonitor.UpdateThrottlingConfig()

		// Update USB Device Handler
		dm.UpdateUSBDeviceHandler(cfg.GlobalCfg.USBDeviceHandler)

		// Update the default posture and visibility for the unorchestrated containers
		dm.SystemMonitor.UpdateVisibility()
		dm.UpdateHostSecurityPolicies()
	})
	viper.WatchConfig()
}

// ====================================== //
// == Container Security Policy Update == //
// ====================================== //

// MatchandUpdateContainerSecurityPolicies finds relevant endpoint for containers and updates the security policies for enforcement
func (dm *KubeArmorDaemon) MatchandUpdateContainerSecurityPolicies(cid string) {
	container := dm.Containers[cid]
	for idx, ep := range dm.EndPoints {
		_, containerIdentities := kl.GetLabelsFromString(container.Labels)
		if ep.EndPointName == dm.Containers[cid].ContainerName || kl.MatchIdentities(ep.Identities, containerIdentities) {
			ep.Containers = append(ep.Containers, cid)
			dm.EndPoints[idx] = ep
			ctr := dm.Containers[cid]
			ctr.NamespaceName = ep.NamespaceName
			ctr.EndPointName = ep.EndPointName
			dm.Containers[cid] = ctr
			if cfg.GlobalCfg.Policy {
				// update security policies
				dm.Logger.UpdateSecurityPolicies("MODIFIED", ep)
				if ep.PolicyEnabled == tp.KubeArmorPolicyEnabled {
					if dm.RuntimeEnforcer != nil {
						// enforce security policies
						dm.RuntimeEnforcer.UpdateSecurityPolicies(ep)
					}
					if dm.Presets != nil {
						dm.Presets.UpdateSecurityPolicies(ep)
					}
				}
			}
		}
	}
}

// MatchandRemoveContainerSecurityPolicies finds relevant endpoint for containers and removes cid from the container list
func (dm *KubeArmorDaemon) MatchandRemoveContainerFromEndpoint(cid string) {
	container := dm.Containers[cid]
	for idx, ep := range dm.EndPoints {
		_, containerIdentities := kl.GetLabelsFromString(container.Labels)
		if ep.EndPointName == container.ContainerName || kl.MatchIdentities(ep.Identities, containerIdentities) {
			for i, c := range ep.Containers {
				if c != cid {
					continue
				}
				ep.Containers = append(ep.Containers[:i], ep.Containers[i+1:]...)
				break
			}
		}
		dm.EndPoints[idx] = ep
	}
}

func (dm *KubeArmorDaemon) handlePolicyEvent(eventType string, createEndPoint bool, secPolicy tp.SecurityPolicy, newPoint tp.EndPoint, endpointIdx int, containername string) (int, pb.PolicyStatus) {
	if containername == "" {
		containername = newPoint.ContainerName
	}

	appArmorAnnotations := map[string]string{}
	appArmorAnnotations[containername] = "kubearmor_" + containername

	globalDefaultPosture := tp.DefaultPosture{
		FileAction:         cfg.GlobalCfg.DefaultFilePosture,
		NetworkAction:      cfg.GlobalCfg.DefaultNetworkPosture,
		CapabilitiesAction: cfg.GlobalCfg.DefaultCapabilitiesPosture,
	}
	newPoint.DefaultPosture = globalDefaultPosture

	// check that a security policy should exist before performing delete operation
	policymatch := 0
	for _, policy := range newPoint.SecurityPolicies {
		// check if policy exist
		if policy.Metadata["namespaceName"] == secPolicy.Metadata["namespaceName"] && policy.Metadata["policyName"] == secPolicy.Metadata["policyName"] {
			policymatch = 1 // policy exists
		}
	}

	// policy doesn't exist and the policy is being removed
	if policymatch == 0 && eventType == "DELETED" {
		dm.Logger.Warnf("Failed to delete security policy. Policy doesn't exist")
		return endpointIdx, pb.PolicyStatus_NotExist
	}

	for idx, policy := range newPoint.SecurityPolicies {
		if policy.Metadata["namespaceName"] == secPolicy.Metadata["namespaceName"] && policy.Metadata["policyName"] == secPolicy.Metadata["policyName"] {
			if eventType == "DELETED" {
				newPoint.SecurityPolicies = append(newPoint.SecurityPolicies[:idx], newPoint.SecurityPolicies[idx+1:]...)
				break
			} else {
				// Policy already exists so modify
				eventType = "MODIFIED"
				newPoint.SecurityPolicies[idx] = secPolicy
			}
		}
	}

	var privilegedProfiles map[string]struct{}
	switch eventType {
	case "ADDED":
		dm.RuntimeEnforcer.UpdateAppArmorProfiles(containername, "ADDED", appArmorAnnotations, privilegedProfiles)

		newPoint.SecurityPolicies = append(newPoint.SecurityPolicies, secPolicy)
		if createEndPoint {
			// Create new EndPoint - possible scenarios:
			// policy received before container
			newPoint.NamespaceName = secPolicy.Metadata["namespaceName"]
			newPoint.EndPointName = containername
			newPoint.ContainerName = containername
			newPoint.PolicyEnabled = tp.KubeArmorPolicyEnabled
			newPoint.Identities = secPolicy.Spec.Selector.Identities

			newPoint.ProcessVisibilityEnabled = true
			newPoint.FileVisibilityEnabled = true
			newPoint.NetworkVisibilityEnabled = true
			newPoint.CapabilitiesVisibilityEnabled = true
			newPoint.Containers = []string{}

			newPoint.PrivilegedContainers = map[string]struct{}{}

			newPoint.AppArmorProfiles = []string{"kubearmor_" + containername}

			// add the endpoint into the endpoint list
			dm.EndPoints = append(dm.EndPoints, newPoint)
		} else {
			dm.EndPoints[endpointIdx] = newPoint
		}

		if cfg.GlobalCfg.Policy {
			// update security policies
			dm.Logger.UpdateSecurityPolicies("ADDED", newPoint)

			if newPoint.PolicyEnabled == tp.KubeArmorPolicyEnabled {
				if dm.RuntimeEnforcer != nil {
					// enforce security policies
					dm.RuntimeEnforcer.UpdateSecurityPolicies(newPoint)
				}
				if dm.Presets != nil {
					dm.Presets.UpdateSecurityPolicies(newPoint)
				}
			}
		}
	case "MODIFIED":
		dm.EndPoints[endpointIdx] = newPoint
		if cfg.GlobalCfg.Policy {
			// update security policies
			dm.Logger.UpdateSecurityPolicies("MODIFIED", newPoint)

			if newPoint.PolicyEnabled == tp.KubeArmorPolicyEnabled {
				if dm.RuntimeEnforcer != nil {
					// enforce security policies
					dm.RuntimeEnforcer.UpdateSecurityPolicies(newPoint)
				}
				if dm.Presets != nil {
					// enforce preset rules
					dm.Presets.UpdateSecurityPolicies(newPoint)
				}
			}
		}
	default: // DELETED
		// update security policies after policy deletion
		if endpointIdx >= 0 {
			dm.EndPoints[endpointIdx] = newPoint
			dm.Logger.UpdateSecurityPolicies("DELETED", newPoint)
			dm.RuntimeEnforcer.UpdateSecurityPolicies(newPoint)
			if dm.Presets != nil {
				dm.Presets.UpdateSecurityPolicies(newPoint)
			}
			// delete endpoint if no containers or policies
			if len(newPoint.Containers) == 0 && len(newPoint.SecurityPolicies) == 0 {
				dm.EndPoints = append(dm.EndPoints[:endpointIdx], dm.EndPoints[endpointIdx+1:]...)
				// since the length of endpoints slice reduced
				endpointIdx--
			}
		}
	}

	return endpointIdx, pb.PolicyStatus_Applied
}

// ParseAndUpdateContainerSecurityPolicy Function
func (dm *KubeArmorDaemon) ParseAndUpdateContainerSecurityPolicy(event tp.K8sKubeArmorPolicyEvent) pb.PolicyStatus {

	// create a container security policy
	secPolicy := tp.SecurityPolicy{}

	secPolicy.Metadata = map[string]string{}
	secPolicy.Metadata["namespaceName"] = cfg.GlobalCfg.Host
	secPolicy.Metadata["policyName"]
```

### Core Architecture Module: `KubeArmor/presets/anonmapexec/utils.go`
```
// SPDX-License-Identifier: Apache-2.0
// Copyright 2026 Authors of KubeArmor

package anonmapexec

import "strings"

func ParseProtectionFlags(prot uint64) string {
	var f []string

	if prot&0x1 == 0x1 {
		f = append(f, "PROT_READ")
	}
	if prot&0x2 == 0x2 {
		f = append(f, "PROT_WRITE")
	}
	if prot&0x4 == 0x4 {
		f = append(f, "PROT_EXEC")
	}

	return strings.Join(f, "|")
}

/*
MAP_PRIVATE (0x02): Create a private copy-on-write mapping.
MAP_SHARED (0x01): Share this mapping with all processes that map this object.
MAP_ANONYMOUS (0x20): The mapping is not backed by any file.
MAP_FIXED (0x10): Interpret addr exactly as specified.
MAP_GROWSDOWN (0x1000): Used for stack-like regions.
MAP_DENYWRITE (0x0800): Prevent other processes from writing to this object.
*/

func ParseMemoryFlags(flag uint64) string {
	var f []string

	if flag&0x01 == 0x01 {
		f = append(f, "MAP_SHARED")
	}
	if flag&0x02 == 0x02 {
		f = append(f, "MAP_PRIVATE")
	}
	if flag&0x10 == 0x10 {
		f = append(f, "MAP_FIXED")
	}
	if flag&0x20 == 0x20 {
		f = append(f, "MAP_ANONYMOUS")
	}
	if flag&0x1000 == 0x1000 {
		f = append(f, "MAP_GROWSDOWN")
	}
	if flag&0x0800 == 0x0800 {
		f = append(f, "MAP_DENYWRITE")
	}
	return strings.Join(f, "|")
}

```


### D2: Asynchronous State & Concurrency
- Analyzed concurrency guarantees, async pipelines, and event handling from PR resolutions and commit changes.

### D3: Error Boundaries, Recovery & Rollbacks
- Exception handling patterns and defect resolutions extracted from closed production bug issues:
- **Issue #2828** (2026-09-07): **pass OCI hooks flag consistently from operator to snitch**
  *Symptoms*: ## Bug Report  <!-- If you have usage questions, please try the [Discussions](https://github.com/kubearmor/KubeArmor/discussions) or [KubeArmor Slack](https://kubearmor.slack.com/) first. Please check the [Kubearmor issue](https://github.com/kubearmor/KubeArmor/issues) list to check if there is an issue already in the context. -->  When OCI hooks are enabled through the Helm chart, the KubeArmor Operator correctly receives:  ``` KUBEARMOR_OCI_HOOKS=yes ```  However, the Operator creates Snitch Jobs with:  ```text KUBEARMOR_OCI_HOOKS=true ```  KubeArmor v1.7.4's GetOCIHooks() implementation only accepts `yes` and `no`. As a result, the Snitch interprets true as disabled and skips OCI hook installation.  This prevents KubeArmor OCI hooks from being installed on containerd nodes, even though enableOCIHooks: true is configured.  **General Information**  - Environment description: Cluster API-managed VM-based Kubernetes cluster - Kernel version: 6.8.0-106-generic - Orchestration system version in use: v1.34.9 - Link to relevant artifacts (policies, deployments scripts, ...)   - KubeArmor v1.7.4 Helm template:     - https://github.com/kubearmor/KubeArmor/blob/v1.7.4/deployments/helm/KubeArmorOperator/templates/deployment.yaml   - KubeArmor v1.7.4 Operator Snitch Job generation:     - https://github.com/kubearmor/KubeArmor/blob/v1.7.4/pkg/KubeArmorOperator/internal/controller/resources.go   - KubeArmor v1.7.4 OCI hooks parser:     - https://github.com/kubearmor/KubeArmor/blob/1504ee

- **Issue #2803** (2026-07-29): **Trivy Scan vulnerabilities**
  *Symptoms*: ## Bug Report ``` KubeArmor/kubearmor (gobinary) ============================== Total: 1 (HIGH: 1, CRITICAL: 0)  ┌────────────────────────┬─────────────────────┬──────────┬────────┬───────────────────┬───────────────┬───────────────────────────────────────────────────┐ │        Library         │    Vulnerability    │ Severity │ Status │ Installed Version │ Fixed Version │                       Title                       │ ├────────────────────────┼─────────────────────┼──────────┼────────┼───────────────────┼───────────────┼───────────────────────────────────────────────────┤ │ google.golang.org/grpc │ GHSA-hrxh-6v49-42gf │ HIGH     │ fixed  │ v1.81.1           │ 1.82.1        │ gRPC-Go: xDS RBAC and HTTP/2 Vulnerabilities      │ │                        │                     │          │        │                   │               │ https://github.com/advisories/GHSA-hrxh-6v49-42gf │ └────────────────────────┴─────────────────────┴──────────┴────────┴───────────────────┴───────────────┴───────────────────────────────────────────────────┘``` <!-- If you have usage questions, please try the [Discussions](https://github.com/kubearmor/KubeArmor/discussions) or [KubeArmor Slack](https://kubearmor.slack.com/) first. Please check the [Kubearmor issue](https://github.com/kubearmor/KubeArmor/issues) list to check if there is an issue already in the context. -->  **General Information**  - Environment description (GKE, VM-Kubeadm, vagrant-dev-env, minikube, microk8s, ...) - Kernel ver
  **Post-Mortem & Fix Analysis**:
  > @Aryan-sharma11 I would like to work on this and I'll submit a PR regarding fix soon.
  > @Aryan-sharma11 i would like to work on this

- **Issue #2796** (2026-09-08): **Data race in writing ContainerMap in anonmapexec**
  *Symptoms*:  **General Information**  - Component: `KubeArmor/presets/anonmapexec` - Environment: Reproduces with concurrent policy updates when presets are active - Kernel version: N/A - Orchestration system: N/A - Target containers/pods: any workloads using the AnonMapExec preset  **Description**  In `UpdateSecurityPolicies`, `anonmapexec` acquires `ContainerMapLock.RLock()` (read lock) and then **writes** `p.ContainerMap[cid] = ckv` before `RUnlock()`.  The `RWMutex` allows multiple concurrent read lock holders. Writing a Go map under a read lock is a data race. Concurrent policy updates or a concurrent exclusive `Lock` writer can corrupt the map or panic.  All other presets (`exec`, `filelessexec`, etc) handle this correctly:  1. `RLock` → read map → `RUnlock` 2. mutate a local copy 3. `Lock` → write map → `Unlock`  **To Reproduce**  This uses a sample test script with the same code to demonstrate the race condition.  1. Create a small module  ```bash mkdir -p /tmp/anonmapexec_race_demo && cd /tmp/anonmapexec_race_demo go mod init anonmapexec_race_demo ```  2. Save [this test](https://gist.github.com/vee1e/97f8af0642350456a30f2621aac5c475) as race_test.go  3. Run with the race detector  ```bash go test -race -count=1 -run TestAnonMapExec_ContainerMapWriteUnderRLock_DataRace . ```  Expected output (excerpt from local testing):  ``` ================== WARNING: DATA RACE ...   anonmapexec_race_demo.updateBuggy()       .../race_test.go:24 +0x7c ... Found 3 data race(s) FAIL    anonmapexe

- **Issue #2792** (2026-07-24): **Duplicate generate directive in filelessexec**
  *Symptoms*: **General Information**  - Component: `KubeArmor/presets/filelessexec` - Environment: N/A (buil tooling only, not runtime) - Kernel version: N/A - Orchestration system: N/A - Target containers/pods: N/A  **Description**  The `filelessexec/preset.go` file contains two identical `//go:generate` directives that invoke the same `bpf2go` command:  1. After the package declaration (line 7) 2. After the import block (line ~31, before the `var` block)  Every other preset package only has a **single** `//go:generate` line.  **To Reproduce**   1. From `KubeArmor/`, run:     ```bash    go generate -n ./presets/filelessexec    ```  3. Observe the same `bpf2go` command printed twice.  **Expected behavior**  - Exactly one `//go:generate` directive per preset package. - `go generate ./presets/filelessexec` runs bpf2go once.  **Actual behavior**  - Two identical directives. - Runs bpf2go twice, rewriting the same generated files.  **Impact**  - Redundant work during `go generate` (including paths that run `go generate ./...`). - Easy to diverge if only one line is edited later.  **Suggested fix**  Remove the duplicate directive; keep a single line (aligned with `exec` and the other presets).

- **Issue #2701** (2026-06-24): **fix trivy scan vulnerabilities**
  *Symptoms*: <img width="1735" height="471" alt="Image" src="https://github.com/user-attachments/assets/571de5e2-c4b8-49d6-afc5-da54dee19438" /> 
  **Post-Mortem & Fix Analysis**:
  > @Aryan-sharma11 I would like to work on this please assign this to me ! 

- **Issue #2698** (2026-06-25): **Incorrect expression syntax in workflow if conditions causes literal truthy evaluation**
  *Symptoms*: ## Bug Report  **General Information** - Environment description: GitHub Actions CI workflows (not a runtime/cluster issue) - Affected workflows: `.github/workflows/ci-latest-release.yml`, `.github/workflows/ci-latest-ubi-release.yml` - Affected jobs: `build` and `kubearmor-controller-release` in both files - Link to relevant artifacts: noticed while working on #2585  **To Reproduce** 1. Open `.github/workflows/ci-latest-release.yml` or `.github/workflows/ci-latest-ubi-release.yml` 2. Look at the `if:` condition on the `build` job or the `kubearmor-controller-release` job 3. Observe that `github.ref` is wrapped in `${{ }}` even though it sits inside an `if:` field that is already evaluated as an expression context, for example: ```yaml    if: github.repository == 'kubearmor/kubearmor' && (needs.check.outputs.kubearmor == 'true' || ${{ github.ref }} != 'refs/heads/main') ``` 4. Run a workflow linter (e.g. actionlint) against the file, it flags: "Conditional expression contains literal text outside replacement tokens. This will cause the expression to always evaluate to truthy."  **Expected behavior** The `if:` condition should not nest `${{ }}` inside itself since the entire field is already evaluated as an expression. The correct form is: ```yaml if: github.repository == 'kubearmor/kubearmor' && (needs.check.outputs.kubearmor == 'true' || github.ref != 'refs/heads/main') ``` Without this fix, the right side of the `||` always evaluates as truthy text, meaning the job conditio

- **Issue #2659** (2026-06-11): **KA Posture fails to update on VM mode without restart**
  *Symptoms*:  **General Information**  - Environment description (VM) - Kernel version (run `uname -a`)  **To Reproduce**  1. Deploy kubearmor in VM mode.  2. Now observe the default posture set for file and process in the config.  3. Modify the default posture in the config.  4. Now observe KubeArmor logs. The posture change is not identified.  5. Now restart the KA service and observe the logs. Posture is updated.   **Expected behavior**  The posture change should reflect without needing to restart the KA service running in the VM.  

- **Issue #2634** (2026-07-21): **test(blockposture): KarmorGetLogs 10s timeout causes intermittent CI failures on loaded runners**
  *Symptoms*: ## Bug Report  **General Information**  - Environment: `oracle-vm-16cpu-64gb-x86-64` self-hosted GitHub Actions runner - Orchestration: k3s with containerd runtime - Affected test: `tests/k8s_env/blockposture/block_test.go:89` - Affected suite: `Auto-testing Framework / oracle-vm-16cpu-64gb-x86-64 / containerd`  **To Reproduce**  1. Raise any PR that triggers `ci-test-ginkgo` workflow 2. Wait for the `Auto-testing Framework / oracle-vm-16cpu-64gb-x86-64 / containerd` matrix job to run 3. Observe the `Test KubeArmor using Ginkgo` step failing in the `blockposture` suite with `event timeout`  **Expected behavior**  The test `can whitelist certain files accessed by a package while blocking all other sensitive content` should pass. The block itself works correctly as seen in the logs: `cat: can't open 'docker-entrypoint.sh': Permission denied`. KubeArmor is enforcing the policy but `KarmorGetLogs(10*time.Second, 1)` times out before the policy violation alert arrives over gRPC, returning 0 alerts. The assertion `Expect(len(alerts)).To(BeNumerically(">=", 1))` then fails with `Expected <int>: 0 to be >= <int>: 1`.  The test retries 9 times and fails on every attempt totalling 322 seconds before giving up. The failure is intermittent and runner-load-dependent. The same test passes on other CI runs when the runner is less loaded, confirming this is a timing issue in the eBPF event delivery pipeline rather than a functional KubeArmor bug.  The fix is to increase the `KarmorGetLogs` t
  **Post-Mortem & Fix Analysis**:
  > A useful next step might be to separate the repro into input, state/cache update, and final output for `oracle-vm-16cpu-64gb-x86-64`. That would make it clearer whether “test(blockposture): KarmorGetLogs 10s timeout causes intermittent CI failures on loaded runners” is failing during parsing/configuration, during internal state updates, or only at the user-visible result. 

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

### Incident Patch 1: `be518aac` (2026-10-04)
**Commit Message**: fix(NPE): Fix NPE initialization check in non-k8s (#2906)

Signed-off-by: Aryan Bakliwal <[REDACTED_EMAIL]>

**File**: `KubeArmor/core/kubeArmor.go` (modified, +1/-1)
```diff
@@ -1106,7 +1106,7 @@ func KubeArmor() {
 		policyService := &policy.PolicyServer{
 			ContainerPolicyEnabled: enableContainerPolicy,
 			HostPolicyEnabled:      cfg.GlobalCfg.HostPolicy,
-			NetworkPolicyEnabled:   cfg.GlobalCfg.NetworkPolicyEnforcer,
+			NetworkPolicyEnabled:   cfg.GlobalCfg.NetworkPolicyEnforcer && dm.NetworkPolicyEnforcer != nil,
 		}
 		if enableContainerPolicy {
 			policyService.UpdateContainerPolicy = dm.ParseAndUpdateContainerSecurityPolicy
```

---

### Incident Patch 2: `74d732ec` (2026-09-15)
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

---

### Incident Patch 3: `fcdb0652` (2026-09-11)
**Commit Message**: fix missing vmlinux.h in ci (#2897)

Signed-off-by: Aryan-sharma11 <[REDACTED_EMAIL]>

**File**: `.github/workflows/ci-latest-release.yml` (modified, +11/-0)
```diff
@@ -73,6 +73,17 @@ jobs:
       - name: Compile libbpf
         run: ./.github/workflows/install-libbpf.sh
 
+      - name: Install bpftool
+        run: ./.github/workflows/install-bpftool.sh
+
+      - name: Generate vmlinux.h
+        run: make -C BPF kernel_headers
+        working-directory: KubeArmor
+
+      - name: Generate BPF files
+        run: go generate ./...
+        working-directory: KubeArmor
+
       - name: Get release tag
         id: vars
         uses: actions/github-script@f28e40c7f34bde8b3046d885e986cb6290c5673b # v7
```

**File**: `.github/workflows/ci-latest-ubi-release.yml` (modified, +11/-0)
```diff
@@ -67,6 +67,17 @@ jobs:
       - name: Compile libbpf
         run: ./.github/workflows/install-libbpf.sh
 
+      - name: Install bpftool
+        run: ./.github/workflows/install-bpftool.sh
+
+      - name: Generate vmlinux.h
+        run: make -C BPF kernel_headers
+        working-directory: KubeArmor
+
+      - name: Generate BPF files
+        run: go generate ./...
+        working-directory: KubeArmor
+
       - name: Get release tag
         id: vars
         uses: actions/github-script@f28e40c7f34bde8b3046d885e986cb6290c5673b # v7
```

**File**: `.github/workflows/ci-test-systemd.yml` (modified, +11/-0)
```diff
@@ -39,6 +39,17 @@ jobs:
           go install google.golang.org/grpc/cmd/protoc-gen-go-grpc@v1.6.1
           echo "$(go env GOPATH)/bin" >> "$GITHUB_PATH"
 
+      - name: Install bpftool
+        run: ./.github/workflows/install-bpftool.sh
+
+      - name: Generate vmlinux.h
+        run: make -C BPF kernel_headers
+        working-directory: KubeArmor
+
+      - name: Generate BPF files
+        run: go generate ./...
+        working-directory: KubeArmor
+
       - name: Build Systemd Release
         run: make local-release
         working-directory: KubeArmor
```

---

### Incident Patch 4: `2a03082c` (2026-09-11)
**Commit Message**: fix: add fromSource support for execname in BPF-LSM enforcement (#2163)

* fix: add fromSource support for execname in BPF-LSM enforcement

Signed-off-by: Saurav Teli <[REDACTED_EMAIL]>

* fix: resolve eBPF variable redeclaration in enforcer.bpf.c

Signed-off-by: Saurav Teli <[REDACTED_EMAIL]>

* refactor & update test

Signed-off-by: Aryan-sharma11 <[REDACTED_EMAIL]>

---------

Signed-off-by: Saurav Teli <[REDACTED_EMAIL]>
Signed-off-by: Aryan-sharma11 <[REDACTED_EMAIL]>
Co-authored-by: Aryan-sharma11 <[REDACTED_EMAIL]>
Co-authored-by: Aryan Sharma <[REDACTED_EMAIL]>

**File**: `KubeArmor/BPF/enforcer.bpf.c` (modified, +17/-2)
```diff
@@ -202,9 +202,24 @@ int BPF_PROG(enforce_proc, struct linux_binprm *bprm, int ret)
     goto decision;
   }
 
-  // match exec name
-  struct qstr d_name = BPF_CORE_READ(f_path.dentry, d_name);
+  // match exec name (with and without fromSource)
+  struct qstr d_name;
+  d_name = BPF_CORE_READ(f_path.dentry, d_name);
+  if (fromSourceCheck)
+  {
+    bpf_map_update_elem(&bufk, &two, z, BPF_ANY);
+    bpf_probe_read_str(pk->path, MAX_STRING_SIZE, d_name.name);
+    bpf_probe_read_str(pk->source, MAX_STRING_SIZE, store->source);
+
+    val = bpf_map_lookup_elem(inner, pk);
 
+    if (val && (val->processmask & RULE_EXEC))
+    {
+      match = true;
+      goto decision;
+    }
+  }
+  // match exec name without fromSource
   bpf_map_update_elem(&bufk, &two, z, BPF_ANY);
   bpf_probe_read_str(pk->path, MAX_STRING_SIZE, d_name.name);
 
```

**File**: `tests/k8s_env/ksp/ksp_test.go` (modified, +47/-2)
```diff
@@ -602,8 +602,6 @@ var _ = Describe("Ksp", func() {
 			res, err := KarmorGetTargetAlert(5*time.Second, &expect)
 			Expect(err).To(BeNil())
 			Expect(res.Found).To(BeTrue())
-
-			//ksp-group-1-allow-proc-args
 		})
 
 		It("it can block and allow process execution based on pts", func() {
@@ -650,6 +648,53 @@ var _ = Describe("Ksp", func() {
 			Expect(err).To(BeNil())
 			Expect(resLog.Found).To(BeTrue())
 		})
+		It("it can block process execution with execname and fromSource", func() {
+			if strings.Contains(K8sRuntimeEnforcer(), "apparmor") {
+				Skip("Skipping due to args rule only supported by BPFLSM")
+			}
+
+			// Apply Policy
+			err := K8sApplyFile("multiubuntu/ksp-ubuntu-1-block-proc-execname-from-source.yaml")
+			Expect(err).To(BeNil())
+
+			// Test 2: curl from another source (not bash) should be allowed
+			// Start KubeArmor Logs
+			err = KarmorLogStart("system", "multiubuntu", "Process", ub1)
+			Expect(err).To(BeNil())
+
+			// Execute curl from dash (blocked since fromSource is /bin/dash)
+			AssertCommand(ub1, "multiubuntu", []string{"bash", "-c", "curl --version"},
+				MatchRegexp("curl"), false,
+			)
+			expectLog := protobuf.Log{
+				Resource: "/usr/bin/curl",
+				Result:   "Passed",
+			}
+			res, err := KarmorGetTargetLogs(5*time.Second, &expectLog)
+			Expect(err).To(BeNil())
+			Expect(res.Found).To(BeTrue())
+
+			// Start KubeArmor Logs
+			err = KarmorLogStart("policy", "multiubuntu", "Process", ub1)
+			Expect(err).To(BeNil())
+
+			// Test 1: curl from bash should be blocked (execname + fromSource match)
+
+			AssertCommand(ub1, "multiubuntu", []string{"bash", "-c", "/bin/dash -c 'curl --version'"},
+				MatchRegexp("curl.*Permission denied"), true,
+			)
+			expect := protobuf.Alert{
+				PolicyName: "ksp-ubuntu-1-block-proc-execname-from-source",
+				Severity:   "5",
+				Action:     "Block",
+				Result:     "Permission denied",
+			}
+
+			res, err = KarmorGetTargetAlert(5*time.Second, &expect)
+			Expect(err).To(BeNil())
+			Expect(res.Found).To(BeTrue())
+		})
+
 	})
 
 	Describe("Apply Files Policies", func() {
```

**File**: `tests/k8s_env/ksp/multiubuntu/ksp-ubuntu-1-block-proc-execname-from-source.yaml` (added, +23/-0)
```diff
@@ -0,0 +1,23 @@
+apiVersion: security.kubearmor.com/v1
+kind: KubeArmorPolicy
+metadata:
+  name: ksp-ubuntu-1-block-proc-execname-from-source
+  namespace: multiubuntu
+spec:
+  severity: 5
+  message: "block executing curl from bash using execname"
+  selector:
+    matchLabels:
+      container: ubuntu-1
+  process:
+    matchPaths:
+    - execname: curl
+      fromSource:
+      - path: /bin/dash
+  action:
+    Block
+
+# Test for issue #1899 fix: execname + fromSource support in BPF-LSM
+# This policy blocks curl execution when called from /bin/dash
+# Before the fix, this would fail - the fromSource check was not implemented for execname
+# After the fix, this should properly block: Dash -c "curl http://example.com"
```

**File**: `tests/util/karmorlog.go` (modified, +0/-1)
```diff
@@ -67,7 +67,6 @@ func KarmorGetTargetLogs(timeout time.Duration, target *pb.Log) (EventResult, er
 			if evtin.Type == "Log" {
 				protojson.Unmarshal(evtin.Data, &logItem)
 				res.Logs = append(res.Logs, &logItem)
-				// fmt.Printf("Log: %s\n", &logItem)
 			} else if evtin.Type != "Alert" {
 				log.Errorf("UNKNOWN EVT type %s", evtin.Type)
 			}
```

---

### Incident Patch 5: `66edf455` (2026-09-09)
**Commit Message**: cert: fix GenerateCA returning nil error on self-signed cert failure (#2802)

* cert: fix GenerateCA returning nil error on self-signed cert failure

When GenerateSelfSignedCert failed inside GenerateCA, the error was logged
and discarded, returning &CertBytes{} with a nil error. This caused callers to
mistakenly treat CA generation failures as successful.

Propagate the error returned by GenerateSelfSignedCert when self-signed certificate
generation fails, ensuring calling code receives error notifications.

Signed-off-by: bhuvan-somisetty <[REDACTED_EMAIL]>

* cert: log self-signed ca cert failure and avoid mutating default CA config in tests

Address review feedback:

- GenerateCA now logs the self-signed cert failure before returning the
  error, matching the logging style used elsewhere in the file.
- cert tests take a value copy of DefaultKubeArmorCAConfig instead of
  taking its address, so the package-level default is not mutated for
  the rest of the test process.

Signed-off-by: bhuvan-somisetty <[REDACTED_EMAIL]>

---------

Signed-off-by: bhuvan-somisetty <[REDACTED_EMAIL]>

**File**: `KubeArmor/cert/cert.go` (modified, +6/-1)
```diff
@@ -208,7 +208,8 @@ func GenerateCA(cfg *CertConfig) (*CertBytes, error) {
 	}
 	crtBytes, err := GenerateSelfSignedCert(crtTemp, cfg)
 	if err != nil {
-		return &CertBytes{}, nil
+		klog.Errorf("error generating self-signed ca cert: %s\n", err)
+		return &CertBytes{}, err
 	}
 	return &CertBytes{
 		Crt: crtBytes.Crt,
@@ -246,6 +247,10 @@ func GenerateCert(cfg *CertConfig) (*CertKeyPair, error) {
 
 // GenerateSelfSignedCert func generates cert and key signed by provided CA
 func GenerateSelfSignedCert(ca *CertKeyPair, cfg *CertConfig) (*CertBytes, error) {
+	if ca == nil || ca.Crt == nil || ca.Key == nil {
+		return nil, fmt.Errorf("invalid CA certificate or key")
+	}
+
 	certKeyPair, err := GenerateCert(cfg)
 	if err != nil {
 		return nil, err
```

**File**: `KubeArmor/cert/cert_test.go` (added, +68/-0)
```diff
@@ -0,0 +1,68 @@
+// SPDX-License-Identifier: Apache-2.0
+// Copyright 2026 Authors of KubeArmor
+
+package cert
+
+import (
+	"testing"
+	"time"
+)
+
+func TestGenerateCA_Success(t *testing.T) {
+	// take a value copy so the package-level default stays untouched
+	cfg := DefaultKubeArmorCAConfig
+	cfg.NotAfter = time.Now().Add(24 * time.Hour)
+
+	caBytes, err := GenerateCA(&cfg)
+	if err != nil {
+		t.Fatalf("expected no error generating CA, got: %v", err)
+	}
+
+	if len(caBytes.Crt) == 0 {
+		t.Errorf("expected non-empty CA certificate bytes")
+	}
+
+	if len(caBytes.Key) == 0 {
+		t.Errorf("expected non-empty CA key bytes")
+	}
+}
+
+func TestGenerateCA_ErrorPropagationOnSelfSignedCertFailure(t *testing.T) {
+	// take a value copy so the package-level default stays untouched
+	cfg := DefaultKubeArmorCAConfig
+
+	// 1. Test GenerateSelfSignedCert with invalid/nil CA struct returns error
+	_, err := GenerateSelfSignedCert(nil, &cfg)
+	if err == nil {
+		t.Errorf("expected error when generating self-signed cert with nil CA, got nil")
+	}
+
+	_, err = GenerateSelfSignedCert(&CertKeyPair{}, &cfg)
+	if err == nil {
+		t.Errorf("expected error when generating self-signed cert with empty CertKeyPair, got nil")
+	}
+
+	// 2. Test GenerateCA error propagation when inner GenerateSelfSignedCert fails with uninitialized CA key
+	invalidCA := &CertKeyPair{}
+	_, err = GenerateSelfSignedCert(invalidCA, &cfg)
+	if err == nil {
+		t.Errorf("expected error from GenerateSelfSignedCert with uninitialized CA key, got nil")
+	}
+}
+
+func TestGetCertPaths(t *testing.T) {
+	caPath := GetCACertPath("/etc/kubearmor")
+	if caPath.CertFile != "ca.crt" || caPath.KeyFile != "ca.key" {
+		t.Errorf("unexpected CA cert paths: %+v", caPath)
+	}
+
+	clientPath := GetClientCertPath("/etc/kubearmor")
+	if clientPath.CertFile != "client.crt" || clientPath.KeyFile != "client.key" {
+		t.Errorf("unexpected client cert paths: %+v", clientPath)
+	}
+
+	serverPath := GetServerCertPath("/etc/kubearmor")
+	if serverPath.CertFile != "server.crt" || serverPath.KeyFile != "server.key" {
+		t.Errorf("unexpected server cert paths: %+v", serverPath)
+	}
+}
```

---

### Incident Patch 6: `a3887c17` (2026-09-08)
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

### Incident Patch 7: `3ff6389c` (2026-09-08)
**Commit Message**: ci: fix controller test (#2882)

Signed-off-by: Aryan Bakliwal <[REDACTED_EMAIL]>

**File**: `.github/workflows/ci-test-controllers.yml` (modified, +11/-2)
```diff
@@ -41,13 +41,22 @@ jobs:
         run: ./.github/workflows/install-k3s.sh
 
       - name: Install the latest LLVM toolchain
-        if: steps.filter.outputs.kubearmor == 'true'
         run: ./.github/workflows/install-llvm.sh
 
       - name: Compile libbpf
-        if: steps.filter.outputs.kubearmor == 'true'
         run: ./.github/workflows/install-libbpf.sh
 
+      - name: Install bpftool
+        run: ./.github/workflows/install-bpftool.sh
+
+      - name: Generate vmlinux.h
+        run: make -C BPF kernel_headers
+        working-directory: KubeArmor
+
+      - name: Generate BPF files
+        run: go generate ./...
+        working-directory: KubeArmor
+
       - name: Generate KubeArmor artifacts
         if: steps.filter.outputs.kubearmor == 'true'
         run: GITHUB_SHA=$GITHUB_SHA ./KubeArmor/build/build_kubearmor.sh
```

---

### Incident Patch 8: `d2b74de4` (2026-08-01)
**Commit Message**: fix: accept boolean OCI hooks values

Signed-off-by: wattmto <[REDACTED_EMAIL]>

**File**: `pkg/KubeArmorOperator/common/defaults.go` (modified, +2/-2)
```diff
@@ -603,9 +603,9 @@ func GetOCIHooks() bool {
 	val := os.Getenv("KUBEARMOR_OCI_HOOKS")
 	if val != "" {
 		switch val {
-		case "yes":
+		case "yes", "true":
 			return true
-		case "no":
+		case "no", "false":
 			return false
 		default:
 			return false
```

**File**: `pkg/KubeArmorOperator/common/defaults_test.go` (added, +27/-0)
```diff
@@ -0,0 +1,27 @@
+// SPDX-License-Identifier: Apache-2.0
+// Copyright 2026 Authors of KubeArmor
+
+package common
+
+import "testing"
+
+func TestGetOCIHooks(t *testing.T) {
+	tests := []struct {
+		name     string
+		value    string
+		expected bool
+	}{
+		{name: "operator", value: "yes", expected: true},
+		{name: "snitch", value: "true", expected: true},
+	}
+
+	for _, tt := range tests {
+		t.Run(tt.name, func(t *testing.T) {
+			t.Setenv("KUBEARMOR_OCI_HOOKS", tt.value)
+
+			if got := GetOCIHooks(); got != tt.expected {
+				t.Errorf("GetOCIHooks() = %v, want %v", got, tt.expected)
+			}
+		})
+	}
+}
```

---

### Incident Patch 9: `1f4f6fb8` (2026-09-02)
**Commit Message**: fix node version and add skip-validate flag (#2859)

Signed-off-by: Aryan-sharma11 <[REDACTED_EMAIL]>

**File**: `.github/workflows/ci-systemd-release.yml` (modified, +2/-2)
```diff
@@ -109,11 +109,11 @@ jobs:
           yq -i '.builds[0].goarch = ["${{ matrix.arch }}"]' /tmp/.goreleaser.yaml
 
       - name: Run GoReleaser
-        uses: goreleaser/goreleaser-action@9c156ee8a17a598857849441385a2041ef570552
+        uses: goreleaser/goreleaser-action@5daf1e915a5f0af01ddbcd89a43b8061ff4f1a89 # v7.2.2
         with:
           distribution: goreleaser
           version: v1.25.0
-          args: release --config=/tmp/.goreleaser.yaml
+          args: release --config=/tmp/.goreleaser.yaml --skip-validate --clean
           workdir: KubeArmor
         env:
           GITHUB_TOKEN: ${{ secrets.GITHUB_TOKEN }}
```

**File**: `.github/workflows/ci-test-systemd.yml` (modified, +1/-1)
```diff
@@ -26,7 +26,7 @@ jobs:
         run: ./.github/workflows/install-libbpf.sh
 
       - name: Install GoReleaser
-        uses: goreleaser/goreleaser-action@b953231f81b8dfd023c58e0854a721e35037f28b # v2
+        uses: goreleaser/goreleaser-action@5daf1e915a5f0af01ddbcd89a43b8061ff4f1a89 # v7.2.2
         with:
           install-only: true
           version: v1.25.0
```

---

### Incident Patch 10: `9832b415` (2026-09-01)
**Commit Message**: fix(ci): fix cd path in systemd release and update scorecard-action to v2.4.4 (#2858)

Signed-off-by: asmit27rai <[REDACTED_EMAIL]>

**File**: `.github/workflows/ci-systemd-release.yml` (modified, +1/-1)
```diff
@@ -93,7 +93,7 @@ jobs:
       - name: Build KubeArmor object files
         run: |
           make
-          cd ../KubeArmor
+          cd ..
           go generate ./...
         working-directory: KubeArmor/BPF
 
```

**File**: `.github/workflows/scorecard.yml` (modified, +1/-1)
```diff
@@ -37,7 +37,7 @@ jobs:
           persist-credentials: false
 
       - name: "Run analysis"
-        uses: ossf/scorecard-action@62b2cac7ed8198b15735ed49ab1e5cf35480ba46 # v2.4.0
+        uses: ossf/scorecard-action@2d1146689b8cda280b9bc96326124645441f03bc # v2.4.4
         with:
           results_file: results.sarif
           results_format: sarif
```

---

### Incident Patch 11: `84cd90f9` (2026-08-31)
**Commit Message**: Integrate SLSA Level 3 provenance, isolated container builds, and code coverage reporting (#2839)

* integrate SLSA Level 3 provenance, Docker build isolation, and code coverage

Signed-off-by: asmit27rai <[REDACTED_EMAIL]>

* upgrade to ubuntu-latest

Signed-off-by: asmit27rai <[REDACTED_EMAIL]>

* fix

Signed-off-by: asmit27rai <[REDACTED_EMAIL]>

* add access continuity, bus factor, and input validation sections for OpenSSF Silver badge

Signed-off-by: asmit27rai <[REDACTED_EMAIL]>

* fix

Signed-off-by: asmit27rai <[REDACTED_EMAIL]>

* fix(docker): pre-install govvv and remove GOPROXY=off on make to fix container build

Signed-off-by: asmit27rai <[REDACTED_EMAIL]>

---------

Signed-off-by: asmit27rai <[REDACTED_EMAIL]>

**File**: `.github/workflows/ci-latest-release.yml` (modified, +24/-2)
```diff
@@ -52,7 +52,13 @@ jobs:
     runs-on: oracle-vm-16cpu-64gb-x86-64
     permissions:
       id-token: write
+      contents: write
     timeout-minutes: 150
+    outputs:
+      imagedigest: ${{ steps.digest.outputs.imagedigest }}
+      initdigest: ${{ steps.digest.outputs.initdigest }}
+      tag: ${{ steps.vars.outputs.tag }}
+      hashes: ${{ steps.digest.outputs.hashes }}
     steps:
       - uses: actions/checkout@34e114876b0b11c390a56381ad16ebd13914f8d5 # v4
         with:
@@ -151,14 +157,30 @@ jobs:
       - name: Get Image Digest
         id: digest
         run: |
-          echo "imagedigest=$(jq -r '.["containerimage.digest"]' kubearmor.json)" >> $GITHUB_OUTPUT
-          echo "initdigest=$(jq -r '.["containerimage.digest"]' kubearmor-init.json)" >> $GITHUB_OUTPUT
+          IMAGEDIGEST=$(jq -r '.["containerimage.digest"]' kubearmor.json)
+          INITDIGEST=$(jq -r '.["containerimage.digest"]' kubearmor-init.json)
+          echo "imagedigest=${IMAGEDIGEST}" >> $GITHUB_OUTPUT
+          echo "initdigest=${INITDIGEST}" >> $GITHUB_OUTPUT
+          echo "hashes=$(echo "${IMAGEDIGEST} kubearmor" | base64 -w0)" >> $GITHUB_OUTPUT
 
       - name: Sign the Container Images
         run: |
           cosign sign -r kubearmor/kubearmor@${{ steps.digest.outputs.imagedigest }} --yes
           cosign sign -r kubearmor/kubearmor-init@${{ steps.digest.outputs.initdigest }} --yes
 
+  provenance:
+    needs: [build]
+    if: github.repository == 'kubearmor/kubearmor' && needs.build.outputs.hashes != ''
+    permissions:
+      actions: read
+      id-token: write
+      contents: write
+    uses: slsa-framework/slsa-github-generator/.github/workflows/generator_generic_slsa3.yml@v2.0.0
+    with:
+      base64-subjects: "${{ needs.build.outputs.hashes }}"
+      upload-assets: true
+      upload-tag-name: ${{ needs.build.outputs.tag }}
+
   push-stable-version:
     name: Create KubeArmor stable release
     needs: [build, check]
```

**File**: `.github/workflows/ci-test-go.yml` (modified, +33/-1)
```diff
@@ -2,7 +2,6 @@ name: ci-test-go
 
 on:
   workflow_call:
-    
 # Declare default permissions as read only.
 permissions: read-all
 
@@ -135,6 +134,39 @@ jobs:
         run: go generate ./...
         working-directory: KubeArmor
 
+      - name: Run go test on the KubeArmor/KubeArmor directory
+        run: go test -coverprofile=coverage.txt -covermode=atomic ./...
+        working-directory: KubeArmor
+
+      - name: Upload code coverage to Codecov
+        uses: codecov/codecov-action@b9fd7d16f6d7d1b5d2bec1a2887e65ceed900238 # v4
+        with:
+          token: ${{ secrets.CODECOV_TOKEN }}
+          files: KubeArmor/coverage.txt
+          flags: unittests
+          fail_ci_if_error: false
+
+  license:
+    runs-on: ubuntu-22.04
+    steps:
+      - uses: actions/checkout@34e114876b0b11c390a56381ad16ebd13914f8d5 # v4
+      - name: Install LLVM/Clang
+        run: ./.github/workflows/install-llvm.sh
+
+      - name: Install libbpf headers
+        run: sudo apt-get update && sudo apt-get install -y libbpf-dev
+
+      - name: Install bpftool
+        run: ./.github/workflows/install-bpftool.sh
+
+      - name: Generate vmlinux.h
+        run: make -C BPF kernel_headers
+        working-directory: KubeArmor
+
+      - name: Generate BPF files
+        run: go generate ./...
+        working-directory: KubeArmor
+
       - name: Run go test on the KubeArmor/KubeArmor directory
         run: go test ./...
         working-directory: KubeArmor
```

**File**: `.github/workflows/slsa-verify.yml` (added, +63/-0)
```diff
@@ -0,0 +1,63 @@
+name: slsa-verify
+
+on:
+  release:
+    types: [published]
+  workflow_dispatch:
+    inputs:
+      tag:
+        description: "Release tag to verify (e.g. v1.7.0)"
+        type: string
+        required: false
+
+permissions: read-all
+
+jobs:
+  verify:
+    name: Verify SLSA Provenance
+    if: github.repository == 'kubearmor/kubearmor'
+    runs-on: ubuntu-latest
+    steps:
+      - name: Checkout code
+        uses: actions/checkout@11bd71901bbe5b1630ceea73d27597364c9af683 # v4.2.2
+
+      - name: Determine tag
+        id: vars
+        run: |
+          if [ "${{ github.event_name }}" = "workflow_dispatch" ] && [ -n "${{ inputs.tag }}" ]; then
+            echo "tag=${{ inputs.tag }}" >> $GITHUB_OUTPUT
+          else
+            echo "tag=${{ github.event.release.tag_name }}" >> $GITHUB_OUTPUT
+          fi
+
+      - name: Install slsa-verifier
+        run: |
+          VERIFIER_VERSION="v2.6.0"
+          curl -sSL "https://github.com/slsa-framework/slsa-verifier/releases/download/${VERIFIER_VERSION}/slsa-verifier-linux-amd64" -o /usr/local/bin/slsa-verifier
+          chmod +x /usr/local/bin/slsa-verifier
+
+      - name: Download release assets
+        env:
+          GH_TOKEN: ${{ secrets.GITHUB_TOKEN }}
+        run: |
+          TAG="${{ steps.vars.outputs.tag }}"
+          mkdir -p release-assets
+          cd release-assets
+          gh release download "$TAG" || echo "No release assets downloaded"
+
+      - name: Verify SLSA Provenance
+        run: |
+          cd release-assets
+          PROVENANCE_FILE=$(ls *.intoto.jsonl 2>/dev/null | head -n 1 || true)
+          if [ -n "$PROVENANCE_FILE" ]; then
+            for artifact in $(ls * 2>/dev/null | grep -v '\.intoto\.jsonl$' | grep -v '\.sig$' | grep -v '\.pem$' || true); do
+              if [ -f "$artifact" ]; then
+                echo "Verifying artifact $artifact against $PROVENANCE_FILE..."
+                slsa-verifier verify-artifact "$artifact" \
+                  --provenance-path "$PROVENANCE_FILE" \
+                  --source-uri "github.com/${{ github.repository }}" || echo "Verification attempted for $artifact"
+              fi
+            done
+          else
+            echo "No .intoto.jsonl provenance file found for tag ${{ steps.vars.outputs.tag }}"
+          fi
```

**File**: `Dockerfile` (modified, +19/-0)
```diff
@@ -10,8 +10,27 @@ RUN apk add --no-cache git clang llvm make gcc protobuf protobuf-dev curl elfuti
 
 WORKDIR /usr/src/KubeArmor
 
+COPY KubeArmor/go.mod KubeArmor/go.sum ./KubeArmor/
+COPY pkg/ ./pkg/
+COPY protobuf/ ./protobuf/
+WORKDIR /usr/src/KubeArmor/KubeArmor
+RUN go mod download && go mod verify
+
+WORKDIR /usr/src/KubeArmor
+
 COPY . .
 
+WORKDIR /usr/src/KubeArmor/KubeArmor
+
+RUN go install google.golang.org/protobuf/cmd/protoc-gen-go@v1.36.11
+RUN go install google.golang.org/grpc/cmd/protoc-gen-go-grpc@v1.6.1
+RUN go install github.com/ahmetb/govvv@v0.3.0
+
+RUN make
+
+WORKDIR /usr/src/KubeArmor/BPF
+
+# install bpftool  
 RUN arch=$(uname -m) bpftool_version=v7.3.0 && \
     if [[ "$arch" == "aarch64" ]]; then \
         arch=arm64; \
```

**File**: `GOVERNANCE.md` (modified, +6/-0)
```diff
@@ -26,6 +26,12 @@ To enforce this in practice:
 - **Communication channels.** Project communication (issues, PRs, design docs, Slack, community calls, blog posts on kubearmor.io) must be conducted in public, project-owned channels — not vendor-owned ones.
 - **Branding.** Project websites, talks, and assets must not present any single company as owning, leading, or initiating the project beyond acknowledging the donating organization (AccuKnox) for historical context.
 
+## Access Continuity and Bus Factor
+
+To ensure continuous project operation and maintain a bus factor of 2 or more:
+- **Access Continuity:** Administrative permissions for the GitHub organization, domain DNS, package registries, and security credentials are shared among multiple active Maintainers from diverse organizations. If any individual Maintainer is unavailable or steps down, remaining Maintainers retain full authority and access rights to continue project releases and operations without interruption.
+- **Bus Factor:** KubeArmor is actively maintained by multiple Maintainers and Reviewers from different organizations (listed in [MAINTAINERS.md](./MAINTAINERS.md)), ensuring no single contributor is a sole bottleneck for code reviews, security fixes, or releases.
+
 ## Roles
 
 KubeArmor recognises four contributor roles plus an honorific tier. Roles are described from least to most responsibility.
```

**File**: `README.md` (modified, +2/-0)
```diff
@@ -4,6 +4,8 @@
 [![CII Best Practices](https://bestpractices.coreinfrastructure.org/projects/5401/badge)](https://bestpractices.coreinfrastructure.org/projects/5401)
 [![CLOMonitor](https://img.shields.io/endpoint?url=https://clomonitor.io/api/projects/cncf/kubearmor/badge)](https://clomonitor.io/projects/cncf/kubearmor)
 [![OpenSSF Scorecard](https://api.securityscorecards.dev/projects/github.com/kubearmor/kubearmor/badge)](https://securityscorecards.dev/viewer/?uri=github.com/kubearmor/KubeArmor)
+[![SLSA Level 3](https://slsa.dev/images/gh-badge-level3.svg)](https://github.com/kubearmor/KubeArmor/actions/workflows/slsa-verify.yml)
+[![codecov](https://codecov.io/gh/kubearmor/KubeArmor/branch/main/graph/badge.svg)](https://codecov.io/gh/kubearmor/KubeArmor)
 [![FOSSA Status](https://app.fossa.com/api/projects/git%2Bgithub.com%2Fkubearmor%2FKubeArmor.svg?type=shield&issueType=license)](https://app.fossa.com/projects/git%2Bgithub.com%2Fkubearmor%2FKubeArmor?ref=badge_shield)
 [![FOSSA Status](https://app.fossa.com/api/projects/git%2Bgithub.com%2Fkubearmor%2FKubeArmor.svg?type=shield&issueType=security)](https://app.fossa.com/projects/git%2Bgithub.com%2Fkubearmor%2FKubeArmor?ref=badge_shield)
 [![Slack](https://img.shields.io/badge/Join%20Our%20Community-Slack-blue)](https://cloud-native.slack.com/archives/C02R319HVL3)
```

**File**: `SECURITY.md` (modified, +7/-0)
```diff
@@ -76,6 +76,13 @@ KubeArmor continuously monitors and audits code quality and security:
 - **Dependency Updates:** Automated dependency updates and digest pinning via Renovate.
 - **Scorecard:** OpenSSF Scorecard supply-chain security monitoring ([`scorecard.yml`](.github/workflows/scorecard.yml)).
 
+## Input Validation and Secure Design
+
+KubeArmor enforces strict input validation across all entry points:
+- **API & gRPC Validation:** All gRPC request payloads are validated against strict Protobuf definitions prior to execution.
+- **Kubernetes CRDs:** Custom Resource Definitions (`KubeArmorPolicy`, `KubeArmorClusterPolicy`, `KubeArmorHostPolicy`) enforce strict OpenAPI v3 validation schemas and field allowlists.
+- **Path & Parameter Sanitization:** System paths, container IDs, eBPF map parameters, and LSM security profile definitions are sanitized to prevent injection or privilege escalation vulnerabilities.
+
 ## Supported Versions
 KubeArmor versions follow [Semantic Versioning](https://semver.org/) terminology (`x.y.z`):
 - Security fixes are backported to the **latest two minor releases**.
```

**File**: `pkg/KubeArmorController/Dockerfile` (modified, +2/-2)
```diff
@@ -10,7 +10,7 @@ COPY go.mod go.mod
 COPY go.sum go.sum
 # cache deps before building and copying source so that we don't need to re-download as much
 # and so that source changes don't invalidate our downloaded layer
-RUN go mod download
+RUN go mod download && go mod verify
 
 # Copy the go source
 COPY cmd/main.go cmd/main.go
@@ -22,7 +22,7 @@ COPY types/ types/
 COPY common/ common/
 
 # Build
-RUN CGO_ENABLED=0 GO111MODULE=on go build -a -o manager cmd/main.go
+RUN CGO_ENABLED=0 GO111MODULE=on GOPROXY=off go build -a -o manager cmd/main.go
 
 # Build controller with scratch as base image
 FROM scratch AS controller
```

---

### Incident Patch 12: `eae0c964` (2026-08-31)
**Commit Message**: chore: fix compiler warning in system monitor (#2848)

* fix compilation warning

Signed-off-by: Aryan-sharma11 <[REDACTED_EMAIL]>

* fix build status badge

Signed-off-by: Aryan-sharma11 <[REDACTED_EMAIL]>

---------

Signed-off-by: Aryan-sharma11 <[REDACTED_EMAIL]>

**File**: `KubeArmor/BPF/system_monitor.c` (modified, +8/-7)
```diff
@@ -126,11 +126,13 @@
 #define PT_REGS_PARM6(x) ((x)->regs[5])
 #endif
 
+#ifndef ntohs
 #if __BYTE_ORDER__ == __ORDER_LITTLE_ENDIAN__
 #define ntohs(x) __builtin_bswap16(x)
 #else
 #define ntohs(x) (x)
 #endif
+#endif
 
 #define UNDEFINED_SYSCALL 1000
 
@@ -2530,11 +2532,11 @@ int kretprobe__inet_csk_accept(struct pt_regs *ctx)
     return 0;
 }
 
-
 #define UDPHDR_LEN 8
 
 SEC("kprobe/udp_send_skb")
-int kprobe__udp_send_skb(struct pt_regs *ctx){
+int kprobe__udp_send_skb(struct pt_regs *ctx)
+{
 
     if (skip_syscall())
         return 0;
@@ -2543,15 +2545,15 @@ int kprobe__udp_send_skb(struct pt_regs *ctx){
         return 0;
 
     struct sk_buff *skb = (struct sk_buff *)PT_REGS_PARM1(ctx);
-    struct flowi4  *fl4 = (struct flowi4 *)PT_REGS_PARM2(ctx);
+    struct flowi4 *fl4 = (struct flowi4 *)PT_REGS_PARM2(ctx);
     if (skb == NULL || fl4 == NULL)
         return 0;
 
     struct sock *sk = NULL;
     bpf_probe_read(&sk, sizeof(sk), &skb->sk);
     if (sk == NULL)
         return 0;
-    
+
     __u16 dport = 0;
     bpf_probe_read(&dport, sizeof(dport), &fl4->uli.ports.dport);
     dport = ntohs(dport);
@@ -2580,18 +2582,17 @@ int kprobe__udp_send_skb(struct pt_regs *ctx){
     if (context.retval >= 0 && drop_syscall(_DNS_PROBE))
         return 0;
 
-     if (context.retval < 0 && !get_kubearmor_config(_ENFORCER_BPFLSM) &&
+    if (context.retval < 0 && !get_kubearmor_config(_ENFORCER_BPFLSM) &&
         get_kubearmor_config(_ALERT_THROTTLING) &&
         should_drop_alerts_per_container(&context, ctx, types, &args))
         return 0;
-    
+
     set_buffer_offset(DNS_BUF_TYPE, sizeof(sys_context_t));
     bufs_t *bufs_p = get_buffer(DNS_BUF_TYPE);
     if (bufs_p == NULL)
         return 0;
     save_context_to_buffer(bufs_p, (void *)&context);
 
-
     struct sock_common conn = READ_KERN(sk->__sk_common);
     struct sockaddr_in sockv4 = {};
     sockv4.sin_family = conn.skc_family;
```

**File**: `README.md` (modified, +1/-1)
```diff
@@ -1,6 +1,6 @@
 ![](.gitbook/assets/logo.png)
 
-[![Build Status](https://github.com/kubearmor/KubeArmor/actions/workflows/ci-test-ginkgo.yml/badge.svg)](https://github.com/kubearmor/KubeArmor/actions/workflows/ci-test-ginkgo.yml/)
+[![Build Status](https://github.com/kubearmor/KubeArmor/actions/workflows/ci-test-suite.yml/badge.svg)](https://github.com/kubearmor/KubeArmor/actions/workflows/ci-test-suite.yml/)
 [![CII Best Practices](https://bestpractices.coreinfrastructure.org/projects/5401/badge)](https://bestpractices.coreinfrastructure.org/projects/5401)
 [![CLOMonitor](https://img.shields.io/endpoint?url=https://clomonitor.io/api/projects/cncf/kubearmor/badge)](https://clomonitor.io/projects/cncf/kubearmor)
 [![OpenSSF Scorecard](https://api.securityscorecards.dev/projects/github.com/kubearmor/kubearmor/badge)](https://securityscorecards.dev/viewer/?uri=github.com/kubearmor/KubeArmor)
```

---

### Incident Patch 13: `f002cebf` (2026-08-28)
**Commit Message**: chore: fix vulns (#2853)

Signed-off-by: Aryan Bakliwal <[REDACTED_EMAIL]>

**File**: `KubeArmor/go.mod` (modified, +4/-4)
```diff
@@ -145,13 +145,13 @@ require (
 	go.uber.org/multierr v1.11.0 // indirect
 	go.yaml.in/yaml/v2 v2.4.4 // indirect
 	go.yaml.in/yaml/v3 v3.0.4 // indirect
-	golang.org/x/crypto v0.54.0 // indirect
-	golang.org/x/mod v0.39.0 // indirect
-	golang.org/x/net v0.57.0 // indirect
+	golang.org/x/crypto v0.55.0 // indirect
+	golang.org/x/mod v0.40.0 // indirect
+	golang.org/x/net v0.58.0 // indirect
 	golang.org/x/oauth2 v0.36.0 // indirect
 	golang.org/x/sync v0.22.0 // indirect
 	golang.org/x/term v0.45.0 // indirect
-	golang.org/x/text v0.40.0 // indirect
+	golang.org/x/text v0.41.0 // indirect
 	golang.org/x/time v0.15.0 // indirect
 	gomodules.xyz/jsonpatch/v2 v2.5.0 // indirect
 	google.golang.org/genproto/googleapis/rpc v0.0.0-20260526163538-3dc84a4a5aaa // indirect
```

**File**: `KubeArmor/go.sum` (modified, +10/-10)
```diff
@@ -353,8 +353,8 @@ go4.org/netipx v0.0.0-20231129151722-fdeea329fbba/go.mod h1:PLyyIXexvUFg3Owu6p/W
 golang.org/x/crypto v0.0.0-20190308221718-c2843e01d9a2/go.mod h1:djNgcEr1/C05ACkg1iLfiJU5Ep61QUkGW8qpdssI0+w=
 golang.org/x/crypto v0.0.0-20191011191535-87dc89f01550/go.mod h1:yigFU9vqHzYiE8UmvKecakEJjdnWj3jj499lnFckfCI=
 golang.org/x/crypto v0.0.0-20200622213623-75b288015ac9/go.mod h1:LzIPMQfyMNhhGPhUkYOs5KpL4U8rLKemX1yGLhDgUto=
-golang.org/x/crypto v0.54.0 h1:YLIA59K4fiNzHzjnZt2tUJQjQtUWfWbeHBqKtk3eScw=
-golang.org/x/crypto v0.54.0/go.mod h1:KWL8ny2AZdGR2cWmzeHrp2azQPGogOv+HeQaVEXC2dk=
+golang.org/x/crypto v0.55.0 h1:+KWHjbgOaAQ66dh/YlkZKHlz9ZUlq61AFirAR9ntP8M=
+golang.org/x/crypto v0.55.0/go.mod h1:uq0V9dE/fzQuJtbnL+2EhWOE63vo164FY8xqEnV9xis=
 golang.org/x/exp v0.0.0-20190121172915-509febef88a4/go.mod h1:CJ0aWSM057203Lf6IL+f9T1iT9GByDxfZKAQTCR3kQA=
 golang.org/x/exp v0.0.0-20260508232706-74f9aab9d74a h1:+3jdDGGB8NGb1Zktc737jlt3/A5f6UlwSzmvqUuufxw=
 golang.org/x/exp v0.0.0-20260508232706-74f9aab9d74a/go.mod h1:d2fgXJLVs4dYDHUk5lwMIfzRzSrWCfGZb0ZqeLa/Vcw=
@@ -365,8 +365,8 @@ golang.org/x/lint v0.0.0-20200302205851-738671d3881b/go.mod h1:3xt1FjdF8hUf6vQPI
 golang.org/x/mod v0.1.1-0.20191105210325-c90efee705ee/go.mod h1:QqPTAvyqsEbceGzBzNggFXnrqF1CaUcvgkdR5Ot7KZg=
 golang.org/x/mod v0.2.0/go.mod h1:s0Qsj1ACt9ePp/hMypM3fl4fZqREWJwdYDEqhRiZZUA=
 golang.org/x/mod v0.3.0/go.mod h1:s0Qsj1ACt9ePp/hMypM3fl4fZqREWJwdYDEqhRiZZUA=
-golang.org/x/mod v0.39.0 h1:UF5zwQdCRRUpHfyPwr7d4UrGiVeldIsogtzWVnczL74=
-golang.org/x/mod v0.39.0/go.mod h1:bvIbwjQ0HUFFf5AKukeeYQG4ZBUG9yxQbR9aEweIwYY=
+golang.org/x/mod v0.40.0 h1:hUv+3cXcdRHz08UmSiOob7sadHig73uo5bkXxQ/tvUs=
+golang.org/x/mod v0.40.0/go.mod h1:0/weTWkPWGBikyTWAX3dkjVztMmBA5hM0DH6BElSupE=
 golang.org/x/net v0.0.0-20180724234803-3673e40ba225/go.mod h1:mL1N/T3taQHkDXs73rZJwtUhF3w3ftmwwsq0BUmARs4=
 golang.org/x/net v0.0.0-20180826012351-8a410e7b638d/go.mod h1:mL1N/T3taQHkDXs73rZJwtUhF3w3ftmwwsq0BUmARs4=
 golang.org/x/net v0.0.0-20190213061140-3a22650c66bd/go.mod h1:mL1N/T3taQHkDXs73rZJwtUhF3w3ftmwwsq0BUmARs4=
@@ -376,8 +376,8 @@ golang.org/x/net v0.0.0-20190620200207-3b0461eec859/go.mod h1:z5CRVTTTmAJ677TzLL
 golang.org/x/net v0.0.0-20200226121028-0de0cce0169b/go.mod h1:z5CRVTTTmAJ677TzLLGU+0bjPO0LkuOLi4/5GtJWs/s=
 golang.org/x/net v0.0.0-20201021035429-f5854403a974/go.mod h1:sp8m0HH+o8qH0wwXwYZr8TS3Oi6o0r6Gce1SSxlDquU=
 golang.org/x/net v0.0.0-20201110031124-69a78807bb2b/go.mod h1:sp8m0HH+o8qH0wwXwYZr8TS3Oi6o0r6Gce1SSxlDquU=
-golang.org/x/net v0.57.0 h1:K5+3DljvIuDG9/Jv9rvyMywYNFCQ9RSUY6OOTTkT+tE=
-golang.org/x/net v0.57.0/go.mod h1:KpXc8iv+r3XplLAG/f7Jsf9RPszJzdR0f58q9vGOuEU=
+golang.org/x/net v0.58.0 h1:ynWG7rqYi4ccpTEuPZ2QGWHktVEM9DMCj9yzDE0Q7To=
+golang.org/x/net v0.58.0/go.mod h1:YwCddHnFlT7eLQqVprV19OnhLGtc5xOKgE0RyqgfWAU=
 golang.org/x/oauth2 v0.0.0-20180821212333-d2e6202438be/go.mod h1:N/0e6XlmueqKjAGxoOufVs8QHGRruUQn6yWY3a++T0U=
 golang.org/x/oauth2 v0.36.0 h1:peZ/1z27fi9hUOFCAZaHyrpWG5lwe0RJEEEeH0ThlIs=
 golang.org/x/oauth2 v0.36.0/go.mod h1:YDBUJMTkDnJS+A4BP4eZBjCqtokkg1hODuPjwiGPO7Q=
@@ -398,8 +398,8 @@ golang.org/x/term v0.45.0 h1:NwWyBmoJCbfTHpxrWoZ9C6/VxOf7ic219I8xZZFdrf0=
 golang.org/x/term v0.45.0/go.mod h1:9aqxs0blBcrm/n0L9QW0aRVD+ktan8ssZromtqJC43w=
 golang.org/x/text v0.3.0/go.mod h1:NqM8EUOU14njkJ3fqMW+pc6Ldnwhi/IjpwHt7yyuwOQ=
 golang.org/x/text v0.3.3/go.mod h1:5Zoc/QRtKVWzQhOtBMvqHzDpF6irO9z98xDceosuGiQ=
-golang.org/x/text v0.40.0 h1:Ub2Z6/xjgF1WrYQz2nuITOEegKFtiIy+rieRJ5lHZKs=
-golang.org/x/text v0.40.0/go.mod h1:hpnzDAfGV753zIKo+wk3u1bVKCGPbrnF7+7LBF/UHVY=
+golang.org/x/text v0.41.0 h1:vz/seA0lnX87Othu2f/0L24RcgrXD9/YFTSuGjj3rH8=
+golang.org/x/text v0.41.0/go.mod h1:jvf1O8ajNzZqhSrQBPbutR/EB83Cc0CFrezNQIwbb5M=
 golang.org/x/time v0.15.0 h1:bbrp8t3bGUeFOx08pvsMYRTCVSMk89u4tKbNOZbp88U=
 golang.org/x/time v0.15.0/go.mod h1:Y4YMaQmXwGQZoFaVFk4YpCt4FLQMYKZe9oeV/f4MSno=
 golang.org/x/tools v0.0.0-20180917221912-90fa682c2a6e/go.mod h1:n7NCudcB/nEzxVGmLbDWY5pfWTLqBcC2KZ6jyYvM4mQ=
@@ -411,8 +411,8 @@ golang.org/x/tools v0.0.0-20191119224855-298f0cb1881e/go.mod h1:b+2E5dAYhXwXZwtn
 golang.org/x/tools v0.0.0-20200130002326-2f3ba24bd6e7/go.mod h1:TB2adYChydJhpapKDTa4BR/hXlZSLoq2Wpct/0txZ28=
 golang.org/x/tools v0.0.0-20200619180055-7c47624df98f/go.mod h1:EkVYQZoAsY45+roYkvgYkIh4xh/qjgUK9TdY2XT94GE=
 golang.org/x/tools v0.0.0-20210106214847-113979e3529a/go.mod h1:emZCQorbCU4vsT4fOWvOPXz4eW1wZW4PmDk9uLelYpA=
-golang.org/x/tools v0.48.0 h1:3+hClM1aLL5mjMKm5ovokw9epgRXPuu2tILgismM6RE=
-golang.org/x/tools v0.48.0/go.mod h1:08xX0orndb/F7jJxGDicx061tyd5pcMto75YMAXr6lk=
+golang.org/x/tools v0.49.0 h1:3NI7VXzL9+1WZD52Dx2ttoPwD5DWrFGpl9mFZDlmisI=
+golang.org/x/tools v0.49.0/go.mod h1:SJNXV9DBKT0UbdttsQjbfJlAE/q+y36++zo3uL3N0Oo=
 golang.org/x/xerrors v0.0.0-20190717185122-a985d3407aa7/go.mod h1:I/5z698sn9Ka8TeJc9MKroUUfqBBauWjQqLJ2OPfmY0=
 golang.org/x/xerrors v0.0.0-20191011141410-1b5146add898/go.mod h1:I/5z698sn9Ka8TeJc9MKroUUfqBBauWjQqLJ2OPfmY0=
 golang.org/x/xerrors v
```

**File**: `deployments/go.mod` (modified, +2/-2)
```diff
@@ -37,9 +37,9 @@ require (
 	go.uber.org/zap v1.28.0 // indirect
 	go.yaml.in/yaml/v2 v2.4.4 // indirect
 	go.yaml.in/yaml/v3 v3.0.4 // indirect
-	golang.org/x/net v0.57.0 // indirect
+	golang.org/x/net v0.58.0 // indirect
 	golang.org/x/sys v0.47.0 // indirect
-	golang.org/x/text v0.40.0 // indirect
+	golang.org/x/text v0.41.0 // indirect
 	gopkg.in/inf.v0 v0.9.1 // indirect
 	k8s.io/apiextensions-apiserver v0.36.1 // indirect
 	k8s.io/klog/v2 v2.140.0 // indirect
```

**File**: `deployments/go.sum` (modified, +4/-4)
```diff
@@ -64,12 +64,12 @@ go.yaml.in/yaml/v2 v2.4.4 h1:tuyd0P+2Ont/d6e2rl3be67goVK4R6deVxCUX5vyPaQ=
 go.yaml.in/yaml/v2 v2.4.4/go.mod h1:gMZqIpDtDqOfM0uNfy0SkpRhvUryYH0Z6wdMYcacYXQ=
 go.yaml.in/yaml/v3 v3.0.4 h1:tfq32ie2Jv2UxXFdLJdh3jXuOzWiL1fo0bu/FbuKpbc=
 go.yaml.in/yaml/v3 v3.0.4/go.mod h1:DhzuOOF2ATzADvBadXxruRBLzYTpT36CKvDb3+aBEFg=
-golang.org/x/net v0.57.0 h1:K5+3DljvIuDG9/Jv9rvyMywYNFCQ9RSUY6OOTTkT+tE=
-golang.org/x/net v0.57.0/go.mod h1:KpXc8iv+r3XplLAG/f7Jsf9RPszJzdR0f58q9vGOuEU=
+golang.org/x/net v0.58.0 h1:ynWG7rqYi4ccpTEuPZ2QGWHktVEM9DMCj9yzDE0Q7To=
+golang.org/x/net v0.58.0/go.mod h1:YwCddHnFlT7eLQqVprV19OnhLGtc5xOKgE0RyqgfWAU=
 golang.org/x/sys v0.47.0 h1:o7XGOvZQCADBQQ4Y7VNq2dRWQR7JmOUW8Kxx4ZsNgWs=
 golang.org/x/sys v0.47.0/go.mod h1:4GL1E5IUh+htKOUEOaiffhrAeqysfVGipDYzABqnCmw=
-golang.org/x/text v0.40.0 h1:Ub2Z6/xjgF1WrYQz2nuITOEegKFtiIy+rieRJ5lHZKs=
-golang.org/x/text v0.40.0/go.mod h1:hpnzDAfGV753zIKo+wk3u1bVKCGPbrnF7+7LBF/UHVY=
+golang.org/x/text v0.41.0 h1:vz/seA0lnX87Othu2f/0L24RcgrXD9/YFTSuGjj3rH8=
+golang.org/x/text v0.41.0/go.mod h1:jvf1O8ajNzZqhSrQBPbutR/EB83Cc0CFrezNQIwbb5M=
 gopkg.in/check.v1 v0.0.0-20161208181325-20d25e280405/go.mod h1:Co6ibVJAznAaIkqp8huTwlJQCZ016jof/cbN4VW5Yz0=
 gopkg.in/check.v1 v1.0.0-20201130134442-10cb98267c6c h1:Hei/4ADfdWqJk1ZMxUNpqntNwaWcugrBjAiHlqqRiVk=
 gopkg.in/check.v1 v1.0.0-20201130134442-10cb98267c6c/go.mod h1:JHkPIbrfpd72SG/EVd6muEfDQjcINNoR0C8j2r3qZ4Q=
```

**File**: `deployments/podman/go.mod` (modified, +16/-16)
```diff
@@ -25,7 +25,7 @@ require (
 	github.com/containerd/log v0.1.0 // indirect
 	github.com/containerd/platforms v1.0.0-rc.4 // indirect
 	github.com/containerd/stargz-snapshotter/estargz v0.18.2 // indirect
-	github.com/containerd/typeurl/v2 v2.2.3 // indirect
+	github.com/containerd/typeurl/v2 v2.3.0 // indirect
 	github.com/containers/libtrust v0.0.0-20230121012942-c1716e8a8d01 // indirect
 	github.com/containers/ocicrypt v1.3.0 // indirect
 	github.com/containers/psgo v1.10.0 // indirect
@@ -35,7 +35,7 @@ require (
 	github.com/disiqueira/gotree/v3 v3.0.2 // indirect
 	github.com/distribution/reference v0.6.0 // indirect
 	github.com/docker/distribution v2.8.3+incompatible // indirect
-	github.com/docker/docker-credential-helpers v0.9.7 // indirect
+	github.com/docker/docker-credential-helpers v0.9.8 // indirect
 	github.com/docker/go-connections v0.7.0 // indirect
 	github.com/docker/go-units v0.5.0 // indirect
 	github.com/felixge/httpsnoop v1.0.4 // indirect
@@ -46,7 +46,6 @@ require (
 	github.com/go-logr/logr v1.4.3 // indirect
 	github.com/go-logr/stdr v1.2.2 // indirect
 	github.com/godbus/dbus/v5 v5.2.2 // indirect
-	github.com/gogo/protobuf v1.3.2 // indirect
 	github.com/golang/protobuf v1.5.4 // indirect
 	github.com/google/go-containerregistry v0.21.6 // indirect
 	github.com/google/go-intervals v0.0.2 // indirect
@@ -68,17 +67,17 @@ require (
 	github.com/mattn/go-sqlite3 v1.14.44 // indirect
 	github.com/miekg/pkcs11 v1.1.2 // indirect
 	github.com/mistifyio/go-zfs/v4 v4.0.0 // indirect
-	github.com/moby/buildkit v0.30.0 // indirect
+	github.com/moby/buildkit v0.31.1 // indirect
 	github.com/moby/docker-image-spec v1.3.1 // indirect
-	github.com/moby/go-archive v0.2.0 // indirect
+	github.com/moby/go-archive v0.3.0 // indirect
 	github.com/moby/moby/api v1.54.2 // indirect
 	github.com/moby/moby/client v0.4.1 // indirect
 	github.com/moby/patternmatcher v0.6.1 // indirect
 	github.com/moby/sys/capability v0.4.0 // indirect
 	github.com/moby/sys/devices v0.1.0 // indirect
 	github.com/moby/sys/mountinfo v0.7.2 // indirect
-	github.com/moby/sys/sequential v0.6.0 // indirect
-	github.com/moby/sys/user v0.4.0 // indirect
+	github.com/moby/sys/sequential v0.7.0 // indirect
+	github.com/moby/sys/user v0.4.1 // indirect
 	github.com/moby/sys/userns v0.1.0 // indirect
 	github.com/moby/term v0.5.2 // indirect
 	github.com/modern-go/concurrent v0.0.0-20180306012644-bacd9c7ef1dd // indirect
@@ -97,7 +96,7 @@ require (
 	github.com/secure-systems-lab/go-securesystemslib v0.11.0 // indirect
 	github.com/sigstore/fulcio v1.8.7 // indirect
 	github.com/sigstore/protobuf-specs v0.5.1 // indirect
-	github.com/sigstore/sigstore v1.10.6 // indirect
+	github.com/sigstore/sigstore v1.10.8 // indirect
 	github.com/sirupsen/logrus v1.9.4 // indirect
 	github.com/skeema/knownhosts v1.3.2 // indirect
 	github.com/smallstep/pkcs7 v0.2.1 // indirect
@@ -110,8 +109,9 @@ require (
 	github.com/vbatts/tar-split v0.12.3 // indirect
 	github.com/vbauerster/mpb/v8 v8.12.1 // indirect
 	github.com/x448/float16 v0.8.4 // indirect
+	github.com/youmark/pkcs8 v0.0.0-20240726163527-a2c0da244d78 // indirect
 	go.opentelemetry.io/auto/sdk v1.2.1 // indirect
-	go.opentelemetry.io/contrib/instrumentation/net/http/otelhttp v0.68.0 // indirect
+	go.opentelemetry.io/contrib/instrumentation/net/http/otelhttp v0.69.0 // indirect
 	go.opentelemetry.io/otel v1.44.0 // indirect
 	go.opentelemetry.io/otel/metric v1.44.0 // indirect
 	go.opentelemetry.io/otel/trace v1.44.0 // indirect
@@ -120,16 +120,16 @@ require (
 	go.podman.io/image/v5 v5.40.0 // indirect
 	go.podman.io/storage v1.63.1-0.20260519201413-7e9ee2072844 // indirect
 	go.yaml.in/yaml/v2 v2.4.4 // indirect
-	golang.org/x/crypto v0.54.0 // indirect
-	golang.org/x/mod v0.39.0 // indirect
-	golang.org/x/net v0.57.0 // indirect
+	golang.org/x/crypto v0.55.0 // indirect
+	golang.org/x/mod v0.40.0 // indirect
+	golang.org/x/net v0.58.0 // indirect
 	golang.org/x/sync v0.22.0 // indirect
 	golang.org/x/sys v0.47.0 // indirect
 	golang.org/x/term v0.45.0 // indirect
-	golang.org/x/text v0.40.0 // indirect
-	golang.org/x/tools v0.48.0 // indirect
-	google.golang.org/genproto/googleapis/api v0.0.0-20260519071638-aa98bba5eb94 // indirect
-	google.golang.org/genproto/googleapis/rpc v0.0.0-20260519071638-aa98bba5eb94 // indirect
+	golang.org/x/text v0.41.0 // indirect
+	golang.org/x/tools v0.49.0 // indirect
+	google.golang.org/genproto/googleapis/api v0.0.0-20260526163538-3dc84a4a5aaa // indirect
+	google.golang.org/genproto/googleapis/rpc v0.0.0-20260526163538-3dc84a4a5aaa // indirect
 	google.golang.org/grpc v1.82.1 // indirect
 	google.golang.org/protobuf v1.36.12-0.20260120151049-f2248ac996af // indirect
 	gopkg.in/inf.v0 v0.9.1 // indirect
```

**File**: `deployments/podman/go.sum` (modified, +38/-58)
```diff
@@ -41,8 +41,8 @@ github.com/containerd/platforms v1.0.0-rc.4 h1:M42JrUT4zfZTqtkUwkr0GzmUWbfyO5VO0
 github.com/containerd/platforms v1.0.0-rc.4/go.mod h1:lKlMXyLybmBedS/JJm11uDofzI8L2v0J2ZbYvNsbq1A=
 github.com/containerd/stargz-snapshotter/estargz v0.18.2 h1:yXkZFYIzz3eoLwlTUZKz2iQ4MrckBxJjkmD16ynUTrw=
 github.com/containerd/stargz-snapshotter/estargz v0.18.2/go.mod h1:XyVU5tcJ3PRpkA9XS2T5us6Eg35yM0214Y+wvrZTBrY=
-github.com/containerd/typeurl/v2 v2.2.3 h1:yNA/94zxWdvYACdYO8zofhrTVuQY73fFU1y++dYSw40=
-github.com/containerd/typeurl/v2 v2.2.3/go.mod h1:95ljDnPfD3bAbDJRugOiShd/DlAAsxGtUBhJxIn7SCk=
+github.com/containerd/typeurl/v2 v2.3.0 h1:HZHPhRWo5XMy3QGQoPrUzbW/2ckwjfweHmOwlkIrPAQ=
+github.com/containerd/typeurl/v2 v2.3.0/go.mod h1:Qk+PAdUYArVj41TnGi6rJ+48RF0PkcTc4i/taoBcK0w=
 github.com/containers/libtrust v0.0.0-20230121012942-c1716e8a8d01 h1:Qzk5C6cYglewc+UyGf6lc8Mj2UaPTHy/iF2De0/77CA=
 github.com/containers/libtrust v0.0.0-20230121012942-c1716e8a8d01/go.mod h1:9rfv8iPl1ZP7aqh9YA68wnZv2NUDbXdcdPHVz0pFbPY=
 github.com/containers/ocicrypt v1.3.0 h1:ps3St6ZWNWhOQ/Kqld6K2wPHt01Mj3AqRTNCZLIWOfo=
@@ -66,12 +66,12 @@ github.com/disiqueira/gotree/v3 v3.0.2 h1:ik5iuLQQoufZBNPY518dXhiO5056hyNBIK9lWh
 github.com/disiqueira/gotree/v3 v3.0.2/go.mod h1:ZuyjE4+mUQZlbpkI24AmruZKhg3VHEgPLDY8Qk+uUu8=
 github.com/distribution/reference v0.6.0 h1:0IXCQ5g4/QMHHkarYzh5l+u8T3t73zM5QvfrDyIgxBk=
 github.com/distribution/reference v0.6.0/go.mod h1:BbU0aIcezP1/5jX/8MP0YiH4SdvB5Y4f/wlDRiLyi3E=
-github.com/docker/cli v29.5.1+incompatible h1:NiufLAJoRcPauFoBNYthfuM4REFwM8H2h9xnLABNHGs=
-github.com/docker/cli v29.5.1+incompatible/go.mod h1:JLrzqnKDaYBop7H2jaqPtU4hHvMKP+vjCwu2uszcLI8=
+github.com/docker/cli v29.5.3+incompatible h1:nbEFfz774vBwQ5KRYv7c/AghjReqnGISvrRhzjV0evs=
+github.com/docker/cli v29.5.3+incompatible/go.mod h1:JLrzqnKDaYBop7H2jaqPtU4hHvMKP+vjCwu2uszcLI8=
 github.com/docker/distribution v2.8.3+incompatible h1:AtKxIZ36LoNK51+Z6RpzLpddBirtxJnzDrHLEKxTAYk=
 github.com/docker/distribution v2.8.3+incompatible/go.mod h1:J2gT2udsDAN96Uj4KfcMRqY0/ypR+oyYUYmja8H+y+w=
-github.com/docker/docker-credential-helpers v0.9.7 h1:jaPIxEIDz5bQeghNAdzz0ETwMMnM4vzjZlxz3pWP4JA=
-github.com/docker/docker-credential-helpers v0.9.7/go.mod h1:v1S+hepowrQXITkEfw6o4+BMbGot02wiKpzWhGUZK6c=
+github.com/docker/docker-credential-helpers v0.9.8 h1:bIREROb7So6PRlq6KTtdS9MPEjC29OQRkFNlvK2OX8Q=
+github.com/docker/docker-credential-helpers v0.9.8/go.mod h1:v1S+hepowrQXITkEfw6o4+BMbGot02wiKpzWhGUZK6c=
 github.com/docker/go-connections v0.7.0 h1:6SsRfJddP22WMrCkj19x9WKjEDTB+ahsdiGYf0mN39c=
 github.com/docker/go-connections v0.7.0/go.mod h1:no1qkHdjq7kLMGUXYAduOhYPSJxxvgWBh7ogVvptn3Q=
 github.com/docker/go-units v0.5.0 h1:69rxXcBk27SvSaaxTtLh/8llcHD8vYHT7WSdRZ/jvr4=
@@ -96,8 +96,6 @@ github.com/go-task/slim-sprig/v3 v3.0.0 h1:sUs3vkvUymDpBKi3qH1YSqBQk9+9D/8M2mN1v
 github.com/go-task/slim-sprig/v3 v3.0.0/go.mod h1:W848ghGpv3Qj3dhTPRyJypKRiqCdHZiAzKg9hl15HA8=
 github.com/godbus/dbus/v5 v5.2.2 h1:TUR3TgtSVDmjiXOgAAyaZbYmIeP3DPkld3jgKGV8mXQ=
 github.com/godbus/dbus/v5 v5.2.2/go.mod h1:3AAv2+hPq5rdnr5txxxRwiGjPXamgoIHgz9FPBfOp3c=
-github.com/gogo/protobuf v1.3.2 h1:Ov1cvc58UF3b5XjBnZv7+opcTcQFZebYjWzi34vdm4Q=
-github.com/gogo/protobuf v1.3.2/go.mod h1:P1XiOD3dCwIKUDQYPy72D8LYyHL2YPYrpS2s69NZV8Q=
 github.com/golang/protobuf v1.5.4 h1:i7eJL8qZTpSEXOPTxNKhASYpMn+8e5Q6AdndVa1dWek=
 github.com/golang/protobuf v1.5.4/go.mod h1:lnTiLA8Wa4RWRcIUkrtSVa5nRhsEGBg48fD6rSs7xps=
 github.com/google/go-cmp v0.6.0/go.mod h1:17dUlkBOakJ0+DkrSSNjCkIjxS6bF9zb3elmeNGIjoY=
@@ -130,8 +128,6 @@ github.com/json-iterator/go v1.1.12 h1:PV8peI4a0ysnczrg+LtxykD8LfKY9ML6u2jnxaEnr
 github.com/json-iterator/go v1.1.12/go.mod h1:e30LSqwooZae/UwlEbR2852Gd8hjQvJoHmT4TnhNGBo=
 github.com/kevinburke/ssh_config v1.6.0 h1:J1FBfmuVosPHf5GRdltRLhPJtJpTlMdKTBjRgTaQBFY=
 github.com/kevinburke/ssh_config v1.6.0/go.mod h1:q2RIzfka+BXARoNexmF9gkxEX7DmvbW9P4hIVx2Kg4M=
-github.com/kisielk/errcheck v1.5.0/go.mod h1:pFxgyoBC7bSaBwPgfKdkLd5X25qrDl4LWUI2bnpBCr8=
-github.com/kisielk/gotool v1.0.0/go.mod h1:XhKaO+MFFWcvkIS/tQcRk01m1F5IRFswLeQ+oQHNcck=
 github.com/klauspost/compress v1.18.7 h1:aUyZsS4kH3QTKurYhAOwAHxllVPnOthb3vPfnF1Ehjw=
 github.com/klauspost/compress v1.18.7/go.mod h1:cwPg85FWrGar70rWktvGQj8/hthj3wpl0PGDogxkrSQ=
 github.com/klauspost/pgzip v1.2.6 h1:8RXeL5crjEUFnR2/Sn6GJNWtSQ3Dk8pq4CL3jvdDyjU=
@@ -156,12 +152,12 @@ github.com/miekg/pkcs11 v1.1.2 h1:/VxmeAX5qU6Q3EwafypogwWbYryHFmF2RpkJmw3m4MQ=
 github.com/miekg/pkcs11 v1.1.2/go.mod h1:XsNlhZGX73bx86s2hdc/FuaLm2CPZJemRLMA+WTFxgs=
 github.com/mistifyio/go-zfs/v4 v4.0.0 h1:sU0+5dX45tdDK5xNZ3HBi95nxUc48FS92qbIZEvpAg4=
 github.com/mistifyio/go-zfs/v4 v4.0.0/go.mod h1:weotFtXTHvBwhr9Mv96KYnDkTPBOHFUbm9cBmQpesL0=
-github.com/moby/buildkit v0.30.0 h1:OsK8T3BaYH52UNStpKd7gytDtHWWt2Fawak/lAPWatU=
-github.com/moby/buildkit v0.30.0/go.mod h1:k2wuw5ddaOqzh58RLt+mBn2XhK34gi6+gd0faONQ1xU=
+github.com/moby/buildkit v0.31.1 h1:j3p55abBl4kiXXPZgYX+6zWgB2aefqHXoPown12
```

**File**: `pkg/KubeArmorController/go.mod` (modified, +5/-5)
```diff
@@ -47,7 +47,7 @@ require (
 	github.com/go-openapi/swag/typeutils v0.26.0 // indirect
 	github.com/go-openapi/swag/yamlutils v0.26.0 // indirect
 	github.com/go-task/slim-sprig/v3 v3.0.0 // indirect
-	github.com/google/cel-go v0.29.0 // indirect
+	github.com/google/cel-go v0.30.0 // indirect
 	github.com/google/gnostic-models v0.7.1 // indirect
 	github.com/google/go-cmp v0.7.0 // indirect
 	github.com/google/pprof v0.0.0-20250403155104-27863c87afa6 // indirect
@@ -81,15 +81,15 @@ require (
 	go.yaml.in/yaml/v2 v2.4.4 // indirect
 	go.yaml.in/yaml/v3 v3.0.4 // indirect
 	golang.org/x/exp v0.0.0-20260508232706-74f9aab9d74a // indirect
-	golang.org/x/mod v0.39.0 // indirect
-	golang.org/x/net v0.57.0 // indirect
+	golang.org/x/mod v0.40.0 // indirect
+	golang.org/x/net v0.58.0 // indirect
 	golang.org/x/oauth2 v0.36.0 // indirect
 	golang.org/x/sync v0.22.0 // indirect
 	golang.org/x/sys v0.47.0 // indirect
 	golang.org/x/term v0.45.0 // indirect
-	golang.org/x/text v0.40.0 // indirect
+	golang.org/x/text v0.41.0 // indirect
 	golang.org/x/time v0.15.0 // indirect
-	golang.org/x/tools v0.48.0 // indirect
+	golang.org/x/tools v0.49.0 // indirect
 	gomodules.xyz/jsonpatch/v2 v2.5.0 // indirect
 	google.golang.org/genproto/googleapis/api v0.0.0-20260526163538-3dc84a4a5aaa // indirect
 	google.golang.org/genproto/googleapis/rpc v0.0.0-20260526163538-3dc84a4a5aaa // indirect
```

**File**: `pkg/KubeArmorController/go.sum` (modified, +10/-10)
```diff
@@ -82,8 +82,8 @@ github.com/goccy/go-yaml v1.18.0 h1:8W7wMFS12Pcas7KU+VVkaiCng+kG8QiFeFwzFb+rwuw=
 github.com/goccy/go-yaml v1.18.0/go.mod h1:XBurs7gK8ATbW4ZPGKgcbrY1Br56PdM69F7LkFRi1kA=
 github.com/golang/protobuf v1.5.4 h1:i7eJL8qZTpSEXOPTxNKhASYpMn+8e5Q6AdndVa1dWek=
 github.com/golang/protobuf v1.5.4/go.mod h1:lnTiLA8Wa4RWRcIUkrtSVa5nRhsEGBg48fD6rSs7xps=
-github.com/google/cel-go v0.29.0 h1:fEG+Ja3YRwNOqnQxTyJwoByAUAvTuxUGiro/jhrm4F4=
-github.com/google/cel-go v0.29.0/go.mod h1:X0bD6iVNR8pkROSOoHVdgTkzmRcosof7WQqCD6wcMc8=
+github.com/google/cel-go v0.30.0 h1:ll54AkzKunWkBn9wSoiUXbFZXYZTkdJGNXTBXUoolGo=
+github.com/google/cel-go v0.30.0/go.mod h1:X0bD6iVNR8pkROSOoHVdgTkzmRcosof7WQqCD6wcMc8=
 github.com/google/gnostic-models v0.7.1 h1:SisTfuFKJSKM5CPZkffwi6coztzzeYUhc3v4yxLWH8c=
 github.com/google/gnostic-models v0.7.1/go.mod h1:whL5G0m6dmc5cPxKc5bdKdEN3UjI7OUGxBlw57miDrQ=
 github.com/google/go-cmp v0.7.0 h1:wk8382ETsv4JYUZwIsn6YpYiWiBsYLSJiTsyBybVuN8=
@@ -196,10 +196,10 @@ go.yaml.in/yaml/v3 v3.0.4 h1:tfq32ie2Jv2UxXFdLJdh3jXuOzWiL1fo0bu/FbuKpbc=
 go.yaml.in/yaml/v3 v3.0.4/go.mod h1:DhzuOOF2ATzADvBadXxruRBLzYTpT36CKvDb3+aBEFg=
 golang.org/x/exp v0.0.0-20260508232706-74f9aab9d74a h1:+3jdDGGB8NGb1Zktc737jlt3/A5f6UlwSzmvqUuufxw=
 golang.org/x/exp v0.0.0-20260508232706-74f9aab9d74a/go.mod h1:d2fgXJLVs4dYDHUk5lwMIfzRzSrWCfGZb0ZqeLa/Vcw=
-golang.org/x/mod v0.39.0 h1:UF5zwQdCRRUpHfyPwr7d4UrGiVeldIsogtzWVnczL74=
-golang.org/x/mod v0.39.0/go.mod h1:bvIbwjQ0HUFFf5AKukeeYQG4ZBUG9yxQbR9aEweIwYY=
-golang.org/x/net v0.57.0 h1:K5+3DljvIuDG9/Jv9rvyMywYNFCQ9RSUY6OOTTkT+tE=
-golang.org/x/net v0.57.0/go.mod h1:KpXc8iv+r3XplLAG/f7Jsf9RPszJzdR0f58q9vGOuEU=
+golang.org/x/mod v0.40.0 h1:hUv+3cXcdRHz08UmSiOob7sadHig73uo5bkXxQ/tvUs=
+golang.org/x/mod v0.40.0/go.mod h1:0/weTWkPWGBikyTWAX3dkjVztMmBA5hM0DH6BElSupE=
+golang.org/x/net v0.58.0 h1:ynWG7rqYi4ccpTEuPZ2QGWHktVEM9DMCj9yzDE0Q7To=
+golang.org/x/net v0.58.0/go.mod h1:YwCddHnFlT7eLQqVprV19OnhLGtc5xOKgE0RyqgfWAU=
 golang.org/x/oauth2 v0.36.0 h1:peZ/1z27fi9hUOFCAZaHyrpWG5lwe0RJEEEeH0ThlIs=
 golang.org/x/oauth2 v0.36.0/go.mod h1:YDBUJMTkDnJS+A4BP4eZBjCqtokkg1hODuPjwiGPO7Q=
 golang.org/x/sync v0.22.0 h1:SZjpbeLmrCk4xhRSZFNZW5gFUeCeFgjekvI/+gfScek=
@@ -208,12 +208,12 @@ golang.org/x/sys v0.47.0 h1:o7XGOvZQCADBQQ4Y7VNq2dRWQR7JmOUW8Kxx4ZsNgWs=
 golang.org/x/sys v0.47.0/go.mod h1:4GL1E5IUh+htKOUEOaiffhrAeqysfVGipDYzABqnCmw=
 golang.org/x/term v0.45.0 h1:NwWyBmoJCbfTHpxrWoZ9C6/VxOf7ic219I8xZZFdrf0=
 golang.org/x/term v0.45.0/go.mod h1:9aqxs0blBcrm/n0L9QW0aRVD+ktan8ssZromtqJC43w=
-golang.org/x/text v0.40.0 h1:Ub2Z6/xjgF1WrYQz2nuITOEegKFtiIy+rieRJ5lHZKs=
-golang.org/x/text v0.40.0/go.mod h1:hpnzDAfGV753zIKo+wk3u1bVKCGPbrnF7+7LBF/UHVY=
+golang.org/x/text v0.41.0 h1:vz/seA0lnX87Othu2f/0L24RcgrXD9/YFTSuGjj3rH8=
+golang.org/x/text v0.41.0/go.mod h1:jvf1O8ajNzZqhSrQBPbutR/EB83Cc0CFrezNQIwbb5M=
 golang.org/x/time v0.15.0 h1:bbrp8t3bGUeFOx08pvsMYRTCVSMk89u4tKbNOZbp88U=
 golang.org/x/time v0.15.0/go.mod h1:Y4YMaQmXwGQZoFaVFk4YpCt4FLQMYKZe9oeV/f4MSno=
-golang.org/x/tools v0.48.0 h1:3+hClM1aLL5mjMKm5ovokw9epgRXPuu2tILgismM6RE=
-golang.org/x/tools v0.48.0/go.mod h1:08xX0orndb/F7jJxGDicx061tyd5pcMto75YMAXr6lk=
+golang.org/x/tools v0.49.0 h1:3NI7VXzL9+1WZD52Dx2ttoPwD5DWrFGpl9mFZDlmisI=
+golang.org/x/tools v0.49.0/go.mod h1:SJNXV9DBKT0UbdttsQjbfJlAE/q+y36++zo3uL3N0Oo=
 gomodules.xyz/jsonpatch/v2 v2.5.0 h1:JELs8RLM12qJGXU4u/TO3V25KW8GreMKl9pdkk14RM0=
 gomodules.xyz/jsonpatch/v2 v2.5.0/go.mod h1:AH3dM2RI6uoBZxn3LVrfvJ3E0/9dG4cSrbuBJT4moAY=
 gonum.org/v1/gonum v0.17.0 h1:VbpOemQlsSMrYmn7T2OUvQ4dqxQXU+ouZFQsZOx50z4=
```

---

### Incident Patch 14: `e46f112e` (2026-07-27)
**Commit Message**: fix: pin all dependencies for OpenSSF Scorecard Pinned-Dependencies check (#2706)

* pin Dockerfile base images and GitHub Actions to SHA256 digests for Pinned-Dependencies scorecard

Signed-off-by: asmit27rai <[REDACTED_EMAIL]>

* pin remaining container images, go commands and downloadThenRun

Signed-off-by: asmit27rai <[REDACTED_EMAIL]>

* replace curl|sh with download-then-run and pin go commands for Pinned-Dependencies

Signed-off-by: asmit27rai <[REDACTED_EMAIL]>

* pin remaining downloadThenrun

Signed-off-by: asmit27rai <[REDACTED_EMAIL]>

* replace wget|bash with apt-get install in llvm

Signed-off-by: asmit27rai <[REDACTED_EMAIL]>

* replace wget|bash llvm with apt-get install

Signed-off-by: asmit27rai <[REDACTED_EMAIL]>

* fix renovate.json

Signed-off-by: asmit27rai <[REDACTED_EMAIL]>

* removed deduplication

Signed-off-by: asmit27rai <[REDACTED_EMAIL]>

* remove redundant pip install, flask already installed via apt

Signed-off-by: asmit27rai <[REDACTED_EMAIL]>

* use pseudo-version for modocache/gover instead of bare commit SHA

Signed-off-by: asmit27rai <[REDACTED_EMAIL]>

* changed the sha to use go:1.26.5

Signed-off-by: asmit27rai <[REDACTED_EMAIL]>

* correctio

**File**: `.github/workflows/ci-codespell.yml` (modified, +2/-2)
```diff
@@ -21,9 +21,9 @@ jobs:
     runs-on: ubuntu-latest
     steps:
       - name: Checkout code
-        uses: actions/checkout@v4
+        uses: actions/checkout@34e114876b0b11c390a56381ad16ebd13914f8d5 # v4
 
       - name: Run codespell
-        uses: codespell-project/actions-codespell@v2
+        uses: codespell-project/actions-codespell@406322ec52dd7b488e48c1c4b82e2a8b3a1bf630 # v2
         with:
           check_hidden: true
```

**File**: `.github/workflows/ci-latest-release.yml` (modified, +26/-32)
```diff
@@ -7,7 +7,7 @@ on:
         description: "Release tag which has to be updated"
         type: "string"
         required: false
-  push: 
+  push:
     branches:
       - "main"
       - "v*"
@@ -35,16 +35,16 @@ jobs:
       kubearmor: ${{ steps.filter.outputs.kubearmor}}
       controller: ${{ steps.filter.outputs.controller }}
     steps:
-    - uses: actions/checkout@34e114876b0b11c390a56381ad16ebd13914f8d5 # v4
-    - uses: dorny/paths-filter@4512585405083f25c027a35db413c2b3b9006d50 # v2
-      id: filter
-      with:
-        filters: |
-          kubearmor:
-            - "KubeArmor/**"
-            - "protobuf/**"
-          controller:
-            - 'pkg/KubeArmorController/**'
+      - uses: actions/checkout@34e114876b0b11c390a56381ad16ebd13914f8d5 # v4
+      - uses: dorny/paths-filter@4512585405083f25c027a35db413c2b3b9006d50 # v2
+        id: filter
+        with:
+          filters: |
+            kubearmor:
+              - "KubeArmor/**"
+              - "protobuf/**"
+            controller:
+              - 'pkg/KubeArmorController/**'
   build:
     name: Create KubeArmor latest release
     needs: [check]
@@ -60,7 +60,7 @@ jobs:
 
       - uses: actions/setup-go@40f1582b2485089dde7abd97c1529aa768e1baff # v5
         with:
-          go-version-file: 'KubeArmor/go.mod'
+          go-version-file: "KubeArmor/go.mod"
       - name: Install the latest LLVM toolchain
         run: ./.github/workflows/install-llvm.sh
 
@@ -99,20 +99,20 @@ jobs:
               "features": {
                 "containerd-snapshotter": true
               }
-            }      
+            }
       - name: Login to Docker Hub
         uses: docker/login-action@465a07811f14bebb1938fbed4728c6a1ff8901fc # v2
         with:
           username: ${{ secrets.DOCKER_USERNAME }}
-          password: ${{ secrets.DOCKER_AUTHTOK }}  
+          password: ${{ secrets.DOCKER_AUTHTOK }}
 
       # - name: Set up AWS Credentials
       #   uses: aws-actions/configure-aws-credentials@v6
       #   with:
       #     aws-access-key-id: ${{ secrets.AWS_ECR_ACCESS_ID }}
       #     aws-secret-access-key: ${{ secrets.AWS_ECR_SECRET_ID }}
       #     aws-region: us-east-1
-  
+
       # - name: Login to AWS ECR
       #   run: |
       #     aws ecr-public get-login-password --region us-east-1 | docker login --username AWS --password-stdin public.ecr.aws/k9v9d5v2
@@ -130,8 +130,7 @@ jobs:
           REGCTL_VERSION: v0.11.5
           REGCTL_SHA256: c93aa7638749f5aaac1a8e01787321889c78f0101809bb2880343478d0ba0467
         run: |
-          curl -fsSL "https://github.com/regclient/regclient/releases/download/${REGCTL_VERSION}/regctl-linux-amd64" -o regctl
-          echo "${REGCTL_SHA256}  regctl" | sha256sum -c -
+          curl -L https://github.com/regclient/regclient/releases/latest/download/regctl-linux-amd64 -o regctl
           chmod 755 regctl
           mv regctl /usr/local/bin/regctl
 
@@ -145,7 +144,7 @@ jobs:
       #   run: |
       #     regctl image copy kubearmor/kubearmor:${{ steps.vars.outputs.tag }} public.ecr.aws/k9v9d5v2/kubearmor/kubearmor:${{ steps.vars.outputs.tag }} --digest-tags
       #     regctl image copy kubearmor/kubearmor-init:${{ steps.vars.outputs.tag }} public.ecr.aws/k9v9d5v2/kubearmor/kubearmor-init:${{ steps.vars.outputs.tag }} --digest-tags
-        
+
       - name: Install Cosign
         uses: sigstore/cosign-installer@6f9f17788090df1f26f669e9d70d6ae9567deba6 # main
 
@@ -160,7 +159,6 @@ jobs:
           cosign sign -r kubearmor/kubearmor@${{ steps.digest.outputs.imagedigest }} --yes
           cosign sign -r kubearmor/kubearmor-init@${{ steps.digest.outputs.initdigest }} --yes
 
-
   push-stable-version:
     name: Create KubeArmor stable release
     needs: [build, check]
@@ -179,8 +177,7 @@ jobs:
           REGCTL_VERSION: v0.11.5
           REGCTL_SHA256: c93aa7638749f5aaac1a8e01787321889c78f0101809bb2880343478d0ba0467
         run: |
-          curl -fsSL "https://github.com/regclient/regclient/releases/download/${REGCTL_VERSION}/regctl-linux-amd64" -o regctl
-          echo "${REGCTL_SHA256}  regctl" | sha256sum -c -
+          curl -L https://github.com/regclient/regclient/releases/latest/download/regctl-linux-amd64 -o regctl
           chmod 755 regctl
           mv regctl /usr/local/bin/regctl
 
@@ -198,27 +195,26 @@ jobs:
             const isMatch = ref === `refs/heads/${stableBranch}`;
             core.setOutput('tag', isMatch.toString());
 
-
       - name: Login to Docker Hub
         if: steps.match.outputs.tag == 'true'
         uses: docker/login-action@465a07811f14bebb1938fbed4728c6a1ff8901fc # v2
         with:
           username: ${{ secrets.DOCKER_USERNAME }}
           password: ${{ secrets.DOCKER_AUTHTOK }}
-              
+
       # - name: Set up AWS Credentials
       #   if: steps.match.outputs.tag == 'true'
       #   uses: aws-actions/configure-aws-credentials@v6
       #   with:
       #     aws-access-key-id: ${{ secrets.AWS_ECR_ACCESS_ID }}
       #     aws-
```

**File**: `.github/workflows/ci-latest-ubi-release.yml` (modified, +25/-31)
```diff
@@ -7,7 +7,7 @@ on:
         description: "Release tag which has to be updated"
         type: "string"
         required: false
-  push: 
+  push:
     branches:
       - "main"
       - "v*"
@@ -35,16 +35,16 @@ jobs:
       kubearmor: ${{ steps.filter.outputs.kubearmor}}
       controller: ${{ steps.filter.outputs.controller }}
     steps:
-    - uses: actions/checkout@34e114876b0b11c390a56381ad16ebd13914f8d5 # v4
-    - uses: dorny/paths-filter@4512585405083f25c027a35db413c2b3b9006d50 # v2
-      id: filter
-      with:
-        filters: |
-          kubearmor:
-            - "KubeArmor/**"
-            - "protobuf/**"
-          controller:
-            - 'pkg/KubeArmorController/**'
+      - uses: actions/checkout@34e114876b0b11c390a56381ad16ebd13914f8d5 # v4
+      - uses: dorny/paths-filter@4512585405083f25c027a35db413c2b3b9006d50 # v2
+        id: filter
+        with:
+          filters: |
+            kubearmor:
+              - "KubeArmor/**"
+              - "protobuf/**"
+            controller:
+              - 'pkg/KubeArmorController/**'
   build:
     name: Create KubeArmor latest release
     needs: [check]
@@ -60,7 +60,7 @@ jobs:
 
       - uses: actions/setup-go@40f1582b2485089dde7abd97c1529aa768e1baff # v5
         with:
-          go-version-file: 'KubeArmor/go.mod'
+          go-version-file: "KubeArmor/go.mod"
       - name: Install the latest LLVM toolchain
         run: ./.github/workflows/install-llvm.sh
 
@@ -99,20 +99,20 @@ jobs:
               "features": {
                 "containerd-snapshotter": true
               }
-            }      
+            }
       - name: Login to Docker Hub
         uses: docker/login-action@465a07811f14bebb1938fbed4728c6a1ff8901fc # v2
         with:
           username: ${{ secrets.DOCKER_USERNAME }}
-          password: ${{ secrets.DOCKER_AUTHTOK }}  
+          password: ${{ secrets.DOCKER_AUTHTOK }}
 
       # - name: Set up AWS Credentials
       #   uses: aws-actions/configure-aws-credentials@v6
       #   with:
       #     aws-access-key-id: ${{ secrets.AWS_ECR_ACCESS_ID }}
       #     aws-secret-access-key: ${{ secrets.AWS_ECR_SECRET_ID }}
       #     aws-region: us-east-1
-  
+
       # - name: Login to AWS ECR
       #   run: |
       #     aws ecr-public get-login-password --region us-east-1 | docker login --username AWS --password-stdin public.ecr.aws/k9v9d5v2
@@ -130,8 +130,7 @@ jobs:
           REGCTL_VERSION: v0.11.5
           REGCTL_SHA256: c93aa7638749f5aaac1a8e01787321889c78f0101809bb2880343478d0ba0467
         run: |
-          curl -fsSL "https://github.com/regclient/regclient/releases/download/${REGCTL_VERSION}/regctl-linux-amd64" -o regctl
-          echo "${REGCTL_SHA256}  regctl" | sha256sum -c -
+          curl -L https://github.com/regclient/regclient/releases/latest/download/regctl-linux-amd64 -o regctl
           chmod 755 regctl
           mv regctl /usr/local/bin/regctl
 
@@ -160,7 +159,6 @@ jobs:
           cosign sign -r kubearmor/kubearmor-ubi@${{ steps.digest.outputs.imagedigest }} --yes
           cosign sign -r kubearmor/kubearmor-init-ubi@${{ steps.digest.outputs.initdigest }} --yes
 
-
   push-stable-version:
     name: Create KubeArmor stable release
     needs: [build, check]
@@ -179,8 +177,7 @@ jobs:
           REGCTL_VERSION: v0.11.5
           REGCTL_SHA256: c93aa7638749f5aaac1a8e01787321889c78f0101809bb2880343478d0ba0467
         run: |
-          curl -fsSL "https://github.com/regclient/regclient/releases/download/${REGCTL_VERSION}/regctl-linux-amd64" -o regctl
-          echo "${REGCTL_SHA256}  regctl" | sha256sum -c -
+          curl -L https://github.com/regclient/regclient/releases/latest/download/regctl-linux-amd64 -o regctl
           chmod 755 regctl
           mv regctl /usr/local/bin/regctl
 
@@ -198,27 +195,26 @@ jobs:
             const isMatch = ref === `refs/heads/${stableBranch}`;
             core.setOutput('tag', isMatch.toString());
 
-
       - name: Login to Docker Hub
         if: steps.match.outputs.tag == 'true'
         uses: docker/login-action@465a07811f14bebb1938fbed4728c6a1ff8901fc # v2
         with:
           username: ${{ secrets.DOCKER_USERNAME }}
           password: ${{ secrets.DOCKER_AUTHTOK }}
-              
+
       # - name: Set up AWS Credentials
       #   if: steps.match.outputs.tag == 'true'
       #   uses: aws-actions/configure-aws-credentials@v6
       #   with:
       #     aws-access-key-id: ${{ secrets.AWS_ECR_ACCESS_ID }}
       #     aws-secret-access-key: ${{ secrets.AWS_ECR_SECRET_ID }}
       #     aws-region: us-east-1
-  
+
       # - name: Login to AWS ECR
       #   if: steps.match.outputs.tag == 'true'
       #   run: |
       #     aws ecr-public get-login-password --region us-east-1 | docker login --username AWS --password-stdin public.ecr.aws/k9v9d5v2
-            
+
       - name: Generate the stable version of KubeArmor in Docker Hub
         if: steps.match.outputs.tag == 'true'
         run: |
@@ -243,7 +239,7 @@ jobs:
     runs-o
```

**File**: `.github/workflows/ci-marketplace-release.yml` (modified, +22/-19)
```diff
@@ -64,7 +64,7 @@ jobs:
       - uses: actions/checkout@34e114876b0b11c390a56381ad16ebd13914f8d5 # v4
 
       - name: Configure AWS credentials
-        uses: aws-actions/configure-aws-credentials@d979d5b3a71173a29b74b5b88418bfda9437d885 # v6
+        uses: aws-actions/configure-aws-credentials@e7f100cf4c008499ea8adda475de1042d6975c7b # v6
         with:
           aws-access-key-id: ${{ secrets.AWS_ACCESS_KEY_ID }}
           aws-secret-access-key: ${{ secrets.AWS_SECRET_ACCESS_KEY }}
@@ -79,8 +79,7 @@ jobs:
           REGCTL_VERSION: v0.11.5
           REGCTL_SHA256: c93aa7638749f5aaac1a8e01787321889c78f0101809bb2880343478d0ba0467
         run: |
-          curl -fsSL "https://github.com/regclient/regclient/releases/download/${REGCTL_VERSION}/regctl-linux-amd64" -o regctl
-          echo "${REGCTL_SHA256}  regctl" | sha256sum -c -
+          curl -L https://github.com/regclient/regclient/releases/latest/download/regctl-linux-amd64 -o regctl
           chmod 755 regctl
           mv regctl /usr/local/bin/regctl
           regctl version
@@ -93,7 +92,7 @@ jobs:
           regctl image copy kubearmor/kubearmor-init:$STABLE_VERSION ${{vars.AWS_ECR_REGISTRY}}/kubearmor-init:$STABLE_VERSION --digest-tags
           regctl image copy kubearmor/kubearmor-controller:$STABLE_VERSION ${{vars.AWS_ECR_REGISTRY}}/kubearmor-controller:$STABLE_VERSION --digest-tags
           regctl image copy kubearmor/kubearmor-operator:$STABLE_VERSION ${{vars.AWS_ECR_REGISTRY}}/kubearmor-operator:$STABLE_VERSION --digest-tags
-          regctl image copy kubearmor/kubearmor-snitch:$STABLE_VERSION ${{vars.AWS_ECR_REGISTRY}}/kubearmor-snitch:$STABLE_VERSION --digest-tags    
+          regctl image copy kubearmor/kubearmor-snitch:$STABLE_VERSION ${{vars.AWS_ECR_REGISTRY}}/kubearmor-snitch:$STABLE_VERSION --digest-tags
 
   publish-images-to-ocir:
     runs-on: ubuntu-latest
@@ -109,8 +108,7 @@ jobs:
           REGCTL_VERSION: v0.11.5
           REGCTL_SHA256: c93aa7638749f5aaac1a8e01787321889c78f0101809bb2880343478d0ba0467
         run: |
-          curl -fsSL "https://github.com/regclient/regclient/releases/download/${REGCTL_VERSION}/regctl-linux-amd64" -o regctl
-          echo "${REGCTL_SHA256}  regctl" | sha256sum -c -
+          curl -L https://github.com/regclient/regclient/releases/latest/download/regctl-linux-amd64 -o regctl
           chmod 755 regctl
           mv regctl /usr/local/bin/regctl
           regctl version
@@ -123,7 +121,7 @@ jobs:
           regctl image copy kubearmor/kubearmor-init:$STABLE_VERSION ${{vars.OCIR_REGISTRY}}/kubearmor-init:$STABLE_VERSION --digest-tags
           regctl image copy kubearmor/kubearmor-controller:$STABLE_VERSION ${{vars.OCIR_REGISTRY}}/kubearmor-controller:$STABLE_VERSION --digest-tags
           regctl image copy kubearmor/kubearmor-operator:$STABLE_VERSION ${{vars.OCIR_REGISTRY}}/kubearmor-operator:$STABLE_VERSION --digest-tags
-          regctl image copy kubearmor/kubearmor-snitch:$STABLE_VERSION ${{vars.OCIR_REGISTRY}}/kubearmor-snitch:$STABLE_VERSION --digest-tags    
+          regctl image copy kubearmor/kubearmor-snitch:$STABLE_VERSION ${{vars.OCIR_REGISTRY}}/kubearmor-snitch:$STABLE_VERSION --digest-tags
 
   publish-aws-helm-chart:
     runs-on: ubuntu-latest
@@ -133,7 +131,7 @@ jobs:
       - uses: azure/setup-helm@5119fcb9089d432beecbf79bb2c7915207344b78 # v3
 
       - name: Configure AWS credentials
-        uses: aws-actions/configure-aws-credentials@d979d5b3a71173a29b74b5b88418bfda9437d885 # v6
+        uses: aws-actions/configure-aws-credentials@e7f100cf4c008499ea8adda475de1042d6975c7b # v6
         with:
           aws-access-key-id: ${{ secrets.AWS_ACCESS_KEY_ID }}
           aws-secret-access-key: ${{ secrets.AWS_SECRET_ACCESS_KEY }}
@@ -154,11 +152,11 @@ jobs:
       - name: Create and Publish Helm Chart
         uses: ./.github/actions/marketplace
         with:
-          registry: '${{ vars.AWS_ECR_REGISTRY }}'
-          version: '${{ steps.metadata.outputs.version }}'
-          relay_version: '${{ steps.metadata.outputs.relay_version }}'
-          helm_chart_path: './deployments/helm/KubeArmorOperator'
-          helm_chart_name: 'kubearmor-operator-aws'
+          registry: "${{ vars.AWS_ECR_REGISTRY }}"
+          version: "${{ steps.metadata.outputs.version }}"
+          relay_version: "${{ steps.metadata.outputs.relay_version }}"
+          helm_chart_path: "./deployments/helm/KubeArmorOperator"
+          helm_chart_name: "kubearmor-operator-aws"
 
       # workaround to mandatory subfolder for helm-gh-master action
       # https://github.com/stefanprodan/helm-gh-pages/issues/23#issuecomment-854101420
@@ -203,11 +201,11 @@ jobs:
       - name: Create and Publish Helm Chart
         uses: ./.github/actions/marketplace
         with:
-          registry: '${{ vars.OCIR_REGISTRY }}'
-          version: '${{ steps.metadata.outputs.version }}'
-          relay_version: '${{ steps.metadata.outputs.relay_version }}'
-          helm_chart_path: './deployme
```

**File**: `.github/workflows/ci-network-tests.yml` (modified, +3/-3)
```diff
@@ -138,7 +138,7 @@ jobs:
           docker system prune -a -f 
           docker buildx prune -a -f
           helm upgrade --install kubearmor-operator ./deployments/helm/KubeArmorOperator -n kubearmor --create-namespace --set kubearmorOperator.image.tag=latest  --set kubearmorOperator.annotateExisting=true
-          
+
           kubectl rollout status --timeout=5m deployment -n kubearmor -l kubearmor-app=kubearmor-operator
 
           kubectl get pods -A
@@ -202,7 +202,7 @@ jobs:
 
       - name: Test KubeArmor using Ginkgo
         run: |
-          go install -mod=mod github.com/onsi/ginkgo/v2/ginkgo
+          go install -mod=mod github.com/onsi/ginkgo/v2/ginkgo@9ff1646a26f77a4c0d33ddba3e6368c42c0e8842
           go mod tidy
           ginkgo --vv --flake-attempts=10 --timeout=15m
         working-directory: ./tests/k8s_env/networktests
@@ -232,7 +232,7 @@ jobs:
         if: ${{ failure() }}
         run: |
           kubectl describe pod -n kubearmor -l kubearmor-app=kubearmor
-          curl -sfL http://get.kubearmor.io/ | sudo sh -s -- -b /usr/local/bin
+          curl -sfL http://get.kubearmor.io/ -o /tmp/install-karmor.sh && sudo sh /tmp/install-karmor.sh -b /usr/local/bin
           mkdir -p /tmp/kubearmor/ && cd /tmp/kubearmor && karmor sysdump
 
       - name: Archive log artifacts
```

**File**: `.github/workflows/ci-operator-release.yaml` (modified, +9/-13)
```diff
@@ -30,7 +30,7 @@ env:
 jobs:
   kubearmor-operator-release:
     name: Build & Push KubeArmor Operator
-    if: github.repository == 'kubearmor/kubearmor'     
+    if: github.repository == 'kubearmor/kubearmor'
     runs-on: ubuntu-22.04
     permissions:
       id-token: write
@@ -40,7 +40,7 @@ jobs:
 
       - uses: actions/setup-go@40f1582b2485089dde7abd97c1529aa768e1baff # v5
         with:
-          go-version-file: 'KubeArmor/go.mod'
+          go-version-file: "KubeArmor/go.mod"
 
       - name: Set up QEMU
         uses: docker/setup-qemu-action@2b82ce82d56a2a04d2637cd93a637ae1b359c0a7 # v2
@@ -54,15 +54,15 @@ jobs:
         uses: docker/login-action@465a07811f14bebb1938fbed4728c6a1ff8901fc # v2
         with:
           username: ${{ secrets.DOCKER_USERNAME }}
-          password: ${{ secrets.DOCKER_AUTHTOK }} 
+          password: ${{ secrets.DOCKER_AUTHTOK }}
 
       # - name: Set up AWS Credentials
       #   uses: aws-actions/configure-aws-credentials@v6
       #   with:
       #     aws-access-key-id: ${{ secrets.AWS_ECR_ACCESS_ID }}
       #     aws-secret-access-key: ${{ secrets.AWS_ECR_SECRET_ID }}
       #     aws-region: us-east-1
-  
+
       # - name: Login to AWS ECR
       #   run: |
       #     aws ecr-public get-login-password --region us-east-1 | docker login --username AWS --password-stdin public.ecr.aws/k9v9d5v2
@@ -94,7 +94,6 @@ jobs:
         working-directory: ./pkg/KubeArmorOperator
         run: PLATFORM=$PLATFORM make docker-buildx TAG=${{ steps.vars.outputs.tag }} BUILD_MODE=--push
 
-
       - name: Install Cosign
         uses: sigstore/cosign-installer@6f9f17788090df1f26f669e9d70d6ae9567deba6 # main
 
@@ -110,29 +109,27 @@ jobs:
           cosign sign -r kubearmor/kubearmor-operator@${{ steps.digest.outputs.operatordigest }} --yes
           cosign sign -r kubearmor/kubearmor-snitch@${{ steps.digest.outputs.snitchdigest }} --yes
 
-
       - name: Install regctl
         env:
           REGCTL_VERSION: v0.11.5
           REGCTL_SHA256: c93aa7638749f5aaac1a8e01787321889c78f0101809bb2880343478d0ba0467
         run: |
-          curl -fsSL "https://github.com/regclient/regclient/releases/download/${REGCTL_VERSION}/regctl-linux-amd64" -o regctl
-          echo "${REGCTL_SHA256}  regctl" | sha256sum -c -
+          curl -L https://github.com/regclient/regclient/releases/latest/download/regctl-linux-amd64 -o regctl
           chmod 755 regctl
           mv regctl /usr/local/bin/regctl
-  
+
       - name: Check install
         run: regctl version
-        
+
       # - name: Generate the tag version of Operator and Snitch in ECR
       #   run: |
       #     regctl image copy kubearmor/kubearmor-operator:${{ steps.vars.outputs.tag }} public.ecr.aws/k9v9d5v2/kubearmor/kubearmor-operator:${{ steps.vars.outputs.tag }} --digest-tags
       #     regctl image copy kubearmor/kubearmor-snitch:${{ steps.vars.outputs.tag }} public.ecr.aws/k9v9d5v2/kubearmor/kubearmor-snitch:${{ steps.vars.outputs.tag }} --digest-tags
-          
+
       - uses: actions/checkout@34e114876b0b11c390a56381ad16ebd13914f8d5 # v4
         with:
           ref: main
-      
+
       - name: Get and Match Stable Tag
         id: stable
         run: |
@@ -156,4 +153,3 @@ jobs:
       #     STABLE_VERSION=`cat STABLE-RELEASE`
       #     regctl image copy kubearmor/kubearmor-operator:$STABLE_VERSION public.ecr.aws/k9v9d5v2/kubearmor/kubearmor-operator:stable --digest-tags
       #     regctl image copy kubearmor/kubearmor-snitch:$STABLE_VERSION public.ecr.aws/k9v9d5v2/kubearmor/kubearmor-snitch:stable --digest-tags
-
```

**File**: `.github/workflows/ci-operator-ubi-release.yaml` (modified, +9/-9)
```diff
@@ -36,22 +36,22 @@ jobs:
       id-token: write
     timeout-minutes: 90
     steps:
-      - uses: actions/checkout@v4
+      - uses: actions/checkout@34e114876b0b11c390a56381ad16ebd13914f8d5 # v4
 
-      - uses: actions/setup-go@v5
+      - uses: actions/setup-go@40f1582b2485089dde7abd97c1529aa768e1baff # v5
         with:
           go-version-file: 'KubeArmor/go.mod'
 
       - name: Set up QEMU
-        uses: docker/setup-qemu-action@v2
+        uses: docker/setup-qemu-action@2b82ce82d56a2a04d2637cd93a637ae1b359c0a7 # v2
 
       - name: Set up Docker Buildx
-        uses: docker/setup-buildx-action@v2
+        uses: docker/setup-buildx-action@885d1462b80bc1c1c7f0b00334ad271f09369c55 # v2
         with:
           platforms: linux/amd64,linux/arm64/v8
 
       - name: Login to Docker Hub
-        uses: docker/login-action@v2
+        uses: docker/login-action@465a07811f14bebb1938fbed4728c6a1ff8901fc # v2
         with:
           username: ${{ secrets.DOCKER_USERNAME }}
           password: ${{ secrets.DOCKER_AUTHTOK }} 
@@ -69,7 +69,7 @@ jobs:
 
       - name: Get Tag
         id: vars
-        uses: actions/github-script@v7
+        uses: actions/github-script@f28e40c7f34bde8b3046d885e986cb6290c5673b # v7
         with:
           script: |
             let tag;
@@ -96,7 +96,7 @@ jobs:
 
 
       - name: Install Cosign
-        uses: sigstore/cosign-installer@main
+        uses: sigstore/cosign-installer@6f9f17788090df1f26f669e9d70d6ae9567deba6 # main
 
       - name: Get Image Digest
         id: digest
@@ -113,7 +113,7 @@ jobs:
 
       - name: Install regctl
         run: |
-          curl -L https://github.com/regclient/regclient/releases/latest/download/regctl-linux-amd64 >regctl
+          curl -L https://github.com/regclient/regclient/releases/latest/download/regctl-linux-amd64 -o regctl
           chmod 755 regctl
           mv regctl /usr/local/bin
   
@@ -125,7 +125,7 @@ jobs:
       #     regctl image copy kubearmor/kubearmor-operator-ubi:${{ steps.vars.outputs.tag }} public.ecr.aws/k9v9d5v2/kubearmor/kubearmor-operator-ubi:${{ steps.vars.outputs.tag }} --digest-tags
       #     regctl image copy kubearmor/kubearmor-snitch-ubi:${{ steps.vars.outputs.tag }} public.ecr.aws/k9v9d5v2/kubearmor/kubearmor-snitch-ubi:${{ steps.vars.outputs.tag }} --digest-tags
           
-      - uses: actions/checkout@v4
+      - uses: actions/checkout@34e114876b0b11c390a56381ad16ebd13914f8d5 # v4
         with:
           ref: main
       
```

**File**: `.github/workflows/ci-stable-release.yml` (modified, +1/-2)
```diff
@@ -25,8 +25,7 @@ jobs:
           REGCTL_VERSION: v0.11.5
           REGCTL_SHA256: c93aa7638749f5aaac1a8e01787321889c78f0101809bb2880343478d0ba0467
         run: |
-          curl -fsSL "https://github.com/regclient/regclient/releases/download/${REGCTL_VERSION}/regctl-linux-amd64" -o regctl
-          echo "${REGCTL_SHA256}  regctl" | sha256sum -c -
+          curl -L https://github.com/regclient/regclient/releases/latest/download/regctl-linux-amd64 -o regctl
           chmod 755 regctl
           mv regctl /usr/local/bin/regctl
 
```

---

### Incident Patch 15: `580dcb9e` (2026-07-23)
**Commit Message**: fix: upgrade golang.org/x/text to v0.39.0 and go 1.26.5 to resolve govulncheck CVEs (#2786)

Resolves:
- GO-2026-5970: golang.org/x/text v0.38.0 -> v0.39.0
- GO-2026-5856: crypto/tls (stdlib) go1.26.4 -> go1.26.5
- GO-2026-4970: os (stdlib) go1.26.4 -> go1.26.5

Updates all 6 modules (KubeArmor, tests, protobuf, deployments,
KubeArmorController, KubeArmorOperator) to ensure govulncheck
passes cleanly in CI.

Signed-off-by: Sagar Khandagre <[REDACTED_EMAIL]>

**File**: `KubeArmor/go.mod` (modified, +3/-3)
```diff
@@ -146,12 +146,12 @@ require (
 	go.yaml.in/yaml/v2 v2.4.4 // indirect
 	go.yaml.in/yaml/v3 v3.0.4 // indirect
 	golang.org/x/crypto v0.53.0 // indirect
-	golang.org/x/mod v0.36.0 // indirect
-	golang.org/x/net v0.55.0 // indirect
+	golang.org/x/mod v0.37.0 // indirect
+	golang.org/x/net v0.56.0 // indirect
 	golang.org/x/oauth2 v0.36.0 // indirect
 	golang.org/x/sync v0.21.0 // indirect
 	golang.org/x/term v0.44.0 // indirect
-	golang.org/x/text v0.38.0 // indirect
+	golang.org/x/text v0.39.0 // indirect
 	golang.org/x/time v0.15.0 // indirect
 	gomodules.xyz/jsonpatch/v2 v2.5.0 // indirect
 	google.golang.org/genproto/googleapis/rpc v0.0.0-20260519071638-aa98bba5eb94 // indirect
```

**File**: `KubeArmor/go.sum` (modified, +8/-8)
```diff
@@ -365,8 +365,8 @@ golang.org/x/lint v0.0.0-20200302205851-738671d3881b/go.mod h1:3xt1FjdF8hUf6vQPI
 golang.org/x/mod v0.1.1-0.20191105210325-c90efee705ee/go.mod h1:QqPTAvyqsEbceGzBzNggFXnrqF1CaUcvgkdR5Ot7KZg=
 golang.org/x/mod v0.2.0/go.mod h1:s0Qsj1ACt9ePp/hMypM3fl4fZqREWJwdYDEqhRiZZUA=
 golang.org/x/mod v0.3.0/go.mod h1:s0Qsj1ACt9ePp/hMypM3fl4fZqREWJwdYDEqhRiZZUA=
-golang.org/x/mod v0.36.0 h1:JJjpVx6myfUsUdAzZuOSTTmRE0PfZeNWzzvKrP7amb4=
-golang.org/x/mod v0.36.0/go.mod h1:moc6ELqsWcOw5Ef3xVprK5ul/MvtVvkIXLziUOICjUQ=
+golang.org/x/mod v0.37.0 h1:vF1DjpVEshcIqoEaauuHebaLk1O1forxjxBaVn884JQ=
+golang.org/x/mod v0.37.0/go.mod h1:m8S8VeM9r4dzDwjrKO0a1sZP3YjeMamRRlD+fmR2Q/0=
 golang.org/x/net v0.0.0-20180724234803-3673e40ba225/go.mod h1:mL1N/T3taQHkDXs73rZJwtUhF3w3ftmwwsq0BUmARs4=
 golang.org/x/net v0.0.0-20180826012351-8a410e7b638d/go.mod h1:mL1N/T3taQHkDXs73rZJwtUhF3w3ftmwwsq0BUmARs4=
 golang.org/x/net v0.0.0-20190213061140-3a22650c66bd/go.mod h1:mL1N/T3taQHkDXs73rZJwtUhF3w3ftmwwsq0BUmARs4=
@@ -376,8 +376,8 @@ golang.org/x/net v0.0.0-20190620200207-3b0461eec859/go.mod h1:z5CRVTTTmAJ677TzLL
 golang.org/x/net v0.0.0-20200226121028-0de0cce0169b/go.mod h1:z5CRVTTTmAJ677TzLLGU+0bjPO0LkuOLi4/5GtJWs/s=
 golang.org/x/net v0.0.0-20201021035429-f5854403a974/go.mod h1:sp8m0HH+o8qH0wwXwYZr8TS3Oi6o0r6Gce1SSxlDquU=
 golang.org/x/net v0.0.0-20201110031124-69a78807bb2b/go.mod h1:sp8m0HH+o8qH0wwXwYZr8TS3Oi6o0r6Gce1SSxlDquU=
-golang.org/x/net v0.55.0 h1:bcvxaJn3e1U6InsFWt1JUq1aSjnRxLzT2rtD2KfkDF8=
-golang.org/x/net v0.55.0/go.mod h1:L5U2KuzuOe1lY7Z+aWVIKK6qEeJXnXV9yzGA+WCHJww=
+golang.org/x/net v0.56.0 h1:Rw8j/hFzGvJUZwNBXnAtf5sVDVt+65SK2C7IxCxZt5o=
+golang.org/x/net v0.56.0/go.mod h1:D3Ku6r+V6JROoZK144D2XfMHFcMq/0zSfLelVTCFKec=
 golang.org/x/oauth2 v0.0.0-20180821212333-d2e6202438be/go.mod h1:N/0e6XlmueqKjAGxoOufVs8QHGRruUQn6yWY3a++T0U=
 golang.org/x/oauth2 v0.36.0 h1:peZ/1z27fi9hUOFCAZaHyrpWG5lwe0RJEEEeH0ThlIs=
 golang.org/x/oauth2 v0.36.0/go.mod h1:YDBUJMTkDnJS+A4BP4eZBjCqtokkg1hODuPjwiGPO7Q=
@@ -398,8 +398,8 @@ golang.org/x/term v0.44.0 h1:0rLvDRCtNj0gZkyIXhCyOb2OAzEhLVqc4B+hrsBhrmc=
 golang.org/x/term v0.44.0/go.mod h1:7ze4MdzUzLXpSAoFP1H0bOI9aXDqveSvatT5vKcFh2Y=
 golang.org/x/text v0.3.0/go.mod h1:NqM8EUOU14njkJ3fqMW+pc6Ldnwhi/IjpwHt7yyuwOQ=
 golang.org/x/text v0.3.3/go.mod h1:5Zoc/QRtKVWzQhOtBMvqHzDpF6irO9z98xDceosuGiQ=
-golang.org/x/text v0.38.0 h1:sXmwo9DwP3OK9EZ7PqAdaooSGozfl/3a6/xJcbzPRhE=
-golang.org/x/text v0.38.0/go.mod h1:YXZt3QhHUKYT53r2lLKFIVi6Ao1jdzrTR/KQ09qyxF4=
+golang.org/x/text v0.39.0 h1:UbZz4pLOvn600D6Oh6GGEI6VAmndrEBLv8/6BEXzyus=
+golang.org/x/text v0.39.0/go.mod h1:3UwRclnC2g0TU9x8PZiyfOajCd1zaUNHF9cvqcQZ+ZM=
 golang.org/x/time v0.15.0 h1:bbrp8t3bGUeFOx08pvsMYRTCVSMk89u4tKbNOZbp88U=
 golang.org/x/time v0.15.0/go.mod h1:Y4YMaQmXwGQZoFaVFk4YpCt4FLQMYKZe9oeV/f4MSno=
 golang.org/x/tools v0.0.0-20180917221912-90fa682c2a6e/go.mod h1:n7NCudcB/nEzxVGmLbDWY5pfWTLqBcC2KZ6jyYvM4mQ=
@@ -411,8 +411,8 @@ golang.org/x/tools v0.0.0-20191119224855-298f0cb1881e/go.mod h1:b+2E5dAYhXwXZwtn
 golang.org/x/tools v0.0.0-20200130002326-2f3ba24bd6e7/go.mod h1:TB2adYChydJhpapKDTa4BR/hXlZSLoq2Wpct/0txZ28=
 golang.org/x/tools v0.0.0-20200619180055-7c47624df98f/go.mod h1:EkVYQZoAsY45+roYkvgYkIh4xh/qjgUK9TdY2XT94GE=
 golang.org/x/tools v0.0.0-20210106214847-113979e3529a/go.mod h1:emZCQorbCU4vsT4fOWvOPXz4eW1wZW4PmDk9uLelYpA=
-golang.org/x/tools v0.45.0 h1:18qN3FAooORvApf5XjCXgsuayZOEtXf6JK18I3+ONa8=
-golang.org/x/tools v0.45.0/go.mod h1:LuUGqqaXcXMEFEruIVJVm5mgDD8vww/z/SR1gQ4uE/0=
+golang.org/x/tools v0.47.0 h1:7Kn5x/d1svx/PzryTsqeoZN4TZwqeH5pGWjefhLi/1Q=
+golang.org/x/tools v0.47.0/go.mod h1:dFHnyTvFWY212G+h7ZY4Vsp/K3U4/7W9TyVaAul8uCA=
 golang.org/x/xerrors v0.0.0-20190717185122-a985d3407aa7/go.mod h1:I/5z698sn9Ka8TeJc9MKroUUfqBBauWjQqLJ2OPfmY0=
 golang.org/x/xerrors v0.0.0-20191011141410-1b5146add898/go.mod h1:I/5z698sn9Ka8TeJc9MKroUUfqBBauWjQqLJ2OPfmY0=
 golang.org/x/xerrors v0.0.0-20191204190536-9bdfabe68543/go.mod h1:I/5z698sn9Ka8TeJc9MKroUUfqBBauWjQqLJ2OPfmY0=
```

**File**: `deployments/go.mod` (modified, +2/-2)
```diff
@@ -37,9 +37,9 @@ require (
 	go.uber.org/zap v1.28.0 // indirect
 	go.yaml.in/yaml/v2 v2.4.4 // indirect
 	go.yaml.in/yaml/v3 v3.0.4 // indirect
-	golang.org/x/net v0.55.0 // indirect
+	golang.org/x/net v0.56.0 // indirect
 	golang.org/x/sys v0.46.0 // indirect
-	golang.org/x/text v0.38.0 // indirect
+	golang.org/x/text v0.39.0 // indirect
 	gopkg.in/inf.v0 v0.9.1 // indirect
 	k8s.io/apiextensions-apiserver v0.36.1 // indirect
 	k8s.io/klog/v2 v2.140.0 // indirect
```

**File**: `deployments/go.sum` (modified, +4/-4)
```diff
@@ -64,12 +64,12 @@ go.yaml.in/yaml/v2 v2.4.4 h1:tuyd0P+2Ont/d6e2rl3be67goVK4R6deVxCUX5vyPaQ=
 go.yaml.in/yaml/v2 v2.4.4/go.mod h1:gMZqIpDtDqOfM0uNfy0SkpRhvUryYH0Z6wdMYcacYXQ=
 go.yaml.in/yaml/v3 v3.0.4 h1:tfq32ie2Jv2UxXFdLJdh3jXuOzWiL1fo0bu/FbuKpbc=
 go.yaml.in/yaml/v3 v3.0.4/go.mod h1:DhzuOOF2ATzADvBadXxruRBLzYTpT36CKvDb3+aBEFg=
-golang.org/x/net v0.55.0 h1:bcvxaJn3e1U6InsFWt1JUq1aSjnRxLzT2rtD2KfkDF8=
-golang.org/x/net v0.55.0/go.mod h1:L5U2KuzuOe1lY7Z+aWVIKK6qEeJXnXV9yzGA+WCHJww=
+golang.org/x/net v0.56.0 h1:Rw8j/hFzGvJUZwNBXnAtf5sVDVt+65SK2C7IxCxZt5o=
+golang.org/x/net v0.56.0/go.mod h1:D3Ku6r+V6JROoZK144D2XfMHFcMq/0zSfLelVTCFKec=
 golang.org/x/sys v0.46.0 h1:noSf2Fq6F8DBgS+LysIkx7rIExoNHJsxOAtPp4rthXw=
 golang.org/x/sys v0.46.0/go.mod h1:4GL1E5IUh+htKOUEOaiffhrAeqysfVGipDYzABqnCmw=
-golang.org/x/text v0.38.0 h1:sXmwo9DwP3OK9EZ7PqAdaooSGozfl/3a6/xJcbzPRhE=
-golang.org/x/text v0.38.0/go.mod h1:YXZt3QhHUKYT53r2lLKFIVi6Ao1jdzrTR/KQ09qyxF4=
+golang.org/x/text v0.39.0 h1:UbZz4pLOvn600D6Oh6GGEI6VAmndrEBLv8/6BEXzyus=
+golang.org/x/text v0.39.0/go.mod h1:3UwRclnC2g0TU9x8PZiyfOajCd1zaUNHF9cvqcQZ+ZM=
 gopkg.in/check.v1 v0.0.0-20161208181325-20d25e280405/go.mod h1:Co6ibVJAznAaIkqp8huTwlJQCZ016jof/cbN4VW5Yz0=
 gopkg.in/check.v1 v1.0.0-20201130134442-10cb98267c6c h1:Hei/4ADfdWqJk1ZMxUNpqntNwaWcugrBjAiHlqqRiVk=
 gopkg.in/check.v1 v1.0.0-20201130134442-10cb98267c6c/go.mod h1:JHkPIbrfpd72SG/EVd6muEfDQjcINNoR0C8j2r3qZ4Q=
```

**File**: `pkg/KubeArmorController/go.mod` (modified, +7/-7)
```diff
@@ -80,15 +80,15 @@ require (
 	go.yaml.in/yaml/v2 v2.4.4 // indirect
 	go.yaml.in/yaml/v3 v3.0.4 // indirect
 	golang.org/x/exp v0.0.0-20260508232706-74f9aab9d74a // indirect
-	golang.org/x/mod v0.36.0 // indirect
-	golang.org/x/net v0.55.0 // indirect
+	golang.org/x/mod v0.37.0 // indirect
+	golang.org/x/net v0.56.0 // indirect
 	golang.org/x/oauth2 v0.36.0 // indirect
-	golang.org/x/sync v0.20.0 // indirect
-	golang.org/x/sys v0.45.0 // indirect
-	golang.org/x/term v0.43.0 // indirect
-	golang.org/x/text v0.37.0 // indirect
+	golang.org/x/sync v0.21.0 // indirect
+	golang.org/x/sys v0.46.0 // indirect
+	golang.org/x/term v0.44.0 // indirect
+	golang.org/x/text v0.39.0 // indirect
 	golang.org/x/time v0.15.0 // indirect
-	golang.org/x/tools v0.45.0 // indirect
+	golang.org/x/tools v0.47.0 // indirect
 	gomodules.xyz/jsonpatch/v2 v2.5.0 // indirect
 	google.golang.org/genproto/googleapis/api v0.0.0-20260519071638-aa98bba5eb94 // indirect
 	google.golang.org/genproto/googleapis/rpc v0.0.0-20260519071638-aa98bba5eb94 // indirect
```

**File**: `pkg/KubeArmorController/go.sum` (modified, +14/-14)
```diff
@@ -196,24 +196,24 @@ go.yaml.in/yaml/v3 v3.0.4 h1:tfq32ie2Jv2UxXFdLJdh3jXuOzWiL1fo0bu/FbuKpbc=
 go.yaml.in/yaml/v3 v3.0.4/go.mod h1:DhzuOOF2ATzADvBadXxruRBLzYTpT36CKvDb3+aBEFg=
 golang.org/x/exp v0.0.0-20260508232706-74f9aab9d74a h1:+3jdDGGB8NGb1Zktc737jlt3/A5f6UlwSzmvqUuufxw=
 golang.org/x/exp v0.0.0-20260508232706-74f9aab9d74a/go.mod h1:d2fgXJLVs4dYDHUk5lwMIfzRzSrWCfGZb0ZqeLa/Vcw=
-golang.org/x/mod v0.36.0 h1:JJjpVx6myfUsUdAzZuOSTTmRE0PfZeNWzzvKrP7amb4=
-golang.org/x/mod v0.36.0/go.mod h1:moc6ELqsWcOw5Ef3xVprK5ul/MvtVvkIXLziUOICjUQ=
-golang.org/x/net v0.55.0 h1:bcvxaJn3e1U6InsFWt1JUq1aSjnRxLzT2rtD2KfkDF8=
-golang.org/x/net v0.55.0/go.mod h1:L5U2KuzuOe1lY7Z+aWVIKK6qEeJXnXV9yzGA+WCHJww=
+golang.org/x/mod v0.37.0 h1:vF1DjpVEshcIqoEaauuHebaLk1O1forxjxBaVn884JQ=
+golang.org/x/mod v0.37.0/go.mod h1:m8S8VeM9r4dzDwjrKO0a1sZP3YjeMamRRlD+fmR2Q/0=
+golang.org/x/net v0.56.0 h1:Rw8j/hFzGvJUZwNBXnAtf5sVDVt+65SK2C7IxCxZt5o=
+golang.org/x/net v0.56.0/go.mod h1:D3Ku6r+V6JROoZK144D2XfMHFcMq/0zSfLelVTCFKec=
 golang.org/x/oauth2 v0.36.0 h1:peZ/1z27fi9hUOFCAZaHyrpWG5lwe0RJEEEeH0ThlIs=
 golang.org/x/oauth2 v0.36.0/go.mod h1:YDBUJMTkDnJS+A4BP4eZBjCqtokkg1hODuPjwiGPO7Q=
-golang.org/x/sync v0.20.0 h1:e0PTpb7pjO8GAtTs2dQ6jYa5BWYlMuX047Dco/pItO4=
-golang.org/x/sync v0.20.0/go.mod h1:9xrNwdLfx4jkKbNva9FpL6vEN7evnE43NNNJQ2LF3+0=
-golang.org/x/sys v0.45.0 h1:dO4czNzziLiiXplLQgBCEpCvXQ3dnkn0SdaZSYdQ+FY=
-golang.org/x/sys v0.45.0/go.mod h1:4GL1E5IUh+htKOUEOaiffhrAeqysfVGipDYzABqnCmw=
-golang.org/x/term v0.43.0 h1:S4RLU2sB31O/NCl+zFN9Aru9A/Cq2aqKpTZJ6B+DwT4=
-golang.org/x/term v0.43.0/go.mod h1:lrhlHNdQJHO+1qVYiHfFKVuVioJIheAc3fBSMFYEIsk=
-golang.org/x/text v0.37.0 h1:Cqjiwd9eSg8e0QAkyCaQTNHFIIzWtidPahFWR83rTrc=
-golang.org/x/text v0.37.0/go.mod h1:a5sjxXGs9hsn/AJVwuElvCAo9v8QYLzvavO5z2PiM38=
+golang.org/x/sync v0.21.0 h1:HLII4xRRTtCRkxYp4HNFF0Js/Og6q2i++KXbg0gHCwM=
+golang.org/x/sync v0.21.0/go.mod h1:9xrNwdLfx4jkKbNva9FpL6vEN7evnE43NNNJQ2LF3+0=
+golang.org/x/sys v0.46.0 h1:noSf2Fq6F8DBgS+LysIkx7rIExoNHJsxOAtPp4rthXw=
+golang.org/x/sys v0.46.0/go.mod h1:4GL1E5IUh+htKOUEOaiffhrAeqysfVGipDYzABqnCmw=
+golang.org/x/term v0.44.0 h1:0rLvDRCtNj0gZkyIXhCyOb2OAzEhLVqc4B+hrsBhrmc=
+golang.org/x/term v0.44.0/go.mod h1:7ze4MdzUzLXpSAoFP1H0bOI9aXDqveSvatT5vKcFh2Y=
+golang.org/x/text v0.39.0 h1:UbZz4pLOvn600D6Oh6GGEI6VAmndrEBLv8/6BEXzyus=
+golang.org/x/text v0.39.0/go.mod h1:3UwRclnC2g0TU9x8PZiyfOajCd1zaUNHF9cvqcQZ+ZM=
 golang.org/x/time v0.15.0 h1:bbrp8t3bGUeFOx08pvsMYRTCVSMk89u4tKbNOZbp88U=
 golang.org/x/time v0.15.0/go.mod h1:Y4YMaQmXwGQZoFaVFk4YpCt4FLQMYKZe9oeV/f4MSno=
-golang.org/x/tools v0.45.0 h1:18qN3FAooORvApf5XjCXgsuayZOEtXf6JK18I3+ONa8=
-golang.org/x/tools v0.45.0/go.mod h1:LuUGqqaXcXMEFEruIVJVm5mgDD8vww/z/SR1gQ4uE/0=
+golang.org/x/tools v0.47.0 h1:7Kn5x/d1svx/PzryTsqeoZN4TZwqeH5pGWjefhLi/1Q=
+golang.org/x/tools v0.47.0/go.mod h1:dFHnyTvFWY212G+h7ZY4Vsp/K3U4/7W9TyVaAul8uCA=
 gomodules.xyz/jsonpatch/v2 v2.5.0 h1:JELs8RLM12qJGXU4u/TO3V25KW8GreMKl9pdkk14RM0=
 gomodules.xyz/jsonpatch/v2 v2.5.0/go.mod h1:AH3dM2RI6uoBZxn3LVrfvJ3E0/9dG4cSrbuBJT4moAY=
 gonum.org/v1/gonum v0.17.0 h1:VbpOemQlsSMrYmn7T2OUvQ4dqxQXU+ouZFQsZOx50z4=
```

**File**: `pkg/KubeArmorOperator/go.mod` (modified, +2/-2)
```diff
@@ -64,7 +64,7 @@ require (
 	go.opentelemetry.io/otel v1.43.0 // indirect
 	go.opentelemetry.io/otel/metric v1.43.0 // indirect
 	go.opentelemetry.io/otel/trace v1.43.0 // indirect
-	golang.org/x/net v0.55.0 // indirect
+	golang.org/x/net v0.56.0 // indirect
 	golang.org/x/oauth2 v0.36.0 // indirect
 	golang.org/x/sync v0.21.0 // indirect
 	golang.org/x/sys v0.46.0 // indirect
@@ -128,7 +128,7 @@ require (
 	go.uber.org/multierr v1.11.0 // indirect
 	go.yaml.in/yaml/v2 v2.4.4 // indirect
 	go.yaml.in/yaml/v3 v3.0.4 // indirect
-	golang.org/x/text v0.38.0 // indirect
+	golang.org/x/text v0.39.0 // indirect
 	golang.org/x/time v0.15.0 // indirect
 	google.golang.org/protobuf v1.36.12-0.20260120151049-f2248ac996af // indirect
 	gopkg.in/evanphx/json-patch.v4 v4.13.0 // indirect
```

**File**: `pkg/KubeArmorOperator/go.sum` (modified, +8/-8)
```diff
@@ -285,8 +285,8 @@ golang.org/x/lint v0.0.0-20190227174305-5b3e6a55c961/go.mod h1:wehouNa3lNwaWXcvx
 golang.org/x/lint v0.0.0-20190313153728-d0100b6bd8b3/go.mod h1:6SW0HCj/g11FgYtHlgUYUwCkIfeOF89ocIRzGO/8vkc=
 golang.org/x/mod v0.2.0/go.mod h1:s0Qsj1ACt9ePp/hMypM3fl4fZqREWJwdYDEqhRiZZUA=
 golang.org/x/mod v0.3.0/go.mod h1:s0Qsj1ACt9ePp/hMypM3fl4fZqREWJwdYDEqhRiZZUA=
-golang.org/x/mod v0.36.0 h1:JJjpVx6myfUsUdAzZuOSTTmRE0PfZeNWzzvKrP7amb4=
-golang.org/x/mod v0.36.0/go.mod h1:moc6ELqsWcOw5Ef3xVprK5ul/MvtVvkIXLziUOICjUQ=
+golang.org/x/mod v0.37.0 h1:vF1DjpVEshcIqoEaauuHebaLk1O1forxjxBaVn884JQ=
+golang.org/x/mod v0.37.0/go.mod h1:m8S8VeM9r4dzDwjrKO0a1sZP3YjeMamRRlD+fmR2Q/0=
 golang.org/x/net v0.0.0-20180724234803-3673e40ba225/go.mod h1:mL1N/T3taQHkDXs73rZJwtUhF3w3ftmwwsq0BUmARs4=
 golang.org/x/net v0.0.0-20180826012351-8a410e7b638d/go.mod h1:mL1N/T3taQHkDXs73rZJwtUhF3w3ftmwwsq0BUmARs4=
 golang.org/x/net v0.0.0-20190213061140-3a22650c66bd/go.mod h1:mL1N/T3taQHkDXs73rZJwtUhF3w3ftmwwsq0BUmARs4=
@@ -296,8 +296,8 @@ golang.org/x/net v0.0.0-20190620200207-3b0461eec859/go.mod h1:z5CRVTTTmAJ677TzLL
 golang.org/x/net v0.0.0-20200226121028-0de0cce0169b/go.mod h1:z5CRVTTTmAJ677TzLLGU+0bjPO0LkuOLi4/5GtJWs/s=
 golang.org/x/net v0.0.0-20201021035429-f5854403a974/go.mod h1:sp8m0HH+o8qH0wwXwYZr8TS3Oi6o0r6Gce1SSxlDquU=
 golang.org/x/net v0.0.0-20201110031124-69a78807bb2b/go.mod h1:sp8m0HH+o8qH0wwXwYZr8TS3Oi6o0r6Gce1SSxlDquU=
-golang.org/x/net v0.55.0 h1:bcvxaJn3e1U6InsFWt1JUq1aSjnRxLzT2rtD2KfkDF8=
-golang.org/x/net v0.55.0/go.mod h1:L5U2KuzuOe1lY7Z+aWVIKK6qEeJXnXV9yzGA+WCHJww=
+golang.org/x/net v0.56.0 h1:Rw8j/hFzGvJUZwNBXnAtf5sVDVt+65SK2C7IxCxZt5o=
+golang.org/x/net v0.56.0/go.mod h1:D3Ku6r+V6JROoZK144D2XfMHFcMq/0zSfLelVTCFKec=
 golang.org/x/oauth2 v0.0.0-20180821212333-d2e6202438be/go.mod h1:N/0e6XlmueqKjAGxoOufVs8QHGRruUQn6yWY3a++T0U=
 golang.org/x/oauth2 v0.36.0 h1:peZ/1z27fi9hUOFCAZaHyrpWG5lwe0RJEEEeH0ThlIs=
 golang.org/x/oauth2 v0.36.0/go.mod h1:YDBUJMTkDnJS+A4BP4eZBjCqtokkg1hODuPjwiGPO7Q=
@@ -318,8 +318,8 @@ golang.org/x/term v0.44.0 h1:0rLvDRCtNj0gZkyIXhCyOb2OAzEhLVqc4B+hrsBhrmc=
 golang.org/x/term v0.44.0/go.mod h1:7ze4MdzUzLXpSAoFP1H0bOI9aXDqveSvatT5vKcFh2Y=
 golang.org/x/text v0.3.0/go.mod h1:NqM8EUOU14njkJ3fqMW+pc6Ldnwhi/IjpwHt7yyuwOQ=
 golang.org/x/text v0.3.3/go.mod h1:5Zoc/QRtKVWzQhOtBMvqHzDpF6irO9z98xDceosuGiQ=
-golang.org/x/text v0.38.0 h1:sXmwo9DwP3OK9EZ7PqAdaooSGozfl/3a6/xJcbzPRhE=
-golang.org/x/text v0.38.0/go.mod h1:YXZt3QhHUKYT53r2lLKFIVi6Ao1jdzrTR/KQ09qyxF4=
+golang.org/x/text v0.39.0 h1:UbZz4pLOvn600D6Oh6GGEI6VAmndrEBLv8/6BEXzyus=
+golang.org/x/text v0.39.0/go.mod h1:3UwRclnC2g0TU9x8PZiyfOajCd1zaUNHF9cvqcQZ+ZM=
 golang.org/x/time v0.15.0 h1:bbrp8t3bGUeFOx08pvsMYRTCVSMk89u4tKbNOZbp88U=
 golang.org/x/time v0.15.0/go.mod h1:Y4YMaQmXwGQZoFaVFk4YpCt4FLQMYKZe9oeV/f4MSno=
 golang.org/x/tools v0.0.0-20180917221912-90fa682c2a6e/go.mod h1:n7NCudcB/nEzxVGmLbDWY5pfWTLqBcC2KZ6jyYvM4mQ=
@@ -330,8 +330,8 @@ golang.org/x/tools v0.0.0-20190524140312-2c0ae7006135/go.mod h1:RgjU9mgBXZiqYHBn
 golang.org/x/tools v0.0.0-20191119224855-298f0cb1881e/go.mod h1:b+2E5dAYhXwXZwtnZ6UAqBI28+e2cm9otk0dWdXHAEo=
 golang.org/x/tools v0.0.0-20200619180055-7c47624df98f/go.mod h1:EkVYQZoAsY45+roYkvgYkIh4xh/qjgUK9TdY2XT94GE=
 golang.org/x/tools v0.0.0-20210106214847-113979e3529a/go.mod h1:emZCQorbCU4vsT4fOWvOPXz4eW1wZW4PmDk9uLelYpA=
-golang.org/x/tools v0.45.0 h1:18qN3FAooORvApf5XjCXgsuayZOEtXf6JK18I3+ONa8=
-golang.org/x/tools v0.45.0/go.mod h1:LuUGqqaXcXMEFEruIVJVm5mgDD8vww/z/SR1gQ4uE/0=
+golang.org/x/tools v0.47.0 h1:7Kn5x/d1svx/PzryTsqeoZN4TZwqeH5pGWjefhLi/1Q=
+golang.org/x/tools v0.47.0/go.mod h1:dFHnyTvFWY212G+h7ZY4Vsp/K3U4/7W9TyVaAul8uCA=
 golang.org/x/xerrors v0.0.0-20190717185122-a985d3407aa7/go.mod h1:I/5z698sn9Ka8TeJc9MKroUUfqBBauWjQqLJ2OPfmY0=
 golang.org/x/xerrors v0.0.0-20191011141410-1b5146add898/go.mod h1:I/5z698sn9Ka8TeJc9MKroUUfqBBauWjQqLJ2OPfmY0=
 golang.org/x/xerrors v0.0.0-20191204190536-9bdfabe68543/go.mod h1:I/5z698sn9Ka8TeJc9MKroUUfqBBauWjQqLJ2OPfmY0=
```

#### Recent Merged Pull Requests:
- **PR #2924** (2026-10-05): remove limits (@achrefbensaad)
- **PR #2922** (2026-10-04): Log level (@achrefbensaad)
- **PR #2908** (closed): build(deps): bump go.opentelemetry.io/otel/sdk from 1.44.0 to 1.45.0 in /pkg/KubeArmorController (@dependabot[bot])
- **PR #2906** (2026-10-04): fix(NPE): Fix NPE initialization check in non-k8s (@AryanBakliwal)
- **PR #2905** (2026-09-23): feat: Group dependency updates into one PR (@Abhayanthk)
- **PR #2899** (2026-09-15): chore(deps): fix vulnerabilities (@vanshika2720)
- **PR #2897** (2026-09-11): fix missing vmlinux.h in ci (@Aryan-sharma11)
- **PR #2894** (2026-09-11): use hostname as namespace for containers instead of `container_namespace` (@Aryan-sharma11)

---

## 3. Empirical Evidence & Compliance Certification
- **Evidence Provenance**: Fetched directly from verified official GitHub REST API.
- **Zero Disk Footprint**: 0 bytes of unnecessary repository bloat stored locally.
- **TOS & Free-Tier Adherence**: Request pace complied with public API guidelines without fee, penalty, or unauthorized scraping.

---

## 4. Promotion & Integration Status
- **Status**: HARVESTED_DEEP_FORENSIC
- **Master Brain Sync**: Auto-committed to local/remote Master Brain repository.
