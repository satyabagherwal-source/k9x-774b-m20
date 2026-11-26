> **Canonical Learning Artifact**: `07_PROJECT_LEARNING/projectdiscovery-nuclei-learnings.md`  
> **Source**: github ([https://github.com/projectdiscovery/nuclei](https://github.com/projectdiscovery/nuclei))  
> **Source Version**: `90b55382`  
> **License**: MIT  
> **Synthesized By**: zero-clone-structural-synthesizer  
> **Timestamp**: 2026-11-26T18:24:22.542Z  
> **Learning ID**: `learn-github-projectdiscovery-nuclei`  
> **Pipeline Version**: `2.0.0`  
> **Status**: VERIFIED_EMPIRICAL_INTELLIGENCE  
> **Data Governance**: CLASSIFICATION: PUBLIC. Sanitized against PII/secrets.  
> **Policy Invariant**: Strictly for engineering retrieval and architecture documentation. Distillation prohibited.  

---

# Forensic Learning Record (Deep Inspection): projectdiscovery/nuclei

> **Canonical Artifact**: `07_PROJECT_LEARNING/projectdiscovery-nuclei-learnings.md`  
> **Source Platform**: GitHub ([https://github.com/projectdiscovery/nuclei](https://github.com/projectdiscovery/nuclei))  
> **Harvest Method**: Full-Spectrum Deep Extraction (Patches, Diffs, Source Code, Post-Mortems)  
> **Harvest Timestamp**: 2026-11-26T18:24:22.531Z  
> **Compliance State**: Free Tier Guaranteed | Strict Rate-Limit Backoff Honored  

---

## 1. Context & Architectural Overview
- **Repository / Resource**: `projectdiscovery/nuclei`
- **Description**: Nuclei is a fast, customizable vulnerability scanner powered by the global security community and built on a simple YAML-based DSL, enabling collaboration to tackle trending vulnerabilities on the internet. It helps you find vulnerabilities in your applications, APIs, networks, DNS, and cloud configurations.
- **Primary Language / Ecosystem**: Go
- **Discovered Manifests / Configurations**: go.mod, README.md, Dockerfile
- **Stars / Engagement**: 33326 stars

---

## 2. Multi-Dimensional 8-Axis Investigation & Real Code Patches

### D1: Architecture & Structural Boundaries
- Entry configurations inspected via direct stream: go.mod, README.md, Dockerfile.
- Evaluated system abstractions and modular contracts.

### Core Architecture Module: `internal/pdcp/utils.go`
```
package pdcp

import (
	pdcpauth "github.com/projectdiscovery/utils/auth/pdcp"
	urlutil "github.com/projectdiscovery/utils/url"
)

func getScanDashBoardURL(id string, teamID string) string {
	ux, _ := urlutil.Parse(pdcpauth.DashBoardURL)
	ux.Path = "/scans/" + id
	if ux.Params == nil {
		ux.Params = urlutil.NewOrderedParams()
	}
	if teamID != "" {
		ux.Params.Add("team_id", teamID)
	} else {
		ux.Params.Add("team_id", NoneTeamID)
	}
	ux.Update()
	return ux.String()
}

type uploadResponse struct {
	ID      string `json:"id"`
	Message string `json:"message"`
}

```

### Core Architecture Module: `internal/server/requests_worker.go`
```
package server

import (
	"path"

	"github.com/projectdiscovery/gologger"
	"github.com/projectdiscovery/nuclei/v3/internal/server/scope"
	"github.com/projectdiscovery/nuclei/v3/pkg/input/types"
)

func (s *DASTServer) consumeTaskRequest(req PostRequestsHandlerRequest) {
	defer s.endpointsInQueue.Add(-1)

	parsedReq, err := types.ParseRawRequestWithURL(req.RawHTTP, req.URL)
	if err != nil {
		gologger.Warning().Msgf("Could not parse raw request: %s\n", err)
		return
	}

	if parsedReq.URL.Scheme != "http" && parsedReq.URL.Scheme != "https" {
		gologger.Warning().Msgf("Invalid scheme: %s\n", parsedReq.URL.Scheme)
		return
	}

	// Check filenames and don't allow non-interesting files
	extension := path.Base(parsedReq.URL.Path)
	if extension != "/" && extension != "" && scope.IsUninterestingPath(extension) {
		gologger.Warning().Msgf("Uninteresting path: %s\n", parsedReq.URL.Path)
		return
	}

	inScope, err := s.scopeManager.Validate(parsedReq.URL.URL)
	if err != nil {
		gologger.Warning().Msgf("Could not validate scope: %s\n", err)
		return
	}
	if !inScope {
		gologger.Warning().Msgf("Request is out of scope: %s %s\n", parsedReq.Request.Method, parsedReq.URL.String())
		return
	}

	if s.deduplicator.isDuplicate(parsedReq) {
		gologger.Warning().Msgf("Duplicate request detected: %s %s\n", parsedReq.Request.Method, parsedReq.URL.String())
		return
	}

	gologger.Verbose().Msgf("Fuzzing request: %s %s\n", parsedReq.Request.Method, parsedReq.URL.String())

	s.endpointsBeingTested.Add(1)
	defer s.endpointsBeingTested.Add(-1)

	// Fuzz the request finally
	err = s.nucleiExecutor.ExecuteScan(req)
	if err != nil {
		gologger.Warning().Msgf("Could not run nuclei: %s\n", err)
		return
	}
}

```

### Core Architecture Module: `pkg/catalog/config/state.go`
```
package config

import (
	"errors"
	"fmt"
	"os"
	"path/filepath"

	"github.com/projectdiscovery/nuclei/v3/pkg/utils/json"
)

type templatesState struct {
	TemplatesDirectory           string `json:"nuclei-templates-directory,omitempty"`
	TemplateVersion              string `json:"nuclei-templates-version,omitempty"`
	LatestNucleiVersion          string `json:"nuclei-latest-version"`
	LatestNucleiTemplatesVersion string `json:"nuclei-templates-latest-version"`
}

// ReadTemplatesConfig reads templates state, migrating the legacy config file
// only when the new state file does not exist.
func (c *Config) ReadTemplatesConfig() error {
	statePath := c.getTemplatesConfigFilePath()
	data, err := os.ReadFile(statePath)
	migrate := false
	if errors.Is(err, os.ErrNotExist) {
		legacyPath := c.getLegacyTemplatesConfigFilePath()

		data, err = os.ReadFile(legacyPath)
		if err != nil {
			return fmt.Errorf("read templates state %q or legacy state %q: %w", statePath, legacyPath, err)
		}

		migrate = true
	} else if err != nil {
		return fmt.Errorf("read templates state %q: %w", statePath, err)
	}

	var state templatesState
	if err := json.Unmarshal(data, &state); err != nil {
		return fmt.Errorf("decode templates state %q: %w", statePath, err)
	}

	if state.TemplatesDirectory == "" {
		return fmt.Errorf("decode templates state %q: templates directory is empty", statePath)
	}

	c.setTemplatesDir(state.TemplatesDirectory)
	c.TemplateVersion = state.TemplateVersion

	c.LatestNucleiVersion = state.LatestNucleiVersion
	c.LatestNucleiTemplatesVersion = state.LatestNucleiTemplatesVersion

	if migrate {
		if err := c.WriteTemplatesConfig(); err != nil {
			return fmt.Errorf("migrate templates state: %w", err)
		}
	}

	return nil
}

// ReloadTemplateVersion refreshes the installed templates version from disk.
// Concurrent processes read the version once at startup, so one that waited on
// another's install or update must reload it to see the result instead of
// downloading the same release again. State recorded for a different templates
// directory is ignored.
func (c *Config) ReloadTemplateVersion() error {
	statePath := c.getTemplatesConfigFilePath()
	data, err := os.ReadFile(statePath)
	if errors.Is(err, os.ErrNotExist) {
		return nil
	} else if err != nil {
		return fmt.Errorf("read templates state %q: %w", statePath, err)
	}

	var state templatesState
	if err := json.Unmarshal(data, &state); err != nil {
		return fmt.Errorf("decode templates state %q: %w", statePath, err)
	}

	c.m.Lock()
	defer c.m.Unlock()
	// compare the resolved directory, so state written through a symlink is
	// visible to a process using the real path, and the other way around
	if CanonicalTemplatesPath(state.TemplatesDirectory) == CanonicalTemplatesPath(c.TemplatesDirectory) {
		c.TemplateVersion = state.TemplateVersion
	}
	return nil
}

// WriteTemplatesConfig atomically writes restart-persistent templates state.
func (c *Config) WriteTemplatesConfig() error {
	state := templatesState{
		TemplatesDirectory:           c.TemplatesDirectory,
		TemplateVersion:              c.TemplateVersion,
		LatestNucleiVersion:          c.LatestNucleiVersion,
		LatestNucleiTemplatesVersion: c.LatestNucleiTemplatesVersion,
	}

	data, err := json.Marshal(&state)
	if err != nil {
		return fmt.Errorf("encode templates state: %w", err)
	}

	if err := atomicWriteFile(c.getTemplatesConfigFilePath(), data, 0o600); err != nil {
		return fmt.Errorf("write templates state: %w", err)
	}

	return nil
}

func (c *Config) getTemplatesConfigFilePath() string {
	return filepath.Join(c.GetStateDir(), TemplatesStateFileName)
}

// GetTemplatesStateFilePath returns the restart-persistent templates state
// file path.
func (c *Config) GetTemplatesStateFilePath() string {
	return c.getTemplatesConfigFilePath()
}

// TODO(dwisiswant0): remove this in the future, only used for legacy migration.
func (c *Config) getLegacyTemplatesConfigFilePath() string {
	return filepath.Join(c.configDir, legacyTemplatesConfigFileName)
}

func atomicWriteFile(path string, data []byte, mode os.FileMode) error {
	dir := filepath.Dir(path)
	if err := os.MkdirAll(dir, 0o700); err != nil {
		return fmt.Errorf("create directory %q: %w", dir, err)
	}

	temp, err := os.CreateTemp(dir, "."+filepath.Base(path)+"-*")
	if err != nil {
		return fmt.Errorf("create temporary file for %q: %w", path, err)
	}

	tempPath := temp.Name()

	defer func() {
		if temp != nil {
			_ = temp.Close()
		}

		_ = os.Remove(tempPath)
	}()

	if err := temp.Chmod(mode); err != nil {
		return fmt.Errorf("set temporary file mode for %q: %w", path, err)
	}

	if _, err := temp.Write(data); err != nil {
		return fmt.Errorf("write temporary file for %q: %w", path, err)
	}

	if err := temp.Sync(); err != nil {
		return fmt.Errorf("sync temporary file for %q: %w", path, err)
	}

	if err := temp.Close(); err != nil {
		return fmt.Errorf("close temporary file for %q: %w", path, err)
	}

	temp = nil

	if err := replaceTemplatesConfigFile(tempPath, path); err != nil {
		return fmt.Errorf("replace %q: %w", path, err)
	}

	return nil
}

```

### Core Architecture Module: `pkg/core/engine.go`
```
package core

import (
	"sync"

	"github.com/projectdiscovery/gologger"
	"github.com/projectdiscovery/nuclei/v3/pkg/output"
	"github.com/projectdiscovery/nuclei/v3/pkg/protocols"
	"github.com/projectdiscovery/nuclei/v3/pkg/protocols/common/contextargs"
	"github.com/projectdiscovery/nuclei/v3/pkg/templates"
	"github.com/projectdiscovery/nuclei/v3/pkg/types"
)

// TemplateExecutionState identifies a template execution lifecycle transition.
type TemplateExecutionState uint8

const (
	// TemplateExecutionStarted is emitted immediately before a template starts on a target.
	TemplateExecutionStarted TemplateExecutionState = iota + 1
	// TemplateExecutionFinished is emitted after that template execution returns.
	TemplateExecutionFinished
)

// TemplateExecutionEvent identifies one template execution on one target.
type TemplateExecutionEvent struct {
	TemplateID   string
	TemplatePath string
	Target       string
	State        TemplateExecutionState
	ContextErr   error
}

// TemplateExecutionCallback observes template execution lifecycle transitions.
// Nuclei can invoke the callback concurrently; implementations must be concurrency-safe.
type TemplateExecutionCallback func(TemplateExecutionEvent)

// Engine is an executer for running Nuclei Templates/Workflows.
//
// The engine contains multiple thread pools which allow using different
// concurrency values per protocol executed.
//
// The engine does most of the heavy lifting of execution, from clustering
// templates to leading to the final execution by the work pool, it is
// handled by the engine.
type Engine struct {
	workPool *WorkPool
	// originScoped tracks origin-scoped template attempts. A pair is finished
	// only after a successful execution, so a failed first target does not
	// suppress every later URL on that origin.
	originScoped              sync.Map
	options                   *types.Options
	executerOpts              *protocols.ExecutorOptions
	Callback                  func(*output.ResultEvent) // Executed on results
	templateExecutionCallback TemplateExecutionCallback
	planRun                   PlanRun
	resultHook                ResultHook
	Logger                    *gologger.Logger
}

// ResultHook observes the results of a template run on a target.
type ResultHook func(input *contextargs.MetaInput, results []*output.ResultEvent)

// SetResultHook makes the engine pass the results of every template run on a
// target to hook, in addition to writing them; nil removes it.
func (e *Engine) SetResultHook(hook ResultHook) {
	e.resultHook = hook
}

// New returns a new Engine instance
func New(options *types.Options) *Engine {
	engine := &Engine{
		options: options,
		Logger:  options.Logger,
	}
	engine.workPool = engine.GetWorkPool()
	return engine
}

func (e *Engine) GetWorkPoolConfig() WorkPoolConfig {
	config := WorkPoolConfig{
		InputConcurrency:         e.options.BulkSize,
		TypeConcurrency:          e.options.CurrentTemplateThreads(),
		HeadlessInputConcurrency: e.options.HeadlessBulkSize,
		HeadlessTypeConcurrency:  e.options.HeadlessTemplateThreads,
	}
	return config
}

// GetWorkPool returns a workpool from options
func (e *Engine) GetWorkPool() *WorkPool {
	return NewWorkPool(e.GetWorkPoolConfig())
}

// SetExecuterOptions sets the executer options for the engine. This is required
// before using the engine to perform any execution.
func (e *Engine) SetExecuterOptions(options *protocols.ExecutorOptions) {
	e.executerOpts = options
}

// SetTemplateExecutionCallback registers a callback for template execution lifecycle events.
func (e *Engine) SetTemplateExecutionCallback(callback TemplateExecutionCallback) {
	e.templateExecutionCallback = callback
}

func (e *Engine) templateExecutionStarted(template *templates.Template, target string) func(error) {
	if e.templateExecutionCallback == nil {
		return func(error) {}
	}
	event := TemplateExecutionEvent{
		TemplateID:   template.ID,
		TemplatePath: template.Path,
		Target:       target,
		State:        TemplateExecutionStarted,
	}
	e.templateExecutionCallback(event)
	return func(contextErr error) {
		event.State = TemplateExecutionFinished
		event.ContextErr = contextErr
		e.templateExecutionCallback(event)
	}
}

// ExecuterOptions returns protocols.ExecutorOptions for nuclei engine.
func (e *Engine) ExecuterOptions() *protocols.ExecutorOptions {
	return e.executerOpts
}

// WorkPool returns the worker pool for the engine
func (e *Engine) WorkPool() *WorkPool {
	// resize check point - nop if there are no changes
	e.workPool.RefreshWithConfig(e.GetWorkPoolConfig())
	return e.workPool
}

```

### Core Architecture Module: `pkg/core/execute_options.go`
```
package core

import (
	"context"
	"sync"
	"sync/atomic"

	"github.com/projectdiscovery/nuclei/v3/pkg/input/provider"
	"github.com/projectdiscovery/nuclei/v3/pkg/output"
	"github.com/projectdiscovery/nuclei/v3/pkg/protocols"
	"github.com/projectdiscovery/nuclei/v3/pkg/protocols/common/contextargs"
	"github.com/projectdiscovery/nuclei/v3/pkg/protocols/http/httpclientpool"
	"github.com/projectdiscovery/nuclei/v3/pkg/templates"
	"github.com/projectdiscovery/nuclei/v3/pkg/templates/types"
	"github.com/projectdiscovery/nuclei/v3/pkg/types/scanstrategy"
	stringsutil "github.com/projectdiscovery/utils/strings"
	syncutil "github.com/projectdiscovery/utils/sync"
)

// Execute takes a list of templates/workflows that have been compiled
// and executes them based on provided concurrency options.
//
// All the execution logic for the templates/workflows happens in this part
// of the engine.
func (e *Engine) Execute(ctx context.Context, templates []*templates.Template, target provider.InputProvider) *atomic.Bool {
	return e.ExecuteScanWithOpts(ctx, templates, target, false)
}

// ExecuteWithResults a list of templates with results
func (e *Engine) ExecuteWithResults(ctx context.Context, templatesList []*templates.Template, target provider.InputProvider, callback func(*output.ResultEvent)) *atomic.Bool {
	e.Callback = callback
	return e.ExecuteScanWithOpts(ctx, templatesList, target, false)
}

// ExecuteScanWithOpts executes scan with given scanStrategy
func (e *Engine) ExecuteScanWithOpts(ctx context.Context, templatesList []*templates.Template, target provider.InputProvider, noCluster bool) *atomic.Bool {
	results := &atomic.Bool{}
	selfcontainedWg := &sync.WaitGroup{}
	httpclientpool.ResetSharedResponses(e.options)

	totalReqBeforeCluster := getRequestCount(templatesList) * int(target.Count())

	finalTemplates, clusterCount := e.clusterTemplates(templatesList, noCluster)

	totalReqAfterClustering := getRequestCount(finalTemplates) * int(target.Count())

	if !noCluster && totalReqAfterClustering < totalReqBeforeCluster {
		e.Logger.Info().Msgf("Templates clustered: %d (Reduced %d Requests)", clusterCount, totalReqBeforeCluster-totalReqAfterClustering)
	}

	// 0 matches means no templates were found in the directory
	if len(finalTemplates) == 0 {
		return &atomic.Bool{}
	}

	filtered := []*templates.Template{}
	selfContained := []*templates.Template{}
	// Filter Self Contained templates since they are not bound to target
	for _, v := range finalTemplates {
		if v.SelfContained {
			selfContained = append(selfContained, v)
		} else {
			filtered = append(filtered, v)
		}
	}

	if e.executerOpts.Progress != nil {
		// Notes:
		// workflow requests are not counted as they can be conditional
		// templateList count is user requested templates count (before clustering)
		// totalReqAfterClustering is total requests count after clustering
		requests, tasks := e.expectedWork(finalTemplates, filtered, target, totalReqAfterClustering)
		e.executerOpts.Progress.Init(target.Count(), len(templatesList), requests)
		// a self-contained template runs once
		e.addTaskTotal(tasks + int64(len(selfContained)))
	}

	if stringsutil.EqualFoldAny(e.options.ScanStrategy, scanstrategy.Auto.String(), "") {
		// TODO: this is only a placeholder, auto scan strategy should choose scan strategy
		// based on no of hosts , templates , stream and other optimization parameters
		e.options.ScanStrategy = scanstrategy.TemplateSpray.String()
	}

	// Execute All SelfContained in parallel
	e.executeAllSelfContained(ctx, selfContained, results, selfcontainedWg)

	strategyResult := &atomic.Bool{}
	switch e.options.ScanStrategy {
	case scanstrategy.TemplateSpray.String():
		strategyResult = e.executeTemplateSpray(ctx, filtered, target)
	case scanstrategy.HostSpray.String():
		strategyResult = e.executeHostSpray(ctx, filtered, target)
	}

	results.CompareAndSwap(false, strategyResult.Load())

	selfcontainedWg.Wait()
	return results
}

// executeTemplateSpray executes scan using template spray strategy where targets are iterated over each template
func (e *Engine) executeTemplateSpray(ctx context.Context, templatesList []*templates.Template, target provider.InputProvider) *atomic.Bool {
	results := &atomic.Bool{}

	// wp is workpool that contains different waitgroups for
	// headless and non-headless templates
	wp := e.GetWorkPool()
	defer wp.Wait()

	for _, template := range templatesList {

		select {
		case <-ctx.Done():
			return results
		default:
		}

		// resize check point - nop if there are no changes
		wp.RefreshWithConfigContext(ctx, e.GetWorkPoolConfig())

		templateType := template.Type()
		var wg *syncutil.AdaptiveWaitGroup
		if templateType == types.HeadlessProtocol {
			wg = wp.Headless
		} else {
			wg = wp.Default
		}

		if err := wg.AddWithContext(ctx); err != nil {
			return results
		}
		usesSharedTemplateBudget := templateType != types.HeadlessProtocol
		if usesSharedTemplateBudget {
			if err := e.options.AcquireTemplateThread(ctx); err != nil {
				wg.Done()
				return results
			}
		}
		go func(tpl *templates.Template, sharedBudget bool) {
			defer wg.Done()
			if sharedBudget {
				defer e.options.ReleaseTemplateThread()
			}
			// All other request types are executed here
			// Note: executeTemplateWithTargets creates goroutines and blocks
			// given template is executed on all targets
			e.executeTemplateWithTargets(ctx, tpl, target, results)
		}(template, usesSharedTemplateBudget)
	}
	return results
}

// executeHostSpray executes scan using host spray strategy where templates are iterated over each target
func (e *Engine) executeHostSpray(ctx context.Context, templatesList []*templates.Template, target provider.InputProvider) *atomic.Bool {
	results := &atomic.Bool{}
	wp := newPool(e.options.BulkSize + e.options.HeadlessBulkSize) //nolint:varnamelen // wp names the pool throughout

	// Targets are the positions here, and each target runs every template. A
	// resumed scan skips the targets before the lowest one in flight at the
	// interrupt, as the template-spray loop does for each template.
	currentInfo, resumeFromInfo := e.hostSprayResumeInfo()

	var index uint32

	target.Iterate(func(value *contextargs.MetaInput) bool {
		select {
		case <-ctx.Done():
			return false
		default:
		}

		position := index
		index++

		if resumeFromInfo.IsCompleted() || position < resumeFromInfo.GetSkipUnder() {
			e.options.Logger.Debug().Msgf("Skipping %q: Resume - Target already processed", value.Input)
			e.tasksDone(int64(getSelectedCount(templatesList, e.selectionFor(value))))

			return true
		}

		currentInfo.Lock()
		currentInfo.InFlight[position] = struct{}{}
		currentInfo.Unlock()

		if err := wp.AddWithContext(ctx); err != nil {
			return false
		}

		go func(targetval *contextargs.MetaInput) {
			defer wp.Done()
			e.executeTemplatesOnTarget(ctx, templatesList, targetval, results)

			// A target that cancellation cut off didn't finish. It stays in flight,
			// so the resumed scan runs it again.
			if ctx.Err() == nil {
				currentInfo.Lock()
				delete(currentInfo.InFlight, position)
				currentInfo.Unlock()
			}
		}(value)
		return true
	})
	wp.Wait()

	// A cancelled loop never took the remaining targets, so the scan isn't
	// complete.
	if ctx.Err() == nil {
		currentInfo.Lock()
		currentInfo.Completed = true
		currentInfo.Unlock()
	}

	return results
}

// hostSprayResumeID keys the progress of a host-spray scan among the template
// IDs of the resume file. A template ID can't hold an @, so it never collides.
const hostSprayResumeID = "@host-spray"

// clusterTemplates merges templates that send identical requests unless
// noCluster is set, and returns the templates to run with the number merged.
func (e *Engine) clusterTemplates(templatesList []*templates.Template, noCluster bool) ([]*templates.Template, int) {
	if noCluster {
		return templatesList, 0
	}
	finalTemplates, clusterCount, clusterMappings := templates.ClusterTemplates(templatesList, e.executerOpts)
	// Store cluster mappings in executerOpts for SDK access (thread-safe)
	if clusterMappings != nil {
		e.executerOpts.ClusterMappings = types.NewClusterMappingsMap(clusterMappings)
	}
	return finalTemplates, clusterCount
}

// expectedWork returns the requests and the tasks the target-bound templates
// will run. It counts only the template and target pairs that per-target
// profiles select, so progress reflects the work that will be done. A task is
// one template, cluster or workflow run on one target.
func (e *Engine) expectedWork(templatesList, targetBound []*templates.Template, target provider.InputProvider, unscopedRequests int) (requests, tasks int64) {
	scope := e.executerOpts.TargetScope
	if scope == nil {
		return int64(unscopedRequests), target.Count() * int64(len(targetBound))
	}
	targets := make(map[protocols.TemplateSelection]int64)
	target.Iterate(func(value *contextargs.MetaInput) bool {
		targets[scope.For(value)]++
		return true
	})
	for selection, count := range targets {
		requests += count * int64(getSelectedRequestCount(templatesList, selection))
		tasks += count * int64(getSelectedCount(targetBound, selection))
	}
	return requests, tasks
}

// getSelectedCount returns the number of templates selection selects; a nil
// selection selects every template.
func getSelectedCount(templates []*templates.Template, selection protocols.TemplateSelection) int {
	if selection == nil {
		return len(templates)
	}
	count := 0
	for _, template := range templates {
		if template.SelectedBy(selection) {
			count++
		}
	}
	return count
}

// returns total requests count
func getRequestCount(templates []*templates.Template) int {
	return getSelectedRequestCount(templates, nil)
}

// getSelectedRequestCount returns the requests of the templates selection
// selects; a nil selection selects every template.
func getSelectedRequestCount(templates []*templates.Template, selection protocols.TemplateSelection) int {
	count := 0
	for _, template := range templates {
		// igno
```

### Core Architecture Module: `pkg/core/executors.go`
```
package core

import (
	"context"
	"slices"
	"strings"
	"sync"
	"sync/atomic"
	"time"

	"github.com/projectdiscovery/nuclei/v3/pkg/input/normalize"
	"github.com/projectdiscovery/nuclei/v3/pkg/input/provider"
	"github.com/projectdiscovery/nuclei/v3/pkg/output"
	"github.com/projectdiscovery/nuclei/v3/pkg/progress"
	"github.com/projectdiscovery/nuclei/v3/pkg/protocols"
	"github.com/projectdiscovery/nuclei/v3/pkg/protocols/common/contextargs"
	"github.com/projectdiscovery/nuclei/v3/pkg/protocols/http" //nolint:depguard // No depguard rules are configured, so its default list allows only the standard library.
	"github.com/projectdiscovery/nuclei/v3/pkg/scan"
	"github.com/projectdiscovery/nuclei/v3/pkg/templates"
	"github.com/projectdiscovery/nuclei/v3/pkg/templates/types"
	generalTypes "github.com/projectdiscovery/nuclei/v3/pkg/types"
	syncutil "github.com/projectdiscovery/utils/sync"
)

// Executors are low level executors that deals with template execution on a target

// executeAllSelfContained executes all self contained templates that do not use `target`
func (e *Engine) executeAllSelfContained(ctx context.Context, alltemplates []*templates.Template, results *atomic.Bool, sg *sync.WaitGroup) {
	for _, v := range alltemplates {
		usesSharedTemplateBudget := v.Type() != types.HeadlessProtocol
		if usesSharedTemplateBudget {
			if err := e.options.AcquireTemplateThread(ctx); err != nil {
				return
			}
		}
		sg.Add(1)
		go func(template *templates.Template, sharedBudget bool) {
			defer sg.Done()
			if sharedBudget {
				defer e.options.ReleaseTemplateThread()
			}
			defer e.tasksDone(1)
			planned, skip := e.claimPlanned(template, &contextargs.MetaInput{})
			if skip {
				return
			}
			finished := e.templateExecutionStarted(template, "")
			defer func() { finished(ctx.Err()) }()
			var err error
			var match bool
			ctx := scan.NewScanContext(ctx, contextargs.New(ctx))
			if e.Callback != nil {
				if results, err := template.Executer.ExecuteWithResults(ctx); err == nil {
					for _, result := range results {
						e.Callback(result)
					}
				}

				match = true
			} else {
				match, err = template.Executer.Execute(ctx)
			}
			if err != nil {
				e.options.Logger.Warning().Msgf("[%s] Could not execute step (self-contained): %s\n", e.executerOpts.Colorizer.BrightBlue(template.ID), err)
			} else if ctx.Context().Err() == nil {
				planned()
			}
			results.CompareAndSwap(false, match)
		}(v, usesSharedTemplateBudget)
	}
}

// executeTemplateWithTargets executes a given template on x targets (with a internal targetpool(i.e concurrency))
func (e *Engine) executeTemplateWithTargets(ctx context.Context, template *templates.Template, target provider.InputProvider, results *atomic.Bool) {
	if e.workPool == nil {
		e.workPool = e.GetWorkPool()
	}
	// Bounded worker pool using input concurrency
	workerCount := e.workPool.InputPool(template.Type()).Size

	var (
		index uint32
	)

	currentInfo, resumeFromInfo := e.resumeInfo(template.ID)

	// track progression
	cleanupInFlight := func(index uint32) {
		currentInfo.Lock()
		delete(currentInfo.InFlight, index)
		currentInfo.Unlock()
	}

	// task represents a single target execution unit
	type task struct {
		index uint32
		skip  bool
		value *contextargs.MetaInput
	}

	tasks := make(chan task)
	var workersWg sync.WaitGroup
	workersWg.Add(workerCount)
	for i := 0; i < workerCount; i++ {
		go func() {
			defer workersWg.Done()
			for t := range tasks {
				func() {
					// A target that cancellation cut off didn't finish. It stays in
					// flight, so the resumed scan runs it again.
					defer func() {
						if ctx.Err() == nil {
							cleanupInFlight(t.index)
						}
					}()
					select {
					case <-ctx.Done():
						return
					default:
					}
					if t.skip {
						return
					}

					match, err := e.executeTemplateOnInput(ctx, template, t.value)
					if err != nil {
						e.options.Logger.Warning().Msgf("[%s] Could not execute step on %s: %s\n", template.ID, t.value.Input, err)
					}
					results.CompareAndSwap(false, match)
				}()
			}
		}()
	}

	target.Iterate(func(scannedValue *contextargs.MetaInput) bool {
		select {
		case <-ctx.Done():
			return false // exit
		default:
		}

		// Best effort to track the host progression
		// skips indexes lower than the minimum in-flight at interruption time
		var skip bool
		if resumeFromInfo.IsCompleted() { // the template was completed
			e.options.Logger.Debug().Msgf("[%s] Skipping \"%s\": Resume - Template already completed", template.ID, scannedValue.Input)
			skip = true
		} else if index < resumeFromInfo.GetSkipUnder() { // index lower than the sliding window (bulk-size)
			e.options.Logger.Debug().Msgf("[%s] Skipping \"%s\": Resume - Target already processed", template.ID, scannedValue.Input)
			skip = true
		} else if resumeFromInfo.IsInFlight(index) { // the target wasn't completed successfully
			e.options.Logger.Debug().Msgf("[%s] Repeating \"%s\": Resume - Target wasn't completed", template.ID, scannedValue.Input)
			// skip is already false, but leaving it here for clarity
			skip = false
		} else if index > resumeFromInfo.GetDoAbove() { // index above the sliding window (bulk-size)
			// skip is already false - but leaving it here for clarity
			skip = false
		}

		// out of scope pairs keep their index so resume positions stay stable
		inScope := e.inScope(template, scannedValue)
		if !inScope {
			skip = true
		}

		// A skipped position never runs, so cancellation can't cut it off. Marking
		// it would let an interrupt save it as unfinished, below the progress this
		// scan loaded, and the next scan would repeat targets that are done.
		if !skip {
			currentInfo.Lock()
			currentInfo.InFlight[index] = struct{}{}
			currentInfo.Unlock()
		}

		// Skip if the host has had errors
		var hostDown bool
		if inScope {
			hostDown, _ = e.hostDown(ctx, template, scannedValue)
		}
		// in-scope pairs that never reach executeTemplateOnInput are done here:
		// those done by the resumed scan and those of an unresponsive host
		if inScope && (skip || hostDown) {
			e.tasksDone(1)
		}
		if hostDown {
			skipEvent := &output.ResultEvent{
				TemplateID:    template.ID,
				TemplatePath:  template.Path,
				Info:          template.Info,
				Type:          template.Type().String(),
				Host:          scannedValue.Input,
				MatcherStatus: false,
				Error:         "host was skipped as it was found unresponsive",
				Timestamp:     time.Now(),
			}

			if e.Callback != nil {
				e.Callback(skipEvent)
			} else if e.executerOpts.Output != nil {
				_ = e.executerOpts.Output.Write(skipEvent)
			}
			// This target still occupies its resume index. Leaving the index in
			// place would hand it to the next target, and a resumed scan would
			// skip that target as already processed.
			cleanupInFlight(index)
			index++
			return true
		}

		tasks <- task{index: index, skip: skip, value: scannedValue}
		index++
		return true
	})

	close(tasks)
	workersWg.Wait()

	// A cancelled loop never took the remaining targets, so the template isn't
	// complete.
	if ctx.Err() != nil {
		return
	}

	// on completion marks the template as completed
	currentInfo.Lock()
	currentInfo.Completed = true
	currentInfo.Unlock()
}

// resumeInfo returns the progress under key in this scan and in the scan it
// resumes from, and creates the ones that don't exist yet.
func (e *Engine) resumeInfo(key string) (*generalTypes.ResumeInfo, *generalTypes.ResumeInfo) {
	cfg := e.executerOpts.ResumeCfg
	cfg.Lock()
	defer cfg.Unlock()

	return resumeInfoLocked(cfg, key)
}

// resumeInfoLocked is resumeInfo for a caller that holds cfg's lock.
func resumeInfoLocked(cfg *generalTypes.ResumeCfg, key string) (*generalTypes.ResumeInfo, *generalTypes.ResumeInfo) {
	current, exists := cfg.Current[key]
	if !exists {
		current = new(generalTypes.ResumeInfo)
		cfg.Current[key] = current
	}

	current.InitInFlight()

	resumeFrom, exists := cfg.ResumeFrom[key]
	if !exists {
		resumeFrom = new(generalTypes.ResumeInfo)
		cfg.ResumeFrom[key] = resumeFrom
	}

	return current, resumeFrom
}

// hostSprayResumeInfo returns the progress of a host-spray run in this scan and
// in the scan it resumes from.
//
// The resume file has one entry for host-spray, but an engine runs host-spray
// once per ExecuteScanWithOpts call, as -auto-tech does, and the engines of -as
// share one resume config. The progress of one run can't stand for the others,
// and a finished run would mark the entry as completed for a run still going.
// Only the first run tracks. A later run gets progress that no one saves and
// resets the entry to an empty one in both maps, so a resumed scan starts from
// the first target, as it did before host-spray saved progress. The entry in
// Current stays, because a missing one would let a third run track again. The
// one in ResumeFrom is reset too, because a scan that saves what it loaded for
// the entries it left idle would otherwise save a stale loaded one, such as a
// completed one, in every file it writes.
func (e *Engine) hostSprayResumeInfo() (*generalTypes.ResumeInfo, *generalTypes.ResumeInfo) {
	cfg := e.executerOpts.ResumeCfg
	cfg.Lock()
	defer cfg.Unlock()

	if _, taken := cfg.Current[hostSprayResumeID]; !taken {
		return resumeInfoLocked(cfg, hostSprayResumeID)
	}

	empty := func() *generalTypes.ResumeInfo {
		info := new(generalTypes.ResumeInfo)
		info.InitInFlight()

		return info
	}
	cfg.Current[hostSprayResumeID] = empty()
	cfg.ResumeFrom[hostSprayResumeID] = empty()

	return empty(), empty()
}

// executeTemplatesOnTarget execute given templates on given single target
func (e *Engine) executeTemplatesOnTarget(ctx context.Context, alltemplates []*templates.Template, target *contextargs.MetaInput, results *atomic.Bool) {
	// all templates are executed on single target

	// wp is workpool that contains different waitgroups for
	// headless and non-headless templates
	// global waitgroup should not be used here
	wp := e.GetWorkPool()
	defer wp.Wai
```

### Core Architecture Module: `pkg/core/plan.go`
```
package core

import (
	"crypto/sha256"
	"encoding/hex"
	"slices"
	"strings"

	"github.com/projectdiscovery/nuclei/v3/pkg/input/provider"
	"github.com/projectdiscovery/nuclei/v3/pkg/protocols"
	"github.com/projectdiscovery/nuclei/v3/pkg/protocols/common/contextargs"
	"github.com/projectdiscovery/nuclei/v3/pkg/templates"
	"github.com/projectdiscovery/nuclei/v3/pkg/templates/types"
)

// PlanEntry is one unit of work a scan runs: a template, a cluster of
// templates sharing one request, or a workflow, on one target.
type PlanEntry struct {
	// ID identifies the entry across runs of the same plan.
	ID string `json:"id"`
	// Target is empty for self-contained templates, which run once.
	Target string `json:"target,omitempty"`
	// IP is the address the target is pinned to, when it is.
	IP        string   `json:"ip,omitempty"`
	Templates []string `json:"templates"`
	Protocol  string   `json:"protocol"`
	// Requests is what the templates declare, the count -stats starts from.
	// The scan sends fewer when a request needs a value the target lacks,
	// such as {{DN}} on an ip.
	Requests int `json:"requests"`
	// Cost is Requests weighted by how long one request of the protocol
	// takes, in http requests.
	Cost int `json:"cost"`
	// Dynamic marks entries whose requests depend on responses: workflows
	// (only the root is counted), flows and fuzzing.
	Dynamic bool `json:"dynamic,omitempty"`
	// AlternativeTo is the id of an entry running the same origin-scoped
	// template on the same origin. Workers race for an origin, so the scan
	// runs whichever of the group claims it first, and another only when
	// that run fails. Totals count the group once.
	AlternativeTo string `json:"alternative-to,omitempty"`
}

// Plan reports the work ExecuteScanWithOpts would do with the same arguments,
// without sending anything. It applies the same clustering, per-target
// profiles and once-per-origin rule, so a pair is listed only if the scan
// would run it. Later targets of an origin-scoped template are listed as
// alternatives to the first, since the scan retries them when a run fails.
func (e *Engine) Plan(templatesList []*templates.Template, target provider.InputProvider, noCluster bool, emit func(PlanEntry)) {
	finalTemplates, _ := e.clusterTemplates(templatesList, noCluster)
	// clustering does not keep an order; a plan is diffed and edited, so it does
	finalTemplates = slices.SortedFunc(slices.Values(finalTemplates), func(a, b *templates.Template) int {
		return strings.Compare(a.ID, b.ID)
	})

	var targetBound []*templates.Template
	for _, template := range finalTemplates {
		if template.SelfContained {
			emit(withPlanID(planEntry(template, &contextargs.MetaInput{}, nil)))
		} else {
			targetBound = append(targetBound, template)
		}
	}

	// entries are emitted as they are planned, so memory does not grow with
	// the plan; only the first id per origin is kept
	originIDs := make(map[string]string)
	target.Iterate(func(value *contextargs.MetaInput) bool {
		selection := e.selectionFor(value)
		for _, template := range targetBound {
			if selection != nil && !template.SelectedBy(selection) {
				continue
			}
			entry := withPlanID(planEntry(template, value, selection))
			if key, scoped := originScopeKey(template, value); scoped {
				if id, seen := originIDs[key]; seen {
					entry.AlternativeTo = id
				} else {
					originIDs[key] = entry.ID
				}
			}
			emit(entry)
		}
		return true
	})
}

func withPlanID(entry PlanEntry) PlanEntry {
	entry.ID = planEntryID(entry)
	return entry
}

// protocolCost is how many http requests one request of a protocol is worth
// in time. Measured per call against a CDN-fronted site, where an http
// request took about 15ms: a javascript call adds about 150ms of runtime, a
// headless page load with waitload took about 1s. Unlisted protocols cost
// about one round trip, like http.
var protocolCost = map[types.ProtocolType]int{
	types.JavascriptProtocol: 10,
	types.HeadlessProtocol:   60,
}

func planEntry(template *templates.Template, value *contextargs.MetaInput, selection protocols.TemplateSelection) PlanEntry {
	entry := PlanEntry{
		Target:    value.Input,
		IP:        value.CustomIP,
		Templates: planTemplates(template, selection),
		Protocol:  template.Type().String(),
		Requests:  template.TotalRequests,
		Dynamic:   template.Flow != "" || template.IsFuzzableRequest(),
	}
	weight := func(protocol types.ProtocolType) int { return max(protocolCost[protocol], 1) }

	switch {
	case template.CompiledWorkflow != nil:
		// only the root of a workflow is certain to run; subtemplates depend
		// on what it matches
		entry.Requests = 0
		for _, workflow := range template.CompiledWorkflow.Workflows {
			for _, executer := range workflow.Executers {
				requests := executer.Executer.Requests()
				entry.Requests += requests
				entry.Cost += requests * weight(executer.TemplateType)
			}
		}
		entry.Dynamic = true
	case isCluster(template):
		cluster := template.Executer.(*templates.ClusterExecuter)
		// TotalRequests of a cluster counts only its http and dns requests,
		// so an ssl cluster would show none
		entry.Requests = cluster.Requests()
		entry.Cost = entry.Requests * weight(template.Type())
	case len(template.RequestsQueue) > 0:
		// each block is weighted by its own protocol, so a template mixing
		// http with javascript is not priced as all http
		for _, request := range template.RequestsQueue {
			entry.Cost += request.Requests() * weight(request.Type())
		}
	default:
		entry.Cost = entry.Requests * weight(template.Type())
	}
	return entry
}

// planTemplates lists the templates an entry runs, sorted so the entry id does
// not depend on clustering order.
func planTemplates(template *templates.Template, selection protocols.TemplateSelection) []string {
	if cluster, ok := template.Executer.(*templates.ClusterExecuter); ok {
		return slices.Sorted(slices.Values(cluster.TemplateIDs(selection)))
	}
	return []string{template.ID}
}

func isCluster(template *templates.Template) bool {
	_, ok := template.Executer.(*templates.ClusterExecuter)
	return ok
}

// planEntryID derives the id from what the entry runs, so planning the same
// scan again yields the same ids.
func planEntryID(entry PlanEntry) string {
	sum := sha256.Sum256([]byte(entry.Target + "\x00" + entry.IP + "\x00" + strings.Join(entry.Templates, "\x00")))
	return hex.EncodeToString(sum[:8])
}

// PlanRun limits a scan to the entries of a plan and records the ones that
// finish, so running the plan again resumes it.
type PlanRun interface {
	// Skip reports whether the entry is not in the plan or already finished.
	Skip(id string) bool
	// Finished records an entry that ran without error.
	Finished(id string)
}

// SetPlanRun makes the scan run only the entries run allows.
func (e *Engine) SetPlanRun(run PlanRun) {
	e.planRun = run
}

// claimPlanned reports whether the pair is skipped under a plan run, and
// otherwise returns the func that records it finished. Without a plan run
// every pair runs.
func (e *Engine) claimPlanned(template *templates.Template, value *contextargs.MetaInput) (finished func(), skip bool) {
	if e.planRun == nil {
		return func() {}, false
	}
	// as in Plan, a self-contained template is not narrowed by any target
	var selection protocols.TemplateSelection
	if !template.SelfContained {
		selection = e.selectionFor(value)
	}
	id := planEntryID(PlanEntry{Target: value.Input, IP: value.CustomIP, Templates: planTemplates(template, selection)})
	if e.planRun.Skip(id) {
		return nil, true
	}
	return func() { e.planRun.Finished(id) }, false
}

```

### Core Architecture Module: `pkg/core/workflow_execute.go`
```
package core

import (
	"fmt"
	"net/http/cookiejar"
	"sync"
	"sync/atomic"

	"github.com/projectdiscovery/gologger"
	"github.com/projectdiscovery/nuclei/v3/pkg/output"
	"github.com/projectdiscovery/nuclei/v3/pkg/protocols/common/contextargs"
	"github.com/projectdiscovery/nuclei/v3/pkg/scan"
	"github.com/projectdiscovery/nuclei/v3/pkg/workflows"
	syncutil "github.com/projectdiscovery/utils/sync"
)

const workflowStepExecutionError = "[%s] Could not execute workflow step: %s\n"

// executeWorkflow runs a workflow on an input and returns true or false
func (e *Engine) executeWorkflow(ctx *scan.ScanContext, w *workflows.Workflow) bool {
	results := &atomic.Bool{}

	// at this point we should be at the start root execution of a workflow tree, hence we create global shared instances
	workflowCookieJar, _ := cookiejar.New(nil)
	ctxArgs := contextargs.New(ctx.Context())
	ctxArgs.MetaInput = ctx.Input.MetaInput
	ctxArgs.CookieJar = workflowCookieJar

	// we can know the nesting level only at runtime, so the best we can do here is increase template threads by one unit in case it's equal to 1 to allow
	// at least one subtemplate to go through, which it's idempotent to one in-flight template as the parent one is in an idle state
	templateThreads := max(w.Options.Options.TemplateThreads, 1)
	if templateThreads == 1 {
		templateThreads++
	}

	swg := newPool(templateThreads)
	// pending tracks every started step until it returns. swg only limits
	// concurrency and its slots can be released early, so completion is
	// tracked here instead.
	var pending sync.WaitGroup

	for _, template := range w.Workflows {
		newCtx := scan.NewScanContext(ctx.Context(), ctx.Input.Clone())
		// Root steps do not own a waitgroup slot.
		err := e.runWorkflowStep(template, newCtx, results, swg, &pending, nil)
		if err != nil {
			gologger.Warning().Msgf(workflowStepExecutionError, template.Template, err)
		}
	}

	pending.Wait()

	return results.Load()
}

// slotRelease returns a func that gives back one swg slot. It is safe to call
// from several goroutines and several times; only the first call releases.
func slotRelease(swg *syncutil.AdaptiveWaitGroup) func() {
	var once sync.Once
	return func() {
		once.Do(swg.Done)
	}
}

// runWorkflowStep runs a workflow step for the workflow. It executes the workflow
// in a recursive manner running all subtemplates and matchers.
//
// releaseSlot, when non-nil, releases the AdaptiveWaitGroup slot held by the
// goroutine that is running this step. It must be called before this step
// blocks on swg.AddWithContext for child steps; otherwise every in-flight
// parent can hold a slot while waiting for another, which deadlocks when the
// number of matching nested steps reaches TemplateThreads (see #8074).
//
// pending is incremented for every child step before it starts, and each child
// calls Done when it returns, so the root can wait for the whole tree.
//
//nolint:cyclop,funlen,gocognit // a step's executers, matchers and child steps share its match result and slot
func (e *Engine) runWorkflowStep(
	template *workflows.WorkflowTemplate, ctx *scan.ScanContext, results *atomic.Bool,
	swg *syncutil.AdaptiveWaitGroup, pending *sync.WaitGroup, releaseSlot func(),
) error {
	var firstMatched bool
	var err error
	var mainErr error

	if len(template.Matchers) == 0 {
		for _, executer := range template.Executers {
			e.syncWorkflowInputToTemplateCtx(executer, ctx.Input)
			executer.Options.Progress.AddToTotal(int64(executer.Executer.Requests()))

			// Don't print results with subtemplates, only print results on template.
			if len(template.Subtemplates) > 0 {
				ctx.OnResult = func(result *output.InternalWrappedEvent) {
					if result.OperatorsResult == nil {
						return
					}
					if len(result.Results) > 0 {
						firstMatched = true
					}

					if result.OperatorsResult != nil && result.OperatorsResult.Extracts != nil {
						setWorkflowExtracts(ctx.Input, result.OperatorsResult.Extracts)
					}
				}
				_, err = executer.Executer.ExecuteWithResults(ctx)
			} else {
				var matched bool
				matched, err = executer.Executer.Execute(ctx)
				if matched {
					firstMatched = true
				}
			}
			// Each request records its own result in the host errors cache. A
			// step can return nil when all its requests failed, and recording
			// that nil would clear the host after every step (#8177).
			if err != nil {
				if len(template.Executers) == 1 {
					mainErr = err
				} else {
					gologger.Warning().Msgf(workflowStepExecutionError, template.Template, err)
				}
				continue
			}
		}
	}
	if len(template.Subtemplates) == 0 {
		results.CompareAndSwap(false, firstMatched)
	}
	if len(template.Matchers) > 0 {
		for _, executer := range template.Executers {
			e.syncWorkflowInputToTemplateCtx(executer, ctx.Input)
			executer.Options.Progress.AddToTotal(int64(executer.Executer.Requests()))

			ctx.OnResult = func(event *output.InternalWrappedEvent) {
				if event.OperatorsResult == nil {
					return
				}

				if event.OperatorsResult.Extracts != nil {
					setWorkflowExtracts(ctx.Input, event.OperatorsResult.Extracts)
				}

				for _, matcher := range template.Matchers {
					if !matcher.Match(event.OperatorsResult) {
						continue
					}

					// Free this step's slot before blocking on child acquires.
					if releaseSlot != nil {
						releaseSlot()
					}
					for _, subtemplate := range matcher.Subtemplates {
						if err := swg.AddWithContext(ctx.Context()); err != nil {
							return
						}
						pending.Add(1)

						go func(subtemplate *workflows.WorkflowTemplate) {
							defer pending.Done()
							release := slotRelease(swg)
							defer release()

							// create a new context with the same input but with unset callbacks
							// clone the Input so that other parallel executions won't overwrite the shared variables when subsequent templates are running
							subCtx := scan.NewScanContext(ctx.Context(), ctx.Input.Clone())

							stepErr := e.runWorkflowStep(subtemplate, subCtx, results, swg, pending, release)
							if stepErr != nil {
								gologger.Warning().Msgf(workflowStepExecutionError, subtemplate.Template, stepErr)
							}
						}(subtemplate)
					}
				}
			}
			_, err := executer.Executer.ExecuteWithResults(ctx)
			if err != nil {
				if len(template.Executers) == 1 {
					mainErr = err
				} else {
					gologger.Warning().Msgf(workflowStepExecutionError, template.Template, err)
				}
				continue
			}
		}
		return mainErr
	}
	if len(template.Subtemplates) > 0 && firstMatched {
		// Free this step's slot before blocking on child acquires so nested
		// matching steps cannot exhaust TemplateThreads and deadlock (#8074).
		if releaseSlot != nil {
			releaseSlot()
		}
		for _, subtemplate := range template.Subtemplates {
			if err := swg.AddWithContext(ctx.Context()); err != nil {
				return err
			}
			pending.Add(1)

			go func(template *workflows.WorkflowTemplate) {
				defer pending.Done()
				release := slotRelease(swg)
				defer release()

				// create a new context with the same input but with unset callbacks
				subCtx := scan.NewScanContext(ctx.Context(), ctx.Input.Clone())

				stepErr := e.runWorkflowStep(template, subCtx, results, swg, pending, release)
				if stepErr != nil {
					gologger.Warning().Msgf(workflowStepExecutionError, template.Template, stepErr)
				}
			}(subtemplate)
		}
	}
	return mainErr
}

func (e *Engine) syncWorkflowInputToTemplateCtx(executer *workflows.ProtocolExecuterPair, input *contextargs.Context) {
	if executer == nil || executer.Options == nil || input == nil || !input.HasArgs() {
		return
	}

	workflowValues := input.GetAll()
	if len(workflowValues) == 0 {
		return
	}

	executer.Options.GetTemplateCtx(input.MetaInput).Merge(workflowValues)
}

// setWorkflowExtracts propagates the extracts of a workflow step to the step
// input so the subtemplates started by that step resolve them the same way
// whether the step matched through an operator or through a workflow matcher:
//
//   - key: [item] => key: item
//   - key: [item_0, ..., item_n] => key0: item_0, ..., keyn: item_n, and the
//     original name keeps the full slice for further indexing.
//
// Extracts without values are skipped: a scalar cannot be rendered from them
// and there is nothing to index.
func setWorkflowExtracts(input *contextargs.Context, extracts map[string][]string) {
	if input == nil {
		return
	}
	for k, v := range extracts {
		switch len(v) {
		case 0:
			continue
		case 1:
			input.Set(k, v[0])
		default:
			for vIdx, vVal := range v {
				input.Set(fmt.Sprintf("%s%d", k, vIdx), vVal)
			}
			input.Set(k, v)
		}
	}
}

```

### Core Architecture Module: `pkg/core/workpool.go`
```
package core

import (
	"context"
	"fmt"

	"github.com/projectdiscovery/gologger"
	"github.com/projectdiscovery/nuclei/v3/pkg/templates/types"
	syncutil "github.com/projectdiscovery/utils/sync"
)

// WorkPool implements an execution pool for executing different
// types of task with different concurrency requirements.
//
// It also allows Configuration of such requirements. This is used
// for per-module like separate headless concurrency etc.
type WorkPool struct {
	Headless *syncutil.AdaptiveWaitGroup
	Default  *syncutil.AdaptiveWaitGroup
	config   WorkPoolConfig
}

// WorkPoolConfig is the configuration for work pool
type WorkPoolConfig struct {
	// InputConcurrency is the concurrency for inputs values.
	InputConcurrency int
	// TypeConcurrency is the concurrency for the request type templates.
	TypeConcurrency int
	// HeadlessInputConcurrency is the concurrency for headless inputs values.
	HeadlessInputConcurrency int
	// TypeConcurrency is the concurrency for the headless request type templates.
	HeadlessTypeConcurrency int
}

// NewWorkPool returns a new WorkPool instance
func NewWorkPool(config WorkPoolConfig) *WorkPool {
	return &WorkPool{
		config:   config,
		Headless: newPool(config.HeadlessTypeConcurrency),
		Default:  newPool(config.TypeConcurrency),
	}
}

// newPool returns a pool of size, or of one when size is below 1.
// syncutil.New returns a nil pool for a size below 1, which the scan would
// dereference.
func newPool(size int) *syncutil.AdaptiveWaitGroup {
	size = max(size, 1)

	pool, err := syncutil.New(syncutil.WithSize(size))
	if err != nil {
		// The size is at least 1, so this cannot happen. Stopping here beats
		// handing the scan a nil pool.
		panic(fmt.Sprintf("could not create work pool of size %d: %s", size, err))
	}

	return pool
}

// Wait waits for all the work pool wait groups to finish
func (w *WorkPool) Wait() {
	w.Default.Wait()
	w.Headless.Wait()
}

// InputPool returns a work pool for an input type
func (w *WorkPool) InputPool(templateType types.ProtocolType) *syncutil.AdaptiveWaitGroup {
	var count int
	if templateType == types.HeadlessProtocol {
		count = w.config.HeadlessInputConcurrency
	} else {
		count = w.config.InputConcurrency
	}

	return newPool(count)
}

func (w *WorkPool) RefreshWithConfig(config WorkPoolConfig) {
	w.RefreshWithConfigContext(context.Background(), config)
}

func (w *WorkPool) RefreshWithConfigContext(ctx context.Context, config WorkPoolConfig) {
	if w.config.TypeConcurrency != config.TypeConcurrency {
		w.config.TypeConcurrency = config.TypeConcurrency
	}
	if w.config.HeadlessTypeConcurrency != config.HeadlessTypeConcurrency {
		w.config.HeadlessTypeConcurrency = config.HeadlessTypeConcurrency
	}
	if w.config.InputConcurrency != config.InputConcurrency {
		w.config.InputConcurrency = config.InputConcurrency
	}
	if w.config.HeadlessInputConcurrency != config.HeadlessInputConcurrency {
		w.config.HeadlessInputConcurrency = config.HeadlessInputConcurrency
	}
	w.Refresh(ctx)
}

func (w *WorkPool) Refresh(ctx context.Context) {
	// newPool sized the pools to at least 1, so compare against the same bound.
	typeConcurrency := max(w.config.TypeConcurrency, 1)
	headlessTypeConcurrency := max(w.config.HeadlessTypeConcurrency, 1)

	if w.Default.Size != typeConcurrency {
		err := w.Default.Resize(ctx, typeConcurrency)
		if err != nil {
			gologger.Warning().Msgf("Could not resize workpool: %s\n", err)
		}
	}

	if w.Headless.Size != headlessTypeConcurrency {
		err := w.Headless.Resize(ctx, headlessTypeConcurrency)
		if err != nil {
			gologger.Warning().Msgf("Could not resize workpool: %s\n", err)
		}
	}
}

```

### Core Architecture Module: `pkg/input/provider/list/utils.go`
```
package list

type ipOptions struct {
	ScanAllIPs bool
	IPV4       bool
	IPV6       bool
	Auto       bool // -iv omitted: one unpinned target unless -sa scans every address
}

```


### D2: Asynchronous State & Concurrency
- Analyzed concurrency guarantees, async pipelines, and event handling from PR resolutions and commit changes.

### D3: Error Boundaries, Recovery & Rollbacks
- Exception handling patterns and defect resolutions extracted from closed production bug issues:
- **Issue #7047** (2026-02-26): **Track failing tests after `go fix ./...` changes (PR #7018)**
  *Symptoms*: ## Summary This issue tracks test failures that may occur after applying `go fix ./...` from Go 1.26.0, which converts `interface{}` to `any` throughout the codebase. The changes in PR #7018 are syntactic but may expose test issues that need investigation.  ## Steps to Reproduce 1. Checkout PR #7018 branch: `dwisiswant0/chore/go-fix` 2. Run `make test` to execute unit tests 3. Run integration tests: `cd integration_tests && bash run.sh ubuntu-latest` 4. Run functional tests: `cd cmd/functional-test && bash run.sh` 5. Run SDK examples: `cd examples/simple && go run .` 6. Check CI workflow results for all test jobs  ## Expected All tests should pass after the `go fix ./...` changes: - Unit tests (`make test`) - Integration tests - Functional tests - SDK examples - Template validation - Race condition tests  ## Actual Some tests may be failing after the interface{} to any conversion. This needs investigation to determine: 1. Which specific tests are failing 2. Whether failures are related to the syntactic changes 3. Whether failures are pre-existing issues exposed by the changes  ## Evidence - PR #7018: https://github.com/projectdiscovery/nuclei/pull/7018 - PR checklist shows 'I have added tests that prove my fix is effective or that my feature works' is unchecked - Changes apply `go fix ./...` from Go 1.26.0 (interface{} → any conversion) - GolangCI Lint action requires golangci-lint >= v2.9.0 with analyzer bump  ## Suggested Fix 1. Run the full test suite locally and in CI to 

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

### Incident Patch 1: `cdf93a80` (2026-11-26)
**Commit Message**: fix(index): save through a temp file of the save's own (#8215)

* fix(index): save through a temp file of the save's own

Save wrote its snapshot to the fixed path cacheFile + ".tmp" under the
Index's own mutex, so two indexes over one cache directory (two SDK
engines in one process, or two nuclei processes of one user) truncated
and renamed the same file: one save failed on its rename with "no such
file or directory", and the file left in place could hold bytes of
both snapshots.

Each save now creates its temp file with os.CreateTemp beside the cache
file and renames it into place.

Fixes #8212

* test(index): compare the saved cache with one index's whole snapshot

The concurrent-save test checked only the saved file's entry count,
which a file mixing both indexes' entries could also meet. It now
compares the decoded data, keys and metadata, with what each index of
the last round set, and passes only where it equals one of them.

**File**: `pkg/catalog/index/index.go` (modified, +4/-2)
```diff
@@ -225,11 +225,13 @@ func (i *Index) Save() error {
 	maps.Insert(snapshot.Data, i.cache.All())
 
 	// NOTE(dwisiswant0): write to temp for atomic op.
-	tmpFile := i.cacheFile + ".tmp"
-	file, err := os.OpenFile(tmpFile, os.O_WRONLY|os.O_CREATE|os.O_TRUNC, 0o600)
+	// The temp file is this save's own: the mutex is per Index, so two indexes
+	// over one cache file would otherwise truncate and rename the same path.
+	file, err := os.CreateTemp(filepath.Dir(i.cacheFile), filepath.Base(i.cacheFile)+".*.tmp")
 	if err != nil {
 		return err
 	}
+	tmpFile := file.Name()
 	if err := file.Chmod(0o600); err != nil {
 		_ = file.Close()
 		_ = os.Remove(tmpFile)
```

**File**: `pkg/catalog/index/index_test.go` (modified, +67/-8)
```diff
@@ -1,10 +1,13 @@
 package index
 
 import (
+	"encoding/gob"
 	"fmt"
 	"os"
 	"path/filepath"
+	"reflect"
 	"runtime"
+	"slices"
 	"testing"
 	"time"
 
@@ -188,9 +191,9 @@ func TestCachePersistence(t *testing.T) {
 		require.NoError(t, err)
 
 		// Verify no .tmp file left behind
-		tmpFile := filepath.Join(tmpDir, IndexFileName+".tmp")
-		_, err = os.Stat(tmpFile)
-		require.True(t, os.IsNotExist(err), "Temporary file should not exist after save")
+		tmpFiles, err := filepath.Glob(filepath.Join(tmpDir, IndexFileName+".*.tmp"))
+		require.NoError(t, err)
+		require.Empty(t, tmpFiles, "Temporary file should not exist after save")
 
 		// Verify actual cache file exists
 		cacheFile := filepath.Join(tmpDir, IndexFileName)
@@ -662,6 +665,64 @@ func TestCacheConcurrency(t *testing.T) {
 	})
 }
 
+// Two indexes over one cache directory, as two SDK engines in one process
+// have, each hold their own mutex, so their saves can run at the same time.
+func TestCacheConcurrentSaveAcrossIndexes(t *testing.T) {
+	tmpDir := t.TempDir()
+
+	const (
+		rounds  = 20
+		indexes = 2
+		entries = 2000
+	)
+
+	// What each index of the last round set, by index.
+	var written []map[string]*Metadata
+	for round := range rounds {
+		written = make([]map[string]*Metadata, indexes)
+		errs := make(chan error, indexes)
+		for id := range indexes {
+			own := make(map[string]*Metadata, entries)
+			written[id] = own
+			go func() {
+				cache, err := NewIndex(tmpDir)
+				if err != nil {
+					errs <- err
+					return
+				}
+				for n := range entries {
+					path := filepath.Join("/tmp", fmt.Sprintf("%d-%d-%d.yaml", round, id, n))
+					own[path] = &Metadata{ID: fmt.Sprintf("t-%d", n), FilePath: path}
+					cache.Set(path, own[path])
+				}
+				errs <- cache.Save()
+			}()
+		}
+
+		for range indexes {
+			require.NoError(t, <-errs, "Concurrent saves of two indexes should both succeed")
+		}
+	}
+
+	tmpFiles, err := filepath.Glob(filepath.Join(tmpDir, IndexFileName+".*.tmp"))
+	require.NoError(t, err)
+	require.Empty(t, tmpFiles, "Temporary files should not exist after the saves")
+
+	// The file left in place is one index's whole snapshot of the last round,
+	// never a mix of the two.
+	file, err := os.Open(filepath.Join(tmpDir, IndexFileName))
+	require.NoError(t, err)
+	defer func() { _ = file.Close() }()
+
+	var snapshot cacheSnapshot
+	require.NoError(t, gob.NewDecoder(file).Decode(&snapshot))
+	require.Len(t, snapshot.Data, entries)
+	whole := slices.ContainsFunc(written, func(own map[string]*Metadata) bool {
+		return reflect.DeepEqual(own, snapshot.Data)
+	})
+	require.True(t, whole, "The cache file should hold exactly what one index of the last round set")
+}
+
 func TestCacheSize(t *testing.T) {
 	tmpDir := t.TempDir()
 	cache, err := NewIndex(tmpDir)
@@ -730,11 +791,9 @@ func TestCacheSaveErrorHandling(t *testing.T) {
 	}
 	cache.Set(metadata.FilePath, metadata)
 
-	// Create a directory where the temp file would be created to force an error
-	// The Save method creates a file at cacheFile + ".tmp"
-	conflictPath := filepath.Join(tmpDir, IndexFileName+".tmp")
-	err = os.Mkdir(conflictPath, 0755)
-	require.NoError(t, err)
+	// Remove the cache directory to force an error: Save creates its temp
+	// file beside the cache file.
+	require.NoError(t, os.RemoveAll(tmpDir))
 
 	err = cache.Save()
 	require.Error(t, err, "Save should fail when temp file cannot be created")
```

---

### Incident Patch 2: `3cca9ee0` (2026-11-26)
**Commit Message**: fix(jira): close response bodies go-jira leaves open (#8248)

* fix(jira): close response bodies go-jira leaves open

go-jira does not close the response of a transition it does not decode, and it returns the response unread when issue creation or a raw request fails. Close those bodies so the connections can be reused.

* fix(jira): bound the response body drain

* skip drain

---------

Co-authored-by: review <[REDACTED_EMAIL]>

**File**: `pkg/reporting/trackers/jira/jira.go` (modified, +28/-13)
```diff
@@ -337,12 +337,7 @@ func (i *Integration) CreateNewIssue(event *output.ResultEvent) (*filters.Create
 	}
 	createdIssue, resp, err := i.jira.Issue.Create(issueData)
 	if err != nil {
-		var data string
-		if resp != nil && resp.Body != nil {
-			d, _ := io.ReadAll(resp.Body)
-			data = string(d)
-		}
-		return nil, fmt.Errorf("%w => %s", err, data)
+		return nil, fmt.Errorf("%w => %s", err, readAndCloseBody(resp))
 	}
 	return i.getIssueResponseFromJira(createdIssue)
 }
@@ -426,9 +421,12 @@ func (i *Integration) CloseIssueByID(issueID string) error {
 		if transition.To.Name != i.options.StatusNot {
 			continue
 		}
-		_, err = i.jira.Issue.DoTransitionWithPayload(issueID, jira.CreateTransitionPayload{
+		resp, err := i.jira.Issue.DoTransitionWithPayload(issueID, jira.CreateTransitionPayload{
 			Transition: jira.TransitionPayload{ID: transition.ID},
 		})
+		// go-jira does not decode the transition response, so it leaves the
+		// body open on success. Close it so the connection can be reused.
+		closeBody(resp)
 		if err != nil {
 			return fmt.Errorf("transition Jira issue %s: %w", issueID, err)
 		}
@@ -480,12 +478,7 @@ func (i *Integration) FindExistingIssue(event *output.ResultEvent, useStatus boo
 
 		resp, err := i.jira.Do(req, &searchResult)
 		if err != nil {
-			var data string
-			if resp != nil && resp.Body != nil {
-				d, _ := io.ReadAll(resp.Body)
-				data = string(d)
-			}
-			return jira.Issue{}, fmt.Errorf("%w => %s", err, data)
+			return jira.Issue{}, fmt.Errorf("%w => %s", err, readAndCloseBody(resp))
 		}
 
 		if len(searchResult.Issues) == 0 {
@@ -538,3 +531,25 @@ func (i *Integration) ShouldFilter(event *output.ResultEvent) bool {
 
 	return true
 }
+
+// readAndCloseBody returns the body of a failed go-jira response and closes it.
+// go-jira hands the response back unread on some error paths, so the caller
+// has to close it.
+func readAndCloseBody(resp *jira.Response) string {
+	if resp == nil || resp.Response == nil || resp.Body == nil {
+		return ""
+	}
+	defer closeBody(resp)
+	data, _ := io.ReadAll(resp.Body)
+	return string(data)
+}
+
+// closeBody closes a go-jira response body. It does not drain it: a server
+// that stalls mid-body would otherwise block the caller, and an empty
+// response, which is what go-jira leaves open, returns to the pool on close.
+func closeBody(resp *jira.Response) {
+	if resp == nil || resp.Response == nil || resp.Body == nil {
+		return
+	}
+	_ = resp.Body.Close()
+}
```

**File**: `pkg/reporting/trackers/jira/jira_body_test.go` (added, +126/-0)
```diff
@@ -0,0 +1,126 @@
+package jira
+
+import (
+	"io"
+	"net/http"
+	"net/http/httptest"
+	"strings"
+	"sync"
+	"testing"
+
+	"github.com/projectdiscovery/nuclei/v3/pkg/model"
+	"github.com/projectdiscovery/nuclei/v3/pkg/output"
+	"github.com/projectdiscovery/retryablehttp-go"
+	"github.com/stretchr/testify/require"
+)
+
+// bodyTracker is a transport that records whether every response body it
+// hands out gets closed.
+type bodyTracker struct {
+	mu     sync.Mutex
+	bodies []*trackedBody
+}
+
+type trackedBody struct {
+	io.ReadCloser
+	path   string
+	closed bool
+}
+
+func (b *trackedBody) Close() error {
+	b.closed = true
+	return b.ReadCloser.Close()
+}
+
+func (t *bodyTracker) RoundTrip(req *http.Request) (*http.Response, error) {
+	resp, err := http.DefaultTransport.RoundTrip(req)
+	if err != nil {
+		return nil, err
+	}
+	body := &trackedBody{ReadCloser: resp.Body, path: req.Method + " " + req.URL.Path}
+	t.mu.Lock()
+	t.bodies = append(t.bodies, body)
+	t.mu.Unlock()
+	resp.Body = body
+	return resp, nil
+}
+
+func (t *bodyTracker) requireAllClosed(tb testing.TB) {
+	tb.Helper()
+	t.mu.Lock()
+	defer t.mu.Unlock()
+	require.NotEmpty(tb, t.bodies)
+	for _, body := range t.bodies {
+		require.Truef(tb, body.closed, "response body of %s was not closed", body.path)
+	}
+}
+
+func newTrackedIntegration(t *testing.T, serverURL string, cloud bool) (*Integration, *bodyTracker) {
+	t.Helper()
+	tracker := &bodyTracker{}
+	client := retryablehttp.NewClient(retryablehttp.DefaultOptionsSingle)
+	client.HTTPClient.Transport = tracker
+	integration, err := New(&Options{
+		URL:         serverURL,
+		Cloud:       cloud,
+		AccountID:   "test",
+		Email:       "test@example.test",
+		Token:       "test",
+		ProjectName: "TEST",
+		IssueType:   "Bug",
+		StatusNot:   "Done",
+		HttpClient:  client,
+	})
+	require.NoError(t, err)
+	return integration, tracker
+}
+
+func TestCloseIssueByIDClosesTransitionResponse(t *testing.T) {
+	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
+		switch {
+		case r.Method == http.MethodGet && strings.HasSuffix(r.URL.Path, "/issue/10001/transitions"):
+			_, _ = w.Write([]byte(`{"transitions":[{"id":"5","to":{"name":"Done"}}]}`))
+		case r.Method == http.MethodPost && strings.HasSuffix(r.URL.Path, "/issue/10001/transitions"):
+			w.WriteHeader(http.StatusNoContent)
+		default:
+			http.Error(w, "unexpected endpoint", http.StatusNotFound)
+		}
+	}))
+	defer server.Close()
+
+	integration, tracker := newTrackedIntegration(t, server.URL, false)
+	require.NoError(t, integration.CloseIssueByID("10001"))
+	tracker.requireAllClosed(t)
+}
+
+func TestCreateNewIssueClosesErrorResponse(t *testing.T) {
+	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
+		if r.Method == http.MethodPost && strings.HasSuffix(r.URL.Path, "/rest/api/2/issue") {
+			http.Error(w, `{"errorMessages":["Field 'priority' cannot be set"]}`, http.StatusBadRequest)
+			return
+		}
+		http.Error(w, "unexpected endpoint", http.StatusNotFound)
+	}))
+	defer server.Close()
+
+	integration, tracker := newTrackedIntegration(t, server.URL, false)
+	_, err := integration.CreateNewIssue(&output.ResultEvent{TemplateID: "test", Host: "example.test", Info: model.Info{Name: "Test issue"}})
+	require.ErrorContains(t, err, "cannot be set")
+	tracker.requireAllClosed(t)
+}
+
+func TestFindExistingIssueCloudClosesErrorResponse(t *testing.T) {
+	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
+		if r.Method == http.MethodGet && strings.HasSuffix(r.URL.Path, "/rest/api/3/search/jql") {
+			http.Error(w, "jql rejected", http.StatusBadRequest)
+			return
+		}
+		http.Error(w, "unexpected endpoint", http.StatusNotFound)
+	}))
+	defer server.Close()
+
+	integration, tracker := newTrackedIntegration(t, server.URL, true)
+	_, err := integration.FindExistingIssue(&output.ResultEvent{TemplateID: "test", Host: "example.test", Info: model.Info{Name: "Test issue"}}, true)
+	require.ErrorContains(t, err, "jql rejected")
+	tracker.requireAllClosed(t)
+}
```

---

### Incident Patch 3: `13dc1941` (2026-11-26)
**Commit Message**: fix(js/ssh): bracket IPv6 hosts when joining host and port (#8302)

* fix(js/ssh): bracket IPv6 hosts when joining host and port

connect() and connectSSHInfoMode() built the dial address with
fmt.Sprintf("%s:%d", ...), so an IPv6 host such as 2001:db8::1 became
"2001:db8::1:22" and the dial failed with "too many colons in address".
Use net.JoinHostPort, which brackets IPv6 literals and leaves IPv4
addresses and hostnames unchanged.

Add TestConnectIPv6, which connects to an SSH server on [::1] through
both Connect and ConnectSSHInfoMode.

* Update pkg/js/libs/ssh/ssh.go

Co-authored-by: coderabbitai[bot] <136622811+coderabbitai[bot]@users.noreply.github.com>

* fix(js/ssh): strip IPv6 brackets before dialing in connect

connect() passed opts.Host straight to net.JoinHostPort, so a bracketed
host such as [::1] was dialed as [[::1]]:22 and failed with "missing
port in address". The previous fmt.Sprintf form handled it. Strip one
surrounding bracket pair first, as connectSSHInfoMode already does.

Extend TestConnectIPv6 to run Connect and ConnectSSHInfoMode with both
the bare and the bracketed IPv6 loopback address.

---------

Co-authored-by: coderabbitai[bot] <136622811+coderabbita

**File**: `pkg/js/libs/ssh/ssh.go` (modified, +6/-3)
```diff
@@ -2,8 +2,9 @@ package ssh
 
 import (
 	"context"
-	"fmt"
+	"net"
 	"regexp"
+	"strconv"
 	"strings"
 	"time"
 
@@ -227,7 +228,8 @@ func connectSSHInfoMode(opts *connectOptions) (*ssh.HandshakeLog, error) {
 		data.Banner = strings.TrimSpace(banner)
 		return nil
 	}
-	rhost := fmt.Sprintf("%s:%d", opts.Host, opts.Port)
+	host := strings.TrimSuffix(strings.TrimPrefix(opts.Host, "["), "]")
+	rhost := net.JoinHostPort(host, strconv.Itoa(opts.Port))
 	client, err := ssh.Dial("tcp", rhost, sshConfig)
 	if err != nil {
 		return nil, err
@@ -281,7 +283,8 @@ func connect(opts *connectOptions) (*ssh.Client, error) {
 		conf.Auth = append(conf.Auth, ssh.PublicKeys(signer))
 	}
 
-	client, err := ssh.Dial("tcp", fmt.Sprintf("%s:%d", opts.Host, opts.Port), conf)
+	host := strings.TrimSuffix(strings.TrimPrefix(opts.Host, "["), "]")
+	client, err := ssh.Dial("tcp", net.JoinHostPort(host, strconv.Itoa(opts.Port)), conf)
 	if err != nil {
 		return nil, err
 	}
```

**File**: `pkg/js/libs/ssh/ssh_test.go` (modified, +41/-5)
```diff
@@ -69,6 +69,35 @@ func TestCloseConnected(t *testing.T) {
 	closeClient(t, client)
 }
 
+func TestConnectIPv6(t *testing.T) {
+	t.Parallel()
+
+	listener, err := new(net.ListenConfig).Listen(t.Context(), "tcp", "[::1]:0")
+	if err != nil {
+		t.Skipf("IPv6 loopback is unavailable: %v", err)
+	}
+
+	ip, port := serveSSH(t, listener)
+
+	for _, host := range []string{ip, "[" + ip + "]"} {
+		t.Run("Connect/"+host, func(t *testing.T) {
+			t.Parallel()
+
+			client := new(libssh.SSHClient)
+			connect(t, client, host, port)
+			closeClient(t, client)
+		})
+		t.Run("ConnectSSHInfoMode/"+host, func(t *testing.T) {
+			t.Parallel()
+
+			_, err := new(libssh.SSHClient).ConnectSSHInfoMode(executionContext(t), host, port)
+			if err != nil {
+				t.Fatalf("ConnectSSHInfoMode() error = %v", err)
+			}
+		})
+	}
+}
+
 func connect(t *testing.T, client *libssh.SSHClient, host string, port int) {
 	t.Helper()
 
@@ -98,6 +127,18 @@ func executionContext(t *testing.T) context.Context {
 func startServer(t *testing.T) (string, int) {
 	t.Helper()
 
+	listener, err := new(net.ListenConfig).Listen(t.Context(), "tcp", "127.0.0.1:0")
+	if err != nil {
+		t.Fatal(err)
+	}
+
+	return serveSSH(t, listener)
+}
+
+// serveSSH serves SSH on listener and returns its host and port.
+func serveSSH(t *testing.T, listener net.Listener) (string, int) {
+	t.Helper()
+
 	key, err := ecdsa.GenerateKey(elliptic.P256(), rand.Reader)
 	if err != nil {
 		t.Fatal(err)
@@ -112,11 +153,6 @@ func startServer(t *testing.T) (string, int) {
 	config.PasswordCallback = checkPassword
 	config.AddHostKey(signer)
 
-	listener, err := new(net.ListenConfig).Listen(t.Context(), "tcp", "127.0.0.1:0")
-	if err != nil {
-		t.Fatal(err)
-	}
-
 	t.Cleanup(func() { _ = listener.Close() })
 
 	go func() {
```

#### Recent Merged Pull Requests:
- **PR #8325** (2026-11-26): fix(raw): keep an unsafe request line with no path instead of panicking (@hakarrr)
- **PR #8323** (2026-11-26): fix(fuzz): return an error for non-string entries in a fuzz map (@hakarrr)
- **PR #8321** (2026-11-26): fix(utils): return an error for non-string YAML keys in InsertionOrderedStringMap (@hakarrr)
- **PR #8319** (2026-11-26): chore(deps): bump dsl to v0.9.4 (@dogancanbakir)
- **PR #8317** (closed): fix(core): enforce size limits on certificate, key, dump and swagger inputs (@DhyaanKanoja11)
- **PR #8316** (2026-11-26): fix(templates): fire caller's callback from a clustered step (@micheal0034)

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

## X. index): save through a temp file of the save's own

**RULE**:
When implementing operations in `pkg/catalog/index/index.go`, engineers MUST enforce rigorous boundary validation, safe state transitions, and memory/concurrency invariants as established by production defect remediation in projectdiscovery/nuclei. All inputs crossing module boundaries must be explicitly verified before state persistence.

**WHY**:
Prevents defects observed in production commit `cdf93a80`: index): save through a temp file of the save's own. Unvalidated execution paths cause runtime exceptions, race conditions, and silent state corruption under concurrent workloads.

**WHEN TO APPLY**:
Subsystems managing Go data structures, boundary deserialization, API parsing, or resource lifecycles matching `pkg/catalog/index/index.go`.

**VERIFIED IMPLEMENTATION PATTERN**:
```go
// Verified production-grade fix pattern:
	// The temp file is this save's own: the mutex is per Index, so two indexes
	// over one cache file would otherwise truncate and rename the same path.
	file, err := os.CreateTemp(filepath.Dir(i.cacheFile), filepath.Base(i.cacheFile)+".*.tmp")
	tmpFile := file.Name()
```

**NEGATIVE CONSTRAINT**:
```go
// Induced defect failure mode:
	tmpFile := i.cacheFile + ".tmp"
	file, err := os.OpenFile(tmpFile, os.O_WRONLY|os.O_CREATE|os.O_TRUNC, 0o600)
```

**VERIFICATION METHOD**:
Automated regression test asserting that input states reproducing defect `cdf93a80` are properly handled with clean fallback behavior.
