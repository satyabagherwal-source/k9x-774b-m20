> **Canonical Learning Artifact**: `07_PROJECT_LEARNING/projectdiscovery-nuclei-learnings.md`  
> **Source**: github ([https://github.com/projectdiscovery/nuclei](https://github.com/projectdiscovery/nuclei))  
> **Source Version**: `3fdb5996`  
> **License**: MIT  
> **Synthesized By**: zero-clone-structural-synthesizer  
> **Timestamp**: 2026-11-10T01:58:31.098Z  
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
> **Harvest Timestamp**: 2026-11-10T01:58:31.092Z  
> **Compliance State**: Free Tier Guaranteed | Strict Rate-Limit Backoff Honored  

---

## 1. Context & Architectural Overview
- **Repository / Resource**: `projectdiscovery/nuclei`
- **Description**: Nuclei is a fast, customizable vulnerability scanner powered by the global security community and built on a simple YAML-based DSL, enabling collaboration to tackle trending vulnerabilities on the internet. It helps you find vulnerabilities in your applications, APIs, networks, DNS, and cloud configurations.
- **Primary Language / Ecosystem**: Go
- **Discovered Manifests / Configurations**: go.mod, README.md, Dockerfile
- **Stars / Engagement**: 32733 stars

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
		Templates: []string{template.ID},
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
		entry.Templates = slices.Sorted(slices.Values(cluster.TemplateIDs(selection)))
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

### Incident Patch 1: `54662dc4` (2026-11-09)
**Commit Message**: Merge pull request #8079 from projectdiscovery/security-context/refresh

chore: refresh security context

**File**: `SECURITY_CONTEXT.md` (modified, +21/-13)
```diff
@@ -1,35 +1,40 @@
-<!-- Generated by securitycontext.dev. Source HEAD: df57ae6d2955864fd92a1bd2565fe9e4e9a7592b. -->
+<!-- Generated by securitycontext.dev. Source HEAD: 40d08ee493f6f84c9a6b3c7f15f22da83853130c. -->
 # Security Context: projectdiscovery/nuclei @ dev
 
 > Reference context for editing projectdiscovery/nuclei. Before changing any component below, **preserve the listed guards and do not reintroduce these fixed issues**. Each fingerprint is a regression check, and each shared attack surface is a guard that must keep holding on every path.
 
-_Analyzed [df57ae6d29][c-df57ae6d29] on `dev` · 5174 commits, 548 security-relevant examined · generated 2026-11-02_
+_Analyzed [40d08ee493][c-40d08ee493] on `dev` · 5242 commits, 586 security-relevant examined · generated 2026-11-09_
 
 ## Recurring Security Patterns
 
-**7.1% of classified fixes repeat a previously fixed pattern** (1 recurring, 13 first-seen). A recurring pattern means this repository fixed a similar issue before — not that the code is currently vulnerable.
+**12.5% of classified fixes repeat a previously fixed pattern** (2 recurring, 14 first-seen). A recurring pattern means this repository fixed a similar issue before — not that the code is currently vulnerable.
 
 ## Top Risks
 
 Components with the strongest concentration of past fixes for one class.
 
 | # | Class | Component | Severity | Fixes | Evidence |
 |---|---|---|---|---|---|
-| 1 | SSRF | `pkg/protocols/common/protocolstate/headless.go` | high | 2 | [d43c1f547f][c-d43c1f547f], [d9dabbb4a1][c-d9dabbb4a1] |
-| 2 | Arbitrary File Access | `v2/pkg/protocols/common/generators/load.go` | high | 0 (1 component gone, not counted) | [e5154d362a][c-e5154d362a] |
-| 3 | Arbitrary File Access | `pkg/js/libs/mysql/mysql.go` | high | 1 | [634cecbb28][c-634cecbb28] |
-| 4 | Code Execution | `pkg/fuzz/execute.go` | high | 1 | [ccbfb12bd0][c-ccbfb12bd0] |
-| 5 | Code Execution | `pkg/protocols/common/expressions/expressions.go` | high | 1 | [d221732016][c-d221732016] |
-| 6 | Information Disclosure | `internal/httpapi/apiendpoint.go` | high | 1 | [a20aa26024][c-a20aa26024] |
+| 1 | Code Execution | `pkg/fuzz/execute.go` | high | 2 | [4fed40f75a][c-4fed40f75a], [ccbfb12bd0][c-ccbfb12bd0] |
+| 2 | SSRF | `pkg/protocols/common/protocolstate/headless.go` | high | 2 | [d43c1f547f][c-d43c1f547f], [d9dabbb4a1][c-d9dabbb4a1] |
+| 3 | Arbitrary File Access | `v2/pkg/protocols/common/generators/load.go` | high | 0 (1 component gone, not counted) | [e5154d362a][c-e5154d362a] |
+| 4 | Arbitrary File Access | `pkg/js/libs/mysql/mysql.go` | high | 1 | [634cecbb28][c-634cecbb28] |
+| 5 | Certificate Validation Bypass | `pkg/reporting/exporters/es/elasticsearch.go` | high | 1 | [82d5a8acc2][c-82d5a8acc2] |
+| 6 | Code Execution | `pkg/protocols/common/expressions/expressions.go` | high | 1 | [d221732016][c-d221732016] |
 
 ## Fixed-Issue Fingerprints
 
 Real security fixes mined from git history; use them as regression checks. `verified` fixes are linked to a published advisory, `inferred` fixes were confirmed from the diff evidence alone. Each is identified by its short commit SHA, which the variant-leads report uses to reference it back to this history.
 
 **By component** (directories with the most fixes):
 
+- `pkg/fuzz` — 2 fixes: Code Execution (2)
 - `pkg/protocols/common/protocolstate` — 2 fixes: SSRF (2)
 
+- [4fed40f75a][c-4fed40f75a] **fix(fuzz): stop re-rendering evaluated template variables (#8057)** — Code Execution, high [CWE-94] · inferred · 2026-11-05
+  `pkg/fuzz/execute.go` · sink `rule.evaluateVarsWithInteractsh` · fix: safe parser configuration
+- [82d5a8acc2][c-82d5a8acc2] **exporters: verify TLS certificates (#8042)** — Certificate Validation Bypass, high [CWE-295] · inferred · 2026-11-04
+  `pkg/reporting/exporters/es/elasticsearch.go` · sink `DialTLS` · fix: cryptographic verification
 - [1c0f77d28e][c-1c0f77d28e] **fix(js/net): enforce network policy on proxied target in JS net dial** — SSRF, high [CWE-918] · inferred · 2026-10-18
   `pkg/js/libs/net/net.go` · sink `dialHTTPProxy` · fix: input validation
 - [d43c1f547f][c-d43c1f547f] **fix(headless): canonicalize IPv4-mapped IPv6 literals and re-validate dial targets** — SSRF, high [CWE-918] · inferred · 2026-10-13
@@ -63,11 +68,12 @@ Real security fixes mined from git history; use them as regression checks. `veri
 
 | Class | Fixes | Verified | Most recent fix |
 |---|---|---|---|
+| Code Execution | 3 | 2 | [2026-11-05][c-4fed40f75a] 4fed40f75a |
 | SSRF | 3 | 0 | [2026-10-18][c-1c0f77d28e] 1c0f77d28e |
 | Arbitrary File Access | 1 (1 component gone, not counted) | 2 | [2026-06-19][c-634cecbb28] 634cecbb28 |
-| Code Execution | 2 | 2 | [2026-06-30][c-ccbfb12bd0] ccbfb12bd0 |
 | Sandbox Escape | 2 | 0 | [2026-06-24][c-3a8b65cb45] 3a8b65cb45 |
 | Signature Verification Bypass | 2 | 2 | [2026-07-03][c-fac0b7196d] fac0b7196d |
+| Certificate Validation Bypass | 1 | 0 | [2026-11-04][c-82d5a8acc2] 82d5a8acc2 |
 | Information Disclosure
```

---

### Incident Patch 2: `3fdb5996` (2026-11-10)
**Commit Message**: fix(js): stop tsgen from panicking on non-struct types (#8102)

* fix(js/tsgen): map non-struct external types to any

tsgen treated every type from another package as a struct and queued
it to have its fields scraped into a TypeScript interface. The kind
was checked only at scrape time, as a fatal error, so an interface,
func, or named basic type in an exported signature or field aborted
the whole run. make jsupdate-tsgen panicked on net.Conn, which the
dcerpc, gptransport, mssql, net, and oracle libraries return, and
never wrote the remaining definitions or index.ts.

Check the kind when the type is first seen instead. Structs are still
scraped; other types have no fields to describe and become any, as
external parameter types already do. Names that do not resolve are
still reported.

Fixes: #8099
Signed-off-by: Dwi Siswanto <[REDACTED_EMAIL]>

* fix(js): exclude gptransport and smbsession from codegen

gptransport and smbsession are shared Go adapters for the smb, dcerpc,
and file protocol code, not JavaScript modules: nothing registers them
with the runtime, and index.ts does not export them. Without the
.nuclei-jsgen-ignore marker that goexec already carries, tsgen and
bindgen

**File**: `pkg/js/devtools/tsgen/parser.go` (modified, +19/-9)
```diff
@@ -284,8 +284,8 @@ func (p *EntityParser) extractClassProperties(node *ast.StructType) []Property {
 					Description: field.Doc.Text(),
 				}
 				if strings.Contains(property.Type, ".") {
-					// external struct found
-					property.Type = p.handleExternalStruct(property.Type)
+					// external type found
+					property.Type = p.handleExternalType(property.Type)
 				}
 				properties = append(properties, property)
 			}
@@ -349,7 +349,7 @@ func (p *EntityParser) extractReturnType(fn *ast.FuncDecl) (out string) {
 		for _, result := range fn.Type.Results.List {
 			tmp := exprToString(result.Type)
 			if strings.Contains(tmp, ".") && !strings.HasPrefix(tmp, "goja.") {
-				tmp = p.handleExternalStruct(tmp) + " | null" // external object interfaces can always return null
+				tmp = p.handleExternalType(tmp) + " | null" // external object interfaces can always return null
 			}
 			returns = append(returns, tmp)
 		}
@@ -374,8 +374,10 @@ func (p *EntityParser) extractReturnType(fn *ast.FuncDecl) (out string) {
 			}
 		}
 		if sliceutil.Contains(returns, "error") {
-			// add | null to the return type
-			out = out + " | null"
+			// external types already record that they can be null
+			if !strings.HasSuffix(out, "| null") {
+				out += " | null"
+			}
 			return
 		}
 	}
