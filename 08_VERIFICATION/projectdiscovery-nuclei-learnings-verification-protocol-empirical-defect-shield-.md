# Verification Protocol: Verification Protocol: Empirical Defect Shield for projectdiscovery-nuclei-learnings

<!-- PROVENANCE_START
{
  "source_repository": "projectdiscovery-nuclei-learnings",
  "source_url": "unknown",
  "source_version": "HEAD",
  "license": "Open-Source",
  "timestamp": "2026-11-17T12:09:38.253Z",
  "ai_provider": "universal-multi-artifact-distributor",
  "generator_version": "2.0.0-universal",
  "learning_id": "LEARN-EVO-projectdiscovery-nuclei-learnings",
  "canonical_classification": "verification_contract"
}
PROVENANCE_END -->
> **Provenance**: Harvested from [projectdiscovery-nuclei-learnings](unknown) (Revision: `HEAD`).  
> **License**: Open-Source | **Timestamp**: `2026-11-17T12:09:38.253Z`  
> **Learning ID**: `LEARN-EVO-projectdiscovery-nuclei-learnings`


## 1. Scope & Verification Target
- **Target Repository**: `projectdiscovery-nuclei-learnings` (Commit: `HEAD`)
- **Pillar Alignment**: Pillar 11 (Empirical Truth & Mathematical Integrity)

