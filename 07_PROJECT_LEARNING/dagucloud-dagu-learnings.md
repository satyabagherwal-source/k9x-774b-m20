# Forensic Learning Record (Deep Inspection): dagucloud/dagu

> **Canonical Artifact**: `07_PROJECT_LEARNING/dagucloud-dagu-learnings.md`  
> **Source Platform**: GitHub ([https://github.com/dagucloud/dagu](https://github.com/dagucloud/dagu))  
> **Harvest Method**: Full-Spectrum Deep Extraction (Patches, Diffs, Source Code, Post-Mortems)  
> **Harvest Timestamp**: 2026-10-06T04:59:45.444Z  
> **Compliance State**: Free Tier Guaranteed | Strict Rate-Limit Backoff Honored  

---

## 1. Context & Architectural Overview
- **Repository / Resource**: `dagucloud/dagu`
- **Description**: Self-hostable workflow orchestrator for teams whose main work isn't orchestration. Declarative YAML over your scripts, SSH commands, containers, etc; keep workflows separate from business logic. One binary, no database, runs on limited H/W resources. Alternative to Airflow / Cron / Job Scheduler.
- **Primary Language / Ecosystem**: Go
- **Discovered Manifests / Configurations**: go.mod, README.md, Dockerfile
- **Stars / Engagement**: 4280 stars

---

## 2. Multi-Dimensional 8-Axis Investigation & Real Code Patches

### D1: Architecture & Structural Boundaries
- Entry configurations inspected via direct stream: go.mod, README.md, Dockerfile.
- Evaluated system abstractions and modular contracts.

### Core Architecture Module: `engine.go`
```
// Copyright (C) 2026 Yota Hamada
// SPDX-License-Identifier: GPL-3.0-or-later

package dagu

import (
	"context"
	"fmt"
	"log/slog"
	"maps"
	"os"
	"path/filepath"
	"slices"
	"time"

	"github.com/dagucloud/dagu/v2/internal/cmn/config"
	iengine "github.com/dagucloud/dagu/v2/internal/engine"
	"github.com/dagucloud/dagu/v2/internal/persis"
	"github.com/dagucloud/dagu/v2/internal/persis/file"
	filematerialization "github.com/dagucloud/dagu/v2/internal/persis/file/materialization"
	"github.com/dagucloud/dagu/v2/internal/persis/store"

	_ "github.com/dagucloud/dagu/v2/internal/runtime/builtin" // Register built-in executors for embedded use.
)

// ExecutionMode controls how a DAG run is dispatched.
type ExecutionMode string

const (
	// ExecutionModeLocal runs the DAG in the current process.
	ExecutionModeLocal ExecutionMode = "local"
	// ExecutionModeDistributed dispatches the DAG to configured coordinators.
	ExecutionModeDistributed ExecutionMode = "distributed"
)

// Options configures an embedded Dagu engine.
type Options struct {
	// HomeDir is the Dagu application home used for default config and data paths.
	HomeDir string
	// ConfigFile loads Dagu configuration from an explicit config file.
	ConfigFile string
	// DAGsDir overrides the directory used to resolve named DAGs and sub-DAGs.
	DAGsDir string
	// DataDir overrides the file-backed state directory.
	DataDir string
	// LogDir overrides the run log directory.
	LogDir string
	// ArtifactDir overrides the artifact directory.
	ArtifactDir string
	// BaseConfig points at a base configuration file applied during DAG loading.
	BaseConfig string
	// Logger receives embedded engine logs. A quiet logger is used when nil.
	Logger *slog.Logger

	// DefaultMode is used when a run does not set WithMode.
	DefaultMode ExecutionMode
	// Distributed configures dispatch and worker clients.
	Distributed *DistributedOptions
}

// DistributedOptions configures distributed execution.
type DistributedOptions struct {
	// Coordinators are coordinator gRPC addresses.
	Coordinators []string
	// TLS configures coordinator client TLS.
	TLS TLSOptions
	// WorkerSelector constrains distributed runs to matching workers.
	WorkerSelector map[string]string
	// PollInterval controls distributed run status polling.
	PollInterval time.Duration
	// MaxStatusErrors is the number of consecutive status failures before Wait fails.
	MaxStatusErrors int
}

// TLSOptions configures TLS for coordinator and worker peer clients.
type TLSOptions struct {
	// Insecure explicitly allows plaintext coordinator connections.
	Insecure bool
	// CertFile is the client certificate file for TLS connections.
	CertFile string
	// KeyFile is the client private key file for TLS connections.
	KeyFile string
	// ClientCAFile is the CA file used to verify coordinator certificates.
	ClientCAFile string
	// SkipTLSVerify skips coordinator certificate verification.
	SkipTLSVerify bool
}

// RunRef identifies a DAG run.
type RunRef struct {
	Name string
	ID   string
}

// Status is a stable snapshot of a DAG run.
type Status struct {
	Name        string
	RunID       string
	AttemptID   string
	Status      string
	StartedAt   time.Time
	FinishedAt  time.Time
	Error       string
	LogFile     string
	ArchiveDir  string
	WorkerID    string
	TriggerType string
}

// WorkerOptions configures an embedded distributed worker.
type WorkerOptions struct {
	// ID is the worker identifier. A host and process based ID is generated when empty.
	ID string
	// MaxActiveRuns limits concurrent DAG runs. A default is used when zero or negative.
	MaxActiveRuns int
	// Labels are advertised to coordinators and matched by worker selectors.
	Labels map[string]string
	// Coordinators overrides DistributedOptions.Coordinators when non-empty.
	// If empty, the worker falls back to the engine-level DistributedOptions.
	// The resolved coordinator list must contain at least one non-empty address.
	Coordinators []string
	// TLS overrides DistributedOptions.TLS when non-zero. If zero, the worker
	// falls back to the engine-level DistributedOptions TLS settings.
	TLS TLSOptions
	// HealthPort starts the worker health endpoint on the given port. Zero disables it.
	HealthPort int
}

// Engine is an embedded Dagu engine backed by the configured file stores.
type Engine struct {
	inner *iengine.Engine
}

// Run is a handle for an asynchronous DAG run.
type Run struct {
	inner *iengine.Run
}

// Worker is a distributed worker connected to configured coordinators.
type Worker struct {
	inner *iengine.Worker
}

// RunOption customizes a single DAG run.
type RunOption func(*runOptions)

type runOptions struct {
	runID             string
	name              string
	params            map[string]string
	paramsList        []string
	defaultWorkingDir string
	mode              ExecutionMode
	workerSelector    map[string]string
	labels            []string
	dryRun            bool
	noReuse           bool
}

// New creates an embedded Dagu engine.
func New(ctx context.Context, opts Options) (*Engine, error) {
	inner, err := iengine.New(ctx, internalOptions(opts))
	if err != nil {
		return nil, err
	}
	return &Engine{inner: inner}, nil
}

// Close releases engine resources.
func (e *Engine) Close(ctx context.Context) error {
	if e == nil || e.inner == nil {
		return nil
	}
	return e.inner.Close(ctx)
}

// RunFile loads a DAG definition from a file and starts it asynchronously.
func (e *Engine) RunFile(ctx context.Context, path string, opts ...RunOption) (*Run, error) {
	if e == nil || e.inner == nil {
		return nil, fmt.Errorf("engine is not initialized")
	}
	runOpts := applyRunOptions(opts)
	inner, err := e.inner.RunFile(ctx, path, internalRunOptions(runOpts))
	if err != nil {
		return nil, err
	}
	return &Run{inner: inner}, nil
}

// RunYAML loads a DAG definition from YAML bytes and starts it asynchronously.
func (e *Engine) RunYAML(ctx context.Context, yaml []byte, opts ...RunOption) (*Run, error) {
	if e == nil || e.inner == nil {
		return nil, fmt.Errorf("engine is not initialized")
	}
	runOpts := applyRunOptions(opts)
	inner, err := e.inner.RunYAML(ctx, yaml, internalRunOptions(runOpts))
	if err != nil {
		return nil, err
	}
	return &Run{inner: inner}, nil
}

// Status reads the latest status for a local DAG run.
func (e *Engine) Status(ctx context.Context, ref RunRef) (*Status, error) {
	if e == nil || e.inner == nil {
		return nil, fmt.Errorf("engine is not initialized")
	}
	status, err := e.inner.Status(ctx, internalRunRef(ref))
	if err != nil {
		return nil, err
	}
	return publicStatus(status), nil
}

// Outputs reads the collected step outputs for a local DAG run.
func (e *Engine) Outputs(ctx context.Context, ref RunRef) (map[string]string, error) {
	if e == nil || e.inner == nil {
		return nil, fmt.Errorf("engine is not initialized")
	}
	return e.inner.Outputs(ctx, internalRunRef(ref))
}

// Stop requests cancellation for a local DAG run.
func (e *Engine) Stop(ctx context.Context, ref RunRef) error {
	if e == nil || e.inner == nil {
		return fmt.Errorf("engine is not initialized")
	}
	return e.inner.Stop(ctx, internalRunRef(ref))
}

// NewWorker creates an embedded distributed worker.
func (e *Engine) NewWorker(opts WorkerOptions) (*Worker, error) {
	if e == nil || e.inner == nil {
		return nil, fmt.Errorf("engine is not initialized")
	}
	inner, err := e.inner.NewWorker(internalWorkerOptions(opts))
	if err != nil {
		return nil, err
	}
	return &Worker{inner: inner}, nil
}

// Ref returns the run reference.
func (r *Run) Ref() RunRef {
	if r == nil || r.inner == nil {
		return RunRef{}
	}
	return publicRunRef(r.inner.Ref())
}

// ID returns the DAG run ID.
func (r *Run) ID() string {
	if r == nil || r.inner == nil {
		return ""
	}
	return r.inner.ID()
}

// Name returns the DAG name.
func (r *Run) Name() string {
	if r == nil || r.inner == nil {
		return ""
	}
	return r.inner.Name()
}

// Wait blocks until the DAG run reaches a terminal state or ctx is canceled.
func (r *Run) Wait(ctx context.Context) (*Status, error) {
	if r == nil || r.inner == nil {
		return nil, fmt.Errorf("run is not initialized")
	}
	status, err := r.inner.Wait(ctx)
	return publicStatus(status), err
}

// Status returns the current run status.
func (r *Run) Status(ctx context.Context) (*Status, error) {
	if r == nil || r.inner == nil {
		return nil, fmt.Errorf("run is not initialized")
	}
	status, err := r.inner.Status(ctx)
	return publicStatus(status), err
}

// Outputs reads the collected step outputs for this run.
func (r *Run) Outputs(ctx context.Context) (map[string]string, error) {
	if r == nil || r.inner == nil {
		return nil, fmt.Errorf("run is not initialized")
	}
	return r.inner.Outputs(ctx)
}

// Stop requests cancellation for this run.
func (r *Run) Stop(ctx context.Context) error {
	if r == nil || r.inner == nil {
		return fmt.Errorf("run is not initialized")
	}
	return r.inner.Stop(ctx)
}

// Start registers and starts the worker. It blocks until ctx is canceled or the
// worker exits with an error.
func (w *Worker) Start(ctx context.Context) error {
	if w == nil || w.inner == nil {
		return fmt.Errorf("worker is not initialized")
	}
	return w.inner.Start(ctx)
}

// Stop stops the worker.
func (w *Worker) Stop(ctx context.Context) error {
	if w == nil || w.inner == nil {
		return nil
	}
	return w.inner.Stop(ctx)
}

// WaitReady blocks until the worker has registered with a coordinator.
func (w *Worker) WaitReady(ctx context.Context) error {
	if w == nil || w.inner == nil {
		return fmt.Errorf("worker is not initialized")
	}
	return w.inner.WaitReady(ctx)
}

func applyRunOptions(opts []RunOption) runOptions {
	var runOpts runOptions
	for _, opt := range opts {
		opt(&runOpts)
	}
	return runOpts
}

// WithRunID sets an explicit DAG run ID.
func WithRunID(id string) RunOption {
	return func(o *runOptions) {
		o.runID = id
	}
}

// WithName overrides the loaded DAG name.
func WithName(name string) RunOption {
	return func(o *runOptions) {
		o.name = name
	}
}

// WithParams sets
```

### Core Architecture Module: `internal/auth/webhook.go`
```
// Copyright (C) 2026 Yota Hamada
// SPDX-License-Identifier: GPL-3.0-or-later

package auth

import (
	"encoding/json"
	"time"

	"github.com/google/uuid"
)

type WebhookAuthMode string

const (
	WebhookAuthModeTokenOnly    WebhookAuthMode = "token_only"
	WebhookAuthModeTokenAndHMAC WebhookAuthMode = "token_and_hmac"
	WebhookAuthModeHMACOnly     WebhookAuthMode = "hmac_only"
)

type WebhookHMACEnforcementMode string

const (
	WebhookHMACEnforcementModeStrict  WebhookHMACEnforcementMode = "strict"
	WebhookHMACEnforcementModeObserve WebhookHMACEnforcementMode = "observe"
)

const (
	WebhookHMACAlgorithm         = "HMAC-SHA256"
	WebhookHMACHeaderName        = "X-Dagu-Signature"
	WebhookHMACHeaderValueFormat = "sha256=<hex>"
)

func (m WebhookAuthMode) OrDefault() WebhookAuthMode {
	if m == "" {
		return WebhookAuthModeTokenOnly
	}
	return m
}

// Webhook represents a webhook configuration for triggering a specific DAG.
// Each DAG can have at most one webhook. The token is stored as a bcrypt hash.
type Webhook struct {
	// ID is the unique identifier for the webhook (UUID).
	ID string `json:"id"`
	// DAGName is the file name of the DAG this webhook triggers.
	// This serves as a unique constraint - one webhook per DAG.
	DAGName string `json:"dagName"`
	// TokenHash is the bcrypt hash of the webhook token secret.
	// Excluded from JSON serialization for security.
	TokenHash string `json:"-"`
	// TokenPrefix stores the first 8 characters of the token for identification.
	TokenPrefix string `json:"tokenPrefix"`
	// Enabled indicates whether the webhook is active.
	Enabled bool `json:"enabled"`
	// AllowedProfiles contains the runtime profiles callers may select with the
	// webhook profile header. An empty list disables caller selection.
	AllowedProfiles []string `json:"allowedProfiles,omitempty"`
	// ProfileTokens are additional tokens that each run the DAG with one
	// fixed runtime profile.
	ProfileTokens []WebhookProfileToken `json:"profileTokens,omitempty"`
	// CreatedAt is the timestamp when the webhook was created.
	CreatedAt time.Time `json:"createdAt"`
	// UpdatedAt is the timestamp when the webhook was last modified.
	UpdatedAt time.Time `json:"updatedAt"`
	// CreatedBy is the user ID of the admin who created the webhook.
	CreatedBy string `json:"createdBy"`
	// LastUsedAt is the timestamp when the webhook was last triggered.
	LastUsedAt *time.Time `json:"lastUsedAt,omitempty"`
	// AuthMode controls which request authentication mode the webhook uses.
	AuthMode WebhookAuthMode `json:"-"`
	// HMACEnforcementMode controls whether HMAC failures block requests when HMAC is enabled.
	HMACEnforcementMode WebhookHMACEnforcementMode `json:"-"`
	// HMACSecret is stored decrypted in memory and encrypted at rest.
	HMACSecret string `json:"-"`
	// HMACSecretGeneratedAt records when the HMAC secret was last generated.
	HMACSecretGeneratedAt *time.Time `json:"-"`
}

// WebhookProfileToken is a webhook token bound to one runtime profile.
// The token is stored as a bcrypt hash.
type WebhookProfileToken struct {
	// ID is the unique identifier for the token (UUID).
	ID string `json:"id"`
	// Name labels the token, for example after the caller that holds it.
	Name string `json:"name"`
	// TokenHash is the bcrypt hash of the token secret.
	// Excluded from JSON serialization for security.
	TokenHash string `json:"-"`
	// TokenPrefix stores the leading characters of the token for identification.
	TokenPrefix string `json:"tokenPrefix"`
	// Profile is the runtime profile every request with this token runs with.
	Profile string `json:"profile"`
	// CreatedAt is the timestamp when the token was created.
	CreatedAt time.Time `json:"createdAt"`
	// CreatedBy is the user ID of the admin who created the token.
	CreatedBy string `json:"createdBy"`
	// LastUsedAt is the timestamp when the token last authorized a request.
	LastUsedAt *time.Time `json:"lastUsedAt,omitempty"`
}

// NewWebhookProfileToken creates a WebhookProfileToken with a new UUID and
// sets CreatedAt to the current UTC time.
func NewWebhookProfileToken(name, profile, tokenHash, tokenPrefix, createdBy string) WebhookProfileToken {
	return WebhookProfileToken{
		ID:          uuid.New().String(),
		Name:        name,
		TokenHash:   tokenHash,
		TokenPrefix: tokenPrefix,
		Profile:     profile,
		CreatedAt:   time.Now().UTC(),
		CreatedBy:   createdBy,
	}
}

// NewWebhook creates a Webhook with a new UUID and sets CreatedAt and UpdatedAt to the current UTC time.
// It validates that required fields are not empty.
// Returns an error if validation fails.
func NewWebhook(dagName, tokenHash, tokenPrefix, createdBy string) (*Webhook, error) {
	if dagName == "" {
		return nil, ErrInvalidWebhookDAGName
	}
	if tokenHash == "" {
		return nil, ErrInvalidWebhookTokenHash
	}
	now := time.Now().UTC()
	return &Webhook{
		ID:          uuid.New().String(),
		DAGName:     dagName,
		TokenHash:   tokenHash,
		TokenPrefix: tokenPrefix,
		Enabled:     true, // Enabled by default on creation
		CreatedAt:   now,
		UpdatedAt:   now,
		CreatedBy:   createdBy,
		AuthMode:    WebhookAuthModeTokenOnly,
	}, nil
}

// WebhookForStorage is used for JSON serialization to persistent storage.
// It includes the token hash which is excluded from the regular Webhook JSON.
type WebhookForStorage struct {
	ID                    string                          `json:"id"`
	DAGName               string                          `json:"dagName"`
	TokenHash             string                          `json:"tokenHash"`
	TokenPrefix           string                          `json:"tokenPrefix"`
	Enabled               bool                            `json:"enabled"`
	AllowedProfiles       []string                        `json:"allowedProfiles,omitempty"`
	ProfileTokens         []WebhookProfileTokenForStorage `json:"profileTokens,omitempty"`
	CreatedAt             time.Time                       `json:"createdAt"`
	UpdatedAt             time.Time                       `json:"updatedAt"`
	CreatedBy             string                          `json:"createdBy"`
	LastUsedAt            *time.Time                      `json:"lastUsedAt,omitempty"`
	AuthMode              WebhookAuthMode                 `json:"authMode,omitempty"`
	HMACEnforcementMode   WebhookHMACEnforcementMode      `json:"hmacEnforcementMode,omitempty"`
	HMACSecretEnc         string                          `json:"hmacSecretEnc,omitempty"`
	HMACSecretGeneratedAt *time.Time                      `json:"hmacSecretGeneratedAt,omitempty"`
}

// WebhookProfileTokenForStorage is the persisted form of a WebhookProfileToken,
// including the token hash.
type WebhookProfileTokenForStorage struct {
	ID          string     `json:"id"`
	Name        string     `json:"name"`
	TokenHash   string     `json:"tokenHash"`
	TokenPrefix string     `json:"tokenPrefix"`
	Profile     string     `json:"profile"`
	CreatedAt   time.Time  `json:"createdAt"`
	CreatedBy   string     `json:"createdBy"`
	LastUsedAt  *time.Time `json:"lastUsedAt,omitempty"`
}

// ToStorage converts a Webhook to WebhookForStorage for persistence.
// NOTE: When adding new fields to Webhook or WebhookForStorage, ensure both
// ToStorage and ToWebhook are updated to maintain field synchronization.
func (w *Webhook) ToStorage() *WebhookForStorage {
	return &WebhookForStorage{
		ID:                    w.ID,
		DAGName:               w.DAGName,
		TokenHash:             w.TokenHash,
		TokenPrefix:           w.TokenPrefix,
		Enabled:               w.Enabled,
		AllowedProfiles:       append([]string(nil), w.AllowedProfiles...),
		ProfileTokens:         profileTokensToStorage(w.ProfileTokens),
		CreatedAt:             w.CreatedAt,
		UpdatedAt:             w.UpdatedAt,
		CreatedBy:             w.CreatedBy,
		LastUsedAt:            w.LastUsedAt,
		AuthMode:              w.AuthMode,
		HMACEnforcementMode:   w.HMACEnforcementMode,
		HMACSecretGeneratedAt: w.HMACSecretGeneratedAt,
	}
}

// ToWebhook converts WebhookForStorage back to Webhook.
// NOTE: When adding new fields to Webhook or WebhookForStorage, ensure both
// ToStorage and ToWebhook are updated to maintain field synchronization.
func (s *WebhookForStorage) ToWebhook() *Webhook {
	return &Webhook{
		ID:                    s.ID,
		DAGName:               s.DAGName,
		TokenHash:             s.TokenHash,
		TokenPrefix:           s.TokenPrefix,
		Enabled:               s.Enabled,
		AllowedProfiles:       append([]string(nil), s.AllowedProfiles...),
		ProfileTokens:         profileTokensFromStorage(s.ProfileTokens),
		CreatedAt:             s.CreatedAt,
		UpdatedAt:             s.UpdatedAt,
		CreatedBy:             s.CreatedBy,
		LastUsedAt:            s.LastUsedAt,
		AuthMode:              s.AuthMode,
		HMACEnforcementMode:   s.HMACEnforcementMode,
		HMACSecretGeneratedAt: s.HMACSecretGeneratedAt,
	}
}

func profileTokensToStorage(tokens []WebhookProfileToken) []WebhookProfileTokenForStorage {
	if len(tokens) == 0 {
		return nil
	}
	stored := make([]WebhookProfileTokenForStorage, len(tokens))
	for i, t := range tokens {
		stored[i] = WebhookProfileTokenForStorage(t)
	}
	return stored
}

func profileTokensFromStorage(stored []WebhookProfileTokenForStorage) []WebhookProfileToken {
	if len(stored) == 0 {
		return nil
	}
	tokens := make([]WebhookProfileToken, len(stored))
	for i, t := range stored {
		tokens[i] = WebhookProfileToken(t)
	}
	return tokens
}

func (w *Webhook) EffectiveAuthMode() WebhookAuthMode {
	if w == nil {
		return WebhookAuthModeTokenOnly
	}
	return w.AuthMode.OrDefault()
}

func (w *Webhook) HMACEnabled() bool {
	return w.EffectiveAuthMode() != WebhookAuthModeTokenOnly
}

func (w *Webhook) HMACSecretConfigured() bool {
	return w != nil && w.HMACSecret != ""
}

type webhookHMACDetails struct {
	Enabled          bool                       `json:"enabled"`
	EnforcementMode  WebhookHMACEnforcementMode `json:"enforcementMode,omitempty"`
	Algorithm        string                     `json:"algorithm,omitempty"`
	HeaderName       string               
```

### Core Architecture Module: `internal/cmd/dequeue.go`
```
// Copyright (C) 2026 Yota Hamada
// SPDX-License-Identifier: GPL-3.0-or-later

package cmd

import (
	"errors"
	"fmt"

	"github.com/dagucloud/dagu/v2/internal/cmn/logger"
	"github.com/dagucloud/dagu/v2/internal/cmn/logger/tag"
	"github.com/dagucloud/dagu/v2/internal/dagrun"
	"github.com/dagucloud/dagu/v2/internal/ir"
	"github.com/dagucloud/dagu/v2/internal/persis"
	"github.com/dagucloud/dagu/v2/internal/queue"
	"github.com/spf13/cobra"
)

func Dequeue() *cobra.Command {
	return NewCommand(
		&cobra.Command{
			Use:   "dequeue [flags] <queue-name>",
			Short: "Dequeue a DAG-run from the specified queue",
			Long: `Dequeue a DAG-run from the queue.

Example:
	dagu dequeue default --dag-run=dag_name:my_dag_run_id
	dagu dequeue default
`,
			Args: cobra.ExactArgs(1),
		}, dequeueFlags, runDequeue,
	)
}

var dequeueFlags = []commandLineFlag{paramsFlag, dagRunFlagDequeue}

func runDequeue(ctx *Context, args []string) error {
	if ctx.IsRemote() {
		return remoteRunDequeue(ctx, args)
	}
	requestedQueueName := args[0]

	// Get dag-run reference from the context
	dagRunRef, _ := ctx.StringParam("dag-run")
	if dagRunRef == "" {
		return dequeueFirst(ctx, requestedQueueName)
	}

	dagRun, err := ir.ParseDAGRunRef(dagRunRef)
	if err != nil {
		return fmt.Errorf("failed to parse dag-run reference %s: %w", dagRunRef, err)
	}
	return dequeueQueuedDAGRun(ctx, requestedQueueName, dagRun)
}

// dequeueFirst dequeues the first DAG run from the named queue and processes that run as aborted.
//
// It returns an error if queues are disabled, if removing an item from the queue fails,
// if the queue is empty, if retrieving the dequeued item's DAG-run data fails, or if
// processing the dequeued DAG run fails.
func dequeueFirst(ctx *Context, queueName string) error {
	// Check if queues are enabled
	if !ctx.Config.Queues.Enabled {
		return fmt.Errorf("queues are disabled in configuration")
	}
	for {
		result, err := ctx.Persistence.QueueStore.ListCursor(ctx.Context, queueName, "", 1)
		if err != nil {
			return fmt.Errorf("failed to list queue %s: %w", queueName, err)
		}
		if len(result.Items) == 0 {
			return fmt.Errorf("no dag-run found in queue %s", queueName)
		}

		item := result.Items[0]
		data, err := item.Data()
		if err != nil {
			if _, deleteErr := ctx.Persistence.QueueStore.DeleteByItemIDs(ctx.Context, queueName, []string{item.ID()}); deleteErr != nil {
				return fmt.Errorf("failed to discard unreadable queue head: %w", deleteErr)
			}
			continue
		}

		err = withQueueProcLock(ctx, queueName, func() error {
			if err := queue.AbortQueuedDAGRun(ctx.Context, ctx.Persistence.DAGRunRepository, *data); err != nil {
				return err
			}
			if _, err := ctx.Persistence.QueueStore.DeleteByItemIDs(ctx.Context, queueName, []string{item.ID()}); err != nil {
				return fmt.Errorf("failed to delete dequeued queue item: %w", err)
			}
			return nil
		})
		if err != nil {
			if isQueueAbortSkippable(err) {
				if _, deleteErr := ctx.Persistence.QueueStore.DeleteByItemIDs(ctx.Context, queueName, []string{item.ID()}); deleteErr != nil {
					return fmt.Errorf("failed to discard stale queue head: %w", deleteErr)
				}
				continue
			}
			return mapAbortQueuedDAGRunError(*data, err)
		}

		logger.Info(ctx.Context, "Dequeued dag-run",
			tag.DAG(data.Name),
			tag.RunID(data.ID),
			tag.Queue(queueName),
		)

		return nil
	}
}

// dequeueQueuedDAGRun aborts a queued dag-run and removes its queue entries.
func dequeueQueuedDAGRun(ctx *Context, requestedQueueName string, dagRun ir.DAGRunRef) error {
	// Check if queues are enabled
	if !ctx.Config.Queues.Enabled {
		return fmt.Errorf("queues are disabled in configuration")
	}

	actualQueueName, err := queueNameForDAGRun(ctx, dagRun)
	if err != nil {
		if isQueueLookupFallbackAllowed(err) {
			removed, fallbackErr := removeQueuedDAGRunByQueueName(ctx, requestedQueueName, dagRun)
			if fallbackErr != nil {
				return fallbackErr
			}
			if removed {
				logger.Info(ctx.Context, "Removed orphaned queued dag-run",
					tag.DAG(dagRun.Name),
					tag.RunID(dagRun.ID),
					tag.Queue(requestedQueueName),
				)
				return nil
			}
		}
		return mapAbortQueuedDAGRunError(dagRun, err)
	}

	err = withQueueProcLock(ctx, actualQueueName, func() error {
		if err := queue.AbortQueuedDAGRun(ctx.Context, ctx.Persistence.DAGRunRepository, dagRun); err != nil {
			return err
		}
		if _, err := ctx.Persistence.QueueStore.DequeueByDAGRunID(ctx.Context, actualQueueName, dagRun); err != nil {
			if errors.Is(err, queue.ErrQueueItemNotFound) && actualQueueName == requestedQueueName {
				return nil
			}
			return fmt.Errorf("failed to dequeue dag-run %s from queue %s: %w", dagRun.ID, actualQueueName, err)
		}
		return nil
	})
	if err != nil {
		return mapAbortQueuedDAGRunError(dagRun, err)
	}

	logger.Info(ctx.Context, "Dequeued dag-run",
		tag.DAG(dagRun.Name),
		tag.RunID(dagRun.ID),
		tag.Queue(actualQueueName),
	)

	return nil
}

func removeQueuedDAGRunByQueueName(ctx *Context, queueName string, dagRun ir.DAGRunRef) (bool, error) {
	var removed bool
	err := withQueueProcLock(ctx, queueName, func() error {
		items, err := ctx.Persistence.QueueStore.DequeueByDAGRunID(ctx.Context, queueName, dagRun)
		if err != nil {
			if errors.Is(err, queue.ErrQueueItemNotFound) {
				return nil
			}
			return fmt.Errorf("failed to dequeue dag-run %s from queue %s: %w", dagRun.ID, queueName, err)
		}
		removed = len(items) > 0
		return nil
	})
	if err != nil {
		return false, mapAbortQueuedDAGRunError(dagRun, err)
	}
	return removed, nil
}

func queueNameForDAGRun(ctx *Context, dagRun ir.DAGRunRef) (string, error) {
	attempt, err := ctx.Persistence.DAGRunRepository.FindAttempt(ctx, dagRun)
	if err != nil {
		return "", err
	}

	dag, err := attempt.ReadDAG(ctx)
	if err != nil {
		return "", fmt.Errorf("error reading DAG: %w", err)
	}

	return dag.ProcGroup(), nil
}

func withQueueProcLock(ctx *Context, queueName string, fn func() error) error {
	err := ctx.Persistence.ProcRepository.WithLock(ctx, queueName, fn)
	if persis.IsProcLockError(err) {
		return fmt.Errorf("failed to lock process group %s: %w", queueName, err)
	}
	return err
}

func mapAbortQueuedDAGRunError(dagRun ir.DAGRunRef, err error) error {
	if errors.Is(err, dagrun.ErrDAGRunIDNotFound) || errors.Is(err, dagrun.ErrNoStatusData) {
		return fmt.Errorf("failed to find the record for dag-run ID %s: %w", dagRun.ID, err)
	}

	if notQueuedErr, ok := errors.AsType[*queue.DAGRunNotQueuedError](err); ok {
		if notQueuedErr.HasStatus {
			return fmt.Errorf("dag-run %s is not in queued status but %s", dagRun.ID, notQueuedErr.Status)
		}
		return fmt.Errorf("dag-run %s is not in queued status", dagRun.ID)
	}

	return err
}

func isQueueAbortSkippable(err error) bool {
	if err == nil {
		return false
	}
	if errors.Is(err, dagrun.ErrDAGRunIDNotFound) || errors.Is(err, dagrun.ErrNoStatusData) || errors.Is(err, dagrun.ErrCorruptedStatusData) {
		return true
	}
	var notQueuedErr *queue.DAGRunNotQueuedError
	return errors.As(err, &notQueuedErr)
}

func isQueueLookupFallbackAllowed(err error) bool {
	return errors.Is(err, dagrun.ErrDAGRunIDNotFound) ||
		errors.Is(err, dagrun.ErrNoStatusData) ||
		errors.Is(err, dagrun.ErrCorruptedStatusData)
}

```

### Core Architecture Module: `internal/cmd/enqueue.go`
```
// Copyright (C) 2026 Yota Hamada
// SPDX-License-Identifier: GPL-3.0-or-later

package cmd

import (
	"fmt"
	"log/slog"

	"github.com/dagucloud/dagu/v2/internal/cmn/logger"
	"github.com/dagucloud/dagu/v2/internal/cmn/logger/tag"
	"github.com/dagucloud/dagu/v2/internal/intake"
	"github.com/dagucloud/dagu/v2/internal/ir"
	"github.com/spf13/cobra"
)

// Enqueue returns the cobra command for queueing a DAG-run.
func Enqueue() *cobra.Command {
	return NewCommand(
		&cobra.Command{
			Use:   "enqueue [flags] <DAG definition> [-- param1 param2 ...]",
			Short: "Enqueue a DAG-run to the queue.",
			Long: `Enqueue a DAG-run to the queue.

With --params-stdin, parameters can be provided on piped or redirected stdin
(e.g. 'echo "P1=foo" | dagu enqueue --params-stdin my_dag'). Input is read until
EOF, up to 1 MiB. Arguments after "--" and --params take precedence.
Quote individual stdin values to preserve spaces; "" supplies an empty value.
Empty or whitespace-only stdin uses DAG defaults.
Without --params-stdin, stdin is left unread.

Examples:
	echo '"hello world"' | dagu enqueue --params-stdin my_dag
	dagu enqueue --run-id=run_id my_dag -- P1=foo P2=bar
	dagu enqueue --name my_custom_name my_dag.yaml -- P1=foo P2=bar
`,
			Args: cobra.MinimumNArgs(1),
		}, enqueueFlags, runEnqueue,
	)
}

var enqueueFlags = []commandLineFlag{paramsFlag, paramsStdinFlag, nameFlag, dagRunIDFlag, queueFlag, labelsFlag, tagsFlag, defaultWorkingDirFlag, profileFlag, triggerTypeFlag, triggerActorFlag, scheduleTimeFlag, noReuseFlag}

func runEnqueue(ctx *Context, args []string) error {
	if ctx.IsRemote() {
		return remoteRunEnqueue(ctx, args)
	}
	runID, err := ctx.StringParam("run-id")
	if err != nil {
		return fmt.Errorf("failed to get Run ID: %w", err)
	}

	if runID == "" {
		runID, err = genRunID()
		if err != nil {
			return fmt.Errorf("failed to generate Run ID: %w", err)
		}
	} else if err := validateRunID(runID); err != nil {
		return fmt.Errorf("invalid Run ID: %w", err)
	}

	queueOverride, err := ctx.StringParam("queue")
	if err != nil {
		return fmt.Errorf("failed to get queue override: %w", err)
	}

	dag, _, err := loadDAGWithParams(ctx, args, false)
	if err != nil {
		return err
	}

	if queueOverride != "" {
		dag.Queue = queueOverride
	}

	if err := parseAndAppendLabels(ctx, dag); err != nil {
		return err
	}

	triggerType, err := parseTriggerTypeParam(ctx)
	if err != nil {
		return err
	}
	triggerActor, err := ctx.StringParam("trigger-actor")
	if err != nil {
		return fmt.Errorf("failed to get trigger actor: %w", err)
	}

	scheduleTime, err := parseScheduleTimeParam(ctx)
	if err != nil {
		return err
	}
	profileName, err := runtimeProfileNameParam(ctx)
	if err != nil {
		return err
	}
	noReuse, err := ctx.Command.Flags().GetBool("no-reuse")
	if err != nil {
		return fmt.Errorf("failed to read no-reuse: %w", err)
	}

	return enqueueDAGRun(ctx, dag, runID, runOptions{
		triggerType:  triggerType,
		triggerActor: triggerActor,
		scheduleTime: scheduleTime,
		profileName:  profileName,
		definitionID: dagDefinitionIDFromEnv(),
		noReuse:      noReuse,
	})
}

// enqueueDAGRun enqueues a dag-run to the queue.
// The DAG location is cleared to allow concurrent queued runs (location is used
// for unix pipe generation which would prevent parallel execution).
func enqueueDAGRun(ctx *Context, dag *ir.DAG, dagRunID string, opts runOptions) error {
	dag.Location = ""

	if !ctx.Config.Queues.Enabled {
		return fmt.Errorf("queues are disabled in configuration")
	}

	dagRun := ir.NewDAGRunRef(dag.Name, dagRunID)

	if _, err := ctx.Persistence.DAGRunRepository.FindAttempt(ctx, dagRun); err == nil {
		return fmt.Errorf("DAG %q with ID %q already exists", dag.Name, dagRunID)
	}

	queued, err := intake.EnqueueRun(ctx.Context, intake.QueueRequest{
		DAGRunRepository:        ctx.Persistence.DAGRunRepository,
		QueueStore:              ctx.Persistence.QueueStore,
		DAG:                     dag,
		DAGRunID:                dagRunID,
		LogBaseDir:              ctx.Config.Paths.LogDir,
		ArtifactBaseDir:         ctx.Config.Paths.ArtifactDir,
		TriggerType:             opts.triggerType,
		TriggerActor:            opts.triggerActor,
		ScheduleTime:            opts.scheduleTime,
		ProfileName:             opts.profileName,
		DefinitionID:            opts.definitionID,
		NoReuse:                 opts.noReuse,
		ProceedOnStatusCloseErr: true,
	})
	if err != nil {
		return err
	}
	if queued.StatusCloseErr != nil {
		logger.Warn(ctx.Context, "Failed to close queued status before enqueue",
			tag.Error(queued.StatusCloseErr))
	}

	logger.Info(ctx.Context, "Enqueued dag-run",
		tag.DAG(dag.Name),
		tag.RunID(dagRunID),
		slog.Any("params", dag.Params),
	)

	return nil
}

```

### Core Architecture Module: `internal/cmd/worker.go`
```
// Copyright (C) 2026 Yota Hamada
// SPDX-License-Identifier: GPL-3.0-or-later

package cmd

import (
	"fmt"
	"log/slog"
	"os"

	"github.com/dagucloud/dagu/v2/internal/cmn/logger"
	"github.com/dagucloud/dagu/v2/internal/cmn/logger/tag"
	"github.com/dagucloud/dagu/v2/internal/service/coordinator"
	"github.com/dagucloud/dagu/v2/internal/service/worker"
	"github.com/spf13/cobra"
)

func CmdWorker() *cobra.Command {
	return NewCommand(
		&cobra.Command{
			Use:   "worker [flags]",
			Short: "Start a worker that polls the coordinator for tasks",
			Long: `Launch a worker process that connects to the coordinator and polls for tasks.

The worker creates multiple concurrent pollers (goroutines) that continuously
poll the coordinator for tasks to execute. Each poller generates a unique
poller_id for every poll request.

By default, the worker ID is set to hostname@PID, but can be overridden.

Flags:
  --worker.id string                       Worker instance ID (default: hostname@PID)
  --worker.max-active-runs int             Maximum number of active runs (default: 100)
  --worker.health-port int                 Port number for the HTTP health check server (default: 8092, 0 disables)
  --worker.labels -l string                Worker labels for capability matching (format: key1=value1,key2=value2)
  --worker.coordinators string             Coordinator addresses (format: host1:port1,host2:port2)

TLS Configuration (uses global peer settings):
  --peer.insecure                          Use insecure connection (h2c) instead of TLS (default: true)
  --peer.cert-file string                  Path to TLS certificate file for mutual TLS
  --peer.key-file string                   Path to TLS key file for mutual TLS
  --peer.client-ca-file string             Path to CA certificate file for server verification
  --peer.skip-tls-verify                   Skip TLS certificate verification (insecure)

Example:
  dagu worker --worker.coordinators=coordinator-1:50055
  dagu worker --worker.coordinators=coordinator-1:50055 --worker.max-active-runs=50
  dagu worker --worker.coordinators=coordinator-1:50055 --worker.id=worker-1 --worker.max-active-runs=200
  dagu worker --worker.coordinators=coordinator-1:50055 --worker.health-port=0

  # Worker with labels for capability matching:
  dagu worker --worker.coordinators=coordinator-1:50055 --worker.labels gpu=true,memory=64G,region=us-east-1
  dagu worker --worker.coordinators=coordinator-1:50055 --worker.labels cpu-arch=amd64,instance-type=m5.xlarge

  # For TLS connections (when coordinator has TLS enabled):
  dagu worker --worker.coordinators=coordinator-1:50055 --peer.insecure=false --peer.cert-file=client.crt --peer.key-file=client.key
  dagu worker --worker.coordinators=coordinator-1:50055 --peer.insecure=false --peer.client-ca-file=ca.crt
  dagu worker --worker.coordinators=coordinator-1:50055 --peer.insecure=false --peer.skip-tls-verify  # For self-signed certificates

This process runs continuously in the foreground until terminated.
`,
		}, workerFlags, runWorker,
	)
}

var workerFlags = []commandLineFlag{
	workerIDFlag,
	workerMaxActiveRunsFlag,
	workerHealthPortFlag,
	workerLabelsFlag,
	workerCoordinatorsFlag,
	// Peer configuration flags for TLS
	peerInsecureFlag,
	peerCertFileFlag,
	peerKeyFileFlag,
	peerClientCAFileFlag,
	peerSkipTLSVerifyFlag,
}

func runWorker(ctx *Context, _ []string) error {
	workerID := ctx.Config.Worker.ID
	// Default to hostname@PID if not configured
	if workerID == "" {
		hostname, err := os.Hostname()
		if err != nil || hostname == "" {
			hostname = "unknown"
		}
		workerID = fmt.Sprintf("%s@%d", hostname, os.Getpid())
	}

	maxActiveRuns := ctx.Config.Worker.MaxActiveRuns
	labels := ctx.Config.Worker.Labels

	coordinatorCli, err := createCoordinatorClient(ctx)
	if err != nil {
		return err
	}

	w := worker.NewWorker(
		workerID,
		maxActiveRuns,
		coordinatorCli,
		labels,
		ctx.Config,
	)

	stores := ctx.runtimeStores()
	handlerCfg := worker.RemoteTaskHandlerConfig{
		WorkerID:          workerID,
		CoordinatorClient: coordinatorCli,
		PeerConfig:        ctx.Config.Core.Peer,
		Config:            ctx.Config,
		SecretStore:       stores.SecretStore,
		ProfileStore:      stores.ProfileStore,
	}
	w.SetHandler(worker.NewRemoteTaskHandler(handlerCfg))
	logger.Info(ctx, "Using remote task handler")

	logger.Info(ctx, "Starting worker", tag.WorkerID(workerID), tag.MaxConcurrency(maxActiveRuns), slog.Any("labels", labels))
	// Run status lives with the coordinator, so the worker closes waiting
	// browsers by deadline and owner liveness only.
	startBrowserReaper(ctx, ctx.Config.Paths.DataDir, nil)

	// Start the worker in a goroutine to allow for graceful shutdown
	errCh := make(chan error, 1)
	go func() {
		if err := w.Start(ctx); err != nil {
			errCh <- err
		}
	}()

	// Wait for either context cancellation or an error
	select {
	case <-ctx.Done():
		logger.Info(ctx, "Worker shutting down")
		if err := w.Stop(ctx); err != nil {
			return fmt.Errorf("failed to stop worker: %w", err)
		}
	case err := <-errCh:
		return fmt.Errorf("worker failed: %w", err)
	}

	return nil
}

// createCoordinatorClient creates the worker coordinator client.
func createCoordinatorClient(ctx *Context) (coordinator.Client, error) {
	return worker.NewCoordinatorClient(ctx.Context, ctx.Config)
}

```

### Core Architecture Module: `internal/cmd/worker_attempt.go`
```
// Copyright (C) 2026 Yota Hamada
// SPDX-License-Identifier: GPL-3.0-or-later

package cmd

import (
	"context"
	"fmt"

	"github.com/dagucloud/dagu/v2/internal/dagrun"
	"github.com/dagucloud/dagu/v2/internal/ir"
	"github.com/dagucloud/dagu/v2/internal/persis"
)

var attemptIDFlag = commandLineFlag{
	name:   "attempt-id",
	usage:  "[only for distributed worker execution] exact attempt ID",
	hidden: true,
}

func getAttemptID(ctx *Context) string {
	attemptID, err := ctx.StringParam("attempt-id")
	if err != nil {
		return ""
	}
	return attemptID
}

func requireWorkerAttemptID(ctx *Context, workerID string) (string, error) {
	attemptID := getAttemptID(ctx)
	if workerID == "local" {
		return attemptID, nil
	}
	if attemptID == "" {
		return "", fmt.Errorf("attempt-id is required for distributed worker execution")
	}
	return attemptID, nil
}

func resolveWorkerPreparedAttempt(
	ctx context.Context,
	dagRunRepository *persis.DAGRunRepository,
	dagName, dagRunID string,
	root ir.DAGRunRef,
	requestedAttemptID string,
) (dagrun.Attempt, *ir.DAGRunStatus, error) {
	attempt, runStatus, err := readLatestAttempt(ctx, dagRunRepository, dagName, dagRunID, root)
	if err != nil {
		return nil, nil, err
	}
	if err := validateWorkerAttemptBinding(dagRunID, requestedAttemptID, attempt, runStatus); err != nil {
		return nil, nil, err
	}
	return attempt, runStatus, nil
}

func agentAttemptID(requested string, prepared dagrun.Attempt) string {
	if requested != "" {
		return requested
	}
	if prepared != nil {
		return prepared.ID()
	}
	return ""
}

func readLatestAttempt(
	ctx context.Context,
	dagRunRepository *persis.DAGRunRepository,
	dagName, dagRunID string,
	root ir.DAGRunRef,
) (dagrun.Attempt, *ir.DAGRunStatus, error) {
	var (
		attempt dagrun.Attempt
		err     error
	)
	if root.ID != "" && root.ID != dagRunID {
		attempt, err = dagRunRepository.FindSubAttempt(ctx, root, dagRunID)
	} else {
		attempt, err = dagRunRepository.FindAttempt(ctx, ir.NewDAGRunRef(dagName, dagRunID))
	}
	if err != nil {
		return nil, nil, err
	}

	runStatus, err := attempt.ReadStatus(ctx)
	if err != nil {
		return nil, nil, err
	}
	return attempt, runStatus, nil
}

func validateWorkerAttemptBinding(
	dagRunID, requestedAttemptID string,
	attempt dagrun.Attempt,
	runStatus *ir.DAGRunStatus,
) error {
	currentAttemptID := requestedAttemptID
	if runStatus != nil && runStatus.AttemptID != "" {
		currentAttemptID = runStatus.AttemptID
	} else if attempt != nil && attempt.ID() != "" {
		currentAttemptID = attempt.ID()
	}

	if requestedAttemptID == "" {
		return fmt.Errorf("attempt-id is required for distributed worker execution")
	}
	if currentAttemptID != requestedAttemptID {
		return fmt.Errorf(
			"distributed worker attempt %q is stale for dag-run %s; latest attempt is %q",
			requestedAttemptID,
			dagRunID,
			currentAttemptID,
		)
	}
	return nil
}

```

### Core Architecture Module: `internal/cmn/cmdutil/cmd_unix.go`
```
// Copyright (C) 2026 Yota Hamada
// SPDX-License-Identifier: GPL-3.0-or-later

//go:build !windows

package cmdutil

import (
	"os/exec"
	"syscall"
)

// SetupCommand configures Unix-specific command attributes
func SetupCommand(cmd *exec.Cmd) {
	setupCommand(cmd)
}

// setupCommand configures Unix-specific command attributes
func setupCommand(cmd *exec.Cmd) {
	if cmd.SysProcAttr == nil {
		cmd.SysProcAttr = &syscall.SysProcAttr{}
	}
	cmd.SysProcAttr.Setpgid = true
	cmd.SysProcAttr.Pgid = 0
}

```

### Core Architecture Module: `internal/cmn/cmdutil/cmd_windows.go`
```
// Copyright (C) 2026 Yota Hamada
// SPDX-License-Identifier: GPL-3.0-or-later

//go:build windows

package cmdutil

import (
	"errors"
	"fmt"
	"os/exec"
	"syscall"
	"unsafe"

	"golang.org/x/sys/windows"
)

// SetupCommand configures Windows-specific command attributes
func SetupCommand(cmd *exec.Cmd) {
	setupCommand(cmd)
}

// setupCommand configures Windows-specific command attributes
func setupCommand(cmd *exec.Cmd) {
	if cmd.SysProcAttr == nil {
		cmd.SysProcAttr = &syscall.SysProcAttr{}
	}
	cmd.SysProcAttr.CreationFlags |= windows.CREATE_NEW_PROCESS_GROUP
}

// killProcessTree terminates pid and its descendant processes on Windows,
// children before parents. A process that cannot be terminated does not stop the
// rest of the tree from being killed; all such failures are returned together.
func killProcessTree(pid uint32) error {
	// Process ID 0 is the System Idle Process, which is its own parent.
	if pid == 0 {
		return nil
	}

	snapshot, err := windows.CreateToolhelp32Snapshot(windows.TH32CS_SNAPPROCESS, 0)
	if err != nil {
		return fmt.Errorf("CreateToolhelp32Snapshot failed: %w", err)
	}
	defer func() { _ = windows.CloseHandle(snapshot) }()

	var entry windows.ProcessEntry32
	entry.Size = uint32(unsafe.Sizeof(entry))

	// Find first process
	if err := windows.Process32First(snapshot, &entry); err != nil {
		return fmt.Errorf("Process32First failed: %w", err)
	}

	// Iterate all processes
	var errs []error
	for {
		if entry.ParentProcessID == pid && entry.ProcessID != pid {
			// Recursively kill children first
			if err := killProcessTree(entry.ProcessID); err != nil {
				errs = append(errs, err)
			}
		}

		if err := windows.Process32Next(snapshot, &entry); err != nil {
			break
		}
	}

	// Finally, kill this process
	if err := terminateProcess(pid); err != nil {
		errs = append(errs, err)
	}

	return errors.Join(errs...)
}

// terminateProcess force-terminates a single process. A process that has already
// exited is not an error.
func terminateProcess(pid uint32) error {
	h, err := windows.OpenProcess(windows.PROCESS_TERMINATE, false, pid)
	switch {
	case errors.Is(err, windows.ERROR_INVALID_PARAMETER):
		// The process exited and its kernel object is already gone.
		return nil
	case err != nil:
		return fmt.Errorf("open process %d: %w", pid, err)
	}
	defer func() { _ = windows.CloseHandle(h) }()

	// The handle carries PROCESS_TERMINATE, so ERROR_ACCESS_DENIED here means the
	// process exited while another open handle kept its kernel object alive.
	if err := windows.TerminateProcess(h, 1); err != nil && !errors.Is(err, windows.ERROR_ACCESS_DENIED) {
		return fmt.Errorf("terminate process %d: %w", pid, err)
	}
	return nil
}

```

### Core Architecture Module: `internal/cmn/cmdutil/cmdutil.go`
```
// Copyright (C) 2026 Yota Hamada
// SPDX-License-Identifier: GPL-3.0-or-later

package cmdutil

import (
	"bufio"
	"fmt"
	"io"
	"os"
	"os/exec"
	"regexp"
	"runtime"
	"strconv"
	"strings"
	"unicode"
)

// ArgsDelimiter is the delimiter used to separate command arguments
const ArgsDelimiter = "∯ᓰ♨"

// JoinCommandArgs joins a command and its arguments into a single string
// separated by ArgsDelimiter
func JoinCommandArgs(cmd string, args []string) string {
	return fmt.Sprintf("%s %s", cmd, strings.Join(args, ArgsDelimiter))
}

// SplitCommandArgs splits a command and its arguments into a command and a slice of arguments
func SplitCommandArgs(cmdWithArgs string) (string, []string) {
	parts := strings.SplitN(cmdWithArgs, " ", 2)
	if len(parts) == 1 {
		return parts[0], nil
	}
	command, args := parts[0], parts[1]
	// Handle empty args (e.g., "pwd " with trailing space)
	if args == "" {
		return command, nil
	}
	return command, strings.Split(args, ArgsDelimiter)
}

// GetShellCommand returns the shell to use for command execution
func GetShellCommand(configuredShell string) string {
	if configuredShell != "" {
		return configuredShell
	}

	// Check for global default shell via environment variable
	if defaultShell := os.Getenv("DAGU_DEFAULT_SHELL"); defaultShell != "" {
		return defaultShell
	}

	// Platform-specific default shell detection
	if runtime.GOOS == "windows" {
		return getWindowsDefaultShell()
	}

	// Unix-like systems: Try system shell first
	if systemShell := os.ExpandEnv("${SHELL}"); systemShell != "" {
		return systemShell
	}

	// Fallback to sh if available
	if shPath, err := exec.LookPath("sh"); err == nil {
		return shPath
	}

	return ""
}

// getWindowsDefaultShell returns the default shell for Windows systems
func getWindowsDefaultShell() string {
	// Try PowerShell Core (cross-platform PowerShell)
	if pwshPath, err := exec.LookPath("pwsh"); err == nil {
		return pwshPath
	}

	// Try Windows PowerShell
	if psPath, err := exec.LookPath("powershell"); err == nil {
		return psPath
	}

	// Fallback to cmd.exe
	if cmdPath, err := exec.LookPath("cmd"); err == nil {
		return cmdPath
	}

	// As a last resort, honor SHELL from Git Bash / MSYS / WSL environments.
	if systemShell := os.ExpandEnv("${SHELL}"); systemShell != "" {
		return systemShell
	}

	return ""
}

// SplitCommand splits a command string into a command and its arguments.
func SplitCommand(cmd string) (string, []string, error) {
	pipeline, err := ParsePipedCommand(cmd)
	if err != nil {
		return "", nil, err
	}

	if len(pipeline) > 1 {
		first := pipeline[0]
		cmd := first[0]
		args := first[1:]
		for _, command := range pipeline[1:] {
			args = append(args, "|")
			args = append(args, command...)
		}
		return cmd, args, nil
	}

	if len(pipeline) == 0 {
		return "", nil, ErrCommandIsEmpty
	}

	command := pipeline[0]
	if len(command) == 0 {
		return "", nil, ErrCommandIsEmpty
	}

	return command[0], command[1:], nil
}

var ErrCommandIsEmpty = fmt.Errorf("command is empty")

// unquoteToken removes surrounding quotes from a token if present
func unquoteToken(token string) string {
	if len(token) < 2 {
		return token
	}

	// Check for matching quotes at start and end
	if (token[0] == '"' && token[len(token)-1] == '"') ||
		(token[0] == '\'' && token[len(token)-1] == '\'') {
		// Try to unquote using strconv.Unquote for double quotes
		if token[0] == '"' {
			if unquoted, err := strconv.Unquote(token); err == nil {
				return unquoted
			}
		}
		// For single quotes, or if strconv.Unquote fails,
		// just remove the surrounding quotes
		return token[1 : len(token)-1]
	}

	// Don't unquote backticks - they're used for command substitution
	return token
}

// ParsePipedCommand splits a shell-style command string into a pipeline ([][]string).
// Each sub-slice represents a single command. Unquoted "|" tokens define the boundaries.
//
// Example:
//
//	parsePipedCommand(`echo foo | grep foo | wc -l`) =>
//	  [][]string{
//	    {"echo", "foo"},
//	    {"grep", "foo"},
//	    {"wc", "-l"},
//	  }
//
//	parsePipedCommand(`echo "hello|world"`) =>
//	  [][]string{ {"echo", "hello|world"} } // single command
func ParsePipedCommand(cmdString string) ([][]string, error) {
	var inQuote, inSingleQuote, inBacktick, inEscape bool
	var current []rune
	var tokens []string

	runes := []rune(cmdString)
	for i := 0; i < len(runes); i++ {
		r := runes[i]
		switch {
		case inEscape:
			current = append(current, r)
			inEscape = false
		case r == '\\':
			current = append(current, r)
			inEscape = true
		case r == '"' && !inBacktick && !inSingleQuote:
			current = append(current, r)
			inQuote = !inQuote
		case r == '\'' && !inBacktick && !inQuote:
			current = append(current, r)
			inSingleQuote = !inSingleQuote
		case r == '`' && !inSingleQuote:
			current = append(current, r)
			inBacktick = !inBacktick
		case r == '|' && !inQuote && !inSingleQuote && !inBacktick:
			// Check if this is part of || operator
			if i+1 < len(runes) && runes[i+1] == '|' {
				// This is ||, not a pipe
				if len(current) > 0 {
					tokens = append(tokens, string(current))
					current = nil
				}
				tokens = append(tokens, "||")
				i++ // Skip the next |
			} else {
				// This is a single pipe
				if len(current) > 0 {
					tokens = append(tokens, string(current))
					current = nil
				}
				tokens = append(tokens, "|")
			}
		case r == '&' && !inQuote && !inSingleQuote && !inBacktick:
			// Check if this is part of && operator
			if i+1 < len(runes) && runes[i+1] == '&' {
				// This is &&
				if len(current) > 0 {
					tokens = append(tokens, string(current))
					current = nil
				}
				tokens = append(tokens, "&&")
				i++ // Skip the next &
			} else {
				// Single & (background operator)
				current = append(current, r)
			}
		case unicode.IsSpace(r) && !inQuote && !inSingleQuote && !inBacktick:
			if len(current) > 0 {
				tokens = append(tokens, string(current))
				current = nil
			}
		default:
			current = append(current, r)
		}
	}

	if len(current) > 0 {
		tokens = append(tokens, string(current))
	}

	var pipeline [][]string
	var currentCmd []string

	for _, token := range tokens {
		if token == "|" {
			if len(currentCmd) > 0 {
				pipeline = append(pipeline, currentCmd)
				currentCmd = nil
			}
		} else {
			// Unquote the token if it's quoted
			unquoted := unquoteToken(token)
			currentCmd = append(currentCmd, unquoted)
		}
	}

	if len(currentCmd) > 0 {
		pipeline = append(pipeline, currentCmd)
	}

	return pipeline, nil
}

