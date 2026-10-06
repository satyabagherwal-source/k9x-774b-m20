# Forensic Learning Record (Deep Inspection): aquasecurity/trivy

> **Canonical Artifact**: `07_PROJECT_LEARNING/aquasecurity-trivy-learnings.md`  
> **Source Platform**: GitHub ([https://github.com/aquasecurity/trivy](https://github.com/aquasecurity/trivy))  
> **Harvest Method**: Full-Spectrum Deep Extraction (Patches, Diffs, Source Code, Post-Mortems)  
> **Harvest Timestamp**: 2026-10-06T02:51:43.594Z  
> **Compliance State**: Free Tier Guaranteed | Strict Rate-Limit Backoff Honored  

---

## 1. Context & Architectural Overview
- **Repository / Resource**: `aquasecurity/trivy`
- **Description**: Find vulnerabilities, misconfigurations, secrets, SBOM in containers, Kubernetes, code repositories, clouds and more
- **Primary Language / Ecosystem**: Go
- **Discovered Manifests / Configurations**: go.mod, README.md, Dockerfile
- **Stars / Engagement**: 38247 stars

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

### Core Architecture Module: `pkg/iac/scanners/ansible/fsutils/fsutils.go`
```
package fsutils

import (
	"errors"
	"io/fs"
	"os"
	"path"
	"path/filepath"
	"sort"
)

// FileSource represents a file together with the filesystem it belongs to.
//
// It abstracts over virtual filesystems and real disk paths, allowing
// consistent access to files whether they reside in a virtual FS or on disk.
type FileSource struct {
	// FS is the filesystem used to access the file.
	// It is ignored if Path is absolute.
	FS fs.FS

	// Path is the relative or absolute path to the file in Unix-like format.
	// If Path is relative, FS is used; if absolute, the file is accessed directly on disk.
	Path string
}

func NewFileSource(fsys fs.FS, p string) FileSource {
	if filepath.IsAbs(p) {
		return FileSource{
			FS:   nil,
			Path: filepath.ToSlash(p),
		}
	}
	return FileSource{
		FS:   fsys,
		Path: path.Clean(p),
	}
}

func (f FileSource) String() string {
	if f.FS != nil {
		return f.Path
	}
	return f.osPath()
}

func (f FileSource) osPath() string {
	return filepath.FromSlash(f.Path)
}

// FSAndRelPath returns the fs.FS and relative path to use for opening the file.
// If the FileSource has an embedded FS, it is used as-is.
// For absolute paths without FS, it returns an os.DirFS rooted at the parent directory
// and the file name as the relative path.
func (f FileSource) FSAndRelPath() (fs.FS, string) {
	if f.FS != nil {
		return f.FS, f.Path
	}

	absPath := filepath.FromSlash(f.Path)
	return os.DirFS(filepath.Dir(absPath)), filepath.Base(absPath)
}

func (f FileSource) Join(elem ...string) FileSource {
	for i, e := range elem {
		elem[i] = filepath.ToSlash(e)
	}
	return FileSource{
		FS:   f.FS,
		Path: path.Join(append([]string{f.Path}, elem...)...),
	}
}

func (f FileSource) Stat() (fs.FileInfo, error) {
	if f.FS != nil {
		return fs.Stat(f.FS, f.Path)
	}
	return os.Stat(f.osPath())
}

func (f FileSource) Exists() (bool, error) {
	_, err := f.Stat()
	if err != nil {
		if errors.Is(err, fs.ErrNotExist) {
			return false, nil
		}
		return false, err
	}
	return true, nil
}

func (f FileSource) ReadFile() ([]byte, error) {
	if f.FS != nil {
		return fs.ReadFile(f.FS, f.Path)
	}
	return os.ReadFile(f.osPath())
}

func (f FileSource) Open() (fs.File, error) {
	if f.FS != nil {
		return f.FS.Open(f.Path)
	}
	return os.Open(f.osPath())
}

func (f FileSource) Dir() FileSource {
	return FileSource{
		FS:   f.FS,
		Path: path.Dir(f.Path),
	}
}

func (f FileSource) ReadDir() ([]fs.DirEntry, error) {
	if f.FS != nil {
		return fs.ReadDir(f.FS, f.Path)
	}
	return os.ReadDir(f.osPath())
}

func (f FileSource) walkDir(fn fs.WalkDirFunc) error {
	if f.FS != nil {
		return fs.WalkDir(f.FS, f.Path, fn)
	}

	return filepath.WalkDir(f.osPath(), fn)
}

func (f FileSource) WalkDirFS(fn func(FileSource, fs.DirEntry) error) error {
	walkFn := func(path string, d fs.DirEntry, err error) error {
		if err != nil {
			return err
		}
		return fn(FileSource{FS: f.FS, Path: filepath.ToSlash(path)}, d)
	}
	return f.walkDir(walkFn)
}

func WalkDirsFirstAlpha(root FileSource, fn func(FileSource, fs.DirEntry) error) error {
	var walk func(fileSrc FileSource) error
	walk = func(fileSrc FileSource) error {
		entries, err := fileSrc.ReadDir()
		if err != nil {
			return err
		}

		SortDirsFirstAlpha(entries)

		for _, entry := range entries {
			entrySrc := fileSrc.Join(entry.Name())
			if err := fn(entrySrc, entry); err != nil {
				return err
			}

			if entry.IsDir() {
				if err := walk(entrySrc); err != nil {
					return err
				}
			}
		}
		return nil
	}

	return walk(root)
}

func SortDirsFirstAlpha(entries []fs.DirEntry) {
	sort.Slice(entries, func(i, j int) bool {
		if entries[i].IsDir() != entries[j].IsDir() {
			return entries[i].IsDir()
		}
		return entries[i].Name() < entries[j].Name()
	})
}

```

### Core Architecture Module: `pkg/iac/scanners/cloudformation/parser/util.go`
```
package parser

import (
	"strconv"

	"gopkg.in/yaml.v3"

	"github.com/aquasecurity/trivy/pkg/iac/scanners/cloudformation/cftypes"
	"github.com/aquasecurity/trivy/pkg/iac/scanners/kubernetes/parser"
)

func setPropertyValueFromYaml(node *yaml.Node, propertyData *Property) error {
	if IsIntrinsicFunc(node) {
		var newContent []*yaml.Node

		newContent = append(newContent, &yaml.Node{
			Tag:   "!!str",
			Value: getIntrinsicTag(node.Tag),
			Kind:  yaml.ScalarNode,
		})

		newContent = createNode(node, newContent)

		node.Tag = string(parser.TagMap)
		node.Kind = yaml.MappingNode
		node.Content = newContent
	}

	if node.Content == nil {

		switch node.Tag {
		case "!!int":
			propertyData.Type = cftypes.Int
			propertyData.Value, _ = strconv.Atoi(node.Value)
		case "!!bool":
			propertyData.Type = cftypes.Bool
			propertyData.Value, _ = strconv.ParseBool(node.Value)
		case "!!float":
			propertyData.Type = cftypes.Float64
			propertyData.Value, _ = strconv.ParseFloat(node.Value, 64)
		case "!!str", "!!string":
			propertyData.Type = cftypes.String
			propertyData.Value = node.Value
		}
		return nil
	}

	switch node.Tag {
	case string(parser.TagMap):
		var childData map[string]*Property
		if err := node.Decode(&childData); err != nil {
			return err
		}
		propertyData.Type = cftypes.Map
		propertyData.Value = childData
		return nil
	case "!!seq":
		var childData []*Property
		if err := node.Decode(&childData); err != nil {
			return err
		}
		propertyData.Type = cftypes.List
		propertyData.Value = childData
		return nil
	}

	return nil
}

func createNode(node *yaml.Node, newContent []*yaml.Node) []*yaml.Node {
	if node.Content == nil {
		newContent = append(newContent, &yaml.Node{
			Tag:   "!!str",
			Value: node.Value,
			Kind:  yaml.ScalarNode,
		})
	} else {

		newNode := &yaml.Node{
			Content: node.Content,
			Kind:    node.Kind,
		}

		switch node.Kind {
		case yaml.SequenceNode:
			newNode.Tag = "!!seq"
		case yaml.MappingNode:
			newNode.Tag = string(parser.TagMap)
		case yaml.ScalarNode:
		default:
			newNode.Tag = node.Tag
		}
		newContent = append(newContent, newNode)
	}
	return newContent
}

func calculateEndLine(node *yaml.Node) int {
	if node.Content == nil {
		return node.Line
	}

	return calculateEndLine(node.Content[len(node.Content)-1])

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
  **Post-Mortem & Fix Analysis**:
  > Fixed via https://github.com/aquasecurity/trivy/pull/11019

- **Issue #10723** (2026-05-27): **fix(misconf): skip null cty values in AsMapValue to prevent panic**
  *Symptoms*: ## Description  Added a check to ensure that the keys and values of the maps are not zero.  ## Related issues - Close https://github.com/aquasecurity/trivy/issues/10720  ## Checklist - [x] I've read the [guidelines for contributing](https://trivy.dev/docs/latest/community/contribute/pr/) to this repository. - [x] I've followed the [conventions](https://trivy.dev/docs/latest/community/contribute/pr/#title) in the PR title. - [x] I've added tests that prove my fix is effective or that my feature works. - [ ] I've updated the [documentation](https://github.com/aquasecurity/trivy/blob/main/docs) with the relevant information (if needed). - [ ] I've added usage information (if the PR introduces new options) - [ ] I've included a "before" and "after" example to the description (if the PR is a user interface change). 

- **Issue #10720** (2026-05-27): **bug(terraform): AsMapValue panics on null map element**
  *Symptoms*: Terraform scanner panics with `panic: value is null` when scanning a module containing a `map`/`object` attribute where any value references an unresolved variable.  `Attribute.AsMapValue` iterates over map elements via `ForEachElement` and calls `val.AsString()` guarded only by `val.IsKnown()`. In cty, a null value is *known*, so the guard passes and `AsString()` panics.  Example config: ```tf variable "project_number" {   type = string }  resource "google_container_cluster" "primary" {   name     = "demo"   location = "us-central1"    workload_identity_config {     workload_pool = "${var.project_number}.svc.id.goog"   } } ```  ### Discussed in https://github.com/aquasecurity/trivy/discussions/10700 
  **Post-Mortem & Fix Analysis**:
  > @nikpivkin I can work on this. The fix looks straightforward:     add a `!val.IsNull()` check alongside `val.IsKnown()` before     calling `AsString()` in AsMapValue. Should I start with a test     using the minimal repro, then the fix?

- **Issue #9259** (2025-08-25): **fix(cli): unexpected ordering in trivy args records the wrong command**
  *Symptoms*: If the user calls Trivy in a way that isn't "expected", such as `trivy -d --scanners vuln image nginx`, this is perfectly valid execution but the incorrect command is picked up.  Update the creation of the versionChecker to use the `targetKind` rather than infering the target from the first OS argument
  **Post-Mortem & Fix Analysis**:
  > This was resolved in #9260 

- **Issue #8616** (2025-03-27): **bug(k8s): `--report=all` yields no results even when results are present**
  *Symptoms*: ### Passing `--report=all` does not show any results ```shell ➜  ~/repos/trivy/trivy.main k8s  --scanners=vuln --report all 2025-03-26T14:58:05-06:00	INFO	Node scanning is enabled 2025-03-26T14:58:05-06:00	INFO	If you want to disable Node scanning via an in-cluster Job, please try '--disable-node-collector' to disable the Node-Collector job. 2025-03-26T14:58:05-06:00	INFO	Scanning K8s...	K8s="kind-kind-cluster" 248 / 248 [----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------] 100.00% 22 p/s ```  ### Passing `--report=summary` works fine  ```shell ➜  ~/repos/trivy/trivy.main k8s  --scanners=vuln --report summary 2025-03-26T14:48:57-06:00	INFO	Node scanning is enabled 2025-03-26T14:48:57-06:00	INFO	If you want to disable Node scanning via an in-cluster Job, please try '--disable-node-collector' to disable the Node-Collector job. 2025-03-26T14:48:57-06:00	INFO	Scanning K8s...	K8s="kind-kind-cluster" 248 / 248 [----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------] 100.00% 22 p/s  Summary Report for kind-kind-cluster   Workload Assessment ┌────────────────────┬─────────────────────────────────────┬─────────────────────
  **Post-Mortem & Fix Analysis**:
  > @DmitriyLewen fixes it https://github.com/aquasecurity/trivy/pull/8613
  > Fixed via https://github.com/aquasecurity/trivy/pull/8613

- **Issue #8611** (2025-04-05): **bug(k8s): `--include-non-failures` shows incorrect results in trivy k8s scanner**
  *Symptoms*: Without the flag, the results are correct. ``` trivy k8s --include-namespaces=ingress-nginx--scanners=misconfig --report=summary 2025-03-25T23:46:13-06:00	INFO	Node scanning is enabled 2025-03-25T23:46:13-06:00	INFO	If you want to disable Node scanning via an in-cluster Job, please try '--disable-node-collector' to disable the Node-Collector job. 2025-03-25T23:46:13-06:00	INFO	Scanning K8s...	K8s="kind-kind-cluster"  Summary Report for kind-kind-cluster   Workload Assessment ┌───────────────┬────────────────────────────────────────────┬───────────────────┐ │   Namespace   │                  Resource                  │ Misconfigurations │ │               │                                            ├───┬───┬───┬───┬───┤ │               │                                            │ C │ H │ M │ L │ U │ ├───────────────┼────────────────────────────────────────────┼───┼───┼───┼───┼───┤ │ ingress-nginx │ Job/ingress-nginx-admission-create         │   │   │ 3 │ 6 │   │ │ ingress-nginx │ Job/ingress-nginx-admission-patch          │   │   │ 3 │ 6 │   │ │ ingress-nginx │ Service/ingress-nginx-controller           │   │   │   │ 2 │   │ │ ingress-nginx │ Service/ingress-nginx-controller-admission │   │   │   │ 2 │   │ │ ingress-nginx │ Deployment/ingress-nginx-controller        │   │ 2 │ 5 │ 6 │   │ └───────────────┴────────────────────────────────────────────┴───┴───┴───┴───┴───┘ Severities: C=CRITICAL H=HIGH M=MEDIUM L=LOW U=UNKNOWN   Infra Assessment ┌──────

- **Issue #8246** (2025-03-03): **bug(k8s): Trivy doesn't detect `amazon linux` from KBOM**
  *Symptoms*: Trivy doesn't detect correctly `amazon linux` from a generated KBOM. SBOM scan shows next warning: ```sh 2024-12-18T18:51:48Z	WARN	Unsupported os	family="amazon linux" ``` it happens because `ftypes.Amazon` is `amazon` instead of `amazon linux`, and there is no a scanner for the last one: https://github.com/aquasecurity/trivy/blob/011012a8b4d8add049140b3996239a8358fd4202/pkg/fanal/types/const.go#L26 https://github.com/aquasecurity/trivy/blob/011012a8b4d8add049140b3996239a8358fd4202/pkg/detector/ospkg/detect.go#L35  ### Discussed in https://github.com/aquasecurity/trivy/discussions/8129#discussioncomment-11609365 

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

### Incident Patch 1: `8f815546` (2026-10-02)
**Commit Message**: docs(kubernetes): fix --exclude-namespace flag name in scan example (#10935)

Signed-off-by: s3onghyun <[REDACTED_EMAIL]>
Co-authored-by: s3onghyun <[REDACTED_EMAIL]>



---

### Incident Patch 2: `0afeae01` (2026-10-01)
**Commit Message**: fix(os): keep the fullest OS version when merging analyzer results (#11039)

**File**: `pkg/fanal/types/artifact.go` (modified, +4/-1)
```diff
@@ -4,6 +4,7 @@ import (
 	"cmp"
 	"slices"
 	"sort"
+	"strings"
 	"time"
 
 	"github.com/samber/lo"
@@ -72,7 +73,9 @@ func (o *OS) Merge(newOS OS) {
 		if o.Family == "" {
 			o.Family = newOS.Family
 		}
-		if o.Name == "" {
+		// One of the sources may report a shortened version, e.g. 7 and 7.9.2009 for CentOS.
+		// We always take the fullest version.
+		if o.Name == "" || (o.Family == newOS.Family && strings.HasPrefix(newOS.Name, o.Name+".")) {
 			o.Name = newOS.Name
 		}
 		// Ubuntu has ESM program: https://ubuntu.com/security/esm
```

**File**: `pkg/fanal/types/artifact_test.go` (modified, +27/-0)
```diff
@@ -77,6 +77,33 @@ func TestOS_Merge(t *testing.T) {
 			newOS: OS{Family: Alpine, Name: "3.21.0"},
 			want:  OS{Family: Alpine, Name: "3.20.3"},
 		},
+		{
+			// /etc/os-release yields 7, /etc/centos-release yields 7.9.2009.
+			// The analyzers run concurrently, so both orders must agree.
+			name:  "more specific version wins",
+			os:    OS{Family: CentOS, Name: "7"},
+			newOS: OS{Family: CentOS, Name: "7.9.2009"},
+			want:  OS{Family: CentOS, Name: "7.9.2009"},
+		},
+		{
+			name:  "less specific version loses",
+			os:    OS{Family: CentOS, Name: "7.9.2009"},
+			newOS: OS{Family: CentOS, Name: "7"},
+			want:  OS{Family: CentOS, Name: "7.9.2009"},
+		},
+		{
+			name:  "a longer version that is not a refinement is ignored",
+			os:    OS{Family: Alpine, Name: "3.2"},
+			newOS: OS{Family: Alpine, Name: "3.20"},
+			want:  OS{Family: Alpine, Name: "3.2"},
+		},
+		{
+			// Versions of different families are unrelated, so one never refines the other.
+			name:  "a longer version from another family is ignored",
+			os:    OS{Family: Alpine, Name: "3"},
+			newOS: OS{Family: Wolfi, Name: "3.20"},
+			want:  OS{Family: Alpine, Name: "3"},
+		},
 		{
 			name:  "extended is sticky",
 			os:    OS{Family: Ubuntu, Name: "18.04", Extended: true},
```

---

### Incident Patch 3: `3683d7d4` (2026-09-30)
**Commit Message**: fix(crypto): read RSA private keys without validating their math (#11319)

**File**: `pkg/crypto/parser/x509/export_test.go` (added, +18/-0)
```diff
@@ -0,0 +1,18 @@
+package x509
+
+// Bridge to expose the ASN.1 structures the parser reads to tests in the x509_test package.
+
+// EncryptedPrivateKeyInfo exports encryptedPrivateKeyInfo for testing.
+type EncryptedPrivateKeyInfo = encryptedPrivateKeyInfo
+
+// PKCS1PrivateKey exports pkcs1PrivateKey for testing.
+type PKCS1PrivateKey = pkcs1PrivateKey
+
+// PKCS1AdditionalPrime exports pkcs1AdditionalPrime for testing.
+type PKCS1AdditionalPrime = pkcs1AdditionalPrime
+
+// PKCS8PrivateKey exports pkcs8PrivateKey for testing.
+type PKCS8PrivateKey = pkcs8PrivateKey
+
+// OIDRSAEncryption exports oidRSAEncryption for testing.
+var OIDRSAEncryption = oidRSAEncryption
```

**File**: `pkg/crypto/parser/x509/parser.go` (modified, +89/-19)
```diff
@@ -14,6 +14,7 @@ import (
 	"encoding/pem"
 	"errors"
 	"iter"
+	"math/big"
 
 	ftypes "github.com/aquasecurity/trivy/pkg/fanal/types"
 	"github.com/aquasecurity/trivy/pkg/log"
@@ -74,6 +75,33 @@ type encryptedPrivateKeyInfo struct {
 	EncryptedData []byte
 }
 
+// pkcs1PrivateKey is an RSA private key in PKCS#1, as defined in RFC 8017.
+type pkcs1PrivateKey struct {
+	Version          int
+	N                *big.Int
+	E                int
+	D, P, Q          *big.Int
+	Dp               *big.Int               `asn1:"optional"`
+	Dq               *big.Int               `asn1:"optional"`
+	Qinv             *big.Int               `asn1:"optional"`
+	AdditionalPrimes []pkcs1AdditionalPrime `asn1:"optional,omitempty"`
+}
+
+// pkcs1AdditionalPrime is a prime of a multi-prime RSA private key, with its CRT values.
+type pkcs1AdditionalPrime struct {
+	Prime, Exp, Coeff *big.Int
+}
+
+// pkcs8PrivateKey is a private key in PKCS#8, as defined in RFC 5208, without its
+// optional attributes.
+type pkcs8PrivateKey struct {
+	Version    int
+	Algo       pkix.AlgorithmIdentifier
+	PrivateKey []byte
+}
+
+var oidRSAEncryption = asn1.ObjectIdentifier{1, 2, 840, 113549, 1, 1, 1}
+
 var (
 	errNotCryptographic  = errors.New("not cryptographic")
 	errUnsupportedCrypto = errors.New("unsupported cryptographic object")
@@ -224,23 +252,11 @@ func parsePEMObject(label string, der []byte) (object, error) {
 	case "CERTIFICATE":
 		return certificateObject(der)
 	case "PRIVATE KEY":
-		privateKey, err := stdx509.ParsePKCS8PrivateKey(der)
-		if err != nil {
-			return object{}, errMalformedCrypto
-		}
-		return privateKeyToObject(privateKey, ftypes.CryptoKeyFormatPKCS8)
+		return pkcs8PrivateKeyObject(der)
 	case "RSA PRIVATE KEY":
-		privateKey, err := stdx509.ParsePKCS1PrivateKey(der)
-		if err != nil {
-			return object{}, errMalformedCrypto
-		}
-		return privateKeyToObject(privateKey, ftypes.CryptoKeyFormatPKCS1)
+		return rsaPrivateKeyObject(der, ftypes.CryptoKeyFormatPKCS1)
 	case "EC PRIVATE KEY":
-		privateKey, err := stdx509.ParseECPrivateKey(der)
-		if err != nil {
-			return object{}, errMalformedCrypto
-		}
-		return privateKeyToObject(privateKey, ftypes.CryptoKeyFormatSEC1)
+		return privateKeyObject(der, ftypes.CryptoKeyFormatSEC1, stdx509.ParseECPrivateKey)
 	case "PUBLIC KEY":
 		publicKey, err := stdx509.ParsePKIXPublicKey(der)
 		if err != nil {
@@ -277,18 +293,72 @@ func parsePEMObject(label string, der []byte) (object, error) {
 	}
 }
 
+// privateKeyObject parses a private key and projects it to its public key.
+func privateKeyObject[K any](der []byte, format ftypes.CryptoKeyFormat, parseKey func([]byte) (K, error)) (object, error) {
+	privateKey, err := parseKey(der)
+	if err != nil {
+		return object{}, errMalformedCrypto
+	}
+	return privateKeyToObject(privateKey, format)
+}
+
+// pkcs8PrivateKeyObject parses a private key in PKCS#8 and projects it to its public key.
+func pkcs8PrivateKeyObject(der []byte) (object, error) {
+	var key pkcs8PrivateKey
+	if _, err := asn1.Unmarshal(der, &key); err == nil && key.Algo.Algorithm.Equal(oidRSAEncryption) {
+		return rsaPrivateKeyObject(key.PrivateKey, ftypes.CryptoKeyFormatPKCS8)
+	}
+	return privateKeyObject(der, ftypes.CryptoKeyFormatPKCS8, stdx509.ParsePKCS8PrivateKey)
+}
+
+// rsaPrivateKeyObject reads an RSA private key in PKCS#1 and projects it to its public key.
+// It checks the structure of the key but not its math, because crypto/x509 validates a key
+// with arithmetic whose cost grows with the size of its values, and a crafted key picks
+// them freely.
+func rsaPrivateKeyObject(der []byte, format ftypes.CryptoKeyFormat) (object, error) {
+	var key pkcs1PrivateKey
+	rest, err := asn1.Unmarshal(der, &key)
+	if err != nil || len(rest) > 0 {
+		return object{}, errMalformedCrypto
+	}
+	if key.Version < 0 || key.Version > 1 || key.E <= 0 {
+		return object{}, errMalformedCrypto
+	}
+	for _, v := range []*big.Int{key.N, key.D, key.P, key.Q} {
+		if v.Sign() <= 0 {
+			return object{}, errMalformedCrypto
+		}
+	}
+	for _, v := range []*big.Int{key.Dp, key.Dq, key.Qinv} {
+		if v != nil && v.Sign() <= 0 {
+			return object{}, errMalformedCrypto
+		}
+	}
+	for _, p := range key.AdditionalPrimes {
+		if p.Prime.Sign() <= 0 {
+			return object{}, errMalformedCrypto
+		}
+	}
+
+	return object{
+		kind:      objectPrivateKey,
+		publicKey: &rsa.PublicKey{N: key.N, E: key.E},
+		keyFormat: format,
+	}, nil
+}
+
 func parseDERObject(der []byte) (object, error) {
 	// The target ASN.1 DER structures have no common outer discriminator, so try their schema-specific parsers in order.
 	if obj, err := certificateObject(der); err == nil {
 		return obj, nil
 	}
 
-	if privateKey, err := stdx509.ParsePKCS1PrivateKey(der); err == nil {
-		return privateKeyToObject(privateKey, ftypes.CryptoKeyFormatPKCS1)
+	if obj, err := rsaPrivateKeyObject(der, ftypes.CryptoKeyFormatPKCS1); err == nil {
+		return obj, nil
 	}
 
-	if privateKey, err := stdx509.ParsePKCS8PrivateKey(der); err 
```

**File**: `pkg/crypto/parser/x509/parser_test.go` (modified, +110/-6)
```diff
@@ -37,11 +37,25 @@ var oidPBES2 = asn1.ObjectIdentifier{1, 2, 840, 113549, 1, 5, 13}
 // parsedFilePath is the path every fixture is parsed from.
 const parsedFilePath = "candidate.pem"
 
-// encryptedPrivateKeyInfo is the RFC 5958 envelope, which the parser validates without
-// opening.
-type encryptedPrivateKeyInfo struct {
-	Algorithm     pkix.AlgorithmIdentifier
-	EncryptedData []byte
+// rsaPrivateKeyDER encodes a structurally valid 2048-bit RSA key in PKCS#1 after applying
+// mutate to it. Its values are not consistent with each other.
+func rsaPrivateKeyDER(t *testing.T, mutate func(*cryptox509.PKCS1PrivateKey)) []byte {
+	t.Helper()
+	one := big.NewInt(1)
+	key := cryptox509.PKCS1PrivateKey{
+		N:    new(big.Int).Lsh(one, 2047),
+		E:    65537,
+		D:    one,
+		P:    one,
+		Q:    one,
+		Dp:   one,
+		Dq:   one,
+		Qinv: one,
+	}
+	mutate(&key)
+	der, err := asn1.Marshal(key)
+	require.NoError(t, err)
+	return der
 }
 
 // found states what an input was recognized as.
@@ -61,6 +75,26 @@ func TestParse(t *testing.T) {
 		"DEK-Info":  "AES-256-CBC,00112233445566778899AABBCCDDEEFF",
 	}
 	rfc1423Ciphertext := []byte{0x01, 0x02, 0x03, 0x04}
+	// P is longer than the modulus.
+	invalidRSAKey := rsaPrivateKeyDER(t, func(k *cryptox509.PKCS1PrivateKey) {
+		k.P = new(big.Int).Lsh(big.NewInt(1), 24575)
+	})
+	// crypto/x509 reads a key that omits its CRT values.
+	rsaKeyWithoutCRT := rsaPrivateKeyDER(t, func(k *cryptox509.PKCS1PrivateKey) {
+		k.Dp, k.Dq, k.Qinv = nil, nil, nil
+	})
+	rsaKeyWithZeroPrime := rsaPrivateKeyDER(t, func(k *cryptox509.PKCS1PrivateKey) {
+		k.Version = 1
+		k.AdditionalPrimes = []cryptox509.PKCS1AdditionalPrime{{Prime: big.NewInt(0), Exp: big.NewInt(1), Coeff: big.NewInt(1)}}
+	})
+	invalidRSAKeyPKCS8, err := asn1.Marshal(cryptox509.PKCS8PrivateKey{
+		Algo: pkix.AlgorithmIdentifier{
+			Algorithm:  cryptox509.OIDRSAEncryption,
+			Parameters: asn1.NullRawValue,
+		},
+		PrivateKey: invalidRSAKey,
+	})
+	require.NoError(t, err)
 
 	pemCertificate := found{
 		kind:     ftypes.CryptoKindCertificate,
@@ -371,6 +405,36 @@ func TestParse(t *testing.T) {
 			name:  "PKCS8 under RSA PRIVATE KEY",
 			input: pem.EncodeToMemory(&pem.Block{Type: "RSA PRIVATE KEY", Bytes: fixtures.pkcs8DER}),
 		},
+		{
+			name:  "invalid RSA key PKCS1 PEM",
+			input: pem.EncodeToMemory(&pem.Block{Type: "RSA PRIVATE KEY", Bytes: invalidRSAKey}),
+			want:  []found{pemPKCS1PrivateKey},
+		},
+		{
+			name:  "invalid RSA key PKCS8 PEM",
+			input: pem.EncodeToMemory(&pem.Block{Type: "PRIVATE KEY", Bytes: invalidRSAKeyPKCS8}),
+			want:  []found{pemPKCS8PrivateKey},
+		},
+		{
+			name:  "RSA key without CRT values PKCS1 PEM",
+			input: pem.EncodeToMemory(&pem.Block{Type: "RSA PRIVATE KEY", Bytes: rsaKeyWithoutCRT}),
+			want:  []found{pemPKCS1PrivateKey},
+		},
+		{
+			name:  "RSA key with zero additional prime PKCS1 PEM",
+			input: pem.EncodeToMemory(&pem.Block{Type: "RSA PRIVATE KEY", Bytes: rsaKeyWithZeroPrime}),
+		},
+		{
+			name:  "invalid RSA key PKCS1 DER",
+			input: invalidRSAKey,
+			want: []found{{
+				kind:     ftypes.CryptoKindKey,
+				keyType:  ftypes.CryptoKeyTypePrivate,
+				method:   ftypes.CryptoMethodSPKISHA256,
+				format:   ftypes.CryptoKeyFormatPKCS1,
+				encoding: ftypes.CryptoEncodingDER,
+			}},
+		},
 		{
 			name:  "certificate request under CERTIFICATE",
 			input: pem.EncodeToMemory(&pem.Block{Type: "CERTIFICATE", Bytes: fixtures.csrDER}),
@@ -815,6 +879,31 @@ func TestParseAssets(t *testing.T) {
 				at(rsaAlgorithm),
 			},
 		},
+		{
+			name:  "multi-prime private key",
+			input: fixtures.multiPrimePEM,
+			want: []ftypes.CryptoAsset{
+				{
+					CryptoAssetInfo: ftypes.CryptoAssetInfo{
+						Kind:     ftypes.CryptoKindKey,
+						KeyType:  ftypes.CryptoKeyTypePrivate,
+						Identity: spkiIdentity(t, fixtures.multiPrimePublic),
+						Name:     "RSA-2048 private key",
+						Key: &ftypes.CryptoKey{
+							Size: 2048,
+						},
+						Relationships: []ftypes.CryptoRelationship{{
+							Type:         ftypes.CryptoRelationshipUsedWith,
+							RelatedAsset: rsaAlgorithm.Descriptor(),
+						}},
+					},
+					FilePath: parsedFilePath,
+					Format:   ftypes.CryptoKeyFormatPKCS1,
+					Encoding: ftypes.CryptoEncodingPEM,
+				},
+				at(rsaAlgorithm),
+			},
+		},
 		{
 			name:  "encrypted PKCS#8 private key",
 			input: fixtures.encryptedPEM,
@@ -1048,6 +1137,8 @@ type testFixtures struct {
 	otherCertificate   *stdx509.Certificate
 	pssCertificate     *stdx509.Certificate
 	rsaPublic          *rsa.PublicKey
+	multiPrimePublic   *rsa.PublicKey
+	multiPrimePEM      []byte
 	certificateDER     []byte
 	certificatePEM     []byte
 	pkcs1DER           []byte
@@ -1081,10 +1172,21 @@ var sharedRSAKey = sync.OnceValue(func() *rsa.PrivateKey {
 	return key
 })
 
+// sharedMultiPrimeRSAKey is a 2048-bit key with three primes, generated once for the
+// package like sharedRSAKey.
+var sharedMultiPrimeRSAKey = sync.OnceValue(func() *rsa.PrivateKey {
+	key, err := rsa.Ge
```

---

### Incident Patch 4: `a072319a` (2026-09-30)
**Commit Message**: fix(python): support uv workspace lockfiles (#10553)

Co-authored-by: DmitriyLewen <[REDACTED_EMAIL]>

**File**: `docs/guide/scanner/vulnerability.md` (modified, +1/-1)
```diff
@@ -324,7 +324,7 @@ This feature allows you to focus on vulnerabilities in specific types of depende
 In Trivy, there are four types of package relationships:
 
 1. `root`: The root package being scanned
-2. `workspace`: Workspaces of the root package (Currently only `pom.xml`, `yarn.lock` and `cargo.lock` files are supported)
+2. `workspace`: Workspaces of the root package (Currently only `pom.xml`, `yarn.lock`, `cargo.lock` and `uv.lock` files are supported)
 3. `direct`: Direct dependencies of the root/workspace package
 4. `indirect`: Transitive dependencies
 5. `unknown`: Packages whose relationship cannot be determined
```

**File**: `pkg/dependency/parser/python/uv/parse.go` (modified, +59/-32)
```diff
@@ -2,6 +2,7 @@ package uv
 
 import (
 	"context"
+	"slices"
 	"sort"
 
 	"github.com/BurntSushi/toml"
@@ -15,6 +16,7 @@ import (
 )
 
 type Lock struct {
+	Manifest Manifest  `toml:"manifest"`
 	Packages []Package `toml:"package"`
 }
 
@@ -24,41 +26,61 @@ func (l Lock) packages() map[string]Package {
 	})
 }
 
-func prodDeps(root Package, packages map[string]Package) set.Set[string] {
+type Manifest struct {
+	Members []string `toml:"members"`
+}
+
+// prodDeps returns the names of all production dependencies: every package reachable from
+// the root package or a workspace member by following non-dev dependencies.
+func prodDeps(root string, workspaces set.Set[string], packages map[string]Package) set.Set[string] {
 	visited := set.New[string]()
-	walkPackageDeps(root, packages, visited)
+	if root != "" {
+		walkPackageDeps(root, packages, visited)
+	}
+	for name := range workspaces.Iter() {
+		walkPackageDeps(name, packages, visited)
+	}
 	return visited
 }
 
-func walkPackageDeps(pkg Package, packages map[string]Package, visited set.Set[string]) {
-	if visited.Contains(pkg.Name) {
+func walkPackageDeps(name string, packages map[string]Package, visited set.Set[string]) {
+	if visited.Contains(name) {
 		return
 	}
-	visited.Append(pkg.Name)
+	pkg, exists := packages[name]
+	if !exists {
+		return
+	}
+	visited.Append(name)
 	for depName := range pkg.nonDevDeps().Iter() {
-		depPkg, exists := packages[depName]
-		if !exists {
-			continue
-		}
-		walkPackageDeps(depPkg, packages, visited)
+		walkPackageDeps(depName, packages, visited)
 	}
 }
 
-func (l Lock) root() (Package, error) {
-	var pkgs []Package
+// rootAndWorkspaces walks the lockfile packages once and returns the name of the root
+// package (empty if there is none), the set of workspace member names, and the set of
+// direct dependency names collected from the root and every workspace member. The root
+// and workspaces are the entry points of the dependency graph: everything reachable from
+// them is a production dependency.
+func (l Lock) rootAndWorkspaces() (root string, workspaces, directDeps set.Set[string], err error) {
+	workspaces = set.New[string]()
+	directDeps = set.New[string]()
+
 	for _, pkg := range l.Packages {
-		if pkg.isRoot() {
-			pkgs = append(pkgs, pkg)
+		switch {
+		case pkg.isRoot():
+			if root != "" {
+				return "", nil, nil, xerrors.New("uv lockfile must contain 1 root package")
+			}
+			root = pkg.Name
+			directDeps.Append(pkg.directDeps().Items()...)
+		case slices.Contains(l.Manifest.Members, pkg.Name):
+			workspaces.Append(pkg.Name)
+			directDeps.Append(pkg.directDeps().Items()...)
 		}
 	}
 
-	// lock file must include root package
-	// cf. https://github.com/astral-sh/uv/blob/f80ddf10b63c3e7b421ca4658e63f97db1e0378c/crates/uv/src/commands/project/lock.rs#L933-L936
-	if len(pkgs) != 1 {
-		return Package{}, xerrors.New("uv lockfile must contain 1 root package")
-	}
-
-	return pkgs[0], nil
+	return root, workspaces, directDeps, nil
 }
 
 type Package struct {
@@ -74,7 +96,6 @@ func (p Package) directDeps() set.Set[string] {
 	deps := p.nonDevDeps()
 	for _, groupDeps := range p.DevDependencies {
 		deps.Append(groupDeps.toSet().Items()...)
-
 	}
 	return deps
 }
@@ -125,18 +146,16 @@ func (p *Parser) Parse(_ context.Context, r xio.ReadSeekerAt) ([]ftypes.Package,
 		return nil, nil, xerrors.Errorf("failed to decode uv lock file: %w", err)
 	}
 
-	rootPackage, err := lock.root()
+	root, workspaces, directDeps, err := lock.rootAndWorkspaces()
 	if err != nil {
 		return nil, nil, err
 	}
 
 	packages := lock.packages()
-	directDeps := rootPackage.directDeps()
 
-	// Since each lockfile contains a root package with a list of direct dependencies,
-	// we can identify all production dependencies by traversing the dependency graph
-	// and collecting all the dependencies that are reachable from the root.
-	prodDeps := prodDeps(rootPackage, packages)
+	// Production dependencies are the packages reachable from the root package
+	// or, for workspace lockfiles, any workspace member package.
+	prodDeps := prodDeps(root, workspaces, packages)
 
 	var (
 		pkgs ftypes.Packages
@@ -146,9 +165,12 @@ func (p *Parser) Parse(_ context.Context, r xio.ReadSeekerAt) ([]ftypes.Package,
 	for _, pkg := range lock.Packages {
 		pkgID := packageID(pkg.Name, pkg.Version)
 		relationship := ftypes.RelationshipIndirect
-		if pkg.isRoot() {
+		switch {
+		case pkg.Name == root:
 			relationship = ftypes.RelationshipRoot
-		} else if directDeps.Contains(pkg.Name) {
+		case workspaces.Contains(pkg.Name):
+			relationship = ftypes.RelationshipWorkspace
+		case directDeps.Contains(pkg.Name):
 			relationship = ftypes.RelationshipDirect
 		}
 
@@ -160,9 +182,14 @@ func (p *Parser) Parse(_ context.Context, r xio.ReadSeekerAt) ([]ftypes.Package,
 			Dev:          !prodDeps.Contains(pkg.Name),
 		})
 
-		dependsOn := make([]string, 0, len(pkg.Dependencies))
+		depNames := pkg.directDeps()
+		// The root package depends on every workspace
```

**File**: `pkg/dependency/parser/python/uv/parse_test.go` (modified, +14/-3)
```diff
@@ -25,9 +25,20 @@ func TestParser_Parse(t *testing.T) {
 			wantDeps: uvNormalDeps,
 		},
 		{
-			name:    "lockfile without root",
-			file:    "testdata/uv_without_root.lock",
-			wantErr: "uv lockfile must contain 1 root package",
+			name:     "workspace without root package",
+			file:     "testdata/uv_workspace_virtual.lock",
+			wantPkgs: uvWorkspaceVirtual,
+			wantDeps: uvWorkspaceVirtualDeps,
+		},
+		{
+			name:     "workspace with root package",
+			file:     "testdata/uv_workspace_rooted.lock",
+			wantPkgs: uvWorkspaceRooted,
+			wantDeps: uvWorkspaceRootedDeps,
+		},
+		{
+			name: "lockfile without root",
+			file: "testdata/uv_without_root.lock",
 		},
 		{
 			name:    "multiple roots",
```

**File**: `pkg/dependency/parser/python/uv/parse_testcase.go` (modified, +37/-0)
```diff
@@ -49,4 +49,41 @@ var (
 		{ID: "pytest@8.3.4", DependsOn: []string{"colorama@0.4.6", "exceptiongroup@1.2.2", "iniconfig@2.0.0", "packaging@24.2", "pluggy@1.5.0", "tomli@2.2.1"}},
 		{ID: "requests@2.32.0", DependsOn: []string{"certifi@2024.12.14", "charset-normalizer@3.4.0", "idna@3.10", "urllib3@2.2.3"}},
 	}
+
+	uvWorkspaceVirtual = []ftypes.Package{
+		{ID: "a@0.1.0", Name: "a", Version: "0.1.0", Relationship: ftypes.RelationshipWorkspace},
+		{ID: "b@0.1.0", Name: "b", Version: "0.1.0", Relationship: ftypes.RelationshipWorkspace},
+		{ID: "pillow@11.0.0", Name: "pillow", Version: "11.0.0", Relationship: ftypes.RelationshipDirect},
+		{ID: "requests@2.32.3", Name: "requests", Version: "2.32.3", Relationship: ftypes.RelationshipDirect},
+	}
+
+	uvWorkspaceVirtualDeps = []ftypes.Dependency{
+		{ID: "a@0.1.0", DependsOn: []string{"requests@2.32.3"}},
+		{ID: "b@0.1.0", DependsOn: []string{"pillow@11.0.0"}},
+	}
+
+	uvWorkspaceRooted = []ftypes.Package{
+		{ID: "root@0.1.0", Name: "root", Version: "0.1.0", Relationship: ftypes.RelationshipRoot},
+		{ID: "a@0.1.0", Name: "a", Version: "0.1.0", Relationship: ftypes.RelationshipWorkspace},
+		{ID: "b@0.1.0", Name: "b", Version: "0.1.0", Relationship: ftypes.RelationshipWorkspace},
+		{ID: "click@8.1.7", Name: "click", Version: "8.1.7", Relationship: ftypes.RelationshipDirect},
+		{ID: "pillow@11.0.0", Name: "pillow", Version: "11.0.0", Relationship: ftypes.RelationshipDirect},
+		{ID: "pytest@8.3.4", Name: "pytest", Version: "8.3.4", Relationship: ftypes.RelationshipDirect, Dev: true},
+		{ID: "requests@2.32.3", Name: "requests", Version: "2.32.3", Relationship: ftypes.RelationshipDirect},
+		{ID: "ruff@0.9.0", Name: "ruff", Version: "0.9.0", Relationship: ftypes.RelationshipDirect, Dev: true},
+		{ID: "colorama@0.4.6", Name: "colorama", Version: "0.4.6", Relationship: ftypes.RelationshipIndirect, Dev: true},
+		{ID: "idna@3.10", Name: "idna", Version: "3.10", Relationship: ftypes.RelationshipIndirect},
+		{ID: "tomli@2.2.1", Name: "tomli", Version: "2.2.1", Relationship: ftypes.RelationshipIndirect, Dev: true},
+		{ID: "urllib3@2.2.3", Name: "urllib3", Version: "2.2.3", Relationship: ftypes.RelationshipIndirect},
+	}
+
+	uvWorkspaceRootedDeps = []ftypes.Dependency{
+		{ID: "a@0.1.0", DependsOn: []string{"pytest@8.3.4", "requests@2.32.3"}},
+		{ID: "b@0.1.0", DependsOn: []string{"pillow@11.0.0", "ruff@0.9.0"}},
+		{ID: "pillow@11.0.0", DependsOn: []string{"idna@3.10"}},
+		{ID: "pytest@8.3.4", DependsOn: []string{"colorama@0.4.6"}},
+		{ID: "requests@2.32.3", DependsOn: []string{"urllib3@2.2.3"}},
+		{ID: "root@0.1.0", DependsOn: []string{"a@0.1.0", "b@0.1.0", "click@8.1.7"}},
+		{ID: "ruff@0.9.0", DependsOn: []string{"tomli@2.2.1"}},
+	}
 )
```

**File**: `pkg/dependency/parser/python/uv/testdata/uv_without_root.lock` (modified, +2/-10)
```diff
@@ -1,11 +1,3 @@
 version = 1
-requires-python = ">=3.11"
-
-[[package]]
-name = "asyncio"
-version = "3.4.3"
-source = { registry = "https://pypi.org/simple" }
-sdist = { url = "https://files.pythonhosted.org/packages/da/54/054bafaf2c0fb8473d423743e191fcdf49b2c1fd5e9af3524efbe097bafd/asyncio-3.4.3.tar.gz", hash = "sha256:83360ff8bc97980e4ff25c964c7bd3923d333d177aa4f7fb736b019f26c7cb41", size = 204411 }
-wheels = [
-    { url = "https://files.pythonhosted.org/packages/22/74/07679c5b9f98a7cb0fc147b1ef1cc1853bc07a4eb9cb5731e24732c5f773/asyncio-3.4.3-py3-none-any.whl", hash = "sha256:c4d18b22701821de07bd6aea8b53d21449ec0ec5680645e5317062ea21817d2d", size = 101767 },
-]
\ No newline at end of file
+revision = 3
+requires-python = ">=3.13"
```

**File**: `pkg/dependency/parser/python/uv/testdata/uv_workspace_rooted.lock` (added, +91/-0)
```diff
@@ -0,0 +1,91 @@
+version = 1
+
+[manifest]
+members = ["a", "b"]
+
+[[package]]
+name = "root"
+version = "0.1.0"
+source = { virtual = "." }
+dependencies = [
+    { name = "click" },
+]
+
+[[package]]
+name = "a"
+version = "0.1.0"
+source = { editable = "src/a" }
+dependencies = [
+    { name = "requests" },
+]
+
+[package.dev-dependencies]
+test = [{ name = "pytest" }]
+
+[[package]]
+name = "b"
+version = "0.1.0"
+source = { editable = "src/b" }
+dependencies = [
+    { name = "pillow" },
+]
+
+[package.dev-dependencies]
+lint = [{ name = "ruff" }]
+
+[[package]]
+name = "click"
+version = "8.1.7"
+source = { registry = "https://pypi.org/simple" }
+
+[[package]]
+name = "pillow"
+version = "11.0.0"
+source = { registry = "https://pypi.org/simple" }
+dependencies = [
+    { name = "idna" },
+]
+
+[[package]]
+name = "requests"
+version = "2.32.3"
+source = { registry = "https://pypi.org/simple" }
+dependencies = [
+    { name = "urllib3" },
+]
+
+[[package]]
+name = "pytest"
+version = "8.3.4"
+source = { registry = "https://pypi.org/simple" }
+dependencies = [
+    { name = "colorama" },
+]
+
+[[package]]
+name = "ruff"
+version = "0.9.0"
+source = { registry = "https://pypi.org/simple" }
+dependencies = [
+    { name = "tomli" },
+]
+
+[[package]]
+name = "colorama"
+version = "0.4.6"
+source = { registry = "https://pypi.org/simple" }
+
+[[package]]
+name = "idna"
+version = "3.10"
+source = { registry = "https://pypi.org/simple" }
+
+[[package]]
+name = "tomli"
+version = "2.2.1"
+source = { registry = "https://pypi.org/simple" }
+
+[[package]]
+name = "urllib3"
+version = "2.2.3"
+source = { registry = "https://pypi.org/simple" }
```

**File**: `pkg/dependency/parser/python/uv/testdata/uv_workspace_virtual.lock` (added, +30/-0)
```diff
@@ -0,0 +1,30 @@
+version = 1
+
+[manifest]
+members = ["a", "b"]
+
+[[package]]
+name = "a"
+version = "0.1.0"
+source = { editable = "src/a" }
+dependencies = [
+    { name = "requests" },
+]
+
+[[package]]
+name = "b"
+version = "0.1.0"
+source = { editable = "src/b" }
+dependencies = [
+    { name = "pillow" },
+]
+
+[[package]]
+name = "pillow"
+version = "11.0.0"
+source = { registry = "https://pypi.org/simple" }
+
+[[package]]
+name = "requests"
+version = "2.32.3"
+source = { registry = "https://pypi.org/simple" }
```

---

### Incident Patch 5: `3a1b311e` (2026-09-29)
**Commit Message**: fix(purl): classify julia, bottlerocket and centos stream packages (#11326)

**File**: `pkg/purl/purl.go` (modified, +4/-2)
```diff
@@ -176,6 +176,8 @@ func (p *PackageURL) LangType() ftypes.LangType {
 		return ftypes.Conan
 	case packageurl.TypePub:
 		return ftypes.Pub
+	case packageurl.TypeJulia:
+		return ftypes.Julia
 	case packageurl.TypeBitnami:
 		return ftypes.Bitnami
 	case TypeK8s:
@@ -199,7 +201,7 @@ func (p *PackageURL) LangType() ftypes.LangType {
 
 func (p *PackageURL) Class() types.ResultClass {
 	switch p.Type {
-	case packageurl.TypeApk, packageurl.TypeDebian, packageurl.TypeRPM:
+	case packageurl.TypeApk, packageurl.TypeDebian, packageurl.TypeRPM, packageurlTypeBottlerocket:
 		// OS packages
 		return types.ClassOSPkg
 	default:
@@ -483,7 +485,7 @@ func purlType(t ftypes.TargetType) string {
 		return packageurl.TypeApk
 	case ftypes.Debian, ftypes.Ubuntu, ftypes.Echo:
 		return packageurl.TypeDebian
-	case ftypes.RedHat, ftypes.CentOS, ftypes.Rocky, ftypes.Alma,
+	case ftypes.RedHat, ftypes.CentOS, ftypes.CentOSStream, ftypes.Rocky, ftypes.Alma,
 		ftypes.Amazon, ftypes.Fedora, ftypes.Oracle, ftypes.OpenSUSE,
 		ftypes.OpenSUSELeap, ftypes.OpenSUSETumbleweed, ftypes.SLES, ftypes.SLEMicro, ftypes.Photon,
 		ftypes.Azure, ftypes.CBLMariner, ftypes.CoreOS:
```

**File**: `pkg/purl/purl_test.go` (modified, +145/-0)
```diff
@@ -299,6 +299,41 @@ func TestNewPackageURL(t *testing.T) {
 				Version: "9.0.1",
 			},
 		},
+		{
+			// Without CentOSStream in the RPM branch of purlType this falls to the
+			// default and comes out as Type "centos-stream", which Class then
+			// reports as unknown and the SBOM decoder drops.
+			name: "os package with centos stream",
+			typ:  ftypes.CentOSStream,
+			pkg: ftypes.Package{
+				Name:    "glibc",
+				Version: "2.34",
+				Release: "60.el9",
+				Arch:    "x86_64",
+			},
+			metadata: types.Metadata{
+				OS: &ftypes.OS{
+					Family: ftypes.CentOSStream,
+					Name:   "9",
+				},
+			},
+			want: &purl.PackageURL{
+				Type:      packageurl.TypeRPM,
+				Namespace: "centos-stream",
+				Name:      "glibc",
+				Version:   "2.34-60.el9",
+				Qualifiers: packageurl.Qualifiers{
+					{
+						Key:   "arch",
+						Value: "x86_64",
+					},
+					{
+						Key:   "distro",
+						Value: "centos-stream-9",
+					},
+				},
+			},
+		},
 		{
 			name: "os package",
 			typ:  ftypes.RedHat,
@@ -941,6 +976,21 @@ func TestPackageURL_LangType(t *testing.T) {
 			},
 			want: ftypes.Jar,
 		},
+		{
+			name: "julia",
+			purl: packageurl.PackageURL{
+				Type:    packageurl.TypeJulia,
+				Name:    "Example",
+				Version: "0.5.3",
+				Qualifiers: packageurl.Qualifiers{
+					{
+						Key:   "uuid",
+						Value: "7876af07-990d-54b4-ab0e-23690620f79a",
+					},
+				},
+			},
+			want: ftypes.Julia,
+		},
 		{
 			name: "k8s",
 			purl: packageurl.PackageURL{
@@ -969,6 +1019,101 @@ func TestPackageURL_LangType(t *testing.T) {
 	}
 }
 
+// A purl type that Class reports as unknown is dropped by the SBOM decoder.
+func TestPackageURL_Class(t *testing.T) {
+	tests := []struct {
+		name string
+		purl packageurl.PackageURL
+		want types.ResultClass
+	}{
+		{
+			name: "apk",
+			purl: packageurl.PackageURL{
+				Type:      packageurl.TypeApk,
+				Namespace: "alpine",
+				Name:      "musl",
+				Version:   "1.2.3",
+			},
+			want: types.ClassOSPkg,
+		},
+		{
+			name: "deb",
+			purl: packageurl.PackageURL{
+				Type:      packageurl.TypeDebian,
+				Namespace: "debian",
+				Name:      "libc6",
+				Version:   "2.36-9",
+			},
+			want: types.ClassOSPkg,
+		},
+		{
+			name: "rpm",
+			purl: packageurl.PackageURL{
+				Type:      packageurl.TypeRPM,
+				Namespace: "redhat",
+				Name:      "glibc",
+				Version:   "2.34-60",
+			},
+			want: types.ClassOSPkg,
+		},
+		{
+			name: "bottlerocket",
+			purl: packageurl.PackageURL{
+				Type:    "bottlerocket",
+				Name:    "glibc",
+				Version: "2.40",
+				Qualifiers: packageurl.Qualifiers{
+					{
+						Key:   "distro",
+						Value: "bottlerocket-1.34.0",
+					},
+				},
+			},
+			want: types.ClassOSPkg,
+		},
+		{
+			name: "maven",
+			purl: packageurl.PackageURL{
+				Type:      packageurl.TypeMaven,
+				Namespace: "org.springframework",
+				Name:      "spring-core",
+				Version:   "5.0.4.RELEASE",
+			},
+			want: types.ClassLangPkg,
+		},
+		{
+			name: "julia",
+			purl: packageurl.PackageURL{
+				Type:    packageurl.TypeJulia,
+				Name:    "Example",
+				Version: "0.5.3",
+				Qualifiers: packageurl.Qualifiers{
+					{
+						Key:   "uuid",
+						Value: "7876af07-990d-54b4-ab0e-23690620f79a",
+					},
+				},
+			},
+			want: types.ClassLangPkg,
+		},
+		{
+			name: "unsupported type",
+			purl: packageurl.PackageURL{
+				Type:    "huggingface",
+				Name:    "distilbert-base-uncased",
+				Version: "043235d6088ecd3dd5fb5ca3592b6913fd516027",
+			},
+			want: types.ClassUnknown,
+		},
+	}
+	for _, tt := range tests {
+		t.Run(tt.name, func(t *testing.T) {
+			p := purl.PackageURL(tt.purl)
+			assert.Equalf(t, tt.want, p.Class(), "Class()")
+		})
+	}
+}
+
 func TestPackageURL_Match(t *testing.T) {
 	tests := []struct {
 		name       string
```

---

### Incident Patch 6: `1849d2ff` (2026-09-29)
**Commit Message**: chore(alpine): add EOL date for Alpine 3.24 and fix 3.21/3.22 dates (#11308)

**File**: `pkg/detector/ospkg/alpine/alpine.go` (modified, +3/-2)
```diff
@@ -48,9 +48,10 @@ var eolDates = map[string]time.Time{
 	"3.18": time.Date(2025, 5, 9, 23, 59, 59, 0, time.UTC),
 	"3.19": time.Date(2025, 11, 1, 23, 59, 59, 0, time.UTC),
 	"3.20": time.Date(2026, 4, 1, 23, 59, 59, 0, time.UTC),
-	"3.21": time.Date(2026, 12, 5, 23, 59, 59, 0, time.UTC),
-	"3.22": time.Date(2027, 4, 30, 23, 59, 59, 0, time.UTC),
+	"3.21": time.Date(2026, 11, 1, 23, 59, 59, 0, time.UTC),
+	"3.22": time.Date(2027, 5, 1, 23, 59, 59, 0, time.UTC),
 	"3.23": time.Date(2027, 11, 1, 23, 59, 59, 0, time.UTC),
+	"3.24": time.Date(2028, 6, 1, 23, 59, 59, 0, time.UTC),
 	"edge": time.Date(9999, 1, 1, 0, 0, 0, 0, time.UTC),
 }
 
```

---

### Incident Patch 7: `7e71d211` (2026-09-28)
**Commit Message**: fix(python): skip pip requirement lines with malformed extras brackets (#11300)

Co-authored-by: DmitriyLewen <[REDACTED_EMAIL]>

**File**: `pkg/dependency/parser/python/pip/parse.go` (modified, +19/-7)
```diff
@@ -86,10 +86,16 @@ func (p *Parser) Parse(_ context.Context, r xio.ReadSeekerAt) ([]ftypes.Package,
 		text := scanner.Text()
 		line := strings.ReplaceAll(text, " ", "")
 		line = strings.ReplaceAll(line, `\`, "")
-		line = removeExtras(line)
 		line = rStripByKey(line, commentMarker)
 		line = rStripByKey(line, endColon)
 		line = rStripByKey(line, hashMarker)
+		line, err := removeExtras(line)
+		if err != nil {
+			// Skip only this line: returning an error would drop all packages from the file.
+			p.logger.Debug("Invalid extras in requirements.txt.", log.Int("line_number", lineNumber),
+				log.String("line", text), log.Err(err))
+			continue
+		}
 
 		s := p.splitLine(line)
 		if len(s) != 2 {
@@ -100,7 +106,8 @@ func (p *Parser) Parse(_ context.Context, r xio.ReadSeekerAt) ([]ftypes.Package,
 		}
 
 		if !isValidName(s[0]) || !isValidVersion(s[1]) {
-			p.logger.Debug("Invalid package name/version in requirements.txt.", log.String("line", text))
+			p.logger.Debug("Invalid package name/version in requirements.txt.", log.Int("line_number", lineNumber),
+				log.String("line", text))
 			continue
 		}
 
@@ -128,13 +135,18 @@ func rStripByKey(line, key string) string {
 	return line
 }
 
-func removeExtras(line string) string {
+// removeExtras strips the extras group, e.g. "pyjwt[crypto]==2.1.0" -> "pyjwt==2.1.0".
+// Malformed brackets are rejected with an error, the same way pip does.
+func removeExtras(line string) (string, error) {
 	startIndex := strings.Index(line, startExtras)
-	endIndex := strings.Index(line, endExtras) + 1
-	if startIndex != -1 && endIndex != -1 {
-		line = line[:startIndex] + line[endIndex:]
+	endIndex := strings.Index(line, endExtras)
+	if startIndex == -1 && endIndex == -1 {
+		return line, nil
 	}
-	return line
+	if endIndex < startIndex || strings.Count(line, startExtras) != 1 || strings.Count(line, endExtras) != 1 {
+		return "", xerrors.New("unbalanced extras brackets")
+	}
+	return line[:startIndex] + line[endIndex+1:], nil
 }
 
 // isNameChar reports whether r is a valid character in a PEP 508 package name.
```

**File**: `pkg/dependency/parser/python/pip/parse_test.go` (modified, +82/-0)
```diff
@@ -73,6 +73,11 @@ func TestParse(t *testing.T) {
 			useMinVersion: true,
 			want:          requirementsCompatibleVersions,
 		},
+		{
+			name:     "malformed extras are skipped, brackets in comments are ignored",
+			filePath: "testdata/requirements_invalid_extras.txt",
+			want:     requirementsInvalidExtras,
+		},
 	}
 
 	for _, tt := range tests {
@@ -87,3 +92,80 @@ func TestParse(t *testing.T) {
 		})
 	}
 }
+
+func TestRemoveExtras(t *testing.T) {
+	tests := []struct {
+		name    string
+		line    string
+		want    string
+		wantErr bool
+	}{
+		{
+			name: "single extra",
+			line: "pyjwt[crypto]==2.1.0",
+			want: "pyjwt==2.1.0",
+		},
+		{
+			name: "multiple extras",
+			line: "celery[redis,pytest]==4.4.7",
+			want: "celery==4.4.7",
+		},
+		{
+			name: "empty extras",
+			line: "pkg[]==1.0",
+			want: "pkg==1.0",
+		},
+		{
+			name: "no extras",
+			line: "flask==2.0.0",
+			want: "flask==2.0.0",
+		},
+		{
+			name:    "missing closing bracket",
+			line:    "pkg[extra==1.0",
+			wantErr: true,
+		},
+		{
+			name:    "stray closing bracket without opening",
+			line:    "foo]bar==1.0",
+			wantErr: true,
+		},
+		{
+			name:    "closing bracket before opening",
+			line:    "foo]bar[x]==1.0",
+			wantErr: true,
+		},
+		{
+			name:    "extra closing bracket",
+			line:    "celery[redis]]==4.4.7",
+			wantErr: true,
+		},
+		{
+			name:    "nested brackets",
+			line:    "pkg[a[b]]==1.0",
+			wantErr: true,
+		},
+		{
+			name:    "second extras group",
+			line:    "pkg[a][b]==1.0",
+			wantErr: true,
+		},
+		{
+			name: "empty string",
+			line: "",
+			want: "",
+		},
+	}
+
+	for _, tt := range tests {
+		t.Run(tt.name, func(t *testing.T) {
+			got, err := removeExtras(tt.line)
+			if tt.wantErr {
+				require.ErrorContains(t, err, "unbalanced extras brackets")
+				return
+			}
+			require.NoError(t, err)
+			assert.Equal(t, tt.want, got)
+		})
+	}
+}
```

**File**: `pkg/dependency/parser/python/pip/parse_testcase.go` (modified, +53/-0)
```diff
@@ -321,4 +321,57 @@ var (
 			},
 		},
 	}
+
+	requirementsInvalidExtras = []ftypes.Package{
+		{
+			Name:    "click",
+			Version: "8.0.0",
+			Locations: []ftypes.Location{
+				{
+					StartLine: 1,
+					EndLine:   1,
+				},
+			},
+		},
+		{
+			Name:    "flask",
+			Version: "2.0.0",
+			Locations: []ftypes.Location{
+				{
+					StartLine: 3,
+					EndLine:   3,
+				},
+			},
+		},
+		{
+			Name:    "pyjwt",
+			Version: "2.1.0",
+			Locations: []ftypes.Location{
+				{
+					StartLine: 7,
+					EndLine:   7,
+				},
+			},
+		},
+		{
+			Name:    "Jinja2",
+			Version: "3.0.0",
+			Locations: []ftypes.Location{
+				{
+					StartLine: 10,
+					EndLine:   10,
+				},
+			},
+		},
+		{
+			Name:    "requests",
+			Version: "2.28.0",
+			Locations: []ftypes.Location{
+				{
+					StartLine: 11,
+					EndLine:   11,
+				},
+			},
+		},
+	}
 )
```

**File**: `pkg/dependency/parser/python/pip/testdata/requirements_invalid_extras.txt` (added, +11/-0)
```diff
@@ -0,0 +1,11 @@
+click==8.0.0
+pkg[extra==1.0
+flask==2.0.0 # see [notes
+# ]
+# [section
+foo]bar==1.0
+pyjwt[crypto]==2.1.0
+foo]bar[x]==1.0
+celery[redis]]==4.4.7
+Jinja2==3.0.0 # pinned, see [notes]
+requests[security]==2.28.0 --hash=sha256:[abc
```

---

### Incident Patch 8: `5ba5be05` (2026-09-28)
**Commit Message**: fix: correct grammar and typos in user-facing error messages and CLI flags (#11281)

Signed-off-by: jUDASmILE <[REDACTED_EMAIL]>

**File**: `docs/guide/references/configuration/cli/trivy_config.md` (modified, +8/-8)
```diff
@@ -10,10 +10,10 @@ trivy config [flags] DIR
 
 ```
       --ansible-extra-vars strings        set additional variables as key=value or @file (YAML/JSON)
-      --ansible-inventory strings         specify inventory host path or comma separated host list
+      --ansible-inventory strings         specify inventory host path or a comma-separated host list
       --ansible-playbook strings          specify playbook file path(s) to scan
       --cache-backend string              [EXPERIMENTAL] cache backend (e.g. redis://localhost:6379) (default "memory")
-      --cache-ttl duration                cache TTL when using redis as cache backend
+      --cache-ttl duration                cache TTL when using Redis as cache backend
       --cf-params strings                 specify paths to override the CloudFormation parameters files
       --check-namespaces strings          Rego namespaces
       --checks-bundle-repository string   OCI registry URL to retrieve checks bundle from (default "mirror.gcr.io/aquasec/trivy-checks:2")
@@ -48,18 +48,18 @@ trivy config [flags] DIR
       --ignorefile string                 specify .trivyignore file (empty string disables loading) (default ".trivyignore")
       --include-deprecated-checks         include deprecated checks
       --include-non-failures              include successes, available with '--scanners misconfig'
-      --k8s-version string                specify k8s version to validate outdated api by it (example: 1.21.0)
+      --k8s-version string                specify k8s version to validate outdated APIs against (example: 1.21.0)
       --misconfig-scanners strings        comma-separated list of misconfig scanners to use for misconfiguration scanning (default [azure-arm,cloudformation,dockerfile,helm,kubernetes,terraform,terraformplan-json,terraformplan-snapshot,ansible])
-      --module-dir string                 specify directory to the wasm modules that will be loaded (default "$HOME/.trivy/modules")
+      --module-dir string                 specify the directory of the WASM modules to load (default "$HOME/.trivy/modules")
   -o, --output string                     output file name
       --output-plugin-arg string          [EXPERIMENTAL] output plugin arguments
       --password strings                  password. Comma-separated passwords allowed. TRIVY_PASSWORD should be used for security reasons.
       --password-stdin                    password from stdin. Comma-separated passwords are not supported.
       --raw-config-scanners strings       specify the types of scanners that will also scan raw configurations. For example, scanners will scan a non-adapted configuration into a shared state (allowed values: terraform)
-      --redis-ca string                   redis ca file location, if using redis as cache backend
-      --redis-cert string                 redis certificate file location, if using redis as cache backend
-      --redis-key string                  redis key file location, if using redis as cache backend
-      --redis-tls                         enable redis TLS with public certificates, if using redis as cache backend
+      --redis-ca string                   Redis CA file location, if using Redis as cache backend
+      --redis-cert string                 Redis certificate file location, if using Redis as cache backend
+      --redis-key string                  Redis key file location, if using Redis as cache backend
+      --redis-tls                         enable Redis TLS with public certificates, if using Redis as cache backend
       --registry-token string             registry token
       --rego-error-limit int              maximum number of compile errors allowed during Rego policy evaluation (default 10)
       --render-cause strings              specify configuration types for which the rendered causes will be shown in the table report (allowed values: terraform,ansible)
```

**File**: `docs/guide/references/configuration/cli/trivy_filesystem.md` (modified, +10/-10)
```diff
@@ -20,10 +20,10 @@ trivy filesystem [flags] PATH
 
 ```
       --ansible-extra-vars strings        set additional variables as key=value or @file (YAML/JSON)
-      --ansible-inventory strings         specify inventory host path or comma separated host list
+      --ansible-inventory strings         specify inventory host path or a comma-separated host list
       --ansible-playbook strings          specify playbook file path(s) to scan
       --cache-backend string              [EXPERIMENTAL] cache backend (e.g. redis://localhost:6379) (default "memory")
-      --cache-ttl duration                cache TTL when using redis as cache backend
+      --cache-ttl duration                cache TTL when using Redis as cache backend
       --cf-params strings                 specify paths to override the CloudFormation parameters files
       --check-namespaces strings          Rego namespaces
       --checks-bundle-repository string   OCI registry URL to retrieve checks bundle from (default "mirror.gcr.io/aquasec/trivy-checks:2")
@@ -65,7 +65,7 @@ trivy filesystem [flags] PATH
       --helm-values strings               specify paths to override the Helm values.yaml files
   -h, --help                              help for filesystem
       --ignore-policy string              specify the Rego file path to evaluate each vulnerability
-      --ignore-status strings             comma-separated list of vulnerability status to ignore
+      --ignore-status strings             comma-separated list of vulnerability statuses to ignore
                                           Allowed values:
                                             - unknown
                                             - not_affected
@@ -76,7 +76,7 @@ trivy filesystem [flags] PATH
                                             - fix_deferred
                                             - end_of_life
       --ignore-unfixed                    display only fixed vulnerabilities
-      --ignored-licenses strings          specify a list of license to ignore
+      --ignored-licenses strings          specify a list of licenses to ignore
       --ignorefile string                 specify .trivyignore file (empty string disables loading) (default ".trivyignore")
       --include-deprecated-checks         include deprecated checks
       --include-dev-deps                  include development dependencies in the report (supported: npm, yarn, gradle)
@@ -86,7 +86,7 @@ trivy filesystem [flags] PATH
       --license-full                      eagerly look for licenses in source code headers and license files
       --list-all-pkgs                     output all packages in the JSON report regardless of vulnerability (default true)
       --misconfig-scanners strings        comma-separated list of misconfig scanners to use for misconfiguration scanning (default [azure-arm,cloudformation,dockerfile,helm,kubernetes,terraform,terraformplan-json,terraformplan-snapshot,ansible])
-      --module-dir string                 specify directory to the wasm modules that will be loaded (default "$HOME/.trivy/modules")
+      --module-dir string                 specify the directory of the WASM modules to load (default "$HOME/.trivy/modules")
       --no-progress                       suppress progress bar
       --offline-scan                      do not issue API requests to identify dependencies
   -o, --output string                     output file name
@@ -104,10 +104,10 @@ trivy filesystem [flags] PATH
                                            (default [unknown,root,workspace,direct,indirect])
       --pkg-types strings                 list of package types (allowed values: os,library) (default [os,library])
       --raw-config-scanners strings       specify the types of scanners that will also scan raw configurations. For example, scanners will scan a non-adapted configuration into a shared state (allowed values: terraform)
-      --redis-ca string                   redis ca file location, if using redis as cache backend
-      --redis-cert string                 redis certificate file location, if using redis as cache backend
-      --redis-key string                  redis key file location, if using redis as cache backend
-      --redis-tls                         enable redis TLS with public certificates, if using redis as cache backend
+      --redis-ca string                   Redis CA file location, if using Redis as cache backend
+      --redis-cert string                 Redis certificate file location, if using Redis as cache backend
+      --redis-key string                  Redis key file location, if using Redis as cache backend
+      --redis-tls                         enable Redis TLS with public certificates, if using Redis as cache backend
       --registry-token string             registry token
       --rego-error-limit int              maximum number of compile errors allowed during Rego policy evaluation (default 10)
       --rekor-url string     
```

**File**: `docs/guide/references/configuration/cli/trivy_image.md` (modified, +10/-10)
```diff
@@ -35,10 +35,10 @@ trivy image [flags] IMAGE_NAME
 
 ```
       --ansible-extra-vars strings        set additional variables as key=value or @file (YAML/JSON)
-      --ansible-inventory strings         specify inventory host path or comma separated host list
+      --ansible-inventory strings         specify inventory host path or a comma-separated host list
       --ansible-playbook strings          specify playbook file path(s) to scan
       --cache-backend string              [EXPERIMENTAL] cache backend (e.g. redis://localhost:6379) (default "fs")
-      --cache-ttl duration                cache TTL when using redis as cache backend
+      --cache-ttl duration                cache TTL when using Redis as cache backend
       --check-namespaces strings          Rego namespaces
       --checks-bundle-repository string   OCI registry URL to retrieve checks bundle from (default "mirror.gcr.io/aquasec/trivy-checks:2")
       --compliance string                 compliance report to generate (built-in compliance's: docker-cis-1.6.0)
@@ -81,7 +81,7 @@ trivy image [flags] IMAGE_NAME
       --helm-values strings               specify paths to override the Helm values.yaml files
   -h, --help                              help for image
       --ignore-policy string              specify the Rego file path to evaluate each vulnerability
-      --ignore-status strings             comma-separated list of vulnerability status to ignore
+      --ignore-status strings             comma-separated list of vulnerability statuses to ignore
                                           Allowed values:
                                             - unknown
                                             - not_affected
@@ -92,7 +92,7 @@ trivy image [flags] IMAGE_NAME
                                             - fix_deferred
                                             - end_of_life
       --ignore-unfixed                    display only fixed vulnerabilities
-      --ignored-licenses strings          specify a list of license to ignore
+      --ignored-licenses strings          specify a list of licenses to ignore
       --ignorefile string                 specify .trivyignore file (empty string disables loading) (default ".trivyignore")
       --image-config-scanners strings     comma-separated list of what security issues to detect on container image configurations (allowed values: misconfig,secret)
       --image-src strings                 image source(s) to use, in priority order (allowed values: docker,containerd,podman,remote) (default [docker,containerd,podman,remote])
@@ -105,7 +105,7 @@ trivy image [flags] IMAGE_NAME
       --list-all-pkgs                     output all packages in the JSON report regardless of vulnerability (default true)
       --max-image-size string             [EXPERIMENTAL] maximum image size to process, specified in a human-readable format (e.g., '44kB', '17MB'); an error will be returned if the image exceeds this size
       --misconfig-scanners strings        comma-separated list of misconfig scanners to use for misconfiguration scanning (default [azure-arm,cloudformation,dockerfile,helm,kubernetes,terraform,terraformplan-json,terraformplan-snapshot,ansible])
-      --module-dir string                 specify directory to the wasm modules that will be loaded (default "$HOME/.trivy/modules")
+      --module-dir string                 specify the directory of the WASM modules to load (default "$HOME/.trivy/modules")
       --no-progress                       suppress progress bar
       --offline-scan                      do not issue API requests to identify dependencies
   -o, --output string                     output file name
@@ -125,10 +125,10 @@ trivy image [flags] IMAGE_NAME
       --platform string                   set platform in the form os/arch if image is multi-platform capable
       --podman-host string                unix podman socket path to use for podman scanning
       --raw-config-scanners strings       specify the types of scanners that will also scan raw configurations. For example, scanners will scan a non-adapted configuration into a shared state (allowed values: terraform)
-      --redis-ca string                   redis ca file location, if using redis as cache backend
-      --redis-cert string                 redis certificate file location, if using redis as cache backend
-      --redis-key string                  redis key file location, if using redis as cache backend
-      --redis-tls                         enable redis TLS with public certificates, if using redis as cache backend
+      --redis-ca string                   Redis CA file location, if using Redis as cache backend
+      --redis-cert string                 Redis certificate file location, if using Redis as cache backend
+      --redis-key string                  Redis key file location, if using Redis as cache backend
+      --redis-tls                         enable Redis TLS with public certifi
```

**File**: `docs/guide/references/configuration/cli/trivy_kubernetes.md` (modified, +10/-10)
```diff
@@ -30,11 +30,11 @@ trivy kubernetes [flags] [CONTEXT]
 
 ```
       --ansible-extra-vars strings        set additional variables as key=value or @file (YAML/JSON)
-      --ansible-inventory strings         specify inventory host path or comma separated host list
+      --ansible-inventory strings         specify inventory host path or a comma-separated host list
       --ansible-playbook strings          specify playbook file path(s) to scan
       --burst int                         specify the maximum burst for throttle (default 10)
       --cache-backend string              [EXPERIMENTAL] cache backend (e.g. redis://localhost:6379) (default "fs")
-      --cache-ttl duration                cache TTL when using redis as cache backend
+      --cache-ttl duration                cache TTL when using Redis as cache backend
       --check-namespaces strings          Rego namespaces
       --checks-bundle-repository string   OCI registry URL to retrieve checks bundle from (default "mirror.gcr.io/aquasec/trivy-checks:2")
       --compliance string                 compliance report to generate
@@ -59,7 +59,7 @@ trivy kubernetes [flags] [CONTEXT]
       --distro string                     [EXPERIMENTAL] specify a distribution, <family>/<version>
       --download-db-only                  download/update vulnerability database but don't run a scan
       --download-java-db-only             download/update Java index database but don't run a scan
-      --exclude-kinds strings             indicate the kinds exclude from scanning (example: node)
+      --exclude-kinds strings             indicate the kinds excluded from scanning (example: node)
       --exclude-namespaces strings        indicate the namespaces excluded from scanning (example: kube-system)
       --exclude-nodes strings             indicate the node labels that the node-collector job should exclude from scanning (example: kubernetes.io/arch:arm64,team:dev)
       --exclude-owned                     exclude resources that have an owner reference
@@ -74,7 +74,7 @@ trivy kubernetes [flags] [CONTEXT]
       --helm-values strings               specify paths to override the Helm values.yaml files
   -h, --help                              help for kubernetes
       --ignore-policy string              specify the Rego file path to evaluate each vulnerability
-      --ignore-status strings             comma-separated list of vulnerability status to ignore
+      --ignore-status strings             comma-separated list of vulnerability statuses to ignore
                                           Allowed values:
                                             - unknown
                                             - not_affected
@@ -92,7 +92,7 @@ trivy kubernetes [flags] [CONTEXT]
       --include-namespaces strings        indicate the namespaces included in scanning (example: kube-system)
       --include-non-failures              include successes, available with '--scanners misconfig'
       --java-db-repository strings        OCI repository(ies) to retrieve trivy-java-db in order of priority (default [mirror.gcr.io/aquasec/trivy-java-db:1,ghcr.io/aquasecurity/trivy-java-db:1])
-      --k8s-version string                specify k8s version to validate outdated api by it (example: 1.21.0)
+      --k8s-version string                specify k8s version to validate outdated APIs against (example: 1.21.0)
       --kubeconfig string                 specify the kubeconfig file path to use
       --list-all-pkgs                     output all packages in the JSON report regardless of vulnerability (default true)
       --misconfig-scanners strings        comma-separated list of misconfig scanners to use for misconfiguration scanning (default [azure-arm,cloudformation,dockerfile,helm,kubernetes,terraform,terraformplan-json,terraformplan-snapshot,ansible])
@@ -116,10 +116,10 @@ trivy kubernetes [flags] [CONTEXT]
       --pkg-types strings                 list of package types (allowed values: os,library) (default [os,library])
       --qps float                         specify the maximum QPS to the master from this client (default 5)
       --raw-config-scanners strings       specify the types of scanners that will also scan raw configurations. For example, scanners will scan a non-adapted configuration into a shared state (allowed values: terraform)
-      --redis-ca string                   redis ca file location, if using redis as cache backend
-      --redis-cert string                 redis certificate file location, if using redis as cache backend
-      --redis-key string                  redis key file location, if using redis as cache backend
-      --redis-tls                         enable redis TLS with public certificates, if using redis as cache backend
+      --redis-ca string                   Redis CA file location, if using Redis as cache backend
+      --redis-cert string                 Redis certificate file location, if using Redis as cache backend
```

**File**: `docs/guide/references/configuration/cli/trivy_module.md` (modified, +1/-1)
```diff
@@ -7,7 +7,7 @@ Manage modules
 ```
       --enable-modules strings   [EXPERIMENTAL] module names to enable
   -h, --help                     help for module
-      --module-dir string        specify directory to the wasm modules that will be loaded (default "$HOME/.trivy/modules")
+      --module-dir string        specify the directory of the WASM modules to load (default "$HOME/.trivy/modules")
 ```
 
 ### Options inherited from parent commands
```

**File**: `docs/guide/references/configuration/cli/trivy_module_install.md` (modified, +1/-1)
```diff
@@ -22,7 +22,7 @@ trivy module install [flags] REPOSITORY
       --enable-modules strings    [EXPERIMENTAL] module names to enable
       --generate-default-config   write the default config to trivy-default.yaml
       --insecure                  allow insecure server connections
-      --module-dir string         specify directory to the wasm modules that will be loaded (default "$HOME/.trivy/modules")
+      --module-dir string         specify the directory of the WASM modules to load (default "$HOME/.trivy/modules")
   -q, --quiet                     suppress progress bar and log output
       --timeout duration          timeout (default 5m0s)
   -v, --version                   show version
```

**File**: `docs/guide/references/configuration/cli/trivy_module_uninstall.md` (modified, +1/-1)
```diff
@@ -22,7 +22,7 @@ trivy module uninstall [flags] REPOSITORY
       --enable-modules strings    [EXPERIMENTAL] module names to enable
       --generate-default-config   write the default config to trivy-default.yaml
       --insecure                  allow insecure server connections
-      --module-dir string         specify directory to the wasm modules that will be loaded (default "$HOME/.trivy/modules")
+      --module-dir string         specify the directory of the WASM modules to load (default "$HOME/.trivy/modules")
   -q, --quiet                     suppress progress bar and log output
       --timeout duration          timeout (default 5m0s)
   -v, --version                   show version
```

**File**: `docs/guide/references/configuration/cli/trivy_repository.md` (modified, +10/-10)
```diff
@@ -19,11 +19,11 @@ trivy repository [flags] (REPO_PATH | REPO_URL)
 
 ```
       --ansible-extra-vars strings        set additional variables as key=value or @file (YAML/JSON)
-      --ansible-inventory strings         specify inventory host path or comma separated host list
+      --ansible-inventory strings         specify inventory host path or a comma-separated host list
       --ansible-playbook strings          specify playbook file path(s) to scan
       --branch string                     pass the branch name to be scanned
       --cache-backend string              [EXPERIMENTAL] cache backend (e.g. redis://localhost:6379) (default "fs")
-      --cache-ttl duration                cache TTL when using redis as cache backend
+      --cache-ttl duration                cache TTL when using Redis as cache backend
       --cf-params strings                 specify paths to override the CloudFormation parameters files
       --check-namespaces strings          Rego namespaces
       --checks-bundle-repository string   OCI registry URL to retrieve checks bundle from (default "mirror.gcr.io/aquasec/trivy-checks:2")
@@ -64,7 +64,7 @@ trivy repository [flags] (REPO_PATH | REPO_URL)
       --helm-values strings               specify paths to override the Helm values.yaml files
   -h, --help                              help for repository
       --ignore-policy string              specify the Rego file path to evaluate each vulnerability
-      --ignore-status strings             comma-separated list of vulnerability status to ignore
+      --ignore-status strings             comma-separated list of vulnerability statuses to ignore
                                           Allowed values:
                                             - unknown
                                             - not_affected
@@ -75,7 +75,7 @@ trivy repository [flags] (REPO_PATH | REPO_URL)
                                             - fix_deferred
                                             - end_of_life
       --ignore-unfixed                    display only fixed vulnerabilities
-      --ignored-licenses strings          specify a list of license to ignore
+      --ignored-licenses strings          specify a list of licenses to ignore
       --ignorefile string                 specify .trivyignore file (empty string disables loading) (default ".trivyignore")
       --include-deprecated-checks         include deprecated checks
       --include-dev-deps                  include development dependencies in the report (supported: npm, yarn, gradle)
@@ -85,7 +85,7 @@ trivy repository [flags] (REPO_PATH | REPO_URL)
       --license-full                      eagerly look for licenses in source code headers and license files
       --list-all-pkgs                     output all packages in the JSON report regardless of vulnerability (default true)
       --misconfig-scanners strings        comma-separated list of misconfig scanners to use for misconfiguration scanning (default [azure-arm,cloudformation,dockerfile,helm,kubernetes,terraform,terraformplan-json,terraformplan-snapshot,ansible])
-      --module-dir string                 specify directory to the wasm modules that will be loaded (default "$HOME/.trivy/modules")
+      --module-dir string                 specify the directory of the WASM modules to load (default "$HOME/.trivy/modules")
       --no-progress                       suppress progress bar
       --offline-scan                      do not issue API requests to identify dependencies
   -o, --output string                     output file name
@@ -103,10 +103,10 @@ trivy repository [flags] (REPO_PATH | REPO_URL)
                                            (default [unknown,root,workspace,direct,indirect])
       --pkg-types strings                 list of package types (allowed values: os,library) (default [os,library])
       --raw-config-scanners strings       specify the types of scanners that will also scan raw configurations. For example, scanners will scan a non-adapted configuration into a shared state (allowed values: terraform)
-      --redis-ca string                   redis ca file location, if using redis as cache backend
-      --redis-cert string                 redis certificate file location, if using redis as cache backend
-      --redis-key string                  redis key file location, if using redis as cache backend
-      --redis-tls                         enable redis TLS with public certificates, if using redis as cache backend
+      --redis-ca string                   Redis CA file location, if using Redis as cache backend
+      --redis-cert string                 Redis certificate file location, if using Redis as cache backend
+      --redis-key string                  Redis key file location, if using Redis as cache backend
+      --redis-tls                         enable Redis TLS with public certificates, if using Redis as cache backend
       --registry-token string             registry
```

---

### Incident Patch 9: `ae561f8c` (2026-09-25)
**Commit Message**: fix(vex): avoid panic on CSAF relationships without a sub-component (#11067)

**File**: `pkg/vex/csaf.go` (modified, +7/-0)
```diff
@@ -92,6 +92,13 @@ func (v *CSAF) matchProduct(productID csaf.ProductID, product *core.Component) b
 func (v *CSAF) matchRelationship(fullProductID csaf.ProductID, product, subProduct *core.Component) (
 	csaf.RelationshipCategory, bool) {
 
+	// A relationship describes a sub-component within a product, so it can only match
+	// when a sub-component is given. subProduct is nil when a component is evaluated
+	// on its own (see reachRoot).
+	if subProduct == nil {
+		return "", false
+	}
+
 	for category, relationships := range v.inspectProductRelationships(fullProductID) {
 		for _, rel := range relationships {
 			if !rel.Product.Match(product.PkgIdentifier.PURL) {
```

**File**: `pkg/vex/vex_test.go` (modified, +32/-0)
```diff
@@ -184,6 +184,13 @@ var (
 		InstalledVersion: goTransitivePackage.Version,
 		PkgIdentifier:    goTransitivePackage.Identifier,
 	}
+	// CVE-2024-0001 detected on go-direct1
+	vuln6 = types.DetectedVulnerability{
+		VulnerabilityID:  "CVE-2024-0001",
+		PkgName:          goDirectPackage1.Name,
+		InstalledVersion: goDirectPackage1.Version,
+		PkgIdentifier:    goDirectPackage1.Identifier,
+	}
 )
 
 func TestMain(m *testing.M) {
@@ -540,6 +547,31 @@ func TestFilter(t *testing.T) {
 				}),
 			}),
 		},
+		{
+			name: "CSAF with relationships, vulnerability on the parent product, not the sub-component",
+			args: args{
+				// The statement covers go-transitive as a component of go-direct1,
+				// while the vulnerability is detected on go-direct1 itself.
+				report: imageReport([]types.Result{
+					goSinglePathResult(types.Result{
+						Vulnerabilities: []types.DetectedVulnerability{vuln6},
+					}),
+				}),
+				opts: vex.Options{
+					Sources: []vex.Source{
+						{
+							Type:     vex.TypeFile,
+							FilePath: "testdata/csaf-relationships.json",
+						},
+					},
+				},
+			},
+			want: imageReport([]types.Result{
+				goSinglePathResult(types.Result{
+					Vulnerabilities: []types.DetectedVulnerability{vuln6}, // The statement doesn't apply to the product itself
+				}),
+			}),
+		},
 		{
 			name: "VEX Repository",
 			setup: func(t *testing.T, tmpDir string) {
```

---

### Incident Patch 10: `0aaaa717` (2026-09-21)
**Commit Message**: fix(sbom): skip null entries in SPDX file and package arrays (#11101)

Signed-off-by: Arpit Jain <[REDACTED_EMAIL]>

**File**: `pkg/sbom/spdx/testdata/happy/null-file-entry.json` (added, +17/-0)
```diff
@@ -0,0 +1,17 @@
+{
+	"SPDXID": "SPDXRef-DOCUMENT",
+	"spdxVersion": "SPDX-2.3",
+	"creationInfo": {
+		"created": "2022-09-12T17:03:35.840861Z",
+		"creators": [
+			"Tool: trivy-dev",
+			"Organization: aquasecurity"
+		]
+	},
+	"dataLicense": "CC0-1.0",
+	"documentNamespace": "http://trivy.dev/container/null-file-entry",
+	"name": "null-file-entry",
+	"files": [
+		null
+	]
+}
```

**File**: `pkg/sbom/spdx/unmarshal.go` (modified, +10/-3)
```diff
@@ -108,9 +108,12 @@ func (s *SPDX) unmarshal(spdxDocument *spdx.Document) error {
 
 // parseFiles parses Relationships and finds filepaths for packages
 func (s *SPDX) parseFiles(spdxDocument *spdx.Document) {
-	fileSPDXIdentifierMap := lo.SliceToMap(spdxDocument.Files, func(file *spdx.File) (common.ElementID, *spdx.File) {
-		return file.FileSPDXIdentifier, file
-	})
+	// A null element in the files array decodes to a nil pointer.
+	fileSPDXIdentifierMap := lo.SliceToMap(
+		lo.Filter(spdxDocument.Files, func(file *spdx.File, _ int) bool { return file != nil }),
+		func(file *spdx.File) (common.ElementID, *spdx.File) {
+			return file.FileSPDXIdentifier, file
+		})
 
 	for _, rel := range spdxDocument.Relationships {
 		if rel.Relationship != common.TypeRelationshipContains && rel.Relationship != "CONTAIN" {
@@ -150,6 +153,10 @@ func (s *SPDX) parsePackages(spdxDocument *spdx.Document) (map[common.ElementID]
 	// Convert packages into components
 	components := make(map[common.ElementID]*core.Component)
 	for _, pkg := range spdxDocument.Packages {
+		// A null element in the packages array decodes to a nil pointer.
+		if pkg == nil {
+			continue
+		}
 		component, err := s.parsePackage(*pkg)
 		if err != nil {
 			return nil, xerrors.Errorf("failed to parse package: %w", err)
```

**File**: `pkg/sbom/spdx/unmarshal_test.go` (modified, +6/-0)
```diff
@@ -340,6 +340,12 @@ func TestUnmarshaler_Unmarshal(t *testing.T) {
 			inputFile: "testdata/happy/empty-bom.json",
 			want:      types.SBOM{},
 		},
+		{
+			// a null element in an array decodes to a nil pointer
+			name:      "happy path with a null file entry",
+			inputFile: "testdata/happy/null-file-entry.json",
+			want:      types.SBOM{},
+		},
 		{
 			name:      "sad path invalid purl",
 			inputFile: "testdata/sad/invalid-purl.json",
```

---

### Incident Patch 11: `7a6433aa` (2026-09-21)
**Commit Message**: docs: link security reporting guidance to relevant documentation (#11235)

**File**: `SECURITY.md` (modified, +11/-0)
```diff
@@ -7,6 +7,17 @@ As such, there is no supportability commitment. The maintainers will do the best
 
 ## Reporting a Vulnerability
 
+Before submitting a report, please review the [project scope and principles](https://trivy.dev/docs/latest/community/principles/#intentional-attacks) and the relevant security considerations:
+
+- [Configuration files](https://trivy.dev/docs/latest/guide/configuration/#security-considerations)
+- [Report templates](https://trivy.dev/docs/latest/guide/configuration/reporting/#custom-template)
+- [Client/server deployments](https://trivy.dev/docs/latest/guide/references/modes/client-server/#security-considerations)
+- [Plugins](https://trivy.dev/docs/latest/guide/plugin/#security-considerations) and [modules](https://trivy.dev/docs/latest/guide/advanced/modules/#overview)
+- [Terraform remote modules](https://trivy.dev/docs/latest/guide/coverage/iac/terraform/#remote-modules) and [filesystem functions](https://trivy.dev/docs/latest/guide/coverage/iac/terraform/#filesystem-functions)
+- [Registry credentials](https://trivy.dev/docs/latest/guide/advanced/private-registries/#passing-credentials) and [Maven mirror credentials](https://trivy.dev/docs/latest/guide/coverage/language/java/#config-file-mirrors)
+- [VEX attestations](https://trivy.dev/docs/latest/guide/supply-chain/vex/oci/#step-3-use-vex-attestation-with-trivy)
+- [HTTP request/response tracing](https://trivy.dev/docs/latest/guide/references/troubleshooting/#http-requestresponse-tracing)
+
 Please use the "Private vulnerability reporting" feature in the GitHub repository (under the "Security" tab).  
 
 ⚠️ **Important:**  
```

---

### Incident Patch 12: `d7708cfa` (2026-09-21)
**Commit Message**: docs(misconf): clarify custom check security considerations (#11278)

**File**: `docs/guide/configuration/index.md` (modified, +2/-0)
```diff
@@ -58,3 +58,5 @@ trivy fs --config /opt/ci/trivy.yaml --ignorefile="" --secret-config="" /workspa
 ```
 
 Templates and other files referenced by the configuration must also come from trusted sources. A trusted configuration file can still reference an untrusted template: relative template paths are resolved from the current working directory, not the configuration file's directory. Use trusted absolute template paths when the working directory contains untrusted content. Templates can read environment variables and include sensitive values in report output.
+
+For custom Rego checks selected by the configuration, see the [custom check security considerations](../scanner/misconfiguration/custom/index.md#security-considerations).
```

**File**: `docs/guide/scanner/misconfiguration/custom/index.md` (modified, +6/-0)
```diff
@@ -31,6 +31,12 @@ In the above general file formats, Trivy automatically identifies the following
 
 This is useful for filtering inputs, as described below.
 
+## Security considerations
+
+Only load custom checks from sources you trust. Checks can access the Trivy process's environment variables and make HTTP requests.
+
+In CI, use checks and configuration maintained by the pipeline owners. Changes in the repository being scanned should not be able to replace those checks or select different ones.
+
 ## Rego format
 A single package must contain only one policy.
 
```

---

### Incident Patch 13: `7b598ab7` (2026-09-21)
**Commit Message**: fix(license): report unparsable license names with UNKNOWN severity (#11254)

**File**: `integration/testdata/fixtures/sbom/license-cyclonedx.json` (modified, +25/-0)
```diff
@@ -118,6 +118,31 @@
           "value": "pom"
         }
       ]
+    },
+    {
+      "bom-ref": "pkg:maven/javax.servlet/javax.servlet-api@4.0.1",
+      "type": "library",
+      "group": "javax.servlet",
+      "name": "javax.servlet-api",
+      "version": "4.0.1",
+      "licenses": [
+        {
+          "license": {
+            "name": "CDDL + GPLv2 with classpath exception"
+          }
+        }
+      ],
+      "purl": "pkg:maven/javax.servlet/javax.servlet-api@4.0.1",
+      "properties": [
+        {
+          "name": "aquasecurity:trivy:PkgID",
+          "value": "javax.servlet:javax.servlet-api:4.0.1"
+        },
+        {
+          "name": "aquasecurity:trivy:PkgType",
+          "value": "pom"
+        }
+      ]
     }
   ],
   "dependencies": [],
```

**File**: `integration/testdata/license-cyclonedx.json.golden` (modified, +10/-0)
```diff
@@ -12,6 +12,16 @@
       "Target": "Java",
       "Class": "license",
       "Licenses": [
+        {
+          "Severity": "UNKNOWN",
+          "Category": "unknown",
+          "PkgName": "javax.servlet:javax.servlet-api",
+          "FilePath": "",
+          "Name": "CDDL + GPLv2 with classpath exception",
+          "Text": "",
+          "Confidence": 1,
+          "Link": ""
+        },
         {
           "Severity": "MEDIUM",
           "Category": "reciprocal",
```

**File**: `pkg/licensing/scanner.go` (modified, +1/-1)
```diff
@@ -28,7 +28,7 @@ func NewScanner(categories map[types.LicenseCategory][]string) Scanner {
 func (s *Scanner) Scan(licenseName string) (types.LicenseCategory, string) {
 	expr, err := expression.Normalize(licenseName, NormalizeLicenseExpression)
 	if err != nil {
-		return types.CategoryUnknown, ""
+		return types.CategoryUnknown, dbTypes.SeverityUnknown.String()
 	}
 	category := s.detectCategory(expr)
 
```

**File**: `pkg/licensing/scanner_test.go` (modified, +11/-0)
```diff
@@ -167,6 +167,17 @@ func TestScanner_Scan(t *testing.T) {
 			wantCategory: types.CategoryUnknown,
 			wantSeverity: "UNKNOWN",
 		},
+		{
+			name: "unparsable license name",
+			categories: map[types.LicenseCategory][]string{
+				types.CategoryReciprocal: {
+					expression.CDDL10,
+				},
+			},
+			licenseName:  "CDDL + GPLv2 with classpath exception",
+			wantCategory: types.CategoryUnknown,
+			wantSeverity: "UNKNOWN",
+		},
 		{
 			// `Unlicensed` is a special license name in npm.
 			// It means the developer does not grant anyone the right to use the private or unpublished package under any circumstances.
```

**File**: `pkg/scan/local/service.go` (modified, +8/-0)
```diff
@@ -314,6 +314,10 @@ func (s Service) scanOSPackageLicenses(packages []ftypes.Package, scanner licens
 	var licenses []types.DetectedLicense
 	for _, pkg := range packages {
 		for _, license := range pkg.Licenses {
+			// A license without a name can't be evaluated, so don't report it.
+			if strings.TrimSpace(license) == "" {
+				continue
+			}
 			licenses = append(licenses, toDetectedLicense(scanner, license, pkg.Name, ""))
 		}
 	}
@@ -331,6 +335,10 @@ func (s Service) scanApplicationLicenses(apps []ftypes.Application, scanner lice
 		var langLicenses []types.DetectedLicense
 		for _, lib := range app.Packages {
 			for _, license := range lib.Licenses {
+				// A license without a name can't be evaluated, so don't report it.
+				if strings.TrimSpace(license) == "" {
+					continue
+				}
 				// Lock files use app.FilePath - https://github.com/aquasecurity/trivy/blob/6ccc0a554b07b05fd049f882a1825a0e1e0aabe1/pkg/fanal/types/artifact.go#L245-L246
 				// Applications use lib.FilePath - https://github.com/aquasecurity/trivy/blob/6ccc0a554b07b05fd049f882a1825a0e1e0aabe1/pkg/fanal/types/artifact.go#L93-L94
 				filePath := lo.Ternary(lib.FilePath != "", lib.FilePath, app.FilePath)
```

**File**: `pkg/scan/local/service_test.go` (modified, +2/-2)
```diff
@@ -52,7 +52,7 @@ var (
 		Version:    "1.1-2build1.1",
 		SrcName:    "libunistring5",
 		SrcVersion: "1.1-2build1.1",
-		Licenses:   []string{"GFDL-NIV-1.2+"},
+		Licenses:   []string{"GFDL-NIV-1.2+", ""}, // Licenses without a name are skipped
 	}
 	railsPkg = ftypes.Package{
 		Name:    "rails",
@@ -91,7 +91,7 @@ var (
 		Layer: ftypes.Layer{
 			DiffID: "sha256:0ea33a93585cf1917ba522b2304634c3073654062d5282c1346322967790ef33",
 		},
-		Licenses: []string{"LGPL"},
+		Licenses: []string{"LGPL", " "}, // Licenses without a name are skipped
 	}
 	urllib3Pkg = ftypes.Package{
 		Name:     "urllib3",
```

---

### Incident Patch 14: `ef28d95f` (2026-09-17)
**Commit Message**: fix: avoid panics on malformed dependency files and version-less Amazon Linux release (#10996)

Signed-off-by: Akshita <[REDACTED_EMAIL]>

**File**: `pkg/dependency/parser/hex/mix/parse.go` (modified, +6/-0)
```diff
@@ -43,6 +43,12 @@ func (p *Parser) Parse(_ context.Context, r xio.ReadSeekerAt) ([]ftypes.Package,
 		ss := strings.FieldsFunc(body, func(r rune) bool {
 			return unicode.IsSpace(r) || r == ','
 		})
+		if len(ss) == 0 {
+			// An entry with nothing after the colon, e.g. `"bunt":`
+			// cf. #10976
+			p.logger.Warn("Cannot parse dependency", log.String("line", line))
+			continue
+		}
 		if len(ss) < 8 { // In the case where <required deps> array is empty: s == 8, in other cases s > 8
 			// git repository doesn't have dependency version
 			// skip these dependencies
```

**File**: `pkg/dependency/parser/hex/mix/parse_test.go` (modified, +7/-0)
```diff
@@ -72,6 +72,13 @@ func TestParser_Parse(t *testing.T) {
 			inputFile: "testdata/empty.mix.lock",
 			want:      nil,
 		},
+		{
+			// An entry with nothing after the colon carries no version,
+			// so it is skipped. cf. #10976
+			name:      "no fields",
+			inputFile: "testdata/no-fields.mix.lock",
+			want:      nil,
+		},
 	}
 
 	for _, tt := range tests {
```

**File**: `pkg/dependency/parser/hex/mix/testdata/no-fields.mix.lock` (added, +3/-0)
```diff
@@ -0,0 +1,3 @@
+%{
+  "bunt":
+}
```

**File**: `pkg/dependency/parser/python/pyproject/pyproject.go` (modified, +7/-1)
```diff
@@ -75,8 +75,14 @@ func (d *Dependencies) UnmarshalTOML(data any) error {
 			// There are some formats:
 			// e.g. `Flask == 1.1.4`, `Flask==1.1.4`, `Flask(>= 1.0.0)`, `pluggy[pre-commit,tox] (==0.13.1)`, etc.
 			dep = strings.NewReplacer(">", " ", "<", " ", "=", " ", "(", " ", "[", " ").Replace(dep)
+			fields := strings.Fields(dep)
+			if len(fields) == 0 {
+				// An entry that carries no name, e.g. `dependencies = [""]`.
+				// cf. #10976
+				continue
+			}
 			// Save only the name, normalized (PEP 503) to match the names from poetry.lock/pylock.toml.
-			d.Set.Append(python.NormalizePkgName(strings.Fields(dep)[0], true))
+			d.Set.Append(python.NormalizePkgName(fields[0], true))
 		}
 	default:
 		return xerrors.Errorf("dependencies must be map, but got: %T", data)
```

**File**: `pkg/dependency/parser/python/pyproject/pyproject_test.go` (modified, +14/-0)
```diff
@@ -120,6 +120,20 @@ func TestParser_Parse(t *testing.T) {
 			},
 			wantErr: assert.NoError,
 		},
+		{
+			// A dependency entry that carries no name is skipped.
+			// cf. #10976
+			name: "empty dependency",
+			file: "testdata/empty_dep.toml",
+			want: pyproject.PyProject{
+				Project: pyproject.Project{
+					Dependencies: pyproject.Dependencies{
+						Set: set.New[string]("flask"),
+					},
+				},
+			},
+			wantErr: assert.NoError,
+		},
 		{
 			name:    "sad path",
 			file:    "testdata/sad.toml",
```

**File**: `pkg/dependency/parser/python/pyproject/testdata/empty_dep.toml` (added, +8/-0)
```diff
@@ -0,0 +1,8 @@
+[project]
+name = "example"
+version = "0.1.0"
+requires-python = ">=3.12"
+dependencies = [
+    "",
+    "flask == 1.1.4",
+]
```

**File**: `pkg/dependency/parser/ruby/bundler/parse.go` (modified, +6/-1)
```diff
@@ -66,7 +66,12 @@ func (p *Parser) Parse(_ context.Context, r xio.ReadSeekerAt) ([]ftypes.Package,
 		if countLeadingSpace(line) == 6 {
 			line = strings.TrimSpace(line)
 			s := strings.Fields(line)
-			dependsOn = append(dependsOn, s[0]) // store name only for now
+			// A whitespace-only line carries no name. Guard the append rather
+			// than `continue`: lineNum below must still count this line, or
+			// every following package is reported one line early.
+			if len(s) > 0 {
+				dependsOn = append(dependsOn, s[0]) // store name only for now
+			}
 		}
 		lineNum++
 
```

**File**: `pkg/dependency/parser/ruby/bundler/parse_test.go` (modified, +53/-0)
```diff
@@ -214,6 +214,50 @@ var (
 			},
 		},
 	}
+	BlankDepLinePkgs = []ftypes.Package{
+		{
+			ID:           "i18n@1.6.0",
+			Name:         "i18n",
+			Version:      "1.6.0",
+			Relationship: ftypes.RelationshipDirect,
+			Locations: []ftypes.Location{
+				{
+					StartLine: 5,
+					EndLine:   5,
+				},
+			},
+		},
+		{
+			ID:           "rake@13.0.1",
+			Name:         "rake",
+			Version:      "13.0.1",
+			Relationship: ftypes.RelationshipDirect,
+			Locations: []ftypes.Location{
+				{
+					StartLine: 8,
+					EndLine:   8,
+				},
+			},
+		},
+		{
+			ID:           "concurrent-ruby@1.1.5",
+			Name:         "concurrent-ruby",
+			Version:      "1.1.5",
+			Relationship: ftypes.RelationshipIndirect,
+			Locations: []ftypes.Location{
+				{
+					StartLine: 4,
+					EndLine:   4,
+				},
+			},
+		},
+	}
+	BlankDepLineDeps = []ftypes.Dependency{
+		{
+			ID:        "i18n@1.6.0",
+			DependsOn: []string{"concurrent-ruby@1.1.5"},
+		},
+	}
 	Bundler2Deps = []ftypes.Dependency{
 		{
 			ID:        "faker@2.21.0",
@@ -261,6 +305,15 @@ func TestParser_Parse(t *testing.T) {
 			wantPkgs: []ftypes.Package{},
 			wantErr:  assert.NoError,
 		},
+		{
+			// A whitespace-only line inside the dependency graph names no gem,
+			// so it is skipped. cf. #10976
+			name:     "blank dependency line",
+			file:     "testdata/Gemfile_blank_dep_line.lock",
+			wantPkgs: BlankDepLinePkgs,
+			wantDeps: BlankDepLineDeps,
+			wantErr:  assert.NoError,
+		},
 	}
 	for _, tt := range tests {
 		t.Run(tt.name, func(t *testing.T) {
```

---

### Incident Patch 15: `c961eebe` (2026-09-15)
**Commit Message**: fix(repo): strip credentials from remote repository URL in artifact name (#11213)

**File**: `pkg/fanal/artifact/repo/git.go` (modified, +6/-0)
```diff
@@ -75,6 +75,12 @@ func tryRemoteRepo(target string, c cache.ArtifactCache, w Walker, artifactOpt a
 	cleanup = func() { _ = os.RemoveAll(tmpDir) }
 
 	artifactOpt.Original = target
+	if u.User != nil {
+		// Keep credentials out of the artifact name and logs.
+		redacted := *u
+		redacted.User = nil
+		artifactOpt.Original = redacted.String()
+	}
 	art, err := local.NewArtifact(tmpDir, c, w, artifactOpt)
 	if err != nil {
 		return nil, cleanup, xerrors.Errorf("fs artifact: %w", err)
```

**File**: `pkg/fanal/artifact/repo/git_test.go` (modified, +12/-4)
```diff
@@ -346,7 +346,7 @@ func setupAuthTestServer(t *testing.T, username, password string) *url.URL {
 }
 
 // testInspectArtifact is a helper function to inspect an artifact and assert the results
-func testInspectArtifact(t *testing.T, target, wantRepoURL, wantErr string) {
+func testInspectArtifact(t *testing.T, target, wantRepoURL, wantName, wantErr string) {
 	t.Helper()
 	art, cleanup, err := NewArtifact(target, cache.NewMemoryCache(), walker.NewFS(), artifact.Option{})
 	t.Cleanup(cleanup)
@@ -364,6 +364,9 @@ func testInspectArtifact(t *testing.T, target, wantRepoURL, wantErr string) {
 	// Verify the RepoURL
 	assert.Equal(t, wantRepoURL, ref.RepoMetadata.RepoURL)
 
+	// Verify the artifact Name
+	assert.Equal(t, wantName, ref.Name)
+
 	// Verify we have blob IDs (indicating successful scan)
 	assert.NotEmpty(t, ref.BlobIDs)
 }
@@ -387,6 +390,7 @@ func TestArtifact_InspectWithAuth(t *testing.T) {
 			envVars     map[string]string
 			wantErr     string
 			wantRepoURL string
+			wantName    string
 		}{
 			{
 				name:   "success with GITHUB_TOKEN",
@@ -395,6 +399,7 @@ func TestArtifact_InspectWithAuth(t *testing.T) {
 					"GITHUB_TOKEN": testPassword,
 				},
 				wantRepoURL: tsURL.String(),
+				wantName:    tsURL.String(),
 			},
 			{
 				name:   "success with GITLAB_TOKEN",
@@ -403,6 +408,7 @@ func TestArtifact_InspectWithAuth(t *testing.T) {
 					"GITLAB_TOKEN": testPassword,
 				},
 				wantRepoURL: tsURL.String(),
+				wantName:    tsURL.String(),
 			},
 			{
 				name:    "failure without token",
@@ -427,7 +433,7 @@ func TestArtifact_InspectWithAuth(t *testing.T) {
 				}
 
 				// Test using helper function
-				testInspectArtifact(t, tt.target, tt.wantRepoURL, tt.wantErr)
+				testInspectArtifact(t, tt.target, tt.wantRepoURL, tt.wantName, tt.wantErr)
 			})
 		}
 	})
@@ -450,12 +456,14 @@ func TestArtifact_InspectWithAuth(t *testing.T) {
 			name        string
 			target      string
 			wantRepoURL string
+			wantName    string
 			wantErr     string
 		}{
 			{
 				name:        "success with embedded credentials",
 				target:      makeTarget(testUsername, testPassword),
 				wantRepoURL: tsURL.String(),
+				wantName:    tsURL.String(),
 			},
 			{
 				name:    "failure with wrong password",
@@ -472,7 +480,7 @@ func TestArtifact_InspectWithAuth(t *testing.T) {
 		for _, tt := range tests {
 			t.Run(tt.name, func(t *testing.T) {
 				// Test using helper function
-				testInspectArtifact(t, tt.target, tt.wantRepoURL, tt.wantErr)
+				testInspectArtifact(t, tt.target, tt.wantRepoURL, tt.wantName, tt.wantErr)
 			})
 		}
 	})
@@ -497,7 +505,7 @@ func TestArtifact_InspectWithAuth(t *testing.T) {
 		require.NoError(t, err)
 
 		// Scan and verify the local cloned directory
-		testInspectArtifact(t, cloneDir, tsURL.String(), "")
+		testInspectArtifact(t, cloneDir, tsURL.String(), cloneDir, "")
 	})
 }
 
```

**File**: `pkg/report/writer.go` (modified, +48/-31)
```diff
@@ -3,6 +3,7 @@ package report
 import (
 	"context"
 	"io"
+	"net/url"
 	"strings"
 
 	"github.com/hashicorp/go-multierror"
@@ -47,10 +48,27 @@ func Write(ctx context.Context, report types.Report, option flag.Options) (err e
 		return complianceWrite(ctx, report, option, output)
 	}
 
-	var writer Writer
+	writer, err := initWriter(output, report, option)
+	if err != nil {
+		return err
+	}
+
+	if err = writer.Write(ctx, report); err != nil {
+		return xerrors.Errorf("failed to write results: %w", err)
+	}
+
+	// Call post-report hooks
+	if err := extension.PostReport(ctx, &report, option); err != nil {
+		return xerrors.Errorf("post report error: %w", err)
+	}
+
+	return nil
+}
+
+func initWriter(output io.Writer, report types.Report, option flag.Options) (Writer, error) {
 	switch option.Format {
 	case types.FormatTable:
-		writer = table.NewWriter(table.Options{
+		return table.NewWriter(table.Options{
 			Scanners:             option.Scanners,
 			Output:               output,
 			Severities:           option.Severities,
@@ -62,62 +80,61 @@ func Write(ctx context.Context, report types.Report, option flag.Options) (err e
 			LicenseRiskThreshold: option.LicenseRiskThreshold,
 			IgnoredLicenses:      option.IgnoredLicenses,
 			TableModes:           option.TableModes,
-		})
+		}), nil
 	case types.FormatJSON:
-		writer = &JSONWriter{
+		return &JSONWriter{
 			Output:         output,
 			ListAllPkgs:    option.ListAllPkgs,
 			ShowSuppressed: option.ShowSuppressed,
-		}
+		}, nil
 	case types.FormatGitHub:
-		writer = &github.Writer{
+		return &github.Writer{
 			Output:  output,
 			Version: option.AppVersion,
-		}
+		}, nil
 	case types.FormatCycloneDX:
 		// TODO: support xml format option with cyclonedx writer
-		writer = cyclonedx.NewWriter(output, option.AppVersion)
+		return cyclonedx.NewWriter(output, option.AppVersion), nil
 	case types.FormatSPDX, types.FormatSPDXJSON:
-		writer = spdx.NewWriter(output, option.AppVersion, option.Format)
+		return spdx.NewWriter(output, option.AppVersion, option.Format), nil
 	case types.FormatTemplate:
 		// We keep `sarif.tpl` template working for backward compatibility for a while.
 		if strings.HasPrefix(option.Template, "@") && strings.HasSuffix(option.Template, "sarif.tpl") {
 			log.Warn("Using `--template sarif.tpl` is deprecated. Please migrate to `--format sarif`. See https://github.com/aquasecurity/trivy/discussions/1571")
-			writer = &SarifWriter{
+			return &SarifWriter{
 				Output:  output,
 				Version: option.AppVersion,
-			}
-			break
+			}, nil
 		}
-		if writer, err = NewTemplateWriter(output, option.Template, option.AppVersion); err != nil {
-			return xerrors.Errorf("failed to initialize template writer: %w", err)
+		writer, err := NewTemplateWriter(output, option.Template, option.AppVersion)
+		if err != nil {
+			return nil, xerrors.Errorf("failed to initialize template writer: %w", err)
 		}
+		return writer, nil
 	case types.FormatSarif:
-		target := ""
-		if report.ArtifactType == ftypes.TypeFilesystem || report.ArtifactType == ftypes.TypeRepository {
-			target = option.Target
-		}
-		writer = &SarifWriter{
+		return &SarifWriter{
 			Output:  output,
 			Version: option.AppVersion,
-			Target:  target,
-		}
+			Target:  sarifTarget(report.ArtifactType, option.Target),
+		}, nil
 	case types.FormatCosignVuln:
-		writer = predicate.NewVulnWriter(output, option.AppVersion)
+		return predicate.NewVulnWriter(output, option.AppVersion), nil
 	default:
-		return xerrors.Errorf("unknown format: %v", option.Format)
+		return nil, xerrors.Errorf("unknown format: %v", option.Format)
 	}
+}
 
-	if err = writer.Write(ctx, report); err != nil {
-		return xerrors.Errorf("failed to write results: %w", err)
+func sarifTarget(artifactType ftypes.ArtifactType, target string) string {
+	if artifactType != ftypes.TypeFilesystem && artifactType != ftypes.TypeRepository {
+		return ""
 	}
-
-	// Call post-report hooks
-	if err := extension.PostReport(ctx, &report, option); err != nil {
-		return xerrors.Errorf("post report error: %w", err)
+	// Keep credentials out of the report (e.g. ROOTPATH in SARIF).
+	if u, err := url.Parse(target); err == nil && u.User != nil {
+		redacted := *u
+		redacted.User = nil
+		return redacted.String()
 	}
-
-	return nil
+	return target
 }
 
 func complianceWrite(ctx context.Context, report types.Report, opt flag.Options, output io.Writer) error {
```

**File**: `pkg/report/writer_test.go` (modified, +6/-0)
```diff
@@ -204,6 +204,12 @@ func TestWrite_Sarif(t *testing.T) {
 			target:       "/tmp/foo",
 			wantRootPath: tmpFooRootPath,
 		},
+		{
+			name:         "TypeRepository strips credentials from target in ROOTPATH",
+			artifactType: ftypes.TypeRepository,
+			target:       "https://testuser:testpass@example.com/repo.git",
+			wantRootPath: regexp.MustCompile(`^file:///([A-Z]:/)?[^@]*example\.com/repo\.git/$`),
+		},
 		{
 			name:         "TypeContainerImage does not set ROOTPATH",
 			artifactType: ftypes.TypeContainerImage,
```

#### Recent Merged Pull Requests:
- **PR #11334** (2026-10-01): ci(helm): bump Trivy version to 0.75.0 for Trivy Helm Chart 0.27.0 (@repo-trivy-write-33ed3c[bot])
- **PR #11326** (2026-09-29): fix(purl): classify julia, bottlerocket and centos stream packages (@CalvinTjoaquinn)
- **PR #11325** (closed): fix(purl): classify julia and bottlerocket packages (@CalvinTjoaquinn)
- **PR #11323** (2026-09-29): docs(sbom): clarify Rekor source compatibility with Cosign (@knqyf263)
- **PR #11319** (2026-09-30): fix(crypto): read RSA private keys without validating their math (@nikpivkin)
- **PR #11313** (closed): feat(k8s): support --format template (@thebigbone)
- **PR #11310** (2026-09-28): chore(deps): bump github.com/containerd/containerd/v2 from 2.4.0 to 2.4.1 (@dependabot[bot])
- **PR #11309** (2026-09-29): chore(deps): bump alpine to 3.24.2 (@DmitriyLewen)

---

## 3. Empirical Evidence & Compliance Certification
- **Evidence Provenance**: Fetched directly from verified official GitHub REST API.
- **Zero Disk Footprint**: 0 bytes of unnecessary repository bloat stored locally.
- **TOS & Free-Tier Adherence**: Request pace complied with public API guidelines without fee, penalty, or unauthorized scraping.

---

## 4. Promotion & Integration Status
- **Status**: HARVESTED_DEEP_FORENSIC
- **Master Brain Sync**: Auto-committed to local/remote Master Brain repository.
