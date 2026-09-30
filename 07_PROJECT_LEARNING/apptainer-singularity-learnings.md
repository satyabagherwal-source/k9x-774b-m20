# Forensic Learning Record (Deep Inspection): apptainer/singularity

> **Canonical Artifact**: `07_PROJECT_LEARNING/apptainer-singularity-learnings.md`  
> **Source Platform**: GitHub ([https://github.com/apptainer/singularity](https://github.com/apptainer/singularity))  
> **Harvest Method**: Full-Spectrum Deep Extraction (Patches, Diffs, Source Code, Post-Mortems)  
> **Harvest Timestamp**: 2026-09-30T17:48:36.117Z  
> **Compliance State**: Free Tier Guaranteed | Strict Rate-Limit Backoff Honored  

---

## 1. Context & Architectural Overview
- **Repository / Resource**: `apptainer/singularity`
- **Description**: Singularity has been renamed to Apptainer as part of us moving the project to the Linux Foundation. This repo has been persisted as a snapshot right before the changes.
- **Primary Language / Ecosystem**: Go
- **Discovered Manifests / Configurations**: go.mod, README.md
- **Stars / Engagement**: 2625 stars

---

## 2. Multi-Dimensional 8-Axis Investigation & Real Code Patches

### D1: Architecture & Structural Boundaries
- Entry configurations inspected via direct stream: go.mod, README.md.
- Evaluated system abstractions and modular contracts.

### Core Architecture Module: `cmd/bash_completion/bash_completion.go`
```
// Copyright (c) 2018-2019, Sylabs Inc. All rights reserved.
// This software is licensed under a 3-clause BSD license. Please consult the
// LICENSE.md file distributed with the sources of this project regarding your
// rights to use or distribute this software.

package main

import (
	"fmt"
	"os"

	"github.com/hpcng/singularity/cmd/internal/cli"
)

func main() {
	fh, err := os.Create(os.Args[1])
	if err != nil {
		fmt.Println(err)
		return
	}

	defer fh.Close()

	if err := cli.GenBashCompletion(fh); err != nil {
		fmt.Println(err)
		return
	}
}

```

### Core Architecture Module: `cmd/internal/cli/action_flags.go`
```
// Copyright (c) 2018-2021, Sylabs Inc. All rights reserved.
// This software is licensed under a 3-clause BSD license. Please consult the
// LICENSE.md file distributed with the sources of this project regarding your
// rights to use or distribute this software.

package cli

import (
	"os"

	"github.com/hpcng/singularity/pkg/cmdline"
)

// actionflags.go contains flag variables for action-like commands to draw from
var (
	AppName            string
	BindPaths          []string
	Mounts             []string
	HomePath           string
	OverlayPath        []string
	ScratchPath        []string
	WorkdirPath        string
	PwdPath            string
	ShellPath          string
	Hostname           string
	Network            string
	NetworkArgs        []string
	DNS                string
	Security           []string
	CgroupsPath        string
	VMRAM              string
	VMCPU              string
	VMIP               string
	ContainLibsPath    []string
	FuseMount          []string
	SingularityEnv     []string
	SingularityEnvFile string
	NoMount            []string

	IsBoot          bool
	IsFakeroot      bool
	IsCleanEnv      bool
	IsCompat        bool
	IsContained     bool
	IsContainAll    bool
	IsWritable      bool
	IsWritableTmpfs bool
	Nvidia          bool
	NvCCLI          bool
	Rocm            bool
	NoHome          bool
	NoInit          bool
	NoNvidia        bool
	NoRocm          bool
	NoUmask         bool
	VM              bool
	VMErr           bool
	IsSyOS          bool
	disableCache    bool

	NetNamespace  bool
	UtsNamespace  bool
	UserNamespace bool
	PidNamespace  bool
	IpcNamespace  bool

	AllowSUID bool
	KeepPrivs bool
	NoPrivs   bool
	AddCaps   string
	DropCaps  string
)

// --app
var actionAppFlag = cmdline.Flag{
	ID:           "actionAppFlag",
	Value:        &AppName,
	DefaultValue: "",
	Name:         "app",
	Usage:        "set an application to run inside a container",
	EnvKeys:      []string{"APP", "APPNAME"},
}

// -B|--bind
var actionBindFlag = cmdline.Flag{
	ID:           "actionBindFlag",
	Value:        &BindPaths,
	DefaultValue: cmdline.StringArray{}, // to allow commas in bind path
	Name:         "bind",
	ShortHand:    "B",
	Usage:        "a user-bind path specification.  spec has the format src[:dest[:opts]], where src and dest are outside and inside paths.  If dest is not given, it is set equal to src.  Mount options ('opts') may be specified as 'ro' (read-only) or 'rw' (read/write, which is the default). Multiple bind paths can be given by a comma separated list.",
	EnvKeys:      []string{"BIND", "BINDPATH"},
	Tag:          "<spec>",
	EnvHandler:   cmdline.EnvAppendValue,
}

// --mount
var actionMountFlag = cmdline.Flag{
	ID:           "actionMountFlag",
	Value:        &Mounts,
	DefaultValue: cmdline.StringArray{},
	Name:         "mount",
	Usage:        "a mount specification e.g. 'type=bind,source=/opt,destination=/hostopt'.",
	EnvKeys:      []string{"MOUNT"},
	Tag:          "<spec>",
	EnvHandler:   cmdline.EnvAppendValue,
}

// -H|--home
var actionHomeFlag = cmdline.Flag{
	ID:           "actionHomeFlag",
	Value:        &HomePath,
	DefaultValue: CurrentUser.HomeDir,
	Name:         "home",
	ShortHand:    "H",
	Usage:        "a home directory specification.  spec can either be a src path or src:dest pair.  src is the source path of the home directory outside the container and dest overrides the home directory within the container.",
	EnvKeys:      []string{"HOME"},
	Tag:          "<spec>",
}

// -o|--overlay
var actionOverlayFlag = cmdline.Flag{
	ID:           "actionOverlayFlag",
	Value:        &OverlayPath,
	DefaultValue: []string{},
	Name:         "overlay",
	ShortHand:    "o",
	Usage:        "use an overlayFS image for persistent data storage or as read-only layer of container",
	EnvKeys:      []string{"OVERLAY", "OVERLAYIMAGE"},
	Tag:          "<path>",
}

// -S|--scratch
var actionScratchFlag = cmdline.Flag{
	ID:           "actionScratchFlag",
	Value:        &ScratchPath,
	DefaultValue: []string{},
	Name:         "scratch",
	ShortHand:    "S",
	Usage:        "include a scratch directory within the container that is linked to a temporary dir (use -W to force location)",
	EnvKeys:      []string{"SCRATCH", "SCRATCHDIR"},
	Tag:          "<path>",
}

// -W|--workdir
var actionWorkdirFlag = cmdline.Flag{
	ID:           "actionWorkdirFlag",
	Value:        &WorkdirPath,
	DefaultValue: "",
	Name:         "workdir",
	ShortHand:    "W",
	Usage:        "working directory to be used for /tmp, /var/tmp and $HOME (if -c/--contain was also used)",
	EnvKeys:      []string{"WORKDIR"},
	Tag:          "<path>",
}

// --disable-cache
var actionDisableCacheFlag = cmdline.Flag{
	ID:           "actionDisableCacheFlag",
	Value:        &disableCache,
	DefaultValue: false,
	Name:         "disable-cache",
	Usage:        "dont use cache, and dont create cache",
	EnvKeys:      []string{"DISABLE_CACHE"},
}

// -s|--shell
var actionShellFlag = cmdline.Flag{
	ID:           "actionShellFlag",
	Value:        &ShellPath,
	DefaultValue: "",
	Name:         "shell",
	ShortHand:    "s",
	Usage:        "path to program to use for interactive shell",
	EnvKeys:      []string{"SHELL"},
	Tag:          "<path>",
}

// --pwd
var actionPwdFlag = cmdline.Flag{
	ID:           "actionPwdFlag",
	Value:        &PwdPath,
	DefaultValue: "",
	Name:         "pwd",
	Usage:        "initial working directory for payload process inside the container",
	EnvKeys:      []string{"PWD", "TARGET_PWD"},
	Tag:          "<path>",
}

// --hostname
var actionHostnameFlag = cmdline.Flag{
	ID:           "actionHostnameFlag",
	Value:        &Hostname,
	DefaultValue: "",
	Name:         "hostname",
	Usage:        "set container hostname",
	EnvKeys:      []string{"HOSTNAME"},
	Tag:          "<name>",
}

// --network
var actionNetworkFlag = cmdline.Flag{
	ID:           "actionNetworkFlag",
	Value:        &Network,
	DefaultValue: "bridge",
	Name:         "network",
	Usage:        "specify desired network type separated by commas, each network will bring up a dedicated interface inside container",
	EnvKeys:      []string{"NETWORK"},
	Tag:          "<name>",
}

// --network-args
var actionNetworkArgsFlag = cmdline.Flag{
	ID:           "actionNetworkArgsFlag",
	Value:        &NetworkArgs,
	DefaultValue: []string{},
	Name:         "network-args",
	Usage:        "specify network arguments to pass to CNI plugins",
	EnvKeys:      []string{"NETWORK_ARGS"},
	Tag:          "<args>",
}

// --dns
var actionDNSFlag = cmdline.Flag{
	ID:           "actionDnsFlag",
	Value:        &DNS,
	DefaultValue: "",
	Name:         "dns",
	Usage:        "list of DNS server separated by commas to add in resolv.conf",
	EnvKeys:      []string{"DNS"},
}

// --security
var actionSecurityFlag = cmdline.Flag{
	ID:           "actionSecurityFlag",
	Value:        &Security,
	DefaultValue: []string{},
	Name:         "security",
	Usage:        "enable security features (SELinux, Apparmor, Seccomp)",
	EnvKeys:      []string{"SECURITY"},
}

// --apply-cgroups
var actionApplyCgroupsFlag = cmdline.Flag{
	ID:           "actionApplyCgroupsFlag",
	Value:        &CgroupsPath,
	DefaultValue: "",
	Name:         "apply-cgroups",
	Usage:        "apply cgroups from file for container processes (root only)",
	EnvKeys:      []string{"APPLY_CGROUPS"},
}

// --vm-ram
var actionVMRAMFlag = cmdline.Flag{
	ID:           "actionVMRAMFlag",
	Value:        &VMRAM,
	DefaultValue: "1024",
	Name:         "vm-ram",
	Usage:        "amount of RAM in MiB to allocate to Virtual Machine (implies --vm)",
	Tag:          "<size>",
	EnvKeys:      []string{"VM_RAM"},
}

// --vm-cpu
var actionVMCPUFlag = cmdline.Flag{
	ID:           "actionVMCPUFlag",
	Value:        &VMCPU,
	DefaultValue: "1",
	Name:         "vm-cpu",
	Usage:        "number of CPU cores to allocate to Virtual Machine (implies --vm)",
	Tag:          "<CPU #>",
	EnvKeys:      []string{"VM_CPU"},
}

// --vm-ip
var actionVMIPFlag = cmdline.Flag{
	ID:           "actionVMIPFlag",
	Value:        &VMIP,
	DefaultValue: "dhcp",
	Nam
```

### Core Architecture Module: `cmd/internal/cli/actions.go`
```
// Copyright (c) 2020, Control Command Inc. All rights reserved.
// Copyright (c) 2018-2021, Sylabs Inc. All rights reserved.
// This software is licensed under a 3-clause BSD license. Please consult the
// LICENSE.md file distributed with the sources of this project regarding your
// rights to use or distribute this software.

package cli

import (
	"context"
	"fmt"
	"os"
	"runtime"
	"strings"

	"github.com/hpcng/singularity/docs"
	"github.com/hpcng/singularity/internal/pkg/cache"
	"github.com/hpcng/singularity/internal/pkg/client/library"
	"github.com/hpcng/singularity/internal/pkg/client/net"
	"github.com/hpcng/singularity/internal/pkg/client/oci"
	"github.com/hpcng/singularity/internal/pkg/client/oras"
	"github.com/hpcng/singularity/internal/pkg/client/shub"
	"github.com/hpcng/singularity/internal/pkg/util/uri"
	"github.com/hpcng/singularity/pkg/sylog"
	"github.com/spf13/cobra"
)

const (
	defaultPath = "/bin:/usr/bin:/sbin:/usr/sbin:/usr/local/bin:/usr/local/sbin"
)

func getCacheHandle(cfg cache.Config) *cache.Handle {
	h, err := cache.New(cache.Config{
		ParentDir: os.Getenv(cache.DirEnv),
		Disable:   cfg.Disable,
	})
	if err != nil {
		sylog.Fatalf("Failed to create an image cache handle: %s", err)
	}

	return h
}

// actionPreRun will run replaceURIWithImage and will also do the proper path unsetting
func actionPreRun(cmd *cobra.Command, args []string) {
	// For compatibility - we still set USER_PATH so it will be visible in the
	// container, and can be used there if needed. USER_PATH is not used by
	// singularity itself in 3.9+
	userPath := strings.Join([]string{os.Getenv("PATH"), defaultPath}, ":")
	os.Setenv("USER_PATH", userPath)

	os.Setenv("IMAGE_ARG", args[0])

	replaceURIWithImage(cmd.Context(), cmd, args)

	// --compat infers other options that give increased OCI / Docker compatibility
	// Excludes uts/user/net namespaces as these are restrictive for many Singularity
	// installs.
	if IsCompat {
		IsContainAll = true
		IsWritableTmpfs = true
		NoInit = true
		NoUmask = true
	}
}

func handleOCI(ctx context.Context, imgCache *cache.Handle, cmd *cobra.Command, pullFrom string) (string, error) {
	ociAuth, err := makeDockerCredentials(cmd)
	if err != nil {
		sylog.Fatalf("While creating Docker credentials: %v", err)
	}
	return oci.Pull(ctx, imgCache, pullFrom, tmpDir, ociAuth, noHTTPS, false)
}

func handleOras(ctx context.Context, imgCache *cache.Handle, cmd *cobra.Command, pullFrom string) (string, error) {
	ociAuth, err := makeDockerCredentials(cmd)
	if err != nil {
		return "", fmt.Errorf("while creating docker credentials: %v", err)
	}
	return oras.Pull(ctx, imgCache, pullFrom, tmpDir, ociAuth)
}

func handleLibrary(ctx context.Context, imgCache *cache.Handle, pullFrom string) (string, error) {
	r, err := library.NormalizeLibraryRef(pullFrom)
	if err != nil {
		return "", err
	}

	// Default "" = use current remote endpoint
	var libraryURI string
	if r.Host != "" {
		if noHTTPS {
			libraryURI = "http://" + r.Host
		} else {
			libraryURI = "https://" + r.Host
		}
	}

	c, err := getLibraryClientConfig(libraryURI)
	if err != nil {
		return "", err
	}
	return library.Pull(ctx, imgCache, r, runtime.GOARCH, tmpDir, c)
}

func handleShub(ctx context.Context, imgCache *cache.Handle, pullFrom string) (string, error) {
	return shub.Pull(ctx, imgCache, pullFrom, tmpDir, noHTTPS)
}

func handleNet(ctx context.Context, imgCache *cache.Handle, pullFrom string) (string, error) {
	return net.Pull(ctx, imgCache, pullFrom, tmpDir)
}

func replaceURIWithImage(ctx context.Context, cmd *cobra.Command, args []string) {
	// If args[0] is not transport:ref (ex. instance://...) formatted return, not a URI
	t, _ := uri.Split(args[0])
	if t == "instance" || t == "" {
		return
	}

	var image string
	var err error

	// Create a cache handle only when we know we are are using a URI
	imgCache := getCacheHandle(cache.Config{Disable: disableCache})
	if imgCache == nil {
		sylog.Fatalf("failed to create a new image cache handle")
	}

	switch t {
	case uri.Library:
		image, err = handleLibrary(ctx, imgCache, args[0])
	case uri.Oras:
		image, err = handleOras(ctx, imgCache, cmd, args[0])
	case uri.Shub:
		image, err = handleShub(ctx, imgCache, args[0])
	case oci.IsSupported(t):
		image, err = handleOCI(ctx, imgCache, cmd, args[0])
	case uri.HTTP:
		image, err = handleNet(ctx, imgCache, args[0])
	case uri.HTTPS:
		image, err = handleNet(ctx, imgCache, args[0])
	default:
		sylog.Fatalf("Unsupported transport type: %s", t)
	}

	if err != nil {
		sylog.Fatalf("Unable to handle %s uri: %v", args[0], err)
	}

	args[0] = image
}

// setVM will set the --vm option if needed by other options
func setVM(cmd *cobra.Command) {
	// check if --vm-ram or --vm-cpu changed from default value
	for _, flagName := range []string{"vm-ram", "vm-cpu"} {
		if flag := cmd.Flag(flagName); flag != nil && flag.Changed {
			// this option requires the VM setting to be enabled
			cmd.Flags().Set("vm", "true")
			return
		}
	}

	// since --syos is a boolean, it cannot be added to the above list
	if IsSyOS && !VM {
		// let the user know that passing --syos implicitly enables --vm
		sylog.Warningf("The --syos option requires a virtual machine, automatically enabling --vm option.")
		cmd.Flags().Set("vm", "true")
	}
}

// ExecCmd represents the exec command
var ExecCmd = &cobra.Command{
	DisableFlagsInUseLine: true,
	TraverseChildren:      true,
	Args:                  cobra.MinimumNArgs(2),
	PreRun:                actionPreRun,
	Run: func(cmd *cobra.Command, args []string) {
		a := append([]string{"/.singularity.d/actions/exec"}, args[1:]...)
		setVM(cmd)
		if VM {
			execVM(cmd, args[0], a)
			return
		}
		execStarter(cmd, args[0], a, "")
	},

	Use:     docs.ExecUse,
	Short:   docs.ExecShort,
	Long:    docs.ExecLong,
	Example: docs.ExecExamples,
}

// ShellCmd represents the shell command
var ShellCmd = &cobra.Command{
	DisableFlagsInUseLine: true,
	TraverseChildren:      true,
	Args:                  cobra.MinimumNArgs(1),
	PreRun:                actionPreRun,
	Run: func(cmd *cobra.Command, args []string) {
		a := []string{"/.singularity.d/actions/shell"}
		setVM(cmd)
		if VM {
			execVM(cmd, args[0], a)
			return
		}
		execStarter(cmd, args[0], a, "")
	},

	Use:     docs.ShellUse,
	Short:   docs.ShellShort,
	Long:    docs.ShellLong,
	Example: docs.ShellExamples,
}

// RunCmd represents the run command
var RunCmd = &cobra.Command{
	DisableFlagsInUseLine: true,
	TraverseChildren:      true,
	Args:                  cobra.MinimumNArgs(1),
	PreRun:                actionPreRun,
	Run: func(cmd *cobra.Command, args []string) {
		a := append([]string{"/.singularity.d/actions/run"}, args[1:]...)
		setVM(cmd)
		if VM {
			execVM(cmd, args[0], a)
			return
		}
		execStarter(cmd, args[0], a, "")
	},

	Use:     docs.RunUse,
	Short:   docs.RunShort,
	Long:    docs.RunLong,
	Example: docs.RunExamples,
}

// TestCmd represents the test command
var TestCmd = &cobra.Command{
	DisableFlagsInUseLine: true,
	TraverseChildren:      true,
	Args:                  cobra.MinimumNArgs(1),
	PreRun:                actionPreRun,
	Run: func(cmd *cobra.Command, args []string) {
		a := append([]string{"/.singularity.d/actions/test"}, args[1:]...)
		setVM(cmd)
		if VM {
			execVM(cmd, args[0], a)
			return
		}
		execStarter(cmd, args[0], a, "")
	},

	Use:     docs.RunTestUse,
	Short:   docs.RunTestShort,
	Long:    docs.RunTestLong,
	Example: docs.RunTestExample,
}

```

### Core Architecture Module: `cmd/internal/cli/actions_linux.go`
```
// Copyright (c) 2019-2021, Sylabs Inc. All rights reserved.
// This software is licensed under a 3-clause BSD license. Please consult the
// LICENSE.md file distributed with the sources of this project regarding your
// rights to use or distribute this software.

package cli

import (
	"fmt"
	"io"
	"io/ioutil"
	"os"
	"path/filepath"
	"strconv"
	"strings"
	"syscall"
	"time"

	"github.com/hpcng/singularity/internal/pkg/buildcfg"
	"github.com/hpcng/singularity/internal/pkg/image/unpacker"
	"github.com/hpcng/singularity/internal/pkg/instance"
	"github.com/hpcng/singularity/internal/pkg/plugin"
	"github.com/hpcng/singularity/internal/pkg/runtime/engine/config/oci"
	"github.com/hpcng/singularity/internal/pkg/runtime/engine/config/oci/generate"
	"github.com/hpcng/singularity/internal/pkg/security"
	"github.com/hpcng/singularity/internal/pkg/util/bin"
	"github.com/hpcng/singularity/internal/pkg/util/env"
	"github.com/hpcng/singularity/internal/pkg/util/fs"
	"github.com/hpcng/singularity/internal/pkg/util/gpu"
	"github.com/hpcng/singularity/internal/pkg/util/shell/interpreter"
	"github.com/hpcng/singularity/internal/pkg/util/starter"
	"github.com/hpcng/singularity/internal/pkg/util/user"
	imgutil "github.com/hpcng/singularity/pkg/image"
	clicallback "github.com/hpcng/singularity/pkg/plugin/callback/cli"
	singularitycallback "github.com/hpcng/singularity/pkg/plugin/callback/runtime/engine/singularity"
	"github.com/hpcng/singularity/pkg/runtime/engine/config"
	singularityConfig "github.com/hpcng/singularity/pkg/runtime/engine/singularity/config"
	"github.com/hpcng/singularity/pkg/sylog"
	"github.com/hpcng/singularity/pkg/util/capabilities"
	"github.com/hpcng/singularity/pkg/util/cryptkey"
	"github.com/hpcng/singularity/pkg/util/fs/proc"
	"github.com/hpcng/singularity/pkg/util/namespaces"
	"github.com/hpcng/singularity/pkg/util/rlimit"
	"github.com/hpcng/singularity/pkg/util/singularityconf"
	"github.com/spf13/cobra"
	"golang.org/x/sys/unix"
)

// convertImage extracts the image found at filename to directory dir within a temporary directory
// tempDir. If the unsquashfs binary is not located, the binary at unsquashfsPath is used. It is
// the caller's responsibility to remove tempDir when no longer needed.
func convertImage(filename string, unsquashfsPath string) (tempDir, imageDir string, err error) {
	img, err := imgutil.Init(filename, false)
	if err != nil {
		return "", "", fmt.Errorf("could not open image %s: %s", filename, err)
	}
	defer img.File.Close()

	part, err := img.GetRootFsPartition()
	if err != nil {
		return "", "", fmt.Errorf("while getting root filesystem in %s: %s", filename, err)
	}

	// Nice message if we have been given an older ext3 image, which cannot be extracted due to lack of privilege
	// to loopback mount.
	if part.Type == imgutil.EXT3 {
		sylog.Errorf("File %q is an ext3 format continer image.", filename)
		sylog.Errorf("Only SIF and squashfs images can be extracted in unprivileged mode.")
		sylog.Errorf("Use `singularity build` to convert this image to a SIF file using a setuid install of Singularity.")
	}

	// Only squashfs can be extracted
	if part.Type != imgutil.SQUASHFS {
		return "", "", fmt.Errorf("not a squashfs root filesystem")
	}

	// create a reader for rootfs partition
	reader, err := imgutil.NewPartitionReader(img, "", 0)
	if err != nil {
		return "", "", fmt.Errorf("could not extract root filesystem: %s", err)
	}
	s := unpacker.NewSquashfs()
	if !s.HasUnsquashfs() && unsquashfsPath != "" {
		s.UnsquashfsPath = unsquashfsPath
	}

	// keep compatibility with v2
	tmpdir := os.Getenv("SINGULARITY_TMPDIR")
	if tmpdir == "" {
		tmpdir = os.Getenv("SINGULARITY_LOCALCACHEDIR")
		if tmpdir == "" {
			tmpdir = os.Getenv("SINGULARITY_CACHEDIR")
		}
	}

	// create temporary sandbox
	tempDir, err = ioutil.TempDir(tmpdir, "rootfs-")
	if err != nil {
		return "", "", fmt.Errorf("could not create temporary sandbox: %s", err)
	}
	defer func() {
		if err != nil {
			os.RemoveAll(tempDir)
		}
	}()

	// create an inner dir to extract to, so we don't clobber the secure permissions on the tmpDir.
	imageDir = filepath.Join(tempDir, "root")
	if err := os.Mkdir(imageDir, 0o755); err != nil {
		return "", "", fmt.Errorf("could not create root directory: %s", err)
	}

	// extract root filesystem
	if err := s.ExtractAll(reader, imageDir); err != nil {
		return "", "", fmt.Errorf("root filesystem extraction failed: %s", err)
	}

	return tempDir, imageDir, err
}

// checkHidepid checks if hidepid is set on /proc mount point, when this
// option is an instance started with setuid workflow could not even be
// joined later or stopped correctly.
func hidepidProc() bool {
	entries, err := proc.GetMountInfoEntry("/proc/self/mountinfo")
	if err != nil {
		sylog.Warningf("while reading /proc/self/mountinfo: %s", err)
		return false
	}
	for _, e := range entries {
		if e.Point == "/proc" {
			for _, o := range e.SuperOptions {
				if strings.HasPrefix(o, "hidepid=") {
					return true
				}
			}
		}
	}
	return false
}

// Set engine flags to disable mounts, to allow overriding them if they are set true
// in the singularity.conf
func setNoMountFlags(c *singularityConfig.EngineConfig) {
	for _, v := range NoMount {
		switch v {
		case "proc":
			c.SetNoProc(true)
		case "sys":
			c.SetNoSys(true)
		case "dev":
			c.SetNoDev(true)
		case "devpts":
			c.SetNoDevPts(true)
		case "home":
			c.SetNoHome(true)
		case "tmp":
			c.SetNoTmp(true)
		case "hostfs":
			c.SetNoHostfs(true)
		case "cwd":
			c.SetNoCwd(true)
		default:
			sylog.Warningf("Ignoring unknown mount type '%s'", v)
		}
	}
}

// TODO: Let's stick this in another file so that that CLI is just CLI
func execStarter(cobraCmd *cobra.Command, image string, args []string, name string) {
	var err error

	targetUID := 0
	targetGID := make([]int, 0)

	procname := ""

	uid := uint32(os.Getuid())
	gid := uint32(os.Getgid())
	insideUserNs, _ := namespaces.IsInsideUserNamespace(os.Getpid())

	// Are we running from a privileged account?
	isPrivileged := uid == 0
	checkPrivileges := func(cond bool, desc string, fn func()) {
		if !cond {
			return
		}

		if !isPrivileged {
			sylog.Fatalf("%s requires root privileges", desc)
		}

		fn()
	}

	engineConfig := singularityConfig.NewConfig()

	imageArg := os.Getenv("IMAGE_ARG")
	os.Unsetenv("IMAGE_ARG")
	engineConfig.SetImageArg(imageArg)
	engineConfig.File = singularityconf.GetCurrentConfig()
	if engineConfig.File == nil {
		sylog.Fatalf("Unable to get singularity configuration")
	}

	ociConfig := &oci.Config{}
	generator := generate.New(&ociConfig.Spec)

	engineConfig.OciConfig = ociConfig

	generator.SetProcessArgs(args)

	currMask := syscall.Umask(0o022)
	if !NoUmask {
		// Save the current umask, to be set for the process run in the container
		// https://github.com/hpcng/singularity/issues/5214
		sylog.Debugf("Saving umask %04o for propagation into container", currMask)
		engineConfig.SetUmask(currMask)
		engineConfig.SetRestoreUmask(true)
	}

	uidParam := security.GetParam(Security, "uid")
	gidParam := security.GetParam(Security, "gid")

	// handle target UID/GID for root user
	checkPrivileges(uidParam != "", "uid security feature", func() {
		u, err := strconv.ParseUint(uidParam, 10, 32)
		if err != nil {
			sylog.Fatalf("failed to parse provided UID")
		}
		targetUID = int(u)
		uid = uint32(targetUID)

		engineConfig.SetTargetUID(targetUID)
	})

	checkPrivileges(gidParam != "", "gid security feature", func() {
		gids := strings.Split(gidParam, ":")
		for _, id := range gids {
			g, err := strconv.ParseUint(id, 10, 32)
			if err != nil {
				sylog.Fatalf("failed to parse provided GID")
			}
			targetGID = append(targetGID, int(g))
		}
		if len(gids) > 0 {
			gid = uint32(targetGID[0])
		}

		engineConfig.SetTargetGID(targetGID)
	})

	if strings.HasPrefix(image, "instance://") {
		if name != "" {
			sylog.Fatalf("Starting an instance from another is not allowed")
		}
		instanceName := instance.ExtractName(image)
		file, err := instance.Get(instanceName,
```

### Core Architecture Module: `cmd/internal/cli/cache_clean_linux.go`
```
// Copyright (c) 2018-2020, Sylabs Inc. All rights reserved.
// This software is licensed under a 3-clause BSD license. Please consult the
// LICENSE.md file distributed with the sources of this project regarding your
// rights to use or distribute this software.

package cli

import (
	"bufio"
	"fmt"
	"os"
	"strings"

	"github.com/hpcng/singularity/docs"
	"github.com/hpcng/singularity/internal/app/singularity"
	"github.com/hpcng/singularity/internal/pkg/cache"
	"github.com/hpcng/singularity/pkg/cmdline"
	"github.com/hpcng/singularity/pkg/sylog"
	"github.com/spf13/cobra"
)

func init() {
	addCmdInit(func(cmdManager *cmdline.CommandManager) {
		cmdManager.RegisterFlagForCmd(&cacheCleanTypesFlag, cacheCleanCmd)
		cmdManager.RegisterFlagForCmd(&cacheCleanDaysFlag, cacheCleanCmd)
		cmdManager.RegisterFlagForCmd(&cacheCleanDryFlag, cacheCleanCmd)
		cmdManager.RegisterFlagForCmd(&cacheCleanForceFlag, cacheCleanCmd)
	})
}

var (
	cacheCleanTypes []string
	cacheCleanDays  int
	cacheCleanDry   bool
	cacheCleanForce bool

	// -T|--type
	cacheCleanTypesFlag = cmdline.Flag{
		ID:           "cacheCleanTypes",
		Value:        &cacheCleanTypes,
		DefaultValue: []string{"all"},
		Name:         "type",
		ShortHand:    "T",
		Usage:        "a list of cache types to clean (possible values: library, oci, shub, blob, net, oras, all)",
	}

	// -D|--days
	cacheCleanDaysFlag = cmdline.Flag{
		ID:           "cacheCleanDaysFlag",
		Value:        &cacheCleanDays,
		DefaultValue: 0,
		Name:         "days",
		ShortHand:    "D",
		Usage:        "remove all cache entries older than specified number of days",
	}

	// -n|--dry-run
	cacheCleanDryFlag = cmdline.Flag{
		ID:           "cacheCleanDryFlag",
		Value:        &cacheCleanDry,
		DefaultValue: false,
		Name:         "dry-run",
		ShortHand:    "n",
		Usage:        "operate in dry run mode and do not actually clean the cache",
	}

	// -f|--force
	cacheCleanForceFlag = cmdline.Flag{
		ID:           "cacheCleanForceFlag",
		Value:        &cacheCleanForce,
		DefaultValue: false,
		Name:         "force",
		ShortHand:    "f",
		Usage:        "suppress any prompts and clean the cache",
	}

	// cacheCleanCmd is 'singularity cache clean' and will clear your local singularity cache
	cacheCleanCmd = &cobra.Command{
		DisableFlagsInUseLine: true,
		Run: func(cmd *cobra.Command, args []string) {
			if err := cleanCache(); err != nil {
				sylog.Fatalf("Handle clean failed: %v", err)
			}
		},

		Use:     docs.CacheCleanUse,
		Short:   docs.CacheCleanShort,
		Long:    docs.CacheCleanLong,
		Example: docs.CacheCleanExample,
	}
)

func cleanCache() error {
	if cacheCleanDry {
		fmt.Println("User requested a dry run. Not actually deleting any data!")
	}
	if !cacheCleanForce && !cacheCleanDry {
		ok, err := cleanCachePrompt()
		if err != nil {
			return fmt.Errorf("could not prompt user: %v", err)
		}
		if !ok {
			sylog.Infof("Handle cleanup canceled")
			return nil
		}
	}

	// create a handle to access the current image cache
	imgCache := getCacheHandle(cache.Config{})
	err := singularity.CleanSingularityCache(imgCache, cacheCleanDry, cacheCleanTypes, cacheCleanDays)
	if err != nil {
		return fmt.Errorf("could not clean cache: %v", err)
	}
	return nil
}

func cleanCachePrompt() (bool, error) {
	fmt.Print(`This will delete everything in your cache (containers from all sources and OCI blobs). 
Hint: You can see exactly what would be deleted by canceling and using the --dry-run option.
Do you want to continue? [N/y] `)

	r := bufio.NewReader(os.Stdin)
	input, err := r.ReadString('\n')
	if err != nil {
		return false, fmt.Errorf("could not read user's input: %s", err)
	}

	return strings.ToLower(input) == "y\n", nil
}

```

### Core Architecture Module: `cmd/internal/cli/cache_linux.go`
```
// Copyright (c) 2018-2019, Sylabs Inc. All rights reserved.
// This software is licensed under a 3-clause BSD license. Please consult the
// LICENSE.md file distributed with the sources of this project regarding your
// rights to use or distribute this software.

package cli

import (
	"errors"

	"github.com/hpcng/singularity/docs"
	"github.com/hpcng/singularity/pkg/cmdline"
	"github.com/spf13/cobra"
)

func init() {
	addCmdInit(func(cmdManager *cmdline.CommandManager) {
		cmdManager.RegisterCmd(CacheCmd)
		cmdManager.RegisterSubCmd(CacheCmd, cacheCleanCmd)
		cmdManager.RegisterSubCmd(CacheCmd, CacheListCmd)
	})
}

// CacheCmd : aka, `singularity cache`
var CacheCmd = &cobra.Command{
	RunE: func(cmd *cobra.Command, args []string) error {
		return errors.New("invalid command")
	},
	DisableFlagsInUseLine: true,

	Use:           docs.CacheUse,
	Short:         docs.CacheShort,
	Long:          docs.CacheLong,
	Example:       docs.CacheExample,
	SilenceErrors: true,
}

```

### Core Architecture Module: `cmd/internal/cli/cache_list_linux.go`
```
// Copyright (c) 2018-2020, Sylabs Inc. All rights reserved.
// This software is licensed under a 3-clause BSD license. Please consult the
// LICENSE.md file distributed with the sources of this project regarding your
// rights to use or distribute this software.

package cli

import (
	"os"

	"github.com/hpcng/singularity/docs"
	"github.com/hpcng/singularity/internal/app/singularity"
	"github.com/hpcng/singularity/internal/pkg/cache"
	"github.com/hpcng/singularity/pkg/cmdline"
	"github.com/hpcng/singularity/pkg/sylog"
	"github.com/spf13/cobra"
)

var (
	cacheListTypes   []string
	cacheListVerbose bool
)

// -T|--type
var cacheListTypesFlag = cmdline.Flag{
	ID:           "cacheListTypes",
	Value:        &cacheListTypes,
	DefaultValue: []string{"all"},
	Name:         "type",
	ShortHand:    "T",
	Usage:        "a list of cache types to display, possible entries: library, oci, shub, blob(s), all",
}

// -s|--summary
var cacheListVerboseFlag = cmdline.Flag{
	ID:           "cacheListVerbose",
	Value:        &cacheListVerbose,
	DefaultValue: false,
	Name:         "verbose",
	ShortHand:    "v",
	Usage:        "include cache entries in the output",
}

func init() {
	addCmdInit(func(cmdManager *cmdline.CommandManager) {
		cmdManager.RegisterFlagForCmd(&cacheListTypesFlag, CacheListCmd)
		cmdManager.RegisterFlagForCmd(&cacheListVerboseFlag, CacheListCmd)
	})
}

// CacheListCmd is 'singularity cache list' and will list your local singularity cache
var CacheListCmd = &cobra.Command{
	DisableFlagsInUseLine: true,
	Run: func(cmd *cobra.Command, args []string) {
		if err := cacheListCmd(); err != nil {
			os.Exit(2)
		}
	},

	Use:     docs.CacheListUse,
	Short:   docs.CacheListShort,
	Long:    docs.CacheListLong,
	Example: docs.CacheListExample,
}

func cacheListCmd() error {
	// A get a handle for the current image cache
	imgCache := getCacheHandle(cache.Config{})
	if imgCache == nil {
		sylog.Fatalf("failed to create image cache handle")
	}

	err := singularity.ListSingularityCache(imgCache, cacheListTypes, cacheListVerbose)
	if err != nil {
		sylog.Fatalf("An error occurred while listing cache: %v", err)
		return err
	}
	return nil
}

```

### Core Architecture Module: `cmd/internal/cli/capability_linux.go`
```
// Copyright (c) 2018-2020, Sylabs Inc. All rights reserved.
// This software is licensed under a 3-clause BSD license. Please consult the
// LICENSE.md file distributed with the sources of this project regarding your
// rights to use or distribute this software.

package cli

import (
	"errors"

	"github.com/hpcng/singularity/docs"
	"github.com/hpcng/singularity/internal/app/singularity"
	"github.com/hpcng/singularity/internal/pkg/buildcfg"
	"github.com/hpcng/singularity/pkg/cmdline"
	"github.com/hpcng/singularity/pkg/sylog"
	"github.com/spf13/cobra"
)

// CapConfig contains flag variables for capability commands
type CapConfig struct {
	CapUser  string
	CapGroup string
}

var capConfig = new(CapConfig)

// -u|--user
var capUserFlag = cmdline.Flag{
	ID:           "capUserFlag",
	Value:        &capConfig.CapUser,
	DefaultValue: "",
	Name:         "user",
	ShortHand:    "u",
	Usage:        "manage capabilities for a user",
	EnvKeys:      []string{"CAP_USER"},
}

// -g|--group
var capGroupFlag = cmdline.Flag{
	ID:           "capGroupFlag",
	Value:        &capConfig.CapGroup,
	DefaultValue: "",
	Name:         "group",
	ShortHand:    "g",
	Usage:        "manage capabilities for a group",
	EnvKeys:      []string{"CAP_GROUP"},
}

// CapabilityAvailCmd singularity capability avail
var CapabilityAvailCmd = &cobra.Command{
	Args:                  cobra.RangeArgs(0, 1),
	DisableFlagsInUseLine: true,
	Run: func(cmd *cobra.Command, args []string) {
		caps := ""
		if len(args) > 0 {
			caps = args[0]
		}
		c := singularity.CapAvailConfig{
			Caps: caps,
			Desc: len(args) == 0,
		}
		if err := singularity.CapabilityAvail(c); err != nil {
			sylog.Fatalf("Unable to list available capabilities: %s", err)
		}
	},

	Use:     docs.CapabilityAvailUse,
	Short:   docs.CapabilityAvailShort,
	Long:    docs.CapabilityAvailLong,
	Example: docs.CapabilityAvailExample,
}

// CapabilityAddCmd singularity capability add
var CapabilityAddCmd = &cobra.Command{
	Args:                  cobra.ExactArgs(1),
	DisableFlagsInUseLine: true,
	Run: func(cmd *cobra.Command, args []string) {
		c := singularity.CapManageConfig{
			Caps:  args[0],
			User:  capConfig.CapUser,
			Group: capConfig.CapGroup,
		}

		if err := singularity.CapabilityAdd(buildcfg.CAPABILITY_FILE, c); err != nil {
			sylog.Fatalf("Unable to add capabilities: %s", err)
		}
	},

	Use:     docs.CapabilityAddUse,
	Short:   docs.CapabilityAddShort,
	Long:    docs.CapabilityAddLong,
	Example: docs.CapabilityAddExample,
}

// CapabilityDropCmd singularity capability drop
var CapabilityDropCmd = &cobra.Command{
	Args:                  cobra.ExactArgs(1),
	DisableFlagsInUseLine: true,
	Run: func(cmd *cobra.Command, args []string) {
		c := singularity.CapManageConfig{
			Caps:  args[0],
			User:  capConfig.CapUser,
			Group: capConfig.CapGroup,
		}

		if err := singularity.CapabilityDrop(buildcfg.CAPABILITY_FILE, c); err != nil {
			sylog.Fatalf("Unable to drop capabilities: %s", err)
		}
	},

	Use:     docs.CapabilityDropUse,
	Short:   docs.CapabilityDropShort,
	Long:    docs.CapabilityDropLong,
	Example: docs.CapabilityDropExample,
}

// CapabilityListCmd singularity capability list
var CapabilityListCmd = &cobra.Command{
	Args:                  cobra.RangeArgs(0, 1),
	DisableFlagsInUseLine: true,
	Run: func(cmd *cobra.Command, args []string) {
		userGroup := ""
		if len(args) == 1 {
			userGroup = args[0]
		}
		c := singularity.CapListConfig{
			User:  userGroup,
			Group: userGroup,
			All:   len(args) == 0,
		}

		if err := singularity.CapabilityList(buildcfg.CAPABILITY_FILE, c); err != nil {
			sylog.Fatalf("Unable to list capabilities: %s", err)
		}
	},

	Use:     docs.CapabilityListUse,
	Short:   docs.CapabilityListShort,
	Long:    docs.CapabilityListLong,
	Example: docs.CapabilityListExample,
}

// CapabilityCmd is the capability command
var CapabilityCmd = &cobra.Command{
	RunE: func(cmd *cobra.Command, args []string) error {
		return errors.New("Invalid command")
	},
	DisableFlagsInUseLine: true,

	Aliases:       []string{"caps"},
	Use:           docs.CapabilityUse,
	Short:         docs.CapabilityShort,
	Long:          docs.CapabilityLong,
	Example:       docs.CapabilityExample,
	SilenceErrors: true,
}

func init() {
	addCmdInit(func(cmdManager *cmdline.CommandManager) {
		cmdManager.RegisterCmd(CapabilityCmd)

		cmdManager.RegisterSubCmd(CapabilityCmd, CapabilityAddCmd)
		cmdManager.RegisterSubCmd(CapabilityCmd, CapabilityDropCmd)
		cmdManager.RegisterSubCmd(CapabilityCmd, CapabilityListCmd)
		cmdManager.RegisterSubCmd(CapabilityCmd, CapabilityAvailCmd)

		cmdManager.RegisterFlagForCmd(&capUserFlag, CapabilityAddCmd, CapabilityDropCmd)
		cmdManager.RegisterFlagForCmd(&capGroupFlag, CapabilityAddCmd, CapabilityDropCmd)
	})
}

```


### D2: Asynchronous State & Concurrency
- Analyzed concurrency guarantees, async pipelines, and event handling from PR resolutions and commit changes.

### D3: Error Boundaries, Recovery & Rollbacks
- Exception handling patterns and defect resolutions extracted from closed production bug issues:
- **Issue #6086** (2022-05-19): **Invalid path for --pwd is ignored instead of producing an error**
  *Symptoms*: ### Version of Singularity:  What version of Singularity are you using? Run:  ``` $ singularity --version singularity version 3.8.0-1.el7 ```  ### Expected behavior  When I specify the `--pwd` command to `singularity exec`, I expect that the working directory is set to that location. When the location does not exist, I expect an error, in the same way that `cd` behaves (and any similar function in all interpreted programming languages I know, `setwd()` in R, `os.chdir()` in Python, ...)  ### Actual behavior  If the path to `--pwd`  does not exist inside the container, it defaults to `$HOME`. I can not imagine a situation where this default would be useful if I give `--pwd` explicitly. Also this might lead to files being overwritten by accident if singularity for example was called by a script which assumes that the working directory is set successfully because there was no error by singularity.   ### Steps to reproduce this behavior ``` singularity pull library://default/alpine singularity exec --pwd /etc alpine_latest.sif # /etc singularity exec --pwd /no/such/path alpine_latest.sif # /home/user ```  ### What OS/distro are you running centos-release-7-9.2009.1.el7.centos.x86_64   ### How did you install Singularity  Via `yum`.  
  **Post-Mortem & Fix Analysis**:
  > I agree this is bad behavior.  @cclerget do you agree?

- **Issue #6048** (2021-08-03): **Runtime error**
  *Symptoms*: Hi folks: We rebooted our cluster and have started seeing this error with singularity run  command with version 3.5 and 3.6: ``` panic: runtime error: index out of range [9] with length 9 goroutine 7 [running]: github.com/sylabs/singularity/pkg/util/fs/proc.parseMountInfoLine(0xc0000d86e0, 0x43, 0x0, 0x0, 0x0, 0x0, 0x0, 0x0, 0x0, 0x0, ...)         github.com/sylabs/singularity/pkg/util/fs/proc/proc.go:113 +0x581 github.com/sylabs/singularity/pkg/util/fs/proc.GetMountInfoEntry(0xab9890, 0x14, 0x0, 0x0, 0x0, 0x0, 0x0)         github.com/sylabs/singularity/pkg/util/fs/proc/proc.go:145 +0x1f6 github.com/sylabs/singularity/internal/pkg/runtime/engine/singularity.(*EngineOperations).prepareAutofs(0xc0000fefd0, 0xc000010678, 0x0, 0xab019c)         github.com/sylabs/singularity/internal/pkg/runtime/engine/singularity/prepare_linux.go:399 +0x4b github.com/sylabs/singularity/internal/pkg/runtime/engine/singularity.(*EngineOperations).prepareContainerConfig(0xc0000fefd0, 0xc000010678, 0x0, 0x0)         github.com/sylabs/singularity/internal/pkg/runtime/engine/singularity/prepare_linux.go:596 +0x8a7 github.com/sylabs/singularity/internal/pkg/runtime/engine/singularity.(*EngineOperations).PrepareConfig(0xc0000fefd0, 0xc000010678, 0x5, 0xab7415)         github.com/sylabs/singularity/internal/pkg/runtime/engine/singularity/prepare_linux.go:128 +0x5d8 github.com/sylabs/singularity/internal/app/starter.StageOne(0xc000010678, 0xc00000f340)         github.com/sylabs/singularity/internal/app/sta
  **Post-Mortem & Fix Analysis**:
  > Hi @mshaikh786, this looks like an issue with parsing `/proc/self/mountinfo`. Can you include a run with full debug info `singularity -d ...`, your kernel version, and the output of your `/proc/self/mountinfo`? It looks like there is a standard format for entries in that file that we are either incorrectly parsing or incorrectly output on your system
  > Hi @ikaneshiro  Thanks for a prompt response.  Attached is the output of the two actions you suggested.  [slurm-15895470.txt](https://github.com/hpcng/singularity/files/6675470/slurm-15895470.txt) 
  > The last line of the mountinfo ``` / /dev/shm rw,relatime - tmpfs  rw,mode=750,uid=174988 ``` has only 9 whitespace-separated fields instead of the usual 10.  The 9th field is empty, with two spaces in a row.  So the splitting should be done based on a single blank rather than on whitespace.

- **Issue #5956** (2021-04-23): **fix: respect proxy on keyserver operations**
  *Symptoms*: ## Description of the Pull Request (PR):  When creating an http.Client with a custom Transport, we need to manually setup the env var proxy handling that the http.DefaultTransport provides normally.  You can test the proxy is now respected by setting an invalid proxy and noting that the error shows it is being used:  ``` 03:24 PM $ export https_proxy=https://foo  03:24 PM $ singularity key search bob ERROR:   search failed: failed to get key: Get "https://keys.sylabs.io/pks/lookup?fingerprint=on&op=index&options=mr&search=bob&x-pagesize=256": Get "https://keys.sylabs.io/pks/lookup?fingerprint=on&op=index&options=mr&search=bob&x-pagesize=256": proxyconnect tcp: dial tcp: lookup foo: no such host ```  ### This fixes or addresses the following GitHub issues:   - Fixes #5876    #### Before submitting a PR, make sure you have done the following:  - Read the [Guidelines for Contributing](https://github.com/sylabs/singularity/blob/master/CONTRIBUTING.md), and this PR conforms to the stated requirements. - Added changes to the [CHANGELOG](https://github.com/sylabs/singularity/blob/master/CHANGELOG.md) if necessary according to the [Contribution Guidelines](https://github.com/sylabs/singularity/blob/master/CONTRIBUTING.md) - Added tests to validate this PR, linted with `make check`  and tested this PR locally with a `make test`, and `make testall` if possible (see CONTRIBUTING.md). - Based this PR against the appropriate branch according to the [Contribution G

- **Issue #5955** (2021-04-23): **Implement a copy-through ProgressCallback for silent loglevels**
  *Symptoms*: ## Description of the Pull Request (PR):  A nil ProgressCallback is returned for silent / quiet loglevels which leads to a panic when this is blindly used by image download clients (shub / net).  To avoid having to check for a nil callback and behave differently in the client code, return a callback that does a straight copy-through in these cases.  ### This fixes or addresses the following GitHub issues:   - Fixes #5924    #### Before submitting a PR, make sure you have done the following:  - Read the [Guidelines for Contributing](https://github.com/sylabs/singularity/blob/master/CONTRIBUTING.md), and this PR conforms to the stated requirements. - Added changes to the [CHANGELOG](https://github.com/sylabs/singularity/blob/master/CHANGELOG.md) if necessary according to the [Contribution Guidelines](https://github.com/sylabs/singularity/blob/master/CONTRIBUTING.md) - Added tests to validate this PR, linted with `make check`  and tested this PR locally with a `make test`, and `make testall` if possible (see CONTRIBUTING.md). - Based this PR against the appropriate branch according to the [Contribution Guidelines](https://github.com/sylabs/singularity/blob/master/CONTRIBUTING.md) - Added myself as a contributor to the [Contributors File](https://github.com/sylabs/singularity/blob/master/CONTRIBUTORS.md) 

- **Issue #5929** (2021-04-15): **False network not permitted error since #5886**
  *Symptoms*: ### Version of Singularity:  What version of Singularity are you using? Run:  ``` master ```   ### Actual behavior  PR #5886 causes a false error when a network is not requested:  ``` ERROR:   Network bridge is not permitted for unprivileged users. ```  The bridge network is not being requests or used, but the error is printed. We need to bail out if there is no NetNS / nonet by moving this code up above the permissions checks:  https://github.com/hpcng/singularity/blob/0035c69a0e084505f6dcdd71b50bac0949d61d47/internal/pkg/runtime/engine/singularity/container_linux.go#L2274  

- **Issue #5924** (2021-04-23): **container download from shub / net crashes with silent loglevel**
  *Symptoms*: ### Version of Singularity: `3.7.1` ### Expected behavior  What did you expect to see when you do...?  `$ singularity  -s exec shub://repeatexplorer/repex_tarean:0.3.8.dbaa07f /bin/sh ` should work without  crashing ### Actual behavior  Container download crashes because it does not expect nil progress bar callback at pull.go:100 :   `$ singularity -s exec shub://repeatexplorer/repex_tarean:0.3.8.dbaa07f /bin/sh panic: runtime error: invalid memory address or nil pointer dereference [signal SIGSEGV: segmentation violation code=0x1 addr=0x0 pc=0x55a1c13527d9]  goroutine 1 [running]: github.com/sylabs/singularity/internal/pkg/client/shub.DownloadImage(0x55a1c186c460, 0xc000036068, 0xc0001fa000, 0x3cd, 0xc0004480e0, 0x1b, 0xc0005183e0, 0xd, 0xc0004481c0, 0x20, ...)         github.com/sylabs/singularity@v0.0.0/internal/pkg/client/shub/pull.go:100 +0x859 github.com/sylabs/singularity/internal/pkg/client/shub.pull(0x55a1c186c460, 0xc000036068, 0xc00051c420, 0x0, 0x0, 0x7ffd75add097, 0x30, 0xc00071fb00, 0x0, 0x0, ...)         github.com/sylabs/singularity@v0.0.0/internal/pkg/client/shub/pull.go:159 +0x513 github.com/sylabs/singularity/internal/pkg/client/shub.Pull(0x55a1c186c460, 0xc000036068, 0xc00051c420, 0x7ffd75add097, 0x30, 0xc00003c097, 0x1e, 0x0, 0x55a1c096ffa7, 0x3c, ...)         github.com/sylabs/singularity@v0.0.0/internal/pkg/client/shub/pull.go:193 +0x9d github.com/sylabs/singularity/cmd/internal/cli.handleShub(...)         github.com/sylabs/sing
  **Post-Mortem & Fix Analysis**:
  > This has also been observed for net downloads.

- **Issue #5897** (2021-06-11): **pushing a new key to a custom remote outputs no keystore url**
  *Symptoms*: ### Version of Singularity:  What version of Singularity are you using? Run:  ``` $ singularity version 3.7.2 ```  ### Expected behavior  when creating and pushing a new key for a custom remote (keys.domain.tld), the output doesn't report an URL  ```sh singularity key newpair ```  After filling in all the prompts and pushing to the custom remote the last output line should read.   ```sh Key successfully pushed to: keys.domain.tld ```  ### Actual behavior  ```sh Key successfully pushed to:  ``` 
  **Post-Mortem & Fix Analysis**:
  > Hello,  This is a templated response that is being sent out to all open issues.  We are working hard on 'rebuilding' the Singularity community, and a major task on the agenda is finding out what issues are still outstanding.   **Please consider the following:**  1. Is this issue a duplicate, or has it been fixed/implemented since being added? 2. Is the issue still relevant to the current state of Singularity's functionality? 3. Would you like to continue discussing this issue or feature request?   Thanks, Carter 
  > This is still relevant, and Sylabs fixed it in their [pr 24](https://github.com/sylabs/singularity/pull/24).
  > I could run and test it, keys pushed succesfully to Keystore. 

- **Issue #5876** (2021-04-23): **Key search ignoring proxy?**
  *Symptoms*: ### Version of Singularity:  ``` $ singularity version 3.7.1-1.el7 ```  ### Expected behavior Key search should respect proxy environment variables, as for other commands, e.g. "pull" or "remote status".  ``` $ set | grep -i proxy http_proxy=http://proxy:9999 https_proxy=http://proxy:9999 no_proxy='localhost,127.0.0.0/8,::1' $ singularity remote status INFO:    Checking status of default remote. SERVICE    STATUS  VERSION             URI Builder    OK      v1.3.8-0-g96579fc   https://build.sylabs.io Consent    OK      v1.4.6-0-g39637f8   https://auth.sylabs.io/consent Keyserver  OK      v1.17.5-0-g4922045  https://keys.sylabs.io Library    OK      v1.2.10-0-g00e24c0  https://library.sylabs.io Token      OK      v1.4.6-0-g39637f8   https://auth.sylabs.io/token  No authentication token set (logged out). $ singularity key search E5F780B2C22F59DF748524B435C3844412EE233B Showing 1 results  KEY ID    BITS  NAME/EMAIL 12EE233B  4096  David Trudgian (demo) <david.trudgian@sylabs.io> $ curl "https://keys.sylabs.io/pks/lookup?fingerprint=on&op=index&options=mr&search=0xE5F780B2C22F59DF748524B435C3844412EE233B&x-pagesize=256" info:1:1 pub:E5F780B2C22F59DF748524B435C3844412EE233B:1:4096:1573833294:: uid:David Trudgian (demo) <david.trudgian@sylabs.io>:1573833294:: ```  ### Actual behavior  ``` $ set | grep -i proxy http_proxy=http://proxy:9999 https_proxy=http://proxy:9999 no_proxy='localhost,127.0.0.0/8,::1' $ singularity remote status INFO:  
  **Post-Mortem & Fix Analysis**:
  > This behavior definitely needs to be addressed. Thanks for reporting the issue.
  > FYI, the same behaviour exists for the verify command. For example, if a proxy is required (and defined in the env vars) then the command fails: ``` $ singularity verify signed-image.sif Verifying image: signed-image.sif WARNING: failed to get key material: Get "https://keys.sylabs.io/pks/lookup?exact=on&op=get&search=0x<key-id>": Get "https://keys.sylabs.io/pks/lookup?exact=on&op=get&search=0x<key-id>": context deadline exceeded (Client.Timeout exceeded while awaiting headers)  Error encountered during signature verification: signature object 4 not valid: openpgp: signature made by unknown entity FATAL:   Failed to verify container: integrity: signature object 4 not valid: openpgp: signature made by unknown entity ```
  > As a partial workaround for an installation that requires use of a proxy, if you have access to another installation with working key functionality you can manually transfer public key(s) required for verification to the target installation's personal/global key ring. The verification process will check these before trying to use the network.  For example: ``` working-machine $ singularity key list Public key listing (/home/user/.singularity/sypgp/pgp-public):  working-machine $ singularity key pull E5F780B2C22F59DF748524B435C3844412EE233B 1 key(s) added to keyring of trust /home/user/.singularity/sypgp/pgp-public  broken-machine $ singularity key list Public key listing (/home/user/.singularity/sypgp/pgp-public):  broken-machine $ scp working-machine:./singularity/sypgp/pgp-public ./singularity/sypgp/pgp-public ```

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

### Incident Patch 1: `190ff064` (2021-11-05)
**Commit Message**: fix: do not output progress bar on redirected output

**File**: `internal/app/singularity/push.go` (modified, +24/-4)
```diff
@@ -13,6 +13,7 @@ import (
 	"io"
 	"os"
 	"strings"
+	"time"
 
 	"github.com/hpcng/sif/v2/pkg/sif"
 	"github.com/hpcng/singularity/internal/pkg/util/fs"
@@ -21,6 +22,7 @@ import (
 	"github.com/sylabs/scs-library-client/client"
 	"github.com/vbauerster/mpb/v4"
 	"github.com/vbauerster/mpb/v4/decor"
+	"golang.org/x/term"
 )
 
 // ErrLibraryUnsigned indicated that the image intended to be used is
@@ -79,8 +81,12 @@ func (c *progressCallback) Finish() {
 // LibraryPush will upload an image file according to the provided LibraryPushSpec
 // Before uploading, the image will be checked for a valid signature unless AllowUnsigned is true
 func LibraryPush(ctx context.Context, pushSpec LibraryPushSpec, libraryConfig *client.Config, co []keyclient.Option) error {
-	if _, err := os.Stat(pushSpec.SourceFile); os.IsNotExist(err) {
-		return fmt.Errorf("unable to open: %v: %v", pushSpec.SourceFile, err)
+	fi, err := os.Stat(pushSpec.SourceFile)
+	if err != nil {
+		if os.IsNotExist(err) {
+			return fmt.Errorf("unable to open: %v: %v", pushSpec.SourceFile, err)
+		}
+		return err
 	}
 
 	arch, err := sifArch(pushSpec.SourceFile)
@@ -116,8 +122,22 @@ func LibraryPush(ctx context.Context, pushSpec LibraryPushSpec, libraryConfig *c
 	}
 	defer f.Close()
 
-	resp, err := libraryClient.UploadImage(ctx, f, r.Host+r.Path, arch, r.Tags, pushSpec.Description, &progressCallback{})
-	if err != nil {
+	var progressBar client.UploadCallback
+	if !term.IsTerminal(2) {
+		sylog.Infof("Uploading %d bytes\n", fi.Size())
+	} else {
+		progressBar = &progressCallback{}
+	}
+
+	var resp *client.UploadImageComplete
+
+	defer func(t time.Time) {
+		if err == nil && resp != nil && progressBar == nil {
+			sylog.Infof("Uploaded %d bytes in %v\n", fi.Size(), time.Since(t))
+		}
+	}(time.Now())
+
+	if resp, err = libraryClient.UploadImage(ctx, f, r.Host+r.Path, arch, r.Tags, pushSpec.Description, progressBar); err != nil {
 		return err
 	}
 
```

**File**: `internal/pkg/client/library/pull.go` (modified, +54/-30)
```diff
@@ -11,6 +11,8 @@ import (
 	"errors"
 	"fmt"
 	"io/ioutil"
+	"os"
+	"time"
 
 	"github.com/hpcng/singularity/internal/app/singularity"
 	"github.com/hpcng/singularity/internal/pkg/cache"
@@ -19,13 +21,15 @@ import (
 	"github.com/hpcng/singularity/pkg/sylog"
 	keyclient "github.com/sylabs/scs-key-client/client"
 	libclient "github.com/sylabs/scs-library-client/client"
+	scslibrary "github.com/sylabs/scs-library-client/client"
+	"golang.org/x/term"
 )
 
 // ErrLibraryPullUnsigned indicates that the interactive portion of the pull was aborted.
 var ErrLibraryPullUnsigned = errors.New("failed to verify container")
 
 // pull will pull a library image into the cache if directTo="", or a specific file if directTo is set.
-func pull(ctx context.Context, imgCache *cache.Handle, directTo string, imageRef *libclient.Ref, arch string, libraryConfig *libclient.Config) (imagePath string, err error) {
+func pull(ctx context.Context, imgCache *cache.Handle, directTo string, imageRef *libclient.Ref, arch string, libraryConfig *libclient.Config) (string, error) {
 	c, err := libclient.NewClient(libraryConfig)
 	if err != nil {
 		return "", fmt.Errorf("unable to initialize client library: %v", err)
@@ -34,50 +38,70 @@ func pull(ctx context.Context, imgCache *cache.Handle, directTo string, imageRef
 	ref := fmt.Sprintf("%s:%s", imageRef.Path, imageRef.Tags[0])
 
 	libraryImage, err := c.GetImage(ctx, arch, ref)
-	if err == libclient.ErrNotFound {
-		return "", fmt.Errorf("image does not exist in the library: %s (%s)", ref, arch)
-	}
 	if err != nil {
+		if errors.Is(err, libclient.ErrNotFound) {
+			return "", fmt.Errorf("image does not exist in the library: %s (%s)", ref, arch)
+		}
 		return "", err
 	}
 
+	var progressBar scslibrary.ProgressBar
+	if term.IsTerminal(2) {
+		progressBar = &client.DownloadProgressBar{}
+	}
+
 	if directTo != "" {
-		sylog.Infof("Downloading library image")
-		if err = DownloadImage(ctx, c, directTo, arch, imageRef, &client.DownloadProgressBar{}); err != nil {
+		// Download direct to file
+		if err := downloadWrapper(ctx, c, directTo, arch, imageRef, progressBar); err != nil {
 			return "", fmt.Errorf("unable to download image: %v", err)
 		}
-		imagePath = directTo
+		return directTo, nil
+	}
 
-	} else {
-		cacheEntry, err := imgCache.GetEntry(cache.LibraryCacheType, libraryImage.Hash)
-		if err != nil {
-			return "", fmt.Errorf("unable to check if %v exists in cache: %v", libraryImage.Hash, err)
+	cacheEntry, err := imgCache.GetEntry(cache.LibraryCacheType, libraryImage.Hash)
+	if err != nil {
+		return "", fmt.Errorf("unable to check if %v exists in cache: %v", libraryImage.Hash, err)
+	}
+	defer cacheEntry.CleanTmp()
+
+	if !cacheEntry.Exists {
+		if err := downloadWrapper(ctx, c, cacheEntry.TmpPath, arch, imageRef, progressBar); err != nil {
+			return "", fmt.Errorf("unable to download image: %v", err)
 		}
-		defer cacheEntry.CleanTmp()
-		if !cacheEntry.Exists {
-			sylog.Infof("Downloading library image")
 
-			if err := DownloadImage(ctx, c, cacheEntry.TmpPath, arch, imageRef, &client.DownloadProgressBar{}); err != nil {
-				return "", fmt.Errorf("unable to download image: %v", err)
-			}
+		if cacheFileHash, err := libclient.ImageHash(cacheEntry.TmpPath); err != nil {
+			return "", fmt.Errorf("error getting image hash: %v", err)
+		} else if cacheFileHash != libraryImage.Hash {
+			return "", fmt.Errorf("cached file hash(%s) and expected hash(%s) does not match", cacheFileHash, libraryImage.Hash)
+		}
 
-			if cacheFileHash, err := libclient.ImageHash(cacheEntry.TmpPath); err != nil {
-				return "", fmt.Errorf("error getting image hash: %v", err)
-			} else if cacheFileHash != libraryImage.Hash {
-				return "", fmt.Errorf("cached file hash(%s) and expected hash(%s) does not match", cacheFileHash, libraryImage.Hash)
-			}
+		if err := cacheEntry.Finalize(); err != nil {
+			return "", err
+		}
+	} else {
+		sylog.Infof("Using cached image")
+	}
 
-			err = cacheEntry.Finalize()
-			if err != 
```

---

### Incident Patch 2: `c0b68648` (2021-11-17)
**Commit Message**: Update mvdan.cc/sh/v3 to fix variables scope in functions

**File**: `go.mod` (modified, +1/-1)
```diff
@@ -49,7 +49,7 @@ require (
 	golang.org/x/sys v0.0.0-20210925032602-92d5a993a665
 	gopkg.in/yaml.v2 v2.4.0
 	gotest.tools/v3 v3.0.3
-	mvdan.cc/sh/v3 v3.4.1-0.20211012151248-7e067a88c992
+	mvdan.cc/sh/v3 v3.4.1-0.20211117155449-fd5bf4bda085
 	oras.land/oras-go v0.5.0
 )
 
```

**File**: `go.sum` (modified, +2/-2)
```diff
@@ -1462,8 +1462,8 @@ k8s.io/kube-openapi v0.0.0-20201113171705-d219536bb9fd/go.mod h1:WOJ3KddDSol4tAG
 k8s.io/kubernetes v1.13.0/go.mod h1:ocZa8+6APFNC2tX1DZASIbocyYT5jHzqFVsY5aoB7Jk=
 k8s.io/utils v0.0.0-20201110183641-67b214c5f920/go.mod h1:jPW/WVKK9YHAvNhRxK0md/EJ228hCsBRufyofKtW8HA=
 mvdan.cc/editorconfig v0.2.0/go.mod h1:lvnnD3BNdBYkhq+B4uBuFFKatfp02eB6HixDvEz91C0=
-mvdan.cc/sh/v3 v3.4.1-0.20211012151248-7e067a88c992 h1:qp1H1QJpHFbSLMM5P5uX2gLMg5wakBJy603dhpRh6IY=
-mvdan.cc/sh/v3 v3.4.1-0.20211012151248-7e067a88c992/go.mod h1:p/tqPPI4Epfk2rICAe2RoaNd8HBSJ8t9Y2DA9yQlbzY=
+mvdan.cc/sh/v3 v3.4.1-0.20211117155449-fd5bf4bda085 h1:5DEMijC3Bv/c5bNGMB+fb744YYK9qXz8gclnfaxHm38=
+mvdan.cc/sh/v3 v3.4.1-0.20211117155449-fd5bf4bda085/go.mod h1:p/tqPPI4Epfk2rICAe2RoaNd8HBSJ8t9Y2DA9yQlbzY=
 oras.land/oras-go v0.5.0 h1:8prh1CfcDxWE+C+aoinkfIj5QqW6EAg6y+U6spGtm/Q=
 oras.land/oras-go v0.5.0/go.mod h1:kV8HXCD+3ek6INN9Jeig7hRjf72zfziwktBCA7/PvBA=
 rsc.io/binaryregexp v0.2.0/go.mod h1:qTv7/COck+e2FymRvadv62gMdZztPaShugOCi3I+8D8=
```

---

### Incident Patch 3: `2f5ae277` (2021-11-01)
**Commit Message**: fix: perform nvccli env->flags inside runtime, not CLI

The flags that will be used as options to `nvidia-container-cli` are
currently derived within the CLI and passed in the runtime config.

The potentially dangerous `--ldconfig` flag is always appended to the
actual `nvidia-container-cli` call within `NVCLIConfigure`, so
attempts to pass a malicious `--ldconfig=xxx` from a modified CLI
binary are overridden. However, we should perform the env -> flag
conversion in a trusted portion of code, so we only ever call
`nvidia-container-cli` with a set of flags we directly control.

Fixes #396

**File**: `cmd/internal/cli/actions_linux.go` (modified, +8/-4)
```diff
@@ -799,11 +799,15 @@ func setNvCCLIConfig(engineConfig *singularityConfig.EngineConfig) (err error) {
 		sylog.Warningf("When using nvidia-container-cli with --contain NVIDIA_VISIBLE_DEVICES must be set or no GPUs will be available in container.")
 	}
 
-	nvCCLIFlags, err := gpu.NVCLIEnvToFlags()
-	if err != nil {
-		return err
+	// Pass NVIDIA_ env vars that will be converted to nvidia-container-cli options
+	nvCCLIEnv := []string{}
+	for _, e := range os.Environ() {
+		if strings.HasPrefix(e, "NVIDIA_") {
+			nvCCLIEnv = append(nvCCLIEnv, e)
+		}
 	}
-	engineConfig.SetNvCCLIFlags(nvCCLIFlags)
+	engineConfig.SetNvCCLIEnv(nvCCLIEnv)
+
 	if UserNamespace && !IsWritable {
 		return fmt.Errorf("nvidia-container-cli requires --writable with user namespace/fakeroot")
 	}
```

**File**: `internal/pkg/runtime/engine/singularity/container_linux.go` (modified, +1/-1)
```diff
@@ -273,7 +273,7 @@ func create(ctx context.Context, engine *EngineOperations, rpcOps *client.RPC, p
 		// If we are not inside a user namespace then the NVCCLI call must exec nvidia-container-cli
 		// as the host uid 0. This may happen via the setuid starter, or from singularity being run
 		// directly as uid 0, e.g. `sudo singularity`.
-		if err := c.rpcOps.NvCCLI(engine.EngineConfig.GetNvCCLIFlags(), c.session.FinalPath(), c.userNS); err != nil {
+		if err := c.rpcOps.NvCCLI(engine.EngineConfig.GetNvCCLIEnv(), c.session.FinalPath(), c.userNS); err != nil {
 			return err
 		}
 	}
```

**File**: `internal/pkg/util/gpu/nvidia.go` (modified, +58/-31)
```diff
@@ -73,7 +73,7 @@ var nVCLIAmbientCaps = []uintptr{
 // setuid mode or directly called as `sudo singularity` etc. In this case we
 // exec `nvidia-container-cli` as root via SysProcAttr, having first ensured
 // that it and `ldconfig` are root-owned.
-func NVCLIConfigure(flags []string, rootfs string, userNS bool) error {
+func NVCLIConfigure(nvidiaEnv []string, rootfs string, userNS bool) error {
 	nvCCLIPath, err := bin.FindBin("nvidia-container-cli")
 	if err != nil {
 		return err
@@ -84,6 +84,12 @@ func NVCLIConfigure(flags []string, rootfs string, userNS bool) error {
 		return errNvCCLIInsecure
 	}
 
+	// Translate the passed in NVIDIA_ env vars to option flags
+	flags, err := NVCLIEnvToFlags(nvidiaEnv)
+	if err != nil {
+		return err
+	}
+
 	// The --ldconfig flag is constructed here, as the specified binary
 	// will be called as root in the set-uid flow, so the user should not
 	// be able to influence it from the CLI code.
@@ -134,48 +140,69 @@ func NVCLIConfigure(flags []string, rootfs string, userNS bool) error {
 	return nil
 }
 
-// NVCLIEnvToFlags reads the environment variables supported by nvidia-container-runtime
-// and converts them to flags for nvidia-container-cli.
-// See: https://github.com/nvidia/nvidia-container-runtime#environment-variables-oci-spec
-func NVCLIEnvToFlags() (flags []string, err error) {
+// NVCLIEnvToFlags reads the passed in NVIDIA_ environment variables supported
+// by nvidia-container-runtime and converts them to flags for
+// nvidia-container-cli. See:
+// https://github.com/nvidia/nvidia-container-runtime#environment-variables-oci-spec
+func NVCLIEnvToFlags(nvidiaEnv []string) (flags []string, err error) {
 	// We don't support cgroups related usage yet.
 	flags = []string{"--no-cgroups"}
+	requireFlags := []string{}
+	disableRequire := false
+	defaultDriverCaps := true
+
+	for _, e := range nvidiaEnv {
+		pair := strings.SplitN(e, "=", 2)
+		if len(pair) != 2 {
+			return []string{}, fmt.Errorf("can't process environment variable %s", e)
+		}
 
-	if val := os.Getenv("NVIDIA_VISIBLE_DEVICES"); val != "" {
-		flags = append(flags, "--device="+val)
-	}
+		if pair[0] == "NVIDIA_VISIBLE_DEVICES" && pair[1] != "" {
+			flags = append(flags, "--device="+pair[1])
+		}
 
-	if val := os.Getenv("NVIDIA_MIG_CONFIG_DEVICES"); val != "" {
-		flags = append(flags, "--mig-config="+val)
-	}
+		if pair[0] == "NVIDIA_MIG_CONFIG_DEVICES" && pair[1] != "" {
+			flags = append(flags, "--mig-config="+pair[1])
+		}
 
-	if val := os.Getenv("NVIDIA_MIG_MONITOR_DEVICES"); val != "" {
-		flags = append(flags, "--mig-monitor="+val)
-	}
+		if pair[0] == "NVIDIA_MIG_MONITOR_DEVICES" && pair[1] != "" {
+			flags = append(flags, "--mig-monitor="+pair[1])
+		}
+
+		// Driver capabilities have a default, but can be overridden.
+		if pair[0] == "NVIDIA_DRIVER_CAPABILITIES" && pair[1] != "" {
+			defaultDriverCaps = false
+			caps := strings.Split(pair[1], ",")
+
+			for _, cap := range caps {
+				if slice.ContainsString(nVDriverCapabilities, cap) {
+					flags = append(flags, "--"+cap)
+				} else {
+					return nil, fmt.Errorf("unknown NVIDIA_DRIVER_CAPABILITIES value: %s", cap)
+				}
+			}
+		}
+
+		// One --require flag for each NVIDIA_REQUIRE_* environment
+		// https://github.com/nvidia/nvidia-container-runtime#nvidia_require_
+		if strings.HasPrefix(pair[0], "NVIDIA_REQUIRE_") {
+			requireFlags = append(requireFlags, "--require="+pair[1])
+		}
+
+		if pair[0] == "NVIDIA_DISABLE_REQUIRE" {
+			disableRequire = true
+		}
 
-	// Driver capabilities have a default, but can be overridden.
-	caps := nVDriverDefaultCapabilities
-	if val := os.Getenv("NVIDIA_DRIVER_CAPABILITIES"); val != "" {
-		caps = strings.Split(val, ",")
 	}
 
-	for _, cap := range caps {
-		if slice.ContainsString(nVDriverCapabilities, cap) {
+	if defaultDriverCaps {
+		for _, cap := range nVDriverDefaultCapabilities {
 			flags = append(flags, "--"+cap)
-		} else {
-			return nil, fmt.Errorf("unknown NVIDIA_DRIVER_CAPABILITIES value: %s"
```

**File**: `internal/pkg/util/gpu/nvidia_test.go` (modified, +23/-29)
```diff
@@ -6,7 +6,6 @@
 package gpu
 
 import (
-	"os"
 	"reflect"
 	"sort"
 	"testing"
@@ -15,7 +14,7 @@ import (
 func TestNVCLIEnvToFlags(t *testing.T) {
 	tests := []struct {
 		name      string
-		env       map[string]string
+		env       []string
 		wantFlags []string
 		wantErr   bool
 	}{
@@ -30,8 +29,8 @@ func TestNVCLIEnvToFlags(t *testing.T) {
 		},
 		{
 			name: "device",
-			env: map[string]string{
-				"NVIDIA_VISIBLE_DEVICES": "all",
+			env: []string{
+				"NVIDIA_VISIBLE_DEVICES=all",
 			},
 			wantFlags: []string{
 				"--no-cgroups",
@@ -43,8 +42,8 @@ func TestNVCLIEnvToFlags(t *testing.T) {
 		},
 		{
 			name: "mig-config",
-			env: map[string]string{
-				"NVIDIA_MIG_CONFIG_DEVICES": "all",
+			env: []string{
+				"NVIDIA_MIG_CONFIG_DEVICES=all",
 			},
 			wantFlags: []string{
 				"--no-cgroups",
@@ -56,8 +55,8 @@ func TestNVCLIEnvToFlags(t *testing.T) {
 		},
 		{
 			name: "mig-monitor",
-			env: map[string]string{
-				"NVIDIA_MIG_MONITOR_DEVICES": "all",
+			env: []string{
+				"NVIDIA_MIG_MONITOR_DEVICES=all",
 			},
 			wantFlags: []string{
 				"--no-cgroups",
@@ -69,8 +68,8 @@ func TestNVCLIEnvToFlags(t *testing.T) {
 		},
 		{
 			name: "compute-only",
-			env: map[string]string{
-				"NVIDIA_DRIVER_CAPABILITIES": "compute",
+			env: []string{
+				"NVIDIA_DRIVER_CAPABILITIES=compute",
 			},
 			wantFlags: []string{
 				"--no-cgroups",
@@ -80,8 +79,8 @@ func TestNVCLIEnvToFlags(t *testing.T) {
 		},
 		{
 			name: "all-caps",
-			env: map[string]string{
-				"NVIDIA_DRIVER_CAPABILITIES": "compute,compat32,graphics,utility,video,display",
+			env: []string{
+				"NVIDIA_DRIVER_CAPABILITIES=compute,compat32,graphics,utility,video,display",
 			},
 			wantFlags: []string{
 				"--no-cgroups",
@@ -96,15 +95,15 @@ func TestNVCLIEnvToFlags(t *testing.T) {
 		},
 		{
 			name: "invalid-caps",
-			env: map[string]string{
-				"NVIDIA_DRIVER_CAPABILITIES": "notacap",
+			env: []string{
+				"NVIDIA_DRIVER_CAPABILITIES=notacap",
 			},
 			wantErr: true,
 		},
 		{
 			name: "single-require",
-			env: map[string]string{
-				"NVIDIA_REQUIRE_CUDA": "cuda>=9.0",
+			env: []string{
+				"NVIDIA_REQUIRE_CUDA=cuda>=9.0",
 			},
 			wantFlags: []string{
 				"--no-cgroups",
@@ -116,9 +115,9 @@ func TestNVCLIEnvToFlags(t *testing.T) {
 		},
 		{
 			name: "multi-require",
-			env: map[string]string{
-				"NVIDIA_REQUIRE_BRAND": "brand=GRID",
-				"NVIDIA_REQUIRE_CUDA":  "cuda>=9.0",
+			env: []string{
+				"NVIDIA_REQUIRE_BRAND=brand=GRID",
+				"NVIDIA_REQUIRE_CUDA=cuda>=9.0",
 			},
 			wantFlags: []string{
 				"--no-cgroups",
@@ -131,10 +130,10 @@ func TestNVCLIEnvToFlags(t *testing.T) {
 		},
 		{
 			name: "disable-require",
-			env: map[string]string{
-				"NVIDIA_REQUIRE_BRAND":   "brand=GRID",
-				"NVIDIA_REQUIRE_CUDA":    "cuda>=9.0",
-				"NVIDIA_DISABLE_REQUIRE": "1",
+			env: []string{
+				"NVIDIA_REQUIRE_BRAND=brand=GRID",
+				"NVIDIA_REQUIRE_CUDA=cuda>=9.0",
+				"NVIDIA_DISABLE_REQUIRE=1",
 			},
 			wantFlags: []string{
 				"--no-cgroups",
@@ -146,12 +145,7 @@ func TestNVCLIEnvToFlags(t *testing.T) {
 	}
 	for _, tt := range tests {
 		t.Run(tt.name, func(t *testing.T) {
-			for key, val := range tt.env {
-				os.Setenv(key, val)
-				defer os.Unsetenv(key)
-			}
-
-			gotFlags, err := NVCLIEnvToFlags()
+			gotFlags, err := NVCLIEnvToFlags(tt.env)
 			if (err != nil) != tt.wantErr {
 				t.Errorf("NVCLIEnvToFlags() error = %v, wantErr %v", err, tt.wantErr)
 				return
```

**File**: `pkg/runtime/engine/singularity/config/config.go` (modified, +7/-7)
```diff
@@ -139,7 +139,7 @@ type JSONConfig struct {
 	Contain           bool              `json:"container,omitempty"`
 	NvLegacy          bool              `json:"nvLegacy,omitempty"`
 	NvCCLI            bool              `json:"nvCCLI,omitempty"`
-	NvCCLIFlags       []string          `json:"NvCCLIFlags,omitempty"`
+	NvCCLIEnv         []string          `json:"NvCCLIEnv,omitempty"`
 	Rocm              bool              `json:"rocm,omitempty"`
 	CustomHome        bool              `json:"customHome,omitempty"`
 	Instance          bool              `json:"instance,omitempty"`
@@ -245,14 +245,14 @@ func (e *EngineConfig) GetNvCCLI() bool {
 	return e.JSON.NvCCLI
 }
 
-// SetNVCCLIFlags sets flags to call nvidia-container-cli with for CUDA setup
-func (e *EngineConfig) SetNvCCLIFlags(NvCCLIFlags []string) {
-	e.JSON.NvCCLIFlags = NvCCLIFlags
+// SetNVCCLIEnv sets env vars holding options for nvidia-container-cli GPU setup
+func (e *EngineConfig) SetNvCCLIEnv(NvCCLIEnv []string) {
+	e.JSON.NvCCLIEnv = NvCCLIEnv
 }
 
-// GetNvCCLIFlags returns the flags to use in an nvidia-container-cli call
-func (e *EngineConfig) GetNvCCLIFlags() []string {
-	return e.JSON.NvCCLIFlags
+// GetNVCCLIEnv returns env vars holding options for nvidia-container-cli GPU setup
+func (e *EngineConfig) GetNvCCLIEnv() []string {
+	return e.JSON.NvCCLIEnv
 }
 
 // SetRocm sets rocm flag to bind rocm libraries into containee.JSON.
```

---

### Incident Patch 4: `dca65113` (2021-11-16)
**Commit Message**: Merge pull request #6301 from DrDaveD/fix-install

Installation instruction improvements

**File**: `INSTALL.md` (modified, +6/-4)
```diff
@@ -25,7 +25,8 @@ sudo apt-get install -y \
     libseccomp-dev \
     pkg-config \
     squashfs-tools \
-    cryptsetup
+    cryptsetup \
+    curl wget git
 ```
 
 On CentOS/RHEL:
@@ -39,7 +40,8 @@ sudo yum install -y epel-release
 sudo yum install -y \
     libseccomp-devel \
     squashfs-tools \
-    cryptsetup
+    cryptsetup \
+    wget git
 ```
 
 ## Install Go
@@ -55,7 +57,7 @@ _**NOTE:** if you are updating Go from a older version, make sure you remove
 `/usr/local/go` before reinstalling it._
 
 ```sh
-export VERSION=1.17.3 OS=linux ARCH=amd64  # change this as you need
+export GOVERSION=1.17.3 OS=linux ARCH=amd64  # change this as you need
 
 wget -O /tmp/go${GOVERSION}.${OS}-${ARCH}.tar.gz \
   https://dl.google.com/go/go${GOVERSION}.${OS}-${ARCH}.tar.gz
@@ -86,7 +88,7 @@ run:
 <!-- markdownlint-disable MD013 -->
 
 ```sh
-curl -sSfL https://raw.githubusercontent.com/golangci/golangci-lint/master/install.sh | sh -s -- -b $(go env GOPATH)/bin v1.42.0
+curl -sSfL https://raw.githubusercontent.com/golangci/golangci-lint/master/install.sh | sh -s -- -b $(go env GOPATH)/bin v1.43.0
 ```
 
 <!-- markdownlint-enable MD013 -->
```

---

### Incident Patch 5: `ac4ea80b` (2021-11-12)
**Commit Message**: disable issue5808 regression test

**File**: `e2e/pull/pull.go` (modified, +2/-1)
```diff
@@ -652,7 +652,8 @@ func E2ETests(env e2e.TestEnv) testhelper.Tests {
 			t.Run("pullDisableCache", c.testPullDisableCacheCmd)
 
 			// Regressions
-			t.Run("issue5808", c.issue5808)
+			// Disable for now, see issue #6299
+			// t.Run("issue5808", c.issue5808)
 		}),
 	}
 }
