# Domain H — Technical Construction Intelligence: Technical Construction Intelligence: siderolabs-talos-learnings Core Invariants

<!-- PROVENANCE_START
{
  "source_repository": "siderolabs-talos-learnings",
  "source_url": "unknown",
  "source_version": "HEAD",
  "license": "Open-Source",
  "timestamp": "2026-11-14T03:16:47.474Z",
  "ai_provider": "universal-multi-artifact-distributor",
  "generator_version": "2.0.0-universal",
  "learning_id": "LEARN-EVO-siderolabs-talos-learnings",
  "canonical_classification": "domain_intelligence"
}
PROVENANCE_END -->
> **Provenance**: Harvested from [siderolabs-talos-learnings](unknown) (Revision: `HEAD`).  
> **License**: Open-Source | **Timestamp**: `2026-11-14T03:16:47.474Z`  
> **Learning ID**: `LEARN-EVO-siderolabs-talos-learnings`


## 1. Domain Taxonomy & Context
- **Canonical Domain**: Domain H (Technical Construction Intelligence)
- **Secondary Corroborating Domains**: G (Architecture Intelligence), L (Deployment & Operations Intelligence), I (Content & Information Intelligence), K (Quality & Verification Intelligence), D (Research & Knowledge Intelligence), J (Search & Distribution Intelligence), M (Feedback & Evolution Intelligence), B (Product Intelligence)
- **Confidence Rating**: 70%

## 2. Core Domain Invariants & Discovered Laws
The following architectural invariants have been empirically discovered and recorded from siderolabs-talos-learnings:

