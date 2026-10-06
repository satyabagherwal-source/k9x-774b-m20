# Forensic Learning Record (Deep Inspection): PeerDB-io/peerdb

> **Canonical Artifact**: `07_PROJECT_LEARNING/peerdb-io-peerdb-learnings.md`  
> **Source Platform**: GitHub ([https://github.com/PeerDB-io/peerdb](https://github.com/PeerDB-io/peerdb))  
> **Harvest Method**: Full-Spectrum Deep Extraction (Patches, Diffs, Source Code, Post-Mortems)  
> **Harvest Timestamp**: 2026-10-06T01:59:46.923Z  
> **Compliance State**: Free Tier Guaranteed | Strict Rate-Limit Backoff Honored  

---

## 1. Context & Architectural Overview
- **Repository / Resource**: `PeerDB-io/peerdb`
- **Description**: Fast, Simple and a cost effective tool to replicate data from Postgres to Data Warehouses, Queues and Storage
- **Primary Language / Ecosystem**: Go
- **Discovered Manifests / Configurations**: README.md
- **Stars / Engagement**: 3295 stars

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
		tblNameMapping[v.SourceTableIdentifier] = model.NewSourceTableMappingWithStructuredIngestion(
			v.DestinationTableIdentifier, v.Exclude, v.StructuredIngestionConfig,
		)
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
	// `any` is for returning transaction if necessary
	ExportTxSnapshot(
		ctx context.Context,
		flowName string,
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
// table's CDC records (SyncQueryCDC) and separately insert staged batches
// straight into the final destination table (NormalizeQueryCDC), skipping any
// raw-table hop.
type QueryCDCSyncConnector interface {
	Connector

	// SyncQueryCDC should be idempotent given the same records and BatchID.
	SyncQueryCDC(ctx context.Context, req *model.SyncQueryCDCRequest) (*model.RecordTypeCounts, error)

	// NormalizeQueryCDC should be idempotent given the same batch range.
	NormalizeQueryCDC(ctx context.Context, req *model.NormalizeQueryCDCRequest) (*model.RecordTypeCounts, error)
}

type CDCSyncPgConnector interface {
	CDCSyncConnectorCore

	// SyncPg pushes PgItems to the destination peer and stores it in PeerDB specific tables.
	// This method should be idempotent, and should be able to be called multiple times with the same request.
	// It's signature, aside from type parameter, should match CDCSyncConnector.SyncRecords.
	SyncPg(ctx context.Context, req *model.SyncRecordsRequest[model.PgItems]) (*model.SyncResponse, error)
}

type CDCNormalizeConnector interface {
	Connector

	// NormalizeRecords merges records pushed earlier into the destination table.
	// This method should
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
		return AvroFile{}, fmt.Errorf("failed to upload file: %w", err)
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

### Core Architecture Module: `flow/connectors/utils/cdc_store.go`
```
package utils

import (
	"bytes"
	"context"
	"encoding/gob"
	"errors"
	"fmt"
	"log/slog"
	"os"
	"runtime/metrics"
	"sync/atomic"
	"time"

	"github.com/cockroachdb/pebble/v2"
	"github.com/shopspring/decimal"
	"go.temporal.io/sdk/log"

	"github.com/PeerDB-io/peerdb/flow/internal"
	"github.com/PeerDB-io/peerdb/flow/model"
	"github.com/PeerDB-io/peerdb/flow/pkg/common"
	"github.com/PeerDB-io/peerdb/flow/shared"
	"github.com/PeerDB-io/peerdb/flow/shared/types"
)

func encVal(val any) ([]byte, error) {
	buf := new(bytes.Buffer)
	enc := gob.NewEncoder(buf)
	err := enc.Encode(val)
	if err != nil {
		return []byte{}, fmt.Errorf("unable to encode value %v: %w", val, err)
	}
	return buf.Bytes(), nil
}

type CDCStore[Items model.Items] struct {
	logger                    log.Logger
	inMemoryRecords           map[model.TableWithPkey]model.Record[Items]
	pebbleDB                  *pebble.DB
	flowJobName               string
	dbFolderName              string
	thresholdReason           string
	memStats                  []metrics.Sample
	memThresholdBytes         uint64
	numRecordsSwitchThreshold int
	numRecords                atomic.Int32
}

func NewCDCStore[Items model.Items](ctx context.Context, env map[string]string, flowJobName string) (*CDCStore[Items], error) {
	numRecordsSwitchThreshold, err := internal.PeerDBCDCDiskSpillRecordsThreshold(ctx, env)
	if err != nil {
		return nil, fmt.Errorf("failed to get CDC disk spill records threshold: %w", err)
	}
	memPercent, err := internal.PeerDBCDCDiskSpillMemPercentThreshold(ctx, env)
	if err != nil {
		return nil, fmt.Errorf("failed to get CDC disk spill memory percent threshold: %w", err)
	}

	return &CDCStore[Items]{
		inMemoryRecords:           make(map[model.TableWithPkey]model.Record[Items]),
		pebbleDB:                  nil,
		numRecords:                atomic.Int32{},
		flowJobName:               flowJobName,
		dbFolderName:              fmt.Sprintf("%s/%s_%s", os.TempDir(), flowJobName, common.RandomString(8)),
		numRecordsSwitchThreshold: int(numRecordsSwitchThreshold),
		memThresholdBytes: func() uint64 {
			maxMemBytes := internal.PeerDBFlowWorkerMaxMemBytes()
			if memPercent > 0 && maxMemBytes > 0 {
				return maxMemBytes * uint64(memPercent) / 100
			}
			return 0
		}(),
		thresholdReason: "",
		memStats:        []metrics.Sample{{Name: "/memory/classes/heap/objects:bytes"}},
		logger:          internal.LoggerFromCtx(ctx),
	}, nil
}

func init() {
	// register future record classes here as well, if they are passed/stored as interfaces
	gob.Register(time.Time{})
	gob.Register(decimal.Decimal{})
	gob.Register(types.QValueNull(""))
	gob.Register(types.QValueInvalid{})
	gob.Register(types.QValueFloat32{})
	gob.Register(types.QValueFloat64{})
	gob.Register(types.QValueInt8{})
	gob.Register(types.QValueInt16{})
	gob.Register(types.QValueInt32{})
	gob.Register(types.QValueInt64{})
	gob.Register(types.QValueInt256{})
	gob.Register(types.QValueUInt8{})
	gob.Register(types.QValueUInt16{})
	gob.Register(types.QValueUInt32{})
	gob.Register(types.QValueUInt64{})
	gob.Register(types.QValueUInt256{})
	gob.Register(types.QValueBoolean{})
	gob.Register(types.QValueQChar{})
	gob.Register(types.QValueString{})
	gob.Register(types.QValueEnum{})
	gob.Register(types.QValueUint16Enum{})
	gob.Register(types.QValueUint64Set{})
	gob.Register(types.QValueTimestamp{})
	gob.Register(types.QValueTimestampTZ{})
	gob.Register(types.QValueDate{})
	gob.Register(types.QValueTime{})
	gob.Register(types.QValueTimeTZ{})
	gob.Register(types.QValueInterval{})
	gob.Register(types.QValueNumeric{})
	gob.Register(types.QValueBytes{})
	gob.Register(types.QValueUUID{})
	gob.Register(types.QValueJSON{})
	gob.Register(types.QValueHStore{})
	gob.Register(types.QValueGeography{})
	gob.Register(types.QValueGeometry{})
	gob.Register(types.QValuePoint{})
	gob.Register(types.QValueCIDR{})
	gob.Register(types.QValueINET{})
	gob.Register(types.QValueMacaddr{})
	gob.Register(types.QValueArrayFloat32{})
	gob.Register(types.QValueArrayFloat64{})
	gob.Register(types.QValueArrayInt16{})
	gob.Register(types.QValueArrayInt32{})
	gob.Register(types.QValueArrayInt64{})
	gob.Register(types.QValueArrayString{})
	gob.Register(types.QValueArrayEnum{})
	gob.Register(types.QValueArrayDate{})
	gob.Register(types.QValueArrayInterval{})
	gob.Register(types.QValueArrayTimestamp{})
	gob.Register(types.QValueArrayTimestampTZ{})
	gob.Register(types.QValueArrayBoolean{})
	gob.Register(types.QValueArrayUUID{})
	gob.Register(types.QValueArrayNumeric{})
}

func (c *CDCStore[T]) initPebbleDB() error {
	if c.pebbleDB != nil {
		return nil
	}

	gob.Register(&model.InsertRecord[T]{})
	gob.Register(&model.UpdateRecord[T]{})
	gob.Register(&model.DeleteRecord[T]{})
	gob.Register(&model.RelationRecord[T]{})
	gob.Register(&model.MessageRecord[T]{})

	var err error
	// we don't want a WAL since cache, we don't want to overwrite another DB either
	c.pebbleDB, err = pebble.Open(c.dbFolderName, &pebble.Options{
		DisableWAL:         true,
		ErrorIfExists:      true,
		FormatMajorVersion: pebble.FormatNewest,
	})
	if err != nil {
		return fmt.Errorf("failed to initialize Pebble database: %w", err)
	}
	return nil
}

func (c *CDCStore[T]) diskSpillThresholdsExceeded() bool {
	if c.numRecordsSwitchThreshold >= 0 && len(c.inMemoryRecords) >= c.numRecordsSwitchThreshold {
		c.thresholdReason = fmt.Sprintf("more than %d primary keys read, spilling to disk",
			c.numRecordsSwitchThreshold)
		return true
	}
	if c.memThresholdBytes > 0 {
		metrics.Read(c.memStats)

		if c.memStats[0].Value.Uint64() >= c.memThresholdBytes {
			c.thresholdReason = fmt.Sprintf("memalloc greater than %d bytes, spilling to disk",
				c.memThresholdBytes)
			return true
		}
	}
	return false
}

func (c *CDCStore[T]) Set(key model.TableWithPkey, rec model.Record[T]) error {
	if key.TableName != "" {
		_, ok := c.inMemoryRecords[key]
		if ok || !c.diskSpillThresholdsExceeded() {
			c.inMemoryRecords[key] = rec
		} else {
			if c.pebbleDB == nil {
				c.logger.Info(c.thresholdReason,
					slog.String(string(shared.FlowNameKey), c.flowJobName))
				if err := c.initPebbleDB(); err != nil {
					return err
				}
			}

			encodedKey, err := encVal(key)
			if err != nil {
				return err
			}
			// necessary to point pointer to interface so the interface is exposed
			// instead of the underlying type
			encodedRec, err := encVal(&rec)
			if err != nil {
				return err
			}
			// we're using Pebble as a cache, no need for durability here.
			if err := c.pebbleDB.Set(encodedKey, encodedRec, &pebble.WriteOptions{
				Sync: false,
			}); err != nil {
				return fmt.Errorf("unable to store value in Pebble: %w", err)
			}
		}
	}

	c.numRecords.Add(1)
	return nil
}

// bool is to indicate if a record is found or not [similar to ok]
func (c *CDCStore[T]) Get(key model.TableWithPkey) (model.Record[T], bool, error) {
	rec, ok := c.inMemoryRecords[key]
	if ok {
		return rec, true, nil
	} else if c.pebbleDB != nil {
		encodedKey, err := encVal(key)
		if err != nil {
			return nil, false, err
		}
		encodedRec, closer, err := c.pebbleDB.Get(encodedKey)
		if err != nil {
			if errors.Is(err, pebble.ErrNotFound) {
				return nil, false, nil
			} else {
				return nil, false, fmt.Errorf("error while retrieving value with key %v: %w", key, err)
			}
		}
		defer func() {
			if err := closer.Close(); err != nil {
				c.logger.Warn("failed to close database",
					slog.Any("error", err),
					slog.String("flowName", c.flowJobName))
			}
		}()

		dec := gob.NewDecoder(bytes.NewReader(encodedRec))
		var rec model.Record[T]
		if err := dec.Decode(&rec); err != nil {
			return nil, false, fmt.Errorf("failed to decode record: %w", err)
		}

		return rec, true, nil
	}
	return nil, false, nil
}

func (c *CDCStore[T]) Close() error {
	c.inMemoryRecords = nil
	if c.pebbleDB != nil {
		if err := c.pebbleDB.Close(); err != nil {
			return fmt.Errorf("failed to close database: %w", err)
		}
	}
	if err := os.RemoveAll(c.dbFolderName); err != nil {
		return fmt.Errorf("failed to delete database file: %w", err)
	}
	return nil
}

```

### Core Architecture Module: `flow/connectors/utils/deadline_capable_conn.go`
```
package utils

import (
	"errors"
	"io"
	"net"
	"sync"

	"github.com/PeerDB-io/peerdb/flow/shared/exceptions"
)

type deadlineCapableConn struct {
	net.Conn

	proxyConn net.Conn
	sshConn   net.Conn
	closeOnce sync.Once
}

// NewDeadlineCapableConn creates connection that always respect context deadline.
// Used for ssh connection where deadline is not supported and an error is returned
// when attempting to set deadline (https://github.com/golang/go/issues/65930)
//
// Previously, we implemented this workaround:
// https://github.com/jackc/pgx/issues/382#issuecomment-1496586216
// which silently ignores deadline instead of erroring. However, for connectors
// that depend on context deadline (e.g. Postgres), this means reading from
// ssh channel blocks indefinitely when no message arrives.
//
// The fix here is introducing a deadline-capable in-memory transport between
// the connector and SSH using net.Pipe(). When deadline fires, any chunk the
// io.Copy goroutine already read from SSH is served on next read, avoiding
// data loss.
func NewDeadlineCapableConn(sshConn net.Conn) net.Conn {
	localConn, proxyConn := net.Pipe()

	dcConn := &deadlineCapableConn{
		Conn:      localConn,
		proxyConn: proxyConn,
		sshConn:   sshConn,
	}

	go func() {
		_, _ = io.Copy(dcConn.proxyConn, dcConn.sshConn)
		dcConn.closeAll()
	}()
	go func() {
		_, _ = io.Copy(dcConn.sshConn, dcConn.proxyConn)
		dcConn.closeAll()
	}()

	return dcConn
}

func (c *deadlineCapableConn) Read(b []byte) (int, error) {
	n, err := c.Conn.Read(b)
	return n, translateErr(err)
}

func (c *deadlineCapableConn) Write(b []byte) (int, error) {
	n, err := c.Conn.Write(b)
	return n, translateErr(err)
}

func translateErr(err error) error {
	if errors.Is(err, io.ErrClosedPipe) || errors.Is(err, io.EOF) {
		return exceptions.NewSSHTunnelClosedError(err)
	}
	return err
}

func (c *deadlineCapableConn) Close() error {
	err := c.Conn.Close()
	c.closeAll()
	return err
}

func (c *deadlineCapableConn) closeAll() {
	c.closeOnce.Do(func() {
		_ = c.proxyConn.Close()
		_ = c.sshConn.Close()
	})
}

```


### D2: Asynchronous State & Concurrency
- Analyzed concurrency guarantees, async pipelines, and event handling from PR resolutions and commit changes.

### D3: Error Boundaries, Recovery & Rollbacks
- Exception handling patterns and defect resolutions extracted from closed production bug issues:
- **Issue #4664** (2026-08-21): **[Bug]: PG→PG CDC: _peerdb_raw_* table grows indefinitely — no cleanup after normalize**
  *Symptoms*: ### Description  In a PG→PG CDC mirror (v0.37.0), the `_peerdb_internal._peerdb_raw_<mirror_name>` table on the destination database grows indefinitely. After normalize successfully processes a batch and applies changes to the destination tables, the corresponding rows in the raw table are **never deleted**.   ### Steps to reproduce  ## Steps to Reproduce 1. Create a PG→PG CDC mirror with `do_initial_copy = true` 2. Let it run for a while with active writes on the source 3. Check the raw table size on the destination: ```sql SELECT pg_size_pretty(pg_total_relation_size('_peerdb_internal._peerdb_raw_rzldb_to_lkdb')); ```  ## Expected Behavior  After normalize completes for a batch, the processed rows should be removed from the raw table (or after a configurable retention window).  ## Actual Behavior  The raw table keeps growing. In our production mirror:  * `sync_batch_id = 6249`, `normalize_batch_id = 6249`, **gap = 0** (normalize fully caught up)  * Raw table: **49.5 million live rows**, **0 dead tuples**, **19 GB**  * Source code confirms: `normalizeBatch()` in `postgres_destination.go` only writes to destination tables and updates metadata — no DELETE against the raw table  ### PeerDB version  * PeerDB v0.37.0, Docker Compose   ### Source connector  PostgreSQL  ### Destination connector  PostgreSQL
  **Post-Mortem & Fix Analysis**:
  > related: https://github.com/PeerDB-io/peerdb/issues/4115  add a TTL is enough to avoid growth issues.
  > > related: [#4115](https://github.com/PeerDB-io/peerdb/issues/4115) >  > add a TTL is enough to avoid growth issues.  A TTL alone isn't safe here. The raw table is a staging queue, not a log table — rows must stay until normalize has processed them. A time-based TTL can delete rows that normalize hasn't caught up to yet, causing data loss.The safe cleanup condition is: DELETE FROM _peerdb_internal._peerdb_raw_<mirror> WHERE _peerdb_batch_id <= <normalize_batch_id>; So the fix needs to be batch-based inside the normalize flow, not time-based TTL.
  > We introduced a TTL not too long ago but it applied to newly created tables. The default TTL is set to 30 days which should be plenty. If normalize is that backed up it exceeds that point, it would likely point to much more serious issues downstream that need resolution.

- **Issue #3457** (2025-09-16): **MySQL: Handle difference in replication of timestamps when source server is not UTC**
  *Symptoms*: Scenario reported by a user:  1. I have a server in UTC+7 time zone. 2. I have mysql installed there that uses the system time zone. 3. I have a table with timestamp column (it is stored in UTC, as far as I understand, and returned to a user based on the session settings). 4. I insert some data. 5. I select this data in MySQL and see UTC+7 timestamp. 6. I select this data in ClickHouse using MySQL table function, and see UTC+7 timestamp. 7. I create a MySQL CDC pipe -> I see timestamps inserted at initial load as UTC+7. 8. I update mysql table -> and see UTC+7 timestamp. 9. However, when these changes I synced to ClickHouse I see UTC time.

- **Issue #3396** (2025-08-26): **Last offset fetch: prevent destination connection by returning early**
  *Symptoms*: Implementation in https://github.com/PeerDB-io/peerdb/pull/3367 misses the fact that GetConnector which we call under the hood opens a destination connection, and only after we successfully get a connector do we assert that the connector supports T.  This PR clones GetByNameAs and passes in an `expectedType` parameter which is used to error out with unsupported early 

- **Issue #3274** (2025-08-07): **mongo: numbers less than -Int64.MinValue fail normalize**
  *Symptoms*: Current `JSONExtractString` behavior: - number less than Abs(Int64.MaxValue) get casted to int64 - numbers greater than Int64.MaxValue get casted to uint64 - numbers less than Int64.MinValue will return an error during Normalize (`Cannot parse JSON object here:...`)  Last case is problematic as it will block workflow.  Repro: ``` db.table.insertOne({largeNumRaw: -9223372036854775807}) ``` mongo will round this value to `-9223372036854776000`, this will break workflow with the parse error.
  **Post-Mortem & Fix Analysis**:
  > broader issue: https://github.com/PeerDB-io/peerdb/issues/3323

- **Issue #3253** (2025-07-29): **mongo: in string destination mode, large integers lose precision**
  *Symptoms*: longLarge: Long('9223372036854775807'), // becomes 9223372036854776000 longNegLarge: Long('-9223372036854775808'), // becomes -9223372036854776000
  **Post-Mortem & Fix Analysis**:
  > Was not able to reproduce this
  > `sql-console` bug with how the json is parsed and highlighted

- **Issue #3252** (2025-08-07): **mongo: NaN and Infinity block cdc**
  *Symptoms*: These block the pipe in snapshot and cdc: ``` doubleNan: Double('NaN'), doubleInf: Double('Infinity'), doubleNegInf: Double('-Infinity') ``` Example error: ``` [qrep] failed to pull records: failed to convert record: error marshalling document: json: error calling MarshalJSON for type bson.D: json: unsupported value: +Inf ``` 
  **Post-Mortem & Fix Analysis**:
  > I think to fix this we'll need a custom marshaling logic (i.e. use bson.Marshal with some post-processing).   For now i'm inclined to document this quirk and let the pipe fail loudly if these special values are encountered. 
  > https://github.com/PeerDB-io/peerdb/pull/3319

- **Issue #3246** (2025-07-24): **mongo: Resume token error after pause, insert and resume**
  *Symptoms*: Came across this error: ```  failed to create change stream: (ChangeStreamFatalError) PlanExecutor error during aggregation :: caused by :: cannot resume stream; the resume token was not found. {_data: "82687E82DE000000012B042C0100296E5A1004FEA7A1FFE23C4FD88070BFA43C9C995C463C6F7065726174696F6E54797065003C696E736572740046646F63756D656E744B65790046645F69640064687E82DC122A414A3ECD77F8000004"} -- ```  during CDC when testing the MongoDB mirror. Steps to reproduce: <redacted>
  **Post-Mortem & Fix Analysis**:
  > Still need to figure out stable reproduction of this issue
  > Minimum repro:  ``` const p1 = [ { "$match": { "$and": [ {"ns.db": "test"}, {"ns.coll": {"$in": ["t1", "t2"]}} ] } } ]; const changeStream1 = db.watch(p1); db.t1.insertOne({"a": 1}); const event = changeStream1.next();  // pause and delete a table  const p2 = [ { "$match": { "$and": [ {"ns.db": "test"}, {"ns.coll": {"$in": ["t2"]}} ] } } ]; const changeStream2 = db.watch(p2, {resumeAfter: event._id}); db.t2.insertOne({"b": 1}); changeStream2.next(); MongoServerError[ChangeStreamFatalError]: PlanExecutor error during aggregation :: caused by :: cannot resume stream; the resume token was not found. {_data: "82687F3418000000012B042C0100296E5A100402029C35AFFD457AA3093B44F7D71C6D463C6F7065726174696F6E54797065003C696E736572740046646F63756D656E744B65790046645F69640064687F3418245CA5A3B5F47124000004"} ```  Turns out this is expected behavior of Mongo change stream. We fail to resume because the delete table is filtered out of the changestream so mongo fails to reconcile to the resumeToken from 

- **Issue #2162** (2024-11-15): **DROP MIRROR during Initial Load: Dangling connections on source**
  *Symptoms*: When a mirror is dropped during the initial load process, PeerDB may leave behind dangling connections on the source database. Specifically, the CREATE_REPLICATION_SLOT connection often remains in an `idle in transaction` state. If left unaddressed, these connections can block vacuuming operations on the source database, which can be risky.
  **Post-Mortem & Fix Analysis**:
  > I assume these are long running dangling connections. The code as is allows for that connection to dangle for a minute before being closed
  > Implemented #2168 while investigating this issue

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

### Incident Patch 1: `1cfbf3aa` (2026-10-02)
**Commit Message**: Revert "Downgrade DropFlowSource per-retry alerts to warnings (#4807)" (#4880)

Deleted pipes have their notifications filtered out already, and logs
aren't visible after deletion. Changing the mapping broke the handling
in the downstream consumer, so reverting to resolve internal alert noise
without altering external behavior.

Resolves DBI-1179

**File**: `flow/activities/flowable.go` (modified, +4/-4)
```diff
@@ -935,9 +935,9 @@ func (a *FlowableActivity) DropFlowSource(ctx context.Context, req *protos.DropF
 			logger.Warn("auth error, skipping to avoid triggering security tools", slog.String("peer", req.PeerName))
 			return nil
 		}
-		getConnErr := exceptions.NewDropFlowError(fmt.Errorf("[DropFlowSource] failed to get source connector: %w", err))
-		a.Alerter.LogFlowWarning(ctx, req.FlowJobName, getConnErr)
-		return getConnErr
+		return a.Alerter.LogFlowError(ctx, req.FlowJobName,
+			exceptions.NewDropFlowError(fmt.Errorf("[DropFlowSource] failed to get source connector: %w", err)),
+		)
 	}
 	defer srcClose(ctx)
 
@@ -949,7 +949,7 @@ func (a *FlowableActivity) DropFlowSource(ctx context.Context, req *protos.DropF
 			pullCleanupErr := exceptions.NewDropFlowError(fmt.Errorf("[DropFlowSource] failed to clean up source: %w", err))
 			if !shared.IsSQLStateError(err, pgerrcode.ObjectInUse) {
 				// don't alert when PID active
-				a.Alerter.LogFlowWarning(ctx, req.FlowJobName, pullCleanupErr)
+				_ = a.Alerter.LogFlowError(ctx, req.FlowJobName, pullCleanupErr)
 			}
 			return pullCleanupErr
 		}
```

---

### Incident Patch 2: `48cd9444` (2026-10-01)
**Commit Message**: Fix CI flake/crash: protect dynconf maps with an RWMutex (#4869)

Concurrent map writes is the most common cause of crashes in CI. Add an
RWMutex to protect the map.

This solution is not great because one mutex protects many maps, but
writes happen once per activity+config and reads are very cheap so
practically it should work.

Other solutions considered:
* Replacing with sync.Map - not possible as map[string]string comes from
proto generation
* Passing a mutex with the map - lots of passing
* Untangling the configs and caching them explicitly - would be ideal
but besides just tracking which configs need caching to reduce DB load,
would also need to determine, which ones depend on the value getting
persisted into the flow config in catalog/Temporal.

**File**: `flow/internal/dynamicconf.go` (modified, +26/-4)
```diff
@@ -10,6 +10,7 @@ import (
 	"slices"
 	"strconv"
 	"strings"
+	"sync"
 	"time"
 
 	"github.com/jackc/pgx/v5"
@@ -662,8 +663,29 @@ const (
 	BinaryFormatHex
 )
 
+// env maps are shared across goroutines within an activity (e.g. pull/sync/normalize),
+// and dynLookup writes resolved values back into them
+// untangling the configs and doing explicit caching / intentional write-back would be better
+// but life is short
+var envMu sync.RWMutex
+
+func envGet(env map[string]string, key string) (string, bool) {
+	envMu.RLock()
+	defer envMu.RUnlock()
+	val, ok := env[key]
+	return val, ok
+}
+
+func envSetIfMissing(env map[string]string, key string, val string) {
+	envMu.Lock()
+	defer envMu.Unlock()
+	if _, ok := env[key]; !ok {
+		env[key] = val
+	}
+}
+
 func dynLookup(ctx context.Context, env map[string]string, key string) (string, error) {
-	if val, ok := env[key]; ok {
+	if val, ok := envGet(env, key); ok {
 		return val, nil
 	}
 
@@ -687,19 +709,19 @@ func dynLookup(ctx context.Context, env map[string]string, key string) (string,
 	if !value.Valid {
 		if val, ok := os.LookupEnv(key); ok {
 			if env != nil && setting != nil && setting.ApplyMode != protos.DynconfApplyMode_APPLY_MODE_IMMEDIATE {
-				env[key] = val
+				envSetIfMissing(env, key, val)
 			}
 			return val, nil
 		}
 		if setting != nil {
 			if env != nil && setting.ApplyMode != protos.DynconfApplyMode_APPLY_MODE_IMMEDIATE {
-				env[key] = setting.DefaultValue
+				envSetIfMissing(env, key, setting.DefaultValue)
 			}
 			return setting.DefaultValue, nil
 		}
 	}
 	if env != nil && setting != nil && setting.ApplyMode != protos.DynconfApplyMode_APPLY_MODE_IMMEDIATE {
-		env[key] = value.String
+		envSetIfMissing(env, key, value.String)
 	}
 	return value.String, nil
 }
```

**File**: `flow/internal/dynamicconf_cache.go` (modified, +1/-1)
```diff
@@ -38,7 +38,7 @@ func (s *CachedDynconfSetting[T]) Get(ctx context.Context, env map[string]string
 		return zero, errors.New("cached dynamic setting is not initialized")
 	}
 
-	if _, overridden := env[s.name]; overridden {
+	if _, overridden := envGet(env, s.name); overridden {
 		return s.getter(ctx, env, s.name)
 	}
 
```

---

### Incident Patch 3: `4ab4f3af` (2026-10-01)
**Commit Message**: fix(structured-ingestion-mongodb) DBI-91: Propagate column exclusions to projection logic (#4879)

Structured Ingestion projections were not taking into account excluded
columns. This had the effect of them being reported as unexpected fields
in malformed data.

This PR adds the excluded columns parameters and propagates down to
schema projectors in MongoDB Structured ingestion CDC and Initial load.

Part of:
https://linear.app/clickhouse/issue/DBI-91/structured-logging-support

**File**: `flow/connectors/mongo/cdc.go` (modified, +2/-2)
```diff
@@ -170,7 +170,7 @@ func (c *MongoConnector) GetTableSchema(
 		structuredCfg := tm.StructuredIngestionConfig
 		if structuredCfg.GetEnabled() {
 			// only the schema is derived here, so recording malformed values is inconsequential
-			projector, err := newStructuredSchemaProjector(tm.Columns, !structuredCfg.GetDropUnexpectedValues())
+			projector, err := newStructuredSchemaProjector(tm.Columns, tm.Exclude, !structuredCfg.GetDropUnexpectedValues())
 			if err != nil {
 				return nil, fmt.Errorf("invalid structured ingestion schema for %s: %w", tm.SourceTableIdentifier, err)
 			}
@@ -530,7 +530,7 @@ func (c *MongoConnector) PullRecords(
 		if !ok {
 			return fmt.Errorf("no table schema for structured ingestion table %s (destination %s)", sourceTableName, tableMapping.Name)
 		}
-		projector, err := newStructuredSchemaProjectorFromTableSchema(schema, !structuredCfg.GetDropUnexpectedValues())
+		projector, err := newStructuredSchemaProjectorFromTableSchema(schema, tableMapping.Exclude, !structuredCfg.GetDropUnexpectedValues())
 		if err != nil {
 			return fmt.Errorf("failed to build structured schema projector for table %s: %w", sourceTableName, err)
 		}
```

**File**: `flow/connectors/mongo/document_projection.go` (modified, +10/-4)
```diff
@@ -53,30 +53,36 @@ func DocumentQValueIterator(raw bson.Raw, converter BsonToQValueConverter) (iter
 // newStructuredSchemaProjector builds the projector for the columns of a structured ingestion table
 // mapping. recordMalformedValues controls whether the projector records the offending values.
 func newStructuredSchemaProjector(
-	columns []*protos.ColumnSetting, recordMalformedValues bool,
+	columns []*protos.ColumnSetting, excludedColumnsNames []string, recordMalformedValues bool,
 ) (*structured.SchemaProjector, error) {
 	filteredColumns := make([]*protos.ColumnSetting, 0, len(columns))
 	for _, column := range columns {
 		if isProjectedColumn(column.SourceName) {
 			filteredColumns = append(filteredColumns, column)
 		}
 	}
-	return structured.NewSchemaProjectorFromCHtoQValue(filteredColumns, recordMalformedValues)
+
+	excludedColumnSet := make(map[string]struct{}, len(excludedColumnsNames))
+	for _, col := range excludedColumnsNames {
+		excludedColumnSet[col] = struct{}{}
+	}
+
+	return structured.NewSchemaProjectorFromCHtoQValue(filteredColumns, excludedColumnSet, recordMalformedValues)
 }
 
 // newStructuredSchemaProjectorFromTableSchema builds the projector for a structured ingestion table from
 // the table schema GetTableSchema emitted for it (persisted at setup), whose column types are already
 // QValueKinds.
 func newStructuredSchemaProjectorFromTableSchema(
-	schema *protos.TableSchema, recordMalformedValues bool,
+	schema *protos.TableSchema, excludedColumnSet map[string]struct{}, recordMalformedValues bool,
 ) (*structured.SchemaProjector, error) {
 	fields := make([]types.QField, 0, len(schema.Columns))
 	for _, column := range schema.Columns {
 		if isProjectedColumn(column.Name) {
 			fields = append(fields, types.QField{Name: column.Name, Type: types.QValueKind(column.Type)})
 		}
 	}
-	return structured.NewSchemaProjectorFromQFields(fields, recordMalformedValues)
+	return structured.NewSchemaProjectorFromQFields(fields, excludedColumnSet, recordMalformedValues)
 }
 
 func isProjectedColumn(columnName string) bool {
```

**File**: `flow/connectors/mongo/document_projection_test.go` (modified, +8/-8)
```diff
@@ -26,7 +26,7 @@ func structuredTestColumns() []*protos.ColumnSetting {
 }
 
 func TestGetStructuredSchema(t *testing.T) {
-	projector, err := newStructuredSchemaProjector(structuredTestColumns(), true)
+	projector, err := newStructuredSchemaProjector(structuredTestColumns(), nil, true)
 	require.NoError(t, err)
 
 	require.Equal(t, []types.QField{
@@ -47,13 +47,13 @@ func TestGetStructuredSchema(t *testing.T) {
 // it from the mapping's columns, CDC from the table schema GetTableSchema emits for that same mapping.
 // Both must project records with the same layout and kinds.
 func TestStructuredProjectorPathsAgree(t *testing.T) {
-	fromMapping, err := newStructuredSchemaProjector(structuredTestColumns(), true)
+	fromMapping, err := newStructuredSchemaProjector(structuredTestColumns(), nil, true)
 	require.NoError(t, err)
 
 	schemas, err := (&MongoConnector{}).GetTableSchema(t.Context(), nil, shared.InternalVersion_Latest, protos.TypeSystem_Q,
 		[]*protos.TableMapping{structuredTableMapping("test.t", structuredTestColumns())})
 	require.NoError(t, err)
-	fromTableSchema, err := newStructuredSchemaProjectorFromTableSchema(schemas["test.t"], true)
+	fromTableSchema, err := newStructuredSchemaProjectorFromTableSchema(schemas["test.t"], nil, true)
 	require.NoError(t, err)
 
 	require.Equal(t, fromMapping.QRecordSchema(), fromTableSchema.QRecordSchema())
@@ -124,9 +124,9 @@ func TestNewStructuredSchemaProjectorDropsReservedColumns(t *testing.T) {
 		&protos.ColumnSetting{SourceName: DefaultDocumentKeyColumnName, DestinationType: "String"},
 		&protos.ColumnSetting{SourceName: structured.MalformedDataColumn, DestinationType: "JSON"},
 	)
-	withReserved, err := newStructuredSchemaProjector(columns, true)
+	withReserved, err := newStructuredSchemaProjector(columns, nil, true)
 	require.NoError(t, err)
-	withoutReserved, err := newStructuredSchemaProjector(structuredTestColumns(), true)
+	withoutReserved, err := newStructuredSchemaProjector(structuredTestColumns(), nil, true)
 	require.NoError(t, err)
 
 	require.Equal(t, withoutReserved.QRecordSchema(), withReserved.QRecordSchema())
@@ -145,7 +145,7 @@ func TestNewStructuredSchemaProjectorRejects(t *testing.T) {
 		},
 	} {
 		t.Run(name, func(t *testing.T) {
-			_, err := newStructuredSchemaProjector(tc.columns, true)
+			_, err := newStructuredSchemaProjector(tc.columns, nil, true)
 			require.ErrorContains(t, err, tc.offender)
 		})
 	}
@@ -154,7 +154,7 @@ func TestNewStructuredSchemaProjectorRejects(t *testing.T) {
 func TestStructuredQValuesFromBsonRaw(t *testing.T) {
 	oid, err := bson.ObjectIDFromHex("507f1f77bcf86cd799439011")
 	require.NoError(t, err)
-	projector, err := newStructuredSchemaProjector(structuredTestColumns(), true)
+	projector, err := newStructuredSchemaProjector(structuredTestColumns(), nil, true)
 	require.NoError(t, err)
 	schema := GetStructuredSchema(projector)
 	converter := NewDirectBsonConverter()
@@ -240,7 +240,7 @@ func TestStructuredQValuesFromBsonRawDates(t *testing.T) {
 	projector, err := newStructuredSchemaProjector([]*protos.ColumnSetting{
 		{SourceName: "createdAt", DestinationType: "Nullable(DateTime64(9))"},
 		{SourceName: "label", DestinationType: "Nullable(String)"},
-	}, true)
+	}, nil, true)
 	require.NoError(t, err)
 	schema := GetStructuredSchema(projector)
 	createdAt := time.Date(2026, 8, 26, 18, 34, 5, 200_000_000, time.FixedZone("UTC+2", 2*60*60))
```

**File**: `flow/connectors/mongo/qrep.go` (modified, +1/-1)
```diff
@@ -103,7 +103,7 @@ func (c *MongoConnector) PullQRepRecords(
 	var qValuesFromBsonRaw func(raw bson.Raw) ([]types.QValue, error)
 	structuredCfg := config.StructuredIngestionConfig
 	if structuredCfg.GetEnabled() {
-		projector, err := newStructuredSchemaProjector(config.Columns, !structuredCfg.GetDropUnexpectedValues())
+		projector, err := newStructuredSchemaProjector(config.Columns, config.Exclude, !structuredCfg.GetDropUnexpectedValues())
 		if err != nil {
 			return 0, 0, fmt.Errorf("failed to build structured schema: %w", err)
 		}
```

**File**: `flow/connectors/utils/structured/schema.go` (modified, +22/-4)
```diff
@@ -21,6 +21,8 @@ type schemaColumn struct {
 type SchemaProjector struct {
 	// Schema columns by the record field they read from.
 	columns map[string]schemaColumn
+	// Set of excluded columns names (finding them is not unexpected)
+	excludedColumns map[string]struct{}
 	// Record fields in order: the schema columns as declared, then the malformed data column.
 	fields []types.QField
 	// Position of the malformed data column in fields, and so in the records ProjectRecord produces.
@@ -35,6 +37,7 @@ type SchemaProjector struct {
 func NewSchemaProjector(
 	schemaToQKind func(schemaType string) (types.QValueKind, error),
 	schemaColumns []*protos.ColumnSetting,
+	excludedColumnSet map[string]struct{},
 	shouldRecordValues bool,
 ) (*SchemaProjector, error) {
 	schemaFields := make([]types.QField, 0, len(schemaColumns))
@@ -47,11 +50,14 @@ func NewSchemaProjector(
 		schemaFields = append(schemaFields, types.QField{Name: column.SourceName, Type: kind})
 	}
 
-	return NewSchemaProjectorFromQFields(schemaFields, shouldRecordValues)
+	return NewSchemaProjectorFromQFields(schemaFields, excludedColumnSet, shouldRecordValues)
 }
 
 // NewSchemaProjectorFromQFields builds a projector for schema columns whose QKinds are already resolved.
-func NewSchemaProjectorFromQFields(schemaFields []types.QField, shouldRecordValues bool) (*SchemaProjector, error) {
+// excludedColumnSet holds the record field names that are excluded: dropped instead of reported as unexpected.
+func NewSchemaProjectorFromQFields(
+	schemaFields []types.QField, excludedColumnSet map[string]struct{}, shouldRecordValues bool,
+) (*SchemaProjector, error) {
 	fields := make([]types.QField, 0, len(schemaFields)+1)
 	columns := make(map[string]schemaColumn, len(schemaFields))
 
@@ -80,6 +86,7 @@ func NewSchemaProjectorFromQFields(schemaFields []types.QField, shouldRecordValu
 		malformedDataIndex: malformedDataIndex,
 		columns:            columns,
 		shouldRecordValues: shouldRecordValues,
+		excludedColumns:    excludedColumnSet,
 	}, nil
 }
 
@@ -88,9 +95,10 @@ func NewSchemaProjectorFromQFields(schemaFields []types.QField, shouldRecordValu
 // the same resolution connclickhouse.GetTableSchemaForTable applies when reading a table's schema.
 func NewSchemaProjectorFromCHtoQValue(
 	schemaColumns []*protos.ColumnSetting,
+	excludedColumnSet map[string]struct{},
 	shouldRecordValues bool,
 ) (*SchemaProjector, error) {
-	return NewSchemaProjector(connclickhouse.QValueKindForType, schemaColumns, shouldRecordValues)
+	return NewSchemaProjector(connclickhouse.QValueKindForType, schemaColumns, excludedColumnSet, shouldRecordValues)
 }
 
 // QRecordSchema is the schema of the records ProjectRecord produces: the schema columns as declared
@@ -99,6 +107,11 @@ func (sc *SchemaProjector) QRecordSchema() types.QRecordSchema {
 	return types.NewQRecordSchema(slices.Clone(sc.fields))
 }
 
+func (sc *SchemaProjector) IsExcludedColumn(columnName string) bool {
+	_, isExcluded := sc.excludedColumns[columnName]
+	return isExcluded
+}
+
 // ProjectRecord projects a record onto the schema, laid out as QRecordSchema. Every schema column gets
 // the record's value, or a null of the column's kind when the record lacks the field or its value does
 // not match the column's kind. Mismatched values, record fields absent from the schema and repeated
@@ -115,6 +128,11 @@ func (sc *SchemaProjector) ProjectRecord(record iter.Seq2[string, types.QValue])
 	malformedData := NewMalformedData()
 
 	for field, value := range record {
+		// Excluded fields are dropped before anything else: never reported, even when repeated or
+		// declared as a schema column.
+		if sc.IsExcludedColumn(field) {
+			continue
+		}
 		// Only the first occurrence of a field is projected, whatever became of it: any later one is
 		// recorded as malformed data.
 		if _, seen := seenFields[field]; seen {
@@ -129,7 +147,7 @@ func (sc *SchemaProjector) ProjectRecord(record iter.Seq2[string, types.QValue])
 
 		column, isSchemaColumn := sc.columns[field]
 
-		// Record fields not present in the schema are recorded as malformed data.
+		// Record fields not present in the schema are malformed data.
 		if !isSchemaColumn {
 			var recordedValue types.QValue
 			if sc.shouldRecordValues {
```

**File**: `flow/connectors/utils/structured/schema_test.go` (modified, +46/-4)
```diff
@@ -50,7 +50,7 @@ func recordOf(fields ...recordField) iter.Seq2[string, types.QValue] {
 }
 
 func TestNewSchemaProjector(t *testing.T) {
-	projector, err := NewSchemaProjector(testSchemaToQKind, testProjectorColumns(), true)
+	projector, err := NewSchemaProjector(testSchemaToQKind, testProjectorColumns(), nil, true)
 	require.NoError(t, err)
 
 	// the record schema is the columns in their declared order with the kinds schemaToQKind resolved,
@@ -80,14 +80,14 @@ func TestNewSchemaProjectorRejects(t *testing.T) {
 		},
 	} {
 		t.Run(name, func(t *testing.T) {
-			_, err := NewSchemaProjector(testSchemaToQKind, tc.columns, true)
+			_, err := NewSchemaProjector(testSchemaToQKind, tc.columns, nil, true)
 			require.ErrorContains(t, err, tc.offender)
 		})
 	}
 }
 
 func TestProjectRecord(t *testing.T) {
-	projector, err := NewSchemaProjector(testSchemaToQKind, testProjectorColumns(), true)
+	projector, err := NewSchemaProjector(testSchemaToQKind, testProjectorColumns(), nil, true)
 	require.NoError(t, err)
 
 	t.Run("complete record", func(t *testing.T) {
@@ -142,7 +142,7 @@ func TestProjectRecord(t *testing.T) {
 	})
 
 	t.Run("shouldRecordValues=false omits mismatched, unexpected and duplicated values", func(t *testing.T) {
-		blind, err := NewSchemaProjector(testSchemaToQKind, testProjectorColumns(), false)
+		blind, err := NewSchemaProjector(testSchemaToQKind, testProjectorColumns(), nil, false)
 		require.NoError(t, err)
 		values, err := blind.ProjectRecord(recordOf(
 			recordField{"age", types.QValueString{Val: "thirty six"}},
@@ -226,3 +226,45 @@ func TestProjectRecord(t *testing.T) {
 		require.JSONEq(t, `{"email": {"duplicated_fields": true, "value": "lovelace@example.com"}}`, malformed.Val)
 	})
 }
+
+func TestProjectRecordExcludedFields(t *testing.T) {
+	// excluded record fields are dropped silently, while any other field missing from the schema is
+	// still reported as unexpected
+	projector, err := NewSchemaProjector(testSchemaToQKind, testProjectorColumns(),
+		map[string]struct{}{"secret": {}}, true)
+	require.NoError(t, err)
+
+	values, err := projector.ProjectRecord(recordOf(
+		recordField{"name", types.QValueString{Val: "Ada"}},
+		recordField{"secret", types.QValueString{Val: "hidden"}},
+		recordField{"extra", types.QValueString{Val: "surprise"}},
+	))
+	require.NoError(t, err)
+	require.Equal(t, types.QValueString{Val: "Ada"}, values[0])
+	malformed, ok := values[3].(types.QValueJSON)
+	require.True(t, ok)
+	require.JSONEq(t, `{"extra": {"unexpected_field": true, "value": "surprise"}}`, malformed.Val)
+
+	t.Run("an excluded field is dropped even when repeated", func(t *testing.T) {
+		values, err := projector.ProjectRecord(recordOf(
+			recordField{"secret", types.QValueString{Val: "first"}},
+			recordField{"secret", types.QValueString{Val: "second"}},
+		))
+		require.NoError(t, err)
+		require.Equal(t, types.QValueNull(types.QValueKindJSON), values[3])
+	})
+
+	t.Run("an excluded field is dropped even when declared, whatever its value", func(t *testing.T) {
+		declaredAndExcluded, err := NewSchemaProjector(testSchemaToQKind, testProjectorColumns(),
+			map[string]struct{}{"age": {}}, true)
+		require.NoError(t, err)
+		values, err := declaredAndExcluded.ProjectRecord(recordOf(
+			recordField{"name", types.QValueString{Val: "Ada"}},
+			recordField{"age", types.QValueString{Val: "not a number"}},
+		))
+		require.NoError(t, err)
+		// the column keeps its null and the mismatching value is not reported
+		require.Equal(t, types.QValueNull(types.QValueKindInt64), values[1])
+		require.Equal(t, types.QValueNull(types.QValueKindJSON), values[3])
+	})
+}
```

**File**: `flow/e2e/mongo_clickhouse/mongo_test.go` (modified, +90/-0)
```diff
@@ -400,6 +400,96 @@ func (s MongoClickhouseSuite) Test_Structured_Ingestion_Nested_And_Arrays() {
 	e2e.RequireEnvCanceled(t, env)
 }
 
+// Test_Structured_Ingestion_Excluded_Fields covers column exclusions under structured ingestion, on both
+// the initial load and CDC.
+func (s MongoClickhouseSuite) Test_Structured_Ingestion_Excluded_Fields() {
+	t := s.T()
+	srcDatabase := e2e.GetTestDatabase(s.Suffix())
+	srcTable := "test_structured_excluded"
+	dstTable := "test_structured_excluded_dst"
+
+	tableMappings := e2e.TableMappings(s, srcTable, dstTable)
+	tableMappings[0].StructuredIngestionConfig = &protos.StructuredIngestionTableConfig{Enabled: true}
+	tableMappings[0].Columns = []*protos.ColumnSetting{
+		{SourceName: "name", DestinationType: "Nullable(String)"},
+		{SourceName: "age", DestinationType: "Nullable(Int64)"},
+		// declared but excluded: exclusion wins, even over values not fitting the declared type
+		{SourceName: "internal", DestinationType: "Nullable(Int64)"},
+	}
+	tableMappings[0].Exclude = []string{"secret", "internal"}
+	connectionGen := e2e.FlowConnectionGenerationConfig{
+		FlowJobName:   e2e.AddSuffix(s, srcTable),
+		TableMappings: tableMappings,
+		Destination:   s.Peer().Name,
+	}
+	flowConnConfig := s.generateFlowConnectionConfigsDefaultEnv(connectionGen)
+	flowConnConfig.DoInitialSnapshot = true
+
+	adminClient := s.Source().(*e2e.MongoSource).AdminClient()
+	collection := adminClient.Database(srcDatabase).Collection(srcTable)
+	insertDocuments := func(prefix string) {
+		for i := range 10 {
+			res, err := collection.InsertOne(t.Context(), bson.D{
+				{Key: "name", Value: fmt.Sprintf("%s_%d", prefix, i)},
+				{Key: "age", Value: int64(i)},
+				{Key: "secret", Value: fmt.Sprintf("secret_%s_%d", prefix, i)},
+				{Key: "internal", Value: fmt.Sprintf("internal_%s_%d", prefix, i)},
+				// a repeated excluded field is not reported as duplicated either
+				{Key: "secret", Value: "repeated"},
+				// neither declared nor excluded
+				{Key: "extra", Value: fmt.Sprintf("extra_%s_%d", prefix, i)},
+			}, options.InsertOne())
+			require.NoError(t, err)
+			require.True(t, res.Acknowledged)
+		}
+	}
+	insertDocuments("init")
+
+	tc := e2e.NewTemporalClient(t)
+	env := e2e.ExecutePeerflow(t, tc, flowConnConfig)
+
+	e2e.EnvWaitForCount(env, s, "initial load", dstTable, "_id,name", 10)
+
+	e2e.SetupCDCFlowStatusQuery(t, env, flowConnConfig)
+	insertDocuments("cdc")
+
+	e2e.EnvWaitForCount(env, s, "cdc", dstTable, "_id,name", 20)
+
+	peer := s.Peer()
+	ch, err := connclickhouse.Connect(t.Context(), nil, peer.GetClickhouseConfig())
+	require.NoError(t, err)
+	defer ch.Close()
+
+	// excluded fields have no column, declared or not
+	columnNames, err := ch.Query(t.Context(), fmt.Sprintf(
+		"SELECT name FROM system.columns WHERE database = '%s' AND table = '%s' AND name IN ('name', 'age', 'secret', 'internal', 'extra')",
+		peer.GetClickhouseConfig().Database, dstTable))
+	require.NoError(t, err)
+	defer columnNames.Close()
+	var actualColumns []string
+	for columnNames.Next() {
+		var name string
+		require.NoError(t, columnNames.Scan(&name))
+		actualColumns = append(actualColumns, name)
+	}
+	require.NoError(t, columnNames.Err())
+	require.ElementsMatch(t, []string{"name", "age"}, actualColumns)
+
+	// per leg, the declared columns land and only the field neither declared nor excluded is reported
+	for _, prefix := range []string{"init", "cdc"} {
+		var age int64
+		var malformed string
+		require.NoError(t, ch.QueryRow(t.Context(), fmt.Sprintf(
+			`SELECT age, toString(_peerdb_malformed_data) FROM "%s"."%s" FINAL WHERE name = '%s_3'`,
+			peer.GetClickhouseConfig().Database, dstTable, prefix)).Scan(&age, &malformed))
+		require.Equal(t, int64(3), age, prefix)
+		require.JSONEq(t, fmt.Sprintf(`{"extra": {"unexpected_field": true, "value": "extra_%s_3"}}`, prefix), malformed, prefix)
+	}
+
+	env.Cancel(t.Context())
+	e2e.RequireEnvCanceled(t, env)
+}
+
 // Test_QRep_Structured_Ingestion covers structured ingestion on standalone QRep mirrors: invalid
 // configurations are rejected at creation, and a valid one creates the destination table from the
 // declared columns and projects the documents onto it.
```

---

### Incident Patch 4: `3ac458e1` (2026-09-30)
**Commit Message**: fix(structured-ingestion-mongodb) DBI-91: Convert BSON dates to timestamps in structured ingestion (#4876)

BSON DateTime values were converted to their RFC3339 string rendering,
so they never matched DateTime64 columns and every date landed in the
malformed data column as a type_mismatch.

This PR aligns the type using the same time extraction logic as the JSON
encoder in flow/pkg.

:memo: In MongoDB time is stored in UTC
(https://www.mongodb.com/docs/manual/reference/bson-types/#date) this is
reflected in the extraction logic.

**File**: `flow/connectors/mongo/document_projection_test.go` (modified, +37/-0)
```diff
@@ -4,6 +4,7 @@ import (
 	"encoding/json"
 	"errors"
 	"testing"
+	"time"
 
 	"github.com/stretchr/testify/require"
 	"go.mongodb.org/mongo-driver/v2/bson"
@@ -232,6 +233,42 @@ func TestStructuredQValuesFromBsonRaw(t *testing.T) {
 	})
 }
 
+// BSON dates must fit DateTime64 columns: they convert to timestamps
+func TestStructuredQValuesFromBsonRawDates(t *testing.T) {
+	oid, err := bson.ObjectIDFromHex("507f1f77bcf86cd799439011")
+	require.NoError(t, err)
+	projector, err := newStructuredSchemaProjector([]*protos.ColumnSetting{
+		{SourceName: "createdAt", DestinationType: "Nullable(DateTime64(9))"},
+		{SourceName: "label", DestinationType: "Nullable(String)"},
+	}, true)
+	require.NoError(t, err)
+	schema := GetStructuredSchema(projector)
+	createdAt := time.Date(2026, 8, 26, 18, 34, 5, 200_000_000, time.FixedZone("UTC+2", 2*60*60))
+
+	raw, err := bson.Marshal(bson.D{
+		{Key: "_id", Value: oid},
+		{Key: "createdAt", Value: createdAt},
+		{Key: "label", Value: createdAt}, // a date is not a string
+	})
+	require.NoError(t, err)
+	record, err := StructuredQValuesFromBsonRaw(raw, shared.InternalVersion_Latest, NewDirectBsonConverter(), projector, "db.coll")
+	require.NoError(t, err)
+	values := make(map[string]types.QValue, len(record))
+	for i, field := range schema.Fields {
+		values[field.Name] = record[i]
+	}
+
+	require.Equal(t, types.QValueTimestamp{Val: createdAt.UTC()}, values["createdAt"])
+	require.Equal(t, types.QValueNull(types.QValueKindString), values["label"])
+	malformed, ok := values[structured.MalformedDataColumn].(types.QValueJSON)
+	require.True(t, ok, "the date in the String column should be recorded as malformed data")
+	var reported map[string]map[string]any
+	require.NoError(t, json.Unmarshal([]byte(malformed.Val), &reported))
+	require.Equal(t, map[string]map[string]any{
+		"label": {"type_mismatch": true, "value": "2026-08-26T16:34:05.2Z"},
+	}, reported)
+}
+
 // collectDocumentQValues walks doc, returning the yielded fields in order and the walk error.
 func collectDocumentQValues(t *testing.T, doc bson.D) ([]string, map[string]types.QValue, error) {
 	t.Helper()
```

**File**: `flow/connectors/mongo/qvalue_convert.go` (modified, +1/-2)
```diff
@@ -2,7 +2,6 @@ package connmongo
 
 import (
 	"fmt"
-	"time"
 
 	jsoniter "github.com/json-iterator/go"
 	"go.mongodb.org/mongo-driver/v2/bson"
@@ -112,7 +111,7 @@ func (c *DirectBsonConverter) QValueFromBsonValue(rv bson.RawValue, nullKind typ
 		return types.QValueBoolean{Val: v.Boolean()}, nil
 
 	case bsoncore.TypeDateTime:
-		return types.QValueString{Val: v.Time().UTC().Format(time.RFC3339Nano)}, nil
+		return types.QValueTimestamp{Val: shared_mongo.RawDateTimeToTime(v)}, nil
 
 	case bsoncore.TypeNull:
 		return types.QValueNull(nullKind), nil
```

**File**: `flow/connectors/mongo/qvalue_convert_test.go` (modified, +1/-1)
```diff
@@ -765,7 +765,7 @@ func TestQValueFromBsonValue(t *testing.T) {
 		{desc: "Double", input: 3.5, expected: types.QValueFloat64{Val: 3.5}},
 		{desc: "Double integral", input: 3.0, expected: types.QValueFloat64{Val: 3}},
 		{desc: "Boolean", input: true, expected: types.QValueBoolean{Val: true}},
-		{desc: "Date", input: date, expected: types.QValueString{Val: "2024-01-02T01:04:05.006Z"}},
+		{desc: "Date", input: date, expected: types.QValueTimestamp{Val: date.UTC()}},
 		{
 			desc:     "Regular Expression",
 			input:    bson.Regex{Pattern: `^a<b>&"c"$`, Options: "im"},
```

**File**: `flow/pkg/mongo/schema.go` (modified, +7/-1)
```diff
@@ -136,6 +136,12 @@ func RawArrayToJSON(arr bsoncore.Array, stream *jsoniter.Stream) error {
 	return nil
 }
 
+func RawDateTimeToTime(dt bsoncore.Value) time.Time {
+	// DateTime in MongoDB is normalized to UTC.
+	// ref: https://www.mongodb.com/docs/manual/reference/bson-types/#date
+	return dt.Time().UTC()
+}
+
 // RawValueToJSON writes a BSON value to stream as the JSON PeerDB lands MongoDB documents with, following the
 // MongoDB ClickPipes type mapping (https://clickhouse.com/docs/integrations/clickpipes/mongodb/datatypes).
 //
@@ -176,7 +182,7 @@ func RawValueToJSON(v bsoncore.Value, stream *jsoniter.Stream) error {
 
 	case bsoncore.TypeDateTime:
 		stream.WriteRaw(`"`)
-		stream.SetBuffer(v.Time().UTC().AppendFormat(stream.Buffer(), time.RFC3339Nano))
+		stream.SetBuffer(RawDateTimeToTime(v).AppendFormat(stream.Buffer(), time.RFC3339Nano))
 		stream.WriteRaw(`"`)
 
 	case bsoncore.TypeNull:
```

---

### Incident Patch 5: `b2aef2d9` (2026-09-29)
**Commit Message**: fix(mysql) DBI-994: Read source table mappings without joining KEY_COLUMN_USAGE (#4861)

Currently, creating a pipe will run a query to obtain the table columns
and primary keys for tables being ingested as part of the validation
process. This query joins `KEY_COLUMN_USAGE`, which on MySQL 5.7 causes
the table definition files to be read for every table on the instance,
even tables that weren't selected for ingestion.

This PR splits the column metadata query into two. One for obtaining
table columns, and one for obtaining table primary keys. This avoids the
problematic join and bounds the number of table files read to the tables
actually selected for ingestion. The columns side of the old query was
already scoped this way, so the gain comes from the primary key read no
longer scanning every table on the instance. It also avoids the join's
full table opens (`Open_full_table`), since columns and statistics only
need the definition file (`Open_frm_only`).

On a local reproduction of 120 schemas with 100 tables each (see DBI-994
for the repro), requesting 50 tables from a schema reads exactly 50
table definitions (`Opened_table_definitions`), opens no tables at all
(`Opened_tables`), 

**File**: `flow/connectors/mysql/schema_mapping_integration_test.go` (added, +257/-0)
```diff
@@ -0,0 +1,257 @@
+//go:build tilt
+
+package connmysql
+
+import (
+	"fmt"
+	"strconv"
+	"strings"
+	"testing"
+	"time"
+
+	"github.com/stretchr/testify/require"
+
+	"github.com/PeerDB-io/peerdb/flow/pkg/common"
+	mysql_validation "github.com/PeerDB-io/peerdb/flow/pkg/mysql"
+)
+
+type schemaMapping = map[common.QualifiedTable][]string
+
+func TestIntegrationSchemaMappingCaseSensitiveIdentifiers(t *testing.T) {
+	for _, tc := range []struct {
+		name string
+	}{
+		{name: "mysql"},
+		{name: "mariadb"},
+	} {
+		t.Run(tc.name, func(t *testing.T) {
+			t.Parallel()
+			ctx := t.Context()
+			connector := newTestConnector(t, ctx, tc.name)
+
+			// make sure case-sensitive identifiers are supported server-side by the test db
+			rs, err := connector.Execute(ctx, "SELECT @@lower_case_table_names")
+			require.NoError(t, err)
+			lctn, err := rs.GetInt(0, 0)
+			require.NoError(t, err)
+			require.Equal(t, int64(0), lctn,
+				"tables differing only in casing cannot coexist unless lower_case_table_names=0, so this test "+
+					"cannot verify case sensitivity")
+
+			// Two databases differing only by case, each holding two tables differing only by
+			// case.
+			lowerDB := testDBName("cs")
+			upperDB := strings.ToUpper(lowerDB)
+			createTestDB(t, ctx, connector, lowerDB)
+			createTestDB(t, ctx, connector, upperDB)
+
+			exec := func(sql string) {
+				t.Helper()
+				_, err := connector.Execute(ctx, sql)
+				require.NoError(t, err)
+			}
+
+			// The four tables share column names, so a bleed cannot be hidden by a future implementation
+			// which drops columns that the table does not have. Each primary key differs in column set
+			// or order, to catch PK bleeds or when SEQ_IN_INDEX order is not respected.
+			exec(fmt.Sprintf("CREATE TABLE `%s`.`widget` (a INT NOT NULL, b INT NOT NULL, PRIMARY KEY (a))", lowerDB))
+			exec(fmt.Sprintf("CREATE TABLE `%s`.`Widget` (a INT NOT NULL, b INT NOT NULL, PRIMARY KEY (b, a))", lowerDB))
+			exec(fmt.Sprintf("CREATE TABLE `%s`.`widget` (a INT NOT NULL, b INT NOT NULL, PRIMARY KEY (b))", upperDB))
+			exec(fmt.Sprintf("CREATE TABLE `%s`.`Widget` (a INT NOT NULL, b INT NOT NULL, PRIMARY KEY (a, b))", upperDB))
+
+			conn := connector.Conn()
+
+			lowerLower := common.QualifiedTable{Namespace: lowerDB, Table: "widget"}
+			lowerUpper := common.QualifiedTable{Namespace: lowerDB, Table: "Widget"}
+			upperLower := common.QualifiedTable{Namespace: upperDB, Table: "widget"}
+			upperUpper := common.QualifiedTable{Namespace: upperDB, Table: "Widget"}
+
+			// Whole maps are compared rather than single keys, so we catch cases with extra values.
+			for _, tt := range []struct {
+				name      string
+				db        string
+				tables    []string
+				wantCols  schemaMapping
+				wantPKeys schemaMapping
+			}{
+				// One table at a time: the columns of the table differing in casing must not appear.
+				{
+					name: "lowercase alone", db: lowerDB, tables: []string{"widget"},
+					wantCols:  schemaMapping{lowerLower: {"a", "b"}},
+					wantPKeys: schemaMapping{lowerLower: {"a"}},
+				},
+				{
+					name: "capitalised alone", db: lowerDB, tables: []string{"Widget"},
+					wantCols:  schemaMapping{lowerUpper: {"a", "b"}},
+					wantPKeys: schemaMapping{lowerUpper: {"b", "a"}},
+				},
+				// Same test as the alone test cases, but now on the uppercase database.
+				{
+					name: "uppercase database", db: upperDB, tables: []string{"widget"},
+					wantCols:  schemaMapping{upperLower: {"a", "b"}},
+					wantPKeys: schemaMapping{upperLower: {"b"}},
+				},
+				{
+					name: "uppercase database, capitalised table", db: upperDB, tables: []string{"Widget"},
+					wantCols:  schemaMapping{upperUpper: {"a", "b"}},
+					wantPKeys: schemaMapping{upperUpper: {"a", "b"}},
+				},
+				// Both table cases in one call: the IN list in the query must not combine their columns.
+				{
+					name: "both variants", db: lowerDB, tables: []string{"widget", "Widget"},
+					wantCols:  schemaMapping{lowerLower: {"a", "b"}, lowerUpper: {"a", "b"}},
+					wantPKeys: schemaMapping{lowerLower: {"a"}, lowerUpper: {"b", "a"}},
+				},
+			} {
+				got, err := mysql_validation.GetSchemaMapping(conn, tt.db, tt.tables)
+				require.NoError(t, err, tt.name)
+				require.Equal(t, tt.wantCols, got.Columns, tt.name)
+				require.Equal(t, tt.wantPKeys, got.PrimaryKeys, tt.name)
+			}
+		})
+	}
+}
+
+func TestIntegrationSchemaMappingPrimaryKeyVariants(t *testing.T) {
+	for _, tc := range []struct {
+		name string
+	}{
+		{name: "mysql"},
+		{name: "mariadb"},
+	} {
+		t.Run(tc.name, func(t *testing.T) {
+			t.Parallel()
+			ctx := t.Context()
+			connector := newTestConnector(t, ctx, tc.name)
+
+			dbName := testDBName("pk_variants")
+			createTestDB(t, ctx, connector, dbName)
+
+			exec := func(sql string) {
+				t.Helper()
+				_, err := connector.Execute(ctx, sql)
+				require.NoError(t, err)
+			}
+
+			// Composite PK whose key order (b, a) differs from column definition order
+			// (a, b, c), so so
```

**File**: `flow/pkg/mysql/schema_mapping.go` (added, +80/-0)
```diff
@@ -0,0 +1,80 @@
+package mysql
+
+import (
+	"fmt"
+	"strings"
+
+	"github.com/go-mysql-org/go-mysql/client"
+
+	"github.com/PeerDB-io/peerdb/flow/pkg/common"
+)
+
+// SchemaMapping holds the columns (ORDINAL_POSITION order) and primary-key columns
+// (SEQ_IN_INDEX order) of tables in one schema. No primary key means no PrimaryKeys entry.
+type SchemaMapping struct {
+	Columns     map[common.QualifiedTable][]string
+	PrimaryKeys map[common.QualifiedTable][]string
+}
+
+// GetSchemaMapping returns the columns and primary-key columns of the named tables.
+func GetSchemaMapping(conn *client.Conn, schema string, tables []string) (SchemaMapping, error) {
+	mapping := SchemaMapping{
+		Columns:     make(map[common.QualifiedTable][]string),
+		PrimaryKeys: make(map[common.QualifiedTable][]string),
+	}
+	if len(tables) == 0 {
+		return mapping, nil
+	}
+
+	// CASTs are used in this query to ensure that we don't combine columns for tables with the
+	// same name but different letter casings.
+	where := fmt.Sprintf(
+		"WHERE TABLE_SCHEMA = ?"+
+			" AND CAST(TABLE_SCHEMA AS BINARY) = CAST(? AS BINARY)"+
+			" AND CAST(TABLE_NAME AS BINARY) IN (CAST(? AS BINARY)%s)",
+		strings.Repeat(",CAST(? AS BINARY)", len(tables)-1))
+
+	params := make([]any, 0, 2+len(tables))
+	params = append(params, schema, schema)
+	for _, table := range tables {
+		params = append(params, table)
+	}
+
+	// Both queries select (TABLE_NAME, COLUMN_NAME), grouped by the name the server returned so
+	// that tables differing only in casing stay apart.
+	readInto := func(dst map[common.QualifiedTable][]string, query string) error {
+		rs, err := conn.Execute(query, params...)
+		if err != nil {
+			return err
+		}
+		defer rs.Close()
+
+		for _, row := range rs.Values {
+			if len(row) != 2 {
+				return fmt.Errorf("expected 2 columns, got %d", len(row))
+			}
+			key := common.QualifiedTable{Namespace: schema, Table: string(row[0].AsString())}
+			dst[key] = append(dst[key], string(row[1].AsString()))
+		}
+		return nil
+	}
+
+	// These two queries must stay un-joined. Before MySQL 8.0.3 the server prunes its
+	// information_schema scan using WHERE-clause constants only, never a JOIN's ON clause, so a
+	// joined read scans every database and opens tables in full rather than just their definitions.
+	if err := readInto(mapping.Columns,
+		"SELECT TABLE_NAME, COLUMN_NAME FROM information_schema.columns "+where+
+			" ORDER BY TABLE_NAME, ORDINAL_POSITION"); err != nil {
+		return SchemaMapping{}, fmt.Errorf("failed to list columns for schema %s: %w", schema, err)
+	}
+
+	// We opt for statistics instead of using columns.COLUMN_KEY because the latter also reports PRI for a
+	// UNIQUE NOT NULL column on a table with no primary key.
+	if err := readInto(mapping.PrimaryKeys,
+		"SELECT TABLE_NAME, COLUMN_NAME FROM information_schema.statistics "+where+
+			" AND INDEX_NAME = 'PRIMARY' ORDER BY TABLE_NAME, SEQ_IN_INDEX"); err != nil {
+		return SchemaMapping{}, fmt.Errorf("failed to list primary keys for schema %s: %w", schema, err)
+	}
+
+	return mapping, nil
+}
```

**File**: `flow/pkg/mysql/schema_mapping_test.go` (added, +19/-0)
```diff
@@ -0,0 +1,19 @@
+package mysql
+
+import (
+	"testing"
+
+	"github.com/stretchr/testify/require"
+)
+
+func TestGetSchemaMappingNoTables(t *testing.T) {
+	t.Parallel()
+	// Potential callers can't call this with an empty list today, but this is an
+	// exported function in a shared module, so let's handle it gracefully.
+	got, err := GetSchemaMapping(nil, "shop", nil)
+	require.NoError(t, err)
+	require.Empty(t, got.Columns)
+	require.Empty(t, got.PrimaryKeys)
+	require.NotNil(t, got.Columns, "callers index into these maps")
+	require.NotNil(t, got.PrimaryKeys)
+}
```

---

### Incident Patch 6: `09275a3a` (2026-09-29)
**Commit Message**: fix(bigquery): skip query CDC polls inside safety lag (#4832)

## What changed

- move query CDC safety-window calculation into `queryCDCPullSyncLoop`
- skip polling before recording `RecordQueryCDCAttempt` or
`RecordQueryCDCSync` when the checkpoint is still inside the safety lag
- wait until the checkpoint clears the safety lag before checking again
- pass the validated time window to the BigQuery connector while
preserving query mode’s bounded empty-window scan
- move timestamp cursor encoding/decoding into the shared query CDC
model

**File**: `flow/activities/flowable_query_cdc.go` (modified, +43/-2)
```diff
@@ -191,6 +191,18 @@ func queryCDCPollDurations(
 	return safetyLag, maxQueryWindow, nil
 }
 
+// queryCDCPollWindow computes the next bounded source-time window. A false
+// return means the safety lag has not moved past the table's checkpoint yet.
+func queryCDCPollWindow(
+	checkpoint, now time.Time, safetyLag, maxQueryWindow time.Duration,
+) (time.Time, bool) {
+	end := checkpoint.Add(maxQueryWindow)
+	if safeEnd := now.Add(-safetyLag); safeEnd.Before(end) {
+		end = safeEnd
+	}
+	return end, end.After(checkpoint)
+}
+
 // queryCDCPollWait mirrors bigquery/cdc.go's checkpoint.nextPollWait,
 // generalized to the activity level: a table is due once syncInterval has
 // passed since its last successful poll started. LastSyncedAt distinguishes a
@@ -337,6 +349,8 @@ func (a *FlowableActivity) queryCDCPullSyncLoop(
 		stream := model.NewCDCStream[model.RecordItems](channelBufferSize)
 		var pullResult model.PullTableRecordsResult
 		var rowCounts *model.RecordTypeCounts
+		pollSkipped := false
+		var safetyLagWait time.Duration
 		pollErr, fatalErr := func() (error, error) {
 			// bounded parallelism: only pull+sync for up to parallelism tables at once
 			release, err := acquire(ctx, pullSyncSem, logger, "pull-sync")
@@ -345,6 +359,25 @@ func (a *FlowableActivity) queryCDCPullSyncLoop(
 			}
 			defer release()
 
+			now, err := srcConn.CurrentSourceTime(ctx)
+			if err != nil {
+				return fmt.Errorf("failed to get query CDC source time: %w", err), nil
+			}
+			start, err := model.DecodeQueryCDCCursor(state.CursorText)
+			if err != nil {
+				return err, nil
+			}
+			if start.IsZero() {
+				start = now
+			}
+			safeEnd := now.Add(-queryCDCSafetyLag)
+			end, ok := queryCDCPollWindow(start, now, queryCDCSafetyLag, queryCDCMaxQueryWindow)
+			if !ok {
+				pollSkipped = true
+				safetyLagWait = start.Sub(safeEnd)
+				return nil, nil
+			}
+
 			logger.Info("[cdc] starting poll")
 			if err := pgMetadata.RecordQueryCDCAttempt(ctx, flowName, sourceTable, time.Now()); err != nil {
 				return nil, err
@@ -359,8 +392,9 @@ func (a *FlowableActivity) queryCDCPullSyncLoop(
 					SourceTableIdentifier:  sourceTable,
 					SourceTableMapping:     sourceTableMapping,
 					TableSchema:            tableNameSchemaMapping[destTable],
-					Cursor:                 state.CursorText,
-					QueryCDCSafetyLag:      queryCDCSafetyLag,
+					StartTime:              start,
+					EndTime:                end,
+					SafeEndTime:            safeEnd,
 					QueryCDCMaxQueryWindow: queryCDCMaxQueryWindow,
 					Stream:                 stream,
 				})
@@ -409,6 +443,13 @@ func (a *FlowableActivity) queryCDCPullSyncLoop(
 		if fatalErr != nil {
 			return a.Alerter.LogFlowError(ctx, flowName, fatalErr)
 		}
+		if pollSkipped {
+			logger.Info("[cdc] waiting for checkpoint to clear safety lag", slog.Duration("wait", safetyLagWait))
+			if err := waitOrDone(ctx, safetyLagWait); err != nil {
+				return err
+			}
+			continue
+		}
 		if pollErr != nil {
 			if ctx.Err() != nil {
 				return ctx.Err()
```

**File**: `flow/activities/flowable_query_cdc_test.go` (modified, +31/-0)
```diff
@@ -38,6 +38,37 @@ func TestQueryCDCPollWait(t *testing.T) {
 	})
 }
 
+func TestQueryCDCPollWindow(t *testing.T) {
+	checkpoint := time.Date(2026, 8, 1, 0, 0, 0, 0, time.UTC)
+	const safetyLag = time.Minute
+	const maxQueryWindow = 24 * time.Hour
+
+	t.Run("caps at max query window", func(t *testing.T) {
+		end, ok := queryCDCPollWindow(checkpoint, checkpoint.Add(maxQueryWindow*10), safetyLag, maxQueryWindow)
+		require.True(t, ok)
+		require.Equal(t, checkpoint.Add(maxQueryWindow), end)
+	})
+
+	t.Run("caps at safety lag", func(t *testing.T) {
+		now := checkpoint.Add(time.Hour)
+		end, ok := queryCDCPollWindow(checkpoint, now, safetyLag, maxQueryWindow)
+		require.True(t, ok)
+		require.Equal(t, now.Add(-safetyLag), end)
+	})
+
+	t.Run("skips while safety lag has not cleared", func(t *testing.T) {
+		end, ok := queryCDCPollWindow(checkpoint, checkpoint.Add(safetyLag/2), safetyLag, maxQueryWindow)
+		require.False(t, ok)
+		require.False(t, end.After(checkpoint))
+	})
+
+	t.Run("skips exactly at safety lag boundary", func(t *testing.T) {
+		end, ok := queryCDCPollWindow(checkpoint, checkpoint.Add(safetyLag), safetyLag, maxQueryWindow)
+		require.False(t, ok)
+		require.Equal(t, checkpoint, end)
+	})
+}
+
 func TestQueryCDCRetryWait(t *testing.T) {
 	t.Run("exponential backoff capped at one minute", func(t *testing.T) {
 		wait := time.Duration(0)
```

**File**: `flow/connectors/bigquery/cdc.go` (modified, +7/-48)
```diff
@@ -75,16 +75,6 @@ func (c *BigQueryConnector) EnsurePullability(
 	return nil, nil
 }
 
-// pollWindow computes the upper bound of the next bounded poll window given the
-// last-scanned checkpoint and BigQuery's current clock (now).
-func pollWindow(checkpoint, now time.Time, safetyLag, maxQueryWindow time.Duration) (time.Time, bool) {
-	upper := checkpoint.Add(maxQueryWindow)
-	if safe := now.Add(-safetyLag); safe.Before(upper) {
-		upper = safe
-	}
-	return upper, upper.After(checkpoint)
-}
-
 func pullQueryWindows(
 	start, upper, safeUpper time.Time,
 	maxQueryWindow time.Duration,
@@ -114,19 +104,8 @@ func pullQueryWindows(
 	}
 }
 
-func EncodeBigQueryTableCursor(t time.Time) string {
-	return t.UTC().Format(time.RFC3339Nano)
-}
-
-func DecodeBigQueryTableCursor(cursor string) (time.Time, error) {
-	if cursor == "" {
-		return time.Time{}, nil
-	}
-	t, err := time.Parse(time.RFC3339Nano, cursor)
-	if err != nil {
-		return time.Time{}, fmt.Errorf("failed to parse BigQuery CDC table cursor %q: %w", cursor, err)
-	}
-	return t, nil
+func (c *BigQueryConnector) CurrentSourceTime(ctx context.Context) (time.Time, error) {
+	return c.currentBigQueryTimestamp(ctx)
 }
 
 // PullTableRecords implements connectors.QueryCDCPullConnector. It pulls a
@@ -155,26 +134,6 @@ func (c *BigQueryConnector) PullTableRecords(
 			slog.Float64("elapsedMinutes", time.Since(pullStartedAt).Minutes()))
 	}()
 
-	now, err := c.currentBigQueryTimestamp(ctx)
-	if err != nil {
-		return model.PullTableRecordsResult{}, fmt.Errorf("failed to get current BigQuery timestamp: %w", err)
-	}
-
-	start, err := DecodeBigQueryTableCursor(req.Cursor)
-	if err != nil {
-		return model.PullTableRecordsResult{}, err
-	}
-	if start.IsZero() {
-		// seed from now if cursor is empty (first poll for this table).
-		start = now
-	}
-
-	upper, ok := pollWindow(start, now, req.QueryCDCSafetyLag, req.QueryCDCMaxQueryWindow)
-	if !ok {
-		// No safe window to scan yet; cursor is unchanged.
-		return model.PullTableRecordsResult{NextCursor: req.Cursor}, nil
-	}
-
 	cfg, err := internal.FetchConfigFromDB(ctx, catalogPool, req.FlowJobName)
 	if err != nil {
 		return model.PullTableRecordsResult{}, fmt.Errorf("failed to fetch flow config from db: %w", err)
@@ -217,21 +176,21 @@ func (c *BigQueryConnector) PullTableRecords(
 	}
 	columns := pullColumnNames(req.TableSchema, req.SourceTableMapping.Exclude)
 
-	nextCursor := upper
+	nextCursor := req.EndTime
 	if cfg.GetBigqueryCdcConfig().GetReplicationMethod() == protos.BigQueryReplicationMethod_BIGQUERY_REPLICATION_METHOD_QUERY {
 		bytesProcessed, nextCursor, err = pullQueryWindows(
-			start, upper, now.Add(-req.QueryCDCSafetyLag), req.QueryCDCMaxQueryWindow,
+			req.StartTime, req.EndTime, req.SafeEndTime, req.QueryCDCMaxQueryWindow,
 			func(queryStart, queryUpper time.Time) (int64, time.Time, error) {
 				return c.pullTableQuery(ctx, tm.QueryCdcWatermarkColumn,
 					req.SourceTableIdentifier, req.SourceTableMapping.Name, columns, queryStart, queryUpper, addRecord)
 			},
 		)
 	} else if tm.BigqueryCdcEventsFunction == protos.BigqueryCdcEventsFunction_BIGQUERY_CDC_EVENTS_FUNCTION_CHANGES {
 		bytesProcessed, err = c.pullTableChanges(ctx, req.SourceTableIdentifier,
-			req.SourceTableMapping.Name, columns, start, upper, addRecord)
+			req.SourceTableMapping.Name, columns, req.StartTime, req.EndTime, addRecord)
 	} else if tm.BigqueryCdcEventsFunction == protos.BigqueryCdcEventsFunction_BIGQUERY_CDC_EVENTS_FUNCTION_APPENDS {
 		bytesProcessed, err = c.pullTableAppends(ctx, req.SourceTableIdentifier,
-			req.SourceTableMapping.Name, columns, start, upper, addRecord)
+			req.SourceTableMapping.Name, columns, req.StartTime, req.EndTime, addRecord)
 	} else {
 		// unreachable, but just in case throw an error instead of silently returning an empty result
 		return model.PullTableRecordsResult{}, fmt.Errorf("unsupported BigQuery CDC events function: %v", tm.BigqueryCdcEventsFunction)
@@ -241,7 +200,7 @@ func (c *BigQueryConnector) PullTableRecords(
 	}
 
 	return model.PullTableRecordsResult{
-		NextCursor:     EncodeBigQueryTableCursor(nextCursor),
+		NextCursor:     model.EncodeQueryCDCCursor(nextCursor),
 		BytesProcessed: bytesProcessed,
 	}, nil
 }
```

**File**: `flow/connectors/bigquery/cdc_test.go` (modified, +0/-37)
```diff
@@ -15,43 +15,6 @@ import (
 	"github.com/PeerDB-io/peerdb/flow/shared/types"
 )
 
-func TestPollWindow(t *testing.T) {
-	checkpoint := time.Date(2026, 8, 1, 0, 0, 0, 0, time.UTC)
-	const safetyLag = time.Minute
-	const maxQueryWindow = 24 * time.Hour
-
-	t.Run("caps at maxQueryWindow past checkpoint when now is far ahead", func(t *testing.T) {
-		now := checkpoint.Add(maxQueryWindow * 10)
-		upper, ok := pollWindow(checkpoint, now, safetyLag, maxQueryWindow)
-		require.True(t, ok)
-		assert.True(t, upper.Equal(checkpoint.Add(maxQueryWindow)))
-	})
-
-	t.Run("caps at safetyLag behind now when now is close", func(t *testing.T) {
-		now := checkpoint.Add(time.Hour)
-		upper, ok := pollWindow(checkpoint, now, safetyLag, maxQueryWindow)
-		require.True(t, ok)
-		assert.True(t, upper.Equal(now.Add(-safetyLag)))
-	})
-
-	t.Run("nothing new to scan when safety lag hasn't cleared", func(t *testing.T) {
-		now := checkpoint.Add(safetyLag / 2)
-		upper, ok := pollWindow(checkpoint, now, safetyLag, maxQueryWindow)
-		assert.False(t, ok)
-		// upper is still reported (as now-safetyLag), just not usable, since it
-		// doesn't move past checkpoint.
-		assert.True(t, upper.Equal(now.Add(-safetyLag)))
-		assert.False(t, upper.After(checkpoint))
-	})
-
-	t.Run("exactly at the boundary is not ok (upper must strictly move past checkpoint)", func(t *testing.T) {
-		now := checkpoint.Add(safetyLag)
-		upper, ok := pollWindow(checkpoint, now, safetyLag, maxQueryWindow)
-		assert.False(t, ok)
-		assert.True(t, upper.Equal(checkpoint))
-	})
-}
-
 func TestPullQueryWindows(t *testing.T) {
 	start := time.Date(2026, 8, 1, 0, 0, 0, 0, time.UTC)
 	const window = 24 * time.Hour
```

**File**: `flow/connectors/bigquery/qrep_object_pull.go` (modified, +1/-1)
```diff
@@ -602,7 +602,7 @@ func (c *BigQueryConnector) SetupReplication(
 	if cfg.GetBigqueryCdcConfig() != nil {
 		for sourceTableIdentifier, checkpoint := range checkpointByTable {
 			if err := c.InitializeQueryCDCReplicationState(
-				ctx, req.FlowJobName, sourceTableIdentifier, EncodeBigQueryTableCursor(checkpoint),
+				ctx, req.FlowJobName, sourceTableIdentifier, model.EncodeQueryCDCCursor(checkpoint),
 			); err != nil {
 				return model.SetupReplicationResult{}, fmt.Errorf(
 					"failed to initialize CDC checkpoint for table %s: %w", sourceTableIdentifier, err)
```

**File**: `flow/connectors/core.go` (modified, +4/-1)
```diff
@@ -143,9 +143,12 @@ type CDCPullConnector interface {
 type QueryCDCPullConnector interface {
 	CDCPullConnectorCore
 
+	// CurrentSourceTime returns the source clock used to calculate safe pull windows.
+	CurrentSourceTime(ctx context.Context) (time.Time, error)
+
 	// PullTableRecords pulls whatever is newly available for one source table
 	// and streams it into req.Stream. This method should be idempotent given
-	// the same req.Cursor.
+	// the same time window.
 	PullTableRecords(
 		ctx context.Context,
 		catalogPool shared.CatalogPool,
```

**File**: `flow/model/model.go` (modified, +22/-5)
```diff
@@ -3,6 +3,7 @@ package model
 import (
 	"context"
 	"crypto/sha256"
+	"fmt"
 	"sync/atomic"
 	"time"
 
@@ -118,11 +119,12 @@ type PullTableRecordsRequest struct {
 	SourceTableMapping SourceTableMapping
 	// TableSchema is the schema of the destination table.
 	TableSchema *protos.TableSchema
-	// Cursor is the opaque value previously returned for this table by
-	// PullTableRecordsResult.NextCursor, empty for a table pulled for the first time.
-	Cursor string
-	// QueryCDCSafetyLag delays the upper bound of the pull window behind the source clock.
-	QueryCDCSafetyLag time.Duration
+	// StartTime and EndTime are the safe source-time window selected by the activity.
+	StartTime time.Time
+	EndTime   time.Time
+	// SafeEndTime is the furthest source time this poll may inspect. Query-mode
+	// sources use it to skip across empty bounded windows without crossing the safety lag.
+	SafeEndTime time.Time
 	// QueryCDCMaxQueryWindow caps the duration covered by a single pull query.
 	QueryCDCMaxQueryWindow time.Duration
 	// Stream is where pulled records are pushed.
@@ -138,6 +140,21 @@ type PullTableRecordsResult struct {
 	BytesProcessed int64
 }
 
+func EncodeQueryCDCCursor(t time.Time) string {
+	return t.UTC().Format(time.RFC3339Nano)
+}
+
+func DecodeQueryCDCCursor(cursor string) (time.Time, error) {
+	if cursor == "" {
+		return time.Time{}, nil
+	}
+	t, err := time.Parse(time.RFC3339Nano, cursor)
+	if err != nil {
+		return time.Time{}, fmt.Errorf("failed to parse query CDC table cursor %q: %w", cursor, err)
+	}
+	return t, nil
+}
+
 // SyncQueryCDCRequest carries one table's CDC records to
 // QueryCDCSyncConnector.SyncQueryCDC, which stages them (e.g. as Avro on
 // S3/GCS) under BatchID, this table's own batch sequence, independent of
```

---

### Incident Patch 7: `b384c290` (2026-09-29)
**Commit Message**: Fix CDC flow setup flake (#4868)

**File**: `flow/e2e/test_utils.go` (modified, +1/-1)
```diff
@@ -291,7 +291,7 @@ func SetupCDCFlowStatusQuery(t *testing.T, env WorkflowRun, config *protos.FlowC
 		if err == nil {
 			if status == protos.FlowStatus_STATUS_RUNNING || status == protos.FlowStatus_STATUS_COMPLETED {
 				return
-			} else if counter > 60 {
+			} else if counter > 120 {
 				env.Cancel(t.Context())
 				t.Fatal("UNEXPECTED STATUS TIMEOUT", status)
 			}
```

---

### Incident Patch 8: `c9ab04d4` (2026-09-29)
**Commit Message**: Fix SSH tunnel test CI flake: enable TCP forwarding via sshd_config.d instead of a DOCKER_MOD (#4867)

**File**: `ancillary-docker-compose.yml` (modified, +2/-1)
```diff
@@ -308,7 +308,8 @@ services:
       - USER_NAME=testuser
       - USER_PASSWORD=testpass
       - PASSWORD_ACCESS=true
-      - DOCKER_MODS=linuxserver/mods:openssh-server-ssh-tunnel
+    volumes:
+      - ./local_provision_scripts/openssh-config/sshd_config.d:/config/sshd/sshd_config.d:ro
     extra_hosts:
       - "host.docker.internal:host-gateway"
     healthcheck:
```

**File**: `local_provision_scripts/openssh-config/sshd_config.d/tunnel.conf` (added, +3/-0)
```diff
@@ -0,0 +1,3 @@
+# Replaces the linuxserver/mods:openssh-server-ssh-tunnel DOCKER_MOD, which is
+# fetched from lscr.io at container start and silently skipped when that fails.
+AllowTcpForwarding yes
```

---

### Incident Patch 9: `4394ca8c` (2026-09-29)
**Commit Message**: Fix flaky Test_BigQuery_CDC_Query_Mode_Multi_File_Batch: make every CDC row exceed the Avro file limit (#4866)

**File**: `flow/e2e/bigquery_clickhouse/bigquery_cdc_test.go` (modified, +14/-14)
```diff
@@ -591,9 +591,7 @@ func (s BigQueryClickhouseSuite) Test_BigQuery_CDC_Query_Mode_Multi_File_Batch()
 		replicationMethod: protos.BigQueryReplicationMethod_BIGQUERY_REPLICATION_METHOD_QUERY,
 		watermarkColumn:   "updated_at",
 	})
-	// The first CDC row is much larger than this limit, while the two small rows
-	// fit together in the next file. This guarantees multiple non-empty chunks
-	// without ending exactly on a chunk boundary.
+	// Every CDC row exceeds this limit, so the batch splits regardless of row order.
 	flowConnConfig.Env["PEERDB_S3_BYTES_PER_AVRO_FILE"] = "4096"
 	flowConnConfig.Env["PEERDB_S3_UUID_PREFIX"] = "false"
 
@@ -606,13 +604,15 @@ func (s BigQueryClickhouseSuite) Test_BigQuery_CDC_Query_Mode_Multi_File_Batch()
 	// Use one explicit watermark for every row to emulate a daily ingestion job
 	// that makes a large batch visible at a single watermark timestamp.
 	watermark := time.Now().UTC().Format("2006-01-02 15:04:05.999999")
-	largeValue := strings.Repeat("a", 16*1024)
+	largeValueA := strings.Repeat("a", 16*1024)
+	largeValueB := strings.Repeat("b", 16*1024)
+	largeValueC := strings.Repeat("c", 16*1024)
 	require.NoError(t, source.Exec(ctx, fmt.Sprintf(`
 		INSERT INTO %s (id, val, updated_at) VALUES
 			(2, '%s', TIMESTAMP '%s'),
-			(3, 'b', TIMESTAMP '%s'),
-			(4, 'c', TIMESTAMP '%s')`,
-		quoteBigQueryTableFQN(tableFQN), largeValue, watermark, watermark, watermark)))
+			(3, '%s', TIMESTAMP '%s'),
+			(4, '%s', TIMESTAMP '%s')`,
+		quoteBigQueryTableFQN(tableFQN), largeValueA, watermark, largeValueB, watermark, largeValueC, watermark)))
 
 	e2e.EnvWaitFor(t, env, 4*time.Minute, "multi-file CDC batch normalized", func() bool {
 		rows, err := s.GetRows(dstTable, "id,val")
@@ -630,13 +630,12 @@ func (s BigQueryClickhouseSuite) Test_BigQuery_CDC_Query_Mode_Multi_File_Batch()
 	}
 	require.Equal(t, map[int64]string{
 		1: "pre-snapshot",
-		2: largeValue,
-		3: "b",
-		4: "c",
+		2: largeValueA,
+		3: largeValueB,
+		4: largeValueC,
 	}, valByID)
 
-	// Staged S3 objects are retained after normalization. The oversized first
-	// record and the two smaller records in batch 1 must produce two data chunks.
+	// Staged S3 objects are retained after normalization.
 	s3Helper := s.GenericSuite.(e2e.ClickHouseSuite).S3Helper()
 	stagedObjects, err := s3Helper.ListAllFiles(ctx, flowConnConfig.FlowJobName)
 	require.NoError(t, err)
@@ -647,8 +646,9 @@ func (s BigQueryClickhouseSuite) Test_BigQuery_CDC_Query_Mode_Multi_File_Batch()
 			cdcFileKeys = append(cdcFileKeys, *object.Key)
 		}
 	}
-	require.Len(t, cdcFileKeys, 2, "one logical CDC batch should be split into two staged Avro files")
-	for chunk := range 2 {
+	require.GreaterOrEqual(t, len(cdcFileKeys), 2,
+		"one logical CDC batch should be split into multiple staged Avro files; staged objects: %v", cdcFileKeys)
+	for chunk := range cdcFileKeys {
 		require.Condition(t, func() bool {
 			expectedSuffix := fmt.Sprintf("%s%06d.avro", cdcFilePrefix, chunk)
 			return slices.ContainsFunc(cdcFileKeys, func(key string) bool {
```

---

### Incident Patch 10: `edceff09` (2026-09-28)
**Commit Message**: Fix flaky `TestPullRecordsWorkerPoolErrorFromWorker`: return worker errors from `Flush` reliably (#4865)

**File**: `flow/shared/concurrency/workers.go` (modified, +4/-1)
```diff
@@ -98,6 +98,9 @@ func (p *PullRecordsWorkerPool[E, D, RT]) Flush(ctx context.Context) error {
 		// Nothing to do.
 		return nil
 	}
+	if err := p.workerCtx.Err(); err != nil {
+		return context.Cause(p.workerCtx)
+	}
 	// Grab a slot in the semaphore.
 	select {
 	case p.sem <- struct{}{}:
@@ -111,7 +114,7 @@ func (p *PullRecordsWorkerPool[E, D, RT]) Flush(ctx context.Context) error {
 			p.ctxCancel()
 			return ctx.Err()
 		case <-p.workerCtx.Done():
-			return nil
+			return context.Cause(p.workerCtx)
 		}
 		p.eg.Go(func() error {
 			defer func() {
```

---

### Incident Patch 11: `df4f2691` (2026-09-24)
**Commit Message**: Split Flow CI into granular jobs with `tilt` build tag and a strict unit test job; switch minio->silo (#4849)

Combine the best parts of #4812 and #4820, staying friendly to Go
conventions. Do test selection at a package level (splitting `e2e` into
subpackages), introduce one build tag `tilt`, pick integration tests
strictly (via diffing the test list with and without the tag). Decided
to separate PG->CH, PG->PG vs PG->Other jobs (so 3x6 total instead of
3x5) as PG was the longest one in previous PRs. Will split MySQL and
Maria in a separate change.

Split by commit:

### 1. Isolate tests that configure their database

```text
MySQL RDS binlog test  → pinned mysql:9.5 testcontainer
Cockroach rangefeed    → CockroachDB testcontainer
```

MySQL test was the reason e2e package got merged together (to run
without t.Parallel and assume ownership of the db instance),
testcontainers provide another way to do this. Cockroach test was
introducing CI flakes and is also implemented best as a testcontainer.

### 2. Tag test files that need live services

```text
flow/{connectors,db,alerting,model}/
  untagged tests                 → unit tier
  //go:build tilt tests          → e2e/integration 

**File**: `.claude/skills/local-debug/SKILL.md` (modified, +7/-7)
```diff
@@ -42,19 +42,19 @@ If a service fails to come up after **two** re-triggers, stop retrying and inspe
 Direct `go test`:
 
 ```bash
-cd flow && go test -count=1 -v -run '<TestPattern>/<SubTest>' ./e2e/
+cd flow && go test -tags tilt -count=1 -v -run '<TestPattern>/<SubTest>' ./e2e/mysql_clickhouse/
 ```
 
 or
 
 ```bash
-cd flow && go test -count=1 -v -run '<TestPattern>/<SubTest>' ./connectors/
+cd flow && go test -tags tilt -count=1 -v -run '<TestPattern>/<SubTest>' ./connectors/mysql/...
 ```
 
 Note: For MySQL tests, set the flavor overrides:
 
 ```bash
-CI_MYSQL_PORT=3306 CI_MYSQL_VERSION=mysql-gtid go test -count=1 -v -run TestGenericCH_MySQL ./e2e/
+CI_MYSQL_PORT=3306 CI_MYSQL_VERSION=mysql-gtid go test -tags tilt -count=1 -v -run TestGenericCH_MySQL ./e2e/mysql_clickhouse/
 ```
 
 ## Step 3: Diagnose the failure
@@ -83,7 +83,7 @@ tilt --port 10352 logs --since 5m <database-resource>
 ### Read the test code
 
 Test code lives in:
-- `flow/e2e/` -- e2e test files (`*_test.go`) and helpers (`clickhouse.go`, `pg.go`, `mysql.go`, `mongo.go`, `test_utils.go`)
+- `flow/e2e/<source>_<destination>/` -- e2e test files; `flow/e2e/` holds shared suites (`*_test.go`) and helpers (`clickhouse.go`, `pg.go`, `mysql.go`, `mongo.go`, `test_utils.go`)
 - `flow/connectors/*/` -- connector-specific tests
 - `flow/e2eshared/` -- shared test utilities (`RunSuite`, `CheckQRecordEquality`)
 
@@ -93,7 +93,7 @@ Use `Grep` and `Read` to find the failing test function, understand what it does
 
 1. **Narrow the test pattern** to run only the failing subtest:
    ```bash
-   cd flow && go test -count=1 -v -run 'TestGenericCH_PG/TestSpecificSubtest' ./e2e/
+   cd flow && go test -tags tilt -count=1 -v -run 'TestGenericCH_PG/TestSpecificSubtest' ./e2e/postgres_clickhouse/
    ```
 
 2. **Clear test cache** if you suspect stale results:
@@ -103,7 +103,7 @@ Use `Grep` and `Read` to find the failing test function, understand what it does
 
 3. **Check compilation** after code changes:
    ```bash
-   cd flow && go vet ./e2e/ ./connectors/...
+   cd flow && go vet ./e2e/... ./connectors/...
    ```
 
 4. **Re-run the test** to verify the fix. Use `-count=1` to bypass caching.
@@ -122,4 +122,4 @@ When the user provides `$ARGUMENTS`:
 - If it matches a **Go test name** (e.g., `TestGenericCH_PG`, `TestPeerFlowE2ETestSuitePG_CH`): find the test code, ensure infrastructure is ready, run it, and analyze failures.
 - If it's a **connector name** (e.g., `postgres`, `clickhouse`, `mysql`, `mongo`): debug the corresponding `connector_<name>` test resource.
 - If it describes a **symptom** (e.g., "connection refused", "timeout", "flaky"): follow the diagnostic patterns above.
-- If empty or ambiguous: check overall infrastructure health and ask which test to debug.
\ No newline at end of file
+- If empty or ambiguous: check overall infrastructure health and ask which test to debug.
```

**File**: `.claude/skills/tilt/SKILL.md` (modified, +8/-8)
```diff
@@ -54,14 +54,14 @@ Tilt manages Docker Compose services defined in `docker-compose-dev.yml` (core P
 
 ### Test resources and their dependencies
 
-**E2E tests** (run `go test ./e2e/` with a specific `-run` pattern):
+**E2E tests** (run `go test -tags tilt ./e2e/<source>_<destination>/` with a specific `-run` pattern):
 
 | Resource | Test pattern | Required ancillary DBs |
 |----------|-------------|----------------------|
 | `e2e_postgres` | `TestGenericCH_PG` | postgres, clickhouse |
 | `e2e_mysql-gtid` | `TestGenericCH_MySQL` | mysql-gtid, clickhouse |
 | `e2e_mysql-pos` | `TestGenericCH_MySQL` | mysql-pos, clickhouse |
-| `e2e_mariadb` | `TestGenericCH_MySQL` | mariadb, clickhouse |
+| `e2e_mariadb` | `TestGenericCH_MariaDB` | mariadb, clickhouse |
 | `e2e_mongodb` | `TestMongoClickhouseSuite` | mongodb, clickhouse |
 | `e2e_switchboard-postgres` | `TestSwitchboardPostgres` | postgres, clickhouse |
 | `e2e_switchboard-mysql-gtid` | `TestSwitchboardMySQL` | mysql-gtid, clickhouse |
@@ -71,16 +71,16 @@ Tilt manages Docker Compose services defined in `docker-compose-dev.yml` (core P
 | `e2e_peer-flow-postgres` | `^TestPeerFlowE2ETestSuitePG_CH$` | postgres, clickhouse |
 | `e2e_peer-flow-mysql-gtid` | `^TestPeerFlowE2ETestSuiteMySQL_CH$` | mysql-gtid, clickhouse |
 | `e2e_peer-flow-mysql-pos` | `^TestPeerFlowE2ETestSuiteMySQL_CH$` | mysql-pos, clickhouse |
-| `e2e_peer-flow-mariadb` | `^TestPeerFlowE2ETestSuiteMySQL_CH$` | mariadb, clickhouse |
+| `e2e_peer-flow-mariadb` | `^TestPeerFlowE2ETestSuiteMariaDB_CH$` | mariadb, clickhouse |
 | `e2e_api-postgres` | `TestApiPg` | postgres, clickhouse |
-| `e2e_api-mysql-gtid` | `TestApiMy` | mysql-gtid, postgres, clickhouse |
-| `e2e_api-mysql-pos` | `TestApiMy` | mysql-pos, postgres, clickhouse |
-| `e2e_api-mariadb` | `TestApiMy` | mariadb, postgres, clickhouse |
+| `e2e_api-mysql-gtid` | `TestApiMy` | mysql-gtid, clickhouse |
+| `e2e_api-mysql-pos` | `TestApiMy` | mysql-pos, clickhouse |
+| `e2e_api-mariadb` | `TestApiMariaDB` | mariadb, clickhouse |
 | `e2e_api-mongodb` | `TestApiMongo` | mongodb, clickhouse |
 
 All e2e tests also depend on core PeerDB services: `flow-api`, `flow-worker`, `catalog`, and `provision-clickhouse`.
 
-**Connector tests** (run `go test ./connectors/<connector>/...`):
+**Connector tests** (run `go test -tags tilt ./connectors/<connector>/...`):
 
 | Resource | Package | Required ancillary DBs |
 |----------|---------|----------------------|
@@ -203,4 +203,4 @@ The Tilt UI also has a "Wipe ancillary volumes" button in the nav bar that remov
 - When streaming logs with `-f`, use a timeout or `--since` to avoid blocking indefinitely.
 - If a test fails with "connection refused" or similar, the most likely cause is that the required database wasn't enabled/provisioned.
 - Always one resource per tilt command for actions like `trigger`. For multiple, run separate commands or use a loop in bash.
-- When starting resources, it is not enough with enabling them, you need to trigger them.
\ No newline at end of file
+- When starting resources, it is not enough with enabling them, you need to trigger them.
```

**File**: `.env.example` (modified, +3/-3)
```diff
@@ -13,11 +13,11 @@ CI_CLICKHOUSE_NATIVE_PORT=11000
 # Native protocol over TLS, exercised by TestClickHouseTLSDirectory.
 # Client certs use cert-manager naming (tls.crt/tls.key). The connector reads
 # the dir as-is, so the path is relative to the test binary's working
-# directory, flow/e2e (NOT repo-root-relative like the PG_MTLS_* paths).
-# Regenerate certs with volumes/ch-tls/generate.sh.
+# directory, flow/connectors/clickhouse (NOT repo-root-relative like the PG_MTLS_* paths).
+# Regenerate certs with volumes/ch-tls/regenerate-certs.sh.
 CI_CLICKHOUSE_TLS_PORT=11440
 PEERDB_CLICKHOUSE_TLS_PORT=11440
-PEERDB_CLICKHOUSE_TLS_CERT_DIR=../../volumes/ch-tls
+PEERDB_CLICKHOUSE_TLS_CERT_DIR=../../../volumes/ch-tls
 
 CI_CLICKHOUSE_HTTP_PORT_02=13123
 CI_CLICKHOUSE_NATIVE_PORT_02=13000
```

**File**: `.github/scripts/check-flow-test-selection.sh` (added, +73/-0)
```diff
@@ -0,0 +1,73 @@
+#!/usr/bin/env bash
+# The unit job skips tilt-tagged test files. Make sure every package containing
+# those tests belongs to exactly one source job in flow.yml. Also make sure
+# every matrix target has a source job entry; without one, it could run no
+# tests and still pass.
+set -euo pipefail
+
+cd "$(dirname "${BASH_SOURCE[0]}")/../.."
+repo=$PWD
+workflow="$repo/.github/workflows/flow.yml"
+table='.jobs.flow_test.strategy.matrix.jobs[0]'
+jobs=$(yq -r "$table | keys | .[]" "$workflow" | sort)
+targets=$(yq -r '.jobs.flow_test.strategy.matrix.target[].job' "$workflow" | sort -u)
+if ! diff <(printf '%s\n' "$jobs") <(printf '%s\n' "$targets") >&2; then
+  echo 'Flow test targets and source jobs differ (see diff above)' >&2
+  exit 1
+fi
+
+# Emit package<TAB>test file pairs: tagged tests can join packages with unit tests.
+test_files() {
+  # shellcheck disable=SC2016 # Go template variables must remain literal.
+  go list -f '{{range .TestGoFiles}}{{printf "%s\t%s\n" $.ImportPath .}}{{end}}{{range .XTestGoFiles}}{{printf "%s\t%s\n" $.ImportPath .}}{{end}}' "$@" ./... | sed '/^$/d' | sort -u
+}
+job_patterns() {
+  yq -r "$table | to_entries[] | .key + \" \" + ($1)" "$workflow"
+}
+
+# Check one module against its source-job package lists. The second argument
+# selects the flow or flow/pkg package list.
+check_module() (
+  local dir=$1 pattern_columns=$2 base tagged must jobs_input owners='' job patterns listed missing duplicates
+  local -a args
+  cd "$repo/$dir"
+  base=$(test_files)
+  tagged=$(test_files -tags tilt)
+  must=$(comm -13 <(printf '%s\n' "$base") <(printf '%s\n' "$tagged") | cut -f1 | sort -u)
+
+  jobs_input=$(job_patterns "$pattern_columns")
+  while read -r job patterns; do
+    if [[ ! "$patterns" =~ [^[:space:]] ]]; then
+      continue
+    fi
+    read -r -a args <<< "$patterns"
+    if ! listed=$(go list -tags tilt "${args[@]}"); then
+      echo "job $job: invalid $dir package pattern" >&2
+      exit 1
+    fi
+    if [[ -z "$listed" ]]; then
+      echo "job $job: $dir pattern matched no packages" >&2
+      exit 1
+    fi
+    if [[ -n "$owners" ]]; then
+      owners+=$'\n'
+    fi
+    owners+="$listed"
+  done <<< "$jobs_input"
+
+  missing=$(comm -23 <(printf '%s\n' "$must") <(printf '%s\n' "$owners" | sort -u))
+  duplicates=$(printf '%s\n' "$owners" | sort | uniq -d)
+  if [[ -n "$missing" || -n "$duplicates" ]]; then
+    if [[ -n "$missing" ]]; then
+      printf '%s\n' "$missing" | sed 's/^/unowned: /' >&2
+    fi
+    if [[ -n "$duplicates" ]]; then
+      printf '%s\n' "$duplicates" | sed 's/^/owned twice: /' >&2
+    fi
+    exit 1
+  fi
+  echo "$dir: all test packages are owned once"
+)
+
+check_module flow '.value.packages // ""'
+check_module flow/pkg '.value.pkg // ""'
```

**File**: `.github/workflows/flow.yml` (modified, +177/-33)
```diff
@@ -38,21 +38,159 @@ jobs:
       - name: Approve run
         run: echo "Run approved for ${{ github.event_name }}."
 
+  unit_tests:
+    name: Unit tests (no services)
+    needs: [gate]
+    runs-on: ubuntu-latest-64-core
+    timeout-minutes: 30
+    env:
+      TZ: UTC
+    steps:
+      - uses: actions/checkout@d23441a48e516b6c34aea4fa41551a30e30af803 # v6
+        with:
+          ref: ${{ github.event_name == 'pull_request_target' && github.event.pull_request.head.sha || github.ref }}
+          allow-unsafe-pr-checkout: true
+      - uses: actions/setup-go@924ae3a1cded613372ab5595356fb5720e22ba16 # v6
+        with:
+          go-version: '1.27.1'
+          cache-dependency-path: |
+            flow/go.sum
+            flow/pkg/go.sum
+      - uses: bufbuild/buf-action@8c6a16e16f12ba20b6470afa9c2ba9b5ba8c97c3 # v1
+        with:
+          setup_only: true
+          github_token: ${{ github.token }}
+      - run: sudo apt-get update && sudo apt-get install -y libgeos-dev retry
+      - run: ./generate-protos.sh
+      - run: cp .env.example .env
+      - run: go install gotest.tools/gotestsum@latest
+      - run: mkdir -p logs
+      - name: Unit tests (flow)
+        working-directory: ./flow
+        run: |
+          gotestsum --format standard-quiet --no-color --junitfile ../logs/unit-test-results.xml -- \
+            -p 32 ./... -timeout 600s
+      - name: Unit tests (pkg)
+        working-directory: ./flow/pkg
+        run: |
+          gotestsum --format standard-quiet --no-color --junitfile ../../logs/unit-pkg-test-results.xml -- \
+            -p 32 ./... -timeout 300s
+      - name: Upload unit test results
+        if: always()
+        uses: actions/upload-artifact@043fb46d1a93c77aae656e7c1c64a875d1fc6a0a # v7
+        with:
+          name: flow-unit-test-results
+          path: logs/
+          retention-days: 30
+      - name: Ingest unit test results
+        if: (success() || failure()) && hashFiles('logs/unit-test-results.xml') != ''
+        uses: ./.github/actions/ingest-test-results
+        with:
+          combination-id: unit
+          test-results-file: logs/unit-test-results.xml
+          o11y-api-key-id: ${{ secrets.CI_O11Y_TARGET_API_KEY_ID }}
+          o11y-api-key-secret: ${{ secrets.CI_O11Y_TARGET_API_KEY_SECRET }}
+          o11y-query-endpoint: ${{ secrets.CI_O11Y_TARGET_QUERY_ENDPOINT }}
+      - name: Ingest pkg unit test results
+        if: (success() || failure()) && hashFiles('logs/unit-pkg-test-results.xml') != ''
+        uses: ./.github/actions/ingest-test-results
+        with:
+          combination-id: unit-pkg
+          test-results-file: logs/unit-pkg-test-results.xml
+          o11y-api-key-id: ${{ secrets.CI_O11Y_TARGET_API_KEY_ID }}
+          o11y-api-key-secret: ${{ secrets.CI_O11Y_TARGET_API_KEY_SECRET }}
+          o11y-query-endpoint: ${{ secrets.CI_O11Y_TARGET_QUERY_ENDPOINT }}
+
+  test_selection_coverage:
+    name: Test selection coverage
+    needs: [gate]
+    runs-on: ubuntu-latest
+    steps:
+      - uses: actions/checkout@d23441a48e516b6c34aea4fa41551a30e30af803 # v6
+        with:
+          ref: ${{ github.event_name == 'pull_request_target' && github.event.pull_request.head.sha || github.ref }}
+          allow-unsafe-pr-checkout: true
+      - uses: actions/setup-go@924ae3a1cded613372ab5595356fb5720e22ba16 # v6
+        with:
+          go-version: '1.27.1'
+          cache-dependency-path: |
+            flow/go.sum
+            flow/pkg/go.sum
+      - uses: bufbuild/buf-action@8c6a16e16f12ba20b6470afa9c2ba9b5ba8c97c3 # v1
+        with:
+          setup_only: true
+          github_token: ${{ github.token }}
+      - run: ./generate-protos.sh
+      - run: bash .github/scripts/check-flow-test-selection.sh
+
   flow_test:
-    name: flow_test (pg${{ matrix.db-version.pg }}, ${{ matrix.db-version.mysql }}, ${{ matrix.db-version.mariadb }}, mongo${{ matrix.db-version.mongo }}, ch-${{ matrix.db-version.ch }}, crdb-${{ matrix.db-version.crdb }})
+    name: ${{ matrix.target.label }}
     needs: [gate]
     strategy:
       fail-fast: false
       matrix:
-        db-version: [
-          {pg: 16, mysql: 'mysql-gtid', mariadb: 'maria-11', mongo: '6.0', ch: 'lts', crdb: 'v24'},
-          {pg: 17, mysql: 'mysql-pos', mariadb: 'maria-12', mongo: '7.0', ch: 'stable', crdb: 'v25'},
-          {pg: 18, mysql: 'mysql-gtid', mariadb: 'maria-13', mongo: '8.0', ch: 'latest', crdb: 'v26'},
-        ]
-        # Per-version container settings.
-        # Wrapped in a single-item list because matrix values must be arrays; it stays
-        # a single shared value (no extra jobs).
-        version-configs:
+        target:
+          - {job: postgres_clickhouse,    version: '16',       ch: lts,    label: postgres-16_ch-lts}
+          - {job: postgres_clickhouse,    version: '17',       ch: stable, label: postgres-17_ch-stable}
+          - {job: postgres_clickhouse,    version: '18',       ch: latest, label: postgres-18_ch-latest}
+   
```

**File**: `.github/workflows/tilt-flow.yml` (modified, +106/-38)
```diff
@@ -1,29 +1,30 @@
 name: tilt-flow
-run-name: 'tilt-flow: ${{ inputs.test_matcher }} [services: ${{ inputs.ancillary_services }}]'
+run-name: 'tilt-flow: ${{ inputs.run_label }} [services: ${{ inputs.ancillary_services }}]'
 
 # Tilt orchestrated e2e tests flow.
 #
 # This workflow can be triggered manually (workflow_dispatch) or reused by another
-# workflow (workflow_call, e.g. flow.yml): pick the Go test matcher to run and the
-# ancillary services it needs.
+# workflow (workflow_call, e.g. flow.yml): choose package lists and the
+# ancillary services they need.
 on:
   workflow_dispatch:
     inputs: &tilt_flow_inputs
-      test_matcher:
-        description: >-
-          Go test matcher passed to `go test -run` (a regex). The tests run on the
-          host against the Tilt-provided stack, over ./... so the matcher alone
-          selects what runs. Examples: "TestGenericCH_PG", "TestMongoClickhouseSuite",
-          "^TestPeerFlowE2ETestSuitePG_CH$", "TestApiPg". Leave empty to run everything.
+      test_packages:
+        description: Space-separated Tilt test package patterns relative to flow/.
+        type: string
+        required: false
+        default: ./e2e/postgres_clickhouse/...
+      pkg_test_packages:
+        description: Space-separated Tilt test package patterns relative to flow/pkg/.
         type: string
         required: false
-        default: TestGenericCH_PG
+        default: ''
       ancillary_services:
         description: >-
           Space-separated ancillary Tilt resources to start before the test.
         type: string
         required: false
-        default: postgres clickhouse
+        default: otel-collector toxiproxy openssh clickhouse clickhouse-keeper clickhouse-02 postgres
       checkout_ref:
         description: >-
           Git ref or SHA to check out. Leave empty to use the triggering event's
@@ -48,7 +49,7 @@ on:
         default: ''
       # The <db>_image inputs pin the docker images of the ancillary DBs.
       # When empty, default to last combination declared at flow.yml
-      # following generate-test-environment.sh's defaults.
+      # following scripts/generate-test-environment.sh's defaults.
       postgres_image:
         description: Docker image for the postgres/postgres2 ancillary services (POSTGRES_IMAGE).
         type: string
@@ -157,7 +158,7 @@ concurrency:
   # - Consecutive commits in a PR branch cancel their builds.
   # - Consecutive commits in main do not cancel each other's runs.
   #
-  group: tilt-flow-${{ github.event.pull_request.number || github.ref }}-${{ inputs.run_label }}-${{ inputs.test_matcher }}-${{ inputs.postgres_image }}-${{ inputs.mysql_gtid_image }}-${{ inputs.mysql_pos_image }}-${{ inputs.mariadb_image }}-${{ inputs.mongodb_image }}-${{ inputs.clickhouse_image }}-${{ inputs.cockroachdb_image }}-${{ github.event_name == 'push' && github.sha || '' }}
+  group: tilt-flow-${{ github.event.pull_request.number || github.ref }}-${{ inputs.run_label }}-${{ inputs.postgres_image }}-${{ inputs.mysql_gtid_image }}-${{ inputs.mysql_pos_image }}-${{ inputs.mariadb_image }}-${{ inputs.mongodb_image }}-${{ inputs.clickhouse_image }}-${{ inputs.cockroachdb_image }}-${{ github.event_name == 'push' && github.sha || '' }}
   cancel-in-progress: ${{ github.event_name != 'push' }}
 
 env:
@@ -176,7 +177,7 @@ env:
   # health polls.
   MIN_RECOVERY_TIME: "3"
   MAX_RECOVERY_TIME: "5"
-  # Ancillary DB image pins consumed by generate-test-environment.sh, which the
+  # Ancillary DB image pins consumed by scripts/generate-test-environment.sh, which the
   # Tiltfile runs on `tilt up`. Empty values fall back to the script's
   # defaults.
   POSTGRES_IMAGE: ${{ inputs.postgres_image }}
@@ -203,8 +204,8 @@ env:
   FLOW_TESTS_RDS_IAM_AUTH_USERNAME_MYSQL: ${{ secrets.FLOW_TESTS_RDS_IAM_AUTH_USERNAME_MYSQL }}
 
 jobs:
-  tilt_flow_test:
-    runs-on: ubuntu-latest-16-cores
+  tilt:
+    runs-on: ubuntu-latest-64-core
     timeout-minutes: 60
     steps:
       - uses: Kesin11/actions-timeline@57fc93f20c6da7fbc14063c6d24a2a5627c799ad # v3.2.0
@@ -224,7 +225,7 @@ jobs:
         id: run-identity
         env:
           RUN_LABEL: ${{ inputs.run_label }}
-          RAW_IDENTITY: "${{ inputs.test_matcher }} ${{ inputs.postgres_image }} ${{ inputs.mysql_gtid_image }} ${{ inputs.mysql_pos_image }} ${{ inputs.mariadb_image }} ${{ inputs.mongodb_image }} ${{ inputs.clickhouse_image }} ${{ inputs.cockroachdb_image }}"
+          RAW_IDENTITY: "${{ inputs.test_packages }} ${{ inputs.pkg_test_packages }} ${{ inputs.postgres_image }} ${{ inputs.mysql_gtid_image }} ${{ inputs.mysql_pos_image }} ${{ inputs.mariadb_image }} ${{ inputs.mongodb_image }} ${{ inputs.clickhouse_image }} ${{ inputs.cockroachdb_image }}"
         run: |
           label="${RUN_LABEL:-$RAW_IDENTITY}"
           suffix="$(printf '%s' "$label" | tr -c 'A-Za-z0-9._-' '-' | tr -s '-' | sed 's/^-*//; s/-*$//')"
@@ -505,12 +506,12 @@ jobs:
           sudo csplit -b '%02d.crt' -s -
```

**File**: `CONTRIBUTING.md` (modified, +28/-0)
```diff
@@ -7,3 +7,31 @@ Thanks for your interest in contributing to PeerDB! Bug reports, feature request
 Several destination connectors (Snowflake, BigQuery, ElasticSearch, Kafka including Confluent and Redpanda, Azure Event Hubs, Google Pub/Sub, and S3) are deprecated and no longer actively maintained. They remain fully functional, and no code is currently being removed. (BigQuery is deprecated only as a destination — it remains a supported source.)
 
 If you depend on one of these connectors, see the [deprecated connectors migration guide](docs/deprecated-connectors.md) for how to pin to a release or fork the relevant connector code.
+
+## Testing
+
+Flow tests have two build modes. Run commands from `flow/` unless a command says otherwise.
+
+| Tier | What it needs | Example |
+|---|---|---|
+| Unit | No Docker or external services | `go test ./...` |
+| Tilt (E2E + integration) | Tilt services; files have `//go:build tilt` | `go test -tags tilt ./connectors/mysql/...` or `go test -tags tilt ./e2e/mysql_clickhouse/ -run TestGenericCH_MySQL` |
+
+Run the nested `flow/pkg` module separately: `cd pkg && go test ./...` for unit tests, or add `-tags tilt` when its service tests are needed. Name files containing only service tests `*_integration_test.go`. Any test that opens a connection to a service belongs in a `tilt` tagged file, including e2e entry points. The unit CI job starts no Docker services, so an untagged service connection will fail there. Tests that start an in-process test server can remain unit tests.
+
+To get diagnostics for tagged files in gopls, add this to your editor settings:
+
+```json
+"gopls": {"buildFlags": ["-tags=tilt"]}
+```
+
+CI selects Tilt-tagged tests by package. E2e packages map to source jobs as follows:
+
+| E2E package | CI job |
+|---|---|
+| `postgres_clickhouse`, `postgres_postgres`, `switchboard_postgres` | `postgres_clickhouse` |
+| `postgres_other` | `postgres_other` |
+| `mysql_clickhouse`, `switchboard_mysql` | `mysql_clickhouse` |
+| `mongo_clickhouse`, `switchboard_mongo` | `mongo_clickhouse` |
+| `cockroachdb_clickhouse` | `cockroachdb_clickhouse` |
+| `bigquery_clickhouse` | `bigquery_clickhouse` |
```

**File**: `README.md` (modified, +4/-2)
```diff
@@ -124,7 +124,7 @@ For example:
 ```bash
 cd flow
 go clean -cache
-go test -v -run TestGenericCH_MySQL ./e2e/
+go test -tags tilt -v -run TestGenericCH_MySQL ./e2e/mysql_clickhouse/
 ```
 
 Or local debugging sessions.
@@ -156,9 +156,11 @@ And follow the status of the services and access logs through the Tilt UI at htt
 Since `.env` is the environment configuration source of truth, tests automatically pick it up from the project root. For example:
 
 ```bash
-go clean -cache; go test -v -run TestGenericCH_MySQL ./e2e/ # Some MySQL generic tests
+go clean -cache; go test -tags tilt -v -run TestGenericCH_MySQL ./e2e/mysql_clickhouse/ # Some MySQL generic tests
 ```
 
+:memo: For unit and Tilt-backed test commands, build tags, and editor setup, see [Testing in CONTRIBUTING.md](CONTRIBUTING.md#testing).
+
 ### Running tests from Tilt
 
 The Tilt setup includes pre-configured test launcher resources under the `e2e` label. These resources do not start automatically; instead, you can trigger them on demand from the Tilt UI at http://localhost:10352/.
```

---

### Incident Patch 12: `02b9ff53` (2026-09-24)
**Commit Message**: fix cdc signal state log (#4850)

log actual update signal value instead of a current mirror state

**File**: `flow/workflows/cdc_flow.go` (modified, +2/-2)
```diff
@@ -535,8 +535,8 @@ func addCdcPropertiesSignalListener(
 		// do this irrespective of additional tables being present, for auto unpausing
 		state.FlowConfigUpdate = cdcConfigUpdate
 		logger.Info("CDC Signal received",
-			slog.Uint64("BatchSize", uint64(state.SyncFlowOptions.BatchSize)),
-			slog.Uint64("IdleTimeout", state.SyncFlowOptions.IdleTimeoutSeconds),
+			slog.Uint64("BatchSize", uint64(cdcConfigUpdate.BatchSize)),
+			slog.Uint64("IdleTimeout", cdcConfigUpdate.IdleTimeout),
 			slog.Any("AdditionalTables", cdcConfigUpdate.AdditionalTables),
 			slog.Any("RemovedTables", cdcConfigUpdate.RemovedTables),
 			slog.Any("UpdatedEnv", cdcConfigUpdate.UpdatedEnv),
```

---

### Incident Patch 13: `51409be8` (2026-09-24)
**Commit Message**: Fix CI from competing mongo merges (#4848)

Fixes the \`connectors/mongo\` test build on main:

```
connectors/mongo/cdc_test.go:373:44: undefined: model.NameAndExclude
connectors/mongo/cdc_test.go:415:44: undefined: model.NameAndExclude
```

The last CI run for #4841 happened before #4818 merged. #4818 replaced
`model.NameAndExclude` with `model.SourceTableMapping`, and #4841 merged
afterwards without a rebase. Flow CI on main has failed since then
([run](https://github.com/PeerDB-io/peerdb/actions/runs/35904653124)).

This switches the two new test requests to `model.SourceTableMapping`,
matching the other tests in the file.

**File**: `flow/connectors/mongo/cdc_test.go` (modified, +2/-2)
```diff
@@ -370,7 +370,7 @@ func TestRetryChangeStreamErrorRecovery(t *testing.T) {
 	req := &model.PullRecordsRequest[model.RecordItems]{
 		FlowJobName:            "test_mongo_retry_change_stream",
 		RecordStream:           model.NewCDCStream[model.RecordItems](100),
-		TableNameMapping:       map[string]model.NameAndExclude{"db.coll": {Name: "db_coll"}},
+		TableNameMapping:       map[string]model.SourceTableMapping{"db.coll": {Name: "db_coll"}},
 		TableNameSchemaMapping: map[string]*protos.TableSchema{},
 		MaxBatchSize:           10000,
 		IdleTimeout:            time.Minute,
@@ -412,7 +412,7 @@ func TestRetryChangeStreamRecoveriesAreBounded(t *testing.T) {
 	req := &model.PullRecordsRequest[model.RecordItems]{
 		FlowJobName:            "test_mongo_retry_change_stream_bounded",
 		RecordStream:           model.NewCDCStream[model.RecordItems](100),
-		TableNameMapping:       map[string]model.NameAndExclude{"db.coll": {Name: "db_coll"}},
+		TableNameMapping:       map[string]model.SourceTableMapping{"db.coll": {Name: "db_coll"}},
 		TableNameSchemaMapping: map[string]*protos.TableSchema{},
 		MaxBatchSize:           10000,
 		IdleTimeout:            time.Minute,
```

---

### Incident Patch 14: `8e825c0f` (2026-09-22)
**Commit Message**: fix(bigquery): enable storage read api for appends/changes methods (#4824)

Currently appends/changes methods never use storage read api, because
bigquery rejected it with:
```
InvalidArgument: Reading change stream columns is not supported:
_CHANGE_TIMESTAMP, _CHANGE_TYPE
```

This PR adds a workaround to project these columns to with `_PEERDB`
prefix to unblock storage read api usage.
It also removes ORDER BY _CHANGE_TIMESTAMP from the CHANGES method path
to ensure that storage read api can be used.

Extend validation as well to perform a real Read from the storage read
api stream.

Resolves: DBI-1172

---------

Co-authored-by: Claude Opus 5 (1M context) <[REDACTED_EMAIL]>

**File**: `flow/connectors/bigquery/cdc.go` (modified, +52/-35)
```diff
@@ -31,9 +31,17 @@ const (
 	// Pseudo-columns APPENDS()/CHANGES() add on top of the base table's real
 	// columns. These are metadata, not data columns, and must not be copied into
 	// the record.
-	bigQueryChangeTypeColumn        = "_CHANGE_TYPE"
-	bigQueryChangeTimestampColumn   = "_CHANGE_TIMESTAMP"
-	bigQueryChangeIsForUpdateColumn = "_CHANGE_IS_FOR_UPDATE"
+	changeTypeColumn        = "_CHANGE_TYPE"
+	changeTimestampColumn   = "_CHANGE_TIMESTAMP"
+	changeIsForUpdateColumn = "_CHANGE_IS_FOR_UPDATE"
+
+	// The Storage Read API rejects query result tables containing BigQuery's
+	// reserved change-stream columns. Project their values under ordinary names
+	// so large APPENDS()/CHANGES() results can use Storage Read instead of the
+	// paginated jobs.getQueryResults REST path.
+	changeTypeColumnProjection        = "_PEERDB_BIGQUERY_CHANGE_TYPE"
+	changeTimestampColumnProjection   = "_PEERDB_BIGQUERY_CHANGE_TIMESTAMP"
+	changeIsForUpdateColumnProjection = "_PEERDB_BIGQUERY_CHANGE_IS_FOR_UPDATE"
 
 	// _CHANGE_TYPE values.
 	bigQueryChangeTypeInsert = "INSERT"
@@ -258,8 +266,7 @@ func (c *BigQueryConnector) pullTableAppends(
 	var bytesTransferred atomic.Int64
 	it, err := c.runPullQuery(withByteCounter(ctx, &bytesTransferred), sourceTableIdentifier, columns, nil,
 		start, end, func(cols []string) string {
-			selectCols := append(slices.Clone(cols), bigQueryChangeTypeColumn, bigQueryChangeTimestampColumn)
-			return buildEventsPullQuery("APPENDS", dsTable.stringQuoted(), selectCols, "")
+			return buildEventsPullQuery("APPENDS", dsTable.stringQuoted(), cols)
 		})
 	if err != nil {
 		return 0, fmt.Errorf("failed to run APPENDS query for table %s: %w", sourceTableIdentifier, err)
@@ -314,19 +321,32 @@ func (c *BigQueryConnector) pullTableAppends(
 // bigQueryChangePseudoColumns are the metadata columns APPENDS()/CHANGES() add on top
 // of the base table's real columns -- never copied into the record.
 var bigQueryChangePseudoColumns = map[string]struct{}{
-	bigQueryChangeTypeColumn:        {},
-	bigQueryChangeTimestampColumn:   {},
-	bigQueryChangeIsForUpdateColumn: {},
+	changeTypeColumnProjection:        {},
+	changeTimestampColumnProjection:   {},
+	changeIsForUpdateColumnProjection: {},
 }
 
-// buildEventsPullQuery renders "SELECT col1, col2, ... FROM fn(TABLE dsTable, @start, @end)
-// [ORDER BY orderBy]" for the APPENDS()/CHANGES() table-valued functions.
-func buildEventsPullQuery(fn string, dsTable string, columns []string, orderBy string) string {
-	q := fmt.Sprintf("SELECT %s FROM %s(TABLE %s, @start, @end)", quotedColumnList(columns), fn, dsTable)
-	if orderBy != "" {
-		q += " ORDER BY " + orderBy
-	}
-	return q
+// buildEventsPullQuery aliases BigQuery's reserved columns for Storage Read, e.g.:
+// SELECT `id`, CONCAT(`_CHANGE_TYPE`, ”) AS `_PEERDB_BIGQUERY_CHANGE_TYPE`,
+// TIMESTAMP_MICROS(UNIX_MICROS(`_CHANGE_TIMESTAMP`)) AS `_PEERDB_BIGQUERY_CHANGE_TIMESTAMP`
+// FROM APPENDS(TABLE `ds`.`tbl`, @start, @end)
+func buildEventsPullQuery(fn string, dsTable string, columns []string) string {
+	projection := quotedColumnList(columns)
+	if projection != "" {
+		projection += ", "
+	}
+	projection += fmt.Sprintf(
+		"CONCAT(%s, '') AS %s, TIMESTAMP_MICROS(UNIX_MICROS(%s)) AS %s",
+		quotedIdentifier(changeTypeColumn), quotedIdentifier(changeTypeColumnProjection),
+		quotedIdentifier(changeTimestampColumn), quotedIdentifier(changeTimestampColumnProjection),
+	)
+	if fn == "CHANGES" {
+		projection += fmt.Sprintf(", IF(%s, TRUE, FALSE) AS %s",
+			quotedIdentifier(changeIsForUpdateColumn),
+			quotedIdentifier(changeIsForUpdateColumnProjection))
+	}
+
+	return fmt.Sprintf("SELECT %s FROM %s(TABLE %s, @start, @end)", projection, fn, dsTable)
 }
 
 // buildWatermarkPullQuery renders "SELECT col1, col2, ... FROM dsTable WHERE
@@ -385,6 +405,9 @@ func (c *BigQueryConnector) runPullQuery(
 		// consume cached REST rows or use Storage Read for the query result.
 		it, err := q.Read(ctx)
 		if err == nil {
+			c.logger.Info("[bigquery] pull query initialized",
+				slog.String("table", sourceTableIdentifier),
+				slog.Bool("useStorageReadAPI", it.IsAccelerated()))
 			return it, nil
 		}
 
@@ -526,30 +549,27 @@ func locateBigQueryChangeColumns(schema bigquery.Schema) bigQueryChangeColumns {
 	cols := bigQueryChangeColumns{changeType: -1, changeTimestamp: -1, isForUpdate: -1}
 	for i, field := range schema {
 		switch field.Name {
-		case bigQueryChangeTypeColumn:
+		case changeTypeColumnProjection:
 			cols.changeType = i
-		case bigQueryChangeTimestampColumn:
+		case changeTimestampColumnProjection:
 			cols.changeTimestamp = i
-		case bigQueryChangeIsForUpdateColumn:
+		case changeIsForUpdateColumnProjection:
 			cols.isForUpdate = i
 		}
 	}
 	return cols
 }
 
-// pullTableChanges runs SELECT <columns> FROM CHANGES(TABLE <table>, @start, @end)
-// ORDER BY _CHANGE_TIMESTAMP for one source table over [start, end), single-pass streaming
-// like pullTableAppends, and pushes the resulting Insert/Upda
```

**File**: `flow/connectors/bigquery/cdc_test.go` (modified, +35/-10)
```diff
@@ -106,9 +106,9 @@ func TestBigQueryRowToRecordItems(t *testing.T) {
 	schema := bigquery.Schema{
 		{Name: "id", Type: bigquery.IntegerFieldType},
 		{Name: "name", Type: bigquery.StringFieldType},
-		{Name: bigQueryChangeTypeColumn, Type: bigquery.StringFieldType},
-		{Name: bigQueryChangeTimestampColumn, Type: bigquery.TimestampFieldType},
-		{Name: bigQueryChangeIsForUpdateColumn, Type: bigquery.BooleanFieldType},
+		{Name: changeTypeColumnProjection, Type: bigquery.StringFieldType},
+		{Name: changeTimestampColumnProjection, Type: bigquery.TimestampFieldType},
+		{Name: changeIsForUpdateColumnProjection, Type: bigquery.BooleanFieldType},
 	}
 	qfields := make([]types.QField, len(schema))
 	for i, f := range schema {
@@ -122,12 +122,32 @@ func TestBigQueryRowToRecordItems(t *testing.T) {
 	require.NoError(t, err)
 	assert.Equal(t, types.QValueInt64{Val: 1}, items.GetColumnValue("id"))
 	assert.Equal(t, types.QValueString{Val: "alice"}, items.GetColumnValue("name"))
-	assert.Nil(t, items.GetColumnValue(bigQueryChangeTypeColumn))
-	assert.Nil(t, items.GetColumnValue(bigQueryChangeTimestampColumn))
-	assert.Nil(t, items.GetColumnValue(bigQueryChangeIsForUpdateColumn))
+	assert.Nil(t, items.GetColumnValue(changeTypeColumnProjection))
+	assert.Nil(t, items.GetColumnValue(changeTimestampColumnProjection))
+	assert.Nil(t, items.GetColumnValue(changeIsForUpdateColumnProjection))
 	assert.Len(t, items.ColToVal, 2)
 }
 
+func TestLocateBigQueryChangeColumns(t *testing.T) {
+	t.Run("PeerDB aliases", func(t *testing.T) {
+		cols := locateBigQueryChangeColumns(bigquery.Schema{
+			{Name: "id", Type: bigquery.IntegerFieldType},
+			{Name: changeTypeColumnProjection, Type: bigquery.StringFieldType},
+			{Name: changeTimestampColumnProjection, Type: bigquery.TimestampFieldType},
+			{Name: changeIsForUpdateColumnProjection, Type: bigquery.BooleanFieldType},
+		})
+		assert.Equal(t, bigQueryChangeColumns{changeType: 1, changeTimestamp: 2, isForUpdate: 3}, cols)
+	})
+
+	t.Run("original columns remain supported", func(t *testing.T) {
+		cols := locateBigQueryChangeColumns(bigquery.Schema{
+			{Name: changeTimestampColumnProjection, Type: bigquery.TimestampFieldType},
+			{Name: changeTypeColumnProjection, Type: bigquery.StringFieldType},
+		})
+		assert.Equal(t, bigQueryChangeColumns{changeType: 1, changeTimestamp: 0, isForUpdate: -1}, cols)
+	})
+}
+
 func TestPullColumnNames(t *testing.T) {
 	schema := &protos.TableSchema{
 		Columns: []*protos.FieldDescription{
@@ -222,12 +242,17 @@ func TestMissingColumnsFromSchema(t *testing.T) {
 
 func TestBuildPullQuery(t *testing.T) {
 	assert.Equal(t,
-		"SELECT `id`, `name` FROM APPENDS(TABLE `ds`.`tbl`, @start, @end)",
-		buildEventsPullQuery("APPENDS", "`ds`.`tbl`", []string{"id", "name"}, ""),
+		"SELECT `id`, `name`, CONCAT(`_CHANGE_TYPE`, '') AS `_PEERDB_BIGQUERY_CHANGE_TYPE`, "+
+			"TIMESTAMP_MICROS(UNIX_MICROS(`_CHANGE_TIMESTAMP`)) AS `_PEERDB_BIGQUERY_CHANGE_TIMESTAMP` "+
+			"FROM APPENDS(TABLE `ds`.`tbl`, @start, @end)",
+		buildEventsPullQuery("APPENDS", "`ds`.`tbl`", []string{"id", "name"}),
 	)
 	assert.Equal(t,
-		"SELECT `id`, `name` FROM CHANGES(TABLE `ds`.`tbl`, @start, @end) ORDER BY `_CHANGE_TIMESTAMP`",
-		buildEventsPullQuery("CHANGES", "`ds`.`tbl`", []string{"id", "name"}, "`_CHANGE_TIMESTAMP`"),
+		"SELECT `id`, `name`, CONCAT(`_CHANGE_TYPE`, '') AS `_PEERDB_BIGQUERY_CHANGE_TYPE`, "+
+			"TIMESTAMP_MICROS(UNIX_MICROS(`_CHANGE_TIMESTAMP`)) AS `_PEERDB_BIGQUERY_CHANGE_TIMESTAMP`, "+
+			"IF(`_CHANGE_IS_FOR_UPDATE`, TRUE, FALSE) AS `_PEERDB_BIGQUERY_CHANGE_IS_FOR_UPDATE` "+
+			"FROM CHANGES(TABLE `ds`.`tbl`, @start, @end)",
+		buildEventsPullQuery("CHANGES", "`ds`.`tbl`", []string{"id", "name"}),
 	)
 	assert.Equal(t,
 		"SELECT `id`, `name` FROM `ds`.`tbl` "+
```

---

### Incident Patch 15: `318c2b12` (2026-09-22)
**Commit Message**: fix(clickhouse): skip table capacity check on getServerSetting access denied (#4838)

## Summary
- `ValidateTableCapacity` treated `ACCESS_DENIED` (497) as skippable
only on the `system.server_settings` fallback, which ran when
`getServerSetting` was missing (`UNKNOWN_FUNCTION`).
- On newer ClickHouse (`ch-latest`), `getServerSetting` exists but still
requires privileges, so restricted users fail the primary query and CI's
`TestValidateTableCapacity/missing_system_table_privileges_skips_validation`
errors instead of skipping.
- Skip validation when the primary query returns 497, matching the
existing `system.metrics` / fallback behavior.

Corresponding CH change:
https://github.com/ClickHouse/ClickHouse/pull/117551

Made with [Cursor](https://cursor.com)

Co-authored-by: Cursor <[REDACTED_EMAIL]>

**File**: `flow/pkg/clickhouse/validation.go` (modified, +11/-9)
```diff
@@ -304,17 +304,19 @@ func ValidateTableCapacity(
 	}
 
 	var maxTables uint64
-	err := QueryRow(ctx, logger, conn,
+	if err := QueryRow(ctx, logger, conn,
 		"SELECT toUInt64(getServerSetting('max_table_num_to_throw'))",
-	).Scan(&maxTables)
-	if err != nil {
-		if chException, ok := errors.AsType[*clickhouse.Exception](err); ok &&
-			chproto.Error(chException.Code) == chproto.ErrUnknownFunction {
+	).Scan(&maxTables); err != nil {
+		chException, isException := errors.AsType[*clickhouse.Exception](err)
+		switch {
+		case isException && chproto.Error(chException.Code) == chproto.ErrAccessDenied:
+			logger.Warn("skipping ClickHouse table capacity validation: user cannot read server settings")
+			return nil
+		case isException && chproto.Error(chException.Code) == chproto.ErrUnknownFunction:
 			// Older ClickHouse versions do not expose getServerSetting.
-			err = QueryRow(ctx, logger, conn,
+			if err := QueryRow(ctx, logger, conn,
 				"SELECT toUInt64(value) FROM system.server_settings WHERE name = 'max_table_num_to_throw'",
-			).Scan(&maxTables)
-			if err != nil {
+			).Scan(&maxTables); err != nil {
 				if errors.Is(err, sql.ErrNoRows) {
 					// Older ClickHouse versions do not expose this setting.
 					return nil
@@ -326,7 +328,7 @@ func ValidateTableCapacity(
 				}
 				return fmt.Errorf("failed to query max_table_num_to_throw: %w", err)
 			}
-		} else {
+		default:
 			return fmt.Errorf("failed to query max_table_num_to_throw: %w", err)
 		}
 	}
```

#### Recent Merged Pull Requests:
- **PR #4889** (2026-10-05): Update postgres:18-alpine Docker digest to 77f5851 (@renovate[bot])
- **PR #4888** (2026-10-05): Update github-actions dependencies (@renovate[bot])
- **PR #4885** (2026-10-05): Lock file maintenance (@renovate[bot])
- **PR #4880** (2026-10-02): Revert "Downgrade DropFlowSource per-retry alerts to warnings (#4807)" (@ilidemi)
- **PR #4879** (2026-10-01): fix(structured-ingestion-mongodb) DBI-91: Propagate column exclusions to projection logic (@pfcoperez)
- **PR #4878** (2026-10-05): Skip binlog dump KILL on syncer close over SSH (@ilidemi)
- **PR #4877** (2026-09-30): feat: update `aws-rds-bundle-shasum` in Dockerfile (@github-actions[bot])
- **PR #4876** (2026-09-30): fix(structured-ingestion-mongodb) DBI-91: Convert BSON dates to timestamps in structured ingestion (@pfcoperez)

---

## 3. Empirical Evidence & Compliance Certification
- **Evidence Provenance**: Fetched directly from verified official GitHub REST API.
- **Zero Disk Footprint**: 0 bytes of unnecessary repository bloat stored locally.
- **TOS & Free-Tier Adherence**: Request pace complied with public API guidelines without fee, penalty, or unauthorized scraping.

---

## 4. Promotion & Integration Status
- **Status**: HARVESTED_DEEP_FORENSIC
- **Master Brain Sync**: Auto-committed to local/remote Master Brain repository.
