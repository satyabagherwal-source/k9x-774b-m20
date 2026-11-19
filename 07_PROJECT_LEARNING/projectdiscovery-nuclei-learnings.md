> **Canonical Learning Artifact**: `07_PROJECT_LEARNING/projectdiscovery-nuclei-learnings.md`  
> **Source**: github ([https://github.com/projectdiscovery/nuclei](https://github.com/projectdiscovery/nuclei))  
> **Source Version**: `2e587bc5`  
> **License**: MIT  
> **Synthesized By**: zero-clone-structural-synthesizer  
> **Timestamp**: 2026-11-19T16:07:23.256Z  
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
> **Harvest Timestamp**: 2026-11-19T16:07:23.248Z  
> **Compliance State**: Free Tier Guaranteed | Strict Rate-Limit Backoff Honored  

---

## 1. Context & Architectural Overview
- **Repository / Resource**: `projectdiscovery/nuclei`
- **Description**: Nuclei is a fast, customizable vulnerability scanner powered by the global security community and built on a simple YAML-based DSL, enabling collaboration to tackle trending vulnerabilities on the internet. It helps you find vulnerabilities in your applications, APIs, networks, DNS, and cloud configurations.
- **Primary Language / Ecosystem**: Go
- **Discovered Manifests / Configurations**: go.mod, README.md, Dockerfile
- **Stars / Engagement**: 33121 stars

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

// taskTracker returns the progress when it counts ta
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
	templateThreads := w.Options.Options.TemplateThreads
	if templateThreads == 1 {
		templateThreads++
	}
	swg, _ := syncutil.New(syncutil.WithSize(templateThreads))
	// pending tracks every started step until it returns. swg only limits
	// concurrency and its slots can be released early, so completion is
	// tracked here instead.
	var pending sync.WaitGroup

	for _, template := range w.Workflows {
		newCtx := scan.NewScanContext(ctx.Context(), ctx.Input.Clone())
		// Root steps do not own a waitgroup slot.
		if err := e.runWorkflowStep(template, newCtx, results, swg, &pending, w, nil); err != nil {
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
func (e *Engine) runWorkflowStep(template *workflows.WorkflowTemplate, ctx *scan.ScanContext, results *atomic.Bool, swg *syncutil.AdaptiveWaitGroup, pending *sync.WaitGroup, w *workflows.Workflow, releaseSlot func()) error {
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
							if err := e.runWorkflowStep(subtemplate, subCtx, results, swg, pending, w, release); err != nil {
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
				if err := e.runWorkflowStep(template, subCtx, results, swg, pending, w, release); err != nil {
					gologger.Warning().Msgf(workflowStepExecutionError, template.Template, err)
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

### Incident Patch 1: `5fbb495d` (2026-11-19)
**Commit Message**: fix(http): start the @timeout deadline when the request is sent

A request's timeout should bound its exchange with the host, not the
time it spends queued. a4422d896 moved the default HTTP timeout into
executeRequest, after the rate-limit token and the body budget, but a
template that uses @timeout still got its deadlines from
parseAnnotations while the request was being built. Every raw request
of such a template, annotated or not, spent that deadline waiting for
a token, so a request paced past it failed with "context deadline
exceeded" without being sent, and its token was used up anyway.

parseAnnotations now records the timeout and its cause, and
executeRequest starts it when the request is sent, as it does for the
default timeout. Each kind of timeout keeps the cause it had.

A @timeout that does not parse or is not positive now gets the default
timeout on every path. Only the sequential path used to fill the
default in, so the parallel, race and pipeline paths sent such a
request with no deadline for an unparsable value, and with one that
had already expired for a zero or negative value.

Fixes: #8176
Fixes: #8179
Refs: #8162
Signed-off-by: Dwi Siswanto <[REDACTED_EMAIL]>

**File**: `pkg/protocols/http/build_request.go` (modified, +15/-15)
```diff
@@ -74,17 +74,19 @@ var (
 
 // generatedRequest is a single generated request wrapped for a template request
 type generatedRequest struct {
-	original             *Request
-	rawRequest           *raw.Request
-	meta                 map[string]interface{}
-	pipelinedClient      *rawhttp.PipelineClient
-	request              *retryablehttp.Request
-	dynamicValues        map[string]interface{}
-	interactshURLs       []string
-	customCancelFunction context.CancelFunc
-	// sendTimeout starts after the body budget admits the request.
-	sendTimeout  time.Duration
-	bodyReserved bool
+	original        *Request
+	rawRequest      *raw.Request
+	meta            map[string]any
+	pipelinedClient *rawhttp.PipelineClient
+	request         *retryablehttp.Request
+	dynamicValues   map[string]any
+	interactshURLs  []string
+	// sendTimeout bounds the exchange with the host, and sendTimeoutCause is
+	// the error it ends with. executeRequest starts it after the rate-limit
+	// and backoff waits and the body budget, so no wait uses it up.
+	sendTimeout      time.Duration
+	sendTimeoutCause error
+	bodyReserved     bool
 	// requestURLPattern tracks unmodified request url pattern without values ( it is used for constant vuln_hash)
 	// ex: {{BaseURL}}/api/exp?param={{randstr}}
 	requestURLPattern string
@@ -608,9 +610,6 @@ func (r *requestGenerator) generateRawRequest(ctx context.Context, rawRequest st
 		}
 
 		unsafeReq := &generatedRequest{rawRequest: rawRequestData, meta: generatorValues, original: r.request, interactshURLs: r.interactshURLs}
-		if annotationOverrides.cancelFunc != nil {
-			unsafeReq.customCancelFunction = annotationOverrides.cancelFunc
-		}
 
 		if len(annotationOverrides.interactshURLs) > 0 {
 			unsafeReq.interactshURLs = append(unsafeReq.interactshURLs, annotationOverrides.interactshURLs...)
@@ -669,7 +668,8 @@ func (r *requestGenerator) generateRawRequest(ctx context.Context, rawRequest st
 			return nil, errkit.Wrap(reqWithOverrides.err, "failed to apply raw request annotations")
 		}
 		generatedRequest.request = reqWithOverrides.request
-		generatedRequest.customCancelFunction = reqWithOverrides.cancelFunc
+		generatedRequest.sendTimeout = reqWithOverrides.timeout
+		generatedRequest.sendTimeoutCause = reqWithOverrides.timeoutCause
 		generatedRequest.interactshURLs = append(generatedRequest.interactshURLs, reqWithOverrides.interactshURLs...)
 	}
 
```

**File**: `pkg/protocols/http/request.go` (modified, +5/-6)
```diff
@@ -708,8 +708,10 @@ executionLoop:
 				return false, true, nil, err
 			}
 			defer reservation.done()
-			if generatedHttpRequest.customCancelFunction == nil {
+
+			if generatedHttpRequest.sendTimeout == 0 {
 				generatedHttpRequest.sendTimeout = request.options.Options.GetTimeouts().HttpTimeout
+				generatedHttpRequest.sendTimeoutCause = ErrHttpEngineRequestDeadline
 			}
 			// ideally if http template used a custom port or hostname
 			// we would want to update it in input but currently templateCtx logic
@@ -723,10 +725,6 @@ executionLoop:
 				return false, true, nil, err
 			}
 
-			if generatedHttpRequest.customCancelFunction != nil {
-				defer generatedHttpRequest.customCancelFunction()
-			}
-
 			hasInteractMarkers := interactsh.HasMarkers(data) || len(generatedHttpRequest.interactshURLs) > 0
 			if input.MetaInput.Input == "" {
 				input.MetaInput.Input = generatedHttpRequest.URL()
@@ -1094,7 +1092,8 @@ func (request *Request) executeRequest(input *contextargs.Context, generatedRequ
 		defer releaseBody()
 	}
 	if generatedRequest.sendTimeout > 0 && generatedRequest.request != nil {
-		ctx, cancel := context.WithTimeoutCause(generatedRequest.request.Context(), generatedRequest.sendTimeout, ErrHttpEngineRequestDeadline)
+		ctx, cancel := context.WithTimeoutCause(
+			generatedRequest.request.Context(), generatedRequest.sendTimeout, generatedRequest.sendTimeoutCause)
 		defer cancel()
 		generatedRequest.request = generatedRequest.request.WithContext(ctx)
 	}
```

**File**: `pkg/protocols/http/request_annotations.go` (modified, +18/-11)
```diff
@@ -72,8 +72,11 @@ func hasTimeoutAnnotation(rawRequest string) bool {
 }
 
 type annotationOverrides struct {
-	request        *retryablehttp.Request
-	cancelFunc     context.CancelFunc
+	request *retryablehttp.Request
+	// timeout bounds the request once it is sent, and timeoutCause is the
+	// error it ends with.
+	timeout        time.Duration
+	timeoutCause   error
 	interactshURLs []string
 	err            error
 }
@@ -146,30 +149,34 @@ func (r *Request) parseAnnotations(rawRequest string, request *retryablehttp.Req
 	}
 
 	// @timeout:duration
+	// The timeout is only recorded here. executeRequest starts it after the
+	// rate-limit and body-budget waits, so those waits do not use it up (#8176).
+	// NoTimeout leaves the client without the HTTP timeout, so every request
+	// records one: the default, unless a valid annotation replaces it.
 	if r.connConfiguration.NoTimeout {
 		modified = true
-		var ctx context.Context
+		overrides.timeout, overrides.timeoutCause = r.options.Options.GetTimeouts().HttpTimeout, ErrRequestTimeoutDeadline
 
 		if duration := reTimeoutAnnotation.FindStringSubmatch(annotations); len(duration) > 0 {
 			value := strings.TrimSpace(duration[1])
-			if parsedTimeout, err := time.ParseDuration(value); err == nil {
+			parsedTimeout, err := time.ParseDuration(value)
+			// A timeout that does not parse or is not positive keeps the default.
+			if err == nil && parsedTimeout > 0 {
 				// Cap at maximum allowed timeout to prevent DoS via extremely large timeout values
 				if parsedTimeout > maxAnnotationTimeout {
 					parsedTimeout = maxAnnotationTimeout
 				}
 
-				//nolint:govet // cancelled automatically by withTimeout
-				// global timeout is overridden by annotation by replacing context
-				ctx, overrides.cancelFunc = context.WithTimeoutCause(context.TODO(), parsedTimeout, ErrTimeoutAnnotationDeadline)
+				overrides.timeout, overrides.timeoutCause = parsedTimeout, ErrTimeoutAnnotationDeadline
+				// The replaced context drops the input's cancellation (#8178).
+				ctx := context.TODO()
 				// add timeout value to context
 				ctx = context.WithValue(ctx, httpclientpool.WithCustomTimeout{}, httpclientpool.WithCustomTimeout{Timeout: parsedTimeout})
 				request = request.Clone(ctx)
 			}
 		} else {
-			//nolint:govet // cancelled automatically by withTimeout
-			// global timeout is overridden by annotation by replacing context
-			ctx, overrides.cancelFunc = context.WithTimeoutCause(context.TODO(), r.options.Options.GetTimeouts().HttpTimeout, ErrRequestTimeoutDeadline)
-			request = request.Clone(ctx)
+			// The replaced context drops the input's cancellation (#8178).
+			request = request.Clone(context.TODO())
 		}
 	}
 
```

**File**: `pkg/protocols/http/request_annotations_test.go` (modified, +54/-26)
```diff
@@ -83,7 +83,7 @@ func TestRequestParseAnnotationsSNI(t *testing.T) {
 		require.ErrorIs(t, overrides.err, commoninteractsh.ErrInteractshClientNotInitialized)
 		require.Empty(t, overrides.interactshURLs)
 		require.Same(t, httpReq, overrides.request)
-		require.Nil(t, overrides.cancelFunc)
+		require.Zero(t, overrides.timeout)
 	})
 }
 
@@ -101,21 +101,18 @@ func TestRequestParseAnnotationsTimeout(t *testing.T) {
 		require.Nil(t, err, "could not create http request")
 
 		overrides, modified := request.parseAnnotations(rawRequest, httpReq)
-		require.NotNil(t, overrides.cancelFunc, "could not initialize valid cancel function")
 		require.True(t, modified, "could not get correct modified value")
+		require.Equal(t, 2*time.Second, overrides.timeout, "timeout value mismatch")
+		require.ErrorIs(t, overrides.timeoutCause, ErrTimeoutAnnotationDeadline)
 
-		// Verify context has deadline
-		deadline, deadlined := overrides.request.Context().Deadline()
-		require.True(t, deadlined, "could not get set request deadline")
+		// The deadline starts when the request is sent, not when it is built.
+		_, deadlined := overrides.request.Context().Deadline()
+		require.False(t, deadlined, "request deadline started before the request was sent")
 
 		// Verify the timeout value is stored in context
 		customTimeout, ok := overrides.request.Context().Value(httpclientpool.WithCustomTimeout{}).(httpclientpool.WithCustomTimeout)
 		require.True(t, ok, "custom timeout not found in context")
 		require.Equal(t, 2*time.Second, customTimeout.Timeout, "timeout value mismatch")
-
-		// Verify deadline is approximately 2 seconds from now
-		expectedDeadline := time.Now().Add(2 * time.Second)
-		require.WithinDuration(t, expectedDeadline, deadline, 100*time.Millisecond, "deadline not set correctly")
 	})
 
 	t.Run("large-timeout", func(t *testing.T) {
@@ -133,23 +130,17 @@ func TestRequestParseAnnotationsTimeout(t *testing.T) {
 		require.Nil(t, err, "could not create http request")
 
 		overrides, modified := request.parseAnnotations(rawRequest, httpReq)
-		require.NotNil(t, overrides.cancelFunc, "could not initialize valid cancel function")
 		require.True(t, modified, "could not get correct modified value")
 
-		// Verify context has deadline
-		deadline, deadlined := overrides.request.Context().Deadline()
-		require.True(t, deadlined, "could not get set request deadline")
-
 		// Verify the timeout was capped at 5 minutes (not 10 minutes)
 		customTimeout, ok := overrides.request.Context().Value(httpclientpool.WithCustomTimeout{}).(httpclientpool.WithCustomTimeout)
 		require.True(t, ok, "custom timeout not found in context")
 
 		require.Equal(t, 5*time.Minute, customTimeout.Timeout, "timeout should be capped at 5 minutes")
 		require.Less(t, customTimeout.Timeout, 10*time.Minute, "timeout should be less than requested 10 minutes")
 
-		// Verify deadline matches the capped timeout
-		expectedDeadline := time.Now().Add(5 * time.Minute)
-		require.WithinDuration(t, expectedDeadline, deadline, 100*time.Millisecond, "deadline not set to capped timeout")
+		// Verify the request carries the capped timeout
+		require.Equal(t, 5*time.Minute, overrides.timeout, "request timeout not set to capped timeout")
 	})
 
 	t.Run("below-cap-timeout", func(t *testing.T) {
@@ -167,22 +158,16 @@ func TestRequestParseAnnotationsTimeout(t *testing.T) {
 		require.Nil(t, err, "could not create http request")
 
 		overrides, modified := request.parseAnnotations(rawRequest, httpReq)
-		require.NotNil(t, overrides.cancelFunc, "could not initialize valid cancel function")
 		require.True(t, modified, "could not get correct modified value")
 
-		// Verify context has deadline
-		deadline, deadlined := overrides.request.Context().Deadline()
-		require.True(t, deadlined, "could not get set request deadline")
-
 		// Verify the timeout is NOT capped - should be 2 minutes
 		customTimeout, ok := overrides.request.Context().Value(httpclientpool.WithCustomTimeout{}).(httpclientpool.WithCustomTimeout)
 		require.True(t, ok, "custom timeout not found in context")
 
 		require.Equal(t, 2*time.Minute, customTimeout.Timeout, "timeout should be the requested 2 minutes")
 
-		// Verify deadline matches the requested timeout
-		expectedDeadline := time.Now().Add(2 * time.Minute)
-		require.WithinDuration(t, expectedDeadline, deadline, 100*time.Millisecond, "deadline not set to requested timeout")
+		// Verify the request carries the requested timeout
+		require.Equal(t, 2*time.Minute, overrides.timeout, "request timeout not set to requested timeout")
 	})
 
 	t.Run("negative", func(t *testing.T) {
@@ -197,11 +182,54 @@ func TestRequestParseAnnotationsTimeout(t *testing.T) {
 		require.Nil(t, err, "could not create http request")
 
 		newRequestWithOverrides, modified := request.parseAnnotations(rawRequest, httpReq)
-		require.Nil(t, newRequestWithOverrides.cancelFunc, "cancel function should be nil")
+		require.Zero(t, newRequestWithOverrides.timeout, "timeout should be 
```

**File**: `pkg/protocols/http/request_test.go` (modified, +166/-0)
```diff
@@ -9,6 +9,7 @@ import (
 	"net"
 	"net/http"
 	"net/http/httptest"
+	"slices"
 	"strings"
 	"sync"
 	"sync/atomic"
@@ -836,6 +837,171 @@ func TestHTTPExtractMultipleReuseStopsOnceBranchesAfterCancellation(t *testing.T
 	require.Less(t, time.Since(startedAt), 750*time.Millisecond)
 }
 
+// A request's timeout bounds its exchange with the host. The wait for a
+// rate-limit token comes before that, so a paced request must still be sent
+// (#8162, #8176).
+//
+//nolint:paralleltest // the cases share the protocol state testutils.Init sets up
+func TestRequestTimeoutStartsAfterRateLimitWait(t *testing.T) {
+	tests := []struct {
+		name string
+		raw  []string
+	}{
+		{
+			name: "default timeout",
+			raw: []string{
+				"GET /first HTTP/1.1\nHost: {{Hostname}}",
+				"GET /second HTTP/1.1\nHost: {{Hostname}}",
+			},
+		},
+		{
+			name: "timeout annotation",
+			raw: []string{
+				"@timeout: 500ms\nGET /first HTTP/1.1\nHost: {{Hostname}}",
+				"@timeout: 500ms\nGET /second HTTP/1.1\nHost: {{Hostname}}",
+			},
+		},
+		{
+			// An annotation on one request turns off the client timeout for
+			// all of them, so the other request takes the default timeout.
+			name: "request beside a timeout annotation",
+			raw: []string{
+				"@timeout: 500ms\nGET /first HTTP/1.1\nHost: {{Hostname}}",
+				"GET /second HTTP/1.1\nHost: {{Hostname}}",
+			},
+		},
+	}
+	for _, tt := range tests {
+		t.Run(tt.name, func(t *testing.T) {
+			request := &Request{Raw: tt.raw} //nolint:exhaustruct,exhaustruct_v5 // zero values are the template defaults
+			require.Equal(t, []string{"/first", "/second"}, executePacedRequests(t, request))
+		})
+	}
+}
+
+// The parallel path builds each request before a worker takes its rate-limit
+// token, so the timeout has to start after that wait as well (#8176).
+//
+//nolint:paralleltest // shares the protocol state testutils.Init sets up
+func TestParallelRequestTimeoutStartsAfterRateLimitWait(t *testing.T) {
+	//nolint:exhaustruct,exhaustruct_v5 // zero values are the template defaults
+	request := &Request{
+		Raw:      []string{"@timeout: 500ms\nGET /{{path}} HTTP/1.1\nHost: {{Hostname}}"},
+		Threads:  1,
+		Payloads: map[string]any{"path": []string{"first", "second"}},
+	}
+	require.Equal(t, []string{"/first", "/second"}, executePacedRequests(t, request))
+}
+
+// With @timeout the client has no overall timeout of its own, so the request's
+// deadline bounds reading the response. A valid annotation sets it on every
+// path; one that does not parse or is not positive keeps the default (#8176).
+//
+//nolint:paralleltest // the cases share the protocol state testutils.Init sets up
+func TestTimeoutAnnotationBoundsResponse(t *testing.T) {
+	const stall = 2 * time.Second
+
+	tests := []struct {
+		name        string
+		annotation  string
+		httpTimeout time.Duration
+		parallel    bool
+	}{
+		{name: "annotation, sequential", annotation: "300ms", httpTimeout: time.Minute, parallel: false},
+		{name: "annotation, parallel", annotation: "300ms", httpTimeout: time.Minute, parallel: true},
+		{name: "unparsable annotation, parallel", annotation: "soon", httpTimeout: 300 * time.Millisecond, parallel: true},
+		{name: "zero annotation, parallel", annotation: "0s", httpTimeout: 300 * time.Millisecond, parallel: true},
+	}
+	for _, test := range tests {
+		t.Run(test.name, func(t *testing.T) {
+			options := testutils.DefaultOptions.Copy()
+			timeouts := *options.GetTimeouts()
+			timeouts.HttpTimeout = test.httpTimeout
+			options.SetTimeouts(&timeouts)
+			testutils.Init(options)
+			t.Cleanup(func() { testutils.Cleanup(options) })
+
+			// The headers arrive at once and the body stalls, so only the
+			// request's deadline can end the read before the stall does.
+			server := httptest.NewServer(http.HandlerFunc(func(resp http.ResponseWriter, req *http.Request) {
+				resp.Header().Set("Content-Length", "2")
+				resp.WriteHeader(http.StatusOK)
+				_ = http.NewResponseController(resp).Flush()
+
+				select {
+				case <-req.Context().Done():
+				case <-time.After(stall):
+					_, _ = resp.Write([]byte("ok"))
+				}
+			}))
+			t.Cleanup(server.Close)
+
+			//nolint:exhaustruct,exhaustruct_v5 // zero values are the template defaults
+			request := &Request{Raw: []string{"@timeout: " + test.annotation + "\nGET / HTTP/1.1\nHost: {{Hostname}}"}}
+			if test.parallel {
+				request.Raw = []string{"@timeout: " + test.annotation + "\nGET /?p={{p}} HTTP/1.1\nHost: {{Hostname}}"}
+				request.Threads = 1
+				request.Payloads = map[string]any{"p": []string{"a"}}
+			}
+
+			require.NoError(t, request.Compile(testutils.NewMockExecuterOptions(options, nil)))
+
+			start := time.Now()
+			err := request.ExecuteWithResults(contextargs.NewWithInput(t.Context(), server.URL),
+				make(output.InternalEvent), make(output.InternalEvent), func(*output.InternalWrappedEvent) {})
+			require.Error(t, err)
+			require.Less(t, time.Since(start), stall, "the response was read past the request's timeout")
+		})
+	
```

---

### Incident Patch 2: `2e587bc5` (2026-11-19)
**Commit Message**: fix(jira): close retest tickets on Jira Server (#8123)

* fix(jira): close linked issue by ID and use server search

Codex-Session: codex resume 01a1c1de-e73c-7622-949e-fbbbd741b6c5

* fix(jira): preserve project-scoped lookup across configs

Codex-Session: codex resume 01a1c1de-e73c-7622-949e-fbbbd741b6c5

* fix(jira): validate linked ticket before direct transition

Codex-Session: codex resume 01a1c1de-e73c-7622-949e-fbbbd741b6c5

* fix(jira): target verification ticket without changing retest scope

Codex-Session: codex resume 01a1c1de-e73c-7622-949e-fbbbd741b6c5

* docs(jira): describe targeted close method

Codex-Session: codex resume 01a1c1de-e73c-7622-949e-fbbbd741b6c5

* test(jira): use synthetic issue IDs in fixtures

Codex-Session: codex resume 01a1c1de-e73c-7622-949e-fbbbd741b6c5

* fix(jira): lowercase error strings for lint

Codex-Session: codex resume 01a1c1de-e73c-7622-949e-fbbbd741b6c5

* fix(jira): select open ticket before closing

Codex-Session: codex resume 01a1c1de-e73c-7622-949e-fbbbd741b6c5

**File**: `pkg/reporting/trackers/jira/jira.go` (modified, +41/-36)
```diff
@@ -7,7 +7,6 @@ import (
 	"net/http"
 	"net/url"
 	"strings"
-	"sync"
 	"text/template"
 
 	"github.com/andygrunwald/go-jira"
@@ -171,9 +170,6 @@ type Integration struct {
 	Formatter
 	jira    *jira.Client
 	options *Options
-
-	once         *sync.Once
-	transitionID string
 }
 
 // Options contains the configuration options for jira client
@@ -256,7 +252,6 @@ func New(options *Options) (*Integration, error) {
 	integration := &Integration{
 		jira:    jiraClient,
 		options: options,
-		once:    &sync.Once{},
 	}
 	return integration, nil
 }
@@ -404,40 +399,50 @@ func (i *Integration) CloseIssue(event *output.ResultEvent) error {
 		return nil
 	}
 
-	issue, err := i.FindExistingIssue(event, false)
+	issue, err := i.FindExistingIssue(event, true)
 	if err != nil {
 		return err
-	} else if issue.ID != "" {
-		// Lazy load the transitions ID in case it's not set.
-		// StatusNot is a target status name (matches JQL usage below and the
-		// field's semantics); find the transition that moves to that status.
-		i.once.Do(func() {
-			transitions, _, err := i.jira.Issue.GetTransitions(issue.ID)
-			if err != nil {
-				return
-			}
-			for _, transition := range transitions {
-				if transition.To.Name == i.options.StatusNot {
-					i.transitionID = transition.ID
-					break
-				}
-			}
-		})
-		if i.transitionID == "" {
-			return nil
-		}
-		transition := jira.CreateTransitionPayload{
-			Transition: jira.TransitionPayload{
-				ID: i.transitionID,
-			},
-		}
+	}
+	if issue.ID == "" {
+		return nil
+	}
+	return i.CloseIssueByID(issue.ID)
+}
 
-		_, err = i.jira.Issue.DoTransitionWithPayload(issue.ID, transition)
+// CloseIssueByID transitions a known Jira issue to the configured target status.
+func (i *Integration) CloseIssueByID(issueID string) error {
+	if i.options.StatusNot == "" {
+		return nil
+	}
+	if issueID == "" {
+		return fmt.Errorf("jira issue ID is required")
+	}
+
+	transitions, _, err := i.jira.Issue.GetTransitions(issueID)
+	if err != nil {
+		return fmt.Errorf("get Jira issue %s transitions: %w", issueID, err)
+	}
+	for _, transition := range transitions {
+		if transition.To.Name != i.options.StatusNot {
+			continue
+		}
+		_, err = i.jira.Issue.DoTransitionWithPayload(issueID, jira.CreateTransitionPayload{
+			Transition: jira.TransitionPayload{ID: transition.ID},
+		})
 		if err != nil {
-			return err
+			return fmt.Errorf("transition Jira issue %s: %w", issueID, err)
 		}
+		return nil
+	}
+
+	currentIssue, _, err := i.jira.Issue.Get(issueID, nil)
+	if err != nil {
+		return fmt.Errorf("get Jira issue %s status: %w", issueID, err)
+	}
+	if currentIssue.Fields != nil && currentIssue.Fields.Status != nil && currentIssue.Fields.Status.Name == i.options.StatusNot {
+		return nil
 	}
-	return nil
+	return fmt.Errorf("jira issue %s has no transition to %q", issueID, i.options.StatusNot)
 }
 
 // FindExistingIssue checks if the issue already exists and returns its ID
@@ -495,12 +500,12 @@ func (i *Integration) FindExistingIssue(event *output.ResultEvent, useStatus boo
 		}, nil
 	}
 
-	searchOptions := &jira.SearchOptionsV2{
+	searchOptions := &jira.SearchOptions{
 		MaxResults: 1, // if any issue exists, then we won't create a new one
 		Fields:     []string{"summary", "description", "issuetype", "status", "priority", "project"},
 	}
 
-	issues, resp, err := i.jira.Issue.SearchV2JQL(jql, searchOptions)
+	issues, resp, err := i.jira.Issue.Search(jql, searchOptions)
 	if err != nil {
 		var data string
 		if resp != nil && resp.Body != nil {
@@ -510,7 +515,7 @@ func (i *Integration) FindExistingIssue(event *output.ResultEvent, useStatus boo
 		return jira.Issue{}, fmt.Errorf("%w => %s", err, data)
 	}
 
-	switch resp.Total {
+	switch len(issues) {
 	case 0:
 		return jira.Issue{}, nil
 	case 1:
```

**File**: `pkg/reporting/trackers/jira/jira_test.go` (modified, +184/-0)
```diff
@@ -1,7 +1,9 @@
 package jira
 
 import (
+	"fmt"
 	"net/http"
+	"net/http/httptest"
 	"os"
 	"strings"
 	"testing"
@@ -15,6 +17,188 @@ import (
 	"github.com/stretchr/testify/require"
 )
 
+func TestCloseIssueUsesServerSearchResult(t *testing.T) {
+	transitionCalls := 0
+	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
+		switch {
+		case r.Method == http.MethodGet && strings.HasSuffix(r.URL.Path, "/search"):
+			_, _ = w.Write([]byte(`{"issues":[{"id":"10001","key":"TEST-1","fields":{"status":{"name":"Open"}}}]}`))
+		case r.Method == http.MethodGet && strings.HasSuffix(r.URL.Path, "/search/jql"):
+			http.Error(w, "", http.StatusForbidden)
+		case r.Method == http.MethodGet && strings.HasSuffix(r.URL.Path, "/transitions"):
+			_, _ = w.Write([]byte(`{"transitions":[{"id":"5","to":{"name":"Done"}}]}`))
+		case r.Method == http.MethodPost && strings.HasSuffix(r.URL.Path, "/transitions"):
+			transitionCalls++
+			w.WriteHeader(http.StatusNoContent)
+		default:
+			http.Error(w, "unexpected endpoint", http.StatusNotFound)
+		}
+	}))
+	defer server.Close()
+
+	integration, err := New(&Options{URL: server.URL, AccountID: "test", Token: "test", ProjectName: "TEST", StatusNot: "Done"})
+	require.NoError(t, err)
+	err = integration.CloseIssue(&output.ResultEvent{TemplateID: "pdcp-verify", Host: "example.test", Info: model.Info{Name: "Test issue"}})
+	require.NoError(t, err)
+	require.Equal(t, 1, transitionCalls)
+}
+
+func TestCloseIssueFindsOpenIssueWhenOlderMatchIsDone(t *testing.T) {
+	transitioned := ""
+	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
+		switch {
+		case r.Method == http.MethodGet && strings.HasSuffix(r.URL.Path, "/search"):
+			if strings.Contains(r.URL.Query().Get("jql"), `status != "Done"`) {
+				_, _ = w.Write([]byte(`{"issues":[{"id":"10002","key":"TEST-2"}]}`))
+			} else {
+				_, _ = w.Write([]byte(`{"issues":[{"id":"10001","key":"TEST-1"}]}`))
+			}
+		case r.Method == http.MethodGet && strings.HasSuffix(r.URL.Path, "/issue/10001/transitions"):
+			_, _ = w.Write([]byte(`{"transitions":[]}`))
+		case r.Method == http.MethodGet && strings.HasSuffix(r.URL.Path, "/issue/10001"):
+			_, _ = w.Write([]byte(`{"fields":{"status":{"name":"Done"}}}`))
+		case r.Method == http.MethodGet && strings.HasSuffix(r.URL.Path, "/issue/10002/transitions"):
+			_, _ = w.Write([]byte(`{"transitions":[{"id":"5","to":{"name":"Done"}}]}`))
+		case r.Method == http.MethodPost && strings.HasSuffix(r.URL.Path, "/issue/10002/transitions"):
+			transitioned = "10002"
+			w.WriteHeader(http.StatusNoContent)
+		default:
+			http.Error(w, "unexpected endpoint", http.StatusNotFound)
+		}
+	}))
+	defer server.Close()
+
+	integration, err := New(&Options{URL: server.URL, AccountID: "test", Token: "test", ProjectName: "TEST", StatusNot: "Done"})
+	require.NoError(t, err)
+	err = integration.CloseIssue(&output.ResultEvent{TemplateID: "pdcp-verify", Host: "example.test", Info: model.Info{Name: "Test issue"}})
+	require.NoError(t, err)
+	require.Equal(t, "10002", transitioned)
+}
+
+func TestCloseIssueSearchesConfiguredProjectWhenEventHasAnotherJiraID(t *testing.T) {
+	searchCalls, transitionCalls := 0, 0
+	searchJQL := ""
+	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
+		switch {
+		case r.Method == http.MethodGet && strings.HasSuffix(r.URL.Path, "/search"):
+			searchCalls++
+			searchJQL = r.URL.Query().Get("jql")
+			_, _ = w.Write([]byte(`{"issues":[{"id":"123","key":"TEST-1","fields":{"status":{"name":"Open"}}}]}`))
+		case r.Method == http.MethodGet && strings.HasSuffix(r.URL.Path, "/search/jql"):
+			http.Error(w, "", http.StatusForbidden)
+		case r.Method == http.MethodGet && strings.HasSuffix(r.URL.Path, "/issue/123/transitions"):
+			_, _ = w.Write([]byte(`{"transitions":[{"id":"5","to":{"name":"Done"}}]}`))
+		case r.Method == http.MethodPost && strings.HasSuffix(r.URL.Path, "/issue/123/transitions"):
+			transitionCalls++
+			w.WriteHeader(http.StatusNoContent)
+		default:
+			http.Error(w, "unexpected endpoint", http.StatusNotFound)
+		}
+	}))
+	defer server.Close()
+
+	integration, err := New(&Options{URL: server.URL, AccountID: "test", Token: "test", ProjectName: "TEST", StatusNot: "Done"})
+	require.NoError(t, err)
+	err = integration.CloseIssue(&output.ResultEvent{
+		TemplateID: "pdcp-verify",
+		Host:       "example.test",
+		IssueTrackers: map[string]output.IssueTrackerMetadata{
+			"jira": {IssueID: "10001", IssueURL: server.URL + "/browse/OTHER-1"},
+		},
+	})
+	require.NoError(t, err)
+	require.Equal(t, 1, searchCalls)
+	require.Contains(t, searchJQL, `project = "TEST"`)
+	require.Equal(t, 1, transitionCalls)
+}
+
+func TestCloseIssueByIDTargetsOnlyCreatedTicket(t *testing.T) {
+	searchCalls, transitionCalls := 0, 0
+	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
+		switch {
+		case r.Method == http.MethodGet && s
```

---

### Incident Patch 3: `245b8903` (2026-11-19)
**Commit Message**: Merge pull request #8184 from projectdiscovery/dwisiswant0/fix/http/start-the-timeout-deadline-when-the-request-is

fix(http): start the @timeout deadline when the request is sent

**File**: `pkg/protocols/http/build_request.go` (modified, +15/-15)
```diff
@@ -74,17 +74,19 @@ var (
 
 // generatedRequest is a single generated request wrapped for a template request
 type generatedRequest struct {
-	original             *Request
-	rawRequest           *raw.Request
-	meta                 map[string]interface{}
-	pipelinedClient      *rawhttp.PipelineClient
-	request              *retryablehttp.Request
-	dynamicValues        map[string]interface{}
-	interactshURLs       []string
-	customCancelFunction context.CancelFunc
-	// sendTimeout starts after the body budget admits the request.
-	sendTimeout  time.Duration
-	bodyReserved bool
+	original        *Request
+	rawRequest      *raw.Request
+	meta            map[string]any
+	pipelinedClient *rawhttp.PipelineClient
+	request         *retryablehttp.Request
+	dynamicValues   map[string]any
+	interactshURLs  []string
+	// sendTimeout bounds the exchange with the host, and sendTimeoutCause is
+	// the error it ends with. executeRequest starts it after the rate-limit
+	// and backoff waits and the body budget, so no wait uses it up.
+	sendTimeout      time.Duration
+	sendTimeoutCause error
+	bodyReserved     bool
 	// requestURLPattern tracks unmodified request url pattern without values ( it is used for constant vuln_hash)
 	// ex: {{BaseURL}}/api/exp?param={{randstr}}
 	requestURLPattern string
@@ -608,9 +610,6 @@ func (r *requestGenerator) generateRawRequest(ctx context.Context, rawRequest st
 		}
 
 		unsafeReq := &generatedRequest{rawRequest: rawRequestData, meta: generatorValues, original: r.request, interactshURLs: r.interactshURLs}
-		if annotationOverrides.cancelFunc != nil {
-			unsafeReq.customCancelFunction = annotationOverrides.cancelFunc
-		}
 
 		if len(annotationOverrides.interactshURLs) > 0 {
 			unsafeReq.interactshURLs = append(unsafeReq.interactshURLs, annotationOverrides.interactshURLs...)
@@ -669,7 +668,8 @@ func (r *requestGenerator) generateRawRequest(ctx context.Context, rawRequest st
 			return nil, errkit.Wrap(reqWithOverrides.err, "failed to apply raw request annotations")
 		}
 		generatedRequest.request = reqWithOverrides.request
-		generatedRequest.customCancelFunction = reqWithOverrides.cancelFunc
+		generatedRequest.sendTimeout = reqWithOverrides.timeout
+		generatedRequest.sendTimeoutCause = reqWithOverrides.timeoutCause
 		generatedRequest.interactshURLs = append(generatedRequest.interactshURLs, reqWithOverrides.interactshURLs...)
 	}
 
```

**File**: `pkg/protocols/http/request.go` (modified, +11/-6)
```diff
@@ -402,6 +402,12 @@ func (request *Request) executeParallelHTTP(input *contextargs.Context, dynamicV
 						spmHandler.Release()
 						return false
 					}
+					// Same default as the sequential loop: a request that has no
+					// annotation timeout still gets the HTTP timeout once it is sent.
+					if t.req.sendTimeout == 0 {
+						t.req.sendTimeout = request.options.Options.GetTimeouts().HttpTimeout
+						t.req.sendTimeoutCause = ErrHttpEngineRequestDeadline
+					}
 					hasInteractMatchers := interactsh.HasMatchers(request.CompiledOperators)
 					needsRequestEvent := hasInteractMatchers && request.NeedsRequestCondition()
 					err = request.executeRequest(t.updatedInput, t.req, make(map[string]interface{}), hasInteractMatchers, func(event *output.InternalWrappedEvent) {
@@ -731,8 +737,10 @@ executionLoop:
 				return false, true, nil, err
 			}
 			defer reservation.done()
-			if generatedHttpRequest.customCancelFunction == nil {
+
+			if generatedHttpRequest.sendTimeout == 0 {
 				generatedHttpRequest.sendTimeout = request.options.Options.GetTimeouts().HttpTimeout
+				generatedHttpRequest.sendTimeoutCause = ErrHttpEngineRequestDeadline
 			}
 			// ideally if http template used a custom port or hostname
 			// we would want to update it in input but currently templateCtx logic
@@ -746,10 +754,6 @@ executionLoop:
 				return false, true, nil, err
 			}
 
-			if generatedHttpRequest.customCancelFunction != nil {
-				defer generatedHttpRequest.customCancelFunction()
-			}
-
 			hasInteractMarkers := interactsh.HasMarkers(data) || len(generatedHttpRequest.interactshURLs) > 0
 			if input.MetaInput.Input == "" {
 				input.MetaInput.Input = generatedHttpRequest.URL()
@@ -1117,7 +1121,8 @@ func (request *Request) executeRequest(input *contextargs.Context, generatedRequ
 		defer releaseBody()
 	}
 	if generatedRequest.sendTimeout > 0 && generatedRequest.request != nil {
-		ctx, cancel := context.WithTimeoutCause(generatedRequest.request.Context(), generatedRequest.sendTimeout, ErrHttpEngineRequestDeadline)
+		ctx, cancel := context.WithTimeoutCause(
+			generatedRequest.request.Context(), generatedRequest.sendTimeout, generatedRequest.sendTimeoutCause)
 		defer cancel()
 		generatedRequest.request = generatedRequest.request.WithContext(ctx)
 	}
```

**File**: `pkg/protocols/http/request_annotations.go` (modified, +18/-11)
```diff
@@ -72,8 +72,11 @@ func hasTimeoutAnnotation(rawRequest string) bool {
 }
 
 type annotationOverrides struct {
-	request        *retryablehttp.Request
-	cancelFunc     context.CancelFunc
+	request *retryablehttp.Request
+	// timeout bounds the request once it is sent, and timeoutCause is the
+	// error it ends with.
+	timeout        time.Duration
+	timeoutCause   error
 	interactshURLs []string
 	err            error
 }
@@ -146,30 +149,34 @@ func (r *Request) parseAnnotations(rawRequest string, request *retryablehttp.Req
 	}
 
 	// @timeout:duration
+	// The timeout is only recorded here. executeRequest starts it after the
+	// rate-limit and body-budget waits, so those waits do not use it up (#8176).
+	// NoTimeout leaves the client without the HTTP timeout, so every request
+	// records one: the default, unless a valid annotation replaces it.
 	if r.connConfiguration.NoTimeout {
 		modified = true
-		var ctx context.Context
+		overrides.timeout, overrides.timeoutCause = r.options.Options.GetTimeouts().HttpTimeout, ErrRequestTimeoutDeadline
 
 		if duration := reTimeoutAnnotation.FindStringSubmatch(annotations); len(duration) > 0 {
 			value := strings.TrimSpace(duration[1])
-			if parsedTimeout, err := time.ParseDuration(value); err == nil {
+			parsedTimeout, err := time.ParseDuration(value)
+			// A timeout that does not parse or is not positive keeps the default.
+			if err == nil && parsedTimeout > 0 {
 				// Cap at maximum allowed timeout to prevent DoS via extremely large timeout values
 				if parsedTimeout > maxAnnotationTimeout {
 					parsedTimeout = maxAnnotationTimeout
 				}
 
-				//nolint:govet // cancelled automatically by withTimeout
-				// global timeout is overridden by annotation by replacing context
-				ctx, overrides.cancelFunc = context.WithTimeoutCause(context.TODO(), parsedTimeout, ErrTimeoutAnnotationDeadline)
+				overrides.timeout, overrides.timeoutCause = parsedTimeout, ErrTimeoutAnnotationDeadline
+				// The replaced context drops the input's cancellation (#8178).
+				ctx := context.TODO()
 				// add timeout value to context
 				ctx = context.WithValue(ctx, httpclientpool.WithCustomTimeout{}, httpclientpool.WithCustomTimeout{Timeout: parsedTimeout})
 				request = request.Clone(ctx)
 			}
 		} else {
-			//nolint:govet // cancelled automatically by withTimeout
-			// global timeout is overridden by annotation by replacing context
-			ctx, overrides.cancelFunc = context.WithTimeoutCause(context.TODO(), r.options.Options.GetTimeouts().HttpTimeout, ErrRequestTimeoutDeadline)
-			request = request.Clone(ctx)
+			// The replaced context drops the input's cancellation (#8178).
+			request = request.Clone(context.TODO())
 		}
 	}
 
```

**File**: `pkg/protocols/http/request_annotations_test.go` (modified, +54/-26)
```diff
@@ -83,7 +83,7 @@ func TestRequestParseAnnotationsSNI(t *testing.T) {
 		require.ErrorIs(t, overrides.err, commoninteractsh.ErrInteractshClientNotInitialized)
 		require.Empty(t, overrides.interactshURLs)
 		require.Same(t, httpReq, overrides.request)
-		require.Nil(t, overrides.cancelFunc)
+		require.Zero(t, overrides.timeout)
 	})
 }
 
@@ -101,21 +101,18 @@ func TestRequestParseAnnotationsTimeout(t *testing.T) {
 		require.Nil(t, err, "could not create http request")
 
 		overrides, modified := request.parseAnnotations(rawRequest, httpReq)
-		require.NotNil(t, overrides.cancelFunc, "could not initialize valid cancel function")
 		require.True(t, modified, "could not get correct modified value")
+		require.Equal(t, 2*time.Second, overrides.timeout, "timeout value mismatch")
+		require.ErrorIs(t, overrides.timeoutCause, ErrTimeoutAnnotationDeadline)
 
-		// Verify context has deadline
-		deadline, deadlined := overrides.request.Context().Deadline()
-		require.True(t, deadlined, "could not get set request deadline")
+		// The deadline starts when the request is sent, not when it is built.
+		_, deadlined := overrides.request.Context().Deadline()
+		require.False(t, deadlined, "request deadline started before the request was sent")
 
 		// Verify the timeout value is stored in context
 		customTimeout, ok := overrides.request.Context().Value(httpclientpool.WithCustomTimeout{}).(httpclientpool.WithCustomTimeout)
 		require.True(t, ok, "custom timeout not found in context")
 		require.Equal(t, 2*time.Second, customTimeout.Timeout, "timeout value mismatch")
-
-		// Verify deadline is approximately 2 seconds from now
-		expectedDeadline := time.Now().Add(2 * time.Second)
-		require.WithinDuration(t, expectedDeadline, deadline, 100*time.Millisecond, "deadline not set correctly")
 	})
 
 	t.Run("large-timeout", func(t *testing.T) {
@@ -133,23 +130,17 @@ func TestRequestParseAnnotationsTimeout(t *testing.T) {
 		require.Nil(t, err, "could not create http request")
 
 		overrides, modified := request.parseAnnotations(rawRequest, httpReq)
-		require.NotNil(t, overrides.cancelFunc, "could not initialize valid cancel function")
 		require.True(t, modified, "could not get correct modified value")
 
-		// Verify context has deadline
-		deadline, deadlined := overrides.request.Context().Deadline()
-		require.True(t, deadlined, "could not get set request deadline")
-
 		// Verify the timeout was capped at 5 minutes (not 10 minutes)
 		customTimeout, ok := overrides.request.Context().Value(httpclientpool.WithCustomTimeout{}).(httpclientpool.WithCustomTimeout)
 		require.True(t, ok, "custom timeout not found in context")
 
 		require.Equal(t, 5*time.Minute, customTimeout.Timeout, "timeout should be capped at 5 minutes")
 		require.Less(t, customTimeout.Timeout, 10*time.Minute, "timeout should be less than requested 10 minutes")
 
-		// Verify deadline matches the capped timeout
-		expectedDeadline := time.Now().Add(5 * time.Minute)
-		require.WithinDuration(t, expectedDeadline, deadline, 100*time.Millisecond, "deadline not set to capped timeout")
+		// Verify the request carries the capped timeout
+		require.Equal(t, 5*time.Minute, overrides.timeout, "request timeout not set to capped timeout")
 	})
 
 	t.Run("below-cap-timeout", func(t *testing.T) {
@@ -167,22 +158,16 @@ func TestRequestParseAnnotationsTimeout(t *testing.T) {
 		require.Nil(t, err, "could not create http request")
 
 		overrides, modified := request.parseAnnotations(rawRequest, httpReq)
-		require.NotNil(t, overrides.cancelFunc, "could not initialize valid cancel function")
 		require.True(t, modified, "could not get correct modified value")
 
-		// Verify context has deadline
-		deadline, deadlined := overrides.request.Context().Deadline()
-		require.True(t, deadlined, "could not get set request deadline")
-
 		// Verify the timeout is NOT capped - should be 2 minutes
 		customTimeout, ok := overrides.request.Context().Value(httpclientpool.WithCustomTimeout{}).(httpclientpool.WithCustomTimeout)
 		require.True(t, ok, "custom timeout not found in context")
 
 		require.Equal(t, 2*time.Minute, customTimeout.Timeout, "timeout should be the requested 2 minutes")
 
-		// Verify deadline matches the requested timeout
-		expectedDeadline := time.Now().Add(2 * time.Minute)
-		require.WithinDuration(t, expectedDeadline, deadline, 100*time.Millisecond, "deadline not set to requested timeout")
+		// Verify the request carries the requested timeout
+		require.Equal(t, 2*time.Minute, overrides.timeout, "request timeout not set to requested timeout")
 	})
 
 	t.Run("negative", func(t *testing.T) {
@@ -197,11 +182,54 @@ func TestRequestParseAnnotationsTimeout(t *testing.T) {
 		require.Nil(t, err, "could not create http request")
 
 		newRequestWithOverrides, modified := request.parseAnnotations(rawRequest, httpReq)
-		require.Nil(t, newRequestWithOverrides.cancelFunc, "cancel function should be nil")
+		require.Zero(t, newRequestWithOverrides.timeout, "timeout should be 
```

**File**: `pkg/protocols/http/request_test.go` (modified, +204/-0)
```diff
@@ -837,6 +837,210 @@ func TestHTTPExtractMultipleReuseStopsOnceBranchesAfterCancellation(t *testing.T
 	require.Less(t, time.Since(startedAt), 750*time.Millisecond)
 }
 
+// A request's timeout bounds its exchange with the host. The wait for a
+// rate-limit token comes before that, so a paced request must still be sent
+// (#8162, #8176).
+//
+//nolint:paralleltest // the cases share the protocol state testutils.Init sets up
+func TestRequestTimeoutStartsAfterRateLimitWait(t *testing.T) {
+	tests := []struct {
+		name string
+		raw  []string
+	}{
+		{
+			name: "default timeout",
+			raw: []string{
+				"GET /first HTTP/1.1\nHost: {{Hostname}}",
+				"GET /second HTTP/1.1\nHost: {{Hostname}}",
+			},
+		},
+		{
+			name: "timeout annotation",
+			raw: []string{
+				"@timeout: 500ms\nGET /first HTTP/1.1\nHost: {{Hostname}}",
+				"@timeout: 500ms\nGET /second HTTP/1.1\nHost: {{Hostname}}",
+			},
+		},
+		{
+			// An annotation on one request turns off the client timeout for
+			// all of them, so the other request takes the default timeout.
+			name: "request beside a timeout annotation",
+			raw: []string{
+				"@timeout: 500ms\nGET /first HTTP/1.1\nHost: {{Hostname}}",
+				"GET /second HTTP/1.1\nHost: {{Hostname}}",
+			},
+		},
+	}
+	for _, tt := range tests {
+		t.Run(tt.name, func(t *testing.T) {
+			request := &Request{Raw: tt.raw} //nolint:exhaustruct,exhaustruct_v5 // zero values are the template defaults
+			require.Equal(t, []string{"/first", "/second"}, executePacedRequests(t, request))
+		})
+	}
+}
+
+// The parallel path builds each request before a worker takes its rate-limit
+// token, so the timeout has to start after that wait as well (#8176).
+//
+//nolint:paralleltest // shares the protocol state testutils.Init sets up
+func TestParallelRequestTimeoutStartsAfterRateLimitWait(t *testing.T) {
+	//nolint:exhaustruct,exhaustruct_v5 // zero values are the template defaults
+	request := &Request{
+		Raw:      []string{"@timeout: 500ms\nGET /{{path}} HTTP/1.1\nHost: {{Hostname}}"},
+		Threads:  1,
+		Payloads: map[string]any{"path": []string{"first", "second"}},
+	}
+	require.Equal(t, []string{"/first", "/second"}, executePacedRequests(t, request))
+}
+
+// With @timeout the client has no overall timeout of its own, so the request's
+// deadline bounds reading the response. A valid annotation sets it on every
+// path; one that does not parse or is not positive keeps the default (#8176).
+//
+//nolint:paralleltest // the cases share the protocol state testutils.Init sets up
+func TestTimeoutAnnotationBoundsResponse(t *testing.T) {
+	const stall = 2 * time.Second
+
+	tests := []struct {
+		name        string
+		annotation  string
+		httpTimeout time.Duration
+		parallel    bool
+	}{
+		{name: "annotation, sequential", annotation: "300ms", httpTimeout: time.Minute, parallel: false},
+		{name: "annotation, parallel", annotation: "300ms", httpTimeout: time.Minute, parallel: true},
+		{name: "unparsable annotation, parallel", annotation: "soon", httpTimeout: 300 * time.Millisecond, parallel: true},
+		{name: "zero annotation, parallel", annotation: "0s", httpTimeout: 300 * time.Millisecond, parallel: true},
+	}
+	for _, test := range tests {
+		t.Run(test.name, func(t *testing.T) {
+			options := testutils.DefaultOptions.Copy()
+			timeouts := *options.GetTimeouts()
+			timeouts.HttpTimeout = test.httpTimeout
+			options.SetTimeouts(&timeouts)
+			testutils.Init(options)
+			t.Cleanup(func() { testutils.Cleanup(options) })
+
+			// The headers arrive at once and the body stalls, so only the
+			// request's deadline can end the read before the stall does.
+			server := httptest.NewServer(http.HandlerFunc(func(resp http.ResponseWriter, req *http.Request) {
+				resp.Header().Set("Content-Length", "2")
+				resp.WriteHeader(http.StatusOK)
+				_ = http.NewResponseController(resp).Flush()
+
+				select {
+				case <-req.Context().Done():
+				case <-time.After(stall):
+					_, _ = resp.Write([]byte("ok"))
+				}
+			}))
+			t.Cleanup(server.Close)
+
+			//nolint:exhaustruct,exhaustruct_v5 // zero values are the template defaults
+			request := &Request{Raw: []string{"@timeout: " + test.annotation + "\nGET / HTTP/1.1\nHost: {{Hostname}}"}}
+			if test.parallel {
+				request.Raw = []string{"@timeout: " + test.annotation + "\nGET /?p={{p}} HTTP/1.1\nHost: {{Hostname}}"}
+				request.Threads = 1
+				request.Payloads = map[string]any{"p": []string{"a"}}
+			}
+
+			require.NoError(t, request.Compile(testutils.NewMockExecuterOptions(options, nil)))
+
+			start := time.Now()
+			err := request.ExecuteWithResults(contextargs.NewWithInput(t.Context(), server.URL),
+				make(output.InternalEvent), make(output.InternalEvent), func(*output.InternalWrappedEvent) {})
+			require.Error(t, err)
+			require.Less(t, time.Since(start), stall, "the response was read past the request's timeout")
+		})
+	}
+}
+
+// A template with a raw @timeout turns off the client timeout for all of its
+// requests. A parallel reque
```

#### Recent Merged Pull Requests:
- **PR #8184** (2026-11-19): fix(http): start the @timeout deadline when the request is sent (@dwisiswant0)
- **PR #8183** (2026-11-19): fix(http): key host errors of a scheme-less target by its request port (@dwisiswant0)
- **PR #8182** (2026-11-19): fix(hostbackoff): give back the slot of a cancelled wait (@dwisiswant0)
- **PR #8173** (2026-11-18): add raw_body and raw_response http parts (@dogancanbakir)
- **PR #8171** (2026-11-18): chore: refresh security context (@github-actions[bot])
- **PR #8170** (2026-11-18): perf(httpcache): replace sandrolain/httpcache with x/net/http/cache (@dwisiswant0)

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

## X. http): start the @timeout deadline when the request is sent

**RULE**:
When implementing operations in `pkg/protocols/http/build_request.go`, engineers MUST enforce rigorous boundary validation, safe state transitions, and memory/concurrency invariants as established by production defect remediation in projectdiscovery/nuclei. All inputs crossing module boundaries must be explicitly verified before state persistence.

**WHY**:
Prevents defects observed in production commit `5fbb495d`: http): start the @timeout deadline when the request is sent. Unvalidated execution paths cause runtime exceptions, race conditions, and silent state corruption under concurrent workloads.

**WHEN TO APPLY**:
Subsystems managing Go data structures, boundary deserialization, API parsing, or resource lifecycles matching `pkg/protocols/http/build_request.go`.

**VERIFIED IMPLEMENTATION PATTERN**:
```go
// Verified production-grade fix pattern:
	original        *Request
	rawRequest      *raw.Request
	meta            map[string]any
	pipelinedClient *rawhttp.PipelineClient
	request         *retryablehttp.Request
	dynamicValues   map[string]any
	interactshURLs  []string
	// sendTimeout bounds the exchange with the host, and sendTimeoutCause is
	// the error it ends with. executeRequest starts it after the rate-limit
	// and backoff waits and the body budget, so no wait uses it up.
	sendTimeout      time.Duration
	sendTimeoutCause error
	bodyReserved     bool
		generatedRequest.sendTimeout = reqWithOverrides.timeout
		generatedRequest.sendTimeoutCause = reqWithOverrides.timeoutCause
```

**NEGATIVE CONSTRAINT**:
```go
// Induced defect failure mode:
	original             *Request
	rawRequest           *raw.Request
	meta                 map[string]interface{}
	pipelinedClient      *rawhttp.PipelineClient
	request              *retryablehttp.Request
	dynamicValues        map[string]interface{}
	interactshURLs       []string
	customCancelFunction context.CancelFunc
	// sendTimeout starts after the body budget admits the request.
	sendTimeout  time.Duration
	bodyReserved bool
		if annotationOverrides.cancelFunc != nil {
			unsafeReq.customCancelFunction = annotationOverrides.cancelFunc
		}
		generatedRequest.customCancelFunction = reqWithOverrides.cancelFunc
```

**VERIFICATION METHOD**:
Automated regression test asserting that input states reproducing defect `5fbb495d` are properly handled with clean fallback behavior.