## 2. Observed Failure Modes & Defect Traps
> **Canonical Learning Artifact**: `07_PROJECT_LEARNING/projectdiscovery-nuclei-learnings.md`  
> **Source**: github ([https://github.com/projectdiscovery/nuclei](https://github.com/projectdiscovery/nuclei))  
> **Source Version**: `2e591454`  
> **License**: MIT  
> **Synthesized By**: zero-clone-structural-synthesizer  
> **Timestamp**: 2026-11-17T12:09:31.631Z  
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
> **Harvest Timestamp**: 2026-11-17T12:09:31.624Z  
> **Compliance State**: Free Tier Guaranteed | Strict Rate-Limit Backoff Honored  

---

## 1. Context & Architectural Overview
- **Repository / Resource**: `projectdiscovery/nuclei`
- **Description**: Nuclei is a fast, customizable vulnerability scanner powered by the global security community and built on a simple YAML-based DSL, enabling collaboration to tackle trending vulnerabilities on the internet. It helps you find vulnerabilities in your applications, APIs, networks, DNS, and cloud configurations.
- **Primary Language / Ecosystem**: Go
- **Discovered Manifests / Configurations**: go.mod, README.md, Dockerfile
- **Stars / Engagement**: 33037 stars

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

### Incident Patch 1: `7b5274f2` (2026-11-17)
**Commit Message**: fix(stats): serialize counter creation so concurrent first hits are not dropped

## Proposed changes

`Tracker.incrementCounter` in `pkg/output/stats` reads the counter map and, on a miss, creates a counter, stores
`1` in it and publishes it with `Set`. Two goroutines that miss the same key at the same moment both create and
both publish, and the second publication discards the first counter together with whatever it had counted. For
`-http-stats` that shows up as under-reported status codes, error kinds and WAF vendors whenever a burst of
requests shares a key.

This change makes the create step atomic without touching the counting path:

- `pkg/output/stats/stats.go` (+28 / −5, net +23, 221 → 244 lines): `Tracker` gains a `counterMu sync.Mutex`;
  `incrementCounter`
  keeps its current read-then-`Add` shape for keys that already exist and only calls a new
  `getOrCreateCounter` on a miss, which takes the mutex, re-checks the map, and publishes the new counter. `Add(1)`
  stays outside the lock, and a hit never touches the new mutex. The observable semantics for a single goroutine
  are unchanged: the creating goroutine still counts its own request exactly once.
- `pkg/output/stat

**File**: `pkg/output/stats/stats.go` (modified, +28/-5)
```diff
@@ -32,6 +32,13 @@ type Tracker struct {
 	wafSkips    atomic.Uint64
 	wafDuration atomic.Uint64
 
+	// counterMu serializes get-or-create of the counters above. Each map is
+	// concurrency safe on its own, but the read-then-write pair across a map
+	// is not: when two goroutines race on the first hit for the same key they
+	// each install their own counter, the later Set discards the earlier one,
+	// and every increment already made on the discarded counter is lost.
+	counterMu sync.Mutex
+
 	// internal stuff
 	wafDetector *waf.WafDetector
 }
@@ -99,13 +106,29 @@ func (t *Tracker) GetWAFMetrics() WAFMetrics {
 }
 
 func (t *Tracker) incrementCounter(m *mapsutil.SyncLockMap[string, *atomic.Int32], key string) {
+	counter, ok := m.Get(key)
+	if !ok {
+		counter = t.getOrCreateCounter(m, key)
+	}
+	counter.Add(1)
+}
+
+// getOrCreateCounter returns the counter stored for key, creating and storing
+// it when it is still absent. Only creation is serialized, so concurrent first
+// hits for the same key all end up incrementing one counter; the Add itself
+// stays outside the lock.
+func (t *Tracker) getOrCreateCounter(m *mapsutil.SyncLockMap[string, *atomic.Int32], key string) *atomic.Int32 {
+	t.counterMu.Lock()
+	defer t.counterMu.Unlock()
+
+	// Re-check under the lock: another goroutine may have created the counter
+	// between the caller's first Get and this point.
 	if counter, ok := m.Get(key); ok {
-		counter.Add(1)
-	} else {
-		newCounter := new(atomic.Int32)
-		newCounter.Store(1)
-		_ = m.Set(key, newCounter)
+		return counter
 	}
+	counter := new(atomic.Int32)
+	_ = m.Set(key, counter)
+	return counter
 }
 
 type StatsOutput struct {
```

**File**: `pkg/output/stats/stats_test.go` (modified, +129/-0)
```diff
@@ -1,12 +1,141 @@
 package stats
 
 import (
+	"runtime"
 	"sync"
 	"testing"
 
 	"github.com/stretchr/testify/require"
 )
 
+// Bounded scheduler stress for counter creation: every iteration uses a fresh
+// tracker, so the key is always seen for the first time while workers are
+// released together. The assertion is exact, so a fixed build never retries or
+// sleeps; an unfixed build drops increments on the racing first hits.
+const (
+	concurrentFirstHitWorkers    = 64
+	concurrentFirstHitIterations = 200
+)
+
+// releaseTogether runs fn in n goroutines that all start on one signal.
+func releaseTogether(n int, fn func()) {
+	var wg sync.WaitGroup
+	start := make(chan struct{})
+	wg.Add(n)
+	for range n {
+		go func() {
+			defer wg.Done()
+			<-start
+			fn()
+		}()
+	}
+	close(start)
+	wg.Wait()
+}
+
+// requireMultipleP raises P above one so the racing window is reachable on
+// small runners. It records the machine's real shape and does not claim that a
+// single-P run cannot interleave: the scheduler may still preempt mid-window.
+func requireMultipleP(t *testing.T) {
+	t.Helper()
+	t.Logf("scheduler shape: runtime.NumCPU=%d GOMAXPROCS=%d", runtime.NumCPU(), runtime.GOMAXPROCS(0))
+	if runtime.GOMAXPROCS(0) < 2 {
+		previous := runtime.GOMAXPROCS(4)
+		t.Cleanup(func() { runtime.GOMAXPROCS(previous) })
+	}
+}
+
+func TestTrackStatusCodeConcurrentFirstHit(t *testing.T) {
+	requireMultipleP(t)
+
+	for iteration := 0; iteration < concurrentFirstHitIterations; iteration++ {
+		tracker := NewTracker()
+		releaseTogether(concurrentFirstHitWorkers, func() { tracker.TrackStatusCode("200") })
+
+		require.Equalf(t, concurrentFirstHitWorkers, tracker.GetStats().StatusCodeStats["200"],
+			"iteration %d: concurrent first hits on status code 200 lost increments", iteration)
+	}
+}
+
+func TestTrackErrorKindConcurrentFirstHit(t *testing.T) {
+	requireMultipleP(t)
+
+	for iteration := 0; iteration < concurrentFirstHitIterations; iteration++ {
+		tracker := NewTracker()
+		releaseTogether(concurrentFirstHitWorkers, func() { tracker.TrackErrorKind("timeout") })
+
+		require.Equalf(t, concurrentFirstHitWorkers, tracker.GetStats().ErrorStats["timeout"],
+			"iteration %d: concurrent first hits on error kind timeout lost increments", iteration)
+	}
+}
+
+func TestTrackWAFDetectedConcurrentFirstHit(t *testing.T) {
+	requireMultipleP(t)
+
+	const workers = 16
+	for iteration := 0; iteration < 20; iteration++ {
+		tracker := NewTracker()
+		releaseTogether(workers, func() { tracker.TrackWAFDetected("Attention Required! | Cloudflare") })
+
+		// Read through the user-visible accessor, not the internal map: WAFStats
+		// is keyed by detector name ("CloudFlare"), while wafDetected is keyed by
+		// the detector id ("cloudflare").
+		require.Equalf(t, workers, tracker.GetStats().WAFStats["CloudFlare"],
+			"iteration %d: concurrent first WAF hits lost increments", iteration)
+	}
+}
+
+func TestTrackStatusCodeConcurrentThenSequential(t *testing.T) {
+	requireMultipleP(t)
+
+	tracker := NewTracker()
+	releaseTogether(concurrentFirstHitWorkers, func() { tracker.TrackStatusCode("200") })
+	for range 5 {
+		tracker.TrackStatusCode("200")
+	}
+
+	// Sequential updates must land on the counter that stayed in the map.
+	require.Equal(t, concurrentFirstHitWorkers+5, tracker.GetStats().StatusCodeStats["200"])
+}
+
+func TestTrackStatusCodeConcurrentExistingKey(t *testing.T) {
+	requireMultipleP(t)
+
+	tracker := NewTracker()
+	tracker.TrackStatusCode("200")
+	releaseTogether(concurrentFirstHitWorkers, func() { tracker.TrackStatusCode("200") })
+
+	require.Equal(t, concurrentFirstHitWorkers+1, tracker.GetStats().StatusCodeStats["200"])
+}
+
+func TestTrackStatusCodeConcurrentDistinctKeys(t *testing.T) {
+	requireMultipleP(t)
+
+	keys := []string{"200", "201", "204", "301", "302", "400", "401", "403", "404", "500"}
+	tracker := NewTracker()
+
+	var wg sync.WaitGroup
+	start := make(chan struct{})
+	wg.Add(len(keys))
+	for _, key := range keys {
+		go func() {
+			defer wg.Done()
+			<-start
+			tracker.TrackStatusCode(key)
+		}()
+	}
+	close(start)
+	wg.Wait()
+
+	stats := tracker.GetStats()
+	total := 0
+	for _, key := range keys {
+		require.Equalf(t, 1, stats.StatusCodeStats[key], "status code %s counted wrong", key)
+		total += stats.StatusCodeStats[key]
+	}
+	require.Equal(t, len(keys), total)
+}
+
 func TestTrackErrorKind(t *testing.T) {
 	tracker := NewTracker()
 
```

---

### Incident Patch 2: `ecb8677d` (2026-11-17)
**Commit Message**: fix redirect

**File**: `pkg/protocols/dns/dnsclientpool/doh_test.go` (modified, +20/-9)
```diff
@@ -4,7 +4,6 @@ import (
 	"net"
 	"net/http"
 	"net/http/httptest"
-	"strings"
 	"sync/atomic"
 	"testing"
 
@@ -17,7 +16,16 @@ import (
 // newDohServer answers every DoH query with a TXT record and counts the hits.
 func newDohServer(t *testing.T, hits *atomic.Int32) *httptest.Server {
 	t.Helper()
-	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
+	return newDohServerOn(t, hits, "127.0.0.1:0")
+}
+
+// newDohServerOn is newDohServer bound to address, so a test can separate an
+// allowed redirector from a denied target.
+func newDohServerOn(t *testing.T, hits *atomic.Int32, address string) *httptest.Server {
+	t.Helper()
+	listener, err := net.Listen("tcp", address)
+	require.NoError(t, err)
+	server := httptest.NewUnstartedServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
 		hits.Add(1)
 		m := new(dns.Msg)
 		m.SetQuestion("example.com.", dns.TypeTXT)
@@ -30,6 +38,8 @@ func newDohServer(t *testing.T, hits *atomic.Int32) *httptest.Server {
 		w.Header().Set("Content-Type", "application/dns-message")
 		_, _ = w.Write(packed)
 	}))
+	server.Listener = listener
+	server.Start()
 	t.Cleanup(server.Close)
 	return server
 }
@@ -65,18 +75,19 @@ func TestDohResolverObeysNetworkPolicy(t *testing.T) {
 
 	t.Run("redirect to denied address", func(t *testing.T) {
 		var hits atomic.Int32
-		internal := newDohServer(t, &hits)
+		// The target listens on ::1, which is denied. The redirector stays on
+		// 127.0.0.1. localhost cannot be the allowed hop: denying 127.0.0.1
+		// denies localhost too, because that name resolves to 127.0.0.1.
+		internal := newDohServerOn(t, &hits, "[::1]:0")
 		redirector := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
 			http.Redirect(w, r, internal.URL+"/internal", http.StatusFound)
 		}))
 		t.Cleanup(redirector.Close)
-		// localhost passes the resolver check through ::1, while 127.0.0.1 is denied
-		_, port, err := net.SplitHostPort(strings.TrimPrefix(redirector.URL, "http://"))
-		require.NoError(t, err)
-		options := dohOptions(t, []string{"127.0.0.1"})
-		require.True(t, protocolstate.IsHostAllowed(options.ExecutionId, "localhost"))
+		options := dohOptions(t, []string{"::1"})
+		require.True(t, protocolstate.IsHostAllowed(options.ExecutionId, "127.0.0.1"))
+		require.False(t, protocolstate.IsHostAllowed(options.ExecutionId, "::1"))
 
-		client, err := Get(options, &Configuration{Retries: 1, Resolvers: []string{"doh:http://localhost:" + port + "/dns-query:get"}})
+		client, err := Get(options, &Configuration{Retries: 1, Resolvers: []string{"doh:" + redirector.URL + "/dns-query:get"}})
 		require.NoError(t, err)
 		_, _ = client.Do(txtQuery())
 		require.Zero(t, hits.Load(), "DoH redirect reached a denied address")
```

---

### Incident Patch 3: `b958b44b` (2026-11-17)
**Commit Message**: Merge pull request #8154 from liangzaihuanyv/fix/workflow-matcher-extract-normalization-on-f1

fix(workflow): normalize extracted values for matcher subtemplates

**File**: `internal/tests/integration/workflow_test.go` (modified, +3/-2)
```diff
@@ -266,8 +266,9 @@ func (h *workflowMultiMatchKeyValueShare) Execute(filePath string) error {
 	}
 
 	// Check if we received the data from both request to /path1 and it is not overwritten by the later one.
-	// They will appear in brackets because of another bug: https://github.com/orgs/projectdiscovery/discussions/3766
-	if !sliceutil.Contains(receivedData, "[test-value-1]") || !sliceutil.Contains(receivedData, "[test-value-2]") {
+	// Each child event carries its own single extracted value, so it must render without brackets,
+	// see https://github.com/orgs/projectdiscovery/discussions/3766.
+	if !sliceutil.Contains(receivedData, "test-value-1") || !sliceutil.Contains(receivedData, "test-value-2") {
 		return fmt.Errorf(
 			"incorrect data: did not receive both extracted data from the first request!\nReceived Data:\n\t%s\nResults:\n\t%s",
 			strings.Join(receivedData, "\n\t"),
```

**File**: `pkg/core/workflow_execute.go` (modified, +31/-19)
```diff
@@ -92,22 +92,7 @@ func (e *Engine) runWorkflowStep(template *workflows.WorkflowTemplate, ctx *scan
 					}
 
 					if result.OperatorsResult != nil && result.OperatorsResult.Extracts != nil {
-						for k, v := range result.OperatorsResult.Extracts {
-							// normalize items:
-							switch len(v) {
-							case 0, 1:
-								// - key:[item] => key: item
-								ctx.Input.Set(k, v[0])
-							default:
-								// - key:[item_0, ..., item_n] => key0:item_0, keyn:item_n
-								for vIdx, vVal := range v {
-									normalizedKIdx := fmt.Sprintf("%s%d", k, vIdx)
-									ctx.Input.Set(normalizedKIdx, vVal)
-								}
-								// also add the original name with full slice
-								ctx.Input.Set(k, v)
-							}
-						}
+						setWorkflowExtracts(ctx.Input, result.OperatorsResult.Extracts)
 					}
 				}
 				_, err = executer.Executer.ExecuteWithResults(ctx)
@@ -145,9 +130,7 @@ func (e *Engine) runWorkflowStep(template *workflows.WorkflowTemplate, ctx *scan
 				}
 
 				if event.OperatorsResult.Extracts != nil {
-					for k, v := range event.OperatorsResult.Extracts {
-						ctx.Input.Set(k, v)
-					}
+					setWorkflowExtracts(ctx.Input, event.OperatorsResult.Extracts)
 				}
 
 				for _, matcher := range template.Matchers {
@@ -232,3 +215,32 @@ func (e *Engine) syncWorkflowInputToTemplateCtx(executer *workflows.ProtocolExec
 
 	executer.Options.GetTemplateCtx(input.MetaInput).Merge(workflowValues)
 }
+
+// setWorkflowExtracts propagates the extracts of a workflow step to the step
+// input so the subtemplates started by that step resolve them the same way
+// whether the step matched through an operator or through a workflow matcher:
+//
+//   - key: [item] => key: item
+//   - key: [item_0, ..., item_n] => key0: item_0, ..., keyn: item_n, and the
+//     original name keeps the full slice for further indexing.
+//
+// Extracts without values are skipped: a scalar cannot be rendered from them
+// and there is nothing to index.
+func setWorkflowExtracts(input *contextargs.Context, extracts map[string][]string) {
+	if input == nil {
+		return
+	}
+	for k, v := range extracts {
+		switch len(v) {
+		case 0:
+			continue
+		case 1:
+			input.Set(k, v[0])
+		default:
+			for vIdx, vVal := range v {
+				input.Set(fmt.Sprintf("%s%d", k, vIdx), vVal)
+			}
+			input.Set(k, v)
+		}
+	}
+}
```

**File**: `pkg/core/workflow_execute_matcher_extracts_test.go` (added, +147/-0)
```diff
@@ -0,0 +1,147 @@
+package core
+
+import (
+	"context"
+	"testing"
+
+	"github.com/projectdiscovery/nuclei/v3/pkg/model/types/stringslice"
+	"github.com/projectdiscovery/nuclei/v3/pkg/operators"
+	"github.com/projectdiscovery/nuclei/v3/pkg/output"
+	"github.com/projectdiscovery/nuclei/v3/pkg/progress"
+	"github.com/projectdiscovery/nuclei/v3/pkg/protocols"
+	"github.com/projectdiscovery/nuclei/v3/pkg/protocols/common/contextargs"
+	"github.com/projectdiscovery/nuclei/v3/pkg/scan"
+	"github.com/projectdiscovery/nuclei/v3/pkg/types"
+	"github.com/projectdiscovery/nuclei/v3/pkg/workflows"
+	"github.com/stretchr/testify/require"
+)
+
+// runMatcherExtractWorkflow runs a workflow whose only step matches through a
+// workflow matcher and produces the given extracts, so the subtemplate started
+// by that matcher resolves them like any other workflow step.
+func runMatcherExtractWorkflow(t *testing.T, extracts map[string][]string, matcherName string, childHook func(ctx *scan.ScanContext, childOptions *protocols.ExecutorOptions)) bool {
+	t.Helper()
+
+	progressBar, _ := progress.NewStatsTicker(0, false, false, false, 0)
+	childOptions := &protocols.ExecutorOptions{TemplateID: "child-template", Progress: progressBar}
+	childExecuter := &mockExecuter{result: true}
+	if childHook != nil {
+		childExecuter.executeScanHook = func(ctx *scan.ScanContext) {
+			childHook(ctx, childOptions)
+		}
+	}
+
+	workflow := &workflows.Workflow{
+		Options: &protocols.ExecutorOptions{Options: &types.Options{TemplateThreads: 10}},
+		Workflows: []*workflows.WorkflowTemplate{{
+			Executers: []*workflows.ProtocolExecuterPair{{
+				Executer: &mockExecuter{result: true, outputs: []*output.InternalWrappedEvent{{
+					OperatorsResult: &operators.Result{
+						Matches:  map[string][]string{"tomcat": {}},
+						Extracts: extracts,
+					},
+					Results: []*output.ResultEvent{{}},
+				}}},
+				Options: &protocols.ExecutorOptions{TemplateID: "parent-template", Progress: progressBar},
+			}},
+			Matchers: []*workflows.Matcher{{
+				Name: stringslice.StringSlice{Value: matcherName},
+				Subtemplates: []*workflows.WorkflowTemplate{{
+					Executers: []*workflows.ProtocolExecuterPair{{
+						Executer: childExecuter,
+						Options:  childOptions,
+					}},
+				}},
+			}},
+		}},
+	}
+
+	engine := &Engine{}
+	input := contextargs.NewWithInput(context.Background(), "https://test.com")
+	ctx := scan.NewScanContext(context.Background(), input)
+	return engine.executeWorkflow(ctx, workflow)
+}
+
+// TestWorkflowsMatcherSubtemplatesExtractSingleValue covers the common workflow
+// shape whose step declares matchers and extractors: the subtemplate must
+// resolve the extracted value as a scalar, not as a one element list.
+func TestWorkflowsMatcherSubtemplatesExtractSingleValue(t *testing.T) {
+	var childWhoami interface{}
+	var childRan bool
+
+	matched := runMatcherExtractWorkflow(t, map[string][]string{"whoami": {"foo"}}, "tomcat", func(ctx *scan.ScanContext, childOptions *protocols.ExecutorOptions) {
+		childRan = true
+		childWhoami, _ = childOptions.GetTemplateCtx(ctx.Input.MetaInput).Get("whoami")
+	})
+
+	require.True(t, matched, "could not get correct match value")
+	require.True(t, childRan, "matcher subtemplate should run when the matcher matches")
+	require.Equal(t, "foo", childWhoami, "matcher subtemplate should resolve a single extract as a scalar")
+}
+
+// TestWorkflowsMatcherSubtemplatesExtractMultipleValues keeps the indexed and
+// the full slice forms available for extractors returning several values.
+func TestWorkflowsMatcherSubtemplatesExtractMultipleValues(t *testing.T) {
+	var childPaths0, childPaths1, childPaths interface{}
+
+	matched := runMatcherExtractWorkflow(t, map[string][]string{"paths": {"a", "b"}}, "tomcat", func(ctx *scan.ScanContext, childOptions *protocols.ExecutorOptions) {
+		templateCtx := childOptions.GetTemplateCtx(ctx.Input.MetaInput)
+		childPaths0, _ = templateCtx.Get("paths0")
+		childPaths1, _ = templateCtx.Get("paths1")
+		childPaths, _ = templateCtx.Get("paths")
+	})
+
+	require.True(t, matched, "could not get correct match value")
+	require.Equal(t, "a", childPaths0, "could not index the first extracted value")
+	require.Equal(t, "b", childPaths1, "could not index the second extracted value")
+	require.Equal(t, []string{"a", "b"}, childPaths, "could not keep the full slice of extracted values")
+}
+
+// TestWorkflowsMatcherSubtemplatesWithoutExtracts covers steps that extract
+// nothing at all: the subtemplate still runs and no value is invented.
+func TestWorkflowsMatcherSubtemplatesWithoutExtracts(t *testing.T) {
+	var childRan bool
+	var childWhoami interface{}
+
+	matched := runMatcherExtractWorkflow(t, map[string][]string{}, "tomcat", func(ctx *scan.ScanContext, childOptions *protocols.ExecutorOptions) {
+		childRan = true
+		childWhoami, _ = childOptions.GetTemplateCtx(ctx.Input.MetaInput).Get("whoami")
+	})
+
+	require.True(t, matched, "could not get correct match value")
+	requi
```

#### Recent Merged Pull Requests:
- **PR #8161** (2026-11-17): fix(stats): serialize counter creation so concurrent first hits are not dropped (@liangzaihuanyv)
- **PR #8160** (2026-11-17): fix(markdown): index findings only after writing their reports (@hakarrr)
- **PR #8158** (2026-11-17): fix(jsonl): close the report file after a flush error (@hakarrr)
- **PR #8156** (2026-11-17): fix(splunk): close HEC response bodies after export (@hakarrr)
- **PR #8154** (2026-11-17): fix(workflow): normalize extracted values for matcher subtemplates (@liangzaihuanyv)
- **PR #8152** (2026-11-17): fix(input): use the parsed URL host for SSL host:port assembly (@liangzaihuanyv)

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

## X. stats): serialize counter creation so concurrent first hits are not dropped

**RULE**:
When implementing operations in `pkg/output/stats/stats.go`, engineers MUST enforce rigorous boundary validation, safe state transitions, and memory/concurrency invariants as established by production defect remediation in projectdiscovery/nuclei. All inputs crossing module boundaries must be explicitly verified before state persistence.

**WHY**:
Prevents defects observed in production commit `7b5274f2`: stats): serialize counter creation so concurrent first hits are not dropped. Unvalidated execution paths cause runtime exceptions, race conditions, and silent state corruption under concurrent workloads.

**WHEN TO APPLY**:
Subsystems managing Go data structures, boundary deserialization, API parsing, or resource lifecycles matching `pkg/output/stats/stats.go`.

**VERIFIED IMPLEMENTATION PATTERN**:
```go
// Verified production-grade fix pattern:
	// counterMu serializes get-or-create of the counters above. Each map is
	// concurrency safe on its own, but the read-then-write pair across a map
	// is not: when two goroutines race on the first hit for the same key they
	// each install their own counter, the later Set discards the earlier one,
	// and every increment already made on the discarded counter is lost.
	counterMu sync.Mutex

	counter, ok := m.Get(key)
	if !ok {
		counter = t.getOrCreateCounter(m, key)
	}
	counter.Add(1)
}

// getOrCreateCounter returns the counter stored for key, creating and storing
// it when it is still absent. Only creation is serialized, so concurrent first
// hits for the same key all end up incrementing one counter; the Add itself
// stays outside the lock.
func (t *Tracker) getOrCreateCounter(m *mapsutil.SyncLockMap[string, *atomic.Int32], key string) *atomic.Int32 {
	t.counterMu.Lock()
	defer t.counterMu.Unlock()

	// Re-check under the lock: another goroutine may have created the counter
	// between the caller's first Get and this point.
		return counter
	counter := new(atomic.Int32)
	_ = m.Set(key, counter)
	return counter
```

**NEGATIVE CONSTRAINT**:
```go
// Induced defect failure mode:
		counter.Add(1)
	} else {
		newCounter := new(atomic.Int32)
		newCounter.Store(1)
		_ = m.Set(key, newCounter)
```

**VERIFICATION METHOD**:
Automated regression test asserting that input states reproducing defect `7b5274f2` are properly handled with clean fallback behavior.


## 3. Independent Verification Protocol
1. Assert state existence before and after execution.
2. Verify deterministic SHA-256 byte digest parity.
3. Validate zero unhandled promise rejections or uncaught exceptions.
