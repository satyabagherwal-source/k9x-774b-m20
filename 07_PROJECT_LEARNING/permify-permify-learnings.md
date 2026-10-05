# Forensic Learning Record (Deep Inspection): Permify/permify

> **Canonical Artifact**: `07_PROJECT_LEARNING/permify-permify-learnings.md`  
> **Source Platform**: GitHub ([https://github.com/Permify/permify](https://github.com/Permify/permify))  
> **Harvest Method**: Full-Spectrum Deep Extraction (Patches, Diffs, Source Code, Post-Mortems)  
> **Harvest Timestamp**: 2026-10-05T19:20:57.967Z  
> **Compliance State**: Free Tier Guaranteed | Strict Rate-Limit Backoff Honored  

---

## 1. Context & Architectural Overview
- **Repository / Resource**: `Permify/permify`
- **Description**: An open-source authorization as a service inspired by Google Zanzibar, designed to build and manage fine-grained and scalable authorization systems for any application. — Permify is now part of FusionAuth 🎉
- **Primary Language / Ecosystem**: Go
- **Discovered Manifests / Configurations**: go.mod, README.md, Dockerfile
- **Stars / Engagement**: 5961 stars

---

## 2. Multi-Dimensional 8-Axis Investigation & Real Code Patches

### D1: Architecture & Structural Boundaries
- Entry configurations inspected via direct stream: go.mod, README.md, Dockerfile.
- Evaluated system abstractions and modular contracts.

### Core Architecture Module: `internal/engines/balancer/balancer.go`
```
package balancer

import (
	"context"
	"fmt"
	"log/slog"
	"time"

	"google.golang.org/grpc"
	"google.golang.org/grpc/credentials"
	"google.golang.org/grpc/credentials/insecure"

	"github.com/Permify/permify/internal/config"
	"github.com/Permify/permify/internal/engines"
	"github.com/Permify/permify/internal/invoke"
	"github.com/Permify/permify/internal/storage"
	"github.com/Permify/permify/pkg/balancer"
	base "github.com/Permify/permify/pkg/pb/base/v1"
)

// Balancer is a wrapper around the balancer hash implementation that
type Balancer struct {
	schemaReader storage.SchemaReader
	checker      invoke.Check
	client       base.PermissionClient
}

// NewCheckEngineWithBalancer creates a new check engine with a load balancer.
// It takes a Check interface, SchemaReader, distributed config, gRPC config, and authn config as input.
// It returns a Check interface and an error if any.
func NewCheckEngineWithBalancer(
	ctx context.Context,
	checker invoke.Check,
	schemaReader storage.SchemaReader,
	no string,
	dst *config.Distributed,
	srv *config.GRPC,
	authn *config.Authn,
) (invoke.Check, error) {
	var (
		creds    credentials.TransportCredentials
		options  []grpc.DialOption
		isSecure bool
		err      error
	)

	// Set up TLS credentials if paths are provided
	if srv.TLSConfig.Enabled && srv.TLSConfig.CertPath != "" {
		isSecure = true
		creds, err = credentials.NewClientTLSFromFile(srv.TLSConfig.CertPath, no)
		if err != nil {
			return nil, fmt.Errorf("could not load TLS certificate: %w", err)
		}
	} else {
		creds = insecure.NewCredentials()
	}

	bc := &balancer.Config{
		PartitionCount:    dst.PartitionCount,
		ReplicationFactor: dst.ReplicationFactor,
		Load:              dst.Load,
		PickerWidth:       dst.PickerWidth,
	}

	bcjson, err := bc.ServiceConfigJSON()
	if err != nil {
		return nil, err
	}

	// Append common options
	options = append(
		options,
		grpc.WithDefaultServiceConfig(bcjson),
		grpc.WithTransportCredentials(creds),
	)

	// Handle authentication if enabled
	if authn != nil && authn.Enabled {
		token, err := setupAuthn(ctx, authn)
		if err != nil {
			return nil, err
		}
		if isSecure {
			options = append(options, grpc.WithPerRPCCredentials(secureTokenCredentials{"authorization": "Bearer " + token}))
		} else {
			options = append(options, grpc.WithPerRPCCredentials(nonSecureTokenCredentials{"authorization": "Bearer " + token}))
		}
	}

	conn, err := grpc.NewClient(dst.Address, options...)
	if err != nil {
		return nil, err
	}

	return &Balancer{
		schemaReader: schemaReader,
		checker:      checker,
		client:       base.NewPermissionClient(conn),
	}, nil
}

// Check performs a permission check using the schema reader to obtain
// entity definitions, then distributes the request based on a generated key.
func (c *Balancer) Check(ctx context.Context, request *base.PermissionCheckRequest) (*base.PermissionCheckResponse, error) {
	// Fetch the EntityDefinition for the given tenant, entity type, and schema version.
	en, _, err := c.schemaReader.ReadEntityDefinition(ctx, request.GetTenantId(), request.GetEntity().GetType(), request.GetMetadata().GetSchemaVersion())
	if err != nil {
		slog.ErrorContext(ctx, err.Error())
		// If an error occurs while reading the entity definition, deny permission and return the error.
		return &base.PermissionCheckResponse{
			Can: base.CheckResult_CHECK_RESULT_DENIED,
			Metadata: &base.PermissionCheckResponseMetadata{
				CheckCount: 0,
			},
		}, err
	}

	isRelational := engines.IsRelational(en, request.GetPermission())

	// Add a timeout of 2 seconds to the context and also set the generated key as a value.
	withTimeout, cancel := context.WithTimeout(context.WithValue(ctx, balancer.Key, []byte(engines.GenerateKey(request, isRelational))), 4*time.Second)
	defer cancel()

	// Logging the intention to forward the request to the underlying client.
	slog.InfoContext(ctx, "Forwarding request with key to the underlying client")

	// Perform the actual permission check by making a call to the underlying client.
	response, err := c.client.Check(withTimeout, request)
	if err != nil {
		// Log the error and return it.
		slog.ErrorContext(ctx, err.Error())
		return &base.PermissionCheckResponse{
			Can: base.CheckResult_CHECK_RESULT_DENIED,
			Metadata: &base.PermissionCheckResponseMetadata{
				CheckCount: 0,
			},
		}, err
	}

	// Return the response received from the client.
	return response, nil
}

```

### Core Architecture Module: `internal/engines/balancer/utils.go`
```
package balancer

import (
	"context"
	"fmt"

	"github.com/Permify/permify/internal/config"
)

// secureTokenCredentials represents a map used for storing secure tokens.
// These tokens require transport security.
type secureTokenCredentials map[string]string

// RequireTransportSecurity indicates that transport security is required for these credentials.
func (c secureTokenCredentials) RequireTransportSecurity() bool {
	return true // Transport security is required for secure tokens.
}

// GetRequestMetadata retrieves the current metadata (secure tokens) for a request.
func (c secureTokenCredentials) GetRequestMetadata(context.Context, ...string) (map[string]string, error) {
	return c, nil // Returns the secure tokens as metadata with no error.
}

// nonSecureTokenCredentials represents a map used for storing non-secure tokens.
// These tokens do not require transport security.
type nonSecureTokenCredentials map[string]string

// RequireTransportSecurity indicates that transport security is not required for these credentials.
func (c nonSecureTokenCredentials) RequireTransportSecurity() bool {
	return false // Transport security is not required for non-secure tokens.
}

// GetRequestMetadata retrieves the current metadata (non-secure tokens) for a request.
func (c nonSecureTokenCredentials) GetRequestMetadata(_ context.Context, _ ...string) (map[string]string, error) {
	return c, nil // Returns the non-secure tokens as metadata with no error.
}

// setupAuthn configures the authentication token based on the provided authentication method.
// It returns the token string and an error if any.
func setupAuthn(_ context.Context, authn *config.Authn) (string, error) {
	var token string

	switch authn.Method {
	case "preshared":
		token = authn.Preshared.Keys[0]
	case "oidc":
		return "", fmt.Errorf("unsupported authentication method: '%s'", authn.Method)
	default:
		return "", fmt.Errorf("unknown authentication method: '%s'", authn.Method)
	}

	return token, nil
}

```

### Core Architecture Module: `internal/engines/bulk.go`
```
package engines

import (
	"context"
	"fmt"
	"sort"
	"sync"
	"sync/atomic"

	"github.com/pkg/errors"

	"golang.org/x/sync/errgroup"
	"golang.org/x/sync/semaphore"

	"github.com/Permify/permify/internal/invoke"
	"github.com/Permify/permify/internal/storage/memory/utils"
	base "github.com/Permify/permify/pkg/pb/base/v1"
)

// BulkCheckerType defines the type of bulk checking operation.
// This enum determines how requests are sorted and processed.
type BulkCheckerType string

const (
	// BulkCheckerTypeSubject indicates that requests should be sorted and processed by subject ID
	BulkCheckerTypeSubject BulkCheckerType = "subject"
	// BulkCheckerTypeEntity indicates that requests should be sorted and processed by entity ID
	BulkCheckerTypeEntity BulkCheckerType = "entity"
)

// BulkCheckerRequest represents a permission check request with optional pre-computed result.
// This struct encapsulates both the permission check request and an optional pre-determined result,
// allowing for optimization when results are already known (e.g., from caching).
type BulkCheckerRequest struct {
	// Request contains the actual permission check request
	Request *base.PermissionCheckRequest
	// Result holds a pre-computed result if available, otherwise CHECK_RESULT_UNSPECIFIED
	Result base.CheckResult
}

// BulkCheckerConfig holds configuration parameters for the BulkChecker.
// This struct allows for fine-tuning the behavior and performance characteristics
// of the bulk permission checking system.
type BulkCheckerConfig struct {
	// ConcurrencyLimit defines the maximum number of concurrent permission checks
	// that can be processed simultaneously. Higher values increase throughput
	// but may consume more system resources.
	ConcurrencyLimit int
	// BufferSize defines the size of the internal request buffer.
	// This should be set based on expected request volume to avoid blocking.
	BufferSize int
}

// DefaultBulkCheckerConfig returns a sensible default configuration
// that balances performance and resource usage for most use cases.
func DefaultBulkCheckerConfig() BulkCheckerConfig {
	return BulkCheckerConfig{
		ConcurrencyLimit: 10,   // Moderate concurrency for most workloads
		BufferSize:       1000, // Buffer for 1000 requests
	}
}

// BulkChecker handles concurrent permission checks with ordered result processing.
// This struct implements a high-performance bulk permission checking system that:
// - Collects permission check requests asynchronously
// - Processes them concurrently with controlled parallelism
// - Maintains strict ordering of results based on request sorting
// - Provides efficient resource management and error handling
type BulkChecker struct {
	// typ determines the sorting strategy and processing behavior
	typ BulkCheckerType
	// checker is the underlying permission checking engine
	checker invoke.Check
	// config holds the operational configuration
	config BulkCheckerConfig
	// ctx provides context for cancellation and timeout management
	ctx context.Context
	// cancel allows for graceful shutdown of all operations
	cancel context.CancelFunc

	// Request handling components
	// requestChan is the input channel for receiving permission check requests
	requestChan chan BulkCheckerRequest
	// requests stores all collected requests before processing
	requests []BulkCheckerRequest
	// requestsMu provides thread-safe access to the requests slice
	requestsMu sync.RWMutex

	// Execution state management
	// executionState tracks the progress and results of request processing
	executionState *executionState
	// collectionDone signals when request collection has completed
	collectionDone chan struct{}

	// Callback for processing results
	// callback is invoked for each successful permission check with the entity/subject ID and continuous token
	callback func(entityID, continuousToken string)
}

// executionState manages the execution of requests and maintains processing order.
// This struct ensures that results are processed in the correct sequence
// even when requests complete out of order due to concurrent processing.
type executionState struct {
	// mu protects access to the execution state
	mu sync.Mutex
	// results stores the results of all requests in their original order
	results []base.CheckResult
	// processedIndex tracks the next result to be processed in order
	processedIndex int
	// successCount tracks the number of successful permission checks
	successCount int64
	// limit defines the maximum number of successful results to process
	limit int64
}

// NewBulkChecker creates a new BulkChecker instance with comprehensive validation and error handling.
// This constructor ensures that all dependencies are properly initialized and validates
// configuration parameters to prevent runtime errors.
//
// Parameters:
//   - ctx: Context for managing the lifecycle of the BulkChecker
//   - checker: The permission checking engine to use for actual permission checks
//   - typ: The type of bulk checking operation (entity or subject)
//   - callback: Function called for each successful permission check
//   - config: Configuration parameters for tuning performance and behavior
//
// Returns:
//   - *BulkChecker: The initialized BulkChecker instance
//   - error: Any error that occurred during initialization
func NewBulkChecker(ctx context.Context, checker invoke.Check, typ BulkCheckerType, callback func(entityID, ct string), config BulkCheckerConfig) (*BulkChecker, error) {
	// Validate all required parameters
	if ctx == nil {
		return nil, fmt.Errorf("context cannot be nil")
	}
	if checker == nil {
		return nil, fmt.Errorf("checker cannot be nil")
	}
	if callback == nil {
		return nil, fmt.Errorf("callback cannot be nil")
	}

	// Apply default values for invalid configuration
	if config.ConcurrencyLimit <= 0 {
		config.ConcurrencyLimit = DefaultBulkCheckerConfig().ConcurrencyLimit
	}
	if config.BufferSize <= 0 {
		config.BufferSize = DefaultBulkCheckerConfig().BufferSize
	}

	// Create a cancellable context for the BulkChecker
	ctx, cancel := context.WithCancel(ctx)

	// Initialize the BulkChecker with all components
	bc := &BulkChecker{
		typ:            typ,
		checker:        checker,
		config:         config,
		ctx:            ctx,
		cancel:         cancel,
		requestChan:    make(chan BulkCheckerRequest, config.BufferSize),
		requests:       make([]BulkCheckerRequest, 0, config.BufferSize),
		callback:       callback,
		collectionDone: make(chan struct{}),
	}

	// Start the background request collection goroutine
	go bc.collectRequests()

	return bc, nil
}

// collectRequests safely collects requests until the channel is closed.
// This method runs in a separate goroutine and continuously processes
// incoming requests until either the channel is closed or the context is cancelled.
// It ensures thread-safe addition of requests to the internal collection.
func (bc *BulkChecker) collectRequests() {
	// Signal completion when this goroutine exits
	defer close(bc.collectionDone)

	for {
		select {
		case req, ok := <-bc.requestChan:
			if !ok {
				// Channel closed, stop collecting
				return
			}
			bc.addRequest(req)
		case <-bc.ctx.Done():
			// Context cancelled, stop collecting
			return
		}
	}
}

// addRequest safely adds a request to the internal list.
// This method uses a mutex to ensure thread-safe access to the requests slice,
// preventing race conditions when multiple goroutines are adding requests.
func (bc *BulkChecker) addRequest(req BulkCheckerRequest) {
	bc.requestsMu.Lock()
	defer bc.requestsMu.Unlock()
	bc.requests = append(bc.requests, req)
}

// StopCollectingRequests safely stops request collection and waits for completion.
// This method closes the input channel and waits for the collection goroutine
// to finish processing any remaining requests. This ensures that no requests
// are lost during shutdown.
func (bc *BulkChecker) StopCollectingRequests() {
	close(bc.requestChan)
	<-bc.collectionDone // Wait for collection to complete
}

// getSortedRequests returns a sorted copy of requests based on the checker type.
// This method creates a copy of the requests to avoid modifying the original
// collection and sorts them according to the BulkCheckerType (entity ID or subject ID).
// The sorting ensures consistent and predictable result ordering.
func (bc *BulkChecker) getSortedRequests() []BulkCheckerRequest {
	bc.requestsMu.RLock()
	defer bc.requestsMu.RUnlock()

	// Create a copy to avoid modifying the original
	requests := make([]BulkCheckerRequest, len(bc.requests))
	copy(requests, bc.requests)

	// Sort the copy based on the checker type
	bc.sortRequests(requests)
	return requests
}

// sortRequests sorts requests based on the checker type.
// This method implements different sorting strategies:
// - For entity-based checks: sorts by entity ID
// - For subject-based checks: sorts by subject ID
// The sorting ensures that results are processed in a consistent order.
func (bc *BulkChecker) sortRequests(requests []BulkCheckerRequest) {
	switch bc.typ {
	case BulkCheckerTypeEntity:
		sort.Slice(requests, func(i, j int) bool {
			return requests[i].Request.GetEntity().GetId() < requests[j].Request.GetEntity().GetId()
		})
	case BulkCheckerTypeSubject:
		sort.Slice(requests, func(i, j int) bool {
			return requests[i].Request.GetSubject().GetId() < requests[j].Request.GetSubject().GetId()
		})
	}
}

// ExecuteRequests processes requests concurrently with comprehensive error handling and resource management.
// This method is the main entry point for bulk permission checking. It:
// 1. Stops collecting new requests
// 2. Sorts all collected requests
// 3. Processes them concurrently with controlled parallelism
// 4. Maintains strict ordering of results
// 5. Handles errors gracefully and manages resources properly
//
// Parameters:
//   - size: The maximum number of successful results to process
//
// Returns:
//   - error: Any error that occurred during processing (context cancellation
```

### Core Architecture Module: `internal/engines/cache/check.go`
```
package cache

import (
	"context"
	"encoding/hex"

	"go.opentelemetry.io/otel/metric"

	"github.com/cespare/xxhash/v2"

	"github.com/Permify/permify/internal"
	"github.com/Permify/permify/internal/engines"
	"github.com/Permify/permify/internal/invoke"
	"github.com/Permify/permify/internal/storage"
	"github.com/Permify/permify/pkg/cache"
	base "github.com/Permify/permify/pkg/pb/base/v1"
	"github.com/Permify/permify/pkg/telemetry"
)

// CheckEngineWithCache is a struct that holds an instance of a cache.Cache for managing engine cache.
type CheckEngineWithCache struct {
	// schemaReader is responsible for reading schema information
	schemaReader storage.SchemaReader
	checker      invoke.Check
	cache        cache.Cache

	// Metrics
	cacheHitHistogram metric.Int64Histogram
}

// NewCheckEngineWithCache creates a new instance of EngineKeyManager by initializing an EngineKeys
// struct with the provided cache.Cache instance.
func NewCheckEngineWithCache(
	checker invoke.Check,
	schemaReader storage.SchemaReader,
	cache cache.Cache,
) invoke.Check {
	return &CheckEngineWithCache{
		schemaReader:      schemaReader,
		checker:           checker,
		cache:             cache,
		cacheHitHistogram: telemetry.NewHistogram(internal.Meter, "cache_hit", "amount", "Number of cache hits"),
	}
}

// Check performs a permission check for a given request, using the cached results if available.
func (c *CheckEngineWithCache) Check(ctx context.Context, request *base.PermissionCheckRequest) (response *base.PermissionCheckResponse, err error) {
	// Retrieve entity definition
	var en *base.EntityDefinition
	en, _, err = c.schemaReader.ReadEntityDefinition(ctx, request.GetTenantId(), request.GetEntity().GetType(), request.GetMetadata().GetSchemaVersion())
	if err != nil {
		return &base.PermissionCheckResponse{
			Can: base.CheckResult_CHECK_RESULT_DENIED,
			Metadata: &base.PermissionCheckResponseMetadata{
				CheckCount: 0,
			},
		}, err
	}

	isRelational := engines.IsRelational(en, request.GetPermission())

	// Try to get the cached result for the given request.
	res, found := c.getCheckKey(request, isRelational)

	// If a cached result is found, handle exclusion and return the result.
	if found {
		// Increase the hit count in the metrics.
		c.cacheHitHistogram.Record(ctx, 1)

		// If the request doesn't have the exclusion flag set, return the cached result.
		return &base.PermissionCheckResponse{
			Can:      res.GetCan(),
			Metadata: &base.PermissionCheckResponseMetadata{},
		}, nil
	}

	// Perform the actual permission check using the provided request.
	cres, err := c.checker.Check(ctx, request)
	// Check if there's an error or the response is nil, and return the result.
	if err != nil {
		return &base.PermissionCheckResponse{
			Can: base.CheckResult_CHECK_RESULT_DENIED,
			Metadata: &base.PermissionCheckResponseMetadata{
				CheckCount: 0,
			},
		}, err
	}

	// Add to histogram the response

	c.setCheckKey(request, &base.PermissionCheckResponse{
		Can:      cres.GetCan(),
		Metadata: &base.PermissionCheckResponseMetadata{},
	}, isRelational)
	// Return the result of the permission check.
	return cres, err
}

// GetCheckKey retrieves the value for the given key from the EngineKeys cache.
// It returns the PermissionCheckResponse if the key is found, and a boolean value
// indicating whether the key was found or not.
func (c *CheckEngineWithCache) getCheckKey(key *base.PermissionCheckRequest, isRelational bool) (*base.PermissionCheckResponse, bool) {
	if key == nil {
		// If either the key or value is nil, return false
		return nil, false
	}

	// Initialize a new xxhash object
	h := xxhash.New()

	// Write the checkKey string to the hash object
	_, err := h.Write([]byte(engines.GenerateKey(key, isRelational)))
	if err != nil {
		// If there's an error, return nil and false
		return nil, false
	}

	// Generate the final cache key by encoding the hash object's sum as a hexadecimal string
	k := hex.EncodeToString(h.Sum(nil))

	// Get the value from the cache using the generated cache key
	resp, found := c.cache.Get(k)

	// If the key is found, return the value and true
	if found {
		// If permission is granted, return allowed response
		return &base.PermissionCheckResponse{
			Can: resp.(base.CheckResult),
			Metadata: &base.PermissionCheckResponseMetadata{
				CheckCount: 0,
			},
		}, true
	}

	// If the key is not found, return nil and false
	return nil, false
}

// setCheckKey is a function to set a check key in the cache of the CheckEngineWithKeys.
// It takes a permission check request as a key, a permission check response as a value,
// and returns a boolean value indicating if the operation was successful.
func (c *CheckEngineWithCache) setCheckKey(key *base.PermissionCheckRequest, value *base.PermissionCheckResponse, isRelational bool) bool {
	// If either the key or the value is nil, return false.
	if key == nil || value == nil {
		return false
	}

	// Create a new xxhash object for hashing.
	h := xxhash.New()

	// Generate a key string from the permission check request and write it to the hash.
	// If there's an error while writing to the hash, return false.
	size, err := h.Write([]byte(engines.GenerateKey(key, isRelational)))
	if err != nil {
		return false
	}

	// Compute the hash sum and encode it as a hexadecimal string.
	k := hex.EncodeToString(h.Sum(nil))

	// Set the hashed key and the check result in the cache, using the size of the hashed key as an expiry.
	// The Set method should return true if the operation was successful, so return the result.
	return c.cache.Set(k, value.GetCan(), int64(size))
}

```

### Core Architecture Module: `internal/engines/check.go`
```
package engines

import (
	"context"
	"errors"
	"fmt"
	"sync"

	"github.com/google/cel-go/cel"

	"github.com/Permify/permify/internal/invoke"
	"github.com/Permify/permify/internal/schema"
	"github.com/Permify/permify/internal/storage"
	storageContext "github.com/Permify/permify/internal/storage/context"
	"github.com/Permify/permify/pkg/database"
	"github.com/Permify/permify/pkg/dsl/utils"
	base "github.com/Permify/permify/pkg/pb/base/v1"
	"github.com/Permify/permify/pkg/tuple"
)

// CheckEngine is a core component responsible for performing permission checks.
// It reads schema and relationship information, and uses the engine key manager
// to validate permission requests.
type CheckEngine struct {
	// delegate is responsible for performing permission checks
	invoker invoke.Check
	// schemaReader is responsible for reading schema information
	schemaReader storage.SchemaReader
	// relationshipReader is responsible for reading relationship information
	dataReader storage.DataReader
	// concurrencyLimit is the maximum number of concurrent permission checks allowed
	concurrencyLimit int
}

// NewCheckEngine creates a new CheckEngine instance for performing permission checks.
// It takes a key manager, schema reader, and relationship reader as parameters.
// Additionally, it allows for optional configuration through CheckOption function arguments.
func NewCheckEngine(sr storage.SchemaReader, rr storage.DataReader, opts ...CheckOption) *CheckEngine {
	// Initialize a CheckEngine with default concurrency limit and provided parameters
	engine := &CheckEngine{
		schemaReader:     sr,
		dataReader:       rr,
		concurrencyLimit: _defaultConcurrencyLimit,
	}

	// Apply provided options to configure the CheckEngine
	for _, opt := range opts {
		opt(engine)
	}

	return engine
}

// SetInvoker sets the delegate for the CheckEngine.
func (engine *CheckEngine) SetInvoker(invoker invoke.Check) {
	engine.invoker = invoker
}

// Check executes a permission check based on the provided request.
// The permission field in the request can either be a relation or an permission.
// This function performs various checks and returns the permission check response
// along with any errors that may have occurred.
func (engine *CheckEngine) Check(ctx context.Context, request *base.PermissionCheckRequest) (response *base.PermissionCheckResponse, err error) {
	emptyResp := denied(emptyResponseMetadata())

	// Retrieve entity definition
	var en *base.EntityDefinition
	en, _, err = engine.schemaReader.ReadEntityDefinition(ctx, request.GetTenantId(), request.GetEntity().GetType(), request.GetMetadata().GetSchemaVersion())
	if err != nil {
		return emptyResp, err
	}

	// Perform permission check
	var res *base.PermissionCheckResponse
	res, err = engine.check(ctx, request, en)(ctx)
	if err != nil {
		return emptyResp, err
	}

	return &base.PermissionCheckResponse{
		Can:      res.Can,
		Metadata: res.Metadata,
	}, nil
}

// CheckFunction is a type that represents a function that takes a context
// and returns a PermissionCheckResponse along with an error. It is used
// to perform individual permission checks within the CheckEngine.
type CheckFunction func(ctx context.Context) (*base.PermissionCheckResponse, error)

// CheckCombiner is a type that represents a function which takes a context,
// a slice of CheckFunctions, and a limit. It combines the results of
// multiple CheckFunctions according to a specific strategy and returns
// a PermissionCheckResponse along with an error.
type CheckCombiner func(ctx context.Context, functions []CheckFunction, limit int) (*base.PermissionCheckResponse, error)

// run is a helper function that takes a context and a PermissionCheckRequest,
// and returns a CheckFunction. The returned CheckFunction, when called with
// a context, executes the Run method of the CheckEngine with the given
// request, and returns the resulting PermissionCheckResponse and error.
func (engine *CheckEngine) invoke(request *base.PermissionCheckRequest) CheckFunction {
	return func(ctx context.Context) (*base.PermissionCheckResponse, error) {
		return engine.invoker.Check(ctx, request)
	}
}

// check constructs a CheckFunction that performs permission checks based on the type of reference in the entity definition.
func (engine *CheckEngine) check(
	ctx context.Context,
	request *base.PermissionCheckRequest,
	en *base.EntityDefinition,
) CheckFunction {
	// If the request's entity and permission are the same as the subject, return a CheckFunction that always allows the permission.
	if tuple.AreQueryAndSubjectEqual(request.GetEntity(), request.GetPermission(), request.GetSubject()) {
		return func(ctx context.Context) (*base.PermissionCheckResponse, error) {
			return allowed(emptyResponseMetadata()), nil
		}
	}

	// Declare a CheckFunction variable that will later be defined based on the type of reference.
	var fn CheckFunction

	// Determine the type of the reference by name in the given entity definition.
	tor, _ := schema.GetTypeOfReferenceByNameInEntityDefinition(en, request.GetPermission())

	// Based on the type of the reference, define the CheckFunction in different ways.
	switch tor {
	case base.EntityDefinition_REFERENCE_PERMISSION:
		// Get the permission from the entity definition.
		permission, err := schema.GetPermissionByNameInEntityDefinition(en, request.GetPermission())
		if err != nil {
			// If an error is encountered while getting the permission, a CheckFunction is returned that always fails with this error.
			return checkFail(err)
		}
		// Get the child of the permission.
		child := permission.GetChild()

		// If the child has a rewrite, check the rewrite.
		// If not, check the leaf.
		if child.GetRewrite() != nil {
			fn = engine.checkRewrite(ctx, request, child.GetRewrite())
		} else {
			fn = engine.checkLeaf(request, child.GetLeaf())
		}
	case base.EntityDefinition_REFERENCE_ATTRIBUTE:
		// If the reference is an attribute, check the direct attribute.
		fn = engine.checkDirectAttribute(request)
	case base.EntityDefinition_REFERENCE_RELATION:
		// If the reference is a relation, check the direct relation.
		fn = engine.checkDirectRelation(request)
	default:
		fn = engine.checkDirectCall(request)
	}

	// If the CheckFunction is still undefined after the switch, return a CheckFunction that always fails with an error indicating an undefined child kind.
	if fn == nil {
		return checkFail(errors.New(base.ErrorCode_ERROR_CODE_UNDEFINED_CHILD_KIND.String()))
	}

	// Otherwise, return a CheckFunction that checks a union of CheckFunctions with a concurrency limit.
	return func(ctx context.Context) (*base.PermissionCheckResponse, error) {
		return checkUnion(ctx, []CheckFunction{fn}, engine.concurrencyLimit)
	}
}

// checkRewrite prepares a CheckFunction according to the provided Rewrite operation.
// It uses a Rewrite object that describes how to combine the results of multiple CheckFunctions.
func (engine *CheckEngine) checkRewrite(ctx context.Context, request *base.PermissionCheckRequest, rewrite *base.Rewrite) CheckFunction {
	// Switch statement depending on the Rewrite operation
	switch rewrite.GetRewriteOperation() {
	// In case of UNION operation, set the children CheckFunctions to be run concurrently
	// and return the permission if any of the CheckFunctions succeeds (union).
	case *base.Rewrite_OPERATION_UNION.Enum():
		return engine.setChild(ctx, request, rewrite.GetChildren(), checkUnion)
	// In case of INTERSECTION operation, set the children CheckFunctions to be run concurrently
	// and return the permission if all the CheckFunctions succeed (intersection).
	case *base.Rewrite_OPERATION_INTERSECTION.Enum():
		return engine.setChild(ctx, request, rewrite.GetChildren(), checkIntersection)
	// In case of EXCLUSION operation, set the children CheckFunctions to be run concurrently
	// and return the permission if the first CheckFunction succeeds and all others fail (exclusion).
	case *base.Rewrite_OPERATION_EXCLUSION.Enum():
		return engine.setChild(ctx, request, rewrite.GetChildren(), checkExclusion)
	// In case of an undefined child type, return a CheckFunction that always fails.
	default:
		return checkFail(errors.New(base.ErrorCode_ERROR_CODE_UNDEFINED_CHILD_TYPE.String()))
	}
}

// checkLeaf prepares a CheckFunction according to the provided Leaf operation.
// It uses a Leaf object that describes how to check a permission request.
func (engine *CheckEngine) checkLeaf(request *base.PermissionCheckRequest, leaf *base.Leaf) CheckFunction {
	// Switch statement depending on the Leaf type
	switch op := leaf.GetType().(type) {
	// In case of TupleToUserSet operation, prepare a CheckFunction that checks
	// if the request's user is in the UserSet referenced by the tuple.
	case *base.Leaf_TupleToUserSet:
		return engine.checkTupleToUserSet(request, op.TupleToUserSet)
	// In case of ComputedUserSet operation, prepare a CheckFunction that checks
	// if the request's user is in the computed UserSet.
	case *base.Leaf_ComputedUserSet:
		return engine.checkComputedUserSet(request, op.ComputedUserSet)
	// In case of ComputedAttribute operation, prepare a CheckFunction that checks
	// the computed attribute's permission.
	case *base.Leaf_ComputedAttribute:
		return engine.checkComputedAttribute(request, op.ComputedAttribute)
	// In case of Call operation, prepare a CheckFunction that checks
	// the Call's permission.
	case *base.Leaf_Call:
		return engine.checkCall(request, op.Call)
	// In case of an undefined type, return a CheckFunction that always fails.
	default:
		return checkFail(errors.New(base.ErrorCode_ERROR_CODE_UNDEFINED_CHILD_TYPE.String()))
	}
}

// setChild prepares a CheckFunction according to the provided combiner function
// and children. It uses the Child object which contains the information about the child
// nodes and can be either a Rewrite or a Leaf.
func (engine *CheckEngine) setChild(
	ctx context.Context,
	request *base.PermissionCheckRequest,
	children []*base.Child,
	combiner CheckCombiner,
) Ch
```

### Core Architecture Module: `internal/engines/entity_filter.go`
```
package engines

import (
	"context"
	"errors"
	"fmt"

	"golang.org/x/sync/errgroup"

	"github.com/Permify/permify/internal/schema"
	"github.com/Permify/permify/internal/storage"
	storageContext "github.com/Permify/permify/internal/storage/context"
	tokenutils "github.com/Permify/permify/internal/storage/context/utils"
	"github.com/Permify/permify/pkg/database"
	base "github.com/Permify/permify/pkg/pb/base/v1"
)

// _maxBFSDepth bounds same-type recursive relation expansion in entity lookup.
const _maxBFSDepth = 100

// EntityFilter is a struct that performs permission checks on a set of entities
type EntityFilter struct {
	// dataReader is responsible for reading relationship information
	dataReader storage.DataReader

	graph *schema.LinkedSchemaGraph
}

// NewEntityFilter creates a new EntityFilter engine
func NewEntityFilter(dataReader storage.DataReader, sch *base.SchemaDefinition) *EntityFilter {
	return &EntityFilter{
		dataReader: dataReader,
		graph:      schema.NewLinkedGraph(sch),
	}
}

// EntityFilter is a method of the EntityFilterEngine struct. It executes a permission request for linked entities.
func (engine *EntityFilter) EntityFilter(
	ctx context.Context, // A context used for tracing and cancellation.
	request *base.PermissionEntityFilterRequest, // A permission request for linked entities.
	visits *VisitsMap, // A map that keeps track of visited entities to avoid infinite loops.
	publisher *BulkEntityPublisher, // A custom publisher that publishes results in bulk.
) (err error) { // Returns an error if one occurs during execution.
	// Check if direct result
	if request.GetEntrance().GetType() == request.GetSubject().GetType() && request.GetEntrance().GetValue() == request.GetSubject().GetRelation() {
		found := &base.Entity{
			Type: request.GetSubject().GetType(),
			Id:   request.GetSubject().GetId(),
		}

		if !visits.AddPublished(found) { // If the entity and relation has already been visited.
			return nil
		}

		// If the entity reference is the same as the subject, publish the result directly and return.
		publisher.Publish(found, &base.PermissionCheckRequestMetadata{
			SnapToken:     request.GetMetadata().GetSnapToken(),
			SchemaVersion: request.GetMetadata().GetSchemaVersion(),
			Depth:         request.GetMetadata().GetDepth(),
		}, request.GetContext(), base.CheckResult_CHECK_RESULT_UNSPECIFIED)
	}

	// Retrieve linked entrances
	var entrances []*schema.LinkedEntrance
	entrances, err = engine.graph.LinkedEntrances(
		request.GetEntrance(),
		&base.Entrance{
			Type:  request.GetSubject().GetType(),
			Value: request.GetSubject().GetRelation(),
		},
	) // Retrieve the linked entrances between the entity reference and subject.

	if entrances == nil {
		return nil
	}

	// Create a new context for executing goroutines and a cancel function.
	cctx, cancel := context.WithCancel(ctx)
	defer cancel()

	// Create a new errgroup and a new context that inherits the original context.
	g, cont := errgroup.WithContext(cctx)

	// Loop over each linked entrance.
	for _, entrance := range entrances {
		// Switch on the kind of linked entrance.
		switch entrance.LinkedEntranceKind() {
		case schema.RelationLinkedEntrance: // If the linked entrance is a relation entrance.
			err = engine.relationEntrance(cont, request, entrance, visits, g, publisher) // Call the relation entrance method.
			if err != nil {
				return err
			}
		case schema.ComputedUserSetLinkedEntrance: // If the linked entrance is a computed user set entrance.
			err = engine.lt(cont, request, &base.EntityAndRelation{ // Call the run method with a new entity and relation.
				Entity: &base.Entity{
					Type: entrance.TargetEntrance.GetType(),
					Id:   request.GetSubject().GetId(),
				},
				Relation: entrance.TargetEntrance.GetValue(),
			}, visits, g, publisher)
			if err != nil {
				return err
			}
		case schema.AttributeLinkedEntrance: // If the linked entrance is a computed user set entrance.
			err = engine.attributeEntrance(cont, request, entrance, visits, publisher) // Call the tuple to user set entrance method.
			if err != nil {
				return err
			}
		case schema.TupleToUserSetLinkedEntrance: // If the linked entrance is a tuple to user set entrance.
			err = engine.tupleToUserSetEntrance(cont, request, entrance, visits, g, publisher) // Call the tuple to user set entrance method.
			if err != nil {
				return err
			}
		case schema.PathChainLinkedEntrance: // If the linked entrance is a path chain entrance.
			err = engine.pathChainEntrance(cont, request, entrance, visits, publisher) // Call the path chain entrance method.
			if err != nil {
				return err
			}
		default:
			return errors.New("unknown linked entrance type") // Return an error if the linked entrance is of an unknown type.
		}
	}

	return g.Wait() // Wait for all goroutines in the errgroup to complete and return any errors that occur.
}

// relationEntrance is a method of the EntityFilterEngine struct. It handles relation entrances.
func (engine *EntityFilter) attributeEntrance(
	ctx context.Context, // A context used for tracing and cancellation.
	request *base.PermissionEntityFilterRequest, // A permission request for linked entities.
	entrance *schema.LinkedEntrance, // A linked entrance.
	visits *VisitsMap, // A map that keeps track of visited entities to avoid infinite loops.
	publisher *BulkEntityPublisher, // A custom publisher that publishes results in bulk.
) error { // Returns an error if one occurs during execution.
	// attributeEntrance only handles direct attribute access
	if !visits.AddEA(entrance.TargetEntrance.GetType(), entrance.TargetEntrance.GetValue()) {
		return nil
	}

	// Retrieve the scope associated with the target entrance type
	scope, exists := request.GetScope()[entrance.TargetEntrance.GetType()]
	var data []string
	if exists {
		data = scope.GetData()
	}

	// Query attributes directly
	filter := &base.AttributeFilter{
		Entity: &base.EntityFilter{
			Type: entrance.TargetEntrance.GetType(),
			Ids:  data,
		},
		Attributes: []string{entrance.TargetEntrance.GetValue()},
	}

	selfCycleRelations := engine.graph.SelfCycleRelationsForPermission(
		request.GetEntrance().GetType(),
		request.GetEntrance().GetValue(),
	)

	expandRecursive := request.GetEntrance().GetType() == entrance.TargetEntrance.GetType() &&
		len(selfCycleRelations) > 0

	pagination := database.NewCursorPagination(database.Cursor(request.GetCursor()), database.Sort("entity_id"))

	cti, err := storageContext.NewContextualAttributes(request.GetContext().GetAttributes()...).QueryAttributes(filter, pagination)
	if err != nil {
		return err
	}

	rit, err := engine.dataReader.QueryAttributes(ctx, request.GetTenantId(), filter, request.GetMetadata().GetSnapToken(), pagination)
	if err != nil {
		return err
	}

	it := database.NewUniqueAttributeIterator(rit, cti)

	var attributeEntityIDs []string
	attributeEntityIDSet := make(map[string]struct{})

	// Publish entities directly for regular case
	for it.HasNext() {
		current, ok := it.GetNext()
		if !ok {
			break
		}

		entity := &base.Entity{
			Type: entrance.TargetEntrance.GetType(),
			Id:   current.GetEntity().GetId(),
		}

		if expandRecursive {
			if _, ok := attributeEntityIDSet[entity.GetId()]; !ok {
				attributeEntityIDSet[entity.GetId()] = struct{}{}
				attributeEntityIDs = append(attributeEntityIDs, entity.GetId())
			}
		}

		if !visits.AddPublished(entity) {
			continue
		}

		publisher.Publish(entity, &base.PermissionCheckRequestMetadata{
			SnapToken:     request.GetMetadata().GetSnapToken(),
			SchemaVersion: request.GetMetadata().GetSchemaVersion(),
			Depth:         request.GetMetadata().GetDepth(),
		}, request.GetContext(), base.CheckResult_CHECK_RESULT_UNSPECIFIED)
	}

	// For same-type recursive permissions, collect recursion seeds
	// without cursor filtering so descendant entities remain reachable on later pages.
	if expandRecursive && request.GetCursor() != "" {
		seedPagination := database.NewCursorPagination(database.Sort("entity_id"))
		seedCTI, err := storageContext.NewContextualAttributes(request.GetContext().GetAttributes()...).QueryAttributes(filter, seedPagination)
		if err != nil {
			return err
		}

		seedRIT, err := engine.dataReader.QueryAttributes(ctx, request.GetTenantId(), filter, request.GetMetadata().GetSnapToken(), seedPagination)
		if err != nil {
			return err
		}

		seedIt := database.NewUniqueAttributeIterator(seedRIT, seedCTI)
		for seedIt.HasNext() {
			current, ok := seedIt.GetNext()
			if !ok {
				break
			}

			id := current.GetEntity().GetId()
			if _, ok := attributeEntityIDSet[id]; ok {
				continue
			}
			attributeEntityIDSet[id] = struct{}{}
			attributeEntityIDs = append(attributeEntityIDs, id)
		}
	}

	// Expand recursive relations for same-type attribute permissions
	if expandRecursive && len(attributeEntityIDs) > 0 {
		for _, relation := range selfCycleRelations {
			err := engine.expandRecursiveRelation(ctx, request, entrance.TargetEntrance.GetType(), relation, attributeEntityIDs, visits, publisher)
			if err != nil {
				return err
			}
		}
	}

	return nil
}

// decodeCursorValue decodes a cursor token and returns its underlying value.
// It returns an empty string when the cursor is empty.
// If decoding fails, the error is returned.
// If the decoded token is not a ContinuousToken, it returns an empty string.
func decodeCursorValue(cursor string) (string, error) {
	if cursor == "" {
		return "", nil
	}
	t, err := tokenutils.EncodedContinuousToken{Value: cursor}.Decode()
	if err != nil {
		return "", err
	}
	decoded, ok := t.(tokenutils.ContinuousToken)
	if !ok {
		return "", nil
	}
	return decoded.Value, nil
}

// expandRecursiveRelation publishes all entities reachable from seed subjects via a relation,
// walking the relation transitively (self-recursive permissions).
func (engine *EntityFilter) expandRecursiveRelation(
	ctx context.Context,
	request *base.PermissionEntityFilterRequest,
	entityType string,
	relation string,
	seedSubjectIDs []stri
```

### Core Architecture Module: `internal/engines/expand.go`
```
package engines

import (
	"context"
	"errors"

	"google.golang.org/protobuf/types/known/anypb"

	"github.com/Permify/permify/internal/schema"
	"github.com/Permify/permify/internal/storage"
	storageContext "github.com/Permify/permify/internal/storage/context"
	"github.com/Permify/permify/pkg/database"
	base "github.com/Permify/permify/pkg/pb/base/v1"
	"github.com/Permify/permify/pkg/tuple"
)

// ExpandEngine - This comment is describing a type called ExpandEngine. The ExpandEngine type contains two fields: schemaReader,
// which is a storage.SchemaReader object, and relationshipReader, which is a storage.RelationshipReader object.
// The ExpandEngine type is used to expand permission scopes based on a given user ID and a set of permission requirements.
type ExpandEngine struct {
	// schemaReader is responsible for reading schema information
	schemaReader storage.SchemaReader
	// relationshipReader is responsible for reading relationship information
	dataReader storage.DataReader
}

// NewExpandEngine - This function creates a new instance of ExpandEngine by taking a SchemaReader and a RelationshipReader as
// parameters and returning a pointer to the created instance. The SchemaReader is used to read schema definitions, while the
// RelationshipReader is used to read relationship definitions.
func NewExpandEngine(sr storage.SchemaReader, rr storage.DataReader) *ExpandEngine {
	return &ExpandEngine{
		schemaReader: sr,
		dataReader:   rr,
	}
}

// Expand - This is the Run function of the ExpandEngine type, which takes a context, a PermissionExpandRequest,
// and returns a PermissionExpandResponse and an error.
// The function begins by starting a new OpenTelemetry span, with the name "permissions.expand.execute".
// It then checks if a snap token and schema version are included in the request. If not, it retrieves the head
// snapshot and head schema version, respectively, from the appropriate repository.
//
// Finally, the function calls the expand function of the ExpandEngine type with the context, PermissionExpandRequest,
// and false value, and returns the resulting PermissionExpandResponse and error. If there is an error, the span records
// the error and sets the status to indicate an error.
func (engine *ExpandEngine) Expand(ctx context.Context, request *base.PermissionExpandRequest) (response *base.PermissionExpandResponse, err error) {
	resp := engine.expand(ctx, request)
	if resp.Err != nil {
		return nil, resp.Err
	}
	return resp.Response, resp.Err
}

// ExpandResponse is a struct that contains the response and error returned from
// the expand function in the ExpandEngine. It is used to return the response and
// error together as a single object.
type ExpandResponse struct {
	Response *base.PermissionExpandResponse
	Err      error
}

// ExpandFunction represents a function that expands the schema and relationships
// of a request and sends the response through the provided channel.
type ExpandFunction func(ctx context.Context, expandChain chan<- ExpandResponse)

// ExpandCombiner represents a function that combines the results of multiple
// ExpandFunction calls into a single ExpandResponse.
type ExpandCombiner func(ctx context.Context, entity *base.Entity, permission string, arguments []*base.Argument, functions []ExpandFunction) ExpandResponse

// 'expand' is a method of ExpandEngine which takes a context and a PermissionExpandRequest,
// and returns an ExpandResponse. This function is the main entry point for expanding permissions.
func (engine *ExpandEngine) expand(ctx context.Context, request *base.PermissionExpandRequest) ExpandResponse {
	var fn ExpandFunction // Declare an ExpandFunction variable.

	// Read entity definition based on the entity type in the request.
	en, _, err := engine.schemaReader.ReadEntityDefinition(ctx, request.GetTenantId(), request.GetEntity().GetType(), request.GetMetadata().GetSchemaVersion())
	if err != nil {
		// If an error occurred while reading entity definition, return an ExpandResponse with the error.
		return ExpandResponse{Err: err}
	}

	var tor base.EntityDefinition_Reference
	// Get the type of reference by name in the entity definition.
	tor, _ = schema.GetTypeOfReferenceByNameInEntityDefinition(en, request.GetPermission())

	// Depending on the type of reference, execute different branches of code.
	switch tor {
	case base.EntityDefinition_REFERENCE_PERMISSION:
		// If the reference is a permission, get the permission by name from the entity definition.
		permission, err := schema.GetPermissionByNameInEntityDefinition(en, request.GetPermission())
		if err != nil {
			// If an error occurred while getting the permission, return an ExpandResponse with the error.
			return ExpandResponse{Err: err}
		}

		// Get the child of the permission.
		child := permission.GetChild()
		// If the child has a rewrite rule, use the 'expandRewrite' method.
		if child.GetRewrite() != nil {
			fn = engine.expandRewrite(ctx, request, child.GetRewrite())
		} else {
			// If the child doesn't have a rewrite rule, use the 'expandLeaf' method.
			fn = engine.expandLeaf(request, child.GetLeaf())
		}
	case base.EntityDefinition_REFERENCE_ATTRIBUTE:
		// If the reference is an attribute, use the 'expandDirectAttribute' method.
		fn = engine.expandDirectAttribute(request)
	case base.EntityDefinition_REFERENCE_RELATION:
		// If the reference is a relation, use the 'expandDirectRelation' method.
		fn = engine.expandDirectRelation(request)
	default:
		// If the reference is neither permission, attribute, nor relation, use the 'expandCall' method.
		fn = engine.expandDirectCall(request)
	}

	if fn == nil {
		// If no expand function was set, return an ExpandResponse with an error.
		return ExpandResponse{Err: errors.New(base.ErrorCode_ERROR_CODE_UNDEFINED_CHILD_KIND.String())}
	}

	// Execute the expand function with the root context.
	return expandRoot(ctx, fn)
}

// 'expandRewrite' is a method of ExpandEngine which takes a context, a PermissionExpandRequest,
// and a rewrite rule. It returns an ExpandFunction which represents the expansion of the rewrite rule.
func (engine *ExpandEngine) expandRewrite(ctx context.Context, request *base.PermissionExpandRequest, rewrite *base.Rewrite) ExpandFunction {
	// The rewrite rule can have different operations: UNION, INTERSECTION, EXCLUSION.
	// Depending on the operation type, it calls different methods.
	switch rewrite.GetRewriteOperation() {
	// If the operation is UNION, call the 'setChild' method with 'expandUnion' as the expand function.
	case *base.Rewrite_OPERATION_UNION.Enum():
		return engine.setChild(ctx, request, rewrite.GetChildren(), expandUnion)

	// If the operation is INTERSECTION, call the 'setChild' method with 'expandIntersection' as the expand function.
	case *base.Rewrite_OPERATION_INTERSECTION.Enum():
		return engine.setChild(ctx, request, rewrite.GetChildren(), expandIntersection)

	// If the operation is EXCLUSION, call the 'setChild' method with 'expandExclusion' as the expand function.
	case *base.Rewrite_OPERATION_EXCLUSION.Enum():
		return engine.setChild(ctx, request, rewrite.GetChildren(), expandExclusion)

	// If the operation is not any of the defined types, return an error.
	default:
		return expandFail(errors.New(base.ErrorCode_ERROR_CODE_UNDEFINED_CHILD_TYPE.String()))
	}
}

// 'expandLeaf' is a method of ExpandEngine which takes a PermissionExpandRequest and a leaf object.
// It returns an ExpandFunction, a function which performs the action associated with a given leaf type.
func (engine *ExpandEngine) expandLeaf(
	request *base.PermissionExpandRequest,
	leaf *base.Leaf,
) ExpandFunction {
	// The leaf object can have different types, each associated with a different expansion function.
	// Depending on the type of the leaf, different expansion functions are returned.
	switch op := leaf.GetType().(type) {
	// If the type of the leaf is TupleToUserSet, the method 'expandTupleToUserSet' is called.
	case *base.Leaf_TupleToUserSet:
		return engine.expandTupleToUserSet(request, op.TupleToUserSet)

	// If the type of the leaf is ComputedUserSet, the method 'expandComputedUserSet' is called.
	case *base.Leaf_ComputedUserSet:
		return engine.expandComputedUserSet(request, op.ComputedUserSet)

	// If the type of the leaf is ComputedAttribute, the method 'expandComputedAttribute' is called.
	case *base.Leaf_ComputedAttribute:
		return engine.expandComputedAttribute(request, op.ComputedAttribute)

	// If the type of the leaf is Call, the method 'expandCall' is called.
	case *base.Leaf_Call:
		return engine.expandCall(request, op.Call)

	// If the leaf type is none of the above, an error is returned.
	default:
		return expandFail(errors.New(base.ErrorCode_ERROR_CODE_UNDEFINED_CHILD_TYPE.String()))
	}
}

// 'setChild' is a method of the ExpandEngine struct, which aims to create and set an ExpandFunction
// for each child in the provided children array. These functions are derived from the type of child
// (either a rewrite or a leaf) and are passed to a provided 'combiner' function.
func (engine *ExpandEngine) setChild(
	ctx context.Context,
	request *base.PermissionExpandRequest,
	children []*base.Child,
	combiner ExpandCombiner,
) ExpandFunction {
	// Declare an array to hold ExpandFunctions.
	var functions []ExpandFunction

	// Iterate through each child in the provided array.
	for _, child := range children {
		// Based on the type of child, append the appropriate ExpandFunction to the functions array.
		switch child.GetType().(type) {
		// If the child is a 'rewrite' type, use the 'expandRewrite' function.
		case *base.Child_Rewrite:
			functions = append(functions, engine.expandRewrite(ctx, request, child.GetRewrite()))

		// If the child is a 'leaf' type, use the 'expandLeaf' function.
		case *base.Child_Leaf:
			functions = append(functions, engine.expandLeaf(request, child.GetLeaf()))

		// If the child type is not recognized, return an error.
		default:
			return expandFail(errors.New(base.ErrorCode_ERROR_CO
```

### Core Architecture Module: `internal/engines/lookup.go`
```
package engines

import (
	"context"
	"fmt"
	"slices"
	"sort"
	"strings"
	"sync"

	"github.com/Permify/permify/internal/invoke"
	"github.com/Permify/permify/internal/storage"
	"github.com/Permify/permify/internal/storage/context/utils"
	"github.com/Permify/permify/pkg/database"
	base "github.com/Permify/permify/pkg/pb/base/v1"
)

type LookupEngine struct {
	// schemaReader is responsible for reading schema information
	schemaReader storage.SchemaReader
	// schemaReader is responsible for reading data
	dataReader storage.DataReader
	// checkEngine is responsible for performing permission checks
	checkEngine invoke.Check
	// schemaMap is a map that keeps track of schema versions
	schemaMap sync.Map
	// concurrencyLimit is the maximum number of concurrent permission checks allowed
	concurrencyLimit int
}

func NewLookupEngine(
	check invoke.Check,
	schemaReader storage.SchemaReader,
	dataReader storage.DataReader,
	opts ...LookupOption,
) *LookupEngine {
	engine := &LookupEngine{
		schemaReader:     schemaReader,
		checkEngine:      check,
		dataReader:       dataReader,
		schemaMap:        sync.Map{},
		concurrencyLimit: _defaultConcurrencyLimit,
	}

	// options
	for _, opt := range opts {
		opt(engine)
	}

	return engine
}

// LookupEntity performs a permission check on a set of entities and returns a response
// containing the IDs of the entities that have the requested permission.
func (engine *LookupEngine) LookupEntity(ctx context.Context, request *base.PermissionLookupEntityRequest) (response *base.PermissionLookupEntityResponse, err error) {
	// A mutex and slice are declared to safely store entity IDs from concurrent callbacks
	var mu sync.Mutex
	var entityIDs []string
	var ct string

	size := request.GetPageSize()
	if size == 0 {
		size = 1000
	}

	// Callback function which is called for each entity. If the entity passes the permission check,
	// the entity ID is appended to the entityIDs slice.
	callback := func(entityID, token string) {
		mu.Lock()         // Safeguard access to the shared slice with a mutex
		defer mu.Unlock() // Ensure the lock is released after appending the ID
		entityIDs = append(entityIDs, entityID)
		ct = token
	}

	// Create configuration for BulkChecker
	config := BulkCheckerConfig{
		ConcurrencyLimit: engine.concurrencyLimit,
		BufferSize:       1000,
	}

	// Create and start BulkChecker. It performs permission checks in parallel.
	checker, err := NewBulkChecker(ctx, engine.checkEngine, BulkCheckerTypeEntity, callback, config)
	if err != nil {
		return nil, fmt.Errorf("failed to create bulk checker: %w", err)
	}
	defer checker.Close()

	// Create and start BulkPublisher. It receives entities and passes them to BulkChecker.
	publisher := NewBulkEntityPublisher(ctx, request, checker)

	// Retrieve the schema of the entity based on the tenantId and schema version
	var sc *base.SchemaDefinition
	sc, err = engine.readSchema(ctx, request.GetTenantId(), request.GetMetadata().GetSchemaVersion())
	if err != nil {
		return nil, err
	}

	// Create a map to keep track of visited entities
	visits := &VisitsMap{}

	// Perform an entity filter operation based on the permission request
	err = NewEntityFilter(engine.dataReader, sc).EntityFilter(ctx, &base.PermissionEntityFilterRequest{
		TenantId: request.GetTenantId(),
		Metadata: &base.PermissionEntityFilterRequestMetadata{
			SnapToken:     request.GetMetadata().GetSnapToken(),
			SchemaVersion: request.GetMetadata().GetSchemaVersion(),
			Depth:         request.GetMetadata().GetDepth(),
		},
		Entrance: &base.Entrance{
			Type:  request.GetEntityType(),
			Value: request.GetPermission(),
		},
		Subject: request.GetSubject(),
		Context: request.GetContext(),
		Scope:   request.GetScope(),
		Cursor:  request.GetContinuousToken(),
	}, visits, publisher)
	if err != nil {
		return nil, err
	}

	// At this point, the BulkChecker has collected and sorted requests
	err = checker.ExecuteRequests(size) // Execute the collected requests in parallel
	if err != nil {
		return nil, err
	}

	// Return response containing allowed entity IDs
	return &base.PermissionLookupEntityResponse{
		EntityIds:       entityIDs,
		ContinuousToken: ct,
	}, nil
}

// LookupEntityStream performs a permission check on a set of entities and streams the results
// containing the IDs of the entities that have the requested permission.
func (engine *LookupEngine) LookupEntityStream(ctx context.Context, request *base.PermissionLookupEntityRequest, server base.Permission_LookupEntityStreamServer) (err error) {
	size := request.GetPageSize()
	if size == 0 {
		size = 1000
	}

	// Define a callback function that will be called for each entity that passes the permission check.
	// If the check result is allowed, it sends the entity ID to the server stream.
	callback := func(entityID, token string) {
		err := server.Send(&base.PermissionLookupEntityStreamResponse{
			EntityId:        entityID,
			ContinuousToken: token,
		})
		// If there is an error in sending the response, the function will return
		if err != nil {
			return
		}
	}

	// Create configuration for BulkChecker
	config := BulkCheckerConfig{
		ConcurrencyLimit: engine.concurrencyLimit,
		BufferSize:       1000,
	}

	// Create and start BulkChecker. It performs permission checks concurrently.
	checker, err := NewBulkChecker(ctx, engine.checkEngine, BulkCheckerTypeEntity, callback, config)
	if err != nil {
		return fmt.Errorf("failed to create bulk checker: %w", err)
	}
	defer checker.Close()

	// Create and start BulkPublisher. It receives entities and passes them to BulkChecker.
	publisher := NewBulkEntityPublisher(ctx, request, checker)

	// Retrieve the entity definition schema based on the tenantId and schema version
	var sc *base.SchemaDefinition
	sc, err = engine.readSchema(ctx, request.GetTenantId(), request.GetMetadata().GetSchemaVersion())
	if err != nil {
		return err
	}

	visits := &VisitsMap{}

	// Perform an entity filter operation based on the permission request
	err = NewEntityFilter(engine.dataReader, sc).EntityFilter(ctx, &base.PermissionEntityFilterRequest{
		TenantId: request.GetTenantId(),
		Metadata: &base.PermissionEntityFilterRequestMetadata{
			SnapToken:     request.GetMetadata().GetSnapToken(),
			SchemaVersion: request.GetMetadata().GetSchemaVersion(),
			Depth:         request.GetMetadata().GetDepth(),
		},
		Entrance: &base.Entrance{
			Type:  request.GetEntityType(),
			Value: request.GetPermission(),
		},
		Subject: request.GetSubject(),
		Context: request.GetContext(),
		Cursor:  request.GetContinuousToken(),
	}, visits, publisher)
	if err != nil {
		return err
	}

	err = checker.ExecuteRequests(size)
	if err != nil {
		return err
	}

	return nil
}

// LookupSubject checks if a subject has a particular permission based on the schema and version.
// It returns a list of subjects that have the given permission.
func (engine *LookupEngine) LookupSubject(ctx context.Context, request *base.PermissionLookupSubjectRequest) (response *base.PermissionLookupSubjectResponse, err error) {
	size := request.GetPageSize()
	if size == 0 {
		size = 1000
	}

	var ids []string
	var ct string

	// Use the schema-based subject filter to get the list of subjects with the requested permission.
	ids, err = NewSubjectFilter(engine.schemaReader, engine.dataReader, SubjectFilterConcurrencyLimit(engine.concurrencyLimit)).SubjectFilter(ctx, request)
	if err != nil {
		return nil, err
	}

	// Initialize excludedIds to be used in the query
	var excludedIds []string

	// Check if the wildcard '<>' is present in the ids.Ids or if it's formatted like "<>-1,2,3"
	for _, id := range ids {
		if id == ALL {
			// Handle '<>' case: no exclusions, include all resources
			excludedIds = nil
			break
		} else if strings.HasPrefix(id, ALL+"-") {
			// Handle '<>-1,2,3' case: parse exclusions after '-'
			excludedIds = strings.Split(strings.TrimPrefix(id, ALL+"-"), ",")
			break
		}
	}

	// If '<>' was found, query all subjects with exclusions if provided
	if excludedIds != nil || slices.Contains(ids, ALL) {
		resp, pct, err := engine.dataReader.QueryUniqueSubjectReferences(
			ctx,
			request.GetTenantId(),
			request.GetSubjectReference(),
			excludedIds, // Pass the exclusions if any
			request.GetMetadata().GetSnapToken(),
			database.NewPagination(database.Size(size), database.Token(request.GetContinuousToken())),
		)
		if err != nil {
			return nil, err
		}
		ct = pct.String()

		// Return the list of entity IDs that have the required permission.
		return &base.PermissionLookupSubjectResponse{
			SubjectIds:      resp,
			ContinuousToken: ct,
		}, nil
	}

	// Sort the IDs
	sort.Strings(ids)

	// Convert page size to int for compatibility with startIndex
	pageSize := int(size)

	// Determine the end index based on the page size and total number of IDs
	end := min(pageSize, len(ids))

	// Generate the next continuous token if there are more results
	if end < len(ids) {
		ct = utils.NewContinuousToken(ids[end]).Encode().String()
	} else {
		ct = ""
	}

	// Return the paginated list of IDs
	return &base.PermissionLookupSubjectResponse{
		SubjectIds:      ids[:end], // Slice the IDs based on pagination
		ContinuousToken: ct,        // Return the next continuous token
	}, nil
}

// readSchema retrieves a SchemaDefinition for a given tenantID and schemaVersion.
// It first checks a cache (schemaMap) for the schema, and if not found, reads it using the schemaReader.
func (engine *LookupEngine) readSchema(ctx context.Context, tenantID, schemaVersion string) (*base.SchemaDefinition, error) {
	// Create a unique cache key by combining the tenantID and schemaVersion.
	// This ensures that different combinations of tenantID and schemaVersion get their own cache entries.
	cacheKey := tenantID + "|" + schemaVersion

	// Attempt to retrieve the schema from the cache (schemaMap) using the generated cacheKey.
	if sch, ok := engine.schemaMap.Load(cacheKey); ok {
		// If the schema is present in the cache, cast it to its correct type and retur
```

### Core Architecture Module: `internal/engines/subject_filter.go`
```
package engines

import (
	"context"
	"errors"
	"fmt"
	"slices" // Slice utilities
	"strings"
	"sync"

	"github.com/google/cel-go/cel"

	"github.com/Permify/permify/internal/schema"
	"github.com/Permify/permify/internal/storage"
	storageContext "github.com/Permify/permify/internal/storage/context"
	"github.com/Permify/permify/pkg/database"
	"github.com/Permify/permify/pkg/dsl/utils"
	base "github.com/Permify/permify/pkg/pb/base/v1"
	"github.com/Permify/permify/pkg/tuple"
)

const ALL = "<>"

type SubjectFilter struct {
	// schemaReader is responsible for reading schema information
	schemaReader storage.SchemaReader
	// dataReader is responsible for reading relationship information
	dataReader storage.DataReader
	// concurrencyLimit is the maximum number of concurrent permission checks allowed
	concurrencyLimit int
}

func NewSubjectFilter(schemaReader storage.SchemaReader, dataReader storage.DataReader, opts ...SubjectFilterOption) *SubjectFilter {
	filter := &SubjectFilter{
		dataReader:       dataReader,
		schemaReader:     schemaReader,
		concurrencyLimit: _defaultConcurrencyLimit,
	}

	for _, opt := range opts {
		opt(filter)
	}

	return filter
}

// SubjectFilterFunction defines the type for a function that takes a context and
// returns a pointer to a PermissionSubjectFilterResponse and an error.
// This type is often used when you want to pass around functions with this specific signature.
type SubjectFilterFunction func(ctx context.Context) ([]string, error)

// SubjectFilterCombiner defines the type for a function that takes a context, a slice of SubjectFilterFunctions,
// an integer as a limit and returns a pointer to a PermissionSubjectFilterResponse and an error.
// This type is useful when you want to define a function that can execute multiple SubjectFilterFunctions in a specific way
// (like concurrently with a limit or sequentially) and combine their results into a single PermissionSubjectFilterResponse.
type SubjectFilterCombiner func(ctx context.Context, functions []SubjectFilterFunction, limit int) ([]string, error)

// SubjectFilter is a method for the SubjectFilterEngine struct.
// It takes a context and a pointer to a PermissionSubjectFilterRequest
// and returns a pointer to a PermissionSubjectFilterResponse and an error.
func (engine *SubjectFilter) SubjectFilter(ctx context.Context, request *base.PermissionLookupSubjectRequest) (response []string, err error) {
	// ReadEntityDefinition method of the SchemaReader interface is used to retrieve the entity's schema definition.
	// GetTenantId, GetType and GetSchemaVersion methods are used to provide necessary arguments to ReadEntityDefinition.
	var en *base.EntityDefinition
	en, _, err = engine.schemaReader.ReadEntityDefinition(ctx, request.GetTenantId(), request.GetEntity().GetType(), request.GetMetadata().GetSchemaVersion())
	if err != nil {
		// If an error is encountered while reading the schema definition, return an empty response and the error.
		return subjectFilterEmpty(), err
	}

	var res []string

	// Call the subjectFilter method of the engine, which returns a function.
	// That function is then immediately called with the context to perform the actual subject lookup.
	res, err = engine.subjectFilter(ctx, request, en)(ctx)
	if err != nil {
		// If an error is encountered during the lookup, return an empty response and the error.
		return subjectFilterEmpty(), err
	}

	// If everything went smoothly, return the lookup result and nil error.
	return res, nil
}

// subjectFilter is a method for the SubjectFilterEngine struct.
// It determines the type of relational reference for the permission field in the request,
// prepares and returns a SubjectFilterFunction accordingly.
func (engine *SubjectFilter) subjectFilter(
	ctx context.Context,
	request *base.PermissionLookupSubjectRequest,
	en *base.EntityDefinition,
) SubjectFilterFunction {
	// The GetTypeOfRelationalReferenceByNameInEntityDefinition method retrieves the type of relational reference for the permission field.
	tor, _ := schema.GetTypeOfReferenceByNameInEntityDefinition(en, request.GetPermission())

	var fn SubjectFilterFunction

	switch tor {
	case base.EntityDefinition_REFERENCE_PERMISSION:
		// Get the permission by its name in the entity definition.
		permission, err := schema.GetPermissionByNameInEntityDefinition(en, request.GetPermission())
		if err != nil {
			// If an error is encountered while getting the permission, a SubjectFilterFunction is returned that always fails with this error.
			return subjectFilterFail(err)
		}
		child := permission.GetChild()

		// Depending on whether the child permission has a rewrite rule,
		// we prepare a SubjectFilterFunction to handle it accordingly.
		if child.GetRewrite() != nil {
			fn = engine.subjectFilterRewrite(ctx, request, child.GetRewrite())
		} else {
			fn = engine.subjectFilterLeaf(request, child.GetLeaf())
		}
	case base.EntityDefinition_REFERENCE_ATTRIBUTE:
		fn = engine.subjectFilterDirectAttribute(request)
	case base.EntityDefinition_REFERENCE_RELATION:
		fn = engine.subjectFilterDirectRelation(request)
	default:
		fn = engine.subjectFilterDirectCall(request)
	}

	// If we could not prepare a SubjectFilterFunction, we return a function that always fails with an error indicating undefined child kind.
	if fn == nil {
		return subjectFilterFail(errors.New(base.ErrorCode_ERROR_CODE_UNDEFINED_CHILD_KIND.String()))
	}

	// Finally, we return a function that combines results from the prepared function.
	return func(ctx context.Context) ([]string, error) {
		return subjectFilterUnion(ctx, []SubjectFilterFunction{fn}, engine.concurrencyLimit)
	}
}

// subjectFilterRewrite is a method for the SubjectFilterEngine struct.
// It generates a SubjectFilterFunction based on the rewrite operation type present in the provided request.
func (engine *SubjectFilter) subjectFilterRewrite(
	ctx context.Context,
	request *base.PermissionLookupSubjectRequest,
	rewrite *base.Rewrite,
) SubjectFilterFunction {
	// Check the type of the rewrite operation in the request
	switch rewrite.GetRewriteOperation() {
	// If the operation type is UNION, we prepare a function using subjectFilterUnion
	// If the request has an exclusion, we use subjectFilterIntersection instead
	case *base.Rewrite_OPERATION_UNION.Enum():
		// Use the chosen function to set the child entities for lookup
		return engine.setChild(ctx, request, rewrite.GetChildren(), subjectFilterUnion)

	// If the operation type is INTERSECTION, we prepare a function using subjectFilterIntersection
	// If the request has an exclusion, we use subjectFilterUnion instead
	case *base.Rewrite_OPERATION_INTERSECTION.Enum():

		// Use the chosen function to set the child entities for lookup
		return engine.setChild(ctx, request, rewrite.GetChildren(), subjectFilterIntersection)

	// If the operation type is not recognized, we return a function that always fails with an error indicating undefined child type.
	case *base.Rewrite_OPERATION_EXCLUSION.Enum():

		// implement exclusion
		return engine.setChild(ctx, request, rewrite.GetChildren(), subjectFilterExclusion)
	default:
		return subjectFilterFail(errors.New(base.ErrorCode_ERROR_CODE_UNDEFINED_CHILD_TYPE.String()))
	}
}

// subjectFilterLeaf is a method for the SubjectFilterEngine struct.
// It generates a SubjectFilterFunction based on the type of the leaf node in the provided request.
func (engine *SubjectFilter) subjectFilterLeaf(
	request *base.PermissionLookupSubjectRequest,
	leaf *base.Leaf,
) SubjectFilterFunction {
	// Check the type of the leaf node in the request
	switch op := leaf.GetType().(type) {
	// If the type is TupleToUserSet, we prepare a function using subjectFilterTupleToUserSet
	case *base.Leaf_TupleToUserSet:
		return engine.subjectFilterTupleToUserSet(request, op.TupleToUserSet)

	// If the type is ComputedUserSet, we prepare a function using subjectFilterComputedUserSet
	case *base.Leaf_ComputedUserSet:
		return engine.subjectFilterComputedUserSet(request, op.ComputedUserSet)

	case *base.Leaf_ComputedAttribute:

		return engine.subjectfFlterComputedAttribute(request, op.ComputedAttribute)
	case *base.Leaf_Call:

		return engine.subjectFilterCall(request, op.Call)
	// If the leaf type is not recognized, we return a function that always fails with an error indicating undefined child type.
	default:
		return subjectFilterFail(errors.New(base.ErrorCode_ERROR_CODE_UNDEFINED_CHILD_TYPE.String()))
	}
}

// checkComputedAttribute constructs a CheckFunction that checks if a computed attribute
// permission check request is allowed or denied.
func (engine *SubjectFilter) subjectfFlterComputedAttribute(
	request *base.PermissionLookupSubjectRequest,
	ca *base.ComputedAttribute,
) SubjectFilterFunction {
	// This function creates a new SubjectFilterFunction. This function is defined to call SubjectFilter on the engine,
	// with a new PermissionSubjectFilterRequest based on the current request and the ComputedUserSet.
	return func(ctx context.Context) ([]string, error) {
		return engine.SubjectFilter(ctx, &base.PermissionLookupSubjectRequest{
			// The tenant ID is preserved from the original request.
			TenantId: request.GetTenantId(),

			// The entity type and ID are preserved from the original request.
			Entity: &base.Entity{
				Type: request.GetEntity().GetType(),
				Id:   request.GetEntity().GetId(),
			},

			// The permission field is replaced with the relation from the ComputedUserSet.
			Permission: ca.GetName(),

			// The subject reference is preserved from the original request.
			SubjectReference: request.GetSubjectReference(),

			// The metadata is preserved from the original request.
			Metadata: request.GetMetadata(),

			// The contextual tuples are preserved from the original request.
			Context: request.GetContext(),

			ContinuousToken: request.GetContinuousToken(),
		})
	}
}

func (engine *SubjectFilter) subjectFilterDirectAttribute(
	request *base.PermissionLookupSubjectRequest,
) SubjectFilterFunc
```

### Core Architecture Module: `internal/engines/subject_permission.go`
```
package engines

import (
	"context"
	"errors"
	"slices" // Slice utilities
	"sync"

	"github.com/Permify/permify/internal/invoke"
	"github.com/Permify/permify/internal/storage"
	base "github.com/Permify/permify/pkg/pb/base/v1"
)

type SubjectPermissionEngine struct {
	// checkEngine is responsible for performing permission checks
	checker invoke.Check
	// schemaReader is responsible for reading schema information
	schemaReader storage.SchemaReader
	// concurrencyLimit is the maximum number of concurrent permission checks allowed
	concurrencyLimit int
}

func NewSubjectPermission(checker invoke.Check, sr storage.SchemaReader, opts ...SubjectPermissionOption) *SubjectPermissionEngine {
	// Initialize a CheckEngine with default concurrency limit and provided parameters
	engine := &SubjectPermissionEngine{
		checker:          checker,
		schemaReader:     sr,
		concurrencyLimit: _defaultConcurrencyLimit,
	}

	// Apply provided options to configure the CheckEngine
	for _, opt := range opts {
		opt(engine)
	}

	return engine
}

// SubjectPermission is a method on the SubjectPermissionEngine struct.
// It checks permissions for a given subject based on the supplied request and context.
func (engine *SubjectPermissionEngine) SubjectPermission(ctx context.Context, request *base.PermissionSubjectPermissionRequest) (*base.PermissionSubjectPermissionResponse, error) {
	// emptyResp is a default, empty response that we will return in case of an error or when the context is cancelled.
	emptyResp := &base.PermissionSubjectPermissionResponse{
		Results: map[string]base.CheckResult{},
	}

	// The schema definition for the entity is read from the engine's schemaReader.
	// The tenant ID, entity type, and schema version are all taken from the request.
	en, _, err := engine.schemaReader.ReadEntityDefinition(ctx, request.GetTenantId(), request.GetEntity().GetType(), request.GetMetadata().GetSchemaVersion())
	if err != nil {
		// If there's an error reading the schema definition, we wrap it and return.
		return emptyResp, err
	}

	// Initialize a response object with an empty map for the Results.
	res := &base.PermissionSubjectPermissionResponse{
		Results: map[string]base.CheckResult{},
	}

	// Initialize a reference types with permission
	rtyps := []base.EntityDefinition_Reference{
		base.EntityDefinition_REFERENCE_PERMISSION,
	}

	// If the request is not for only permissions, we add relation reference to the list of relational reference types.
	if !request.GetMetadata().GetOnlyPermission() {
		rtyps = append(rtyps, base.EntityDefinition_REFERENCE_RELATION)
	}

	// If allowed reference types contains reference. append to refs list
	var refs []string
	for ref, typ := range en.GetReferences() {
		if slices.Contains(rtyps, typ) {
			refs = append(refs, ref)
		}
	}

	if len(refs) == 0 {
		return emptyResp, nil
	}

	// Create a buffered channel for SubjectPermissionResponses.
	// The buffer size is equal to the number of references in the entity.
	resultChannel := make(chan SubjectPermissionResponse, len(refs))

	// The WaitGroup and Mutex are used for synchronization.
	var wg sync.WaitGroup
	var mutex sync.Mutex

	// Loop over each reference in the entity.
	for _, p := range refs {
		// For each reference, we add a count to the WaitGroup and start a new goroutine.
		wg.Add(1)
		go func(permission string) {
			// When the goroutine completes, it calls Done on the WaitGroup.
			defer wg.Done()

			// The checkEngine's Check method is called with a new PermissionCheckRequest.
			// The request is created using the data from the original request, and the permission from the current iteration.
			cr, err := engine.checker.Check(ctx, &base.PermissionCheckRequest{
				TenantId: request.GetTenantId(),
				Metadata: &base.PermissionCheckRequestMetadata{
					SchemaVersion: request.GetMetadata().GetSchemaVersion(),
					SnapToken:     request.GetMetadata().GetSnapToken(),
					Depth:         request.GetMetadata().GetDepth(),
				},
				Entity:     request.GetEntity(),
				Permission: permission,
				Subject:    request.GetSubject(),
				Context:    request.GetContext(),
			})
			// If there's an error, it is sent over the resultChannel along with the permission and a "denied" result.
			if err != nil {
				resultChannel <- SubjectPermissionResponse{permission: permission, result: base.CheckResult_CHECK_RESULT_DENIED, err: err}
				return
			}

			// If there's no error, the result of the check (along with the permission and a nil error) is sent over the resultChannel.
			resultChannel <- SubjectPermissionResponse{permission: permission, result: cr.Can, err: nil}
		}(p)
	}

	// Once the function returns, we wait for all goroutines to finish, then close the resultChannel.
	defer func() {
		wg.Wait()
		close(resultChannel)
	}()

	// We read the responses from the resultChannel.
	// We expect as many responses as there are references in the entity.
	for i := 0; i < len(refs); i++ {
		select {
		// If we receive a response from the resultChannel, we check for errors.
		case response := <-resultChannel:
			// If there's an error, we return an empty
			// response and the error.
			if response.err != nil {
				return emptyResp, response.err
			}
			// If there's no error, we add the result to our response's Results map.
			// We use a mutex to safely update the map since multiple goroutines may be writing to it concurrently.
			mutex.Lock()
			res.Results[response.permission] = response.result
			mutex.Unlock()

		// If the context is done (i.e., canceled or deadline exceeded), we return an empty response and an error.
		case <-ctx.Done():
			return emptyResp, errors.New(base.ErrorCode_ERROR_CODE_CANCELLED.String())
		}
	}

	// Once all results are processed, we return the response and a nil error.
	return res, nil
}

```

### Core Architecture Module: `internal/engines/utils.go`
```
package engines

import (
	"errors"
	"fmt"
	"sort"
	"strings"
	"sync"

	"google.golang.org/protobuf/types/known/anypb"

	"github.com/Permify/permify/internal/schema"
	"github.com/Permify/permify/pkg/attribute"
	base "github.com/Permify/permify/pkg/pb/base/v1"
	"github.com/Permify/permify/pkg/tuple"
)

const (
	_defaultConcurrencyLimit = 100
)

// CheckOption - a functional option type for configuring the CheckEngine.
type CheckOption func(engine *CheckEngine)

// CheckConcurrencyLimit - a functional option that sets the concurrency limit for the CheckEngine.
func CheckConcurrencyLimit(limit int) CheckOption {
	return func(c *CheckEngine) {
		c.concurrencyLimit = limit
	}
}

type LookupOption func(engine *LookupEngine)

func LookupConcurrencyLimit(limit int) LookupOption {
	return func(c *LookupEngine) {
		c.concurrencyLimit = limit
	}
}

// SubjectFilterOption - a functional option type for configuring the LookupSubjectEngine.
type SubjectFilterOption func(engine *SubjectFilter)

// SubjectFilterConcurrencyLimit - a functional option that sets the concurrency limit for the LookupSubjectEngine.
func SubjectFilterConcurrencyLimit(limit int) SubjectFilterOption {
	return func(c *SubjectFilter) {
		c.concurrencyLimit = limit
	}
}

// SubjectPermissionOption - a functional option type for configuring the SubjectPermissionEngine.
type SubjectPermissionOption func(engine *SubjectPermissionEngine)

// SubjectPermissionConcurrencyLimit - a functional option that sets the concurrency limit for the SubjectPermissionEngine.
func SubjectPermissionConcurrencyLimit(limit int) SubjectPermissionOption {
	return func(c *SubjectPermissionEngine) {
		c.concurrencyLimit = limit
	}
}

// joinResponseMetas - a helper function that merges multiple PermissionCheckResponseMetadata structs into one.
func joinResponseMetas(meta ...*base.PermissionCheckResponseMetadata) *base.PermissionCheckResponseMetadata {
	response := &base.PermissionCheckResponseMetadata{}
	for _, m := range meta {
		response.CheckCount += m.CheckCount
	}
	return response
}

// SubjectPermissionResponse - a struct that holds a SubjectPermissionResponse and an error for a single subject permission check result.
type SubjectPermissionResponse struct {
	permission string
	result     base.CheckResult
	err        error
}

// CheckResponse - a struct that holds a PermissionCheckResponse and an error for a single check function.
type CheckResponse struct {
	resp *base.PermissionCheckResponse
	err  error
}

// VisitsMap - a thread-safe map of ENR records.
type VisitsMap struct {
	er        sync.Map
	published sync.Map
}

func (s *VisitsMap) AddER(entity *base.Entity, relation string) bool {
	key := tuple.EntityAndRelationToString(entity, relation)
	_, existed := s.er.LoadOrStore(key, struct{}{})
	return !existed
}

func (s *VisitsMap) AddEA(entityType, attribute string) bool {
	key := fmt.Sprintf("%s$%s", entityType, attribute)
	_, existed := s.er.LoadOrStore(key, struct{}{})
	return !existed
}

func (s *VisitsMap) AddPublished(entity *base.Entity) bool {
	key := tuple.EntityToString(entity)
	_, existed := s.published.LoadOrStore(key, struct{}{})
	return !existed
}

// SubjectFilterResponse -
type SubjectFilterResponse struct {
	resp []string
	err  error
}

// getEmptyValueForType is a helper function that takes a string representation of a type
// and returns an "empty" value for that type.
// An empty value is a value that is generally considered a default or initial state for a variable of a given type.
// The purpose of this function is to be able to initialize a variable of a given type without knowing the type in advance.
// The function uses a switch statement to handle different possible type values and returns a corresponding empty value.
func getEmptyValueForType(typ base.AttributeType) interface{} {
	switch typ {
	case base.AttributeType_ATTRIBUTE_TYPE_STRING:
		// In the case of a string type, an empty string "" is considered the empty value.
		return ""
	case base.AttributeType_ATTRIBUTE_TYPE_STRING_ARRAY:
		// In the case of a string type, an empty string "" is considered the empty value.
		return []string{}
	case base.AttributeType_ATTRIBUTE_TYPE_INTEGER:
		// In the case of an integer type, zero (0) is considered the empty value.
		return 0
	case base.AttributeType_ATTRIBUTE_TYPE_INTEGER_ARRAY:
		// In the case of an integer type, zero (0) is considered the empty value.
		return []int32{}
	case base.AttributeType_ATTRIBUTE_TYPE_DOUBLE:
		// In the case of a double (or floating point) type, zero (0.0) is considered the empty value.
		return 0.0
	case base.AttributeType_ATTRIBUTE_TYPE_DOUBLE_ARRAY:
		// In the case of a double (or floating point) type, zero (0.0) is considered the empty value.
		return []float64{}
	case base.AttributeType_ATTRIBUTE_TYPE_BOOLEAN:
		// In the case of a boolean type, false is considered the empty value.
		return false
	case base.AttributeType_ATTRIBUTE_TYPE_BOOLEAN_ARRAY:
		// In the case of a boolean type, false is considered the empty value.
		return []bool{}
	default:
		// For any other types that are not explicitly handled, the function returns nil.
		// This may need to be adjusted if there are other types that need specific empty values.
		return nil
	}
}

// getEmptyProtoValueForType returns an empty protobuf value of the specified type.
// It takes a base.AttributeType as input and generates an empty protobuf Any message
// containing a default value for that type.
func getEmptyProtoValueForType(typ base.AttributeType) (*anypb.Any, error) {
	switch typ {
	case base.AttributeType_ATTRIBUTE_TYPE_STRING:
		// Create an empty protobuf String message
		value, err := anypb.New(&base.StringValue{Data: ""})
		if err != nil {
			return nil, err
		}
		return value, nil

	case base.AttributeType_ATTRIBUTE_TYPE_STRING_ARRAY:
		// Create an empty protobuf StringArray message
		value, err := anypb.New(&base.StringArrayValue{Data: []string{}})
		if err != nil {
			return nil, err
		}
		return value, nil

	case base.AttributeType_ATTRIBUTE_TYPE_INTEGER:
		// Create an empty protobuf Integer message
		value, err := anypb.New(&base.IntegerValue{Data: 0})
		if err != nil {
			return nil, err
		}
		return value, nil

	case base.AttributeType_ATTRIBUTE_TYPE_INTEGER_ARRAY:
		// Create an empty protobuf IntegerArray message
		value, err := anypb.New(&base.IntegerArrayValue{Data: []int32{}})
		if err != nil {
			return nil, err
		}
		return value, nil

	case base.AttributeType_ATTRIBUTE_TYPE_DOUBLE:
		// Create an empty protobuf Double message
		value, err := anypb.New(&base.DoubleValue{Data: 0.0})
		if err != nil {
			return nil, err
		}
		return value, nil

	case base.AttributeType_ATTRIBUTE_TYPE_DOUBLE_ARRAY:
		// Create an empty protobuf DoubleArray message
		value, err := anypb.New(&base.DoubleArrayValue{Data: []float64{}})
		if err != nil {
			return nil, err
		}
		return value, nil

	case base.AttributeType_ATTRIBUTE_TYPE_BOOLEAN:
		// Create an empty protobuf Boolean message with a default value of false
		value, err := anypb.New(&base.BooleanValue{Data: false})
		if err != nil {
			return nil, err
		}
		return value, nil

	case base.AttributeType_ATTRIBUTE_TYPE_BOOLEAN_ARRAY:
		// Create an empty protobuf BooleanArray message
		value, err := anypb.New(&base.BooleanArrayValue{Data: []bool{}})
		if err != nil {
			return nil, err
		}
		return value, nil

	default:
		// Handle the case where the provided attribute type is unknown
		return nil, errors.New("unknown type")
	}
}

// ConvertToAnyPB is a function to convert various basic Go types into *anypb.Any.
// It supports conversion from bool, int, float64, and string.
// It uses a type switch to detect the type of the input value.
// If the type is unsupported or unknown, it returns an error.
func ConvertToAnyPB(value interface{}) (*anypb.Any, error) {
	// anyValue will store the converted value, err will store any error occurred during conversion.
	var anyValue *anypb.Any
	var err error

	// Use a type switch to handle different types of value.
	switch v := value.(type) {
	case bool:
		anyValue, err = anypb.New(&base.BooleanValue{Data: v})
	case []bool:
		anyValue, err = anypb.New(&base.BooleanArrayValue{Data: v})
	case int:
		anyValue, err = anypb.New(&base.IntegerValue{Data: int32(v)})
	case []int32:
		anyValue, err = anypb.New(&base.IntegerArrayValue{Data: v})
	case float64:
		anyValue, err = anypb.New(&base.DoubleValue{Data: v})
	case []float64:
		anyValue, err = anypb.New(&base.DoubleArrayValue{Data: v})
	case string:
		anyValue, err = anypb.New(&base.StringValue{Data: v})
	case []string:
		anyValue, err = anypb.New(&base.StringArrayValue{Data: v})
	default:
		// In case of an unsupported or unknown type, we return an error.
		return nil, errors.New("unknown type")
	}

	// If there was an error during the conversion, return the error.
	if err != nil {
		return nil, err
	}

	// If the conversion was successful, return the converted value.
	return anyValue, nil
}

// GenerateKey function takes a PermissionCheckRequest and generates a unique key
// Key format: check|{tenant_id}|{schema_version}|{snap_token}|{context}|{entity:id#permission(optional_arguments)@subject:id#optional_relation}
func GenerateKey(key *base.PermissionCheckRequest, isRelational bool) string {
	// Initialize the parts slice with the string "check"
	parts := []string{"check"}

	// If tenantId is not empty, append it to parts
	if tenantId := key.GetTenantId(); tenantId != "" {
		parts = append(parts, tenantId)
	}

	// If Metadata exists, extract schema version and snap token and append them to parts if they are not empty
	if meta := key.GetMetadata(); meta != nil {
		if version := meta.GetSchemaVersion(); version != "" {
			parts = append(parts, version)
		}
		if token := meta.GetSnapToken(); token != "" {
			parts = append(parts, token)
		}
	}

	// If Context exists, convert it to string and append it to parts
	if ctx := key.GetContext(); ctx != nil {
		parts = append(parts, ContextToString(ctx))
	}

	if isRelation
```

### Core Architecture Module: `internal/invoke/utils.go`
```
package invoke

import (
	"errors"
	"sync/atomic"

	base "github.com/Permify/permify/pkg/pb/base/v1"
)

// checkDepth validates that the request has sufficient depth for permission checks
func checkDepth(request *base.PermissionCheckRequest) error {
	if atomic.LoadInt32(&request.GetMetadata().Depth) < 0 { // Check depth is not negative
		return errors.New(base.ErrorCode_ERROR_CODE_DEPTH_NOT_ENOUGH.String())
	}
	return nil
}

```


### D2: Asynchronous State & Concurrency
- Analyzed concurrency guarantees, async pipelines, and event handling from PR resolutions and commit changes.

### D3: Error Boundaries, Recovery & Rollbacks
- Exception handling patterns and defect resolutions extracted from closed production bug issues:
- **Issue #3216** (2026-10-02): **[BUG] Buf lint reports naming violations for existing RPC request and response types**
  *Symptoms*: **Describe the bug** Running `buf lint` reports naming and request/response uniqueness violations for several existing RPC definitions in `proto/base/v1/service.proto`.  Fixing these violations by renaming the existing protobuf message types would introduce breaking changes to generated clients and public APIs. Localized `buf:lint:ignore` comments should therefore be added to the affected RPC definitions.  **To Reproduce** Steps to reproduce the behavior:  1. Clone the repository. 2. Change to the `proto` directory. 3. Run:  ```shell buf lint ```  4. Observe errors for the following rules:  - `RPC_REQUEST_RESPONSE_UNIQUE` - `RPC_REQUEST_STANDARD_NAME` - `RPC_RESPONSE_STANDARD_NAME`  Affected RPCs include `LookupEntity`, `LookupEntityStream`, `WriteRelationships`, `ReadRelationships`, `ReadAttributes`, `DeleteRelationships`, `RunBundle`, and the `Tenancy` service RPCs.  **Example Application** The issue can be reproduced directly in this repository:  https://github.com/Permify/permify  **Expected behavior** `buf lint` should pass without requiring breaking changes to existing protobuf message names or RPC signatures.  The existing API should remain backward compatible, with narrowly scoped lint-ignore comments documenting intentional exceptions.  **Additional context** A proposed fix is available in PR #3215:  https://github.com/Permify/permify/pull/3215  The PR adds only localized lint-ignore comments and does not modify RPC behavior or generated API signatures.  **Environmen
  **Post-Mortem & Fix Analysis**:
  > Fixed in #3215. Thanks @junsazanami430u !

- **Issue #3002** (2026-07-20): **[BUG] A lot of transactions being retried**
  *Symptoms*: **Describe the bug**  In development, when I quickly add a lot of tuples to rebuild the state of my system from the ground up, I'm getting a lot of warnings:  ``` permify-565bc8487f-fpdnx permify time=2026-06-11T19:52:55.466Z level=WARN msg="serialization error occurred" tenant_id=t1 retry=2 permify-565bc8487f-fpdnx permify time=2026-06-11T19:52:55.467Z level=WARN msg="waiting before retry" tenant_id=t1 backoff_duration=110 ```  And from PostgreSQL:  ``` db-0 db 2026-06-11 19:52:55.248 UTC [38833] STATEMENT:  UPDATE relation_tuples SET expired_tx_id = $1 WHERE expired_tx_id = $2 AND tenant_id = $3 AND entity_id = $4 AND entity_type = $5 AND relation = $6 AND subject_type = $7 db-0 db 2026-06-11 19:52:55.250 UTC [38844] ERROR:  could not serialize access due to read/write dependencies among transactions db-0 db 2026-06-11 19:52:55.250 UTC [38844] DETAIL:  Reason code: Canceled on commit attempt with conflict in from prepared pivot. db-0 db 2026-06-11 19:52:55.250 UTC [38844] HINT:  The transaction might succeed if retried. db-0 db 2026-06-11 19:52:55.250 UTC [38844] STATEMENT:  commit ```  **To Reproduce** Steps to reproduce the behavior:  - Write a lot of tuples quickly. I may be able to dig in and try to create a more concise example if required, but thought I might get a little feedback first.  **Expected behavior** I understand this may be working as expected since they're being retried, but it seems to be happening quite a bit more than I would expect. (Maybe I just need 
  **Post-Mortem & Fix Analysis**:
  > Hello @wbyoung,  This can happen when tuple changes overlap concurrently. Permify uses PostgreSQL serializable transactions for data mutations, so conflicting transactions may be retried with backoff. The PostgreSQL lines shown are from different concurrent transactions. As long as the requests succeed and don’t reach max retries, there’s no data loss. The logs also produce two warnings per retry, which makes it look noisier than it is.  You can also configure retry limit using `database.max_retries`. 

- **Issue #2822** (2026-03-11): **[BUG] Healthcare Real World Example does not work**
  *Symptoms*: **Describe the bug** If you copy the schema from https://docs.permify.co/getting-started/examples/healthcare into https://play.permify.co (or into Permify running locally in Docker), it gives error: `28:20:expected token to be relation, permission, attribute, got rule instead`  **To Reproduce** As Above  **Example Application** None  **Expected behavior** No error. I'm not sure what else should happen. It's my first time trying Permify and this was the example I tried to run.  **Additional context** None.  **Environment (please complete the following information, because it helps us investigate better):**  - OS: Web  - Version The playground doesn't give its version 
  **Post-Mortem & Fix Analysis**:
  > Thanks for the report @RichardJECooke, I have updated the healthcare example.

- **Issue #2749** (2026-03-19): **[BUG] Rule's parameters must be the same name as the attributes you check against**
  *Symptoms*: **Describe the bug** If a rule is defined in a schema, the parameter(s) of that rule has to be the same name as the attribute(s) you are trying to validate with the rule. This prevents writing "helper" rules like a global negator rule.   **To Reproduce** ``` entity user {}  entity resource {     relation owner @user      attribute is_private boolean      permission view = negate(is_private) }  rule negate(input boolean){     !input } ```  **Expected behavior** Schema is valid.  **Actual** 8:31: invalid argument  **Additional context** This problem was mentioned in 2025.02.28 on Discord but I couldn't find a bug ticket for it.  **Environment (please complete the following information, because it helps us investigate better):**  - Docker  - Version 1.6.2 
  **Post-Mortem & Fix Analysis**:
  > Hi @mezakos, This is not a bug. You can use it like this:  ```  entity user {}  entity resource {     relation owner @user      attribute is_private boolean      permission view = negate(is_private) }  rule negate(is_private boolean){     !is_private } ```  https://docs.permify.co/use-cases/abac#defining-rules
  > Hi @tolgaozen , I know I can use it like that, but if I have a much bigger schema with a lot of attributes and I need to do the same checks for different attributes with different names, I have to write a rule for each of the attributes. Cemoji user on discord said: "I looked into the code and saw that at compile time when the type of the actual argument owner is validated, it looks for a formal argument with the same name. Seems to be a nice bug." And I also think this should not work the way it is. Also doesn't seem to be a large change but would make writing a schema much easier.   EDIT: I checked the documentation and it never mentions that attribute names has to be the same as parameter names in the rules
  > Hi @tolgaozen I noticed the statement,  "I checked the documentation and it never mentions that attribute names has to be the same as parameter names in the rules" from @mezakos , However, playground is throwing error, so is it bug in playground and not the schema DSL? or it is DSL limitation. Because I am also facing the same issue as @mezakos  mentioned, hence not able to re-use the rule.  

- **Issue #2745** (2026-03-23): **[BUG] Entity lookup does not take in consideration recursive permissions if the permission is based on attributes**
  *Symptoms*: **Describe the bug** Entity lookup does not take in consideration recursive permissions if the permission is based on attributes  **To Reproduce** Use the following data: ``` schema: |-   entity user {}    entity resource {       relation parent @resource       relation creator @user        attribute is_public boolean        permission view = is_public or parent.view   } relationships:   - resource:r1#parent@resource:default   - resource:r1#creator@user:u1 attributes:   - resource:default$is_public|boolean:true ```  Call: ``` curl --request POST \   --url http://localhost:3476/v1/tenants/t1/permissions/lookup-entity \   --header 'content-type: application/json' \   --data '{   "metadata":{     "snap_token": "",     "schema_version": "",     "depth": 20   },   "entity_type": "resource",   "permission": "view",   "subject": {     "type":"user",     "id":"u1"   },   "page_size": 20,   "continuous_token": "" }' ```  **Expected behavior** Returned entity ids should be be ["default", "r1"] Actual: ["default"]  **Environment (please complete the following information, because it helps us investigate better):**  - docker  - Version 1.6.2 
  **Post-Mortem & Fix Analysis**:
  > Hello @mezakos , I can reproduce this. LookupEntity misses recursive permissions when the recursion depends on attributes. For now, please use direct Check calls or avoid attribute-based recursion in the model. We aren't prioritizing a fix immediately, but we will keep this open for future review.
  > Hi @omer-topal , Thanks for the response. I further analyzed this and I came to the conclusion that if an attribute is not explicitly written, the EntityLookup will leave it out from the results. If permission check is issued for the entity, it will evaluate correctly. This is also true for recursive permissions  Example: ``` entity user {}  entity resource {     relation owner @user     attribute is_private boolean      permission view = negate(is_private) }  rule negate(is_private boolean){     !is_private } ```  resource:r1#owner@user:u1  EntityLookup will result in no data.  Add: resource:r1$is_private|boolean:false  EntityLookup returns ["r1"]
  > thanks for sharing the workaround, @mezakos !

- **Issue #2742** (2026-03-11): **[BUG] Playground won't accept rules inside an entity**
  *Symptoms*: **Describe the bug** In Playground I get an error: "expected token to be relation, permission, attribute, got rule instead" when I try to create a rule inside an entity.  **To Reproduce** Create a rule inside an entity ``` entity user {     attribute age integer      rule check_age(age integer){         age >= 18     }      permission buy_beer = check_age(age) } ```  **Expected behavior** Accept the schema as valid. In the Permify docs, in the healthcare example there is a rule inside an entity, so I'm assuming it should be valid. https://docs.permify.co/getting-started/examples/healthcare  **Environment (please complete the following information, because it helps us investigate better):**  - Permify Playground 
  **Post-Mortem & Fix Analysis**:
  > @mezakos is this replicable on the latest version of the Permify executable (1.6.2) or only in the playground?
  > @mooreds yes it is replicable with that as well (I tried using docker)
  > We did some looking and I think this is an error in the documentation that we need to fix.   As a workaround, you can move the rule outside of the entity:  ``` entity user {     attribute age integer      permission buy_beer = check_age(age) }  rule check_age(age integer){    age >= 18 } ```  I'm going to leave this open until the documentation is updated.  Thanks!

- **Issue #2735** (2026-01-21): **[BUG] Garbage Collection fails on PostgreSQL with syntax error**
  *Symptoms*: **Describe the bug** When Garbage Collection is enabled with PostgreSQL, Permify generates invalid DELETE SQL using `?` placeholders. PostgreSQL does not support `?` placeholders, which causes the Garbage Collector to fail with a SQL syntax error and prevents cleanup of expired records.  **To Reproduce**  1. Deploy Permify with a PostgreSQL database. 2. Enable garbage collection in the configuration:  ```yaml database:   engine: postgres   garbage_collection:     enabled: true     interval: 10m     window: 5m     timeout: 5m ```  3. Create relations so that expired records exist in relation_tuples. 4. Wait for the Garbage Collector to run.  PostgreSQL logs show: ``` ERROR:  syntax error at or near "AND" at character 49 STATEMENT:  DELETE FROM relation_tuples WHERE tenant_id = ? AND expired_tx_id <> ?::xid8 AND expired_tx_id < ?::xid8 ```  **Example Application** Not applicable. The issue is reproducible in a standard Permify deployment without custom application code.  **Expected behavior** Garbage Collector should generate PostgreSQL-compatible SQL using $1, $2, ... placeholders and successfully delete expired records.   **Environment (please complete the following information, because it helps us investigate better):** - OS: Linux - PostgreSQL 15.13 (Ubuntu 15.13-1.pgdg20.04+1) - Permify version: 1.6.0 
  **Post-Mortem & Fix Analysis**:
  > In `postgres.go`, the PostgreSQL statement builder is correctly initialized:  ``` pg.Builder = squirrel.StatementBuilder.PlaceholderFormat(squirrel.Dollar) ```  However, this builder is not used by the Garbage Collector.  In GC, DELETE queries are built in `utils/common.go` via: ``` func GenerateGCQueryForTenant(...) squirrel.DeleteBuilder {     deleteBuilder := squirrel.Delete(table) // default Squirrel builder     ... } ```  `squirrel.Delete(table)` creates a default Squirrel builder, which:  - always uses ? placeholders - ignores the configured PostgreSQL builder (pg.Builder)  As a result, Garbage Collector generates SQL with `?` placeholders, which is invalid for PostgreSQL.
  > /
  > Thanks for the detailed report @okrivtsov. Fixed in #2736 

- **Issue #2731** (2026-01-14): **[BUG] OpenTelemetry Tracer and Meter Not Initializing Despite Correct Configuration**
  *Symptoms*: # OpenTelemetry Tracer and Meter Not Initializing Despite Correct Configuration  ## Description  OpenTelemetry tracer and meter do not initialize in Permify v1.3.5 and v1.6.0 despite having all required configuration parameters correctly set. No traces or metrics are exported to the OTLP endpoint, and there are no initialization logs indicating OpenTelemetry is starting.  ## Environment  - **Permify Version**: v1.3.5 and v1.6.0 (tested both) - **Helm Chart Version**: 0.4.0 - **Deployment Method**: Kubernetes with Helm - **OTLP Receiver**: Datadog Agent (verified working with other services) - **Log Level**: info  ## Configuration  ### Tracer Configuration ```yaml app:   tracer:     enabled: true     exporter: otlp     endpoint: datadog.datadog.svc.cluster.local:4318     insecure: true     urlpath: /v1/traces ```  ### Meter Configuration ```yaml app:   meter:     enabled: true     exporter: otlp     endpoint: datadog.datadog.svc.cluster.local:4318     insecure: true     urlpath: /v1/metrics ```  ### Environment Variables (Verified in Running Pod) ```bash PERMIFY_TRACER_ENABLED=true PERMIFY_TRACER_EXPORTER=otlp PERMIFY_TRACER_ENDPOINT=datadog.datadog.svc.cluster.local:4318 PERMIFY_TRACER_INSECURE=true PERMIFY_TRACER_URL_PATH=/v1/traces PERMIFY_TRACER_PROTOCOL=http  # Added via extraEnvVars  PERMIFY_METER_ENABLED=true PERMIFY_METER_EXPORTER=otlp PERMIFY_METER_ENDPOINT=datadog.datadog.svc.cluster.local:4318 PERMIFY_METER_INSECURE=true PERMIFY_METER_URL_PATH=/v1/metrics PERMIFY_ME
  **Post-Mortem & Fix Analysis**:
  > looks like its resolved
  > @rhsahin can you tell us more? Was there a setting we should document better? Was it just an intermittent blip?   Thanks!

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

### Incident Patch 1: `93186e8b` (2026-10-02)
**Commit Message**: Merge pull request #3215 from junsazanami430u/fix/buf-lint-named-error

chore: ignore buf lint naming error to avoid breaking changes

**File**: `proto/base/v1/service.proto` (modified, +19/-0)
```diff
@@ -282,6 +282,7 @@ service Permission {
 
   // LookupEntity method receives a PermissionLookupEntityRequest and returns a PermissionLookupEntityResponse.
   // It is used to retrieve an entity by its identifier.
+  // buf:lint:ignore RPC_REQUEST_RESPONSE_UNIQUE
   rpc LookupEntity(PermissionLookupEntityRequest) returns (PermissionLookupEntityResponse) {
     // HTTP mapping for this method
     option (google.api.http) = {
@@ -408,6 +409,8 @@ service Permission {
 
   // LookupEntityStream method receives a PermissionLookupEntityRequest and streams a series of PermissionLookupEntityStreamResponse messages.
   // It is used to retrieve entities by their identifiers in a streaming fashion.
+  // buf:lint:ignore RPC_REQUEST_RESPONSE_UNIQUE
+  // buf:lint:ignore RPC_REQUEST_STANDARD_NAME
   rpc LookupEntityStream(PermissionLookupEntityRequest) returns (stream PermissionLookupEntityStreamResponse) {
     // HTTP mapping for this method
     option (google.api.http) = {
@@ -2125,6 +2128,8 @@ service Data {
   }
 
   // RPC method to write relationships for a tenant. This can be accessed via a POST request to the given HTTP path. It's tagged under "Data" in OpenAPI documentation.
+  // buf:lint:ignore RPC_REQUEST_STANDARD_NAME
+  // buf:lint:ignore RPC_RESPONSE_STANDARD_NAME
   rpc WriteRelationships(RelationshipWriteRequest) returns (RelationshipWriteResponse) {
     option (google.api.http) = {
       post: "/v1/tenants/{tenant_id}/relationships/write"
@@ -2139,6 +2144,8 @@ service Data {
   }
 
   // The ReadRelationships RPC method reads relation tuple(s).
+  // buf:lint:ignore RPC_REQUEST_STANDARD_NAME
+  // buf:lint:ignore RPC_RESPONSE_STANDARD_NAME
   rpc ReadRelationships(RelationshipReadRequest) returns (RelationshipReadResponse) {
     option (google.api.http) = {
       post: "/v1/tenants/{tenant_id}/data/relationships/read"
@@ -2273,6 +2280,8 @@ service Data {
   }
 
   // The ReadAttributes RPC method reads attribute(s) of a relation.
+  // buf:lint:ignore RPC_REQUEST_STANDARD_NAME
+  // buf:lint:ignore RPC_RESPONSE_STANDARD_NAME
   rpc ReadAttributes(AttributeReadRequest) returns (AttributeReadResponse) {
     option (google.api.http) = {
       post: "/v1/tenants/{tenant_id}/data/attributes/read"
@@ -2532,6 +2541,8 @@ service Data {
   }
 
   // RPC method to delete relationships for a tenant, accessed via a POST request to the specified path, tagged as "Data" in OpenAPI documentation.
+  // buf:lint:ignore RPC_REQUEST_STANDARD_NAME
+  // buf:lint:ignore RPC_RESPONSE_STANDARD_NAME
   rpc DeleteRelationships(RelationshipDeleteRequest) returns (RelationshipDeleteResponse) {
     option (google.api.http) = {
       post: "/v1/tenants/{tenant_id}/relationships/delete"
@@ -2546,6 +2557,8 @@ service Data {
   }
 
   // Executes or runs a specific bundle. This method is useful for processing or triggering actions based on the bundle's data.
+  // buf:lint:ignore RPC_REQUEST_STANDARD_NAME
+  // buf:lint:ignore RPC_RESPONSE_STANDARD_NAME
   rpc RunBundle(BundleRunRequest) returns (BundleRunResponse) {
     option (google.api.http) = {
       post: "/v1/tenants/{tenant_id}/data/run-bundle"
@@ -3357,6 +3370,8 @@ message BundleDeleteResponse {
 service Tenancy {
   // Create is a unary RPC to create a new tenant.
   // It requires a TenantCreateRequest and returns a TenantCreateResponse.
+  // buf:lint:ignore RPC_REQUEST_STANDARD_NAME
+  // buf:lint:ignore RPC_RESPONSE_STANDARD_NAME
   rpc Create(TenantCreateRequest) returns (TenantCreateResponse) {
     option (google.api.http) = {
       post: "/v1/tenants/create"
@@ -3447,6 +3462,8 @@ service Tenancy {
 
   // Delete is a unary RPC to delete an existing tenant.
   // It requires a TenantDeleteRequest and returns a TenantDeleteResponse.
+  // buf:lint:ignore RPC_REQUEST_STANDARD_NAME
+  // buf:lint:ignore RPC_RESPONSE_STANDARD_NAME
   rpc Delete(TenantDeleteRequest) returns (TenantDeleteResponse) {
     option (google.api.http) = {delete: "/v1/tenants/{id}"};
 
@@ -3525,6 +3542,8 @@ service Tenancy {
 
   // List is a unary RPC to get a list of all tenants.
   // It requires a TenantListRequest and returns a TenantListResponse.
+  // buf:lint:ignore RPC_REQUEST_STANDARD_NAME
+  // buf:lint:ignore RPC_RESPONSE_STANDARD_NAME
   rpc List(TenantListRequest) returns (TenantListResponse) {
     option (google.api.http) = {
       post: "/v1/tenants/list"
```

---

### Incident Patch 2: `1b52a203` (2026-09-17)
**Commit Message**: build(deps): bump go.opentelemetry.io/otel/exporters/zipkin

Bumps [go.opentelemetry.io/otel/exporters/zipkin](https://github.com/open-telemetry/opentelemetry-go) from 1.38.0 to 1.45.0.
- [Release notes](https://github.com/open-telemetry/opentelemetry-go/releases)
- [Changelog](https://github.com/open-telemetry/opentelemetry-go/blob/main/CHANGELOG.md)
- [Commits](https://github.com/open-telemetry/opentelemetry-go/compare/v1.38.0...v1.45.0)

---
updated-dependencies:
- dependency-name: go.opentelemetry.io/otel/exporters/zipkin
  dependency-version: 1.45.0
  dependency-type: direct:production
...

Signed-off-by: dependabot[bot] <[REDACTED_EMAIL]>

**File**: `go.mod` (modified, +1/-1)
```diff
@@ -65,7 +65,7 @@ require (
 	go.opentelemetry.io/otel/exporters/otlp/otlptrace v1.44.0
 	go.opentelemetry.io/otel/exporters/otlp/otlptrace/otlptracegrpc v1.43.0
 	go.opentelemetry.io/otel/exporters/otlp/otlptrace/otlptracehttp v1.44.0
-	go.opentelemetry.io/otel/exporters/zipkin v1.38.0
+	go.opentelemetry.io/otel/exporters/zipkin v1.45.0
 	go.opentelemetry.io/otel/metric v1.46.0
 	go.opentelemetry.io/otel/sdk v1.46.0
 	go.opentelemetry.io/otel/sdk/metric v1.46.0
```

**File**: `go.sum` (modified, +2/-2)
```diff
@@ -957,8 +957,8 @@ go.opentelemetry.io/otel/exporters/otlp/otlptrace/otlptracegrpc v1.43.0 h1:RAE+J
 go.opentelemetry.io/otel/exporters/otlp/otlptrace/otlptracegrpc v1.43.0/go.mod h1:AGmbycVGEsRx9mXMZ75CsOyhSP6MFIcj/6dnG+vhVjk=
 go.opentelemetry.io/otel/exporters/otlp/otlptrace/otlptracehttp v1.44.0 h1:lgh3PiVrRUWMLOVSkQicxzZll5NjF1r+AtsX1XRIHw0=
 go.opentelemetry.io/otel/exporters/otlp/otlptrace/otlptracehttp v1.44.0/go.mod h1:5Cnhth3m/AgOeTgE3ex12pPmiu/gGtZit03kSzx9X7s=
-go.opentelemetry.io/otel/exporters/zipkin v1.38.0 h1:0rJ2TmzpHDG+Ib9gPmu3J3cE0zXirumQcKS4wCoZUa0=
-go.opentelemetry.io/otel/exporters/zipkin v1.38.0/go.mod h1:Su/nq/K5zRjDKKC3Il0xbViE3juWgG3JDoqLumFx5G0=
+go.opentelemetry.io/otel/exporters/zipkin v1.45.0 h1:KN3btaILMTxR4QDHVGAO87lq5ButzK7l+kIfLuxQ1oA=
+go.opentelemetry.io/otel/exporters/zipkin v1.45.0/go.mod h1:yNcodmUclM4InyWoOwX/YW4Jri0Gj5FWAlM+NqCrtqY=
 go.opentelemetry.io/otel/metric v1.46.0 h1:yBnkXvgV7AXFILZc5K6IZe/CBFF3OS7BJ8ov6/lj0K8=
 go.opentelemetry.io/otel/metric v1.46.0/go.mod h1:iPmdWqifKUdzziPkvvzIJXITl56fQx2mGM/DHLB3/2o=
 go.opentelemetry.io/otel/metric/x v0.68.0 h1:TA/cBT23D3MnxYPwHL7YFOdYGdx0A0v+s7Mzotpd1dU=
```

---

### Incident Patch 3: `7529af58` (2026-09-11)
**Commit Message**: Merge pull request #3204 from Permify/fix-playground-enforcement-tab

fix: playground enforcement tab

**File**: `playground/src/features/enforcement/enforcement.jsx` (modified, +16/-1)
```diff
@@ -11,6 +11,9 @@ function Enforcement() {
     const [yamlData, setYamlData] = useState("");
 
     const handleYamlChange = (newCode) => {
+        // While typing the editor text is the source of truth, so keep it as it is
+        // and only feed the parsed result into the store.
+        setYamlData(newCode);
         try {
             const updatedData = yaml.load(newCode);
             setScenarios(updatedData);
@@ -20,7 +23,19 @@ function Enforcement() {
     };
 
     useEffect(() => {
-        setYamlData(dump(scenarios))
+        const dumped = dump(scenarios);
+        setYamlData((current) => {
+            try {
+                if (dump(yaml.load(current)) === dumped) {
+                    return current;
+                }
+            } catch (error) {
+                // Not valid YAML yet, the user is still typing it.
+                return current;
+            }
+            // The scenarios changed outside of the editor (example, import, new scenario).
+            return dumped;
+        });
     }, [scenarios]);
 
     return (
```

---

### Incident Patch 4: `8b7e0c74` (2026-09-11)
**Commit Message**: fix playground enforcement tab

**File**: `playground/src/features/enforcement/enforcement.jsx` (modified, +16/-1)
```diff
@@ -11,6 +11,9 @@ function Enforcement() {
     const [yamlData, setYamlData] = useState("");
 
     const handleYamlChange = (newCode) => {
+        // While typing the editor text is the source of truth, so keep it as it is
+        // and only feed the parsed result into the store.
+        setYamlData(newCode);
         try {
             const updatedData = yaml.load(newCode);
             setScenarios(updatedData);
@@ -20,7 +23,19 @@ function Enforcement() {
     };
 
     useEffect(() => {
-        setYamlData(dump(scenarios))
+        const dumped = dump(scenarios);
+        setYamlData((current) => {
+            try {
+                if (dump(yaml.load(current)) === dumped) {
+                    return current;
+                }
+            } catch (error) {
+                // Not valid YAML yet, the user is still typing it.
+                return current;
+            }
+            // The scenarios changed outside of the editor (example, import, new scenario).
+            return dumped;
+        });
     }, [scenarios]);
 
     return (
```

---

### Incident Patch 5: `968ab178` (2026-09-10)
**Commit Message**: Merge pull request #3149 from Permify/dependabot/go_modules/sdk/go/grpc/buf.build/gen/go/permifyco/permify/protocolbuffers/go-1.36.12-20260417170026-08b37474f24f.2

build(deps): bump buf.build/gen/go/permifyco/permify/protocolbuffers/go from 1.36.12-20260417170026-08b37474f24f.1 to 1.36.12-20260417170026-08b37474f24f.2 in /sdk/go/grpc

**File**: `sdk/go/grpc/go.mod` (modified, +3/-3)
```diff
@@ -3,14 +3,14 @@ module main
 go 1.25.7
 
 require (
-	buf.build/gen/go/permifyco/permify/protocolbuffers/go v1.36.12-20260417170026-08b37474f24f.1
+	buf.build/gen/go/permifyco/permify/protocolbuffers/go v1.36.12-20260417170026-08b37474f24f.2
 	github.com/Permify/permify-go v0.6.0
 	google.golang.org/grpc v1.83.2
 )
 
 require (
-	buf.build/gen/go/envoyproxy/protoc-gen-validate/protocolbuffers/go v1.36.12-20240617172848-daf171c6cdb5.1 // indirect
-	buf.build/gen/go/grpc-ecosystem/grpc-gateway/protocolbuffers/go v1.36.12-20241220201140-4c5ba75caaf8.1 // indirect
+	buf.build/gen/go/envoyproxy/protoc-gen-validate/protocolbuffers/go v1.36.12-20240617172848-daf171c6cdb5.2 // indirect
+	buf.build/gen/go/grpc-ecosystem/grpc-gateway/protocolbuffers/go v1.36.12-20241220201140-4c5ba75caaf8.2 // indirect
 	buf.build/gen/go/permifyco/permify/grpc/go v1.6.1-20260417170026-08b37474f24f.1 // indirect
 	golang.org/x/net v0.58.0 // indirect
 	golang.org/x/sys v0.47.0 // indirect
```

**File**: `sdk/go/grpc/go.sum` (modified, +6/-6)
```diff
@@ -1,11 +1,11 @@
-buf.build/gen/go/envoyproxy/protoc-gen-validate/protocolbuffers/go v1.36.12-20240617172848-daf171c6cdb5.1 h1:n2M6Ko1hTXHNTRfYXFIbP1kE74XpJc6dY6psur6iuhA=
-buf.build/gen/go/envoyproxy/protoc-gen-validate/protocolbuffers/go v1.36.12-20240617172848-daf171c6cdb5.1/go.mod h1:uEYtK5SFuNw1hJkqTKEXvvbUyWwTBlTRj42alVWbe6M=
-buf.build/gen/go/grpc-ecosystem/grpc-gateway/protocolbuffers/go v1.36.12-20241220201140-4c5ba75caaf8.1 h1:tUdD9w+8U70KRudIRO4Ass2S8mSB6P+0QmrrlmqlpDY=
-buf.build/gen/go/grpc-ecosystem/grpc-gateway/protocolbuffers/go v1.36.12-20241220201140-4c5ba75caaf8.1/go.mod h1:tGHWROdiYQqFpI6EFJWW82Kfbg58TqH2EGNbkGajR0E=
+buf.build/gen/go/envoyproxy/protoc-gen-validate/protocolbuffers/go v1.36.12-20240617172848-daf171c6cdb5.2 h1:Z/mX4IRvRVjjBx45fo9cV8prOGbFZvmIjhA06txbuMI=
+buf.build/gen/go/envoyproxy/protoc-gen-validate/protocolbuffers/go v1.36.12-20240617172848-daf171c6cdb5.2/go.mod h1:uEYtK5SFuNw1hJkqTKEXvvbUyWwTBlTRj42alVWbe6M=
+buf.build/gen/go/grpc-ecosystem/grpc-gateway/protocolbuffers/go v1.36.12-20241220201140-4c5ba75caaf8.2 h1:ESTAICuabdVu0hN+z06qMtr07mETtGjaEiNUco0RnmI=
+buf.build/gen/go/grpc-ecosystem/grpc-gateway/protocolbuffers/go v1.36.12-20241220201140-4c5ba75caaf8.2/go.mod h1:tGHWROdiYQqFpI6EFJWW82Kfbg58TqH2EGNbkGajR0E=
 buf.build/gen/go/permifyco/permify/grpc/go v1.6.1-20260417170026-08b37474f24f.1 h1:J2PPCGs5mDUnUqowZh+y5IHCaCMwVKpBiK7yptuaMEA=
 buf.build/gen/go/permifyco/permify/grpc/go v1.6.1-20260417170026-08b37474f24f.1/go.mod h1:w0pZ0AJzhN6h4WS9+JLVwbV8xP3BAayjvxTutZWhixA=
-buf.build/gen/go/permifyco/permify/protocolbuffers/go v1.36.12-20260417170026-08b37474f24f.1 h1:+LUHW8/UcJZJRZF5Pye6lo36fkQy5nksS6LcekL2+1c=
-buf.build/gen/go/permifyco/permify/protocolbuffers/go v1.36.12-20260417170026-08b37474f24f.1/go.mod h1:0kI/b+eCC1sS5/Iql7Ayx+IOhhn9dIxgIf1dhaKP55A=
+buf.build/gen/go/permifyco/permify/protocolbuffers/go v1.36.12-20260417170026-08b37474f24f.2 h1:fdhEVXfxg9E0PbdZBhyL/haU4l1vbng0EMcmDBO3M6s=
+buf.build/gen/go/permifyco/permify/protocolbuffers/go v1.36.12-20260417170026-08b37474f24f.2/go.mod h1:cD8ToRjMdTqsJ0aPCjJB9x2bwhEw9r83JVieMfsxJZk=
 github.com/Permify/permify-go v0.6.0 h1:j/WjqL2hnlNYgyuFzhHr3lwcUu7yC41A5a80x9WRouc=
 github.com/Permify/permify-go v0.6.0/go.mod h1:OikAZdnEYuNvxYUNERxmB0+8hQE+RA/K6vgFOJbem8M=
 github.com/cespare/xxhash/v2 v2.3.0 h1:UL815xU9SqsFlibzuggzjXhog7bL6oX9BbNZnL2UFvs=
```

---

### Incident Patch 6: `7c136a58` (2026-09-10)
**Commit Message**: build(deps-dev): bump jsdom from 26.1.0 to 30.0.1 in /playground

Bumps [jsdom](https://github.com/jsdom/jsdom) from 26.1.0 to 30.0.1.
- [Release notes](https://github.com/jsdom/jsdom/releases)
- [Commits](https://github.com/jsdom/jsdom/compare/v26.1.0...v30.0.1)

---
updated-dependencies:
- dependency-name: jsdom
  dependency-version: 30.0.1
  dependency-type: direct:development
  update-type: version-update:semver-major
...

Signed-off-by: dependabot[bot] <[REDACTED_EMAIL]>

**File**: `playground/package.json` (modified, +1/-1)
```diff
@@ -48,7 +48,7 @@
     "@vitejs/plugin-react": "^5.1.0",
     "eslint-import-resolver-alias": "^1.1.2",
     "eslint-plugin-import": "^2.29.1",
-    "jsdom": "^26.1.0",
+    "jsdom": "^30.0.1",
     "less": "^4.8.1",
     "typescript": "^7.0.2",
     "vite": "^8.0.16",
```

**File**: `playground/yarn.lock` (modified, +184/-167)
```diff
@@ -66,16 +66,26 @@
     json2mq "^0.2.0"
     throttle-debounce "^5.0.0"
 
-"@asamuzakjp/css-color@^3.2.0":
-  version "3.2.0"
-  resolved "https://registry.npmjs.org/@asamuzakjp/css-color/-/css-color-3.2.0.tgz#cc42f5b85c593f79f1fa4f25d2b9b321e61d1794"
-  integrity sha512-K1A6z8tS3XsmCMM86xoWdn7Fkdn9m6RSVtocUrJYIwZnFVkng/PvkEoWtOWmP+Scc6saYWHWZYbndEEXxl24jw==
-  dependencies:
-    "@csstools/css-calc" "^2.1.3"
-    "@csstools/css-color-parser" "^3.0.9"
-    "@csstools/css-parser-algorithms" "^3.0.4"
-    "@csstools/css-tokenizer" "^3.0.3"
-    lru-cache "^10.4.3"
+"@asamuzakjp/css-color@^6.0.5":
+  version "6.0.7"
+  resolved "https://registry.yarnpkg.com/@asamuzakjp/css-color/-/css-color-6.0.7.tgz#8f9f67452e6636930949abe047dd553b13276939"
+  integrity sha512-vC/bk1Lz7Tn/EfU9/apOTBk80/8dyGyWMowPoV1tJ52muDGsDqt2HPT2klrFUiY60MQmQv9q8yIht15JnBgDGw==
+  dependencies:
+    "@csstools/css-calc" "^3.3.0"
+    "@csstools/css-color-parser" "^4.1.10"
+    "@csstools/css-parser-algorithms" "^4.0.0"
+    "@csstools/css-tokenizer" "^4.0.0"
+    lru-cache "^11.5.2"
+
+"@asamuzakjp/dom-selector@^8.3.0":
+  version "8.3.2"
+  resolved "https://registry.yarnpkg.com/@asamuzakjp/dom-selector/-/dom-selector-8.3.2.tgz#1e84c1ea1e12a921c1aa94da4b1f657168f09596"
+  integrity sha512-93Z1N+BQNXysodoicpOIyNh2drHfz/CTf9nnT0FEx72GJcIiwgydD7tGAr78j41LsYn3hlRn+LdGPuBLn1Bl8Q==
+  dependencies:
+    bidi-js "^1.0.3"
+    css-tree "^3.2.1"
+    is-potential-custom-element-name "^1.0.1"
+    lru-cache "^11.5.2"
 
 "@babel/code-frame@^7.29.7":
   version "7.29.7"
@@ -265,33 +275,45 @@
     "@babel/helper-string-parser" "^7.29.7"
     "@babel/helper-validator-identifier" "^7.29.7"
 
-"@csstools/color-helpers@^5.1.0":
-  version "5.1.0"
-  resolved "https://registry.npmjs.org/@csstools/color-helpers/-/color-helpers-5.1.0.tgz#106c54c808cabfd1ab4c602d8505ee584c2996ef"
-  integrity sha512-S11EXWJyy0Mz5SYvRmY8nJYTFFd1LCNV+7cXyAgQtOOuzb4EsgfqDufL+9esx72/eLhsRdGZwaldu/h+E4t4BA==
+"@bramus/specificity@^2.4.2":
+  version "2.4.2"
+  resolved "https://registry.yarnpkg.com/@bramus/specificity/-/specificity-2.4.2.tgz#aa8db8eb173fdee7324f82284833106adeecc648"
+  integrity sha512-ctxtJ/eA+t+6q2++vj5j7FYX3nRu311q1wfYH3xjlLOsczhlhxAg2FWNUXhpGvAw3BWo1xBcvOV6/YLc2r5FJw==
+  dependencies:
+    css-tree "^3.0.0"
+
+"@csstools/color-helpers@^6.1.1":
+  version "6.1.1"
+  resolved "https://registry.yarnpkg.com/@csstools/color-helpers/-/color-helpers-6.1.1.tgz#1890f29a4347486b54048d24c6ab8fbef039ee61"
+  integrity sha512-gLNsunvwf3mCi5u5o46/Z/JcJMnhbHSaZ69rkgPzNM3J4s8hWwpPUQB6/tt0EDFyCiWzxANlx+2LJwpYj4zS1w==
 
-"@csstools/css-calc@^2.1.3", "@csstools/css-calc@^2.1.4":
-  version "2.1.4"
-  resolved "https://registry.npmjs.org/@csstools/css-calc/-/css-calc-2.1.4.tgz#8473f63e2fcd6e459838dd412401d5948f224c65"
-  integrity sha512-3N8oaj+0juUw/1H3YwmDDJXCgTB1gKU6Hc/bB502u9zR0q2vd786XJH9QfrKIEgFlZmhZiq6epXl4rHqhzsIgQ==
+"@csstools/css-calc@^3.3.0":
+  version "3.3.0"
+  resolved "https://registry.yarnpkg.com/@csstools/css-calc/-/css-calc-3.3.0.tgz#33cc4bdbab8edf1b6e3ab8c1eba849c41a324f1a"
+  integrity sha512-c5ihYsPkdG6JCkU2zTMm4+k6r7RXuGxtWYhu5DHMIiF1FHzrfmHL5so11AoFpUv/tu61xfcmT4AmKoFfMPoqdQ==
 
-"@csstools/css-color-parser@^3.0.9":
-  version "3.1.0"
-  resolved "https://registry.npmjs.org/@csstools/css-color-parser/-/css-color-parser-3.1.0.tgz#4e386af3a99dd36c46fef013cfe4c1c341eed6f0"
-  integrity sha512-nbtKwh3a6xNVIp/VRuXV64yTKnb1IjTAEEh3irzS+HkKjAOYLTGNb9pmVNntZ8iVBHcWDA2Dof0QtPgFI1BaTA==
+"@csstools/css-color-parser@^4.1.10":
+  version "4.2.2"
+  resolved "https://registry.yarnpkg.com/@csstools/css-color-parser/-/css-color-parser-4.2.2.tgz#f590bc710a26914dbe64c4656813eafc93f4e45e"
+  integrity sha512-3QKjR/vxyjcSXBLgb6lP0S3MGdvwbmqSsvLPbYdVORqPDc8FX1HAJ0Spk38bxaRXgvENTA47tlhhbb5Z2e8hEg==
   dependencies:
-    "@csstools/color-helpers" "^5.1.0"
-    "@csstools/css-calc" "^2.1.4"
+    "@csstools/color-helpers" "^6.1.1"
+    "@csstools/css-calc" "^3.3.0"
 
-"@csstools/css-parser-algorithms@^3.0.4":
-  version "3.0.5"
-  resolved "https://registry.npmjs.org/@csstools/css-parser-algorithms/-/css-parser-algorithms-3.0.5.tgz#5755370a9a29abaec5515b43c8b3f2cf9c2e3076"
-  integrity sha512-DaDeUkXZKjdGhgYaHNJTV9pV7Y9B3b644jCLs9Upc3VeNGg6LWARAT6O+Q+/COo+2gg/bM5rhpMAtf70WqfBdQ==
+"@csstools/css-parser-algorithms@^4.0.0":
+  version "4.0.0"
+  resolved "https://registry.yarnpkg.com/@csstools/css-parser-algorithms/-/css-parser-algorithms-4.0.0.tgz#e1c65dc09378b42f26a111fca7f7075fc2c26164"
+  integrity sha512-+B87qS7fIG3L5h3qwJ/IFbjoVoOe/bpOdh9hAjXbvx0o8ImEmUsGXN0inFOnk2ChCFgqkkGFQ+TpM5rbhkKe4w==
 
-"@csstools/css-tokenizer@^3.0.3":
-  version "3.0.4"
-  resolved "https://registry.npmjs.org/@csstools/css-tokenizer/-/css-tokenizer-3.0.4.tgz#333fedabc3fd1a8e5d0100013731cf19e6a8c5d3"
-  integrity sha512-Vd/9EVDiu6PPJt9yAh6roZP6El1xHrdvIVGjyBsHR0RYwNHgL7FJPyIIW4fANJNG6FtyZfvlRPpFI4ZM/lubvw==
+"@csstools/css-syntax-patches-for-csstree@^1.1.7":
+  version "1.1.12"
+  resolved "https:
```

---

### Incident Patch 7: `58f49abb` (2026-09-10)
**Commit Message**: build(deps): bump go.opentelemetry.io/otel/sdk from 1.44.0 to 1.46.0

Bumps [go.opentelemetry.io/otel/sdk](https://github.com/open-telemetry/opentelemetry-go) from 1.44.0 to 1.46.0.
- [Release notes](https://github.com/open-telemetry/opentelemetry-go/releases)
- [Changelog](https://github.com/open-telemetry/opentelemetry-go/blob/main/CHANGELOG.md)
- [Commits](https://github.com/open-telemetry/opentelemetry-go/compare/v1.44.0...v1.46.0)

---
updated-dependencies:
- dependency-name: go.opentelemetry.io/otel/sdk
  dependency-version: 1.46.0
  dependency-type: direct:production
  update-type: version-update:semver-minor
...

Signed-off-by: dependabot[bot] <[REDACTED_EMAIL]>

**File**: `go.mod` (modified, +8/-10)
```diff
@@ -52,24 +52,24 @@ require (
 	github.com/sony/gobreaker v1.0.0
 	github.com/spf13/cobra v1.10.2
 	github.com/spf13/viper v1.21.0
-	github.com/stretchr/testify v1.11.1
+	github.com/stretchr/testify v1.12.1
 	github.com/testcontainers/testcontainers-go v0.42.0
 	go.opentelemetry.io/contrib/instrumentation/google.golang.org/grpc/otelgrpc v0.69.0
 	go.opentelemetry.io/contrib/instrumentation/host v0.65.0
 	go.opentelemetry.io/contrib/instrumentation/net/http/otelhttp v0.69.0
 	go.opentelemetry.io/contrib/instrumentation/runtime v0.69.0
-	go.opentelemetry.io/otel v1.44.0
+	go.opentelemetry.io/otel v1.46.0
 	go.opentelemetry.io/otel/exporters/jaeger v1.17.0
 	go.opentelemetry.io/otel/exporters/otlp/otlpmetric/otlpmetricgrpc v1.44.0
 	go.opentelemetry.io/otel/exporters/otlp/otlpmetric/otlpmetrichttp v1.43.0
 	go.opentelemetry.io/otel/exporters/otlp/otlptrace v1.44.0
 	go.opentelemetry.io/otel/exporters/otlp/otlptrace/otlptracegrpc v1.43.0
 	go.opentelemetry.io/otel/exporters/otlp/otlptrace/otlptracehttp v1.44.0
 	go.opentelemetry.io/otel/exporters/zipkin v1.38.0
-	go.opentelemetry.io/otel/metric v1.44.0
-	go.opentelemetry.io/otel/sdk v1.44.0
-	go.opentelemetry.io/otel/sdk/metric v1.44.0
-	go.opentelemetry.io/otel/trace v1.44.0
+	go.opentelemetry.io/otel/metric v1.46.0
+	go.opentelemetry.io/otel/sdk v1.46.0
+	go.opentelemetry.io/otel/sdk/metric v1.46.0
+	go.opentelemetry.io/otel/trace v1.46.0
 	golang.org/x/exp v0.0.0-20251002181428-27f1f14c8bb9
 	golang.org/x/net v0.58.0 // indirect
 	golang.org/x/sync v0.22.0
@@ -324,7 +324,7 @@ require (
 	go.opentelemetry.io/auto/sdk v1.2.1 // indirect
 	go.uber.org/automaxprocs v1.6.0 // indirect
 	go.uber.org/zap v1.27.0 // indirect
-	go.yaml.in/yaml/v3 v3.0.4
+	go.yaml.in/yaml/v3 v3.0.5
 	golang.org/x/exp/typeparams v0.0.0-20250911091902-df9299821621 // indirect
 	golang.org/x/mod v0.38.0 // indirect
 	golang.org/x/oauth2 v0.36.0 // indirect
@@ -352,12 +352,11 @@ require (
 	github.com/beorn7/perks v1.0.1 // indirect
 	github.com/containerd/log v0.1.0 // indirect
 	github.com/cpuguy83/dockercfg v0.3.2 // indirect
-	github.com/davecgh/go-spew v1.1.2-0.20180830191138-d8f796af33cc // indirect
 	github.com/docker/docker v28.5.1+incompatible // indirect
 	github.com/docker/go-connections v0.6.0 // indirect
 	github.com/docker/go-units v0.5.0 // indirect
 	github.com/fsnotify/fsnotify v1.9.0 // indirect
-	github.com/go-logr/logr v1.4.3 // indirect
+	github.com/go-logr/logr v1.4.4 // indirect
 	github.com/go-logr/stdr v1.2.2 // indirect
 	github.com/go-ole/go-ole v1.3.0 // indirect
 	github.com/google/go-cmp v0.7.0 // indirect
@@ -387,7 +386,6 @@ require (
 	github.com/opencontainers/image-spec v1.1.1 // indirect
 	github.com/openzipkin/zipkin-go v0.4.3 // indirect
 	github.com/pelletier/go-toml/v2 v2.2.4 // indirect
-	github.com/pmezard/go-difflib v1.0.1-0.20181226105442-5d4384ee4fb2 // indirect
 	github.com/power-devops/perfstat v0.0.0-20240221224432-82ca36839d55 // indirect
 	github.com/prometheus/client_golang v1.20.3 // indirect
 	github.com/prometheus/client_model v0.6.2 // indirect
```

**File**: `go.sum` (modified, +18/-21)
```diff
@@ -224,8 +224,6 @@ github.com/dave/jennifer v1.7.1 h1:B4jJJDHelWcDhlRQxWeo0Npa/pYKBLrirAQoTN45txo=
 github.com/dave/jennifer v1.7.1/go.mod h1:nXbxhEmQfOZhWml3D1cDK5M1FLnMSozpbFN/m3RmGZc=
 github.com/davecgh/go-spew v1.1.0/go.mod h1:J7Y8YcW2NihsgmVo/mv3lAwl/skON4iLHjSsI+c5H38=
 github.com/davecgh/go-spew v1.1.1/go.mod h1:J7Y8YcW2NihsgmVo/mv3lAwl/skON4iLHjSsI+c5H38=
-github.com/davecgh/go-spew v1.1.2-0.20180830191138-d8f796af33cc h1:U9qPSI2PIWSS1VwoXQT9A3Wy9MM3WgvqSxFWenqJduM=
-github.com/davecgh/go-spew v1.1.2-0.20180830191138-d8f796af33cc/go.mod h1:J7Y8YcW2NihsgmVo/mv3lAwl/skON4iLHjSsI+c5H38=
 github.com/decred/dcrd/dcrec/secp256k1/v4 v4.4.0 h1:NMZiJj8QnKe1LgsbDayM4UoHwbvwDRwnI3hwNaAHRnc=
 github.com/decred/dcrd/dcrec/secp256k1/v4 v4.4.0/go.mod h1:ZXNYxsqcloTdSy/rNShjYzMhyjf0LaoftYK0p+A3h40=
 github.com/denis-tingaikin/go-header v0.5.0 h1:SRdnP5ZKvcO9KKRP1KJrhFR3RrlGuD+42t4429eC9k8=
@@ -298,8 +296,8 @@ github.com/go-jose/go-jose/v3 v3.0.5/go.mod h1:5b+7YgP7ZICgJDBdfjZaIt+H/9L9T/YQr
 github.com/go-kit/log v0.1.0/go.mod h1:zbhenjAZHb184qTLMA9ZjW7ThYL0H2mk7Q6pNt4vbaY=
 github.com/go-logfmt/logfmt v0.5.0/go.mod h1:wCYkCAKZfumFQihp8CzCvQ3paCTfi41vtzG1KdI/P7A=
 github.com/go-logr/logr v1.2.2/go.mod h1:jdQByPbusPIv2/zmleS9BjJVeZ6kBagPoEUsqbVz/1A=
-github.com/go-logr/logr v1.4.3 h1:CjnDlHq8ikf6E492q6eKboGOC0T8CDaOvkHCIg8idEI=
-github.com/go-logr/logr v1.4.3/go.mod h1:9T104GzyrTigFIr8wt5mBrctHMim0Nb2HLGrmQ40KvY=
+github.com/go-logr/logr v1.4.4 h1:tG4xh9yMsRCAiodLVTxyrkzSZ9+o0L1Kg/+cPVcbP/8=
+github.com/go-logr/logr v1.4.4/go.mod h1:9T104GzyrTigFIr8wt5mBrctHMim0Nb2HLGrmQ40KvY=
 github.com/go-logr/stdr v1.2.2 h1:hSWxHoqTgW2S2qGc0LTAI563KZ5YKYRhT3MFKZMbjag=
 github.com/go-logr/stdr v1.2.2/go.mod h1:mMo/vtBO5dYbehREoey6XUKy/eSumjCCveDpRre4VKE=
 github.com/go-ole/go-ole v1.2.6/go.mod h1:pprOEPIfldk/42T2oK7lQ4v4JSDwmV0As9GaiUsvbm0=
@@ -715,8 +713,6 @@ github.com/pkg/errors v0.9.1/go.mod h1:bwawxfHBFNV+L2hUp1rHADufV3IMtnDRdf1r5NINE
 github.com/planetscale/vtprotobuf v0.6.1-0.20240319094008-0393e58bdf10 h1:GFCKgmp0tecUJ0sJuv4pzYCqS9+RGSn52M3FUwPs+uo=
 github.com/planetscale/vtprotobuf v0.6.1-0.20240319094008-0393e58bdf10/go.mod h1:t/avpk3KcrXxUnYOhZhMXJlSEyie6gQbtLq5NM3loB8=
 github.com/pmezard/go-difflib v1.0.0/go.mod h1:iKH77koFhYxTK1pcRnkKkqfTogsbg7gZNVY4sRDYZ/4=
-github.com/pmezard/go-difflib v1.0.1-0.20181226105442-5d4384ee4fb2 h1:Jamvg5psRIccs7FGNTlIRMkT8wgtp5eCXdBlqhYGL6U=
-github.com/pmezard/go-difflib v1.0.1-0.20181226105442-5d4384ee4fb2/go.mod h1:iKH77koFhYxTK1pcRnkKkqfTogsbg7gZNVY4sRDYZ/4=
 github.com/polyfloyd/go-errorlint v1.8.0 h1:DL4RestQqRLr8U4LygLw8g2DX6RN1eBJOpa2mzsrl1Q=
 github.com/polyfloyd/go-errorlint v1.8.0/go.mod h1:G2W0Q5roxbLCt0ZQbdoxQxXktTjwNyDbEaj3n7jvl4s=
 github.com/power-devops/perfstat v0.0.0-20240221224432-82ca36839d55 h1:o4JXh1EVt9k/+g42oCprj/FisM4qX9L3sZB3upGN2ZU=
@@ -851,8 +847,8 @@ github.com/stretchr/testify v1.7.0/go.mod h1:6Fq8oRcR53rry900zMqJjRRixrwX3KX962/
 github.com/stretchr/testify v1.7.1/go.mod h1:6Fq8oRcR53rry900zMqJjRRixrwX3KX962/h/Wwjteg=
 github.com/stretchr/testify v1.8.0/go.mod h1:yNjHg4UonilssWZ8iaSj1OCr/vHnekPRkoO+kdMU+MU=
 github.com/stretchr/testify v1.8.1/go.mod h1:w2LPCIKwWwSfY2zedu0+kehJoqGctiVI29o6fzry7u4=
-github.com/stretchr/testify v1.11.1 h1:7s2iGBzp5EwR7/aIZr8ao5+dra3wiQyKjjFuvgVKu7U=
-github.com/stretchr/testify v1.11.1/go.mod h1:wZwfW3scLgRK+23gO65QZefKpKQRnfz6sD981Nm4B6U=
+github.com/stretchr/testify v1.12.1 h1:EuwCh5fleGS7H32xRwO3wRGT7DxrDhLAT6FF8MpWDWE=
+github.com/stretchr/testify v1.12.1/go.mod h1:MDEgiDPPsNp5cuIrHPPCyornHKgEVbtFUmoNlxoYthg=
 github.com/subosito/gotenv v1.6.0 h1:9NlTDc1FTs4qu0DDq7AEtTPNw6SVm7uBMsUCUjABIf8=
 github.com/subosito/gotenv v1.6.0/go.mod h1:Dk4QP5c2W3ibzajGcXpNraDfq2IrhjMIvMSWPKKo0FU=
 github.com/tenntenn/modver v1.0.1 h1:2klLppGhDgzJrScMpkj9Ujy3rXPUspSjAcev9tSEBgA=
@@ -947,8 +943,8 @@ go.opentelemetry.io/contrib/instrumentation/net/http/otelhttp v0.69.0 h1:8tvICD4
 go.opentelemetry.io/contrib/instrumentation/net/http/otelhttp v0.69.0/go.mod h1:z9+yiacE0IHRqM4qFfkbt/JYlmYXgss8GY/jXoNuPJI=
 go.opentelemetry.io/contrib/instrumentation/runtime v0.69.0 h1:MtkMsuRo3zEXTTMALfyrszwCDZTkB6wolyPjbwFAdq0=
 go.opentelemetry.io/contrib/instrumentation/runtime v0.69.0/go.mod h1:FYTxnpsm+UPD0erZNq20GvnM8T2YQHiHtT2vokdpoac=
-go.opentelemetry.io/otel v1.44.0 h1:JjwHmHpA4iZ3wBxluu2fbbE7j4kqlE8jXyAyPXH7HqU=
-go.opentelemetry.io/otel v1.44.0/go.mod h1:BMgjTHL9WPRlRjL2oZCBTL4whCGtXch2H4BhOPIAyYc=
+go.opentelemetry.io/otel v1.46.0 h1:FHt5/CDyVxi/8IM1CH7VE/rRgq3kLHa2mSTVMO8AWyc=
+go.opentelemetry.io/otel v1.46.0/go.mod h1:Gj3SEScelsNC45tp4nSxRYlS+f5iez7W8XPMCt905kE=
 go.opentelemetry.io/otel/exporters/jaeger v1.17.0 h1:D7UpUy2Xc2wsi1Ras6V40q806WM07rqoCWzXu7Sqy+4=
 go.opentelemetry.io/otel/exporters/jaeger v1.17.0/go.mod h1:nPCqOnEH9rNLKqH/+rrUjiMzHJdV1BlpKcTwRTyKkKI=
 go.opentelemetry.io/otel/exporters/otlp/otlpmetric/otlpmetricgrpc v1.44.0 h1:SUplec5dp06reu1zaXmOXdvqH398taqrDXqUl99jxSc=
@@ -963,16 +959,16 @@ go.opentelemetry.io/otel/exporters/otl
```

---

### Incident Patch 8: `fbfe1d19` (2026-09-10)
**Commit Message**: build(deps-dev): bump typescript from 6.0.2 to 7.0.2 in /playground

Bumps [typescript](https://github.com/microsoft/TypeScript) from 6.0.2 to 7.0.2.
- [Release notes](https://github.com/microsoft/TypeScript/releases)
- [Commits](https://github.com/microsoft/TypeScript/compare/v6.0.2...v7.0.2)

---
updated-dependencies:
- dependency-name: typescript
  dependency-version: 7.0.2
  dependency-type: direct:development
  update-type: version-update:semver-major
...

Signed-off-by: dependabot[bot] <[REDACTED_EMAIL]>

**File**: `playground/package.json` (modified, +1/-1)
```diff
@@ -50,7 +50,7 @@
     "eslint-plugin-import": "^2.29.1",
     "jsdom": "^26.1.0",
     "less": "^4.8.1",
-    "typescript": "^6.0.2",
+    "typescript": "^7.0.2",
     "vite": "^8.0.16",
     "vite-tsconfig-paths": "^6.1.1",
     "vitest": "^4.1.11"
```

**File**: `playground/yarn.lock` (modified, +125/-4)
```diff
@@ -1005,6 +1005,106 @@
   resolved "https://registry.npmjs.org/@types/trusted-types/-/trusted-types-2.0.7.tgz#baccb07a970b91707df3a3e8ba6896c57ead2d11"
   integrity sha512-ScaPdn1dQczgbl0QFTeTOmVHFULt394XJgOQNoyVhZ6r2vLnMLJfBPd53SB52T/3G36VI1/g2MZaX0cwDuXsfw==
 
+"@typescript/typescript-aix-ppc64@7.0.2":
+  version "7.0.2"
+  resolved "https://registry.yarnpkg.com/@typescript/typescript-aix-ppc64/-/typescript-aix-ppc64-7.0.2.tgz#cdc7ce81d60f1e09034960ddfb1fb880d7a776b6"
+  integrity sha512-MTKKkWB7p/0E9xi1d1tHtZ5PiLkGEMIq88pK2CubZjOsLtYTLqhgIgi6zepFa+9GHZ6h05NMCkQxGKiPXMxXtQ==
+
+"@typescript/typescript-darwin-arm64@7.0.2":
+  version "7.0.2"
+  resolved "https://registry.yarnpkg.com/@typescript/typescript-darwin-arm64/-/typescript-darwin-arm64-7.0.2.tgz#a55fdfcfa58df58d27db2237cde6a5c1e35a7235"
+  integrity sha512-gowzar9MwS/aRWp6f3a4KUqzRjAZjOsmGNCM6LcTgXum+dBfgsBVMN+AgvOCCbguXyick6LJhpBszxMebJ8syA==
+
+"@typescript/typescript-darwin-x64@7.0.2":
+  version "7.0.2"
+  resolved "https://registry.yarnpkg.com/@typescript/typescript-darwin-x64/-/typescript-darwin-x64-7.0.2.tgz#38d1c9172800a91d707bec64d2a370a016634db4"
+  integrity sha512-SZ9xZInqApNlNGc9s0W1VSsktYSOe9cFqNOIqmN1Gs8SmkjKZYFt017G4VwPxASInODuAdbTW7sXiFUf893RgA==
+
+"@typescript/typescript-freebsd-arm64@7.0.2":
+  version "7.0.2"
+  resolved "https://registry.yarnpkg.com/@typescript/typescript-freebsd-arm64/-/typescript-freebsd-arm64-7.0.2.tgz#f1ff8810030b35d2b5be0db6a2dc650460ea94fa"
+  integrity sha512-W5NH4y/J0plIIS5b2xvTEkU7JFxyqdMAOgf+Ilhl0vHQXKO5dZoxd+C/jEtq56c4F3wk71RB4BMRQ2XdI+bwYQ==
+
+"@typescript/typescript-freebsd-x64@7.0.2":
+  version "7.0.2"
+  resolved "https://registry.yarnpkg.com/@typescript/typescript-freebsd-x64/-/typescript-freebsd-x64-7.0.2.tgz#3d86b03f353c5b1ba95162eb6ce35533bfc294bd"
+  integrity sha512-UMGDx5sTpzNw3WiPebH7l90IWfJggEd+egHt/q6p7/Cm3zqoV7VxkGXt+3DxPIw8CcmvAB0j3sVVfbhX+M4Tpw==
+
+"@typescript/typescript-linux-arm64@7.0.2":
+  version "7.0.2"
+  resolved "https://registry.yarnpkg.com/@typescript/typescript-linux-arm64/-/typescript-linux-arm64-7.0.2.tgz#d9334d96d6dac6ff85da9c865588948de939e91f"
+  integrity sha512-Qh4eU4/y3yDjnfjjyPYihMj5/ODIlmt+Bzu17OI+fiSRDW57QmU5SiN63exPRNJPKUzcc1INa1NXdrJ+MqHjUQ==
+
+"@typescript/typescript-linux-arm@7.0.2":
+  version "7.0.2"
+  resolved "https://registry.yarnpkg.com/@typescript/typescript-linux-arm/-/typescript-linux-arm-7.0.2.tgz#ad94b41e1aee2a4dcc6a298c7b67c43345fde32e"
+  integrity sha512-gffT3xPz9sR7j/YJExkyPntrI0P2EP9XbOyWzth2/Gs0RstK+90RBcO0ncXoXy/beYll1SXw846Nf2zdnEz0QQ==
+
+"@typescript/typescript-linux-loong64@7.0.2":
+  version "7.0.2"
+  resolved "https://registry.yarnpkg.com/@typescript/typescript-linux-loong64/-/typescript-linux-loong64-7.0.2.tgz#2965aee4fc873360139d893daafe6397a29138ad"
+  integrity sha512-uEHck9i8hoAzXPiYRib1O7miOnz23SxIeVl6F4LXox+qov1K35jHcEW6VHKvZI+pyvl7fZEP4MCU5LYvIq1GuQ==
+
+"@typescript/typescript-linux-mips64el@7.0.2":
+  version "7.0.2"
+  resolved "https://registry.yarnpkg.com/@typescript/typescript-linux-mips64el/-/typescript-linux-mips64el-7.0.2.tgz#1a887a311bed3a833f80bfd4a9ed37c271936cf0"
+  integrity sha512-R4KvAMnE43W5Qeqb0Ly56O3mWMWIAgsMyz36DCaycd5nbg/9kzm0liw3JocfRqyJY0KPmzFjbswozXyW0DnIYA==
+
+"@typescript/typescript-linux-ppc64@7.0.2":
+  version "7.0.2"
+  resolved "https://registry.yarnpkg.com/@typescript/typescript-linux-ppc64/-/typescript-linux-ppc64-7.0.2.tgz#8b63c9b2f445b393eb4e43ec21da225dade3577d"
+  integrity sha512-DORx5b3sd/4S7eayxm4FQv+A7CrkUIGRaHiwI8oiHTAI1fAPWhF4J0vAlkC8biAlHSVVwxMQ3tjZ2/DVbnQiiA==
+
+"@typescript/typescript-linux-riscv64@7.0.2":
+  version "7.0.2"
+  resolved "https://registry.yarnpkg.com/@typescript/typescript-linux-riscv64/-/typescript-linux-riscv64-7.0.2.tgz#b6e8a35c289b3ea97a92a41d461aaeed0d3b36e1"
+  integrity sha512-wf0jqEDOjrPRnKwYRyyJDRo11KMbvMFrU+q4zqKyChODBzvlkbhNQfKvLxQCcwTpdDaXSHZTVuh0JoCrKCUMHQ==
+
+"@typescript/typescript-linux-s390x@7.0.2":
+  version "7.0.2"
+  resolved "https://registry.yarnpkg.com/@typescript/typescript-linux-s390x/-/typescript-linux-s390x-7.0.2.tgz#2ef96693be4861f6d17965427e5b009cbbed1a3e"
+  integrity sha512-IkwJc3L7yhytWd/ewjyxNDfOmswCm9GWMJT/ue/dU4aZNbwZeYAetq42VyLmsmSjvoX7z74X6ZaYCtzAr0EuGw==
+
+"@typescript/typescript-linux-x64@7.0.2":
+  version "7.0.2"
+  resolved "https://registry.yarnpkg.com/@typescript/typescript-linux-x64/-/typescript-linux-x64-7.0.2.tgz#73269cb0baba50aea0ca060445a6b88e583f1ce2"
+  integrity sha512-EYdf2cNg7rgCWJnxCdJ+F3V39O8ihb37eHAu1LK8oAFizgTQbPOK7zHHXbPt8rX24COqODXeI3sIf0fCXG7H/A==
+
+"@typescript/typescript-netbsd-arm64@7.0.2":
+  version "7.0.2"
+  resolved "https://registry.yarnpkg.com/@typescript/typescript-netbsd-arm64/-/typescript-netbsd-arm64-7.0.2.tgz#3a3649f97fafa210b4e6e3798c15e06605c8a901"
+  integrity sha512-+polYF4MF04aPpO5FTkHran9yUQDSXqy5GiSDKpsll5jy3l3+g9QLhpf39T+ePtefhXLOGrLl0QIjkQP6VnelA==
+
+"@typescript/typescript-netbsd-x64@7.0.2":
+  version "7.0.2"
+  resolved "https://registry.yarnpkg.com/@typescript/t
```

---

### Incident Patch 9: `0dfd70e2` (2026-09-10)
**Commit Message**: build(deps): bump mintlify from 4.2.791 to 4.2.876 in /docs

Bumps [mintlify](https://github.com/mintlify/mint/tree/HEAD/packages/mintlify) from 4.2.791 to 4.2.876.
- [Commits](https://github.com/mintlify/mint/commits/HEAD/packages/mintlify)

---
updated-dependencies:
- dependency-name: mintlify
  dependency-version: 4.2.850
  dependency-type: direct:production
  update-type: version-update:semver-patch
...

Signed-off-by: dependabot[bot] <[REDACTED_EMAIL]>

**File**: `docs/package-lock.json` (modified, +751/-207)
```diff
@@ -9,7 +9,7 @@
       "version": "1.0.0",
       "license": "ISC",
       "dependencies": {
-        "mintlify": "^4.2.791"
+        "mintlify": "^4.2.876"
       }
     },
     "node_modules/@alcalzone/ansi-tokenize": {
@@ -26,9 +26,9 @@
       }
     },
     "node_modules/@alloc/quick-lru": {
-      "version": "5.2.0",
-      "resolved": "https://registry.npmjs.org/@alloc/quick-lru/-/quick-lru-5.2.0.tgz",
-      "integrity": "sha512-UrcABB+4bUrFABwbluTIBErXwvbsU/V7TZWfmbgJfbkwiBuziS9gxdODUyuiecfdGQ85jglMW6juS3+z5TsKLw==",
+      "version": "5.3.0",
+      "resolved": "https://registry.npmjs.org/@alloc/quick-lru/-/quick-lru-5.3.0.tgz",
+      "integrity": "sha512-U4+70Pc5ZS9osnCBCE5Jha/ciHM+Yp+CNMNC/7HvYbNRk1Ldd+f7qO65W5qfhu/TCv+/ozljlXXe9Nj8419DMA==",
       "license": "MIT",
       "engines": {
         "node": ">=10"
@@ -37,6 +37,169 @@
         "url": "https://github.com/sponsors/sindresorhus"
       }
     },
+    "node_modules/@anthropic-ai/claude-agent-sdk": {
+      "version": "0.3.241",
+      "resolved": "https://registry.npmjs.org/@anthropic-ai/claude-agent-sdk/-/claude-agent-sdk-0.3.241.tgz",
+      "integrity": "sha512-pIHdCSTywFe30H0oWDCKZzC4ipBLtF5YMDRKjf6PHyARg57O4l/72v3b6QKnnefwtKKMe6uWJ1Y9lUJg/sKWyA==",
+      "license": "SEE LICENSE IN README.md",
+      "optional": true,
+      "engines": {
+        "node": ">=18.0.0"
+      },
+      "optionalDependencies": {
+        "@anthropic-ai/claude-agent-sdk-darwin-arm64": "0.3.241",
+        "@anthropic-ai/claude-agent-sdk-darwin-x64": "0.3.241",
+        "@anthropic-ai/claude-agent-sdk-linux-arm64": "0.3.241",
+        "@anthropic-ai/claude-agent-sdk-linux-arm64-musl": "0.3.241",
+        "@anthropic-ai/claude-agent-sdk-linux-x64": "0.3.241",
+        "@anthropic-ai/claude-agent-sdk-linux-x64-musl": "0.3.241",
+        "@anthropic-ai/claude-agent-sdk-win32-arm64": "0.3.241",
+        "@anthropic-ai/claude-agent-sdk-win32-x64": "0.3.241"
+      },
+      "peerDependencies": {
+        "@anthropic-ai/sdk": ">=0.93.0",
+        "@modelcontextprotocol/sdk": "^1.29.0",
+        "zod": "^4.0.0"
+      }
+    },
+    "node_modules/@anthropic-ai/claude-agent-sdk-darwin-arm64": {
+      "version": "0.3.241",
+      "resolved": "https://registry.npmjs.org/@anthropic-ai/claude-agent-sdk-darwin-arm64/-/claude-agent-sdk-darwin-arm64-0.3.241.tgz",
+      "integrity": "sha512-v26ta54lKFMFEZzbOE+6p3YhKERWnDiEA6OmkSAg+3fAQHOa1+aLTKw222cfgzxgiVixwFtHMk8c63zsDd8aXQ==",
+      "cpu": [
+        "arm64"
+      ],
+      "license": "SEE LICENSE IN LICENSE.md",
+      "optional": true,
+      "os": [
+        "darwin"
+      ]
+    },
+    "node_modules/@anthropic-ai/claude-agent-sdk-darwin-x64": {
+      "version": "0.3.241",
+      "resolved": "https://registry.npmjs.org/@anthropic-ai/claude-agent-sdk-darwin-x64/-/claude-agent-sdk-darwin-x64-0.3.241.tgz",
+      "integrity": "sha512-5jweT0vft1ZCaGSoxZHF9vJlHbx8Yxx4+x5aHAIXTd4lx7ZbT4o5buEF8kpmTeHUB+Fw9jtFIm4QDsRiBXgf+Q==",
+      "cpu": [
+        "x64"
+      ],
+      "license": "SEE LICENSE IN LICENSE.md",
+      "optional": true,
+      "os": [
+        "darwin"
+      ]
+    },
+    "node_modules/@anthropic-ai/claude-agent-sdk-linux-arm64": {
+      "version": "0.3.241",
+      "resolved": "https://registry.npmjs.org/@anthropic-ai/claude-agent-sdk-linux-arm64/-/claude-agent-sdk-linux-arm64-0.3.241.tgz",
+      "integrity": "sha512-SxszQGffXiLzMEnAv+pJXEmQbA8haijKyRjjH/jOt1CLeMIfpjKcO9WQDv8dEA8nREWS3zJ103zjgecAF7oOQQ==",
+      "cpu": [
+        "arm64"
+      ],
+      "libc": [
+        "glibc"
+      ],
+      "license": "SEE LICENSE IN LICENSE.md",
+      "optional": true,
+      "os": [
+        "linux"
+      ]
+    },
+    "node_modules/@anthropic-ai/claude-agent-sdk-linux-arm64-musl": {
+      "version": "0.3.241",
+      "resolved": "https://registry.npmjs.org/@anthropic-ai/claude-agent-sdk-linux-arm64-musl/-/claude-agent-sdk-linux-arm64-musl-0.3.241.tgz",
+      "integrity": "sha512-GslvPvSzehfCZyzOaJAt4lgodznm5zpl/LMXN8ygD12z5qnpM+I9/eFnmAaISJ0L8/vyohtlAP1jjaeR2jz1AQ==",
+      "cpu": [
+        "arm64"
+      ],
+      "libc": [
+        "musl"
+      ],
+      "license": "SEE LICENSE IN LICENSE.md",
+      "optional": true,
+      "os": [
+        "linux"
+      ]
+    },
+    "node_modules/@anthropic-ai/claude-agent-sdk-linux-x64": {
+      "version": "0.3.241",
+      "resolved": "https://registry.npmjs.org/@anthropic-ai/claude-agent-sdk-linux-x64/-/claude-agent-sdk-linux-x64-0.3.241.tgz",
+      "integrity": "sha512-gJRa922Qcm7loumHcXMDFEFg//tz1aOi7Nx0sQa9I9lC1JSN8yL6i7/idzOU5Hp193tEDFOgqIMFL/yRiXg+rw==",
+      "cpu": [
+        "x64"
+      ],
+      "libc": [
+        "glibc"
+      ],
+      "license": "SEE LICENSE IN LICENSE.md",
+      "optional": true,
+      "os": [
+        "linux"
+      ]
+    },
+    "node_modules/@anthropic-ai/claude-agent-sdk-linux-x64-musl": {
+      "version": "0.3.241",
+      "resolved": "https://registry.npmjs.org/@anthropic-ai/claude-agent-sdk-linux-x64-mus
```

**File**: `docs/package.json` (modified, +1/-1)
```diff
@@ -7,7 +7,7 @@
     "doc": "docs"
   },
   "dependencies": {
-    "mintlify": "^4.2.791"
+    "mintlify": "^4.2.876"
   },
   "scripts": {
     "test": "echo \"Error: no test specified\" && exit 1"
```

---

### Incident Patch 10: `88968697` (2026-09-10)
**Commit Message**: build(deps): bump buf.build/gen/go/permifyco/permify/protocolbuffers/go

---
updated-dependencies:
- dependency-name: buf.build/gen/go/permifyco/permify/protocolbuffers/go
  dependency-version: 1.36.12-20260417170026-08b37474f24f.2
  dependency-type: direct:production
  update-type: version-update:semver-patch
...

Signed-off-by: dependabot[bot] <[REDACTED_EMAIL]>

**File**: `sdk/go/grpc/go.mod` (modified, +3/-3)
```diff
@@ -3,14 +3,14 @@ module main
 go 1.25.7
 
 require (
-	buf.build/gen/go/permifyco/permify/protocolbuffers/go v1.36.12-20260417170026-08b37474f24f.1
+	buf.build/gen/go/permifyco/permify/protocolbuffers/go v1.36.12-20260417170026-08b37474f24f.2
 	github.com/Permify/permify-go v0.6.0
 	google.golang.org/grpc v1.83.2
 )
 
 require (
-	buf.build/gen/go/envoyproxy/protoc-gen-validate/protocolbuffers/go v1.36.12-20240617172848-daf171c6cdb5.1 // indirect
-	buf.build/gen/go/grpc-ecosystem/grpc-gateway/protocolbuffers/go v1.36.12-20241220201140-4c5ba75caaf8.1 // indirect
+	buf.build/gen/go/envoyproxy/protoc-gen-validate/protocolbuffers/go v1.36.12-20240617172848-daf171c6cdb5.2 // indirect
+	buf.build/gen/go/grpc-ecosystem/grpc-gateway/protocolbuffers/go v1.36.12-20241220201140-4c5ba75caaf8.2 // indirect
 	buf.build/gen/go/permifyco/permify/grpc/go v1.6.1-20260417170026-08b37474f24f.1 // indirect
 	golang.org/x/net v0.58.0 // indirect
 	golang.org/x/sys v0.47.0 // indirect
```

**File**: `sdk/go/grpc/go.sum` (modified, +6/-6)
```diff
@@ -1,11 +1,11 @@
-buf.build/gen/go/envoyproxy/protoc-gen-validate/protocolbuffers/go v1.36.12-20240617172848-daf171c6cdb5.1 h1:n2M6Ko1hTXHNTRfYXFIbP1kE74XpJc6dY6psur6iuhA=
-buf.build/gen/go/envoyproxy/protoc-gen-validate/protocolbuffers/go v1.36.12-20240617172848-daf171c6cdb5.1/go.mod h1:uEYtK5SFuNw1hJkqTKEXvvbUyWwTBlTRj42alVWbe6M=
-buf.build/gen/go/grpc-ecosystem/grpc-gateway/protocolbuffers/go v1.36.12-20241220201140-4c5ba75caaf8.1 h1:tUdD9w+8U70KRudIRO4Ass2S8mSB6P+0QmrrlmqlpDY=
-buf.build/gen/go/grpc-ecosystem/grpc-gateway/protocolbuffers/go v1.36.12-20241220201140-4c5ba75caaf8.1/go.mod h1:tGHWROdiYQqFpI6EFJWW82Kfbg58TqH2EGNbkGajR0E=
+buf.build/gen/go/envoyproxy/protoc-gen-validate/protocolbuffers/go v1.36.12-20240617172848-daf171c6cdb5.2 h1:Z/mX4IRvRVjjBx45fo9cV8prOGbFZvmIjhA06txbuMI=
+buf.build/gen/go/envoyproxy/protoc-gen-validate/protocolbuffers/go v1.36.12-20240617172848-daf171c6cdb5.2/go.mod h1:uEYtK5SFuNw1hJkqTKEXvvbUyWwTBlTRj42alVWbe6M=
+buf.build/gen/go/grpc-ecosystem/grpc-gateway/protocolbuffers/go v1.36.12-20241220201140-4c5ba75caaf8.2 h1:ESTAICuabdVu0hN+z06qMtr07mETtGjaEiNUco0RnmI=
+buf.build/gen/go/grpc-ecosystem/grpc-gateway/protocolbuffers/go v1.36.12-20241220201140-4c5ba75caaf8.2/go.mod h1:tGHWROdiYQqFpI6EFJWW82Kfbg58TqH2EGNbkGajR0E=
 buf.build/gen/go/permifyco/permify/grpc/go v1.6.1-20260417170026-08b37474f24f.1 h1:J2PPCGs5mDUnUqowZh+y5IHCaCMwVKpBiK7yptuaMEA=
 buf.build/gen/go/permifyco/permify/grpc/go v1.6.1-20260417170026-08b37474f24f.1/go.mod h1:w0pZ0AJzhN6h4WS9+JLVwbV8xP3BAayjvxTutZWhixA=
-buf.build/gen/go/permifyco/permify/protocolbuffers/go v1.36.12-20260417170026-08b37474f24f.1 h1:+LUHW8/UcJZJRZF5Pye6lo36fkQy5nksS6LcekL2+1c=
-buf.build/gen/go/permifyco/permify/protocolbuffers/go v1.36.12-20260417170026-08b37474f24f.1/go.mod h1:0kI/b+eCC1sS5/Iql7Ayx+IOhhn9dIxgIf1dhaKP55A=
+buf.build/gen/go/permifyco/permify/protocolbuffers/go v1.36.12-20260417170026-08b37474f24f.2 h1:fdhEVXfxg9E0PbdZBhyL/haU4l1vbng0EMcmDBO3M6s=
+buf.build/gen/go/permifyco/permify/protocolbuffers/go v1.36.12-20260417170026-08b37474f24f.2/go.mod h1:cD8ToRjMdTqsJ0aPCjJB9x2bwhEw9r83JVieMfsxJZk=
 github.com/Permify/permify-go v0.6.0 h1:j/WjqL2hnlNYgyuFzhHr3lwcUu7yC41A5a80x9WRouc=
 github.com/Permify/permify-go v0.6.0/go.mod h1:OikAZdnEYuNvxYUNERxmB0+8hQE+RA/K6vgFOJbem8M=
 github.com/cespare/xxhash/v2 v2.3.0 h1:UL815xU9SqsFlibzuggzjXhog7bL6oX9BbNZnL2UFvs=
```

---

### Incident Patch 11: `fedd37b4` (2026-09-10)
**Commit Message**: build(deps): bump google.golang.org/grpc from 1.83.1 to 1.83.2

Bumps [google.golang.org/grpc](https://github.com/grpc/grpc-go) from 1.83.1 to 1.83.2.
- [Release notes](https://github.com/grpc/grpc-go/releases)
- [Commits](https://github.com/grpc/grpc-go/compare/v1.83.1...v1.83.2)

---
updated-dependencies:
- dependency-name: google.golang.org/grpc
  dependency-version: 1.83.2
  dependency-type: direct:production
...

Signed-off-by: dependabot[bot] <[REDACTED_EMAIL]>

**File**: `go.mod` (modified, +12/-12)
```diff
@@ -71,10 +71,10 @@ require (
 	go.opentelemetry.io/otel/sdk/metric v1.44.0
 	go.opentelemetry.io/otel/trace v1.44.0
 	golang.org/x/exp v0.0.0-20251002181428-27f1f14c8bb9
-	golang.org/x/net v0.56.0 // indirect
+	golang.org/x/net v0.58.0 // indirect
 	golang.org/x/sync v0.22.0
 	google.golang.org/genproto/googleapis/api v0.0.0-20260526163538-3dc84a4a5aaa
-	google.golang.org/grpc v1.83.1
+	google.golang.org/grpc v1.83.2
 	google.golang.org/protobuf v1.36.11
 	resenje.org/singleflight v0.4.3
 )
@@ -148,10 +148,10 @@ require (
 	github.com/ccojocar/zxcvbn-go v1.0.4 // indirect
 	github.com/cenkalti/backoff/v5 v5.0.3 // indirect
 	github.com/charithe/durationcheck v0.0.10 // indirect
-	github.com/charmbracelet/colorprofile v0.2.3-0.20250311203215-f60798e515dc // indirect
+	github.com/charmbracelet/colorprofile v0.3.1 // indirect
 	github.com/charmbracelet/lipgloss v1.1.0 // indirect
-	github.com/charmbracelet/x/ansi v0.8.0 // indirect
-	github.com/charmbracelet/x/cellbuf v0.0.13-0.20250311204145-2c3ea96c31dd // indirect
+	github.com/charmbracelet/x/ansi v0.9.2 // indirect
+	github.com/charmbracelet/x/cellbuf v0.0.13 // indirect
 	github.com/charmbracelet/x/term v0.2.1 // indirect
 	github.com/ckaznocha/intrange v0.3.1 // indirect
 	github.com/containerd/errdefs v1.0.0 // indirect
@@ -326,9 +326,9 @@ require (
 	go.uber.org/zap v1.27.0 // indirect
 	go.yaml.in/yaml/v3 v3.0.4
 	golang.org/x/exp/typeparams v0.0.0-20250911091902-df9299821621 // indirect
-	golang.org/x/mod v0.37.0 // indirect
+	golang.org/x/mod v0.38.0 // indirect
 	golang.org/x/oauth2 v0.36.0 // indirect
-	golang.org/x/term v0.44.0 // indirect
+	golang.org/x/term v0.45.0 // indirect
 	golang.org/x/time v0.14.0 // indirect
 	google.golang.org/api v0.264.0 // indirect
 	google.golang.org/genproto v0.0.0-20260128011058-8636f8732409 // indirect
@@ -390,7 +390,7 @@ require (
 	github.com/pmezard/go-difflib v1.0.1-0.20181226105442-5d4384ee4fb2 // indirect
 	github.com/power-devops/perfstat v0.0.0-20240221224432-82ca36839d55 // indirect
 	github.com/prometheus/client_golang v1.20.3 // indirect
-	github.com/prometheus/client_model v0.6.1 // indirect
+	github.com/prometheus/client_model v0.6.2 // indirect
 	github.com/prometheus/common v0.59.1 // indirect
 	github.com/prometheus/procfs v0.16.1 // indirect
 	github.com/sagikazarmark/locafero v0.11.0 // indirect
@@ -408,10 +408,10 @@ require (
 	github.com/yusufpapurcu/wmi v1.2.4 // indirect
 	go.opentelemetry.io/proto/otlp v1.10.0 // indirect
 	go.uber.org/multierr v1.11.0 // indirect
-	golang.org/x/crypto v0.53.0 // indirect
-	golang.org/x/sys v0.46.0 // indirect
-	golang.org/x/text v0.40.0 // indirect
-	golang.org/x/tools v0.47.0 // indirect
+	golang.org/x/crypto v0.55.0 // indirect
+	golang.org/x/sys v0.47.0 // indirect
+	golang.org/x/text v0.41.0 // indirect
+	golang.org/x/tools v0.48.0 // indirect
 	google.golang.org/genproto/googleapis/rpc v0.0.0-20260526163538-3dc84a4a5aaa // indirect
 )
 
```

**File**: `go.sum` (modified, +24/-24)
```diff
@@ -173,14 +173,14 @@ github.com/cespare/xxhash/v2 v2.3.0 h1:UL815xU9SqsFlibzuggzjXhog7bL6oX9BbNZnL2UF
 github.com/cespare/xxhash/v2 v2.3.0/go.mod h1:VGX0DQ3Q6kWi7AoAeZDth3/j3BFtOZR5XLFGgcrjCOs=
 github.com/charithe/durationcheck v0.0.10 h1:wgw73BiocdBDQPik+zcEoBG/ob8uyBHf2iyoHGPf5w4=
 github.com/charithe/durationcheck v0.0.10/go.mod h1:bCWXb7gYRysD1CU3C+u4ceO49LoGOY1C1L6uouGNreQ=
-github.com/charmbracelet/colorprofile v0.2.3-0.20250311203215-f60798e515dc h1:4pZI35227imm7yK2bGPcfpFEmuY1gc2YSTShr4iJBfs=
-github.com/charmbracelet/colorprofile v0.2.3-0.20250311203215-f60798e515dc/go.mod h1:X4/0JoqgTIPSFcRA/P6INZzIuyqdFY5rm8tb41s9okk=
+github.com/charmbracelet/colorprofile v0.3.1 h1:k8dTHMd7fgw4bnFd7jXTLZrSU/CQrKnL3m+AxCzDz40=
+github.com/charmbracelet/colorprofile v0.3.1/go.mod h1:/GkGusxNs8VB/RSOh3fu0TJmQ4ICMMPApIIVn0KszZ0=
 github.com/charmbracelet/lipgloss v1.1.0 h1:vYXsiLHVkK7fp74RkV7b2kq9+zDLoEU4MZoFqR/noCY=
 github.com/charmbracelet/lipgloss v1.1.0/go.mod h1:/6Q8FR2o+kj8rz4Dq0zQc3vYf7X+B0binUUBwA0aL30=
-github.com/charmbracelet/x/ansi v0.8.0 h1:9GTq3xq9caJW8ZrBTe0LIe2fvfLR/bYXKTx2llXn7xE=
-github.com/charmbracelet/x/ansi v0.8.0/go.mod h1:wdYl/ONOLHLIVmQaxbIYEC/cRKOQyjTkowiI4blgS9Q=
-github.com/charmbracelet/x/cellbuf v0.0.13-0.20250311204145-2c3ea96c31dd h1:vy0GVL4jeHEwG5YOXDmi86oYw2yuYUGqz6a8sLwg0X8=
-github.com/charmbracelet/x/cellbuf v0.0.13-0.20250311204145-2c3ea96c31dd/go.mod h1:xe0nKWGd3eJgtqZRaN9RjMtK7xUYchjzPr7q6kcvCCs=
+github.com/charmbracelet/x/ansi v0.9.2 h1:92AGsQmNTRMzuzHEYfCdjQeUzTrgE1vfO5/7fEVoXdY=
+github.com/charmbracelet/x/ansi v0.9.2/go.mod h1:3RQDQ6lDnROptfpWuUVIUG64bD2g2BgntdxH0Ya5TeE=
+github.com/charmbracelet/x/cellbuf v0.0.13 h1:/KBBKHuVRbq1lYx5BzEHBAFBP8VcQzJejZ/IA3iR28k=
+github.com/charmbracelet/x/cellbuf v0.0.13/go.mod h1:xe0nKWGd3eJgtqZRaN9RjMtK7xUYchjzPr7q6kcvCCs=
 github.com/charmbracelet/x/term v0.2.1 h1:AQeHeLZ1OqSXhrAWpYUtZyX1T3zVxfpZuEQMIQaGIAQ=
 github.com/charmbracelet/x/term v0.2.1/go.mod h1:oQ4enTYFV7QN4m0i9mzHrViD7TQKvNEEkHUMCmsxdUg=
 github.com/ckaznocha/intrange v0.3.1 h1:j1onQyXvHUsPWujDH6WIjhyH26gkRt/txNlV7LspvJs=
@@ -728,8 +728,8 @@ github.com/pressly/goose/v3 v3.26.0/go.mod h1:4hC1KrritdCxtuFsqgs1R4AU5bWtTAf+cn
 github.com/prometheus/client_golang v1.20.3 h1:oPksm4K8B+Vt35tUhw6GbSNSgVlVSBH0qELP/7u83l4=
 github.com/prometheus/client_golang v1.20.3/go.mod h1:PIEt8X02hGcP8JWbeHyeZ53Y/jReSnHgO035n//V5WE=
 github.com/prometheus/client_model v0.0.0-20190812154241-14fe0d1b01d4/go.mod h1:xMI15A0UPsDsEKsMN9yxemIoYk6Tm2C1GtYGdfGttqA=
-github.com/prometheus/client_model v0.6.1 h1:ZKSh/rekM+n3CeS952MLRAdFwIKqeY8b62p8ais2e9E=
-github.com/prometheus/client_model v0.6.1/go.mod h1:OrxVMOVHjw3lKMa8+x6HeMGkHMQyHDk9E3jmP2AmGiY=
+github.com/prometheus/client_model v0.6.2 h1:oBsgwpGs7iVziMvrGhE53c/GrLUsZdHnqNwqPLxwZyk=
+github.com/prometheus/client_model v0.6.2/go.mod h1:y3m2F6Gdpfy6Ut/GBsUqTWZqCUvMVzSfMLjcu6wAwpE=
 github.com/prometheus/common v0.59.1 h1:LXb1quJHWm1P6wq/U824uxYi4Sg0oGvNeUm1z5dJoX0=
 github.com/prometheus/common v0.59.1/go.mod h1:GpWM7dewqmVYcd7SmRaiWVe9SSqjf0UrwnYnpEZNuT0=
 github.com/prometheus/procfs v0.16.1 h1:hZ15bTNuirocR6u0JZ6BAHHmwS1p8B4P6MRqxtzMyRg=
@@ -1016,8 +1016,8 @@ golang.org/x/crypto v0.13.0/go.mod h1:y6Z2r+Rw4iayiXXAIxJIDAJ1zMW4yaTpebo8fPOliY
 golang.org/x/crypto v0.14.0/go.mod h1:MVFd36DqK4CsrnJYDkBA3VC4m2GkXAM0PvzMCn4JQf4=
 golang.org/x/crypto v0.19.0/go.mod h1:Iy9bg/ha4yyC70EfRS8jz+B6ybOBKMaSxLj6P6oBDfU=
 golang.org/x/crypto v0.20.0/go.mod h1:Xwo95rrVNIoSMx9wa1JroENMToLWn3RNVrTBpLHgZPQ=
-golang.org/x/crypto v0.53.0 h1:QZ4Muo8THX6CizN2vPPd5fBGHyogrdK9fG4wLPFUsto=
-golang.org/x/crypto v0.53.0/go.mod h1:DNLU434OwVakk9PzuwV8w62mAJpRJL3vsgcfp4Qnsio=
+golang.org/x/crypto v0.55.0 h1:+KWHjbgOaAQ66dh/YlkZKHlz9ZUlq61AFirAR9ntP8M=
+golang.org/x/crypto v0.55.0/go.mod h1:uq0V9dE/fzQuJtbnL+2EhWOE63vo164FY8xqEnV9xis=
 golang.org/x/exp v0.0.0-20190121172915-509febef88a4/go.mod h1:CJ0aWSM057203Lf6IL+f9T1iT9GByDxfZKAQTCR3kQA=
 golang.org/x/exp v0.0.0-20251002181428-27f1f14c8bb9 h1:TQwNpfvNkxAVlItJf6Cr5JTsVZoC/Sj7K3OZv2Pc14A=
 golang.org/x/exp v0.0.0-20251002181428-27f1f14c8bb9/go.mod h1:TwQYMMnGpvZyc+JpB/UAuTNIsVJifOlSkrZkhcvpVUk=
@@ -1040,8 +1040,8 @@ golang.org/x/mod v0.6.0-dev.0.20220419223038-86c51ed26bb4/go.mod h1:jJ57K6gSWd91
 golang.org/x/mod v0.8.0/go.mod h1:iBbtSCu2XBx23ZKBPSOrRkjjQPZFPuis4dIYUhu/chs=
 golang.org/x/mod v0.12.0/go.mod h1:iBbtSCu2XBx23ZKBPSOrRkjjQPZFPuis4dIYUhu/chs=
 golang.org/x/mod v0.13.0/go.mod h1:hTbmBsO62+eylJbnUtE2MGJUyE7QWk4xUqPFrRgJ+7c=
-golang.org/x/mod v0.37.0 h1:vF1DjpVEshcIqoEaauuHebaLk1O1forxjxBaVn884JQ=
-golang.org/x/mod v0.37.0/go.mod h1:m8S8VeM9r4dzDwjrKO0a1sZP3YjeMamRRlD+fmR2Q/0=
+golang.org/x/mod v0.38.0 h1:MECBjubtXD7yj4HrhIUcywNaGeNVUdfVnxmPajOk4yk=
+golang.org/x/mod v0.38.0/go.mod h1:V6Xz0pq8TQ3dGqVQ1FVHuelZpAL0uNhSkk9ogYP3c40=
 golang.org/x/net v0.0.0-20180724234803-3673e40ba225/go.mod h1:mL1N/T3taQHkDXs73rZJwtUhF3w3ftmwwsq0BUmARs4=
 golang.org/x/net v0.0.0-20180826012351-8a410e7b638d/go.mod h1:mL1N/T3taQHkDXs73rZ
```

---

### Incident Patch 12: `c5702410` (2026-09-10)
**Commit Message**: build(deps-dev): bump vitest from 4.1.10 to 4.1.11 in /playground

Bumps [vitest](https://github.com/vitest-dev/vitest/tree/HEAD/packages/vitest) from 4.1.10 to 4.1.11.
- [Release notes](https://github.com/vitest-dev/vitest/releases)
- [Changelog](https://github.com/vitest-dev/vitest/blob/main/docs/releases.md)
- [Commits](https://github.com/vitest-dev/vitest/commits/v4.1.11/packages/vitest)

---
updated-dependencies:
- dependency-name: vitest
  dependency-version: 4.1.11
  dependency-type: direct:development
...

Signed-off-by: dependabot[bot] <[REDACTED_EMAIL]>

**File**: `playground/package.json` (modified, +1/-1)
```diff
@@ -53,6 +53,6 @@
     "typescript": "^6.0.2",
     "vite": "^8.0.16",
     "vite-tsconfig-paths": "^6.1.1",
-    "vitest": "^4.1.10"
+    "vitest": "^4.1.11"
   }
 }
```

**File**: `playground/yarn.lock` (modified, +47/-47)
```diff
@@ -1038,63 +1038,63 @@
     "@types/babel__core" "^7.20.5"
     react-refresh "^0.18.0"
 
-"@vitest/expect@4.1.10":
-  version "4.1.10"
-  resolved "https://registry.yarnpkg.com/@vitest/expect/-/expect-4.1.10.tgz#799c06fc44bb0cf7e2784137b627c5cc173285d4"
-  integrity sha512-YsCn+qAk1GWjQOWFEsEcL2gNQ0zmVmQu3T03qP6UyjhtmdtwtbuI+DASn/7iQB3HGTXkdBwGddzxPlmiql5vlA==
+"@vitest/expect@4.1.11":
+  version "4.1.11"
+  resolved "https://registry.yarnpkg.com/@vitest/expect/-/expect-4.1.11.tgz#5f580d1f9cdbba314dbf23b2d911f8eb23878f5f"
+  integrity sha512-VX2x5vNJXET47KAFzwERI+KRMtTTCSWTfSMKsW7JsUsXV4psq++e3DvZpuTDOpHcxytiDs6p2nhVb2tVDiiUYw==
   dependencies:
     "@standard-schema/spec" "^1.1.0"
     "@types/chai" "^5.2.2"
-    "@vitest/spy" "4.1.10"
-    "@vitest/utils" "4.1.10"
+    "@vitest/spy" "4.1.11"
+    "@vitest/utils" "4.1.11"
     chai "^6.2.2"
     tinyrainbow "^3.1.0"
 
-"@vitest/mocker@4.1.10":
-  version "4.1.10"
-  resolved "https://registry.yarnpkg.com/@vitest/mocker/-/mocker-4.1.10.tgz#2413987ab4cd7fa1c2b614b404c407bf6ad1ead1"
-  integrity sha512-v0xaezt+DKEmKfaxg133ldzADrwLGd7Ze1MfQQTYfvs8OqZIwbxyxaYURivwV7sWy5fqn3rH5uOrSp07bp44Ow==
+"@vitest/mocker@4.1.11":
+  version "4.1.11"
+  resolved "https://registry.yarnpkg.com/@vitest/mocker/-/mocker-4.1.11.tgz#8e2906361bc5dfa271757a858ae80643118fcbb4"
+  integrity sha512-2XJVD55d1o5AZous5CCGKS74g/riOj9odEt2bQpCVZeblHyHdnMeFl4jl0XjU21stf4mbjUkew2eXQZt65g5CQ==
   dependencies:
-    "@vitest/spy" "4.1.10"
+    "@vitest/spy" "4.1.11"
     estree-walker "^3.0.3"
     magic-string "^0.30.21"
 
-"@vitest/pretty-format@4.1.10":
-  version "4.1.10"
-  resolved "https://registry.yarnpkg.com/@vitest/pretty-format/-/pretty-format-4.1.10.tgz#75542e7273a08cc10fd4d8dad4e3eb1f16cd958c"
-  integrity sha512-W1HsjSH4MXQ9YfmmhLAoIYf1HRfekQCGngeIgcei6MP5QQGWUe0gkopdZQaVCFO+JDJMrAJGwa5pRpNpvy4P8Q==
+"@vitest/pretty-format@4.1.11":
+  version "4.1.11"
+  resolved "https://registry.yarnpkg.com/@vitest/pretty-format/-/pretty-format-4.1.11.tgz#8b28eb8240771d6ea970e33beaeb41384b51868e"
+  integrity sha512-yiZzPbGTS9Sr/JpFl8zHrcIkAofNbFV6k21vIgQN/cY/oxZeXhJv5sc/MBJ5jFKWmWs+oJHw0UXLZjmf931+Vw==
   dependencies:
     tinyrainbow "^3.1.0"
 
-"@vitest/runner@4.1.10":
-  version "4.1.10"
-  resolved "https://registry.yarnpkg.com/@vitest/runner/-/runner-4.1.10.tgz#febf0a21a9168421422d1955370e606feab60355"
-  integrity sha512-IKI6kpIH+LmpROplyLwBBaCfMgOZOMsygVa6BARD6ahA04VRuJSa6OaVG7kRvSEMD870Vd91rSSw0eegtWyLGg==
+"@vitest/runner@4.1.11":
+  version "4.1.11"
+  resolved "https://registry.yarnpkg.com/@vitest/runner/-/runner-4.1.11.tgz#bfbad98c8d6c3f1fb4df12056ad569821ff77f21"
+  integrity sha512-LztvUgdwMNJMIkj3hQnnxiC2Xy1zNxq928W/xhjCLaNCzqTZOudjwbQf6v9IntZGPw132i2Lq2rgTRZHD3JHNw==
   dependencies:
-    "@vitest/utils" "4.1.10"
+    "@vitest/utils" "4.1.11"
     pathe "^2.0.3"
 
-"@vitest/snapshot@4.1.10":
-  version "4.1.10"
-  resolved "https://registry.yarnpkg.com/@vitest/snapshot/-/snapshot-4.1.10.tgz#7e3e9fec7d4d47232e493cfdcbd2170de4371c04"
-  integrity sha512-xRkfOT1qpTAi/Ti4Y1LtfRc3kEuqxGw59eN2jN9pRWMtS/XDevekhcFSqvQqjUNGksfjMJu3Y+oJ+4Ypn2OaJw==
+"@vitest/snapshot@4.1.11":
+  version "4.1.11"
+  resolved "https://registry.yarnpkg.com/@vitest/snapshot/-/snapshot-4.1.11.tgz#df461eb165924a3155986dde68e13360f53f3d4c"
+  integrity sha512-pN7ikn1ON7h8ee4gIAp4AzyK+zBtJPzVbqOgu5LCEh4VaJVbPQcgYQYJIMGQPXVeJJq1fnfazis7a5pFNPahog==
   dependencies:
-    "@vitest/pretty-format" "4.1.10"
-    "@vitest/utils" "4.1.10"
+    "@vitest/pretty-format" "4.1.11"
+    "@vitest/utils" "4.1.11"
     magic-string "^0.30.21"
     pathe "^2.0.3"
 
-"@vitest/spy@4.1.10":
-  version "4.1.10"
-  resolved "https://registry.yarnpkg.com/@vitest/spy/-/spy-4.1.10.tgz#5c0bfa97b56bba9e37403c976db776ff6ab56f65"
-  integrity sha512-PLf/Ugvoq5wO/b4rwYCR1h2PSIdXz7wnkQFMiUpLdtM7l6pqVFcQIBEHyT1+l+cj7mNwAfZHzqXqDyjvOuwbDw==
+"@vitest/spy@4.1.11":
+  version "4.1.11"
+  resolved "https://registry.yarnpkg.com/@vitest/spy/-/spy-4.1.11.tgz#0add45cae953afed9c88f98e2f6fc9164558c32a"
+  integrity sha512-apNa/prQy2qCeywhnixOHPRCgGNhvg7T4Dapfl1GahLp/R+uhBm5cPyFoNVyqsNd2h1nJxL6BqqdIjiABL60YA==
 
-"@vitest/utils@4.1.10":
-  version "4.1.10"
-  resolved "https://registry.yarnpkg.com/@vitest/utils/-/utils-4.1.10.tgz#ffc71055f18bfccb1fd0586365ebc2824892e403"
-  integrity sha512-fy9am/HWxbaGt/Sawrp90vt6Y6jQwf1RX77cz3uwoJwJVMli/e1IEwRPnMNJ7vKfPTwo0diXifkpPvwH9v7nGA==
+"@vitest/utils@4.1.11":
+  version "4.1.11"
+  resolved "https://registry.yarnpkg.com/@vitest/utils/-/utils-4.1.11.tgz#9b27a4293b827942b223539bfab1bd9f7eada31b"
+  integrity sha512-zTCVGpyFsGWBhllOyKlTw/vnr6D9qxsfSDyfbyZmTyjHw5N/VuvzHpHoQjm2ZJzn4RJgx5w4r7V0er69CmLgPQ==
   dependencies:
-    "@vitest/pretty-format" "4.1.10"
+    "@vitest/pretty-format" "4.1.11"
     convert-source-map "^2.0.0"
     tinyrainbow "^3.1.0"
 
@@ -3221,18 +3221,18 @@ vite@8.0.16, "vite@^6.0.0 || ^7.0.0 || ^8.0.0", vite@^8.0.16:
   optionalDependencies:
     fsevents "~2.3.3"
 
-vitest@^4.1.10:
-  versi
```

---

### Incident Patch 13: `303c352e` (2026-09-09)
**Commit Message**: build(deps): bump qs from 6.15.3 to 6.16.0 in /docs

Bumps [qs](https://github.com/ljharb/qs) from 6.15.3 to 6.16.0.
- [Changelog](https://github.com/ljharb/qs/blob/main/CHANGELOG.md)
- [Commits](https://github.com/ljharb/qs/compare/v6.15.3...v6.16.0)

---
updated-dependencies:
- dependency-name: qs
  dependency-version: 6.16.0
  dependency-type: indirect
...

Signed-off-by: dependabot[bot] <[REDACTED_EMAIL]>

**File**: `docs/package-lock.json` (modified, +3/-3)
```diff
@@ -9755,9 +9755,9 @@
       }
     },
     "node_modules/qs": {
-      "version": "6.15.3",
-      "resolved": "https://registry.npmjs.org/qs/-/qs-6.15.3.tgz",
-      "integrity": "sha512-O9gl3zCl5h5blw1KGUzQKhA5oUXSl8rwUIM5o0S3nCXMliSvy5Dzx7/DJcI+SwgICv+IneSZwhBh1oSyEHA71A==",
+      "version": "6.16.0",
+      "resolved": "https://registry.npmjs.org/qs/-/qs-6.16.0.tgz",
+      "integrity": "sha512-h6fhOIaRrID2CbEY2fqs+7t+UXZo+MLAnU5gRIq85uFtdiUPCdsApMlHhXogKVM4HM2DVbIjGNTTYH2OcmP1vA==",
       "license": "BSD-3-Clause",
       "dependencies": {
         "es-define-property": "^1.0.1",
```

---

### Incident Patch 14: `92dbdcbc` (2026-09-03)
**Commit Message**: build(deps): bump golang from 1.26.5-alpine to 1.27.1-alpine

Bumps golang from 1.26.5-alpine to 1.27.1-alpine.

---
updated-dependencies:
- dependency-name: golang
  dependency-version: 1.27.1-alpine
  dependency-type: direct:production
  update-type: version-update:semver-minor
...

Signed-off-by: dependabot[bot] <[REDACTED_EMAIL]>

**File**: `Dockerfile` (modified, +2/-2)
```diff
@@ -1,10 +1,10 @@
-FROM golang:1.26.5-alpine@sha256:0178a641fbb4858c5f1b48e34bdaabe0350a330a1b1149aabd498d0699ff5fb2 AS permify-builder
+FROM golang:1.27.1-alpine@sha256:cf6fca6641884b8433441b2b0652976f975e1d0fdd26d177eaaf8596087f3125 AS permify-builder
 WORKDIR /go/src/app
 RUN apk update && apk add --no-cache git
 COPY . .
 RUN --mount=type=cache,target=/root/.cache/go-build --mount=type=cache,target=/go/pkg/mod CGO_ENABLED=0 go build -v ./cmd/permify/
 
-FROM golang:1.26.5-alpine@sha256:0178a641fbb4858c5f1b48e34bdaabe0350a330a1b1149aabd498d0699ff5fb2 AS health-probe-builder
+FROM golang:1.27.1-alpine@sha256:cf6fca6641884b8433441b2b0652976f975e1d0fdd26d177eaaf8596087f3125 AS health-probe-builder
 WORKDIR /go/src/app
 RUN apk update && apk add --no-cache git
 RUN git clone https://github.com/grpc-ecosystem/grpc-health-probe.git
```

**File**: `Dockerfile.local` (modified, +1/-1)
```diff
@@ -1,5 +1,5 @@
 # Use the correct Go version
-FROM golang:1.26.5-alpine@sha256:0178a641fbb4858c5f1b48e34bdaabe0350a330a1b1149aabd498d0699ff5fb2
+FROM golang:1.27.1-alpine@sha256:cf6fca6641884b8433441b2b0652976f975e1d0fdd26d177eaaf8596087f3125
 
 RUN apk --no-cache add curl git
 
```

**File**: `Dockerfile.release` (modified, +1/-1)
```diff
@@ -1,5 +1,5 @@
 # Build stage for gRPC health probe
-FROM golang:1.26.5-alpine@sha256:0178a641fbb4858c5f1b48e34bdaabe0350a330a1b1149aabd498d0699ff5fb2 AS health-probe-builder
+FROM golang:1.27.1-alpine@sha256:cf6fca6641884b8433441b2b0652976f975e1d0fdd26d177eaaf8596087f3125 AS health-probe-builder
 WORKDIR /go/src/app
 RUN apk update && apk add --no-cache git
 RUN git clone https://github.com/grpc-ecosystem/grpc-health-probe.git
```

---

### Incident Patch 15: `91a80da7` (2026-09-03)
**Commit Message**: build(deps): bump fast-uri from 3.1.5 to 3.1.7 in /docs

Bumps [fast-uri](https://github.com/fastify/fast-uri) from 3.1.5 to 3.1.7.
- [Release notes](https://github.com/fastify/fast-uri/releases)
- [Commits](https://github.com/fastify/fast-uri/compare/v3.1.5...v3.1.7)

---
updated-dependencies:
- dependency-name: fast-uri
  dependency-version: 3.1.7
  dependency-type: indirect
...

Signed-off-by: dependabot[bot] <[REDACTED_EMAIL]>

**File**: `docs/package-lock.json` (modified, +3/-3)
```diff
@@ -5160,9 +5160,9 @@
       "license": "MIT"
     },
     "node_modules/fast-uri": {
-      "version": "3.1.5",
-      "resolved": "https://registry.npmjs.org/fast-uri/-/fast-uri-3.1.5.tgz",
-      "integrity": "sha512-gHwA1O9LDIcKunMKhObS/HimwtehO1nPUECKAu5TpKgaO19fcWEl4bliWe1jWxVFvIXztJjjQ4L8XQ1EU9f7Jw==",
+      "version": "3.1.7",
+      "resolved": "https://registry.npmjs.org/fast-uri/-/fast-uri-3.1.7.tgz",
+      "integrity": "sha512-dOvZVzjdZdz7phd9v6jCbwxrBW3fK6n8Rc0CtdmM4bumzMnxywBYhuph6J819RRw/ku+rLbelwfMunktuzVVHg==",
       "funding": [
         {
           "type": "github",
```

#### Recent Merged Pull Requests:
- **PR #3215** (2026-10-02): chore: ignore buf lint naming error to avoid breaking changes (@junsazanami430u)
- **PR #3213** (closed): build(deps): bump joda-time:joda-time from 2.14.2 to 2.14.4 in /sdk/java/rest (@dependabot[bot])
- **PR #3208** (2026-09-30): build(deps): bump go.opentelemetry.io/otel/exporters/zipkin from 1.38.0 to 1.45.0 (@dependabot[bot])
- **PR #3204** (2026-09-11): fix playground enforcement tab (@omer-topal)
- **PR #3197** (2026-09-10): chore: update version to v1.7.4 in API docs and internal info file (@omer-topal)
- **PR #3196** (2026-09-10): build(deps): bump google.golang.org/grpc from 1.83.1 to 1.83.2 (@dependabot[bot])
- **PR #3195** (closed): test(dsl): add PositionInfo specs for override identifier token initialization (@gcoinstash-cmd)
- **PR #3194** (closed): test(dsl): add PositionInfo specs for ATTRIBUTE keyword token initialization (@gcoinstash-cmd)

---

## 3. Empirical Evidence & Compliance Certification
- **Evidence Provenance**: Fetched directly from verified official GitHub REST API.
- **Zero Disk Footprint**: 0 bytes of unnecessary repository bloat stored locally.
- **TOS & Free-Tier Adherence**: Request pace complied with public API guidelines without fee, penalty, or unauthorized scraping.

---

## 4. Promotion & Integration Status
- **Status**: HARVESTED_DEEP_FORENSIC
- **Master Brain Sync**: Auto-committed to local/remote Master Brain repository.
