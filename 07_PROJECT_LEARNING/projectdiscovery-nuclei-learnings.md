# Forensic Learning Record (Deep Inspection): projectdiscovery/nuclei

> **Canonical Artifact**: `07_PROJECT_LEARNING/projectdiscovery-nuclei-learnings.md`  
> **Source Platform**: GitHub ([https://github.com/projectdiscovery/nuclei](https://github.com/projectdiscovery/nuclei))  
> **Harvest Method**: Full-Spectrum Deep Extraction (Patches, Diffs, Source Code, Post-Mortems)  
> **Harvest Timestamp**: 2026-10-05T18:56:32.591Z  
> **Compliance State**: Free Tier Guaranteed | Strict Rate-Limit Backoff Honored  

---

## 1. Context & Architectural Overview
- **Repository / Resource**: `projectdiscovery/nuclei`
- **Description**: Nuclei is a fast, customizable vulnerability scanner powered by the global security community and built on a simple YAML-based DSL, enabling collaboration to tackle trending vulnerabilities on the internet. It helps you find vulnerabilities in your applications, APIs, networks, DNS, and cloud configurations.
- **Primary Language / Ecosystem**: Go
- **Discovered Manifests / Configurations**: go.mod, README.md, Dockerfile
- **Stars / Engagement**: 31749 stars

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
	"github.com/projectdiscovery/gologger"
	"github.com/projectdiscovery/nuclei/v3/pkg/output"
	"github.com/projectdiscovery/nuclei/v3/pkg/protocols"
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
	workPool                  *WorkPool
	options                   *types.Options
	executerOpts              *protocols.ExecutorOptions
	Callback                  func(*output.ResultEvent) // Executed on results
	templateExecutionCallback TemplateExecutionCallback
	Logger                    *gologger.Logger
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

	totalReqBeforeCluster := getRequestCount(templatesList) * int(target.Count())

	// attempt to cluster templates if noCluster is false
	var finalTemplates []*templates.Template
	clusterCount := 0
	if !noCluster {
		var clusterMappings map[string][]string
		finalTemplates, clusterCount, clusterMappings = templates.ClusterTemplates(templatesList, e.executerOpts)
		// Store cluster mappings in executerOpts for SDK access (thread-safe)
		if clusterMappings != nil {
			e.executerOpts.ClusterMappings = types.NewClusterMappingsMap(clusterMappings)
		}
	} else {
		finalTemplates = templatesList
	}

	totalReqAfterClustering := getRequestCount(finalTemplates) * int(target.Count())

	if !noCluster && totalReqAfterClustering < totalReqBeforeCluster {
		e.Logger.Info().Msgf("Templates clustered: %d (Reduced %d Requests)", clusterCount, totalReqBeforeCluster-totalReqAfterClustering)
	}

	// 0 matches means no templates were found in the directory
	if len(finalTemplates) == 0 {
		return &atomic.Bool{}
	}

	if e.executerOpts.Progress != nil {
		// Notes:
		// workflow requests are not counted as they can be conditional
		// templateList count is user requested templates count (before clustering)
		// totalReqAfterClustering is total requests count after clustering
		e.executerOpts.Progress.Init(target.Count(), len(templatesList), e.expectedRequests(finalTemplates, target, totalReqAfterClustering))
	}

	if stringsutil.EqualFoldAny(e.options.ScanStrategy, scanstrategy.Auto.String(), "") {
		// TODO: this is only a placeholder, auto scan strategy should choose scan strategy
		// based on no of hosts , templates , stream and other optimization parameters
		e.options.ScanStrategy = scanstrategy.TemplateSpray.String()
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
		wp.RefreshWithConfig(e.GetWorkPoolConfig())

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
	wp, _ := syncutil.New(syncutil.WithSize(e.options.BulkSize + e.options.HeadlessBulkSize))
	defer wp.Wait()

	target.Iterate(func(value *contextargs.MetaInput) bool {
		select {
		case <-ctx.Done():
			return false
		default:
		}

		wp.Add()
		go func(targetval *contextargs.MetaInput) {
			defer wp.Done()
			e.executeTemplatesOnTarget(ctx, templatesList, targetval, results)
		}(value)
		return true
	})
	return results
}

// expectedRequests counts only the template and target pairs that per-target
// profiles select, so progress reflects the requests that will be sent.
func (e *Engine) expectedRequests(templatesList []*templates.Template, target provider.InputProvider, unscoped int) int64 {
	scope := e.executerOpts.TargetScope
	if scope == nil {
		return int64(unscoped)
	}
	targets := make(map[protocols.TemplateSelection]int64)
	target.Iterate(func(value *contextargs.MetaInput) bool {
		targets[scope.For(value)]++
		return true
	})
	var total int64
	for selection, count := range targets {
		total += count * int64(getSelectedRequestCount(templatesList, selection))
	}
	return total
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
		// ignore requests in workflows as total requests in workflow
		// depends on what templates will be called in workflow
		if len(template.Workflows) > 0 {
			continue
		}
		if selection != nil && !template.SelectedBy(selection) {
			continue
		}
		count += template.TotalRequests
	}
	return count
}

```

### Core Architecture Module: `pkg/core/executors.go`
```
package core

import (
	"context"
	"sync"
	"sync/atomic"
	"time"

	"github.com/projectdiscovery/nuclei/v3/pkg/input/provider"
	"github.com/projectdiscovery/nuclei/v3/pkg/output"
	"github.com/projectdiscovery/nuclei/v3/pkg/protocols/common/contextargs"
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
	pool := e.workPool.InputPool(template.Type())
	workerCount := 1
	if pool != nil && pool.Size > 0 {
		workerCount = pool.Size
	}

	var (
		index uint32
	)

	e.executerOpts.ResumeCfg.Lock()
	currentInfo, ok := e.executerOpts.ResumeCfg.Current[template.ID]
	if !ok {
		currentInfo = &generalTypes.ResumeInfo{}
		e.executerOpts.ResumeCfg.Current[template.ID] = currentInfo
	}
	currentInfo.InitInFlight()
	resumeFromInfo, ok := e.executerOpts.ResumeCfg.ResumeFrom[template.ID]
	if !ok {
		resumeFromInfo = &generalTypes.ResumeInfo{}
		e.executerOpts.ResumeCfg.ResumeFrom[template.ID] = resumeFromInfo
	}
	e.executerOpts.ResumeCfg.Unlock()

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
					defer cleanupInFlight(t.index)
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

		currentInfo.Lock()
		currentInfo.InFlight[index] = struct{}{}
		currentInfo.Unlock()

		// Skip if the host has had errors
		if inScope && e.executerOpts.HostErrorsCache != nil && e.executerOpts.HostErrorsCache.Check(e.executerOpts.ProtocolType.String(), contextargs.NewWithMetaInput(ctx, scannedValue)) {
			skipEvent := &output.ResultEvent{
				TemplateID:    template.ID,
				TemplatePath:  template.Path,
				Info:          template.Info,
				Type:          e.executerOpts.ProtocolType.String(),
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
			return true
		}

		tasks <- task{index: index, skip: skip, value: scannedValue}
		index++
		return true
	})

	close(tasks)
	workersWg.Wait()

	// on completion marks the template as completed
	currentInfo.Lock()
	currentInfo.Completed = true
	currentInfo.Unlock()
}

// executeTemplatesOnTarget execute given templates on given single target
func (e *Engine) executeTemplatesOnTarget(ctx context.Context, alltemplates []*templates.Template, target *contextargs.MetaInput, results *atomic.Bool) {
	// all templates are executed on single target

	// wp is workpool that contains different waitgroups for
	// headless and non-headless templates
	// global waitgroup should not be used here
	wp := e.GetWorkPool()
	defer wp.Wait()

	for _, tpl := range alltemplates {
		select {
		case <-ctx.Done():
			return
		default:
		}

		if !e.inScope(tpl, target) {
			continue
		}

		// Check whether the target has already been marked as permanently
		// unresponsive by HostErrorsCache before spawning another goroutine.
		if e.executerOpts.HostErrorsCache != nil &&
			e.executerOpts.HostErrorsCache.Check(e.executerOpts.ProtocolType.String(), contextargs.NewWithMetaInput(ctx, target)) {
			skipEvent := &output.ResultEvent{
				TemplateID:    tpl.ID,
				TemplatePath:  tpl.Path,
				Info:          tpl.Info,
				Type:          e.executerOpts.ProtocolType.String(),
				Host:          target.Input,
				MatcherStatus: false,
				Error:         "host was skipped as it was found unresponsive",
				Timestamp:     time.Now(),
			}
			if e.Callback != nil {
				e.Callback(skipEvent)
			} else if e.executerOpts.Output != nil {
				_ = e.executerOpts.Output.Write(skipEvent)
			}
			break
		}

		// resize check point - nop if there are no changes
		wp.RefreshWithConfig(e.GetWorkPoolConfig())

		var sg *syncutil.AdaptiveWaitGroup
		if tpl.Type() == types.HeadlessProtocol {
			sg = wp.Headless
		} else {
			sg = wp.Default
		}
		if err := sg.AddWithContext(ctx); err != nil {
			return
		}
		usesSharedTemplateBudget := tpl.Type() != types.HeadlessProtocol
		if usesSharedTemplateBudget {
			if err := e.options.AcquireTemplateThread(ctx); err != nil {
				sg.Done()
				return
			}
		}
		go func(template *templates.Template, value *contextargs.MetaInput, wg *syncutil.AdaptiveWaitGroup, sharedBudget bool) {
			defer wg.Done()
			if sharedBudget {
				defer e.options.ReleaseTemplateThread()
			}

			match, err := e.executeTemplateOnInput(ctx, template, value)
			if err != nil {
				e.options.Logger.Warning().Msgf("[%s] Could not execute step on %s: %s\n", template.ID, value.Input, err)
			}
			results.CompareAndSwap(false, match)
		}(tpl, target, sg, usesSharedTemplateBudget)
	}
}

// inScope reports whether per-target profiles select template for input.
func (e *Engine) inScope(template *templates.Template, input *contextargs.MetaInput) bool {
	if e.executerOpts.TargetScope == nil {
		return true
	}
	selection := e.executerOpts.TargetScope.For(input)
	return selection == nil || template.SelectedBy(selection)
}

// executeTemplateOnInput performs template execution for a single input and returns match status and error
func (e *Engine) executeTemplateOnInput(ctx context.Context, template *templates.Template, value *contextargs.MetaInput) (bool, error) {
	finished := e.templateExecutionStarted(template, value.Input)
	defer func() { finished(ctx.Err()) }()
	ctxArgs := contextargs.New(ctx)
	ctxArgs.MetaInput = value
	scanCtx := scan.NewScanContext(ctx, ctxArgs)

	switch template.Type() {
	case types.WorkflowProtocol:
		return e.executeWorkflow(scanCtx, template.CompiledWorkflow), nil
	default:
		if e.Callback != nil {
			results, err := template.Executer.ExecuteWithResults(scanCtx)
			if err != nil {
				return false, err
			}
			for _, result := range results {
				e.Callback(result)
			}
			return len(results) > 0, nil
		}
		return template.Executer.Execute(scanCtx)
	}
}

```

### Core Architecture Module: `pkg/core/workflow_execute.go`
```
package core

import (
	"fmt"
	"net/http/cookiejar"
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
	templateThreads := w.Options.Options.TemplateThreads
	if templateThreads == 1 {
		templateThreads++
	}
	swg, _ := syncutil.New(syncutil.WithSize(templateThreads))

	for _, template := range w.Workflows {
		newCtx := scan.NewScanContext(ctx.Context(), ctx.Input.Clone())
		if err := e.runWorkflowStep(template, newCtx, results, swg, w); err != nil {
			gologger.Warning().Msgf(workflowStepExecutionError, template.Template, err)
		}
	}

	swg.Wait()

	return results.Load()
}