```

---

### Incident Patch 6: `fb46d06e` (2021-11-12)
**Commit Message**: disable issue5808 regression test

**File**: `e2e/pull/pull.go` (modified, +2/-1)
```diff
@@ -652,7 +652,8 @@ func E2ETests(env e2e.TestEnv) testhelper.Tests {
 			t.Run("pullDisableCache", c.testPullDisableCacheCmd)
 
 			// Regressions
-			t.Run("issue5808", c.issue5808)
+			// Disable for now, see issue #6299
+			// t.Run("issue5808", c.issue5808)
 		}),
 	}
 }
```

---

### Incident Patch 7: `25d05c53` (2021-11-12)
**Commit Message**: fix for markdownlint

**File**: `CHANGELOG.md` (modified, +1/-1)
```diff
@@ -85,7 +85,7 @@
 - Fix the oras contexts to avoid hangs upon failed pushed to Harbor registry.
 
 ### Enhancements
- 
+
 - Added seccomp, cryptsetup, devscripts & correct go version test to
   debian packaging.
 
```

**File**: `dist/debian/DEBIAN_PACKAGE.md` (modified, +2/-1)
```diff
@@ -37,7 +37,8 @@ See `mconfig --help` for details about the configuration options.
 
 To select a specific profile for `mconfig`.
 
