# Forensic Learning Record (Deep Inspection): siderolabs/talos

> **Canonical Artifact**: `07_PROJECT_LEARNING/siderolabs-talos-learnings.md`  
> **Source Platform**: GitHub ([https://github.com/siderolabs/talos](https://github.com/siderolabs/talos))  
> **Harvest Method**: Full-Spectrum Deep Extraction (Patches, Diffs, Source Code, Post-Mortems)  
> **Harvest Timestamp**: 2026-10-05T18:52:01.093Z  
> **Compliance State**: Free Tier Guaranteed | Strict Rate-Limit Backoff Honored  

---

## 1. Context & Architectural Overview
- **Repository / Resource**: `siderolabs/talos`
- **Description**: Talos Linux is a modern Linux distribution built for Kubernetes.
- **Primary Language / Ecosystem**: Go
- **Discovered Manifests / Configurations**: go.mod, README.md, Dockerfile
- **Stars / Engagement**: 11305 stars

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
	"github.com/siderolabs/talos/internal/app/lifecycle/internal/containerpid"
	"github.com/siderolabs/talos/internal/app/lifecycle/internal/output"
	"github.com/siderolabs/talos/internal/app/machined/pkg/system/pid"
	containerdrunner "github.com/siderolabs/talos/internal/app/machined/pkg/system/runner/containerd"
	"github.com/siderolabs/talos/internal/pkg/capability"
	"github.com/siderolabs/talos/internal/pkg/cgroup"
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

	localPID, err := containerpid.NewResolver().Resolve(cgroupPath, task.Pid())

	switch {
	case errors.Is(err, containerpid.ErrGone):
		// nothing left to record; the task exit status handled below carries the real failure
		log.Printf("not recording installer PID: %v", err)
	case err != nil:
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

	if exitCode != 0 {
		log.Printf("installer container exited with code %d", exitCode)
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
		if c := procfs.ProcCmdline().Get(preservedArg).First(); c != nil {
			args = append(args, "--extra-kernel-arg", fmt.Sprintf("%s=%s", preservedArg, *c))
		}
	}

	return args
}

// buildSpecOpts constructs the OCI spec options for the installer container.
func buildSpecOpts(img client.Image, args []string, mounts []specs.Mount, env []string, cgroupPath string) []oci.SpecOpts {
	specOpts := []oci
```

### Core Architecture Module: `internal/app/lifecycle/internal/containerpid/containerpid.go`
```
// This Source Code Form is subject to the terms of the Mozilla Public
// License, v. 2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/.

// Package containerpid translates container PIDs reported by containerd into the PID
// namespace of the calling process.
package containerpid

import (
	"errors"
	"fmt"
	"io/fs"
	"os"
	"path/filepath"
	"strconv"
	"strings"
	"syscall"

	"github.com/siderolabs/talos/pkg/machinery/constants"
)

// ErrGone is returned by [Resolver.Resolve] when no process in the container cgroup matches
// the PID containerd reported: the container init exited between the task start and the
// lookup, and only its children (if any) are left behind.
var ErrGone = errors.New("container process is gone")

// Resolver resolves container init PIDs by reading cgroupfs and procfs.
type Resolver struct {
	cgroupMountPath string
	procPath        string
}

// NewResolver initializes a resolver reading the default /sys/fs/cgroup and /proc mount points.
func NewResolver() *Resolver {
	return NewResolverWithPaths(constants.CgroupMountPath, "/proc")
}

// NewResolverWithPaths initializes a resolver reading non-default mount points.
func NewResolverWithPaths(cgroupMountPath, procPath string) *Resolver {
	return &Resolver{
		cgroupMountPath: cgroupMountPath,
		procPath:        procPath,
	}
}

// Resolve translates the container init PID reported by containerd into the PID namespace
// this process runs in.
//
// containerd resolves task PIDs in its own PID namespace. When the CRI containerd runs
// under sandboxd it lives in the sandbox PID namespace, and so do the shim and the
// container it creates — oci.WithHostNamespace(PIDNamespace) only inherits the runtime's
// namespace, which is the sandbox one, not the root one. A PID namespace can only be
// entered downwards, so the container cannot be placed back into the root namespace; the
// translation has to happen here instead.
//
// cgroupfs renders PIDs in the PID namespace of the process reading it, so the cgroup of
// the container (cgroupPath, relative to the cgroupfs mount point) lists PIDs directly
// usable by the caller. The sandbox namespace is created with CLONE_NEWPID|CLONE_NEWNS only
// (see sandboxd's beforeSandboxdExec), so no cgroup namespace is involved and the cgroup
// path means the same thing on both sides.
//
// nsPID identifies the container init among the cgroup members: as the container shares the
// runtime's PID namespace, the innermost NSpid of the process is exactly the PID containerd
// reported. Without a sandbox the two namespaces coincide and this resolves to nsPID itself.
//
// If the container init is not (or no longer) in the cgroup, the error is [ErrGone].
func (r *Resolver) Resolve(cgroupPath string, nsPID uint32) (int32, error) {
	procsPath := filepath.Join(r.cgroupMountPath, cgroupPath, "cgroup.procs")

	contents, err := os.ReadFile(procsPath)
	if err != nil {
		return 0, fmt.Errorf("failed to read %s: %w", procsPath, err)
	}

	for field := range strings.FieldsSeq(string(contents)) {
		candidate, err := strconv.ParseInt(field, 10, 32)
		if err != nil {
			return 0, fmt.Errorf("failed to parse PID %q from %s: %w", field, procsPath, err)
		}

		innermost, err := r.readInnermostPID(int32(candidate))

		switch {
		case errors.Is(err, fs.ErrNotExist):
			// the process exited between reading the cgroup and reading its status
			continue
		case err != nil:
			return 0, err
		}

		if innermost == int32(nsPID) {
			return int32(candidate), nil
		}
	}

	return 0, fmt.Errorf("%w: no process with PID %d (as seen by containerd) found in %s", ErrGone, nsPID, procsPath)
}

// readInnermostPID returns the PID the process sees for itself, i.e. its PID in the
// innermost PID namespace it belongs to.
//
// The pid argument is resolved in the caller's PID namespace, as usual for /proc.
// The NSpid field of /proc/<pid>/status lists the process PID at every namespace level,
// starting at the level of the reading process and descending to the namespace the process
// itself lives in, so its last entry is the PID the process sees for itself. For a process
// in the caller's own namespace there is a single entry and the result equals pid.
//
// If the process is gone, the returned error wraps [io/fs.ErrNotExist], so callers racing
// against process exit can tell that apart from a malformed status file.
func (r *Resolver) readInnermostPID(pid int32) (int32, error) {
	statusPath := filepath.Join(r.procPath, strconv.Itoa(int(pid)), "status")

	// /proc/<pid>/status is small enough to read in one go.
	contents, err := os.ReadFile(statusPath)
	if err != nil {
		// a process which goes away mid-read reports ESRCH instead of ENOENT, normalize it
		// so that callers have a single signal for "the process is gone"
		if errors.Is(err, syscall.ESRCH) {
			err = fmt.Errorf("%w: %w", fs.ErrNotExist, err)
		}

		return 0, err
	}

	innermost, err := parseInnermostPID(contents)
	if err != nil {
		return 0, fmt.Errorf("failed to parse %s: %w", statusPath, err)
	}

	return innermost, nil
}

// parseInnermostPID extracts the last NSpid entry from the contents of /proc/<pid>/status.
func parseInnermostPID(contents []byte) (int32, error) {
	for line := range strings.Lines(string(contents)) {
		rest, ok := strings.CutPrefix(line, "NSpid:")
		if !ok {
			continue
		}

		fields := strings.Fields(rest)
		if len(fields) == 0 {
			return 0, errors.New("NSpid field is empty")
		}

		innermost, err := strconv.ParseInt(fields[len(fields)-1], 10, 32)
		if err != nil {
			return 0, fmt.Errorf("failed to parse NSpid entry %q: %w", fields[len(fields)-1], err)
		}

		return int32(innermost), nil
	}

	return 0, errors.New("no NSpid field found")
}

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

	lock    sync.Mutex
	runtime runtime.Runtime
	logger  *zap.Logger
}

// NewService creates a new instance of the lifecycle service.
func NewService(runtime runtime.Runtime, logger *zap.Logger) *Service {
	return &Service{
		lock:    sync.Mutex{},
		runtime: runtime,
		logger:  logger.With(zap.String("service", "lifecycle")),
	}
}

// Install handles the installation of the machine.
// It ensures that only one installation or upgrade can occur at a time by using a mutex lock.
//
//nolint:gocyclo
func (s *Service) Install(req *machine.LifecycleServiceInstallRequest, ss grpc.ServerStreamingServer[machine.LifecycleServiceInstallResponse]) error {
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

	s.logger.Info("starting installation", zap.String("installer_image", installerImage), zap.String("disk", targetDisk))

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
				if exitCode == 0 {
					s.logger.Info("installation completed", zap.Int32("exit_code", exitCode))
				} else {
					s.logger.Warn("installation failed", zap.Int32("exit_code", exitCode))
				}

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
func (s *Service) Upgrade(req *machine.LifecycleServiceUpgradeRequest, ss grpc.ServerStreamingServer[machine.LifecycleServiceUpgradeResponse]) error {
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

	s.logger.Info("starting upgrade", zap.String("installer_image", installerImage), zap.String("disk", devname))

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
				if exitCode == 0 {
					s.logger.Info("upgrade completed", zap.Int32("exit_code", exitCode))
				} else {
					s.logger.Warn("upgrade failed", zap.Int32("exit_code", exitCode))
				}

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
	"os"
	"path/filepath"

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

	"github.com/siderolabs/talos/internal/pkg/selinux"
	"github.com/siderolabs/talos/pkg/machinery/constants"
	"github.com/siderolabs/talos/pkg/machinery/resources/k8s"
)

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
		}{
			{
				name:         "kube-apiserver",
				directory:    constants.KubernetesAPIServerConfigDir,
				selinuxLabel: constants.KubernetesAPIServerConfigDirSELinuxLabel,
				uid:          constants.KubernetesAPIServerRunUser,
				gid:          constants.KubernetesAPIServerRunGroup,
				configs:      apiServerConfigFiles,
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

				if err = os.WriteFile(filepath.Join(pod.directory, configFile.filename), buf.Bytes(), 0o400); err != nil {
					return fmt.Errorf("error writing configuration %q for %q: %w", configFile.filename, pod.name, err)
				}

				if err = os.Chown(filepath.Join(pod.directory, configFile.filename), pod.uid, pod.gid); err != nil {
					return fmt.Errorf("error chowning %q for %q: %w", configFile.filename, pod.name, err)
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

func admissionControlConfig(spec *k8s.AdmissionControlConfigSpec) func() (runtime.Object, error) {
	return func() (runtime.Object, error) {
		var cfg apiserverv1.AdmissionConfiguration

		cfg.APIVersion = apiserverv1.SchemeGroupVersion.String()
		cfg.Kind = "AdmissionConfiguration"
		cfg.Plugins = []apiserverv1.AdmissionPluginConfiguration{}

		for _, plugin := range spec.Config {
			raw, err := json.Marshal(plugin.Configuration)
			if err != nil {
				return nil, fmt.Errorf("error marshaling configuration for plugin %q: %w", plugin.Name, err)
			}

			cfg.Plugins = append(
				cfg.Plugins,
				apiserverv1.AdmissionPluginConfiguration{
					Name: plugin.Name,
					Configuration: &runtime.Unknown{
						Raw: raw,
					},
				},
			)
		}

		return &cfg, nil
	}
}

func auditPolicyConfig(spec *k8s.AuditPolicyConfigSpec) func() (runtime.Object, error) {
	return func() (runtime.Object, error) {
		var cfg auditv1.Policy

		if err := runtime.DefaultUnstructuredConverter.FromUnstructuredWithValidation(spec.Config, &cfg, true); err != nil {
			return nil, fmt.Errorf("error unmarshaling audit policy configuration: %w", err)
		}

		return &cfg, nil
	}
}

func schedulerConfig(spec *k8s.SchedulerConfigSpec) func() (runtime.Object, error) {
	return func() (runtime.Object, error) {
		return &unstructured.Unstructured{Object: spec.Config}, nil
	}
}

func authorizationConfig(spec *k8s.AuthorizationConfigSpec, kubeAPIServerVersion compatibility.Version) func() (runtime.Object, error) {
	return func() (runtime.Object, error) {
		var cfg apiserverv1.AuthorizationConfiguration

		cfg.APIVersion = kubeAPIServerVersion.KubeAPIServerAuthorizationConfigAPIVersion()
		cfg.Kind = "AuthorizationConfiguration"
		cfg.Authorizers = []apiserverv1.AuthorizerConfiguration{}

		for _, authorizer := range spec.Config {
			authorizerConfig := apiserverv1.AuthorizerConfiguration{
				Name: authorizer.Name,
				Type: authorizer.Type,
			}

			if authorizer.Webhook != nil {
				var webhookCfg apiserverv1.WebhookConfiguration

				if err := runtime.DefaultUnstructuredConverter.FromUnstructured(authorizer.Webhook, &webhookCfg); err != nil {
					return nil, fmt.Errorf("error unmarshaling authorizer webhook configuration: %w", err)
				}

				authorizerConfig.Webhook = &webhookCfg
			}

```

### Core Architecture Module: `internal/app/machined/pkg/controllers/k8s/render_secrets_static_pod.go`
```
// This Source Code Form is subject to the terms of the Mozilla Public
// License, v. 2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/.

package k8s

import (
	"bytes"
	"context"
	"fmt"
	"os"
	"path/filepath"

	"github.com/cosi-project/runtime/pkg/controller"
	"github.com/cosi-project/runtime/pkg/resource"
	"github.com/cosi-project/runtime/pkg/safe"
	"github.com/cosi-project/runtime/pkg/state"
	"github.com/siderolabs/crypto/x509"
	"github.com/siderolabs/gen/optional"
	"github.com/siderolabs/gen/xslices"
	"go.uber.org/zap"

	"github.com/siderolabs/talos/internal/pkg/selinux"
	"github.com/siderolabs/talos/pkg/machinery/constants"
	"github.com/siderolabs/talos/pkg/machinery/resources/k8s"
	"github.com/siderolabs/talos/pkg/machinery/resources/secrets"
)

// RenderSecretsStaticPodController manages k8s.SecretsReady and renders secrets from secrets.Kubernetes.
type RenderSecretsStaticPodController struct{}

// Name implements controller.Controller interface.
func (ctrl *RenderSecretsStaticPodController) Name() string {
	return "k8s.RenderSecretsStaticPodController"
}

// Inputs implements controller.Controller interface.
func (ctrl *RenderSecretsStaticPodController) Inputs() []controller.Input {
	return []controller.Input{
		{
			Namespace: secrets.NamespaceName,
			Type:      secrets.KubernetesRootType,
			ID:        optional.Some(secrets.KubernetesRootID),
			Kind:      controller.InputWeak,
		},
		{
			Namespace: secrets.NamespaceName,
			Type:      secrets.EtcdRootType,
			ID:        optional.Some(secrets.EtcdRootID),
			Kind:      controller.InputWeak,
		},
		{
			Namespace: secrets.NamespaceName,
			Type:      secrets.KubernetesType,
			ID:        optional.Some(secrets.KubernetesID),
			Kind:      controller.InputWeak,
		},
		{
			Namespace: secrets.NamespaceName,
			Type:      secrets.KubernetesDynamicCertsType,
			ID:        optional.Some(secrets.KubernetesDynamicCertsID),
			Kind:      controller.InputWeak,
		},
		{
			Namespace: secrets.NamespaceName,
			Type:      secrets.EtcdType,
			ID:        optional.Some(secrets.EtcdID),
			Kind:      controller.InputWeak,
		},
		{
			Namespace: k8s.NamespaceName,
			Type:      k8s.EtcdEncryptionConfigType,
			ID:        optional.Some(k8s.EtcdEncryptionConfigID),
			Kind:      controller.InputWeak,
		},
	}
}

// Outputs implements controller.Controller interface.
func (ctrl *RenderSecretsStaticPodController) Outputs() []controller.Output {
	return []controller.Output{
		{
			Type: k8s.SecretsStatusType,
			Kind: controller.OutputExclusive,
		},
	}
}

// Run implements controller.Controller interface.
//
//nolint:gocyclo,cyclop
func (ctrl *RenderSecretsStaticPodController) Run(ctx context.Context, r controller.Runtime, _ *zap.Logger) error {
	for {
		select {
		case <-ctx.Done():
			return nil
		case <-r.EventCh():
		}

		secretsRes, err := safe.ReaderGet[*secrets.Kubernetes](ctx, r, resource.NewMetadata(secrets.NamespaceName, secrets.KubernetesType, secrets.KubernetesID, resource.VersionUndefined))
		if err != nil {
			if state.IsNotFoundError(err) {
				continue
			}

			return fmt.Errorf("error getting secrets resource: %w", err)
		}

		certsRes, err := safe.ReaderGet[*secrets.KubernetesDynamicCerts](
			ctx, r,
			resource.NewMetadata(secrets.NamespaceName, secrets.KubernetesDynamicCertsType, secrets.KubernetesDynamicCertsID, resource.VersionUndefined),
		)
		if err != nil {
			if state.IsNotFoundError(err) {
				continue
			}

			return fmt.Errorf("error getting certificates resource: %w", err)
		}

		etcdRes, err := safe.ReaderGet[*secrets.Etcd](ctx, r, resource.NewMetadata(secrets.NamespaceName, secrets.EtcdType, secrets.EtcdID, resource.VersionUndefined))
		if err != nil {
			if state.IsNotFoundError(err) {
				continue
			}

			return fmt.Errorf("error getting secrets resource: %w", err)
		}

		rootEtcdRes, err := safe.ReaderGet[*secrets.EtcdRoot](ctx, r, resource.NewMetadata(secrets.NamespaceName, secrets.EtcdRootType, secrets.EtcdRootID, resource.VersionUndefined))
		if err != nil {
			if state.IsNotFoundError(err) {
				continue
			}

			return fmt.Errorf("error getting secrets resource: %w", err)
		}

		rootK8sRes, err := safe.ReaderGet[*secrets.KubernetesRoot](ctx, r, resource.NewMetadata(secrets.NamespaceName, secrets.KubernetesRootType, secrets.KubernetesRootID, resource.VersionUndefined))
		if err != nil {
			if state.IsNotFoundError(err) {
				continue
			}

			return fmt.Errorf("error getting secrets resource: %w", err)
		}

		etcdEncryptionConfig, err := safe.ReaderGetByID[*k8s.EtcdEncryptionConfig](ctx, r, k8s.EtcdEncryptionConfigID)
		if err != nil {
			if state.IsNotFoundError(err) {
				continue
			}

			return fmt.Errorf("error getting etcd encryption config: %w", err)
		}

		rootEtcdSecrets := rootEtcdRes.TypedSpec()
		rootK8sSecrets := rootK8sRes.TypedSpec()
		etcdSecrets := etcdRes.TypedSpec()
		k8sSecrets := secretsRes.TypedSpec()
		k8sCerts := certsRes.TypedSpec()
		etcdEncryption := etcdEncryptionConfig.TypedSpec()

		type secret struct {
			getter       func() *x509.PEMEncodedCertificateAndKey
			certFilename string
			keyFilename  string
		}

		type file struct {
			filename    string
			contentFunc func() ([]byte, error)
		}

		for _, pod := range []struct {
			name         string
			directory    string
			selinuxLabel string
			uid          int
			gid          int
			secrets      []secret
			files        []file
		}{
			{
				name:         "kube-apiserver",
				directory:    constants.KubernetesAPIServerSecretsDir,
				selinuxLabel: constants.KubernetesAPIServerSecretsDirSELinuxLabel,
				uid:          constants.KubernetesAPIServerRunUser,
				gid:          constants.KubernetesAPIServerRunGroup,
				secrets: []secret{
					{
						getter:       func() *x509.PEMEncodedCertificateAndKey { return rootEtcdSecrets.EtcdCA },
						certFilename: "etcd-client-ca.crt",
					},
					{
						getter:       func() *x509.PEMEncodedCertificateAndKey { return etcdSecrets.EtcdAPIServer },
						certFilename: "etcd-client.crt",
						keyFilename:  "etcd-client.key",
					},
					{
						getter: func() *x509.PEMEncodedCertificateAndKey {
							return &x509.PEMEncodedCertificateAndKey{
								Crt: bytes.Join(xslices.Map(rootK8sSecrets.AcceptedCAs, func(ca *x509.PEMEncodedCertificate) []byte { return ca.Crt }), nil),
							}
						},
						certFilename: "ca.crt",
					},
					{
						getter:       func() *x509.PEMEncodedCertificateAndKey { return k8sCerts.APIServer },
						certFilename: "apiserver.crt",
						keyFilename:  "apiserver.key",
					},
					{
						getter:       func() *x509.PEMEncodedCertificateAndKey { return k8sCerts.APIServerKubeletClient },
						certFilename: "apiserver-kubelet-client.crt",
						keyFilename:  "apiserver-kubelet-client.key",
					},
					{
						getter: func() *x509.PEMEncodedCertificateAndKey {
							return &x509.PEMEncodedCertificateAndKey{
								Crt: bytes.Join(xslices.Map(rootK8sSecrets.ServiceAccountAcceptedKeys, func(ca *x509.PEMEncodedKey) []byte { return ca.Key }), nil),
								Key: rootK8sSecrets.ServiceAccount.Key,
							}
						},
						certFilename: "service-account.pub",
						keyFilename:  "service-account.key",
					},
					{
						getter: func() *x509.PEMEncodedCertificateAndKey {
							return &x509.PEMEncodedCertificateAndKey{
								Crt: bytes.Join(xslices.Map(rootK8sSecrets.AcceptedAggregatorCAs, func(ca *x509.PEMEncodedCertificate) []byte { return ca.Crt }), nil),
							}
						},
						certFilename: "aggregator-ca.crt",
					},
					{
						getter:       func() *x509.PEMEncodedCertificateAndKey { return k8sCerts.FrontProxy },
						certFilename: "front-proxy-client.crt",
						keyFilename:  "front-proxy-client.key",
					},
				},
				files: []file{
					{
						filename: "encryptionconfig.yaml",
						contentFunc: func() ([]byte, error) {
							return []byte(etcdEncryption.Configuration), nil
						},
					},
				},
			},
			{
				name:         "kube-controller-manager",
				directory:    constants.KubernetesControllerManagerSecretsDir,
				selinuxLabel: constants.KubernetesControllerManagerSecretsDirSELinuxLabel,
				uid:          constants.KubernetesControllerManagerRunUser,
				gid:          constants.KubernetesControllerManagerRunGroup,
				secrets: []secret{
					{
						getter:       func() *x509.PEMEncodedCertificateAndKey { return rootK8sSecrets.IssuingCA },
						certFilename: "ca.crt",
						keyFilename:  "ca.key",
					},
					{
						getter: func() *x509.PEMEncodedCertificateAndKey {
							return &x509.PEMEncodedCertificateAndKey{
								Key: rootK8sSecrets.ServiceAccount.Key,
							}
						},
						keyFilename: "service-account.key",
					},
				},
				files: []file{
					{
						filename:    "kubeconfig",
						contentFunc: func() ([]byte, error) { return []byte(k8sSecrets.ControllerManagerKubeconfig), nil },
					},
				},
			},
			{
				name:         "kube-scheduler",
				directory:    constants.KubernetesSchedulerSecretsDir,
				selinuxLabel: constants.KubernetesSchedulerSecretsDirSELinuxLabel,
				uid:          constants.KubernetesSchedulerRunUser,
				gid:          constants.KubernetesSchedulerRunGroup,
				files: []file{
					{
						filename:    "kubeconfig",
						contentFunc: func() ([]byte, error) { return []byte(k8sSecrets.SchedulerKubeconfig), nil },
					},
				},
			},
		} {
			if err = os.MkdirAll(pod.directory, 0o755); err != nil {
				return fmt.Errorf("error creating secrets directory for %q: %w", pod.name, err)
			}

			if err = selinux.SetLabel(pod.directory, pod.selinuxLabel); err != nil {
				return err
			}

			for _, secret := range pod.secrets {
				certAndKey := secret.getter()

				if secret.certFilename != "" {
					if err = os.WriteFile(filepath.Join(pod.directory, secret.certFilename), certAndKey.Crt, 0o400); err != nil {
						return fmt.Errorf("error writing certificate %q for %q: %w", secret.certFilename, pod.name, err)
					}

					if err = os.Chown(filepath.Join(pod.dir
```


### D2: Asynchronous State & Concurrency
- Analyzed concurrency guarantees, async pipelines, and event handling from PR resolutions and commit changes.

### D3: Error Boundaries, Recovery & Rollbacks
- Exception handling patterns and defect resolutions extracted from closed production bug issues:
- **Issue #14563** (2026-10-05): **chore: update disvulncheck (2026-10-05)**
  *Symptoms*: Updates Go vulnerability exclusions 

- **Issue #14561** (2026-10-05): **feat: add CPU partition cgroup operations**
  *Symptoms*: Add cgroup operations needed to apply CPU policy without losing inherited masks or hiding delegation failures. Inspect configured and effective masks separately so reconciliation can wait for workloads to release CPUs.  No production callers are introduced yet.  Fixes: #14530
  **Post-Mortem & Fix Analysis**:
  > /m

- **Issue #14550** (2026-10-02): **test: coverage for explicit vm stop, before delete**
  *Symptoms*: Adds integration test coverage for the Talos VM boot scenario.   Apart from stopping the VM through removal, we now also stop the VM explicitly without removing it (through `powerState`), check the outcome, restart it, check Talos API responsiveness, and only after that remove the VM completely. 
  **Post-Mortem & Fix Analysis**:
  > /m

- **Issue #14549** (2026-10-02): **fix: roll back stacked try configs to the config before the first try**
  *Symptoms*: Previously, applying a config in try mode while another try was pending made the second try save the current config, which already contained the first try, as its rollback config. It also stopped the first timer. Because of this, the first try was never rolled back and stayed applied permanently until next reboot. Additionally, a timer that had already fired could still roll back after it was cancelled or replaced, because its callback did not check whether it was still the active timer.  Fix this by saving the config in `rollbackConfig` only when no rollback timer is pending, so a stacked try keeps the config from before the first try. The `time.AfterFunc` callback now holds `rollbackTimerMu` and returns without rolling back when `r.rollbackTimer` no longer points at its own timer.
  **Post-Mortem & Fix Analysis**:
  > /m

- **Issue #14548** (2026-10-02): **feat: rework route configuration**
  *Symptoms*: Fixes #14502  Previously, the `RouteSpec` and `RouteStatus` used same method to generate resource ID, but the internal "primary key" in the routing table in Linux kernel is the following:  * table * family * destination * priority  The status has to keep more fields to show some routes that can only be set by the kernel (but not userspace).  The gateway or next-hops are not part of the route spec ID anymore.  This fixes many issues around route configuration:  * conflicts are detected early and merged together before they reach the route spec controller (which would keep failing trying to keep install duplicates anyways) * the route change like the one in #14502 is no longer delete + add flow, but atomic replace in the Linux kernel, so there is no time when the route is missing 
  **Post-Mortem & Fix Analysis**:
  > /m

- **Issue #14547** (2026-10-02): **fix: clean up mountpoints on unmount**
  *Symptoms*: Inspired by #14504  When Talos mounts some volume, it creates the directory for the mountpoint, but it never deleted it on unmount.  This was specifically important for `/var/mnt`: the fact that the directory is missing will be used by the kubelet to gate pod startup using it as hostPath (as kubelet can't create the directory itself, as `/var/mnt` itself is 'ro' for the kubelet).  Fix this by removing directories which were created by mounts, and also cleanup `/var/mnt` itself on initial mount - whether after upgrade of Talos to clean up stale mounts, or after unclean shutdown when the unmount operation wasn't done in full. 
  **Post-Mortem & Fix Analysis**:
  > /m

- **Issue #14546** (2026-10-02): **feat: add CPU partition configuration**
  *Symptoms*: Allow machine configuration to describe CPU boundaries and named VM slices. Project the policy into an intermediate spec so runtime enforcement remains separate from configuration parsing.  Fixes: #14529
  **Post-Mortem & Fix Analysis**:
  > /m

- **Issue #14545** (2026-10-03): **test: boot stock Alpine ISO over serial console**
  *Symptoms*: Drive a real guest end to end through ConsoleStream: serial login, shell I/O, DHCP lease from a reserved MAC, ping to gateway, and wget to a host HTTP server. Uses nonce markers split on the wire, so echoed input can't produce a false match.  - add -talos.hypervisor.alpine-iso flag; test skips when it's unset - add download-alpine-iso make target (pinned URL, sha256-verified) - pass EXTRA_TEST_ARGS through to e2e so make expands $(ALPINE_ISO) - wire ISO download into hypervisor CI pipelines via .kres.yaml  <img width="961" height="590" alt="image" src="https://github.com/user-attachments/assets/59e1bc3e-7fcc-4e6c-9017-14c6ee85a697" />  Signed-off-by: Mateusz Urbanek <mateusz.urbanek@siderolabs.com> 
  **Post-Mortem & Fix Analysis**:
  > /m

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

### Incident Patch 1: `da3c1022` (2026-10-02)
**Commit Message**: fix: clean up mountpoints on unmount

Inspired by #14504

When Talos mounts some volume, it creates the directory for the
mountpoint, but it never deleted it on unmount.

This was specifically important for `/var/mnt`: the fact that the
directory is missing will be used by the kubelet to gate pod startup
using it as hostPath (as kubelet can't create the directory itself, as
`/var/mnt` itself is 'ro' for the kubelet).

Fix this by removing directories which were created by mounts, and also
cleanup `/var/mnt` itself on initial mount - whether after upgrade of
Talos to clean up stale mounts, or after unclean shutdown when the
unmount operation wasn't done in full.

Signed-off-by: Andrey Smirnov <[REDACTED_EMAIL]>

**File**: `internal/app/machined/pkg/controllers/block/internal/mountops/mountops.go` (added, +113/-0)
```diff
@@ -0,0 +1,113 @@
+// This Source Code Form is subject to the terms of the Mozilla Public
+// License, v. 2.0. If a copy of the MPL was not distributed with this
+// file, You can obtain one at http://mozilla.org/MPL/2.0/.
+
+// Package mountops contains helpers for mount operations.
+package mountops
+
+import (
+	"cmp"
+	"errors"
+	"fmt"
+	"io/fs"
+	"os"
+	"path/filepath"
+	"syscall"
+
+	"go.uber.org/zap"
+
+	"github.com/siderolabs/talos/internal/pkg/mount/v3"
+	"github.com/siderolabs/talos/internal/pkg/selinux"
+	"github.com/siderolabs/talos/pkg/machinery/resources/block"
+)
+
+// CreateMountPoint creates the mount point directory if it doesn't exist.
+//
+// The directory is created with the ownership, permissions and SELinux label of the mount spec,
+// and the return value indicates whether the directory was created.
+func CreateMountPoint(target string, mountSpec block.MountSpec) (bool, error) {
+	_, err := os.Lstat(target)
+	if err == nil {
+		return false, nil
+	}
+
+	if !errors.Is(err, fs.ErrNotExist) {
+		return false, fmt.Errorf("failed to stat mount point %q: %w", target, err)
+	}
+
+	if err = os.MkdirAll(filepath.Dir(target), 0o755); err != nil {
+		return false, fmt.Errorf("failed to create parent directory of mount point %q: %w", target, err)
+	}
+
+	mode := cmp.Or(mountSpec.FileMode, 0o755)
+
+	if err = os.Mkdir(target, mode); err != nil {
+		return false, fmt.Errorf("failed to create mount point %q: %w", target, err)
+	}
+
+	if err = setupMountPoint(target, mode, mountSpec); err != nil {
+		os.Remove(target) //nolint:errcheck
+
+		return false, err
+	}
+
+	return true, nil
+}
+
+func setupMountPoint(target string, mode fs.FileMode, mountSpec block.MountSpec) error {
+	// os.Mkdir is subject to umask
+	if err := os.Chmod(target, mode); err != nil {
+		return fmt.Errorf("failed to chmod mount point %q: %w", target, err)
+	}
+
+	if err := os.Lchown(target, mountSpec.UID, mountSpec.GID); err != nil {
+		return fmt.Errorf("failed to chown mount point %q: %w", target, err)
+	}
+
+	// the filesystem of the mount point is the parent filesystem, which is not known here
+	return mount.FilterSelinuxLabelErrors(target, "", selinux.SetLabel(target, mountSpec.SelinuxLabel))
+}
+
+// RemoveMountPoint removes the mount point directory created by createMountPoint after unmount.
+//
+// os.Remove never removes a non-empty directory.
+func RemoveMountPoint(logger *zap.Logger, target string) {
+	err := os.Remove(target)
+
+	switch {
+	case err == nil:
+		logger.Info("removed mount point", zap.String("target", target))
+	case !errors.Is(err, fs.ErrNotExist):
+		logger.Warn("failed to remove mount point", zap.String("target", target), zap.Error(err))
+	}
+}
+
+// CleanupEmptyDirectories removes empty directories directly under the given path.
+//
+// It is used to clean up mount points which were left behind, e.g. due to an unclean shutdown.
+func CleanupEmptyDirectories(logger *zap.Logger, path string) {
+	entries, err := os.ReadDir(path)
+	if err != nil {
+		logger.Warn("failed to read directory for cleanup", zap.String("path", path), zap.Error(err))
+
+		return
+	}
+
+	for _, entry := range entries {
+		if !entry.IsDir() {
+			continue
+		}
+
+		target := filepath.Join(path, entry.Name())
+
+		if err = os.Remove(target); err != nil {
+			if !errors.Is(err, syscall.ENOTEMPTY) && !errors.Is(err, syscall.EEXIST) && !errors.Is(err, syscall.EBUSY) {
+				logger.Warn("failed to remove empty directory", zap.String("path", target), zap.Error(err))
+			}
+
+			continue
+		}
+
+		logger.Info("removed empty directory", zap.String("path", target))
+	}
+}
```

**File**: `internal/app/machined/pkg/controllers/block/internal/mountops/mountops_test.go` (added, +85/-0)
```diff
@@ -0,0 +1,85 @@
+// This Source Code Form is subject to the terms of the Mozilla Public
+// License, v. 2.0. If a copy of the MPL was not distributed with this
+// file, You can obtain one at http://mozilla.org/MPL/2.0/.
+
+package mountops_test
+
+import (
+	"os"
+	"path/filepath"
+	"testing"
+
+	"github.com/stretchr/testify/assert"
+	"github.com/stretchr/testify/require"
+	"go.uber.org/zap/zaptest"
+
+	"github.com/siderolabs/talos/internal/app/machined/pkg/controllers/block/internal/mountops"
+	"github.com/siderolabs/talos/pkg/machinery/resources/block"
+)
+
+func TestCreateMountPoint(t *testing.T) {
+	t.Parallel()
+
+	mountSpec := block.MountSpec{
+		FileMode: 0o710,
+		UID:      os.Getuid(),
+		GID:      os.Getgid(),
+	}
+
+	t.Run("new", func(t *testing.T) {
+		t.Parallel()
+
+		target := filepath.Join(t.TempDir(), "parent", "vol")
+
+		created, err := mountops.CreateMountPoint(target, mountSpec)
+		require.NoError(t, err)
+		assert.True(t, created)
+
+		st, err := os.Stat(target)
+		require.NoError(t, err)
+		assert.True(t, st.IsDir())
+		assert.Equal(t, os.FileMode(0o710), st.Mode().Perm())
+
+		mountops.RemoveMountPoint(zaptest.NewLogger(t), target)
+
+		assert.NoDirExists(t, target)
+		assert.DirExists(t, filepath.Dir(target))
+	})
+
+	t.Run("existing", func(t *testing.T) {
+		t.Parallel()
+
+		target := filepath.Join(t.TempDir(), "vol")
+		require.NoError(t, os.Mkdir(target, 0o755))
+
+		created, err := mountops.CreateMountPoint(target, mountSpec)
+		require.NoError(t, err)
+		assert.False(t, created)
+
+		st, err := os.Stat(target)
+		require.NoError(t, err)
+		assert.Equal(t, os.FileMode(0o755), st.Mode().Perm())
+	})
+}
+
+func TestRemoveMountPoint(t *testing.T) {
+	t.Parallel()
+
+	t.Run("missing", func(t *testing.T) {
+		t.Parallel()
+
+		mountops.RemoveMountPoint(zaptest.NewLogger(t), filepath.Join(t.TempDir(), "vol"))
+	})
+
+	t.Run("not empty", func(t *testing.T) {
+		t.Parallel()
+
+		target := filepath.Join(t.TempDir(), "vol")
+		require.NoError(t, os.Mkdir(target, 0o755))
+		require.NoError(t, os.WriteFile(filepath.Join(target, "data"), []byte("x"), 0o644))
+
+		mountops.RemoveMountPoint(zaptest.NewLogger(t), target)
+
+		assert.FileExists(t, filepath.Join(target, "data"))
+	})
+}
```

**File**: `internal/app/machined/pkg/controllers/block/mount.go` (modified, +36/-1)
```diff
@@ -25,6 +25,7 @@ import (
 	"go.uber.org/zap"
 
 	"github.com/siderolabs/talos/internal/app/machined/pkg/controllers/block/internal/mountconfig"
+	"github.com/siderolabs/talos/internal/app/machined/pkg/controllers/block/internal/mountops"
 	"github.com/siderolabs/talos/internal/app/machined/pkg/controllers/block/internal/nfs"
 	"github.com/siderolabs/talos/internal/pkg/mount/v3"
 	"github.com/siderolabs/talos/internal/pkg/selinux"
@@ -43,6 +44,7 @@ type mountContext struct {
 	secure              bool
 	noExec              bool
 	securityInitialized bool
+	mountPointCreated   bool
 	unmounter           func() error
 }
 
@@ -145,6 +147,8 @@ func (ctrl *MountController) Run(ctx context.Context, r controller.Runtime, logg
 
 			mountStatus := mountStatusMap[mountRequest.Metadata().ID()]
 			mountStatusTearingDown := mountStatus != nil && mountStatus.Metadata().Phase() == resource.PhaseTearingDown
+			// either there was no mount status, or it was just torn down (if we get to the mount operation)
+			mountStatusMissing := mountStatus == nil || mountStatusTearingDown
 
 			mountHasParent := mountRequest.TypedSpec().ParentMountID != ""
 			mountParentStatus := mountStatusMap[mountRequest.TypedSpec().ParentMountID] // this might be nil
@@ -240,6 +244,15 @@ func (ctrl *MountController) Run(ctx context.Context, r controller.Runtime, logg
 					return err
 				}
 
+				if mountStatusMissing && volumeStatus.Metadata().ID() == constants.UserVolumeMountPoint {
+					// user volumes are mounted under this directory, and they can't be mounted until the mount status is created,
+					// so this is the right time to clean up leftover mount points (e.g. from an unclean shutdown)
+					//
+					// it's important to perform cleanup, as kubelet's code will use the fact that `/var/mnt/<something>` is missing
+					// as a gate to skip starting the pod
+					mountops.CleanupEmptyDirectories(logger, filepath.Join(rootPath, mountTarget))
+				}
+
 				if err = safe.WriterModify(
 					ctx, r, block.NewMountStatus(block.NamespaceName, mountRequest.Metadata().ID()),
 					func(mountStatus *block.MountStatus) error {
@@ -696,14 +709,31 @@ func (ctrl *MountController) handleDiskMountOperation(
 			opts,
 		)...)
 
+		var mountPointCreated bool
+
+		if !mountRequest.TypedSpec().Detached {
+			var err error
+
+			mountPointCreated, err = mountops.CreateMountPoint(mountTarget, volumeStatus.TypedSpec().MountSpec)
+			if err != nil {
+				return fmt.Errorf("failed to create mount point for %q: %w", mountRequest.Metadata().ID(), err)
+			}
+		}
+
 		mountpoint, err := manager.Mount()
 		if err != nil {
+			if mountPointCreated {
+				mountops.RemoveMountPoint(logger, mountTarget)
+			}
+
 			return fmt.Errorf("failed to mount %q: %w", mountRequest.Metadata().ID(), err)
 		}
 
 		if shouldUpdateTargetSettings {
 			if err = ctrl.updateTargetSettings(mountTarget, volumeStatus.TypedSpec().Filesystem, volumeStatus.TypedSpec().MountSpec); err != nil {
-				manager.Unmount() //nolint:errcheck
+				if manager.Unmount() == nil && mountPointCreated {
+					mountops.RemoveMountPoint(logger, mountTarget)
+				}
 
 				return fmt.Errorf("failed to update target settings %q: %w", mountRequest.Metadata().ID(), err)
 			}
@@ -730,6 +760,7 @@ func (ctrl *MountController) handleDiskMountOperation(
 			secure:              mountRequest.TypedSpec().Secure,
 			noExec:              mountRequest.TypedSpec().NoExec,
 			securityInitialized: true,
+			mountPointCreated:   mountPointCreated,
 			unmounter:           manager.Unmount,
 		}
 		ctrl.activeMounts[mountRequest.Metadata().ID()] = mountCtx
@@ -990,6 +1021,10 @@ func (ctrl *MountController) handleDiskUnmountOperation(
 		zap.String("filesystem", mountCtx.point.FSType()),
 	)
 
+	if mountCtx.mountPointCreated {
+		mountops.RemoveMountPoint(logger, mountCtx.point.Target())
+	}
+
 	return nil
 }
 
```

**File**: `internal/app/machined/pkg/controllers/block/mount_test.go` (modified, +31/-1)
```diff
@@ -15,6 +15,7 @@ import (
 
 	blockctrls "github.com/siderolabs/talos/internal/app/machined/pkg/controllers/block"
 	"github.com/siderolabs/talos/internal/app/machined/pkg/controllers/ctest"
+	"github.com/siderolabs/talos/pkg/machinery/constants"
 	"github.com/siderolabs/talos/pkg/machinery/resources/block"
 )
 
@@ -33,7 +34,7 @@ func TestMountSuite(t *testing.T) {
 	})
 }
 
-func (suite *MountSuite) mountVolume(volumeID string) { //nolint:unparam
+func (suite *MountSuite) mountVolume(volumeID string) {
 	mountRequest := block.NewMountRequest(block.NamespaceName, volumeID)
 	mountRequest.TypedSpec().RequesterIDs = []string{"requester1/" + volumeID}
 	mountRequest.TypedSpec().Requesters = []string{"requester1"}
@@ -148,3 +149,32 @@ func (suite *MountSuite) TestSymlinkDirectory() {
 	suite.Require().NoError(err)
 	suite.Assert().Equal("/run", path)
 }
+
+func (suite *MountSuite) TestUserVolumeMountPointCleanup() {
+	dir := suite.T().TempDir()
+
+	// leftover empty mount point
+	suite.Require().NoError(os.Mkdir(filepath.Join(dir, "empty"), 0o755))
+	// non-empty directory
+	suite.Require().NoError(os.Mkdir(filepath.Join(dir, "data"), 0o755))
+	suite.Require().NoError(os.WriteFile(filepath.Join(dir, "data", "file"), []byte("data"), 0o644))
+	// regular file
+	suite.Require().NoError(os.WriteFile(filepath.Join(dir, "file"), []byte("data"), 0o644))
+
+	volumeStatus := block.NewVolumeStatus(block.NamespaceName, constants.UserVolumeMountPoint)
+	volumeStatus.TypedSpec().Type = block.VolumeTypeDirectory
+	volumeStatus.TypedSpec().MountSpec = block.MountSpec{
+		TargetPath: dir,
+		FileMode:   0o755,
+		UID:        os.Getuid(),
+		GID:        os.Getgid(),
+	}
+	volumeStatus.TypedSpec().Phase = block.VolumePhaseReady
+	suite.Create(volumeStatus)
+
+	suite.mountVolume(constants.UserVolumeMountPoint)
+
+	suite.Assert().NoDirExists(filepath.Join(dir, "empty"))
+	suite.Assert().FileExists(filepath.Join(dir, "data", "file"))
+	suite.Assert().FileExists(filepath.Join(dir, "file"))
+}
```

**File**: `internal/integration/api/volumes.go` (modified, +13/-0)
```diff
@@ -606,6 +606,19 @@ func (suite *VolumesSuite) TestUserVolumesPartition() {
 		rtestutils.AssertNoResource[*block.VolumeStatus](ctx, suite.T(), suite.Client.COSI, userVolumeID)
 	}
 
+	// verify that the mount points were removed after unmount
+	stream, err = suite.Client.LS(ctx, &machineapi.ListRequest{
+		Root:  constants.UserVolumeMountPoint,
+		Types: []machineapi.ListRequest_Type{machineapi.ListRequest_DIRECTORY},
+	})
+	suite.Require().NoError(err)
+
+	suite.Require().NoError(helpers.ReadGRPCStream(stream, func(info *machineapi.FileInfo, _ string, _ bool) error {
+		suite.Assert().NotContains(volumeIDs, info.RelativeName, "expected mount point %s to be removed", info.Name)
+
+		return nil
+	}))
+
 	suite.Require().EventuallyWithT(func(collect *assert.CollectT) {
 		// a little retry loop, as the device might be considered busy for a little while after unmounting
 		asrt := assert.New(collect)
```

---

### Incident Patch 2: `738f1ab8` (2026-10-02)
**Commit Message**: fix: roll back stacked try configs to the config before the first try

Previously, applying a config in try mode while another try was pending made the second try save the current config, which already contained the first try, as its rollback config. It also stopped the first timer. Because of this, the first try was never rolled back and stayed applied permanently until next reboot. Additionally, a timer that had already fired could still roll back after it was canceled or replaced, because its callback did not check whether it was still the active timer.

Fix this by saving the config in `rollbackConfig` only when no rollback timer is pending, so a stacked try keeps the config from before the first try. The `time.AfterFunc` callback now holds `rollbackTimerMu` and returns without rolling back when `r.rollbackTimer` no longer points at its own timer.

Signed-off-by: Oguz Kilcan <[REDACTED_EMAIL]>

**File**: `internal/app/machined/pkg/runtime/v1alpha1/v1alpha1_runtime.go` (modified, +28/-3)
```diff
@@ -35,6 +35,7 @@ type Runtime struct {
 
 	rollbackTimerMu sync.Mutex
 	rollbackTimer   *time.Timer
+	rollbackConfig  config.Provider
 }
 
 // NewRuntime initializes and returns the v1alpha1 runtime.
@@ -90,18 +91,41 @@ func (r *Runtime) ConfigContainer() config.Container {
 
 // RollbackToConfigAfter implements the Runtime interface.
 func (r *Runtime) RollbackToConfigAfter(timeout time.Duration) error {
-	cfgProvider := r.configProvider()
+	r.rollbackTimerMu.Lock()
+	defer r.rollbackTimerMu.Unlock()
+
+	// a try applied while another one is pending rolls back to the config active before the first try
+	if r.rollbackTimer == nil {
+		r.rollbackConfig = r.configProvider()
+	} else {
+		r.rollbackTimer.Stop()
+	}
+
+	var timer *time.Timer
 
-	r.CancelConfigRollbackTimeout()
+	timer = time.AfterFunc(timeout, func() {
+		r.rollbackTimerMu.Lock()
+		defer r.rollbackTimerMu.Unlock()
+
+		// canceled or replaced while firing
+		if r.rollbackTimer != timer {
+			return
+		}
+
+		cfgProvider := r.rollbackConfig
+
+		r.rollbackTimer = nil
+		r.rollbackConfig = nil
 
-	r.rollbackTimer = time.AfterFunc(timeout, func() {
 		log.Println("rolling back the configuration")
 
 		if err := r.SetConfig(cfgProvider); err != nil {
 			log.Printf("config rollback failed %s", err)
 		}
 	})
 
+	r.rollbackTimer = timer
+
 	return nil
 }
 
@@ -113,6 +137,7 @@ func (r *Runtime) CancelConfigRollbackTimeout() {
 	if r.rollbackTimer != nil {
 		r.rollbackTimer.Stop()
 		r.rollbackTimer = nil
+		r.rollbackConfig = nil
 	}
 }
 
```

**File**: `internal/integration/api/apply-config.go` (modified, +72/-0)
```diff
@@ -16,6 +16,7 @@ import (
 	"time"
 
 	"github.com/cosi-project/runtime/pkg/resource/rtestutils"
+	"github.com/cosi-project/runtime/pkg/safe"
 	"github.com/siderolabs/gen/ensure"
 	"github.com/siderolabs/go-retry/retry"
 	"github.com/stretchr/testify/assert"
@@ -632,6 +633,77 @@ func (suite *ApplyConfigSuite) TestApplyTry() {
 	})
 }
 
+// TestApplyTryStacked applies two configs in try mode, the second one before the first one times out.
+func (suite *ApplyConfigSuite) TestApplyTryStacked() {
+	suite.WaitForBootDone(suite.ctx)
+
+	node := suite.RandomDiscoveredNodeInternalIP(machine.TypeWorker)
+	suite.T().Logf("applying configuration to node %q", node)
+	suite.ClearConnectionRefused(suite.ctx, node)
+	nodeCtx := client.WithNode(suite.ctx, node)
+
+	// the persistent config does not exist if the node booted with the config from STATE
+	suite.UpdateMachineConfig(nodeCtx, func(acr *machineapi.ApplyConfigurationRequest) {
+		acr.Mode = machineapi.ApplyConfigurationRequest_NO_REBOOT
+	}, func(cfg config.Provider) (config.Provider, error) {
+		return cfg, nil
+	})
+
+	suite.PatchMachineConfigWithModeSetter(nodeCtx, func(acr *machineapi.ApplyConfigurationRequest) {
+		acr.Mode = machineapi.ApplyConfigurationRequest_TRY
+		acr.TryModeTimeout = durationpb.New(time.Minute)
+	}, network.NewDummyLinkConfigV1Alpha1("dummy-try-a"))
+
+	suite.PatchMachineConfigWithModeSetter(nodeCtx, func(acr *machineapi.ApplyConfigurationRequest) {
+		acr.Mode = machineapi.ApplyConfigurationRequest_TRY
+		acr.TryModeTimeout = durationpb.New(10 * time.Second)
+	}, network.NewDummyLinkConfigV1Alpha1("dummy-try-b"))
+
+	dummyLinkNames := func(provider config.Provider) []string {
+		var names []string
+
+		for _, doc := range provider.Documents() {
+			if namedDocument, ok := doc.(configconfig.NamedDocument); ok && doc.Kind() == network.DummyLinkKind {
+				names = append(names, namedDocument.Name())
+			}
+		}
+
+		return names
+	}
+
+	rtestutils.AssertResource(nodeCtx, suite.T(), suite.Client.COSI, mc.ActiveID, func(r *mc.MachineConfig, asrt *assert.Assertions) {
+		asrt.Subset(dummyLinkNames(r.Provider()), []string{"dummy-try-a", "dummy-try-b"})
+	})
+
+	rtestutils.AssertResource(nodeCtx, suite.T(), suite.Client.COSI, mc.PersistentID, func(r *mc.MachineConfig, asrt *assert.Assertions) {
+		asrt.NotContains(dummyLinkNames(r.Provider()), "dummy-try-a")
+		asrt.NotContains(dummyLinkNames(r.Provider()), "dummy-try-b")
+	})
+
+	ctx, cancel := context.WithTimeout(nodeCtx, 30*time.Second)
+	defer cancel()
+
+	// both tries are rolled back when the second one times out
+	rtestutils.AssertResource(ctx, suite.T(), suite.Client.COSI, mc.ActiveID, func(r *mc.MachineConfig, asrt *assert.Assertions) {
+		asrt.NotContains(dummyLinkNames(r.Provider()), "dummy-try-a")
+		asrt.NotContains(dummyLinkNames(r.Provider()), "dummy-try-b")
+	})
+
+	active, err := safe.StateGetByID[*mc.MachineConfig](ctx, suite.Client.COSI, mc.ActiveID)
+	suite.Require().NoError(err)
+
+	persistent, err := safe.StateGetByID[*mc.MachineConfig](ctx, suite.Client.COSI, mc.PersistentID)
+	suite.Require().NoError(err)
+
+	activeBytes, err := active.Provider().EncodeBytes()
+	suite.Require().NoError(err)
+
+	persistentBytes, err := persistent.Provider().EncodeBytes()
+	suite.Require().NoError(err)
+
+	suite.Assert().Equal(string(persistentBytes), string(activeBytes), "active config should be the same as the persistent config after the rollback")
+}
+
 // TestApplyRemovingV1Alpha1 verifies the apply config doesn't accept removal of v1alpha1 config.
 func (suite *ApplyConfigSuite) TestApplyRemovingV1Alpha1() {
 	suite.WaitForBootDone(suite.ctx)
```

---

### Incident Patch 3: `83a80df9` (2026-10-01)
**Commit Message**: fix: verify the claim for the legacy bundle image verification

Ensure that the signature claims the verified image digest.

Signed-off-by: Andrey Smirnov <[REDACTED_EMAIL]>

**File**: `internal/pkg/containers/image/verify/internal/cosign/cosign.go` (modified, +2/-0)
```diff
@@ -363,6 +363,8 @@ func verifyLegacyLayers(ctx context.Context, logger *zap.Logger, fetcher remotes
 		}
 
 		co.NewBundleFormat = false
+		// verify that the signed payload references the image digest being verified
+		co.ClaimVerifier = cosign.SimpleClaimVerifier
 
 		bundleVerified, err := cosign.VerifyImageSignature(ctx, sig, imageDigest, &co)
 		if err != nil {
```

**File**: `internal/pkg/containers/image/verify/internal/cosign/cosign_local_test.go` (added, +125/-0)
```diff
@@ -0,0 +1,125 @@
+// This Source Code Form is subject to the terms of the Mozilla Public
+// License, v. 2.0. If a copy of the MPL was not distributed with this
+// file, You can obtain one at http://mozilla.org/MPL/2.0/.
+
+package cosign_test
+
+import (
+	"bytes"
+	"crypto"
+	"crypto/ecdsa"
+	"crypto/elliptic"
+	"crypto/rand"
+	"encoding/base64"
+	"net/http/httptest"
+	"strings"
+	"testing"
+
+	"github.com/containerd/containerd/v2/core/remotes/docker"
+	"github.com/distribution/reference"
+	"github.com/google/go-containerregistry/pkg/name"
+	"github.com/google/go-containerregistry/pkg/registry"
+	"github.com/google/go-containerregistry/pkg/v1/empty"
+	"github.com/google/go-containerregistry/pkg/v1/mutate"
+	"github.com/google/go-containerregistry/pkg/v1/random"
+	"github.com/google/go-containerregistry/pkg/v1/remote"
+	"github.com/google/go-containerregistry/pkg/v1/static"
+	"github.com/google/go-containerregistry/pkg/v1/types"
+	"github.com/sigstore/cosign/v3/pkg/cosign"
+	"github.com/sigstore/sigstore/pkg/signature"
+	"github.com/sigstore/sigstore/pkg/signature/payload"
+	"github.com/stretchr/testify/assert"
+	"github.com/stretchr/testify/require"
+	"go.uber.org/zap/zaptest"
+
+	ourcosign "github.com/siderolabs/talos/internal/pkg/containers/image/verify/internal/cosign"
+)
+
+func TestVerifyLegacyRejectsSignatureForAnotherImage(t *testing.T) {
+	t.Parallel()
+
+	server := httptest.NewServer(registry.New())
+	t.Cleanup(server.Close)
+
+	repository := strings.TrimPrefix(server.URL, "http://") + "/test/image"
+
+	privateKey, err := ecdsa.GenerateKey(elliptic.P256(), rand.Reader)
+	require.NoError(t, err)
+
+	signerVerifier, err := signature.LoadECDSASignerVerifier(privateKey, crypto.SHA256)
+	require.NoError(t, err)
+
+	pushImage := func() name.Digest {
+		img, pushErr := random.Image(1024, 1)
+		require.NoError(t, pushErr)
+
+		digest, pushErr := img.Digest()
+		require.NoError(t, pushErr)
+
+		ref, pushErr := name.NewDigest(repository+"@"+digest.String(), name.Insecure)
+		require.NoError(t, pushErr)
+
+		require.NoError(t, remote.Write(ref, img))
+
+		return ref
+	}
+
+	signatureTag := func(ref name.Digest) name.Tag {
+		return ref.Context().Tag(strings.ReplaceAll(ref.DigestStr(), ":", "-") + ".sig")
+	}
+
+	signedRef := pushImage()
+	otherRef := pushImage()
+
+	// sign the first image with a legacy cosign signature
+	sigPayload, err := (&payload.Cosign{Image: signedRef}).MarshalJSON()
+	require.NoError(t, err)
+
+	rawSig, err := signerVerifier.SignMessage(bytes.NewReader(sigPayload))
+	require.NoError(t, err)
+
+	sigImage, err := mutate.Append(empty.Image, mutate.Addendum{
+		Layer: static.NewLayer(sigPayload, types.MediaType("application/vnd.dev.cosign.simplesigning.v1+json")),
+		Annotations: map[string]string{
+			"dev.cosignproject.cosign/signature": base64.StdEncoding.EncodeToString(rawSig),
+		},
+	})
+	require.NoError(t, err)
+
+	sigImage = mutate.MediaType(sigImage, types.OCIManifestSchema1)
+	sigImage = mutate.ConfigMediaType(sigImage, types.OCIConfigJSON)
+
+	require.NoError(t, remote.Write(signatureTag(signedRef), sigImage))
+
+	// copy the signature of the signed image to the signature tag of the other image
+	sigDesc, err := remote.Get(signatureTag(signedRef))
+	require.NoError(t, err)
+	require.NoError(t, remote.Put(signatureTag(otherRef), sigDesc))
+
+	resolver := docker.NewResolver(docker.ResolverOptions{
+		Hosts: docker.ConfigureDefaultRegistries(docker.WithPlainHTTP(docker.MatchAllHosts)),
+	})
+
+	checkOpts := cosign.CheckOpts{
+		Offline:     true,
+		IgnoreTlog:  true,
+		SigVerifier: signerVerifier,
+	}
+
+	verifyImage := func(ref name.Digest) (*ourcosign.VerifyResult, error) {
+		namedRef, parseErr := reference.ParseDockerRef(ref.String())
+		require.NoError(t, parseErr)
+
+		canonicalRef, ok := namedRef.(reference.Canonical)
+		require.True(t, ok, "image reference must be digested")
+
+		return ourcosign.VerifyImage(t.Context(), zaptest.NewLogger(t), resolver, nil, canonicalRef, checkOpts)
+	}
+
+	result, err := verifyImage(signedRef)
+	require.NoError(t, err)
+	assert.Equal(t, "verified via legacy signature (bundle verified false)", result.Message)
+
+	_, err = verifyImage(otherRef)
+	require.ErrorContains(t, err, "invalid or missing digest in claim")
+}
```

---

### Incident Patch 4: `95c86b81` (2026-10-01)
**Commit Message**: fix: correct handling of DHCP changing address

This is a bug introduced around 1.10.

We can offer initially previous IP address to keep the lease, but later
in the flow we should request same address as was proposed by the
server.

The second bug was not removing the address on NAK.

Fixes #14519

Signed-off-by: Andrey Smirnov <[REDACTED_EMAIL]>

**File**: `internal/app/machined/pkg/controllers/network/operator/dhcp4.go` (modified, +68/-11)
```diff
@@ -26,10 +26,14 @@ import (
 	"github.com/siderolabs/talos/pkg/machinery/resources/network"
 )
 
+// DHCP4ClientFactory creates a DHCPv4 client for the link.
+type DHCP4ClientFactory func(linkName string, opts ...nclient4.ClientOpt) (*nclient4.Client, error)
+
 // DHCP4 implements the DHCPv4 network operator.
 type DHCP4 struct {
-	logger *zap.Logger
-	state  state.State
+	logger        *zap.Logger
+	state         state.State
+	clientFactory DHCP4ClientFactory
 
 	linkName            string
 	routeMetric         uint32
@@ -50,10 +54,19 @@ type DHCP4 struct {
 }
 
 // NewDHCP4 creates DHCPv4 operator.
-func NewDHCP4(logger *zap.Logger, linkName string, config network.DHCP4OperatorSpec, platform runtime.Platform, state state.State) *DHCP4 {
+//
+// A nil client factory uses the raw sockets on the link.
+func NewDHCP4(
+	logger *zap.Logger, linkName string, config network.DHCP4OperatorSpec, platform runtime.Platform, state state.State, clientFactory DHCP4ClientFactory,
+) *DHCP4 {
+	if clientFactory == nil {
+		clientFactory = nclient4.New
+	}
+
 	return &DHCP4{
 		logger:              logger,
 		state:               state,
+		clientFactory:       clientFactory,
 		linkName:            linkName,
 		routeMetric:         config.RouteMetric,
 		skipHostnameRequest: config.SkipHostnameRequest,
@@ -141,7 +154,10 @@ func (d *DHCP4) waitForNetworkReady(ctx context.Context) error {
 //
 //nolint:gocyclo,cyclop
 func (d *DHCP4) Run(ctx context.Context, notifyCh chan<- struct{}) {
-	const minRenewDuration = 5 * time.Second // Protect from renewing too often
+	const (
+		minRenewDuration = 5 * time.Second  // Protect from renewing too often
+		nakRestartDelay  = 10 * time.Second // RFC 2131, section 3.1: wait a minimum of ten seconds before restarting after a DHCPNAK to avoid excessive network traffic
+	)
 
 	dhcpStartTime := time.Now() // Time when client began address acquisition or renewal process
 	renewInterval := minRenewDuration
@@ -166,23 +182,30 @@ func (d *DHCP4) Run(ctx context.Context, notifyCh chan<- struct{}) {
 			d.logger.Warn("DHCP request/renew failed", zap.Error(err), zap.String("link", d.linkName))
 		}
 
-		if err == nil {
-			// Notify the underlying controller about the new lease
+		nak := isNak(err)
+
+		if err == nil || nak {
+			// Notify the underlying controller about the new lease (or about the rejected one being dropped)
 			if !channel.SendWithContext(ctx, notifyCh, struct{}{}) {
 				return
 			}
 
-			if newLease {
+			if err == nil && newLease {
 				// Wait for networking to be established before transitioning to unicast operations
 				if err = d.waitForNetworkReady(ctx); err != nil && !errors.Is(err, context.Canceled) {
 					d.logger.Warn("failed to wait for networking to become ready", zap.Error(err))
 				}
 			}
 		}
 
-		if leaseTime > 0 {
+		switch {
+		case leaseTime > 0:
 			renewInterval = leaseTime / 2
-		} else {
+		case nak:
+			// RFC 2131, section 3.1: if the client receives a DHCPNAK message, the client restarts the configuration process.
+			renewInterval = nakRestartDelay
+			dhcpStartTime = time.Now()
+		default:
 			renewInterval /= 2
 		}
 
@@ -325,6 +348,20 @@ func (d *DHCP4) parseNetworkConfigFromAck(ack *dhcpv4.DHCPv4, useHostname bool)
 	d.timeservers = specs.TimeServers
 }
 
+// isNak returns true if the error is a DHCPNAK response from the server.
+func isNak(err error) bool {
+	return errors.As(err, new(*nclient4.ErrNak))
+}
+
+// clearAddressConfig drops the leased address and the routes depending on it.
+func (d *DHCP4) clearAddressConfig() {
+	d.mu.Lock()
+	defer d.mu.Unlock()
+
+	d.addresses = nil
+	d.routes = nil
+}
+
 func (d *DHCP4) newClient() (*nclient4.Client, error) {
 	var clientOpts []nclient4.ClientOpt
 
@@ -349,7 +386,7 @@ func (d *DHCP4) newClient() (*nclient4.Client, error) {
 	}
 
 	// Create a new client, the caller is responsible for closing it
-	return nclient4.New(d.linkName, clientOpts...)
+	return d.clientFactory(d.linkName, clientOpts...)
 }
 
 //nolint:gocyclo
@@ -432,10 +469,22 @@ func (d *DHCP4) requestRenew(ctx context.Context, hostname network.HostnameStatu
 
 		d.logger.Debug("DHCP REQUEST with previous IP", zap.String("link", d.linkName), zap.Stringer("previous_ip", previousIPAddress))
 
-		d.lease, err = client.Request(ctx, dhcpv4.PrependModifiers(
+		// The previous IP is only a hint for the DISCOVER (RFC 2131, section 4.4.1),
+		// the REQUEST must carry the address from the OFFER (RFC 2131, section 4.3.2),
+		// so we can't use client.Request, as it applies the modifiers to both messages.
+		var offer *dhcpv4.DHCPv4
+
+		offer, err = client.DiscoverOffer(ctx, dhcpv4.PrependModifiers(
 			mods,
 			dhcpv4.WithOption(dhcpv4.OptRequestedIPAddress(previousIPAddress)),
 		)...)
+		if err != nil {
+			err = fmt.Errorf("unable to receive an offer: %w", err)
+
+			break
+		}
+
+		d.lease, err = client.RequestFromOffer(ctx, offer, mods...)
 	default:
 		d.logger.Debug("DHCP REQUEST", zap.String("link", d.linkName))
 		d.lease, err
```

**File**: `internal/app/machined/pkg/controllers/network/operator/dhcp4_test.go` (added, +302/-0)
```diff
@@ -0,0 +1,302 @@
+// This Source Code Form is subject to the terms of the Mozilla Public
+// License, v. 2.0. If a copy of the MPL was not distributed with this
+// file, You can obtain one at http://mozilla.org/MPL/2.0/.
+
+package operator_test
+
+import (
+	"context"
+	"net"
+	"net/netip"
+	"sync"
+	"testing"
+	"testing/synctest"
+	"time"
+
+	"github.com/cosi-project/runtime/pkg/state"
+	"github.com/cosi-project/runtime/pkg/state/impl/inmem"
+	"github.com/cosi-project/runtime/pkg/state/impl/namespaced"
+	"github.com/insomniacslk/dhcp/dhcpv4"
+	"github.com/insomniacslk/dhcp/dhcpv4/nclient4"
+	"github.com/stretchr/testify/assert"
+	"github.com/stretchr/testify/require"
+	"go.uber.org/zap/zaptest"
+
+	"github.com/siderolabs/talos/internal/app/machined/pkg/controllers/network/operator"
+	"github.com/siderolabs/talos/internal/app/machined/pkg/runtime"
+	"github.com/siderolabs/talos/pkg/machinery/resources/network"
+)
+
+var (
+	dhcpServerID = net.IPv4(192, 168, 50, 1).To4()
+	dhcpFirstIP  = net.IPv4(192, 168, 50, 101).To4()
+	dhcpSecondIP = net.IPv4(192, 168, 50, 150).To4()
+	dhcpHWAddr   = net.HardwareAddr{0x02, 0, 0, 0, 0, 0x01}
+)
+
+// fakeDHCPServer offers the reserved address, ACKs requests for it and NAKs everything else.
+type fakeDHCPServer struct {
+	mu          sync.Mutex
+	reservation net.IP
+	silent      bool
+	naks        int
+	received    []*dhcpv4.DHCPv4
+}
+
+func (srv *fakeDHCPServer) setReservation(ip net.IP) {
+	srv.mu.Lock()
+	defer srv.mu.Unlock()
+
+	srv.reservation = ip
+}
+
+func (srv *fakeDHCPServer) setSilent(silent bool) {
+	srv.mu.Lock()
+	defer srv.mu.Unlock()
+
+	srv.silent = silent
+}
+
+func (srv *fakeDHCPServer) stats() (received []*dhcpv4.DHCPv4, naks int) {
+	srv.mu.Lock()
+	defer srv.mu.Unlock()
+
+	return append([]*dhcpv4.DHCPv4(nil), srv.received...), srv.naks
+}
+
+func (srv *fakeDHCPServer) handle(req *dhcpv4.DHCPv4) *dhcpv4.DHCPv4 {
+	srv.mu.Lock()
+	defer srv.mu.Unlock()
+
+	srv.received = append(srv.received, req)
+
+	if srv.silent {
+		return nil
+	}
+
+	var mods []dhcpv4.Modifier
+
+	switch req.MessageType() { //nolint:exhaustive
+	case dhcpv4.MessageTypeDiscover:
+		mods = append(mods, dhcpv4.WithMessageType(dhcpv4.MessageTypeOffer), dhcpv4.WithYourIP(srv.reservation))
+	case dhcpv4.MessageTypeRequest:
+		requested := req.RequestedIPAddress()
+		if requested == nil { // RENEWING
+			requested = req.ClientIPAddr
+		}
+
+		if requested.Equal(srv.reservation) {
+			mods = append(mods, dhcpv4.WithMessageType(dhcpv4.MessageTypeAck), dhcpv4.WithYourIP(srv.reservation))
+		} else {
+			srv.naks++
+
+			mods = append(mods, dhcpv4.WithMessageType(dhcpv4.MessageTypeNak))
+		}
+	default:
+		return nil
+	}
+
+	resp, err := dhcpv4.NewReplyFromRequest(req, append(
+		mods,
+		dhcpv4.WithServerIP(dhcpServerID),
+		dhcpv4.WithOption(dhcpv4.OptServerIdentifier(dhcpServerID)),
+		dhcpv4.WithOption(dhcpv4.OptSubnetMask(net.CIDRMask(24, 32))),
+		dhcpv4.WithOption(dhcpv4.OptIPAddressLeaseTime(10*time.Minute)),
+		dhcpv4.WithRouter(dhcpServerID),
+	)...)
+	if err != nil {
+		panic(err)
+	}
+
+	return resp
+}
+
+// newClient implements operator.DHCP4ClientFactory.
+//
+// The options (e.g. unicast to the server on renewal) are ignored, as all packets go to the fake server.
+func (srv *fakeDHCPServer) newClient(string, ...nclient4.ClientOpt) (*nclient4.Client, error) {
+	return nclient4.NewWithConn(&fakeDHCPConn{
+		srv:    srv,
+		rx:     make(chan []byte, 16),
+		closed: make(chan struct{}),
+	}, dhcpHWAddr)
+}
+
+// fakeDHCPConn delivers the packets to the fake server in memory, so that it works in a synctest bubble.
+type fakeDHCPConn struct {
+	srv *fakeDHCPServer
+
+	rx        chan []byte
+	closeOnce sync.Once
+	closed    chan struct{}
+}
+
+func (c *fakeDHCPConn) ReadFrom(b []byte) (int, net.Addr, error) {
+	select {
+	case p := <-c.rx:
+		return copy(b, p), &net.UDPAddr{IP: dhcpServerID, Port: nclient4.ServerPort}, nil
+	case <-c.closed:
+		return 0, nil, net.ErrClosed
+	}
+}
+
+func (c *fakeDHCPConn) WriteTo(b []byte, _ net.Addr) (int, error) {
+	req, err := dhcpv4.FromBytes(b)
+	if err != nil {
+		return 0, err
+	}
+
+	if resp := c.srv.handle(req); resp != nil {
+		c.rx <- resp.ToBytes()
+	}
+
+	return len(b), nil
+}
+
+func (c *fakeDHCPConn) Close() error {
+	c.closeOnce.Do(func() { close(c.closed) })
+
+	return nil
+}
+
+func (c *fakeDHCPConn) LocalAddr() net.Addr {
+	return &net.UDPAddr{IP: net.IPv4zero, Port: nclient4.ClientPort}
+}
+
+func (c *fakeDHCPConn) SetDeadline(time.Time) error      { return nil }
+func (c *fakeDHCPConn) SetReadDeadline(time.Time) error  { return nil }
+func (c *fakeDHCPConn) SetWriteDeadline(time.Time) error { return nil }
+
+type testPlatform struct {
+	runtime.Platform
+}
+
+func (testPlatform) Name() string { return "metal" }
+
+// runDHCP4 runs the operator against the fake server, and reports the network as ready for the given addresses.
+func runDHCP4(t *testing.T, srv *fakeDHCPServer, readyAddresses ...string) (*operator.DHCP4, <-chan st
```

**File**: `internal/app/machined/pkg/controllers/network/operator_spec.go` (modified, +1/-1)
```diff
@@ -422,7 +422,7 @@ func (ctrl *OperatorSpecController) newOperator(logger *zap.Logger, spec *networ
 	case network.OperatorDHCP4:
 		logger = logger.With(zap.String("operator", "dhcp4"))
 
-		return operator.NewDHCP4(logger, spec.LinkName, spec.DHCP4, ctrl.V1alpha1Platform, ctrl.State)
+		return operator.NewDHCP4(logger, spec.LinkName, spec.DHCP4, ctrl.V1alpha1Platform, ctrl.State, nil)
 	case network.OperatorDHCP6:
 		logger = logger.With(zap.String("operator", "dhcp6"))
 
```

---

### Incident Patch 5: `e1386c60` (2026-10-01)
**Commit Message**: fix: image verification test

`registry.k8s.io` enabled referrers api, so legacy verification path is
not used anymore.

Signed-off-by: Noel Georgi <[REDACTED_EMAIL]>

**File**: `internal/integration/api/images.go` (modified, +1/-1)
```diff
@@ -287,12 +287,12 @@ func (suite *ImagesSuite) TestVerify() {
 	const etcdImage = constants.EtcdImage + ":" + constants.DefaultEtcdVersion
 
 	// run the tests, first with an etcd image, which should be in the image cache anyways
+	// Check verification, not the message: the registry may serve legacy signatures or OCI referrer bundles.
 	resp, err := suite.Client.ImageClient.Verify(ctx, &machine.ImageServiceVerifyRequest{
 		ImageRef: etcdImage, // this image is under registry.k8s.io
 	})
 	suite.Require().NoError(err)
 	suite.Assert().True(resp.GetVerified(), "expected image to be verified according to our config")
-	suite.Assert().Equal("verified via legacy signature (bundle verified true)", resp.GetMessage())
 	suite.Assert().Contains(resp.GetDigestedImageRef(), constants.EtcdImage)
 	suite.Assert().Contains(resp.GetDigestedImageRef(), "@sha256:")
 
```

---

### Incident Patch 6: `87e039ea` (2026-10-01)
**Commit Message**: fix: make GenerateClientConfiguration API work in K8s-less mode

Skip building nice cluster name if we don't have K8sClusterConfig.

This fixes impersonation tests in hypervisor mode.

Signed-off-by: Andrey Smirnov <[REDACTED_EMAIL]>

**File**: `internal/app/machined/internal/server/v1alpha1/v1alpha1_server.go` (modified, +5/-5)
```diff
@@ -2418,13 +2418,13 @@ func (s *Server) GenerateClientConfiguration(ctx context.Context, in *machine.Ge
 		return nil, err
 	}
 
-	// make a nice context name
-	k8sClusterConfig := s.Controller.Runtime().Config().K8sClusterConfig()
-	if k8sClusterConfig == nil {
-		return nil, status.Error(codes.FailedPrecondition, "cluster name and endpoint are not configured (.cluster.controlPlane.endpoint or KubeClusterConfig document)")
+	// make a nice context name if we have cluster config
+	contextName := "talos"
+
+	if k8sClusterConfig := s.Controller.Runtime().Config().K8sClusterConfig(); k8sClusterConfig != nil {
+		contextName = k8sClusterConfig.ClusterName()
 	}
 
-	contextName := k8sClusterConfig.ClusterName()
 	if r := roles.Strings(); len(r) == 1 {
 		contextName = strings.TrimPrefix(r[0], role.Prefix) + "@" + contextName
 	}
```

**File**: `internal/integration/api/apid.go` (modified, +0/-8)
```diff
@@ -277,10 +277,6 @@ func (suite *ApidSuite) TestPKIMismatch() {
 // TestImpersonationWithoutRole verifies that the impersonation header is rejected when the client
 // doesn't have os:impersonator role, whatever roles the client has otherwise.
 func (suite *ApidSuite) TestImpersonationWithoutRole() {
-	if !suite.Capabilities().SupportsKubernetes {
-		suite.T().Skip("cluster doesn't run Kubernetes")
-	}
-
 	nodes := suite.DiscoverNodeInternalIPs(suite.ctx)
 	cpNode := suite.RandomDiscoveredNodeInternalIP(machine.TypeControlPlane)
 
@@ -335,10 +331,6 @@ func (suite *ApidSuite) TestImpersonationWithoutRole() {
 // TestImpersonation verifies that a client with os:impersonator role can impersonate any role via the impersonation header,
 // and that the impersonated roles are what gets authorized, including when the request is proxied between apid instances.
 func (suite *ApidSuite) TestImpersonation() {
-	if !suite.Capabilities().SupportsKubernetes {
-		suite.T().Skip("cluster doesn't run Kubernetes")
-	}
-
 	nodes := suite.DiscoverNodeInternalIPs(suite.ctx)
 	cpCtx := client.WithNode(suite.ctx, suite.RandomDiscoveredNodeInternalIP(machine.TypeControlPlane))
 
```

---

### Incident Patch 7: `a003bd22` (2026-09-30)
**Commit Message**: fix: restore source names for pseudo filesystem mounts

The fsopen migration omitted source names for /dev, /proc and /sys,
causing the kernel to report "none" in mountinfo.

Fix all pseudo mounts.

Signed-off-by: Alexander Soelberg Heidarsson <[REDACTED_EMAIL]>
Signed-off-by: Andrey Smirnov <[REDACTED_EMAIL]>

**File**: `internal/integration/api/mounts.go` (modified, +36/-0)
```diff
@@ -241,6 +241,42 @@ func (suite *MountsSuite) TestEphemeralExecPolicy() {
 	}
 }
 
+// TestPseudoMountSources asserts Talos-created pseudo filesystems report a meaningful source
+// (and not "none") in mountinfo.
+func (suite *MountsSuite) TestPseudoMountSources() {
+	expected := map[string]string{
+		"/dev":                    "devtmpfs",
+		"/proc":                   "proc",
+		"/sys":                    "sysfs",
+		"/run":                    "tmpfs",
+		"/system":                 "tmpfs",
+		"/tmp":                    "tmpfs",
+		"/dev/shm":                "devshm",
+		"/dev/pts":                "devpts",
+		"/dev/hugepages":          "hugetlb",
+		"/sys/fs/bpf":             "bpf",
+		constants.CgroupMountPath: "cgroup",
+	}
+
+	for _, node := range suite.DiscoverNodeInternalIPs(suite.ctx) {
+		suite.Run(node, func() {
+			found := map[string]string{}
+
+			for _, m := range suite.readMountInfo(node) {
+				if _, ok := expected[m.mountPoint]; ok {
+					if _, seen := found[m.mountPoint]; !seen {
+						found[m.mountPoint] = m.source
+					}
+				}
+			}
+
+			for mountPoint, source := range expected {
+				suite.Assert().Equal(source, found[mountPoint], "unexpected source for %q", mountPoint)
+			}
+		})
+	}
+}
+
 func (suite *MountsSuite) runPolicy(opt string, exempt func(mountInfo) bool, rationale string) {
 	for _, node := range suite.DiscoverNodeInternalIPs(suite.ctx) {
 		suite.Run(node, func() {
```

**File**: `internal/pkg/mount/v3/helpers.go` (modified, +4/-3)
```diff
@@ -35,6 +35,7 @@ func NewCgroup2() *Manager {
 		WithMountAttributes(unix.MOUNT_ATTR_RELATIME),
 		WithFsopen(
 			"cgroup2",
+			fsopen.WithSource("cgroup"),
 			fsopen.WithBoolParameter("nsdelegate"),
 			fsopen.WithBoolParameter("memory_recursiveprot"),
 		),
@@ -356,7 +357,7 @@ func PseudoSub(printer func(string, ...any)) Managers {
 			WithSecure(),
 			WithNoExec(),
 			WithMountAttributes(unix.MOUNT_ATTR_RELATIME),
-			WithFsopen("tmpfs"),
+			WithFsopen("tmpfs", fsopen.WithSource("devshm")),
 		),
 		newManager(
 			always,
@@ -375,7 +376,7 @@ func PseudoSub(printer func(string, ...any)) Managers {
 			WithPrinter(printer),
 			WithMountAttributes(unix.MOUNT_ATTR_NOSUID|unix.MOUNT_ATTR_NODEV),
 			WithTarget("/dev/hugepages"),
-			WithFsopen("hugetlbfs"),
+			WithFsopen("hugetlbfs", fsopen.WithSource("hugetlb")),
 		),
 		newManager(
 			always,
@@ -438,7 +439,7 @@ func PseudoSub(printer func(string, ...any)) Managers {
 			WithNoExec(),
 			WithReadOnly(),
 			WithMountAttributes(unix.MOUNT_ATTR_RELATIME),
-			WithFsopen("efivarfs"),
+			WithFsopen("efivarfs", fsopen.WithSource("efivars")),
 		),
 	)
 }
```

**File**: `internal/pkg/mount/v3/point.go` (modified, +4/-1)
```diff
@@ -10,6 +10,7 @@ import (
 	"errors"
 	"fmt"
 	"os"
+	"path/filepath"
 	"strings"
 	"syscall"
 	"time"
@@ -249,7 +250,9 @@ func (p *Point) retry(f func() error, isUnmount bool) error {
 func (p *Point) moveMount(target string) error {
 	fd, err := p.root.Fd()
 	if err != nil {
-		if p.Source() != "" {
+		// fall back to moving the mount by path, but only if the source is a path
+		// (pseudo filesystems have sources like "tmpfs" or "cgroup")
+		if filepath.IsAbs(p.Source()) {
 			if err := unix.MoveMount(unix.AT_FDCWD, p.Source(), unix.AT_FDCWD, target, 0); err != nil {
 				return fmt.Errorf("error moving mount from %q to %q: %w", p.Source(), target, err)
 			}
```

**File**: `pkg/xfs/fsopen/fsopen_linux.go` (modified, +7/-4)
```diff
@@ -9,6 +9,7 @@
 package fsopen
 
 import (
+	"cmp"
 	"context"
 	"errors"
 	"fmt"
@@ -111,10 +112,12 @@ func (fs *FS) new() (err error) {
 		}
 	}()
 
-	if fs.source != "" {
-		if err := unix.FsconfigSetString(fsfd, "source", fs.source); err != nil {
-			return fmt.Errorf("FSCONFIG_SET_STRING failed: %w: key=%q value=%q", err, "source", fs.source)
-		}
+	// default the source to the filesystem type (as `mount -t tmpfs tmpfs` does),
+	// otherwise the kernel reports the source as "none"
+	source := cmp.Or(fs.source, fs.fstype)
+
+	if err := unix.FsconfigSetString(fsfd, "source", source); err != nil {
+		return fmt.Errorf("FSCONFIG_SET_STRING failed: %w: key=%q value=%q", err, "source", source)
 	}
 
 	for key := range fs.boolParams {
```

---

### Incident Patch 8: `b3736b9a` (2026-09-30)
**Commit Message**: fix: network on azure (and might fix some other platforms)

Don't run the default Talos DHCP/link-up flow on the links which have
been enslaved already (by the kernel).

Fixes #14494

Talos skips auto-configuration if any network config was supplied, but
with platforms (like Azure) the platform does some configuration, but
unconfigured links might actually require default DHCP, we can't stop
doing DHCP for platforms in general.

So we pick a different path - we ignore links which are enslaved:

* if Talos enslaved it, Talos will stop configuring it anyways
* if it was enslaved outside of Talos, there is no reason to run DHCP on
  it anyways (in Azure case, kernel enslaves it)

Signed-off-by: Andrey Smirnov <[REDACTED_EMAIL]>

**File**: `internal/app/machined/pkg/controllers/network/link_config.go` (modified, +3/-1)
```diff
@@ -189,7 +189,9 @@ func (ctrl *LinkConfigController) Run(ctx context.Context, r controller.Runtime,
 					}
 				}
 
-				if linkStatus.TypedSpec().Physical() {
+				// skip links which are already enslaved (e.g. by the kernel, like Azure accelerated networking VF enslaved to netvsc),
+				// as default link spec would try to unslave them
+				if linkStatus.TypedSpec().Physical() && linkStatus.TypedSpec().MasterIndex == 0 {
 					if err = ctrl.apply(ctx, r, []network.LinkSpecSpec{
 						{
 							Name:        linkStatus.Metadata().ID(),
```

**File**: `internal/app/machined/pkg/controllers/network/link_config_test.go` (modified, +7/-1)
```diff
@@ -909,7 +909,7 @@ func (suite *LinkConfigSuite) TestDefaultUp() {
 		),
 	)
 
-	for _, link := range []string{"eth5", "eth1", "eth2", "eth3", "eth4"} {
+	for _, link := range []string{"eth5", "eth1", "eth2", "eth3", "eth4", "eth6"} {
 		linkStatus := network.NewLinkStatus(network.NamespaceName, link)
 		linkStatus.TypedSpec().Type = nethelpers.LinkEther
 		linkStatus.TypedSpec().LinkState = true
@@ -918,6 +918,11 @@ func (suite *LinkConfigSuite) TestDefaultUp() {
 			linkStatus.TypedSpec().AltNames = []string{"enp0s2"}
 		}
 
+		if link == "eth6" {
+			// enslaved by the kernel (e.g. Azure accelerated networking VF)
+			linkStatus.TypedSpec().MasterIndex = 1
+		}
+
 		suite.Create(linkStatus)
 	}
 
@@ -988,6 +993,7 @@ func (suite *LinkConfigSuite) TestDefaultUp() {
 			"default/eth2",
 			"default/eth3",
 			"default/eth4",
+			"default/eth6",
 		},
 	)
 }
```

**File**: `internal/app/machined/pkg/controllers/network/operator_config.go` (modified, +2/-1)
```diff
@@ -316,7 +316,8 @@ func (ctrl *OperatorConfigController) Run(ctx context.Context, r controller.Runt
 
 			// operators from defaults
 			for linkStatus := range linkStatuses.All() {
-				if linkStatus.TypedSpec().Physical() {
+				// skip links which are already enslaved (e.g. by the kernel, like Azure accelerated networking VF enslaved to netvsc)
+				if linkStatus.TypedSpec().Physical() && linkStatus.TypedSpec().MasterIndex == 0 {
 					if _, configured := configuredInterfaces[linkStatus.Metadata().ID()]; !configured {
 						if _, ignored := ignoredInterfaces[linkStatus.Metadata().ID()]; !ignored {
 							// enable DHCPv4 operator on physical interfaces which don't have any explicit configuration and are not ignored
```

**File**: `internal/app/machined/pkg/controllers/network/operator_config_test.go` (modified, +13/-1)
```diff
@@ -50,11 +50,16 @@ func (suite *OperatorConfigSuite) TestDefaultDHCP() {
 		),
 	)
 
-	for _, link := range []string{"eth0", "eth1", "eth2"} {
+	for _, link := range []string{"eth0", "eth1", "eth2", "eth3"} {
 		linkStatus := network.NewLinkStatus(network.NamespaceName, link)
 		linkStatus.TypedSpec().Type = nethelpers.LinkEther
 		linkStatus.TypedSpec().LinkState = true
 
+		if link == "eth3" {
+			// enslaved by the kernel (e.g. Azure accelerated networking VF)
+			linkStatus.TypedSpec().MasterIndex = 1
+		}
+
 		suite.Create(linkStatus)
 	}
 
@@ -75,6 +80,13 @@ func (suite *OperatorConfigSuite) TestDefaultDHCP() {
 			}
 		},
 	)
+
+	suite.assertNoOperators(
+		[]string{
+			"default/dhcp4/eth2",
+			"default/dhcp4/eth3",
+		},
+	)
 }
 
 func (suite *OperatorConfigSuite) TestLLDPPhysicalLinksOnly() {
```

---

### Incident Patch 9: `41e63cb2` (2026-10-01)
**Commit Message**: fix: skip impersonation tests without Kubernetes

Gate both impersonation tests on the existing Kubernetes capability.
Keep the original client configuration and authorization assertions
unchanged for Kubernetes-enabled clusters.

Signed-off-by: Mateusz Urbanek <[REDACTED_EMAIL]>

**File**: `internal/integration/api/apid.go` (modified, +8/-0)
```diff
@@ -277,6 +277,10 @@ func (suite *ApidSuite) TestPKIMismatch() {
 // TestImpersonationWithoutRole verifies that the impersonation header is rejected when the client
 // doesn't have os:impersonator role, whatever roles the client has otherwise.
 func (suite *ApidSuite) TestImpersonationWithoutRole() {
+	if !suite.Capabilities().SupportsKubernetes {
+		suite.T().Skip("cluster doesn't run Kubernetes")
+	}
+
 	nodes := suite.DiscoverNodeInternalIPs(suite.ctx)
 	cpNode := suite.RandomDiscoveredNodeInternalIP(machine.TypeControlPlane)
 
@@ -331,6 +335,10 @@ func (suite *ApidSuite) TestImpersonationWithoutRole() {
 // TestImpersonation verifies that a client with os:impersonator role can impersonate any role via the impersonation header,
 // and that the impersonated roles are what gets authorized, including when the request is proxied between apid instances.
 func (suite *ApidSuite) TestImpersonation() {
+	if !suite.Capabilities().SupportsKubernetes {
+		suite.T().Skip("cluster doesn't run Kubernetes")
+	}
+
 	nodes := suite.DiscoverNodeInternalIPs(suite.ctx)
 	cpCtx := client.WithNode(suite.ctx, suite.RandomDiscoveredNodeInternalIP(machine.TypeControlPlane))
 
```

---

### Incident Patch 10: `ef5bdc8d` (2026-09-30)
**Commit Message**: fix: gate libvirt dial on virtqemud readiness

Controllers dialed libvirt before ext-virtqemud was up, failing and
backing off repeatedly at boot.

- VirtualMachineController skips reconcile until virtqemud service is
  running and healthy
- VirtualMachineDomainStatusController opens the libvirt session only
  once virtqemud is ready, tears it down when it goes away, and marks
  existing domain statuses Unknown with an error reason instead of
  leaving stale power state

Signed-off-by: Mateusz Urbanek <[REDACTED_EMAIL]>

**File**: `internal/app/machined/pkg/controllers/hypervisor/virtual_machine.go` (modified, +35/-1)
```diff
@@ -12,6 +12,7 @@ import (
 	"github.com/cosi-project/runtime/pkg/controller"
 	"github.com/cosi-project/runtime/pkg/resource"
 	"github.com/cosi-project/runtime/pkg/safe"
+	"github.com/cosi-project/runtime/pkg/state"
 	"github.com/google/uuid"
 	"github.com/siderolabs/gen/optional"
 	"go.uber.org/zap"
@@ -20,8 +21,11 @@ import (
 	libvirtdomain "github.com/siderolabs/talos/internal/pkg/libvirt/domain"
 	"github.com/siderolabs/talos/pkg/machinery/resources/hardware"
 	"github.com/siderolabs/talos/pkg/machinery/resources/hypervisor"
+	"github.com/siderolabs/talos/pkg/machinery/resources/v1alpha1"
 )
 
+const virtqemudServiceID = "ext-virtqemud"
+
 // VirtualMachineController reconciles running transient domains with virtqemud.
 type VirtualMachineController struct {
 	V1Alpha1Mode machineruntime.Mode
@@ -52,6 +56,12 @@ func (ctrl *VirtualMachineController) Inputs() []controller.Input {
 			Type:      hypervisor.VirtualMachineDomainStatusType,
 			Kind:      controller.InputWeak,
 		},
+		{
+			Namespace: v1alpha1.NamespaceName,
+			Type:      v1alpha1.ServiceType,
+			ID:        optional.Some(virtqemudServiceID),
+			Kind:      controller.InputWeak,
+		},
 	}
 }
 
@@ -73,14 +83,38 @@ func (ctrl *VirtualMachineController) Run(ctx context.Context, runtime controlle
 		case <-runtime.EventCh():
 		}
 
-		if err := ctrl.reconcile(ctx, runtime); err != nil {
+		ready, err := virtqemudReady(ctx, runtime)
+		if err != nil {
+			return err
+		}
+
+		if !ready {
+			runtime.ResetRestartBackoff()
+
+			continue
+		}
+
+		if err = ctrl.reconcile(ctx, runtime); err != nil {
 			return err
 		}
 
 		runtime.ResetRestartBackoff()
 	}
 }
 
+func virtqemudReady(ctx context.Context, runtime controller.Runtime) (bool, error) {
+	service, err := safe.ReaderGetByID[*v1alpha1.Service](ctx, runtime, virtqemudServiceID)
+	if err != nil {
+		if state.IsNotFoundError(err) {
+			return false, nil
+		}
+
+		return false, fmt.Errorf("get %q service: %w", virtqemudServiceID, err)
+	}
+
+	return service.TypedSpec().Running && (service.TypedSpec().Healthy || service.TypedSpec().Unknown), nil
+}
+
 func (ctrl *VirtualMachineController) reconcile(ctx context.Context, runtime controller.Runtime) error {
 	specs, err := safe.ReaderListAll[*hypervisor.VirtualMachineDomainSpec](ctx, runtime)
 	if err != nil {
```

**File**: `internal/app/machined/pkg/controllers/hypervisor/virtual_machine_domain_status.go` (modified, +171/-29)
```diff
@@ -12,31 +12,69 @@ import (
 	"github.com/cosi-project/runtime/pkg/controller"
 	"github.com/cosi-project/runtime/pkg/safe"
 	libvirt "github.com/digitalocean/go-libvirt"
+	"github.com/siderolabs/gen/optional"
 	"go.uber.org/zap"
 
 	machineruntime "github.com/siderolabs/talos/internal/app/machined/pkg/runtime"
 	libvirtdomain "github.com/siderolabs/talos/internal/pkg/libvirt/domain"
 	"github.com/siderolabs/talos/pkg/machinery/resources/hypervisor"
+	"github.com/siderolabs/talos/pkg/machinery/resources/v1alpha1"
 )
 
+const virtqemudNotReadyError = "virtqemud service is not ready"
+
 // VirtualMachineDomainStatusController inventories all libvirt domains, regardless of Talos ownership.
 type VirtualMachineDomainStatusController struct {
 	V1Alpha1Mode machineruntime.Mode
 	Open         func(context.Context) (libvirtdomain.Client, error)
 	Watch        func(context.Context) (<-chan struct{}, error)
 }
 
+type domainObservationSession struct {
+	client      libvirtdomain.Client
+	cancelWatch context.CancelFunc
+	events      <-chan struct{}
+}
+
+func (session *domainObservationSession) close() {
+	if session.cancelWatch != nil {
+		session.cancelWatch()
+		session.cancelWatch = nil
+	}
+
+	if session.client != nil {
+		session.client.Close()
+		session.client = nil
+	}
+
+	session.events = nil
+}
+
 // Name implements controller.Controller.
 func (*VirtualMachineDomainStatusController) Name() string {
 	return "hypervisor.VirtualMachineDomainStatusController"
 }
 
 // Inputs implements controller.Controller.
-func (*VirtualMachineDomainStatusController) Inputs() []controller.Input { return nil }
+func (*VirtualMachineDomainStatusController) Inputs() []controller.Input {
+	return []controller.Input{
+		{
+			Namespace: v1alpha1.NamespaceName,
+			Type:      v1alpha1.ServiceType,
+			ID:        optional.Some(virtqemudServiceID),
+			Kind:      controller.InputWeak,
+		},
+	}
+}
 
 // Outputs implements controller.Controller.
 func (*VirtualMachineDomainStatusController) Outputs() []controller.Output {
-	return []controller.Output{{Type: hypervisor.VirtualMachineDomainStatusType, Kind: controller.OutputExclusive}}
+	return []controller.Output{
+		{
+			Type: hypervisor.VirtualMachineDomainStatusType,
+			Kind: controller.OutputExclusive,
+		},
+	}
 }
 
 // Run implements controller.Controller.
@@ -45,53 +83,157 @@ func (ctrl *VirtualMachineDomainStatusController) Run(ctx context.Context, runti
 		return nil
 	}
 
+	var session domainObservationSession
+	defer session.close()
+
+	for {
+		select {
+		case <-ctx.Done():
+			return nil
+		case <-runtime.EventCh():
+			if err := ctrl.handleServiceEvent(ctx, runtime, &session); err != nil {
+				return err
+			}
+		case _, ok := <-session.events:
+			if err := ctrl.handleWatchEvent(ctx, runtime, &session, ok); err != nil {
+				if ctx.Err() != nil {
+					return nil
+				}
+
+				return err
+			}
+		}
+
+		runtime.ResetRestartBackoff()
+	}
+}
+
+func (ctrl *VirtualMachineDomainStatusController) handleServiceEvent(
+	ctx context.Context,
+	runtime controller.Runtime,
+	session *domainObservationSession,
+) error {
+	ready, err := virtqemudReady(ctx, runtime)
+	if err != nil {
+		return err
+	}
+
+	if !ready {
+		session.close()
+
+		return ctrl.markUnavailable(ctx, runtime, virtqemudNotReadyError)
+	}
+
+	if session.client != nil {
+		return nil
+	}
+
+	return ctrl.openSession(ctx, runtime, session)
+}
+
+func (ctrl *VirtualMachineDomainStatusController) openSession(
+	ctx context.Context,
+	runtime controller.Runtime,
+	session *domainObservationSession,
+) error {
 	watchCtx, cancel := context.WithCancel(ctx)
-	defer cancel()
 
 	events, err := ctrl.Watch(watchCtx)
 	if err != nil {
-		return fmt.Errorf("watch libvirt domains: %w", err)
+		cancel()
+
+		return ctrl.observationError(ctx, runtime, fmt.Errorf("watch libvirt domains: %w", err))
 	}
 
-	client, err := ctrl.Open(ctx)
+	session.cancelWatch = cancel
+	session.events = events
+
+	session.client, err = ctrl.Open(ctx)
 	if err != nil {
-		return fmt.Errorf("open libvirt: %w", err)
+		session.close()
+
+		return ctrl.observationError(ctx, runtime, fmt.Errorf("open libvirt: %w", err))
 	}
-	defer client.Close()
 
 	// The watch is registered before the first inventory. Events arriving during
 	// the inventory remain queued and cause a follow-up scan.
-	if err = ctrl.reconcile(ctx, runtime, client); err != nil {
+	if err = ctrl.reconcile(ctx, runtime, session.client); err != nil {
+		session.close()
+
+		return ctrl.observationError(ctx, runtime, err)
+	}
+
+	return nil
+}
+
+func (ctrl *VirtualMachineDomainStatusController) handleWatchEvent(
+	ctx context.Context,
+	runtime controller.Runtime,
+	session *domainObservationSession,
+	watchOpen bool,
+) error {
+	if watchOpen {
+		if err := ctrl.reconcile(ctx, runtime, session.client); err != nil {
+			session.close()
+
+			return ctrl.observationError(ctx, runtime, err)
+		}
+
+		return nil
+	}
+
+	session.close()
+
+	if ctx.Err() != nil {
+		return ctx.Err()
+
```

**File**: `internal/app/machined/pkg/controllers/hypervisor/virtual_machine_status.go` (modified, +24/-5)
```diff
@@ -36,17 +36,36 @@ func (*VirtualMachineStatusController) Name() string {
 // Inputs implements controller.Controller.
 func (*VirtualMachineStatusController) Inputs() []controller.Input {
 	return []controller.Input{
-		{Namespace: hypervisor.NamespaceName, Type: hypervisor.VirtualMachineSpecType, Kind: controller.InputWeak},
-		{Namespace: hypervisor.NamespaceName, Type: hypervisor.VirtualMachineDomainStatusType, Kind: controller.InputWeak},
-		{Namespace: hardware.NamespaceName, Type: hardware.SystemInformationType, Kind: controller.InputWeak},
-		{Namespace: network.NamespaceName, Type: network.LinkStatusType, Kind: controller.InputWeak},
+		{
+			Namespace: hypervisor.NamespaceName,
+			Type:      hypervisor.VirtualMachineSpecType,
+			Kind:      controller.InputWeak,
+		},
+		{
+			Namespace: hypervisor.NamespaceName,
+			Type:      hypervisor.VirtualMachineDomainStatusType,
+			Kind:      controller.InputWeak,
+		},
+		{
+			Namespace: hardware.NamespaceName,
+			Type:      hardware.SystemInformationType,
+			Kind:      controller.InputWeak,
+		},
+		{
+			Namespace: network.NamespaceName,
+			Type:      network.LinkStatusType,
+			Kind:      controller.InputWeak,
+		},
 	}
 }
 
 // Outputs implements controller.Controller.
 func (*VirtualMachineStatusController) Outputs() []controller.Output {
 	return []controller.Output{
-		{Type: hypervisor.VirtualMachineStatusType, Kind: controller.OutputExclusive},
+		{
+			Type: hypervisor.VirtualMachineStatusType,
+			Kind: controller.OutputExclusive,
+		},
 	}
 }
 
```

**File**: `internal/app/machined/pkg/controllers/hypervisor/virtual_machine_status_test.go` (modified, +138/-5)
```diff
@@ -22,6 +22,7 @@ import (
 	"github.com/siderolabs/talos/pkg/machinery/resources/hardware"
 	"github.com/siderolabs/talos/pkg/machinery/resources/hypervisor"
 	"github.com/siderolabs/talos/pkg/machinery/resources/network"
+	"github.com/siderolabs/talos/pkg/machinery/resources/v1alpha1"
 )
 
 type openFailure struct{ err error }
@@ -52,6 +53,7 @@ func (s *VirtualMachineStatusSuite) SetupTest() {
 	machine := hardware.NewSystemInformation(hardware.SystemInformationID)
 	machine.TypedSpec().UUID = machineUUID
 	s.Create(machine)
+	s.Create(newReadyVirtqemudService())
 }
 
 func TestVirtualMachineStatusSuite(t *testing.T) {
@@ -109,6 +111,140 @@ func (s *VirtualMachineStatusSuite) TestLifecycleEventRefreshesUnmanagedDomainWi
 	s.Require().EqualValues(1, s.opens.Load(), "lifecycle events must reuse the startup inventory session")
 }
 
+func (s *VirtualMachineStatusSuite) registerReadinessObserver(
+	watchCanceled chan<- struct{},
+	subscriptions *atomic.Int32,
+) {
+	s.Require().NoError(s.Runtime().RegisterController(&hypervisorctrl.VirtualMachineDomainStatusController{
+		Open: func(ctx context.Context) (libvirtdomain.Client, error) {
+			if subscriptions.Load() == 0 {
+				return nil, errors.New("watch was not registered before open")
+			}
+
+			return s.open(ctx)
+		},
+		Watch: func(ctx context.Context) (<-chan struct{}, error) {
+			subscriptions.Add(1)
+
+			events := make(chan struct{}, 1)
+
+			go func() {
+				<-ctx.Done()
+
+				watchCanceled <- struct{}{}
+			}()
+
+			return events, nil
+		},
+	}))
+}
+
+func (s *VirtualMachineStatusSuite) assertObserverIdle(subscriptions *atomic.Int32) {
+	s.Require().Never(func() bool {
+		return subscriptions.Load() != 0 || s.opens.Load() != 0
+	}, 100*time.Millisecond, 10*time.Millisecond)
+}
+
+func (s *VirtualMachineStatusSuite) assertWatchCanceled(watchCanceled <-chan struct{}) {
+	s.Require().Eventually(func() bool {
+		select {
+		case <-watchCanceled:
+			return true
+		default:
+			return false
+		}
+	}, 5*time.Second, 10*time.Millisecond)
+}
+
+func (s *VirtualMachineStatusSuite) assertClientCloseCount(expected int) {
+	s.Require().Eventually(func() bool {
+		s.client.mu.Lock()
+		defer s.client.mu.Unlock()
+
+		return s.client.closes == expected
+	}, 5*time.Second, 10*time.Millisecond)
+}
+
+func (s *VirtualMachineStatusSuite) assertDomainObservation(
+	name string,
+	powerState hypervisor.VirtualMachinePowerState,
+	errorText string,
+) {
+	s.Require().Eventually(func() bool {
+		status, err := safe.StateGetByID[*hypervisor.VirtualMachineDomainStatus](s.Ctx(), s.State(), name)
+		if err != nil {
+			return false
+		}
+
+		return status.TypedSpec().PowerState == powerState && status.TypedSpec().Error == errorText
+	}, 5*time.Second, 10*time.Millisecond)
+}
+
+func (s *VirtualMachineStatusSuite) assertManagedStatusUnavailable(name string) {
+	s.Require().Eventually(func() bool {
+		domainStatus, domainErr := safe.StateGetByID[*hypervisor.VirtualMachineDomainStatus](s.Ctx(), s.State(), name)
+		if domainErr != nil {
+			return false
+		}
+
+		status, statusErr := safe.StateGetByID[*hypervisor.VirtualMachineStatus](s.Ctx(), s.State(), name)
+		if statusErr != nil {
+			return false
+		}
+
+		return domainStatus.TypedSpec().UUID == libvirtdomain.UUID(uuid.MustParse(machineUUID), name).String() &&
+			domainStatus.TypedSpec().PowerState == hypervisor.VirtualMachinePowerStateUnknown &&
+			domainStatus.TypedSpec().Error != "" &&
+			status.TypedSpec().PowerState == hypervisor.VirtualMachinePowerStateUnknown &&
+			status.TypedSpec().Stage == hypervisor.VirtualMachineStageError && status.TypedSpec().Error != ""
+	}, 5*time.Second, 10*time.Millisecond)
+}
+
+func (s *VirtualMachineStatusSuite) TestServiceReadinessControlsObserverLifecycle() {
+	service, err := safe.StateGetByID[*v1alpha1.Service](s.Ctx(), s.State(), virtqemudServiceID)
+	s.Require().NoError(err)
+	s.Destroy(service)
+
+	domain := libvirtdomain.Domain{Name: "gated", UUID: uuid.New()}
+	s.client.domains[domain.Name] = domain
+
+	watchCanceled := make(chan struct{}, 3)
+
+	var subscriptions atomic.Int32
+
+	s.registerReadinessObserver(watchCanceled, &subscriptions)
+	s.assertObserverIdle(&subscriptions)
+
+	starting := v1alpha1.NewService(virtqemudServiceID)
+	starting.TypedSpec().Unknown = true
+	s.Create(starting)
+	s.assertObserverIdle(&subscriptions)
+
+	ctest.UpdateWithConflicts(s, starting, func(resource *v1alpha1.Service) error {
+		resource.TypedSpec().Running = true
+
+		return nil
+	})
+	s.assertDomainObservation(domain.Name, hypervisor.VirtualMachinePowerStateRunning, "")
+	s.Require().EqualValues(1, subscriptions.Load())
+	s.Require().EqualValues(1, s.opens.Load())
+
+	s.Destroy(starting)
+	s.assertWatchCanceled(watchCanceled)
+	s.assertClientCloseCount(1)
+	s.assertDomainObservation(domain.Name, hypervisor.VirtualMachinePowerStateUnknown, "virtqemud service is not ready")
+
+	s.Create(newReadyVirtqemudService())
+	s.assertDomainObservation(domain.Name, hypervisor.VirtualMachinePowerS
```

**File**: `internal/app/machined/pkg/controllers/hypervisor/virtual_machine_test.go` (modified, +101/-3)
```diff
@@ -23,15 +23,21 @@ import (
 	libvirtdomain "github.com/siderolabs/talos/internal/pkg/libvirt/domain"
 	"github.com/siderolabs/talos/pkg/machinery/resources/hardware"
 	"github.com/siderolabs/talos/pkg/machinery/resources/hypervisor"
+	"github.com/siderolabs/talos/pkg/machinery/resources/v1alpha1"
 )
 
-const machineUUID = "c737f778-82a1-48dd-990b-67901031bcc5"
+const (
+	machineUUID        = "c737f778-82a1-48dd-990b-67901031bcc5"
+	virtqemudServiceID = "ext-virtqemud"
+)
 
 type domainClient struct {
 	mu              sync.Mutex
 	domains         map[string]libvirtdomain.Domain
 	texts           map[string]string
 	starts          map[string]int
+	opens           int
+	closes          int
 	removeErr       error
 	listErr         error
 	changed         chan struct{}
@@ -40,8 +46,21 @@ type domainClient struct {
 	listed          chan struct{}
 }
 
-func (c *domainClient) open(context.Context) (libvirtdomain.Client, error) { return c, nil }
-func (*domainClient) Close()                                               {}
+func (c *domainClient) open(context.Context) (libvirtdomain.Client, error) {
+	c.mu.Lock()
+	defer c.mu.Unlock()
+
+	c.opens++
+
+	return c, nil
+}
+
+func (c *domainClient) Close() {
+	c.mu.Lock()
+	defer c.mu.Unlock()
+
+	c.closes++
+}
 
 func (c *domainClient) Domains() ([]libvirtdomain.Domain, error) {
 	c.mu.Lock()
@@ -169,6 +188,15 @@ func (s *VirtualMachineDomainSuite) SetupTest() {
 	system := hardware.NewSystemInformation(hardware.SystemInformationID)
 	system.TypedSpec().UUID = machineUUID
 	s.Create(system)
+	s.Create(newReadyVirtqemudService())
+}
+
+func newReadyVirtqemudService() *v1alpha1.Service {
+	service := v1alpha1.NewService(virtqemudServiceID)
+	service.TypedSpec().Running = true
+	service.TypedSpec().Unknown = true
+
+	return service
 }
 
 func (s *VirtualMachineDomainSuite) start() {
@@ -233,6 +261,76 @@ func (s *VirtualMachineDomainSuite) TestCreateUpdateRemove() {
 	s.assertDomain("second", second.TypedSpec().DomainXML, true)
 }
 
+func (s *VirtualMachineDomainSuite) TestServiceReadinessGatesReconciliationAndCleanup() {
+	service, err := safe.StateGetByID[*v1alpha1.Service](s.Ctx(), s.State(), virtqemudServiceID)
+	s.Require().NoError(err)
+	s.Destroy(service)
+
+	spec := hypervisor.NewVirtualMachineDomainSpec(hypervisor.NamespaceName, "gated")
+	spec.TypedSpec().DomainXML = `<domain><name>gated</name><vcpu>1</vcpu></domain>`
+	spec.TypedSpec().PowerState = "running"
+	s.Create(spec)
+	s.start()
+
+	s.Require().Never(func() bool {
+		s.client.mu.Lock()
+		defer s.client.mu.Unlock()
+
+		return s.client.opens != 0
+	}, 100*time.Millisecond, 10*time.Millisecond)
+
+	starting := v1alpha1.NewService(virtqemudServiceID)
+	starting.TypedSpec().Unknown = true
+	s.Create(starting)
+	s.Require().Never(func() bool {
+		s.client.mu.Lock()
+		defer s.client.mu.Unlock()
+
+		return s.client.opens != 0
+	}, 100*time.Millisecond, 10*time.Millisecond)
+
+	ctest.UpdateWithConflicts(s, starting, func(resource *v1alpha1.Service) error {
+		resource.TypedSpec().Running = true
+
+		return nil
+	})
+	s.assertDomain("gated", spec.TypedSpec().DomainXML, true)
+	s.assertFinalizer("gated", true)
+
+	ready, err := s.State().Teardown(s.Ctx(), starting.Metadata())
+	s.Require().NoError(err)
+	s.Require().True(ready)
+	s.Destroy(starting)
+
+	updated := ctest.UpdateWithConflicts(s, spec, func(resource *hypervisor.VirtualMachineDomainSpec) error {
+		resource.TypedSpec().DomainXML = `<domain><name>gated</name><vcpu>2</vcpu></domain>`
+
+		return nil
+	})
+
+	s.client.mu.Lock()
+	opensWhileReady := s.client.opens
+	s.client.mu.Unlock()
+
+	s.Require().Never(func() bool {
+		s.client.mu.Lock()
+		defer s.client.mu.Unlock()
+
+		return s.client.opens != opensWhileReady || s.client.texts["gated"] == updated.TypedSpec().DomainXML
+	}, 100*time.Millisecond, 10*time.Millisecond)
+	s.assertFinalizer("gated", true)
+
+	teardownReady, err := s.State().Teardown(s.Ctx(), updated.Metadata())
+	s.Require().NoError(err)
+	s.Require().False(teardownReady)
+	s.assertFinalizer("gated", true)
+	s.assertDomain("gated", spec.TypedSpec().DomainXML, true)
+
+	s.Create(newReadyVirtqemudService())
+	s.assertDomain("gated", "", false)
+	s.assertFinalizer("gated", false)
+}
+
 func (s *VirtualMachineDomainSuite) TestUnclaimedDomainsAreNeverRemoved() {
 	foreign := libvirtdomain.Domain{Name: "external", UUID: uuid.New()}
 	unclaimed := libvirtdomain.Domain{Name: "unclaimed", UUID: libvirtdomain.UUID(uuid.MustParse(machineUUID), "unclaimed")}
```

---

### Incident Patch 11: `53fa44cb` (2026-09-30)
**Commit Message**: fix: add validation for the PTP device name

This avoids accidentally misusing any device which is not PTP and talk
to wrong hardware.

Add validation to the machine config and internal ntp functions (which
can be reached via the API).

Restrict the API to `>= reader`, as this API might start interaction
with devices, and it doesn't seem to be side-effect free.

Signed-off-by: Andrey Smirnov <[REDACTED_EMAIL]>

**File**: `hack/release.toml` (modified, +10/-0)
```diff
@@ -89,6 +89,16 @@ into `DiskPressure` (and tainted for `evictionPressureTransitionPeriod`) before
 
 The defaults are applied only if neither of the thresholds is set in `machine.kubelet.extraConfig`.
 On upgrade, nodes with disk usage above 75% will garbage collect unused images.
+"""
+
+    [notes.time_check]
+        title = "Time Check API"
+        description = """\
+The `TimeService/TimeCheck` API (`talosctl time --check`) is no longer available to the `os:reader` role, as it allows querying
+arbitrary time servers from the node. The `TimeService/Time` API (querying the configured time server) is still available to `os:reader`.
+
+PTP device paths are now strictly validated both in the machine configuration and in the API: the path should be directly under `/dev`,
+the name should start with `ptp` (e.g. `/dev/ptp0`, `/dev/ptp_kvm`), and the device should be a PTP character device.
 """
 
     [notes.updates]
```

**File**: `internal/app/machined/pkg/system/services/machined.go` (modified, +1/-1)
```diff
@@ -157,7 +157,7 @@ var rules = map[string]role.Set{
 	),
 
 	"/time.TimeService/Time":      role.MakeSet(role.Admin, role.Operator, role.Reader),
-	"/time.TimeService/TimeCheck": role.MakeSet(role.Admin, role.Operator, role.Reader),
+	"/time.TimeService/TimeCheck": role.MakeSet(role.Admin, role.Operator),
 }
 
 type machinedService struct {
```

**File**: `internal/pkg/ntp/ntp.go` (modified, +51/-3)
```diff
@@ -14,8 +14,8 @@ import (
 	"math/bits"
 	"net"
 	"os"
+	"path/filepath"
 	"slices"
-	"strings"
 	"sync"
 	"time"
 
@@ -27,6 +27,7 @@ import (
 
 	"github.com/siderolabs/talos/internal/pkg/ntp/internal/spike"
 	"github.com/siderolabs/talos/internal/pkg/timex"
+	"github.com/siderolabs/talos/pkg/machinery/config/config"
 )
 
 // Syncer performs time sync via NTP on schedule.
@@ -437,8 +438,10 @@ func (syncer *Syncer) query(ctx context.Context) (lastSyncServer string, measure
 }
 
 // IsPTPDevice checks if a given server string represents a PTP device.
+//
+// The device path is validated when the device is queried, see QueryPTPDevice.
 func IsPTPDevice(server string) bool {
-	return strings.HasPrefix(server, "/dev/")
+	return config.IsPTPDevicePath(server)
 }
 
 func (syncer *Syncer) resolveServers(ctx context.Context) ([]string, error) {
@@ -521,9 +524,14 @@ func (syncer *Syncer) queryPTP(device string) (*Measurement, bool, error) {
 	return meas, false, err
 }
 
+// errNotPTPDevice is returned for any path which doesn't resolve to a PTP device.
+//
+// A single error is used for all failure modes to avoid leaking information about the filesystem.
+var errNotPTPDevice = errors.New("not a PTP device")
+
 // QueryPTPDevice queries PTP device for current time.
 func QueryPTPDevice(device string) (unix.Timespec, error) {
-	phc, err := os.Open(device)
+	phc, err := openPTPDevice(device)
 	if err != nil {
 		return unix.Timespec{}, err
 	}
@@ -550,6 +558,46 @@ func QueryPTPDevice(device string) (unix.Timespec, error) {
 	return ts, err
 }
 
+// openPTPDevice opens the PTP device verifying that the path points to a PTP character device.
+//
+// The path is first opened with O_PATH, which doesn't invoke the device driver's open handler,
+// so opening a path which is not a PTP device (e.g. a watchdog) has no side effects.
+func openPTPDevice(device string) (*os.File, error) {
+	if err := config.ValidatePTPDevicePath(device); err != nil {
+		return nil, err
+	}
+
+	pathFd, err := unix.Open(device, unix.O_PATH|unix.O_CLOEXEC, 0)
+	if err != nil {
+		return nil, errNotPTPDevice
+	}
+
+	defer unix.Close(pathFd) //nolint:errcheck
+
+	var st unix.Stat_t
+
+	if err = unix.Fstat(pathFd, &st); err != nil {
+		return nil, errNotPTPDevice
+	}
+
+	if st.Mode&unix.S_IFMT != unix.S_IFCHR {
+		return nil, errNotPTPDevice
+	}
+
+	subsystem, err := os.Readlink(fmt.Sprintf("/sys/dev/char/%d:%d/subsystem", unix.Major(st.Rdev), unix.Minor(st.Rdev)))
+	if err != nil || filepath.Base(subsystem) != "ptp" {
+		return nil, errNotPTPDevice
+	}
+
+	// re-open the verified file via /proc to avoid races with the path being replaced
+	phc, err := os.OpenFile(fmt.Sprintf("/proc/self/fd/%d", pathFd), os.O_RDONLY|unix.O_CLOEXEC, 0)
+	if err != nil {
+		return nil, errNotPTPDevice
+	}
+
+	return phc, nil
+}
+
 func (syncer *Syncer) queryNTP(server string) (*Measurement, bool, error) {
 	resp, err := syncer.NTPQuery(server)
 	if err != nil {
```

**File**: `internal/pkg/ntp/ntp_test.go` (modified, +19/-0)
```diff
@@ -932,3 +932,22 @@ func (suite *NTPSuite) TestNTSBootstrapDoesNotBypassUntrustedCert() {
 
 	suite.Assert().Zero(relaxedAttempts.Load(), "untrusted certificate must not trigger relaxed validation")
 }
+
+func TestQueryPTPDeviceInvalid(t *testing.T) {
+	t.Parallel()
+
+	for _, device := range []string{
+		"/dev/../dev/null",
+		"/dev/../etc/shadow",
+		"/dev/watchdog",
+		"/dev/null",
+		"/dev/ptp_nonexistent",
+	} {
+		t.Run(device, func(t *testing.T) {
+			t.Parallel()
+
+			_, err := ntp.QueryPTPDevice(device)
+			assert.Error(t, err)
+		})
+	}
+}
```

**File**: `pkg/machinery/config/config/time.go` (added, +41/-0)
```diff
@@ -0,0 +1,41 @@
+// This Source Code Form is subject to the terms of the Mozilla Public
+// License, v. 2.0. If a copy of the MPL was not distributed with this
+// file, You can obtain one at http://mozilla.org/MPL/2.0/.
+
+package config
+
+import (
+	"fmt"
+	"path/filepath"
+	"strings"
+)
+
+// PTPDevicePathPrefix is the prefix of the time server entry which represents a PTP device.
+const PTPDevicePathPrefix = "/dev/"
+
+// IsPTPDevicePath checks if a given time server entry is meant to be a PTP device.
+//
+// It doesn't validate the path, use ValidatePTPDevicePath for that.
+func IsPTPDevicePath(server string) bool {
+	return strings.HasPrefix(server, PTPDevicePathPrefix)
+}
+
+// ValidatePTPDevicePath validates that the path points to a PTP device node.
+//
+// A valid PTP device path is a clean path directly under /dev with the name starting with "ptp",
+// e.g. /dev/ptp0, /dev/ptp_kvm, /dev/ptp_hyperv.
+func ValidatePTPDevicePath(path string) error {
+	if filepath.Clean(path) != path {
+		return fmt.Errorf("PTP device path %q is not clean", path)
+	}
+
+	if filepath.Dir(path) != filepath.Clean(PTPDevicePathPrefix) {
+		return fmt.Errorf("PTP device path %q should be directly under %s", path, PTPDevicePathPrefix)
+	}
+
+	if !strings.HasPrefix(filepath.Base(path), "ptp") {
+		return fmt.Errorf("PTP device path %q should have a name starting with 'ptp'", path)
+	}
+
+	return nil
+}
```

**File**: `pkg/machinery/config/types/network/time_sync.go` (modified, +40/-6)
```diff
@@ -146,17 +146,51 @@ func (s *TimeSyncConfigV1Alpha1) Validate(validation.RuntimeMode, ...validation.
 		errs = errors.Join(errs, errors.New("only one of ntp or ptp configuration can be specified"))
 	}
 
-	if s.TimeNTP != nil && s.TimeNTP.UseNTS != nil && *s.TimeNTP.UseNTS {
-		for _, server := range s.TimeNTP.Servers {
-			if net.ParseIP(server) != nil {
-				errs = errors.Join(errs, fmt.Errorf("NTS requires hostnames, not IP addresses: %q", server))
-			}
-		}
+	if s.TimeNTP != nil {
+		errs = errors.Join(errs, s.TimeNTP.validate())
+	}
+
+	if s.TimePTP != nil {
+		errs = errors.Join(errs, s.TimePTP.validate())
 	}
 
 	return nil, errs
 }
 
+func (n *NTPConfig) validate() error {
+	var errs error
+
+	useNTS := pointer.SafeDeref(n.UseNTS)
+
+	for _, server := range n.Servers {
+		if config.IsPTPDevicePath(server) {
+			errs = errors.Join(errs, fmt.Errorf("PTP devices should be specified in the ptp section, not as NTP servers: %q", server))
+		}
+
+		if useNTS && net.ParseIP(server) != nil {
+			errs = errors.Join(errs, fmt.Errorf("NTS requires hostnames, not IP addresses: %q", server))
+		}
+	}
+
+	return errs
+}
+
+func (p *PTPConfig) validate() error {
+	var errs error
+
+	for _, device := range p.Devices {
+		if !config.IsPTPDevicePath(device) {
+			errs = errors.Join(errs, fmt.Errorf("PTP device should be a path under %s: %q", config.PTPDevicePathPrefix, device))
+
+			continue
+		}
+
+		errs = errors.Join(errs, config.ValidatePTPDevicePath(device))
+	}
+
+	return errs
+}
+
 // V1Alpha1ConflictValidate implements container.V1Alpha1ConflictValidator interface.
 func (s *TimeSyncConfigV1Alpha1) V1Alpha1ConflictValidate(v1alpha1Cfg *v1alpha1.Config) error {
 	v1tsc := v1alpha1Cfg.NetworkTimeSyncConfig()
```

**File**: `pkg/machinery/config/types/network/time_sync_test.go` (modified, +38/-0)
```diff
@@ -174,6 +174,44 @@ func TestTimeSyncValidate(t *testing.T) {
 			},
 			expectedError: `NTS requires hostnames, not IP addresses: "192.0.2.1"`,
 		},
+		{
+			name: "valid PTP config",
+			cfg: func() *network.TimeSyncConfigV1Alpha1 {
+				cfg := network.NewTimeSyncConfigV1Alpha1()
+				cfg.TimePTP = &network.PTPConfig{
+					Devices: []string{"/dev/ptp0", "/dev/ptp_kvm"},
+				}
+
+				return cfg
+			},
+		},
+		{
+			name: "PTP device as NTP server",
+			cfg: func() *network.TimeSyncConfigV1Alpha1 {
+				cfg := network.NewTimeSyncConfigV1Alpha1()
+				cfg.TimeNTP = &network.NTPConfig{
+					Servers: []string{"/dev/ptp0"},
+				}
+
+				return cfg
+			},
+			expectedError: `PTP devices should be specified in the ptp section, not as NTP servers: "/dev/ptp0"`,
+		},
+		{
+			name: "invalid PTP devices",
+			cfg: func() *network.TimeSyncConfigV1Alpha1 {
+				cfg := network.NewTimeSyncConfigV1Alpha1()
+				cfg.TimePTP = &network.PTPConfig{
+					Devices: []string{"ptp0", "/dev/../dev/watchdog", "/dev/watchdog", "/dev/foo/ptp0"},
+				}
+
+				return cfg
+			},
+			expectedError: `PTP device should be a path under /dev/: "ptp0"` + "\n" +
+				`PTP device path "/dev/../dev/watchdog" is not clean` + "\n" +
+				`PTP device path "/dev/watchdog" should have a name starting with 'ptp'` + "\n" +
+				`PTP device path "/dev/foo/ptp0" should be directly under /dev/`,
+		},
 	} {
 		t.Run(test.name, func(t *testing.T) {
 			t.Parallel()
```

**File**: `pkg/machinery/config/types/v1alpha1/v1alpha1_validation.go` (modified, +11/-0)
```diff
@@ -26,6 +26,7 @@ import (
 	sideronet "github.com/siderolabs/net"
 
 	"github.com/siderolabs/talos/pkg/machinery/compatibility"
+	"github.com/siderolabs/talos/pkg/machinery/config/config"
 	"github.com/siderolabs/talos/pkg/machinery/config/machine"
 	"github.com/siderolabs/talos/pkg/machinery/config/types/block/blockhelpers"
 	"github.com/siderolabs/talos/pkg/machinery/config/validation"
@@ -127,6 +128,16 @@ func (c *Config) Validate(mode validation.RuntimeMode, options ...validation.Opt
 		}
 	}
 
+	if c.MachineConfig.MachineTime != nil {
+		for _, server := range c.MachineConfig.MachineTime.TimeServers {
+			if config.IsPTPDevicePath(server) {
+				if err := config.ValidatePTPDevicePath(server); err != nil {
+					result = multierror.Append(result, fmt.Errorf("invalid time server (.machine.time.servers): %w", err))
+				}
+			}
+		}
+	}
+
 	if t := c.Machine().Type(); t != machine.TypeUnknown && t.String() != c.MachineConfig.MachineType {
 		warnings = append(warnings, fmt.Sprintf("use %q instead of %q for machine type", t.String(), c.MachineConfig.MachineType))
 	}
```

---

### Incident Patch 12: `b6a32fc1` (2026-09-30)
**Commit Message**: fix: reject impersonation header without impersonator role

This is not a security fix, but a UX fix.

Previously the role header was simply ignored, now Talos rejects such
requests.

While we are on it, refactor the code to use errors instead of panics,
add misssing unit-test coverage, add integration test coverage.

Signed-off-by: Andrey Smirnov <[REDACTED_EMAIL]>

**File**: `internal/integration/api/apid.go` (modified, +166/-0)
```diff
@@ -18,6 +18,8 @@ import (
 	"github.com/cosi-project/runtime/pkg/safe"
 	"github.com/dustin/go-humanize"
 	"google.golang.org/grpc/codes"
+	"google.golang.org/grpc/metadata"
+	"google.golang.org/protobuf/types/known/durationpb"
 
 	"github.com/siderolabs/talos/internal/integration/base"
 	machineapi "github.com/siderolabs/talos/pkg/machinery/api/machine"
@@ -272,6 +274,170 @@ func (suite *ApidSuite) TestPKIMismatch() {
 	suite.Require().NoError(wrongClient.Close())
 }
 
+// TestImpersonationWithoutRole verifies that the impersonation header is rejected when the client
+// doesn't have os:impersonator role, whatever roles the client has otherwise.
+func (suite *ApidSuite) TestImpersonationWithoutRole() {
+	nodes := suite.DiscoverNodeInternalIPs(suite.ctx)
+	cpNode := suite.RandomDiscoveredNodeInternalIP(machine.TypeControlPlane)
+
+	for _, tt := range []struct {
+		name  string
+		roles []role.Role
+	}{
+		{
+			name:  "reader",
+			roles: []role.Role{role.Reader},
+		},
+		{
+			name:  "admin",
+			roles: []role.Role{role.Admin},
+		},
+		{
+			name:  "operator and reader",
+			roles: []role.Role{role.Operator, role.Reader},
+		},
+	} {
+		suite.Run(tt.name, func() {
+			cli := suite.generateClient(tt.roles...)
+
+			for _, node := range nodes {
+				nodeCtx := client.WithNode(suite.ctx, node)
+
+				// sanity check: the client works without the impersonation header
+				_, err := cli.Version(nodeCtx)
+				suite.Require().NoError(err)
+
+				// any impersonation header is rejected, whether it escalates, downgrades or keeps the roles
+				for _, impersonated := range []role.Role{role.Admin, role.Reader, role.Impersonator, tt.roles[0]} {
+					_, err = cli.Version(withImpersonation(nodeCtx, impersonated))
+					suite.Require().Error(err)
+					suite.Assert().Equal(codes.PermissionDenied, client.StatusCode(err), "unexpected error: %v", err)
+					suite.Assert().ErrorContains(err, "impersonator role")
+				}
+			}
+
+			// the header doesn't escalate access to admin-only APIs either
+			_, err := cli.GenerateClientConfiguration(withImpersonation(client.WithNode(suite.ctx, cpNode), role.Admin), &machineapi.GenerateClientConfigurationRequest{
+				Roles:  []string{string(role.Reader)},
+				CrtTtl: durationpb.New(time.Hour),
+			})
+			suite.Require().Error(err)
+			suite.Assert().Equal(codes.PermissionDenied, client.StatusCode(err), "unexpected error: %v", err)
+			suite.Assert().ErrorContains(err, "impersonator role")
+		})
+	}
+}
+
+// TestImpersonation verifies that a client with os:impersonator role can impersonate any role via the impersonation header,
+// and that the impersonated roles are what gets authorized, including when the request is proxied between apid instances.
+func (suite *ApidSuite) TestImpersonation() {
+	nodes := suite.DiscoverNodeInternalIPs(suite.ctx)
+	cpCtx := client.WithNode(suite.ctx, suite.RandomDiscoveredNodeInternalIP(machine.TypeControlPlane))
+
+	adminOnlyRequest := &machineapi.GenerateClientConfigurationRequest{
+		Roles:  []string{string(role.Reader)},
+		CrtTtl: durationpb.New(time.Hour),
+	}
+
+	suite.Run("impersonator only", func() {
+		cli := suite.generateClient(role.Impersonator)
+
+		for _, node := range nodes {
+			nodeCtx := client.WithNode(suite.ctx, node)
+
+			// os:impersonator alone doesn't grant access to anything
+			_, err := cli.Version(nodeCtx)
+			suite.Require().Error(err)
+			suite.Assert().Equal(codes.PermissionDenied, client.StatusCode(err), "unexpected error: %v", err)
+
+			// impersonating a reader grants read-only access
+			_, err = cli.Version(withImpersonation(nodeCtx, role.Reader))
+			suite.Require().NoError(err)
+
+			// impersonating an admin grants access as well
+			_, err = cli.Version(withImpersonation(nodeCtx, role.Admin))
+			suite.Require().NoError(err)
+
+			// impersonating an unknown role grants nothing
+			_, err = cli.Version(withImpersonation(nodeCtx, role.Role("os:nonexistent")))
+			suite.Require().Error(err)
+			suite.Assert().Equal(codes.PermissionDenied, client.StatusCode(err), "unexpected error: %v", err)
+		}
+
+		// impersonated reader is denied admin-only APIs
+		_, err := cli.GenerateClientConfiguration(withImpersonation(cpCtx, role.Reader), adminOnlyRequest)
+		suite.Require().Error(err)
+		suite.Assert().Equal(codes.PermissionDenied, client.StatusCode(err), "unexpected error: %v", err)
+
+		// impersonated admin is allowed admin-only APIs
+		_, err = cli.GenerateClientConfiguration(withImpersonation(cpCtx, role.Admin), adminOnlyRequest)
+		suite.Require().NoError(err)
+	})
+
+	suite.Run("impersonator and reader", func() {
+		cli := suite.generateClient(role.Impersonator, role.Reader)
+
+		for _, node := range nodes {
+			nodeCtx := client.WithNode(suite.ctx, node)
+
+			// without the header, the client's own roles apply
+			_, err := cli.Version(nodeCtx)
+			suite.Require().NoError(err)
+		}
+
+		// the client's own roles don't include admin
+		_, err := cli.GenerateClientConfiguration(cpCtx, adminOnlyRequest)
+		su
```

**File**: `pkg/grpc/middleware/authz/injector.go` (modified, +42/-17)
```diff
@@ -6,14 +6,17 @@ package authz
 
 import (
 	"context"
+	"errors"
 	"fmt"
 	"net"
 	"net/netip"
 
 	grpc_middleware "github.com/grpc-ecosystem/go-grpc-middleware/v2"
 	"google.golang.org/grpc"
+	"google.golang.org/grpc/codes"
 	"google.golang.org/grpc/credentials"
 	"google.golang.org/grpc/peer"
+	"google.golang.org/grpc/status"
 
 	grpclog "github.com/siderolabs/talos/pkg/grpc/middleware/log"
 	"github.com/siderolabs/talos/pkg/machinery/resources/network"
@@ -74,20 +77,20 @@ func (i *Injector) annotatef(ctx context.Context, format string, v ...any) {
 // or from gRPC metadata (in case of subsequent apid instances, machined, or user with impersonator role).
 //
 //nolint:gocyclo
-func (i *Injector) extractRoles(ctx context.Context) role.Set {
+func (i *Injector) extractRoles(ctx context.Context) (role.Set, error) {
 	// sanity check
 	if _, ok := getFromContext(ctx); ok {
-		panic("roles should not be present in the context at this point")
+		return role.Zero, errors.New("roles should not be present in the context at this point")
 	}
 
 	switch i.Mode {
 	case Disabled:
 		i.annotatef(ctx, "RBAC is disabled, injecting all roles")
 
-		return role.All
+		return role.All, nil
 
 	case ReadOnly:
-		return readerRoleSet
+		return readerRoleSet, nil
 
 	case ReadOnlyWithAdminOnSiderolink:
 		check := i.SideroLinkPeerCheckFunc
@@ -98,29 +101,32 @@ func (i *Injector) extractRoles(ctx context.Context) role.Set {
 		if siderolinkPeerAddr, siderolinkPeer := check(ctx); siderolinkPeer {
 			i.annotatef(ctx, "inject admin role for SideroLink peer %q", siderolinkPeerAddr)
 
-			return adminRoleSet
+			return adminRoleSet, nil
 		}
 
-		return readerRoleSet
+		return readerRoleSet, nil
 
 	case MetadataOnly:
-		roles, _ := getFromMetadata(ctx, i.annotatef)
+		roles, _, err := getFromMetadata(ctx, i.annotatef)
+		if err != nil {
+			return role.Zero, err
+		}
 
-		return roles
+		return roles, nil
 
 	case Enabled:
 		p, ok := peer.FromContext(ctx)
 		if !ok {
-			panic("can't get peer information")
+			return role.Zero, errors.New("can't get peer information")
 		}
 
 		tlsInfo, ok := p.AuthInfo.(credentials.TLSInfo)
 		if !ok {
-			panic(fmt.Sprintf("expected credentials.TLSInfo, got %T", p.AuthInfo))
+			return role.Zero, fmt.Errorf("expected credentials.TLSInfo, got %T", p.AuthInfo)
 		}
 
 		if len(tlsInfo.State.PeerCertificates) == 0 {
-			panic("expected at least one certificate")
+			return role.Zero, errors.New("expected at least one certificate")
 		}
 
 		// PeerCertificates[0] is the leaf certificate the connection was verified against, so this
@@ -135,25 +141,38 @@ func (i *Injector) extractRoles(ctx context.Context) role.Set {
 		// trust gRPC metadata from clients with impersonator role if present
 		// (including requests proxied from other apid instances)
 		if roles.Includes(role.Impersonator) {
-			metadataRoles, ok := getFromMetadata(ctx, i.annotatef)
+			metadataRoles, ok, err := getFromMetadata(ctx, i.annotatef)
+			if err != nil {
+				return role.Zero, err
+			}
+
 			if ok {
-				return metadataRoles
+				return metadataRoles, nil
 			}
 
 			// that's a real user with impersonator role then
 			i.annotatef(ctx, "no roles in metadata, returning parsed roles")
+		} else if hasInMetadata(ctx) {
+			// impersonation header is present, but the client doesn't have impersonator role, so we reject the request
+			// with a clean error instead of silently ignoring the impersonation header
+			return role.Zero, status.Error(codes.PermissionDenied, "client doesn't have impersonator role, but impersonation header is present")
 		}
 
-		return roles
+		return roles, nil
 	}
 
-	panic("unreachable")
+	return role.Zero, fmt.Errorf("unknown injector mode %v", i.Mode)
 }
 
 // UnaryInterceptor returns grpc UnaryServerInterceptor.
 func (i *Injector) UnaryInterceptor() grpc.UnaryServerInterceptor {
 	return func(ctx context.Context, req any, info *grpc.UnaryServerInfo, handler grpc.UnaryHandler) (any, error) {
-		ctx = ContextWithRoles(ctx, i.extractRoles(ctx))
+		extractedRoles, err := i.extractRoles(ctx)
+		if err != nil {
+			return nil, err
+		}
+
+		ctx = ContextWithRoles(ctx, extractedRoles)
 
 		return handler(ctx, req)
 	}
@@ -163,7 +182,13 @@ func (i *Injector) UnaryInterceptor() grpc.UnaryServerInterceptor {
 func (i *Injector) StreamInterceptor() grpc.StreamServerInterceptor {
 	return func(srv any, stream grpc.ServerStream, info *grpc.StreamServerInfo, handler grpc.StreamHandler) error {
 		ctx := stream.Context()
-		ctx = ContextWithRoles(ctx, i.extractRoles(ctx))
+
+		extractedRoles, err := i.extractRoles(ctx)
+		if err != nil {
+			return err
+		}
+
+		ctx = ContextWithRoles(ctx, extractedRoles)
 
 		wrapped := grpc_middleware.WrapServerStream(stream)
 		wrapped.WrappedContext = ctx
```

**File**: `pkg/grpc/middleware/authz/injector_test.go` (added, +298/-0)
```diff
@@ -0,0 +1,298 @@
+// This Source Code Form is subject to the terms of the Mozilla Public
+// License, v. 2.0. If a copy of the MPL was not distributed with this
+// file, You can obtain one at http://mozilla.org/MPL/2.0/.
+
+package authz_test
+
+import (
+	"context"
+	"crypto/tls"
+	"crypto/x509"
+	"crypto/x509/pkix"
+	"net"
+	"net/netip"
+	"testing"
+
+	"github.com/stretchr/testify/assert"
+	"github.com/stretchr/testify/require"
+	"google.golang.org/grpc"
+	"google.golang.org/grpc/codes"
+	"google.golang.org/grpc/credentials"
+	"google.golang.org/grpc/metadata"
+	"google.golang.org/grpc/peer"
+	"google.golang.org/grpc/status"
+
+	"github.com/siderolabs/talos/pkg/grpc/middleware/authz"
+	"github.com/siderolabs/talos/pkg/machinery/constants"
+	"github.com/siderolabs/talos/pkg/machinery/role"
+)
+
+// withPeerCert returns a context with gRPC peer info carrying a client TLS certificate with the given organizations.
+func withPeerCert(ctx context.Context, orgs ...string) context.Context {
+	return peer.NewContext(ctx, &peer.Peer{
+		Addr: &net.TCPAddr{IP: net.ParseIP("192.168.1.1"), Port: 12345},
+		AuthInfo: credentials.TLSInfo{
+			State: tls.ConnectionState{
+				PeerCertificates: []*x509.Certificate{
+					{
+						Subject: pkix.Name{
+							Organization: orgs,
+						},
+					},
+				},
+			},
+		},
+	})
+}
+
+// withRoleMetadata returns a context with the impersonation header set in the incoming gRPC metadata.
+func withRoleMetadata(ctx context.Context, roles ...string) context.Context {
+	md, _ := metadata.FromIncomingContext(ctx)
+	md = md.Copy()
+
+	md.Set(constants.APIAuthzRoleMetadataKey, roles...)
+
+	return metadata.NewIncomingContext(ctx, md)
+}
+
+// withEmptyMetadata returns a context with (empty) incoming gRPC metadata, as it would be for any real gRPC request.
+func withEmptyMetadata(ctx context.Context) context.Context {
+	return metadata.NewIncomingContext(ctx, metadata.MD{})
+}
+
+type fakeServerStream struct {
+	grpc.ServerStream
+
+	ctx context.Context //nolint:containedctx
+}
+
+func (s *fakeServerStream) Context() context.Context {
+	return s.ctx
+}
+
+//nolint:gocyclo
+func TestInjector(t *testing.T) {
+	t.Parallel()
+
+	for _, test := range []struct {
+		name     string
+		injector authz.Injector
+		ctx      context.Context //nolint:containedctx
+
+		expectedRoles role.Set
+		expectedCode  codes.Code
+		expectedError string
+	}{
+		{
+			name:          "disabled",
+			injector:      authz.Injector{Mode: authz.Disabled},
+			ctx:           withEmptyMetadata(context.Background()),
+			expectedRoles: role.All,
+		},
+		{
+			name:     "disabled ignores impersonation header",
+			injector: authz.Injector{Mode: authz.Disabled},
+			ctx:      withRoleMetadata(context.Background(), "os:reader"),
+			// RBAC is off, so the header is meaningless: every role is granted anyway
+			expectedRoles: role.All,
+		},
+		{
+			name:          "read-only",
+			injector:      authz.Injector{Mode: authz.ReadOnly},
+			ctx:           withRoleMetadata(context.Background(), "os:admin"),
+			expectedRoles: role.MakeSet(role.Reader),
+		},
+		{
+			name: "read-only with admin on SideroLink: not a SideroLink peer",
+			injector: authz.Injector{
+				Mode: authz.ReadOnlyWithAdminOnSiderolink,
+				SideroLinkPeerCheckFunc: func(context.Context) (netip.Addr, bool) {
+					return netip.Addr{}, false
+				},
+			},
+			ctx:           withRoleMetadata(context.Background(), "os:admin"),
+			expectedRoles: role.MakeSet(role.Reader),
+		},
+		{
+			name: "read-only with admin on SideroLink: SideroLink peer",
+			injector: authz.Injector{
+				Mode: authz.ReadOnlyWithAdminOnSiderolink,
+				SideroLinkPeerCheckFunc: func(context.Context) (netip.Addr, bool) {
+					return netip.MustParseAddr("fdae:41e4:649b:9303::1"), true
+				},
+			},
+			ctx:           withEmptyMetadata(context.Background()),
+			expectedRoles: role.MakeSet(role.Admin),
+		},
+		{
+			name:          "metadata only",
+			injector:      authz.Injector{Mode: authz.MetadataOnly},
+			ctx:           withRoleMetadata(context.Background(), "os:operator", "os:reader"),
+			expectedRoles: role.MakeSet(role.Operator, role.Reader),
+		},
+		{
+			name:          "metadata only: no roles in metadata",
+			injector:      authz.Injector{Mode: authz.MetadataOnly},
+			ctx:           withEmptyMetadata(context.Background()),
+			expectedRoles: role.Zero,
+		},
+		{
+			name:          "metadata only: no metadata",
+			injector:      authz.Injector{Mode: authz.MetadataOnly},
+			ctx:           context.Background(),
+			expectedCode:  codes.Unknown,
+			expectedError: "no request metadata",
+		},
+		{
+			name:          "enabled: roles from certificate",
+			injector:      authz.Injector{Mode: authz.Enabled},
+			ctx:           withPeerCert(withEmptyMetadata(context.Background()), "os:reader", "os:operator"),
+			expectedRoles: role.MakeSet(role.Reader, role.Operator),
+		},
+		{
+			name:          "enabled: impersonator without header keeps its own roles",
+			injector:
```

**File**: `pkg/grpc/middleware/authz/metadata.go` (modified, +15/-4)
```diff
@@ -6,6 +6,7 @@ package authz
 
 import (
 	"context"
+	"errors"
 
 	"google.golang.org/grpc/metadata"
 
@@ -32,22 +33,32 @@ func SetMetadata(md metadata.MD, roles role.Set) {
 	md.Set(mdKey, roleStrings...)
 }
 
+// hasInMetadata returns true if the role header is present in gRPC metadata.
+func hasInMetadata(ctx context.Context) bool {
+	md, ok := metadata.FromIncomingContext(ctx)
+	if !ok {
+		return false
+	}
+
+	return len(md.Get(mdKey)) > 0
+}
+
 // getFromMetadata returns roles extracted from gRPC metadata.
-func getFromMetadata(ctx context.Context, annotate func(ctx context.Context, format string, v ...any)) (role.Set, bool) {
+func getFromMetadata(ctx context.Context, annotate func(ctx context.Context, format string, v ...any)) (role.Set, bool, error) {
 	md, ok := metadata.FromIncomingContext(ctx)
 	if !ok {
-		panic("no request metadata")
+		return role.Zero, false, errors.New("no request metadata")
 	}
 
 	strings := md.Get(mdKey)
 	if len(strings) == 0 {
 		annotate(ctx, "no roles in metadata")
 
-		return role.Zero, false
+		return role.Zero, false, nil
 	}
 
 	roles, unknownRoles := role.Parse(strings)
 	annotate(ctx, "parsed metadata %v as %v (unknownRoles = %v)", strings, roles.Strings(), unknownRoles)
 
-	return roles, true
+	return roles, true, nil
 }
```

---

### Incident Patch 13: `76e761d8` (2026-09-30)
**Commit Message**: fix: validate ExtensionServiceConfig name

The name of the config document should have same validation as extension
service name.

Signed-off-by: Andrey Smirnov <[REDACTED_EMAIL]>

**File**: `pkg/machinery/config/types/runtime/extensions/service_config.go` (modified, +5/-0)
```diff
@@ -16,6 +16,7 @@ import (
 	"github.com/siderolabs/talos/pkg/machinery/config/merge"
 	"github.com/siderolabs/talos/pkg/machinery/config/types/meta"
 	"github.com/siderolabs/talos/pkg/machinery/config/validation"
+	"github.com/siderolabs/talos/pkg/machinery/extensions/services"
 )
 
 // ServiceConfigKind is a Extension config document kind.
@@ -133,6 +134,10 @@ func (e *ServiceConfigV1Alpha1) Validate(validation.RuntimeMode, ...validation.O
 		return nil, fmt.Errorf("name is required")
 	}
 
+	if !services.IsValidName(e.ServiceName) {
+		return nil, fmt.Errorf("name %q is invalid", e.ServiceName)
+	}
+
 	if len(e.ServiceConfigFiles) == 0 && len(e.ServiceEnvironment) == 0 {
 		if len(e.ServiceConfigFiles) == 0 {
 			return nil, fmt.Errorf("no config files found for extension %q", e.ServiceName)
```

**File**: `pkg/machinery/config/types/runtime/extensions/service_config_test.go` (modified, +81/-0)
```diff
@@ -70,3 +70,84 @@ func TestExtensionServiceConfigMerge(t *testing.T) {
 	assert.Equal(t, "hello world", cfgLeft.ConfigFiles()[0].Content())
 	assert.Equal(t, "bar", cfgLeft.ConfigFiles()[1].Content())
 }
+
+func TestExtensionServiceConfigValidate(t *testing.T) {
+	t.Parallel()
+
+	for _, test := range []struct {
+		name string
+		cfg  func() *extensions.ServiceConfigV1Alpha1
+
+		expectedError string
+	}{
+		{
+			name: "valid",
+			cfg: func() *extensions.ServiceConfigV1Alpha1 {
+				cfg := extensions.NewServicesConfigV1Alpha1()
+				cfg.ServiceName = "nut-client"
+				cfg.ServiceEnvironment = []string{"FOO=BAR"}
+
+				return cfg
+			},
+		},
+		{
+			name: "empty name",
+			cfg: func() *extensions.ServiceConfigV1Alpha1 {
+				cfg := extensions.NewServicesConfigV1Alpha1()
+				cfg.ServiceEnvironment = []string{"FOO=BAR"}
+
+				return cfg
+			},
+			expectedError: "name is required",
+		},
+		{
+			name: "path traversal",
+			cfg: func() *extensions.ServiceConfigV1Alpha1 {
+				cfg := extensions.NewServicesConfigV1Alpha1()
+				cfg.ServiceName = "../../../etc/cri/conf.d"
+				cfg.ServiceEnvironment = []string{"FOO=BAR"}
+
+				return cfg
+			},
+			expectedError: `name "../../../etc/cri/conf.d" is invalid`,
+		},
+		{
+			name: "uppercase",
+			cfg: func() *extensions.ServiceConfigV1Alpha1 {
+				cfg := extensions.NewServicesConfigV1Alpha1()
+				cfg.ServiceName = "Foo"
+				cfg.ServiceEnvironment = []string{"FOO=BAR"}
+
+				return cfg
+			},
+			expectedError: `name "Foo" is invalid`,
+		},
+		{
+			name: "no files or environment",
+			cfg: func() *extensions.ServiceConfigV1Alpha1 {
+				cfg := extensions.NewServicesConfigV1Alpha1()
+				cfg.ServiceName = "foo"
+
+				return cfg
+			},
+			expectedError: `no config files found for extension "foo"`,
+		},
+	} {
+		t.Run(test.name, func(t *testing.T) {
+			t.Parallel()
+
+			_, err := test.cfg().Validate(validationMode{})
+			if test.expectedError != "" {
+				require.EqualError(t, err, test.expectedError)
+			} else {
+				require.NoError(t, err)
+			}
+		})
+	}
+}
+
+type validationMode struct{}
+
+func (validationMode) String() string        { return "" }
+func (validationMode) RequiresInstall() bool { return false }
+func (validationMode) InContainer() bool     { return false }
```

**File**: `pkg/machinery/extensions/services/services.go` (modified, +6/-1)
```diff
@@ -107,11 +107,16 @@ type Dependency struct {
 
 var nameRe = regexp.MustCompile(`^[-_a-z0-9]{1,}$`)
 
+// IsValidName checks whether the extension service name is valid.
+func IsValidName(name string) bool {
+	return nameRe.MatchString(name)
+}
+
 // Validate the service spec.
 func (spec *Spec) Validate() error {
 	var multiErr *multierror.Error
 
-	if !nameRe.MatchString(spec.Name) {
+	if !IsValidName(spec.Name) {
 		multiErr = multierror.Append(multiErr, fmt.Errorf("name %q is invalid", spec.Name))
 	}
 
```

---

### Incident Patch 14: `2363acc1` (2026-09-29)
**Commit Message**: fix: hv domain status ctrl must use openpersistent

libvirt client .Domain is short lived. Using it in a controller
eventually results in the client closing, and further requests fail,
crashing the controller. We recover on the next controller restart, but
we should instead use a controller-friendly client instead.

DomainConnector().OpenPersistent is exactly what we need.

Signed-off-by: Maja Bojarska <[REDACTED_EMAIL]>

**File**: `internal/app/machined/pkg/runtime/v1alpha2/v1alpha2_controller.go` (modified, +1/-1)
```diff
@@ -286,7 +286,7 @@ func (ctrl *Controller) Run(ctx context.Context, drainer *runtime.Drainer) error
 		&hypervisorctrls.VirtualMachineDomainSpecController{},
 		&hypervisorctrls.VirtualMachineDomainStatusController{
 			V1Alpha1Mode: ctrl.v1alpha1Runtime.State().Platform().Mode(),
-			Open:         virtClient.Domain,
+			Open:         virtClient.DomainConnector().OpenPersistent,
 			Watch:        virtClient.DomainConnector().Watch,
 		},
 		&hypervisorctrls.VirtualMachineStatusController{
```

---

### Incident Patch 15: `6d70efe9` (2026-09-29)
**Commit Message**: feat: bring in Linux 6.18.54, runc 1.5.2

Bring in latest pkgs.

Signed-off-by: Andrey Smirnov <[REDACTED_EMAIL]>

**File**: `Makefile` (modified, +1/-1)
```diff
@@ -28,7 +28,7 @@ EMBED_TARGET ?= embed
 TOOLS_PREFIX ?= ghcr.io/siderolabs/tools
 TOOLS ?= v1.15.0-alpha.0-10-gd40b203
 PKGS_PREFIX ?= ghcr.io/siderolabs
-PKGS ?= v1.15.0-alpha.0-41-g6868054
+PKGS ?= v1.15.0-alpha.0-45-g518972a
 GENERATE_VEX_PREFIX ?= ghcr.io/siderolabs/generate-vex
 GENERATE_VEX ?= latest
 
```

**File**: `hack/release.toml` (modified, +2/-1)
```diff
@@ -82,9 +82,10 @@ command line flags via `machine.kubelet.extraArgs` (e.g. `--cpu-manager-policy`,
     [notes.updates]
         title = "Component Updates"
         description = """\
-Linux: 6.18.53
+Linux: 6.18.54
 Kubernetes: 1.37.0
 containerd: 2.3.6
+runc: 1.5.2
 CoreDNS: 1.14.7
 systemd-udevd: 262
 
```

**File**: `pkg/machinery/constants/constants.go` (modified, +2/-2)
```diff
@@ -20,7 +20,7 @@ var SupportedArchitectures = []string{
 
 const (
 	// DefaultKernelVersion is the default Linux kernel version.
-	DefaultKernelVersion = "6.18.53-talos"
+	DefaultKernelVersion = "6.18.54-talos"
 
 	// KernelParamConfig is the kernel parameter name for specifying the URL.
 	// to the config.
@@ -571,7 +571,7 @@ const (
 	DefaultContainerdVersion = "2.3.6"
 
 	// RuncVersion is the runc version.
-	RuncVersion = "1.5.1"
+	RuncVersion = "1.5.2"
 
 	// SystemContainerdNamespace is the Containerd namespace for Talos services.
 	SystemContainerdNamespace = "system"
```

**File**: `pkg/machinery/gendata/data/pkgs` (modified, +1/-1)
```diff
@@ -1 +1 @@
-v1.15.0-alpha.0-41-g6868054
\ No newline at end of file
+v1.15.0-alpha.0-45-g518972a
\ No newline at end of file
```

#### Recent Merged Pull Requests:
- **PR #14563** (closed): chore: update disvulncheck (2026-10-05) (@majabojarska)
- **PR #14561** (2026-10-05): feat: add CPU partition cgroup operations (@frezbo)
- **PR #14550** (2026-10-02): test: coverage for explicit vm stop, before delete (@majabojarska)
- **PR #14549** (2026-10-02): fix: roll back stacked try configs to the config before the first try (@oguzkilcan)
- **PR #14548** (2026-10-02): feat: rework route configuration (@smira)
- **PR #14547** (2026-10-02): fix: clean up mountpoints on unmount (@smira)
- **PR #14546** (2026-10-02): feat: add CPU partition configuration (@frezbo)
- **PR #14545** (2026-10-03): test: boot stock Alpine ISO over serial console (@shanduur)

---

## 3. Empirical Evidence & Compliance Certification
- **Evidence Provenance**: Fetched directly from verified official GitHub REST API.
- **Zero Disk Footprint**: 0 bytes of unnecessary repository bloat stored locally.
- **TOS & Free-Tier Adherence**: Request pace complied with public API guidelines without fee, penalty, or unauthorized scraping.

---

## 4. Promotion & Integration Status
- **Status**: HARVESTED_DEEP_FORENSIC
- **Master Brain Sync**: Auto-committed to local/remote Master Brain repository.