// runWorkflowStep runs a workflow step for the workflow. It executes the workflow
// in a recursive manner running all subtemplates and matchers.
func (e *Engine) runWorkflowStep(template *workflows.WorkflowTemplate, ctx *scan.ScanContext, results *atomic.Bool, swg *syncutil.AdaptiveWaitGroup, w *workflows.Workflow) error {
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
						for k, v := range result.OperatorsResult.Extracts {
							// normalize items:
							switch len(v) {
							case 0, 1:
								// - key:[item] => key: item
								ctx.Input.Set(k, v[0])
							default:
								// - key:[item_0, ..., item_n] => key0:item_0, keyn:item_n
								for vIdx, vVal := range v {
									normalizedKIdx := fmt.Sprintf("%s%d", k, vIdx)
									ctx.Input.Set(normalizedKIdx, vVal)
								}
								// also add the original name with full slice
								ctx.Input.Set(k, v)
							}
						}
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
			if w.Options.HostErrorsCache != nil {
				w.Options.HostErrorsCache.MarkFailedOrRemove(w.Options.ProtocolType.String(), ctx.Input, err)
			}
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
					for k, v := range event.OperatorsResult.Extracts {
						ctx.Input.Set(k, v)
					}
				}

				for _, matcher := range template.Matchers {
					if !matcher.Match(event.OperatorsResult) {
						continue
					}

					for _, subtemplate := range matcher.Subtemplates {
						swg.Add()

						go func(subtemplate *workflows.WorkflowTemplate) {
							defer swg.Done()

							// create a new context with the same input but with unset callbacks
							// clone the Input so that other parallel executions won't overwrite the shared variables when subsequent templates are running
							subCtx := scan.NewScanContext(ctx.Context(), ctx.Input.Clone())
							if err := e.runWorkflowStep(subtemplate, subCtx, results, swg, w); err != nil {
								gologger.Warning().Msgf(workflowStepExecutionError, subtemplate.Template, err)
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
		for _, subtemplate := range template.Subtemplates {
			swg.Add()

			go func(template *workflows.WorkflowTemplate) {
				// create a new context with the same input but with unset callbacks
				subCtx := scan.NewScanContext(ctx.Context(), ctx.Input.Clone())
				if err := e.runWorkflowStep(template, subCtx, results, swg, w); err != nil {
					gologger.Warning().Msgf(workflowStepExecutionError, template.Template, err)
				}
				swg.Done()
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

```

### Core Architecture Module: `pkg/core/workpool.go`
```
package core

import (
	"context"

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
	headlessWg, _ := syncutil.New(syncutil.WithSize(config.HeadlessTypeConcurrency))
	defaultWg, _ := syncutil.New(syncutil.WithSize(config.TypeConcurrency))

	return &WorkPool{
		config:   config,
		Headless: headlessWg,
		Default:  defaultWg,
	}
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
	swg, _ := syncutil.New(syncutil.WithSize(count))
	return swg
}

func (w *WorkPool) RefreshWithConfig(config WorkPoolConfig) {
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
	w.Refresh(context.Background())
}

func (w *WorkPool) Refresh(ctx context.Context) {
	if w.Default.Size != w.config.TypeConcurrency {
		if err := w.Default.Resize(ctx, w.config.TypeConcurrency); err != nil {
			gologger.Warning().Msgf("Could not resize workpool: %s\n", err)
		}
	}
	if w.Headless.Size != w.config.HeadlessTypeConcurrency {
		if err := w.Headless.Resize(ctx, w.config.HeadlessTypeConcurrency); err != nil {
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
}

```

### Core Architecture Module: `pkg/installer/util.go`
```
package installer

import (
	"bufio"
	"bytes"
	"fmt"
	"io"
	"io/fs"
	"net/http"
	"os"
	"path/filepath"
	"sort"

	"github.com/Masterminds/semver/v3"
	"github.com/projectdiscovery/gologger"
	"github.com/projectdiscovery/nuclei/v3/pkg/catalog/config"
	"github.com/projectdiscovery/utils/errkit"
)

// GetNewTemplatesInVersions returns templates path of all newly added templates
// in these versions
func GetNewTemplatesInVersions(versions ...string) []string {
	allTemplates := []string{}
	for _, v := range versions {
		if v == config.DefaultConfig.TemplateVersion {
			allTemplates = append(allTemplates, config.DefaultConfig.GetNewAdditions()...)
			continue
		}
		_, err := semver.NewVersion(v)
		if err != nil {
			gologger.Error().Msgf("%v is not a valid semver version. skipping", v)
			continue
		}
		if config.IsOutdatedVersion(v, "v8.8.4") {
			// .new-additions was added in v8.8.4 any version before that is not supported
			gologger.Error().Msgf(".new-additions support was added in v8.8.4 older versions are not supported")
			continue
		}

		arr, err := getNewAdditionsFileFromGitHub(v)
		if err != nil {
			gologger.Error().Msgf("failed to fetch new additions for %v got: %v", v, err)
			continue
		}
		allTemplates = append(allTemplates, arr...)
	}
	return allTemplates
}

func getNewAdditionsFileFromGitHub(version string) ([]string, error) {
	resp, err := retryableHttpClient.Get(fmt.Sprintf("https://raw.githubusercontent.com/projectdiscovery/nuclei-templates/%s/.new-additions", version))
	if err != nil {
		return nil, err
	}
	if resp.StatusCode != http.StatusOK {
		return nil, errkit.New("version not found")
	}
	data, err := io.ReadAll(resp.Body)
	if err != nil {
		return nil, err
	}
	templatesList := []string{}
	scanner := bufio.NewScanner(bytes.NewReader(data))
	for scanner.Scan() {
		text := scanner.Text()
		if text == "" {
			continue
		}
		if config.IsTemplate(text) {
			templatesList = append(templatesList, text)
		}
	}
	return templatesList, nil
}

func PurgeEmptyDirectories(dir string) {
	alldirs := []string{}
	_ = filepath.WalkDir(dir, func(path string, d fs.DirEntry, err error) error {
		if d.IsDir() {
			alldirs = append(alldirs, path)
		}
		return nil
	})
	// sort in ascending order
	sort.Strings(alldirs)
	// reverse the order
	sort.Sort(sort.Reverse(sort.StringSlice(alldirs)))

	for _, d := range alldirs {
		if isEmptyDir(d) {
			_ = os.RemoveAll(d)
		}
	}
}

func isEmptyDir(dir string) bool {
	hasFiles := false
	_ = filepath.WalkDir(dir, func(path string, d fs.DirEntry, err error) error {
		if !d.IsDir() {
			hasFiles = true
			return io.EOF
		}
		return nil
	})
	return !hasFiles
}

```

### Core Architecture Module: `pkg/js/devtools/tsgen/astutil.go`
```
package tsgen

import (
	"fmt"
	"go/ast"
	"strings"
)

// isExported checks if the given name is exported
func isExported(name string) bool {
	return ast.IsExported(name)
}

// exprToString converts an expression to a string
func exprToString(expr ast.Expr) string {
	switch t := expr.(type) {
	case *ast.Ident:
		return toTsTypes(t.Name)
	case *ast.SelectorExpr:
		return exprToString(t.X) + "." + t.Sel.Name
	case *ast.StarExpr:
		return exprToString(t.X)
	case *ast.ArrayType:
		return toTsTypes("[]" + exprToString(t.Elt))
	case *ast.InterfaceType:
		return "interface{}"
	case *ast.MapType:
		return "Record<" + toTsTypes(exprToString(t.Key)) + ", " + toTsTypes(exprToString(t.Value)) + ">"
	// Add more cases to handle other types
	default:
		return fmt.Sprintf("%T", expr)
	}
}

// toTsTypes converts Go types to TypeScript types
func toTsTypes(t string) string {
	if strings.Contains(t, "interface{}") {
		return "any"
	}
	if strings.HasPrefix(t, "map[") {
		return convertMaptoRecord(t)
	}
	switch t {
	case "string":
		return "string"
	case "int", "int8", "int16", "int32", "int64", "uint", "uint8", "uint16", "uint32", "uint64":
		return "number"
	case "float32", "float64":
		return "number"
	case "bool":
		return "boolean"
	case "[]byte":
		return "Uint8Array"
	case "interface{}":
		return "any"
	case "time.Duration":
		return "number"
	case "time.Time":
		return "Date"
	default:
		if strings.HasPrefix(t, "[]") {
			return toTsTypes(strings.TrimPrefix(t, "[]")) + "[]"
		}
		return t
	}
}

func TsDefaultValue(t string) string {
	switch t {
	case "string":
		return `""`
	case "number":
		return `0`
	case "boolean":
		return `false`
	case "Uint8Array":
		return `new Uint8Array(8)`
	case "any":
		return `undefined`
	case "interface{}":
		return `undefined`
	default:
		if strings.Contains(t, "[]") {
			return `[]`
		}
		return "new " + t + "()"
	}
}

// Ternary is a ternary operator for strings
func Ternary(condition bool, trueVal, falseVal string) string {
	if condition {
		return trueVal
	}
	return falseVal
}

// checkCanFail checks if a function can fail
func checkCanFail(fn *ast.FuncDecl) bool {
	if fn.Type.Results != nil {
		for _, result := range fn.Type.Results.List {
			// Check if any of the return types is an error
			if ident, ok := result.Type.(*ast.Ident); ok && ident.Name == "error" {
				return true
			}
		}
	}
	return false
}

```

### Core Architecture Module: `pkg/js/libs/ldap/utils.go`
```
package ldap

import (
	"fmt"
	"strconv"
	"strings"
	"time"

	"github.com/go-ldap/ldap/v3"
)

type (
	// SearchResult contains search result of any / all ldap search request
	// @example
	// ```javascript
	// const ldap = require('nuclei/ldap');
	// const client = new ldap.Client('ldap://ldap.example.com', 'acme.com');
	// const results = client.Search('(objectClass=*)', 'cn', 'mail');
	// ```
	SearchResult struct {
		// Referrals contains list of referrals
		Referrals []string `json:"referrals"`
		// Controls contains list of controls
		Controls []string `json:"controls"`
		// Entries contains list of entries
		Entries []LdapEntry `json:"entries"`
	}

	// LdapEntry represents a single LDAP entry
	LdapEntry struct {
		// DN contains distinguished name
		DN string `json:"dn"`
		// Attributes contains list of attributes
		Attributes LdapAttributes `json:"attributes"`
	}

	// LdapAttributes represents all LDAP attributes of a particular
	// ldap entry
	LdapAttributes struct {
		// CurrentTime contains current time
		CurrentTime []string `json:"currentTime,omitempty"`
		// SubschemaSubentry contains subschema subentry
		SubschemaSubentry []string `json:"subschemaSubentry,omitempty"`
		// DsServiceName contains ds service name
		DsServiceName []string `json:"dsServiceName,omitempty"`
		// NamingContexts contains naming contexts
		NamingContexts []string `json:"namingContexts,omitempty"`
		// DefaultNamingContext contains default naming context
		DefaultNamingContext []string `json:"defaultNamingContext,omitempty"`
		// SchemaNamingContext contains schema naming context
		SchemaNamingContext []string `json:"schemaNamingContext,omitempty"`
		// ConfigurationNamingContext contains configuration naming context
		ConfigurationNamingContext []string `json:"configurationNamingContext,omitempty"`
		// RootDomainNamingContext contains root domain naming context
		RootDomainNamingContext []string `json:"rootDomainNamingContext,omitempty"`
		// SupportedLDAPVersion contains supported LDAP version
		SupportedLDAPVersion []string `json:"supportedLDAPVersion,omitempty"`
		// HighestCommittedUSN contains highest committed USN
		HighestCommittedUSN []string `json:"highestCommittedUSN,omitempty"`
		// SupportedSASLMechanisms contains supported SASL mechanisms
		SupportedSASLMechanisms []string `json:"supportedSASLMechanisms,omitempty"`
		// DnsHostName contains DNS host name
		DnsHostName []string `json:"dnsHostName,omitempty"`
		// LdapServiceName contains LDAP service name
		LdapServiceName []string `json:"ldapServiceName,omitempty"`
		// ServerName contains server name
		ServerName []string `json:"serverName,omitempty"`
		// IsSynchronized contains is synchronized
		IsSynchronized []string `json:"isSynchronized,omitempty"`
		// IsGlobalCatalogReady contains is global catalog ready
		IsGlobalCatalogReady []string `json:"isGlobalCatalogReady,omitempty"`
		// DomainFunctionality contains domain functionality
		DomainFunctionality []string `json:"domainFunctionality,omitempty"`
		// ForestFunctionality contains forest functionality
		ForestFunctionality []string `json:"forestFunctionality,omitempty"`
		// DomainControllerFunctionality contains domain controller functionality
		DomainControllerFunctionality []string `json:"domainControllerFunctionality,omitempty"`
		// DistinguishedName contains the distinguished name
		DistinguishedName []string `json:"distinguishedName,omitempty"`
		// SAMAccountName contains the SAM account name
		SAMAccountName []string `json:"sAMAccountName,omitempty"`
		// PWDLastSet contains the password last set time
		PWDLastSet []string `json:"pwdLastSet,omitempty"`
		// LastLogon contains the last logon time
		LastLogon []string `json:"lastLogon,omitempty"`
		// MemberOf contains the groups the entry is a member of
		MemberOf []string `json:"memberOf,omitempty"`
		// ServicePrincipalName contains the service principal names
		ServicePrincipalName []string `json:"servicePrincipalName,omitempty"`
		// Extra contains other extra fields which might be present
		Extra map[string]any `json:"extra,omitempty"`
	}
)

// getSearchResult converts a ldap.SearchResult to a SearchResult
func getSearchResult(sr *ldap.SearchResult) *SearchResult {
	t := &SearchResult{
		Referrals: []string{},
		Controls:  []string{},
		Entries:   []LdapEntry{},
	}
	// add referrals
	t.Referrals = append(t.Referrals, sr.Referrals...)
	// add controls
	for _, ctrl := range sr.Controls {
		t.Controls = append(t.Controls, ctrl.String())
	}
	// add entries
	for _, entry := range sr.Entries {
		t.Entries = append(t.Entries, parseLdapEntry(entry))
	}
	return t
}

func parseLdapEntry(entry *ldap.Entry) LdapEntry {
	e := LdapEntry{
		DN: entry.DN,
	}
	attrs := LdapAttributes{
		Extra: make(map[string]any),
	}
	for _, attr := range entry.Attributes {
		switch attr.Name {
		case "currentTime":
			attrs.CurrentTime = decodeTimestamps(attr.Values)
		case "subschemaSubentry":
			attrs.SubschemaSubentry = attr.Values
		case "dsServiceName":
			attrs.DsServiceName = attr.Values
		case "namingContexts":
			attrs.NamingContexts = attr.Values
		case "defaultNamingContext":
			attrs.DefaultNamingContext = attr.Values
		case "schemaNamingContext":
			attrs.SchemaNamingContext = attr.Values
		case "configurationNamingContext":
			attrs.ConfigurationNamingContext = attr.Values
		case "rootDomainNamingContext":
			attrs.RootDomainNamingContext = attr.Values
		case "supportedLDAPVersion":
			attrs.SupportedLDAPVersion = attr.Values
		case "highestCommittedUSN":
			attrs.HighestCommittedUSN = attr.Values
		case "supportedSASLMechanisms":
			attrs.SupportedSASLMechanisms = attr.Values
		case "dnsHostName":
			attrs.DnsHostName = attr.Values
		case "ldapServiceName":
			attrs.LdapServiceName = attr.Values
		case "serverName":
			attrs.ServerName = attr.Values
		case "isSynchronized":
			attrs.IsSynchronized = attr.Values
		case "isGlobalCatalogReady":
			attrs.IsGlobalCatalogReady = attr.Values
		case "domainFunctionality":
			attrs.DomainFunctionality = attr.Values
		case "forestFunctionality":
			attrs.ForestFunctionality = attr.Values
		case "domainControllerFunctionality":
			attrs.DomainControllerFunctionality = attr.Values
		case "distinguishedName":
			attrs.DistinguishedName = attr.Values
		case "sAMAccountName":
			attrs.SAMAccountName = attr.Values
		case "pwdLastSet":
			attrs.PWDLastSet = decodeTimestamps(attr.Values)
		case "lastLogon":
			attrs.LastLogon = decodeTimestamps(attr.Values)
		case "memberOf":
			attrs.MemberOf = attr.Values
		case "servicePrincipalName":
			attrs.ServicePrincipalName = attr.Values
		default:
			attrs.Extra[attr.Name] = attr.Values
		}
	}
	e.Attributes = attrs
	return e
}

// decodeTimestamps  decodes multiple timestamps
func decodeTimestamps(timestamps []string) []string {
	res := []string{}
	for _, timestamp := range timestamps {
		res = append(res, DecodeADTimestamp(timestamp))
	}
	return res
}

// DecodeSID decodes a SID string
// @example
// ```javascript
// const ldap = require('nuclei/ldap');
// const sid = ldap.DecodeSID('S-1-5-21-3623811015-3361044348-30300820-1013');
// log(sid);
// ```
func DecodeSID(s string) string {
	b := []byte(s)
	revisionLvl := int(b[0])
	subAuthorityCount := int(b[1]) & 0xFF

	var authority int
	for i := 2; i <= 7; i++ {
		authority = authority | int(b[i])<<(8*(5-(i-2)))
	}

	var size = 4
	var offset = 8
	var subAuthorities []int
	for i := 0; i < subAuthorityCount; i++ {
		var subAuthority int
		for k := 0; k < size; k++ {
			subAuthority = subAuthority | (int(b[offset+k])&0xFF)<<(8*k)
		}
		subAuthorities = append(subAuthorities, subAuthority)
		offset += size
	}

	var builder strings.Builder
	builder.WriteString("S-")
	fmt.Fprintf(&builder, "%d-", revisionLvl)
	fmt.Fprintf(&builder, "%d", authority)
	for _, v := range subAuthorities {
		fmt.Fprintf(&builder, "-%d", v)
	}
	return builder.String()
}

// DecodeADTimestamp decodes an Active Directory timestamp
// @example
// ```javascript
// const ldap = require('nuclei/ldap');
// const timestamp = ldap.DecodeADTimestamp('132036744000000000');
// log(timestamp);
// ```
func DecodeADTimestamp(timestamp string) string {
	adtime, _ := strconv.ParseInt(timestamp, 10, 64)
	if (adtime == 9223372036854775807) || (adtime == 0) {
		return "Not Set"
	}
	unixtime_int64 := adtime/(10*1000*1000) - 11644473600
	unixtime := time.Unix(unixtime_int64, 0)
	return unixtime.Format("2006-01-02 3:4:5 pm")
}

// DecodeZuluTimestamp decodes a Zulu timestamp
// @example
// ```javascript
// const ldap = require('nuclei/ldap');
// const timestamp = ldap.DecodeZuluTimestamp('2021-08-25T10:00:00Z');
// log(timestamp);
// ```
func DecodeZuluTimestamp(timestamp string) string {
	zulu, err := time.Parse(time.RFC3339, timestamp)
	if err != nil {
		return ""
	}
	return zulu.Format("2006-01-02 3:4:5 pm")
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

### Incident Patch 1: `1884ed92` (2026-10-05)
**Commit Message**: Merge pull request #7807 from projectdiscovery/perf/fast-downloader-timeout-tests

cut unit and integration test runtime

**File**: `.github/workflows/tests.yaml` (modified, +0/-10)
```diff
@@ -45,16 +45,6 @@ jobs:
       - uses: actions/checkout@v7.0.1
       - uses: projectdiscovery/actions/setup/go@v1
       - uses: projectdiscovery/nuclei-action/cache@v3
-      - uses: projectdiscovery/actions/free-disk-space@v1
-        with:
-          llvm: 'false'
-          php: 'false'
-          mongodb: 'false'
-          mysql: 'false'
-          misc-packages: 'false'
-          docker-images: 'false'
-          tools-cache: 'false'
-      - run: make build
       # The data-race detector is OS-independent, so we only pay its ~2-3x cost
       # on ubuntu; windows/macOS run the same suite without instrumentation.
       - name: "Unit tests (race)"
```

**File**: `Makefile` (modified, +1/-1)
```diff
@@ -94,7 +94,7 @@ test:
 # Keep this under the GitHub Actions step timeout (50m) so a hung nuclei process
 # is reported by go test instead of the runner killing the job with no test name.
 integration:
-	$(GOTEST) -tags=integration -timeout 40m ./internal/tests/integration
+	$(GOTEST) -tags=integration -timeout 40m -v ./internal/tests/integration
 
 integration-debug:
 	$(GOTEST) -tags=integration ./internal/tests/integration -v $(GO_TEST_ARGS) -args $(INTEGRATION_ARGS)
```

**File**: `internal/tests/integration/integration_test.go` (modified, +26/-6)
```diff
@@ -73,17 +73,27 @@ func TestMain(m *testing.M) {
 	templatesDir := filepath.Join(homeDir, config.NucleiTemplatesDirName)
 	config.DefaultConfig.SetTemplatesDir(templatesDir)
 
+	baseEnv := []string{
+		"NUCLEI_TEMPLATES_DIR=" + templatesDir,
+		"XDG_CONFIG_HOME=" + filepath.Join(tempDir, "config"),
+		"XDG_STATE_HOME=" + filepath.Join(tempDir, "state"),
+		"XDG_CACHE_HOME=" + filepath.Join(tempDir, "cache"),
+	}
+	// cases run nuclei with -duc, so the official templates some of them read
+	// are installed once here rather than by whichever cases start first, which
+	// queued them behind each other's downloads inside their own timeouts
+	if err := installTemplates(binaryPath, baseEnv); err != nil {
+		fmt.Fprintln(os.Stderr, err)
+		_ = os.RemoveAll(tempDir)
+		os.Exit(1)
+	}
+
 	previousRunner := testutils.DefaultRunner()
 	runner := testutils.NewRunner(
 		testutils.WithBinaryPath(binaryPath),
 		testutils.WithWorkingDir(workingFixturesDir),
 		testutils.WithExtraArgs(integrationExtraArgs...),
-		testutils.WithBaseEnv(
-			"NUCLEI_TEMPLATES_DIR="+templatesDir,
-			"XDG_CONFIG_HOME="+filepath.Join(tempDir, "config"),
-			"XDG_STATE_HOME="+filepath.Join(tempDir, "state"),
-			"XDG_CACHE_HOME="+filepath.Join(tempDir, "cache"),
-		),
+		testutils.WithBaseEnv(baseEnv...),
 	)
 	testutils.SetDefaultRunner(runner)
 
@@ -124,6 +134,16 @@ func buildNucleiBinary(repoRoot, binaryPath string) error {
 	return nil
 }
 
+func installTemplates(binaryPath string, env []string) error {
+	cmd := exec.Command(binaryPath, "-update-templates", "-no-color")
+	cmd.Env = append(os.Environ(), env...)
+	output, err := cmd.CombinedOutput()
+	if err != nil {
+		return fmt.Errorf("failed to install nuclei templates: %w\n%s", err, strings.TrimSpace(string(output)))
+	}
+	return nil
+}
+
 func isDebugMode() bool {
 	for _, envVar := range []string{"DEBUG", "ACTIONS_STEP_DEBUG", "ACTIONS_RUNNER_DEBUG", "RUNNER_DEBUG"} {
 		if envTruthy(envVar) {
```

**File**: `internal/tests/testutils/integration.go` (modified, +3/-0)
```diff
@@ -261,6 +261,9 @@ func (r *Runner) ArgsResults(debug bool, args ...string) ([]string, error) {
 	output, err := r.runCommand(false, "", func(cmd *exec.Cmd) {
 		cmd.Args = append(cmd.Args[:1], append(append([]string{}, args...), r.ExtraArgs...)...)
 		cmd.Env = r.buildEnv(nil)
+		if r.DisableAutoUpdate {
+			cmd.Args = append(cmd.Args, "-duc")
+		}
 		if debug {
 			cmd.Args = append(cmd.Args, "-debug")
 			cmd.Stderr = os.Stderr
```

**File**: `internal/tests/testutils/testutils.go` (modified, +40/-37)
```diff
@@ -40,43 +40,46 @@ func Cleanup(options *types.Options) {
 
 // DefaultOptions is the default options structure for nuclei during mocking.
 var DefaultOptions = &types.Options{
-	Debug:                      false,
-	DebugRequests:              false,
-	DebugResponse:              false,
-	Silent:                     false,
-	Verbose:                    false,
-	NoColor:                    true,
-	UpdateTemplates:            false,
-	JSONL:                      false,
-	OmitRawRequests:            false,
-	EnableProgressBar:          false,
-	TemplateList:               false,
-	Stdin:                      false,
-	StopAtFirstMatch:           false,
-	NoMeta:                     false,
-	Project:                    false,
-	MetricsPort:                0,
-	BulkSize:                   25,
-	TemplateThreads:            10,
-	Timeout:                    5,
-	Retries:                    1,
-	RateLimit:                  150,
-	RateLimitDuration:          time.Second,
-	ProbeConcurrency:           50,
-	ProjectPath:                "",
-	Severities:                 severity.Severities{},
-	Targets:                    []string{},
-	TargetsFilePath:            "",
-	Output:                     "",
-	Proxy:                      []string{},
-	TraceLogFile:               "",
-	Templates:                  []string{},
-	ExcludedTemplates:          []string{},
-	CustomHeaders:              []string{},
-	InteractshURL:              "https://oast.fun",
-	InteractionsCacheSize:      5000,
-	InteractionsEviction:       60,
-	InteractionsCoolDownPeriod: 5,
+	Debug:                 false,
+	DebugRequests:         false,
+	DebugResponse:         false,
+	Silent:                false,
+	Verbose:               false,
+	NoColor:               true,
+	UpdateTemplates:       false,
+	JSONL:                 false,
+	OmitRawRequests:       false,
+	EnableProgressBar:     false,
+	TemplateList:          false,
+	Stdin:                 false,
+	StopAtFirstMatch:      false,
+	NoMeta:                false,
+	Project:               false,
+	MetricsPort:           0,
+	BulkSize:              25,
+	TemplateThreads:       10,
+	Timeout:               5,
+	Retries:               1,
+	RateLimit:             150,
+	RateLimitDuration:     time.Second,
+	ProbeConcurrency:      50,
+	ProjectPath:           "",
+	Severities:            severity.Severities{},
+	Targets:               []string{},
+	TargetsFilePath:       "",
+	Output:                "",
+	Proxy:                 []string{},
+	TraceLogFile:          "",
+	Templates:             []string{},
+	ExcludedTemplates:     []string{},
+	CustomHeaders:         []string{},
+	InteractshURL:         "https://oast.fun",
+	InteractionsCacheSize: 5000,
+	InteractionsEviction:  60,
+	// Closing an interactsh client sleeps for the cooldown, waiting on callbacks
+	// that a unit test never receives, so every test generating an oast url paid
+	// five seconds for nothing.
+	InteractionsCoolDownPeriod: 0,
 	InteractionsPollDuration:   5,
 	GitHubTemplateRepo:         []string{},
 	GitHubToken:                "",
```

**File**: `pkg/catalog/config/state.go` (modified, +29/-0)
```diff
@@ -59,6 +59,35 @@ func (c *Config) ReadTemplatesConfig() error {
 	return nil
 }
 
+// ReloadTemplateVersion refreshes the installed templates version from disk.
+// Concurrent processes read the version once at startup, so one that waited on
+// another's install or update must reload it to see the result instead of
+// downloading the same release again. State recorded for a different templates
+// directory is ignored.
+func (c *Config) ReloadTemplateVersion() error {
+	statePath := c.getTemplatesConfigFilePath()
+	data, err := os.ReadFile(statePath)
+	if errors.Is(err, os.ErrNotExist) {
+		return nil
+	} else if err != nil {
+		return fmt.Errorf("read templates state %q: %w", statePath, err)
+	}
+
+	var state templatesState
+	if err := json.Unmarshal(data, &state); err != nil {
+		return fmt.Errorf("decode templates state %q: %w", statePath, err)
+	}
+
+	c.m.Lock()
+	defer c.m.Unlock()
+	// compare the resolved directory, so state written through a symlink is
+	// visible to a process using the real path, and the other way around
+	if CanonicalTemplatesPath(state.TemplatesDirectory) == CanonicalTemplatesPath(c.TemplatesDirectory) {
+		c.TemplateVersion = state.TemplateVersion
+	}
+	return nil
+}
+
 // WriteTemplatesConfig atomically writes restart-persistent templates state.
 func (c *Config) WriteTemplatesConfig() error {
 	state := templatesState{
```

**File**: `pkg/catalog/config/state_test.go` (modified, +91/-0)
```diff
@@ -139,3 +139,94 @@ func writeTestFile(t *testing.T, path string, data []byte, mode os.FileMode) {
 		t.Fatalf("write test file: %v", err)
 	}
 }
+
+func TestReloadTemplateVersion(t *testing.T) {
+	newConfig := func(t *testing.T, templatesDir string) *Config {
+		t.Helper()
+		cfg := &Config{stateDir: t.TempDir()}
+		cfg.setTemplatesDir(templatesDir)
+		return cfg
+	}
+
+	t.Run("adopts the version another process installed", func(t *testing.T) {
+		templatesDir := t.TempDir()
+		cfg := newConfig(t, templatesDir)
+		other := &Config{stateDir: cfg.stateDir, TemplateVersion: "v2.0.0"}
+		other.setTemplatesDir(templatesDir)
+		if err := other.WriteTemplatesConfig(); err != nil {
+			t.Fatalf("write templates state: %v", err)
+		}
+
+		if err := cfg.ReloadTemplateVersion(); err != nil {
+			t.Fatalf("reload templates version: %v", err)
+		}
+		if cfg.TemplateVersion != "v2.0.0" {
+			t.Fatalf("template version = %q, want v2.0.0", cfg.TemplateVersion)
+		}
+	})
+
+	t.Run("ignores state of another templates directory", func(t *testing.T) {
+		cfg := newConfig(t, t.TempDir())
+		cfg.TemplateVersion = "v1.0.0"
+		other := &Config{stateDir: cfg.stateDir, TemplateVersion: "v2.0.0"}
+		other.setTemplatesDir(t.TempDir())
+		if err := other.WriteTemplatesConfig(); err != nil {
+			t.Fatalf("write templates state: %v", err)
+		}
+
+		if err := cfg.ReloadTemplateVersion(); err != nil {
+			t.Fatalf("reload templates version: %v", err)
+		}
+		if cfg.TemplateVersion != "v1.0.0" {
+			t.Fatalf("template version = %q, want v1.0.0", cfg.TemplateVersion)
+		}
+	})
+
+	t.Run("keeps the loaded version without state", func(t *testing.T) {
+		cfg := newConfig(t, t.TempDir())
+		cfg.TemplateVersion = "v1.0.0"
+
+		if err := cfg.ReloadTemplateVersion(); err != nil {
+			t.Fatalf("reload templates version: %v", err)
+		}
+		if cfg.TemplateVersion != "v1.0.0" {
+			t.Fatalf("template version = %q, want v1.0.0", cfg.TemplateVersion)
+		}
+	})
+
+	t.Run("adopts the version written through the other name of a symlink", func(t *testing.T) {
+		templatesDir := t.TempDir()
+		link := filepath.Join(t.TempDir(), "templates-link")
+		if err := os.Symlink(templatesDir, link); err != nil {
+			t.Skipf("symlinks are unavailable: %v", err)
+		}
+
+		cfg := newConfig(t, link)
+		other := &Config{stateDir: cfg.stateDir, TemplateVersion: "v2.0.0"}
+		other.setTemplatesDir(templatesDir)
+		if err := other.WriteTemplatesConfig(); err != nil {
+			t.Fatalf("write templates state: %v", err)
+		}
+
+		if err := cfg.ReloadTemplateVersion(); err != nil {
+			t.Fatalf("reload templates version: %v", err)
+		}
+		if cfg.TemplateVersion != "v2.0.0" {
+			t.Fatalf("template version = %q, want v2.0.0", cfg.TemplateVersion)
+		}
+
+		cfg.TemplateVersion = "v1.0.0"
+		cfg.setTemplatesDir(templatesDir)
+		writer := &Config{stateDir: cfg.stateDir, TemplateVersion: "v3.0.0"}
+		writer.setTemplatesDir(link)
+		if err := writer.WriteTemplatesConfig(); err != nil {
+			t.Fatalf("write templates state through the link: %v", err)
+		}
+		if err := cfg.ReloadTemplateVersion(); err != nil {
+			t.Fatalf("reload templates version: %v", err)
+		}
+		if cfg.TemplateVersion != "v3.0.0" {
+			t.Fatalf("template version = %q, want v3.0.0", cfg.TemplateVersion)
+		}
+	})
+}
```

**File**: `pkg/catalog/config/templates_path.go` (added, +62/-0)
```diff
@@ -0,0 +1,62 @@
+package config
+
+import (
+	"os"
+	"path/filepath"
+	"strings"
+)
+
+// CanonicalTemplatesPath is the identity of a templates directory. A symlink
+// and its target are the same directory, including while the target does not
+// exist yet, so a lock and a reloaded version follow either name.
+func CanonicalTemplatesPath(path string) string {
+	if strings.TrimSpace(path) == "" {
+		return ""
+	}
+	return resolveTemplatesPath(path, map[string]struct{}{})
+}
+
+func resolveTemplatesPath(path string, seen map[string]struct{}) string {
+	abs, err := filepath.Abs(path)
+	if err != nil {
+		abs = filepath.Clean(path)
+	}
+	if _, ok := seen[abs]; ok {
+		return abs
+	}
+	seen[abs] = struct{}{}
+
+	dir := abs
+	var missing []string
+	for {
+		info, err := os.Lstat(dir)
+		if err == nil {
+			if info.Mode()&os.ModeSymlink != 0 {
+				if resolved, err := filepath.EvalSymlinks(dir); err == nil {
+					return filepath.Join(append([]string{resolved}, missing...)...)
+				}
+				target, readErr := os.Readlink(dir)
+				if readErr != nil {
+					return filepath.Join(append([]string{dir}, missing...)...)
+				}
+				if !filepath.IsAbs(target) {
+					target = filepath.Join(filepath.Dir(dir), target)
+				}
+				resolvedTarget := resolveTemplatesPath(target, seen)
+				return filepath.Join(append([]string{resolvedTarget}, missing...)...)
+			}
+			resolved := dir
+			if r, err := filepath.EvalSymlinks(dir); err == nil {
+				resolved = r
+			}
+			return filepath.Join(append([]string{resolved}, missing...)...)
+		}
+
+		parent := filepath.Dir(dir)
+		if parent == dir {
+			return filepath.Join(append([]string{dir}, missing...)...)
+		}
+		missing = append([]string{filepath.Base(dir)}, missing...)
+		dir = parent
+	}
+}
```

---

### Incident Patch 2: `fa876a4d` (2026-10-05)
**Commit Message**: fix(installer): give every alias of a templates directory the same update lock

**File**: `pkg/installer/update_lock.go` (modified, +24/-9)
```diff
@@ -41,17 +41,32 @@ func withTemplatesUpdateLock(templatesDir string, fn func() error) error {
 }
 
 // templatesUpdateLockPath derives one lock per templates directory, so updates
-// of different directories do not wait on each other. The parent is resolved
-// rather than the directory itself because a fresh install locks a directory
-// that does not exist yet, and both sides must derive the same path.
+// of different directories do not wait on each other. Every alias of a
+// directory must map to the same lock, including before a fresh install
+// creates it, so the path is resolved through its deepest existing ancestor.
 func templatesUpdateLockPath(templatesDir string) string {
-	dir, err := filepath.Abs(templatesDir)
+	sum := sha256.Sum256([]byte(resolveExistingPrefix(templatesDir)))
+	return filepath.Join(os.TempDir(), fmt.Sprintf("nuclei-templates-update-%x.lock", sum[:8]))
+}
+
+// resolveExistingPrefix resolves symlinks in the longest existing prefix of
+// path and appends the components that do not exist yet.
+func resolveExistingPrefix(path string) string {
+	dir, err := filepath.Abs(path)
 	if err != nil {
-		dir = filepath.Clean(templatesDir)
+		dir = filepath.Clean(path)
 	}
-	if parent, err := filepath.EvalSymlinks(filepath.Dir(dir)); err == nil {
-		dir = filepath.Join(parent, filepath.Base(dir))
+
+	var missing []string
+	for {
+		if resolved, err := filepath.EvalSymlinks(dir); err == nil {
+			return filepath.Join(append([]string{resolved}, missing...)...)
+		}
+		parent := filepath.Dir(dir)
+		if parent == dir {
+			return filepath.Join(append([]string{dir}, missing...)...)
+		}
+		missing = append([]string{filepath.Base(dir)}, missing...)
+		dir = parent
 	}
-	sum := sha256.Sum256([]byte(dir))
-	return filepath.Join(os.TempDir(), fmt.Sprintf("nuclei-templates-update-%x.lock", sum[:8]))
 }
```

**File**: `pkg/installer/update_lock_test.go` (modified, +11/-2)
```diff
@@ -19,9 +19,18 @@ func TestTemplatesUpdateLockPath(t *testing.T) {
 	})
 
 	t.Run("stable across a fresh install creating the directory", func(t *testing.T) {
-		dir := filepath.Join(t.TempDir(), "nuclei-templates")
+		dir := filepath.Join(t.TempDir(), "missing", "nuclei-templates")
 		before := templatesUpdateLockPath(dir)
-		require.NoError(t, os.Mkdir(dir, 0o755))
+		require.NoError(t, os.MkdirAll(dir, 0o755))
 		require.Equal(t, before, templatesUpdateLockPath(dir))
 	})
+
+	t.Run("symlink to a directory, same lock", func(t *testing.T) {
+		dir := t.TempDir()
+		link := filepath.Join(t.TempDir(), "templates-link")
+		if err := os.Symlink(dir, link); err != nil {
+			t.Skipf("symlinks are unavailable: %v", err)
+		}
+		require.Equal(t, templatesUpdateLockPath(dir), templatesUpdateLockPath(link))
+	})
 }
```

---

### Incident Patch 3: `0ae69a7d` (2026-10-01)
**Commit Message**: fix(installer): reload the templates version after taking the update lock

**File**: `pkg/catalog/config/state.go` (modified, +27/-0)
```diff
@@ -59,6 +59,33 @@ func (c *Config) ReadTemplatesConfig() error {
 	return nil
 }
 
+// ReloadTemplateVersion refreshes the installed templates version from disk.
+// Concurrent processes read the version once at startup, so one that waited on
+// another's install or update must reload it to see the result instead of
+// downloading the same release again. State recorded for a different templates
+// directory is ignored.
+func (c *Config) ReloadTemplateVersion() error {
+	statePath := c.getTemplatesConfigFilePath()
+	data, err := os.ReadFile(statePath)
+	if errors.Is(err, os.ErrNotExist) {
+		return nil
+	} else if err != nil {
+		return fmt.Errorf("read templates state %q: %w", statePath, err)
+	}
+
+	var state templatesState
+	if err := json.Unmarshal(data, &state); err != nil {
+		return fmt.Errorf("decode templates state %q: %w", statePath, err)
+	}
+
+	c.m.Lock()
+	defer c.m.Unlock()
+	if filepath.Clean(state.TemplatesDirectory) == filepath.Clean(c.TemplatesDirectory) {
+		c.TemplateVersion = state.TemplateVersion
+	}
+	return nil
+}
+
 // WriteTemplatesConfig atomically writes restart-persistent templates state.
 func (c *Config) WriteTemplatesConfig() error {
 	state := templatesState{
```

**File**: `pkg/catalog/config/state_test.go` (modified, +55/-0)
```diff
@@ -139,3 +139,58 @@ func writeTestFile(t *testing.T, path string, data []byte, mode os.FileMode) {
 		t.Fatalf("write test file: %v", err)
 	}
 }
+
+func TestReloadTemplateVersion(t *testing.T) {
+	newConfig := func(t *testing.T, templatesDir string) *Config {
+		t.Helper()
+		cfg := &Config{stateDir: t.TempDir()}
+		cfg.setTemplatesDir(templatesDir)
+		return cfg
+	}
+
+	t.Run("adopts the version another process installed", func(t *testing.T) {
+		templatesDir := t.TempDir()
+		cfg := newConfig(t, templatesDir)
+		other := &Config{stateDir: cfg.stateDir, TemplateVersion: "v2.0.0"}
+		other.setTemplatesDir(templatesDir)
+		if err := other.WriteTemplatesConfig(); err != nil {
+			t.Fatalf("write templates state: %v", err)
+		}
+
+		if err := cfg.ReloadTemplateVersion(); err != nil {
+			t.Fatalf("reload templates version: %v", err)
+		}
+		if cfg.TemplateVersion != "v2.0.0" {
+			t.Fatalf("template version = %q, want v2.0.0", cfg.TemplateVersion)
+		}
+	})
+
+	t.Run("ignores state of another templates directory", func(t *testing.T) {
+		cfg := newConfig(t, t.TempDir())
+		cfg.TemplateVersion = "v1.0.0"
+		other := &Config{stateDir: cfg.stateDir, TemplateVersion: "v2.0.0"}
+		other.setTemplatesDir(t.TempDir())
+		if err := other.WriteTemplatesConfig(); err != nil {
+			t.Fatalf("write templates state: %v", err)
+		}
+
+		if err := cfg.ReloadTemplateVersion(); err != nil {
+			t.Fatalf("reload templates version: %v", err)
+		}
+		if cfg.TemplateVersion != "v1.0.0" {
+			t.Fatalf("template version = %q, want v1.0.0", cfg.TemplateVersion)
+		}
+	})
+
+	t.Run("keeps the loaded version without state", func(t *testing.T) {
+		cfg := newConfig(t, t.TempDir())
+		cfg.TemplateVersion = "v1.0.0"
+
+		if err := cfg.ReloadTemplateVersion(); err != nil {
+			t.Fatalf("reload templates version: %v", err)
+		}
+		if cfg.TemplateVersion != "v1.0.0" {
+			t.Fatalf("template version = %q, want v1.0.0", cfg.TemplateVersion)
+		}
+	})
+}
```

**File**: `pkg/installer/template.go` (modified, +6/-0)
```diff
@@ -123,6 +123,12 @@ func (t *TemplateManager) updateIfOutdatedLocked() error {
 		return errkit.Wrapf(err, "failed to recover template ownership at %s", config.DefaultConfig.TemplatesDirectory)
 	}
 
+	// the version in memory predates the lock; a process that held it before
+	// this one may have already installed the latest release
+	if err := config.DefaultConfig.ReloadTemplateVersion(); err != nil {
+		gologger.Debug().Msgf("Could not reload templates version, using the one loaded at startup: %s", err)
+	}
+
 	needsUpdate := config.DefaultConfig.NeedsTemplateUpdate()
 
 	// NOTE(dwisiswant0): if PDTM API data is not available
```

**File**: `pkg/installer/template_test.go` (modified, +26/-0)
```diff
@@ -57,6 +57,32 @@ func TestTemplateInstallation(t *testing.T) {
 	require.Len(t, ownership.Files, len(templates), "fresh installation should record ownership of every installed template")
 }
 
+func TestUpdateIfOutdatedSkipsReleaseInstalledWhileWaiting(t *testing.T) {
+	templatesDir := t.TempDir()
+	stateDir := t.TempDir()
+
+	// another process held the update lock and installed the latest release
+	installer := &config.Config{TemplateVersion: "v2.0.0"}
+	installer.SetStateDir(stateDir)
+	installer.SetTemplatesDir(templatesDir)
+	require.NoError(t, installer.WriteTemplatesConfig())
+
+	// this process loaded its state before that install finished
+	cfg := &config.Config{LatestNucleiTemplatesVersion: "v2.0.0", Logger: gologger.DefaultLogger}
+	cfg.SetStateDir(stateDir)
+	cfg.SetTemplatesDir(templatesDir)
+	previousConfig := config.DefaultConfig
+	config.DefaultConfig = cfg
+	t.Cleanup(func() { config.DefaultConfig = previousConfig })
+
+	tm := &TemplateManager{fetchLatestRelease: func() (templateRelease, error) {
+		t.Fatal("downloaded a release another process already installed")
+		return nil, nil
+	}}
+	require.NoError(t, tm.UpdateIfOutdated())
+	require.Equal(t, "v2.0.0", cfg.TemplateVersion)
+}
+
 func TestIsOutdatedVersion(t *testing.T) {
 	testCases := []struct {
 		current  string
```

---

### Incident Patch 4: `4d7e91e4` (2026-10-01)
**Commit Message**: ci: drop unused build and disk cleanup from the tests job

**File**: `.github/workflows/tests.yaml` (modified, +0/-10)
```diff
@@ -45,16 +45,6 @@ jobs:
       - uses: actions/checkout@v7.0.1
       - uses: projectdiscovery/actions/setup/go@v1
       - uses: projectdiscovery/nuclei-action/cache@v3
-      - uses: projectdiscovery/actions/free-disk-space@v1
-        with:
-          llvm: 'false'
-          php: 'false'
-          mongodb: 'false'
-          mysql: 'false'
-          misc-packages: 'false'
-          docker-images: 'false'
-          tools-cache: 'false'
-      - run: make build
       # The data-race detector is OS-independent, so we only pay its ~2-3x cost
       # on ubuntu; windows/macOS run the same suite without instrumentation.
       - name: "Unit tests (race)"
```

---

### Incident Patch 5: `26b28c69` (2026-10-01)
**Commit Message**: test(installer): serve releases from memory and isolate the update lock

**File**: `pkg/installer/main_test.go` (added, +29/-0)
```diff
@@ -0,0 +1,29 @@
+package installer
+
+import (
+	"fmt"
+	"os"
+	"testing"
+)
+
+// TestMain gives this package its own temp directory. The templates update lock
+// lives in os.TempDir and is machine wide, while `go test ./...` runs packages
+// in parallel: tests here that took the lock queued behind other packages
+// downloading the real nuclei-templates repo under it, which cost several
+// minutes in CI for a test that does 40ms of work.
+func TestMain(m *testing.M) {
+	dir, err := os.MkdirTemp("", "nuclei-installer-test-*")
+	if err != nil {
+		fmt.Fprintf(os.Stderr, "could not create temp dir: %v\n", err)
+		os.Exit(1)
+	}
+	// os.TempDir reads TMPDIR on unix and TMP then TEMP on windows
+	for _, key := range []string{"TMPDIR", "TMP", "TEMP"} {
+		_ = os.Setenv(key, dir)
+	}
+
+	code := m.Run()
+
+	_ = os.RemoveAll(dir)
+	os.Exit(code)
+}
```

**File**: `pkg/installer/release_test.go` (added, +89/-0)
```diff
@@ -0,0 +1,89 @@
+package installer
+
+import (
+	"archive/zip"
+	"bytes"
+	"encoding/json"
+	"fmt"
+	"io"
+	"net/http"
+	"sort"
+	"strings"
+	"testing"
+)
+
+// fakeTemplateRelease serves an in-memory nuclei-templates release in place of
+// the GitHub API, so tests run the real downloader without fetching the actual
+// repository, which cost several minutes per test on windows.
+type fakeTemplateRelease struct {
+	version string
+	files   map[string]string
+}
+
+const fakeZipballURL = "https://api.github.com/repos/projectdiscovery/nuclei-templates/zipball/fake"
+
+func (r fakeTemplateRelease) RoundTrip(req *http.Request) (*http.Response, error) {
+	switch {
+	case strings.HasSuffix(req.URL.Path, "/releases/latest"):
+		body, err := json.Marshal(map[string]string{"tag_name": r.version, "zipball_url": fakeZipballURL})
+		if err != nil {
+			return nil, err
+		}
+		return fakeResponse(req, "application/json", body), nil
+	case req.URL.String() == fakeZipballURL:
+		body, err := r.zipball()
+		if err != nil {
+			return nil, err
+		}
+		return fakeResponse(req, "application/zip", body), nil
+	}
+	return nil, fmt.Errorf("unexpected request to %s", req.URL)
+}
+
+func (r fakeTemplateRelease) zipball() ([]byte, error) {
+	names := make([]string, 0, len(r.files))
+	for name := range r.files {
+		names = append(names, name)
+	}
+	sort.Strings(names)
+
+	var buf bytes.Buffer
+	archive := zip.NewWriter(&buf)
+	for _, name := range names {
+		// a github zipball nests every entry under one root directory
+		header := &zip.FileHeader{Name: "projectdiscovery-nuclei-templates-test/" + name, Method: zip.Deflate}
+		header.SetMode(0o644)
+		w, err := archive.CreateHeader(header)
+		if err != nil {
+			return nil, err
+		}
+		if _, err := io.WriteString(w, r.files[name]); err != nil {
+			return nil, err
+		}
+	}
+	if err := archive.Close(); err != nil {
+		return nil, err
+	}
+	return buf.Bytes(), nil
+}
+
+func fakeResponse(req *http.Request, contentType string, body []byte) *http.Response {
+	return &http.Response{
+		StatusCode:    http.StatusOK,
+		Header:        http.Header{"Content-Type": {contentType}},
+		Body:          io.NopCloser(bytes.NewReader(body)),
+		ContentLength: int64(len(body)),
+		Request:       req,
+	}
+}
+
+// useTemplateRelease routes the installer's GitHub requests to release for the
+// rest of the test. The downloader builds its client without a transport, so
+// swapping http.DefaultTransport reaches it; tests calling this must not run in
+// parallel.
+func useTemplateRelease(t *testing.T, release fakeTemplateRelease) {
+	t.Helper()
+	previous := http.DefaultTransport
+	http.DefaultTransport = release
+	t.Cleanup(func() { http.DefaultTransport = previous })
+}
```

**File**: `pkg/installer/template_test.go` (modified, +24/-33)
```diff
@@ -19,52 +19,43 @@ func TestTemplateInstallation(t *testing.T) {
 	// along with necessary changes that are made
 	HideProgressBar = true
 
+	templates := []string{
+		"http/cves/2024/CVE-2024-0001.yaml",
+		"http/cves/2024/CVE-2024-0002.yaml",
+		"http/exposures/configs/git-config.yaml",
+		"dns/dns-saas-service-detection.yaml",
+		"network/detection/rdp-detect.yaml",
+	}
+	release := fakeTemplateRelease{version: "v9.9.9", files: map[string]string{
+		config.NucleiIgnoreFileName: "tags:\n  - fuzz\n",
+		"README.md":                 "# nuclei-templates",
+	}}
+	for _, path := range templates {
+		release.files[path] = "id: " + filepath.Base(path)
+	}
+	useTemplateRelease(t, release)
+
 	tm := &TemplateManager{}
-	dir, err := os.MkdirTemp("", "nuclei-templates-*")
-	require.Nil(t, err)
-	cfgdir, err := os.MkdirTemp("", "nuclei-config-*")
-	require.Nil(t, err)
-	defer func() {
-		_ = os.RemoveAll(dir)
-		_ = os.RemoveAll(cfgdir)
-	}()
+	dir := t.TempDir()
+	cfgdir := t.TempDir()
 
 	// set the config directory to a temporary directory
 	config.DefaultConfig.SetConfigDir(cfgdir)
 	// set the templates directory to a temporary directory
 	templatesTempDir := filepath.Join(dir, "templates")
 	config.DefaultConfig.SetTemplatesDir(templatesTempDir)
 
-	err = tm.FreshInstallIfNotExists()
-	if err != nil {
-		if strings.Contains(err.Error(), "rate limit") {
-			t.Skip("Skipping test due to github rate limit")
-		}
-		require.Nil(t, err)
-	}
+	require.NoError(t, tm.FreshInstallIfNotExists())
 
-	// we should switch to more fine granular tests for template
-	// integrity, but for now, we just check that the templates are installed
-	counter := 0
-	err = filepath.Walk(templatesTempDir, func(path string, info os.FileInfo, err error) error {
-		if err != nil {
-			return err
-		}
-		if !info.IsDir() {
-			counter++
-		}
-		return nil
-	})
-	require.Nil(t, err)
-
-	// we should have at least 1000 templates
-	require.Greater(t, counter, 1000)
+	for _, path := range templates {
+		require.FileExists(t, filepath.Join(templatesTempDir, filepath.FromSlash(path)))
+	}
+	require.NoFileExists(t, filepath.Join(templatesTempDir, "README.md"), "meta files are not installed as templates")
 	// every time we install templates, it should override the ignore file with latest one
 	require.FileExists(t, config.DefaultConfig.GetActiveIgnoreFilePath())
 	ownership, err := loadTemplateOwnership(templatesTempDir)
 	require.NoError(t, err)
-	require.NotEmpty(t, ownership.Files, "fresh installation should record official template ownership")
-	t.Logf("Installed %d templates", counter)
+	require.Len(t, ownership.Files, len(templates), "fresh installation should record ownership of every installed template")
 }
 
 func TestIsOutdatedVersion(t *testing.T) {
```

---

### Incident Patch 6: `4d9f2f98` (2026-09-30)
**Commit Message**: test(headless): reset debug state between engine tests

**File**: `pkg/protocols/headless/engine/page_actions_test.go` (modified, +4/-0)
```diff
@@ -1014,6 +1014,10 @@ func testHeadless(t *testing.T, actions []*Action, timeout time.Duration, handle
 	require.Nil(t, err, "could not create browser instance")
 	defer func() {
 		_ = instance.Close()
+		// A debug action sets these on the browser rather than the page, so with
+		// a shared browser they would leak into every later test.
+		sharedBrowser.engine.SlowMotion(0)
+		sharedBrowser.engine.Trace(false)
 	}()
 
 	ts := httptest.NewServer(http.HandlerFunc(handler))
```

---

### Incident Patch 7: `8ffccaf6` (2026-09-30)
**Commit Message**: test(input): stop waiting out the real timeout in downloader tests

**File**: `pkg/input/formats/openapi/downloader_test.go` (modified, +15/-3)
```diff
@@ -8,6 +8,8 @@ import (
 	"strings"
 	"testing"
 	"time"
+
+	"github.com/projectdiscovery/retryablehttp-go"
 )
 
 func TestOpenAPIDownloader_SupportedExtensions(t *testing.T) {
@@ -181,7 +183,9 @@ func TestOpenAPIDownloader_Download_InvalidJSON(t *testing.T) {
 func TestOpenAPIDownloader_Download_Timeout(t *testing.T) {
 	// Create mock server with delay
 	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
-		time.Sleep(35 * time.Second) // Longer than 30 second timeout
+		// Outlasts the client timeout below. Waiting out the real 30s default
+		// cost this test 35s, which was a seventh of the whole unit suite.
+		time.Sleep(500 * time.Millisecond)
 		if err := json.NewEncoder(w).Encode(map[string]interface{}{"test": "data"}); err != nil {
 			http.Error(w, "failed to encode response", http.StatusInternalServerError)
 		}
@@ -200,9 +204,17 @@ func TestOpenAPIDownloader_Download_Timeout(t *testing.T) {
 	}()
 
 	downloader := &OpenAPIDownloader{}
-	_, err = downloader.Download(server.URL+"/openapi.json", tmpDir, nil)
+	client := retryablehttp.NewClient(retryablehttp.DefaultOptionsSingle)
+	client.HTTPClient.Timeout = 100 * time.Millisecond
+	_, err = downloader.Download(server.URL+"/openapi.json", tmpDir, client)
 	if err == nil {
-		t.Error("Expected timeout error, but got none")
+		t.Fatal("Expected timeout error, but got none")
+	}
+	// Assert it timed out rather than merely erroring: the spec this server
+	// returns is invalid, so a test that only checks for any error passes even
+	// when the timeout never fires.
+	if !os.IsTimeout(err) && !strings.Contains(err.Error(), "Timeout") {
+		t.Fatalf("Expected a timeout error, got: %v", err)
 	}
 }
 
```

**File**: `pkg/input/formats/swagger/downloader_test.go` (modified, +15/-3)
```diff
@@ -9,6 +9,8 @@ import (
 	"testing"
 	"time"
 
+	"github.com/projectdiscovery/retryablehttp-go"
+
 	"gopkg.in/yaml.v3"
 )
 
@@ -268,7 +270,9 @@ func TestSwaggerDownloader_Download_InvalidYAML(t *testing.T) {
 func TestSwaggerDownloader_Download_Timeout(t *testing.T) {
 	// Create mock server with delay
 	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
-		time.Sleep(35 * time.Second) // Longer than 30 second timeout
+		// Outlasts the client timeout below. Waiting out the real 30s default
+		// cost this test 35s, which was a seventh of the whole unit suite.
+		time.Sleep(500 * time.Millisecond)
 		if err := json.NewEncoder(w).Encode(map[string]interface{}{"test": "data"}); err != nil {
 			http.Error(w, "failed to encode response", http.StatusInternalServerError)
 		}
@@ -287,9 +291,17 @@ func TestSwaggerDownloader_Download_Timeout(t *testing.T) {
 	}()
 
 	downloader := &SwaggerDownloader{}
-	_, err = downloader.Download(server.URL+"/swagger.json", tmpDir, nil)
+	client := retryablehttp.NewClient(retryablehttp.DefaultOptionsSingle)
+	client.HTTPClient.Timeout = 100 * time.Millisecond
+	_, err = downloader.Download(server.URL+"/swagger.json", tmpDir, client)
 	if err == nil {
-		t.Error("Expected timeout error, but got none")
+		t.Fatal("Expected timeout error, but got none")
+	}
+	// Assert it timed out rather than merely erroring: the spec this server
+	// returns is invalid, so a test that only checks for any error passes even
+	// when the timeout never fires.
+	if !os.IsTimeout(err) && !strings.Contains(err.Error(), "Timeout") {
+		t.Fatalf("Expected a timeout error, got: %v", err)
 	}
 }
 
```

---

### Incident Patch 8: `010ee044` (2026-09-24)
**Commit Message**: fix inputs

**File**: `pkg/operators/matchers/validate.go` (modified, +5/-0)
```diff
@@ -140,6 +140,11 @@ func (matcher *Matcher) validateLLM() error {
 		if len(matcher.Inputs) < 2 {
 			return fmt.Errorf("llm matcher inputs needs at least two entries, got %d", len(matcher.Inputs))
 		}
+		for index, input := range matcher.Inputs {
+			if strings.TrimSpace(input) == "" {
+				return fmt.Errorf("llm matcher inputs entry %d cannot be blank", index)
+			}
+		}
 	}
 	return nil
 }
```

**File**: `pkg/operators/matchers/validate_test.go` (modified, +1/-0)
```diff
@@ -47,4 +47,5 @@ func TestValidateLLMInputs(t *testing.T) {
 
 	require.NoError(t, compile([]string{"{{body_1}}", "{{body_2}}"}))
 	require.ErrorContains(t, compile([]string{"{{body_1}}"}), "at least two entries")
+	require.ErrorContains(t, compile([]string{"{{body_1}}", "  "}), "cannot be blank")
 }
```

**File**: `pkg/protocols/http/operators.go` (modified, +43/-2)
```diff
@@ -76,15 +76,56 @@ func resolveLLMInputs(inputs []string, data map[string]interface{}) ([]string, b
 	}
 	resolved := make([]string, 0, len(inputs))
 	for _, input := range inputs {
-		value := replacer.Replace(input, data)
-		if strings.Contains(value, marker.ParenthesisOpen) || strings.Contains(value, marker.General) {
+		value, ok := resolveLLMInput(input, data)
+		if !ok {
 			return nil, false
 		}
 		resolved = append(resolved, value)
 	}
 	return resolved, true
 }
 
+// resolveLLMInput interpolates only the placeholders written in the input
+// template. Response text is left opaque, so a body that happens to contain
+// "{{" or "§" is not treated as an unresolved marker and is not scanned for
+// further substitutions.
+func resolveLLMInput(input string, data map[string]interface{}) (string, bool) {
+	values := make(map[string]interface{})
+	for _, key := range llmInputPlaceholders(input) {
+		value, ok := data[key]
+		if !ok {
+			return "", false
+		}
+		values[key] = value
+	}
+	return replacer.Replace(input, values), true
+}
+
+func llmInputPlaceholders(input string) []string {
+	keys := collectMarkers(input, marker.ParenthesisOpen, marker.ParenthesisClose)
+	return append(keys, collectMarkers(input, marker.General, marker.General)...)
+}
+
+func collectMarkers(input, open, close string) []string {
+	var keys []string
+	for start := 0; start < len(input); {
+		from := strings.Index(input[start:], open)
+		if from < 0 {
+			break
+		}
+		from += start + len(open)
+		to := strings.Index(input[from:], close)
+		if to < 0 {
+			break
+		}
+		if key := input[from : from+to]; key != "" {
+			keys = append(keys, key)
+		}
+		start = from + to + len(close)
+	}
+	return keys
+}
+
 // targetValueKeys are the target-derived values an llm prompt may interpolate.
 var targetValueKeys = []string{"BaseURL", "RootURL", "Hostname", "Host", "Port", "Scheme", "Path", "Input", "Type"}
 
```

**File**: `pkg/protocols/http/operators_test.go` (modified, +19/-0)
```diff
@@ -526,6 +526,25 @@ func TestResolveLLMInputs(t *testing.T) {
 	_, ok = resolveLLMInputs([]string{"{{body_1}}", "{{body_2}}"}, map[string]interface{}{"body_1": "only one"})
 	require.False(t, ok)
 
+	// a page that contains template-like text is still a resolved response
+	withMarkers := map[string]interface{}{
+		"body_1": "hello {{user}}",
+		"body_2": "no such user",
+		"user":   "must-not-leak",
+	}
+	resolved, ok = resolveLLMInputs([]string{"{{body_1}}", "{{body_2}}"}, withMarkers)
+	require.True(t, ok)
+	require.Equal(t, []string{"hello {{user}}", "no such user"}, resolved, "body text stays opaque")
+
+	withSection := map[string]interface{}{
+		"body_1":   "token §Hostname§ here",
+		"body_2":   "other",
+		"Hostname": "must-not-leak",
+	}
+	resolved, ok = resolveLLMInputs([]string{"{{body_1}}", "{{body_2}}"}, withSection)
+	require.True(t, ok)
+	require.Equal(t, []string{"token §Hostname§ here", "other"}, resolved)
+
 	nilInputs, ok := resolveLLMInputs(nil, data)
 	require.True(t, ok)
 	require.Nil(t, nilInputs)
```

---

### Incident Patch 9: `71f9782b` (2026-09-24)
**Commit Message**: Merge pull request #7777 from projectdiscovery/fix/7775-sonic-warning

fix(json): keep sonic out of builds it does not support

**File**: `pkg/utils/json/json.go` (modified, +6/-1)
```diff
@@ -1,4 +1,9 @@
-//go:build !gofuzz && (linux || darwin || windows) && (amd64 || arm64)
+// sonic compiles its fast paths only for the Go versions it has adopted, and
+// prints a warning from init on any other toolchain before falling back to
+// encoding/json. Mirroring its constraint here keeps that fallback silent: on a
+// Go version sonic does not support we never link it and use encoding/json
+// directly. Raise the upper bound when sonic adds support for a new Go version.
+//go:build !gofuzz && (linux || darwin || windows) && (amd64 || arm64) && go1.17 && !go1.28
 
 package json
 
```

**File**: `pkg/utils/json/json_fallback.go` (modified, +1/-1)
```diff
@@ -1,4 +1,4 @@
-//go:build gofuzz || !(linux || darwin || windows) || !(amd64 || arm64)
+//go:build gofuzz || !(linux || darwin || windows) || !(amd64 || arm64) || !go1.17 || go1.28
 
 package json
 
```

---

### Incident Patch 10: `536e427c` (2026-09-24)
**Commit Message**: Merge pull request #7776 from projectdiscovery/fix/7764-go-1.27

chore(deps): require go 1.27.1

**File**: `go.mod` (modified, +64/-73)
```diff
@@ -1,41 +1,6 @@
 module github.com/projectdiscovery/nuclei/v3
 
-go 1.26.8
-
-require (
-	github.com/andygrunwald/go-jira v1.16.1
-	github.com/antchfx/htmlquery v1.3.5
-	github.com/go-playground/validator/v10 v10.26.0
-	github.com/go-rod/rod v0.116.2
-	github.com/gobwas/ws v1.4.0
-	github.com/invopop/jsonschema v0.13.0
-	github.com/itchyny/gojq v0.12.17
-	github.com/json-iterator/go v1.1.12 // indirect
-	github.com/julienschmidt/httprouter v1.3.0
-	github.com/logrusorgru/aurora v2.0.3+incompatible // indirect
-	github.com/miekg/dns v1.1.73
-	github.com/olekukonko/tablewriter v1.0.8
-	github.com/pkg/errors v0.9.1
-	github.com/projectdiscovery/clistats v0.1.7
-	github.com/projectdiscovery/fastdialer v0.5.21
-	github.com/projectdiscovery/hmap v0.0.102
-	github.com/projectdiscovery/interactsh v1.3.1
-	github.com/projectdiscovery/rawhttp v0.1.92
-	github.com/projectdiscovery/retryabledns v1.0.116
-	github.com/projectdiscovery/retryablehttp-go v1.3.27
-	github.com/projectdiscovery/yamldoc-go v1.0.7
-	github.com/remeh/sizedwaitgroup v1.0.0
-	github.com/rs/xid v1.6.0
-	github.com/segmentio/ksuid v1.0.4
-	github.com/spaolacci/murmur3 v1.1.0 // indirect
-	github.com/spf13/cast v1.10.0
-	github.com/syndtr/goleveldb v1.0.0
-	github.com/weppos/publicsuffix-go v0.50.3 // indirect
-	go.uber.org/multierr v1.11.0
-	golang.org/x/net v0.58.0
-	golang.org/x/oauth2 v0.36.0
-	golang.org/x/text v0.41.0
-)
+go 1.27.1
 
 require (
 	carvel.dev/ytt v0.52.0
@@ -51,8 +16,11 @@ require (
 	github.com/Mzack9999/goimpacket v0.0.0-20260422121140-7085336a0415
 	github.com/RedTeamPentesting/adauth v0.5.4-0.20260511073005-3d18e8a5a687
 	github.com/adrg/xdg v0.5.3
+	github.com/alecthomas/chroma v0.10.0
 	github.com/alexsnet/go-vnc v0.1.0
 	github.com/alitto/pond v1.9.2
+	github.com/andygrunwald/go-jira v1.16.1
+	github.com/antchfx/htmlquery v1.3.5
 	github.com/antchfx/xmlquery v1.4.4
 	github.com/antchfx/xpath v1.3.6
 	github.com/aws/aws-sdk-go-v2 v1.41.5
@@ -71,19 +39,27 @@ require (
 	github.com/fullstorydev/grpcurl v1.9.3
 	github.com/getkin/kin-openapi v0.144.0
 	github.com/getsops/sops/v3 v3.9.2
+	github.com/go-echarts/go-echarts/v2 v2.6.0
 	github.com/go-git/go-git/v5 v5.19.2
 	github.com/go-ldap/ldap/v3 v3.4.12
 	github.com/go-pdf/fpdf v0.9.0
 	github.com/go-pg/pg/v10 v10.15.0
+	github.com/go-playground/validator/v10 v10.26.0
+	github.com/go-rod/rod v0.116.2
 	github.com/go-sql-driver/mysql v1.10.0
+	github.com/gobwas/ws v1.4.0
 	github.com/goccy/go-json v0.10.5
 	github.com/google/go-github/v30 v30.1.0
 	github.com/google/shlex v0.0.0-20191202100458-e7afc7fbc510
 	github.com/google/uuid v1.6.0
 	github.com/h2non/filetype v1.1.3
 	github.com/hashicorp/golang-lru/v2 v2.0.7
+	github.com/hdm/jarm-go v0.0.8
+	github.com/invopop/jsonschema v0.13.0
+	github.com/itchyny/gojq v0.12.17
 	github.com/jcmturner/gokrb5/v8 v8.4.4
 	github.com/jhump/protoreflect v1.17.0
+	github.com/julienschmidt/httprouter v1.3.0
 	github.com/kitabisa/go-ci v1.0.3
 	github.com/leslie-qiwa/flat v0.0.0-20230424180412-f9d1cf014baa
 	github.com/lib/pq v1.12.3
@@ -92,10 +68,15 @@ require (
 	github.com/maypok86/otter/v2 v2.2.1
 	github.com/mholt/archives v0.1.5
 	github.com/microsoft/go-mssqldb v1.9.2
+	github.com/miekg/dns v1.1.73
 	github.com/oiweiwei/go-msrpc v1.2.12
+	github.com/olekukonko/tablewriter v1.0.8
 	github.com/ory/dockertest/v3 v3.12.0
+	github.com/pkg/errors v0.9.1
 	github.com/praetorian-inc/fingerprintx v1.1.15
+	github.com/projectdiscovery/clistats v0.1.7
 	github.com/projectdiscovery/dsl v0.8.24
+	github.com/projectdiscovery/fastdialer v0.5.21
 	github.com/projectdiscovery/fasttemplate v0.0.2
 	github.com/projectdiscovery/gcache v0.0.0-20241015120333-12546c6e3f4c
 	github.com/projectdiscovery/goflags v0.2.1
@@ -105,32 +86,52 @@ require (
 	github.com/projectdiscovery/gostruct v0.0.2
 	github.com/projectdiscovery/govaluate v0.0.0-20260615100919-5ee2581bbf7e
 	github.com/projectdiscovery/gozero v0.1.1-0.20260530071156-fa1dad563d76
+	github.com/projectdiscovery/hmap v0.0.102
 	github.com/projectdiscovery/httpx v1.12.0
+	github.com/projectdiscovery/interactsh v1.3.1
 	github.com/projectdiscovery/mapcidr v1.1.97
 	github.com/projectdiscovery/n3iwf v0.0.0-20230523120440-b8cd232ff1f5
 	github.com/projectdiscovery/networkpolicy v0.1.51
 	github.com/projectdiscovery/ratelimit v0.0.90
+	github.com/projectdiscovery/rawhttp v0.1.92
 	github.com/projectdiscovery/rdap v0.9.0
+	github.com/projectdiscovery/retryabledns v1.0.116
+	github.com/projectdiscovery/retryablehttp-go v1.3.27
 	github.com/projectdiscovery/sarif v0.1.0
 	github.com/projectdiscovery/tlsx v1.4.0
 	github.com/projectdiscovery/uncover v1.2.1
 	github.com/projectdiscovery/useragent v0.0.109
 	github.com/projectdiscovery/utils v0.11.4
 	github.com/projectdiscovery/wappalyzergo v0.3.1
+	github.com/projectdiscovery/yamldoc-go v1.0.7
 	github.com/redis/go-redis/v9 v9.11.0
+	github.com/remeh/sizedwaitgroup v1.0.0
+	github.com/rs/xid v1.6.0
 	github.com/rs/zerolog v1.34.0
 	github.com/sandrolain/httpcache
```

**File**: `go.tool.mod` (modified, +1/-1)
```diff
@@ -1,6 +1,6 @@
 module nuclei-tools
 
-go 1.26.8
+go 1.27.1
 
 tool (
 	github.com/dvyukov/go-fuzz/go-fuzz
```

**File**: `lib/tests/sdk_test.go` (modified, +3/-0)
```diff
@@ -18,6 +18,9 @@ var knownLeaks = []goleak.Option{
 	// net/http transport maintains idle keep-alive connections whose goroutines
 	// exit on idle timeout or explicit close - not real leaks.
 	goleak.IgnoreAnyFunction("net/http.(*http2ClientConn).readLoop"),
+	// go 1.27 moved the bundled http2 transport out of net/http, which renamed
+	// the same idle connection goroutine
+	goleak.IgnoreAnyFunction("net/http/internal/http2.(*ClientConn).readLoop"),
 	goleak.IgnoreAnyFunction("net/http.(*persistConn).readLoop"),
 	goleak.IgnoreAnyFunction("net/http.(*persistConn).writeLoop"),
 	// expirable LRU cache creates a background goroutine for TTL expiration that persists
```

---

### Incident Patch 11: `2b6b1d33` (2026-09-24)
**Commit Message**: fix(json): keep sonic out of builds it does not support

**File**: `pkg/utils/json/json.go` (modified, +6/-1)
```diff
@@ -1,4 +1,9 @@
-//go:build !gofuzz && (linux || darwin || windows) && (amd64 || arm64)
+// sonic compiles its fast paths only for the Go versions it has adopted, and
+// prints a warning from init on any other toolchain before falling back to
+// encoding/json. Mirroring its constraint here keeps that fallback silent: on a
+// Go version sonic does not support we never link it and use encoding/json
+// directly. Raise the upper bound when sonic adds support for a new Go version.
+//go:build !gofuzz && (linux || darwin || windows) && (amd64 || arm64) && go1.17 && !go1.28
 
 package json
 
```

**File**: `pkg/utils/json/json_fallback.go` (modified, +1/-1)
```diff
@@ -1,4 +1,4 @@
-//go:build gofuzz || !(linux || darwin || windows) || !(amd64 || arm64)
+//go:build gofuzz || !(linux || darwin || windows) || !(amd64 || arm64) || !go1.17 || go1.28
 
 package json
 
```

---

### Incident Patch 12: `3fdd8ca0` (2026-09-24)
**Commit Message**: chore(deps): require go 1.27.1 for windows overlapped I/O fix

**File**: `go.mod` (modified, +64/-73)
```diff
@@ -1,41 +1,6 @@
 module github.com/projectdiscovery/nuclei/v3
 
-go 1.26.8
-
-require (
-	github.com/andygrunwald/go-jira v1.16.1
-	github.com/antchfx/htmlquery v1.3.5
-	github.com/go-playground/validator/v10 v10.26.0
-	github.com/go-rod/rod v0.116.2
-	github.com/gobwas/ws v1.4.0
-	github.com/invopop/jsonschema v0.13.0
-	github.com/itchyny/gojq v0.12.17
-	github.com/json-iterator/go v1.1.12 // indirect
-	github.com/julienschmidt/httprouter v1.3.0
-	github.com/logrusorgru/aurora v2.0.3+incompatible // indirect
-	github.com/miekg/dns v1.1.73
-	github.com/olekukonko/tablewriter v1.0.8
-	github.com/pkg/errors v0.9.1
-	github.com/projectdiscovery/clistats v0.1.7
-	github.com/projectdiscovery/fastdialer v0.5.21
-	github.com/projectdiscovery/hmap v0.0.102
-	github.com/projectdiscovery/interactsh v1.3.1
-	github.com/projectdiscovery/rawhttp v0.1.92
-	github.com/projectdiscovery/retryabledns v1.0.116
-	github.com/projectdiscovery/retryablehttp-go v1.3.27
-	github.com/projectdiscovery/yamldoc-go v1.0.7
-	github.com/remeh/sizedwaitgroup v1.0.0
-	github.com/rs/xid v1.6.0
-	github.com/segmentio/ksuid v1.0.4
-	github.com/spaolacci/murmur3 v1.1.0 // indirect
-	github.com/spf13/cast v1.10.0
-	github.com/syndtr/goleveldb v1.0.0
-	github.com/weppos/publicsuffix-go v0.50.3 // indirect
-	go.uber.org/multierr v1.11.0
-	golang.org/x/net v0.58.0
-	golang.org/x/oauth2 v0.36.0
-	golang.org/x/text v0.41.0
-)
+go 1.27.1
 
 require (
 	carvel.dev/ytt v0.52.0
@@ -51,8 +16,11 @@ require (
 	github.com/Mzack9999/goimpacket v0.0.0-20260422121140-7085336a0415
 	github.com/RedTeamPentesting/adauth v0.5.4-0.20260511073005-3d18e8a5a687
 	github.com/adrg/xdg v0.5.3
+	github.com/alecthomas/chroma v0.10.0
 	github.com/alexsnet/go-vnc v0.1.0
 	github.com/alitto/pond v1.9.2
+	github.com/andygrunwald/go-jira v1.16.1
+	github.com/antchfx/htmlquery v1.3.5
 	github.com/antchfx/xmlquery v1.4.4
 	github.com/antchfx/xpath v1.3.6
 	github.com/aws/aws-sdk-go-v2 v1.41.5
@@ -71,19 +39,27 @@ require (
 	github.com/fullstorydev/grpcurl v1.9.3
 	github.com/getkin/kin-openapi v0.144.0
 	github.com/getsops/sops/v3 v3.9.2
+	github.com/go-echarts/go-echarts/v2 v2.6.0
 	github.com/go-git/go-git/v5 v5.19.2
 	github.com/go-ldap/ldap/v3 v3.4.12
 	github.com/go-pdf/fpdf v0.9.0
 	github.com/go-pg/pg/v10 v10.15.0
+	github.com/go-playground/validator/v10 v10.26.0
+	github.com/go-rod/rod v0.116.2
 	github.com/go-sql-driver/mysql v1.10.0
+	github.com/gobwas/ws v1.4.0
 	github.com/goccy/go-json v0.10.5
 	github.com/google/go-github/v30 v30.1.0
 	github.com/google/shlex v0.0.0-20191202100458-e7afc7fbc510
 	github.com/google/uuid v1.6.0
 	github.com/h2non/filetype v1.1.3
 	github.com/hashicorp/golang-lru/v2 v2.0.7
+	github.com/hdm/jarm-go v0.0.8
+	github.com/invopop/jsonschema v0.13.0
+	github.com/itchyny/gojq v0.12.17
 	github.com/jcmturner/gokrb5/v8 v8.4.4
 	github.com/jhump/protoreflect v1.17.0
+	github.com/julienschmidt/httprouter v1.3.0
 	github.com/kitabisa/go-ci v1.0.3
 	github.com/leslie-qiwa/flat v0.0.0-20230424180412-f9d1cf014baa
 	github.com/lib/pq v1.12.3
@@ -92,10 +68,15 @@ require (
 	github.com/maypok86/otter/v2 v2.2.1
 	github.com/mholt/archives v0.1.5
 	github.com/microsoft/go-mssqldb v1.9.2
+	github.com/miekg/dns v1.1.73
 	github.com/oiweiwei/go-msrpc v1.2.12
+	github.com/olekukonko/tablewriter v1.0.8
 	github.com/ory/dockertest/v3 v3.12.0
+	github.com/pkg/errors v0.9.1
 	github.com/praetorian-inc/fingerprintx v1.1.15
+	github.com/projectdiscovery/clistats v0.1.7
 	github.com/projectdiscovery/dsl v0.8.24
+	github.com/projectdiscovery/fastdialer v0.5.21
 	github.com/projectdiscovery/fasttemplate v0.0.2
 	github.com/projectdiscovery/gcache v0.0.0-20241015120333-12546c6e3f4c
 	github.com/projectdiscovery/goflags v0.2.1
@@ -105,32 +86,52 @@ require (
 	github.com/projectdiscovery/gostruct v0.0.2
 	github.com/projectdiscovery/govaluate v0.0.0-20260615100919-5ee2581bbf7e
 	github.com/projectdiscovery/gozero v0.1.1-0.20260530071156-fa1dad563d76
+	github.com/projectdiscovery/hmap v0.0.102
 	github.com/projectdiscovery/httpx v1.12.0
+	github.com/projectdiscovery/interactsh v1.3.1
 	github.com/projectdiscovery/mapcidr v1.1.97
 	github.com/projectdiscovery/n3iwf v0.0.0-20230523120440-b8cd232ff1f5
 	github.com/projectdiscovery/networkpolicy v0.1.51
 	github.com/projectdiscovery/ratelimit v0.0.90
+	github.com/projectdiscovery/rawhttp v0.1.92
 	github.com/projectdiscovery/rdap v0.9.0
+	github.com/projectdiscovery/retryabledns v1.0.116
+	github.com/projectdiscovery/retryablehttp-go v1.3.27
 	github.com/projectdiscovery/sarif v0.1.0
 	github.com/projectdiscovery/tlsx v1.4.0
 	github.com/projectdiscovery/uncover v1.2.1
 	github.com/projectdiscovery/useragent v0.0.109
 	github.com/projectdiscovery/utils v0.11.4
 	github.com/projectdiscovery/wappalyzergo v0.3.1
+	github.com/projectdiscovery/yamldoc-go v1.0.7
 	github.com/redis/go-redis/v9 v9.11.0
+	github.com/remeh/sizedwaitgroup v1.0.0
+	github.com/rs/xid v1.6.0
 	github.com/rs/zerolog v1.34.0
 	github.com/sandrolain/httpcache
```

**File**: `go.tool.mod` (modified, +1/-1)
```diff
@@ -1,6 +1,6 @@
 module nuclei-tools
 
-go 1.26.8
+go 1.27.1
 
 tool (
 	github.com/dvyukov/go-fuzz/go-fuzz
```

---

### Incident Patch 13: `dece1c5e` (2026-09-23)
**Commit Message**: fix helpers

**File**: `pkg/operators/common/dsl/network.go` (modified, +33/-6)
```diff
@@ -44,16 +44,43 @@ func EvalWithOptions(expression *govaluate.EvaluableExpression, values map[strin
 	return bound.Evaluate(values)
 }
 
-// This check only avoids rebinding pure expressions. The global registry denies
-// all network helpers, so an unrecognized spelling cannot bypass the gate.
+// networkHelperCall matches a helper invocation, not a substring in another
+// identifier or a quoted string. The global registry still denies every
+// network helper, so an unrecognized spelling cannot bypass the gate.
+var networkHelperCall = regexp.MustCompile(`\b(?:public_ip|publicip|resolve|jarm)\s*\(`)
+
 func hasNetworkHelper(expression string) bool {
-	for _, name := range []string{"resolve", "public_ip", "publicip", "jarm"} {
-		if strings.Contains(expression, name) {
-			return true
+	return networkHelperCall.MatchString(stripQuotedStrings(expression))
+}
+
+func stripQuotedStrings(expression string) string {
+	var builder strings.Builder
+	builder.Grow(len(expression))
+
+	for i := 0; i < len(expression); {
+		char := expression[i]
+		if char != '\'' && char != '"' {
+			builder.WriteByte(char)
+			i++
+			continue
+		}
+
+		quote := char
+		i++
+		for i < len(expression) {
+			if expression[i] == '\\' {
+				i += 2
+				continue
+			}
+			if expression[i] == quote {
+				i++
+				break
+			}
+			i++
 		}
 	}
 
-	return false
+	return builder.String()
 }
 
 func networkDialers(options *types.Options) (*protocolstate.Dialers, error) {
```

**File**: `pkg/operators/common/dsl/network_test.go` (modified, +34/-0)
```diff
@@ -4,6 +4,7 @@ import (
 	"testing"
 
 	"github.com/projectdiscovery/govaluate"
+	"github.com/projectdiscovery/nuclei/v3/pkg/types"
 	"github.com/stretchr/testify/require"
 )
 
@@ -20,3 +21,36 @@ func TestNetworkHelpersRequireScanContext(t *testing.T) {
 		})
 	}
 }
+
+func TestHasNetworkHelperIgnoresSubstringsAndQuotedCalls(t *testing.T) {
+	for _, item := range []struct {
+		source string
+		want   bool
+	}{
+		{source: `resolve("fixture.example")`, want: true},
+		{source: `public_ip()`, want: true},
+		{source: `publicip()`, want: true},
+		{source: `jarm("127.0.0.1:443")`, want: true},
+		{source: `contains(body, "unresolved")`, want: false},
+		{source: `contains(body, "resolve(")`, want: false},
+		{source: `contains(body, "jarm(")`, want: false},
+		{source: `contains(body, "public_ip(")`, want: false},
+		{source: `len("publicip")`, want: false},
+	} {
+		t.Run(item.source, func(t *testing.T) {
+			require.Equal(t, item.want, hasNetworkHelper(item.source))
+			expression, err := govaluate.NewEvaluableExpressionWithFunctions(item.source, HelperFunctions)
+			require.NoError(t, err)
+			if item.want {
+				return
+			}
+			result, err := EvalWithOptions(expression, map[string]interface{}{"body": "unresolved resolve( jarm( public_ip("}, &types.Options{ExecutionId: t.Name()})
+			require.NoError(t, err)
+			if item.source == `len("publicip")` {
+				require.Equal(t, float64(8), result)
+				return
+			}
+			require.Equal(t, true, result)
+		})
+	}
+}
```

**File**: `pkg/protocols/websocket/websocket.go` (modified, +1/-1)
```diff
@@ -369,7 +369,7 @@ func (request *Request) readWriteInputWebsocket(conn net.Conn, payloadValues map
 
 			// Run any internal extractors for the request here and add found values to map.
 			if request.CompiledOperators != nil {
-				values := request.CompiledOperators.ExecuteInternalExtractors(map[string]interface{}{req.Name: bufferStr}, protocols.MakeDefaultExtractFunc)
+				values := request.CompiledOperators.ExecuteInternalExtractors(map[string]interface{}{req.Name: bufferStr}, request.Extract)
 				maps.Copy(inputEvents, values)
 			}
 		}
```

**File**: `pkg/protocols/websocket/websocket_test.go` (modified, +68/-0)
```diff
@@ -12,14 +12,17 @@ import (
 
 	"github.com/gobwas/ws"
 	"github.com/gobwas/ws/wsutil"
+	"github.com/miekg/dns"
 	"github.com/stretchr/testify/require"
 
 	"github.com/projectdiscovery/nuclei/v3/internal/tests/testutils"
 	"github.com/projectdiscovery/nuclei/v3/pkg/model"
 	"github.com/projectdiscovery/nuclei/v3/pkg/model/types/severity"
+	"github.com/projectdiscovery/nuclei/v3/pkg/operators"
 	"github.com/projectdiscovery/nuclei/v3/pkg/operators/extractors"
 	"github.com/projectdiscovery/nuclei/v3/pkg/output"
 	"github.com/projectdiscovery/nuclei/v3/pkg/protocols/common/contextargs"
+	"github.com/projectdiscovery/nuclei/v3/pkg/protocols/common/protocolstate"
 	urlutil "github.com/projectdiscovery/utils/url"
 )
 
@@ -344,6 +347,71 @@ func TestWebSocketDurationFields(t *testing.T) {
 	require.Equal(t, gotEvent["duration_2"], values["duration-ws_duration_2"])
 }
 
+func TestWebSocketInternalDSLExtractorHonorsScanOptions(t *testing.T) {
+	listener, err := net.ListenPacket("udp", "127.0.0.1:0")
+	require.NoError(t, err)
+	server := &dns.Server{PacketConn: listener, Handler: dns.HandlerFunc(func(writer dns.ResponseWriter, request *dns.Msg) {
+		response := new(dns.Msg).SetReply(request)
+		for _, question := range request.Question {
+			if question.Qtype == dns.TypeA {
+				response.Answer = append(response.Answer, &dns.A{
+					Hdr: dns.RR_Header{Name: question.Name, Rrtype: dns.TypeA, Class: dns.ClassINET},
+					A:   net.ParseIP("8.8.8.8"),
+				})
+			}
+		}
+		_ = writer.WriteMsg(response)
+	})}
+	started := make(chan struct{})
+	server.NotifyStartedFunc = func() { close(started) }
+	done := make(chan error, 1)
+	go func() { done <- server.ActivateAndServe() }()
+	<-started
+	t.Cleanup(func() { require.NoError(t, server.Shutdown()); require.NoError(t, <-done) })
+
+	options := testutils.DefaultOptions.Copy()
+	options.ExecutionId = t.Name()
+	options.InternalResolversList = []string{listener.LocalAddr().String()}
+	testutils.Init(options)
+	t.Cleanup(func() { protocolstate.Close(options.ExecutionId) })
+
+	connHandler := func(conn net.Conn) {
+		msg, op, err := wsutil.ReadClientData(conn)
+		if err != nil {
+			return
+		}
+		_ = wsutil.WriteServerMessage(conn, op, msg)
+	}
+	wsServer := testutils.NewWebsocketServer("", connHandler, func(origin string) bool { return true })
+	defer wsServer.Close()
+
+	target := strings.ReplaceAll(wsServer.URL, "http", "ws")
+	request := &Request{
+		Address: target,
+		Inputs:  []*Input{{Data: "hello", Name: "first"}},
+		Operators: operators.Operators{
+			Extractors: []*extractors.Extractor{{
+				Name:     "resolved",
+				Internal: true,
+				Type:     extractors.ExtractorTypeHolder{ExtractorType: extractors.DSLExtractor},
+				DSL:      []string{`resolve("fixture.example")`},
+			}},
+		},
+	}
+	executerOpts := testutils.NewMockExecuterOptions(options, &testutils.TemplateInfo{
+		ID:   "testing-websocket-internal-dsl",
+		Info: model.Info{SeverityHolder: severity.Holder{Severity: severity.Low}, Name: "test"},
+	})
+	require.NoError(t, request.Compile(executerOpts))
+
+	var gotEvent output.InternalEvent
+	ctxArgs := contextargs.NewWithInput(context.Background(), target)
+	require.NoError(t, request.ExecuteWithResults(ctxArgs, nil, nil, func(event *output.InternalWrappedEvent) {
+		gotEvent = event.InternalEvent
+	}))
+	require.Equal(t, "8.8.8.8", gotEvent["resolved"])
+}
+
 func TestWebSocketNoInputDuration(t *testing.T) {
 	server := newDelayedUpgradeWebsocketServer(durationObservationDelay)
 	defer server.Close()
```

---

### Incident Patch 14: `5e5758b7` (2026-09-23)
**Commit Message**: fix interpolation

**File**: `pkg/protocols/http/operators.go` (modified, +17/-10)
```diff
@@ -13,6 +13,7 @@ import (
 	"github.com/projectdiscovery/nuclei/v3/pkg/output"
 	"github.com/projectdiscovery/nuclei/v3/pkg/protocols"
 	"github.com/projectdiscovery/nuclei/v3/pkg/protocols/common/helpers/responsehighlighter"
+	"github.com/projectdiscovery/nuclei/v3/pkg/protocols/common/replacer"
 	"github.com/projectdiscovery/nuclei/v3/pkg/protocols/utils"
 	"github.com/projectdiscovery/nuclei/v3/pkg/types"
 )
@@ -62,7 +63,9 @@ var targetValueKeys = []string{"BaseURL", "RootURL", "Hostname", "Host", "Port",
 
 // llmPromptValues returns the values an llm prompt may interpolate: the
 // template variables, -var and constants the operator declared, plus the
-// target. Each is read from the event data, so the value is the evaluated one.
+// target. Declared values come from those maps, not the merged response
+// event, so a colliding body, header, or extractor cannot overwrite them.
+// Placeholders inside declared strings are resolved against the target only.
 //
 // Response derived values (body, headers, extracted fields) are deliberately
 // excluded. They are attacker influenced, and putting them in the instruction
@@ -73,9 +76,18 @@ func (request *Request) llmPromptValues(data map[string]interface{}) map[string]
 		return values
 	}
 
-	declared := func(names map[string]interface{}) {
-		for name := range names {
-			if value, ok := data[name]; ok {
+	targets := make(map[string]interface{})
+	for _, key := range targetValueKeys {
+		if value, ok := data[key]; ok {
+			targets[key] = value
+		}
+	}
+
+	declared := func(src map[string]interface{}) {
+		for name, value := range src {
+			if str, ok := value.(string); ok {
+				values[name] = replacer.Replace(str, targets)
+			} else {
 				values[name] = value
 			}
 		}
@@ -85,12 +97,7 @@ func (request *Request) llmPromptValues(data map[string]interface{}) map[string]
 	if request.options.Options != nil {
 		declared(request.options.Options.Vars.AsMap())
 	}
-
-	for _, key := range targetValueKeys {
-		if value, ok := data[key]; ok {
-			values[key] = value
-		}
-	}
+	maps.Copy(values, targets)
 	return values
 }
 
```

**File**: `pkg/protocols/http/operators_test.go` (modified, +41/-2)
```diff
@@ -7,13 +7,16 @@ import (
 
 	"github.com/stretchr/testify/require"
 
+	"github.com/projectdiscovery/goflags"
+	"github.com/projectdiscovery/nuclei/v3/internal/tests/testutils"
 	"github.com/projectdiscovery/nuclei/v3/pkg/model"
 	"github.com/projectdiscovery/nuclei/v3/pkg/model/types/severity"
 	"github.com/projectdiscovery/nuclei/v3/pkg/operators"
 	"github.com/projectdiscovery/nuclei/v3/pkg/operators/extractors"
 	"github.com/projectdiscovery/nuclei/v3/pkg/operators/matchers"
 	"github.com/projectdiscovery/nuclei/v3/pkg/output"
-	"github.com/projectdiscovery/nuclei/v3/internal/tests/testutils"
+	"github.com/projectdiscovery/nuclei/v3/pkg/protocols/common/variables"
+	"github.com/projectdiscovery/nuclei/v3/pkg/utils"
 )
 
 func TestResponseToDSLMap(t *testing.T) {
@@ -453,7 +456,7 @@ func TestLLMPromptValuesExcludeResponseDerivedValues(t *testing.T) {
 		ID:   "llm-values",
 		Info: model.Info{SeverityHolder: severity.Holder{Severity: severity.Low}, Name: "test"},
 	})
-	executerOpts.Constants = map[string]interface{}{"focus_area": ""}
+	executerOpts.Constants = map[string]interface{}{"focus_area": "Authentication"}
 	require.Nil(t, request.Compile(executerOpts))
 
 	data := map[string]interface{}{
@@ -471,3 +474,39 @@ func TestLLMPromptValuesExcludeResponseDerivedValues(t *testing.T) {
 	require.NotContains(t, values, "body", "the response body must never reach the instruction")
 	require.NotContains(t, values, "csrf_token", "response derived values must never reach the instruction")
 }
+
+func TestLLMPromptValuesIgnoreResponseCollisions(t *testing.T) {
+	options := testutils.DefaultOptions.Copy()
+	options.Vars = goflags.RuntimeMap{}
+	testutils.Init(options)
+
+	request := &Request{ID: "llm-values", Name: "testing", Path: []string{"{{BaseURL}}"}, Method: HTTPMethodTypeHolder{MethodType: HTTPGet}}
+	executerOpts := testutils.NewMockExecuterOptions(options, &testutils.TemplateInfo{
+		ID:   "llm-values",
+		Info: model.Info{SeverityHolder: severity.Holder{Severity: severity.Low}, Name: "test"},
+	})
+	templateVars := variables.Variable{
+		InsertionOrderedStringMap: *utils.NewEmptyInsertionOrderedStringMap(2),
+	}
+	templateVars.Set("body", "operator-body")
+	templateVars.Set("role", "auditor for {{BaseURL}}")
+	executerOpts.Variables = templateVars
+	executerOpts.Constants = map[string]interface{}{"server": "operator-server"}
+	require.NoError(t, executerOpts.Options.Vars.Set("cli_role=from-var"))
+	require.Nil(t, request.Compile(executerOpts))
+
+	data := map[string]interface{}{
+		"BaseURL":    "https://acme.test",
+		"body":       "<html>attacker controlled</html>",
+		"server":     "nginx",
+		"cli_role":   "from-response",
+		"csrf_token": "extracted-from-response",
+	}
+
+	values := request.llmPromptValues(data)
+	require.Equal(t, "operator-body", values["body"], "a declared name must not take the response body")
+	require.Equal(t, "operator-server", values["server"], "a declared name must not take a response header")
+	require.Equal(t, "from-var", values["cli_role"], "a -var name must not take an extracted field")
+	require.Equal(t, "auditor for https://acme.test", values["role"], "declared strings still resolve against the target")
+	require.NotContains(t, values, "csrf_token")
+}
```

---

### Incident Patch 15: `06fb71eb` (2026-09-23)
**Commit Message**: fix lint

**File**: `pkg/operators/common/dsl/network.go` (modified, +1/-1)
```diff
@@ -275,7 +275,7 @@ func publicIP(options *types.Options, args ...interface{}) (interface{}, error)
 	if err != nil {
 		return nil, fmt.Errorf("public_ip: %w", err)
 	}
-	defer response.Body.Close()
+	defer func() { _ = response.Body.Close() }()
 
 	if response.StatusCode != http.StatusOK {
 		return nil, fmt.Errorf("public_ip: unexpected HTTP status %s", response.Status)
```

**File**: `pkg/operators/common/dsl/network_policy_test.go` (modified, +1/-1)
```diff
@@ -159,7 +159,7 @@ func (p *jarmTestProxy) Dial(network, address string) (net.Conn, error) {
 	p.wg.Add(1)
 	go func() {
 		defer p.wg.Done()
-		defer server.Close()
+		defer func() { _ = server.Close() }()
 		_ = server.SetDeadline(time.Now().Add(time.Second))
 		buffer := make([]byte, 4096)
 		_, _ = server.Read(buffer)
```

#### Recent Merged Pull Requests:
- **PR #7818** (2026-10-05): run release test right after lint (@dogancanbakir)
- **PR #7816** (closed): chore(deps): bump the modules group with 7 updates (@dependabot[bot])
- **PR #7815** (closed): fix(http): deduplicate same-name cookies when reissued by cookie jar (@i-am-paradox)
- **PR #7811** (closed): fix(openapi): send format binary octet-stream bodies with correct content-type (#7801) (@TassioSales)
- **PR #7807** (2026-10-05): cut unit and integration test runtime (@dogancanbakir)
- **PR #7805** (2026-09-30): exclude the workspace from defender scanning on windows (@dogancanbakir)
- **PR #7797** (closed): fix(raw): stop a colon-less header line from taking the previous value (@CalvinTjoaquinn)
- **PR #7791** (2026-10-01): llm matchers and extractors on all protocols (@dogancanbakir)

---

## 3. Empirical Evidence & Compliance Certification
- **Evidence Provenance**: Fetched directly from verified official GitHub REST API.
- **Zero Disk Footprint**: 0 bytes of unnecessary repository bloat stored locally.
- **TOS & Free-Tier Adherence**: Request pace complied with public API guidelines without fee, penalty, or unauthorized scraping.

---

## 4. Promotion & Integration Status
- **Status**: HARVESTED_DEEP_FORENSIC
- **Master Brain Sync**: Auto-committed to local/remote Master Brain repository.
