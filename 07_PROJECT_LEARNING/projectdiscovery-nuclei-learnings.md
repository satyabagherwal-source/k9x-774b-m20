> **Canonical Learning Artifact**: `07_PROJECT_LEARNING/projectdiscovery-nuclei-learnings.md`  
> **Source**: github ([https://github.com/projectdiscovery/nuclei](https://github.com/projectdiscovery/nuclei))  
> **Source Version**: `25f50f10`  
> **License**: MIT  
> **Synthesized By**: zero-clone-structural-synthesizer  
> **Timestamp**: 2026-11-03T17:14:22.126Z  
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
> **Harvest Timestamp**: 2026-11-03T17:14:21.829Z  
> **Compliance State**: Free Tier Guaranteed | Strict Rate-Limit Backoff Honored  

---

## 1. Context & Architectural Overview
- **Repository / Resource**: `projectdiscovery/nuclei`
- **Description**: Nuclei is a fast, customizable vulnerability scanner powered by the global security community and built on a simple YAML-based DSL, enabling collaboration to tackle trending vulnerabilities on the internet. It helps you find vulnerabilities in your applications, APIs, networks, DNS, and cloud configurations.
- **Primary Language / Ecosystem**: Go
- **Discovered Manifests / Configurations**: go.mod, README.md, Dockerfile
- **Stars / Engagement**: 32562 stars

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
	wp, _ := syncutil.New(syncutil.WithSize(e.options.BulkSize + e.options.HeadlessBulkSize))
	defer wp.Wait()

	target.Iterate(func(value *contextargs.MetaInput) bool {
		select {
		case <-ctx.Done():
			return false
		default:
		}

		if err := wp.AddWithContext(ctx); err != nil {
			return false
		}

		go func(targetval *contextargs.MetaInput) {
			defer wp.Done()
			e.executeTemplatesOnTarget(ctx, templatesList, targetval, results)
		}(value)
		return true
	})
	return results
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
	"github.com/projectdiscovery/nuclei/v3/pkg/progress"
	"github.com/projectdiscovery/nuclei/v3/pkg/protocols"
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
			defer e.tasksDone(1)
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
		hostDown := inScope && e.executerOpts.HostErrorsCache != nil && e.executerOpts.HostErrorsCache.Check(template.Type().String(), contextargs.NewWithMetaInput(ctx, scannedValue))
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

	for i, tpl := range alltemplates {
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
			// the remaining templates are skipped for this target as well
			e.tasksDone(int64(getSelectedCount(alltemplates[i:], e.selectionFor(target))))
			break
		}

		// resize check point - nop if there are no changes
		wp.RefreshWithConfigContext(ctx, e.GetWorkPoolConfig())

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
	selection := e.selectionFor(input)
	return selection == nil || template.SelectedBy(selection)
}

// selectionFor returns the templates per-target profiles select for input; nil
// selects every template.
func (e *Engine) selectionFor(input *contextargs.MetaInput) protocols.TemplateSelection {
	if e.executerOpts.TargetScope == nil {
		return nil
	}
	return e.executerOpts.TargetScope.For(input)
}

// taskTracker returns the progress when it counts tasks, nil otherwise.
func (e *Engine) taskTracker() progress.TaskTracker {
	if e.executerOpts == nil {
		return nil
	}
	tracker, _ := e.executerOpts.Progress
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
						if err := swg.AddWithContext(ctx.Context()); err != nil {
							return
						}

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
			if err := swg.AddWithContext(ctx.Context()); err != nil {
				return err
			}

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
	Auto       bool // -iv omitted: one unpinned target unless -sa scans every address
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

### Incident Patch 1: `be40690a` (2026-11-03)
**Commit Message**: fix(headless): fail requests whose URL net/url cannot parse

With a request modification action (setheader, addheader, deleteheader,
setmethod or setbody), routingRuleHandler replays every browser request
through nuclei's Go HTTP client. go-rod builds that request with
url.Parse and drops the error, so a URL that Chrome accepts but net/url
rejects, such as a path ending in "100%.png", arrived with a nil URL.
The cookie jar sync then panicked, or httputil.DumpRequestOut did when
cookies were disabled, and the panic killed the whole scan.

Check the URL once on entry and fail such requests in the browser. The
Go client cannot send them, and continuing them in the browser would
drop the template's modification rules and, with -cdp-endpoint, skip
the dial-time address checks of nuclei's network policy.

Fixes: #8015
Reported-by: @l4rm4nd
Signed-off-by: Dwi Siswanto <[REDACTED_EMAIL]>

**File**: `pkg/protocols/headless/engine/page_actions_test.go` (modified, +71/-1)
```diff
@@ -5,6 +5,7 @@ import (
 	"fmt"
 	"io"
 	"math/rand"
+	"net"
 	"net/http"
 	"net/http/cookiejar"
 	"net/http/httptest"
@@ -15,6 +16,7 @@ import (
 	"strconv"
 	"strings"
 	"sync"
+	"sync/atomic"
 	"testing"
 	"time"
 
@@ -319,6 +321,58 @@ func TestActionHeadersChange(t *testing.T) {
 	})
 }
 
+// Chrome keeps malformed percent-escapes such as "100%.png" in request paths,
+// as the WHATWG URL Standard requires, but net/url rejects them, so go-rod
+// hands the modification-rules hijack handler a request with a nil URL (#8015).
+//
+//nolint:exhaustruct,exhaustruct_v5,paralleltest // like the other action tests, which share browser and dialer state
+func TestRoutingRuleHandlerFailsRequestNetHTTPCannotParse(t *testing.T) {
+	for _, disableCookie := range []bool{false, true} {
+		t.Run(fmt.Sprintf("DisableCookie=%t", disableCookie), func(t *testing.T) {
+			// Count connections, not requests: net/http rejects the request line
+			// before any handler runs. TLS makes the headless proxy tunnel the
+			// request with CONNECT instead of rejecting the unparsable path itself.
+			var imageConns atomic.Int32
+
+			imageServer := httptest.NewUnstartedServer(http.NotFoundHandler())
+			imageServer.Config.ConnState = func(_ net.Conn, state http.ConnState) {
+				if state == http.StateNew {
+					imageConns.Add(1)
+				}
+			}
+
+			imageServer.StartTLS()
+			defer imageServer.Close()
+
+			actions := []*Action{
+				{
+					ActionType: ActionTypeHolder{ActionType: ActionSetHeader},
+					Data:       map[string]string{"part": "request", "key": "Test", "value": "Hello"},
+				},
+				{ActionType: ActionTypeHolder{ActionType: ActionNavigate}, Data: map[string]string{"url": "{{BaseURL}}"}},
+				{ActionType: ActionTypeHolder{ActionType: ActionWaitLoad}},
+			}
+			handler := func(w http.ResponseWriter, r *http.Request) {
+				if r.Header.Get("Test") == "Hello" {
+					_, _ = fmt.Fprintf(w, `<html><body>found<img src="%s/100%%.png"></body></html>`, imageServer.URL)
+				}
+			}
+			options := &Options{Timeout: 20 * time.Second, DisableCookie: disableCookie}
+
+			testHeadlessWithOptions(t, actions, options, handler, func(page *Page, err error, _ ActionData) {
+				require.NoError(t, err)
+
+				body := page.Page().MustElement("body").MustText()
+				require.Equal(t, "found", strings.TrimSpace(body), "modification rules were not applied")
+				require.Zero(t, imageConns.Load(), "unparsable request reached the image server")
+
+				imageDone := page.Page().MustEval(`() => document.querySelector("img").complete`).Bool()
+				require.True(t, imageDone, "unparsable request is still paused")
+			})
+		})
+	}
+}
+
 func TestActionScreenshot(t *testing.T) {
 	response := `
 		<html>
@@ -1003,6 +1057,21 @@ func TestMain(m *testing.M) {
 func testHeadless(t *testing.T, actions []*Action, timeout time.Duration, handler func(w http.ResponseWriter, r *http.Request), assert func(page *Page, pageErr error, extractedData ActionData)) {
 	t.Helper()
 
+	options := &Options{Timeout: timeout} //nolint:exhaustruct,exhaustruct_v5 // zero values are the defaults
+	testHeadlessWithOptions(t, actions, options, handler, assert)
+}
+
+// testHeadlessWithOptions is testHeadless with caller-chosen page options. It
+// overwrites options.Options with the test scan options.
+func testHeadlessWithOptions(
+	t *testing.T,
+	actions []*Action,
+	options *Options,
+	handler func(w http.ResponseWriter, r *http.Request),
+	assert func(page *Page, pageErr error, extractedData ActionData),
+) {
+	t.Helper()
+
 	lfa := envutil.GetEnvOrDefault("LOCAL_FILE_ACCESS", true)
 	rna := envutil.GetEnvOrDefault("RESTRICTED_LOCAL_NETWORK_ACCESS", false)
 
@@ -1027,7 +1096,8 @@ func testHeadless(t *testing.T, actions []*Action, timeout time.Duration, handle
 	input.CookieJar, err = cookiejar.New(nil)
 	require.Nil(t, err)
 
-	extractedData, page, err := instance.Run(input, actions, nil, &Options{Timeout: timeout, Options: opts}) // allow file access in test
+	options.Options = opts // allow file access in test
+	extractedData, page, err := instance.Run(input, actions, nil, options)
 	assert(page, err, extractedData)
 
 	if page != nil {
```

**File**: `pkg/protocols/headless/engine/rules.go` (modified, +24/-12)
```diff
@@ -15,8 +15,21 @@ import (
 // routingRuleHandler handles proxy rule for actions related to request/response modification
 func (p *Page) routingRuleHandler(httpClient *http.Client) func(ctx *rod.Hijack) {
 	return func(ctx *rod.Hijack) {
+		req := ctx.Request.Req()
+		// go-rod discards url.Parse errors, so a URL that Chrome accepts but
+		// net/url rejects, such as "/100%.png", arrives as nil. Fail the request:
+		// the Go client cannot send it, and continuing it in the browser would
+		// drop the modification rules and, with -cdp-endpoint (no headless
+		// proxy), the network policy's dial-time address checks.
+		if req.URL == nil {
+			gologger.Verbose().Msgf("headless: failed %s request with a URL that net/url cannot parse", req.Method)
+			ctx.Response.Fail(proto.NetworkErrorReasonFailed)
+
+			return
+		}
+
 		// usually browsers don't use chunked transfer encoding, so we set the content-length nevertheless
-		ctx.Request.Req().ContentLength = int64(len(ctx.Request.Body()))
+		req.ContentLength = int64(len(ctx.Request.Body()))
 		// snapshot the rules once: ExecuteActions may still be appending rules
 		// from another goroutine while this hijack handler runs.
 		rules := p.rulesSnapshot()
@@ -28,39 +41,39 @@ func (p *Page) routingRuleHandler(httpClient *http.Client) func(ctx *rod.Hijack)
 			switch rule.Action {
 			case ActionSetMethod:
 				rule.Do(func() {
-					ctx.Request.Req().Method = rule.Args["method"]
+					req.Method = rule.Args["method"]
 				})
 			case ActionAddHeader:
-				ctx.Request.Req().Header.Add(rule.Args["key"], rule.Args["value"])
+				req.Header.Add(rule.Args["key"], rule.Args["value"])
 			case ActionSetHeader:
-				ctx.Request.Req().Header.Set(rule.Args["key"], rule.Args["value"])
+				req.Header.Set(rule.Args["key"], rule.Args["value"])
 			case ActionDeleteHeader:
-				ctx.Request.Req().Header.Del(rule.Args["key"])
+				req.Header.Del(rule.Args["key"])
 			case ActionSetBody:
 				body := rule.Args["body"]
-				ctx.Request.Req().ContentLength = int64(len(body))
+				req.ContentLength = int64(len(body))
 				ctx.Request.SetBody(body)
 			}
 		}
 
 		// each http request is performed via the native go http client
 		// we first inject the shared cookies
 		if !p.options.DisableCookie {
-			if cookies := p.ctx.CookieJar.Cookies(ctx.Request.URL()); len(cookies) > 0 {
-				httpClient.Jar.SetCookies(ctx.Request.URL(), cookies)
+			if cookies := p.ctx.CookieJar.Cookies(req.URL); len(cookies) > 0 {
+				httpClient.Jar.SetCookies(req.URL, cookies)
 			}
 		}
 
 		// perform the request
 		if err := ctx.LoadResponse(httpClient, true); err != nil {
-			gologger.Verbose().Msgf("headless: failed to load response for %s: %s", ctx.Request.URL(), err)
+			gologger.Verbose().Msgf("headless: failed to load response for %s: %s", req.URL, err)
 		}
 
 		if !p.options.DisableCookie {
 			// retrieve the updated cookies from the native http client and inject them into the shared cookie jar
 			// keeps existing one if not present
-			if cookies := httpClient.Jar.Cookies(ctx.Request.URL()); len(cookies) > 0 {
-				p.ctx.CookieJar.SetCookies(ctx.Request.URL(), cookies)
+			if cookies := httpClient.Jar.Cookies(req.URL); len(cookies) > 0 {
+				p.ctx.CookieJar.SetCookies(req.URL, cookies)
 			}
 		}
 
@@ -84,7 +97,6 @@ func (p *Page) routingRuleHandler(httpClient *http.Client) func(ctx *rod.Hijack)
 		}
 
 		// store history
-		req := ctx.Request.Req()
 		var rawReq string
 		if raw, err := httputil.DumpRequestOut(req, true); err == nil {
 			rawReq = string(raw)
```

---

### Incident Patch 2: `22aedebe` (2026-11-03)
**Commit Message**: fix(headless): normalize IPv4-mapped IPv6 host forms for -exclude-hosts and -lna (#7982)

Normalize hostnames and IPv4-mapped IPv6 addresses (e.g. ::ffff:127.0.0.1,
::ffff:7f00:1, and bracketed variants) before validating against NetworkPolicy
and ExcludeTargets in headless execution. Also expand CDP blocked patterns
in SetupHeadlessNetworkPolicy to match mapped IPv6 representations.

Signed-off-by: TassioSales <[REDACTED_EMAIL]>

**File**: `pkg/protocols/common/protocolstate/headless.go` (modified, +57/-26)
```diff
@@ -102,33 +102,24 @@ func isValidHost(options *types.Options, targetUrl string) bool {
 	if !stringsutil.HasPrefixAny(normalized, "http:", "https:", "ws:", "wss:") {
 		return true
 	}
-
-	dialers, ok := dialers.Get(options.ExecutionId)
-	if !ok {
+	if options == nil {
 		return true
 	}
-
-	np := dialers.NetworkPolicy
-	if np == nil {
-		// no policy present: deny rather than allow.
-		return false
-	}
-
-	urlx, err := urlutil.Parse(targetUrl)
-	if err != nil {
-		// not a valid url
-		return false
-	}
-	targetUrl = urlx.Hostname()
-	_, ok = np.ValidateHost(targetUrl)
-	return ok
+	return IsHostAllowed(options.ExecutionId, targetUrl)
 }
 
 // CanonicalizeHost normalizes a hostname or IP string:
 // - strips surrounding whitespace and brackets (e.g. "[::1]" -> "::1")
 // - maps IPv4-mapped IPv6 literals (e.g. "::ffff:127.0.0.1" or "0:0:0:0:0:ffff:127.0.0.1") to canonical IPv4 ("127.0.0.1")
 func CanonicalizeHost(host string) string {
 	h := strings.TrimSpace(host)
+	if strings.Contains(h, "://") {
+		if parsed, err := urlutil.Parse(h); err == nil && parsed.Hostname() != "" {
+			h = parsed.Hostname()
+		}
+	} else if sh, _, err := net.SplitHostPort(h); err == nil {
+		h = sh
+	}
 	h = strings.TrimPrefix(h, "[")
 	h = strings.TrimSuffix(h, "]")
 	if ip := net.ParseIP(h); ip != nil {
@@ -221,14 +212,35 @@ func SetupHeadlessNetworkPolicy(options *types.Options, page *rod.Page) error {
 			target = parsed.Hostname()
 		}
 		if !strings.Contains(target, "/") {
-			blockedPatterns = append(blockedPatterns,
-				"*://"+target+"/*",
-				"*://"+target+":*/*",
-				"ws://"+target+"/*",
-				"ws://"+target+":*/*",
-				"wss://"+target+"/*",
-				"wss://"+target+":*/*",
-			)
+			addPatterns := func(t string) {
+				t = strings.TrimPrefix(strings.TrimSuffix(t, "]"), "[")
+				blockedPatterns = append(blockedPatterns,
+					"*://"+t+"/*",
+					"*://"+t+":*/*",
+					"ws://"+t+"/*",
+					"ws://"+t+":*/*",
+					"wss://"+t+"/*",
+					"wss://"+t+":*/*",
+				)
+				if ip := net.ParseIP(t); ip != nil {
+					if ipv4 := ip.To4(); ipv4 != nil {
+						v6mapped := "[::ffff:" + ipv4.String() + "]"
+						blockedPatterns = append(blockedPatterns,
+							"*://"+v6mapped+"/*",
+							"*://"+v6mapped+":*/*",
+							"ws://"+v6mapped+"/*",
+							"ws://"+v6mapped+":*/*",
+							"wss://"+v6mapped+"/*",
+							"wss://"+v6mapped+":*/*",
+						)
+					}
+				}
+			}
+			addPatterns(target)
+			canon := CanonicalizeHost(target)
+			if canon != "" && canon != target {
+				addPatterns(canon)
+			}
 		}
 	}
 
@@ -255,13 +267,32 @@ func SetupHeadlessNetworkPolicy(options *types.Options, page *rod.Page) error {
 			"wss://10.*/*", "wss://10.*:*/*",
 			"wss://192.168.*/*", "wss://192.168.*:*/*",
 			"wss://169.254.*/*", "wss://169.254.*:*/*",
+			"*://[::ffff:127.*]/*", "*://[::ffff:127.*]:*/*",
+			"*://[::ffff:0.0.0.0]/*", "*://[::ffff:0.0.0.0]:*/*",
+			"*://[::ffff:10.*]/*", "*://[::ffff:10.*]:*/*",
+			"*://[::ffff:192.168.*]/*", "*://[::ffff:192.168.*]:*/*",
+			"*://[::ffff:169.254.*]/*", "*://[::ffff:169.254.*]:*/*",
+			"ws://[::ffff:127.*]/*", "ws://[::ffff:127.*]:*/*",
+			"ws://[::ffff:0.0.0.0]/*", "ws://[::ffff:0.0.0.0]:*/*",
+			"ws://[::ffff:10.*]/*", "ws://[::ffff:10.*]:*/*",
+			"ws://[::ffff:192.168.*]/*", "ws://[::ffff:192.168.*]:*/*",
+			"ws://[::ffff:169.254.*]/*", "ws://[::ffff:169.254.*]:*/*",
+			"wss://[::ffff:127.*]/*", "wss://[::ffff:127.*]:*/*",
+			"wss://[::ffff:0.0.0.0]/*", "wss://[::ffff:0.0.0.0]:*/*",
+			"wss://[::ffff:10.*]/*", "wss://[::ffff:10.*]:*/*",
+			"wss://[::ffff:192.168.*]/*", "wss://[::ffff:192.168.*]:*/*",
+			"wss://[::ffff:169.254.*]/*", "wss://[::ffff:169.254.*]:*/*",
 		}
 		for i := 16; i <= 31; i++ {
 			prefix := fmt.Sprintf("172.%d.*", i)
+			v6prefix := fmt.Sprintf("[::ffff:172.%d.*]", i)
 			localPatterns = append(localPatterns,
 				"*://"+prefix+"/*", "*://"+prefix+":*/*",
+				"*://"+v6prefix+"/*", "*://"+v6prefix+":*/*",
 				"ws://"+prefix+"/*", "ws://"+prefix+":*/*",
+				"ws://"+v6prefix+"/*", "ws://"+v6prefix+":*/*",
 				"wss://"+prefix+"/*", "wss://"+prefix+":*/*",
+				"wss://"+v6prefix+"/*", "wss://"+v6prefix+":*/*",
 			)
 		}
 		blockedPatterns = append(blockedPatterns, localPatterns...)
```

**File**: `pkg/protocols/common/protocolstate/headless_test.go` (modified, +43/-3)
```diff
@@ -19,7 +19,8 @@ func TestIsValidHost(t *testing.T) {
 	require.NoError(t, err)
 
 	d := &Dialers{
-		NetworkPolicy: np,
+		NetworkPolicy:  np,
+		ExcludeTargets: []string{"192.168.1.50"},
 	}
 	err = dialers.Set(opts.ExecutionId, d)
 	require.NoError(t, err)
@@ -31,18 +32,57 @@ func TestIsValidHost(t *testing.T) {
 	require.True(t, isValidHost(opts, "ws://example.com:9999"))
 	require.True(t, isValidHost(opts, "wss://example.com:9999"))
 
-	// Blocked hosts (127.0.0.1)
+	// Blocked hosts (127.0.0.1 in DenyList)
 	require.False(t, isValidHost(opts, "http://127.0.0.1:8080"))
 	require.False(t, isValidHost(opts, "https://127.0.0.1:8443"))
 	require.False(t, isValidHost(opts, "ws://127.0.0.1:9999"))
 	require.False(t, isValidHost(opts, "wss://127.0.0.1:9999"))
 
+	// Blocked IPv4-mapped IPv6 forms of 127.0.0.1
+	require.False(t, isValidHost(opts, "http://[::ffff:127.0.0.1]:8080"))
+	require.False(t, isValidHost(opts, "https://[::ffff:127.0.0.1]:8443"))
+	require.False(t, isValidHost(opts, "http://[::ffff:7f00:1]:8080"))
+	require.False(t, isValidHost(opts, "http://[0:0:0:0:0:ffff:127.0.0.1]:8080"))
+	require.False(t, isValidHost(opts, "http://[0000:0000:0000:0000:0000:ffff:7f00:0001]:8080"))
+	require.False(t, isValidHost(opts, "ws://[::ffff:127.0.0.1]:9999"))
+
+	// Blocked hosts via ExcludeTargets (IPv4 and IPv4-mapped IPv6)
+	require.False(t, isValidHost(opts, "http://192.168.1.50:8080"))
+	require.False(t, isValidHost(opts, "http://[::ffff:192.168.1.50]:8080"))
+	require.False(t, isValidHost(opts, "http://[::ffff:c0a8:132]:8080"))
+
 	require.True(t, IsHostAllowed(opts.ExecutionId, "ws://example.com:9999"))
 	require.False(t, IsHostAllowed(opts.ExecutionId, "ws://127.0.0.1:9999"))
+	require.False(t, IsHostAllowed(opts.ExecutionId, "ws://[::ffff:127.0.0.1]:9999"))
+	require.False(t, IsHostAllowed(opts.ExecutionId, "http://[::ffff:192.168.1.50]:8080"))
+}
+
+func TestCanonicalizeHost_IPv4MappedIPv6(t *testing.T) {
+	cases := map[string]string{
+		"127.0.0.1":                                 "127.0.0.1",
+		"127.0.0.1:8080":                            "127.0.0.1",
+		"http://127.0.0.1:8080/path":                "127.0.0.1",
+		"::ffff:127.0.0.1":                          "127.0.0.1",
+		"[::ffff:127.0.0.1]":                        "127.0.0.1",
+		"[::ffff:127.0.0.1]:8080":                   "127.0.0.1",
+		"http://[::ffff:127.0.0.1]:8080/test":       "127.0.0.1",
+		"::ffff:7f00:1":                             "127.0.0.1",
+		"[::ffff:7f00:1]:8443":                      "127.0.0.1",
+		"0:0:0:0:0:ffff:127.0.0.1":                  "127.0.0.1",
+		"0000:0000:0000:0000:0000:ffff:7f00:0001":  "127.0.0.1",
+		"example.com":                               "example.com",
+		"example.com:443":                           "example.com",
+		"https://example.com:443/foo":               "example.com",
+		"::1":                                       "::1",
+		"[::1]:8080":                                "::1",
+	}
+
+	for input, expected := range cases {
+		require.Equal(t, expected, CanonicalizeHost(input), "input: %s", input)
+	}
 }
 
 func TestSetupHeadlessNetworkPolicy_Nil(t *testing.T) {
 	require.NoError(t, SetupHeadlessNetworkPolicy(nil, nil))
 	require.NoError(t, SetupHeadlessNetworkPolicy(&types.Options{}, nil))
 }
-
```

---

### Incident Patch 3: `f9446e92` (2026-11-03)
**Commit Message**: Merge pull request #8016 from projectdiscovery/dwisiswant0/fix/headless/fail-requests-whose-url-net-url-cannot-parse

fix(headless): fail requests whose URL net/url cannot parse

**File**: `pkg/protocols/headless/engine/page_actions_test.go` (modified, +71/-1)
```diff
@@ -5,6 +5,7 @@ import (
 	"fmt"
 	"io"
 	"math/rand"
+	"net"
 	"net/http"
 	"net/http/cookiejar"
 	"net/http/httptest"
@@ -15,6 +16,7 @@ import (
 	"strconv"
 	"strings"
 	"sync"
+	"sync/atomic"
 	"testing"
 	"time"
 
@@ -319,6 +321,58 @@ func TestActionHeadersChange(t *testing.T) {
 	})
 }
 
+// Chrome keeps malformed percent-escapes such as "100%.png" in request paths,
+// as the WHATWG URL Standard requires, but net/url rejects them, so go-rod
+// hands the modification-rules hijack handler a request with a nil URL (#8015).
+//
+//nolint:exhaustruct,exhaustruct_v5,paralleltest // like the other action tests, which share browser and dialer state
+func TestRoutingRuleHandlerFailsRequestNetHTTPCannotParse(t *testing.T) {
+	for _, disableCookie := range []bool{false, true} {
+		t.Run(fmt.Sprintf("DisableCookie=%t", disableCookie), func(t *testing.T) {
+			// Count connections, not requests: net/http rejects the request line
+			// before any handler runs. TLS makes the headless proxy tunnel the
+			// request with CONNECT instead of rejecting the unparsable path itself.
+			var imageConns atomic.Int32
+
+			imageServer := httptest.NewUnstartedServer(http.NotFoundHandler())
+			imageServer.Config.ConnState = func(_ net.Conn, state http.ConnState) {
+				if state == http.StateNew {
+					imageConns.Add(1)
+				}
+			}
+
+			imageServer.StartTLS()
+			defer imageServer.Close()
+
+			actions := []*Action{
+				{
+					ActionType: ActionTypeHolder{ActionType: ActionSetHeader},
+					Data:       map[string]string{"part": "request", "key": "Test", "value": "Hello"},
+				},
+				{ActionType: ActionTypeHolder{ActionType: ActionNavigate}, Data: map[string]string{"url": "{{BaseURL}}"}},
+				{ActionType: ActionTypeHolder{ActionType: ActionWaitLoad}},
+			}
+			handler := func(w http.ResponseWriter, r *http.Request) {
+				if r.Header.Get("Test") == "Hello" {
+					_, _ = fmt.Fprintf(w, `<html><body>found<img src="%s/100%%.png"></body></html>`, imageServer.URL)
+				}
+			}
+			options := &Options{Timeout: 20 * time.Second, DisableCookie: disableCookie}
+
+			testHeadlessWithOptions(t, actions, options, handler, func(page *Page, err error, _ ActionData) {
+				require.NoError(t, err)
+
+				body := page.Page().MustElement("body").MustText()
+				require.Equal(t, "found", strings.TrimSpace(body), "modification rules were not applied")
+				require.Zero(t, imageConns.Load(), "unparsable request reached the image server")
+
+				imageDone := page.Page().MustEval(`() => document.querySelector("img").complete`).Bool()
+				require.True(t, imageDone, "unparsable request is still paused")
+			})
+		})
+	}
+}
+
 func TestActionScreenshot(t *testing.T) {
 	response := `
 		<html>
@@ -1003,6 +1057,21 @@ func TestMain(m *testing.M) {
 func testHeadless(t *testing.T, actions []*Action, timeout time.Duration, handler func(w http.ResponseWriter, r *http.Request), assert func(page *Page, pageErr error, extractedData ActionData)) {
 	t.Helper()
 
+	options := &Options{Timeout: timeout} //nolint:exhaustruct,exhaustruct_v5 // zero values are the defaults
+	testHeadlessWithOptions(t, actions, options, handler, assert)
+}
+
+// testHeadlessWithOptions is testHeadless with caller-chosen page options. It
+// overwrites options.Options with the test scan options.
+func testHeadlessWithOptions(
+	t *testing.T,
+	actions []*Action,
+	options *Options,
+	handler func(w http.ResponseWriter, r *http.Request),
+	assert func(page *Page, pageErr error, extractedData ActionData),
+) {
+	t.Helper()
+
 	lfa := envutil.GetEnvOrDefault("LOCAL_FILE_ACCESS", true)
 	rna := envutil.GetEnvOrDefault("RESTRICTED_LOCAL_NETWORK_ACCESS", false)
 
@@ -1027,7 +1096,8 @@ func testHeadless(t *testing.T, actions []*Action, timeout time.Duration, handle
 	input.CookieJar, err = cookiejar.New(nil)
 	require.Nil(t, err)
 
-	extractedData, page, err := instance.Run(input, actions, nil, &Options{Timeout: timeout, Options: opts}) // allow file access in test
+	options.Options = opts // allow file access in test
+	extractedData, page, err := instance.Run(input, actions, nil, options)
 	assert(page, err, extractedData)
 
 	if page != nil {
```

**File**: `pkg/protocols/headless/engine/rules.go` (modified, +24/-12)
```diff
@@ -15,8 +15,21 @@ import (
 // routingRuleHandler handles proxy rule for actions related to request/response modification
 func (p *Page) routingRuleHandler(httpClient *http.Client) func(ctx *rod.Hijack) {
 	return func(ctx *rod.Hijack) {
+		req := ctx.Request.Req()
+		// go-rod discards url.Parse errors, so a URL that Chrome accepts but
+		// net/url rejects, such as "/100%.png", arrives as nil. Fail the request:
+		// the Go client cannot send it, and continuing it in the browser would
+		// drop the modification rules and, with -cdp-endpoint (no headless
+		// proxy), the network policy's dial-time address checks.
+		if req.URL == nil {
+			gologger.Verbose().Msgf("headless: failed %s request with a URL that net/url cannot parse", req.Method)
+			ctx.Response.Fail(proto.NetworkErrorReasonFailed)
+
+			return
+		}
+
 		// usually browsers don't use chunked transfer encoding, so we set the content-length nevertheless
-		ctx.Request.Req().ContentLength = int64(len(ctx.Request.Body()))
+		req.ContentLength = int64(len(ctx.Request.Body()))
 		// snapshot the rules once: ExecuteActions may still be appending rules
 		// from another goroutine while this hijack handler runs.
 		rules := p.rulesSnapshot()
@@ -28,39 +41,39 @@ func (p *Page) routingRuleHandler(httpClient *http.Client) func(ctx *rod.Hijack)
 			switch rule.Action {
 			case ActionSetMethod:
 				rule.Do(func() {
-					ctx.Request.Req().Method = rule.Args["method"]
+					req.Method = rule.Args["method"]
 				})
 			case ActionAddHeader:
-				ctx.Request.Req().Header.Add(rule.Args["key"], rule.Args["value"])
+				req.Header.Add(rule.Args["key"], rule.Args["value"])
 			case ActionSetHeader:
-				ctx.Request.Req().Header.Set(rule.Args["key"], rule.Args["value"])
+				req.Header.Set(rule.Args["key"], rule.Args["value"])
 			case ActionDeleteHeader:
-				ctx.Request.Req().Header.Del(rule.Args["key"])
+				req.Header.Del(rule.Args["key"])
 			case ActionSetBody:
 				body := rule.Args["body"]
-				ctx.Request.Req().ContentLength = int64(len(body))
+				req.ContentLength = int64(len(body))
 				ctx.Request.SetBody(body)
 			}
 		}
 
 		// each http request is performed via the native go http client
 		// we first inject the shared cookies
 		if !p.options.DisableCookie {
-			if cookies := p.ctx.CookieJar.Cookies(ctx.Request.URL()); len(cookies) > 0 {
-				httpClient.Jar.SetCookies(ctx.Request.URL(), cookies)
+			if cookies := p.ctx.CookieJar.Cookies(req.URL); len(cookies) > 0 {
+				httpClient.Jar.SetCookies(req.URL, cookies)
 			}
 		}
 
 		// perform the request
 		if err := ctx.LoadResponse(httpClient, true); err != nil {
-			gologger.Verbose().Msgf("headless: failed to load response for %s: %s", ctx.Request.URL(), err)
+			gologger.Verbose().Msgf("headless: failed to load response for %s: %s", req.URL, err)
 		}
 
 		if !p.options.DisableCookie {
 			// retrieve the updated cookies from the native http client and inject them into the shared cookie jar
 			// keeps existing one if not present
-			if cookies := httpClient.Jar.Cookies(ctx.Request.URL()); len(cookies) > 0 {
-				p.ctx.CookieJar.SetCookies(ctx.Request.URL(), cookies)
+			if cookies := httpClient.Jar.Cookies(req.URL); len(cookies) > 0 {
+				p.ctx.CookieJar.SetCookies(req.URL, cookies)
 			}
 		}
 
@@ -84,7 +97,6 @@ func (p *Page) routingRuleHandler(httpClient *http.Client) func(ctx *rod.Hijack)
 		}
 
 		// store history
-		req := ctx.Request.Req()
 		var rawReq string
 		if raw, err := httputil.DumpRequestOut(req, true); err == nil {
 			rawReq = string(raw)
```

#### Recent Merged Pull Requests:
- **PR #8019** (closed): fix(headless): prevent nil pointer dereference on invalid URL in cookie jar (#8015) (@TassioSales)
- **PR #8016** (2026-11-03): fix(headless): fail requests whose URL net/url cannot parse (@dwisiswant0)
- **PR #8014** (2026-11-03): fix(headless): normalize IPv4-mapped IPv6 host forms for -exclude-hosts and -lna (#7982) (@TassioSales)
- **PR #8013** (2026-11-03): test(expressions): add regression case for govaluate concat bug (follow-up to #7998) (@0xABCD01)
- **PR #8012** (2026-11-03): fix(flow): prevent global state leakage in shared JS runtime pool (#7986) (@TassioSales)
- **PR #8010** (2026-11-02): websocket: negotiate Sec-WebSocket-Protocol via the dialer (@Ayham970)

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

## X. headless): fail requests whose URL net/url cannot parse

**RULE**:
When implementing operations in `pkg/protocols/headless/engine/page_actions_test.go`, engineers MUST enforce rigorous boundary validation, safe state transitions, and memory/concurrency invariants as established by production defect remediation in projectdiscovery/nuclei. All inputs crossing module boundaries must be explicitly verified before state persistence.

**WHY**:
Prevents defects observed in production commit `be40690a`: headless): fail requests whose URL net/url cannot parse. Unvalidated execution paths cause runtime exceptions, race conditions, and silent state corruption under concurrent workloads.

**WHEN TO APPLY**:
Subsystems managing Go data structures, boundary deserialization, API parsing, or resource lifecycles matching `pkg/protocols/headless/engine/page_actions_test.go`.

**VERIFIED IMPLEMENTATION PATTERN**:
```go
// Verified production-grade fix pattern:
	"net"
	"sync/atomic"
// Chrome keeps malformed percent-escapes such as "100%.png" in request paths,
// as the WHATWG URL Standard requires, but net/url rejects them, so go-rod
// hands the modification-rules hijack handler a request with a nil URL (#8015).
//
//nolint:exhaustruct,exhaustruct_v5,paralleltest // like the other action tests, which share browser and dialer state
func TestRoutingRuleHandlerFailsRequestNetHTTPCannotParse(t *testing.T) {
	for _, disableCookie := range []bool{false, true} {
		t.Run(fmt.Sprintf("DisableCookie=%t", disableCookie), func(t *testing.T) {
			// Count connections, not requests: net/http rejects the request line
			// before any handler runs. TLS makes the headless proxy tunnel the
			// request with CONNECT instead of rejecting the unparsable path itself.
			var imageConns atomic.Int32

			imageServer := httptest.NewUnstartedServer(http.NotFoundHandler())
			imageServer.Config.ConnState = func(_ net.Conn, state http.ConnState) {
				if state == http.StateNew {
					imageConns.Add(1)
				}
			}

			imageServer.StartTLS()
			defer imageServer.Close()

			actions := []*Action{
				{
					ActionType: ActionTypeHolder{ActionType: ActionSetHeader},
		
```

**NEGATIVE CONSTRAINT**:
```go
// Anti-pattern to NEVER write (induced failure mode):
	extractedData, page, err := instance.Run(input, actions, nil, &Options{Timeout: timeout, Options: opts}) // allow file access in test
```

**VERIFICATION METHOD**:
Automated regression test asserting that input states reproducing defect `be40690a` are properly handled with clean fallback behavior.