// GetScriptExtension returns the appropriate file extension for the given shell.
// This is needed because some shells (like PowerShell) require specific file extensions.
func GetScriptExtension(shellCommand string) string {
	if shellCommand == "" {
		return ""
	}

	cmdLower := strings.ToLower(shellCommand)

	switch {
	case strings.HasSuffix(cmdLower, "powershell.exe"),
		strings.HasSuffix(cmdLower, "powershell"),
		strings.HasSuffix(cmdLower, "pwsh.exe"),
		strings.HasSuffix(cmdLower, "pwsh"):
		return ".ps1"

	case strings.HasSuffix(cmdLower, "cmd.exe"),
		strings.HasSuffix(cmdLower, "cmd"):
		return ".bat"

	case strings.HasSuffix(cmdLower, "bash.exe"),
		strings.HasSuffix(cmdLower, "bash"),
		strings.HasSuffix(cmdLower, "zsh"),
		strings.HasSuffix(cmdLower, "/sh"),
		strings.HasSuffix(cmdLower, "sh.exe"):
		return ".sh"

	// Exact match for "sh" only
	case cmdLower == "sh":
		return ".sh"

	default:
		return ""
	}
}

// DetectShebang checks if the given script starts with a shebang (#!) line.
func DetectShebang(script string) (string, []string, error) {
	reader := strings.NewReader(script)
	// Read the first two bytes to check for shebang
	buf := make([]byte, 2)
	n, err := reader.Read(buf)
	if err != nil && err != io.EOF {
		return "", nil, fmt.Errorf("failed to read script for shebang: %w", err)
	}
	// Check for shebang prefix "#!"
	if n < 2 || string(buf[:n]) != "#!" {
		return "", nil, nil
	}

	// Read the first line
	scanner := bufio.NewScanner(reader)
	if !scanner.Scan() {
		if err := scanner.Err(); err != nil {
			return "", nil, fmt.Errorf("failed to read shebang line: %w", err)
		}
		return "", nil, nil
	}
	line := scanner.Text()

	// Split the shebang line into command and args
	return SplitCommand(strings.TrimSpace(line))
}

