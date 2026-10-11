> **Canonical Learning Artifact**: `07_PROJECT_LEARNING/infisical-infisical-learnings.md`  
> **Source**: github ([https://github.com/Infisical/infisical](https://github.com/Infisical/infisical))  
> **Source Version**: `c40d5fd5`  
> **License**: NOASSERTION  
> **Synthesized By**: zero-clone-structural-synthesizer  
> **Timestamp**: 2026-10-11T15:34:27.062Z  
> **Learning ID**: `learn-github-infisical-infisical-mv3zhkae`  
> **Pipeline Version**: `2.0.0`  
> **Status**: VERIFIED_EMPIRICAL_INTELLIGENCE  
> **Data Governance**: CLASSIFICATION: PUBLIC. Sanitized against PII/secrets.  
> **Policy Invariant**: Strictly for engineering retrieval and architecture documentation. Distillation prohibited.  

---

# Forensic Learning Record (Deep Inspection): Infisical/infisical

> **Canonical Artifact**: `07_PROJECT_LEARNING/infisical-infisical-learnings.md`  
> **Source Platform**: GitHub ([https://github.com/Infisical/infisical](https://github.com/Infisical/infisical))  
> **Harvest Method**: Full-Spectrum Deep Extraction (Patches, Diffs, Source Code, Post-Mortems)  
> **Harvest Timestamp**: 2026-10-11T15:34:25.517Z  
> **Compliance State**: Free Tier Guaranteed | Strict Rate-Limit Backoff Honored  

---

## 1. Context & Architectural Overview
- **Repository / Resource**: `Infisical/infisical`
- **Description**: Infisical is the open-source platform for securing secrets, certificates, access, and AI Agents.
- **Primary Language / Ecosystem**: TypeScript
- **Discovered Manifests / Configurations**: package.json, README.md
- **Stars / Engagement**: 29694 stars

---

## 2. Multi-Dimensional 8-Axis Investigation & Real Code Patches

### D1: Architecture & Structural Boundaries
- Entry configurations inspected via direct stream: package.json, README.md.
- Evaluated system abstractions and modular contracts.

### Core Architecture Module: `backend-go/internal/libs/errutil/defer.go`
```
package errutil

import (
	"context"
	"log/slog"
)

// DeferErr calls fn and logs any returned error at ERROR level.
// Intended for use in defer statements for cleanup functions like
// Rollback, Close, or Unlock where the error is not actionable by the caller.
//
//	defer errutil.DeferErr(ctx, lock.Rollback, "rolling back lock")
func DeferErr(ctx context.Context, fn func() error, msg string) {
	if err := fn(); err != nil {
		slog.ErrorContext(ctx, msg, "error", err)
	}
}

```

### Core Architecture Module: `backend-go/internal/libs/errutil/error.go`
```
package errutil

import "fmt"

// Error is the application-level error returned by services.
// It carries an HTTP-visible name, message, status code, and optional
// structured details. It implements the error interface.
type Error struct {
	// Name is the stable error class name sent in JSON responses (e.g. "NotFound").
	Name string
	// Status is the HTTP status code (e.g. 404).
	Status int
	// Message is the human-readable message sent to the client (4xx only; 5xx are masked).
	Message string
	// Details holds optional structured data (validation errors, policy info, etc.).
	// Omitted from JSON if nil.
	Details any
	// Err is the underlying error, if any. Never exposed to clients.
	Err error
}

func (e *Error) WithName(name string) *Error {
	e.Name = name
	return e
}

func (e *Error) WithStatus(status int) *Error {
	e.Status = status
	return e
}

func (e *Error) WithMessage(message string) *Error {
	e.Message = message
	return e
}

func (e *Error) Error() string {
	if e.Err != nil {
		return e.Message + ": " + e.Err.Error()
	}

	return e.Message
}

func (e *Error) Unwrap() error {
	return e.Err
}

// WithDetails attaches optional structured data to the error.
func (e *Error) WithDetails(details any) *Error {
	e.Details = details

	return e
}

// WithErr wraps an underlying cause. The cause is logged but never sent to clients.
func (e *Error) WithErr(err error) *Error {
	e.Err = err

	return e
}

// WithErrf wraps an underlying cause using fmt.Errorf formatting.
// Use this to add function context: .WithErrf("FunctionName(arg=%s): %w", argValue, err)
func (e *Error) WithErrf(format string, args ...any) *Error {
	e.Err = fmt.Errorf(format, args...)

	return e
}

// BadRequest creates a 400 error.
func BadRequest(format string, args ...any) *Error {
	return &Error{Name: "BadRequest", Status: 400, Message: fmt.Sprintf(format, args...)}
}

// Unauthorized creates a 401 error.
func Unauthorized(format string, args ...any) *Error {
	return &Error{Name: "UnauthorizedError", Status: 401, Message: fmt.Sprintf(format, args...)}
}

// Forbidden creates a 403 error.
func Forbidden(format string, args ...any) *Error {
	return &Error{Name: "ForbiddenError", Status: 403, Message: fmt.Sprintf(format, args...)}
}

// NotFound creates a 404 error.
func NotFound(format string, args ...any) *Error {
	return &Error{Name: "NotFound", Status: 404, Message: fmt.Sprintf(format, args...)}
}

// RateLimit creates a 429 error.
func RateLimit(format string, args ...any) *Error {
	return &Error{Name: "RateLimitExceeded", Status: 429, Message: fmt.Sprintf(format, args...)}
}

// InternalServer creates a 500 error.
func InternalServer(format string, args ...any) *Error {
	return &Error{Name: "InternalServerError", Status: 500, Message: fmt.Sprintf(format, args...)}
}

// DatabaseErr creates a 500 database error.
func DatabaseErr(format string, args ...any) *Error {
	return &Error{Name: "DatabaseError", Status: 500, Message: fmt.Sprintf(format, args...)}
}

// GatewayTimeout creates a 504 error.
func GatewayTimeout(format string, args ...any) *Error {
	return &Error{Name: "GatewayTimeoutError", Status: 504, Message: fmt.Sprintf(format, args...)}
}

```

### Core Architecture Module: `backend-go/internal/libs/errutil/formatter.go`
```
package errutil

import (
	"context"
	"errors"
	"log/slog"
	"net/http"

	"github.com/infisical/api/internal/libs/requestid"
)

// ErrorBody is the JSON response shape sent to clients on error.
// It matches the Node.js backend format for API compatibility.
type ErrorBody struct {
	Code    int    `json:"statusCode"`
	Message string `json:"message"`
	Err     string `json:"error"`
	Details any    `json:"details,omitempty"`
	ReqID   string `json:"reqId,omitempty"`
}

// StatusCode returns the HTTP status code for the error.
func (b *ErrorBody) StatusCode() int {
	return b.Code
}

// FormatError formats an error into an ErrorBody for API responses.
// Service errors (4xx) are logged at WARN level with message sent to client.
// Server errors (5xx) are logged at ERROR level with message masked.
// Unknown errors are logged at ERROR and return 500.
func FormatError(logger *slog.Logger, ctx context.Context, err error) *ErrorBody {
	reqID := requestid.FromContext(ctx)

	var apiErr *Error
	if errors.As(err, &apiErr) {
		if apiErr.Status >= http.StatusInternalServerError {
			logger.ErrorContext(ctx, "server error",
				slog.String("name", apiErr.Name),
				slog.Int("status", apiErr.Status),
				slog.String("message", apiErr.Message),
				slog.Any("cause", apiErr.Err),
			)

			return &ErrorBody{
				Code:    apiErr.Status,
				Message: "Something went wrong",
				Err:     apiErr.Name,
				ReqID:   reqID,
			}
		}

		logger.WarnContext(ctx, "api error",
			slog.String("name", apiErr.Name),
			slog.Int("status", apiErr.Status),
			slog.String("message", apiErr.Message),
			slog.Any("cause", apiErr.Err),
		)

		return &ErrorBody{
			Code:    apiErr.Status,
			Message: apiErr.Message,
			Err:     apiErr.Name,
			Details: apiErr.Details,
			ReqID:   reqID,
		}
	}

	logger.ErrorContext(ctx, "unhandled server error", slog.Any("error", err))

	return &ErrorBody{
		Code:    http.StatusInternalServerError,
		Message: "Something went wrong",
		Err:     "InternalServerError",
		ReqID:   reqID,
	}
}

```

### Core Architecture Module: `backend-go/internal/libs/logutil/context_handler.go`
```
package logutil

import (
	"context"
	"log/slog"

	"github.com/google/uuid"

	"github.com/infisical/api/internal/libs/requestid"
	"github.com/infisical/api/internal/services/auth"
)

// ContextHandler wraps an slog.Handler and enriches every log record
// with values extracted from the context (e.g. request ID, identity info).
type ContextHandler struct {
	inner slog.Handler
}

// NewContextHandler returns a handler that automatically adds the request ID,
// identity info (orgId, actorType, actorId), and any future context values to every log record.
func NewContextHandler(inner slog.Handler) *ContextHandler {
	return &ContextHandler{inner: inner}
}

func (h *ContextHandler) Enabled(ctx context.Context, level slog.Level) bool {
	return h.inner.Enabled(ctx, level)
}

func (h *ContextHandler) Handle(ctx context.Context, r slog.Record) error { //nolint:gocritic // slog.Handler interface requires value receiver
	if reqID := requestid.FromContext(ctx); reqID != "" {
		r.AddAttrs(slog.String("reqId", reqID))
	}

	// Add identity info if available (set by RequireAuth middleware)
	if identity, err := auth.IdentityFromContext(ctx); err == nil && identity != nil {
		if identity.OrgID != uuid.Nil {
			r.AddAttrs(slog.String("orgId", identity.OrgID.String()))
		}
		r.AddAttrs(
			slog.String("actorType", string(identity.Actor)),
			slog.String("actorId", identity.ActorID.String()),
		)
	}

	return h.inner.Handle(ctx, r)
}

func (h *ContextHandler) WithAttrs(attrs []slog.Attr) slog.Handler {
	return &ContextHandler{inner: h.inner.WithAttrs(attrs)}
}

func (h *ContextHandler) WithGroup(name string) slog.Handler {
	return &ContextHandler{inner: h.inner.WithGroup(name)}
}

```

### Core Architecture Module: `backend-go/internal/queue/queue.go`
```
package queue

import (
	"context"
	"encoding/json"
	"fmt"
	"log/slog"
	"time"

	"github.com/hibiken/asynq"
	"github.com/redis/go-redis/v9"
)

// Task represents a typed task definition that ensures payload type safety.
// The generic parameter P defines the expected payload type for this task.
type Task[P any] struct {
	name string
}

// NewTask creates a new typed task definition.
// Usage: var TaskAuditLog = queue.NewTask[auditlog.CreateAuditLogDTO]("audit:log")
func NewTask[P any](name string) Task[P] {
	return Task[P]{name: name}
}

// Name returns the task type name.
func (t Task[P]) Name() string {
	return t.name
}

// EnqueueOpts contains optional parameters for enqueueing a task.
type EnqueueOpts struct {
	maxRetry       *int
	timeout        *time.Duration
	deadline       *time.Time
	uniqueDuration *time.Duration
	queue          *string
	processAt      *time.Time
	processIn      *time.Duration
	retention      *time.Duration
}

// EnqueueOption is a functional option for configuring task enqueueing.
type EnqueueOption func(*EnqueueOpts)

// WithMaxRetry sets the maximum number of retries for a failed task.
func WithMaxRetry(n int) EnqueueOption {
	return func(o *EnqueueOpts) {
		o.maxRetry = &n
	}
}

// WithTimeout sets the timeout duration for task processing.
func WithTimeout(d time.Duration) EnqueueOption {
	return func(o *EnqueueOpts) {
		o.timeout = &d
	}
}

// WithDeadline sets the deadline for task processing.
func WithDeadline(t time.Time) EnqueueOption {
	return func(o *EnqueueOpts) {
		o.deadline = &t
	}
}

// WithUnique ensures only one task with the same payload exists for the given duration.
func WithUnique(d time.Duration) EnqueueOption {
	return func(o *EnqueueOpts) {
		o.uniqueDuration = &d
	}
}

// WithQueue specifies which queue to enqueue the task to.
func WithQueue(name string) EnqueueOption {
	return func(o *EnqueueOpts) {
		o.queue = &name
	}
}

// WithProcessAt schedules the task to be processed at a specific time.
func WithProcessAt(t time.Time) EnqueueOption {
	return func(o *EnqueueOpts) {
		o.processAt = &t
	}
}

// WithProcessIn schedules the task to be processed after the given duration.
func WithProcessIn(d time.Duration) EnqueueOption {
	return func(o *EnqueueOpts) {
		o.processIn = &d
	}
}

// WithRetention sets how long to keep the task in the completed state.
func WithRetention(d time.Duration) EnqueueOption {
	return func(o *EnqueueOpts) {
		o.retention = &d
	}
}

// Handler is a function that processes a task with a typed payload.
type Handler[P any] func(ctx context.Context, payload P) error

// Service provides a type-safe interface for enqueueing and processing tasks.
type Service struct {
	logger      *slog.Logger
	client      *asynq.Client
	server      *asynq.Server
	mux         *asynq.ServeMux
	redisClient redis.UniversalClient
}

// NewService creates a new queue service using an existing Redis client.
func NewService(_ context.Context, logger *slog.Logger, redisClient redis.UniversalClient) *Service {
	client := asynq.NewClientFromRedisClient(redisClient)
	mux := asynq.NewServeMux()

	return &Service{
		logger:      logger.With(slog.String("service", "queue")),
		client:      client,
		mux:         mux,
		redisClient: redisClient,
	}
}

// Enqueue adds a typed task to the queue with the given payload and options.
// The payload type is enforced at compile time via the Task[P] generic parameter.
func Enqueue[P any](ctx context.Context, s *Service, task Task[P], payload P, opts ...EnqueueOption) error {
	if s == nil {
		return fmt.Errorf("enqueue task %s: queue service is nil", task.name)
	}

	options := &EnqueueOpts{}
	for _, opt := range opts {
		opt(options)
	}

	data, err := json.Marshal(payload)
	if err != nil {
		return fmt.Errorf("marshal payload: %w", err)
	}

	asynqOpts := buildAsynqOptions(options)
	asynqTask := asynq.NewTask(task.name, data)

	_, err = s.client.Enqueue(asynqTask, asynqOpts...)
	if err != nil {
		return fmt.Errorf("enqueue task %s: %w", task.name, err)
	}

	s.logger.DebugContext(ctx, "task enqueued", slog.String("task", task.name))
	return nil
}

// RegisterHandler registers a typed handler for a task.
// The handler receives the deserialized payload with compile-time type safety.
func RegisterHandler[P any](s *Service, task Task[P], handler Handler[P]) {
	s.mux.HandleFunc(task.name, func(ctx context.Context, t *asynq.Task) error {
		var payload P
		if err := json.Unmarshal(t.Payload(), &payload); err != nil {
			return fmt.Errorf("unmarshal payload for task %s: %w", task.name, err)
		}
		return handler(ctx, payload)
	})
}

// ServerConfig holds configuration for starting the queue worker.
type ServerConfig struct {
	Concurrency int
	LogLevel    asynq.LogLevel
}

// Start begins processing tasks. This is a blocking call.
func (s *Service) Start(cfg ServerConfig) error {
	concurrency := cfg.Concurrency
	if concurrency <= 0 {
		concurrency = 10
	}

	s.server = asynq.NewServerFromRedisClient(s.redisClient, asynq.Config{
		Concurrency: concurrency,
		LogLevel:    cfg.LogLevel,
		Logger:      newAsynqLogger(s.logger),
	})

	s.logger.InfoContext(context.Background(), "starting queue worker", slog.Int("concurrency", concurrency))
	return s.server.Run(s.mux)
}

// Close shuts down the queue server and closes the client connection.
func (s *Service) Close() error {
	if s.server != nil {
		s.server.Shutdown()
	}
	return s.client.Close()
}

func buildAsynqOptions(opts *EnqueueOpts) []asynq.Option {
	var asynqOpts []asynq.Option

	if opts.maxRetry != nil {
		asynqOpts = append(asynqOpts, asynq.MaxRetry(*opts.maxRetry))
	}
	if opts.timeout != nil {
		asynqOpts = append(asynqOpts, asynq.Timeout(*opts.timeout))
	}
	if opts.deadline != nil {
		asynqOpts = append(asynqOpts, asynq.Deadline(*opts.deadline))
	}
	if opts.uniqueDuration != nil {
		asynqOpts = append(asynqOpts, asynq.Unique(*opts.uniqueDuration))
	}
	if opts.queue != nil {
		asynqOpts = append(asynqOpts, asynq.Queue(*opts.queue))
	}
	if opts.processAt != nil {
		asynqOpts = append(asynqOpts, asynq.ProcessAt(*opts.processAt))
	}
	if opts.processIn != nil {
		asynqOpts = append(asynqOpts, asynq.ProcessIn(*opts.processIn))
	}
	if opts.retention != nil {
		asynqOpts = append(asynqOpts, asynq.Retention(*opts.retention))
	}

	return asynqOpts
}

// asynqLogger adapts slog.Logger to asynq.Logger interface.
type asynqLogger struct {
	logger *slog.Logger
}

func newAsynqLogger(logger *slog.Logger) *asynqLogger {
	return &asynqLogger{logger: logger}
}

func (l *asynqLogger) Debug(args ...any) {
	l.logger.DebugContext(context.Background(), fmt.Sprint(args...))
}

func (l *asynqLogger) Info(args ...any) {
	l.logger.InfoContext(context.Background(), fmt.Sprint(args...))
}

func (l *asynqLogger) Warn(args ...any) {
	l.logger.WarnContext(context.Background(), fmt.Sprint(args...))
}

func (l *asynqLogger) Error(args ...any) {
	l.logger.ErrorContext(context.Background(), fmt.Sprint(args...))
}

func (l *asynqLogger) Fatal(args ...any) {
	l.logger.ErrorContext(context.Background(), fmt.Sprint(args...))
}

```

### Core Architecture Module: `backend-go/internal/queue/tasks.go`
```
package queue

// Task type names are defined here as constants.
// Each task has a corresponding typed Task[P] definition that enforces payload type safety.
const (
	TaskNameAuditLog = "audit:log"
)

```

### Core Architecture Module: `backend-go/internal/services/auditlog/queue_handler.go`
```
package auditlog

import (
	"context"
	"database/sql"
	"encoding/json"
	"fmt"
	"log/slog"
	"time"

	"github.com/google/uuid"
	"github.com/jackc/pgx/v5"

	"github.com/infisical/api/internal/config"
	"github.com/infisical/api/internal/database/pg"
	"github.com/infisical/api/internal/ee/services/license"
	"github.com/infisical/api/internal/keystore"
	"github.com/infisical/api/internal/queue"
	"github.com/infisical/api/internal/services/project"
)

const auditLogClickHouseStreamKey = "audit-log-stream"

// AuditLogRecord represents a single audit log entry for database operations.
type AuditLogRecord struct {
	ID            uuid.UUID
	Actor         string
	ActorMetadata string
	IPAddress     sql.Null[string]
	EventType     string
	EventMetadata sql.Null[string]
	UserAgent     sql.Null[string]
	UserAgentType sql.Null[string]
	ExpiresAt     sql.NullTime
	CreatedAt     time.Time
	UpdatedAt     time.Time
	OrgID         sql.Null[uuid.UUID]
	ProjectID     sql.Null[string]
	ProjectName   sql.Null[string]
}

// normalizeJSONPayload ensures the payload is an object for ClickHouse.
// Arrays are wrapped in {data: [...]}, objects pass through, others become {}.
func normalizeJSONPayload(payload any) any {
	if payload == nil {
		return map[string]any{}
	}

	switch v := payload.(type) {
	case []any:
		return map[string]any{"data": v}
	case map[string]any:
		return v
	default:
		// For structs (like EventMetadata types), return as-is - json.Marshal handles them
		return payload
	}
}

type projectService interface {
	GetByID(ctx context.Context, projectID string) (*project.Project, error)
}

type licenseService interface {
	GetPlan(ctx context.Context, orgID string) (*license.FeatureSet, error)
}

// QueueHandlerDeps holds dependencies for the audit log queue handler.
type QueueHandlerDeps struct {
	DB       pg.DB
	Project  projectService
	License  licenseService
	Config   *config.Config
	KeyStore keystore.KeyStore
}

// QueueHandler processes audit log tasks from the queue.
type QueueHandler struct {
	logger   *slog.Logger
	db       pg.DB
	project  projectService
	license  licenseService
	config   *config.Config
	keyStore keystore.KeyStore
}

// NewQueueHandler creates a new audit log queue handler.
func NewQueueHandler(_ context.Context, logger *slog.Logger, deps *QueueHandlerDeps) *QueueHandler {
	return &QueueHandler{
		logger:   logger.With(slog.String("queue_handler", "auditlog")),
		db:       deps.DB,
		project:  deps.Project,
		license:  deps.License,
		config:   deps.Config,
		keyStore: deps.KeyStore,
	}
}

// Register registers the audit log queue handler with the queue service.
func (h *QueueHandler) Register(queueSvc *queue.Service) {
	queue.RegisterHandler(queueSvc, TaskAuditLog, h.HandleAuditLog)
}

// HandleAuditLog processes a single audit log task.
func (h *QueueHandler) HandleAuditLog(ctx context.Context, dto *CreateAuditLogDTO) error {
	orgID := dto.OrgID
	var proj *project.Project

	if orgID == nil && dto.ProjectID == nil {
		h.logger.ErrorContext(ctx, "audit log task missing orgId and projectId")
		return fmt.Errorf("missing orgId and projectId")
	}

	if orgID == nil && dto.ProjectID != nil {
		var err error
		proj, err = h.project.GetByID(ctx, *dto.ProjectID)
		if err != nil {
			h.logger.ErrorContext(ctx, "failed to find project for audit log",
				slog.String("projectId", *dto.ProjectID),
				slog.Any("error", err),
			)
			return fmt.Errorf("finding project: %w", err)
		}
		if proj != nil {
			orgID = &proj.OrgID
		}
	}

	if orgID == nil {
		h.logger.ErrorContext(ctx, "could not resolve orgId for audit log")
		return fmt.Errorf("could not resolve orgId")
	}

	plan, err := h.license.GetPlan(ctx, orgID.String())
	if err != nil {
		h.logger.ErrorContext(ctx, "failed to get license plan",
			slog.String("orgId", orgID.String()),
			slog.Any("error", err),
		)
		return fmt.Errorf("getting license plan: %w", err)
	}

	if plan.AuditLogsRetentionDays == 0 {
		return nil
	}

	ttlDays := plan.AuditLogsRetentionDays
	// TODO: Check project-level audit log retention override

	now := time.Now()
	expiresAt := now.Add(time.Duration(ttlDays) * 24 * time.Hour)

	actorJSON, err := json.Marshal(dto.Actor.Metadata)
	if err != nil {
		return fmt.Errorf("marshaling actor metadata: %w", err)
	}

	eventJSON, err := json.Marshal(dto.Event.Metadata)
	if err != nil {
		return fmt.Errorf("marshaling event metadata: %w", err)
	}

	// ClickHouse batch mode: push to Redis stream for Node.js batch consumer.
	// Postgres mode: insert directly to database.
	isClickHouseBatchEnabled := h.config.ClickhouseAuditLogEnabled && h.config.IsClickHouseConfigured && h.keyStore != nil

	if isClickHouseBatchEnabled {
		// UUIDv7 embeds timestamp for time-ordered ClickHouse inserts
		id, err := uuid.NewV7()
		if err != nil {
			return fmt.Errorf("generating uuidv7: %w", err)
		}

		// ClickHouse format: empty strings instead of null
		projectID := ""
		if dto.ProjectID != nil {
			projectID = *dto.ProjectID
		}

		streamRecord := map[string]any{
			"id":            id.String(),
			"actor":         string(dto.Actor.Type),
			"actorMetadata": normalizeJSONPayload(dto.Actor.Metadata),
			"ipAddress":     dto.IPAddress,
			"eventType":     string(dto.Event.Type()),
			"eventMetadata": normalizeJSONPayload(dto.Event.Metadata),
			"userAgent":     dto.UserAgent,
			"userAgentType": dto.UserAgentType,
			"projectId":     projectID,
			"orgId":         orgID.String(),
			"expiresAt":     expiresAt,
			"createdAt":     now,
			"updatedAt":     now,
		}

		streamJSON, err := json.Marshal(streamRecord)
		if err != nil {
			return fmt.Errorf("marshaling stream record: %w", err)
		}

		if _, err := h.keyStore.StreamAdd(ctx, auditLogClickHouseStreamKey, "*", map[string]string{
			"data": string(streamJSON),
		}); err != nil {
			h.logger.ErrorContext(ctx, "failed to push audit log to Redis stream",
				slog.String("eventType", string(dto.Event.Type())),
				slog.Any("error", err),
			)
			return fmt.Errorf("pushing to redis stream: %w", err)
		}

		return nil
	}

	// Postgres mode
	var projectName sql.Null[string]
	if proj != nil {
		projectName = sql.Null[string]{V: proj.Name, Valid: true}
	}

	record := &AuditLogRecord{
		ID:            uuid.New(),
		Actor:         string(dto.Actor.Type),
		ActorMetadata: string(actorJSON),
		IPAddress:     toNullStr(dto.IPAddress),
		EventType:     string(dto.Event.Type()),
		EventMetadata: sql.Null[string]{V: string(eventJSON), Valid: true},
		UserAgent:     toNullStr(dto.UserAgent),
		UserAgentType: toNullStr(dto.UserAgentType),
		ExpiresAt:     sql.NullTime{Time: expiresAt, Valid: true},
		CreatedAt:     now,
		UpdatedAt:     now,
		OrgID:         sql.Null[uuid.UUID]{V: *orgID, Valid: true},
		ProjectID:     toNullStrPtr(dto.ProjectID),
		ProjectName:   projectName,
	}

	if !h.config.DisableAuditLogStorage {
		if err := h.createRecord(ctx, record); err != nil {
			h.logger.ErrorContext(ctx, "failed to insert audit log",
				slog.String("eventType", string(dto.Event.Type())),
				slog.Any("error", err),
			)
			return fmt.Errorf("inserting audit log: %w", err)
		}
	}

	return nil
}

func (h *QueueHandler) createRecord(ctx context.Context, record *AuditLogRecord) error {
	query := `
		INSERT INTO audit_logs (
			id, actor, "actorMetadata", "ipAddress", "eventType", "eventMetadata",
			"userAgent", "userAgentType", "expiresAt", "createdAt", "updatedAt",
			"orgId", "projectId", "projectName"
		) VALUES (
			@id, @actor, @actorMetadata, @ipAddress, @eventType, @eventMetadata,
			@userAgent, @userAgentType, @expiresAt, @createdAt, @updatedAt,
			@orgID, @projectID, @projectName
		)
	`
	args := pgx.NamedArgs{
		"id":            record.ID,
		"actor":         record.Actor,
		"actorMetadata": record.ActorMetadata,
		"ipAddress":     record.IPAddress,
		"eventType":     record.EventType,
		"eventMetadata": record.EventMetadata,
		"userAgent":     record.UserAgent,
		"userAgentType": record.UserAgentType,
		"expiresAt":     record.ExpiresAt,
		"createdAt":     record.CreatedAt,
		"updatedAt":     record.UpdatedAt,
		"orgID":         record.OrgID,
		"projectID":     record.ProjectID,
		"projectName":   record.ProjectName,
	}

	_, err := h.db.Primary().Exec(ctx, query, args)
	return err
}

func toNullStr(s string) sql.Null[string] {
	if s == "" {
		return sql.Null[string]{}
	}
	return sql.Null[string]{V: s, Valid: true}
}

func toNullStrPtr(s *string) sql.Null[string] {
	if s == nil || *s == "" {
		return sql.Null[string]{}
	}
	return sql.Null[string]{V: *s, Valid: true}
}

```

### Core Architecture Module: `backend/bdd/features/steps/utils.py`
```
from cryptography import x509
from cryptography.hazmat.primitives import hashes
from cryptography.x509.oid import NameOID
import logging
import re
import contextlib

import httpx
import requests
import requests.structures
import glom
from faker import Faker
from behave.runner import Context
from josepy import JSONObjectWithFields

ACC_KEY_BITS = 2048
ACC_KEY_PUBLIC_EXPONENT = 65537
NOCK_API_PREFIX = "/api/__bdd_nock__"
logger = logging.getLogger(__name__)
faker = Faker()


class AcmeProfile:
    def __init__(self, id: str, eab_kid: str, eab_secret: str):
        self.id = id
        self.eab_kid = eab_kid
        self.eab_secret = eab_secret


def replace_vars(payload: dict | list | int | float | str, vars: dict):
    if isinstance(payload, dict):
        return {
            replace_vars(key, vars): replace_vars(value, vars)
            for key, value in payload.items()
        }
    elif isinstance(payload, list):
        return [replace_vars(item, vars) for item in payload]
    elif isinstance(payload, str):
        return payload.format(**vars)
    else:
        return payload


def parse_glom_path(path_str: str) -> glom.Path:
    """
    Parse a glom path string with 'attr[index]' syntax into a Path object.

    Examples:
    >>> parse_glom_path('authorizations[0]') == Path('authorizations', 0)
    True
    >>> parse_glom_path('data.items[1].name') == Path('data', 'items', 1, 'name')
    True
    >>> parse_glom_path('user.addresses[0].street') == Path('user', 'addresses', 0, 'street')
    True
    """
    parts = []

    # Split by dots, but preserve bracketed content
    tokens = re.split(r"(?<!\[)\.(?![^\[]*\])", path_str)

    for token in tokens:
        token = token.strip()
        if not token:
            continue

        # Check for attr[index] pattern
        match = re.match(r"^(.+?)\[([^\]]+)\]$", token)
        if match:
            attr_name = match.group(1).strip()
            index_str = match.group(2).strip()

            # Parse index (support integers, slices, etc.)
            if index_str.isdigit():
                index = int(index_str)
            elif "-" in index_str:
                # Handle negative indices like [-1]
                index = int(index_str)
            elif ":" in index_str:
                # Handle slices like [0:10]
                index = slice(
                    *map(int, [x.strip() for x in index_str.split(":") if x.strip()])
                )
            else:
                # Treat as string key
                index = index_str

            parts.extend([attr_name, index])
        else:
            # Plain attribute/key
            parts.append(token)

    return glom.Path(*parts)


def eval_var(context: Context, var_path: str, as_json: bool = True):
    parts = var_path.split(".", 1)
    value = context.vars[parts[0]]
    if len(parts) == 2:
        value = glom.glom(value, parse_glom_path(parts[1]))
    if as_json:
        if isinstance(value, JSONObjectWithFields):
            value = value.to_json()
        elif isinstance(value, requests.Response):
            value = value.json()
        elif isinstance(value, requests.structures.CaseInsensitiveDict):
            value = dict(value.lower_items())
        elif isinstance(value, httpx.Response):
            value = value.json()
        elif isinstance(value, x509.Certificate):
            value = x509_cert_to_dict(value)
    return value


def prepare_headers(context: Context) -> dict | None:
    headers = {}
    auth_token = getattr(context, "auth_token", None)
    if auth_token is not None:
        headers["authorization"] = "Bearer {}".format(auth_token)
    if not headers:
        return None
    return headers


def x509_cert_to_dict(cert: x509.Certificate) -> dict:
    """
    Convert a cryptography.x509.Certificate to a JSON-serializable nested dict
    with human-readable keys.
    """

    def oid_to_name(oid):
        # Map known OIDs to human-readable names
        mapping = {
            NameOID.COMMON_NAME: "common_name",
            NameOID.ORGANIZATION_NAME: "organization",
            NameOID.ORGANIZATIONAL_UNIT_NAME: "organizational_unit",
            NameOID.COUNTRY_NAME: "country",
            NameOID.LOCALITY_NAME: "locality",
            NameOID.STATE_OR_PROVINCE_NAME: "state_or_province",
            NameOID.EMAIL_ADDRESS: "email_address",
            NameOID.SERIAL_NUMBER: "serial_number",
            NameOID.SURNAME: "surname",
            NameOID.GIVEN_NAME: "given_name",
            NameOID.TITLE: "title",
            NameOID.JURISDICTION_COUNTRY_NAME: "jurisdiction_country",
            NameOID.JURISDICTION_STATE_OR_PROVINCE_NAME: "jurisdiction_state",
            NameOID.JURISDICTION_LOCALITY_NAME: "jurisdiction_locality",
            NameOID.BUSINESS_CATEGORY: "business_category",
            NameOID.POSTAL_CODE: "postal_code",
            NameOID.STREET_ADDRESS: "street_address",
            NameOID.DOMAIN_COMPONENT: "domain_component",
            NameOID.USER_ID: "user_id",
            # Add more as needed
        }
        return mapping.get(oid, oid.dotted_string)

    def name_to_dict(name: x509.Name) -> dict:
        return {oid_to_name(attr.oid): attr.value for attr in name}

    def dns_to_dict(dns: x509.DNSName) -> dict:
        return dict(value=dns.value)

    def extension_to_dict(ext):
        if isinstance(ext.value, x509.SubjectAlternativeName):
            return {
                "critical": ext.critical,
                "general_names": [dns_to_dict(gn) for gn in ext.value],
            }
        elif isinstance(ext.value, x509.BasicConstraints):
            return {
                "critical": ext.critical,
                "ca": ext.value.ca,
                "path_length": ext.value.path_length,
            }
        elif isinstance(ext.value, x509.KeyUsage):
            return {
                "critical": ext.critical,
                **{
                    field.lower(): getattr(ext.value, field)
                    for field in [
                        "digital_signature",
                        "content_commitment",
                        "key_encipherment",
                        "data_encipherment",
                        "key_agreement",
                        "key_cert_sign",
                        "crl_sign",
                        # TODO: deal with error: "ValueError: encipher_only is undefined unless key_agreement is true"
                        # "encipher_only",
                        # "decipher_only",
                    ]
                    if getattr(ext.value, field) is not None
                },
            }
        elif isinstance(ext.value, x509.ExtendedKeyUsage):
            return {
                "critical": ext.critical,
                "usages": [eku.dotted_string for eku in ext.value],
            }
        elif isinstance(ext.value, x509.CRLDistributionPoints):
            return {
                "critical": ext.critical,
                "distribution_points": [
                    {
                        "full_name": [str(uri) for uri in dp.full_name]
                        if dp.full_name
                        else None,
                        "crl_issuer": [str(issuer) for issuer in dp.crl_issuer]
                        if dp.crl_issuer
                        else None,
                        "reasons": [r.name for r in dp.reasons] if dp.reasons else None,
                    }
                    for dp in ext.value
                ],
            }
        elif isinstance(ext.value, x509.AuthorityKeyIdentifier):
            return {
                "critical": ext.critical,
                "key_identifier": ext.value.key_identifier.hex()
                if ext.value.key_identifier
                else None,
                "authority_cert_issuer": [
                    str(n) for n in ext.value.authority_cert_issuer
                ]
                if ext.value.authority_cert_issuer
                else None,
                "authority_cert_serial_number": ext.value.authority_cert_serial_number,
            }
        elif isinstance(ext.value, x509.SubjectKeyIdentifier):
            return {"critical": ext.critical, "digest": ext.value.digest.hex()}
        else:
            return {
                "critical": ext.critical,
                "oid": ext.oid.dotted_string,
                "value": str(ext.value),
            }

    # Build the main dict
    result = dict(
        version=cert.version.name,
        serial_number=cert.serial_number,
        signature_algorithm=cert.signature_algorithm_oid._name,
        issuer=name_to_dict(cert.issuer),
        subject=name_to_dict(cert.subject),
        validity={
            "not_valid_before": cert.not_valid_before.isoformat(),
            "not_valid_after": cert.not_valid_after.isoformat(),
        },
        public_key={
            "key_size": cert.public_key().key_size,
        },
        extensions={
            ext.oid._name
            if hasattr(ext.oid, "_name") and ext.oid._name
            else ext.oid.dotted_string: extension_to_dict(ext)
            for ext in cert.extensions
        },
        fingerprint={
            "sha1": cert.fingerprint(hashes.SHA1()).hex(),
            "sha256": cert.fingerprint(hashes.SHA256()).hex(),
        },
    )

    return result


def define_nock(context: Context, definitions: list[dict]):
    jwt_token = context.vars["AUTH_TOKEN"]
    response = context.http_client.post(
        f"{NOCK_API_PREFIX}/define",
        headers=dict(authorization="Bearer {}".format(jwt_token)),
        json=dict(definitions=definitions),
    )
    response.raise_for_status()


def restore_nock(context: Context):
    jwt_token = context.vars["AUTH_TOKEN"]
    response = context.http_client.post(
        f"{NOCK_API_PREFIX}/restore",
        headers=dict(authorization="Bearer {}".format(jwt_token)),
        json=dict(),
    )
    response.raise_for_status()


def clean_all_nock(context: Context):
    jwt_token = contex
```

### Core Architecture Module: `backend/src/db/migrations/20231225072552_webhook.ts`
```
import { Knex } from "knex";

import { TableName } from "../schemas";
import { createOnUpdateTrigger, dropOnUpdateTrigger } from "../utils";

export async function up(knex: Knex): Promise<void> {
  if (!(await knex.schema.hasTable(TableName.Webhook))) {
    await knex.schema.createTable(TableName.Webhook, (t) => {
      t.uuid("id", { primaryKey: true }).defaultTo(knex.fn.uuid());
      t.string("secretPath").notNullable().defaultTo("/");
      t.string("url").notNullable();
      t.string("lastStatus");
      t.text("lastRunErrorMessage");
      t.boolean("isDisabled").defaultTo(false).notNullable();
      // webhook signature
      t.text("encryptedSecretKey");
      t.text("iv");
      t.text("tag");
      t.string("algorithm");
      t.string("keyEncoding");
      t.timestamps(true, true, true);
      t.uuid("envId").notNullable();
      t.foreign("envId").references("id").inTable(TableName.Environment).onDelete("CASCADE");
    });
  }
  await createOnUpdateTrigger(knex, TableName.Webhook);
}

export async function down(knex: Knex): Promise<void> {
  await knex.schema.dropTableIfExists(TableName.Webhook);
  await dropOnUpdateTrigger(knex, TableName.Webhook);
}

```

### Core Architecture Module: `backend/src/db/migrations/20240702055253_add-encrypted-webhook-url.ts`
```
import { Knex } from "knex";

import { WebhookType } from "@app/services/webhook/webhook-types";

import { TableName } from "../schemas";

export async function up(knex: Knex): Promise<void> {
  const hasUrlCipherText = await knex.schema.hasColumn(TableName.Webhook, "urlCipherText");
  const hasUrlIV = await knex.schema.hasColumn(TableName.Webhook, "urlIV");
  const hasUrlTag = await knex.schema.hasColumn(TableName.Webhook, "urlTag");
  const hasType = await knex.schema.hasColumn(TableName.Webhook, "type");

  if (await knex.schema.hasTable(TableName.Webhook)) {
    await knex.schema.alterTable(TableName.Webhook, (tb) => {
      if (!hasUrlCipherText) {
        tb.text("urlCipherText");
      }
      if (!hasUrlIV) {
        tb.string("urlIV");
      }
      if (!hasUrlTag) {
        tb.string("urlTag");
      }
      if (!hasType) {
        tb.string("type").defaultTo(WebhookType.GENERAL);
      }
    });
  }
}

export async function down(knex: Knex): Promise<void> {
  const hasUrlCipherText = await knex.schema.hasColumn(TableName.Webhook, "urlCipherText");
  const hasUrlIV = await knex.schema.hasColumn(TableName.Webhook, "urlIV");
  const hasUrlTag = await knex.schema.hasColumn(TableName.Webhook, "urlTag");
  const hasType = await knex.schema.hasColumn(TableName.Webhook, "type");

  if (await knex.schema.hasTable(TableName.Webhook)) {
    await knex.schema.alterTable(TableName.Webhook, (t) => {
      if (hasUrlCipherText) {
        t.dropColumn("urlCipherText");
      }
      if (hasUrlIV) {
        t.dropColumn("urlIV");
      }
      if (hasUrlTag) {
        t.dropColumn("urlTag");
      }
      if (hasType) {
        t.dropColumn("type");
      }
    });
  }
}

```

### Core Architecture Module: `backend/src/db/migrations/20250210101840_webhook-to-kms.ts`
```
/* eslint-disable no-restricted-syntax -- Historical: predates kms_legacy_encryption_keys, has already
   run everywhere, and on a fresh install runs against empty tables before a rotation is possible. */
import { Knex } from "knex";

import { inMemoryKeyStore } from "@app/keystore/memory";
import { crypto } from "@app/lib/crypto/cryptography";
import { initLogger } from "@app/lib/logger";
import { kmsRootConfigDALFactory } from "@app/services/kms/kms-root-config-dal";
import { KmsDataKey } from "@app/services/kms/kms-types";
import { superAdminDALFactory } from "@app/services/super-admin/super-admin-dal";

import { SecretKeyEncoding, TableName } from "../schemas";
import { getMigrationEnvConfig, getMigrationHsmConfig } from "./utils/env-config";
import { createCircularCache } from "./utils/ring-buffer";
import { getMigrationEncryptionServices, getMigrationHsmService } from "./utils/services";

const BATCH_SIZE = 500;
export async function up(knex: Knex): Promise<void> {
  const hasEncryptedKey = await knex.schema.hasColumn(TableName.Webhook, "encryptedPassKey");
  const hasEncryptedUrl = await knex.schema.hasColumn(TableName.Webhook, "encryptedUrl");
  const hasUrl = await knex.schema.hasColumn(TableName.Webhook, "url");

  const hasWebhookTable = await knex.schema.hasTable(TableName.Webhook);
  if (hasWebhookTable) {
    await knex.schema.alterTable(TableName.Webhook, (t) => {
      if (!hasEncryptedKey) t.binary("encryptedPassKey");
      if (!hasEncryptedUrl) t.binary("encryptedUrl");
      if (hasUrl) t.string("url").nullable().alter();
    });
  }
  initLogger();

  const { hsmService } = await getMigrationHsmService({ envConfig: getMigrationHsmConfig() });
  const superAdminDAL = superAdminDALFactory(knex);
  const kmsRootConfigDAL = kmsRootConfigDALFactory(knex);
  const envConfig = await getMigrationEnvConfig(superAdminDAL, hsmService, kmsRootConfigDAL);

  const keyStore = inMemoryKeyStore();
  const { kmsService } = await getMigrationEncryptionServices({ envConfig, keyStore, db: knex });

  const projectEncryptionRingBuffer =
    createCircularCache<Awaited<ReturnType<(typeof kmsService)["createCipherPairWithDataKey"]>>>(25);
  const webhooks = await knex(TableName.Webhook)
    .where({})
    .join(TableName.Environment, `${TableName.Environment}.id`, `${TableName.Webhook}.envId`)
    .select(
      "url",
      "encryptedSecretKey",
      "iv",
      "tag",
      "keyEncoding",
      "urlCipherText",
      "urlIV",
      "urlTag",
      knex.ref("id").withSchema(TableName.Webhook),
      "envId"
    )
    .select(knex.ref("projectId").withSchema(TableName.Environment))
    .orderBy(`${TableName.Environment}.projectId` as "projectId");

  const updatedWebhooks = await Promise.all(
    webhooks.map(async (el) => {
      let projectKmsService = projectEncryptionRingBuffer.getItem(el.projectId);
      if (!projectKmsService) {
        projectKmsService = await kmsService.createCipherPairWithDataKey(
          {
            type: KmsDataKey.SecretManager,
            projectId: el.projectId
          },
          knex
        );
        projectEncryptionRingBuffer.push(el.projectId, projectKmsService);
      }

      let encryptedSecretKey = null;
      if (el.encryptedSecretKey && el.iv && el.tag && el.keyEncoding) {
        const decyptedSecretKey = crypto
          .encryption()
          .symmetric()
          .decryptWithRootEncryptionKey({
            keyEncoding: el.keyEncoding as SecretKeyEncoding,
            iv: el.iv,
            tag: el.tag,
            ciphertext: el.encryptedSecretKey
          });
        encryptedSecretKey = projectKmsService.encryptor({
          plainText: Buffer.from(decyptedSecretKey, "utf8")
        }).cipherTextBlob;
      }

      const decryptedUrl =
        el.urlIV && el.urlTag && el.urlCipherText && el.keyEncoding
          ? crypto
              .encryption()
              .symmetric()
              .decryptWithRootEncryptionKey({
                keyEncoding: el.keyEncoding as SecretKeyEncoding,
                iv: el.urlIV,
                tag: el.urlTag,
                ciphertext: el.urlCipherText
              })
          : null;

      const encryptedUrl = projectKmsService.encryptor({
        plainText: Buffer.from(decryptedUrl || el.url || "")
      }).cipherTextBlob;
      return { id: el.id, encryptedUrl, encryptedSecretKey, envId: el.envId };
    })
  );

  for (let i = 0; i < updatedWebhooks.length; i += BATCH_SIZE) {
    // eslint-disable-next-line no-await-in-loop
    await knex(TableName.Webhook)
      .insert(
        updatedWebhooks.slice(i, i + BATCH_SIZE).map((el) => ({
          id: el.id,
          envId: el.envId,
          url: "",
          encryptedUrl: el.encryptedUrl,
          encryptedPassKey: el.encryptedSecretKey
        }))
      )
      .onConflict("id")
      .merge();
  }

  if (hasWebhookTable) {
    await knex.schema.alterTable(TableName.Webhook, (t) => {
      if (!hasEncryptedUrl) t.binary("encryptedUrl").notNullable().alter();
    });
  }
}

export async function down(knex: Knex): Promise<void> {
  const hasEncryptedKey = await knex.schema.hasColumn(TableName.Webhook, "encryptedPassKey");
  const hasEncryptedUrl = await knex.schema.hasColumn(TableName.Webhook, "encryptedUrl");

  const hasWebhookTable = await knex.schema.hasTable(TableName.Webhook);
  if (hasWebhookTable) {
    await knex.schema.alterTable(TableName.Webhook, (t) => {
      if (hasEncryptedKey) t.dropColumn("encryptedPassKey");
      if (hasEncryptedUrl) t.dropColumn("encryptedUrl");
    });
  }
}

```

### Core Architecture Module: `backend/src/db/migrations/20260203141935_durable-queue.ts`
```
/* eslint-disable no-console */
import { Knex } from "knex";

import { QueueJobs, QueueName } from "@app/queue";

import { createOnUpdateTrigger, dropOnUpdateTrigger } from "../utils";

// Inlined because QueueJobsTable was removed when the queue_jobs table was dropped.
const QueueJobsTable = "queue_jobs";

interface MigrationConfig<TData> {
  pgBossQueueName: string;
  queueName: string;
  queueJobName: string;
  logLabel: string;
  transformJob: (job: { id: string; data: TData; start_after: Date }) => {
    jobId: string;
    queueOptions: Record<string, unknown>;
  };
}

const migratePgBossJobsToQueueJobs = async <TData>(knex: Knex, config: MigrationConfig<TData>): Promise<void> => {
  const jobs = await knex.raw<{ rows: { id: string; name: string; data: TData; start_after: Date }[] }>(
    `
      SELECT id, name, data, start_after
      FROM pgboss.job
      WHERE state = 'created'
        AND name = ?
      ORDER BY created_on ASC
    `,
    [config.pgBossQueueName]
  );
  if (jobs.rows.length > 0) {
    await knex(QueueJobsTable).insert(
      jobs.rows.map((job) => {
        const { jobId, queueOptions } = config.transformJob(job);
        return {
          queueName: config.queueName,
          queueJobName: config.queueJobName,
          queueType: "bullmq",
          queueData: job.data,
          jobId,
          queueOptions
        };
      })
    );

    console.log(`Migrated ${config.logLabel} ${jobs.rows.length} jobs`);
  }
};

const migratePamSessionExpirationToQueueJobs = async (knex: Knex) => {
  await migratePgBossJobsToQueueJobs<{ sessionId: string }>(knex, {
    pgBossQueueName: QueueName.PamSessionExpiration,
    queueName: QueueName.PamSessionExpiration,
    queueJobName: QueueJobs.PamSessionExpiration,
    logLabel: "pam session expiration",
    transformJob: (job) => ({
      jobId: `pam-session-expiration-${job.data?.sessionId}`,
      queueOptions: {
        jobId: `pam-session-expiration-${job.data?.sessionId}`,
        delay: Math.max(0, new Date(job.start_after).getTime() - Date.now())
      }
    })
  });
};

const migrateDynamicSecretRevocationToQueueJobs = async (knex: Knex) => {
  await migratePgBossJobsToQueueJobs<{ leaseId: string; dynamicSecretId: string }>(knex, {
    pgBossQueueName: QueueName.DynamicSecretRevocation,
    queueName: QueueName.DynamicSecretRevocation,
    queueJobName: QueueJobs.DynamicSecretRevocation,
    logLabel: "dynamic secret revocation",
    transformJob: (job) => ({
      jobId: job.data.leaseId,
      queueOptions: {
        jobId: job.data.leaseId,
        delay: Math.max(0, new Date(job.start_after).getTime() - Date.now()),
        attempts: 3,
        backoff: {
          type: "exponential",
          delay: 1000 * 60 // 1 minute
        }
      }
    })
  });
};

export async function up(knex: Knex): Promise<void> {
  const hasTable = await knex.schema.hasTable(QueueJobsTable);
  if (!hasTable) {
    await knex.schema.createTable(QueueJobsTable, (t) => {
      t.uuid("id", { primaryKey: true }).defaultTo(knex.fn.uuid());
      t.string("queueName").notNullable();
      // helps in golang migration
      t.string("queueType").notNullable().defaultTo("bullmq");
      t.string("queueJobName").notNullable();
      t.string("jobId").notNullable();
      t.jsonb("queueData").notNullable();
      t.jsonb("queueOptions");
      t.string("status").notNullable().defaultTo("pending");

      t.integer("attempts").notNullable().defaultTo(0);
      t.integer("maxAttempts").notNullable().defaultTo(3);
      t.string("errorMessage", 1000);
      t.datetime("lastHeartBeat");
      t.datetime("startedAt");
      t.datetime("completedAt");
      t.timestamps(true, true, true);

      // Indexes for query optimization
      t.index(["queueName", "status", "createdAt"]);
      t.index(["jobId", "queueName"]);
      t.index(["status"]);
    });

    await createOnUpdateTrigger(knex, QueueJobsTable);
    const schemaCheck = await knex.raw(
      `SELECT EXISTS (SELECT 1 FROM information_schema.schemata WHERE schema_name = 'pgboss') AS exists`
    );

    if (schemaCheck?.rows[0]?.exists) {
      await migratePamSessionExpirationToQueueJobs(knex);
      await migrateDynamicSecretRevocationToQueueJobs(knex);
    }
  }
}

export async function down(knex: Knex): Promise<void> {
  const hasTable = await knex.schema.hasTable(QueueJobsTable);
  if (hasTable) await knex.schema.dropTable(QueueJobsTable);
  await dropOnUpdateTrigger(knex, QueueJobsTable);
}

```


### D2: Asynchronous State & Concurrency
- Analyzed concurrency guarantees, async pipelines, and event handling from PR resolutions and commit changes.

### D3: Error Boundaries, Recovery & Rollbacks
- Exception handling patterns and defect resolutions extracted from closed production bug issues:
- **Issue #4347** (2025-08-11): **Duplicate k8s secrets-operator labels**
  *Symptoms*: ### Describe the bug The labels used in secrets-operator controller-manager's Deployment and metrics Service contain duplicate entries for `app.kubernetes.io/name`.   This conflict causes FluxCD to completely break when using this chart as a HelmRelease, saying that the labels cannot be specified multiple times.  The issue is only present in the 0.10.0 release of the chart due to the changes made in https://github.com/Infisical/infisical/commit/2d68f9aa16a23f48e832c0088af448e55d04a478. After templating, helm includes labels from `secrets-operator.selectorLabels` set in _helpers.tpl, which also contain the conflicting label.  ### To Reproduce Steps to reproduce the behavior: 1. Install secrets-operator as a FluxCD HelmRelease with the default values 2. Observe errors in reconciliation due to conflicting labels  Alternative steps: 1. `helm repo add infisical 'https://dl.cloudsmith.io/public/infisical/helm-charts/helm/charts/'` 2. `helm repo update` 3. `helm template infisical-test infisical/secrets-operator > out.yaml` 4. Observe duplicate `app.kubernetes.io/name` labels in:   - `infisical-test-controller-manager-metrics-service -> spec.selector.*`   - `infisical-test-controller-manager -> spec.selector.matchLabels.*`   - `infisical-test-controller-manager -> spec.template.metadata.labels.*`  ### Expected behavior Non-duplicated labels in the templated k8s resources.  ### Platform you are having the issue on: - All platforms  ### Additional context The FluxCD's Helm controller 
  **Post-Mortem & Fix Analysis**:
  > Hi @KundaPanda,  Thank for the detailed analysis, we are looking into this issue and will get back to you.
  > Hi @KundaPanda, apologies for the inconvenience caused by this! We've rolled out a new patch (0.10.1) that should resolve this issue. Could I please have you try to upgrade to that version? Thanks!
  > I can confirm the issue is now fixed. Thank you very much for your work!

- **Issue #3333** (2025-04-04): **Intermediate certificate signed by external CA not trusted**
  *Symptoms*: ### Describe the bug  An intermediate certificate chained to an external CA does not expose the X509v3 Basic Constrain CA:TRUE. This is necessary to be trusted by openssl and webbrowsers.  (see e.g. https://stackoverflow.com/a/53951346)  ### To Reproduce Steps to reproduce the behavior: 1. Issue an intermediate CA chained to an external CA, as described in https://infisical.com/docs/documentation/platform/pki/private-ca) 2. Sign the CSR by the external CA and install Intermediate CA certificate 3. Issue an end certificate signed by the intermediate certificate 4. Place the chain bundle and key in the webserver, eg. nginx and reload  This will cause error: [SEC_ERROR_CA_CERT_INVALID]  It shows all my certificates (end-certificate, intermediate and root), so the bundle is complete  When running `openssl s_client --connect monitor.hel.lan:443 -showcerts -CAfile rootca.crt`  I get ``` depth=1 C=DE, O=home, CN=intermediate CA homelab 2 verify error:num=79:invalid CA certificate verify return:1 depth=2 C=DE, L=Ried, O=home, CN=ACME root CA verify return:1 depth=1 C=DE, O=home, CN=intermediate CA homelab 2 verify return:1 depth=0 CN=monitor.hel.lan verify return:1 --- ```  ### Expected behavior Since my root certificate is trusted, I expect no trust issues  ### Screenshots If applicable, add screenshots to help explain your problem.  ### Platform you are having the issue on: Linux. Infisical running in docker  ### Additional context I could probably add the infisical intermediate ce
  **Post-Mortem & Fix Analysis**:
  > Hey @gador!  Which external certificate authority are you using to sign the CSR of the intermediate CA you're installing?  You’ll typically need to configure this on the external CA side — either by specifying a particular profile, template, or OpenSSL config — to ensure the generated certificate from the CSR is marked as a CA.
  > > Which external certificate authority are you using to sign the CSR of the intermediate CA you're installing?  I'm using [xca](https://hohnstaedt.de/xca/)  > You’ll typically need to configure this on the external CA side — either by specifying a particular profile, template, or OpenSSL config — to ensure the generated certificate from the CSR is marked as a CA.  I signed this using my root certificate and let it copy all the requested extensions from the CSR. I can then re-import the certificate from that CSR but have the above problems. If I tell xca to specifically add CA:TRUE (which is marked as not defined by the CSR) and then try to re-import it into infisical I am getting an error:  ![Image](https://github.com/user-attachments/assets/a2445a5d-c1b7-40c8-a0df-9e73cdd66e22)  So I cannot add the CA:TRUE constrain.  If you want I can retry with pure openssl. Do you have a specific command I should try to trouble shoot?    EDIT:  Here is the CSR from infisical: ``` Certificate Reques
  > As a comparison this is the same certificate, but signed by infisical:  ``` Certificate:     Data:         Version: 3 (0x2)         Serial Number:             1c:b5:21:4d:0b:79:01:36:1c:76:af:9d:d0:16:f7:69:85:24:7f:6e         Signature Algorithm: sha256WithRSAEncryption         Issuer: C=DE, O=home, CN=test intermediate         Validity             Not Before: Apr  3 10:26:40 2025 GMT             Not After : Aug 11 00:00:00 2026 GMT         Subject: C=DE, O=home, CN=intermediate CA homelab         Subject Public Key Info:             Public Key Algorithm: rsaEncryption                 Public-Key: (2048 bit)                 Modulus:                     00:bf:e0:f3:a0:93:a2:c8:c1:fc:78:0b:25:ed:2e:                     16:2c:1a:6f:0d:d7:09:82:83:3d:08:5e:2e:74:49:                     ae:d9:65:77:30:7d:06:d6:92:aa:74:c9:05:dd:82:                     0c:ea:44:4c:e4:ac:45:e4:9e:9d:b0:62:6b:98:9d:                     78:4e:a3:00:89:04:01:94:28:55:fd:5f:7c:d6:30:                     89:2c:bf:

- **Issue #2793** (2024-11-26): **feat: resolved saml failing when signup is disabled**
  *Symptoms*: # Description 📣  This PR resolves signup failing via SAML when you sign up disabled. Now we allow signup via saml and it only affects normal email  ## Type ✨  - [ ] Bug fix - [ ] New feature - [ ] Improvement - [ ] Breaking change - [ ] Documentation  # Tests 🛠️  <!-- Please describe the tests that you ran to verify your changes. Provide instructions so we can reproduce. Please also list any relevant details for your test configuration. You may want to add screenshots when relevant and possible -->  ```sh # Here's some code block to paste some code snippets ```  ---  - [x] I have read the [contributing guide](https://infisical.com/docs/contributing/getting-started/overview), agreed and acknowledged the [code of conduct](https://infisical.com/docs/contributing/getting-started/code-of-conduct). 📝  <!-- If you have any questions regarding contribution, here's the FAQ : https://infisical.com/docs/contributing/getting-started/faq -->

- **Issue #2518** (2024-10-01): **feat: increase select width in org access control page and added overflow bounding for select**
  *Symptoms*: # Description 📣  1. Increased width for all the select in org access control 2. Added text overflow changes for select  3. Fixed org role page overflow  ![Screenshot 2024-10-01 at 12 25 46 AM](https://github.com/user-attachments/assets/a2628b4e-e8a1-426d-9f24-9dc7f897932b)  ![Screenshot 2024-10-01 at 12 33 58 AM](https://github.com/user-attachments/assets/8b7ca706-04b6-407f-a0a7-d5b5764f2704)   ## Type ✨  - [x] Bug fix - [ ] New feature - [ ] Breaking change - [ ] Documentation  # Tests 🛠️  <!-- Please describe the tests that you ran to verify your changes. Provide instructions so we can reproduce. Please also list any relevant details for your test configuration. You may want to add screenshots when relevant and possible -->  ```sh # Here's some code block to paste some code snippets ```  ---  - [ ] I have read the [contributing guide](https://infisical.com/docs/contributing/getting-started/overview), agreed and acknowledged the [code of conduct](https://infisical.com/docs/contributing/getting-started/code-of-conduct). 📝  <!-- If you have any questions regarding contribution, here's the FAQ : https://infisical.com/docs/contributing/getting-started/faq -->

- **Issue #2488** (2024-09-26): **fix: dashboard not showing when root accessn not provided**
  *Symptoms*: # Description 📣   Fix for dashboard and overview not able to access when root folder access not provided  ## Type ✨  - [x] Bug fix - [ ] New feature - [ ] Breaking change - [ ] Documentation  # Tests 🛠️  <!-- Please describe the tests that you ran to verify your changes. Provide instructions so we can reproduce. Please also list any relevant details for your test configuration. You may want to add screenshots when relevant and possible -->  ```sh # Here's some code block to paste some code snippets ```  ---  - [ ] I have read the [contributing guide](https://infisical.com/docs/contributing/getting-started/overview), agreed and acknowledged the [code of conduct](https://infisical.com/docs/contributing/getting-started/code-of-conduct). 📝  <!-- If you have any questions regarding contribution, here's the FAQ : https://infisical.com/docs/contributing/getting-started/faq -->

- **Issue #2346** (2024-09-16): **PKI generated certificates are not considered as trusted even if root CA added to the trust store. **
  *Symptoms*: ### Describe the bug When creating certificate with the new PKI feature, the certificate are not valid for Chrome but are OK for Safari.  ### To Reproduce Steps to reproduce the behavior: 1. Create a CA 2. Create Certificate with SANs (fqdn only as IP Addresses are not valid in the field) 3. Get both root CA and server certificate 4. Import the Root CA into the keychain and set the Trust to "Always Trust" 5. Set the private key and cert to the server 6. Add the entry in /etc/hosts to match fqdn 7. Browse to the server fqdn  ### Expected behavior I expect the certificate to be trusted by my browser  ### Screenshots If applicable, add screenshots to help explain your problem.  ### Platform you are having the issue on: I'm using Infisical self-hosted with version 0.80.0-postgres  ### Additional context  It work on Safari.   With Firefox:      Warning: Potential Security Risk Ahead     but I can accept the exception and continue browsing           With Chrome, browsing is not possible:     server.local normally uses encryption to protect your information. When Chrome tried to connect to server.local this time, the website sent back unusual and incorrect credentials. This may happen when an attacker is trying to pretend to be server.local, or a Wi-Fi sign-in screen has interrupted the connection. Your information is still secure because Chrome stopped the connection before any data was exchanged.  You cannot visit server.local right now because t
  **Post-Mortem & Fix Analysis**:
  > Thanks for raising this issue @pdomineaux.  I'll be looking into this as we continue working on the new PKI feature — I don't have an estimated time frame for resolution yet given there're a lot of ongoing development but will keep you posted.
  > To complete my issue. I've tested the certs with openssl:  ``` openssl verify -CAfile MyRootCert.pem -untrusted MyIntermediateCert.pem server.pem servercert.pem: OK ``` But I still get the Chrome/Brave Browser error: `net::ERR_CERT_INVALID` 
  > I'm facing the same issue, and the certificate proposed is not match the intention usage (not sure what is the right code here)  ![image](https://github.com/user-attachments/assets/0c47a535-f3fe-451a-ae3e-24d9ef37d99d)  ![image](https://github.com/user-attachments/assets/62e136d1-dddd-4ba8-93de-f80df493327f)  Second image is in portuguese. Translating: "This certificate or certificate chain are not valid for the usage mode intended."

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

### Incident Patch 1: `c40d5fd5` (2026-10-10)
**Commit Message**: improvement(ui): standardize Loader on the yellow brand mark (#8555)

* improvement(ui): standardize Loader on the yellow brand mark

Co-authored-by: capy-ai[bot] <230910855+capy-ai[bot]@users.noreply.github.com>

* improvement(ui): default Loader to brand and drop neutral/default tints

Co-authored-by: capy-ai[bot] <230910855+capy-ai[bot]@users.noreply.github.com>

---------

Co-authored-by: capy-ai[bot] <230910855+capy-ai[bot]@users.noreply.github.com>

**File**: `frontend/public/lotties/infisical_loading_white.json` (removed, +0/-1)
```diff
@@ -1 +0,0 @@
-{"v":"5.7.5","fr":100,"ip":0,"op":300,"w":800,"h":420,"nm":"Comp 1","ddd":0,"metadata":{},"assets":[{"id":"0","layers":[{"ddd":0,"ind":1,"ty":4,"nm":"Vector (Stroke)","sr":1,"ks":{"p":{"a":0,"k":[-205,-431],"ix":2},"a":{"a":0,"k":[0,0],"ix":2},"s":{"a":0,"k":[100,100],"ix":2},"r":{"a":0,"k":0,"ix":2},"o":{"a":0,"k":100,"ix":2},"sk":{"a":0,"k":0,"ix":2},"sa":{"a":0,"k":0,"ix":2}},"ao":0,"shapes":[{"ty":"gr","it":[{"ty":"gr","nm":"Vector (Stroke)","it":[{"ty":"gr","nm":"Path 1","it":[{"ty":"sh","d":1,"ks":{"a":0,"k":{"c":true,"v":[[20.447,-130.148],[-77.721,-88.116],[-139.588,-16.199],[-148.936,-1.772],[-139.006,12.261],[-71.202,92.517],[20.447,130.148],[148.936,0],[20.447,-130.148]],"i":[[0,0],[29.018,-24.696],[16.327,-25.197],[0,0],[0,0],[-23.672,-20.706],[-35.524,0],[0,71.767],[71.074,0]],"o":[[-35.542,0],[-24.403,20.768],[0,0],[0,0],[22.425,31.688],[26.864,23.498],[71.074,0],[0,-71.768],[0,0]]}}},{"ty":"tr","p":{"a":0,"k":[0,0],"ix":2},"a":{"a":0,"k":[0,0],"ix":2},"s":{"a":0,"k":[100,100],"ix":2},"r":{"a":0,"k":0,"ix":2},"o":{"a":0,"k":100,"ix":2},"sk":{"a":0,"k":0,"ix":2},"sa":{"a":0,"k":0,"ix":2}}]},{"ty":"gr","nm":"Path 2","it":[{"ty":"sh","d":1,"ks":{"a":0,"k":{"c":true,"v":[[-61.273,-68.789],[-77.721,-88.116],[-61.273,-68.789]],"i":[[0,0],[0,0],[0,0]],"o":[[0,0],[0,0],[0,0]]}}},{"ty":"tr","p":{"a":0,"k":[0,0],"ix":2},"a":{"a":0,"k":[0,0],"ix":2},"s":{"a":0,"k":[100,100],"ix":2},"r":{"a":0,"k":0,"ix":2},"o":{"a":0,"k":100,"ix":2},"sk":{"a":0,"k":0,"ix":2},"sa":{"a":0,"k":0,"ix":2}}]},{"ty":"gr","nm":"Path 3","it":[{"ty":"sh","d":1,"ks":{"a":0,"k":{"c":true,"v":[[-44.825,-49.463],[20.447,-79.392],[98.18,0],[20.447,79.392],[-37.785,54.313],[-87.278,-2.751],[-44.825,-49.463],[-44.825,-49.463]],"i":[[0,0],[-18.899,0],[0,-44.371],[42.411,0],[20.197,17.666],[17.78,24.244],[-15.565,13.246],[0,0]],"o":[[24.072,-20.487],[42.411,0],[0,44.371],[-20.186,0],[-15.87,-13.881],[12.425,-17.11],[0,0],[0,0]]}}},{"ty":"tr","p":{"a":0,"k":[0,0],"ix":2},"a":{"a":0,"k":[0,0],"ix":2},"s":{"a":0,"k":[100,100],"ix":2},"r":{"a":0,"k":0,"ix":2},"o":{"a":0,"k":100,"ix":2},"sk":{"a":0,"k":0,"ix":2},"sa":{"a":0,"k":0,"ix":2}}]},{"ty":"gf","o":{"a":0,"k":100,"ix":2},"r":1,"bm":0,"g":{"p":3,"k":{"a":0,"k":[0,1,1,1,0.5,1,1,1,1,1,1,1,0,1,0.5,0.5,1,0],"ix":2}},"s":{"a":0,"k":[-86.28473663330078,1.4994840621948242],"ix":2},"e":{"a":0,"k":[462.44384765625,-5.23858642578125],"ix":2},"t":1},{"ty":"tr","p":{"a":0,"k":[0,0],"ix":2},"a":{"a":0,"k":[0,0],"ix":2},"s":{"a":0,"k":[100,100],"ix":2},"r":{"a":0,"k":0,"ix":2},"o":{"a":0,"k":100,"ix":2},"sk":{"a":0,"k":0,"ix":2},"sa":{"a":0,"k":0,"ix":2}}]},{"ty":"tr","p":{"a":0,"k":[747.4509887695312,615.6649780273438],"ix":2},"a":{"a":0,"k":[0,0],"ix":2},"s":{"a":0,"k":[140.5150055885315,140.5150055885315],"ix":2},"r":{"a":0,"k":0,"ix":2},"o":{"a":0,"k":100,"ix":2},"sk":{"a":0,"k":0,"ix":2},"sa":{"a":0,"k":0,"ix":2}}]}],"ip":0,"op":301,"st":0,"bm":0},{"ddd":0,"ind":2,"ty":4,"nm":"Vector (Stroke)","sr":1,"ks":{"p":{"a":0,"k":[-205,-431],"ix":2},"a":{"a":0,"k":[0,0],"ix":2},"s":{"a":0,"k":[100,100],"ix":2},"r":{"a":0,"k":0,"ix":2},"o":{"a":0,"k":100,"ix":2},"sk":{"a":0,"k":0,"ix":2},"sa":{"a":0,"k":0,"ix":2}},"ao":0,"shapes":[{"ty":"gr","it":[{"ty":"gr","nm":"Vector (Stroke)","it":[{"ty":"gr","nm":"Path 1","it":[{"ty":"sh","d":1,"ks":{"a":0,"k":{"c":true,"v":[[-98.468,0],[-20.444,-79.392],[46.888,-43.887],[46.888,-43.887],[87.062,-0.165],[48.675,41.472],[65.75,60.248],[48.675,41.472],[-20.444,79.392],[-98.468,0]],"i":[[0,0],[-42.675,0],[-27.224,-24.453],[0,0],[-11.056,-14.336],[14.986,-13.628],[0,0],[0,0],[15.764,0],[0,44.267]],"o":[[0,-44.266],[16.468,0],[0,0],[15.303,13.745],[-10.159,13.06],[0,0],[0,0],[-28.618,26.025],[-42.675,0],[0,0]]}}},{"ty":"tr","p":{"a":0,"k":[0,0],"ix":2},"a":{"a":0,"k":[0,0],"ix":2},"s":{"a":0,"k":[100,100],"ix":2},"r":{"a":0,"k":0,"ix":2},"o":{"a":0,"k":100,"ix":2},"sk":{"a":0,"k":0,"ix":2},"sa":{"a":0,"k":0,"ix":2}}]},{"ty":"gr","nm":"Path 2","it":[{"ty":"sh","d":1,"ks":{"a":0,"k":{"c":true,"v":[[-20.444,-130.149],[-149.224,0],[-20.444,130.149],[82.824,79.024],[82.824,79.023],[139.462,14.105],[149.224,-0.255],[139.377,-14.556],[80.805,-81.647],[-20.444,-130.149]],"i":[[0,0],[0,-71.764],[-71.238,0],[-30.616,27.842],[0,0],[-12.465,18.334],[0,0],[0,0],[24.224,21.758],[35.661,0]],"o":[[-71.238,0],[0,71.764],[35.674,0],[0,0],[24.139,-21.952],[0,0],[0,0],[-13.86,-20.129],[-29.959,-26.91],[0,0]]}}},{"ty":"tr","p":{"a":0,"k":[0,0],"ix":2},"a":{"a":0,"k":[0,0],"ix":2},"s":{"a":0,"k":[100,100],"ix":2},"r":{"a":0,"k":0,"ix":2},"o":{"a":0,"k":100,"ix":2},"sk":{"a":0,"k":0,"ix":2},"sa":{"a":0,"k":0,"ix":2}}]},{"ty":"gf","o":{"a":0,"k":100,"ix":2},"r":1,"bm":0,"g":{"p":3,"k":{"a":0,"k":[0,1,1,1,0.5,1,1,1,1,1,1,1,0,1,0.5,0.5,1,0],"ix":2}},"s":{"a":0,"k":[62.10511016845703,5.982990741729736],"ix":2},"e":{"a":0,"k":[-461.3863220214844,-3.3000035285949707],"ix":2},"t":1},{"ty":"tr","p":{"a":0,"k":[0,0],"ix":2},"a":{"a":0,"k":[0,0],"ix":2},"s":{"a":0,"k":[100,100],"ix":2},"r":
```

**File**: `frontend/src/components/v3/generic/IconButton/IconButton.tsx` (modified, +1/-1)
```diff
@@ -105,7 +105,7 @@ const IconButton = forwardRef<HTMLButtonElement, IconButtonProps>(
         {isPending && (
           <Loader
             aria-hidden
-            variant={variant === "default" ? "inverse" : "default"}
+            variant={variant === "default" ? "inverse" : "brand"}
             size="xs"
             className={twMerge(
               "absolute rounded-xl",
```

**File**: `frontend/src/components/v3/generic/Loader/Loader.stories.tsx` (modified, +6/-36)
```diff
@@ -7,7 +7,7 @@ import { Loader } from "./Loader";
 
 /**
  * `Loader` is the branded Infisical loading animation — the stroke-draw of the
- * logo mark. It is the single source for that animation: the mark, the four
+ * logo mark. It is the single source for that animation: the mark, the two
  * tints, and the size scale all live here, and every product call site composes
  * it rather than naming a Lottie asset itself, including the router's full-page
  * pending state in `main.tsx`.
@@ -44,7 +44,7 @@ const meta = {
   argTypes: {
     variant: {
       control: "select",
-      options: ["neutral", "default", "inverse", "brand"]
+      options: ["brand", "inverse"]
     },
     size: {
       control: "select",
@@ -60,7 +60,7 @@ const meta = {
   args: {
     label: "Loading",
     size: "md",
-    variant: "neutral"
+    variant: "brand"
   }
 } satisfies Meta<typeof Loader>;
 
@@ -72,37 +72,7 @@ export const Default: Story = {
     docs: {
       description: {
         story:
-          "The in-product default: the theme-aware neutral mark at `md`. Use it on standard product surfaces — a `Card` body waiting on a fetch, or a section that owns its own loading state. The animation loops for as long as the wait lasts, or remains on its fully drawn first frame when the operating system requests reduced motion. It carries no progress information, so pair it with copy when the wait is long enough to need explaining."
-      }
-    }
-  }
-};
-
-export const VariantNeutral: Story = {
-  name: "Variant: Neutral",
-  args: {
-    variant: "neutral"
-  },
-  parameters: {
-    docs: {
-      description: {
-        story:
-          "Theme-aware monochrome mark. It renders white in dark mode and black in light mode, making it the default for standard product surfaces and controls."
-      }
-    }
-  }
-};
-
-export const VariantDefault: Story = {
-  name: "Variant: Default",
-  args: {
-    variant: "default"
-  },
-  parameters: {
-    docs: {
-      description: {
-        story:
-          "Fixed white mark. Use it only when the surrounding surface is always dark, regardless of the active application theme. Prefer `neutral` on theme-aware product surfaces."
+          "The default: the brand-colored mark at `md`. It is the one tint for every loading state, from the router's pending page to a `Card` body waiting on a fetch, so consecutive loaders never switch color. Use it on standard product surfaces — a `Card` body waiting on a fetch, or a section that owns its own loading state. The animation loops for as long as the wait lasts, or remains on its fully drawn first frame when the operating system requests reduced motion. It carries no progress information, so pair it with copy when the wait is long enough to need explaining."
       }
     }
   }
@@ -124,7 +94,7 @@ export const VariantInverse: Story = {
     docs: {
       description: {
         story:
-          "Black mark, for inverted surfaces where the foreground color is the background — the solid `default` `IconButton`, and anything else painted `bg-foreground`. Shown here on `bg-foreground`, since it is invisible against the page."
+          "Black mark, the only alternative to `brand`, for inverted surfaces where the foreground color is the background — the solid `default` `IconButton`, and anything else painted `bg-foreground`. Shown here on `bg-foreground`, since it is invisible against the page."
       }
     }
   }
@@ -139,7 +109,7 @@ export const VariantBrand: Story = {
     docs: {
       description: {
         story:
-          "The colored mark. Reserve it for brand-forward moments: the router's own pending state before the product chrome exists, full-screen `ContentLoader` waits, and connection tests that stand in for the product itself. Do not use it as a generic accent inside routine product UI."
+          "The colored mark and the default tint. Use it everywhere except inverted surfaces, where `inverse` keeps the stroke legible."
       }
     }
   }
```

**File**: `frontend/src/components/v3/generic/Loader/Loader.tsx` (modified, +5/-7)
```diff
@@ -3,7 +3,7 @@ import { type DotLottie, DotLottieReact } from "@lottiefiles/dotlottie-react";
 
 import { cn } from "../../utils";
 
-type LoaderVariant = "neutral" | "default" | "inverse" | "brand";
+type LoaderVariant = "brand" | "inverse";
 
 type LoaderSize = "xs" | "sm" | "md" | "lg";
 
@@ -14,10 +14,8 @@ type LoaderProps = Omit<ComponentProps<"div">, "children"> & {
 };
 
 const animationSources: Record<LoaderVariant, string> = {
-  neutral: "/lotties/infisical_loading_white.json",
-  default: "/lotties/infisical_loading_white.json",
-  inverse: "/lotties/infisical_loading_bw.json",
-  brand: "/lotties/infisical_loading.json"
+  brand: "/lotties/infisical_loading.json",
+  inverse: "/lotties/infisical_loading_bw.json"
 };
 
 // The mark is 1.91:1 rather than square, so the scale is expressed as widths and
@@ -39,7 +37,7 @@ function Loader({
   className,
   label = "Loading",
   size = "md",
-  variant = "neutral",
+  variant = "brand",
   ...props
 }: LoaderProps) {
   const prefersReducedMotion = useSyncExternalStore(
@@ -77,7 +75,7 @@ function Loader({
         src={animationSources[variant]}
         loop
         autoplay={!prefersReducedMotion}
-        className={cn("h-full w-full", variant === "neutral" && "in-data-[theme=light]:invert")}
+        className="h-full w-full"
       />
     </div>
   );
```

---

### Incident Patch 2: `251b765f` (2026-10-10)
**Commit Message**: fix(secrets-overview): keep expanded row chevron stable in multi-env view (#8549)

Co-authored-by: capy-ai[bot] <230910855+capy-ai[bot]@users.noreply.github.com>

**File**: `frontend/src/pages/secret-manager/OverviewPage/components/SecretRotationTableRow/SecretRotationTableRow.tsx` (modified, +20/-20)
```diff
@@ -354,28 +354,28 @@ export const SecretRotationTableRow = ({
           )}
         >
           <div className="flex h-full items-center justify-center [&>svg]:size-4">
-            <Checkbox
-              variant="project"
-              id={`checkbox-${secretRotationName}`}
-              isChecked={isSelected}
-              onClick={(e) => {
-                e.stopPropagation();
-                onToggleRotationSelect(secretRotationName, e.shiftKey);
-              }}
-              className={twMerge("hidden group-hover:flex", isSelected && "flex")}
-            />
             {!isSingleEnvView && isExpanded ? (
-              <ChevronDownIcon
-                className={twMerge("block", "group-hover:!hidden", isSelected && "!hidden")}
-              />
+              <ChevronDownIcon />
             ) : (
-              <RefreshCwIcon
-                className={twMerge(
-                  "block text-secret-rotation",
-                  "group-hover:!hidden",
-                  isSelected && "!hidden"
-                )}
-              />
+              <>
+                <Checkbox
+                  variant="project"
+                  id={`checkbox-${secretRotationName}`}
+                  isChecked={isSelected}
+                  onClick={(e) => {
+                    e.stopPropagation();
+                    onToggleRotationSelect(secretRotationName, e.shiftKey);
+                  }}
+                  className={twMerge("hidden group-hover:flex", isSelected && "flex")}
+                />
+                <RefreshCwIcon
+                  className={twMerge(
+                    "block text-secret-rotation",
+                    "group-hover:!hidden",
+                    isSelected && "!hidden"
+                  )}
+                />
+              </>
             )}
           </div>
         </TableCell>
```

**File**: `frontend/src/pages/secret-manager/OverviewPage/components/SecretTableRow/SecretTableRow.tsx` (modified, +2/-22)
```diff
@@ -439,28 +439,8 @@ export const SecretTableRow = ({
               )}
             >
               {isFormExpanded && (
-                <div className="flex w-10 shrink-0 items-center justify-center [&>svg]:size-4">
-                  <Checkbox
-                    variant="project"
-                    id={`checkbox-${secretKey}`}
-                    isChecked={isSelected}
-                    onClick={(e) => {
-                      e.stopPropagation();
-                      onToggleSecretSelect(secretKey, e.shiftKey);
-                    }}
-                    className={twMerge(
-                      "hidden",
-                      !isSelectionDisabled && "group-hover:flex",
-                      isSelected && "flex"
-                    )}
-                  />
-                  <ChevronDownIcon
-                    className={twMerge(
-                      "block",
-                      !isSelectionDisabled && "group-hover:!hidden",
-                      isSelected && "!hidden"
-                    )}
-                  />
+                <div className="flex w-10 shrink-0 cursor-pointer items-center justify-center [&>svg]:size-4">
+                  <ChevronDownIcon />
                 </div>
               )}
               <div
```

---

### Incident Patch 3: `0e6e1c50` (2026-10-09)
**Commit Message**: Greptile fix

**File**: `backend/src/services/alert/providers/secret-reminder-alert-dal.ts` (modified, +1/-2)
```diff
@@ -64,8 +64,7 @@ export const secretReminderAlertDALFactory = (db: TDbClient) => {
   const findSecretKeysByIds = async (secretIds: string[], orgId: string): Promise<{ id: string; key: string }[]> => {
     if (secretIds.length === 0) return [];
     try {
-      return (await db
-        .replicaNode()(TableName.SecretV2)
+      return (await db(TableName.SecretV2)
         .join(TableName.SecretFolder, `${TableName.SecretV2}.folderId`, `${TableName.SecretFolder}.id`)
         .join(TableName.Environment, `${TableName.SecretFolder}.envId`, `${TableName.Environment}.id`)
         .join(TableName.Project, `${TableName.Environment}.projectId`, `${TableName.Project}.id`)
```

---

### Incident Patch 4: `6cd7b7e6` (2026-10-09)
**Commit Message**: Fixes

**File**: `backend/src/services/alert/alert-channel-test-service.test.ts` (modified, +10/-16)
```diff
@@ -186,6 +186,14 @@ describe("alertChannelTestService", () => {
     }
   });
 
+  const boundSlackTest = {
+    ...actor,
+    resourceType: RESOURCE_TYPE,
+    resourceId: "resource-1",
+    channelType: "slack" as never,
+    config: { webhookUrl: "https://hooks.slack.com/services/T/B/x" }
+  };
+
   test("returns the name of the resource the test was sent for", async () => {
     const lookups: { orgId: string; resourceIds: string[] }[] = [];
     const restore = stubSend("slack", async () => ({ success: true }));
@@ -201,13 +209,7 @@ describe("alertChannelTestService", () => {
       });
       const service = alertChannelTestServiceFactory(deps);
 
-      const result = await service.testChannel({
-        ...actor,
-        resourceType: RESOURCE_TYPE,
-        resourceId: "resource-1",
-        channelType: "slack" as never,
-        config: { webhookUrl: "https://hooks.slack.com/services/T/B/x" }
-      });
+      const result = await service.testChannel(boundSlackTest);
 
       expect(lookups).toEqual([{ orgId: ORG_ID, resourceIds: ["resource-1"] }]);
       expect(result.resourceName).toBe("Payments API");
@@ -233,15 +235,7 @@ describe("alertChannelTestService", () => {
       });
       const service = alertChannelTestServiceFactory(deps);
 
-      await expect(
-        service.testChannel({
-          ...actor,
-          resourceType: RESOURCE_TYPE,
-          resourceId: "resource-1",
-          channelType: "slack" as never,
-          config: { webhookUrl: "https://hooks.slack.com/services/T/B/x" }
-        })
-      ).rejects.toThrow("lookup failed");
+      await expect(service.testChannel(boundSlackTest)).rejects.toThrow("lookup failed");
       expect(sent).toHaveLength(0);
     } finally {
       restore();
```

**File**: `backend/src/services/alert/alert-service.test.ts` (modified, +7/-1)
```diff
@@ -374,7 +374,13 @@ describe("alert service", () => {
     expect(
       service.getAuditEvent({
         action: AlertAuditAction.TestChannel,
-        test: { resourceType: RESOURCE_TYPE, resourceId: "resource-1", channelType: "slack", success: true }
+        test: {
+          resourceType: RESOURCE_TYPE,
+          resourceId: "resource-1",
+          resourceName: null,
+          channelType: "slack",
+          success: true
+        }
       })
     ).toEqual({
       type: "test-alert-channel",
```

**File**: `backend/src/services/alert/alert-service.ts` (modified, +1/-1)
```diff
@@ -108,7 +108,7 @@ const getAuditEvent = (input: TAlertAuditInput): TAuditEvent => {
         channelType: test.channelType,
         resourceType: test.resourceType,
         resourceId: test.resourceId,
-        resourceName: test.resourceName ?? null,
+        resourceName: test.resourceName,
         success: test.success,
         deliveredTo: test.deliveredTo,
         error: test.error
```

**File**: `backend/src/services/alert/alert-types.ts` (modified, +1/-1)
```diff
@@ -147,7 +147,7 @@ type TAlertAuditAlert = {
 type TAlertChannelTestAudit = {
   resourceType: string;
   resourceId?: string | null;
-  resourceName?: string | null;
+  resourceName: string | null;
   channelId?: string;
   channelType: string;
   success: boolean;
```

**File**: `backend/src/services/alert/providers/identity-credential-alert-provider.test.ts` (modified, +12/-2)
```diff
@@ -95,8 +95,10 @@ const buildProvider = (opts?: {
   userLabel?: string;
 }) => {
   const dal = {
-    findIdentitiesByIds: async (ids: string[]) =>
-      (opts?.identities ?? [{ id: "ident-1", name: "ci-runner" }]).filter((identity) => ids.includes(identity.id)),
+    findIdentitiesByIds: async (ids: string[], orgId: string) =>
+      orgId === "org-1"
+        ? (opts?.identities ?? [{ id: "ident-1", name: "ci-runner" }]).filter((identity) => ids.includes(identity.id))
+        : [],
     findUserLabelById: async () => opts?.userLabel,
     findExpiringUaClientSecrets: async (args: {
       orgId: string;
@@ -154,6 +156,14 @@ const changePayload = (overrides: Record<string, unknown> = {}) => ({
 });
 
 describe("identity credential alert provider", () => {
+  test("getResourceNames returns identity names only from the caller's org", async () => {
+    const provider = buildProvider();
+    const names = await provider.getResourceNames?.({ orgId: "org-1", resourceIds: ["ident-1"] });
+    expect(names?.get("ident-1")).toBe("ci-runner");
+    const foreign = await provider.getResourceNames?.({ orgId: "org-2", resourceIds: ["ident-1"] });
+    expect(foreign?.size).toBe(0);
+  });
+
   test("expiry condition schema accepts 1d-90d and rejects everything else", () => {
     const schema = eventSchema(buildProvider(), IDENTITY_AUTHENTICATION_EXPIRY_EVENT);
     expect(schema.safeParse({ alertBefore: "1d" }).success).toBe(true);
```

**File**: `backend/src/services/alert/providers/secret-reminder-alert-dal.ts` (modified, +17/-1)
```diff
@@ -61,5 +61,21 @@ export const secretReminderAlertDALFactory = (db: TDbClient) => {
     }
   };
 
-  return { findSecretsByIds };
+  const findSecretKeysByIds = async (secretIds: string[], orgId: string): Promise<{ id: string; key: string }[]> => {
+    if (secretIds.length === 0) return [];
+    try {
+      return (await db
+        .replicaNode()(TableName.SecretV2)
+        .join(TableName.SecretFolder, `${TableName.SecretV2}.folderId`, `${TableName.SecretFolder}.id`)
+        .join(TableName.Environment, `${TableName.SecretFolder}.envId`, `${TableName.Environment}.id`)
+        .join(TableName.Project, `${TableName.Environment}.projectId`, `${TableName.Project}.id`)
+        .whereIn(`${TableName.SecretV2}.id`, secretIds)
+        .where(`${TableName.Project}.orgId`, orgId)
+        .select(`${TableName.SecretV2}.id`, `${TableName.SecretV2}.key`)) as { id: string; key: string }[];
+    } catch (error) {
+      throw new DatabaseError({ error, name: "FindSecretKeysByIds" });
+    }
+  };
+
+  return { findSecretsByIds, findSecretKeysByIds };
 };
```

**File**: `backend/src/services/alert/providers/secret-reminder-alert-provider.test.ts` (modified, +13/-1)
```diff
@@ -39,7 +39,11 @@ const buildProvider = (
   const provider = secretReminderAlertProviderFactory({
     secretReminderAlertDAL: {
       findSecretsByIds: async (ids: string[]) =>
-        (opts.secrets ?? [SECRET]).filter((secret) => ids.includes(secret.secretId))
+        (opts.secrets ?? [SECRET]).filter((secret) => ids.includes(secret.secretId)),
+      findSecretKeysByIds: async (ids: string[], orgId: string) =>
+        (opts.secrets ?? [SECRET])
+          .filter((secret) => ids.includes(secret.secretId) && secret.orgId === orgId)
+          .map((secret) => ({ id: secret.secretId, key: secret.secretKey }))
     },
     folderDAL: {
       findSecretPathByFolderIds: async (_projectId: string, _folderIds: string[], _tx: unknown, options: unknown) => {
@@ -88,6 +92,14 @@ const dueEvent = (payload: Record<string, unknown> = {}) => ({
 const actor = { actor: "user", actorId: "user-1", actorAuthMethod: null, actorOrgId: "org-1" } as never;
 
 describe("secret reminder alert provider", () => {
+  test("getResourceNames returns secret keys only from the caller's org", async () => {
+    const { provider } = buildProvider();
+    const names = await provider.getResourceNames?.({ orgId: "org-1", resourceIds: [SECRET.secretId] });
+    expect(names?.get(SECRET.secretId)).toBe(SECRET.secretKey);
+    const foreign = await provider.getResourceNames?.({ orgId: "org-2", resourceIds: [SECRET.secretId] });
+    expect(foreign?.size).toBe(0);
+  });
+
   test("delivers what the reminder cron emits", async () => {
     let emitted: Record<string, unknown> | undefined;
     await emitSecretReminderDue(
```

**File**: `backend/src/services/alert/providers/secret-reminder-alert-provider.ts` (modified, +2/-4)
```diff
@@ -35,7 +35,7 @@ export type TSecretReminderTarget = TSecretWithLocation & {
 };
 
 export type TSecretReminderAlertProviderDep = {
-  secretReminderAlertDAL: Pick<TSecretReminderAlertDALFactory, "findSecretsByIds">;
+  secretReminderAlertDAL: Pick<TSecretReminderAlertDALFactory, "findSecretsByIds" | "findSecretKeysByIds">;
   folderDAL: Pick<TSecretFolderDALFactory, "findSecretPathByFolderIds">;
   permissionService: Pick<TPermissionServiceFactory, "getProjectPermission">;
 };
@@ -240,9 +240,7 @@ export const secretReminderAlertProviderFactory = ({
     assertResourceInScope,
     getResourceNames: async ({ orgId, resourceIds }) =>
       new Map(
-        (await secretReminderAlertDAL.findSecretsByIds(resourceIds))
-          .filter((secret) => secret.orgId === orgId)
-          .map((secret) => [secret.secretId, secret.secretKey])
+        (await secretReminderAlertDAL.findSecretKeysByIds(resourceIds, orgId)).map((secret) => [secret.id, secret.key])
       )
   };
 };
```

---

### Incident Patch 5: `37d0f56b` (2026-10-09)
**Commit Message**: Greptile fix

**File**: `backend/src/services/alert/alert-channel-test-service.test.ts` (modified, +65/-1)
```diff
@@ -34,6 +34,7 @@ const buildProvider = (opts?: {
   resolvedProjectId?: string;
   blockedChannelTypes?: string[];
   webhookSource?: boolean;
+  getResourceNames?: IResourceAlertProvider["getResourceNames"];
 }) => {
   const provider: IResourceAlertProvider = {
     resourceType: RESOURCE_TYPE,
@@ -70,7 +71,8 @@ const buildProvider = (opts?: {
     ...(opts?.resolvedProjectId ? { resolveProjectId: async () => opts.resolvedProjectId as string } : {}),
     ...(opts?.webhookSource
       ? { getWebhookSource: ({ alertId, resourceId }) => `/resources/${resourceId}/alerts/${alertId}` }
-      : {})
+      : {}),
+    ...(opts?.getResourceNames ? { getResourceNames: opts.getResourceNames } : {})
   };
 
   const registry = alertProviderRegistryFactory();
@@ -184,6 +186,68 @@ describe("alertChannelTestService", () => {
     }
   });
 
+  test("returns the name of the resource the test was sent for", async () => {
+    const lookups: { orgId: string; resourceIds: string[] }[] = [];
+    const restore = stubSend("slack", async () => ({ success: true }));
+
+    try {
+      const { deps } = buildDeps({
+        registry: buildProvider({
+          getResourceNames: async (input) => {
+            lookups.push(input);
+            return new Map([["resource-1", "Payments API"]]);
+          }
+        })
+      });
+      const service = alertChannelTestServiceFactory(deps);
+
+      const result = await service.testChannel({
+        ...actor,
+        resourceType: RESOURCE_TYPE,
+        resourceId: "resource-1",
+        channelType: "slack" as never,
+        config: { webhookUrl: "https://hooks.slack.com/services/T/B/x" }
+      });
+
+      expect(lookups).toEqual([{ orgId: ORG_ID, resourceIds: ["resource-1"] }]);
+      expect(result.resourceName).toBe("Payments API");
+    } finally {
+      restore();
+    }
+  });
+
+  test("sends nothing when the resource name lookup fails", async () => {
+    const sent: TAlertChannelSendContext[] = [];
+    const restore = stubSend("slack", async (ctx) => {
+      sent.push(ctx);
+      return { success: true };
+    });
+
+    try {
+      const { deps } = buildDeps({
+        registry: buildProvider({
+          getResourceNames: async () => {
+            throw new Error("lookup failed");
+          }
+        })
+      });
+      const service = alertChannelTestServiceFactory(deps);
+
+      await expect(
+        service.testChannel({
+          ...actor,
+          resourceType: RESOURCE_TYPE,
+          resourceId: "resource-1",
+          channelType: "slack" as never,
+          config: { webhookUrl: "https://hooks.slack.com/services/T/B/x" }
+        })
+      ).rejects.toThrow("lookup failed");
+      expect(sent).toHaveLength(0);
+    } finally {
+      restore();
+    }
+  });
+
   test("sends a test through an undirected channel with the supplied config", async () => {
     const sent: TAlertChannelSendContext[] = [];
     const restore = stubSend("slack", async (ctx) => {
```

**File**: `backend/src/services/alert/alert-channel-test-service.ts` (modified, +1/-1)
```diff
@@ -236,8 +236,8 @@ export const alertChannelTestServiceFactory = ({
     }
 
     const config = await $resolveConfig(dto, projectId);
-    const result = await $sendTest(dto, projectId, provider, config);
     const resourceName = await getAlertResourceName(provider, dto.actorOrgId, dto.resourceId);
+    const result = await $sendTest(dto, projectId, provider, config);
     return { ...result, projectId, resourceName };
   };
 
```

---

### Incident Patch 6: `18863359` (2026-10-09)
**Commit Message**: fix lint

**File**: `frontend/src/helpers/appConnections.ts` (modified, +1/-1)
```diff
@@ -73,8 +73,8 @@ import { FireworksConnectionMethod } from "@app/hooks/api/appConnections/types/f
 import { GoDaddyConnectionMethod } from "@app/hooks/api/appConnections/types/godaddy-connection";
 import { HasuraCloudConnectionMethod } from "@app/hooks/api/appConnections/types/hasura-cloud-connection";
 import { HerokuConnectionMethod } from "@app/hooks/api/appConnections/types/heroku-connection";
-import { KeeperConnectionMethod } from "@app/hooks/api/appConnections/types/keeper-connection";
 import { HpeIloConnectionMethod } from "@app/hooks/api/appConnections/types/hpe-ilo-connection";
+import { KeeperConnectionMethod } from "@app/hooks/api/appConnections/types/keeper-connection";
 import { KempLoadMasterConnectionMethod } from "@app/hooks/api/appConnections/types/kemp-loadmaster-connection";
 import { LaravelForgeConnectionMethod } from "@app/hooks/api/appConnections/types/laravel-forge-connection";
 import { LiteLLMConnectionMethod } from "@app/hooks/api/appConnections/types/litellm-connection";
```

---

### Incident Patch 7: `2b33b9be` (2026-10-09)
**Commit Message**: fix(frontend): block secret uploads that exceed the 1 MB request limit (#8533)

* fix(frontend): block secret uploads that exceed the 1 MB request limit

Co-authored-by: capy-ai[bot] <230910855+capy-ai[bot]@users.noreply.github.com>

* fix(frontend): count resolved tag IDs and env slug in upload size check

Co-authored-by: capy-ai[bot] <230910855+capy-ai[bot]@users.noreply.github.com>

* fix(frontend): use fixed tag ID placeholder in upload size check

Co-authored-by: capy-ai[bot] <230910855+capy-ai[bot]@users.noreply.github.com>

* fix(frontend): reject secret files over 1 MB before parsing

Co-authored-by: capy-ai[bot] <230910855+capy-ai[bot]@users.noreply.github.com>

* fix(frontend): skip pre-parse size gate for CSV files

Co-authored-by: capy-ai[bot] <230910855+capy-ai[bot]@users.noreply.github.com>

---------

Co-authored-by: capy-ai[bot] <230910855+capy-ai[bot]@users.noreply.github.com>

**File**: `frontend/src/pages/secret-manager/OverviewPage/components/SecretDropzone/ImportSecretsModal.tsx` (modified, +46/-3)
```diff
@@ -1,4 +1,4 @@
-import { useCallback, useEffect, useState } from "react";
+import { useCallback, useEffect, useMemo, useState } from "react";
 import { subject } from "@casl/ability";
 import {
   CodeXmlIcon,
@@ -55,6 +55,8 @@ import { CsvData, parseSecretFile } from "./parseSecretFile";
 import { PASTE_SECRETS_FORM_ID, PasteSecretsContent } from "./PasteSecretsDialog";
 import { TParsedEnv } from "./types";
 
+const MAX_BATCH_REQUEST_BYTES = 1024 * 1024;
+
 type Props = {
   isOpen: boolean;
   onOpenChange: (isOpen: boolean) => void;
@@ -139,6 +141,27 @@ const ImportSecretsContent = ({
         ([key, s]) => s.isFileSecret && !(keyOverrides[key] ?? key).trim()
       )
     : false;
+  const isOverRequestLimit = useMemo(() => {
+    if (!activeSecrets) return false;
+    const payload = JSON.stringify({
+      projectId,
+      environment: selectedEnvs.reduce(
+        (longest, env) => (env.slug.length > longest.length ? env.slug : longest),
+        ""
+      ),
+      secretPath,
+      secrets: Object.entries(activeSecrets).map(([key, s]) => ({
+        secretKey: keyOverrides[key] ?? key,
+        secretValue: s.value,
+        secretComment: s.comments.join("\n"),
+        type: SecretType.Shared,
+        tagIds: s.tagSlugs?.map(() => "00000000-0000-0000-0000-000000000000"),
+        secretMetadata: s.secretMetadata,
+        skipMultilineEncoding: s.skipMultilineEncoding
+      }))
+    });
+    return new TextEncoder().encode(payload).length > MAX_BATCH_REQUEST_BYTES;
+  }, [activeSecrets, keyOverrides, projectId, secretPath, selectedEnvs]);
 
   const handleParsedSecrets = useCallback((env: TParsedEnv) => {
     if (!Object.keys(env).length) {
@@ -161,6 +184,15 @@ const ImportSecretsContent = ({
         return;
       }
 
+      const isCsv = file.name.toLowerCase().endsWith(".csv") || file.type === "text/csv";
+      if (!isCsv && file.size > MAX_BATCH_REQUEST_BYTES) {
+        createNotification({
+          type: "error",
+          text: "This file exceeds the 1 MB upload limit. Split it into smaller files."
+        });
+        return;
+      }
+
       parseSecretFile(file, { onParsedSecrets: handleParsedSecrets, onCsvData: setCsvData });
     },
     [handleParsedSecrets]
@@ -470,7 +502,7 @@ const ImportSecretsContent = ({
                   <FileDropzone
                     isDisabled={!isAllowed}
                     accept=".txt,.env,.yml,.yaml,.json,.csv,.pfx,.pem,.crt"
-                    description=".env, .json, .yml, .csv, .pfx, .pem, or .crt"
+                    description=".env, .json, .yml, .csv, .pfx, .pem, or .crt (1 MB request limit)"
                     onFilesSelect={(files) => parseFile(files[0])}
                   />
                 )}
@@ -512,6 +544,11 @@ const ImportSecretsContent = ({
           {secretCount} secret{secretCount !== 1 ? "s" : ""} found. Select environments to upload
           to.
         </SheetDescription>
+        {isOverRequestLimit && (
+          <p className="text-sm text-danger">
+            These secrets exceed the 1 MB upload limit. Split them into smaller uploads.
+          </p>
+        )}
       </SheetHeader>
 
       <div className="flex min-h-0 flex-1 flex-col overflow-y-auto p-4">
@@ -707,7 +744,13 @@ const ImportSecretsContent = ({
         <Button
           variant="project"
           onClick={handleImport}
-          isDisabled={!selectedEnvs.length || isImporting || isWaitingForTags || hasInvalidKey}
+          isDisabled={
+            !selectedEnvs.length ||
+            isImporting ||
+            isWaitingForTags ||
+            hasInvalidKey ||
+            isOverRequestLimit
+          }
           isPending={isImporting || isWaitingForTags}
         >
           Upload {secretCount} Secret{secretCount !== 1 ? "s" : ""}
```

---

### Incident Patch 8: `aeaa78a6` (2026-10-09)
**Commit Message**: Merge pull request #8356 from Infisical/feat/secret-reminder-alerts-ui

feat(reminders): deliver secret reminders through alert channels

**File**: `backend/CLAUDE.md` (modified, +25/-0)
```diff
@@ -69,6 +69,31 @@ Unit tests go next to source as `*.test.ts` and test pure functions with Vitest
 
 E2E tests live in `e2e-test/routes/`. The custom Vitest environment (`e2e-test/vitest-environment-knex.ts`) bootstraps a full server with DB, Redis, and encryption. Tests use injected globals: `testServer` (Fastify instance), `jwtAuthToken` (pre-authenticated JWT). Use `testServer.inject()` for HTTP assertions. Test helpers in `e2e-test/testUtils/` provide CRUD wrappers for secrets, folders, and secret imports. See `e2e-test/routes/v1/org.spec.ts` for a representative e2e test.
 
+#### Writing e2e tests with `testUtils`
+
+**Build test state with the helpers in `e2e-test/testUtils/`, not by hand.** Before writing a
+`testServer.inject` call or a `testDb` insert to set something up, check `testUtils/` for a helper
+that already does it. If none exists, add one there rather than a local helper in the spec: two
+specs had each written their own `createTargetUser` before `testUtils/users.ts` existed, and every
+copy drifts on its own.
+
+- **Isolate each test.** `createIsolatedOrgAndProject` (`fixtures.ts`) gives a test its own org and
+  project, a token scoped to it, and a `cleanup` that deletes the org. Prefer it over the shared
+  `seedData1` org and project, whose state leaks between tests and files.
+- **Don't lean on the seed user as a participant.** When a test needs someone other than the caller
+  (a recipient, a member, a target), create them with `createUser` and `addUserMembership`
+  (`users.ts`). Those write rows directly because signup needs SRP, so the user can be named but
+  cannot log in.
+- **Go through the API for everything else**, with the domain helpers (`secrets.ts`, `folders.ts`,
+  `alerts.ts`, `reminders.ts`, `identities.ts`, ...). Write a helper with `request()` (`request.ts`)
+  so a call is sent when made and a caller can `.expect()` a non-200 or take the `.raw()` response.
+- **Assert on outcomes a user would see**: an API response, an email in `testSmtp`, a message at a
+  fake destination. Read `testDb` only when the API cannot show the thing under test (eg an alert
+  orphaned by a cascade), and say why in a comment.
+- **Wait with `pollUntil`** (`poll.ts`) for anything asynchronous, never a fixed sleep.
+- **Run background jobs on demand** through a pass-through wrapper in `e2e-test/fakes/` (eg
+  `reminder-queue.ts` and `event-outbox-queue.ts`, driven by `runDailyReminders` in `reminders.ts`).
+
 #### Faking a third-party provider
 
 **Never add test-only code to `src/`** — no test-mode enum members, no lookup map entries, no
```

**File**: `backend/e2e-test/fakes/event-outbox-queue.ts` (added, +31/-0)
```diff
@@ -0,0 +1,31 @@
+import type { TEventOutboxServiceFactory } from "@app/services/event-outbox/event-outbox-service";
+
+// Reached through a path the alias does not match, so this resolves to the real module.
+import * as RealEventOutboxQueue from "../../src/services/event-outbox/event-outbox-queue";
+
+// Wraps the real outbox queue so a spec can deliver pending events now rather than waiting up to
+// OUTBOX_RELAY_INTERVAL_MS (plus start jitter) for the relay. Wired up by test.alias in
+// vitest.e2e.config.mts; nothing under src/ references this file.
+//
+// The relay keeps running alongside. Claims are exclusive, so an event is delivered once whichever
+// side gets to it first, and a spec should still wait on the outcome rather than on the drain.
+//
+// The handle hangs off globalThis for the reason given in aws-parameter-store-sync-fns.ts.
+const globalScope = globalThis as typeof globalThis & {
+  infisicalEventOutboxService?: Pick<TEventOutboxServiceFactory, "drain">;
+};
+
+export const eventOutboxQueueFactory: typeof RealEventOutboxQueue.eventOutboxQueueFactory = (deps) => {
+  // The shared test server boots first. A spec that boots and closes a second server of its own (eg
+  // api-run-modes.spec.ts) must not take the handle, or later specs would drive that closed server.
+  globalScope.infisicalEventOutboxService ??= deps.eventOutboxService;
+  return RealEventOutboxQueue.eventOutboxQueueFactory(deps);
+};
+
+export const eventOutbox = {
+  drain: async (consumer: string) => {
+    const service = globalScope.infisicalEventOutboxService;
+    if (!service) throw new Error("The test server has not wired the event outbox yet");
+    await service.drain({ consumer });
+  }
+};
```

**File**: `backend/e2e-test/fakes/reminder-queue.ts` (added, +35/-0)
```diff
@@ -0,0 +1,35 @@
+import type { TReminderServiceFactory } from "@app/services/reminder/reminder-types";
+
+// Reached through a path the alias does not match, so this resolves to the real module.
+import * as RealReminderQueue from "../../src/services/reminder/reminder-queue";
+
+// Wraps the real daily reminder job so a spec can run it on demand instead of waiting for the cron.
+// Wired up by test.alias in vitest.e2e.config.mts; nothing under src/ references this file.
+//
+// The job is real: it registers with the server's cron as usual, and the handle below calls the same
+// reminder service the handler does, wired with the server's own dependencies. Only the trigger
+// changes, and the spec can pass the day to run for instead of waiting for it.
+//
+// The handle hangs off globalThis for the reason given in aws-parameter-store-sync-fns.ts: the
+// server and a spec reach this module by different specifiers and get separate copies of it.
+const globalScope = globalThis as typeof globalThis & {
+  infisicalReminderService?: TReminderServiceFactory;
+};
+
+export const dailyReminderQueueServiceFactory: typeof RealReminderQueue.dailyReminderQueueServiceFactory = (deps) => {
+  // The shared test server boots first. A spec that boots and closes a second server of its own (eg
+  // api-run-modes.spec.ts) must not take the handle, or later specs would drive that closed server.
+  globalScope.infisicalReminderService ??= deps.reminderService;
+  return RealReminderQueue.dailyReminderQueueServiceFactory(deps);
+};
+
+const reminderService = () => {
+  const service = globalScope.infisicalReminderService;
+  if (!service) throw new Error("The test server has not wired the daily reminder job yet");
+  return service;
+};
+
+export const dailyReminderJob = {
+  dispatchDueReminders: (opts: { now: Date }) => reminderService().dispatchDueReminders(opts),
+  reapOrphanedReminderAlerts: () => reminderService().reapOrphanedReminderAlerts()
+};
```

**File**: `backend/e2e-test/routes/v1/alerts.spec.ts` (added, +129/-0)
```diff
@@ -0,0 +1,129 @@
+import { OrgMembershipRole, ProjectMembershipRole } from "@app/db/schemas";
+
+import { createAlert, deleteAlert, getAlert, listAlerts, updateAlert } from "../../testUtils/alerts";
+import { createIsolatedOrgAndProject } from "../../testUtils/fixtures";
+import { addIdentityToProject, createIdentityActor } from "../../testUtils/identities";
+import { addUserMembership, createUser, deleteUsers } from "../../testUtils/users";
+
+const RESOURCE_TYPE = "identity.authentication";
+const EVENT_TYPE = "identity.authentication.expiry";
+
+describe("Alerts API", () => {
+  let orgId: string;
+  let projectId: string;
+  let authToken: string;
+  let cleanup: () => Promise<void>;
+  let recipient: { userId: string; username: string };
+  let identityId: string;
+
+  beforeEach(async () => {
+    ({ orgId, projectId, authToken, cleanup } = await createIsolatedOrgAndProject("alerts"));
+    recipient = await createUser("alert-recipient");
+    await addUserMembership({ userId: recipient.userId, orgId, role: OrgMembershipRole.Member });
+    await addUserMembership({ userId: recipient.userId, orgId, projectId, role: ProjectMembershipRole.Member });
+    ({ identityId } = await createIdentityActor({ orgId, authToken }));
+    await addIdentityToProject({ projectId, identityId, role: ProjectMembershipRole.Admin, authToken });
+  });
+
+  afterEach(async () => {
+    await cleanup();
+    await deleteUsers([recipient.userId]);
+  });
+
+  const emailChannel = () => ({
+    name: "Email",
+    channelType: "email",
+    config: {},
+    recipients: [{ principalType: "user", principalId: recipient.userId }]
+  });
+  const webhookChannel = { name: "Webhook", channelType: "webhook", config: { url: "https://example.com/hook" } };
+
+  const identityAlert = (opts: { name: string; projectId?: string; channels?: Record<string, unknown>[] }) => ({
+    name: opts.name,
+    resourceType: RESOURCE_TYPE,
+    resourceId: identityId,
+    eventType: EVENT_TYPE,
+    condition: { alertBefore: "30d" },
+    ...(opts.projectId ? { projectId: opts.projectId } : {}),
+    channels: opts.channels ?? [emailChannel()]
+  });
+
+  test("an org listing returns only org-level alerts, and a project listing only that project's", async () => {
+    const orgAlert = await createAlert({ body: identityAlert({ name: "org-level" }), authToken });
+    const projectAlert = await createAlert({ body: identityAlert({ name: "project-level", projectId }), authToken });
+
+    const orgListing = await listAlerts({ resourceType: RESOURCE_TYPE, authToken });
+    expect(orgListing.map((alert) => alert.id)).toEqual([orgAlert.id]);
+
+    const projectListing = await listAlerts({ resourceType: RESOURCE_TYPE, projectId, authToken });
+    expect(projectListing.map((alert) => alert.id)).toEqual([projectAlert.id]);
+  });
+
+  // The API cannot show a channel that no alert references, so the channel rows are read directly.
+  test("updating channels keeps the ones referenced, removes the rest, and adds new ones", async () => {
+    const alert = await createAlert({
+      body: identityAlert({ name: "reconcile", channels: [emailChannel(), webhookChannel] }),
+      authToken
+    });
+    const email = alert.channels.find((channel) => channel.channelType === "email")!;
+    const webhook = alert.channels.find((channel) => channel.channelType === "webhook")!;
+
+    const updated = await updateAlert({
+      alertId: alert.id,
+      authToken,
+      body: {
+        channels: [
+          { id: email.id, name: "Renamed email", channelType: "email" },
+          { name: "Slack", channelType: "slack", config: { webhookUrl: "https://hooks.slack.com/services/T0/B0/x" } }
+        ]
+      }
+    });
+
+    expect(updated.channels.map((channel) => channel.channelType).sort()).toEqual(["email", "slack"]);
+    const keptEmail = updated.channels.find((channel) => channel.channelType === "email")!;
+    expect(keptEmail).toMatchObject({ id: email.id, name: "Renamed email" });
+    expect(keptEmail.recipients).toEqual([{ principalType: "user", principalId: recipient.userId }]);
+    expect(await testDb("alert_channels").where({ id: webhook.id })).toHaveLength(0);
+  });
+
+  test("updating with another alert's channel id is refused", async () => {
+    const first = await createAlert({ body: identityAlert({ name: "first" }), authToken });
+    const second = await createAlert({ body: identityAlert({ name: "second", projectId }), authToken });
+
+    const res = await updateAlert({
+      alertId: first.id,
+      authToken,
+      body: { channels: [{ id: second.channels[0].id, name: "Stolen", channelType: "email" }] }
+    }).raw();
+
+    expect(res.statusCode).toBe(400);
+    expect(res.json().message).toBe(`Channel '${second.channels[0].id}' does not belong to this alert`);
+    expect((await getAlert({ alertId: second.id, authToken })).channels.map((channel) => channel.id)).toEqual([
+      second.channels[0].id
+    ]);
+  });
+
+  // As above, the 
```

**File**: `backend/e2e-test/routes/v1/membership-downgrade-boundary.spec.ts` (modified, +36/-36)
```diff
@@ -23,6 +23,8 @@ import { packRules } from "@casl/ability/extra";
 import { AccessScope, OrgMembershipRole, ProjectMembershipRole, TableName } from "@app/db/schemas";
 import { seedData1 } from "@app/db/seed-data";
 
+import { addUserMembership, createUser } from "../../testUtils/users";
+
 const adminHeaders = () => ({ authorization: `Bearer ${jwtAuthToken}` });
 const asIdentity = (token: string) => ({ authorization: `Bearer ${token}` });
 
@@ -67,28 +69,6 @@ const createActorIdentity = async (name: string) => {
   return { identityId, token: loginRes.json().accessToken as string };
 };
 
-const createTargetUser = async (label: string) => {
-  const username = `${label}-${crypto.randomUUID()}@localhost.local`;
-  const [user] = await testDb(TableName.Users)
-    .insert({ username, email: username, firstName: label, isAccepted: true, isGhost: false })
-    .returning("id");
-  return { userId: (user as { id: string }).id, username };
-};
-
-const giveProjectMembership = async (userId: string, projectId: string, role: ProjectMembershipRole) => {
-  const [membership] = await testDb(TableName.Membership)
-    .insert({
-      scope: AccessScope.Project,
-      scopeOrgId: seedData1.organization.id,
-      scopeProjectId: projectId,
-      actorUserId: userId
-    })
-    .returning("id");
-  const membershipId = (membership as { id: string }).id;
-  await testDb(TableName.MembershipRole).insert({ membershipId, role });
-  return membershipId;
-};
-
 describe("Privilege boundary on project membership downgrade", () => {
   let project: { id: string };
   let actor: { identityId: string; token: string };
@@ -155,8 +135,13 @@ describe("Privilege boundary on project membership downgrade", () => {
     });
 
     test("baseline: DELETE on an Admin target follows the removal boundary", async () => {
-      const target = await createTargetUser("del");
-      const membershipId = await giveProjectMembership(target.userId, project.id, ProjectMembershipRole.Admin);
+      const target = await createUser("del");
+      const membershipId = await addUserMembership({
+        userId: target.userId,
+        orgId: seedData1.organization.id,
+        projectId: project.id,
+        role: ProjectMembershipRole.Admin
+      });
 
       const res = await testServer.inject({
         method: "DELETE",
@@ -168,8 +153,13 @@ describe("Privilege boundary on project membership downgrade", () => {
     });
 
     test("setting a more privileged member to no-access is bounded, like removing them", async () => {
-      const target = await createTargetUser("patch");
-      const membershipId = await giveProjectMembership(target.userId, project.id, ProjectMembershipRole.Admin);
+      const target = await createUser("patch");
+      const membershipId = await addUserMembership({
+        userId: target.userId,
+        orgId: seedData1.organization.id,
+        projectId: project.id,
+        role: ProjectMembershipRole.Admin
+      });
 
       const res = await testServer.inject({
         method: "PATCH",
@@ -182,8 +172,13 @@ describe("Privilege boundary on project membership downgrade", () => {
     });
 
     test("regression: downgrading to a real role stays bounded", async () => {
-      const target = await createTargetUser("patchv");
-      const membershipId = await giveProjectMembership(target.userId, project.id, ProjectMembershipRole.Admin);
+      const target = await createUser("patchv");
+      const membershipId = await addUserMembership({
+        userId: target.userId,
+        orgId: seedData1.organization.id,
+        projectId: project.id,
+        role: ProjectMembershipRole.Admin
+      });
 
       const res = await testServer.inject({
         method: "PATCH",
@@ -197,8 +192,13 @@ describe("Privilege boundary on project membership downgrade", () => {
 
   test("regression: an admin can still downgrade an Admin member to no-access", async () => {
     await setNewPrivilegeSystem(false);
-    const target = await createTargetUser("admin-downgrade");
-    const membershipId = await giveProjectMembership(target.userId, project.id, ProjectMembershipRole.Admin);
+    const target = await createUser("admin-downgrade");
+    const membershipId = await addUserMembership({
+      userId: target.userId,
+      orgId: seedData1.organization.id,
+      projectId: project.id,
+      role: ProjectMembershipRole.Admin
+    });
 
     const res = await testServer.inject({
       method: "PATCH",
@@ -230,12 +230,12 @@ describe("Privilege boundary on org membership downgrade", () => {
     });
 
   const createAdminTarget = async () => {
-    const { userId } = await createTargetUser("org-downgrade");
-    const [membership] = await testDb(TableName.Membership)
-      .insert({ scope: AccessScope.Organization, scopeOrgId: seedData1.organization.id, actorUserId: userId })
-      .returning("id");
-    const membershipId = (membership as { id: string }).id;
-    await testDb(TableName.MembershipRole).insert({ membershipId, rol
```

**File**: `backend/e2e-test/routes/v1/privilege-boundary-removal.spec.ts` (modified, +18/-44)
```diff
@@ -8,13 +8,13 @@
  * actor's role is exactly what the assertion is about.
  */
 
-import crypto from "node:crypto";
-
 import { packRules } from "@casl/ability/extra";
 
 import { AccessScope, OrgMembershipRole, ProjectMembershipRole, TableName } from "@app/db/schemas";
 import { seedData1 } from "@app/db/seed-data";
 
+import { addUserMembership, createUser } from "../../testUtils/users";
+
 const adminHeaders = () => ({ authorization: `Bearer ${jwtAuthToken}` });
 const asIdentity = (token: string) => ({ authorization: `Bearer ${token}` });
 
@@ -273,42 +273,6 @@ const findIdentityMembershipId = async (identityId: string, projectId?: string)
   return (row as { id: string }).id;
 };
 
-/**
- * The seed carries exactly one user and every removal path here targets a user membership. The routes
- * only need a non-ghost Users row joined to a Membership, never a login, so skip signup and SRP.
- */
-const createTargetUser = async (label: string) => {
-  const username = `${label}-${crypto.randomUUID()}@localhost.local`;
-  const [user] = await testDb(TableName.Users)
-    .insert({ username, email: username, firstName: label, isAccepted: true, isGhost: false })
-    .returning("id");
-
-  return { userId: (user as { id: string }).id, username };
-};
-
-const giveUserMembership = async ({
-  userId,
-  role,
-  projectId
-}: {
-  userId: string;
-  role: OrgMembershipRole | ProjectMembershipRole;
-  projectId?: string;
-}) => {
-  const [membership] = await testDb(TableName.Membership)
-    .insert({
-      scope: projectId ? AccessScope.Project : AccessScope.Organization,
-      scopeOrgId: seedData1.organization.id,
-      scopeProjectId: projectId ?? null,
-      actorUserId: userId
-    })
-    .returning("id");
-
-  const membershipId = (membership as { id: string }).id;
-  await testDb(TableName.MembershipRole).insert({ membershipId, role });
-  return membershipId;
-};
-
 const dropUser = async (userId: string) => {
   await testDb(TableName.Membership).where({ actorUserId: userId }).delete();
   await testDb(TableName.Users).where({ id: userId }).delete();
@@ -342,10 +306,14 @@ describe("Privilege boundary on org membership removal", () => {
     actor = await createActorIdentity("e2e-pb-org-actor");
     await useCustomRole(await findIdentityMembershipId(actor.identityId), roleId);
 
-    const target = await createTargetUser("e2e-pb-org-target");
+    const target = await createUser("e2e-pb-org-target");
     adminTarget = {
       userId: target.userId,
-      membershipId: await giveUserMembership({ userId: target.userId, role: OrgMembershipRole.Admin })
+      membershipId: await addUserMembership({
+        orgId: seedData1.organization.id,
+        userId: target.userId,
+        role: OrgMembershipRole.Admin
+      })
     };
   });
 
@@ -375,7 +343,8 @@ describe("Privilege boundary on org membership removal", () => {
       const res = await deleteOrgMembership(adminTarget.membershipId, adminHeaders());
       expect(res.statusCode).toBe(200);
 
-      adminTarget.membershipId = await giveUserMembership({
+      adminTarget.membershipId = await addUserMembership({
+        orgId: seedData1.organization.id,
         userId: adminTarget.userId,
         role: OrgMembershipRole.Admin
       });
@@ -413,10 +382,15 @@ describe("Privilege boundary on the bulk project member removal route", () => {
     await addIdentityToProject(project.id, actor.identityId, ProjectMembershipRole.Member);
     await useCustomRole(await findIdentityMembershipId(actor.identityId, project.id), roleId);
 
-    const target = await createTargetUser("e2e-pb-bulk-target");
+    const target = await createUser("e2e-pb-bulk-target");
     adminTarget = target;
-    await giveUserMembership({ userId: target.userId, role: OrgMembershipRole.Member });
-    await giveUserMembership({
+    await addUserMembership({
+      orgId: seedData1.organization.id,
+      userId: target.userId,
+      role: OrgMembershipRole.Member
+    });
+    await addUserMembership({
+      orgId: seedData1.organization.id,
       userId: target.userId,
       role: ProjectMembershipRole.Admin,
       projectId: project.id
```

**File**: `backend/e2e-test/routes/v1/secret-reminder.spec.ts` (added, +472/-0)
```diff
@@ -0,0 +1,472 @@
+import { OrgMembershipRole, ProjectMembershipRole, SecretType } from "@app/db/schemas";
+
+import { up as migrateRemindersToAlerts } from "../../../src/db/migrations/20260929130000_migrate-secret-reminders-to-alerts";
+import { updateAlert } from "../../testUtils/alerts";
+import { createIsolatedOrgAndProject } from "../../testUtils/fixtures";
+import { createFolder, deleteFolder } from "../../testUtils/folders";
+import {
+  deleteSecretReminder,
+  getSecretReminder,
+  listSecretReminderAlerts,
+  reapOrphanedReminderAlerts,
+  reminderEmailsFor,
+  runDailyReminders,
+  setSecretReminder,
+  waitForReminderEmails
+} from "../../testUtils/reminders";
+import { createSecretApprovalPolicy } from "../../testUtils/secret-approval-policies";
+import { createSecretV2, getSecretByNameV2, updateSecretV2 } from "../../testUtils/secrets";
+import { addUserMembership, createUser, deleteUsers } from "../../testUtils/users";
+
+const ENVIRONMENT = "dev";
+const DAY_MS = 24 * 60 * 60 * 1000;
+// Above pollUntil's own 20s, so a slow CI runner fails on what it was waiting for, not on vitest's 5s default.
+const EMAIL_DELIVERY_TIMEOUT_MS = 30_000;
+
+const startOfUtcDay = (date: Date) => {
+  const day = new Date(date);
+  day.setUTCHours(0, 0, 0, 0);
+  return day;
+};
+
+describe("Secret reminders delivered through alerts", () => {
+  let projectId: string;
+  let authToken: string;
+  let cleanup: () => Promise<void>;
+  // A project member other than the caller, so a reminder's recipients are never just whoever set it.
+  let member: { userId: string; username: string };
+  let createdUserIds: string[] = [];
+
+  const newUser = async (label: string) => {
+    const user = await createUser(label);
+    createdUserIds.push(user.userId);
+    return user;
+  };
+
+  beforeEach(async () => {
+    let orgId: string;
+    ({ orgId, projectId, authToken, cleanup } = await createIsolatedOrgAndProject("reminders"));
+    member = await newUser("reminder-recipient");
+    await addUserMembership({ userId: member.userId, orgId, role: OrgMembershipRole.Member });
+    await addUserMembership({ userId: member.userId, orgId, projectId, role: ProjectMembershipRole.Member });
+  });
+
+  afterEach(async () => {
+    await cleanup();
+    await deleteUsers(createdUserIds);
+    createdUserIds = [];
+  });
+
+  const createSecret = async (key: string, opts: { secretPath?: string } = {}) => {
+    const secret = await createSecretV2({
+      workspaceId: projectId,
+      environmentSlug: ENVIRONMENT,
+      secretPath: opts.secretPath ?? "/",
+      key,
+      value: "value",
+      authToken
+    });
+    return secret.id;
+  };
+
+  const reminderAlerts = (secretId: string) => listSecretReminderAlerts({ projectId, secretId, authToken });
+
+  // The alert API cannot show a reaped alert's channels (every read goes through the alert), so the
+  // rows that must go with it are checked directly.
+  const expectAlertFullyRemoved = async (alert: { id: string; channels: { id: string }[] }) => {
+    const channelIds = alert.channels.map((channel) => channel.id);
+    expect(channelIds.length).toBeGreaterThan(0);
+    expect(await testDb("alerts").where({ id: alert.id })).toHaveLength(0);
+    expect(await testDb("alert_channel_memberships").where({ alertId: alert.id })).toHaveLength(0);
+    expect(await testDb("alert_channels").whereIn("id", channelIds)).toHaveLength(0);
+    expect(await testDb("alert_channel_recipients").whereIn("channelId", channelIds)).toHaveLength(0);
+  };
+
+  const nextReminderDate = async (secretId: string) => {
+    const reminder = await getSecretReminder({ secretId, authToken });
+    expect(reminder).not.toBeNull();
+    return new Date(reminder?.nextReminderDate as string);
+  };
+
+  test("updating the reminder keeps channels added through the alert API", async () => {
+    const secretId = await createSecret("KEEP_WEBHOOK");
+    await setSecretReminder({ secretId, authToken, repeatDays: 30, message: "rotate it", recipients: [member.userId] });
+    const [alert] = await reminderAlerts(secretId);
+    expect(alert.name).toBe("Secret reminder");
+    expect(alert.channels).toEqual([
+      expect.objectContaining({
+        channelType: "email",
+        recipients: [{ principalType: "user", principalId: member.userId }]
+      })
+    ]);
+
+    await updateAlert({
+      alertId: alert.id,
+      authToken,
+      body: {
+        channels: [
+          { id: alert.channels[0].id, name: alert.channels[0].name, channelType: "email" },
+          { name: "Webhook", channelType: "webhook", config: { url: "https://example.com/reminders" } }
+        ]
+      }
+    });
+
+    await setSecretReminder({ secretId, authToken, repeatDays: 14 });
+
+    const [updated] = await reminderAlerts(secretId);
+    expect(updated.channels.map((channel) => channel.channelType).sort()).toEqual(["email", "webhook"]);
+    expect(updated.channels.find((channel) => channel.channelType === "email")?.recipie
```

**File**: `backend/e2e-test/testUtils/alerts.ts` (added, +83/-0)
```diff
@@ -0,0 +1,83 @@
+import { LightMyRequestResponse } from "fastify";
+
+import { request } from "./request";
+
+type TAlertRecord = {
+  id: string;
+  name: string;
+  projectId: string | null;
+  channels: {
+    id: string;
+    name: string;
+    channelType: string;
+    enabled: boolean;
+    recipients: { principalType: string; principalId: string }[];
+  }[];
+};
+
+const parseAlert = (res: LightMyRequestResponse) => {
+  expect(res.statusCode).toBe(200);
+  return res.json<{ alert: TAlertRecord }>().alert;
+};
+
+export const createAlert = (dto: { body: Record<string, unknown>; authToken: string }) =>
+  request(
+    {
+      method: "POST",
+      url: "/api/v1/alerts",
+      headers: { authorization: `Bearer ${dto.authToken}` },
+      body: dto.body
+    },
+    parseAlert
+  );
+
+export const getAlert = (dto: { alertId: string; authToken: string }) =>
+  request(
+    {
+      method: "GET",
+      url: `/api/v1/alerts/${dto.alertId}`,
+      headers: { authorization: `Bearer ${dto.authToken}` }
+    },
+    parseAlert
+  );
+
+export const listAlerts = (dto: { resourceType: string; projectId?: string; resourceId?: string; authToken: string }) =>
+  request(
+    {
+      method: "GET",
+      url: "/api/v1/alerts",
+      headers: { authorization: `Bearer ${dto.authToken}` },
+      query: {
+        resourceType: dto.resourceType,
+        ...(dto.projectId ? { projectId: dto.projectId } : {}),
+        ...(dto.resourceId ? { resourceId: dto.resourceId } : {})
+      }
+    },
+    (res) => {
+      expect(res.statusCode).toBe(200);
+      return res.json<{ alerts: TAlertRecord[] }>().alerts;
+    }
+  );
+
+export const updateAlert = (dto: { alertId: string; body: Record<string, unknown>; authToken: string }) =>
+  request(
+    {
+      method: "PATCH",
+      url: `/api/v1/alerts/${dto.alertId}`,
+      headers: { authorization: `Bearer ${dto.authToken}` },
+      body: dto.body
+    },
+    parseAlert
+  );
+
+export const deleteAlert = (dto: { alertId: string; authToken: string }) =>
+  request(
+    {
+      method: "DELETE",
+      url: `/api/v1/alerts/${dto.alertId}`,
+      headers: { authorization: `Bearer ${dto.authToken}` }
+    },
+    (res) => {
+      expect(res.statusCode).toBe(200);
+    }
+  );
```

---

### Incident Patch 9: `f28c85e4` (2026-10-09)
**Commit Message**: fix(docs): list the Cloudflare app connection as a prerequisite

**File**: `docs/integrations/secret-syncs/cloudflare-secrets-store.mdx` (modified, +1/-4)
```diff
@@ -6,13 +6,10 @@ description: "Learn how to configure a Cloudflare Secrets Store sync for Infisic
 
 A Cloudflare Secrets Store Sync pushes secrets from Infisical into your Cloudflare account's [Secrets Store](https://developers.cloudflare.com/secrets-store/), where Workers, AI Gateway, and Containers can use them. Each Infisical secret becomes a Secrets Store secret, with the same name unless you customize key names to add a prefix or suffix.
 
-<Note>
-    The Cloudflare Secrets Store Sync requires a [Cloudflare app connection](/integrations/app-connections/cloudflare#cloudflare-secrets-store) whose API token has the Secrets Store permissions.
-</Note>
-
 ## Prerequisites
 
 - A [project with secrets configured](/documentation/platform/secrets-mgmt/quick-starts/deliver-first-secret)
+- A [Cloudflare app connection](/integrations/app-connections/cloudflare#cloudflare-secrets-store) whose API token has the Secrets Store permissions
 - A store in your Cloudflare account (Cloudflare creates it the first time a Super Administrator or Secrets Store Admin opens **Secrets Store** in the Cloudflare dashboard)
 
 ## Set up the sync in Infisical
```

---

### Incident Patch 10: `6dc36bf8` (2026-10-09)
**Commit Message**: chore(agent-vault): fix stale test comment and notes

**File**: `backend/src/ee/services/agent-vault/CLAUDE.md` (modified, +4/-1)
```diff
@@ -55,12 +55,15 @@ and `packages/agentvault/` in the CLI repo. Frontend: `frontend/src/pages/agent-
   on project removal, org removal, SCIM and every FK cascade. Do not add an Agent Vault reaper.
 - `scopeResourceId` has no FK, so `deleteAccessBundle` deletes the bundle row first and then the grants in one
   transaction, and `addMembers` locks the bundle row (`lockByIdInProject`) before inserting. Keep that order.
-- Granting is batch: one POST carries `{ userIds, identityIds, groupIds }`. That lock is what makes
+- Granting is batch: one POST carries `{ userIds, machineIdentityIds, groupIds }`. That lock is what makes
   the dedupe read inside it authoritative, so an actor who already holds the bundle is returned in
   `skipped` rather than erroring; the unique index is only the backstop.
 - Member responses, for bundles and for the product, are the actor itself, flat (`type`, the actor's `id`,
   its profile) plus what the membership adds (`role`, `addedAt`, `grantedAt`). There is no membership id:
   every write names a member by its actor, so the id a client reads is the one it sends back.
+- Audit events name actors through `agent-vault-actor-name-fns.ts`. Resolve names before the write, so a
+  failed lookup can't leave a committed change unaudited, and attach a name only to an actor already proven
+  to be in the org: the lookup isn't org-scoped.
 - Reachability has one implementation, `findReachableAccessBundleIds` over the platform's
   `findResourceMembershipsForActor`, and mint, member-facing reads and resolve all call it. A group's grants
   count only while the group confers a live role (`liveGroupIdsFrom`). Write no group-expansion SQL here.
```

**File**: `backend/src/ee/services/agent-vault/agent-vault-actor-name-fns.test.ts` (modified, +0/-1)
```diff
@@ -33,7 +33,6 @@ describe("auditActorFields", () => {
     ).toEqual({ groupId: "group-1", groupName: "platform" });
   });
 
-  // An actor deleted between the write and the name lookup still has to be recorded by id.
   test("still records the id when the name could not be resolved", () => {
     expect(auditActorFields({ type: AgentVaultMemberType.Group, id: "group-1" })).toEqual({
       groupId: "group-1",
```

---

### Incident Patch 11: `242dbc9c` (2026-10-09)
**Commit Message**: fix(docs): update Cloudflare Secrets Store sync documentation for clarity and remove outdated steps

**File**: `docs/integrations/secret-syncs/cloudflare-secrets-store.mdx` (modified, +7/-29)
```diff
@@ -6,13 +6,16 @@ description: "Learn how to configure a Cloudflare Secrets Store sync for Infisic
 
 A Cloudflare Secrets Store Sync pushes secrets from Infisical into your Cloudflare account's [Secrets Store](https://developers.cloudflare.com/secrets-store/), where Workers, AI Gateway, and Containers can use them. Each Infisical secret becomes a Secrets Store secret, with the same name unless you customize key names to add a prefix or suffix.
 
+<Note>
+    The Cloudflare Secrets Store Sync requires a [Cloudflare app connection](/integrations/app-connections/cloudflare#cloudflare-secrets-store) whose API token has the Secrets Store permissions.
+</Note>
+
 ## Prerequisites
 
 - A [project with secrets configured](/documentation/platform/secrets-mgmt/quick-starts/deliver-first-secret)
-- A [Cloudflare app connection](/integrations/app-connections/cloudflare) whose API token has the **Account** > **Secrets Store** > **Edit** and **Account** > **Account Settings** > **Read** permissions
 - A store in your Cloudflare account (Cloudflare creates it the first time a Super Administrator or Secrets Store Admin opens **Secrets Store** in the Cloudflare dashboard)
 
-## Step 1: Set up the sync in Infisical
+## Set up the sync in Infisical
 
 <Tip>
     To create the sync using the API, use the [Create Cloudflare Secrets Store Sync](/api-reference/endpoints/secret-syncs/cloudflare-secrets-store/create) endpoint.
@@ -52,7 +55,7 @@ A Cloudflare Secrets Store Sync pushes secrets from Infisical into your Cloudfla
         - **Scopes**: The Cloudflare products allowed to use the synced secrets: **Workers**, **AI Gateway**, or **Containers** (defaults to **Workers**)
 
         <Note>
-            Infisical sets these scopes on every secret it writes, each time the sync runs. If you change a synced secret's scopes in Cloudflare, the next sync changes them back, and if you remove a scope from the sync, every secret the sync manages loses that scope. To give some secrets different scopes, sync them from another folder with a second sync, and customize key names on both syncs with prefixes that don't overlap, such as `WORKERS_{{secretKey}}` and `GATEWAY_{{secretKey}}`. Without separate prefixes, each sync treats the other's secrets as its own, and deletes them if **Prevent secret deletion** is off. If your organization has **Unique Secret Sync Destination Policy** turned on, Infisical rejects the second sync, because both syncs write to the same store.
+            Infisical applies these scopes every time it syncs, so if you remove a scope from the sync, every secret the sync manages loses that scope.
         </Note>
 
         ![Configure Destination](/images/secret-syncs/cloudflare-secrets-store/configure-destination.png)
@@ -108,39 +111,14 @@ A Cloudflare Secrets Store Sync pushes secrets from Infisical into your Cloudfla
     </Step>
 </Steps>
 
-## Step 2: Use the secrets in Cloudflare Workers
-
-A Worker can read a Secrets Store secret only through a binding in the Worker's configuration, and Infisical doesn't create bindings. After the first sync creates your secrets, add a binding for each secret the Worker uses. The secret must have the **Workers** scope, or Cloudflare rejects the binding when you deploy the Worker.
-
-<Steps>
-    <Step>
-        In the Cloudflare dashboard, open **Secrets Store** and copy the store ID.
-    </Step>
-    <Step>
-        In the Worker's Wrangler configuration file, add an entry to `secrets_store_secrets` for each secret, then deploy the Worker:
-
-        ```jsonc
-        {
-          "secrets_store_secrets": [
-            { "binding": "API_KEY", "store_id": "<store-id>", "secret_name": "API_KEY" }
-          ]
-        }
-        ```
-
-        In the Worker's code, read the value with `await env.API_KEY.get()`.
-    </Step>
-</Steps>
-
-To use the secrets with AI Gateway or Containers, see Cloudflare's [Secrets Store documentation](https://developers.cloudflare.com/secrets-store/).
-
 ## FAQ
 
 <AccordionGroup>
     <Accordion title="How many secrets can a sync write?">
         While Secrets Store is in open beta, a Cloudflare account can hold 100 Secrets Store secrets in total, including secrets that other syncs and tools created. Before writing anything, the sync checks whether its new secrets fit. If they don't fit, the sync fails without writing any secrets. Secrets that the sync removes are deleted only after the new secrets are created, so they still count toward the limit during that sync.
     </Accordion>
     <Accordion title="What happens when I rename a secret in Infisical?">
-        Cloudflare can't rename a secret, so the sync creates a secret with the new name. If **Prevent secret deletion** is off, the sync then deletes the secret with the old name. Update the `secret_name` in any Worker binding that used the old name.
+        Cloudflare can't rename a secret, so the sync creates a secret with the new name. If **Prevent secret deletion** is off, the sync the
```

---

### Incident Patch 12: `e57039f0` (2026-10-09)
**Commit Message**: Greptile comment fixes

**File**: `backend/src/lib/validator/safe-request.socket.test.ts` (modified, +25/-9)
```diff
@@ -1,4 +1,5 @@
 /* eslint-disable @typescript-eslint/no-explicit-any */
+import type { LookupAllOptions } from "node:dns";
 import http from "node:http";
 import type { AddressInfo } from "node:net";
 
@@ -14,7 +15,8 @@ import { buildSsrfSafeAgent } from "./safe-request";
 // or Docker, and never opens a socket to anything other than 127.0.0.1 (the
 // control test does a single DNS lookup of an RFC 6761 `.invalid` name, which
 // resolves nowhere and contacts no real external host).
-const { configState } = vi.hoisted(() => ({
+const { configState, validationAnswer } = vi.hoisted(() => ({
+  validationAnswer: { address: "127.0.0.1" },
   configState: {
     isDevelopmentMode: false,
     // Allow the loopback address to pass validation so we can pin to it.
@@ -26,6 +28,15 @@ const { configState } = vi.hoisted(() => ({
   }
 }));
 
+vi.mock("node:dns/promises", async (importOriginal) => {
+  const actual = await importOriginal<typeof import("node:dns/promises")>();
+  const lookup = (hostname: string, options: LookupAllOptions) =>
+    hostname === "pinned-rebind.invalid"
+      ? Promise.resolve([{ address: validationAnswer.address, family: 4 }])
+      : actual.lookup(hostname, options);
+  return { ...actual, lookup, default: { ...actual, lookup } };
+});
+
 vi.mock("@app/lib/config/env", () => ({
   getConfig: () => configState
 }));
@@ -96,18 +107,23 @@ describe("safe-request real-socket pinning", () => {
     });
   });
 
-  it("pins the connection to the validated IP even when the connect-time hostname differs (anti-rebinding)", async () => {
-    // The agent was validated/pinned against 127.0.0.1. We then issue a request
-    // to a different, unresolvable hostname reusing that agent, simulating a
-    // DNS record that flipped between validation and connect. Because the pinned
-    // lookup ignores connect-time DNS, the socket still lands on the loopback
-    // server. If pinning were bypassed, this would fail with ENOTFOUND (proven
-    // by the control test above).
-    const agent = await buildSsrfSafeAgent(`http://127.0.0.1:${port}`, { keepAlive: false });
+  it("pins the connection to the validated IP when connect-time DNS for the same hostname differs (anti-rebinding)", async () => {
+    validationAnswer.address = "127.0.0.1";
+    const agent = await buildSsrfSafeAgent(`http://pinned-rebind.invalid:${port}`, { keepAlive: false });
 
     const res = await httpGet({ hostname: "pinned-rebind.invalid", port, path: "/rebind", agent });
 
     expect(res.status).toBe(200);
     expect(receivedPaths).toContain("/rebind");
   });
+
+  it("resolves hostnames other than the validated one normally, so a forward proxy is reached at its own address", async () => {
+    validationAnswer.address = "192.0.2.1";
+    const agent = await buildSsrfSafeAgent(`http://pinned-rebind.invalid:${port}`, { keepAlive: false });
+
+    const res = await httpGet({ hostname: "localhost", port, path: "/proxy-host", agent });
+
+    expect(res.status).toBe(200);
+    expect(receivedPaths).toContain("/proxy-host");
+  });
 });
```

**File**: `backend/src/lib/validator/safe-request.test.ts` (modified, +10/-0)
```diff
@@ -132,6 +132,16 @@ describe("safe-request SSRF helpers", () => {
       expect(lookupMock).not.toHaveBeenCalled();
     });
 
+    it("allows literal local hostnames when ALLOW_INTERNAL_IP_CONNECTIONS is set", async () => {
+      configState.ALLOW_INTERNAL_IP_CONNECTIONS = true;
+      setLookup([{ address: LOOPBACK_IP_V4, family: 4 }]);
+
+      await expect(validateAndPinUrl("http://localhost:8080")).resolves.toEqual({
+        hostname: "localhost",
+        entries: [{ address: LOOPBACK_IP_V4, family: 4 }]
+      });
+    });
+
     it("rejects RFC1918 / loopback IPs by default", async () => {
       setLookup([{ address: PRIVATE_IP_V4, family: 4 }]);
       await expect(validateAndPinUrl("https://example.com")).rejects.toThrow(/Local IPs not allowed/i);
```

**File**: `backend/src/lib/validator/safe-request.ts` (modified, +8/-4)
```diff
@@ -1,4 +1,4 @@
-import { LookupAddress } from "node:dns";
+import { lookup as dnsLookup, LookupAddress } from "node:dns";
 import dns from "node:dns/promises";
 import http from "node:http";
 import https from "node:https";
@@ -64,7 +64,7 @@ export const validateAndPinUrl = async (
   if (isIP(rawHost)) {
     entries = [{ address: rawHost, family: isIP(rawHost) }];
   } else {
-    if (rawHost === "localhost" || rawHost === "host.docker.internal") {
+    if (!appCfg.ALLOW_INTERNAL_IP_CONNECTIONS && (rawHost === "localhost" || rawHost === "host.docker.internal")) {
       logger.warn(`safeRequest: rejecting literal local hostname [hostname=${rawHost}]`);
       throw new BadRequestError({ message: "Local IPs not allowed as URL" });
     }
@@ -118,8 +118,12 @@ const pickPreferredEntry = (entries: LookupAddress[]): LookupAddress =>
 // dns.lookup-shaped function that always returns the pre-validated IPs.
 // Installed on an http(s).Agent so connect-time DNS cannot land on a different
 // IP than the one validation approved.
-const makePinnedLookup = (entries: LookupAddress[]): LookupFunction =>
+const makePinnedLookup = ({ hostname: validatedHostname, entries }: TValidatedHost): LookupFunction =>
   ((hostname: string, optionsOrCb: unknown, maybeCb?: unknown) => {
+    if ((hostname.endsWith(".") ? hostname.slice(0, -1) : hostname) !== validatedHostname) {
+      (dnsLookup as (...args: unknown[]) => void)(hostname, optionsOrCb, maybeCb);
+      return;
+    }
     if (typeof optionsOrCb === "function") {
       const first = pickPreferredEntry(entries);
       (optionsOrCb as TLookupOneCallback)(null, first.address, first.family);
@@ -241,7 +245,7 @@ const constructAgent = (
   opts: TBuildAgentOptions
 ): http.Agent | https.Agent => {
   const isHttps = protocol === "https:";
-  const lookup = validated ? makePinnedLookup(validated.entries) : undefined;
+  const lookup = validated ? makePinnedLookup(validated) : undefined;
   // Default keepAlive: true so cached agents reuse connections.
   const baseOpts: http.AgentOptions = {
     keepAlive: opts.keepAlive ?? true,
```

---

### Incident Patch 13: `66ffc50c` (2026-10-09)
**Commit Message**: Merge pull request #8535 from Infisical/fix/secrets-manager-product-key

fix(billing): use secrets_manager product key for Secrets Management

**File**: `backend/src/ee/routes/v1/license-v2-router.ts` (modified, +1/-1)
```diff
@@ -268,7 +268,7 @@ const BillingV2PreviewSchema = z.object({
 // subscription id comes back (the DB mirror catches up via webhook, so the UI refetches overview).
 const BillingV2MutationResultSchema = z.object({ subscriptionId: z.string().optional() });
 
-// Product and plan keys are short catalog identifiers (e.g. "secrets_management", "advanced").
+// Product and plan keys are short catalog identifiers (e.g. "secrets_manager", "advanced").
 const BillingV2KeySchema = z.string().trim().min(1).max(64);
 
 const BillingV2QuantitiesSchema = z.record(z.string().trim(), z.number().int().min(0));
```

**File**: `frontend/src/components/license/UpgradeGate/upgrade-intents.ts` (modified, +1/-1)
```diff
@@ -1,5 +1,5 @@
 export const BillingProduct = {
-  SecretsManagement: "secrets_management",
+  SecretsManagement: "secrets_manager",
   CertificateManagement: "cert_management",
   Pam: "pam"
 } as const;
```

**File**: `frontend/src/components/license/product-plan-summary.ts` (modified, +2/-2)
```diff
@@ -1,7 +1,7 @@
 import { SubscriptionPlan } from "@app/hooks/api/subscriptions/types";
 
 const PRODUCT_NAMES = new Map([
-  ["secrets_management", "Secrets Management"],
+  ["secrets_manager", "Secrets Management"],
   ["cert_management", "Certificate Management"],
   ["pam", "Privileged Access Management"],
   ["agent_vault", "Agent Vault"]
@@ -35,7 +35,7 @@ export const getProductPlanSummaries = (plans: SubscriptionPlan["productPlans"])
     if (!planKey || planKey === "free") return;
 
     const productKey =
-      plan.productKey === "legacy_secret_management" ? "secrets_management" : plan.productKey;
+      plan.productKey === "legacy_secret_management" ? "secrets_manager" : plan.productKey;
     if (summaries.has(productKey) && plan.productKey !== productKey) return;
 
     summaries.set(productKey, {
```

**File**: `frontend/src/layouts/ProjectLayout/components/TypeSelect/ProductPlanBadge.tsx` (modified, +1/-1)
```diff
@@ -4,7 +4,7 @@ import { useSubscription } from "@app/context";
 import { ProjectType } from "@app/hooks/api/projects/types";
 
 const PRODUCT_KEYS: Partial<Record<ProjectType, string>> = {
-  [ProjectType.SecretManager]: "secrets_management",
+  [ProjectType.SecretManager]: "secrets_manager",
   [ProjectType.CertificateManager]: "cert_management",
   [ProjectType.PAM]: "pam"
 };
```

---

### Incident Patch 14: `7d99f1d9` (2026-10-09)
**Commit Message**: fix(billing): use secrets_manager product key for Secrets Management

Co-authored-by: capy-ai[bot] <230910855+capy-ai[bot]@users.noreply.github.com>

**File**: `backend/src/ee/routes/v1/license-v2-router.ts` (modified, +1/-1)
```diff
@@ -268,7 +268,7 @@ const BillingV2PreviewSchema = z.object({
 // subscription id comes back (the DB mirror catches up via webhook, so the UI refetches overview).
 const BillingV2MutationResultSchema = z.object({ subscriptionId: z.string().optional() });
 
-// Product and plan keys are short catalog identifiers (e.g. "secrets_management", "advanced").
+// Product and plan keys are short catalog identifiers (e.g. "secrets_manager", "advanced").
 const BillingV2KeySchema = z.string().trim().min(1).max(64);
 
 const BillingV2QuantitiesSchema = z.record(z.string().trim(), z.number().int().min(0));
```

**File**: `frontend/src/components/license/UpgradeGate/upgrade-intents.ts` (modified, +1/-1)
```diff
@@ -1,5 +1,5 @@
 export const BillingProduct = {
-  SecretsManagement: "secrets_management",
+  SecretsManagement: "secrets_manager",
   CertificateManagement: "cert_management",
   Pam: "pam"
 } as const;
```

**File**: `frontend/src/components/license/product-plan-summary.ts` (modified, +2/-2)
```diff
@@ -1,7 +1,7 @@
 import { SubscriptionPlan } from "@app/hooks/api/subscriptions/types";
 
 const PRODUCT_NAMES = new Map([
-  ["secrets_management", "Secrets Management"],
+  ["secrets_manager", "Secrets Management"],
   ["cert_management", "Certificate Management"],
   ["pam", "Privileged Access Management"],
   ["agent_vault", "Agent Vault"]
@@ -35,7 +35,7 @@ export const getProductPlanSummaries = (plans: SubscriptionPlan["productPlans"])
     if (!planKey || planKey === "free") return;
 
     const productKey =
-      plan.productKey === "legacy_secret_management" ? "secrets_management" : plan.productKey;
+      plan.productKey === "legacy_secret_management" ? "secrets_manager" : plan.productKey;
     if (summaries.has(productKey) && plan.productKey !== productKey) return;
 
     summaries.set(productKey, {
```

**File**: `frontend/src/layouts/ProjectLayout/components/TypeSelect/ProductPlanBadge.tsx` (modified, +1/-1)
```diff
@@ -4,7 +4,7 @@ import { useSubscription } from "@app/context";
 import { ProjectType } from "@app/hooks/api/projects/types";
 
 const PRODUCT_KEYS: Partial<Record<ProjectType, string>> = {
-  [ProjectType.SecretManager]: "secrets_management",
+  [ProjectType.SecretManager]: "secrets_manager",
   [ProjectType.CertificateManager]: "cert_management",
   [ProjectType.PAM]: "pam"
 };
```

---

### Incident Patch 15: `d0a80566` (2026-10-09)
**Commit Message**: docs(agent-vault): add programmatic guides (#8524)

* docs(agent-vault): add programmatic guides

* Update docs/snippets/agent-vault/MachineIdentitySetup.mdx

Co-authored-by: greptile-apps[bot] <165735046+greptile-apps[bot]@users.noreply.github.com>

* Update docs/documentation/platform/agent-vault/sessions-api.mdx

Co-authored-by: greptile-apps[bot] <165735046+greptile-apps[bot]@users.noreply.github.com>

* address greptile

* address veria

* address jake comments

---------

Co-authored-by: greptile-apps[bot] <165735046+greptile-apps[bot]@users.noreply.github.com>

**File**: `docs/docs.json` (modified, +4/-1)
```diff
@@ -810,7 +810,8 @@
                     "pages": [
                       "documentation/platform/agent-vault/guides/openclaw-gateway"
                     ]
-                  }
+                  },
+                  "documentation/platform/agent-vault/guides/custom-agent"
                 ]
               },
               {
@@ -823,6 +824,8 @@
                     "group": "Sessions",
                     "root": "documentation/platform/agent-vault/sessions",
                     "pages": [
+                      "documentation/platform/agent-vault/sessions-cli",
+                      "documentation/platform/agent-vault/sessions-api",
                       "documentation/platform/agent-vault/session-logs"
                     ]
                   },
```

**File**: `docs/documentation/platform/agent-vault/guides/custom-agent.mdx` (added, +275/-0)
```diff
@@ -0,0 +1,275 @@
+---
+title: "Connect your own agent to Agent Vault"
+sidebarTitle: "Your own agent"
+description: "Launch your custom agent with Agent Vault so it can make authenticated API calls without needing an actual token."
+---
+
+import SeparateMachinesNote from "/snippets/agent-vault/SeparateMachinesNote.mdx";
+
+If you have a custom agent harness that you start from code rather than a CLI, you can connect it to Agent Vault via the Infisical API. The agent's HTTP client sends each request through an Agent Vault [proxy](/documentation/platform/agent-vault/proxies) with a [session](/documentation/platform/agent-vault/sessions) token, and the proxy attaches the real credential before forwarding the request to the API.
+
+## Prerequisites
+
+- An Infisical organization where you're an [Agent Vault admin](/documentation/platform/agent-vault/access-control#product-membership)
+- The [Infisical CLI](/cli/install) installed on the machine that will run the proxy
+- The API keys your agent uses, such as its model provider's key
+
+<SeparateMachinesNote />
+
+## Step 1: Set up Agent Vault
+
+### Create an access bundle
+
+First, create an [access bundle](/documentation/platform/agent-vault/access-bundles) that holds a [service](/documentation/platform/agent-vault/services) for each API your agent calls.
+
+<Steps>
+  <Step>
+    In Infisical, open **Agent Vault** from the product switcher and go to **Access Bundles**.
+  </Step>
+  <Step>
+    Select **Create Access Bundle**. Give the access bundle a **Name**, such as `my-agent`, then select **Create Access Bundle**.
+  </Step>
+  <Step>
+    Select the access bundle you just created, then select **Add Service**.
+  </Step>
+  <Step>
+    On the **Choose a template** panel, pick the template for the API, or select **Custom** and enter the API's host.
+  </Step>
+  <Step>
+    On the **Credential** step, paste the real API key.
+
+    <Note>
+      If the API expects the key somewhere other than a header, such as in the URL, [add a substitution](/documentation/platform/agent-vault/services#add-a-substitution) instead. Note the placeholder you enter in **Replace**, because your agent sends it in [Step 3](#step-3-replace-the-api-keys-with-placeholders).
+    </Note>
+  </Step>
+  <Step>
+    Select **Add Service**. Repeat from the third step for each remaining API.
+  </Step>
+</Steps>
+
+### Enroll a proxy
+
+Next, enroll a proxy. Every request your agent makes goes through the proxy, which attaches the real credential from the access bundle before forwarding the request to the API.
+
+<Steps>
+  <Step>
+    Go to **Proxies** and select **Create Proxy**.
+  </Step>
+  <Step>
+    Give the proxy a **Name**, then select **Create**.
+  </Step>
+  <Step>
+    In the **Enrollment Token** dialog, copy the command from the **CLI** tab, or from the **Docker** or **systemd** tab to keep the proxy running after you close the terminal. The enrollment token expires in an hour.
+  </Step>
+  <Step>
+    Run the command on the machine that will run the proxy.
+  </Step>
+</Steps>
+
+The proxy listens on port `17323`. Make sure the agent's machine can reach that port, and note the proxy machine's address.
+
+### Create a session
+
+Finally, create a session. The session token is the only credential your agent has.
+
+<Steps>
+  <Step>
+    Go to **Sessions** and select **Create Session**.
+  </Step>
+  <Step>
+    Pick the access bundle you created, set a duration under **Expires**, then select **Create Session**.
+  </Step>
+  <Step>
+    Copy the session token from the command in the dialog. It's the value after `--session-token`. The token appears once and can't be retrieved again.
+  </Step>
+</Steps>
+
+<Tip>
+  You can also [create sessions from your own code](/documentation/platform/agent-vault/sessions-api) instead of in the Infisical UI.
+</Tip>
+
+## Step 2: Download the proxy's certificate
+
+The proxy decrypts each HTTPS request to attach the credential, so the agent has to trust the proxy's certificate authority. On the agent's machine, download the certificate from the proxy:
+
+```bash
+curl -fsS http://<proxy-host>:17323/_agent-vault/ca | jq -er .certificate > ca.pem
+```
+
+The certificate travels over plain HTTP, so check that it came from your proxy before you trust it. Print its fingerprint:
+
+```bash
+openssl x509 -in ca.pem -noout -fingerprint -sha256
+```
+
+Compare the colon-separated value with the proxy's fingerprint on the **Proxies** page in Agent Vault. The **Certificate Authority** column shows the start of the fingerprint, and hovering over it shows the full value. If the values don't match, don't use the file.
+
+Store `ca.pem` where the agent can read it. The certificate isn't secret, so you can add it to the agent's container image. If you [re-enroll the proxy](/documentation/platform/agent-vault/proxies#re-enroll-a-proxy), download the certificate again.
+
+## Step 3: Replace the API keys with placeholders
+
+Delete the real API keys fr
```

**File**: `docs/documentation/platform/agent-vault/guides/hermes-gateway.mdx` (modified, +10/-3)
```diff
@@ -6,7 +6,7 @@ description: "Learn how to run the Hermes Agent gateway through Agent Vault so H
 
 import SeparateMachinesNote from "/snippets/agent-vault/SeparateMachinesNote.mdx";
 
-This guide walks you through running the [Hermes Agent](https://hermes-agent.nousresearch.com/docs/) [gateway](https://hermes-agent.nousresearch.com/docs/user-guide/messaging) through Agent Vault, so Hermes can make authenticated API calls without holding any real credentials. The gateway connects Hermes to a messaging platform such as Slack or Telegram.
+This guide walks you through running the [Hermes Agent](https://hermes-agent.nousresearch.com/docs/) [gateway](https://hermes-agent.nousresearch.com/docs/user-guide/messaging) through Agent Vault, so Hermes can make authenticated API calls without holding any real credentials. The gateway connects Hermes to a messaging platform such as Telegram.
 
 <Tip>
   If you use Hermes in your terminal, follow [Agent Vault with Hermes](/documentation/platform/agent-vault/guides/hermes) instead.
@@ -82,7 +82,7 @@ Most Hermes setups have three kinds of API keys:
 | Kind | Example keys | Service to add in Step 2 |
 | --- | --- | --- |
 | Model provider (the LLM API Hermes sends its prompts to) | `OPENROUTER_API_KEY`, `ANTHROPIC_API_KEY`, `OPENAI_API_KEY` | The provider's template, such as **OpenRouter**, **Anthropic**, or **OpenAI** |
-| Messaging platform (where you chat with Hermes) | `SLACK_BOT_TOKEN` and `SLACK_APP_TOKEN`, `TELEGRAM_BOT_TOKEN` | The **Slack** template, or a **Custom** service for `api.telegram.org` |
+| Messaging platform (where you chat with Hermes) | `TELEGRAM_BOT_TOKEN` | A **Custom** service for `api.telegram.org` |
 | External APIs | `GITHUB_TOKEN` | The API's template, such as **GitHub** (or a **Custom** service if Infisical has no template for the API) |
 
 <Note>
@@ -116,7 +116,7 @@ First, create an [access bundle](/documentation/platform/agent-vault/access-bund
     [Add a substitution](/documentation/platform/agent-vault/services#add-a-substitution) for each key instead if either of these is true:
 
     - The API expects the key outside a header, such as in the URL path. For example, Telegram's bot token goes in the URL of every request: `https://api.telegram.org/bot<token>/getUpdates`
-    - The API uses more than one key, such as Slack's bot token and app token (one service can hold a substitution for each key, and an access bundle can't have two services for the same host)
+    - The API uses more than one key (one service can hold a substitution for each key, and an access bundle can't have two services for the same host)
 
     Note the placeholder you enter in **Replace**, because you'll put it in `~/.hermes/.env` in [Step 3](#replace-the-api-keys-with-placeholders).
     </Note>
@@ -317,6 +317,10 @@ To stop Hermes from using the real credentials, open **Agent Vault** in Infisica
 
 To give the gateway a new session, [create a session](#create-a-session) in Infisical. Then, on the Hermes machine, replace the token in both `HTTPS_PROXY` and `HTTP_PROXY` in `~/.hermes/.env` and run `hermes gateway restart`.
 
+<Tip>
+To replace the session on a schedule instead of by hand, script these steps and [create the session with the API](/documentation/platform/agent-vault/sessions-api).
+</Tip>
+
 ## Troubleshooting
 
 Hermes writes the gateway's logs to `~/.hermes/logs/gateway.log`. On Linux, you can also read them with `journalctl --user -u hermes-gateway`, or `journalctl -u hermes-gateway` for a gateway installed with `--system`.
@@ -407,6 +411,9 @@ Hermes writes the gateway's logs to `~/.hermes/logs/gateway.log`. On Linux, you
     
     Fix the cause, then run `hermes gateway start`.
   </Accordion>
+  <Accordion title="The gateway logs WebSocket connection errors">
+    The proxy doesn't carry [WebSocket connections](/documentation/platform/agent-vault/proxies#supported-connections). If Hermes connects to a messaging platform over a WebSocket, that platform doesn't work through Agent Vault.
+  </Accordion>
 </AccordionGroup>
 
 ## Next steps
```

**File**: `docs/documentation/platform/agent-vault/guides/openclaw-gateway.mdx` (modified, +17/-4)
```diff
@@ -6,7 +6,7 @@ description: "Learn how to run the OpenClaw gateway through Agent Vault so OpenC
 
 import SeparateMachinesNote from "/snippets/agent-vault/SeparateMachinesNote.mdx";
 
-This guide walks you through running the [OpenClaw](https://docs.openclaw.ai/) [gateway](https://docs.openclaw.ai/gateway) through Agent Vault, so OpenClaw can make authenticated API calls without holding any real credentials. The gateway connects OpenClaw to a messaging platform such as Slack or Telegram.
+This guide walks you through running the [OpenClaw](https://docs.openclaw.ai/) [gateway](https://docs.openclaw.ai/gateway) through Agent Vault, so OpenClaw can make authenticated API calls without holding any real credentials. The gateway connects OpenClaw to a messaging platform such as Telegram.
 
 <Tip>
   If you use OpenClaw in your terminal, follow [Agent Vault with OpenClaw](/documentation/platform/agent-vault/guides/openclaw) instead.
@@ -76,7 +76,7 @@ Most OpenClaw setups have three kinds of API keys:
 | Kind | Example keys | Service to add in Step 2 |
 | --- | --- | --- |
 | Model provider (the LLM API OpenClaw sends its prompts to) | `OPENROUTER_API_KEY`, `ANTHROPIC_API_KEY`, `OPENAI_API_KEY` | The provider's template, such as **OpenRouter**, **Anthropic**, or **OpenAI** |
-| Messaging platform (where you chat with OpenClaw) | `channels.telegram.botToken` or `TELEGRAM_BOT_TOKEN` | A **Custom** service for `api.telegram.org`, or the platform's template, such as **Slack** |
+| Messaging platform (where you chat with OpenClaw) | `channels.telegram.botToken` or `TELEGRAM_BOT_TOKEN` | A **Custom** service for `api.telegram.org` |
 | External APIs | `GITHUB_TOKEN` | The API's template, such as **GitHub** (or a **Custom** service if Infisical has no template for the API) |
 
 <Note>
@@ -110,7 +110,7 @@ First, create an [access bundle](/documentation/platform/agent-vault/access-bund
     [Add a substitution](/documentation/platform/agent-vault/services#add-a-substitution) for each key instead if either of these is true:
 
     - The API expects the key outside a header, such as in the URL path. For example, Telegram's bot token goes in the URL of every request: `https://api.telegram.org/bot<token>/getUpdates`
-    - The API uses more than one key, such as Slack's bot token and app token (one service can hold a substitution for each key, and an access bundle can't have two services for the same host)
+    - The API uses more than one key (one service can hold a substitution for each key, and an access bundle can't have two services for the same host)
 
     Note the placeholder you enter in **Replace**, because you'll give it to OpenClaw in [Step 3](#replace-the-api-keys-with-placeholders).
     </Note>
@@ -282,7 +282,13 @@ Set OpenClaw's proxy URL, replacing `<session-token>` with the token from [Step
 openclaw config set proxy.proxyUrl http://x-agent-vault:<session-token>@<proxy-host>:17323
 ```
 
-OpenClaw routes all of the gateway's outbound HTTP and WebSocket traffic through this proxy, including traffic from its messaging platform clients. Then reinstall the gateway service so it picks up the new settings. This also restarts the gateway.
+OpenClaw routes all of the gateway's outbound traffic through this proxy, including traffic from its messaging platform clients.
+
+<Note>
+The proxy doesn't carry [WebSocket connections](/documentation/platform/agent-vault/proxies#supported-connections), so a messaging platform that OpenClaw connects to over a WebSocket, such as Discord, fails through the proxy.
+</Note>
+
+Then reinstall the gateway service so it picks up the new settings. This also restarts the gateway.
 
 ```bash
 openclaw gateway install --force
@@ -327,6 +333,10 @@ To stop OpenClaw from using the real credentials, open **Agent Vault** in Infisi
 
 To give the gateway a new session, [create a session](#create-a-session) in Infisical. Then, on the OpenClaw machine, run `openclaw config set proxy.proxyUrl` again with the new token, and run `openclaw gateway restart`.
 
+<Tip>
+To replace the session on a schedule instead of by hand, script these steps and [create the session with the API](/documentation/platform/agent-vault/sessions-api).
+</Tip>
+
 ## Troubleshooting
 
 To follow the gateway's logs, run `openclaw logs --follow`. To check the gateway's configuration and service, run `openclaw doctor`.
@@ -413,6 +423,9 @@ To follow the gateway's logs, run `openclaw logs --follow`. To check the gateway
   <Accordion title="The gateway is stuck waiting for state ownership">
     Another OpenClaw process may be using OpenClaw's state, usually an `openclaw tui --local` session from the [terminal guide](/documentation/platform/agent-vault/guides/openclaw). The gateway waits for that process to exit. Quit the terminal session, then run `openclaw gateway restart`.
   </Accordion>
+  <Accordion title="The gateway logs WebSocket connection errors">
+    The proxy doesn't carry [WebSocket connections](/documentation/platf
```

**File**: `docs/documentation/platform/agent-vault/overview.mdx` (modified, +19/-0)
```diff
@@ -22,6 +22,19 @@ Infisical Agent Vault is an access layer for AI agents. It securely equips agent
   </Card>
 </CardGroup>
 
+## Agent guides
+
+Set up Agent Vault for the agent you use, or for an agent you wrote yourself.
+
+<CardGroup cols={3}>
+  <Card title="Claude Code" icon="terminal" href="/documentation/platform/agent-vault/guides/claude-code" />
+  <Card title="Codex" icon="terminal" href="/documentation/platform/agent-vault/guides/codex" />
+  <Card title="OpenCode" icon="terminal" href="/documentation/platform/agent-vault/guides/opencode" />
+  <Card title="Hermes Agent" icon="bot" href="/documentation/platform/agent-vault/guides/hermes" />
+  <Card title="OpenClaw" icon="bot" href="/documentation/platform/agent-vault/guides/openclaw" />
+  <Card title="Your own agent" icon="code" href="/documentation/platform/agent-vault/guides/custom-agent" />
+</CardGroup>
+
 ## Concepts
 
 <CardGroup cols={2}>
@@ -37,6 +50,12 @@ Infisical Agent Vault is an access layer for AI agents. It securely equips agent
   <Card title="Sessions" icon="monitor" href="/documentation/platform/agent-vault/sessions">
     Time-bound grants that let AI agents access services without holding real credentials.
   </Card>
+  <Card title="Create sessions with the CLI" icon="calendar-clock" href="/documentation/platform/agent-vault/sessions-cli">
+    Start an agent from cron, a container, or CI, with a new session for each run.
+  </Card>
+  <Card title="Create sessions with the API" icon="key-round" href="/documentation/platform/agent-vault/sessions-api">
+    Create a session for each agent run from your own code.
+  </Card>
   <Card title="Session logs" icon="list" href="/documentation/platform/agent-vault/session-logs">
     A record of every request an AI agent makes, stored encrypted in your own Amazon S3 bucket.
   </Card>
```

**File**: `docs/documentation/platform/agent-vault/proxies.mdx` (modified, +11/-0)
```diff
@@ -15,6 +15,15 @@ While you can technically run the agent and the proxy on a single machine, we re
 We also recommend keeping both machines on the same private network. This is because every request the agent makes goes through the proxy, and a round trip between networks adds latency to every request.
 </Tip>
 
+## Supported connections
+
+The proxy attaches credentials to HTTP/1.1 requests, over both HTTPS and plain HTTP. These connections fail through the proxy:
+
+- WebSocket connections, such as to a `wss://` URL
+- Clients that only speak HTTP/2, such as gRPC clients
+
+If an API offers both, configure the agent to use its plain HTTPS requests. Many SDKs fall back to HTTPS when a WebSocket connection fails.
+
 ## Create and enroll a proxy
 
 <Steps>
@@ -197,6 +206,8 @@ The proxy decrypts HTTPS traffic to attach the credential, so each agent has to
         ```
       </Step>
     </Steps>
+
+    To set the proxy and the certificate in your own agent's code instead, see [Connect your own agent](/documentation/platform/agent-vault/guides/custom-agent).
   </Tab>
 </Tabs>
 
```

**File**: `docs/documentation/platform/agent-vault/sessions-api.mdx` (added, +156/-0)
```diff
@@ -0,0 +1,156 @@
+---
+title: "Create Agent Vault sessions with the API"
+sidebarTitle: "Create sessions with the API"
+description: "Create a session for each agent run from your own code, using a machine identity instead of the Infisical dashboard."
+---
+
+import MachineIdentitySetup from "/snippets/agent-vault/MachineIdentitySetup.mdx";
+
+You can use the Infisical API to create a new [session](/documentation/platform/agent-vault/sessions) every time your agent starts. Your code authenticates as a [machine identity](/documentation/platform/identities/machine-identities), creates a session with an [access bundle](/documentation/platform/agent-vault/access-bundles), passes the session token to the agent, and revokes the session when the agent finishes.
+
+This is useful if your code starts your agents or creates sessions for agents on other machines, such as a job runner, an orchestrator, or a backend that runs an agent for each task.
+
+<Tip>
+  If a shell command starts the agent on the machine where it runs, such as a cron job or a container entrypoint, the [Infisical CLI can create and revoke each session](/documentation/platform/agent-vault/sessions-cli) for you without any code.
+</Tip>
+
+## Prerequisites
+
+- An [access bundle](/documentation/platform/agent-vault/access-bundles) with a service for each API the agent calls
+- A running [proxy](/documentation/platform/agent-vault/proxies) that the agent's machine can reach
+- The **Admin** role in [Agent Vault](/documentation/platform/agent-vault/access-control#product-membership), or an Agent Vault admin who can complete [Step 1](#step-1-set-up-a-machine-identity) for you
+
+## Step 1: Set up a machine identity
+
+Your code creates sessions as a machine identity, so that sessions don't depend on a person's account.
+
+<MachineIdentitySetup />
+
+## Step 2: Log in as the machine identity
+
+Call [the login endpoint for Universal Auth](/api-reference/endpoints/universal-auth/login) with the client ID and client secret:
+
+```bash
+curl -X POST https://app.infisical.com/api/v1/auth/universal-auth/login \
+  -H "Content-Type: application/json" \
+  -d '{"clientId": "<client-id>", "clientSecret": "<client-secret>"}'
+```
+
+If you self-host Infisical, replace `https://app.infisical.com` with the address of your instance, here and in every later request.
+
+The response includes an `accessToken`, which you send with each request in the next steps, and `expiresIn`, the number of seconds until the access token expires. Log in again when the access token expires.
+
+<Tip>
+  If your code runs on a cloud provider or in Kubernetes, you can use another [authentication method](/documentation/platform/identities/overview), such as AWS Auth or Kubernetes Auth, so that your code doesn't need a client secret. Each method returns an access token that works the same way in the next steps.
+</Tip>
+
+## Step 3: Create a session
+
+Call [the endpoint that creates a session](/api-reference/endpoints/agent-vault-sessions/create) with the name of the access bundle and how long the session should last:
+
+```bash
+curl -X POST https://app.infisical.com/api/v1/agent-vault/sessions \
+  -H "Authorization: Bearer <access-token>" \
+  -H "Content-Type: application/json" \
+  -d '{"accessBundles": ["<access-bundle-name>"], "ttl": "1h"}'
+```
+
+- `accessBundles` takes a list, but a session can have only one access bundle, so the list must have exactly one name
+- `ttl` accepts a duration of at least one minute, such as `30m`, `8h`, or `7d`, or `never`, and defaults to `7d` (see [Choose how long a session lasts](#choose-how-long-a-session-lasts) to pick a value)
+
+The response includes the session's ID, the session token, and when the session expires:
+
+```json
+{
+  "session": {
+    "id": "6f1c2a9e-3b7d-4e8a-9c41-2d5f7b8e0a13",
+    "token": "<session-token>",
+    "expiresAt": "2026-10-07T19:00:00.000Z"
+  }
+}
+```
+
+Save the ID, which you need to revoke the session in [Step 5](#step-5-revoke-the-session). You can't retrieve the session token again after this response.
+
+### Choose how long a session lasts
+
+Pick the `ttl` based on how long your agents run:
+
+| How your agents run | What to do |
+|------|------------|
+| A job that finishes, such as a task from a queue or a scheduled run | Create a session for each job, with a `ttl` a little longer than the longest job, and revoke the session when the job ends |
+| A process that keeps running, such as a service or a chat bot | Create a session with a `ttl` such as `24h`. Before the session expires, create a new session, switch the agent to the new token, then revoke the old session |
+
+## Step 4: Start the agent with the session token
+
+The agent uses the session token to authenticate to the proxy. How you pass the token to the agent depends on how you start the agent:
+
+<Tabs>
+  <Tab title="With the CLI">
+    Start the agent with `infisical agent-vault run`, and pass the session token and the proxy's address:
+
```

**File**: `docs/documentation/platform/agent-vault/sessions-cli.mdx` (added, +196/-0)
```diff
@@ -0,0 +1,196 @@
+---
+title: "Create Agent Vault sessions with the CLI"
+sidebarTitle: "Create sessions with the CLI"
+description: "Create a new session for each agent run with the Infisical CLI and a machine identity."
+---
+
+import MachineIdentitySetup from "/snippets/agent-vault/MachineIdentitySetup.mdx";
+
+The Infisical CLI can create a new [session](/documentation/platform/agent-vault/sessions) each time an agent starts. The CLI authenticates as a [machine identity](/documentation/platform/identities/machine-identities), creates a session with an [access bundle](/documentation/platform/agent-vault/access-bundles), starts the agent, and revokes the session when the agent exits.
+
+This is useful if your agent runs from cron, in a container, in CI, or as a long-running service.
+
+<Tip>
+  If your own code starts the agents, or creates sessions for agents that run on other machines, such as an orchestrator that gives each container its own session, you can [create sessions with the API](/documentation/platform/agent-vault/sessions-api) instead.
+</Tip>
+
+## Prerequisites
+
+- An [access bundle](/documentation/platform/agent-vault/access-bundles) with a service for each API the agent calls
+- A running [proxy](/documentation/platform/agent-vault/proxies) that the agent's machine can reach
+- The [Infisical CLI](/cli/install) installed on the agent's machine
+- An agent command that runs without anyone at the terminal, such as `claude -p "<prompt>"` for Claude Code
+- The **Admin** role in [Agent Vault](/documentation/platform/agent-vault/access-control#product-membership), or an Agent Vault admin who can complete [Step 1](#step-1-set-up-a-machine-identity) for you
+
+## Step 1: Set up a machine identity
+
+The CLI creates sessions as a machine identity, so that the agent's access doesn't depend on a person's account.
+
+<MachineIdentitySetup />
+
+<Note>
+  We recommend creating a machine identity for each agent and granting it only the access bundle that agent uses.
+
+  If you plan on using one machine identity to create sessions with different access bundles for different agents, you should [create sessions with the API](/documentation/platform/agent-vault/sessions-api) instead.
+</Note>
+
+## Step 2: Start the agent
+
+If the agent won't start without an API key, such as `ANTHROPIC_API_KEY` for Claude Code, set the key to a placeholder, such as `agent-vault`. The proxy replaces the placeholder with the real key from the service. If the service uses a [substitution](/documentation/platform/agent-vault/services#substitutions), set the key to the service's placeholder instead.
+
+On the agent's machine, set the machine identity's credentials and the proxy's address as environment variables, then start the agent with `infisical agent-vault run`:
+
+```bash
+export INFISICAL_UNIVERSAL_AUTH_CLIENT_ID=<client-id>
+export INFISICAL_UNIVERSAL_AUTH_CLIENT_SECRET=<client-secret>
+export INFISICAL_AGENT_VAULT_PROXY_ADDRESS=<proxy-host>:17323
+# If you self-host Infisical, also set the address of your instance
+export INFISICAL_DOMAIN=<your-instance-url>
+
+infisical agent-vault run --access-bundle <access-bundle-name> --ttl 2h -- <agent-command>
+```
+
+### Choose how long each session lasts
+
+Set `--ttl` a little longer than the longest run you expect:
+
+- If a run takes longer than the `--ttl`, the agent loses access to the APIs partway through the run
+- If the CLI can't revoke the session, such as when the machine shuts down mid-run, the session keeps working until the `--ttl` runs out (seven days if you leave out `--ttl`)
+
+### Pin the proxy's certificate
+
+The CLI downloads the proxy's certificate at the start of each run. If the agent's machine reaches the proxy over a network you don't fully control, add `--ca-fingerprint` with the proxy's fingerprint to the command, so the CLI only starts the agent if the certificate matches:
+
+```bash
+infisical agent-vault run --access-bundle <access-bundle-name> --ttl 2h --ca-fingerprint <fingerprint> -- <agent-command>
+```
+
+Copy the fingerprint from the **Certificate Authority** column on the **Proxies** page. If you [re-enroll the proxy](/documentation/platform/agent-vault/proxies#re-enroll-a-proxy), update the fingerprint.
+
+## Step 3: Run the agent automatically
+
+Put the command from [Step 2](#step-2-start-the-agent) wherever your agents start:
+
+<Tabs>
+  <Tab title="Schedule (cron)">
+    Store the environment variables in a file that only the job's user can read, such as `/etc/agent-vault/agent.env` with mode `0600`:
+
+    ```bash
+    export INFISICAL_UNIVERSAL_AUTH_CLIENT_ID=<client-id>
+    export INFISICAL_UNIVERSAL_AUTH_CLIENT_SECRET=<client-secret>
+    export INFISICAL_AGENT_VAULT_PROXY_ADDRESS=<proxy-host>:17323
+    ```
+
+    Then load the file in the crontab entry. This entry runs the agent every 30 minutes:
+
+    ```bash
+    */30 * * * * . /etc/agent-vault/agent.env && infisical agent-vault run --access-bundle <access-bundle-nam
```

#### Recent Merged Pull Requests:
- **PR #8555** (2026-10-10): improvement(ui): standardize Loader on the yellow brand mark (@andrewhuhh)
- **PR #8552** (closed): fix: hide social login buttons for OAuth providers the instance has not configured (@i5hi)
- **PR #8551** (closed): fix: return 400 instead of 500 when an unconfigured OAuth login is requested (@i5hi)
- **PR #8549** (2026-10-10): fix(secrets-overview): keep expanded row chevron stable in multi-env view (@andrewhuhh)
- **PR #8545** (2026-10-10): chore: record resource name in alert audit events (@carlosmonastyrski)
- **PR #8542** (2026-10-10): feat(frontend): virtualize secret preview tables in bulk actions (@andrewhuhh)
- **PR #8535** (2026-10-09): fix(billing): use secrets_manager product key for Secrets Management (@andrewhuhh)
- **PR #8533** (2026-10-09): fix(frontend): block secret uploads that exceed the 1 MB request limit (@andrewhuhh)

---

## 3. Empirical Evidence & Compliance Certification
- **Evidence Provenance**: Fetched directly from verified official GitHub REST API.
- **Zero Disk Footprint**: 0 bytes of unnecessary repository bloat stored locally.
- **TOS & Free-Tier Adherence**: Request pace complied with public API guidelines without fee, penalty, or unauthorized scraping.

---

## 4. Promotion & Integration Status
- **Status**: HARVESTED_DEEP_FORENSIC
- **Master Brain Sync**: Auto-committed to local/remote Master Brain repository.
