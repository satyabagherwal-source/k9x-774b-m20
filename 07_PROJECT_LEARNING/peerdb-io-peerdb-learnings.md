# Forensic Learning Record (Deep Inspection): PeerDB-io/peerdb

> **Canonical Artifact**: `07_PROJECT_LEARNING/peerdb-io-peerdb-learnings.md`  
> **Source Platform**: GitHub ([https://github.com/PeerDB-io/peerdb](https://github.com/PeerDB-io/peerdb))  
> **Harvest Method**: Full-Spectrum Deep Extraction (Patches, Diffs, Source Code, Post-Mortems)  
> **Harvest Timestamp**: 2026-09-30T17:40:30.549Z  
> **Compliance State**: Free Tier Guaranteed | Strict Rate-Limit Backoff Honored  

---

## 1. Context & Architectural Overview
- **Repository / Resource**: `PeerDB-io/peerdb`
- **Description**: Fast, Simple and a cost effective tool to replicate data from Postgres to Data Warehouses, Queues and Storage
- **Primary Language / Ecosystem**: Go
- **Discovered Manifests / Configurations**: README.md
- **Stars / Engagement**: 3291 stars

---

## 2. Multi-Dimensional 8-Axis Investigation & Real Code Patches

### D1: Architecture & Structural Boundaries
- Entry configurations inspected via direct stream: README.md.
- Evaluated system abstractions and modular contracts.

### Core Architecture Module: `e2e_cleanup/main.go`
```
package main

import (
	"context"
	"crypto/rsa"
	"database/sql"
	"encoding/json"
	"encoding/pem"
	"fmt"
	"io"
	"os"
	"runtime/debug"
	"strings"
	"sync"
	"time"

	"cloud.google.com/go/bigquery"
	"cloud.google.com/go/pubsub/v2"
	pubsubpb "cloud.google.com/go/pubsub/v2/apiv1/pubsubpb"
	"github.com/snowflakedb/gosnowflake/v2"
	"github.com/youmark/pkcs8"
	"google.golang.org/api/iterator"
	"google.golang.org/api/option"
)

func CheckedClose(closer io.Closer) {
	if err := closer.Close(); err != nil {
		panic(err)
	}
}

// from flow/shared/crypto.go
func DecodePKCS8PrivateKey(rawKey []byte, password *string) (*rsa.PrivateKey, error) {
	PEMBlock, _ := pem.Decode(rawKey)
	if PEMBlock == nil {
		return nil, fmt.Errorf("failed to decode private key PEM block")
	}

	var privateKey *rsa.PrivateKey
	var err error
	if password != nil {
		privateKey, err = pkcs8.ParsePKCS8PrivateKeyRSA(PEMBlock.Bytes, []byte(*password))
	} else {
		privateKey, err = pkcs8.ParsePKCS8PrivateKeyRSA(PEMBlock.Bytes)
	}
	if err != nil {
		return nil, fmt.Errorf("failed to parse private key PEM block as PKCS8: %w", err)
	}

	return privateKey, nil
}

func ParseJsonKeyVal[T any](path string) (T, error) {
	var result T
	f, err := os.Open(path)
	if err != nil {
		return result, fmt.Errorf("failed to open file: %w", err)
	}
	defer CheckedClose(f)

	jsonContent, err := io.ReadAll(f)
	if err != nil {
		return result, fmt.Errorf("failed to read file: %w", err)
	}

	err = json.Unmarshal(jsonContent, &result)
	return result, err
}

func handleIteratorError(err error) bool {
	if err != nil {
		if err == iterator.Done {
			return true
		}
		panic(err)
	}
	return false
}

func CleanupBQ(ctx context.Context) {
	config, err := ParseJsonKeyVal[map[string]string](os.Getenv("TEST_BQ_CREDS"))
	if err != nil {
		panic(err)
	}

	config["type"] = config["auth_type"]
	delete(config, "auth_type")
	config_json, err := json.Marshal(config)
	if err != nil {
		panic(err)
	}

	client, err := bigquery.NewClient(
		ctx,
		config["project_id"],
		option.WithAuthCredentialsJSON(option.ServiceAccount, config_json),
	)
	if err != nil {
		panic(err)
	}
	defer CheckedClose(client)

	datasets := client.Datasets(ctx)
	datasetPrefix := config["dataset_id"]
	for {
		ds, err := datasets.Next()
		if handleIteratorError(err) {
			break
		}

		if strings.HasPrefix(ds.DatasetID, datasetPrefix) {
			meta, err := ds.Metadata(ctx)
			if err != nil {
				panic(err)
			}
			if meta.CreationTime.Before(time.Now().AddDate(0, 0, -1)) {
				fmt.Printf("Deleting %s\n", ds.DatasetID)
				if err := ds.DeleteWithContents(ctx); err != nil {
					panic(err)
				}
			}
		}
	}

	// now pubsub too, lack metadata to avoid deleting currently running tests
	psclient, err := pubsub.NewClient(
		ctx,
		config["project_id"],
		option.WithAuthCredentialsJSON(option.ServiceAccount, config_json))
	if err != nil {
		panic(err)
	}
	defer CheckedClose(psclient)

	topics := psclient.TopicAdminClient.ListTopics(ctx, &pubsubpb.ListTopicsRequest{Project: "projects/" + psclient.Project()})
	for {
		topic, err := topics.Next()
		if handleIteratorError(err) {
			break
		}
		if strings.Contains(topic.Name, "/topics/e2e") {
			if err := psclient.TopicAdminClient.DeleteTopic(ctx, &pubsubpb.DeleteTopicRequest{Topic: topic.Name}); err != nil {
				panic(err)
			}
		}
	}

	subscriptions := psclient.SubscriptionAdminClient.ListSubscriptions(ctx, &pubsubpb.ListSubscriptionsRequest{Project: "projects/" + psclient.Project()})
	for {
		subscription, err := subscriptions.Next()
		if handleIteratorError(err) {
			break
		}
		if strings.Contains(subscription.Name, "/subscriptions/e2e") {
			if err := psclient.SubscriptionAdminClient.DeleteSubscription(ctx, &pubsubpb.DeleteSubscriptionRequest{
				Subscription: subscription.Name,
			}); err != nil {
				panic(err)
			}
		}
	}
}

func CleanupSF(ctx context.Context) {
	config, err := ParseJsonKeyVal[struct {
		AccountId  string  `json:"account_id"`
		Username   string  `json:"username"`
		Database   string  `json:"database"`
		Warehouse  string  `json:"warehouse"`
		Role       string  `json:"role"`
		Password   *string `json:"password"`
		PrivateKey string  `json:"private_key"`
	}](os.Getenv("TEST_SF_CREDS"))
	if err != nil {
		panic(err)
	}

	privateKey, err := DecodePKCS8PrivateKey([]byte(config.PrivateKey), config.Password)
	if err != nil {
		panic(err)
	}

	snowflakeConfig := gosnowflake.Config{
		Account:        config.AccountId,
		User:           config.Username,
		Authenticator:  gosnowflake.AuthTypeJwt,
		PrivateKey:     privateKey,
		Database:       config.Database,
		Warehouse:      config.Warehouse,
		Role:           config.Role,
		RequestTimeout: time.Minute, //nolint:staticcheck // deprecated upstream, no replacement
		Params: map[string]*string{
			"CLIENT_TELEMETRY_ENABLED": new("false"),
		},
	}

	snowflakeConfigDSN, err := gosnowflake.DSN(&snowflakeConfig)
	if err != nil {
		panic(err)
	}

	database, err := sql.Open("snowflake", snowflakeConfigDSN)
	if err != nil {
		panic(err)
	}
	defer CheckedClose(database)
	_, err = database.ExecContext(ctx, `DECLARE c CURSOR FOR
SELECT database_name FROM INFORMATION_SCHEMA.DATABASES
WHERE database_name ILIKE 'E2E_TEST_%' AND created < timeadd('hour', -2, CURRENT_DATE);
BEGIN
  FOR record IN c DO
	EXECUTE IMMEDIATE 'DROP DATABASE ' || record.database_name;
  END FOR;
END;`)
	if err != nil {
		panic(err)
	}
}

func Handle() {
	if r := recover(); r != nil {
		fmt.Printf("ERROR %v %s\n", r, string(debug.Stack()))
	}
}

func Run(ctx context.Context, wg *sync.WaitGroup, f func(context.Context)) {
	defer wg.Done()
	defer Handle()
	f(ctx)
}

func main() {
	ctx, cancel := context.WithTimeout(context.Background(), time.Hour)
	defer cancel()
	var wg sync.WaitGroup
	wg.Add(2)
	go Run(ctx, &wg, CleanupBQ)
	go Run(ctx, &wg, CleanupSF)
	wg.Wait()
}

```

### Core Architecture Module: `flow/activities/cancel_table_addition_activity.go`
```
package activities

import (
	"context"
	"errors"
	"fmt"
	"log/slog"

	"github.com/jackc/pgx/v5"
	tEnums "go.temporal.io/api/enums/v1"
	"go.temporal.io/api/serviceerror"
	"go.temporal.io/api/workflowservice/v1"
	"go.temporal.io/sdk/client"
	"google.golang.org/protobuf/proto"

	"github.com/PeerDB-io/peerdb/flow/alerting"
	"github.com/PeerDB-io/peerdb/flow/connectors"
	connpostgres "github.com/PeerDB-io/peerdb/flow/connectors/postgres"
	"github.com/PeerDB-io/peerdb/flow/generated/protos"
	"github.com/PeerDB-io/peerdb/flow/internal"
	"github.com/PeerDB-io/peerdb/flow/otel_metrics"
	"github.com/PeerDB-io/peerdb/flow/pkg/common"
	"github.com/PeerDB-io/peerdb/flow/shared"
	"github.com/PeerDB-io/peerdb/flow/workflows/cdc_state"
)

type CancelTableAdditionActivity struct {
	CatalogPool    shared.CatalogPool
	Alerter        *alerting.Alerter
	TemporalClient client.Client
	OtelManager    *otel_metrics.OtelManager
}

/*
GetCompletedTablesFromQrepRuns gets the list of tables in the addition request
whose snapshot has completed
*/
func (a *CancelTableAdditionActivity) GetCompletedTablesFromQrepRuns(
	ctx context.Context,
	flowJobName string,
	workflowId string,
) ([]string, error) {
	shutdown := common.HeartbeatRoutine(ctx, func() string {
		return "fetching completed tables from qrep_runs"
	})
	defer shutdown()

	peerflowRunId, err := a.getRunIDOfLatestRunningPeerFlow(ctx, workflowId)
	if err != nil {
		return nil, fmt.Errorf("failed to get run ID of latest running peer flow for workflow %s: %w", workflowId, err)
	}

	slog.InfoContext(ctx, "Fetching completed tables from qrep_runs for table addition cancellation",
		slog.String("flowName", flowJobName),
		slog.String("peerflowRunId", peerflowRunId))

	listResp, err := a.TemporalClient.ListWorkflow(ctx, &workflowservice.ListWorkflowExecutionsRequest{
		Query: fmt.Sprintf("RootRunId = '%s' AND WorkflowType = 'QRepFlowWorkflow'", peerflowRunId),
	})
	if err != nil {
		return nil, fmt.Errorf("failed to list qrep workflows for flow %s: %w", flowJobName, err)
	}

	if len(listResp.Executions) == 0 {
		slog.InfoContext(ctx, "No QRep workflows found for flow, returning empty completed tables list",
			slog.String("flowName", flowJobName))
		return []string{}, nil
	}

	runIds := make([]string, 0, len(listResp.Executions))
	for _, execution := range listResp.Executions {
		runIds = append(runIds, execution.Execution.RunId)
	}

	rows, err := a.CatalogPool.Query(ctx, `
    SELECT DISTINCT source_table
    FROM peerdb_stats.qrep_runs
    WHERE parent_mirror_name = $1
    AND run_uuid = ANY($2)
    AND consolidate_complete = true`, flowJobName, runIds)
	if err != nil {
		return nil, err
	}

	completedTables, err := pgx.CollectRows(rows, func(row pgx.CollectableRow) (string, error) {
		var tableName string
		err := row.Scan(&tableName)
		return tableName, err
	})
	if err != nil {
		return nil, err
	}

	return completedTables, nil
}

func (a *CancelTableAdditionActivity) GetTableOIDsFromCatalog(
	ctx context.Context,
	flowJobName string,
	sourcePeerName string,
	sourcePeerType protos.DBType,
	tableMappings []*protos.TableMapping,
) (map[uint32]string, error) {
	if len(tableMappings) == 0 {
		return nil, fmt.Errorf("no table mappings provided for GetTableOIDsFromCatalog for flow %s", flowJobName)
	}

	shutdown := common.HeartbeatRoutine(ctx, func() string {
		return "fetching table OIDs from catalog"
	})
	defer shutdown()

	// Extract destination table names from table mappings
	destinationTableNames := make([]string, 0, len(tableMappings))
	for _, tm := range tableMappings {
		destinationTableNames = append(destinationTableNames, tm.DestinationTableIdentifier)
	}

	// Load table schemas from catalog using the internal function
	tableSchemas, err := internal.LoadTableSchemasFromCatalog(ctx, a.CatalogPool, flowJobName, destinationTableNames)
	if err != nil {
		return nil, fmt.Errorf("failed to load table schemas from catalog for OID fetch: %w", err)
	}

	// legacy mirrors created before OIDs were stored in the catalog have TableOid=0;
	// backfill those from source db so table addition cancellation works for legacy flows.
	if err := a.backfillTableOIDsFromSourceIfMissing(
		ctx, flowJobName, sourcePeerName, sourcePeerType, tableMappings, tableSchemas,
	); err != nil {
		return nil, err
	}

	// Extract table OIDs from schemas, mapping OID to source table identifier
	tableOIDs := make(map[uint32]string)
	for _, tm := range tableMappings {
		schema, exists := tableSchemas[tm.DestinationTableIdentifier]
		if !exists {
			return nil, fmt.Errorf("table schema not found in catalog for table %s in flow %s", tm.DestinationTableIdentifier, flowJobName)
		}
		tableOIDs[schema.TableOid] = tm.SourceTableIdentifier
	}

	return tableOIDs, nil
}

func (a *CancelTableAdditionActivity) CleanupIncompleteTablesInStats(
	ctx context.Context,
	flowJobName string,
	completedTables []*protos.TableMapping,
) error {
	shutdown := common.HeartbeatRoutine(ctx, func() string {
		return "cleaning up qrep stats for incomplete tables"
	})
	defer shutdown()

	completedSourceTables := make([]string, 0, len(completedTables))
	completedDestinationTables := make([]string, 0, len(completedTables))
	for _, tm := range completedTables {
		completedSourceTables = append(completedSourceTables, tm.SourceTableIdentifier)
		completedDestinationTables = append(completedDestinationTables, tm.DestinationTableIdentifier)
	}
	// Remove partitions that belong to incomplete runs for incomplete tables
	// Since qrep_partitions doesn't have source_table, we filter via the qrep_runs join
	_, err := a.CatalogPool.Exec(ctx, `
		DELETE FROM peerdb_stats.qrep_partitions qp
		WHERE EXISTS (
			SELECT 1 FROM peerdb_stats.qrep_runs qr
			WHERE qr.flow_name = qp.flow_name
			AND qr.run_uuid = qp.run_uuid
			AND qr.parent_mirror_name = $1
			AND qr.consolidate_complete = false
			AND qr.source_table NOT IN (SELECT unnest($2::text[]))
		)`, flowJobName, completedSourceTables)
	if err != nil {
		return fmt.Errorf("failed to cleanup incomplete tables in qrep_partitions for flow %s: %w", flowJobName, err)
	}

	_, err = a.CatalogPool.Exec(ctx, `
		DELETE FROM peerdb_stats.qrep_runs
		WHERE parent_mirror_name = $1 AND consolidate_complete = false
		AND source_table NOT IN (SELECT unnest($2::text[]))`, flowJobName, completedSourceTables)
	if err != nil {
		return fmt.Errorf("failed to cleanup incomplete tables in qrep_runs for flow %s: %w", flowJobName, err)
	}

	// delete from table_schema_mapping
	_, err = a.CatalogPool.Exec(ctx, `
		DELETE FROM table_schema_mapping
		WHERE flow_name = $1 AND table_name NOT IN (SELECT unnest($2::text[]))`, flowJobName, completedDestinationTables)
	if err != nil {
		return fmt.Errorf("failed to cleanup incomplete tables in table_schema_mapping for flow %s: %w", flowJobName, err)
	}

	return nil
}

func (a *CancelTableAdditionActivity) GetFlowInfoFromCatalog(
	ctx context.Context,
	flowJobName string,
) (*protos.GetFlowInfoToCancelFromCatalogOutput, error) {
	var configBytes []byte
	var workflowID string
	var sourcePeerType protos.DBType
	err := a.CatalogPool.QueryRow(ctx, `
		SELECT workflow_id,
			(select type from peers where peers.id = flows.source_peer) as source_peer_type,
			config_proto
		FROM flows
		WHERE name = $1`,
		flowJobName).Scan(&workflowID, &sourcePeerType, &configBytes)
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return nil, fmt.Errorf("flow job %s not found", flowJobName)
		}
		return nil, fmt.Errorf("unable to get flow config for flow %s: %w", flowJobName, err)
	}

	var config protos.FlowConnectionConfigsCore
	if err := proto.Unmarshal(configBytes, &config); err != nil {
		return nil, fmt.Errorf("unable to unmarshal flow config for flow %s: %w", flowJobName, err)
	}

	return &protos.GetFlowInfoToCancelFromCatalogOutput{
		FlowConnectionConfigs: &config,
		WorkflowId:            workflowID,
		SourcePeerType:        sourcePeerType,
	}, nil
}

func (a *CancelTableAdditionActivity) UpdateCdcJobEntry(
	ctx context.Context,
	connectionC
```

### Core Architecture Module: `flow/activities/flowable.go`
```
package activities

import (
	"context"
	"errors"
	"fmt"
	"log/slog"
	"maps"
	"net"
	"os"
	"slices"
	"strconv"
	"sync"
	"sync/atomic"
	"time"

	"github.com/jackc/pgerrcode"
	"github.com/jackc/pgx/v5"
	lua "github.com/yuin/gopher-lua"
	"go.opentelemetry.io/otel/attribute"
	"go.opentelemetry.io/otel/metric"
	"go.temporal.io/sdk/activity"
	"go.temporal.io/sdk/client"
	"go.temporal.io/sdk/log"
	"google.golang.org/protobuf/proto"

	"github.com/PeerDB-io/peerdb/flow/alerting"
	"github.com/PeerDB-io/peerdb/flow/connectors"
	connmetadata "github.com/PeerDB-io/peerdb/flow/connectors/external_metadata"
	connpostgres "github.com/PeerDB-io/peerdb/flow/connectors/postgres"
	"github.com/PeerDB-io/peerdb/flow/connectors/utils"
	"github.com/PeerDB-io/peerdb/flow/connectors/utils/monitoring"
	"github.com/PeerDB-io/peerdb/flow/generated/protos"
	"github.com/PeerDB-io/peerdb/flow/internal"
	"github.com/PeerDB-io/peerdb/flow/model"
	"github.com/PeerDB-io/peerdb/flow/otel_metrics"
	"github.com/PeerDB-io/peerdb/flow/pkg/common"
	"github.com/PeerDB-io/peerdb/flow/pua"
	"github.com/PeerDB-io/peerdb/flow/shared"
	"github.com/PeerDB-io/peerdb/flow/shared/concurrency"
	"github.com/PeerDB-io/peerdb/flow/shared/exceptions"
	"github.com/PeerDB-io/peerdb/flow/shared/telemetry"
)

type CheckMetadataTablesResult struct {
	NeedsSetupMetadataTables bool
}

type FlowableActivity struct {
	CatalogPool    shared.CatalogPool
	Alerter        *alerting.Alerter
	OtelManager    *otel_metrics.OtelManager
	TemporalClient client.Client
}

type QRepStreamCloser interface {
	HandleQRepSyncError(error)
	Close(error)
}

func cdcIdleTimeout(value int) time.Duration {
	if value == 0 {
		value = 10
	}
	return time.Duration(value) * time.Second
}

func getInitialNormalizeBatchID(
	ctx context.Context,
	logger log.Logger,
	catalogPool shared.CatalogPool,
	env map[string]string,
	destinationName string,
	destinationType protos.DBType,
	flowName string,
) (int64, error) {
	// Postgres keeps normalize progress in destination-local metadata.
	if destinationType == protos.DBType_POSTGRES {
		dstPgConn, dstClose, err := connectors.GetPostgresConnectorByName(ctx, env, catalogPool, destinationName)
		if err != nil {
			return 0, fmt.Errorf("failed to get postgres destination connector for normalize state: %w", err)
		}
		defer dstClose(ctx)
		return dstPgConn.GetLastNormalizeBatchID(ctx, flowName)
	}

	pgMetadata := connmetadata.NewPostgresMetadataFromCatalog(logger, catalogPool)
	// Unsupported-normalize sinks do not persist normalize_batch_id, so after restart this may
	// be behind until the first no-op normalize advances the in-memory watermark again.
	// Proper fix for this would ideally need a way to query connector capabilities without creating one which comes with a ping
	return pgMetadata.GetLastNormalizeBatchID(ctx, flowName)
}

func (a *FlowableActivity) Alert(
	ctx context.Context,
	alert *protos.AlertInput,
) error {
	_ = a.Alerter.LogFlowError(ctx, alert.FlowName, errors.New(alert.Message))
	return nil
}

func (a *FlowableActivity) CheckConnection(
	ctx context.Context,
	config *protos.SetupInput,
) error {
	ctx = context.WithValue(ctx, shared.FlowNameKey, config.FlowName)
	conn, connClose, err := connectors.GetByNameAs[connectors.Connector](ctx, config.Env, a.CatalogPool, config.PeerName)
	if err != nil {
		if errors.Is(err, errors.ErrUnsupported) {
			return nil
		}
		return a.Alerter.LogFlowError(ctx, config.FlowName, fmt.Errorf("failed to get connector: %w", err))
	}
	defer connClose(ctx)

	if err = conn.ConnectionActive(ctx); err != nil {
		return a.Alerter.LogFlowError(ctx, config.FlowName, fmt.Errorf("connection not active: %w", err))
	}

	return nil
}

func (a *FlowableActivity) CheckMetadataTables(
	ctx context.Context,
	config *protos.SetupInput,
) (*CheckMetadataTablesResult, error) {
	ctx = context.WithValue(ctx, shared.FlowNameKey, config.FlowName)
	conn, connClose, err := connectors.GetByNameAs[connectors.CDCSyncConnector](ctx, config.Env, a.CatalogPool, config.PeerName)
	if err != nil {
		return nil, a.Alerter.LogFlowError(ctx, config.FlowName, fmt.Errorf("failed to get connector: %w", err))
	}
	defer connClose(ctx)

	needsSetup, err := conn.NeedsSetupMetadataTables(ctx)
	if err != nil {
		return nil, err
	}

	return &CheckMetadataTablesResult{
		NeedsSetupMetadataTables: needsSetup,
	}, nil
}

func (a *FlowableActivity) SetupMetadataTables(ctx context.Context, config *protos.SetupInput) error {
	ctx = context.WithValue(ctx, shared.FlowNameKey, config.FlowName)
	dstConn, dstClose, err := connectors.GetByNameAs[connectors.CDCSyncConnector](ctx, config.Env, a.CatalogPool, config.PeerName)
	if err != nil {
		return a.Alerter.LogFlowError(ctx, config.FlowName, fmt.Errorf("failed to get connector: %w", err))
	}
	defer dstClose(ctx)

	if err := dstConn.SetupMetadataTables(ctx); err != nil {
		return a.Alerter.LogFlowError(ctx, config.FlowName, fmt.Errorf("failed to setup metadata tables: %w", err))
	}

	return nil
}

func (a *FlowableActivity) EnsurePullability(
	ctx context.Context,
	config *protos.EnsurePullabilityBatchInput,
) (*protos.EnsurePullabilityBatchOutput, error) {
	ctx = context.WithValue(ctx, shared.FlowNameKey, config.FlowJobName)
	srcConn, srcClose, err := connectors.GetByNameAs[connectors.CDCPullConnectorCore](ctx, nil, a.CatalogPool, config.PeerName)
	if err != nil {
		return nil, a.Alerter.LogFlowError(ctx, config.FlowJobName, fmt.Errorf("failed to get connector: %w", err))
	}
	defer srcClose(ctx)

	output, err := srcConn.EnsurePullability(ctx, config)
	if err != nil {
		return nil, a.Alerter.LogFlowError(ctx, config.FlowJobName, fmt.Errorf("failed to ensure pullability: %w", err))
	}

	return output, nil
}

func isQueryCDCPath(
	flowConfig *protos.FlowConnectionConfigsCore,
	destinationType protos.DBType,
) bool {
	return flowConfig.GetBigqueryCdcConfig() != nil && destinationType == protos.DBType_CLICKHOUSE
}

// CreateRawTable creates a raw table in the destination flowable.
func (a *FlowableActivity) CreateRawTable(
	ctx context.Context,
	config *protos.CreateRawTableInput,
) (*protos.CreateRawTableOutput, error) {
	ctx = context.WithValue(ctx, shared.FlowNameKey, config.FlowJobName)

	destinationType, err := connectors.LoadPeerType(ctx, a.CatalogPool, config.PeerName)
	if err != nil {
		return nil, a.Alerter.LogFlowError(ctx, config.FlowJobName, fmt.Errorf("failed to load destination peer type: %w", err))
	}
	flowConfig, err := internal.FetchConfigFromDB(ctx, a.CatalogPool, config.FlowJobName)
	if err != nil {
		return nil, a.Alerter.LogFlowError(ctx, config.FlowJobName, fmt.Errorf("failed to fetch flow config: %w", err))
	}

	var rawTableIdentifier string
	// The query-based CDC path writes typed Avro straight into each
	// destination table, so there's no _peerdb_raw_* table to create.
	if !isQueryCDCPath(flowConfig, destinationType) {
		dstConn, dstClose, err := connectors.GetByNameAs[connectors.CDCSyncConnector](ctx, nil, a.CatalogPool, config.PeerName)
		if err != nil {
			return nil, a.Alerter.LogFlowError(ctx, config.FlowJobName, fmt.Errorf("failed to get connector: %w", err))
		}
		defer dstClose(ctx)

		res, err := dstConn.CreateRawTable(ctx, config)
		if err != nil {
			return nil, a.Alerter.LogFlowError(ctx, config.FlowJobName, err)
		}
		// CreateRawTable return (nil, nil) for no-op destinations (S3/GCS/MinIO, Postgres)
		if res != nil {
			rawTableIdentifier = res.TableIdentifier
		}
	}

	if err := monitoring.InitializeCDCFlow(ctx, a.CatalogPool, config.FlowJobName); err != nil {
		return nil, err
	}

	return &protos.CreateRawTableOutput{TableIdentifier: rawTableIdentifier}, nil
}

// SetupTableSchema populates table_schema_mapping
func (a *FlowableActivity) SetupTableSchema(
	ctx context.Context,
	config *protos.SetupTableSchemaBatchInput,
) error {
	shutdown := common.HeartbeatRoutine(ctx, func() string {
		return "getting table schema"
	})
	defer shutdown()

	logger := internal.LoggerFromCtx(ctx)
	ctx = context.WithValue(ctx, shared.FlowNameKey, co
```

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
		batchSpan.SetStatus(codes.E
```

### Core Architecture Module: `flow/activities/flowable_query_cdc.go`
```
package activities

import (
	"context"
	"fmt"
	"log/slog"
	"sync/atomic"
	"time"

	"go.opentelemetry.io/otel/attribute"
	"go.opentelemetry.io/otel/metric"
	"go.temporal.io/sdk/log"
	"golang.org/x/sync/errgroup"

	"github.com/PeerDB-io/peerdb/flow/connectors"
	connmetadata "github.com/PeerDB-io/peerdb/flow/connectors/external_metadata"
	"github.com/PeerDB-io/peerdb/flow/generated/protos"
	"github.com/PeerDB-io/peerdb/flow/internal"
	"github.com/PeerDB-io/peerdb/flow/model"
	"github.com/PeerDB-io/peerdb/flow/otel_metrics"
	"github.com/PeerDB-io/peerdb/flow/pkg/common"
	"github.com/PeerDB-io/peerdb/flow/shared/concurrency"
)

// syncFlowQueryCDC replaces pullAndSync/normalizeLoop for the query-based CDC
// path: each source table gets its own sync loop (pull + stage-to-S3) and its
// own normalize loop (staged batches -> final table), coupled only by that
// table's own synced/normalized batch counters. A lagging or failing table
// never blocks its siblings, and a slow normalize backpressures only that
// table's own sync loop. There is no shared batch/backpressure state across
// tables at all, beyond the two semaphores bounding how many tables may
// pull+sync and normalize concurrently.
func (a *FlowableActivity) syncFlowQueryCDC(
	ctx context.Context,
	config *protos.FlowConnectionConfigsCore,
	options *protos.SyncFlowOptions,
	srcConn connectors.QueryCDCPullConnector,
	shutDown *atomic.Bool,
) error {
	flowName := config.FlowJobName
	logger := internal.LoggerFromCtx(ctx)
	pgMetadata := connmetadata.NewPostgresMetadataFromCatalog(logger, a.CatalogPool)

	var totalRecordsSynced atomic.Int64
	shutdown := common.HeartbeatRoutine(ctx, func() string {
		return fmt.Sprintf("query-based CDC: %d tables, totalRecordsSynced:%d",
			len(options.TableMappings), totalRecordsSynced.Load())
	})
	defer shutdown()

	if err := srcConn.ConnectionActive(ctx); err != nil {
		return a.Alerter.LogFlowError(ctx, flowName, fmt.Errorf("connection to source down: %w", err))
	}

	idleTimeout := cdcIdleTimeout(int(options.IdleTimeoutSeconds))
	channelBufferSize, err := internal.PeerDBCDCChannelBufferSize(ctx, config.Env)
	if err != nil {
		return fmt.Errorf("failed to get CDC channel buffer size: %w", err)
	}
	queryCDCSafetyLag, queryCDCMaxQueryWindow, err := queryCDCPollDurations(ctx, config)
	if err != nil {
		return err
	}

	pullSyncParallelism, err := queryCDCPullSyncParallelism(ctx, config)
	if err != nil {
		return err
	}
	// Bounds concurrent pull+sync work only; normalize is bounded separately by
	// normSem below, so a stalled destination can't be starved by pull work and
	// vice versa.
	var pullSyncSem chan struct{}
	if pullSyncParallelism > 0 {
		pullSyncSem = make(chan struct{}, pullSyncParallelism)
	}

	normParallelism, err := internal.PeerDBQueryCDCNormalizeParallelism(ctx, config.Env)
	if err != nil {
		return fmt.Errorf("failed to get CDC table normalize parallelism: %w", err)
	}
	// Bounds concurrent normalize work to ensure we don't overload the destination
	// Especially when normalize needs to catch up after a downtime
	var normSem chan struct{}
	if normParallelism > 0 {
		normSem = make(chan struct{}, normParallelism)
	}

	normBufferHours, err := internal.PeerDBNormalizeBufferHours(ctx, config.Env)
	if err != nil {
		return a.Alerter.LogFlowError(ctx, flowName, err)
	}
	// Same approximation pullAndSyncCore uses: normBufferHours worth of
	// idleTimeout-cadence polls, at least 2 so a table's own sync can run
	// ahead of its own normalize by a couple of batches under steady state.
	normBufferSize := normBufferHours * 3600 / int64(idleTimeout.Seconds())
	normBufferSize = max(normBufferSize, 2)

	sourceTables := make([]string, 0, len(options.TableMappings))
	for _, tm := range options.TableMappings {
		sourceTables = append(sourceTables, tm.SourceTableIdentifier)
	}
	// Prune removed mirror tables, otherwise the old state might be used if they are re-added later
	if err := pgMetadata.PruneQueryCDCReplicationState(ctx, flowName, sourceTables); err != nil {
		return a.Alerter.LogFlowError(ctx, flowName, err)
	}

	tableNameSchemaMapping, err := a.getTableNameSchemaMapping(ctx, flowName)
	if err != nil {
		return err
	}

	group, groupCtx := errgroup.WithContext(ctx)
	for _, tableMapping := range options.TableMappings {
		normRequests := concurrency.NewLastChan()
		normResponses := concurrency.NewLastChan()

		group.Go(func() error {
			return a.queryCDCNormalizeLoop(groupCtx, config, tableMapping, tableNameSchemaMapping,
				normSem, normRequests, normResponses)
		})
		group.Go(func() error {
			return a.queryCDCPullSyncLoop(groupCtx, config, srcConn, pgMetadata, tableMapping, tableNameSchemaMapping,
				channelBufferSize, idleTimeout, queryCDCSafetyLag, queryCDCMaxQueryWindow, normBufferSize,
				pullSyncSem, &totalRecordsSynced, normRequests, normResponses)
		})
	}

	if err := group.Wait(); err != nil {
		// mirrors syncFlowSharedStream: a worker shutdown cancels ctx ourselves, so the
		// resulting context.Canceled is expected teardown rather than an activity failure
		if shutDown.Load() {
			logger.Info("isolated CDC SyncFlow shutdown")
			return nil
		}
		// errgroup cancels groupCtx, not ctx, on a table error, so ctx being done here
		// means an outside cancel rather than a replication failure
		if ctx.Err() != nil {
			logger.Info("isolated CDC SyncFlow canceled", slog.Any("error", ctx.Err()))
			return ctx.Err()
		}
		logger.Error("isolated CDC SyncFlow failed", slog.Any("error", err))
		return err
	}
	return nil
}

func queryCDCPullSyncParallelism(ctx context.Context, config *protos.FlowConnectionConfigsCore) (int, error) {
	var err error
	pullSyncParallelism := int(config.GetBigqueryCdcConfig().GetQueryCdc().GetPullSyncParallelism())
	if pullSyncParallelism > 0 {
		return pullSyncParallelism, nil
	}
	// fallback to deprecated field
	pullSyncParallelism = int(config.GetQueryCdcPullSyncParallelism()) //nolint:staticcheck // Preserve configs written before QueryCdcConfig.
	if pullSyncParallelism > 0 {
		return pullSyncParallelism, nil
	}

	// fallback to dynamic config env
	pullSyncParallelism, err = internal.PeerDBQueryCDCPullSyncParallelism(ctx, config.Env)
	if err != nil {
		return 0, fmt.Errorf("failed to get CDC table pull-sync parallelism: %w", err)
	}

	return pullSyncParallelism, nil
}

func queryCDCPollDurations(
	ctx context.Context,
	config *protos.FlowConnectionConfigsCore,
) (time.Duration, time.Duration, error) {
	queryCdcConfig := config.GetBigqueryCdcConfig().GetQueryCdc()
	safetyLag := time.Duration(queryCdcConfig.GetSafetyLagSeconds()) * time.Second
	if safetyLag <= 0 {
		var err error
		safetyLag, err = internal.PeerDBQueryCDCSafetyLag(ctx, config.Env)
		if err != nil {
			return 0, 0, fmt.Errorf("failed to get query-based CDC safety lag: %w", err)
		}
	}

	maxQueryWindow := time.Duration(queryCdcConfig.GetMaxQueryWindowSeconds()) * time.Second
	if maxQueryWindow <= 0 {
		var err error
		maxQueryWindow, err = internal.PeerDBQueryCDCMaxQueryWindow(ctx, config.Env)
		if err != nil {
			return 0, 0, fmt.Errorf("failed to get query-based CDC max query window: %w", err)
		}
	}

	return safetyLag, maxQueryWindow, nil
}

// queryCDCPollWindow computes the next bounded source-time window. A false
// return means the safety lag has not moved past the table's checkpoint yet.
func queryCDCPollWindow(
	checkpoint, now time.Time, safetyLag, maxQueryWindow time.Duration,
) (time.Time, bool) {
	end := checkpoint.Add(maxQueryWindow)
	if safeEnd := now.Add(-safetyLag); safeEnd.Before(end) {
		end = safeEnd
	}
	return end, end.After(checkpoint)
}

// queryCDCPollWait mirrors bigquery/cdc.go's checkpoint.nextPollWait,
// generalized to the activity level: a table is due once syncInterval has
// passed since its last successful poll started. LastSyncedAt distinguishes a
// completed attempt from a newer failed or interrupted one, which is due now.
func queryCDCPollWait(
	lastAttemptAt time.Time, lastSyncedAt time.Time, now time.Time, syncInterval time
```

### Core Architecture Module: `flow/activities/maintenance_activity.go`
```
package activities

import (
	"context"
	"errors"
	"fmt"
	"log/slog"
	"regexp"
	"time"

	"github.com/jackc/pgx/v5"
	"go.opentelemetry.io/otel/attribute"
	"go.opentelemetry.io/otel/metric"
	"go.temporal.io/api/serviceerror"
	"go.temporal.io/api/workflowservice/v1"
	"go.temporal.io/sdk/activity"
	"go.temporal.io/sdk/client"
	proto2 "google.golang.org/protobuf/proto"
	"google.golang.org/protobuf/reflect/protoreflect"
	"google.golang.org/protobuf/types/known/timestamppb"

	"github.com/PeerDB-io/peerdb/flow/alerting"
	"github.com/PeerDB-io/peerdb/flow/generated/protos"
	"github.com/PeerDB-io/peerdb/flow/internal"
	"github.com/PeerDB-io/peerdb/flow/model"
	"github.com/PeerDB-io/peerdb/flow/otel_metrics"
	"github.com/PeerDB-io/peerdb/flow/shared"
)

const (
	mirrorStateBackup   = "backup"
	mirrorStateRestored = "restore"
)

type MaintenanceActivity struct {
	CatalogPool    shared.CatalogPool
	Alerter        *alerting.Alerter
	TemporalClient client.Client
	OtelManager    *otel_metrics.OtelManager
}

func (a *MaintenanceActivity) GetAllMirrors(ctx context.Context) (*protos.MaintenanceMirrors, error) {
	rows, err := a.CatalogPool.Query(ctx, `
	select distinct on(name)
	  id, name, workflow_id,
	  created_at, updated_at, coalesce(query_string, '')='' is_cdc
	from flows
	`)
	if err != nil {
		return nil, err
	}

	maintenanceMirrorItems, err := pgx.CollectRows(rows, func(row pgx.CollectableRow) (*protos.MaintenanceMirror, error) {
		var info protos.MaintenanceMirror
		var createdAt, updatedAt time.Time
		err := row.Scan(&info.MirrorId, &info.MirrorName, &info.WorkflowId, &createdAt, &updatedAt, &info.IsCdc)
		info.MirrorCreatedAt = timestamppb.New(createdAt)
		info.MirrorUpdatedAt = timestamppb.New(updatedAt)
		return &info, err
	})
	return &protos.MaintenanceMirrors{
		Mirrors: maintenanceMirrorItems,
	}, err
}

func (a *MaintenanceActivity) getMirrorStatus(ctx context.Context, mirror *protos.MaintenanceMirror) (protos.FlowStatus, error) {
	return internal.GetWorkflowStatus(ctx, a.CatalogPool, mirror.WorkflowId)
}

func (a *MaintenanceActivity) WaitForRunningSnapshotsAndIntermediateStates(
	ctx context.Context,
	skippedFlows map[string]struct{},
) (*protos.MaintenanceMirrors, error) {
	mirrors, err := a.GetAllMirrors(ctx)
	if err != nil {
		return nil, err
	}
	for {
		checkStartTime := time.Now()
		slog.InfoContext(ctx, "Found mirrors for snapshot check", "mirrors", mirrors, "len", len(mirrors.Mirrors))

		for _, mirror := range mirrors.Mirrors {
			if _, shouldSkip := skippedFlows[mirror.MirrorName]; shouldSkip {
				slog.WarnContext(ctx, "Skipping wait for mirror as it was in the skippedFlows", "mirror", mirror.MirrorName)
				continue
			}
			lastStatus, err := a.checkAndWaitIfNeeded(ctx, mirror, 2*time.Minute)
			if err != nil {
				return nil, err
			}
			slog.InfoContext(ctx, "Finished checking and waiting for snapshot",
				"mirror", mirror.MirrorName, "workflowId", mirror.WorkflowId, "lastStatus", lastStatus.String())
		}
		slog.InfoContext(ctx, "Finished checking and waiting for all mirrors to finish snapshot")

		// New mirrors can come in while we wait, so we check for new ones and retry waiting if we find any
		mirrors, err = a.GetAllMirrors(ctx)
		if err != nil {
			return nil, fmt.Errorf("failed to get mirrors during new mirror check: %w", err)
		}
		allMirrorsChecked := true
		for _, mirror := range mirrors.Mirrors {
			if mirror.MirrorCreatedAt.AsTime().After(checkStartTime) || mirror.MirrorUpdatedAt.AsTime().After(checkStartTime) {
				slog.WarnContext(ctx, "Found a new mirror while checking for snapshots",
					slog.String("mirror", mirror.MirrorName), slog.Any("info", mirror))
				allMirrorsChecked = false
				break
			}
		}
		if allMirrorsChecked {
			break
		}
	}
	return mirrors, nil
}

var waitStatuses = buildWaitStatuses()

func buildWaitStatuses() map[protos.FlowStatus]struct{} {
	waitStatuses := make(map[protos.FlowStatus]struct{})

	for index := range protos.FlowStatus_name {
		flowStatus := protos.FlowStatus(index)

		// Get the enum value descriptor
		enumValueDesc := flowStatus.Descriptor().Values().ByNumber(protoreflect.EnumNumber(index))
		if enumValueDesc == nil {
			continue
		}

		// Get the extension value from the enum value options
		if proto2.HasExtension(enumValueDesc.Options(), protos.E_PeerdbMaintenanceWait) {
			waitValue := proto2.GetExtension(enumValueDesc.Options(), protos.E_PeerdbMaintenanceWait)
			if boolVal, ok := waitValue.(bool); ok && boolVal {
				waitStatuses[flowStatus] = struct{}{}
			}
		}
	}

	return waitStatuses
}

func (a *MaintenanceActivity) checkAndWaitIfNeeded(
	ctx context.Context,
	mirror *protos.MaintenanceMirror,
	logEvery time.Duration,
) (protos.FlowStatus, error) {
	// In case a mirror was just kicked off, it shows up in the running state, we wait for a bit before checking for snapshot
	targetCheckTime := mirror.MirrorCreatedAt.AsTime().Add(30 * time.Second)
	now := time.Now()
	if now.Before(targetCheckTime) {
		slog.InfoContext(ctx, "Mirror was created less than 30 seconds ago, waiting for it to be ready before checking for snapshot",
			"mirror", mirror.MirrorName, "workflowId", mirror.WorkflowId)
		time.Sleep(targetCheckTime.Sub(now))
	}

	flowStatus, err := RunEveryIntervalUntilFinish(ctx, func() (bool, protos.FlowStatus, error) {
		activity.RecordHeartbeat(ctx, fmt.Sprintf("Waiting for mirror %s to be ready", mirror.MirrorName))
		mirrorStatus, err := a.getMirrorStatus(ctx, mirror)
		if err != nil {
			return false, mirrorStatus, err
		}
		if _, isWait := waitStatuses[mirrorStatus]; isWait {
			return false, mirrorStatus, nil
		}
		return true, mirrorStatus, nil
	}, 10*time.Second, fmt.Sprintf("Waiting for mirror %s to be ready", mirror.MirrorName), logEvery, true)
	return flowStatus, err
}

func (a *MaintenanceActivity) EnableMaintenanceMode(ctx context.Context) error {
	slog.InfoContext(ctx, "Enabling maintenance mode")
	return internal.UpdatePeerDBMaintenanceModeEnabled(ctx, a.CatalogPool, true)
}

func (a *MaintenanceActivity) BackupAllPreviouslyRunningFlows(ctx context.Context, mirrors *protos.MaintenanceMirrors) error {
	tx, err := a.CatalogPool.Begin(ctx)
	if err != nil {
		return err
	}
	defer shared.RollbackTx(tx, slog.Default())

	for _, mirror := range mirrors.Mirrors {
		_, err := tx.Exec(ctx, `
		insert into maintenance.maintenance_flows
			(flow_id, flow_name, workflow_id, flow_created_at, is_cdc, state, from_version)
		values
			($1, $2, $3, $4, $5, $6, $7)
		`, mirror.MirrorId, mirror.MirrorName, mirror.WorkflowId, mirror.MirrorCreatedAt.AsTime(), mirror.IsCdc, mirrorStateBackup,
			internal.PeerDBVersionShaShort())
		if err != nil {
			return err
		}
	}
	return tx.Commit(ctx)
}

var workflowNotFoundMessageRe = regexp.MustCompile("workflow not found for ID: (.+)")

func (a *MaintenanceActivity) PauseMirrorIfRunning(ctx context.Context, mirror *protos.MaintenanceMirror) (bool, error) {
	logger := slog.With("mirror", mirror.MirrorName, "workflowId", mirror.WorkflowId)
	mirrorStatus, err := a.getMirrorStatus(ctx, mirror)
	if err != nil {
		logger.WarnContext(ctx, "Error getting mirror status", slog.Any("error", err))
		if notFoundErr, ok := errors.AsType[*serviceerror.NotFound](err); ok && workflowNotFoundMessageRe.MatchString(notFoundErr.Message) {
			logger.WarnContext(ctx, "Received a workflow not found error, checking if the workflow is missing and if it is older than 90 days",
				"error", err, "temporalCertAuth", internal.PeerDBTemporalEnableCertAuth())
			// This is max temporal retention period, but this is mirror update time, not deletion time, so it is not accurate
			if mirror.MirrorUpdatedAt.AsTime().Before(time.Now().Add(-90*24*time.Hour)) &&
				// We are in Temporal Cloud
				internal.PeerDBTemporalEnableCertAuth() {
				// workflow not found for ID: mirror_d1e3f532__8adb__4f79__9d00__01e44b6bcbfb-peerflow-27144d2c-06ce-4552-87e5-696b3a909702
				logger.WarnContext(ctx, "Workflow not found in Temporal Cloud and mirror is old, checking for existing workflows"
```

### Core Architecture Module: `flow/activities/snapshot_activity.go`
```
package activities

import (
	"context"
	"fmt"
	"log/slog"
	"sync"
	"time"

	"go.temporal.io/sdk/activity"

	"github.com/PeerDB-io/peerdb/flow/alerting"
	"github.com/PeerDB-io/peerdb/flow/connectors"
	"github.com/PeerDB-io/peerdb/flow/generated/protos"
	"github.com/PeerDB-io/peerdb/flow/internal"
	"github.com/PeerDB-io/peerdb/flow/pkg/common"
	"github.com/PeerDB-io/peerdb/flow/shared"
)

type SlotSnapshotState struct {
	connector      connectors.CDCPullConnectorCore
	connectorClose func(ctx context.Context)
	slotConn       interface{ Close(context.Context) error }
	snapshotName   string
}

type TxSnapshotState struct {
	SnapshotName        string
	SnapshotStagingPath string
}

type SnapshotActivity struct {
	Alerter             *alerting.Alerter
	CatalogPool         shared.CatalogPool
	SlotSnapshotStates  map[string]SlotSnapshotState
	TxSnapshotStates    map[string]TxSnapshotState
	SnapshotStatesMutex sync.Mutex
}

// closes the slot signal
func (a *SnapshotActivity) CloseSlotKeepAlive(ctx context.Context, flowJobName string) error {
	a.SnapshotStatesMutex.Lock()
	defer a.SnapshotStatesMutex.Unlock()

	if s, ok := a.SlotSnapshotStates[flowJobName]; ok {
		if s.slotConn != nil {
			logger := internal.LoggerFromCtx(ctx)
			if err := s.slotConn.Close(ctx); err != nil {
				logger.Error("failed to close the slot connection", slog.Any("error", err))
			} else {
				logger.Info("closed the slot connection")
			}
		}
		s.connectorClose(ctx)
		delete(a.SlotSnapshotStates, flowJobName)
	}

	return nil
}

func (a *SnapshotActivity) SetupReplication(
	ctx context.Context,
	config *protos.SetupReplicationInput,
) (*protos.SetupReplicationOutput, error) {
	ctx = context.WithValue(ctx, shared.FlowNameKey, config.FlowJobName)
	logger := internal.LoggerFromCtx(ctx)
	a.Alerter.LogFlowInfo(ctx, config.FlowJobName, "Setting up replication slot and publication")

	conn, connClose, err := connectors.GetByNameAs[connectors.CDCPullConnectorCore](ctx, nil, a.CatalogPool, config.PeerName)
	if err != nil {
		return nil, a.Alerter.LogFlowError(ctx, config.FlowJobName, fmt.Errorf("failed to get connector: %w", err))
	}

	logger.Info("waiting for slot to be created...")
	slotInfo, err := conn.SetupReplication(ctx, a.CatalogPool, config)

	if err != nil {
		connClose(ctx)
		// it is important to close the connection here as it is not closed in CloseSlotKeepAlive
		return nil, a.Alerter.LogFlowError(ctx, config.FlowJobName, shared.WrapError("slot error", err))
	} else if slotInfo.Conn == nil && slotInfo.SlotName == "" {
		connClose(ctx)
		logger.Info("replication setup without slot")
		return nil, nil
	} else {
		logger.Info("slot created", slog.String("SlotName", slotInfo.SlotName))
	}

	a.SnapshotStatesMutex.Lock()
	a.SlotSnapshotStates[config.FlowJobName] = SlotSnapshotState{
		slotConn:       slotInfo.Conn,
		snapshotName:   slotInfo.SnapshotName,
		connector:      conn,
		connectorClose: connClose,
	}
	a.SnapshotStatesMutex.Unlock()

	a.Alerter.LogFlowInfo(ctx, config.FlowJobName, "Replication slot and publication setup complete")

	return &protos.SetupReplicationOutput{
		SlotName:     slotInfo.SlotName,
		SnapshotName: slotInfo.SnapshotName,
	}, nil
}

func (a *SnapshotActivity) MaintainTx(ctx context.Context, sessionID string, flowName string, peer string, env map[string]string) error {
	shutdown := common.HeartbeatRoutine(ctx, func() string {
		return "maintaining transaction snapshot"
	})
	defer shutdown()
	conn, connClose, err := connectors.GetByNameAs[connectors.CDCPullConnectorCore](ctx, nil, a.CatalogPool, peer)
	if err != nil {
		return a.Alerter.LogFlowError(ctx, sessionID, err)
	}
	defer connClose(ctx)

	exportSnapshotOutput, tx, err := conn.ExportTxSnapshot(ctx, flowName, env)
	if err != nil {
		return err
	}

	a.SnapshotStatesMutex.Lock()
	if exportSnapshotOutput != nil {
		a.TxSnapshotStates[sessionID] = TxSnapshotState{
			SnapshotName:        exportSnapshotOutput.SnapshotName,
			SnapshotStagingPath: exportSnapshotOutput.SnapshotStagingPath,
		}
	} else {
		a.TxSnapshotStates[sessionID] = TxSnapshotState{}
	}
	a.SnapshotStatesMutex.Unlock()

	logger := internal.LoggerFromCtx(ctx)
	start := time.Now()
	for {
		logger.Info("maintaining export snapshot transaction", slog.Int64("seconds", int64(time.Since(start).Round(time.Second)/time.Second)))
		if ctx.Err() != nil {
			a.SnapshotStatesMutex.Lock()
			delete(a.TxSnapshotStates, sessionID)
			a.SnapshotStatesMutex.Unlock()
			if err := conn.FinishExport(tx); err != nil {
				logger.Error("finish export error", slog.Any("error", err))
				return err
			}
			return nil
		}
		time.Sleep(time.Minute)
	}
}

func (a *SnapshotActivity) WaitForExportSnapshot(ctx context.Context, sessionID string) (*TxSnapshotState, error) {
	logger := internal.LoggerFromCtx(ctx)
	attempt := 0
	for {
		a.SnapshotStatesMutex.Lock()
		tsc, ok := a.TxSnapshotStates[sessionID]
		a.SnapshotStatesMutex.Unlock()
		if ok {
			return &tsc, nil
		}
		activity.RecordHeartbeat(ctx, "wait another second for snapshot export")
		attempt += 1
		if attempt > 2 {
			logger.Info("waiting on snapshot export", slog.Int("attempt", attempt))
		}
		if err := ctx.Err(); err != nil {
			return nil, err
		}
		time.Sleep(time.Second)
	}
}

func (a *SnapshotActivity) LoadTableSchema(
	ctx context.Context,
	flowName string,
	tableName string,
) (*protos.TableSchema, error) {
	return internal.LoadTableSchemaFromCatalog(ctx, a.CatalogPool, flowName, tableName)
}

func (a *SnapshotActivity) GetPeerType(ctx context.Context, name string) (protos.DBType, error) {
	return connectors.LoadPeerType(ctx, a.CatalogPool, name)
}

func (a *SnapshotActivity) GetDefaultPartitionKeyForTables(
	ctx context.Context,
	input *protos.FlowConnectionConfigsCore,
) (*protos.GetDefaultPartitionKeyForTablesOutput, error) {
	conn, connClose, err := connectors.GetByNameAs[connectors.QRepPullConnectorCore](ctx, nil, a.CatalogPool, input.SourceName)
	if err != nil {
		return nil, a.Alerter.LogFlowError(ctx, input.FlowJobName, fmt.Errorf("failed to get connector: %w", err))
	}
	defer connClose(ctx)

	dstTableNames := make([]string, 0, len(input.TableMappings))
	for _, tm := range input.TableMappings {
		dstTableNames = append(dstTableNames, tm.DestinationTableIdentifier)
	}
	schemasByDstTable, err := internal.LoadTableSchemasFromCatalog(ctx, a.CatalogPool.Pool, input.FlowJobName, dstTableNames)
	if err != nil {
		return nil, a.Alerter.LogFlowError(ctx, input.FlowJobName, fmt.Errorf("failed to load table schemas from catalog: %w", err))
	}
	tableSchemaMapping := make(map[string]*protos.TableSchema, len(input.TableMappings))
	for _, tm := range input.TableMappings {
		if schema, ok := schemasByDstTable[tm.DestinationTableIdentifier]; ok {
			tableSchemaMapping[tm.SourceTableIdentifier] = schema
		}
	}

	output, err := conn.GetDefaultPartitionKeyForTables(ctx, &protos.GetDefaultPartitionKeyForTablesInput{
		TableMappings:      input.TableMappings,
		TableSchemaMapping: tableSchemaMapping,
	})
	if err != nil {
		return nil, a.Alerter.LogFlowError(ctx, input.FlowJobName, fmt.Errorf("failed to check if tables can parallel load: %w", err))
	}

	return output, nil
}

```

### Core Architecture Module: `flow/alerting/alerting.go`
```
package alerting

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"log/slog"
	"slices"
	"strings"
	"time"

	"github.com/jackc/pgx/v5"
	"go.opentelemetry.io/otel/attribute"
	"go.opentelemetry.io/otel/metric"

	"github.com/PeerDB-io/peerdb/flow/generated/protos"
	"github.com/PeerDB-io/peerdb/flow/internal"
	"github.com/PeerDB-io/peerdb/flow/otel_metrics"
	"github.com/PeerDB-io/peerdb/flow/shared"
)

// alerting service, no cool name :(
type Alerter struct {
	shared.CatalogPool
	otelManager *otel_metrics.OtelManager
}

type AlertSenderConfig struct {
	Sender          AlertSender
	AlertForMirrors []string
	Id              int64
}

type AlertKeys struct {
	FlowName string
	PeerName string
	SlotName string
}

// doesn't take care of closing pool, needs to be done externally.
func NewAlerter(_ context.Context, catalogPool shared.CatalogPool, otelManager *otel_metrics.OtelManager) *Alerter {
	if catalogPool.Pool == nil {
		panic("catalog pool is nil for Alerter")
	}
	return &Alerter{
		CatalogPool: catalogPool,
		otelManager: otelManager,
	}
}

func (a *Alerter) registerSendersFromPool(ctx context.Context) ([]AlertSenderConfig, error) {
	rows, err := a.CatalogPool.Query(ctx,
		`SELECT id, service_type, service_config, enc_key_id, alert_for_mirrors
		FROM peerdb_stats.alerting_config`)
	if err != nil {
		return nil, fmt.Errorf("failed to read alerter config from catalog: %w", err)
	}

	keys := internal.PeerDBEncKeys(ctx)
	return pgx.CollectRows(rows, func(row pgx.CollectableRow) (AlertSenderConfig, error) {
		var alertSenderConfig AlertSenderConfig
		var serviceType ServiceType
		var serviceConfigEnc []byte
		var encKeyId string
		if err := row.Scan(&alertSenderConfig.Id, &serviceType, &serviceConfigEnc, &encKeyId,
			&alertSenderConfig.AlertForMirrors); err != nil {
			return alertSenderConfig, err
		}

		key, err := keys.Get(encKeyId)
		if err != nil {
			return alertSenderConfig, err
		}
		serviceConfig, err := key.Decrypt(serviceConfigEnc)
		if err != nil {
			return alertSenderConfig, err
		}

		switch serviceType {
		case SLACK:
			var slackServiceConfig slackAlertConfig
			if err := json.Unmarshal(serviceConfig, &slackServiceConfig); err != nil {
				return alertSenderConfig, fmt.Errorf("failed to unmarshal %s service config: %w", serviceType, err)
			}

			alertSenderConfig.Sender = newSlackAlertSender(&slackServiceConfig)
			return alertSenderConfig, nil
		case EMAIL:
			var replyToAddresses []string
			if replyToEnvString := strings.TrimSpace(
				internal.PeerDBAlertingEmailSenderReplyToAddresses()); replyToEnvString != "" {
				replyToAddresses = strings.Split(replyToEnvString, ",")
			}
			emailServiceConfig := EmailAlertSenderConfig{
				sourceEmail:          internal.PeerDBAlertingEmailSenderSourceEmail(),
				configurationSetName: internal.PeerDBAlertingEmailSenderConfigurationSet(),
				replyToAddresses:     replyToAddresses,
			}
			if emailServiceConfig.sourceEmail == "" {
				return alertSenderConfig, fmt.Errorf("missing sourceEmail for Email alerting service")
			}
			if err := json.Unmarshal(serviceConfig, &emailServiceConfig); err != nil {
				return alertSenderConfig, fmt.Errorf("failed to unmarshal %s service config: %w", serviceType, err)
			}
			var region *string
			if envRegion := internal.PeerDBAlertingEmailSenderRegion(); envRegion != "" {
				region = &envRegion
			}

			alertSender, alertSenderErr := NewEmailAlertSenderWithNewClient(ctx, region, &emailServiceConfig)
			if alertSenderErr != nil {
				return AlertSenderConfig{}, fmt.Errorf("failed to initialize email alerter: %w", alertSenderErr)
			}
			alertSenderConfig.Sender = alertSender

			return alertSenderConfig, nil
		default:
			return alertSenderConfig, fmt.Errorf("unknown service type: %s", serviceType)
		}
	})
}

func (a *Alerter) AlertIfSlotLag(ctx context.Context, alertKeys *AlertKeys, slotInfo *protos.SlotInfo) {
	alertSenderConfigs, err := a.registerSendersFromPool(ctx)
	if err != nil {
		internal.LoggerFromCtx(ctx).Warn("failed to set alert senders", slog.Any("error", err))
		return
	}

	deploymentUIDPrefix := ""
	if internal.PeerDBDeploymentUID() != "" {
		deploymentUIDPrefix = fmt.Sprintf("[%s] ", internal.PeerDBDeploymentUID())
	}

	defaultSlotLagMBAlertThreshold, err := internal.PeerDBSlotLagMBAlertThreshold(ctx, nil)
	if err != nil {
		internal.LoggerFromCtx(ctx).Warn("failed to get slot lag alert threshold from catalog", slog.Any("error", err))
		return
	}

	// catalog cannot use default threshold to space alerts properly, use the lowest set threshold instead
	lowestSlotLagMBAlertThreshold := defaultSlotLagMBAlertThreshold
	var alertSendersForMirrors []AlertSenderConfig
	for _, alertSenderConfig := range alertSenderConfigs {
		if len(alertSenderConfig.AlertForMirrors) == 0 || slices.Contains(alertSenderConfig.AlertForMirrors, alertKeys.FlowName) {
			alertSendersForMirrors = append(alertSendersForMirrors, alertSenderConfig)
			if alertSenderConfig.Sender.getSlotLagMBAlertThreshold() > 0 {
				lowestSlotLagMBAlertThreshold = min(lowestSlotLagMBAlertThreshold, alertSenderConfig.Sender.getSlotLagMBAlertThreshold())
			}
		}
	}

	thresholdAlertKey := fmt.Sprintf("%s Slot Lag Threshold Exceeded for Peer %s", deploymentUIDPrefix, alertKeys.PeerName)
	thresholdAlertMessageTemplate := fmt.Sprintf("%sSlot `%s` on peer `%s` has exceeded threshold size of %%dMB, "+
		`currently at %.2fMB!`, deploymentUIDPrefix, slotInfo.SlotName, alertKeys.PeerName, slotInfo.LagInMb)

	badWalStatusAlertKey := fmt.Sprintf("%s Bad WAL Status for Peer %s", deploymentUIDPrefix, alertKeys.PeerName)
	badWalStatusAlertMessage := fmt.Sprintf("%sSlot `%s` on peer `%s` has bad WAL status: `%s`",
		deploymentUIDPrefix, slotInfo.SlotName, alertKeys.PeerName, slotInfo.WalStatus)

	for _, alertSenderConfig := range alertSendersForMirrors {
		if a.checkAndAddAlertToCatalog(ctx,
			alertSenderConfig.Id, thresholdAlertKey,
			fmt.Sprintf(thresholdAlertMessageTemplate, lowestSlotLagMBAlertThreshold)) {
			if alertSenderConfig.Sender.getSlotLagMBAlertThreshold() > 0 {
				if slotInfo.LagInMb > float32(alertSenderConfig.Sender.getSlotLagMBAlertThreshold()) {
					a.alertToProvider(ctx, alertSenderConfig, thresholdAlertKey,
						fmt.Sprintf(thresholdAlertMessageTemplate, alertSenderConfig.Sender.getSlotLagMBAlertThreshold()))
				}
			} else {
				if slotInfo.LagInMb > float32(defaultSlotLagMBAlertThreshold) {
					a.alertToProvider(ctx, alertSenderConfig, thresholdAlertKey,
						fmt.Sprintf(thresholdAlertMessageTemplate, defaultSlotLagMBAlertThreshold))
				}
			}
		}

		if (slotInfo.WalStatus == "lost" || slotInfo.WalStatus == "unreserved") &&
			a.checkAndAddAlertToCatalog(ctx, alertSenderConfig.Id, badWalStatusAlertKey, badWalStatusAlertMessage) {
			a.alertToProvider(ctx, alertSenderConfig, badWalStatusAlertKey, badWalStatusAlertMessage)
		}
	}
}

func (a *Alerter) AlertIfOpenConnections(ctx context.Context, alertKeys *AlertKeys,
	openConnections *protos.GetOpenConnectionsForUserResult,
) {
	alertSenderConfigs, err := a.registerSendersFromPool(ctx)
	if err != nil {
		internal.LoggerFromCtx(ctx).Warn("failed to set alert senders", slog.Any("error", err))
		return
	}

	deploymentUIDPrefix := ""
	if internal.PeerDBDeploymentUID() != "" {
		deploymentUIDPrefix = fmt.Sprintf("[%s] - ", internal.PeerDBDeploymentUID())
	}

	// same as with slot lag, use lowest threshold for catalog
	defaultOpenConnectionsThreshold, err := internal.PeerDBOpenConnectionsAlertThreshold(ctx, nil)
	if err != nil {
		internal.LoggerFromCtx(ctx).Warn("failed to get open connections alert threshold from catalog", slog.Any("error", err))
		return
	}
	lowestOpenConnectionsThreshold := defaultOpenConnectionsThreshold
	for _, alertSender := range alertSenderConfigs {
		if alertSender.Sender.getOpenConnectionsAlertThreshold() > 0 {
			lowestOpenConnectionsThreshold = min(lowestOpenConnectionsThreshold,
				alertSender.Sender.getOpenConnectionsAlertThreshold())
		}
	}

	alertKey := fmt.Sprintf("%s Max Open Connections Thres
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

### Incident Patch 1: `b2aef2d9` (2026-09-29)
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
+					wantCols:  schemaMapping{lowerLower
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

### Incident Patch 2: `09275a3a` (2026-09-29)
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
@@ -241,7 +200,7 @@ func (c *BigQueryConnec
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

---

### Incident Patch 3: `b384c290` (2026-09-29)
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

### Incident Patch 4: `c9ab04d4` (2026-09-29)
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

### Incident Patch 5: `4394ca8c` (2026-09-29)
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

### Incident Patch 6: `edceff09` (2026-09-28)
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

### Incident Patch 7: `02b9ff53` (2026-09-24)
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

### Incident Patch 8: `51409be8` (2026-09-24)
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

### Incident Patch 9: `8e825c0f` (2026-09-22)
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

Co-authored-by: Claude Opus 5 (1M context) <noreply@anthropic.com>

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
+			c.logger.I
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

### Incident Patch 10: `318c2b12` (2026-09-22)
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

Co-authored-by: Cursor <cursoragent@cursor.com>

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
- **PR #4877** (2026-09-30): feat: update `aws-rds-bundle-shasum` in Dockerfile (@github-actions[bot])
- **PR #4874** (2026-09-30): Update dockerfile dependencies (@renovate[bot])
- **PR #4872** (2026-09-28): refactor(cloudsql): align IAM auth with RDS auth and require tls_host (@dtunikov)
- **PR #4871** (2026-09-28): Show CDC table counts for BigQuery mirrors (@dtunikov)
- **PR #4868** (2026-09-29): Fix CDC flow setup flake (@ilidemi)
- **PR #4867** (2026-09-29): Fix SSH tunnel test CI flake: enable TCP forwarding via sshd_config.d instead of a DOCKER_MOD (@ilidemi)
- **PR #4866** (2026-09-29): Fix flaky Test_BigQuery_CDC_Query_Mode_Multi_File_Batch: make every CDC row exceed the Avro file limit (@ilidemi)
- **PR #4865** (2026-09-28): Fix flaky `TestPullRecordsWorkerPoolErrorFromWorker`: return worker errors from `Flush` reliably (@ilidemi)

---

## 3. Empirical Evidence & Compliance Certification
- **Evidence Provenance**: Fetched directly from verified official GitHub REST API.
- **Zero Disk Footprint**: 0 bytes of unnecessary repository bloat stored locally.
- **TOS & Free-Tier Adherence**: Request pace complied with public API guidelines without fee, penalty, or unauthorized scraping.

---

## 4. Promotion & Integration Status
- **Status**: HARVESTED_DEEP_FORENSIC
- **Master Brain Sync**: Auto-committed to local/remote Master Brain repository.