var reEscapedKeyValue = regexp.MustCompile(`^[^\s=]+="[^"]+"$`)

// BuildCommandEscapedString constructs a single shell-ready string from a command and its arguments.
// It assumes that the command and arguments are already escaped.
func BuildCommandEscapedString(command string, args []string) string {
	if len(args) == 0 {
		return command
	}

	quotedArgs := make([]string, 0, len(args))
	for _, arg := range args {
		quotedArgs = append(quotedArgs, quoteArgIfNeeded(arg))
	}

	return fmt.Sprintf("%s %s", command, strings.Join(quotedArgs, " "))
}

// quoteArgIfNeeded returns the argument quoted if it contains spaces and is not already quoted.
func quoteArgIfNeeded(arg string) string {
	// Empty string needs explicit quoting
	if arg == "" {
		return `""`
	}

	// Already quoted with double or single quotes
	if (strings.HasPrefix(arg, `"`) && strings.HasSuffix(arg, `"`)) ||
		(strings.HasPrefix(arg, `'`) && strings.HasSuffix(arg, `'`)) {
		return arg
	}

	// No whitespace means no quoting needed
	if strings.IndexFunc(arg, unicode.IsSpace) < 0 {
		return arg
	}

	// Already escaped key=value format
	if reEscapedKeyValue.MatchString(arg) {
		return arg
	}

	// Escape any existing double quotes and wrap in double quotes
	return fmt.Sprintf(`"%s"`, strings.ReplaceAll(arg, `"`, `\"`))
}

```

### Core Architecture Module: `internal/cmn/cmdutil/executable.go`
```
// Copyright (C) 2026 Yota Hamada
// SPDX-License-Identifier: GPL-3.0-or-later

package cmdutil

import (
	"errors"
	"os"
	"os/exec"
	"path/filepath"
	"runtime"
	"strings"
)

// LookupEnv returns the value of the first "key=value" entry in envs whose
// key matches key. The key comparison is case-insensitive on Windows.
func LookupEnv(envs []string, key string) (string, bool) {
	for _, entry := range envs {
		name, value, ok := strings.Cut(entry, "=")
		if !ok {
			continue
		}
		if runtime.GOOS == "windows" {
			if strings.EqualFold(name, key) {
				return value, true
			}
			continue
		}
		if name == key {
			return value, true
		}
	}
	return "", false
}

// isExecutableFile reports whether path names an existing regular file with
// executable permission. On Windows any existing regular file counts.
func isExecutableFile(path string) bool {
	info, err := os.Stat(path)
	if err != nil || info.IsDir() {
		return false
	}
	if runtime.GOOS == "windows" {
		return true
	}
	return info.Mode()&0o111 != 0
}

// IsExecutableFileInEnv reports whether path resolves to a file the process
// starter can launch under envs. Off Windows the file must exist and carry an
// executable bit. On Windows it follows the os/exec lookup rules: a name with
// an extension is tried as is, then each PATHEXT suffix is appended, and the
// first existing candidate must carry a PATHEXT extension — a match like
// tool.txt resolves at lookup but cannot launch. An extensionless name never
// matches as is, so tool resolves tool.cmd even when a file named tool exists.
func IsExecutableFileInEnv(path string, envs []string) bool {
	if runtime.GOOS != "windows" {
		return isExecutableFile(path)
	}
	pathextEnv, _ := LookupEnv(envs, "PATHEXT")
	for _, candidate := range pathCandidates(path, pathextEnv) {
		if isExecutableFile(candidate) {
			return pathextContains(pathextEnv, filepath.Ext(candidate))
		}
	}
	return false
}

// LookPathInEnv resolves name to an executable file using the PATH entry in
// envs, honoring PATHEXT on Windows. When envs carries no PATH entry it falls
// back to FindExecutable. Names containing a path separator are checked as
// file paths.
func LookPathInEnv(name string, envs []string) (string, error) {
	return LookPathInEnvDir(name, envs, "")
}

