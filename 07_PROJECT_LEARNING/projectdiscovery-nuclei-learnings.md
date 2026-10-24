> **Canonical Learning Artifact**: `07_PROJECT_LEARNING/projectdiscovery-nuclei-learnings.md`  
> **Source**: github ([https://github.com/projectdiscovery/nuclei](https://github.com/projectdiscovery/nuclei))  
> **Source Version**: `b901fb8a`  
> **License**: MIT  
> **Synthesized By**: zero-clone-structural-synthesizer  
> **Timestamp**: 2026-10-24T20:19:24.843Z  
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
> **Harvest Timestamp**: 2026-10-24T20:19:24.835Z  
> **Compliance State**: Free Tier Guaranteed | Strict Rate-Limit Backoff Honored  

---

## 1. Context & Architectural Overview
- **Repository / Resource**: `projectdiscovery/nuclei`
- **Description**: Nuclei is a fast, customizable vulnerability scanner powered by the global security community and built on a simple YAML-based DSL, enabling collaboration to tackle trending vulnerabilities on the internet. It helps you find vulnerabilities in your applications, APIs, networks, DNS, and cloud configurations.
- **Primary Language / Ecosystem**: Go
- **Discovered Manifests / Configurations**: go.mod, README.md, Dockerfile
- **Stars / Engagement**: 32288 stars

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

	"github.com/projectdiscovery/nuclei/v3/pkg/input/normalize"
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
		if inScope && e.executerOpts.HostErrorsCache != nil && e.executerOpts.HostErrorsCache.Check(template.Type().String(), contextargs.NewWithMetaInput(ctx, scannedValue)) {
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
			e.executerOpts.HostErrorsCache.Check(tpl.Type().String(), contextargs.NewWithMetaInput(ctx, target)) {
			skipEvent := &output.ResultEvent{
				TemplateID:    tpl.ID,
				TemplatePath:  tpl.Path,
				Info:          tpl.Info,
				Type:          tpl.Type().String(),
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
func (e *Engine) executeTemplateOnInput(ctx context.Context, template *templates.Template, value *contextargs.MetaInput) (matched bool, err error) {
	// A template fixed to the target's origin makes the same requests for every
	// target that shares one, which a crawled list produces by the hundred.
	// Running it once per origin sends exactly the same traffic, minus the
	// repeats. The reservation is kept only when execution succeeds, so a
	// failed attempt leaves the origin free for a later target.
	finish, run := e.claimOriginScoped(template, value)
	if !run {
		return false, nil
	}
	defer func() { finish(err == nil) }()
	finished := e.templateExecutionStarted(template, value.Input)
	defer func() { finished(ctx.Err()) }()
	ctxArgs := contextargs.New(ctx)
	ctxArgs.MetaInput = value
	scanCtx := scan.NewScanContext(ctx, ctxArgs)

	switc
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

### Incident Patch 1: `64ad4591` (2026-10-23)
**Commit Message**: Merge pull request #7756 from baturdenada/fix/dialer-panic

Fix dialer panics in JS protocol and input providers

**File**: `pkg/input/provider/list/hmap.go` (modified, +8/-4)
```diff
@@ -205,7 +205,8 @@ func (i *ListInputProvider) set(executionId string, value string, selection *tar
 		// scan all ips
 		dialers := protocolstate.GetDialersWithId(executionId)
 		if dialers == nil {
-			panic("dialers with executionId " + executionId + " not found")
+			gologger.Error().Msgf("dialers with executionId %s not found", executionId)
+			return
 		}
 
 		dnsData, err := dialers.Fastdialer.GetDNSData(urlx.Hostname())
@@ -242,7 +243,8 @@ func (i *ListInputProvider) set(executionId string, value string, selection *tar
 	if i.ipOptions.IPV6 {
 		dialers := protocolstate.GetDialersWithId(executionId)
 		if dialers == nil {
-			panic("dialers with executionId " + executionId + " not found")
+			gologger.Error().Msgf("dialers with executionId %s not found", executionId)
+			return
 		}
 
 		dnsData, err := dialers.Fastdialer.GetDNSData(urlx.Hostname())
@@ -467,7 +469,8 @@ func (i *ListInputProvider) Del(executionId string, value string) {
 		// scan all ips
 		dialers := protocolstate.GetDialersWithId(executionId)
 		if dialers == nil {
-			panic("dialers with executionId " + executionId + " not found")
+			gologger.Error().Msgf("dialers with executionId %s not found", executionId)
+			return
 		}
 
 		dnsData, err := dialers.Fastdialer.GetDNSData(urlx.Hostname())
@@ -504,7 +507,8 @@ func (i *ListInputProvider) Del(executionId string, value string) {
 	if i.ipOptions.IPV6 {
 		dialers := protocolstate.GetDialersWithId(executionId)
 		if dialers == nil {
-			panic("dialers with executionId " + executionId + " not found")
+			gologger.Error().Msgf("dialers with executionId %s not found", executionId)
+			return
 		}
 
 		dnsData, err := dialers.Fastdialer.GetDNSData(urlx.Hostname())
```

**File**: `pkg/js/global/scripts.go` (modified, +2/-2)
```diff
@@ -10,8 +10,8 @@ import (
 	"reflect"
 	"time"
 
-	"github.com/projectdiscovery/goja"
 	"github.com/logrusorgru/aurora/v4"
+	"github.com/projectdiscovery/goja"
 	"github.com/projectdiscovery/gologger"
 	"github.com/projectdiscovery/nuclei/v3/pkg/js/gojs"
 	jsnet "github.com/projectdiscovery/nuclei/v3/pkg/js/libs/net"
@@ -156,7 +156,7 @@ func initBuiltInFunc(runtime *goja.Runtime) {
 			executionId := ctx.Value("executionId").(string)
 			dialer := protocolstate.GetDialersWithId(executionId)
 			if dialer == nil {
-				panic("dialers with executionId " + executionId + " not found")
+				return false, errkit.New("dialers with executionId %s not found", executionId)
 			}
 
 			conn, err := dialer.Fastdialer.Dial(ctx, "udp", net.JoinHostPort(host, port))
```

**File**: `pkg/js/libs/ldap/ldap.go` (modified, +3/-1)
```diff
@@ -10,6 +10,7 @@ import (
 
 	"github.com/go-ldap/ldap/v3"
 	"github.com/projectdiscovery/goja"
+	"github.com/projectdiscovery/gologger"
 	"github.com/projectdiscovery/nuclei/v3/pkg/js/utils"
 	"github.com/projectdiscovery/nuclei/v3/pkg/protocols/common/protocolstate"
 )
@@ -93,7 +94,8 @@ func NewClient(call goja.ConstructorCall, runtime *goja.Runtime) *goja.Object {
 	executionId := c.nj.ExecutionId()
 	dialers := protocolstate.GetDialersWithId(executionId)
 	if dialers == nil {
-		panic("dialers with executionId " + executionId + " not found")
+		gologger.Error().Msgf("dialers with executionId %s not found", executionId)
+		return nil
 	}
 
 	dialCtx := c.nj.Context()
```

**File**: `pkg/protocols/javascript/js.go` (modified, +11/-5)
```diff
@@ -450,7 +450,10 @@ func (request *Request) executeWithResults(port string, target *contextargs.Cont
 			results["error"] = outError.Error()
 
 			// generate and return failed event
-			data := request.generateEventData(input, results, hostPort)
+			data, genErr := request.generateEventData(input, results, hostPort)
+			if genErr != nil {
+				return genErr
+			}
 			data = generators.MergeMaps(data, payloadValues)
 			event := eventcreator.CreateEventWithAdditionalOptions(request, data, request.options.Options.Debug || request.options.Options.DebugResponse, func(wrappedEvent *output.InternalWrappedEvent) {
 				allVars := argsCopy.Map()
@@ -703,7 +706,10 @@ func (request *Request) executeRequestWithPayloads(
 
 	values := mapsutil.Merge(payloadValues, results)
 	// generate event data
-	data := request.generateEventData(input, values, hostPort)
+	data, genErr := request.generateEventData(input, values, hostPort)
+	if genErr != nil {
+		return genErr
+	}
 
 	// add and get values from templatectx
 	request.options.AddTemplateVars(input.MetaInput, request.Type(), request.GetID(), data)
@@ -751,10 +757,10 @@ func (request *Request) executeRequestWithPayloads(
 }
 
 // generateEventData generates event data for the request
-func (request *Request) generateEventData(input *contextargs.Context, values map[string]interface{}, matched string) map[string]interface{} {
+func (request *Request) generateEventData(input *contextargs.Context, values map[string]interface{}, matched string) (map[string]interface{}, error) {
 	dialers := protocolstate.GetDialersWithId(request.options.Options.ExecutionId)
 	if dialers == nil {
-		panic(fmt.Sprintf("dialers not initialized for %s", request.options.Options.ExecutionId))
+		return nil, fmt.Errorf("dialers not initialized for %s", request.options.Options.ExecutionId)
 	}
 
 	data := make(map[string]interface{})
@@ -809,7 +815,7 @@ func (request *Request) generateEventData(input *contextargs.Context, values map
 			}
 		}
 	}
-	return data
+	return data, nil
 }
 
 func (request *Request) getArgsCopy(input *contextargs.Context, payloadValues map[string]interface{}, requestOptions *protocols.ExecutorOptions, ignoreErrors bool) (*compiler.ExecuteArgs, []string, error) {
```

**File**: `pkg/protocols/javascript/js_test.go` (modified, +26/-0)
```diff
@@ -131,6 +131,32 @@ func TestExecuteWithResultsRejectsUnverifiedTemplate(t *testing.T) {
 	require.ErrorContains(t, err, "refusing to execute unverified javascript template")
 }
 
+func TestGenerateEventDataHandlesMissingDialers(t *testing.T) {
+	options := testutils.DefaultOptions.Copy()
+	testutils.Init(options)
+	t.Cleanup(func() { testutils.Cleanup(options) })
+
+	executorOptions := testutils.NewMockExecuterOptions(options, &testutils.TemplateInfo{ID: "missing-dialers"})
+	executorOptions.JsCompiler = templates.GetJsCompiler()
+	executorOptions.Verified = true
+	executorOptions.Options.ExecutionId = "non-existent-id"
+
+	request := &javascript.Request{
+		Code: `module.exports = { success: true, response: "ok" }`,
+	}
+	require.NoError(t, request.Compile(executorOptions))
+
+	target := contextargs.NewWithInput(context.Background(), "https://example.com:443")
+
+	var err error
+	require.NotPanics(t, func() {
+		err = request.ExecuteWithResults(target, nil, nil, func(*output.InternalWrappedEvent) {
+			t.Fatal("unexpected callback")
+		})
+	})
+	require.Error(t, err)
+}
+
 func TestJavascriptRequestsTakeFromRateLimiter(t *testing.T) {
 	options := testutils.DefaultOptions.Copy()
 	options.SetExecutionID(t.Name())
```

---

### Incident Patch 2: `b901fb8a` (2026-10-24)
**Commit Message**: Merge pull request #7868 from TassioSales/fix/headless-ws-exclude-hosts

fix(headless): enforce network policy on ws and wss schemes (#7867)

**File**: `pkg/protocols/common/protocolstate/headless.go` (modified, +209/-12)
```diff
@@ -2,8 +2,10 @@ package protocolstate
 
 import (
 	"context"
+	"fmt"
 	"net"
 	"strings"
+	"sync"
 
 	"github.com/go-rod/rod"
 	"github.com/go-rod/rod/lib/proto"
@@ -94,9 +96,10 @@ func IsRestrictLocalNetworkAccess(options *types.Options) bool {
 	return false
 }
 
-// isValidHost checks if the host is valid (only limited to http/https protocols)
+// isValidHost checks if the host is valid (for http/https and ws/wss protocols)
 func isValidHost(options *types.Options, targetUrl string) bool {
-	if !stringsutil.HasPrefixAny(targetUrl, "http:", "https:") {
+	normalized := strings.ToLower(strings.TrimSpace(targetUrl))
+	if !stringsutil.HasPrefixAny(normalized, "http:", "https:", "ws:", "wss:") {
 		return true
 	}
 
@@ -121,6 +124,22 @@ func isValidHost(options *types.Options, targetUrl string) bool {
 	return ok
 }
 
+// CanonicalizeHost normalizes a hostname or IP string:
+// - strips surrounding whitespace and brackets (e.g. "[::1]" -> "::1")
+// - maps IPv4-mapped IPv6 literals (e.g. "::ffff:127.0.0.1" or "0:0:0:0:0:ffff:127.0.0.1") to canonical IPv4 ("127.0.0.1")
+func CanonicalizeHost(host string) string {
+	h := strings.TrimSpace(host)
+	h = strings.TrimPrefix(h, "[")
+	h = strings.TrimSuffix(h, "]")
+	if ip := net.ParseIP(h); ip != nil {
+		if ipv4 := ip.To4(); ipv4 != nil {
+			return ipv4.String()
+		}
+		return ip.String()
+	}
+	return h
+}
+
 // IsHostAllowed checks if the host is allowed by network policy
 func IsHostAllowed(executionId string, targetUrl string) bool {
 	dialers, ok := dialers.Get(executionId)
@@ -134,19 +153,197 @@ func IsHostAllowed(executionId string, targetUrl string) bool {
 		return false
 	}
 
-	sepCount := strings.Count(targetUrl, ":")
-	if sepCount > 1 {
-		// most likely a ipv6 address (parse url and validate host)
-		return np.Validate(targetUrl)
+	rawTarget := strings.TrimSpace(targetUrl)
+	var host string
+
+	if urlx, err := urlutil.Parse(rawTarget); err == nil && urlx.Hostname() != "" {
+		host = urlx.Hostname()
+	} else if h, _, err := net.SplitHostPort(rawTarget); err == nil {
+		host = h
+	} else {
+		host = rawTarget
+		for _, prefix := range []string{"ws://", "wss://", "http://", "https://"} {
+			if strings.HasPrefix(strings.ToLower(host), prefix) {
+				host = host[len(prefix):]
+				if idx := strings.Index(host, "/"); idx != -1 {
+					host = host[:idx]
+				}
+				if h, _, err := net.SplitHostPort(host); err == nil {
+					host = h
+				}
+				break
+			}
+		}
+	}
+
+	canonHost := CanonicalizeHost(host)
+
+	// Check explicit ExcludeTargets against raw, host, and canonical host
+	for _, excluded := range dialers.ExcludeTargets {
+		ex := CanonicalizeHost(strings.TrimSpace(excluded))
+		if ex != "" {
+			if strings.EqualFold(canonHost, ex) || strings.EqualFold(host, ex) || strings.EqualFold(rawTarget, ex) {
+				return false
+			}
+		}
 	}
-	if sepCount == 1 {
-		host, _, _ := net.SplitHostPort(targetUrl)
+
+	// Validate host against NetworkPolicy using both canonical and original host
+	if _, ok := np.ValidateHost(canonHost); !ok {
+		return false
+	}
+	if canonHost != host {
 		if _, ok := np.ValidateHost(host); !ok {
 			return false
 		}
-		return true
 	}
-	// just a hostname or ip without port
-	_, ok = np.ValidateHost(targetUrl)
-	return ok
+	return true
+}
+
+// SetupHeadlessNetworkPolicy configures CDP Network blocking and WebSocket interception
+// to enforce network policies on headless pages.
+func SetupHeadlessNetworkPolicy(options *types.Options, page *rod.Page) error {
+	if options == nil || page == nil {
+		return nil
+	}
+
+	var blockedPatterns []string
+	for _, target := range options.ExcludeTargets {
+		target = strings.TrimSpace(target)
+		if target == "" {
+			continue
+		}
+		if strings.Contains(target, "://") {
+			parsed, err := urlutil.Parse(target)
+			if err != nil || parsed.Hostname() == "" {
+				continue
+			}
+			target = parsed.Hostname()
+		}
+		if !strings.Contains(target, "/") {
+			blockedPatterns = append(blockedPatterns,
+				"*://"+target+"/*",
+				"*://"+target+":*/*",
+				"ws://"+target+"/*",
+				"ws://"+target+":*/*",
+				"wss://"+target+"/*",
+				"wss://"+target+":*/*",
+			)
+		}
+	}
+
+	if options.RestrictLocalNetworkAccess {
+		localPatterns := []string{
+			"*://localhost/*", "*://localhost:*/*",
+			"*://127.*/*", "*://127.*:*/*",
+			"*://0.0.0.0/*", "*://0.0.0.0:*/*",
+			"*://[::1]/*", "*://[::1]:*/*",
+			"*://10.*/*", "*://10.*:*/*",
+			"*://192.168.*/*", "*://192.168.*:*/*",
+			"*://169.254.*/*", "*://169.254.*:*/*",
+			"ws://localhost/*", "ws://localhost:*/*",
+			"ws://127.*/*", "ws://127.*:*/*",
+			"ws://0.0.0.0/*", "ws://0.0.0.0:*/*",
+			"ws://[::1]/*", "ws://[::1]:*/*",
+			"ws://10.*/*", "ws://10.*:*/*",
+			"ws://192.168.*/*", "ws://192.168.*:*/*",
+			"ws://169.254.*/*", "ws://169.254.*:*/*",
+			"wss://localhost/*", "wss://localhost:*/*",
+			"wss://127.*/*", "wss://127.*:*/*",
+			"wss://0.0.0.0/*", "wss://0.0.0.0:*/*",
+			"wss://[::1]/*", "wss://[::1]:*/*",
+			"wss://10.*/*", "wss:/
```

**File**: `pkg/protocols/common/protocolstate/headless_test.go` (added, +48/-0)
```diff
@@ -0,0 +1,48 @@
+package protocolstate
+
+import (
+	"testing"
+
+	"github.com/projectdiscovery/networkpolicy"
+	"github.com/projectdiscovery/nuclei/v3/pkg/types"
+	"github.com/stretchr/testify/require"
+)
+
+func TestIsValidHost(t *testing.T) {
+	opts := &types.Options{
+		ExecutionId: "test-exec-id",
+	}
+
+	np, err := networkpolicy.New(networkpolicy.Options{
+		DenyList: []string{"127.0.0.1"},
+	})
+	require.NoError(t, err)
+
+	d := &Dialers{
+		NetworkPolicy: np,
+	}
+	err = dialers.Set(opts.ExecutionId, d)
+	require.NoError(t, err)
+	defer dialers.Delete(opts.ExecutionId)
+
+	// Allowed remote hosts
+	require.True(t, isValidHost(opts, "http://example.com"))
+	require.True(t, isValidHost(opts, "https://example.com"))
+	require.True(t, isValidHost(opts, "ws://example.com:9999"))
+	require.True(t, isValidHost(opts, "wss://example.com:9999"))
+
+	// Blocked hosts (127.0.0.1)
+	require.False(t, isValidHost(opts, "http://127.0.0.1:8080"))
+	require.False(t, isValidHost(opts, "https://127.0.0.1:8443"))
+	require.False(t, isValidHost(opts, "ws://127.0.0.1:9999"))
+	require.False(t, isValidHost(opts, "wss://127.0.0.1:9999"))
+
+	require.True(t, IsHostAllowed(opts.ExecutionId, "ws://example.com:9999"))
+	require.False(t, IsHostAllowed(opts.ExecutionId, "ws://127.0.0.1:9999"))
+}
+
+func TestSetupHeadlessNetworkPolicy_Nil(t *testing.T) {
+	require.NoError(t, SetupHeadlessNetworkPolicy(nil, nil))
+	require.NoError(t, SetupHeadlessNetworkPolicy(&types.Options{}, nil))
+}
+
```

**File**: `pkg/protocols/headless/engine/engine.go` (modified, +15/-2)
```diff
@@ -25,6 +25,7 @@ type Browser struct {
 	engine         *rod.Browser
 	options        *types.Options
 	launcher       *launcher.Launcher
+	proxy          *headlessProxy
 
 	// use getHTTPClient to get the http client
 	httpClient     *http.Client
@@ -34,6 +35,7 @@ type Browser struct {
 // New creates a new nuclei headless browser module
 func New(options *types.Options) (*Browser, error) {
 	var launcherURL, dataStore string
+	var proxyServer *headlessProxy
 	var err error
 
 	chromeLauncher := launcher.New()
@@ -82,9 +84,13 @@ func New(options *types.Options) (*Browser, error) {
 		} else {
 			chromeLauncher = chromeLauncher.Headless(true)
 		}
-		if options.AliveHttpProxy != "" {
-			chromeLauncher = chromeLauncher.Proxy(options.AliveHttpProxy)
+		proxyServer, err = newHeadlessProxy(options)
+		if err != nil {
+			return nil, err
 		}
+		chromeLauncher = chromeLauncher.
+			Proxy(proxyServer.Addr()).
+			Set("proxy-bypass-list", "<-loopback>")
 
 		for k, v := range options.ParseHeadlessOptionalArguments() {
 			chromeLauncher.Set(flags.Flag(k), v)
@@ -100,6 +106,9 @@ func New(options *types.Options) (*Browser, error) {
 
 	browser := rod.New().ControlURL(launcherURL)
 	if browserErr := browser.Connect(); browserErr != nil {
+		if proxyServer != nil {
+			_ = proxyServer.Close()
+		}
 		return nil, browserErr
 	}
 	defaultHeaders := make(map[string]string)
@@ -129,6 +138,7 @@ func New(options *types.Options) (*Browser, error) {
 		options:        options,
 		httpClientOnce: &sync.Once{},
 		launcher:       chromeLauncher,
+		proxy:          proxyServer,
 	}
 	return engine, nil
 }
@@ -186,6 +196,9 @@ func (b *Browser) getHTTPClient() (*http.Client, error) {
 //
 // When connected over CDP, it does NOT close the browsers.
 func (b *Browser) Close() {
+	if b.proxy != nil {
+		_ = b.proxy.Close()
+	}
 	if b.options.CDPEndpoint != "" {
 		return
 	}
```

**File**: `pkg/protocols/headless/engine/page.go` (modified, +7/-0)
```diff
@@ -16,6 +16,7 @@ import (
 	"github.com/projectdiscovery/gologger"
 	"github.com/projectdiscovery/nuclei/v3/pkg/protocols/common/contextargs"
 	"github.com/projectdiscovery/nuclei/v3/pkg/protocols/common/generators"
+	"github.com/projectdiscovery/nuclei/v3/pkg/protocols/common/protocolstate"
 	"github.com/projectdiscovery/nuclei/v3/pkg/protocols/common/utils/vardump"
 	"github.com/projectdiscovery/nuclei/v3/pkg/protocols/utils"
 	httputil "github.com/projectdiscovery/nuclei/v3/pkg/protocols/utils/http"
@@ -125,6 +126,12 @@ func (i *Instance) Run(ctx *contextargs.Context, actions []*Action, payloads map
 	createdPage.variables = variables
 	createdPage.inputURL = input
 
+	if options != nil && options.Options != nil {
+		if netErr := protocolstate.SetupHeadlessNetworkPolicy(options.Options, page); netErr != nil {
+			return nil, nil, netErr
+		}
+	}
+
 	httpclient, err := i.browser.getHTTPClient()
 	if err != nil {
 		return nil, nil, err
```

**File**: `pkg/protocols/headless/engine/proxy.go` (added, +278/-0)
```diff
@@ -0,0 +1,278 @@
+package engine
+
+import (
+	"bufio"
+	"context"
+	"fmt"
+	"io"
+	"net"
+	"net/http"
+	"net/url"
+	"strings"
+	"sync"
+	"time"
+
+	"github.com/projectdiscovery/nuclei/v3/pkg/protocols/common/protocolstate"
+	"github.com/projectdiscovery/nuclei/v3/pkg/types"
+)
+
+// headlessProxy is a local loopback HTTP/CONNECT proxy that intercepts
+// and enforces network policy on all network traffic initiated by the headless browser,
+// including WebSocket handshakes (which bypass CDP request blocking in Chromium).
+type headlessProxy struct {
+	listener  net.Listener
+	options   *types.Options
+	closed    chan struct{}
+	closeOnce sync.Once
+}
+
+// newHeadlessProxy creates and starts a loopback HTTP/CONNECT proxy for headless Chrome.
+func newHeadlessProxy(options *types.Options) (*headlessProxy, error) {
+	ln, err := net.Listen("tcp", "127.0.0.1:0")
+	if err != nil {
+		return nil, fmt.Errorf("could not start headless proxy listener: %w", err)
+	}
+
+	p := &headlessProxy{
+		listener: ln,
+		options:  options,
+		closed:   make(chan struct{}),
+	}
+
+	go p.serve()
+
+	return p, nil
+}
+
+// Addr returns the listening address of the proxy (e.g. "127.0.0.1:54321").
+func (p *headlessProxy) Addr() string {
+	if p.listener == nil {
+		return ""
+	}
+	return p.listener.Addr().String()
+}
+
+// Close terminates the proxy listener.
+func (p *headlessProxy) Close() error {
+	var err error
+	p.closeOnce.Do(func() {
+		close(p.closed)
+		if p.listener != nil {
+			err = p.listener.Close()
+		}
+	})
+	return err
+}
+
+func (p *headlessProxy) serve() {
+	for {
+		conn, err := p.listener.Accept()
+		if err != nil {
+			select {
+			case <-p.closed:
+				return
+			default:
+				return
+			}
+		}
+		go p.handleConn(conn)
+	}
+}
+
+func (p *headlessProxy) handleConn(clientConn net.Conn) {
+	defer func() {
+		_ = clientConn.Close()
+	}()
+
+	reader := bufio.NewReader(clientConn)
+	req, err := http.ReadRequest(reader)
+	if err != nil {
+		return
+	}
+
+	host := req.Host
+	if host == "" {
+		host = req.URL.Host
+	}
+
+	// Validate host against network policy
+	executionId := ""
+	if p.options != nil {
+		executionId = p.options.ExecutionId
+	}
+
+	h := host
+	if splitH, _, err := net.SplitHostPort(host); err == nil {
+		h = splitH
+	}
+	canonH := protocolstate.CanonicalizeHost(h)
+
+	if !protocolstate.IsHostAllowed(executionId, host) || !protocolstate.IsHostAllowed(executionId, canonH) {
+		if req.Method == http.MethodConnect {
+			_, _ = clientConn.Write([]byte("HTTP/1.1 403 Forbidden\r\n\r\n"))
+		} else {
+			resp := &http.Response{
+				StatusCode: http.StatusForbidden,
+				Status:     "403 Forbidden",
+				Proto:      "HTTP/1.1",
+				ProtoMajor: 1,
+				ProtoMinor: 1,
+				Header:     make(http.Header),
+				Body:       io.NopCloser(strings.NewReader("Blocked by network policy")),
+			}
+			_ = resp.Write(clientConn)
+		}
+		return
+	}
+
+	// Handle CONNECT tunnel (for HTTPS and WebSocket handshakes).
+	// Keep the buffered reader: the client hello is often already in it.
+	if req.Method == http.MethodConnect {
+		p.handleConnect(clientConn, reader, host)
+		return
+	}
+
+	// Handle standard HTTP requests
+	p.handleHTTP(clientConn, reader, req, host)
+}
+
+func (p *headlessProxy) dialTarget(target string) (net.Conn, error) {
+	host := target
+	port := "80"
+	if h, pt, err := net.SplitHostPort(target); err == nil {
+		host = h
+		port = pt
+	}
+	canonHost := protocolstate.CanonicalizeHost(host)
+
+	executionId := ""
+	if p.options != nil {
+		executionId = p.options.ExecutionId
+	}
+
+	if !protocolstate.IsHostAllowed(executionId, host) || !protocolstate.IsHostAllowed(executionId, canonHost) {
+		return nil, fmt.Errorf("target %s blocked by network policy", target)
+	}
+
+	// Dial an address that was just checked. A later lookup of the name can
+	// return a different, excluded address. A resolution failure refuses the
+	// dial instead of connecting to whatever the name means a moment later.
+	dialHost := canonHost
+	if net.ParseIP(canonHost) == nil {
+		ips, err := net.LookupIP(canonHost)
+		if err != nil {
+			return nil, fmt.Errorf("resolve %s: %w", canonHost, err)
+		}
+		var chosen net.IP
+		for _, resolvedIP := range ips {
+			canonIP := protocolstate.CanonicalizeHost(resolvedIP.String())
+			if !protocolstate.IsHostAllowed(executionId, canonIP) {
+				return nil, fmt.Errorf("target %s resolves to blocked IP %s", target, canonIP)
+			}
+			if chosen == nil {
+				chosen = resolvedIP
+			}
+		}
+		if chosen == nil {
+			return nil, fmt.Errorf("resolve %s: no addresses", canonHost)
+		}
+		dialHost = chosen.String()
+	}
+
+	dialAddr := net.JoinHostPort(dialHost, port)
+
+	// If upstream proxy is configured, route through it after validation
+	if p.options != nil && p.options.AliveHttpProxy != "" {
+		proxyURL, err := url.Parse(p.options.AliveHttpProxy)
+		if err == nil {
+			proxyConn, err := net.DialTimeout("tcp", proxyURL.Host, 10*time.Second)
+			if err != nil {
+				return nil, err
+			}
+			// CONNE
```

**File**: `pkg/protocols/headless/engine/proxy_test.go` (added, +433/-0)
```diff
@@ -0,0 +1,433 @@
+package engine
+
+import (
+	"bufio"
+	"fmt"
+	"io"
+	"net"
+	"net/http"
+	"sync/atomic"
+	"testing"
+	"time"
+
+	"github.com/go-rod/rod"
+	"github.com/go-rod/rod/lib/launcher"
+	"github.com/go-rod/rod/lib/proto"
+	"github.com/projectdiscovery/networkpolicy"
+	"github.com/projectdiscovery/nuclei/v3/pkg/protocols/common/protocolstate"
+	"github.com/projectdiscovery/nuclei/v3/pkg/types"
+	"github.com/stretchr/testify/require"
+)
+
+func TestHeadlessProxy_BlocksExcludedHosts(t *testing.T) {
+	// 1. Setup blocked TCP server
+	blockedLn, err := net.Listen("tcp", "127.0.0.1:0")
+	require.NoError(t, err)
+	defer func() {
+		_ = blockedLn.Close()
+	}()
+
+	var blockedHits atomic.Int32
+	go func() {
+		for {
+			conn, err := blockedLn.Accept()
+			if err != nil {
+				return
+			}
+			blockedHits.Add(1)
+			_ = conn.Close()
+		}
+	}()
+
+	blockedPort := blockedLn.Addr().(*net.TCPAddr).Port
+
+	// 2. Setup allowed TCP server
+	allowedLn, err := net.Listen("tcp", "127.0.0.1:0")
+	require.NoError(t, err)
+	defer func() {
+		_ = allowedLn.Close()
+	}()
+
+	var allowedHits atomic.Int32
+	go func() {
+		for {
+			conn, err := allowedLn.Accept()
+			if err != nil {
+				return
+			}
+			allowedHits.Add(1)
+			_, _ = conn.Write([]byte("HTTP/1.1 200 OK\r\nContent-Length: 2\r\n\r\nOK"))
+			_ = conn.Close()
+		}
+	}()
+
+	allowedPort := allowedLn.Addr().(*net.TCPAddr).Port
+
+	// 3. Configure network policy with blocked target
+	execID := fmt.Sprintf("test-proxy-%d", time.Now().UnixNano())
+	opts := &types.Options{
+		ExecutionId: execID,
+		ExcludeTargets: []string{
+			fmt.Sprintf("127.0.0.1:%d", blockedPort),
+		},
+	}
+
+	np, err := networkpolicy.New(networkpolicy.Options{
+		DenyList: []string{
+			fmt.Sprintf("127.0.0.1:%d", blockedPort),
+		},
+	})
+	require.NoError(t, err)
+
+	d := &protocolstate.Dialers{
+		NetworkPolicy:  np,
+		ExcludeTargets: opts.ExcludeTargets,
+	}
+	_ = protocolstate.Init(opts)
+	// Override with our strict policy for this test
+	if existing := protocolstate.GetDialersWithId(execID); existing != nil {
+		existing.NetworkPolicy = np
+	} else {
+		// Mock dialer in case Init didn't populate for test
+		_ = d
+	}
+
+	// 4. Start headless proxy
+	proxy, err := newHeadlessProxy(opts)
+	require.NoError(t, err)
+	defer func() {
+		_ = proxy.Close()
+	}()
+
+	// 5. Test CONNECT to blocked destination
+	clientConn, err := net.Dial("tcp", proxy.Addr())
+	require.NoError(t, err)
+	defer func() {
+		_ = clientConn.Close()
+	}()
+
+	connectReq := fmt.Sprintf("CONNECT 127.0.0.1:%d HTTP/1.1\r\nHost: 127.0.0.1:%d\r\n\r\n", blockedPort, blockedPort)
+	_, err = clientConn.Write([]byte(connectReq))
+	require.NoError(t, err)
+
+	reader := bufio.NewReader(clientConn)
+	resp, err := http.ReadResponse(reader, nil)
+	require.NoError(t, err)
+	require.Equal(t, http.StatusForbidden, resp.StatusCode)
+	require.Zero(t, blockedHits.Load(), "blocked host must never receive connection")
+
+	// 6. Test GET to blocked destination
+	clientConn2, err := net.Dial("tcp", proxy.Addr())
+	require.NoError(t, err)
+	defer func() {
+		_ = clientConn2.Close()
+	}()
+
+	getReq := fmt.Sprintf("GET http://127.0.0.1:%d/ HTTP/1.1\r\nHost: 127.0.0.1:%d\r\n\r\n", blockedPort, blockedPort)
+	_, err = clientConn2.Write([]byte(getReq))
+	require.NoError(t, err)
+
+	reader2 := bufio.NewReader(clientConn2)
+	resp2, err := http.ReadResponse(reader2, nil)
+	require.NoError(t, err)
+	require.Equal(t, http.StatusForbidden, resp2.StatusCode)
+	require.Zero(t, blockedHits.Load(), "blocked host must never receive connection")
+
+	// 7. Test CONNECT to allowed destination
+	clientConn3, err := net.Dial("tcp", proxy.Addr())
+	require.NoError(t, err)
+	defer func() {
+		_ = clientConn3.Close()
+	}()
+
+	allowedReq := fmt.Sprintf("CONNECT 127.0.0.1:%d HTTP/1.1\r\nHost: 127.0.0.1:%d\r\n\r\n", allowedPort, allowedPort)
+	_, err = clientConn3.Write([]byte(allowedReq))
+	require.NoError(t, err)
+
+	reader3 := bufio.NewReader(clientConn3)
+	resp3, err := http.ReadResponse(reader3, nil)
+	require.NoError(t, err)
+	require.Equal(t, http.StatusOK, resp3.StatusCode)
+
+	// Send data through tunnel
+	_, err = clientConn3.Write([]byte("GET / HTTP/1.1\r\nHost: test\r\n\r\n"))
+	require.NoError(t, err)
+
+	buf := make([]byte, 1024)
+	n, err := reader3.Read(buf)
+	// Windows can return the tunneled bytes and a connection-abort error
+	// once the target closes and the proxy tears the tunnel down.
+	require.Contains(t, string(buf[:n]), "200 OK")
+	if n == 0 {
+		require.NoError(t, err)
+	}
+	require.Equal(t, int32(1), allowedHits.Load())
+}
+
+func TestHeadlessProxy_RealChromeWebSocketEndToEnd(t *testing.T) {
+	// 1. Setup blocked WebSocket server
+	blockedLn, err := net.Listen("tcp", "127.0.0.1:0")
+	require.NoError(t, err)
+	defer func() {
+		_ = blockedLn.Close()
+	}()
+
+	var blockedHits atomic.Int32
+	go func() {
+		for {
+			conn, err := blockedLn.Accept()
+			if err != nil {
+				return
+			}
+			blockedHits.Add(1)
+			_ = conn.Close()
+		}
+	}()
+
```

---

### Incident Patch 3: `943ec350` (2026-10-23)
**Commit Message**: Merge pull request #7876 from TassioSales/fix/proxy-internal-env-vars

fix(runner): set HTTPS_PROXY and all proxy env vars when proxy-internal is enabled

**File**: `internal/runner/proxy.go` (modified, +24/-4)
```diff
@@ -14,9 +14,25 @@ import (
 )
 
 const (
-	HTTP_PROXY_ENV = "HTTP_PROXY"
+	HTTP_PROXY_ENV  = "HTTP_PROXY"
+	HTTPS_PROXY_ENV = "HTTPS_PROXY"
 )
 
+var proxyEnvVars = []string{
+	"HTTP_PROXY",
+	"HTTPS_PROXY",
+	"http_proxy",
+	"https_proxy",
+	"ALL_PROXY",
+	"all_proxy",
+}
+
+func setProxyEnv(proxyURL string) {
+	for _, env := range proxyEnvVars {
+		_ = os.Setenv(env, proxyURL)
+	}
+}
+
 // loadProxyServers load list of proxy servers from file or comma separated
 func loadProxyServers(options *types.Options) error {
 	if len(options.Proxy) == 0 {
@@ -53,15 +69,19 @@ func loadProxyServers(options *types.Options) error {
 		return errkit.Wrapf(err, "failed to parse proxy got %v", err)
 	}
 	if options.ProxyInternal {
-		_ = os.Setenv(HTTP_PROXY_ENV, proxyURL.String())
+		setProxyEnv(proxyURL.String())
 	}
 	switch proxyURL.Scheme {
 	case proxyutils.HTTP, proxyutils.HTTPS:
-		options.Logger.Verbose().Msgf("Using %s as proxy server", proxyURL.String())
+		if options.Logger != nil {
+			options.Logger.Verbose().Msgf("Using %s as proxy server", proxyURL.String())
+		}
 		options.AliveHttpProxy = proxyURL.String()
 	case proxyutils.SOCKS5:
 		options.AliveSocksProxy = proxyURL.String()
-		options.Logger.Verbose().Msgf("Using %s as socket proxy server", proxyURL.String())
+		if options.Logger != nil {
+			options.Logger.Verbose().Msgf("Using %s as socket proxy server", proxyURL.String())
+		}
 	}
 	return nil
 }
```

**File**: `internal/runner/proxy_test.go` (modified, +81/-0)
```diff
@@ -1,8 +1,14 @@
 package runner
 
 import (
+	"net/http"
+	"net/http/httptest"
+	"os"
 	"testing"
 
+	"github.com/projectdiscovery/goflags"
+	"github.com/projectdiscovery/gologger"
+	"github.com/projectdiscovery/nuclei/v3/pkg/types"
 	"github.com/stretchr/testify/require"
 )
 
@@ -14,3 +20,78 @@ func TestValidateReplayProxy(t *testing.T) {
 		require.Error(t, validateReplayProxy(invalid), invalid)
 	}
 }
+
+type envState struct {
+	val string
+	set bool
+}
+
+func saveAndRestoreProxyEnv(t *testing.T) {
+	t.Helper()
+	original := make(map[string]envState, len(proxyEnvVars))
+	for _, env := range proxyEnvVars {
+		val, set := os.LookupEnv(env)
+		original[env] = envState{val: val, set: set}
+		_ = os.Unsetenv(env)
+	}
+
+	t.Cleanup(func() {
+		for env, state := range original {
+			if state.set {
+				_ = os.Setenv(env, state.val)
+			} else {
+				_ = os.Unsetenv(env)
+			}
+		}
+	})
+}
+
+func TestSetProxyEnv(t *testing.T) {
+	saveAndRestoreProxyEnv(t)
+
+	testProxy := "http://127.0.0.1:8080"
+	setProxyEnv(testProxy)
+
+	for _, env := range proxyEnvVars {
+		require.Equal(t, testProxy, os.Getenv(env), "expected %s to be set", env)
+	}
+}
+
+func TestLoadProxyServers_ProxyInternal(t *testing.T) {
+	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
+		w.WriteHeader(http.StatusOK)
+	}))
+	defer server.Close()
+
+	t.Run("proxy internal enabled sets all env vars", func(t *testing.T) {
+		saveAndRestoreProxyEnv(t)
+
+		options := &types.Options{
+			Proxy:         goflags.StringSlice{server.URL},
+			ProxyInternal: true,
+			Timeout:       5,
+			Logger:        &gologger.Logger{},
+		}
+		err := loadProxyServers(options)
+		require.NoError(t, err)
+		for _, env := range proxyEnvVars {
+			require.Equal(t, server.URL, os.Getenv(env), "expected %s to be set", env)
+		}
+	})
+
+	t.Run("proxy internal disabled does not set env vars", func(t *testing.T) {
+		saveAndRestoreProxyEnv(t)
+
+		options := &types.Options{
+			Proxy:         goflags.StringSlice{server.URL},
+			ProxyInternal: false,
+			Timeout:       5,
+			Logger:        &gologger.Logger{},
+		}
+		err := loadProxyServers(options)
+		require.NoError(t, err)
+		for _, env := range proxyEnvVars {
+			require.Empty(t, os.Getenv(env), "expected %s not to be set", env)
+		}
+	})
+}
```

**File**: `internal/runner/runner.go` (modified, +1/-1)
```diff
@@ -225,7 +225,7 @@ func New(options *types.Options) (*Runner, error) {
 	runner.catalog = disk.NewCatalog(config.DefaultConfig.TemplatesDirectory)
 
 	var httpclient *retryablehttp.Client
-	if options.ProxyInternal && options.AliveHttpProxy != "" || options.AliveSocksProxy != "" {
+	if options.ProxyInternal && (options.AliveHttpProxy != "" || options.AliveSocksProxy != "") {
 		var err error
 
 		httpclient, err = httpclientpool.Get(options, &httpclientpool.Configuration{}, "")
```

**File**: `lib/sdk_private.go` (modified, +1/-1)
```diff
@@ -214,7 +214,7 @@ func (e *NucleiEngine) init(ctx context.Context) error {
 		_ = protocolinit.Init(e.opts)
 	}
 
-	if e.opts.ProxyInternal && e.opts.AliveHttpProxy != "" || e.opts.AliveSocksProxy != "" {
+	if e.opts.ProxyInternal && (e.opts.AliveHttpProxy != "" || e.opts.AliveSocksProxy != "") {
 		httpclient, err := httpclientpool.Get(e.opts, &httpclientpool.Configuration{}, "")
 		if err != nil {
 			return err
```

#### Recent Merged Pull Requests:
- **PR #7910** (2026-10-23): fix(js): cap what an smtp connection may read (@gnuletik)
- **PR #7906** (2026-10-23): fix(js): close ldap and smtp connections when the template ends (@gnuletik)
- **PR #7904** (2026-10-23): fix(runner): use protocolstate fastdialer for default interactsh client (#7903) (@TassioSales)
- **PR #7902** (2026-10-23): bump Go toolchain for CVE-2026-111943 (@dogancanbakir)
- **PR #7899** (2026-10-20): bump utils and tlsx to the zcrypto TLS 1.3 revision (@dogancanbakir)
- **PR #7897** (2026-10-23): apply host backoff to headless navigations (@dogancanbakir)

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

## X. Merge pull request #7756 from baturdenada/fix/dialer-panic

**RULE**:
When implementing operations in `pkg/input/provider/list/hmap.go`, engineers MUST enforce rigorous boundary validation, safe state transitions, and memory/concurrency invariants as established by production defect remediation in projectdiscovery/nuclei. All inputs crossing module boundaries must be explicitly verified before state persistence.

**WHY**:
Prevents defects observed in production commit `64ad4591`: Merge pull request #7756 from baturdenada/fix/dialer-panic. Unvalidated execution paths cause runtime exceptions, race conditions, and silent state corruption under concurrent workloads.

**WHEN TO APPLY**:
Subsystems managing Go data structures, boundary deserialization, API parsing, or resource lifecycles matching `pkg/input/provider/list/hmap.go`.

**VERIFIED IMPLEMENTATION PATTERN**:
```go
// Verified production-grade fix pattern:
			gologger.Error().Msgf("dialers with executionId %s not found", executionId)
			return
			gologger.Error().Msgf("dialers with executionId %s not found", executionId)
			return
			gologger.Error().Msgf("dialers with executionId %s not found", executionId)
			return
			gologger.Error().Msgf("dialers with executionId %s not found", executionId)
			return
```

**NEGATIVE CONSTRAINT**:
```go
// Anti-pattern to NEVER write (induced failure mode):
			panic("dialers with executionId " + executionId + " not found")
			panic("dialers with executionId " + executionId + " not found")
			panic("dialers with executionId " + executionId + " not found")
			panic("dialers with executionId " + executionId + " not found")
```

**VERIFICATION METHOD**:
Automated regression test asserting that input states reproducing defect `64ad4591` are properly handled with clean fallback behavior.
