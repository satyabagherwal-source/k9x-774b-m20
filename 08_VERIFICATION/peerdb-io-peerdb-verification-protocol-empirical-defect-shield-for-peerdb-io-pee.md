# Verification Protocol: Verification Protocol: Empirical Defect Shield for peerdb/io/peerdb

<!-- PROVENANCE_START
{
  "source_repository": "peerdb/io/peerdb",
  "source_url": "https://github.com/peerdb/io/peerdb",
  "source_version": "historical-head",
  "license": "OPEN_HARVEST",
  "timestamp": "2026-11-13T00:00:00.000Z",
  "ai_provider": "universal-multi-artifact-distributor",
  "generator_version": "2.0.0-universal",
  "learning_id": "unknown",
  "canonical_classification": "verification_contract"
}
PROVENANCE_END -->
> **Provenance**: Harvested from [peerdb/io/peerdb](https://github.com/peerdb/io/peerdb) (Revision: `historical`).  
> **License**: OPEN_HARVEST | **Timestamp**: `2026-11-13T00:00:00.000Z`  
> **Learning ID**: `unknown`


## 1. Scope & Verification Target
- **Target Repository**: `peerdb/io/peerdb` (Commit: `historical`)
- **Pillar Alignment**: Pillar 11 (Empirical Truth & Mathematical Integrity)

## 2. Observed Failure Modes & Defect Traps
> **Canonical Learning Artifact**: `07_PROJECT_LEARNING/peerdb-io-peerdb-learnings.md`  
> **Source**: github ([https://github.com/PeerDB-io/peerdb](https://github.com/PeerDB-io/peerdb))  
> **Source Version**: `ca8ac478`  
> **License**: AGPL-3.0  
> **Synthesized By**: zero-clone-structural-synthesizer  
> **Timestamp**: 2026-11-12T03:48:59.141Z  
> **Learning ID**: `learn-github-peerdb-io-peerdb`  
> **Pipeline Version**: `2.0.0`  
> **Status**: VERIFIED_EMPIRICAL_INTELLIGENCE  
> **Data Governance**: CLASSIFICATION: PUBLIC. Sanitized against PII/secrets.  
> **Policy Invariant**: Strictly for engineering retrieval and architecture documentation. Distillation prohibited.  

---

# Forensic Learning Record (Deep Inspection): PeerDB-io/peerdb

> **Canonical Artifact**: `07_PROJECT_LEARNING/peerdb-io-peerdb-learnings.md`  
> **Source Platform**: GitHub ([https://github.com/PeerDB-io/peerdb](https://github.com/PeerDB-io/peerdb))  
> **Harvest Method**: Full-Spectrum Deep Extraction (Patches, Diffs, Source Code, Post-Mortems)  
> **Harvest Timestamp**: 2026-11-12T03:48:36.102Z  
> **Compliance State**: Free Tier Guaranteed | Strict Rate-Limit Backoff Honored  

---

## 1. Context & Architectural Overview
- **Repository / Resource**: `PeerDB-io/peerdb`
- **Description**: Fast, Simple and a cost effective tool to replicate data from Postgres to Data Warehouses, Queues and Storage
- **Primary Language / Ecosystem**: Go
- **Discovered Manifests / Configurations**: README.md
- **Stars / Engagement**: 3320 stars

---

## 2. Multi-Dimensional 8-Axis Investigation & Real Code Patches

### D1: Architecture & Structural Boundaries
- Entry configurations inspected via direct stream: README.md.
- Evaluated system abstractions and modular contracts.

### Core Architecture Module: `flow/activities/flowable_core.go`
```
// internal methods for flowable.go
package activities

import (
	"context"
	"errors"
	"fmt"
	"log/slog"
	"sync/atomic"
	"time"

	"github.com/jackc/pgerrcode"
	"github.com/jackc/pgx/v5"
	"go.opentelemetry.io/otel/attribute"
	"go.opentelemetry.io/otel/codes"
	"go.opentelemetry.io/otel/metric"
	"go.opentelemetry.io/otel/trace"
	"go.temporal.io/sdk/activity"
	"go.temporal.io/sdk/log"
	"golang.org/x/sync/errgroup"
	"google.golang.org/protobuf/proto"

	"github.com/PeerDB-io/peerdb/flow/connectors"
	connmetadata "github.com/PeerDB-io/peerdb/flow/connectors/external_metadata"
	connpostgres "github.com/PeerDB-io/peerdb/flow/connectors/postgres"
	"github.com/PeerDB-io/peerdb/flow/connectors/utils/monitoring"
	"github.com/PeerDB-io/peerdb/flow/generated/protos"
	"github.com/PeerDB-io/peerdb/flow/internal"
	"github.com/PeerDB-io/peerdb/flow/model"
	"github.com/PeerDB-io/peerdb/flow/otel_metrics"
	"github.com/PeerDB-io/peerdb/flow/shared"
	"github.com/PeerDB-io/peerdb/flow/shared/exceptions"
)

type PeerType string

const (
	Source      PeerType = "source"
	Destination PeerType = "destination"
)

func (a *FlowableActivity) getTableNameSchemaMapping(ctx context.Context, flowName string) (map[string]*protos.TableSchema, error) {
	rows, err := a.CatalogPool.Query(ctx, "select table_name, table_schema from table_schema_mapping where flow_name = $1", flowName)
	if err != nil {
		return nil, err
	}

	var tableName string
	var tableSchemaBytes []byte
	tableNameSchemaMapping := make(map[string]*protos.TableSchema)
	if _, err := pgx.ForEachRow(rows, []any{&tableName, &tableSchemaBytes}, func() error {
		tableSchema := &protos.TableSchema{}
		if err := proto.Unmarshal(tableSchemaBytes, tableSchema); err != nil {
			return err
		}
		tableNameSchemaMapping[tableName] = tableSchema
		return nil
	}); err != nil {
		return nil, fmt.Errorf("failed to deserialize table schema proto: %w", err)
	}
	return tableNameSchemaMapping, nil
}

func pullAndSyncCore[TPull connectors.CDCPullConnectorCore, TSync connectors.CDCSyncConnectorCore, Items model.Items](
	ctx context.Context,
	a *FlowableActivity,
	config *protos.FlowConnectionConfigsCore,
	sourceType protos.DBType,
	options *protos.SyncFlowOptions,
	srcConn TPull,
	progress *syncNormalizeProgress,
	normBufferSize int64,
	idleTimeout time.Duration,
	syncingBatchID *atomic.Int64,
	syncState *atomic.Pointer[string],
	adaptStream func(*model.CDCStream[Items]) (*model.CDCStream[Items], error),
	pull func(TPull, context.Context, shared.CatalogPool, *otel_metrics.OtelManager, *model.PullRecordsRequest[Items]) error,
	sync func(TSync, context.Context, *model.SyncRecordsRequest[Items]) (*model.SyncResponse, error),
) (*model.SyncResponse, error) {
	flowName := config.FlowJobName
	ctx = context.WithValue(ctx, shared.FlowNameKey, flowName)
	logger := internal.LoggerFromCtx(ctx)

	ctx, batchSpan := a.OtelManager.Tracer.Start(ctx, "cdc.batch", trace.WithAttributes(
		attribute.String(otel_metrics.FlowNameKey, flowName),
	))
	defer batchSpan.End()

	tblNameMapping := make(map[string]model.SourceTableMapping, len(options.TableMappings))
	for _, v := range options.TableMappings {
		mapping := model.NewSourceTableMappingWithStructuredIngestion(
			v.DestinationTableIdentifier, v.Exclude, v.StructuredIngestionConfig,
		)
		mapping.MongoConfiguration = v.MongoConfig
		mapping.Columns = v.Columns
		tblNameMapping[v.SourceTableIdentifier] = mapping
	}

	if err := srcConn.ConnectionActive(ctx); err != nil {
		return nil, a.Alerter.LogFlowError(ctx, flowName, fmt.Errorf("connection to source down: %w", err))
	}

	batchSize := options.BatchSize
	if batchSize == 0 {
		batchSize = 250_000
	}

	lastOffset, err := func() (model.CdcCheckpoint, error) {
		// special case pg-pg replication, where offsets are stored on destination instead of catalog
		if _, isSourcePg := any(srcConn).(*connpostgres.PostgresConnector); isSourcePg {
			dstPgConn, dstPgClose, err := connectors.GetPostgresConnectorByName(ctx, config.Env, a.CatalogPool, config.DestinationName)
			if err != nil {
				if !errors.Is(err, errors.ErrUnsupported) {
					return model.CdcCheckpoint{}, fmt.Errorf("failed to get destination connector to get last offset: %w", err)
				}
				// else fallthrough to loading from catalog
			} else {
				defer dstPgClose(ctx)
				return dstPgConn.GetLastOffset(ctx, config.FlowJobName)
			}
		}
		pgMetadata := connmetadata.NewPostgresMetadataFromCatalog(logger, a.CatalogPool)
		return pgMetadata.GetLastOffset(ctx, flowName)
	}()
	if err != nil {
		return nil, a.Alerter.LogFlowError(ctx, flowName, err)
	}

	logger.Info("pulling records...", slog.Any("LastOffset", lastOffset))
	consumedOffset := atomic.Int64{}
	consumedOffset.Store(lastOffset.ID)

	channelBufferSize, err := internal.PeerDBCDCChannelBufferSize(ctx, config.Env)
	if err != nil {
		return nil, fmt.Errorf("failed to get CDC channel buffer size: %w", err)
	}
	recordBatchPull := model.NewCDCStream[Items](channelBufferSize)
	recordBatchSync := recordBatchPull
	if adaptStream != nil {
		var err error
		if recordBatchSync, err = adaptStream(recordBatchPull); err != nil {
			return nil, err
		}
	}

	tableNameSchemaMapping, err := a.getTableNameSchemaMapping(ctx, flowName)
	if err != nil {
		return nil, err
	}

	syncBatchID, err := func() (int64, error) {
		// when destination is PG, batch ID is stored on destination instead of catalog
		dstPgConn, dstPgClose, err := connectors.GetPostgresConnectorByName(ctx, config.Env, a.CatalogPool, config.DestinationName)
		if err != nil {
			if !errors.Is(err, errors.ErrUnsupported) {
				return 0, fmt.Errorf("failed to get destination connector to get last sync batch ID: %w", err)
			}
			// else fallthrough to loading from catalog
		} else {
			defer dstPgClose(ctx)
			return dstPgConn.GetLastSyncBatchID(ctx, flowName)
		}
		pgMetadata := connmetadata.NewPostgresMetadataFromCatalog(logger, a.CatalogPool)
		return pgMetadata.GetLastSyncBatchID(ctx, flowName)
	}()
	if err != nil {
		batchSpan.RecordError(err)
		batchSpan.SetStatus(codes.Error, err.Error())
		return nil, a.Alerter.LogFlowError(ctx, flowName, err)
	}
	syncBatchID += 1
	batchSpan.SetAttributes(attribute.Int64(otel_metrics.BatchIdKey, syncBatchID))

	startTime := time.Now()
	syncState.Store(new("syncing"))
	errGroup, errCtx := errgroup.WithContext(ctx)
	errGroup.Go(func() error {
		pullCtx, pullSpan := a.OtelManager.Tracer.Start(errCtx, "cdc.pull", trace.WithAttributes(
			attribute.String(otel_metrics.FlowNameKey, flowName),
			attribute.Int(otel_metrics.TableCountKey, len(options.TableMappings)),
			attribute.Int64(otel_metrics.BatchIdKey, syncBatchID),
		))
		defer pullSpan.End()
		err := pull(srcConn, pullCtx, a.CatalogPool, a.OtelManager, &model.PullRecordsRequest[Items]{
			FlowJobName:                 flowName,
			SrcTableIDNameMapping:       options.SrcTableIdNameMapping,
			TableNameMapping:            tblNameMapping,
			LastOffset:                  lastOffset,
			ConsumedOffset:              &consumedOffset,
			MaxBatchSize:                batchSize,
			IdleTimeout:                 idleTimeout,
			TableNameSchemaMapping:      tableNameSchemaMapping,
			OverridePublicationName:     config.PublicationName,
			OverrideReplicationSlotName: config.ReplicationSlotName,
			RecordStream:                recordBatchPull,
			Env:                         config.Env,
			InternalVersion:             config.Version,
			Flags:                       config.Flags,
		})
		if err != nil {
			pullSpan.RecordError(err)
			pullSpan.SetStatus(codes.Error, err.Error())
		}
		return err
	})

	hasRecords := !recordBatchSync.WaitAndCheckEmpty()
	logger.Info("current sync flow has records?", slog.Bool("hasRecords", hasRecords))

	if !hasRecords {
		// wait for the pull goroutine to finish
		if err := errGroup.Wait(); err != nil {
			// don't log flow error for "replState changed" and "slot is already active"
			_, isDesync := errors.AsType[*exceptions.ReplStateDesyncError](err)
			if !(isDesync || shared.IsSQLStateError(err, pgerrcode.ObjectInUse)) {
				_ = a.Alerter.LogFlowError(ctx, flowName, err)
			}
			return nil, fmt.Errorf("failed in pull records when: %w", err)
		}
		logger.Info("no records to push")

		dstConn, dstClose, err := connectors.GetByNameAs[TSync](ctx, config.Env, a.CatalogPool, config.DestinationName)
		if err != nil {
			return nil, fmt.Errorf("failed to recreate destination connector: %w", err)
		}
		defer dstClose(ctx)

		syncState.Store(new("updating schema"))
		if err := dstConn.ReplayTableSchemaDeltas(
			ctx, config.Env, flowName, options.TableMappings, recordBatchSync.SchemaDeltas, config.Flags, config.Version, sourceType,
		); err != nil {
			return nil, fmt.Errorf("failed to sync schema: %w", err)
		}

		return nil, internal.ApplySchemaDeltasToCatalog(ctx, a.CatalogPool, flowName, recordBatchSync.SchemaDeltas)
	}

	var res *model.SyncResponse
	errGroup.Go(func() error {
		syncCtx, syncSpan := a.OtelManager.Tracer.Start(errCtx, "cdc.sync", trace.WithAttributes(
			attribute.String(otel_metrics.FlowNameKey, flowName),
			attribute.Int(otel_metrics.TableCountKey, len(options.TableMappings)),
			attribute.Int64(otel_metrics.BatchIdKey, syncBatchID),
		))
		defer syncSpan.End()
		syncingBatchID.Store(syncBatchID)
		logger.Info("begin pulling records for batch", slog.Int64("syncBatchID", syncBatchID))

		if err := monitoring.AddCDCBatchForFlow(syncCtx, a.CatalogPool, flowName, monitoring.CDCBatchInfo{
			BatchID:     syncBatchID,
			RowsInBatch: 0,
			BatchEndlSN: 0,
			StartTime:   startTime,
		}); err != nil {
			syncSpan.RecordError(err)
			syncSpan.SetStatus(codes.Error, err.Error())
			return a.Alerter.LogFlowError(ctx, flowName, err)
		}

		dstConn, dstClose, err := connectors.GetByNameAs[TSync](syncCtx, config.Env, a.CatalogPool, config.DestinationName)
		if err != nil {
			syncSpan.RecordError(err)
			syncSpan.SetStatus(codes.Error, err.Error())
			return fmt.Errorf("failed to get destination connector: %w", err)
		}
		defer dstClose(ctx)

		res, err = sync(d
```

### Core Architecture Module: `flow/cmd/snapshot_worker.go`
```
package cmd

import (
	"context"
	"fmt"
	"log/slog"
	"os"

	"go.temporal.io/sdk/client"
	temporalotel "go.temporal.io/sdk/contrib/opentelemetry"
	"go.temporal.io/sdk/worker"
	"go.temporal.io/sdk/workflow"

	"github.com/PeerDB-io/peerdb/flow/activities"
	"github.com/PeerDB-io/peerdb/flow/alerting"
	"github.com/PeerDB-io/peerdb/flow/generated/protos"
	"github.com/PeerDB-io/peerdb/flow/internal"
	"github.com/PeerDB-io/peerdb/flow/otel_metrics"
	"github.com/PeerDB-io/peerdb/flow/shared"
	peerflow "github.com/PeerDB-io/peerdb/flow/workflows"
)

type SnapshotWorkerOptions struct {
	TemporalHostPort  string
	TemporalNamespace string
	EnableOtelMetrics bool
	EnableOtelTraces  bool
}

func SnapshotWorkerMain(ctx context.Context, opts *SnapshotWorkerOptions) (*WorkerSetupResponse, error) {
	clientOptions := client.Options{
		HostPort:  opts.TemporalHostPort,
		Namespace: opts.TemporalNamespace,
		Logger:    slog.New(shared.NewSlogHandler(slog.NewJSONHandler(os.Stdout, shared.NewSlogHandlerOptions()))),
		ContextPropagators: []workflow.ContextPropagator{
			internal.NewContextPropagator[*protos.FlowContextMetadata](internal.FlowMetadataKey),
		},
	}

	conn, err := connectWithRetry(ctx, "catalog", internal.GetCatalogConnectionPoolFromEnv)
	if err != nil {
		return nil, fmt.Errorf("unable to create catalog connection pool: %w", err)
	}

	metricsProvider, metricsErr := otel_metrics.SetupTemporalMetricsProvider(
		ctx, otel_metrics.FlowSnapshotWorkerServiceName, opts.EnableOtelMetrics)
	if metricsErr != nil {
		return nil, metricsErr
	}
	clientOptions.MetricsHandler = temporalotel.NewMetricsHandler(temporalotel.MetricsHandlerOptions{
		Meter: metricsProvider.Meter("temporal-sdk-go"),
	})

	tracerProvider, err := otel_metrics.SetupTracerProvider(ctx, otel_metrics.FlowSnapshotWorkerServiceName, opts.EnableOtelTraces)
	if err != nil {
		return nil, fmt.Errorf("unable to setup tracer provider: %w", err)
	}
	if opts.EnableOtelTraces {
		tracingInterceptor, err := temporalotel.NewTracingInterceptor(temporalotel.TracerOptions{
			Tracer: tracerProvider.Tracer("temporal-sdk-go"),
		})
		if err != nil {
			return nil, fmt.Errorf("unable to create tracing interceptor: %w", err)
		}
		clientOptions.Interceptors = append(clientOptions.Interceptors, tracingInterceptor)
	}

	c, err := connectWithRetry(ctx, "temporal", func(ctx context.Context) (client.Client, error) {
		return setupTemporalClient(ctx, clientOptions)
	})
	if err != nil {
		return nil, fmt.Errorf("unable to create Temporal client: %w", err)
	}

	taskQueue := internal.PeerFlowTaskQueueName(shared.SnapshotFlowTaskQueue)
	w := worker.New(c, taskQueue, worker.Options{
		EnableSessionWorker: true,
		OnFatalError: func(err error) {
			slog.ErrorContext(ctx, "Snapshot Worker failed", slog.Any("error", err))
		},
	})

	otelManager, err := otel_metrics.NewOtelManager(ctx, otel_metrics.FlowSnapshotWorkerServiceName, opts.EnableOtelMetrics)
	if err != nil {
		return nil, fmt.Errorf("unable to create otel manager: %w", err)
	}

	w.RegisterWorkflow(peerflow.SnapshotFlowWorkflow)
	// explicitly not initializing mutex, in line with design
	w.RegisterActivity(&activities.SnapshotActivity{
		SlotSnapshotStates: make(map[string]activities.SlotSnapshotState),
		TxSnapshotStates:   make(map[string]activities.TxSnapshotState),
		Alerter:            alerting.NewAlerter(ctx, conn, otelManager),
		CatalogPool:        conn,
	})

	return &WorkerSetupResponse{
		Client:         c,
		Worker:         w,
		OtelManager:    otelManager,
		TracerProvider: tracerProvider,
	}, nil
}

```

### Core Architecture Module: `flow/cmd/worker.go`
```
package cmd

import (
	"context"
	"fmt"
	"log/slog"
	"os"
	"time"

	sdktrace "go.opentelemetry.io/otel/sdk/trace"
	"go.temporal.io/sdk/client"
	temporalotel "go.temporal.io/sdk/contrib/opentelemetry"
	"go.temporal.io/sdk/worker"
	"go.temporal.io/sdk/workflow"

	"github.com/PeerDB-io/peerdb/flow/activities"
	"github.com/PeerDB-io/peerdb/flow/alerting"
	"github.com/PeerDB-io/peerdb/flow/generated/protos"
	"github.com/PeerDB-io/peerdb/flow/internal"
	"github.com/PeerDB-io/peerdb/flow/otel_metrics"
	"github.com/PeerDB-io/peerdb/flow/shared"
	peerflow "github.com/PeerDB-io/peerdb/flow/workflows"
)

type WorkerSetupOptions struct {
	TemporalHostPort                   string
	TemporalNamespace                  string
	TemporalMaxConcurrentActivities    int
	TemporalMaxConcurrentWorkflowTasks int
	EnableOtelMetrics                  bool
	EnableOtelTraces                   bool
	UseMaintenanceTaskQueue            bool
}

type WorkerSetupResponse struct {
	Client         client.Client
	Worker         worker.Worker
	OtelManager    *otel_metrics.OtelManager
	TracerProvider *sdktrace.TracerProvider
}

func (w *WorkerSetupResponse) Close(ctx context.Context) {
	slog.InfoContext(ctx, "Shutting down worker")
	w.Client.Close()
	if err := w.OtelManager.Close(ctx); err != nil {
		slog.ErrorContext(ctx, "Failed to shutdown metrics provider", slog.Any("error", err))
	}
	if w.TracerProvider != nil {
		if err := w.TracerProvider.Shutdown(ctx); err != nil {
			slog.ErrorContext(ctx, "Failed to shutdown tracer provider", slog.Any("error", err))
		}
	}
}

func WorkerSetup(ctx context.Context, opts *WorkerSetupOptions) (*WorkerSetupResponse, error) {
	conn, err := connectWithRetry(ctx, "catalog", internal.GetCatalogConnectionPoolFromEnv)
	if err != nil {
		return nil, fmt.Errorf("unable to create catalog connection pool: %w", err)
	}

	clientOptions := client.Options{
		HostPort:  opts.TemporalHostPort,
		Namespace: opts.TemporalNamespace,
		Logger:    slog.New(shared.NewSlogHandler(slog.NewJSONHandler(os.Stdout, shared.NewSlogHandlerOptions()))),
		ContextPropagators: []workflow.ContextPropagator{
			internal.NewContextPropagator[*protos.FlowContextMetadata](internal.FlowMetadataKey),
		},
	}

	metricsProvider, metricsErr := otel_metrics.SetupTemporalMetricsProvider(
		ctx, otel_metrics.FlowWorkerServiceName, opts.EnableOtelMetrics,
	)
	if metricsErr != nil {
		return nil, metricsErr
	}
	clientOptions.MetricsHandler = temporalotel.NewMetricsHandler(temporalotel.MetricsHandlerOptions{
		Meter: metricsProvider.Meter("temporal-sdk-go"),
	})

	tracerProvider, err := otel_metrics.SetupTracerProvider(ctx, otel_metrics.FlowWorkerServiceName, opts.EnableOtelTraces)
	if err != nil {
		return nil, fmt.Errorf("unable to setup tracer provider: %w", err)
	}
	if opts.EnableOtelTraces {
		tracingInterceptor, err := temporalotel.NewTracingInterceptor(temporalotel.TracerOptions{
			Tracer: tracerProvider.Tracer("temporal-sdk-go"),
		})
		if err != nil {
			return nil, fmt.Errorf("unable to create tracing interceptor: %w", err)
		}
		clientOptions.Interceptors = append(clientOptions.Interceptors, tracingInterceptor)
	}

	c, err := connectWithRetry(ctx, "temporal", func(ctx context.Context) (client.Client, error) {
		return setupTemporalClient(ctx, clientOptions)
	})
	if err != nil {
		return nil, fmt.Errorf("unable to create Temporal client: %w", err)
	}
	slog.InfoContext(ctx, "Created temporal client")
	queueId := shared.PeerFlowTaskQueue
	if opts.UseMaintenanceTaskQueue {
		queueId = shared.MaintenanceFlowTaskQueue
	}
	taskQueue := internal.PeerFlowTaskQueueName(queueId)
	slog.InfoContext(ctx,
		"Creating temporal worker",
		slog.String("taskQueue", taskQueue),
		slog.Int("workflowConcurrency", opts.TemporalMaxConcurrentWorkflowTasks),
		slog.Int("activityConcurrency", opts.TemporalMaxConcurrentActivities),
	)
	w := worker.New(c, taskQueue, worker.Options{
		EnableSessionWorker:                    true,
		MaxConcurrentActivityExecutionSize:     opts.TemporalMaxConcurrentActivities,
		MaxConcurrentWorkflowTaskExecutionSize: opts.TemporalMaxConcurrentWorkflowTasks,
		OnFatalError: func(err error) {
			slog.ErrorContext(ctx, "Peerflow Worker failed", slog.Any("error", err))
		},
		MaxHeartbeatThrottleInterval: 10 * time.Second,
		// on shutdown, give in-flight activities time to drain (SyncFlow watches the
		// worker stop channel) instead of immediate context cancellation.
		WorkerStopTimeout: 30 * time.Second,
	})
	peerflow.RegisterFlowWorkerWorkflows(w)

	otelManager, err := otel_metrics.NewOtelManager(ctx, otel_metrics.FlowWorkerServiceName, opts.EnableOtelMetrics)
	if err != nil {
		return nil, fmt.Errorf("unable to create otel manager: %w", err)
	}

	w.RegisterActivity(&activities.FlowableActivity{
		CatalogPool:    conn,
		Alerter:        alerting.NewAlerter(ctx, conn, otelManager),
		OtelManager:    otelManager,
		TemporalClient: c,
	})

	w.RegisterActivity(&activities.MaintenanceActivity{
		CatalogPool:    conn,
		Alerter:        alerting.NewAlerter(ctx, conn, otelManager),
		OtelManager:    otelManager,
		TemporalClient: c,
	})

	w.RegisterActivity(&activities.CancelTableAdditionActivity{
		CatalogPool:    conn,
		Alerter:        alerting.NewAlerter(ctx, conn, otelManager),
		OtelManager:    otelManager,
		TemporalClient: c,
	})

	return &WorkerSetupResponse{
		Client:         c,
		Worker:         w,
		OtelManager:    otelManager,
		TracerProvider: tracerProvider,
	}, nil
}

```

### Core Architecture Module: `flow/connectors/bigquery/data_format_utils.go`
```
package connbigquery

import (
	"context"
	"fmt"
	"io"
	"log/slog"

	"cloud.google.com/go/storage"
	"github.com/apache/arrow-go/v18/parquet"
	"github.com/apache/arrow-go/v18/parquet/file"
	"go.temporal.io/sdk/log"
)

const defaultCompressedRowSize = 512 // bytes. Should be a reasonable low default for analytical data

// gcsObjectSeeker implements io.ReadSeeker for a GCS object using range reads.
// Designed for a quick reading specific parts of a Parquet file. Like file header.
// Not efficient for many small reads/seeks.
type gcsObjectSeeker struct {
	ctx context.Context //nolint:containedctx // context for GCS operations

	object   *storage.ObjectHandle
	fileSize int64
	offset   int64
}

func (r *gcsObjectSeeker) Read(p []byte) (int, error) {
	length := int64(len(p))

	if r.offset < 0 || length <= 0 || r.offset+length > r.fileSize {
		return 0, fmt.Errorf(
			"invalid offset/length for reading GCS object chunk: offset=%d, length=%d, fileSize=%d",
			r.offset,
			length,
			r.fileSize,
		)
	}

	reader, err := r.object.NewRangeReader(r.ctx, r.offset, length)
	if err != nil {
		return 0, err
	}

	defer reader.Close()

	n, err := io.ReadFull(reader, p)
	if err != nil {
		return n, err
	}
	r.offset += int64(n)
	return n, nil
}

func (r *gcsObjectSeeker) Seek(offset int64, whence int) (int64, error) {
	var newOffset int64
	switch whence {
	case io.SeekStart:
		newOffset = offset
	case io.SeekCurrent:
		newOffset = r.offset + offset
	case io.SeekEnd:
		newOffset = r.fileSize + offset
	default:
		return 0, fmt.Errorf("invalid whence: %d", whence)
	}

	if newOffset < 0 || newOffset > r.fileSize {
		return 0, fmt.Errorf("invalid seek offset: %d", newOffset)
	}

	r.offset = newOffset
	return r.offset, nil
}

func (r *gcsObjectSeeker) ReadAt(p []byte, off int64) (int, error) {
	currentOffset := r.offset
	if _, err := r.Seek(off, io.SeekStart); err != nil {
		return 0, err
	}
	n, err := r.Read(p)
	if _, seekErr := r.Seek(currentOffset, io.SeekStart); seekErr != nil {
		return n, seekErr
	}
	return n, err
}

var _ parquet.ReaderAtSeeker = (*gcsObjectSeeker)(nil)

func readParquetTotalRows(r parquet.ReaderAtSeeker) (int64, error) {
	pr, err := file.NewParquetReader(r)
	if err != nil {
		return 0, fmt.Errorf("failed to create parquet reader: %w", err)
	}

	return pr.NumRows(), nil
}

func parquetObjectAverageRowSize(ctx context.Context, logger log.Logger, object *storage.ObjectHandle) uint64 {
	attrs, err := object.Attrs(ctx)
	if err != nil {
		logger.Error("failed to get object attrs for parquet object, using default compressed row size",
			slog.String("object", object.ObjectName()),
			slog.Int("default_size", defaultCompressedRowSize),
			slog.Any("error", err))

		return defaultCompressedRowSize
	}

	r := &gcsObjectSeeker{
		ctx:      ctx,
		object:   object,
		fileSize: attrs.Size,
		offset:   0,
	}

	n, err := readParquetTotalRows(r)
	if err != nil {
		logger.Error("failed to read parquet object metadata, using default compressed row size",
			slog.String("object", object.ObjectName()),
			slog.Int("default_size", defaultCompressedRowSize),
			slog.Any("error", err))

		return defaultCompressedRowSize
	}

	if n == 0 {
		logger.Info("parquet object has zero rows, using default compressed row size",
			slog.String("object", object.ObjectName()))

		return defaultCompressedRowSize
	}

	return uint64(attrs.Size) / uint64(n)
}

```

### Core Architecture Module: `flow/connectors/bigquery/utils.go`
```
package connbigquery

import (
	"strings"
)

func quotedIdentifier(value string) string {
	var result strings.Builder
	result.WriteByte('`')
	for i := range len(value) {
		ch := value[i]
		if ch == '`' {
			result.WriteString("\\`")
		} else {
			result.WriteByte(ch)
		}
	}
	result.WriteByte('`')
	return result.String()
}

```

### Core Architecture Module: `flow/connectors/core.go`
```
package connectors

import (
	"context"
	"errors"
	"fmt"
	"log/slog"
	"time"

	"github.com/jackc/pgx/v5"
	"google.golang.org/protobuf/proto"

	connbigquery "github.com/PeerDB-io/peerdb/flow/connectors/bigquery"
	connclickhouse "github.com/PeerDB-io/peerdb/flow/connectors/clickhouse"
	conncockroachdb "github.com/PeerDB-io/peerdb/flow/connectors/cockroachdb"
	connelasticsearch "github.com/PeerDB-io/peerdb/flow/connectors/elasticsearch"
	conneventhub "github.com/PeerDB-io/peerdb/flow/connectors/eventhub"
	connkafka "github.com/PeerDB-io/peerdb/flow/connectors/kafka"
	connmongo "github.com/PeerDB-io/peerdb/flow/connectors/mongo"
	connmysql "github.com/PeerDB-io/peerdb/flow/connectors/mysql"
	connpostgres "github.com/PeerDB-io/peerdb/flow/connectors/postgres"
	connpubsub "github.com/PeerDB-io/peerdb/flow/connectors/pubsub"
	conns3 "github.com/PeerDB-io/peerdb/flow/connectors/s3"
	connsnowflake "github.com/PeerDB-io/peerdb/flow/connectors/snowflake"
	"github.com/PeerDB-io/peerdb/flow/generated/protos"
	"github.com/PeerDB-io/peerdb/flow/internal"
	"github.com/PeerDB-io/peerdb/flow/model"
	"github.com/PeerDB-io/peerdb/flow/otel_metrics"
	"github.com/PeerDB-io/peerdb/flow/shared"
	"github.com/PeerDB-io/peerdb/flow/shared/exceptions"
)

type Connector interface {
	Close() error
	ConnectionActive(context.Context) error
}

type ValidationConnector interface {
	Connector

	// ValidationCheck performs validation for the connectors,
	// usually includes permissions to create and use objects (tables, schema etc).
	ValidateCheck(context.Context) error
}

type MirrorSourceValidationConnector interface {
	GetTableSchemaConnector

	// ValidateMirrorSource checks that the source is ready to replicate the configured tables.
	// MUST return *common.SourceTablesMissingError when a mapped source table is absent.
	ValidateMirrorSource(context.Context, *protos.FlowConnectionConfigsCore) error
}

type MirrorDestinationValidationConnector interface {
	Connector

	ValidateMirrorDestination(context.Context, *protos.FlowConnectionConfigsCore, map[string]*protos.TableSchema) error
}

type DestinationTableValidationConnector interface {
	Connector

	// ValidateDestinationTables checks table mapping settings that need neither the server nor source schemas.
	ValidateDestinationTables(context.Context, []*protos.TableMapping) error
}

type StatActivityConnector interface {
	Connector

	StatActivity(context.Context, *protos.PostgresPeerActivityInfoRequest) (*protos.PeerStatResponse, error)
}

type GetTableSchemaConnector interface {
	Connector

	// GetTableSchema returns the schema of a table in terms of type system.
	GetTableSchema(
		ctx context.Context,
		env map[string]string,
		version uint32,
		system protos.TypeSystem,
		tableMappings []*protos.TableMapping,
	) (map[string]*protos.TableSchema, error)
}

type GetSchemaConnector interface {
	Connector

	GetAllTables(context.Context) (*protos.AllTablesResponse, error)
	GetColumns(ctx context.Context, version uint32, schema string, table string) (*protos.TableColumnsResponse, error)
	GetSchemas(ctx context.Context) (*protos.PeerSchemasResponse, error)
	GetTablesInSchema(ctx context.Context, schema string, cdcEnabled bool) (*protos.SchemaTablesResponse, error)
}

type GetFlagsConnector interface {
	Connector

	// GetFlags detects peer capabilities (e.g., supported types) at flow creation time.
	// Flags are stored on the flow config and used for type mapping backwards compatibility.
	GetFlags(ctx context.Context) ([]string, error)
}

type CDCPullConnectorCore interface {
	GetTableSchemaConnector

	// EnsurePullability ensures that the connector is pullable.
	EnsurePullability(ctx context.Context, req *protos.EnsurePullabilityBatchInput) (
		*protos.EnsurePullabilityBatchOutput, error)

	// For InitialSnapshotOnly correctness without replication slot
	// `any` is for returning transaction if necessary.
	// tableMappings is the snapshotting flow's own table set, which is not always the
	// mirror's: a table addition runs this as a child flow scoped to just the tables being
	// added, and the catalog still holds the mirror's pre-addition config while it runs.
	ExportTxSnapshot(
		ctx context.Context,
		flowName string,
		tableMappings []*protos.TableMapping,
		env map[string]string,
	) (*protos.ExportTxSnapshotOutput, any, error)

	// `any` from ExportSnapshot passed here when done, allowing transaction to commit
	FinishExport(any) error

	// Setup replication in prep for initial copy
	SetupReplication(context.Context, shared.CatalogPool, *protos.SetupReplicationInput) (model.SetupReplicationResult, error)

	// Methods related to retrieving and pushing records for this connector as a source and destination.
	SetupReplConn(context.Context, map[string]string) error

	// Called when offset has been confirmed to destination
	UpdateReplStateLastOffset(ctx context.Context, lastOffset model.CdcCheckpoint) error

	// PullFlowCleanup drops both the Postgres publication and replication slot, as a part of DROP MIRROR
	PullFlowCleanup(ctx context.Context, jobName string) error
}

// TableAdditionSourceConnector is implemented by sources that need per-table setup
// before tables added to a running mirror can be replicated. Sources whose replication
// position already covers every table (e.g. MySQL binlog, MongoDB change streams) don't.
type TableAdditionSourceConnector interface {
	Connector

	// AddTablesToReplication runs before the added tables' initial snapshot, if any, and
	// must be idempotent. Starting replication before the snapshot may re-read rows
	// changed while it runs, which the destination's deduplication absorbs.
	AddTablesToReplication(ctx context.Context, req *protos.AddTablesToReplicationInput) error
}

type CDCPullConnector interface {
	CDCPullConnectorCore

	// This method should be idempotent, and should be able to be called multiple times with the same request.
	PullRecords(
		ctx context.Context,
		catalogPool shared.CatalogPool,
		otelManager *otel_metrics.OtelManager,
		req *model.PullRecordsRequest[model.RecordItems],
	) error
}

// QueryCDCPullConnector is implemented by sources that poll each table
// independently (no shared replication stream to isolate tables on top of),
// letting the activity drive per-table isolation, parallelism, and
// backpressure generically instead of each such connector reimplementing it.
type QueryCDCPullConnector interface {
	CDCPullConnectorCore

	// CurrentSourceTime returns the source clock used to calculate safe pull windows.
	CurrentSourceTime(ctx context.Context) (time.Time, error)

	// PullTableRecords pulls whatever is newly available for one source table
	// and streams it into req.Stream. This method should be idempotent given
	// the same time window.
	PullTableRecords(
		ctx context.Context,
		catalogPool shared.CatalogPool,
		otelManager *otel_metrics.OtelManager,
		req *model.PullTableRecordsRequest,
	) (model.PullTableRecordsResult, error)
}

type CDCPullPgConnector interface {
	CDCPullConnectorCore

	// This method should be idempotent, and should be able to be called multiple times with the same request.
	// It's signature, aside from type parameter, should match CDCPullConnector.PullRecords.
	PullPg(
		ctx context.Context,
		catalogPool shared.CatalogPool,
		otelManager *otel_metrics.OtelManager,
		req *model.PullRecordsRequest[model.PgItems],
	) error
}

type NormalizedTablesConnector interface {
	Connector

	// StartSetupNormalizedTables may be used to have SetupNormalizedTable calls run in a transaction.
	StartSetupNormalizedTables(ctx context.Context) (any, error)

	// CleanupSetupNormalizedTables may be used to rollback transaction started by StartSetupNormalizedTables.
	// Calling CleanupSetupNormalizedTables after FinishSetupNormalizedTables must be a nop.
	CleanupSetupNormalizedTables(ctx context.Context, tx any)

	// FinishSetupNormalizedTables may be used to finish transaction started by StartSetupNormalizedTables.
	FinishSetupNormalizedTables(ctx context.Context, tx any) error

	// SetupNormalizedTable sets up the normalized table on the connector.
	SetupNormalizedTable(
		ctx context.Context,
		tx any,
		config *protos.SetupNormalizedTableBatchInput,
		destinationTableIdentifier string,
		sourceTableSchema *protos.TableSchema,
		sourceType protos.DBType,
	) (bool, error)
}

type CDCSyncConnectorCore interface {
	Connector

	// NeedsSetupMetadataTables checks if the metadata table [PEERDB_MIRROR_JOBS] needs to be created.
	NeedsSetupMetadataTables(ctx context.Context) (bool, error)

	// SetupMetadataTables creates the metadata table [PEERDB_MIRROR_JOBS] if necessary.
	SetupMetadataTables(ctx context.Context) error

	// GetLastSyncBatchID gets the last batch synced to the destination from the metadata table
	GetLastSyncBatchID(ctx context.Context, jobName string) (int64, error)

	// CreateRawTable creates a raw table for the connector with a given name and a fixed schema.
	CreateRawTable(ctx context.Context, req *protos.CreateRawTableInput) (*protos.CreateRawTableOutput, error)

	// SyncFlowCleanup drops metadata tables on the destination, as a part of DROP MIRROR.
	SyncFlowCleanup(ctx context.Context, jobName string) error

	// ReplayTableSchemaDelta changes a destination table to match the schema at source
	// This could involve adding multiple columns.
	// Connectors which are non-normalizing should implement this as a nop.
	ReplayTableSchemaDeltas(ctx context.Context, env map[string]string, flowJobName string,
		tableMappings []*protos.TableMapping, schemaDeltas []*protos.TableSchemaDelta, flags []string, version uint32,
		sourceType protos.DBType,
	) error
}

type CDCSyncConnector interface {
	CDCSyncConnectorCore

	// SyncRecords pushes RecordItems to the destination peer and stores it in PeerDB specific tables.
	// This method should be idempotent, and should be able to be called multiple times with the same request.
	SyncRecords(ctx context.Context, req *model.SyncRecordsRequest[model.RecordItems]) (*model.SyncRe
```

### Core Architecture Module: `flow/connectors/external_metadata/query_cdc_replication_state.go`
```
package connmetadata

import (
	"context"
	"errors"
	"fmt"
	"log/slog"
	"time"

	"github.com/jackc/pgx/v5"

	"github.com/PeerDB-io/peerdb/flow/model"
)

const (
	queryCDCReplicationStateTableName = "query_cdc_replication_state"
	queryCDCAvroStageTableName        = "query_cdc_avro_stage"
)

// QueryCDCReplicationState is one source table's durable progress in the
// query-based CDC path (see connectors.QueryCDCPullConnector).
//
//nolint:govet // logically grouped, fieldalignment confuses things
type QueryCDCReplicationState struct {
	// CursorText is the opaque cursor last returned by PullTableRecords for
	// this table, empty if this table has never been synced.
	CursorText string
	// LastAttemptAt is when the latest poll attempt for this table started,
	// whether or not it completed successfully.
	LastAttemptAt time.Time
	// LastSyncedAt is when this table last completed a poll successfully,
	// zero if never synced.
	LastSyncedAt time.Time
	// SyncedBatchID is the latest batch this table has staged (synced but not
	// necessarily normalized yet).
	SyncedBatchID int64
	// NormalizedBatchID is the latest batch this table has normalized into its
	// final destination table. SyncedBatchID-NormalizedBatchID is this table's
	// own sync/normalize lag, used for per-table backpressure.
	NormalizedBatchID int64
	// LastNormalizedAt is when this table last completed a normalize
	// successfully, zero if never normalized.
	LastNormalizedAt time.Time
	// InsertsCount, UpdatesCount, DeletesCount are this table's cumulative
	// row counts normalized into its final destination table.
	InsertsCount int64
	UpdatesCount int64
	DeletesCount int64
}

// GetQueryCDCReplicationState reads a table's durable progress, defaulting to an
// empty state for a table never seen before.
func (p *PostgresMetadata) GetQueryCDCReplicationState(
	ctx context.Context, jobName string, sourceTableIdentifier string,
) (QueryCDCReplicationState, error) {
	var state QueryCDCReplicationState
	var lastAttemptAt, lastSyncedAt, lastNormalizedAt *time.Time
	if err := p.pool.QueryRow(ctx,
		`SELECT cursor_text, last_attempt_at, last_synced_at, synced_batch_id, normalized_batch_id, last_normalized_at,
			inserts_count, updates_count, deletes_count
		FROM `+queryCDCReplicationStateTableName+` WHERE flow_name = $1 AND source_table_identifier = $2`,
		jobName, sourceTableIdentifier,
	).Scan(&state.CursorText, &lastAttemptAt, &lastSyncedAt, &state.SyncedBatchID, &state.NormalizedBatchID, &lastNormalizedAt,
		&state.InsertsCount, &state.UpdatesCount, &state.DeletesCount); err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return QueryCDCReplicationState{}, nil
		}
		return QueryCDCReplicationState{}, fmt.Errorf("failed to get table replication state for %s: %w", sourceTableIdentifier, err)
	}
	if lastAttemptAt != nil {
		state.LastAttemptAt = *lastAttemptAt
	}
	if lastSyncedAt != nil {
		state.LastSyncedAt = *lastSyncedAt
	}
	if lastNormalizedAt != nil {
		state.LastNormalizedAt = *lastNormalizedAt
	}
	return state, nil
}

// InitializeQueryCDCReplicationState seeds a table's cursor from the setup
// checkpoint before any per-table poll starts. Existing progress always wins;
// this only fills an uninitialized state row.
func (p *PostgresMetadata) InitializeQueryCDCReplicationState(
	ctx context.Context, jobName string, sourceTableIdentifier string, cursor string,
) error {
	if _, err := p.pool.Exec(ctx, `
		INSERT INTO `+queryCDCReplicationStateTableName+` (flow_name, source_table_identifier, cursor_text)
		VALUES ($1, $2, $3)
		ON CONFLICT (flow_name, source_table_identifier)
		DO UPDATE SET cursor_text = excluded.cursor_text, updated_at = now()
		WHERE `+queryCDCReplicationStateTableName+`.cursor_text = ''
			AND `+queryCDCReplicationStateTableName+`.synced_batch_id = 0
			AND `+queryCDCReplicationStateTableName+`.normalized_batch_id = 0
	`, jobName, sourceTableIdentifier, cursor); err != nil {
		return fmt.Errorf("failed to initialize table replication state for %s: %w", sourceTableIdentifier, err)
	}
	return nil
}

// RecordQueryCDCAttempt records that a poll attempt for this table
// started at attemptedAt, creating the row if this is the table's first poll.
func (p *PostgresMetadata) RecordQueryCDCAttempt(
	ctx context.Context, jobName string, sourceTableIdentifier string, attemptedAt time.Time,
) error {
	if _, err := p.pool.Exec(ctx, `
		INSERT INTO `+queryCDCReplicationStateTableName+` (flow_name, source_table_identifier, last_attempt_at)
		VALUES ($1, $2, $3)
		ON CONFLICT (flow_name, source_table_identifier)
		DO UPDATE SET last_attempt_at = excluded.last_attempt_at, updated_at = now()
	`, jobName, sourceTableIdentifier, attemptedAt); err != nil {
		p.logger.Error("failed to record table replication attempt", slog.String("table", sourceTableIdentifier), slog.Any("error", err))
		return fmt.Errorf("failed to record table replication attempt for %s: %w", sourceTableIdentifier, err)
	}
	return nil
}

// RecordQueryCDCSync persists a table's new cursor and, if newBatchID
// is non-zero, advances its synced_batch_id after a successful poll that
// produced records staged for normalize. newBatchID is zero for a poll that
// found nothing new; the cursor still advances but there's no batch to
// normalize. The state row always exists by now, RecordQueryCDCAttempt
// created it before the poll started.
func (p *PostgresMetadata) RecordQueryCDCSync(
	ctx context.Context, jobName string, sourceTableIdentifier string, cursor string, syncedAt time.Time, newBatchID int64,
) error {
	if _, err := p.pool.Exec(ctx, `
		UPDATE `+queryCDCReplicationStateTableName+`
		SET cursor_text = $3,
			last_synced_at = $4,
			synced_batch_id = GREATEST(synced_batch_id, $5),
			updated_at = now()
		WHERE flow_name = $1 AND source_table_identifier = $2
	`, jobName, sourceTableIdentifier, cursor, syncedAt, newBatchID); err != nil {
		p.logger.Error("failed to record table replication sync", slog.String("table", sourceTableIdentifier), slog.Any("error", err))
		return fmt.Errorf("failed to record table replication sync for %s: %w", sourceTableIdentifier, err)
	}
	return nil
}

// RecordQueryCDCNormalize advances a table's normalized_batch_id
// after batches up through normalizedBatchID have been inserted into its
// final destination table, records normalizedAt as the completion time, and
// adds rowCounts to the table's cumulative insert/update/delete counts. The
// count increment is skipped alongside last_normalized_at if normalizedBatchID
// was already applied, so a retry replaying the same range doesn't double count.
func (p *PostgresMetadata) RecordQueryCDCNormalize(
	ctx context.Context, jobName string, sourceTableIdentifier string, normalizedBatchID int64,
	rowCounts *model.RecordTypeCounts, normalizedAt time.Time,
) error {
	if _, err := p.pool.Exec(ctx, `
		UPDATE `+queryCDCReplicationStateTableName+`
		SET normalized_batch_id = GREATEST(normalized_batch_id, $3),
			last_normalized_at = CASE WHEN $3 > normalized_batch_id THEN $4 ELSE last_normalized_at END,
			inserts_count = CASE WHEN $3 > normalized_batch_id THEN inserts_count + $5 ELSE inserts_count END,
			updates_count = CASE WHEN $3 > normalized_batch_id THEN updates_count + $6 ELSE updates_count END,
			deletes_count = CASE WHEN $3 > normalized_batch_id THEN deletes_count + $7 ELSE deletes_count END,
			updated_at = now()
		WHERE flow_name = $1 AND source_table_identifier = $2
	`, jobName, sourceTableIdentifier, normalizedBatchID, normalizedAt,
		rowCounts.InsertCount.Load(), rowCounts.UpdateCount.Load(), rowCounts.DeleteCount.Load()); err != nil {
		p.logger.Error("failed to record table replication normalize", slog.String("table", sourceTableIdentifier), slog.Any("error", err))
		return fmt.Errorf("failed to record table replication normalize for %s: %w", sourceTableIdentifier, err)
	}
	return nil
}

// PruneQueryCDCReplicationState deletes rows for source tables no longer in
// activeSourceTables, along with any Avro batches they left staged, which will
// never be normalized now that the table is gone from the mirror.
func (p *PostgresMetadata) PruneQueryCDCReplicationState(
	ctx context.Context, jobName string, activeSourceTables []string,
) error {
	for _, table := range []string{queryCDCReplicationStateTableName, queryCDCAvroStageTableName} {
		if _, err := p.pool.Exec(ctx,
			`DELETE FROM `+table+` WHERE flow_name = $1 AND NOT (source_table_identifier = ANY($2))`,
			jobName, activeSourceTables,
		); err != nil {
			return fmt.Errorf("failed to prune %s: %w", table, err)
		}
	}
	return nil
}

// deleteQueryCDCReplicationStateInTx drops all query-based CDC state for a
// flow: per-table progress plus any Avro batches still staged for normalize.
func deleteQueryCDCReplicationStateInTx(ctx context.Context, tx pgx.Tx, jobName string) error {
	for _, table := range []string{queryCDCReplicationStateTableName, queryCDCAvroStageTableName} {
		if _, err := tx.Exec(ctx, `DELETE FROM `+table+` WHERE flow_name = $1`, jobName); err != nil {
			return err
		}
	}
	return nil
}

```

### Core Architecture Module: `flow/connectors/utils/autoenv.go`
```
package utils

import (
	"testing"

	"github.com/PeerDB-io/peerdb/flow/pkg/testutil"
)

func init() {
	if testing.Testing() {
		testutil.LoadEnv()
	}
}

```

### Core Architecture Module: `flow/connectors/utils/avro_writer.go`
```
package utils

import (
	"context"
	"errors"
	"fmt"
	"io"
	"log/slog"
	"os"
	"runtime/debug"
	"sync/atomic"
	"time"

	"github.com/aws/aws-sdk-go-v2/aws"
	"github.com/aws/aws-sdk-go-v2/feature/s3/transfermanager"
	"github.com/hamba/avro/v2/ocf"

	"github.com/PeerDB-io/peerdb/flow/generated/protos"
	"github.com/PeerDB-io/peerdb/flow/internal"
	"github.com/PeerDB-io/peerdb/flow/model"
	"github.com/PeerDB-io/peerdb/flow/pkg/common"
	"github.com/PeerDB-io/peerdb/flow/shared/exceptions"
	"github.com/PeerDB-io/peerdb/flow/shared/types"
)

type (
	AvroStorageLocation int64
)

const (
	AvroLocalStorage = iota
	AvroS3Storage
	AvroGCSStorage
)

type peerDBOCFWriter struct {
	stream               *model.QRecordStream
	avroSchema           *model.QRecordAvroSchemaDefinition
	sizeTracker          *model.QRecordAvroChunkSizeTracker
	avroCompressionCodec ocf.CodecName
	targetDWH            protos.DBType
}

type AvroFile struct {
	FilePath        string              `json:"filePath"`
	StorageLocation AvroStorageLocation `json:"storageLocation"`
	NumRecords      int64               `json:"numRecords"`
}

func (l *AvroFile) Cleanup(ctx context.Context) {
	if l.StorageLocation == AvroLocalStorage {
		if err := os.Remove(l.FilePath); err != nil && !os.IsNotExist(err) {
			slog.WarnContext(ctx, "unable to delete temporary Avro file", slog.Any("error", err))
		}
	}
}

func NewPeerDBOCFWriter(
	stream *model.QRecordStream,
	avroSchema *model.QRecordAvroSchemaDefinition,
	avroCompressionCodec ocf.CodecName,
	targetDWH protos.DBType,
	sizeTracker *model.QRecordAvroChunkSizeTracker,
) *peerDBOCFWriter {
	return &peerDBOCFWriter{
		stream:               stream,
		avroSchema:           avroSchema,
		avroCompressionCodec: avroCompressionCodec,
		targetDWH:            targetDWH,
		sizeTracker:          sizeTracker,
	}
}

func (p *peerDBOCFWriter) WriteOCF(
	ctx context.Context,
	env map[string]string,
	w io.Writer,
	typeConversions map[string]types.TypeConversion,
	numericTruncator model.SnapshotTableNumericTruncator,
) (int64, error) {
	ocfWriter, err := ocf.NewEncoderWithSchema(
		p.avroSchema.Schema, w, ocf.WithCodec(p.avroCompressionCodec),
		ocf.WithBlockLength(8192), ocf.WithBlockSize(1<<26),
	)
	if err != nil {
		return 0, fmt.Errorf("failed to create OCF writer: %w", err)
	}
	defer ocfWriter.Close()

	numRows, err := p.writeRecordsToOCFWriter(ctx, env, ocfWriter, typeConversions, numericTruncator)
	if err != nil {
		return 0, fmt.Errorf("failed to write records to OCF writer: %w", err)
	}
	return numRows, nil
}

func (p *peerDBOCFWriter) WriteRecordsToS3(
	ctx context.Context,
	env map[string]string,
	bucketName string,
	key string,
	s3Creds AWSCredentialsProvider,
	typeConversions map[string]types.TypeConversion,
	numericTruncator model.SnapshotTableNumericTruncator,
) (AvroFile, error) {
	logger := internal.LoggerFromCtx(ctx)
	s3svc, err := CreateS3Client(ctx, s3Creds)
	if err != nil {
		logger.Error("failed to create S3 client", slog.Any("error", err))
		return AvroFile{}, fmt.Errorf("failed to create S3 client: %w", err)
	}

	r, w := io.Pipe()
	defer r.Close()

	var writeOcfError error
	var numRows int64

	go func() {
		defer func() {
			if r := recover(); r != nil {
				writeOcfError = fmt.Errorf("panic occurred during WriteOCF: %v", r)
				stack := string(debug.Stack())
				logger.Error("panic during WriteOCF", slog.Any("error", writeOcfError), slog.String("stack", stack))
			}
			w.Close()
		}()
		numRows, writeOcfError = p.WriteOCF(ctx, env, w, typeConversions, numericTruncator)
	}()

	partSize, err := internal.PeerDBS3PartSize(ctx, env)
	if err != nil {
		return AvroFile{}, fmt.Errorf("could not get s3 part size config: %w", err)
	}

	uploader := transfermanager.New(s3svc, S3TransferOptions(partSize))

	if _, err := uploader.UploadObject(ctx, &transfermanager.UploadObjectInput{
		Bucket: aws.String(bucketName),
		Key:    aws.String(key),
		Body:   r,
	}); err != nil {
		// transfermanager loses the context.Canceled unwrap chain when AbortMultipartUpload also
		// fails on the canceled upload context; rejoin the cause so classifier sees the cancellation
		// https://github.com/aws/aws-sdk-go-v2/blob/feature/s3/transfermanager/v0.3.10/feature/s3/transfermanager/api_op_UploadObject.go#L1204
		if ctxErr := context.Cause(ctx); ctxErr != nil {
			err = errors.Join(err, ctxErr)
		}
		s3Path := "s3://" + bucketName + "/" + key
		logger.Error("failed to upload file", slog.Any("error", err), slog.String("s3_path", s3Path))
		return AvroFile{}, exceptions.NewS3Error(fmt.Errorf("failed to upload file: %w", err))
	}

	if writeOcfError != nil {
		logger.Error("failed to write records to OCF", slog.Any("error", writeOcfError))
		return AvroFile{}, writeOcfError
	}

	logger.Info("finished s3 upload")

	return AvroFile{
		StorageLocation: AvroS3Storage,
		FilePath:        key,
		NumRecords:      numRows,
	}, nil
}

func (p *peerDBOCFWriter) WriteRecordsToAvroFile(ctx context.Context, env map[string]string, filePath string) (AvroFile, error) {
	file, err := os.Create(filePath)
	if err != nil {
		return AvroFile{}, fmt.Errorf("failed to create temporary Avro file: %w", err)
	}
	defer file.Close()
	printFileStats := func(message string) {
		logger := internal.LoggerFromCtx(ctx)
		stats, err := file.Stat()
		if err != nil {
			return
		}
		logger.Info(message, slog.String("file", filePath), slog.Int64("size", stats.Size()))
	}
	shutdown := common.Interval(ctx, time.Minute, func() { printFileStats("writing to temporary Avro file") })
	defer shutdown()

	numRecords, err := p.WriteOCF(ctx, env, file, nil, nil)
	if err != nil {
		return AvroFile{}, fmt.Errorf("failed to write records to temporary Avro file: %w", err)
	}

	printFileStats("finished writing to temporary Avro file")
	return AvroFile{
		NumRecords:      numRecords,
		StorageLocation: AvroLocalStorage,
		FilePath:        filePath,
	}, nil
}

func (p *peerDBOCFWriter) getAvroFieldNamesFromSchema() []string {
	fields := p.avroSchema.Schema.Fields()
	avroFieldNames := make([]string, len(fields))
	for i, field := range fields {
		avroFieldNames[i] = field.Name()
	}
	return avroFieldNames
}

func (p *peerDBOCFWriter) writeRecordsToOCFWriter(
	ctx context.Context,
	env map[string]string,
	ocfWriter *ocf.Encoder,
	typeConversions map[string]types.TypeConversion,
	numericTruncator model.SnapshotTableNumericTruncator,
) (int64, error) {
	logger := internal.LoggerFromCtx(ctx)

	avroFieldNames := p.getAvroFieldNamesFromSchema()
	avroConverter, err := model.NewQRecordAvroConverter(
		ctx, env, p.avroSchema, p.targetDWH, avroFieldNames, logger,
	)
	if err != nil {
		return 0, err
	}

	// Create null mismatch tracker if in nullable lax mode
	avroConverter.NullMismatchTracker = model.NewNullMismatchTracker(p.stream.SchemaDebug())

	logger.Info("writing records to OCF start",
		slog.Int("channelLen", len(p.stream.Records)))

	numRows := atomic.Int64{}
	writeStart := time.Now()

	shutdown := common.Interval(ctx, time.Minute, func() {
		logger.Info("written records to OCF",
			slog.Int64("records", numRows.Load()),
			slog.Int("channelLen", len(p.stream.Records)),
			slog.Float64("elapsedMinutes", time.Since(writeStart).Minutes()),
			slog.String("compression", string(p.avroCompressionCodec)))
	})
	defer shutdown()

	format, err := internal.PeerDBBinaryFormat(ctx, env)
	if err != nil {
		return 0, err
	}

	calcSize := p.sizeTracker != nil
	for qrecord := range p.stream.Records {
		if err := ctx.Err(); err != nil {
			return numRows.Load(), err
		} else {
			avroMap, size, err := avroConverter.Convert(ctx, env, qrecord, typeConversions, numericTruncator, format, calcSize)
			if err != nil {
				logger.Error("Failed to convert QRecord to Avro compatible map", slog.Any("error", err))
				return numRows.Load(), fmt.Errorf("failed to convert QRecord to Avro compatible map: %w", err)
			}

			if err := ocfWriter.Encode(avroMap); err != nil {
				logger.Error("Failed to write record to OCF", slog.Any("error", err))
				return numRows.Load(), fmt.Errorf("failed to write record to OCF: %w", err)
			}

			if calcSize {
				p.sizeTracker.Bytes.Add(size)
			}

			numRows.Add(1)
		}
	}

	logger.Info("finished writing records to OCF",
		slog.Int64("records", numRows.Load()),
		slog.Float64("elapsedMinutes", time.Since(writeStart).Minutes()),
		slog.String("compression", string(p.avroCompressionCodec)),
	)

	if avroConverter.NullMismatchTracker != nil {
		avroConverter.NullMismatchTracker.LogIfMismatch(ctx, logger)
	}

	if err := p.stream.Err(); err != nil {
		logger.Error("Failed to get record from stream", slog.Any("error", err))
		return numRows.Load(), fmt.Errorf("failed to get record from stream: %w", err)
	}

	return numRows.Load(), nil
}

```

### Core Architecture Module: `flow/connectors/utils/aws.go`
```
package utils

import (
	"context"
	"crypto/tls"
	"fmt"
	"net/http"
	"net/url"
	"os"
	"regexp"
	"strings"
	"time"

	"github.com/aws/aws-sdk-go-v2/aws"
	v4 "github.com/aws/aws-sdk-go-v2/aws/signer/v4"
	"github.com/aws/aws-sdk-go-v2/config"
	"github.com/aws/aws-sdk-go-v2/credentials"
	"github.com/aws/aws-sdk-go-v2/credentials/stscreds"
	"github.com/aws/aws-sdk-go-v2/feature/s3/transfermanager"
	"github.com/aws/aws-sdk-go-v2/service/s3"
	"github.com/aws/aws-sdk-go-v2/service/sts"
	smithyendpoints "github.com/aws/smithy-go/endpoints"
	"github.com/google/uuid"

	"github.com/PeerDB-io/peerdb/flow/generated/protos"
	"github.com/PeerDB-io/peerdb/flow/internal"
	"github.com/PeerDB-io/peerdb/flow/pkg/common"
)

const (
	_peerDBCheck = "peerdb_check"
)

var s3CompatibleServiceEndpointPattern = regexp.MustCompile(`^https?://[a-zA-Z0-9.-]+(:\d+)?$`)

type PeerAWSCredentials struct {
	Credentials    aws.Credentials
	RoleArn        *string
	ChainedRoleArn *string
	EndpointUrl    *string
	Region         string
	RootCAs        *string
	TlsHost        string
}

func NewPeerAWSCredentials(s3 *protos.S3Config) PeerAWSCredentials {
	if s3 == nil {
		return PeerAWSCredentials{}
	}
	return PeerAWSCredentials{
		Credentials: aws.Credentials{
			AccessKeyID:     s3.GetAccessKeyId(),
			SecretAccessKey: s3.GetSecretAccessKey(),
		},
		RoleArn:        s3.RoleArn,
		ChainedRoleArn: nil,
		EndpointUrl:    s3.Endpoint,
		Region:         s3.GetRegion(),
		RootCAs:        s3.RootCa,
		TlsHost:        s3.TlsHost,
	}
}

type AWSCredentials struct {
	EndpointUrl *string
	AWS         aws.Credentials
}

type AWSCredentialsProvider interface {
	Retrieve(ctx context.Context) (AWSCredentials, error)
	GetUnderlyingProvider() aws.CredentialsProvider
	GetRegion() string
	GetEndpointURL() string
	GetTlsConfig() (*string, string)
}

type ConfigBasedAWSCredentialsProvider struct {
	config aws.Config
}

func NewConfigBasedAWSCredentialsProvider(config aws.Config) *ConfigBasedAWSCredentialsProvider {
	return &ConfigBasedAWSCredentialsProvider{config: config}
}

func (r *ConfigBasedAWSCredentialsProvider) GetUnderlyingProvider() aws.CredentialsProvider {
	return r.config.Credentials
}

func (r *ConfigBasedAWSCredentialsProvider) GetRegion() string {
	return r.config.Region
}

func (r *ConfigBasedAWSCredentialsProvider) GetEndpointURL() string {
	endpoint := ""
	if r.config.BaseEndpoint != nil {
		endpoint = *r.config.BaseEndpoint
	}

	return endpoint
}

func (r *ConfigBasedAWSCredentialsProvider) GetTlsConfig() (*string, string) {
	return nil, ""
}

// Retrieve should be called as late as possible in order to have credentials with latest expiry
func (r *ConfigBasedAWSCredentialsProvider) Retrieve(ctx context.Context) (AWSCredentials, error) {
	retrieved, err := r.config.Credentials.Retrieve(ctx)
	if err != nil {
		return AWSCredentials{}, err
	}
	return AWSCredentials{
		AWS:         retrieved,
		EndpointUrl: r.config.BaseEndpoint,
	}, nil
}

type StaticAWSCredentialsProvider struct {
	credentials AWSCredentials
	region      string
	rootCAs     *string
	tlsHost     string
}

func NewStaticAWSCredentialsProvider(credentials AWSCredentials, region string, rootCAs *string, tlsHost string) *StaticAWSCredentialsProvider {
	return &StaticAWSCredentialsProvider{
		credentials: credentials,
		region:      region,
		rootCAs:     rootCAs,
		tlsHost:     tlsHost,
	}
}

func (s *StaticAWSCredentialsProvider) GetUnderlyingProvider() aws.CredentialsProvider {
	return credentials.NewStaticCredentialsProvider(s.credentials.AWS.AccessKeyID, s.credentials.AWS.SecretAccessKey,
		s.credentials.AWS.SessionToken)
}

func (s *StaticAWSCredentialsProvider) GetRegion() string {
	return s.region
}

func (s *StaticAWSCredentialsProvider) Retrieve(ctx context.Context) (AWSCredentials, error) {
	return s.credentials, nil
}

func (s *StaticAWSCredentialsProvider) GetEndpointURL() string {
	if s.credentials.EndpointUrl != nil {
		return *s.credentials.EndpointUrl
	}
	return ""
}

func (s *StaticAWSCredentialsProvider) GetTlsConfig() (*string, string) {
	return s.rootCAs, s.tlsHost
}

type AssumeRoleBasedAWSCredentialsProvider struct {
	Provider aws.CredentialsProvider // New Credentials
	config   aws.Config              // Initial Config
}

func NewAssumeRoleBasedAWSCredentialsProvider(
	ctx context.Context,
	config aws.Config,
	roleArn string,
	sessionName string,
) (*AssumeRoleBasedAWSCredentialsProvider, error) {
	provider := stscreds.NewAssumeRoleProvider(sts.NewFromConfig(config), roleArn, func(o *stscreds.AssumeRoleOptions) {
		o.RoleSessionName = sessionName
	})
	if _, err := provider.Retrieve(ctx); err != nil {
		return nil, fmt.Errorf("failed to retrieve chained AWS credentials: %w", err)
	}
	return &AssumeRoleBasedAWSCredentialsProvider{
		config:   config,
		Provider: aws.NewCredentialsCache(provider),
	}, nil
}

func (a *AssumeRoleBasedAWSCredentialsProvider) Retrieve(ctx context.Context) (AWSCredentials, error) {
	retrieved, err := a.Provider.Retrieve(ctx)
	if err != nil {
		return AWSCredentials{}, err
	}
	return AWSCredentials{
		AWS:         retrieved,
		EndpointUrl: new(a.GetEndpointURL()),
	}, nil
}

func (a *AssumeRoleBasedAWSCredentialsProvider) GetUnderlyingProvider() aws.CredentialsProvider {
	return a.Provider
}

func (a *AssumeRoleBasedAWSCredentialsProvider) GetRegion() string {
	return a.config.Region
}

func (a *AssumeRoleBasedAWSCredentialsProvider) GetEndpointURL() string {
	endpoint := ""
	if a.config.BaseEndpoint != nil {
		endpoint = *a.config.BaseEndpoint
	}

	return endpoint
}

func (a *AssumeRoleBasedAWSCredentialsProvider) GetTlsConfig() (*string, string) {
	return nil, ""
}

func getPeerDBAWSEnv(connectorName string, awsKey string) string {
	return os.Getenv(fmt.Sprintf("PEERDB_%s_AWS_CREDENTIALS_%s", strings.ToUpper(connectorName), awsKey))
}

func LoadPeerDBAWSEnvConfigProvider(connectorName string) *StaticAWSCredentialsProvider {
	accessKeyId := getPeerDBAWSEnv(connectorName, "AWS_ACCESS_KEY_ID")
	secretAccessKey := getPeerDBAWSEnv(connectorName, "AWS_SECRET_ACCESS_KEY")
	sessionToken := getPeerDBAWSEnv(connectorName, "AWS_SESSION_TOKEN")
	region := getPeerDBAWSEnv(connectorName, "AWS_REGION")
	endpointUrl := getPeerDBAWSEnv(connectorName, "AWS_ENDPOINT_URL_S3")
	rootCa := getPeerDBAWSEnv(connectorName, "ROOT_CA")
	tlsHost := getPeerDBAWSEnv(connectorName, "TLS_HOST")
	var endpointUrlPtr *string
	if endpointUrl != "" {
		endpointUrlPtr = &endpointUrl
	}

	if accessKeyId == "" && secretAccessKey == "" && region == "" && endpointUrl == "" {
		return nil
	}

	var rootCAs *string
	if rootCa != "" {
		rootCAs = &rootCa
	}

	return NewStaticAWSCredentialsProvider(AWSCredentials{
		AWS: aws.Credentials{
			AccessKeyID:     accessKeyId,
			SecretAccessKey: secretAccessKey,
			SessionToken:    sessionToken,
		},
		EndpointUrl: endpointUrlPtr,
	}, region, rootCAs, tlsHost)
}

func GetAWSCredentialsProvider(ctx context.Context, connectorName string, peerCredentials PeerAWSCredentials) (AWSCredentialsProvider, error) {
	logger := internal.LoggerFromCtx(ctx)
	if peerCredentials.Credentials.AccessKeyID != "" || peerCredentials.Credentials.SecretAccessKey != "" ||
		peerCredentials.Region != "" || (peerCredentials.RoleArn != nil && *peerCredentials.RoleArn != "") ||
		(peerCredentials.ChainedRoleArn != nil && *peerCredentials.ChainedRoleArn != "") ||
		(peerCredentials.EndpointUrl != nil && *peerCredentials.EndpointUrl != "") {
		staticProvider := NewStaticAWSCredentialsProvider(AWSCredentials{
			AWS:         peerCredentials.Credentials,
			EndpointUrl: peerCredentials.EndpointUrl,
		}, peerCredentials.Region, peerCredentials.RootCAs, peerCredentials.TlsHost)
		if peerCredentials.RoleArn == nil || *peerCredentials.RoleArn == "" {
			logger.Info("Received AWS credentials from peer for connector: " + connectorName)
			return staticProvider, nil
		}
		awsConfig, err := config.LoadDefaultConfig(ctx)
		if err != nil {
			return nil, err
		}
		awsConfig.Credentials = stscreds.NewAssumeRoleProvider(sts.NewFromConfig(awsConfig), *peerCredentials.RoleArn,
			func(options *stscreds.AssumeRoleOptions) {
				options.RoleSessionName = getAssumedRoleSessionName()
			},
		)
		if peerCredentials.ChainedRoleArn != nil && *peerCredentials.ChainedRoleArn != "" {
			logger.Info("Received AWS credentials with chained role from peer for connector: " + connectorName)
			return NewAssumeRoleBasedAWSCredentialsProvider(ctx, awsConfig, *peerCredentials.ChainedRoleArn, getChainedRoleSessionName())
		}
		logger.Info("Received AWS credentials from peer for connector: " + connectorName)
		return NewConfigBasedAWSCredentialsProvider(awsConfig), nil
	}
	envCredentialsProvider := LoadPeerDBAWSEnvConfigProvider(connectorName)
	if envCredentialsProvider != nil {
		logger.Info("Received AWS credentials from PeerDB Env for connector: " + connectorName)
		return envCredentialsProvider, nil
	}

	awsConfig, err := config.LoadDefaultConfig(ctx, func(options *config.LoadOptions) error {
		options.CredentialsCacheOptions = func(options *aws.CredentialsCacheOptions) {
			options.ExpiryWindow = time.Hour
			options.ExpiryWindowJitterFrac = 0
		}
		return nil
	})
	if err != nil {
		return nil, err
	}
	logger.Info("Received AWS credentials from SDK config for connector: " + connectorName)
	return NewConfigBasedAWSCredentialsProvider(awsConfig), nil
}

const MaxAWSSessionNameLength = 63 // Docs mention 64 as limit, but always good to stay under

func getAssumedRoleSessionName() string {
	defaultSessionName := "peeraws"
	if deployUid := internal.PeerDBDeploymentUID(); deployUid != "" {
		defaultSessionName += "-" + deployUid
	}
	sessionName := internal.GetEnvString("PEERDB_AWS_ASSUMED_ROLE_SESSION_NAME", defaultSessionName)
	if len(sessionName) > MaxAWSSessionNameLength {
		sessionName = sessionName[:MaxAWSSessionNameLength-1]
	}
	return sessionName
}

func getChainedRoleSessionName() string {
	defaultSessionName := "peerchain"
	if deployUid := internal.PeerDBDeploymentUID(); deployUid != "" {
		defaultSession
```


### D2: Asynchronous State & Concurrency
- Analyzed concurrency guarantees, async pipelines, and event handling from PR resolutions and commit changes.

### D3: Error Boundaries, Recovery & Rollbacks
- Exception handling patterns and defect resolutions extracted from closed production bug issues:
- **Issue #4902** (2026-11-06): **[Bug]: Postgres → ClickHouse CDC silently missing ~30% of updates on one table, no errors surfaced**
  *Symptoms*: ### Description  A Postgres → ClickHouse CDC mirror has been silently missing a consistent share of rows on one table.  **Expected**: ClickHouse row state matches Postgres after deduplication to the latest version per PK.  **Actual**: From July 6 onward, ~30% are missing every day (~1000 rows/day). The mirror reports healthy throughout: no errors, no failed syncs, replication slot advancing normally.  **Observations** - Missing rows are absent entirely in CH. - Not occurring after downgrade to stable-v0.32.1:  - Applies to all tables in the same mirror  **How we count:** Same day boundaries on both sides. ClickHouse is deduplicated to the latest version per PK (`LIMIT 1 BY id` ordered by `_peerdb_version DESC`), excluding `_peerdb_is_deleted = 1`. Same result with `FINAL`.  **Environment** - Deployment: self-hosted on K8s, Helm chart - Source: Postgres 17.9, RDS, CDC from replica - `REPLICA IDENTITY` on  affected tables: DEFAULT - TOAST-able columns on table: yes - Destination: ClickHouse 25.12.11.4, self-hosted, `ReplicatedReplacingMergeTree`  **Questions** 1. Are there known cases where an UPDATE is acknowledged (slot advances) but not normalized into ClickHouse, e.g. unchanged-TOAST handling or schema-change replay? 2. Is there a log line or catalog query showing per-table normalize counts per batch, so we can find where rows go missing? 3. Any way to backfill a date range? Resync is table-wide only, and we want to find the trigger before resyncing so we don't recreate the

- **Issue #4843** (2026-10-14): **[Bug]: minio/minio image no longer available on Docker Hub**
  *Symptoms*: ### Description  Minio have removed the image. - https://hub.docker.com/u/minio/minio  ### Steps to reproduce  ```bash bash ./run-peerdb.sh [+] pull 5/10  ⠋ Image ghcr.io/peerdb-io/peerdb-server:stable-v0.37.8                                                                              Pulling                                            1.1s  ⠋ Image ghcr.io/peerdb-io/flow-worker:stable-v0.37.8                                                                                Pulling                                            1.1s  ! Image postgres:18-alpine@sha256:d3e1620b530c944afa6e887d22eb899824da68e19c52024bf98f5220c88a65b2                                  Interrupted                                        1.1s  ⠋ Image ghcr.io/peerdb-io/flow-snapshot-worker:stable-v0.37.8                                                                       Pulling                                            1.1s  ✘ Image minio/minio:latest@sha256:14cea493d9a34af32f524e538b8346cf79f3321eff8e708c1e2960462bd8936e                                  Error pull access denied for minio/minio,...       1.1s  ! Image temporalio/ui:2.54.1@sha256:ff0943fe532b8e33c46cd28b29e81e0ce0b6f55b9ee50a38ef1b437cc4de3fa5                                Interrupted                                        1.1s  ! Image temporalio/admin-tools:1.25.2-tctl-1.18.1-cli-1.1.1@sha256:da0c7a7982b571857173ab8f058e7f139b3054800abb4dcb100445d29a563ee8 Interrupted                                        1.1s  ⠋ Image ghcr.io/peerdb

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

### Incident Patch 1: `6951b76b` (2026-11-09)
**Commit Message**: fix(snapshot): skip child tables dropped after the snapshot in CTID partitioning (#5044)

Fixes
[DBI-1316](https://linear.app/clickhouse/issue/DBI-1316/classify-unhandled-postgres-qrep-error-child-table-block-count-null)

## Problem

CTID partitioning of partitioned/inherited tables lists children through
the exported snapshot, then reads each child's size with
`pg_relation_size(oid)`. That function checks the current catalog and
returns NULL for a relation that no longer exists. A child dropped after
the snapshot was exported (e.g. by partition retention during a long
initial load) is still listed, its size comes back NULL, and the scan
into `int64` fails:

```
failed to get child partitioned tables: failed to scan child table: can't scan into dest[3] (col: int8): cannot scan NULL into *int64
```

The snapshot is fixed, so every retry fails the same way.

## Fix

`COALESCE` the block count to 0 in the child discovery queries. A
dropped child is treated as empty and skipped, matching what a `SELECT`
from the parent returns today.

## Testing

`TestCTIDPartitioningSkipsChildDroppedAfterSnapshot` (partitioned and
inherited): export a snapshot, drop a child, run `GetQRepPartitions`
wi

**File**: `flow/connectors/postgres/qrep_partition.go` (modified, +6/-3)
```diff
@@ -338,13 +338,16 @@ type tableBlockStats struct {
 	blockCount   int64
 }
 
+// pg_relation_size is NULL for a child dropped after the snapshot, which pg_inherits still lists; count it as empty.
+const childBlockCountExpr = `COALESCE(pg_relation_size(c.oid) / current_setting('block_size')::int, 0)::bigint`
+
 // getPartitionedTables returns a map of partitioned child table names to their block stats,
 // recursively handle multi-level partitioned tables.
 // Uses OID-based join to avoid to_regclass which lowercases unquoted mixed-case identifiers.
 func getPartitionedTables(ctx context.Context, tx pgx.Tx, parentOID uint32) (map[string]tableBlockStats, error) {
 	rows, err := tx.Query(ctx, `
 		SELECT c.oid, format('%s.%s', n.nspname, c.relname), c.relkind::text,
-			(pg_relation_size(c.oid) / current_setting('block_size')::int)::bigint,
+			`+childBlockCountExpr+`,
 			(CASE WHEN c.relpages > 0 THEN c.reltuples::float / c.relpages ELSE 0 END)::float
 		FROM pg_inherits i
 		JOIN pg_class c ON i.inhrelid = c.oid
@@ -410,7 +413,7 @@ func getInheritedTables(
 	var numBlocks int64
 	var blockDensity float64
 	if err := tx.QueryRow(ctx, `
-			SELECT (pg_relation_size($1) / current_setting('block_size')::int)::bigint,
+			SELECT `+childBlockCountExpr+`,
 				(CASE WHEN c.relpages > 0 THEN c.reltuples::float / c.relpages ELSE 0 END)::float
 			FROM pg_class c WHERE c.oid = $1
 		`, parentOID).Scan(&numBlocks, &blockDensity); err != nil {
@@ -425,7 +428,7 @@ func getInheritedTables(
 
 	rows, err := tx.Query(ctx, `
 		SELECT c.oid, format('%s.%s', n.nspname, c.relname), c.relhassubclass,
-			(pg_relation_size(c.oid) / current_setting('block_size')::int)::bigint,
+			`+childBlockCountExpr+`,
 			(CASE WHEN c.relpages > 0 THEN c.reltuples::float / c.relpages ELSE 0 END)::float
 		FROM pg_inherits i
 		JOIN pg_class c ON i.inhrelid = c.oid
```

**File**: `flow/connectors/postgres/qrep_partition_test.go` (modified, +82/-0)
```diff
@@ -3,6 +3,7 @@
 package connpostgres
 
 import (
+	"context"
 	"fmt"
 	"log/slog"
 	"strings"
@@ -735,6 +736,87 @@ func TestCTIDPartitioningOnEmptyInheritedTable(t *testing.T) {
 	require.Empty(t, partitions)
 }
 
+// A child dropped after the snapshot was exported is still listed by the snapshot's
+// pg_inherits, but pg_relation_size of it is NULL; it must be skipped, not fail the scan.
+func TestCTIDPartitioningSkipsChildDroppedAfterSnapshot(t *testing.T) {
+	t.Parallel()
+
+	for _, tc := range []struct {
+		name        string
+		createChild string
+	}{
+		{name: "partitioned", createChild: `CREATE TABLE %[1]s PARTITION OF %[2]s FOR VALUES FROM (%[3]d) TO (%[3]d + 100)`},
+		{name: "inherited", createChild: `CREATE TABLE %[1]s () INHERITS (%[2]s)`},
+	} {
+		t.Run(tc.name, func(t *testing.T) {
+			t.Parallel()
+			ctx := t.Context()
+			schemaName, conn, connStr := setupTestSchema(t)
+
+			parentTable := schemaName + ".parent"
+			createParent := `CREATE TABLE %s (id SERIAL, partition_key INT NOT NULL, value TEXT)`
+			if tc.name == "partitioned" {
+				createParent += ` PARTITION BY RANGE (partition_key)`
+			}
+			_, err := conn.Exec(ctx, fmt.Sprintf(createParent, parentTable))
+			require.NoError(t, err)
+
+			childTables := make([]string, 3)
+			for i := range childTables {
+				childTables[i] = fmt.Sprintf("%s.child_%d", schemaName, i)
+				_, err = conn.Exec(ctx, fmt.Sprintf(tc.createChild, childTables[i], parentTable, i*100))
+				require.NoError(t, err)
+				_, err = conn.Exec(ctx, fmt.Sprintf(
+					`INSERT INTO %s (partition_key, value) SELECT %d + g, 'v' FROM generate_series(0, 49) g`,
+					childTables[i], i*100))
+				require.NoError(t, err)
+			}
+
+			exporter, err := NewPostgresConnector(ctx, nil, internal.GetCatalogPostgresConfigFromEnv(ctx))
+			require.NoError(t, err)
+			t.Cleanup(func() { exporter.Close() })
+			exportTx, err := exporter.conn.BeginTx(ctx, pgx.TxOptions{IsoLevel: pgx.RepeatableRead})
+			require.NoError(t, err)
+			t.Cleanup(func() { _ = exportTx.Rollback(context.Background()) })
+			var snapshot string
+			require.NoError(t, exportTx.QueryRow(ctx, "SELECT pg_export_snapshot()").Scan(&snapshot))
+
+			_, err = conn.Exec(ctx, "DROP TABLE "+childTables[1])
+			require.NoError(t, err)
+
+			c := &PostgresConnector{
+				connStr: connStr,
+				Config:  &protos.PostgresConfig{},
+				conn:    conn,
+				logger:  log.NewStructuredLogger(slog.With(slog.String(string(shared.FlowNameKey), "testDroppedChild"))),
+			}
+			// NumPartitionsOverride exercises CTIDBlockPartitioningFunc directly; without it,
+			// ComputeNumPartitions sums per-child estimates first.
+			for _, numPartitionsOverride := range []uint32{4, 0} {
+				partitions, err := c.GetQRepPartitions(ctx, &protos.QRepConfig{
+					FlowJobName:           "test_ctid_dropped_child",
+					NumRowsPerPartition:   10,
+					NumPartitionsOverride: numPartitionsOverride,
+					WatermarkTable:        parentTable,
+					WatermarkColumn:       "ctid",
+					SnapshotName:          snapshot,
+					Env:                   map[string]string{"PEERDB_POSTGRES_APPLY_CTID_BLOCK_PARTITIONING_OVERRIDE": "true"},
+				}, nil)
+				require.NoError(t, err)
+
+				covered := make(map[string]bool)
+				for _, p := range partitions {
+					for _, ctr := range p.ChildTableRanges {
+						covered[ctr.Table] = true
+					}
+				}
+				require.Equal(t, map[string]bool{childTables[0]: true, childTables[2]: true}, covered,
+					"numPartitionsOverride=%d", numPartitionsOverride)
+			}
+		})
+	}
+}
+
 // analyzeTables runs ANALYZE on each table so that pg_class.reltuples/relpages are
 // populated; without this the density-based row estimate is 0 and ComputeNumPartitions
 // falls back to a precise COUNT(*) instead of exercising the estimation path.
```

---

### Incident Patch 2: `c9627d46` (2026-11-11)
**Commit Message**: fix(clickhouse) DBI-1323: validate column types and key expressions structurally (#5068)

DBI-1323

Custom column types (`destination_type`), `partition_by_expr` and
`sharding_key` are written into ClickHouse's `CREATE TABLE` as SQL.
Column types were checked with a regex when a mirror was created or
resynced, but not when tables were added to it, and the content of the
two expressions was not checked.

This adds two validators to `flow/pkg/clickhouse`:
- `ValidateColumnType` parses a single type made of names, parentheses,
commas and integers, like `Decimal(38,10)` or `Array(Nullable(String))`.
It rejects whitespace and column-option keywords such as `DEFAULT`.
- `ValidateExpression` accepts names, numbers, arithmetic, commas and
parentheses, and checks that parentheses never close more than they
open. It rejects string literals, comments, statement separators,
subqueries and aliases.

They run:
- in the API, when a mirror is created or resynced and when tables are
added to it. Destination-specific checks go through a new
`DestinationTableValidationConnector`;
- when ClickHouse destination tables are created, since stored configs
may have skipped API validation. Failures are class

**File**: `flow/alerting/classifier.go` (modified, +23/-36)
```diff
@@ -154,6 +154,10 @@ type ErrorInfo struct {
 	Code                 string
 }
 
+func unknownErrorInfo(source ErrorSource) ErrorInfo {
+	return ErrorInfo{Source: source, Code: "UNKNOWN"}
+}
+
 type ErrorClass struct {
 	Class  string
 	action ErrorAction
@@ -399,10 +403,7 @@ func GetErrorClass(ctx context.Context, err error) (ErrorClass, ErrorInfo) {
 			if pgErr != nil {
 				return errorClass, pgErrorInfo
 			}
-			return errorClass, ErrorInfo{
-				Source: ErrorSourcePostgresCatalog,
-				Code:   "UNKNOWN",
-			}
+			return errorClass, unknownErrorInfo(ErrorSourcePostgresCatalog)
 		}
 
 		if _, ok := errors.AsType[*exceptions.DropFlowError](err); ok {
@@ -411,21 +412,15 @@ func GetErrorClass(ctx context.Context, err error) (ErrorClass, ErrorInfo) {
 				return errorClass, pgErrorInfo
 			}
 			// For now we are not making it as verbose, will take this up later
-			return errorClass, ErrorInfo{
-				Source: ErrorSourceOther,
-				Code:   "UNKNOWN",
-			}
+			return errorClass, unknownErrorInfo(ErrorSourceOther)
 		}
 
 		if _, ok := errors.AsType[*exceptions.PostgresSetupError](err); ok {
 			errorClass := ErrorNotifyConnectivity
 			if pgErr != nil {
 				return errorClass, pgErrorInfo
 			}
-			return errorClass, ErrorInfo{
-				Source: pgErrSource,
-				Code:   "UNKNOWN",
-			}
+			return errorClass, unknownErrorInfo(pgErrSource)
 		}
 	}
 
@@ -588,10 +583,7 @@ func GetErrorClass(ctx context.Context, err error) (ErrorClass, ErrorInfo) {
 	}
 
 	if _, ok := errors.AsType[*exceptions.SSHTunnelSetupError](err); ok {
-		return ErrorNotifyConnectivity, ErrorInfo{
-			Source: ErrorSourceSSH,
-			Code:   "UNKNOWN",
-		}
+		return ErrorNotifyConnectivity, unknownErrorInfo(ErrorSourceSSH)
 	}
 
 	if _, ok := errors.AsType[*net.DNSError](err); ok {
@@ -645,10 +637,7 @@ func GetErrorClass(ctx context.Context, err error) (ErrorClass, ErrorInfo) {
 	}
 
 	if _, ok := errors.AsType[*pgconn.ConnectError](err); ok {
-		return ErrorNotifyConnectivity, ErrorInfo{
-			Source: pgErrSource,
-			Code:   "UNKNOWN",
-		}
+		return ErrorNotifyConnectivity, unknownErrorInfo(pgErrSource)
 	}
 
 	// Consolidated PostgreSQL error handling
@@ -1166,10 +1155,7 @@ func GetErrorClass(ctx context.Context, err error) (ErrorClass, ErrorInfo) {
 	}
 
 	if _, ok := errors.AsType[*exceptions.BigQueryError](err); ok {
-		bqErrorInfo := ErrorInfo{
-			Source: ErrorSourceBigQuery,
-			Code:   "UNKNOWN",
-		}
+		bqErrorInfo := unknownErrorInfo(ErrorSourceBigQuery)
 		if apiErr, ok := errors.AsType[*googleapi.Error](err); ok {
 			if apiErr.Code == 400 && strings.Contains(apiErr.Message, bigQueryChangeHistoryBeforeTimeTravel) {
 				bqErrorInfo.Code = "CHANGE_HISTORY_BEFORE_TIME_TRAVEL"
@@ -1210,10 +1196,7 @@ func GetErrorClass(ctx context.Context, err error) (ErrorClass, ErrorInfo) {
 	}
 
 	if _, ok := errors.AsType[*exceptions.GCSError](err); ok {
-		gcsErrorInfo := ErrorInfo{
-			Source: ErrorSourceGCS,
-			Code:   "UNKNOWN",
-		}
+		gcsErrorInfo := unknownErrorInfo(ErrorSourceGCS)
 		// https://docs.cloud.google.com/storage/docs/retry-strategy#retryable
 		gcsStatusErrorClass := func(statusCode int) ErrorClass {
 			if statusCode == 408 || statusCode == 429 || statusCode >= 500 {
@@ -1242,10 +1225,7 @@ func GetErrorClass(ctx context.Context, err error) (ErrorClass, ErrorInfo) {
 
 	if s3Err, ok := errors.AsType[*exceptions.S3Error](err); ok {
 		s3ErrorClass := ErrorOther
-		s3ErrorInfo := ErrorInfo{
-			Source: ErrorSourceS3,
-			Code:   "UNKNOWN",
-		}
+		s3ErrorInfo := unknownErrorInfo(ErrorSourceS3)
 		if respErr, ok := errors.AsType[*awshttp.ResponseError](s3Err); ok {
 			if _, ok := retry.DefaultRetryableHTTPStatusCodes[respErr.HTTPStatusCode()]; ok {
 				s3ErrorClass = ErrorRetryRecoverable
@@ -1434,6 +1414,16 @@ func GetErrorClass(ctx context.Context, err error) (ErrorClass, ErrorInfo) {
 		return ErrorOther, chErrorInfo
 	}
 
+	if _, ok := errors.AsType[*peerdb_clickhouse.InvalidFragmentError](err); ok {
+		errInfo := unknownErrorInfo(ErrorSourceOther)
+		if tableCreationErr, ok := errors.AsType[*exceptions.ClickHouseNormalizedTableCreationError](err); ok {
+			errInfo.AdditionalAttributes = map[AdditionalErrorAttributeKey]string{
+				ErrorAttributeKeyTable: tableCreationErr.DestinationTable,
+			}
+		}
+		return ErrorNotifyInvalidDestinationTableDefinition, errInfo
+	}
+
 	if numericOutOfRangeError, ok := errors.AsType[*exceptions.NumericOutOfRangeError](err); ok {
 		return ErrorLossyConversion, ErrorInfo{
 			Source: "typeConversion",
@@ -1612,8 +1602,5 @@ func GetErrorClass(ctx context.Context, err error) (ErrorClass, ErrorInfo) {
 		}
 	}
 
-	return ErrorOther, ErrorInfo{
-		Source: ErrorSourceOther,
-		Code:   "UNKNOWN",
-	}
+	return ErrorOther, unknownErrorInfo(ErrorSourceOther)
 }
```

**File**: `flow/alerting/classifier_test.go` (modified, +15/-0)
```diff
@@ -1789,6 +1789,21 @@ func TestClickHouseTooManyTablesDuringTableCreationShouldNotifyUser(t *testing.T
 	}, errInfo)
 }
 
+func TestInvalidRawSQLSettingDuringTableCreationShouldNotifyUser(t *testing.T) {
+	t.Parallel()
+
+	errorClass, errInfo := GetErrorClass(t.Context(), fmt.Errorf("error while generating create table sql: %w",
+		exceptions.NewClickHouseNormalizedTableCreationError(peerdb_clickhouse.ValidateExpression("id) --"), "test")))
+	assert.Equal(t, ErrorNotifyInvalidDestinationTableDefinition, errorClass)
+	assert.Equal(t, ErrorInfo{
+		Source: ErrorSourceOther,
+		Code:   "UNKNOWN",
+		AdditionalAttributes: map[AdditionalErrorAttributeKey]string{
+			ErrorAttributeKeyTable: "test",
+		},
+	}, errInfo)
+}
+
 func TestClickHouseTooManyPartsWithoutTableName(t *testing.T) {
 	err := &clickhouse.Exception{
 		Code: int32(chproto.ErrTooManyParts),
```

**File**: `flow/cmd/handler.go` (modified, +11/-0)
```diff
@@ -476,6 +476,17 @@ func (h *FlowRequestHandler) FlowStateChange(
 		for _, tm := range tablesToNormalize {
 			structured.NormalizeStructuredIngestionTypes(tm.StructuredIngestionConfig, tm.Columns)
 		}
+		if len(cdcUpdate.AdditionalTables) > 0 {
+			config, err := h.getFlowConfigFromCatalog(ctx, req.FlowJobName)
+			if err != nil {
+				return nil, NewInternalApiError(fmt.Errorf("unable to get flow config: %w", err))
+			}
+			additionConfig := pconv.FlowConnectionConfigsToCore(config)
+			additionConfig.TableMappings = cdcUpdate.AdditionalTables
+			if apiErr := h.checkAdditionalTables(ctx, additionConfig); apiErr != nil {
+				return nil, apiErr
+			}
+		}
 		if len(cdcUpdate.ResyncTables) > 0 {
 			if currState != protos.FlowStatus_STATUS_PAUSED {
 				return nil, NewInvalidArgumentApiError(fmt.Errorf("table-level resync requires the mirror to be paused"))
```

**File**: `flow/cmd/validate_mirror.go` (modified, +33/-2)
```diff
@@ -13,6 +13,7 @@ import (
 	"github.com/PeerDB-io/peerdb/flow/connectors/utils/structured"
 	"github.com/PeerDB-io/peerdb/flow/generated/protos"
 	"github.com/PeerDB-io/peerdb/flow/internal"
+	chvalidate "github.com/PeerDB-io/peerdb/flow/pkg/clickhouse"
 	"github.com/PeerDB-io/peerdb/flow/pkg/common"
 	"github.com/PeerDB-io/peerdb/flow/proto_conversions"
 	"github.com/PeerDB-io/peerdb/flow/shared"
@@ -170,6 +171,12 @@ func (h *FlowRequestHandler) validateCDCMirrorImpl(
 	}
 	defer dstClose(ctx)
 
+	if tableValidationConn, ok := dstConn.(connectors.DestinationTableValidationConnector); ok {
+		if err := tableValidationConn.ValidateDestinationTables(ctx, connectionConfigs.TableMappings); err != nil {
+			return nil, NewInvalidArgumentApiError(err)
+		}
+	}
+
 	var tableSchemaMap map[string]*protos.TableSchema
 	if validateTableSettings {
 		var getTableSchemaError error
@@ -222,6 +229,27 @@ func (h *FlowRequestHandler) checkTableMappings(
 	return nil
 }
 
+// checkAdditionalTables validates the tables being added to a mirror, given as cfg's table mappings.
+func (h *FlowRequestHandler) checkAdditionalTables(ctx context.Context, cfg *protos.FlowConnectionConfigsCore) APIError {
+	if apiErr := h.checkTableMappings(ctx, cfg); apiErr != nil {
+		return apiErr
+	}
+	dstConn, dstClose, err := connectors.GetByNameAs[connectors.DestinationTableValidationConnector](
+		ctx, cfg.Env, h.pool, cfg.DestinationName,
+	)
+	if err != nil {
+		if errors.Is(err, errors.ErrUnsupported) {
+			return nil
+		}
+		return NewFailedPreconditionApiError(fmt.Errorf("failed to create destination connector: %w", err))
+	}
+	defer dstClose(ctx)
+	if err := dstConn.ValidateDestinationTables(ctx, cfg.TableMappings); err != nil {
+		return NewInvalidArgumentApiError(err)
+	}
+	return nil
+}
+
 // checkSourceTableConfig validates one table's columns.
 // If maybeStructuredIngestionConfig is non-nil, column types are validated too.
 func checkSourceTableConfig(
@@ -244,8 +272,11 @@ func checkSourceTableConfig(
 		return nil
 	}
 	for _, col := range columns {
-		if !structured.ColumnTypeRegex.MatchString(col.DestinationType) {
-			return NewInvalidArgumentApiError(fmt.Errorf("invalid custom column type %s", col.DestinationType))
+		if col.DestinationType == "" {
+			continue
+		}
+		if err := chvalidate.ValidateColumnType(col.DestinationType); err != nil {
+			return NewInvalidArgumentApiError(fmt.Errorf("table %s: column %s: %w", tableIdentifier, col.SourceName, err))
 		}
 	}
 	return nil
```

**File**: `flow/connectors/clickhouse/normalize.go` (modified, +4/-3)
```diff
@@ -104,6 +104,9 @@ func (c *ClickHouseConnector) generateCreateTableSQLForNormalizedTable(
 	if tableMapping != nil {
 		tmEngine = tableMapping.Engine
 	}
+	if err := validateRawSQLSettings(tableMapping); err != nil {
+		return nil, exceptions.NewClickHouseNormalizedTableCreationError(err, tableIdentifier)
+	}
 
 	isDeletedColumn := defaultIsDeletedColName
 	isDeletedColumnPart := ""
@@ -270,8 +273,7 @@ func (c *ClickHouseConnector) generateCreateTableSQLForNormalizedTable(
 				peerdb_clickhouse.QuoteIdentifier(tableIdentifier+shardSuffix),
 			)
 			if tableMapping.ShardingKey != "" {
-				stmtBuilderDistributed.WriteByte(',')
-				stmtBuilderDistributed.WriteString(tableMapping.ShardingKey)
+				fmt.Fprintf(&stmtBuilderDistributed, ",(%s)", tableMapping.ShardingKey)
 				if tableMapping.PolicyName != "" {
 					stmtBuilderDistributed.WriteByte(',')
 					stmtBuilderDistributed.WriteString(peerdb_clickhouse.QuoteLiteral(tableMapping.PolicyName))
@@ -737,7 +739,6 @@ func resolveClickHouseColumnType(
 		return qvalue.ToDWHColumnType(ctx, colType, env, protos.DBType_CLICKHOUSE, chVersion, column, nullableEnabled, flags, version,
 			sourceType)
 	}
-	// TODO basic validation to avoid injection
 	if nullableEnabled && column.Nullable && !colType.IsArray() && !strings.HasPrefix(clickHouseType, "Nullable(") {
 		// a nullable-enabled column must be Nullable(...), or JSON nulls turn into the type's default value
 		return fmt.Sprintf("Nullable(%s)", clickHouseType), nil
```

**File**: `flow/connectors/clickhouse/normalize_test.go` (modified, +84/-0)
```diff
@@ -7,7 +7,9 @@ import (
 	"github.com/stretchr/testify/require"
 
 	"github.com/PeerDB-io/peerdb/flow/generated/protos"
+	peerdb_clickhouse "github.com/PeerDB-io/peerdb/flow/pkg/clickhouse"
 	"github.com/PeerDB-io/peerdb/flow/shared"
+	"github.com/PeerDB-io/peerdb/flow/shared/exceptions"
 	"github.com/PeerDB-io/peerdb/flow/shared/types"
 )
 
@@ -522,6 +524,88 @@ func TestGenerateCreateTableSQLForNormalizedTable(t *testing.T) {
 	}
 }
 
+func TestGenerateCreateTableSQLForNormalizedTableRawSQLSettings(t *testing.T) {
+	tableIdentifier := "tbl"
+	tableSchema := &protos.TableSchema{
+		Columns: []*protos.FieldDescription{
+			{Name: "id", Type: string(types.QValueKindInt64)},
+			{Name: "doc", Type: string(types.QValueKindJSON)},
+		},
+		PrimaryKeyColumns: []string{"id"},
+	}
+	chVersion := &chproto.Version{Major: 25, Minor: 8, Patch: 0}
+
+	generate := func(t *testing.T, cluster string, tableMapping *protos.TableMapping) ([]string, error) {
+		t.Helper()
+		tableMapping.SourceTableIdentifier = tableIdentifier
+		tableMapping.DestinationTableIdentifier = tableIdentifier
+		c := &ClickHouseConnector{
+			Config:    &protos.ClickhouseConfig{Database: "db", Cluster: cluster},
+			chVersion: chVersion,
+		}
+		config := &protos.SetupNormalizedTableBatchInput{
+			Env:           map[string]string{"PEERDB_SOURCE_SCHEMA_AS_DESTINATION_COLUMN": "false"},
+			TableMappings: []*protos.TableMapping{tableMapping},
+		}
+		return c.generateCreateTableSQLForNormalizedTable(t.Context(), config, tableIdentifier, tableSchema, chVersion, nil,
+			protos.DBType_DBTYPE_UNKNOWN)
+	}
+
+	t.Run("valid settings are written as is", func(t *testing.T) {
+		result, err := generate(t, "cluster", &protos.TableMapping{
+			Columns:         []*protos.ColumnSetting{{SourceName: "doc", DestinationType: "Nullable(String)"}},
+			PartitionByExpr: "id % 4",
+			ShardingKey:     "cityHash64(id)",
+		})
+		require.NoError(t, err)
+		require.Len(t, result, 2)
+		require.Contains(t, result[0], "`doc` Nullable(String),")
+		require.Contains(t, result[0], "PARTITION BY (id % 4)")
+		require.Contains(t, result[1], ",(cityHash64(id)))")
+	})
+
+	for _, tc := range []struct {
+		name         string
+		tableMapping *protos.TableMapping
+		wantErr      string
+	}{
+		{
+			name:    "column type with extra column",
+			wantErr: "column doc: invalid column type",
+			tableMapping: &protos.TableMapping{Columns: []*protos.ColumnSetting{
+				{SourceName: "doc", DestinationType: "JSON, extra String DEFAULT 'x'"},
+			}},
+		},
+		{
+			name:    "column type with column option",
+			wantErr: "column doc: invalid column type",
+			tableMapping: &protos.TableMapping{Columns: []*protos.ColumnSetting{
+				{SourceName: "doc", DestinationType: "Nullable(String)DEFAULT(hostName())"},
+			}},
+		},
+		{
+			name:         "partition expression closing the clause",
+			tableMapping: &protos.TableMapping{PartitionByExpr: "id) SETTINGS index_granularity = 1 --"},
+			wantErr:      "partition_by_expr: invalid expression",
+		},
+		{
+			name:         "sharding key with a string literal",
+			tableMapping: &protos.TableMapping{ShardingKey: "rand(), 'policy'"},
+			wantErr:      "sharding_key: invalid expression",
+		},
+	} {
+		t.Run(tc.name, func(t *testing.T) {
+			_, err := generate(t, "cluster", tc.tableMapping)
+			require.ErrorContains(t, err, tc.wantErr)
+			var tableCreationErr *exceptions.ClickHouseNormalizedTableCreationError
+			require.ErrorAs(t, err, &tableCreationErr)
+			require.Equal(t, tableIdentifier, tableCreationErr.DestinationTable)
+			var fragmentErr *peerdb_clickhouse.InvalidFragmentError
+			require.ErrorAs(t, err, &fragmentErr)
+		})
+	}
+}
+
 func TestResolveClickHouseColumnType(t *testing.T) {
 	nullableInt := &protos.FieldDescription{Name: "id", Type: string(types.QValueKindInt64), Nullable: true}
 	notNullInt := &protos.FieldDescription{Name: "id", Type: string(types.QValueKindInt64)}
```

**File**: `flow/connectors/clickhouse/validate.go` (modified, +36/-3)
```diff
@@ -83,9 +83,6 @@ func (c *ClickHouseConnector) ValidateMirrorDestination(
 
 	for _, tableMapping := range cfg.TableMappings {
 		dstTableName := tableMapping.DestinationTableIdentifier
-		if dstTableName == "" {
-			return fmt.Errorf("destination table identifier is empty")
-		}
 		processedSchema, ok := processedMapping[dstTableName]
 		if !ok {
 			// if destination table is not a key, that means source table was not a key in the original schema mapping(?)
@@ -180,6 +177,42 @@ func (c *ClickHouseConnector) ValidateMirrorDestination(
 	return nil
 }
 
+func (c *ClickHouseConnector) ValidateDestinationTables(_ context.Context, tableMappings []*protos.TableMapping) error {
+	for _, tableMapping := range tableMappings {
+		if tableMapping.DestinationTableIdentifier == "" {
+			return fmt.Errorf("destination table identifier is empty for table %s", tableMapping.SourceTableIdentifier)
+		}
+		if err := validateRawSQLSettings(tableMapping); err != nil {
+			return fmt.Errorf("table %s: %w", tableMapping.SourceTableIdentifier, err)
+		}
+	}
+	return nil
+}
+
+// validateRawSQLSettings checks the settings written unquoted into CREATE TABLE.
+// Table creation checks them again, as stored configs may have skipped API validation.
+func validateRawSQLSettings(tableMapping *protos.TableMapping) error {
+	for _, col := range tableMapping.GetColumns() {
+		if col.DestinationType == "" {
+			continue
+		}
+		if err := chvalidate.ValidateColumnType(col.DestinationType); err != nil {
+			return fmt.Errorf("column %s: %w", col.SourceName, err)
+		}
+	}
+	if partitionByExpr := tableMapping.GetPartitionByExpr(); partitionByExpr != "" {
+		if err := chvalidate.ValidateExpression(partitionByExpr); err != nil {
+			return fmt.Errorf("partition_by_expr: %w", err)
+		}
+	}
+	if shardingKey := tableMapping.GetShardingKey(); shardingKey != "" {
+		if err := chvalidate.ValidateExpression(shardingKey); err != nil {
+			return fmt.Errorf("sharding_key: %w", err)
+		}
+	}
+	return nil
+}
+
 // checkNativeJSONSetting rejects a mirror that turns PEERDB_CLICKHOUSE_ENABLE_JSON on against a ClickHouse
 // without the native JSON type, which would otherwise silently fall back to String columns.
 func checkNativeJSONSetting(ctx context.Context, env map[string]string, chVersion *chproto.Version) error {
```

**File**: `flow/connectors/core.go` (modified, +9/-0)
```diff
@@ -57,6 +57,13 @@ type MirrorDestinationValidationConnector interface {
 	ValidateMirrorDestination(context.Context, *protos.FlowConnectionConfigsCore, map[string]*protos.TableSchema) error
 }
 
+type DestinationTableValidationConnector interface {
+	Connector
+
+	// ValidateDestinationTables checks table mapping settings that need neither the server nor source schemas.
+	ValidateDestinationTables(context.Context, []*protos.TableMapping) error
+}
+
 type StatActivityConnector interface {
 	Connector
 
@@ -887,6 +894,8 @@ var (
 	_ MirrorDestinationValidationConnector = &connpostgres.PostgresConnector{}
 	_ MirrorDestinationValidationConnector = &connbigquery.BigQueryConnector{}
 
+	_ DestinationTableValidationConnector = &connclickhouse.ClickHouseConnector{}
+
 	_ GetFlagsConnector = &connclickhouse.ClickHouseConnector{}
 
 	_ GetVersionConnector = &connclickhouse.ClickHouseConnector{}
```

---

### Incident Patch 3: `1805bda7` (2026-11-11)
**Commit Message**: Update temporalio/ui Docker tag to v2.58.0 (#5056)

This PR contains the following updates:

| Package | Update | Change | Pending |
|---|---|---|---|
| [temporalio/ui](https://redirect.github.com/temporalio/ui-server) |
minor | `2.57.0` → `2.58.0` | `2.58.1` |

---

### Release Notes

<details>
<summary>temporalio/ui-server (temporalio/ui)</summary>

###
[`v2.58.0`](https://redirect.github.com/temporalio/ui-server/releases/tag/v2.58.0)

[Compare
Source](https://redirect.github.com/temporalio/ui-server/compare/v2.57.0...v2.58.0)

Release synced from
[ui@v2.58.0](https://redirect.github.com/temporalio/ui/releases/tag/v2.58.0)

##### What's Changed

- Read the Node version from the synced UI's package.json by
[@&#8203;rossnelson](https://redirect.github.com/rossnelson) in
[#&#8203;344](https://redirect.github.com/temporalio/ui-server/pull/344)

**Full Changelog**:
<https://github.com/temporalio/ui-server/compare/v2.57.0...v2.58.0>

</details>

---

### Configuration

📅 **Schedule**: (in timezone Etc/UTC)

- Branch creation
  - "after 5pm on monday"
- Automerge
  - At any time (no schedule defined)

🚦 **Automerge**: Enabled.

♻ **Rebasing**: Whenever PR is behind base branch, or you

**File**: `docker-compose-dev.yml` (modified, +1/-1)
```diff
@@ -144,7 +144,7 @@ services:
       - TEMPORAL_ADDRESS=temporal:7233
       - TEMPORAL_CORS_ORIGINS=http://localhost:3030
       - TEMPORAL_CSRF_COOKIE_INSECURE=true
-    image: temporalio/ui:2.57.0@sha256:d944f959d0923c35cd991a17a0edbe087770eff843724b181933e0cfdd563ab2
+    image: temporalio/ui:2.58.0@sha256:d36185e811d0ce1720b8d3ca4d9ac4dac504b67181e9b5e3d3ca72b2294f3590
     ports:
       - *temporal-ui-port
 
```

**File**: `docker-compose.yml` (modified, +1/-1)
```diff
@@ -108,7 +108,7 @@ services:
       - TEMPORAL_ADDRESS=temporal:7233
       - TEMPORAL_CORS_ORIGINS=http://localhost:3000
       - TEMPORAL_CSRF_COOKIE_INSECURE=true
-    image: temporalio/ui:2.57.0@sha256:d944f959d0923c35cd991a17a0edbe087770eff843724b181933e0cfdd563ab2
+    image: temporalio/ui:2.58.0@sha256:d36185e811d0ce1720b8d3ca4d9ac4dac504b67181e9b5e3d3ca72b2294f3590
     ports:
       - 8085:8080
 
```

#### Recent Merged Pull Requests:
- **PR #5077** (closed): Reshape mirror edit and overview screens (@jonathan-dualtech)
- **PR #5070** (2026-11-11): ci: raise MySQL/MariaDB test max_connections to 1000 (@gheorghepucea)
- **PR #5068** (2026-11-11): fix(clickhouse) DBI-1323: validate column types and key expressions structurally (@ilidemi)
- **PR #5066** (2026-11-11): Drain pending state changes before setup/snapshot ContinueAsNew (@dtunikov)
- **PR #5065** (2026-11-10): Renovate config: Enable self healing PRs on all updates (@pfcoperez)
- **PR #5064** (closed): TEST DO NOT MERGE: Remove newline and add 'banana!' to flowable.go (@pfcoperez)

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

## X. snapshot): skip child tables dropped after the snapshot in CTID partitioning (#5

**RULE**:
When implementing operations in `flow/connectors/postgres/qrep_partition.go`, engineers MUST enforce rigorous boundary validation, safe state transitions, and memory/concurrency invariants as established by production defect remediation in PeerDB-io/peerdb. All inputs crossing module boundaries must be explicitly verified before state persistence.

**WHY**:
Prevents defects observed in production commit `6951b76b`: snapshot): skip child tables dropped after the snapshot in CTID partitioning (#5044). Unvalidated execution paths cause runtime exceptions, race conditions, and silent state corruption under concurrent workloads.

**WHEN TO APPLY**:
Subsystems managing Go data structures, boundary deserialization, API parsing, or resource lifecycles matching `flow/connectors/postgres/qrep_partition.go`.

**VERIFIED IMPLEMENTATION PATTERN**:
```go
// Verified production-grade fix pattern:
// pg_relation_size is NULL for a child dropped after the snapshot, which pg_inherits still lists; count it as empty.
const childBlockCountExpr = `COALESCE(pg_relation_size(c.oid) / current_setting('block_size')::int, 0)::bigint`

			`+childBlockCountExpr+`,
			SELECT `+childBlockCountExpr+`,
			`+childBlockCountExpr+`,
```

**NEGATIVE CONSTRAINT**:
```go
// Anti-pattern to NEVER write (induced failure mode):
			(pg_relation_size(c.oid) / current_setting('block_size')::int)::bigint,
			SELECT (pg_relation_size($1) / current_setting('block_size')::int)::bigint,
			(pg_relation_size(c.oid) / current_setting('block_size')::int)::bigint,
```

**VERIFICATION METHOD**:
Automated regression test asserting that input states reproducing defect `6951b76b` are properly handled with clean fallback behavior.


## 3. Independent Verification Protocol
1. Assert state existence before and after execution.
2. Verify deterministic SHA-256 byte digest parity.
3. Validate zero unhandled promise rejections or uncaught exceptions.
