# Forensic Learning Record (Deep Inspection): devspace-sh/devspace

> **Canonical Artifact**: `07_PROJECT_LEARNING/devspace-sh-devspace-learnings.md`  
> **Source Platform**: GitHub ([https://github.com/devspace-sh/devspace](https://github.com/devspace-sh/devspace))  
> **Harvest Method**: Full-Spectrum Deep Extraction (Patches, Diffs, Source Code, Post-Mortems)  
> **Harvest Timestamp**: 2026-10-05T18:27:37.394Z  
> **Compliance State**: Free Tier Guaranteed | Strict Rate-Limit Backoff Honored  

---

## 1. Context & Architectural Overview
- **Repository / Resource**: `devspace-sh/devspace`
- **Description**: DevSpace - The Fastest Developer Tool for Kubernetes ⚡ Automate your deployment workflow with DevSpace and develop software directly inside Kubernetes.
- **Primary Language / Ecosystem**: Go
- **Discovered Manifests / Configurations**: go.mod, README.md, Dockerfile
- **Stars / Engagement**: 5197 stars

---

## 2. Multi-Dimensional 8-Axis Investigation & Real Code Patches

### D1: Architecture & Structural Boundaries
- Entry configurations inspected via direct stream: go.mod, README.md, Dockerfile.
- Evaluated system abstractions and modular contracts.

### Core Architecture Module: `cmd/render.go`
```
package cmd

import (
	"github.com/loft-sh/devspace/pkg/devspace/config/versions/latest"
	"os"

	"github.com/loft-sh/devspace/cmd/flags"
	"github.com/loft-sh/devspace/pkg/util/factory"
	"github.com/spf13/cobra"
)

// NewRenderCmd creates a new devspace render command
func NewRenderCmd(f factory.Factory, globalFlags *flags.GlobalFlags, rawConfig *RawConfig) *cobra.Command {
	cmd := &RunPipelineCmd{
		GlobalFlags:             globalFlags,
		SkipPushLocalKubernetes: true,
		Pipeline:                "deploy",
		Render:                  true,
		RenderWriter:            os.Stdout,
	}

	var pipeline *latest.Pipeline
	if rawConfig != nil && rawConfig.Config != nil && rawConfig.Config.Pipelines != nil {
		pipeline = rawConfig.Config.Pipelines["deploy"]
	}
	renderCmd := &cobra.Command{
		Use:   "render",
		Short: "Builds all defined images and shows the yamls that would be deployed",
		Long: `
#######################################################
################## devspace render #####################
#######################################################
Builds all defined images and shows the yamls that would
be deployed via helm and kubectl, but skips actual 
deployment.
#######################################################`,
		RunE: func(cobraCmd *cobra.Command, args []string) error {
			f.GetLog().Warnf("This command is deprecated, please use 'devspace deploy --render' instead")
			return cmd.Run(cobraCmd, args, f, "renderCommand")
		},
	}
	cmd.AddPipelineFlags(f, renderCmd, pipeline)
	return renderCmd
}

```

### Core Architecture Module: `e2e/framework/util.go`
```
package framework

import (
	"context"
	"fmt"
	ginkgo "github.com/onsi/ginkgo/v2"
	"os"
	"path/filepath"
	"sync"

	"github.com/loft-sh/devspace/pkg/devspace/config"
	"github.com/loft-sh/devspace/pkg/devspace/config/loader"
	devspacecontext "github.com/loft-sh/devspace/pkg/devspace/context"
	"github.com/loft-sh/devspace/pkg/devspace/dependency"
	"github.com/loft-sh/devspace/pkg/devspace/dependency/types"
	"github.com/loft-sh/devspace/pkg/devspace/kubectl"
	"github.com/loft-sh/devspace/pkg/util/factory"
	"github.com/loft-sh/devspace/pkg/util/message"
	"github.com/otiai10/copy"
	"github.com/pkg/errors"
)

func BeforeAll(body func()) {
	once := sync.Once{}
	ginkgo.BeforeEach(func() {
		once.Do(func() {
			body()
		})
	})
}

func LoadConfigWithOptionsAndResolve(f factory.Factory, client kubectl.Client, configPath string, configOptions *loader.ConfigOptions, resolveOptions dependency.ResolveOptions) (config.Config, []types.Dependency, error) {
	before, err := os.Getwd()
	if err != nil {
		return nil, nil, err
	}
	defer SwitchDir(before)

	// Set config root
	log := f.GetLog()
	configLoader, err := f.NewConfigLoader(configPath)
	if err != nil {
		return nil, nil, err
	}
	configExists, err := configLoader.SetDevSpaceRoot(log)
	if err != nil {
		return nil, nil, err
	} else if !configExists {
		return nil, nil, errors.New(message.ConfigNotFound)
	}

	// load config
	loadedConfig, err := configLoader.Load(context.Background(), client, configOptions, log)
	if err != nil {
		return nil, nil, err
	}

	// set devspacecontext
	ctx := devspacecontext.NewContext(context.Background(), loadedConfig.Variables(), log).WithConfig(loadedConfig)

	// resolve dependencies
	dependencies, err := dependency.NewManager(ctx, configOptions).ResolveAll(ctx, resolveOptions)
	if err != nil {
		return nil, nil, fmt.Errorf("error resolving dependencies: %v", err)
	}

	return loadedConfig, dependencies, nil
}

func LoadConfigWithOptions(f factory.Factory, client kubectl.Client, configPath string, configOptions *loader.ConfigOptions) (config.Config, []types.Dependency, error) {
	return LoadConfigWithOptionsAndResolve(f, client, configPath, configOptions, dependency.ResolveOptions{})
}

func LoadConfig(f factory.Factory, client kubectl.Client, configPath string) (config.Config, []types.Dependency, error) {
	return LoadConfigWithOptions(f, client, configPath, &loader.ConfigOptions{})
}

func InterruptChan() (chan error, func()) {
	once := sync.Once{}
	c := make(chan error)
	return c, func() {
		once.Do(func() {
			close(c)
		})
	}
}

func SwitchDir(dir string) {
	err := os.Chdir(dir)
	ExpectNoError(err)
}

func CleanupTempDir(initialDir, tempDir string) {
	err := os.RemoveAll(tempDir)
	ExpectNoError(err)

	err = os.Chdir(initialDir)
	ExpectNoError(err)
}

func CopyToTempDir(relativePath string) (string, error) {
	dir, err := os.MkdirTemp("", "temp-*")
	if err != nil {
		return "", err
	}

	dir, err = filepath.EvalSymlinks(dir)
	if err != nil {
		return "", err
	}

	err = copy.Copy(relativePath, dir)
	if err != nil {
		_ = os.RemoveAll(dir)
		return "", err
	}

	err = os.Chdir(dir)
	if err != nil {
		_ = os.RemoveAll(dir)
		return "", err
	}

	return dir, nil
}

func ChangeToTempDir() (string, error) {
	dir, err := os.MkdirTemp("", "")
	if err != nil {
		return "", err
	}

	err = os.Chdir(dir)
	if err != nil {
		_ = os.RemoveAll(dir)
		return "", err
	}

	return dir, nil
}

```

### Core Architecture Module: `helper/util/conn.go`
```
package util

import (
	"context"
	"io"
	"net"

	"google.golang.org/grpc"
	"google.golang.org/grpc/credentials/insecure"
)

// NewClientConnection creates a new client connection for the given reader and writer
func NewClientConnection(reader io.Reader, writer io.Writer) (*grpc.ClientConn, error) {
	pipe := NewStdStreamJoint(reader, writer, false)

	// Set up a connection to the server.
	return grpc.NewClient("passthrough:///",
		grpc.WithTransportCredentials(insecure.NewCredentials()),
		grpc.WithContextDialer(func(ctx context.Context, addr string) (net.Conn, error) {
			return pipe, nil
		}),
		grpc.WithLocalDNSResolution())
}

```

### Core Architecture Module: `helper/util/crc32/crc32.go`
```
package crc32

import (
	"hash/crc32"
	"io"
	"os"
)

func Checksum(filename string) (uint32, error) {
	tab := crc32.NewIEEE()
	file, err := os.Open(filename)
	if err != nil {
		return 0, err
	}
	defer file.Close()

	_, err = io.Copy(tab, file)
	if err != nil {
		return 0, err
	}

	return tab.Sum32(), nil
}

```

### Core Architecture Module: `helper/util/joint.go`
```
package util

import (
	"fmt"
	"io"
	"net"
	"os"
	"time"
)

// StdinAddr is the struct for the stdi
type StdinAddr struct {
	s string
}

// NewStdinAddr creates a new StdinAddr
func NewStdinAddr(s string) *StdinAddr {
	return &StdinAddr{s}
}

// Network implements interface
func (a *StdinAddr) Network() string {
	return "stdio"
}

func (a *StdinAddr) String() string {
	return a.s
}

// StdStreamJoint is the struct that implements the net.Conn interface
type StdStreamJoint struct {
	in     io.Reader
	out    io.Writer
	local  *StdinAddr
	remote *StdinAddr

	exitOnClose bool
}

// NewStdStreamJoint is used to implement the connection interface so we can connect to the rpc server
func NewStdStreamJoint(in io.Reader, out io.Writer, exitOnClose bool) *StdStreamJoint {
	return &StdStreamJoint{
		local:       NewStdinAddr("local"),
		remote:      NewStdinAddr("remote"),
		in:          in,
		out:         out,
		exitOnClose: exitOnClose,
	}
}

// LocalAddr implements interface
func (s *StdStreamJoint) LocalAddr() net.Addr {
	return s.local
}

// RemoteAddr implements interface
func (s *StdStreamJoint) RemoteAddr() net.Addr {
	return s.remote
}

// Read implements interface
func (s *StdStreamJoint) Read(b []byte) (n int, err error) {
	return s.in.Read(b)
}

// Write implements interface
func (s *StdStreamJoint) Write(b []byte) (n int, err error) {
	return s.out.Write(b)
}

// Close implements interface
func (s *StdStreamJoint) Close() error {
	if s.exitOnClose {
		// We kill ourself here because the streams are closed
		_, _ = fmt.Fprintf(os.Stderr, "Streams are closed")
		os.Exit(1)
	}

	return nil
}

// SetDeadline implements interface
func (s *StdStreamJoint) SetDeadline(t time.Time) error {
	return nil
}

// SetReadDeadline implements interface
func (s *StdStreamJoint) SetReadDeadline(t time.Time) error {
	return nil
}

// SetWriteDeadline implements interface
func (s *StdStreamJoint) SetWriteDeadline(t time.Time) error {
	return nil
}

```

### Core Architecture Module: `helper/util/listener.go`
```
package util

import (
	"net"
)

// NewStdinListener creates a new stdin listener
func NewStdinListener() *StdinListener {
	return &StdinListener{
		connChan: make(chan net.Conn),
	}
}

// StdinListener implements the listener interface
type StdinListener struct {
	connChan chan net.Conn
}

// Ready implements interface
func (lis *StdinListener) Ready(conn net.Conn) {
	lis.connChan <- conn
}

// Accept implements interface
func (lis *StdinListener) Accept() (net.Conn, error) {
	return <-lis.connChan, nil
}

// Close implements interface
func (lis *StdinListener) Close() error {
	return nil
}

// Addr implements interface
func (lis *StdinListener) Addr() net.Addr {
	return NewStdinAddr("listener")
}

```

### Core Architecture Module: `helper/util/pingtimeout/ping_timeout.go`
```
package pingtimeout

import (
	"fmt"
	"k8s.io/apimachinery/pkg/util/wait"
	"os"
	"sync"
	"time"
)

const (
	pingTimeout = time.Second * 60
)

type PingTimeout struct {
	lastPing      *time.Time
	lastPingMutex sync.Mutex
	lastPingOnce  sync.Once
}

func (p *PingTimeout) Ping() {
	p.lastPingMutex.Lock()
	defer p.lastPingMutex.Unlock()

	now := time.Now()
	p.lastPing = &now
}

func (p *PingTimeout) Start(stopChan chan struct{}) {
	p.lastPingOnce.Do(func() {
		p.Ping()
		go func() {
			wait.Until(func() {
				p.lastPingMutex.Lock()
				defer p.lastPingMutex.Unlock()

				if p.lastPing == nil {
					return
				}

				if time.Now().After(p.lastPing.Add(pingTimeout)) {
					_, _ = fmt.Fprintf(os.Stderr, "Pings timed out")
					os.Exit(1)
				}
			}, time.Second, stopChan)
		}()
	})
}

```

### Core Architecture Module: `helper/util/port/port.go`
```
package port

import (
	"net"
	"time"
)

func IsAvailable(addr string) (bool, error) {
	timeout := time.Millisecond * 500
	conn, err := net.DialTimeout("tcp", addr, timeout)
	if err != nil {
		// Try to create a server with the port
		server, err := net.Listen("tcp", addr)

		// if it fails then the port is likely taken
		if err != nil {
			return false, err
		}

		// close the server
		_ = server.Close()
		return true, nil
	}
	_ = conn.Close()
	return false, nil
}

```

### Core Architecture Module: `helper/util/restart.go`
```
package util

type ContainerRestarter interface {
	RestartContainer() error
}

```

### Core Architecture Module: `helper/util/restart_linux.go`
```
//go:build linux
// +build linux

package util

import (
	"context"
	"fmt"
	"os"
	"strconv"
	"strings"
	"syscall"
	"time"

	"github.com/loft-sh/devspace/helper/util/stderrlog"
	"github.com/loft-sh/devspace/pkg/devspace/build/builder/restart"
	"github.com/pkg/errors"
	"k8s.io/apimachinery/pkg/util/wait"
)

type containerRestarter struct {
}

func NewContainerRestarter() ContainerRestarter {
	return &containerRestarter{}
}

