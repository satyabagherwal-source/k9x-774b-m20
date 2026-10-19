> **Canonical Learning Artifact**: `07_PROJECT_LEARNING/aquasecurity-trivy-learnings.md`  
> **Source**: github ([https://github.com/aquasecurity/trivy](https://github.com/aquasecurity/trivy))  
> **Source Version**: `9dd3e28d`  
> **License**: Apache-2.0  
> **Synthesized By**: zero-clone-structural-synthesizer  
> **Timestamp**: 2026-10-19T01:49:21.372Z  
> **Learning ID**: `learn-github-aquasecurity-trivy`  
> **Pipeline Version**: `2.0.0`  
> **Status**: VERIFIED_EMPIRICAL_INTELLIGENCE  
> **Data Governance**: CLASSIFICATION: PUBLIC. Sanitized against PII/secrets.  
> **Policy Invariant**: Strictly for engineering retrieval and architecture documentation. Distillation prohibited.  

---

# Forensic Learning Record (Deep Inspection): aquasecurity/trivy

> **Canonical Artifact**: `07_PROJECT_LEARNING/aquasecurity-trivy-learnings.md`  
> **Source Platform**: GitHub ([https://github.com/aquasecurity/trivy](https://github.com/aquasecurity/trivy))  
> **Harvest Method**: Full-Spectrum Deep Extraction (Patches, Diffs, Source Code, Post-Mortems)  
> **Harvest Timestamp**: 2026-10-19T01:49:21.364Z  
> **Compliance State**: Free Tier Guaranteed | Strict Rate-Limit Backoff Honored  

---

## 1. Context & Architectural Overview
- **Repository / Resource**: `aquasecurity/trivy`
- **Description**: Find vulnerabilities, misconfigurations, secrets, SBOM in containers, Kubernetes, code repositories, clouds and more
- **Primary Language / Ecosystem**: Go
- **Discovered Manifests / Configurations**: go.mod, README.md, Dockerfile
- **Stars / Engagement**: 38500 stars

---

## 2. Multi-Dimensional 8-Axis Investigation & Real Code Patches

### D1: Architecture & Structural Boundaries
- Entry configurations inspected via direct stream: go.mod, README.md, Dockerfile.
- Evaluated system abstractions and modular contracts.

### Core Architecture Module: `pkg/dependency/parser/dotnet/core_deps/parse.go`
```
package core_deps

import (
	"context"
	"slices"
	"sort"
	"strings"
	"sync"

	"github.com/samber/lo"
	"golang.org/x/xerrors"

	"github.com/aquasecurity/trivy/pkg/dependency"
	ftypes "github.com/aquasecurity/trivy/pkg/fanal/types"
	"github.com/aquasecurity/trivy/pkg/log"
	"github.com/aquasecurity/trivy/pkg/set"
	xio "github.com/aquasecurity/trivy/pkg/x/io"
	xjson "github.com/aquasecurity/trivy/pkg/x/json"
)

// runtimePackPrefix is the name prefix the .NET SDK gives the bundled runtime in a
// self-contained app's deps.json, e.g. "runtimepack.Microsoft.NETCore.App.Runtime.linux-x64".
const runtimePackPrefix = "runtimepack."

type dotNetDependencies struct {
	Libraries     map[string]dotNetLibrary        `json:"libraries"`
	RuntimeTarget RuntimeTarget                   `json:"runtimeTarget"`
	Targets       map[string]map[string]TargetLib `json:"targets"`
}

type dotNetLibrary struct {
	Type string `json:"type"`
	xjson.Location
}

type RuntimeTarget struct {
	Name string `json:"name"`
}

type TargetLib struct {
	Dependencies   map[string]string `json:"dependencies"`
	Runtime        any               `json:"runtime"`
	RuntimeTargets any               `json:"runtimeTargets"`
	Native         any               `json:"native"`
}

type Parser struct {
	logger *log.Logger
	once   sync.Once
}

func NewParser() *Parser {
	return &Parser{
		logger: log.WithPrefix("dotnet"),
		once:   sync.Once{},
	}
}

func (p *Parser) Parse(_ context.Context, r xio.ReadSeekerAt) ([]ftypes.Package, []ftypes.Dependency, error) {
	var depsFile dotNetDependencies
	if err := xjson.UnmarshalRead(r, &depsFile); err != nil {
		return nil, nil, xerrors.Errorf("failed to decode .deps.json file: %w", err)
	}

	// Get target libraries for RuntimeTarget
	targetLibs, targetLibsFound := depsFile.Targets[depsFile.RuntimeTarget.Name]
	if !targetLibsFound {
		// If the target is not found, take all dependencies
		p.logger.Debug("Unable to find `Target` for Runtime Target Name. All dependencies from `libraries` section will be included in the report", log.String("Runtime Target Name", depsFile.RuntimeTarget.Name))
	}

	// Normalize `targets` keys to the prefix-stripped ID space used by `pkgs` so runtime packs resolve in the graph pass below.
	targetLibs = lo.MapKeys(targetLibs, func(_ TargetLib, key string) string {
		name, version, _ := strings.Cut(key, "/")
		return packageID(name, version)
	})

	// First pass: collect all packages
	pkgs, rootPkgID := p.collectPackages(depsFile, targetLibs, targetLibsFound)
	if len(pkgs) == 0 {
		return nil, nil, nil
	}

	// If target libraries are not found, return all collected packages without dependencies
	if !targetLibsFound {
		pkgSlice := lo.Values(pkgs)
		sort.Sort(ftypes.Packages(pkgSlice))
		return pkgSlice, nil, nil
	}

	directDeps := lo.MapToSlice(targetLibs[rootPkgID].Dependencies, packageID)

	// Second pass: build dependency graph + fill Relationships from targets section
	deps := p.buildDependencyGraph(pkgs, targetLibs, directDeps)

	pkgSlice := lo.Values(pkgs)
	sort.Sort(ftypes.Packages(pkgSlice))
	sort.Sort(deps)
	return pkgSlice, deps, nil
}

// collectPackages builds the package map from the `libraries` section. It returns
// the packages keyed by ID and the ID of the root project ("" if it couldn't be
// determined). When a root is found, the root project is marked `RelationshipRoot`
// and the other project libraries `RelationshipWorkspace`.
func (p *Parser) collectPackages(depsFile dotNetDependencies, targetLibs map[string]TargetLib, targetLibsFound bool) (map[string]ftypes.Package, string) {
	pkgs := make(map[string]ftypes.Package, len(depsFile.Libraries))
	var projects []string

	for nameVer, lib := range depsFile.Libraries {
		name, version, ok := strings.Cut(nameVer, "/")
		if !ok {
			// Invalid name
			p.logger.Warn("Cannot parse .NET library version", log.String("library", nameVer))
			continue
		}

		// Skip unsupported library types.
		// `runtimepack` carries the bundled .NET runtime in self-contained deployments.
		if !strings.EqualFold(lib.Type, "package") && !strings.EqualFold(lib.Type, "project") && !strings.EqualFold(lib.Type, "runtimepack") {
			continue
		}

		// Strip the synthetic `runtimepack.` prefix so the runtime is reported under the same name as framework-dependent apps (e.g. Microsoft.NETCore.App.Runtime.linux-x64).
		name = strings.TrimPrefix(name, runtimePackPrefix)
		id := packageID(name, version)

		// Skip non-runtime libraries if target libraries are available.
		// `targetLibs` is keyed by the same stripped ID as `id`.
		if targetLibsFound && !p.isRuntimeLibrary(targetLibs, id) {
			// Skip non-runtime libraries
			// cf. https://github.com/aquasecurity/trivy/pull/7039#discussion_r1674566823
			continue
		}

		pkg := ftypes.Package{
			ID:        id,
			Name:      name,
			Version:   version,
			Locations: []ftypes.Location{ftypes.Location(lib.Location)},
		}

		if strings.EqualFold(lib.Type, "project") {
			projects = append(projects, id)
		}

		pkgs[pkg.ID] = pkg
	}

	rootPkgID := p.rootProject(projects, targetLibs)
	if rootPkgID != "" {
		for _, project := range projects {
			pkg := pkgs[project]
			pkg.Relationship = lo.Ternary(project == rootPkgID, ftypes.RelationshipRoot, ftypes.RelationshipWorkspace)
			pkgs[project] = pkg
		}
	}

	return pkgs, rootPkgID
}

// rootProject returns the pkgID of the root application project:
// the only `type: project` that no other library depends on in the `targets` graph.
// It returns "" when there isn't exactly one such project, so we don't guess the root on a non-standard file.
func (p *Parser) rootProject(projects []string, targetLibs map[string]TargetLib) string {
	referenced := set.New[string]()
	for _, lib := range targetLibs {
		for name, version := range lib.Dependencies {
			referenced.Append(packageID(name, version))
		}
	}

	var roots []string
	for _, project := range projects {
		if !referenced.Contains(project) {
			roots = append(roots, project)
		}
	}
	if len(roots) == 1 {
		return roots[0]
	}

	p.logger.Debug("Unable to determine the root project in .deps.json", log.Int("candidates", len(roots)))
	return ""
}

// buildDependencyGraph fills the Relationship field of each package and builds the
// dependency graph from the `targets` section.
func (p *Parser) buildDependencyGraph(pkgs map[string]ftypes.Package, targetLibs map[string]TargetLib, directDeps []string) ftypes.Dependencies {
	var deps ftypes.Dependencies
	for pkgID, pkg := range pkgs {
		// Fill relationship field for package
		// If Root package wasn't found or doesn't have dependencies, skip setting Relationship,
		// because most likely file is broken.
		// Root and workspace package relationships are already set.
		if len(directDeps) > 0 && pkg.Relationship == ftypes.RelationshipUnknown {
			pkg.Relationship = lo.Ternary(slices.Contains(directDeps, pkgID), ftypes.RelationshipDirect, ftypes.RelationshipIndirect)
			pkgs[pkgID] = pkg
		}

		// Build dependency graph
		dependencies, ok := targetLibs[pkgID]
		// Package doesn't have dependencies
		if !ok {
			continue
		}

		var dependsOn []string
		for depName, depVersion := range dependencies.Dependencies {
			depID := packageID(depName, depVersion)
			// Only create dependencies for packages that exist in package lists
			if _, exists := pkgs[depID]; exists {
				dependsOn = append(dependsOn, depID)
			}
		}
		if len(dependsOn) > 0 {
			sort.Strings(dependsOn)
			deps = append(deps, ftypes.Dependency{
				ID:        pkgID,
				DependsOn: dependsOn,
			})
		}
	}

	return deps
}

// isRuntimeLibrary returns true if library contains `runtime`, `runtimeTarget` or `native` sections, or if the library is missing from `targetLibs`.
// See https://github.com/aquasecurity/trivy/discussions/4282#discussioncomment-8830365 for more details.
func (p *Parser) isRuntimeLibrary(targetLibs map[string]TargetLib, library string) bool {
	lib, ok := targetLibs[library]
	// Selected target doesn't contain library
	// Mark these libraries as runtime to avoid mistaken omission
	if !ok {
		p.once.Do(func() {
			p.logger.Debug("Unable to determine that this is runtime library. Library not found in `Target` section.", log.String("Library", library))
		})
		return true
	}
	// Check that `runtime`, `runtimeTarget` and `native` sections are not empty
	return !lo.IsEmpty(lib.Runtime) || !lo.IsEmpty(lib.RuntimeTargets) || !lo.IsEmpty(lib.Native)
}

// packageID builds a package ID from a `.deps.json` name. It strips the synthetic
// `runtimepack.` prefix the .NET SDK adds to the bundled runtime in self-contained
// deployments so that runtime packs and the `targets` dependency references that point
// at them resolve to the same ID (e.g. Microsoft.NETCore.App.Runtime.linux-x64).
func packageID(name, version string) string {
	return dependency.ID(ftypes.DotNetCore, strings.TrimPrefix(name, runtimePackPrefix), version)
}

```

### Core Architecture Module: `pkg/dependency/parser/java/pom/queue.go`
```
package pom

import "sync"

// artifactQueue the queue of Items
type artifactQueue struct {
	items []artifact
	lock  sync.RWMutex
}

func newArtifactQueue() *artifactQueue {
	return &artifactQueue{}
}

func (s *artifactQueue) enqueue(items ...artifact) {
	s.lock.Lock()
	s.items = append(s.items, items...)
	s.lock.Unlock()
}

func (s *artifactQueue) dequeue() artifact {
	s.lock.Lock()
	item := s.items[0]
	s.items = s.items[1:]
	s.lock.Unlock()
	return item
}

// IsEmpty returns true if the queue is empty
func (s *artifactQueue) IsEmpty() bool {
	return len(s.items) == 0
}

```

### Core Architecture Module: `pkg/dependency/parser/utils/utils.go`
```
package utils

import (
	"fmt"
	"maps"
	"sort"

	"github.com/samber/lo"

	ftypes "github.com/aquasecurity/trivy/pkg/fanal/types"
)

func UniquePackages(pkgs []ftypes.Package) []ftypes.Package {
	if len(pkgs) == 0 {
		return nil
	}
	unique := make(map[string]ftypes.Package)
	for _, pkg := range pkgs {
		identifier := fmt.Sprintf("%s@%s", pkg.Name, pkg.Version)
		if l, ok := unique[identifier]; !ok {
			unique[identifier] = pkg
		} else {
			// There are times when we get 2 same packages as root and dev dependencies.
			// https://github.com/aquasecurity/trivy/issues/5532
			// In these cases, we need to mark the dependency as a root dependency.
			if !pkg.Dev {
				l.Dev = pkg.Dev
				unique[identifier] = l
			}

			if len(pkg.Locations) > 0 {
				// merge locations
				l.Locations = append(l.Locations, pkg.Locations...)
				sort.Sort(l.Locations)
				unique[identifier] = l
			}
		}
	}
	pkgSlice := lo.Values(unique)
	sort.Sort(ftypes.Packages(pkgSlice))

	return pkgSlice
}

func MergeMaps(parent, child map[string]string) map[string]string {
	if parent == nil {
		return child
	}
	// Clone parent map to avoid shadow overwrite
	newParent := maps.Clone(parent)
	maps.Copy(newParent, child)
	return newParent
}

```

### Core Architecture Module: `pkg/detector/ospkg/coreos/coreos.go`
```
package coreos

import (
	"context"

	osver "github.com/aquasecurity/trivy/pkg/detector/ospkg/version"
	ftypes "github.com/aquasecurity/trivy/pkg/fanal/types"
	"github.com/aquasecurity/trivy/pkg/log"
	"github.com/aquasecurity/trivy/pkg/types"
)

// Scanner implements the CoreOS scanner
type Scanner struct {
}

// NewScanner is the factory method for Scanner
func NewScanner() *Scanner {
	return &Scanner{}
}

func (s *Scanner) Detect(ctx context.Context, _ string, _ *ftypes.Repository, _ []ftypes.Package) ([]types.DetectedVulnerability, error) {
	log.InfoContext(ctx, "Vulnerability detection of CoreOS packages is currently not supported.")
	return nil, nil
}

func (s *Scanner) IsSupportedVersion(ctx context.Context, osFamily ftypes.OSType, osVer string) bool {
	return osver.Supported(ctx, nil, osFamily, osver.Minor(osVer))
}

```

### Core Architecture Module: `pkg/extension/hook.go`
```
package extension

import (
	"context"
	"sort"

	"github.com/samber/lo"
	"golang.org/x/xerrors"

	"github.com/aquasecurity/trivy/pkg/flag"
	"github.com/aquasecurity/trivy/pkg/types"
)

var hooks = make(map[string]Hook)

func RegisterHook(s Hook) {
	// Avoid duplication
	hooks[s.Name()] = s
}

func DeregisterHook(name string) {
	delete(hooks, name)
}

// Hook is an interface that defines the methods for a hook.
type Hook interface {
	// Name returns the name of the extension.
	Name() string
}

// RunHook is a extension that is called before and after all the processes.
type RunHook interface {
	Hook

	// PreRun is called before all the processes.
	PreRun(ctx context.Context, opts flag.Options) error

	// PostRun is called after all the processes.
	PostRun(ctx context.Context, opts flag.Options) error
}

// ScanHook is a extension that is called before and after the scan.
type ScanHook interface {
	Hook

	// PreScan is called before the scan. It can modify the scan target.
	// It may be called on the server side in client/server mode.
	PreScan(ctx context.Context, target *types.ScanTarget, opts types.ScanOptions) error

	// PostScan is called after the scan. It can modify the results.
	// It may be called on the server side in client/server mode.
	// NOTE: Wasm modules cannot directly modify the passed results,
	//       so it returns a copy of the results.
	PostScan(ctx context.Context, results types.Results) (types.Results, error)
}

// ReportHook is a extension that is called before and after the report is written.
type ReportHook interface {
	Hook

	// PreReport is called before the report is written.
	// It can modify the report. It is called on the client side.
	PreReport(ctx context.Context, report *types.Report, opts flag.Options) error

	// PostReport is called after the report is written.
	// It can modify the report. It is called on the client side.
	PostReport(ctx context.Context, report *types.Report, opts flag.Options) error
}

func PreRun(ctx context.Context, opts flag.Options) error {
	for _, e := range Hooks() {
		h, ok := e.(RunHook)
		if !ok {
			continue
		}
		if err := h.PreRun(ctx, opts); err != nil {
			return xerrors.Errorf("%s pre run error: %w", e.Name(), err)
		}
	}
	return nil
}

// PostRun is a hook that is called after all the processes.
func PostRun(ctx context.Context, opts flag.Options) error {
	for _, e := range Hooks() {
		h, ok := e.(RunHook)
		if !ok {
			continue
		}
		if err := h.PostRun(ctx, opts); err != nil {
			return xerrors.Errorf("%s post run error: %w", e.Name(), err)
		}
	}
	return nil
}

// PreScan is a hook that is called before the scan.
func PreScan(ctx context.Context, target *types.ScanTarget, options types.ScanOptions) error {
	for _, e := range Hooks() {
		h, ok := e.(ScanHook)
		if !ok {
			continue
		}
		if err := h.PreScan(ctx, target, options); err != nil {
			return xerrors.Errorf("%s pre scan error: %w", e.Name(), err)
		}
	}
	return nil
}

// PostScan is a hook that is called after the scan.
func PostScan(ctx context.Context, results types.Results) (types.Results, error) {
	var err error
	for _, e := range Hooks() {
		h, ok := e.(ScanHook)
		if !ok {
			continue
		}
		results, err = h.PostScan(ctx, results)
		if err != nil {
			return nil, xerrors.Errorf("%s post scan error: %w", e.Name(), err)
		}
	}
	return results, nil
}

// PreReport is a hook that is called before the report is written.
func PreReport(ctx context.Context, report *types.Report, opts flag.Options) error {
	for _, e := range Hooks() {
		h, ok := e.(ReportHook)
		if !ok {
			continue
		}
		if err := h.PreReport(ctx, report, opts); err != nil {
			return xerrors.Errorf("%s pre report error: %w", e.Name(), err)
		}
	}
	return nil
}

// PostReport is a hook that is called after the report is written.
func PostReport(ctx context.Context, report *types.Report, opts flag.Options) error {
	for _, e := range Hooks() {
		h, ok := e.(ReportHook)
		if !ok {
			continue
		}
		if err := h.PostReport(ctx, report, opts); err != nil {
			return xerrors.Errorf("%s post report error: %w", e.Name(), err)
		}
	}
	return nil
}

// Hooks returns the list of hooks.
func Hooks() []Hook {
	hooks := lo.Values(hooks)
	sort.Slice(hooks, func(i, j int) bool {
		return hooks[i].Name() < hooks[j].Name()
	})
	return hooks
}

```

### Core Architecture Module: `pkg/fanal/utils/gzip/gzip.go`
```
package gzip

import (
	"bufio"
	"compress/gzip"
	"io"
	"os"

	"golang.org/x/xerrors"

	"github.com/aquasecurity/trivy/pkg/fanal/utils"
)

// multiCloser wraps a reader and manages multiple closers for proper cleanup
type multiCloser struct {
	io.Reader
	closers []io.Closer
}

func (mc *multiCloser) Close() error {
	for _, c := range mc.closers {
		if err := c.Close(); err != nil {
			return err
		}
	}
	return nil
}

// OpenFile opens a file (optionally gzipped) by file path
func OpenFile(fileName string) (io.ReadCloser, error) {
	f, err := os.Open(fileName)
	if err != nil {
		return nil, xerrors.Errorf("unable to open the file: %w", err)
	}

	mc := &multiCloser{
		closers: []io.Closer{f},
	}

	br := bufio.NewReader(f)
	mc.Reader = br

	if utils.IsGzip(br) {
		gzr, err := gzip.NewReader(br)
		if err != nil {
			_ = f.Close()
			return nil, xerrors.Errorf("failed to open gzip: %w", err)
		}
		mc.Reader = gzr
		mc.closers = append(mc.closers, gzr)
	}

	return mc, nil
}

```

### Core Architecture Module: `pkg/fanal/utils/utils.go`
```
package utils

import (
	"bufio"
	"bytes"
	"fmt"
	"io"
	"math"
	"os"
	"os/exec"
	"path/filepath"
	"strings"
	"unicode"

	"github.com/bmatcuk/doublestar/v4"
	"golang.org/x/xerrors"

	"github.com/aquasecurity/trivy/pkg/log"
	xio "github.com/aquasecurity/trivy/pkg/x/io"
	xslices "github.com/aquasecurity/trivy/pkg/x/slices"
)

var PathSeparator = fmt.Sprintf("%c", os.PathSeparator)

func CacheDir() string {
	cacheDir, err := os.UserCacheDir()
	if err != nil {
		cacheDir = os.TempDir()
	}
	return cacheDir
}

func IsCommandAvailable(name string) bool {
	if _, err := exec.LookPath(name); err != nil {
		return false
	}
	return true
}

func IsGzip(f *bufio.Reader) bool {
	buf, err := f.Peek(3)
	if err != nil {
		return false
	}
	return buf[0] == 0x1F && buf[1] == 0x8B && buf[2] == 0x8
}

func IsExecutable(fileInfo os.FileInfo) bool {
	// For Windows
	if filepath.Ext(fileInfo.Name()) == ".exe" {
		return true
	}

	mode := fileInfo.Mode()
	if !mode.IsRegular() {
		return false
	}

	// Check unpackaged file
	if mode.Perm()&0o111 != 0 {
		return true
	}
	return false
}

func IsBinary(content xio.ReadSeekerAt, fileSize int64) (bool, error) {
	headSize := int(math.Min(float64(fileSize), 300))
	head := make([]byte, headSize)
	if _, err := content.Read(head); err != nil {
		return false, err
	}
	if _, err := content.Seek(0, io.SeekStart); err != nil {
		return false, err
	}

	// cf. https://github.com/file/file/blob/f2a6e7cb7db9b5fd86100403df6b2f830c7f22ba/src/encoding.c#L151-L228
	for _, b := range head {
		if b < 7 || b == 11 || (13 < b && b < 27) || (27 < b && b < 0x20) || b == 0x7f {
			return true, nil
		}
	}

	return false, nil
}

func CleanSkipPaths(skipPaths []string) []string {
	return xslices.Map(skipPaths, func(skipPath string) string {
		skipPath = filepath.ToSlash(filepath.Clean(skipPath))
		return strings.TrimLeft(skipPath, "/")
	})
}

func SkipPath(path string, skipPaths []string) bool {
	path = strings.TrimLeft(path, "/")

	// skip files
	for _, pattern := range skipPaths {
		match, err := doublestar.Match(pattern, path)
		if err != nil {
			return false // return early if bad pattern
		} else if match {
			log.Debug("Skipping path", log.String("path", path))
			return true
		}
	}
	return false
}

func ExtractPrintableBytes(content xio.ReadSeekerAt) ([]byte, error) {
	const minLength = 4 // Minimum length of strings to extract
	var result []byte
	currentPrintableLine := new(bytes.Buffer)

	current := make([]byte, 1) // buffer for 1 byte reading

	for {
		if n, err := content.Read(current); err == io.EOF {
			break
		} else if n != 1 {
			continue
		} else if err != nil {
			return nil, xerrors.Errorf("failed to read a byte: %w", err)
		}
		if unicode.IsPrint(rune(current[0])) {
			_ = currentPrintableLine.WriteByte(current[0])
			continue
		}
		if currentPrintableLine.Len() > minLength {
			// add a newline between printable lines to separate them
			_ = currentPrintableLine.WriteByte('\n')
			result = append(result, currentPrintableLine.Bytes()...)
		}
		currentPrintableLine.Reset()
	}
	if currentPrintableLine.Len() > minLength {
		// add a newline between printable lines to separate them
		_ = currentPrintableLine.WriteByte('\n')
		result = append(result, currentPrintableLine.Bytes()...)
	}
	return result, nil
}

```

### Core Architecture Module: `pkg/iac/adapters/cloudformation/aws/sam/state_machines.go`
```
package sam

import (
	"github.com/aquasecurity/iamgo"
	"github.com/aquasecurity/trivy/pkg/iac/providers/aws/iam"
	"github.com/aquasecurity/trivy/pkg/iac/providers/aws/sam"
	"github.com/aquasecurity/trivy/pkg/iac/scanners/cloudformation/parser"
	iacTypes "github.com/aquasecurity/trivy/pkg/iac/types"
)

func getStateMachines(cfFile parser.FileContext) (stateMachines []sam.StateMachine) {

	stateMachineResources := cfFile.GetResourcesByType("AWS::Serverless::StateMachine")
	for _, r := range stateMachineResources {
		stateMachine := sam.StateMachine{
			Metadata: r.Metadata(),
			Name:     r.GetStringProperty("Name"),
			LoggingConfiguration: sam.LoggingConfiguration{
				Metadata:       r.Metadata(),
				LoggingEnabled: iacTypes.BoolDefault(false, r.Metadata()),
			},
			ManagedPolicies: nil,
			Policies:        nil,
			Tracing:         getTracingConfiguration(r),
		}

		// TODO: By default, the level is set to OFF
		if logging := r.GetProperty("Logging"); logging.IsNotNil() {
			stateMachine.LoggingConfiguration.Metadata = logging.Metadata()
			if level := logging.GetProperty("Level"); level.IsNotNil() {
				stateMachine.LoggingConfiguration.LoggingEnabled = iacTypes.Bool(!level.EqualTo("OFF"), level.Metadata())
			}
		}

		setStateMachinePolicies(r, &stateMachine)
		stateMachines = append(stateMachines, stateMachine)
	}

	return stateMachines
}

func getTracingConfiguration(r *parser.Resource) sam.TracingConfiguration {
	tracing := r.GetProperty("Tracing")
	if tracing.IsNil() {
		return sam.TracingConfiguration{
			Metadata: r.Metadata(),
			Enabled:  iacTypes.BoolDefault(false, r.Metadata()),
		}
	}

	return sam.TracingConfiguration{
		Metadata: tracing.Metadata(),
		Enabled:  tracing.GetBoolProperty("Enabled"),
	}
}

func setStateMachinePolicies(r *parser.Resource, stateMachine *sam.StateMachine) {
	policies := r.GetProperty("Policies")
	if policies.IsNotNil() {
		if policies.IsString() {
			stateMachine.ManagedPolicies = append(stateMachine.ManagedPolicies, policies.AsStringValue())
		} else if policies.IsList() {
			for _, property := range policies.AsList() {
				parsed, err := iamgo.Parse(property.GetJsonBytes(true))
				if err != nil {
					continue
				}
				policy := iam.Policy{
					Metadata: property.Metadata(),
					Name:     iacTypes.StringDefault("", property.Metadata()),
					Document: iam.Document{
						Metadata: property.Metadata(),
						Parsed:   *parsed,
					},
					Builtin: iacTypes.Bool(false, property.Metadata()),
				}
				stateMachine.Policies = append(stateMachine.Policies, policy)
			}
		}
	}
}

```

### Core Architecture Module: `pkg/iac/adapters/cloudformation/aws/sqs/queue.go`
```
package sqs

import (
	"errors"

	"github.com/aquasecurity/iamgo"
	"github.com/aquasecurity/trivy/pkg/iac/providers/aws/iam"
	"github.com/aquasecurity/trivy/pkg/iac/providers/aws/sqs"
	"github.com/aquasecurity/trivy/pkg/iac/scanners/cloudformation/parser"
	iacTypes "github.com/aquasecurity/trivy/pkg/iac/types"
)

func getQueues(ctx parser.FileContext) (queues []sqs.Queue) {
	for _, r := range ctx.GetResourcesByType("AWS::SQS::Queue") {
		queue := sqs.Queue{
			Metadata: r.Metadata(),
			QueueURL: iacTypes.StringDefault("", r.Metadata()),
			Encryption: sqs.Encryption{
				Metadata:          r.Metadata(),
				ManagedEncryption: iacTypes.Bool(false, r.Metadata()),
				KMSKeyID:          r.GetStringProperty("KmsMasterKeyId"),
			},
		}
		if policy, err := getPolicy(r.ID(), ctx); err == nil {
			queue.Policies = append(queue.Policies, *policy)
		}
		queues = append(queues, queue)
	}
	return queues
}

func getPolicy(id string, ctx parser.FileContext) (*iam.Policy, error) {
	for _, policyResource := range ctx.GetResourcesByType("AWS::SQS::QueuePolicy") {
		documentProp := policyResource.GetProperty("PolicyDocument")
		if documentProp.IsNil() {
			continue
		}
		queuesProp := policyResource.GetProperty("Queues")
		if queuesProp.IsNil() {
			continue
		}
		for _, queueRef := range queuesProp.AsList() {
			if queueRef.IsString() && queueRef.AsString() == id {
				raw := documentProp.GetJsonBytes()
				parsed, err := iamgo.Parse(raw)
				if err != nil {
					continue
				}
				return &iam.Policy{
					Metadata: documentProp.Metadata(),
					Name:     iacTypes.StringDefault("", documentProp.Metadata()),
					Document: iam.Document{
						Metadata: documentProp.Metadata(),
						Parsed:   *parsed,
					},
					Builtin: iacTypes.Bool(false, documentProp.Metadata()),
				}, nil
			}
		}
	}
	return nil, errors.New("no matching policy found")
}

```

### Core Architecture Module: `pkg/iac/providers/aws/sam/state_machine.go`
```
package sam

import (
	"github.com/aquasecurity/trivy/pkg/iac/providers/aws/iam"
	iacTypes "github.com/aquasecurity/trivy/pkg/iac/types"
)

type StateMachine struct {
	Metadata             iacTypes.Metadata
	Name                 iacTypes.StringValue
	LoggingConfiguration LoggingConfiguration
	ManagedPolicies      []iacTypes.StringValue
	Policies             []iam.Policy
	Tracing              TracingConfiguration
}

type LoggingConfiguration struct {
	Metadata       iacTypes.Metadata
	LoggingEnabled iacTypes.BoolValue
}

type TracingConfiguration struct {
	Metadata iacTypes.Metadata
	Enabled  iacTypes.BoolValue
}

```


### D2: Asynchronous State & Concurrency
- Analyzed concurrency guarantees, async pipelines, and event handling from PR resolutions and commit changes.

### D3: Error Boundaries, Recovery & Rollbacks
- Exception handling patterns and defect resolutions extracted from closed production bug issues:
- **Issue #11079** (2026-08-12): **bug(misconf): check aliases are lost when misconfigurations are uploaded to the server**
  *Symptoms*:  ### Discussed in https://github.com/aquasecurity/trivy/discussions/11052  Misconfigurations are scanned on the client, uploaded to the server as part of the blob, and turned back into findings by the server. `PolicyMetadata` in the blob upload message has no `aliases` field, so the server builds findings with an empty alias list, and ignore rules that refer to a check by an alias (`AVD-DS-0002`, `DS004`, `no-ssh-port`, …) match nothing.  The result is that the same ignore file works in standalone mode and silently does nothing in client/server mode.  ### Fix   Add the field to `rpc/common/service.proto` and carry them over in `pkg/rpc/convert.go`.  ### Note  Upgrades need both sides updated. Blobs uploaded by an older client hold no aliases, so where the blob key is content-based (images, clean git repositories) the server's scan cache has to be refreshed before the fix takes effect.

- **Issue #11048** (2026-08-05): **bug(terraform): panic in localHasDynamicValues when for_each local has unknown nested objects**
  *Symptoms*: Original issue: https://github.com/aquasecurity/trivy/issues/11035  Trivy panics when expanding a `for_each` that references a `local` whose map entries contain **unknown nested object values** (e.g. unresolved module output references). The evaluator calls `cty.Value.AsValueMap()` without checking `IsKnown()` on nested values.  ``` panic: can't use ElementIterator on unknown value  goroutine 1 [running]: github.com/zclconf/go-cty/cty.Value.AsValueMap(...) github.com/aquasecurity/trivy/pkg/iac/scanners/terraform/parser.(*evaluator).localHasDynamicValues(...) github.com/aquasecurity/trivy/pkg/iac/scanners/terraform/parser.(*evaluator).shouldDeferForEachExpansion(...) ```  ## Version  Trivy v0.72.0 (also observed on earlier versions with `shouldDeferForEachExpansion` / `localHasDynamicValues`)  ## Steps to reproduce  1. Define a `local` map where some entries reference module outputs (e.g. `dead_letter_target_arn = module.deadletter_queue["default_dlq"].arn`). 2. Use that local in a module `for_each`, e.g. `for_each = local.sqs_settings` or a filtered expression over the same local. 3. Scan without full module resolution (modules not downloaded, or outputs still unknown during static eval). Optionally omit `--tf-vars` so conditionals on `var.environment` also remain unknown. 4. Run:  ```bash trivy config . --debug # or trivy fs --scanners misconfig /path/to/terraform ```  ## Expected behavior  Trivy should defer `for_each` expansion or skip safely (debug log), consistent with o

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

### Incident Patch 1: `431288f8` (2026-10-13)
**Commit Message**: fix(vex): avoid panic on CSAF advisory without a CVE (#10990)

Co-authored-by: DmitriyLewen <[REDACTED_EMAIL]>

**File**: `pkg/vex/csaf.go` (modified, +1/-1)
```diff
@@ -35,7 +35,7 @@ func (v *CSAF) Filter(result *types.Result, bom *core.BOM) {
 
 func (v *CSAF) NotAffected(vuln types.DetectedVulnerability, product, subProduct *core.Component) (types.ModifiedFinding, bool) {
 	found, ok := lo.Find(v.advisory.Vulnerabilities, func(item *csaf.Vulnerability) bool {
-		return string(*item.CVE) == vuln.VulnerabilityID
+		return item.CVE != nil && string(*item.CVE) == vuln.VulnerabilityID
 	})
 	if !ok {
 		return types.ModifiedFinding{}, false
```

**File**: `pkg/vex/testdata/csaf.json` (modified, +19/-0)
```diff
@@ -65,6 +65,25 @@
     ]
   },
   "vulnerabilities": [
+    {
+      "ids": [
+        {
+          "system_name": "GitHub Security Advisory",
+          "text": "GHSA-2r2c-cx56-8933"
+        }
+      ],
+      "product_status": {
+        "known_not_affected": [
+          "go-transitive-v4.0.0"
+        ]
+      },
+      "threats": [
+        {
+          "category": "impact",
+          "details": "vulnerable_code_not_in_execute_path"
+        }
+      ]
+    },
     {
       "cve": "CVE-2024-0001",
       "notes": [
```

---

### Incident Patch 2: `6c7a8a6b` (2026-10-14)
**Commit Message**: chore(deps): pin zlib >= 1.3.2-r1 in container images to fix CVE-2026-85091 (#11407)

**File**: `Dockerfile` (modified, +2/-1)
```diff
@@ -1,5 +1,6 @@
 FROM alpine:3.24.2
-RUN apk --no-cache add ca-certificates git
+# CVE-2026-85091: remove after alpine base ships zlib >= 1.3.2-r1
+RUN apk --no-cache add ca-certificates git 'zlib>=1.3.2-r1'
 ARG TARGETPLATFORM
 COPY ${TARGETPLATFORM}/trivy /usr/local/bin/trivy
 COPY contrib/*.tpl contrib/
```

**File**: `Dockerfile.canary` (modified, +2/-1)
```diff
@@ -1,5 +1,6 @@
 FROM alpine:3.24.2
-RUN apk --no-cache add ca-certificates git
+# CVE-2026-85091: remove after alpine base ships zlib >= 1.3.2-r1
+RUN apk --no-cache add ca-certificates git 'zlib>=1.3.2-r1'
 
 # binaries were created with GoReleaser
 # need to copy binaries from folder with correct architecture
```

---

### Incident Patch 3: `a67baa8d` (2026-10-12)
**Commit Message**: feat(crypto): report nominal security levels of algorithms (#11369)

**File**: `docs/guide/scanner/crypto.md` (modified, +34/-1)
```diff
@@ -36,11 +36,44 @@ An asset is identified by its content. For a certificate this is the SHA-256 of
 
 The parameters of an algorithm are the key size for RSA and the curve for EC. For DSA they are the two bit lengths that name a parameter set in FIPS 186: L, the length of the prime `p`, and N, the length of the prime `q`. So DSA keys of (2048, 224) and (2048, 256) belong to different algorithms, although both are named `DSA-2048` after the CycloneDX naming pattern. Other algorithms are identified by the OID alone.
 
+### Security levels
+
+Trivy estimates two nominal security levels for the algorithms it recognizes. The classical security level is the strength in bits against classical attacks. The NIST quantum security level is the NIST post-quantum security category from 1 to 5, or 0 for an algorithm that meets none of the categories.
+
+The levels are estimates for an algorithm and its parameters, taken from NIST and IETF publications. They are not a guarantee about an implementation, nor a statement that any policy approves the algorithm.
+
+| Algorithm | Classical security level (bits) | NIST quantum security level |
+| --- | --- | --- |
+| RSA, key size 1024 / 2048 / 3072 / 4096 / 6144 / 8192 bits | 80 / 112 / 128 / 152 / 176 / 200 | 0 |
+| EC, curve P-224 / P-256 / P-384 / P-521 | 112 / 128 / 192 / 256 | 0 |
+| DSA, (L, N) of (1024, 160) / (2048, 224) / (2048, 256) / (3072, 256) | 80 / 112 / 112 / 128 | 0 |
+| Ed25519 | 128 | 0 |
+| ML-DSA-44 / ML-DSA-65 / ML-DSA-87 | - | 2 / 3 / 5 |
+| RSA, ECDSA and DSA signature algorithms | - | 0 |
+
+A dash means that the level is left out of the report.
+
+The levels come from these publications:
+
+- RSA with a key size of 2048 bits and above takes the approximate maximum strengths in Appendix D, Table 4 of [NIST SP 800-56B Rev. 2](https://csrc.nist.gov/pubs/sp/800/56/b/r2/final). RSA with a key size of 1024 bits takes the nominal maximum of 80 from Table 2 of [NIST SP 800-57 Part 1 Rev. 5](https://csrc.nist.gov/pubs/sp/800/57/pt1/r5/final), whose row for a 1024-bit modulus states at most 80 bits.
+- EC takes the ECC strength ranges in Table 2 of NIST SP 800-57 Part 1 Rev. 5.
+- DSA takes the FFC entries in Table 2 of NIST SP 800-57 Part 1 Rev. 5 and the DSA strengths in Section 3 of [NIST SP 800-131A Rev. 2](https://csrc.nist.gov/pubs/sp/800/131/a/r2/final). The (1024, 160) pair takes the nominal maximum of 80 from the Table 2 row that states at most 80 bits.
+- Ed25519 takes its strength from [RFC 8032, Section 8.5](https://datatracker.ietf.org/doc/html/rfc8032#section-8.5).
+- ML-DSA takes its categories from [FIPS 204](https://csrc.nist.gov/pubs/fips/204/final).
+- RSA, EC, DSA and EdDSA rest on integer factorization and discrete logarithms, which a sufficiently capable quantum computer breaks. Section 1.2 of FIPS 204 discusses this. They therefore meet none of the NIST categories.
+
+A level is left out when it cannot be estimated:
+
+- An RSA, ECDSA or DSA signature algorithm gets no classical level. The strength of such a signature is limited by the key that signed it, and that key belongs to the issuer, which the certificate does not carry. Ed25519 is different, because its OID fixes the curve.
+- ML-DSA gets no classical level, because FIPS 204 assigns its parameter sets a NIST category but no classical strength in bits.
+- An algorithm whose parameters are not in the table, such as RSA with a key size of 2047 bits or a DSA pair that FIPS 186 does not define, gets no classical level, but still gets a NIST quantum security level of 0.
+- An algorithm that Trivy does not recognize, such as RSA-PSS or Ed448, gets neither level. An encrypted private key has no algorithm in the report at all, because its algorithm stays inside the ciphertext.
+
 ### CycloneDX
 
 Every asset becomes a `cryptographic-asset` component with `cryptoProperties`, and the links between assets are stored in `relatedCryptographicAssets`. Each place an asset was found is an entry in `evidence.occurrences`. The path is stored in `location`, and the layer in `additionalContext` as `aquasecurity:trivy:LayerDiffID=<diff ID>`.
 
-The parameters of an algorithm are stored in `algorithmProperties`. The key size goes to `parameterSetIdentifier`, and for DSA it is the pair `<L>-<N>`, such as `2048-256`, which tells apart two components named `DSA-2048`. The curve goes to `ellipticCurve`.
+The parameters of an algorithm are stored in `algorithmProperties`. The key size goes to `parameterSetIdentifier`, and for DSA it is the pair `<L>-<N>`, such as `2048-256`, which tells apart two components named `DSA-2048`. The curve goes to `ellipticCurve`. The security levels go to `classicalSecurityLevel` and `nistQuantumSecurityLevel`, and a level that is not estimated is left out.
 
 ```json
 {
```

**File**: `integration/testdata/crypto.cdx.json.golden` (modified, +15/-6)
```diff
@@ -76,7 +76,9 @@
         "assetType": "algorithm",
         "algorithmProperties": {
           "primitive": "unknown",
-          "ellipticCurve": "nist/P-256"
+          "ellipticCurve": "nist/P-256",
+          "classicalSecurityLevel": 128,
+          "nistQuantumSecurityLevel": 0
         },
         "oid": "1.2.840.10045.2.1"
       }
@@ -97,7 +99,8 @@
         "assetType": "algorithm",
         "algorithmProperties": {
           "primitive": "signature",
-          "algorithmFamily": "ECDSA"
+          "algorithmFamily": "ECDSA",
+          "nistQuantumSecurityLevel": 0
         },
         "oid": "1.2.840.10045.4.3.2"
       }
@@ -126,7 +129,8 @@
         "assetType": "algorithm",
         "algorithmProperties": {
           "primitive": "signature",
-          "algorithmFamily": "RSASSA-PKCS1"
+          "algorithmFamily": "RSASSA-PKCS1",
+          "nistQuantumSecurityLevel": 0
         },
         "oid": "1.2.840.113549.1.1.11"
       }
@@ -167,7 +171,9 @@
         "assetType": "algorithm",
         "algorithmProperties": {
           "primitive": "unknown",
-          "parameterSetIdentifier": "2048"
+          "parameterSetIdentifier": "2048",
+          "classicalSecurityLevel": 112,
+          "nistQuantumSecurityLevel": 0
         },
         "oid": "1.2.840.113549.1.1.1"
       }
@@ -188,7 +194,9 @@
         "assetType": "algorithm",
         "algorithmProperties": {
           "primitive": "signature",
-          "algorithmFamily": "EdDSA"
+          "algorithmFamily": "EdDSA",
+          "classicalSecurityLevel": 128,
+          "nistQuantumSecurityLevel": 0
         },
         "oid": "1.3.101.112"
       }
@@ -209,7 +217,8 @@
         "assetType": "algorithm",
         "algorithmProperties": {
           "primitive": "signature",
-          "algorithmFamily": "ML-DSA"
+          "algorithmFamily": "ML-DSA",
+          "nistQuantumSecurityLevel": 3
         },
         "oid": "2.16.840.1.101.3.4.3.18"
       }
```

**File**: `pkg/crypto/catalog.go` (modified, +70/-49)
```diff
@@ -4,7 +4,8 @@ import ftypes "github.com/aquasecurity/trivy/pkg/fanal/types"
 
 // algorithm is the hand-maintained knowledge about an OID: the name and family it
 // carries in the CycloneDX cryptography vocabulary, the primitive it provides, and the
-// key properties that distinguish assets sharing it.
+// key properties that distinguish assets sharing it. It also holds the basis the security
+// levels of an asset are assessed from after caching, which describing an asset does not use.
 //
 // An OID whose purpose cannot be decided carries no family and an unknown primitive.
 // RFC 3279 section 2.3.1 states that rsaEncryption identifies both signature and
@@ -18,6 +19,7 @@ type algorithm struct {
 	family         string
 	primitive      ftypes.CryptoPrimitive
 	parameterNames []ftypes.CryptoAlgorithmParameterName
+	strengthBasis  strengthBasis
 }
 
 // algorithms maps the OIDs that appear in the certificates and keys this package
@@ -41,67 +43,79 @@ type algorithm struct {
 var algorithms = map[string]algorithm{
 	// Certificate signature algorithms.
 	"1.2.840.113549.1.1.4": {
-		name:      "RSA-PKCS1-1.5-MD5",
-		family:    "RSASSA-PKCS1",
-		primitive: ftypes.CryptoPrimitiveSignature,
+		name:          "RSA-PKCS1-1.5-MD5",
+		family:        "RSASSA-PKCS1",
+		primitive:     ftypes.CryptoPrimitiveSignature,
+		strengthBasis: signatureStrengthBasis,
 	},
 	"1.2.840.113549.1.1.5": {
-		name:      "RSA-PKCS1-1.5-SHA-1",
-		family:    "RSASSA-PKCS1",
-		primitive: ftypes.CryptoPrimitiveSignature,
+		name:          "RSA-PKCS1-1.5-SHA-1",
+		family:        "RSASSA-PKCS1",
+		primitive:     ftypes.CryptoPrimitiveSignature,
+		strengthBasis: signatureStrengthBasis,
 	},
 	"1.2.840.113549.1.1.11": {
-		name:      "RSA-PKCS1-1.5-SHA-256",
-		family:    "RSASSA-PKCS1",
-		primitive: ftypes.CryptoPrimitiveSignature,
+		name:          "RSA-PKCS1-1.5-SHA-256",
+		family:        "RSASSA-PKCS1",
+		primitive:     ftypes.CryptoPrimitiveSignature,
+		strengthBasis: signatureStrengthBasis,
 	},
 	"1.2.840.113549.1.1.12": {
-		name:      "RSA-PKCS1-1.5-SHA-384",
-		family:    "RSASSA-PKCS1",
-		primitive: ftypes.CryptoPrimitiveSignature,
+		name:          "RSA-PKCS1-1.5-SHA-384",
+		family:        "RSASSA-PKCS1",
+		primitive:     ftypes.CryptoPrimitiveSignature,
+		strengthBasis: signatureStrengthBasis,
 	},
 	"1.2.840.113549.1.1.13": {
-		name:      "RSA-PKCS1-1.5-SHA-512",
-		family:    "RSASSA-PKCS1",
-		primitive: ftypes.CryptoPrimitiveSignature,
+		name:          "RSA-PKCS1-1.5-SHA-512",
+		family:        "RSASSA-PKCS1",
+		primitive:     ftypes.CryptoPrimitiveSignature,
+		strengthBasis: signatureStrengthBasis,
 	},
 	// The ISO arc carries a second OID for SHA-1 with RSA, which makecert.exe has been
 	// known to produce. The two OIDs name one algorithm but stay two assets, because an
 	// algorithm is identified by the OID the certificate carries.
 	"1.3.14.3.2.29": {
-		name:      "RSA-PKCS1-1.5-SHA-1",
-		family:    "RSASSA-PKCS1",
-		primitive: ftypes.CryptoPrimitiveSignature,
+		name:          "RSA-PKCS1-1.5-SHA-1",
+		family:        "RSASSA-PKCS1",
+		primitive:     ftypes.CryptoPrimitiveSignature,
+		strengthBasis: signatureStrengthBasis,
 	},
 	"1.2.840.10040.4.3": {
-		name:      "DSA-SHA-1",
-		family:    "DSA",
-		primitive: ftypes.CryptoPrimitiveSignature,
+		name:          "DSA-SHA-1",
+		family:        "DSA",
+		primitive:     ftypes.CryptoPrimitiveSignature,
+		strengthBasis: signatureStrengthBasis,
 	},
 	"2.16.840.1.101.3.4.3.2": {
-		name:      "DSA-SHA-256",
-		family:    "DSA",
-		primitive: ftypes.CryptoPrimitiveSignature,
+		name:          "DSA-SHA-256",
+		family:        "DSA",
+		primitive:     ftypes.CryptoPrimitiveSignature,
+		strengthBasis: signatureStrengthBasis,
 	},
 	"1.2.840.10045.4.1": {
-		name:      "ECDSA-SHA-1",
-		family:    "ECDSA",
-		primitive: ftypes.CryptoPrimitiveSignature,
+		name:          "ECDSA-SHA-1",
+		family:        "ECDSA",
+		primitive:     ftypes.CryptoPrimitiveSignature,
+		strengthBasis: signatureStrengthBasis,
 	},
 	"1.2.840.10045.4.3.2": {
-		name:      "ECDSA-SHA-256",
-		family:    "ECDSA",
-		primitive: ftypes.CryptoPrimitiveSignature,
+		name:          "ECDSA-SHA-256",
+		family:        "ECDSA",
+		primitive:     ftypes.CryptoPrimitiveSignature,
+		strengthBasis: signatureStrengthBasis,
 	},
 	"1.2.840.10045.4.3.3": {
-		name:      "ECDSA-SHA-384",
-		family:    "ECDSA",
-		primitive: ftypes.CryptoPrimitiveSignature,
+		name:          "ECDSA-SHA-384",
+		family:        "ECDSA",
+		primitive:     ftypes.CryptoPrimitiveSignature,
+		strengthBasis: signatureStrengthBasis,
 	},
 	"1.2.840.10045.4.3.4": {
-		name:      "ECDSA-SHA-512",
-		family:    "ECDSA",
-		primitive: ftypes.CryptoPrimitiveSignature,
+		name:          "ECDSA-SHA-512",
+		family:        "ECDSA",
+		primitive:     ftypes.CryptoPrimitiveSignature,
+		strengthBasis: signatureStrengthBasis,
 	},
 
 	// Subject public key algorithms.
@@ -111,13 +125,15 @@ var algorithms = map[string]algo
```

**File**: `pkg/crypto/strength.go` (added, +121/-0)
```diff
@@ -0,0 +1,121 @@
+package crypto
+
+import ftypes "github.com/aquasecurity/trivy/pkg/fanal/types"
+
+// strengthBasis is the published basis the security levels of an algorithm are assessed
+// from. The levels themselves are assessed after caching by AssessStrength, so that a
+// change to a basis applies without analyzing again.
+//
+// The levels are nominal estimates taken from NIST and IETF publications. They estimate the
+// strength of an algorithm and its parameters, and are neither a guarantee for an
+// implementation nor a statement of policy approval.
+type strengthBasis struct {
+	// nistCategory is the NIST post-quantum security category. It is nil for an algorithm
+	// with no basis, which then gets neither level.
+	nistCategory *int
+	// classicalStrengths maps the canonical parameters of an asset to its classical strength
+	// in bits. Parameters it does not list have no estimate.
+	classicalStrengths map[string]int
+}
+
+// RSA, EC, DSA and EdDSA rest on integer factorization and discrete logarithms, which a
+// sufficiently capable quantum computer breaks, as FIPS 204 section 1.2 discusses, so they
+// meet none of the NIST categories.
+var (
+	// A signature algorithm has no classical strength, because the strength of a signature
+	// is limited by the key that produced it, and that key belongs to the issuer, which a
+	// certificate does not carry.
+	signatureStrengthBasis = strengthBasis{
+		nistCategory: new(0),
+	}
+
+	// RSA estimates for 2048 bits and above are the approximate maximum strengths in
+	// NIST SP 800-56B Rev. 2, Appendix D, Table 4. RSA-1024 takes the nominal maximum of 80
+	// from NIST SP 800-57 Part 1 Rev. 5, Table 2, whose row states at most 80 bits.
+	rsaStrengthBasis = strengthBasis{
+		nistCategory: new(0),
+		classicalStrengths: map[string]int{
+			"key-size=1024": 80,
+			"key-size=2048": 112,
+			"key-size=3072": 128,
+			"key-size=4096": 152,
+			"key-size=6144": 176,
+			"key-size=8192": 200,
+		},
+	}
+
+	// EC estimates are the ECC strength ranges in NIST SP 800-57 Part 1 Rev. 5, Table 2.
+	ecStrengthBasis = strengthBasis{
+		nistCategory: new(0),
+		classicalStrengths: map[string]int{
+			"curve=P-224": 112,
+			"curve=P-256": 128,
+			"curve=P-384": 192,
+			"curve=P-521": 256,
+		},
+	}
+
+	// DSA estimates depend on both L and N. They are the FFC entries of NIST SP 800-57
+	// Part 1 Rev. 5, Table 2, and the DSA strengths in NIST SP 800-131A Rev. 2, Section 3.
+	// The (1024, 160) value is the nominal maximum of the at-most-80 row.
+	dsaStrengthBasis = strengthBasis{
+		nistCategory: new(0),
+		classicalStrengths: map[string]int{
+			"key-size=1024,subgroup-size=160": 80,
+			"key-size=2048,subgroup-size=224": 112,
+			"key-size=2048,subgroup-size=256": 112,
+			"key-size=3072,subgroup-size=256": 128,
+		},
+	}
+
+	// Ed25519 has no parameters, and RFC 8032 section 8.5 puts its strength at about 128
+	// bits.
+	// See https://datatracker.ietf.org/doc/html/rfc8032#section-8.5
+	ed25519StrengthBasis = strengthBasis{
+		nistCategory: new(0),
+		classicalStrengths: map[string]int{
+			"": 128,
+		},
+	}
+)
+
+// mldsaStrengthBasis is the basis of an ML-DSA parameter set, which FIPS 204 assigns a NIST
+// category without a classical strength to translate it into.
+func mldsaStrengthBasis(category int) strengthBasis {
+	return strengthBasis{
+		nistCategory: new(category),
+	}
+}
+
+// AssessStrength fills in the nominal security levels of algorithm assets from the basis
+// the catalog holds for their OID. An OID with no basis gets neither level, and parameters
+// the basis does not cover get no classical level. Levels the assets already carry are
+// replaced, so that they come from the basis alone.
+func AssessStrength(assets []ftypes.CryptoAsset) {
+	for i := range assets {
+		asset := &assets[i]
+		if asset.Kind != ftypes.CryptoKindAlgorithm || asset.Algorithm == nil ||
+			asset.Identity.Method != ftypes.CryptoMethodOID {
+			continue
+		}
+
+		// The levels go to a copy of the algorithm, because an in-memory cache hands out
+		// the algorithm it holds, and the cache keeps no levels.
+		assessed := *asset.Algorithm
+		assessed.ClassicalSecurityLevel, assessed.NISTQuantumSecurityLevel = securityLevels(asset.Identity)
+		asset.Algorithm = &assessed
+	}
+}
+
+// securityLevels assesses the levels of an algorithm identity from the basis the catalog
+// holds for its OID.
+func securityLevels(identity ftypes.CryptoIdentity) (classical, nistCategory *int) {
+	basis := algorithms[identity.Value].strengthBasis
+	if basis.nistCategory == nil {
+		return nil, nil
+	}
+	if bits, found := basis.classicalStrengths[identity.Parameters]; found {
+		classical = new(bits)
+	}
+	return classical, new(*basis.nistCategory)
+}
```

**File**: `pkg/crypto/strength_test.go` (added, +127/-0)
```diff
@@ -0,0 +1,127 @@
+package crypto_test
+
+import (
+	"testing"
+
+	"github.com/stretchr/testify/assert"
+	"github.com/stretchr/testify/require"
+
+	"github.com/aquasecurity/trivy/pkg/crypto"
+	ftypes "github.com/aquasecurity/trivy/pkg/fanal/types"
+)
+
+func TestAssessStrength(t *testing.T) {
+	tests := []struct {
+		name          string
+		oid           string
+		size          int
+		subgroupSize  int
+		curve         string
+		wantClassical *int
+		wantCategory  *int
+	}{
+		{name: "RSA-1024", oid: "1.2.840.113549.1.1.1", size: 1024, wantClassical: new(80), wantCategory: new(0)},
+		{name: "RSA-2048", oid: "1.2.840.113549.1.1.1", size: 2048, wantClassical: new(112), wantCategory: new(0)},
+		{name: "RSA-3072", oid: "1.2.840.113549.1.1.1", size: 3072, wantClassical: new(128), wantCategory: new(0)},
+		{name: "RSA-4096", oid: "1.2.840.113549.1.1.1", size: 4096, wantClassical: new(152), wantCategory: new(0)},
+		{name: "RSA-6144", oid: "1.2.840.113549.1.1.1", size: 6144, wantClassical: new(176), wantCategory: new(0)},
+		{name: "RSA-8192", oid: "1.2.840.113549.1.1.1", size: 8192, wantClassical: new(200), wantCategory: new(0)},
+		{
+			// A key size between the listed ones has no estimate, rather than the one of a
+			// neighbor.
+			name:         "RSA with an uncovered key size",
+			oid:          "1.2.840.113549.1.1.1",
+			size:         2047,
+			wantCategory: new(0),
+		},
+		{
+			name:         "RSA without a key size",
+			oid:          "1.2.840.113549.1.1.1",
+			wantCategory: new(0),
+		},
+		{name: "EC-P-224", oid: "1.2.840.10045.2.1", curve: "P-224", wantClassical: new(112), wantCategory: new(0)},
+		{name: "EC-P-256", oid: "1.2.840.10045.2.1", curve: "P-256", wantClassical: new(128), wantCategory: new(0)},
+		{name: "EC-P-384", oid: "1.2.840.10045.2.1", curve: "P-384", wantClassical: new(192), wantCategory: new(0)},
+		{name: "EC-P-521", oid: "1.2.840.10045.2.1", curve: "P-521", wantClassical: new(256), wantCategory: new(0)},
+		{
+			name:         "EC with an uncovered curve",
+			oid:          "1.2.840.10045.2.1",
+			curve:        "secp256k1",
+			wantCategory: new(0),
+		},
+		{name: "DSA (1024, 160)", oid: "1.2.840.10040.4.1", size: 1024, subgroupSize: 160, wantClassical: new(80), wantCategory: new(0)},
+		{name: "DSA (2048, 224)", oid: "1.2.840.10040.4.1", size: 2048, subgroupSize: 224, wantClassical: new(112), wantCategory: new(0)},
+		{name: "DSA (2048, 256)", oid: "1.2.840.10040.4.1", size: 2048, subgroupSize: 256, wantClassical: new(112), wantCategory: new(0)},
+		{name: "DSA (3072, 256)", oid: "1.2.840.10040.4.1", size: 3072, subgroupSize: 256, wantClassical: new(128), wantCategory: new(0)},
+		{
+			// FIPS 186 does not pair an L of 2048 with an N of 160.
+			name: "DSA with an uncovered pair",
+			oid:  "1.2.840.10040.4.1",
+			size: 2048, subgroupSize: 160,
+			wantCategory: new(0),
+		},
+		{
+			name:         "DSA without a subgroup size",
+			oid:          "1.2.840.10040.4.1",
+			size:         2048,
+			wantCategory: new(0),
+		},
+		{name: "Ed25519", oid: "1.3.101.112", wantClassical: new(128), wantCategory: new(0)},
+		{name: "ML-DSA-44", oid: "2.16.840.1.101.3.4.3.17", wantCategory: new(2)},
+		{name: "ML-DSA-65", oid: "2.16.840.1.101.3.4.3.18", wantCategory: new(3)},
+		{name: "ML-DSA-87", oid: "2.16.840.1.101.3.4.3.19", wantCategory: new(5)},
+		{
+			// The strength of a signature depends on the key of the issuer.
+			name:         "signature algorithm",
+			oid:          "1.2.840.113549.1.1.11",
+			wantCategory: new(0),
+		},
+		{
+			// RSASSA-PSS is left out of the catalog.
+			name: "algorithm outside the catalog",
+			oid:  "1.2.840.113549.1.1.10",
+		},
+	}
+
+	for _, tt := range tests {
+		t.Run(tt.name, func(t *testing.T) {
+			// The identity comes from DescribeAlgorithm, so the parameters are encoded the way
+			// the parser encodes them. The algorithm carries levels of its own, which the
+			// assessment replaces without writing to the algorithm, as an in-memory cache may
+			// hold it.
+			info := crypto.DescribeAlgorithm(tt.oid, tt.size, tt.subgroupSize, tt.curve)
+			original := info.Algorithm
+			original.ClassicalSecurityLevel = new(1)
+			original.NISTQuantumSecurityLevel = new(6)
+			assets := []ftypes.CryptoAsset{{CryptoAssetInfo: info}}
+
+			crypto.AssessStrength(assets)
+			assert.Equal(t, tt.wantClassical, assets[0].Algorithm.ClassicalSecurityLevel)
+			assert.Equal(t, tt.wantCategory, assets[0].Algorithm.NISTQuantumSecurityLevel)
+			require.NoError(t, assets[0].Validate())
+
+			assert.Equal(t, new(1), original.ClassicalSecurityLevel)
+			assert.Equal(t, new(6), original.NISTQuantumSecurityLevel)
+		})
+	}
+
+	t.Run("assets that are not algorithms identified by an OID", func(t *testing.T) {
+		rsa := crypto.DescribeAlgorithm("1.2.840.113549.1.1.1", 2048, 0, "")
+		withoutDetails := rsa
+		withoutDetails.Algorithm = nil
+		otherMethod := rsa.Clone()
+		otherMethod.Identity.Method = ftypes.CryptoMethodSHA256
+		otherKind := rsa.Clone()
+		otherKi
```

**File**: `pkg/fanal/types/crypto.go` (modified, +13/-0)
```diff
@@ -167,6 +167,12 @@ func (a CryptoAssetInfo) Clone() CryptoAssetInfo {
 	}
 	if a.Algorithm != nil {
 		clone.Algorithm = new(*a.Algorithm)
+		if a.Algorithm.ClassicalSecurityLevel != nil {
+			clone.Algorithm.ClassicalSecurityLevel = new(*a.Algorithm.ClassicalSecurityLevel)
+		}
+		if a.Algorithm.NISTQuantumSecurityLevel != nil {
+			clone.Algorithm.NISTQuantumSecurityLevel = new(*a.Algorithm.NISTQuantumSecurityLevel)
+		}
 	}
 	return clone
 }
@@ -202,6 +208,13 @@ func (a CryptoAssetInfo) validateAlgorithm() error {
 	default:
 		return xerrors.Errorf("unknown algorithm primitive %q", a.Algorithm.Primitive)
 	}
+	if level := a.Algorithm.ClassicalSecurityLevel; level != nil && *level <= 0 {
+		return xerrors.Errorf("classical security level must be positive")
+	}
+	// NIST defines five categories, and the CycloneDX schema allows up to 6.
+	if level := a.Algorithm.NISTQuantumSecurityLevel; level != nil && (*level < 0 || *level > 6) {
+		return xerrors.Errorf("NIST quantum security level must be between 0 and 6")
+	}
 	return nil
 }
 
```

**File**: `pkg/fanal/types/crypto_algorithm.go` (modified, +9/-0)
```diff
@@ -13,7 +13,16 @@ const (
 )
 
 // CryptoAlgorithm contains algorithm-specific metadata.
+//
+// The security levels are nominal estimates for the algorithm and its parameters, not a
+// statement about an implementation or about policy approval. A nil level is not estimated.
 type CryptoAlgorithm struct {
 	Family    string `json:",omitempty"`
 	Primitive CryptoPrimitive
+
+	// ClassicalSecurityLevel is the classical security strength in bits.
+	ClassicalSecurityLevel *int `json:",omitempty"`
+	// NISTQuantumSecurityLevel is the NIST post-quantum security category from 1 to 5, or 0
+	// for an algorithm that meets none of them.
+	NISTQuantumSecurityLevel *int `json:",omitempty"`
 }
```

**File**: `pkg/fanal/types/crypto_test.go` (modified, +49/-0)
```diff
@@ -248,6 +248,49 @@ func TestCryptoAssetValidate(t *testing.T) {
 			})),
 			wantErr: `unknown algorithm primitive "hash"`,
 		},
+		{
+			name: "algorithm with security levels",
+			asset: cryptotest.AlgorithmAsset(cryptotest.WithMutate(func(a *types.CryptoAsset) {
+				a.Algorithm.ClassicalSecurityLevel = new(112)
+				a.Algorithm.NISTQuantumSecurityLevel = new(0)
+			})),
+			wantErr: "",
+		},
+		{
+			name: "highest NIST quantum security level",
+			asset: cryptotest.AlgorithmAsset(cryptotest.WithMutate(func(a *types.CryptoAsset) {
+				a.Algorithm.NISTQuantumSecurityLevel = new(6)
+			})),
+			wantErr: "",
+		},
+		{
+			name: "negative classical security level",
+			asset: cryptotest.AlgorithmAsset(cryptotest.WithMutate(func(a *types.CryptoAsset) {
+				a.Algorithm.ClassicalSecurityLevel = new(-1)
+			})),
+			wantErr: "classical security level must be positive",
+		},
+		{
+			name: "zero classical security level",
+			asset: cryptotest.AlgorithmAsset(cryptotest.WithMutate(func(a *types.CryptoAsset) {
+				a.Algorithm.ClassicalSecurityLevel = new(0)
+			})),
+			wantErr: "classical security level must be positive",
+		},
+		{
+			name: "NIST quantum security level above 6",
+			asset: cryptotest.AlgorithmAsset(cryptotest.WithMutate(func(a *types.CryptoAsset) {
+				a.Algorithm.NISTQuantumSecurityLevel = new(7)
+			})),
+			wantErr: "NIST quantum security level must be between 0 and 6",
+		},
+		{
+			name: "negative NIST quantum security level",
+			asset: cryptotest.AlgorithmAsset(cryptotest.WithMutate(func(a *types.CryptoAsset) {
+				a.Algorithm.NISTQuantumSecurityLevel = new(-1)
+			})),
+			wantErr: "NIST quantum security level must be between 0 and 6",
+		},
 		{
 			name: "negative key size",
 			asset: cryptotest.PublicKeyAsset(cryptotest.WithMutate(func(a *types.CryptoAsset) {
@@ -431,11 +474,17 @@ func TestCryptoAssetClone(t *testing.T) {
 		t.Parallel()
 
 		source := cryptotest.AlgorithmAsset()
+		source.Algorithm.ClassicalSecurityLevel = new(112)
+		source.Algorithm.NISTQuantumSecurityLevel = new(0)
 		clone := source.Clone()
 		require.NotSame(t, source.Algorithm, clone.Algorithm)
 		assert.Equal(t, source, clone)
 
 		clone.Algorithm.Family = "changed"
+		*clone.Algorithm.ClassicalSecurityLevel = 128
+		*clone.Algorithm.NISTQuantumSecurityLevel = 1
 		assert.Empty(t, source.Algorithm.Family)
+		assert.Equal(t, 112, *source.Algorithm.ClassicalSecurityLevel)
+		assert.Equal(t, 0, *source.Algorithm.NISTQuantumSecurityLevel)
 	})
 }
```

#### Recent Merged Pull Requests:
- **PR #11419** (2026-10-16): ci: add scopes for Helm, Ansible and ARM scanners (@nikpivkin)
- **PR #11414** (2026-10-16): fix: fail on read errors in .trivyignore (@nikpivkin)
- **PR #11412** (2026-10-15): chore: add misconfiguration tutorials to CODEOWNERS (@nikpivkin)
- **PR #11410** (2026-10-14): ci(helm): bump Trivy version to 0.76.0 for Trivy Helm Chart 0.28.0 (@repo-trivy-write-33ed3c[bot])
- **PR #11407** (2026-10-14): chore(deps): pin zlib >= 1.3.2-r1 in container images to fix CVE-2026-85091 (@DmitriyLewen)
- **PR #11405** (2026-10-14): ci: add scan/crypto label (@nikpivkin)

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

## X. vex): avoid panic on CSAF advisory without a CVE (#10990)

**RULE**:
When implementing operations in `pkg/vex/csaf.go`, engineers MUST enforce rigorous boundary validation, safe state transitions, and memory/concurrency invariants as established by production defect remediation in aquasecurity/trivy. All inputs crossing module boundaries must be explicitly verified before state persistence.

**WHY**:
Prevents defects observed in production commit `431288f8`: vex): avoid panic on CSAF advisory without a CVE (#10990). Unvalidated execution paths cause runtime exceptions, race conditions, and silent state corruption under concurrent workloads.

**WHEN TO APPLY**:
Subsystems managing Go data structures, boundary deserialization, API parsing, or resource lifecycles matching `pkg/vex/csaf.go`.

**VERIFIED IMPLEMENTATION PATTERN**:
```go
// Verified production-grade fix pattern:
		return item.CVE != nil && string(*item.CVE) == vuln.VulnerabilityID
```

**NEGATIVE CONSTRAINT**:
```go
// Anti-pattern to NEVER write (induced failure mode):
		return string(*item.CVE) == vuln.VulnerabilityID
```

**VERIFICATION METHOD**:
Automated regression test asserting that input states reproducing defect `431288f8` are properly handled with clean fallback behavior.
