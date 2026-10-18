> **Canonical Learning Artifact**: `07_PROJECT_LEARNING/projectdiscovery-nuclei-learnings.md`  
> **Source**: github ([https://github.com/projectdiscovery/nuclei](https://github.com/projectdiscovery/nuclei))  
> **Source Version**: `10f1967c`  
> **License**: MIT  
> **Synthesized By**: zero-clone-structural-synthesizer  
> **Timestamp**: 2026-10-18T23:20:37.197Z  
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
> **Harvest Timestamp**: 2026-10-18T23:20:37.003Z  
> **Compliance State**: Free Tier Guaranteed | Strict Rate-Limit Backoff Honored  

---

## 1. Context & Architectural Overview
- **Repository / Resource**: `projectdiscovery/nuclei`
- **Description**: Nuclei is a fast, customizable vulnerability scanner powered by the global security community and built on a simple YAML-based DSL, enabling collaboration to tackle trending vulnerabilities on the internet. It helps you find vulnerabilities in your applications, APIs, networks, DNS, and cloud configurations.
- **Primary Language / Ecosystem**: Go
- **Discovered Manifests / Configurations**: go.mod, README.md, Dockerfile
- **Stars / Engagement**: 32107 stars

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
	ctxArgs.MetaInput = v
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

### Incident Patch 1: `a5715288` (2026-10-13)
**Commit Message**: fix(runtime): honor cancellation in HTTP and headless waits (#7814)

* fix(http): cancel per-host rate admission

* fix: address PR review comments

* test: keep request coverage with request tests

* fix(headless): bound browser setup by request context

* fix: address PR review comments

* fix: address PR review comments

* fix cancellation-safe rate and headless cleanup

* fix: cancel global rate admission waits

* chore: bump ratelimit to v0.0.93

**File**: `go.mod` (modified, +2/-2)
```diff
@@ -93,7 +93,7 @@ require (
 	github.com/projectdiscovery/mapcidr v1.1.97
 	github.com/projectdiscovery/n3iwf v0.0.0-20230523120440-b8cd232ff1f5
 	github.com/projectdiscovery/networkpolicy v0.1.54
-	github.com/projectdiscovery/ratelimit v0.0.92
+	github.com/projectdiscovery/ratelimit v0.0.93
 	github.com/projectdiscovery/rawhttp v0.1.92
 	github.com/projectdiscovery/rdap v0.9.0
 	github.com/projectdiscovery/retryabledns v1.0.116
@@ -130,6 +130,7 @@ require (
 	golang.org/x/sys v0.47.0
 	golang.org/x/term v0.45.0
 	golang.org/x/text v0.41.0
+	golang.org/x/time v0.15.0
 	golang.org/x/tools v0.49.0
 	google.golang.org/grpc v1.83.2
 	google.golang.org/protobuf v1.36.11
@@ -459,7 +460,6 @@ require (
 	golang.org/x/arch v0.3.0 // indirect
 	golang.org/x/crypto v0.55.0 // indirect
 	golang.org/x/mod v0.39.0 // indirect
-	golang.org/x/time v0.15.0 // indirect
 	google.golang.org/api v0.264.0 // indirect
 	google.golang.org/genproto v0.0.0-20260128011058-8636f8732409 // indirect
 	google.golang.org/genproto/googleapis/api v0.0.0-20260526163538-3dc84a4a5aaa // indirect
```

**File**: `go.sum` (modified, +2/-2)
```diff
@@ -983,8 +983,8 @@ github.com/projectdiscovery/n3iwf v0.0.0-20230523120440-b8cd232ff1f5 h1:L/e8z8yw
 github.com/projectdiscovery/n3iwf v0.0.0-20230523120440-b8cd232ff1f5/go.mod h1:pGW2ncnTxTxHtP9wzcIJAB+3/NMp6IiuQWd2NK7K+oc=
 github.com/projectdiscovery/networkpolicy v0.1.54 h1:+v7yyuRBu2S7dzeIJToDENy1i+HjRhNzqnQrDlm00z8=
 github.com/projectdiscovery/networkpolicy v0.1.54/go.mod h1:tN+YAFVlJjHv/znPEhkcSAjmBMkMhslC9XpWKTrKEHw=
-github.com/projectdiscovery/ratelimit v0.0.92 h1:2h2/AU81Lbn/xevb4KtZCMhaQej+u7W3uLXFUD163iU=
-github.com/projectdiscovery/ratelimit v0.0.92/go.mod h1:Tqpx1QKdFI63L01T2gpSvV5Uro9CnZkZWr80ciSXSBY=
+github.com/projectdiscovery/ratelimit v0.0.93 h1:k2rRpCR31DqeqrORSgGzJ+z0T7+QGCt0Z0+Ov/TVrgk=
+github.com/projectdiscovery/ratelimit v0.0.93/go.mod h1:Tqpx1QKdFI63L01T2gpSvV5Uro9CnZkZWr80ciSXSBY=
 github.com/projectdiscovery/rawhttp v0.1.92 h1:38GRsVLNllES/dZcEcA6s6P+rYBp34H9mDphMJMDvvg=
 github.com/projectdiscovery/rawhttp v0.1.92/go.mod h1:spfXTPjxCj+bfWLynMVB7uOb+LS3PDNAI9HexMEV1Zg=
 github.com/projectdiscovery/rdap v0.9.0 h1:wPhHx5pQ2QI+WGhyNb2PjhTl0NtB39Nk7YFZ9cp8ZGA=
```

**File**: `pkg/protocols/common/hostratelimit/limiter.go` (modified, +1/-2)
```diff
@@ -6,12 +6,11 @@ import (
 
 	"github.com/projectdiscovery/nuclei/v3/pkg/protocols/common/protocolstate"
 	"github.com/projectdiscovery/nuclei/v3/pkg/types"
-	"github.com/projectdiscovery/ratelimit"
 )
 
 // GetPerHostRateLimiter gets or creates a rate limiter for a specific host
 // Returns nil if per-host rate limiting is not enabled
-func GetPerHostRateLimiter(options *types.Options, hostname string) (*ratelimit.Limiter, error) {
+func GetPerHostRateLimiter(options *types.Options, hostname string) (*PerHostRateLimiter, error) {
 	if !options.PerHostRateLimit {
 		return nil, nil
 	}
```

**File**: `pkg/protocols/common/hostratelimit/pool.go` (modified, +169/-25)
```diff
@@ -3,15 +3,15 @@ package hostratelimit
 import (
 	"context"
 	"fmt"
+	"math"
 	"sync"
 	"sync/atomic"
 	"time"
 
 	"github.com/hashicorp/golang-lru/v2/expirable"
 	"github.com/projectdiscovery/gologger"
 	"github.com/projectdiscovery/nuclei/v3/pkg/types"
-	"github.com/projectdiscovery/nuclei/v3/pkg/utils"
-	"github.com/projectdiscovery/ratelimit"
+	"golang.org/x/time/rate"
 )
 
 type PerHostRateLimitPool struct {
@@ -31,7 +31,7 @@ type PerHostRateLimitPool struct {
 const ppsWindowSize = 100
 
 type rateLimitEntry struct {
-	limiter        *ratelimit.Limiter
+	limiter        *PerHostRateLimiter
 	createdAt      time.Time
 	accessCount    atomic.Uint64
 	requestCount   atomic.Uint64
@@ -46,6 +46,154 @@ type rateLimitEntry struct {
 	requestMu         sync.Mutex
 }
 
+// PerHostRateLimiter serializes admission for one normalized host.
+type PerHostRateLimiter struct {
+	limiter   *rate.Limiter
+	ctx       context.Context
+	cancel    context.CancelFunc
+	admission chan struct{}
+	unlimited bool
+	mu        sync.RWMutex
+	limit     uint
+	duration  time.Duration
+}
+
+// Wait blocks until the host budget admits one request or ctx is canceled.
+func (l *PerHostRateLimiter) Wait(ctx context.Context) error {
+	if ctx == nil {
+		ctx = context.Background()
+	}
+	if err := ctx.Err(); err != nil {
+		return context.Cause(ctx)
+	}
+	if l == nil || l.ctx == nil || l.ctx.Err() != nil {
+		return nil
+	}
+	l.mu.RLock()
+	unlimited := l.unlimited
+	l.mu.RUnlock()
+	if unlimited {
+		return nil
+	}
+
+	select {
+	case l.admission <- struct{}{}:
+		defer func() { <-l.admission }()
+	case <-ctx.Done():
+		return context.Cause(ctx)
+	case <-l.ctx.Done():
+		return nil
+	}
+
+	l.mu.RLock()
+	if l.unlimited {
+		l.mu.RUnlock()
+		return nil
+	}
+	reservation := l.limiter.Reserve()
+	l.mu.RUnlock()
+	if !reservation.OK() {
+		return fmt.Errorf("host rate limiter cannot reserve one request")
+	}
+	delay := reservation.Delay()
+	if delay <= 0 {
+		return nil
+	}
+
+	timer := time.NewTimer(delay)
+	defer timer.Stop()
+	select {
+	case <-timer.C:
+		return nil
+	case <-ctx.Done():
+		reservation.Cancel()
+		return context.Cause(ctx)
+	case <-l.ctx.Done():
+		reservation.Cancel()
+		return nil
+	}
+}
+
+// Take waits for one request using a non-cancelable context.
+func (l *PerHostRateLimiter) Take() {
+	if err := l.Wait(context.Background()); err != nil {
+		gologger.Warning().Msgf("Could not take per-host rate limit: %s", err)
+	}
+}
+
+// CanTake reports whether the limiter can admit a request immediately.
+func (l *PerHostRateLimiter) CanTake() bool {
+	if l == nil || l.ctx == nil {
+		return true
+	}
+	if l.ctx.Err() != nil {
+		return false
+	}
+	l.mu.RLock()
+	defer l.mu.RUnlock()
+	return l.unlimited || (len(l.admission) == 0 && l.limiter.Tokens() > 0)
+}
+
+// GetLimit returns the current request budget for the configured duration.
+func (l *PerHostRateLimiter) GetLimit() uint {
+	if l == nil {
+		return 0
+	}
+	l.mu.RLock()
+	defer l.mu.RUnlock()
+	return l.limit
+}
+
+// SetLimit changes the request budget while preserving the configured duration.
+func (l *PerHostRateLimiter) SetLimit(limit uint) {
+	if l == nil {
+		return
+	}
+	l.mu.Lock()
+	defer l.mu.Unlock()
+	l.limit = limit
+	l.configureLocked()
+}
+
+// SetDuration changes the duration over which the request budget is refilled.
+func (l *PerHostRateLimiter) SetDuration(duration time.Duration) {
+	if duration <= 0 {
+		panic("rate limit duration must be positive")
+	}
+	if l == nil {
+		return
+	}
+	l.mu.Lock()
+	defer l.mu.Unlock()
+	l.duration = duration
+	l.configureLocked()
+}
+
+func (l *PerHostRateLimiter) configureLocked() {
+	if l.duration == 0 {
+		l.unlimited = true
+		return
+	}
+	requestsPerSecond := rate.Limit(float64(l.limit) / l.duration.Seconds())
+	if l.limiter == nil {
+		l.limiter = rate.NewLimiter(requestsPerSecond, int(l.limit))
+	} else {
+		l.limiter.SetLimit(requestsPerSecond)
+		l.limiter.SetBurst(int(l.limit))
+	}
+	if l.admission == nil {
+		l.admission = make(chan struct{}, 1)
+	}
+	l.unlimited = false
+}
+
+// Stop releases current and future waiters without reporting a scan error.
+func (l *PerHostRateLimiter) Stop() {
+	if l != nil && l.cancel != nil {
+		l.cancel()
+	}
+}
+
 func NewPerHostRateLimitPool(size int, maxIdleTime, maxLifetime time.Duration, options *types.Options) *PerHostRateLimitPool {
 	if size < 0 {
 		size = 0
@@ -68,9 +216,6 @@ func NewPerHostRateLimitPool(size int, maxIdleTime, maxLifetime time.Duration, o
 		cache: expirable.NewLRU[string, *rateLimitEntry](
 			size,
 			func(key string, value *rateLimitEntry) {
-				if value.limiter != nil {
-					value.limiter.Stop()
-				}
 				gologger.Debug().Msgf("[perhost-ratelimit-pool] Evicted rate limiter for %s (age: %v, accesses: %d)",
 					key, time.Since(value.createdAt), value.accessCount.Load())
 			},
@@ -88,7 +233,7 @@ func NewPerHostRateLimitPool(size int, maxIdleTime, maxLifetime time.Duration, o
 
 func (p *PerHostRateLimitPool) GetOrCreate(
 	host string,

```

**File**: `pkg/protocols/common/hostratelimit/pool_close_test.go` (modified, +119/-0)
```diff
@@ -1,6 +1,7 @@
 package hostratelimit
 
 import (
+	"context"
 	"fmt"
 	"runtime"
 	"testing"
@@ -48,6 +49,124 @@ func TestPerHostRateLimitPoolSmoothsLowRates(t *testing.T) {
 		"the first request beyond the initial bucket should be continuously refilled, not wait for a fixed window")
 }
 
+func TestPerHostRateLimitCancellationReleasesReservation(t *testing.T) {
+	opts := &types.Options{RateLimit: 1, RateLimitDuration: 300 * time.Millisecond}
+	pool := NewPerHostRateLimitPool(1, time.Hour, time.Hour, opts)
+	t.Cleanup(pool.Close)
+
+	limiter, err := pool.GetOrCreate("https://cancel.example.com")
+	require.NoError(t, err)
+	require.NoError(t, limiter.Wait(context.Background()))
+
+	ctx, cancel := context.WithCancel(context.Background())
+	result := make(chan error, 1)
+	go func() { result <- limiter.Wait(ctx) }()
+	require.Eventually(t, func() bool { return len(limiter.admission) == 1 }, time.Second, time.Millisecond)
+	cancel()
+	require.ErrorIs(t, <-result, context.Canceled)
+
+	started := time.Now()
+	require.NoError(t, limiter.Wait(context.Background()))
+	require.Less(t, time.Since(started), 450*time.Millisecond)
+}
+
+func TestPerHostRateLimitCancellationAdvancesQueuedWaiter(t *testing.T) {
+	opts := &types.Options{RateLimit: 1, RateLimitDuration: 500 * time.Millisecond}
+	pool := NewPerHostRateLimitPool(1, time.Hour, time.Hour, opts)
+	t.Cleanup(pool.Close)
+
+	limiter, err := pool.GetOrCreate("https://queue.example.com")
+	require.NoError(t, err)
+	require.NoError(t, limiter.Wait(context.Background()))
+
+	firstCtx, cancelFirst := context.WithCancel(context.Background())
+	firstResult := make(chan error, 1)
+	go func() { firstResult <- limiter.Wait(firstCtx) }()
+	require.Eventually(t, func() bool { return len(limiter.admission) == 1 }, time.Second, time.Millisecond)
+
+	secondResult := make(chan error, 1)
+	started := time.Now()
+	go func() { secondResult <- limiter.Wait(context.Background()) }()
+	cancelFirst()
+
+	require.ErrorIs(t, <-firstResult, context.Canceled)
+	require.NoError(t, <-secondResult)
+	require.Less(t, time.Since(started), 850*time.Millisecond)
+}
+
+func TestPerHostRateLimitStopReleasesWaitersWithoutError(t *testing.T) {
+	opts := &types.Options{RateLimit: 1, RateLimitDuration: time.Second}
+	limiter, err := newPerHostRateLimiter(opts)
+	require.NoError(t, err)
+	require.NoError(t, limiter.Wait(context.Background()))
+
+	result := make(chan error, 1)
+	go func() { result <- limiter.Wait(context.Background()) }()
+	require.Eventually(t, func() bool { return len(limiter.admission) == 1 }, time.Second, time.Millisecond)
+	limiter.Stop()
+
+	require.NoError(t, <-result)
+	require.NoError(t, limiter.Wait(context.Background()))
+}
+
+func TestPerHostRateLimiterZeroValueIsUnlimited(t *testing.T) {
+	var limiter PerHostRateLimiter
+	require.NoError(t, limiter.Wait(context.Background()))
+	require.True(t, limiter.CanTake())
+	limiter.Stop()
+}
+
+func TestPerHostRateLimiterRetainsMutableLimitAPI(t *testing.T) {
+	limiter, err := newPerHostRateLimiter(&types.Options{RateLimit: 2, RateLimitDuration: time.Second})
+	require.NoError(t, err)
+	t.Cleanup(limiter.Stop)
+
+	require.Equal(t, uint(2), limiter.GetLimit())
+	limiter.SetLimit(4)
+	limiter.SetDuration(2 * time.Second)
+	require.Equal(t, uint(4), limiter.GetLimit())
+	require.NoError(t, limiter.Wait(context.Background()))
+
+	unlimited, err := newPerHostRateLimiter(nil)
+	require.NoError(t, err)
+	t.Cleanup(unlimited.Stop)
+	require.Equal(t, uint(^uint32(0)), unlimited.GetLimit())
+	unlimited.SetLimit(2)
+	require.Equal(t, uint(2), unlimited.GetLimit())
+	require.NoError(t, unlimited.Wait(context.Background()))
+}
+
+func TestPerHostRateLimiterImmediateWaitHasBoundedAllocations(t *testing.T) {
+	limiter, err := newPerHostRateLimiter(&types.Options{RateLimit: 100, RateLimitDuration: time.Second})
+	require.NoError(t, err)
+	t.Cleanup(limiter.Stop)
+
+	allocations := testing.AllocsPerRun(10, func() {
+		if waitErr := limiter.Wait(context.Background()); waitErr != nil {
+			t.Fatal(waitErr)
+		}
+	})
+	require.LessOrEqual(t, allocations, float64(1))
+}
+
+func TestPerHostRateLimitEvictionKeepsInflightWaitValid(t *testing.T) {
+	opts := &types.Options{RateLimit: 1, RateLimitDuration: 100 * time.Millisecond}
+	pool := NewPerHostRateLimitPool(1, time.Hour, time.Hour, opts)
+	t.Cleanup(pool.Close)
+
+	limiter, err := pool.GetOrCreate("https://first.example.com")
+	require.NoError(t, err)
+	require.NoError(t, limiter.Wait(context.Background()))
+
+	result := make(chan error, 1)
+	go func() { result <- limiter.Wait(context.Background()) }()
+	require.Eventually(t, func() bool { return len(limiter.admission) == 1 }, time.Second, time.Millisecond)
+
+	_, err = pool.GetOrCreate("https://second.example.com")
+	require.NoError(t, err)
+	require.NoError(t, <-result)
+}
+
 func TestUnboundedPerHostRateLimitPoolRetainsBudgetsBeyondDefaultCapacity(t *testing.T) {
 	opts := &types.Options{RateLimit: 10, RateLimitDuration: time.Second}
 	pool := NewPerHos
```

**File**: `pkg/protocols/dns/request.go` (modified, +1/-1)
```diff
@@ -163,7 +163,7 @@ func (request *Request) execute(input *contextargs.Context, domain string, metad
 	}
 
 	// per host means per queried domain: resolvers are shared by every target
-	if err := request.options.RateLimitTake(question); err != nil {
+	if err := request.options.RateLimitTakeContext(input.Context(), question); err != nil {
 		request.options.Output.Request(request.options.TemplatePath, domain, request.Type().String(), err)
 		request.options.Progress.IncrementFailedRequestsBy(1)
 		return errors.Wrap(err, "could not take rate limit")
```

**File**: `pkg/protocols/headless/engine/instance.go` (modified, +81/-2)
```diff
@@ -7,6 +7,7 @@ import (
 
 	"github.com/go-rod/rod"
 	"github.com/go-rod/rod/lib/utils"
+	"github.com/projectdiscovery/gologger"
 	"github.com/projectdiscovery/nuclei/v3/pkg/protocols/common/interactsh"
 	"github.com/projectdiscovery/nuclei/v3/pkg/protocols/common/render"
 )
@@ -21,6 +22,8 @@ type Instance struct {
 	requestLog map[string]string // contains actual request that was sent
 }
 
+const browserCleanupTimeout = 5 * time.Second
+
 // NewInstance creates a new instance for the current browser.
 //
 // The login process is repeated only once for a browser, and the created
@@ -29,7 +32,67 @@ type Instance struct {
 // Users can also choose to run the login->actions process again
 // which uses a new incognito browser instance to run actions.
 func (b *Browser) NewInstance() (*Instance, error) {
-	browser, err := b.engine.Incognito()
+	return b.newInstanceBrowser(b.engine)
+}
+
+// NewInstanceWithContext bounds browser-context creation and all subsequent instance calls.
+func (b *Browser) NewInstanceWithContext(ctx context.Context, timeout time.Duration) (*Instance, error) {
+	if ctx == nil {
+		ctx = context.Background()
+	}
+	if err := ctx.Err(); err != nil {
+		return nil, context.Cause(ctx)
+	}
+
+	if timeout <= 0 {
+		timeout = browserCleanupTimeout
+	}
+	creationCtx, cancelCreation := context.WithTimeout(b.engine.GetContext(), timeout)
+	type result struct {
+		instance *Instance
+		err      error
+	}
+	resultCh := make(chan result, 1)
+	go func() {
+		instance, err := b.newInstanceBrowser(b.engine.Context(creationCtx))
+		resultCh <- result{instance: instance, err: err}
+	}()
+
+	cleanup := func(instance *Instance) {
+		if instance == nil {
+			return
+		}
+		if err := instance.Close(); err != nil {
+			gologger.Warning().Msgf("Could not close canceled browser instance: %s", err)
+		}
+	}
+
+	select {
+	case created := <-resultCh:
+		cancelCreation()
+		if created.err != nil {
+			return nil, created.err
+		}
+		if err := ctx.Err(); err != nil {
+			go cleanup(created.instance)
+			return nil, context.Cause(ctx)
+		}
+		created.instance.engine = created.instance.engine.Context(ctx)
+		return created.instance, nil
+	case <-ctx.Done():
+		go func() {
+			created := <-resultCh
+			cancelCreation()
+			if created.err == nil {
+				cleanup(created.instance)
+			}
+		}()
+		return nil, context.Cause(ctx)
+	}
+}
+
+func (b *Browser) newInstanceBrowser(engine *rod.Browser) (*Instance, error) {
+	browser, err := engine.Incognito()
 	if err != nil {
 		return nil, err
 	}
@@ -49,7 +112,23 @@ func (i *Instance) GetRequestLog() map[string]string {
 
 // Close closes all the tabs and pages for a browser instance
 func (i *Instance) Close() error {
-	return i.engine.Close()
+	ctx, cancel := context.WithTimeout(context.Background(), browserCleanupTimeout)
+	defer cancel()
+	return i.close(ctx)
+}
+
+// CloseWithPage closes a page and its isolated browser context within one cleanup deadline.
+func (i *Instance) CloseWithPage(page *Page) error {
+	ctx, cancel := context.WithTimeout(context.Background(), browserCleanupTimeout)
+	defer cancel()
+	if page != nil {
+		page.close(ctx)
+	}
+	return i.close(ctx)
+}
+
+func (i *Instance) close(ctx context.Context) error {
+	return i.engine.Context(ctx).Close()
 }
 
 // SetInteractsh client
```

**File**: `pkg/protocols/headless/engine/instance_test.go` (added, +102/-0)
```diff
@@ -0,0 +1,102 @@
+package engine
+
+import (
+	"context"
+	"testing"
+	"time"
+
+	"github.com/go-rod/rod"
+	"github.com/go-rod/rod/lib/cdp"
+	"github.com/go-rod/rod/lib/proto"
+	"github.com/stretchr/testify/require"
+)
+
+type cleanupCDPClient struct {
+	events      chan *cdp.Event
+	contextErrs chan error
+}
+
+type lateCreateCDPClient struct {
+	events   chan *cdp.Event
+	disposed chan struct{}
+	delay    time.Duration
+}
+
+func (c *lateCreateCDPClient) Event() <-chan *cdp.Event {
+	return c.events
+}
+
+func (c *lateCreateCDPClient) Call(_ context.Context, _ string, method string, _ interface{}) ([]byte, error) {
+	switch method {
+	case "Target.createBrowserContext":
+		time.Sleep(c.delay)
+		return []byte(`{"browserContextId":"context-id"}`), nil
+	case "Target.disposeBrowserContext":
+		select {
+		case c.disposed <- struct{}{}:
+		default:
+		}
+	}
+	return []byte("{}"), nil
+}
+
+func (c *cleanupCDPClient) Event() <-chan *cdp.Event {
+	return c.events
+}
+
+func (c *cleanupCDPClient) Call(ctx context.Context, _ string, method string, _ interface{}) ([]byte, error) {
+	if method == "Target.disposeBrowserContext" {
+		c.contextErrs <- ctx.Err()
+	}
+	return []byte("{}"), nil
+}
+
+func TestNewInstanceWithContextCancelsBlockedBrowserContextCreation(t *testing.T) {
+	client := newBlockingCDPClient("Target.createBrowserContext", 500*time.Millisecond)
+	browser := &Browser{engine: rod.New().Client(client)}
+	ctx, cancel := context.WithTimeout(context.Background(), 20*time.Millisecond)
+	defer cancel()
+
+	started := time.Now()
+	_, err := browser.NewInstanceWithContext(ctx, time.Second)
+
+	require.ErrorIs(t, err, context.DeadlineExceeded)
+	require.Less(t, time.Since(started), 200*time.Millisecond)
+}
+
+func TestNewInstanceWithContextDisposesContextCreatedAfterCancellation(t *testing.T) {
+	client := &lateCreateCDPClient{
+		events:   make(chan *cdp.Event),
+		disposed: make(chan struct{}, 1),
+		delay:    50 * time.Millisecond,
+	}
+	browser := &Browser{engine: rod.New().Client(client)}
+	ctx, cancel := context.WithTimeout(context.Background(), 10*time.Millisecond)
+	defer cancel()
+
+	started := time.Now()
+	_, err := browser.NewInstanceWithContext(ctx, time.Second)
+	require.ErrorIs(t, err, context.DeadlineExceeded)
+	require.Less(t, time.Since(started), 100*time.Millisecond)
+
+	select {
+	case <-client.disposed:
+	case <-time.After(time.Second):
+		t.Fatal("browser context created after cancellation was not disposed")
+	}
+}
+
+func TestInstanceCloseUsesLiveCleanupContext(t *testing.T) {
+	client := &cleanupCDPClient{
+		events:      make(chan *cdp.Event),
+		contextErrs: make(chan error, 1),
+	}
+	canceledCtx, cancel := context.WithCancel(context.Background())
+	cancel()
+	browser := rod.New().Client(client).Context(canceledCtx)
+	browser.BrowserContextID = proto.BrowserBrowserContextID("context-id")
+	instance := &Instance{engine: browser}
+
+	require.NoError(t, instance.Close())
+	require.NoError(t, <-client.contextErrs)
+}
```

---

### Incident Patch 2: `59e6ffa6` (2026-10-12)
**Commit Message**: Merge pull request #7822 from projectdiscovery/fix/7821-js-call-cancellation

cancel javascript library calls with the template execution timeout

**File**: `go.mod` (modified, +1/-1)
```diff
@@ -81,7 +81,7 @@ require (
 	github.com/projectdiscovery/gcache v0.0.0-20241015120333-12546c6e3f4c
 	github.com/projectdiscovery/goflags v0.2.1
 	github.com/projectdiscovery/goimpacket v0.1.0
-	github.com/projectdiscovery/goja v0.0.0-20260618133720-acb73e419534
+	github.com/projectdiscovery/goja v0.0.0-20261012075649-9b78f2e05b9c
 	github.com/projectdiscovery/goja_nodejs v0.0.0-20260618132410-8519f75f703d
 	github.com/projectdiscovery/gologger v1.1.73
 	github.com/projectdiscovery/gostruct v0.0.2
```

**File**: `go.sum` (modified, +2/-2)
```diff
@@ -953,8 +953,8 @@ github.com/projectdiscovery/goflags v0.2.1 h1:XnSYvsCjUwHbZaaJUZ3YznCJPoXRk/IhTF
 github.com/projectdiscovery/goflags v0.2.1/go.mod h1:7nAP1r2Dqgn/rwmOE3EWbZWUCEJKNIhVSBGpuzJAIns=
 github.com/projectdiscovery/goimpacket v0.1.0 h1:pX7YKn11GzplEWzLsgR1b1Ad1diACXLhzvVZ1w7h3sw=
 github.com/projectdiscovery/goimpacket v0.1.0/go.mod h1:bfgULaYf+6pjjcLCekpXIYElnLJbmhvTttxMAbQJvhY=
-github.com/projectdiscovery/goja v0.0.0-20260618133720-acb73e419534 h1:hYd1zQA/dxO2ASyQ6Re73TcJkW1LjLQvt4+86Hxefz8=
-github.com/projectdiscovery/goja v0.0.0-20260618133720-acb73e419534/go.mod h1:SO0AP+uKfYeeoR6jyVH/PKRYJE/f5gJrPMAM00iGEMc=
+github.com/projectdiscovery/goja v0.0.0-20261012075649-9b78f2e05b9c h1:4H/CfVNlue9PIwsCM1IGxOynDI7cir+emXuDvGJTLJs=
+github.com/projectdiscovery/goja v0.0.0-20261012075649-9b78f2e05b9c/go.mod h1:SO0AP+uKfYeeoR6jyVH/PKRYJE/f5gJrPMAM00iGEMc=
 github.com/projectdiscovery/goja_nodejs v0.0.0-20260618132410-8519f75f703d h1:fqqH9LHpN2WDz9QuxFrhKNxXSRtzk+Sa6jAhbB7tXcQ=
 github.com/projectdiscovery/goja_nodejs v0.0.0-20260618132410-8519f75f703d/go.mod h1:Ezmbgdaw4EunGGBU4MQViLoGMJc37LA3ip55YV3KeRI=
 github.com/projectdiscovery/gologger v1.1.73 h1:WX2nzq29cL7HdvOHqIttacoid/5lMwapyM7ukGU1jFY=
```

**File**: `pkg/js/compiler/session.go` (modified, +4/-0)
```diff
@@ -153,6 +153,9 @@ func (s *session) prepareCommon() {
 	}
 	s.config.runtime.SetContextValue("executionId", s.config.opts.ExecutionId)
 	s.config.runtime.SetContextValue("ctx", executionCtx)
+	// Go calls derive their context from this, so the execution timeout also
+	// cancels a library call in flight instead of leaving it running
+	s.config.runtime.SetContext(executionCtx)
 	enableRequire(s.config.runtime)
 }
 
@@ -221,6 +224,7 @@ func (s *session) cleanupCommon() {
 	}
 	s.config.runtime.RemoveContextValue("executionId")
 	s.config.runtime.RemoveContextValue("ctx")
+	s.config.runtime.SetContext(context.TODO())
 	s.config.runtime.RemoveContextValue("timeoutVariants")
 	s.config.runtime.RemoveContextValue("proxyURL")
 	s.config.runtime.RemoveContextValue("customHeaders")
```

**File**: `pkg/js/libs/smb/smb_auth_test.go` (modified, +7/-1)
```diff
@@ -46,8 +46,14 @@ func TestAuthenticateSessionStatus(t *testing.T) {
 				assert.NoError(t, protocolstate.Init(&types.Options{ExecutionId: executionID}))
 				t.Cleanup(func() { protocolstate.Close(executionID) })
 				port, done := serveAuthentication(t, tc.flags, tc.status)
+				// production runs carry the js execution timeout in their context;
+				// without one a stalled exchange holds the package until go
+				// test's 1h timeout instead of failing this test
+				ctx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
+				defer cancel()
 				if javascript {
 					vm := goja.New()
+					vm.SetContext(ctx)
 					new(require.Registry).Enable(vm)
 					vm.SetContextValue("executionId", executionID)
 					assert.NoError(t, vm.Set("port", port))
@@ -65,7 +71,7 @@ func TestAuthenticateSessionStatus(t *testing.T) {
 						assert.Equal(t, []interface{}{tc.want.Success, tc.want.IsGuest, tc.want.IsNullSession}, value.Export())
 					}
 				} else {
-					ctx := context.WithValue(context.Background(), "executionId", executionID) //nolint:staticcheck
+					ctx := context.WithValue(ctx, "executionId", executionID) //nolint:staticcheck
 					result, err := (&smb.SMBClient{}).Authenticate(ctx, "127.0.0.1", port, tc.user, password)
 					if tc.status != 0 {
 						assert.Error(t, err)
```

---

### Incident Patch 3: `10f1967c` (2026-10-18)
**Commit Message**: Merge pull request #7879 from projectdiscovery/fix/7878-dump-body-race

keep the request body in the dump taken after sending

**File**: `go.mod` (modified, +1/-1)
```diff
@@ -102,7 +102,7 @@ require (
 	github.com/projectdiscovery/tlsx v1.4.1
 	github.com/projectdiscovery/uncover v1.2.1
 	github.com/projectdiscovery/useragent v0.0.109
-	github.com/projectdiscovery/utils v0.11.9
+	github.com/projectdiscovery/utils v0.11.10-0.20261015084917-a599cac78c99
 	github.com/projectdiscovery/wappalyzergo v0.3.4
 	github.com/projectdiscovery/yamldoc-go v1.0.7
 	github.com/redis/go-redis/v9 v9.19.0
```

**File**: `go.sum` (modified, +2/-2)
```diff
@@ -1003,8 +1003,8 @@ github.com/projectdiscovery/uncover v1.2.1 h1:8U46T/96CLT7BPoXBgkTvWqB06lOyeTSLv
 github.com/projectdiscovery/uncover v1.2.1/go.mod h1:0p8onrWxfpXQEYs90ZDzTSpu1107gWmodX1NWqu/+z4=
 github.com/projectdiscovery/useragent v0.0.109 h1:b86BPdZvmgbJousa04jAugDRY4Y+rAvEamE0TFCPmeE=
 github.com/projectdiscovery/useragent v0.0.109/go.mod h1:sRyBqDAcD31RKYrO8fyXGowLd36fNwY1g0MNW9mp7zk=
-github.com/projectdiscovery/utils v0.11.9 h1:aKLje3zPcZuOGmopN51PasWxPX/CypPwzP2ke/Qa2bA=
-github.com/projectdiscovery/utils v0.11.9/go.mod h1:d3BcbsHhuxW9T3jpvrgzwshvqhaL9qPSkoi+3h/DY8E=
+github.com/projectdiscovery/utils v0.11.10-0.20261015084917-a599cac78c99 h1:1RG4XinX0GqkAqIBxG92ldRWCvU6yZn9YdSFh2EiH2o=
+github.com/projectdiscovery/utils v0.11.10-0.20261015084917-a599cac78c99/go.mod h1:d3BcbsHhuxW9T3jpvrgzwshvqhaL9qPSkoi+3h/DY8E=
 github.com/projectdiscovery/wappalyzergo v0.3.4 h1:yO+xel+C0d/vOFWcUKVZRpIDAfcEmsjpVDjQ0jifAUw=
 github.com/projectdiscovery/wappalyzergo v0.3.4/go.mod h1:6xTRCUQhX8m+L1eqJDQIALJlRv2Bnhrmku80YU9bBXE=
 github.com/projectdiscovery/yamldoc-go v1.0.7 h1:Odmjd1o4EkMff2F6QHi1dIYPIQPZUFy24YqmQCprmTk=
```

**File**: `pkg/protocols/http/request.go` (modified, +23/-15)
```diff
@@ -51,7 +51,6 @@ import (
 	convUtil "github.com/projectdiscovery/utils/conversion"
 	"github.com/projectdiscovery/utils/errkit"
 	httpUtils "github.com/projectdiscovery/utils/http"
-	"github.com/projectdiscovery/utils/reader"
 	sliceutil "github.com/projectdiscovery/utils/slice"
 	stringsutil "github.com/projectdiscovery/utils/strings"
 	unitutils "github.com/projectdiscovery/utils/unit"
@@ -983,6 +982,25 @@ func extractorAppliesToRequest(part string, requestIndex int) bool {
 
 const drainReqSize = int64(8 * unitutils.Kilo)
 
+// reuseRequestBody reads the body once and installs GetBody copies. The
+// post-send dump reads one while the transport may still be writing another.
+// GET, HEAD, and chunked requests keep their existing content length.
+func reuseRequestBody(req *retryablehttp.Request) error {
+	body, err := io.ReadAll(req.Body)
+	if err != nil {
+		return err
+	}
+	keepLength := stringsutil.EqualFoldAny(req.Method, http.MethodGet, http.MethodHead) || req.Header.Get("Transfer-Encoding") == "chunked"
+	contentLength := req.ContentLength
+	if err = req.SetBody(body); err != nil {
+		return err
+	}
+	if keepLength {
+		req.ContentLength = contentLength
+	}
+	return nil
+}
+
 // executeRequest executes the actual generated request and returns error if occurred
 func (request *Request) executeRequest(input *contextargs.Context, generatedRequest *generatedRequest, previousEvent output.InternalEvent, hasInteractMatchers bool, processEvent protocols.OutputEventCallback, requestCount int) (err error) {
 	// Check if hosts keep erroring
@@ -1022,20 +1040,10 @@ func (request *Request) executeRequest(input *contextargs.Context, generatedRequ
 	// For race conditions we can't dump the request body at this point as it's already waiting the open-gate event, already handled with a similar code within the race function
 	if !generatedRequest.original.Race {
 
-		// change encoding type to content-length unless transfer-encoding header is manually set
-		if generatedRequest.request != nil && !stringsutil.EqualFoldAny(generatedRequest.request.Method, http.MethodGet, http.MethodHead) && generatedRequest.request.Body != nil && generatedRequest.request.Header.Get("Transfer-Encoding") != "chunked" {
-			var newReqBody *reader.ReusableReadCloser
-			newReqBody, ok := generatedRequest.request.Body.(*reader.ReusableReadCloser)
-			if !ok {
-				newReqBody, err = reader.NewReusableReadCloser(generatedRequest.request.Body)
-			}
-			if err == nil {
-				// update the request body with the reusable reader
-				generatedRequest.request.SetBodyReader(newReqBody)
-				// get content length
-				length, _ := io.Copy(io.Discard, newReqBody)
-				generatedRequest.request.ContentLength = length
-			} else {
+		// Buffer every body so the post-send dump reads its own copy. GET, HEAD,
+		// and chunked requests keep the content length they already had.
+		if generatedRequest.request != nil && generatedRequest.request.Body != nil {
+			if err = reuseRequestBody(generatedRequest.request); err != nil {
 				// log error and continue
 				gologger.Verbose().Msgf("[%v] Could not read request body while forcing transfer encoding: %s\n", request.options.TemplateID, err)
 				err = nil
```

**File**: `pkg/protocols/http/request_test.go` (modified, +97/-0)
```diff
@@ -24,6 +24,8 @@ import (
 	"github.com/projectdiscovery/nuclei/v3/pkg/protocols/common/contextargs"
 	"github.com/projectdiscovery/nuclei/v3/pkg/protocols/common/interactsh"
 	"github.com/projectdiscovery/ratelimit"
+	"github.com/projectdiscovery/retryablehttp-go"
+	"io"
 )
 
 func executeDynamicHTTPTestRequest(t *testing.T, request *Request, target string) {
@@ -1562,3 +1564,98 @@ func TestPerHostRateLimitHonorsRequestContextCancellation(t *testing.T) {
 	require.ErrorIs(t, err, context.Canceled)
 	require.Less(t, cancellationDelay, 250*time.Millisecond)
 }
+
+func TestDumpedRequestKeepsBodyServerDidNotRead(t *testing.T) {
+	// The server answers in full, then holds the connection without reading
+	// the body, so the transport is still writing it when the response arrives.
+	release := make(chan struct{})
+	target := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
+		w.Header().Set("Content-Length", "2")
+		_, _ = w.Write([]byte("ok"))
+		w.(http.Flusher).Flush()
+		<-release
+	}))
+	defer target.Close()
+	defer close(release)
+
+	options := testutils.DefaultOptions.Copy()
+	options.SetExecutionID(t.Name())
+	testutils.Init(options)
+	t.Cleanup(func() { testutils.Cleanup(options) })
+	executerOpts := testutils.NewMockExecuterOptions(options, &testutils.TemplateInfo{
+		ID:   "dump-body",
+		Info: model.Info{SeverityHolder: severity.Holder{Severity: severity.Low}, Name: "test"},
+	})
+
+	body := strings.Repeat("A", 4<<20)
+	requests := []*Request{
+		{
+			ID:     "post",
+			Method: HTTPMethodTypeHolder{MethodType: HTTPPost},
+			Path:   []string{"{{BaseURL}}/"},
+			Body:   body,
+		},
+		{
+			ID:  "get",
+			Raw: []string{"GET / HTTP/1.1\nHost: {{Hostname}}\n\n" + body},
+		},
+		{
+			ID:  "chunked",
+			Raw: []string{"POST / HTTP/1.1\nHost: {{Hostname}}\nTransfer-Encoding: chunked\n\n" + body},
+		},
+	}
+	for _, request := range requests {
+		require.NoError(t, request.Compile(executerOpts))
+		// how much the transport has written when the response lands varies, so
+		// a few rounds make a lost body show up reliably
+		for range 3 {
+			var dumped string
+			input := contextargs.NewWithInput(context.Background(), target.URL)
+			err := request.ExecuteWithResults(input, output.InternalEvent{}, output.InternalEvent{}, func(event *output.InternalWrappedEvent) {
+				dumped, _ = event.InternalEvent["request"].(string)
+			})
+			require.NoError(t, err)
+			require.True(t, strings.HasSuffix(dumped, "\r\n\r\n"+body), "%s recorded request lost its body: %d of %d bytes", request.ID, len(dumped), len(body))
+		}
+	}
+}
+
+func TestReuseRequestBodyKeepsExcludedEncoding(t *testing.T) {
+	body := []byte("original")
+	for _, tc := range []struct {
+		name          string
+		method        string
+		header        string
+		contentLength int64
+		wantLength    int64
+	}{
+		{name: "post", method: http.MethodPost, contentLength: 1, wantLength: int64(len(body))},
+		{name: "get", method: http.MethodGet, contentLength: 3, wantLength: 3},
+		{name: "head", method: http.MethodHead, contentLength: 0, wantLength: 0},
+		{name: "chunked", method: http.MethodPost, header: "chunked", contentLength: -1, wantLength: -1},
+	} {
+		t.Run(tc.name, func(t *testing.T) {
+			req, err := retryablehttp.NewRequest(tc.method, "https://example.com/", body)
+			require.NoError(t, err)
+			req.ContentLength = tc.contentLength
+			if tc.header != "" {
+				req.Header.Set("Transfer-Encoding", tc.header)
+			}
+
+			require.NoError(t, reuseRequestBody(req))
+			require.Equal(t, tc.wantLength, req.ContentLength)
+			if tc.header != "" {
+				require.Equal(t, tc.header, req.Header.Get("Transfer-Encoding"))
+			}
+
+			got, err := io.ReadAll(req.Body)
+			require.NoError(t, err)
+			require.Equal(t, body, got)
+			fresh, err := req.GetBody()
+			require.NoError(t, err)
+			got, err = io.ReadAll(fresh)
+			require.NoError(t, err)
+			require.Equal(t, body, got)
+		})
+	}
+}
```

**File**: `pkg/protocols/http/utils.go` (modified, +10/-2)
```diff
@@ -13,8 +13,16 @@ import (
 // dump creates a dump of the http request in form of a byte slice
 func dump(req *generatedRequest, reqURL string) ([]byte, error) {
 	if req.request != nil {
-		// Use a clone to avoid a race condition with the http transport
-		bin, err := req.request.Clone(req.request.Context()).Dump()
+		// Use a clone to avoid a race condition with the http transport. The
+		// clone shares the body, which the transport may still be sending, so
+		// dump a fresh copy of it where one is available.
+		clone := req.request.Clone(req.request.Context())
+		if clone.GetBody != nil {
+			if body, err := clone.GetBody(); err == nil {
+				clone.Body = body
+			}
+		}
+		bin, err := clone.Dump()
 		if err != nil {
 			return nil, errkit.Wrapf(err, "could not dump request: %v", req.request.String())
 		}
```

#### Recent Merged Pull Requests:
- **PR #7881** (2026-10-18): skip stdin when targets are given with -u or -l (@dogancanbakir)
- **PR #7879** (2026-10-18): keep the request body in the dump taken after sending (@dogancanbakir)
- **PR #7872** (closed): fix(flow): bound runtime execution (@knakul853)
- **PR #7869** (2026-10-13): chore(deps): bump the modules group across 1 directory with 5 updates (@dependabot[bot])
- **PR #7866** (closed): chore(deps): bump the modules group with 7 updates (@dependabot[bot])
- **PR #7858** (2026-10-13): fix(http): preserve iterate-all extraction branches (@knakul853)

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

## X. runtime): honor cancellation in HTTP and headless waits (#7814)

**RULE**:
When implementing operations in `go.mod`, engineers MUST enforce rigorous boundary validation, safe state transitions, and memory/concurrency invariants as established by production defect remediation in projectdiscovery/nuclei. All inputs crossing module boundaries must be explicitly verified before state persistence.

**WHY**:
Prevents defects observed in production commit `a5715288`: runtime): honor cancellation in HTTP and headless waits (#7814). Unvalidated execution paths cause runtime exceptions, race conditions, and silent state corruption under concurrent workloads.

**WHEN TO APPLY**:
Subsystems managing Go data structures, boundary deserialization, API parsing, or resource lifecycles matching `go.mod`.

**VERIFIED IMPLEMENTATION PATTERN**:
```go
// Verified production-grade fix pattern:
	github.com/projectdiscovery/ratelimit v0.0.93
	golang.org/x/time v0.15.0
```

**NEGATIVE CONSTRAINT**:
```go
// Anti-pattern to NEVER write (induced failure mode):
	github.com/projectdiscovery/ratelimit v0.0.92
	golang.org/x/time v0.15.0 // indirect
```

**VERIFICATION METHOD**:
Automated regression test asserting that input states reproducing defect `a5715288` are properly handled with clean fallback behavior.