func (*containerRestarter) RestartContainer() error {
	pidFilePath := restart.ProcessIDFilePath

	// check if restart script is there
	_, err := os.Stat(restart.LegacyScriptPath)
	if err == nil {
		pidFilePath = restart.LegacyProcessIDFilePath
	} else {
		// check if restart script is there
		_, err = os.Stat(restart.ScriptPath)
		if err != nil {
			if os.IsNotExist(err) {
				return fmt.Errorf("the restart container utility script is not present in the container. Please make sure '%s' is in your container and wrapping the entrypoint", restart.ScriptPath)
			}

			return errors.Wrap(err, "cannot access restart helper script")
		}
	}

	// read current active process id
	pgidBytes, err := os.ReadFile(pidFilePath)
	if err != nil {
		if os.IsNotExist(err) {
			return nil
		}

		return errors.Wrap(err, "cannot access restart process id file")
	}

	// convert to int
	pgid, err := strconv.Atoi(strings.TrimSpace(string(pgidBytes)))
	if err != nil {
		return err
	}

	// delete the pid file
	err = os.Remove(pidFilePath)
	if err != nil {
		// someone else was faster than we were
		if os.IsNotExist(err) {
			return nil
		}

		return errors.Wrap(err, "cannot delete restart process id file")
	}

	// kill the process group
	procPath := "/proc/" + strconv.Itoa(pgid)

	for _, sig := range []syscall.Signal{syscall.SIGINT, syscall.SIGTERM, syscall.SIGKILL} {
		stderrlog.Infof("Sending %s signal...", sig.String())
		err = syscall.Kill(-pgid, sig)
		if err != nil {
			return nil
		}
		err = wait.PollUntilContextTimeout(context.TODO(), time.Second, 5*time.Second, true, func(_ context.Context) (done bool, err error) {
			_, err = os.Stat(procPath)
			return os.IsNotExist(err), nil
		})
		if err == nil {
			return nil
		}
	}

	stderrlog.Errorf("Timeout waiting for the process to terminate")
	return nil
}

```

### Core Architecture Module: `helper/util/restart_other.go`
```
//go:build !linux
// +build !linux

package util

func NewContainerRestarter() ContainerRestarter {
	return nil
}

```

### Core Architecture Module: `helper/util/stderrlog/stderrlog.go`
```
package stderrlog

import (
	"fmt"
	"io"
	"os"
)

var Writer io.Writer = os.Stderr

var debugModeEnabled = os.Getenv("DEVSPACE_HELPER_DEBUG") == "true"

func Errorf(message string, args ...interface{}) {
	_, _ = fmt.Fprintf(Writer, "error: "+message+"\n", args...)
}

func Infof(message string, args ...interface{}) {
	_, _ = fmt.Fprintf(Writer, message+"\n", args...)
}

func Debugf(message string, args ...interface{}) {
	if debugModeEnabled {
		_, _ = fmt.Fprintf(Writer, message+"\n", args...)
	}
}

