# Forensic Learning Record (Deep Inspection): dtyq/magic

> **Canonical Artifact**: `07_PROJECT_LEARNING/dtyq-magic-learnings.md`  
> **Source Platform**: GitHub ([https://github.com/dtyq/magic](https://github.com/dtyq/magic))  
> **Harvest Method**: Full-Spectrum Deep Extraction (Patches, Diffs, Source Code, Post-Mortems)  
> **Harvest Timestamp**: 2026-10-06T04:46:35.518Z  
> **Compliance State**: Free Tier Guaranteed | Strict Rate-Limit Backoff Honored  

---

## 1. Context & Architectural Overview
- **Repository / Resource**: `dtyq/magic`
- **Description**: Magicrew. The first open-source all-in-one AI productivity platform (Generalist AI Agent + Workflow Engine + IM + Online collaborative office system)
- **Primary Language / Ecosystem**: TypeScript
- **Discovered Manifests / Configurations**: README.md
- **Stars / Engagement**: 5041 stars

---

## 2. Multi-Dimensional 8-Axis Investigation & Real Code Patches

### D1: Architecture & Structural Boundaries
- Entry configurations inspected via direct stream: README.md.
- Evaluated system abstractions and modular contracts.

### Core Architecture Module: `backend/magic-gateway/volcengine_handler.go`
```
package main

import (
	"bytes"
	"compress/gzip"
	"context"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"strings"
	"time"

	collogspb "go.opentelemetry.io/proto/otlp/collector/logs/v1"
	colmetricspb "go.opentelemetry.io/proto/otlp/collector/metrics/v1"
	coltracepb "go.opentelemetry.io/proto/otlp/collector/trace/v1"
	"google.golang.org/grpc"
	"google.golang.org/grpc/credentials/insecure"
	"google.golang.org/grpc/metadata"
	"google.golang.org/protobuf/encoding/protojson"
	"google.golang.org/protobuf/proto"
)

// VolcengineAPMHandler 处理火山全栈可观测平台的请求转换
type VolcengineAPMHandler struct {
	endpoint string
	appKey   string
}

// NewVolcengineAPMHandler 创建新的火山可观测平台处理器
func NewVolcengineAPMHandler(endpoint, appKey string) *VolcengineAPMHandler {
	return &VolcengineAPMHandler{
		endpoint: endpoint,
		appKey:   appKey,
	}
}

// decompressIfNeeded 检查并解压缩请求体（如果需要）
func decompressIfNeeded(r *http.Request, bodyBytes []byte) ([]byte, error) {
	// 检查 Content-Encoding 头
	encoding := r.Header.Get("Content-Encoding")

	if encoding == "gzip" {
		if debugMode {
			logger.Printf("检测到 gzip 压缩，开始解压缩...")
		}
		reader, err := gzip.NewReader(bytes.NewReader(bodyBytes))
		if err != nil {
			return nil, fmt.Errorf("创建 gzip reader 失败: %w", err)
		}
		defer reader.Close()

		decompressed, err := io.ReadAll(reader)
		if err != nil {
			return nil, fmt.Errorf("解压缩失败: %w", err)
		}

		if debugMode {
			logger.Printf("解压缩成功: %d bytes -> %d bytes", len(bodyBytes), len(decompressed))
		}
		return decompressed, nil
	}

	// 尝试自动检测 gzip 格式（即使没有 Content-Encoding 头）
	// gzip 文件魔数是 0x1f 0x8b
	if len(bodyBytes) >= 2 && bodyBytes[0] == 0x1f && bodyBytes[1] == 0x8b {
		if debugMode {
			logger.Printf("检测到 gzip 魔数，尝试解压缩...")
		}
		reader, err := gzip.NewReader(bytes.NewReader(bodyBytes))
		if err != nil {
			// 如果解压失败，返回原始数据
			if debugMode {
				logger.Printf("gzip 解压失败，使用原始数据: %v", err)
			}
			return bodyBytes, nil
		}
		defer reader.Close()

		decompressed, err := io.ReadAll(reader)
		if err != nil {
			// 如果解压失败，返回原始数据
			if debugMode {
				logger.Printf("gzip 解压失败，使用原始数据: %v", err)
			}
			return bodyBytes, nil
		}

		if debugMode {
			logger.Printf("自动解压缩成功: %d bytes -> %d bytes", len(bodyBytes), len(decompressed))
		}
		return decompressed, nil
	}

	// 不需要解压缩
	return bodyBytes, nil
}

// isVolcengineAPMDomain 检查域名是否是火山全栈可观测平台
func isVolcengineAPMDomain(domain string) bool {
	// 提取域名部分（去除协议和路径）
	domain = strings.TrimPrefix(domain, "http://")
	domain = strings.TrimPrefix(domain, "https://")
	if idx := strings.Index(domain, "/"); idx > 0 {
		domain = domain[:idx]
	}

	// 检查是否匹配火山可观测平台域名
	return strings.Contains(domain, "apmplus-cn-beijing.volces.com")
}

// HandleVolcengineAPMRequest 处理火山可观测平台的请求
// 将 HTTP 请求转换为 gRPC 请求
func (h *VolcengineAPMHandler) HandleVolcengineAPMRequest(
	w http.ResponseWriter,
	r *http.Request,
	targetURL string,
	bodyBytes []byte,
) error {
	// 先检查并解压缩请求体
	decompressed, err := decompressIfNeeded(r, bodyBytes)
	if err != nil {
		logger.Printf("解压缩请求失败: %v", err)
		return fmt.Errorf("解压缩请求失败: %w", err)
	}
	bodyBytes = decompressed

	// 判断请求类型（先从 URL 路径判断）
	requestType := h.detectRequestType(r.URL.Path)

	if debugMode {
		logger.Printf("从URL检测到类型: %s，准备智能检测实际类型...", requestType)
	}

	// 如果 URL 无法判断类型，尝试智能检测
	if requestType == "trace" && !strings.Contains(strings.ToLower(r.URL.Path), "trace") {
		// 尝试通过解析请求体来判断类型
		detectedType := h.detectRequestTypeFromBody(bodyBytes, r.Header.Get("Content-Type"))
		if detectedType != "" {
			requestType = detectedType
			if debugMode {
				logger.Printf("通过请求体智能检测到类型: %s", requestType)
			}
		}
	}

	if debugMode {
		logger.Printf("最终确定请求类型: %s", requestType)
	}

	// 根据请求类型进行不同的处理
	switch requestType {
	case "trace":
		return h.handleTraceRequest(w, r, bodyBytes)
	case "metrics":
		return h.handleMetricsRequest(w, r, bodyBytes)
	case "logs":
		return h.handleLogsRequest(w, r, bodyBytes)
	default:
		return fmt.Errorf("不支持的请求类型: %s", requestType)
	}
}

// detectRequestType 从URL路径中检测请求类型
func (h *VolcengineAPMHandler) detectRequestType(path string) string {
	path = strings.ToLower(path)

	if strings.Contains(path, "/v1/traces") || strings.Contains(path, "trace") {
		return "trace"
	}
	if strings.Contains(path, "/v1/metrics") || strings.Contains(path, "metric") {
		return "metrics"
	}
	if strings.Contains(path, "/v1/logs") || strings.Contains(path, "log") {
		return "logs"
	}

	// 默认返回trace
	return "trace"
}

// detectRequestTypeFromBody 通过尝试解析请求体来智能检测类型
func (h *VolcengineAPMHandler) detectRequestTypeFromBody(bodyBytes []byte, contentType string) string {
	if len(bodyBytes) == 0 {
		return ""
	}

	// 根据 Content-Type 决定使用哪种解析方式
	isJSON := strings.Contains(contentType, "application/json")

	// 尝试解析为 Metrics（最常见）
	if isJSON {
		var metricsRequest colmetricspb.ExportMetricsServiceRequest
		if err := protojson.Unmarshal(bodyBytes, &metricsRequest); err == nil {
			// 检查是否有有效的 metrics 数据
			if len(metricsRequest.ResourceMetrics) > 0 {
				return "metrics"
			}
		}
	} else {
		var metricsRequest colmetricspb.ExportMetricsServiceRequest
		if err := proto.Unmarshal(bodyBytes, &metricsRequest); err == nil {
			// 检查是否有有效的 metrics 数据
			if len(metricsRequest.ResourceMetrics) > 0 {
				return "metrics"
			}
		}
	}

	// 尝试解析为 Trace
	if isJSON {
		var traceRequest coltracepb.ExportTraceServiceRequest
		if err := protojson.Unmarshal(bodyBytes, &traceRequest); err == nil {
			// 检查是否有有效的 trace 数据
			if len(traceRequest.ResourceSpans) > 0 {
				return "trace"
			}
		}
	} else {
		var traceRequest coltracepb.ExportTraceServiceRequest
		if err := proto.Unmarshal(bodyBytes, &traceRequest); err == nil {
			// 检查是否有有效的 trace 数据
			if len(traceRequest.ResourceSpans) > 0 {
				return "trace"
			}
		}
	}

	// 尝试解析为 Logs
	if isJSON {
		var logsRequest collogspb.ExportLogsServiceRequest
		if err := protojson.Unmarshal(bodyBytes, &logsRequest); err == nil {
			// 检查是否有有效的 logs 数据
			if len(logsRequest.ResourceLogs) > 0 {
				return "logs"
			}
		}
	} else {
		var logsRequest collogspb.ExportLogsServiceRequest
		if err := proto.Unmarshal(bodyBytes, &logsRequest); err == nil {
			// 检查是否有有效的 logs 数据
			if len(logsRequest.ResourceLogs) > 0 {
				return "logs"
			}
		}
	}

	// 无法检测
	return ""
}

// handleTraceRequest 处理trace请求
func (h *VolcengineAPMHandler) handleTraceRequest(
	w http.ResponseWriter,
	r *http.Request,
	bodyBytes []byte,
) error {
	ctx, cancel := context.WithTimeout(context.Background(), 30*time.Second)
	defer cancel()

	// 解析HTTP请求体（支持 JSON 和 Protobuf 两种格式）
	// 注意：bodyBytes 已经在调用前解压缩过了
	var traceRequest coltracepb.ExportTraceServiceRequest
	contentType := r.Header.Get("Content-Type")

	if strings.Contains(contentType, "application/json") {
		// JSON 格式
		if err := protojson.Unmarshal(bodyBytes, &traceRequest); err != nil {
			logger.Printf("解析trace请求失败(JSON): %v", err)
			return fmt.Errorf("解析trace请求失败(JSON): %w", err)
		}
		if debugMode {
			logger.Printf("使用JSON格式解析trace请求")
		}
	} else {
		// Protobuf 二进制格式（默认）
		if err := proto.Unmarshal(bodyBytes, &traceRequest); err != nil {
			logger.Printf("解析trace请求失败(Protobuf): %v", err)
			return fmt.Errorf("解析trace请求失败(Protobuf): %w", err)
		}
		if debugMode {
			logger.Printf("使用Protobuf格式解析trace请求")
		}
	}

	// 创建gRPC连接，并设置header
	md := metadata.New(map[string]string{
		"x-byteapm-appkey": h.appKey,
	})
	ctx = metadata.NewOutgoingContext(ctx, md)

	conn, err := grpc.Dial(
		h.endpoint,
		grpc.WithTransportCredentials(insecure.NewCredentials()),
	)
	if err != nil {
		logger.Printf("创建gRPC连接失败: %v", err)
		return fmt.Errorf("创建gRPC连接失败: %w", err)
	}
	defer conn.Close()

	// 创建trace服务客户端
	client := coltracepb.NewTraceServiceClient(conn)

	// 发送gRPC请求
	resp, err := client.Export(ctx, &traceRequest)
	if err != nil {
		logger.Printf("发送trace gRPC请求失败: %v", err)
		return fmt.Errorf("发送trace gRPC请求失败: %w", err)
	}

	// 将gRPC响应转换为HTTP响应
	return h.writeJSONResponse(w, resp)
}

// handleMetricsRequest 处理metrics请求
func (h *VolcengineAPMHandler) handleMetricsRequest(
	w http.ResponseWriter,
	r *http.Request,
	bodyBytes []byte,
) error {
	ctx, cancel := context.WithTimeout(context.Background(), 30*time.Second)
	defer cancel()

	// 解析HTTP请求体（支持 JSON 和 Protobuf 两种格式）
	// 注意：bodyBytes 已经在调用前解压缩过了
	var metricsRequest colmetricspb.ExportMetricsServiceRequest
	contentType := r.Header.Get("Content-Type")

	if strings.Contains(contentType, "application/json") {
		// JSON 格式
		if err := protojson.Unmarshal(bodyBytes, &metricsRequest); err != nil {
			logger.Printf("解析metrics请求失败(JSON): %v", err)
			return fmt.Errorf("解析metrics请求失败(JSON): %w", err)
		}
		if debugMode {
			logger.Printf("使用JSON格式解析metrics请求")
		}
	} else {
		// Protobuf 二进制格式（默认）
		if err := proto.Unmarshal(bodyBytes, &metricsRequest); err != nil {
			logger.Printf("解析metrics请求失败(Protobuf): %v", err)
			return fmt.Errorf("解析metrics请求失败(Protobuf): %w", err)
		}
		if debugMode {
			logger.Printf("使用Protobuf格式解析metrics请求")
		}
	}

	// 创建gRPC连接，并设置header
	md := metadata.New(map[string]string{
		"x-byteapm-appkey": h.appKey,
	})
	ctx = metadata.NewOutgoingContext(ctx, md)

	conn, err := grpc.Dial(
		h.endpoint,
		grpc.WithTransportCredentials(insecure.NewCredentials()),
	)
	if err != nil {
		logger.Printf("创建gRPC连接失败: %v", err)
		return fmt.Errorf("创建gRPC连接失败: %w", err)
	}
	defer conn.Close()

	// 创建metrics服务客户端
	client := colmetricspb.NewMetricsServiceClient(conn)

	// 发送gRPC请求
	resp, err := client.Export(ctx, &metricsRequest)
	if err != nil {
		logger.Printf("发送metrics gRPC请求失败: %v", err)
		return fmt.Errorf("发送metrics gRPC请求失败: %w", err)
	}

	// 将gRPC响应转换为HTTP响应
	return h.writeJSONResponse(w, resp)
}

// handleLogsRequest 处理logs请求
func (h *VolcengineAPMHandler) handleLogsRequest(
	w http.ResponseWriter,
	r *http.Request,
	bodyBytes []byte,
) error {
	ctx, cancel := context.WithTimeout(context.Background(), 30*time.Second)
	defer cancel()

	// 解析HTTP请求体（支持 JSON 和 Protobuf 两种格式）
	// 注意：bodyBytes 已经在调用前解压缩过了
	var logsRequest collogspb.ExportLogsServiceRequest
	contentType := r.Header.Get("Content-Type")

	if strings.Contains(con
```

### Core Architecture Module: `backend/magic-service/go-engine/cmd/deadcode/main.go`
```
// Package main provides the incremental deadcode command entrypoint.
package main

import (
	"context"
	"fmt"
	"io"
	"os"

	"magic/internal/tools/smartdeadcode"
)

type deadcodeRunner interface {
	Run(ctx context.Context) error
}

type deadcodeRunnerFactory func(opts smartdeadcode.Options, stdout, stderr io.Writer) deadcodeRunner

func newDeadcodeRunner(opts smartdeadcode.Options, stdout, stderr io.Writer) deadcodeRunner {
	return smartdeadcode.NewRunner(opts, stdout, stderr)
}

func main() {
	os.Exit(run(os.Args[1:], os.Stdout, os.Stderr, newDeadcodeRunner))
}

func run(args []string, stdout, stderr io.Writer, factory deadcodeRunnerFactory) int {
	opts, err := smartdeadcode.ParseOptions(args)
	if err != nil {
		_, _ = fmt.Fprintln(stderr, err)
		return 1
	}

	if factory == nil {
		factory = newDeadcodeRunner
	}

	if err := factory(opts, stdout, stderr).Run(context.Background()); err != nil {
		return 1
	}

	return 0
}

```

### Core Architecture Module: `backend/magic-service/go-engine/cmd/fix_legacy_fragment_document_code/main.go`
```
// Package main 提供一次性修复历史空 document_code 片段的 CLI。
package main

import (
	"context"
	"flag"
	"fmt"
	"os"

	"github.com/redis/go-redis/v9"

	appfix "magic/internal/application/knowledge/fixlegacy"
	configloader "magic/internal/config"
	autoloadcfg "magic/internal/config/autoload"
	diapp "magic/internal/di/app"
	diinfra "magic/internal/di/infra"
	knowledge "magic/internal/di/knowledge"
	documentdomain "magic/internal/domain/knowledge/document/service"
	fragmodel "magic/internal/domain/knowledge/fragment/model"
	fragdomain "magic/internal/domain/knowledge/fragment/service"
	knowledgebasedomain "magic/internal/domain/knowledge/knowledgebase/service"
	"magic/internal/infrastructure/logging"
	mysql "magic/internal/infrastructure/persistence/mysql"
	"magic/internal/infrastructure/vectordb/qdrant"
)

const defaultSyncConcurrency = 4

type commandOptions struct {
	dryRun           bool
	organizationCode string
	knowledgeCode    string
	batchSize        int
	syncConcurrency  int
	startID          int64
	maxRows          int
}

type commandRunner struct {
	runner  *appfix.Runner
	cleanup func()
	logger  *logging.SugaredLogger
}

type commandClients struct {
	mysqlClient  *mysql.SQLCClient
	redisClient  *redis.Client
	qdrantClient *qdrant.Client
	cleanup      cleanupGroup
}

type cleanupGroup struct {
	funcs []func()
}

func (g cleanupGroup) Close() {
	for i := len(g.funcs) - 1; i >= 0; i-- {
		if g.funcs[i] != nil {
			g.funcs[i]()
		}
	}
}

func main() {
	os.Exit(run())
}

func run() int {
	options := parseFlags()
	ctx := context.Background()

	cmd, err := newCommandRunner()
	if err != nil {
		fmt.Fprintf(os.Stderr, "initialize fix command failed: %v\n", err)
		return 1
	}
	defer cmd.cleanup()

	result, err := cmd.runner.Run(ctx, appfix.Options{
		DryRun:           options.dryRun,
		OrganizationCode: options.organizationCode,
		KnowledgeCode:    options.knowledgeCode,
		BatchSize:        options.batchSize,
		SyncConcurrency:  options.syncConcurrency,
		StartID:          options.startID,
		MaxRows:          options.maxRows,
	})
	if err != nil {
		cmd.logger.KnowledgeErrorContext(ctx, "fix legacy fragment document code failed", "error", err)
		return 1
	}

	printResult(cmd.logger, result)
	if result.HasFailures() {
		return 1
	}
	return 0
}

func parseFlags() commandOptions {
	var options commandOptions
	flag.BoolVar(&options.dryRun, "dry_run", false, "Only scan and report, do not update MySQL or sync vector data")
	flag.StringVar(&options.organizationCode, "organization_code", "", "Restrict fix scope to one organization")
	flag.StringVar(&options.knowledgeCode, "knowledge_code", "", "Restrict fix scope to one knowledge base")
	flag.IntVar(&options.batchSize, "batch_size", 500, "Number of fragments scanned per batch")
	flag.IntVar(&options.syncConcurrency, "sync_concurrency", defaultSyncConcurrency, "Maximum concurrent knowledge-base sync workers")
	flag.Int64Var(&options.startID, "start_id", 0, "Resume from fragment id greater than this value")
	flag.IntVar(&options.maxRows, "max_rows", 0, "Maximum number of fragments to scan, 0 means no limit")
	flag.Parse()
	return options
}

func newCommandRunner() (*commandRunner, error) {
	cfg := configloader.New()
	rootLogger := logging.NewFromConfig(cfg.Logging)
	logger := rootLogger.Named("cmd.fix_legacy_fragment_document_code")

	clients, err := openCommandClients(cfg, logger)
	if err != nil {
		return nil, err
	}

	rpcServer := diinfra.ProvideRPCServerOverIPC(cfg, logger.Named("ipc"))
	accessTokenProvider := diinfra.ProvideAccessTokenProvider(cfg, rpcServer, logger.Named("access_token_provider"))
	embeddingClientFactory := diinfra.ProvideEmbeddingClientFactory(cfg, rpcServer, logger.Named("embedding_client_factory"), accessTokenProvider)
	defaultEmbeddingModel := diapp.ProvideEmbeddingDefaultModel(cfg)
	embeddingService := diinfra.ProvideEmbeddingService(
		cfg,
		clients.redisClient,
		embeddingClientFactory,
		defaultEmbeddingModel,
		logger.Named("embedding_service"),
	)
	embeddingRepo := diinfra.ProvideEmbeddingRepository(embeddingService)
	embeddingDimensionResolver := diinfra.ProvideEmbeddingDimensionResolver(cfg, embeddingService)

	embeddingCacheRepo := diinfra.ProvideEmbeddingCacheRepository(clients.mysqlClient, logger.Named("embedding_cache_repo"))
	knowledgeBaseRepo := diinfra.ProvideKnowledgeBaseRepository(clients.mysqlClient, clients.redisClient, logger.Named("knowledge_base_repo"))
	fragmentRepo := diinfra.ProvideFragmentRepository(clients.mysqlClient, logger.Named("fragment_repo"))
	documentRepo := diinfra.ProvideDocumentRepository(clients.mysqlClient, logger.Named("document_repo"))
	vectorMgmtRepo := diinfra.ProvideVectorDBManagementRepository(clients.qdrantClient)
	vectorDataRepo := diinfra.ProvideFragmentVectorDBDataRepository(clients.qdrantClient)

	embeddingDomainService := knowledge.ProvideEmbeddingDomainService(
		embeddingCacheRepo,
		embeddingCacheRepo,
		embeddingRepo,
		logger.Named("embedding_domain_service"),
	)
	knowledgeBaseDomainService := knowledge.ProvideKnowledgeBaseDomainService(
		knowledgeBaseRepo,
		vectorMgmtRepo,
		embeddingDimensionResolver,
		knowledge.ProvideKnowledgeBaseDomainConfig(defaultEmbeddingModel, cfg.Qdrant),
		logger.Named("knowledge_base_domain_service"),
	)
	fragmentDomainService := knowledge.ProvideFragmentDomainService(
		fragmentRepo,
		embeddingDomainService,
		fragdomain.FragmentDomainInfra{
			VectorMgmtRepo:        vectorMgmtRepo,
			VectorDataRepo:        vectorDataRepo,
			MetaReader:            knowledgeBaseRepo,
			DefaultEmbeddingModel: string(defaultEmbeddingModel),
			Logger:                logger.Named("fragment_domain_service"),
		},
	)
	documentDomainService := knowledge.ProvideDocumentDomainService(
		documentRepo,
		logger.Named("document_domain_service"),
	)

	return buildCommandRunner(
		knowledgeBaseDomainService,
		documentDomainService,
		fragmentDomainService,
		logger,
		clients.cleanup,
	), nil
}

func buildCommandRunner(
	knowledgeBaseDomainService *knowledgebasedomain.DomainService,
	documentDomainService *documentdomain.DomainService,
	fragmentDomainService *fragdomain.FragmentDomainService,
	logger *logging.SugaredLogger,
	cleanup cleanupGroup,
) *commandRunner {
	return &commandRunner{
		runner: newFixLegacyRunner(
			knowledgeBaseDomainService,
			documentDomainService,
			fragmentDomainService,
			logger,
		),
		cleanup: func() {
			cleanup.Close()
		},
		logger: logger,
	}
}

func openCommandClients(cfg *autoloadcfg.Config, logger *logging.SugaredLogger) (*commandClients, error) {
	mysqlClient, mysqlCleanup, err := diinfra.ProvideMySQLSQLCClient(cfg, logger.Named("mysql"))
	if err != nil {
		return nil, fmt.Errorf("provide mysql client: %w", err)
	}

	redisClient, redisCleanup, err := diinfra.ProvideRedisClient(cfg, logger.Named("redis"))
	if err != nil {
		mysqlCleanup()
		return nil, fmt.Errorf("provide redis client: %w", err)
	}

	qdrantClient, qdrantCleanup, err := diinfra.ProvideQdrantClient(cfg, logger.Named("qdrant"))
	if err != nil {
		redisCleanup()
		mysqlCleanup()
		return nil, fmt.Errorf("provide qdrant client: %w", err)
	}

	return &commandClients{
		mysqlClient:  mysqlClient,
		redisClient:  redisClient,
		qdrantClient: qdrantClient,
		cleanup: cleanupGroup{
			funcs: []func(){mysqlCleanup, redisCleanup, qdrantCleanup},
		},
	}, nil
}

func newFixLegacyRunner(
	knowledgeBaseDomainService *knowledgebasedomain.DomainService,
	documentDomainService *documentdomain.DomainService,
	fragmentDomainService *fragdomain.FragmentDomainService,
	logger *logging.SugaredLogger,
) *appfix.Runner {
	return appfix.NewRunner(
		&fragmentRunnerAdapter{service: fragmentDomainService},
		knowledgeBaseDomainService,
		documentDomainService,
		fragmentDomainService,
		logger,
	)
}

type fragmentRunnerAdapter struct {
	service *fragdomain.FragmentDomainService
}

func (a *fragmentRunnerAdapter) ListMissingDocumentCode(
	ctx context.Context,
	query appfix.ScanQuery,
) ([]*fragmodel.KnowledgeBaseFragment, error) {
	fragments, err := a.service.ListMissingDocumentCode(ctx, fragmodel.MissingDocumentCodeQuery{
		OrganizationCode: query.OrganizationCode,
		KnowledgeCode:    query.KnowledgeCode,
		StartID:          query.StartID,
		Limit:            query.Limit,
	})
	if err != nil {
		return nil, fmt.Errorf("list missing document code fragments: %w", err)
	}
	return fragments, nil
}

func (a *fragmentRunnerAdapter) BackfillDocumentCode(ctx context.Context, ids []int64, documentCode string) (int64, error) {
	rows, err := a.service.BackfillDocumentCode(ctx, ids, documentCode)
	if err != nil {
		return 0, fmt.Errorf("backfill document code: %w", err)
	}
	return rows, nil
}

func (a *fragmentRunnerAdapter) FindByIDs(ctx context.Context, ids []int64) ([]*fragmodel.KnowledgeBaseFragment, error) {
	fragments, err := a.service.FindByIDs(ctx, ids)
	if err != nil {
		return nil, fmt.Errorf("find fragments by ids: %w", err)
	}
	return fragments, nil
}

func printResult(logger *logging.SugaredLogger, result appfix.Result) {
	logger.Infow(
		"fix legacy fragment document code completed",
		"scanned", result.Scanned,
		"candidates", result.Candidates,
		"updated", result.Updated,
		"synced", result.Synced,
		"failed", result.Failed,
		"default_documents_found", result.DefaultDocumentsFound,
		"default_documents_created", result.DefaultDocumentsCreated,
	)
	for index, failure := range result.Failures {
		logger.KnowledgeWarnw(
			"fix legacy fragment document code failure sample",
			"sample_index", index+1,
			"knowledge_code", failure.KnowledgeCode,
			"fragment_ids", failure.FragmentIDs,
			"message", failure.Message,
		)
	}
}

```

### Core Architecture Module: `backend/magic-service/go-engine/cmd/golangcilint/main.go`
```
// Package main provides the incremental golangci-lint command entrypoint.
package main

import (
	"context"
	"fmt"
	"io"
	"os"

	"magic/internal/tools/smartgolangci"
)

type lintRunner interface {
	Run(ctx context.Context) error
}

type lintRunnerFactory func(opts smartgolangci.Options, stdout, stderr io.Writer) lintRunner

func newLintRunner(opts smartgolangci.Options, stdout, stderr io.Writer) lintRunner {
	return smartgolangci.NewRunner(opts, stdout, stderr)
}

func main() {
	os.Exit(run(os.Args[1:], os.Stdout, os.Stderr, newLintRunner))
}

func run(args []string, stdout, stderr io.Writer, factory lintRunnerFactory) int {
	opts, err := smartgolangci.ParseOptions(args)
	if err != nil {
		_, _ = fmt.Fprintln(stderr, err)
		return 1
	}

	if factory == nil {
		factory = newLintRunner
	}

	if err := factory(opts, stdout, stderr).Run(context.Background()); err != nil {
		return 1
	}

	return 0
}

```

### Core Architecture Module: `backend/magic-service/go-engine/cmd/layerdeps/main.go`
```
// Command layerdeps 运行自定义 DDD 层依赖分析器。
package main

import (
	"golang.org/x/tools/go/analysis/multichecker"

	"magic/internal/tools/analyzers/layerdeps"
	"magic/internal/tools/analyzers/rpcroutes"
)

func main() {
	multichecker.Main(
		layerdeps.NewAnalyzer(),
		rpcroutes.NewAnalyzer(),
	)
}

```

### Core Architecture Module: `backend/magic-service/go-engine/cmd/lint/main.go`
```
// Package main provides the repository lint command entrypoint.
package main

import (
	"context"
	"fmt"
	"io"
	"os"

	"magic/internal/tools/lintcmd"
)

type lintRunner interface {
	Run(ctx context.Context) error
}

type lintRunnerFactory func(opts lintcmd.Options, stdout, stderr io.Writer) lintRunner

func newLintRunner(opts lintcmd.Options, stdout, stderr io.Writer) lintRunner {
	return lintcmd.NewRunner(opts, stdout, stderr)
}

func main() {
	os.Exit(run(os.Args[1:], os.Stdout, os.Stderr, newLintRunner))
}

func run(args []string, stdout, stderr io.Writer, runnerFactory lintRunnerFactory) int {
	opts, err := lintcmd.ParseOptions(args)
	if err != nil {
		_, _ = fmt.Fprintln(stderr, err)
		return 1
	}

	if runnerFactory == nil {
		runnerFactory = newLintRunner
	}

	runner := runnerFactory(opts, stdout, stderr)
	if err := runner.Run(context.Background()); err != nil {
		return 1
	}

	return 0
}

```

### Core Architecture Module: `backend/magic-service/go-engine/cmd/migrate/main.go`
```
// Package main 提供 Go 侧向量库 bootstrap 工具。
package main

import (
	"context"
	"errors"
	"flag"
	"fmt"

	configloader "magic/internal/config"
	autoloadcfg "magic/internal/config/autoload"
	"magic/internal/constants"
	"magic/internal/infrastructure/external"
	"magic/internal/infrastructure/logging"
	"magic/internal/infrastructure/vectordb/qdrant"
)

var (
	ErrInvalidAction      = errors.New("invalid action")
	ErrUnknownAction      = errors.New("unknown action")
	ErrUnsupportedAction  = errors.New("action is no longer supported after SQL migrations moved to PHP")
	ErrVectorSizeMismatch = errors.New("knowledge base collection vector size mismatch")
)

// MigrationAction 表示 bootstrap 动作类型。
type MigrationAction string

const (
	ActionUp      MigrationAction = "up"
	ActionDown    MigrationAction = "down"
	ActionVersion MigrationAction = "version"
	ActionForce   MigrationAction = "force"
)

// String 实现 flag.Value。
func (a MigrationAction) String() string { return string(a) }

// Set 实现 flag.Value。
func (a *MigrationAction) Set(s string) error {
	switch s {
	case string(ActionUp), string(ActionDown), string(ActionVersion), string(ActionForce):
		*a = MigrationAction(s)
		return nil
	default:
		return fmt.Errorf("%w: %s", ErrInvalidAction, s)
	}
}

type migrationRunner struct {
	config *autoloadcfg.Config
	logger *logging.SugaredLogger
}

func main() {
	var (
		action = ActionUp
		steps  = flag.Int("steps", -1, "Number of steps to migrate (ignored by Go bootstrap)")
		_      = flag.Int("target", -1, "Target version to migrate to (deprecated)")
	)
	flag.Var(&action, "action", "Bootstrap action: up, version")
	flag.Parse()

	logger := logging.New().Named("cmd.migrate")
	ctx := context.Background()

	runner := newMigrationRunner(configloader.New(), logger)
	var err error

	switch action {
	case ActionUp:
		err = runner.bootstrap(*steps)
	case ActionVersion:
		runner.showStatus()
	case ActionDown, ActionForce:
		err = runner.unsupportedAction(action)
	default:
		err = fmt.Errorf("%w: %s", ErrUnknownAction, action)
	}

	if err != nil {
		logger.KnowledgeErrorContext(ctx, "Bootstrap failed", "error", err)
		return
	}

	logger.InfoContext(ctx, "Bootstrap completed successfully")
}

func newMigrationRunner(cfg *autoloadcfg.Config, logger *logging.SugaredLogger) *migrationRunner {
	return &migrationRunner{
		config: cfg,
		logger: logger,
	}
}

func (r *migrationRunner) bootstrap(steps int) error {
	if steps > 0 {
		r.logger.Infow("Ignoring steps for Go bootstrap", "steps", steps)
	}

	r.logger.Infow(
		"MySQL schema migrations are managed by the PHP service",
		"migration_dir", "../migrations",
	)

	if err := r.ensureKnowledgeBaseCollection(context.Background()); err != nil {
		return fmt.Errorf("bootstrap knowledge base collection: %w", err)
	}

	r.logger.Infow("Go bootstrap completed", "collection", constants.KnowledgeBaseCollectionName)
	return nil
}

func (r *migrationRunner) showStatus() {
	r.logger.Infow(
		"Go side no longer manages SQL migrations",
		"migration_dir", "../migrations",
		"bootstrap_target", constants.KnowledgeBaseCollectionName,
	)
}

func (r *migrationRunner) ensureKnowledgeBaseCollection(ctx context.Context) error {
	vectorSize, err := resolveEmbeddingDimensionForMigration(ctx, r.config)
	if err != nil {
		return err
	}

	client, err := qdrant.NewClient(&qdrant.Config{
		Host:       r.config.Qdrant.EffectiveHost(),
		Port:       r.config.Qdrant.Port,
		Credential: r.config.Qdrant.AuthValue,
	}, r.logger)
	if err != nil {
		return fmt.Errorf("failed to create qdrant client: %w", err)
	}
	defer func() {
		_ = client.Close()
	}()

	collectionName := constants.KnowledgeBaseCollectionName
	exists, err := client.CollectionExists(ctx, collectionName)
	if err != nil {
		return fmt.Errorf("failed to check collection existence: %w", err)
	}
	if !exists {
		if err := client.CreateCollection(ctx, collectionName, vectorSize); err != nil {
			return fmt.Errorf("failed to create collection: %w", err)
		}
		return nil
	}

	info, err := client.GetCollectionInfo(ctx, collectionName)
	if err != nil {
		return fmt.Errorf("failed to get collection info: %w", err)
	}
	if info == nil || info.VectorSize != vectorSize {
		actual := int64(0)
		if info != nil {
			actual = info.VectorSize
		}
		return fmt.Errorf("%w: expected %d, actual %d", ErrVectorSizeMismatch, vectorSize, actual)
	}

	return nil
}

func resolveEmbeddingDimensionForMigration(ctx context.Context, cfg *autoloadcfg.Config) (int64, error) {
	if cfg.Embedding.ClientType == string(external.EmbeddingClientTypePHP) {
		if cfg.Embedding.Dimension > 0 {
			return int64(cfg.Embedding.Dimension), nil
		}
		return 0, fmt.Errorf("embedding.dimension required: %w", external.ErrMissingDimension)
	}

	defaultModel := cfg.MagicModelGateway.DefaultEmbeddingModel
	if defaultModel == "" {
		defaultModel = "text-embedding-3-small"
	}

	client := external.NewOpenAIEmbeddingClient(cfg.MagicModelGateway.BaseURL, nil)
	if cfg.MagicModelGateway.MagicAccessToken != "" {
		client.SetAccessToken(cfg.MagicModelGateway.MagicAccessToken)
	}
	embeddingSvc := external.NewEmbeddingService(client, defaultModel)
	resolver := external.NewEmbeddingDimensionResolver(cfg, embeddingSvc)
	dim, err := resolver.ResolveDimension(ctx, defaultModel)
	if err != nil {
		return 0, fmt.Errorf("resolve dimension: %w", err)
	}
	return dim, nil
}

func (r *migrationRunner) unsupportedAction(action MigrationAction) error {
	return fmt.Errorf("%w: %s", ErrUnsupportedAction, action)
}

```

### Core Architecture Module: `backend/magic-service/go-engine/cmd/vet/main.go`
```
// Package main provides the incremental go vet command entrypoint.
package main

import (
	"fmt"
	"log/slog"
	"os"

	"magic/internal/pkg/logkey"
	"magic/internal/tools/smartvet"
)

func main() {
	logger := slog.Default()
	opts, err := smartvet.ParseOptions(os.Args[1:])
	if err != nil {
		logger.Error("invalid flags", logkey.Error, err)
		os.Exit(1)
	}

	runner := smartvet.NewRunner(opts, logger, os.Stdout, os.Stderr)
	if err := runner.Run(); err != nil {
		logger.Error("smartvet failed", logkey.Error, err)
		_, _ = fmt.Fprintln(os.Stderr, err)
		os.Exit(1)
	}
}

```

### Core Architecture Module: `backend/magic-service/go-engine/cmd/vettool/main.go`
```
// Package main provides the incremental analyzer build command entrypoint.
package main

import (
	"context"
	"fmt"
	"io"
	"os"

	"magic/internal/tools/smartvettool"
)

type vettoolRunner interface {
	Run(ctx context.Context) error
}

type vettoolRunnerFactory func(opts smartvettool.Options, stdout, stderr io.Writer) vettoolRunner

func newVettoolRunner(opts smartvettool.Options, stdout, stderr io.Writer) vettoolRunner {
	return smartvettool.NewRunner(opts, stdout, stderr)
}

func main() {
	os.Exit(run(os.Args[1:], os.Stdout, os.Stderr, newVettoolRunner))
}

func run(args []string, stdout, stderr io.Writer, factory vettoolRunnerFactory) int {
	opts, err := smartvettool.ParseOptions(args)
	if err != nil {
		_, _ = fmt.Fprintln(stderr, err)
		return 1
	}

	if factory == nil {
		factory = newVettoolRunner
	}

	if err := factory(opts, stdout, stderr).Run(context.Background()); err != nil {
		return 1
	}

	return 0
}

```

### Core Architecture Module: `backend/magic-service/go-engine/internal/application/knowledge/document/dto/types.go`
```
// Package dto 定义 document application 子域对外暴露的 DTO。
package dto

import (
	confighelper "magic/internal/application/knowledge/helper/config"
	docfilehelper "magic/internal/application/knowledge/helper/docfile"
)

// DocumentDTO 表示文档应用服务输出。
type DocumentDTO struct {
	ID                int64  `json:"id"`
	OrganizationCode  string `json:"organization_code"`
	KnowledgeBaseCode string `json:"knowledge_base_code"`
	KnowledgeBaseType string `json:"knowledge_base_type"`
	SourceType        *int   `json:"source_type,omitempty"`
	SourceBindingID   int64  `json:"source_binding_id"`
	SourceItemID      int64  `json:"source_item_id"`
	ProjectID         int64  `json:"project_id"`
	ProjectFileID     int64  `json:"project_file_id"`
	AutoAdded         bool   `json:"auto_added"`
	CreatedUID        string `json:"created_uid"`
	UpdatedUID        string `json:"updated_uid"`
	Name              string `json:"name"`
	Description       string `json:"description"`
	Code              string `json:"code"`
	Enabled           bool   `json:"enabled"`
	// DocType 是应用内部精确文件/文档类型，来源于 knowledge_base_documents.doc_type。
	// 主 HTTP API 响应顶层 doc_type 会在 RPC 兼容投影层转换为前端契约的知识库来源类型。
	DocType           int                             `json:"doc_type"`
	DocMetadata       map[string]any                  `json:"doc_metadata"`
	StrategyConfig    *confighelper.StrategyConfigDTO `json:"strategy_config,omitempty"`
	DocumentFile      *docfilehelper.DocumentFileDTO  `json:"document_file"`
	ThirdPlatformType string                          `json:"third_platform_type"`
	ThirdFileID       string                          `json:"third_file_id"`
	SyncStatus        int                             `json:"sync_status"`
	SyncTimes         int                             `json:"sync_times"`
	SyncStatusMessage string                          `json:"sync_status_message"`
	EmbeddingModel    string                          `json:"embedding_model"`
	VectorDB          string                          `json:"vector_db"`
	RetrieveConfig    *confighelper.RetrieveConfigDTO `json:"retrieve_config"`
	FragmentConfig    *confighelper.FragmentConfigDTO `json:"fragment_config"`
	EmbeddingConfig   *confighelper.EmbeddingConfig   `json:"embedding_config"`
	VectorDBConfig    *confighelper.VectorDBConfig    `json:"vector_db_config"`
	WordCount         int                             `json:"word_count"`
	CreatedAt         string                          `json:"created_at"`
	UpdatedAt         string                          `json:"updated_at"`
}

// OriginalFileLinkDTO 表示文档原始文件访问链接。
type OriginalFileLinkDTO struct {
	Available  bool   `json:"available"`
	URL        string `json:"url"`
	Name       string `json:"name"`
	Key        string `json:"key"`
	Type       string `json:"type"`
	SourceType string `json:"source_type,omitempty"`
	LinkType   string `json:"link_type,omitempty"`
}

// CreateDocumentInput 表示创建文档请求。
type CreateDocumentInput struct {
	OrganizationCode  string
	UserID            string
	KnowledgeBaseCode string
	KnowledgeBaseType string
	SourceBindingID   int64
	SourceItemID      int64
	ProjectID         int64
	ProjectFileID     int64
	AutoAdded         bool
	Name              string
	Description       string
	DocType           int
	DocMetadata       map[string]any
	StrategyConfig    *confighelper.StrategyConfigDTO
	DocumentFile      *docfilehelper.DocumentFileDTO
	ThirdPlatformType string
	ThirdFileID       string
	EmbeddingModel    string
	VectorDB          string
	RetrieveConfig    *confighelper.RetrieveConfigDTO
	FragmentConfig    *confighelper.FragmentConfigDTO
	EmbeddingConfig   *confighelper.EmbeddingConfig
	VectorDBConfig    *confighelper.VectorDBConfig
	AutoSync          bool
	// Deprecated: 文档向量化始终异步调度，该字段不再触发同步等待。
	WaitForSyncResult bool
}

// UpdateDocumentInput 表示更新文档请求。
type UpdateDocumentInput struct {
	OrganizationCode  string
	UserID            string
	Code              string
	KnowledgeBaseCode string
	KnowledgeBaseType string
	Name              string
	Description       string
	Enabled           *bool
	DocType           *int
	DocMetadata       map[string]any
	StrategyConfig    *confighelper.StrategyConfigDTO
	DocumentFile      *docfilehelper.DocumentFileDTO
	RetrieveConfig    *confighelper.RetrieveConfigDTO
	FragmentConfig    *confighelper.FragmentConfigDTO
	WordCount         *int
	// Deprecated: 文档向量化始终异步调度，该字段不再触发同步等待。
	WaitForSyncResult bool
}

// ListDocumentInput 表示查询文档列表请求。
type ListDocumentInput struct {
	OrganizationCode  string
	UserID            string
	KnowledgeBaseCode string
	Name              string
	DocType           *int
	Enabled           *bool
	SyncStatus        *int
	Offset            int
	Limit             int
}

// GetDocumentsByThirdFileIDInput 表示按第三方文件查询文档请求。
type GetDocumentsByThirdFileIDInput struct {
	OrganizationCode  string
	KnowledgeBaseCode string
	ThirdPlatformType string
	ThirdFileID       string
}

// ReVectorizedByThirdFileIDInput 表示按第三方文件触发重向量化请求。
type ReVectorizedByThirdFileIDInput struct {
	OrganizationCode              string
	UserID                        string
	ThirdPlatformUserID           string
	ThirdPlatformOrganizationCode string
	ThirdPlatformType             string
	ThirdFileID                   string
	ThirdKnowledgeID              string
}

// NotifyProjectFileChangeInput 表示按项目文件触发同步请求。
type NotifyProjectFileChangeInput struct {
	ProjectFileID    int64
	OrganizationCode string
	ProjectID        int64
	Status           string
}

```

### Core Architecture Module: `backend/magic-service/go-engine/internal/application/knowledge/document/service/access.go`
```
package docapp

import (
	"context"
	"errors"
	"fmt"
	"strings"

	kbaccess "magic/internal/domain/knowledge/access/service"
	kbrepository "magic/internal/domain/knowledge/knowledgebase/repository"
	"magic/internal/pkg/ctxmeta"
	"magic/internal/pkg/thirdplatform"
)

// ErrDocumentPermissionDenied 表示当前用户无知识库文档权限。
var ErrDocumentPermissionDenied = errors.New("document permission denied")

type documentKnowledgeAccessDeps struct {
	permissionReader    kbaccess.PermissionReader
	thirdPlatformAccess SourceFileThirdPlatformAccess
	knowledgeBaseReader SourceFileKnowledgeBaseReader
}

func (s *DocumentAppService) knowledgeAccessService() *kbaccess.Service {
	if s == nil {
		return nil
	}
	return newDocumentKnowledgeAccessService(documentKnowledgeAccessDeps{
		permissionReader:    s.permissionReader,
		thirdPlatformAccess: s.thirdPlatformAccess,
		knowledgeBaseReader: s.kbService,
	})
}

func newDocumentKnowledgeAccessService(deps documentKnowledgeAccessDeps) *kbaccess.Service {
	if deps.permissionReader == nil {
		return nil
	}
	return kbaccess.NewService(
		deps.permissionReader,
		nil,
		&documentExternalAccessReader{deps: deps},
		nil,
	)
}

func (s *DocumentAppService) authorizeKnowledgeBaseAction(
	ctx context.Context,
	organizationCode string,
	userID string,
	knowledgeBaseCode string,
	action string,
) error {
	accessService := s.knowledgeAccessService()
	if accessService == nil {
		return nil
	}
	actor := resolveDocumentAccessActor(ctx, organizationCode, userID)
	result, err := accessService.Authorize(ctx, actor, action, kbaccess.Target{
		KnowledgeBaseCode: knowledgeBaseCode,
	})
	if err != nil {
		return fmt.Errorf("authorize document knowledge base access: %w", err)
	}
	if !result.Operation.ValidateAction(action) {
		return fmt.Errorf("%w: action=%s knowledge_base_code=%s", ErrDocumentPermissionDenied, action, knowledgeBaseCode)
	}
	return nil
}

func resolveDocumentAccessActor(ctx context.Context, organizationCode, userID string) kbaccess.Actor {
	if actor, ok := ctxmeta.AccessActorFromContext(ctx); ok {
		if strings.TrimSpace(organizationCode) == "" {
			organizationCode = actor.OrganizationCode
		}
		if strings.TrimSpace(userID) == "" {
			userID = actor.UserID
		}
		return kbaccess.Actor{
			OrganizationCode:              strings.TrimSpace(organizationCode),
			UserID:                        strings.TrimSpace(userID),
			ThirdPlatformUserID:           strings.TrimSpace(actor.ThirdPlatformUserID),
			ThirdPlatformOrganizationCode: strings.TrimSpace(actor.ThirdPlatformOrganizationCode),
		}
	}
	return kbaccess.Actor{
		OrganizationCode: strings.TrimSpace(organizationCode),
		UserID:           strings.TrimSpace(userID),
	}
}

type documentExternalAccessReader struct {
	deps documentKnowledgeAccessDeps
}

func (r *documentExternalAccessReader) ListOperations(
	ctx context.Context,
	actor kbaccess.Actor,
	knowledgeBaseCodes []string,
) (map[string]kbaccess.Operation, error) {
	if r == nil || r.deps.thirdPlatformAccess == nil || r.deps.knowledgeBaseReader == nil {
		return map[string]kbaccess.Operation{}, nil
	}

	items, err := r.deps.thirdPlatformAccess.ListKnowledgeBases(ctx, thirdplatform.KnowledgeBaseListInput{
		OrganizationCode:              actor.OrganizationCode,
		UserID:                        actor.UserID,
		ThirdPlatformUserID:           actor.ThirdPlatformUserID,
		ThirdPlatformOrganizationCode: actor.ThirdPlatformOrganizationCode,
	})
	if err != nil {
		if errors.Is(err, thirdplatform.ErrIdentityMissing) {
			return map[string]kbaccess.Operation{}, nil
		}
		return nil, fmt.Errorf("list external knowledge bases: %w", err)
	}
	if len(items) == 0 {
		return map[string]kbaccess.Operation{}, nil
	}

	businessIDs := make([]string, 0, len(items))
	for _, item := range items {
		businessID := strings.TrimSpace(item.KnowledgeBaseID)
		if businessID == "" {
			continue
		}
		businessIDs = append(businessIDs, businessID)
	}
	if len(businessIDs) == 0 {
		return map[string]kbaccess.Operation{}, nil
	}

	knowledgeBases, _, err := r.deps.knowledgeBaseReader.List(ctx, &kbrepository.Query{
		OrganizationCode: actor.OrganizationCode,
		BusinessIDs:      businessIDs,
		Offset:           0,
		Limit:            len(businessIDs),
	})
	if err != nil {
		return nil, fmt.Errorf("list external knowledge base snapshots: %w", err)
	}

	requested := make(map[string]struct{}, len(knowledgeBaseCodes))
	for _, knowledgeBaseCode := range knowledgeBaseCodes {
		trimmed := strings.TrimSpace(knowledgeBaseCode)
		if trimmed == "" {
			continue
		}
		requested[trimmed] = struct{}{}
	}

	operations := make(map[string]kbaccess.Operation, len(knowledgeBases))
	for _, knowledgeBase := range knowledgeBases {
		if knowledgeBase == nil || strings.TrimSpace(knowledgeBase.Code) == "" {
			continue
		}
		if len(requested) > 0 {
			if _, ok := requested[knowledgeBase.Code]; !ok {
				continue
			}
		}
		operations[knowledgeBase.Code] = kbaccess.OperationAdmin
	}
	return operations, nil
}

type documentKnowledgeAccessPort interface {
	ListKnowledgeBases(ctx context.Context, input thirdplatform.KnowledgeBaseListInput) ([]thirdplatform.KnowledgeBaseItem, error)
}

```

### Core Architecture Module: `backend/magic-service/go-engine/internal/application/knowledge/document/service/agent_scope.go`
```
package docapp

import (
	"context"
	"errors"
	"fmt"

	kbentity "magic/internal/domain/knowledge/knowledgebase/entity"
	"magic/internal/domain/knowledge/shared"
)

func (s *DocumentAppService) ensureKnowledgeBaseMatchesAgentScope(
	_ context.Context,
	kb *kbentity.KnowledgeBase,
) error {
	if kb == nil {
		return shared.ErrKnowledgeBaseNotFound
	}
	return nil
}

func (s *DocumentAppService) ensureKnowledgeBaseAccessibleInAgentScope(
	ctx context.Context,
	organizationCode string,
	knowledgeBaseCode string,
) error {
	kb, err := s.kbService.ShowByCodeAndOrg(ctx, knowledgeBaseCode, organizationCode)
	if err != nil {
		return fmt.Errorf("show knowledge base by code and org: %w", err)
	}
	return s.ensureKnowledgeBaseMatchesAgentScope(ctx, kb)
}

func (s *DocumentAppService) isKnowledgeBaseAccessibleInAgentScope(
	ctx context.Context,
	organizationCode string,
	knowledgeBaseCode string,
) (bool, error) {
	err := s.ensureKnowledgeBaseAccessibleInAgentScope(ctx, organizationCode, knowledgeBaseCode)
	if err == nil {
		return true, nil
	}
	if errors.Is(err, shared.ErrKnowledgeBaseNotFound) {
		return false, nil
	}
	return false, err
}

```


### D2: Asynchronous State & Concurrency
- Analyzed concurrency guarantees, async pipelines, and event handling from PR resolutions and commit changes.

### D3: Error Boundaries, Recovery & Rollbacks
- Exception handling patterns and defect resolutions extracted from closed production bug issues:
- **Issue #72** (2026-03-20): **[Bug]: is not a public ip & source type 字段是必须的**
  *Symptoms*: ### Deployment Type / 部署类型  Self-hosted (Docker)  ### Bug Description / Bug 描述  1. 点击预览分段，时报错   <img width="1920" height="921" alt="Image" src="https://github.com/user-attachments/assets/c5ee3580-bb79-4d79-9b2d-eb2765450815" />  <img width="1245" height="900" alt="Image" src="https://github.com/user-attachments/assets/8da3fad5-78ac-41fd-a40b-25c5588f9f9e" />  2. 点击保存并处理，报错 source type 字段是必须的  <img width="1920" height="921" alt="Image" src="https://github.com/user-attachments/assets/925a844c-9559-4248-a7b6-439e550d30e0" />  ### Steps to Reproduce / 复现步骤  1. AI助理->管理AI助理->向量知识库->创建向量知识库 2. 上传 markdown 文档 3. 点击“预览分段”或者“保存并处理”  ### Logs and Additional Context / 日志和额外的上下文  预览分段错误日志 ``` [ERROR] App\Infrastructure\Core\Exception\ApiResponseExceptionLogAspect 发生异常 message:[172.16.207.249] is not a public ip, code:0, file:/opt/www/app/Infrastructure/Util/SSRF/SSRFDefense.php, line:107, trace:#0 /opt/www/app/Infrastructure/Util/SSRF/SSRFDefense.php(45): App\Infrastructure\Util\SSRF\SSRFDefense->isValid() #1 /opt/www/app/Infrastructure/Util/SSRF/SSRFUtil.php(61): App\Infrastructure\Util\SSRF\SSRFDefense->getSafeUrl() #2 /opt/www/app/Infrastructure/Core/File/Parser/FileParser.php(40): App\Infrastructure\Util\SSRF\SSRFUtil::getSafeUrl() #3 /opt/www/app/Application/KnowledgeBase/Service/Strategy/DocumentFile/Driver/ExternalFileDocumentFileStrategyDriver.php(30): App\Infrastructure\Core\File\Parser\FileParser->parse() #4 /opt/www/app/Application/KnowledgeBase/Service/Strategy/DocumentFile/D

- **Issue #69** (2026-03-20): **[Bug]: 工具convert_pdf 执行失败等问题汇总**
  *Symptoms*: ### Deployment Type / 部署类型  Self-hosted (Docker)  ### Bug Description / Bug 描述  **问题1convert_pdf，当遇到有pdf文件时，报错如下：** 11:26:32.981 | ERROR    | /app/app/tools/core/tool_executor.py:105 - 工具 convert_pdf 执行失败: 智能 PDF 转换服务未配置，请联系管理员。 11:26:32.982 | ERROR    | /app/app/tools/convert_pdf.py:405 - 生成工具详情时发生意外错误: 'NoneType' object has no attribute 'get' **问题2:加载 agent 配置: web-browser，如何手动配置一下工具。** 11:26:03.861 | INFO     | /app/agentlang/agentlang/agent/base.py:280 - 加载 agent 配置: web-browser 11:26:03.869 | WARNING  | /app/agentlang/agentlang/agent/base.py:299 - 工具 'search_zhihu_articles' 不存在，将在 Agent 定义中被忽略: 工具 search_zhihu_articles 不存在 11:26:03.869 | WARNING  | /app/agentlang/agentlang/agent/base.py:299 - 工具 'fetch_zhihu_article_detail' 不存在，将在 Agent 定义中被忽略: 工具 fetch_zhihu_article_detail 不存在 11:26:03.869 | WARNING  | /app/agentlang/agentlang/agent/base.py:299 - 工具 'search_rednote_notes' 不存在，将在 Agent 定义中被忽略: 工具 search_rednote_notes 不存在 11:26:03.870 | WARNING  | /app/agentlang/agentlang/agent/base.py:299 - 工具 'fetch_rednote_note' 不存在，将在 Agent 定义中被忽略: 工具 fetch_rednote_note 不存在 11:26:03.870 | WARNING  | /app/agentlang/agentlang/agent/base.py:299 - 工具 'wechat_article_search' 不存在，将在 Agent 定义中被忽略: 工具 wechat_article_search 不存在  **问题三：web 对话框无法滚动，进行一次提问后无法滚到到下方对话框继续对话。**  <img width="3108" height="1760" alt="Image" src="https://github.com/user-attachments/assets/9f42b262-ba29-4018-afb5-bc5d04786a82" />  ### Steps to Reproduce / 复现步骤  在我的macbookpro 14 inter芯片，docker-compose 部署。  ### Logs and Ad

- **Issue #68** (2026-03-20): **[Bug]: Cannot login into an instance with the provided login credentials**
  *Symptoms*: ### Deployment Type / 部署类型  Self-hosted (Docker)  ### Bug Description / Bug 描述  I want to login after deploying super magic with the official guide (via docker) but it doesn't login with either of the provided credentials.  ### Steps to Reproduce / 复现步骤  1. Clone the repo and `cd` into it. 2. Copy the config files from their example counterparts. 3. Change the port for caddy in `docker-compose.yaml` (because it was conflicting) to 5000 4. Run `./bin/magic.sh start` to initialize and choose **English** and **Local**. 5. Open <server-ip:5000> to access the login page in the browser. 6. Enter `13912345678` or `13812345678` for phone number and `letsmagic.ai` for password. 7. Press Login (and it doesn't work)  ### Logs and Additional Context / 日志和额外的上下文  _No response_
  **Post-Mortem & Fix Analysis**:
  > When I look up in the network tab   {     "redirect": "http://37.27.181.0:5000/login?redirect=http%3A%2F%2F37.27.181.0%3A5000%2F",     "state_code": "+86",     "phone": "86413141242",     "password": "sgdhgjfjfj",     "device": {         "id": "f15455f642f033113106adf18e3d0db9d78e058cb4eac993c0a9442bbff9a794",         "name": "Chrome 139.0.0.0",         "os": "Windows",         "os_version": "10"     },     "type": "phone_password" }  for sessions with a return code of 404 and CORS
  > ### Console Access to fetch at 'http://37.27.181.0/api/v1/sessions' from origin 'http://magic.sphereops.org:5000' has been blocked by CORS policy: Response to preflight request doesn't pass access control check: No 'Access-Control-Allow-Origin' header is present on the requested resource.  
  > You can remove the "Access-Control-Allow-Origin" restriction by modifying the configuration of the caddy server. 

- **Issue #65** (2026-03-20): **[Bug]: 请问如何使用ollama里面的模型呢，另文件上传总显示错误**
  *Symptoms*: ### Deployment Type / 部署类型  Self-hosted (Docker)  ### Bug Description / Bug 描述  请问如何使用ollama里面的模型呢，另文件上传总显示错误  ### Steps to Reproduce / 复现步骤  暂无  ### Logs and Additional Context / 日志和额外的上下文  _No response_
  **Post-Mortem & Fix Analysis**:
  > 文件上传错误的截图贴一下

- **Issue #62** (2026-03-20): **[Bug]: 添加用户问题**
  *Symptoms*: 部署完以后，我需要添加多个账号的话，应该怎么做呢？
  **Post-Mortem & Fix Analysis**:
  > @liangchenwsl 
  > 参考InitialAccountAndUserSeeder的实现，添加更多账号，再执行命令行即可。也可以参考InitialAccountAndUserSeeder 操作的数据表，自行实现添加注册功能
  > > 参考InitialAccountAndUserSeeder的实现，添加更多账号，再执行命令行即可。也可以参考InitialAccountAndUserSeeder作的数据表，自行实现添加注册功能  在*/backend/magic-service目录下执行 php bin/hyperf.php db:seed --path=seeders/initial_account_and_user_seeder.php 时 提示缺少文件，提示如下：Warning: require(/opt/magic-master/backend/magic-service/vendor/autoload.php): Failed to open stream: No such file or directory in /opt/magic-master/backend/magic-service/bin/hyperf.php on line 23 PHP Fatal error:  Uncaught Error: Failed opening required '/opt/magic-master/backend/magic-service/vendor/autoload.php' (include_path='.:/usr/share/php') in /opt/magic-master/backend/magic-service/bin/hyperf.php:23 Stack trace: #0 {main}   thrown in /opt/magic-master/backend/magic-service/bin/hyperf.php on line 23  Fatal error: Uncaught Error: Failed opening required '/opt/magic-master/backend/magic-service/vendor/autoload.php' (include_path='.:/usr/share/php') in /opt/magic-master/backend/magic-service/bin/hyperf.php:23 Stack trace: #0 {main}   thrown in /opt/magic-master/

- **Issue #61** (2025-08-20): **[Bug]: 使用https域名地址访问的时候出现异常，ip访问正常**
  *Symptoms*: ### Deployment Type / 部署类型  Self-hosted (Docker)  ### Bug Description / Bug 描述  15:29:06.519 | ERROR    | /app/app/infrastructure/storage/local.py:150 - 请求本地存储凭证API失败: Cannot connect to host magic-caddy:443 ssl:default [[SSL: TLSV1_ALERT_INTERNAL_ERROR] tlsv1 alert internal error (_ssl.c:1000)]  ### Steps to Reproduce / 复现步骤  CentOS Linux release 7.9.2009 (Core) Docker version 26.1.4, build 5650f9b Docker Compose version v2.36.2   ### Logs and Additional Context / 日志和额外的上下文  、、、  请求本地存储凭证API失败: Cannot connect to host magic-caddy:443 ssl:default [[SSL: TLSV1_ALERT_INTERNAL_ERROR] tlsv1 alert internal error (_ssl.c:1000)] 15:29:06.523 | ERROR    | /app/app/api/routes/websocket.py:124 - Traceback (most recent call last):   File "/venv/lib/python3.12/site-packages/aiohttp/connector.py", line 992, in _wrap_create_connection     return await self._loop.create_connection(*args, **kwargs)            ^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^   File "/usr/lib/python3.12/asyncio/base_events.py", line 1149, in create_connection     transport, protocol = await self._create_connection_transport(                           ^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^   File "/usr/lib/python3.12/asyncio/base_events.py", line 1182, in _create_connection_transport     await waiter   File "/usr/lib/python3.12/asyncio/sslproto.py", line 578, in _on_handshake_complete     raise handshake_exc   File "/usr/lib/python3.12/asyncio/sslproto.py", line 560, in _do_handshake     self._sslobj.do_hand
  **Post-Mortem & Fix Analysis**:
  > 已在社区群回复，根据以下的错误提示 请求本地存储凭证API失败: Cannot connect to host magic-caddy:443 ssl:default [[SSL: TLSV1_ALERT_INTERNAL_ERROR] tlsv1 alert internal error (_ssl.c:1000)]   当修改默认的magic-caddy 内网service-name 通信为公网域名通信时， 需要同步调整根目录下的.env 和config 下面涉及magic-caddy 的配置

- **Issue #60** (2025-09-22): **[Bug]: 页面展示问题**
  *Symptoms*: ### Deployment Type / 部署类型  Self-hosted (Docker)  ### Bug Description / Bug 描述  没有适配网页  <img width="1433" height="848" alt="Image" src="https://github.com/user-attachments/assets/2eea5e8f-ce8e-4a13-a768-ab45c5c250e9" />  ### Steps to Reproduce / 复现步骤  我是MacOS M1  ### Logs and Additional Context / 日志和额外的上下文  _No response_
  **Post-Mortem & Fix Analysis**:
  > 好的， 我们修复一下
  > 已经修复，等待镜像构建。 https://github.com/dtyq/magic/commit/9c02ee8d167ae4b3b9e4c7bc7d3dd7e698890231

- **Issue #58** (2025-09-22): **[Bug]: UI 超级麦吉 没有滚动条，页面无法滚动**
  *Symptoms*: ### Deployment Type / 部署类型  Self-hosted (Docker)  ### Bug Description / Bug 描述  超级麦吉执行任务，页面无法滚动，看不到新的内容，也无法发送新的消息  ### Steps to Reproduce / 复现步骤  服务器端：ubuntu22.04 docker compose 部署  客户端： macbook pro m1  chrome 139.0.7258.68  超级麦吉，发送了一条消息，启动任务后，随着反馈内容的增加，对话框被不断下移动，且没有滚动条  <img width="536" height="910" alt="Image" src="https://github.com/user-attachments/assets/bd37eb23-a11a-45c8-9c51-7445eb3b15cd" />  **左侧列表，展开“话题列表”就看不到“话题文件”**  <img width="590" height="248" alt="Image" src="https://github.com/user-attachments/assets/6ea7aaf9-ea5c-4c41-a3ec-0a9e5bc46d5a" />  <img width="261" height="702" alt="Image" src="https://github.com/user-attachments/assets/db14fe66-ae12-4e42-b877-ae8fb0722c0c" />  ### Logs and Additional Context / 日志和额外的上下文  _No response_
  **Post-Mortem & Fix Analysis**:
  > 客户端 试了mac 的 edge 浏览器、windows 的 edge 浏览器 都是不行，没有滚动条
  > 请问解决了吗，我也遇到了同样的问题
  > 同样的问题

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

### Incident Patch 1: `1fc313db` (2026-08-12)
**Commit Message**: 🐛 fix(browser): improve tool detail results and screenshot playback

**File**: `backend/super-magic/app/core/entity/message/server_message.py` (modified, +1/-0)
```diff
@@ -151,6 +151,7 @@ class BrowserContent(BaseModel):
     file_tag: AttachmentTag = AttachmentTag.BROWSER  # 文件业务类型
     action: Optional[str] = None  # 用户可理解的操作名称
     summary: Optional[str] = None  # 本次操作结果摘要
+    detail: Optional[str] = None  # 脱敏后供用户查看的结构化 Markdown 详情
     page_title: Optional[str] = None  # 当前页面标题
     target: Optional[str] = None  # 本次操作对象
     status: Optional[BrowserDetailStatus] = None  # 本次操作状态
```

**File**: `backend/super-magic/app/i18n/translations/tool/messages.json` (modified, +588/-0)
```diff
@@ -1759,10 +1759,18 @@
         "zh_CN": "页面及资源加载完成",
         "en_US": "the page and its resources to finish loading"
     },
+    "browser.detail.state_commit": {
+        "zh_CN": "导航已提交",
+        "en_US": "the navigation to be committed"
+    },
     "browser.detail.state_dom_content_loaded": {
         "zh_CN": "页面结构加载完成",
         "en_US": "the page structure to finish loading"
     },
+    "browser.detail.state_network_idle": {
+        "zh_CN": "网络请求基本停止",
+        "en_US": "the network to become idle"
+    },
     "browser.detail.wait_default": {
         "zh_CN": "达到指定状态",
         "en_US": "the requested state"
@@ -1815,6 +1823,586 @@
         "zh_CN": "上传文件：{{count}} 个",
         "en_US": "Uploaded files: {{count}}"
     },
+    "browser.detail.field": {
+        "zh_CN": "- **{{label}}：** {{value}}",
+        "en_US": "- **{{label}}:** {{value}}"
+    },
+    "browser.detail.heading.result": {
+        "zh_CN": "结果",
+        "en_US": "Result"
+    },
+    "browser.detail.operation_completed": {
+        "zh_CN": "操作已完成。",
+        "en_US": "The operation completed."
+    },
+    "browser.detail.heading.page": {
+        "zh_CN": "页面",
+        "en_US": "Page"
+    },
+    "browser.detail.heading.pages": {
+        "zh_CN": "页面列表",
+        "en_US": "Pages"
+    },
+    "browser.detail.heading.content": {
+        "zh_CN": "内容",
+        "en_US": "Content"
+    },
+    "browser.detail.heading.details": {
+        "zh_CN": "详情",
+        "en_US": "Details"
+    },
+    "browser.detail.heading.scope": {
+        "zh_CN": "范围",
+        "en_US": "Scope"
+    },
+    "browser.detail.heading.html": {
+        "zh_CN": "HTML 结构",
+        "en_US": "HTML structure"
+    },
+    "browser.detail.heading.matches": {
+        "zh_CN": "匹配元素",
+        "en_US": "Matching elements"
+    },
+    "browser.detail.heading.suggestions": {
+        "zh_CN": "可用建议",
+        "en_US": "Suggestions"
+    },
+    "browser.detail.heading.elements": {
+        "zh_CN": "可操作元素",
+        "en_US": "Interactive elements"
+    },
+    "browser.detail.heading.changes": {
+        "zh_CN": "页面变化",
+        "en_US": "Page changes"
+    },
+    "browser.detail.heading.limits": {
+        "zh_CN": "说明",
+        "en_US": "Notes"
+    },
+    "browser.detail.heading.analysis": {
+        "zh_CN": "视觉分析",
+        "en_US": "Visual analysis"
+    },
+    "browser.detail.heading.evidence": {
+        "zh_CN": "匹配依据",
+        "en_US": "Match evidence"
+    },
+    "browser.detail.heading.value": {
+        "zh_CN": "返回值",
+        "en_US": "Returned value"
+    },
+    "browser.detail.heading.diagnostics": {
+        "zh_CN": "错误与警告",
+        "en_US": "Errors and warnings"
+    },
+    "browser.detail.heading.console_errors": {
+        "zh_CN": "错误",
+        "en_US": "Errors"
+    },
+    "browser.detail.heading.console_warnings": {
+        "zh_CN": "警告",
+        "en_US": "Warnings"
+    },
+    "browser.detail.heading.failed_requests": {
+        "zh_CN": "失败请求",
+        "en_US": "Failed requests"
+    },
+    "browser.detail.heading.http_errors": {
+        "zh_CN": "HTTP 错误响应",
+        "en_US": "HTTP error responses"
+    },
+    "browser.detail.label.title": {
+        "zh_CN": "标题",
+        "en_US": "Title"
+    },
+    "browser.detail.label.url": {
+        "zh_CN": "地址",
+        "en_US": "URL"
+    },
+    "browser.detail.label.status": {
+        "zh_CN": "状态",
+        "en_US": "Status"
+    },
+    "browser.detail.label.backend": {
+        "zh_CN": "浏览器后端",
+        "en_US": "Browser backend"
+    },
+    "browser.detail.label.readiness": {
+        "zh_CN": "页面状态",
+        "en_US": "Page readiness"
+    },
+    "browser.detail.label.pages": {
+        "zh_CN": "打开页面",
+        "en_US": "Open pages"
+    },
+    "browser.detail.label.capabilities": {
+        "zh_CN": "可用能力",
+        "en_US": "Capabilities"
+    },
+    "browser.detail.label.detail": {
+        "zh_CN": "结构模式",
+        "en_US": "Structure mode"
+    },
+    "browser.detail.label.root": {
+        "zh_CN": "根元素",
+        "en_US": "Root element"
+    },
+    "browser.detail.label.scope": {
+        "zh_CN": "读取范围",
+        "en_US": "Read scope"
+    },
+    "browser.detail.label.dimensions": {
+        "zh_CN": "图片尺寸",
+        "en_US": "Image dimensions"
+    },
+    "browser.detail.label.labels": {
+        "zh_CN": "交互标签",
+        "en_US": "Interaction labels"
+    },
+    "browser.detail.label.query": {
+        "zh_CN": "分析问题",
+        "en_US": "Question"
+    },
+    "browser.detail.label.target": {
+        "zh_CN": "目标",
+        "en_US": "Target"
+    },
+    "browser.detail.label.label": {
+        "zh_CN": "视觉标签",
+        "en_US": "Visual label"
+    },
+    "browser.detail.label.ref": {
+        "zh_CN": "元素引用",
+        "en_US": "Element ref"
+    },
+    "browser.detail.label.key": {
+        "zh_CN": "按键",
+        "en_US": "Key"
+    },
+    "browser.detail.label.total": {
+        "zh_CN": "记录总数",
+        "en_US": "Tota
```

**File**: `backend/super-magic/app/service/browser/browser_tool_result_builder.py` (modified, +22/-7)
```diff
@@ -321,6 +321,9 @@ def attach_screenshot(
         artifact: BrowserScreenshotArtifact,
     ) -> ToolResult:
         screenshot_result = cls.screenshot(page, result, artifact)
+        tool_result.data["page_id"] = screenshot_result.data["page_id"]
+        tool_result.data["session_id"] = screenshot_result.data["session_id"]
+        tool_result.data["page"] = screenshot_result.data["page"]
         tool_result.data["screenshot"] = screenshot_result.data["screenshot"]
         tool_result.data["label_to_ref"] = screenshot_result.data["label_to_ref"]
         tool_result.extra_info.update(screenshot_result.extra_info)
@@ -388,22 +391,27 @@ def visual_match_error(visual_result: ToolResult, message: str) -> ToolResult:
     @classmethod
     def console(cls, batch: DiagnosticBatch[ConsoleEntry], page_id: str) -> ToolResult:
         entries = batch.entries
-        error_count = sum(entry.level.lower() in {"error", "assert"} for entry in entries)
+        error_count = sum(entry.level.lower() in {"error", "fatal", "assert"} for entry in entries)
+        warning_count = sum(entry.level.lower() in {"warning", "warn"} for entry in entries)
         data = {
             "page_id": page_id,
             "console_entries": cls._structured(entries),
             "total_count": batch.total_count,
             "returned_count": len(entries),
             "error_count": error_count,
+            "warning_count": warning_count,
         }
         if not entries:
             return ToolResult(
-                content=f"Console entries for page {page_id}: total={batch.total_count}, returned=0, errors=0.",
+                content=(
+                    f"Console entries for page {page_id}: total={batch.total_count}, returned=0, "
+                    "errors=0, warnings=0."
+                ),
                 data=data,
             )
         lines = [
             f"Console entries for page {page_id}: total={batch.total_count}, "
-            f"returned={len(entries)}, errors={error_count}."
+            f"returned={len(entries)}, errors={error_count}, warnings={warning_count}."
         ]
         preview_entries = entries[-_MAX_DIAGNOSTIC_CONTENT_ENTRIES:]
         if len(preview_entries) < len(entries):
@@ -420,26 +428,33 @@ def console(cls, batch: DiagnosticBatch[ConsoleEntry], page_id: str) -> ToolResu
     @classmethod
     def network(cls, batch: DiagnosticBatch[NetworkEntry], page_id: str) -> ToolResult:
         entries = batch.entries
-        error_count = sum(entry.error is not None or entry.phase == "failed" for entry in entries)
+        request_failed_count = sum(entry.error is not None or entry.phase == "failed" for entry in entries)
+        http_error_count = sum(
+            isinstance(entry.status, int) and entry.status >= 400
+            for entry in entries
+        )
         data = {
             "page_id": page_id,
             "network_entries": cls._structured(entries),
             "total_count": batch.total_count,
             "returned_count": len(entries),
-            "error_count": error_count,
+            "error_count": request_failed_count,
+            "request_failed_count": request_failed_count,
+            "http_error_count": http_error_count,
             "pending_count": batch.pending_count,
         }
         if not entries:
             return ToolResult(
                 content=(
                     f"Network entries for page {page_id}: total={batch.total_count}, "
-                    f"returned=0, errors=0, pending={batch.pending_count}."
+                    f"returned=0, request_failures=0, http_errors=0, pending={batch.pending_count}."
                 ),
                 data=data,
             )
         lines = [
             f"Network entries for page {page_id}: total={batch.total_count}, returned={len(entries)}, "
-            f"errors={error_count}, pending={batch.pending_count}."
+            f"request_failures={request_failed_count}, http_errors={http_error_count}, "
+            f"pending={batch.pending_count}."
         ]
         preview_entries = entries[-_MAX_DIAGNOSTIC_CONTENT_ENTRIES:]
         if len(preview_entries) < len(entries):
```

**File**: `backend/super-magic/app/tools/browser/base.py` (modified, +95/-18)
```diff
@@ -11,12 +11,29 @@
 from agentlang.logger import get_logger
 from agentlang.tools.tool_result import ToolResult
 from app.core.entity.attachment import AttachmentStorageType
-from app.core.entity.message.server_message import DisplayType, FileContent, ToolDetail
+from app.core.entity.factory.tool_detail_factory import ToolDetailFactory
+from app.core.entity.message.server_message import (
+    BrowserContent,
+    BrowserDetailStatus,
+    DisplayType,
+    FileContent,
+    ToolDetail,
+)
 from app.i18n import i18n
 from app.service.browser import BrowserScreenshotService, BrowserService
 from app.service.browser.browser_tool_result_builder import BrowserToolResultBuilder
 from app.tools.abstract_file_tool import AbstractFileTool
-from app.tools.browser.presentation import BrowserDetailBuilder, BrowserRemarkBuilder
+from app.tools.browser.presentation import BrowserRemarkBuilder
+from app.tools.browser.presentation.common import (
+    escape_markdown,
+    message,
+    page_data,
+    page_display_title,
+    safe_page_url,
+    string,
+    target_text,
+    user_error,
+)
 from app.tools.core import BaseToolParams
 from magic_use.errors import BrowserErrorCode, BrowserSDKError
 
@@ -180,12 +197,11 @@ async def get_after_tool_call_friendly_action_and_remark(
             arguments=arguments or {},
         )
 
-    async def get_tool_detail(
-        self,
-        tool_context: ToolContext,
-        result: ToolResult,
-        arguments: dict[str, object] | None = None,
-    ) -> ToolDetail:
+    def create_browser_tool_detail(self, result: ToolResult, content: str) -> ToolDetail:
+        """将具体工具生成的正文包装成统一的 Browser/Markdown 详情。"""
+        if not result.ok:
+            content = ""
+
         output_path = result.data.get("output_path")
         if self.name == "browser_screenshot" and result.ok and isinstance(output_path, str) and output_path:
             relative_file_path = Path(output_path).as_posix()
@@ -198,17 +214,75 @@ async def get_tool_detail(
                     storage_type=AttachmentStorageType.WORKSPACE,
                 ),
             )
-        presentation = BrowserDetailBuilder.presentation(
-            self._operation_name(),
-            result,
-            tool_name=self.name,
-            arguments=arguments or {},
+        page = self._page_data(result)
+        url = BrowserToolResultBuilder.safe_url(string(page.get("url")))
+        title = page_display_title(page)
+        target = target_text(result)
+        summary = self._detail_summary(result, target=target, page=page)
+        detail_content = content.strip() or self._fallback_detail(result, summary)
+        file_key = self._screenshot_file_key(result)
+        if file_key is None:
+            return ToolDetail(
+                type=DisplayType.MD,
+                data=FileContent(
+                    file_name=f"{self.name}.md",
+                    content=detail_content,
+                ),
+            )
+        return ToolDetailFactory.create_browser_detail(
+            BrowserContent(
+                url=url,
+                title=title,
+                file_key=file_key,
+                file_size=self._screenshot_file_size(result),
+                file_url=self._screenshot_file_url(result),
+                action=self._operation_name(),
+                summary=summary,
+                detail=detail_content,
+                page_title=string(page.get("title")).strip() or None,
+                target=target or None,
+                status=BrowserDetailStatus.SUCCEEDED if result.ok else BrowserDetailStatus.FAILED,
+            )
         )
-        return BrowserDetailBuilder.detail(
-            presentation,
-            file_key=self._screenshot_file_key(result),
-            file_size=self._screenshot_file_size(result),
-            file_url=self._screenshot_file_url(result),
+
+    def create_browser_error_detail(self, result: ToolResult) -> ToolDetail:
+        return self.create_browser_tool_detail(result, "")
+
+    def _detail_summary(self, result: ToolResult, *, target: str, page: Mapping[str, object]) -> str:
+        if not result.ok:
+            if target:
+                return message(
+                    "browser.detail.failed_target",
+                    action=self._operation_name(),
+                    target=escape_markdown(target),
+                    error=user_error(result),
+                )
+            return message(
+                "browser.detail.failed",
+                action=self._operation_name(),
+                error=user_error(result),
+            )
+        if target:
+            return message(
+                "browser.detail.succeeded_target",
+                action=self._operation_name(),
+                target=escape_markdown(target),
+            )
+        title = string(page.get("title")).strip()
+        if title:
+            return message(
+                "browser.detail.succeeded_page",
+                action=self._operation
```

**File**: `backend/super-magic/app/tools/browser/debugging.py` (modified, +19/-0)
```diff
@@ -6,9 +6,16 @@
 
 from agentlang.context.tool_context import ToolContext
 from agentlang.tools.tool_result import ToolResult
+from app.core.entity.message.server_message import ToolDetail
 from app.service.browser import BrowserService
 from app.service.browser.browser_tool_result_builder import BrowserToolResultBuilder
 from app.tools.browser.base import BrowserToolBase
+from app.tools.browser.presentation.debugging import (
+    add_init_script_detail,
+    evaluate_detail,
+    read_console_detail,
+    read_network_detail,
+)
 from app.tools.core import BaseToolParams, tool
 
 
@@ -45,6 +52,9 @@ class BrowserEvaluate(BrowserToolBase[BrowserEvaluateParams]):
     name = "browser_evaluate"
     operation_key = "browser.evaluate"
 
+    async def get_tool_detail(self, tool_context: ToolContext, result: ToolResult, arguments: dict[str, object] | None = None) -> ToolDetail:
+        return self.create_browser_tool_detail(result, evaluate_detail(result))
+
     async def execute(self, tool_context: ToolContext, params: BrowserEvaluateParams) -> ToolResult:
         async def operation() -> ToolResult:
             value = await BrowserService(tool_context).evaluate(
@@ -66,6 +76,9 @@ class BrowserAddInitScript(BrowserToolBase[BrowserAddInitScriptParams]):
     name = "browser_add_init_script"
     operation_key = "browser.add_init_script"
 
+    async def get_tool_detail(self, tool_context: ToolContext, result: ToolResult, arguments: dict[str, object] | None = None) -> ToolDetail:
+        return self.create_browser_tool_detail(result, add_init_script_detail(result, arguments or {}))
+
     async def execute(self, tool_context: ToolContext, params: BrowserAddInitScriptParams) -> ToolResult:
         async def operation() -> ToolResult:
             await BrowserService(tool_context).add_init_script(params.page_id, params.source, params.session_id)
@@ -89,6 +102,9 @@ class BrowserReadConsole(BrowserToolBase[BrowserDiagnosticParams]):
     name = "browser_read_console"
     operation_key = "browser.read_console"
 
+    async def get_tool_detail(self, tool_context: ToolContext, result: ToolResult, arguments: dict[str, object] | None = None) -> ToolDetail:
+        return self.create_browser_tool_detail(result, read_console_detail(result, arguments or {}))
+
     async def execute(self, tool_context: ToolContext, params: BrowserDiagnosticParams) -> ToolResult:
         async def operation() -> ToolResult:
             batch = await BrowserService(tool_context).read_console(
@@ -110,6 +126,9 @@ class BrowserReadNetwork(BrowserToolBase[BrowserDiagnosticParams]):
     name = "browser_read_network"
     operation_key = "browser.read_network"
 
+    async def get_tool_detail(self, tool_context: ToolContext, result: ToolResult, arguments: dict[str, object] | None = None) -> ToolDetail:
+        return self.create_browser_tool_detail(result, read_network_detail(result, arguments or {}))
+
     async def execute(self, tool_context: ToolContext, params: BrowserDiagnosticParams) -> ToolResult:
         async def operation() -> ToolResult:
             batch = await BrowserService(tool_context).read_network(
```

**File**: `backend/super-magic/app/tools/browser/interaction.py` (modified, +35/-0)
```diff
@@ -6,9 +6,20 @@
 
 from agentlang.context.tool_context import ToolContext
 from agentlang.tools.tool_result import ToolResult
+from app.core.entity.message.server_message import ToolDetail
 from app.service.browser import BrowserService
 from app.service.browser.browser_tool_result_builder import BrowserToolResultBuilder
 from app.tools.browser.base import BrowserToolBase
+from app.tools.browser.presentation.interaction import (
+    check_detail,
+    click_detail,
+    fill_detail,
+    hover_detail,
+    press_detail,
+    scroll_detail,
+    select_detail,
+    upload_detail,
+)
 from app.tools.core import BaseToolParams, tool
 from magic_use import ActionKind, ActionRequest
 
@@ -83,6 +94,9 @@ class BrowserClick(BrowserToolBase[BrowserRefParams]):
     operation_key = "browser.click"
     action_kind = ActionKind.CLICK
 
+    async def get_tool_detail(self, tool_context: ToolContext, result: ToolResult, arguments: dict[str, object] | None = None) -> ToolDetail:
+        return self.create_browser_tool_detail(result, click_detail(result))
+
     async def execute(self, tool_context: ToolContext, params: BrowserRefParams) -> ToolResult:
         return await self.execute_state_change(
             tool_context,
@@ -105,6 +119,9 @@ class BrowserFill(BrowserToolBase[BrowserFillParams]):
     name = "browser_fill"
     operation_key = "browser.input_text"
 
+    async def get_tool_detail(self, tool_context: ToolContext, result: ToolResult, arguments: dict[str, object] | None = None) -> ToolDetail:
+        return self.create_browser_tool_detail(result, fill_detail(result, arguments or {}))
+
     async def execute(self, tool_context: ToolContext, params: BrowserFillParams) -> ToolResult:
         async def operation() -> ToolResult:
             result = await BrowserService(tool_context).dispatch_action(
@@ -125,6 +142,9 @@ class BrowserPress(BrowserToolBase[BrowserPressParams]):
     name = "browser_press"
     operation_key = "browser.press"
 
+    async def get_tool_detail(self, tool_context: ToolContext, result: ToolResult, arguments: dict[str, object] | None = None) -> ToolDetail:
+        return self.create_browser_tool_detail(result, press_detail(result, arguments or {}))
+
     async def execute(self, tool_context: ToolContext, params: BrowserPressParams) -> ToolResult:
         async def operation() -> ToolResult:
             result = await BrowserService(tool_context).dispatch_action(
@@ -146,6 +166,9 @@ class BrowserHover(BrowserToolBase[BrowserRefParams]):
     operation_key = "browser.hover"
     action_kind = ActionKind.HOVER
 
+    async def get_tool_detail(self, tool_context: ToolContext, result: ToolResult, arguments: dict[str, object] | None = None) -> ToolDetail:
+        return self.create_browser_tool_detail(result, hover_detail(result))
+
     async def execute(self, tool_context: ToolContext, params: BrowserRefParams) -> ToolResult:
         return await self.execute_state_change(
             tool_context,
@@ -168,6 +191,9 @@ class BrowserScroll(BrowserToolBase[BrowserScrollParams]):
     name = "browser_scroll"
     operation_key = "browser.scroll_to"
 
+    async def get_tool_detail(self, tool_context: ToolContext, result: ToolResult, arguments: dict[str, object] | None = None) -> ToolDetail:
+        return self.create_browser_tool_detail(result, scroll_detail(result, arguments or {}))
+
     async def execute(self, tool_context: ToolContext, params: BrowserScrollParams) -> ToolResult:
         async def operation() -> ToolResult:
             result = await BrowserService(tool_context).dispatch_action(
@@ -193,6 +219,9 @@ class BrowserSelect(BrowserToolBase[BrowserSelectParams]):
     name = "browser_select"
     operation_key = "browser.select"
 
+    async def get_tool_detail(self, tool_context: ToolContext, result: ToolResult, arguments: dict[str, object] | None = None) -> ToolDetail:
+        return self.create_browser_tool_detail(result, select_detail(result, arguments or {}))
+
     async def execute(self, tool_context: ToolContext, params: BrowserSelectParams) -> ToolResult:
         async def operation() -> ToolResult:
             result = await BrowserService(tool_context).dispatch_action(
@@ -213,6 +242,9 @@ class BrowserCheck(BrowserToolBase[BrowserCheckParams]):
     name = "browser_check"
     operation_key = "browser.check"
 
+    async def get_tool_detail(self, tool_context: ToolContext, result: ToolResult, arguments: dict[str, object] | None = None) -> ToolDetail:
+        return self.create_browser_tool_detail(result, check_detail(result, arguments or {}))
+
     async def execute(self, tool_context: ToolContext, params: BrowserCheckParams) -> ToolResult:
         async def operation() -> ToolResult:
             result = await BrowserService(tool_context).dispatch_action(
@@ -233,6 +265,9 @@ class BrowserUploadFile(BrowserToolBase[BrowserUploadFileParams]):
     name = "browser_upload_file"
     operation_key = "browser.upload_file"
 
+    async def get_tool
```

**File**: `backend/super-magic/app/tools/browser/navigation.py` (modified, +15/-0)
```diff
@@ -8,9 +8,15 @@
 
 from agentlang.context.tool_context import ToolContext
 from agentlang.tools.tool_result import ToolResult
+from app.core.entity.message.server_message import ToolDetail
 from app.service.browser import BrowserService
 from app.service.browser.browser_tool_result_builder import BrowserToolResultBuilder
 from app.tools.browser.base import BrowserToolBase
+from app.tools.browser.presentation.navigation import (
+    keep_alive_detail,
+    navigate_detail,
+    wait_detail,
+)
 from app.tools.core import BaseToolParams, tool
 from magic_use import WaitConditionKind, WaitRequest
 
@@ -69,6 +75,9 @@ class BrowserNavigate(BrowserToolBase[BrowserNavigateParams]):
     name = "browser_navigate"
     operation_key = "browser.goto"
 
+    async def get_tool_detail(self, tool_context: ToolContext, result: ToolResult, arguments: dict[str, object] | None = None) -> ToolDetail:
+        return self.create_browser_tool_detail(result, navigate_detail(result))
+
     async def execute(self, tool_context: ToolContext, params: BrowserNavigateParams) -> ToolResult:
         async def operation() -> ToolResult:
             page = await BrowserService(tool_context).navigate(
@@ -95,6 +104,9 @@ class BrowserWait(BrowserToolBase[BrowserWaitParams]):
     name = "browser_wait"
     operation_key = "browser.wait"
 
+    async def get_tool_detail(self, tool_context: ToolContext, result: ToolResult, arguments: dict[str, object] | None = None) -> ToolDetail:
+        return self.create_browser_tool_detail(result, wait_detail(result, arguments or {}))
+
     async def execute(self, tool_context: ToolContext, params: BrowserWaitParams) -> ToolResult:
         async def operation() -> ToolResult:
             request = WaitRequest(
@@ -127,6 +139,9 @@ class BrowserKeepAlive(BrowserToolBase[BrowserKeepAliveParams]):
     name = "browser_keep_alive"
     operation_key = "browser.keep_alive"
 
+    async def get_tool_detail(self, tool_context: ToolContext, result: ToolResult, arguments: dict[str, object] | None = None) -> ToolDetail:
+        return self.create_browser_tool_detail(result, keep_alive_detail(result, arguments or {}))
+
     async def execute(self, tool_context: ToolContext, params: BrowserKeepAliveParams) -> ToolResult:
         async def operation() -> ToolResult:
             page = await BrowserService(tool_context).keep_page_alive(
```

**File**: `backend/super-magic/app/tools/browser/observation.py` (modified, +31/-0)
```diff
@@ -16,10 +16,20 @@
 from agentlang.logger import get_logger
 from agentlang.tools.tool_result import ToolResult
 from app.core.context.agent_context import AgentContext
+from app.core.entity.message.server_message import ToolDetail
 from app.service.browser import BrowserScreenshotService, BrowserService
 from app.service.browser.browser_file_adapter import BrowserFileAdapter
 from app.service.browser.browser_tool_result_builder import BrowserToolResultBuilder
 from app.tools.browser.base import BrowserToolBase
+from app.tools.browser.presentation.observation import (
+    find_detail,
+    find_visual_detail,
+    list_elements_detail,
+    read_html_detail,
+    read_page_detail,
+    screenshot_detail,
+    visual_query_detail,
+)
 from app.tools.core import BaseToolParams, tool
 from app.tools.snippet_timeout_registry import SdkSnippetTimeoutRegistry
 from app.utils.async_file_utils import async_exists
@@ -228,6 +238,9 @@ class BrowserReadPage(BrowserToolBase[BrowserReadPageParams]):
     name = "browser_read_page"
     operation_key = "browser.read_as_markdown"
 
+    async def get_tool_detail(self, tool_context: ToolContext, result: ToolResult, arguments: dict[str, object] | None = None) -> ToolDetail:
+        return self.create_browser_tool_detail(result, read_page_detail(result))
+
     async def execute(self, tool_context: ToolContext, params: BrowserReadPageParams) -> ToolResult:
         async def operation() -> ToolResult:
             page, markdown = await BrowserService(tool_context).read_page(
@@ -258,6 +271,9 @@ class BrowserReadHtml(BrowserToolBase[BrowserReadHtmlParams]):
     name = "browser_read_html"
     operation_key = "browser.read_html"
 
+    async def get_tool_detail(self, tool_context: ToolContext, result: ToolResult, arguments: dict[str, object] | None = None) -> ToolDetail:
+        return self.create_browser_tool_detail(result, read_html_detail(result))
+
     async def execute(self, tool_context: ToolContext, params: BrowserReadHtmlParams) -> ToolResult:
         async def operation() -> ToolResult:
             page, html, truncated = await BrowserService(tool_context).read_html(
@@ -293,6 +309,9 @@ class BrowserFind(BrowserToolBase[BrowserFindParams]):
     name = "browser_find"
     operation_key = "browser.find_element"
 
+    async def get_tool_detail(self, tool_context: ToolContext, result: ToolResult, arguments: dict[str, object] | None = None) -> ToolDetail:
+        return self.create_browser_tool_detail(result, find_detail(result))
+
     async def execute(self, tool_context: ToolContext, params: BrowserFindParams) -> ToolResult:
         async def operation() -> ToolResult:
             result = await BrowserService(tool_context).find(
@@ -319,6 +338,9 @@ class BrowserListElements(BrowserToolBase[BrowserListElementsParams]):
     name = "browser_list_elements"
     operation_key = "browser.list_elements"
 
+    async def get_tool_detail(self, tool_context: ToolContext, result: ToolResult, arguments: dict[str, object] | None = None) -> ToolDetail:
+        return self.create_browser_tool_detail(result, list_elements_detail(result))
+
     async def execute(self, tool_context: ToolContext, params: BrowserListElementsParams) -> ToolResult:
         async def operation() -> ToolResult:
             snapshot = await BrowserService(tool_context).snapshot(
@@ -348,6 +370,9 @@ class BrowserScreenshot(BrowserToolBase[BrowserScreenshotParams]):
     name = "browser_screenshot"
     operation_key = "browser.screenshot"
 
+    async def get_tool_detail(self, tool_context: ToolContext, result: ToolResult, arguments: dict[str, object] | None = None) -> ToolDetail:
+        return self.create_browser_tool_detail(result, screenshot_detail(result))
+
     async def execute(self, tool_context: ToolContext, params: BrowserScreenshotParams) -> ToolResult:
         async def operation() -> ToolResult:
             page, screenshot = await BrowserService(tool_context).screenshot(
@@ -408,6 +433,9 @@ class BrowserVisualQuery(_BrowserVisualToolBase[BrowserVisualQueryParams]):
     name = "browser_visual_query"
     operation_key = "browser.visual_query"
 
+    async def get_tool_detail(self, tool_context: ToolContext, result: ToolResult, arguments: dict[str, object] | None = None) -> ToolDetail:
+        return self.create_browser_tool_detail(result, visual_query_detail(result, arguments or {}))
+
     async def execute(self, tool_context: ToolContext, params: BrowserVisualQueryParams) -> ToolResult:
         return await self._execute_visual_query(
             tool_context,
@@ -427,6 +455,9 @@ class BrowserFindVisual(_BrowserVisualToolBase[BrowserFindVisualParams]):
     name = "browser_find_visual"
     operation_key = "browser.find_interactive_element_visually"
 
+    async def get_tool_detail(self, tool_context: ToolContext, result: ToolResult, arguments: dict[str, object] | None = None) -> ToolDetail:
+        return self.create_browser_tool_detail(result, find_visual_detail(resu
```

---

### Incident Patch 2: `de3cf5b9` (2026-08-12)
**Commit Message**: Merge pull request 'fix(video): resolve source type using business token type parameter' (#723) from lizengquan/magic:api-video into iteration/IT20260812028

**File**: `backend/magic-service/app/Application/ModelGateway/Service/VideoOperationAppService.php` (modified, +10/-4)
```diff
@@ -20,6 +20,7 @@
 use App\Domain\ModelGateway\Entity\AccessTokenEntity;
 use App\Domain\ModelGateway\Entity\Dto\CreateVideoDTO;
 use App\Domain\ModelGateway\Entity\Dto\VideoOperationResponseDTO;
+use App\Domain\ModelGateway\Entity\ValueObject\AccessTokenType;
 use App\Domain\ModelGateway\Entity\ValueObject\ModelGatewayDataIsolation;
 use App\Domain\ModelGateway\Entity\ValueObject\VideoGenerationConfig;
 use App\Domain\ModelGateway\Entity\ValueObject\VideoMediaMetadata;
@@ -676,7 +677,7 @@ private function dispatchVideoGeneratedEvent(
         $event->setTopicId($operation->getTopicId());
         $event->setTaskId($operation->getTaskId());
         $event->setSourceId($operation->getSourceId());
-        $event->setSourceType($this->resolveSourceType($accessTokenEntity, $operation));
+        $event->setSourceType($this->resolveSourceType($accessTokenEntity, $operation, $requestBusinessParams));
         $event->setCreatedAt(new DateTime());
         $event->setVideoReferenceMaterial($referenceMaterial);
         $event->setBusinessParams($businessParams);
@@ -1153,9 +1154,14 @@ private function probeVideoFromFile(VideoQueueOperationEntity $operation, string
         }
     }
 
-    private function resolveSourceType(?AccessTokenEntity $accessTokenEntity, VideoQueueOperationEntity $operation): ImageGenerateSourceEnum
-    {
-        if ($accessTokenEntity?->getType()->isUser()) {
+    private function resolveSourceType(
+        ?AccessTokenEntity $accessTokenEntity,
+        VideoQueueOperationEntity $operation,
+        array $requestBusinessParams = []
+    ): ImageGenerateSourceEnum {
+        $accessTokenType = $accessTokenEntity?->getType()->value
+            ?? (string) ($requestBusinessParams['access_token_type'] ?? '');
+        if ($accessTokenType === AccessTokenType::User->value) {
             return ImageGenerateSourceEnum::API_PLATFORM;
         }
 
```

**File**: `backend/magic-service/test/Cases/Application/ModelGateway/Service/VideoOperationAppServiceTest.php` (modified, +38/-0)
```diff
@@ -18,6 +18,7 @@
 use App\Application\ModelGateway\Service\VideoOperationAppService;
 use App\Domain\File\Repository\Persistence\Facade\CloudFileRepositoryInterface;
 use App\Domain\File\Service\FileDomainService;
+use App\Domain\ImageGenerate\ValueObject\ImageGenerateSourceEnum;
 use App\Domain\ModelGateway\Contract\QueueOperationExecutorInterface;
 use App\Domain\ModelGateway\Contract\VideoMediaProbeInterface;
 use App\Domain\ModelGateway\Entity\AccessTokenEntity;
@@ -2088,6 +2089,43 @@ public function testManagedPollKeepsOperationRunningWhenProviderQueryThrows(): v
         }
     }
 
+    public function testManagedPollUsesBusinessTokenTypeForApiPlatformSource(): void
+    {
+        $operation = $this->createOperation('op-managed-api-platform-source');
+        $operation->setStatus(VideoOperationStatus::PROVIDER_RUNNING);
+        $operation->setProviderTaskId('provider-task-api-platform-source');
+        $operation->setStartedAt(date(DATE_ATOM));
+
+        $operationRepository = new InMemoryVideoQueueOperationRepository();
+        $operationRepository->operations[$operation->getId()] = $operation;
+        $service = $this->createVideoOperationAppService(
+            $operationRepository,
+            new RecordingQueueOperationExecutor(
+                submitResult: 'unused',
+                queryResult: [
+                    'status' => 'succeeded',
+                    'output' => [
+                        'video_url' => 'https://example.com/api-platform-source.mp4',
+                    ],
+                ],
+            ),
+        );
+
+        $isDone = $service->pollOperationById($operation->getId(), [
+            'organization_id' => 'org-test',
+            'access_token_type' => AccessTokenType::User->value,
+        ]);
+
+        $this->assertTrue($isDone);
+        $videoGeneratedEvents = array_values(array_filter(
+            $this->eventDispatcher->events,
+            static fn (object $event): bool => $event instanceof VideoGeneratedEvent
+        ));
+        $this->assertCount(1, $videoGeneratedEvents);
+        $event = $videoGeneratedEvents[0];
+        $this->assertSame(ImageGenerateSourceEnum::API_PLATFORM, $event->getSourceType());
+    }
+
     public function testGetOperationRejectsFullProviderTaskIdFallbackWhenStoredOperationIsMissing(): void
     {
         $dataIsolation = $this->createDataIsolation();
```

---

### Incident Patch 3: `dcda3ef3` (2026-08-12)
**Commit Message**: Merge branch 'hotfix/magic-web-0811' into iteration/IT20260812028

**File**: `frontend/magic-web/src/assets/locales/en_US/crew/market.json` (modified, +1/-0)
```diff
@@ -2,6 +2,7 @@
 	"aiSearch": "Search",
 	"aiSearchPlaceholder": "Enter keywords or describe your needs to get the digital employee you want",
 	"back": "Back",
+	"backToTop": "Back to top",
 	"categories": {
 		"adminOps": "Admin & Ops",
 		"allCrew": "All Crew",
```

**File**: `frontend/magic-web/src/assets/locales/zh_CN/crew/market.json` (modified, +1/-0)
```diff
@@ -2,6 +2,7 @@
 	"aiSearch": "搜索",
 	"aiSearchPlaceholder": "输入关键词或描述您的需求，获取所需的数字员工",
 	"back": "返回",
+	"backToTop": "回到顶部",
 	"categories": {
 		"adminOps": "行政运营",
 		"allCrew": "全部",
```

**File**: `frontend/magic-web/src/pages/superMagic/pages/CrewMarket/components/MarketBackToTopButton.tsx` (added, +60/-0)
```diff
@@ -0,0 +1,60 @@
+import { useEffect, useState, type RefObject } from "react"
+import { ArrowUp } from "lucide-react"
+import { useTranslation } from "react-i18next"
+import { Button } from "@/components/shadcn-ui/button"
+import { cn } from "@/lib/utils"
+
+const BACK_TO_TOP_SCROLL_THRESHOLD = 320
+
+interface MarketBackToTopButtonProps {
+	viewportRef: RefObject<HTMLDivElement | null>
+	testId: string
+}
+
+function MarketBackToTopButton({ viewportRef, testId }: MarketBackToTopButtonProps) {
+	const { t } = useTranslation("crew/market")
+	const [isVisible, setIsVisible] = useState(false)
+
+	useEffect(() => {
+		const viewport = viewportRef.current
+		if (!viewport) return
+
+		const updateVisibility = () => {
+			setIsVisible(viewport.scrollTop > BACK_TO_TOP_SCROLL_THRESHOLD)
+		}
+
+		updateVisibility()
+		viewport.addEventListener("scroll", updateVisibility, { passive: true })
+		return () => viewport.removeEventListener("scroll", updateVisibility)
+	}, [viewportRef])
+
+	function handleBackToTop() {
+		viewportRef.current?.scrollTo({ top: 0, behavior: "smooth" })
+	}
+
+	const label = t("backToTop")
+
+	return (
+		<Button
+			type="button"
+			size="icon"
+			className={cn(
+				"absolute bottom-6 right-6 z-[60] size-11 rounded-full shadow-lg",
+				"transition-[opacity,transform] duration-150 ease-out active:scale-[0.96]",
+				isVisible
+					? "translate-y-0 opacity-100"
+					: "pointer-events-none translate-y-2 opacity-0",
+			)}
+			aria-label={label}
+			aria-hidden={!isVisible}
+			tabIndex={isVisible ? 0 : -1}
+			title={label}
+			data-testid={testId}
+			onClick={handleBackToTop}
+		>
+			<ArrowUp className="size-5" aria-hidden />
+		</Button>
+	)
+}
+
+export default MarketBackToTopButton
```

**File**: `frontend/magic-web/src/pages/superMagic/pages/CrewMarket/components/MarketStickyHeader.tsx` (added, +43/-0)
```diff
@@ -0,0 +1,43 @@
+import { useEffect, useRef, useState, type HTMLAttributes, type RefObject } from "react"
+import { cn } from "@/lib/utils"
+
+interface MarketStickyHeaderProps extends HTMLAttributes<HTMLDivElement> {
+	scrollViewportRef?: RefObject<HTMLDivElement | null>
+}
+
+function MarketStickyHeader({ className, scrollViewportRef, ...props }: MarketStickyHeaderProps) {
+	const headerRef = useRef<HTMLDivElement>(null)
+	const [isStuck, setIsStuck] = useState(false)
+
+	useEffect(() => {
+		const viewport = scrollViewportRef?.current
+		const header = headerRef.current
+		if (!viewport || !header) return
+
+		const updateStickyState = () => {
+			const viewportTop = viewport.getBoundingClientRect().top
+			const headerTop = header.getBoundingClientRect().top
+			setIsStuck(viewport.scrollTop > 0 && headerTop <= viewportTop + 1)
+		}
+
+		updateStickyState()
+		viewport.addEventListener("scroll", updateStickyState, { passive: true })
+		return () => viewport.removeEventListener("scroll", updateStickyState)
+	}, [scrollViewportRef])
+
+	return (
+		<div
+			ref={headerRef}
+			className={cn(
+				"sticky top-0 z-50 flex min-w-0 flex-col bg-background",
+				"after:pointer-events-none after:absolute after:inset-x-0 after:-bottom-8 after:h-8 after:transition-opacity after:duration-150",
+				"after:bg-gradient-to-b after:from-background after:via-background/90 after:to-transparent",
+				isStuck ? "after:opacity-100" : "after:opacity-0",
+				className,
+			)}
+			{...props}
+		/>
+	)
+}
+
+export default MarketStickyHeader
```

**File**: `frontend/magic-web/src/pages/superMagic/pages/CrewMarket/components/__tests__/MarketBackToTopButton.test.tsx` (added, +38/-0)
```diff
@@ -0,0 +1,38 @@
+import { fireEvent, render, screen } from "@testing-library/react"
+import { describe, expect, it, vi } from "vitest"
+import MarketBackToTopButton from "../MarketBackToTopButton"
+
+vi.mock("react-i18next", () => ({
+	useTranslation: () => ({
+		t: (key: string) => (key === "backToTop" ? "Back to top" : key),
+	}),
+}))
+
+describe("MarketBackToTopButton", () => {
+	it("shows after the scroll threshold and scrolls the viewport to the top", () => {
+		const viewport = document.createElement("div")
+		const scrollTo = vi.fn()
+		viewport.scrollTo = scrollTo
+
+		render(
+			<MarketBackToTopButton
+				viewportRef={{ current: viewport }}
+				testId="market-back-to-top"
+			/>,
+		)
+
+		const button = screen.getByTestId("market-back-to-top")
+		expect(button).toHaveClass("pointer-events-none", "opacity-0")
+		expect(button).toHaveAttribute("aria-hidden", "true")
+
+		viewport.scrollTop = 321
+		fireEvent.scroll(viewport)
+
+		expect(button).toHaveClass("translate-y-0", "opacity-100")
+		expect(button).toHaveAttribute("aria-hidden", "false")
+
+		fireEvent.click(button)
+
+		expect(scrollTo).toHaveBeenCalledWith({ top: 0, behavior: "smooth" })
+	})
+})
```

**File**: `frontend/magic-web/src/pages/superMagic/pages/CrewMarket/components/__tests__/MarketStickyHeader.test.tsx` (added, +34/-0)
```diff
@@ -0,0 +1,34 @@
+import { fireEvent, render, screen } from "@testing-library/react"
+import { describe, expect, it, vi } from "vitest"
+import MarketStickyHeader from "../MarketStickyHeader"
+
+describe("MarketStickyHeader", () => {
+	it("shows the bottom gradient only while the header is stuck", () => {
+		const viewport = document.createElement("div")
+
+		render(
+			<MarketStickyHeader
+				scrollViewportRef={{ current: viewport }}
+				data-testid="market-sticky-header"
+			>
+				Search
+			</MarketStickyHeader>,
+		)
+
+		const header = screen.getByTestId("market-sticky-header")
+		expect(header).toHaveClass("after:opacity-0")
+
+		vi.spyOn(viewport, "getBoundingClientRect").mockReturnValue({ top: 120 } as DOMRect)
+		vi.spyOn(header, "getBoundingClientRect").mockReturnValue({ top: 120 } as DOMRect)
+
+		viewport.scrollTop = 200
+		fireEvent.scroll(viewport)
+
+		expect(header).toHaveClass("after:opacity-100")
+
+		viewport.scrollTop = 0
+		fireEvent.scroll(viewport)
+
+		expect(header).toHaveClass("after:opacity-0")
+	})
+})
```

**File**: `frontend/magic-web/src/pages/superMagic/pages/CrewMarket/employee-market/EmployeeMarketDesktop.tsx` (modified, +95/-86)
```diff
@@ -20,6 +20,7 @@ import {
 	WorkspaceStateCache,
 } from "@/pages/superMagic/utils/superMagicCache"
 import SearchBar from "@/pages/superMagic/pages/CrewMarket/components/SearchBar"
+import MarketStickyHeader from "@/pages/superMagic/pages/CrewMarket/components/MarketStickyHeader"
 import {
 	resolveActiveMarketFilterId,
 	resolveMarketFilterParams,
@@ -247,7 +248,7 @@ function EmployeeMarketDesktop({ scrollViewportRef }: EmployeeMarketDesktopProps
 				}
 			/>
 			{dialog}
-			<div className="mt-5 flex min-w-0 flex-col gap-5 sm:mt-6 sm:gap-6">
+			<div className="flex min-w-0 flex-col pt-5 sm:pt-6">
 				<div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
 					<div className="flex min-w-0 flex-1 flex-col gap-2">
 						<h1 className="break-words bg-gradient-to-br from-foreground via-foreground/90 to-muted-foreground bg-clip-text text-2xl font-bold leading-tight text-transparent sm:text-3xl lg:text-4xl">
@@ -285,97 +286,105 @@ function EmployeeMarketDesktop({ scrollViewportRef }: EmployeeMarketDesktopProps
 					</div>
 				</div>
 
-				<SearchBar
-					value={searchQuery}
-					onChange={setSearchQuery}
-					onSearch={handleSearch}
-					onCompositionStart={onSearchCompositionStart}
-					onCompositionEnd={onSearchCompositionEnd}
-					placeholder={t("aiSearchPlaceholder")}
-					enableSearchSubmit
-					data-testid="crew-market-desktop-search-bar"
-				/>
+				<MarketStickyHeader
+					className="gap-5 pb-5 pt-5 sm:gap-6 sm:pb-6 sm:pt-6"
+					scrollViewportRef={scrollViewportRef}
+					data-testid="crew-market-sticky-header"
+				>
+					<SearchBar
+						value={searchQuery}
+						onChange={setSearchQuery}
+						onSearch={handleSearch}
+						onCompositionStart={onSearchCompositionStart}
+						onCompositionEnd={onSearchCompositionEnd}
+						placeholder={t("aiSearchPlaceholder")}
+						enableSearchSubmit
+						data-testid="crew-market-desktop-search-bar"
+					/>
 
-				<CategoryFilter
-					categories={store.categories}
-					activeCategoryId={activeFilterId}
-					onCategoryChange={handleCategoryChange}
-					showOrganizationShared={!isPersonalOrganization}
-				/>
+					<CategoryFilter
+						categories={store.categories}
+						activeCategoryId={activeFilterId}
+						onCategoryChange={handleCategoryChange}
+						showOrganizationShared={!isPersonalOrganization}
+					/>
+				</MarketStickyHeader>
 
-				{store.loading ? (
-					<div
-						className="flex items-center justify-center py-16"
-						data-testid="crew-market-loading"
-					>
-						<Loader2 className="size-6 animate-spin text-muted-foreground" />
-					</div>
-				) : null}
+				<div className="flex min-w-0 flex-col gap-5 sm:gap-6">
+					{store.loading ? (
+						<div
+							className="flex items-center justify-center py-16"
+							data-testid="crew-market-loading"
+						>
+							<Loader2 className="size-6 animate-spin text-muted-foreground" />
+						</div>
+					) : null}
 
-				{store.isEmpty ? (
-					<div
-						className="flex flex-col items-center justify-center py-16 text-center"
-						data-testid="crew-market-empty"
-					>
-						<p className="text-sm text-muted-foreground">
-							{store.keyword ? t("noResults") : t("noMoreData")}
-						</p>
-					</div>
-				) : null}
+					{store.isEmpty ? (
+						<div
+							className="flex flex-col items-center justify-center py-16 text-center"
+							data-testid="crew-market-empty"
+						>
+							<p className="text-sm text-muted-foreground">
+								{store.keyword ? t("noResults") : t("noMoreData")}
+							</p>
+						</div>
+					) : null}
 
-				{!store.loading && store.list.length > 0 ? (
-					<div
-						className="grid grid-cols-1 items-stretch gap-3 sm:grid-cols-2 lg:grid-cols-4 [&>*]:min-h-0"
-						data-testid="employee-card-grid"
-					>
-						{store.list.map((employee) => (
-							<EmployeeCard
-								key={employee.id}
-								employee={employee}
-								actionPending={store.isAgentActionPending(employee.id)}
-								onHire={handleHire}
-								onDismiss={handleDismiss}
-								onDetails={handleDetails}
-								onOpenMarketDetail={handleOpenMarketDetail}
-							/>
-						))}
-					</div>
-				) : null}
+					{!store.loading && store.list.length > 0 ? (
+						<div
+							className="grid grid-cols-1 items-stretch gap-3 sm:grid-cols-2 lg:grid-cols-4 [&>*]:min-h-0"
+							data-testid="employee-card-grid"
+						>
+							{store.list.map((employee) => (
+								<EmployeeCard
+									key={employee.id}
+									employee={employee}
+									actionPending={store.isAgentActionPending(employee.id)}
+									onHire={handleHire}
+									onDismiss={handleDismiss}
+									onDetails={handleDetails}
+									onOpenMarketDetail={handleOpenMarketDetail}
+								/>
+							))}
+						</div>
+					) : null}
 
-				{!store.loading && store.list.length > 0 ? (
-					<div
-						ref={loadMoreSentinelRef}
-						className="h-1 w-full"
-						data-testid="crew-market-scroll-sentinel"
-					/>
-				) : null}
+					{!store
```

**File**: `frontend/magic-web/src/pages/superMagic/pages/CrewMarket/index.desktop.tsx` (modified, +6/-1)
```diff
@@ -1,13 +1,14 @@
 import { useRef } from "react"
 import { ScrollArea } from "@/components/shadcn-ui/scroll-area"
 import EmployeeMarketDesktop from "./employee-market/EmployeeMarketDesktop"
+import MarketBackToTopButton from "./components/MarketBackToTopButton"
 
 function CrewMarketPage() {
 	const scrollViewportRef = useRef<HTMLDivElement | null>(null)
 
 	return (
 		<div
-			className="flex h-full min-h-0 w-full min-w-0 flex-col overflow-hidden rounded-xl border border-border bg-background shadow-xs"
+			className="relative flex h-full min-h-0 w-full min-w-0 flex-col overflow-hidden rounded-xl border border-border bg-background shadow-xs"
 			data-testid="crew-market-page"
 		>
 			<ScrollArea
@@ -20,6 +21,10 @@ function CrewMarketPage() {
 					</div>
 				</div>
 			</ScrollArea>
+			<MarketBackToTopButton
+				viewportRef={scrollViewportRef}
+				testId="crew-market-back-to-top"
+			/>
 		</div>
 	)
 }
```

---

### Incident Patch 4: `ff6c43e3` (2026-08-11)
**Commit Message**: ✨ feat(MagicImagePreview): add support for vector content rendering

- Introduced `contentType` prop to differentiate between raster and vector content.
- Implemented `useVectorContentLayout` hook to resize SVGs at layout time for better zoom handling.
- Updated transformation logic in `MagicImagePreview` to accommodate vector content.
- Enhanced `getSvgFitScale` function to measure against the viewport for accurate scaling.
- Added tests for the new vector content layout functionality.

**File**: `frontend/magic-web/src/components/base/MagicImagePreview/README.md` (modified, +1/-0)
```diff
@@ -12,6 +12,7 @@
 | nextDisabled      | boolean                         | false  | 是否禁用下一张按钮           |
 | prevDisabled      | boolean                         | false  | 是否禁用上一张按钮           |
 | rootClassName     | string                          | -      | 根容器的自定义类名           |
+| contentType       | `raster \| vector`              | raster | 矢量模式按实际尺寸重绘 SVG   |
 | hasCompare        | boolean                         | false  | 是否启用图片对比功能         |
 | viewType          | CompareViewType                 | -      | 对比视图类型                 |
 | onChangeViewType  | (type: CompareViewType) => void | -      | 对比视图类型变更回调         |
```

**File**: `frontend/magic-web/src/components/base/MagicImagePreview/hooks/__tests__/useVectorContentLayout.test.ts` (added, +51/-0)
```diff
@@ -0,0 +1,51 @@
+import { renderHook } from "@testing-library/react"
+import { describe, expect, it } from "vitest"
+import useVectorContentLayout, { getVectorDisplaySize } from "../useVectorContentLayout"
+
+describe("getVectorDisplaySize", () => {
+	it("uses the SVG viewBox as the vector's intrinsic dimensions", () => {
+		const wrapper = document.createElement("div")
+		wrapper.innerHTML = '<svg viewBox="0 0 800 400"></svg>'
+		const svg = wrapper.querySelector("svg") as SVGSVGElement
+
+		expect(getVectorDisplaySize(svg, 1.5)).toEqual({
+			width: 1200,
+			height: 600,
+		})
+	})
+
+	it("falls back to explicit SVG dimensions when there is no viewBox", () => {
+		const wrapper = document.createElement("div")
+		wrapper.innerHTML = '<svg width="320" height="180"></svg>'
+		const svg = wrapper.querySelector("svg") as SVGSVGElement
+
+		expect(getVectorDisplaySize(svg, 2)).toEqual({
+			width: 640,
+			height: 360,
+		})
+	})
+
+	it("updates the SVG's real layout size as the preview scale changes", () => {
+		const container = document.createElement("div")
+		container.innerHTML = '<svg viewBox="0 0 800 400"></svg>'
+		const svg = container.querySelector("svg") as SVGSVGElement
+		const contentRef = { current: container }
+
+		const { rerender, unmount } = renderHook(
+			({ scale }) => useVectorContentLayout(contentRef, true, scale, "diagram"),
+			{ initialProps: { scale: 0.5 } },
+		)
+
+		expect(svg.style.width).toBe("400px")
+		expect(svg.style.height).toBe("200px")
+		expect(svg.style.maxWidth).toBe("none")
+
+		rerender({ scale: 2 })
+
+		expect(svg.style.width).toBe("1600px")
+		expect(svg.style.height).toBe("800px")
+
+		unmount()
+		expect(svg.style.cssText).toBe("")
+	})
+})
```

**File**: `frontend/magic-web/src/components/base/MagicImagePreview/hooks/useContentFitScale.ts` (modified, +21/-8)
```diff
@@ -51,16 +51,25 @@ function getImageFitScale(image: HTMLImageElement) {
 	})
 }
 
-function getSvgFitScale(svg: SVGSVGElement) {
+function getSvgFitScale(svg: SVGSVGElement, container: HTMLElement) {
 	const viewBox = svg.viewBox.baseVal
-	const intrinsicWidth = viewBox.width || svg.width.baseVal.value
-	const intrinsicHeight = viewBox.height || svg.height.baseVal.value
+	const intrinsicWidth =
+		viewBox.width ||
+		svg.width?.baseVal.value ||
+		Number.parseFloat(svg.getAttribute("width") || "")
+	const intrinsicHeight =
+		viewBox.height ||
+		svg.height?.baseVal.value ||
+		Number.parseFloat(svg.getAttribute("height") || "")
 
 	return calculateFitScale({
 		intrinsicWidth,
 		intrinsicHeight,
-		layoutWidth: svg.clientWidth,
-		layoutHeight: svg.clientHeight,
+		// Measure against the viewport instead of the SVG's current layout size.
+		// Vector previews change their real width/height while zooming; using those
+		// dimensions here would feed the zoomed size back into fitScale.
+		layoutWidth: container.clientWidth,
+		layoutHeight: container.clientHeight,
 		objectFit: "contain",
 	})
 }
@@ -90,8 +99,12 @@ function measureContentFitScale(container: HTMLElement) {
 	const svgs = Array.from(container.querySelectorAll("svg")).filter((svg) => {
 		const viewBox = svg.viewBox.baseVal
 		return (
-			(viewBox.width || svg.width.baseVal.value) &&
-			(viewBox.height || svg.height.baseVal.value)
+			(viewBox.width ||
+				svg.width?.baseVal.value ||
+				Number.parseFloat(svg.getAttribute("width") || "")) &&
+			(viewBox.height ||
+				svg.height?.baseVal.value ||
+				Number.parseFloat(svg.getAttribute("height") || ""))
 		)
 	})
 	if (svgs.length === 0) return undefined
@@ -101,7 +114,7 @@ function measureContentFitScale(container: HTMLElement) {
 		const largestSize = largest.viewBox.baseVal
 		return size.width * size.height > largestSize.width * largestSize.height ? svg : largest
 	})
-	return getSvgFitScale(sourceSvg)
+	return getSvgFitScale(sourceSvg, container)
 }
 
 /** Measures how much the browser's fitted layout scales the original image or SVG. */
```

**File**: `frontend/magic-web/src/components/base/MagicImagePreview/hooks/useVectorContentLayout.ts` (added, +57/-0)
```diff
@@ -0,0 +1,57 @@
+import type { RefObject } from "react"
+import { useLayoutEffect } from "react"
+
+export function getVectorDisplaySize(svg: SVGSVGElement, scale: number) {
+	const viewBox = svg.viewBox.baseVal
+	const intrinsicWidth =
+		viewBox.width ||
+		svg.width?.baseVal.value ||
+		Number.parseFloat(svg.getAttribute("width") || "")
+	const intrinsicHeight =
+		viewBox.height ||
+		svg.height?.baseVal.value ||
+		Number.parseFloat(svg.getAttribute("height") || "")
+
+	if (!intrinsicWidth || !intrinsicHeight || !Number.isFinite(scale) || scale <= 0) {
+		return undefined
+	}
+
+	return {
+		width: intrinsicWidth * scale,
+		height: intrinsicHeight * scale,
+	}
+}
+
+/**
+ * Resize inline SVG content at layout time so the browser redraws vectors at
+ * the requested zoom level instead of enlarging a GPU-cached texture.
+ */
+const useVectorContentLayout = (
+	contentRef: RefObject<HTMLElement>,
+	enabled: boolean,
+	scale: number,
+	contentKey: string,
+) => {
+	useLayoutEffect(() => {
+		if (!enabled) return
+
+		const svg = contentRef.current?.querySelector("svg")
+		if (!svg) return
+
+		const displaySize = getVectorDisplaySize(svg, scale)
+		if (!displaySize) return
+
+		const previousCssText = svg.style.cssText
+		svg.style.setProperty("width", `${displaySize.width}px`, "important")
+		svg.style.setProperty("height", `${displaySize.height}px`, "important")
+		svg.style.setProperty("max-width", "none", "important")
+		svg.style.setProperty("max-height", "none", "important")
+		svg.style.setProperty("flex", "none")
+
+		return () => {
+			svg.style.cssText = previousCssText
+		}
+	}, [contentKey, contentRef, enabled, scale])
+}
+
+export default useVectorContentLayout
```

**File**: `frontend/magic-web/src/components/base/MagicImagePreview/index.tsx` (modified, +11/-1)
```diff
@@ -24,6 +24,7 @@ import useScale, {
 	type WheelZoomChange,
 } from "./hooks/useScale"
 import useContentFitScale from "./hooks/useContentFitScale"
+import useVectorContentLayout from "./hooks/useVectorContentLayout"
 import useRotate from "./hooks/useRotate"
 import useOffset, { calculateZoomAnchoredOffset } from "./hooks/useOffset"
 import useStyles from "./styles"
@@ -52,6 +53,8 @@ interface Props extends HTMLAttributes<HTMLImageElement> {
 	toolContainerClassName?: string
 	onDownload?: (mode?: DownloadImageMode) => void
 	isAIImage?: boolean
+	/** Vector content is resized at layout time to remain sharp while zooming. */
+	contentType?: "raster" | "vector"
 }
 
 /**
@@ -76,6 +79,7 @@ const MagicImagePreview = (props: Props) => {
 		toolContainerClassName,
 		onDownload,
 		isAIImage = false,
+		contentType = "raster",
 		...rest
 	} = props
 	const { styles, cx } = useStyles()
@@ -115,6 +119,8 @@ const MagicImagePreview = (props: Props) => {
 		})
 	const { rotate, rotateImage } = useRotate()
 	const previewContentKey = useMemo(() => src ?? getPreviewContentKey(children), [children, src])
+	const isVectorContent = contentType === "vector"
+	useVectorContentLayout(contentRef, isVectorContent, scale, previewContentKey)
 	const sliderValue = useMemo(
 		() => scaleToSliderValue(scale, minScale, MAX_SCALE),
 		[minScale, scale],
@@ -175,7 +181,11 @@ const MagicImagePreview = (props: Props) => {
 					className={cx(styles.imageWrapper, className)}
 					draggable={false}
 					style={{
-						transform: `translate3d(${offset.x}px, ${offset.y}px, 0) rotate(${rotate}deg) scale(${transformScale})`,
+						transform: isVectorContent
+							? `translate(${offset.x}px, ${offset.y}px) rotate(${rotate}deg)`
+							: `translate3d(${offset.x}px, ${offset.y}px, 0) rotate(${rotate}deg) scale(${transformScale})`,
+						willChange: isVectorContent ? "auto" : undefined,
+						backfaceVisibility: isVectorContent ? "visible" : undefined,
 					}}
 					{...rest}
 				>
```

**File**: `frontend/magic-web/src/components/base/MagicMermaid/index.test.tsx` (added, +71/-0)
```diff
@@ -0,0 +1,71 @@
+import { fireEvent, render, screen, waitFor } from "@testing-library/react"
+import { beforeEach, describe, expect, it, vi } from "vitest"
+import { useOverlayZIndex } from "@/hooks/useOverlayZIndex"
+import MagicMermaid from "."
+
+const releaseOverlayZIndex = vi.fn()
+
+vi.mock("antd", () => ({
+	Flex: ({ children }: { children?: React.ReactNode }) => <div>{children}</div>,
+	Spin: () => <div data-testid="antd-spin" />,
+}))
+
+vi.mock("@/hooks/useOverlayZIndex", () => ({
+	useOverlayZIndex: vi.fn(() => ({
+		overlayZIndex: 1200,
+		contentZIndex: 1201,
+		releaseOverlayZIndex,
+	})),
+}))
+
+vi.mock("react-i18next", () => ({
+	useTranslation: () => ({ t: (key: string) => key }),
+}))
+
+vi.mock("../Mermaid", () => ({
+	Mermaid: ({ onClick }: { onClick?: React.MouseEventHandler<HTMLDivElement> }) => (
+		<div data-testid="mermaid-diagram" onClick={onClick}>
+			<svg viewBox="0 0 100 50" />
+		</div>
+	),
+}))
+
+vi.mock("@/services/other/MermaidRenderService", () => ({
+	default: {
+		fix: (data: string) => data,
+	},
+}))
+
+vi.mock("@/components/base/MagicImagePreview", () => ({
+	default: ({ children }: { children?: React.ReactNode }) => <div>{children}</div>,
+}))
+
+vi.mock("@/components/base/MagicSegmented", () => ({
+	default: () => <div data-testid="magic-segmented" />,
+}))
+
+vi.mock("@/components/base/MagicCode", () => ({
+	default: () => <div data-testid="magic-code" />,
+}))
+
+describe("MagicMermaid preview layering", () => {
+	beforeEach(() => {
+		releaseOverlayZIndex.mockClear()
+	})
+
+	it("renders the preview overlay above mobile file preview layers", async () => {
+		render(<MagicMermaid data="flowchart TD\nA --> B" allowPreview />)
+
+		fireEvent.click(await screen.findByTestId("mermaid-diagram"))
+
+		await waitFor(() => {
+			const overlay = document.querySelector<HTMLElement>('[data-slot="dialog-overlay"]')
+			const content = document.querySelector<HTMLElement>('[data-slot="dialog-content"]')
+
+			expect(overlay?.style.zIndex).toBe("1201")
+			expect(content?.style.zIndex).toBe("1201")
+			expect(Number(content?.style.zIndex)).toBeGreaterThan(1101)
+			expect(useOverlayZIndex).toHaveBeenLastCalledWith({ open: true, zIndex: 1200 })
+		})
+	})
+})
```

**File**: `frontend/magic-web/src/components/base/MagicMermaid/index.tsx` (modified, +29/-3)
```diff
@@ -21,10 +21,15 @@ import { exportMermaidSvgToPngBlob } from "@/utils/mermaidExport"
 import { downloadBlobFile } from "@/utils/file"
 import { clipboard } from "@/utils/clipboard-helpers"
 import magicToast from "@/components/base/MagicToaster/utils"
+import { useOverlayZIndex } from "@/hooks/useOverlayZIndex"
 
 // Lazy load Mermaid component for better performance
 const Mermaid = lazy(() => import("../Mermaid").then((module) => ({ default: module.Mermaid })))
 
+// Mobile file previews can occupy z-index 1101. Keep the nested diagram preview
+// above that baseline while still participating in the shared overlay stack.
+const MERMAID_PREVIEW_MIN_Z_INDEX = 1200
+
 const mermaidConfig = {
 	mermaid: {
 		suppressErrorRendering: true,
@@ -59,6 +64,11 @@ const MagicMermaid = memo(
 
 		const [type, setType] = useState<MagicMermaidType>(options[0].value)
 		const [previewSvg, setPreviewSvg] = useState<string>()
+		const previewOpen = Boolean(previewSvg)
+		const previewOverlayLayer = useOverlayZIndex({
+			open: previewOpen,
+			zIndex: MERMAID_PREVIEW_MIN_Z_INDEX,
+		})
 		const { styles, cx } = useStyles({ type })
 		const mermaidFileBaseName = t("imagePreview.mermaid.fileName", {
 			ns: "interface",
@@ -95,6 +105,15 @@ const MagicMermaid = memo(
 			setPreviewSvg(undefined)
 		})
 
+		const handlePreviewAnimationEnd = useMemoizedFn(
+			(event: React.AnimationEvent<HTMLDivElement>) => {
+				if (event.target !== event.currentTarget) return
+				if (event.currentTarget.dataset.state === "closed") {
+					previewOverlayLayer.releaseOverlayZIndex()
+				}
+			},
+		)
+
 		const handleCopySvg = useMemoizedFn(async () => {
 			if (!previewSvg) return
 
@@ -178,8 +197,12 @@ const MagicMermaid = memo(
 					</div>
 					<MagicCode className={styles.code} data={fixedData} copyText={copyText} />
 				</div>
-				<Dialog open={!!previewSvg} onOpenChange={(open) => !open && closePreview()}>
-					<DialogContent className="grid h-[80vh] max-h-[80vh] !max-w-[90vw] grid-rows-[auto_minmax(0,1fr)] gap-0 overflow-hidden p-0">
+				<Dialog open={previewOpen} onOpenChange={(open) => !open && closePreview()}>
+					<DialogContent
+						className="grid h-[80vh] max-h-[80vh] !max-w-[90vw] grid-rows-[auto_minmax(0,1fr)] gap-0 overflow-hidden p-0"
+						style={{ zIndex: previewOverlayLayer.contentZIndex }}
+						onAnimationEnd={handlePreviewAnimationEnd}
+					>
 						<DialogHeader className="shrink-0 border-b border-border px-3 py-3">
 							<DialogTitle className="text-base font-semibold">
 								{t("interface:chat.markdown.graph")}
@@ -188,7 +211,10 @@ const MagicMermaid = memo(
 						<ContextMenu>
 							<ContextMenuTrigger asChild>
 								<div className={styles.previewCanvas}>
-									<MagicImagePreview rootClassName={styles.previewRoot}>
+									<MagicImagePreview
+										rootClassName={styles.previewRoot}
+										contentType="vector"
+									>
 										<div
 											className={styles.previewSvg}
 											dangerouslySetInnerHTML={{ __html: previewSvg || "" }}
```

---

### Incident Patch 5: `6d0b2dd4` (2026-08-12)
**Commit Message**: chore(magic-service): fix phpstan analyse issues and formatting

Correct base64 preg_replace null checks, narrow recycle bin hydrate models with instanceof, and apply pending test file formatting updates.

**File**: `backend/magic-service/app/Domain/Design/Factory/DesignVideoInputPayloadPreparer.php` (modified, +1/-1)
```diff
@@ -131,7 +131,7 @@ private static function normalizeImageInput(array $input, string $label): string
         if ($sourceType === 'base64') {
             $mimeType = strtolower(trim((string) ($input['mime_type'] ?? '')));
             $base64Data = preg_replace('/\s+/', '', trim((string) ($input['base64_data'] ?? '')));
-            if ($base64Data === false || $base64Data === '') {
+            if ($base64Data === null || $base64Data === '') {
                 ExceptionBuilder::throw(DesignErrorCode::InvalidArgument, 'common.invalid', ['label' => $label . '.base64_data']);
             }
             $binaryData = base64_decode($base64Data, true);
```

**File**: `backend/magic-service/app/Domain/SuperMagic/Common/RecycleBin/Repository/Persistence/RecycleBinRepository.php` (modified, +3/-1)
```diff
@@ -169,7 +169,9 @@ public function getRecycleBinList(
 
         $entities = [];
         foreach ($models as $model) {
-            /** @var RecycleBinModel $model */
+            if (! $model instanceof RecycleBinModel) {
+                continue;
+            }
             $entities[] = $this->modelToEntity($model);
         }
 
```

**File**: `backend/magic-service/test/Cases/Application/SuperAgent/Service/FileManagementAppServiceTest.php` (modified, +1/-2)
```diff
@@ -536,8 +536,7 @@ public function testGetFileUrlsAllowsUserSpaceFileWithoutProjectLookup(): void
             public function __construct(
                 private readonly TranslatorInterface $translator,
                 private readonly ConfigInterface $config,
-            )
-            {
+            ) {
             }
 
             public function get(string $id): mixed
```

**File**: `backend/magic-service/test/Cases/Unit/SuperMagic/FileDownloadUrlHelperTest.php` (modified, +3/-0)
```diff
@@ -1,6 +1,9 @@
 <?php
 
 declare(strict_types=1);
+/**
+ * Copyright (c) The Magic , Distributed under the software license
+ */
 
 namespace HyperfTest\Cases\Unit\SuperMagic;
 
```

---

### Incident Patch 6: `eec35a2f` (2026-08-11)
**Commit Message**: ✨ feat: Introduce workspace detachment and null workspace handling for audio recordings

- Added a new `detachWorkspace` method to safely remove projects from a workspace without deleting recordings, enhancing data integrity.
- Updated the `RecordingEditorStartParams` and related components to allow for nullable workspaces, enabling audio recordings to start from ungrouped states.
- Enhanced the `useRecordingEntryFacade` hook to manage workspace states effectively, ensuring proper handling of grouped and ungrouped recordings.
- Updated tests to cover the new detachment functionality and workspace handling scenarios.

These changes improve the flexibility and reliability of audio recording management in the application.

**File**: `frontend/magic-web/src/apis/modules/superMagic.ts` (modified, +14/-0)
```diff
@@ -1368,6 +1368,20 @@ export const generateSuperMagicApi = (fetch: HttpClient) => ({
 		)
 	},
 
+	/**
+	 * Detaches projects/topics from a workspace then deletes the empty workspace shell.
+	 * Used by audio recording groups so deleting a group keeps the underlying recordings.
+	 */
+	detachWorkspace({ id }: { id: string }) {
+		return fetch.put(
+			`/api/v1/super-agent/workspaces/${id}/detach`,
+			{},
+			{
+				enableRequestUnion: true,
+			},
+		)
+	},
+
 	/**
 	 * @description 新增工作区
 	 * @param workspace_name
```

**File**: `frontend/magic-web/src/components/business/RecordingSummary/internal/editorPanel/types.ts` (modified, +2/-1)
```diff
@@ -51,7 +51,8 @@ export interface RecordingEditorRuntimeState {
 }
 
 export interface RecordingEditorStartParams {
-	workspace: Workspace
+	/** Nullable so audio recordings can start from All / Ungrouped without a workspace shell */
+	workspace: Workspace | null
 	project: ProjectListItem
 	topic: Topic | null
 	selectedTopic: Topic | null
```

**File**: `frontend/magic-web/src/pages/superMagic/pages/AudioRecordings/hooks/__tests__/useRecordingEntryFacade.test.tsx` (modified, +158/-27)
```diff
@@ -3,8 +3,13 @@ import { beforeEach, describe, expect, it, vi } from "vitest"
 
 import type { VoiceResultUtterance } from "@/components/business/VoiceInput/services/VoiceClient/types"
 import type { ProjectListItem, Topic, Workspace } from "@/pages/superMagic/pages/Workspace/types"
+import {
+	ALL_RECORDING_GROUP_ID,
+	UNGROUPED_RECORDING_GROUP_ID,
+} from "@/services/audioRecordings/RecordingGroupsConstants"
 import { audioRecordingsStore } from "../../stores/audio-recordings-store"
 import { buildOptimisticRecordingItem } from "../../utils/build-optimistic-recording-item"
+import { writeAudioRecordingsFilterSession } from "../../utils/audio-recordings-filter-session"
 import { useRecordingEntryFacade } from "../useRecordingEntryFacade"
 import {
 	resetRecordingSettingsCacheForTests,
@@ -109,6 +114,7 @@ const {
 		},
 		superMagicApiMock: {
 			getWorkspaces: vi.fn(),
+			getWorkspaceDetail: vi.fn(),
 			createProject: vi.fn(),
 			createAudioProject: vi.fn(),
 			deleteProject: vi.fn(),
@@ -311,6 +317,7 @@ describe("useRecordingEntryFacade", () => {
 		summaryModelListMock.resolveDefaultSummaryModelId.mockReset()
 		audioRecordingsServiceMock.submitSummary.mockReset()
 		superMagicApiMock.getWorkspaces.mockReset()
+		superMagicApiMock.getWorkspaceDetail.mockReset()
 		superMagicApiMock.createProject.mockReset()
 		superMagicApiMock.createAudioProject.mockReset()
 		superMagicApiMock.deleteProject.mockReset()
@@ -319,6 +326,15 @@ describe("useRecordingEntryFacade", () => {
 		importTestState.pendingImportContext = null
 		audioImportStoreMock.startAudioImport.mockClear()
 		audioRecordingsStore.optimisticItems = []
+		// Default list filter is All so recording/import stay ungrouped unless a test overrides it.
+		writeAudioRecordingsFilterSession({
+			summaryFilter: "all",
+			datePreset: "all",
+			sortBy: "updated_at",
+			sortOrder: "desc",
+			searchKeyword: "",
+			groupId: ALL_RECORDING_GROUP_ID,
+		})
 
 		// Mock navigator.mediaDevices.getUserMedia for jsdom test environment compatibility
 		if (typeof navigator !== "undefined") {
@@ -361,6 +377,7 @@ describe("useRecordingEntryFacade", () => {
 		} as unknown as Topic
 
 		superMagicApiMock.getWorkspaces.mockResolvedValue({ list: [workspace] })
+		superMagicApiMock.getWorkspaceDetail.mockResolvedValue(workspace)
 		superMagicApiMock.createProject.mockResolvedValue({ project, topic })
 		superMagicApiMock.createAudioProject.mockResolvedValue({ project, topic })
 		superMagicApiMock.deleteProject.mockResolvedValue(undefined)
@@ -391,24 +408,21 @@ describe("useRecordingEntryFacade", () => {
 			await result.current.startRecording()
 		})
 
-		expect(superMagicApiMock.getWorkspaces).toHaveBeenCalledWith({
-			page: 1,
-			page_size: 200,
-			workspace_type: "audio",
-			auto_create: true,
-		})
+		expect(superMagicApiMock.getWorkspaceDetail).not.toHaveBeenCalled()
 		expect(superMagicApiMock.createAudioProject).toHaveBeenCalledWith(
 			expect.objectContaining({
-				workspace_id: "workspace-audio-001",
 				audio_source: "recorded",
 				source: "pc",
 				is_hidden: true,
 				transcription_enabled: true,
 			}),
 		)
+		expect(superMagicApiMock.createAudioProject.mock.calls[0]?.[0]).not.toHaveProperty(
+			"workspace_id",
+		)
 		expect(runtimeMock.actions.startRecording).toHaveBeenCalledWith(
 			expect.objectContaining({
-				workspace: expect.objectContaining({ id: "workspace-audio-001" }),
+				workspace: null,
 				project: expect.objectContaining({ id: "project-audio-001" }),
 				topic: expect.objectContaining({ id: "topic-audio-001" }),
 				model: expect.objectContaining({ model_id: "model-alpha" }),
@@ -418,6 +432,87 @@ describe("useRecordingEntryFacade", () => {
 		expect(result.current.presentation).toBe("list")
 	})
 
+	it("attaches the current real group workspace when starting a recording", async () => {
+		writeAudioRecordingsFilterSession({
+			summaryFilter: "all",
+			datePreset: "all",
+			sortBy: "updated_at",
+			sortOrder: "desc",
+			searchKeyword: "",
+			groupId: "workspace-audio-001",
+		})
+
+		const { result } = renderHook(() => useRecordingEntryFacade())
+
+		await act(async () => {
+			await result.current.startRecording()
+		})
+
+		expect(superMagicApiMock.getWorkspaceDetail).toHaveBeenCalledWith({
+			id: "workspace-audio-001",
+		})
+		expect(superMagicApiMock.createAudioProject).toHaveBeenCalledWith(
+			expect.objectContaining({
+				workspace_id: "workspace-audio-001",
+				audio_source: "recorded",
+			}),
+		)
+		expect(runtimeMock.actions.startRecording).toHaveBeenCalledWith(
+			expect.objectContaining({
+				workspace: expect.objectContaining({ id: "workspace-audio-001" }),
+			}),
+		)
+	})
+
+	it("keeps new recordings ungrouped when the shared filter is Ungrouped", async () => {
+		writeAudioRecordingsFilterSession({
+			summaryFilter: "all",
+			datePreset: "all",
+			sortBy: "updated_at",
+			sortOrder: "desc",
+			searchKeyword: "",
+			groupId: UNGROUPED_RECORDING_GROUP_ID,
+		})
+
+		const { resul
```

**File**: `frontend/magic-web/src/pages/superMagic/pages/AudioRecordings/hooks/useRecordingEntryFacade.ts` (modified, +28/-17)
```diff
@@ -27,11 +27,15 @@ import { getCachedRecordingSettings, patchCachedRecordingSettings } from "./useR
 import { audioRecordingsService } from "@/services/audioRecordings/AudioRecordingsService"
 import { audioRecordingsStore } from "../stores/audio-recordings-store"
 import { SuperMagicApi } from "@/apis"
-import { AUDIO_WORKSPACE_TYPE } from "@/services/audioRecordings/RecordingGroupsConstants"
+import {
+	ALL_RECORDING_GROUP_ID,
+	UNGROUPED_RECORDING_GROUP_ID,
+} from "@/services/audioRecordings/RecordingGroupsConstants"
 import { createRandomUuidV4 } from "@/utils/create-random-uuid-v4"
 import type { VoiceResultUtterance } from "@/components/business/VoiceInput/services/VoiceClient/types"
 import { buildOptimisticRecordingItem } from "../utils/build-optimistic-recording-item"
 import { resolveCardStatusFromListItem } from "../utils/normalize-audio-project-item"
+import { readAudioRecordingsFilterSession } from "../utils/audio-recordings-filter-session"
 
 export type EntryPresentation = "list" | "recording"
 export type RecordingStartupState = "idle" | "starting" | "error"
@@ -178,7 +182,8 @@ function resolveRecordingStartupErrorContent(error: Error | undefined): {
 }
 
 interface AudioProjectContext {
-	workspace: Workspace
+	/** Null when the shared filter is All / Ungrouped so the new project stays ungrouped */
+	workspace: Workspace | null
 	project: ProjectListItem
 	topic: Topic
 }
@@ -300,8 +305,8 @@ export function useRecordingEntryFacade(): UseRecordingEntryFacadeResult {
 	}, [])
 
 	/**
-	 * Creates a new audio recording project context under the dedicated audio
-	 * workspace so `/audio-projects` queries can later surface it in the list.
+	 * Creates a new audio project under the group selected at click-time.
+	 * Real groups resolve their workspace detail; All / Ungrouped stay ungrouped.
 	 */
 	const createAudioProjectContext = useCallback(
 		async (options: {
@@ -312,16 +317,22 @@ export function useRecordingEntryFacade(): UseRecordingEntryFacadeResult {
 			autoSummaryEnabled?: boolean
 			transcriptionEnabled?: boolean
 		}): Promise<AudioProjectContext | null> => {
-			const workspacesResponse = (await SuperMagicApi.getWorkspaces({
-				page: 1,
-				page_size: 200,
-				workspace_type: AUDIO_WORKSPACE_TYPE,
-				auto_create: true,
-			})) as {
-				list?: Workspace[]
+			// Snapshot the shared PC/H5 list filter at the moment of the action.
+			const { groupId } = readAudioRecordingsFilterSession()
+			const isVirtualGroup =
+				groupId === ALL_RECORDING_GROUP_ID || groupId === UNGROUPED_RECORDING_GROUP_ID
+
+			let workspace: Workspace | null = null
+			if (!isVirtualGroup) {
+				// Abort creation when the real group cannot be resolved so we never
+				// silently fall back into the ungrouped bucket.
+				try {
+					workspace = await SuperMagicApi.getWorkspaceDetail({ id: groupId })
+				} catch {
+					return null
+				}
+				if (!workspace?.id) return null
 			}
-			const audioWorkspace = workspacesResponse.list?.[0]
-			if (!audioWorkspace) return null
 
 			const autoSummary =
 				options.autoSummaryEnabled ??
@@ -337,7 +348,7 @@ export function useRecordingEntryFacade(): UseRecordingEntryFacadeResult {
 				)
 
 			const createdProject = await SuperMagicApi.createAudioProject({
-				workspace_id: audioWorkspace.id,
+				...(workspace?.id ? { workspace_id: workspace.id } : {}),
 				project_name: options.projectName ?? "",
 				task_key: options.taskKey,
 				auto_summary: autoSummary,
@@ -355,7 +366,7 @@ export function useRecordingEntryFacade(): UseRecordingEntryFacadeResult {
 			if (!createdProject?.project || !createdProject?.topic) return null
 
 			return {
-				workspace: audioWorkspace,
+				workspace,
 				project: createdProject.project,
 				topic: createdProject.topic,
 			}
@@ -764,7 +775,7 @@ export function useRecordingEntryFacade(): UseRecordingEntryFacadeResult {
 			const initialOptimisticItem = buildOptimisticRecordingItem({
 				projectId: audioProjectContext.project.id,
 				projectName: normalizedFiles[0]?.name || audioProjectContext.project.project_name,
-				workspaceId: audioProjectContext.workspace.id,
+				workspaceId: audioProjectContext.workspace?.id ?? UNGROUPED_RECORDING_GROUP_ID,
 				modelId: model.model_id,
 				taskKey,
 				audioSource: "imported",
@@ -781,7 +792,7 @@ export function useRecordingEntryFacade(): UseRecordingEntryFacadeResult {
 				projectId: audioProjectContext.project.id,
 				projectName: normalizedFiles[0]?.name || audioProjectContext.project.project_name,
 				topicId: audioProjectContext.topic.id,
-				workspaceId: audioProjectContext.workspace.id,
+				workspaceId: audioProjectContext.workspace?.id ?? UNGROUPED_RECORDING_GROUP_ID,
 				modelId: model.model_id,
 				taskKey,
 				autoSummaryEnabled,
```

**File**: `frontend/magic-web/src/services/audioRecordings/RecordingGroupsService.ts` (modified, +5/-2)
```diff
@@ -114,9 +114,12 @@ export class RecordingGroupsService {
 		})
 	}
 
-	/** Deletes a real audio workspace group */
+	/**
+	 * Safely removes a recording group by detaching its projects first,
+	 * so recordings become ungrouped instead of cascading into hard deletes.
+	 */
 	async deleteGroup(id: string): Promise<void> {
-		await SuperMagicApi.deleteWorkspace({ id })
+		await SuperMagicApi.detachWorkspace({ id })
 	}
 }
 
```

**File**: `frontend/magic-web/src/services/audioRecordings/__tests__/RecordingGroupsService.test.ts` (modified, +12/-0)
```diff
@@ -9,6 +9,7 @@ vi.mock("@/apis", () => ({
 		createWorkspace: vi.fn(),
 		editWorkspace: vi.fn(),
 		deleteWorkspace: vi.fn(),
+		detachWorkspace: vi.fn(),
 	},
 }))
 
@@ -71,4 +72,15 @@ describe("RecordingGroupsService", () => {
 		expect(result.id).toBe("workspace-created-1")
 		expect(result.isVirtual).toBe(false)
 	})
+
+	it("deletes groups through detach so recordings stay ungrouped", async () => {
+		vi.mocked(SuperMagicApi.detachWorkspace).mockResolvedValue(undefined)
+
+		await service.deleteGroup("workspace-mock-detach-1")
+
+		expect(SuperMagicApi.detachWorkspace).toHaveBeenCalledWith({
+			id: "workspace-mock-detach-1",
+		})
+		expect(SuperMagicApi.deleteWorkspace).not.toHaveBeenCalled()
+	})
 })
```

**File**: `frontend/magic-web/src/services/recordSummary/RecordSummaryService.tsx` (modified, +15/-11)
```diff
@@ -466,7 +466,8 @@ class RecordSummaryService {
 		sessionId,
 		transcriptionEnabled = true,
 	}: {
-		workspace: Workspace
+		/** Allow starting without a workspace when the recordings entry is on All / Ungrouped */
+		workspace: Workspace | null
 		model: ModelItem
 		project: ProjectListItem
 		topic?: Topic | null
@@ -552,7 +553,7 @@ class RecordSummaryService {
 			})
 
 			logger.report("开始录音", {
-				workspace: workspace.name,
+				workspace: workspace?.name,
 				project: project.project_name,
 				audioSource: audioSource?.source,
 			})
@@ -2023,13 +2024,13 @@ class RecordSummaryService {
 		onError: (error: Error) => void
 		skipSummary?: boolean
 	}) => {
+		// Workspace may be null for All / Ungrouped audio recordings; project + topic are enough.
 		if (
-			!recordSummaryStore.businessData.workspace ||
 			!recordSummaryStore.businessData.topic ||
 			!recordSummaryStore.businessData.project ||
 			!recordSummaryStore.businessData.model
 		) {
-			onError(new Error("workspace, topic, project, model is required"))
+			onError(new Error("topic, project, model is required"))
 			return
 		}
 
@@ -2157,8 +2158,9 @@ class RecordSummaryService {
 			throw new Error("录音会话不能为空")
 		}
 
-		if (!session.workspace || !session.model) {
-			throw new Error("会话中缺少必需的 workspace 或 model")
+		// Workspace can be null when the recording started from All / Ungrouped.
+		if (!session.model) {
+			throw new Error("会话中缺少必需的 model")
 		}
 
 		logger.log("开始完成目标录音会话", {
@@ -3702,8 +3704,9 @@ class RecordSummaryService {
 				return
 			}
 
-			if (!session.workspace || !session.model) {
-				logger.warn("finishHistoricalSession: session missing workspace or model")
+			// Null workspace is valid for ungrouped recordings; only model is required here.
+			if (!session.model) {
+				logger.warn("finishHistoricalSession: session missing model")
 				return
 			}
 
@@ -4146,7 +4149,8 @@ class RecordSummaryService {
 	}> {
 		const workspaceId = session.workspace?.id || ""
 
-		// 如果没有项目ID，创建新项目
+		// Create a project only when a real workspace is available; ungrouped
+		// recordings must already carry a project created at start.
 		if (!session.project && workspaceId) {
 			const res = await SuperMagicApi.createProject({
 				workspace_id: workspaceId,
@@ -4158,8 +4162,8 @@ class RecordSummaryService {
 			session.project = res.project
 			session.topic = res.topic
 		}
-		// 如果有项目但没有话题，创建新话题
-		else if (session.project && !session.topic && workspaceId) {
+		// Topic creation only needs project_id; allow null workspace (ungrouped).
+		else if (session.project && !session.topic) {
 			const res = await SuperMagicApi.createTopic({
 				// workspace_id: workspaceId,
 				project_id: session.project.id,
```

---

### Incident Patch 7: `3e1180ed` (2026-08-11)
**Commit Message**: fix: add get_head_object_by_credential_success log

**File**: `backend/magic-service/app/Domain/File/Repository/Persistence/CloudFileRepository.php` (modified, +3/-0)
```diff
@@ -570,6 +570,7 @@ public function getHeadObjectByCredential(
                 'organization_code' => $organizationCode,
                 'object_key' => $objectKey,
                 'bucket_type' => $bucketType->value,
+                'content_type' => $result['content_type'] ?? null,
                 'content_length' => $result['content_length'] ?? null,
                 'last_modified' => $result['last_modified'] ?? null,
             ]);
@@ -628,6 +629,7 @@ public function setHeadObjectByCredential(
                 'organization_code' => $organizationCode,
                 'object_key' => $objectKey,
                 'bucket_type' => $bucketType->value,
+                'content_type' => $metadata['content_type'] ?? null,
                 'metadata_count' => count($metadata),
             ]);
         } catch (Throwable $exception) {
@@ -704,6 +706,7 @@ public function createObjectByCredential(
                 'object_key' => $objectKey,
                 'object_type' => $isFolder ? 'folder' : 'file',
                 'bucket_type' => $bucketType->value,
+                'content_type' => $createOptions['content_type'] ?? null,
                 'content_length' => strlen($createOptions['content'] ?? ''),
             ]);
         } catch (Throwable $exception) {
```

---

### Incident Patch 8: `966edcc2` (2026-08-11)
**Commit Message**: fix: sync MagicFS object content type metadata

**File**: `backend/magic-service/.gitignore` (modified, +1/-1)
```diff
@@ -31,7 +31,7 @@ scripts/
 storage/files/test001
 /CLAUDE.md
 /AGENTS.md
-/agents/skills/
+.agents
 .cursor/
 .github
 /docs/
```

---

### Incident Patch 9: `40ca4dc4` (2026-08-11)
**Commit Message**: fix: sync MagicFS object content type metadata

**File**: `backend/magic-service/.php-cs-fixer.php` (modified, +0/-2)
```diff
@@ -99,7 +99,5 @@
             ->exclude('runtime')
             ->exclude('vendor')
             ->in(__DIR__)
-            # cs-fix 企业包,同时排除包的 vendor 目录
-            ->append(Finder::create()->in(__DIR__.'/vendor/dtyq/super-magic-module')->exclude('vendor'))
     )
     ->setUsingCache(false);
```

**File**: `backend/magic-service/app/Domain/SuperMagic/File/Service/MagicFSFileDomainService.php` (modified, +40/-1)
```diff
@@ -19,6 +19,7 @@
 use App\ErrorCode\SuperAgentErrorCode;
 use App\Infrastructure\Core\Exception\ExceptionBuilder;
 use App\Infrastructure\Core\ValueObject\StorageBucketType;
+use App\Infrastructure\SuperMagic\Utils\ContentTypeUtil;
 use App\Infrastructure\SuperMagic\Utils\WorkDirectoryUtil;
 use App\Infrastructure\SuperMagic\Utils\WorkFileUtil;
 use App\Infrastructure\Util\IdGenerator\IdGenerator;
@@ -312,13 +313,20 @@ public function createFile(string $name, string $parentId, bool $isDirectory, ?s
                 // 使用 workDir 作为 prefix（用于 STS 临时凭证的权限范围）
                 $prefix = WorkDirectoryUtil::getPrefix($workDir);
 
+                $options = [];
+                $contentType = ContentTypeUtil::getMappedContentType($name);
+                if ($contentType !== null) {
+                    $options['content_type'] = $contentType;
+                }
+
                 // 在对象存储上创建空文件
                 $this->cloudFileRepository->createFileByCredential(
                     $prefix,
                     $organizationCode,
                     $s3Key,
                     '',  // 空内容
-                    StorageBucketType::SandBox
+                    StorageBucketType::SandBox,
+                    $options
                 );
             } catch (Throwable $e) {
                 // 对象存储创建失败，抛出异常，阻止数据库保存
@@ -386,6 +394,7 @@ public function determineIsHidden(string $fileName, ?int $parentId, int $project
     public function updateFile(string $fileId, array $updates): TaskFileEntity
     {
         $file = $this->getFileById($fileId);
+        $originalExtension = strtolower($file->getFileExtension());
 
         $oldParentId = $file->getParentId();
         $newParentIdInt = null;
@@ -565,6 +574,17 @@ public function updateFile(string $fileId, array $updates): TaskFileEntity
             }
         }
 
+        $extensionChanged = isset($updateData['file_extension'])
+            && $originalExtension !== strtolower($updatedFile->getFileExtension());
+        if ($extensionChanged) {
+            $contentType = ContentTypeUtil::getMappedContentType($updatedFile->getFileName());
+            if ($contentType !== null) {
+                $this->tryUpdateObjectMetadata($updatedFile, [
+                    'content_type' => $contentType,
+                ]);
+            }
+        }
+
         return $updatedFile;
     }
 
@@ -908,6 +928,25 @@ protected function getAllChildrenByProjectIdAndParentId(
         );
     }
 
+    private function tryUpdateObjectMetadata(TaskFileEntity $file, array $metadata): void
+    {
+        try {
+            $this->cloudFileRepository->setHeadObjectByCredential(
+                $file->getOrganizationCode(),
+                $file->getFileKey(),
+                $metadata,
+                StorageBucketType::SandBox
+            );
+        } catch (Throwable $throwable) {
+            $this->logger->warning('magicfs_update_object_metadata_failed', [
+                'file_id' => $file->getFileId(),
+                'file_name' => $file->getFileName(),
+                'metadata' => $metadata,
+                'error' => $throwable->getMessage(),
+            ]);
+        }
+    }
+
     /**
      * @param int[] $fileIds
      * @return TaskFileEntity[]
```

**File**: `backend/magic-service/app/Infrastructure/SuperMagic/Utils/ContentTypeUtil.php` (modified, +18/-3)
```diff
@@ -125,6 +125,23 @@ class ContentTypeUtil
         'mp3', 'wav', 'ogg', 'm4a',
     ];
 
+    /**
+     * Get mapped Content-Type for a file based on its extension.
+     *
+     * Returns null when the extension is empty or not explicitly mapped,
+     * allowing callers to preserve the object storage provider's default.
+     */
+    public static function getMappedContentType(string $filename): ?string
+    {
+        $extension = strtolower((string) pathinfo($filename, PATHINFO_EXTENSION));
+
+        if ($extension === '') {
+            return null;
+        }
+
+        return self::$contentTypeMap[$extension] ?? null;
+    }
+
     /**
      * Get Content-Type for a file based on its extension.
      *
@@ -133,9 +150,7 @@ class ContentTypeUtil
      */
     public static function getContentType(string $filename): string
     {
-        $extension = strtolower(pathinfo($filename, PATHINFO_EXTENSION));
-
-        return self::$contentTypeMap[$extension] ?? 'application/octet-stream';
+        return self::getMappedContentType($filename) ?? 'application/octet-stream';
     }
 
     /**
```

---

### Incident Patch 10: `0f9effd0` (2026-08-11)
**Commit Message**: fix: preserve inline mode for preview file URLs

**File**: `backend/magic-service/app/Infrastructure/SuperMagic/Utils/FileDownloadUrlHelper.php` (modified, +2/-0)
```diff
@@ -42,6 +42,8 @@ public static function prepareFileUrlOptions(
         switch (strtolower($downloadMode)) {
             case 'preview':
             case 'inline':
+                $urlOptions['download'] = false;
+                // no break
             case 'normal_download':
                 // Preview mode: inline if previewable, otherwise force download
                 if (ContentTypeUtil::isPreviewable($filename)) {
```

**File**: `backend/magic-service/test/Cases/Unit/SuperMagic/FileDownloadUrlHelperTest.php` (added, +35/-0)
```diff
@@ -0,0 +1,35 @@
+<?php
+
+declare(strict_types=1);
+
+namespace HyperfTest\Cases\Unit\SuperMagic;
+
+use App\Infrastructure\SuperMagic\Utils\FileDownloadUrlHelper;
+use PHPUnit\Framework\TestCase;
+
+/**
+ * @internal
+ */
+class FileDownloadUrlHelperTest extends TestCase
+{
+    public function testPreviewUrlOptionsDisableDownload(): void
+    {
+        $options = FileDownloadUrlHelper::prepareFileUrlOptions('text.css', 'preview');
+
+        $this->assertFalse($options['download']);
+    }
+
+    public function testInlineUrlOptionsDisableDownload(): void
+    {
+        $options = FileDownloadUrlHelper::prepareFileUrlOptions('text.css', 'inline');
+
+        $this->assertFalse($options['download']);
+    }
+
+    public function testDownloadUrlOptionsDoNotSpecifyDownloadFlag(): void
+    {
+        $options = FileDownloadUrlHelper::prepareFileUrlOptions('text.css', 'download');
+
+        $this->assertArrayNotHasKey('download', $options);
+    }
+}
```

---

### Incident Patch 11: `259da394` (2026-08-11)
**Commit Message**: fix(super-magic): fix file version

**File**: `backend/super-magic-module/src/Domain/SuperAgent/Service/TaskFileDomainService.php` (modified, +1/-4)
```diff
@@ -3593,10 +3593,7 @@ public function replaceFile(
 
         $updatedFile = $this->taskFileRepository->updateById($originalFile);
 
-        $parentId = $originalFile->getParentId();
-        if ($parentId !== null) {
-            $this->incrementVersionChain((string) $parentId);
-        }
+        $this->incrementVersionChain((string) $fileId);
 
         return $updatedFile;
     }
```

---

### Incident Patch 12: `862e51de` (2026-08-11)
**Commit Message**: 🐛 fix: align AI inspector overlay in mobile preview

**File**: `frontend/magic-web/src/components/business/ElementInspector/ElementInspectorOverlay.tsx` (modified, +35/-159)
```diff
@@ -15,9 +15,12 @@ import type { JSONContent } from "@tiptap/react"
 import { useTranslation } from "react-i18next"
 import { Crosshair, X, Copy, MousePointer, Send } from "lucide-react"
 import { Button } from "@/components/shadcn-ui/button"
-import { INSPECTOR_DETAIL_TYPE } from "@/pages/superMagic/components/MessageEditor/extensions/inspector-detail/const"
-import { MentionItemType } from "@/components/business/MentionPanel/types"
 import type { InspectedElementInfo, InspectedElementRect } from "./types"
+import { getInspectorOverlayScale, toInspectorOverlayRect } from "./geometry"
+import { buildAgentPromptContent } from "./agentPrompt"
+import { formatElementSize, getShortSelector } from "./format"
+
+export { buildAgentPromptContent } from "./agentPrompt"
 
 // ─── Props ───────────────────────────────────────────────────────────────────
 
@@ -44,19 +47,6 @@ interface ElementInspectorOverlayProps {
 	scaleRatio?: number
 }
 
-// ─── Helpers ─────────────────────────────────────────────────────────────────
-
-function getShortSelector(info: InspectedElementInfo): string {
-	let s = info.tagName
-	if (info.id) s += `#${info.id}`
-	if (info.classList.length > 0) s += `.${info.classList.slice(0, 2).join(".")}`
-	return s
-}
-
-function formatSize(w: number, h: number): string {
-	return `${Math.round(w)} × ${Math.round(h)}`
-}
-
 // ─── Component ───────────────────────────────────────────────────────────────
 
 export function ElementInspectorOverlay({
@@ -108,6 +98,20 @@ export function ElementInspectorOverlay({
 		}
 	}, [iframeRef, active, hoveredElement])
 
+	const getOverlayGeometry = useCallback(() => {
+		const iframe = iframeRef.current
+		const parent = overlayRef.current?.parentElement
+		if (!iframe || !parent) return null
+
+		return {
+			iframeRect: iframe.getBoundingClientRect(),
+			iframeSize: { width: iframe.clientWidth, height: iframe.clientHeight },
+			containerRect: parent.getBoundingClientRect(),
+			containerSize: { width: parent.clientWidth, height: parent.clientHeight },
+			fallbackScale: scaleRatio,
+		}
+	}, [iframeRef, scaleRatio])
+
 	/**
 	 * Convert an iframe-viewport-relative rect to overlay-relative coordinates.
 	 * Uses live DOM measurements to handle:
@@ -116,36 +120,17 @@ export function ElementInspectorOverlay({
 	 */
 	const toOverlayRect = useCallback(
 		(rect: InspectedElementRect) => {
-			const iframe = iframeRef.current
-			const parent = overlayRef.current?.parentElement
-			if (!iframe || !parent) return null
-			const parentRect = parent.getBoundingClientRect()
-			const ifRect = iframe.getBoundingClientRect()
-			// Auto-detect effective scale from visual vs layout dimensions
-			const effectiveScale =
-				scaleRatio !== 1
-					? scaleRatio
-					: iframe.clientWidth > 0
-						? ifRect.width / iframe.clientWidth
-						: 1
-			return {
-				left: ifRect.left - parentRect.left + rect.left * effectiveScale,
-				top: ifRect.top - parentRect.top + rect.top * effectiveScale,
-				width: rect.width * effectiveScale,
-				height: rect.height * effectiveScale,
-			}
+			const geometry = getOverlayGeometry()
+			return geometry ? toInspectorOverlayRect(rect, geometry) : null
 		},
-		[iframeRef, scaleRatio],
+		[getOverlayGeometry],
 	)
 
-	/** Get the current effective scale ratio (auto-detected or from prop) */
-	const getEffectiveScale = useCallback(() => {
-		const iframe = iframeRef.current
-		if (!iframe) return scaleRatio
-		const ifRect = iframe.getBoundingClientRect()
-		if (scaleRatio !== 1) return scaleRatio
-		return iframe.clientWidth > 0 ? ifRect.width / iframe.clientWidth : 1
-	}, [iframeRef, scaleRatio])
+	/** Get the iframe scale relative to the overlay's coordinate system. */
+	const getOverlayScale = useCallback(() => {
+		const geometry = getOverlayGeometry()
+		return geometry ? getInspectorOverlayScale(geometry) : { x: scaleRatio, y: scaleRatio }
+	}, [getOverlayGeometry, scaleRatio])
 
 	const hoverBox = useMemo(
 		() => (hoveredElement ? toOverlayRect(hoveredElement.rect) : null),
@@ -158,9 +143,9 @@ export function ElementInspectorOverlay({
 		// eslint-disable-next-line react-hooks/exhaustive-deps
 		[selectedElement, toOverlayRect, iframeRect],
 	)
-
 	// Don't render anything if not active and no selection
 	if (!active && !selectedElement) return null
+	const overlayScale = getOverlayScale()
 
 	return (
 		<div
@@ -197,19 +182,16 @@ export function ElementInspectorOverlay({
 						<div
 							className="pointer-events-none absolute"
 							style={{
-								left:
-									hoverBox.left -
-									hoveredElement.padding.left * getEffectiveScale(),
-								top:
-									hoverBox.top - hoveredElement.padding.top * getEffectiveScale(),
+								left: hoverBox.left - hoveredElement.padding.left * overlayScale.x,
+								top: hoverBox.top - hoveredElement.padding.top * overlayScale.y,
 								width:
 									hoverBox.width +
 									(hoveredElement.padding.left + hoveredElement.padding.right) *
-										getEffectiveScale(
```

**File**: `frontend/magic-web/src/components/business/ElementInspector/__tests__/geometry.test.ts` (added, +76/-0)
```diff
@@ -0,0 +1,76 @@
+import { describe, expect, it } from "vitest"
+
+import { toInspectorOverlayRect } from "../geometry"
+
+describe("ElementInspector overlay geometry", () => {
+	it("does not apply the phone-shell scale twice", () => {
+		const scale = 0.8738636
+		const rect = toInspectorOverlayRect(
+			{ top: 339.5, left: 40, width: 321, height: 43 },
+			{
+				iframeRect: {
+					top: 192.9273,
+					left: 648.181,
+					width: 350.4193115234375,
+					height: 686.8568115234375,
+				},
+				iframeSize: { width: 401, height: 786 },
+				containerRect: {
+					top: 192.9273,
+					left: 648.181,
+					width: 350.4193115234375,
+					height: 686.8568115234375,
+				},
+				containerSize: { width: 401, height: 786 },
+				fallbackScale: scale,
+			},
+		)
+
+		expect(rect).toEqual({ top: 339.5, left: 40, width: 321, height: 43 })
+	})
+
+	it("applies an iframe-only scale in overlay coordinates", () => {
+		const rect = toInspectorOverlayRect(
+			{ top: 120, left: 40, width: 320, height: 44 },
+			{
+				iframeRect: { top: 20, left: 30, width: 200, height: 400 },
+				iframeSize: { width: 400, height: 800 },
+				containerRect: { top: 0, left: 0, width: 500, height: 900 },
+				containerSize: { width: 500, height: 900 },
+				fallbackScale: 1,
+			},
+		)
+
+		expect(rect).toEqual({ top: 80, left: 50, width: 160, height: 22 })
+	})
+
+	it("converts the iframe offset into the scaled container coordinates", () => {
+		const rect = toInspectorOverlayRect(
+			{ top: 60, left: 40, width: 100, height: 20 },
+			{
+				iframeRect: { top: 120, left: 130, width: 200, height: 400 },
+				iframeSize: { width: 400, height: 800 },
+				containerRect: { top: 100, left: 100, width: 250, height: 450 },
+				containerSize: { width: 500, height: 900 },
+				fallbackScale: 1,
+			},
+		)
+
+		expect(rect).toEqual({ top: 100, left: 100, width: 100, height: 20 })
+	})
+
+	it("uses the fallback scale when layout dimensions are unavailable", () => {
+		const rect = toInspectorOverlayRect(
+			{ top: 20, left: 10, width: 100, height: 40 },
+			{
+				iframeRect: { top: 30, left: 40, width: 0, height: 0 },
+				iframeSize: { width: 0, height: 0 },
+				containerRect: { top: 10, left: 10, width: 0, height: 0 },
+				containerSize: { width: 0, height: 0 },
+				fallbackScale: 0.75,
+			},
+		)
+
+		expect(rect).toEqual({ top: 35, left: 37.5, width: 75, height: 30 })
+	})
+})
```

**File**: `frontend/magic-web/src/components/business/ElementInspector/agentPrompt.ts` (added, +100/-0)
```diff
@@ -0,0 +1,100 @@
+import type { JSONContent } from "@tiptap/react"
+
+import { MentionItemType } from "@/components/business/MentionPanel/types"
+import { INSPECTOR_DETAIL_TYPE } from "@/pages/superMagic/components/MessageEditor/extensions/inspector-detail/const"
+import type { InspectedElementInfo } from "./types"
+
+/** Build the structured inspector context inserted into the agent input. */
+export function buildAgentPromptContent(
+	info: InspectedElementInfo,
+	title: string,
+	fileInfo?: { fileId: string; fileName: string; filePath: string },
+): JSONContent {
+	const paragraphs: JSONContent[] = []
+	const fileMention = fileInfo
+		? {
+				type: MentionItemType.PROJECT_FILE,
+				data: {
+					file_id: fileInfo.fileId,
+					file_name: fileInfo.fileName,
+					file_path: fileInfo.filePath,
+					file_extension: fileInfo.fileName.includes(".")
+						? (fileInfo.fileName.split(".").pop() ?? "")
+						: "",
+				},
+			}
+		: null
+
+	const keyStyleProps = [
+		"display",
+		"position",
+		"width",
+		"height",
+		"color",
+		"backgroundColor",
+		"fontSize",
+		"fontFamily",
+		"margin",
+		"padding",
+		"border",
+		"borderRadius",
+		"flexDirection",
+		"alignItems",
+		"justifyContent",
+		"gap",
+		"overflow",
+		"zIndex",
+	] as const
+	const styleLines = keyStyleProps.flatMap((prop) => {
+		const value = info.computedStyles[prop as keyof typeof info.computedStyles]
+		if (
+			value &&
+			value !== "none" &&
+			value !== "normal" &&
+			value !== "auto" &&
+			value !== "0px"
+		) {
+			return [`${prop}: ${value}`]
+		}
+		return []
+	})
+
+	const computedStyles: Record<string, string> = {}
+	for (const line of styleLines) {
+		const separatorIndex = line.indexOf(": ")
+		if (separatorIndex > 0) {
+			computedStyles[line.slice(0, separatorIndex)] = line.slice(separatorIndex + 2)
+		}
+	}
+	const textPreview = info.textContent
+		? info.textContent.length > 60
+			? `${info.textContent.slice(0, 60)}…`
+			: info.textContent
+		: ""
+
+	paragraphs.push({
+		type: "paragraph",
+		content: [
+			{
+				type: INSPECTOR_DETAIL_TYPE,
+				attrs: {
+					title,
+					selector: info.selector,
+					tagName: info.tagName,
+					size: `${Math.round(info.rect.width)} × ${Math.round(info.rect.height)} px`,
+					computedStyles: JSON.stringify(computedStyles),
+					styleCount: styleLines.length,
+					textContent: textPreview,
+					elementAttributes: JSON.stringify(info.attributes ?? {}),
+					resource: info.resource ?? "",
+					domContext: JSON.stringify(info.domContext ?? {}),
+					elementHtml: info.elementHtml ?? "",
+					selectorMatchCount: info.selectorMatchCount ?? -1,
+					fileMention,
+				},
+			},
+		],
+	})
+
+	return { type: "doc", content: paragraphs }
+}
```

**File**: `frontend/magic-web/src/components/business/ElementInspector/format.ts` (added, +14/-0)
```diff
@@ -0,0 +1,14 @@
+import type { InspectedElementInfo } from "./types"
+
+export function getShortSelector(info: InspectedElementInfo): string {
+	let selector = info.tagName
+	if (info.id) selector += `#${info.id}`
+	if (info.classList.length > 0) {
+		selector += `.${info.classList.slice(0, 2).join(".")}`
+	}
+	return selector
+}
+
+export function formatElementSize(width: number, height: number): string {
+	return `${Math.round(width)} × ${Math.round(height)}`
+}
```

**File**: `frontend/magic-web/src/components/business/ElementInspector/geometry.ts` (added, +98/-0)
```diff
@@ -0,0 +1,98 @@
+import type { InspectedElementRect } from "./types"
+
+interface RectLike {
+	top: number
+	left: number
+	width: number
+	height: number
+}
+
+interface SizeLike {
+	width: number
+	height: number
+}
+
+interface InspectorOverlayGeometry {
+	iframeRect: RectLike
+	iframeSize: SizeLike
+	containerRect: RectLike
+	containerSize: SizeLike
+	fallbackScale: number
+}
+
+interface InspectorOverlayScale {
+	x: number
+	y: number
+}
+
+function getAxisGeometry(
+	iframeVisualSize: number,
+	iframeLayoutSize: number,
+	containerVisualSize: number,
+	containerLayoutSize: number,
+	fallbackScale: number,
+) {
+	// The overlay is positioned inside the container's transformed coordinate system.
+	// Divide the iframe's visual scale by the container's visual scale so a shared
+	// phone-shell transform is not applied twice. Use the caller's scale only when
+	// layout measurements are unavailable during initial or detached rendering.
+	const containerScale =
+		containerVisualSize > 0 && containerLayoutSize > 0
+			? containerVisualSize / containerLayoutSize
+			: null
+	const iframeScale =
+		iframeVisualSize > 0 && iframeLayoutSize > 0 ? iframeVisualSize / iframeLayoutSize : null
+
+	return {
+		containerScale: containerScale ?? 1,
+		relativeScale:
+			containerScale !== null && iframeScale !== null
+				? iframeScale / containerScale
+				: fallbackScale,
+	}
+}
+
+function getOverlayAxes(geometry: InspectorOverlayGeometry) {
+	return {
+		horizontal: getAxisGeometry(
+			geometry.iframeRect.width,
+			geometry.iframeSize.width,
+			geometry.containerRect.width,
+			geometry.containerSize.width,
+			geometry.fallbackScale,
+		),
+		vertical: getAxisGeometry(
+			geometry.iframeRect.height,
+			geometry.iframeSize.height,
+			geometry.containerRect.height,
+			geometry.containerSize.height,
+			geometry.fallbackScale,
+		),
+	}
+}
+
+export function getInspectorOverlayScale(
+	geometry: InspectorOverlayGeometry,
+): InspectorOverlayScale {
+	const { horizontal, vertical } = getOverlayAxes(geometry)
+
+	return { x: horizontal.relativeScale, y: vertical.relativeScale }
+}
+
+export function toInspectorOverlayRect(
+	rect: InspectedElementRect,
+	geometry: InspectorOverlayGeometry,
+): InspectedElementRect {
+	const { horizontal, vertical } = getOverlayAxes(geometry)
+
+	return {
+		left:
+			(geometry.iframeRect.left - geometry.containerRect.left) / horizontal.containerScale +
+			rect.left * horizontal.relativeScale,
+		top:
+			(geometry.iframeRect.top - geometry.containerRect.top) / vertical.containerScale +
+			rect.top * vertical.relativeScale,
+		width: rect.width * horizontal.relativeScale,
+		height: rect.height * vertical.relativeScale,
+	}
+}
```

**File**: `frontend/magic-web/src/pages/superMagic/components/Detail/components/SelfMediaRootRender/hooks/useSelfMediaInspector.ts` (modified, +8/-2)
```diff
@@ -34,7 +34,9 @@ export interface UseSelfMediaInspectorOptions {
 	 * Resolves file info for the iframe that was selected, used to generate
 	 * an @file mention in the appended prompt content.
 	 */
-	getFileInfoForIframe?: (iframe: HTMLIFrameElement) => { fileId: string; fileName: string; filePath: string } | undefined
+	getFileInfoForIframe?: (
+		iframe: HTMLIFrameElement,
+	) => { fileId: string; fileName: string; filePath: string } | undefined
 }
 
 export interface UseSelfMediaInspectorReturn {
@@ -237,7 +239,11 @@ export function useSelfMediaInspector({
 
 		const iframe = activeIframeRef.current
 		const fileInfo = iframe ? getFileInfoRef.current?.(iframe) : undefined
-		const content = buildAgentPromptContent(selectedElement, t, fileInfo)
+		const content = buildAgentPromptContent(
+			selectedElement,
+			t("stylePanel.inspector.agentPromptTitle"),
+			fileInfo,
+		)
 		setSelectedElement(null)
 
 		// Append to current editor without replacing existing content
```

**File**: `frontend/magic-web/src/pages/superMagic/components/Detail/contents/HTML/hooks/useInspectorToolbarMode.ts` (modified, +10/-2)
```diff
@@ -44,13 +44,21 @@ export function useInspectorToolbarMode(
 
 		if (currentMode === "appendToEditor") {
 			// Append inspector-detail rich node to the current editor
-			const content = buildAgentPromptContent(elementInspector.selectedElement, t, fileInfo)
+			const content = buildAgentPromptContent(
+				elementInspector.selectedElement,
+				t("stylePanel.inspector.agentPromptTitle"),
+				fileInfo,
+			)
 			pubsub.publish(PubSubEvents.Append_Suggestion_To_Editor, content)
 			return
 		}
 
 		// toolbar mode — create new topic with rich content
-		const content = buildAgentPromptContent(elementInspector.selectedElement, t, fileInfo)
+		const content = buildAgentPromptContent(
+			elementInspector.selectedElement,
+			t("stylePanel.inspector.agentPromptTitle"),
+			fileInfo,
+		)
 
 		// In crew/skill/MagiClaw scenarios there's no Create_New_Topic listener;
 		// fall back to setting the input message directly in the current editor.
```

**File**: `frontend/magic-web/src/pages/superMagic/components/MessageEditor/extensions/inspector-detail/__tests__/transform.test.ts` (modified, +2/-2)
```diff
@@ -69,7 +69,7 @@ function createInspectedElement(): InspectedElementInfo {
 
 describe("inspector-detail transform", () => {
 	it("stores the inspected file mention on the inspector node instead of a standalone paragraph", () => {
-		const content = buildAgentPromptContent(createInspectedElement(), (key) => key, {
+		const content = buildAgentPromptContent(createInspectedElement(), labels.title, {
 			fileId: "file-1",
 			fileName: "index.html",
 			filePath: "/index.html",
@@ -85,7 +85,7 @@ describe("inspector-detail transform", () => {
 	})
 
 	it("preserves resource and DOM context for AI source matching", () => {
-		const content = buildAgentPromptContent(createInspectedElement(), (key) => key)
+		const content = buildAgentPromptContent(createInspectedElement(), labels.title)
 		const attrs = content.content?.[0]?.content?.[0]?.attrs
 
 		expect(attrs?.resource).toBe("images/submit.png")
```

---

### Incident Patch 13: `9dc0b71a` (2026-08-11)
**Commit Message**: fix(video): resolve source type using business token type parameter

- Added AccessTokenType import to VideoOperationAppService
- Modified resolveSourceType method to accept requestBusinessParams parameter
- Updated method signature to include optional business parameters array
- Changed logic to use access token type from business params when entity is null
- Added test case to verify managed poll uses business token type for API platform source
- Added ImageGenerateSourceEnum import to test file
- Created test method to validate source type resolution with business token type

**File**: `backend/magic-service/app/Application/ModelGateway/Service/VideoOperationAppService.php` (modified, +10/-4)
```diff
@@ -20,6 +20,7 @@
 use App\Domain\ModelGateway\Entity\AccessTokenEntity;
 use App\Domain\ModelGateway\Entity\Dto\CreateVideoDTO;
 use App\Domain\ModelGateway\Entity\Dto\VideoOperationResponseDTO;
+use App\Domain\ModelGateway\Entity\ValueObject\AccessTokenType;
 use App\Domain\ModelGateway\Entity\ValueObject\ModelGatewayDataIsolation;
 use App\Domain\ModelGateway\Entity\ValueObject\VideoGenerationConfig;
 use App\Domain\ModelGateway\Entity\ValueObject\VideoMediaMetadata;
@@ -676,7 +677,7 @@ private function dispatchVideoGeneratedEvent(
         $event->setTopicId($operation->getTopicId());
         $event->setTaskId($operation->getTaskId());
         $event->setSourceId($operation->getSourceId());
-        $event->setSourceType($this->resolveSourceType($accessTokenEntity, $operation));
+        $event->setSourceType($this->resolveSourceType($accessTokenEntity, $operation, $requestBusinessParams));
         $event->setCreatedAt(new DateTime());
         $event->setVideoReferenceMaterial($referenceMaterial);
         $event->setBusinessParams($businessParams);
@@ -1153,9 +1154,14 @@ private function probeVideoFromFile(VideoQueueOperationEntity $operation, string
         }
     }
 
-    private function resolveSourceType(?AccessTokenEntity $accessTokenEntity, VideoQueueOperationEntity $operation): ImageGenerateSourceEnum
-    {
-        if ($accessTokenEntity?->getType()->isUser()) {
+    private function resolveSourceType(
+        ?AccessTokenEntity $accessTokenEntity,
+        VideoQueueOperationEntity $operation,
+        array $requestBusinessParams = []
+    ): ImageGenerateSourceEnum {
+        $accessTokenType = $accessTokenEntity?->getType()->value
+            ?? (string) ($requestBusinessParams['access_token_type'] ?? '');
+        if ($accessTokenType === AccessTokenType::User->value) {
             return ImageGenerateSourceEnum::API_PLATFORM;
         }
 
```

**File**: `backend/magic-service/test/Cases/Application/ModelGateway/Service/VideoOperationAppServiceTest.php` (modified, +38/-0)
```diff
@@ -18,6 +18,7 @@
 use App\Application\ModelGateway\Service\VideoOperationAppService;
 use App\Domain\File\Repository\Persistence\Facade\CloudFileRepositoryInterface;
 use App\Domain\File\Service\FileDomainService;
+use App\Domain\ImageGenerate\ValueObject\ImageGenerateSourceEnum;
 use App\Domain\ModelGateway\Contract\QueueOperationExecutorInterface;
 use App\Domain\ModelGateway\Contract\VideoMediaProbeInterface;
 use App\Domain\ModelGateway\Entity\AccessTokenEntity;
@@ -2088,6 +2089,43 @@ public function testManagedPollKeepsOperationRunningWhenProviderQueryThrows(): v
         }
     }
 
+    public function testManagedPollUsesBusinessTokenTypeForApiPlatformSource(): void
+    {
+        $operation = $this->createOperation('op-managed-api-platform-source');
+        $operation->setStatus(VideoOperationStatus::PROVIDER_RUNNING);
+        $operation->setProviderTaskId('provider-task-api-platform-source');
+        $operation->setStartedAt(date(DATE_ATOM));
+
+        $operationRepository = new InMemoryVideoQueueOperationRepository();
+        $operationRepository->operations[$operation->getId()] = $operation;
+        $service = $this->createVideoOperationAppService(
+            $operationRepository,
+            new RecordingQueueOperationExecutor(
+                submitResult: 'unused',
+                queryResult: [
+                    'status' => 'succeeded',
+                    'output' => [
+                        'video_url' => 'https://example.com/api-platform-source.mp4',
+                    ],
+                ],
+            ),
+        );
+
+        $isDone = $service->pollOperationById($operation->getId(), [
+            'organization_id' => 'org-test',
+            'access_token_type' => AccessTokenType::User->value,
+        ]);
+
+        $this->assertTrue($isDone);
+        $videoGeneratedEvents = array_values(array_filter(
+            $this->eventDispatcher->events,
+            static fn (object $event): bool => $event instanceof VideoGeneratedEvent
+        ));
+        $this->assertCount(1, $videoGeneratedEvents);
+        $event = $videoGeneratedEvents[0];
+        $this->assertSame(ImageGenerateSourceEnum::API_PLATFORM, $event->getSourceType());
+    }
+
     public function testGetOperationRejectsFullProviderTaskIdFallbackWhenStoredOperationIsMissing(): void
     {
         $dataIsolation = $this->createDataIsolation();
```

---

### Incident Patch 14: `0620ce48` (2026-08-11)
**Commit Message**: 🐛 fix(market): sticky headers and back-to-top controls

**File**: `frontend/magic-web/src/assets/locales/en_US/crew/market.json` (modified, +1/-0)
```diff
@@ -2,6 +2,7 @@
 	"aiSearch": "Search",
 	"aiSearchPlaceholder": "Enter keywords or describe your needs to get the digital employee you want",
 	"back": "Back",
+	"backToTop": "Back to top",
 	"categories": {
 		"adminOps": "Admin & Ops",
 		"allCrew": "All Crew",
```

**File**: `frontend/magic-web/src/assets/locales/zh_CN/crew/market.json` (modified, +1/-0)
```diff
@@ -2,6 +2,7 @@
 	"aiSearch": "搜索",
 	"aiSearchPlaceholder": "输入关键词或描述您的需求，获取所需的数字员工",
 	"back": "返回",
+	"backToTop": "回到顶部",
 	"categories": {
 		"adminOps": "行政运营",
 		"allCrew": "全部",
```

**File**: `frontend/magic-web/src/pages/superMagic/pages/CrewMarket/components/MarketBackToTopButton.tsx` (added, +60/-0)
```diff
@@ -0,0 +1,60 @@
+import { useEffect, useState, type RefObject } from "react"
+import { ArrowUp } from "lucide-react"
+import { useTranslation } from "react-i18next"
+import { Button } from "@/components/shadcn-ui/button"
+import { cn } from "@/lib/utils"
+
+const BACK_TO_TOP_SCROLL_THRESHOLD = 320
+
+interface MarketBackToTopButtonProps {
+	viewportRef: RefObject<HTMLDivElement | null>
+	testId: string
+}
+
+function MarketBackToTopButton({ viewportRef, testId }: MarketBackToTopButtonProps) {
+	const { t } = useTranslation("crew/market")
+	const [isVisible, setIsVisible] = useState(false)
+
+	useEffect(() => {
+		const viewport = viewportRef.current
+		if (!viewport) return
+
+		const updateVisibility = () => {
+			setIsVisible(viewport.scrollTop > BACK_TO_TOP_SCROLL_THRESHOLD)
+		}
+
+		updateVisibility()
+		viewport.addEventListener("scroll", updateVisibility, { passive: true })
+		return () => viewport.removeEventListener("scroll", updateVisibility)
+	}, [viewportRef])
+
+	function handleBackToTop() {
+		viewportRef.current?.scrollTo({ top: 0, behavior: "smooth" })
+	}
+
+	const label = t("backToTop")
+
+	return (
+		<Button
+			type="button"
+			size="icon"
+			className={cn(
+				"absolute bottom-6 right-6 z-[60] size-11 rounded-full shadow-lg",
+				"transition-[opacity,transform] duration-150 ease-out active:scale-[0.96]",
+				isVisible
+					? "translate-y-0 opacity-100"
+					: "pointer-events-none translate-y-2 opacity-0",
+			)}
+			aria-label={label}
+			aria-hidden={!isVisible}
+			tabIndex={isVisible ? 0 : -1}
+			title={label}
+			data-testid={testId}
+			onClick={handleBackToTop}
+		>
+			<ArrowUp className="size-5" aria-hidden />
+		</Button>
+	)
+}
+
+export default MarketBackToTopButton
```

**File**: `frontend/magic-web/src/pages/superMagic/pages/CrewMarket/components/MarketStickyHeader.tsx` (added, +43/-0)
```diff
@@ -0,0 +1,43 @@
+import { useEffect, useRef, useState, type HTMLAttributes, type RefObject } from "react"
+import { cn } from "@/lib/utils"
+
+interface MarketStickyHeaderProps extends HTMLAttributes<HTMLDivElement> {
+	scrollViewportRef?: RefObject<HTMLDivElement | null>
+}
+
+function MarketStickyHeader({ className, scrollViewportRef, ...props }: MarketStickyHeaderProps) {
+	const headerRef = useRef<HTMLDivElement>(null)
+	const [isStuck, setIsStuck] = useState(false)
+
+	useEffect(() => {
+		const viewport = scrollViewportRef?.current
+		const header = headerRef.current
+		if (!viewport || !header) return
+
+		const updateStickyState = () => {
+			const viewportTop = viewport.getBoundingClientRect().top
+			const headerTop = header.getBoundingClientRect().top
+			setIsStuck(viewport.scrollTop > 0 && headerTop <= viewportTop + 1)
+		}
+
+		updateStickyState()
+		viewport.addEventListener("scroll", updateStickyState, { passive: true })
+		return () => viewport.removeEventListener("scroll", updateStickyState)
+	}, [scrollViewportRef])
+
+	return (
+		<div
+			ref={headerRef}
+			className={cn(
+				"sticky top-0 z-50 flex min-w-0 flex-col bg-background",
+				"after:pointer-events-none after:absolute after:inset-x-0 after:-bottom-8 after:h-8 after:transition-opacity after:duration-150",
+				"after:bg-gradient-to-b after:from-background after:via-background/90 after:to-transparent",
+				isStuck ? "after:opacity-100" : "after:opacity-0",
+				className,
+			)}
+			{...props}
+		/>
+	)
+}
+
+export default MarketStickyHeader
```

**File**: `frontend/magic-web/src/pages/superMagic/pages/CrewMarket/components/__tests__/MarketBackToTopButton.test.tsx` (added, +38/-0)
```diff
@@ -0,0 +1,38 @@
+import { fireEvent, render, screen } from "@testing-library/react"
+import { describe, expect, it, vi } from "vitest"
+import MarketBackToTopButton from "../MarketBackToTopButton"
+
+vi.mock("react-i18next", () => ({
+	useTranslation: () => ({
+		t: (key: string) => (key === "backToTop" ? "Back to top" : key),
+	}),
+}))
+
+describe("MarketBackToTopButton", () => {
+	it("shows after the scroll threshold and scrolls the viewport to the top", () => {
+		const viewport = document.createElement("div")
+		const scrollTo = vi.fn()
+		viewport.scrollTo = scrollTo
+
+		render(
+			<MarketBackToTopButton
+				viewportRef={{ current: viewport }}
+				testId="market-back-to-top"
+			/>,
+		)
+
+		const button = screen.getByTestId("market-back-to-top")
+		expect(button).toHaveClass("pointer-events-none", "opacity-0")
+		expect(button).toHaveAttribute("aria-hidden", "true")
+
+		viewport.scrollTop = 321
+		fireEvent.scroll(viewport)
+
+		expect(button).toHaveClass("translate-y-0", "opacity-100")
+		expect(button).toHaveAttribute("aria-hidden", "false")
+
+		fireEvent.click(button)
+
+		expect(scrollTo).toHaveBeenCalledWith({ top: 0, behavior: "smooth" })
+	})
+})
```

**File**: `frontend/magic-web/src/pages/superMagic/pages/CrewMarket/components/__tests__/MarketStickyHeader.test.tsx` (added, +34/-0)
```diff
@@ -0,0 +1,34 @@
+import { fireEvent, render, screen } from "@testing-library/react"
+import { describe, expect, it, vi } from "vitest"
+import MarketStickyHeader from "../MarketStickyHeader"
+
+describe("MarketStickyHeader", () => {
+	it("shows the bottom gradient only while the header is stuck", () => {
+		const viewport = document.createElement("div")
+
+		render(
+			<MarketStickyHeader
+				scrollViewportRef={{ current: viewport }}
+				data-testid="market-sticky-header"
+			>
+				Search
+			</MarketStickyHeader>,
+		)
+
+		const header = screen.getByTestId("market-sticky-header")
+		expect(header).toHaveClass("after:opacity-0")
+
+		vi.spyOn(viewport, "getBoundingClientRect").mockReturnValue({ top: 120 } as DOMRect)
+		vi.spyOn(header, "getBoundingClientRect").mockReturnValue({ top: 120 } as DOMRect)
+
+		viewport.scrollTop = 200
+		fireEvent.scroll(viewport)
+
+		expect(header).toHaveClass("after:opacity-100")
+
+		viewport.scrollTop = 0
+		fireEvent.scroll(viewport)
+
+		expect(header).toHaveClass("after:opacity-0")
+	})
+})
```

**File**: `frontend/magic-web/src/pages/superMagic/pages/CrewMarket/employee-market/EmployeeMarketDesktop.tsx` (modified, +95/-86)
```diff
@@ -20,6 +20,7 @@ import {
 	WorkspaceStateCache,
 } from "@/pages/superMagic/utils/superMagicCache"
 import SearchBar from "@/pages/superMagic/pages/CrewMarket/components/SearchBar"
+import MarketStickyHeader from "@/pages/superMagic/pages/CrewMarket/components/MarketStickyHeader"
 import {
 	resolveActiveMarketFilterId,
 	resolveMarketFilterParams,
@@ -247,7 +248,7 @@ function EmployeeMarketDesktop({ scrollViewportRef }: EmployeeMarketDesktopProps
 				}
 			/>
 			{dialog}
-			<div className="mt-5 flex min-w-0 flex-col gap-5 sm:mt-6 sm:gap-6">
+			<div className="flex min-w-0 flex-col pt-5 sm:pt-6">
 				<div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
 					<div className="flex min-w-0 flex-1 flex-col gap-2">
 						<h1 className="break-words bg-gradient-to-br from-foreground via-foreground/90 to-muted-foreground bg-clip-text text-2xl font-bold leading-tight text-transparent sm:text-3xl lg:text-4xl">
@@ -285,97 +286,105 @@ function EmployeeMarketDesktop({ scrollViewportRef }: EmployeeMarketDesktopProps
 					</div>
 				</div>
 
-				<SearchBar
-					value={searchQuery}
-					onChange={setSearchQuery}
-					onSearch={handleSearch}
-					onCompositionStart={onSearchCompositionStart}
-					onCompositionEnd={onSearchCompositionEnd}
-					placeholder={t("aiSearchPlaceholder")}
-					enableSearchSubmit
-					data-testid="crew-market-desktop-search-bar"
-				/>
+				<MarketStickyHeader
+					className="gap-5 pb-5 pt-5 sm:gap-6 sm:pb-6 sm:pt-6"
+					scrollViewportRef={scrollViewportRef}
+					data-testid="crew-market-sticky-header"
+				>
+					<SearchBar
+						value={searchQuery}
+						onChange={setSearchQuery}
+						onSearch={handleSearch}
+						onCompositionStart={onSearchCompositionStart}
+						onCompositionEnd={onSearchCompositionEnd}
+						placeholder={t("aiSearchPlaceholder")}
+						enableSearchSubmit
+						data-testid="crew-market-desktop-search-bar"
+					/>
 
-				<CategoryFilter
-					categories={store.categories}
-					activeCategoryId={activeFilterId}
-					onCategoryChange={handleCategoryChange}
-					showOrganizationShared={!isPersonalOrganization}
-				/>
+					<CategoryFilter
+						categories={store.categories}
+						activeCategoryId={activeFilterId}
+						onCategoryChange={handleCategoryChange}
+						showOrganizationShared={!isPersonalOrganization}
+					/>
+				</MarketStickyHeader>
 
-				{store.loading ? (
-					<div
-						className="flex items-center justify-center py-16"
-						data-testid="crew-market-loading"
-					>
-						<Loader2 className="size-6 animate-spin text-muted-foreground" />
-					</div>
-				) : null}
+				<div className="flex min-w-0 flex-col gap-5 sm:gap-6">
+					{store.loading ? (
+						<div
+							className="flex items-center justify-center py-16"
+							data-testid="crew-market-loading"
+						>
+							<Loader2 className="size-6 animate-spin text-muted-foreground" />
+						</div>
+					) : null}
 
-				{store.isEmpty ? (
-					<div
-						className="flex flex-col items-center justify-center py-16 text-center"
-						data-testid="crew-market-empty"
-					>
-						<p className="text-sm text-muted-foreground">
-							{store.keyword ? t("noResults") : t("noMoreData")}
-						</p>
-					</div>
-				) : null}
+					{store.isEmpty ? (
+						<div
+							className="flex flex-col items-center justify-center py-16 text-center"
+							data-testid="crew-market-empty"
+						>
+							<p className="text-sm text-muted-foreground">
+								{store.keyword ? t("noResults") : t("noMoreData")}
+							</p>
+						</div>
+					) : null}
 
-				{!store.loading && store.list.length > 0 ? (
-					<div
-						className="grid grid-cols-1 items-stretch gap-3 sm:grid-cols-2 lg:grid-cols-4 [&>*]:min-h-0"
-						data-testid="employee-card-grid"
-					>
-						{store.list.map((employee) => (
-							<EmployeeCard
-								key={employee.id}
-								employee={employee}
-								actionPending={store.isAgentActionPending(employee.id)}
-								onHire={handleHire}
-								onDismiss={handleDismiss}
-								onDetails={handleDetails}
-								onOpenMarketDetail={handleOpenMarketDetail}
-							/>
-						))}
-					</div>
-				) : null}
+					{!store.loading && store.list.length > 0 ? (
+						<div
+							className="grid grid-cols-1 items-stretch gap-3 sm:grid-cols-2 lg:grid-cols-4 [&>*]:min-h-0"
+							data-testid="employee-card-grid"
+						>
+							{store.list.map((employee) => (
+								<EmployeeCard
+									key={employee.id}
+									employee={employee}
+									actionPending={store.isAgentActionPending(employee.id)}
+									onHire={handleHire}
+									onDismiss={handleDismiss}
+									onDetails={handleDetails}
+									onOpenMarketDetail={handleOpenMarketDetail}
+								/>
+							))}
+						</div>
+					) : null}
 
-				{!store.loading && store.list.length > 0 ? (
-					<div
-						ref={loadMoreSentinelRef}
-						className="h-1 w-full"
-						data-testid="crew-market-scroll-sentinel"
-					/>
-				) : null}
+					{!store
```

**File**: `frontend/magic-web/src/pages/superMagic/pages/CrewMarket/index.desktop.tsx` (modified, +6/-1)
```diff
@@ -1,13 +1,14 @@
 import { useRef } from "react"
 import { ScrollArea } from "@/components/shadcn-ui/scroll-area"
 import EmployeeMarketDesktop from "./employee-market/EmployeeMarketDesktop"
+import MarketBackToTopButton from "./components/MarketBackToTopButton"
 
 function CrewMarketPage() {
 	const scrollViewportRef = useRef<HTMLDivElement | null>(null)
 
 	return (
 		<div
-			className="flex h-full min-h-0 w-full min-w-0 flex-col overflow-hidden rounded-xl border border-border bg-background shadow-xs"
+			className="relative flex h-full min-h-0 w-full min-w-0 flex-col overflow-hidden rounded-xl border border-border bg-background shadow-xs"
 			data-testid="crew-market-page"
 		>
 			<ScrollArea
@@ -20,6 +21,10 @@ function CrewMarketPage() {
 					</div>
 				</div>
 			</ScrollArea>
+			<MarketBackToTopButton
+				viewportRef={scrollViewportRef}
+				testId="crew-market-back-to-top"
+			/>
 		</div>
 	)
 }
```

---

### Incident Patch 15: `cfe7cf87` (2026-08-11)
**Commit Message**: fix(cloudfile): support inline content disposition for signed URLs

**File**: `backend/cloudfile/src/Kernel/Driver/S3/S3Expand.php` (modified, +2/-2)
```diff
@@ -294,7 +294,7 @@ private function getUploadCredentialBySts(CredentialPolicy $credentialPolicy, ar
                             's3:DeleteObject',
                             's3:DeleteObjectVersion',
                         ],
-                        'Resource' => $resource,
+                        'Resource' => $objectResource,
                     ],
                 ],
             ],
@@ -310,7 +310,7 @@ private function getUploadCredentialBySts(CredentialPolicy $credentialPolicy, ar
                             's3:ListMultipartUploadParts',
                             's3:GetObjectVersion',
                         ],
-                        'Resource' => $resource,
+                        'Resource' => $objectResource,
                     ],
                 ],
             ],
```

**File**: `backend/cloudfile/src/Kernel/FilesystemProxy.php` (modified, +9/-9)
```diff
@@ -405,7 +405,7 @@ public function createObjectByCredential(CredentialPolicy $credentialPolicy, str
      *
      * @param CredentialPolicy $credentialPolicy 凭证策略
      * @param string $objectKey 对象键
-     * @param array $options 额外选项 (method, expires, filename等)
+     * @param array $options 额外选项 (method, expires, filename, download等)，download 默认为 true
      * @return string 预签名URL
      */
     public function getPreSignedUrlByCredential(CredentialPolicy $credentialPolicy, string $objectKey, array $options = []): string
@@ -491,14 +491,6 @@ public function getOptions(): array
         return $this->options;
     }
 
-    /**
-     * 合并存储默认 options 与本次调用 options.
-     */
-    private function mergeOptions(array $options = []): array
-    {
-        return array_replace($this->options, $options);
-    }
-
     protected function initSimpleUpload(): void
     {
         foreach ($this->simpleUploadsMap as $platform => $simpleUploadClass) {
@@ -535,6 +527,14 @@ protected function getSimpleUploadInstance(string $platform): SimpleUpload
         return $this->simpleUploadInstances[$platform];
     }
 
+    /**
+     * 合并存储默认 options 与本次调用 options.
+     */
+    private function mergeOptions(array $options = []): array
+    {
+        return array_replace($this->options, $options);
+    }
+
     /**
      * Get image processor for file service based on platform.
      */
```

**File**: `backend/cloudfile/src/Kernel/Utils/SimpleUpload.php` (modified, +19/-5)
```diff
@@ -75,12 +75,12 @@ abstract public function getHeadObjectByCredential(array $credential, string $ob
     abstract public function createObjectByCredential(array $credential, string $objectKey, array $options = []): void;
 
     /**
-     * Generate pre-signed URL by credential.
+     * 使用临时凭证生成预签名 URL.
      *
-     * @param array $credential Credential information
-     * @param string $objectKey Object key to generate URL for
-     * @param array $options Additional options (method, expires, filename, etc.)
-     * @return string Pre-signed URL
+     * @param array $credential 临时凭证信息
+     * @param string $objectKey 对象键
+     * @param array $options 额外选项，包括 method、expires、filename、download 等
+     * @return string 预签名 URL
      */
     abstract public function getPreSignedUrlByCredential(array $credential, string $objectKey, array $options = []): string;
 
@@ -118,4 +118,18 @@ public function uploadObjectByChunks(array $credential, ChunkUploadFile $chunkUp
             'Chunk upload not implemented for ' . static::class
         );
     }
+
+    /**
+     * 构建预签名下载链接的响应内容处置方式.
+     *
+     * @param string $filename 响应文件名
+     * @param bool $download 是否以附件形式下载，默认为 true 以保持原有行为
+     */
+    protected function buildContentDisposition(string $filename, bool $download = true): string
+    {
+        $disposition = $download ? 'attachment' : 'inline';
+        $safeFilename = str_replace(["\r", "\n"], '', $filename);
+
+        return $disposition . '; filename="' . addcslashes($safeFilename, '\"') . '"';
+    }
 }
```

**File**: `backend/cloudfile/src/Kernel/Utils/SimpleUpload/AliyunSimpleUpload.php` (modified, +4/-3)
```diff
@@ -676,11 +676,12 @@ public function getPreSignedUrlByCredential(array $credential, string $objectKey
                 unset($signedUrlOptions['response-content-type']);
             }
 
-            // Set response headers if specified
+            // 设置响应文件名和内容处置方式，默认保持附件下载行为
             if (isset($options['filename'])) {
-                $filename = $options['filename'];
+                $filename = (string) $options['filename'];
+                $download = (bool) ($options['download'] ?? true);
                 $signedUrlOptions['response-content-disposition']
-                    = 'attachment; filename="' . addslashes($filename) . '"';
+                    = $this->buildContentDisposition($filename, $download);
             }
 
             // Handle image processing parameters (only for GET method)
```

**File**: `backend/cloudfile/src/Kernel/Utils/SimpleUpload/FileServiceSimpleUpload.php` (modified, +3/-4)
```diff
@@ -136,13 +136,12 @@ public function createObjectByCredential(array $credential, string $objectKey, a
     }
 
     /**
-     * Generate pre-signed URL by credential
-     * 将请求转发给具体的平台实现.
+     * 使用临时凭证生成预签名 URL，并转发给具体的平台实现.
      *
      * @param array $credential 凭证信息
      * @param string $objectKey 对象键
-     * @param array $options 额外选项 (method, expires, filename, etc.)
-     * @return string Pre-signed URL
+     * @param array $options 额外选项，包括 method、expires、filename、download 等
+     * @return string 预签名 URL
      * @throws CloudFileException
      */
     public function getPreSignedUrlByCredential(array $credential, string $objectKey, array $options = []): string
```

**File**: `backend/cloudfile/src/Kernel/Utils/SimpleUpload/S3SimpleUpload.php` (modified, +6/-10)
```diff
@@ -320,20 +320,16 @@ public function getPreSignedUrlByCredential(array $credential, string $objectKey
             $commandParams['ResponseContentType'] = $options['content_type'];
         }
 
-        // Map response-content-disposition to ResponseContentDisposition
+        // 映射自定义响应内容处置参数
         if (isset($options['custom_query']['response-content-disposition'])) {
             $commandParams['ResponseContentDisposition'] = $options['custom_query']['response-content-disposition'];
         }
 
-        // Handle filename for Content-Disposition if provided
-        if (isset($options['filename']) && ! isset($commandParams['ResponseContentDisposition'])) {
-            $filename = $options['filename'];
-            $disposition = $options['custom_query']['response-content-disposition'] ?? 'attachment';
-            if ($disposition === 'inline') {
-                $commandParams['ResponseContentDisposition'] = 'inline; filename="' . addslashes($filename) . '"';
-            } else {
-                $commandParams['ResponseContentDisposition'] = 'attachment; filename="' . addslashes($filename) . '"';
-            }
+        // filename 是统一入口，显式覆盖底层自定义参数以保证三种存储行为一致
+        if (isset($options['filename'])) {
+            $filename = (string) $options['filename'];
+            $download = (bool) ($options['download'] ?? true);
+            $commandParams['ResponseContentDisposition'] = $this->buildContentDisposition($filename, $download);
         }
 
         $command = $client->getCommand($s3Operation, $commandParams);
```

**File**: `backend/cloudfile/src/Kernel/Utils/SimpleUpload/TosSimpleUpload.php` (modified, +7/-6)
```diff
@@ -872,12 +872,6 @@ public function getPreSignedUrlByCredential(array $credential, string $objectKey
             // Prepare headers array
             $headers = [];
 
-            // Set response headers if specified
-            if (isset($options['filename'])) {
-                $filename = $options['filename'];
-                $headers['response-content-disposition'] = 'attachment; filename="' . addslashes($filename) . '"';
-            }
-
             if (isset($options['content_type'])) {
                 $headers['response-content-type'] = $options['content_type'];
             }
@@ -901,6 +895,13 @@ public function getPreSignedUrlByCredential(array $credential, string $objectKey
                 $query = $options['custom_query'];
             }
 
+            // TOS 的响应内容处置参数必须作为查询参数参与预签名
+            if (isset($options['filename'])) {
+                $filename = (string) $options['filename'];
+                $download = (bool) ($options['download'] ?? true);
+                $query['response-content-disposition'] = $this->buildContentDisposition($filename, $download);
+            }
+
             // Handle image processing parameters (only for GET method)
             $method = strtoupper($options['method'] ?? 'GET');
             if ($method === 'GET' && isset($options['image']) && EasyFileTools::isImage($objectKey)) {
```

**File**: `backend/cloudfile/tests/CloudFileBaseTest.php` (modified, +13/-0)
```diff
@@ -61,6 +61,19 @@ protected function getFilesystem(): FilesystemProxy
         }
     }
 
+    /**
+     * 验证预签名 URL 中的响应内容处置参数.
+     */
+    protected function assertContentDisposition(string $url, string $expected): void
+    {
+        $queryString = parse_url($url, PHP_URL_QUERY);
+        $this->assertIsString($queryString);
+
+        parse_str($queryString, $query);
+        $this->assertArrayHasKey('response-content-disposition', $query);
+        $this->assertSame($expected, $query['response-content-disposition']);
+    }
+
     /**
      * Get the storage configuration name for this test class.
      * Must be implemented by subclasses.
```

#### Recent Merged Pull Requests:
- **PR #81** (closed): docs: localize Chinese README badge alt text (@MackDing)
- **PR #79** (closed): docs: add FAQ section for common questions (@meichuanyi)
- **PR #54** (2025-08-14): Simplify BUG template (@douyun-dtyq)
- **PR #33** (2025-05-30): docs: Guide users to configure LLMs via environment variables (@her-cat)
- **PR #27** (2025-05-25): docs(zh): fix document formatting and typography (@her-cat)
- **PR #22** (2025-05-20): fix: remove Access-Control-Allow-Credentials header for CORS security compliance (@JeaNile)
- **PR #21** (2025-05-19): Fix env typo (@assert6)
- **PR #19** (2025-05-19): Fix uploadFiles typo (@assert6)

---

## 3. Empirical Evidence & Compliance Certification
- **Evidence Provenance**: Fetched directly from verified official GitHub REST API.
- **Zero Disk Footprint**: 0 bytes of unnecessary repository bloat stored locally.
- **TOS & Free-Tier Adherence**: Request pace complied with public API guidelines without fee, penalty, or unauthorized scraping.

---

## 4. Promotion & Integration Status
- **Status**: HARVESTED_DEEP_FORENSIC
- **Master Brain Sync**: Auto-committed to local/remote Master Brain repository.
