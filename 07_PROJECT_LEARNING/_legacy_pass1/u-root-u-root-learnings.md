# Forensic Learning Record (Deep Inspection): u-root/u-root

> **Canonical Artifact**: `07_PROJECT_LEARNING/u-root-u-root-learnings.md`  
> **Source Platform**: GitHub ([https://github.com/u-root/u-root](https://github.com/u-root/u-root))  
> **Harvest Method**: Full-Spectrum Deep Extraction (Patches, Diffs, Source Code, Post-Mortems)  
> **Harvest Timestamp**: 2026-09-30T18:26:22.342Z  
> **Compliance State**: Free Tier Guaranteed | Strict Rate-Limit Backoff Honored  

---

## 1. Context & Architectural Overview
- **Repository / Resource**: `u-root/u-root`
- **Description**: A fully Go userland with Linux bootloaders! u-root can create a one-binary root file system (initramfs) containing a busybox-like set of tools written in Go.
- **Primary Language / Ecosystem**: Go
- **Discovered Manifests / Configurations**: go.mod, README.md
- **Stars / Engagement**: 3077 stars

---

## 2. Multi-Dimensional 8-Axis Investigation & Real Code Patches

### D1: Architecture & Structural Boundaries
- Entry configurations inspected via direct stream: go.mod, README.md.
- Evaluated system abstractions and modular contracts.

### Core Architecture Module: `cmds/boot/boot/boot_linux.go`
```
// Copyright 2012-2020 the u-root Authors. All rights reserved
// Use of this source code is governed by a BSD-style
// license that can be found in the LICENSE file.

//go:build !tinygo || tinygo.enable

// Command boot allows to handover a system running linuxboot/u-root
// to a legacy preinstalled operating system by replacing the traditional
// bootloader path
//
// Synopsis:
//
//	boot [-v][-no-load][-no-exec]
//
// Description:
//
//	If returns to u-root shell, the code didn't found a local bootable option
//
//	-v prints messages
//	-no-load prints the boot image paths it was going to load, but doesn't load + exec them
//	-no-exec loads the boot image, but doesn't exec it
//
// Notes:
//
//	The code is looking for boot/grub/grub.cfg file as to identify the
//	boot option.
//	The first bootable device found in the block device tree is the one used
//	Windows is not supported (that is a work in progress)
//
// Example:
//
//	boot -v - Start the script in verbose mode for debugging purpose
package main

import (
	"flag"
	"log"
	"strings"

	"github.com/u-root/u-root/pkg/boot"
	"github.com/u-root/u-root/pkg/boot/bootcmd"
	"github.com/u-root/u-root/pkg/boot/localboot"
	"github.com/u-root/u-root/pkg/boot/menu"
	"github.com/u-root/u-root/pkg/cmdline"
	"github.com/u-root/u-root/pkg/mount"
	"github.com/u-root/u-root/pkg/mount/block"
	"github.com/u-root/u-root/pkg/ulog"
)

var (
	verbose = flag.Bool("v", false, "Print debug messages")
	noLoad  = flag.Bool("no-load", false, "print chosen boot configuration, but do not load + exec it")
	noExec  = flag.Bool("no-exec", false, "load boot configuration, but do not exec it")

	removeCmdlineItem = flag.String("remove", "console", "comma separated list of kernel params value to remove from parsed kernel configuration (default to console)")
	reuseCmdlineItem  = flag.String("reuse", "console", "comma separated list of kernel params value to reuse from current kernel (default to console)")
	appendCmdline     = flag.String("append", "", "Additional kernel params")
	blockList         = flag.String("block", "", "comma separated list of pci vendor and device ids to ignore (format vendor:device). E.g. 0x8086:0x1234,0x8086:0xabcd")
)

// updateBootCmdline get the kernel command line parameters and filter it:
// it removes parameters listed in 'remove' and append extra parameters from
// the 'append' and 'reuse' flags
func cmdlineModifier(li *boot.LinuxImage) {
	f := cmdline.NewUpdateFilter(*appendCmdline, strings.Split(*removeCmdlineItem, ","), strings.Split(*reuseCmdlineItem, ","))
	li.Cmdline = f.Update(cmdline.NewCmdLine(), li.Cmdline)
}

func main() {
	flag.Parse()

	if *verbose {
		block.Debug = log.Printf
	}
	blockDevs, err := block.GetBlockDevices()
	if err != nil {
		log.Fatal("No available block devices to boot from")
	}

	// Try to only boot from "good" block devices.
	blockDevs = blockDevs.FilterZeroSize()

	// Parse and filter blocklist
	if *blockList != "" {
		blockDevs, err = blockDevs.FilterBlockPCIString(*blockList)
		if err != nil {
			log.Fatal(err)
		}
	}

	log.Printf("Booting from the following block devices: %v", blockDevs)

	l := ulog.Null
	if *verbose {
		l = ulog.Log
	}
	mountPool := &mount.Pool{}
	images, err := localboot.Localboot(l, blockDevs, mountPool)
	if err != nil {
		log.Fatal(err)
	}
	// Make changes to the kernel command line based on our cmdline.
	boot.ApplyLinuxModifiers(images, cmdlineModifier)

	menuEntries := menu.OSImages(*verbose, images...)
	menuEntries = append(menuEntries, menu.Reboot{})
	menuEntries = append(menuEntries, menu.StartShell{})

	// Boot does not return.
	bootcmd.ShowMenuAndBoot(menuEntries, mountPool, *noLoad, *noExec)
}

```

### Core Architecture Module: `cmds/boot/fitboot/main_linux.go`
```
// Copyright 2017-2019 the u-root Authors. All rights reserved
// Use of this source code is governed by a BSD-style
// license that can be found in the LICENSE file.
//go:build !tinygo || tinygo.enable

package main

import (
	"flag"
	"fmt"
	"log"
	"os"

	"github.com/u-root/u-root/pkg/acpi"
	"github.com/u-root/u-root/pkg/boot"
	"github.com/u-root/u-root/pkg/boot/fit"
	"github.com/u-root/u-root/pkg/vfile"
)

var (
	dryRun     = flag.Bool("dryrun", false, "Do not actually kexec into the boot config")
	debug      = flag.Bool("d", false, "Print debug output")
	cmdline    = flag.String("c", "earlyprintk=ttyS0,115200,keep console=ttyS0", "command line")
	config     = flag.String("config", "", "FIT configuration to use")
	kernel     = flag.String("k", "", "Kernel image node name.")
	initramfs  = flag.String("i", "", "InitRAMFS node name -- default none")
	ringPath   = flag.String("r", "", "Path to PGP keyring. Enforces signature if non-empty path")
	rsdpLookup = flag.Bool("rsdp", false, "Derrive RSDP table pointer from environment")
)

var v = func(string, ...any) {}

func main() {
	flag.Parse()

	if *debug {
		v = log.Printf
	}

	if len(flag.Args()) != 1 {
		log.Fatal("Usage: fitboot <file>")
	}
	f, err := fit.New(flag.Args()[0])
	if err != nil {
		log.Fatal(err)
	}

	f.Cmdline, f.Kernel, f.InitRAMFS, f.ConfigOverride = *cmdline, *kernel, *initramfs, *config

	kn, in, err := f.LoadConfig()
	if err == nil {
		f.Kernel, f.InitRAMFS = kn, in
	} else {
		v("Configuration is not available: %v", err)
	}

	if f.Kernel == "" {
		log.Fatal("kernel name is not found in fit configuration or pass through -k.")
	}

	v("Kernel name=%s, initramfs=%s", f.Kernel, f.InitRAMFS)

	kernelCmd := *cmdline
	if *rsdpLookup {
		r, err := acpi.GetRSDP()
		if err != nil {
			log.Fatal("Unable to find acpi table in the environment.")
		}
		v("Found an RSDP at %#x", r.RSDPAddr())
		kernelCmd = fmt.Sprintf("acpi_rsdp=%x %s", r.RSDPAddr(), kernelCmd)
	}

	f.Cmdline = kernelCmd

	if *ringPath != "" {
		ring, err := vfile.GetKeyRing(*ringPath)
		if err != nil {
			log.Fatal(err)
		}
		f.KeyRing = ring
	}

	if err := f.Load(boot.WithVerbose(*debug)); err != nil {
		log.Fatal(err)
	}

	if *dryRun {
		v("Not trying to boot since this is a dry run")
		os.Exit(0)
	}

	if err := boot.Execute(); err != nil {
		log.Fatal(err)
	}
}

```

### Core Architecture Module: `cmds/boot/pxeboot/pxeboot_linux.go`
```
// Copyright 2017-2018 the u-root Authors. All rights reserved
// Use of this source code is governed by a BSD-style
// license that can be found in the LICENSE file.

//go:build !tinygo || tinygo.enable

// Command pxeboot implements PXE-based booting.
//
// pxeboot combines a DHCP client with a TFTP/HTTP client to download files as
// well as pxelinux and iPXE configuration file parsing.
//
// PXE-based booting requests a DHCP lease, and looks at the BootFileName and
// ServerName options (which may be embedded in the original BOOTP message, or
// as option codes) to find something to boot.
//
// This BootFileName may point to:
//
// - an iPXE script beginning with #!ipxe
//
//   - a pxelinux.0, in which case we will ignore the pxelinux and try to parse
//     pxelinux.cfg/<files>
package main

import (
	"context"
	"flag"
	"fmt"
	"log"
	"net"
	"strings"
	"time"

	"github.com/u-root/u-root/pkg/boot"
	"github.com/u-root/u-root/pkg/boot/bootcmd"
	"github.com/u-root/u-root/pkg/boot/menu"
	"github.com/u-root/u-root/pkg/boot/netboot"
	"github.com/u-root/u-root/pkg/curl"
	"github.com/u-root/u-root/pkg/dhclient"
	"github.com/u-root/u-root/pkg/sh"
	"github.com/u-root/u-root/pkg/ulog"

	"github.com/insomniacslk/dhcp/dhcpv4"
)

var (
	ifName      = "^e.*"
	noLoad      = flag.Bool("no-load", false, "get DHCP response, print chosen boot configuration, but do not download + exec it")
	noExec      = flag.Bool("no-exec", false, "download boot configuration, but do not exec it")
	noNetConfig = flag.Bool("no-net-config", false, "get DHCP response, but do not apply the network config it to the kernel interface")
	skipBonded  = flag.Bool("skip-bonded", false, "Skip NICs that have already been added to a bond")
	verbose     = flag.Bool("v", false, "Verbose output")
	ipv4        = flag.Bool("ipv4", true, "use IPV4")
	ipv6        = flag.Bool("ipv6", true, "use IPV6")
	cmdAppend   = flag.String("cmd", "", "Kernel command to append for each image")
	bootfile    = flag.String("file", "", "Boot file name (default tftp) or full URI to use instead of DHCP.")
	server      = flag.String("server", "0.0.0.0", "Server IP (Requires -file for effect)")
)

const (
	dhcpTimeout = 5 * time.Second
	dhcpTries   = 3
)

// NetbootImages requests DHCP on every ifaceNames interface, and parses
// netboot images from the DHCP leases. Returns bootable OSes.
func NetbootImages(ifaceNames string) ([]boot.OSImage, error) {
	filteredIfs, err := dhclient.Interfaces(ifaceNames)
	if err != nil {
		return nil, err
	}

	if *skipBonded {
		filteredIfs = dhclient.FilterBondedInterfaces(filteredIfs, *verbose)
	}

	ctx, cancel := context.WithTimeout(context.Background(), (1<<dhcpTries)*dhcpTimeout)
	defer cancel()

	c := dhclient.Config{
		Timeout: dhcpTimeout,
		Retries: dhcpTries,
	}
	if *verbose {
		c.LogLevel = dhclient.LogSummary
	}
	r := dhclient.SendRequests(ctx, filteredIfs, *ipv4, *ipv6, c, 30*time.Second)

	for {
		select {
		case <-ctx.Done():
			return nil, ctx.Err()

		case result, ok := <-r:
			if !ok {
				return nil, fmt.Errorf("nothing bootable found, all interfaces are configured or timed out")
			}
			iname := result.Interface.Attrs().Name
			if result.Err != nil {
				log.Printf("Could not configure %s for %s: %v", iname, result.Protocol, result.Err)
				continue
			}

			if *noNetConfig {
				log.Printf("Skipping configuring %s with lease %s", iname, result.Lease)
			} else if err := result.Lease.Configure(); err != nil {
				log.Printf("Failed to configure lease %s: %v", result.Lease, err)
				// Boot further regardless of lease configuration result.
				//
				// If lease failed, fall back to use locally configured
				// ip/ipv6 address.
			}

			// Don't use the other context, as it's for the DHCP timeout.
			imgs, err := netboot.BootImages(context.Background(), ulog.Log, curl.DefaultSchemes, result.Lease)
			if err != nil {
				log.Printf("Failed to boot lease %v: %v", result.Lease, err)
				continue
			}

			return imgs, nil
		}
	}
}

func newManualLease() (dhclient.Lease, error) {
	filteredIfs, err := dhclient.Interfaces(ifName)
	if err != nil {
		return nil, err
	}

	d, err := dhcpv4.New()
	if err != nil {
		return nil, err
	}

	d.BootFileName = *bootfile
	d.ServerIPAddr = net.ParseIP(*server)

	return dhclient.NewPacket4(filteredIfs[0], d), nil
}

func dumpNetDebugInfo() {
	log.Println("Dump debug info of network status")
	commands := []string{"ip link", "ip addr", "ip route show table all", "ip -6 route show table all", "ip neigh"}
	for _, cmd := range commands {
		cmds := strings.Split(cmd, " ")
		name := cmds[0]
		args := cmds[1:]
		sh.RunWithLogs(name, args...)
	}
}

func main() {
	flag.Parse()
	if len(flag.Args()) > 1 {
		log.Fatalf("Only one regexp-style argument is allowed, e.g.: %s", ifName)
	}
	if len(flag.Args()) > 0 {
		ifName = flag.Args()[0]
	}

	var images []boot.OSImage
	var err error
	if *bootfile == "" {
		images, err = NetbootImages(ifName)
		if err != nil {
			dumpNetDebugInfo()
		}
	} else {
		log.Printf("Skipping DHCP for manual target..")
		var l dhclient.Lease
		l, err = newManualLease()
		if err == nil {
			images, err = netboot.BootImages(context.Background(), ulog.Log, curl.DefaultSchemes, l)
		}
	}

	if err != nil {
		log.Printf("Netboot failed: %v", err)
	}

	for _, img := range images {
		img.Edit(func(cmdline string) string {
			return cmdline + " " + *cmdAppend
		})
	}

	menuEntries := menu.OSImages(*verbose, images...)
	menuEntries = append(menuEntries, menu.Reboot{})
	menuEntries = append(menuEntries, menu.StartShell{})

	// Boot does not return.
	bootcmd.ShowMenuAndBoot(menuEntries, nil, *noLoad, *noExec)
}

```

### Core Architecture Module: `cmds/cluster/nodestats/main.go`
```
// Copyright 2024 the u-root Authors. All rights reserved
// Use of this source code is governed by a BSD-style
// license that can be found in the LICENSE file.
//go:build !tinygo || tinygo.enable

// nodestats prints out vital statistics about a node as JSON.
// It currently uses the jaypipes/ghw package, as well as
// files in /sys and /proc.
// Any errors encountered are recorded in the stats struct.
package main

import (
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"log"
	"os"
	"reflect"

	"github.com/jaypipes/ghw"
	"github.com/u-root/u-root/pkg/cluster/health"
)

func node() *health.Stat {
	// Some *packages* write to Stderr instead of returning
	// an error. Further, the error may be a warning.
	// Gather up os.Stderr via a pipe and return it in the health.Stat struct.
	// Any error will be gathered in the errors.Join.
	// It is important to save the old os.Stderr in the event
	// log.Fatal is called in main().
	r, w, errs := os.Pipe()
	f := os.Stderr
	os.Stderr = w
	defer func() {
		os.Stderr = f
	}()

	hn, err := os.Hostname()
	errors.Join(errs, err)

	host, err := ghw.Host()
	errs = errors.Join(errs, err)

	k := health.Kernel{}
	val := reflect.ValueOf(k)
	typ := val.Type()

	for i := 0; i < typ.NumField(); i++ {
		field := typ.Field(i)
		n, ok := field.Tag.Lookup("file")
		if !ok {
			errs = errors.Join(errs, fmt.Errorf("%s:%w", field.Name, os.ErrNotExist))
			continue
		}

		dat, err := os.ReadFile(n)
		errs = errors.Join(errs, err)
		reflect.ValueOf(&k).Elem().Field(i).SetString(string(dat))
	}

	// ReadAll would be a bit dangerous in this context.
	// Read a reasonable amount, and record if we did not get
	// it all.
	w.Close()
	var Stderr [65536]byte
	n, err := r.Read(Stderr[:])
	if err != nil && err != io.EOF {
		errs = errors.Join(errs, fmt.Errorf("stderr read %d bytes, got %w but not io.EOF or nil", n, err))
	}

	stats := &health.Stat{Hostname: hn, Info: host, Kernel: k, Stderr: string(Stderr[:n])}
	if errs != nil {
		stats.Err = errs.Error()
	}
	return stats
}

func run(out io.Writer, args []string) error {
	if len(args) > 1 {
		return fmt.Errorf("%v:%w", args[0], os.ErrInvalid)
	}
	stats := node()
	j, err := json.MarshalIndent(stats, "", "\t")
	if err != nil {
		return err
	}
	fmt.Fprintf(out, "%s\n", string(j))
	return nil
}

func main() {
	if err := run(os.Stdout, os.Args); err != nil {
		log.Fatal(err)
	}
}

```

### Core Architecture Module: `cmds/contrib/fbptcat/fbptcat.go`
```
// Copyright 2023 the u-root Authors. All rights reserved
// Use of this source code is governed by a BSD-style
// license that can be found in the LICENSE file.

// fbptcat dumps the contents of FBPT Table
// within the ACPI FPDT Table
// FBPT stands for Firmware Basic Performance Table

package main

import (
	"fmt"
	"log"

	"github.com/u-root/u-root/pkg/acpi"
	"github.com/u-root/u-root/pkg/acpi/fpdt"
	"github.com/u-root/u-root/pkg/acpi/fpdt/fbpt"
)

func main() {
	// Get FPDT table from ACPI
	var acpiFPDT acpi.Table
	var err error
	if acpiFPDT, err = fpdt.ReadACPIFPDTTable(); err != nil {
		log.Fatal(err)
	}

	// Get FBPT Pointer from FPDT Table
	var FBPTAddr uint64
	if FBPTAddr, err = fpdt.FindFBPTTableAdrr(acpiFPDT); err != nil {
		log.Fatal(err)
	}

	var basicBootRecord fbpt.EfiAcpi6_5FpdtFirmwareBasicBootRecord
	var measurementRecords []fbpt.MeasurementRecord
	if _, measurementRecords, basicBootRecord, err = fbpt.FindAllFBPTRecords(FBPTAddr); err != nil {
		log.Fatal(err)
	}

	fmt.Printf("ResetEnd: %d, OSLoaderLoadImageStart: %d, OsLoaderStartImageStart: %d, ExitBootServicesEntry: %d, ExitBootServicesExit: %d \n", basicBootRecord.ResetEnd, basicBootRecord.OSLoaderLoadImageStart, basicBootRecord.OSLoaderStartImageStart, basicBootRecord.ExitBootServicesEntry, basicBootRecord.ExitBootServicesExit)

	for i, measurementRecord := range measurementRecords {
		if measurementRecord.Timestamp == 0 && len(measurementRecord.HookType) == 0 && len(measurementRecord.Description) == 0 {
			continue
		}
		fmt.Printf("Index: %d,Hook Type: %s, Processor Identifier/APIC ID: %d, Timestamp: %d, Guid: %s, Description: %s\n", i, measurementRecord.HookType, measurementRecord.ProcessorIdentifier, measurementRecord.Timestamp, measurementRecord.GUID.String(), measurementRecord.Description)
	}
}

```

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

### Incident Patch 1: `922a9e66` (2026-09-19)
**Commit Message**: Fix the misleading comment in fs9

The comment showed up in go doc termios,
and it only applies to Plan 9.

Also, just rename the file, to make it clear that
it is plan 9 specific.

Signed-off-by: ron minnich <rminnich@gmail.com>

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

### Incident Patch 2: `ed6e2e40` (2026-09-23)
**Commit Message**: pkg/boot/universalpayload: fix error revive

Signed-off-by: Siarhiej Siemianczuk <pdp.eleven11@gmail.com>

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

### Incident Patch 3: `7f32e543` (2026-09-22)
**Commit Message**: pkg/boot/universalpayload: fix revive comments

Signed-off-by: Siarhiej Siemianczuk <pdp.eleven11@gmail.com>

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

### Incident Patch 4: `dd162749` (2026-08-25)
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

Signed-off-by: Marvin Drees <marvin.drees@9elements.com>

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

### Incident Patch 5: `04e0e615` (2026-06-30)
**Commit Message**: fix: update test to match updated tty code

Signed-off-by: Marvin Drees <marvin.drees@9elements.com>

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

### Incident Patch 6: `839a4642` (2026-01-22)
**Commit Message**: init: fix early tty handling

Signed-off-by: Marvin Drees <marvin.drees@9elements.com>

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

```

---

### Incident Patch 7: `4f73c6e6` (2026-01-09)
**Commit Message**: fix: setup full PTY multiplexing early for init's own I/O

This commit implements the full PTY setup early in init's main(),
making the PTY the default FDs for init itself (not just for child
commands). This ensures the banner and all early output go through
proper PTY multiplexing to all consoles.

Now init itself runs "inside" the PTY, with all I/O automatically
multiplexed to all consoles. Child processes inherit these FDs unless
they explicitly override them (like PTY-multiplexed commands do).

Signed-off-by: Marvin Drees <marvin.drees@9elements.com>

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
+			
```

---

### Incident Patch 8: `67c1fe36` (2026-01-08)
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

Signed-off-by: Marvin Drees <marvin.drees@9elements.com>

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
+						de
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

### Incident Patch 9: `f6853127` (2026-01-08)
**Commit Message**: fix: properly multiplex TTY I/O through PTY with raw mode

This commit fixes the multi-console TTY handling to properly multiplex
I/O between multiple TTYs (extracted from kernel cmdline console= params)
and the shell through a PTY.

Signed-off-by: Marvin Drees <marvin.drees@9elements.com>

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
+				for i, tty := range ttys
```

---

### Incident Patch 10: `ac3ffe61` (2025-03-02)
**Commit Message**: fix: clean up libinit code

Signed-off-by: Christian Walter <christian.walter@9elements.com>

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

#### Recent Merged Pull Requests:
- **PR #3764** (closed): build(deps): bump markdown-it from 12.3.2 to 14.3.1 in /website (@dependabot[bot])
- **PR #3763** (2026-09-28): ci: ignore slattach for tinygo (@MDr164)
- **PR #3762** (2026-09-30): integration: attach socket NICs with -netdev/-device (@alanhc)
- **PR #3760** (closed): termios: add Min and Time fields to TTY struct (@rminnich)
- **PR #3759** (closed): build(deps): bump image-size and @11ty/eleventy-img in /website (@dependabot[bot])
- **PR #3758** (closed): Stty (@rminnich)
- **PR #3757** (2026-09-23): golangcilint: add riscv64 (@binjip978)
- **PR #3756** (2026-09-23): pkg/boot/universalpayload: fix error revive (@binjip978)

---

## 3. Empirical Evidence & Compliance Certification
- **Evidence Provenance**: Fetched directly from verified official GitHub REST API.
- **Zero Disk Footprint**: 0 bytes of unnecessary repository bloat stored locally.
- **TOS & Free-Tier Adherence**: Request pace complied with public API guidelines without fee, penalty, or unauthorized scraping.

---

## 4. Promotion & Integration Status
- **Status**: HARVESTED_DEEP_FORENSIC
- **Master Brain Sync**: Auto-committed to local/remote Master Brain repository.