```


### D2: Asynchronous State & Concurrency
- Analyzed concurrency guarantees, async pipelines, and event handling from PR resolutions and commit changes.

### D3: Error Boundaries, Recovery & Rollbacks
- Exception handling patterns and defect resolutions extracted from closed production bug issues:
- **Issue #2810** (2024-02-29): **Kaniko builds that use a serviceAccount fail to pull the base image**
  *Symptoms*: **What happened?**    In my EKS (AWS) cluster, Kaniko build pods crash when trying to pull the base image. My kaniko pods use a serviceAccount for pull credentials, and we recently started using [EKS pod identities](https://docs.aws.amazon.com/eks/latest/userguide/pod-id-how-it-works.html) to give permissions on AWS resources. This configuration works well with manually deployed kaniko jobs, or with skaffold builds, but fails with devspace builds  **Potential fix?**  The issue seems similar to this report, which suggests that it may just be a minimum SDK version required: https://github.com/hashicorp/terraform-provider-aws/issues/35857  The minimum version for the Go v1 SDK is v1.47.11 The minimum version for the Go v2 SDK is release-2023-11-14 https://docs.aws.amazon.com/eks/latest/userguide/pod-id-minimum-sdk.html  ``` info Using namespace 'asdf' info Using kube context 'arn:aws:eks:us-west-1:1234567890:cluster/one' Ensuring image pull secret for registry: 1234567890.dkr.ecr.us-west-1.amazonaws.com... build:vscode Rebuild image 1234567890.dkr.ecr.us-west-1.amazonaws.com/asdf because dockerfile has changed build:vscode Building image '1234567890.dkr.ecr.us-west-1.amazonaws.com/asdf:31c6fc404fad89da831df40ddab53803d6f448c92fee3a7df719017e49a6456a' with engine  'kaniko' build:vscode Waiting for build init container to start... build:vscode Uploading files to build container... build:vscode Uploaded 32.00 Kb 695.73 Mb/s build:vscode Uploaded files to conta
  **Post-Mortem & Fix Analysis**:
  > @bribroder  Can you try setting the [kaniko image](https://www.devspace.sh/docs/configuration/images/build-engines/kaniko#image) that is used? Here's an updated example config: ```yaml version: v2beta1 name: asdf  localRegistry:   enabled: false  images:   main:     image: 1234567890.dkr.ecr.us-west-1.amazonaws.com/asdf     dockerfile: ./Dockerfile     tags:     - $(bash get-tag.sh)     kaniko:       image: gcr.io/kaniko-project/executor:v1.20.1       cache: true       serviceAccount: asdf-kaniko       snapshotMode: "time"       namespace: asdf ```  I don't see anything in the releases notes that mention breaking changes, though there are a few with notes regarding an AWS auth regression, but it appears to have been resolved in v1.19.2. If this works out for you we can update the default kaniko image that DevSpace uses.
  > It works!! Nice sharpshooting, thanks very much!

- **Issue #2809** (2024-02-28): **double latest:latest tag in kind registry**
  *Symptoms*: <!-- Please use this template for reporting bugs and provide as much info as possible. Not doing so may result in your bug not being addressed in a timely manner. Thanks!-->  **What happened?**    I am trying to develop a custom airflow image (including development of some cusotm python packages - that's why I need devspace.sh) using airflow helm charts in local kubernetes on my laptop (I am using Ubuntu in WSL + kind as my kubernetes cluster). I am able to use the default airflow image successfully and trigger file synchronization into the airflow containers, but I would like to replace the image from helm charts with my custom image (it has some python dependencies installed needed for development, which are not present in the default container). I am unable to replace the image in helm charts - no matter how I try, I get `Init:InvalidImageName` from kubernetes:  ``` NAME                                   READY   STATUS                  RESTARTS   AGE airflow-postgresql-0                   1/1     Running                 0          35s airflow-redis-0                        1/1     Running                 0          35s airflow-run-airflow-migrations-zk5qr   0/1     InvalidImageName        0          35s airflow-scheduler-869cb647c9-zgbq2     0/2     Init:InvalidImageName   0          35s airflow-statsd-5667dd85ff-zqvpk        1/1     Running                 0          35s airflow-triggerer-0                    0/2     Init:InvalidImageName   0          35s ai
  **Post-Mortem & Fix Analysis**:
  > Hello, there are a couple options to avoid this issue. The first is to use [updateImageTags: false](https://www.devspace.sh/docs/configuration/deployments/#deployments-updateImageTags). This will prevent DevSpace from attempting to rewrite image references that don't have tags. Here's a sample that worked for my testing: ```yaml deployments:   airflow:     updateImageTags: false     helm:       chart:         repo: https://airflow.apache.org         name: airflow       values:         images:           airflow:             repository: custom/apache-airflow             tag: latest ```  The other option is to use DevSpace's [${runtime.variables}](https://www.devspace.sh/docs/configuration/runtime-variables) to be a little more explicit about what DevSpace should substitute (if you want anything substituted at all). These are more likely to be useful if you're using DevSpace's dynamic tags. Here's an example that also worked for me: ```yaml deployments:   airflow:     
  > Thanks for your time. I went with the second option as I have a feeling it will save me (or a teammate) some unnecessary troubles in the future. It works :) 
  > Hey @szymi-  I'm glad Russ's suggestions unblocked your use case.   Closing this issue for now then, please feel free to re-open it if you're still facing similar issues! 

- **Issue #2808** (2024-02-27): **double latest:latest tag in do**
  *Symptoms*: <!-- Please use this template for reporting bugs and provide as much info as possible. Not doing so may result in your bug not being addressed in a timely manner. Thanks!-->  **What happened?**    I am trying to develop a custom airflow image (including development of some cusotm python packages - that's why I need devspace.sh) using airflow helm charts in local kubernetes on my laptop (I am using Ubuntu in WSL + kind as my kubernetes cluster). I am able to use the default airflow image successfully and trigger file synchronization into the airflow containers, but I would like to replace the image from helm charts with my custom image (it has some python dependencies installed needed for development, which are not present in the default container). I am unable to replace the image in helm charts - no matter how I try, I get `Init:InvalidImageName` from kubernetes:  ``` NAME                                   READY   STATUS                  RESTARTS   AGE airflow-postgresql-0                   1/1     Running                 0          35s airflow-redis-0                        1/1     Running                 0          35s airflow-run-airflow-migrations-zk5qr   0/1     InvalidImageName        0          35s airflow-scheduler-869cb647c9-zgbq2     0/2     Init:InvalidImageName   0          35s airflow-statsd-5667dd85ff-zqvpk        1/1     Running                 0          35s airflow-triggerer-0                    0/2     Init:InvalidImageName   0          35s ai
  **Post-Mortem & Fix Analysis**:
  > This looks like it may have the same solution as #2809

- **Issue #2791** (2025-01-10): **Incorrect Documentation (function start_dev --disable-open)**
  *Symptoms*: <!-- Please use this template for reporting bugs and provide as much info as possible. Not doing so may result in your bug not being addressed in a timely manner. Thanks!-->  **What happened?**   Pages https://www.devspace.sh/docs/configuration/functions/ and https://www.devspace.sh/docs/configuration/pipelines/ define `start_dev --disable-open` as "If enabled will not replace any pods". I believe the description is incorrect. <img width="1027" alt="Screenshot 2024-01-13" src="https://github.com/devspace-sh/devspace/assets/26501155/8bcfb185-3fc6-462a-9bab-099f6085eca4">  **What did you expect to happen instead?**   Description of `start_dev --disable-open` should say "If enabled will not auto-open the URL". See https://www.devspace.sh/docs/configuration/dev/connections/open for the exact description.  ----  This might be related to an earlier issue https://github.com/devspace-sh/devspace/issues/2122
  **Post-Mortem & Fix Analysis**:
  > Hey @timofey-drozhzhin  Thanks for reaching out!  We'll take a look and fix the docs. If you want to and find the time by then, please feel free to open a PR. 
  > I opened a PR for this fix https://github.com/devspace-sh/devspace/pull/2803

- **Issue #2788** (2024-01-22): **Helper restart does not give container process the chance to shut down properly**
  *Symptoms*: **What happened?**    When my container is restarted due to sync.onUpload.restartContainer, the container process is (almost) immediately killed. In my case, this prevents the watcher from cleaning up the subprocess running in another process group.  **What did you expect to happen instead?**    The restart helper should send SIGINT, SIGTERM and finally SIGKILL, with some time in-between the signals.  **How can we reproduce the bug?** (as minimally and precisely as possible)    My devspace.yaml: ``` version: v2beta1 dev:   mypod:     # ...     sync:       - path: .:.         onUpload:           restartContainer: true ```  **Local Environment:**   - DevSpace Version: 6.3.8 - Operating System: linux - ARCH of the OS: AMD64 **Kubernetes Cluster:**   - Kubernetes Version: v1.26.3+k3s1  **Anything else we need to know?**   

- **Issue #2783** (2024-01-11): **Endless wait loop when using multiple containers with delayed start**
  *Symptoms*: **What happened?**    When using pods with multiple containers and `startContainer: true` sync paths, all containers except one enter an infinite wait loop on startup. The dev pod is set up and the logs report `Initial sync completed`, but all containers except one keep spewing `(Still waiting...)` messages.  **What did you expect to happen instead?**    All containers start after initial sync is completed.  **How can we reproduce the bug?** (as minimally and precisely as possible)    My devspace.yaml: ``` version: v2beta1 dev:   mypod:     # ...     containers:       container1:         # ...         sync:           - path: .:/my/synced/path             startContainer: true       container2:         # ...         sync:           - path: .:/my/synced/path             startContainer: true ```  **Local Environment:**   - DevSpace Version: 6.3.8 - Operating System: linux - ARCH of the OS: AMD64  **Kubernetes Cluster:**   - Kubernetes Version: v1.26.3+k3s1  **Anything else we need to know?**   

- **Issue #2782** (2024-01-11): **Persistent paths not mounted when using multiple containers**
  *Symptoms*: **What happened?**    When using multiple containers, `devspace dev` will create the persistent volume, but fails to mount it on the dev containers. Both the `volumes` and `volumeMounts` entries are missing from the pathed pod spec.  **What did you expect to happen instead?**    Persistent paths are mounted in the dev container.  **How can we reproduce the bug?** (as minimally and precisely as possible)    My devspace.yaml: ``` version: v2beta1 dev:   mypod:     # ...     containers:       mycontainer1:         # ...         persistPaths:           - path: /my/persistent/path       mycontainer2:         # ...         persistPaths:           - path: /my/other/persistent/path ```  **Local Environment:**   - DevSpace Version: 6.3.8 - Operating System: linux - ARCH of the OS: AMD64  **Kubernetes Cluster:**   - Kubernetes Version: v1.26.3+k3s1  **Anything else we need to know?**   

- **Issue #2776** (2024-01-02): **Devspace dev throws exception when the container name is too long and the `startContainer` is set to `true`**
  *Symptoms*: <!-- Please use this template for reporting bugs and provide as much info as possible. Not doing so may result in your bug not being addressed in a timely manner. Thanks!-->  **What happened?**   Devspace dev command is throwing an error when the container name is too long when `startContainer` is set to `true` because it's trying to inject the `restart-helper`: ``` [   spec.template.annotations: Invalid value: "devspace.sh/restart-helper-super-very-long-name-super-very-long-name-super-very-long-name": name part must be no more than 63 characters,   spec.template.spec.volumes[8].downwardAPI.fieldRef: Invalid value: "devspace.sh/restart-helper--super-very-long-name-super-very-long-name-super-very-long-name": name part must be no more than 63 characters ] ```  In this example, the container name is too long and the deployment creation is rejected by Kubernetes because the `fieldRef` value is too long ([Code](https://github.com/devspace-sh/devspace/blob/main/pkg/devspace/services/podreplace/builder.go#L336)).  **What did you expect to happen instead?**   Ideally, Devspace trims the `fieldRef` if it's more than the characters limit or allow a customization of the value.  **How can we reproduce the bug?** (as minimally and precisely as possible)    devspace.yaml: ``` version: v2beta1 name: nginx-k8s pipelines:   dev:     run: |-       start_dev app dev:   app:     command:       - /docker-entrypoint.sh     args:       - nginx       - -g       - d

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

### Incident Patch 1: `8ff62607` (2026-05-17)
**Commit Message**: fix: examples/kind/package.json to reduce vulnerabilities

The following vulnerabilities are fixed with an upgrade:
- https://snyk.io/vuln/SNYK-JS-QS-16721866

**File**: `examples/kind/package.json` (modified, +1/-1)
```diff
@@ -7,7 +7,7 @@
     "start": "nodemon index.js"
   },
   "dependencies": {
-    "express": "^4.22.0",
+    "express": "^4.22.2",
     "nodemon": "^3.1.12"
   },
   "keywords": [
```

---

### Incident Patch 2: `a5caae0f` (2026-05-17)
**Commit Message**: fix: examples/buildkit/package.json to reduce vulnerabilities

The following vulnerabilities are fixed with an upgrade:
- https://snyk.io/vuln/SNYK-JS-QS-16721866

**File**: `examples/buildkit/package.json` (modified, +1/-1)
```diff
@@ -7,7 +7,7 @@
     "start": "nodemon index.js"
   },
   "dependencies": {
-    "express": "^4.22.0",
+    "express": "^4.22.2",
     "nodemon": "^3.1.12"
   },
   "keywords": [
```

---

### Incident Patch 3: `489d695f` (2026-05-28)
**Commit Message**: Merge pull request #3258 from devspace-sh/snyk-fix-bd8c4035c78dfc4e0221725dcc53d78e

[Snyk] Security upgrade golang from 1.13 to 1.26.3

**File**: `vendor/github.com/creack/pty/Dockerfile.riscv` (modified, +1/-1)
```diff
@@ -1,5 +1,5 @@
 # NOTE: Using 1.13 as a base to build the RISCV compiler, the resulting version is based on go1.6.
-FROM golang:1.13
+FROM golang:1.26.3
 
 # Clone and complie a riscv compatible version of the go compiler.
 RUN git clone https://review.gerrithub.io/riscv/riscv-go /riscv-go
```

---

### Incident Patch 4: `1eb6b3bf` (2026-05-28)
**Commit Message**: Merge pull request #3257 from devspace-sh/snyk-fix-7a9dd7c187568ac0580d32ab4e4bdf6a

[Snyk] Security upgrade workbox-webpack-plugin from 7.4.0 to 7.4.1

**File**: `ui/package-lock.json` (modified, +722/-285)
```diff
@@ -67,7 +67,7 @@
         "webpack-dev-server": "4.15.2",
         "webpack-manifest-plugin": "6.0.1",
         "whatwg-fetch": "2.0.3",
-        "workbox-webpack-plugin": "^7.3.0",
+        "workbox-webpack-plugin": "^7.4.1",
         "xterm": "4.1.0"
       },
       "devDependencies": {
@@ -115,9 +115,9 @@
       }
     },
     "node_modules/@babel/compat-data": {
-      "version": "7.29.0",
-      "resolved": "https://registry.npmjs.org/@babel/compat-data/-/compat-data-7.29.0.tgz",
-      "integrity": "sha512-T1NCJqT/j9+cn8fvkt7jtwbLBfLC/1y1c7NtCeXFRgzGTsafi68MRv8yzkYSapBnFA6L3U2VSc02ciDzoAJhJg==",
+      "version": "7.29.3",
+      "resolved": "https://registry.npmjs.org/@babel/compat-data/-/compat-data-7.29.3.tgz",
+      "integrity": "sha512-LIVqM46zQWZhj17qA8wb4nW/ixr2y1Nw+r1etiAWgRM6U1IqP+LNhL1yg440jYZR72jCWcWbLWzIosH+uP1fqg==",
       "license": "MIT",
       "engines": {
         "node": ">=6.9.0"
@@ -128,7 +128,6 @@
       "resolved": "https://registry.npmjs.org/@babel/core/-/core-7.28.0.tgz",
       "integrity": "sha512-UlLAnTPrFdNGoFtbSXwcGFQBtQZJCNjaN6hQNP3UPvuNXT1i82N26KL3dZeIpNalWywr9IuQuncaAfUaS1g6sQ==",
       "license": "MIT",
-      "peer": true,
       "dependencies": {
         "@ampproject/remapping": "^2.2.0",
         "@babel/code-frame": "^7.27.1",
@@ -199,17 +198,17 @@
       }
     },
     "node_modules/@babel/helper-create-class-features-plugin": {
-      "version": "7.28.6",
-      "resolved": "https://registry.npmjs.org/@babel/helper-create-class-features-plugin/-/helper-create-class-features-plugin-7.28.6.tgz",
-      "integrity": "sha512-dTOdvsjnG3xNT9Y0AUg1wAl38y+4Rl4sf9caSQZOXdNqVn+H+HbbJ4IyyHaIqNR6SW9oJpA/RuRjsjCw2IdIow==",
+      "version": "7.29.3",
+      "resolved": "https://registry.npmjs.org/@babel/helper-create-class-features-plugin/-/helper-create-class-features-plugin-7.29.3.tgz",
+      "integrity": "sha512-RpLYy2sb51oNLjuu1iD3bwBqCBWUzjO0ocp+iaCP/lJtb2CPLcnC2Fftw+4sAzaMELGeWTgExSKADbdo0GFVzA==",
       "license": "MIT",
       "dependencies": {
         "@babel/helper-annotate-as-pure": "^7.27.3",
         "@babel/helper-member-expression-to-functions": "^7.28.5",
         "@babel/helper-optimise-call-expression": "^7.27.1",
         "@babel/helper-replace-supers": "^7.28.6",
         "@babel/helper-skip-transparent-expression-wrappers": "^7.27.1",
-        "@babel/traverse": "^7.28.6",
+        "@babel/traverse": "^7.29.0",
         "semver": "^6.3.1"
       },
       "engines": {
@@ -593,6 +592,22 @@
         "@babel/core": "^7.0.0"
       }
     },
+    "node_modules/@babel/plugin-bugfix-safari-rest-destructuring-rhs-array": {
+      "version": "7.29.3",
+      "resolved": "https://registry.npmjs.org/@babel/plugin-bugfix-safari-rest-destructuring-rhs-array/-/plugin-bugfix-safari-rest-destructuring-rhs-array-7.29.3.tgz",
+      "integrity": "sha512-SRS46DFR4HqzUzCVgi90/xMoL+zeBDBvWdKYXSEzh79kXswNFEglUpMKxR04//dPqwYXWUBJ3mpUd933ru9Kmg==",
+      "license": "MIT",
+      "dependencies": {
+        "@babel/helper-plugin-utils": "^7.28.6",
+        "@babel/helper-skip-transparent-expression-wrappers": "^7.27.1"
+      },
+      "engines": {
+        "node": ">=6.9.0"
+      },
+      "peerDependencies": {
+        "@babel/core": "^7.0.0"
+      }
+    },
     "node_modules/@babel/plugin-bugfix-v8-spread-parameters-in-optional-chaining": {
       "version": "7.27.1",
       "resolved": "https://registry.npmjs.org/@babel/plugin-bugfix-v8-spread-parameters-in-optional-chaining/-/plugin-bugfix-v8-spread-parameters-in-optional-chaining-7.27.1.tgz",
@@ -2167,6 +2182,7 @@
       "integrity": "sha512-IchNf6dN4tHoMFIn/7OE8LWZ19Y6q/67Bmf6vnGREv8RSbBVb9LPJxEcnwrcwX6ixSvaiGoomAUvu4YSxXrVgw==",
       "license": "MIT",
       "optional": true,
+      "peer": true,
       "dependencies": {
         "@jridgewell/trace-mapping": "0.3.9"
       },
@@ -2180,6 +2196,7 @@
       "integrity": "sha512-3Belt6tdc8bPgAtbcmdtNJlirVoTmEb5e2gC94PnkwEW9jI6CAHUeoG85tjWP5WquqfavoMtMwiG4P926ZKKuQ==",
       "license": "MIT",
       "optional": true,
+      "peer": true,
       "dependencies": {
         "@jridgewell/resolve-uri": "^3.0.3",
         "@jridgewell/sourcemap-codec": "^1.4.10"
@@ -2253,7 +2270,6 @@
       "integrity": "sha512-YUcsLQKYb6DmaJjIHdDWpBIGCcyE/W+p/LMGvjQem55Mm2XWVAP5kWTMKWLv9lwpCVjpLxPyOMOyUocP1GxrtA==",
       "hasInstallScript": true,
       "license": "MIT",
-      "peer": true,
       "dependencies": {
         "@fortawesome/fontawesome-common-types": "^0.2.36"
       },
@@ -3167,6 +3183,51 @@
         "node": ">=8"
       }
     },
+    "node_modules/@jest/core/node_modules/ts-node": {
+      "version": "10.9.2",
+      "resolved": "https://registry.npmjs.org/ts-node/-/ts-node-10.9.2.tgz",
+      "integrity": "sha512-f0FFpIdcHgn8zcPSbf1dRevwt047YMnaiJM3u2w2RewrB+fob/zePZcrOyQoLMMO7aBIddLcQIEK5dYjkLnGrQ==",
+      "license": "MIT",
+      "optional": true,
+      "peer": true,
+      "dependencies": {
+        "@cspotcode/source-map-support": "^0.8.0",
+        "@ts
```

**File**: `ui/package.json` (modified, +1/-1)
```diff
@@ -62,7 +62,7 @@
     "webpack-dev-server": "4.15.2",
     "webpack-manifest-plugin": "6.0.1",
     "whatwg-fetch": "2.0.3",
-    "workbox-webpack-plugin": "^7.3.0",
+    "workbox-webpack-plugin": "^7.4.1",
     "xterm": "4.1.0"
   },
   "scripts": {
```

---

### Incident Patch 5: `ea721606` (2026-05-17)
**Commit Message**: fix: examples/quickstart-kubectl/package.json & examples/quickstart-kubectl/package-lock.json to reduce vulnerabilities

The following vulnerabilities are fixed with an upgrade:
- https://snyk.io/vuln/SNYK-JS-QS-16721866

**File**: `examples/quickstart-kubectl/package-lock.json` (modified, +194/-94)
```diff
@@ -9,7 +9,7 @@
       "version": "0.0.1",
       "license": "MIT",
       "dependencies": {
-        "express": "^4.18.1",
+        "express": "^4.22.2",
         "nodemon": "^3.1.12"
       }
     },
@@ -65,28 +65,58 @@
       }
     },
     "node_modules/body-parser": {
-      "version": "1.20.3",
-      "resolved": "https://registry.npmjs.org/body-parser/-/body-parser-1.20.3.tgz",
-      "integrity": "sha512-7rAxByjUMqQ3/bHJy7D6OGXvx/MMc4IqBn/X0fcM1QUcAItpZrBEYhWGem+tzXH90c+G01ypMcYJBO9Y30203g==",
+      "version": "1.20.5",
+      "resolved": "https://registry.npmjs.org/body-parser/-/body-parser-1.20.5.tgz",
+      "integrity": "sha512-3grm+/2tUOvu2cjJkvsIxrv/wVpfXQW4PsQHYm7yk4vfpu7Ekl6nEsYBoJUL6qDwZUx8wUhQ8tR2qz+ad9c9OA==",
+      "license": "MIT",
       "dependencies": {
-        "bytes": "3.1.2",
+        "bytes": "~3.1.2",
         "content-type": "~1.0.5",
         "debug": "2.6.9",
         "depd": "2.0.0",
-        "destroy": "1.2.0",
-        "http-errors": "2.0.0",
-        "iconv-lite": "0.4.24",
-        "on-finished": "2.4.1",
-        "qs": "6.13.0",
-        "raw-body": "2.5.2",
+        "destroy": "~1.2.0",
+        "http-errors": "~2.0.1",
+        "iconv-lite": "~0.4.24",
+        "on-finished": "~2.4.1",
+        "qs": "~6.15.1",
+        "raw-body": "~2.5.3",
         "type-is": "~1.6.18",
-        "unpipe": "1.0.0"
+        "unpipe": "~1.0.0"
       },
       "engines": {
         "node": ">= 0.8",
         "npm": "1.2.8000 || >= 1.4.16"
       }
     },
+    "node_modules/body-parser/node_modules/http-errors": {
+      "version": "2.0.1",
+      "resolved": "https://registry.npmjs.org/http-errors/-/http-errors-2.0.1.tgz",
+      "integrity": "sha512-4FbRdAX+bSdmo4AUFuS0WNiPz8NgFt+r8ThgNWmlrjQjt1Q7ZR9+zTlce2859x4KSXrwIsaeTqDoKQmtP8pLmQ==",
+      "license": "MIT",
+      "dependencies": {
+        "depd": "~2.0.0",
+        "inherits": "~2.0.4",
+        "setprototypeof": "~1.2.0",
+        "statuses": "~2.0.2",
+        "toidentifier": "~1.0.1"
+      },
+      "engines": {
+        "node": ">= 0.8"
+      },
+      "funding": {
+        "type": "opencollective",
+        "url": "https://opencollective.com/express"
+      }
+    },
+    "node_modules/body-parser/node_modules/statuses": {
+      "version": "2.0.2",
+      "resolved": "https://registry.npmjs.org/statuses/-/statuses-2.0.2.tgz",
+      "integrity": "sha512-DvEy55V3DB7uknRo+4iOGT5fP1slR8wQohVdknigZPMpMstaKJQWhwiYBACJE3Ul2pTnATihhBYnRhZQHGBiRw==",
+      "license": "MIT",
+      "engines": {
+        "node": ">= 0.8"
+      }
+    },
     "node_modules/brace-expansion": {
       "version": "5.0.5",
       "resolved": "https://registry.npmjs.org/brace-expansion/-/brace-expansion-5.0.5.tgz",
@@ -114,6 +144,7 @@
       "version": "3.1.2",
       "resolved": "https://registry.npmjs.org/bytes/-/bytes-3.1.2.tgz",
       "integrity": "sha512-/Nf7TyzTx6S3yRJObOAV7956r8cr2+Oj8AC5dt8wSP3BQAoeX58NoHyCU8P8zGkNXStjTSi6fzO6F0pBdcYbEg==",
+      "license": "MIT",
       "engines": {
         "node": ">= 0.8"
       }
@@ -122,6 +153,7 @@
       "version": "1.0.2",
       "resolved": "https://registry.npmjs.org/call-bind-apply-helpers/-/call-bind-apply-helpers-1.0.2.tgz",
       "integrity": "sha512-Sp1ablJ0ivDkSzjcaJdxEunN5/XvksFJ2sMBFfq6x0ryhQV/2b/KwFe21cMpmHtPOSij8K99/wSfoEuTObmuMQ==",
+      "license": "MIT",
       "dependencies": {
         "es-errors": "^1.3.0",
         "function-bind": "^1.1.2"
@@ -134,6 +166,7 @@
       "version": "1.0.4",
       "resolved": "https://registry.npmjs.org/call-bound/-/call-bound-1.0.4.tgz",
       "integrity": "sha512-+ys997U96po4Kx/ABpBCqhA9EuxJaQWDQg7295H4hBphv3IZg0boBKuwYpt4YXp6MZ5AmZQnU/tyMTlRpaSejg==",
+      "license": "MIT",
       "dependencies": {
         "call-bind-apply-helpers": "^1.0.2",
         "get-intrinsic": "^1.3.0"
@@ -180,6 +213,7 @@
       "version": "1.0.5",
       "resolved": "https://registry.npmjs.org/content-type/-/content-type-1.0.5.tgz",
       "integrity": "sha512-nTjqfcBFEipKdXCv4YDQWCfmcLZKm81ldF0pAopTvyrFGVbcR6P/VAAd5G7N+0tTr8QqiU0tFadD6FK4NtJwOA==",
+      "license": "MIT",
       "engines": {
         "node": ">= 0.6"
       }
@@ -226,6 +260,7 @@
       "version": "1.0.1",
       "resolved": "https://registry.npmjs.org/dunder-proto/-/dunder-proto-1.0.1.tgz",
       "integrity": "sha512-KIN/nDJBQRcXw0MLVhZE9iQHmG68qAVIBg9CqmUYjmQIhgij9U5MFvrqkUL5FbtyyzZuOeOt0zdeRe4UY7ct+A==",
+      "license": "MIT",
       "dependencies": {
         "call-bind-apply-helpers": "^1.0.1",
         "es-errors": "^1.3.0",
@@ -252,6 +287,7 @@
       "version": "1.0.1",
       "resolved": "https://registry.npmjs.org/es-define-property/-/es-define-property-1.0.1.tgz",
       "integrity": "sha512-e3nRfgfUZ4rNGL232gUgX06QNyyez04KdjFrF+LTRoOXmrOgFKDg4BCdsjW8EnT69eqdYGmRpJwiPVYNrCaW3g==",
+      "license": "MIT",
       "engines": {
         "node": ">= 0.4"
       }
@@ -260,6 +296,7 @@
       "version": "1.3.0",
       "resolved": "https://registry.npmjs.org/es-errors/-/es-errors-1.3.0.tg
```

**File**: `examples/quickstart-kubectl/package.json` (modified, +1/-1)
```diff
@@ -7,7 +7,7 @@
     "start": "nodemon index.js"
   },
   "dependencies": {
-    "express": "^4.18.1",
+    "express": "^4.22.2",
     "nodemon": "^3.1.12"
   },
   "keywords": [
```

---

### Incident Patch 6: `2b0b3166` (2026-05-17)
**Commit Message**: fix: examples/buildkit-in-cluster/package.json & examples/buildkit-in-cluster/package-lock.json to reduce vulnerabilities

The following vulnerabilities are fixed with an upgrade:
- https://snyk.io/vuln/SNYK-JS-QS-16721866

**File**: `examples/buildkit-in-cluster/package-lock.json` (modified, +103/-51)
```diff
@@ -9,7 +9,7 @@
       "version": "0.0.1",
       "license": "MIT",
       "dependencies": {
-        "express": "^4.22.0",
+        "express": "^4.22.2",
         "nodemon": "^3.1.12"
       }
     },
@@ -65,28 +65,58 @@
       }
     },
     "node_modules/body-parser": {
-      "version": "1.20.3",
-      "resolved": "https://registry.npmjs.org/body-parser/-/body-parser-1.20.3.tgz",
-      "integrity": "sha512-7rAxByjUMqQ3/bHJy7D6OGXvx/MMc4IqBn/X0fcM1QUcAItpZrBEYhWGem+tzXH90c+G01ypMcYJBO9Y30203g==",
+      "version": "1.20.5",
+      "resolved": "https://registry.npmjs.org/body-parser/-/body-parser-1.20.5.tgz",
+      "integrity": "sha512-3grm+/2tUOvu2cjJkvsIxrv/wVpfXQW4PsQHYm7yk4vfpu7Ekl6nEsYBoJUL6qDwZUx8wUhQ8tR2qz+ad9c9OA==",
+      "license": "MIT",
       "dependencies": {
-        "bytes": "3.1.2",
+        "bytes": "~3.1.2",
         "content-type": "~1.0.5",
         "debug": "2.6.9",
         "depd": "2.0.0",
-        "destroy": "1.2.0",
-        "http-errors": "2.0.0",
-        "iconv-lite": "0.4.24",
-        "on-finished": "2.4.1",
-        "qs": "6.13.0",
-        "raw-body": "2.5.2",
+        "destroy": "~1.2.0",
+        "http-errors": "~2.0.1",
+        "iconv-lite": "~0.4.24",
+        "on-finished": "~2.4.1",
+        "qs": "~6.15.1",
+        "raw-body": "~2.5.3",
         "type-is": "~1.6.18",
-        "unpipe": "1.0.0"
+        "unpipe": "~1.0.0"
       },
       "engines": {
         "node": ">= 0.8",
         "npm": "1.2.8000 || >= 1.4.16"
       }
     },
+    "node_modules/body-parser/node_modules/http-errors": {
+      "version": "2.0.1",
+      "resolved": "https://registry.npmjs.org/http-errors/-/http-errors-2.0.1.tgz",
+      "integrity": "sha512-4FbRdAX+bSdmo4AUFuS0WNiPz8NgFt+r8ThgNWmlrjQjt1Q7ZR9+zTlce2859x4KSXrwIsaeTqDoKQmtP8pLmQ==",
+      "license": "MIT",
+      "dependencies": {
+        "depd": "~2.0.0",
+        "inherits": "~2.0.4",
+        "setprototypeof": "~1.2.0",
+        "statuses": "~2.0.2",
+        "toidentifier": "~1.0.1"
+      },
+      "engines": {
+        "node": ">= 0.8"
+      },
+      "funding": {
+        "type": "opencollective",
+        "url": "https://opencollective.com/express"
+      }
+    },
+    "node_modules/body-parser/node_modules/statuses": {
+      "version": "2.0.2",
+      "resolved": "https://registry.npmjs.org/statuses/-/statuses-2.0.2.tgz",
+      "integrity": "sha512-DvEy55V3DB7uknRo+4iOGT5fP1slR8wQohVdknigZPMpMstaKJQWhwiYBACJE3Ul2pTnATihhBYnRhZQHGBiRw==",
+      "license": "MIT",
+      "engines": {
+        "node": ">= 0.8"
+      }
+    },
     "node_modules/brace-expansion": {
       "version": "5.0.5",
       "resolved": "https://registry.npmjs.org/brace-expansion/-/brace-expansion-5.0.5.tgz",
@@ -125,6 +155,7 @@
       "version": "3.1.2",
       "resolved": "https://registry.npmjs.org/bytes/-/bytes-3.1.2.tgz",
       "integrity": "sha512-/Nf7TyzTx6S3yRJObOAV7956r8cr2+Oj8AC5dt8wSP3BQAoeX58NoHyCU8P8zGkNXStjTSi6fzO6F0pBdcYbEg==",
+      "license": "MIT",
       "engines": {
         "node": ">= 0.8"
       }
@@ -199,6 +230,7 @@
       "version": "1.0.5",
       "resolved": "https://registry.npmjs.org/content-type/-/content-type-1.0.5.tgz",
       "integrity": "sha512-nTjqfcBFEipKdXCv4YDQWCfmcLZKm81ldF0pAopTvyrFGVbcR6P/VAAd5G7N+0tTr8QqiU0tFadD6FK4NtJwOA==",
+      "license": "MIT",
       "engines": {
         "node": ">= 0.6"
       }
@@ -313,14 +345,14 @@
       }
     },
     "node_modules/express": {
-      "version": "4.22.0",
-      "resolved": "https://registry.npmjs.org/express/-/express-4.22.0.tgz",
-      "integrity": "sha512-c2iPh3xp5vvCLgaHK03+mWLFPhox7j1LwyxcZwFVApEv5i0X+IjPpbT50SJJwwLpdBVfp45AkK/v+AFgv/XlfQ==",
+      "version": "4.22.2",
+      "resolved": "https://registry.npmjs.org/express/-/express-4.22.2.tgz",
+      "integrity": "sha512-IuL+Elrou2ZvCFHs18/CIzy2Nzvo25nZ1/D2eIZlz7c+QUayAcYoiM2BthCjs+EBHVpjYjcuLDAiCWgeIX3X1Q==",
       "license": "MIT",
       "dependencies": {
         "accepts": "~1.3.8",
         "array-flatten": "1.1.1",
-        "body-parser": "~1.20.3",
+        "body-parser": "~1.20.5",
         "content-disposition": "~0.5.4",
         "content-type": "~1.0.4",
         "cookie": "~0.7.1",
@@ -339,7 +371,7 @@
         "parseurl": "~1.3.3",
         "path-to-regexp": "~0.1.12",
         "proxy-addr": "~2.0.7",
-        "qs": "~6.14.0",
+        "qs": "~6.15.1",
         "range-parser": "~1.2.1",
         "safe-buffer": "5.2.1",
         "send": "~0.19.0",
@@ -358,21 +390,6 @@
         "url": "https://opencollective.com/express"
       }
     },
-    "node_modules/express/node_modules/qs": {
-      "version": "6.14.2",
-      "resolved": "https://registry.npmjs.org/qs/-/qs-6.14.2.tgz",
-      "integrity": "sha512-V/yCWTTF7VJ9hIh18Ugr2zhJMP01MY7c5kh4J870L7imm6/DIzBsNLTXzMwUA3yZ5b/KBqLx8Kp3uRvd7xSe3Q==",
-      "license": "BSD-3-Clause",
-      "dependencies": {
-        "side-channel": "^1.1.0"
-      },
-      "engines": {
-        "node": ">=0.6"
-      },
-      "funding": {
-        "
```

**File**: `examples/buildkit-in-cluster/package.json` (modified, +1/-1)
```diff
@@ -7,7 +7,7 @@
     "start": "nodemon index.js"
   },
   "dependencies": {
-    "express": "^4.22.0",
+    "express": "^4.22.2",
     "nodemon": "^3.1.12"
   },
   "keywords": [
```

---

### Incident Patch 7: `04fed680` (2026-05-17)
**Commit Message**: fix: examples/kustomize/package.json & examples/kustomize/package-lock.json to reduce vulnerabilities

The following vulnerabilities are fixed with an upgrade:
- https://snyk.io/vuln/SNYK-JS-QS-16721866

**File**: `examples/kustomize/package-lock.json` (modified, +176/-96)
```diff
@@ -9,8 +9,8 @@
             "version": "0.0.1",
             "license": "MIT",
             "dependencies": {
-                "express": "^4.22.0",
-                "nodemon": "^3.1.12"
+                "express": "^4.22.2",
+                "nodemon": "3.1.12"
             }
         },
         "node_modules/abbrev": {
@@ -65,28 +65,58 @@
             }
         },
         "node_modules/body-parser": {
-            "version": "1.20.3",
-            "resolved": "https://registry.npmjs.org/body-parser/-/body-parser-1.20.3.tgz",
-            "integrity": "sha512-7rAxByjUMqQ3/bHJy7D6OGXvx/MMc4IqBn/X0fcM1QUcAItpZrBEYhWGem+tzXH90c+G01ypMcYJBO9Y30203g==",
+            "version": "1.20.5",
+            "resolved": "https://registry.npmjs.org/body-parser/-/body-parser-1.20.5.tgz",
+            "integrity": "sha512-3grm+/2tUOvu2cjJkvsIxrv/wVpfXQW4PsQHYm7yk4vfpu7Ekl6nEsYBoJUL6qDwZUx8wUhQ8tR2qz+ad9c9OA==",
+            "license": "MIT",
             "dependencies": {
-                "bytes": "3.1.2",
+                "bytes": "~3.1.2",
                 "content-type": "~1.0.5",
                 "debug": "2.6.9",
                 "depd": "2.0.0",
-                "destroy": "1.2.0",
-                "http-errors": "2.0.0",
-                "iconv-lite": "0.4.24",
-                "on-finished": "2.4.1",
-                "qs": "6.13.0",
-                "raw-body": "2.5.2",
+                "destroy": "~1.2.0",
+                "http-errors": "~2.0.1",
+                "iconv-lite": "~0.4.24",
+                "on-finished": "~2.4.1",
+                "qs": "~6.15.1",
+                "raw-body": "~2.5.3",
                 "type-is": "~1.6.18",
-                "unpipe": "1.0.0"
+                "unpipe": "~1.0.0"
             },
             "engines": {
                 "node": ">= 0.8",
                 "npm": "1.2.8000 || >= 1.4.16"
             }
         },
+        "node_modules/body-parser/node_modules/http-errors": {
+            "version": "2.0.1",
+            "resolved": "https://registry.npmjs.org/http-errors/-/http-errors-2.0.1.tgz",
+            "integrity": "sha512-4FbRdAX+bSdmo4AUFuS0WNiPz8NgFt+r8ThgNWmlrjQjt1Q7ZR9+zTlce2859x4KSXrwIsaeTqDoKQmtP8pLmQ==",
+            "license": "MIT",
+            "dependencies": {
+                "depd": "~2.0.0",
+                "inherits": "~2.0.4",
+                "setprototypeof": "~1.2.0",
+                "statuses": "~2.0.2",
+                "toidentifier": "~1.0.1"
+            },
+            "engines": {
+                "node": ">= 0.8"
+            },
+            "funding": {
+                "type": "opencollective",
+                "url": "https://opencollective.com/express"
+            }
+        },
+        "node_modules/body-parser/node_modules/statuses": {
+            "version": "2.0.2",
+            "resolved": "https://registry.npmjs.org/statuses/-/statuses-2.0.2.tgz",
+            "integrity": "sha512-DvEy55V3DB7uknRo+4iOGT5fP1slR8wQohVdknigZPMpMstaKJQWhwiYBACJE3Ul2pTnATihhBYnRhZQHGBiRw==",
+            "license": "MIT",
+            "engines": {
+                "node": ">= 0.8"
+            }
+        },
         "node_modules/brace-expansion": {
             "version": "5.0.5",
             "resolved": "https://registry.npmjs.org/brace-expansion/-/brace-expansion-5.0.5.tgz",
@@ -114,6 +144,7 @@
             "version": "3.1.2",
             "resolved": "https://registry.npmjs.org/bytes/-/bytes-3.1.2.tgz",
             "integrity": "sha512-/Nf7TyzTx6S3yRJObOAV7956r8cr2+Oj8AC5dt8wSP3BQAoeX58NoHyCU8P8zGkNXStjTSi6fzO6F0pBdcYbEg==",
+            "license": "MIT",
             "engines": {
                 "node": ">= 0.8"
             }
@@ -182,6 +213,7 @@
             "version": "1.0.5",
             "resolved": "https://registry.npmjs.org/content-type/-/content-type-1.0.5.tgz",
             "integrity": "sha512-nTjqfcBFEipKdXCv4YDQWCfmcLZKm81ldF0pAopTvyrFGVbcR6P/VAAd5G7N+0tTr8QqiU0tFadD6FK4NtJwOA==",
+            "license": "MIT",
             "engines": {
                 "node": ">= 0.6"
             }
@@ -295,14 +327,14 @@
             }
         },
         "node_modules/express": {
-            "version": "4.22.0",
-            "resolved": "https://registry.npmjs.org/express/-/express-4.22.0.tgz",
-            "integrity": "sha512-c2iPh3xp5vvCLgaHK03+mWLFPhox7j1LwyxcZwFVApEv5i0X+IjPpbT50SJJwwLpdBVfp45AkK/v+AFgv/XlfQ==",
+            "version": "4.22.2",
+            "resolved": "https://registry.npmjs.org/express/-/express-4.22.2.tgz",
+            "integrity": "sha512-IuL+Elrou2ZvCFHs18/CIzy2Nzvo25nZ1/D2eIZlz7c+QUayAcYoiM2BthCjs+EBHVpjYjcuLDAiCWgeIX3X1Q==",
             "license": "MIT",
             "dependencies": {
                 "accepts": "~1.3.8",
                 "array-flatten": "1.1.1",
-                "body-parser": "~1.20.3",
+                "body-parser": "~1.20.5",
                 "content-disposition": "~0.5.4",
                 "content-type": "~1.0.4",
                 "cookie": "~0.7.1",
@@ -321,7 +353,7 @@
  
```

**File**: `examples/kustomize/package.json` (modified, +1/-1)
```diff
@@ -8,7 +8,7 @@
       "dev": "nodemon index.js"
     },
     "dependencies": {
-      "express": "^4.22.0",
+      "express": "^4.22.2",
       "nodemon": "3.1.12"
     },
     "keywords": [
```

---

### Incident Patch 8: `c402c60a` (2026-05-17)
**Commit Message**: fix: examples/quickstart/package.json & examples/quickstart/package-lock.json to reduce vulnerabilities

The following vulnerabilities are fixed with an upgrade:
- https://snyk.io/vuln/SNYK-JS-QS-16721866

**File**: `examples/quickstart/package-lock.json` (modified, +227/-129)
```diff
@@ -9,7 +9,7 @@
       "version": "0.0.1",
       "license": "MIT",
       "dependencies": {
-        "express": "^4.22.0",
+        "express": "^4.22.2",
         "nodemon": "^3.1.12"
       }
     },
@@ -65,28 +65,58 @@
       }
     },
     "node_modules/body-parser": {
-      "version": "1.20.3",
-      "resolved": "https://registry.npmjs.org/body-parser/-/body-parser-1.20.3.tgz",
-      "integrity": "sha512-7rAxByjUMqQ3/bHJy7D6OGXvx/MMc4IqBn/X0fcM1QUcAItpZrBEYhWGem+tzXH90c+G01ypMcYJBO9Y30203g==",
+      "version": "1.20.5",
+      "resolved": "https://registry.npmjs.org/body-parser/-/body-parser-1.20.5.tgz",
+      "integrity": "sha512-3grm+/2tUOvu2cjJkvsIxrv/wVpfXQW4PsQHYm7yk4vfpu7Ekl6nEsYBoJUL6qDwZUx8wUhQ8tR2qz+ad9c9OA==",
+      "license": "MIT",
       "dependencies": {
-        "bytes": "3.1.2",
+        "bytes": "~3.1.2",
         "content-type": "~1.0.5",
         "debug": "2.6.9",
         "depd": "2.0.0",
-        "destroy": "1.2.0",
-        "http-errors": "2.0.0",
-        "iconv-lite": "0.4.24",
-        "on-finished": "2.4.1",
-        "qs": "6.13.0",
-        "raw-body": "2.5.2",
+        "destroy": "~1.2.0",
+        "http-errors": "~2.0.1",
+        "iconv-lite": "~0.4.24",
+        "on-finished": "~2.4.1",
+        "qs": "~6.15.1",
+        "raw-body": "~2.5.3",
         "type-is": "~1.6.18",
-        "unpipe": "1.0.0"
+        "unpipe": "~1.0.0"
       },
       "engines": {
         "node": ">= 0.8",
         "npm": "1.2.8000 || >= 1.4.16"
       }
     },