-__REMINDER:__ to build with seccomp you need to install `libseccomp-dev` package !
+__REMINDER:__
+to build with seccomp you need to install `libseccomp-dev` package !
 
 For real production environment us this configuration:
 
```

---

### Incident Patch 8: `64531909` (2021-10-22)
**Commit Message**: fix: wire up contexts in CLI package

Signed-off-by: Dave Dykstra <dwd@fnal.gov>

**File**: `cmd/internal/cli/search.go` (modified, +1/-4)
```diff
@@ -7,7 +7,6 @@
 package cli
 
 import (
-	"context"
 	"runtime"
 
 	"github.com/hpcng/singularity/docs"
@@ -72,8 +71,6 @@ var SearchCmd = &cobra.Command{
 	DisableFlagsInUseLine: true,
 	Args:                  cobra.ExactArgs(1),
 	Run: func(cmd *cobra.Command, args []string) {
-		ctx := context.TODO()
-
 		config, err := getLibraryClientConfig(SearchLibraryURI)
 		if err != nil {
 			sylog.Fatalf("Error while getting library client config: %v", err)
@@ -84,7 +81,7 @@ var SearchCmd = &cobra.Command{
 			sylog.Fatalf("Error initializing library client: %v", err)
 		}
 
-		if err := library.SearchLibrary(ctx, libraryClient, args[0], SearchArch, SearchSigned); err != nil {
+		if err := library.SearchLibrary(cmd.Context(), libraryClient, args[0], SearchArch, SearchSigned); err != nil {
 			sylog.Fatalf("Couldn't search library: %v", err)
 		}
 	},
```

---

### Incident Patch 9: `78442de3` (2021-11-08)
**Commit Message**: fix: wire up context in ORAS getResolver

Pass proper context value to getResolver. Enable contextcheck linter,
which checks for non-inherited context usage.

**File**: `.golangci.yml` (modified, +1/-0)
```diff
@@ -5,6 +5,7 @@ linters:
   disable-all: true
   enable-all: false
   enable:
+    - contextcheck
     - deadcode
     - gofumpt
     - goimports
```

**File**: `internal/pkg/client/oras/oras.go` (modified, +5/-5)
```diff
@@ -57,7 +57,7 @@ const (
 
 var sifLayerMediaTypes = []string{SifLayerMediaTypeV1, SifLayerMediaTypeProto}
 
-func getResolver(ociAuth *ocitypes.DockerAuthConfig) (remotes.Resolver, error) {
+func getResolver(ctx context.Context, ociAuth *ocitypes.DockerAuthConfig) (remotes.Resolver, error) {
 	opts := docker.ResolverOptions{Credentials: genCredfn(ociAuth)}
 	if ociAuth != nil && (ociAuth.Username != "" || ociAuth.Password != "") {
 		return docker.NewResolver(opts), nil
@@ -69,7 +69,7 @@ func getResolver(ociAuth *ocitypes.DockerAuthConfig) (remotes.Resolver, error) {
 		return docker.NewResolver(opts), nil
 	}
 
-	return cli.Resolver(context.Background(), &http.Client{}, false)
+	return cli.Resolver(ctx, &http.Client{}, false)
 }
 
 // DownloadImage downloads a SIF image specified by an oci reference to a file using the included credentials
@@ -88,7 +88,7 @@ func DownloadImage(ctx context.Context, imagePath, ref string, ociAuth *ocitypes
 		sylog.Infof("No tag or digest found, using default: %s", SifDefaultTag)
 	}
 
-	resolver, err := getResolver(ociAuth)
+	resolver, err := getResolver(ctx, ociAuth)
 	if err != nil {
 		return fmt.Errorf("while getting resolver: %s", err)
 	}
@@ -173,7 +173,7 @@ func UploadImage(ctx context.Context, path, ref string, ociAuth *ocitypes.Docker
 		sylog.Infof("No tag or digest found, using default: %s", SifDefaultTag)
 	}
 
-	resolver, err := getResolver(ociAuth)
+	resolver, err := getResolver(ctx, ociAuth)
 	if err != nil {
 		return fmt.Errorf("while getting resolver: %s", err)
 	}
@@ -233,7 +233,7 @@ func ImageSHA(ctx context.Context, uri string, ociAuth *ocitypes.DockerAuthConfi
 	ref := strings.TrimPrefix(uri, "oras://")
 	ref = strings.TrimPrefix(ref, "//")
 
-	resolver, err := getResolver(ociAuth)
+	resolver, err := getResolver(ctx, ociAuth)
 	if err != nil {
 		return "", fmt.Errorf("while getting resolver: %s", err)
 	}
```

---

### Incident Patch 10: `93a3ab35` (2021-11-05)
**Commit Message**: fix: Don't truncate config file until we have valid output to write

When using `config global --set` an invalid directive value could previously
lead to an empty `singularity.conf`, as the file was opened with
`O_TRUNC` before the new config was generated/validated.

Generate the config output to an in memory buffer, and only create /
truncate the `singularity.conf` file once we have generated known valid
output.

Fixes: #409

**File**: `internal/app/singularity/config_global_linux.go` (modified, +19/-8)
```diff
@@ -6,7 +6,9 @@
 package singularity
 
 import (
+	"bytes"
 	"fmt"
+	"io"
 	"os"
 	"strings"
 
@@ -38,27 +40,36 @@ func contains(slice []string, val string) bool {
 }
 
 func generateConfig(path string, directives singularityconf.Directives, dry bool) error {
-	out := os.Stdout
+	// Generate the config structure from our directives
+	c, err := singularityconf.GetConfig(directives)
+	if err != nil {
+		return fmt.Errorf("configuration directive invalid: %w", err)
+	}
+
+	// Write a config file to our in memory buffer
+	newConfig := new(bytes.Buffer)
+	if err := singularityconf.Generate(newConfig, "", c); err != nil {
+		return fmt.Errorf("while generating configuration from template: %w", err)
+	}
 
+	// Dry run = write to Stdout
+	out := os.Stdout
+	// Not dry run = create / overwrite existing file, now we know we have valid content
 	if !dry {
 		unix.Umask(0)
 
 		flags := os.O_CREATE | os.O_TRUNC | unix.O_NOFOLLOW | os.O_RDWR
 		nf, err := os.OpenFile(path, flags, 0o644)
 		if err != nil {
-			return fmt.Errorf("while creating configuration file %s: %s", path, err)
+			return fmt.Errorf("while creating configuration file %s: %w", path, err)
 		}
 		defer nf.Close()
 		out = nf
 	}
 
-	c, err := singularityconf.GetConfig(directives)
+	_, err = io.Copy(out, newConfig)
 	if err != nil {
-		return err
-	}
-
-	if err := singularityconf.Generate(out, "", c); err != nil {
-		return fmt.Errorf("while generating configuration from template: %s", err)
+		return fmt.Errorf("while writing configuration file %s: %w", path, err)
 	}
 
 	return nil
```

#### Recent Merged Pull Requests:
- **PR #6480** (2022-10-10): Remove dependabot (@DrDaveD)
- **PR #6479** (closed): build(deps): bump gotest.tools/v3 from 3.0.3 to 3.4.0 (@dependabot[bot])
- **PR #6475** (2022-09-30): remove reference to maintaining the 3.8 branch (@DrDaveD)
- **PR #6474** (2022-09-30): Disable dependabot (@DrDaveD)
- **PR #6473** (closed): build(deps): bump github.com/containers/image/v5 from 5.17.0 to 5.23.0 (@dependabot[bot])
- **PR #6472** (closed): build(deps): bump github.com/opencontainers/selinux from 1.10.0 to 1.10.2 (@dependabot[bot])
- **PR #6468** (closed): build(deps): bump github.com/sylabs/scs-build-client from 0.2.1 to 0.7.5 (@dependabot[bot])
- **PR #6466** (closed): build(deps): bump github.com/sylabs/json-resp from 0.8.0 to 0.8.2 (@dependabot[bot])

---

## 3. Empirical Evidence & Compliance Certification
- **Evidence Provenance**: Fetched directly from verified official GitHub REST API.
- **Zero Disk Footprint**: 0 bytes of unnecessary repository bloat stored locally.
- **TOS & Free-Tier Adherence**: Request pace complied with public API guidelines without fee, penalty, or unauthorized scraping.

---

## 4. Promotion & Integration Status
- **Status**: HARVESTED_DEEP_FORENSIC
- **Master Brain Sync**: Auto-committed to local/remote Master Brain repository.