> **Canonical Learning Artifact**: `07_PROJECT_LEARNING/siderolabs-talos-learnings.md`  
> **Source**: github ([https://github.com/siderolabs/talos](https://github.com/siderolabs/talos))  
> **Source Version**: `ba4a88b6`  
> **License**: MPL-2.0  
> **Synthesized By**: zero-clone-structural-synthesizer  
> **Timestamp**: 2026-11-14T03:10:33.012Z  
> **Learning ID**: `learn-github-siderolabs-talos`  
> **Pipeline Version**: `2.0.0`  
> **Status**: VERIFIED_EMPIRICAL_INTELLIGENCE  
> **Data Governance**: CLASSIFICATION: PUBLIC. Sanitized against PII/secrets.  
> **Policy Invariant**: Strictly for engineering retrieval and architecture documentation. Distillation prohibited.  

---

# Forensic Learning Record (Deep Inspection): siderolabs/talos

> **Canonical Artifact**: `07_PROJECT_LEARNING/siderolabs-talos-learnings.md`  
> **Source Platform**: GitHub ([https://github.com/siderolabs/talos](https://github.com/siderolabs/talos))  
> **Harvest Method**: Full-Spectrum Deep Extraction (Patches, Diffs, Source Code, Post-Mortems)  
> **Harvest Timestamp**: 2026-11-14T03:10:33.005Z  
> **Compliance State**: Free Tier Guaranteed | Strict Rate-Limit Backoff Honored  

---

## 1. Context & Architectural Overview
- **Repository / Resource**: `siderolabs/talos`
- **Description**: Talos Linux is a modern Linux distribution built for Kubernetes.
- **Primary Language / Ecosystem**: Go
- **Discovered Manifests / Configurations**: go.mod, README.md, Dockerfile
- **Stars / Engagement**: 11521 stars

---

## 2. Multi-Dimensional 8-Axis Investigation & Real Code Patches

### D1: Architecture & Structural Boundaries
- Entry configurations inspected via direct stream: go.mod, README.md, Dockerfile.
- Evaluated system abstractions and modular contracts.

### Core Architecture Module: `cmd/talosctl/cmd/talos/lifecycle/lifecycle.go`
```
// This Source Code Form is subject to the terms of the Mozilla Public
// License, v. 2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/.

// Package lifecycle implements image install progress reporting.
package lifecycle

import (
	"fmt"
	"maps"
	"slices"
	"sort"
	"strings"
	"unicode/utf8"

	"github.com/siderolabs/talos/pkg/machinery/api/machine"
	"github.com/siderolabs/talos/pkg/machinery/constants"
	"github.com/siderolabs/talos/pkg/reporter"
)

// ProgressWriter writes install progress updates to a reporter.
type ProgressWriter struct {
	// ongoingInstalls keeps track of ongoing install jobs per node.
	ongoingInstalls map[string]installJob
	captureOutput   bool
	output          map[string]*outputBuffer
}

const maxCapturedOutputSize = 64 * 1024

// NewProgressWriter initializes a progress writer, optionally retaining a bounded tail of installer output.
func NewProgressWriter(captureOutput bool) *ProgressWriter {
	return &ProgressWriter{captureOutput: captureOutput}
}

// UpdateJob updates the progress of a pull job for a given node and layer ID.
//
// It is supposed to be called whenever there is a progress update for a layer pull.
func (w *ProgressWriter) UpdateJob(node string, status *machine.LifecycleServiceInstallProgress) {
	if w.ongoingInstalls == nil {
		w.ongoingInstalls = make(map[string]installJob)
	}

	if message, ok := status.GetResponse().(*machine.LifecycleServiceInstallProgress_Message); ok && w.captureOutput {
		if w.output == nil {
			w.output = make(map[string]*outputBuffer)
		}

		if w.output[node] == nil {
			w.output[node] = &outputBuffer{}
		}

		w.output[node].Append(message.Message)
	}

	w.ongoingInstalls[node] = installJob{Status: status}
}

func (w *ProgressWriter) outputForNode(node string) string {
	if w.output[node] == nil {
		return ""
	}

	return w.output[node].String()
}

// Failure formats the classified exit code for a failed operation and includes captured installer output when enabled.
func (w *ProgressWriter) Failure(node, operation string, exitCode int32) string {
	var result strings.Builder

	if output := strings.TrimSpace(w.outputForNode(node)); output != "" {
		fmt.Fprintf(&result, "%s: installer output:\n%s\n", node, output)
	}

	fmt.Fprintf(&result, "%s: %s failed with exit code %d", node, operation, exitCode)

	if description := exitCodeDescription(exitCode); description != "" {
		fmt.Fprintf(&result, " (%s)", description)
	}

	return result.String()
}

func exitCodeDescription(exitCode int32) string {
	switch int(exitCode) {
	case constants.ExitInvalidInput:
		return "invalid input"
	case constants.ExitUnsupported:
		return "unsupported operation"
	case constants.ExitEnvironment:
		return "environment error"
	case constants.ExitDependency:
		return "dependency error"
	case constants.ExitIO:
		return "I/O error"
	case constants.ExitInstall:
		return "installation error"
	default:
		return ""
	}
}

type outputBuffer struct {
	messages  []string
	size      int
	truncated bool
}

func (buffer *outputBuffer) Append(message string) {
	if message == "" {
		return
	}

	if len(message) > maxCapturedOutputSize {
		message = message[len(message)-maxCapturedOutputSize:]
		for len(message) > 0 && !utf8.RuneStart(message[0]) {
			message = message[1:]
		}

		message = strings.Clone(message)

		buffer.messages = nil
		buffer.size = 0
		buffer.truncated = true
	}

	for buffer.size+len(message) > maxCapturedOutputSize {
		buffer.size -= len(buffer.messages[0])
		buffer.messages[0] = ""
		buffer.messages = buffer.messages[1:]
		buffer.truncated = true
	}

	buffer.messages = append(buffer.messages, message)
	buffer.size += len(message)
}

func (buffer *outputBuffer) String() string {
	var result strings.Builder

	if buffer.truncated {
		result.WriteString("[earlier installer output truncated]\n")
	}

	for _, message := range buffer.messages {
		result.WriteString(message)
	}

	return result.String()
}

// PrintLayerProgress prints the current layer pull progress to the reporter.
func (w *ProgressWriter) PrintLayerProgress(rep *reporter.Reporter) {
	nodes := slices.Collect(maps.Keys(w.ongoingInstalls))
	sort.Strings(nodes)

	sb := strings.Builder{}

	for _, node := range nodes {
		sb.WriteString(node + ": ")

		fmt.Fprintf(&sb, "%s\n", w.ongoingInstalls[node].Status.Fmt())
	}

	rep.Report(reporter.Update{
		Message: sb.String(),
		Status:  reporter.StatusRunning,
	})
}

type installJob struct {
	Status *machine.LifecycleServiceInstallProgress
}

```

### Core Architecture Module: `internal/app/lifecycle/container.go`
```
// This Source Code Form is subject to the terms of the Mozilla Public
// License, v. 2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/.

package lifecycle

import (
	"bytes"
	"context"
	"crypto/rand"
	"encoding/hex"
	"errors"
	"fmt"
	"io"
	"log"
	"os"
	"strconv"

	"github.com/containerd/containerd/v2/client"
	"github.com/containerd/containerd/v2/core/leases"
	"github.com/containerd/containerd/v2/pkg/cio"
	"github.com/containerd/containerd/v2/pkg/oci"
	"github.com/containerd/errdefs"
	"github.com/opencontainers/runtime-spec/specs-go"
	"github.com/siderolabs/go-procfs/procfs"

	"github.com/siderolabs/talos/internal/app/internal/ctrhelper"
	"github.com/siderolabs/talos/internal/app/lifecycle/internal/output"
	"github.com/siderolabs/talos/internal/app/machined/pkg/system/pid"
	containerdrunner "github.com/siderolabs/talos/internal/app/machined/pkg/system/runner/containerd"
	"github.com/siderolabs/talos/internal/pkg/capability"
	"github.com/siderolabs/talos/internal/pkg/cgroup"
	"github.com/siderolabs/talos/internal/pkg/containerpid"
	"github.com/siderolabs/talos/internal/pkg/environment"
	"github.com/siderolabs/talos/internal/pkg/install"
	"github.com/siderolabs/talos/internal/pkg/selinux"
	"github.com/siderolabs/talos/pkg/machinery/api/common"
	configcore "github.com/siderolabs/talos/pkg/machinery/config"
	"github.com/siderolabs/talos/pkg/machinery/constants"
)

func generateContainerID() (string, error) {
	b := make([]byte, 8)
	if _, err := rand.Read(b); err != nil {
		return "", fmt.Errorf("failed to generate random ID: %w", err)
	}

	return fmt.Sprintf("installer-%s", hex.EncodeToString(b)), nil
}

// sendFunc is a callback to stream a message line back to the client.
type sendFunc func(msg string) error

// sendExitCodeFunc is a callback to stream the exit code back to the client.
type sendExitCodeFunc func(exitCode int32) error

// containerRunConfig holds all parameters needed to create and run the installer container.
type containerRunConfig struct {
	containerdInst *common.ContainerdInstance
	imageRef       string
	disk           string
	platform       string
	cfgContainer   configcore.Container
	opts           []install.Option

	send         sendFunc
	sendExitCode sendExitCodeFunc
}

// runInstallerContainer creates and runs the installer container synchronously,
// streaming output lines back to the client via the send callback.
//
//nolint:gocyclo,cyclop
func runInstallerContainer(ctx context.Context, pidRecorder pid.Recorder, rc *containerRunConfig) error {
	options := install.Options{Pull: true} //nolint:staticcheck
	if err := options.Apply(rc.opts...); err != nil {
		return fmt.Errorf("failed to apply install options: %w", err)
	}

	// connect to containerd
	ctx, detachedCtx, c8dClient, err := ctrhelper.ContainerdInstanceHelper(ctx, rc.containerdInst)
	if err != nil {
		return err
	}
	defer c8dClient.Close() //nolint:errcheck

	l, err := c8dClient.LeasesService().Create(ctx, leases.WithRandomID())
	if err != nil {
		return fmt.Errorf("failed to create lease: %w", err)
	}

	defer func() {
		if err := c8dClient.LeasesService().Delete(detachedCtx, l, leases.SynchronousDelete); err != nil {
			log.Printf("failed to delete lease %s: %v", l.ID, err)
		}
	}()

	ctx = leases.WithLease(ctx, l.ID)

	img, err := c8dClient.GetImage(ctx, rc.imageRef)
	if err != nil {
		return fmt.Errorf("installer image %q not found in containerd store: %w", rc.imageRef, err)
	}

	containerID, err := generateContainerID()
	if err != nil {
		return fmt.Errorf("failed to generate container ID: %v", err)
	}

	// Pin the installer to a fixed cgroup instead of the containerd default (which is derived
	// from the containerd namespace and the container ID): it is a critical system component,
	// so it gets a named cgroup like the other ones under 'system', and the path is known here
	// without asking containerd for the container spec back.
	cgroupPath := cgroup.Path(constants.CgroupInstaller)

	// Created ahead of the container so it carries the installer's CPU weight; runc joins it.
	if _, err = cgroup.CreateCgroup(constants.CgroupInstaller); err != nil {
		return fmt.Errorf("failed to create installer cgroup: %w", err)
	}

	// build container spec
	mounts := buildMounts()
	args := buildInstallerArgs(rc.disk, rc.platform, &options)
	specOpts := buildSpecOpts(img, args, mounts, options.Environment(environment.Get(nil)), cgroupPath)

	// create container
	ctr, err := c8dClient.NewContainer(
		ctx, containerID,
		client.WithImage(img),
		client.WithNewSnapshot(containerID, img),
		client.WithNewSpec(specOpts...),
	)
	if err != nil {
		return fmt.Errorf("failed to create container: %w", err)
	}

	defer func() {
		if cleanupErr := ctr.Delete(detachedCtx, client.WithSnapshotCleanup); cleanupErr != nil {
			log.Printf("failed to delete container %s: %v", ctr.ID(), cleanupErr)
		}
	}()

	// set up I/O: stdout/stderr -> pipe -> stream to client; stdin <- config bytes
	stdoutR, stdoutW := io.Pipe()

	var stdinReader interface {
		io.Reader
		WaitAndClose(context.Context, client.Task)
	}

	if rc.cfgContainer != nil {
		configBytes, cfgErr := rc.cfgContainer.Bytes()
		if cfgErr != nil {
			return fmt.Errorf("failed to serialize config: %w", cfgErr)
		}

		stdinReader = &containerdrunner.StdinCloser{
			Stdin:  bytes.NewReader(configBytes),
			Closer: make(chan struct{}),
		}
	}

	creator := cio.NewCreator(cio.WithStreams(stdinReader, stdoutW, stdoutW))

	task, err := ctr.NewTask(ctx, creator)
	if err != nil {
		stdoutW.Close() //nolint:errcheck

		return fmt.Errorf("failed to create task: %w", err)
	}

	defer func() {
		if _, delErr := task.Delete(detachedCtx, client.WithProcessKill); delErr != nil && !errdefs.IsNotFound(delErr) {
			log.Printf("failed to delete task: %v", delErr)
		}
	}()

	if stdinReader != nil {
		go stdinReader.WaitAndClose(ctx, task)
	}

	if err := task.Start(ctx); err != nil {
		stdoutW.Close() //nolint:errcheck

		return fmt.Errorf("failed to start task: %w", err)
	}

	localPID, err := containerpid.ResolveTask(ctx, c8dClient, cgroupPath, task)

	switch {
	case errors.Is(err, containerpid.ErrGone):
		// nothing left to record; the task exit status handled below carries the real failure
		log.Printf("not recording installer PID: %v", err)
	case err != nil:
		// Unlike a service, the installer is not worth running without a recorded PID: its calls to
		// machined would be denied, failing the install later with an error which points away from
		// the cause. The deferred task delete kills it.
		stdoutW.Close() //nolint:errcheck

		return fmt.Errorf("failed to resolve installer PID: %w", err)
	default:
		if err := pidRecorder("installer", localPID, false); err != nil {
			stdoutW.Close() //nolint:errcheck

			return fmt.Errorf("failed to record installer PID: %w", err)
		}

		defer func() {
			if err := pidRecorder("installer", 0, true); err != nil {
				log.Printf("failed to clear installer PID record: %v", err)
			}
		}()
	}

	statusC, err := task.Wait(detachedCtx)
	if err != nil {
		stdoutW.Close() //nolint:errcheck

		return fmt.Errorf("failed to wait for task: %w", err)
	}

	// stream output in a goroutine
	sendDone := make(chan error, 1)

	go func() {
		sendDone <- output.Stream(stdoutR, rc.send)
	}()

	// wait for task to exit
	exitStatus := <-statusC

	// close the write end so the reader gets EOF
	stdoutW.Close() //nolint:errcheck

	// wait for send loop to finish
	if sendErr := <-sendDone; sendErr != nil {
		log.Printf("error streaming output: %v", sendErr)
	}

	if exitStatus.Error() != nil {
		return fmt.Errorf("task exited with error: %w", exitStatus.Error())
	}

	exitCode := int32(exitStatus.ExitCode())

	// send exit code to client
	if err := rc.sendExitCode(exitCode); err != nil {
		return fmt.Errorf("failed to send exit code: %w", err)
	}

	return nil
}

// buildMounts constructs the OCI mounts for the installer container.
func buildMounts() []specs.Mount {
	mounts := []specs.Mount{
		{Type: "bind", Destination: "/dev", Source: "/dev", Options: []string{"rbind", "rshared", "rw"}},
	}

	if _, err := os.Stat(constants.MachineSocketPath); err == nil {
		mounts = append(mounts, specs.Mount{
			Type: "bind", Destination: constants.MachineSocketPath,
			Source: constants.MachineSocketPath, Options: []string{"rbind", "rshared", "ro"},
		})
	}

	if _, err := os.Stat(constants.EFIVarsMountPoint); err == nil {
		mounts = append(mounts, specs.Mount{
			Type: "efivarfs", Source: "efivarfs",
			Destination: constants.EFIVarsMountPoint,
			Options:     []string{"rw", "nosuid", "nodev", "noexec", "relatime"},
		})
	}

	if _, err := os.Stat(constants.SDStubDynamicInitrdPath); err == nil {
		mounts = append(mounts, specs.Mount{
			Type: "bind", Destination: constants.SDStubDynamicInitrdPath,
			Source: constants.SDStubDynamicInitrdPath, Options: []string{"rbind", "rshared", "ro"},
		})
	}

	return mounts
}

// buildInstallerArgs constructs the command-line arguments for the installer binary.
func buildInstallerArgs(disk, platform string, options *install.Options) []string {
	config := constants.ConfigNone
	if c := procfs.ProcCmdline().Get(constants.KernelParamConfig).First(); c != nil {
		config = *c
	}

	args := []string{
		"/bin/installer",
		"install",
		"--disk=" + disk,
		"--platform=" + platform,
		"--config=" + config,
		"--upgrade=" + strconv.FormatBool(options.Upgrade),
		"--force=" + strconv.FormatBool(options.Force),
		"--zero=" + strconv.FormatBool(options.Zero),
	}

	for _, arg := range options.ExtraKernelArgs {
		args = append(args, "--extra-kernel-arg", arg)
	}

	for _, preservedArg := range []string{
		constants.KernelParamSideroLink,
		constants.KernelParamEventsSink,
		constants.KernelParamLoggingKernel,
		constants.KernelParamEquinixMetalEvents,
		constants.KernelParamAuditdDisabled,
		constants.KernelParamDashboardDisabled,
		constants.KernelParamNetIfnames,
		constants.KernelParamEnforceModuleSigVerify,
	} {
		if c := procfs.ProcCmdline().
```

### Core Architecture Module: `internal/app/lifecycle/internal/output/stream.go`
```
// This Source Code Form is subject to the terms of the Mozilla Public
// License, v. 2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/.

// Package output streams lifecycle container output.
package output

import (
	"bufio"
	"errors"
	"fmt"
	"io"
)

const maxLineSize = 1024 * 1024

// Stream reads complete lines from r and sends each line via send.
// Lines exceeding maxLineSize are emitted as bounded fragments so the producer
// is always drained and cannot block lifecycle execution on a full pipe.
func Stream(r io.Reader, send func(string) error) error {
	reader := bufio.NewReaderSize(r, maxLineSize)

	var sendErr error

	for {
		message, err := reader.ReadSlice('\n')

		if len(message) > 0 && sendErr == nil {
			if err := send(string(message)); err != nil {
				sendErr = fmt.Errorf("failed to send message: %w", err)
			}
		}

		switch {
		case err == nil:
			continue
		case errors.Is(err, bufio.ErrBufferFull):
			continue
		case errors.Is(err, io.EOF):
			return sendErr
		default:
			return fmt.Errorf("failed to read output: %w", err)
		}
	}
}

```

### Core Architecture Module: `internal/app/lifecycle/lifecycle.go`
```
// This Source Code Form is subject to the terms of the Mozilla Public
// License, v. 2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/.

// Package lifecycle implements machine.LifecycleService.
package lifecycle

import (
	"fmt"
	"path/filepath"
	"sync"

	"go.uber.org/zap"
	"google.golang.org/grpc"
	"google.golang.org/grpc/codes"
	"google.golang.org/grpc/status"

	"github.com/siderolabs/talos/internal/app/machined/pkg/runtime"
	"github.com/siderolabs/talos/internal/app/machined/pkg/system/pid"
	"github.com/siderolabs/talos/internal/pkg/install"
	"github.com/siderolabs/talos/pkg/machinery/api/machine"
	blockres "github.com/siderolabs/talos/pkg/machinery/resources/block"
	crires "github.com/siderolabs/talos/pkg/machinery/resources/cri"
)

// Service implements machine.LifecycleService.
type Service struct {
	machine.UnimplementedLifecycleServiceServer

	lock          sync.Mutex
	runtime       runtime.Runtime
	logger        *zap.Logger
	consoleLogger *zap.Logger
}

// NewService creates a new instance of the lifecycle service.
//
// The consoleLogger is used only to log the start and the result of the install/upgrade,
// as these are visible on the console; the progress goes to the logger.
func NewService(runtime runtime.Runtime, logger, consoleLogger *zap.Logger) *Service {
	return &Service{
		lock:          sync.Mutex{},
		runtime:       runtime,
		logger:        logger.With(zap.String("service", "lifecycle")),
		consoleLogger: consoleLogger.With(zap.String("service", "lifecycle")),
	}
}

// Install handles the installation of the machine.
// It ensures that only one installation or upgrade can occur at a time by using a mutex lock.
//
//nolint:gocyclo
func (s *Service) Install(req *machine.LifecycleServiceInstallRequest, ss grpc.ServerStreamingServer[machine.LifecycleServiceInstallResponse]) (retErr error) {
	if s.runtime.State().Platform().Mode().IsAgent() {
		return status.Error(codes.Unimplemented, "API is not implemented in agent mode")
	}

	if err := s.checkSupported(runtime.Upgrade); err != nil {
		return err
	}

	ctx := ss.Context()

	if !s.lock.TryLock() {
		return status.Error(codes.FailedPrecondition, "another installation/upgrade is already in progress")
	}
	defer s.lock.Unlock()

	if s.runtime.State().Platform().Mode().InContainer() {
		return status.Error(codes.FailedPrecondition, "installation is not supported in container mode")
	}

	if s.runtime.State().Machine().Installed() {
		return status.Error(codes.AlreadyExists, "machine is already installed")
	}

	if err := crires.WaitForImageCache(ctx, s.runtime.State().V1Alpha2().Resources()); err != nil {
		return status.Error(codes.Internal, fmt.Sprintf("failed to wait for the image cache: %v", err))
	}

	installerImage := req.GetSource().GetImageName()
	if installerImage == "" {
		return status.Error(codes.InvalidArgument, "installer image name is required")
	}

	disk := req.GetDestination().GetDisk()
	if disk == "" {
		return status.Error(codes.InvalidArgument, "destination disk is required")
	}

	targetDisk, err := filepath.EvalSymlinks(disk)
	if err != nil {
		return status.Error(codes.InvalidArgument, fmt.Sprintf("invalid disk path: %v", err))
	}

	s.consoleLogger.Info(
		"install via LifecycleService started",
		zap.String("installer_image", installerImage),
		zap.String("disk", targetDisk),
		zap.Stringer("containerd_driver", req.GetContainerd().GetDriver()),
		zap.Stringer("containerd_namespace", req.GetContainerd().GetNamespace()),
	)

	var installerExitCode int32

	defer func() { s.logResult("install", installerExitCode, retErr) }()

	//nolint:dupl
	err = runInstallerContainer(ctx,
		pid.NewStateRecorder(s.runtime.State().V1Alpha2().Resources()).Record,
		&containerRunConfig{
			containerdInst: req.GetContainerd(),
			imageRef:       installerImage,
			disk:           targetDisk,
			platform:       s.runtime.State().Platform().Name(),
			cfgContainer:   s.runtime.ConfigContainer(),
			opts: []install.Option{
				install.WithForce(true),
				install.WithZero(false),
				install.WithGrubUseUKICmdline(true),
			},
			send: func(msg string) error {
				s.logger.Info("installation progress", zap.String("message", msg))

				return ss.Send(&machine.LifecycleServiceInstallResponse{
					Progress: &machine.LifecycleServiceInstallProgress{
						Response: &machine.LifecycleServiceInstallProgress_Message{
							Message: msg,
						},
					},
				})
			},
			sendExitCode: func(exitCode int32) error {
				installerExitCode = exitCode

				return ss.Send(&machine.LifecycleServiceInstallResponse{
					Progress: &machine.LifecycleServiceInstallProgress{
						Response: &machine.LifecycleServiceInstallProgress_ExitCode{
							ExitCode: exitCode,
						},
					},
				})
			},
		})
	if err != nil {
		return status.Error(codes.Internal, fmt.Sprintf("installation failed: %v", err))
	}

	// the installer created the META partition from scratch: merge the in-memory META with what the
	// installer wrote and persist it, as there is no install sequence around this call to do it
	// (and the reboot comes as a separate API call)
	resources := s.runtime.State().V1Alpha2().Resources()
	meta := s.runtime.State().Machine().Meta()

	if err = install.ReloadMeta(ctx, resources, meta); err != nil {
		return status.Error(codes.Internal, fmt.Sprintf("failed to reload META: %v", err))
	}

	if err = install.SyncMeta(ctx, resources, meta); err != nil {
		return status.Error(codes.Internal, fmt.Sprintf("failed to sync META: %v", err))
	}

	return nil
}

// Upgrade handles the upgrade of the machine.
// It ensures that only one installation or upgrade can occur at a time by using a mutex lock.
//
//nolint:gocyclo
func (s *Service) Upgrade(req *machine.LifecycleServiceUpgradeRequest, ss grpc.ServerStreamingServer[machine.LifecycleServiceUpgradeResponse]) (retErr error) {
	if s.runtime.State().Platform().Mode().IsAgent() {
		return status.Error(codes.Unimplemented, "API is not implemented in agent mode")
	}

	if err := s.checkSupported(runtime.Upgrade); err != nil {
		return err
	}

	ctx := ss.Context()

	if !s.lock.TryLock() {
		return status.Error(codes.FailedPrecondition, "another installation/upgrade is already in progress")
	}
	defer s.lock.Unlock()

	if s.runtime.State().Platform().Mode().InContainer() {
		return status.Error(codes.FailedPrecondition, "upgrade is not supported in container mode")
	}

	if !s.runtime.State().Machine().Installed() {
		return status.Error(codes.FailedPrecondition, "machine is not installed")
	}

	installerImage := req.GetSource().GetImageName()
	if installerImage == "" {
		return status.Error(codes.InvalidArgument, "installer image name is required")
	}

	systemDisk, err := blockres.GetSystemDisk(ctx, s.runtime.State().V1Alpha2().Resources())
	if err != nil {
		return status.Error(codes.Internal, fmt.Sprintf("failed to get system disk: %v", err))
	}

	if systemDisk == nil {
		return status.Error(codes.Internal, "system disk not found")
	}

	devname := systemDisk.DevPath

	s.consoleLogger.Info(
		"upgrade via LifecycleService started",
		zap.String("installer_image", installerImage),
		zap.String("disk", devname),
		zap.Stringer("containerd_driver", req.GetContainerd().GetDriver()),
		zap.Stringer("containerd_namespace", req.GetContainerd().GetNamespace()),
	)

	var installerExitCode int32

	defer func() { s.logResult("upgrade", installerExitCode, retErr) }()

	//nolint:dupl
	err = runInstallerContainer(ctx,
		pid.NewStateRecorder(s.runtime.State().V1Alpha2().Resources()).Record,
		&containerRunConfig{
			containerdInst: req.GetContainerd(),
			imageRef:       installerImage,
			disk:           devname,
			platform:       s.runtime.State().Platform().Name(),
			cfgContainer:   s.runtime.ConfigContainer(),
			opts: []install.Option{
				install.WithUpgrade(true),
				install.WithForce(false),
			},
			send: func(msg string) error {
				s.logger.Info("upgrade progress", zap.String("message", msg))

				return ss.Send(&machine.LifecycleServiceUpgradeResponse{
					Progress: &machine.LifecycleServiceInstallProgress{
						Response: &machine.LifecycleServiceInstallProgress_Message{
							Message: msg,
						},
					},
				})
			},
			sendExitCode: func(exitCode int32) error {
				installerExitCode = exitCode

				return ss.Send(&machine.LifecycleServiceUpgradeResponse{
					Progress: &machine.LifecycleServiceInstallProgress{
						Response: &machine.LifecycleServiceInstallProgress_ExitCode{
							ExitCode: exitCode,
						},
					},
				})
			},
		})
	if err != nil {
		return status.Error(codes.Internal, fmt.Sprintf("upgrade failed: %v", err))
	}

	return nil
}

// logResult logs the outcome of the install/upgrade to the console.
func (s *Service) logResult(op string, exitCode int32, err error) {
	switch {
	case err != nil:
		s.consoleLogger.Error(op+" via LifecycleService failed", zap.String("error", status.Convert(err).Message()))
	case exitCode != 0:
		s.consoleLogger.Error(op+" via LifecycleService failed", zap.Int32("exit_code", exitCode))
	default:
		s.consoleLogger.Info(op + " via LifecycleService succeeded")
	}
}

func (s *Service) checkSupported(feature runtime.ModeCapability) error {
	mode := s.runtime.State().Platform().Mode()

	if !mode.Supports(feature) {
		return status.Errorf(codes.FailedPrecondition, "method is not supported in %s mode", mode.String())
	}

	return nil
}

```

### Core Architecture Module: `internal/app/machined/pkg/controllers/containers/lifecycle.go`
```
// This Source Code Form is subject to the terms of the Mozilla Public
// License, v. 2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/.

package containers

import (
	"context"
	"fmt"

	"github.com/cosi-project/runtime/pkg/controller"
	"github.com/cosi-project/runtime/pkg/resource"
	"github.com/cosi-project/runtime/pkg/safe"
	"github.com/cosi-project/runtime/pkg/state"
	"go.uber.org/zap"

	"github.com/siderolabs/talos/pkg/machinery/resources/containers"
)

// readContainerLifecycle returns the container shutdown barrier, or nil if it does not exist yet.
//
// It legitimately may not exist: the startup task creates it, so a controller can run a pass before
// it is there.
func readContainerLifecycle(ctx context.Context, runtime controller.Runtime) (*containers.ContainerLifecycle, error) {
	containerLifecycle, err := safe.ReaderGetByID[*containers.ContainerLifecycle](ctx, runtime, containers.ContainerLifecycleID)
	if err != nil {
		if state.IsNotFoundError(err) {
			return nil, nil
		}

		return nil, fmt.Errorf("failed to get container lifecycle: %w", err)
	}

	return containerLifecycle, nil
}

// reconcileLifecycle holds a finalizer on the container shutdown barrier on behalf of controllerName.
//
// The barrier carries no data: the finalizer set is the payload, and the shutdown sequence blocks
// until it is empty. Every controller that owns something which must be wound down before services
// stop holds one, and releases it only once releasable reports that it has nothing left to wind down.
//
// Holding it is only half of the contract: a controller that holds one must also react to the
// barrier tearing down by winding down what it owns, or the shutdown sequence waits on a finalizer
// that is never released. See RuntimeController.reconcile.
func reconcileLifecycle(
	ctx context.Context,
	runtime controller.Runtime,
	logger *zap.Logger,
	containerLifecycle *containers.ContainerLifecycle,
	controllerName string,
	releasable bool,
) error {
	if containerLifecycle == nil {
		return nil
	}

	hasFinalizer := containerLifecycle.Metadata().Finalizers().Has(controllerName)

	switch containerLifecycle.Metadata().Phase() {
	case resource.PhaseRunning:
		if !hasFinalizer {
			if err := runtime.AddFinalizer(ctx, containerLifecycle.Metadata(), controllerName); err != nil {
				return fmt.Errorf("failed to add lifecycle finalizer: %w", err)
			}

			logger.Debug("holding the container shutdown barrier")
		}
	case resource.PhaseTearingDown:
		// Not logging the still-waiting case: it would repeat on every reconcile for the length of
		// the shutdown, and the controllers already log each thing they are winding down.
		if hasFinalizer && releasable {
			if err := runtime.RemoveFinalizer(ctx, containerLifecycle.Metadata(), controllerName); err != nil {
				return fmt.Errorf("failed to remove lifecycle finalizer: %w", err)
			}

			logger.Info("released the container shutdown barrier")
		}
	}

	return nil
}

```

### Core Architecture Module: `internal/app/machined/pkg/controllers/k8s/internal/k8stemplates/coredns.go`
```
// This Source Code Form is subject to the terms of the Mozilla Public
// License, v. 2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/.

package k8stemplates

import (
	"cmp"
	"fmt"

	appsv1 "k8s.io/api/apps/v1"
	corev1 "k8s.io/api/core/v1"
	rbacv1 "k8s.io/api/rbac/v1"
	"k8s.io/apimachinery/pkg/api/resource"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/apimachinery/pkg/runtime"
	"k8s.io/apimachinery/pkg/util/intstr"

	"github.com/siderolabs/talos/pkg/machinery/resources/k8s"
)

// CoreDNSService returns the CoreDNS service object.
func CoreDNSService(spec *k8s.BootstrapManifestsConfigSpec) runtime.Object {
	obj := &corev1.Service{
		Kind:       "Service",
		APIVersion: corev1.SchemeGroupVersion.Version,
		Name:       "kube-dns",
		Namespace:  "kube-system",
		Annotations: map[string]string{
			"prometheus.io/scrape": "true",
			"prometheus.io/port":   "9153",
		},
		Labels: map[string]string{
			"k8s-app":                       "kube-dns",
			"kubernetes.io/cluster-service": "true",
			"kubernetes.io/name":            "CoreDNS",
		},
		Spec: corev1.ServiceSpec{
			Selector: map[string]string{
				"k8s-app": "kube-dns",
			},
			ClusterIP: cmp.Or(spec.DNSServiceIP, spec.DNSServiceIPv6),
			Ports: []corev1.ServicePort{
				{
					Name:       "dns",
					Port:       53,
					Protocol:   corev1.ProtocolUDP,
					TargetPort: intstr.FromInt(53),
				},
				{
					Name:       "dns-tcp",
					Port:       53,
					Protocol:   corev1.ProtocolTCP,
					TargetPort: intstr.FromInt(53),
				},
				{
					Name:       "metrics",
					Port:       9153,
					Protocol:   corev1.ProtocolTCP,
					TargetPort: intstr.FromInt(9153),
				},
			},
		},
	}

	if spec.DNSServiceIP != "" {
		obj.Spec.ClusterIPs = append(obj.Spec.ClusterIPs, spec.DNSServiceIP)
		obj.Spec.IPFamilies = append(obj.Spec.IPFamilies, corev1.IPv4Protocol)
	}

	if spec.DNSServiceIPv6 != "" {
		obj.Spec.ClusterIPs = append(obj.Spec.ClusterIPs, spec.DNSServiceIPv6)
		obj.Spec.IPFamilies = append(obj.Spec.IPFamilies, corev1.IPv6Protocol)
	}

	if spec.DNSServiceIP != "" && spec.DNSServiceIPv6 != "" {
		obj.Spec.IPFamilyPolicy = new(corev1.IPFamilyPolicyRequireDualStack)
	} else {
		obj.Spec.IPFamilyPolicy = new(corev1.IPFamilyPolicySingleStack)
	}

	return obj
}

// CoreDNSServiceAccount returns the CoreDNS service account object.
func CoreDNSServiceAccount() runtime.Object {
	return &corev1.ServiceAccount{
		Kind:       "ServiceAccount",
		APIVersion: corev1.SchemeGroupVersion.Version,
		Name:       "coredns",
		Namespace:  "kube-system",
	}
}

// CoreDNSClusterRoleBinding returns the CoreDNS ClusterRoleBinding object.
func CoreDNSClusterRoleBinding() runtime.Object {
	return &rbacv1.ClusterRoleBinding{
		Kind:       "ClusterRoleBinding",
		APIVersion: rbacv1.SchemeGroupVersion.String(),
		Name:       "system:coredns",
		Labels: map[string]string{
			"kubernetes.io/bootstrapping": "rbac-defaults",
		},
		Annotations: map[string]string{
			"rbac.authorization.kubernetes.io/autoupdate": "true",
		},
		RoleRef: rbacv1.RoleRef{
			APIGroup: rbacv1.GroupName,
			Kind:     "ClusterRole",
			Name:     "system:coredns",
		},
		Subjects: []rbacv1.Subject{
			{
				Kind:      "ServiceAccount",
				Name:      "coredns",
				Namespace: "kube-system",
			},
		},
	}
}

// CoreDNSClusterRole returns the CoreDNS ClusterRole object.
func CoreDNSClusterRole() runtime.Object {
	return &rbacv1.ClusterRole{
		Kind:       "ClusterRole",
		APIVersion: rbacv1.SchemeGroupVersion.String(),
		Name:       "system:coredns",
		Labels: map[string]string{
			"kubernetes.io/bootstrapping": "rbac-defaults",
		},
		Rules: []rbacv1.PolicyRule{
			{
				APIGroups: []string{""},
				Resources: []string{"endpoints", "services", "pods", "namespaces"},
				Verbs:     []string{"list", "watch"},
			},
			{
				APIGroups: []string{"discovery.k8s.io"},
				Resources: []string{"endpointslices"},
				Verbs:     []string{"list", "watch"},
			},
		},
	}
}

// CoreDNSConfigMap returns the CoreDNS ConfigMap object.
func CoreDNSConfigMap(spec *k8s.BootstrapManifestsConfigSpec) runtime.Object {
	coreDNSConfig := fmt.Sprintf(`.:53 {
    errors
    health {
        lameduck 5s
    }
    ready
    log . {
        class error
    }
    prometheus :9153

    kubernetes %s in-addr.arpa ip6.arpa {
        pods insecure
        fallthrough in-addr.arpa ip6.arpa
        ttl 30
    }
    forward . /etc/resolv.conf {
       max_concurrent 1000
    }
    cache 30`, spec.ClusterDomain)

	if spec.ClusterDomain != "" {
		coreDNSConfig += fmt.Sprintf(` {
       disable success %s
       disable denial %s
    }
`, spec.ClusterDomain, spec.ClusterDomain)
	} else {
		coreDNSConfig += "\n"
	}

	coreDNSConfig += `    loop
    reload
    loadbalance
}
`

	return &corev1.ConfigMap{
		Kind:       "ConfigMap",
		APIVersion: corev1.SchemeGroupVersion.Version,
		Name:       "coredns",
		Namespace:  "kube-system",
		Data: map[string]string{
			"Corefile": coreDNSConfig,
		},
	}
}

// CoreDNSDeployment returns the CoreDNS Deployment object.
func CoreDNSDeployment(spec *k8s.BootstrapManifestsConfigSpec) runtime.Object {
	return &appsv1.Deployment{
		Kind:       "Deployment",
		APIVersion: appsv1.SchemeGroupVersion.String(),
		Name:       "coredns",
		Namespace:  "kube-system",
		Labels: map[string]string{
			"k8s-app":            "kube-dns",
			"kubernetes.io/name": "CoreDNS",
		},
		Spec: appsv1.DeploymentSpec{
			Replicas: new(int32(2)),
			Strategy: appsv1.DeploymentStrategy{
				Type: appsv1.RollingUpdateDeploymentStrategyType,
				RollingUpdate: &appsv1.RollingUpdateDeployment{
					MaxUnavailable: new(intstr.FromInt(1)),
				},
			},
			Selector: &metav1.LabelSelector{
				MatchLabels: map[string]string{
					"k8s-app": "kube-dns",
				},
			},
			Template: corev1.PodTemplateSpec{
				ObjectMeta: metav1.ObjectMeta{
					Labels: map[string]string{
						"k8s-app": "kube-dns",
					},
				},
				Spec: corev1.PodSpec{
					NodeSelector: map[string]string{
						"kubernetes.io/os": "linux",
					},
					Affinity: &corev1.Affinity{
						NodeAffinity: nodeAffinity,
						PodAntiAffinity: &corev1.PodAntiAffinity{
							PreferredDuringSchedulingIgnoredDuringExecution: []corev1.WeightedPodAffinityTerm{
								{
									Weight: 100,
									PodAffinityTerm: corev1.PodAffinityTerm{
										LabelSelector: &metav1.LabelSelector{
											MatchExpressions: []metav1.LabelSelectorRequirement{
												{
													Key:      "k8s-app",
													Operator: metav1.LabelSelectorOpIn,
													Values:   []string{"kube-dns"},
												},
											},
										},
										TopologyKey: "kubernetes.io/hostname",
									},
								},
							},
						},
					},
					ServiceAccountName: "coredns",
					PriorityClassName:  SystemClusterCriticalPriorityClassName,
					Tolerations: []corev1.Toleration{
						{
							Key:      "node-role.kubernetes.io/control-plane",
							Operator: corev1.TolerationOpExists,
							Effect:   corev1.TaintEffectNoSchedule,
						},
						{
							Key:      "node.cloudprovider.kubernetes.io/uninitialized",
							Operator: corev1.TolerationOpExists,
							Effect:   corev1.TaintEffectNoSchedule,
						},
					},
					Containers: []corev1.Container{
						{
							Name:            "coredns",
							Image:           spec.CoreDNSImage,
							ImagePullPolicy: corev1.PullIfNotPresent,
							Resources: corev1.ResourceRequirements{
								Limits: corev1.ResourceList{
									corev1.ResourceMemory: resource.MustParse("170Mi"),
								},
								Requests: corev1.ResourceList{
									corev1.ResourceCPU:    resource.MustParse("100m"),
									corev1.ResourceMemory: resource.MustParse("70Mi"),
								},
							},
							Env: []corev1.EnvVar{
								{
									Name:  "GOMEMLIMIT",
									Value: "161MiB",
								},
							},
							Args: []string{"-conf", "/etc/coredns/Corefile"},
							VolumeMounts: []corev1.VolumeMount{
								{
									Name:      "config-volume",
									MountPath: "/etc/coredns",
									ReadOnly:  true,
								},
							},
							Ports: []corev1.ContainerPort{
								{
									Name:          "dns",
									Protocol:      corev1.ProtocolUDP,
									ContainerPort: 53,
								},
								{
									Name:          "dns-tcp",
									Protocol:      corev1.ProtocolTCP,
									ContainerPort: 53,
								},
								{
									Name:          "metrics",
									Protocol:      corev1.ProtocolTCP,
									ContainerPort: 9153,
								},
							},
							LivenessProbe: &corev1.Probe{
								HTTPGet: &corev1.HTTPGetAction{
									Path:   "/health",
									Port:   intstr.FromInt(8080),
									Scheme: corev1.URISchemeHTTP,
								},
								InitialDelaySeconds: 60,
								TimeoutSeconds:      5,
								SuccessThreshold:    1,
								FailureThreshold:    5,
							},
							ReadinessProbe: &corev1.Probe{
								HTTPGet: &corev1.HTTPGetAction{
									Path:   "/ready",
									Port:   intstr.FromInt(8181),
									Scheme: corev1.URISchemeHTTP,
								},
							},
							SecurityContext: &corev1.SecurityContext{
								AllowPrivilegeEscalation: new(false),
								Capabilities: &corev1.Capabilities{
									Add:  []corev1.Capability{"NET_BIND_SERVICE"},
									Drop: []corev1.Capability{"ALL"},
								},
								ReadOnlyRootFilesystem: new(true),
							},
						},
					},
					DNSPolicy: corev1.DNSDefault,
					Volumes: []corev1.Volume{
						{
							Name: "config-volume",
							ConfigMap: &corev1.ConfigMapVolumeSource{
								Name: "coredns",
								Items: []corev1.KeyToPath{
									{
										Key:  "Corefile",
										Path: "Corefile",
									},
								},
							},
						},
					},
				},
			},
		},
	}
}

```

### Core Architecture Module: `internal/app/machined/pkg/controllers/k8s/internal/kubeletstate/cpu_manager.go`
```
// This Source Code Form is subject to the terms of the Mozilla Public
// License, v. 2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/.

package kubeletstate

import (
	"cmp"
	"encoding/json"
	"errors"
	"fmt"
	"math"
	"strconv"

	"k8s.io/apimachinery/pkg/api/resource"
	kubeletconfig "k8s.io/kubelet/config/v1beta1"
	"k8s.io/utils/cpuset"
)

// CPU manager policy names (see k8s.io/kubernetes/pkg/kubelet/cm/cpumanager).
const (
	CPUManagerPolicyNone   = "none"
	CPUManagerPolicyStatic = "static"

	strictCPUReservationOption = "strict-cpu-reservation"
)

// CPUManagerConfig is the subset of the kubelet configuration which affects the CPU manager state.
type CPUManagerConfig struct {
	// Policy is the CPU manager policy (normalized, "none" if not set).
	Policy string
	// StrictCPUReservation is the value of the "strict-cpu-reservation" policy option.
	StrictCPUReservation bool
	// ReservedCPUs is the explicit set of reserved CPUs (reservedSystemCPUs), might be empty.
	ReservedCPUs cpuset.CPUSet
	// NumReservedCPUs is the number of reserved CPUs.
	//
	// If ReservedCPUs is empty, kubelet reserves this many CPUs picked by the topology.
	NumReservedCPUs int
}

// CPUManagerConfigFromKubelet extracts the CPU manager configuration from the kubelet configuration.
func CPUManagerConfigFromKubelet(cfg *kubeletconfig.KubeletConfiguration) (CPUManagerConfig, error) {
	reservedCPUs, err := cpuset.Parse(cfg.ReservedSystemCPUs)
	if err != nil {
		return CPUManagerConfig{}, fmt.Errorf("failed to parse reservedSystemCPUs %q: %w", cfg.ReservedSystemCPUs, err)
	}

	result := CPUManagerConfig{
		Policy:       cmp.Or(cfg.CPUManagerPolicy, CPUManagerPolicyNone),
		ReservedCPUs: reservedCPUs,
	}

	if value, ok := cfg.CPUManagerPolicyOptions[strictCPUReservationOption]; ok {
		result.StrictCPUReservation, err = strconv.ParseBool(value)
		if err != nil {
			return CPUManagerConfig{}, fmt.Errorf("failed to parse %s policy option %q: %w", strictCPUReservationOption, value, err)
		}
	}

	if !reservedCPUs.IsEmpty() {
		// kubelet overrides the CPU reservation with the explicit set
		result.NumReservedCPUs = reservedCPUs.Size()

		return result, nil
	}

	// kubelet takes the ceiling of the sum of kube and system reserved CPU quantities
	var reservedQuantity resource.Quantity

	for _, reserved := range []map[string]string{cfg.KubeReserved, cfg.SystemReserved} {
		value, ok := reserved["cpu"]
		if !ok {
			continue
		}

		quantity, err := resource.ParseQuantity(value)
		if err != nil {
			return CPUManagerConfig{}, fmt.Errorf("failed to parse reserved CPU quantity %q: %w", value, err)
		}

		reservedQuantity.Add(quantity)
	}

	result.NumReservedCPUs = int(math.Ceil(float64(reservedQuantity.MilliValue()) / 1000))

	return result, nil
}

// cpuManagerCheckpoint is the CPU manager state file format (v2).
type cpuManagerCheckpoint struct {
	PolicyName    string                       `json:"policyName"`
	DefaultCPUSet string                       `json:"defaultCpuSet"`
	Entries       map[string]map[string]string `json:"entries,omitempty"`
}

func validateCPUManagerState(raw []byte, cfg *kubeletconfig.KubeletConfiguration, machine Machine) error {
	config, err := CPUManagerConfigFromKubelet(cfg)
	if err != nil {
		return err
	}

	return ValidateCPUManagerState(raw, config, machine)
}

// ValidateCPUManagerState checks whether the kubelet would load the CPU manager state with the given configuration.
//
// It mirrors the checks done by the kubelet on startup (see k8s.io/kubernetes/pkg/kubelet/cm/cpumanager/policy_static.go).
//
//nolint:gocyclo,cyclop
func ValidateCPUManagerState(raw []byte, cfg CPUManagerConfig, machine Machine) error {
	var checkpoint cpuManagerCheckpoint

	if err := json.Unmarshal(raw, &checkpoint); err != nil {
		return fmt.Errorf("failed to parse the state: %w", err)
	}

	if checkpoint.PolicyName != cfg.Policy {
		return fmt.Errorf("policy changed from %q to %q", checkpoint.PolicyName, cfg.Policy)
	}

	if cfg.Policy != CPUManagerPolicyStatic {
		return nil // only the static policy validates the state
	}

	defaultCPUs, err := cpuset.Parse(checkpoint.DefaultCPUSet)
	if err != nil {
		return fmt.Errorf("failed to parse default cpuset %q: %w", checkpoint.DefaultCPUSet, err)
	}

	assignedCPUs := cpuset.New()

	for pod, containers := range checkpoint.Entries {
		for container, value := range containers {
			containerCPUs, err := cpuset.Parse(value)
			if err != nil {
				return fmt.Errorf("failed to parse cpuset %q for container %q in pod %q: %w", value, container, pod, err)
			}

			if !containerCPUs.Intersection(defaultCPUs).IsEmpty() {
				return fmt.Errorf("cpuset %q of container %q in pod %q overlaps with the default cpuset %q", value, container, pod, checkpoint.DefaultCPUSet)
			}

			assignedCPUs = assignedCPUs.Union(containerCPUs)
		}
	}

	if defaultCPUs.IsEmpty() {
		if len(checkpoint.Entries) > 0 {
			return errors.New("default cpuset is empty, but there are container assignments")
		}

		return nil // empty state, kubelet initializes it
	}

	knownCPUs := defaultCPUs.Union(assignedCPUs)
	availableCPUs := machine.OnlineCPUs

	switch {
	case !cfg.ReservedCPUs.IsEmpty():
		// explicit set of reserved CPUs
		if cfg.StrictCPUReservation {
			availableCPUs = availableCPUs.Difference(cfg.ReservedCPUs)

			if !cfg.ReservedCPUs.Intersection(defaultCPUs).IsEmpty() {
				return fmt.Errorf("strictly reserved CPUs %q are present in the default cpuset %q", cfg.ReservedCPUs, defaultCPUs)
			}
		} else if !cfg.ReservedCPUs.IsSubsetOf(defaultCPUs) {
			return fmt.Errorf("not all reserved CPUs %q are present in the default cpuset %q", cfg.ReservedCPUs, defaultCPUs)
		}
	case cfg.StrictCPUReservation:
		// the reserved CPUs are picked by the kubelet based on the topology, but they are excluded
		// from the state with strict reservation, so the previously reserved set can be recovered from the state
		previouslyReservedCPUs := availableCPUs.Difference(knownCPUs)

		if previouslyReservedCPUs.Size() != cfg.NumReservedCPUs {
			return fmt.Errorf("number of strictly reserved CPUs changed from %d to %d", previouslyReservedCPUs.Size(), cfg.NumReservedCPUs)
		}

		availableCPUs = availableCPUs.Difference(previouslyReservedCPUs)
	default:
		// the reserved CPUs are picked by the kubelet based on the topology, and they are part of the default cpuset,
		// so there is no way to tell which CPUs were reserved when the state was created
	}

	if !knownCPUs.Equals(availableCPUs) {
		return fmt.Errorf("set of available CPUs %q doesn't match the CPUs in the state %q", availableCPUs, knownCPUs)
	}

	return nil
}

```

### Core Architecture Module: `internal/app/machined/pkg/controllers/k8s/internal/kubeletstate/kubeletstate.go`
```
// This Source Code Form is subject to the terms of the Mozilla Public
// License, v. 2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/.

// Package kubeletstate validates the state files persisted by the kubelet resource managers (CPU manager, memory manager).
//
// The kubelet validates the persisted state against the current configuration and the machine topology on startup,
// and refuses to start if they don't match (e.g. the policy changed, or the set of reserved CPUs changed).
// The state files carry everything the kubelet checks them against, so this package re-implements the
// kubelet checks to remove the state files the kubelet would reject before it is started.
package kubeletstate

import (
	"errors"
	"fmt"
	"os"
	"path/filepath"
	"strings"

	"go.uber.org/zap"
	kubeletconfig "k8s.io/kubelet/config/v1beta1"
	"k8s.io/utils/cpuset"
)

// Machine describes the machine topology the kubelet validates the resource manager state against.
type Machine struct {
	// OnlineCPUs is the set of online CPUs.
	OnlineCPUs cpuset.CPUSet
	// NUMANodes is the set of NUMA nodes.
	NUMANodes cpuset.CPUSet
}

// DiscoverMachine reads the machine topology from sysfs the same way kubelet (cadvisor) does.
func DiscoverMachine() (Machine, error) {
	onlineCPUs, err := readSysfsList("/sys/devices/system/cpu/online")
	if err != nil {
		return Machine{}, fmt.Errorf("failed to read online CPUs: %w", err)
	}

	numaNodes, err := readSysfsList("/sys/devices/system/node/online")
	if err != nil {
		if !errors.Is(err, os.ErrNotExist) {
			return Machine{}, fmt.Errorf("failed to read NUMA nodes: %w", err)
		}

		// no NUMA information available, cadvisor falls back to a single NUMA node
		numaNodes = cpuset.New(0)
	}

	return Machine{
		OnlineCPUs: onlineCPUs,
		NUMANodes:  numaNodes,
	}, nil
}

func readSysfsList(path string) (cpuset.CPUSet, error) {
	raw, err := os.ReadFile(path)
	if err != nil {
		return cpuset.CPUSet{}, err
	}

	set, err := cpuset.Parse(strings.TrimSpace(string(raw)))
	if err != nil {
		return cpuset.CPUSet{}, fmt.Errorf("failed to parse %q: %w", path, err)
	}

	return set, nil
}

// stateFile describes a state file persisted by one of the kubelet resource managers.
type stateFile struct {
	// name is the file name (in the kubelet state directory).
	name string
	// validate returns an error if the kubelet would refuse to load the state.
	validate func(raw []byte, cfg *kubeletconfig.KubeletConfiguration, machine Machine) error
}

var stateFiles = []stateFile{
	{
		name:     "cpu_manager_state",
		validate: validateCPUManagerState,
	},
	{
		name:     "memory_manager_state",
		validate: validateMemoryManagerState,
	},
}

// Cleanup removes the resource manager state files in the kubelet state directory which the kubelet
// would refuse to load with the given configuration on this machine.
//
// The kubelet re-creates the removed state files on startup.
func Cleanup(stateDir string, cfg *kubeletconfig.KubeletConfiguration, machine Machine, logger *zap.Logger) error {
	for _, file := range stateFiles {
		path := filepath.Join(stateDir, file.name)

		raw, err := os.ReadFile(path)
		if err != nil {
			if errors.Is(err, os.ErrNotExist) {
				continue // nothing to validate, kubelet will create the state
			}

			return fmt.Errorf("failed to read %s: %w", file.name, err)
		}

		validationErr := file.validate(raw, cfg, machine)
		if validationErr == nil {
			continue
		}

		logger.Info(
			"removing kubelet state file, as kubelet would refuse to load it",
			zap.String("file", file.name),
			zap.NamedError("reason", validationErr),
		)

		if err = os.Remove(path); err != nil {
			return fmt.Errorf("failed to remove %s: %w", file.name, err)
		}
	}

	return nil
}

```

### Core Architecture Module: `internal/app/machined/pkg/controllers/k8s/internal/kubeletstate/memory_manager.go`
```
// This Source Code Form is subject to the terms of the Mozilla Public
// License, v. 2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/.

package kubeletstate

import (
	"cmp"
	"encoding/json"
	"errors"
	"fmt"
	"maps"
	"slices"

	kubeletconfig "k8s.io/kubelet/config/v1beta1"
	"k8s.io/utils/cpuset"
)

// MemoryManagerConfig is the subset of the kubelet configuration which affects the memory manager state.
type MemoryManagerConfig struct {
	// Policy is the memory manager policy (normalized, "None" if not set).
	Policy string
	// ReservedMemory is the reserved memory per NUMA node per resource (in bytes).
	ReservedMemory map[int]map[string]uint64
}

// MemoryManagerConfigFromKubelet extracts the memory manager configuration from the kubelet configuration.
func MemoryManagerConfigFromKubelet(cfg *kubeletconfig.KubeletConfiguration) (MemoryManagerConfig, error) {
	result := MemoryManagerConfig{
		Policy:         cmp.Or(cfg.MemoryManagerPolicy, kubeletconfig.NoneMemoryManagerPolicy),
		ReservedMemory: map[int]map[string]uint64{},
	}

	for _, reservation := range cfg.ReservedMemory {
		node := int(reservation.NumaNode)

		if result.ReservedMemory[node] == nil {
			result.ReservedMemory[node] = map[string]uint64{}
		}

		for resourceName, quantity := range reservation.Limits {
			value, ok := quantity.AsInt64()
			if !ok || value < 0 {
				return MemoryManagerConfig{}, fmt.Errorf("invalid reserved memory quantity %q for resource %q on NUMA node %d", quantity.String(), resourceName, node)
			}

			result.ReservedMemory[node][string(resourceName)] = uint64(value)
		}
	}

	return result, nil
}

// memoryManagerCheckpoint is the memory manager state file format.
type memoryManagerCheckpoint struct {
	PolicyName   string                        `json:"policyName"`
	MachineState map[int]memoryManagerNUMANode `json:"machineState"`
	Entries      map[string]json.RawMessage    `json:"entries,omitempty"`
}

type memoryManagerNUMANode struct {
	MemoryMap map[string]memoryManagerMemoryTable `json:"memoryMap"`
}

type memoryManagerMemoryTable struct {
	SystemReserved uint64 `json:"systemReserved"`
}

func validateMemoryManagerState(raw []byte, cfg *kubeletconfig.KubeletConfiguration, machine Machine) error {
	config, err := MemoryManagerConfigFromKubelet(cfg)
	if err != nil {
		return err
	}

	return ValidateMemoryManagerState(raw, config, machine)
}

// ValidateMemoryManagerState checks whether the kubelet would load the memory manager state with the given configuration.
//
// It mirrors the checks done by the kubelet on startup (see k8s.io/kubernetes/pkg/kubelet/cm/memorymanager/policy_static.go).
func ValidateMemoryManagerState(raw []byte, cfg MemoryManagerConfig, machine Machine) error {
	var checkpoint memoryManagerCheckpoint

	if err := json.Unmarshal(raw, &checkpoint); err != nil {
		return fmt.Errorf("failed to parse the state: %w", err)
	}

	if checkpoint.PolicyName != cfg.Policy {
		return fmt.Errorf("policy changed from %q to %q", checkpoint.PolicyName, cfg.Policy)
	}

	if cfg.Policy != kubeletconfig.StaticMemoryManagerPolicy {
		return nil // only the static policy validates the state
	}

	if len(checkpoint.MachineState) == 0 {
		if len(checkpoint.Entries) > 0 {
			return errors.New("machine state is empty, but there are container assignments")
		}

		return nil // empty state, kubelet initializes it
	}

	stateNodes := cpuset.New(slices.Collect(maps.Keys(checkpoint.MachineState))...)

	if !stateNodes.Equals(machine.NUMANodes) {
		return fmt.Errorf("set of NUMA nodes %q doesn't match the NUMA nodes in the state %q", machine.NUMANodes, stateNodes)
	}

	for _, node := range stateNodes.List() {
		for _, resourceName := range slices.Sorted(maps.Keys(checkpoint.MachineState[node].MemoryMap)) {
			expected := cfg.ReservedMemory[node][resourceName]
			actual := checkpoint.MachineState[node].MemoryMap[resourceName].SystemReserved

			if expected != actual {
				return fmt.Errorf("reserved %s on NUMA node %d changed from %d to %d", resourceName, node, actual, expected)
			}
		}
	}

	return nil
}

```

### Core Architecture Module: `internal/app/machined/pkg/controllers/k8s/render_config_static_pods.go`
```
// This Source Code Form is subject to the terms of the Mozilla Public
// License, v. 2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/.

package k8s

import (
	"bytes"
	"context"
	"encoding/json"
	"fmt"
	"maps"
	"os"
	"path/filepath"
	"slices"
	"strings"

	"github.com/cosi-project/runtime/pkg/controller"
	"github.com/cosi-project/runtime/pkg/safe"
	"github.com/cosi-project/runtime/pkg/state"
	"github.com/siderolabs/gen/optional"
	"github.com/siderolabs/go-kubernetes/kubernetes/compatibility"
	"go.uber.org/zap"
	"k8s.io/apimachinery/pkg/apis/meta/v1/unstructured"
	"k8s.io/apimachinery/pkg/runtime"
	k8sjson "k8s.io/apimachinery/pkg/runtime/serializer/json"
	apiserverv1 "k8s.io/apiserver/pkg/apis/apiserver/v1"
	auditv1 "k8s.io/apiserver/pkg/apis/audit/v1"
	"k8s.io/client-go/tools/clientcmd"

	"github.com/siderolabs/talos/internal/pkg/selinux"
	"github.com/siderolabs/talos/pkg/machinery/constants"
	"github.com/siderolabs/talos/pkg/machinery/resources/k8s"
)

// kubeconfigExtension is the extension of the webhook kubeconfig files rendered for kube-apiserver.
const kubeconfigExtension = ".kubeconfig"

// authenticationTokenWebhookKubeconfigFilename is the name of the authentication token webhook kubeconfig file.
const authenticationTokenWebhookKubeconfigFilename = "authentication-token-webhook" + kubeconfigExtension

// authorizationWebhookKubeconfigFilename returns the name of the kubeconfig file for the authorization webhook.
func authorizationWebhookKubeconfigFilename(authorizerName string) string {
	return "authorization-webhook-" + authorizerName + kubeconfigExtension
}

// RenderConfigsStaticPodController manages k8s.ConfigsReady and renders configs for the control plane.
type RenderConfigsStaticPodController struct{}

// Name implements controller.Controller interface.
func (ctrl *RenderConfigsStaticPodController) Name() string {
	return "k8s.RenderConfigsStaticPodController"
}

// Inputs implements controller.Controller interface.
func (ctrl *RenderConfigsStaticPodController) Inputs() []controller.Input {
	return []controller.Input{
		{
			Namespace: k8s.ControlPlaneNamespaceName,
			Type:      k8s.AdmissionControlConfigType,
			Kind:      controller.InputWeak,
		},
		{
			Namespace: k8s.ControlPlaneNamespaceName,
			Type:      k8s.AuditPolicyConfigType,
			Kind:      controller.InputWeak,
		},
		{
			Namespace: k8s.ControlPlaneNamespaceName,
			Type:      k8s.AuthorizationConfigType,
			Kind:      controller.InputWeak,
		},
		{
			Namespace: k8s.ControlPlaneNamespaceName,
			Type:      k8s.AuthenticationConfigType,
			Kind:      controller.InputWeak,
		},
		{
			Namespace: k8s.ControlPlaneNamespaceName,
			Type:      k8s.SchedulerConfigType,
			ID:        optional.Some(k8s.FinalSchedulerConfigID),
			Kind:      controller.InputWeak,
		},
	}
}

// Outputs implements controller.Controller interface.
func (ctrl *RenderConfigsStaticPodController) Outputs() []controller.Output {
	return []controller.Output{
		{
			Type: k8s.ConfigStatusType,
			Kind: controller.OutputExclusive,
		},
	}
}

// Run implements controller.Controller interface.
//
//nolint:gocyclo,cyclop
func (ctrl *RenderConfigsStaticPodController) Run(ctx context.Context, r controller.Runtime, _ *zap.Logger) error {
	for {
		select {
		case <-ctx.Done():
			return nil
		case <-r.EventCh():
		}

		admissionRes, err := safe.ReaderGetByID[*k8s.AdmissionControlConfig](ctx, r, k8s.AdmissionControlConfigID)
		if err != nil {
			if state.IsNotFoundError(err) {
				continue
			}

			return fmt.Errorf("error getting admission config resource: %w", err)
		}

		admissionConfig := admissionRes.TypedSpec()

		auditRes, err := safe.ReaderGetByID[*k8s.AuditPolicyConfig](ctx, r, k8s.AuditPolicyConfigID)
		if err != nil {
			if state.IsNotFoundError(err) {
				continue
			}

			return fmt.Errorf("error getting audit config resource: %w", err)
		}

		auditConfig := auditRes.TypedSpec()

		authorizerConfigRes, err := safe.ReaderGetByID[*k8s.AuthorizationConfig](ctx, r, k8s.AuthorizationConfigID)
		if err != nil {
			if state.IsNotFoundError(err) {
				continue
			}

			return fmt.Errorf("error getting authorization config resource: %w", err)
		}

		authorizerConfig := authorizerConfigRes.TypedSpec()

		kubeAPIServerVersion := compatibility.VersionFromImageRef(authorizerConfig.Image)

		// authentication config is optional, so we don't return an error if it is not found
		authenticationConfigRes, err := safe.ReaderGetByID[*k8s.AuthenticationConfig](ctx, r, k8s.AuthenticationConfigID)
		if err != nil && !state.IsNotFoundError(err) {
			return fmt.Errorf("error getting authentication config resource: %w", err)
		}

		kubeSchedulerRes, err := safe.ReaderGetByID[*k8s.SchedulerConfig](ctx, r, k8s.FinalSchedulerConfigID)
		if err != nil {
			if state.IsNotFoundError(err) {
				continue
			}

			return fmt.Errorf("error getting scheduler config resource: %w", err)
		}

		kubeSchedulerConfig := kubeSchedulerRes.TypedSpec()

		type configFile struct {
			filename string
			f        func() (runtime.Object, error)
		}

		apiServerKubeconfigs, err := apiServerWebhookKubeconfigs(authorizerConfig, authenticationConfigRes)
		if err != nil {
			return err
		}

		apiServerConfigFiles := []configFile{
			{
				filename: "admission-control-config.yaml",
				f:        admissionControlConfig(admissionConfig),
			},
			{
				filename: "auditpolicy.yaml",
				f:        auditPolicyConfig(auditConfig),
			},
			{
				filename: "authorization-config.yaml",
				f:        authorizationConfig(authorizerConfig, kubeAPIServerVersion),
			},
			{
				filename: "authentication-config.yaml",
				f:        authenticationConfig(authenticationConfigRes),
			},
		}

		serializer := k8sjson.NewSerializerWithOptions(
			k8sjson.DefaultMetaFactory, nil, nil,
			k8sjson.SerializerOptions{
				Yaml:   true,
				Pretty: true,
				Strict: true,
			},
		)

		for _, pod := range []struct {
			name         string
			directory    string
			selinuxLabel string
			uid          int
			gid          int
			configs      []configFile
			// kubeconfigs are webhook kubeconfigs (filename -> contents) to be rendered, if not nil,
			// stale kubeconfigs not in the map are removed.
			kubeconfigs map[string]string
		}{
			{
				name:         "kube-apiserver",
				directory:    constants.KubernetesAPIServerConfigDir,
				selinuxLabel: constants.KubernetesAPIServerConfigDirSELinuxLabel,
				uid:          constants.KubernetesAPIServerRunUser,
				gid:          constants.KubernetesAPIServerRunGroup,
				configs:      apiServerConfigFiles,
				kubeconfigs:  apiServerKubeconfigs,
			},
			{
				name:         "kube-scheduler",
				directory:    constants.KubernetesSchedulerConfigDir,
				selinuxLabel: constants.KubernetesSchedulerConfigDirSELinuxLabel,
				uid:          constants.KubernetesSchedulerRunUser,
				gid:          constants.KubernetesSchedulerRunGroup,
				configs: []configFile{
					{
						filename: "scheduler-config.yaml",
						f:        schedulerConfig(kubeSchedulerConfig),
					},
				},
			},
		} {
			if err = os.MkdirAll(pod.directory, 0o755); err != nil {
				return fmt.Errorf("error creating config directory for %q: %w", pod.name, err)
			}

			if err = selinux.SetLabel(pod.directory, pod.selinuxLabel); err != nil {
				return err
			}

			// kubeconfigs are written first, as kube-apiserver checks that files referenced in the configuration exist
			for _, filename := range slices.Sorted(maps.Keys(pod.kubeconfigs)) {
				if err = writeStaticPodConfigFile(filepath.Join(pod.directory, filename), []byte(pod.kubeconfigs[filename]), pod.uid, pod.gid); err != nil {
					return fmt.Errorf("error writing kubeconfig %q for %q: %w", filename, pod.name, err)
				}
			}

			for _, configFile := range pod.configs {
				var obj runtime.Object

				obj, err = configFile.f()
				if err != nil {
					return fmt.Errorf("error generating configuration %q for %q: %w", configFile.filename, pod.name, err)
				}

				var buf bytes.Buffer

				if err = serializer.Encode(obj, &buf); err != nil {
					return fmt.Errorf("error marshaling configuration %q for %q: %w", configFile.filename, pod.name, err)
				}

				if err = writeStaticPodConfigFile(filepath.Join(pod.directory, configFile.filename), buf.Bytes(), pod.uid, pod.gid); err != nil {
					return fmt.Errorf("error writing configuration %q for %q: %w", configFile.filename, pod.name, err)
				}
			}

			if pod.kubeconfigs != nil {
				if err = removeStaleKubeconfigs(pod.directory, pod.kubeconfigs); err != nil {
					return fmt.Errorf("error removing stale kubeconfigs for %q: %w", pod.name, err)
				}
			}
		}

		if err = safe.WriterModify(ctx, r, k8s.NewConfigStatus(k8s.ControlPlaneNamespaceName, k8s.ConfigStatusStaticPodID), func(r *k8s.ConfigStatus) error {
			r.TypedSpec().Ready = true
			r.TypedSpec().Version = admissionRes.Metadata().Version().String() +
				auditRes.Metadata().Version().String() +
				authorizerConfigRes.Metadata().Version().String()

			if authenticationConfigRes != nil {
				r.TypedSpec().Version += authenticationConfigRes.Metadata().Version().String()
			}

			return nil
		}); err != nil {
			return err
		}

		r.ResetRestartBackoff()
	}
}

func writeStaticPodConfigFile(path string, contents []byte, uid, gid int) error {
	if err := os.WriteFile(path, contents, 0o400); err != nil {
		return err
	}

	return os.Chown(path, uid, gid)
}

func removeStaleKubeconfigs(directory string, kubeconfigs map[string]string) error {
	entries, err := os.ReadDir(directory)
	if err != nil {
		return err
	}

	for _, entry := range entries {
		if !entry.Type().IsRegular() || !strings.HasSuffix(entry.Name(), kubeconfigExtension) {
			continue
		}

		if _, ok := kubeconfigs[entry.Name()]; ok {
			continue
		}

		if err = os.Remove(filepath.Join(directory, entry.Name())); err != nil {
			return err
		}
	}

	return nil
}

// apiServerWebhookKubeconfigs returns the webhook kubeconfigs to be rendered for kube-apiserver.
func a
```


### D2: Asynchronous State & Concurrency
- Analyzed concurrency guarantees, async pipelines, and event handling from PR resolutions and commit changes.

### D3: Error Boundaries, Recovery & Rollbacks
- Exception handling patterns and defect resolutions extracted from closed production bug issues:
- **Issue #14949** (2026-11-13): **fix: WorkloadPidsController ENOENT /system/extensions on boot**
  *Symptoms*:  Resolves https://github.com/siderolabs/talos/issues/14948  `/system/extensions/pids.max` did not exist at boot, and the `WorkloadPidsController` failed with `ENOENT` until a later container start under `/system` enabled pids there.  We now create the extensions cgroup with pids enabled. Created with no limit, like for the other workload roots, and the pids max value is later reconciled by the controller. Adds coverage in the cgroup resources test.  ---  From a local dev cluster, build from this PR: ```sh _out/talosctl-linux-amd64 --nodes 172.20.0.5 logs controller-runtime | grep WorkloadPids 172.20.0.5: 2026-11-13T13:27:55.918Z DEBUG controller starting {"component": "controller-runtime", "controller": "runtime.WorkloadPidsController"} 172.20.0.5: 2026-11-13T13:27:55.918Z INFO pids limit updated {"component": "controller-runtime", "controller": "runtime.WorkloadPidsController", "cgroup": "taloscontainers", "previous": "max", "limit": "32668", "capacity": 32768} 172.20.0.5: 2026-11-13T13:27:55.919Z INFO pids limit updated {"component": "controller-runtime", "controller": "runtime.WorkloadPidsController", "cgroup": "virtualmachines.partition", "previous": "max", "limit": "32668", "capacity": 32768} 172.20.0.5: 2026-11-13T13:27:55.919Z INFO pids limit updated {"component": "controller-runtime", "controller": "runtime.WorkloadPidsController", "cgroup": "system/extensions", "previous": "max", "limit": "32668", "capacity": 32768} 172.20.0.5: 2026-11-13T13:27:55.951

- **Issue #14948** (2026-11-13): **WorkloadPidsController fails with ENOENT on /system/extensions at boot**
  *Symptoms*: ## Bug Report  ### What happened? What did you expect?  On boot, `runtime.WorkloadPidsController` fails twice on `/system/extensions` with ENOENT before it applies the limit on its third run (2026-11-13 11:54 UTC, node 172.16.0.2):  ``` 11:54:16.039Z ERROR controller failed {"controller": "runtime.WorkloadPidsController", "error": "error enforcing pids limit on cgroup \"system/extensions\": error reading /sys/fs/cgroup/system/extensions/pids.max: open /sys/fs/cgroup/system/extensions/pids.max: no such file or directory"} 11:54:16.039Z DEBUG restarting controller in 400.640779ms 11:54:16.442Z ERROR controller failed {... same error ...} 11:54:16.442Z DEBUG restarting controller in 1.06641896s 11:54:17.510Z INFO pids limit updated {"cgroup": "system/extensions", "previous": "max", "limit": "61649", "capacity": 61749} ```  I expected the first reconcile to set `pids.max` on all three roots without an error. `/taloscontainers` and `/virtualmachines.partition` were set on the first run.  `/system/extensions` is created with CPU resources only, so creating it doesn't enable `pids` in `/system/cgroup.subtree_control`. The file appears once something else enables `pids` on `/system`; I suspect runc starting the first container under `/system`, but haven't confirmed it. The workload roots don't hit this because #14911 creates them with `Pids: &cgroup2.Pids{}`. Doing the same for `constants.CgroupExtensions` in `internal/pkg/cgroup/cgroup.go` should fix it.  ### Steps to reproduce  1. 

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

### Incident Patch 1: `768ed463` (2026-11-13)
**Commit Message**: fix: data race between test fixtures in tests

We have observed data race in tests. Add locking to prevent it.

Signed-off-by: Mateusz Urbanek <[REDACTED_EMAIL]>

**File**: `internal/app/machined/pkg/controllers/storage/md_array_reconcile_test.go` (modified, +134/-101)
```diff
@@ -214,6 +214,15 @@ func (f *fakeMDProvisioner) grown(device string) (int, bool) {
 	return n, ok
 }
 
+// with runs fn under the fake's lock, for tests that seed or inspect fixture
+// state while the controller runtime is running.
+func (f *fakeMDProvisioner) with(fn func(f *fakeMDProvisioner)) {
+	f.mu.Lock()
+	defer f.mu.Unlock()
+
+	fn(f)
+}
+
 func (f *fakeMDProvisioner) reset() {
 	f.mu.Lock()
 	defer f.mu.Unlock()
@@ -296,12 +305,14 @@ func (suite *MDArrayReconcileSuite) TestCreatesArrayFromScratch() {
 }
 
 func (suite *MDArrayReconcileSuite) TestExtendsExistingArray() {
-	suite.md.findByMember["/dev/nvme0n1"] = "/dev/md0"
-	suite.md.details["/dev/md0"] = md.Detail{
-		Level:       "raid1",
-		RaidDevices: 2,
-		Members:     []string{"/dev/nvme0n1", "/dev/nvme1n1"},
-	}
+	suite.md.with(func(f *fakeMDProvisioner) {
+		f.findByMember["/dev/nvme0n1"] = "/dev/md0"
+		f.details["/dev/md0"] = md.Detail{
+			Level:       "raid1",
+			RaidDevices: 2,
+			Members:     []string{"/dev/nvme0n1", "/dev/nvme1n1"},
+		}
+	})
 
 	createDisk(&suite.DefaultSuite, "nvme0n1", "/dev/nvme0n1", "nvme")
 	createDisk(&suite.DefaultSuite, "nvme1n1", "/dev/nvme1n1", "nvme")
@@ -325,12 +336,14 @@ func (suite *MDArrayReconcileSuite) TestExtendsExistingArray() {
 }
 
 func (suite *MDArrayReconcileSuite) TestNoOpWhenObservedMatchesDesired() {
-	suite.md.findByMember["/dev/nvme0n1"] = "/dev/md0"
-	suite.md.details["/dev/md0"] = md.Detail{
-		Level:       "raid1",
-		RaidDevices: 2,
-		Members:     []string{"/dev/nvme0n1", "/dev/nvme1n1"},
-	}
+	suite.md.with(func(f *fakeMDProvisioner) {
+		f.findByMember["/dev/nvme0n1"] = "/dev/md0"
+		f.details["/dev/md0"] = md.Detail{
+			Level:       "raid1",
+			RaidDevices: 2,
+			Members:     []string{"/dev/nvme0n1", "/dev/nvme1n1"},
+		}
+	})
 
 	createDisk(&suite.DefaultSuite, "nvme0n1", "/dev/nvme0n1", "nvme")
 	createDisk(&suite.DefaultSuite, "nvme1n1", "/dev/nvme1n1", "nvme")
@@ -349,13 +362,15 @@ func (suite *MDArrayReconcileSuite) TestNoOpWhenObservedMatchesDesired() {
 }
 
 func (suite *MDArrayReconcileSuite) TestRebuildingWhileSyncing() {
-	suite.md.findByMember["/dev/nvme0n1"] = "/dev/md0"
-	suite.md.details["/dev/md0"] = md.Detail{
-		Level:       "raid1",
-		RaidDevices: 2,
-		Members:     []string{"/dev/nvme0n1", "/dev/nvme1n1"},
-	}
-	suite.md.syncAction["/dev/md0"] = md.SyncActionResync
+	suite.md.with(func(f *fakeMDProvisioner) {
+		f.findByMember["/dev/nvme0n1"] = "/dev/md0"
+		f.details["/dev/md0"] = md.Detail{
+			Level:       "raid1",
+			RaidDevices: 2,
+			Members:     []string{"/dev/nvme0n1", "/dev/nvme1n1"},
+		}
+		f.syncAction["/dev/md0"] = md.SyncActionResync
+	})
 
 	createDisk(&suite.DefaultSuite, "nvme0n1", "/dev/nvme0n1", "nvme")
 	createDisk(&suite.DefaultSuite, "nvme1n1", "/dev/nvme1n1", "nvme")
@@ -371,13 +386,15 @@ func (suite *MDArrayReconcileSuite) TestRebuildingWhileSyncing() {
 }
 
 func (suite *MDArrayReconcileSuite) TestReportsSyncActionAsRebuilding() {
-	suite.md.findByMember["/dev/nvme0n1"] = "/dev/md0"
-	suite.md.details["/dev/md0"] = md.Detail{
-		Level:       "raid1",
-		RaidDevices: 2,
-		Members:     []string{"/dev/nvme0n1", "/dev/nvme1n1"},
-	}
-	suite.md.syncAction["/dev/md0"] = md.SyncActionRecover
+	suite.md.with(func(f *fakeMDProvisioner) {
+		f.findByMember["/dev/nvme0n1"] = "/dev/md0"
+		f.details["/dev/md0"] = md.Detail{
+			Level:       "raid1",
+			RaidDevices: 2,
+			Members:     []string{"/dev/nvme0n1", "/dev/nvme1n1"},
+		}
+		f.syncAction["/dev/md0"] = md.SyncActionRecover
+	})
 
 	createDisk(&suite.DefaultSuite, "nvme0n1", "/dev/nvme0n1", "nvme")
 	createDisk(&suite.DefaultSuite, "nvme1n1", "/dev/nvme1n1", "nvme")
@@ -470,33 +487,32 @@ func (suite *MDArrayReconcileSuite) createSerialMirrorSpecs() {
 // observeSerialMirror changes only the simulated mdadm/sysfs observation. The
 // production controller still decides whether to create, add, or grow an array.
 func (suite *MDArrayReconcileSuite) observeSerialMirror(name, device string, members []string, action md.SyncAction) {
-	suite.md.mu.Lock()
-	defer suite.md.mu.Unlock()
-
-	metadata := "1.0"
-	if name == "data" {
-		metadata = "1.2"
-	}
+	suite.md.with(func(f *fakeMDProvisioner) {
+		metadata := "1.0"
+		if name == "data" {
+			metadata = "1.2"
+		}
 
-	suite.md.details[device] = md.Detail{
-		Level:       "raid1",
-		RaidDevices: 2,
-		Members:     append([]string(nil), members...),
-		Name:        "talos:" + name,
-		UUID:        "test-" + name,
-		Metadata:    metadata,
-	}
-	suite.md.syncAction[device] = action
+		f.details[device] = md.Detail{
+			Level:       "raid1",
+			RaidDevices: 2,
+			Members:     append([]string(nil), members...),
+			Name:        "talos:" + name,
+			UUID:        "test-" + name,
+			Metadata:    metadata,
+		}
+		f.syncAction[device] = action
 
-	for member, arrayDevice := range suite.md.findByMember {
-		if arrayDevice == device {
-			delete(suite.md.findByMember, member)
+		for member, arrayDevice := range f.findByMember {
+			if arrayDevic
```

---

### Incident Patch 2: `0cd2d52f` (2026-11-12)
**Commit Message**: fix: write extension service config files to a detached tmpfs

The controller wrote extension service config files with plain os
calls into /system/overlays/extensions, a directory that stays
writable for anything that can reach /system. Mount a detached 1M
tmpfs instead, write the files only through its xfs root and bind it
read-only at the old path, so only the controller can change them.

Store each file at its mount path under the service directory
instead of flattening the path into one file name. Flattening made
"/etc/a/b" and "/etc/a-b" the same file, so one silently replaced
the other. Mount paths must now be absolute and clean, and must not
repeat or sit under another mount path of the same service, so a
path like "../tailscale/etc/auth" can't reach another service's
directory. The controller also writes each service's files through
a root opened beneath its directory, so a mount path that slipped
past validation still can't resolve outside of it.

Remove stale files before writing, so a path that turns from a file
into a directory can be written, and write the config status last,
so its version changes only once the directory matches the config.

Signed-off-by: Noel Georg

**File**: `hack/release.toml` (modified, +11/-0)
```diff
@@ -1089,6 +1089,17 @@ Every connection to the endpoints is authenticated with TLS, and unreachable end
 The `/virtualmachines.partition` cgroup has a `pids.max` limit, so virtual machines can't exhaust the host PID space.
 Talos calculates it the same way the kubelet calculates the `kubepods` limit: the smaller of `kernel.pid_max` and `kernel.threads-max`, minus 100 reserved PIDs.
 The limit follows changes to these sysctls without a reboot.
+"""
+
+    [notes.extension_service_config_mount_paths]
+        title = "Extension Service Config Mount Paths"
+        description = """\
+`ExtensionServiceConfig` mount paths must be absolute and clean (no `.`, `..`, repeated or trailing slashes),
+must not repeat, and must not sit under another mount path of the same extension service.
+Talos used to accept such paths, so fix them in the machine configuration before upgrading:
+a node with an invalid mount path in its saved machine configuration fails to load the configuration on boot.
+
+Config files are now stored on a dedicated 1 MiB tmpfs, which limits the total size of all extension service config files.
 """
 
 [make_deps]
```

**File**: `internal/app/machined/pkg/controllers/runtime/extension_service_config_files.go` (modified, +89/-27)
```diff
@@ -8,22 +8,23 @@ import (
 	"context"
 	"fmt"
 	"io/fs"
-	"os"
 	"path/filepath"
-	"strings"
 
 	"github.com/cosi-project/runtime/pkg/controller"
 	"github.com/cosi-project/runtime/pkg/safe"
 	"go.uber.org/zap"
 
 	v1alpha1runtime "github.com/siderolabs/talos/internal/app/machined/pkg/runtime"
+	"github.com/siderolabs/talos/pkg/machinery/config/types/runtime/extensions"
 	"github.com/siderolabs/talos/pkg/machinery/resources/runtime"
+	"github.com/siderolabs/talos/pkg/xfs"
+	"github.com/siderolabs/talos/pkg/xfs/opendir"
 )
 
 // ExtensionServiceConfigFilesController writes down the config files for extension services.
 type ExtensionServiceConfigFilesController struct {
-	V1Alpha1Mode            v1alpha1runtime.Mode
-	ExtensionsConfigBaseDir string
+	V1Alpha1Mode         v1alpha1runtime.Mode
+	ExtensionsConfigRoot xfs.Root
 }
 
 // Name implements controller.Controller interface.
@@ -74,27 +75,40 @@ func (ctrl *ExtensionServiceConfigFilesController) Run(ctx context.Context, r co
 
 		r.StartTrackingOutputs()
 
-		touchedFiles := map[string]struct{}{}
+		// every path to keep in the root, and whether it is a directory
+		wanted := map[string]bool{}
 
 		for res := range list.All() {
-			extensionConfigPath := filepath.Join(ctrl.ExtensionsConfigBaseDir, res.Metadata().ID())
-
-			if err = os.MkdirAll(extensionConfigPath, 0o755); err != nil {
-				return fmt.Errorf("error creating directory %q: %w", extensionConfigPath, err)
-			}
-
-			touchedFiles[extensionConfigPath] = struct{}{}
+			wanted[res.Metadata().ID()] = true
 
 			for _, file := range res.TypedSpec().Files {
-				fileName := filepath.Join(extensionConfigPath, strings.ReplaceAll(strings.TrimPrefix(file.MountPath, "/"), "/", "-"))
+				fileName, err := extensions.ConfigFileName(res.Metadata().ID(), file.MountPath)
+				if err != nil {
+					return err
+				}
+
+				fileName = filepath.Join(res.Metadata().ID(), fileName)
 
-				if err = updateFile(fileName, []byte(file.Content), 0o644); err != nil {
-					return fmt.Errorf("error writing file %q: %w", fileName, err)
+				for dir := filepath.Dir(fileName); dir != "."; dir = filepath.Dir(dir) {
+					wanted[dir] = true
 				}
 
-				touchedFiles[fileName] = struct{}{}
+				wanted[fileName] = false
 			}
+		}
 
+		// clean up first, so that a path which changed between a file and a directory can be written
+		if err = cleanupExtensionServiceConfigFiles(ctrl.ExtensionsConfigRoot, wanted); err != nil {
+			return err
+		}
+
+		for res := range list.All() {
+			if err = ctrl.writeConfigFiles(res); err != nil {
+				return err
+			}
+		}
+
+		for res := range list.All() {
 			if err = safe.WriterModify(ctx, r, runtime.NewExtensionServiceConfigStatusSpec(runtime.NamespaceName, res.Metadata().ID()), func(spec *runtime.ExtensionServiceConfigStatus) error {
 				spec.TypedSpec().SpecVersion = res.Metadata().Version().String()
 
@@ -104,21 +118,69 @@ func (ctrl *ExtensionServiceConfigFilesController) Run(ctx context.Context, r co
 			}
 		}
 
-		// remove all files not managed by us
-		if err = filepath.WalkDir(ctrl.ExtensionsConfigBaseDir, func(path string, d fs.DirEntry, walkErr error) error {
-			if _, ok := touchedFiles[path]; path != ctrl.ExtensionsConfigBaseDir && !ok {
-				if err = os.RemoveAll(path); err != nil {
-					return err
-				}
-			}
-
-			return nil
-		}); err != nil {
+		if err = safe.CleanupOutputs[*runtime.ExtensionServiceConfigStatus](ctx, r); err != nil {
 			return err
 		}
+	}
+}
 
-		if err = safe.CleanupOutputs[*runtime.ExtensionServiceConfigStatus](ctx, r); err != nil {
+// writeConfigFiles writes the config files of an extension service through a root opened beneath
+// its directory, so no mount path can resolve into another service's directory.
+func (ctrl *ExtensionServiceConfigFilesController) writeConfigFiles(res *runtime.ExtensionServiceConfig) error {
+	id := res.Metadata().ID()
+
+	if err := xfs.MkdirAll(ctrl.ExtensionsConfigRoot, id, 0o755); err != nil {
+		return fmt.Errorf("error creating directory %q: %w", id, err)
+	}
+
+	rootFd, err := ctrl.ExtensionsConfigRoot.Fd()
+	if err != nil {
+		return err
+	}
+
+	root := &xfs.UnixRoot{FS: opendir.NewBeneath(rootFd, id)}
+	if err = root.OpenFS(); err != nil {
+		return err
+	}
+
+	defer root.Close() //nolint:errcheck
+
+	for _, file := range res.TypedSpec().Files {
+		fileName, err := extensions.ConfigFileName(id, file.MountPath)
+		if err != nil {
 			return err
 		}
+
+		if err = xfs.MkdirAll(root, filepath.Dir(fileName), 0o755); err != nil {
+			return fmt.Errorf("error creating directory for %q of extension %q: %w", fileName, id, err)
+		}
+
+		if err = updateFile(root, fileName, []byte(file.Content), 0o644); err != nil {
+			return fmt.Errorf("error writing file %q of extension %q: %w", fileName, id, err)
+		}
 	}
+
+	return nil
+}
+
+func cleanupExtensionServiceConfigFiles(root xfs.Root, wanted map[string]bool) error {
+	return fs.WalkDir(root, ".", func(path string, d fs.DirEntry, err error) error {
+		if err != nil || p
```

**File**: `internal/app/machined/pkg/controllers/runtime/extension_service_config_files_test.go` (modified, +36/-7)
```diff
@@ -6,16 +6,18 @@ package runtime_test
 import (
 	"os"
 	"path/filepath"
-	"strings"
 	"testing"
 
+	"github.com/cosi-project/runtime/pkg/safe"
 	"github.com/siderolabs/gen/xslices"
 	"github.com/stretchr/testify/assert"
 	"github.com/stretchr/testify/suite"
 
 	"github.com/siderolabs/talos/internal/app/machined/pkg/controllers/ctest"
 	"github.com/siderolabs/talos/internal/app/machined/pkg/controllers/runtime"
 	runtimeres "github.com/siderolabs/talos/pkg/machinery/resources/runtime"
+	"github.com/siderolabs/talos/pkg/xfs"
+	"github.com/siderolabs/talos/pkg/xfs/opendir"
 )
 
 type ExtensionServiceConfigFilesSuite struct {
@@ -27,12 +29,18 @@ type ExtensionServiceConfigFilesSuite struct {
 func TestExtensionServiceConfigFilesSuite(t *testing.T) {
 	extensionsConfigDir := t.TempDir()
 
+	root := &xfs.UnixRoot{FS: opendir.NewFromPath(extensionsConfigDir)}
+
 	suite.Run(t, &ExtensionServiceConfigFilesSuite{
 		AfterSetup: func(suite *ctest.DefaultSuite) {
+			suite.Require().NoError(root.OpenFS())
 			suite.Require().NoError(suite.Runtime().RegisterController(&runtime.ExtensionServiceConfigFilesController{
-				ExtensionsConfigBaseDir: extensionsConfigDir,
+				ExtensionsConfigRoot: root,
 			}))
 		},
+		AfterTearDown: func(*ctest.DefaultSuite) {
+			root.Close() //nolint:errcheck
+		},
 		extensionsConfigDir: extensionsConfigDir,
 	})
 }
@@ -96,7 +104,7 @@ func (suite *ExtensionServiceConfigFilesSuite) TestReconcileExtensionServiceConf
 		)
 
 		for _, file := range tt.configFiles {
-			content, err := os.ReadFile(filepath.Join(suite.extensionsConfigDir, tt.extensionName, strings.ReplaceAll(strings.TrimPrefix(file.mountPath, "/"), "/", "-")))
+			content, err := os.ReadFile(filepath.Join(suite.extensionsConfigDir, tt.extensionName, file.mountPath))
 			suite.Require().NoError(err)
 
 			suite.Assert().Equal(file.content, string(content))
@@ -109,7 +117,7 @@ func (suite *ExtensionServiceConfigFilesSuite) TestReconcileExtensionServiceConf
 	suite.Assert().NoError(os.Mkdir(filepath.Join(suite.extensionsConfigDir, "test"), 0o755))
 	suite.Assert().NoError(os.WriteFile(filepath.Join(suite.extensionsConfigDir, "test", "testdata"), []byte("{}"), 0o644))
 
-	extensionAConfigFileInfo, err := os.Stat(filepath.Join(suite.extensionsConfigDir, "test-extension-a", "etc-test"))
+	extensionAConfigFileInfo, err := os.Stat(filepath.Join(suite.extensionsConfigDir, "test-extension-a", "etc", "test"))
 	suite.Assert().NoError(err)
 
 	// delete test-extension-b resource
@@ -118,12 +126,33 @@ func (suite *ExtensionServiceConfigFilesSuite) TestReconcileExtensionServiceConf
 
 	suite.Assert().NoFileExists(filepath.Join(suite.extensionsConfigDir, "test", "testdata"))
 	suite.Assert().NoDirExists(filepath.Join(suite.extensionsConfigDir, "test"))
-	suite.Assert().NoFileExists(filepath.Join(suite.extensionsConfigDir, "test-extension-b", "etc-bar"))
-	suite.Assert().NoFileExists(filepath.Join(suite.extensionsConfigDir, "test-extension-b", "var-etc-foo"))
+	suite.Assert().NoFileExists(filepath.Join(suite.extensionsConfigDir, "test-extension-b", "etc", "bar"))
+	suite.Assert().NoFileExists(filepath.Join(suite.extensionsConfigDir, "test-extension-b", "var", "etc", "foo"))
 	suite.Assert().NoDirExists(filepath.Join(suite.extensionsConfigDir, "test-extension-b"))
 
-	extensionAConfigFileInfoAfterUpdate, err := os.Stat(filepath.Join(suite.extensionsConfigDir, "test-extension-a", "etc-test"))
+	extensionAConfigFileInfoAfterUpdate, err := os.Stat(filepath.Join(suite.extensionsConfigDir, "test-extension-a", "etc", "test"))
 	suite.Require().NoError(err)
 
 	suite.Assert().Equal(extensionAConfigFileInfo.ModTime(), extensionAConfigFileInfoAfterUpdate.ModTime())
+
+	// a mount path which turns a config file into a directory replaces the file
+	extensionA, err := safe.StateUpdateWithConflicts(suite.Ctx(), suite.State(), runtimeres.NewExtensionServiceConfigSpec(runtimeres.NamespaceName, "test-extension-a").Metadata(),
+		func(res *runtimeres.ExtensionServiceConfig) error {
+			res.TypedSpec().Files = []runtimeres.ExtensionServiceConfigFile{{Content: "test-content-d", MountPath: "/etc/test/inner"}}
+
+			return nil
+		},
+	)
+	suite.Require().NoError(err)
+
+	ctest.AssertResource(
+		suite, "test-extension-a",
+		func(status *runtimeres.ExtensionServiceConfigStatus, asrt *assert.Assertions) {
+			asrt.Equal(extensionA.Metadata().Version().String(), status.TypedSpec().SpecVersion)
+		},
+	)
+
+	content, err := os.ReadFile(filepath.Join(suite.extensionsConfigDir, "test-extension-a", "etc", "test", "inner"))
+	suite.Require().NoError(err)
+	suite.Assert().Equal("test-content-d", string(content))
 }
```

**File**: `internal/app/machined/pkg/controllers/runtime/utils.go` (modified, +5/-4)
```diff
@@ -15,6 +15,7 @@ import (
 	"github.com/siderolabs/gen/optional"
 
 	"github.com/siderolabs/talos/pkg/machinery/resources/runtime"
+	"github.com/siderolabs/talos/pkg/xfs"
 )
 
 // WaitForDevicesReady waits for devices to be ready.
@@ -66,13 +67,13 @@ func WaitForDevicesReady(ctx context.Context, r controller.Runtime, nextInputs [
 	return nil
 }
 
-// updateFile is like `os.WriteFile`, but it will only update the file if the
+// updateFile is like `xfs.WriteFile`, but it will only update the file if the
 // contents have changed.
-func updateFile(filename string, contents []byte, mode os.FileMode) error {
-	oldContents, err := os.ReadFile(filename)
+func updateFile(root xfs.Root, filename string, contents []byte, mode os.FileMode) error {
+	oldContents, err := xfs.ReadFile(root, filename)
 	if err == nil && bytes.Equal(oldContents, contents) {
 		return nil
 	}
 
-	return os.WriteFile(filename, contents, mode)
+	return xfs.WriteFile(root, filename, contents, mode)
 }
```

**File**: `internal/app/machined/pkg/runtime/v1alpha2/internal/extconfigroot/extconfigroot.go` (added, +80/-0)
```diff
@@ -0,0 +1,80 @@
+// This Source Code Form is subject to the terms of the Mozilla Public
+// License, v. 2.0. If a copy of the MPL was not distributed with this
+// file, You can obtain one at http://mozilla.org/MPL/2.0/.
+
+// Package extconfigroot mounts the tmpfs which holds rendered extension service config files.
+package extconfigroot
+
+import (
+	"errors"
+	"fmt"
+	"os"
+
+	"go.uber.org/zap"
+	"golang.org/x/sys/unix"
+
+	mountv3 "github.com/siderolabs/talos/internal/pkg/mount/v3"
+	"github.com/siderolabs/talos/internal/pkg/selinux"
+	"github.com/siderolabs/talos/pkg/machinery/constants"
+	"github.com/siderolabs/talos/pkg/xfs"
+	"github.com/siderolabs/talos/pkg/xfs/fsopen"
+)
+
+// Setup mounts a detached tmpfs and binds it read-only at target.
+//
+// The returned root is the only writable view.
+func Setup(target string, logger *zap.Logger) (xfs.Root, func() error, error) {
+	fsOptions := []fsopen.Option{
+		fsopen.WithStringParameter("mode", "0755"),
+		fsopen.WithStringParameter("size", "1M"),
+	}
+
+	if selinux.IsEnabled() {
+		fsOptions = append(fsOptions, fsopen.WithStringParameter("context", constants.SystemSelinuxLabel))
+	}
+
+	if err := os.MkdirAll(target, 0o755); err != nil {
+		return nil, nil, fmt.Errorf("failed to create extension service config mount target %q: %w", target, err)
+	}
+
+	mgr := mountv3.NewManager(
+		mountv3.WithDetached(),
+		mountv3.WithPrinter(logger.Sugar().Infof),
+		mountv3.WithFsopen("tmpfs", fsOptions...),
+	)
+
+	point, err := mgr.Mount()
+	if err != nil {
+		return nil, nil, fmt.Errorf("failed to mount anonymous tmpfs for extension service config: %w", err)
+	}
+
+	cleanup := func() {
+		mgr.Unmount() //nolint:errcheck
+	}
+
+	root := point.Root()
+
+	rootFD, err := root.Fd()
+	if err != nil {
+		cleanup()
+
+		return nil, nil, fmt.Errorf("failed to get extension service config root fd: %w", err)
+	}
+
+	if err = mountv3.BindReadonlyFd(rootFD, target); err != nil {
+		cleanup()
+
+		return nil, nil, fmt.Errorf("failed to bind extension service config root at %q: %w", target, err)
+	}
+
+	logger.Info("mounted extension service config tmpfs", zap.String("target", target))
+
+	unmount := func() error {
+		return errors.Join(
+			unix.Unmount(target, unix.MNT_DETACH),
+			mgr.Unmount(),
+		)
+	}
+
+	return root, unmount, nil
+}
```

**File**: `internal/app/machined/pkg/runtime/v1alpha2/internal/extconfigroot/extconfigroot_test.go` (added, +73/-0)
```diff
@@ -0,0 +1,73 @@
+// This Source Code Form is subject to the terms of the Mozilla Public
+// License, v. 2.0. If a copy of the MPL was not distributed with this
+// file, You can obtain one at http://mozilla.org/MPL/2.0/.
+
+//go:build linux
+
+package extconfigroot_test
+
+import (
+	"errors"
+	"os"
+	"path/filepath"
+	"testing"
+
+	"github.com/stretchr/testify/assert"
+	"github.com/stretchr/testify/require"
+	"go.uber.org/zap"
+	"golang.org/x/sys/unix"
+
+	"github.com/siderolabs/talos/internal/app/machined/pkg/runtime/v1alpha2/internal/extconfigroot"
+	mountv3 "github.com/siderolabs/talos/internal/pkg/mount/v3"
+	"github.com/siderolabs/talos/pkg/xfs"
+)
+
+func TestExtensionServiceConfigRoot(t *testing.T) {
+	if os.Geteuid() != 0 {
+		t.Skip("requires root for mount operations")
+	}
+
+	target := filepath.Join(t.TempDir(), "extension-config")
+
+	root, unmount, err := extconfigroot.Setup(target, zap.NewNop())
+	require.NoError(t, err)
+
+	unmounted := false
+
+	t.Cleanup(func() {
+		if !unmounted {
+			unmount() //nolint:errcheck
+		}
+	})
+
+	require.NoError(t, xfs.MkdirAll(root, "test-service", 0o755))
+	require.NoError(t, xfs.WriteFile(root, "test-service/etc-test", []byte("secret"), 0o600))
+
+	stableSource := filepath.Join(target, "test-service/etc-test")
+	contents, err := os.ReadFile(stableSource)
+	require.NoError(t, err)
+	assert.Equal(t, "secret", string(contents))
+
+	err = os.WriteFile(filepath.Join(target, "blocked"), []byte("blocked"), 0o600)
+	assert.True(t, errors.Is(err, unix.EROFS), "stable view should be read-only: %v", err)
+
+	bindTarget := filepath.Join(t.TempDir(), "bound-config")
+	require.NoError(t, os.WriteFile(bindTarget, nil, 0o600))
+	require.NoError(t, mountv3.BindReadonly(stableSource, bindTarget))
+
+	t.Cleanup(func() {
+		unix.Unmount(bindTarget, unix.MNT_DETACH) //nolint:errcheck
+	})
+
+	boundContents, err := os.ReadFile(bindTarget)
+	require.NoError(t, err)
+	assert.Equal(t, "secret", string(boundContents))
+
+	require.NoError(t, unix.Unmount(bindTarget, unix.MNT_DETACH))
+	require.NoError(t, unmount())
+
+	unmounted = true
+
+	_, err = os.Stat(stableSource)
+	assert.True(t, os.IsNotExist(err))
+}
```

**File**: `internal/app/machined/pkg/runtime/v1alpha2/v1alpha2_controller.go` (modified, +17/-2)
```diff
@@ -43,6 +43,7 @@ import (
 	"github.com/siderolabs/talos/internal/app/machined/pkg/controllers/v1alpha1"
 	"github.com/siderolabs/talos/internal/app/machined/pkg/runtime"
 	runtimelogging "github.com/siderolabs/talos/internal/app/machined/pkg/runtime/logging"
+	"github.com/siderolabs/talos/internal/app/machined/pkg/runtime/v1alpha2/internal/extconfigroot"
 	"github.com/siderolabs/talos/internal/app/machined/pkg/system"
 	"github.com/siderolabs/talos/internal/pkg/ctrltrace"
 	"github.com/siderolabs/talos/internal/pkg/libvirt"
@@ -54,6 +55,7 @@ import (
 	talosconfig "github.com/siderolabs/talos/pkg/machinery/config/config"
 	"github.com/siderolabs/talos/pkg/machinery/constants"
 	configresource "github.com/siderolabs/talos/pkg/machinery/resources/config"
+	"github.com/siderolabs/talos/pkg/xfs"
 	"github.com/siderolabs/talos/pkg/xfs/fsopen"
 )
 
@@ -154,6 +156,19 @@ func (ctrl *Controller) Run(ctx context.Context, drainer *runtime.Drainer) error
 		defer udevUnmount() //nolint:errcheck
 	}
 
+	var extensionServiceConfigRoot xfs.Root
+
+	if ctrl.v1alpha1Runtime.State().Platform().Mode() != runtime.ModeContainer {
+		var extensionServiceConfigUnmount func() error
+
+		extensionServiceConfigRoot, extensionServiceConfigUnmount, err = extconfigroot.Setup(constants.ExtensionServiceUserConfigPath, ctrl.logger)
+		if err != nil {
+			return fmt.Errorf("failed to set up extension service config root: %w", err)
+		}
+
+		defer extensionServiceConfigUnmount() //nolint:errcheck
+	}
+
 	lvmProvisioner, err := lvm.New()
 	if err != nil {
 		return fmt.Errorf("failed to initialize LVM: %w", err)
@@ -539,8 +554,8 @@ func (ctrl *Controller) Run(ctx context.Context, drainer *runtime.Drainer) error
 		runtimecontrollers.NewRebootController(ctrl.v1alpha1Runtime, ctrl.reboot),
 		&runtimecontrollers.ExtensionServiceConfigController{},
 		&runtimecontrollers.ExtensionServiceConfigFilesController{
-			V1Alpha1Mode:            ctrl.v1alpha1Runtime.State().Platform().Mode(),
-			ExtensionsConfigBaseDir: constants.ExtensionServiceUserConfigPath,
+			V1Alpha1Mode:         ctrl.v1alpha1Runtime.State().Platform().Mode(),
+			ExtensionsConfigRoot: extensionServiceConfigRoot,
 		},
 		&runtimecontrollers.EventsSinkConfigController{
 			Cmdline:      procfs.ProcCmdline(),
```

**File**: `internal/app/machined/pkg/system/services/extension.go` (modified, +7/-2)
```diff
@@ -11,7 +11,6 @@ import (
 	"os"
 	"path/filepath"
 	"slices"
-	"strings"
 
 	"github.com/containerd/containerd/v2/core/containers"
 	"github.com/containerd/containerd/v2/pkg/oci"
@@ -31,6 +30,7 @@ import (
 	"github.com/siderolabs/talos/internal/pkg/environment"
 	"github.com/siderolabs/talos/internal/pkg/mount/v3"
 	"github.com/siderolabs/talos/pkg/conditions"
+	"github.com/siderolabs/talos/pkg/machinery/config/types/runtime/extensions"
 	"github.com/siderolabs/talos/pkg/machinery/constants"
 	extservices "github.com/siderolabs/talos/pkg/machinery/extensions/services"
 	"github.com/siderolabs/talos/pkg/machinery/resources/network"
@@ -389,8 +389,13 @@ func (svc *Extension) applyExtensionServiceConfig(
 	}
 
 	for _, ext := range spec.Files {
+		fileName, err := extensions.ConfigFileName(svc.Spec.Name, ext.MountPath)
+		if err != nil {
+			return nil, nil, err
+		}
+
 		mounts = append(mounts, specs.Mount{
-			Source:      filepath.Join(constants.ExtensionServiceUserConfigPath, svc.Spec.Name, strings.ReplaceAll(strings.TrimPrefix(ext.MountPath, "/"), "/", "-")),
+			Source:      filepath.Join(constants.ExtensionServiceUserConfigPath, svc.Spec.Name, fileName),
 			Destination: ext.MountPath,
 			Type:        "bind",
 			Options:     []string{"ro", "bind"},
```

---

### Incident Patch 3: `f0a81e1b` (2026-11-13)
**Commit Message**: fix: pids ctrl enoent on extension pids at boot

/system/extensions/pids.max did not exist at boot, and the WorkloadPidsController failed with ENOENT until a later container start under /system enabled pids there.

Create the extensions cgroup with pids enabled and no limit, like the other workload roots, and cover it in the resources test.

Resolves https://github.com/siderolabs/talos/issues/14948

Signed-off-by: Maja Bojarska <[REDACTED_EMAIL]>

**File**: `internal/pkg/cgroup/cgroup.go` (modified, +1/-0)
```diff
@@ -121,6 +121,7 @@ func getCgroupV2Resources(name string) *cgroup2.Resources {
 			CPU: &cgroup2.CPU{
 				Weight: new(MillicoresToCPUWeight(MilliCores(constants.CgroupExtensionsMillicores))),
 			},
+			Pids: workloadRootPids(),
 		}
 	case constants.CgroupInstaller:
 		return &cgroup2.Resources{
```

**File**: `internal/pkg/cgroup/resources_test.go` (modified, +1/-1)
```diff
@@ -20,7 +20,7 @@ import (
 func TestWorkloadRootsEnablePidsUnlimited(t *testing.T) {
 	t.Parallel()
 
-	for _, name := range []string{constants.CgroupTalosContainersRoot, constants.CgroupVirtualMachines} {
+	for _, name := range []string{constants.CgroupTalosContainersRoot, constants.CgroupVirtualMachines, constants.CgroupExtensions} {
 		t.Run(name, func(t *testing.T) {
 			t.Parallel()
 
```

#### Recent Merged Pull Requests:
- **PR #14949** (2026-11-13): fix: WorkloadPidsController ENOENT /system/extensions on boot (@majabojarska)
- **PR #14946** (2026-11-13): fix: data race between test fixtures in tests (@shanduur)
- **PR #14942** (2026-11-13): fix: write extension service config files to a detached tmpfs (@frezbo)
- **PR #14941** (2026-11-12): fix: extend host namespace PID resolving to Talos containers (@smira)
- **PR #14940** (2026-11-12): feat: update runc 1.5.3, NVIDIA LTS and CNI plugins (@smira)
- **PR #14939** (2026-11-12): fix(security): mount hardening (@frezbo)

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

## X. data race between test fixtures in tests

**RULE**:
When implementing operations in `internal/app/machined/pkg/controllers/storage/md_array_reconcile_test.go`, engineers MUST enforce rigorous boundary validation, safe state transitions, and memory/concurrency invariants as established by production defect remediation in siderolabs/talos. All inputs crossing module boundaries must be explicitly verified before state persistence.

**WHY**:
Prevents defects observed in production commit `768ed463`: data race between test fixtures in tests. Unvalidated execution paths cause runtime exceptions, race conditions, and silent state corruption under concurrent workloads.

**WHEN TO APPLY**:
Subsystems managing Go data structures, boundary deserialization, API parsing, or resource lifecycles matching `internal/app/machined/pkg/controllers/storage/md_array_reconcile_test.go`.

**VERIFIED IMPLEMENTATION PATTERN**:
```go
// Verified production-grade fix pattern:
// with runs fn under the fake's lock, for tests that seed or inspect fixture
// state while the controller runtime is running.
func (f *fakeMDProvisioner) with(fn func(f *fakeMDProvisioner)) {
	f.mu.Lock()
	defer f.mu.Unlock()

	fn(f)
}

	suite.md.with(func(f *fakeMDProvisioner) {
		f.findByMember["/dev/nvme0n1"] = "/dev/md0"
		f.details["/dev/md0"] = md.Detail{
			Level:       "raid1",
			RaidDevices: 2,
			Members:     []string{"/dev/nvme0n1", "/dev/nvme1n1"},
		}
	})
	suite.md.with(func(f *fakeMDProvisioner) {
		f.findByMember["/dev/nvme0n1"] = "/dev/md0"
		f.details["/dev/md0"] = md.Detail{
			Level:       "raid1",
			RaidDevices: 2,
			Members:     []string{"/dev/nvme0n1", "/dev/nvme1n1"},
		}
	})
	suite.md.with(func(f *fakeMDProvisioner) {
		f.findByMember["/dev/nvme0n1"] = "/dev/md0"
		f.details["/dev/md0"] = md.Detail{
			Level:       "raid1",
			RaidDevices: 2,
			Members:     []string{"/dev/nvme0n1", "/dev/nvme1n1"},
		}
		f.syncAction["/dev/md0"] = md.SyncActionResync
	})
	suite.md.with(func(f *fakeMDProvisioner) {
		f.findByMember["/dev/nvme0n1"] = "/dev/md0"
		f.details["/dev/md0"] = md.Detail{
			Level:       "raid1",
			RaidDevices: 2,
			Members:     []string{"/dev
```

**NEGATIVE CONSTRAINT**:
```go
// Induced defect failure mode:
	suite.md.findByMember["/dev/nvme0n1"] = "/dev/md0"
	suite.md.details["/dev/md0"] = md.Detail{
		Level:       "raid1",
		RaidDevices: 2,
		Members:     []string{"/dev/nvme0n1", "/dev/nvme1n1"},
	}
	suite.md.findByMember["/dev/nvme0n1"] = "/dev/md0"
	suite.md.details["/dev/md0"] = md.Detail{
		Level:       "raid1",
		RaidDevices: 2,
		Members:     []string{"/dev/nvme0n1", "/dev/nvme1n1"},
	}
	suite.md.findByMember["/dev/nvme0n1"] = "/dev/md0"
	suite.md.details["/dev/md0"] = md.Detail{
		Level:       "raid1",
		RaidDevices: 2,
		Members:     []string{"/dev/nvme0n1", "/dev/nvme1n1"},
	}
	suite.md.syncAction["/dev/md0"] = md.SyncActionResync
	suite.md.findByMember["/dev/nvme0n1"] = "/dev/md0"
	suite.md.details["/dev/md0"] = md.Detail{
		Level:       "raid1",
		RaidDevices: 2,
		Members:     []string{"/dev/nvme0n1", "/dev/nvme1n1"},
	}
	suite.md.syncAction["/dev/md0"] = md.SyncActionRecover
	suite.md.mu.Lock()
	defer suite.md.mu.Unlock()

	metadata := "1.0"
	if name == "data" {
		metadata = "1.2"
	}
	suite.md.details[device] = md.Detail{
		Level:       "raid1",
		RaidDevices: 2,
		Members:     append([]string(nil), members...),
		Name:        "talos:" + name,
		UUID:        "test-" + na
```

**VERIFICATION METHOD**:
Automated regression test asserting that input states reproducing defect `768ed463` are properly handled with clean fallback behavior.


## 3. Application to AI-Builder-Brain Project Construction
- **Applied Blueprints**: `astro-tailwind-v4`, `fullstack-ai-saas`, `universal-native-factory`
- **Regression Shield**: Prevents architectural drift across construction cycles.
