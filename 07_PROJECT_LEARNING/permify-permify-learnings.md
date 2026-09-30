# Forensic Learning Record (Deep Inspection): Permify/permify

> **Canonical Artifact**: `07_PROJECT_LEARNING/permify-permify-learnings.md`  
> **Source Platform**: GitHub ([https://github.com/Permify/permify](https://github.com/Permify/permify))  
> **Harvest Method**: Full-Spectrum Deep Extraction (Patches, Diffs, Source Code, Post-Mortems)  
> **Harvest Timestamp**: 2026-09-30T17:27:08.418Z  
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

### Core Architecture Module: `cmd/permify/permify.go`
```
package main

import (
	"os"

	"github.com/cespare/xxhash/v2"

	"github.com/sercand/kuberesolver/v5"
	"google.golang.org/grpc/balancer"

	consistentbalancer "github.com/Permify/permify/pkg/balancer"
	"github.com/Permify/permify/pkg/cmd"
)

func main() {
	kuberesolver.RegisterInCluster()
	balancer.Register(consistentbalancer.NewBuilder(xxhash.Sum64))

	// Setup CLI commands
	root := cmd.NewRootCommand()

	// Add serve command
	serve := cmd.NewServeCommand()
	root.AddCommand(serve)

	// Add validate command
	validate := cmd.NewValidateCommand()
	root.AddCommand(validate)

	// Add coverage command
	coverage := cmd.NewCoverageCommand()
	root.AddCommand(coverage)

	// Add AST generation command
	ast := cmd.NewGenerateAstCommand()
	root.AddCommand(ast)

	// Add migrate command
	migrate := cmd.NewMigrateCommand()
	root.AddCommand(migrate)

	// Add version command
	version := cmd.NewVersionCommand()
	root.AddCommand(version)

	// Add config command
	config := cmd.NewConfigCommand()
	root.AddCommand(config)

	// Add repair command
	repair := cmd.NewRepairCommand()
	root.AddCommand(repair)

	if err := root.Execute(); err != nil {
		os.Exit(1)
	}
}

```

### Core Architecture Module: `internal/authn/authenticator.go`
```
package authn

import (
	"context"
)

// Authenticator - Interface for oidc authenticator
type Authenticator interface {
	Authenticate(ctx context.Context) error
}

```

### Core Architecture Module: `internal/authn/openid/adapter.go`
```
package openid

import (
	"log/slog"
)

// SlogAdapter adapts the slog.Logger to be compatible with retryablehttp.LeveledLogger.
type SlogAdapter struct {
	Logger *slog.Logger
}

// Error logs messages at error level.
func (a SlogAdapter) Error(msg string, keysAndValues ...interface{}) {
	a.Logger.Error(msg, keysAndValues...)
}

// Info logs messages at info level.
func (a SlogAdapter) Info(msg string, keysAndValues ...interface{}) {
	a.Logger.Info(msg, keysAndValues...)
}

// Debug logs messages at debug level.
func (a SlogAdapter) Debug(msg string, keysAndValues ...interface{}) {
	a.Logger.Info(msg, keysAndValues...)
}

// Warn logs messages at warn level.
func (a SlogAdapter) Warn(msg string, keysAndValues ...interface{}) {
	a.Logger.Warn(msg, keysAndValues...)
}

```

### Core Architecture Module: `internal/authn/openid/authn.go`
```
package openid

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"log/slog"
	"net/http"
	"strings"
	"sync"
	"time"

	"github.com/golang-jwt/jwt/v4"
	grpcauth "github.com/grpc-ecosystem/go-grpc-middleware/auth"
	"github.com/hashicorp/go-retryablehttp"
	"github.com/lestrrat-go/jwx/jwk"

	"github.com/Permify/permify/internal/config"
	base "github.com/Permify/permify/pkg/pb/base/v1"
)

type Authn struct {
	// URL of the issuer. This is typically the base URL of the identity provider.
	IssuerURL string
	// Audience for which the token is intended. It must match the audience in the JWT.
	Audience string
	// URL of the JSON Web Key Set (JWKS). This URL hosts public keys used to verify JWT signatures.
	JwksURI string
	// Pointer to an AutoRefresh object from the JWKS library. It helps in automatically refreshing the JWKS at predefined intervals.
	jwksSet *jwk.AutoRefresh
	// List of valid signing methods. Specifies which signing algorithms are considered valid for the JWTs.
	validMethods []string
	// Pointer to a JWT parser object. This is used to parse and validate the JWT tokens.
	jwtParser *jwt.Parser
	// Duration of the interval between retries for the backoff policy.
	backoffInterval time.Duration
	// Maximum number of retries for the backoff policy.
	backoffMaxRetries int

	backoffFrequency time.Duration

	// Global backoff state for tracking retry attempts across concurrent requests
	globalRetryCount int
	globalFirstSeen  time.Time
	retriedKeys      map[string]bool
	mutex            sync.Mutex // protects concurrent access to retry state
}

// NewOidcAuthn creates a new OIDC authenticator.
func NewOidcAuthn(ctx context.Context, conf config.Oidc) (*Authn, error) {
	// Create a new HTTP client with retry capabilities. This client is used for making HTTP requests, particularly for fetching OIDC configuration.
	client := retryablehttp.NewClient()
	client.Logger = SlogAdapter{Logger: slog.Default()}

	// Fetch the OIDC configuration from the issuer's well-known configuration endpoint.
	oidcConf, err := fetchOIDCConfiguration(client.StandardClient(), strings.TrimSuffix(conf.Issuer, "/")+"/.well-known/openid-configuration")
	if err != nil {
		return nil, fmt.Errorf("failed to fetch OIDC configuration: %w", err)
	}

	// Set up automatic refresh of the JSON Web Key Set (JWKS) to ensure the public keys are always up-to-date.
	autoRefresh := jwk.NewAutoRefresh(ctx)
	autoRefresh.Configure(oidcConf.JWKsURI, jwk.WithHTTPClient(client.StandardClient()), jwk.WithRefreshInterval(conf.RefreshInterval))

	// Validate and set backoffInterval, backoffMaxRetries, and backoffFrequency
	backoffInterval := conf.BackoffInterval
	if backoffInterval <= 0 {
		return nil, errors.New("invalid or missing backoffInterval")
	}

	backoffMaxRetries := conf.BackoffMaxRetries
	if backoffMaxRetries <= 0 {
		return nil, errors.New("invalid or missing backoffMaxRetries")
	}

	backoffFrequency := conf.BackoffFrequency
	if backoffFrequency <= 0 {
		return nil, errors.New("invalid or missing backoffFrequency")
	}

	// Initialize the Authn struct with the OIDC configuration details and other relevant settings.
	oidc := &Authn{
		IssuerURL:         conf.Issuer,
		Audience:          conf.Audience,
		JwksURI:           oidcConf.JWKsURI,
		validMethods:      conf.ValidMethods,
		jwtParser:         jwt.NewParser(jwt.WithValidMethods(conf.ValidMethods)),
		jwksSet:           autoRefresh,
		backoffInterval:   backoffInterval,
		backoffMaxRetries: backoffMaxRetries,
		backoffFrequency:  backoffFrequency,
		globalRetryCount:  0,
		retriedKeys:       make(map[string]bool),
		globalFirstSeen:   time.Time{},
		mutex:             sync.Mutex{},
	}

	// Attempt to fetch the JWKS immediately to ensure it's available and valid.
	if _, err := oidc.jwksSet.Fetch(ctx, oidc.JwksURI); err != nil {
		return nil, fmt.Errorf("failed to fetch JWKS: %w", err)
	}

	return oidc, nil
}

// Authenticate validates the JWT token found in the authorization header of the incoming request.
func (oidc *Authn) Authenticate(ctx context.Context) error {
	// Extract the authorization header from the metadata of the incoming gRPC request.
	authHeader, err := grpcauth.AuthFromMD(ctx, "Bearer")
	if err != nil { // Check for authentication errors
		slog.Error("failed to extract authorization header from gRPC request", "error", err)
		return errors.New(base.ErrorCode_ERROR_CODE_MISSING_BEARER_TOKEN.String())
	}
	slog.Debug("Successfully extracted authorization header from gRPC request")

	// Parse and validate the JWT token extracted from the authorization header.
	parsedToken, err := oidc.jwtParser.Parse(authHeader, func(token *jwt.Token) (interface{}, error) {
		slog.Info("starting JWT parsing and validation.")

		// Retrieve the key ID from the JWT header and find the corresponding key in the JWKS.
		keyID, ok := token.Header["kid"].(string)
		if ok { // Key ID found in token header
			return oidc.getKeyWithRetry(ctx, keyID)
		}
		slog.Error("jwt does not contain a key ID")
		return nil, errors.New("kid must be specified in the token header")
	})
	if err != nil {
		slog.Error("token parsing or validation failed", "error", err)
		return errors.New(base.ErrorCode_ERROR_CODE_INVALID_BEARER_TOKEN.String())
	}

	// Ensure the token is valid.
	if !parsedToken.Valid {
		slog.Warn("parsed token is invalid")
		return errors.New(base.ErrorCode_ERROR_CODE_INVALID_BEARER_TOKEN.String())
	}

	// Extract the claims from the token.
	claims, ok := parsedToken.Claims.(jwt.MapClaims)
	if !ok {
		slog.Warn("token claims are in an incorrect format")
		return errors.New(base.ErrorCode_ERROR_CODE_INVALID_CLAIMS.String())
	}

	slog.Debug("extracted token claims", "claims", claims)

	// Verify the issuer of the token matches the expected issuer.
	if ok := claims.VerifyIssuer(oidc.IssuerURL, true); !ok {
		slog.Warn("token issuer is invalid", "expected", oidc.IssuerURL, "actual", claims["iss"])
		return errors.New(base.ErrorCode_ERROR_CODE_INVALID_ISSUER.String())
	}
	// Verify the audience of the token matches the expected audience.

	if ok := claims.VerifyAudience(oidc.Audience, true); !ok {
		slog.Warn("token audience is invalid", "expected", oidc.Audience, "actual", claims["aud"])
		return errors.New(base.ErrorCode_ERROR_CODE_INVALID_AUDIENCE.String())
	}

	slog.Info("token validation succeeded")

	// If all validations pass, return nil indicating the token is valid.
	return nil
}

// getKeyWithRetry attempts to retrieve the key for the given keyID with retries using a custom backoff strategy.
func (oidc *Authn) getKeyWithRetry(
	ctx context.Context,
	keyID string,
) (interface{}, error) {
	var raw interface{}
	var err error

	oidc.mutex.Lock()
	now := time.Now()

	// Reset global state if the interval has passed
	if oidc.globalFirstSeen.IsZero() || time.Since(oidc.globalFirstSeen) >= oidc.backoffInterval {
		slog.Info("resetting state as interval has passed or first seen is zero", "keyID", keyID)
		oidc.globalFirstSeen = now
		oidc.globalRetryCount = 0
		oidc.retriedKeys = make(map[string]bool)
	} else if oidc.globalRetryCount >= oidc.backoffMaxRetries {
		// If max retries reached within the interval, unlock and check keyID once
		slog.Warn("max retries reached within interval, will check keyID once", "keyID", keyID)
		oidc.mutex.Unlock()

		// Try to fetch the keyID once
		raw, err = oidc.fetchKey(ctx, keyID)
		if err == nil { // Successfully fetched the key
			oidc.mutex.Lock()
			if _, wasRetried := oidc.retriedKeys[keyID]; wasRetried {
				// Reset global backoff state if a valid key is found and that key had been previously retried
				// Use case: prevents malicious keyIDs from blocking valid keyIDs
				// The valid KeyID should not reset counters for invalid keys
				slog.Info("valid key found in backoff period, resetting global state", "keyID", keyID)
				oidc.globalRetryCount = 0                // Reset retry counter
				oidc.globalFirstSeen = time.Time{}       // Reset timestamp
				oidc.retriedKeys = make(map[string]bool) // Clear 
```

### Core Architecture Module: `internal/authn/preshared/authn.go`
```
package preshared

import (
	"context"

	"google.golang.org/grpc/codes"
	"google.golang.org/grpc/status"

	grpcAuth "github.com/grpc-ecosystem/go-grpc-middleware/auth"
	"github.com/pkg/errors"

	"github.com/Permify/permify/internal/config"
	base "github.com/Permify/permify/pkg/pb/base/v1"
)

// KeyAuthn - Authentication Keys Structure
type KeyAuthn struct {
	keys map[string]struct{}
}

// NewKeyAuthn - Create New Authenticated Keys
func NewKeyAuthn(_ context.Context, cfg config.Preshared) (*KeyAuthn, error) {
	if len(cfg.Keys) < 1 {
		return nil, errors.New("pre shared key authn must have at least one key")
	}
	mapKeys := make(map[string]struct{})
	for _, k := range cfg.Keys {
		mapKeys[k] = struct{}{}
	}
	return &KeyAuthn{
		keys: mapKeys,
	}, nil
}

// Authenticate - Checking whether any API request contain keys
func (a *KeyAuthn) Authenticate(ctx context.Context) error {
	key, err := grpcAuth.AuthFromMD(ctx, "Bearer")
	if err != nil {
		return errors.New(base.ErrorCode_ERROR_CODE_MISSING_BEARER_TOKEN.String())
	}
	if _, found := a.keys[key]; found {
		return nil
	}
	return status.Error(codes.Unauthenticated, base.ErrorCode_ERROR_CODE_INVALID_KEY.String())
}

```

### Core Architecture Module: `internal/config/config.go`
```
package config

import (
	"fmt"
	"path/filepath"
	"time"

	"github.com/pkg/errors"

	"github.com/spf13/viper"
)

type (
	// Config is the main configuration structure containing various sections for different aspects of the application.
	Config struct {
		AccountID   string      `mapstructure:"account_id"`
		Server      Server      `mapstructure:"server"`      // Server configuration for both HTTP and gRPC
		Log         Log         `mapstructure:"logger"`      // Logging configuration
		Profiler    Profiler    `mapstructure:"profiler"`    // Profiler configuration
		Authn       Authn       `mapstructure:"authn"`       // Authentication configuration
		Tracer      Tracer      `mapstructure:"tracer"`      // Tracing configuration
		Meter       Meter       `mapstructure:"meter"`       // Metrics configuration
		Service     Service     `mapstructure:"service"`     // Service configuration
		Database    Database    `mapstructure:"database"`    // Database configuration
		Distributed Distributed `mapstructure:"distributed"` // Distributed configuration
	}

	// Server contains the configurations for both HTTP and gRPC servers.
	Server struct {
		Host         string `mapstructure:"host"` // Host for servers
		HTTP         HTTP   `mapstructure:"http"` // HTTP server configuration
		GRPC         GRPC   `mapstructure:"grpc"` // gRPC server configuration
		NameOverride string `mapstructure:"name_override"`
		RateLimit    int64  `mapstructure:"rate_limit"` // Rate limit configuration
	}

	// HTTP contains configuration for the HTTP server.
	HTTP struct {
		Enabled            bool      `mapstructure:"enabled"`              // Whether the HTTP server is enabled
		Port               string    `mapstructure:"port"`                 // Port for the HTTP server
		GRPCTargetHost     string    `mapstructure:"grpc_target_host"`     // Host the HTTP gateway uses to reach the local gRPC server
		TLSConfig          TLSConfig `mapstructure:"tls"`                  // TLS configuration for the HTTP server
		CORSAllowedOrigins []string  `mapstructure:"cors_allowed_origins"` // List of allowed origins for CORS
		CORSAllowedHeaders []string  `mapstructure:"cors_allowed_headers"` // List of allowed headers for CORS
	}

	// GRPC contains configuration for the gRPC server.
	GRPC struct {
		Port      string    `mapstructure:"port"` // Port for the gRPC server
		TLSConfig TLSConfig `mapstructure:"tls"`  // TLS configuration for the gRPC server
	}

	// TLSConfig contains configuration for TLS.
	TLSConfig struct {
		Enabled  bool   `mapstructure:"enabled"` // Whether TLS is enabled
		CertPath string `mapstructure:"cert"`    // Path to the certificate file
		KeyPath  string `mapstructure:"key"`     // Path to the key file
	}

	// Authn contains configuration for authentication.
	Authn struct {
		Enabled   bool      `mapstructure:"enabled"`   // Whether authentication is enabled
		Method    string    `mapstructure:"method"`    // The authentication method to be used
		Preshared Preshared `mapstructure:"preshared"` // Configuration for preshared key authentication
		Oidc      Oidc      `mapstructure:"oidc"`      // Configuration for OIDC authentication
	}

	// Preshared contains configuration for preshared key authentication.
	Preshared struct {
		Keys []string `mapstructure:"keys"` // List of preshared keys
	}
	// OIDC configuration structure
	// Oidc contains configuration for OIDC authentication.
	Oidc struct { // OIDC authentication config
		Issuer            string        `mapstructure:"issuer"`   // OIDC issuer URL
		Audience          string        `mapstructure:"audience"` // OIDC client ID
		RefreshInterval   time.Duration `mapstructure:"refresh_interval"`
		BackoffInterval   time.Duration `mapstructure:"backoff_interval"`
		BackoffFrequency  time.Duration `mapstructure:"backoff_frequency"`
		BackoffMaxRetries int           `mapstructure:"backoff_max_retries"`
		ValidMethods      []string      `mapstructure:"valid_methods"`
	}

	// Profiler contains configuration for the profiler.
	Profiler struct {
		Enabled bool   `mapstructure:"enabled"` // Whether the profiler is enabled
		Port    string `mapstructure:"port"`    // Port for the profiler
	}

	// Log contains configuration for logging.
	Log struct {
		Level       string   `mapstructure:"level"`    // Logging level
		Output      string   `mapstructure:"output"`   // Logging output format, e.g., text, json
		Enabled     bool     `mapstructure:"enabled"`  // Whether logging collection is enabled
		Exporter    string   `mapstructure:"exporter"` // Exporter for log data
		Endpoint    string   `mapstructure:"endpoint"` // Endpoint for the log exporter
		Insecure    bool     `mapstructure:"insecure"` // Connect to the collector using the HTTP scheme, instead of HTTPS.
		Urlpath     string   `mapstructure:"urlpath"`  // Path for the log exporter, if not defined /v1/logs will be used
		Headers     []string `mapstructure:"headers"`
		Protocol    string   `mapstructure:"protocol"`     // Protocol for the log exporter, http or grpc
		ServiceName string   `mapstructure:"service_name"` // Override the service name reported by the exporter (default: "permify")
	}

	// Tracer contains configuration for distributed tracing.
	Tracer struct {
		Enabled     bool     `mapstructure:"enabled"`  // Whether tracing collection is enabled
		Exporter    string   `mapstructure:"exporter"` // Exporter for tracing data
		Endpoint    string   `mapstructure:"endpoint"` // Endpoint for the tracing exporter
		Insecure    bool     `mapstructure:"insecure"` // Connect to the collector using the HTTP scheme, instead of HTTPS.
		Urlpath     string   `mapstructure:"urlpath"`  // Path for the tracing exporter, if not defined /v1/trace will be used
		Headers     []string `mapstructure:"headers"`
		Protocol    string   `mapstructure:"protocol"`     // Protocol for the tracing exporter, http or grpc
		ServiceName string   `mapstructure:"service_name"` // Override the service name reported by the exporter (default: "permify")
	}

	// Meter contains configuration for metrics collection and reporting.
	Meter struct {
		Enabled     bool     `mapstructure:"enabled"`  // Whether metrics collection is enabled
		Exporter    string   `mapstructure:"exporter"` // Exporter for metrics data
		Endpoint    string   `mapstructure:"endpoint"` // Endpoint for the metrics exporter
		Insecure    bool     `mapstructure:"insecure"` // Connect to the collector using the HTTP scheme, instead of HTTPS.
		Urlpath     string   `mapstructure:"urlpath"`  // Path for the metrics exporter, if not defined /v1/metrics will be used
		Headers     []string `mapstructure:"headers"`
		Interval    int      `mapstructure:"interval"`
		Protocol    string   `mapstructure:"protocol"`     // Protocol for the metrics exporter, http or grpc
		ServiceName string   `mapstructure:"service_name"` // Override the service name reported by the exporter (default: "permify")
	}

	// Service contains configuration for various service-level features.
	Service struct {
		CircuitBreaker bool       `mapstructure:"circuit_breaker"` // Whether to enable the circuit breaker pattern
		Watch          Watch      `mapstructure:"watch"`           // Watch service configuration
		Schema         Schema     `mapstructure:"schema"`          // Schema service configuration
		Permission     Permission `mapstructure:"permission"`      // Permission service configuration
		Data           Data       `mapstructure:"data"`            // Data service configuration
	}

	// Watch contains configuration for the watch service.
	Watch struct {
		Enabled bool `mapstructure:"enabled"`
	}

	// Schema contains configuration for the schema service.
	Schema struct {
		Cache Cache `mapstructure:"cache"` // Cache configuration for the schema service
	}

	// Permission contains configuration for the permission service.
	Permission struct {
		BulkLimit        int   `mapstructure:"bulk_limit"`        // Limit for bulk operations
		ConcurrencyLimit int   `mapstructur
```

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


### D2: Asynchronous State & Concurrency
- Analyzed concurrency guarantees, async pipelines, and event handling from PR resolutions and commit changes.

### D3: Error Boundaries, Recovery & Rollbacks
- Exception handling patterns and defect resolutions extracted from closed production bug issues:
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

- **Issue #2620** (2025-11-17): **Partial-write API ignores updates when using "entities" instead of "partials" field name**
  *Symptoms*: **Describe the bug**  Partial schema updates via the `/v1/tenants/{tenant_id}/schemas/partial-write` endpoint are ignored when the request uses `"entities"` instead of `"partials"` as the field name. The API expects `"partials"`, so updates are not applied and the schema remains unchanged.  **To Reproduce**  Steps to reproduce the behavior:  1. Send a PATCH request to `/v1/tenants/{tenant_id}/schemas/partial-write` 2. Use `"entities"` in the request body:  ```json {   "metadata": {     "schema_version": ""   },   "entities": {     "repository": {       "write": [         "relation member @user",         "permission invite = org.admin and (owner or member)"       ],       "delete": [         "edit"       ],       "update": [         "permission delete = member"       ]     }   } } ```  3. Read the schema back using `/v1/tenants/{tenant_id}/schemas/read` 4. The schema remains unchanged  **Expected behavior**  The partial updates should be applied to the schema. The request should work with `"partials"` as the field name:  ```json {   "metadata": {     "schema_version": ""   },   "partials": {     "repository": {       "write": [...],       "delete": [...],       "update": [...]     }   } } ```  **Additional context**  - The documentation in `docs/api-reference/schema/partial-write.mdx` incorrectly shows `"entities"` instead of `"partials"`, which led to this confusion - The proto definition in `proto/base/v1/service.proto` correctly defines the field as `partials` with `json_na

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

### Incident Patch 1: `7529af58` (2026-09-11)
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

### Incident Patch 2: `8b7e0c74` (2026-09-11)
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

### Incident Patch 3: `e00d0522` (2026-08-13)
**Commit Message**: Merge pull request #3084 from Permify/fix-broken-docs-links

docs: fix broken links

**File**: `docs/api-reference/bundle/write-bundle.mdx` (modified, +2/-2)
```diff
@@ -52,9 +52,9 @@ Let's say user:564 creates an organization:789 in your application. According to
 - organization:789#manager@user:564
 - organization:789$public|boolean:false
 
-Instead of using the [WriteData](./api-overview/data/write-data.md) endpoint, you can utilize [RunBundle](./api-overview/data/run-bundle.md) to create this data by simply providing specific identifiers.
+Instead of using the [WriteData](../data/write-data) endpoint, you can utilize [RunBundle](../data/run-bundle) to create this data by simply providing specific identifiers.
 
-An example request of [RunBundle](./api-overview/data/run-bundle.md) for this scenario:
+An example request of [RunBundle](../data/run-bundle) for this scenario:
 
 ```json
 POST /bundle
```

**File**: `docs/getting-started/examples/facebook-groups.mdx` (modified, +1/-1)
```diff
@@ -535,6 +535,6 @@ The validation result according to our example schema validation file:
 
 ## Need any help?
 
-This concludes the demonstration of the authorization structure for Facebook groups. To install and implement this see the [Set Up Permify](../../installation.md) section.
+This concludes the demonstration of the authorization structure for Facebook groups. To install and implement this see the [Set Up Permify](../../setting-up/installation/intro) section.
 
 If you need any kind of help, our team is happy to help you get started with Permify. If you'd like to learn more about using Permify in your app or have any questions about it, [schedule a consultation call with one of our account executives](https://www.permify.co/book-demo).
```

**File**: `docs/getting-started/examples/instagram.mdx` (modified, +1/-1)
```diff
@@ -325,4 +325,4 @@ The validation result according to our example schema validation file:
 
 ## Need any help?
 
-This is the end of the demonstration of the authorization structure for Instagram. To install and implement this see the [Set Up Permify](../../installation.md) section.
+This is the end of the demonstration of the authorization structure for Instagram. To install and implement this see the [Set Up Permify](../../setting-up/installation/intro) section.
```

**File**: `docs/getting-started/examples/mercury.mdx` (modified, +1/-1)
```diff
@@ -158,4 +158,4 @@ At last, as you can see we use the Rules to define access rights to withdraw whi
 
 ## Need any help?
 
-This is the end of the demonstration of the authorization structure for Mercury. To install and implement this see the [Set Up Permify](../../installation.md) section.
+This is the end of the demonstration of the authorization structure for Mercury. To install and implement this see the [Set Up Permify](../../setting-up/installation/intro) section.
```

**File**: `docs/getting-started/examples/notion.mdx` (modified, +1/-1)
```diff
@@ -538,6 +538,6 @@ The validation result according to our example schema validation file:
 
 ## Need any help?
 
-This is the end of the demonstration of the authorization structure for Notion. To install and implement this see the [Set Up Permify](../../installation.md) section.
+This is the end of the demonstration of the authorization structure for Notion. To install and implement this see the [Set Up Permify](../../setting-up/installation/intro) section.
 
 If you need any kind of help, our team is happy to help you get started with Permify. If you'd like to learn more about using Permify in your app or have any questions about it, [schedule a consultation call with one of our account executives](https://www.permify.co/book-demo).
```

---

### Incident Patch 4: `22d1001f` (2026-08-12)
**Commit Message**: Fix broken links in the permify docs

**File**: `docs/api-reference/bundle/write-bundle.mdx` (modified, +2/-2)
```diff
@@ -52,9 +52,9 @@ Let's say user:564 creates an organization:789 in your application. According to
 - organization:789#manager@user:564
 - organization:789$public|boolean:false
 
-Instead of using the [WriteData](./api-overview/data/write-data.md) endpoint, you can utilize [RunBundle](./api-overview/data/run-bundle.md) to create this data by simply providing specific identifiers.
+Instead of using the [WriteData](../data/write-data) endpoint, you can utilize [RunBundle](../data/run-bundle) to create this data by simply providing specific identifiers.
 
-An example request of [RunBundle](./api-overview/data/run-bundle.md) for this scenario:
+An example request of [RunBundle](../data/run-bundle) for this scenario:
 
 ```json
 POST /bundle
```

**File**: `docs/getting-started/examples/facebook-groups.mdx` (modified, +1/-1)
```diff
@@ -535,6 +535,6 @@ The validation result according to our example schema validation file:
 
 ## Need any help?
 
-This concludes the demonstration of the authorization structure for Facebook groups. To install and implement this see the [Set Up Permify](../../installation.md) section.
+This concludes the demonstration of the authorization structure for Facebook groups. To install and implement this see the [Set Up Permify](../../setting-up/installation/intro) section.
 
 If you need any kind of help, our team is happy to help you get started with Permify. If you'd like to learn more about using Permify in your app or have any questions about it, [schedule a consultation call with one of our account executives](https://www.permify.co/book-demo).
```

**File**: `docs/getting-started/examples/instagram.mdx` (modified, +1/-1)
```diff
@@ -325,4 +325,4 @@ The validation result according to our example schema validation file:
 
 ## Need any help?
 
-This is the end of the demonstration of the authorization structure for Instagram. To install and implement this see the [Set Up Permify](../../installation.md) section.
+This is the end of the demonstration of the authorization structure for Instagram. To install and implement this see the [Set Up Permify](../../setting-up/installation/intro) section.
```

**File**: `docs/getting-started/examples/mercury.mdx` (modified, +1/-1)
```diff
@@ -158,4 +158,4 @@ At last, as you can see we use the Rules to define access rights to withdraw whi
 
 ## Need any help?
 
-This is the end of the demonstration of the authorization structure for Mercury. To install and implement this see the [Set Up Permify](../../installation.md) section.
+This is the end of the demonstration of the authorization structure for Mercury. To install and implement this see the [Set Up Permify](../../setting-up/installation/intro) section.
```

**File**: `docs/getting-started/examples/notion.mdx` (modified, +1/-1)
```diff
@@ -538,6 +538,6 @@ The validation result according to our example schema validation file:
 
 ## Need any help?
 
-This is the end of the demonstration of the authorization structure for Notion. To install and implement this see the [Set Up Permify](../../installation.md) section.
+This is the end of the demonstration of the authorization structure for Notion. To install and implement this see the [Set Up Permify](../../setting-up/installation/intro) section.
 
 If you need any kind of help, our team is happy to help you get started with Permify. If you'd like to learn more about using Permify in your app or have any questions about it, [schedule a consultation call with one of our account executives](https://www.permify.co/book-demo).
```

---

### Incident Patch 5: `d36ff40f` (2026-08-11)
**Commit Message**: Merge pull request #3073 from Permify/dependabot/npm_and_yarn/docs/brace-expansion-1.1.18

build(deps): bump brace-expansion from 1.1.15 to 1.1.18 in /docs



---

### Incident Patch 6: `2a490262` (2026-08-11)
**Commit Message**: build(deps): bump brace-expansion from 1.1.15 to 1.1.18 in /docs

Bumps [brace-expansion](https://github.com/juliangruber/brace-expansion) from 1.1.15 to 1.1.18.
- [Release notes](https://github.com/juliangruber/brace-expansion/releases)
- [Commits](https://github.com/juliangruber/brace-expansion/compare/v1.1.15...v1.1.18)

---
updated-dependencies:
- dependency-name: brace-expansion
  dependency-version: 1.1.18
  dependency-type: indirect
...

Signed-off-by: dependabot[bot] <support@github.com>

**File**: `docs/package-lock.json` (modified, +3/-3)
```diff
@@ -4017,9 +4017,9 @@
       "license": "MIT"
     },
     "node_modules/brace-expansion": {
-      "version": "1.1.15",
-      "resolved": "https://registry.npmjs.org/brace-expansion/-/brace-expansion-1.1.15.tgz",
-      "integrity": "sha512-EwOCDEex4quD37XhqM3omwtMoJjr//isUZz1JopUNWms+4Z2ViyM/k1YIRePpoVNnQhENnxtFjLaxNHrT7xIUg==",
+      "version": "1.1.18",
+      "resolved": "https://registry.npmjs.org/brace-expansion/-/brace-expansion-1.1.18.tgz",
+      "integrity": "sha512-Edep/X9fGqVNmzKBVsDYIOtD+z1tuezV70LBjdCst9Tqu76lsnvRiZ6oTic1n+/BIwX6QDGAO94PN4N2SADvtw==",
       "license": "MIT",
       "dependencies": {
         "balanced-match": "^1.0.0",
```

#### Recent Merged Pull Requests:
- **PR #3208** (2026-09-30): build(deps): bump go.opentelemetry.io/otel/exporters/zipkin from 1.38.0 to 1.45.0 (@dependabot[bot])
- **PR #3204** (2026-09-11): fix playground enforcement tab (@omer-topal)
- **PR #3197** (2026-09-10): chore: update version to v1.7.4 in API docs and internal info file (@omer-topal)
- **PR #3196** (2026-09-10): build(deps): bump google.golang.org/grpc from 1.83.1 to 1.83.2 (@dependabot[bot])
- **PR #3195** (closed): test(dsl): add PositionInfo specs for override identifier token initialization (@gcoinstash-cmd)
- **PR #3194** (closed): test(dsl): add PositionInfo specs for ATTRIBUTE keyword token initialization (@gcoinstash-cmd)
- **PR #3193** (closed): test(dsl): add PositionInfo specs for user token literal initialization (@gcoinstash-cmd)
- **PR #3192** (closed): test(dsl): add PositionInfo specs for RULE keyword token initialization (@gcoinstash-cmd)

---

## 3. Empirical Evidence & Compliance Certification
- **Evidence Provenance**: Fetched directly from verified official GitHub REST API.
- **Zero Disk Footprint**: 0 bytes of unnecessary repository bloat stored locally.
- **TOS & Free-Tier Adherence**: Request pace complied with public API guidelines without fee, penalty, or unauthorized scraping.

---

## 4. Promotion & Integration Status
- **Status**: HARVESTED_DEEP_FORENSIC
- **Master Brain Sync**: Auto-committed to local/remote Master Brain repository.
