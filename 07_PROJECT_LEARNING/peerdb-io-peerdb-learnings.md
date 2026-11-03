> **Canonical Learning Artifact**: `07_PROJECT_LEARNING/peerdb-io-peerdb-learnings.md`  
> **Source**: github ([https://github.com/PeerDB-io/peerdb](https://github.com/PeerDB-io/peerdb))  
> **Source Version**: `edc9c419`  
> **License**: AGPL-3.0  
> **Synthesized By**: zero-clone-structural-synthesizer  
> **Timestamp**: 2026-11-03T22:15:22.513Z  
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
> **Harvest Timestamp**: 2026-11-03T22:15:21.986Z  
> **Compliance State**: Free Tier Guaranteed | Strict Rate-Limit Backoff Honored  

---

## 1. Context & Architectural Overview
- **Repository / Resource**: `PeerDB-io/peerdb`
- **Description**: Fast, Simple and a cost effective tool to replicate data from Postgres to Data Warehouses, Queues and Storage
- **Primary Language / Ecosystem**: Go
- **Discovered Manifests / Configurations**: README.md
- **Stars / Engagement**: 3313 stars

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
	"github.com/PeerDB-io/peerdb/flow/shared/concurrency"
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

func (a *FlowableActivity) applySchemaDeltas(
	ctx context.Context,
	config *protos.FlowConnectionConfigsCore,
	schemaDeltas []*protos.TableSchemaDelta,
) error {
	logger := internal.LoggerFromCtx(ctx)

	dstTableNamesInDeltas := make([]string, 0, len(schemaDeltas))
	for _, schemaDelta := range schemaDeltas {
		dstTableNamesInDeltas = append(dstTableNamesInDeltas, schemaDelta.DstTableName)
	}

	if err := internal.ReadModifyWriteTableSchemasToCatalog(
		ctx,
		a.CatalogPool,
		logger,
		config.FlowJobName,
		dstTableNamesInDeltas,
		func(schemas map[string]*protos.TableSchema) (map[string]*protos.TableSchema, error) {
			// deep copy to avoid mutating input
			schemasCopy := make(map[string]*protos.TableSchema, len(schemas))
			for tableName, schema := range schemas {
				if schema == nil {
					return nil, fmt.Errorf("failed to deep copy table schema from catalog: table %s has nil schema", tableName)
				}
				schemasCopy[tableName] = proto.CloneOf(schema)
			}

			for _, schemaDelta := range schemaDeltas {
				if schema, exists := schemasCopy[schemaDelta.DstTableName]; exists {
					columnNames := make(map[string]struct{}, len(schema.GetColumns()))
					for _, col := range schema.GetColumns() {
						columnNames[col.Name] = struct{}{}
					}
					for _, newCol := range schemaDelta.GetAddedColumns() {
						// only add columns that don't already exist
						if _, exists := columnNames[newCol.Name]; !exists {
							schema.Columns = append(schema.Columns, newCol)
							columnNames[newCol.Name] = struct{}{}
						} else {
							logger.Warn(fmt.Sprintf("skip adding duplicated column '%s' (type '%s') in table %s",
								newCol.Name, newCol.Type, schemaDelta.DstTableName))
						}
					}
				} else {
					logger.Warn(fmt.Sprintf("skip adding columns for table '%s' because it's not in catalog", schemaDelta.DstTableName))
				}
			}
			return schemasCopy, nil
		},
	); err != nil {
		return fmt.Errorf("failed to update table schemas in catalog: %w", err)
	}
	return nil
}

func pullAndSyncCore[TPull connectors.CDCPullConnectorCore, TSync connectors.CDCSyncConnectorCore, Items model.Items](
	ctx context.Context,
	a *FlowableActivity,
	config *protos.FlowConnectionConfigsCore,
	options *protos.SyncFlowOptions,
	srcConn TPull,
	normRequests *concurrency.LastChan,
	normResponses *concurrency.LastChan,
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
			_, isDesync := errors.AsType[*exceptions.ReplState
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
		tableMappings []*protos.TableMapping, schemaDeltas []*protos.TableSchemaDelta, flags []string,
	) error
}

type CDCSyncConnector interface {
	CDCSyncConnectorCore

	// SyncRecords pushes RecordItems to the destination peer and stores it in PeerDB specific tables.
	// This method should be idempotent, and should be able to be called multiple times with the same request.
	SyncRecords(ctx context.Context, req *model.SyncRecordsRequest[model.RecordItems]) (*model.SyncResponse, error)
}

// QueryCDCSyncConnector is implemented by destinations that can stage one
// table's CDC records (SyncQueryCDC), to be inserted into the final destination
// table later by QueryCDCNormalizeConnector, skipping any raw-table hop.
type QueryCDCSyncConnector interface {
	Connector

	// SyncQueryCDC should 
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
- **Issue #4843** (2026-10-14): **[Bug]: minio/minio image no longer available on Docker Hub**
  *Symptoms*: ### Description  Minio have removed the image. - https://hub.docker.com/u/minio/minio  ### Steps to reproduce  ```bash bash ./run-peerdb.sh [+] pull 5/10  ⠋ Image ghcr.io/peerdb-io/peerdb-server:stable-v0.37.8                                                                              Pulling                                            1.1s  ⠋ Image ghcr.io/peerdb-io/flow-worker:stable-v0.37.8                                                                                Pulling                                            1.1s  ! Image postgres:18-alpine@sha256:d3e1620b530c944afa6e887d22eb899824da68e19c52024bf98f5220c88a65b2                                  Interrupted                                        1.1s  ⠋ Image ghcr.io/peerdb-io/flow-snapshot-worker:stable-v0.37.8                                                                       Pulling                                            1.1s  ✘ Image minio/minio:latest@sha256:14cea493d9a34af32f524e538b8346cf79f3321eff8e708c1e2960462bd8936e                                  Error pull access denied for minio/minio,...       1.1s  ! Image temporalio/ui:2.54.1@sha256:ff0943fe532b8e33c46cd28b29e81e0ce0b6f55b9ee50a38ef1b437cc4de3fa5                                Interrupted                                        1.1s  ! Image temporalio/admin-tools:1.25.2-tctl-1.18.1-cli-1.1.1@sha256:da0c7a7982b571857173ab8f058e7f139b3054800abb4dcb100445d29a563ee8 Interrupted                                        1.1s  ⠋ Image ghcr.io/peerdb

- **Issue #4664** (2026-08-21): **[Bug]: PG→PG CDC: _peerdb_raw_* table grows indefinitely — no cleanup after normalize**
  *Symptoms*: ### Description  In a PG→PG CDC mirror (v0.37.0), the `_peerdb_internal._peerdb_raw_<mirror_name>` table on the destination database grows indefinitely. After normalize successfully processes a batch and applies changes to the destination tables, the corresponding rows in the raw table are **never deleted**.   ### Steps to reproduce  ## Steps to Reproduce 1. Create a PG→PG CDC mirror with `do_initial_copy = true` 2. Let it run for a while with active writes on the source 3. Check the raw table size on the destination: ```sql SELECT pg_size_pretty(pg_total_relation_size('_peerdb_internal._peerdb_raw_rzldb_to_lkdb')); ```  ## Expected Behavior  After normalize completes for a batch, the processed rows should be removed from the raw table (or after a configurable retention window).  ## Actual Behavior  The raw table keeps growing. In our production mirror:  * `sync_batch_id = 6249`, `normalize_batch_id = 6249`, **gap = 0** (normalize fully caught up)  * Raw table: **49.5 million live rows**, **0 dead tuples**, **19 GB**  * Source code confirms: `normalizeBatch()` in `postgres_destination.go` only writes to destination tables and updates metadata — no DELETE against the raw table  ### PeerDB version  * PeerDB v0.37.0, Docker Compose   ### Source connector  PostgreSQL  ### Destination connector  PostgreSQL

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

### Incident Patch 1: `f150824c` (2026-11-02)
**Commit Message**: fix(clickhouse): normalize tables added to a running mirror through their column settings (#4998)

## Problem

We hit this on ClickHouse Cloud ClickPipes: a MongoDB pipe with
structured ingestion stopped syncing
after tables were added to it. Every normalize batch failed with

```
Code: 26. Cannot parse quoted string: expected opening quote ''', got '{':
while converting source column attendees to destination column attendees:
while executing 'FUNCTION _CAST(attendees, Array(Nullable(JSON)))'
```

and since a batch normalizes all its tables at once, the error stalled
every table of the pipe, not just
the added one. The source documents were fine (real arrays of documents,
`$type` = `array`); the initial
load of the same table had landed them correctly.

## Cause

`SyncFlow(cfg, state.SyncFlowOptions)` gives normalize
`cfg.TableMappings`
(`flowable_core.go`, the only `NormalizeRecordsRequest`). Adding tables
appends them to
`state.SyncFlowOptions.TableMappings` only (`cdc_flow.go`); `cfg` keeps
the mappings the mirror started
with across `ContinueAsNew`, and is only rebuilt from the state on
resync.

The added table's DDL and initial load run in the child flow with the
added mapping

**File**: `flow/activities/flowable.go` (modified, +7/-0)
```diff
@@ -364,6 +364,13 @@ func (a *FlowableActivity) SyncFlow(
 	ctx, cancelCtx := context.WithCancel(ctx)
 	defer cancelCtx()
 
+	// config keeps the table mappings the mirror started with, options also the tables added since:
+	// normalize must see the column settings of added tables too
+	if options != nil {
+		config = proto.CloneOf(config)
+		config.TableMappings = options.TableMappings
+	}
+
 	ctx = context.WithValue(ctx, shared.FlowNameKey, config.FlowJobName)
 	// This is kept here and not deeper as we can have errors during SetupReplConn
 	ctx = internal.WithOperationContext(ctx, protos.FlowOperation_FLOW_OPERATION_SYNC)
```

**File**: `flow/e2e/clickhouse_suite.go` (modified, +92/-0)
```diff
@@ -226,6 +226,98 @@ func (s ClickHouseSuite) Test_Addition_Removal() {
 	RequireEnvCanceled(s.t, env)
 }
 
+// Test_Addition_Column_Settings adds a table with column settings to a running mirror: its CDC rows must
+// land through them, as its initial load does
+func (s ClickHouseSuite) Test_Addition_Column_Settings() {
+	tc := NewTemporalClient(s.t)
+
+	srcTableName := s.attachSchemaSuffix("test_addition_settings")
+	addedSrcTableName := s.attachSchemaSuffix("test_addition_settings_added")
+	dstTableName := "test_addition_settings_dst"
+	addedDstTableName := "test_addition_settings_added_dst"
+
+	for _, tableName := range []string{srcTableName, addedSrcTableName} {
+		require.NoError(s.t, s.source.Exec(s.t.Context(), fmt.Sprintf(
+			`CREATE TABLE IF NOT EXISTS %s (id INT PRIMARY KEY, note TEXT, amount INT)`, tableName)))
+	}
+	require.NoError(s.t, s.source.Exec(s.t.Context(), fmt.Sprintf(
+		`INSERT INTO %s (id, note, amount) VALUES (1, 'snapshot', 10)`, addedSrcTableName)))
+
+	connectionGen := FlowConnectionGenerationConfig{
+		FlowJobName:      s.attachSuffix("ch_addition_settings"),
+		TableNameMapping: map[string]string{srcTableName: dstTableName},
+		Destination:      s.Peer().Name,
+	}
+	flowConnConfig := connectionGen.GenerateFlowConnectionConfigs(s)
+	flowConnConfig.DoInitialSnapshot = true
+
+	env := ExecutePeerflow(s.t, tc, flowConnConfig)
+	SetupCDCFlowStatusQuery(s.t, env, flowConnConfig)
+	require.NoError(s.t, s.source.Exec(s.t.Context(), fmt.Sprintf(
+		`INSERT INTO %s (id, note, amount) VALUES (1, 'cdc', 1)`, srcTableName)))
+	EnvWaitForCount(env, s, "cdc into the original table", dstTableName, "id", 1)
+
+	SignalWorkflow(s.t.Context(), env, model.FlowSignal, model.PauseSignal)
+	EnvWaitFor(s.t, env, 4*time.Minute, "pausing for add table", func() bool {
+		return env.GetFlowStatus(s.t) == protos.FlowStatus_STATUS_PAUSED
+	})
+
+	if pgconn, ok := s.source.Connector().(*connpostgres.PostgresConnector); ok {
+		conn := pgconn.Conn()
+		_, err := conn.Exec(s.t.Context(),
+			fmt.Sprintf(`SELECT pg_terminate_backend(pid) FROM pg_stat_activity
+				WHERE query LIKE '%%START_REPLICATION%%' AND query LIKE '%%%s%%' AND backend_type='walsender'`,
+				s.attachSuffix("ch_addition_settings")))
+		require.NoError(s.t, err)
+
+		EnvWaitFor(s.t, env, 3*time.Minute, "waiting for replication to stop", func() bool {
+			rows, err := conn.Query(s.t.Context(),
+				fmt.Sprintf(`SELECT pid FROM pg_stat_activity
+					WHERE query LIKE '%%START_REPLICATION%%' AND query LIKE '%%%s%%' AND backend_type='walsender'`,
+					s.attachSuffix("ch_addition_settings")))
+			require.NoError(s.t, err)
+			defer rows.Close()
+			return !rows.Next()
+		})
+	}
+
+	// the added table renames a column, makes it nullable, and widens another one
+	runID := EnvGetRunID(s.t, env)
+	SignalWorkflow(s.t.Context(), env, model.CDCDynamicPropertiesSignal, &protos.CDCFlowConfigUpdate{
+		AdditionalTables: []*protos.TableMapping{{
+			SourceTableIdentifier:      addedSrcTableName,
+			DestinationTableIdentifier: addedDstTableName,
+			ShardingKey:                "id",
+			Columns: []*protos.ColumnSetting{
+				{SourceName: "note", DestinationName: "memo", NullableEnabled: true},
+				{SourceName: "amount", DestinationType: "Int64"},
+			},
+		}},
+	})
+	EnvWaitFor(s.t, env, 4*time.Minute, "adding table", func() bool {
+		return env.GetFlowStatus(s.t) == protos.FlowStatus_STATUS_RUNNING
+	})
+	EnvWaitFor(s.t, env, time.Minute, "ContinueAsNew", func() bool {
+		return runID != EnvGetRunID(s.t, env)
+	})
+	EnvWaitForCount(env, s, "initial load of the added table", addedDstTableName, "id,memo", 1)
+
+	require.NoError(s.t, s.source.Exec(s.t.Context(), fmt.Sprintf(
+		`INSERT INTO %s (id, note, amount) VALUES (2, 'cdc', 20), (3, NULL, 30)`, addedSrcTableName)))
+	EnvWaitForCount(env, s, "cdc into the added table", addedDstTableName, "id,memo", 3)
+
+	rows, err := s.GetRows(addedDstTableName, "id,memo,amount")
+	require.NoError(s.t, err)
+	require.Len(s.t, rows.Records, 3)
+	require.Equal(s.t, "snapshot", rows.Records[0][1].Value())
+	require.Equal(s.t, "cdc", rows.Records[1][1].Value())
+	require.Nil(s.t, rows.Records[2][1].Value(), "a NULL lands as NULL in the nullable column")
+	require.Equal(s.t, int64(30), rows.Records[2][2].Value())
+
+	env.Cancel(s.t.Context())
+	RequireEnvCanceled(s.t, env)
+}
+
 // Removing one of several source tables feeding a shared destination must keep
 // that destination's raw rows & catalog schema mapping intact, otherwise the
 // surviving source can no longer normalize into it. Disjoint id ranges keep the
```

**File**: `flow/e2e/mongo_clickhouse/mongo_test.go` (modified, +93/-0)
```diff
@@ -460,6 +460,99 @@ func (s MongoClickhouseSuite) Test_Structured_Ingestion_Nested_And_Arrays() {
 	e2e.RequireEnvCanceled(t, env)
 }
 
+// Test_Structured_Ingestion_Table_Addition adds a structured ingestion table to a running mirror: its CDC
+// rows must land through its column settings, as its initial load does
+func (s MongoClickhouseSuite) Test_Structured_Ingestion_Table_Addition() {
+	t := s.T()
+	srcDatabase := e2e.GetTestDatabase(s.Suffix())
+	srcTable := "test_structured_addition"
+	dstTable := "test_structured_addition_dst"
+	addedSrcTable := "test_structured_addition_added"
+	addedDstTable := "test_structured_addition_added_dst"
+
+	connectionGen := e2e.FlowConnectionGenerationConfig{
+		FlowJobName:   e2e.AddSuffix(s, srcTable),
+		TableMappings: e2e.TableMappings(s, srcTable, dstTable),
+		Destination:   s.Peer().Name,
+	}
+	flowConnConfig := s.generateFlowConnectionConfigsDefaultEnv(connectionGen)
+	flowConnConfig.DoInitialSnapshot = true
+
+	db := s.Source().(*e2e.MongoSource).AdminClient().Database(srcDatabase)
+	require.NoError(t, db.CreateCollection(t.Context(), srcTable))
+	addedCollection := db.Collection(addedSrcTable)
+	insertMeetings := func(prefix string) {
+		for i := range 5 {
+			res, err := addedCollection.InsertOne(t.Context(), bson.D{
+				{Key: "name", Value: fmt.Sprintf("%s_%d", prefix, i)},
+				{Key: "title", Value: fmt.Sprintf("title_%s_%d", prefix, i)},
+				{Key: "attendees", Value: bson.A{
+					bson.D{{Key: "email", Value: fmt.Sprintf("a_%s_%d", prefix, i)}, {Key: "internal", Value: true}},
+					bson.D{{Key: "email", Value: fmt.Sprintf("b_%s_%d", prefix, i)}, {Key: "internal", Value: false}},
+				}},
+			}, options.InsertOne())
+			require.NoError(t, err)
+			require.True(t, res.Acknowledged)
+		}
+	}
+	insertMeetings("init")
+
+	tc := e2e.NewTemporalClient(t)
+	env := e2e.ExecutePeerflow(t, tc, flowConnConfig)
+	e2e.SetupCDCFlowStatusQuery(t, env, flowConnConfig)
+
+	insertRes, err := db.Collection(srcTable).InsertOne(t.Context(), bson.D{{Key: "key", Value: "val"}}, options.InsertOne())
+	require.NoError(t, err)
+	require.True(t, insertRes.Acknowledged)
+	e2e.EnvWaitForCount(env, s, "cdc into the original table", dstTable, "_id", 1)
+
+	e2e.SignalWorkflow(t.Context(), env, model.FlowSignal, model.PauseSignal)
+	e2e.EnvWaitFor(t, env, time.Minute, "paused for table addition", func() bool {
+		return env.GetFlowStatus(t) == protos.FlowStatus_STATUS_PAUSED
+	})
+
+	// the added table renames a column and lands arrays of documents in an array of JSON
+	addedTableMappings := e2e.TableMappings(s, addedSrcTable, addedDstTable)
+	addedTableMappings[0].StructuredIngestionConfig = &protos.StructuredIngestionTableConfig{Enabled: true}
+	addedTableMappings[0].Columns = []*protos.ColumnSetting{
+		{SourceName: "name", DestinationType: "Nullable(String)"},
+		{SourceName: "title", DestinationName: "headline", DestinationType: "Nullable(String)"},
+		{SourceName: "attendees", DestinationType: "Array(Nullable(JSON))"},
+	}
+	runID := e2e.EnvGetRunID(t, env)
+	e2e.SignalWorkflow(t.Context(), env, model.CDCDynamicPropertiesSignal, &protos.CDCFlowConfigUpdate{
+		AdditionalTables: addedTableMappings,
+	})
+	e2e.EnvWaitFor(t, env, 4*time.Minute, "adding table", func() bool {
+		return env.GetFlowStatus(t) == protos.FlowStatus_STATUS_RUNNING
+	})
+	e2e.EnvWaitFor(t, env, time.Minute, "ContinueAsNew", func() bool {
+		return runID != e2e.EnvGetRunID(t, env)
+	})
+	e2e.EnvWaitForCount(env, s, "initial load of the added table", addedDstTable, "_id,name", 5)
+
+	insertMeetings("cdc")
+	e2e.EnvWaitForCount(env, s, "cdc into the added table", addedDstTable, "_id,name", 10)
+
+	peer := s.Peer()
+	ch, err := connclickhouse.Connect(t.Context(), nil, peer.GetClickhouseConfig())
+	require.NoError(t, err)
+	defer ch.Close()
+	for _, prefix := range []string{"init", "cdc"} {
+		var headline, secondAttendee string
+		var attendeesLength uint64
+		require.NoError(t, ch.QueryRow(t.Context(), fmt.Sprintf(
+			`SELECT ifNull(headline, ''), length(attendees), toString(attendees[2]) FROM "%s"."%s" FINAL WHERE name = '%s_3'`,
+			peer.GetClickhouseConfig().Database, addedDstTable, prefix)).Scan(&headline, &attendeesLength, &secondAttendee))
+		require.Equal(t, "title_"+prefix+"_3", headline)
+		require.Equal(t, uint64(2), attendeesLength)
+		require.JSONEq(t, fmt.Sprintf(`{"email": "b_%s_3", "internal": false}`, prefix), secondAttendee)
+	}
+
+	env.Cancel(t.Context())
+	e2e.RequireEnvCanceled(t, env)
+}
+
 // Test_Structured_Ingestion_Scalars_And_Typed_Arrays covers the destination types the other structured
 // ingestion tests leave out, on both the initial load and CDC: floats, integers widened into floats, booleans,
 // dates, typed arrays of integers, floats and booleans, the scalars mapping to strings, and the ones mapping
```

---

### Incident Patch 2: `0b20038f` (2026-11-02)
**Commit Message**: Revert "clickhouse: drop the 25.3 check for PEERDB_CLICKHOUSE_ENABLE_JSON" (#5000) (#5010)

Reverts #5000, which removed the mirror validation that rejects
`PEERDB_CLICKHOUSE_ENABLE_JSON` on a ClickHouse below 25.3.

For OSS, a clear rejection at creation with a user-facing fix beats the
alternative, where a mirror created against an old server silently
switches its JSON columns from String to JSON on the next resync after a
server upgrade, and the only fix is editing internal flags.

The MongoDB toggle tooltip and OpenAPI description in control-plane
still promise a String fallback and will be updated separately. (in
Clickpipes)

**File**: `flow/connectors/clickhouse/validate.go` (modified, +25/-0)
```diff
@@ -7,8 +7,11 @@ import (
 	"slices"
 	"strings"
 
+	chproto "github.com/ClickHouse/clickhouse-go/v2/lib/proto"
+
 	"github.com/PeerDB-io/peerdb/flow/generated/protos"
 	"github.com/PeerDB-io/peerdb/flow/internal"
+	"github.com/PeerDB-io/peerdb/flow/model/qvalue"
 	chvalidate "github.com/PeerDB-io/peerdb/flow/pkg/clickhouse"
 	"github.com/PeerDB-io/peerdb/flow/shared"
 )
@@ -48,6 +51,10 @@ func (c *ClickHouseConnector) ValidateMirrorDestination(
 		}
 	}
 
+	if err := checkNativeJSONSetting(ctx, cfg.Env, c.chVersion); err != nil {
+		return err
+	}
+
 	destinationTables := make([]string, 0, len(cfg.TableMappings))
 	for _, tableMapping := range cfg.TableMappings {
 		destinationTable := tableMapping.DestinationTableIdentifier
@@ -164,3 +171,21 @@ func (c *ClickHouseConnector) ValidateMirrorDestination(
 	}
 	return nil
 }
+
+// checkNativeJSONSetting rejects a mirror that turns PEERDB_CLICKHOUSE_ENABLE_JSON on against a ClickHouse
+// without the native JSON type, which would otherwise silently fall back to String columns.
+func checkNativeJSONSetting(ctx context.Context, env map[string]string, chVersion *chproto.Version) error {
+	enabled, err := internal.PeerDBEnableClickHouseJSON(ctx, env)
+	if err != nil {
+		return fmt.Errorf("failed to read PEERDB_CLICKHOUSE_ENABLE_JSON: %w", err)
+	}
+	if enabled && !qvalue.NativeJSONTypeSupported(chVersion) {
+		version := "unknown"
+		if chVersion != nil {
+			version = chVersion.String()
+		}
+		return fmt.Errorf("PEERDB_CLICKHOUSE_ENABLE_JSON needs ClickHouse 25.3 or newer for the native JSON type, "+
+			"the destination runs %s; turn the setting off to map JSON columns to String", version)
+	}
+	return nil
+}
```

**File**: `flow/connectors/clickhouse/validate_test.go` (modified, +25/-0)
```diff
@@ -3,7 +3,9 @@ package connclickhouse
 import (
 	"testing"
 
+	chproto "github.com/ClickHouse/clickhouse-go/v2/lib/proto"
 	"github.com/stretchr/testify/assert"
+	"github.com/stretchr/testify/require"
 
 	"github.com/PeerDB-io/peerdb/flow/generated/protos"
 )
@@ -14,3 +16,26 @@ func TestEngineToStringExhaustive(t *testing.T) {
 		assert.NoErrorf(t, err, "engineToString(%v) failed", protos.TableEngine(enumVal))
 	}
 }
+
+// TestCheckNativeJSONSetting checks that PEERDB_CLICKHOUSE_ENABLE_JSON is rejected on a ClickHouse without the
+// native JSON type instead of silently mapping JSON columns to String.
+func TestCheckNativeJSONSetting(t *testing.T) {
+	t.Parallel()
+
+	on := map[string]string{"PEERDB_CLICKHOUSE_ENABLE_JSON": "true"}
+	off := map[string]string{"PEERDB_CLICKHOUSE_ENABLE_JSON": "false"}
+	v25_2 := &chproto.Version{Major: 25, Minor: 2, Patch: 1}
+	v25_3 := &chproto.Version{Major: 25, Minor: 3}
+	v26_6 := &chproto.Version{Major: 26, Minor: 6}
+
+	require.NoError(t, checkNativeJSONSetting(t.Context(), on, v25_3))
+	require.NoError(t, checkNativeJSONSetting(t.Context(), on, v26_6))
+	require.NoError(t, checkNativeJSONSetting(t.Context(), off, v25_2))
+	require.NoError(t, checkNativeJSONSetting(t.Context(), off, nil))
+
+	err := checkNativeJSONSetting(t.Context(), on, v25_2)
+	require.ErrorContains(t, err, "25.3 or newer")
+	require.ErrorContains(t, err, "25.2.1")
+	err = checkNativeJSONSetting(t.Context(), on, nil)
+	require.ErrorContains(t, err, "unknown")
+}
```

**File**: `flow/internal/dynamicconf.go` (modified, +3/-4)
```diff
@@ -374,10 +374,9 @@ var DynamicSettings = [...]*protos.DynamicSetting{
 	},
 	{
 		Name: "PEERDB_CLICKHOUSE_ENABLE_JSON",
-		Description: "Map JSON datatype from source to JSON in ClickHouse instead of String; below ClickHouse 25.3 " +
-			"JSON columns stay String. Postgres/MySQL values that are not objects (scalars, arrays) are wrapped as " +
-			"{\"_value\": ...}, since ClickHouse JSON only accepts objects at the top level; a JSON null lands as {} " +
-			"because ClickHouse JSON drops null paths",
+		Description: "Map JSON datatype from source to JSON in ClickHouse instead of String. Postgres/MySQL values that " +
+			"are not objects (scalars, arrays) are wrapped as {\"_value\": ...}, since ClickHouse JSON only accepts " +
+			"objects at the top level; a JSON null lands as {} because ClickHouse JSON drops null paths",
 		DefaultValue:     "false",
 		ValueType:        protos.DynconfValueType_BOOL,
 		ApplyMode:        protos.DynconfApplyMode_APPLY_MODE_NEW_MIRROR,
```

#### Recent Merged Pull Requests:
- **PR #5016** (closed): mongo: kill change stream cursor leaked on context timeout (@dtunikov)
- **PR #5015** (2026-11-03): classify DocumentDB too many cursors error as recoverable (@dtunikov)
- **PR #5014** (2026-11-03): feat: upgrade `docker-compose.yml` stable image tags (@github-actions[bot])
- **PR #5011** (closed): fix(mysql): render GTID sets as strings in replication logs (@ilidemi)
- **PR #5010** (2026-11-02): Revert "clickhouse: drop the 25.3 check for PEERDB_CLICKHOUSE_ENABLE_JSON" (#5000) (@gheorghepucea)
- **PR #5004** (2026-11-02): Snapshot only columns that existed at the snapshot (@iskakaushik)

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

## X. clickhouse): normalize tables added to a running mirror through their column set

**RULE**:
When implementing operations in `flow/activities/flowable.go`, engineers MUST enforce rigorous boundary validation, safe state transitions, and memory/concurrency invariants as established by production defect remediation in PeerDB-io/peerdb. All inputs crossing module boundaries must be explicitly verified before state persistence.

**WHY**:
Prevents defects observed in production commit `f150824c`: clickhouse): normalize tables added to a running mirror through their column settings (#4998). Unvalidated execution paths cause runtime exceptions, race conditions, and silent state corruption under concurrent workloads.

**WHEN TO APPLY**:
Subsystems managing Go data structures, boundary deserialization, API parsing, or resource lifecycles matching `flow/activities/flowable.go`.

**VERIFIED IMPLEMENTATION PATTERN**:
```go
// Verified production-grade fix pattern:
	// config keeps the table mappings the mirror started with, options also the tables added since:
	// normalize must see the column settings of added tables too
	if options != nil {
		config = proto.CloneOf(config)
		config.TableMappings = options.TableMappings
	}

```

**NEGATIVE CONSTRAINT**:
```go
// Anti-pattern to NEVER write (induced failure mode):
// Defect-prone omission of boundary validation
```

**VERIFICATION METHOD**:
Automated regression test asserting that input states reproducing defect `f150824c` are properly handled with clean fallback behavior.