+    "node_modules/body-parser/node_modules/http-errors": {
+      "version": "2.0.1",
+      "resolved": "https://registry.npmjs.org/http-errors/-/http-errors-2.0.1.tgz",
+      "integrity": "sha512-4FbRdAX+bSdmo4AUFuS0WNiPz8NgFt+r8ThgNWmlrjQjt1Q7ZR9+zTlce2859x4KSXrwIsaeTqDoKQmtP8pLmQ==",
+      "license": "MIT",
+      "dependencies": {
+        "depd": "~2.0.0",
+        "inherits": "~2.0.4",
+        "setprototypeof": "~1.2.0",
+        "statuses": "~2.0.2",
+        "toidentifier": "~1.0.1"
+      },
+      "engines": {
+        "node": ">= 0.8"
+      },
+      "funding": {
+        "type": "opencollective",
+        "url": "https://opencollective.com/express"
+      }
+    },
+    "node_modules/body-parser/node_modules/statuses": {
+      "version": "2.0.2",
+      "resolved": "https://registry.npmjs.org/statuses/-/statuses-2.0.2.tgz",
+      "integrity": "sha512-DvEy55V3DB7uknRo+4iOGT5fP1slR8wQohVdknigZPMpMstaKJQWhwiYBACJE3Ul2pTnATihhBYnRhZQHGBiRw==",
+      "license": "MIT",
+      "engines": {
+        "node": ">= 0.8"
+      }
+    },
     "node_modules/brace-expansion": {
       "version": "5.0.5",
       "resolved": "https://registry.npmjs.org/brace-expansion/-/brace-expansion-5.0.5.tgz",
@@ -114,14 +144,16 @@
       "version": "3.1.2",
       "resolved": "https://registry.npmjs.org/bytes/-/bytes-3.1.2.tgz",
       "integrity": "sha512-/Nf7TyzTx6S3yRJObOAV7956r8cr2+Oj8AC5dt8wSP3BQAoeX58NoHyCU8P8zGkNXStjTSi6fzO6F0pBdcYbEg==",
+      "license": "MIT",
       "engines": {
         "node": ">= 0.8"
       }
     },
     "node_modules/call-bind-apply-helpers": {
-      "version": "1.0.1",
-      "resolved": "https://registry.npmjs.org/call-bind-apply-helpers/-/call-bind-apply-helpers-1.0.1.tgz",
-      "integrity": "sha512-BhYE+WDaywFg2TBWYNXAE+8B1ATnThNBqXHP5nQu0jWJdVvY2hvkpyB3qOmtmDePiS5/BDQ8wASEWGMWRG148g==",
+      "version": "1.0.2",
+      "resolved": "https://registry.npmjs.org/call-bind-apply-helpers/-/call-bind-apply-helpers-1.0.2.tgz",
+      "integrity": "sha512-Sp1ablJ0ivDkSzjcaJdxEunN5/XvksFJ2sMBFfq6x0ryhQV/2b/KwFe21cMpmHtPOSij8K99/wSfoEuTObmuMQ==",
+      "license": "MIT",
       "dependencies": {
         "es-errors": "^1.3.0",
         "function-bind": "^1.1.2"
@@ -131,12 +163,13 @@
       }
     },
     "node_modules/call-bound": {
-      "version": "1.0.3",
-      "resolved": "https://registry.npmjs.org/call-bound/-/call-bound-1.0.3.tgz",
-      "integrity": "sha512-YTd+6wGlNlPxSuri7Y6X8tY2dmm12UMH66RpKMhiX6rsk5wXXnYgbUcOt8kiS31/AjfoTOvCsE+w8nZQLQnzHA==",
+      "version": "1.0.4",
+      "resolved": "https://registry.npmjs.org/call-bound/-/call-bound-1.0.4.tgz",
+      "integrity": "sha512-+ys997U96po4Kx/ABpBCqhA9EuxJaQWDQg7295H4hBphv3IZg0boBKuwYpt4YXp6MZ5AmZQnU/tyMTlRpaSejg==",
+      "license": "MIT",
       "dependencies": {
-        "call-bind-apply-helpers": "^1.0.1",
-        "get-intrinsic": "^1.2.6"
+        "call-bind-apply-helpers": "^1.0.2",
+        "get-intrinsic": "^1.3.0"
       },
       "engines": {
         "node": ">= 0.4"
@@ -180,6 +213,7 @@
       "version": "1.0.5",
       "resolved": "https://registry.npmjs.org/content-type/-/content-type-1.0.5.tgz",
       "integrity": "sha512-nTjqfcBFEipKdXCv4YDQWCfmcLZKm81ldF0pAopTvyrFGVbcR6P/VAAd5G7N+0tTr8QqiU0tFadD6FK4NtJwOA==",
+      "license": "MIT",
       "engines": {
         "node": ">= 0.6"
       }
@@ -226,6 +260,7 @@
       "version": "1.0.1",
       "resolved": "https://registry.npmjs.org/dunder-proto/-/dunder-proto-1.0.1.tgz",
     
```

**File**: `examples/quickstart/package.json` (modified, +1/-1)
```diff
@@ -7,7 +7,7 @@
     "start": "nodemon index.js"
   },
   "dependencies": {
-    "express": "^4.22.0",
+    "express": "^4.22.2",
     "nodemon": "^3.1.12"
   },
   "keywords": [
```

---

### Incident Patch 9: `98d7b9b0` (2026-05-09)
**Commit Message**: fix: vendor/github.com/creack/pty/Dockerfile.riscv to reduce vulnerabilities

The following vulnerabilities are fixed with an upgrade:
- https://snyk.io/vuln/SNYK-DEBIAN10-NGHTTP2-5953390
- https://snyk.io/vuln/SNYK-DEBIAN10-GIT-6846202
- https://snyk.io/vuln/SNYK-DEBIAN10-GIT-6846202
- https://snyk.io/vuln/SNYK-DEBIAN10-OPENSSH-5788320
- https://snyk.io/vuln/SNYK-DEBIAN10-SYSTEMD-3339153

**File**: `vendor/github.com/creack/pty/Dockerfile.riscv` (modified, +1/-1)
```diff
@@ -1,5 +1,5 @@
 # NOTE: Using 1.13 as a base to build the RISCV compiler, the resulting version is based on go1.6.
-FROM golang:1.13
+FROM golang:1.26.3
 
 # Clone and complie a riscv compatible version of the go compiler.
 RUN git clone https://review.gerrithub.io/riscv/riscv-go /riscv-go
```

---

### Incident Patch 10: `a5e0cf2f` (2026-05-05)
**Commit Message**: fix: ui/package.json & ui/package-lock.json to reduce vulnerabilities

The following vulnerabilities are fixed with an upgrade:
- https://snyk.io/vuln/SNYK-JS-SERIALIZEJAVASCRIPT-570062

**File**: `ui/package-lock.json` (modified, +722/-285)
```diff
@@ -67,7 +67,7 @@
         "webpack-dev-server": "4.15.2",
         "webpack-manifest-plugin": "6.0.1",
         "whatwg-fetch": "2.0.3",
-        "workbox-webpack-plugin": "^7.3.0",
+        "workbox-webpack-plugin": "^7.4.1",
         "xterm": "4.1.0"
       },
       "devDependencies": {
@@ -115,9 +115,9 @@
       }
     },
     "node_modules/@babel/compat-data": {
-      "version": "7.29.0",
-      "resolved": "https://registry.npmjs.org/@babel/compat-data/-/compat-data-7.29.0.tgz",
-      "integrity": "sha512-T1NCJqT/j9+cn8fvkt7jtwbLBfLC/1y1c7NtCeXFRgzGTsafi68MRv8yzkYSapBnFA6L3U2VSc02ciDzoAJhJg==",
+      "version": "7.29.3",
+      "resolved": "https://registry.npmjs.org/@babel/compat-data/-/compat-data-7.29.3.tgz",
+      "integrity": "sha512-LIVqM46zQWZhj17qA8wb4nW/ixr2y1Nw+r1etiAWgRM6U1IqP+LNhL1yg440jYZR72jCWcWbLWzIosH+uP1fqg==",
       "license": "MIT",
       "engines": {
         "node": ">=6.9.0"
@@ -128,7 +128,6 @@
       "resolved": "https://registry.npmjs.org/@babel/core/-/core-7.28.0.tgz",
       "integrity": "sha512-UlLAnTPrFdNGoFtbSXwcGFQBtQZJCNjaN6hQNP3UPvuNXT1i82N26KL3dZeIpNalWywr9IuQuncaAfUaS1g6sQ==",
       "license": "MIT",
-      "peer": true,
       "dependencies": {
         "@ampproject/remapping": "^2.2.0",
         "@babel/code-frame": "^7.27.1",
@@ -199,17 +198,17 @@
       }
     },
     "node_modules/@babel/helper-create-class-features-plugin": {
-      "version": "7.28.6",
-      "resolved": "https://registry.npmjs.org/@babel/helper-create-class-features-plugin/-/helper-create-class-features-plugin-7.28.6.tgz",
-      "integrity": "sha512-dTOdvsjnG3xNT9Y0AUg1wAl38y+4Rl4sf9caSQZOXdNqVn+H+HbbJ4IyyHaIqNR6SW9oJpA/RuRjsjCw2IdIow==",
+      "version": "7.29.3",
+      "resolved": "https://registry.npmjs.org/@babel/helper-create-class-features-plugin/-/helper-create-class-features-plugin-7.29.3.tgz",
+      "integrity": "sha512-RpLYy2sb51oNLjuu1iD3bwBqCBWUzjO0ocp+iaCP/lJtb2CPLcnC2Fftw+4sAzaMELGeWTgExSKADbdo0GFVzA==",
       "license": "MIT",
       "dependencies": {
         "@babel/helper-annotate-as-pure": "^7.27.3",
         "@babel/helper-member-expression-to-functions": "^7.28.5",
         "@babel/helper-optimise-call-expression": "^7.27.1",
         "@babel/helper-replace-supers": "^7.28.6",
         "@babel/helper-skip-transparent-expression-wrappers": "^7.27.1",
-        "@babel/traverse": "^7.28.6",
+        "@babel/traverse": "^7.29.0",
         "semver": "^6.3.1"
       },
       "engines": {
@@ -593,6 +592,22 @@
         "@babel/core": "^7.0.0"
       }
     },
+    "node_modules/@babel/plugin-bugfix-safari-rest-destructuring-rhs-array": {
+      "version": "7.29.3",
+      "resolved": "https://registry.npmjs.org/@babel/plugin-bugfix-safari-rest-destructuring-rhs-array/-/plugin-bugfix-safari-rest-destructuring-rhs-array-7.29.3.tgz",
+      "integrity": "sha512-SRS46DFR4HqzUzCVgi90/xMoL+zeBDBvWdKYXSEzh79kXswNFEglUpMKxR04//dPqwYXWUBJ3mpUd933ru9Kmg==",
+      "license": "MIT",
+      "dependencies": {
+        "@babel/helper-plugin-utils": "^7.28.6",
+        "@babel/helper-skip-transparent-expression-wrappers": "^7.27.1"
+      },
+      "engines": {
+        "node": ">=6.9.0"
+      },
+      "peerDependencies": {
+        "@babel/core": "^7.0.0"
+      }
+    },
     "node_modules/@babel/plugin-bugfix-v8-spread-parameters-in-optional-chaining": {
       "version": "7.27.1",
       "resolved": "https://registry.npmjs.org/@babel/plugin-bugfix-v8-spread-parameters-in-optional-chaining/-/plugin-bugfix-v8-spread-parameters-in-optional-chaining-7.27.1.tgz",
@@ -2167,6 +2182,7 @@
       "integrity": "sha512-IchNf6dN4tHoMFIn/7OE8LWZ19Y6q/67Bmf6vnGREv8RSbBVb9LPJxEcnwrcwX6ixSvaiGoomAUvu4YSxXrVgw==",
       "license": "MIT",
       "optional": true,
+      "peer": true,
       "dependencies": {
         "@jridgewell/trace-mapping": "0.3.9"
       },
@@ -2180,6 +2196,7 @@
       "integrity": "sha512-3Belt6tdc8bPgAtbcmdtNJlirVoTmEb5e2gC94PnkwEW9jI6CAHUeoG85tjWP5WquqfavoMtMwiG4P926ZKKuQ==",
       "license": "MIT",
       "optional": true,
+      "peer": true,
       "dependencies": {
         "@jridgewell/resolve-uri": "^3.0.3",
         "@jridgewell/sourcemap-codec": "^1.4.10"
@@ -2253,7 +2270,6 @@
       "integrity": "sha512-YUcsLQKYb6DmaJjIHdDWpBIGCcyE/W+p/LMGvjQem55Mm2XWVAP5kWTMKWLv9lwpCVjpLxPyOMOyUocP1GxrtA==",
       "hasInstallScript": true,
       "license": "MIT",
-      "peer": true,
       "dependencies": {
         "@fortawesome/fontawesome-common-types": "^0.2.36"
       },
@@ -3167,6 +3183,51 @@
         "node": ">=8"
       }
     },
+    "node_modules/@jest/core/node_modules/ts-node": {
+      "version": "10.9.2",
+      "resolved": "https://registry.npmjs.org/ts-node/-/ts-node-10.9.2.tgz",
+      "integrity": "sha512-f0FFpIdcHgn8zcPSbf1dRevwt047YMnaiJM3u2w2RewrB+fob/zePZcrOyQoLMMO7aBIddLcQIEK5dYjkLnGrQ==",
+      "license": "MIT",
+      "optional": true,
+      "peer": true,
+      "dependencies": {
+        "@cspotcode/source-map-support": "^0.8.0",
+        "@ts
```

**File**: `ui/package.json` (modified, +1/-1)
```diff
@@ -62,7 +62,7 @@
     "webpack-dev-server": "4.15.2",
     "webpack-manifest-plugin": "6.0.1",
     "whatwg-fetch": "2.0.3",
-    "workbox-webpack-plugin": "^7.3.0",
+    "workbox-webpack-plugin": "^7.4.1",
     "xterm": "4.1.0"
   },
   "scripts": {
```

---

### Incident Patch 11: `fd19932b` (2026-04-28)
**Commit Message**: fix: address Helm v4 review comments

- avoid double-closing copied Helm binaries
- return non-missing Helm validation errors
- document StopWait fallback behavior
- derive build Helm version from helm_v4.go
- remove whitespace-only diff noise

Signed-off-by: Ryan Swanson <[REDACTED_EMAIL]>

**File**: `cmd/init.go` (modified, +123/-123)
```diff
@@ -9,22 +9,22 @@ import (
 	"regexp"
 	"strconv"
 	"strings"
-	
+
 	"github.com/loft-sh/devspace/pkg/util/ptr"
 	"mvdan.cc/sh/v3/expand"
-	
+
 	"github.com/loft-sh/devspace/pkg/devspace/compose"
 	"github.com/loft-sh/devspace/pkg/devspace/config/localcache"
 	"github.com/sirupsen/logrus"
-	
+
 	"github.com/loft-sh/devspace/cmd/flags"
 	"github.com/vmware-labs/yaml-jsonpath/pkg/yamlpath"
 	yaml "gopkg.in/yaml.v3"
-	
+
 	"github.com/loft-sh/devspace/pkg/devspace/hook"
-	
+
 	"github.com/loft-sh/devspace/pkg/devspace/plugin"
-	
+
 	"github.com/loft-sh/devspace/pkg/devspace/build/builder/helper"
 	"github.com/loft-sh/devspace/pkg/devspace/config/constants"
 	"github.com/loft-sh/devspace/pkg/devspace/config/loader"
@@ -61,7 +61,7 @@ const (
 // InitCmd is a struct that defines a command call for "init"
 type InitCmd struct {
 	*flags.GlobalFlags
-	
+
 	// Flags
 	Reconfigure bool
 	Dockerfile  string
@@ -76,7 +76,7 @@ func NewInitCmd(f factory.Factory) *cobra.Command {
 		log:         f.GetLog(),
 		GlobalFlags: globalFlags,
 	}
-	
+
 	initCmd := &cobra.Command{
 		Use:   "init",
 		Short: "Initializes DevSpace in the current folder",
@@ -94,12 +94,12 @@ folder. Creates a devspace.yaml as a starting point.
 			return cmd.Run(f)
 		},
 	}
-	
+
 	initCmd.Flags().BoolVarP(&cmd.Reconfigure, "reconfigure", "r", false, "Change existing configuration")
 	initCmd.Flags().StringVar(&cmd.Context, "context", "", "Context path to use for intialization")
 	initCmd.Flags().StringVar(&cmd.Dockerfile, "dockerfile", helper.DefaultDockerfilePath, "Dockerfile to use for initialization")
 	initCmd.Flags().StringVar(&cmd.Provider, "provider", "", "The cloud provider to use")
-	
+
 	return initCmd
 }
 
@@ -123,39 +123,39 @@ func (cmd *InitCmd) Run(f factory.Factory) error {
 		if err != nil {
 			return err
 		}
-		
+
 		if response == optionNo {
 			return nil
 		}
 	}
-	
+
 	// Delete config & overwrite config
 	os.RemoveAll(".devspace")
-	
+
 	// Delete configs path
 	os.Remove(constants.DefaultConfigsPath)
-	
+
 	// Delete config & overwrite config
 	os.Remove(constants.DefaultConfigPath)
-	
+
 	// Delete config & overwrite config
 	os.Remove(constants.DefaultVarsPath)
-	
+
 	// Execute plugin hook
 	err = hook.ExecuteHooks(nil, nil, "init")
 	if err != nil {
 		return err
 	}
-	
+
 	// Print DevSpace logo
 	log.PrintLogo()
-	
+
 	// Determine if we're initializing from scratch, or using docker-compose.yaml
 	dockerComposePath, generateFromDockerCompose, err := cmd.shouldGenerateFromDockerCompose()
 	if err != nil {
 		return err
 	}
-	
+
 	if generateFromDockerCompose {
 		err = cmd.initDockerCompose(f, dockerComposePath)
 	} else {
@@ -164,12 +164,12 @@ func (cmd *InitCmd) Run(f factory.Factory) error {
 	if err != nil {
 		return err
 	}
-	
+
 	cmd.log.WriteString(logrus.InfoLevel, "\n")
 	cmd.log.Done("Project successfully initialized")
 	cmd.log.Info("Configuration saved in devspace.yaml - you can make adjustments as needed")
 	cmd.log.Infof("\r         \nYou can now run:\n1. %s - to pick which Kubernetes namespace to work in\n2. %s - to start developing your project in Kubernetes\n\nRun `%s` or `%s` to see a list of available commands and flags\n", ansi.Color("devspace use namespace", "blue+b"), ansi.Color("devspace dev", "blue+b"), ansi.Color("devspace -h", "blue+b"), ansi.Color("devspace [command] -h", "blue+b"))
-	
+
 	return nil
 }
 
@@ -179,17 +179,17 @@ func (cmd *InitCmd) initDevspace(f factory.Factory, configLoader loader.ConfigLo
 	if err != nil {
 		return err
 	}
-	
+
 	err = languageHandler.CopyTemplates(".", false)
 	if err != nil {
 		return err
 	}
-	
+
 	startScriptAbsPath, err := filepath.Abs(startScriptName)
 	if err != nil {
 		return err
 	}
-	
+
 	_, err = os.Stat(startScriptAbsPath)
 	if err == nil {
 		// Ensure file is executable
@@ -198,9 +198,9 @@ func (cmd *InitCmd) initDevspace(f factory.Factory, configLoader loader.ConfigLo
 			return err
 		}
 	}
-	
+
 	var config *latest.Config
-	
+
 	// create kubectl client
 	client, err := f.NewKubeClientFromContext(cmd.GlobalFlags.KubeContext, cmd.GlobalFlags.Namespace)
 	if err == nil {
@@ -209,35 +209,35 @@ func (cmd *InitCmd) initDevspace(f factory.Factory, configLoader loader.ConfigLo
 			config = configInterface.Config()
 		}
 	}
-	
+
 	localCache, err := localcache.NewCacheLoader().Load(constants.DefaultConfigPath)
 	if err != nil {
 		return err
 	}
-	
+
 	if config == nil {
 		// Create config
 		config = latest.New().(*latest.Config)
 		if err != nil {
 			return err
 		}
 	}
-	
+
 	// Create ConfigureManager
 	configureManager := f.NewConfigureManager(config, localCache, cmd.log)
-	
+
 	// Determine name for this devspace project
 	projectName, projectNamespace, err := getProjectName()
 	if err != nil {
 		return err
 	}
-	
+
 	config.Name = projectName
-	
+
 	imageName := "app"
 	selectedDeploymentOption := ""
 	mustAddComponentChart := false
-	
+
 	for {
 		selectedDeploymentOption, err = cmd.log.Question(&survey.QuestionOptions{
 			Question:
```

**File**: `cmd/run.go` (modified, +42/-42)
```diff
@@ -6,11 +6,11 @@ import (
 	"io"
 	"os"
 	"strings"
-	
+
 	"github.com/loft-sh/devspace/pkg/devspace/kubectl"
 	"github.com/loft-sh/devspace/pkg/devspace/pipeline/env"
 	"mvdan.cc/sh/v3/expand"
-	
+
 	"github.com/loft-sh/devspace/pkg/devspace/config"
 	"github.com/loft-sh/devspace/pkg/devspace/config/versions/latest"
 	devspacecontext "github.com/loft-sh/devspace/pkg/devspace/context"
@@ -22,23 +22,23 @@ import (
 	"github.com/loft-sh/devspace/pkg/util/log"
 	"github.com/loft-sh/utils/pkg/command"
 	"mvdan.cc/sh/v3/interp"
-	
+
 	"github.com/loft-sh/devspace/cmd/flags"
 	"github.com/loft-sh/devspace/pkg/devspace/config/loader"
 	"github.com/loft-sh/devspace/pkg/devspace/dependency"
 	"github.com/loft-sh/devspace/pkg/util/factory"
 	flagspkg "github.com/loft-sh/devspace/pkg/util/flags"
 	"github.com/loft-sh/devspace/pkg/util/message"
 	"github.com/sirupsen/logrus"
-	
+
 	"github.com/pkg/errors"
 	"github.com/spf13/cobra"
 )
 
 // RunCmd holds the run cmd flags
 type RunCmd struct {
 	*flags.GlobalFlags
-	
+
 	Dependency string
 	Stdout     io.Writer
 	Stderr     io.Writer
@@ -51,7 +51,7 @@ func NewRunCmd(f factory.Factory, globalFlags *flags.GlobalFlags, rawConfig *Raw
 		Stdout:      os.Stdout,
 		Stderr:      os.Stderr,
 	}
-	
+
 	runCmd := &cobra.Command{
 		Use:                "run",
 		DisableFlagParsing: true,
@@ -75,11 +75,11 @@ devspace --dependency my-dependency run any-command --any-command-flag
 		if err != nil {
 			return err
 		}
-		
+
 		plugin.SetPluginCommand(cobraCmd, args)
 		return cmd.RunRun(f, args)
 	}
-	
+
 	if rawConfig != nil && rawConfig.Config != nil {
 		for _, cmd := range rawConfig.Config.Commands {
 			runCmd.AddCommand(NewSpecificRunCommand(cmd))
@@ -94,20 +94,20 @@ func (cmd *RunCmd) RunRun(f factory.Factory, args []string) error {
 	if len(args) == 0 {
 		return fmt.Errorf("run requires at least one argument")
 	}
-	
+
 	// check if dependency command
 	commandSplitted := strings.Split(args[0], ".")
 	if len(commandSplitted) > 1 {
 		cmd.Dependency = strings.Join(commandSplitted[:len(commandSplitted)-1], ".")
 		args[0] = commandSplitted[len(commandSplitted)-1]
 	}
-	
+
 	// Execute plugin hook
 	err := hook.ExecuteHooks(nil, nil, "run")
 	if err != nil {
 		return err
 	}
-	
+
 	// Set config root
 	configOptions := cmd.ToConfigOptions()
 	configLoader, err := f.NewConfigLoader(cmd.ConfigPath)
@@ -120,45 +120,45 @@ func (cmd *RunCmd) RunRun(f factory.Factory, args []string) error {
 	} else if !configExists {
 		return errors.New(message.ConfigNotFound)
 	}
-	
+
 	// load the config
 	ctx, err := cmd.LoadCommandsConfig(f, configLoader, configOptions, f.GetLog())
 	if err != nil {
 		return err
 	}
-	
+
 	// check if we should execute a dependency command
 	if cmd.Dependency != "" {
 		config, err := configLoader.LoadWithCache(context.Background(), ctx.Config().LocalCache(), nil, configOptions, f.GetLog())
 		if err != nil {
 			return err
 		}
-		
+
 		ctx = ctx.WithConfig(config)
 		dependencies, err := f.NewDependencyManager(ctx, configOptions).ResolveAll(ctx, dependency.ResolveOptions{})
 		if err != nil {
 			return err
 		}
-		
+
 		dep := dependency.GetDependencyByPath(dependencies, cmd.Dependency)
 		if dep == nil {
 			return fmt.Errorf("couldn't find dependency %s", cmd.Dependency)
 		}
-		
+
 		ctx = ctx.AsDependency(dep)
 		commandConfig, err := findCommand(ctx.Config(), args[0])
 		if err != nil {
 			return err
 		}
-		
+
 		return executeCommandWithAfter(ctx.Context(), commandConfig, args[1:], ctx.Config().Variables(), ctx.WorkingDir(), cmd.Stdout, cmd.Stderr, os.Stdin, ctx.Log())
 	}
-	
+
 	commandConfig, err := findCommand(ctx.Config(), args[0])
 	if err != nil {
 		return err
 	}
-	
+
 	return executeCommandWithAfter(ctx.Context(), commandConfig, args[1:], ctx.Config().Variables(), ctx.WorkingDir(), cmd.Stdout, cmd.Stderr, os.Stdin, ctx.Log())
 }
 
@@ -167,7 +167,7 @@ func findCommand(config config.Config, name string) (*latest.CommandConfig, erro
 	if config.Config().Commands == nil || config.Config().Commands[name] == nil {
 		return nil, errors.Errorf("couldn't find command '%s' in devspace config", name)
 	}
-	
+
 	return config.Config().Commands[name], nil
 }
 
@@ -194,7 +194,7 @@ func executeCommandWithAfter(ctx context.Context, command *latest.CommandConfig,
 			return errors.Wrap(err, "error executing after command")
 		}
 	}
-	
+
 	return originalErr
 }
 
@@ -209,28 +209,28 @@ func ParseArgs(cobraCmd *cobra.Command, globalFlags *flags.GlobalFlags, log log.
 	if index == -1 {
 		return nil, fmt.Errorf("error parsing command: couldn't find %s in command: %v", cobraCmd.Use, os.Args)
 	}
-	
+
 	// check if is help command
 	osArgs := os.Args[:index]
 	if len(os.Args) == index+1 && (os.Args[index] == "-h" || os.Args[index] == "--help") {
 		return nil, cobraCmd.Help()
 	}
-	
+
 	// enable flag parsing
 	cobraCmd.DisableFlagParsing = false
-	
+
 	// apply extra flags
 	_, err := flagspkg.ApplyExtraFlags(cobraCmd, osArgs, true)
 	if err != nil {
 		retu
```

**File**: `e2e/tests/render/render.go` (modified, +11/-11)
```diff
@@ -6,36 +6,36 @@ import (
 	"path/filepath"
 	"strings"
 	"sync"
-	
+
 	"github.com/onsi/ginkgo/v2"
-	
+
 	"github.com/loft-sh/devspace/cmd"
 	"github.com/loft-sh/devspace/cmd/flags"
 	"github.com/loft-sh/devspace/e2e/framework"
 	"github.com/loft-sh/devspace/pkg/util/factory"
 )
 
 var _ = DevSpaceDescribe("build", func() {
-	
+
 	initialDir, err := os.Getwd()
 	if err != nil {
 		panic(err)
 	}
-	
+
 	// create a new factory
 	var f factory.Factory
-	
+
 	ginkgo.BeforeEach(func() {
 		f = framework.NewDefaultFactory()
 	})
-	
+
 	// Test cases:
-	
+
 	ginkgo.It("should render helm charts", func() {
 		tempDir, err := framework.CopyToTempDir("tests/render/testdata/helm")
 		framework.ExpectNoError(err)
 		defer framework.CleanupTempDir(initialDir, tempDir)
-		
+
 		stdout := &Buffer{}
 		// create build command
 		renderCmd := &cmd.RunPipelineCmd{
@@ -50,18 +50,18 @@ var _ = DevSpaceDescribe("build", func() {
 		err = renderCmd.RunDefault(f)
 		framework.ExpectNoError(err)
 		content := strings.TrimSpace(stdout.String()) + "\n"
-		
+
 		framework.ExpectLocalFileContentsImmediately(
 			filepath.Join(tempDir, "rendered.txt"),
 			content,
 		)
 	})
-	
+
 	ginkgo.It("should render kubectl deployments", func() {
 		tempDir, err := framework.CopyToTempDir("tests/render/testdata/kubectl")
 		framework.ExpectNoError(err)
 		defer framework.CleanupTempDir(initialDir, tempDir)
-		
+
 		stdout := &Buffer{}
 		// create build command
 		renderCmd := &cmd.RunPipelineCmd{
```

**File**: `hack/build-all.bash` (modified, +6/-1)
```diff
@@ -57,7 +57,12 @@ case "${HELM_ARCH}" in
     ;;
 esac
 HELM_PLATFORM="${HELM_OS}-${HELM_ARCH}"
-curl -s "https://get.helm.sh/helm-v4.0.4-${HELM_PLATFORM}.tar.gz" > helm4.tar.gz && tar -zxvf helm4.tar.gz "${HELM_PLATFORM}/helm" && chmod +x "${HELM_PLATFORM}/helm"
+HELM_VERSION=$(sed -nE 's/^const helmVersion = "([^"]+)"/\1/p' pkg/util/downloader/commands/helm_v4.go)
+if [[ -z "${HELM_VERSION}" ]]; then
+  echo "unable to determine Helm version" 1>&2
+  exit 1
+fi
+curl -s "https://get.helm.sh/helm-${HELM_VERSION}-${HELM_PLATFORM}.tar.gz" > helm4.tar.gz && tar -zxvf helm4.tar.gz "${HELM_PLATFORM}/helm" && chmod +x "${HELM_PLATFORM}/helm"
 
 # Pull the component chart
 COMPONENT_CHART_VERSION=$(cat pkg/devspace/deploy/deployer/helm/client.go | grep 'Version: "' | sed -nE 's/[^"]+"(.+)",\s*/\1/p')
```

**File**: `pkg/util/downloader/commands/helm_v4.go` (modified, +11/-7)
```diff
@@ -2,8 +2,10 @@ package commands
 
 import (
 	"context"
+	"errors"
 	"io"
 	"os"
+	"os/exec"
 	"path/filepath"
 	"runtime"
 	"strings"
@@ -12,7 +14,7 @@ import (
 	downloadercommands "github.com/loft-sh/utils/pkg/downloader/commands"
 	"github.com/loft-sh/utils/pkg/extract"
 	"github.com/mitchellh/go-homedir"
-	"github.com/pkg/errors"
+	pkgerrors "github.com/pkg/errors"
 	"mvdan.cc/sh/v3/expand"
 )
 
@@ -55,7 +57,11 @@ func (h *helmCommand) DownloadURL() string {
 func (h *helmCommand) IsValid(ctx context.Context, path string) (bool, error) {
 	out, err := utilscommand.Output(ctx, "", expand.ListEnviron(os.Environ()...), path, "version")
 	if err != nil {
-		return false, nil
+		if errors.Is(err, exec.ErrNotFound) || os.IsNotExist(err) {
+			return false, nil
+		}
+
+		return false, err
 	}
 
 	return strings.Contains(string(out), `:"v4.`), nil
@@ -76,11 +82,11 @@ func installHelmBinary(archiveFile, installPath, installFromURL string) error {
 
 	if strings.HasSuffix(installFromURL, ".tar.gz") {
 		if err := extractor.UntarGz(archiveFile, targetDir); err != nil {
-			return errors.Wrap(err, "extract tar.gz")
+			return pkgerrors.Wrap(err, "extract tar.gz")
 		}
 	} else if strings.HasSuffix(installFromURL, ".zip") {
 		if err := extractor.Unzip(archiveFile, targetDir); err != nil {
-			return errors.Wrap(err, "extract zip")
+			return pkgerrors.Wrap(err, "extract zip")
 		}
 	}
 
@@ -104,11 +110,9 @@ func copyFile(sourcePath, targetPath string) error {
 	if err != nil {
 		return err
 	}
-	defer func() {
-		_ = target.Close()
-	}()
 
 	if _, err := io.Copy(target, source); err != nil {
+		_ = target.Close()
 		return err
 	}
 
```

**File**: `pkg/util/log/stream_logger.go` (modified, +2/-1)
```diff
@@ -476,7 +476,8 @@ func (s *StreamLogger) StartWait(message string) {
 }
 
 func (s *StreamLogger) StopWait() {
-	// TODO: implement spinner/wait indicator
+	// StartWait writes a complete log line instead of starting a spinner, so
+	// there is no terminal state to clean up.
 }
 
 func (s *StreamLogger) Writer(level logrus.Level, raw bool) io.WriteCloser {
```

**File**: `pkg/util/log/stream_logger_test.go` (modified, +1/-0)
```diff
@@ -13,6 +13,7 @@ func TestStreamLoggerStartWaitFallsBackToInfo(t *testing.T) {
 	logger := NewStreamLoggerWithFormat(stdout, stderr, logrus.InfoLevel, RawFormat)
 
 	logger.StartWait("Downloading helm...")
+	logger.StopWait()
 
 	expected := "Downloading helm...\n"
 	if stdout.String() != expected {
```

---

### Incident Patch 12: `0630ad52` (2026-02-06)
**Commit Message**: test fixes

Signed-off-by: Ryan Swanson <[REDACTED_EMAIL]>

**File**: `.github/workflows/unit-tests.yaml` (modified, +4/-0)
```diff
@@ -34,6 +34,10 @@ jobs:
       - name: Check out code into the Go module directory
         uses: actions/checkout@v1
 
+      - name: Uninstall Helm 3.x
+        run: |
+          sudo rm -rf $(which helm) || true
+        
       - name: Test
         shell: bash
         run: |
```

**File**: `e2e/tests/render/render.go` (modified, +11/-11)
```diff
@@ -6,36 +6,36 @@ import (
 	"path/filepath"
 	"strings"
 	"sync"
-
+	
 	"github.com/onsi/ginkgo/v2"
-
+	
 	"github.com/loft-sh/devspace/cmd"
 	"github.com/loft-sh/devspace/cmd/flags"
 	"github.com/loft-sh/devspace/e2e/framework"
 	"github.com/loft-sh/devspace/pkg/util/factory"
 )
 
 var _ = DevSpaceDescribe("build", func() {
-
+	
 	initialDir, err := os.Getwd()
 	if err != nil {
 		panic(err)
 	}
-
+	
 	// create a new factory
 	var f factory.Factory
-
+	
 	ginkgo.BeforeEach(func() {
 		f = framework.NewDefaultFactory()
 	})
-
+	
 	// Test cases:
-
+	
 	ginkgo.It("should render helm charts", func() {
 		tempDir, err := framework.CopyToTempDir("tests/render/testdata/helm")
 		framework.ExpectNoError(err)
 		defer framework.CleanupTempDir(initialDir, tempDir)
-
+		
 		stdout := &Buffer{}
 		// create build command
 		renderCmd := &cmd.RunPipelineCmd{
@@ -50,18 +50,18 @@ var _ = DevSpaceDescribe("build", func() {
 		err = renderCmd.RunDefault(f)
 		framework.ExpectNoError(err)
 		content := strings.TrimSpace(stdout.String()) + "\n"
-
+		
 		framework.ExpectLocalFileContentsImmediately(
 			filepath.Join(tempDir, "rendered.txt"),
 			content,
 		)
 	})
-
+	
 	ginkgo.It("should render kubectl deployments", func() {
 		tempDir, err := framework.CopyToTempDir("tests/render/testdata/kubectl")
 		framework.ExpectNoError(err)
 		defer framework.CleanupTempDir(initialDir, tempDir)
-
+		
 		stdout := &Buffer{}
 		// create build command
 		renderCmd := &cmd.RunPipelineCmd{
```

**File**: `e2e/tests/render/testdata/helm/rendered.txt` (modified, +2/-3)
```diff
@@ -9,7 +9,7 @@ metadata:
     "app.kubernetes.io/component": "test"
     "app.kubernetes.io/managed-by": "Helm"
   annotations:
-    "helm.sh/chart": "component-chart-0.9.1"
+    "helm.sh/chart": "component-chart-0.9.2"
 spec:
   replicas: 1
   strategy:
@@ -26,7 +26,7 @@ spec:
         "app.kubernetes.io/component": "test"
         "app.kubernetes.io/managed-by": "Helm"
       annotations:
-        "helm.sh/chart": "component-chart-0.9.1"
+        "helm.sh/chart": "component-chart-0.9.2"
     spec:
       imagePullSecrets:
       nodeSelector:
@@ -78,7 +78,6 @@ spec:
           volumeMounts:
       initContainers:
       volumes:
-  volumeClaimTemplates:
 ---
 # Source: component-chart/templates/deployment.yaml
 # Create headless service for StatefulSet
```

**File**: `pkg/devspace/deploy/deployer/helm/client.go` (modified, +1/-1)
```diff
@@ -23,7 +23,7 @@ const ComponentChartFolder = "component-chart"
 // DevSpaceChartConfig is the config that holds the devspace chart information
 var DevSpaceChartConfig = &latest.ChartConfig{
 	Name:    "component-chart",
-	Version: "0.9.1",
+	Version: "0.9.2",
 	RepoURL: "https://charts.devspace.sh",
 }
 
```

**File**: `pkg/devspace/pipeline/engine/engine_test.go` (modified, +2/-1)
```diff
@@ -3,13 +3,13 @@ package engine
 import (
 	"bytes"
 	"context"
-	"mvdan.cc/sh/v3/expand"
 	"os"
 	"path/filepath"
 	"strings"
 	"testing"
 
 	"gotest.tools/assert"
+	"mvdan.cc/sh/v3/expand"
 )
 
 type testCaseShell struct {
@@ -132,5 +132,6 @@ func TestHelmDownload(t *testing.T) {
 	if err != nil {
 		t.Fatal(err)
 	}
+
 	assert.Assert(t, strings.Contains(stdout1.String(), `Version:"v4`))
 }
```

---

### Incident Patch 13: `46a2f0a9` (2026-02-06)
**Commit Message**: Update test and build script for helm v4

Signed-off-by: Ryan Swanson <[REDACTED_EMAIL]>

**File**: `hack/build-all.bash` (modified, +2/-2)
```diff
@@ -41,9 +41,9 @@ fi
 # Create the release directory
 mkdir -p "${DEVSPACE_ROOT}/release"
 
-# Install Helm 3
+# Install Helm 4
 echo "Installing helm"
-curl -s https://get.helm.sh/helm-v3.3.4-darwin-amd64.tar.gz > helm3.tar.gz && tar -zxvf helm3.tar.gz darwin-amd64/helm && chmod +x darwin-amd64/helm
+curl -s https://get.helm.sh/helm-v4.0.4-darwin-amd64.tar.gz > helm4.tar.gz && tar -zxvf helm4.tar.gz darwin-amd64/helm && chmod +x darwin-amd64/helm
 
 # Pull the component chart
 COMPONENT_CHART_VERSION=$(cat pkg/devspace/deploy/deployer/helm/client.go | grep 'Version: "' | sed -nE 's/[^"]+"(.+)",\s*/\1/p')
```

**File**: `pkg/devspace/pipeline/engine/engine_test.go` (modified, +1/-1)
```diff
@@ -132,5 +132,5 @@ func TestHelmDownload(t *testing.T) {
 	if err != nil {
 		t.Fatal(err)
 	}
-	assert.Assert(t, strings.Contains(stdout1.String(), `Version:"v3`))
+	assert.Assert(t, strings.Contains(stdout1.String(), `Version:"v4`))
 }
```

---

### Incident Patch 14: `68229091` (2026-04-27)
**Commit Message**: Merge pull request #3244 from devspace-sh/dependabot/npm_and_yarn/ui/promise-8.3.0

chore(deps): bump promise from 8.0.1 to 8.3.0 in /ui

**File**: `ui/package-lock.json` (modified, +5/-5)
```diff
@@ -38,7 +38,7 @@
         "object-assign": "4.1.1",
         "postcss-flexbugs-fixes": "4.1.0",
         "postcss-loader": "4.0.0",
-        "promise": "8.0.1",
+        "promise": "8.3.0",
         "raf": "3.4.0",
         "react": "^16.14.0",
         "react-cookie": "^3.1.2",
@@ -18933,12 +18933,12 @@
       "license": "MIT"
     },
     "node_modules/promise": {
-      "version": "8.0.1",
-      "resolved": "https://registry.npmjs.org/promise/-/promise-8.0.1.tgz",
-      "integrity": "sha512-6NO4VAynZF2J958bGr+U5mPDwK5n7Vi/S0mCW7bke3bJmcALGjCywH8sl6a2eN+xIX6Q1exH2lmqyjR9PKTiwg==",
+      "version": "8.3.0",
+      "resolved": "https://registry.npmjs.org/promise/-/promise-8.3.0.tgz",
+      "integrity": "sha512-rZPNPKTOYVNEEKFaq1HqTgOwZD+4/YHS5ukLzQCypkj+OkYx7iv0mA91lJlpPPZ8vMau3IIGj5Qlwrx+8iiSmg==",
       "license": "MIT",
       "dependencies": {
-        "asap": "~2.0.3"
+        "asap": "~2.0.6"
       }
     },
     "node_modules/prompts": {
```

**File**: `ui/package.json` (modified, +1/-1)
```diff
@@ -33,7 +33,7 @@
     "object-assign": "4.1.1",
     "postcss-flexbugs-fixes": "4.1.0",
     "postcss-loader": "4.0.0",
-    "promise": "8.0.1",
+    "promise": "8.3.0",
     "raf": "3.4.0",
     "react": "^16.14.0",
     "react-cookie": "^3.1.2",
```

---

### Incident Patch 15: `db8a3031` (2026-04-27)
**Commit Message**: Merge pull request #3241 from devspace-sh/dependabot/npm_and_yarn/ui/fs-extra-11.3.4

chore(deps): bump fs-extra from 3.0.1 to 11.3.4 in /ui

**File**: `ui/package-lock.json` (modified, +20/-56)
```diff
@@ -24,7 +24,7 @@
         "dotenv-expand": "4.2.0",
         "express": "^4.22.0",
         "fork-ts-checker-webpack-plugin": "1.4.3",
-        "fs-extra": "3.0.1",
+        "fs-extra": "11.3.4",
         "get-parameter": "^1.0.8",
         "history": "^4.10.1",
         "html-webpack-plugin": "^4.5.2",
@@ -10983,14 +10983,17 @@
       }
     },
     "node_modules/fs-extra": {
-      "version": "3.0.1",
-      "resolved": "https://registry.npmjs.org/fs-extra/-/fs-extra-3.0.1.tgz",
-      "integrity": "sha512-V3Z3WZWVUYd8hoCL5xfXJCaHWYzmtwW5XWYSlLgERi8PWd8bx1kUHUk8L1BT57e49oKnDDD180mjfrHc1yA9rg==",
+      "version": "11.3.4",
+      "resolved": "https://registry.npmjs.org/fs-extra/-/fs-extra-11.3.4.tgz",
+      "integrity": "sha512-CTXd6rk/M3/ULNQj8FBqBWHYBVYybQ3VPBw0xGKFe3tuH7ytT6ACnvzpIQ3UZtB8yvUKC2cXn1a+x+5EVQLovA==",
       "license": "MIT",
       "dependencies": {
-        "graceful-fs": "^4.1.2",
-        "jsonfile": "^3.0.0",
-        "universalify": "^0.1.0"
+        "graceful-fs": "^4.2.0",
+        "jsonfile": "^6.0.1",
+        "universalify": "^2.0.0"
+      },
+      "engines": {
+        "node": ">=14.14"
       }
     },
     "node_modules/fs-monkey": {
@@ -16868,10 +16871,13 @@
       }
     },
     "node_modules/jsonfile": {
-      "version": "3.0.1",
-      "resolved": "https://registry.npmjs.org/jsonfile/-/jsonfile-3.0.1.tgz",
-      "integrity": "sha512-oBko6ZHlubVB5mRFkur5vgYR1UyqX+S6Y/oCfLhqNdcc2fYFlDpIoNc7AfKS1KOGcnNAkvsr0grLck9ANM815w==",
+      "version": "6.2.1",
+      "resolved": "https://registry.npmjs.org/jsonfile/-/jsonfile-6.2.1.tgz",
+      "integrity": "sha512-zwOTdL3rFQ/lRdBnntKVOX6k5cKJwEc1HdilT71BWEu7J41gXIB2MRp+vxduPSwZJPWBxEzv4yH1wYLJGUHX4Q==",
       "license": "MIT",
+      "dependencies": {
+        "universalify": "^2.0.0"
+      },
       "optionalDependencies": {
         "graceful-fs": "^4.1.6"
       }
@@ -19443,18 +19449,6 @@
         "node": ">=0.12.0"
       }
     },
-    "node_modules/react-dev-utils/node_modules/jsonfile": {
-      "version": "6.1.0",
-      "resolved": "https://registry.npmjs.org/jsonfile/-/jsonfile-6.1.0.tgz",
-      "integrity": "sha512-5dgndWOriYSm5cnYaJNhalLNDKOqFwyDB/rr1E9ZsGciGvKPs8R2xYGCacuf3z6K1YKDz182fd+fY3cn3pMqXQ==",
-      "license": "MIT",
-      "dependencies": {
-        "universalify": "^2.0.0"
-      },
-      "optionalDependencies": {
-        "graceful-fs": "^4.1.6"
-      }
-    },
     "node_modules/react-dev-utils/node_modules/loader-utils": {
       "version": "3.3.1",
       "resolved": "https://registry.npmjs.org/loader-utils/-/loader-utils-3.3.1.tgz",
@@ -19575,15 +19569,6 @@
         "node": ">=8.0"
       }
     },
-    "node_modules/react-dev-utils/node_modules/universalify": {
-      "version": "2.0.1",
-      "resolved": "https://registry.npmjs.org/universalify/-/universalify-2.0.1.tgz",
-      "integrity": "sha512-gptHNQghINnc/vTGIk0SOFGFNXw7JVrlRUtConJRlvaw6DuX0wO5Jeko9sWrMBhh+PsYAZ7oXAiOnf/UKogyiw==",
-      "license": "MIT",
-      "engines": {
-        "node": ">= 10.0.0"
-      }
-    },
     "node_modules/react-dom": {
       "version": "16.14.0",
       "resolved": "https://registry.npmjs.org/react-dom/-/react-dom-16.14.0.tgz",
@@ -23241,12 +23226,12 @@
       }
     },
     "node_modules/universalify": {
-      "version": "0.1.2",
-      "resolved": "https://registry.npmjs.org/universalify/-/universalify-0.1.2.tgz",
-      "integrity": "sha512-rBJeI5CXAlmy1pV+617WB9J63U6XcazHHF2f2dbJix4XzpUF0RS3Zbj0FGIOCAva5P/d/GBOYaACQ1w+0azUkg==",
+      "version": "2.0.1",
+      "resolved": "https://registry.npmjs.org/universalify/-/universalify-2.0.1.tgz",
+      "integrity": "sha512-gptHNQghINnc/vTGIk0SOFGFNXw7JVrlRUtConJRlvaw6DuX0wO5Jeko9sWrMBhh+PsYAZ7oXAiOnf/UKogyiw==",
       "license": "MIT",
       "engines": {
-        "node": ">= 4.0.0"
+        "node": ">= 10.0.0"
       }
     },
     "node_modules/unpipe": {
@@ -24699,18 +24684,6 @@
       "integrity": "sha512-NM8/P9n3XjXhIZn1lLhkFaACTOURQXjWhV4BA/RnOv8xvgqtqpAX9IO4mRQxSx1Rlo4tqzeqb0sOlruaOy3dug==",
       "license": "MIT"
     },
-    "node_modules/workbox-build/node_modules/jsonfile": {
-      "version": "6.2.1",
-      "resolved": "https://registry.npmjs.org/jsonfile/-/jsonfile-6.2.1.tgz",
-      "integrity": "sha512-zwOTdL3rFQ/lRdBnntKVOX6k5cKJwEc1HdilT71BWEu7J41gXIB2MRp+vxduPSwZJPWBxEzv4yH1wYLJGUHX4Q==",
-      "license": "MIT",
-      "dependencies": {
-        "universalify": "^2.0.0"
-      },
-      "optionalDependencies": {
-        "graceful-fs": "^4.1.6"
-      }
-    },
     "node_modules/workbox-build/node_modules/lru-cache": {
       "version": "11.3.5",
       "resolved": "https://registry.npmjs.org/lru-cache/-/lru-cache-11.3.5.tgz",
@@ -24785,15 +24758,6 @@
         "node": ">= 8"
       }
     },
-    "node_modules/workbox-build/node_modules/universalify": {
-      "version": "2.0.1",
-      "resolved": "https://registry.npmjs.org/universalify/-/universalify-2.0.1.tgz",
-      "integrity": "sha512-gptHNQghINnc/vTGIk0SOFGFNXw7JVrlR
```

**File**: `ui/package.json` (modified, +1/-1)
```diff
@@ -19,7 +19,7 @@
     "dotenv-expand": "4.2.0",
     "express": "^4.22.0",
     "fork-ts-checker-webpack-plugin": "1.4.3",
-    "fs-extra": "3.0.1",
+    "fs-extra": "11.3.4",
     "get-parameter": "^1.0.8",
     "history": "^4.10.1",
     "html-webpack-plugin": "^4.5.2",
```

#### Recent Merged Pull Requests:
- **PR #3289** (closed): [Snyk] Fix for 1 vulnerabilities (@lizardruss)
- **PR #3266** (2026-05-28): ci: update GitHub Actions workflow actions (@tatakaisun)
- **PR #3265** (2026-05-28): [Snyk] Security upgrade express from 4.22.0 to 4.22.2 (@lizardruss)
- **PR #3264** (2026-05-28): [Snyk] Security upgrade express from 4.22.0 to 4.22.2 (@lizardruss)
- **PR #3263** (2026-05-28): [Snyk] Security upgrade express from 4.22.0 to 4.22.2 (@caniszczyk)
- **PR #3261** (2026-05-28): [Snyk] Security upgrade express from 4.22.0 to 4.22.2 (@caniszczyk)
- **PR #3260** (2026-05-28): [Snyk] Security upgrade express from 4.22.1 to 4.22.2 (@lizardruss)
- **PR #3259** (2026-05-28): [Snyk] Security upgrade express from 4.22.0 to 4.22.2 (@caniszczyk)

---

## 3. Empirical Evidence & Compliance Certification
- **Evidence Provenance**: Fetched directly from verified official GitHub REST API.
- **Zero Disk Footprint**: 0 bytes of unnecessary repository bloat stored locally.
- **TOS & Free-Tier Adherence**: Request pace complied with public API guidelines without fee, penalty, or unauthorized scraping.

---

## 4. Promotion & Integration Status
- **Status**: HARVESTED_DEEP_FORENSIC
- **Master Brain Sync**: Auto-committed to local/remote Master Brain repository.
