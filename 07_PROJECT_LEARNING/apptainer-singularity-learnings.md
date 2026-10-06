# Forensic Learning Record (Deep Inspection): apptainer/singularity

> **Canonical Artifact**: `07_PROJECT_LEARNING/apptainer-singularity-learnings.md`  
> **Source Platform**: GitHub ([https://github.com/apptainer/singularity](https://github.com/apptainer/singularity))  
> **Harvest Method**: Full-Spectrum Deep Extraction (Patches, Diffs, Source Code, Post-Mortems)  
> **Harvest Timestamp**: 2026-10-06T02:13:03.103Z  
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

### Core Architecture Module: `cmd/starter/engines/engines.go`
```
// Copyright (c) 2019, Sylabs Inc. All rights reserved.
// This software is licensed under a 3-clause BSD license. Please consult the
// LICENSE.md file distributed with the sources of this project regarding your
// rights to use or distribute this software.

package engines

```

### Core Architecture Module: `cmd/starter/engines/fakeroot_linux.go`
```
// Copyright (c) 2019-2021, Sylabs Inc. All rights reserved.
// This software is licensed under a 3-clause BSD license. Please consult the
// LICENSE.md file distributed with the sources of this project regarding your
// rights to use or distribute this software.

//go:build fakeroot_engine
// +build fakeroot_engine

package engines

import (
	// register the fakeroot runtime engine
	_ "github.com/hpcng/singularity/internal/pkg/runtime/engine/fakeroot"
)

```

### Core Architecture Module: `cmd/starter/engines/oci_linux.go`
```
// Copyright (c) 2019-2021, Sylabs Inc. All rights reserved.
// This software is licensed under a 3-clause BSD license. Please consult the
// LICENSE.md file distributed with the sources of this project regarding your
// rights to use or distribute this software.

//go:build oci_engine
// +build oci_engine

package engines

import (
	// register the oci runtime engine
	_ "github.com/hpcng/singularity/internal/pkg/runtime/engine/oci"
)

```

### Core Architecture Module: `cmd/starter/engines/singularity_linux.go`
```
// Copyright (c) 2019-2021, Sylabs Inc. All rights reserved.
// This software is licensed under a 3-clause BSD license. Please consult the
// LICENSE.md file distributed with the sources of this project regarding your
// rights to use or distribute this software.

//go:build singularity_engine
// +build singularity_engine

package engines

import (
	// register the singularity runtime engine
	_ "github.com/hpcng/singularity/internal/pkg/runtime/engine/singularity"
)

```

### Core Architecture Module: `e2e/instance/instance_utils.go`
```
// Copyright (c) 2019-2021, Sylabs Inc. All rights reserved.
// This software is licensed under a 3-clause BSD license. Please consult the
// LICENSE.md file distributed with the sources of this project regarding your
// rights to use or distribute this software.

package instance

import (
	"bufio"
	"encoding/json"
	"fmt"
	"net"
	"strconv"
	"testing"
	"time"

	"github.com/hpcng/singularity/e2e/internal/e2e"
)

const instanceStartPort = 11372

type instance struct {
	Image    string `json:"img"`
	Instance string `json:"instance"`
	Pid      int    `json:"pid"`
}

type instanceList struct {
	Instances []instance `json:"instances"`
}

func (c *ctx) listInstance(t *testing.T, listArgs ...string) (stdout string, stderr string, success bool) {
	var args []string

	c.env.RunSingularity(
		t,
		e2e.WithProfile(c.profile),
		e2e.WithCommand("instance list"),
		e2e.WithArgs(args...),
		e2e.PostRun(func(t *testing.T) {
			success = !t.Failed()
		}),
		e2e.ExpectExit(0, e2e.GetStreams(&stdout, &stderr)),
	)

	return
}

func (c *ctx) stopInstance(t *testing.T, instance string, stopArgs ...string) (stdout string, stderr string, success bool) {
	args := stopArgs

	if instance != "" {
		args = append(args, instance)
	}

	c.env.RunSingularity(
		t,
		e2e.WithProfile(c.profile),
		e2e.WithCommand("instance stop"),
		e2e.WithArgs(args...),
		e2e.PostRun(func(t *testing.T) {
			success = !t.Failed()
		}),
		e2e.ExpectExit(0, e2e.GetStreams(&stdout, &stderr)),
	)

	c.expectInstance(t, instance, 0)

	return
}

func (c *ctx) execInstance(t *testing.T, instance string, execArgs ...string) (stdout string, stderr string, success bool) {
	args := []string{"instance://" + instance}
	args = append(args, execArgs...)

	c.env.RunSingularity(
		t,
		e2e.WithProfile(c.profile),
		e2e.WithCommand("exec"),
		e2e.WithArgs(args...),
		e2e.PostRun(func(t *testing.T) {
			success = !t.Failed()
		}),
		e2e.ExpectExit(0, e2e.GetStreams(&stdout, &stderr)),
	)

	return
}

// Check if there is the number of expected instances with the provided name.
func (c *ctx) expectInstance(t *testing.T, name string, nb int) {
	listInstancesFn := func(t *testing.T, r *e2e.SingularityCmdResult) {
		var instances instanceList

		if err := json.Unmarshal([]byte(r.Stdout), &instances); err != nil {
			t.Errorf("Error while decoding JSON from 'instance list': %v", err)
		}
		if nb != len(instances.Instances) {
			t.Errorf("%d instance %q found, expected %d", len(instances.Instances), name, nb)
		}
	}

	c.env.RunSingularity(
		t,
		e2e.WithProfile(c.profile),
		e2e.WithCommand("instance list"),
		e2e.WithArgs([]string{"--json", name}...),
		e2e.ExpectExit(0, listInstancesFn),
	)
}

// Sends a deterministic message to an echo server and expects the same message
// in response.
func echo(t *testing.T, port int) {
	const message = "b40cbeaaea293f7e8bd40fb61f389cfca9823467\n"

	// give it some time for responding, attempt 10 times by
	// waiting 100 millisecond between each try
	for retries := 0; ; retries++ {
		sock, sockErr := net.Dial("tcp", "127.0.0.1:"+strconv.Itoa(port))
		if sockErr != nil && retries < 10 {
			time.Sleep(100 * time.Millisecond)
			continue
		} else if sockErr != nil {
			t.Errorf("Failed to dial echo server: %v", sockErr)
			return
		}

		fmt.Fprint(sock, message)

		response, responseErr := bufio.NewReader(sock).ReadString('\n')
		if responseErr != nil || response != message {
			t.Errorf("Bad response: err = %v, response = %v", responseErr, response)
		}
		break
	}
}

```

### Core Architecture Module: `e2e/internal/e2e/fileutil.go`
```
// Copyright (c) 2019, Sylabs Inc. All rights reserved.
// This software is licensed under a 3-clause BSD license. Please consult the
// LICENSE.md file distributed with the sources of this project regarding your
// rights to use or distribute this software.

package e2e

import (
	"io/ioutil"
	"os"
	"testing"

	"github.com/hpcng/singularity/internal/pkg/util/fs"
	"github.com/pkg/errors"
)

// WriteTempFile creates and populates a temporary file in the specified
// directory or in os.TempDir if dir is ""
// returns the file name or an error
func WriteTempFile(dir, pattern, content string) (string, error) {
	tmpfile, err := ioutil.TempFile(dir, pattern)
	if err != nil {
		return "", err
	}

	if _, err := tmpfile.Write([]byte(content)); err != nil {
		return "", err
	}

	if err := tmpfile.Close(); err != nil {
		return "", err
	}

	return tmpfile.Name(), nil
}

// MakeTempDir creates a temporary image cache directory that can then be
// used for the execution of a e2e test.
//
// This function shall not set the environment variable to specify the
// image cache location since it would create thread safety problems.
func MakeTempDir(t *testing.T, baseDir string, prefix string, context string) (string, func(t *testing.T)) {
	dir, err := fs.MakeTmpDir(baseDir, prefix, 0o755)
	err = errors.Wrapf(err, "creating temporary %s at %s", context, baseDir)
	if err != nil {
		t.Fatalf("failed to create temporary directory: %+v", err)
	}

	return dir, func(t *testing.T) {
		err := os.RemoveAll(dir)
		if err != nil {
			t.Fatalf("failed to delete temporary directory: %s", err)
		}
	}
}

// MakeCacheDir creates a temporary image cache directory that can then be
// used for the execution of a e2e test.
//
// This function shall not set the environment variable to specify the
// image cache location since it would create thread safety problems.
func MakeCacheDir(t *testing.T, baseDir string) (string, func(t *testing.T)) {
	return MakeTempDir(t, baseDir, "e2e-imgcache-", "image cache directory")
}

// MakeSyPGPDir creates a temporary directory that will be used to store the PGP
// keyring for the execution of a e2e test.
//
// This function shall not set the environment variable to specify the
// SYPGP directory since it would create thread safety problems.
func MakeSyPGPDir(t *testing.T, baseDir string) (string, func(t *testing.T)) {
	return MakeTempDir(t, baseDir, "e2e-sypgp-", "SyPGP directory")
}

// PathExists return true if the path (file or directory) exists, false otherwise.
func PathExists(t *testing.T, path string) bool {
	if _, err := os.Stat(path); os.IsNotExist(err) {
		return false
	} else if err != nil {
		t.Fatalf("While stating file: %v", err)
	}

	return true
}

// PathPerms return true if the path (file or directory) has specified permissions, false otherwise.
func PathPerms(t *testing.T, path string, perms os.FileMode) bool {
	s, err := os.Stat(path)
	if err != nil {
		t.Fatalf("While stating file: %v", err)
	}

	return s.Mode().Perm() == perms
}

```

### Core Architecture Module: `e2e/pull/concurrency.go`
```
// Copyright (c) 2021, Sylabs Inc. All rights reserved.
// This software is licensed under a 3-clause BSD license. Please consult the
// LICENSE.md file distributed with the sources of this project regarding your
// rights to use or distribute this software.

package pull

import (
	"io/ioutil"
	"os"
	"testing"

	"github.com/hpcng/singularity/e2e/internal/e2e"
)

func (c ctx) testConcurrencyConfig(t *testing.T) {
	tests := []struct {
		name             string
		setting          string
		value            string
		expectedExitCode int
	}{
		{"DownloadConcurrency", "download concurrency", "5", 0},
		{"InvalidDownloadConcurrency", "download concurrency", "-1", 255},
		{"DownloadPartSize", "download part size", "32768", 0},
		{"InvalidDownloadPartSize", "download part size", "-1", 255},
		{"DownloadBufferSize", "download buffer size", "65536", 0},
		{"InvalidDownloadBufferSize", "download buffer size", "-1", 255},
	}

	for _, tt := range tests {
		c.env.RunSingularity(
			t,
			e2e.AsSubtest(tt.name+"-set"),
			e2e.WithProfile(e2e.RootProfile),
			e2e.WithCommand("config global"),
			e2e.WithArgs("--set", tt.setting, tt.value),
			e2e.ExpectExit(tt.expectedExitCode),
		)
		c.env.RunSingularity(
			t,
			e2e.AsSubtest(tt.name+"-reset"),
			e2e.WithProfile(e2e.RootProfile),
			e2e.WithCommand("config global"),
			e2e.WithArgs("--reset", tt.setting),
			e2e.ExpectExit(0),
		)
	}
}

func (c ctx) testConcurrentPulls(t *testing.T) {
	const srcURI = "library://alpine:3.11.5"

	tests := []struct {
		name             string
		settings         map[string]string
		envVars          []string
		expectedExitCode int
	}{
		// test traditional sequential download
		{"Concurrency1Cfg", map[string]string{"download concurrency": "1"}, nil, 0},
		// test concurrency 3
		{"Concurrency3Cfg", map[string]string{"download concurrency": "3"}, nil, 0},
		// test concurrency 10
		{"Concurrency10Cfg", map[string]string{"download concurrency": "10"}, nil, 0},

		// test 1/3/10 goroutines (set via env vars)
		{"Concurrency1Env", nil, []string{"SINGULARITY_DOWNLOAD_CONCURRENCY=1"}, 0},
		{"Concurrency3Env", nil, []string{"SINGULARITY_DOWNLOAD_CONCURRENCY=3"}, 0},
		{"Concurrency10Env", nil, []string{"SINGULARITY_DOWNLOAD_CONCURRENCY=10"}, 0},

		// test concurrent download with 1 MiB and 8 MiB part size
		{"PartSize1MCfg", map[string]string{"download part size": "1048576"}, nil, 0},
		{"PartSize8MCfg", map[string]string{"download part size": "8388608"}, nil, 0},

		// test concurrent download with 1 MiB and 8 MiB part size (via env vars)
		{"PartSize1MEnv", nil, []string{"SINGULARITY_DOWNLOAD_PART_SIZE=1048576"}, 0},
		{"PartSize8MEnv", nil, []string{"SINGULARITY_DOWNLOAD_PART_SIZE=8388608"}, 0},

		// use 8 byte and 64 KiB buffer size for concurrent downloads
		{"BufferSize1Cfg", map[string]string{"download buffer size": "8"}, nil, 0},
		{"BufferSize65536Cfg", map[string]string{"download buffer size": "65536"}, nil, 0},

		// use 8 byte and 64 KiB buffer size for concurrent downloads (via env vars)
		{"BufferSize1Env", nil, []string{"SINGULARITY_DOWNLOAD_BUFFER_SIZE=8"}, 0},
		{"BufferSize65536Env", nil, []string{"SINGULARITY_DOWNLOAD_BUFFER_SIZE=65536"}, 0},

		// multiple settings (concurrency 1, download buffer size 64 KiB)
		{"MultipleSettings", map[string]string{"download concurrency": "1", "download buffer size": "65536"}, nil, 0},
	}

	for _, tt := range tests {
		tt := tt

		t.Run(tt.name, func(t *testing.T) {
			tmpdir, err := ioutil.TempDir(c.env.TestDir, "pull_test.")
			if err != nil {
				t.Fatalf("Failed to create temporary directory for pull test: %+v", err)
			}
			defer os.RemoveAll(tmpdir)

			// Set global configuration
			if tt.settings != nil {
				cfgCmdOps := []e2e.SingularityCmdOp{
					e2e.WithProfile(e2e.RootProfile),
					e2e.WithCommand("config global"),
					e2e.ExpectExit(0),
				}

				for key, value := range tt.settings {
					t.Logf("set %s %s", key, value)
					cfgCmd := append(cfgCmdOps, e2e.WithArgs("--set", key, value))
					c.env.RunSingularity(t, cfgCmd...)

					t.Cleanup(func() {
						t.Logf("reset %s", key)
						c.env.RunSingularity(
							t,
							e2e.WithProfile(e2e.RootProfile),
							e2e.WithCommand("config global"),
							e2e.WithArgs("--reset", key),
							e2e.ExpectExit(0),
						)
					})
				}
			}

			// Reset global configuration at test completion

			ts := testStruct{
				desc:             "",
				srcURI:           srcURI,
				expectedExitCode: tt.expectedExitCode,
				expectedImage:    getImageNameFromURI(srcURI),
				envVars:          tt.envVars,
			}

			// Since we are not passing an image name, change the current
			// working directory to the temporary directory we just created so
			// that we know it's clean. We don't do this for the other case in
			// order to catch spurious files showing up. Maybe later we can
			// examine the directory and assert that it only contains what we
			// expect.
			oldwd, err := os.Getwd()
			if err != nil {
				t.Fatalf("Failed to get working directory for pull test: %+v", err)
			}
			defer os.Chdir(oldwd)

			os.Chdir(tmpdir)

			// if there's a pullDir, that's where we expect to find the image
			if ts.pullDir != "" {
				os.Chdir(ts.pullDir)
			}

			ts.expectedImage = getImageNameFromURI(srcURI)

			// pull image
			c.imagePull(t, ts)
		})

	}
}

```

### Core Architecture Module: `internal/app/singularity/oci_state_linux.go`
```
// Copyright (c) 2018-2019, Sylabs Inc. All rights reserved.
// This software is licensed under a 3-clause BSD license. Please consult the
// LICENSE.md file distributed with the sources of this project regarding your
// rights to use or distribute this software.

package singularity

import (
	"encoding/json"
	"fmt"

	"github.com/hpcng/singularity/pkg/util/unix"
)

// OciState query container state
func OciState(containerID string, args *OciArgs) error {
	// query instance files and returns state
	state, err := getState(containerID)
	if err != nil {
		return err
	}
	if args.SyncSocketPath != "" {
		data, err := json.Marshal(state)
		if err != nil {
			return fmt.Errorf("failed to marshal state data: %s", err)
		} else if err := unix.WriteSocket(args.SyncSocketPath, data); err != nil {
			return err
		}
	} else {
		c, err := json.MarshalIndent(state, "", "\t")
		if err != nil {
			return err
		}
		fmt.Println(string(c))
	}
	return nil
}

```

### Core Architecture Module: `internal/pkg/client/shub/util.go`
```
// Copyright (c) 2018-2020, Sylabs Inc. All rights reserved.
// This software is licensed under a 3-clause BSD license. Please consult the
// LICENSE.md file distributed with the sources of this project regarding your
// rights to use or distribute this software.

package shub

import (
	"errors"
	"regexp"
	"strings"
)

// isShubPullRef returns true if the provided string is a valid Shub
// reference for a pull operation.
func isShubPullRef(shubRef string) bool {
	// define regex for each URI component
	registryRegexp := `([-.a-zA-Z0-9/]{1,64}\/)?`           // target is very open, outside registry
	nameRegexp := `([-a-zA-Z0-9]{1,39}\/)`                  // target valid github usernames
	containerRegexp := `([-_.a-zA-Z0-9]{1,64})`             // target valid github repo names
	tagRegexp := `(:[-_.a-zA-Z0-9]{1,64})?`                 // target is very open, file extensions or branch names
	digestRegexp := `((\@[a-f0-9]{32})|(\@[a-f0-9]{40}))?$` // target file md5 has, git commit hash, git branch

	// expression is anchored
	shubRegex, err := regexp.Compile(`^(shub://)` + registryRegexp + nameRegexp + containerRegexp + tagRegexp + digestRegexp + `$`)
	if err != nil {
		return false
	}

	found := shubRegex.FindString(shubRef)

	// sanity check
	// if found string is not equal to the input, input isn't a valid URI
	return shubRef == found
}

// ParseReference accepts a valid Shub reference string and parses its content
// It will return an error if the given URI is not valid,
// otherwise it will parse the contents into a URI struct
func ParseReference(src string) (URI, error) {
	uri := URI{}

	ShubRef := strings.TrimPrefix(src, "shub://")
	refParts := strings.Split(ShubRef, "/")

	if l := len(refParts); l > 2 {
		// more than two pieces indicates a custom registry
		uri.registry = strings.Join(refParts[:l-2], "/") + shubAPIRoute
		uri.user = refParts[l-2]
		src = refParts[l-1]
	} else if l == 2 {
		// two pieces means default registry
		uri.registry = defaultRegistry + shubAPIRoute
		uri.user = refParts[l-2]
		src = refParts[l-1]
	} else if l < 2 {
		return URI{}, errors.New("not a valid Shub reference")
	}

	// look for an @ and split if it exists
	if strings.Contains(src, `@`) {
		refParts = strings.Split(src, `@`)
		uri.digest = `@` + refParts[1]
		src = refParts[0]
	}

	// look for a : and split if it exists
	if strings.Contains(src, `:`) {
		refParts = strings.Split(src, `:`)
		uri.tag = `:` + refParts[1]
		src = refParts[0]
	}

	// container name is left over after other parts are split from it
	uri.container = src

	if uri.tag == "" && uri.digest == "" {
		uri.tag = ":latest"
	}

	return uri, nil
}

```

### Core Architecture Module: `internal/pkg/remote/util/util.go`
```
// Copyright (c) 2020, Control Command Inc. All rights reserved.
// Copyright (c) 2019, Sylabs Inc. All rights reserved.
// This software is licensed under a 3-clause BSD license. Please consult the
// LICENSE.md file distributed with the sources of this project regarding your
// rights to use or distribute this software.

package util

import (
	"fmt"
	"net"
	"net/url"
)

const (
	hkpPort = "11371"
)

const (
	httpScheme  = "http"
	httpsScheme = "https"
	hkpScheme   = "hkp"
	hkpsScheme  = "hkps"
)

// NormalizeKeyserverURI is normalizing a URI string by converting
// protocol scheme hkp:// and hkps:// to their corresponding http://
// and https:// protocol scheme and returns the parsed URI with the
// corresponding scheme.
func NormalizeKeyserverURI(uri string) (*url.URL, error) {
	u, err := url.Parse(uri)
	if err != nil {
		return nil, err
	}

	switch u.Scheme {
	case httpScheme, httpsScheme:
	case hkpScheme:
		u.Scheme = httpScheme
		if u.Port() == "" {
			u.Host = net.JoinHostPort(u.Hostname(), hkpPort)
		}
	case hkpsScheme:
		u.Scheme = httpsScheme
	default:
		return nil, fmt.Errorf("unsupported keyserver protocol scheme %q", u.Scheme)
	}

	return u, nil
}

// SameKeyserver returns if two URIs point to the same keyserver or not, URI are
// also normalized meaning by example that hkp://localhost is equivalent to
// http://localhost:11371.
func SameKeyserver(u1, u2 string) bool {
	uri1, err := NormalizeKeyserverURI(u1)
	if err != nil {
		return false
	}
	uri2, err := NormalizeKeyserverURI(u2)
	if err != nil {
		return false
	}
	return Equal(uri1, uri2)
}

// SameURI returns if two URIs point to the same service or not.
func SameURI(u1, u2 string) bool {
	uri1, err := url.Parse(u1)
	if err != nil {
		return false
	}
	uri2, err := url.Parse(u2)
	if err != nil {
		return false
	}
	return Equal(uri1, uri2)
}

// Equal returns if both URLs have the same hostname, port and scheme or not.
func Equal(u1, u2 *url.URL) bool {
	if u1.Host == "" || u2.Host == "" {
		return false
	}
	return u1.Host == u2.Host && u1.Scheme == u2.Scheme
}

```

### Core Architecture Module: `internal/pkg/runtime/engine/config/oci/config.go`
```
// Copyright (c) 2018-2021, Sylabs Inc. All rights reserved.
// This software is licensed under a 3-clause BSD license. Please consult the
// LICENSE.md file distributed with the sources of this project regarding your
// rights to use or distribute this software.

package oci

import (
	"encoding/json"
	"fmt"

	"github.com/containerd/cgroups"
	"github.com/hpcng/singularity/internal/pkg/runtime/engine/config/oci/generate"
	"github.com/hpcng/singularity/internal/pkg/security/seccomp"
	specs "github.com/opencontainers/runtime-spec/specs-go"
	cseccomp "github.com/seccomp/containers-golang"
)

// Config is the OCI runtime configuration.
type Config struct {
	generate.Generator
	specs.Spec
}

// MarshalJSON implements json.Marshaler.
func (c *Config) MarshalJSON() ([]byte, error) {
	return json.Marshal(&c.Spec)
}

// UnmarshalJSON implements json.Unmarshaler.
func (c *Config) UnmarshalJSON(b []byte) error {
	if err := json.Unmarshal(b, &c.Spec); err != nil {
		return err
	}
	c.Generator = *generate.New(&c.Spec)
	return nil
}

// DefaultConfig returns an OCI config generator with a
// default OCI configuration for cgroups v1 or v2 dependent on the current host.
func DefaultConfig() (*generate.Generator, error) {
	if cgroups.Mode() == cgroups.Unified {
		return DefaultConfigV2()
	}
	return DefaultConfigV1()
}

// DefaultConfigV1 returns an OCI config generator with a
// default OCI configuration for cgroups v1.
func DefaultConfigV1() (*generate.Generator, error) {
	var err error

	config := specs.Spec{
		Version:  specs.Version,
		Hostname: "mrsdalloway",
	}

	config.Root = &specs.Root{
		Path:     "rootfs",
		Readonly: false,
	}
	config.Process = &specs.Process{
		Terminal: false,
		Args: []string{
			"sh",
		},
	}

	config.Process.User = specs.User{}
	config.Process.Env = []string{
		"PATH=/usr/local/sbin:/usr/local/bin:/usr/sbin:/usr/bin:/sbin:/bin",
		"TERM=xterm",
	}
	config.Process.Cwd = "/"
	config.Process.Rlimits = []specs.POSIXRlimit{
		{
			Type: "RLIMIT_NOFILE",
			Hard: uint64(1024),
			Soft: uint64(1024),
		},
	}

	config.Process.Capabilities = &specs.LinuxCapabilities{
		Bounding: []string{
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
		},
		Permitted: []string{
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
		},
		Inheritable: []string{
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
		},
		Effective: []string{
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
		},
		Ambient: []string{
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
		},
	}
	config.Mounts = []specs.Mount{
		{
			Destination: "/proc",
			Type:        "proc",
			Source:      "proc",
			Options:     []string{"nosuid", "noexec", "nodev"},
		},
		{
			Destination: "/dev",
			Type:        "tmpfs",
			Source:      "tmpfs",
			Options:     []string{"nosuid", "strictatime", "mode=755", "size=65536k"},
		},
		{
			Destination: "/dev/pts",
			Type:        "devpts",
			Source:      "devpts",
			Options:     []string{"nosuid", "noexec", "newinstance", "ptmxmode=0666", "mode=0620", "gid=5"},
		},
		{
			Destination: "/dev/shm",
			Type:        "tmpfs",
			Source:      "shm",
			Options:     []string{"nosuid", "noexec", "nodev", "mode=1777", "size=65536k"},
		},
		{
			Destination: "/dev/mqueue",
			Type:        "mqueue",
			Source:      "mqueue",
			Options:     []string{"nosuid", "noexec", "nodev"},
		},
		{
			Destination: "/sys",
			Type:        "sysfs",
			Source:      "sysfs",
			Options:     []string{"nosuid", "noexec", "nodev", "ro"},
		},
	}
	config.Linux = &specs.Linux{
		Resources: &specs.LinuxResources{
			Devices: []specs.LinuxDeviceCgroup{
				// Wildcard blocking access to all devices by default.
				// Note that essential cgroupDevices allow rules are inserted ahead of this.
				{
					Allow:  false,
					Access: "rwm",
				},
			},
		},
		Namespaces: []specs.LinuxNamespace{
			{
				Type: "pid",
			},
			{
				Type: "network",
			},
			{
				Type: "ipc",
			},
			{
				Type: "uts",
			},
			{
				Type: "mount",
			},
		},
	}

	if seccomp.Enabled() {
		config.Linux.Seccomp, err = cseccomp.GetDefaultProfile(&config)
		if err != nil {
			return nil, fmt.Errorf("failed to get seccomp default profile: %s", err)
		}
	}

	return &generate.Generator{Config: &config}, nil
}

// DefaultConfigV2 returns an OCI config generator with a default OCI configuration for cgroups v2.
// This is identical to v1 except that we use a cgroup namespace, and mount the namespaced
// cgroup fs into the container.
func DefaultConfigV2() (*generate.Generator, error) {
	gen, err := DefaultConfigV1()
	if err != nil {
		return nil, err
	}
	c := gen.Config

	// TODO: Enter a cgroup namespace
	// See https://github.com/sylabs/singularity/issues/298
	// We need to be unsharing the namespace at an appropriate point before we can enable this.
	//
	// c.Linux.Namespaces = append(c.Linux.Namespaces, specs.LinuxNamespace{Type: "cgroup"})

	// Mount the unified cgroup v2 hierarchy
	c.Mounts = append(c.Mounts, specs.Mount{
		Destination: "/sys/fs/cgroup",
		Type:        "cgroup2",
		Source:      "cgroup2",
		Options:     []string{"nosuid", "noexec", "nodev", "ro"},
	})

	return &generate.Generator{Config: c}, nil
}

```

### Core Architecture Module: `internal/pkg/runtime/engine/config/oci/generate/generate.go`
```
// Copyright 2015 The Linux Foundation.
// Licensed under the Apache License, Version 2.0 (the "License");
// you may not use this file except in compliance with the License.
// You may obtain a copy of the License at
//
//	http://www.apache.org/licenses/LICENSE-2.0
//
// Unless required by applicable law or agreed to in writing, software
// distributed under the License is distributed on an "AS IS" BASIS,
// WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
// See the License for the specific language governing permissions and
// limitations under the License.

// Copyright (c) 2020-2021, Sylabs Inc. All rights reserved.
// This software is licensed under a 3-clause BSD license. Please consult the
// LICENSE.md file distributed with the sources of this project regarding your
// rights to use or distribute this software.
//
// This file contains modified code originally taken from:
// github.com/opencontainers/runtime-tools/generate/config.go

package generate

import (
	"encoding/json"
	"fmt"
	"io"
	"os"

	"github.com/hpcng/singularity/pkg/util/capabilities"
	"github.com/opencontainers/runtime-spec/specs-go"
	"golang.org/x/sys/unix"
)

// Generator represents a generator for a OCI runtime config.
type Generator struct {
	Config *specs.Spec
}

// New returns a generator associated to the OCI specification
// passed in parameter or an empty OCI specification if parameter
// is nil.
func New(spec *specs.Spec) *Generator {
	if spec == nil {
		return &Generator{
			Config: &specs.Spec{
				Version: specs.Version,
			},
		}
	}
	return &Generator{
		Config: spec,
	}
}

func (g *Generator) initLinux() {
	if g.Config.Linux != nil {
		return
	}
	g.Config.Linux = &specs.Linux{}
}

func (g *Generator) initProcess() {
	if g.Config.Process != nil {
		return
	}
	g.Config.Process = &specs.Process{}
}

func (g *Generator) initProcessCapabilities() {
	g.initProcess()
	if g.Config.Process.Capabilities != nil {
		return
	}
	g.Config.Process.Capabilities = &specs.LinuxCapabilities{}
}

func (g *Generator) initRoot() {
	if g.Config.Root != nil {
		return
	}
	g.Config.Root = &specs.Root{}
}

func (g *Generator) initLinuxNamespaces() {
	g.initLinux()
	if g.Config.Linux.Namespaces != nil {
		return
	}
	g.Config.Linux.Namespaces = make([]specs.LinuxNamespace, 0)
}

// AddProcessEnv adds or replaces a container process environment variable.
func (g *Generator) AddProcessEnv(env, value string) {
	g.initProcess()

	kenv := fmt.Sprintf("%s=", env)
	l := len(kenv)

	for i, e := range g.Config.Process.Env {
		if len(e) >= l && e[:l] == kenv {
			g.Config.Process.Env[i] = kenv + value
			return
		}
	}

	g.Config.Process.Env = append(g.Config.Process.Env, kenv+value)
}

// RemoveProcessEnv removes a container process environment variable.
func (g *Generator) RemoveProcessEnv(env string) {
	g.initProcess()

	kenv := fmt.Sprintf("%s=", env)
	l := len(kenv)

	for i, e := range g.Config.Process.Env {
		if len(e) >= l && e[:l] == kenv {
			g.Config.Process.Env = append(g.Config.Process.Env[:i], g.Config.Process.Env[i+1:]...)
			return
		}
	}
}

// AddOrReplaceLinuxNamespace adds or updates a container process namespace.
func (g *Generator) AddOrReplaceLinuxNamespace(ns specs.LinuxNamespaceType, path string) {
	switch ns {
	case specs.NetworkNamespace:
	case specs.MountNamespace:
	case specs.UTSNamespace:
	case specs.UserNamespace:
	case specs.CgroupNamespace:
	case specs.IPCNamespace:
	case specs.PIDNamespace:
	default:
		return
	}

	g.initLinuxNamespaces()

	namespace := specs.LinuxNamespace{
		Type: ns,
		Path: path,
	}

	for i, n := range g.Config.Linux.Namespaces {
		if n.Type == ns {
			g.Config.Linux.Namespaces[i] = namespace
			return
		}
	}

	g.Config.Linux.Namespaces = append(g.Config.Linux.Namespaces, namespace)
}

// SetProcessArgs sets container process arguments.
func (g *Generator) SetProcessArgs(args []string) {
	g.initProcess()
	g.Config.Process.Args = args
}

// SetProcessCwd sets container process working directory.
func (g *Generator) SetProcessCwd(cwd string) {
	g.initProcess()
	g.Config.Process.Cwd = cwd
}

// SetProcessTerminal sets if container process terminal or not.
func (g *Generator) SetProcessTerminal(b bool) {
	g.initProcess()
	g.Config.Process.Terminal = b
}

// SetRootPath sets container root filesystem path.
func (g *Generator) SetRootPath(path string) {
	g.initRoot()
	g.Config.Root.Path = path
}

// AddMount adds a mount for container environment setup.
func (g *Generator) AddMount(mnt specs.Mount) {
	g.Config.Mounts = append(g.Config.Mounts, mnt)
}

// AddLinuxUIDMapping adds a UID mapping.
func (g *Generator) AddLinuxUIDMapping(host, container, size uint32) {
	g.initLinux()

	idMapping := specs.LinuxIDMapping{
		HostID:      host,
		ContainerID: container,
		Size:        size,
	}

	g.Config.Linux.UIDMappings = append(g.Config.Linux.UIDMappings, idMapping)
}

// AddLinuxGIDMapping adds a GID mapping.
func (g *Generator) AddLinuxGIDMapping(host, container, size uint32) {
	g.initLinux()

	idMapping := specs.LinuxIDMapping{
		HostID:      host,
		ContainerID: container,
		Size:        size,
	}

	g.Config.Linux.GIDMappings = append(g.Config.Linux.GIDMappings, idMapping)
}

// AddProcessRlimits adds a container process rlimit.
func (g *Generator) AddProcessRlimits(rType string, rHard uint64, rSoft uint64) {
	g.initProcess()

	for i, rlimit := range g.Config.Process.Rlimits {
		if rlimit.Type == rType {
			g.Config.Process.Rlimits[i].Hard = rHard
			g.Config.Process.Rlimits[i].Soft = rSoft
			return
		}
	}

	newRlimit := specs.POSIXRlimit{
		Type: rType,
		Hard: rHard,
		Soft: rSoft,
	}

	g.Config.Process.Rlimits = append(g.Config.Process.Rlimits, newRlimit)
}

// SetupPrivileged sets requirements for a container process with all
// privileges.
func (g *Generator) SetupPrivileged(privileged bool) {
	if !privileged {
		return
	}

	// Add all capabilities, we don't need to check for the
	// latest capability available as it's handled automatically
	// by the starter
	var allCapability []string
	for capStr := range capabilities.Map {
		allCapability = append(allCapability, capStr)
	}

	g.initLinux()
	g.initProcessCapabilities()

	g.Config.Process.Capabilities.Bounding = allCapability
	g.Config.Process.Capabilities.Effective = allCapability
	g.Config.Process.Capabilities.Inheritable = allCapability
	g.Config.Process.Capabilities.Permitted = allCapability
	g.Config.Process.Capabilities.Ambient = allCapability

	g.Config.Process.SelinuxLabel = ""
	g.Config.Process.ApparmorProfile = ""
	g.Config.Linux.Seccomp = nil
}

// SetProcessNoNewPrivileges sets g.Config.Process.NoNewPrivileges.
func (g *Generator) SetProcessNoNewPrivileges(b bool) {
	g.initProcess()
	g.Config.Process.NoNewPrivileges = b
}

// SetProcessSelinuxLabel sets container process SELinux execution label.
func (g *Generator) SetProcessSelinuxLabel(label string) {
	g.initProcess()
	g.Config.Process.SelinuxLabel = label
}

// SetProcessApparmorProfile sets container process AppArmor profile.
func (g *Generator) SetProcessApparmorProfile(prof string) {
	g.initProcess()
	g.Config.Process.ApparmorProfile = prof
}

// Save writes the configuration into w.
func (g *Generator) Save(w io.Writer) (err error) {
	var data []byte

	if g.Config.Linux != nil {
		buf, err := json.Marshal(g.Config.Linux)
		if err != nil {
			return err
		}
		if string(buf) == "{}" {
			g.Config.Linux = nil
		}
	}

	data, err = json.MarshalIndent(g.Config, "", "\t")
	if err != nil {
		return err
	}

	_, err = w.Write(data)
	if err != nil {
		return err
	}

	return nil
}

// SaveToFile writes the configuration into a file.
func (g *Generator) SaveToFile(path string) error {
	flags := os.O_RDWR | os.O_CREATE | os.O_TRUNC | unix.O_NOFOLLOW

	f, err := os.OpenFile(path, flags, 0o600)
	if err != nil {
		return err
	}
	defer f.Close()

	return g.Save(f)
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
-			if err != nil {
-				return "", err
+	return cacheEntry.Path, nil
+}
+
+// downloadWrapper calls DownloadImage() and outputs download summary if progressBar not specified.
+func downloadWrapper(ctx context.Context, c *scslibrary.Client, imagePath, arch string, libraryRef *scslibrary.Ref, pb scslibrary.ProgressBar) error {
+	sylog.Infof("Downloading library image")
+
+	defer func(t time.Time) {
+		if pb == nil {
+			if fi, err := os.Stat(imagePath); err == nil {
+				// Progress bar interface not specified; output summary to stdout
+				sylog.Infof("Downloaded %d bytes in %v\n", fi.Size(), time.Since(t))
 			}
-		} else {
-			sylog.Infof("Using cached image")
 		}
-		imagePath = cacheEntry.Path
-	}
+	}(time.Now())
 
-	return imagePath, nil
+	if err := DownloadImage(ctx, c, imagePath, arch, libraryRef, pb); err != nil {
+		return err
+	}
+	return nil
 }
 
 // Pull will pull a library image to the cache or direct to a temporary file if cache is disabled
```

---

### Incident Patch 2: `232d2579` (2021-11-18)
**Commit Message**: build(deps): bump github.com/docker/docker

Bumps [github.com/docker/docker](https://github.com/docker/docker) from 20.10.10+incompatible to 20.10.11+incompatible.
- [Release notes](https://github.com/docker/docker/releases)
- [Changelog](https://github.com/moby/moby/blob/master/CHANGELOG.md)
- [Commits](https://github.com/docker/docker/compare/v20.10.10...v20.10.11)

---
updated-dependencies:
- dependency-name: github.com/docker/docker
  dependency-type: direct:production
  update-type: version-update:semver-patch
...

Signed-off-by: dependabot[bot] <[REDACTED_EMAIL]>

**File**: `go.mod` (modified, +1/-1)
```diff
@@ -14,7 +14,7 @@ require (
 	github.com/containernetworking/plugins v1.0.1
 	github.com/containers/image/v5 v5.16.1
 	github.com/cyphar/filepath-securejoin v0.2.3
-	github.com/docker/docker v20.10.10+incompatible
+	github.com/docker/docker v20.10.11+incompatible
 	github.com/fatih/color v1.13.0
 	github.com/go-log/log v0.2.0
 	github.com/google/uuid v1.3.0
```

**File**: `go.sum` (modified, +2/-2)
```diff
@@ -331,8 +331,8 @@ github.com/docker/distribution v2.7.1+incompatible h1:a5mlkVzth6W5A4fOsS3D2EO5BU
 github.com/docker/distribution v2.7.1+incompatible/go.mod h1:J2gT2udsDAN96Uj4KfcMRqY0/ypR+oyYUYmja8H+y+w=
 github.com/docker/docker v20.10.8+incompatible/go.mod h1:eEKB0N0r5NX/I1kEveEz05bcu8tLC/8azJZsviup8Sk=
 github.com/docker/docker v20.10.9+incompatible/go.mod h1:eEKB0N0r5NX/I1kEveEz05bcu8tLC/8azJZsviup8Sk=
-github.com/docker/docker v20.10.10+incompatible h1:GKkP0T7U4ks6X3lmmHKC2QDprnpRJor2Z5a8m62R9ZM=
-github.com/docker/docker v20.10.10+incompatible/go.mod h1:eEKB0N0r5NX/I1kEveEz05bcu8tLC/8azJZsviup8Sk=
+github.com/docker/docker v20.10.11+incompatible h1:OqzI/g/W54LczvhnccGqniFoQghHx3pklbLuhfXpqGo=
+github.com/docker/docker v20.10.11+incompatible/go.mod h1:eEKB0N0r5NX/I1kEveEz05bcu8tLC/8azJZsviup8Sk=
 github.com/docker/docker-credential-helpers v0.6.4 h1:axCks+yV+2MR3/kZhAmy07yC56WZ2Pwu/fKWtKuZB0o=
 github.com/docker/docker-credential-helpers v0.6.4/go.mod h1:ofX3UI0Gz1TteYBjtgs07O36Pyasyp66D2uKT7H8W1c=
 github.com/docker/go-connections v0.4.0 h1:El9xVISelRB7BuFusrZozjnkIM5YnzCViNKohAFqRJQ=
```

---

### Incident Patch 3: `5e7ce75e` (2021-11-18)
**Commit Message**: build(deps): bump github.com/containerd/containerd from 1.5.7 to 1.5.8

Bumps [github.com/containerd/containerd](https://github.com/containerd/containerd) from 1.5.7 to 1.5.8.
- [Release notes](https://github.com/containerd/containerd/releases)
- [Changelog](https://github.com/containerd/containerd/blob/main/RELEASES.md)
- [Commits](https://github.com/containerd/containerd/compare/v1.5.7...v1.5.8)

---
updated-dependencies:
- dependency-name: github.com/containerd/containerd
  dependency-type: direct:production
  update-type: version-update:semver-patch
...

Signed-off-by: dependabot[bot] <[REDACTED_EMAIL]>

**File**: `go.mod` (modified, +1/-1)
```diff
@@ -9,7 +9,7 @@ require (
 	github.com/blang/semver/v4 v4.0.0
 	github.com/buger/jsonparser v1.1.1
 	github.com/containerd/cgroups v1.0.2
-	github.com/containerd/containerd v1.5.7
+	github.com/containerd/containerd v1.5.8
 	github.com/containernetworking/cni v1.0.1
 	github.com/containernetworking/plugins v1.0.1
 	github.com/containers/image/v5 v5.16.1
```

**File**: `go.sum` (modified, +8/-3)
```diff
@@ -84,8 +84,9 @@ github.com/Microsoft/hcsshim v0.8.16/go.mod h1:o5/SZqmR7x9JNKsW3pu+nqHm0MF8vbA+V
 github.com/Microsoft/hcsshim v0.8.18/go.mod h1:+w2gRZ5ReXQhFOrvSQeNfhrYB/dg3oDwTOcER2fw4I4=
 github.com/Microsoft/hcsshim v0.8.20/go.mod h1:+w2gRZ5ReXQhFOrvSQeNfhrYB/dg3oDwTOcER2fw4I4=
 github.com/Microsoft/hcsshim v0.8.21/go.mod h1:+w2gRZ5ReXQhFOrvSQeNfhrYB/dg3oDwTOcER2fw4I4=
-github.com/Microsoft/hcsshim v0.8.22 h1:CulZ3GW8sNJExknToo+RWD+U+6ZM5kkNfuxywSDPd08=
 github.com/Microsoft/hcsshim v0.8.22/go.mod h1:91uVCVzvX2QD16sMCenoxxXo6L1wJnLMX2PSufFMtF0=
+github.com/Microsoft/hcsshim v0.8.23 h1:47MSwtKGXet80aIn+7h4YI6fwPmwIghAnsx2aOUrG2M=
+github.com/Microsoft/hcsshim v0.8.23/go.mod h1:4zegtUJth7lAvFyc6cH2gGQ5B3OFQim01nnU2M8jKDg=
 github.com/Microsoft/hcsshim/test v0.0.0-20201218223536-d3e5debf77da/go.mod h1:5hlzMzRKMLyo42nCZ9oml8AdTlq/0cvIaBv6tK1RehU=
 github.com/Microsoft/hcsshim/test v0.0.0-20210227013316-43a75bb4edd3/go.mod h1:mw7qgWloBUl75W/gVH3cQszUg1+gUITj7D6NY7ywVnY=
 github.com/NYTimes/gziphandler v0.0.0-20170623195520-56545f4a5d46/go.mod h1:3wb06e3pkSAbeQ52E9H9iFoQsEEwGN64994WTCIhntQ=
@@ -154,6 +155,7 @@ github.com/bugsnag/osext v0.0.0-20130617224835-0dd3f918b21b h1:otBG+dV+YK+Soembj
 github.com/bugsnag/osext v0.0.0-20130617224835-0dd3f918b21b/go.mod h1:obH5gd0BsqsP2LwDJ9aOkm/6J86V6lyAXCoQWGw3K50=
 github.com/bugsnag/panicwrap v0.0.0-20151223152923-e2c28503fcd0 h1:nvj0OLI3YqYXer/kZD8Ri1aaunCxIEsOst1BVJswV0o=
 github.com/bugsnag/panicwrap v0.0.0-20151223152923-e2c28503fcd0/go.mod h1:D/8v3kj0zr8ZAKg1AQ6crr+5VwKN5eIywRkfhyM/+dE=
+github.com/cenkalti/backoff/v4 v4.1.1/go.mod h1:scbssz8iZGpm3xbr14ovlUdkxfGXNInqkPWOWmG2CLw=
 github.com/census-instrumentation/opencensus-proto v0.2.1/go.mod h1:f6KPmirojxKA12rnyqOA5BBL4O983OfeGPqjHWSTneU=
 github.com/cespare/xxhash v1.1.0 h1:a6HrQnmkObjyL+Gs60czilIUGqrzKutQD6XZog3p+ko=
 github.com/cespare/xxhash v1.1.0/go.mod h1:XrSqR1VqqWfGrhpAt58auRo0WTKS1nRRg3ghfAqPWnc=
@@ -211,8 +213,9 @@ github.com/containerd/containerd v1.5.0-beta.4/go.mod h1:GmdgZd2zA2GYIBZ0w09Zvgq
 github.com/containerd/containerd v1.5.0-rc.0/go.mod h1:V/IXoMqNGgBlabz3tHD2TWDoTJseu1FGOKuoA4nNb2s=
 github.com/containerd/containerd v1.5.1/go.mod h1:0DOxVqwDy2iZvrZp2JUx/E+hS0UNTVn7dJnIOwtYR4g=
 github.com/containerd/containerd v1.5.4/go.mod h1:sx18RgvW6ABJ4iYUw7Q5x7bgFOAB9B6G7+yO0XBc4zw=
-github.com/containerd/containerd v1.5.7 h1:rQyoYtj4KddB3bxG6SAqd4+08gePNyJjRqvOIfV3rkM=
 github.com/containerd/containerd v1.5.7/go.mod h1:gyvv6+ugqY25TiXxcZC3L5yOeYgEw0QMhscqVp1AR9c=
+github.com/containerd/containerd v1.5.8 h1:NmkCC1/QxyZFBny8JogwLpOy2f+VEbO/f6bV2Mqtwuw=
+github.com/containerd/containerd v1.5.8/go.mod h1:YdFSv5bTFLpG2HIYmfqDpSYYTDX+mc5qtSuYx1YUb/s=
 github.com/containerd/continuity v0.0.0-20190426062206-aaeac12a7ffc/go.mod h1:GL3xCUCBDV3CZiTSEKksMWbLE66hEyuu9qyDOOqM47Y=
 github.com/containerd/continuity v0.0.0-20190815185530-f2a389ac0a02/go.mod h1:GL3xCUCBDV3CZiTSEKksMWbLE66hEyuu9qyDOOqM47Y=
 github.com/containerd/continuity v0.0.0-20191127005431-f65d91d395eb/go.mod h1:GL3xCUCBDV3CZiTSEKksMWbLE66hEyuu9qyDOOqM47Y=
@@ -247,6 +250,7 @@ github.com/containerd/ttrpc v0.0.0-20190828172938-92c8520ef9f8/go.mod h1:PvCDdDG
 github.com/containerd/ttrpc v0.0.0-20191028202541-4f1b8fe65a5c/go.mod h1:LPm1u0xBw8r8NOKoOdNMeVHSawSsltak+Ihv+etqsE8=
 github.com/containerd/ttrpc v1.0.1/go.mod h1:UAxOpgT9ziI0gJrmKvgcZivgxOp8iFPSk8httJEt98Y=
 github.com/containerd/ttrpc v1.0.2/go.mod h1:UAxOpgT9ziI0gJrmKvgcZivgxOp8iFPSk8httJEt98Y=
+github.com/containerd/ttrpc v1.1.0/go.mod h1:XX4ZTnoOId4HklF4edwc4DcqskFZuvXB1Evzy5KFQpQ=
 github.com/containerd/typeurl v0.0.0-20180627222232-a93fcdb778cd/go.mod h1:Cm3kwCdlkCfMSHURc+r6fwoGH6/F1hH3S4sg0rLFWPc=
 github.com/containerd/typeurl v0.0.0-20190911142611-5eb25027c9fd/go.mod h1:GeKYzf2pQcqv7tJ0AoCuuhtnqhva5LNU3U+OyKxxJpk=
 github.com/containerd/typeurl v1.0.1/go.mod h1:TB1hUtrpaiO88KEK56ijojHS1+NeF0izUACaJW2mdXg=
@@ -1385,8 +1389,9 @@ google.golang.org/protobuf v1.23.1-0.20200526195155-81db48ad09cc/go.mod h1:EGpAD
 google.golang.org/protobuf v1.24.0/go.mod h1:r/3tXBNzIEhYS9I1OUVjXDlt8tc493IdKGjtUeSXeh4=
 google.golang.org/protobuf v1.25.0/go.mod h1:9JNX74DMeImyA3h4bdi1ymwjUzf21/xIlbajtzgsN7c=
 google.golang.org/protobuf v1.26.0-rc.1/go.mod h1:jlhhOSvTdKEhbULTjvd4ARK9grFBp09yW+WbY/TyQbw=
-google.golang.org/protobuf v1.26.0 h1:bxAC2xTBsZGibn2RTntX0oH50xLsqy1OxA9tTL3p/lk=
 google.golang.org/protobuf v1.26.0/go.mod h1:9q0QmTI4eRPtz6boOQmLYwt+qCgq0jsYwAQnmE0givc=
+google.golang.org/protobuf v1.27.1 h1:SnqbnDw1V7RiZcXPx5MEeqPv2s79L9i7BJUlG/+RurQ=
+google.golang.org/protobuf v1.27.1/go.mod h1:9q0QmTI4eRPtz6boOQmLYwt+qCgq0jsYwAQnmE0givc=
 gopkg.in/airbrake/gobrake.v2 v2.0.9/go.mod h1:/h5ZAUhDkGaJfjzjKLSjv6zCL6O0LLBxU4K+aSYdM/U=
 gopkg.in/alecthomas/kingpin.v2 v2.2.6/go.mod h1:FMv+mEhP44yOT+4EoQTLFTRgOQ1FBLkstjWtayDeSgw=
 gopkg.in/check.v1 v0.0.0-20161208181325-20d25e280405/go.mod h1:Co6ibVJAznAaIkqp8huTwlJQCZ016jof/cbN4VW5Yz0=
```

---

### Incident Patch 4: `c0b68648` (2021-11-17)
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

### Incident Patch 5: `2f5ae277` (2021-11-01)
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
-			return nil, fmt.Errorf("unknown NVIDIA_DRIVER_CAPABILITIES value: %s", cap)
 		}
 	}
 
-	// One --require flag for each NVIDIA_REQUIRE_* environment
-	// https://github.com/nvidia/nvidia-container-runtime#nvidia_require_
-	if val := os.Getenv("NVIDIA_DISABLE_REQUIRE"); val == "" {
-		for _, e := range os.Environ() {
-			if strings.HasPrefix(e, "NVIDIA_REQUIRE_") {
-				req := strings.SplitN(e, "=", 2)[1]
-				flags = append(flags, "--require="+req)
-			}
-		}
+	if !disableRequire {
+		flags = append(flags, requireFlags...)
 	}
 
 	return flags, nil
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

### Incident Patch 6: `dca65113` (2021-11-16)
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

### Incident Patch 7: `7915a504` (2021-06-23)
**Commit Message**: build(deps): use github.com/sylabs/sif/v2

**File**: `cmd/internal/cli/inspect.go` (modified, +2/-2)
```diff
@@ -1,4 +1,4 @@
-// Copyright (c) 2018-2020, Sylabs Inc. All rights reserved.
+// Copyright (c) 2018-2021, Sylabs Inc. All rights reserved.
 // This software is licensed under a 3-clause BSD license. Please consult the
 // LICENSE.md file distributed with the sources of this project regarding your
 // rights to use or distribute this software.
@@ -19,7 +19,7 @@ import (
 	"sort"
 	"strings"
 
-	"github.com/hpcng/sif/pkg/sif"
+	"github.com/hpcng/sif/v2/pkg/sif"
 	"github.com/hpcng/singularity/docs"
 	"github.com/hpcng/singularity/internal/pkg/util/env"
 	"github.com/hpcng/singularity/pkg/cmdline"
```

**File**: `cmd/internal/cli/pgp.go` (modified, +16/-28)
```diff
@@ -1,5 +1,5 @@
 // Copyright (c) 2020, Control Command Inc. All rights reserved.
-// Copyright (c) 2020, Sylabs Inc. All rights reserved.
+// Copyright (c) 2020-2021, Sylabs Inc. All rights reserved.
 // This software is licensed under a 3-clause BSD license. Please consult the LICENSE.md file
 // distributed with the sources of this project regarding your rights to use or distribute this
 // software.
@@ -16,15 +16,15 @@ import (
 
 	"github.com/hpcng/singularity/internal/pkg/buildcfg"
 
+	"github.com/ProtonMail/go-crypto/openpgp"
+	"github.com/ProtonMail/go-crypto/openpgp/packet"
 	"github.com/fatih/color"
-	"github.com/hpcng/sif/pkg/integrity"
-	"github.com/hpcng/sif/pkg/sif"
+	"github.com/hpcng/sif/v2/pkg/integrity"
+	"github.com/hpcng/sif/v2/pkg/sif"
 	"github.com/hpcng/singularity/internal/app/singularity"
 	"github.com/hpcng/singularity/internal/pkg/util/interactive"
 	"github.com/hpcng/singularity/pkg/sylog"
 	"github.com/hpcng/singularity/pkg/sypgp"
-	"golang.org/x/crypto/openpgp"
-	"golang.org/x/crypto/openpgp/packet"
 )
 
 var (
@@ -175,28 +175,22 @@ func outputVerify(f *sif.FileImage, r integrity.VerifyResult) bool {
 		fmt.Printf("%-4s|%-8s|%-8s|%s\n", "ID", "GROUP", "LINK", "TYPE")
 		fmt.Print("------------------------------------------------\n")
 	}
-	for _, id := range r.Verified() {
-		od, _, err := f.GetFromDescrID(id)
-		if err != nil {
-			sylog.Errorf("failed to get descriptor: %v", err)
-			return false
-		}
-
+	for _, od := range r.Verified() {
 		group := "NONE"
-		if gid := od.Groupid; gid != sif.DescrUnusedGroup {
-			group = fmt.Sprintf("%d", gid&^sif.DescrGroupMask)
+		if gid := od.GroupID(); gid != 0 {
+			group = fmt.Sprintf("%d", gid)
 		}
 
 		link := "NONE"
-		if l := od.Link; l != sif.DescrUnusedLink {
-			if l&sif.DescrGroupMask == sif.DescrGroupMask {
-				link = fmt.Sprintf("%d (G)", l&^sif.DescrGroupMask)
+		if l, isGroup := od.LinkedID(); l != 0 {
+			if isGroup {
+				link = fmt.Sprintf("%d (G)", l)
 			} else {
 				link = fmt.Sprintf("%d", l)
 			}
 		}
 
-		fmt.Printf("%-4d|%-8s|%-8s|%s\n", id, group, link, od.Datatype)
+		fmt.Printf("%-4d|%-8s|%-8s|%s\n", od.ID(), group, link, od.DataType())
 	}
 
 	if err := r.Error(); err != nil {
@@ -246,15 +240,9 @@ func getJSONCallback(kl *keyList) singularity.VerifyCallback {
 		}
 
 		// For each verified object, append an entry to the list.
-		for _, id := range r.Verified() {
-			od, _, err := f.GetFromDescrID(id)
-			if err != nil {
-				sylog.Errorf("failed to get descriptor: %v", err)
-				continue
-			}
-
+		for _, od := range r.Verified() {
 			ke := keyEntity{
-				Partition:   od.Datatype.String(),
+				Partition:   od.DataType().String(),
 				Name:        name,
 				Fingerprint: fp,
 				KeyLocal:    keyLocal,
@@ -266,14 +254,14 @@ func getJSONCallback(kl *keyList) singularity.VerifyCallback {
 
 		var integrityError *integrity.ObjectIntegrityError
 		if errors.As(r.Error(), &integrityError) {
-			od, _, err := f.GetFromDescrID(integrityError.ID)
+			od, err := f.GetDescriptor(sif.WithID(integrityError.ID))
 			if err != nil {
 				sylog.Errorf("failed to get descriptor: %v", err)
 				return false
 			}
 
 			ke := keyEntity{
-				Partition:   od.Datatype.String(),
+				Partition:   od.DataType().String(),
 				Name:        name,
 				Fingerprint: fp,
 				KeyLocal:    keyLocal,
```

**File**: `cmd/internal/cli/siftool.go` (modified, +15/-7)
```diff
@@ -1,21 +1,29 @@
-// Copyright (c) 2019, Sylabs Inc. All rights reserved.
+// Copyright (c) 2019-2021, Sylabs Inc. All rights reserved.
 // This software is licensed under a 3-clause BSD license. Please consult the
 // LICENSE.md file distributed with the sources of this project regarding your
 // rights to use or distribute this software.
 
 package cli
 
 import (
-	"github.com/hpcng/sif/pkg/siftool"
+	"github.com/hpcng/sif/v2/pkg/siftool"
+	"github.com/hpcng/singularity/docs"
 	"github.com/hpcng/singularity/pkg/cmdline"
+	"github.com/spf13/cobra"
 )
 
-// SiftoolCmd is easily set since the sif repo allows the cobra.Command struct to be
-// easily accessed with Siftool(), we do not need to do anything but call that function.
-var SiftoolCmd = siftool.Siftool()
-
 func init() {
 	addCmdInit(func(cmdManager *cmdline.CommandManager) {
-		cmdManager.RegisterCmd(SiftoolCmd)
+		cmd := &cobra.Command{
+			Use:                   docs.SIFUse,
+			Aliases:               []string{docs.SIFAlias},
+			Short:                 docs.SIFShort,
+			Long:                  docs.SIFLong,
+			Example:               docs.SIFExample,
+			DisableFlagsInUseLine: true,
+		}
+		siftool.AddCommands(cmd)
+
+		cmdManager.RegisterCmd(cmd)
 	})
 }
```

**File**: `docs/content.go` (modified, +17/-1)
```diff
@@ -1,4 +1,4 @@
-// Copyright (c) 2017-2020, Sylabs Inc. All rights reserved.
+// Copyright (c) 2017-2021, Sylabs Inc. All rights reserved.
 // This software is licensed under a 3-clause BSD license. Please consult the
 // LICENSE.md file distributed with the sources of this project regarding your
 // rights to use or distribute this software.
@@ -1062,3 +1062,19 @@ Enterprise Performance Computing (EPC)`
   To create a single EXT3 writable overlay image:
   $ singularity overlay create --size 1024 /tmp/my_overlay.img`
 )
+
+// Documentation for sif/siftool command.
+const (
+	SIFUse   string = `sif`
+	SIFAlias string = `siftool`
+	SIFShort string = `Manipulate Singularity Image Format (SIF) images`
+	SIFLong  string = `
+  A set of commands are provided to display elements such as the SIF global
+  header, the data object descriptors and to dump data objects. It is also
+  possible to modify a SIF file via this tool via the add/del commands.`
+	SIFExample string = `
+  All sif commands have their own help output:
+
+  $ singularity help sif list
+  $ singularity sif list --help`
+)
```

**File**: `go.mod` (modified, +4/-5)
```diff
@@ -4,6 +4,7 @@ go 1.16
 
 require (
 	github.com/Netflix/go-expect v0.0.0-20190729225929-0e00d9168667
+	github.com/ProtonMail/go-crypto v0.0.0-20210707164159-52430bf6b52c
 	github.com/adigunhammedolalekan/registry-auth v0.0.0-20200730122110-8cde180a3a60
 	github.com/apex/log v1.9.0
 	github.com/blang/semver/v4 v4.0.0
@@ -19,7 +20,7 @@ require (
 	github.com/go-log/log v0.2.0
 	github.com/google/uuid v1.3.0
 	github.com/gorilla/websocket v1.4.2
-	github.com/hpcng/sif v1.6.0
+	github.com/hpcng/sif/v2 v2.0.0
 	github.com/kr/pty v1.1.8
 	github.com/moby/sys/mount v0.2.0 // indirect
 	github.com/opencontainers/go-digest v1.0.0
@@ -30,7 +31,7 @@ require (
 	github.com/opencontainers/umoci v0.4.7
 	github.com/pelletier/go-toml v1.9.4
 	github.com/pkg/errors v0.9.1
-	github.com/satori/go.uuid v1.2.1-0.20180404165556-75cca531ea76
+	github.com/russross/blackfriday/v2 v2.1.0 // indirect
 	github.com/seccomp/containers-golang v0.6.0
 	github.com/seccomp/libseccomp-golang v0.9.1
 	github.com/spf13/cobra v1.2.1
@@ -39,19 +40,17 @@ require (
 	github.com/sylabs/scs-build-client v0.2.1
 	github.com/sylabs/scs-key-client v0.6.2
 	github.com/sylabs/scs-library-client v1.0.5
+	github.com/urfave/cli v1.22.5 // indirect
 	github.com/vbauerster/mpb/v4 v4.12.2
 	github.com/vbauerster/mpb/v6 v6.0.4
 	github.com/xeipuuv/gojsonpointer v0.0.0-20190905194746-02993c407bfb // indirect
 	github.com/yvasiyarov/go-metrics v0.0.0-20150112132944-c25f46c4b940 // indirect
 	github.com/yvasiyarov/gorelic v0.0.6 // indirect
 	github.com/yvasiyarov/newrelic_platform_go v0.0.0-20160601141957-9c099fbc30e9 // indirect
-	golang.org/x/crypto v0.0.0-20210921155107-089bfa567519
 	golang.org/x/sys v0.0.0-20210925032602-92d5a993a665
 	golang.org/x/term v0.0.0-20210916214954-140adaaadfaf
 	gopkg.in/yaml.v2 v2.4.0
 	gotest.tools/v3 v3.0.3
 	mvdan.cc/sh/v3 v3.4.1-0.20211012151248-7e067a88c992
 	oras.land/oras-go v0.5.0
 )
-
-replace golang.org/x/crypto => github.com/hpcng/golang-x-crypto v0.0.0-20210830200829-e6b35e3fb874
```

**File**: `go.sum` (modified, +60/-7)
```diff
@@ -92,6 +92,9 @@ github.com/NYTimes/gziphandler v0.0.0-20170623195520-56545f4a5d46/go.mod h1:3wb0
 github.com/Netflix/go-expect v0.0.0-20190729225929-0e00d9168667 h1:l2RCK7mjLhjfZRIcCXTVHI34l67IRtKASBjusViLzQ0=
 github.com/Netflix/go-expect v0.0.0-20190729225929-0e00d9168667/go.mod h1:oX5x61PbNXchhh0oikYAH+4Pcfw5LKv21+Jnpr6r6Pc=
 github.com/OneOfOne/xxhash v1.2.2/go.mod h1:HSdplMjZKSmBqAxg5vPj2TmRDmfkzw+cTzAElWljhcU=
+github.com/ProtonMail/go-crypto v0.0.0-20210428141323-04723f9f07d7/go.mod h1:z4/9nQmJSSwwds7ejkxaJwO37dru3geImFUdJlaLzQo=
+github.com/ProtonMail/go-crypto v0.0.0-20210707164159-52430bf6b52c h1:FP7mMdsXy0ybzar1sJeIcZtaJka0U/ZmLTW4wRpolYk=
+github.com/ProtonMail/go-crypto v0.0.0-20210707164159-52430bf6b52c/go.mod h1:z4/9nQmJSSwwds7ejkxaJwO37dru3geImFUdJlaLzQo=
 github.com/PuerkitoBio/purell v1.1.1/go.mod h1:c11w/QuzBsJSee3cPx9rAFu61PvFxuPbtSwDGJws/X0=
 github.com/PuerkitoBio/urlesc v0.0.0-20170810143723-de5bf2ad4578/go.mod h1:uGdkoq3SwY9Y+13GIhn11/XLaGBb4BfwItxLd5jeuXE=
 github.com/Shopify/logrus-bugsnag v0.0.0-20171204204709-577dee27f20d h1:UrqY+r/OJnIp5u0s1SbQ8dVfLCZJsnvazdBP5hS4iRs=
@@ -101,6 +104,7 @@ github.com/VividCortex/ewma v1.2.0 h1:f58SaIzcDXrSy3kWaHNvuJgJ3Nmz59Zji6XoJR/q1o
 github.com/VividCortex/ewma v1.2.0/go.mod h1:nz4BbCtbLyFDeC9SUHbtcT5644juEuWfUAUnGx7j5l4=
 github.com/acarl005/stripansi v0.0.0-20180116102854-5a71ef0e047d h1:licZJFw2RwpHMqeKTCYkitsPqHNxTmd4SNR5r94FGM8=
 github.com/acarl005/stripansi v0.0.0-20180116102854-5a71ef0e047d/go.mod h1:asat636LX7Bqt5lYEZ27JNDcqxfjdBQuJ/MM4CN/Lzo=
+github.com/acomagu/bufpipe v1.0.3/go.mod h1:mxdxdup/WdsKVreO5GpW4+M/1CE2sMG4jeGJ2sYmHc4=
 github.com/adigunhammedolalekan/registry-auth v0.0.0-20200730122110-8cde180a3a60 h1:1IG6ye8dellBRE2uqvG0EzQScRqjsH/n5xOw+n0OGec=
 github.com/adigunhammedolalekan/registry-auth v0.0.0-20200730122110-8cde180a3a60/go.mod h1:DcXj4IQOoib2b4G2b8JU3VGV3ljXYbIq+PH4CcoAQTI=
 github.com/alecthomas/template v0.0.0-20160405071501-a0175ee3bccc/go.mod h1:LOuyumcjzFXgccqObfd/Ljyb9UuFJ6TxHnclSeseNhc=
@@ -110,6 +114,7 @@ github.com/alecthomas/units v0.0.0-20190717042225-c3de453c63f4/go.mod h1:ybxpYRF
 github.com/alexflint/go-filemutex v0.0.0-20171022225611-72bdc8eae2ae/go.mod h1:CgnQgUtFrFz9mxFNtED3jI5tLDjKlOM+oUF/sTk6ps0=
 github.com/alexflint/go-filemutex v1.1.0 h1:IAWuUuRYL2hETx5b8vCgwnD+xSdlsTQY6s2JjBsqLdg=
 github.com/alexflint/go-filemutex v1.1.0/go.mod h1:7P4iRhttt/nUvUOrYIhcpMzv2G6CY9UnI16Z+UJqRyk=
+github.com/anmitsu/go-shlex v0.0.0-20161002113705-648efa622239/go.mod h1:2FmKhYUyUczH0OGQWaF5ceTx0UBShxjsH6f8oGKYe2c=
 github.com/antihax/optional v1.0.0/go.mod h1:uupD/76wgC+ih3iEmQUL+0Ugr19nfwCT1kdvxnR2qWY=
 github.com/apex/log v1.4.0/go.mod h1:UMNC4vQNC7hb5gyr47r18ylK1n34rV7GO+gb0wpXvcE=
 github.com/apex/log v1.9.0 h1:FHtw/xuaM8AgmvDDTI9fiwoAL25Sq2cxojnZICUU8l0=
@@ -122,6 +127,7 @@ github.com/armon/circbuf v0.0.0-20150827004946-bbbad097214e/go.mod h1:3U/XgcO3hC
 github.com/armon/consul-api v0.0.0-20180202201655-eb2c6b5be1b6/go.mod h1:grANhF5doyWs3UAsr3K4I6qtAmlQcZDesFNEHPZAzj8=
 github.com/armon/go-metrics v0.0.0-20180917152333-f0300d1749da/go.mod h1:Q73ZrmVTwzkszR9V5SSuryQ31EELlFMUz1kKyl939pY=
 github.com/armon/go-radix v0.0.0-20180808171621-7fddfc383310/go.mod h1:ufUuZ+zHj4x4TnLV4JWEpy2hxWSpsRywHrMgIH9cCH8=
+github.com/armon/go-socks5 v0.0.0-20160902184237-e75332964ef5/go.mod h1:wHh0iHkYZB8zMSxRWpUBQtwG5a7fFgvEO+odwuTv2gs=
 github.com/asaskevich/govalidator v0.0.0-20190424111038-f61b66f89f4a/go.mod h1:lB+ZfQJz7igIIfQNfa7Ml4HSf2uFQQRzpGGRXenZAgY=
 github.com/aws/aws-sdk-go v1.15.11/go.mod h1:mFuSZ37Z9YOHbQEwBWztmVzqXrEkub65tZoCYDt7FT0=
 github.com/aws/aws-sdk-go v1.20.6/go.mod h1:KmX6BPdI08NWTb3/sm4ZGu5ShLoqVDhKgpiN924inxo=
@@ -355,6 +361,7 @@ github.com/dustin/go-humanize v1.0.0/go.mod h1:HtrtbFcZ19U5GC7JDqmcUSB87Iq5E25Kn
 github.com/elazarl/goproxy v0.0.0-20180725130230-947c36da3153/go.mod h1:/Zj4wYkgs4iZTTu3o/KG3Itv/qCCa8VVMlb3i9OVuzc=
 github.com/emicklei/go-restful v0.0.0-20170410110728-ff4f55a20633/go.mod h1:otzb+WCGbkyDHkqmQmT5YD2WR4BBwUdeQoFo8l/7tVs=
 github.com/emicklei/go-restful v2.9.5+incompatible/go.mod h1:otzb+WCGbkyDHkqmQmT5YD2WR4BBwUdeQoFo8l/7tVs=
+github.com/emirpasic/gods v1.12.0/go.mod h1:YfzfFFoVP/catgzJb4IKIqXjX78Ha8FMSDh3ymbK86o=
 github.com/envoyproxy/go-control-plane v0.9.0/go.mod h1:YTl/9mNaCwkRvm6d1a2C3ymFceY/DCBVvsKhRF0iEA4=
 github.com/envoyproxy/go-control-plane v0.9.1-0.20191026205805-5f8ba28d4473/go.mod h1:YTl/9mNaCwkRvm6d1a2C3ymFceY/DCBVvsKhRF0iEA4=
 github.com/envoyproxy/go-control-plane v0.9.4/go.mod h1:6rpuAdCZL397s3pYoYcLgu1mIlRU8Am5FuJP05cCM98=
@@ -367,6 +374,7 @@ github.com/fatih/color v1.7.0/go.mod h1:Zm6kSWBoL9eyXnKyktHP6abPY2pDugNf5Kwzbycv
 github.com/fatih/color v1.9.0/go.mod h1:eQcE1qtQxscV5RaZvpXrrb8Drkc3/DdQ+uUYCNjL+zU=
 github.com/fatih/color v1.13.0 h1:8LOYc1KYPPmyKMuN8QV2DNRWNbLo6LZ0iLs8+mlH53w=
 github.com/fatih/color v1.13.0/go.mod h1:kLAiJbzzSOZDVNGyDpeOxJ47H46qBXwg5ILebYFFOfk=
+github.com/flynn/go-shlex v0.0.0-20150515145356-3f9db97f8568/go.mod h1:xEzjJPgXI435gkrC
```

**File**: `internal/app/singularity/overlay_create.go` (modified, +44/-33)
```diff
@@ -1,3 +1,8 @@
+// Copyright (c) 2021, Sylabs Inc. All rights reserved.
+// This software is licensed under a 3-clause BSD license. Please consult the
+// LICENSE.md file distributed with the sources of this project regarding your
+// rights to use or distribute this software.package singularity
+
 package singularity
 
 import (
@@ -10,7 +15,7 @@ import (
 	"runtime"
 	"strings"
 
-	"github.com/hpcng/sif/pkg/sif"
+	"github.com/hpcng/sif/v2/pkg/sif"
 	"github.com/hpcng/singularity/internal/pkg/util/bin"
 	"github.com/hpcng/singularity/pkg/image"
 	"golang.org/x/sys/unix"
@@ -21,26 +26,48 @@ const (
 	ddBinary   = "dd"
 )
 
-func sifInfo(img *os.File) (string, bool, error) {
-	fimg, err := sif.LoadContainerFp(img, true)
+// isSigned returns true if the SIF in rw contains one or more signature objects.
+func isSigned(rw sif.ReadWriter) (bool, error) {
+	f, err := sif.LoadContainer(rw,
+		sif.OptLoadWithFlag(os.O_RDONLY),
+		sif.OptLoadWithCloseOnUnload(false),
+	)
 	if err != nil {
-		return "", false, err
+		return false, err
 	}
+	defer f.UnloadContainer()
+
+	sigs, err := f.GetDescriptors(sif.WithDataType(sif.DataSignature))
+	return len(sigs) > 0, err
+}
 
-	arch := string(fimg.Header.Arch[:sif.HdrArchLen-1])
-	if arch == sif.HdrArchUnknown {
-		arch = sif.GetSIFArch(runtime.GOARCH)
+// addOverlayToImage adds the EXT3 overlay at overlayPath to the SIF image at imagePath.
+func addOverlayToImage(imagePath, overlayPath string) error {
+	f, err := sif.LoadContainerFromPath(imagePath)
+	if err != nil {
+		return err
 	}
+	defer f.UnloadContainer()
 
-	signed := false
-	for _, desc := range fimg.DescrArr {
-		if desc.Datatype == sif.DataSignature && desc.Link == sif.DescrDefaultGroup {
-			signed = true
-			break
-		}
+	tf, err := os.Open(overlayPath)
+	if err != nil {
+		return err
+	}
+	defer tf.Close()
+
+	arch := f.PrimaryArch()
+	if arch == "unknown" {
+		arch = runtime.GOARCH
+	}
+
+	di, err := sif.NewDescriptorInput(sif.DataPartition, tf,
+		sif.OptPartitionMetadata(sif.FsExt3, sif.PartOverlay, arch),
+	)
+	if err != nil {
+		return err
 	}
 
-	return arch, signed, fimg.UnloadContainer()
+	return f.AddObject(di)
 }
 
 func OverlayCreate(size int, imgPath string, overlayDirs ...string) error {
@@ -70,7 +97,6 @@ func OverlayCreate(size int, imgPath string, overlayDirs ...string) error {
 	}
 
 	sifImage := false
-	sifArch := ""
 
 	if err := unix.Access(imgPath, unix.W_OK); err == nil {
 		img, err := image.Init(imgPath, false)
@@ -90,13 +116,12 @@ func OverlayCreate(size int, imgPath string, overlayDirs ...string) error {
 			if err != nil {
 				return fmt.Errorf("while getting SIF overlay partitions: %s", err)
 			}
-			arch, signed, err := sifInfo(img.File)
+			signed, err := isSigned(img.File)
 			if err != nil {
 				return fmt.Errorf("while getting SIF info: %s", err)
 			} else if signed {
 				return fmt.Errorf("SIF image %s is signed: could not add writable overlay", imgPath)
 			}
-			sifArch = arch
 
 			img.File.Close()
 
@@ -179,22 +204,8 @@ func OverlayCreate(size int, imgPath string, overlayDirs ...string) error {
 	errBuf.Reset()
 
 	if sifImage {
-		self, err := os.Executable()
-		if err != nil {
-			return fmt.Errorf("while determining current executable path: %s", err)
-		}
-
-		args := []string{
-			"sif", "add",
-			"--datatype", "4", "--partfs", "2",
-			"--parttype", "4", "--partarch", sifArch,
-			"--groupid", "1",
-			imgPath, tmpFile,
-		}
-		cmd = exec.Command(self, args...)
-		cmd.Stderr = errBuf
-		if err := cmd.Run(); err != nil {
-			return fmt.Errorf("while adding ext3 overlay partition to %s: %s\nCommand error: %s", imgPath, err, errBuf)
+		if err := addOverlayToImage(imgPath, tmpFile); err != nil {
+			return fmt.Errorf("while adding ext3 overlay partition to %s: %w", imgPath, err)
 		}
 	} else {
 		if err := os.Rename(tmpFile, imgPath); err != nil {
```

**File**: `internal/app/singularity/plugin_compile_linux.go` (modified, +24/-101)
```diff
@@ -10,7 +10,6 @@ import (
 	"encoding/json"
 	"errors"
 	"fmt"
-	"io"
 	"io/ioutil"
 	"os"
 	"os/exec"
@@ -19,14 +18,13 @@ import (
 	"runtime/debug"
 	"strings"
 
-	"github.com/hpcng/sif/pkg/sif"
+	"github.com/hpcng/sif/v2/pkg/sif"
 	"github.com/hpcng/singularity/internal/pkg/buildcfg"
 	"github.com/hpcng/singularity/internal/pkg/plugin"
 	"github.com/hpcng/singularity/internal/pkg/util/bin"
 	pluginapi "github.com/hpcng/singularity/pkg/plugin"
 	"github.com/hpcng/singularity/pkg/sylog"
 	"github.com/hpcng/singularity/pkg/util/archive"
-	uuid "github.com/satori/go.uuid"
 )
 
 const version = "v0.0.0"
@@ -276,49 +274,45 @@ func generateManifest(sourceDir string, bTool buildToolchain) error {
 // makeSIF takes in two arguments: sourceDir, the path to the plugin source directory;
 // and sifPath, the path to the final .sif file which is ready to be used.
 func makeSIF(sourceDir, sifPath string) error {
-	id, err := uuid.NewV4()
-	if err != nil {
-		return fmt.Errorf("sif id generation failed: %v", err)
-	}
+	objPath := pluginObjPath(sourceDir)
 
-	plCreateInfo := sif.CreateInfo{
-		Pathname:   sifPath,
-		Launchstr:  sif.HdrLaunch,
-		Sifversion: sif.HdrVersion,
-		ID:         id,
+	fp, err := os.Open(objPath)
+	if err != nil {
+		return fmt.Errorf("while opening plugin object file %v: %w", objPath, err)
 	}
+	defer fp.Close()
 
-	// create plugin object file descriptor
-	plObjInput, err := getPluginObjDescr(pluginObjPath(sourceDir))
+	plObjInput, err := sif.NewDescriptorInput(sif.DataPartition, fp,
+		sif.OptObjectName("plugin.so"),
+		sif.OptPartitionMetadata(sif.FsRaw, sif.PartData, runtime.GOARCH),
+	)
 	if err != nil {
 		return err
 	}
 
-	if fp, ok := plObjInput.Fp.(io.Closer); ok {
-		defer fp.Close()
-	}
+	// create plugin manifest descriptor
+	manifestPath := pluginManifestPath(sourceDir)
 
-	// add plugin object file descriptor to sif
-	plCreateInfo.InputDescr = append(plCreateInfo.InputDescr, plObjInput)
+	fp, err = os.Open(manifestPath)
+	if err != nil {
+		return fmt.Errorf("while opening plugin manifest file %v: %w", manifestPath, err)
+	}
+	defer fp.Close()
 
-	// create plugin manifest descriptor
-	plManifestInput, err := getPluginManifestDescr(pluginManifestPath(sourceDir))
+	plManifestInput, err := sif.NewDescriptorInput(sif.DataGenericJSON, fp,
+		sif.OptObjectName("plugin.manifest"),
+	)
 	if err != nil {
 		return err
 	}
-	if fp, ok := plManifestInput.Fp.(io.Closer); ok {
-		defer fp.Close()
-	}
-
-	// add plugin manifest descriptor to sif
-	plCreateInfo.InputDescr = append(plCreateInfo.InputDescr, plManifestInput)
 
 	os.RemoveAll(sifPath)
 
-	// create sif file
-	f, err := sif.CreateContainer(plCreateInfo)
+	f, err := sif.CreateContainerAtPath(sifPath,
+		sif.OptCreateWithDescriptors(plObjInput, plManifestInput),
+	)
 	if err != nil {
-		return fmt.Errorf("while creating sif file: %s", err)
+		return fmt.Errorf("while creating sif file: %w", err)
 	}
 
 	if err := f.UnloadContainer(); err != nil {
@@ -327,74 +321,3 @@ func makeSIF(sourceDir, sifPath string) error {
 
 	return nil
 }
-
-// getPluginObjDescr returns a sif.DescriptorInput which contains the raw
-// data of the .so file.
-//
-// Datatype: sif.DataPartition
-// Fstype:   sif.FsRaw
-// Parttype: sif.PartData
-func getPluginObjDescr(objPath string) (sif.DescriptorInput, error) {
-	var err error
-
-	objInput := sif.DescriptorInput{
-		Datatype: sif.DataPartition,
-		Groupid:  sif.DescrDefaultGroup,
-		Link:     sif.DescrUnusedLink,
-		Fname:    objPath,
-	}
-
-	// open plugin object file
-	fp, err := os.Open(objInput.Fname)
-	if err != nil {
-		return sif.DescriptorInput{}, fmt.Errorf("while opening plugin object file %s: %s", objInput.Fname, err)
-	}
-
-	// stat file to obtain size
-	fstat, err := fp.Stat()
-	if err != nil {
-		return sif.DescriptorInput{}, fmt.Errorf("while calling stat on plugin object file %s: %s", objInput.Fname, err)
-	}
-
-	objInput.Fp = fp
-	objInput.Size = fstat.Size()
-
-	// populate objInput.Extra with appropriate Fstype & Parttype
-	err = objInput.SetPartExtra(sif.FsRaw, sif.PartData, sif.GetSIFArch(runtime.GOARCH))
-	if err != nil {
-		return sif.DescriptorInput{}, err
-	}
-
-	return objInput, nil
-}
-
-// getPluginManifestDescr returns a sif.DescriptorInput which contains the manifest
-// in JSON form. Grabbing the Manifest is done by loading the .so using the plugin
-// package, which is performed inside the container during buildPlugin() function
-//
-// Datatype: sif.DataGenericJSON
-func getPluginManifestDescr(manifestPath string) (sif.DescriptorInput, error) {
-	manifestInput := sif.DescriptorInput{
-		Datatype: sif.DataGenericJSON,
-		Groupid:  sif.DescrDefaultGroup,
-		Link:     sif.DescrUnusedLink,
-		Fname:    manifestPath,
-	}
-
-	// open plugin object file
-	fp, err := os.Open(manifestInput.Fname)
-	if err != nil {
-		return sif.DescriptorInput{}, fmt.Errorf("while opening plugin object file %s: %s", manifestInput.Fname, err)
-	}
-
-	// stat file to obtain size
-	fstat, err := fp.Sta
```

---

### Incident Patch 8: `66ea4de5` (2021-08-31)
**Commit Message**: build(deps): replace golang.org/x/crypto/ssh/terminal with golang.org/x/term

**File**: `cmd/internal/cli/singularity.go` (modified, +2/-2)
```diff
@@ -35,7 +35,7 @@ import (
 	scsbuildclient "github.com/sylabs/scs-build-client/client"
 	scskeyclient "github.com/sylabs/scs-key-client/client"
 	scslibclient "github.com/sylabs/scs-library-client/client"
-	"golang.org/x/crypto/ssh/terminal"
+	"golang.org/x/term"
 )
 
 // cmdInits holds all the init function to be called
@@ -254,7 +254,7 @@ func setSylogMessageLevel() {
 	}
 
 	color := true
-	if nocolor || !terminal.IsTerminal(2) {
+	if nocolor || !term.IsTerminal(2) {
 		color = false
 	}
 
```

**File**: `go.mod` (modified, +1/-0)
```diff
@@ -47,6 +47,7 @@ require (
 	github.com/yvasiyarov/newrelic_platform_go v0.0.0-20160601141957-9c099fbc30e9 // indirect
 	golang.org/x/crypto v0.0.0-20210921155107-089bfa567519
 	golang.org/x/sys v0.0.0-20210925032602-92d5a993a665
+	golang.org/x/term v0.0.0-20210916214954-140adaaadfaf
 	gopkg.in/yaml.v2 v2.4.0
 	gotest.tools/v3 v3.0.3
 	mvdan.cc/sh/v3 v3.4.1-0.20211012151248-7e067a88c992
```

**File**: `internal/app/singularity/oci_attach_linux.go` (modified, +6/-6)
```diff
@@ -1,4 +1,4 @@
-// Copyright (c) 2018-2020, Sylabs Inc. All rights reserved.
+// Copyright (c) 2018-2021, Sylabs Inc. All rights reserved.
 // This software is licensed under a 3-clause BSD license. Please consult the
 // LICENSE.md file distributed with the sources of this project regarding your
 // rights to use or distribute this software.
@@ -24,7 +24,7 @@ import (
 	"github.com/hpcng/singularity/pkg/sylog"
 	"github.com/hpcng/singularity/pkg/util/unix"
 	specs "github.com/opencontainers/runtime-spec/specs-go"
-	"golang.org/x/crypto/ssh/terminal"
+	"golang.org/x/term"
 )
 
 func resize(controlSocket string, oversized bool) {
@@ -65,7 +65,7 @@ func resize(controlSocket string, oversized bool) {
 }
 
 func attach(engineConfig *oci.EngineConfig, run bool) error {
-	var ostate *terminal.State
+	var ostate *term.State
 	var conn net.Conn
 	var wg sync.WaitGroup
 
@@ -79,7 +79,7 @@ func attach(engineConfig *oci.EngineConfig, run bool) error {
 	}
 
 	hasTerminal := engineConfig.OciConfig.Process.Terminal
-	if hasTerminal && !terminal.IsTerminal(0) {
+	if hasTerminal && !term.IsTerminal(0) {
 		return fmt.Errorf("attach requires a terminal when terminal config is set to true")
 	}
 
@@ -91,7 +91,7 @@ func attach(engineConfig *oci.EngineConfig, run bool) error {
 	defer conn.Close()
 
 	if hasTerminal {
-		ostate, _ = terminal.MakeRaw(0)
+		ostate, _ = term.MakeRaw(0)
 		resize(state.ControlSocket, true)
 		resize(state.ControlSocket, false)
 	}
@@ -130,7 +130,7 @@ func attach(engineConfig *oci.EngineConfig, run bool) error {
 
 		if hasTerminal {
 			fmt.Printf("\r")
-			return terminal.Restore(0, ostate)
+			return term.Restore(0, ostate)
 		}
 		return nil
 	}
```

**File**: `internal/pkg/runtime/engine/singularity/container_linux.go` (modified, +2/-2)
```diff
@@ -41,8 +41,8 @@ import (
 	"github.com/hpcng/singularity/pkg/util/singularityconf"
 	"github.com/hpcng/singularity/pkg/util/slice"
 	specs "github.com/opencontainers/runtime-spec/specs-go"
-	"golang.org/x/crypto/ssh/terminal"
 	"golang.org/x/sys/unix"
+	"golang.org/x/term"
 )
 
 // global variables used by master process only at various steps:
@@ -1360,7 +1360,7 @@ func (c *container) addDevMount(system *mount.System) error {
 		}
 		// add /dev/console mount pointing to original tty if there is one
 		for fd := 0; fd <= 2; fd++ {
-			if !terminal.IsTerminal(fd) {
+			if !term.IsTerminal(fd) {
 				continue
 			}
 			// Found a tty on stdin, stdout, or stderr.
```

**File**: `internal/pkg/runtime/engine/singularity/process_linux.go` (modified, +3/-3)
```diff
@@ -42,8 +42,8 @@ import (
 	"github.com/hpcng/singularity/pkg/sylog"
 	"github.com/hpcng/singularity/pkg/util/rlimit"
 	specs "github.com/opencontainers/runtime-spec/specs-go"
-	"golang.org/x/crypto/ssh/terminal"
 	"golang.org/x/sys/unix"
+	"golang.org/x/term"
 	"mvdan.cc/sh/v3/interp"
 )
 
@@ -87,7 +87,7 @@ func (e *EngineOperations) StartProcess(masterConnFd int) error {
 		//   place.  Also, programs that don't use ttyname() and instead
 		//   directly do readlink() on /proc/self/fd/X need this.
 		for fd := 0; fd <= 2; fd++ {
-			if !terminal.IsTerminal(fd) {
+			if !term.IsTerminal(fd) {
 				continue
 			}
 			consfile, err := os.OpenFile("/dev/console", os.O_RDWR, 0o600)
@@ -98,7 +98,7 @@ func (e *EngineOperations) StartProcess(masterConnFd int) error {
 			sylog.Debugf("Replacing tty descriptors with /dev/console")
 			consfd := int(consfile.Fd())
 			for ; fd <= 2; fd++ {
-				if !terminal.IsTerminal(fd) {
+				if !term.IsTerminal(fd) {
 					continue
 				}
 				syscall.Close(fd)
```

**File**: `internal/pkg/util/interactive/interactive.go` (modified, +3/-3)
```diff
@@ -16,7 +16,7 @@ import (
 	"strings"
 
 	"github.com/hpcng/singularity/pkg/sylog"
-	"golang.org/x/crypto/ssh/terminal"
+	"golang.org/x/term"
 )
 
 var (
@@ -136,9 +136,9 @@ func AskQuestionNoEcho(format string, a ...interface{}) (string, error) {
 	// underlying file descriptor is associated to a VT100 terminal, not with
 	// other file descriptors, including when redirecting Stdin to an actual
 	// file in the context of testing or in the context of pipes.
-	if terminal.IsTerminal(int(os.Stdin.Fd())) {
+	if term.IsTerminal(int(os.Stdin.Fd())) {
 		var resp []byte
-		resp, err = terminal.ReadPassword(int(os.Stdin.Fd()))
+		resp, err = term.ReadPassword(int(os.Stdin.Fd()))
 		if err != nil {
 			return "", err
 		}
```

---

### Incident Patch 9: `ac4ea80b` (2021-11-12)
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

### Incident Patch 10: `fb46d06e` (2021-11-12)
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

### Incident Patch 11: `25d05c53` (2021-11-12)
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

### Incident Patch 12: `64531909` (2021-10-22)
**Commit Message**: fix: wire up contexts in CLI package

Signed-off-by: Dave Dykstra <[REDACTED_EMAIL]>

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

### Incident Patch 13: `78442de3` (2021-11-08)
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

### Incident Patch 14: `93a3ab35` (2021-11-05)
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

---

### Incident Patch 15: `a6424c12` (2021-09-10)
**Commit Message**: e2e: add build test cases for `--mount` flag

**File**: `e2e/imgbuild/imgbuild.go` (modified, +57/-0)
```diff
@@ -1330,6 +1330,63 @@ func (c imgBuildTests) buildBindMount(t *testing.T) {
 			},
 			exit: 255,
 		},
+		{
+			name: "Mount test dir to /mnt",
+			buildOption: []string{
+				"--mount", "type=bind,source=" + dir + ",destination=/mnt",
+			},
+			buildPost: []string{
+				"cat /mnt/canary",
+			},
+			buildTest: []string{
+				"cat /mnt/canary",
+			},
+			exit: 0,
+		},
+		{
+			name: "Mount test dir to multiple directory",
+			buildOption: []string{
+				"--mount", "type=bind,source=" + dir + ",destination=/mnt",
+				"--mount", "type=bind,source=" + dir + ",destination=/opt",
+			},
+			buildPost: []string{
+				"cat /mnt/canary",
+				"cat /opt/canary",
+			},
+			buildTest: []string{
+				"cat /mnt/canary",
+				"cat /opt/canary",
+			},
+			exit: 0,
+		},
+		{
+			name: "Mount test dir to /mnt read-only",
+			buildOption: []string{
+				"--mount", "type=bind,source=" + dir + ",destination=/mnt,ro",
+			},
+			buildPost: []string{
+				"mkdir /mnt/should_fail",
+			},
+			exit: 255,
+		},
+		{
+			name: "Mount test dir to non-existent image directory",
+			buildOption: []string{
+				"--mount", "type=bind,source=" + dir + ",destination=/fake/dir",
+			},
+			buildPost: []string{
+				"cat /mnt/canary",
+			},
+			exit: 255,
+		},
+		{
+			name: "Mount test dir with remote",
+			buildOption: []string{
+				"--mount", "type=bind,source=" + dir + ",destination=/mnt",
+				"--remote",
+			},
+			exit: 255,
+		},
 	}
 
 	sandboxImage := filepath.Join(tmpdir, "build-sandbox")
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
