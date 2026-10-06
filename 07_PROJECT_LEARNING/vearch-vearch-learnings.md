# Forensic Learning Record (Deep Inspection): vearch/vearch

> **Canonical Artifact**: `07_PROJECT_LEARNING/vearch-vearch-learnings.md`  
> **Source Platform**: GitHub ([https://github.com/vearch/vearch](https://github.com/vearch/vearch))  
> **Harvest Method**: Full-Spectrum Deep Extraction (Patches, Diffs, Source Code, Post-Mortems)  
> **Harvest Timestamp**: 2026-10-06T01:39:49.445Z  
> **Compliance State**: Free Tier Guaranteed | Strict Rate-Limit Backoff Honored  

---

## 1. Context & Architectural Overview
- **Repository / Resource**: `vearch/vearch`
- **Description**: Distributed vector search for AI-native applications
- **Primary Language / Ecosystem**: Python
- **Discovered Manifests / Configurations**: go.mod, README.md
- **Stars / Engagement**: 2329 stars

---

## 2. Multi-Dimensional 8-Axis Investigation & Real Code Patches

### D1: Architecture & Structural Boundaries
- Entry configurations inspected via direct stream: go.mod, README.md.
- Evaluated system abstractions and modular contracts.

### Core Architecture Module: `internal/debugutil/cpuprofile.go`
```
// Copyright 2020 The Cockroach Authors.
//
// Use of this software is governed by the Business Source License
// included in the file licenses/BSL.txt.
//
// As of the Change Date specified in that file, in accordance with
// the Business Source License, use of this software will be governed
// by the Apache License, Version 2.0, included in the file
// licenses/APL.txt.

package debugutil

import (
	"net/http"
	"net/http/pprof"
	"strconv"
)

// CPUProfileType tracks whether a CPU profile is in progress.
type CPUProfileType int32

var GlobalCPUProfiling CPUProfileType

const (
	// CPUProfileNone means that no CPU profile is currently taken.
	CPUProfileNone CPUProfileType = iota
	// CPUProfileDefault means that a CPU profile is currently taken, but
	// pprof labels are not enabled.
	CPUProfileDefault
	// CPUProfileWithLabels means that a CPU profile is currently taken and
	// pprof labels are enabled.
	CPUProfileWithLabels
)

// CPUProfileOptions contains options for generating a CPU profile.
type CPUProfileOptions struct {
	// Number of seconds to profile for.
	Seconds int32
	// Whether to enable pprof labels while the profile is taken.
	WithLabels bool
}

// Type returns the CPUProfileType corresponding to the options.
func (opts CPUProfileOptions) Type() CPUProfileType {
	typ := CPUProfileDefault
	if opts.WithLabels {
		typ = CPUProfileWithLabels
	}
	return typ
}

// CPUProfileOptionsFromRequest parses the `seconds` and `labels` fragments
// from the URL and populates CPUProfileOptions from it.
//
// For convenience, `labels` defaults to true, that is, `?labels=false`
// must be specified to disable them. `seconds` defaults to the pprof
// default of 30s.
func CPUProfileOptionsFromRequest(r *http.Request) CPUProfileOptions {
	seconds, err := strconv.ParseInt(r.FormValue("seconds"), 10, 32)
	if err != nil || seconds <= 0 {
		seconds = 30
	}
	// NB: default to using labels unless it's specifically set to false.
	withLabels := r.FormValue("labels") != "false"
	return CPUProfileOptions{
		Seconds:    int32(seconds),
		WithLabels: withLabels,
	}
}

// CPUProfileDo invokes the closure while enabling (and disabling) the supplied
// CPUProfileMode. Errors if the profiling mode could not be set or if do()
// returns an error.
func CPUProfileDo(typ CPUProfileType, do func() error) error {
	GlobalCPUProfiling = typ
	defer func() { GlobalCPUProfiling = CPUProfileNone }()
	return do()
}

// CPUProfileHandler is replacement for `pprof.Profile` that supports additional
// options.
func CPUProfileHandler(w http.ResponseWriter, r *http.Request) {
	opts := CPUProfileOptionsFromRequest(r)
	if err := CPUProfileDo(opts.Type(), func() error {
		pprof.Profile(w, r)
		return nil
	}); err != nil {
		http.Error(w, err.Error(), http.StatusInternalServerError)
		return
	}
}

```

### Core Architecture Module: `internal/debugutil/perfui.go`
```
package debugutil

import (
	"bytes"
	"fmt"
	"io"
	"net/http"
	_ "net/http/pprof"
	"os"
	"os/exec"
	"strconv"
	"time"

	"github.com/vearch/vearch/v3/internal/pkg/log"
)

func CPUProfile(w http.ResponseWriter, r *http.Request) {
	w.Header().Set("Content-Type", "text/html; charset=utf-8")
	w.Header().Set("Content-Type", "text/html; charset=utf-8")

	seconds, err := strconv.ParseInt(r.FormValue("seconds"), 10, 32)
	if err != nil || seconds <= 0 {
		seconds = 5
	}

	if err := GetPerfSVGHtml(w, "profile", seconds); err != nil {
		log.Error(err.Error())
	}
}

func HeapProfile(w http.ResponseWriter, r *http.Request) {

	w.Header().Set("X-Content-Type-Options", "nosniff")
	w.Header().Set("Content-Type", "text/html; charset=utf-8")

	seconds, err := strconv.ParseInt(r.FormValue("seconds"), 10, 32)
	if err != nil || seconds <= 0 {
		seconds = 5
	}

	if err := GetPerfSVGHtml(w, "heap", seconds); err != nil {
		log.Error(err.Error())
	}
}

func GetPerfSVGHtml(w io.Writer, name string, interval int64) error {
	suffix := time.Now().UnixNano()
	perfDataFile := fmt.Sprintf("perf-%v.data", suffix)
	perfUnfoldFile := fmt.Sprintf("perf-%v.unfold", suffix)
	perfFoldedFile := fmt.Sprintf("perf-%v.folded", suffix)
	flameGraphSVGFile := fmt.Sprintf("flamegraph-%v.svg", suffix)

	pid := os.Getpid()
	var cmdPerf *exec.Cmd
	if name == "profile" {
		cmdPerf = exec.Command("perf", "record", "-g",
			"-p", fmt.Sprintf("%d", pid),
			"-o", perfDataFile, "sleep", fmt.Sprintf("%d", interval))
	} else {
		cmdPerf = exec.Command("perf", "record", "-g", "-e",
			"\"kmem:*\"", "-p", fmt.Sprintf("%d", pid),
			"-o", perfDataFile, "sleep", fmt.Sprintf("%d", interval))
	}
	err := cmdPerf.Run()
	if err != nil {
		return err
	}

	defer func() {
		os.Remove(perfDataFile)
	}()
	cmdScript := exec.Command("perf", "script", "-i", perfDataFile)
	UnfoldFile, err := os.Create(perfUnfoldFile)
	if err != nil {
		return err
	}

	defer func() {
		UnfoldFile.Close()
		os.Remove(perfUnfoldFile)
	}()
	cmdScript.Stdout = UnfoldFile
	err = cmdScript.Run()
	if err != nil {
		return err
	}

	cmdStackCollapse := exec.Command("stackcollapse-perf.pl", perfUnfoldFile)
	FoldedFile, err := os.Create(perfFoldedFile)
	if err != nil {
		return err
	}

	defer func() {
		FoldedFile.Close()
		os.Remove(perfFoldedFile)
	}()
	cmdStackCollapse.Stdout = FoldedFile
	err = cmdStackCollapse.Run()
	if err != nil {
		return err
	}

	cmdFlameGraph := exec.Command("flamegraph.pl", perfFoldedFile)
	flameGraphSVG, err := os.Create(flameGraphSVGFile)
	if err != nil {
		return err
	}

	defer func() {
		flameGraphSVG.Close()
		os.Remove(flameGraphSVGFile)
	}()
	cmdFlameGraph.Stdout = flameGraphSVG
	err = cmdFlameGraph.Run()
	if err != nil {
		return err
	}

	flameGraphByte, err := os.ReadFile(flameGraphSVGFile)
	if err != nil {
		return err
	}

	var b bytes.Buffer
	b.WriteString(`<html>
<head>
<title>/perf/FlameGraph/</title>
<style>
.profile-name{
	display:inline-block;
	width:6rem;
}
</style>
</head>
<body>
   <h1>Flame Graph</h1>
   <div>` + string(flameGraphByte) + `</div>
</body>
</html>
`)

	_, err = w.Write(b.Bytes())
	return err
}

```

### Core Architecture Module: `internal/debugutil/pprofui/fakeflags.go`
```
// Copyright 2018 The Cockroach Authors.
//
// Use of this software is governed by the Business Source License
// included in the file licenses/BSL.txt.
//
// As of the Change Date specified in that file, in accordance with
// the Business Source License, use of this software will be governed
// by the Apache License, Version 2.0, included in the file
// licenses/APL.txt.

package pprofui

import (
	"github.com/google/pprof/driver"
	"github.com/spf13/pflag"
)

// pprofFlags is a wrapper to satisfy pprof's client flag interface.
// That interface is satisfied by what the standard flag package
// offers, with some tweaks. In this package, we just want to specify
// the command line args directly; pprofFlags lets us do that
// essentially by mocking out `os.Args`. `pprof` will register all of
// its flags via this struct, and then they get populated from `args`
// below.
type pprofFlags struct {
	args []string // passed to Parse()
	*pflag.FlagSet
}

var _ driver.FlagSet = &pprofFlags{}

// ExtraUsage is part of the driver.FlagSet interface.
func (pprofFlags) ExtraUsage() string {
	return ""
}

// AddExtraUsage is part of the driver.FlagSet interface.
func (pprofFlags) AddExtraUsage(eu string) {
}

func (f pprofFlags) StringList(o, d, c string) *[]*string {
	return &[]*string{f.String(o, d, c)}
}

func (f pprofFlags) Parse(usage func()) []string {
	f.FlagSet.Usage = usage
	if err := f.FlagSet.Parse(f.args); err != nil {
		panic(err)
	}
	return f.FlagSet.Args()
}

```

### Core Architecture Module: `internal/debugutil/pprofui/response_writer.go`
```
// Copyright 2018 The Cockroach Authors.
//
// Use of this software is governed by the Business Source License
// included in the file licenses/BSL.txt.
//
// As of the Change Date specified in that file, in accordance with
// the Business Source License, use of this software will be governed
// by the Apache License, Version 2.0, included in the file
// licenses/APL.txt.

package pprofui

import (
	"io"
	"net/http"
)

// responseBridge is a helper for fetching from the pprof profile handlers.
// Their interface wants a http.ResponseWriter, so we give it one. The writes
// are passed through to an `io.Writer` of our choosing.
type responseBridge struct {
	target     io.Writer
	statusCode int
}

var _ http.ResponseWriter = &responseBridge{}

func (r *responseBridge) Header() http.Header {
	return http.Header{}
}

func (r *responseBridge) Write(b []byte) (int, error) {
	return r.target.Write(b)
}

func (r *responseBridge) WriteHeader(statusCode int) {
	r.statusCode = statusCode
}

```

### Core Architecture Module: `internal/debugutil/pprofui/server.go`
```
// Copyright 2018 The Cockroach Authors.
//
// Use of this software is governed by the Business Source License
// included in the file licenses/BSL.txt.
//
// As of the Change Date specified in that file, in accordance with
// the Business Source License, use of this software will be governed
// by the Apache License, Version 2.0, included in the file
// licenses/APL.txt.

package pprofui

import (
	"bytes"
	"errors"
	"fmt"
	"io"
	"net/http"
	"net/http/pprof"
	"net/url"
	"path"
	runtimepprof "runtime/pprof"
	"sort"
	"strconv"
	"strings"
	"sync"
	"time"

	"github.com/google/pprof/driver"
	"github.com/google/pprof/profile"
	"github.com/spf13/pflag"
)

// A Server serves up the pprof web ui. A request to /<profiletype>
// generates a profile of the desired type and redirects to the UI for
// it at /<profiletype>/<id>. Valid profile types at the time of
// writing include `profile` (cpu), `goroutine`, `threadcreate`,
// `heap`, `block`, and `mutex`.
type Server struct {
	storage      Storage
	profileSem   sync.Mutex
	profileTypes map[string]http.HandlerFunc
	hook         func(profile string, labels bool, do func())
}

// NewServer creates a new Server backed by the supplied Storage and optionally
// a hook which is called when a new profile is created. The closure passed to
// the hook will carry out the work involved in creating the profile and must
// be called by the hook. The intention is that hook will be a method such as
// this:
//
// func hook(profile string, do func()) {
// 	if profile == "profile" {
// 		something.EnableProfilerLabels()
// 		defer something.DisableProfilerLabels()
// 		do()
// 	}
// }
func NewServer(storage Storage, hook func(profile string, labels bool, do func())) *Server {
	if hook == nil {
		hook = func(_ string, _ bool, do func()) { do() }
	}
	s := &Server{
		storage: storage,
		hook:    hook,
	}

	s.profileTypes = map[string]http.HandlerFunc{
		// The CPU profile endpoint is special in that the handler actually blocks
		// for a predetermined duration (recording the profile in the meantime).
		// It is not included in `runtimepprof.Profiles` below.
		"profile": func(w http.ResponseWriter, r *http.Request) {
			const defaultProfileDurationSeconds = 5
			if r.Form == nil {
				r.Form = url.Values{}
			}
			if r.Form.Get("seconds") == "" {
				r.Form.Set("seconds", strconv.Itoa(defaultProfileDurationSeconds))
			}
			s.profileSem.Lock()
			defer s.profileSem.Unlock()
			pprof.Profile(w, r)
		},
	}

	// Register the endpoints for heap, block, threadcreate, etc.
	for _, p := range runtimepprof.Profiles() {
		p := p // copy
		s.profileTypes[p.Name()] = func(w http.ResponseWriter, r *http.Request) {
			if err := p.WriteTo(w, 0 /* debug */); err != nil {
				w.WriteHeader(http.StatusInternalServerError)
				_, _ = w.Write([]byte(err.Error()))
			}
		}
	}

	return s
}

// parsePath turns /profile/123/flamegraph/banana into (profile, 123, /flamegraph/banana).
func (s *Server) parsePath(reqPath string) (profType string, id string, remainingPath string) {
	parts := strings.Split(path.Clean(reqPath), "/")
	if parts[0] == "" {
		// The path was absolute (the typical case), pretend it was
		// relative (to this handler's root).
		parts = parts[1:]
	}
	switch len(parts) {
	case 0:
		return "", "", "/"
	case 1:
		return parts[0], "", "/"
	default:
		return parts[0], parts[1], "/" + strings.Join(parts[2:], "/")
	}
}

func (s *Server) ServeHTTP(w http.ResponseWriter, r *http.Request) {
	profileName, id, remainingPath := s.parsePath(r.URL.Path)

	if profileName == "" {
		// TODO(tschottdorf): serve an overview page.
		var names []string
		for name := range s.profileTypes {
			names = append(names, name)
		}
		sort.Strings(names)
		msg := fmt.Sprintf("Try %s for one of %s", path.Join(r.RequestURI, "<profileName>"), strings.Join(names, ", "))
		http.Error(w, msg, http.StatusNotFound)
		return
	}

	if id != "" {
		// Catch nonexistent IDs early or pprof will do a worse job at
		// giving an informative error.
		if err := s.storage.Get(id, func(io.Reader) error { return nil }); err != nil {
			msg := fmt.Sprintf("profile for id %s not found: %s", id, err)
			http.Error(w, msg, http.StatusNotFound)
			return
		}

		if r.URL.Query().Get("download") != "" {
			// TODO(tbg): this has zero discoverability.
			w.Header().Set("Content-Disposition", fmt.Sprintf("attachment; filename=%s_%s.pb.gz", profileName, id))
			w.Header().Set("Content-Type", "application/octet-stream")
			if err := s.storage.Get(id, func(r io.Reader) error {
				_, err := io.Copy(w, r)
				return err
			}); err != nil {
				http.Error(w, err.Error(), http.StatusInternalServerError)
			}
			return
		}

		server := func(args *driver.HTTPServerArgs) error {
			handler, ok := args.Handlers[remainingPath]
			if !ok {
				return errors.New("unknown endpoint " + remainingPath)
			}
			handler.ServeHTTP(w, r)
			return nil
		}

		storageFetcher := func(_ string, _, _ time.Duration) (*profile.Profile, string, error) {
			var p *profile.Profile
			if err := s.storage.Get(id, func(reader io.Reader) error {
				var err error
				p, err = profile.Parse(reader)
				return err
			}); err != nil {
				return nil, "", err
			}
			return p, "", nil
		}

		// Invoke the (library version) of `pprof` with a number of stubs.
		// Specifically, we pass a fake FlagSet that plumbs through the
		// given args, a UI that logs any errors pprof may emit, a fetcher
		// that simply reads the profile we downloaded earlier, and a
		// HTTPServer that pprof will pass the web ui handlers to at the
		// end (and we let it handle this client request).
		if err := driver.PProf(&driver.Options{
			Flagset: &pprofFlags{
				FlagSet: pflag.NewFlagSet("pprof", pflag.ExitOnError),
				args: []string{
					"--symbolize", "none",
					"--http", "localhost:0",
					"", // we inject our own target
				},
			},
			UI:         &fakeUI{},
			Fetch:      fetcherFn(storageFetcher),
			HTTPServer: server,
		}); err != nil {
			_, _ = w.Write([]byte(err.Error()))
		}

		return
	}

	// Create and save new profile, then redirect client to corresponding ui URL.

	id = s.storage.ID()

	fetchHandler, ok := s.profileTypes[profileName]
	if !ok {
		_, _ = w.Write([]byte(fmt.Sprintf("unknown profile type %s", profileName)))
		return
	}

	if err := s.storage.Store(id, func(w io.Writer) error {
		req, err := http.NewRequest("GET", "/unused", bytes.NewReader(nil))
		if err != nil {
			return err
		}

		// Pass through any parameters. Most notably, allow ?seconds=10 for
		// CPU profiles.
		_ = r.ParseForm()
		req.Form = r.Form

		rw := &responseBridge{target: w}

		s.hook(profileName, r.Form.Get("labels") != "", func() { fetchHandler(rw, req) })

		if rw.statusCode != http.StatusOK && rw.statusCode != 0 {
			return errors.New("unexpected status: " + strconv.Itoa(rw.statusCode))
		}
		return nil
	}); err != nil {
		http.Error(w, err.Error(), http.StatusInternalServerError)
		return
	}

	// NB: direct straight to the flamegraph. This is because `pprof`
	// shells out to `dot` for the default landing page and thus works
	// only on hosts that have graphviz installed. You can still navigate
	// to the dot page from there.
	origURL, err := url.Parse(r.RequestURI)
	if err != nil {
		http.Error(w, err.Error(), http.StatusInternalServerError)
		return
	}

	// If this is a request issued by `go tool pprof`, just return the profile
	// directly. This is convenient because it avoids having to expose the pprof
	// endpoints separately, and also allows inserting hooks around CPU profiles
	// in the future.
	isGoPProf := strings.Contains(r.Header.Get("User-Agent"), "Go-http-client")
	origURL.Path = path.Join(origURL.Path, id, "flamegraph")
	if !isGoPProf {
		http.Redirect(w, r, origURL.String(), http.StatusTemporaryRedirect)
	} else {
		_ = s.storage.Get(id, func(r io.Reader) error {
			_, err := io.Copy(w, r)
			return err
		})
	}
}

type fetcherFn func(_ string, _, _ time.Duration) (*profile.Profile, string, error)

func (f fetcherFn) Fetch(s string, d, t time.Duration) (*profile.Profile, string, error) {
	return f(s, d, t)
}

```

### Core Architecture Module: `internal/debugutil/pprofui/storage.go`
```
// Copyright 2018 The Cockroach Authors.
//
// Use of this software is governed by the Business Source License
// included in the file licenses/BSL.txt.
//
// As of the Change Date specified in that file, in accordance with
// the Business Source License, use of this software will be governed
// by the Apache License, Version 2.0, included in the file
// licenses/APL.txt.

package pprofui

import "io"

// Storage exposes the methods for storing and accessing profiles.
type Storage interface {
	// ID generates a unique ID for use in Store.
	ID() string
	// Store invokes the passed-in closure with a writer that stores its input.
	Store(id string, write func(io.Writer) error) error
	// Get invokes the passed-in closure with a reader for the data at the given id.
	// An error is returned when no data is found.
	Get(id string, read func(io.Reader) error) error
}

```

### Core Architecture Module: `internal/debugutil/pprofui/storage_mem.go`
```
// Copyright 2018 The Cockroach Authors.
//
// Use of this software is governed by the Business Source License
// included in the file licenses/BSL.txt.
//
// As of the Change Date specified in that file, in accordance with
// the Business Source License, use of this software will be governed
// by the Apache License, Version 2.0, included in the file
// licenses/APL.txt.

package pprofui

import (
	"bytes"
	"errors"
	"fmt"
	"io"
	"sort"
	"sync"
	"sync/atomic"
	"time"
)

type record struct {
	id string
	t  time.Time
	b  []byte
}

// A MemStorage is a Storage implementation that holds recent profiles in memory.
type MemStorage struct {
	mu struct {
		sync.Mutex
		records []record // sorted by record.t
	}
	idGen        int32         // accessed atomically
	keepDuration time.Duration // zero for disabled
	keepNumber   int           // zero for disabled
}

var _ Storage = &MemStorage{}

// NewMemStorage creates a MemStorage that retains the most recent n records
// as long as they are less than d old.
//
// Records are dropped only when there is activity (i.e. an old record will
// only be dropped the next time the storage is accessed).
func NewMemStorage(n int, d time.Duration) *MemStorage {
	return &MemStorage{
		keepNumber:   n,
		keepDuration: d,
	}
}

// ID implements Storage.
func (s *MemStorage) ID() string {
	return fmt.Sprint(atomic.AddInt32(&s.idGen, 1))
}

func (s *MemStorage) cleanLocked() {
	if l, m := len(s.mu.records), s.keepNumber; l > m && m != 0 {
		s.mu.records = append([]record(nil), s.mu.records[l-m:]...)
	}
	now := time.Now()
	if pos := sort.Search(len(s.mu.records), func(i int) bool {
		return s.mu.records[i].t.Add(s.keepDuration).After(now)
	}); pos < len(s.mu.records) && s.keepDuration != 0 {
		s.mu.records = append([]record(nil), s.mu.records[pos:]...)
	}
}

// Store implements Storage.
func (s *MemStorage) Store(id string, write func(io.Writer) error) error {
	var b bytes.Buffer
	if err := write(&b); err != nil {
		return err
	}
	s.mu.Lock()
	defer s.mu.Unlock()
	s.mu.records = append(s.mu.records, record{id: id, t: time.Now(), b: b.Bytes()})
	sort.Slice(s.mu.records, func(i, j int) bool {
		return s.mu.records[i].t.Before(s.mu.records[j].t)
	})
	s.cleanLocked()
	return nil
}

// Get implements Storage.
func (s *MemStorage) Get(id string, read func(io.Reader) error) error {
	s.mu.Lock()
	defer s.mu.Unlock()
	for _, v := range s.mu.records {
		if v.id == id {
			return read(bytes.NewReader(v.b))
		}
	}
	return errors.New("profile not found; it may have expired")
}

```

### Core Architecture Module: `internal/debugutil/pprofui/ui.go`
```
// Copyright 2018 The Cockroach Authors.
//
// Use of this software is governed by the Business Source License
// included in the file licenses/BSL.txt.
//
// As of the Change Date specified in that file, in accordance with
// the Business Source License, use of this software will be governed
// by the Apache License, Version 2.0, included in the file
// licenses/APL.txt.

package pprofui

import (
	"context"
	"fmt"
	"io"
	"log"
)

func pprofCtx(ctx context.Context) context.Context {
	return ctx
}

// fakeUI implements pprof's driver.UI.
type fakeUI struct{}

func (*fakeUI) ReadLine(prompt string) (string, error) { return "", io.EOF }

func (*fakeUI) Print(args ...interface{}) {
	msg := fmt.Sprint(args...)
	log.Printf("%s", msg)
}

func (*fakeUI) PrintErr(args ...interface{}) {
	msg := fmt.Sprint(args...)
	log.Printf("%s", msg)
}

func (*fakeUI) IsTerminal() bool {
	return false
}

func (*fakeUI) WantBrowser() bool {
	return false
}

func (*fakeUI) SetAutoComplete(complete func(string) string) {}

```

### Core Architecture Module: `internal/debugutil/server.go`
```
// Copyright 2016 The Cockroach Authors.

// Licensed under the Apache License, Version 2.0 (the "License");
// you may not use this file except in compliance with the License.
// You may obtain a copy of the License at

//     http://www.apache.org/licenses/LICENSE-2.0

// Unless required by applicable law or agreed to in writing, software
// distributed under the License is distributed on an "AS IS" BASIS,
// WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
// See the License for the specific language governing permissions and
// limitations under the License.

package debugutil

import (
	"net"
	"net/http"
	"net/http/pprof"
	"strconv"
	"strings"

	"github.com/vearch/vearch/v3/internal/debugutil/pprofui"
	"github.com/vearch/vearch/v3/internal/pkg/log"
)

// Server serves the /debug/* family of tools.
type Server struct {
	mux *http.ServeMux
}

// NewServer sets up a debug server.
func NewServer() *Server {
	mux := http.NewServeMux()

	// Cribbed straight from pprof's `init()` method. See:
	// https://golang.org/src/net/http/pprof/pprof.go
	mux.HandleFunc("/debug/pprof/", pprof.Index)
	mux.HandleFunc("/debug/pprof/cmdline", pprof.Cmdline)
	mux.HandleFunc("/debug/pprof/profile", func(w http.ResponseWriter, r *http.Request) {
		CPUProfileHandler(w, r)
	})
	mux.HandleFunc("/debug/pprof/symbol", pprof.Symbol)
	mux.HandleFunc("/debug/pprof/trace", pprof.Trace)

	ps := pprofui.NewServer(pprofui.NewMemStorage(1, 0), func(profile string, labels bool, do func()) {
		if profile != "profile" {
			do()
			return
		}

		if err := CPUProfileDo(CPUProfileOptions{WithLabels: labels}.Type(), func() error {
			var extra string
			if labels {
				extra = " (enabling profiler labels)"
			}
			log.Info("pprofui: recording %v%v", profile, extra)
			do()
			return nil
		}); err != nil {
			// NB: we don't have good error handling here. Could be changed if we find
			// this problematic. In practice, `do()` wraps the pprof handler which will
			// return an error if there's already a profile going on just the same.
			return
		}
	})
	mux.Handle("/debug/pprof/ui/", http.StripPrefix("/debug/pprof/ui", ps))

	mux.HandleFunc("/perf/profile", CPUProfile)
	mux.HandleFunc("/perf/heap", HeapProfile)

	return &Server{
		mux: mux,
	}
}

// ServeHTTP serves various tools under the /debug endpoint. It restricts access
// according to the `server.remote_debugging.mode` cluster variable.
func (ds *Server) ServeHTTP(w http.ResponseWriter, r *http.Request) {
	handler, _ := ds.mux.Handler(r)
	handler.ServeHTTP(w, r)
}

// http://127.0.0.1/debug/pprof/ui/
// http://127.0.0.1/debug/pprof/ui/profile
// http://127.0.0.1/debug/pprof/ui/heap

func StartUIPprofListener(port int) {
	pprofServer := NewServer()
	address := strings.Join([]string{"", strconv.Itoa(port)}, ":")
	listener, err := net.Listen("tcp", address)
	if err != nil {
		log.Error("StartUIPprofListener start error: %v", err.Error())
		return
	}

	srvhttp := &http.Server{
		Handler: pprofServer.mux,
	}
	go func() {
		defer func() {
			if r := recover(); r != nil {
				log.Error("start pprof server error: %v", r)
			}
		}()

		err = srvhttp.Serve(listener)
		if err != nil {
			log.Error("srvhttp.Serve error: %v", err.Error())
		}
	}()
}

```

### Core Architecture Module: `internal/engine/c_api/api_data/cpp_api.h`
```
/**
 * Copyright 2019 The Gamma Authors.
 *
 * This source code is licensed under the Apache License, Version 2.0 license
 * found in the LICENSE file in the root directory of this source tree.
 */

#pragma once
#include <string>

#include "common/common_query_data.h"
#include "doc.h"
#include "request.h"
#include "response.h"

// Here are some corresponding C++ interfaces in c_api/gamma_api.h

int CPPSearch(void *engine, vearch::Request *request,
              vearch::Response *response);

int CPPSearch2(void *engine, vearch::VectorResult *result);

int CPPAddOrUpdateDoc(void *engine, vearch::Doc *doc);

void CPPSetNprobe(void *engine, int nprobe, std::string index_type);

void CPPSetRerank(void *engine, int rerank, std::string index_type);

```

### Core Architecture Module: `internal/engine/c_api/api_data/doc.h`
```
/**
 * Copyright 2019 The Gamma Authors.
 *
 * This source code is licensed under the Apache License, Version 2.0 license
 * found in the LICENSE file in the root directory of this source tree.
 */

#pragma once

#include <map>
#include <unordered_map>
#include <unordered_set>
#include <vector>

#include "idl/fbs-gen/c/doc_generated.h"
#include "raw_data.h"
#include "table.h"

namespace vearch {

class Engine;

struct Field {
  std::string name;
  std::string value;
  DataType datatype;

  Field() = default;

  Field(const Field &other) = default;
  Field &operator=(const Field &other) = default;

  Field(Field &&other) noexcept = default;
  Field &operator=(Field &&other) noexcept = default;

  ~Field() = default;
};

class Doc : public RawData {
 public:
  Doc() : doc_(nullptr), engine_(nullptr) {}

  Doc(const Doc &other) = default;
  Doc &operator=(const Doc &other) = default;

  Doc(Doc &&other) noexcept = default;
  Doc &operator=(Doc &&other) noexcept = default;

  virtual int Serialize(char **out, int *out_len);

  virtual void Deserialize(const char *data, int len);

  void AddField(const Field &field);
  void AddField(Field &&field);

  std::string &Key() { return key_; }
  void SetKey(const std::string &key) { key_ = key; }

  std::unordered_map<std::string, Field> &TableFields() {
    return table_fields_;
  }
  std::unordered_map<std::string, Field> &VectorFields() {
    return vector_fields_;
  }

  void SetEngine(Engine *engine) { engine_ = engine; }

  std::string ToJson();

  int FromJson(std::string &raw, std::map<std::string, DataType> &attr_type_map,
               std::unordered_set<std::string> &raw_vectors);

 private:
  gamma_api::Doc *doc_;
  std::string key_;
  std::unordered_map<std::string, Field> table_fields_;
  std::unordered_map<std::string, Field> vector_fields_;
  Engine *engine_;
};

}  // namespace vearch

```

### Core Architecture Module: `internal/engine/c_api/api_data/raw_data.h`
```
/**
 * Copyright 2019 The Gamma Authors.
 *
 * This source code is licensed under the Apache License, Version 2.0 license
 * found in the LICENSE file in the root directory of this source tree.
 */

#pragma once

namespace vearch {

class RawData {
 public:
  RawData() {}
  virtual ~RawData() {}
  virtual int Serialize(char **out, int *out_len) = 0;
  virtual void Deserialize(const char *data, int len) = 0;
  virtual std::string RequestId() { return request_id_; }
  virtual int ReqPartitionId() { return req_partition_id_; }
  virtual void SetRequestId(const std::string &request_id) {
    request_id_ = request_id;
  }
  virtual void SetReqPartitionId(const int partition_id) {
    req_partition_id_ = partition_id;
  }

 protected:
  std::string request_id_;
  int req_partition_id_;
};

}  // namespace vearch

```


### D2: Asynchronous State & Concurrency
- Analyzed concurrency guarantees, async pipelines, and event handling from PR resolutions and commit changes.

### D3: Error Boundaries, Recovery & Rollbacks
- Exception handling patterns and defect resolutions extracted from closed production bug issues:
- **Issue #514** (2021-11-05): **PS k8s 部署使用挂载盘，重启后索引数据未重新加载**
  *Symptoms*: PS 节点是通过K8s启动，PVC挂载了一个云盘，之前试过少量数据重启后能够重新加载回索引，但这次是单节点3600万数据挂掉之后重启没有恢复数据，partition数量减1； IVFPQ v3.2.7最新 建表参数 <img width="390" alt="image" src="https://user-images.githubusercontent.com/42227773/134772941-99e45c60-70da-4be0-96fa-83893af911fb.png">  master节点log <img width="1915" alt="image" src="https://user-images.githubusercontent.com/42227773/134773087-5c87af99-6196-44a2-95fb-7bd99e54dc62.png">  重启PS.INFO.log <img width="961" alt="image" src="https://user-images.githubusercontent.com/42227773/134772987-c36fb28b-e32e-4e52-a0c1-59999bf54686.png">  重启gamma log： <img width="1388" alt="image" src="https://user-images.githubusercontent.com/42227773/134773104-40e8025b-e9e0-4ba8-aba8-f0b74e9d9773.png">   监控 <img width="789" alt="image" src="https://user-images.githubusercontent.com/42227773/134773120-a12c4a42-cdcc-4900-84f8-b6764c4918c3.png">  重启PS节点的datas <img width="847" alt="image" src="https://user-images.githubusercontent.com/42227773/134773154-05162199-b39e-4240-a73e-ab4b34534b5f.png">  正常未重启PS节点的datas <img width="885" alt="image" src="https://user-images.githubusercontent.com/42227773/134773173-abfa5fdc-9e7c-4f57-9893-d18396f2f450.png">  通过datas比较，我认为挂载盘是没有问题的。  执行flash出现如下错误 <img width="1191" alt="image" src="https://user-images.githubusercontent.com/42227773/134773234-9ba87c34-25f8-4a21-9aad-42f0230528cf.png">   
  **Post-Mortem & Fix Analysis**:
  > 用的vearch哪个版本呢？
  > > 用的vearch哪个版本呢？  v3.2.7最新
  > 可以提供一下health接口返回的参数吗？

- **Issue #88** (2021-04-30): **查询结果不准确**
  *Symptoms*: 我用的测试集大小大概是358万条64维向量， create space 参数如下： ``` {     "name": "test_space",     "partition_num": 3,     "replica_num": 1,     "engine": {         "name": "gamma",         "index_size": 100,         "max_size": 10000000,         "nprobe": 256,         "metric_type": "InnerProduct",         "ncentroids": 16384,         "nsubvector": 32     },     "properties": {         "str": {             "type": "keyword",             "index": "true"         },         "num": {             "type": "integer",             "index": "true"         },         "score": {             "type": "float",             "index": "true"         },         "tags": {             "type": "string",             "array": true,             "index": "true"         },         "nums": {             "type": "integer",             "array": false,             "index": "true"         },         "vec": {             "type": "vector",             "dimension": 64,             "store_type": "Mmap",             "store_param": {                 "cache_size": 2000             }         }     } } ```  数据插入方式批量插入，每10000条插入一次，  查询参数如下： ``` {     "query": {         "sum": [             {                 "field": "vec",                 "feature": [                     -0.5279306,                     0.013351947,                     -0.19579811,                     0.057762206,                     -0.34226078,                     0.14666641,                     -0.34158
  **Post-Mortem & Fix Analysis**:
  > @Silocean 搜索时按分数过滤返回结果，如果只设置min_score或max_score确实有点小问题，我们会在后面的版本fix。你可以试试同时设置它们，比如设置"min_score": 0.8，"max_score": 1.0，或者都不设置。

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

### Incident Patch 1: `f980caf9` (2026-07-20)
**Commit Message**: fix: replace busy-wait with blocking select in router search (#884)

**File**: `internal/client/client.go` (modified, +24/-25)
```diff
@@ -109,7 +109,7 @@ const (
 
 // NewRouterRequest create a new request for router
 func NewRouterRequest(ctx context.Context, client *Client) *routerRequest {
-	return &routerRequest{ctx: ctx, client: client, md: make(map[string]string)}
+	return &routerRequest{ctx: ctx, client: client, md: make(map[string]string), errNotify: make(chan struct{})}
 }
 
 type routerRequest struct {
@@ -123,6 +123,9 @@ type routerRequest struct {
 	clientMap sync.Map
 	// Err if error else nil
 	Err error
+
+	errOnce   sync.Once
+	errNotify chan struct{}
 }
 
 // GetMD
@@ -147,6 +150,10 @@ func (r *routerRequest) GetMsgID() string {
 	return msgID
 }
 
+func (r *routerRequest) signalErr() {
+	r.errOnce.Do(func() { close(r.errNotify) })
+}
+
 // SetMethod set method
 func (r *routerRequest) SetMethod(method string) *routerRequest {
 	r.md[HandlerType] = method
@@ -696,6 +703,7 @@ func (r *routerRequest) searchFromPartition(ctx context.Context, partitionID ent
 	if r.Err == nil {
 		if searchResponse != nil && searchResponse.Head != nil && searchResponse.Head.Err != nil && searchResponse.Head.Err.GetCode() == vearchpb.ErrorEnum_PARTITION_SERVER_MEMORYEXCEED {
 			r.Err = vearchpb.NewError(vearchpb.ErrorEnum_PARTITION_SERVER_MEMORYEXCEED, errors.New("request canceled"))
+			r.signalErr()
 			replyPartition.Err = searchResponse.Head.Err
 		} else if searchResponse != nil {
 			if trace {
@@ -718,6 +726,7 @@ func (r *routerRequest) searchFromPartition(ctx context.Context, partitionID ent
 			flatBytes := searchResponse.FlatBytes
 			if entity.CheckVirtualMemExceed(len(flatBytes)) {
 				r.Err = vearchpb.NewError(vearchpb.ErrorEnum_PARTITION_SERVER_MEMORYEXCEED, errors.New("request canceled"))
+				r.signalErr()
 				replyPartition.Err = &vearchpb.Error{Code: vearchpb.ErrorEnum_PARTITION_SERVER_MEMORYEXCEED, Msg: "request canceled"}
 			} else if flatBytes != nil {
 				deSerializeStartTime := time.Now()
@@ -915,19 +924,13 @@ func (r *routerRequest) SearchFieldSortExecute(desc bool) *vearchpb.SearchRespon
 		}
 	}()
 
-	canceled := false
-	for {
-		select {
-		case <-doneCh:
-			return searchResponse
-		default:
-		}
-
-		if r.Err != nil && !canceled {
-			r.CancelRequestFromPartition()
-			canceled = true
-		}
+	select {
+	case <-doneCh:
+	case <-r.errNotify:
+		r.CancelRequestFromPartition()
+		<-doneCh
 	}
+	return searchResponse
 }
 
 func (r *routerRequest) queryFromPartition(ctx context.Context, partitionID entity.PartitionID, pd *vearchpb.PartitionData, space *entity.Space, respChain chan *response.SearchDocResult) {
@@ -1038,12 +1041,14 @@ func (r *routerRequest) queryFromPartition(ctx context.Context, partitionID enti
 		searchResponse := replyPartition.SearchResponse
 		if searchResponse != nil && searchResponse.Head.Err != nil && searchResponse.Head.Err.GetCode() == vearchpb.ErrorEnum_PARTITION_SERVER_MEMORYEXCEED {
 			r.Err = vearchpb.NewError(vearchpb.ErrorEnum_PARTITION_SERVER_MEMORYEXCEED, errors.New("request canceled"))
+			r.signalErr()
 			replyPartition.Err = searchResponse.Head.Err
 		}
 		if searchResponse != nil {
 			flatBytes := searchResponse.FlatBytes
 			if entity.CheckVirtualMemExceed(len(flatBytes)) {
 				r.Err = vearchpb.NewError(vearchpb.ErrorEnum_PARTITION_SERVER_MEMORYEXCEED, errors.New("request canceled"))
+				r.signalErr()
 				replyPartition.Err = &vearchpb.Error{Code: vearchpb.ErrorEnum_PARTITION_SERVER_MEMORYEXCEED, Msg: "request canceled"}
 			} else if flatBytes != nil {
 				gamma.DeSerialize(flatBytes, searchResponse)
@@ -1168,19 +1173,13 @@ func (r *routerRequest) QueryFieldSortExecute() *vearchpb.SearchResponse {
 		}
 	}()
 
-	canceled := false
-	for {
-		select {
-		case <-doneCh:
-			return searchResponse
-		default:
-		}
-
-		if r.Err != nil && !canceled {
-			r.CancelRequestFromPartition()
-			canceled = true
-		}
+	select {
+	case <-doneCh:
+	case <-r.errNotify:
+		r.CancelRequestFromPartition()
+		<-doneCh
 	}
+	return searchResponse
 }
 
 func setDocs(keys []string) (docs []*vearchpb.Document, err error) {
```

---

### Incident Patch 2: `287af30d` (2026-07-19)
**Commit Message**: fix: replace buggy quickSort with sort.Slice in search result merge (#883)

**File**: `internal/client/client.go` (modified, +6/-38)
```diff
@@ -869,7 +869,12 @@ func (r *routerRequest) SearchFieldSortExecute(desc bool) *vearchpb.SearchRespon
 			}
 
 			for _, resp := range result {
-				quickSort(resp.ResultItems, desc, 0, len(resp.ResultItems)-1)
+				sort.Slice(resp.ResultItems, func(i, j int) bool {
+					if desc {
+						return resp.ResultItems[i].Score > resp.ResultItems[j].Score
+					}
+					return resp.ResultItems[i].Score < resp.ResultItems[j].Score
+				})
 				if len(resp.ResultItems) > 0 {
 					if searchReq.PageSize > 0 && searchReq.PageNum >= 1 {
 						start := searchReq.PageSize * (searchReq.PageNum - 1)
@@ -1178,43 +1183,6 @@ func (r *routerRequest) QueryFieldSortExecute() *vearchpb.SearchResponse {
 	}
 }
 
-func quickSort(items []*vearchpb.ResultItem, desc bool, low, high int) {
-	if low < high {
-		var pivot = partition(items, desc, low, high)
-		quickSort(items, desc, low, pivot)
-		quickSort(items, desc, pivot+1, high)
-	}
-}
-
-func partition(items []*vearchpb.ResultItem, desc bool, low, high int) int {
-	var pivot = items[low]
-	var i = low
-	var j = high
-	for i < j {
-		if desc {
-			for j > low && items[j].Score <= pivot.Score {
-				j--
-			}
-			for i < high && items[i].Score > pivot.Score {
-				i++
-			}
-		} else {
-			for j > low && items[j].Score >= pivot.Score {
-				j--
-			}
-			for i < high && items[i].Score < pivot.Score {
-				i++
-			}
-		}
-		if i < j {
-			items[i], items[j] = items[j], items[i]
-		}
-	}
-
-	items[low], items[j] = items[j], pivot
-	return j
-}
-
 func setDocs(keys []string) (docs []*vearchpb.Document, err error) {
 	docs = make([]*vearchpb.Document, 0)
 	for _, key := range keys {
```

---

### Incident Patch 3: `d1acd641` (2026-06-05)
**Commit Message**: fix: fix memory leak in response (#874)

**File**: `internal/engine/c_api/api_data/response.cc` (modified, +21/-16)
```diff
@@ -53,18 +53,20 @@ int Response::Serialize(const std::string &space_name,
   vearchpb::SearchResponse pbResponse;
   pbResponse.set_timeout(false);
 
-  std::string serialized;
-  if (!pbResponse.SerializeToString(&serialized)) {
-    LOG(ERROR) << "failed to serialize " << serialized.size();
-    return -1;
-  }
-  
-  *out_len = serialized.size();
-  *out = (char *)malloc(*out_len * sizeof(char));
-  memcpy(*out, (char *)serialized.data(), *out_len);
-
   // empty result
   if (table == nullptr || vector_mgr == nullptr) {
+    std::string serialized;
+    if (!pbResponse.SerializeToString(&serialized)) {
+      LOG(ERROR) << "failed to serialize empty result";
+      return -1;
+    }
+    *out_len = serialized.size();
+    *out = (char *)malloc(*out_len * sizeof(char));
+    if (*out == nullptr) {
+      LOG(ERROR) << "failed to allocate memory for response";
+      return -1;
+    }
+    memcpy(*out, serialized.data(), *out_len * sizeof(char));
     return 0;
   }
   const auto &attr_idx_map = table->FieldMap();
@@ -161,24 +163,27 @@ int Response::Serialize(const std::string &space_name,
     pbRes->set_timeout(false);
   }
 
+  std::string serialized;
   if (!pbResponse.SerializeToString(&serialized)) {
-    LOG(ERROR) << "failed to serialize " << serialized;
+    LOG(ERROR) << "failed to serialize results";
     return -1;
   }
   *out_len = serialized.size();
   *out = (char *)malloc(*out_len * sizeof(char));
-  memcpy(*out, (char *)serialized.data(), *out_len);
-  delete[] gamma_results_;
-  gamma_results_ = nullptr;
+  if (*out == nullptr) {
+    LOG(ERROR) << "failed to allocate memory for response";
+    return -1;
+  }
+  memcpy(*out, serialized.data(), *out_len * sizeof(char));
   if (perf_tool_) {
     PerfTool *perf_tool = static_cast<PerfTool *>(perf_tool_);
     perf_tool->Perf("serialize");
     if (perf_tool->Cost() > perf_tool->slow_search_time) {
       LOG(WARNING) << space_name << " " << request_id_ << " "
-                   << perf_tool->OutputPerf().str();
+                  << perf_tool->OutputPerf().str();
     } else {
       LOG(TRACE) << space_name << " " << request_id_ << " "
-                 << perf_tool->OutputPerf().str();
+                << perf_tool->OutputPerf().str();
     }
   }
   return 0;
```

---

### Incident Patch 4: `8f49c238` (2026-04-14)
**Commit Message**: fix: ivfrabitq use the default metric_type for searching

**File**: `internal/engine/index/impl/gamma_index_ivfrabitq.cc` (modified, +0/-8)
```diff
@@ -619,14 +619,6 @@ void GammaIVFRABITQIndex::search_preassigned(RetrievalContext *retrieval_context
     del_params.set(retrieval_params);
   }
 
-  faiss::MetricType metric_type;
-  if (retrieval_params->GetDistanceComputeType() ==
-      DistanceComputeType::INNER_PRODUCT) {
-    metric_type = faiss::METRIC_INNER_PRODUCT;
-  } else {
-    metric_type = faiss::METRIC_L2;
-  }
-
   long max_codes = 1000000000;
   size_t ndis = 0;
 
```

---

### Incident Patch 5: `12ba13f6` (2026-03-02)
**Commit Message**: fix: remove httpReply for unsupported operation (#866)

* fix: add more information for master response message

* fix: remove httpReply for unsupported operation

* add test case

---------

Co-authored-by: yanwenru1 <[REDACTED_EMAIL]>

**File**: `internal/master/cluster_api.go` (modified, +3/-11)
```diff
@@ -198,16 +198,6 @@ func TimeoutMiddleware(defaultTimeout time.Duration) gin.HandlerFunc {
 				}
 			}
 
-			if httpResp == nil {
-				httpReply := &response.HttpReply{
-					Code:      int(vearchpb.ErrorEnum_INTERNAL_ERROR),
-					RequestId: c.GetHeader(paramRequestID),
-					Msg:       "get response data error",
-				}
-				httpResp = &response.Response{}
-				httpResp.SetHttpReply(httpReply)
-				httpResp.SetHttpStatus(http.StatusInternalServerError)
-			}
 			resultCh <- httpResp
 		}()
 
@@ -220,7 +210,9 @@ func TimeoutMiddleware(defaultTimeout time.Duration) gin.HandlerFunc {
 					"msg":        "request timeout"})
 			c.Abort()
 		case res := <-resultCh:
-			c.JSON(int(res.GetHttpStatus()), res.GetHttpReply())
+			if res != nil {
+				c.JSON(int(res.GetHttpStatus()), res.GetHttpReply())
+			}
 		}
 	}
 }
```

**File**: `test/test_document_upsert.py` (modified, +3/-1)
```diff
@@ -242,10 +242,12 @@ def test_prepare_cluster_badcase(self):
             [11, "wrong_vector_feature_type"],
             [12, "mismatch_field_type"],
             [13, "wrong partition id"],
+            [14, "upsert_with_master_url"],
+            [15, "wrong_url_path"],
         ],
     )
     def test_vearch_document_upsert_badcase(self, index, wrong_type):
-        wrong_parameters = [False for i in range(14)]
+        wrong_parameters = [False for i in range(16)]
         wrong_parameters[index] = True
         batch_size = 1
         total = 1
```

**File**: `test/utils/vearch_utils.py` (modified, +15/-6)
```diff
@@ -26,6 +26,7 @@
 import datetime
 
 router_url = os.getenv("ROUTER_URL", "http://127.0.0.1:9001")
+master_url = os.getenv("MASTER_URL", "http://127.0.0.1:8817")
 db_name = "ts_db"
 space_name = "ts_space"
 username = "root"
@@ -348,13 +349,19 @@ def process_add_error_data(items):
     wrong_vector_feature_type = items[3][11]
     mismatch_field_type = items[3][12]
     wrong_partition_id = items[3][13]
+    upsert_with_master_url = items[3][14]
+    wrong_url_path = items[3][15]
     max_index_str_length = 1025
     max_str_length = 65536
 
     if wrong_db:
         data["db_name"] = "wrong_db"
     if wrong_space:
         data["space_name"] = "wrong_space"
+    if upsert_with_master_url:
+        url = master_url + "/document/upsert"
+    if wrong_url_path:
+        url = router_url + "/document/insert"
     for j in range(batch_size):
         param_dict = {}
         param_dict["field_int"] = index * batch_size + j
@@ -410,13 +417,15 @@ def process_add_error_data(items):
 
     if not wrong_string_length:
         logger.info(json_str)
-    logger.info(rs.json())
-
-    if "data" in rs.json():
-        for result in rs.json()["data"]["document_ids"]:
-            assert result["code"] != 0
+    if upsert_with_master_url or wrong_url_path:
+        assert rs.status_code == 404
     else:
-        assert rs.status_code != 200
+        logger.info(rs.json())
+        if "data" in rs.json():
+            for result in rs.json()["data"]["document_ids"]:
+                assert result["code"] != 0
+        else:
+            assert rs.status_code != 200
 
 
 def process_add_mul_error_data(items):
```

---

### Incident Patch 6: `ff3737a6` (2026-02-04)
**Commit Message**: fix: fix physical backup (#863)

* fix: fix physical backup in vearch

* fix: Extract constants and modify naming logic

---------

Co-authored-by: anpeihang.1 <[REDACTED_EMAIL]>

**File**: `.github/workflows/CI_cluster_master.yml` (modified, +28/-0)
```diff
@@ -189,6 +189,34 @@ jobs:
         pytest test_cluster_master.py -x -k "TestClusterMasterOperate" --log-cli-level=INFO
         pytest test_vearch.py -x -k "test_vearch_basic_usage" --log-cli-level=INFO
 
+    - name: Run cluster backup and restore tests
+      run: |
+        mkdir -p test/oss_data
+        docker run -d --name minio -p 10000:9000 --network vearch_network_cluster minio/minio server test/oss_data
+        wget -q https://dl.min.io/client/mc/release/linux-amd64/mc
+        chmod +x mc
+        retry=0
+        max_retries=10
+        until ./mc alias set myminio http://127.0.0.1:10000 minioadmin minioadmin; do
+          retry=$((retry+1))
+          if [ $retry -gt $max_retries ]; then
+            echo "Failed to set minio alias after $max_retries attempts."
+            exit 1
+          fi
+          echo "Retry $retry/$max_retries: Failed to set minio alias. Retrying in 5 seconds..."
+          sleep 5
+        done
+        ./mc mb myminio/test || true
+        
+        # Run cluster backup and restore tests
+        cd test
+        pytest test_cluster_backup.py -x --log-cli-level=INFO
+        
+        # Cleanup minio
+        cd ..
+        docker stop minio || true
+        docker rm minio || true
+
     - name: Clean cluster
       run: |
         docker-compose -f cloud/docker-compose.yml --profile cluster stop
```

**File**: `internal/client/ps.go` (modified, +3/-0)
```diff
@@ -63,6 +63,9 @@ const (
 	RebuildIndexHandler           = "RebuildIndexHandler"
 	FlushHandler                  = "FlushHandler"
 	BackupHandler                 = "BackupHandler"
+	IncrementBackupHandler        = "IncrementBackupHandler"
+	BackupStatusHandler           = "BackupStatusHandler"
+	DeleteBackupHandler           = "DeleteBackupHandler"
 	ResourceLimitHandler          = "ResourceLimitHandler"
 
 	CreatePartitionHandler = "CreatePartitionHandler"
```

**File**: `internal/client/ps_admin_service.go` (modified, +83/-0)
```diff
@@ -107,6 +107,89 @@ func BackupSpace(addr string, backup *entity.BackupSpaceRequest, pid entity.Part
 	return nil
 }
 
+func OperateBackupOrRestore(addr string, backup *entity.BackupOrRestoreRequest, pid entity.PartitionID) error {
+	value, err := vjson.Marshal(backup)
+	if err != nil {
+		return err
+	}
+
+	args := &vearchpb.PartitionData{PartitionID: pid, Data: value, Type: vearchpb.OpType_CREATE}
+	reply := new(vearchpb.PartitionData)
+	err = Execute(addr, IncrementBackupHandler, args, reply)
+	if err != nil {
+		return err
+	} else if reply.Err.Code != vearchpb.ErrorEnum_SUCCESS {
+		return vearchpb.NewError(reply.Err.Code, nil)
+	}
+	return nil
+}
+
+// GetBackupStatus queries partition backup status
+func GetBackupStatus(addr string, spaceKey string, backupID string, pid entity.PartitionID) (*entity.BackupStatusResponse, error) {
+	query := &entity.BackupStatusQuery{
+		SpaceKey: spaceKey,
+		BackupID: backupID,
+	}
+
+	value, err := vjson.Marshal(query)
+	if err != nil {
+		return nil, err
+	}
+
+	log.Info("GetBackupStatus RPC call: addr=%s, spaceKey=%s, backupID=%s, pid=%d", addr, spaceKey, backupID, pid)
+	args := &vearchpb.PartitionData{PartitionID: pid, Data: value, Type: vearchpb.OpType_GET}
+	reply := new(vearchpb.PartitionData)
+	err = Execute(addr, BackupStatusHandler, args, reply)
+	if err != nil {
+		log.Error("GetBackupStatus RPC error: %v", err)
+		return nil, err
+	}
+
+	if reply.Err.Code != vearchpb.ErrorEnum_SUCCESS {
+		log.Error("GetBackupStatus RPC reply error code: %v", reply.Err.Code)
+		return nil, vearchpb.NewError(reply.Err.Code, nil)
+	}
+
+	response := &entity.BackupStatusResponse{}
+	if err := vjson.Unmarshal(reply.Data, response); err != nil {
+		log.Error("GetBackupStatus unmarshal error: %v", err)
+		return nil, err
+	}
+
+	log.Info("GetBackupStatus RPC success: exists=%v, status=%d, errorMsg=%s", response.Exists, response.Status, response.ErrorMessage)
+	return response, nil
+}
+
+// DeleteBackupVersion deletes backup version (calls PS side to delete reference count)
+func DeleteBackupVersion(addr string, spaceKey string, versionID string, pid entity.PartitionID) error {
+	request := &entity.DeleteBackupVersionRequest{
+		SpaceKey:  spaceKey,
+		VersionID: versionID,
+	}
+
+	value, err := vjson.Marshal(request)
+	if err != nil {
+		return err
+	}
+
+	log.Info("DeleteBackupVersion RPC call: addr=%s, spaceKey=%s, versionID=%s, pid=%d", addr, spaceKey, versionID, pid)
+	args := &vearchpb.PartitionData{PartitionID: pid, Data: value, Type: vearchpb.OpType_DELETE}
+	reply := new(vearchpb.PartitionData)
+	err = Execute(addr, DeleteBackupHandler, args, reply)
+	if err != nil {
+		log.Error("DeleteBackupVersion RPC error: %v", err)
+		return err
+	}
+
+	if reply.Err.Code != vearchpb.ErrorEnum_SUCCESS {
+		log.Error("DeleteBackupVersion RPC reply error code: %v", reply.Err.Code)
+		return vearchpb.NewError(reply.Err.Code, nil)
+	}
+
+	log.Info("DeleteBackupVersion RPC success: spaceKey=%s, versionID=%s", spaceKey, versionID)
+	return nil
+}
+
 func ResourceLimit(addr string, resource *entity.ResourceLimit, pid entity.PartitionID) error {
 	value, err := vjson.Marshal(resource)
 	if err != nil {
```

**File**: `internal/entity/backup.go` (added, +164/-0)
```diff
@@ -0,0 +1,164 @@
+// Copyright 2019 The Vearch Authors.
+//
+// Licensed under the Apache License, Version 2.0 (the "License");
+// you may not use this file except in compliance with the License.
+// You may obtain a copy of the License at
+//
+//     http://www.apache.org/licenses/LICENSE-2.0
+//
+// Unless required by applicable law or agreed to in writing, software
+// distributed under the License is distributed on an "AS IS" BASIS,
+// WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or
+// implied. See the License for the specific language governing
+// permissions and limitations under the License.
+
+package entity
+
+import "time"
+
+// BackupSpaceRequest backup space request
+type BackupSpaceRequest struct {
+	Command           string      `json:"command,omitempty"`
+	BackupID          int         `json:"backup_id,omitempty"`
+	VersionID         string      `json:"version_id,omitempty"`
+	BackupType        string      `json:"backup_type,omitempty"` // Backup type: "full" for full backup, "incremental" for incremental backup (default: full)
+	Part              PartitionID `json:"part"`
+	SourceClusterName string      `json:"source_cluster_name,omitempty"` // Source cluster name (for cross-cluster restore)
+	S3Param           struct {
+		Region     string `json:"region"`
+		BucketName string `json:"bucket_name"`
+		EndPoint   string `json:"endpoint"`
+		AccessKey  string `json:"access_key"`
+		SecretKey  string `json:"secret_key"`
+		UseSSL     bool   `json:"use_ssl"`
+	} `json:"s3_param,omitempty"`
+}
+
+// BackupOrRestoreRequest backup or restore request
+type BackupOrRestoreRequest struct {
+	Database          string `json:"database"`
+	Space             string `json:"space"`
+	BackupID          string `json:"backup_id"`
+	VersionID         string `json:"version_id"`
+	Command           string `json:"command,omitempty"`
+	BackupType        string `json:"backup_type,omitempty"`         // Backup type: "full" for full backup, "incremental" for incremental backup (default: incremental)
+	S3PartitionID     uint32 `json:"s3_partition_id,omitempty"`     // Partition ID on S3 (used during restore when new partition ID differs from S3 partition ID)
+	SourceClusterName string `json:"source_cluster_name,omitempty"` // Source cluster name (for cross-cluster restore)
+	S3Param           struct {
+		Region     string `json:"region"`
+		BucketName string `json:"bucket_name"`
+		EndPoint   string `json:"endpoint"`
+		AccessKey  string `json:"access_key"`
+		SecretKey  string `json:"secret_key"`
+		UseSSL     bool   `json:"use_ssl"`
+	} `json:"s3_param,omitempty"`
+}
+
+// BackupSpaceResponse backup space response
+type BackupSpaceResponse struct {
+	BackupID  int    `json:"backup_id,omitempty"`
+	BackupIDs []int  `json:"backup_ids,omitempty"`
+	VersionID string `json:"version_id,omitempty"`
+}
+
+// BackupProgressResponse backup progress response
+type BackupProgressResponse struct {
+	TotalTasks     int     `json:"total_tasks,omitempty"`     // Total number of tasks
+	CompletedTasks int     `json:"completed_tasks,omitempty"` // Number of completed tasks
+	SuccessRatio   float64 `json:"success_ratio,omitempty"`   // Success ratio of partitions (0.0-1.0)
+	Status         string  `json:"status,omitempty"`          // Backup status: completed, failed, running
+	VersionID      string  `json:"version_id,omitempty"`      // Version ID
+}
+
+// BackupStatusQuery backup status query
+type BackupStatusQuery struct {
+	SpaceKey string `json:"space_key"`
+	BackupID string `json:"backup_id"`
+}
+
+// BackupStatusResponse backup status response
+type BackupStatusResponse struct {
+	Exists       bool   `json:"exists"`
+	Status       int    `json:"status"` // 0=running, 1=completed, 2=failed
+	ErrorMessage string `json:"error_message"`
+}
+
+// DeleteBackupVersionRequest delete backup version request
+type DeleteBackupVersionRequest struct {
+	SpaceKey  string `json:"space_key"`
+	VersionID string `json:"version_id"`
+}
+
+// BackupVersion backup version
+type BackupVersion struct {
+	SpaceKey    string                 `json:"space_key"`   // dbName-spaceName
+	VersionID   string                 `json:"version_id"`  // version ID
+	BackupID    string                 `json:"backup_id"`   // backup ID
+	CreateTime  time.Time              `json:"create_time"` // creation time
+	Size        int64                  `json:"size"`        // version size
+	Status      BackupVersionStatus    `json:"status"`      // version status, complete status flow
+	Description string                 `json:"description"` // version description
+	Checksum    string                 `json:"checksum"`    // checksum
+	Partitions  []*PartitionBackupInfo `json:"partitions"`  // partition backup information
+}
+
+// BackupVersionStatus version status
+type BackupVersionStatus int
+
+// BackupTaskStatus backup task status
+type BackupTaskStatus int
+
+// PartitionBackupInfo partition backup information
+type PartitionBackupInfo struct {
+	Par
```

**File**: `internal/entity/space.go` (modified, +0/-19)
```diff
@@ -129,25 +129,6 @@ type SpaceInfo struct {
 	Errors        []string         `json:"errors,omitempty"`
 }
 
-type BackupSpaceRequest struct {
-	Command  string      `json:"command,omitempty"`
-	BackupID int         `json:"backup_id,omitempty"`
-	Part     PartitionID `json:"part"`
-	S3Param  struct {
-		Region     string `json:"region"`
-		BucketName string `json:"bucket_name"`
-		EndPoint   string `json:"endpoint"`
-		AccessKey  string `json:"access_key"`
-		SecretKey  string `json:"secret_key"`
-		UseSSL     bool   `json:"use_ssl"`
-	} `json:"s3_param,omitempty"`
-}
-
-type BackupSpaceResponse struct {
-	BackupID  int   `json:"backup_id,omitempty"`
-	BackupIDs []int `json:"backup_ids,omitempty"`
-}
-
 type SpaceProperties struct {
 	FieldType  vearchpb.FieldType   `json:"field_type"`
 	Type       string               `json:"type"`
```

**File**: `internal/master/cluster_api.go` (modified, +227/-2)
```diff
@@ -26,6 +26,8 @@ import (
 
 	"github.com/cubefs/cubefs/depends/tiglabs/raft/proto"
 	"github.com/gin-gonic/gin"
+	"github.com/minio/minio-go/v7"
+	"github.com/minio/minio-go/v7/pkg/credentials"
 	"github.com/spf13/cast"
 	"github.com/vearch/vearch/v3/internal/client"
 	"github.com/vearch/vearch/v3/internal/config"
@@ -54,6 +56,7 @@ const (
 	paramHeaderAuthKey  = "Authorization"
 	paramNodeID         = "node_id"
 	paramRequestID      = "X-Request-Id"
+	versionID           = "version_id"
 	defaultResourceName = "default"
 )
 
@@ -290,6 +293,10 @@ func ExportToClusterHandler(router *gin.Engine, masterService *masterService, se
 	groupAuth.PUT(fmt.Sprintf("/dbs/:%s/spaces/:%s", paramDbName, paramSpaceName), c.updateSpace)
 	groupAuth.POST(fmt.Sprintf("/backup/dbs/:%s/spaces/:%s", paramDbName, paramSpaceName), c.backupSpace)
 	groupAuth.POST(fmt.Sprintf("/backup/dbs/:%s", paramDbName), c.backupDb)
+	groupAuth.GET(fmt.Sprintf("/backup/dbs/:%s/spaces/:%s/versions/:%s/progress", paramDbName, paramSpaceName, versionID), c.getBackupProgress)
+	groupAuth.GET(fmt.Sprintf("/restore/dbs/:%s/spaces/:%s/progress", paramDbName, paramSpaceName), c.getRestoreProgress)
+	groupAuth.DELETE(fmt.Sprintf("/backup/dbs/:%s/spaces/:%s/versions/:%s", paramDbName, paramSpaceName, versionID), c.deleteBackupVersion)
+	groupAuth.DELETE(fmt.Sprintf("/backup/dbs/:%s/spaces/:%s/versions/:%s/direct", paramDbName, paramSpaceName, versionID), c.deleteBackupVersionDirect)
 
 	// modify engine config handler
 	groupAuth.POST("/config/:"+paramDbName+"/:"+paramSpaceName, c.modifySpaceConfig)
@@ -857,7 +864,8 @@ func (ca *clusterAPI) backupDb(c *gin.Context) {
 
 	res := &entity.BackupSpaceResponse{}
 	for _, space := range spaces {
-		res, err = ca.masterService.Backup().BackupSpace(c, ca.masterService.DB(), ca.masterService.Space(), ca.masterService.Config(), dbName, space.Name, backup)
+		//res, err = ca.masterService.Backup().BackupSpace(c, ca.masterService.DB(), ca.masterService.Space(), ca.masterService.Config(), dbName, space.Name, backup)
+		res, err = ca.masterService.Backup().SpaceSnapshot(c, ca.masterService.DB(), ca.masterService.Space(), ca.masterService.Config(), dbName, space.Name, backup)
 		if err != nil {
 			err = fmt.Errorf("backup space %s failed, err: %s", space.Name, err.Error())
 			httpCode = response.New(c).JsonError(errors.NewErrInternal(err))
@@ -895,7 +903,8 @@ func (ca *clusterAPI) backupSpace(c *gin.Context) {
 
 	res := &entity.BackupSpaceResponse{}
 
-	res, err = ca.masterService.Backup().BackupSpace(c, ca.masterService.DB(), ca.masterService.Space(), ca.masterService.Config(), dbName, spaceName, backup)
+	//res, err = ca.masterService.Backup().BackupSpace(c, ca.masterService.DB(), ca.masterService.Space(), ca.masterService.Config(), dbName, spaceName, backup)
+	res, err = ca.masterService.Backup().SpaceSnapshot(c, ca.masterService.DB(), ca.masterService.Space(), ca.masterService.Config(), dbName, spaceName, backup)
 	if err != nil {
 		httpCode = response.New(c).JsonError(errors.NewErrInternal(err))
 		return
@@ -904,6 +913,222 @@ func (ca *clusterAPI) backupSpace(c *gin.Context) {
 	}
 }
 
+// getBackupProgress gets backup progress
+func (ca *clusterAPI) getBackupProgress(c *gin.Context) {
+	dbName := c.Param(paramDbName)
+	spaceName := c.Param(paramSpaceName)
+	versionIDParam := c.Param(versionID)
+	log.Info("getBackupProgress handler called: dbName=%s, spaceName=%s, versionID=%s, path=%s",
+		dbName, spaceName, versionIDParam, c.Request.URL.Path)
+	if dbName == "" || spaceName == "" || versionIDParam == "" {
+		log.Warn("getBackupProgress: missing parameters, dbName=%s, spaceName=%s, versionID=%s",
+			dbName, spaceName, versionIDParam)
+		response.New(c).JsonError(errors.NewErrBadRequest(fmt.Errorf("dbName, spaceName and versionID are required")))
+		return
+	}
+	// Call BackupService to get backup progress
+	progress, err := ca.masterService.Backup().GetBackupProgress(c, dbName, spaceName, versionIDParam)
+	if err != nil {
+		log.Error("getBackupProgress failed: %v", err)
+		response.New(c).JsonError(errors.NewErrInternal(err))
+		return
+	}
+	log.Info("getBackupProgress success: total=%d, completed=%d, ratio=%.2f",
+		progress.TotalTasks, progress.CompletedTasks, progress.SuccessRatio)
+	response.New(c).JsonSuccess(progress)
+}
+
+// getRestoreProgress gets restore progress
+func (ca *clusterAPI) getRestoreProgress(c *gin.Context) {
+	dbName := c.Param(paramDbName)
+	spaceName := c.Param(paramSpaceName)
+	log.Info("getRestoreProgress handler called: dbName=%s, spaceName=%s, path=%s",
+		dbName, spaceName, c.Request.URL.Path)
+	if dbName == "" || spaceName == "" {
+		log.Warn("getRestoreProgress: missing parameters, dbName=%s, spaceName=%s",
+			dbName, spaceName)
+		response.New(c).JsonError(errors.NewErrBadRequest(fmt.Errorf("dbName and spaceName are required")))
+		return
+	}
+	// Call BackupService to get restore progress
+	progress, err := ca.masterService.Backup().GetRestoreProgress(c, dbName, spaceName
```

**File**: `internal/master/server.go` (modified, +3/-0)
```diff
@@ -111,6 +111,9 @@ func (s *Server) Start() (err error) {
 		return err
 	}
 
+	// start backup service (including backup monitor and version manager)
+	service.Backup().Start()
+
 	monitorService := &monitorService{}
 	if config.Conf().Global.SelfManageEtcd {
 		monitorService = newMonitorService(service, &etcdserver.EtcdServer{})
```

**File**: `internal/master/services/backup_service.go` (modified, +1940/-12)
```diff
@@ -20,10 +20,13 @@ import (
 	"math"
 	"os"
 	"path/filepath"
+	"sort"
 	"strconv"
 	"strings"
+	"sync"
 	"time"
 
+	"github.com/google/uuid"
 	"github.com/minio/minio-go/v7"
 	"github.com/minio/minio-go/v7/pkg/credentials"
 	"github.com/vearch/vearch/v3/internal/client"
@@ -33,16 +36,268 @@ import (
 	json "github.com/vearch/vearch/v3/internal/pkg/vjson"
 )
 
+// Type aliases to maintain original usage without entity prefix
+type (
+	BackupVersion                = entity.BackupVersion
+	BackupVersionStatus          = entity.BackupVersionStatus
+	BackupTaskStatus             = entity.BackupTaskStatus
+	PartitionBackupInfo          = entity.PartitionBackupInfo
+	PartitionBackupOrRestoreTask = entity.PartitionBackupOrRestoreTask
+	VersionInfo                  = entity.VersionInfo
+	VersionStatusInfo            = entity.VersionStatusInfo
+	CreateVersionRequest         = entity.CreateVersionRequest
+)
+
 type BackupService struct {
-	client *client.Client
+	client        *client.Client
+	backupManager *BackupManager
+}
+
+func buildSpaceKey(dbName, spaceName string) string {
+	return fmt.Sprintf("%s-%s", dbName, spaceName)
 }
 
 func NewBackupService(client *client.Client) *BackupService {
-	return &BackupService{client: client}
+	return &BackupService{
+		client:        client,
+		backupManager: NewBackupManager(client),
+	}
+}
+
+// Start starts the backup service, including the backup monitor and version manager
+func (s *BackupService) Start() {
+	if s.backupManager != nil {
+		s.backupManager.Start()
+		log.Info("BackupService started successfully")
+	}
+}
+
+// GetBackupProgress gets the backup progress for the specified space
+func (s *BackupService) GetBackupProgress(ctx context.Context, dbName, spaceName, versionID string) (*entity.BackupProgressResponse, error) {
+	// Construct spaceKey in format: dbName-spaceName
+	spaceKey := buildSpaceKey(dbName, spaceName)
+
+	if s.backupManager == nil || s.backupManager.backupMonitor == nil {
+		return nil, fmt.Errorf("backup service not initialized")
+	}
+
+	s.backupManager.muVersionCache.RLock()
+	versionInfo, exists := s.backupManager.versionCache[versionID]
+	s.backupManager.muVersionCache.RUnlock()
+
+	if exists {
+		switch versionInfo.Status {
+		case VersionStatusCompleted:
+			return &entity.BackupProgressResponse{
+				Status:    BackupStatusStringCompleted,
+				VersionID: versionID,
+			}, nil
+		case VersionStatusFailed:
+			return &entity.BackupProgressResponse{
+				Status:    BackupStatusStringFailed,
+				VersionID: versionID,
+			}, nil
+		}
+	}
+
+	progress := s.backupManager.backupMonitor.GetBackupProgress(spaceKey)
+	if progress.TotalTasks == 0 {
+		s.backupManager.muVersionCache.RLock()
+		versionInfo, exists := s.backupManager.versionCache[versionID]
+		s.backupManager.muVersionCache.RUnlock()
+
+		if exists {
+			switch versionInfo.Status {
+			case VersionStatusCompleted:
+				return &entity.BackupProgressResponse{
+					Status:    BackupStatusStringCompleted,
+					VersionID: versionID,
+				}, nil
+			case VersionStatusFailed:
+				return &entity.BackupProgressResponse{
+					Status:    BackupStatusStringFailed,
+					VersionID: versionID,
+				}, nil
+			}
+		}
+	}
+
+	if progress.TotalTasks > 0 {
+		progress.Status = BackupStatusStringRunning
+		progress.VersionID = versionID
+	}
+
+	return progress, nil
+}
+
+// GetRestoreProgress gets the restore progress for the specified space
+func (s *BackupService) GetRestoreProgress(ctx context.Context, dbName, spaceName string) (*entity.BackupProgressResponse, error) {
+	spaceKey := buildSpaceKey(dbName, spaceName)
+
+	if s.backupManager == nil || s.backupManager.backupMonitor == nil {
+		return nil, fmt.Errorf("backup service not initialized")
+	}
+
+	s.backupManager.backupMonitor.mu.RLock()
+	tasks, exists := s.backupManager.backupMonitor.tasks[spaceKey]
+	var versionID string
+	if exists {
+		for _, task := range tasks {
+			if task.TaskType == BackupTaskTypeRestore && task.BackupRequest != nil {
+				versionID = task.BackupRequest.VersionID
+				break
+			}
+		}
+	}
+	if versionID == "" {
+		versionID = s.backupManager.backupMonitor.restoreVersionMapping[spaceKey]
+		if versionID != "" {
+			log.Debug("Found versionID from restoreVersionMapping: spaceKey=%s, versionID=%s", spaceKey, versionID)
+		}
+	}
+	s.backupManager.backupMonitor.mu.RUnlock()
+
+	if versionID != "" {
+		s.backupManager.muVersionCache.RLock()
+		versionInfo, cacheExists := s.backupManager.versionCache[versionID]
+		s.backupManager.muVersionCache.RUnlock()
+
+		if cacheExists {
+			switch versionInfo.Status {
+			case VersionStatusCompleted:
+				return &entity.BackupProgressResponse{
+					Status:    "completed",
+					VersionID: versionID,
+				}, nil
+			case VersionStatusFailed:
+				return &entity.BackupProgressResponse{
+					Status:    "failed",
+					VersionID: versionID,
+				}, nil
+			}
+		}
+	}
+
+	progress := s.backupManager.backupMonitor.GetRestoreProgress(spaceKey)
+
+	if progress.TotalTasks == 0 && versi
```

---

### Incident Patch 7: `a2c66657` (2026-01-31)
**Commit Message**: fix: check valid segment for memory buffer when updating and loading (#862)

* perf: remove useless prometheus metrics

* fix: check valid segment for memory buffer when updating and loading

**File**: `internal/client/master_cache.go` (modified, +6/-6)
```diff
@@ -104,7 +104,7 @@ func cachePartitionKey(space string, pid entity.PartitionID) string {
 	return space + "/" + strconv.FormatInt(int64(pid), 10)
 }
 
-func cacheSpaceKey(db, space string) string {
+func CacheSpaceKey(db, space string) string {
 	return db + "/" + space
 }
 
@@ -211,7 +211,7 @@ func (cliCache *clientCache) reloadRoleCache(ctx context.Context, sync bool, rol
 
 // find a space by db and space name, if not exist so query it from etcd
 func (cliCache *clientCache) SpaceByCache(ctx context.Context, db, space string) (*entity.Space, error) {
-	key := cacheSpaceKey(db, space)
+	key := CacheSpaceKey(db, space)
 
 	get, found := cliCache.spaceCache.Get(key)
 	if found {
@@ -236,7 +236,7 @@ func (cliCache *clientCache) SpaceByCache(ctx context.Context, db, space string)
 }
 
 func (cliCache *clientCache) reloadSpaceCache(ctx context.Context, sync bool, db string, spaceName string) error {
-	key := cacheSpaceKey(db, spaceName)
+	key := CacheSpaceKey(db, spaceName)
 
 	fun := func() error {
 		log.Info("to reload db:[%s] space:[%s]", db, spaceName)
@@ -467,7 +467,7 @@ func (cliCache *clientCache) startCacheJob(ctx context.Context) error {
 			if err != nil {
 				return vearchpb.NewError(vearchpb.ErrorEnum_PARAM_ERROR, fmt.Errorf("find db by id err: %s, data: %s", err.Error(), string(value)))
 			}
-			ckey := cacheSpaceKey(dbName, space.Name)
+			ckey := CacheSpaceKey(dbName, space.Name)
 			if oldValue, b := cliCache.spaceCache.Get(ckey); !b || space.Version > oldValue.(*entity.Space).Version {
 				spaceCacheLock.Lock()
 				cliCache.spaceCache.Set(ckey, space, cache.NoExpiration)
@@ -788,7 +788,7 @@ func (cliCache *clientCache) initSpace(ctx context.Context) error {
 		}
 
 		spaceCacheLock.Lock()
-		if err := cliCache.spaceCache.Add(cacheSpaceKey(db, s.Name), s, cache.NoExpiration); err != nil {
+		if err := cliCache.spaceCache.Add(CacheSpaceKey(db, s.Name), s, cache.NoExpiration); err != nil {
 			log.Error(err.Error())
 		} else {
 			cliCache.spaceIDCache.Set(cast.ToString(s.Id), s, cache.NoExpiration)
@@ -902,7 +902,7 @@ func (cliCache *clientCache) initRouter(ctx context.Context) error {
 
 func (cliCache *clientCache) DeleteSpaceCache(ctx context.Context, db, space string) {
 	spaceCacheLock.Lock()
-	cliCache.spaceCache.Delete(cacheSpaceKey(db, space))
+	cliCache.spaceCache.Delete(CacheSpaceKey(db, space))
 	spaceCacheLock.Unlock()
 }
 
```

**File**: `internal/client/ps_admin_service.go` (modified, +8/-1)
```diff
@@ -15,6 +15,7 @@
 package client
 
 import (
+	"fmt"
 	"strings"
 
 	"github.com/vearch/vearch/v3/internal/entity"
@@ -181,6 +182,9 @@ func PartitionInfo(addr string, pid entity.PartitionID, detail_info bool) (value
 	if err != nil {
 		return nil, err
 	}
+	if len(infos) == 0 {
+		return nil, vearchpb.NewError(vearchpb.ErrorEnum_PARTITION_NOT_EXIST, fmt.Errorf("get partitionID: [%d] infos is nil", pid))
+	}
 	return infos[0], nil
 }
 
@@ -206,11 +210,14 @@ func _partitionsInfo(addr string, pid entity.PartitionID, detail_info bool) (val
 	if reply.Err.Code != vearchpb.ErrorEnum_SUCCESS {
 		return nil, vearchpb.NewError(reply.Err.Code, nil)
 	}
+	if reply.Data == nil {
+		return nil, vearchpb.NewError(vearchpb.ErrorEnum_PARTITION_NOT_EXIST, fmt.Errorf("get partitionID: [%d] reply data is nil", pid))
+	}
 	value = make([]*entity.PartitionInfo, 0, 1)
 	err = vjson.Unmarshal(reply.Data, &value)
 	if err != nil {
 		log.Error("Unmarshal partition info failed, err: [%v]", err)
-		return
+		return nil, err
 	}
 	return value, nil
 }
```

**File**: `internal/engine/common/gamma_common_data.h` (modified, +2/-1)
```diff
@@ -24,8 +24,9 @@ const float GAMMA_INDEX_RECALL_RATIO = 1.0f;
 const int min_points_per_centroid = 39;
 const int default_points_per_centroid = 200;
 const int max_points_per_centroid = 256;
-const int defautMemoryBufferSegmentSize = 100000;
+const int DEFAULT_MEMORY_BUFFER_SEGMENT_SIZE = 100000;
 const int brute_force_search_threshold = 100;
+const int ADD_COUNT_THRESHOLD = 100000;
 
 enum class VectorStorageType : std::uint8_t { MemoryOnly, MemoryBuffer, RocksDB };
 
```

**File**: `internal/engine/index/impl/gamma_index_ivfflat.cc` (modified, +1/-1)
```diff
@@ -397,7 +397,7 @@ bool GammaIVFFlatIndex::Add(int n, const uint8_t *vec) {
   indexed_vec_count_ += n;
 #ifdef PERFORMANCE_TESTING
   add_count_ += n;
-  if (add_count_ >= 10000) {
+  if (add_count_ >= ADD_COUNT_THRESHOLD) {
     double t1 = faiss::getmillisecs();
     LOG(DEBUG) << "Add time [" << (t1 - t0) / n << "]ms, count "
                << indexed_vec_count_ << " wanted n=" << n
```

**File**: `internal/engine/index/impl/gamma_index_ivfpq.cc` (modified, +1/-1)
```diff
@@ -496,7 +496,7 @@ bool GammaIVFPQIndex::Add(int n, const uint8_t *vec) {
   indexed_vec_count_ += n;
 #ifdef PERFORMANCE_TESTING
   add_count_ += n;
-  if (add_count_ >= 10000) {
+  if (add_count_ >= ADD_COUNT_THRESHOLD) {
     double t1 = faiss::getmillisecs();
     LOG(DEBUG) << "Add time [" << (t1 - t0) / n << "]ms, count "
                << indexed_vec_count_ << ", wanted n=" << n
```

**File**: `internal/engine/index/impl/hnswlib/gamma_index_hnswlib.cc` (modified, +1/-1)
```diff
@@ -332,7 +332,7 @@ int GammaIndexHNSWLIB::AddVertices(size_t n0, size_t n, const float *x) {
   }
 #ifdef PERFORMANCE_TESTING
   add_count_ += n;
-  if (add_count_ >= 10000) {
+  if (add_count_ >= ADD_COUNT_THRESHOLD) {
     LOG(DEBUG) << "adding elements on top of " << n0 << ", average add time "
                << (utils::getmillisecs() - t0) / n << " ms" << ", wanted n=" << n
                << ", real add=" << n_add;
```

**File**: `internal/engine/search/engine.cc` (modified, +4/-2)
```diff
@@ -729,7 +729,7 @@ int Engine::AddOrUpdate(Doc &doc) {
   }
 #ifdef PERFORMANCE_TESTING
   double end = utils::getmillisecs();
-  if (max_docid_ % 10000 == 0) {
+  if (max_docid_ % ADD_COUNT_THRESHOLD == 0) {
     LOG(DEBUG) << space_name_ << " table cost [" << end_table - start
                << "]ms, vec store cost [" << end - end_table
                << "]ms, max_docid_=" << max_docid_;
@@ -1178,7 +1178,9 @@ int Engine::Dump() {
     char tm_str[100];
     std::strftime(tm_str, sizeof(tm_str), date_time_format_.c_str(),
                   std::localtime(&t));
-
+    if (!utils::isFolderExist(dump_path_.c_str())) {
+      mkdir(dump_path_.c_str(), S_IRWXU | S_IRWXG | S_IROTH | S_IXOTH);
+    }
     std::string path = dump_path_ + "/" + tm_str;
     if (!utils::isFolderExist(path.c_str())) {
       mkdir(path.c_str(), S_IRWXU | S_IRWXG | S_IROTH | S_IXOTH);
```

**File**: `internal/engine/storage/storage_manager.cc` (modified, +1/-1)
```diff
@@ -75,7 +75,7 @@ void StorageManager::GetVectorIndexCount(int64_t &vector_index_count) {
   if (s.ok()) {
     vector_index_count = std::stoll(value);
   } else if (s.IsNotFound()) {
-    vector_index_count = -1;
+    vector_index_count = 0;
   } else {
     LOG(ERROR) << "rocksdb get error:" << s.ToString() << ", key=" << key_str;
     vector_index_count = -2;
```

---

### Incident Patch 8: `f3255b3b` (2026-01-30)
**Commit Message**: fix: set value for httpRes and add default value for config (#860)

Co-authored-by: yanwenru1 <[REDACTED_EMAIL]>

**File**: `internal/entity/config.go` (modified, +2/-3)
```diff
@@ -62,8 +62,8 @@ var (
 
 var ConfigInfo = &Config{
 	RouterCount:        0.0,
-	RequestLimitConfig: &RequestLimitCfg{},
-	MemoryLimitConfig:  &MemoryLimitCfg{},
+	RequestLimitConfig: &RequestLimitCfg{true, DefaultReadRequestLimitCount, DefaultWriteRequestLimitCount},
+	MemoryLimitConfig:  &MemoryLimitCfg{true, DefaultRouterMemoryLimitPercent, DefaultPsMemoryLimitPercent},
 }
 
 func SetRequestLimit(requestLimit *RequestLimitCfg) {
@@ -78,7 +78,6 @@ func SetRequestLimit(requestLimit *RequestLimitCfg) {
 
 		if requestLimit.TotalWriteLimit > 0 {
 			ConfigInfo.RequestLimitConfig.TotalWriteLimit = requestLimit.TotalWriteLimit
-
 		} else {
 			ConfigInfo.RequestLimitConfig.TotalWriteLimit = DefaultWriteRequestLimitCount
 		}
```

**File**: `internal/master/cluster_api.go` (modified, +3/-3)
```diff
@@ -201,9 +201,9 @@ func TimeoutMiddleware(defaultTimeout time.Duration) gin.HandlerFunc {
 					RequestId: c.GetHeader(paramRequestID),
 					Msg:       "get response data error",
 				}
-				res := &response.Response{}
-				res.SetHttpReply(httpReply)
-				res.SetHttpStatus(http.StatusInternalServerError)
+				httpResp = &response.Response{}
+				httpResp.SetHttpReply(httpReply)
+				httpResp.SetHttpStatus(http.StatusInternalServerError)
 			}
 			resultCh <- httpResp
 		}()
```

---

### Incident Patch 9: `8dc4fb9c` (2026-01-08)
**Commit Message**: fix: check partition leader before register to master (#859)

* fix: check partition leader before register to master

* add error message check info

**File**: `.github/workflows/CI_cluster_ps.yml` (modified, +1/-1)
```diff
@@ -126,7 +126,7 @@ jobs:
           echo "Status is red."
         fi
         sleep 30
-        errors=$(curl -s -L -u root:secret http://127.0.0.1:8817/cluster/health?detail=true\&timeout=1000000 | jq -r '.data[0].spaces[].errors[] | select(contains("leader"))')
+        errors=$(curl -s -L -u root:secret http://127.0.0.1:8817/cluster/health?detail=true\&timeout=1000000 | jq -r '.data[0].spaces[].errors[] | select(contains("leader") or contains("call_rpcclient_failed"))')
         if [ -z "$errors" ]; then
           echo "Error: errors is $errors."
           exit 1
```

**File**: `internal/ps/server.go` (modified, +5/-0)
```diff
@@ -316,6 +316,11 @@ func (s *Server) registerMaster(leader entity.NodeID, pid entity.PartitionID) {
 		return
 	}
 
+	if !s.raftServer.IsLeader(uint64(pid)) {
+		log.Debug("server %d is not leader of partition: [%d]", s.nodeID, pid)
+		return
+	}
+
 	partition := store.(PartitionStore).GetPartition()
 	partition.LeaderID = s.nodeID
 
```

---

### Incident Patch 10: `097c6a7f` (2025-12-31)
**Commit Message**: fix: raft server can't get node replica info (#858)

**File**: `internal/ps/partition_service.go` (modified, +9/-0)
```diff
@@ -129,6 +129,7 @@ func (s *Server) LoadPartition(ctx context.Context, pid entity.PartitionID, spac
 	for _, replica := range replicas {
 		if server, err := s.client.Master().QueryServer(context.Background(), replica); err != nil {
 			log.Error("partition recovery get server info err: %s", err.Error())
+			s.raftResolver.AddNode(replica, &entity.Replica{NodeID: replica})
 		} else {
 			s.raftResolver.AddNode(replica, server.Replica())
 		}
@@ -178,11 +179,19 @@ func (s *Server) CreatePartition(ctx context.Context, space *entity.Space, pid e
 		for _, nodeId := range store.Partition.Replicas {
 			if server, err := s.client.Master().QueryServer(ctx, nodeId); err != nil {
 				fs := s.client.Master().QueryFailServerByNodeID(ctx, nodeId)
+				var replica *entity.Replica
 				if fs == nil {
 					log.Error("get server info err %s", err.Error())
 					return err
 				}
 				log.Warn("get nodeid: %d, failserver %+v", nodeId, fs)
+				if fs.Node != nil {
+					replica = fs.Node.Replica()
+				} else {
+					replica = &entity.Replica{}
+				}
+				replica.NodeID = fs.ID
+				s.raftResolver.AddNode(nodeId, replica)
 			} else {
 				s.raftResolver.AddNode(nodeId, server.Replica())
 			}
```

**File**: `internal/ps/server.go` (modified, +1/-0)
```diff
@@ -279,6 +279,7 @@ func (s *Server) HandleRaftReplicaEvent(event *raftstore.RaftReplicaEvent) {
 		if node := s.raftResolver.GetNode(event.Replica.NodeID); node == nil { // if not found, get it from master
 			if server, err := s.client.Master().QueryServer(context.Background(), event.Replica.NodeID); err != nil {
 				log.Error("get server info error: %s", err.Error())
+				s.raftResolver.AddNode(event.Replica.NodeID, &entity.Replica{NodeID: event.Replica.NodeID})
 			} else {
 				s.raftResolver.AddNode(event.Replica.NodeID, server.Replica())
 			}
```

**File**: `internal/ps/storage/raftstore/store.go` (modified, +1/-1)
```diff
@@ -168,7 +168,7 @@ func (s *Store) Start() (err error) {
 		peer := proto.Peer{Type: proto.PeerNormal, ID: uint64(repl)}
 		raftConf.Peers = append(raftConf.Peers, peer)
 	}
-	raftLog, err := rlog.NewLog(config.Conf().GetLogDir(), "PS.RAFT", vearchlog.WarnLogType)
+	raftLog, err := rlog.NewLog(config.Conf().GetLogDir(), "PS.RAFT", vearchlog.DebugLogType)
 	if err != nil {
 		s.Engine.Close()
 		return vearchpb.NewError(vearchpb.ErrorEnum_INTERNAL_ERROR, fmt.Errorf("start partition[%d] open raft log error: %s", s.Partition.Id, err.Error()))
```

---

### Incident Patch 11: `8bf2882b` (2025-12-16)
**Commit Message**: fix: delete existed partiton when create space failed

**File**: `internal/config/config.go` (modified, +1/-1)
```diff
@@ -399,7 +399,7 @@ func InitConfig(path string) {
 	single = &Config{
 		mu: new(sync.RWMutex),
 		Global: &GlobalCfg{
-			ResourceLimitRate: 0.85,
+			ResourceLimitRate: entity.DefaultResourceLimitRate,
 		},
 		PS: &PSCfg{
 			ReplicaAutoRecoverTime: -1,
```

**File**: `internal/entity/config.go` (modified, +1/-0)
```diff
@@ -41,6 +41,7 @@ const (
 	DefaultWriteRequestLimitCount   = 1000000.0
 	DefaultRouterMemoryLimitPercent = 90
 	DefaultPsMemoryLimitPercent     = 90
+	DefaultResourceLimitRate        = 0.9
 )
 
 var (
```

**File**: `internal/master/cluster_api.go` (modified, +0/-1)
```diff
@@ -168,7 +168,6 @@ func TimeoutMiddleware(defaultTimeout time.Duration) gin.HandlerFunc {
 						"request_id": c.GetHeader("X-Request-Id"),
 						"code":       err.Code(),
 						"msg":        err.Msg()})
-				//response.New(c).JsonError(errors.NewErrBadRequest(fmt.Errorf(msg)))
 				c.Abort()
 				return
 			}
```

**File**: `internal/master/services/space_service.go` (modified, +7/-3)
```diff
@@ -221,9 +221,13 @@ func (s *SpaceService) CreateSpace(ctx context.Context, dbs *DBService, dbName s
 					}
 				}
 			}
-			err = masterClient.Delete(ctx, entity.PartitionKey(partition.Id))
-			if err != nil {
-				log.Error("delete partition key:[%s] has err:[%s]", entity.PartitionKey(partition.Id), err.Error())
+			if _, p_err := masterClient.QueryPartition(ctx, partition.Id); p_err != nil {
+				log.Info("query partition:[%d] has err: %s", partition.Id, p_err.Error())
+			} else {
+				d_err := masterClient.Delete(ctx, entity.PartitionKey(partition.Id))
+				if d_err != nil {
+					log.Error("delete partitionKey for partition:[%d] has err:[%s]", partition.Id, d_err.Error())
+				}
 			}
 		}
 		return err
```

**File**: `internal/router/document/doc_http.go` (modified, +1/-3)
```diff
@@ -275,8 +275,7 @@ func (handler *DocumentHandler) handleMasterRequest(c *gin.Context) {
 			"code":       res_err.Code(),
 			"request_id": c.GetHeader("X-Request-Id"),
 			"msg":        res_err.Msg(),
-        })
-		//response.New(c).JsonError(errors.NewErrBadRequest(err))
+		})
 		return
 	}
 	authHeader := c.GetHeader("Authorization")
@@ -292,7 +291,6 @@ func (handler *DocumentHandler) handleMasterRequest(c *gin.Context) {
 				"request_id": c.GetHeader("X-Request-Id"),
 				"msg":        res_err.Msg(),
 			})
-			//response.New(c).JsonError(errors.NewErrInternal(err))
 		}
 		return
 	}
```

---

### Incident Patch 12: `fbf3b6b1` (2025-12-16)
**Commit Message**: fix: fix clear request in omp (#857)

Co-authored-by: yanwenru1 <[REDACTED_EMAIL]>

**File**: `internal/engine/index/impl/gamma_index_binary_ivf.cc` (modified, +3/-1)
```diff
@@ -359,7 +359,9 @@ void GammaIndexBinaryIVF::search_knn_hamming_heap(
         get_GammaInvertedListScanner(store_pairs));
     scanner->set_search_context(retrieval_context);
 
-    RequestContext::ScopedContext(request, partition_id);
+    if (RequestContext::get_current_request() == nullptr) {
+      RequestContext::ScopedContext(request, partition_id);
+    }
 
 #pragma omp for
     for (size_t i = 0; i < n; i++) {
```

**File**: `internal/engine/index/impl/gamma_index_ivfflat.cc` (modified, +3/-1)
```diff
@@ -558,7 +558,9 @@ void GammaIVFFlatIndex::search_preassigned(RetrievalContext *retrieval_context,
         GetGammaInvertedListScanner(store_pairs, nullptr, retrieval_context, metric_type);
     utils::ScopeDeleter1<faiss::InvertedListScanner> del(scanner);
 
-    RequestContext::ScopedContext(request, partition_id);
+    if (RequestContext::get_current_request() == nullptr) {
+      RequestContext::ScopedContext(request, partition_id);
+    }
 
     /*****************************************************
      * Depending on parallel_mode, there are two possible ways
```

**File**: `internal/engine/index/impl/gamma_index_ivfpq.cc` (modified, +3/-1)
```diff
@@ -771,7 +771,9 @@ void GammaIVFPQIndex::search_preassigned(
         store_pairs, nullptr, retrieval_context, metric_type, this->pq.nbits);
     utils::ScopeDeleter1<faiss::InvertedListScanner> del(scanner);
 
-    RequestContext::ScopedContext(request, partition_id);
+    if (RequestContext::get_current_request() == nullptr) {
+      RequestContext::ScopedContext(request, partition_id);
+    }
 
     if (parallel_mode == 0) {  // parallelize over queries
 #pragma omp for
```

**File**: `internal/engine/index/impl/hnswlib/gamma_index_hnswlib.cc` (modified, +4/-1)
```diff
@@ -396,7 +396,10 @@ int GammaIndexHNSWLIB::Search(RetrievalContext *retrieval_context, int n,
 #pragma omp parallel for schedule(dynamic) num_threads(threads_num)
   for (int i = 0; i < n; ++i) {
     int j = 0;
-    RequestContext::ScopedContext(request, partition_id);
+
+    if (RequestContext::get_current_request() == nullptr) {
+      RequestContext::ScopedContext(request, partition_id);
+    }
 
     auto result = searchKnn(
         (const void *)(xq + i * d), k, fstdistfunc,
```

---

### Incident Patch 13: `6b4e1bde` (2025-12-10)
**Commit Message**: feat: Add memory circuit breaker and kill slow query (#699)

**File**: `go.mod` (modified, +1/-1)
```diff
@@ -31,7 +31,7 @@ require (
 	go.etcd.io/etcd/api/v3 v3.5.12
 	go.etcd.io/etcd/client/v3 v3.5.12
 	go.etcd.io/etcd/server/v3 v3.5.12
-	go.uber.org/atomic v1.9.0
+	go.uber.org/atomic v1.11.0
 	golang.org/x/exp v0.0.0-20230713183714-613f0c0eb8a1
 	golang.org/x/time v0.5.0
 	google.golang.org/grpc v1.64.1
```

**File**: `go.sum` (modified, +2/-0)
```diff
@@ -757,6 +757,8 @@ go.uber.org/atomic v1.4.0/go.mod h1:gD2HeocX3+yG+ygLZcrzQJaqmWj9AIm7n08wl/qW/PE=
 go.uber.org/atomic v1.7.0/go.mod h1:fEN4uk6kAWBTFdckzkM89CLk9XfWZrxpCo0nPH17wJc=
 go.uber.org/atomic v1.9.0 h1:ECmE8Bn/WFTYwEW/bpKD3M8VtR/zQVbavAoalC1PYyE=
 go.uber.org/atomic v1.9.0/go.mod h1:fEN4uk6kAWBTFdckzkM89CLk9XfWZrxpCo0nPH17wJc=
+go.uber.org/atomic v1.11.0 h1:ZvwS0R+56ePWxUNi+Atn9dWONBPp/AUETXlHW0DxSjE=
+go.uber.org/atomic v1.11.0/go.mod h1:LUxbIzbOniOlMKjJjyPfpl4v+PKK2cNJn91OQbhoJI0=
 go.uber.org/goleak v1.1.11-0.20210813005559-691160354723/go.mod h1:cwTWslyiVhfpKIDGSZEM2HlOvcqm+tG4zioyIeLoqMQ=
 go.uber.org/goleak v1.3.0 h1:2K3zAYmnTNqV73imy9J1T3WC+gmCePx2hEGkimedGto=
 go.uber.org/goleak v1.3.0/go.mod h1:CoHD4mav9JJNrW/WLlf7HGZPjdw8EucARQHekz1X6bE=
```

**File**: `internal/client/client.go` (modified, +294/-204)
```diff
@@ -113,13 +113,14 @@ func NewRouterRequest(ctx context.Context, client *Client) *routerRequest {
 }
 
 type routerRequest struct {
-	ctx     context.Context
-	client  *Client
-	md      map[string]string
-	head    *vearchpb.RequestHead
-	docs    []*vearchpb.Document
-	space   *entity.Space
-	sendMap map[entity.PartitionID]*vearchpb.PartitionData
+	ctx       context.Context
+	client    *Client
+	md        map[string]string
+	head      *vearchpb.RequestHead
+	docs      []*vearchpb.Document
+	space     *entity.Space
+	sendMap   map[entity.PartitionID]*vearchpb.PartitionData
+	clientMap sync.Map
 	// Err if error else nil
 	Err error
 }
@@ -648,9 +649,13 @@ func (r *routerRequest) searchFromPartition(ctx context.Context, partitionID ent
 			}
 		}
 		rpcStart = time.Now()
-		retry_err = rpcClient.Execute(ctx, UnaryHandler, pd, replyPartition)
+		if r.Err == nil {
+			r.clientMap.Store(partitionID, nodeID)
+			retry_err = rpcClient.Execute(ctx, UnaryHandler, pd, replyPartition)
+			r.clientMap.Delete(partitionID)
+		}
 		rpcEnd = time.Now()
-		if retry_err == nil {
+		if retry_err == nil || r.Err != nil {
 			break
 		}
 
@@ -680,32 +685,40 @@ func (r *routerRequest) searchFromPartition(ctx context.Context, partitionID ent
 	}
 
 	searchResponse := replyPartition.SearchResponse
-	if searchResponse != nil {
-		if trace {
-			rpcExecute := rpcEnd.Sub(rpcStart).Seconds() * 1000
-			rpcExecuteStr := strconv.FormatFloat(rpcExecute, 'f', 4, 64)
+	if r.Err == nil {
+		if searchResponse != nil && searchResponse.Head.Err != nil && searchResponse.Head.Err.GetCode() == vearchpb.ErrorEnum_PARTITION_SERVER_MEMORYEXCEED {
+			r.Err = vearchpb.NewError(vearchpb.ErrorEnum_PARTITION_SERVER_MEMORYEXCEED, errors.New("request canceled"))
+			replyPartition.Err = searchResponse.Head.Err
+		} else if searchResponse != nil {
+			if trace {
+				rpcExecute := rpcEnd.Sub(rpcStart).Seconds() * 1000
+				rpcExecuteStr := strconv.FormatFloat(rpcExecute, 'f', 4, 64)
 
-			if searchResponse.Head.Params != nil {
-				searchResponse.Head.Params["rpcExecute_"+partitionIDstr] = rpcExecuteStr
-			} else {
-				costTimeMap := make(map[string]string)
-				costTimeMap["rpcExecute_"+partitionIDstr] = rpcExecuteStr
-				responseHead := &vearchpb.ResponseHead{Params: costTimeMap}
-				searchResponse.Head = responseHead
+				if searchResponse.Head.Params != nil {
+					searchResponse.Head.Params["rpcExecute_"+partitionIDstr] = rpcExecuteStr
+				} else {
+					costTimeMap := make(map[string]string)
+					costTimeMap["rpcExecute_"+partitionIDstr] = rpcExecuteStr
+					responseHead := &vearchpb.ResponseHead{Params: costTimeMap}
+					searchResponse.Head = responseHead
+				}
 			}
-		}
 
-		flatBytes := searchResponse.FlatBytes
-		if flatBytes != nil {
-			deSerializeStartTime := time.Now()
-			sr := &vearchpb.SearchResponse{}
-			gamma.DeSerialize(flatBytes, sr)
-			searchResponse.Results = sr.Results
-			deSerializeEndTime := time.Now()
-			if trace {
-				deSerialize := deSerializeEndTime.Sub(deSerializeStartTime).Seconds() * 1000
-				deSerializeStr := strconv.FormatFloat(deSerialize, 'f', 4, 64)
-				searchResponse.Head.Params["deSerialize_"+partitionIDstr] = deSerializeStr
+			flatBytes := searchResponse.FlatBytes
+			if entity.CheckVirtualMemExceed(len(flatBytes)) {
+				r.Err = vearchpb.NewError(vearchpb.ErrorEnum_PARTITION_SERVER_MEMORYEXCEED, errors.New("request canceled"))
+				replyPartition.Err = &vearchpb.Error{Code: vearchpb.ErrorEnum_PARTITION_SERVER_MEMORYEXCEED, Msg: "request canceled"}
+			} else if flatBytes != nil {
+				deSerializeStartTime := time.Now()
+				sr := &vearchpb.SearchResponse{}
+				gamma.DeSerialize(flatBytes, sr)
+				searchResponse.Results = sr.Results
+				deSerializeEndTime := time.Now()
+				if trace {
+					deSerialize := deSerializeEndTime.Sub(deSerializeStartTime).Seconds() * 1000
+					deSerializeStr := strconv.FormatFloat(deSerialize, 'f', 4, 64)
+					searchResponse.Head.Params["deSerialize_"+partitionIDstr] = deSerializeStr
+				}
 			}
 		}
 	}
@@ -719,6 +732,30 @@ func (r *routerRequest) searchFromPartition(ctx context.Context, partitionID ent
 	respChain <- responseDoc
 }
 
+func (r *routerRequest) CancelRequestFromPartition() {
+	sendPartitionMap := r.sendMap
+
+	for partitionId := range sendPartitionMap {
+		if value, ok := r.clientMap.Load(partitionId); ok {
+			go func(pid entity.PartitionID, value interface{}) {
+				defer func() {
+					if err := recover(); err != nil {
+						msg := fmt.Sprintf("CancelRequestFromPartition partitionID: [%v], err: [%v]", pid, err)
+						r.Err = vearchpb.NewError(vearchpb.ErrorEnum_RECOVER, errors.New(msg))
+					}
+				}()
+				nodeId, _ := value.(entity.NodeID)
+				requestPartition := &vearchpb.PartitionData{PartitionID: partitionId, MessageID: r.GetMsgID()}
+
+				rpcClient := r.client.PS().GetOrCreateRPCClient(r.ctx, nodeId)
+				if rpcClient != nil {
+					rpcClient.Execute(r.ctx, RequestCancelHandler, requestPartition, new(vearchpb.PartitionData))
+				}
+			
```

**File**: `internal/client/master.go` (modified, +20/-0)
```diff
@@ -849,6 +849,26 @@ func (client *masterClient) CheckMasterConfig(ctx context.Context) error {
 	return nil
 }
 
+// check memory limit config, if changed then update
+func (m *masterClient) QueryMemoryLimitConfig(ctx context.Context) (*entity.MemoryLimitCfg, error) {
+	value, err := m.Get(ctx, entity.RouterConfigKey("memory_limit_config"))
+	if err != nil {
+		return nil, err
+	}
+
+	var memLimitConfig = &entity.MemoryLimitCfg{}
+	if value == nil {
+		memLimitConfig.MemoryLimitEnabled = true
+		memLimitConfig.RouterMemoryLimit = 90
+		memLimitConfig.PsMemoryLimit = 90
+	} else if err := vjson.Unmarshal(value, memLimitConfig); err != nil {
+		log.Error("unmarshl memory limit config err: %s", err.Error())
+		return nil, err
+	}
+
+	return memLimitConfig, err
+}
+
 func parseRegisterData(response []byte) ([]byte, error) {
 	js := &struct {
 		Code      int             `json:"code"`
```

**File**: `internal/client/master_cache.go` (modified, +36/-11)
```diff
@@ -666,16 +666,25 @@ func (cliCache *clientCache) startCacheJob(ctx context.Context) error {
 				}
 
 				log.Debug("[%v] add to router cache.", ip)
-			} else {
-				request_limit_cfg := &entity.RouterLimitCfg{}
+			} else if routerSplit[0] == entity.RequestLimitConfigKey {
+				request_limit_cfg := &entity.RequestLimitCfg{}
 				if err := vjson.Unmarshal(value, request_limit_cfg); err != nil {
-					return vearchpb.NewError(vearchpb.ErrorEnum_PARAM_ERROR, fmt.Errorf("put event router cache err, can't unmarshal event value: %s, error: %s", string(value), err.Error()))
+					return vearchpb.NewError(vearchpb.ErrorEnum_PARAM_ERROR, fmt.Errorf("put event router cache err, can't unmarshal request limit value: %s, error: %s", string(value), err.Error()))
 				}
 
-				cliCache.routerCache.Set("request_limit_config", request_limit_cfg, cache.NoExpiration)
+				cliCache.routerCache.Set(entity.RequestLimitConfigKey, request_limit_cfg, cache.NoExpiration)
 				entity.SetRequestLimit(request_limit_cfg)
 				log.Debug("router change request limit config [%v].", request_limit_cfg)
 
+			} else if routerSplit[0] == entity.MemoryLimitConfigKey {
+				memory_limit_cfg := &entity.MemoryLimitCfg{}
+				if err := vjson.Unmarshal(value, memory_limit_cfg); err != nil {
+					return vearchpb.NewError(vearchpb.ErrorEnum_PARAM_ERROR, fmt.Errorf("put event router cache err, can't unmarshal memory limit value: %s, error: %s", string(value), err.Error()))
+				}
+
+				cliCache.routerCache.Set(entity.MemoryLimitConfigKey, memory_limit_cfg, cache.NoExpiration)
+				entity.SetMemoryLimit(memory_limit_cfg, true)
+				log.Debug("router change memory limit config [%v].", memory_limit_cfg)
 			}
 
 			return nil
@@ -691,13 +700,20 @@ func (cliCache *clientCache) startCacheJob(ctx context.Context) error {
 					entity.SetRouterCount(false)
 				}
 				log.Debug("delete router[%s] from router cache.", ip)
-			} else {
-				cliCache.routerCache.Delete("request_limit_config")
-				request_limit_cfg := &entity.RouterLimitCfg{
+			} else if routerSplit[0] == entity.RequestLimitConfigKey {
+				cliCache.routerCache.Delete(entity.RequestLimitConfigKey)
+				request_limit_cfg := &entity.RequestLimitCfg{
 					RequestLimitEnabled: false,
 				}
 				entity.SetRequestLimit(request_limit_cfg)
 				log.Debug("delete request limit config from router cache.")
+			} else if routerSplit[0] == entity.MemoryLimitConfigKey {
+				cliCache.routerCache.Delete(entity.MemoryLimitConfigKey)
+				memory_limit_cfg := &entity.MemoryLimitCfg{
+					MemoryLimitEnabled: false,
+				}
+				entity.SetMemoryLimit(memory_limit_cfg, true)
+				log.Debug("delete memory limit config from router cache.")
 			}
 
 			return nil
@@ -836,15 +852,24 @@ func (cliCache *clientCache) initRouter(ctx context.Context) error {
 			ip := string(values[i])
 			cliCache.roleCache.Add(cacheRouterIpKey(ip), ip, cache.NoExpiration)
 			entity.SetRouterCount(true)
-		} else {
-			request_limit_cfg := &entity.RouterLimitCfg{}
+		} else if routerSplit[0] == entity.RequestLimitConfigKey {
+			request_limit_cfg := &entity.RequestLimitCfg{}
 			err := vjson.Unmarshal(values[i], request_limit_cfg)
 			if err != nil {
-				log.Error("unmarshal router limit config cache err [%s]", err.Error())
+				log.Error("unmarshal router request limit config cache err [%s]", err.Error())
 				continue
 			}
-			cliCache.mastersCache.Add("request_limit_config", request_limit_cfg, cache.NoExpiration)
+			cliCache.mastersCache.Add(entity.RequestLimitConfigKey, request_limit_cfg, cache.NoExpiration)
 			entity.SetRequestLimit(request_limit_cfg)
+		} else if routerSplit[0] == entity.MemoryLimitConfigKey {
+			memory_limit_cfg := &entity.MemoryLimitCfg{}
+			err := vjson.Unmarshal(values[i], memory_limit_cfg)
+			if err != nil {
+				log.Error("unmarshal router memory limit config cache err [%s]", err.Error())
+				continue
+			}
+			cliCache.mastersCache.Add(entity.MemoryLimitConfigKey, memory_limit_cfg, cache.NoExpiration)
+			entity.SetMemoryLimit(memory_limit_cfg, true)
 		}
 	}
 
```

**File**: `internal/client/ps.go` (modified, +2/-0)
```diff
@@ -74,6 +74,8 @@ const (
 	PartitionInfoHandler   = "PartitionInfoHandler"
 	ChangeMemberHandler    = "ChangeMemberHandler"
 	EngineCfgHandler       = "EngineCfgHandler"
+	MemoryLimitHandler     = "MemoryLimitHandler"
+	RequestCancelHandler   = "RequestCancelHandler"
 )
 
 type psClient struct {
```

**File**: `internal/client/ps_admin_service.go` (modified, +21/-0)
```diff
@@ -231,3 +231,24 @@ func ChangeMember(addr string, changeMember *entity.ChangeMember) error {
 	}
 	return nil
 }
+
+func operatePsMemLimitCfg(method, addr string, cfg *entity.MemoryLimitCfg) error {
+	bytes, e := vjson.Marshal(cfg)
+	if e != nil {
+		return e
+	}
+	args := &vearchpb.PartitionData{Data: bytes}
+	reply := new(vearchpb.PartitionData)
+	err := Execute(addr, method, args, reply)
+	if err != nil {
+		return err
+	}
+	if reply.Err.Code != vearchpb.ErrorEnum_SUCCESS {
+		return vearchpb.NewError(reply.Err.Code, nil)
+	}
+	return nil
+}
+
+func UpdateMemoryLimitCfg(addr string, cfg *entity.MemoryLimitCfg) error {
+	return operatePsMemLimitCfg(MemoryLimitHandler, addr, cfg)
+}
```

**File**: `internal/engine/c_api/api_data/raw_data.h` (modified, +5/-0)
```diff
@@ -16,12 +16,17 @@ class RawData {
   virtual int Serialize(char **out, int *out_len) = 0;
   virtual void Deserialize(const char *data, int len) = 0;
   virtual std::string RequestId() { return request_id_; }
+  virtual int ReqPartitionId() { return req_partition_id_; }
   virtual void SetRequestId(const std::string &request_id) {
     request_id_ = request_id;
   }
+  virtual void SetReqPartitionId(const int partition_id) {
+    req_partition_id_ = partition_id;
+  }
 
  protected:
   std::string request_id_;
+  int req_partition_id_;
 };
 
 }  // namespace vearch
```

---

### Incident Patch 14: `0fe45392` (2025-12-04)
**Commit Message**: hotfix:fix write out of range and check topK limit

**File**: `internal/engine/index/impl/gpu/gamma_gpu_index_base.h` (modified, +4/-3)
```diff
@@ -7,7 +7,7 @@
 
 #pragma once
 
-#include <faiss/Index.h>
+#include <faiss/gpu/impl/IndexUtils.h>
 #include <faiss/gpu/GpuClonerOptions.h>
 #include <faiss/gpu/StandardGpuResources.h>
 
@@ -199,8 +199,9 @@ class GammaGPUIndexBase : public IndexModel {
   int vectors_added_since_last_log_;
 
   // Constants
-  static constexpr int kMaxBatch = 200;
-  static constexpr int kMaxReqNum = 200;
+  static constexpr int kMaxBatch = 500;
+  static constexpr int kMaxReqNum = 500;
+  const int kMaxRecallNum = faiss::gpu::getMaxKSelection();
   static constexpr const char *kDelim = "\001";
 
  protected:
```

**File**: `internal/engine/index/impl/gpu/gamma_gpu_search_base.h` (modified, +7/-0)
```diff
@@ -26,6 +26,7 @@ class GammaGPUSearchBase : public GammaGPUIndexBase<CPUIndexType> {
   using GammaGPUIndexBase<CPUIndexType>::FilteredByRangeFilter;
   using GammaGPUIndexBase<CPUIndexType>::FilteredByTermFilter;
   using GammaGPUIndexBase<CPUIndexType>::kMaxReqNum;
+  using GammaGPUIndexBase<CPUIndexType>::kMaxRecallNum;
   using GammaGPUIndexBase<CPUIndexType>::search_queue_;
   using GammaGPUIndexBase<CPUIndexType>::gpu_threads_;
   using GammaGPUIndexBase<CPUIndexType>::d_;
@@ -73,6 +74,12 @@ class GammaGPUSearchBase : public GammaGPUIndexBase<CPUIndexType> {
     int recall_num = GetRecallNum(retrieval_params, k, enable_rerank);
     bool rerank = enable_rerank && (recall_num >= k);
 
+    if (recall_num > kMaxRecallNum) {
+      LOG(ERROR) << "topK num [" << recall_num << "] should not larger than ["
+                 << kMaxRecallNum << "]";
+      return -1;
+    }
+
     // Get nprobe
     int nprobe = GetNprobe(retrieval_params, default_nprobe, nlist);
 
```

**File**: `internal/engine/index/impl/gpu/gamma_index_ivfflat_gpu.cc` (modified, +5/-5)
```diff
@@ -43,6 +43,7 @@ namespace gpu {
 namespace {
 const int kMaxBatch = 500;   // max search batch num (optimized from 200)
 const int kMaxReqNum = 500;  // max request num (optimized from 200)
+const int kMaxRecallNum = faiss::gpu::getMaxKSelection();// max recall num
 }  // namespace
 
 REGISTER_INDEX(GPU_IVFFLAT, GammaIVFFlatGPUIndex)
@@ -300,9 +301,8 @@ bool GammaIVFFlatGPUIndex::Add(int n, const uint8_t *vec) {
 
 int GammaIVFFlatGPUIndex::GPUThread() {
   float *xx = new float[kMaxBatch * d_ * kMaxReqNum];
-  size_t max_recallnum = (size_t)faiss::gpu::getMaxKSelection();
-  long *label = new long[kMaxBatch * max_recallnum * kMaxReqNum];
-  float *dis = new float[kMaxBatch * max_recallnum * kMaxReqNum];
+  long *label = new long[kMaxBatch * kMaxRecallNum * kMaxReqNum];
+  float *dis = new float[kMaxBatch * kMaxRecallNum * kMaxReqNum];
 
   thread_local std::vector<int> batch_offsets;
   thread_local std::vector<int> result_offsets;
@@ -383,8 +383,8 @@ int GammaIVFFlatGPUIndex::GPUThread() {
         int result_offset = 0;
         for (size_t j = 0; j < nprobe_ids.second.size(); ++j) {
           int idx = nprobe_ids.second[j];
-          const size_t dis_size = recallnum * sizeof(float) * items[idx]->n_;
-          const size_t label_size = recallnum * sizeof(long) * items[idx]->n_;
+          const size_t dis_size = sizeof(float) * items[idx]->n_ * items[idx]->k_;
+          const size_t label_size = sizeof(long) * items[idx]->n_ * items[idx]->k_;
 
           std::memcpy(items[idx]->dis_, dis + result_offset, dis_size);
           std::memcpy(items[idx]->label_, label + result_offset, label_size);
```

---

### Incident Patch 15: `dc853574` (2025-12-01)
**Commit Message**: fix response handler (#855)

* fix response handler

* fix master request

---------

Co-authored-by: yanwenru1 <[REDACTED_EMAIL]>

**File**: `internal/entity/response/response.go` (modified, +3/-0)
```diff
@@ -88,6 +88,7 @@ func (r *Response) SendJsonBytes(bytes []byte) {
 	}
 }
 
+// response only called for handler which called after TimeoutMiddleware
 func (r *Response) JsonSuccess(data any) {
 	httpReply := &HttpReply{
 		Code:      int(vearchpb.ErrorEnum_SUCCESS),
@@ -100,6 +101,7 @@ func (r *Response) JsonSuccess(data any) {
 	r.SendJson()
 }
 
+// response only called for handler which called after TimeoutMiddleware
 func (r *Response) SuccessDelete() {
 	httpReply := &HttpReply{
 		Code:      int(vearchpb.ErrorEnum_SUCCESS),
@@ -111,6 +113,7 @@ func (r *Response) SuccessDelete() {
 	r.SendJson()
 }
 
+// response only called for handler which called after TimeoutMiddleware
 func (r *Response) JsonError(err *errors.ErrRequest) {
 	httpReply := &HttpReply{
 		Code:      err.Code(),
```

**File**: `internal/master/cluster_api.go` (modified, +7/-1)
```diff
@@ -161,8 +161,14 @@ func TimeoutMiddleware(defaultTimeout time.Duration) gin.HandlerFunc {
 				timeout = time.Duration(t) * time.Millisecond
 			} else {
 				msg := fmt.Sprintf("timeout[%s] param parse to int failed, err: %s", timeoutStr, err.Error())
+				err := errors.NewErrBadRequest(fmt.Errorf(msg))
 				log.Error(msg)
-				response.New(c).JsonError(errors.NewErrBadRequest(fmt.Errorf(msg)))
+				c.JSON(err.HttpCode(),
+					gin.H{
+						"request_id": c.GetHeader("X-Request-Id"),
+						"code":       err.Code(),
+						"msg":        err.Msg()})
+				//response.New(c).JsonError(errors.NewErrBadRequest(fmt.Errorf(msg)))
 				c.Abort()
 				return
 			}
```

**File**: `internal/router/document/doc_http.go` (modified, +17/-11)
```diff
@@ -162,19 +162,13 @@ func ExportDocumentHandler(httpServer *gin.Engine, client *client.Client) {
 		client:     client,
 	}
 
-	var group *gin.RouterGroup
-	var groupProxy *gin.RouterGroup
+	var group *gin.RouterGroup = documentHandler.httpServer.Group("", master.TimeoutMiddleware(defaultTimeout))
+	var groupProxy *gin.RouterGroup = documentHandler.httpServer.Group("")
 	if !config.Conf().Global.SkipAuth {
-		group = documentHandler.httpServer.Group("", BasicAuthMiddleware(documentHandler.docService))
-		// auth by master
-		groupProxy = documentHandler.httpServer.Group("")
-	} else {
-		group = documentHandler.httpServer.Group("")
-		groupProxy = documentHandler.httpServer.Group("")
+		group.Use(BasicAuthMiddleware(documentHandler.docService))
 	}
 
 	documentHandler.proxyMaster(groupProxy)
-	group.Use(master.TimeoutMiddleware(defaultTimeout))
 	// open router api
 	if err := documentHandler.ExportInterfacesToServer(group); err != nil {
 		panic(err)
@@ -261,7 +255,13 @@ func (handler *DocumentHandler) handleMasterRequest(c *gin.Context) {
 	method := c.Request.Method
 	bodyBytes, err := io.ReadAll(c.Request.Body)
 	if err != nil {
-		response.New(c).JsonError(errors.NewErrBadRequest(err))
+		res_err := errors.NewErrBadRequest(err)
+		c.JSON(res_err.HttpCode(), gin.H{
+			"code":       res_err.Code(),
+			"request_id": c.GetHeader("X-Request-Id"),
+			"msg":        res_err.Msg(),
+        })
+		//response.New(c).JsonError(errors.NewErrBadRequest(err))
 		return
 	}
 	authHeader := c.GetHeader("Authorization")
@@ -271,7 +271,13 @@ func (handler *DocumentHandler) handleMasterRequest(c *gin.Context) {
 		if string(res) != "" {
 			response.New(c).SetHttpStatus(http.StatusInternalServerError).SendJsonBytes(res)
 		} else {
-			response.New(c).JsonError(errors.NewErrInternal(err))
+			res_err := errors.NewErrInternal(err)
+			c.JSON(res_err.HttpCode(), gin.H{
+				"code":       res_err.Code(),
+				"request_id": c.GetHeader("X-Request-Id"),
+				"msg":        res_err.Msg(),
+			})
+			//response.New(c).JsonError(errors.NewErrInternal(err))
 		}
 		return
 	}
```

#### Recent Merged Pull Requests:
- **PR #886** (2026-07-27): feat(index): support by-name dynamic add/remove of scalar and vector … (@zcdb)
- **PR #885** (2026-07-21): perf: batch field reads via MultiGet and batch is_killed() checks in … (@zcdb)
- **PR #884** (2026-07-20): fix: replace busy-wait with blocking select in router search (@Anpeihang)
- **PR #883** (2026-07-19): fix: replace buggy quickSort with sort.Slice in search result merge (@Anpeihang)
- **PR #882** (2026-07-18): perf(vector index): reduce is_killed() checks on search hot path... (@zcdb)
- **PR #881** (2026-07-17): perf: skip alias reload+retry on cache miss (@zcdb)
- **PR #880** (2026-07-08): feat: SCAN fallback for composite scalar index (@zcdb)
- **PR #879** (2026-07-07): feat(flat): support RocksDB disk store and optimize FLAT search (@zcdb)

---

## 3. Empirical Evidence & Compliance Certification
- **Evidence Provenance**: Fetched directly from verified official GitHub REST API.
- **Zero Disk Footprint**: 0 bytes of unnecessary repository bloat stored locally.
- **TOS & Free-Tier Adherence**: Request pace complied with public API guidelines without fee, penalty, or unauthorized scraping.

---

## 4. Promotion & Integration Status
- **Status**: HARVESTED_DEEP_FORENSIC
- **Master Brain Sync**: Auto-committed to local/remote Master Brain repository.