// LookPathInEnvDir is LookPathInEnv with relative names resolved against dir,
// matching how a process started in dir resolves them: relative PATH entries
// and relative path-form names anchor to dir instead of the process working
// directory. An empty dir keeps process working directory semantics.
func LookPathInEnvDir(name string, envs []string, dir string) (string, error) {
	if strings.ContainsAny(name, `/\`) {
		path := name
		if dir != "" && !filepath.IsAbs(path) {
			path = filepath.Join(dir, path)
		}
		if IsExecutableFileInEnv(path, envs) {
			return path, nil
		}
		return "", &exec.Error{Name: name, Err: exec.ErrNotFound}
	}
	if pathEnv, ok := LookupEnv(envs, "PATH"); ok {
		pathextEnv, _ := LookupEnv(envs, "PATHEXT")
		return lookPathInPATH(name, pathEnv, pathextEnv, dir)
	}
	if resolved, ok := FindExecutable(name); ok {
		return resolved, nil
	}
	return "", &exec.Error{Name: name, Err: exec.ErrNotFound}
}

func lookPathInPATH(command, pathEnv, pathextEnv, baseDir string) (string, error) {
	var lastErr error
	for _, dir := range filepath.SplitList(pathEnv) {
		if dir == "" {
			dir = "."
		}
		if baseDir != "" && !filepath.IsAbs(dir) {
			dir = filepath.Join(baseDir, dir)
		}
		for _, candidate := range pathCandidates(filepath.Join(dir, command), pathextEnv) {
			if isExecutableFile(candidate) {
				if runtime.GOOS == "windows" && !pathextContains(pathextEnv, filepath.Ext(candidate)) {
					// The starter resolves this candidate but cannot launch
					// it; later entries never get a chance.
					return "", &exec.Error{Name: command, Err: exec.ErrNotFound}
				}
				return candidate, nil
			}
			if _, err := os.Stat(candidate); err != nil && !errors.Is(err, os.ErrNotExist) {
				lastErr = err
			}
		}
	}
	if lastErr != nil {
		return "", lastErr
	}
	return "", &exec.Error{Name: command, Err: exec.ErrNotFound}
}

func pathCandidates(candidate, pathextEnv string) []string {
	if runtime.GOOS != "windows" {
		return []string{candidate}
	}

	exts := pathextList(pathextEnv)
	candidates := make([]string, 0, len(exts)+1)
	// A name with an extension resolves as is first; every name then tries
	// each PATHEXT suffix (e.g. tool.v2 resolves tool.v2.exe). Like os/exec,
	// an extensionless name is skipped as is: npm installs a POSIX shim named
	// tool next to tool.cmd.
	if filepath.Ext(candidate) != "" {
		candidates = append(candidates, candidate)
	}
	for _, ext := range exts {
		candidates = append(candidates, candidate+ext)
	}
	return candidates
}

// pathextList splits a PATHEXT value into normalized extensions, falling
// back to the Windows default when empty.
func pathextList(pathextEnv string) []string {
	pathext := pathextEnv
	if pathext == "" {
		pathext = ".COM;.EXE;.BAT;.CMD"
	}
	var exts []string
	for ext := range strings.SplitSeq(pathext, ";") {
		if ext == "" {
			continue
		}
		if ext[0] != '.' {
			ext = "." + ext
		}
		exts = append(exts, ext)
	}
	return exts
}

func pathextContains(pathextEnv, ext string) bool {
	if ext == "" {
		return false
	}
	for _, e := range pathextList(pathextEnv) {
		if strings.EqualFold(e, ext) {
			return true
		}
	}
	return false
}

// FindExecutable resolves cmd from PATH first, then falls back to common
// Windows compatibility locations for Git-provided Unix tooling.
func FindExecutable(cmd string) (string, bool) {
	if cmd == "" {
		return "", false
	}
	if path, err := exec.LookPath(cmd); err == nil {
		return path, true
	}
	if runtime.GOOS != "windows" {
		return "", false
	}
	if path := findWindowsCompatExecutable(cmd); path != "" {
		return path, true
	}
	return "", false
}

// ResolveExecutable returns the best-effort resolved executable path for cmd.
// If no compatibility path is found, the original value is returned unchanged.
func ResolveExecutable(cmd string) string {
	if runtime.GOOS != "windows" {
		return cmd
	}
	if path, ok := FindExecutable(cmd); ok {
		return path
	}
	return cmd
}

func findWindowsCompatExecutable(cmd string) string {
	name := strings.ToLower(filepath.Base(strings.ReplaceAll(cmd, "\\", "/")))
	name = strings.TrimSuffix(name, ".exe")

	var candidates []string
	switch name {
	case "bash":
		candidates = windowsGitCandidates("bash.exe")
	case "sh":
		candidates = windowsGitCandidates("sh.exe")
	case "env":
		candidates = windowsGitCandidates("env.exe")
	default:
		return ""
	}

	for _, candidate := range candidates {
		if stat, err := os.Stat(candidate); err == nil && !stat.IsDir() {
			return candidate
		}
	}
	return ""
}

func windowsGitCandidates(exe string) []string {
	var roots []string
	for _, env := range []string{"ProgramFiles", "ProgramFiles(x86)", "LocalAppData"} {
		if value := strings.TrimSpace(os.Getenv(env)); value != "" {
			roots = append(roots, value)
		}
	}

	var candidates []string
	for _, root := range roots {
		switch filepath.Base(root) {
		case "Programs":
			candidates = append(candidates,
				filepath.Join(root, "Git", "bin", exe),
				filepath.Join(root, "Git", "usr", "bin", exe),
			)
		default:
			candidates = append(candidates,
				filepath.Join(root, "Git", "bin", exe),
				filepath.Join(root, "Git", "usr", "bin", exe),
				filepath.Join(root, "Programs", "Git", "bin", exe),
				filepath.Join(root, "Programs", "Git", "usr", "bin", exe),
			)
		}
	}

	return candidates
}

```

### Core Architecture Module: `internal/cmn/cmdutil/lifecycle.go`
```
// Copyright (C) 2026 Yota Hamada
// SPDX-License-Identifier: GPL-3.0-or-later

package cmdutil

import (
	"errors"
	"fmt"
	"os/exec"
	"sync"
)

// ManagedProcess owns the lifecycle for one local OS process.
type ManagedProcess struct {
	mu sync.Mutex

	cmd       *exec.Cmd
	platform  managedPlatformProcess
	stopWatch func()

	releaseOnce sync.Once
	releaseErr  error
}

type managedPlatformProcess interface {
	prepare(*exec.Cmd) error
	afterStart(*exec.Cmd) error
	stop(*exec.Cmd, StopRequest) (StopOutcome, error)
	release() error
}

// NewManagedProcess wraps an already-created command for lifecycle operations.
func NewManagedProcess(cmd *exec.Cmd) *ManagedProcess {
	return &ManagedProcess{
		cmd:      cmd,
		platform: newManagedPlatformProcess(),
	}
}

// StartManagedProcess configures, starts, and contains cmd for lifecycle management.
func StartManagedProcess(cmd *exec.Cmd) (*ManagedProcess, error) {
	return startManagedProcess(cmd, newManagedPlatformProcess())
}

func startManagedProcess(cmd *exec.Cmd, platform managedPlatformProcess) (*ManagedProcess, error) {
	proc := &ManagedProcess{
		cmd:      cmd,
		platform: platform,
	}
	if cmd == nil {
		return proc, nil
	}

	SetupCommand(cmd)
	if err := proc.platform.prepare(cmd); err != nil {
		return nil, err
	}
	if err := cmd.Start(); err != nil {
		_ = proc.platform.release()
		return nil, err
	}
	if err := proc.platform.afterStart(cmd); err != nil {
		waitErr := stopAndWaitStartedCommand(cmd)
		releaseErr := proc.platform.release()
		return nil, fmt.Errorf("failed to contain process: %w", errors.Join(err, waitErr, releaseErr))
	}

	stopWatch, err := StartParentExitWatcher(cmd)
	if err != nil {
		_, _ = proc.Stop(StopRequest{Intent: ForceTermination(), Reason: StopReasonParentExit})
		_ = cmd.Wait()
		_ = proc.platform.release()
		return nil, fmt.Errorf("failed to start parent exit watcher: %w", err)
	}
	proc.stopWatch = stopWatch
	return proc, nil
}

// PID returns the root process ID, or zero when no process is attached.
func (p *ManagedProcess) PID() int {
	if p == nil || p.cmd == nil || p.cmd.Process == nil {
		return 0
	}
	return p.cmd.Process.Pid
}

// Command returns the wrapped command.
func (p *ManagedProcess) Command() *exec.Cmd {
	if p == nil {
		return nil
	}
	return p.cmd
}

// Wait waits for the root process to exit.
func (p *ManagedProcess) Wait() error {
	if p == nil || p.cmd == nil {
		return nil
	}
	return p.cmd.Wait()
}

// Stop requests that the platform adapter stop the process.
func (p *ManagedProcess) Stop(req StopRequest) (StopOutcome, error) {
	req = req.normalize()
	if p == nil || p.cmd == nil || p.cmd.Process == nil {
		return noopStopOutcome(req), nil
	}

	p.mu.Lock()
	defer p.mu.Unlock()
	return p.platform.stop(p.cmd, req)
}

// Release releases lifecycle resources. It is safe to call multiple times.
func (p *ManagedProcess) Release() error {
	if p == nil {
		return nil
	}
	p.releaseOnce.Do(func() {
		p.mu.Lock()
		defer p.mu.Unlock()

		if p.stopWatch != nil {
			p.stopWatch()
		}
		p.releaseErr = p.platform.release()
	})
	return p.releaseErr
}

func stopAndWaitStartedCommand(cmd *exec.Cmd) error {
	if cmd == nil || cmd.Process == nil {
		return nil
	}

	var errs []error
	if err := cmd.Process.Kill(); err != nil {
		errs = append(errs, fmt.Errorf("kill started process: %w", err))
	}
	if err := cmd.Wait(); err != nil {
		errs = append(errs, fmt.Errorf("wait for started process: %w", err))
	}
	return errors.Join(errs...)
}

```

### Core Architecture Module: `internal/cmn/cmdutil/lifecycle_unix.go`
```
// Copyright (C) 2026 Yota Hamada
// SPDX-License-Identifier: GPL-3.0-or-later

//go:build !windows

package cmdutil

import (
	"fmt"
	"os"
	"os/exec"
	"syscall"
)

type unixManagedProcess struct{}

func newManagedPlatformProcess() managedPlatformProcess {
	return unixManagedProcess{}
}

func (unixManagedProcess) prepare(*exec.Cmd) error {
	return nil
}

func (unixManagedProcess) afterStart(*exec.Cmd) error {
	return nil
}

func (unixManagedProcess) release() error {
	return nil
}

func (unixManagedProcess) stop(cmd *exec.Cmd, req StopRequest) (StopOutcome, error) {
	outcome := StopOutcome{
		RequestedMode: req.Intent.Mode,
		AppliedMode:   req.Intent.Mode,
		Mechanism:     StopMechanismProcessGroup,
		Contained:     true,
		Reason:        req.Reason,
	}
	if cmd == nil || cmd.Process == nil {
		outcome.Mechanism = StopMechanismNone
		return outcome, nil
	}
	if req.Intent.IsForce() {
		return outcome, syscall.Kill(-cmd.Process.Pid, syscall.SIGKILL)
	}
	sig := req.Intent.Signal
	if sig == nil {
		sig = syscall.SIGTERM
	}
	sysSig, ok := sig.(syscall.Signal)
	if !ok {
		return outcome, fmt.Errorf("unsupported process signal %T", sig)
	}
	return outcome, syscall.Kill(-cmd.Process.Pid, sysSig)
}

// TerminateProcessGroup stops the process group on Unix systems according to
// the requested lifecycle intent.
func TerminateProcessGroup(cmd *exec.Cmd, intent TerminationIntent) error {
	_, err := NewManagedProcess(cmd).Stop(StopRequest{Intent: intent})
	return err
}

// KillProcessGroup kills the process group on Unix systems.
//
// Deprecated: use TerminateProcessGroup with a TerminationIntent.
func KillProcessGroup(cmd *exec.Cmd, sig os.Signal) error {
	return TerminateProcessGroup(cmd, TerminationFromSignal(sig))
}

// TerminateMultipleProcessGroups stops multiple process groups on Unix systems.
func TerminateMultipleProcessGroups(cmds map[string]*exec.Cmd, intent TerminationIntent) error {
	var lastErr error
	for _, cmd := range cmds {
		if err := TerminateProcessGroup(cmd, intent); err != nil {
			lastErr = err
		}
	}
	return lastErr
}

// KillMultipleProcessGroups kills multiple processes on Unix systems.
//
// Deprecated: use TerminateMultipleProcessGroups with a TerminationIntent.
func KillMultipleProcessGroups(cmds map[string]*exec.Cmd, sig os.Signal) error {
	return TerminateMultipleProcessGroups(cmds, TerminationFromSignal(sig))
}

```


### D2: Asynchronous State & Concurrency
- Analyzed concurrency guarantees, async pipelines, and event handling from PR resolutions and commit changes.

### D3: Error Boundaries, Recovery & Rollbacks
- Exception handling patterns and defect resolutions extracted from closed production bug issues:
- **Issue #3021** (2026-10-06): **bug: [Windows] a multi-line step with Japanese on a later line fails to parse in PowerShell**
  *Symptoms*: On Windows, a multi-line step script that contains Japanese text on a line after the first one fails to parse: PowerShell receives the text re-decoded as code page 932, the string literal breaks, and the step fails before it runs. The same text on the first line, a shorter Japanese line, or the same commands joined on one line all run.  ## Environment  - Dagu 2.18.2 (windows/amd64) - Windows 11 Pro 26200, Japanese locale (ANSI code page 932) - Default shell (Windows PowerShell 5.1)  ## Reproduce  Each DAG file saved as UTF-8 without BOM and run with `dagu start <file>`:  ```yaml # fails steps:   - name: enter     run: |       sleep 2       echo "台帳に伝票を3件入力（未保存）" ```  ``` Result: Failed exit status 1 recent stderr (tail): At line 7 char:6 + echo "蜿ｰ蟶ｳ縺ｫ莨晉･ｨ繧・… ```  `蜿ｰ蟶ｳ縺ｫ莨晉･ｨ繧` is `台帳に伝票を` with its UTF-8 bytes read as code page 932, so the closing quote is no longer where PowerShell expects it.  Variations, same machine, same session:  | script | result | | --- | --- | | `sleep 2` ⏎ `echo "台帳に伝票を3件入力（未保存）"` | **fails** | | `sleep 2` ⏎ `echo "台帳に伝票を3件入力"` | **fails** | | `echo "first"` ⏎ `echo "台帳に伝票を3件入力（未保存）"` | **fails** | | `sleep 2` ⏎ `echo "一行目"` | runs | | `echo "一行目"` ⏎ `echo "二行目"` | runs | | `echo "台帳に伝票を3件入力"` ⏎ `echo "（未保存）"` | runs | | `sleep 2` ⏎ `echo "line two"` | runs | | `sleep 2; echo "台帳に伝票を3件入力（未保存）"` (one line) | runs |  So the single-line form is always fine, and a multi-line script breaks once a later line carries a longer run of non-ASCII — which looks

- **Issue #3017** (2026-10-05): **bug: [Windows] a shell parse error's stderr is recorded as U+FFFD, so the failure reason is unreadable**
  *Symptoms*: On Windows the default shell is run with a UTF-8 prologue (`$OutputEncoding = $utf8NoBom; …`) prepended to the step's command. When the command has a syntax error, PowerShell rejects the whole script before any of it runs, so the prologue never takes effect and the parse error is written to stderr in the console code page. The tail of that stderr is copied into the run's `error` field, where the bytes are not valid UTF-8 and are replaced with U+FFFD, so the recorded reason for the failure is unreadable.  ## Environment  - Dagu 2.18.2 (windows/amd64) - Windows 11 Pro 26200, Japanese locale (ANSI code page 932) - Default shell (PowerShell)  ## Reproduce  A step whose command is not valid PowerShell:  ```yaml steps:   - name: task     command: for i in 1 2 3; do echo "line $i"; done ```  ``` dagu start loop.yaml ```  ## Result  The step's `.err` file holds code page 932 bytes — `94 ad 90 b6 8f ea 8f 8a` is `発生場所`:  ``` 0000000 224 255 220 266 217 352 217 212     215   s   :   1     225 266 0000020 216 232   :   2   2   7  \r  \n   +       .   .   .       u   t ```  and `status.jsonl` records the tail with every one of those bytes replaced:  ``` "error":"exit status 1\nrecent stderr (tail):\n\ufffd\ufffd\ufffd\ufffd\ufffd\ufffd\ufffd s:1 \ufffd\ufffd\ufffd\ufffd:227\r\n+ ... utputEncoding = $utf8NoBom; …" ```  A step that fails at runtime rather than at parse time is fine: the prologue has run by then, its stderr is UTF-8, and the recorded error reads correctly.  ```yaml steps:  

- **Issue #3016** (2026-10-05): **bug: [Windows] step log read endpoint decodes UTF-8 output as the ANSI code page**
  *Symptoms*: On Windows, `GET /api/v1/dag-runs/{name}/{dagRunId}/steps/{step}/log` decodes the step's log file with the system ANSI code page instead of UTF-8. A step that prints non-ASCII text is stored correctly on disk and downloads correctly, but the read endpoint — the one the Web UI's log pane uses — returns mojibake, with bytes that do not map replaced by U+FFFD, so the text cannot be recovered.  ## Environment  - Dagu 2.18.2 (windows/amd64) - Windows 11 Pro 26200, Japanese locale (ANSI code page 932) - Default shell (PowerShell)  ## Reproduce  `ja.yaml`, saved as UTF-8:  ```yaml steps:   - name: task     command: Write-Output "日本語の出力テスト" ```  ``` dagu start ja.yaml dagu server --host 127.0.0.1 --port 19799 ```  Then read the step log two ways:  ``` GET /api/v1/dag-runs/ja/<dagRunId>/steps/task/log?stream=stdout&tail=100 GET /api/v1/dag-runs/ja/<dagRunId>/steps/task/log/download?stream=stdout ```  ## Result  The file on disk is correct UTF-8:  ``` $ od -c task.<...>.out 0000000 346 227 245 346 234 254 350 252 236 343 201 256 345 207 272 345 0000020 212 233 343 203 206 343 202 271 343 203 210  \r  \n ```  `…/log/download` returns those same bytes, which decode to `日本語の出力テスト`:  ``` e6 97 a5 e6 9c ac e8 aa 9e e3 81 ae e5 87 ba e5 8a 9b e3 83 86 e3 82 b9 e3 83 88 0d 0a ```  `…/log` returns the same text re-encoded from code page 932:  ```json {"content":"譌･譛ｬ隱槭�蜃ｺ蜉帙ユ繧ｹ繝�","lineCount":1,"totalLines":1} ```  ``` e8 ad 8c ef bd a5 e8 ad 9b ef bd ac e9 9a b1 e6 a7 ad ef bf bd e8 9c 83 … ``

- **Issue #2968** (2026-10-03): **bug: inaccurate help and schema text for browser and computer steps**
  *Symptoms*: ## Describe the bug  Three pieces of help and editor-schema text don't match runtime behavior.  1. **`dagu rm --help`** (`internal/cmd/rm.go:32-33`) says deleting all history clears "the replay cache of the DAG's browser steps". It clears the computer step cache too (`replayCaches` in `internal/cmd/replay_cache.go:22`). 2. **`browser.allowed_domains`** schema description (`internal/cmn/schema/dag.schema.json:7402`): "Domains the browser may navigate to". The browser runtime applies the list to every HTTP(S) request the page makes, including scripts, images and API calls, so a site's CDN and sign-in hosts must be listed. The current wording leads users to list only the page host. Requests to the other hosts are then blocked and the page breaks. 3. **Per-operation `act.cache`** schema description (`dag.schema.json:7501` and `:7731`): "Defaults to with.cache." This suggests `act: {cache: true}` can turn caching back on under `with.cache: false`. It can't: `useCache := r.cache != nil && (spec.Cache == nil || *spec.Cache)` (`browser/ops.go:454`, `computer/act.go:45`). The operation flag can only disable caching.  ## Expected behavior  The help and schema descriptions match the runtime, for example:  1. "...also clears the replay caches of the DAG's browser and computer steps on this host." 2. "Hosts the page's HTTP(S) requests may reach, such as example.com or *.example.com. List the CDN and sign-in hosts the site loads from." 3. "Set false to not replay this operation. Has no eff

- **Issue #2967** (2026-10-02): **bug: dagu cleanup does not clear browser and computer replay caches**
  *Symptoms*: ## Describe the bug  `dagu cleanup` is a compatibility alias for `dagu rm --history`. With the default `--retention-days 0`, it deletes all history but leaves the DAG's browser and computer replay caches in place. `dagu rm --history` clears them.  `runCleanup` always passes a non-nil `retentionDays` (`internal/cmd/cleanup.go:76`). `removesReplayCaches` only returns true when `retentionDays == nil` (`internal/cmd/rm.go:246`). So the cache-clearing branch never runs for `cleanup`, and `cleanup --dry-run` never lists the caches.  ## To Reproduce  1. Run a DAG with a successful `browser.run` or `computer.run` step that has an `act`, so a replay recording is stored. 2. Run `dagu cleanup <dag>`. 3. Run the DAG again.  ## Expected behavior  Deleting all history with `--retention-days 0` also clears the replay caches, as `dagu rm --history` does.  ## Actual behavior  The caches remain. The next run replays the recorded acts.  ## Environment  - Dagu version: v2.18.1, and `main` at the time of writing  ## Additional context  The docs used to say that `cleanup` clears the caches. They now state the current behavior: https://github.com/dagucloud/docs/blob/main/getting-started/cli.md. Update that line if this is fixed.  A possible fix: treat `retentionDays == 0` like `nil` in `removesReplayCaches`, or have `runCleanup` pass `nil` when the value is 0. 

- **Issue #2956** (2026-10-01): **bug: standalone coordinator skips graceful shutdown on SIGTERM**
  *Symptoms*: ## Describe the bug  Standalone `dagu coordinator` exits immediately on SIGINT/SIGTERM without running its shutdown sequence. Workers fail over to other coordinators only after RPC errors, and in-flight RPCs such as status reports are cut off.  `runCoordinator` waits on `<-coordCtx.Done()` before calling `svc.Stop` (https://github.com/dagucloud/dagu/blob/c168a1471fa189ad21aa9751ecfe559815e3691b/internal/cmd/coord.go#L111). The CLI context comes from `rootCmd.Execute()` and is never canceled by a signal, and no signal handler is installed. The Go runtime default therefore terminates the process. `dagu start-all` is not affected because it handles SIGINT/SIGTERM and stops its in-process coordinator.  ## To Reproduce  ```sh dagu coordinator --coordinator.port 50991 & pid=$! sleep 3 kill -TERM $pid wait $pid; echo "exit=$?" ```  ## Expected behavior  On SIGINT/SIGTERM, the coordinator runs `Service.Stop` (https://github.com/dagucloud/dagu/blob/c168a1471fa189ad21aa9751ecfe559815e3691b/internal/service/coordinator/service.go#L171) so connected workers move to another live coordinator:  1. Report `NOT_SERVING`. Workers health-check each coordinator before calls (`attemptCall`, `callOwner` in `internal/service/coordinator/client.go`) and skip it immediately. 2. Unregister from the service registry. 3. Drain in-flight RPCs with `GracefulStop`, bounded by the existing 2-second drain. 4. Stop the zombie detector and close handler resources.  A second signal may force exit.  ## Actual be
  **Post-Mortem & Fix Analysis**:
  > I reproduced this on main and have a small coordinator-only fix with a regression test for SIGINT and SIGTERM. Are you already working on this alongside #2957, or would you welcome a PR for #2956? I'll wait for your reply before opening one. 
  > @ReguiguiMohamed I'd be happy to review the PR. Please go ahead. Thanks for taking this up.

- **Issue #2951** (2026-09-30): **bug: workflow with unmet precondition gets status aborted when it should be skipped**
  *Symptoms*: ## Describe the bug  Workflow with unmet precondition at workflow level gets state `aborted` while it should be `skipped`  <img width="334" height="119" alt="Image" src="https://github.com/user-attachments/assets/0fd5c983-08c6-41ee-a791-67c8ac2a1752" />  `aborted` is a bit of a questionable state, since `continue_on` doesn't have an option for it and from testing  it shows that both `continue_on: skipped` and `continue_on: failed` when calling the workflow as sub-DAG both work in that case.  ## To Reproduce  Steps to reproduce the behavior:  1. Create a DAG with: ``` preconditions:   - condition: "$(date +%u)"     expected: "re:[8]" # Won't ever be met  steps:   - run: echo "Hi there!"  ``` 3. Run the workflow' 4. Look at the status  ## Expected behavior  Since precondition is unmet, it should just get state `skipped`  ## Actual behavior  Unmet precondition sets the state of the workflow as `aborted`  ## Environment  - Dagu version: 2.18.1 - OS: Ubuntu 26.04 / K8s - Go version: N/A - Installation method: Dagu Helm chart, with 5 workers  ## DAG configuration  N/A  ## Screenshots  See above  ## Additional context  Add any other context about the problem here. 
  **Post-Mortem & Fix Analysis**:
  > Thanks for the report. The current behaviour matches the spec, so this isn't a bug, but the request makes sense. The status change is tracked in #2952, so this one is closed in favour of it.  **Current behaviour** ([Spec 023, DAG-Level Status Effects](https://github.com/dagucloud/dagu/blob/main/specs/023-preconditions.md#dag-level-status-effects))  - An unmet DAG-level precondition ends the run as `aborted`. An error while evaluating the precondition ends the run as `failed`. - When the DAG is called from a `dag.run` step, the child stays `aborted` and the calling step becomes `skipped`. The calling step then follows the normal rules for skipped steps, so `continue_on: skipped` is the setting that lets the next steps run.  **About `continue_on: failed`**  The calling step is `skipped`, not `failed`, so `continue_on: failed` doesn't apply to it. The parent run doesn't fail with either setting, which is why both look like they work. The difference shows up downstream: with only `continue

- **Issue #2944** (2026-09-29): **bug: step with id and name shows as id in graph**
  *Symptoms*: ## Describe the bug  Steps which have an `id` as well as `name` defined are shown in the graphical graph display with the `id`. Not sure if this is intended behaviour if I look at [feat: add optional step ID field- #1012 ](https://github.com/dagucloud/dagu/pull/1012) screenshot examples.  ## To Reproduce  Steps to reproduce the behavior:  1. Create a DAG with: ``` steps:   - name: Get Date     id: date     command: date +%Y-%m-%d      - name: Use Date       command: echo "Today is ${date.stdout}"     depends: date    - name: Exit Code     command: echo "Exit Code was ${date.exitCode}"     depends: date ``` 3. Once workflow saved, look at the produced graph  <img width="891" height="1026" alt="Image" src="https://github.com/user-attachments/assets/d27106de-77ce-4da1-b281-f0f71437d590" />  ## Expected behavior  Graph shows the `name` when step has both `id` and `name` properties  ## Actual behavior  Graph shows the `id` value for the step. Not nice 👎   ## Environment  - Dagu version: 2.17.2 - OS: Ubuntu 26.04 - Go version: N/A - Installation method: Dagu helm chart, 5 workers  ## DAG configuration  N/A  ## Screenshots  See reproduce steps.  ## Additional context  

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

### Incident Patch 1: `4524f59f` (2026-10-06)
**Commit Message**: fix(runtime): write PowerShell scripts with a UTF-8 BOM (#3022)

**File**: `conformance/spec015_step_run_script/step_run_script_test.go` (modified, +55/-0)
```diff
@@ -4,9 +4,12 @@
 package spec015_step_run_script_test
 
 import (
+	"context"
+	"os/exec"
 	"path/filepath"
 	"runtime"
 	"testing"
+	"time"
 
 	"github.com/dagucloud/dagu/v2/conformance/harness"
 )
@@ -178,3 +181,55 @@ func TestScriptDiagnosticsDoNotDumpResolvedScript(t *testing.T) {
 		"dagu_script-",
 	)
 }
+
+// TestScriptFormPowerShellWhenAvailable runs a multi-line script whose
+// non-ASCII text sits on a later line. Windows PowerShell decodes a script
+// file with the ANSI code page unless it carries a UTF-8 byte order mark, so
+// the text must survive the trip through the prepared script input.
+func TestScriptFormPowerShellWhenAvailable(t *testing.T) {
+	cases := []struct {
+		name   string
+		shell  string
+		file   string
+		output string
+	}{
+		{
+			name:   "pwsh keeps UTF-8 on a later script line",
+			shell:  "pwsh",
+			file:   "powershell_utf8_multiline.yaml",
+			output: "pwsh-utf8-multiline.txt",
+		},
+		{
+			name:   "Windows PowerShell keeps UTF-8 on a later script line",
+			shell:  "powershell",
+			file:   "powershell_utf8_multiline_windows.yaml",
+			output: "powershell-utf8-multiline.txt",
+		},
+	}
+
+	for _, tc := range cases {
+		t.Run(tc.name, func(t *testing.T) {
+			shell, err := exec.LookPath(tc.shell)
+			if err != nil {
+				t.Skipf("%s is not available", tc.shell)
+			}
+
+			// A cold PowerShell launch pays .NET start-up and module import,
+			// which on a loaded runner has exceeded the command budget. One
+			// warm-up launch absorbs that cost and sizes the timed run.
+			ctx, cancel := context.WithTimeout(context.Background(), 3*harness.WaitTimeout(t))
+			defer cancel()
+			started := time.Now()
+			if out, err := exec.CommandContext(ctx, shell, "-NoProfile", "-NonInteractive", "-Command", "exit").CombinedOutput(); err != nil {
+				t.Fatalf("%s warm-up failed after %s: %v\n%s", tc.shell, time.Since(started).Round(time.Second), err, out)
+			}
+			wait := harness.WaitTimeout(t)
+			budget := min(wait+2*time.Since(started), 4*wait)
+
+			dagu := harness.NewRunner(t).WithCommandTimeout(budget)
+			result := dagu.Run("start", tc.file)
+			result.ExpectExitCode(0)
+			dagu.ExpectFileContent(tc.output, "台帳に伝票を3件入力（未保存）")
+		})
+	}
+}
```

**File**: `conformance/spec015_step_run_script/testdata/powershell_utf8_multiline.yaml` (added, +9/-0)
```diff
@@ -0,0 +1,9 @@
+working_dir: .
+steps:
+  - id: pwsh_utf8_multiline
+    run: |
+      Write-Output "first"
+      $text = '台帳に伝票を3件入力（未保存）'
+      [System.IO.File]::WriteAllText((Join-Path (Get-Location) 'pwsh-utf8-multiline.txt'), $text, (New-Object System.Text.UTF8Encoding $false))
+    with:
+      shell: pwsh
```

**File**: `conformance/spec015_step_run_script/testdata/powershell_utf8_multiline_windows.yaml` (added, +9/-0)
```diff
@@ -0,0 +1,9 @@
+working_dir: .
+steps:
+  - id: powershell_utf8_multiline
+    run: |
+      Write-Output "first"
+      $text = '台帳に伝票を3件入力（未保存）'
+      [System.IO.File]::WriteAllText((Join-Path (Get-Location) 'powershell-utf8-multiline.txt'), $text, (New-Object System.Text.UTF8Encoding $false))
+    with:
+      shell: powershell
```

**File**: `internal/runtime/builtin/command/command_script.go` (modified, +12/-4)
```diff
@@ -97,6 +97,11 @@ func createScriptTempFallback(workDir, pattern string, systemTempErr error) (*os
 	return file, nil
 }
 
+// utf8BOM is the UTF-8 byte order mark. Windows PowerShell decodes a script file
+// without one using the ANSI code page, which corrupts non-ASCII script text
+// before the UTF-8 preamble below can run.
+const utf8BOM = "\xEF\xBB\xBF"
+
 func hasShebang(script string) bool {
 	return strings.HasPrefix(script, "#!")
 }
@@ -136,13 +141,16 @@ func scriptLineOffset(scriptFile string) int {
 }
 
 // preprocessScript returns the script content adjusted for the shell indicated by ext.
-// For ".ps1" it prepends PowerShell directives that make cmdlet errors stop
-// execution and normalize UTF-8 console/pipeline encoding; for other extensions
-// it returns the original script.
+// For ".ps1" it prefixes a UTF-8 byte order mark so Windows PowerShell reads the
+// file as UTF-8 regardless of the console code page, then prepends PowerShell
+// directives that make cmdlet errors stop execution and normalize UTF-8
+// console/pipeline encoding; for other extensions it returns the original script.
 func preprocessScript(script, ext string) string {
 	switch ext {
 	case ".ps1":
-		return powerShellPreamble() + "\n" + script
+		// The BOM precedes the preamble so scriptLineOffset still counts only
+		// the prepended statements. pwsh accepts the BOM as well.
+		return utf8BOM + powerShellPreamble() + "\n" + script
 	default:
 		return script
 	}
```

**File**: `internal/runtime/builtin/command/command_test.go` (modified, +34/-0)
```diff
@@ -1407,6 +1407,40 @@ func TestSetupScript(t *testing.T) {
 	}
 }
 
+// TestSetupScriptPowerShellBOM checks that a PowerShell script file starts
+// with a UTF-8 byte order mark, so Windows PowerShell decodes it as UTF-8
+// rather than the ANSI code page, while other script kinds stay unchanged.
+func TestSetupScriptPowerShellBOM(t *testing.T) {
+	tmpDir := t.TempDir()
+	const bom = "\xEF\xBB\xBF"
+	const script = "Write-Output 'first'\nWrite-Output '台帳に伝票を3件入力（未保存）'"
+
+	t.Run("powershell script carries BOM", func(t *testing.T) {
+		for _, shell := range []string{"powershell", "pwsh", "powershell.exe"} {
+			scriptFile, err := setupScript(tmpDir, script, "", []string{shell})
+			require.NoError(t, err)
+			defer func() { _ = os.Remove(scriptFile) }()
+
+			assert.True(t, strings.HasSuffix(scriptFile, ".ps1"), "shell %s: expected .ps1, got %s", shell, scriptFile)
+			content, err := os.ReadFile(scriptFile)
+			require.NoError(t, err)
+			assert.Equal(t, bom+powerShellPreamble()+"\n"+script, string(content), "shell %s", shell)
+		}
+	})
+
+	t.Run("other scripts carry no BOM", func(t *testing.T) {
+		for _, shell := range []string{"cmd", "/bin/sh", "/usr/bin/python"} {
+			scriptFile, err := setupScript(tmpDir, script, "", []string{shell})
+			require.NoError(t, err)
+			defer func() { _ = os.Remove(scriptFile) }()
+
+			content, err := os.ReadFile(scriptFile)
+			require.NoError(t, err)
+			assert.Equal(t, script, string(content), "shell %s", shell)
+		}
+	})
+}
+
 // TestValidateCommandStep tests step validation
 func TestValidateCommandStep(t *testing.T) {
 	tests := []struct {
```

**File**: `specs/015-step-run-script.md` (modified, +5/-0)
```diff
@@ -278,6 +278,11 @@ argument behavior, secrecy, and failure behavior.
 - PowerShell script execution normalizes PowerShell error handling and UTF-8
   text encoding before user script code starts.
 
+- PowerShell script input is written as UTF-8 with a byte order mark, so
+  Windows PowerShell decodes the script text as UTF-8 regardless of the console
+  code page and a multi-line script runs the same whatever characters its lines
+  hold.
+
 - Under PowerShell normalization, a PowerShell error written by `Write-Error`
   fails the step unless the script handles the error.
 
```

---

### Incident Patch 2: `02a0bb12` (2026-10-05)
**Commit Message**: fix(runtime): decode a non-UTF-8 stderr tail with the console code page (#3019)

**File**: `internal/runtime/builtin/harness/harness_test.go` (modified, +26/-0)
```diff
@@ -376,6 +376,32 @@ func TestHarnessStopContinuesAfterManagedAbort(t *testing.T) {
 	assert.True(t, fallbackStopped)
 }
 
+// Closing the idle connections of http.DefaultTransport, as
+// httptest.Server.Close does, can fail a request that is in flight on it. The
+// OpenCode connection must survive such a reset. Not parallel: it resets the
+// shared default transport.
+func TestOpenCodeConnSurvivesTransportReset(t *testing.T) {
+	var mu sync.Mutex
+	var remoteAddrs []string
+	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
+		mu.Lock()
+		remoteAddrs = append(remoteAddrs, r.RemoteAddr)
+		mu.Unlock()
+		w.WriteHeader(http.StatusNoContent)
+	}))
+	t.Cleanup(server.Close)
+	host := opencodehost.Config{URL: server.URL, Password: "secret", InstanceID: "host-1"}
+
+	require.NoError(t, abortManagedOpenCode(t.Context(), host, "session-1", ""))
+	http.DefaultTransport.(*http.Transport).CloseIdleConnections()
+	require.NoError(t, abortManagedOpenCode(t.Context(), host, "session-1", ""))
+
+	mu.Lock()
+	defer mu.Unlock()
+	require.Len(t, remoteAddrs, 2)
+	assert.Equal(t, remoteAddrs[0], remoteAddrs[1])
+}
+
 func TestManagedOpenCodeCleanRestartCreatesNewSession(t *testing.T) {
 	t.Parallel()
 
```

**File**: `internal/runtime/builtin/harness/opencode_client.go` (modified, +17/-1)
```diff
@@ -25,6 +25,22 @@ type openCodeClient struct {
 	http      *http.Client
 }
 
+// openCodeTransport is shared by OpenCode clients and kept apart from
+// http.DefaultTransport: closing the default transport's idle connections,
+// as httptest.Server.Close does, can fail a request that is in flight on it.
+var openCodeTransport = newOpenCodeTransport()
+
+func newOpenCodeTransport() http.RoundTripper {
+	if base, ok := http.DefaultTransport.(*http.Transport); ok {
+		return base.Clone()
+	}
+	return http.DefaultTransport
+}
+
+func newOpenCodeHTTPClient(timeout time.Duration) *http.Client {
+	return &http.Client{Transport: openCodeTransport, Timeout: timeout}
+}
+
 type openCodeSession struct {
 	ID        string `json:"id"`
 	Directory string `json:"directory"`
@@ -247,7 +263,7 @@ func (c *openCodeClient) abort(ctx context.Context, sessionID string) error {
 func abortManagedOpenCode(ctx context.Context, host opencodehost.Config, sessionID, directory string) error {
 	ctx, cancel := context.WithTimeout(ctx, 3*time.Second)
 	defer cancel()
-	client := &openCodeClient{host: host, directory: directory, http: &http.Client{Timeout: 3 * time.Second}}
+	client := &openCodeClient{host: host, directory: directory, http: newOpenCodeHTTPClient(3 * time.Second)}
 	return client.abort(ctx, sessionID)
 }
 
```

**File**: `internal/runtime/builtin/harness/opencode_managed.go` (modified, +1/-1)
```diff
@@ -37,7 +37,7 @@ func (e *harnessExecutor) runManagedOpenCode(
 	cfg providerConfig,
 	host opencodehost.Config,
 ) (*os.File, error) {
-	client := &openCodeClient{host: host, directory: e.workDir, http: &http.Client{Timeout: 30 * time.Second}}
+	client := &openCodeClient{host: host, directory: e.workDir, http: newOpenCodeHTTPClient(30 * time.Second)}
 	e.mu.Lock()
 	e.managedHost = host
 	e.hasDeterminedStatus = false
```

**File**: `internal/runtime/executor/console.go` (added, +37/-0)
```diff
@@ -0,0 +1,37 @@
+// Copyright (C) 2026 Yota Hamada
+// SPDX-License-Identifier: GPL-3.0-or-later
+
+package executor
+
+import (
+	"fmt"
+
+	"golang.org/x/text/encoding"
+	"golang.org/x/text/encoding/ianaindex"
+	"golang.org/x/text/encoding/japanese"
+	"golang.org/x/text/encoding/korean"
+	"golang.org/x/text/encoding/simplifiedchinese"
+	"golang.org/x/text/encoding/traditionalchinese"
+)
+
+// encodingForCodePage returns the encoding of a Windows code page, or nil
+// when the code page is UTF-8 or unknown.
+func encodingForCodePage(codePage uint32) encoding.Encoding {
+	switch codePage {
+	case 932:
+		return japanese.ShiftJIS
+	case 936:
+		return simplifiedchinese.GBK
+	case 949:
+		return korean.EUCKR
+	case 950:
+		return traditionalchinese.Big5
+	}
+	// ANSI code pages are registered as "windows-<n>", OEM ones as "ibm<n>".
+	for _, name := range []string{fmt.Sprintf("windows-%d", codePage), fmt.Sprintf("ibm%d", codePage)} {
+		if enc, err := ianaindex.IANA.Encoding(name); err == nil && enc != nil {
+			return enc
+		}
+	}
+	return nil
+}
```

**File**: `internal/runtime/executor/console_other.go` (added, +14/-0)
```diff
@@ -0,0 +1,14 @@
+// Copyright (C) 2026 Yota Hamada
+// SPDX-License-Identifier: GPL-3.0-or-later
+
+//go:build !windows
+
+package executor
+
+import "golang.org/x/text/encoding"
+
+// consoleEncoding returns nil: child processes have no console code page
+// outside Windows.
+func consoleEncoding() encoding.Encoding {
+	return nil
+}
```

**File**: `internal/runtime/executor/console_test.go` (added, +57/-0)
```diff
@@ -0,0 +1,57 @@
+// Copyright (C) 2026 Yota Hamada
+// SPDX-License-Identifier: GPL-3.0-or-later
+
+package executor
+
+import (
+	"testing"
+
+	"github.com/stretchr/testify/assert"
+	"github.com/stretchr/testify/require"
+)
+
+func TestEncodingForCodePage(t *testing.T) {
+	t.Parallel()
+
+	tests := []struct {
+		name     string
+		codePage uint32
+		input    []byte
+		want     string
+	}{
+		{
+			name:     "ShiftJIS",
+			codePage: 932,
+			input:    []byte{0x94, 0xad, 0x90, 0xb6, 0x8f, 0xea, 0x8f, 0x8a},
+			want:     "発生場所",
+		},
+		{
+			name:     "OEMUnitedStates",
+			codePage: 437,
+			input:    []byte{0x82},
+			want:     "é",
+		},
+		{
+			name:     "WindowsWestern",
+			codePage: 1252,
+			input:    []byte{0xe9},
+			want:     "é",
+		},
+	}
+
+	for _, tt := range tests {
+		t.Run(tt.name, func(t *testing.T) {
+			t.Parallel()
+			enc := encodingForCodePage(tt.codePage)
+			require.NotNil(t, enc)
+			got, err := enc.NewDecoder().Bytes(tt.input)
+			require.NoError(t, err)
+			assert.Equal(t, tt.want, string(got))
+		})
+	}
+}
+
+func TestEncodingForCodePage_UTF8(t *testing.T) {
+	t.Parallel()
+	assert.Nil(t, encodingForCodePage(65001))
+}
```

**File**: `internal/runtime/executor/console_windows.go` (added, +25/-0)
```diff
@@ -0,0 +1,25 @@
+// Copyright (C) 2026 Yota Hamada
+// SPDX-License-Identifier: GPL-3.0-or-later
+
+//go:build windows
+
+package executor
+
+import (
+	"golang.org/x/sys/windows"
+	"golang.org/x/text/encoding"
+)
+
+var procGetOEMCP = windows.NewLazySystemDLL("kernel32.dll").NewProc("GetOEMCP")
+
+// consoleEncoding returns the encoding console programs started by this
+// process write their output in, or nil when it is UTF-8 or unknown.
+func consoleEncoding() encoding.Encoding {
+	// Child processes inherit this process's console. Without one, they get a
+	// new console that uses the OEM code page.
+	if codePage, err := windows.GetConsoleOutputCP(); err == nil && codePage != 0 {
+		return encodingForCodePage(codePage)
+	}
+	codePage, _, _ := procGetOEMCP.Call()
+	return encodingForCodePage(uint32(codePage)) //nolint:gosec // GetOEMCP returns a UINT
+}
```

**File**: `internal/runtime/executor/tail.go` (modified, +42/-6)
```diff
@@ -6,7 +6,9 @@ package executor
 import (
 	"io"
 	"os"
+	"strings"
 	"sync"
+	"unicode/utf8"
 
 	"github.com/dagucloud/dagu/v2/internal/cmn/fileutil"
 )
@@ -40,8 +42,9 @@ func NewTailWriter(out io.Writer, max int) *TailWriter {
 }
 
 // NewTailWriterWithEncoding creates a TailWriter with character encoding support.
-// The encoding parameter specifies the character encoding of the output
-// (e.g., "utf-8", "shift_jis", "euc-jp"). If empty, UTF-8 is assumed.
+// The encoding parameter specifies the character encoding of output that is
+// not valid UTF-8 (e.g., "shift_jis", "euc-jp"). If empty, the console code
+// page of child processes is used where the platform has one.
 func NewTailWriterWithEncoding(out io.Writer, max int, encoding string) *TailWriter {
 	tw := NewTailWriter(out, max)
 	tw.encoding = encoding
@@ -72,11 +75,44 @@ func (t *TailWriter) Write(p []byte) (int, error) {
 	return n, err
 }
 
-// Tail returns the rolling tail buffer (up to max bytes) as a decoded string.
-// If an encoding was specified during creation, the buffer is decoded from
-// that encoding to UTF-8. Otherwise, the raw bytes are returned as a string.
+// Tail returns the rolling tail buffer (up to max bytes) as a valid UTF-8
+// string. Output that is already UTF-8 is returned as is; other output is
+// decoded from the writer's encoding, and bytes that still cannot be decoded
+// are replaced with U+FFFD.
 func (t *TailWriter) Tail() string {
 	t.mu.Lock()
 	defer t.mu.Unlock()
-	return fileutil.DecodeString(t.encoding, t.buf)
+
+	if text := t.trimPartialRune(); utf8.Valid(text) {
+		return string(text)
+	}
+	return strings.ToValidUTF8(t.decode(), "\uFFFD")
+}
+
+// trimPartialRune drops the continuation bytes of a UTF-8 rune that the
+// rolling limit cut at the start of the buffer.
+func (t *TailWriter) trimPartialRune() []byte {
+	if len(t.buf) < t.max {
+		return t.buf
+	}
+	for i := 0; i < utf8.UTFMax && i < len(t.buf); i++ {
+		if utf8.RuneStart(t.buf[i]) {
+			return t.buf[i:]
+		}
+	}
+	return t.buf
+}
+
+// decode converts the buffer from the writer's encoding or, when none is set,
+// from the console code page of child processes.
+func (t *TailWriter) decode() string {
+	if t.encoding != "" {
+		return fileutil.DecodeString(t.encoding, t.buf)
+	}
+	if enc := consoleEncoding(); enc != nil {
+		if decoded, err := enc.NewDecoder().Bytes(t.buf); err == nil {
+			return string(decoded)
+		}
+	}
+	return string(t.buf)
 }
```

---

### Incident Patch 3: `93975d0e` (2026-10-05)
**Commit Message**: fix(logs): keep UTF-8 log lines under a non-UTF-8 charset (#3018)

**File**: `internal/cmn/fileutil/logutil.go` (modified, +64/-35)
```diff
@@ -11,6 +11,7 @@ import (
 	"io"
 	"os"
 	"strings"
+	"unicode/utf8"
 
 	"golang.org/x/text/encoding"
 	"golang.org/x/text/encoding/charmap"
@@ -28,7 +29,7 @@ type LogReadOptions struct {
 	Tail     int    // Number of lines from the end
 	Offset   int    // Line number to start from (1-based)
 	Limit    int    // Maximum number of lines to return
-	Encoding string // Character encoding for the log file (e.g., "utf-8", "shift_jis", "euc-jp")
+	Encoding string // Charset for lines that are not valid UTF-8 (e.g., "shift_jis", "euc-jp")
 }
 
 // LogResult represents the result of reading a log file
@@ -49,11 +50,7 @@ func getEncodingDecoder(charset string) *encoding.Decoder {
 		return nil
 	}
 
-	// Normalize the charset name for comparison
-	normalized := strings.ToLower(strings.ReplaceAll(charset, "_", "-"))
-	normalized = strings.ReplaceAll(normalized, " ", "-")
-
-	switch normalized {
+	switch normalizeCharset(charset) {
 	// UTF-8 (no decoder needed)
 	case "utf-8", "utf8":
 		return nil
@@ -180,6 +177,57 @@ func getEncodingDecoder(charset string) *encoding.Decoder {
 	}
 }
 
+// normalizeCharset lowercases a charset name and spells its separators as hyphens.
+func normalizeCharset(charset string) string {
+	normalized := strings.ToLower(strings.ReplaceAll(charset, "_", "-"))
+	return strings.ReplaceAll(normalized, " ", "-")
+}
+
+// lineDecoder turns the raw lines of a log file into UTF-8 text.
+type lineDecoder struct {
+	// stream decodes the whole file before it is split into lines.
+	stream *encoding.Decoder
+	// fallback decodes a line that is not already UTF-8.
+	fallback *encoding.Decoder
+}
+
+// newLineDecoder returns the lineDecoder for charset. An empty, UTF-8, or
+// unknown charset keeps every line as is.
+func newLineDecoder(charset string) lineDecoder {
+	decoder := getEncodingDecoder(charset)
+	switch normalizeCharset(charset) {
+	// A line cannot be judged on its own in these charsets: the UTF-16
+	// newline spans two bytes, and ISO-2022-JP and HZ-GB2312 are 7-bit,
+	// so always valid UTF-8, with shift state that carries across lines.
+	case "utf-16", "utf16", "utf-16le", "utf16le", "utf-16be", "utf16be",
+		"iso-2022-jp", "iso2022jp", "csiso2022jp",
+		"hz-gb-2312", "hz":
+		return lineDecoder{stream: decoder}
+	}
+	return lineDecoder{fallback: decoder}
+}
+
+// reader returns r, decoded first when its lines cannot be split on raw bytes.
+func (d lineDecoder) reader(r io.Reader) io.Reader {
+	if d.stream == nil {
+		return r
+	}
+	return transform.NewReader(r, d.stream)
+}
+
+// text returns a scanned line as UTF-8 text. A line that is already valid
+// UTF-8 is kept as is, so UTF-8 output survives a code page charset.
+func (d lineDecoder) text(line []byte) string {
+	if d.fallback == nil || utf8.Valid(line) {
+		return string(line)
+	}
+	decoded, err := d.fallback.Bytes(line)
+	if err != nil {
+		return string(line)
+	}
+	return string(decoded)
+}
+
 // ReadLogLines reads a specific portion of a log file without loading the entire file into memory
 func ReadLogLines(filePath string, options LogReadOptions) (*LogResult, error) {
 	// Check if file exists
@@ -204,8 +252,7 @@ func ReadLogLines(filePath string, options LogReadOptions) (*LogResult, error) {
 		}, nil
 	}
 
-	// Get the encoding decoder (nil for UTF-8 or empty)
-	decoder := getEncodingDecoder(options.Encoding)
+	decoder := newLineDecoder(options.Encoding)
 
 	// Estimate or count total lines in the file
 	totalLines, isEstimate, err := estimateLineCount(filePath)
@@ -364,7 +411,7 @@ func countLinesExact(filePath string) (int, error) {
 }
 
 // readFirstLines reads the first n lines from a file
-func readFirstLines(filePath string, n int, totalLines int, decoder *encoding.Decoder) (*LogResult, error) {
+func readFirstLines(filePath string, n int, totalLines int, decoder lineDecoder) (*LogResult, error) {
 	file, err := os.Open(filePath) //nolint:gosec
 	if err != nil {
 		return nil, err
@@ -373,18 +420,12 @@ func readFirstLines(filePath string, n int, totalLines int, decoder *encoding.De
 		_ = file.Close()
 	}()
 
-	// Create a reader, optionally wrapping with decoder for non-UTF-8 encodings
-	var reader io.Reader = file
-	if decoder != nil {
-		reader = transform.NewReader(file, decoder)
-	}
-
-	scanner := bufio.NewScanner(reader)
+	scanner := bufio.NewScanner(decoder.reader(file))
 	lines := make([]string, 0, n)
 	lineCount := 0
 
 	for scanner.Scan() && lineCount < n {
-		lines = append(lines, scanner.Text())
+		lines = append(lines, decoder.text(scanner.Bytes()))
 		lineCount++
 	}
 
@@ -407,7 +448,7 @@ func readFirstLines(filePath string, n int, totalLines int, decoder *encoding.De
 }
 
 // readLastLines reads the last n lines from a file
-func readLastLines(filePath string, n int, totalLines int, decoder *encoding.Decoder) (*LogResult, error) {
+func readLastLines(filePath string, n int, totalLines int, decoder lineDecoder) (*LogResult, error) {
 	// If n is 0, return empty result
 	if n <= 0 {
 		return &LogResu
```

**File**: `internal/cmn/fileutil/logutil_test.go` (modified, +100/-3)
```diff
@@ -6,8 +6,13 @@ package fileutil
 import (
 	"os"
 	"path/filepath"
+	"slices"
 	"strings"
 	"testing"
+
+	"golang.org/x/text/encoding"
+	"golang.org/x/text/encoding/japanese"
+	"golang.org/x/text/encoding/unicode"
 )
 
 func TestReadLogLines(t *testing.T) {
@@ -431,7 +436,7 @@ func TestReadFirstLines(t *testing.T) {
 
 	for _, tt := range tests {
 		t.Run(tt.name, func(t *testing.T) {
-			result, err := readFirstLines(tt.filePath, tt.n, tt.totalLines, nil)
+			result, err := readFirstLines(tt.filePath, tt.n, tt.totalLines, lineDecoder{})
 
 			// Check error expectation
 			if (err != nil) != tt.expectError {
@@ -542,7 +547,7 @@ func TestReadLastLines(t *testing.T) {
 
 	for _, tt := range tests {
 		t.Run(tt.name, func(t *testing.T) {
-			result, err := readLastLines(tt.filePath, tt.n, tt.totalLines, nil)
+			result, err := readLastLines(tt.filePath, tt.n, tt.totalLines, lineDecoder{})
 
 			// Check error expectation
 			if (err != nil) != tt.expectError {
@@ -680,7 +685,7 @@ func TestReadLinesRange(t *testing.T) {
 
 	for _, tt := range tests {
 		t.Run(tt.name, func(t *testing.T) {
-			result, err := readLinesRange(tt.filePath, tt.offset, tt.limit, tt.totalLines, nil)
+			result, err := readLinesRange(tt.filePath, tt.offset, tt.limit, tt.totalLines, lineDecoder{})
 
 			// Check error expectation
 			if (err != nil) != tt.expectError {
@@ -839,6 +844,98 @@ func generateVaryingLineLengths(lineCount int) string {
 	return builder.String()
 }
 
+// A non-UTF-8 charset decodes only the lines that are not already UTF-8, so a
+// log that mixes UTF-8 and code page output stays readable.
+func TestReadLogLinesEncoding(t *testing.T) {
+	encode := func(enc encoding.Encoding, s string) []byte {
+		b, err := enc.NewEncoder().Bytes([]byte(s))
+		if err != nil {
+			t.Fatalf("Failed to encode %q: %v", s, err)
+		}
+		return b
+	}
+	mixed := slices.Concat(
+		[]byte("開始\r\n"),
+		encode(japanese.ShiftJIS, "こんにちは\r\n"),
+		[]byte("done\r\n終了\r\n"),
+	)
+
+	tests := []struct {
+		name    string
+		content []byte
+		options LogReadOptions
+		want    []string
+	}{
+		{
+			name:    "UTF8UnderShiftJIS",
+			content: []byte("日本語の出力テスト\r\n"),
+			options: LogReadOptions{Encoding: "shift_jis"},
+			want:    []string{"日本語の出力テスト"},
+		},
+		{
+			name:    "ShiftJIS",
+			content: encode(japanese.ShiftJIS, "こんにちは\n"),
+			options: LogReadOptions{Encoding: "shift_jis"},
+			want:    []string{"こんにちは"},
+		},
+		{
+			name:    "MixedHead",
+			content: mixed,
+			options: LogReadOptions{Encoding: "shift_jis", Head: 2},
+			want:    []string{"開始", "こんにちは"},
+		},
+		{
+			name:    "MixedTail",
+			content: mixed,
+			options: LogReadOptions{Encoding: "shift_jis", Tail: 3},
+			want:    []string{"こんにちは", "done", "終了"},
+		},
+		{
+			name:    "MixedRange",
+			content: mixed,
+			options: LogReadOptions{Encoding: "shift_jis", Offset: 2, Limit: 3},
+			want:    []string{"こんにちは", "done", "終了"},
+		},
+		{
+			// ISO-2022-JP text is 7-bit, which is also valid UTF-8.
+			name:    "ISO2022JP",
+			content: encode(japanese.ISO2022JP, "日本語\n"),
+			options: LogReadOptions{Encoding: "iso-2022-jp"},
+			want:    []string{"日本語"},
+		},
+		{
+			// "~" before a newline continues the line in HZ-GB2312.
+			name:    "HZGB2312Continuation",
+			content: []byte("foo~\nbar\n"),
+			options: LogReadOptions{Encoding: "hz-gb-2312"},
+			want:    []string{"foobar"},
+		},
+		{
+			name:    "UTF16LE",
+			content: encode(unicode.UTF16(unicode.LittleEndian, unicode.IgnoreBOM), "A\n日本\n"),
+			options: LogReadOptions{Encoding: "utf-16le"},
+			want:    []string{"A", "日本"},
+		},
+	}
+
+	for _, tt := range tests {
+		t.Run(tt.name, func(t *testing.T) {
+			path := filepath.Join(t.TempDir(), "step.out")
+			if err := os.WriteFile(path, tt.content, 0600); err != nil {
+				t.Fatalf("Failed to create test log file: %v", err)
+			}
+
+			result, err := ReadLogLines(path, tt.options)
+			if err != nil {
+				t.Fatalf("ReadLogLines() error = %v", err)
+			}
+			if !slices.Equal(result.Lines, tt.want) {
+				t.Errorf("ReadLogLines() lines = %q, want %q", result.Lines, tt.want)
+			}
+		})
+	}
+}
+
 func TestDecodeString(t *testing.T) {
 	tests := []struct {
 		name     string
```

**File**: `internal/cmn/schema/config.schema.json` (modified, +1/-1)
```diff
@@ -970,7 +970,7 @@
       "properties": {
         "log_encoding_charset": {
           "type": "string",
-          "description": "Character encoding for log display."
+          "description": "Character encoding for log lines that are not valid UTF-8."
         },
         "navbar_color": {
           "type": "string",
```

---

### Incident Patch 4: `e8559789` (2026-10-05)
**Commit Message**: fix(xlsx): defer an update_rows set that holds a reference (#3015)

**File**: `internal/runtime/builtin/xlsx/config.go` (modified, +1/-1)
```diff
@@ -467,7 +467,7 @@ func validateWriterConfig(operation string, cfg *config) error {
 		if strings.TrimSpace(cfg.Key) == workbook.RowNumberKey && cfg.Missing != "" && cfg.Missing != string(workbook.MissingFail) {
 			return fmt.Errorf("%w: missing: %s needs a key column; with key: _row nothing else identifies a row", errConfig, cfg.Missing)
 		}
-		if cfg.present["set"] {
+		if cfg.provided("set") {
 			set, err := workbook.ParseSet(cfg.Set)
 			if err != nil {
 				return fmt.Errorf("%w: %v", errConfig, err)
```

**File**: `internal/runtime/builtin/xlsx/update_test.go` (modified, +15/-0)
```diff
@@ -60,6 +60,21 @@ func TestUpdateRowsShapeCheckFailsTheStep(t *testing.T) {
 	assert.Equal(t, 1, tw.exec.ExitCode())
 }
 
+// A set deferred at build time is still parsed once its references resolve.
+func TestUpdateRowsChecksDeferredSetAtRun(t *testing.T) {
+	t.Parallel()
+	cfg := map[string]any{"path": "a.xlsx", "key": "_row", "rows": `[{"_row": 2}]`,
+		"set": map[string]any{"Status": map[string]any{"value": "${steps.reg.outputs.ticket}", "extra": 1}}}
+	require.NoError(t, validateStep(ir.Step{
+		Commands:       []ir.CommandEntry{{Command: opUpdateRows}},
+		ExecutorConfig: ir.ExecutorConfig{Type: executorType, Config: cfg},
+	}))
+
+	cfg["set"] = map[string]any{"Status": map[string]any{"value": "1", "extra": 1}}
+	_, err := newTestWriter(t, t.TempDir(), opUpdateRows, cfg)
+	require.ErrorContains(t, err, "set.Status: use a field name or {value: literal}")
+}
+
 func TestUpdateRowsValidation(t *testing.T) {
 	t.Parallel()
 	for _, tc := range []struct {
```

**File**: `internal/spec/step_xlsx_test.go` (modified, +30/-0)
```diff
@@ -5,6 +5,7 @@ package spec_test
 
 import (
 	"context"
+	"fmt"
 	"strings"
 	"testing"
 
@@ -148,6 +149,35 @@ steps:
 	assert.True(t, referenced.Artifacts.Enabled)
 }
 
+// A reference in one set literal defers set to the run; a set without one
+// is still checked at load.
+func TestXlsxUpdateRowsSetReference(t *testing.T) {
+	t.Parallel()
+
+	const yaml = `
+steps:
+  - id: reg
+    run: echo 1
+    output:
+      ticket: {from: stdout}
+  - id: mark
+    depends: [reg]
+    action: xlsx.update_rows
+    with:
+      path: orders.xlsx
+      key: _row
+      rows: '[{"_row": 2}]'
+      set:
+        Checked: {value: done}
+        Status: %s
+`
+	_, err := spec.LoadYAML(context.Background(), []byte(fmt.Sprintf(yaml, `{value: "${steps.reg.outputs.ticket}"}`)))
+	require.NoError(t, err)
+
+	_, err = spec.LoadYAML(context.Background(), []byte(fmt.Sprintf(yaml, `{value: done, extra: 1}`)))
+	require.ErrorContains(t, err, "set.Status: use a field name or {value: literal}")
+}
+
 func TestXlsxReadActionsRejectInvalidConfig(t *testing.T) {
 	t.Parallel()
 
```

---

### Incident Patch 5: `0b57b554` (2026-10-03)
**Commit Message**: fix(xlsx): never let two writes land on one merged cell (#2993)

**File**: `internal/cmn/workbook/address.go` (modified, +6/-1)
```diff
@@ -23,9 +23,14 @@ type region struct {
 }
 
 func (r region) String() string {
+	return r.Sheet + "!" + r.ref()
+}
+
+// ref is the region's address without its sheet, such as A3:B4.
+func (r region) ref() string {
 	start, _ := excelize.CoordinatesToCellName(r.C1, r.R1)
 	end, _ := excelize.CoordinatesToCellName(r.C2, max(r.R2, r.R1))
-	return r.Sheet + "!" + start + ":" + end
+	return start + ":" + end
 }
 
 func (r region) rows() int {
```

**File**: `internal/cmn/workbook/header.go` (modified, +10/-2)
```diff
@@ -205,12 +205,20 @@ func (w *file) mergeMap(sheet string) (mergeFill, error) {
 // origin returns the coordinates whose value a cell shows: its own, or the
 // top-left cell of the merge region covering it.
 func (m mergeFill) origin(col, row int) (int, int) {
+	if reg, ok := m.at(col, row); ok {
+		return reg.C1, reg.R1
+	}
+	return col, row
+}
+
+// at returns the merge region covering a cell, if any.
+func (m mergeFill) at(col, row int) (region, bool) {
 	for _, reg := range m {
 		if col >= reg.C1 && col <= reg.C2 && row >= reg.R1 && row <= reg.R2 {
-			return reg.C1, reg.R1
+			return reg, true
 		}
 	}
-	return col, row
+	return region{}, false
 }
 
 // headerLayout is where a read's header rows sit and where data begins.
```

**File**: `internal/cmn/workbook/update.go` (modified, +70/-21)
```diff
@@ -144,7 +144,10 @@ func DecodeUpdateRows(value any) ([]Row, error) {
 // UpdateRows writes columns back to the rows they came from. Before any
 // cell changes, the key column and every existing column in Set must still
 // be in the header row by name, and every row carrying _row must still hold
-// its key there; either failure aborts with nothing saved.
+// its key there; either failure aborts with nothing saved. A merged cell is
+// written once, at its top-left cell; rows that give it different values,
+// or a merged cell reaching outside its column's data rows, abort the same
+// way.
 func UpdateRows(ctx context.Context, path string, opts UpdateOptions) (*WriteResult, error) {
 	if opts.Missing == "" {
 		opts.Missing = MissingFail
@@ -167,6 +170,17 @@ type updatePlan struct {
 	grid      [][]string
 	merges    mergeFill
 	headerRow int
+	// mergedWrites holds the first write each merged cell receives, so a
+	// second row that writes it another value is refused rather than
+	// silently overwriting the first.
+	mergedWrites map[region]mergedWrite
+}
+
+// mergedWrite is a value an update writes into a merged cell and the input
+// row it came from.
+type mergedWrite struct {
+	index int
+	value any
 }
 
 // appendBase is the row whose styles appended rows inherit: the last data
@@ -224,7 +238,7 @@ func updateOnce(ctx context.Context, path string, opts UpdateOptions) (*WriteRes
 		}
 		plan.reg.C2++
 		plan.set[i].column = plan.reg.C2
-		if err := w.addHeaderColumn(plan.sheet, plan.headerRow, plan.reg.C2, plan.set[i].name); err != nil {
+		if err := w.addHeaderColumn(plan.sheet, plan.merges, plan.headerRow, plan.reg.C2, plan.set[i].name); err != nil {
 			return nil, err
 		}
 		result.Changes.ColumnsAdded++
@@ -235,7 +249,7 @@ func updateOnce(ctx context.Context, path string, opts UpdateOptions) (*WriteRes
 		if err := ctx.Err(); err != nil {
 			return nil, err
 		}
-		changed, err := w.applyRow(plan, target.row, target.input, false)
+		changed, err := w.applyRow(plan, target, false)
 		if err != nil {
 			return nil, err
 		}
@@ -244,16 +258,20 @@ func updateOnce(ctx context.Context, path string, opts UpdateOptions) (*WriteRes
 			result.Changes.CellsChanged += changed
 		}
 	}
-	for _, input := range appends {
+	for _, target := range appends {
 		lastRow++
+		target.row = lastRow
 		if plan.keyCol > 0 {
-			if err := w.setCell(plan.sheet, plan.keyCol, lastRow, input[opts.Key]); err != nil {
+			if _, _, err := w.mergedTarget(plan, plan.keyCol, lastRow, plan.headers[plan.keyCol-plan.reg.C1]); err != nil {
+				return nil, err
+			}
+			if err := w.setCell(plan.sheet, plan.keyCol, lastRow, target.input[opts.Key]); err != nil {
 				return nil, err
 			}
-			w.styleWrittenCell(plan.sheet, plan.keyCol, lastRow, w.styleAt(plan.sheet, plan.keyCol, plan.appendBase()), input[opts.Key], "")
+			w.styleWrittenCell(plan.sheet, plan.keyCol, lastRow, w.styleAt(plan.sheet, plan.keyCol, plan.appendBase()), target.input[opts.Key], "")
 			result.Changes.CellsChanged++
 		}
-		changed, err := w.applyRow(plan, lastRow, input, true)
+		changed, err := w.applyRow(plan, target, true)
 		if err != nil {
 			return nil, err
 		}
@@ -297,7 +315,7 @@ func (w *file) planUpdate(opts UpdateOptions, warn func(string)) (*updatePlan, e
 	headers := headerNames(reg, layout, grid, merges, warn)
 	plan := &updatePlan{
 		sheet: sheet, reg: reg, layout: layout, headers: headers, grid: grid, merges: merges,
-		headerRow: layout.rows[len(layout.rows)-1],
+		headerRow: layout.rows[len(layout.rows)-1], mergedWrites: map[region]mergedWrite{},
 	}
 	headerRow := layout.rows[0]
 	if opts.Key != RowNumberKey {
@@ -382,7 +400,7 @@ type rowTarget struct {
 
 // locateRows finds the sheet row of every input row and runs the second
 // shape check: a row addressed by _row must still hold its key there.
-func (w *file) locateRows(plan *updatePlan, opts UpdateOptions, warn func(string)) (targets []rowTarget, appends []Row, err error) {
+func (w *file) locateRows(plan *updatePlan, opts UpdateOptions, warn func(string)) (targets, appends []rowTarget, err error) {
 	byKey := map[string][]int{}
 	if plan.keyCol > 0 {
 		for r := plan.layout.dataStart; r <= plan.reg.R2; r++ {
@@ -434,7 +452,7 @@ func (w *file) locateRows(plan *updatePlan, opts UpdateOptions, warn func(string
 				case MissingSkip:
 					warn(fmt.Sprintf("%s: key %q not found; row skipped", plan.sheet, want))
 				case MissingAppend:
-					appends = append(appends, input)
+					appends = append(appends, rowTarget{index: i, input: input})
 				case MissingFail:
 					return nil, nil, w.sheetError(plan.sheet, fmt.Sprintf("key %q not found", want))
 				default:
@@ -473,7 +491,8 @@ func keyText(v any) string {
 // sameValue reports whether writing value would leave a cell as it is. The
 // comparison is type-aware: the number 7 and the text "7" differ, so a
 // requested change of cell type is written, while 7 and 7.0 or two equal
-// dates do not count as a change.
+// dates do not
```

**File**: `internal/cmn/workbook/update_test.go` (modified, +120/-0)
```diff
@@ -8,6 +8,7 @@ import (
 	"crypto/sha256"
 	"os"
 	"path/filepath"
+	"strings"
 	"testing"
 
 	"github.com/stretchr/testify/assert"
@@ -312,3 +313,122 @@ func TestUpdateRowsDatetimeLiteralKeepsItsFormatAtMidnight(t *testing.T) {
 	require.NoError(t, err)
 	assert.Equal(t, "2026-10-01T00:00:00", back.Rows[0]["Amount"], "a literal pinned to datetime keeps a date-time format even at midnight")
 }
+
+// mergedBook is an order slip: order 1 has two lines, rows 2 and 3, whose
+// Order, Status, and Due cells are merged, and order 2 has one line. The
+// merges replace the default ones when given.
+func mergedBook(t *testing.T, merges ...string) string {
+	t.Helper()
+	f := excelize.NewFile()
+	const s = "Sheet1"
+	setRow(t, f, s, "A1", "ID", "Order", "Status", "Due")
+	setRow(t, f, s, "A2", 1, "A-1")
+	setRow(t, f, s, "A3", 2)
+	setRow(t, f, s, "A4", 3, "A-2")
+	if len(merges) == 0 {
+		merges = []string{"B2:B3", "C2:C3", "D2:D3"}
+	}
+	for _, m := range merges {
+		first, last, _ := strings.Cut(m, ":")
+		require.NoError(t, f.MergeCell(s, first, last))
+	}
+	return saveBook(t, f, "merged.xlsx")
+}
+
+func TestUpdateRowsMergedCellConflict(t *testing.T) {
+	t.Parallel()
+	path := mergedBook(t)
+	before := fileHash(t, path)
+	_, err := UpdateRows(context.Background(), path, UpdateOptions{Key: "ID", Rows: []Row{{"ID": 1, "Status": "first"}, {"ID": 2, "Status": "second"}}})
+	require.EqualError(t, err, "merged.xlsx Sheet1: rows[0] and rows[1] write different values to merged cell Sheet1!C2:C3")
+	// A row whose value the cell already holds still claims it.
+	_, err = UpdateRows(context.Background(), path, UpdateOptions{Key: "ID", Rows: []Row{{"ID": 1, "Status": nil}, {"ID": 2, "Status": "second"}}})
+	require.EqualError(t, err, "merged.xlsx Sheet1: rows[0] and rows[1] write different values to merged cell Sheet1!C2:C3")
+	assert.Equal(t, before, fileHash(t, path))
+}
+
+func TestUpdateRowsMergedCellEqualValues(t *testing.T) {
+	t.Parallel()
+	path := mergedBook(t)
+	result, err := UpdateRows(context.Background(), path, UpdateOptions{Key: "ID", Rows: []Row{{"ID": 1, "Status": "Done"}, {"ID": 2, "Status": "Done"}}})
+	require.NoError(t, err)
+	assert.Equal(t, 1, result.Changes.CellsChanged, "the merged cell is written once")
+
+	back, err := Read(context.Background(), path, ReadOptions{})
+	require.NoError(t, err)
+	assert.Equal(t, "Done", back.Rows[0]["Status"])
+	assert.Equal(t, "Done", back.Rows[1]["Status"])
+	assert.Nil(t, back.Rows[2]["Status"])
+	f, err := excelize.OpenFile(path)
+	require.NoError(t, err)
+	defer func() { _ = f.Close() }()
+	merges, err := f.GetMergeCells("Sheet1")
+	require.NoError(t, err)
+	assert.Len(t, merges, 3)
+}
+
+func TestUpdateRowsMergedCellFromItsSecondRow(t *testing.T) {
+	t.Parallel()
+	path := mergedBook(t)
+	_, err := UpdateRows(context.Background(), path, UpdateOptions{Key: "ID", Rows: []Row{{"ID": 2, "Status": "Done", "Due": "2026-11-01"}}})
+	require.NoError(t, err)
+	back, err := Read(context.Background(), path, ReadOptions{})
+	require.NoError(t, err)
+	assert.Equal(t, "Done", back.Rows[0]["Status"])
+	assert.Equal(t, "2026-11-01", back.Rows[0]["Due"], "the date format lands on the cell that shows the date")
+
+	_, err = UpdateRows(context.Background(), path, UpdateOptions{Key: "ID", Rows: []Row{{"ID": 2, "Status": nil}}})
+	require.NoError(t, err)
+	back, err = Read(context.Background(), path, ReadOptions{})
+	require.NoError(t, err)
+	assert.Nil(t, back.Rows[0]["Status"])
+}
+
+// A merged cell reaching outside the column's data cells would carry the
+// write into the key, the header, or a column the update does not set.
+func TestUpdateRowsMergedCellOutsideItsColumn(t *testing.T) {
+	t.Parallel()
+	for _, tc := range []struct {
+		name, merge, message string
+		row                  Row
+		missing              MissingMode
+	}{
+		{"key column", "A4:C4", `merged.xlsx Sheet1!C4: merged cell A4:C4 reaches outside column "Status" of the data rows; unmerge it to write this cell`, Row{"ID": 3, "Status": "Done"}, ""},
+		{"header row", "C1:C2", `merged.xlsx Sheet1!C2: merged cell C1:C2 reaches outside column "Status" of the data rows; unmerge it to write this cell`, Row{"ID": 1, "Status": "Done"}, ""},
+		{"appended row", "A5:D6", `merged.xlsx Sheet1!A5: merged cell A5:D6 reaches outside column "ID" of the data rows; unmerge it to write this cell`, Row{"ID": 9, "Status": "New"}, MissingAppend},
+	} {
+		t.Run(tc.name, func(t *testing.T) {
+			t.Parallel()
+			path := mergedBook(t, tc.merge)
+			before := fileHash(t, path)
+			_, err := UpdateRows(context.Background(), path, UpdateOptions{Key: "ID", Rows: []Row{tc.row}, Missing: tc.missing})
+			require.EqualError(t, err, tc.message)
+			assert.Equal(t, before, fileHash(t, path))
+		})
+	}
+}
+
+func TestUpdateRowsComparesTextExactly(t *testing.T) {
+	t.Parallel()
+	path := ordersBook(t)
+	result, err := UpdateRows(context.Background(), path, UpdateOptions{Key: "Invoice No", Rows: []Row{{"Invoice No": "INV-2", "Status": "Done "}
```

**File**: `internal/cmn/workbook/write.go` (modified, +30/-3)
```diff
@@ -151,6 +151,14 @@ func writeOnce(ctx context.Context, path string, table Table, opts WriteOptions)
 	for c := range cols {
 		cols[c] = c + 1
 	}
+	// Appended cells land in rows that may already hold merged cells, which
+	// would take every value written inside them into their top-left cell.
+	var merges mergeFill
+	if opts.Mode == WriteAppend {
+		if merges, err = w.mergeMap(sheet); err != nil {
+			return nil, err
+		}
+	}
 	headerRow := 0
 	if opts.Mode == WriteAppend && !fresh {
 		targets, err := w.alignAppend(sheet, table, opts.Header, warn)
@@ -182,6 +190,9 @@ func writeOnce(ctx context.Context, path string, table Table, opts WriteOptions)
 	}
 	if writeHeader {
 		for c, name := range table.Columns {
+			if err := w.notMerged(sheet, merges, cols[c], startRow); err != nil {
+				return nil, err
+			}
 			if err := w.f.SetCellStr(sheet, cellName(cols[c], startRow), name); err != nil {
 				return nil, w.cellError(sheet, cols[c], startRow, err.Error())
 			}
@@ -207,6 +218,9 @@ func writeOnce(ctx context.Context, path string, table Table, opts WriteOptions)
 			if v == nil {
 				continue
 			}
+			if err := w.notMerged(sheet, merges, cols[c], r); err != nil {
+				return nil, err
+			}
 			if err := w.setCell(sheet, cols[c], r, v); err != nil {
 				return nil, err
 			}
@@ -242,6 +256,14 @@ func writeOnce(ctx context.Context, path string, table Table, opts WriteOptions)
 	return result, nil
 }
 
+// notMerged refuses an appended cell inside a merged cell.
+func (w *file) notMerged(sheet string, merges mergeFill, col, row int) error {
+	if merge, ok := merges.at(col, row); ok {
+		return w.cellError(sheet, col, row, fmt.Sprintf("cannot append into merged cell %s; unmerge it to write this cell", merge.ref()))
+	}
+	return nil
+}
+
 func mustGrid(w *file, sheet string) [][]string {
 	grid, _ := w.grid(sheet)
 	return grid
@@ -310,7 +332,7 @@ func (w *file) alignAppend(sheet string, table Table, header bool, warn func(str
 			return targets, w.sheetError(sheet, fmt.Sprintf("column %q not found in header row %d; did you mean %q?", name, targets.headerRow, near))
 		default:
 			next++
-			if err := w.addHeaderColumn(sheet, targets.headerRow, next, name); err != nil {
+			if err := w.addHeaderColumn(sheet, merges, targets.headerRow, next, name); err != nil {
 				return targets, err
 			}
 			targets.cols[c] = next
@@ -322,8 +344,13 @@ func (w *file) alignAppend(sheet string, table Table, header bool, warn func(str
 
 // addHeaderColumn writes the header cell of a column added at the right of
 // a header row, copying the style of the header cell to its left so the
-// header keeps one look.
-func (w *file) addHeaderColumn(sheet string, headerRow, col int, name string) error {
+// header keeps one look. A header cell inside a merged cell is refused: the
+// name would land in the merged cell's top-left cell, which may hold
+// another column's header.
+func (w *file) addHeaderColumn(sheet string, merges mergeFill, headerRow, col int, name string) error {
+	if merge, ok := merges.at(col, headerRow); ok {
+		return w.cellError(sheet, col, headerRow, fmt.Sprintf("merged cell %s covers the header cell of new column %q; unmerge it to add the column", merge.ref(), name))
+	}
 	cell := cellName(col, headerRow)
 	if err := w.f.SetCellStr(sheet, cell, name); err != nil {
 		return w.cellError(sheet, col, headerRow, err.Error())
```

**File**: `internal/cmn/workbook/write_cells.go` (modified, +20/-4)
```diff
@@ -253,7 +253,9 @@ type cellTarget struct {
 // resolveCells maps every address to its cell, in address order, and
 // refuses two addresses that name the same cell, such as B3 and $B$3 or a
 // defined name and the cell it refers to: the request would otherwise
-// write one of their values at random.
+// write one of their values at random. An address inside a merged cell, or
+// a range covering exactly its area, as Excel names a merged cell, names
+// the merged cell, whose top-left cell holds its value.
 func (w *file) resolveCells(sheet string, cells map[string]CellValue) ([]cellTarget, error) {
 	addresses := make([]string, 0, len(cells))
 	for addr := range cells {
@@ -262,17 +264,31 @@ func (w *file) resolveCells(sheet string, cells map[string]CellValue) ([]cellTar
 	sort.Strings(addresses)
 	targets := make([]cellTarget, 0, len(addresses))
 	first := map[string]string{}
+	merges := map[string]mergeFill{}
 	for _, addr := range addresses {
 		reg, err := w.parseRange(sheet, addr)
 		if err != nil {
 			return nil, err
 		}
-		if reg.C1 != reg.C2 || reg.R1 != reg.R2 {
+		fill, loaded := merges[reg.Sheet]
+		if !loaded {
+			if fill, err = w.mergeMap(reg.Sheet); err != nil {
+				return nil, err
+			}
+			merges[reg.Sheet] = fill
+		}
+		single := reg.C1 == reg.C2 && reg.R1 == reg.R2
+		key, what := reg.Sheet+"!"+cellName(reg.C1, reg.R1), "cell"
+		merge, merged := fill.at(reg.C1, reg.R1)
+		switch {
+		case merged && (single || reg == merge):
+			reg = region{Sheet: reg.Sheet, C1: merge.C1, R1: merge.R1, C2: merge.C1, R2: merge.R1}
+			key, what = merge.String(), "merged cell"
+		case !single:
 			return nil, fmt.Errorf("%s: %q is not a single cell", w.base, addr)
 		}
-		key := reg.String()
 		if other, dup := first[key]; dup {
-			return nil, fmt.Errorf("%s: %q and %q name the same cell %s", w.base, other, addr, key)
+			return nil, fmt.Errorf("%s: %q and %q name the same %s %s", w.base, other, addr, what, key)
 		}
 		first[key] = addr
 		targets = append(targets, cellTarget{addr: addr, region: reg})
```

**File**: `internal/cmn/workbook/write_cells_test.go` (modified, +42/-0)
```diff
@@ -268,3 +268,45 @@ func TestWriteCellsDryRunAndErrors(t *testing.T) {
 	var missing *NotFoundError
 	require.ErrorAs(t, err, &missing)
 }
+
+// mergedTemplate is a template whose total box spans B2:D2 and is named
+// Total, the way Excel names a merged cell: over its whole area.
+func mergedTemplate(t *testing.T) string {
+	t.Helper()
+	f := excelize.NewFile()
+	setRow(t, f, "Sheet1", "A1", "Customer", "")
+	setRow(t, f, "Sheet1", "A2", "Total", "old")
+	require.NoError(t, f.MergeCell("Sheet1", "B2", "D2"))
+	require.NoError(t, f.SetDefinedName(&excelize.DefinedName{Name: "Total", RefersTo: "Sheet1!$B$2:$D$2"}))
+	return saveBook(t, f, "merged.xlsx")
+}
+
+func TestWriteCellsMergedCell(t *testing.T) {
+	t.Parallel()
+	for _, addr := range []string{"Total", "C2", "B2:D2"} {
+		t.Run(addr, func(t *testing.T) {
+			t.Parallel()
+			path := mergedTemplate(t)
+			result, err := WriteCells(context.Background(), path, WriteCellsOptions{Cells: map[string]CellValue{addr: {Value: int64(42)}}})
+			require.NoError(t, err)
+			assert.Equal(t, Changes{Sheet: "Sheet1", Range: "Sheet1!B2:B2", RowsUpdated: 1, CellsChanged: 1}, result.Changes)
+			f, err := excelize.OpenFile(path)
+			require.NoError(t, err)
+			defer func() { _ = f.Close() }()
+			total, err := f.GetCellValue("Sheet1", "B2")
+			require.NoError(t, err)
+			assert.Equal(t, "42", total)
+		})
+	}
+}
+
+func TestWriteCellsRejectsTwoAddressesInOneMergedCell(t *testing.T) {
+	t.Parallel()
+	path := mergedTemplate(t)
+	before := fileHash(t, path)
+	_, err := WriteCells(context.Background(), path, WriteCellsOptions{Cells: map[string]CellValue{"B2": {Value: 1}, "C2": {Value: 2}}})
+	require.EqualError(t, err, `merged.xlsx: "B2" and "C2" name the same merged cell Sheet1!B2:D2`)
+	_, err = WriteCells(context.Background(), path, WriteCellsOptions{Cells: map[string]CellValue{"B2:C2": {Value: 1}}})
+	require.ErrorContains(t, err, `"B2:C2" is not a single cell`, "a range that is only part of a merged cell")
+	assert.Equal(t, before, fileHash(t, path))
+}
```

**File**: `internal/cmn/workbook/write_test.go` (modified, +32/-0)
```diff
@@ -776,3 +776,35 @@ func TestAppendInnerSpacingMismatchIsRefused(t *testing.T) {
 	_, err = Append(context.Background(), path, more, WriteOptions{Header: true})
 	require.ErrorContains(t, err, `column "First  Name" not found in header row 1; did you mean "First Name"?`)
 }
+
+// An empty merged block below the rows, such as a notes box, would take
+// every appended cell it covers into its top-left cell.
+func TestAppendIntoMergedCellIsRefused(t *testing.T) {
+	t.Parallel()
+	f := excelize.NewFile()
+	setRow(t, f, "Sheet1", "A1", "item", "qty")
+	setRow(t, f, "Sheet1", "A2", "pen", 1)
+	require.NoError(t, f.MergeCell("Sheet1", "A3", "B4"))
+	path := saveBook(t, f, "block.xlsx")
+	before := fileHash(t, path)
+
+	more := Table{Columns: []string{"item", "qty"}, Rows: [][]any{{"ink", 2}, {"pad", 3}}}
+	_, err := Append(context.Background(), path, more, WriteOptions{Header: true})
+	require.EqualError(t, err, "block.xlsx Sheet1!A3: cannot append into merged cell A3:B4; unmerge it to write this cell")
+	assert.Equal(t, before, fileHash(t, path))
+}
+
+func TestAppendNewColumnUnderMergedHeaderIsRefused(t *testing.T) {
+	t.Parallel()
+	f := excelize.NewFile()
+	setRow(t, f, "Sheet1", "A1", "item", "qty")
+	setRow(t, f, "Sheet1", "A2", "pen", 1)
+	require.NoError(t, f.MergeCell("Sheet1", "B1", "C1"))
+	path := saveBook(t, f, "header.xlsx")
+	before := fileHash(t, path)
+
+	more := Table{Columns: []string{"item", "qty", "note"}, Rows: [][]any{{"ink", 2, "blue"}}}
+	_, err := Append(context.Background(), path, more, WriteOptions{Header: true})
+	require.EqualError(t, err, `header.xlsx Sheet1!C1: merged cell B1:C1 covers the header cell of new column "note"; unmerge it to add the column`)
+	assert.Equal(t, before, fileHash(t, path))
+}
```

---

### Incident Patch 6: `329211cb` (2026-10-03)
**Commit Message**: fix: append by header name, partially succeeded foreach, numeric text in cells (#2990)

**File**: `conformance/spec018_parallel_foreach/parallel_foreach_test.go` (modified, +53/-0)
```diff
@@ -4,9 +4,13 @@
 package spec018_parallel_foreach_test
 
 import (
+	"encoding/json"
+	"os"
+	"path/filepath"
 	"testing"
 
 	"github.com/dagucloud/dagu/v2/conformance/harness"
+	"github.com/stretchr/testify/require"
 )
 
 func TestParallelValidation(t *testing.T) {
@@ -190,4 +194,53 @@ func TestForeachRuntime(t *testing.T) {
 		result.ExpectStderrContains("foreach.items string must resolve to a JSON array")
 		dagu.ExpectNoFile("foreach-non-json-ran.txt")
 	})
+
+	t.Run("a failed item body leaves the step partially succeeded with its aggregate", func(t *testing.T) {
+		t.Parallel()
+
+		dagu := harness.NewRunner(t)
+		env := []string{"DAGU_HOME=" + filepath.Join(t.TempDir(), "dagu")}
+		const runID = "spec018-foreach-partial"
+		result := dagu.RunWithEnv(env, "start", "--run-id="+runID, "foreach_partial_failure.yaml")
+		result.ExpectExitCode(0)
+
+		status := dagu.RunWithEnv(env, "status", "--run-id="+runID, "foreach_partial_failure.yaml")
+		status.ExpectExitCode(0)
+		require.Contains(t, status.Stdout(), "Partially Succeeded")
+
+		var aggregate struct {
+			Summary struct {
+				Total     int `json:"total"`
+				Succeeded int `json:"succeeded"`
+				Failed    int `json:"failed"`
+			} `json:"summary"`
+			Items []struct {
+				Key    string `json:"key"`
+				Status string `json:"status"`
+				Error  string `json:"error"`
+			} `json:"items"`
+			Outputs []map[string]string `json:"outputs"`
+		}
+		data, err := os.ReadFile(dagu.ProjectPath("foreach-partial-results.txt"))
+		require.NoError(t, err, "the dependent step ran and wrote the aggregate")
+		require.NoError(t, json.Unmarshal(data, &aggregate))
+		require.Equal(t, 3, aggregate.Summary.Total)
+		require.Equal(t, 2, aggregate.Summary.Succeeded)
+		require.Equal(t, 1, aggregate.Summary.Failed)
+		require.Len(t, aggregate.Items, 3)
+		require.Equal(t, "b", aggregate.Items[1].Key)
+		require.Equal(t, "failed", aggregate.Items[1].Status)
+		require.NotEmpty(t, aggregate.Items[1].Error)
+		require.Equal(t, []map[string]string{{"item": "a"}, {"item": "c"}}, aggregate.Outputs, "outputs holds the successful bodies only")
+	})
+
+	t.Run("every item body failing fails the step", func(t *testing.T) {
+		t.Parallel()
+
+		dagu := harness.NewRunner(t)
+		result := dagu.Run("start", "foreach_all_fail.yaml")
+		result.ExpectExitCode(1)
+		result.ExpectStderrContains("all 2 item bodies failed")
+		dagu.ExpectNoFile("foreach-all-fail-results.txt")
+	})
 }
```

**File**: `conformance/spec018_parallel_foreach/testdata/foreach_all_fail.yaml` (added, +18/-0)
```diff
@@ -0,0 +1,18 @@
+working_dir: .
+steps:
+  - name: each
+    foreach:
+      items: ["a", "b"]
+      key: ${foreach.item}
+      steps:
+        - id: body
+          run: "false"
+      collect:
+        item: ${foreach.item}
+    output: RESULTS
+  - name: consume
+    depends: each
+    action: file.write
+    with:
+      path: foreach-all-fail-results.txt
+      content: ${RESULTS}
```

**File**: `conformance/spec018_parallel_foreach/testdata/foreach_partial_failure.yaml` (added, +18/-0)
```diff
@@ -0,0 +1,18 @@
+working_dir: .
+steps:
+  - name: each
+    foreach:
+      items: ["a", "b", "c"]
+      key: ${foreach.item}
+      steps:
+        - id: body
+          run: test "${foreach.item}" != "b"
+      collect:
+        item: ${foreach.item}
+    output: RESULTS
+  - name: consume
+    depends: each
+    action: file.write
+    with:
+      path: foreach-partial-results.txt
+      content: ${RESULTS}
```

**File**: `conformance/spec073_mailbox/mailbox_test.go` (modified, +5/-2)
```diff
@@ -89,7 +89,8 @@ func TestSearch(t *testing.T) {
 }
 
 // One loop item fails: the other email is marked read, and the failed one
-// stays unread so the next run takes it again.
+// stays unread so the next run takes it again. The loop is partially
+// succeeded (Spec 018), so the run reports that rather than a failure.
 func TestEachEmailMarkedAfterItsWork(t *testing.T) {
 	t.Parallel()
 
@@ -98,7 +99,9 @@ func TestEachEmailMarkedAfterItsWork(t *testing.T) {
 	broken := server.Append(t, "INBOX", email("Broken", "This one fails."))
 
 	dagu := harness.NewRunner(t)
-	dagu.RunWithEnv(accountEnv(server), "start", "each_mark_read.yaml").ExpectNonZeroExitCode()
+	result := dagu.RunWithEnv(accountEnv(server), "start", "each_mark_read.yaml")
+	result.ExpectExitCode(0)
+	require.Contains(t, result.Stdout(), "Partially Succeeded")
 
 	assert.True(t, server.HasFlag(t, "INBOX", good, imap.FlagSeen))
 	assert.False(t, server.HasFlag(t, "INBOX", broken, imap.FlagSeen))
```

**File**: `conformance/spec077_xlsx/gaps_actions_test.go` (modified, +2/-0)
```diff
@@ -69,6 +69,8 @@ func TestXlsxWriteCellsRules(t *testing.T) {
 	require.Equal(t, "2026-10-01", out.Rows[1]["B"])
 	require.Equal(t, float64(3), out.Rows[2]["B"], "a formula replaces the text the cell held and a read evaluates it")
 	require.Contains(t, out.Warnings, "Sheet1!B3: formula had no cached value; evaluated")
+	require.Equal(t, float64(100), out.Rows[3]["B"], "a canonical number in text is written as a number")
+	require.Equal(t, "007", out.Rows[4]["B"], "leading zeros stay text")
 }
 
 // Spec 077 "Sheets": if_exists: replace, missing: skip, and renames that
```

**File**: `conformance/spec077_xlsx/gaps_append_test.go` (added, +39/-0)
```diff
@@ -0,0 +1,39 @@
+// Copyright (C) 2026 Yota Hamada
+// SPDX-License-Identifier: GPL-3.0-or-later
+
+package spec077_xlsx_test
+
+import (
+	"testing"
+
+	"github.com/dagucloud/dagu/v2/conformance/harness"
+	"github.com/stretchr/testify/require"
+)
+
+// Spec 077 "Writing" and the append paragraph: rows appended below a header
+// row land under the header cells of the same names, a name the header
+// lacks adds a column at the right, and a loosely matching name is refused.
+func TestXlsxAppendAligned(t *testing.T) {
+	t.Parallel()
+	dagu := harness.NewRunner(t)
+	dagu.Run("start", "append_aligned.yaml").ExpectExitCode(0)
+	var out struct {
+		Changes changes          `json:"changes"`
+		Headers []string         `json:"headers"`
+		Rows    []map[string]any `json:"rows"`
+	}
+	readJSON(t, dagu, "out.json", &out)
+	require.Equal(t, changes{Sheet: "Sheet1", Range: "Sheet1!A4:D4", RowsAppended: 1, ColumnsAdded: 1, CellsChanged: 3}, out.Changes)
+	require.Equal(t, []string{"when", "what", "who", "note"}, out.Headers)
+	require.Len(t, out.Rows, 3)
+	require.Equal(t, "2026-10-03", out.Rows[2]["when"], "the field named when lands under the when header, whatever its key order")
+	require.Equal(t, "cid", out.Rows[2]["who"])
+	require.Nil(t, out.Rows[2]["what"], "a header column no field carries stays empty")
+	require.Equal(t, "late", out.Rows[2]["note"], "a field the header lacks adds a column at the right")
+
+	loose := harness.NewRunner(t)
+	result := loose.Run("start", "append_loose.yaml")
+	result.ExpectNonZeroExitCode()
+	result.ExpectStderrContains(`column "amount" not found in header row 1; did you mean "Amount"?`)
+	loose.ExpectNoFile("after.txt")
+}
```

**File**: `conformance/spec077_xlsx/gaps_write_test.go` (modified, +10/-8)
```diff
@@ -109,8 +109,10 @@ func TestXlsxAppendPreview(t *testing.T) {
 
 // TestXlsxUpdateRowsForeach is the spec's first example: rows still to do
 // are read, acted on in a foreach, and the results written back from the
-// loop's aggregate output. The body reports its own outcome rather than
-// failing, since a foreach with a failed item publishes no aggregate.
+// loop's aggregate output. One submission fails, so the loop and the run
+// end partially succeeded, yet the write-back runs: the rows that
+// succeeded are marked and the failed row keeps its empty Status, so the
+// next run's where retries only it.
 func TestXlsxUpdateRowsForeach(t *testing.T) {
 	t.Parallel()
 	dagu := harness.NewRunner(t)
@@ -136,14 +138,14 @@ func TestXlsxUpdateRowsForeach(t *testing.T) {
 	}
 	readJSON(t, dagu, "out.json", &out)
 	require.Equal(t, 3, out.Results.Summary.Total, "where kept the rows with an empty Status")
-	require.Equal(t, 3, out.Results.Summary.Succeeded)
-	require.Equal(t, 0, out.Results.Summary.Failed)
-	require.Len(t, out.Results.Outputs, 3, "outputs holds the collected object of every item")
-	require.Equal(t, map[string]any{"order_id": "INV-2", "status": "failed"}, out.Results.Outputs[1])
-	require.Equal(t, 3, out.Changes.RowsUpdated, "rows takes the aggregate and uses its outputs list")
+	require.Equal(t, 2, out.Results.Summary.Succeeded)
+	require.Equal(t, 1, out.Results.Summary.Failed)
+	require.Len(t, out.Results.Outputs, 2, "outputs holds the collected object of the items that succeeded")
+	require.Equal(t, map[string]any{"order_id": "INV-4", "status": "submitted"}, out.Results.Outputs[1])
+	require.Equal(t, 2, out.Changes.RowsUpdated, "rows takes the aggregate and uses its outputs list")
 	require.Len(t, out.Rows, 4)
 	require.Equal(t, "submitted", out.Rows[0]["Status"])
-	require.Equal(t, "failed", out.Rows[1]["Status"], "the item that could not submit marked its row")
+	require.Nil(t, out.Rows[1]["Status"], "the row whose submission failed is untouched, so the next run retries it")
 	require.Equal(t, "Done", out.Rows[2]["Status"], "the row where left out is untouched")
 	require.Equal(t, "submitted", out.Rows[3]["Status"])
 }
```

**File**: `conformance/spec077_xlsx/testdata/append_aligned.yaml` (added, +28/-0)
```diff
@@ -0,0 +1,28 @@
+working_dir: .
+steps:
+  - id: write
+    action: xlsx.write
+    with:
+      path: log.xlsx
+      columns: [when, what, who]
+      rows: [{"when": "2026-10-01", "what": "start", "who": "ann"}, {"when": "2026-10-02", "what": "work", "who": "bob"}]
+  - id: append
+    depends: write
+    action: xlsx.append
+    with:
+      path: log.xlsx
+      rows:
+        - who: cid
+          when: "2026-10-03"
+          note: late
+  - id: read
+    depends: append
+    action: xlsx.read
+    with:
+      path: log.xlsx
+  - id: out
+    depends: read
+    action: file.write
+    with:
+      path: out.json
+      content: '{"changes": ${steps.append.outputs.changes}, "headers": ${steps.read.outputs.headers}, "rows": ${steps.read.outputs.rows}}'
```

---

### Incident Patch 7: `6c3cc8de` (2026-10-03)
**Commit Message**: fix: correct help and schema text for browser and computer steps (#2987)

**File**: `internal/cmd/rm.go` (modified, +2/-2)
```diff
@@ -30,8 +30,8 @@ Flags:
       --dry-run       Preview what would be deleted without deleting
 
 Active runs are never deleted from history. Deleting all history also clears
-the replay cache of the DAG's browser steps on this host. Definition deletion
-is refused while the DAG has alive processes.
+the replay caches of the DAG's browser and computer steps on this host.
+Definition deletion is refused while the DAG has alive processes.
 
 With --definition, identify the DAG by filename, stem, or configured path.
 
```

**File**: `internal/cmn/schema/dag.schema.json` (modified, +3/-3)
```diff
@@ -7541,7 +7541,7 @@
         "allowed_domains": {
           "type": "array",
           "items": { "type": "string", "minLength": 1 },
-          "description": "Domains the browser may navigate to, such as example.com or *.example.com."
+          "description": "Hosts the page's HTTP(S) requests may reach, such as example.com or *.example.com. List the CDN and sign-in hosts the site loads from."
         },
         "screenshots": {
           "type": "string",
@@ -7640,7 +7640,7 @@
                 "instruction": { "type": "string", "minLength": 1 },
                 "cache": {
                   "type": "boolean",
-                  "description": "Replay recorded actions for this operation. Defaults to with.cache."
+                  "description": "Set false to disable the replay cache for this operation. Has no effect when with.cache is false."
                 }
               }
             }
@@ -7870,7 +7870,7 @@
                 "instruction": { "type": "string", "minLength": 1 },
                 "cache": {
                   "type": "boolean",
-                  "description": "Replay recorded actions for this operation. Defaults to with.cache."
+                  "description": "Set false to disable the replay cache for this operation. Has no effect when with.cache is false."
                 },
                 "max_actions": {
                   "type": "integer",
```

---

### Incident Patch 8: `ee3248d7` (2026-10-03)
**Commit Message**: fix(value): preserve inserted binding text (#2982)

Co-authored-by: Yota Hamada <[REDACTED_EMAIL]>

**File**: `conformance/spec003_value_resolution/testdata/insertion_literal_text.yaml` (added, +31/-0)
```diff
@@ -0,0 +1,31 @@
+params:
+  - name: escaped
+    type: string
+    default: 'p\$INSERTED'
+  - name: variable
+    type: string
+    default: '$INSERTED/data'
+env:
+  INSERTED: expanded
+  ROOT_COPY: ${params.variable}
+  ROOT_ESC: '\$INSERTED'
+  ROOT_ESC_PARAM: ${params.escaped}
+  RUN_COPY: ${params.variable}-${context.run.id}
+working_dir: .
+steps:
+  - id: check
+    env:
+      COPY: ${params.variable}
+    action: file.write
+    with:
+      path: insertion.txt
+      content: |
+        ${params.escaped}
+        ${params.variable}
+        ${env.COPY}
+        $INSERTED
+        $INSERTED${params.variable}
+        ${env.ROOT_COPY}
+        ${env.ROOT_ESC}
+        ${env.ROOT_ESC_PARAM}
+        ${env.RUN_COPY}
```

**File**: `conformance/spec003_value_resolution/testdata/root_env_retry.yaml` (added, +13/-0)
```diff
@@ -0,0 +1,13 @@
+params:
+  - name: variable
+    type: string
+    default: '$INSERTED/data'
+env:
+  INSERTED: expanded
+  ROOT_COPY: ${params.variable}
+working_dir: .
+steps:
+  - id: check
+    run: |
+      printf '%s\n' "$ROOT_COPY" >> root_copy.out
+      [ -f ready ]
```

**File**: `conformance/spec003_value_resolution/value_resolution_test.go` (modified, +26/-0)
```diff
@@ -4,6 +4,7 @@
 package spec003_value_resolution_test
 
 import (
+	"path/filepath"
 	"testing"
 
 	"github.com/dagucloud/dagu/v2/conformance/harness"
@@ -91,6 +92,31 @@ func TestStringInsertionCoercion(t *testing.T) {
 	})
 }
 
+func TestInsertedTextStaysLiteral(t *testing.T) {
+	t.Parallel()
+
+	dagu := harness.NewRunner(t)
+	result := dagu.Run("start", "--run-id=spec003-insertion", "insertion_literal_text.yaml")
+	result.ExpectExitCode(0)
+	dagu.ExpectFileContent("insertion.txt", "p\\$INSERTED\n$INSERTED/data\n$INSERTED/data\nexpanded\nexpanded$INSERTED/data\n"+
+		"$INSERTED/data\n$INSERTED\np\\$INSERTED\n$INSERTED/data-spec003-insertion\n")
+}
+
+// A retry rebuilds the DAG from its stored definition, and root env inserted
+// at the first load must stay literal on that path too.
+func TestRootEnvInsertionOnRetry(t *testing.T) {
+	t.Parallel()
+
+	const runID = "spec003-root-env-retry"
+	dagu := harness.NewRunner(t)
+	env := []string{"DAGU_HOME=" + filepath.Join(t.TempDir(), "dagu")}
+
+	dagu.RunWithEnv(env, "start", "--run-id="+runID, "root_env_retry.yaml").ExpectNonZeroExitCode()
+	dagu.WriteFile("ready", "")
+	dagu.RunWithEnv(env, "retry", "--run-id="+runID, "root_env_retry.yaml").ExpectExitCode(0)
+	dagu.ExpectTextFileContent("root_copy.out", "$INSERTED/data\n$INSERTED/data\n")
+}
+
 // TestDefectAndRuntimeOnlyNoticeClassification proves the two notice classes
 // from "Unresolved Supported References" are actually distinguished, not just
 // both labeled generically:
```

**File**: `internal/cmn/value/dollar_escape.go` (modified, +2/-1)
```diff
@@ -29,7 +29,8 @@ func withDollarEscapes(ctx context.Context, input string) (context.Context, stri
 		ctx = context.Background()
 	}
 
-	token := uniqueToken(input, "__DAGU_DOLLAR_ESC__")
+	// A leading non-identifier rune keeps an adjacent $NAME from absorbing the token.
+	token := uniqueToken(input, "\uE000DAGU_DOLLAR_ESC_")
 	var b strings.Builder
 	b.Grow(len(input))
 
```

**File**: `internal/cmn/value/dynamic_evaluation_external_test.go` (modified, +1/-0)
```diff
@@ -93,6 +93,7 @@ func TestNonDynamicFieldsPreserveCommandSubstitutionText(t *testing.T) {
 		{name: "workflow", field: value.WorkflowField("steps[0].run")},
 		{name: "dag env", field: value.DAGEnvField("env.OUTSIDE")},
 		{name: "runtime dag env", field: value.RuntimeDAGEnvField("env.OUTSIDE")},
+		{name: "dag env completion", field: value.DAGEnvCompletionField("env.OUTSIDE")},
 		{name: "step env", field: value.StepEnvField("steps[0].env.OUTSIDE")},
 		{name: "container env", field: value.ContainerEnvField("steps[0].container.env.OUTSIDE")},
 		{name: "executor config", field: value.ExecutorConfigField("steps[0].with.value")},
```

**File**: `internal/cmn/value/export_test.go` (modified, +1/-0)
```diff
@@ -25,6 +25,7 @@ func SemanticFieldsForTest(path string) []SemanticFieldForTest {
 		{Name: "HostConfigObject", Field: HostConfigObjectField(path)},
 		{Name: "DAGEnv", Field: DAGEnvField(path)},
 		{Name: "RuntimeDAGEnv", Field: RuntimeDAGEnvField(path)},
+		{Name: "DAGEnvCompletion", Field: DAGEnvCompletionField(path)},
 		{Name: "DynamicParamEval", Field: DynamicParamEvalField(path)},
 		{Name: "DotenvPath", Field: DotenvPathField(path)},
 		{Name: "StepDir", Field: StepDirField(path)},
```

**File**: `internal/cmn/value/field.go` (modified, +5/-0)
```diff
@@ -20,6 +20,7 @@ const (
 	fieldHostConfigObject
 	fieldDAGEnv
 	fieldRuntimeDAGEnv
+	fieldDAGEnvCompletion
 	fieldDynamicParamEval
 	fieldDotenvPath
 	fieldStepDir
@@ -85,6 +86,10 @@ func DAGEnvField(path string) Field { return newField(path, fieldDAGEnv) }
 // RuntimeDAGEnvField returns the policy for runtime DAG env entries.
 func RuntimeDAGEnvField(path string) Field { return newField(path, fieldRuntimeDAGEnv) }
 
+// DAGEnvCompletionField returns the policy for completing a DAG env entry that
+// loading already resolved. Escapes applied at load are not applied again.
+func DAGEnvCompletionField(path string) Field { return newField(path, fieldDAGEnvCompletion) }
+
 // DynamicParamEvalField returns the policy for dynamic param eval values.
 func DynamicParamEvalField(path string) Field { return newField(path, fieldDynamicParamEval) }
 
```

**File**: `internal/cmn/value/field_test.go` (modified, +2/-0)
```diff
@@ -51,6 +51,7 @@ func TestResolverFieldPolicyMatrix(t *testing.T) {
 		"HostConfigObject":           nonStrictNoOS,
 		"DAGEnv":                     strictOS,
 		"RuntimeDAGEnv":              strictNoOS,
+		"DAGEnvCompletion":           strictNoOS,
 		"DynamicParamEval":           strictOS,
 		"DotenvPath":                 strictOS,
 		"StepDir":                    strictNoOS,
@@ -110,6 +111,7 @@ func TestResolverFieldPolicyBacktickMatrix(t *testing.T) {
 		{name: "workflow", field: value.WorkflowField("field"), want: "`printf matrix`"},
 		{name: "DAG env", field: value.DAGEnvField("field"), want: "`printf matrix`"},
 		{name: "runtime DAG env", field: value.RuntimeDAGEnvField("field"), want: "`printf matrix`"},
+		{name: "DAG env completion", field: value.DAGEnvCompletionField("field"), want: "`printf matrix`"},
 		{name: "step env", field: value.StepEnvField("field"), want: "`printf matrix`"},
 		{name: "container env", field: value.ContainerEnvField("field"), want: "`printf matrix`"},
 		{name: "dynamic params", field: value.DynamicParamEvalField("field"), want: "matrix"},
```

---

### Incident Patch 9: `b881cd18` (2026-10-03)
**Commit Message**: fix: replay browser recordings as other runs left them (#2986)

**File**: `internal/browserhost/record.go` (modified, +3/-2)
```diff
@@ -77,8 +77,9 @@ type Record struct {
 	// Outputs holds values extracted before the step detached.
 	Outputs map[string]any `json:"outputs,omitempty"`
 	// ReplayPending and ReplayUsed carry the step's replay cache changes
-	// across the wait: the act operations it recorded, kept only if the
-	// step succeeds, and the recordings it replayed, as they were read.
+	// across the wait: the act operations it recorded or dropped, applied
+	// only if the step succeeds, and the recordings it replayed, as they
+	// were read.
 	ReplayPending map[string]json.RawMessage `json:"replayPending,omitempty"`
 	ReplayUsed    map[string]json.RawMessage `json:"replayUsed,omitempty"`
 }
```

**File**: `internal/cmn/replaycache/recordings.go` (modified, +59/-37)
```diff
@@ -32,35 +32,34 @@ const (
 //
 // What the attempt records is kept only once it succeeds, and what it
 // replayed can be dropped when it fails, so a recording that did the wrong
-// thing is not repeated. Every run of the DAG shares the file, so each
-// change is merged into the file as it is then, under a lock.
+// thing is not repeated. Every run of the DAG shares the file, and runs of a
+// step can start together and act one after another, so each lookup reads
+// the file as it is then, and each change is merged into it under a lock.
 type Recordings[T any] struct {
-	path    string
-	mu      sync.Mutex
-	entries map[string]T
-	// pending holds what the attempt recorded, until it succeeds.
-	pending map[string]T
+	path string
+	mu   sync.Mutex
+	// pending holds what the attempt recorded, until it succeeds. A nil
+	// entry removes the recording for its key.
+	pending map[string]*T
 	// used holds the entries the attempt replayed, as they were read.
 	used map[string]T
 }
 
-// Open reads the recordings in the file at path. A missing or corrupt file
-// holds none, since a lost recording only costs model calls.
-func Open[T any](path string) (*Recordings[T], error) {
-	entries, err := read[T](path)
-	if err != nil {
-		return nil, err
-	}
-	return &Recordings[T]{path: path, entries: entries, pending: map[string]T{}, used: map[string]T{}}, nil
+// Open returns an attempt's view of the recordings in the file at path.
+func Open[T any](path string) *Recordings[T] {
+	return &Recordings[T]{path: path, pending: map[string]*T{}, used: map[string]T{}}
 }
 
-// Lookup returns the recording for key and counts it as replayed.
+// Lookup returns the recording for key as the file holds it now and counts
+// it as replayed. A missing, corrupt, or unreadable file holds none, since a
+// lost recording only costs model calls.
 func (r *Recordings[T]) Lookup(key string) (T, bool) {
-	r.mu.Lock()
-	defer r.mu.Unlock()
-	entry, ok := r.entries[key]
+	entries, _ := read[T](r.path)
+	entry, ok := entries[key]
 	if ok {
+		r.mu.Lock()
 		r.used[key] = entry
+		r.mu.Unlock()
 	}
 	return entry, ok
 }
@@ -69,16 +68,33 @@ func (r *Recordings[T]) Lookup(key string) (T, bool) {
 func (r *Recordings[T]) Stage(key string, entry T) {
 	r.mu.Lock()
 	defer r.mu.Unlock()
-	r.pending[key] = entry
+	r.pending[key] = &entry
+}
+
+// Drop marks the recording the attempt looked up for key as one that no
+// longer replays, to be removed by Commit unless another run replaced it
+// since. A later Stage for key takes its place.
+func (r *Recordings[T]) Drop(key string) {
+	r.mu.Lock()
+	defer r.mu.Unlock()
+	r.pending[key] = nil
 }
 
-// Commit keeps what the attempt recorded.
+// Commit keeps what the attempt recorded and removes what it dropped.
 func (r *Recordings[T]) Commit(ctx context.Context) error {
-	pending, _ := r.take()
+	pending, used := r.take()
 	if len(pending) == 0 {
 		return nil
 	}
-	return r.update(ctx, func(entries map[string]T) { maps.Copy(entries, pending) })
+	return r.update(ctx, func(entries map[string]T) {
+		for key, entry := range pending {
+			if entry != nil {
+				entries[key] = *entry
+			} else if replayed, ok := used[key]; ok {
+				removeUnchanged(entries, key, replayed)
+			}
+		}
+	})
 }
 
 // Evict drops the recordings the attempt replayed, unless another run
@@ -89,10 +105,8 @@ func (r *Recordings[T]) Evict(ctx context.Context) error {
 		return nil
 	}
 	return r.update(ctx, func(entries map[string]T) {
-		for key, entry := range used {
-			if current, ok := entries[key]; ok && reflect.DeepEqual(current, entry) {
-				delete(entries, key)
-			}
+		for key, replayed := range used {
+			removeUnchanged(entries, key, replayed)
 		}
 	})
 }
@@ -103,8 +117,8 @@ func (r *Recordings[T]) Discard() {
 	_, _ = r.take()
 }
 
-// Held returns what the attempt recorded and replayed so far, encoded to be
-// carried across a pause for human input.
+// Held returns what the attempt recorded, dropped, and replayed so far,
+// encoded to be carried across a pause for human input.
 func (r *Recordings[T]) Held() (pending, used map[string]json.RawMessage) {
 	r.mu.Lock()
 	defer r.mu.Unlock()
@@ -115,18 +129,26 @@ func (r *Recordings[T]) Held() (pending, used map[string]json.RawMessage) {
 func (r *Recordings[T]) Hold(pending, used map[string]json.RawMessage) {
 	r.mu.Lock()
 	defer r.mu.Unlock()
-	maps.Copy(r.pending, decode[T](pending))
+	maps.Copy(r.pending, decode[*T](pending))
 	maps.Copy(r.used, decode[T](used))
 }
 
-func (r *Recordings[T]) take() (pending, used map[string]T) {
+func (r *Recordings[T]) take() (pending map[string]*T, used map[string]T) {
 	r.mu.Lock()
 	defer r.mu.Unlock()
 	pending, used = r.pending, r.used
-	r.pending, r.used = map[string]T{}, map[string]T{}
+	r.pending, r.used = map[string]*T{}, map[string]T{}
 	return pending, used
 }
 
+// removeUnchanged removes the entry for key unless another run replaced it
+// after the attempt replayed it as replayed.
+func removeUnchanged[T any]
```

**File**: `internal/cmn/replaycache/recordings_test.go` (modified, +89/-34)
```diff
@@ -14,45 +14,41 @@ import (
 	"github.com/stretchr/testify/require"
 )
 
-func openRecordings(t *testing.T, path string) *replaycache.Recordings[string] {
-	t.Helper()
-	recordings, err := replaycache.Open[string](path)
-	require.NoError(t, err)
-	return recordings
+func openRecordings(path string) *replaycache.Recordings[string] {
+	return replaycache.Open[string](path)
 }
 
 // commitRecording writes one entry the way a successful run does.
 func commitRecording(t *testing.T, path, key, entry string) {
 	t.Helper()
-	recordings := openRecordings(t, path)
+	recordings := openRecordings(path)
 	recordings.Stage(key, entry)
 	require.NoError(t, recordings.Commit(context.Background()))
 }
 
-func lookup(t *testing.T, path, key string) (string, bool) {
-	t.Helper()
-	return openRecordings(t, path).Lookup(key)
+func lookup(path, key string) (string, bool) {
+	return openRecordings(path).Lookup(key)
 }
 
 func TestRecordingsKeepOnlyCommitted(t *testing.T) {
 	t.Parallel()
 
 	path := filepath.Join(t.TempDir(), "step.json")
-	recordings := openRecordings(t, path)
+	recordings := openRecordings(path)
 	recordings.Stage("act", "click")
-	_, ok := lookup(t, path, "act")
+	_, ok := lookup(path, "act")
 	assert.False(t, ok, "a staged recording is not visible before commit")
 
 	require.NoError(t, recordings.Commit(context.Background()))
-	entry, ok := lookup(t, path, "act")
+	entry, ok := lookup(path, "act")
 	require.True(t, ok)
 	assert.Equal(t, "click", entry)
 
-	failed := openRecordings(t, path)
+	failed := openRecordings(path)
 	failed.Stage("other", "type")
 	failed.Discard()
 	require.NoError(t, failed.Commit(context.Background()))
-	_, ok = lookup(t, path, "other")
+	_, ok = lookup(path, "other")
 	assert.False(t, ok, "a discarded recording is never written")
 }
 
@@ -62,15 +58,15 @@ func TestRecordingsCommitMergesConcurrentRuns(t *testing.T) {
 	t.Parallel()
 
 	path := filepath.Join(t.TempDir(), "step.json")
-	first := openRecordings(t, path)
-	second := openRecordings(t, path)
+	first := openRecordings(path)
+	second := openRecordings(path)
 	first.Stage("a", "click")
 	second.Stage("b", "type")
 	require.NoError(t, first.Commit(context.Background()))
 	require.NoError(t, second.Commit(context.Background()))
 
 	for key, want := range map[string]string{"a": "click", "b": "type"} {
-		entry, ok := lookup(t, path, key)
+		entry, ok := lookup(path, key)
 		require.True(t, ok, key)
 		assert.Equal(t, want, entry)
 	}
@@ -83,17 +79,17 @@ func TestRecordingsEvictReplayed(t *testing.T) {
 	commitRecording(t, path, "a", "click")
 	commitRecording(t, path, "b", "type")
 
-	failed := openRecordings(t, path)
+	failed := openRecordings(path)
 	_, ok := failed.Lookup("a")
 	require.True(t, ok)
 	failed.Stage("c", "scroll")
 	require.NoError(t, failed.Evict(context.Background()))
 
-	_, ok = lookup(t, path, "a")
+	_, ok = lookup(path, "a")
 	assert.False(t, ok, "the replayed recording is dropped")
-	_, ok = lookup(t, path, "b")
+	_, ok = lookup(path, "b")
 	assert.True(t, ok, "a recording the run did not replay stays")
-	_, ok = lookup(t, path, "c")
+	_, ok = lookup(path, "c")
 	assert.False(t, ok, "what the failed run recorded is not kept")
 }
 
@@ -104,23 +100,77 @@ func TestRecordingsEvictKeepsReplacedEntry(t *testing.T) {
 
 	path := filepath.Join(t.TempDir(), "step.json")
 	commitRecording(t, path, "a", "click")
-	failed := openRecordings(t, path)
+	failed := openRecordings(path)
 	_, ok := failed.Lookup("a")
 	require.True(t, ok)
 	commitRecording(t, path, "a", "double click")
 
 	require.NoError(t, failed.Evict(context.Background()))
-	entry, ok := lookup(t, path, "a")
+	entry, ok := lookup(path, "a")
 	require.True(t, ok)
 	assert.Equal(t, "double click", entry)
 }
 
+// Runs of a step can start together and act one after another, such as
+// foreach items that wait for one browser profile, so a lookup sees what
+// other runs dropped or replaced after this run began.
+func TestRecordingsLookupSeesOtherRuns(t *testing.T) {
+	t.Parallel()
+
+	path := filepath.Join(t.TempDir(), "step.json")
+	commitRecording(t, path, "a", "click")
+	commitRecording(t, path, "b", "click")
+	waiting := openRecordings(path)
+
+	failed := openRecordings(path)
+	_, ok := failed.Lookup("a")
+	require.True(t, ok)
+	require.NoError(t, failed.Evict(context.Background()))
+	commitRecording(t, path, "b", "double click")
+
+	_, ok = waiting.Lookup("a")
+	assert.False(t, ok, "a recording another run dropped is not replayed")
+	entry, ok := waiting.Lookup("b")
+	require.True(t, ok)
+	assert.Equal(t, "double click", entry, "a recording another run replaced is replayed as replaced")
+}
+
+// A recording that no longer replays is dropped once the run that healed it
+// is kept, unless the run recorded what it did instead or another run
+// replaced it.
+func TestRecordingsCommitDropsHealed(t *testing.T) {
+	t.Parallel()
+
+	path := filepath.Join(t.TempDir(), "step.json")
+	for _, key := range []string{"a", "b", "c"} {
+		commitRecording(t, path, 
```

**File**: `internal/computerhost/record.go` (modified, +3/-2)
```diff
@@ -49,8 +49,9 @@ type Record struct {
 	// Outputs holds values extracted before the step paused.
 	Outputs map[string]any `json:"outputs,omitempty"`
 	// ReplayPending and ReplayUsed carry the step's replay cache changes
-	// across the pause: the act operations it recorded, kept only if the
-	// step succeeds, and the recordings it replayed, as they were read.
+	// across the pause: the act operations it recorded or dropped, applied
+	// only if the step succeeds, and the recordings it replayed, as they
+	// were read.
 	ReplayPending map[string]json.RawMessage `json:"replayPending,omitempty"`
 	ReplayUsed    map[string]json.RawMessage `json:"replayUsed,omitempty"`
 }
```

**File**: `internal/runtime/builtin/browser/browser_test.go` (modified, +71/-0)
```diff
@@ -14,6 +14,7 @@ import (
 	"path/filepath"
 	goruntime "runtime"
 	"strings"
+	"sync"
 	"testing"
 	"time"
 
@@ -470,6 +471,76 @@ func TestReplayCommitKeepsClear(t *testing.T) {
 	assert.Equal(t, []string{"goto:completed", "act:completed", "act:cache-hit"}, eventNames(next.exec.GetAgentSession()))
 }
 
+// Runs of a step can start together and act one after another, such as
+// foreach items that wait for one browser profile. An act replays its
+// recording as other runs left it by then: healed, it replays the healed
+// actions; dropped after a failure, it asks the model.
+func TestReplaySeesOtherRuns(t *testing.T) {
+	t.Parallel()
+
+	const (
+		pageURL     = "https://shop.example.com/home"
+		instruction = "Open the receivables screen from the main menu"
+	)
+	steps := fmt.Sprintf(`{"url": %q, "do": [{"act": {"instruction": "Accept the cookies", "cache": false}}, {"act": %q}]}`, pageURL, instruction)
+	run := newTestRun(t, pageModel(nil))
+	require.NoError(t, run.execute(steps, nil).err)
+
+	key := replayKey(1, instruction, pageURL)
+	// otherRun applies change once, as another run of the step that finishes
+	// while this run's first act asks the model.
+	otherRun := func(change func(*replayCache) error) func() {
+		var once sync.Once
+		return func() {
+			once.Do(func() {
+				other := openReplayCache(filepath.Join(run.dataDir, browserhost.DataDirName), "orders", "shop")
+				_, _ = other.Lookup(key)
+				require.NoError(t, change(other))
+			})
+		}
+	}
+
+	healed := []recordedAction{{Selector: "xpath=/html/body/nav/a[3]", Method: "click"}}
+	run.engine.onAct = otherRun(func(other *replayCache) error {
+		other.Stage(key, healed)
+		return other.Commit(t.Context())
+	})
+	replayed := run.execute(steps, nil)
+	require.NoError(t, replayed.err)
+	assert.Equal(t, []string{"goto:completed", "act:completed", "act:cache-hit"}, eventNames(replayed.exec.GetAgentSession()))
+	assert.Equal(t, healed, run.engine.replays)
+
+	run.engine.onAct = otherRun(func(other *replayCache) error { return other.Evict(t.Context()) })
+	dropped := run.execute(steps, nil)
+	require.NoError(t, dropped.err)
+	assert.Equal(t, []string{"goto:completed", "act:completed", "act:completed"}, eventNames(dropped.exec.GetAgentSession()))
+	assert.Len(t, run.engine.replays, 1, "the dropped recording is not replayed")
+}
+
+// A healed act can record nothing, as when its click loads a new document
+// before the act reports back. The recording it healed no longer replays, so
+// it is dropped, and the next run asks the model instead of repeating it.
+func TestHealedActWithoutActionsDropsRecording(t *testing.T) {
+	t.Parallel()
+
+	const steps = `{"url": "https://shop.example.com/login", "do": [{"act": "Click the sign-in button"}]}`
+	run := newTestRun(t, pageModel(nil))
+	require.NoError(t, run.execute(steps, nil).err)
+
+	run.engine.hidden = []string{"xpath=/html/body/button"}
+	run.engine.actNavigatesTo = "https://shop.example.com/orders"
+	run.engine.actLosesPage = 1
+	healed := run.execute(steps, nil)
+	require.NoError(t, healed.err)
+	assert.Equal(t, []string{"goto:completed", "act:healed"}, eventNames(healed.exec.GetAgentSession()))
+
+	run.engine.hidden = nil
+	run.engine.actNavigatesTo = ""
+	next := run.execute(steps, nil)
+	require.NoError(t, next.err)
+	assert.Equal(t, []string{"goto:completed", "act:completed"}, eventNames(next.exec.GetAgentSession()))
+}
+
 // A replayed click that loads a new document can lose the page too. The new
 // document shows the click took effect, so the model does not act again, and
 // the action recorded after it runs on the new document.
```

**File**: `internal/runtime/builtin/browser/cache.go` (modified, +1/-1)
```diff
@@ -17,7 +17,7 @@ import (
 // instruction, and page, so an edited instruction or a different page misses.
 type replayCache = replaycache.Recordings[[]recordedAction]
 
-func openReplayCache(browserDir, dagName, stepKey string) (*replayCache, error) {
+func openReplayCache(browserDir, dagName, stepKey string) *replayCache {
 	return replaycache.Open[[]recordedAction](replaycache.New(browserDir).Path(dagName, stepKey))
 }
 
```

**File**: `internal/runtime/builtin/browser/ops.go` (modified, +4/-3)
```diff
@@ -135,9 +135,7 @@ func newRun(ctx context.Context, e *browserExecutor) (*run, error) {
 		r.variables = map[string]string{}
 	}
 	if e.cfg.cacheEnabled() {
-		if r.cache, err = openReplayCache(browserDir, dagName, stepKey); err != nil {
-			return nil, err
-		}
+		r.cache = openReplayCache(browserDir, dagName, stepKey)
 	}
 	r.timeline = &agentstep.Timeline{Log: e.stderr, Masker: masker, Total: len(e.cfg.Do), Update: e.updateSession, Provider: providerName}
 	return r, nil
@@ -474,6 +472,9 @@ func (r *run) act(ctx context.Context, index int, spec actSpec, timeout time.Dur
 			return nil
 		}
 		status = agentstep.StatusHealed
+		// The recording is dropped unless the act that heals it records what
+		// it did.
+		r.cache.Drop(key)
 		// A recorded action before the miss may have loaded a new document.
 		document, _ = r.eng.DocumentID(ctx)
 	}
```

**File**: `internal/runtime/builtin/computer/act.go` (modified, +3/-0)
```diff
@@ -68,6 +68,9 @@ func (r *run) act(ctx context.Context, index int, spec actSpec, timeout time.Dur
 				return nil
 			}
 			status = agentstep.StatusHealed
+			// The recording is dropped unless the act that heals it records
+			// what it did.
+			r.cache.Drop(key)
 			replayed, spent = entry.Turns[:replay.turns], replay.actions
 		}
 	}
```

---

### Incident Patch 10: `7db7e2a2` (2026-10-03)
**Commit Message**: fix: perform only one action per browser act (#2985)

**File**: `internal/runtime/builtin/browser/stagehand.go` (modified, +32/-2)
```diff
@@ -27,6 +27,11 @@ const extractBatchSource = `async (batch, input) => (await batch.extract(input.i
 
 const telemetryPath = "/v1/traces"
 
+// actResponseFormat names the model answer that picks the element an act
+// instruction describes. The answer's twoStep field makes the runtime ask
+// the model for a second action and perform it too.
+const actResponseFormat = "Act"
+
 const (
 	// pageCallTimeout bounds a page read or screenshot, so a page that stops
 	// responding fails the step instead of hanging it.
@@ -653,12 +658,18 @@ func stagehandGenerate(generate generateFunc) stagehand.LLMGenerateFunc {
 		if err != nil {
 			return stagehand.LLMGenerateResult{}, err
 		}
+		answer := resp.JSON
+		if req.SchemaName == actResponseFormat {
+			if answer, err = singleStep(answer); err != nil {
+				return stagehand.LLMGenerateResult{}, err
+			}
+		}
 		return stagehand.StructuredGenerateResult(stagehand.LLMStructuredGenerateResult{
 			Role: stagehand.LLMRoleAssistant,
 			Content: stagehand.LLMMessageContent{
-				stagehand.TextContentBlock(stagehand.LLMTextContent{Type: "text", Text: string(resp.JSON)}),
+				stagehand.TextContentBlock(stagehand.LLMTextContent{Type: "text", Text: string(answer)}),
 			},
-			StructuredContent: resp.JSON,
+			StructuredContent: answer,
 			Usage: &stagehand.LLMUsage{
 				InputTokens:  resp.Usage.Input,
 				OutputTokens: resp.Usage.Output,
@@ -668,6 +679,25 @@ func stagehandGenerate(generate generateFunc) stagehand.LLMGenerateFunc {
 	}
 }
 
+// singleStep turns off the second action an act answer asks for, so an act
+// performs only the one action its instruction describes. An answer that is
+// not an object is returned unchanged for the runtime to reject.
+func singleStep(answer json.RawMessage) (json.RawMessage, error) {
+	var fields map[string]json.RawMessage
+	if err := json.Unmarshal(answer, &fields); err != nil {
+		return answer, nil
+	}
+	if _, ok := fields["twoStep"]; !ok {
+		return answer, nil
+	}
+	fields["twoStep"] = json.RawMessage("false")
+	single, err := json.Marshal(fields)
+	if err != nil {
+		return nil, fmt.Errorf("encode act answer: %w", err)
+	}
+	return single, nil
+}
+
 func messageText(content stagehand.LLMMessageContent) (string, error) {
 	var text strings.Builder
 	for _, block := range content {
```

**File**: `internal/runtime/builtin/browser/stagehand_test.go` (modified, +53/-0)
```diff
@@ -19,6 +19,7 @@ import (
 	"runtime"
 	"strings"
 	"sync"
+	"sync/atomic"
 	"testing"
 	"time"
 
@@ -244,6 +245,58 @@ func TestStagehandReplayHiddenElement(t *testing.T) {
 	assert.True(t, replayed, "the field outside the dialog is visible")
 }
 
+// menuPage adds an Approve button once its menu is opened.
+const menuPage = `<p id="status">pending</p>
+<button onclick="openMenu()">Open menu</button>
+<script>
+function openMenu() {
+	const approve = document.createElement("button");
+	approve.textContent = "Approve";
+	approve.onclick = () => { document.getElementById("status").textContent = "approved"; };
+	document.body.append(approve);
+}
+</script>`
+
+var menuButtonPattern = regexp.MustCompile(`\[(\d+-\d+)\] button: (Open menu|Approve)`)
+
+// An act performs one action even when the model asks to follow it with
+// another, which the runtime would otherwise ask for and perform as well.
+func TestStagehandActPerformsOneAction(t *testing.T) {
+	t.Parallel()
+
+	var requests atomic.Int32
+	// The model clicks Approve once the page shows it, and Open menu before,
+	// and always asks for a second action.
+	model := func(_ context.Context, req generateRequest) (generateResponse, error) {
+		requests.Add(1)
+		text := ""
+		for _, message := range req.Messages {
+			text += message.Text
+		}
+		buttons := map[string]string{}
+		for _, match := range menuButtonPattern.FindAllStringSubmatch(text, -1) {
+			buttons[match[2]] = match[1]
+		}
+		id, ok := buttons["Approve"]
+		if !ok {
+			id = buttons["Open menu"]
+		}
+		answer := fmt.Sprintf(`{"action":{"elementId":%q,"description":"menu button","method":"click","arguments":[]},"twoStep":true}`, id)
+		return generateResponse{JSON: json.RawMessage(answer)}, nil
+	}
+	eng := launchBrowser(t, launchOptions{Generate: model})
+	require.NoError(t, eng.Goto(t.Context(), "data:text/html,"+url.PathEscape(menuPage), 30*time.Second))
+
+	outcome, err := eng.Act(t.Context(), "Open the menu", nil, time.Minute)
+	require.NoError(t, err)
+	require.True(t, outcome.Success, outcome.Message)
+	assert.Len(t, outcome.Actions, 1)
+	assert.EqualValues(t, 1, requests.Load(), "no model request for a second action")
+	text, err := eng.PageText(t.Context())
+	require.NoError(t, err)
+	assert.Contains(t, text, "pending", "Approve is not clicked")
+}
+
 // The runtime reports a detached page session in a failed act result when
 // the action failed, and as an RPC error when the work around it did. Other
 // failures, including the SDK's own connection errors, are not a lost page.
```

**File**: `llms.txt` (modified, +1/-1)
```diff
@@ -1241,7 +1241,7 @@ steps:
 Browser behavior:
 
 - Each `do` item sets exactly one of `goto`, `act`, `extract`, `expect`, `wait` (`selector` or `duration`), `screenshot`, or `ask`, plus optional `when` (skip unless it holds) and `timeout`.
-- An `act` performs one action: "Sign in with %user% and %password%" types into one field and stops. Write one act per field and one for the button.
+- An `act` performs one action: "Sign in with %user% and %password%" types into one field and stops. Write one act per field and one for the button. A dropdown that is not a native `<select>` takes two acts: one opens it, the next picks the option.
 - `expect` and `when` take a statement the model judges, or a fixed check `{text}`, `{selector}`, or `{url}` that reads the page without a model call. Prefer fixed checks for monitoring; they give the same result on every run. A fixed `when` reads the page once; add `within: 10s` when the page may still be loading.
 - Declare secrets under `secrets:`, pass them in `variables`, and reference them as `%name%`. The browser gets the value, the model only the name. An instruction containing a declared secret value (4+ characters) fails the step; do not write `${SECRET}` inside an instruction. A `%name%` that is not a variable or an earlier `ask.as` fails validation.
 - Model requests carry the instruction, the page's elements and visible text, and the extract schema; never variable values, typed field text, or screenshots. Declared secrets shown on the page are masked; plain variables are not.
```

**File**: `skills/dagu/references/steptypes.md` (modified, +1/-1)
```diff
@@ -1020,7 +1020,7 @@ steps:
 Browser behavior:
 
 - Each `do` item sets exactly one of `goto`, `act`, `extract`, `expect`, `wait` (`selector` or `duration`), `screenshot`, or `ask`, plus optional `when` (skip unless it holds) and `timeout`.
-- An `act` performs one action: "Sign in with %user% and %password%" types into one field and stops. Write one act per field and one for the button.
+- An `act` performs one action: "Sign in with %user% and %password%" types into one field and stops. Write one act per field and one for the button. A dropdown that is not a native `<select>` takes two acts: one opens it, the next picks the option.
 - `expect` and `when` take a statement the model judges, or a fixed check `{text}`, `{selector}`, or `{url}` that reads the page without a model call. Prefer fixed checks for monitoring; they give the same result on every run. A fixed `when` reads the page once; add `within: 10s` when the page may still be loading.
 - Declare secrets under `secrets:`, pass them in `variables`, and reference them as `%name%`. The browser gets the value, the model only the name. An instruction containing a declared secret value (4+ characters) fails the step; do not write `${SECRET}` inside an instruction. A `%name%` that is not a variable or an earlier `ask.as` fails validation.
 - Model requests carry the instruction, the page's elements and visible text, and the extract schema; never variable values, typed field text, or screenshots. Declared secrets shown on the page are masked; plain variables are not.
```

---

### Incident Patch 11: `cf57f569` (2026-10-03)
**Commit Message**: fix(scheduler): log scheduled slots skipped while the DAG is busy (#2980)

Co-authored-by: Yota Hamada <[REDACTED_EMAIL]>

**File**: `internal/service/scheduler/tick_planner.go` (modified, +9/-1)
```diff
@@ -758,10 +758,14 @@ func (tp *TickPlanner) shouldRun(ctx context.Context, dag *ir.DAG, scheduledTime
 		return false
 	}
 	if running {
+		logger.Info(ctx, "Skipping job because the DAG is running",
+			tag.DAG(dag.Name),
+			tag.ScheduledTime(scheduledTime),
+		)
 		return false
 	}
 
-	// Guard 1b: isQueued — prevent live run while a catchup run is queued.
+	// Guard 1b: isQueued, a queued run of any trigger keeps the DAG busy, as a running one does.
 	// On error, conservatively skip (assume busy) to avoid duplicates.
 	queued, qErr := tp.cfg.IsQueued(ctx, dag)
 	if qErr != nil {
@@ -772,6 +776,10 @@ func (tp *TickPlanner) shouldRun(ctx context.Context, dag *ir.DAG, scheduledTime
 		return false
 	}
 	if queued {
+		logger.Info(ctx, "Skipping job because a run of the DAG is queued",
+			tag.DAG(dag.Name),
+			tag.ScheduledTime(scheduledTime),
+		)
 		return false
 	}
 
```

**File**: `internal/service/scheduler/tick_planner_test.go` (modified, +40/-0)
```diff
@@ -4,6 +4,7 @@
 package scheduler
 
 import (
+	"bytes"
 	"context"
 	"errors"
 	"fmt"
@@ -16,6 +17,7 @@ import (
 	"testing"
 	"time"
 
+	"github.com/dagucloud/dagu/v2/internal/cmn/logger"
 	"github.com/dagucloud/dagu/v2/internal/ir"
 	"github.com/dagucloud/dagu/v2/internal/schedulerstate"
 	"github.com/stretchr/testify/assert"
@@ -1074,6 +1076,44 @@ func TestTickPlanner_ShouldRunGuardRunning(t *testing.T) {
 	assert.Len(t, runs, 0, "should not plan run when DAG is already running")
 }
 
+// A slot skipped because its DAG is busy is logged with the DAG and the slot,
+// so the missing run can be traced.
+func TestPlanLogsBusySkip(t *testing.T) {
+	t.Parallel()
+
+	now := time.Date(2026, 2, 7, 12, 0, 0, 0, time.UTC)
+	tests := []struct {
+		name    string
+		running bool
+		queued  bool
+		want    string
+	}{
+		{"Running", true, false, "Skipping job because the DAG is running"},
+		{"Queued", false, true, "Skipping job because a run of the DAG is queued"},
+	}
+	for _, tt := range tests {
+		t.Run(tt.name, func(t *testing.T) {
+			t.Parallel()
+
+			logs := &syncBuffer{buf: new(bytes.Buffer)}
+			ctx := logger.WithFixedLogger(t.Context(), logger.NewLogger(
+				logger.WithFormat("text"), logger.WithWriter(logs),
+			))
+			tp, _ := newTestTickPlanner(&mockStateStore{state: newMockState(now.Add(-time.Minute))})
+			tp.cfg.IsRunning = func(context.Context, *ir.DAG) (bool, error) { return tt.running, nil }
+			tp.cfg.IsQueued = func(context.Context, *ir.DAG) (bool, error) { return tt.queued, nil }
+			dag := &ir.DAG{Name: "busy-dag", Schedule: []ir.Schedule{mustParseSchedule(t, "0 * * * *")}}
+			require.NoError(t, tp.Init(ctx, testDAGEntries(dag)))
+
+			require.Empty(t, tp.Plan(ctx, now))
+			out := logs.String()
+			assert.Contains(t, out, tt.want)
+			assert.Contains(t, out, "dag=busy-dag")
+			assert.Contains(t, out, "scheduled-time=2026-02-07T12:00:00")
+		})
+	}
+}
+
 func TestTickPlanner_PlanStopSchedule(t *testing.T) {
 	t.Parallel()
 
```

---

### Incident Patch 12: `e8af8fad` (2026-10-03)
**Commit Message**: fix: treat hidden browser replay targets as cache misses (#2983)

**File**: `internal/runtime/builtin/browser/browser_test.go` (modified, +23/-0)
```diff
@@ -510,6 +510,29 @@ func TestReplayLosingPageKeepingDocumentAsksModel(t *testing.T) {
 	assert.Equal(t, []string{"goto:completed", "act:healed"}, eventNames(replayed.exec.GetAgentSession()))
 }
 
+// A replay can miss after an earlier recorded action loaded a new document.
+// The model's act is then judged by that document: judged by the one from
+// before the replay, an act that lost the page without taking effect would
+// count as done.
+func TestReplayMissAfterNewDocumentJudgesActByIt(t *testing.T) {
+	t.Parallel()
+
+	const steps = `{"url": "https://shop.example.com/login", "do": [{"act": "Click the sign-in button"}]}`
+	run := newTestRun(t, pageModel(nil))
+	run.engine.twoStepAct = true
+	require.NoError(t, run.execute(steps, nil).err)
+
+	run.engine.replayNavigatesTo = "https://shop.example.com/orders"
+	run.engine.hidden = []string{"xpath=/html/body/button/next"}
+	run.engine.actLosesPage = 1
+	replayed := run.execute(steps, nil)
+	require.NoError(t, replayed.err)
+
+	assert.Len(t, run.engine.replays, 2, "the replay stops at the hidden element")
+	assert.Len(t, run.engine.actInstructions(), 3, "the act that lost the page runs once more")
+	assert.Equal(t, []string{"goto:completed", "act:healed"}, eventNames(replayed.exec.GetAgentSession()))
+}
+
 const loginSteps = `{
 	"do": [
 		{"act": "Sign in"},
```

**File**: `internal/runtime/builtin/browser/engine.go` (modified, +4/-3)
```diff
@@ -30,9 +30,10 @@ type engine interface {
 	// the act reported back; the act may or may not have taken effect.
 	Act(ctx context.Context, instruction string, variables map[string]string, timeout time.Duration) (actOutcome, error)
 	// Replay performs one recorded action without a model call and reports
-	// whether it succeeded. Its error wraps errPageSessionLost when the
-	// connection to the page went away before the action reported back; the
-	// action may or may not have taken effect.
+	// whether it succeeded. An action whose element is not visible is not
+	// performed and does not succeed. Its error wraps errPageSessionLost when
+	// the connection to the page went away before the action reported back;
+	// the action may or may not have taken effect.
 	Replay(ctx context.Context, action recordedAction, variables map[string]string, timeout time.Duration) (bool, error)
 	// DocumentID identifies the document the active page shows. It changes
 	// whenever the page loads a new document.
```

**File**: `internal/runtime/builtin/browser/fakes_test.go` (modified, +13/-2)
```diff
@@ -4,6 +4,7 @@
 package browser
 
 import (
+	"cmp"
 	"context"
 	"encoding/json"
 	"errors"
@@ -58,6 +59,13 @@ type fakeEngine struct {
 	// actNavigatesTo is the page an act or a replay leaves the browser on,
 	// if set.
 	actNavigatesTo string
+	// replayNavigatesTo, if set, is the page a performed replay leaves the
+	// browser on in place of actNavigatesTo, so replays can load a page
+	// while acts do not.
+	replayNavigatesTo string
+	// hidden lists the selectors of recorded actions whose element is on
+	// the page but hidden, so a replay does not perform them.
+	hidden []string
 	// twoStepAct makes acts perform two actions, as a two-step act does.
 	twoStepAct bool
 	// actLosesPage is how many of the next acts lose the connection to the
@@ -192,8 +200,11 @@ func (e *fakeEngine) Replay(_ context.Context, action recordedAction, _ map[stri
 	e.mu.Lock()
 	defer e.mu.Unlock()
 	e.replays = append(e.replays, action)
-	if e.actNavigatesTo != "" {
-		e.load(e.actNavigatesTo)
+	if slices.Contains(e.hidden, action.Selector) {
+		return false, nil
+	}
+	if target := cmp.Or(e.replayNavigatesTo, e.actNavigatesTo); target != "" {
+		e.load(target)
 	}
 	if e.replayLosesPage > 0 {
 		e.replayLosesPage--
```

**File**: `internal/runtime/builtin/browser/ops.go` (modified, +2/-0)
```diff
@@ -474,6 +474,8 @@ func (r *run) act(ctx context.Context, index int, spec actSpec, timeout time.Dur
 			return nil
 		}
 		status = agentstep.StatusHealed
+		// A recorded action before the miss may have loaded a new document.
+		document, _ = r.eng.DocumentID(ctx)
 	}
 	outcome, err := r.performAct(ctx, index, spec.Instruction, document, timeout)
 	if err != nil {
```

**File**: `internal/runtime/builtin/browser/stagehand.go` (modified, +21/-0)
```diff
@@ -323,6 +323,12 @@ func (e *stagehandEngine) Act(ctx context.Context, instruction string, variables
 }
 
 func (e *stagehandEngine) Replay(ctx context.Context, recorded recordedAction, variables map[string]string, timeout time.Duration) (bool, error) {
+	// The runtime types into or fills a hidden element without failing, so
+	// a recorded element that is now hidden, such as a field in a closed
+	// dialog, counts as a miss.
+	if !e.targetVisible(ctx, recorded.Selector) {
+		return false, ctx.Err()
+	}
 	action := stagehand.Action{
 		Selector:    recorded.Selector,
 		Description: recorded.Description,
@@ -346,6 +352,21 @@ func (e *stagehandEngine) Replay(ctx context.Context, recorded recordedAction, v
 	return result.Data.Success, nil
 }
 
+// targetVisible reports whether selector, resolved as a replayed action
+// resolves it, matches a visible element. It reports false when the page
+// cannot tell, including when the page was lost: no action has run yet, so
+// a lost page is a miss, never an action that may have taken effect.
+func (e *stagehandEngine) targetVisible(ctx context.Context, selector string) bool {
+	visible, err := boundCall(ctx, e.pageCallTimeout, func(ctx context.Context) (bool, error) {
+		page, err := e.page(ctx)
+		if err != nil {
+			return false, err
+		}
+		return page.Locator(selector).IsVisible(ctx)
+	})
+	return err == nil && visible
+}
+
 // sessionLost returns an error wrapping errPageSessionLost when an act call
 // that returned result and err failed because the page's session was
 // detached, or nil. The runtime reports that detach in a failed result when
```

**File**: `internal/runtime/builtin/browser/stagehand_test.go` (modified, +21/-0)
```diff
@@ -223,6 +223,27 @@ func TestStagehandActRecordsReplayableActions(t *testing.T) {
 	assert.Equal(t, requests, model.requestCount(), "replay makes no model call")
 }
 
+// A recorded element still on the page but hidden, such as a field in a
+// closed dialog, fails the replay. The runtime would otherwise type into it
+// and report success.
+func TestStagehandReplayHiddenElement(t *testing.T) {
+	t.Parallel()
+
+	eng := launchBrowser(t, launchOptions{Generate: (&shopModel{}).generate})
+	require.NoError(t, eng.Goto(t.Context(), `data:text/html,<dialog><input></dialog><input>`, time.Minute))
+	typeInto := func(selector string) recordedAction {
+		return recordedAction{Selector: selector, Method: "type", Arguments: []string{"10"}}
+	}
+
+	replayed, err := eng.Replay(t.Context(), typeInto("xpath=/html/body/dialog[1]/input[1]"), nil, time.Minute)
+	require.NoError(t, err)
+	assert.False(t, replayed, "the field in the closed dialog is hidden")
+
+	replayed, err = eng.Replay(t.Context(), typeInto("xpath=/html/body/input[1]"), nil, time.Minute)
+	require.NoError(t, err)
+	assert.True(t, replayed, "the field outside the dialog is visible")
+}
+
 // The runtime reports a detached page session in a failed act result when
 // the action failed, and as an RPC error when the work around it did. Other
 // failures, including the SDK's own connection errors, are not a lost page.
```

**File**: `specs/072-browser.md` (modified, +3/-2)
```diff
@@ -187,8 +187,9 @@ With `with.cache` true (the default), a successful `act` records the actions it
 performed. A later run of the same step on the same host replays them without a
 model request when the operation position, instruction, and page URL without
 query or fragment match. When a replay fails, the step asks the model again and
-records the new actions. `act.cache: false` disables the cache for one
-operation.
+records the new actions. A replay fails when a recorded element is gone or is
+on the page but not visible, such as a field in a closed dialog.
+`act.cache: false` disables the cache for one operation.
 
 The cache covers `act` only. `extract` and model-judged conditions make model
 requests on every run. A replay that finds an element at the recorded location
```

---

### Incident Patch 13: `f5e755c9` (2026-10-02)
**Commit Message**: test: fix flaky graceful stop test for repeating steps (#2974)

**File**: `internal/runtime/runner_test.go` (modified, +18/-10)
```diff
@@ -172,6 +172,14 @@ func fileMissingCommand(path string) string {
 	return fmt.Sprintf("test ! -f %s", test.PosixQuote(path))
 }
 
+// gatedCommand creates started and then waits until release exists.
+func gatedCommand(started, release string) string {
+	return createEmptyFileCommand(started) + "; " + test.ForOS(
+		fmt.Sprintf("while [ ! -f %s ]; do sleep 0.05; done", test.PosixQuote(release)),
+		fmt.Sprintf("while (-not (Test-Path %s)) { Start-Sleep -Milliseconds 50 }", test.PowerShellQuote(release)),
+	)
+}
+
 func repeatExpectedCondition(counterFile, expected string) *ir.Condition {
 	return &ir.Condition{Condition: repeatCounterEqualsCommand(counterFile, expected)}
 }
@@ -1229,25 +1237,29 @@ func TestRunner(t *testing.T) {
 		node := result.nodeByName(t, "1")
 		require.Equal(t, 1, node.State().DoneCount)
 	})
+	// The attempt blocks until released so the stop is certain to arrive while
+	// it runs; a running node may not have started its first attempt yet.
 	t.Run("StopRepetitiveTaskGracefully", func(t *testing.T) {
+		dir := t.TempDir()
+		started, release := filepath.Join(dir, "started"), filepath.Join(dir, "release")
 		r := setupRunner(t)
 
 		plan := r.newPlan(t,
 			newStep("1",
-				withCommand("sleep 0.1"),
+				withCommand(gatedCommand(started, release)),
 				withRepeatPolicy(true, time.Millisecond*50),
 			),
 		)
 
-		done := make(chan struct{})
+		running := make(chan bool, 1)
 		go func() {
-			waitForNodeStatus(plan.Plan, "1", ir.NodeRunning, 5*time.Second)
+			running <- waitForFile(started, platformTestDuration(5*time.Second, 30*time.Second))
 			plan.signal(syscall.SIGTERM)
-			close(done)
+			_ = os.WriteFile(release, nil, 0600)
 		}()
 
 		result := plan.assertRun(t, ir.Succeeded)
-		<-done
+		require.True(t, <-running, "attempt did not start")
 
 		result.assertNodeStatus(t, "1", ir.NodeSucceeded)
 	})
@@ -3030,14 +3042,10 @@ func TestRunner_RepeatStopDuringCheck(t *testing.T) {
 		t.Run(tt.name, func(t *testing.T) {
 			dir := t.TempDir()
 			started, release := filepath.Join(dir, "started"), filepath.Join(dir, "release")
-			gate := createEmptyFileCommand(started) + "; " + test.ForOS(
-				fmt.Sprintf("while [ ! -f %s ]; do sleep 0.05; done", test.PosixQuote(release)),
-				fmt.Sprintf("while (-not (Test-Path %s)) { Start-Sleep -Milliseconds 50 }", test.PowerShellQuote(release)),
-			)
 			r := setupRunner(t)
 			plan := r.newPlan(t, newStep("1", tt.action(t), func(step *ir.Step) {
 				step.RepeatPolicy.RepeatMode = ir.RepeatModeWhile
-				step.RepeatPolicy.Condition = &ir.Condition{Condition: gate}
+				step.RepeatPolicy.Condition = &ir.Condition{Condition: gatedCommand(started, release)}
 			}))
 
 			checking := make(chan bool, 1)
```

---

### Incident Patch 14: `be1e6f3d` (2026-10-02)
**Commit Message**: fix: clear replay caches when cleanup deletes all history (#2973)

Co-authored-by: Matt Van Horn <[REDACTED_EMAIL]>

**File**: `internal/cmd/cleanup_test.go` (modified, +212/-0)
```diff
@@ -4,7 +4,9 @@
 package cmd_test
 
 import (
+	"bytes"
 	"fmt"
+	"io"
 	"os"
 	"path/filepath"
 	"testing"
@@ -204,6 +206,159 @@ func TestCleanupCommand(t *testing.T) {
 			Args: []string{"cleanup", "--yes", "non-existent-dag"},
 		})
 	})
+
+	t.Run("ClearsReplayCachesWhenHistoryIsDeleted", func(t *testing.T) {
+		t.Parallel()
+
+		// Default cleanup and explicit zero retention both delete every
+		// completed run, matching `dagu rm --history`, and clear this DAG's
+		// browser and computer replay caches. Another DAG's caches stay.
+		tests := []struct {
+			name string
+			args []string
+		}{
+			{name: "Default", args: []string{"cleanup", "--yes"}},
+			{name: "RetentionZero", args: []string{"cleanup", "--retention-days", "0", "--yes"}},
+		}
+		for _, tt := range tests {
+			t.Run(tt.name, func(t *testing.T) {
+				t.Parallel()
+
+				th := test.SetupCommand(t)
+				dag := completedEchoDAG(t, th)
+				const otherDAG = "other-workflow"
+				seedBothReplayCaches(t, th, dag.Name)
+				seedBothReplayCaches(t, th, otherDAG)
+
+				th.RunCommand(t, cmd.Cleanup(), test.CmdTest{
+					Args: append(tt.args, dag.Name),
+				})
+
+				dag.AssertDAGRunCount(t, 0)
+				assert.Empty(t, browserReplayCacheSteps(t, th, dag.Name))
+				assert.Empty(t, computerReplayCacheSteps(t, th, dag.Name))
+				assert.Equal(t, []string{"login"}, browserReplayCacheSteps(t, th, otherDAG))
+				assert.Equal(t, []string{"post"}, computerReplayCacheSteps(t, th, otherDAG))
+			})
+		}
+	})
+
+	t.Run("PreservesReplayCachesWithRetentionDays", func(t *testing.T) {
+		t.Parallel()
+
+		th := test.SetupCommand(t)
+		dag := completedEchoDAG(t, th)
+		seedBothReplayCaches(t, th, dag.Name)
+
+		th.RunCommand(t, cmd.Cleanup(), test.CmdTest{
+			Args: []string{"cleanup", "--retention-days", "30", "--yes", dag.Name},
+		})
+
+		dag.AssertDAGRunCount(t, 1)
+		assert.Equal(t, []string{"login"}, browserReplayCacheSteps(t, th, dag.Name))
+		assert.Equal(t, []string{"post"}, computerReplayCacheSteps(t, th, dag.Name))
+	})
+
+	t.Run("ClearsReplayCachesWithoutHistory", func(t *testing.T) {
+		t.Parallel()
+
+		// A full-history cleanup still clears seeded caches when there is no
+		// run record to remove.
+		tests := []struct {
+			name string
+			args []string
+		}{
+			{name: "Default", args: []string{"cleanup", "--yes"}},
+			{name: "RetentionZero", args: []string{"cleanup", "--retention-days", "0", "--yes"}},
+		}
+		for _, tt := range tests {
+			t.Run(tt.name, func(t *testing.T) {
+				t.Parallel()
+
+				th := test.SetupCommand(t)
+				const (
+					dagName  = "no-history"
+					otherDAG = "other-workflow"
+				)
+				seedBothReplayCaches(t, th, dagName)
+				seedBothReplayCaches(t, th, otherDAG)
+
+				th.RunCommand(t, cmd.Cleanup(), test.CmdTest{
+					Args: append(tt.args, dagName),
+				})
+
+				assert.Empty(t, browserReplayCacheSteps(t, th, dagName))
+				assert.Empty(t, computerReplayCacheSteps(t, th, dagName))
+				assert.Equal(t, []string{"login"}, browserReplayCacheSteps(t, th, otherDAG))
+				assert.Equal(t, []string{"post"}, computerReplayCacheSteps(t, th, otherDAG))
+			})
+		}
+	})
+
+	t.Run("EmptyReplayCachesAreNoOp", func(t *testing.T) {
+		t.Parallel()
+
+		th := test.SetupCommand(t)
+		const dagName = "empty-caches"
+
+		th.RunCommand(t, cmd.Cleanup(), test.CmdTest{
+			Args: []string{"cleanup", "--yes", dagName},
+		})
+
+		assert.Empty(t, browserReplayCacheSteps(t, th, dagName))
+		assert.Empty(t, computerReplayCacheSteps(t, th, dagName))
+	})
+
+	// Preview lines are printed with fmt.Printf. The command harness records
+	// logs only, so these tests read process stdout and must not run in
+	// parallel.
+	t.Run("DryRunListsReplayCaches", func(t *testing.T) {
+		tests := []struct {
+			name string
+			args []string
+		}{
+			{name: "Default", args: []string{"cleanup", "--dry-run"}},
+			{name: "RetentionZero", args: []string{"cleanup", "--retention-days", "0", "--dry-run"}},
+		}
+		for _, tt := range tests {
+			t.Run(tt.name, func(t *testing.T) {
+				th := test.SetupCommand(t)
+				dag := completedEchoDAG(t, th)
+				seedBothReplayCaches(t, th, dag.Name)
+
+				out := captureStdout(t, func() {
+					th.RunCommand(t, cmd.Cleanup(), test.CmdTest{
+						Args: append(tt.args, dag.Name),
+					})
+				})
+
+				dag.AssertDAGRunCount(t, 1)
+				assert.Equal(t, []string{"login"}, browserReplayCacheSteps(t, th, dag.Name))
+				assert.Equal(t, []string{"post"}, computerReplayCacheSteps(t, th, dag.Name))
+				assert.Contains(t, out, fmt.Sprintf("Dry run: Would delete 1 run(s) for DAG %q:", dag.Name))
+				assert.Contains(t, out, fmt.Sprintf("Dry run: Would also delete browser replay cache for 1 step(s) of DAG %q", dag.Name))
+				assert.Contains(t, out, fmt.Sprintf("Dry run: Would also delete computer replay cache for 1 step(s) of DAG %q", dag.Name))
+			})
+		}
+	})
+
+	t.Run("DryRunWithRetentionDaysOmitsReplayCaches", func(t *testing.T) {
+		th := test.SetupCommand(t)
+		dag := completedEchoDAG(t, th)
+		seedBothReplayCaches(t, th,
```

**File**: `internal/cmd/rm.go` (modified, +7/-3)
```diff
@@ -240,10 +240,14 @@ func previewRm(ctx *Context, opts rmOptions) error {
 	return nil
 }
 
-// removesReplayCaches reports whether rm deletes all of the DAG's history,
-// which also clears the replay caches of its browser and computer steps.
+// removesReplayCaches reports whether the command deletes all of the DAG's
+// history, which also clears the replay caches of its browser and computer
+// steps. A nil retention (rm) and a retention of zero days (cleanup's
+// default) both mean all history. A positive retention or an older-than
+// filter keeps the caches.
 func removesReplayCaches(opts rmOptions) bool {
-	return opts.deleteHist && opts.retentionDays == nil && opts.olderThan == ""
+	allHistory := opts.retentionDays == nil || *opts.retentionDays == 0
+	return opts.deleteHist && opts.olderThan == "" && allHistory
 }
 
 func removeHistory(ctx *Context, opts rmOptions) ([]string, error) {
```

---

### Incident Patch 15: `1ee69be8` (2026-10-01)
**Commit Message**: fix: run coordinator shutdown on SIGINT and SIGTERM (#2972)

**File**: `internal/cmd/coord.go` (modified, +8/-2)
```diff
@@ -10,6 +10,7 @@ import (
 	"log/slog"
 	"net"
 	"os"
+	"syscall"
 
 	"github.com/dagucloud/dagu/v2/internal/cmn/config"
 	"github.com/dagucloud/dagu/v2/internal/cmn/logger"
@@ -96,7 +97,9 @@ var coordinatorFlags = []commandLineFlag{
 }
 
 func runCoordinator(ctx *Context, _ []string) error {
-	coordCtx := ctx.WithEventSource(eventstore.SourceServiceCoordinator)
+	signalCtx, stop := notifyShutdownContext(ctx.Context, syscall.SIGINT, syscall.SIGTERM)
+	defer stop()
+	coordCtx := ctx.WithContext(signalCtx).WithEventSource(eventstore.SourceServiceCoordinator)
 	stores := coordCtx.runtimeStores()
 	svc, _, err := newCoordinator(coordCtx, stores.SecretStore, stores.ProfileStore)
 	if err != nil {
@@ -109,9 +112,12 @@ func runCoordinator(ctx *Context, _ []string) error {
 
 	// Wait for context cancellation
 	<-coordCtx.Done()
+	// Let a second SIGINT end shutdown; SIGTERM stays absorbed.
+	stop()
 	logger.Info(coordCtx, "Coordinator shutting down")
 
-	if err := svc.Stop(coordCtx); err != nil {
+	// coordCtx is done, so shutdown gets the parent context.
+	if err := svc.Stop(ctx.WithEventSource(eventstore.SourceServiceCoordinator)); err != nil {
 		return fmt.Errorf("failed to stop coordinator: %w", err)
 	}
 
```

**File**: `internal/cmd/signal_unix_test.go` (modified, +33/-0)
```diff
@@ -331,6 +331,39 @@ func TestRepeatedTerminateDuringRunCleanup(t *testing.T) {
 	}
 }
 
+// A standalone coordinator must unregister before it exits on a signal.
+func TestCoordinatorSignalShutdown(t *testing.T) {
+	for _, shutdownSignal := range []os.Signal{syscall.SIGTERM, syscall.SIGINT} {
+		t.Run(shutdownSignal.String(), func(t *testing.T) {
+			th := test.SetupCommand(t, test.WithBuiltExecutable())
+			args := test.WithConfigFlag([]string{"coordinator", "--coordinator.port=" + findPort(t), "--coordinator.health-port=0"}, th.Config)
+			command := exec.Command(th.Config.Paths.Executable, args...) //nolint:gosec // Test executes the repository binary.
+			command.Env = th.ChildEnv
+			logFile, err := os.CreateTemp(t.TempDir(), "coordinator-*.log")
+			require.NoError(t, err)
+			t.Cleanup(func() { _ = logFile.Close() })
+			command.Stdout, command.Stderr = logFile, logFile
+			require.NoError(t, command.Start())
+			waitCh := make(chan error, 1)
+			go func() { waitCh <- command.Wait() }()
+			run := &signalRun{th: th, command: command, waitCh: waitCh, logFile: logFile}
+			t.Cleanup(func() {
+				if !run.exited {
+					terminateTestCommand(command, waitCh)
+				}
+			})
+			require.Eventually(t, func() bool {
+				return strings.Contains(run.output(), "Registered with service registry")
+			}, commandLogWaitTimeout(), 20*time.Millisecond, "output: %s", run.output())
+			require.NoError(t, command.Process.Signal(shutdownSignal))
+			require.NoError(t, run.wait(t), "output: %s", run.output())
+			entries, err := os.ReadDir(filepath.Join(th.Config.Paths.ServiceRegistryDir, "coordinator"))
+			require.NoError(t, err)
+			require.Empty(t, entries, "registry entry left behind")
+		})
+	}
+}
+
 func TestSchedulerUnsupportedSignal(t *testing.T) {
 	for _, shutdownSignal := range []os.Signal{syscall.SIGHUP, syscall.SIGQUIT} {
 		t.Run(shutdownSignal.String(), func(t *testing.T) {
```

#### Recent Merged Pull Requests:
- **PR #3022** (2026-10-06): fix(runtime): write PowerShell scripts with a UTF-8 BOM (@yohamta0)
- **PR #3019** (2026-10-05): fix(runtime): decode a non-UTF-8 stderr tail with the console code page (@yohamta0)
- **PR #3018** (2026-10-05): fix(logs): keep UTF-8 log lines under a non-UTF-8 charset (@yohamta0)
- **PR #3015** (2026-10-05): fix(xlsx): defer an update_rows set that holds a reference (@ReguiguiMohamed)
- **PR #3013** (2026-10-04): Show license status and paid feature benefits (@yohamta0)
- **PR #2998** (2026-10-04): feat(workbook): read every Japanese form under a pinned type (@yohamta0)
- **PR #2997** (2026-10-03): feat(xlsx): merge on write_cells, extract cache by labels, Japanese typing, cap and merge coverage (@yohamta0)
- **PR #2996** (2026-10-03): feat(xlsx): refuse an extract listing longer than 200 KB (@yohamta0)

---

## 3. Empirical Evidence & Compliance Certification
- **Evidence Provenance**: Fetched directly from verified official GitHub REST API.
- **Zero Disk Footprint**: 0 bytes of unnecessary repository bloat stored locally.
- **TOS & Free-Tier Adherence**: Request pace complied with public API guidelines without fee, penalty, or unauthorized scraping.

---

## 4. Promotion & Integration Status
- **Status**: HARVESTED_DEEP_FORENSIC
- **Master Brain Sync**: Auto-committed to local/remote Master Brain repository.