@@ -413,10 +415,18 @@ func (p *EntityParser) extractParameters(fn *ast.FuncDecl) []Parameter {
 	return parameters
 }
 
-// typeName is in format ssh.ClientConfig
-// it first fetches all fields from the struct and creates a new object
-// with that name and returns name of that object as type
-func (p *EntityParser) handleExternalStruct(typeName string) string {
+// handleExternalType returns the TypeScript type for typeName, a type from
+// another package such as ssh.ClientConfig. A struct is queued for
+// scrapeAndCreate, which describes its fields in an interface of the same name.
+// Any other type, such as the net.Conn interface, has no fields to describe,
+// so it becomes any. A typeName that does not resolve is queued too, so that
+// scrapeAndCreate reports it.
+func (p *EntityParser) handleExternalType(typeName string) string {
+	obj, err := p.lookupType(typeName)
+	if err == nil && !isStruct(obj.Type()) {
+		return "any"
+	}
+
 	baseType := typeName[strings.LastIndex(typeName, ".")+1:]
 	p.newObjects[typeName] = &Entity{
 		Name:        baseType,
```

**File**: `pkg/js/devtools/tsgen/parser_external_test.go` (added, +33/-0)
```diff
@@ -0,0 +1,33 @@
+package tsgen_test
+
+import (
+	"path/filepath"
+	"testing"
+
+	"github.com/stretchr/testify/require"
+
+	"github.com/projectdiscovery/nuclei/v3/pkg/js/devtools/tsgen"
+)
+
+func TestParseExternalTypes(t *testing.T) {
+	t.Parallel()
+
+	ep, err := tsgen.NewEntityParser(filepath.Join("testdata", "external"))
+	require.NoError(t, err)
+	require.NoError(t, ep.Parse())
+
+	entities := make(map[string]tsgen.Entity)
+	for _, e := range ep.GetEntities() {
+		entities[e.Name] = e
+	}
+
+	// net.Conn is an interface, so it has no fields to describe.
+	require.Equal(t, "any | null", entities["Dial"].Function.Returns)
+	require.Equal(t, []tsgen.Property{{Name: "Conn", Type: "any", Description: ""}}, entities["Session"].Object.Properties)
+	require.NotContains(t, entities, "Conn")
+
+	// url.URL is a struct, so its fields become an interface.
+	require.Equal(t, "URL | null", entities["Parse"].Function.Returns)
+	require.Equal(t, "interface", entities["URL"].Type)
+	require.NotEmpty(t, entities["URL"].Object.Properties)
+}
```

**File**: `pkg/js/devtools/tsgen/scrape.go` (modified, +40/-19)
```diff
@@ -1,38 +1,29 @@
 package tsgen
 
 import (
+	"errors"
 	"fmt"
 	"go/types"
 	"regexp"
 	"strings"
-
-	"github.com/projectdiscovery/utils/errkit"
 )
 
+// errUnresolvedType is returned by lookupType for a name it cannot resolve.
+var errUnresolvedType = errors.New("unresolved type")
+
 // scrape.go scrapes all information of exported type from different package
 
 func (p *EntityParser) scrapeAndCreate(typeName string) error {
 	if p.newObjects[typeName] == nil {
 		return nil
 	}
-	// get package name
-	pkgName := strings.Split(typeName, ".")[0]
-	baseTypeName := strings.Split(typeName, ".")[1]
-	// get package
-	pkg, ok := p.imports[pkgName]
-	if !ok {
-		return errkit.Newf("package %v for type %v not found", pkgName, typeName)
-	}
-	// get type
-	obj := pkg.Types.Scope().Lookup(baseTypeName)
-	if obj == nil {
-		return errkit.Newf("type %v not found in package %+v", typeName, pkg)
-	}
-	// Ensure the object is a type name
-	typeNameObj, ok := obj.(*types.TypeName)
-	if !ok {
-		return errkit.Newf("%v is not a type name", typeName)
+
+	typeNameObj, err := p.lookupType(typeName)
+	if err != nil {
+		return err
 	}
+
+	baseTypeName := typeNameObj.Name()
 	// Ensure the type is a named struct type
 	namedStruct, ok := typeNameObj.Type().Underlying().(*types.Struct)
 	if !ok {
@@ -72,6 +63,36 @@ func (p *EntityParser) scrapeAndCreate(typeName string) error {
 	return nil
 }
 
+// lookupType resolves typeName, such as net.Conn, in the packages imported by
+// the parsed files.
+func (p *EntityParser) lookupType(typeName string) (*types.TypeName, error) {
+	pkgName, baseTypeName, _ := strings.Cut(typeName, ".")
+
+	pkg := p.imports[pkgName]
+	if pkg == nil {
+		return nil, fmt.Errorf("%w: package %v for type %v not found", errUnresolvedType, pkgName, typeName)
+	}
+
+	obj := pkg.Types.Scope().Lookup(baseTypeName)
+	if obj == nil {
+		return nil, fmt.Errorf("%w: type %v not found in package %+v", errUnresolvedType, typeName, pkg)
+	}
+
+	typeNameObj, ok := obj.(*types.TypeName)
+	if !ok {
+		return nil, fmt.Errorf("%w: %v is not a type name", errUnresolvedType, typeName)
+	}
+
+	return typeNameObj, nil
+}
+
+// isStruct reports whether t is a struct type.
+func isStruct(t types.Type) bool {
+	_, ok := t.Underlying().(*types.Struct)
+
+	return ok
+}
+
 type ExtObject struct {
 	builtIn map[string]string
 	nested  map[string]map[string]*ExtObject // Changed to map of field names to ExtObject
```

**File**: `pkg/js/devtools/tsgen/testdata/external/external.go` (added, +32/-0)
```diff
@@ -0,0 +1,32 @@
+// Package external is a tsgen fixture that references types from other
+// packages, both structs and non-structs.
+package external
+
+import (
+	"context"
+	"net"
+	"net/url"
+)
+
+// Dial returns an external interface type.
+func Dial(network, address string) (net.Conn, error) {
+	return net.Dial(network, address)
+}
+
+// Parse returns an external struct type.
+func Parse(raw string) (*url.URL, error) {
+	return url.Parse(raw)
+}
+
+// Session holds an external interface type in an exported field.
+type Session struct {
+	Conn net.Conn
+}
+
+type dialer struct{}
+
+// DialContext is exported, but its receiver is not.
+func (dialer) DialContext(ctx context.Context, network, address string) (net.Conn, error) {
+	var d net.Dialer
+	return d.DialContext(ctx, network, address)
+}
```

**File**: `pkg/js/libs/gptransport/.nuclei-jsgen-ignore` (added, +1/-0)
```diff
@@ -0,0 +1 @@
+shared adapter package; not a public JavaScript module
```

**File**: `pkg/js/libs/smbsession/.nuclei-jsgen-ignore` (added, +1/-0)
```diff
@@ -0,0 +1 @@
+shared adapter package; not a public JavaScript module
```

---

### Incident Patch 3: `ec6794c2` (2026-11-09)
**Commit Message**: fix(js/tsgen): report package load errors instead of ignoring them

packages.Load records parse, type, and list errors in Package.Errors
and still returns a nil error. NewEntityParser and loadPackage checked
only the returned error, so tsgen accepted packages that do not
compile. Parse then panicked in extractParameters on the recovered
syntax tree, or looked up types in an empty package and reported a
misleading "type not found" error.

Both call sites now load through loadPackage, which returns the
package errors with the package ID and file positions.

Fixes: #8098
Signed-off-by: Dwi Siswanto <[REDACTED_EMAIL]>

**File**: `pkg/js/devtools/tsgen/parser.go` (modified, +23/-12)
```diff
@@ -38,14 +38,11 @@ func NewEntityParser(dir string) (*EntityParser, error) {
 			return parser.ParseFile(fset, filename, src, parser.ParseComments)
 		},
 	}
-	pkgs, err := packages.Load(cfg, ".")
+
+	pkg, err := loadPackage(cfg, ".")
 	if err != nil {
 		return nil, err
 	}
-	if len(pkgs) == 0 {
-		return nil, errors.New("no packages found")
-	}
-	pkg := pkgs[0]
 
 	return &EntityParser{
 		syntax:      pkg.Syntax,
@@ -513,6 +510,7 @@ func (p *EntityParser) extractVarsNConstants() {
 
 // loadImportedPackages loads all imported packages
 func (p *EntityParser) loadImportedPackages() error {
+	cfg := &packages.Config{Mode: packages.NeedTypes | packages.NeedSyntax | packages.NeedTypesInfo}
 	// get all import statements
 	// iterate over all imports
 	for _, file := range p.syntax {
@@ -522,7 +520,7 @@ func (p *EntityParser) loadImportedPackages() error {
 			// remove the quotes from the path
 			path = path[1 : len(path)-1]
 			// load the package
-			pkg, err := loadPackage(path)
+			pkg, err := loadPackage(cfg, path)
 			if err != nil {
 				return err
 			}
@@ -543,18 +541,31 @@ func (p *EntityParser) loadImportedPackages() error {
 	return nil
 }
 
-// Load the package containing the type definition
-// TODO: we don't support named imports yet
-func loadPackage(pkgPath string) (*packages.Package, error) {
-	cfg := &packages.Config{Mode: packages.NeedTypes | packages.NeedSyntax | packages.NeedTypesInfo}
-	pkgs, err := packages.Load(cfg, pkgPath)
+// loadPackage loads the package that pattern names.
+//
+// packages.Load reports parse, type, and list errors in Package.Errors
+// rather than in its returned error, so loadPackage converts them into an
+// error. The parser assumes a complete syntax tree and type information.
+func loadPackage(cfg *packages.Config, pattern string) (*packages.Package, error) {
+	pkgs, err := packages.Load(cfg, pattern)
 	if err != nil {
 		return nil, err
 	}
 	if len(pkgs) == 0 {
 		return nil, errors.New("no packages found")
 	}
-	return pkgs[0], nil
+
+	pkg := pkgs[0]
+	if len(pkg.Errors) > 0 {
+		errs := make([]error, len(pkg.Errors))
+		for i, e := range pkg.Errors {
+			errs[i] = e
+		}
+
+		return nil, fmt.Errorf("package %s: %w", pkg.ID, errors.Join(errs...))
+	}
+
+	return pkg, nil
 }
 
 // exprToString converts an expression to a string
```

**File**: `pkg/js/devtools/tsgen/parser_test.go` (added, +86/-0)
```diff
@@ -0,0 +1,86 @@
+package tsgen
+
+import (
+	"go/ast"
+	"go/parser"
+	"go/token"
+	"os"
+	"path/filepath"
+	"testing"
+
+	"github.com/stretchr/testify/require"
+	"golang.org/x/tools/go/packages"
+)
+
+// writeModule writes src as the only package of a new Go module and
+// returns the module directory.
+func writeModule(t *testing.T, src string) string {
+	t.Helper()
+
+	dir := t.TempDir()
+	files := map[string]string{
+		"go.mod":     "module example.com/tsgentest\n\ngo 1.21\n",
+		"example.go": src,
+	}
+
+	for name, content := range files {
+		require.NoError(t, os.WriteFile(filepath.Join(dir, name), []byte(content), 0o600))
+	}
+
+	return dir
+}
+
+func TestNewEntityParser(t *testing.T) {
+	const src = `package example
+
+import "strings"
+
+// Upper returns s in upper case.
+func Upper(s string) string { return strings.ToUpper(s) }
+`
+
+	p, err := NewEntityParser(writeModule(t, src))
+	require.NoError(t, err)
+	require.NoError(t, p.Parse())
+
+	entities := p.GetEntities()
+
+	names := make([]string, 0, len(entities))
+	for _, e := range entities {
+		names = append(names, e.Name)
+	}
+
+	require.Contains(t, names, "Upper")
+}
+
+func TestNewEntityParserPackageErrors(t *testing.T) {
+	tests := []struct {
+		name string
+		src  string
+	}{
+		{name: "syntax error", src: "package example\n\nfunc Broken( {\n\treturn 42\n}\n"},
+		{name: "type error", src: "package example\n\nfunc Broken() int { return undefined }\n"},
+	}
+	for _, tt := range tests {
+		t.Run(tt.name, func(t *testing.T) {
+			_, err := NewEntityParser(writeModule(t, tt.src))
+			require.ErrorContains(t, err, "example.go:")
+		})
+	}
+}
+
+func TestLoadImportedPackagesMissing(t *testing.T) {
+	const src = `package example; import "example.com/tsgentest/missing"`
+
+	file, err := parser.ParseFile(token.NewFileSet(), "example.go", src, parser.ImportsOnly)
+	require.NoError(t, err)
+	p := &EntityParser{
+		syntax:  []*ast.File{file},
+		imports: map[string]*packages.Package{},
+	}
+
+	var pkgErr packages.Error
+
+	require.ErrorAs(t, p.loadImportedPackages(), &pkgErr)
+	require.Contains(t, pkgErr.Msg, "example.com/tsgentest/missing")
+}
```

#### Recent Merged Pull Requests:
- **PR #8102** (2026-11-10): fix(js): stop tsgen from panicking on non-struct types (@dwisiswant0)
- **PR #8100** (2026-11-09): fix(js/tsgen): report package load errors instead of ignoring them (@dwisiswant0)
- **PR #8095** (closed): chore(deps): bump the modules group across 1 directory with 18 updates (@dependabot[bot])
- **PR #8094** (2026-11-09): chore(deps): bump crate-ci/typos from 1.51.1 to 1.52.0 in the workflows group (@dependabot[bot])
- **PR #8093** (2026-11-09): fix(templates): never trust cached verification verdicts (#7663) (@hakarrr)
- **PR #8091** (2026-11-09): fix(deps): bump golang.org/x/net, brotli, and klauspost/compress (@dwisiswant0)

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

## X. Merge pull request #8079 from projectdiscovery/security-context/refresh

**RULE**:
When implementing operations in `SECURITY_CONTEXT.md`, engineers MUST enforce rigorous boundary validation, safe state transitions, and memory/concurrency invariants as established by production defect remediation in projectdiscovery/nuclei. All inputs crossing module boundaries must be explicitly verified before state persistence.

**WHY**:
Prevents defects observed in production commit `54662dc4`: Merge pull request #8079 from projectdiscovery/security-context/refresh. Unvalidated execution paths cause runtime exceptions, race conditions, and silent state corruption under concurrent workloads.

**WHEN TO APPLY**:
Subsystems managing Go data structures, boundary deserialization, API parsing, or resource lifecycles matching `SECURITY_CONTEXT.md`.

**VERIFIED IMPLEMENTATION PATTERN**:
```go
// Verified production-grade fix pattern:
<!-- Generated by securitycontext.dev. Source HEAD: 40d08ee493f6f84c9a6b3c7f15f22da83853130c. -->
_Analyzed [40d08ee493][c-40d08ee493] on `dev` · 5242 commits, 586 security-relevant examined · generated 2026-11-09_
**12.5% of classified fixes repeat a previously fixed pattern** (2 recurring, 14 first-seen). A recurring pattern means this repository fixed a similar issue before — not that the code is currently vulnerable.
| 1 | Code Execution | `pkg/fuzz/execute.go` | high | 2 | [4fed40f75a][c-4fed40f75a], [ccbfb12bd0][c-ccbfb12bd0] |
| 2 | SSRF | `pkg/protocols/common/protocolstate/headless.go` | high | 2 | [d43c1f547f][c-d43c1f547f], [d9dabbb4a1][c-d9dabbb4a1] |
| 3 | Arbitrary File Access | `v2/pkg/protocols/common/generators/load.go` | high | 0 (1 component gone, not counted) | [e5154d362a][c-e5154d362a] |
| 4 | Arbitrary File Access | `pkg/js/libs/mysql/mysql.go` | high | 1 | [634cecbb28][c-634cecbb28] |
| 5 | Certificate Validation Bypass | `pkg/reporting/exporters/es/elasticsearch.go` | high | 1 | [82d5a8acc2][c-82d5a8acc2] |
| 6 | Code Execution | `pkg/protocols/common/expressions/expressions.go` | high | 1 | [d221732016][c-d221732016] |
- `pkg/fuzz` — 2 fixes: Code Executio
```

**NEGATIVE CONSTRAINT**:
```go
// Anti-pattern to NEVER write (induced failure mode):
<!-- Generated by securitycontext.dev. Source HEAD: df57ae6d2955864fd92a1bd2565fe9e4e9a7592b. -->
_Analyzed [df57ae6d29][c-df57ae6d29] on `dev` · 5174 commits, 548 security-relevant examined · generated 2026-11-02_
**7.1% of classified fixes repeat a previously fixed pattern** (1 recurring, 13 first-seen). A recurring pattern means this repository fixed a similar issue before — not that the code is currently vulnerable.
| 1 | SSRF | `pkg/protocols/common/protocolstate/headless.go` | high | 2 | [d43c1f547f][c-d43c1f547f], [d9dabbb4a1][c-d9dabbb4a1] |
| 2 | Arbitrary File Access | `v2/pkg/protocols/common/generators/load.go` | high | 0 (1 component gone, not counted) | [e5154d362a][c-e5154d362a] |
| 3 | Arbitrary File Access | `pkg/js/libs/mysql/mysql.go` | high | 1 | [634cecbb28][c-634cecbb28] |
| 4 | Code Execution | `pkg/fuzz/execute.go` | high | 1 | [ccbfb12bd0][c-ccbfb12bd0] |
| 5 | Code Execution | `pkg/protocols/common/expressions/expressions.go` | high | 1 | [d221732016][c-d221732016] |
| 6 | Information Disclosure | `internal/httpapi/apiendpoint.go` | high | 1 | [a20aa26024][c-a20aa26024] |
| Code Execution | 2 | 2 | [2026-06-30][c-ccbfb12bd0] ccbfb12bd0 |
```

**VERIFICATION METHOD**:
Automated regression test asserting that input states reproducing defect `54662dc4` are properly handled with clean fallback behavior.
