# Forensic Learning Record (Deep Inspection): vxcontrol/pentagi

> **Canonical Artifact**: `07_PROJECT_LEARNING/vxcontrol-pentagi-learnings.md`  
> **Source Platform**: GitHub ([https://github.com/vxcontrol/pentagi](https://github.com/vxcontrol/pentagi))  
> **Harvest Method**: Full-Spectrum Deep Extraction (Patches, Diffs, Source Code, Post-Mortems)  
> **Harvest Timestamp**: 2026-10-06T01:44:14.565Z  
> **Compliance State**: Free Tier Guaranteed | Strict Rate-Limit Backoff Honored  

---

## 1. Context & Architectural Overview
- **Repository / Resource**: `vxcontrol/pentagi`
- **Description**: Fully autonomous AI Agents system capable of performing complex penetration testing tasks
- **Primary Language / Ecosystem**: Go
- **Discovered Manifests / Configurations**: README.md, Dockerfile
- **Stars / Engagement**: 25267 stars

---

## 2. Multi-Dimensional 8-Axis Investigation & Real Code Patches

### D1: Architecture & Structural Boundaries
- Entry configurations inspected via direct stream: README.md, Dockerfile.
- Evaluated system abstractions and modular contracts.

### Core Architecture Module: `backend/cmd/installer/processor/state.go`
```
package processor

import (
	"context"
	"strings"
	"sync"

	"pentagi/cmd/installer/wizard/terminal"

	tea "github.com/charmbracelet/bubbletea"
	"github.com/google/uuid"
)

// operationState holds execution options and state for processor operations
type operationState struct {
	id            string            // unique identifier for the command
	force         bool              // attempt maximum operations
	terminal      terminal.Terminal // embedded terminal model for interactive display
	operation     ProcessorOperation
	passwordValue string // password value for reset password operation

	// announced is the stack the CALLER asked about — the first one to announce itself.
	// Started and completion messages are sent for it and for nothing else.
	//
	// The operations fan out: an update of `compose` runs four stacks, an update of `all`
	// runs six, and each nested call used to announce its own completion. The screen takes
	// the first completion as the end of the whole operation — it stops the terminal, prints
	// the result and, because HandleMsg returns nil for a completion, stops polling. So the
	// first stack to finish reported success on behalf of all of them, and every error
	// after it was never drained. Which stacks are installed does not change this: the
	// fan-out lists are fixed, and a stack with nothing to do finishes fastest of all.
	announced    ProductStack
	announcedSet bool

	// message chain for reply
	mx     *sync.Mutex
	ctx    context.Context
	output strings.Builder
	msgs   []tea.Msg
}

// ProcessorOutputMsg contains command output line
type ProcessorOutputMsg struct {
	ID        string
	Output    string
	Operation ProcessorOperation
	Stack     ProductStack

	// keeps for continuing the message chain
	state *operationState
	num   int
}

// ProcessorCompletionMsg signals operation completion
type ProcessorCompletionMsg struct {
	ID        string
	Error     error
	Operation ProcessorOperation
	Stack     ProductStack

	// keeps for continuing the message chain
	state *operationState
	num   int
}

// ProcessorStartedMsg signals operation start
type ProcessorStartedMsg struct {
	ID        string
	Operation ProcessorOperation
	Stack     ProductStack

	// keeps for continuing the message chain
	state *operationState
	num   int
}

// ProcessorWaitMsg signals operation wait for
type ProcessorWaitMsg struct {
	ID        string
	Error     error
	Operation ProcessorOperation
	Stack     ProductStack

	// keeps for continuing the message chain
	state *operationState
	num   int
}

// ProcessorFilesCheckMsg carries file statuses computed in check
type ProcessorFilesCheckMsg struct {
	ID     string
	Stack  ProductStack
	Result FilesCheckResult
	Error  error

	// keeps for continuing the message chain
	state *operationState
	num   int
}

type OperationOption func(c *operationState)

func withOperation(operation ProcessorOperation) OperationOption {
	return func(c *operationState) { c.operation = operation }
}

func withContext(ctx context.Context) OperationOption {
	return func(c *operationState) { c.ctx = ctx }
}

// helper to build operation state with defaults
func newOperationState(opts []OperationOption) *operationState {
	state := &operationState{
		id:   uuid.New().String(),
		mx:   &sync.Mutex{},
		ctx:  context.Background(),
		msgs: []tea.Msg{},
	}

	for _, opt := range opts {
		opt(state)
	}

	if state.terminal == nil {
		state.terminal = terminal.NewTerminal(
			80, 24,
			terminal.WithAutoScroll(),
			terminal.WithAutoPoll(),
			terminal.WithCurrentEnv(),
			terminal.WithNoPty(),
		)
	}

	return state
}

// helper to send output message
func (state *operationState) sendOutput(output string, isPartial bool, stack ProductStack) {
	state.mx.Lock()
	defer state.mx.Unlock()

	if isPartial {
		state.output.WriteString(output)
		state.output.WriteString("\n")
	} else {
		state.output.Reset()
		state.output.WriteString(output)
	}

	state.msgs = append(state.msgs, ProcessorOutputMsg{
		ID:        state.id,
		Output:    state.output.String(),
		Operation: state.operation,
		Stack:     stack,
		state:     state,
		num:       len(state.msgs) + 1,
	})
}

// helper to send completion message
func (state *operationState) sendCompletion(stack ProductStack, err error) {
	state.mx.Lock()
	defer state.mx.Unlock()

	// A nested stack finishing is not the operation finishing. Its error is not lost by
	// staying silent here — the caller returns it, and the announced stack carries it.
	if state.announcedSet && state.announced != stack {
		return
	}

	state.msgs = append(state.msgs, ProcessorCompletionMsg{
		ID:        state.id,
		Error:     err,
		Operation: state.operation,
		Stack:     stack,
		state:     state,
		num:       len(state.msgs) + 1,
	})
}

// helper to send started message
func (state *operationState) sendStarted(stack ProductStack) {
	state.mx.Lock()
	defer state.mx.Unlock()

	// The first stack to announce itself is the one the caller asked about; everything
	// after it is the fan-out this operation performs internally.
	if !state.announcedSet {
		state.announced, state.announcedSet = stack, true
	}
	if state.announced != stack {
		return
	}

	state.msgs = append(state.msgs, ProcessorStartedMsg{
		ID:        state.id,
		Operation: state.operation,
		Stack:     stack,
		state:     state,
		num:       len(state.msgs) + 1,
	})
}

// helper to send files check message
func (state *operationState) sendFilesCheck(stack ProductStack, result FilesCheckResult, err error) {
	state.mx.Lock()
	defer state.mx.Unlock()

	state.msgs = append(state.msgs, ProcessorFilesCheckMsg{
		ID:     state.id,
		Stack:  stack,
		Result: result,
		Error:  err,
		state:  state,
		num:    len(state.msgs) + 1,
	})
}

```

### Core Architecture Module: `backend/cmd/installer/state/state.go`
```
package state

import (
	"encoding/json"
	"fmt"
	"os"
	"path/filepath"
	"sync"
	"time"

	"pentagi/cmd/installer/loader"
)

const EULAConsentFile = "eula-consent"

type State interface {
	Exists() bool
	Reset() error
	Commit() error
	IsDirty() bool

	GetEulaConsent() bool
	SetEulaConsent() error

	SetStack(stack []string) error
	GetStack() []string

	GetVar(name string) (loader.EnvVar, bool)
	SetVar(name, value string) error
	ResetVar(name string) error

	GetVars(names []string) (map[string]loader.EnvVar, map[string]bool)
	SetVars(vars map[string]string) error
	ResetVars(names []string) error

	// WriteVars puts values into the environment FILE, bypassing the staging area.
	//
	// Everything else here stages: SetVar and SetVars record an intention that only
	// reaches .env when the user applies their changes. That is right for anything a
	// person typed into a form, and wrong for a value the installer itself must have on
	// disk before the very next command runs — `docker compose` is given --env-file
	// pointing at the real file, so a staged variable is one compose has never heard of
	// and it silently uses the default the compose file ships with.
	//
	// The user's pending edits are not written along with it: the file is re-read from
	// disk, these values are set on that, and the result is saved. Committing the whole
	// staged view here would apply form changes the user has not agreed to apply.
	WriteVars(vars map[string]string) error

	GetAllVars() map[string]loader.EnvVar
	GetEnvPath() string
}

type stateData struct {
	Stack []string                 `json:"stack"`
	Vars  map[string]loader.EnvVar `json:"vars"`
}

type state struct {
	mx        *sync.Mutex
	envPath   string
	statePath string
	stateDir  string
	stack     []string
	envFile   loader.EnvFile
}

func NewState(envPath string) (State, error) {
	envFile, err := loader.LoadEnvFile(envPath)
	if err != nil {
		return nil, err
	}

	stateDir := filepath.Join(filepath.Dir(envPath), ".state")
	if err := os.MkdirAll(stateDir, 0755); err != nil {
		return nil, err
	}

	envFileName := filepath.Base(envPath)
	statePath := filepath.Join(stateDir, fmt.Sprintf("%s.state", envFileName))
	s := &state{
		mx:        &sync.Mutex{},
		envPath:   envPath,
		statePath: statePath,
		stateDir:  stateDir,
		envFile:   envFile,
	}

	if info, err := os.Stat(statePath); err == nil && info.IsDir() {
		return nil, fmt.Errorf("'%s' is a directory", statePath)
	} else if err == nil {
		if err := s.loadState(statePath); err != nil {
			return nil, err
		}
	}

	return s, nil
}

func (s *state) Exists() bool {
	info, err := os.Stat(s.statePath)
	if err != nil {
		return false
	}

	return !info.IsDir()
}

func (s *state) Reset() error {
	s.mx.Lock()
	defer s.mx.Unlock()

	return s.resetState()
}

func (s *state) Commit() error {
	s.mx.Lock()
	defer s.mx.Unlock()

	if err := s.envFile.Save(s.envPath); err != nil {
		return err
	}

	return s.resetState()
}

func (s *state) IsDirty() bool {
	s.mx.Lock()
	defer s.mx.Unlock()

	info, err := os.Stat(s.statePath)
	if err != nil {
		return false
	}

	if info.IsDir() {
		return false
	}

	for _, envVar := range s.envFile.GetAll() {
		if envVar.IsChanged {
			return true
		}
	}

	return false
}

func (s *state) GetEulaConsent() bool {
	s.mx.Lock()
	defer s.mx.Unlock()

	consentFile := filepath.Join(s.stateDir, EULAConsentFile)
	if _, err := os.Stat(consentFile); os.IsNotExist(err) {
		return false
	}

	return true
}

func (s *state) SetEulaConsent() error {
	s.mx.Lock()
	defer s.mx.Unlock()

	currentTime := time.Now().Format(time.RFC3339)
	consentFile := filepath.Join(s.stateDir, EULAConsentFile)
	if err := os.WriteFile(consentFile, []byte(currentTime), 0644); err != nil {
		return fmt.Errorf("failed to write eula consent file: %w", err)
	}

	return nil
}

func (s *state) SetStack(stack []string) error {
	s.mx.Lock()
	defer s.mx.Unlock()

	s.stack = stack

	return s.flushState()
}

func (s *state) GetStack() []string {
	s.mx.Lock()
	defer s.mx.Unlock()

	return s.stack
}

func (s *state) GetVar(name string) (loader.EnvVar, bool) {
	s.mx.Lock()
	defer s.mx.Unlock()

	return s.envFile.Get(name)
}

func (s *state) SetVar(name, value string) error {
	s.mx.Lock()
	defer s.mx.Unlock()

	s.envFile.Set(name, value)

	return s.flushState()
}

func (s *state) ResetVar(name string) error {
	return s.ResetVars([]string{name})
}

func (s *state) GetVars(names []string) (map[string]loader.EnvVar, map[string]bool) {
	s.mx.Lock()
	defer s.mx.Unlock()

	result := make(map[string]loader.EnvVar, len(names))
	present := make(map[string]bool, len(names))

	for _, name := range names {
		envVar, ok := s.envFile.Get(name)
		result[name] = envVar
		present[name] = ok
	}

	return result, present
}

func (s *state) SetVars(vars map[string]string) error {
	s.mx.Lock()
	defer s.mx.Unlock()

	for name, value := range vars {
		s.envFile.Set(name, value)
	}

	return s.flushState()
}

func (s *state) WriteVars(vars map[string]string) error {
	s.mx.Lock()
	defer s.mx.Unlock()

	if len(vars) == 0 {
		return nil
	}

	// From disk, not from s.envFile: that one carries every staged edit, and saving it
	// would apply the user's un-applied form changes as a side effect of an update.
	envFile, err := loader.LoadEnvFile(s.envPath)
	if err != nil {
		return err
	}

	for name, value := range vars {
		envFile.Set(name, value)
	}

	if err := envFile.Save(s.envPath); err != nil {
		return err
	}

	// The in-memory view is kept in step so a later Commit does not write the previous
	// value back over what was just saved. The staging FILE is deliberately not touched:
	// a value the installer wrote for itself must not make the installation look dirty
	// and prompt the user to apply something they never changed.
	for name, value := range vars {
		s.envFile.Set(name, value)
	}

	return nil
}

func (s *state) ResetVars(names []string) error {
	s.mx.Lock()
	defer s.mx.Unlock()

	envFile, err := loader.LoadEnvFile(s.envPath)
	if err != nil {
		return err
	}

	for _, name := range names {
		// try to keep valuable variables that are not present in the env file
		// but have default value and its default value can be used in the future
		if envVar, ok := envFile.Get(name); ok && (envVar.IsPresent() || envVar.Default != "") {
			s.envFile.Set(name, envVar.Value)
		} else {
			s.envFile.Del(name)
		}
	}

	return s.flushState()
}

func (s *state) GetAllVars() map[string]loader.EnvVar {
	s.mx.Lock()
	defer s.mx.Unlock()

	return s.envFile.GetAll()
}

func (s *state) GetEnvPath() string {
	return s.envPath
}

func (s *state) loadState(stateFile string) error {
	file, err := os.Open(stateFile)
	if err != nil {
		return fmt.Errorf("failed to open state file: %w", err)
	}

	var data stateData
	if err := json.NewDecoder(file).Decode(&data); err != nil {
		// if the state file is corrupted, reset it
		data.Stack = []string{}
		data.Vars = make(map[string]loader.EnvVar)
	}

	s.stack = data.Stack
	s.envFile.SetAll(data.Vars)

	return nil
}

func (s *state) flushState() error {
	data := stateData{
		Stack: s.stack,
		Vars:  s.envFile.GetAll(),
	}

	file, err := os.OpenFile(s.statePath, os.O_CREATE|os.O_WRONLY|os.O_TRUNC, 0600)
	if err != nil {
		return fmt.Errorf("failed to create state file: %w", err)
	}
	defer file.Close()

	if err := json.NewEncoder(file).Encode(data); err != nil {
		return fmt.Errorf("failed to encode state file: %w", err)
	}

	return nil
}

func (s *state) resetState() error {
	if err := os.Remove(s.statePath); err != nil && !os.IsNotExist(err) {
		return fmt.Errorf("failed to remove state file: %w", err)
	}

	envFile, err := loader.LoadEnvFile(s.envPath)
	if err != nil {
		return fmt.Errorf("failed to load state after reset: %w", err)
	}

	s.envFile = envFile
	if err := s.flushState(); err != nil {
		return fmt.Errorf("failed to flush state after reset: %w", err)
	}

	return nil
}

```

### Core Architecture Module: `backend/cmd/installer/wizard/models/search_engines_form.go`
```
package models

import (
	"fmt"
	"strconv"
	"strings"

	"pentagi/cmd/installer/loader"
	"pentagi/cmd/installer/wizard/controller"
	"pentagi/cmd/installer/wizard/locale"
	"pentagi/cmd/installer/wizard/logger"
	"pentagi/cmd/installer/wizard/styles"
	"pentagi/cmd/installer/wizard/window"

	tea "github.com/charmbracelet/bubbletea"
)

// SearchEnginesFormModel represents the Search Engines configuration form
type SearchEnginesFormModel struct {
	*BaseScreen
}

// NewSearchEnginesFormModel creates a new Search Engines form model
func NewSearchEnginesFormModel(c controller.Controller, s styles.Styles, w window.Window) *SearchEnginesFormModel {
	m := &SearchEnginesFormModel{}

	// create base screen with this model as handler (no list handler needed)
	m.BaseScreen = NewBaseScreen(c, s, w, m, nil)

	return m
}

// BaseScreenHandler interface implementation

func (m *SearchEnginesFormModel) BuildForm() tea.Cmd {
	config := m.GetController().GetSearchEnginesConfig()
	fields := []FormField{}

	// DuckDuckGo (boolean)
	fields = append(fields, m.createBooleanField("duckduckgo_enabled",
		locale.ToolsSearchEnginesDuckDuckGo,
		locale.ToolsSearchEnginesDuckDuckGoDesc,
		config.DuckDuckGoEnabled,
	))

	// DuckDuckGo Region
	fields = append(fields, m.createSelectTextField(
		"duckduckgo_region",
		locale.ToolsSearchEnginesDuckDuckGoRegion,
		locale.ToolsSearchEnginesDuckDuckGoRegionDesc,
		config.DuckDuckGoRegion,
		[]string{"us-en", "uk-en", "cn-zh", "ru-ru", "de-de", "fr-fr", "es-es", "it-it"},
		false,
	))

	// DuckDuckGo Safe Search
	fields = append(fields, m.createSelectTextField(
		"duckduckgo_safesearch",
		locale.ToolsSearchEnginesDuckDuckGoSafeSearch,
		locale.ToolsSearchEnginesDuckDuckGoSafeSearchDesc,
		config.DuckDuckGoSafeSearch,
		[]string{"strict", "moderate", "off"},
		false,
	))

	// DuckDuckGo Time Range
	fields = append(fields, m.createSelectTextField(
		"duckduckgo_time_range",
		locale.ToolsSearchEnginesDuckDuckGoTimeRange,
		locale.ToolsSearchEnginesDuckDuckGoTimeRangeDesc,
		config.DuckDuckGoTimeRange,
		[]string{"d", "w", "m", "y"},
		false,
	))

	// Sploitus (boolean)
	fields = append(fields, m.createBooleanField("sploitus_enabled",
		locale.ToolsSearchEnginesSploitus,
		locale.ToolsSearchEnginesSploitusDesc,
		config.SploitusEnabled,
	))

	// Perplexity API Key
	fields = append(fields, m.createAPIKeyField("perplexity_api_key",
		locale.ToolsSearchEnginesPerplexityKey,
		locale.ToolsSearchEnginesPerplexityKeyDesc,
		config.PerplexityAPIKey,
	))

	fields = append(fields, m.createTextField(
		"perplexity_model",
		"Perplexity Model",
		"Perplexity chat/completions model (sonar, sonar-pro, ...); empty defaults to sonar",
		config.PerplexityModel,
		false,
	))

	// Perplexity Context Size (suggestions)
	fields = append(fields, m.createSelectTextField(
		"perplexity_context_size",
		"Perplexity Context Size",
		"Select Perplexity context size",
		config.PerplexityContextSize,
		[]string{"low", "medium", "high"},
		false,
	))

	fields = append(fields, m.createTextField(
		"perplexity_timeout",
		locale.ToolsSearchEnginesPerplexityTimeout,
		locale.ToolsSearchEnginesPerplexityTimeoutDesc,
		config.PerplexityTimeout,
		false,
	))

	// Tavily API Key
	fields = append(fields, m.createAPIKeyField("tavily_api_key",
		locale.ToolsSearchEnginesTavilyKey,
		locale.ToolsSearchEnginesTavilyKeyDesc,
		config.TavilyAPIKey,
	))

	// Firecrawl API Key
	fields = append(fields, m.createAPIKeyField("firecrawl_api_key",
		locale.ToolsSearchEnginesFirecrawlKey,
		locale.ToolsSearchEnginesFirecrawlKeyDesc,
		config.FirecrawlAPIKey,
	))

	// Firecrawl API URL (optional, for self-hosted deployments)
	fields = append(fields, m.createTextField("firecrawl_api_url",
		locale.ToolsSearchEnginesFirecrawlURL,
		locale.ToolsSearchEnginesFirecrawlURLDesc,
		config.FirecrawlAPIURL,
		false,
	))

	// Traversaal API Key
	fields = append(fields, m.createAPIKeyField("traversaal_api_key",
		locale.ToolsSearchEnginesTraversaalKey,
		locale.ToolsSearchEnginesTraversaalKeyDesc,
		config.TraversaalAPIKey,
	))

	// Google API Key
	fields = append(fields, m.createAPIKeyField("google_api_key",
		locale.ToolsSearchEnginesGoogleKey,
		locale.ToolsSearchEnginesGoogleKeyDesc,
		config.GoogleAPIKey,
	))

	// Google CX Key
	fields = append(fields, m.createAPIKeyField("google_cx_key",
		locale.ToolsSearchEnginesGoogleCX,
		locale.ToolsSearchEnginesGoogleCXDesc,
		config.GoogleCXKey,
	))

	// Google LR Key
	fields = append(fields, m.createAPIKeyField("google_lr_key",
		locale.ToolsSearchEnginesGoogleLR,
		locale.ToolsSearchEnginesGoogleLRDesc,
		config.GoogleLRKey,
	))

	// Searxng URL
	fields = append(fields, m.createTextField("searxng_url",
		locale.ToolsSearchEnginesSearxngURL,
		locale.ToolsSearchEnginesSearxngURLDesc,
		config.SearxngURL,
		false,
	))

	// Searxng Categories
	fields = append(fields, m.createTextField("searxng_categories",
		locale.ToolsSearchEnginesSearxngCategories,
		locale.ToolsSearchEnginesSearxngCategoriesDesc,
		config.SearxngCategories,
		false,
	))

	// Searxng Language
	fields = append(fields, m.createSelectTextField("searxng_language",
		locale.ToolsSearchEnginesSearxngLanguage,
		locale.ToolsSearchEnginesSearxngLanguageDesc,
		config.SearxngLanguage,
		[]string{"en", "ch", "fr", "de", "it", "es", "pt", "ru", "zh"},
		false,
	))

	// Searxng Safe Search
	fields = append(fields, m.createSelectTextField("searxng_safe_search",
		locale.ToolsSearchEnginesSearxngSafeSearch,
		locale.ToolsSearchEnginesSearxngSafeSearchDesc,
		config.SearxngSafeSearch,
		[]string{"0", "1", "2"},
		false,
	))

	// Searxng Time Range
	fields = append(fields, m.createSelectTextField("searxng_time_range",
		locale.ToolsSearchEnginesSearxngTimeRange,
		locale.ToolsSearchEnginesSearxngTimeRangeDesc,
		config.SearxngTimeRange,
		[]string{"day", "month", "year"},
		false,
	))

	// Searxng Timeout
	fields = append(fields, m.createTextField("searxng_timeout",
		locale.ToolsSearchEnginesSearxngTimeout,
		locale.ToolsSearchEnginesSearxngTimeoutDesc,
		config.SearxngTimeout,
		false,
	))

	// Internal Analytics Engine (boolean, opt-in browser-based fallback)
	fields = append(fields, m.createBooleanField("internal_enabled",
		locale.ToolsSearchEnginesInternalEnabled,
		locale.ToolsSearchEnginesInternalEnabledDesc,
		config.WebSearchInternalEnabled,
	))

	// Internal Engine Max Sites
	fields = append(fields, m.createIntegerField("internal_max_sites",
		locale.ToolsSearchEnginesInternalMaxSites,
		locale.ToolsSearchEnginesInternalMaxSitesDesc,
		config.WebSearchInternalMaxSites,
		internalMaxSitesMin,
		internalMaxSitesMax,
	))

	// Internal Engine Max Site Bytes
	fields = append(fields, m.createIntegerField("internal_max_site_bytes",
		locale.ToolsSearchEnginesInternalMaxSiteBytes,
		locale.ToolsSearchEnginesInternalMaxSiteBytesDesc,
		config.WebSearchInternalMaxSiteBytes,
		internalMaxSiteBytesMin,
		internalMaxSiteBytesMax,
	))

	m.SetFormFields(fields)
	return nil
}

// Bounds for the internal analytics engine's numeric settings, enforced both on the
// input placeholder (as a hint) and in HandleSave (as validation).
const (
	internalMaxSitesMin     = 1
	internalMaxSitesMax     = 20
	internalMaxSiteBytesMin = 1024   // 1 KB
	internalMaxSiteBytesMax = 102400 // 100 KB
)

func (m *SearchEnginesFormModel) createBooleanField(key, title, description string, envVar loader.EnvVar) FormField {
	input := NewBooleanInput(m.GetStyles(), m.GetWindow(), envVar)

	return FormField{
		Key:         key,
		Title:       title,
		Description: description,
		Required:    false,
		Masked:      false,
		Input:       input,
		Value:       input.Value(),
		Suggestions: input.AvailableSuggestions(),
	}
}

func (m *SearchEnginesFormModel) createAPIKeyField(key, title, description string, envVar loader.EnvVar) FormField {
	return m.createTextField(key, title, description, envVar, true)
}

func (m *SearchEnginesFormModel) createTextField(key, title, description string, envVar loader.EnvVar, masked bool) FormField {
	input := NewTextInput(m.GetStyles(), m.GetWindow(), envVar)

	return FormField{
		Key:         key,
		Title:       title,
		Description: description,
		Required:    false,
		Masked:      masked,
		Input:       input,
		Value:       input.Value(),
	}
}

func (m *SearchEnginesFormModel) createSelectTextField(key, title, description string, envVar loader.EnvVar, suggestions []string, masked bool) FormField {
	input := NewTextInput(m.GetStyles(), m.GetWindow(), envVar)
	input.ShowSuggestions = true
	input.SetSuggestions(suggestions)

	return FormField{
		Key:         key,
		Title:       title,
		Description: description,
		Required:    false,
		Masked:      masked,
		Input:       input,
		Value:       input.Value(),
		Suggestions: suggestions,
	}
}

func (m *SearchEnginesFormModel) createIntegerField(key, title, description string, envVar loader.EnvVar, min, max int) FormField {
	input := NewTextInput(m.GetStyles(), m.GetWindow(), envVar)

	if envVar.Default != "" {
		input.Placeholder = fmt.Sprintf("%s (%d-%d)", envVar.Default, min, max)
	} else {
		input.Placeholder = fmt.Sprintf("(%d-%d)", min, max)
	}

	return FormField{
		Key:         key,
		Title:       title,
		Description: description,
		Required:    false,
		Masked:      false,
		Input:       input,
		Value:       input.Value(),
	}
}

func (m *SearchEnginesFormModel) validateIntegerField(value, fieldName string, min, max int) error {
	if value == "" {
		return nil
	}

	intVal, err := strconv.Atoi(value)
	if err != nil {
		return fmt.Errorf("invalid integer value for %s: %s", fieldName, value)
	}

	if intVal < min || intVal > max {
		return fmt.Errorf("%s must be between %d and %d", fieldName, min, max)
	}

	return nil
}

func (m *SearchEnginesFormModel) GetFormTitle() string {
	return locale.ToolsSearchEnginesFormTitle
}

func (m *SearchEnginesFormModel) GetFormDescription() string {
	return locale.ToolsSearchEnginesFormDescription
}

func (m *SearchEnginesFormModel) GetFormName() string {
	return locale.ToolsSearchEnginesFo
```

### Core Architecture Module: `backend/cmd/installer/wizard/terminal/vt/utils.go`
```
package vt

func clamp(v, low, high int) int {
	if high < low {
		low, high = high, low
	}
	return min(high, max(low, v))
}

```

### Core Architecture Module: `backend/pkg/database/statement_timeout.go`
```
package database

import (
	"fmt"
	"net/url"
	"strings"
	"time"
)

// StatementTimeout is the ceiling Postgres puts on one statement.
const StatementTimeout = 25 * time.Second

// WithStatementTimeout returns dsn with a ceiling Postgres itself enforces.
//
// It is the only ceiling the REST services have: they reach the database
// through GORM v1, whose API takes no context, so cancelling a request cannot
// reach a query already in flight.
func WithStatementTimeout(dsn string, timeout time.Duration) (string, error) {
	parsed, err := url.Parse(dsn)
	if err != nil {
		return "", fmt.Errorf("failed to parse the database URL: %w", err)
	}

	query := parsed.Query()

	if strings.Contains(query.Get("options"), "statement_timeout") {
		return dsn, nil
	}

	setting := fmt.Sprintf("-c statement_timeout=%d", timeout.Milliseconds())
	if existing := query.Get("options"); existing != "" {
		setting = existing + " " + setting
	}

	query.Set("options", setting)
	parsed.RawQuery = query.Encode()

	return parsed.String(), nil
}

```

### Core Architecture Module: `backend/pkg/docker/worker_daemon.go`
```
package docker

import (
	"context"
	"errors"
	"fmt"
	"io/fs"
	"os"
	"path/filepath"
	"strings"
	"time"

	"pentagi/pkg/config"

	cerrdefs "github.com/containerd/errdefs"
	"github.com/moby/moby/client"
	"github.com/sirupsen/logrus"
)

// daemonProbeTimeout bounds the startup check. Reaching the sandbox daemon is
// diagnostic only, so a slow or unreachable endpoint must delay the boot by a
// few seconds at most and never block it.
const daemonProbeTimeout = 5 * time.Second

// runsPentagi reports whether the daemon behind cli is the one running PentAGI
// itself, found the way the rest of this package finds its own container: a
// running container whose configured hostname matches this process's.
//
// A false answer is only trustworthy when err is nil. A daemon that cannot be
// listed says nothing about what it runs.
func runsPentagi(ctx context.Context, cli *client.Client) (bool, error) {
	hostname, err := os.Hostname()
	if err != nil {
		return false, fmt.Errorf("failed to read hostname: %w", err)
	}

	list, err := cli.ContainerList(ctx, client.ContainerListOptions{
		Filters: make(client.Filters).Add("status", "running"),
	})
	if err != nil {
		return false, fmt.Errorf("failed to list containers: %w", err)
	}

	for _, item := range list.Items {
		result, err := cli.ContainerInspect(ctx, item.ID, client.ContainerInspectOptions{})
		if cerrdefs.IsNotFound(err) {
			continue
		}
		if err != nil {
			return false, fmt.Errorf("failed to inspect container %s: %w", item.ID, err)
		}
		if result.Container.Config.Hostname == hostname {
			return true, nil
		}
	}

	return false, nil
}

func workerDaemonClient(cfg *config.Config) (*client.Client, error) {
	opts := []client.Opt{client.WithHost(cfg.DockerInsideHost)}
	if cfg.DockerInsideTLSVerify != "" && cfg.DockerInsideCertPath != "" {
		dir := strings.TrimRight(cfg.DockerInsideCertPath, "/")
		opts = append(opts, client.WithTLSClientConfig(
			dir+"/ca.pem", dir+"/cert.pem", dir+"/key.pem"))
	}

	return client.New(opts...)
}

// logWorkerDaemonIsolation reports, once at startup, how much of the host an
// agent reaches through the Docker access it is given.
//
// The question that decides it is whether PentAGI's own container is visible on
// a daemon: if it is, that daemon is the host daemon, and an agent holding it
// can start a privileged container and take the node -- PentAGI, the other
// flows and the certificates on it included. Separate orchestration and sandbox
// daemons are the shape examples/guides/worker_node.md describes, and the only
// one where an escape stays inside the sandbox tier.
func logWorkerDaemonIsolation(ctx context.Context, cfg *config.Config, cli *client.Client) {
	if cfg == nil || !cfg.DockerInside {
		return
	}

	ctx, cancel := context.WithTimeout(ctx, daemonProbeTimeout)
	defer cancel()

	if socket, autodetect := cfg.WorkerDockerSocket(); socket != "" || autodetect {
		if cfg.DockerInsideHost != "" {
			logrus.WithField("docker_inside_host", cfg.DockerInsideHost).Warn("DOCKER_INSIDE=true: " +
				"DOCKER_SOCKET is set, so the host socket is mounted into every worker alongside " +
				"DOCKER_INSIDE_HOST; unset DOCKER_SOCKET to give sandboxes only the daemon of their own")
		}
		logSharedDaemon(ctx, cfg, cli)
		return
	}

	if workerCertsLiveElsewhere(cfg) {
		// The certificates are only unreadable from here, so the check has to
		// happen where they exist -- inside the worker, at creation.
		logrus.WithField("docker_inside_host", cfg.DockerInsideHost).Info("DOCKER_INSIDE=true: " +
			"sandboxes reach DOCKER_INSIDE_HOST with TLS client certificates that live on the worker " +
			"node, so this process cannot open that endpoint itself")
		return
	}

	workerCli, err := workerDaemonClient(cfg)
	if err != nil {
		logrus.WithError(err).Warn("DOCKER_INSIDE=true: could not open a client against " +
			"DOCKER_INSIDE_HOST to check what agents reach through it; verify that endpoint by hand")
		return
	}
	defer workerCli.Close()

	logSeparateDaemon(ctx, cfg, cli, workerCli)
}

func workerCertsLiveElsewhere(cfg *config.Config) bool {
	if cfg.DockerInsideTLSVerify == "" || cfg.DockerInsideCertPath == "" {
		return false
	}
	_, err := os.Stat(filepath.Join(cfg.DockerInsideCertPath, "ca.pem"))
	return errors.Is(err, fs.ErrNotExist)
}

// logSharedDaemon covers DOCKER_SOCKET and the autodetected socket: agents are
// given the same daemon PentAGI orchestrates on.
func logSharedDaemon(ctx context.Context, cfg *config.Config, cli *client.Client) {
	logger := logrus.WithField("worker_docker", workerDockerDescription(cfg))

	isHost, err := runsPentagi(ctx, cli)
	switch {
	case err != nil:
		logger.WithError(err).Warn("DOCKER_INSIDE=true: agents share the daemon PentAGI " +
			"orchestrates on, and whether that daemon also runs PentAGI could not be determined; " +
			"check the daemon's hardening and whether an authorization plugin is installed")
	case isHost:
		logger.Warn("DOCKER_INSIDE=true: agents are given the host daemon, the one running " +
			"PentAGI itself. An agent that escapes its sandbox can start a privileged container " +
			"and take the node, PentAGI and the other flows' containers with it. Check the " +
			"daemon's hardening and whether an authorization plugin is installed, or move " +
			"sandboxes onto their own daemon with DOCKER_INSIDE_HOST " +
			"(see examples/guides/worker_node.md)")
	default:
		logger.Warn("DOCKER_INSIDE=true: agents and the orchestrator share one daemon, and PentAGI's " +
			"own container is not among the containers it runs. If PentAGI runs in a container " +
			"elsewhere, an escape does not reach this process; if it runs directly on this host, it " +
			"does. Check the daemon's hardening and whether an authorization plugin is installed")
	}
}

// logSeparateDaemon covers DOCKER_INSIDE_HOST: agents are pointed at an endpoint
// of their own, which is the arrangement worth confirming rather than assuming.
func logSeparateDaemon(ctx context.Context, cfg *config.Config, cli, workerCli *client.Client) {
	logger := logrus.WithField("docker_inside_host", cfg.DockerInsideHost)

	if sameDaemon(ctx, cli, workerCli) {
		logger.Warn("DOCKER_INSIDE=true: DOCKER_INSIDE_HOST names the daemon PentAGI orchestrates on, " +
			"so sandboxes do not get a daemon of their own")
		logSharedDaemon(ctx, cfg, cli)
		return
	}

	workerRunsPentagi, workerErr := runsPentagi(ctx, workerCli)
	if workerErr != nil {
		logger.WithError(workerErr).Warn("DOCKER_INSIDE=true: agents are pointed at a separate " +
			"daemon that could not be listed, so whether it also runs PentAGI is unknown; " +
			"verify it by hand")
		return
	}

	if workerRunsPentagi {
		logger.Warn("DOCKER_INSIDE=true: the daemon designated for sandboxes is the one running " +
			"PentAGI itself, so pointing agents at it grants what a separate daemon exists to " +
			"withhold. Point DOCKER_INSIDE_HOST at a daemon that does not run PentAGI " +
			"(see examples/guides/worker_node.md)")
		return
	}

	orchestratorIsHost, err := runsPentagi(ctx, cli)
	switch {
	case err != nil:
		logger.WithError(err).Info("DOCKER_INSIDE=true: sandboxes use a daemon of their own and " +
			"PentAGI does not run on it, so an escape stays inside the sandbox tier; whether PentAGI " +
			"runs on the daemon it orchestrates on could not be determined")
	case orchestratorIsHost:
		logger.Info("DOCKER_INSIDE=true: sandboxes use a daemon of their own and PentAGI does " +
			"not run on it, so an escape stays inside the sandbox tier")
	default:
		logger.Info("DOCKER_INSIDE=true: sandboxes use a daemon of their own, separate from the one " +
			"PentAGI orchestrates on, and PentAGI's own container is on neither")
	}
}

func workerDockerDescription(cfg *config.Config) string {
	if cfg.DockerSocket != "" {
		return cfg.DockerSocket
	}
	return "autodetected host socket"
}

func sameDaemon(ctx context.Context, a, b *client.Client) bool {
	first, err := a.Info(ctx, client.InfoOptions{})
	if err != nil {
		return false
	}
	second, err := b.Info(ctx, client.InfoOptions{})
	if err != nil {
		return false
	}
	return first.Info.ID != "" && first.Info.ID == second.Info.ID
}

```

### Core Architecture Module: `backend/pkg/observability/langfuse/api/annotationqueues.go`
```
// Code generated by Fern. DO NOT EDIT.

package api

import (
	json "encoding/json"
	fmt "fmt"
	big "math/big"
	internal "pentagi/pkg/observability/langfuse/api/internal"
	time "time"
)

var (
	createAnnotationQueueRequestFieldName           = big.NewInt(1 << 0)
	createAnnotationQueueRequestFieldDescription    = big.NewInt(1 << 1)
	createAnnotationQueueRequestFieldScoreConfigIDs = big.NewInt(1 << 2)
)

type CreateAnnotationQueueRequest struct {
	Name           string   `json:"name" url:"-"`
	Description    *string  `json:"description,omitempty" url:"-"`
	ScoreConfigIDs []string `json:"scoreConfigIds" url:"-"`

	// Private bitmask of fields set to an explicit value and therefore not to be omitted
	explicitFields *big.Int `json:"-" url:"-"`
}

func (c *CreateAnnotationQueueRequest) require(field *big.Int) {
	if c.explicitFields == nil {
		c.explicitFields = big.NewInt(0)
	}
	c.explicitFields.Or(c.explicitFields, field)
}

// SetName sets the Name field and marks it as non-optional;
// this prevents an empty or null value for this field from being omitted during serialization.
func (c *CreateAnnotationQueueRequest) SetName(name string) {
	c.Name = name
	c.require(createAnnotationQueueRequestFieldName)
}

// SetDescription sets the Description field and marks it as non-optional;
// this prevents an empty or null value for this field from being omitted during serialization.
func (c *CreateAnnotationQueueRequest) SetDescription(description *string) {
	c.Description = description
	c.require(createAnnotationQueueRequestFieldDescription)
}

// SetScoreConfigIDs sets the ScoreConfigIDs field and marks it as non-optional;
// this prevents an empty or null value for this field from being omitted during serialization.
func (c *CreateAnnotationQueueRequest) SetScoreConfigIDs(scoreConfigIDs []string) {
	c.ScoreConfigIDs = scoreConfigIDs
	c.require(createAnnotationQueueRequestFieldScoreConfigIDs)
}

func (c *CreateAnnotationQueueRequest) UnmarshalJSON(data []byte) error {
	type unmarshaler CreateAnnotationQueueRequest
	var body unmarshaler
	if err := json.Unmarshal(data, &body); err != nil {
		return err
	}
	*c = CreateAnnotationQueueRequest(body)
	return nil
}

func (c *CreateAnnotationQueueRequest) MarshalJSON() ([]byte, error) {
	type embed CreateAnnotationQueueRequest
	var marshaler = struct {
		embed
	}{
		embed: embed(*c),
	}
	explicitMarshaler := internal.HandleExplicitFields(marshaler, c.explicitFields)
	return json.Marshal(explicitMarshaler)
}

var (
	annotationQueuesCreateQueueAssignmentRequestFieldQueueID = big.NewInt(1 << 0)
)

type AnnotationQueuesCreateQueueAssignmentRequest struct {
	// The unique identifier of the annotation queue
	QueueID string                            `json:"-" url:"-"`
	Body    *AnnotationQueueAssignmentRequest `json:"-" url:"-"`

	// Private bitmask of fields set to an explicit value and therefore not to be omitted
	explicitFields *big.Int `json:"-" url:"-"`
}

func (a *AnnotationQueuesCreateQueueAssignmentRequest) require(field *big.Int) {
	if a.explicitFields == nil {
		a.explicitFields = big.NewInt(0)
	}
	a.explicitFields.Or(a.explicitFields, field)
}

// SetQueueID sets the QueueID field and marks it as non-optional;
// this prevents an empty or null value for this field from being omitted during serialization.
func (a *AnnotationQueuesCreateQueueAssignmentRequest) SetQueueID(queueID string) {
	a.QueueID = queueID
	a.require(annotationQueuesCreateQueueAssignmentRequestFieldQueueID)
}

func (a *AnnotationQueuesCreateQueueAssignmentRequest) UnmarshalJSON(data []byte) error {
	body := new(AnnotationQueueAssignmentRequest)
	if err := json.Unmarshal(data, &body); err != nil {
		return err
	}
	a.Body = body
	return nil
}

func (a *AnnotationQueuesCreateQueueAssignmentRequest) MarshalJSON() ([]byte, error) {
	return json.Marshal(a.Body)
}

var (
	createAnnotationQueueItemRequestFieldQueueID    = big.NewInt(1 << 0)
	createAnnotationQueueItemRequestFieldObjectID   = big.NewInt(1 << 1)
	createAnnotationQueueItemRequestFieldObjectType = big.NewInt(1 << 2)
	createAnnotationQueueItemRequestFieldStatus     = big.NewInt(1 << 3)
)

type CreateAnnotationQueueItemRequest struct {
	// The unique identifier of the annotation queue
	QueueID    string                    `json:"-" url:"-"`
	ObjectID   string                    `json:"objectId" url:"-"`
	ObjectType AnnotationQueueObjectType `json:"objectType" url:"-"`
	// Defaults to PENDING for new queue items
	Status *AnnotationQueueStatus `json:"status,omitempty" url:"-"`

	// Private bitmask of fields set to an explicit value and therefore not to be omitted
	explicitFields *big.Int `json:"-" url:"-"`
}

func (c *CreateAnnotationQueueItemRequest) require(field *big.Int) {
	if c.explicitFields == nil {
		c.explicitFields = big.NewInt(0)
	}
	c.explicitFields.Or(c.explicitFields, field)
}

// SetQueueID sets the QueueID field and marks it as non-optional;
// this prevents an empty or null value for this field from being omitted during serialization.
func (c *CreateAnnotationQueueItemRequest) SetQueueID(queueID string) {
	c.QueueID = queueID
	c.require(createAnnotationQueueItemRequestFieldQueueID)
}

// SetObjectID sets the ObjectID field and marks it as non-optional;
// this prevents an empty or null value for this field from being omitted during serialization.
func (c *CreateAnnotationQueueItemRequest) SetObjectID(objectID string) {
	c.ObjectID = objectID
	c.require(createAnnotationQueueItemRequestFieldObjectID)
}

// SetObjectType sets the ObjectType field and marks it as non-optional;
// this prevents an empty or null value for this field from being omitted during serialization.
func (c *CreateAnnotationQueueItemRequest) SetObjectType(objectType AnnotationQueueObjectType) {
	c.ObjectType = objectType
	c.require(createAnnotationQueueItemRequestFieldObjectType)
}

// SetStatus sets the Status field and marks it as non-optional;
// this prevents an empty or null value for this field from being omitted during serialization.
func (c *CreateAnnotationQueueItemRequest) SetStatus(status *AnnotationQueueStatus) {
	c.Status = status
	c.require(createAnnotationQueueItemRequestFieldStatus)
}

func (c *CreateAnnotationQueueItemRequest) UnmarshalJSON(data []byte) error {
	type unmarshaler CreateAnnotationQueueItemRequest
	var body unmarshaler
	if err := json.Unmarshal(data, &body); err != nil {
		return err
	}
	*c = CreateAnnotationQueueItemRequest(body)
	return nil
}

func (c *CreateAnnotationQueueItemRequest) MarshalJSON() ([]byte, error) {
	type embed CreateAnnotationQueueItemRequest
	var marshaler = struct {
		embed
	}{
		embed: embed(*c),
	}
	explicitMarshaler := internal.HandleExplicitFields(marshaler, c.explicitFields)
	return json.Marshal(explicitMarshaler)
}

var (
	annotationQueuesDeleteQueueAssignmentRequestFieldQueueID = big.NewInt(1 << 0)
)

type AnnotationQueuesDeleteQueueAssignmentRequest struct {
	// The unique identifier of the annotation queue
	QueueID string                            `json:"-" url:"-"`
	Body    *AnnotationQueueAssignmentRequest `json:"-" url:"-"`

	// Private bitmask of fields set to an explicit value and therefore not to be omitted
	explicitFields *big.Int `json:"-" url:"-"`
}

func (a *AnnotationQueuesDeleteQueueAssignmentRequest) require(field *big.Int) {
	if a.explicitFields == nil {
		a.explicitFields = big.NewInt(0)
	}
	a.explicitFields.Or(a.explicitFields, field)
}

// SetQueueID sets the QueueID field and marks it as non-optional;
// this prevents an empty or null value for this field from being omitted during serialization.
func (a *AnnotationQueuesDeleteQueueAssignmentRequest) SetQueueID(queueID string) {
	a.QueueID = queueID
	a.require(annotationQueuesDeleteQueueAssignmentRequestFieldQueueID)
}

func (a *AnnotationQueuesDeleteQueueAssignmentRequest) UnmarshalJSON(data []byte) error {
	body := new(AnnotationQueueAssignmentRequest)
	if err := json.Unmarshal(data, &body); err != nil {
		return err
	}
	a.Body = body
	return nil
}

func (a *AnnotationQueuesDeleteQueueAssignmentRequest) MarshalJSON() ([]byte, error) {
	return json.Marshal(a.Body)
}

var (
	annotationQueuesDeleteQueueItemRequestFieldQueueID = big.NewInt(1 << 0)
	annotationQueuesDeleteQueueItemRequestFieldItemID  = big.NewInt(1 << 1)
)

type AnnotationQueuesDeleteQueueItemRequest struct {
	// The unique identifier of the annotation queue
	QueueID string `json:"-" url:"-"`
	// The unique identifier of the annotation queue item
	ItemID string `json:"-" url:"-"`

	// Private bitmask of fields set to an explicit value and therefore not to be omitted
	explicitFields *big.Int `json:"-" url:"-"`
}

func (a *AnnotationQueuesDeleteQueueItemRequest) require(field *big.Int) {
	if a.explicitFields == nil {
		a.explicitFields = big.NewInt(0)
	}
	a.explicitFields.Or(a.explicitFields, field)
}

// SetQueueID sets the QueueID field and marks it as non-optional;
// this prevents an empty or null value for this field from being omitted during serialization.
func (a *AnnotationQueuesDeleteQueueItemRequest) SetQueueID(queueID string) {
	a.QueueID = queueID
	a.require(annotationQueuesDeleteQueueItemRequestFieldQueueID)
}

// SetItemID sets the ItemID field and marks it as non-optional;
// this prevents an empty or null value for this field from being omitted during serialization.
func (a *AnnotationQueuesDeleteQueueItemRequest) SetItemID(itemID string) {
	a.ItemID = itemID
	a.require(annotationQueuesDeleteQueueItemRequestFieldItemID)
}

var (
	annotationQueuesGetQueueRequestFieldQueueID = big.NewInt(1 << 0)
)

type AnnotationQueuesGetQueueRequest struct {
	// The unique identifier of the annotation queue
	QueueID string `json:"-" url:"-"`

	// Private bitmask of fields set to an explicit value and therefore not to be omitted
	explicitFields *big.Int `json:"-" url:"-"`
}

func (a *AnnotationQueuesGetQueueRequest) require(field *big.Int) {
	if a.explicitFields == nil {
		a.explicitFields = big.NewInt(0)
	}
	a.explicitFields.Or(a.explicitFields, field)
}

// SetQueueID sets the Queu
```

### Core Architecture Module: `backend/pkg/observability/langfuse/api/annotationqueues/client.go`
```
// Code generated by Fern. DO NOT EDIT.

package annotationqueues

import (
    core "pentagi/pkg/observability/langfuse/api/core"
    internal "pentagi/pkg/observability/langfuse/api/internal"
    context "context"
    api "pentagi/pkg/observability/langfuse/api"
    option "pentagi/pkg/observability/langfuse/api/option"
)


type Client struct {
    WithRawResponse *RawClient

    options *core.RequestOptions
    baseURL string
    caller *internal.Caller
}

func NewClient(options *core.RequestOptions) *Client {
    return &Client{
        WithRawResponse: NewRawClient(options),
        options: options,
        baseURL: options.BaseURL,
        caller: internal.NewCaller(
            &internal.CallerParams{
                Client: options.HTTPClient,
                MaxAttempts: options.MaxAttempts,
            },
        ),
    }
}

// Get all annotation queues
func (c *Client) Listqueues(
    ctx context.Context,
    request *api.AnnotationQueuesListQueuesRequest,
    opts ...option.RequestOption,
) (*api.PaginatedAnnotationQueues, error){
    response, err := c.WithRawResponse.Listqueues(
        ctx,
        request,
        opts...,
    )
    if err != nil {
        return nil, err
    }
    return response.Body, nil
}

// Create an annotation queue
func (c *Client) Createqueue(
    ctx context.Context,
    request *api.CreateAnnotationQueueRequest,
    opts ...option.RequestOption,
) (*api.AnnotationQueue, error){
    response, err := c.WithRawResponse.Createqueue(
        ctx,
        request,
        opts...,
    )
    if err != nil {
        return nil, err
    }
    return response.Body, nil
}

// Get an annotation queue by ID
func (c *Client) Getqueue(
    ctx context.Context,
    request *api.AnnotationQueuesGetQueueRequest,
    opts ...option.RequestOption,
) (*api.AnnotationQueue, error){
    response, err := c.WithRawResponse.Getqueue(
        ctx,
        request,
        opts...,
    )
    if err != nil {
        return nil, err
    }
    return response.Body, nil
}

// Get items for a specific annotation queue
func (c *Client) Listqueueitems(
    ctx context.Context,
    request *api.AnnotationQueuesListQueueItemsRequest,
    opts ...option.RequestOption,
) (*api.PaginatedAnnotationQueueItems, error){
    response, err := c.WithRawResponse.Listqueueitems(
        ctx,
        request,
        opts...,
    )
    if err != nil {
        return nil, err
    }
    return response.Body, nil
}

// Add an item to an annotation queue
func (c *Client) Createqueueitem(
    ctx context.Context,
    request *api.CreateAnnotationQueueItemRequest,
    opts ...option.RequestOption,
) (*api.AnnotationQueueItem, error){
    response, err := c.WithRawResponse.Createqueueitem(
        ctx,
        request,
        opts...,
    )
    if err != nil {
        return nil, err
    }
    return response.Body, nil
}

// Get a specific item from an annotation queue
func (c *Client) Getqueueitem(
    ctx context.Context,
    request *api.AnnotationQueuesGetQueueItemRequest,
    opts ...option.RequestOption,
) (*api.AnnotationQueueItem, error){
    response, err := c.WithRawResponse.Getqueueitem(
        ctx,
        request,
        opts...,
    )
    if err != nil {
        return nil, err
    }
    return response.Body, nil
}

// Remove an item from an annotation queue
func (c *Client) Deletequeueitem(
    ctx context.Context,
    request *api.AnnotationQueuesDeleteQueueItemRequest,
    opts ...option.RequestOption,
) (*api.DeleteAnnotationQueueItemResponse, error){
    response, err := c.WithRawResponse.Deletequeueitem(
        ctx,
        request,
        opts...,
    )
    if err != nil {
        return nil, err
    }
    return response.Body, nil
}

// Update an annotation queue item
func (c *Client) Updatequeueitem(
    ctx context.Context,
    request *api.UpdateAnnotationQueueItemRequest,
    opts ...option.RequestOption,
) (*api.AnnotationQueueItem, error){
    response, err := c.WithRawResponse.Updatequeueitem(
        ctx,
        request,
        opts...,
    )
    if err != nil {
        return nil, err
    }
    return response.Body, nil
}

// Create an assignment for a user to an annotation queue
func (c *Client) Createqueueassignment(
    ctx context.Context,
    request *api.AnnotationQueuesCreateQueueAssignmentRequest,
    opts ...option.RequestOption,
) (*api.CreateAnnotationQueueAssignmentResponse, error){
    response, err := c.WithRawResponse.Createqueueassignment(
        ctx,
        request,
        opts...,
    )
    if err != nil {
        return nil, err
    }
    return response.Body, nil
}

// Delete an assignment for a user to an annotation queue
func (c *Client) Deletequeueassignment(
    ctx context.Context,
    request *api.AnnotationQueuesDeleteQueueAssignmentRequest,
    opts ...option.RequestOption,
) (*api.DeleteAnnotationQueueAssignmentResponse, error){
    response, err := c.WithRawResponse.Deletequeueassignment(
        ctx,
        request,
        opts...,
    )
    if err != nil {
        return nil, err
    }
    return response.Body, nil
}


```

### Core Architecture Module: `backend/pkg/observability/langfuse/api/annotationqueues/raw_client.go`
```
// Code generated by Fern. DO NOT EDIT.

package annotationqueues

import (
    internal "pentagi/pkg/observability/langfuse/api/internal"
    core "pentagi/pkg/observability/langfuse/api/core"
    context "context"
    api "pentagi/pkg/observability/langfuse/api"
    option "pentagi/pkg/observability/langfuse/api/option"
    http "net/http"
)


type RawClient struct {
    baseURL string
    caller *internal.Caller
    options *core.RequestOptions
}

func NewRawClient(options *core.RequestOptions) *RawClient {
    return &RawClient{
        options: options,
        baseURL: options.BaseURL,
        caller: internal.NewCaller(
            &internal.CallerParams{
                Client: options.HTTPClient,
                MaxAttempts: options.MaxAttempts,
            },
        ),
    }
}

func (r *RawClient) Listqueues(
    ctx context.Context,
    request *api.AnnotationQueuesListQueuesRequest,
    opts ...option.RequestOption,
) (*core.Response[*api.PaginatedAnnotationQueues], error){
    options := core.NewRequestOptions(opts...)
    baseURL := internal.ResolveBaseURL(
        options.BaseURL,
        r.baseURL,
        "",
    )
    endpointURL := baseURL + "/api/public/annotation-queues"
    queryParams, err := internal.QueryValues(request)
    if err != nil {
        return nil, err
    }
    if len(queryParams) > 0 {
        endpointURL += "?" + queryParams.Encode()
    }
    headers := internal.MergeHeaders(
        r.options.ToHeader(),
        options.ToHeader(),
    )
    var response *api.PaginatedAnnotationQueues
    raw, err := r.caller.Call(
        ctx,
        &internal.CallParams{
            URL: endpointURL,
            Method: http.MethodGet,
            Headers: headers,
            MaxAttempts: options.MaxAttempts,
            BodyProperties: options.BodyProperties,
            QueryParameters: options.QueryParameters,
            Client: options.HTTPClient,
            Response: &response,
            ErrorDecoder: internal.NewErrorDecoder(api.ErrorCodes),
        },
    )
    if err != nil {
        return nil, err
    }
    return &core.Response[*api.PaginatedAnnotationQueues]{
        StatusCode: raw.StatusCode,
        Header: raw.Header,
        Body: response,
    }, nil
}

func (r *RawClient) Createqueue(
    ctx context.Context,
    request *api.CreateAnnotationQueueRequest,
    opts ...option.RequestOption,
) (*core.Response[*api.AnnotationQueue], error){
    options := core.NewRequestOptions(opts...)
    baseURL := internal.ResolveBaseURL(
        options.BaseURL,
        r.baseURL,
        "",
    )
    endpointURL := baseURL + "/api/public/annotation-queues"
    headers := internal.MergeHeaders(
        r.options.ToHeader(),
        options.ToHeader(),
    )
    headers.Add("Content-Type", "application/json")
    var response *api.AnnotationQueue
    raw, err := r.caller.Call(
        ctx,
        &internal.CallParams{
            URL: endpointURL,
            Method: http.MethodPost,
            Headers: headers,
            MaxAttempts: options.MaxAttempts,
            BodyProperties: options.BodyProperties,
            QueryParameters: options.QueryParameters,
            Client: options.HTTPClient,
            Request: request,
            Response: &response,
            ErrorDecoder: internal.NewErrorDecoder(api.ErrorCodes),
        },
    )
    if err != nil {
        return nil, err
    }
    return &core.Response[*api.AnnotationQueue]{
        StatusCode: raw.StatusCode,
        Header: raw.Header,
        Body: response,
    }, nil
}

func (r *RawClient) Getqueue(
    ctx context.Context,
    request *api.AnnotationQueuesGetQueueRequest,
    opts ...option.RequestOption,
) (*core.Response[*api.AnnotationQueue], error){
    options := core.NewRequestOptions(opts...)
    baseURL := internal.ResolveBaseURL(
        options.BaseURL,
        r.baseURL,
        "",
    )
    endpointURL := internal.EncodeURL(
        baseURL + "/api/public/annotation-queues/%v",
        request.QueueID,
    )
    headers := internal.MergeHeaders(
        r.options.ToHeader(),
        options.ToHeader(),
    )
    var response *api.AnnotationQueue
    raw, err := r.caller.Call(
        ctx,
        &internal.CallParams{
            URL: endpointURL,
            Method: http.MethodGet,
            Headers: headers,
            MaxAttempts: options.MaxAttempts,
            BodyProperties: options.BodyProperties,
            QueryParameters: options.QueryParameters,
            Client: options.HTTPClient,
            Response: &response,
            ErrorDecoder: internal.NewErrorDecoder(api.ErrorCodes),
        },
    )
    if err != nil {
        return nil, err
    }
    return &core.Response[*api.AnnotationQueue]{
        StatusCode: raw.StatusCode,
        Header: raw.Header,
        Body: response,
    }, nil
}

func (r *RawClient) Listqueueitems(
    ctx context.Context,
    request *api.AnnotationQueuesListQueueItemsRequest,
    opts ...option.RequestOption,
) (*core.Response[*api.PaginatedAnnotationQueueItems], error){
    options := core.NewRequestOptions(opts...)
    baseURL := internal.ResolveBaseURL(
        options.BaseURL,
        r.baseURL,
        "",
    )
    endpointURL := internal.EncodeURL(
        baseURL + "/api/public/annotation-queues/%v/items",
        request.QueueID,
    )
    queryParams, err := internal.QueryValues(request)
    if err != nil {
        return nil, err
    }
    if len(queryParams) > 0 {
        endpointURL += "?" + queryParams.Encode()
    }
    headers := internal.MergeHeaders(
        r.options.ToHeader(),
        options.ToHeader(),
    )
    var response *api.PaginatedAnnotationQueueItems
    raw, err := r.caller.Call(
        ctx,
        &internal.CallParams{
            URL: endpointURL,
            Method: http.MethodGet,
            Headers: headers,
            MaxAttempts: options.MaxAttempts,
            BodyProperties: options.BodyProperties,
            QueryParameters: options.QueryParameters,
            Client: options.HTTPClient,
            Response: &response,
            ErrorDecoder: internal.NewErrorDecoder(api.ErrorCodes),
        },
    )
    if err != nil {
        return nil, err
    }
    return &core.Response[*api.PaginatedAnnotationQueueItems]{
        StatusCode: raw.StatusCode,
        Header: raw.Header,
        Body: response,
    }, nil
}

func (r *RawClient) Createqueueitem(
    ctx context.Context,
    request *api.CreateAnnotationQueueItemRequest,
    opts ...option.RequestOption,
) (*core.Response[*api.AnnotationQueueItem], error){
    options := core.NewRequestOptions(opts...)
    baseURL := internal.ResolveBaseURL(
        options.BaseURL,
        r.baseURL,
        "",
    )
    endpointURL := internal.EncodeURL(
        baseURL + "/api/public/annotation-queues/%v/items",
        request.QueueID,
    )
    headers := internal.MergeHeaders(
        r.options.ToHeader(),
        options.ToHeader(),
    )
    headers.Add("Content-Type", "application/json")
    var response *api.AnnotationQueueItem
    raw, err := r.caller.Call(
        ctx,
        &internal.CallParams{
            URL: endpointURL,
            Method: http.MethodPost,
            Headers: headers,
            MaxAttempts: options.MaxAttempts,
            BodyProperties: options.BodyProperties,
            QueryParameters: options.QueryParameters,
            Client: options.HTTPClient,
            Request: request,
            Response: &response,
            ErrorDecoder: internal.NewErrorDecoder(api.ErrorCodes),
        },
    )
    if err != nil {
        return nil, err
    }
    return &core.Response[*api.AnnotationQueueItem]{
        StatusCode: raw.StatusCode,
        Header: raw.Header,
        Body: response,
    }, nil
}

func (r *RawClient) Getqueueitem(
    ctx context.Context,
    request *api.AnnotationQueuesGetQueueItemRequest,
    opts ...option.RequestOption,
) (*core.Response[*api.AnnotationQueueItem], error){
    options := core.NewRequestOptions(opts...)
    baseURL := internal.ResolveBaseURL(
        options.BaseURL,
        r.baseURL,
        "",
    )
    endpointURL := internal.EncodeURL(
        baseURL + "/api/public/annotation-queues/%v/items/%v",
        request.QueueID,
        request.ItemID,
    )
    headers := internal.MergeHeaders(
        r.options.ToHeader(),
        options.ToHeader(),
    )
    var response *api.AnnotationQueueItem
    raw, err := r.caller.Call(
        ctx,
        &internal.CallParams{
            URL: endpointURL,
            Method: http.MethodGet,
            Headers: headers,
            MaxAttempts: options.MaxAttempts,
            BodyProperties: options.BodyProperties,
            QueryParameters: options.QueryParameters,
            Client: options.HTTPClient,
            Response: &response,
            ErrorDecoder: internal.NewErrorDecoder(api.ErrorCodes),
        },
    )
    if err != nil {
        return nil, err
    }
    return &core.Response[*api.AnnotationQueueItem]{
        StatusCode: raw.StatusCode,
        Header: raw.Header,
        Body: response,
    }, nil
}

func (r *RawClient) Deletequeueitem(
    ctx context.Context,
    request *api.AnnotationQueuesDeleteQueueItemRequest,
    opts ...option.RequestOption,
) (*core.Response[*api.DeleteAnnotationQueueItemResponse], error){
    options := core.NewRequestOptions(opts...)
    baseURL := internal.ResolveBaseURL(
        options.BaseURL,
        r.baseURL,
        "",
    )
    endpointURL := internal.EncodeURL(
        baseURL + "/api/public/annotation-queues/%v/items/%v",
        request.QueueID,
        request.ItemID,
    )
    headers := internal.MergeHeaders(
        r.options.ToHeader(),
        options.ToHeader(),
    )
    var response *api.DeleteAnnotationQueueItemResponse
    raw, err := r.caller.Call(
        ctx,
        &internal.CallParams{
            URL: endpointURL,
            Method: http.MethodDelete,
            Headers: headers,
            MaxAttempts: options.MaxAttempts,
            
```

### Core Architecture Module: `backend/pkg/observability/langfuse/api/core/api_error.go`
```
package core

import (
	"fmt"
	"net/http"
)

// APIError is a lightweight wrapper around the standard error
// interface that preserves the status code from the RPC, if any.
type APIError struct {
	err error

	StatusCode int         `json:"-"`
	Header     http.Header `json:"-"`
}

// NewAPIError constructs a new API error.
func NewAPIError(statusCode int, header http.Header, err error) *APIError {
	return &APIError{
		err:        err,
		Header:     header,
		StatusCode: statusCode,
	}
}

// Unwrap returns the underlying error. This also makes the error compatible
// with errors.As and errors.Is.
func (a *APIError) Unwrap() error {
	if a == nil {
		return nil
	}
	return a.err
}

// Error returns the API error's message.
func (a *APIError) Error() string {
	if a == nil || (a.err == nil && a.StatusCode == 0) {
		return ""
	}
	if a.err == nil {
		return fmt.Sprintf("%d", a.StatusCode)
	}
	if a.StatusCode == 0 {
		return a.err.Error()
	}
	return fmt.Sprintf("%d: %s", a.StatusCode, a.err.Error())
}

```

### Core Architecture Module: `backend/pkg/observability/langfuse/api/core/http.go`
```
package core

import "net/http"

// HTTPClient is an interface for a subset of the *http.Client.
type HTTPClient interface {
	Do(*http.Request) (*http.Response, error)
}

// Response is an HTTP response from an HTTP client.
type Response[T any] struct {
	StatusCode int
	Header     http.Header
	Body       T
}

```

### Core Architecture Module: `backend/pkg/observability/langfuse/api/core/request_option.go`
```
// Code generated by Fern. DO NOT EDIT.

package core

import (
	base64 "encoding/base64"
	http "net/http"
	url "net/url"
)

// RequestOption adapts the behavior of the client or an individual request.
type RequestOption interface {
	applyRequestOptions(*RequestOptions)
}

// RequestOptions defines all of the possible request options.
//
// This type is primarily used by the generated code and is not meant
// to be used directly; use the option package instead.
type RequestOptions struct {
	BaseURL         string
	HTTPClient      HTTPClient
	HTTPHeader      http.Header
	BodyProperties  map[string]interface{}
	QueryParameters url.Values
	MaxAttempts     uint
	Username        string
	Password        string
}

// NewRequestOptions returns a new *RequestOptions value.
//
// This function is primarily used by the generated code and is not meant
// to be used directly; use RequestOption instead.
func NewRequestOptions(opts ...RequestOption) *RequestOptions {
	options := &RequestOptions{
		HTTPHeader:      make(http.Header),
		BodyProperties:  make(map[string]interface{}),
		QueryParameters: make(url.Values),
	}
	for _, opt := range opts {
		opt.applyRequestOptions(options)
	}
	return options
}

// ToHeader maps the configured request options into a http.Header used
// for the request(s).
func (r *RequestOptions) ToHeader() http.Header {
	header := r.cloneHeader()
	if r.Username != "" && r.Password != "" {
		header.Set("Authorization", "Basic "+base64.StdEncoding.EncodeToString([]byte(r.Username+":"+r.Password)))
	}
	return header
}

func (r *RequestOptions) cloneHeader() http.Header {
	return r.HTTPHeader.Clone()
}

// BaseURLOption implements the RequestOption interface.
type BaseURLOption struct {
	BaseURL string
}

func (b *BaseURLOption) applyRequestOptions(opts *RequestOptions) {
	opts.BaseURL = b.BaseURL
}

// HTTPClientOption implements the RequestOption interface.
type HTTPClientOption struct {
	HTTPClient HTTPClient
}

func (h *HTTPClientOption) applyRequestOptions(opts *RequestOptions) {
	opts.HTTPClient = h.HTTPClient
}

// HTTPHeaderOption implements the RequestOption interface.
type HTTPHeaderOption struct {
	HTTPHeader http.Header
}

func (h *HTTPHeaderOption) applyRequestOptions(opts *RequestOptions) {
	opts.HTTPHeader = h.HTTPHeader
}

// BodyPropertiesOption implements the RequestOption interface.
type BodyPropertiesOption struct {
	BodyProperties map[string]interface{}
}

func (b *BodyPropertiesOption) applyRequestOptions(opts *RequestOptions) {
	opts.BodyProperties = b.BodyProperties
}

// QueryParametersOption implements the RequestOption interface.
type QueryParametersOption struct {
	QueryParameters url.Values
}

func (q *QueryParametersOption) applyRequestOptions(opts *RequestOptions) {
	opts.QueryParameters = q.QueryParameters
}

// MaxAttemptsOption implements the RequestOption interface.
type MaxAttemptsOption struct {
	MaxAttempts uint
}

func (m *MaxAttemptsOption) applyRequestOptions(opts *RequestOptions) {
	opts.MaxAttempts = m.MaxAttempts
}

// BasicAuthOption implements the RequestOption interface.
type BasicAuthOption struct {
	Username string
	Password string
}

func (b *BasicAuthOption) applyRequestOptions(opts *RequestOptions) {
	opts.Username = b.Username
	opts.Password = b.Password
}

```


### D2: Asynchronous State & Concurrency
- Analyzed concurrency guarantees, async pipelines, and event handling from PR resolutions and commit changes.

### D3: Error Boundaries, Recovery & Rollbacks
- Exception handling patterns and defect resolutions extracted from closed production bug issues:
- **Issue #402** (2026-09-23): **[Bug]: langfuse-clickhouse — "Too many open files" (errno 24) on queries, get_mempolicy log flood, and MergeMutationsExecutor threads spinning at ~100% CPU with no pending mutations**
  *Symptoms*: ### Affected Component  - [x] Analytics Platform Integration (Langfuse)  ### Describe the bug  The bundled `langfuse-clickhouse` container degrades after running for a while under sustained trace ingestion and eventually makes the Langfuse stack unusable while slowing down the whole host. Observed on two independent deployments (16-core dev host and 4-vCPU production host). Three interrelated symptoms — **plus the root cause, which we identified with live diagnostics and confirmed by fixing it**:  **1. Queries fail with `Too many open files` (errno 24)**  The ClickHouse process runs with the Docker default `nofile` limit of **4096**. Under load, queries exhaust it and fail with errno 24 on data part / skip-index files. The Langfuse trace-*list* endpoint still works, but the trace-*detail* endpoint returns HTTP 500:  ``` {"message":"Internal Server Error","error":"Cannot open file /var/lib/clickhouse/store/61f/61fced17-be34-4b17-b3eb-d044cdca7e4b/202609_407_407_0/skp_idx_idx_project_dataset_run.idx: , errno: 24, strerror: Too many open files. "} ```  This silently breaks any automation that reads trace details (e.g. per-flow usage metrics come back empty).  **2. `MergeMutationsExecutor` threads at ~100% CPU — root cause: infinite retry loop of a failing merge (not an empty-work spin)**  *Correction of our initial reading:* the threads are NOT spinning "with no pending mutations". `top -H` shows two `MergeMutationsExecutor` threads at ~100% CPU while `system.mutations WHERE NOT
  **Post-Mortem & Fix Analysis**:
  > @tavgar validated a solid root-cause analysis here — thanks for the live diagnostics.  I'd like to pick this up so the fix actually lands. Plan:  1. `docker-compose-langfuse.yml`: `ulimits: { nofile: { soft: 262144, hard: 262144 } }` on the clickhouse service (mirrors what `docker-compose-observability.yml` already does for `clickstore`) — the root-cause fix for the errno-24 loop. 2. `langfuse/clickhouse/system-logs.xml` bound to `/etc/clickhouse-server/config.d/system-logs.xml:ro` — bounded TTLs for system log tables + `warning` logger level to stop the debug flood.  I'll keep the diff to those two files, and the PR will credit your analysis (the issue text is already a full postmortem).  One question before I cut the branch: do you want to send the PR yourself? You mentioned it was ready — totally fine either way, I don't want to step on your work. If you'd rather I take it, I can have it up within the hour.
  > This will be fixed in 2.2.0. Closing — comment here if it persists after the upgrade.

- **Issue #392** (2026-09-23): **[Bug]: `DOCKER_DEFAULT_IMAGE_FOR_PENTEST` is not enforced — image selection relies entirely on an unverified LLM response, with no deterministic fallback**
  *Symptoms*: ### Affected Component  External Integrations (LLM/Search APIs)  ### Describe the bug  ## Summary  `DOCKER_DEFAULT_IMAGE_FOR_PENTEST` (and the equivalent `DefaultImageForPentest` template variable) is documented and configured as if it constrains which Docker image PentAGI uses for a flow. In practice, it is only ever injected as text into an LLM prompt (`image_chooser` prompt type). The LLM's raw text response is used directly as the image name, with no validation, no allow-list check, and no deterministic fallback if the model ignores the guidance. With a weaker/smaller model (tested with a local, self-hosted `qwen2.5:7b-instruct` via Ollama), the model reliably ignores the "prefer the pentest image" instruction and returns `node:latest` instead of the intended pentest image, even when the env var is correctly set and even after explicitly strengthening the prompt's wording.  This means `DOCKER_DEFAULT_IMAGE_FOR_PENTEST` currently functions as a *hint*, not a *default* or *constraint*, contrary to what its name and documentation imply.  ## Environment  - PentAGI commit: `879e87c` (pinned, built from clean upstream source — see reproduction steps below) - Deployment: self-hosted Docker Compose, Ubuntu 26.04 host - LLM provider: local Ollama (`qwen2.5:7b-instruct`, ~5.1GB, CPU-only inference) - `DOCKER_DEFAULT_IMAGE_FOR_PENTEST=vxcontrol/kali-linux` (also reproduces with the unset/default value, which per `config.go` defaults to the same image)  ## Steps to reproduce  1. Conf
  **Post-Mortem & Fix Analysis**:
  > This will be fixed in 2.2.0. Closing — comment here if it persists after the upgrade.

- **Issue #383** (2026-08-04): **[Bug]: xAI Grok 4.5 compatibility: HTTP 400 despite valid OpenAI-compatible API**
  *Symptoms*: ### Affected Component  External Integrations (LLM/Search APIs)  ### Describe the bug  Hi,  I'm trying to use PentAGI with xAI Grok 4.5.  Configuration:  OPEN_AI_SERVER_URL=https://api.x.ai/v1  with a valid xAI API key.  I tried both:  OpenAI provider Custom provider  Creating a flow always fails with:  failed to create flow worker: failed to get flow provider: failed to select primary docker image via llm call: API returned unexpected status code: 400  ### Steps to Reproduce  1. Configure an OpenAI-compatible provider with: OPEN_AI_SERVER_URL=https://api.x.ai/v1 A valid xAI API key with access to grok-4.5.  2. Select the configured provider. 3. Create a new flow.  4. Observe that flow creation fails with: ``` failed to create flow worker: failed to get flow provider: failed to select primary docker image via llm call: API returned unexpected status code: 400 ``` I got the same error when i created the custom provider too  ### System Configuration  PentAGI Version: Latest (Docker image: vxcontrol/pentagi:latest)  Deployment Type: Docker Compose  Environment: - Docker Version: 29.7.0 - Docker Compose Version: v5.3.1 - Host OS: Ubuntu 24.04 LTS - Available Resources:   - RAM: 8 GB   - CPU: 4   - Disk Space: 93GB  Enabled Features: Custom LLM Server  Active Integrations: - LLM Provider: OpenAI, Custom  ### Logs and Artifacts  I verified the following:  GET /v1/models works from inside the PentAGI container. POST /v1/chat/completions with model: grok-4.5 works. POST /v1/responses
  **Post-Mortem & Fix Analysis**:
  > closing it, found the solution

- **Issue #378** (2026-09-23): **[Bug]: installer restart fails: "file docker-compose-graphiti.yml does not exist" when Graphiti is disabled**
  *Symptoms*: ### Affected Component  Other (please specify in the description)  ### Describe the bug  When running ./installer restart with GRAPHITI_ENABLED=false in .env, the installer fails with:Failed to stop graphiti compose stack: file /mnt/DataDisk/pentagi/docker-compose-graphiti.yml does not exist Failed to execute %s operation: failed to restart stack: file /mnt/DataDisk/pentagi/docker-compose-graphiti.yml does not exist   ### Steps to Reproduce  1. Download latest installer (v2.0.0-87ac00f)  2. Run ./installer to configure, set Graphiti to disabled  3. Run ./installer restart  4. See error  ### System Configuration  - OS: Ubuntu 26.04 LTS - Architecture: amd64 - Installer version: v2.0.0-87ac00f - Docker: installed   ### Logs and Artifacts  waiting for command: /usr/bin/docker compose --env-file /mnt/DataDisk/pentagi/.env -f /mnt/DataDisk/pentagi/docker-compose-graphiti.yml stop   ### Screenshots or Recordings  <img width="769" height="685" alt="Image" src="https://github.com/user-attachments/assets/38ba4291-1937-4fb8-a3fa-dccac1ccfb92" />  ### Verification  - [x] I have checked that this issue hasn't been already reported - [x] I have provided all relevant configuration files (with sensitive data removed) - [x] I have included relevant logs and error messages - [x] I am running the latest version of PentAGI
  **Post-Mortem & Fix Analysis**:
  > Already fixed in the code: the installer skips compose files that are not there. The fix lives inside the installer binary, and the report came from an older build — the new installer ships with PentAGI 2.2.0, so that build resolves it. Closing; comment here if it still happens on 2.2.0.

- **Issue #375** (2026-09-23): **[Bug]: Unable to use locally deployed Ollama models**
  *Symptoms*: ### Affected Component  External Integrations (LLM/Search APIs)  ### Describe the bug  PentAGI fails to start and cannot use locally deployed Ollama models, due to a hardcoded custom provider validation error requiring an OpenAI API key.（maybe）  I have modified the docker-compose configuration and the .env environment file. Helpppppp!!!!!!!!  ### Steps to Reproduce  1. Pull the official vxcontrol/pentagi docker image (version 2.0.0 / 2.1.0) 2. Create docker-compose.yml and .env files, set environment variables including OPENAI_API_KEY with a dummy key and Ollama local server config 3. Run `docker compose up -d` to start the PentAGI service 4. Observe the container logs: the service crashes repeatedly with the error message: "LLM provider controller initialization failed: failed to create custom provider: missing the OpenAI API key, set it in the OPENAI_API_KEY environment variable" 5. Even after correctly setting OPENAI_API_KEY environment variable and modifying all *.provider.yml config files, the error persists, preventing the service from starting normally and connecting to local Ollama models  ### System Configuration  PentAGI version: v2.1.0-879e87c (official vxcontrol/pentagi docker image), also verified on v2.0.0 Deployment type: - Docker Compose  Environment: - Docker version: 27.x.x - Docker Compose version: v2.x.x - Host OS: Windows 10 / Ubuntu 22.04 - Available resources:   - Memory: 16GB   - CPU: 8 cores - Local Ollama service running on host port 11434 (OpenAI co
  **Post-Mortem & Fix Analysis**:
  > hey @FUA-Studio   you are using wrong variable name `OPENAI_API_KEY`, it should be `OPEN_AI_KEY`  please look at [here](https://github.com/vxcontrol/pentagi#openai-provider-configuration), you should use this variable **only** with original OpenAI provider or reverse proxy to OpenAI provider combined with `OPEN_AI_SERVER_URL`, for any OpenAI-compatible providers please use [custom provider](https://github.com/vxcontrol/pentagi#custom-llm-provider-configuration).  Ollama supported as well, [details here](https://github.com/vxcontrol/pentagi#ollama-provider-configuration)
  > 我需要完整的 .env 以及 Docker Compose的文件内容 大模型为qwen2.5:14b
  > Require full .env and docker-compose.yml configurations, using qwen2.5:14b as the LLM.

- **Issue #360** (2026-09-23): **[Bug]: finishFlow mutation returns "flow not found" when provider name was renamed - flow unloaded from in-memory map at startup**
  *Symptoms*: ### Affected Component  Other (please specify in the description) Backend / Flow Controller  ### Describe the bug  When a model provider is renamed (e.g. `Ollama cloud GLM` -> `OllamaC GLM`), all flows that were created with the old provider name fail to load at service startup. The `LoadFlowWorker` function in `pkg/controller/flow.go` calls `fwc.provs.LoadFlowProvider()`, which returns an error because the provider name no longer exists. The flow is skipped and never added to the `fc.flows` in-memory map (`pkg/controller/flows.go`).  As a result, any subsequent GraphQL mutation or REST API call that looks up the flow in the in-memory map - `finishFlow`, `stopFlow`, `putUserInput`, `callAssistant`, `PUT /flows/{id}` with `action: finish` - returns `ErrFlowNotFound` ("flow not found"), even though the flow exists in the database with status `waiting`.  The flow is therefore permanently stuck: it cannot be finished, stopped, or resumed through the UI or API. Its Docker container keeps running as an orphan.  **Expected behavior:** - Flows with a missing/renamed provider should still be loadable so they can be finished, deleted, or have their provider updated. - Alternatively, `FinishFlow` (and similar mutations) should fall back to loading the flow from DB when it is not found in the in-memory map, so users can at least clean up stuck flows. - At minimum, the error message should distinguish between "flow does not exist in DB" and "flow exists but failed to load" to aid debuggin
  **Post-Mortem & Fix Analysis**:
  > Thanks for the detailed report, @psyray.  Reproduced this on a live local PentAGI instance. The behavior matches your analysis: after a provider is renamed, existing flows that reference the old provider name fail to restore on startup and are not added to the in-memory flow map. Startup logs show the expected failure:  ``` text flow loaded from DB flow_id=1 provider_name=issue-live-old-provider... failed to get flow provider: provider 'issue-live-old-provider...' not found failed to load flow 1 ```  After that, finishFlow returns:  ``` {"errors":[{"message":"flow not found","path":["finishFlow"]}],"data":null} The REST path also returns a generic 500 for PUT /api/v1/flows/{id} with {"action":"finish"}. ```  Also verified the DB workaround you described: updating flows.model_provider_name to an existing provider name and restarting PentAGI allows the flow to load again. After that, finishFlow succeeds and the container is cleaned up.  The issue and workaround are both confirmed. A fix 
  > This will be fixed in 2.2.0. Closing — comment here if it persists after the upgrade.

- **Issue #338** (2026-09-23): **[Bug]: ZIP downloads buffer the entire archive in memory [Introduced in 2.1.0]**
  *Symptoms*: ### Affected Component  Core Services (Frontend UI/Backend API)  ### Describe the bug  What happened: Directory and multi-path ZIP downloads build the **entire** archive in a `bytes.Buffer` and only then send it, so the whole compressed archive is held on the heap before any response byte is written. Combined with the 2 GB upload/pull limits, an authenticated user with default `User`-role resource/flow-file permissions can store (or pull) a large, incompressible directory and request it as a ZIP, forcing the API process to allocate memory proportional to the archive size. A handful of concurrent requests can exhaust process/host memory and crash or severely degrade the API.  Single-file downloads are fine since they stream from disk. Only the directory / multi-path ZIP paths are affected.  WHat should happen: We should probably create the zip writer over the response writer (`zw := zip.NewWriter(c.Writer)`) after setting `Content-Type: application/zip` and `Content-Disposition`, write entries, then `zw.Close()`.   ### Steps to Reproduce  1. As a `User`-role account, upload (or pull from a flow container) a directory of incompressible data. 2. Request the directory (or a multi-path selection) from the ZIP download endpoint. 3. The handler calls `ZipResources` / `ZipDirectory` / `ZipRelativePaths` with a `bytes.Buffer`; resident heap grows to roughly the archive size before the response starts. 4. Issue a few concurrent requests → Go runtime fatal out-of-memory.  A standalone h
  **Post-Mortem & Fix Analysis**:
  > Already available in the current version — closing. Comment here if it does not work that way for you.

- **Issue #337** (2026-09-23): **[Bug]: PentAGI Container Escape via Prompt Injection**
  *Symptoms*: ### Affected Component  AI Agents (Researcher/Developer/...)  ### Describe the bug  # PentAGI Container Escape via Prompt Injection  ## Summary  PentAGI mounts the host Docker socket (`/var/run/docker.sock`) into agent sandbox containers when deployed via Docker Compose, allowing a prompt-injected AI agent to escape its sandbox and execute arbitrary commands on the **host** through the Docker API.  ---  ## Root Cause  In `backend/pkg/docker/client.go:282-284`, when `DOCKER_INSIDE` is true, every per-flow sandbox container is created with the host Docker socket bind-mounted:  ```go if dc.inside {     hostConfig.Binds = append(hostConfig.Binds,         fmt.Sprintf("%s:%s", dc.socket, defaultDockerSocketPath)) } ```  `dc.inside` is controlled by the `DOCKER_INSIDE` environment variable, which defaults to `true` in the shipped `docker-compose.yml`. The `defaultDockerSocketPath` is `/var/run/docker.sock`.  ---  ## Impact  With host Docker socket access, an attacker can:  - **Host compromise**: `docker run --privileged -v /:/host ...` mounts the host root filesystem into a new container, providing full read/write access to the host. - **Lateral movement**: Access to all containers, images, volumes, and networks on the host.  ### Steps to Reproduce  none  ### System Configuration  none  ### Logs and Artifacts  _No response_  ### Screenshots or Recordings  _No response_  ### Verification  - [ ] I have checked that this issue hasn't been already reported - [ ] I have provided all rele
  **Post-Mortem & Fix Analysis**:
  > Sandbox Container: pentagi-terminal-3  │  ├─ /var/run/docker.sock (Successfully mounted, srw-rw----)  │  ├─ POST /containers/create  → Privileged Container with Volume Mount (-v /:/host)  │        └─ 201 Created  ├─ POST /containers/{id}/start → 204 No Content  ├─ POST /containers/{id}/wait  → StatusCode=0  ├─ GET  /containers/{id}/logs  → Host filesystem data exfiltration (Leakage)  └─ DELETE /containers/{id}     → Footprint cleanup / Clearing tracks
  > The sandbox does not receive the Docker socket by default: DOCKER_INSIDE is off. When Docker-in-Docker is genuinely needed, DOCKER_INSIDE_HOST points the sandbox at a separate daemon instead of mounting the host socket, and the guide covers fronting that daemon with authorization. Closing on that basis — comment here if you see the socket reach a sandbox with the defaults in place.  Guide here: https://github.com/vxcontrol/pentagi/blob/main/examples/guides/worker_node.md

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

### Incident Patch 1: `b611fbeb` (2026-10-03)
**Commit Message**: fix: installer stack detection, tests that can fail, proxy and port docs

- installer: decide whether the stack is extracted by the provider examples
  beside the env file, not in the working directory
- tests: assert table cells in the markdown editor pipe tests; pin the
  prompter in provider failover, the permission error on a password change
  and the built-in Bedrock config against its shipped example
- docs: state what PROXY_URL covers and which ports flows publish; name the
  cgr.dev registry of the Langfuse stack
- comments: drop history and restated code, correct those that had drifted
  from the code

**File**: `.env.example` (modified, +2/-1)
```diff
@@ -204,7 +204,8 @@ MAX_LIMITED_AGENT_TOOL_CALLS=
 ## Agent planning step for pentester, coder, installer
 AGENT_PLANNING_STEP_ENABLED=
 
-## HTTP proxy to use it in isolation environment
+## HTTP proxy for every backend LLM, embedding, search and update-check call (local endpoints included);
+## sandboxes, the scraper and Graphiti do not use it
 PROXY_URL=
 
 ## SSL/TLS Certificate Configuration
```

**File**: `README.md` (modified, +7/-4)
```diff
@@ -882,13 +882,16 @@ For multi-user setups, an authenticated administrator can manage local users thr
 >
 > `LLM_SERVER_*` environment variables are experimental feature and will be changed in the future. Right now you can use them to specify custom LLM server URL and one model for all agent types.
 >
-> `PROXY_URL` is a global proxy URL for all LLM providers and external search systems. You can use it for isolation from external networks.
+> `PROXY_URL` routes the backend's own HTTP calls through a proxy: every request to LLM and embedding providers and to search engines — self-hosted ones such as Ollama or SearXNG included, as there is no `NO_PROXY` exemption — and the update check. Sandbox containers (where agents run their commands), the scraper, the Graphiti service, OAuth sign-in, and Langfuse/OpenTelemetry export do not use it, so if you need isolation from external networks, restrict their outbound traffic at the network level.
 >
 > The `docker-compose.yml` file runs the PentAGI service as root user because it needs access to docker.sock for container management. If you're using TCP/IP network connection to Docker instead of socket file, you can remove root privileges and use the default `pentagi` user for better security.
 
 ### Accessing PentAGI from External Networks
 
-By default, PentAGI binds to `127.0.0.1` (localhost only) for security. To access PentAGI from other machines on your network, you need to configure external access.
+By default, the PentAGI web interface and the other compose services bind to `127.0.0.1` (localhost only) for security. To access PentAGI from other machines on your network, you need to configure external access.
+
+> [!IMPORTANT]
+> Flow sandboxes are not bound to localhost. Each flow publishes two TCP ports for out-of-band callbacks such as reverse shells, taken from the 2000-port window that starts at `DOCKER_PORTS_BASE` (`28000`–`29999` by default), on `DOCKER_PUBLIC_IP` — `0.0.0.0` by default, that is every interface of the Docker host. Docker routes published ports around `ufw` rules and lets them through `firewalld` with its own `docker` zone, so restrict this range with a firewall in front of the host or, with Docker's default iptables backend, with rules in the `DOCKER-USER` chain. With `DOCKER_NETWORK=host`, sandboxes share the host's network stack, so their listeners are exposed without any port mapping.
 
 #### Configuration Steps
 
@@ -3100,7 +3103,7 @@ Example Docker daemon mirror configuration:
 }
 ```
 
-On Linux, this is typically configured in `/etc/docker/daemon.json`. On Docker Desktop, use the equivalent Docker Engine or proxy settings. A Docker Hub mirror covers Docker Hub-hosted images such as `vxcontrol/*`, but the main Compose stack already includes `quay.io/prometheuscommunity/postgres-exporter`, and the optional observability stack includes `gcr.io/cadvisor/cadvisor`. Those registries still need direct access or individually approved proxy/mirror paths.
+On Linux, this is typically configured in `/etc/docker/daemon.json`. On Docker Desktop, use the equivalent Docker Engine or proxy settings. A Docker Hub mirror covers Docker Hub-hosted images such as `vxcontrol/*`, but the main Compose stack already includes `quay.io/prometheuscommunity/postgres-exporter`, the optional observability stack includes `gcr.io/cadvisor/cadvisor`, and the optional Langfuse stack includes `cgr.dev/chainguard/minio`. Those registries still need direct access or individually approved proxy/mirror paths.
 
 See the official Docker documentation for [registry mirrors](https://docs.docker.com/docker-hub/image-library/mirror/) and [daemon proxy configuration](https://docs.docker.com/engine/daemon/proxy/).
 
@@ -3706,7 +3709,7 @@ EMBEDDING_STRIP_NEW_LINES=true  # Whether to remove new lines from text before e
 EMBEDDING_MAX_TEXT_BYTES=8192   # Max bytes of text sent to embedding model per document (byte proxy for token limit)
 
 # Advanced settings
-PROXY_URL=                      # Optional proxy for all API calls
+PROXY_URL=                      # Optional proxy for all backend LLM, embedding, search and update-check calls
 HTTP_CLIENT_TIMEOUT=600         # Timeout in seconds for external API calls (default: 600, 0 = no timeout)
 TERMINAL_TOOL_TIMEOUT=1200      # Default timeout in seconds for terminal tool commands when timeout=0 or negative (range: 1–10800; values <= 0 or above 10800 are clamped to 10800 = 3 hours)
 
```

**File**: `backend/cmd/installer/checker/checker.go` (modified, +2/-2)
```diff
@@ -427,8 +427,8 @@ func (h *defaultCheckHandler) GatherPentagiInfo(ctx context.Context, c *CheckRes
 	// would count as not extracted, and extraction overwrites the examples the user
 	// edited when the update is forced. Verification of an extracted stack writes it.
 	c.PentagiExtracted = checkFileExists(dockerComposeFile) &&
-		checkFileExists(ExampleCustomConfigLLMFile) &&
-		checkFileExists(ExampleOllamaConfigLLMFile)
+		checkFileExists(filepath.Join(envDir, ExampleCustomConfigLLMFile)) &&
+		checkFileExists(filepath.Join(envDir, ExampleOllamaConfigLLMFile))
 	c.PentagiScriptInstalled = checkFileExists(PentagiScriptFile)
 
 	if h.dockerClient != nil {
```

**File**: `backend/cmd/installer/checker/checker_test.go` (modified, +46/-0)
```diff
@@ -1,6 +1,7 @@
 package checker
 
 import (
+	"os"
 	"path/filepath"
 	"sync"
 	"testing"
@@ -63,3 +64,48 @@ func TestChecker_NeverClaimsExternalForAStackThatIsNotConnected(t *testing.T) {
 		})
 	}
 }
+
+func TestChecker_GatherPentagiInfo_LooksForTheExtractedStackBesideTheEnvFile(t *testing.T) {
+	tests := []struct {
+		name              string
+		beside, elsewhere []string // files beside the env file, and in the working directory
+		want              bool
+	}{
+		{
+			"the compose file and both examples beside the env file",
+			[]string{"docker-compose.yml", "example.custom.provider.yml", "example.ollama.provider.yml"}, nil, true,
+		},
+		{"the compose file alone", []string{"docker-compose.yml"}, nil, false},
+		{"the ollama example missing", []string{"docker-compose.yml", "example.custom.provider.yml"}, nil, false},
+		{"the custom example missing", []string{"docker-compose.yml", "example.ollama.provider.yml"}, nil, false},
+		{"the compose file missing", []string{"example.custom.provider.yml", "example.ollama.provider.yml"}, nil, false},
+		{
+			"the examples in the working directory only",
+			[]string{"docker-compose.yml"}, []string{"example.custom.provider.yml", "example.ollama.provider.yml"}, false,
+		},
+	}
+
+	for _, tt := range tests {
+		t.Run(tt.name, func(t *testing.T) {
+			envDir, workDir := t.TempDir(), t.TempDir()
+			for dir, names := range map[string][]string{envDir: tt.beside, workDir: tt.elsewhere} {
+				for _, name := range names {
+					if err := os.WriteFile(filepath.Join(dir, name), []byte("x"), 0o644); err != nil {
+						t.Fatalf("write %s: %v", name, err)
+					}
+				}
+			}
+			t.Chdir(workDir)
+
+			handler := &defaultCheckHandler{mx: &sync.Mutex{}, appState: &mockState{envPath: filepath.Join(envDir, ".env")}}
+			got := &CheckResult{}
+			if err := handler.GatherPentagiInfo(t.Context(), got); err != nil {
+				t.Fatalf("gather: %v", err)
+			}
+
+			if got.PentagiExtracted != tt.want {
+				t.Errorf("PentagiExtracted = %t, want %t", got.PentagiExtracted, tt.want)
+			}
+		})
+	}
+}
```

**File**: `backend/cmd/installer/checker/helpers.go` (modified, +14/-26)
```diff
@@ -767,25 +767,9 @@ func getImageInfo(ctx context.Context, cli *client.Client, imageName string) *Im
 	return imageInfo
 }
 
-// parseImageRef splits a Docker image reference into the repository and tag the update
-// server matches on, plus whatever digest the reference or the daemon carried.
-//
-// The shape is [registry[:port]/]path[:tag][@digest], and the two colons are the trap: the
-// one that separates a registry port and the one that separates a tag look identical. They
-// are told apart by position, not by content — a tag colon is the LAST colon after the last
-// slash. The previous rule guessed by content, treating any tag containing a dot as a port
-// number, which misread every version-numbered tag the compose files use: "grafana/grafana"
-// at "11.4.0" became a repository literally named "grafana/grafana:11.4.0" at tag "latest".
-//
-// That failure is silent where it matters. The update server answers on the repository and
-// tag pair, so a mangled pair simply gets no answer — and no answer is indistinguishable
-// from "nothing to update".
 // isDockerHubHost reports whether a leading path element is one of the names
-// Docker Hub answers to.
-//
-// A closed list rather than a shape test. "Contains a dot or a colon" describes
-// every registry there is, and treating every registry as Docker Hub is exactly
-// how the host came to be dropped from references that need it.
+// Docker Hub answers to. It is a closed list and not a shape test: "contains a
+// dot or a colon" describes every registry there is.
 func isDockerHubHost(head string) bool {
 	switch head {
 	case "docker.io", "index.docker.io", "registry-1.docker.io", "registry.hub.docker.com":
@@ -795,6 +779,14 @@ func isDockerHubHost(head string) bool {
 	}
 }
 
+// parseImageRef splits a Docker image reference into the repository and tag the update
+// server matches on, plus whatever digest the reference or the daemon carried.
+//
+// The shape is [registry[:port]/]path[:tag][@digest]. The colon of a registry port and the
+// colon of a tag are told apart by position, not by content: a tag colon is the last colon
+// after the last slash, so a version-numbered tag such as "11.4.0" is not taken for a port.
+// A mangled pair fails silently: the update server matches on the repository and tag pair,
+// and a pair it does not track is offered nothing, which reads as "nothing to update".
 func parseImageRef(imageRef, imageID string) *ImageInfo {
 	if imageRef == "" {
 		return nil
@@ -820,14 +812,10 @@ func parseImageRef(imageRef, imageID string) *ImageInfo {
 	// The service stores a reference the way compose writes it: bare for Docker
 	// Hub, host and all for anywhere else — `gcr.io/cadvisor/cadvisor`, not
 	// `cadvisor/cadvisor`. Those two are different images: the second is a Docker
-	// Hub repository that has nothing to do with cAdvisor. Dropping the host for
-	// every registry made this client report the second while running the first,
-	// and since the match is an exact string comparison, the component simply
-	// resolved to nothing — answered `repository_not_tracked` forever, and
-	// dragging its whole stack's resolution down to `not_tracked` with it.
-	//
-	// It stayed invisible until cadvisor and pgexporter — the only two components
-	// not on Docker Hub — started being reported at all.
+	// Hub repository that has nothing to do with cAdvisor. The match is an exact
+	// string comparison, so a reference of another registry reported without its
+	// host is answered `repository_not_tracked` and takes its whole stack's
+	// resolution down to `not_tracked`.
 	if head, rest, found := strings.Cut(imageRef, "/"); found {
 		if isDockerHubHost(head) {
 			imageRef = rest
```

**File**: `backend/cmd/installer/processor/fs.go` (modified, +2/-1)
```diff
@@ -161,7 +161,8 @@ func (fs *fileSystemOperationsImpl) verifyStackIntegrity(ctx context.Context, st
 	}
 }
 
-// checkStackIntegrity is a silent version of verifyStackIntegrity, used for getting files statuses
+// checkStackIntegrity is the read-only counterpart of verifyStackIntegrity; it does not report
+// the provider examples verifyStackIntegrity restores for pentagi.
 func (fs *fileSystemOperationsImpl) checkStackIntegrity(ctx context.Context, stack ProductStack) (FilesCheckResult, error) {
 	result := make(FilesCheckResult)
 
```

**File**: `backend/cmd/installer/processor/fs_test.go` (modified, +13/-16)
```diff
@@ -155,8 +155,7 @@ func TestFs_VerifyStackIntegrity_RestoresAProviderExampleThatIsNotAFile(t *testi
 	}
 }
 
-// Over the embedded files and the compose files beside them: Docker creates a directory in
-// place of a file a compose file mounts and the stack does not extract.
+// Over the embedded files and the compose files at the repository root.
 func TestFs_EnsureStackIntegrity_ExtractsEveryFileItsComposeFileMounts(t *testing.T) {
 	withDefault := regexp.MustCompile(`\$\{[A-Za-z0-9_]+:?-([^}]*)\}`)
 	for _, tc := range []struct {
@@ -179,7 +178,7 @@ func TestFs_EnsureStackIntegrity_ExtractsEveryFileItsComposeFileMounts(t *testin
 			"./observability/jaeger", "./observability/loki/config.yml", "./observability/otel",
 		}},
 	} {
-		t.Run(string(tc.stack), func(t *testing.T) {
+		t.Run("the "+string(tc.stack)+" stack", func(t *testing.T) {
 			content, err := os.ReadFile(filepath.Join(repositoryRoot(t), tc.composeFile))
 			require.NoError(t, err)
 			var compose struct {
@@ -221,17 +220,15 @@ func TestFs_EnsureStackIntegrity_ExtractsEveryFileItsComposeFileMounts(t *testin
 	}
 }
 
-// Over the embedded files themselves. Subtests are keyed by unit: both replace the directory
-// with the example, and only the verification of an extracted stack spares an edited example
-// from a forced update.
+// Over the embedded files themselves; subtests are keyed by unit.
 func TestFs_ADirectoryInPlaceOfAProviderExampleBecomesTheExample(t *testing.T) {
 	for _, tc := range []struct {
 		name       string
 		run        func(fileSystemOperations, context.Context, ProductStack, *operationState) error
 		wantCustom string
 	}{
-		{"ensureStackIntegrity", fileSystemOperations.ensureStackIntegrity, "the example"},
-		{"verifyStackIntegrity", fileSystemOperations.verifyStackIntegrity, "edited: true\n"},
+		{"a forced extraction overwrites the edited example", fileSystemOperations.ensureStackIntegrity, "the example"},
+		{"a forced verification keeps the edited example", fileSystemOperations.verifyStackIntegrity, "edited: true\n"},
 	} {
 		t.Run(tc.name, func(t *testing.T) {
 			embedded := files.NewFiles()
@@ -312,21 +309,21 @@ func TestFs_CleanupStackFiles_RemovesEveryFileOfTheStackAndNothingElse(t *testin
 
 func TestFs_EnsureFileFromEmbed_CopiesOnlyWhatIsMissingUnlessForced(t *testing.T) {
 	for _, tc := range []struct {
-		name          string
-		onDisk, force bool
-		want          []string
+		name                     string
+		onDisk, directory, force bool
+		want                     []string
 	}{
-		{"a missing file is extracted", false, false, []string{"test.yml"}},
-		{"a file on disk is kept", true, false, nil},
-		{"a file on disk is overwritten when forced", true, true, []string{"test.yml"}},
-		{"a directory in its place is replaced", false, false, []string{"test.yml"}},
+		{"a missing file is extracted", false, false, false, []string{"test.yml"}},
+		{"a file on disk is kept", true, false, false, nil},
+		{"a file on disk is overwritten when forced", true, false, true, []string{"test.yml"}},
+		{"a directory in its place is replaced", false, true, false, []string{"test.yml"}},
 	} {
 		t.Run(tc.name, func(t *testing.T) {
 			ops, embedded, dir := fsOperations(t)
 			embedded.AddFile("test.yml", []byte("test content"))
 			if tc.onDisk {
 				require.NoError(t, os.WriteFile(filepath.Join(dir, "test.yml"), []byte("existing"), 0o644))
-			} else if strings.HasPrefix(tc.name, "a directory") {
+			} else if tc.directory {
 				require.NoError(t, os.Mkdir(filepath.Join(dir, "test.yml"), 0o755))
 			}
 			state := testOperationState(t)
```

**File**: `backend/cmd/installer/processor/logic.go` (modified, +4/-3)
```diff
@@ -339,9 +339,10 @@ func (p *processor) applyPentagiChanges(ctx context.Context, state *operationSta
 	return nil
 }
 
-// checkFiles computes file statuses for a given stack, honoring the same
-// rules as verifyStackIntegrity: active stacks only and excluded files policy.
-// It serves as a dry-run for file operations without performing any writes.
+// checkFiles computes file statuses for a given stack under the rules the apply
+// path follows: embedded stacks only, and the excluded files policy of
+// verifyStackIntegrity. It writes nothing; the provider examples
+// verifyStackIntegrity restores for pentagi are not reported.
 func (p *processor) checkFiles(
 	ctx context.Context, stack ProductStack, state *operationState,
 ) (result map[string]files.FileStatus, err error) {
```

---

### Incident Patch 2: `01acdda6` (2026-09-30)
**Commit Message**: fix: failover on flow creation, minio image, stable build revisions

- Failover: when the primary provider is down, flow and assistant creation now falls back for the tool call ID template.
- Prompts: a stored custom prompt that no longer validates is ignored in favor of the default, with a warning, instead of rendering "<no value>".
- Security: PUT /users/{hash} refuses a password change without users.edit, so a stolen session cookie can no longer reset the account password.
- Langfuse: minio/minio is gone from Docker Hub, so the stack runs cgr.dev/chainguard/minio:latest as root to keep existing volumes readable.
- Installer: the main menu highlights Maintenance while a worker, stack or installer update is waiting.
- Versions: the build revision is the first 7 characters of the commit SHA instead of git rev-parse --short, which depends on the size of the clone.
- Tests: the docker pids-limit test sets its limit after the probes start, so the setup execs no longer exhaust it on slow CI runners.
- Docs: README covers Azure OpenAI through the custom provider and the Neo4j/APOC files a manual Graphiti install needs.
- Reports: added the Azure OpenAI ctester report and regenerated vll

**File**: `.env.example` (modified, +1/-1)
```diff
@@ -36,7 +36,7 @@ GRAPHITI_IMAGE=vxcontrol/graphiti:latest
 LANGFUSE_WORKER_IMAGE=langfuse/langfuse-worker:3
 LANGFUSE_WEB_IMAGE=langfuse/langfuse:3
 CLICKHOUSE_IMAGE=clickhouse/clickhouse-server:24
-MINIO_IMAGE=minio/minio:RELEASE.2025-07-23T15-54-02Z
+MINIO_IMAGE=cgr.dev/chainguard/minio:latest
 REDIS_IMAGE=redis:7
 POSTGRES_IMAGE=postgres:16
 
```

**File**: `.github/workflows/ci.yml` (modified, +4/-2)
```diff
@@ -152,7 +152,8 @@ jobs:
           TAG_COMMIT=$(git rev-list -n 1 "$LATEST_TAG" 2>/dev/null || echo "")
 
           if [ "$CURRENT_COMMIT" != "$TAG_COMMIT" ]; then
-            PACKAGE_REV=$(git rev-parse --short HEAD)
+            # Fixed width, as in scripts/version.sh: --short widens with the size of the clone.
+            PACKAGE_REV=$(printf '%s' "$CURRENT_COMMIT" | cut -c1-7)
           else
             PACKAGE_REV=""
           fi
@@ -204,7 +205,8 @@ jobs:
 
           # Set revision only if current commit differs from tag commit
           if [ "$CURRENT_COMMIT" != "$TAG_COMMIT" ]; then
-            PACKAGE_REV=$(git rev-parse --short HEAD)
+            # Fixed width, as in scripts/version.sh: --short widens with the size of the clone.
+            PACKAGE_REV=$(printf '%s' "$CURRENT_COMMIT" | cut -c1-7)
             echo "revision=${PACKAGE_REV}" >> $GITHUB_OUTPUT
             echo "is_release=false" >> $GITHUB_OUTPUT
             echo "Building development version: ${VERSION}-${PACKAGE_REV}"
```

**File**: `README.md` (modified, +53/-11)
```diff
@@ -26,6 +26,7 @@
 - [How to Use PentAGI After Login](#how-to-use-pentagi-after-login)
 - [API Access](#api-access)
   - [LLM Provider Configuration](#custom-llm-provider-configuration)
+    - [Azure OpenAI](#using-azure-openai)
     - [Ollama](#ollama-provider-configuration)
     - [OpenAI](#openai-provider-configuration)
     - [Anthropic](#anthropic-provider-configuration)
@@ -77,7 +78,7 @@ You can watch the video **PentAGI overview**:
 - Persistent Storage. All commands and outputs are stored in PostgreSQL with [pgvector](https://hub.docker.com/r/vxcontrol/pgvector) extension.
 - Scalable Architecture. Microservices-based design supporting horizontal scaling.
 - Self-Hosted Solution. Complete control over your deployment and data.
-- Flexible Authentication. Support for 10+ LLM providers ([OpenAI](https://platform.openai.com/), [Anthropic](https://www.anthropic.com/), [Google AI/Gemini](https://ai.google.dev/), [AWS Bedrock](https://aws.amazon.com/bedrock/), [Ollama](https://ollama.com/), [DeepSeek](https://www.deepseek.com/en/), [GLM](https://z.ai/), [Kimi](https://platform.moonshot.ai/), [Qwen](https://www.alibabacloud.com/en/), [MiniMax](https://www.minimax.io/), [Mistral](https://mistral.ai/), [xAI](https://x.ai/), Custom) plus aggregators ([OpenRouter](https://openrouter.ai/), [DeepInfra](https://deepinfra.com/), [Atlas Cloud](https://www.atlascloud.ai/), [OpenCode Go plan](https://opencode.ai/en/go)). For production local deployments, see our [vLLM + Qwen3.5-27B-FP8 guide](examples/guides/vllm-qwen35-27b-fp8.md).
+- Flexible Authentication. Support for 10+ LLM providers ([OpenAI](https://platform.openai.com/), [Anthropic](https://www.anthropic.com/), [Google AI/Gemini](https://ai.google.dev/), [AWS Bedrock](https://aws.amazon.com/bedrock/), [Ollama](https://ollama.com/), [DeepSeek](https://www.deepseek.com/en/), [GLM](https://z.ai/), [Kimi](https://platform.moonshot.ai/), [Qwen](https://www.alibabacloud.com/en/), [MiniMax](https://www.minimax.io/), [Mistral](https://mistral.ai/), [xAI](https://x.ai/), Custom for any OpenAI-compatible endpoint including [Azure OpenAI](#using-azure-openai)) plus aggregators ([OpenRouter](https://openrouter.ai/), [DeepInfra](https://deepinfra.com/), [Atlas Cloud](https://www.atlascloud.ai/), [OpenCode Go plan](https://opencode.ai/en/go)). For production local deployments, see our [vLLM + Qwen3.5-27B-FP8 guide](examples/guides/vllm-qwen35-27b-fp8.md).
 - API Token Authentication. Secure Bearer token system for programmatic access to REST and GraphQL APIs.
 - Quick Deployment. Easy setup through [Docker Compose](https://docs.docker.com/compose/) with comprehensive environment configuration.
 
@@ -1438,14 +1439,16 @@ When using custom LLM providers with the `LLM_SERVER_*` variables, you can fine-
 > [!TIP]
 > For production-grade local deployments, consider using **vLLM** with **Qwen3.5-27B-FP8** for optimal performance. See our [comprehensive deployment guide](examples/guides/vllm-qwen35-27b-fp8.md) which includes hardware requirements, configuration templates ([thinking mode](examples/configs/vllm-qwen3.5-27b-fp8.provider.yml) and [non-thinking mode](examples/configs/vllm-qwen3.5-27b-fp8-no-think.provider.yml)), and performance benchmarks showing 13K TPS prompt processing on 4× RTX 5090 GPUs.
 
-| Variable                        | Default | Description                                                                             |
-| ------------------------------- | ------- | --------------------------------------------------------------------------------------- |
-| `LLM_SERVER_URL`                |         | Base URL for the custom LLM API endpoint                                                |
-| `LLM_SERVER_KEY`                |         | API key for the custom LLM provider                                                     |
-| `LLM_SERVER_MODEL`              |         | Default model to use (can be overridden in provider config)                             |
-| `LLM_SERVER_CONFIG_PATH`        |         | Path to the YAML configuration file for agent-specific models                           |
-| `LLM_SERVER_PROVIDER`           |         | Provider name prefix for model names (e.g., `openrouter`, `deepseek` for LiteLLM proxy) |
-| `LLM_SERVER_PRESERVE_REASONING` | `false` | Preserve reasoning content in multi-turn conversations (required by some providers)     |
+| Variable                        | Default      | Description                                                                                                        |
+| ------------------------------- | ------------ | ------------------------------------------------------------------------------------------------------------------ |
+| `LLM_SERVER_URL`                |              | Base URL for the custom LLM API endpoint                                                                           |
+| `LLM_SERVER_KEY`                |              | API key for the custom LLM provider                
```

**File**: `backend/cmd/installer/wizard/models/main_menu.go` (modified, +5/-1)
```diff
@@ -30,6 +30,10 @@ func NewMainMenuHandler(c controller.Controller, s styles.Styles, w window.Windo
 // ListScreenHandler interface implementation
 
 func (h *MainMenuHandler) LoadItems() []ListItem {
+	checker := h.controller.GetChecker()
+	// Updates are offered only inside Maintenance, so its entry carries their highlight.
+	hasUpdates := checker.CanUpdateWorker() || checker.CanUpdateAll() || checker.CanUpdateInstaller()
+
 	items := []ListItem{
 		{ID: LLMProvidersScreen},
 		{ID: EmbedderFormScreen},
@@ -39,7 +43,7 @@ func (h *MainMenuHandler) LoadItems() []ListItem {
 		{ID: ServerSettingsScreen},
 		{ID: ApplyChangesScreen, Highlighted: true},
 		{ID: InstallPentagiScreen, Highlighted: true},
-		{ID: MaintenanceScreen},
+		{ID: MaintenanceScreen, Highlighted: hasUpdates},
 	}
 
 	// filter out disabled items
```

**File**: `backend/cmd/installer/wizard/models/main_menu_test.go` (added, +58/-0)
```diff
@@ -0,0 +1,58 @@
+package models
+
+import (
+	"os"
+	"path/filepath"
+	"slices"
+	"testing"
+
+	"pentagi/cmd/installer/checker"
+	"pentagi/cmd/installer/files"
+	"pentagi/cmd/installer/state"
+	"pentagi/cmd/installer/wizard/controller"
+	"pentagi/cmd/installer/wizard/styles"
+	"pentagi/cmd/installer/wizard/window"
+)
+
+func TestMainMenu_LoadItems_HighlightsMaintenanceWhileAnUpdateWaits(t *testing.T) {
+	upToDate := checker.CheckResult{
+		WorkerImageExists: true, WorkerIsUpToDate: true,
+		PentagiInstalled: true, PentagiIsUpToDate: true,
+		InstallerIsUpToDate: true, UpdateServerAccessible: true,
+	}
+
+	for _, tc := range []struct {
+		name   string
+		update func(*checker.CheckResult)
+		want   bool
+	}{
+		{"everything is up to date", func(*checker.CheckResult) {}, false},
+		{"a newer worker image", func(c *checker.CheckResult) { c.WorkerIsUpToDate = false }, true},
+		{"a newer stack", func(c *checker.CheckResult) { c.PentagiIsUpToDate = false }, true},
+		{"a newer installer", func(c *checker.CheckResult) { c.InstallerIsUpToDate = false }, true},
+	} {
+		t.Run(tc.name, func(t *testing.T) {
+			envPath := filepath.Join(t.TempDir(), ".env")
+			if err := os.WriteFile(envPath, nil, 0o600); err != nil {
+				t.Fatal(err)
+			}
+			st, err := state.NewState(envPath)
+			if err != nil {
+				t.Fatal(err)
+			}
+			result := upToDate
+			tc.update(&result)
+			c := controller.NewController(st, files.NewFiles(), result)
+
+			items := NewMainMenuHandler(c, styles.New(), window.New()).LoadItems()
+
+			i := slices.IndexFunc(items, func(item ListItem) bool { return item.ID == MaintenanceScreen })
+			if i < 0 {
+				t.Fatal("maintenance is not offered")
+			}
+			if items[i].Highlighted != tc.want {
+				t.Errorf("maintenance highlighted = %v, want %v", items[i].Highlighted, tc.want)
+			}
+		})
+	}
+}
```

**File**: `backend/pkg/controller/prompter.go` (modified, +18/-4)
```diff
@@ -6,6 +6,9 @@ import (
 
 	"pentagi/pkg/database"
 	"pentagi/pkg/templates"
+	"pentagi/pkg/templates/validator"
+
+	"github.com/sirupsen/logrus"
 )
 
 // newUserPrompter loads the user's custom prompts from the database and
@@ -30,9 +33,9 @@ func newUserPrompter(ctx context.Context, db database.Querier, userID int64) (te
 // buildUserPrompter is the pure merge step extracted from newUserPrompter so
 // it can be unit-tested without a database fake or filesystem access. It
 // mutates the supplied defaults map by overlaying each non-empty user
-// override on top, then returns a Prompter backed by that map. Callers must
-// pass a fresh map (e.g., from templates.LoadDefaultPromptsMap) so the
-// embedded defaults are not modified.
+// override that still validates, then returns a Prompter backed by that map.
+// Callers must pass a fresh map (e.g., from templates.LoadDefaultPromptsMap)
+// so the embedded defaults are not modified.
 func buildUserPrompter(defaults templates.PromptsMap, userPrompts []database.Prompt) templates.Prompter {
 	for _, p := range userPrompts {
 		if p.Prompt == "" {
@@ -43,7 +46,18 @@ func buildUserPrompter(defaults templates.PromptsMap, userPrompts []database.Pro
 			// ErrTemplateNotFound deep inside agent rendering.
 			continue
 		}
-		defaults[templates.PromptType(p.Type)] = p.Prompt
+
+		// Validation runs only on save, so an override written before a variable
+		// was removed still loads, and text/template renders the missing key as
+		// "<no value>" without an error — the agent would be pointed at a tool
+		// that does not exist.
+		promptType := templates.PromptType(p.Type)
+		if err := validator.ValidatePrompt(promptType, p.Prompt); err != nil {
+			logrus.WithError(err).WithField("prompt_type", p.Type).
+				Warn("custom prompt no longer validates, using the default")
+			continue
+		}
+		defaults[promptType] = p.Prompt
 	}
 
 	return templates.NewFlowPrompter(defaults)
```

**File**: `backend/pkg/controller/prompter_test.go` (modified, +9/-0)
```diff
@@ -65,6 +65,15 @@ func TestPrompter_NewUserPrompter_OverlaysTheUsersPromptsOnTheDefaults(t *testin
 			prompts:     []database.Prompt{{Type: database.PromptTypePrimaryAgent, Prompt: ""}},
 			wantDefault: []templates.PromptType{templates.PromptTypePrimaryAgent},
 		},
+		{
+			name: "an override using a variable the backend no longer provides",
+			prompts: []database.Prompt{
+				{Type: database.PromptTypeSearcher, Prompt: "Search with {{.GoogleToolName}}"},
+				{Type: database.PromptTypeCoder, Prompt: "custom coder"},
+			},
+			wantCustom:  map[templates.PromptType]string{templates.PromptTypeCoder: "custom coder"},
+			wantDefault: []templates.PromptType{templates.PromptTypeSearcher},
+		},
 		{name: "a database that cannot be read", dbErr: dbErr},
 	} {
 		t.Run(tc.name, func(t *testing.T) {
```

**File**: `backend/pkg/docker/client_test.go` (modified, +5/-5)
```diff
@@ -236,7 +236,7 @@ func listingFrame(streamID byte, payload string) []byte {
 
 func TestClient_IsContainerRunning_ReportsRunningUntilTheContainerIsRemoved(t *testing.T) {
 	dc := newDaemonClient(t)
-	containerID := startProbeSandbox(t, dc, probeImage, 0)
+	containerID := startProbeSandbox(t, dc, probeImage)
 
 	running, err := dc.IsContainerRunning(t.Context(), containerID)
 	require.NoError(t, err)
@@ -846,7 +846,7 @@ func TestClient_KillFlowCommands_SkipsASandboxThatIsNotRunning(t *testing.T) {
 
 	for name, stop := range tests {
 		t.Run(name, func(t *testing.T) {
-			containerID := startProbeSandbox(t, dc, probeImage, 0)
+			containerID := startProbeSandbox(t, dc, probeImage)
 			require.NoError(t, stop(t.Context(), containerID))
 
 			require.NoError(t, dc.KillFlowCommands(t.Context(), containerID))
@@ -864,7 +864,7 @@ func TestClient_KillFlowCommands_FinishesTheSweepAfterTheCallerGivesUp(t *testin
 
 	for name, giveUpAfter := range tests {
 		t.Run(name, func(t *testing.T) {
-			containerID := startProbeSandbox(t, dc, probeImage, 0)
+			containerID := startProbeSandbox(t, dc, probeImage)
 			startInSandbox(t, dc, containerID, FlowCommand(`trap "" TERM; while :; do sleep 1; done`), false)
 			dockerWaitForCommand(t, dc, containerID, "do sleep 1")
 
@@ -919,7 +919,7 @@ func TestClient_KillFlowCommands_SweepsAnUnhealthySandbox(t *testing.T) {
 
 func TestClient_KillFlowCommands_RunsTheShellFoundOnThePath(t *testing.T) {
 	dc := newDaemonClient(t)
-	containerID := startProbeSandbox(t, dc, probeImage, 0)
+	containerID := startProbeSandbox(t, dc, probeImage)
 
 	runInSandbox(t, dc, containerID, `mv /bin/sh /usr/local/bin/sh`)
 	startInSandbox(t, dc, containerID, FlowCommand(`sleep 921`), false)
@@ -932,7 +932,7 @@ func TestClient_KillFlowCommands_RunsTheShellFoundOnThePath(t *testing.T) {
 
 func TestClient_KillFlowCommands_ReportsASweepThatCannotRun(t *testing.T) {
 	dc := newDaemonClient(t)
-	containerID := startProbeSandbox(t, dc, probeImage, 0)
+	containerID := startProbeSandbox(t, dc, probeImage)
 
 	runInSandbox(t, dc, containerID, `rm /bin/sh`)
 
```

---

### Incident Patch 3: `6f3d29c3` (2026-09-25)
**Commit Message**: feat: port major fixes

**File**: `.dockerignore` (modified, +5/-0)
```diff
@@ -14,3 +14,8 @@ frontend/ssl
 !**/.env.example
 **/.DS_Store
 **/Thumbs.db
+
+# locally built helper binaries; the image builds its own
+backend/ctester
+backend/etester
+backend/ftester
```

**File**: `.env.example` (modified, +55/-2)
```diff
@@ -79,6 +79,17 @@ OPEN_AI_SERVER_URL=https://api.openai.com/v1
 ANTHROPIC_API_KEY=
 ANTHROPIC_SERVER_URL=https://api.anthropic.com/v1
 
+## Anthropic Workload Identity Federation, used in place of ANTHROPIC_API_KEY when the key is empty.
+## The token file is read inside the pentagi container on every exchange, so mount it there. A token carrying jti
+## is exchanged only once: the file must hold a new token before each refresh, well within the minted token's lifetime.
+## ANTHROPIC_IDENTITY_TOKEN is read once and cannot be rotated, so it suits only runs shorter than its own lifetime.
+ANTHROPIC_FEDERATION_RULE_ID=
+ANTHROPIC_ORGANIZATION_ID=
+ANTHROPIC_SERVICE_ACCOUNT_ID=
+ANTHROPIC_WORKSPACE_ID=
+ANTHROPIC_IDENTITY_TOKEN_FILE=
+ANTHROPIC_IDENTITY_TOKEN=
+
 ## Google AI (Gemini) LLM provider
 GEMINI_API_KEY=
 GEMINI_SERVER_URL=https://generativelanguage.googleapis.com
@@ -108,24 +119,39 @@ KIMI_API_KEY=
 KIMI_SERVER_URL=https://api.moonshot.ai/v1
 KIMI_PROVIDER=
 
-## Qwen (Alibaba Cloud DashScope) LLM provider
+## Qwen Cloud or Alibaba Cloud Model Studio LLM provider
 QWEN_API_KEY=
 QWEN_SERVER_URL=https://dashscope-us.aliyuncs.com/compatible-mode/v1
+# Gateway prefix: qwen_cloud or dashscope; leave empty for direct DashScope
 QWEN_PROVIDER=
 
 ## MiniMax LLM provider
 MINIMAX_API_KEY=
 MINIMAX_SERVER_URL=https://api.minimax.io/v1
 MINIMAX_PROVIDER=
 
+## Mistral LLM provider
+MISTRAL_API_KEY=
+MISTRAL_SERVER_URL=https://api.mistral.ai/v1
+MISTRAL_PROVIDER=
+
+## xAI (Grok) LLM provider
+XAI_API_KEY=
+XAI_SERVER_URL=https://api.x.ai/v1
+XAI_PROVIDER=
+
 ## Custom LLM provider
 LLM_SERVER_URL=
 LLM_SERVER_KEY=
 LLM_SERVER_MODEL=
 LLM_SERVER_PROVIDER=
 LLM_SERVER_CONFIG_PATH=
-LLM_SERVER_LEGACY_REASONING=
 LLM_SERVER_PRESERVE_REASONING=
+## Set LLM_SERVER_API_TYPE to azure or azure_ad to talk to an Azure OpenAI deployment;
+## leave it empty for a plain OpenAI-compatible endpoint. LLM_SERVER_API_VERSION is the
+## api-version Azure requires and is ignored by the plain endpoint.
+LLM_SERVER_API_TYPE=
+LLM_SERVER_API_VERSION=
 
 ## Ollama LLM provider (Local Server or Cloud)
 # Local: http://ollama-server:11434, Cloud: https://ollama.com
@@ -218,6 +244,10 @@ PENTAGI_BEDROCK_CONFIG_PATH=
 ## PentAGI security settings
 PUBLIC_URL=https://localhost:8443
 CORS_ORIGINS=https://localhost:8443
+
+## Reverse proxies whose X-Forwarded-For is believed, comma separated CIDRs.
+## Empty means the peer address is the client address.
+TRUSTED_PROXIES=
 COOKIE_SIGNING_SALT=salt # change this to improve security
 
 ## PentAGI internal server settings (inside the container)
@@ -267,9 +297,14 @@ FIRECRAWL_API_KEY=
 FIRECRAWL_API_URL=
 
 ## Perplexity search engine API
+## PERPLEXITY_MODEL is the model sent to the chat/completions API (sonar,
+## sonar-pro, sonar-reasoning, ...); empty or unset defaults to sonar.
+## PERPLEXITY_CONTEXT_SIZE is low, medium or high.
+## PERPLEXITY_TIMEOUT is seconds to wait for one request; empty uses 120.
 PERPLEXITY_API_KEY=
 PERPLEXITY_MODEL=
 PERPLEXITY_CONTEXT_SIZE=
+PERPLEXITY_TIMEOUT=
 
 ## SEARXNG search engine API
 SEARXNG_URL=
@@ -320,12 +355,30 @@ DOCKER_SOCKET=/var/run/docker.sock # path on host machine
 DOCKER_INSIDE_HOST=
 DOCKER_INSIDE_TLS_VERIFY=
 DOCKER_INSIDE_CERT_PATH=
+## Sandbox isolation test. Runs ONCE at startup and nowhere else. Its only effect
+## is whether agents get Docker at all: PentAGI launches one worker exactly the way
+## a flow does, checks that its daemon is separate from PentAGI's own and refuses
+## host-escape requests, and removes it. A sandbox that fails the test is turned
+## OFF and the log says which check decided it -- PentAGI still starts. Off by
+## default, and then the log warns the isolation was never measured. Needs the
+## separate-daemon arrangement of examples/guides/worker_node.md.
+DOCKER_INSIDE_POLICY_TESTS=false
 
 DOCKER_NETWORK=
 DOCKER_WORK_DIR=
 DOCKER_PUBLIC_IP=0.0.0.0 # public ip of host machine
 DOCKER_DEFAULT_IMAGE=
 DOCKER_DEFAULT_IMAGE_FOR_PENTEST=
+## Worker the startup sandbox check runs in, and the image it pulls into the
+## sandbox to prove an agent could. Small on purpose: the check pays for it on
+## every start. Only used when DOCKER_INSIDE_POLICY_TESTS=true.
+DOCKER_DEFAULT_IMAGE_FOR_TEST=vxcontrol/kali-linux:test
+# Comma-separated allow-list for the image the model may choose; empty means no restriction
+DOCKER_ALLOWED_IMAGES=
+# "llm" (default) lets the model choose the image, "fixed" always uses the pentest image
+DOCKER_IMAGE_SELECTION_MODE=
+# Provider used to repeat a call that the flow's own provider failed; empty disables it
+LLM_FALLBACK_PROVIDER=
 
 # Postgres (pgvector) settings
 PENTAGI_POSTGRES_USER=postgres
```

**File**: `.github/scripts/codegen-inputs-changed.sh` (modified, +1/-1)
```diff
@@ -39,7 +39,7 @@ INPUTS=(
     frontend/src/graphql/types.ts
 )
 
-if ! files=$(git diff --name-only "$base" "$HEAD_SHA"); then
+if ! files=$(git diff --name-only --no-renames "$base" "$HEAD_SHA"); then
     echo "reason=diff-failed" >&2
     echo "changed=true"
     exit 0
```

**File**: `.github/workflows/ci.yml` (modified, +2/-5)
```diff
@@ -133,13 +133,11 @@ jobs:
         with:
           version: v2.12.2
           working-directory: backend
-          args: --timeout=5m --issues-exit-code=0
-        continue-on-error: true
+          args: --timeout=5m
 
       - name: Backend - Test
         working-directory: backend
-        run: go test ./... -v
-        continue-on-error: true
+        run: go test ./... -race -v
 
       - name: Backend - Test Build
         working-directory: backend
@@ -170,7 +168,6 @@ jobs:
           # Build for ARM64
           GOOS=linux GOARCH=arm64 go build -trimpath -ldflags "$LDFLAGS" -o /tmp/pentagi-arm64 ./cmd/pentagi
           echo "✓ Successfully built for linux/arm64"
-        continue-on-error: true
 
   docker-build:
     needs: lint-and-test
```

**File**: `.gitignore` (modified, +7/-1)
```diff
@@ -7,6 +7,11 @@
 
 backend/tmp
 backend/build
+backend/data
+# locally built helper binaries (cmd/ctester, cmd/etester, cmd/ftester)
+backend/ctester
+backend/etester
+backend/ftester
 backend/vendor
 backend/cmd/installer/**/log.json
 
@@ -25,6 +30,7 @@ skills-lock.json
 
 build/*
 data/*
+neo4j/*
 .bak/*
 !.gitkeep
 .claude/
@@ -34,7 +40,7 @@ data/*
 *.swp
 *.swo
 *~
+__pycache__/
 
 # OS
 Thumbs.db
-
```

**File**: `.vscode/launch.json` (modified, +4/-0)
```diff
@@ -57,6 +57,7 @@
             "envFile": "${workspaceFolder}/.env",
             "env": {},
             "args": [
+                "-type", "custom",
                 // "-type", "openai",
                 // "-type", "anthropic",
                 // "-type", "gemini",
@@ -67,6 +68,8 @@
                 // "-type", "kimi",
                 // "-type", "qwen",
                 // "-type", "minimax",
+                // "-type", "mistral",
+                // "-type", "xai",
                 "-config", "${workspaceFolder}/examples/configs/moonshot.provider.yml",
                 // "-config", "${workspaceFolder}/examples/configs/deepseek.provider.yml",
                 // "-config", "${workspaceFolder}/examples/configs/ollama-cloud.provider.yml",
@@ -107,6 +110,7 @@
                 // "-report", "${workspaceFolder}/examples/tests/qwen-report.md",
                 // "-report", "${workspaceFolder}/examples/tests/qwen-cloud-report.md",
                 // "-report", "${workspaceFolder}/examples/tests/minimax-report.md",
+                // "-report", "${workspaceFolder}/examples/tests/mistral-report.md",
                 // "-report", "${workspaceFolder}/examples/tests/hcnsec-report.md",
                 // "-report", "${workspaceFolder}/examples/tests/custom-openai-report.md",
                 // "-report", "${workspaceFolder}/examples/tests/opencode-report.md",
```

**File**: `CLAUDE.md` (modified, +219/-90)
```diff
@@ -4,155 +4,284 @@ This file provides guidance to Claude Code (claude.ai/code) when working with co
 
 ## Core Interaction Rules
 
-1. **Always use English** for all interactions, responses, explanations, and questions with users.
-2. **Password Complexity Requirements**: For all password-related development (registration, password reset, API token generation, etc.), enforce the same policy in **both** backend and frontend — never rely on frontend validation alone. Source of truth, keep the two in sync: `backend/pkg/server/models/init.go` → `strongPasswordValidatorString` and `frontend/src/features/authentication/password-change-form.tsx` (zod schema). The policy:
+1. **English** for code, comments, documentation, commit messages and identifiers.
+2. **Password Complexity Requirements**: For all password-related development (registration, password reset, API token generation, etc.), enforce the same policy in **both** backend and frontend — never rely on frontend validation alone. Source of truth, keep the two in sync: `backend/pkg/password/policy.go` (the API validator and the installer both call it) and `frontend/src/features/authentication/password-change-form.tsx` (zod schema). The policy:
    - Length 8–72 characters (72 **bytes**, the most bcrypt will hash — a longer value fails inside `bcrypt.GenerateFromPassword`, after validation).
    - A password is valid if it is **either** 16+ characters (any composition), **or** 8–15 characters containing at least 1 lowercase letter, 1 uppercase letter, 1 number, and 1 special character from `!@#$&*`.
+3. **Markdown is prose, not wrapped to a width.** In a `.md` file every paragraph, list item and table row is one line, and the text is split into paragraphs where the thought changes, not where a column ends — the viewer wraps it. Hard wrapping at a fixed width belongs only to comments in code.
+
+## Code Comments
+
+The target: comment lines at 0–2% of a file of logic and about 18% of a file of type declarations; function bodies of hundreds of lines carry none, because the code says what it does.
+
+**A comment earns its place only by carrying what the code cannot show**: why this decision and not the obvious one, what external constraint it works around, why the code exists at all, and — where it genuinely matters — the boundary conditions. It must help maintenance and must not cost readability.
+
+1. **Never restate the code.** If the sentence follows from the line under it, delete it. A doc comment that only repeats an identifier's name is noise; delete it rather than reword it. A comment that repeats the `fmt.Errorf` or log message on the next line is noise too.
+
+2. **Short and dense beats long and dense.** No filler that dilutes the point.
+
+3. **English only.** No Russian, not even a quoted requirement.
+
+4. **No `§`, no requirement ids like `(R37)`, no reference to a document that is not in this repository.** A planning document that is not tracked leaves every pointer into it dead. Do not just delete the token — rewrite the sentence so it stands alone, or delete the comment. "The spec says X" is not a reason; if the reason is real, state the reason. (`§` is a legitimate *string* separator in `backend/cmd/installer/wizard/models/types.go` and a legitimate reference to the CommonMark spec in `markdown-editor-marked.ts` — those are not comments.)
+
+5. **No archaeology.** Git holds the history. Delete "it used to be", "no longer", "before this", "now that X arrives", "was an overgeneralisation". Keep the invariant the story was there to protect. This applies to test *names* as well as test comments.
+
+6. **No meta-commentary** about why the enum has five members rather than four, and no narrative padding that sets a scene or argues with an imagined reviewer.
+
+7. **Rationale lives in one place** — the production code. A `_test.go` gets at most one line saying what a case pins down, and only when the test name does not already say it.
+
+8. **When you change a comment, verify it against the code**, including that the case it describes is still reachable where it sits. A shorter comment that is wrong is worse than the long one.
+
+Keep, and shorten only where it stays unambiguous: package doc comments; the contract of an exported identifier (units, ownership, zero/nil semantics, what the caller must hold); locking, ordering and fail-closed rationale; load-bearing formatting facts; workarounds for a library, protocol, database or browser quirk. Never touch `TODO`/`FIXME`, `//nolint`, `// eslint-disable`, `//go:generate`, `//go:embed`, build tags, or the swaggo `// @...` annotations in `pkg/server/services/` — they are machine-read, not prose.
+
+Two kinds of comment here are machine-read even though they look like prose: the triple-quoted descriptions in `schema.graphqls`, which reach `models_gen.go`, the frontend types and every API consumer; and the comment above a `-- name:` line in `backend/sqlc/models/*.sql`, which is copied verbatim into `pkg/da
```

**File**: `Dockerfile` (modified, +31/-7)
```diff
@@ -55,8 +55,13 @@ RUN pnpm run build -- \
 FROM golang:1.26-bookworm AS api-builder
 
 # Version injection arguments
-ARG PACKAGE_VER=develop
+# "ce" is not a release number, so GetBinaryVersion reads it as "no release" and reports
+# the edition alone. The default is a word rather than the empty string because
+# scripts/check-version-rule.sh requires the builder to stamp something: an empty
+# PackageVer reaching the binary is the one case it must never mistake for a release.
+ARG PACKAGE_VER=ce
 ARG PACKAGE_REV=
+ARG PACKAGE_EDITION=ce
 
 # Static binary compilation settings
 ENV CGO_ENABLED=0
@@ -94,31 +99,35 @@ RUN go build -trimpath \
     -ldflags "\
         -X pentagi/pkg/version.PackageName=pentagi \
         -X pentagi/pkg/version.PackageVer=${PACKAGE_VER} \
-        -X pentagi/pkg/version.PackageRev=${PACKAGE_REV}" \
+        -X pentagi/pkg/version.PackageRev=${PACKAGE_REV} \
+        -X pentagi/pkg/version.Edition=${PACKAGE_EDITION}" \
     -o /pentagi ./cmd/pentagi
 
 # Build ctester utility
 RUN go build -trimpath \
     -ldflags "\
         -X pentagi/pkg/version.PackageName=ctester \
         -X pentagi/pkg/version.PackageVer=${PACKAGE_VER} \
-        -X pentagi/pkg/version.PackageRev=${PACKAGE_REV}" \
+        -X pentagi/pkg/version.PackageRev=${PACKAGE_REV} \
+        -X pentagi/pkg/version.Edition=${PACKAGE_EDITION}" \
     -o /ctester ./cmd/ctester
 
 # Build ftester utility
 RUN go build -trimpath \
     -ldflags "\
         -X pentagi/pkg/version.PackageName=ftester \
         -X pentagi/pkg/version.PackageVer=${PACKAGE_VER} \
-        -X pentagi/pkg/version.PackageRev=${PACKAGE_REV}" \
+        -X pentagi/pkg/version.PackageRev=${PACKAGE_REV} \
+        -X pentagi/pkg/version.Edition=${PACKAGE_EDITION}" \
     -o /ftester ./cmd/ftester
 
 # Build etester utility
 RUN go build -trimpath \
     -ldflags "\
         -X pentagi/pkg/version.PackageName=etester \
         -X pentagi/pkg/version.PackageVer=${PACKAGE_VER} \
-        -X pentagi/pkg/version.PackageRev=${PACKAGE_REV}" \
+        -X pentagi/pkg/version.PackageRev=${PACKAGE_REV} \
+        -X pentagi/pkg/version.Edition=${PACKAGE_EDITION}" \
     -o /etester ./cmd/etester
 
 # ========================================
@@ -201,10 +210,25 @@ USER pentagi
 
 ENTRYPOINT ["/opt/pentagi/bin/entrypoint.sh", "/opt/pentagi/bin/pentagi"]
 
-# Version of the PentAGI binary inside
+# Mirrors GetBinaryVersion in backend/pkg/version: "<edition>", "<edition>.h<rev>",
+# "<ver>-<edition>" or "<ver>-<edition>.h<rev>". The "h" keeps the revision an
+# alphanumeric semver identifier. The binary is stamped from the same args in
+# the builder stage, so pass them and nothing else: PACKAGE_VERSION_FULL is where this
+# expression puts its result, and overriding it labels the image with a string the binary
+# never says.
+#
+# PACKAGE_VER is a release number. The words "develop", "ce" and "ee" are not valid values
+# for it: an ARG default can branch on empty but cannot compare strings, so this expression
+# would read one as a release and label the image ce-ce where the binary reports ce. Leave
+# PACKAGE_VER empty for a build with no release behind it — scripts/version.sh and
+# scripts/version.ps1 clear a tag of that name, the CI jobs do not, and
+# scripts/check-version-rule.sh measures the agreement for a release tag or no tag.
 ARG PACKAGE_VER
 ARG PACKAGE_REV
-LABEL com.pentagi.version="${PACKAGE_VER:-develop}${PACKAGE_REV:+-${PACKAGE_REV}}"
+ARG PACKAGE_EDITION=ce
+ARG VER_PART=${PACKAGE_VER:+${PACKAGE_VER}-}${PACKAGE_EDITION}
+ARG PACKAGE_VERSION_FULL=${VER_PART}${PACKAGE_REV:+.h${PACKAGE_REV}}
+LABEL com.pentagi.version="${PACKAGE_VERSION_FULL}"
 
 # Image Metadata
 LABEL org.opencontainers.image.source="https://github.com/vxcontrol/pentagi"
```

---

### Incident Patch 4: `ea665308` (2026-08-06)
**Commit Message**: fix(deps): upgrade langchaingo version to release version v0.1.14-update.7

**File**: `backend/go.mod` (modified, +1/-1)
```diff
@@ -54,7 +54,7 @@ require (
 	github.com/vektah/gqlparser/v2 v2.5.19
 	github.com/vxcontrol/cloud v0.9.0
 	github.com/vxcontrol/graphiti-go-client v0.9.0
-	github.com/vxcontrol/langchaingo v0.1.15-0.20260804113937-da7016e399b0
+	github.com/vxcontrol/langchaingo v0.1.14-update.7
 	github.com/wasilibs/go-re2 v1.10.0
 	github.com/xeipuuv/gojsonschema v1.2.0
 	go.opentelemetry.io/otel v1.43.0
```

**File**: `backend/go.sum` (modified, +2/-2)
```diff
@@ -632,8 +632,8 @@ github.com/vxcontrol/cloud v0.9.0 h1:p7xYTgUctbY8w6YfhugNzvfi3/0EQoZGumMe67keAng
 github.com/vxcontrol/cloud v0.9.0/go.mod h1:AeiQFqiMgJJAXy6FYXtDS2a3P/PMB56iiBNY2vGrZhQ=
 github.com/vxcontrol/graphiti-go-client v0.9.0 h1:3GxpFmQoHmz/d7/9tyEqD8+S99v2cuqG1UEmrbAFrLU=
 github.com/vxcontrol/graphiti-go-client v0.9.0/go.mod h1:6UHL5uqAKp4KAdziva4qgcAxFtBzU05Hm/BAo4NkAuo=
-github.com/vxcontrol/langchaingo v0.1.15-0.20260804113937-da7016e399b0 h1:ZQnT4AUmTiz1mweuQdW+CR/51hQN7z0S248BEgDRXhs=
-github.com/vxcontrol/langchaingo v0.1.15-0.20260804113937-da7016e399b0/go.mod h1:z3q8al4gf+NAlEEiCXxtBzr0JSU/aEWhi3S8oi4gaGs=
+github.com/vxcontrol/langchaingo v0.1.14-update.7 h1:iQnSNMmYQGbPQK5622JewlruaY6MIc7wzJklWq0Fja4=
+github.com/vxcontrol/langchaingo v0.1.14-update.7/go.mod h1:z3q8al4gf+NAlEEiCXxtBzr0JSU/aEWhi3S8oi4gaGs=
 github.com/wasilibs/go-re2 v1.10.0 h1:vQZEBYZOCA9jdBMmrO4+CvqyCj0x4OomXTJ4a5/urQ0=
 github.com/wasilibs/go-re2 v1.10.0/go.mod h1:k+5XqO2bCJS+QpGOnqugyfwC04nw0jaglmjrrkG8U6o=
 github.com/wasilibs/wazero-helpers v0.0.0-20240620070341-3dff1577cd52 h1:OvLBa8SqJnZ6P+mjlzc2K7PM22rRUPE1x32G9DTPrC4=
```

---

### Incident Patch 5: `ccb309a6` (2026-08-04)
**Commit Message**: fix(docker): upgrade Go and dependencies for improved compatibility and performance

- Updated Go version from 1.24 to 1.26.5 in Dockerfile and CI configuration.
- Upgraded various dependencies in go.mod, including AWS SDK and OpenTelemetry packages, to their latest versions for enhanced features and security.
- Refactored Docker client imports from the Docker library to the Moby library for better compatibility with the updated API.
- Adjusted Docker client usage throughout the codebase to align with the new Moby client structure.

**File**: `.github/workflows/ci.yml` (modified, +2/-2)
```diff
@@ -42,7 +42,7 @@ jobs:
       - name: Set up Go
         uses: actions/setup-go@v6
         with:
-          go-version: "1.24"
+          go-version: "1.26.5"
           cache: true
           cache-dependency-path: backend/go.sum
 
@@ -115,7 +115,7 @@ jobs:
       - name: Backend - Lint
         uses: golangci/golangci-lint-action@v9
         with:
-          version: latest
+          version: v2.12.2
           working-directory: backend
           args: --timeout=5m --issues-exit-code=0
         continue-on-error: true
```

**File**: `Dockerfile` (modified, +1/-1)
```diff
@@ -52,7 +52,7 @@ RUN pnpm run build -- \
 # ========================================
 # Stage 2: Backend Services Compilation
 # ========================================
-FROM golang:1.24-bookworm AS api-builder
+FROM golang:1.26-bookworm AS api-builder
 
 # Version injection arguments
 ARG PACKAGE_VER=develop
```

**File**: `backend/cmd/installer/checker/checker.go` (modified, +1/-1)
```diff
@@ -11,7 +11,7 @@ import (
 	"pentagi/cmd/installer/state"
 	"pentagi/pkg/version"
 
-	"github.com/docker/docker/client"
+	"github.com/moby/moby/client"
 )
 
 var (
```

**File**: `backend/cmd/installer/checker/helpers.go` (modified, +16/-21)
```diff
@@ -22,10 +22,7 @@ import (
 
 	"pentagi/cmd/installer/state"
 
-	"github.com/docker/docker/api/types/container"
-	"github.com/docker/docker/api/types/image"
-	"github.com/docker/docker/api/types/volume"
-	"github.com/docker/docker/client"
+	"github.com/moby/moby/client"
 )
 
 type DockerVersion struct {
@@ -138,9 +135,7 @@ func getProxyURL(appState state.State) string {
 }
 
 func createDockerClient(host, certPath string, tlsVerify bool) (*client.Client, error) {
-	opts := []client.Opt{
-		client.WithAPIVersionNegotiation(),
-	}
+	var opts []client.Opt
 
 	if host != "" {
 		opts = append(opts, client.WithHost(host))
@@ -154,7 +149,7 @@ func createDockerClient(host, certPath string, tlsVerify bool) (*client.Client,
 		))
 	}
 
-	return client.NewClientWithOpts(opts...)
+	return client.New(opts...)
 }
 
 // createDockerClientFromEnv creates a docker client and returns the error type
@@ -165,13 +160,13 @@ func createDockerClientFromEnv(ctx context.Context) (*client.Client, DockerError
 		return nil, DockerErrorNotInstalled
 	}
 
-	cli, err := client.NewClientWithOpts(client.FromEnv, client.WithAPIVersionNegotiation())
+	cli, err := client.New(client.FromEnv)
 	if err != nil {
 		return nil, DockerErrorAPIError
 	}
 
 	// try to ping the daemon
-	_, err = cli.Ping(ctx)
+	_, err = cli.Ping(ctx, client.PingOptions{NegotiateAPIVersion: true})
 	if err != nil {
 		cli.Close() // close client on error
 		// check if it's a connection error (daemon not running)
@@ -206,7 +201,7 @@ const (
 )
 
 func checkDockerVersion(ctx context.Context, cli *client.Client) DockerVersion {
-	version, err := cli.ServerVersion(ctx)
+	version, err := cli.ServerVersion(ctx, client.ServerVersionOptions{})
 	if err != nil {
 		return DockerVersion{Version: "", Valid: false}
 	}
@@ -290,12 +285,12 @@ func checkVersionCompatibility(version, minVersion string) bool {
 }
 
 func checkContainerExists(ctx context.Context, cli *client.Client, name string) (exists, running bool) {
-	containers, err := cli.ContainerList(ctx, container.ListOptions{All: true})
+	containers, err := cli.ContainerList(ctx, client.ContainerListOptions{All: true})
 	if err != nil {
 		return false, false
 	}
 
-	for _, cont := range containers {
+	for _, cont := range containers.Items {
 		for _, containerName := range cont.Names {
 			if strings.TrimPrefix(containerName, "/") == name {
 				return true, cont.State == "running"
@@ -313,14 +308,14 @@ func checkVolumesExist(ctx context.Context, cli *client.Client, volumeNames []st
 		return false
 	}
 
-	volumes, err := cli.VolumeList(ctx, volume.ListOptions{})
+	volumes, err := cli.VolumeList(ctx, client.VolumeListOptions{})
 	if err != nil {
 		return false
 	}
 
 	// collect all volume names from Docker
-	existingVolumes := make([]string, 0, len(volumes.Volumes))
-	for _, vol := range volumes.Volumes {
+	existingVolumes := make([]string, 0, len(volumes.Items))
+	for _, vol := range volumes.Items {
 		existingVolumes = append(existingVolumes, vol.Name)
 	}
 
@@ -783,12 +778,12 @@ func getNetworkFailures(ctx context.Context, proxyURL string, dockerClient, work
 }
 
 func getContainerImageInfo(ctx context.Context, cli *client.Client, containerName string) *ImageInfo {
-	containers, err := cli.ContainerList(ctx, container.ListOptions{All: true})
+	containers, err := cli.ContainerList(ctx, client.ContainerListOptions{All: true})
 	if err != nil {
 		return nil
 	}
 
-	for _, cont := range containers {
+	for _, cont := range containers.Items {
 		for _, name := range cont.Names {
 			if strings.TrimPrefix(name, "/") == containerName {
 				return parseImageRef(cont.Image, cont.ImageID)
@@ -809,7 +804,7 @@ func getImageInfo(ctx context.Context, cli *client.Client, imageName string) *Im
 		return nil
 	}
 
-	images, err := cli.ImageList(ctx, image.ListOptions{})
+	images, err := cli.ImageList(ctx, client.ImageListOptions{})
 	if err != nil {
 		return nil
 	}
@@ -820,7 +815,7 @@ func getImageInfo(ctx context.Context, cli *client.Client, imageName string) *Im
 	}
 
 	fullImageName := imageInfo.Name + ":" + imageInfo.Tag
-	for _, img := range images {
+	for _, img := range images.Items {
 		for _, tag := range img.RepoTags {
 			if tag == imageName || tag == fullImageName {
 				imageInfo.Hash = img.ID
@@ -1011,7 +1006,7 @@ func checkDockerPullConnectivity(ctx context.Context, dockerClient, workerClient
 
 func checkSingleDockerPull(ctx context.Context, cli *client.Client, imageName string) bool {
 	// try to pull the image
-	reader, err := cli.ImagePull(ctx, imageName, image.PullOptions{})
+	reader, err := cli.ImagePull(ctx, imageName, client.ImagePullOptions{})
 	if err != nil {
 		return false
 	}
```

**File**: `backend/cmd/installer/processor/docker.go` (modified, +31/-34)
```diff
@@ -12,11 +12,8 @@ import (
 	"pentagi/pkg/tools"
 
 	cerrdefs "github.com/containerd/errdefs"
-	"github.com/docker/docker/api/types/container"
-	"github.com/docker/docker/api/types/image"
-	"github.com/docker/docker/api/types/network"
-	"github.com/docker/docker/api/types/volume"
-	"github.com/docker/docker/client"
+	"github.com/moby/moby/api/types/container"
+	"github.com/moby/moby/client"
 )
 
 type dockerOperationsImpl struct {
@@ -59,7 +56,7 @@ func (d *dockerOperationsImpl) removeWorkerContainers(ctx context.Context, state
 
 	d.processor.appendLog(MsgRemovingWorkerContainers, ProductStackWorker, state)
 
-	allContainers, err := cli.ContainerList(ctx, container.ListOptions{All: true})
+	allContainers, err := cli.ContainerList(ctx, client.ContainerListOptions{All: true})
 	if err != nil {
 		return fmt.Errorf("failed to list worker containers: %w", err)
 	}
@@ -74,7 +71,7 @@ func (d *dockerOperationsImpl) removeWorkerContainers(ctx context.Context, state
 	// ever handled the sweep can only ever reach this instance's own containers.
 	workerPrefix := d.tenantPrefix() + "pentagi-"
 	var containers []container.Summary
-	for _, c := range allContainers {
+	for _, c := range allContainers.Items {
 		for _, name := range c.Names {
 			if strings.HasPrefix(name, workerPrefix) {
 				containers = append(containers, c)
@@ -92,13 +89,13 @@ func (d *dockerOperationsImpl) removeWorkerContainers(ctx context.Context, state
 	for _, cont := range containers {
 		if cont.State == "running" {
 			d.processor.appendLog(fmt.Sprintf(MsgStoppingContainer, cont.ID[:12]), ProductStackWorker, state)
-			if err := cli.ContainerStop(ctx, cont.ID, container.StopOptions{}); err != nil {
+			if _, err := cli.ContainerStop(ctx, cont.ID, client.ContainerStopOptions{}); err != nil {
 				return fmt.Errorf("failed to stop worker container %s: %w", cont.ID, err)
 			}
 		}
 
 		d.processor.appendLog(fmt.Sprintf(MsgRemovingContainer, cont.ID[:12]), ProductStackWorker, state)
-		if err := cli.ContainerRemove(ctx, cont.ID, container.RemoveOptions{
+		if _, err := cli.ContainerRemove(ctx, cont.ID, client.ContainerRemoveOptions{
 			Force: true,
 		}); err != nil {
 			return fmt.Errorf("failed to remove worker container %s: %w", cont.ID, err)
@@ -112,21 +109,21 @@ func (d *dockerOperationsImpl) removeWorkerContainers(ctx context.Context, state
 }
 
 func (d *dockerOperationsImpl) removeWorkerImages(ctx context.Context, state *operationState) error {
-	return d.removeImages(ctx, state, image.RemoveOptions{
+	return d.removeImages(ctx, state, client.ImageRemoveOptions{
 		Force:         false,
 		PruneChildren: false,
 	})
 }
 
 func (d *dockerOperationsImpl) purgeWorkerImages(ctx context.Context, state *operationState) error {
-	return d.removeImages(ctx, state, image.RemoveOptions{
+	return d.removeImages(ctx, state, client.ImageRemoveOptions{
 		Force:         true,
 		PruneChildren: true,
 	})
 }
 
 func (d *dockerOperationsImpl) removeImages(
-	ctx context.Context, state *operationState, options image.RemoveOptions,
+	ctx context.Context, state *operationState, options client.ImageRemoveOptions,
 ) error {
 	if err := d.removeWorkerContainers(ctx, state); err != nil {
 		return err
@@ -158,19 +155,16 @@ func (d *dockerOperationsImpl) removeImages(
 
 // createMainDockerClient creates docker client for the main stack (non-worker) using current process env
 func (d *dockerOperationsImpl) createMainDockerClient() (*client.Client, error) {
-	return client.NewClientWithOpts(
-		client.FromEnv,
-		client.WithAPIVersionNegotiation(),
-	)
+	return client.New(client.FromEnv)
 }
 
 // checkMainDockerNetwork returns true if a docker network with given name exists
 func (d *dockerOperationsImpl) checkMainDockerNetwork(ctx context.Context, cli *client.Client, name string) (bool, error) {
-	nets, err := cli.NetworkList(ctx, network.ListOptions{})
+	nets, err := cli.NetworkList(ctx, client.NetworkListOptions{})
 	if err != nil {
 		return false, fmt.Errorf("failed to list docker networks: %w", err)
 	}
-	for _, n := range nets {
+	for _, n := range nets.Items {
 		if n.Name == name {
 			return true, nil
 		}
@@ -186,8 +180,9 @@ func (d *dockerOperationsImpl) createMainDockerNetwork(ctx context.Context, cli
 	}
 	if exists {
 		// inspect to validate labels
-		nw, err := cli.NetworkInspect(ctx, name, network.InspectOptions{})
+		inspectResult, err := cli.NetworkInspect(ctx, name, client.NetworkInspectOptions{})
 		if err == nil {
+			nw := inspectResult.Network
 			wantProject := ""
 			if envPath := d.processor.state.GetEnvPath(); envPath != "" {
 				wantProject = filepath.Base(filepath.Dir(envPath))
@@ -204,7 +199,7 @@ func (d *dockerOperationsImpl) createMainDockerNetwork(ctx context.Context, cli
 				return nil
 			}
 			d.processor.appendLog(fmt.Sprintf(MsgRecreatingDockerNetwork, name), ProductStackInstaller, state)
-			if err := cli.NetworkRemove(ctx, nw.ID); err != nil {
+			if _, err := cli.NetworkRemove(ctx, nw.ID, client.NetworkRemoveOpti
```

**File**: `backend/go.mod` (modified, +39/-43)
```diff
@@ -1,14 +1,14 @@
 module pentagi
 
-go 1.24.1
+go 1.26.5
 
 require (
 	github.com/99designs/gqlgen v0.17.57
-	github.com/aws/aws-sdk-go-v2 v1.41.2
+	github.com/aws/aws-sdk-go-v2 v1.41.5
 	github.com/aws/aws-sdk-go-v2/config v1.32.10
 	github.com/aws/aws-sdk-go-v2/credentials v1.19.10
-	github.com/aws/aws-sdk-go-v2/service/bedrockruntime v1.50.0
-	github.com/aws/smithy-go v1.24.1
+	github.com/aws/aws-sdk-go-v2/service/bedrockruntime v1.50.4
+	github.com/aws/smithy-go v1.24.2
 	github.com/caarlos0/env/v10 v10.0.0
 	github.com/charmbracelet/bubbles v0.21.0
 	github.com/charmbracelet/bubbletea v1.3.10
@@ -18,10 +18,8 @@ require (
 	github.com/charmbracelet/x/ansi v0.10.1
 	github.com/containerd/errdefs v1.0.0
 	github.com/coreos/go-oidc/v3 v3.11.0
-	github.com/creack/pty v1.1.21
+	github.com/creack/pty v1.1.24
 	github.com/digitalocean/go-smbios v0.0.0-20180907143718-390a4f403a8e
-	github.com/docker/docker v28.3.3+incompatible
-	github.com/docker/go-connections v0.5.0
 	github.com/docker/go-units v0.5.0
 	github.com/fatih/color v1.17.0
 	github.com/gin-contrib/cors v1.7.2
@@ -35,12 +33,14 @@ require (
 	github.com/gorilla/websocket v1.5.3
 	github.com/hashicorp/golang-lru/v2 v2.0.7
 	github.com/invopop/jsonschema v0.12.0
-	github.com/jackc/pgx/v5 v5.8.0
+	github.com/jackc/pgx/v5 v5.9.2
 	github.com/jinzhu/gorm v1.9.16
 	github.com/joho/godotenv v1.5.1
 	github.com/lib/pq v1.10.9
 	github.com/mattn/go-runewidth v0.0.16
-	github.com/ollama/ollama v0.23.0
+	github.com/moby/moby/api v1.55.0
+	github.com/moby/moby/client v0.5.1
+	github.com/ollama/ollama v0.32.5
 	github.com/pgvector/pgvector-go v0.1.1
 	github.com/pressly/goose/v3 v3.19.2
 	github.com/rivo/uniseg v0.4.7
@@ -54,27 +54,27 @@ require (
 	github.com/vektah/gqlparser/v2 v2.5.19
 	github.com/vxcontrol/cloud v0.9.0
 	github.com/vxcontrol/graphiti-go-client v0.9.0
-	github.com/vxcontrol/langchaingo v0.1.14-update.6
+	github.com/vxcontrol/langchaingo v0.1.15-0.20260804113937-da7016e399b0
 	github.com/wasilibs/go-re2 v1.10.0
 	github.com/xeipuuv/gojsonschema v1.2.0
-	go.opentelemetry.io/otel v1.39.0
+	go.opentelemetry.io/otel v1.43.0
 	go.opentelemetry.io/otel/exporters/otlp/otlplog/otlploggrpc v0.14.0
 	go.opentelemetry.io/otel/exporters/otlp/otlpmetric/otlpmetricgrpc v1.39.0
 	go.opentelemetry.io/otel/exporters/otlp/otlptrace/otlptracegrpc v1.39.0
 	go.opentelemetry.io/otel/log v0.14.0
-	go.opentelemetry.io/otel/metric v1.39.0
-	go.opentelemetry.io/otel/sdk v1.39.0
+	go.opentelemetry.io/otel/metric v1.43.0
+	go.opentelemetry.io/otel/sdk v1.43.0
 	go.opentelemetry.io/otel/sdk/log v0.14.0
-	go.opentelemetry.io/otel/sdk/metric v1.39.0
-	go.opentelemetry.io/otel/trace v1.39.0
-	go.opentelemetry.io/proto/otlp v1.9.0
-	golang.org/x/crypto v0.46.0
-	golang.org/x/net v0.48.0
-	golang.org/x/oauth2 v0.34.0
-	golang.org/x/sync v0.19.0
-	golang.org/x/sys v0.40.0
+	go.opentelemetry.io/otel/sdk/metric v1.43.0
+	go.opentelemetry.io/otel/trace v1.43.0
+	go.opentelemetry.io/proto/otlp v1.10.0
+	golang.org/x/crypto v0.53.0
+	golang.org/x/net v0.56.0
+	golang.org/x/oauth2 v0.36.0
+	golang.org/x/sync v0.21.0
+	golang.org/x/sys v0.46.0
 	google.golang.org/api v0.238.0
-	google.golang.org/grpc v1.79.3
+	google.golang.org/grpc v1.82.1
 	gopkg.in/yaml.v3 v3.0.1
 )
 
@@ -95,13 +95,13 @@ require (
 	github.com/alecthomas/chroma/v2 v2.14.0 // indirect
 	github.com/andybalholm/cascadia v1.3.3 // indirect
 	github.com/atotto/clipboard v0.1.4 // indirect
-	github.com/aws/aws-sdk-go-v2/aws/protocol/eventstream v1.7.5 // indirect
+	github.com/aws/aws-sdk-go-v2/aws/protocol/eventstream v1.7.8 // indirect
 	github.com/aws/aws-sdk-go-v2/feature/ec2/imds v1.18.18 // indirect
-	github.com/aws/aws-sdk-go-v2/internal/configsources v1.4.18 // indirect
-	github.com/aws/aws-sdk-go-v2/internal/endpoints/v2 v2.7.18 // indirect
+	github.com/aws/aws-sdk-go-v2/internal/configsources v1.4.21 // indirect
+	github.com/aws/aws-sdk-go-v2/internal/endpoints/v2 v2.7.21 // indirect
 	github.com/aws/aws-sdk-go-v2/internal/ini v1.8.4 // indirect
-	github.com/aws/aws-sdk-go-v2/service/internal/accept-encoding v1.13.5 // indirect
-	github.com/aws/aws-sdk-go-v2/service/internal/presigned-url v1.13.18 // indirect
+	github.com/aws/aws-sdk-go-v2/service/internal/accept-encoding v1.13.7 // indirect
+	github.com/aws/aws-sdk-go-v2/service/internal/presigned-url v1.13.21 // indirect
 	github.com/aws/aws-sdk-go-v2/service/signin v1.0.6 // indirect
 	github.com/aws/aws-sdk-go-v2/service/sso v1.30.11 // indirect
 	github.com/aws/aws-sdk-go-v2/service/ssooidc v1.35.15 // indirect
@@ -126,7 +126,8 @@ require (
 	github.com/cpuguy83/go-md2man/v2 v2.0.5 // indirect
 	github.com/davecgh/go-spew v1.1.2-0.20180830191138-d8f796af33cc // indirect
 	github.com/distribution/reference v0.6.0 // indirect
-	github.com/dlclark/regexp2 v1.11.4 // indirect
+	github.com/dlclark/regexp2 v1.11.5 // indirect
+	github.com/docker/go-connections v0.7.0 // indirect
 	github.com/erikgeiser/coninput v0.0.0-20211004153227-1c3628e74d0f // indirect
 	g
```

**File**: `backend/go.sum` (modified, +90/-105)
```diff
@@ -69,28 +69,28 @@ github.com/arbovm/levenshtein v0.0.0-20160628152529-48b4e1c0c4d0 h1:jfIu9sQUG6Ig
 github.com/arbovm/levenshtein v0.0.0-20160628152529-48b4e1c0c4d0/go.mod h1:t2tdKJDJF9BV14lnkjHmOQgcvEKgtqs5a1N3LNdJhGE=
 github.com/atotto/clipboard v0.1.4 h1:EH0zSVneZPSuFR11BlR9YppQTVDbh5+16AmcJi4g1z4=
 github.com/atotto/clipboard v0.1.4/go.mod h1:ZY9tmq7sm5xIbd9bOK4onWV4S6X0u6GY7Vn0Yu86PYI=
-github.com/aws/aws-sdk-go-v2 v1.41.2 h1:LuT2rzqNQsauaGkPK/7813XxcZ3o3yePY0Iy891T2ls=
-github.com/aws/aws-sdk-go-v2 v1.41.2/go.mod h1:IvvlAZQXvTXznUPfRVfryiG1fbzE2NGK6m9u39YQ+S4=
-github.com/aws/aws-sdk-go-v2/aws/protocol/eventstream v1.7.5 h1:zWFmPmgw4sveAYi1mRqG+E/g0461cJ5M4bJ8/nc6d3Q=
-github.com/aws/aws-sdk-go-v2/aws/protocol/eventstream v1.7.5/go.mod h1:nVUlMLVV8ycXSb7mSkcNu9e3v/1TJq2RTlrPwhYWr5c=
+github.com/aws/aws-sdk-go-v2 v1.41.5 h1:dj5kopbwUsVUVFgO4Fi5BIT3t4WyqIDjGKCangnV/yY=
+github.com/aws/aws-sdk-go-v2 v1.41.5/go.mod h1:mwsPRE8ceUUpiTgF7QmQIJ7lgsKUPQOUl3o72QBrE1o=
+github.com/aws/aws-sdk-go-v2/aws/protocol/eventstream v1.7.8 h1:eBMB84YGghSocM7PsjmmPffTa+1FBUeNvGvFou6V/4o=
+github.com/aws/aws-sdk-go-v2/aws/protocol/eventstream v1.7.8/go.mod h1:lyw7GFp3qENLh7kwzf7iMzAxDn+NzjXEAGjKS2UOKqI=
 github.com/aws/aws-sdk-go-v2/config v1.32.10 h1:9DMthfO6XWZYLfzZglAgW5Fyou2nRI5CuV44sTedKBI=
 github.com/aws/aws-sdk-go-v2/config v1.32.10/go.mod h1:2rUIOnA2JaiqYmSKYmRJlcMWy6qTj1vuRFscppSBMcw=
 github.com/aws/aws-sdk-go-v2/credentials v1.19.10 h1:EEhmEUFCE1Yhl7vDhNOI5OCL/iKMdkkYFTRpZXNw7m8=
 github.com/aws/aws-sdk-go-v2/credentials v1.19.10/go.mod h1:RnnlFCAlxQCkN2Q379B67USkBMu1PipEEiibzYN5UTE=
 github.com/aws/aws-sdk-go-v2/feature/ec2/imds v1.18.18 h1:Ii4s+Sq3yDfaMLpjrJsqD6SmG/Wq/P5L/hw2qa78UAY=
 github.com/aws/aws-sdk-go-v2/feature/ec2/imds v1.18.18/go.mod h1:6x81qnY++ovptLE6nWQeWrpXxbnlIex+4H4eYYGcqfc=
-github.com/aws/aws-sdk-go-v2/internal/configsources v1.4.18 h1:F43zk1vemYIqPAwhjTjYIz0irU2EY7sOb/F5eJ3HuyM=
-github.com/aws/aws-sdk-go-v2/internal/configsources v1.4.18/go.mod h1:w1jdlZXrGKaJcNoL+Nnrj+k5wlpGXqnNrKoP22HvAug=
-github.com/aws/aws-sdk-go-v2/internal/endpoints/v2 v2.7.18 h1:xCeWVjj0ki0l3nruoyP2slHsGArMxeiiaoPN5QZH6YQ=
-github.com/aws/aws-sdk-go-v2/internal/endpoints/v2 v2.7.18/go.mod h1:r/eLGuGCBw6l36ZRWiw6PaZwPXb6YOj+i/7MizNl5/k=
+github.com/aws/aws-sdk-go-v2/internal/configsources v1.4.21 h1:Rgg6wvjjtX8bNHcvi9OnXWwcE0a2vGpbwmtICOsvcf4=
+github.com/aws/aws-sdk-go-v2/internal/configsources v1.4.21/go.mod h1:A/kJFst/nm//cyqonihbdpQZwiUhhzpqTsdbhDdRF9c=
+github.com/aws/aws-sdk-go-v2/internal/endpoints/v2 v2.7.21 h1:PEgGVtPoB6NTpPrBgqSE5hE/o47Ij9qk/SEZFbUOe9A=
+github.com/aws/aws-sdk-go-v2/internal/endpoints/v2 v2.7.21/go.mod h1:p+hz+PRAYlY3zcpJhPwXlLC4C+kqn70WIHwnzAfs6ps=
 github.com/aws/aws-sdk-go-v2/internal/ini v1.8.4 h1:WKuaxf++XKWlHWu9ECbMlha8WOEGm0OUEZqm4K/Gcfk=
 github.com/aws/aws-sdk-go-v2/internal/ini v1.8.4/go.mod h1:ZWy7j6v1vWGmPReu0iSGvRiise4YI5SkR3OHKTZ6Wuc=
-github.com/aws/aws-sdk-go-v2/service/bedrockruntime v1.50.0 h1:TDKR8ACRw7G+GFaQlhoy6biu+8q6ZtSddQCy9avMdMI=
-github.com/aws/aws-sdk-go-v2/service/bedrockruntime v1.50.0/go.mod h1:XlhOh5Ax/lesqN4aZCUgj9vVJed5VoXYHHFYGAlJEwU=
-github.com/aws/aws-sdk-go-v2/service/internal/accept-encoding v1.13.5 h1:CeY9LUdur+Dxoeldqoun6y4WtJ3RQtzk0JMP2gfUay0=
-github.com/aws/aws-sdk-go-v2/service/internal/accept-encoding v1.13.5/go.mod h1:AZLZf2fMaahW5s/wMRciu1sYbdsikT/UHwbUjOdEVTc=
-github.com/aws/aws-sdk-go-v2/service/internal/presigned-url v1.13.18 h1:LTRCYFlnnKFlKsyIQxKhJuDuA3ZkrDQMRYm6rXiHlLY=
-github.com/aws/aws-sdk-go-v2/service/internal/presigned-url v1.13.18/go.mod h1:XhwkgGG6bHSd00nO/mexWTcTjgd6PjuvWQMqSn2UaEk=
+github.com/aws/aws-sdk-go-v2/service/bedrockruntime v1.50.4 h1:W6tKfa/s37faUnwJ71pGqsBO7/wfUX1L7tVprupQGo4=
+github.com/aws/aws-sdk-go-v2/service/bedrockruntime v1.50.4/go.mod h1:BZ+9thH0QOTDUwE8KAv/ZwUzsNC7CSMJXj/wtnZMs5k=
+github.com/aws/aws-sdk-go-v2/service/internal/accept-encoding v1.13.7 h1:5EniKhLZe4xzL7a+fU3C2tfUN4nWIqlLesfrjkuPFTY=
+github.com/aws/aws-sdk-go-v2/service/internal/accept-encoding v1.13.7/go.mod h1:x0nZssQ3qZSnIcePWLvcoFisRXJzcTVvYpAAdYX8+GI=
+github.com/aws/aws-sdk-go-v2/service/internal/presigned-url v1.13.21 h1:c31//R3xgIJMSC8S6hEVq+38DcvUlgFY0FM6mSI5oto=
+github.com/aws/aws-sdk-go-v2/service/internal/presigned-url v1.13.21/go.mod h1:r6+pf23ouCB718FUxaqzZdbpYFyDtehyZcmP5KL9FkA=
 github.com/aws/aws-sdk-go-v2/service/signin v1.0.6 h1:MzORe+J94I+hYu2a6XmV5yC9huoTv8NRcCrUNedDypQ=
 github.com/aws/aws-sdk-go-v2/service/signin v1.0.6/go.mod h1:hXzcHLARD7GeWnifd8j9RWqtfIgxj4/cAtIVIK7hg8g=
 github.com/aws/aws-sdk-go-v2/service/sso v1.30.11 h1:7oGD8KPfBOJGXiCoRKrrrQkbvCp8N++u36hrLMPey6o=
@@ -99,8 +99,8 @@ github.com/aws/aws-sdk-go-v2/service/ssooidc v1.35.15 h1:edCcNp9eGIUDUCrzoCu1jWA
 github.com/aws/aws-sdk-go-v2/service/ssooidc v1.35.15/go.mod h1:lyRQKED9xWfgkYC/wmmYfv7iVIM68Z5OQ88ZdcV1QbU=
 github.com/aws/aws-sdk-go-v2/service/sts v1.41.7 h1:NITQpgo9A5NrDZ57uOWj+abvXSb83BbyggcUBVksN7c=
 github.com/aws/aws-sdk-go-v2/service/
```

**File**: `backend/pkg/controller/flow.go` (modified, +2/-2)
```diff
@@ -26,7 +26,7 @@ import (
 	"pentagi/pkg/resources"
 	"pentagi/pkg/tools"
 
-	dockercontainer "github.com/docker/docker/api/types/container"
+	"github.com/moby/moby/client"
 	"github.com/sirupsen/logrus"
 )
 
@@ -744,7 +744,7 @@ func (fw *flowWorker) pushResourcesToContainer(ctx context.Context, addedPaths [
 		}()
 
 		copyErr := fw.docker.CopyToContainer(ctx, containerName, docker.WorkFolderPathInContainer, pr,
-			dockercontainer.CopyToContainerOptions{AllowOverwriteDirWithFile: true})
+			client.CopyToContainerOptions{AllowOverwriteDirWithFile: true})
 		pr.Close()
 		writeErr := <-errCh
 
```

---

### Incident Patch 6: `049527a3` (2026-08-04)
**Commit Message**: fix(docker): update alpine base image version in Dockerfile

- Updated the base image from alpine:3.23.3 to alpine:3.23.5 for improved security and stability.

**File**: `Dockerfile` (modified, +1/-1)
```diff
@@ -124,7 +124,7 @@ RUN go build -trimpath \
 # ========================================
 # Stage 3: Production Runtime Environment
 # ========================================
-FROM alpine:3.23.3
+FROM alpine:3.23.5
 
 # Establish non-privileged execution context with docker socket access
 RUN addgroup -g 998 docker && \
```

---

### Incident Patch 7: `4081292a` (2026-08-04)
**Commit Message**: fix(docker): update container error handling and logging

- Replaced client.IsErrNotFound with cerrdefs.IsNotFound for consistent error handling across container operations.
- Updated probe image version to alpine:3.23.5.
- Enhanced logging for container removal failures in flow tools, ensuring better traceability of issues.
- Improved context usage in tests for better cancellation handling.

**File**: `backend/pkg/docker/client.go` (modified, +16/-7)
```diff
@@ -17,6 +17,7 @@ import (
 	"pentagi/pkg/config"
 	"pentagi/pkg/database"
 
+	cerrdefs "github.com/containerd/errdefs"
 	"github.com/docker/docker/api/types"
 	"github.com/docker/docker/api/types/container"
 	"github.com/docker/docker/api/types/filters"
@@ -453,7 +454,7 @@ func (dc *dockerClient) StopContainer(ctx context.Context, containerID string, d
 
 	stopErr := dc.client.ContainerStop(ctx, containerID, container.StopOptions{})
 	if stopErr != nil {
-		if client.IsErrNotFound(stopErr) {
+		if cerrdefs.IsNotFound(stopErr) {
 			logger.Warn("target container already removed or never existed")
 		} else {
 			return fmt.Errorf("container shutdown failed: %w", stopErr)
@@ -486,10 +487,11 @@ func (dc *dockerClient) RemoveContainer(ctx context.Context, containerID string,
 		Force:         true,
 	}
 	if err := dc.client.ContainerRemove(ctx, containerID, options); err != nil {
-		if !client.IsErrNotFound(err) {
+		if !cerrdefs.IsNotFound(err) {
 			return fmt.Errorf("failed to remove container: %w", err)
 		}
-		// TODO: fix this case
+		// already gone (removed manually, or a prior call already succeeded);
+		// still mark it deleted below so the database row does not go stale.
 		logger.WithError(err).Warn("container not found")
 	}
 
@@ -600,16 +602,23 @@ func (dc *dockerClient) Cleanup(ctx context.Context) error {
 func (dc *dockerClient) IsContainerRunning(ctx context.Context, containerID string) (bool, error) {
 	inspection, err := dc.client.ContainerInspect(ctx, containerID)
 	if err != nil {
-		if !client.IsErrNotFound(err) {
+		if !cerrdefs.IsNotFound(err) {
 			return false, fmt.Errorf("container inspection failed: %w", err)
 		}
 		// a removed container is missing, not an inspection failure
 		return false, nil
 	}
 
+	if inspection.State == nil {
+		// the daemon always populates State for a successfully inspected
+		// container; treat the unexpected absence as "not running" rather
+		// than panicking on the field access below.
+		return false, nil
+	}
+
 	// Check both Running state and health status if available
 	isOperational := inspection.State.Running
-	if inspection.State != nil && inspection.State.Health != nil && inspection.State.Health.Status != "" {
+	if inspection.State.Health != nil && inspection.State.Health.Status != "" {
 		isOperational = isOperational && inspection.State.Health.Status != "unhealthy"
 	}
 
@@ -974,7 +983,7 @@ func getHostDataDir(ctx context.Context, cli *client.Client, dataDir, workDir st
 		return "" // unexpected error
 	}
 
-	mounts := []types.MountPoint{}
+	mounts := []container.MountPoint{}
 	for _, container := range containers {
 		inspect, err := cli.ContainerInspect(ctx, container.ID)
 		if err != nil {
@@ -1001,7 +1010,7 @@ func getHostDataDir(ctx context.Context, cli *client.Client, dataDir, workDir st
 	}
 
 	// sort mounts by destination length to get the most accurate mount point
-	slices.SortFunc(mounts, func(a, b types.MountPoint) int {
+	slices.SortFunc(mounts, func(a, b container.MountPoint) int {
 		return len(b.Destination) - len(a.Destination)
 	})
 
```

**File**: `backend/pkg/docker/client_test.go` (modified, +30/-34)
```diff
@@ -6,14 +6,18 @@ import (
 	"encoding/binary"
 	"errors"
 	"fmt"
+	"io"
 	"math/rand"
 	"strings"
 	"sync/atomic"
 	"testing"
 	"time"
 
+	cerrdefs "github.com/containerd/errdefs"
 	"github.com/docker/docker/api/types/container"
 	"github.com/docker/docker/client"
+	"github.com/sirupsen/logrus"
+	"github.com/stretchr/testify/require"
 )
 
 func TestStatContainerEntries_AllSucceed(t *testing.T) {
@@ -262,7 +266,7 @@ func failNames(failures []statFailure) map[string]bool {
 	return m
 }
 
-const probeImage = "alpine:3.20"
+const probeImage = "alpine:3.23.5"
 
 // newDaemonClient binds a client to the local daemon, skipping the test when
 // none is reachable.
@@ -274,66 +278,58 @@ func newDaemonClient(t *testing.T) *dockerClient {
 		t.Skipf("docker daemon unavailable: %v", err)
 	}
 
-	ctx := context.Background()
+	ctx := t.Context()
 	cli.NegotiateAPIVersion(ctx)
 	if _, err := cli.Ping(ctx); err != nil {
 		t.Skipf("docker daemon unavailable: %v", err)
 	}
 
-	return &dockerClient{client: cli}
+	logger := logrus.New()
+	logger.SetOutput(io.Discard)
+
+	return &dockerClient{client: cli, logger: logger}
 }
 
-// A flow keeps the id of its primary container in the database. When that
-// container is removed behind pentagi's back the id has to read as not running,
-// otherwise the flow can never rebuild it.
 func TestIsContainerRunningRemovedContainer(t *testing.T) {
 	dc := newDaemonClient(t)
-	ctx := context.Background()
+	ctx := t.Context()
 
 	created, err := dc.client.ContainerCreate(ctx, &container.Config{
 		Image:      probeImage,
 		Entrypoint: []string{"tail", "-f", "/dev/null"},
 	}, nil, nil, nil, "")
-	if client.IsErrNotFound(err) {
+	if cerrdefs.IsNotFound(err) {
 		t.Skipf("%s is not present locally", probeImage)
 	}
-	if err != nil {
-		t.Fatalf("create probe container: %v", err)
-	}
+	require.NoError(t, err)
+
 	t.Cleanup(func() {
-		dc.client.ContainerRemove(context.Background(), created.ID, container.RemoveOptions{Force: true})
+		ctx := context.WithoutCancel(ctx)
+		// the happy path already removes the container below; only report a
+		// cleanup failure if it is still there for some other reason.
+		if err := dc.client.ContainerRemove(ctx, created.ID, container.RemoveOptions{Force: true}); err != nil && !cerrdefs.IsNotFound(err) {
+			t.Errorf("cleanup: failed to remove container %q: %v", created.ID, err)
+		}
 	})
 
-	if err := dc.client.ContainerStart(ctx, created.ID, container.StartOptions{}); err != nil {
-		t.Fatalf("start probe container: %v", err)
-	}
+	require.NoError(t, dc.client.ContainerStart(ctx, created.ID, container.StartOptions{}))
 
 	running, err := dc.IsContainerRunning(ctx, created.ID)
-	if err != nil || !running {
-		t.Fatalf("got running=%v err=%v, want true and no error", running, err)
-	}
+	require.NoError(t, err)
+	require.True(t, running)
 
-	if err := dc.client.ContainerRemove(ctx, created.ID, container.RemoveOptions{Force: true}); err != nil {
-		t.Fatalf("remove probe container: %v", err)
-	}
+	require.NoError(t, dc.client.ContainerRemove(ctx, created.ID, container.RemoveOptions{Force: true}))
 
 	running, err = dc.IsContainerRunning(ctx, created.ID)
-	if err != nil {
-		t.Fatalf("removed container: got error %v, want none", err)
-	}
-	if running {
-		t.Fatal("removed container reported as running")
-	}
+	require.NoError(t, err)
+	require.False(t, running)
 }
 
 func TestIsContainerRunningUnknownContainer(t *testing.T) {
 	dc := newDaemonClient(t)
 
-	running, err := dc.IsContainerRunning(context.Background(), "pentagi-container-that-does-not-exist")
-	if err != nil {
-		t.Fatalf("unknown container: got error %v, want none", err)
-	}
-	if running {
-		t.Fatal("unknown container reported as running")
-	}
+	running, err := dc.IsContainerRunning(t.Context(), "pentagi-container-that-does-not-exist")
+
+	require.NoError(t, err)
+	require.False(t, running)
 }
```

**File**: `backend/pkg/tools/tools.go` (modified, +6/-2)
```diff
@@ -481,9 +481,9 @@ func (fte *flowToolsExecutor) SetGraphitiClient(client *graphiti.Client) {
 
 func (fte *flowToolsExecutor) Prepare(ctx context.Context) error {
 	if cnt, err := fte.db.GetFlowPrimaryContainer(ctx, fte.flowID); err == nil {
+		containerName := PrimaryTerminalName(fte.cfg.TenantPrefix(), fte.flowID)
 		// the stored status goes stale when the container is removed outside pentagi
 		if cnt.Status == database.ContainerStatusRunning {
-			containerName := PrimaryTerminalName(fte.cfg.TenantPrefix(), fte.flowID)
 			running, err := fte.docker.IsContainerRunning(ctx, cnt.LocalID.String)
 			if err != nil {
 				return fmt.Errorf("failed to inspect container '%s': %w", containerName, err)
@@ -498,7 +498,11 @@ func (fte *flowToolsExecutor) Prepare(ctx context.Context) error {
 			}
 		}
 
-		fte.docker.RemoveContainer(ctx, cnt.LocalID.String, cnt.ID)
+		if err := fte.docker.RemoveContainer(ctx, cnt.LocalID.String, cnt.ID); err != nil {
+			logrus.WithContext(ctx).WithError(err).WithFields(enrichLogrusFields(fte.flowID, nil, nil, logrus.Fields{
+				"container_name": containerName,
+			})).Warn("failed to remove stale primary container before rebuild")
+		}
 	}
 
 	// Explicit capability allow-list (CapDrop: ALL below): Docker's default 14
```

---

### Incident Patch 8: `a5274d3c` (2026-08-04)
**Commit Message**: Merge pull request #386 from F2had/fix/primary-container-missing-from-daemon

fix(docker): rebuild flow primary container when it is gone from the daemon

**File**: `backend/pkg/docker/client.go` (modified, +5/-1)
```diff
@@ -600,7 +600,11 @@ func (dc *dockerClient) Cleanup(ctx context.Context) error {
 func (dc *dockerClient) IsContainerRunning(ctx context.Context, containerID string) (bool, error) {
 	inspection, err := dc.client.ContainerInspect(ctx, containerID)
 	if err != nil {
-		return false, fmt.Errorf("container inspection failed: %w", err)
+		if !client.IsErrNotFound(err) {
+			return false, fmt.Errorf("container inspection failed: %w", err)
+		}
+		// a removed container is missing, not an inspection failure
+		return false, nil
 	}
 
 	// Check both Running state and health status if available
```

**File**: `backend/pkg/docker/client_test.go` (modified, +77/-0)
```diff
@@ -13,6 +13,7 @@ import (
 	"time"
 
 	"github.com/docker/docker/api/types/container"
+	"github.com/docker/docker/client"
 )
 
 func TestStatContainerEntries_AllSucceed(t *testing.T) {
@@ -260,3 +261,79 @@ func failNames(failures []statFailure) map[string]bool {
 	}
 	return m
 }
+
+const probeImage = "alpine:3.20"
+
+// newDaemonClient binds a client to the local daemon, skipping the test when
+// none is reachable.
+func newDaemonClient(t *testing.T) *dockerClient {
+	t.Helper()
+
+	cli, err := client.NewClientWithOpts(client.FromEnv)
+	if err != nil {
+		t.Skipf("docker daemon unavailable: %v", err)
+	}
+
+	ctx := context.Background()
+	cli.NegotiateAPIVersion(ctx)
+	if _, err := cli.Ping(ctx); err != nil {
+		t.Skipf("docker daemon unavailable: %v", err)
+	}
+
+	return &dockerClient{client: cli}
+}
+
+// A flow keeps the id of its primary container in the database. When that
+// container is removed behind pentagi's back the id has to read as not running,
+// otherwise the flow can never rebuild it.
+func TestIsContainerRunningRemovedContainer(t *testing.T) {
+	dc := newDaemonClient(t)
+	ctx := context.Background()
+
+	created, err := dc.client.ContainerCreate(ctx, &container.Config{
+		Image:      probeImage,
+		Entrypoint: []string{"tail", "-f", "/dev/null"},
+	}, nil, nil, nil, "")
+	if client.IsErrNotFound(err) {
+		t.Skipf("%s is not present locally", probeImage)
+	}
+	if err != nil {
+		t.Fatalf("create probe container: %v", err)
+	}
+	t.Cleanup(func() {
+		dc.client.ContainerRemove(context.Background(), created.ID, container.RemoveOptions{Force: true})
+	})
+
+	if err := dc.client.ContainerStart(ctx, created.ID, container.StartOptions{}); err != nil {
+		t.Fatalf("start probe container: %v", err)
+	}
+
+	running, err := dc.IsContainerRunning(ctx, created.ID)
+	if err != nil || !running {
+		t.Fatalf("got running=%v err=%v, want true and no error", running, err)
+	}
+
+	if err := dc.client.ContainerRemove(ctx, created.ID, container.RemoveOptions{Force: true}); err != nil {
+		t.Fatalf("remove probe container: %v", err)
+	}
+
+	running, err = dc.IsContainerRunning(ctx, created.ID)
+	if err != nil {
+		t.Fatalf("removed container: got error %v, want none", err)
+	}
+	if running {
+		t.Fatal("removed container reported as running")
+	}
+}
+
+func TestIsContainerRunningUnknownContainer(t *testing.T) {
+	dc := newDaemonClient(t)
+
+	running, err := dc.IsContainerRunning(context.Background(), "pentagi-container-that-does-not-exist")
+	if err != nil {
+		t.Fatalf("unknown container: got error %v, want none", err)
+	}
+	if running {
+		t.Fatal("unknown container reported as running")
+	}
+}
```

**File**: `backend/pkg/tools/tools.go` (modified, +16/-10)
```diff
@@ -481,18 +481,24 @@ func (fte *flowToolsExecutor) SetGraphitiClient(client *graphiti.Client) {
 
 func (fte *flowToolsExecutor) Prepare(ctx context.Context) error {
 	if cnt, err := fte.db.GetFlowPrimaryContainer(ctx, fte.flowID); err == nil {
-		switch cnt.Status {
-		case database.ContainerStatusRunning:
-			fte.primaryID = cnt.ID
-			fte.primaryLID = cnt.LocalID.String
-			if err := fte.syncMissingFiles(ctx); err != nil {
-				containerName := PrimaryTerminalName(fte.cfg.TenantPrefix(), fte.flowID)
-				return fmt.Errorf("failed to sync missing files to container '%s': %w", containerName, err)
+		// the stored status goes stale when the container is removed outside pentagi
+		if cnt.Status == database.ContainerStatusRunning {
+			containerName := PrimaryTerminalName(fte.cfg.TenantPrefix(), fte.flowID)
+			running, err := fte.docker.IsContainerRunning(ctx, cnt.LocalID.String)
+			if err != nil {
+				return fmt.Errorf("failed to inspect container '%s': %w", containerName, err)
+			}
+			if running {
+				fte.primaryID = cnt.ID
+				fte.primaryLID = cnt.LocalID.String
+				if err := fte.syncMissingFiles(ctx); err != nil {
+					return fmt.Errorf("failed to sync missing files to container '%s': %w", containerName, err)
+				}
+				return nil
 			}
-			return nil
-		default:
-			fte.docker.RemoveContainer(ctx, cnt.LocalID.String, cnt.ID)
 		}
+
+		fte.docker.RemoveContainer(ctx, cnt.LocalID.String, cnt.ID)
 	}
 
 	// Explicit capability allow-list (CapDrop: ALL below): Docker's default 14
```

---

### Incident Patch 9: `7d675b31` (2026-08-03)
**Commit Message**: fix(tools): rebuild the flow primary container when the daemon lost it

A flow stores the id of its primary container in the database. When that
container is removed outside pentagi the row keeps status 'running', so
Prepare reused a container the daemon no longer knows about and every
terminal call failed with "No such container" until the flow was recreated.

Confirm with the daemon before reusing the stored container and let the
existing remove-and-rebuild path take over when it is gone. An unreachable
daemon is still an error, so a transient failure cannot discard a healthy
container.

**File**: `backend/pkg/tools/tools.go` (modified, +16/-10)
```diff
@@ -481,18 +481,24 @@ func (fte *flowToolsExecutor) SetGraphitiClient(client *graphiti.Client) {
 
 func (fte *flowToolsExecutor) Prepare(ctx context.Context) error {
 	if cnt, err := fte.db.GetFlowPrimaryContainer(ctx, fte.flowID); err == nil {
-		switch cnt.Status {
-		case database.ContainerStatusRunning:
-			fte.primaryID = cnt.ID
-			fte.primaryLID = cnt.LocalID.String
-			if err := fte.syncMissingFiles(ctx); err != nil {
-				containerName := PrimaryTerminalName(fte.cfg.TenantPrefix(), fte.flowID)
-				return fmt.Errorf("failed to sync missing files to container '%s': %w", containerName, err)
+		// the stored status goes stale when the container is removed outside pentagi
+		if cnt.Status == database.ContainerStatusRunning {
+			containerName := PrimaryTerminalName(fte.cfg.TenantPrefix(), fte.flowID)
+			running, err := fte.docker.IsContainerRunning(ctx, cnt.LocalID.String)
+			if err != nil {
+				return fmt.Errorf("failed to inspect container '%s': %w", containerName, err)
+			}
+			if running {
+				fte.primaryID = cnt.ID
+				fte.primaryLID = cnt.LocalID.String
+				if err := fte.syncMissingFiles(ctx); err != nil {
+					return fmt.Errorf("failed to sync missing files to container '%s': %w", containerName, err)
+				}
+				return nil
 			}
-			return nil
-		default:
-			fte.docker.RemoveContainer(ctx, cnt.LocalID.String, cnt.ID)
 		}
+
+		fte.docker.RemoveContainer(ctx, cnt.LocalID.String, cnt.ID)
 	}
 
 	// Explicit capability allow-list (CapDrop: ALL below): Docker's default 14
```

---

### Incident Patch 10: `16f1e0c4` (2026-08-03)
**Commit Message**: fix(docker): report a removed container as not running

ContainerInspect returns a not-found error once a container is gone from
the daemon, and IsContainerRunning wrapped it as an inspection failure, so
callers could not tell a missing container apart from an unreachable
daemon. StopContainer and RemoveContainer already special-case
client.IsErrNotFound; do the same here.

**File**: `backend/pkg/docker/client.go` (modified, +5/-1)
```diff
@@ -600,7 +600,11 @@ func (dc *dockerClient) Cleanup(ctx context.Context) error {
 func (dc *dockerClient) IsContainerRunning(ctx context.Context, containerID string) (bool, error) {
 	inspection, err := dc.client.ContainerInspect(ctx, containerID)
 	if err != nil {
-		return false, fmt.Errorf("container inspection failed: %w", err)
+		if !client.IsErrNotFound(err) {
+			return false, fmt.Errorf("container inspection failed: %w", err)
+		}
+		// a removed container is missing, not an inspection failure
+		return false, nil
 	}
 
 	// Check both Running state and health status if available
```

**File**: `backend/pkg/docker/client_test.go` (modified, +77/-0)
```diff
@@ -13,6 +13,7 @@ import (
 	"time"
 
 	"github.com/docker/docker/api/types/container"
+	"github.com/docker/docker/client"
 )
 
 func TestStatContainerEntries_AllSucceed(t *testing.T) {
@@ -260,3 +261,79 @@ func failNames(failures []statFailure) map[string]bool {
 	}
 	return m
 }
+
+const probeImage = "alpine:3.20"
+
+// newDaemonClient binds a client to the local daemon, skipping the test when
+// none is reachable.
+func newDaemonClient(t *testing.T) *dockerClient {
+	t.Helper()
+
+	cli, err := client.NewClientWithOpts(client.FromEnv)
+	if err != nil {
+		t.Skipf("docker daemon unavailable: %v", err)
+	}
+
+	ctx := context.Background()
+	cli.NegotiateAPIVersion(ctx)
+	if _, err := cli.Ping(ctx); err != nil {
+		t.Skipf("docker daemon unavailable: %v", err)
+	}
+
+	return &dockerClient{client: cli}
+}
+
+// A flow keeps the id of its primary container in the database. When that
+// container is removed behind pentagi's back the id has to read as not running,
+// otherwise the flow can never rebuild it.
+func TestIsContainerRunningRemovedContainer(t *testing.T) {
+	dc := newDaemonClient(t)
+	ctx := context.Background()
+
+	created, err := dc.client.ContainerCreate(ctx, &container.Config{
+		Image:      probeImage,
+		Entrypoint: []string{"tail", "-f", "/dev/null"},
+	}, nil, nil, nil, "")
+	if client.IsErrNotFound(err) {
+		t.Skipf("%s is not present locally", probeImage)
+	}
+	if err != nil {
+		t.Fatalf("create probe container: %v", err)
+	}
+	t.Cleanup(func() {
+		dc.client.ContainerRemove(context.Background(), created.ID, container.RemoveOptions{Force: true})
+	})
+
+	if err := dc.client.ContainerStart(ctx, created.ID, container.StartOptions{}); err != nil {
+		t.Fatalf("start probe container: %v", err)
+	}
+
+	running, err := dc.IsContainerRunning(ctx, created.ID)
+	if err != nil || !running {
+		t.Fatalf("got running=%v err=%v, want true and no error", running, err)
+	}
+
+	if err := dc.client.ContainerRemove(ctx, created.ID, container.RemoveOptions{Force: true}); err != nil {
+		t.Fatalf("remove probe container: %v", err)
+	}
+
+	running, err = dc.IsContainerRunning(ctx, created.ID)
+	if err != nil {
+		t.Fatalf("removed container: got error %v, want none", err)
+	}
+	if running {
+		t.Fatal("removed container reported as running")
+	}
+}
+
+func TestIsContainerRunningUnknownContainer(t *testing.T) {
+	dc := newDaemonClient(t)
+
+	running, err := dc.IsContainerRunning(context.Background(), "pentagi-container-that-does-not-exist")
+	if err != nil {
+		t.Fatalf("unknown container: got error %v, want none", err)
+	}
+	if running {
+		t.Fatal("unknown container reported as running")
+	}
+}
```

---

### Incident Patch 11: `b8c1b7d9` (2026-08-03)
**Commit Message**: refactor(tests): update pentester prompt tests for tool-agnostic guidance

- Renamed the test function to reflect a broader focus on CLI argument guidance rather than specific XSStrike flags.
- Enhanced test descriptions and guidance to cover common AI-agent mistakes, ensuring clarity and tool-agnostic advice.
- Updated the template to remove specific tool references, promoting a more generalized approach to command-line argument handling.

**File**: `backend/pkg/templates/prompts/pentester.tmpl` (modified, +6/-4)
```diff
@@ -330,10 +330,12 @@ Check tool availability with 'which [tool]' before use. Install missing tools if
 </usage_notes>
 
 <cli_argument_protocol>
-- Verify command-specific flags with `[tool] -h` or `[tool] --help` before first use when the exact syntax is uncertain.
-- Do not copy flags between different tools, and do not invent output flags: do not pass `-c`, `-o`, or `-o /dev/null` to a tool unless that tool's own `--help` documents them.
-- For XSStrike specifically, do not use `xsstrike -c` or `xsstrike -o` (including `xsstrike -o /dev/null`); XSStrike does not accept these arguments. Confirm the exact flags with `xsstrike --help`.
-- If output needs to be saved, reduced, or discarded, use shell redirection (for example, `> results.txt` or `> /dev/null`) or the tool's documented logging option instead of inventing unsupported output flags.
+Common AI-agent mistakes with CLI security tools, and how to avoid them:
+- Hallucinated flags: verify uncertain syntax with `[tool] -h` or `[tool] --help` before first use, and re-check after any failure suggesting memorized syntax is stale (renamed flag, changed default, different installed version).
+- Cross-tool flag assumptions: the same letter or word means different things per tool (`-p` is port in nmap, password in hydra, proxy elsewhere). Never copy a flag from one tool to another, and never invent an output flag (`-o`, `-c`, `-o /dev/null`, etc.) that the target tool's own `--help` does not document.
+- Output handling: to save, filter, or discard output, use shell redirection (`> results.txt`, `> /dev/null`, `2>&1`) or the tool's documented logging option instead of guessing an unsupported flag.
+- Machine-readable output: when output must be parsed or piped into another tool, request the tool's structured format explicitly (e.g. nmap `-oX`/`-oG`, or a `-json`/`-jsonl` flag many scanners expose) instead of parsing its default free-text output.
+- Argument quoting: quote or escape payload strings containing shell metacharacters (semicolons, pipes, ampersands, `$`, quotes, backticks, or glob characters like `*`/`?`) — otherwise the shell, not the target tool, interprets them; this most often corrupts XSS/SQLi payloads and URLs with query parameters.
 </cli_argument_protocol>
 
 <msf_workflow_protocol>
```

**File**: `backend/pkg/templates/templates_test.go` (modified, +26/-10)
```diff
@@ -1013,9 +1013,12 @@ func TestQuestionTaskPlannerPrompt(t *testing.T) {
 	}
 }
 
-// TestPentesterPromptXSStrikeArgumentGuidance keeps the pentester prompt from
-// recommending unsupported XSStrike flags when composing terminal commands.
-func TestPentesterPromptXSStrikeArgumentGuidance(t *testing.T) {
+// TestPentesterPromptCLIArgumentGuidance keeps the pentester prompt's CLI
+// argument guidance generic (tool-agnostic) rather than hardcoding advice for
+// a single utility, while still covering the common AI-agent mistake classes:
+// hallucinated flags, cross-tool flag assumptions, output redirection,
+// machine-readable output, and shell-metacharacter quoting.
+func TestPentesterPromptCLIArgumentGuidance(t *testing.T) {
 	defaultPrompts, err := templates.GetDefaultPrompts()
 	if err != nil {
 		t.Fatalf("Failed to load default prompts: %v", err)
@@ -1035,18 +1038,31 @@ func TestPentesterPromptXSStrikeArgumentGuidance(t *testing.T) {
 
 	requiredGuidance := []string{
 		"cli_argument_protocol",
-		"XSStrike",
-		"xsstrike --help",
-		"xsstrike -c",
-		"xsstrike -o",
-		"xsstrike -o /dev/null",
+		"Hallucinated flags",
+		"--help",
+		"Cross-tool flag assumptions",
+		"Never copy a flag from one tool to another",
 		"shell redirection",
-		"inventing unsupported output flags",
+		"Machine-readable output",
+		"Argument quoting",
 	}
 
 	for _, guidance := range requiredGuidance {
 		if !strings.Contains(rendered, guidance) {
-			t.Errorf("Rendered pentester template missing XSStrike argument guidance: %s", guidance)
+			t.Errorf("Rendered pentester template missing CLI argument guidance: %s", guidance)
+		}
+	}
+
+	// The guidance must stay tool-agnostic: no single utility should be
+	// singled out by name, or the section would drift back into wasting
+	// context tokens on one tool instead of generalizing across Kali tools.
+	forbiddenGuidance := []string{
+		"XSStrike",
+		"xsstrike",
+	}
+	for _, forbidden := range forbiddenGuidance {
+		if strings.Contains(rendered, forbidden) {
+			t.Errorf("Rendered pentester template should not single out a specific tool by name: %s", forbidden)
 		}
 	}
 }
```

---

### Incident Patch 12: `c19665d8` (2026-08-03)
**Commit Message**: fix(docs): improve clarity and formatting in installation guides

- Consolidated sentences in the README and installation configuration guide for better readability.
- Removed unnecessary line breaks and ensured consistent formatting for installation instructions and requirements.
- Enhanced links to related documentation for a smoother user experience.

**File**: `README.md` (modified, +2/-5)
```diff
@@ -572,10 +572,7 @@ The system uses Docker containers for isolation and easy deployment, with separa
 
 ## Quick Start
 
-For a step-by-step walkthrough that connects installation, configuration, LLM
-and embedding provider testing, and your first login, see the
-[Installing and Configuring PentAGI](examples/guides/installation_configuration.md)
-guide. The sections below remain the detailed reference for each step.
+For a step-by-step walkthrough that connects installation, configuration, LLM and embedding provider testing, and your first login, see the [Installing and Configuring PentAGI](examples/guides/installation_configuration.md) guide. The sections below remain the detailed reference for each step.
 
 ### System Requirements
 
@@ -657,7 +654,7 @@ The PentAGI web console already manages several settings areas after the server
 The following configuration areas still need to be set on the server through environment variables, compose files, or mounted config files:
 
 - **LLM credentials and connection details**: API keys, endpoints, auth modes, and provider-specific connection settings for OpenAI, Anthropic, Bedrock, Ollama, custom providers, and similar backends; config-path settings apply only where supported, such as `OLLAMA_SERVER_CONFIG_PATH` and `LLM_SERVER_CONFIG_PATH`.
-- **Search provider credentials and options**: Settings such as `DUCKDUCKGO_*`, `GOOGLE_*`, `TAVILY_API_KEY`, `FIRECRAWL_API_KEY`, `FIRECRAWL_API_URL`, `TRAVERSAAL_API_KEY`, `PERPLEXITY_*`, `SEARXNG_*`, `SPLOITUS_ENABLED`, and the optional `WEB_SEARCH_INTERNAL_*` browser-analytics fallback settings.
+- **Search provider credentials and options**: Settings such as `DUCKDUCKGO_*`, `GOOGLE_*`, `TAVILY_API_KEY`, `FIRECRAWL_API_*`, `TRAVERSAAL_API_KEY`, `PERPLEXITY_*`, `SEARXNG_*`, `SPLOITUS_ENABLED`, and the optional `WEB_SEARCH_INTERNAL_*` browser-analytics fallback settings.
 - **Third-party integrations**: Langfuse, Graphiti, and similar external services remain server-side configuration.
 - **MCP server management**: MCP settings pages are not currently exposed as a live web-console feature.
 
```

**File**: `examples/guides/installation_configuration.md` (modified, +34/-102)
```diff
@@ -1,85 +1,49 @@
 # Installing and Configuring PentAGI
 
-This guide is the bridge between installing PentAGI and using it. It walks you
-through a first deployment in order: pick an installation method, set the core
-server variables, configure and test at least one LLM provider, configure the
-embedding provider, optionally add search and observability, then start the
-stack and verify it before your first login.
+This guide is the bridge between installing PentAGI and using it. It walks you through a first deployment in order: pick an installation method, set the core server variables, configure and test at least one LLM provider, configure the embedding provider, optionally add search and observability, then start the stack and verify it before your first login.
 
-It is intentionally concise and links to the detailed reference sections in the
-main [README](https://github.com/vxcontrol/pentagi#readme) instead of repeating
-them. When you finish here, continue with
-[How to Use PentAGI After Login](https://github.com/vxcontrol/pentagi#how-to-use-pentagi-after-login).
+It is intentionally concise and links to the detailed reference sections in the main [README](https://github.com/vxcontrol/pentagi#readme) instead of repeating them. When you finish here, continue with [How to Use PentAGI After Login](https://github.com/vxcontrol/pentagi#how-to-use-pentagi-after-login).
 
 ## Before you start
 
-- Docker and Docker Compose (or Podman), 2+ vCPU, 4+ GB RAM, 20+ GB free disk,
-  and outbound internet access for pulling images and reaching LLM providers.
-- At least one LLM provider you can authenticate to (OpenAI, Anthropic, Gemini,
-  AWS Bedrock, or a local/Ollama/OpenAI-compatible backend). PentAGI will not
-  run without one.
-- Decide how you want to install: the interactive installer (recommended) or a
-  manual Docker Compose deployment.
+- Docker and Docker Compose (or Podman), 2+ vCPU, 4+ GB RAM, 20+ GB free disk, and outbound internet access for pulling images and reaching LLM providers.
+- At least one LLM provider you can authenticate to (OpenAI, Anthropic, Gemini, AWS Bedrock, or a local/Ollama/OpenAI-compatible backend). PentAGI will not run without one.
+- Decide how you want to install: the interactive installer (recommended) or a manual Docker Compose deployment.
 
 ## Step 1 - Choose an installation method
 
 ### Option A: Interactive installer (recommended)
 
-The installer is a terminal UI that runs system checks, writes a sane `.env`,
-helps you configure LLM and search providers, hardens credentials, and starts
-the stack for you. Download the build for your platform and run it, then follow
-the prompts. See
-[Using Installer (Recommended)](https://github.com/vxcontrol/pentagi#using-installer-recommended)
-for download links and the Docker socket permission notes.
+The installer is a terminal UI that runs system checks, writes a sane `.env`, helps you configure LLM and search providers, hardens credentials, and starts the stack for you. Download the build for your platform and run it, then follow the prompts. See [Using Installer (Recommended)](https://github.com/vxcontrol/pentagi#using-installer-recommended) for download links and the Docker socket permission notes.
 
-If you use the installer, it can take you through most of Steps 2-6 below
-interactively. You can still use this guide as a checklist of what to confirm.
+If you use the installer, it can take you through most of Steps 2-6 below interactively. You can still use this guide as a checklist of what to confirm.
 
 ### Option B: Manual Docker Compose
 
-Create a working directory, copy `.env.example` to `.env`, fill in your keys,
-and bring up the stack. The full sequence (including the example provider config
-files and the `docker compose up -d` command) is in
-[Manual Installation](https://github.com/vxcontrol/pentagi#manual-installation).
+Create a working directory, copy `.env.example` to `.env`, fill in your keys, and bring up the stack. The full sequence (including the example provider config files and the `docker compose up -d` command) is in [Manual Installation](https://github.com/vxcontrol/pentagi#manual-installation).
 
 ## Step 2 - Set the core server variables
 
-Whichever method you used, confirm these in your `.env` before exposing the
-instance to anything but localhost:
+Whichever method you used, confirm these in your `.env` before exposing the instance to anything but localhost:
 
-- `PUBLIC_URL` - the URL users and the browser will actually load, for example
-  `https://pentagi.example.com` or `https://192.168.1.100:8443`. Use the real
-  hostname or IP, never `0.0.0.0`.
-- `CORS_ORIGINS` - every origin that will reach the UI, comma-separated. Include
-  both `https://localhost:8443` and your external URL if you use both.
-- `PENTAGI_LISTEN_IP` / `PENTAGI_LISTEN_PORT` - keep the default `127.0.0.1` for
-  localhost-only, or set the IP to `0.0.0.0` to accept external connections.
-- `COOKIE_SIGNING_SALT` an
```

---

### Incident Patch 13: `c4859cba` (2026-08-03)
**Commit Message**: fix(providers): improve error handling when retrieving providers from the database

- Added a specific error check to handle cases where the provider is not found in the database, providing clearer feedback on retrieval failures.

**File**: `backend/pkg/providers/providers.go` (modified, +3/-0)
```diff
@@ -697,6 +697,9 @@ func (pc *providerController) SeedDefaultProviders(ctx context.Context, userID i
 		Name:   prvname,
 		UserID: userID,
 	})
+	if err != nil && !errors.Is(err, sql.ErrNoRows) {
+		return fmt.Errorf("failed to get provider '%s' from database: %w", prvname, err)
+	}
 	if err != nil {
 		_, err = pc.db.CreateProvider(ctx, database.CreateProviderParams{
 			UserID: userID,
```

---

### Incident Patch 14: `881ba664` (2026-08-03)
**Commit Message**: fix(etester): update minimum connections configuration to respect maximum connections limit

- Modified the minimum connections setting in the connection pool configuration to ensure it does not exceed the maximum connections limit, enhancing resource management and preventing potential connection issues.

**File**: `backend/cmd/etester/main.go` (modified, +1/-1)
```diff
@@ -90,7 +90,7 @@ func main() {
 	}
 
 	poolConfig.MaxConns = min(int32(cfg.DBVectorMaxConns), 10)
-	poolConfig.MinConns = min(int32(cfg.DBMaxIdleConns), 2)
+	poolConfig.MinConns = min(int32(cfg.DBMaxIdleConns), 2, poolConfig.MaxConns)
 	poolConfig.MaxConnLifetime = time.Hour
 	poolConfig.MaxConnIdleTime = 30 * time.Minute
 
```

---

### Incident Patch 15: `5fa40578` (2026-08-03)
**Commit Message**: fix(docs): remove maxLength constraint for password fields in API documentation

- Updated the API documentation in `docs.go`, `swagger.json`, and `swagger.yaml` to remove the maxLength constraint for password fields, simplifying the validation requirements.
- Added `github.com/docker/go-units` as a direct dependency in `go.mod` to support updated functionality.

**File**: `backend/go.mod` (modified, +1/-1)
```diff
@@ -22,6 +22,7 @@ require (
 	github.com/digitalocean/go-smbios v0.0.0-20180907143718-390a4f403a8e
 	github.com/docker/docker v28.3.3+incompatible
 	github.com/docker/go-connections v0.5.0
+	github.com/docker/go-units v0.5.0
 	github.com/fatih/color v1.17.0
 	github.com/gin-contrib/cors v1.7.2
 	github.com/gin-contrib/sessions v1.0.1
@@ -126,7 +127,6 @@ require (
 	github.com/davecgh/go-spew v1.1.2-0.20180830191138-d8f796af33cc // indirect
 	github.com/distribution/reference v0.6.0 // indirect
 	github.com/dlclark/regexp2 v1.11.4 // indirect
-	github.com/docker/go-units v0.5.0 // indirect
 	github.com/erikgeiser/coninput v0.0.0-20211004153227-1c3628e74d0f // indirect
 	github.com/felixge/httpsnoop v1.0.4 // indirect
 	github.com/gabriel-vasile/mimetype v1.4.9 // indirect
```

**File**: `backend/pkg/server/docs/docs.go` (modified, +2/-4)
```diff
@@ -9217,8 +9217,7 @@ const docTemplate = `{
                     "minLength": 5
                 },
                 "password": {
-                    "type": "string",
-                    "maxLength": 100
+                    "type": "string"
                 }
             }
         },
@@ -10107,8 +10106,7 @@ const docTemplate = `{
                     "maxLength": 70
                 },
                 "password": {
-                    "type": "string",
-                    "maxLength": 100
+                    "type": "string"
                 },
                 "password_change_required": {
                     "type": "boolean"
```

**File**: `backend/pkg/server/docs/swagger.json` (modified, +3/-5)
```diff
@@ -9209,8 +9209,7 @@
                     "minLength": 5
                 },
                 "password": {
-                    "type": "string",
-                    "maxLength": 100
+                    "type": "string"
                 }
             }
         },
@@ -10099,8 +10098,7 @@
                     "maxLength": 70
                 },
                 "password": {
-                    "type": "string",
-                    "maxLength": 100
+                    "type": "string"
                 },
                 "password_change_required": {
                     "type": "boolean"
@@ -10640,4 +10638,4 @@
             "in": "header"
         }
     }
-}
+}
\ No newline at end of file
```

**File**: `backend/pkg/server/docs/swagger.yaml` (modified, +0/-2)
```diff
@@ -1067,7 +1067,6 @@ definitions:
         minLength: 5
         type: string
       password:
-        maxLength: 100
         type: string
     required:
     - current_password
@@ -1691,7 +1690,6 @@ definitions:
         maxLength: 70
         type: string
       password:
-        maxLength: 100
         type: string
       password_change_required:
         type: boolean
```

#### Recent Merged Pull Requests:
- **PR #431** (closed): chore(deps): bump @tiptap/core from 3.27.1 to 3.30.5 in /frontend in the npm_and_yarn group across 1 directory (@dependabot[bot])
- **PR #430** (closed): chore(deps): bump the go_modules group across 1 directory with 3 updates (@dependabot[bot])
- **PR #429** (closed): chore(deps): bump the npm_and_yarn group across 1 directory with 3 updates (@dependabot[bot])
- **PR #428** (closed): chore(deps): bump the go_modules group across 1 directory with 4 updates (@dependabot[bot])
- **PR #424** (closed): Integration request from aimlapi.com (@hugoaimlapi)
- **PR #421** (closed): feat(config): allow skipping tool-loop summaries (@SherryOvo)
- **PR #419** (closed): pentAgi (@cscoheru)
- **PR #418** (closed): feat(search): add opt-in Parallel Search MCP fallback (@georgeatparallel)

---

## 3. Empirical Evidence & Compliance Certification
- **Evidence Provenance**: Fetched directly from verified official GitHub REST API.
- **Zero Disk Footprint**: 0 bytes of unnecessary repository bloat stored locally.
- **TOS & Free-Tier Adherence**: Request pace complied with public API guidelines without fee, penalty, or unauthorized scraping.

---

## 4. Promotion & Integration Status
- **Status**: HARVESTED_DEEP_FORENSIC
- **Master Brain Sync**: Auto-committed to local/remote Master Brain repository.
