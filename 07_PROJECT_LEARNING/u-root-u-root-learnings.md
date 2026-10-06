# Forensic Learning Record (Deep Inspection): u-root/u-root

> **Canonical Artifact**: `07_PROJECT_LEARNING/u-root-u-root-learnings.md`  
> **Source Platform**: GitHub ([https://github.com/u-root/u-root](https://github.com/u-root/u-root))  
> **Harvest Method**: Full-Spectrum Deep Extraction (Patches, Diffs, Source Code, Post-Mortems)  
> **Harvest Timestamp**: 2026-10-06T03:03:14.665Z  
> **Compliance State**: Free Tier Guaranteed | Strict Rate-Limit Backoff Honored  

---

## 1. Context & Architectural Overview
- **Repository / Resource**: `u-root/u-root`
- **Description**: A fully Go userland with Linux bootloaders! u-root can create a one-binary root file system (initramfs) containing a busybox-like set of tools written in Go.
- **Primary Language / Ecosystem**: Go
- **Discovered Manifests / Configurations**: go.mod, README.md
- **Stars / Engagement**: 3076 stars

---

## 2. Multi-Dimensional 8-Axis Investigation & Real Code Patches

### D1: Architecture & Structural Boundaries
- Entry configurations inspected via direct stream: go.mod, README.md.
- Evaluated system abstractions and modular contracts.

### Core Architecture Module: `cmds/core/backoff/backoff.go`
```
// Copyright 2012-2025 the u-root Authors. All rights reserved
// Use of this source code is governed by a BSD-style
// license that can be found in the LICENSE file.

// Run a command, repeatedly, until it succeeds or we are out of time
//
// Synopsis:
//	backoff [-v] [-t duration-string] command [args...]
//
// Description:
//	backoff will run the command until it succeeds or a timeout has passed.
//	The default timeout is 30s.
//	If -v is set, it will show what it is running, each time it is tried.
//	If no args are given, it will print command help.
//
// Example:
//	$ backoff echo hi
//	hi
//	$
//	$ backoff -v -t=2s false
//	  2022/03/31 14:29:37 Run ["false"]
//	  2022/03/31 14:29:37 Set timeout to 2s
//	  2022/03/31 14:29:37 "false" []:exit status 1
//	  2022/03/31 14:29:38 "false" []:exit status 1
//	  2022/03/31 14:29:39 "false" []:exit status 1
//	  2022/03/31 14:29:39 Error: exit status 1

//go:build !test

package main

import (
	"flag"
	"fmt"
	"log"
	"os"
	"os/exec"
	"time"

	"github.com/cenkalti/backoff/v4"
)

var (
	timeout = flag.Duration("t", 30*time.Second, "Timeout for command")
	verbose = flag.Bool("v", false, "Log each attempt to run the command")
	v       = func(string, ...any) {}

	errNoCmd = fmt.Errorf("no command passed")
)

func run(timeout time.Duration, c string, a ...string) error {
	if c == "" {
		return errNoCmd
	}
	b := backoff.NewExponentialBackOff()
	b.MaxElapsedTime = timeout
	f := func() error {
		cmd := exec.Command(c, a...)
		cmd.Stdin, cmd.Stdout, cmd.Stderr = os.Stdin, os.Stdout, os.Stderr
		err := cmd.Run()
		v("%q %q:%v", c, a, err)
		return err
	}

	return backoff.Retry(f, b)
}

func main() {
	flag.Parse()
	if *verbose {
		v = log.Printf
	}
	a := flag.Args()
	if len(a) == 0 {
		flag.Usage()
		os.Exit(1)
	}
	v("Run %q", a)
	if err := run(*timeout, a[0], a[1:]...); err != nil {
		log.Fatalf("Error: %v", err)
	}
}

```

### Core Architecture Module: `cmds/core/base64/base64.go`
```
// Copyright 2021 the u-root Authors. All rights reserved
// Use of this source code is governed by a BSD-style
// license that can be found in the LICENSE file.

// base64 - encode and decode base64 from stdin or file to stdout
//
// Synopsis:
//
//	base64 [-d] [FILE]
//
// Description:
//
//	Encode or decode a file to or from base64 encoding.
//	-d   decode data (default is to encode)
//	For stdin, on standard Unix systems, you can use /dev/stdin
package main

import (
	"encoding/base64"
	"errors"
	"flag"
	"fmt"
	"io"
	"log"
	"os"

	"github.com/u-root/u-root/pkg/uroot/unixflag"
)

type cmd struct {
	stdin  io.Reader
	stdout io.Writer
	stderr io.Writer
	params
	args []string
}

type params struct {
	decode bool
}

var errBadUsage = errors.New("usage: base64 [-d] [file]")

func decodeone(stdin io.Reader, stdout io.Writer) error {
	r := base64.NewDecoder(base64.StdEncoding, stdin)
	if _, err := io.Copy(stdout, r); err != nil {
		return fmt.Errorf("decoding: %w", err)
	}
	return nil
}

func encodeone(stdin io.Reader, stdout io.Writer) error {
	// WriteCloser is important here, from NewEncoder documentation:
	// when finished writing, the caller must Close the returned encoder
	// to flush any partially written blocks.
	wc := base64.NewEncoder(base64.StdEncoding, stdout)
	defer wc.Close()
	if _, err := io.Copy(wc, stdin); err != nil {
		return fmt.Errorf("error encoding: %w", err)
	}
	if err := wc.Close(); err != nil { // flush any remaining data
		return fmt.Errorf("closing encoder: %w", err)
	}
	if _, err := fmt.Fprintln(stdout); err != nil {
		return fmt.Errorf("error encoder writing trailing newline %w", err)
	}
	return nil
}

func run(stdin io.Reader, stdout, stderr io.Writer, args ...string) error {
	c := cmd{
		stdin:  stdin,
		stdout: stdout,
		stderr: stderr,
	}

	f := flag.NewFlagSet("base64", flag.ExitOnError)
	f.BoolVar(&c.decode, "d", false, "decode or encode the file")

	// ignore error as flag.ExitOnError to not to print it twice
	_ = f.Parse(unixflag.ArgsToGoArgs(args))
	c.args = f.Args()

	switch {
	case len(c.args) > 1:
		return fmt.Errorf("only 0 or 1 arg allowed:%w", errBadUsage)
	case len(c.args) == 0:
	case c.args[0] == "-":
	default:
		stdin, err := os.Open(c.args[0])
		if err != nil {
			return err
		}
		c.stdin = stdin
	}

	if c.decode {
		return decodeone(c.stdin, c.stdout)
	}
	return encodeone(c.stdin, c.stdout)
}

func main() {
	if err := run(os.Stdin, os.Stdout, os.Stderr, os.Args[1:]...); err != nil {
		log.Fatalf("%s: %v", os.Args[0], err)
	}
}

```

### Core Architecture Module: `cmds/core/basename/basename.go`
```
// Copyright 2012-2018 the u-root Authors. All rights reserved
// Use of this source code is governed by a BSD-style
// license that can be found in the LICENSE file.

// Basename return name with leading path information removed.
//
// Synopsis:
//
//	basename NAME [SUFFIX]
package main

import (
	"errors"
	"fmt"
	"io"
	"log"
	"os"
	"path/filepath"
	"strings"
)

var errUsage = errors.New("usage: basename NAME [SUFFIX]")

func run(w io.Writer, args []string) error {
	switch len(args) {
	case 2:
		fileName := filepath.Base(args[0])
		if fileName != args[1] {
			fileName = strings.TrimSuffix(fileName, args[1])
		}
		_, err := fmt.Fprintf(w, "%s\n", fileName)
		return err
	case 1:
		fileName := filepath.Base(args[0])
		_, err := fmt.Fprintf(w, "%s\n", fileName)
		return err
	default:
		return errUsage
	}
}

func main() {
	if err := run(os.Stdout, os.Args[1:]); err != nil {
		log.Fatal(err)
	}
}

```

### Core Architecture Module: `cmds/core/bind/bind_plan9.go`
```
// Copyright 2012-2020 the u-root Authors. All rights reserved
// Use of this source code is governed by a BSD-style
// license that can be found in the LICENSE file.

// Bind binds new on old.
//
// Synopsis:
//	bind [ option ... ] new old
//
// Description:
//	Bind modifies the name space of the current
//	process and other processes in the same name space group
//	(see https://9p.io/magic/man2html/1/bind).
//
// Options:
//	–b:	Both files must be directories. Add the new directory to the beginning of the union directory represented by the old file.
//	–a:	Both files must be directories. Add the new directory to the end of the union directory represented by the old file.
//	–c:	This can be used in addition to any of the above to permit creation in a union directory.
//		When a new file is created in a union directory, it is placed in the first element of the union that has been bound or mounted with the –c flag.
//		If that directory does not have write permission, the create fails.

package main

import (
	"log"
	"os"

	"github.com/u-root/u-root/pkg/namespace"
)

func main() {
	mod, err := namespace.ParseArgs(os.Args)
	if err != nil {
		log.Fatal(err)
	}
	if err := mod.Modify(namespace.DefaultNamespace, &namespace.Builder{}); err != nil {
		log.Fatal(err)
	}
}

```

### Core Architecture Module: `cmds/core/blkid/blkid_linux.go`
```
// Copyright 2020 the u-root Authors. All rights reserved
// Use of this source code is governed by a BSD-style
// license that can be found in the LICENSE file.

// Blkid prints information about blocks.
package main

import (
	"fmt"
	"io"
	"log"
	"os"

	"github.com/u-root/u-root/pkg/mount/block"
)

func run(getBlock func() (block.BlockDevices, error), out io.Writer) error {
	devices, err := getBlock()
	if err != nil {
		return fmt.Errorf("error getting Block devices: %w", err)
	}

	for _, device := range devices {
		fmt.Fprint(out, device.DevicePath())
		if device.FsUUID != "" {
			fmt.Fprintf(out, " UUID=%q", device.FsUUID)
		}
		if device.FSType != "" {
			fmt.Fprintf(out, " TYPE=%q", device.FSType)
		}
		fmt.Fprintln(out)
	}
	return nil
}

func main() {
	if err := run(block.GetBlockDevices, os.Stdout); err != nil {
		log.Fatal(err)
	}
}

```

### Core Architecture Module: `cmds/core/brctl/brctl_linux.go`
```
// Copyright 2024 the u-root Authors. All rights reserved
// Use of this source code is governed by a BSD-style
// license that can be found in the LICENSE file.

package main

import (
	"errors"
	"fmt"
	"io"
	"log"
	"os"

	"github.com/u-root/u-root/pkg/brctl"
)

// cli
const usage = `
Usage: brctl [commands]
commands:

INSTANCES:
brctl addbr <name>   creates a new instance of the ethernet bridge
brctl delbr <name>   deletes the instance <name> of the ethernet bridge
brctl show           show current instance(s) of the ethernet bridge

PORTS:
brctl addif <brname> <ifname>              will make the interface <ifname> a port of the bridge <brname>
brctl delif <brname> <ifname>              will detach the interface <ifname> from the bridge <brname>
brctl show <brname>                        will show some information on the bridge and its attached ports
brctl hairpin <bridge> <port> {on | off}   enable/disable hairpin mode on the port <port> of the bridge <bridge>

AGEING:
brctl showmacs <brname>           shows a list of learned MAC addresses for this bridge
brctl setageing <brname> <time>   sets the ethernet (MAC) address ageing to <time> seconds

SPANNING TREE PROTOCOL (IEEE 802.1d):
brctl stp <bridge> {on | off | yes | no}       controls the bridge participation in the spanning tree protocol
brctl showstp <bridge>                         shows stp related information of <bridge>
brctl setbridgeprio <bridge> <PRIORITY>        sets the bridge's priority to <priority>
brctl setfd <bridge> <time>                    sets the bridge's 'bridge forward delay' to <time> seconds
brctl sethello <bridge> <time>                 sets the bridge's 'bridge hello time' to <time> seconds
brctl setmaxage <bridge> <time>                sets the bridge's 'maximum message age' to <time> seconds
brctl setpathcost <bridge> <port> <COST>       sets the port cost of the port <port> to <cost>
brctl setportprio <bridge> <port> <PRIORITY>   sets the port's priority to <priority>

COST is a dimensionless metric (from 1 to 65535, default is 100).
PRIORITY is a number from 0 (min) to 63 (max), default is 32, and has no dimension.
`

var (
	errFewArgs    = errors.New("too few args")
	errInvalidCmd = errors.New("unknown command")
)

func run(out io.Writer, argv []string) error {
	var err error
	command := argv[0]
	args := argv[1:]

	switch command {
	case "addbr":
		if len(args) != 1 {
			return errFewArgs
		}
		err = brctl.Addbr(args[0])

	case "delbr":
		if len(args) != 1 {
			return errFewArgs
		}
		err = brctl.Delbr(args[0])

	case "addif":
		if len(args) != 2 {
			return errFewArgs
		}
		err = brctl.Addif(args[0], args[1])

	case "delif":
		if len(args) != 2 {
			return errFewArgs
		}
		err = brctl.Delif(args[0], args[1])

	case "show":
		err = brctl.Show(out, args...)

	case "showmacs":
		if len(args) != 1 {
			return errFewArgs
		}
		err = brctl.ShowMACs(args[0], out)

	case "setageing":
		if len(args) != 2 {
			return errFewArgs
		}
		err = brctl.SetAgeingTime(args[0], args[1])

	case "stp":
		if len(args) != 2 {
			return errFewArgs
		}
		err = brctl.SetSTP(args[0], args[1])

	case "showstp":
		if len(args) != 1 {
			return errFewArgs
		}
		err = brctl.ShowStp(out, args[0])

	case "setbridgeprio":
		if len(args) != 2 {
			return errFewArgs
		}
		err = brctl.SetBridgePrio(args[0], args[1])

	case "setfd":
		if len(args) != 2 {
			return errFewArgs
		}
		err = brctl.SetForwardDelay(args[0], args[1])

	case "sethello":
		if len(args) != 2 {
			return errFewArgs
		}
		err = brctl.SetHello(args[0], args[1])

	case "setmaxage":
		if len(args) != 2 {
			return errFewArgs
		}
		err = brctl.SetMaxAge(args[0], args[1])

	case "setpathcost":
		if len(args) != 3 {
			return errFewArgs
		}
		err = brctl.SetPathCost(args[0], args[1], args[2])

	case "setportprio":
		if len(args) != 3 {
			return errFewArgs
		}
		err = brctl.SetPortPrio(args[0], args[1], args[2])

	case "hairpin":
		if len(args) != 3 {
			return errFewArgs
		}
		err = brctl.Hairpin(args[0], args[1], args[2])

	case "help", "-h", "--help":
		fmt.Fprintf(out, "%s\n", usage)
		return nil

	default:
		return fmt.Errorf("%w: %s", errInvalidCmd, command)
	}

	return err
}

func main() {
	argv := os.Args

	if len(argv) < 2 {
		log.Fatal(usage)
	}

	if err := run(os.Stdout, argv[1:]); err != nil {
		log.Fatal(err)
	}
}

```

### Core Architecture Module: `cmds/core/cat/cat.go`
```
// Copyright 2012-2017 the u-root Authors. All rights reserved
// Use of this source code is governed by a BSD-style
// license that can be found in the LICENSE file.

// cat concatenates files and prints them to stdout.
//
// Synopsis:
//
//	cat [-u] [FILES]...
//
// Description:
//
//	If no files are specified, read from stdin.
//
// Options:
//
//	-u: ignored flag
package main

import (
	"flag"
	"fmt"
	"io"
	"log"
	"os"
)

var _ = flag.Bool("u", false, "ignored")
var errCopy = fmt.Errorf("error concatenating stdin to stdout")

func cat(reader io.Reader, writer io.Writer) error {
	if _, err := io.Copy(writer, reader); err != nil {
		return errCopy
	}
	return nil
}

func run(stdin io.Reader, stdout io.Writer, args ...string) error {
	if len(args) == 0 {
		return cat(stdin, stdout)
	}
	for _, file := range args {
		if file == "-" {
			err := cat(stdin, stdout)
			if err != nil {
				return err
			}
			continue
		}
		f, err := os.Open(file)
		if err != nil {
			return err
		}
		if err := cat(f, stdout); err != nil {
			return fmt.Errorf("failed to concatenate file %s to given writer", f.Name())
		}
		f.Close()
	}
	return nil
}

func main() {
	flag.Parse()
	if err := run(os.Stdin, os.Stdout, flag.Args()...); err != nil {
		log.Fatalf("cat failed with: %v", err)
	}
}

```

### Core Architecture Module: `cmds/core/chmod/chmod.go`
```
// Copyright 2016-2020 the u-root Authors. All rights reserved
// Use of this source code is governed by a BSD-style
// license that can be found in the LICENSE file.

// chmod changes mode bits (e.g. permissions) of a file.
//
// Synopsis:
//
//	chmod MODE FILE...
//
// Desription:
//
//	MODE is a three character octal value or a string like a=rwx
package main

import (
	"errors"
	"flag"
	"fmt"
	"io"
	"os"
	"path/filepath"
	"regexp"
	"strconv"
	"strings"

	"github.com/u-root/u-root/pkg/uroot/util"
)

const (
	special = 99999
	usage   = "chmod: chmod [mode] filepath"
)

var errBadUsage = errors.New(usage)

func init() {
	flag.Usage = util.Usage(flag.Usage, usage)
}

type cmd struct {
	stderr    io.Writer
	reference string
	recursive bool
}

func command(stderr io.Writer, recursive bool, reference string) *cmd {
	return &cmd{
		stderr:    stderr,
		recursive: recursive,
		reference: reference,
	}
}

func changeMode(path string, mode os.FileMode, octval uint64, mask uint64) error {
	// A special value for mask means the mode is fully described
	if mask == special {
		if err := os.Chmod(path, mode); err != nil {
			return err
		}
		return nil
	}

	var info os.FileInfo
	info, err := os.Stat(path)
	if err != nil {
		return err
	}
	mode = info.Mode() & os.FileMode(mask)
	mode = mode | os.FileMode(octval)

	if err := os.Chmod(path, mode); err != nil {
		return err
	}
	return nil
}

func calculateMode(modeString string) (mode os.FileMode, octval uint64, mask uint64, err error) {
	octval, err = strconv.ParseUint(modeString, 8, 32)
	if err == nil {
		if octval > 0o777 {
			return mode, octval, mask, fmt.Errorf("%w: invalid octal value %0o. Value should be less than or equal to 0777", strconv.ErrRange, octval)
		}
		// a fully described octal mode was supplied, signal that with a special value for mask
		mask = special
		mode = os.FileMode(octval)
		return
	}

	reMode := regexp.MustCompile("^([ugoa]+)([-+=])(.*)")
	m := reMode.FindStringSubmatch(modeString)
	// Test for mode strings with invalid characters.
	// This can't be done in the first regexp: if the match for m[3] is restricted to [rwx]*,
	// `a=9` and `a=` would be indistinguishable: m[3] would be empty.
	// `a=` is a valid (but destructive) operation. Do not turn a typo into that.
	reMode = regexp.MustCompile("^[rwx]*$")
	if len(m) < 3 || !reMode.MatchString(m[3]) {
		return mode, octval, mask, fmt.Errorf("%w:unable to decode mode %q. Please use an octal value or a valid mode string", strconv.ErrSyntax, modeString)
	}

	// m[3] is [rwx]{0,3}
	var octvalDigit uint64
	if strings.Contains(m[3], "r") {
		octvalDigit += 4
	}
	if strings.Contains(m[3], "w") {
		octvalDigit += 2
	}
	if strings.Contains(m[3], "x") {
		octvalDigit++
	}

	// m[2] is [-+=]
	operator := m[2]

	// Use a mask so that we do not overwrite permissions for a user/group that was not specified
	mask = 0o777

	// For "-", invert octvalDigit before applying the mask
	if operator == "-" {
		octvalDigit = 7 - octvalDigit
	}

	// m[1] is [ugoa]+
	if strings.Contains(m[1], "o") || strings.Contains(m[1], "a") {
		octval += octvalDigit
		mask = mask & 0o770
	}
	if strings.Contains(m[1], "g") || strings.Contains(m[1], "a") {
		octval += octvalDigit << 3
		mask = mask & 0o707
	}
	if strings.Contains(m[1], "u") || strings.Contains(m[1], "a") {
		octval += octvalDigit << 6
		mask = mask & 0o077
	}

	// For "+" the mask is superfluous, reset it
	if operator == "+" {
		mask = 0o777
	}

	// The mode is fully described, signal that with a special value for mask
	if operator == "=" && strings.Contains(m[1], "a") {
		mask = special
		mode = os.FileMode(octval)
	}
	return mode, octval, mask, nil
}

func (c *cmd) run(args ...string) error {
	var mode os.FileMode
	if len(args) < 1 {
		return errBadUsage
	}

	if len(args) < 2 && c.reference == "" {
		return errBadUsage
	}

	var (
		octval, mask uint64
		fileList     []string
	)

	if c.reference != "" {
		fi, err := os.Stat(c.reference)
		if err != nil {
			return fmt.Errorf("bad reference file: %w", err)
		}
		mask = special
		mode = fi.Mode()
		fileList = args
	} else {
		var err error
		if mode, octval, mask, err = calculateMode(args[0]); err != nil {
			return err
		}
		fileList = args[1:]
	}

	var finalErr error

	for _, name := range fileList {
		if c.recursive {
			err := filepath.Walk(name, func(path string, _ os.FileInfo, err error) error {
				if err != nil {
					return err
				}
				err = changeMode(path, mode, octval, mask)
				return err
			})
			if err != nil {
				finalErr = err
				fmt.Fprintln(c.stderr, err)
			}
		} else {
			err := changeMode(name, mode, octval, mask)
			if err != nil {
				finalErr = err
				fmt.Fprintln(c.stderr, err)
			}
		}
	}
	return finalErr
}

func main() {
	var (
		recursive = flag.Bool("recursive", false, "do changes recursively")
		reference = flag.String("reference", "", "use mode from reference file")
	)
	flag.Parse()
	if err := command(os.Stderr, *recursive, *reference).run(flag.Args()...); err != nil {
		os.Exit(1)
	}
}

```

### Core Architecture Module: `cmds/core/chroot/chroot.go`
```
// Copyright 2018 the u-root Authors. All rights reserved
// Use of this source code is governed by a BSD-style
// license that can be found in the LICENSE file.

//go:build !windows && !plan9

package main

import (
	"bytes"
	"flag"
	"fmt"
	"io"
	"log"
	"os"
	"os/exec"
	"path/filepath"
	"strconv"
	"strings"
	"syscall"
)

type userSpec struct {
	uid uint32
	gid uint32
}

var defaults = "  -g value\n  	specify supplementary group ids as g1,g2,..,gN\n  -s	Use this option to not changethe working directory to / after changing the root directory to newroot, i.e., inside the chroot. This option is only permitted when newroot is the old / directory.\n  -u value\n    	specify user and group (ID only) as USER:GROUP (default 1000:1000)"

func (u *userSpec) Set(s string) error {
	var err error
	userspecSplit := strings.Split(s, ":")
	if len(userspecSplit) != 2 || userspecSplit[1] == "" {
		return fmt.Errorf("expected user spec flag to be \":\" separated values received %s", s)
	}

	u.uid, err = stringToUint32(userspecSplit[0])
	if err != nil {
		return err
	}

	u.gid, err = stringToUint32(userspecSplit[1])
	if err != nil {
		return err
	}

	return nil
}

func (u *userSpec) Get() any {
	return *u
}

func (u *userSpec) String() string {
	return fmt.Sprintf("%d:%d", u.uid, u.gid)
}

func defaultUser() userSpec {
	return userSpec{
		uid: uint32(os.Getuid()),
		gid: uint32(os.Getgid()),
	}
}

type groupsSpec struct {
	groups []uint32
}

func (g *groupsSpec) Set(s string) error {
	groupStrs := strings.Split(s, ",")
	g.groups = make([]uint32, len(groupStrs))

	for index, group := range groupStrs {

		gid, err := stringToUint32(group)
		if err != nil {
			return err
		}

		g.groups[index] = gid
	}

	return nil
}

func (g *groupsSpec) Get() any {
	return *g
}

func (g *groupsSpec) String() string {
	var buffer bytes.Buffer

	for index, gid := range g.groups {
		buffer.WriteString(fmt.Sprint(gid))
		if index < len(g.groups)-1 {
			buffer.WriteString(",")
		}
	}

	return buffer.String()
}

var (
	skipchdirFlag bool
	user          = defaultUser()
	groups        = groupsSpec{}
)

func init() {
	flag.Var(&user, "u", "specify user and group (ID only) as USER:GROUP")
	flag.Var(&groups, "g", "specify supplementary group ids as g1,g2,..,gN")
	flag.BoolVar(&skipchdirFlag, "s", false, fmt.Sprint("Use this option to not change",
		"the working directory to / after changing the root directory to newroot, i.e., ",
		"inside the chroot. This option is only permitted when newroot is the old / directory."))
}

func stringToUint32(str string) (uint32, error) {
	ret, err := strconv.ParseUint(str, 10, 32)
	if err != nil {
		return 0, err
	}
	return uint32(ret), nil
}

func parseCommand(args []string) []string {
	if len(args) > 1 {
		return args[1:]
	}
	return []string{"/bin/sh", "-i"}
}

func isRoot(dir string) (bool, error) {
	realPath, err := filepath.EvalSymlinks(dir)
	if err != nil {
		return false, err
	}
	absolutePath, err := filepath.Abs(realPath)
	if err != nil {
		return false, err
	}
	if absolutePath == "/" {
		return true, nil
	}
	return false, nil
}

func chroot(w io.Writer, args ...string) (err error) {
	var (
		newRoot   string
		isOldroot bool
	)
	if len(args) == 0 {
		fmt.Fprint(w, defaults)
		return nil
	}

	newRoot, err = filepath.Abs(args[0])
	if err != nil {
		return err
	}
	isOldroot, err = isRoot(newRoot)
	if err != nil {
		return err
	}

	if !skipchdirFlag {
		err = os.Chdir(newRoot)
		if err != nil {
			return err
		}
	} else if !isOldroot {
		return fmt.Errorf("the -s option is only permitted when newroot is the old / directory")
	}

	argv := parseCommand(args)

	cmd := exec.Command(argv[0], argv[1:]...)

	cmd.Stdin, cmd.Stdout, cmd.Stderr = os.Stdin, os.Stdout, os.Stderr
	cmd.SysProcAttr = &syscall.SysProcAttr{
		Credential: &syscall.Credential{
			Uid:    user.uid,
			Gid:    user.gid,
			Groups: groups.groups,
		},
		Chroot: newRoot,
	}

	return cmd.Run()
}

func main() {
	flag.Parse()
	if err := chroot(os.Stdout, flag.Args()...); err != nil {
		log.Fatal(err)
	}
}

```

### Core Architecture Module: `cmds/core/cmp/cmp.go`
```
// Copyright 2013-2017 the u-root Authors. All rights reserved
// Use of this source code is governed by a BSD-style
// license that can be found in the LICENSE file.

// cmp compares two files and prints a message if their contents differ.
//
// Synopsis:
//
//	cmp [–lLs] FILE1 FILE2 [OFFSET1 [OFFSET2]]
//
// Description:
//
//	If offsets are given, comparison starts at the designated byte position
//	of the corresponding file.
//
//	Offsets that begin with 0x are hexadecimal; with 0, octal; with anything
//	else, decimal.
//
// Options:
//
//	–l: Print the byte number (decimal) and the differing bytes (octal) for
//	    each difference.
//	–L: Print the line number of the first differing byte.
//	–s: Print nothing for differing files, but set the exit status.
//
// What is an error, what goes on stderr, and what goes on stdout in cmp
// is fairly ad-hoc, but go something like this:
// invocation error: unparseable integer: error return from cmp()
// IO error, file too small: output on stderr, error return from cmp()
// Files are different: print difference info on stdout, no error return
// Files are same: no output, no error
package main

import (
	"bufio"
	"errors"
	"flag"
	"fmt"
	"io"
	"os"

	"github.com/rck/unit"
)

const (
	usage = "usage:[-options] file1 file 2 [offset1 [offset 2]]"
)

var (
	long   = flag.Bool("l", false, "print the byte number (decimal) and the differing bytes (hexadecimal) for each difference")
	line   = flag.Bool("L", false, "print the line number of the first differing byte")
	silent = flag.Bool("s", false, "print nothing for differing files, but set the exit status")

	ErrArgCount  = errors.New("arg count")
	ErrBadOffset = errors.New("bad offset")
	ErrDiffer    = errors.New("files differ")
)

func readFileOrStdin(stdin *os.File, name string) (*os.File, error) {
	var f *os.File
	var err error

	if name == "-" {
		f = stdin
	} else {
		f, err = os.Open(name)
	}

	return f, err
}

func cmp(stdout, stderr io.Writer, long, line, silent bool, args ...string) error {
	var offset [2]int64
	var f *os.File
	var err error

	cmpUnits := unit.DefaultUnits

	off, err := unit.NewUnit(cmpUnits)
	if err != nil {
		return fmt.Errorf("could not create unit based on mapping: %w", err)
	}

	var v *unit.Value
	switch len(args) {
	case 2:
	case 3:
		if v, err = off.ValueFromString(args[2]); err != nil {
			fmt.Fprintf(stderr, "bad offset1: %s: %v", args[2], err)
			return fmt.Errorf("%w:%w", err, ErrBadOffset)
		}
		offset[0] = v.Value
	case 4:
		if v, err = off.ValueFromString(args[2]); err != nil {
			fmt.Fprintf(stderr, "bad offset1: %s: %v", args[2], err)
			return fmt.Errorf("%w:%w", err, ErrBadOffset)
		}
		offset[0] = v.Value

		if v, err = off.ValueFromString(args[3]); err != nil {
			fmt.Fprintf(stderr, "bad offset2: %s: %v", args[3], err)
			return fmt.Errorf("%w:%w", err, ErrBadOffset)
		}
		offset[1] = v.Value
	default:
		fmt.Fprint(stderr, usage)
		return ErrArgCount
	}

	c := make([]io.Reader, 2)

	for i := range 2 {
		if f, err = readFileOrStdin(os.Stdin, args[i]); err != nil {
			return fmt.Errorf("failed to open %s: %w", args[i], err)
		}
		if _, err := f.Seek(offset[i], 0); err != nil {
			return fmt.Errorf("%w:%w", err, ErrBadOffset)
		}
		c[i] = bufio.NewReader(f)
	}

	lineno, charno := int64(1), int64(1)

	for {
		var b [2]byte
		_, err1 := c[0].Read(b[:1])
		_, err2 := c[1].Read(b[1:2])

		if err1 != nil || err2 != nil {
			if err1 == io.EOF && err2 == io.EOF {
				return nil
			}
			if err1 != nil {
				fmt.Fprintf(stderr, "%s:%v", args[0], err1)
				return err1
			}
			if err2 != nil {
				fmt.Fprintf(stderr, "%s:%v", args[1], err2)
				return err2
			}
		}

		b1, b2 := b[0], b[1]
		if b1 != b2 {
			if silent {
				return nil
			}
			if line {
				fmt.Fprintf(stdout, "%s %s: char %d line %d", args[0], args[1], charno, lineno)
				return ErrDiffer
			}
			if long {
				fmt.Fprintf(stdout, "%8d %#.2o %#.2o\n", charno, b1, b2)
			} else {
				fmt.Fprintf(stdout, "%s %s: char %d", args[0], args[1], charno)
				return ErrDiffer
			}
		}
		charno++
		if b1 == '\n' {
			lineno++
		}
	}
}

// cmp is defined to fail with exit code 2
func main() {
	flag.Parse()
	if err := cmp(os.Stdout, os.Stderr, *long, *line, *silent, flag.Args()...); err != nil {
		os.Exit(2)
	}
}

```

### Core Architecture Module: `cmds/core/comm/comm.go`
```
// Copyright 2013-2017 the u-root Authors. All rights reserved
// Use of this source code is governed by a BSD-style
// license that can be found in the LICENSE file.

// comm compares two files.
//
// Synopsis:
//
//	comm [-123h] FILE1 FILE2
//
// Descrption:
//
//	Comm reads file1 and file2, which are in lexicographical order, and
//	produces a three column output: lines only in file1; lines only in
//	file2; and lines in both files. The file name – means the standard
//	input.
//
// Options:
//
//	-1: suppress printing of column 1
//	-2: suppress printing of column 2
//	-3: suppress printing of column 3
//	-h: print this help message and exit
package main

import (
	"bufio"
	"errors"
	"flag"
	"fmt"
	"io"
	"log"
	"os"
	"strings"
)

var (
	s1   = flag.Bool("1", false, "suppress printing of column 1")
	s2   = flag.Bool("2", false, "suppress printing of column 2")
	s3   = flag.Bool("3", false, "suppress printing of column 3")
	help = flag.Bool("h", false, "print this help message and exit")

	// ErrUsage is the error for incorrect usage.
	ErrUsage = errors.New("comm: comm [-123h] file1 file2")
)

func reader(r io.Reader, c chan string) {
	b := bufio.NewReader(r)
	for {
		s, err := b.ReadString('\n')
		c <- strings.TrimRight(s, "\r\n")
		if err != nil {
			break
		}
	}
	close(c)
}

type out struct {
	s1, s2, s3 string
}

func outer(c1, c2 chan string, c chan out) {
	s1, ok1 := <-c1
	s2, ok2 := <-c2
	for {
		if ok1 && ok2 {
			switch {
			case s1 < s2:
				c <- out{s1, "", ""}
				s1, ok1 = <-c1
			case s1 > s2:
				c <- out{"", s2, ""}
				s2, ok2 = <-c2
			default:
				c <- out{"", "", s2}
				s1, ok1 = <-c1
				s2, ok2 = <-c2
			}
		} else if ok1 {
			c <- out{s1, "", ""}
			s1, ok1 = <-c1
		} else if ok2 {
			c <- out{"", s2, ""}
			s2, ok2 = <-c2
		} else {
			break
		}
	}
	close(c)
}

func comm(w io.Writer, s1, s2, s3, help bool, args ...string) error {
	if len(args) != 2 || help {
		return ErrUsage
	}

	c1 := make(chan string, 100)
	c2 := make(chan string, 100)
	c := make(chan out, 100)

	f1, err := os.Open(args[0])
	if err != nil {
		return fmt.Errorf("can't open %s: %w", args[0], err)
	}

	f2, err := os.Open(args[1])
	if err != nil {
		return fmt.Errorf("can't open %s: %w", args[1], err)
	}
	go reader(f1, c1)
	go reader(f2, c2)
	go outer(c1, c2, c)

	for {
		out, ok := <-c
		if !ok {
			break
		}

		line := ""
		if !s1 {
			line += out.s1
		}
		line += "\t"
		if !s2 {
			line += out.s2
		}
		line += "\t"
		if !s3 {
			line += out.s3
		}
		if line != "\t\t" {
			fmt.Fprintln(w, strings.TrimRight(line, "\t")) // the unix comm utility does this
		}
	}
	return nil
}

func main() {
	flag.Parse()
	if err := comm(os.Stdout, *s1, *s2, *s3, *help, flag.Args()...); err != nil {
		if err == ErrUsage {
			log.Println(err.Error())
			flag.Usage()
		}
		log.Fatal(err)
	}
}

```

### Core Architecture Module: `cmds/core/cp/cp.go`
```
// Copyright 2016-2017 the u-root Authors. All rights reserved
// Use of this source code is governed by a BSD-style
// license that can be found in the LICENSE file.

// cp copies files.
//
// Synopsis:
//
//	cp [-rRfivwP] FROM... TO
//
// Options:
//
//	-w n: number of worker goroutines
//	-R: copy file hierarchies
//	-r: alias to -R recursive mode
//	-i: prompt about overwriting file
//	-f: force overwrite files
//	-v: verbose copy mode
//	-P: don't follow symlinks
package main

import (
	"bufio"
	"errors"
	"flag"
	"fmt"
	"io"
	"log"
	"os"
	"path/filepath"
	"strings"

	"github.com/u-root/u-root/pkg/cp"
	"github.com/u-root/u-root/pkg/uroot/unixflag"
)

var errUsage = errors.New("usage: cp [-RrifvP] file[s] ... dest")

type flags struct {
	recursive        bool
	ask              bool
	force            bool
	verbose          bool
	noFollowSymlinks bool
}

// promptOverwrite ask if the user wants overwrite file
func promptOverwrite(dst string, out io.Writer, in *bufio.Reader) (bool, error) {
	fmt.Fprintf(out, "cp: overwrite %q? ", dst)
	answer, err := in.ReadString('\n')
	if err != nil {
		return false, err
	}

	if strings.ToLower(answer)[0] != 'y' {
		return false, nil
	}

	return true, nil
}

func setupPreCallback(recursive, ask, force bool, writer io.Writer, reader bufio.Reader) func(string, string, os.FileInfo) error {
	return func(src, dst string, srcfi os.FileInfo) error {
		// check if src is dir
		if !recursive && srcfi.IsDir() {
			fmt.Fprintf(writer, "cp: -r not specified, omitting directory %s\n", src)
			return cp.ErrSkip
		}

		dstfi, err := os.Stat(dst)
		if err != nil && !os.IsNotExist(err) {
			fmt.Fprintf(writer, "cp: %q: can't handle error %v\n", dst, err)
			return cp.ErrSkip
		} else if err != nil {
			// dst does not exist.
			return nil
		}

		// dst does exist.

		if os.SameFile(srcfi, dstfi) {
			fmt.Fprintf(writer, "cp: %q and %q are the same file\n", src, dst)
			return cp.ErrSkip
		}
		if ask && !force {
			overwrite, err := promptOverwrite(dst, writer, &reader)
			if err != nil {
				return err
			}
			if !overwrite {
				return cp.ErrSkip
			}
		}
		return nil
	}
}

func setupPostCallback(verbose bool, w io.Writer) func(src, dst string) {
	return func(src, dst string) {
		if verbose {
			fmt.Fprintf(w, "%q -> %q\n", src, dst)
		}
	}
}

// run evaluates the flags and args and makes decisions for copyfiles
func run(args []string, w io.Writer, i *bufio.Reader) error {
	var f flags

	fs := flag.NewFlagSet("cp", flag.ContinueOnError)

	fs.BoolVar(&f.recursive, "RECURSIVE", false, "copy file hierarchies")
	fs.BoolVar(&f.recursive, "R", false, "copy file hierarchies (shorthand)")

	fs.BoolVar(&f.recursive, "recursive", false, "alias to -R recursive mode")
	fs.BoolVar(&f.recursive, "r", false, "alias to -R recursive mode (shorthand)")

	fs.BoolVar(&f.ask, "interactive", false, "prompt about overwriting file")
	fs.BoolVar(&f.ask, "i", false, "prompt about overwriting file (shorthand)")

	fs.BoolVar(&f.force, "force", false, "force overwrite files")
	fs.BoolVar(&f.force, "f", false, "force overwrite files (shorthand)")

	fs.BoolVar(&f.verbose, "verbose", false, "verbose copy mode")
	fs.BoolVar(&f.verbose, "v", false, "verbose copy mode (shorthand)")

	fs.BoolVar(&f.noFollowSymlinks, "no-dereference", false, "don't follow symlinks")
	fs.BoolVar(&f.noFollowSymlinks, "P", false, "don't follow symlinks (shorthand)")

	fs.Usage = func() {
		fmt.Fprintf(fs.Output(), "Usage: cp [-RrifvP] file[s] ... dest\n\n")
		fs.PrintDefaults()
	}

	if err := fs.Parse(unixflag.ArgsToGoArgs(args)); err != nil {
		return err
	}

	if fs.NArg() < 2 {
		fs.Usage()
		return errUsage
	}

	todir := false
	from, to := fs.Args()[:fs.NArg()-1], fs.Args()[fs.NArg()-1]
	toStat, err := os.Stat(to)
	if err == nil {
		todir = toStat.IsDir()
	}
	if fs.NArg() > 2 && !todir {
		return eNotDir
	}

	opts := cp.Options{
		NoFollowSymlinks: f.noFollowSymlinks,

		// cp the command makes sure that
		//
		// (1) the files it's copying aren't already the same,
		// (2) the user is asked about overwriting an existing file if
		//     one is already there.
		PreCallback: setupPreCallback(f.recursive, f.ask, f.force, w, *i),

		PostCallback: setupPostCallback(f.verbose, w),
	}

	var lastErr error
	for _, file := range from {
		dst := to
		if todir {
			dst = filepath.Join(dst, filepath.Base(file))
		}
		if f.recursive {
			lastErr = opts.CopyTree(file, dst)
		} else {
			lastErr = opts.Copy(file, dst)
		}
	}
	return lastErr
}

func main() {
	err := run(os.Args[1:], os.Stderr, bufio.NewReader(os.Stdin))
	if err != nil {
		if errors.Is(err, errUsage) {
			os.Exit(1)
		}
		log.Fatal(err)
	}
}

```


### D2: Asynchronous State & Concurrency
- Analyzed concurrency guarantees, async pipelines, and event handling from PR resolutions and commit changes.

### D3: Error Boundaries, Recovery & Rollbacks
- Exception handling patterns and defect resolutions extracted from closed production bug issues:
- **Issue #3575** (2026-05-05): **grub: Fedora-Workstation-Live-43-1.6.x86_64.iso won't boot**
  *Symptoms*: Boot fails with: ``` 01. Test this media & start Fedora-Workstation-Live  02. Start Fedora-Workstation-Live  03. Start Fedora-Workstation-Live in basic graphics mode  04. Reboot  05. Enter a LinuxBoot shell Enter an option ('01' is the default, 'e' to edit kernel cmdline):  >    2026/04/17 20:20:10 Failed to load Start Fedora-Workstation-Live: could not load image LinuxImage(   Name: Start Fedora-Workstation-Live   Kernel: file:///tmp/u-root-mounts1744837055/sda/%28$root%29/boot/x86_64/loader/linux   Initrd: file:///tmp/u-root-mounts1744837055/sda/%28$root%29/boot/x86_64/loader/initrd   Cmdline: quiet rhgb root=live:CDLABEL=Fedora-WS-Live-43 rd.live.image console=ttyS0   DTB: <nil> ) : encountered error open /tmp/u-root-mounts1744837055/sda/($root)/boot/x86_64/loader/linux: no such file or directory with "file:///tmp/u-root-mounts1744837055/sda/%28$root%29/boot/x86_64/loader/linux" ```  The issue is pretty straight forward, the linux/initrd lines have prefix "($root)" in grub.cfg. This gets carried across when we prefix the mount url, and breaks the path.  The issue is not limited to Fedora, but other distros too, such as CentOS and openSUSE. But they might also have syslinux configs that work, while Fedora only has grub.  I think it should be an easy fix, just to strip the prefix. Since we already handle alternative "root" when we parse "set" directive (and as I understand, the root prefix is implied anyway when absent).  ie: ``` pkg/boot/grub/grub.go @@ -310,6 +310,7 @@ fun

- **Issue #3493** (2026-01-30): **TestMarshal in ./pkg/boot/bzimage fails on main branch**
  *Symptoms*: **Describe the bug**  `TestMarshal` in ./pkg/boot/bzimage fails on main branch commit 0be682ef7f03646bda8efa145db53aab9139bc54  **To Reproduce**  OS: Linux Arch: amd64 Go version: go1.24.8 linux/amd64  ``` go test ./pkg/boot/bzimage -run TestMarshal ```  ``` --- FAIL: TestMarshal (1.29s)     bzimage.go:116: Processing 757712 byte image     bzimage.go:128: Header was 616 bytes     bzimage.go:129: magic 48647253 switch 0     bzimage.go:136: RamDisk image 0 size 0     bzimage.go:137: StartSys 1000     bzimage.go:138: Boot type: Not set(0)     bzimage.go:146: SetupSects 30     bzimage.go:155: Kernel offset is 15872 bytes, low1mcode is 15256 bytes     bzimage.go:160: 15256 bytes of BootCode     bzimage.go:177: Uncompress 611116 bytes     bzimage.go:195: Original length of uncompressed kernel is: 7008336     bzimage_decompress.go:31: Stripped reader is of length 611112 bytes     bzimage.go:225: Kernel at 15872, 7008336 bytes     bzimage.go:226: KernelCode size: 7008336     bzimage.go:232: CRC read from image is: 0x00000000     bzimage.go:423: b is 7008336 bytes     bzimage.go:442: Compressed data is 611120 bytes, starts with 0xfd377a585a0000016922de3604c1f0a525d0e0ab03040021011a00003ee79893     bzimage.go:443: Last 16 bytes: 0xa0de64c19be35140030000000001595a     --- FAIL: TestMarshal/basic_bzImage (0.53s)         bzimage_test.go:134: b header is MBRCode:0xea0500c0078cc88ed88ec08ed031e4fbfcbe2d00ac20c07409b40ebb0700cd10ebf231c0cd16cd19eaf0ff00f0557365206120626f6f74206c6f616465722e0
  **Post-Mortem & Fix Analysis**:
  > Fixed in #3494 

- **Issue #3426** (2025-12-05): **boot menu garbles lines.**
  *Symptoms*: The Boot memu writes its output to different file descriptors which ultimately all come out to the same place but can have different buffering configurations. This leads to some output being shown out of order. In addition some lines have no \r, leading in some cases to the banner lines marching off the right hand side.  **To Reproduce** On some hardware  and configurations the  menu output becomes hard to parse.  e.g. ``` Welcome to LinuxBoot's Menu                                                      Enter a number to boot a kernel:                                                                                                              01. /mnt/part1/boot/kernel.uImage                                                                                                             Enter an option ('01' is the default, 'e' to edit kernel cmdline): >  02. /mnt/part5/boot/kernel.uImage  03. Reboot  04. Enter a LinuxBoot shell ```  **Expected behavior** should show:  ``` Welcome to LinuxBoot's Menu  Enter a number to boot a kernel:  01. /mnt/part1/boot/kernel.uImage (kernel: planetbde_bzkernel@1)  02. /mnt/part5/boot/kernel.uImage (kernel: planetbde_bzkernel@1)  03. Reboot  04. Enter a LinuxBoot shell   Enter an option ('01' is the default, 'e' to edit kernel cmdline): > ``` I have submitted a patch
  **Post-Mortem & Fix Analysis**:
  > actually two separate patches 

- **Issue #3402** (2025-07-02): **    remove blind deref of route.Dst in routeAdd**
  *Symptoms*:     remove blind deref of route.Dst in routeAdd      This also provides a better error message:     rminnich@pop-os:~/go/src/github.com/u-root/u-root/cmds/core/ip$ ./ip -6  route  add default     2025/06/25 10:24:56 ip: adding route for <nil>: either Dst.IP, Src.IP or Gw must be set     rminnich@pop-os:~/go/src/github.com/u-root/u-root/cmds/core/ip$ ./ip   route  add default     2025/06/25 10:24:58 ip: adding route for <nil>: either Dst.IP, Src.IP or Gw must be set      before it would just segv.
  **Post-Mortem & Fix Analysis**:
  > ## [Codecov](https://app.codecov.io/gh/u-root/u-root/pull/3402?dropdown=coverage&src=pr&el=h1&utm_medium=referral&utm_source=github&utm_content=comment&utm_campaign=pr+comments&utm_term=u-root) Report Attention: Patch coverage is `0%` with `1 line` in your changes missing coverage. Please review. > Project coverage is 60.11%. Comparing base [(`956ffaa`)](https://app.codecov.io/gh/u-root/u-root/commit/956ffaae75fb4e97bc51a13b1df44c75ef9c0ec4?dropdown=coverage&el=desc&utm_medium=referral&utm_source=github&utm_content=comment&utm_campaign=pr+comments&utm_term=u-root) to head [(`bf56df0`)](https://app.codecov.io/gh/u-root/u-root/commit/bf56df0549334d938ef8a9ffa6f0361b67de86dc?dropdown=coverage&el=desc&utm_medium=referral&utm_source=github&utm_content=comment&utm_campaign=pr+comments&utm_term=u-root). > Report is 1 commits behind head on main.  <details><summary>Additional details and impacted files</summary>   ```diff @@           Coverage Diff           @@ ##             main    #3402   +

- **Issue #3389** (2026-03-20): **make Plan 9 booting work again**
  *Symptoms*: kexec supported plan 9 a.out files for a time. This allowed linuxboot to boot Plan 9 kernels.  I suspect people did not realize that kexec is not just for linux booting linux; in any event, changes made broke kexec for Plan 9 a.out files, which we just learned a few days ago.  Remove uses of elf.Open and use kexec.ObjectNewFile instead. This will allow us, in future, to use a wide variety of object file formats.  Fix some of the broken settings made by debug/plan9obj. Set Memsz in the ELF segments created by ObjectNewFile.  Signed-off-by: Ronald G Minnich <rminnich@gmail.com>  more fixs
  **Post-Mortem & Fix Analysis**:
  > We will need an integration test for plan 9, since this used to work and got broken, *even though all the tests continued to work*
  > ## [Codecov](https://app.codecov.io/gh/u-root/u-root/pull/3389?dropdown=coverage&src=pr&el=h1&utm_medium=referral&utm_source=github&utm_content=comment&utm_campaign=pr+comments&utm_term=u-root) Report :white_check_mark: All modified and coverable lines are covered by tests. :white_check_mark: Project coverage is 60.30%. Comparing base ([`dad2b0b`](https://app.codecov.io/gh/u-root/u-root/commit/dad2b0bc4ccd13dc3b91ef418b46e352f5f5e7d7?dropdown=coverage&el=desc&utm_medium=referral&utm_source=github&utm_content=comment&utm_campaign=pr+comments&utm_term=u-root)) to head ([`ea6189a`](https://app.codecov.io/gh/u-root/u-root/commit/ea6189a4319502d16634db122d7c1f5bfb7673cb?dropdown=coverage&el=desc&utm_medium=referral&utm_source=github&utm_content=comment&utm_campaign=pr+comments&utm_term=u-root)). :warning: Report is 1 commits behind head on main.  <details><summary>Additional details and impacted files</summary>    ```diff @@            Coverage Diff             @@ ##             main    #33

- **Issue #3382** (2025-05-19): **pkg/cpio: test uses stale testing.T**
  *Symptoms*: **Describe the bug** A test calls Debug, which refers to a testing.T from a different test. The result is that the Debug produces no output.  **To Reproduce** ``` cd pkg/cpio go test -v ```  **Expected behavior** See the Debug messages like "Decoded header is..."  The fix is ``` @@ -490,6 +490,7 @@ func TestPipeWriteRead(t *testing.T) {  }    func TestReadWrite(t *testing.T) { +       Debug = t.Logf         r := Newc.Reader(bytes.NewReader(testCPIO))         files, err := ReadAllRecords(r) ``` I didn't have permission to push a PR.

- **Issue #3374** (2025-05-15): **I'm creating a test to look at patterns in github**
  *Symptoms*: **Describe the bug** A clear and concise description of what the bug is.  **To Reproduce** Steps to reproduce the behavior:  **Expected behavior** A clear and concise description of what you expected to happen.  **Additional context** Add any other context about the problem here. 
  **Post-Mortem & Fix Analysis**:
  > @natagitlie I assume this issue was created by mistake, since you did not modify the template. If you still wish to file an issue, please consider opening a new one.

- **Issue #3362** (2026-05-19): **gosh with goshliner, program cannot read Stdin (also Ctrl-c to same program exits gosh)**
  *Symptoms*:  A Go program that does `bufio.NewReader(os.Stdin).ReadString('\n')` does not get any input when run in the `gosh` shell that is built with `goshliner` tag. It works fine in the regular `gosh` that uses `bubbline` (which is how it is built by default, without any -tags)  With the `tst` program built from the code further down, I run u-root like this:  ``` ./u-root -tags goshliner -files ../src/tst:bin/tst -o initramfs "./cmds/core/*" ```  Then I extract the initramfs cpio, run `bin/defaultsh`, and invoke `bin/tst` on the gosh prompt. Then tst's message is displayed, but nothing happens when I hit `Enter`.  When reproducing this again now, I also notice that when running `gosh-goshliner`, invoking `bin/tst` and hitting `Ctrl-c` exits the whole gosh shell! But when running `gosh-bubbline`, invoking `bin/tst` and hitting `Ctrl-c` returns me to the gosh prompt, as expected.    Minimal ReadString tst program:  ``` package main  import (     "bufio"     "fmt"     "os" )  func main() {     fmt.Print("Commit by hitting Enter key, cancel with Ctrl-c")     r := bufio.NewReader(os.Stdin)     _, err := r.ReadString('\n')     if err != nil {         fmt.Printf("read failed: %s\n", err)         os.Exit(1)     }     fmt.Printf("Will proceed!\n") } ``` 
  **Post-Mortem & Fix Analysis**:
  > Thank you for picking this up!
  > A similar issue exists with the tag goshsmall and both goshliner and goshsmall are getting more important so I'm trying to get this resolved asap.
  > @MDr164 did you have any progress on this, or it was a victim of prioritization?

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

### Incident Patch 1: `1a531e4d` (2026-10-04)
**Commit Message**: cmds/core/timeout: replace errors.As with AsType

Signed-off-by: Siarhiej Siemianczuk <[REDACTED_EMAIL]>

**File**: `cmds/core/timeout/run.go` (modified, +3/-5)
```diff
@@ -38,12 +38,10 @@ func (c *cmd) run() (int, error) {
 	})
 
 	if err := cmd.Wait(); err != nil {
-		errno := 1
-		var e *exec.ExitError
-		if errors.As(err, &e) {
-			errno = e.ExitCode()
+		if ee, ok := errors.AsType[*exec.ExitError](err); ok {
+			return ee.ExitCode(), err
 		}
-		return errno, err
+		return 1, err
 	}
 
 	return 0, nil
```

**File**: `cmds/core/timeout/timeout_test.go` (modified, +2/-3)
```diff
@@ -92,9 +92,8 @@ func TestBashExit(t *testing.T) {
 	}
 
 	var errno int
-	var e *exec.ExitError
-	if errors.As(err, &e) {
-		errno = e.ExitCode()
+	if ee, ok := errors.AsType[*exec.ExitError](err); ok {
+		errno = ee.ExitCode()
 	} else {
 		t.Fatalf(`Running "bash", "-c", "exit 20": got %T, want *exec.ExitError`, err)
 	}
```

---

### Incident Patch 2: `a196d921` (2026-09-30)
**Commit Message**: manpkg/termios: manage Linux B* bauds and values

Convert returned Linux B* to a rate for Ispeed and Ospeed

Add 0 as a possible baud rate.

Signed-off-by: Ronald G Minnich <[REDACTED_EMAIL]>

**File**: `pkg/termios/termios_linux.go` (modified, +8/-2)
```diff
@@ -59,6 +59,12 @@ func GetTermios(fd uintptr) (*Termios, error) {
 	if err != nil {
 		return nil, err
 	}
+
+	// The 5 bit field covered by unix.CBAUD is not completely defined.
+	unixBaud := int(t.Cflag & unix.CBAUD)
+	if r, ok := unixB2baud[unixBaud]; ok {
+		t.Ispeed, t.Ospeed = r, r
+	}
 	return &Termios{Termios: *t}, nil
 }
 
@@ -165,8 +171,8 @@ func MakeSerialBaud(term *Termios, baud int) (*Termios, error) {
 
 	t.Cflag &^= unix.CBAUD
 	t.Cflag |= rate
-	t.Ispeed = rate
-	t.Ospeed = rate
+	t.Ispeed = uint32(baud)
+	t.Ospeed = uint32(baud)
 
 	return &t, nil
 }
```

**File**: `pkg/termios/var_darwin.go` (modified, +1/-0)
```diff
@@ -13,6 +13,7 @@ import (
 
 // baud2unixB convert a baudrate to the corresponding unix const.
 var baud2unixB = map[int]uint64{
+	0:      0,
 	50:     unix.B50,
 	75:     unix.B75,
 	110:    unix.B110,
```

**File**: `pkg/termios/var_freebsd.go` (modified, +1/-0)
```diff
@@ -10,6 +10,7 @@ import (
 
 // baud2unixB convert a baudrate to the corresponding unix const.
 var baud2unixB = map[int]uint32{
+	0:      0,
 	50:     unix.B50,
 	75:     unix.B75,
 	110:    unix.B110,
```

**File**: `pkg/termios/var_linux.go` (modified, +36/-0)
```diff
@@ -13,6 +13,7 @@ import (
 
 // baud2unixB convert a baudrate to the corresponding unix const.
 var baud2unixB = map[int]uint32{
+	0:       0,
 	50:      unix.B50,
 	75:      unix.B75,
 	110:     unix.B110,
@@ -45,6 +46,41 @@ var baud2unixB = map[int]uint32{
 	4000000: unix.B4000000,
 }
 
+// baud2unixB convert a Baud to the corresponding integer baud
+var unixB2baud = map[int]uint32{
+	0:             0,
+	unix.B50:      50,
+	unix.B75:      75,
+	unix.B110:     110,
+	unix.B134:     134,
+	unix.B150:     150,
+	unix.B200:     200,
+	unix.B300:     300,
+	unix.B600:     600,
+	unix.B1200:    1200,
+	unix.B1800:    1800,
+	unix.B2400:    2400,
+	unix.B4800:    4800,
+	unix.B9600:    9600,
+	unix.B19200:   19200,
+	unix.B38400:   38400,
+	unix.B57600:   57600,
+	unix.B115200:  115200,
+	unix.B230400:  230400,
+	unix.B460800:  460800,
+	unix.B500000:  500000,
+	unix.B576000:  576000,
+	unix.B921600:  921600,
+	unix.B1000000: 1000000,
+	unix.B1152000: 1152000,
+	unix.B1500000: 1500000,
+	unix.B2000000: 2000000,
+	unix.B2500000: 2500000,
+	unix.B3000000: 3000000,
+	unix.B3500000: 3500000,
+	unix.B4000000: 4000000,
+}
+
 // init adds constants that are linux-specific
 func init() {
 	extra := map[string]*bit{
```

**File**: `pkg/termios/var_netbsd.go` (modified, +1/-0)
```diff
@@ -10,6 +10,7 @@ import (
 
 // baud2unixB convert a baudrate to the corresponding unix const.
 var baud2unixB = map[int]int32{
+	0:      0,
 	50:     unix.B50,
 	75:     unix.B75,
 	110:    unix.B110,
```

**File**: `pkg/termios/var_openbsd.go` (modified, +1/-0)
```diff
@@ -10,6 +10,7 @@ import (
 
 // baud2unixB convert a baudrate to the corresponding unix const.
 var baud2unixB = map[int]int32{
+	0:      0,
 	50:     unix.B50,
 	75:     unix.B75,
 	110:    unix.B110,
```

---

### Incident Patch 3: `8ba9fb43` (2026-09-30)
**Commit Message**: termios/termios_linux.go: set baud rate the old way

Use the old fashioned BAUD flags in Cflags, because the
Go unix package still can not handle TIOC?ETS2 and
its structs.

Signed-off-by: Ronald Minnich <[REDACTED_EMAIL]>

**File**: `pkg/termios/termios_linux.go` (modified, +7/-1)
```diff
@@ -69,7 +69,13 @@ func (t *TTYIO) Get() (*Termios, error) {
 
 // SetTermios sets tty parameters for an fd from a Termios.
 func SetTermios(fd uintptr, ti *Termios) error {
-	return unix.IoctlSetTermios(int(fd), unix.TCSETS, &ti.Termios)
+	baud, ok := baud2unixB[int(ti.Ispeed)]
+	if !ok {
+		return fmt.Errorf("%d: Unrecognized baud rate", baud)
+	}
+	ti.Termios.Cflag &= ^uint32(unix.CBAUD)
+	ti.Termios.Cflag |= baud
+	return unix.IoctlSetTermios(int(fd), sets, &ti.Termios)
 }
 
 // Set sets tty parameters for a TTYIO from a Termios.
```

---

### Incident Patch 4: `922a9e66` (2026-09-19)
**Commit Message**: Fix the misleading comment in fs9

The comment showed up in go doc termios,
and it only applies to Plan 9.

Also, just rename the file, to make it clear that
it is plan 9 specific.

Signed-off-by: ron minnich <[REDACTED_EMAIL]>

**File**: `pkg/termios/fs_plan9.go` (renamed, +5/-4)
```diff
@@ -2,10 +2,6 @@
 // Use of this source code is governed by a BSD-style
 // license that can be found in the LICENSE file.
 
-// N.B.: While these functions are only used on Plan 9,
-// they can be tested on any system: they are just doing
-// file IO. Until we have Plan 9 VMs to test, we can test
-// them in Linux.
 package termios
 
 import (
@@ -16,6 +12,11 @@ import (
 	"strings"
 )
 
+// N.B.: While these functions are only used on Plan 9,
+// they can be tested on any system: they are just doing
+// file IO. Until we have Plan 9 VMs to test, we can test
+// them in Linux.
+
 func consctl(root string, fd uintptr) (string, error) {
 	data, err := os.ReadFile(filepath.Join(root, "fd", fmt.Sprintf("%dctl", fd)))
 	if err != nil {
```

---

### Incident Patch 5: `ed6e2e40` (2026-09-23)
**Commit Message**: pkg/boot/universalpayload: fix error revive

Signed-off-by: Siarhiej Siemianczuk <[REDACTED_EMAIL]>

**File**: `pkg/boot/universalpayload/utilities_arch_arm64.go` (modified, +1/-1)
```diff
@@ -30,7 +30,7 @@ func (u *UPL) getPhysicalAddressSizes() (uint8, error) {
 	if physicalAddrSize != "" {
 		num, err := strconv.ParseUint(physicalAddrSize, 10, 8)
 		if err != nil {
-			return 0, fmt.Errorf("malformed UROOT_PHYS_ADDR_SIZE value \"%s\": %w\n", physicalAddrSize, err)
+			return 0, fmt.Errorf("malformed UROOT_PHYS_ADDR_SIZE value %q: %w", physicalAddrSize, err)
 		}
 		return uint8(num), nil
 	}
```

---

### Incident Patch 6: `7f32e543` (2026-09-22)
**Commit Message**: pkg/boot/universalpayload: fix revive comments

Signed-off-by: Siarhiej Siemianczuk <[REDACTED_EMAIL]>

**File**: `pkg/boot/universalpayload/utilities_arch_arm64.go` (modified, +6/-6)
```diff
@@ -28,11 +28,11 @@ func (u *UPL) getPhysicalAddressSizes() (uint8, error) {
 	// Please update to actual physical address size
 	physicalAddrSize := os.Getenv("UROOT_PHYS_ADDR_SIZE")
 	if physicalAddrSize != "" {
-		if num, err := strconv.ParseUint(physicalAddrSize, 10, 8); err == nil {
-			return uint8(num), nil
-		} else {
-			return 0, fmt.Errorf("Malformed UROOT_PHYS_ADDR_SIZE value \"%s\": %v\n", physicalAddrSize, err)
+		num, err := strconv.ParseUint(physicalAddrSize, 10, 8)
+		if err != nil {
+			return 0, fmt.Errorf("malformed UROOT_PHYS_ADDR_SIZE value \"%s\": %w\n", physicalAddrSize, err)
 		}
+		return uint8(num), nil
 	}
 	return 48, nil
 }
@@ -61,8 +61,8 @@ func (u *UPL) constructTrampoline(buf []uint8, addr uint64, entry uint64) []uint
 
 	buf = append(buf, tramp...)
 
-	padWithLength := func(slice []uint8, len uint64) []uint8 {
-		tmpBytes := make([]uint8, len)
+	padWithLength := func(slice []uint8, l uint64) []uint8 {
+		tmpBytes := make([]uint8, l)
 		return append(slice, tmpBytes...)
 	}
 
```

---

### Incident Patch 7: `dd162749` (2026-08-25)
**Commit Message**: fix: only multiplex with multiple consoles

RunCommands engaged the PTY-multiplexing path whenever any console
existed, i.e. always, including single-console systems. Routing I/O
of short-lived commands through the PTY relay there introduced a
shutdown race: init reaps the command and closes ptmx before the
fan-out goroutines forward buffered output, losing it entirely.

With zero or one console there is nothing to multiplex: pass stdio
through unchanged, matching pre-multi-console behavior. Multi-console
systems keep PTY multiplexing. This mirrors commit b5a525d3e, which
applied the same single-console rule to RedirectOutputToConsoles.

Signed-off-by: Marvin Drees <[REDACTED_EMAIL]>

**File**: `pkg/libinit/proc_linux.go` (modified, +10/-4)
```diff
@@ -111,8 +111,11 @@ func RunCommands(debug func(string, ...any), commands ...*exec.Cmd) int {
 			}
 		}
 
-		// If we have TTYs from kernel cmdline, use PTY multiplexing like the shell tool
-		if len(ttyNames) > 0 {
+		// If we have multiple TTYs from kernel cmdline, use PTY multiplexing like the shell tool.
+		// With zero or one console there is nothing to multiplex; routing I/O
+		// through a PTY anyway adds relay overhead and shutdown races that can
+		// lose short-lived command output.
+		if len(ttyNames) > 1 {
 			debug("Setting up multi-TTY with %v", ttyNames)
 
 			// Open and configure all TTYs
@@ -135,8 +138,11 @@ func RunCommands(debug func(string, ...any), commands ...*exec.Cmd) int {
 				ttys = append(ttys, tty)
 			}
 
-			if len(ttys) == 0 {
-				debug("No TTYs could be opened, falling back to default")
+			if len(ttys) <= 1 {
+				debug("Not enough TTYs could be opened, falling back to default")
+				for _, tty := range ttys {
+					tty.Close()
+				}
 				cmd.Stdin, cmd.Stdout, cmd.Stderr = os.Stdin, os.Stdout, os.Stderr
 			} else {
 				// Create PTY for the command
```

---

### Incident Patch 8: `04e0e615` (2026-06-30)
**Commit Message**: fix: update test to match updated tty code

Signed-off-by: Marvin Drees <[REDACTED_EMAIL]>

**File**: `pkg/libinit/proc_linux_test.go` (modified, +35/-58)
```diff
@@ -5,7 +5,6 @@
 package libinit
 
 import (
-	"errors"
 	"os"
 	"os/exec"
 	"reflect"
@@ -85,80 +84,58 @@ func TestWithCloneFlags(t *testing.T) {
 }
 
 func TestWithMultiTTY(t *testing.T) {
+	// openFn is part of the modifier signature but is no longer consulted by
+	// WithMultiTTY: TTY names are stashed in the command environment and the
+	// devices are opened later, in RunCommands. A stub keeps the call valid.
+	stubOpen := func([]string) ([]*os.File, error) { return nil, nil }
+
 	tests := []struct {
-		name      string
-		mtty      bool
-		openFn    func([]string) ([]*os.File, error)
-		ttyNames  []string
-		expectErr bool
+		name     string
+		mtty     bool
+		ttyNames []string
+		wantEnv  []string
 	}{
 		{
-			name: "MultiTTY enabled with no writers",
-			mtty: true,
-			openFn: func([]string) ([]*os.File, error) {
-				return []*os.File{}, nil
-			},
-			ttyNames:  nil,
-			expectErr: false,
-		},
-		{
-			name: "MultiTTY enabled with single writer",
-			mtty: true,
-			openFn: func([]string) ([]*os.File, error) {
-				return []*os.File{os.NewFile(0, "tty1")}, nil
-			},
-			ttyNames:  []string{"tty1"},
-			expectErr: false,
+			name:     "MultiTTY enabled with no TTY names",
+			mtty:     true,
+			ttyNames: nil,
+			wantEnv:  nil,
 		},
 		{
-			name: "MultiTTY enabled with multiple writers",
-			mtty: true,
-			openFn: func([]string) ([]*os.File, error) {
-				return []*os.File{os.NewFile(0, "tty1"), os.NewFile(0, "tty2")}, nil
-			},
-			ttyNames:  []string{"tty1", "tty2"},
-			expectErr: false,
+			name:     "MultiTTY enabled with single TTY",
+			mtty:     true,
+			ttyNames: []string{"tty1"},
+			wantEnv:  []string{"tty0=/dev/tty1"},
 		},
 		{
-			name: "MultiTTY enabled with openFn returning error",
-			mtty: true,
-			openFn: func([]string) ([]*os.File, error) {
-				return nil, errors.New("failed to open TTY devices")
-			},
-			ttyNames:  []string{"tty1"},
-			expectErr: true,
+			name:     "MultiTTY enabled with multiple TTYs",
+			mtty:     true,
+			ttyNames: []string{"tty1", "tty2"},
+			wantEnv:  []string{"tty0=/dev/tty1", "tty1=/dev/tty2"},
 		},
 		{
-			name: "MultiTTY disabled",
-			mtty: false,
-			openFn: func([]string) ([]*os.File, error) {
-				return []*os.File{os.NewFile(0, "tty1")}, nil
-			},
-			ttyNames:  []string{"tty1"},
-			expectErr: false,
+			name:     "MultiTTY disabled",
+			mtty:     false,
+			ttyNames: []string{"tty1"},
+			wantEnv:  nil,
 		},
 	}
 
 	for _, tt := range tests {
 		t.Run(tt.name, func(t *testing.T) {
 			cmd := exec.Command("echo", "test")
-			modifier := WithMultiTTY(tt.mtty, tt.openFn, tt.ttyNames)
+			cmd.Env = nil
+			modifier := WithMultiTTY(tt.mtty, stubOpen, tt.ttyNames)
 			modifier(cmd)
 
-			if tt.mtty {
-				if tt.expectErr {
-					if cmd.Stdout != nil || cmd.Stderr != nil {
-						t.Errorf("expected fallback to default stdout and stderr, got %v and %v", cmd.Stdout, cmd.Stderr)
-					}
-				} else {
-					if cmd.Stdout == nil || cmd.Stderr == nil {
-						t.Errorf("expected stdout and stderr to be set, got %v and %v", cmd.Stdout, cmd.Stderr)
-					}
-				}
-			} else {
-				if cmd.Stdout != nil || cmd.Stderr != nil {
-					t.Errorf("expected no writers to be set, got %v and %v", cmd.Stdout, cmd.Stderr)
-				}
+			if !reflect.DeepEqual(cmd.Env, tt.wantEnv) {
+				t.Errorf("cmd.Env = %v, want %v", cmd.Env, tt.wantEnv)
+			}
+
+			// WithMultiTTY must not touch the command's I/O streams; the PTY
+			// multiplexing wiring happens later, in RunCommands.
+			if cmd.Stdout != nil || cmd.Stderr != nil || cmd.Stdin != nil {
+				t.Errorf("expected I/O streams to be untouched, got stdin=%v stdout=%v stderr=%v", cmd.Stdin, cmd.Stdout, cmd.Stderr)
 			}
 		})
 	}
```

---

### Incident Patch 9: `839a4642` (2026-01-22)
**Commit Message**: init: fix early tty handling

Signed-off-by: Marvin Drees <[REDACTED_EMAIL]>

**File**: `pkg/libinit/root_linux.go` (modified, +43/-159)
```diff
@@ -21,8 +21,6 @@ import (
 	"github.com/u-root/u-root/pkg/cmdline"
 	"github.com/u-root/u-root/pkg/cp"
 	"github.com/u-root/u-root/pkg/kmodule"
-	"github.com/u-root/u-root/pkg/pty"
-	"github.com/u-root/u-root/pkg/termios"
 	"github.com/u-root/u-root/pkg/ulog"
 	"golang.org/x/sys/unix"
 )
@@ -439,39 +437,30 @@ func openTTYDevices(prefix string, names []string) ([]*os.File, error) {
 	return devs, nil
 }
 
-// RedirectOutputToConsoles sets up full PTY multiplexing for all console
-// devices specified in the kernel cmdline, then redirects init's FDs 0, 1, 2
-// to the PTY slave. This ensures all early messages (banner, logs) and input
-// go through the PTY multiplexer to all consoles, with proper raw mode handling.
+// RedirectOutputToConsoles sets up output multiplexing for all console
+// devices specified in the kernel cmdline. This ensures early messages
+// (banner, logs) appear on all consoles.
+//
+// This uses a simple approach: stdout/stderr are redirected to a MultiWriter
+// that writes to all consoles. stdin is left unchanged (reads from primary
+// console only). This avoids the complexity of PTY multiplexing which can
+// interfere with interactive programs.
 func RedirectOutputToConsoles() {
 	consoles := cmdline.Consoles()
 	if len(consoles) <= 1 {
 		// Only one or no console, nothing to do
 		return
 	}
 
-	// Build full paths
-	ttyPaths := make([]string, len(consoles))
-	for i, name := range consoles {
-		ttyPaths[i] = "/dev/" + name
-	}
-
-	// Open and configure all TTYs
+	// Open all TTYs for output
 	var ttys []*os.File
-	for _, ttyPath := range ttyPaths {
+	for _, name := range consoles {
+		ttyPath := "/dev/" + name
 		tty, err := os.OpenFile(ttyPath, os.O_RDWR, 0)
 		if err != nil {
 			ulog.KernelLog.Printf("Error opening TTY %v: %v", ttyPath, err)
 			continue
 		}
-
-		// Set to raw mode - critical for serial console to work properly
-		// Without raw mode, serial has line buffering, echo, and flow control
-		if err := termios.MakeRawFile(tty); err != nil {
-			ulog.KernelLog.Printf("Error setting TTY %v to raw mode: %v", ttyPath, err)
-			// Continue anyway - better to have non-raw than nothing
-		}
-
 		ttys = append(ttys, tty)
 	}
 
@@ -483,161 +472,56 @@ func RedirectOutputToConsoles() {
 		return
 	}
 
-	// Create PTY for init itself
-	ptmx, pts, err := pty.NewPTMS()
+	// Create MultiWriter for output to all consoles
+	writers := make([]io.Writer, len(ttys))
+	for i, tty := range ttys {
+		writers[i] = tty
+	}
+	multiWriter := io.MultiWriter(writers...)
+
+	// Create a pipe for stdout redirection
+	// We use a pipe so that writes to os.Stdout go through our multiplexer
+	stdoutR, stdoutW, err := os.Pipe()
 	if err != nil {
-		ulog.KernelLog.Printf("Error creating PTY for init: %v", err)
-		for _, tty := range ttys {
-			tty.Close()
-		}
+		ulog.KernelLog.Printf("Error creating stdout pipe: %v", err)
 		return
 	}
 
-	// Redirect FDs 0, 1, 2 to the PTY slave
-	// This makes the PTS the default stdin/stdout/stderr for init
-	if err := unix.Dup2(int(pts.Fd()), syscall.Stdin); err != nil {
-		ulog.KernelLog.Printf("Failed to dup2 stdin: %v", err)
+	// Create a pipe for stderr redirection
+	stderrR, stderrW, err := os.Pipe()
+	if err != nil {
+		ulog.KernelLog.Printf("Error creating stderr pipe: %v", err)
+		stdoutR.Close()
+		stdoutW.Close()
 		return
 	}
-	if err := unix.Dup2(int(pts.Fd()), syscall.Stdout); err != nil {
+
+	// Redirect stdout and stderr to the pipes
+	if err := unix.Dup2(int(stdoutW.Fd()), syscall.Stdout); err != nil {
 		ulog.KernelLog.Printf("Failed to dup2 stdout: %v", err)
 		return
 	}
-	if err := unix.Dup2(int(pts.Fd()), syscall.Stderr); err != nil {
+	if err := unix.Dup2(int(stderrW.Fd()), syscall.Stderr); err != nil {
 		ulog.KernelLog.Printf("Failed to dup2 stderr: %v", err)
 		return
 	}
 
-	// Update Go's os.Stdin/Stdout/Stderr to point to the new FDs
-	os.Stdin = os.NewFile(uintptr(syscall.Stdin), "/dev/stdin")
+	// Update Go's os.Stdout/Stderr to point to the new FDs
 	os.Stdout = os.NewFile(uintptr(syscall.Stdout), "/dev/stdout")
 	os.Stderr = os.NewFile(uintptr(syscall.Stderr), "/dev/stderr")
 	log.SetOutput(os.Stderr)
 
-	// We can close the original pts file descriptor since we've dup'd it
-	pts.Close()
-
-	// Create channel for clean shutdown (though init runs forever)
-	done := make(chan struct{})
-
-	// Create buffered channels for input from each TTY to prevent input loss
-	// due to goroutine scheduling. Direct io.Copy can lose characters.
-	inputChans := make([]chan []byte, len(ttys))
-	for i := range inputChans {
-		inputChans[i] = make(chan []byte, 1024)
-	}
+	// Close write ends after dup2 (the FDs are duplicated)
+	stdoutW.Close()
+	stderrW.Close()
 
-	// Read from each TTY into its buffered channel
-	for i, tty := range ttys {
-		t := tty // capture for goroutine
-		ch := inputChans[i]
-		go func() {
-			buf := make([]byte, 1024)
-			for {
-				select {
-				case <-done:
-					close(ch)
-					return
-				default:
-				}
-				n, err :
```

---

### Incident Patch 10: `4f73c6e6` (2026-01-09)
**Commit Message**: fix: setup full PTY multiplexing early for init's own I/O

This commit implements the full PTY setup early in init's main(),
making the PTY the default FDs for init itself (not just for child
commands). This ensures the banner and all early output go through
proper PTY multiplexing to all consoles.

Now init itself runs "inside" the PTY, with all I/O automatically
multiplexed to all consoles. Child processes inherit these FDs unless
they explicitly override them (like PTY-multiplexed commands do).

Signed-off-by: Marvin Drees <[REDACTED_EMAIL]>

**File**: `pkg/libinit/root_linux.go` (modified, +188/-15)
```diff
@@ -21,6 +21,8 @@ import (
 	"github.com/u-root/u-root/pkg/cmdline"
 	"github.com/u-root/u-root/pkg/cp"
 	"github.com/u-root/u-root/pkg/kmodule"
+	"github.com/u-root/u-root/pkg/pty"
+	"github.com/u-root/u-root/pkg/termios"
 	"github.com/u-root/u-root/pkg/ulog"
 	"golang.org/x/sys/unix"
 )
@@ -437,34 +439,205 @@ func openTTYDevices(prefix string, names []string) ([]*os.File, error) {
 	return devs, nil
 }
 
-// RedirectOutputToConsoles redirects os.Stdout and os.Stderr to all console
-// devices specified in the kernel cmdline, so early messages (like the banner)
-// appear on all consoles.
+// RedirectOutputToConsoles sets up full PTY multiplexing for all console
+// devices specified in the kernel cmdline, then redirects init's FDs 0, 1, 2
+// to the PTY slave. This ensures all early messages (banner, logs) and input
+// go through the PTY multiplexer to all consoles, with proper raw mode handling.
 func RedirectOutputToConsoles() {
 	consoles := cmdline.Consoles()
 	if len(consoles) <= 1 {
 		// Only one or no console, nothing to do
 		return
 	}
 
-	ttys, err := OpenTTYDevices(consoles)
-	if err != nil || len(ttys) <= 1 {
-		// Failed to open multiple consoles or only got one
+	// Build full paths
+	ttyPaths := make([]string, len(consoles))
+	for i, name := range consoles {
+		ttyPaths[i] = "/dev/" + name
+	}
+
+	// Open and configure all TTYs
+	var ttys []*os.File
+	for _, ttyPath := range ttyPaths {
+		tty, err := os.OpenFile(ttyPath, os.O_RDWR, 0)
+		if err != nil {
+			ulog.KernelLog.Printf("Error opening TTY %v: %v", ttyPath, err)
+			continue
+		}
+
+		// Set to raw mode - critical for serial console to work properly
+		// Without raw mode, serial has line buffering, echo, and flow control
+		if err := termios.MakeRawFile(tty); err != nil {
+			ulog.KernelLog.Printf("Error setting TTY %v to raw mode: %v", ttyPath, err)
+			// Continue anyway - better to have non-raw than nothing
+		}
+
+		ttys = append(ttys, tty)
+	}
+
+	if len(ttys) <= 1 {
+		// Failed to open multiple consoles
+		for _, tty := range ttys {
+			tty.Close()
+		}
 		return
 	}
 
-	// Create multi-writer for all consoles
-	writers := make([]io.Writer, len(ttys))
-	for i, tty := range ttys {
-		writers[i] = tty
+	// Create PTY for init itself
+	ptmx, pts, err := pty.NewPTMS()
+	if err != nil {
+		ulog.KernelLog.Printf("Error creating PTY for init: %v", err)
+		for _, tty := range ttys {
+			tty.Close()
+		}
+		return
+	}
+
+	// Redirect FDs 0, 1, 2 to the PTY slave
+	// This makes the PTS the default stdin/stdout/stderr for init
+	if err := unix.Dup2(int(pts.Fd()), syscall.Stdin); err != nil {
+		ulog.KernelLog.Printf("Failed to dup2 stdin: %v", err)
+		return
+	}
+	if err := unix.Dup2(int(pts.Fd()), syscall.Stdout); err != nil {
+		ulog.KernelLog.Printf("Failed to dup2 stdout: %v", err)
+		return
+	}
+	if err := unix.Dup2(int(pts.Fd()), syscall.Stderr); err != nil {
+		ulog.KernelLog.Printf("Failed to dup2 stderr: %v", err)
+		return
 	}
-	multiWriter := io.MultiWriter(writers...)
 
-	// Redirect stdout and stderr to all consoles
+	// Update Go's os.Stdin/Stdout/Stderr to point to the new FDs
+	os.Stdin = os.NewFile(uintptr(syscall.Stdin), "/dev/stdin")
 	os.Stdout = os.NewFile(uintptr(syscall.Stdout), "/dev/stdout")
 	os.Stderr = os.NewFile(uintptr(syscall.Stderr), "/dev/stderr")
+	log.SetOutput(os.Stderr)
+
+	// We can close the original pts file descriptor since we've dup'd it
+	pts.Close()
+
+	// Create channel for clean shutdown (though init runs forever)
+	done := make(chan struct{})
+
+	// Create buffered channels for input from each TTY to prevent input loss
+	// due to goroutine scheduling. Direct io.Copy can lose characters.
+	inputChans := make([]chan []byte, len(ttys))
+	for i := range inputChans {
+		inputChans[i] = make(chan []byte, 1024)
+	}
+
+	// Read from each TTY into its buffered channel
+	for i, tty := range ttys {
+		t := tty // capture for goroutine
+		ch := inputChans[i]
+		go func() {
+			buf := make([]byte, 1024)
+			for {
+				select {
+				case <-done:
+					close(ch)
+					return
+				default:
+				}
+				n, err := t.Read(buf)
+				if err != nil {
+					if err != io.EOF {
+						select {
+						case <-done:
+							// Shutting down, ignore error
+						default:
+							ulog.KernelLog.Printf("TTY read error: %v", err)
+						}
+					}
+					close(ch)
+					return
+				}
+				if n > 0 {
+					data := make([]byte, n)
+					copy(data, buf[:n])
+					select {
+					case ch <- data:
+					case <-done:
+						close(ch)
+						return
+					}
+				}
+			}
+		}()
+	}
+
+	// Multiplex input from all TTY channels to PTM
+	go func() {
+		for {
+			// Check if all channels are closed
+			var allClosed = true
+			for _, ch := range inputChans {
+				if ch != nil {
+					allClosed = false
+					break
+				}
+			}
+			if allClosed {
+				return
+			}
+
+			// Try to read from any available channel
+			for i, ch := range inputChans {
+				if ch == nil {
+					continue
+				}
+				select {
+				case data, ok := <-ch:
+					
```

---

### Incident Patch 11: `67c1fe36` (2026-01-08)
**Commit Message**: fix: improve PTY I/O multiplexing and add early console redirection

This commit fixes several issues with the multi-console TTY handling:

1. **Fixed PTY I/O multiplexing timing**: Removed defer cleanup that was
   happening too late (when function returns instead of when command exits).
   Now properly waits for command to exit before cleaning up resources.

2. **Improved output handling**: Use io.TeeReader for the common 2-TTY case.
   This ensures output is properly mirrored to all consoles without loss.

3. **Fixed command execution flow**: cmd.Start(), waiting, and cleanup now
   happen in the correct order within the multi-TTY block, with proper
   error handling and early cleanup if Start() fails.

4. **Added early console redirection**: New RedirectOutputToConsoles()
   function redirects log output to all consoles early in init, so the
   u-root banner and early messages appear on all configured consoles.

5. **Better input buffering**: Fixed channel send to respect done signal,
   preventing goroutine leaks.

Signed-off-by: Marvin Drees <[REDACTED_EMAIL]>

**File**: `cmds/core/init/init.go` (modified, +5/-0)
```diff
@@ -36,6 +36,11 @@ var (
 func main() {
 	flag.Parse()
 
+	// Redirect early output to all consoles if we have multiple consoles configured
+	if !*test {
+		libinit.RedirectOutputToConsoles()
+	}
+
 	log.Printf("Welcome to u-root!")
 	fmt.Println(`                              _`)
 	fmt.Println(`   _   _      _ __ ___   ___ | |_`)
```

**File**: `pkg/libinit/proc_linux.go` (modified, +94/-43)
```diff
@@ -149,7 +149,7 @@ func RunCommands(debug func(string, ...any), commands ...*exec.Cmd) int {
 				// Connect command to PTS
 				cmd.Stdin, cmd.Stdout, cmd.Stderr = pts, pts, pts
 
-				// Create channels for clean shutdown and input buffering
+				// Create channel for clean shutdown
 				done := make(chan struct{})
 
 				// Create buffered channels for input from each TTY to prevent input loss
@@ -188,16 +188,37 @@ func RunCommands(debug func(string, ...any), commands ...*exec.Cmd) int {
 							if n > 0 {
 								data := make([]byte, n)
 								copy(data, buf[:n])
-								ch <- data
+								select {
+								case ch <- data:
+								case <-done:
+									close(ch)
+									return
+								}
 							}
 						}
 					}()
 				}
 
-				// Multiplex input from all TTY channels to PTM
+				// Multiplex input from all TTY channels to PTM using blocking select
 				go func() {
 					for {
+						// Build select cases dynamically
+						var allClosed = true
+						for _, ch := range inputChans {
+							if ch != nil {
+								allClosed = false
+								break
+							}
+						}
+						if allClosed {
+							return
+						}
+
+						// Try to read from any available channel
 						for i, ch := range inputChans {
+							if ch == nil {
+								continue
+							}
 							select {
 							case data, ok := <-ch:
 								if !ok {
@@ -206,63 +227,93 @@ func RunCommands(debug func(string, ...any), commands ...*exec.Cmd) int {
 								}
 								ptmx.Write(data)
 							default:
-								// Non-blocking, check next channel
+								// Non-blocking per channel, but we'll loop
 							}
 						}
-
-						// Check if all channels are closed
-						allClosed := true
-						for _, ch := range inputChans {
-							if ch != nil {
-								allClosed = false
-								break
-							}
-						}
-						if allClosed {
-							return
-						}
 					}
 				}()
 
 				// Multiplex output: PTM → all TTYs (fan-out)
-				go func() {
-					buf := make([]byte, 1024)
-					for {
-						select {
-						case <-done:
-							return
-						default:
-						}
-						n, err := ptmx.Read(buf)
-						if err != nil {
-							if err != io.EOF {
-								select {
-								case <-done:
-									// Shutting down, ignore error
-								default:
-									debug("PTY read error: %v", err)
+				// Use io.Copy with TeeReader for efficiency like the shell tool
+				if len(ttys) == 2 {
+					// Optimize for the common case of 2 TTYs
+					go io.Copy(ttys[0], io.TeeReader(ptmx, ttys[1]))
+				} else {
+					// General case: fan out to all TTYs
+					go func() {
+						buf := make([]byte, 1024)
+						for {
+							select {
+							case <-done:
+								return
+							default:
+							}
+							n, err := ptmx.Read(buf)
+							if err != nil {
+								if err != io.EOF {
+									select {
+									case <-done:
+										// Shutting down, ignore error
+									default:
+										debug("PTY read error: %v", err)
+									}
 								}
+								return
 							}
-							return
-						}
-						if n > 0 {
-							// Fan out to all TTYs
-							for _, tty := range ttys {
-								tty.Write(buf[:n])
+							if n > 0 {
+								// Fan out to all TTYs
+								for _, tty := range ttys {
+									tty.Write(buf[:n])
+								}
 							}
 						}
-					}
-				}()
+					}()
+				}
 
-				// Clean up when command exits
-				defer func() {
+				// Clear tty environment variables and restore clean environment
+				cmd.Env = cleanEnv
+
+				if err := cmd.Start(); err != nil {
+					log.Printf("Error starting %v: %v", cmd, err)
+					// Clean up before continuing
 					close(done)
 					for _, tty := range ttys {
 						tty.Close()
 					}
 					ptmx.Close()
 					pts.Close()
-				}()
+					continue
+				}
+
+				// Wait for command and reap orphans
+				for {
+					var s unix.WaitStatus
+					var r unix.Rusage
+					if p, err := unix.Wait4(-1, &s, 0, &r); p == cmd.Process.Pid {
+						debug("Shell exited, exit status %d", s.ExitStatus())
+						break
+					} else if p != -1 {
+						debug("Reaped PID %d, exit status %d", p, s.ExitStatus())
+					} else {
+						debug("Error from Wait4 for orphaned child: %v", err)
+						break
+					}
+				}
+
+				// Clean up after command exits
+				close(done)
+				for _, tty := range ttys {
+					tty.Close()
+				}
+				ptmx.Close()
+				pts.Close()
+
+				if err := cmd.Process.Release(); err != nil {
+					log.Printf("Error releasing process %v: %v", cmd, err)
+				}
+
+				// We handled this command completely, continue to next
+				continue
 			}
 		} else {
 			// No multi-TTY, use default I/O
```

**File**: `pkg/libinit/root_freebsd.go` (modified, +4/-0)
```diff
@@ -237,6 +237,10 @@ func CreateRootfs() {
 	}
 }
 
+// RedirectOutputToConsoles is a no-op on FreeBSD. Multi-console output
+// multiplexing is only implemented for Linux.
+func RedirectOutputToConsoles() {}
+
 // InitModuleLoader wraps the resources we need for early module loading
 type InitModuleLoader struct {
 	Cmdline      *cmdline.CmdLine
```

**File**: `pkg/libinit/root_linux.go` (modified, +34/-0)
```diff
@@ -9,12 +9,14 @@ import (
 	"bufio"
 	"errors"
 	"fmt"
+	"io"
 	"log"
 	"os"
 	"path/filepath"
 	"runtime"
 	"strconv"
 	"strings"
+	"syscall"
 
 	"github.com/u-root/u-root/pkg/cmdline"
 	"github.com/u-root/u-root/pkg/cp"
@@ -434,3 +436,35 @@ func openTTYDevices(prefix string, names []string) ([]*os.File, error) {
 
 	return devs, nil
 }
+
+// RedirectOutputToConsoles redirects os.Stdout and os.Stderr to all console
+// devices specified in the kernel cmdline, so early messages (like the banner)
+// appear on all consoles.
+func RedirectOutputToConsoles() {
+	consoles := cmdline.Consoles()
+	if len(consoles) <= 1 {
+		// Only one or no console, nothing to do
+		return
+	}
+
+	ttys, err := OpenTTYDevices(consoles)
+	if err != nil || len(ttys) <= 1 {
+		// Failed to open multiple consoles or only got one
+		return
+	}
+
+	// Create multi-writer for all consoles
+	writers := make([]io.Writer, len(ttys))
+	for i, tty := range ttys {
+		writers[i] = tty
+	}
+	multiWriter := io.MultiWriter(writers...)
+
+	// Redirect stdout and stderr to all consoles
+	os.Stdout = os.NewFile(uintptr(syscall.Stdout), "/dev/stdout")
+	os.Stderr = os.NewFile(uintptr(syscall.Stderr), "/dev/stderr")
+
+	// Note: We can't directly replace os.Stdout/Stderr, but we can
+	// set log output to go to all consoles
+	log.SetOutput(multiWriter)
+}
```

**File**: `pkg/libinit/root_plan9.go` (modified, +4/-0)
```diff
@@ -88,3 +88,7 @@ func SetEnv() {
 // CreateRootfs creates the default u-root file system.
 func CreateRootfs() {
 }
+
+// RedirectOutputToConsoles is a no-op on Plan 9. Multi-console output
+// multiplexing is only implemented for Linux.
+func RedirectOutputToConsoles() {}
```

---

### Incident Patch 12: `f6853127` (2026-01-08)
**Commit Message**: fix: properly multiplex TTY I/O through PTY with raw mode

This commit fixes the multi-console TTY handling to properly multiplex
I/O between multiple TTYs (extracted from kernel cmdline console= params)
and the shell through a PTY.

Signed-off-by: Marvin Drees <[REDACTED_EMAIL]>

**File**: `pkg/libinit/proc_linux.go` (modified, +162/-57)
```diff
@@ -48,29 +48,12 @@ func WithTTYControl(ctty bool) CommandModifier {
 
 func WithMultiTTY(mtty bool, openFn func([]string) ([]*os.File, error), ttyNames []string) CommandModifier {
 	return func(c *exec.Cmd) {
-		if mtty {
-			ww, err := openFn(ttyNames)
-			if err != nil {
-				return
-			}
-
-			switch len(ww) {
-			case 0:
-				c.Stdout, c.Stderr = os.Stdout, os.Stderr
-			case 1:
-				c.Stdout, c.Stderr = ww[0], ww[0]
-			default:
-				writers := make([]io.Writer, len(ww))
-				for i, w := range ww {
-					writers[i] = w
-				}
-				c.Stdout = io.MultiWriter(writers...)
-				c.Stderr = io.MultiWriter(writers...)
-
-				// Save this for later use
-				for i := 0; i < len(ww); i++ {
-					c.Env = append(c.Env, fmt.Sprintf("tty%d=%s", i, ww[i].Name()))
-				}
+		if mtty && len(ttyNames) > 0 {
+			// Save tty names for later use in RunCommands
+			// We don't open them here because we need to set them to raw mode
+			// and multiplex I/O through a PTY
+			for i, name := range ttyNames {
+				c.Env = append(c.Env, fmt.Sprintf("tty%d=/dev/%s", i, name))
 			}
 		}
 	}
@@ -114,65 +97,187 @@ func RunCommands(debug func(string, ...any), commands ...*exec.Cmd) int {
 		cmdCount++
 		debug("Trying to run %v", cmd)
 
-		// Set up PTM
-		m, s, err := pty.NewPTMS()
-		if err != nil {
-			debug("Error getting PTY: %v", err)
-			return 0
+		// Collect TTY names from environment
+		var ttyNames []string
+		var cleanEnv []string
+		for _, envVar := range cmd.Env {
+			if strings.HasPrefix(envVar, "tty") && strings.Contains(envVar, "=") {
+				parts := strings.SplitN(envVar, "=", 2)
+				if len(parts) == 2 {
+					ttyNames = append(ttyNames, parts[1])
+				}
+			} else {
+				cleanEnv = append(cleanEnv, envVar)
+			}
 		}
 
-		cmd.Stdin = s
+		// If we have TTYs from kernel cmdline, use PTY multiplexing like the shell tool
+		if len(ttyNames) > 0 {
+			debug("Setting up multi-TTY with %v", ttyNames)
+
+			// Open and configure all TTYs
+			var ttys []*os.File
+			for _, ttyName := range ttyNames {
+				debug("Opening TTY %v", ttyName)
+				tty, err := os.OpenFile(ttyName, os.O_RDWR, 0)
+				if err != nil {
+					debug("Error opening TTY %v: %v", ttyName, err)
+					continue
+				}
 
-		// Launch go routine to copy output from the command to the PTM
-		for _, r := range cmd.Env {
-			if strings.HasPrefix(r, "tty") {
-				tty := strings.Split(r, "=")[1]
+				// Set to raw mode - critical for serial console to work properly
+				// Without raw mode, serial has line buffering, echo, and flow control
+				if err := termios.MakeRawFile(tty); err != nil {
+					debug("Error setting TTY %v to raw mode: %v", ttyName, err)
+					// Continue anyway - better to have non-raw than nothing
+				}
 
-				debug("Opening TTY %v", tty)
+				ttys = append(ttys, tty)
+			}
 
-				// Open the TTY
-				t, err := os.OpenFile(tty, os.O_RDWR, 0)
+			if len(ttys) == 0 {
+				debug("No TTYs could be opened, falling back to default")
+				cmd.Stdin, cmd.Stdout, cmd.Stderr = os.Stdin, os.Stdout, os.Stderr
+			} else {
+				// Create PTY for the command
+				ptmx, pts, err := pty.NewPTMS()
 				if err != nil {
-					debug("Error opening TTY: %v", err)
-					continue
+					debug("Error creating PTY: %v", err)
+					return 0
 				}
 
-				// Set to Raw mode
-				if err := termios.MakeRawFile(t); err != nil {
-					// Let's still continue if we can't set the TTY to raw mode
-					debug("Error setting TTY to raw mode: %v", err)
+				// Connect command to PTS
+				cmd.Stdin, cmd.Stdout, cmd.Stderr = pts, pts, pts
+
+				// Create channels for clean shutdown and input buffering
+				done := make(chan struct{})
+
+				// Create buffered channels for input from each TTY to prevent input loss
+				// due to goroutine scheduling. Direct io.Copy can lose characters.
+				inputChans := make([]chan []byte, len(ttys))
+				for i := range inputChans {
+					inputChans[i] = make(chan []byte, 1024)
 				}
 
+				// Read from each TTY into its buffered channel
+				for i, tty := range ttys {
+					t := tty // capture for goroutine
+					ch := inputChans[i]
+					go func() {
+						buf := make([]byte, 1024)
+						for {
+							select {
+							case <-done:
+								close(ch)
+								return
+							default:
+							}
+							n, err := t.Read(buf)
+							if err != nil {
+								if err != io.EOF {
+									select {
+									case <-done:
+										// Shutting down, ignore error
+									default:
+										debug("TTY read error: %v", err)
+									}
+								}
+								close(ch)
+								return
+							}
+							if n > 0 {
+								data := make([]byte, n)
+								copy(data, buf[:n])
+								ch <- data
+							}
+						}
+					}()
+				}
+
+				// Multiplex input from all TTY channels to PTM
 				go func() {
 					for {
-						if _, err := io.Copy(m, t); err != nil {
-							debug("Error copying output from command to PTM: %v", err)
+						for i, ch := range inputChans {
+							select {
+							case data, ok := <-ch:
+								if !ok {
+									inputChans[i] = nil
```

---

### Incident Patch 13: `ac3ffe61` (2025-03-02)
**Commit Message**: fix: clean up libinit code

Signed-off-by: Christian Walter <[REDACTED_EMAIL]>

**File**: `pkg/libinit/proc_linux.go` (modified, +6/-10)
```diff
@@ -53,8 +53,6 @@ func WithMultiTTY(mtty bool, openFn func([]string) ([]*os.File, error), ttyNames
 		if mtty {
 			ww, err := openFn(ttyNames)
 			if err != nil {
-				log.Printf("%q: open devices for multi-TTY output: %v", c.Path, err)
-				log.Printf("falling back to default stdout and stderr")
 				return
 			}
 
@@ -167,7 +165,7 @@ func RunCommands(debug func(string, ...any), commands ...*exec.Cmd) int {
 		// Set up PTM
 		m, s, err := NewPTMS()
 		if err != nil {
-			log.Printf("Error getting PTY: %v", err)
+			debug("Error getting PTY: %v", err)
 			return 0
 		}
 
@@ -183,20 +181,19 @@ func RunCommands(debug func(string, ...any), commands ...*exec.Cmd) int {
 				// Open the TTY
 				t, err := os.OpenFile(tty, os.O_RDWR, 0)
 				if err != nil {
-					log.Printf("Error opening TTY: %v", err)
+					debug("Error opening TTY: %v", err)
 					continue
 				}
 
 				// Set to Raw mode
 				if err := Raw(t); err != nil {
 					// Let's still continue if we can't set the TTY to raw mode
-					log.Printf("Error setting TTY to raw mode: %v", err)
+					debug("Error setting TTY to raw mode: %v", err)
 				}
 
 				go func() {
 					for {
-						_, err := io.Copy(m, t)
-						if err != nil {
+						if _, err := io.Copy(m, t); err != nil {
 							log.Printf("Error copying output from command to PTM: %v", err)
 						}
 					}
@@ -246,7 +243,7 @@ func RunCommands(debug func(string, ...any), commands ...*exec.Cmd) int {
 
 // This comes from the pty package
 func ioctl(f *os.File, cmd, ptr uintptr) error {
-	return ioctlInner(f.Fd(), cmd, ptr) // Fall back to blocking io.
+	return ioctlInner(f.Fd(), cmd, ptr)
 }
 
 func ioctlInner(fd, cmd, ptr uintptr) error {
@@ -259,8 +256,7 @@ func ioctlInner(fd, cmd, ptr uintptr) error {
 
 func ptsname(f *os.File) (string, error) {
 	var n uint32
-	err := ioctl(f, syscall.TIOCGPTN, uintptr(unsafe.Pointer(&n))) //nolint:gosec // Expected unsafe pointer for Syscall call.
-	if err != nil {
+	if err := ioctl(f, syscall.TIOCGPTN, uintptr(unsafe.Pointer(&n))); err != nil {
 		return "", err
 	}
 	return "/dev/pts/" + strconv.Itoa(int(n)), nil
```

---

### Incident Patch 14: `69afda73` (2026-09-06)
**Commit Message**: pkg/dt: fix AsStringList loop

Signed-off-by: Luka Perkov <[REDACTED_EMAIL]>

**File**: `pkg/dt/node.go` (modified, +1/-1)
```diff
@@ -426,7 +426,7 @@ func (p *Property) AsStringList() ([]string, error) {
 	}
 	value := p.Value
 	strs := []string{}
-	for len(p.Value) > 0 {
+	for len(value) > 0 {
 		nextNull := bytes.IndexByte(value, 0) // cannot be -1
 		var str []byte
 		str, value = value[:nextNull], value[nextNull+1:]
```

**File**: `pkg/dt/node_test.go` (modified, +13/-0)
```diff
@@ -7,6 +7,7 @@ package dt
 import (
 	"errors"
 	"reflect"
+	"slices"
 	"testing"
 )
 
@@ -419,6 +420,18 @@ func TestUpdateProperty(t *testing.T) {
 	}
 }
 
+func TestAsStringList(t *testing.T) {
+	p := &Property{Name: "dns", Value: []byte("a\x00b\x00c\x00")}
+	got, err := p.AsStringList()
+	if err != nil {
+		t.Fatalf("p.AsStringList() returned error: %v", err)
+	}
+	want := []string{"a", "b", "c"}
+	if !slices.Equal(got, want) {
+		t.Errorf("p.AsStringList() = %q, want %q", got, want)
+	}
+}
+
 func TestAsRegion(t *testing.T) {
 	for _, tc := range []struct {
 		name    string
```

---

### Incident Patch 15: `9c4191fe` (2026-09-02)
**Commit Message**: build(deps-dev): bump browserslist from 4.22.2 to 4.28.8 in /website

Bumps [browserslist](https://github.com/browserslist/browserslist) from 4.22.2 to 4.28.8.
- [Release notes](https://github.com/browserslist/browserslist/releases)
- [Changelog](https://github.com/browserslist/browserslist/blob/main/CHANGELOG.md)
- [Commits](https://github.com/browserslist/browserslist/compare/4.22.2...4.28.8)

---
updated-dependencies:
- dependency-name: browserslist
  dependency-version: 4.28.8
  dependency-type: indirect
...

Signed-off-by: dependabot[bot] <[REDACTED_EMAIL]>

**File**: `website/package-lock.json` (modified, +54/-30)
```diff
@@ -2641,6 +2641,19 @@
         }
       ]
     },
+    "node_modules/baseline-browser-mapping": {
+      "version": "2.11.20",
+      "resolved": "https://registry.npmjs.org/baseline-browser-mapping/-/baseline-browser-mapping-2.11.20.tgz",
+      "integrity": "sha512-H0ulySigv6icDJ1F7SjtdCD6PrhTpdYCmP0CactWy1+ekh0AFd0o1Wn5T8b+hnTmdBx19u9yhL6wvCylXMY7zw==",
+      "dev": true,
+      "license": "Apache-2.0",
+      "bin": {
+        "baseline-browser-mapping": "dist/cli.cjs"
+      },
+      "engines": {
+        "node": ">=6.0.0"
+      }
+    },
     "node_modules/bcp-47": {
       "version": "1.0.8",
       "resolved": "https://registry.npmjs.org/bcp-47/-/bcp-47-1.0.8.tgz",
@@ -2745,9 +2758,9 @@
       }
     },
     "node_modules/browserslist": {
-      "version": "4.22.2",
-      "resolved": "https://registry.npmjs.org/browserslist/-/browserslist-4.22.2.tgz",
-      "integrity": "sha512-0UgcrvQmBDvZHFGdYUehrCNIazki7/lUP3kkoi/r3YB2amZbFM9J43ZRkJTXBUZK4gmx56+Sqk9+Vs9mwZx9+A==",
+      "version": "4.28.8",
+      "resolved": "https://registry.npmjs.org/browserslist/-/browserslist-4.28.8.tgz",
+      "integrity": "sha512-V2NpofLblG64mfOtSgDhOJESZEGogzDMBv/q+W6oc4LXWP/q75eOXoOaaOu1EOadB9U4Bwx/e0yzbvwKH8zalA==",
       "dev": true,
       "funding": [
         {
@@ -2763,11 +2776,13 @@
           "url": "https://github.com/sponsors/ai"
         }
       ],
+      "license": "MIT",
       "dependencies": {
-        "caniuse-lite": "^1.0.30001565",
-        "electron-to-chromium": "^1.4.601",
-        "node-releases": "^2.0.14",
-        "update-browserslist-db": "^1.0.13"
+        "baseline-browser-mapping": "^2.11.12",
+        "caniuse-lite": "^1.0.30001809",
+        "electron-to-chromium": "^1.5.402",
+        "node-releases": "^2.0.53",
+        "update-browserslist-db": "^1.3.0"
       },
       "bin": {
         "browserslist": "cli.js"
@@ -2835,9 +2850,9 @@
       }
     },
     "node_modules/caniuse-lite": {
-      "version": "1.0.30001566",
-      "resolved": "https://registry.npmjs.org/caniuse-lite/-/caniuse-lite-1.0.30001566.tgz",
-      "integrity": "sha512-ggIhCsTxmITBAMmK8yZjEhCO5/47jKXPu6Dha/wuCS4JePVL+3uiDEBuhu2aIoT+bqTOR8L76Ip1ARL9xYsEJA==",
+      "version": "1.0.30001810",
+      "resolved": "https://registry.npmjs.org/caniuse-lite/-/caniuse-lite-1.0.30001810.tgz",
+      "integrity": "sha512-TITQPUkaz+aVk5GL6NhOdwk1aEaNTSDPsGFWrTuhKGtjTF70jL/Oht2W4c6rXUe5fu7Ie19VIahAXHIIiWWNeg==",
       "dev": true,
       "funding": [
         {
@@ -2852,7 +2867,8 @@
           "type": "github",
           "url": "https://github.com/sponsors/ai"
         }
-      ]
+      ],
+      "license": "CC-BY-4.0"
     },
     "node_modules/chalk": {
       "version": "4.1.2",
@@ -3520,10 +3536,11 @@
       }
     },
     "node_modules/electron-to-chromium": {
-      "version": "1.4.605",
-      "resolved": "https://registry.npmjs.org/electron-to-chromium/-/electron-to-chromium-1.4.605.tgz",
-      "integrity": "sha512-V52j+P5z6cdRqTjPR/bYNxx7ETCHIkm5VIGuyCy3CMrfSnbEpIlLnk5oHmZo7gYvDfh2TfHeanB6rawyQ23ktg==",
-      "dev": true
+      "version": "1.5.420",
+      "resolved": "https://registry.npmjs.org/electron-to-chromium/-/electron-to-chromium-1.5.420.tgz",
+      "integrity": "sha512-2yD6XreGusOfNV+dUcvipJEXc3n/n7fgr7996aszTG+YY5E4mqM4tOq/3uhP129cazL9YHbVWSpc79ePotWtPA==",
+      "dev": true,
+      "license": "ISC"
     },
     "node_modules/eleventy-plugin-svg-sprite": {
       "version": "2.4.2",
@@ -4066,9 +4083,10 @@
       }
     },
     "node_modules/escalade": {
-      "version": "3.1.1",
-      "resolved": "https://registry.npmjs.org/escalade/-/escalade-3.1.1.tgz",
-      "integrity": "sha512-k0er2gUkLf8O0zKJiAhmkTnJlTvINGv7ygDNPbeIsX/TJjGJZHuh9B2UxbsaEkmlEo9MfhrSzmhIlhRlI2GXnw==",
+      "version": "3.2.0",
+      "resolved": "https://registry.npmjs.org/escalade/-/escalade-3.2.0.tgz",
+      "integrity": "sha512-WUj2qlxaQtO4g6Pq5c29GTcWGDyd8itL8zTlipgECz3JesAiiOKotd8JU6otB3PACgG6xkJUyVhboMS+bje/jA==",
+      "license": "MIT",
       "engines": {
         "node": ">=6"
       }
@@ -5467,10 +5485,14 @@
       }
     },
     "node_modules/node-releases": {
-      "version": "2.0.14",
-      "resolved": "https://registry.npmjs.org/node-releases/-/node-releases-2.0.14.tgz",
-      "integrity": "sha512-y10wOWt8yZpqXmOgRo77WaHEmhYQYGNA6y421PKsKYWEK8aW+cqAphborZDhqfyKrbZEN92CN1X2KbafY2s7Yw==",
-      "dev": true
+      "version": "2.0.54",
+      "resolved": "https://registry.npmjs.org/node-releases/-/node-releases-2.0.54.tgz",
+      "integrity": "sha512-YHs7BmmcsdAI5Ozuf8JZo6PT0mv2GIWC9vMfvUC3dp65M8hn7Ux8CPL+2oBI7juNuj9d0ndhTcznq2ODBps9cQ==",
+      "dev": true,
+      "license": "MIT",
+      "engines": {
+        "node": ">=18"
+      }
     },
     "node_modules/normalize-path": {
       "version": "3.0.0",
@@ -5691,9 +5713,10 @@
       "integrity": "sha512-Yhpw4T9C6hPpgPeA28us07OJeqZ5EzQTkbfwuhsUg0c237RomFoETJgmp2sa3F/41gfLE6G5cqcYwznmeEeOlQ=="
     },
     "node_modules/picocolors": {
-      "version":
```

#### Recent Merged Pull Requests:
- **PR #3778** (2026-10-05): cmds/core/timeout: replace errors.As with AsType (@binjip978)
- **PR #3771** (closed): Accept Linux B0 baud rate in termios (@Copilot)
- **PR #3770** (2026-10-02): resolve issues with termios package to fix 'stty speed xxyyzz' (@rminnich)
- **PR #3768** (closed): Fixup bug in smbios table parsing for 64-bit tables (@pstrinkle)
- **PR #3766** (closed): smbios: terminate ParseInfo loop on TableTypeEndOfTable (@pstrinkle)
- **PR #3764** (closed): build(deps): bump markdown-it from 12.3.2 to 14.3.1 in /website (@dependabot[bot])
- **PR #3763** (2026-09-28): ci: ignore slattach for tinygo (@MDr164)
- **PR #3762** (2026-09-30): integration: attach socket NICs with -netdev/-device (@alanhc)

---

## 3. Empirical Evidence & Compliance Certification
- **Evidence Provenance**: Fetched directly from verified official GitHub REST API.
- **Zero Disk Footprint**: 0 bytes of unnecessary repository bloat stored locally.
- **TOS & Free-Tier Adherence**: Request pace complied with public API guidelines without fee, penalty, or unauthorized scraping.

---

## 4. Promotion & Integration Status
- **Status**: HARVESTED_DEEP_FORENSIC
- **Master Brain Sync**: Auto-committed to local/remote Master Brain repository.
