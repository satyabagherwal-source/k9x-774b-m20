# Forensic Learning Record (Deep Inspection): krakend/krakend-ce

> **Canonical Artifact**: `07_PROJECT_LEARNING/krakend-krakend-ce-learnings.md`  
> **Source Platform**: GitHub ([https://github.com/krakend/krakend-ce](https://github.com/krakend/krakend-ce))  
> **Harvest Method**: Full-Spectrum Deep Extraction (Patches, Diffs, Source Code, Post-Mortems)  
> **Harvest Timestamp**: 2026-10-06T02:12:57.926Z  
> **Compliance State**: Free Tier Guaranteed | Strict Rate-Limit Backoff Honored  

---

## 1. Context & Architectural Overview
- **Repository / Resource**: `krakend/krakend-ce`
- **Description**: KrakenD Community Edition: High-performance, stateless, declarative, API Gateway written in Go.
- **Primary Language / Ecosystem**: Go
- **Discovered Manifests / Configurations**: go.mod, README.md, Dockerfile
- **Stars / Engagement**: 2690 stars

---

## 2. Multi-Dimensional 8-Axis Investigation & Real Code Patches

### D1: Architecture & Structural Boundaries
- Entry configurations inspected via direct stream: go.mod, README.md, Dockerfile.
- Evaluated system abstractions and modular contracts.

### Core Architecture Module: `router_engine.go`
```
package krakend

import (
	"encoding/json"

	"github.com/gin-gonic/gin"

	botdetector "github.com/krakend/krakend-botdetector/v3/gin"
	httpsecure "github.com/krakend/krakend-httpsecure/v3/gin"
	lua "github.com/krakend/krakend-lua/v3/router/gin"
	"github.com/luraproject/lura/v3/config"
	"github.com/luraproject/lura/v3/core"
	luragin "github.com/luraproject/lura/v3/router/gin"
	"github.com/luraproject/lura/v3/transport/http/server"
)

// NewEngine creates a new gin engine with some default values and a secure middleware
func NewEngine(cfg config.ServiceConfig, opt luragin.EngineOptions) *gin.Engine {
	engine := luragin.NewEngine(cfg, opt)

	engine.NoRoute(defaultHandler)
	engine.NoMethod(defaultHandler)
	if v, ok := cfg.ExtraConfig[luragin.Namespace]; ok && v != nil {
		var ginOpts ginOptions
		if b, err := json.Marshal(v); err == nil {
			json.Unmarshal(b, &ginOpts)
		}
		if ginOpts.ErrorBody.Err404 != nil {
			engine.NoRoute(jsonHandler(404, ginOpts.ErrorBody.Err404))
		}
		if ginOpts.ErrorBody.Err405 != nil {
			engine.NoMethod(jsonHandler(405, ginOpts.ErrorBody.Err405))
		}
	}

	logPrefix := "[SERVICE: Gin]"
	if err := httpsecure.Register(cfg.ExtraConfig, engine); err != nil && err != httpsecure.ErrNoConfig {
		opt.Logger.Warning(logPrefix+"[HTTPsecure]", err)
	} else if err == nil {
		opt.Logger.Debug(logPrefix + "[HTTPsecure] Successfully loaded module")
	}

	lua.Register(opt.Logger, cfg.ExtraConfig, engine)

	botdetector.Register(cfg, opt.Logger, engine)

	return engine
}

func defaultHandler(c *gin.Context) {
	c.Header(core.KrakendHeaderName, core.KrakendHeaderValue)
	c.Header(server.CompleteResponseHeaderName, server.HeaderIncompleteResponseValue)
}

func jsonHandler(status int, v interface{}) gin.HandlerFunc {
	return func(c *gin.Context) {
		defaultHandler(c)
		c.JSON(status, v)
	}
}

type engineFactory struct{}

func (engineFactory) NewEngine(cfg config.ServiceConfig, opt luragin.EngineOptions) *gin.Engine {
	return NewEngine(cfg, opt)
}

type ginOptions struct {
	// ErrorBody sets the json body to return to handlers like NoRoute (404) and NoMethod (405)
	// Example: "404": { "error": "Not Found", "status": 404 }
	ErrorBody struct {
		Err404 interface{} `json:"404"`
		Err405 interface{} `json:"405"`
	} `json:"error_body"`
}

```

### Core Architecture Module: `backend_factory.go`
```
package krakend

import (
	"context"
	"fmt"

	amqp "github.com/krakend/krakend-amqp/v3"
	cel "github.com/krakend/krakend-cel/v3"
	cb "github.com/krakend/krakend-circuitbreaker/v4/gobreaker/proxy"
	httpcache "github.com/krakend/krakend-httpcache/v3"
	lambda "github.com/krakend/krakend-lambda/v3"
	lua "github.com/krakend/krakend-lua/v3/proxy"
	martian "github.com/krakend/krakend-martian/v3"
	metrics "github.com/krakend/krakend-metrics/v3/gin"
	oauth2client "github.com/krakend/krakend-oauth2-clientcredentials/v3"
	otellura "github.com/krakend/krakend-otel/v2/lura"
	pubsub "github.com/krakend/krakend-pubsub/v3"
	ratelimit "github.com/krakend/krakend-ratelimit/v4/proxy"
	"github.com/luraproject/lura/v3/config"
	"github.com/luraproject/lura/v3/logging"
	"github.com/luraproject/lura/v3/proxy"
	"github.com/luraproject/lura/v3/transport/http/client"
)

// NewBackendFactory creates a BackendFactory by stacking all the available middlewares:
// - oauth2 client credentials
// - http cache
// - martian
// - pubsub
// - amqp
// - cel
// - lua
// - rate-limit
// - circuit breaker
// - metrics collector
func NewBackendFactory(logger logging.Logger, metricCollector *metrics.Metrics) proxy.BackendFactory {
	return NewBackendFactoryWithContext(context.Background(), logger, metricCollector)
}

func newRequestExecutorFactory() func(*config.Backend) client.HTTPRequestExecutor {
	return func(cfg *config.Backend) client.HTTPRequestExecutor {
		clientFactory := client.NewHTTPClient
		if _, ok := cfg.ExtraConfig[oauth2client.Namespace]; ok {
			clientFactory = oauth2client.NewHTTPClient(cfg)
		}

		clientFactory = httpcache.NewHTTPClient(cfg, clientFactory)
		clientFactory = otellura.InstrumentedHTTPClientFactory(clientFactory, cfg)
		return client.DefaultHTTPRequestExecutor(clientFactory)
	}
}

func internalNewBackendFactory(
	ctx context.Context,
	requestExecutorFactory func(*config.Backend) client.HTTPRequestExecutor,
	logger logging.Logger,
	metricCollector *metrics.Metrics,
) proxy.BackendFactory {
	backendFactory := martian.NewConfiguredBackendFactory(logger, requestExecutorFactory)
	bf := pubsub.NewBackendFactory(ctx, logger, backendFactory)
	backendFactory = bf.New
	backendFactory = amqp.NewBackendFactory(ctx, logger, backendFactory)
	backendFactory = lambda.BackendFactory(logger, backendFactory)
	backendFactory = cel.BackendFactory(logger, backendFactory)
	backendFactory = lua.BackendFactory(logger, backendFactory)
	backendFactory = ratelimit.BackendFactory(logger, backendFactory)
	backendFactory = cb.BackendFactory(backendFactory, logger)
	backendFactory = metricCollector.BackendFactory("backend", backendFactory)
	backendFactory = otellura.BackendFactory(backendFactory)
	return func(remote *config.Backend) proxy.Proxy {
		logger.Debug(fmt.Sprintf("[BACKEND: %s %s -> %s %s] Building the backend pipe",
			remote.ParentEndpointMethod, remote.ParentEndpoint,
			remote.Method, remote.URLPattern))
		return backendFactory(remote)
	}
}

// NewBackendFactoryWithContext creates a BackendFactory by stacking all the available middlewares and injecting the received context
func NewBackendFactoryWithContext(ctx context.Context, logger logging.Logger, metricCollector *metrics.Metrics) proxy.BackendFactory {
	requestExecutorFactory := newRequestExecutorFactory()
	return internalNewBackendFactory(ctx, requestExecutorFactory, logger, metricCollector)
}

type backendFactory struct{}

func (backendFactory) NewBackendFactory(ctx context.Context, l logging.Logger, m *metrics.Metrics) proxy.BackendFactory {
	return NewBackendFactoryWithContext(ctx, l, m)
}

```

### Core Architecture Module: `cmd/krakend-ce/main.go`
```
// Krakend-ce sets up a complete KrakenD API Gateway ready to serve

package main

import (
	"context"
	"embed"
	"log"
	"os"
	"os/signal"
	"syscall"

	krakend "github.com/krakend/krakend-ce/v3"
	cmd "github.com/krakend/krakend-cobra/v3"
	flexibleconfig "github.com/krakend/krakend-flexibleconfig/v3"
	koanf "github.com/krakend/krakend-koanf/v2"
	"github.com/luraproject/lura/v3/config"
)

const (
	fcPartials  = "FC_PARTIALS"
	fcTemplates = "FC_TEMPLATES"
	fcSettings  = "FC_SETTINGS"
	fcPath      = "FC_OUT"
	fcEnable    = "FC_ENABLE"
)

//go:embed schema
var embedSchema embed.FS

func main() {
	sigs := make(chan os.Signal, 1)
	signal.Notify(sigs, syscall.SIGINT, syscall.SIGTERM)
	ctx, cancel := context.WithCancel(context.Background())
	defer cancel()

	go func() {
		select {
		case sig := <-sigs:
			log.Println("Signal intercepted:", sig)
			cancel()
		case <-ctx.Done():
		}
	}()

	krakend.RegisterEncoders()

	var cfg config.Parser
	cfg = koanf.New()
	if os.Getenv(fcEnable) != "" {
		cfg = flexibleconfig.NewTemplateParser(flexibleconfig.Config{
			Parser:    cfg,
			Partials:  os.Getenv(fcPartials),
			Settings:  os.Getenv(fcSettings),
			Path:      os.Getenv(fcPath),
			Templates: os.Getenv(fcTemplates),
		})
	}

	var rawSchema string
	schema, err := embedSchema.ReadFile("schema/schema.json")
	if err == nil {
		rawSchema = string(schema)
	}

	commandsToLoad := []cmd.Command{
		cmd.RunCommand,
		cmd.NewCheckCmd(rawSchema),
		cmd.VersionCommand,
		cmd.AuditCommand,
	}

	cmd.DefaultRoot = cmd.NewRoot(cmd.RootCommand, commandsToLoad...)
	cmd.DefaultRoot.Cmd.CompletionOptions.DisableDefaultCmd = true

	cmd.Execute(cfg, krakend.NewExecutor(ctx))
}

```

### Core Architecture Module: `cmd/krakend-integration/main.go`
```
package main

import (
	"flag"
	"fmt"
	"os"

	"github.com/krakend/krakend-ce/v3/tests"
)

func main() {
	flag.Parse()

	runner, tcs, err := tests.NewIntegration(nil, nil, nil)
	if err != nil {
		fmt.Println(err)
		os.Exit(1)
		return
	}

	errors := 0

	for _, tc := range tcs {
		if err := runner.Check(tc); err != nil {
			errors++
			fmt.Printf("%s: %s\n", tc.Name, err.Error())
			continue
		}
		fmt.Printf("%s: ok\n", tc.Name)
	}
	fmt.Printf("%d test completed\n", len(tcs))
	runner.Close()

	if errors == 0 {
		return
	}

	fmt.Printf("%d test failed\n", errors)
	os.Exit(1)
}

```

### Core Architecture Module: `encoding.go`
```
package krakend

import (
	rss "github.com/krakend/krakend-rss/v3"
	xml "github.com/krakend/krakend-xml/v3"
	ginxml "github.com/krakend/krakend-xml/v3/gin"
	"github.com/luraproject/lura/v3/router/gin"
)

// RegisterEncoders registers all the available encoders
func RegisterEncoders() {
	xml.Register()
	rss.Register()

	gin.RegisterRender(xml.Name, ginxml.Render)
}

```

### Core Architecture Module: `executor.go`
```
package krakend

import (
	"context"
	"fmt"
	"io"
	"net/http"
	"os"
	"time"

	"github.com/gin-gonic/gin"
	"github.com/go-contrib/uuid"
	"golang.org/x/sync/errgroup"

	krakendbf "github.com/krakend/bloomfilter/v3/krakend"
	asyncamqp "github.com/krakend/krakend-amqp/v3/async"
	audit "github.com/krakend/krakend-audit/v2"
	cel "github.com/krakend/krakend-cel/v3"
	cmd "github.com/krakend/krakend-cobra/v3"
	cors "github.com/krakend/krakend-cors/v3/gin"
	gelf "github.com/krakend/krakend-gelf/v3"
	gologging "github.com/krakend/krakend-gologging/v3"
	jose "github.com/krakend/krakend-jose/v3"
	logstash "github.com/krakend/krakend-logstash/v3"
	metrics "github.com/krakend/krakend-metrics/v3/gin"
	kotel "github.com/krakend/krakend-otel/v2"
	otellura "github.com/krakend/krakend-otel/v2/lura"
	otelgin "github.com/krakend/krakend-otel/v2/router/gin"
	usage "github.com/krakend/krakend-usage/v2"
	"github.com/luraproject/lura/v3/async"
	"github.com/luraproject/lura/v3/config"
	"github.com/luraproject/lura/v3/core"
	"github.com/luraproject/lura/v3/logging"
	"github.com/luraproject/lura/v3/proxy"
	router "github.com/luraproject/lura/v3/router/gin"
	"github.com/luraproject/lura/v3/sd/dnssrv"
	serverhttp "github.com/luraproject/lura/v3/transport/http/server"
)

// NewExecutor returns an executor for the cmd package. The executor initalizes the entire gateway by
// registering the components and composing a RouterFactory wrapping all the middlewares.
func NewExecutor(ctx context.Context) cmd.Executor {
	eb := new(ExecutorBuilder)
	return eb.NewCmdExecutor(ctx)
}

// SubscriberFactoriesRegister registers all the required subscriber factories from the available service
// discover components and adapters and returns a service register function.
// The service register function will register the service by the given name and port to all the available
// service discover clients
type SubscriberFactoriesRegister interface {
	Register(context.Context, config.ServiceConfig, logging.Logger) func(string, int)
}

// TokenRejecterFactory returns a jose.ChainedRejecterFactory containing all the required jose.RejecterFactory.
// It also should setup and manage any service related to the management of the revocation process, if required.
type TokenRejecterFactory interface {
	NewTokenRejecter(context.Context, config.ServiceConfig, logging.Logger, func(string, int)) (jose.ChainedRejecterFactory, error)
}

// MetricsAndTracesRegister registers the defined observability components and returns a metrics collector,
// if required.
type MetricsAndTracesRegister interface {
	Register(context.Context, config.ServiceConfig, logging.Logger) *metrics.Metrics
}

// EngineFactory returns a gin engine, ready to be passed to the KrakenD RouterFactory
type EngineFactory interface {
	NewEngine(config.ServiceConfig, router.EngineOptions) *gin.Engine
}

// ProxyFactory returns a KrakenD proxy factory, ready to be passed to the KrakenD RouterFactory
type ProxyFactory interface {
	NewProxyFactory(logging.Logger, proxy.BackendFactory, *metrics.Metrics) proxy.Factory
}

// BackendFactory returns a KrakenD backend factory, ready to be passed to the KrakenD proxy factory
type BackendFactory interface {
	NewBackendFactory(context.Context, logging.Logger, *metrics.Metrics) proxy.BackendFactory
}

// HandlerFactory returns a KrakenD router handler factory, ready to be passed to the KrakenD RouterFactory
type HandlerFactory interface {
	NewHandlerFactory(logging.Logger, *metrics.Metrics, jose.RejecterFactory) router.HandlerFactory
}

// LoggerFactory returns a KrakenD Logger factory, ready to be passed to the KrakenD RouterFactory
type LoggerFactory interface {
	NewLogger(config.ServiceConfig) (logging.Logger, io.Writer, error)
}

// RunServer defines the interface of a function used by the KrakenD router to start the service
type RunServer func(context.Context, config.ServiceConfig, http.Handler) error

// RunServerFactory returns a RunServer with several wraps around the injected one
type RunServerFactory interface {
	NewRunServer(logging.Logger, router.RunServerFunc) RunServer
}

// AgentStarter defines a type that starts a set of agents
type AgentStarter interface {
	Start(
		context.Context,
		[]*config.AsyncAgent,
		logging.Logger,
		chan<- string,
		proxy.Factory,
	) func() error
}

// ExecutorBuilder is a composable builder. Every injected property is used by the NewCmdExecutor method.
type ExecutorBuilder struct {
	LoggerFactory               LoggerFactory
	SubscriberFactoriesRegister SubscriberFactoriesRegister
	TokenRejecterFactory        TokenRejecterFactory
	MetricsAndTracesRegister    MetricsAndTracesRegister
	EngineFactory               EngineFactory

	ProxyFactory        ProxyFactory
	BackendFactory      BackendFactory
	HandlerFactory      HandlerFactory
	RunServerFactory    RunServerFactory
	AgentStarterFactory AgentStarter

	Middlewares []gin.HandlerFunc
}

// NewCmdExecutor returns an executor for the cmd package. The executor initializes the entire gateway by
// delegating most of the tasks to the injected collaborators. They register the components and
// compose a RouterFactory wrapping all the middlewares.
// Every nil collaborator is replaced by the default one offered by this package.
func (e *ExecutorBuilder) NewCmdExecutor(ctx context.Context) cmd.Executor {
	e.checkCollaborators()

	return func(cfg config.ServiceConfig) {
		cfg.Normalize()

		logger, gelfWriter, gelfErr := e.LoggerFactory.NewLogger(cfg)
		if gelfErr != nil {
			return
		}

		logger.Info(fmt.Sprintf("Starting KrakenD v%s", core.KrakendVersion))
		startReporter(ctx, logger, cfg)

		if wd, err := os.Getwd(); err == nil {
			logger.Info("Working directory is", wd)
		}

		dnssrv.SetTTL(cfg.DNSCacheTTL)

		metricCollector := e.MetricsAndTracesRegister.Register(ctx, cfg, logger)
		if metricsAndTracesCloser, ok := e.MetricsAndTracesRegister.(io.Closer); ok {
			defer metricsAndTracesCloser.Close()
		}

		// Initializes the global cache for the JWK clients if enabled in the config
		if err := jose.SetGlobalCacher(logger, cfg.ExtraConfig); err != nil && err != jose.ErrNoValidatorCfg {
			logger.Error("[SERVICE: JOSE]", err.Error())
		}
		tokenRejecterFactory, err := e.TokenRejecterFactory.NewTokenRejecter(
			ctx,
			cfg,
			logger,
			e.SubscriberFactoriesRegister.Register(ctx, cfg, logger),
		)
		if err != nil && err != krakendbf.ErrNoConfig {
			logger.Warning("[SERVICE: Bloomfilter]", err.Error())
		}

		bpf := e.BackendFactory.NewBackendFactory(ctx, logger, metricCollector)
		pf := e.ProxyFactory.NewProxyFactory(logger, bpf, metricCollector)
		// we move the proxy factory out of the default proxy factory to make
		// sure that is always the outer middleware and that wraps any internal
		// proxy layer middleware:
		pf = otellura.ProxyFactory(pf)

		agentPing := make(chan string, len(cfg.AsyncAgents))

		handlerF := e.HandlerFactory.NewHandlerFactory(logger, metricCollector, tokenRejecterFactory)
		handlerF = otelgin.New(handlerF)

		runServerChain := serverhttp.RunServerWithLoggerFactory(logger)
		runServerChain = otellura.GlobalRunServer(logger, runServerChain)
		runServerChain = router.RunServerFunc(e.RunServerFactory.NewRunServer(logger, runServerChain))

		// setup the krakend router
		routerFactory := router.NewFactory(router.Config{
			Engine: e.EngineFactory.NewEngine(cfg, router.EngineOptions{
				Logger: logger,
				Writer: gelfWriter,
				Health: (<-chan string)(agentPing),
			}),
			ProxyFactory:   pf,
			Middlewares:    e.Middlewares,
			Logger:         logger,
			HandlerFactory: handlerF,
			RunServer:      runServerChain,
		})

		// start the engines
		logger.Info("Starting the KrakenD instance")

		if len(cfg.AsyncAgents) == 0 {
			routerFactory.NewWithContext(ctx).Run(cfg)
			return
		}

		// start the async agents in the same error group as the router
		g, gctx := errgroup.WithContext(ctx)
		gctx, closeGroupCtx := context.WithCancel(gctx)

		if cfg.SequentialStart {
			waitAgents := e.AgentStarterFactory.Start(gctx, cfg.AsyncAgents, logger, (chan<- string)(agentPing), pf)
			g.Go(waitAgents)
		} else {
			g.Go(func() error {
				return e.AgentStarterFactory.Start(gctx, cfg.AsyncAgents, logger, (chan<- string)(agentPing), pf)()
			})
		}

		g.Go(func() error {
			logger.Info("[SERVICE: Gin] Building the router")
			routerFactory.NewWithContext(ctx).Run(cfg)
			closeGroupCtx()
			return nil
		})

		g.Wait()
	}
}

func (e *ExecutorBuilder) checkCollaborators() {
	if e.SubscriberFactoriesRegister == nil {
		e.SubscriberFactoriesRegister = new(registerSubscriberFactories)
	}
	if e.TokenRejecterFactory == nil {
		e.TokenRejecterFactory = new(BloomFilterJWT)
	}
	if e.MetricsAndTracesRegister == nil {
		e.MetricsAndTracesRegister = new(MetricsAndTraces)
	}
	if e.EngineFactory == nil {
		e.EngineFactory = new(engineFactory)
	}
	if e.ProxyFactory == nil {
		e.ProxyFactory = new(proxyFactory)
	}
	if e.BackendFactory == nil {
		e.BackendFactory = new(backendFactory)
	}
	if e.HandlerFactory == nil {
		e.HandlerFactory = new(handlerFactory)
	}
	if e.LoggerFactory == nil {
		e.LoggerFactory = new(LoggerBuilder)
	}
	if e.RunServerFactory == nil {
		e.RunServerFactory = new(DefaultRunServerFactory)
	}
	if e.AgentStarterFactory == nil {
		e.AgentStarterFactory = async.AgentStarter([]async.Factory{asyncamqp.StartAgent})
	}
}

// DefaultRunServerFactory creates the default RunServer by wrapping the injected RunServer
// with the CORS module
type DefaultRunServerFactory struct{}

func (*DefaultRunServerFactory) NewRunServer(l logging.Logger, next router.RunServerFunc) RunServer {
	return RunServer(cors.NewRunServerWithLogger(cors.RunServer(next), l))
}

// LoggerBuilder is the default BuilderFactory implementation.
type LoggerBuilder struct{}

// NewLogger sets up the logging components as defined at the configuration.
func (LoggerBuilder) NewLogger(cfg config.ServiceConfig) (logging.Logger, io.Writer, error) {
	var writers []io.Writer
	gelfWriter, gelfErr := gelf.NewWriter(cfg.ExtraConfi
```

### Core Architecture Module: `handler_factory.go`
```
package krakend

import (
	"fmt"

	botdetector "github.com/krakend/krakend-botdetector/v3/gin"
	jose "github.com/krakend/krakend-jose/v3"
	ginjose "github.com/krakend/krakend-jose/v3/gin"
	lua "github.com/krakend/krakend-lua/v3/router/gin"
	metrics "github.com/krakend/krakend-metrics/v3/gin"
	ratelimit "github.com/krakend/krakend-ratelimit/v4/router/gin"
	"github.com/luraproject/lura/v3/config"
	"github.com/luraproject/lura/v3/logging"
	"github.com/luraproject/lura/v3/proxy"
	router "github.com/luraproject/lura/v3/router/gin"
	"github.com/luraproject/lura/v3/transport/http/server"

	"github.com/gin-gonic/gin"
)

// NewHandlerFactory returns a HandlerFactory with a rate-limit and a metrics collector middleware injected
func NewHandlerFactory(logger logging.Logger, metricCollector *metrics.Metrics, rejecter jose.RejecterFactory) router.HandlerFactory {
	handlerFactory := router.CustomErrorEndpointHandler(logger, server.DefaultToHTTPError)
	handlerFactory = ratelimit.NewRateLimiterMw(logger, handlerFactory)
	handlerFactory = lua.HandlerFactory(logger, handlerFactory)
	handlerFactory = ginjose.HandlerFactory(handlerFactory, logger, rejecter)
	handlerFactory = metricCollector.NewHTTPHandlerFactory(handlerFactory)
	handlerFactory = botdetector.New(handlerFactory, logger)

	return func(cfg *config.EndpointConfig, p proxy.Proxy) gin.HandlerFunc {
		logger.Debug(fmt.Sprintf("[ENDPOINT: %s %s] Building the http handler", cfg.Method, cfg.Endpoint))
		return handlerFactory(cfg, p)
	}
}

type handlerFactory struct{}

func (handlerFactory) NewHandlerFactory(l logging.Logger, m *metrics.Metrics, r jose.RejecterFactory) router.HandlerFactory {
	return NewHandlerFactory(l, m, r)
}

```

### Core Architecture Module: `proxy_factory.go`
```
package krakend

import (
	"fmt"

	cel "github.com/krakend/krakend-cel/v3"
	jsonschema "github.com/krakend/krakend-jsonschema/v3"
	lua "github.com/krakend/krakend-lua/v3/proxy"
	metrics "github.com/krakend/krakend-metrics/v3/gin"
	"github.com/luraproject/lura/v3/config"
	"github.com/luraproject/lura/v3/logging"
	"github.com/luraproject/lura/v3/proxy"
)

func internalNewProxyFactory(logger logging.Logger, backendFactory proxy.BackendFactory,
	metricCollector *metrics.Metrics,
) proxy.Factory {
	proxyFactory := proxy.NewDefaultFactory(backendFactory, logger)
	proxyFactory = proxy.NewShadowFactory(proxyFactory)
	proxyFactory = jsonschema.ProxyFactory(logger, proxyFactory)
	proxyFactory = cel.ProxyFactory(logger, proxyFactory)
	proxyFactory = lua.ProxyFactory(logger, proxyFactory)
	proxyFactory = metricCollector.ProxyFactory("pipe", proxyFactory)
	return proxyFactory
}

// NewProxyFactory returns a new ProxyFactory wrapping the injected BackendFactory with the default proxy stack and a metrics collector
func NewProxyFactory(logger logging.Logger, backendFactory proxy.BackendFactory, metricCollector *metrics.Metrics) proxy.Factory {
	proxyFactory := internalNewProxyFactory(logger, backendFactory, metricCollector)

	return proxy.FactoryFunc(func(cfg *config.EndpointConfig) (proxy.Proxy, error) {
		logger.Debug(fmt.Sprintf("[ENDPOINT: %s %s] Building the proxy pipe", cfg.Method, cfg.Endpoint))
		return proxyFactory.New(cfg)
	})
}

type proxyFactory struct{}

func (proxyFactory) NewProxyFactory(logger logging.Logger, backendFactory proxy.BackendFactory, metricCollector *metrics.Metrics) proxy.Factory {
	return NewProxyFactory(logger, backendFactory, metricCollector)
}

```

### Core Architecture Module: `sd.go`
```
package krakend

import (
	"context"

	"github.com/luraproject/lura/v3/config"
	"github.com/luraproject/lura/v3/logging"
	"github.com/luraproject/lura/v3/sd/dnssrv"
)

// RegisterSubscriberFactories registers all the available sd adaptors
func RegisterSubscriberFactories(_ context.Context, _ config.ServiceConfig, _ logging.Logger) func(n string, p int) {
	// register the dns service discovery
	dnssrv.Register()

	return func(name string, port int) {}
}

type registerSubscriberFactories struct{}

func (registerSubscriberFactories) Register(ctx context.Context, cfg config.ServiceConfig, logger logging.Logger) func(n string, p int) {
	return RegisterSubscriberFactories(ctx, cfg, logger)
}

```


### D2: Asynchronous State & Concurrency
- Analyzed concurrency guarantees, async pipelines, and event handling from PR resolutions and commit changes.

### D3: Error Boundaries, Recovery & Rollbacks
- Exception handling patterns and defect resolutions extracted from closed production bug issues:
- **Issue #910** (2024-07-21): **Golang version mismatch between 2.70 krakend Docker release and krakend/builder**
  *Symptoms*: **Environment info:**  * KrakenD version: 2.7.0 * System info: Darwin AMD64 * Hardware specs: 8-core, 32GB * Backend technology: Go * Additional environment information:  **Describe the bug** There seems to be a version mismatch between the golang version used for building krakend in the Docker 2.7.0 release  (devopsfaith/krakend:2.7.0) and the Go version used in [krakend/builder](https://hub.docker.com/r/krakend/builder) version 2.7.0.  The krakend Docker release is built with Go version 1.22.2: ``` docker run -ti devopsfaith/krakend:2.7.0 version KrakenD Version: 2.7.0 Go Version: 1.22.2 Glibc Version: MUSL-1.2.4_(alpine-3.18.6) ```  While the builder is using Go version 1.22.5:  ``` docker run -it -v "$PWD:/app" -w /app krakend/builder:2.7.0 go version go version go1.22.5 linux/amd64 ```  **Commands used** How did you start the software? ``` docker run -it -v "$PWD:/app" -w /app \ krakend/builder:2.7.0 \ go build -buildmode=plugin -o my-plugin.so . ``` And running krakend: ``` docker run -p "8080:8080" -v $PWD:/etc/krakend/ devopsfaith/krakend:2.7.0 run -c krakend.json run ```  **Expected behavior** Succesful loading of the plugin  **Logs** ``` 2024/07/20 14:32:42 KRAKEND DEBUG: [SERVICE: Executor Plugin] plugin #0 (/etc/krakend/my-plugin.so): plugin.Open("/etc/krakend/my-plugin.so"): plugin was built with a different version of package internal/godebugs 2024/07/20 14:32:42 KRAKEND DEBUG: [SERVICE: Handler Plugin] plugin #0 (/etc
  **Post-Mortem & Fix Analysis**:
  > Yes, this is a major issue, as I can’t upgrade to version 2.7.0 of Krankend because the plugins generated with the 2.7.0 version of the builder won’t load.
  > We are aware of the issue. We are rebuilding the 2.7.0 binaries to use the latest builder.
  > Docker containers and packages are already updated to use the latest Golang version (1.22.5) and now matches the version used by the krakend-builder.

- **Issue #871** (2024-04-17): **OTEL Dependency Panic**
  *Symptoms*: Migrating from 2.5.0 to 2.6.1  the issue also happens on: 2.6.0  targeting ARM machines  just ran the same deployment I had, updating the OTEL config to: ```yaml     "telemetry/opentelemetry": {       "metric_reporting_period": 0,       "exporters": {         "prometheus": [           {             "port": 9091,             "name": "krakend"           }         ]       }     } ```   Stack Trace ```go Parsing configuration file: /etc/krakend/krakend.json 2024/04/10 22:09:17 KRAKEND INFO: Starting KrakenD v2.6.1 2024/04/10 22:09:17 KRAKEND INFO: Working directory is /etc/krakend 2024/04/10 22:09:17 KRAKEND DEBUG: [SERVICE: Gin] Debug enabled 2024/04/10 22:09:17 KRAKEND DEBUG: [SERVICE: Gin][HTTPsecure] Successfuly loaded module 2024/04/10 22:09:17 KRAKEND DEBUG: [SERVICE: Gin][Botdetector] The bot detector has been registered successfully 2024/04/10 22:09:17 KRAKEND INFO: Starting the KrakenD instance  ... for brevity, it was removed  2024/04/10 22:02:08 http2: panic serving 10.1.21.208:36858: interface conversion: *http.http2responseWriter is not http.Hijacker: missing method Hijack goroutine 131196 [running]: net/http.(*http2serverConn).runHandler.func1() /usr/local/go/src/net/http/h2_bundle.go:6104 +0x138 panic({0x2d73560, 0x4027f6a510}) /usr/local/go/src/runtime/panic.go:884 +0x1f4 github.com/krakend/krakend-otel/http/server.newTrackingResponseWriter(...) /go/pkg/mod/github.com/krakend/krakend-otel@v0.2.0/http/server/response_writer.
  **Post-Mortem & Fix Analysis**:
  > now I am blind =D I can't see any metrics because I had to disable it
  > sounds like some package is using some different package version which it doesn't implement Hijacker interface
  > Hi @karmops  Opentelemetry didn't exist in v2.5, only 2.6. That configuration works fine for me, can you share instructions to generate that panic? I've tried on amd64 and arm64 hosts.

- **Issue #713** (2023-05-03): **Unnecessary logging of JWK cache ERROR**
  *Symptoms*: * KrakenD version: 2.3.0  **Describe the bug** The new `2.3.0` introduces two unnecessary log errors associated to the new JWK global cache component: ``` 2023/04/20 15:32:56 KRAKEND ERROR: [SERVICE: JOSE] no config 2023/04/20 15:32:56 KRAKEND ERROR: [SERVICE: JOSE] no config ``` 
  **Post-Mortem & Fix Analysis**:
  > Fixed in #723 
  > This issue was marked as resolved a long time ago and now has been automatically locked as there has not been any recent activity after it. You can still open a new issue and reference this link.

- **Issue #700** (2023-03-30): **hide_version_header setting changes X-Forwarder-For header**
  *Symptoms*: **Environment info:**  * KrakenD version: CE 2.1.4 * System info: docker * Hardware specs: 8 cores, 16 GB RAM * Backend technology: Python (FastAPI)  **Describe the bug** Hello! I discovered very strange and sneaky bug - using [new `hide_version_header` setting](https://www.krakend.io/docs/service-settings/router-options/) changes the `X-Forwarded-For` header. **Not only if you enable this option, but even you disable it explicitly**.  I have next setup:   `Nginx -> krakend -> gunicorn (app server)`  For example, when I make a request from my browser to backend container through Nginx, I check IP address in `X-Forwarder-For` header in backend app: ``` Docker gateway: 192.168.224.1  No hide_version_header setting:  192.168.224.19    192.168.224.16    192.168.224.13 Nginx          -> krakend        -> gunicorn  ->    application shows x-forwarded-for: 192.168.224.1 (real IP address)   "hide_version_header": true (or even false)  192.168.224.19    192.168.224.16    192.168.224.13 Nginx          -> krakend        -> gunicorn  ->    application  shows x-forwarded-for: 192.168.224.19 (IP address of nginx) ```    **Your configuration file**: ```json {   "version": 3,   "plugin": {     "pattern": ".so",     "folder": "/plugins/"   },   "extra_config": {     "security/cors": {       "allow_origins": ["http*"],       "allow_methods": [         "GET", "HEAD", "POST", "PUT", "DELETE", "OPTIONS", "PATCH"       ],       "allow_headers": [      
  **Post-Mortem & Fix Analysis**:
  > Hi @alex-pobeditel-2004   This looks like it's a duplicate of #689  We are looking to fix it in [lura](https://github.com/luraproject/lura/issues/647).  Thank you for reporting.
  >   An issue like this already exists, please follow it in the other thread  --- > This is an automated comment. Responding to the bot or mentioning it won't have any effect 
  > @taik0 thank you for a link on the original problem! It's a pity that I didn't find it before reporting this one :)   Will watch it for the fix.

- **Issue #689** (2023-04-27): **Behavior change when "extra_config" > "router" is populated in krakend.json. X-Forwarded-For and ips field are not what's expected**
  *Symptoms*: **Environment info:**  * KrakenD version: tested with docker 2.0.4, 2.2.0 (screenshots) and latest (2.2.1) as of writing the bug report. Bug seen on kubernetes hosted on GCP * System info: Darwin 22.2.0 arm64 * Hardware specs: M1 8Go * Backend technology: All of them ? * Additional environment information:  **Describe the bug** It seems that when there is anything inside the field "router" of "extra_config", the behavior of the router change. I do not know to what extend it changes, but at least the handling of the header X-Forwarded-For is impacted  I would expect that when we receive a header X-Forwarded-For, its content should be enriched with krakend Ip and forwarded to the pod or at least the first IP in the list should be used as the origin Ip. Currently without any configuration in the router field, the first IP in the list is used as the origin Ip wich is fine for our usecase. But with any configuration in the router field, a local ip is used instead of the one in X-Forwarded-For.   We are seeing this on our production servers. Krakend is deployed on a kubernetes cluster and is behind nginx and google http balancer [that uses X-Forwarded-For to forward callers Ip](https://cloud.google.com/load-balancing/docs/https) We also receive request from other servers that are forwarded for an end user. Those server use X-Forwarded-For transfering the user true ip.   **Your configuration file**: I've recreated a very basic configuration file for error reprodu
  **Post-Mortem & Fix Analysis**:
  > Hi @Paraplegix , thanks for the detailed issue. I wish all issues were like yours.  Thanks to your details we were able to quickly identify the problem, and the bug will be fixed in Lura.
  > Fixed in https://github.com/luraproject/lura/pull/654
  > Krakend version v2.3.2 uses lura v2.2.7, which has the mentioned fix (luraproject/lura#654). However in my tests the problem still shows up.  If needed I can provide docker-compose.yaml and curl examples to reproduce. @alombarte could you please check if the fix is effective? thanks

- **Issue #679** (2023-02-22): **`krakend audit` commands alerts on a HIGH vulnerability in config file even though it is mitigated**
  *Symptoms*: **Environment info:**  Version: 2.2.0 docker Kubernetes Java  **Describe the bug** `kubectl audit` commands alerts on a HIGH vulnerability in config file even though it is mitigated as per the recommendation:  ``` $ krakend audit --severity CRITICAL,HIGH -c krakend.json  ```  Result (redacted) ``` 2.1.7   [HIGH]          Enable HTTP security header checks (security/http). ```  **Your configuration file**: <!-- The content of your `krakend.json`. When using the flexible configuration option, the computed file can be generated specifying the env var FC_OUT=out.json -->  ```json {   "$schema": "https://www.krakend.io/schema/v3.json",   "version": 3,   "name": "brand API Gateway - Dev",   "timeout": "10s",   "output_encoding": "json",   "cache_ttl": "300s",   "tls": {     "public_key": "/etc/ssl/brand/tls.crt",     "private_key": "/etc/ssl/brand/tls.key",     "min_version": "TLS12",     "max_version": "TLS13"   },   "extra_config": {     "router": {       "logger_skip_paths": [         "/__health"       ]     },     "security/http": {       "ssl_proxy_headers": {         "X-Forwarded-Proto": "https"       },       "host_proxy_headers": [         "X-Forwarded-Hosts"       ],       "ssl_redirect": true,       "ssl_host": "api.dev.brand.ae",       "sts_seconds": 300,       "sts_include_subdomains": true,       "frame_deny": true,       "referrer_policy": "same-origin",       "content_type_nosniff": true,       "browser_xss_filt
  **Post-Mortem & Fix Analysis**:
  > Hello @shariqmus, thanks for reporting this.  While we investigate this issue, you can continue using the audit command by filtering any undesired warnings, e.g.: ``` krakend audit --severity CRITICAL,HIGH -i 2.1.7,x.x.x -c krakend.json ``` Where `x.x.x` is the identifier of any other rule.  Not related to the issue, but I read in diagonal your configuration, and I noticed a few incorrect usages: - The `concurrent_calls` is a value to be used with caution; a `5` means multiplying x5 the backend pressure. Nevertheless, it has no effect because the endpoint is a non-safe method (POST) - The circuit breaker won't do anything because it's misplaced. It belongs to the backend, not the endpoint. - The `log-status_change` contains a type. It should read `log_status_change`  I would recommend adding `krakend check -tlc krakend.json` to your development pipeline.  I hope the quick review is helpful to you.
  > This issue was marked as resolved a long time ago and now has been automatically locked as there has not been any recent activity after it. You can still open a new issue and reference this link.

- **Issue #621** (2023-03-08): **Installation of krakend-integration fails in Go 1.18 or higher**
  *Symptoms*: <!-- Thank you for reporting a bug of KrakenD. Please spend some time to fill all the requested information in this template.  Having the proper context and detailed information will help us KrakenD maintainers to investigate this issue faster. Unfortunately, we have to leave issues that we don't wholly understand or require more information for a much later processing. -->  As per the instructions in https://www.krakend.io/docs/developer/integration-tests/, running `go install github.com/krakendio/krakend-ce/v2/cmd/krakend-integration@v2.1.2` should add the binary to my PATH.  However, the package download fails in Go version 1.18 or higher:  ```  » go version go version go1.19.3 darwin/amd64  » go install github.com/krakendio/krakend-ce/v2/cmd/krakend-integration@v2.1.2 go: github.com/krakendio/krakend-ce/v2/cmd/krakend-integration@v2.1.2 (in github.com/krakendio/krakend-ce/v2@v2.1.2):         The go.mod file for the module providing named packages contains one or         more replace directives. It must not contain directives that would cause         it to be interpreted differently than if it were the main module. ```   As a temporary workaround, running tests in Go 1.17 does the trick, but it would be nice to have version parity between tests and running environments of `krakend-ce`. 
  **Post-Mortem & Fix Analysis**:
  > Hi @jguerreiro-sqsp   Thank you for reporting this issue.  We are looking into removing the go mod replace directives for the next version. As a workaround, if you clone the git repository and run the go install from the krakend-integration directory should do the trick.
  > Duplicates #470 
  > This issue is marked as stale because it has been open over 90 days with no activity. Remove the stale label or comment or this will be closed in 15 days.

- **Issue #594** (2022-10-04): **Docker image "watch" doesn't start**
  *Symptoms*: **Environment info:**  * KrakenD version: Presumably 2.1.0 * System info: Darwin 21.4.0 x86_64 * Hardware specs: 3.3 Ghz Quad-Core Intel Core i5, 32 Gb RAM * Backend technology: ... * Additional environment information:  **Describe the bug**  1. Attempting to run the latest "watch" image (d8aaa4d64740) on iMac x86 results in the following error:  ```shell Watching changes on files /etc/krakend/ Ignoring saves to file out.json qemu-aarch64: Could not open '/lib/ld-musl-aarch64.so.1': No such file or directory ```  Previous version (2.0.6-watch) runs as expected.  2. Attempting to run the latest "watch" image (d8aaa4d64740) on MacBook Pro M1 (ARM64) results in the following error:  ```shell WARNING: The requested image's platform (linux/amd64) does not match the detected host platform (linux/arm64/v8) and no specific platform was requested Watching changes on files /etc/krakend/ Ignoring saves to file out.json /entrypoint.sh: line 10: /usr/bin/reflex: not found ```  Previous version (2.0.6-watch) runs as expected.   **Your configuration file**: <!-- The content of your `krakend.json`. When using the flexible configuration option, the computed file can be generated specifying the env var FC_OUT=out.json -->  ```json {   "$schema": "https://www.krakend.io/schema/v3.json",   "version": 3,   "name": "API Gateway",   "extra_config": {     "telemetry/logging": {       "level": "DEBUG",       "prefix": "[KRAKEND]",       "syslog": false,   
  **Post-Mortem & Fix Analysis**:
  > Hi @alg , thank you for reporting. Looks like I added a reflex binary for arm64 instead of the amd64 one. If you pull the container again it should work!
  > This issue was marked as resolved a long time ago and now has been automatically locked as there has not been any recent activity after it. You can still open a new issue and reference this link.

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

### Incident Patch 1: `1bd4af95` (2026-09-30)
**Commit Message**: Merge pull request #1124 from krakend/fix_config_example

Update config version and schema in the configuration example.

**File**: `krakend.json` (modified, +2/-2)
```diff
@@ -1,6 +1,6 @@
 {
-    "$schema": "https://www.krakend.io/schema/v2.5/krakend.json",
-    "version": 3,
+    "$schema": "https://www.krakend.io/schema/v3.0/krakend.json",
+    "version": 4,
     "name": "My lovely gateway",
     "port": 8080,
     "cache_ttl": "3600s",
```

---

### Incident Patch 2: `1ba61376` (2026-09-30)
**Commit Message**: fix benchmark and integration tests

Signed-off-by: kpacha <[REDACTED_EMAIL]>

**File**: `tests/fixtures/bench.json` (modified, +1/-1)
```diff
@@ -1,5 +1,5 @@
 {
-    "version":3,
+    "version":4,
     "host":["http://localhost:8080"],
     "read_header_timeout":"200ms",
     "extra_config": {
```

**File**: `tests/fixtures/krakend.json` (modified, +1/-1)
```diff
@@ -1,5 +1,5 @@
 {
-    "version": 3,
+    "version": 4,
     "$schema": "https://krakend.io/schema/krakend.json",
     "name": "My lovely gateway",
     "port": 8080,
```

---

### Incident Patch 3: `dc4321e9` (2026-09-18)
**Commit Message**: Merge pull request #1119 from krakend/dependabot/go_modules/go.opentelemetry.io/otel/exporters/otlp/otlptrace/otlptracegrpc-1.45.0

Bump go.opentelemetry.io/otel/exporters/otlp/otlptrace/otlptracegrpc from 1.44.0 to 1.45.0

**File**: `go.mod` (modified, +1/-1)
```diff
@@ -249,7 +249,7 @@ require (
 	go.opentelemetry.io/otel/exporters/otlp/otlpmetric/otlpmetricgrpc v1.44.0 // indirect
 	go.opentelemetry.io/otel/exporters/otlp/otlpmetric/otlpmetrichttp v1.44.0 // indirect
 	go.opentelemetry.io/otel/exporters/otlp/otlptrace v1.45.0 // indirect
-	go.opentelemetry.io/otel/exporters/otlp/otlptrace/otlptracegrpc v1.44.0 // indirect
+	go.opentelemetry.io/otel/exporters/otlp/otlptrace/otlptracegrpc v1.45.0 // indirect
 	go.opentelemetry.io/otel/exporters/otlp/otlptrace/otlptracehttp v1.45.0 // indirect
 	go.opentelemetry.io/otel/exporters/prometheus v0.47.0 // indirect
 	go.opentelemetry.io/otel/metric v1.45.0 // indirect
```

**File**: `go.sum` (modified, +2/-2)
```diff
@@ -816,8 +816,8 @@ go.opentelemetry.io/otel/exporters/otlp/otlpmetric/otlpmetrichttp v1.44.0 h1:Ruy
 go.opentelemetry.io/otel/exporters/otlp/otlpmetric/otlpmetrichttp v1.44.0/go.mod h1:qZF+/lBs71APw8mlnEZcqZHMzqrYrsFiJOv83lX1OGo=
 go.opentelemetry.io/otel/exporters/otlp/otlptrace v1.45.0 h1:QRefszxJmfPdjXUUm3j6iDzY03mTPXMjqErFqQ67vUg=
 go.opentelemetry.io/otel/exporters/otlp/otlptrace v1.45.0/go.mod h1:Tiz03lTBVBrm7eWZBOidzEaYaJa8tjwGUGv6d8mlTyk=
-go.opentelemetry.io/otel/exporters/otlp/otlptrace/otlptracegrpc v1.44.0 h1:qazEJlUOQzhCpzQpFETGby7EdqjI1wsd0W+6Gg1SCTU=
-go.opentelemetry.io/otel/exporters/otlp/otlptrace/otlptracegrpc v1.44.0/go.mod h1:fOD2Yefuxixkx3ahVNf0O/PERb6r4OlbxfATVnYvzCo=
+go.opentelemetry.io/otel/exporters/otlp/otlptrace/otlptracegrpc v1.45.0 h1:fG5MCxGz8+2VtrN/WgqSpJFctVz24gpxj8CxkKmc8Ww=
+go.opentelemetry.io/otel/exporters/otlp/otlptrace/otlptracegrpc v1.45.0/go.mod h1:BmAYTn+3ysbRe+IU2msxmf5Rx3g6DHvex+tWI3LdhYI=
 go.opentelemetry.io/otel/exporters/otlp/otlptrace/otlptracehttp v1.45.0 h1:QBajQ2SrwQijzHyZbQlPsuIzpl/ll8DY6wPWsajeGcI=
 go.opentelemetry.io/otel/exporters/otlp/otlptrace/otlptracehttp v1.45.0/go.mod h1:08ZQLjrPLQ6R4kAXvuOvODEer5Yh4CoFvll5qB2BCI8=
 go.opentelemetry.io/otel/exporters/prometheus v0.47.0 h1:OL6yk1Z/pEGdDnrBbxSsH+t4FY1zXfBRGd7bjwhlMLU=
```

---

### Incident Patch 4: `70e554ba` (2026-09-18)
**Commit Message**: Bump go.opentelemetry.io/otel/exporters/otlp/otlptrace/otlptracegrpc

Bumps [go.opentelemetry.io/otel/exporters/otlp/otlptrace/otlptracegrpc](https://github.com/open-telemetry/opentelemetry-go) from 1.44.0 to 1.45.0.
- [Release notes](https://github.com/open-telemetry/opentelemetry-go/releases)
- [Changelog](https://github.com/open-telemetry/opentelemetry-go/blob/main/CHANGELOG.md)
- [Commits](https://github.com/open-telemetry/opentelemetry-go/compare/v1.44.0...v1.45.0)

---
updated-dependencies:
- dependency-name: go.opentelemetry.io/otel/exporters/otlp/otlptrace/otlptracegrpc
  dependency-version: 1.45.0
  dependency-type: indirect
...

Signed-off-by: dependabot[bot] <[REDACTED_EMAIL]>

**File**: `go.mod` (modified, +1/-1)
```diff
@@ -249,7 +249,7 @@ require (
 	go.opentelemetry.io/otel/exporters/otlp/otlpmetric/otlpmetricgrpc v1.44.0 // indirect
 	go.opentelemetry.io/otel/exporters/otlp/otlpmetric/otlpmetrichttp v1.44.0 // indirect
 	go.opentelemetry.io/otel/exporters/otlp/otlptrace v1.45.0 // indirect
-	go.opentelemetry.io/otel/exporters/otlp/otlptrace/otlptracegrpc v1.44.0 // indirect
+	go.opentelemetry.io/otel/exporters/otlp/otlptrace/otlptracegrpc v1.45.0 // indirect
 	go.opentelemetry.io/otel/exporters/otlp/otlptrace/otlptracehttp v1.45.0 // indirect
 	go.opentelemetry.io/otel/exporters/prometheus v0.47.0 // indirect
 	go.opentelemetry.io/otel/metric v1.45.0 // indirect
```

**File**: `go.sum` (modified, +2/-2)
```diff
@@ -816,8 +816,8 @@ go.opentelemetry.io/otel/exporters/otlp/otlpmetric/otlpmetrichttp v1.44.0 h1:Ruy
 go.opentelemetry.io/otel/exporters/otlp/otlpmetric/otlpmetrichttp v1.44.0/go.mod h1:qZF+/lBs71APw8mlnEZcqZHMzqrYrsFiJOv83lX1OGo=
 go.opentelemetry.io/otel/exporters/otlp/otlptrace v1.45.0 h1:QRefszxJmfPdjXUUm3j6iDzY03mTPXMjqErFqQ67vUg=
 go.opentelemetry.io/otel/exporters/otlp/otlptrace v1.45.0/go.mod h1:Tiz03lTBVBrm7eWZBOidzEaYaJa8tjwGUGv6d8mlTyk=
-go.opentelemetry.io/otel/exporters/otlp/otlptrace/otlptracegrpc v1.44.0 h1:qazEJlUOQzhCpzQpFETGby7EdqjI1wsd0W+6Gg1SCTU=
-go.opentelemetry.io/otel/exporters/otlp/otlptrace/otlptracegrpc v1.44.0/go.mod h1:fOD2Yefuxixkx3ahVNf0O/PERb6r4OlbxfATVnYvzCo=
+go.opentelemetry.io/otel/exporters/otlp/otlptrace/otlptracegrpc v1.45.0 h1:fG5MCxGz8+2VtrN/WgqSpJFctVz24gpxj8CxkKmc8Ww=
+go.opentelemetry.io/otel/exporters/otlp/otlptrace/otlptracegrpc v1.45.0/go.mod h1:BmAYTn+3ysbRe+IU2msxmf5Rx3g6DHvex+tWI3LdhYI=
 go.opentelemetry.io/otel/exporters/otlp/otlptrace/otlptracehttp v1.45.0 h1:QBajQ2SrwQijzHyZbQlPsuIzpl/ll8DY6wPWsajeGcI=
 go.opentelemetry.io/otel/exporters/otlp/otlptrace/otlptracehttp v1.45.0/go.mod h1:08ZQLjrPLQ6R4kAXvuOvODEer5Yh4CoFvll5qB2BCI8=
 go.opentelemetry.io/otel/exporters/prometheus v0.47.0 h1:OL6yk1Z/pEGdDnrBbxSsH+t4FY1zXfBRGd7bjwhlMLU=
```

---

### Incident Patch 5: `d663e069` (2026-09-18)
**Commit Message**: Merge pull request #1117 from krakend/dependabot/go_modules/go.opentelemetry.io/otel/exporters/otlp/otlptrace/otlptracehttp-1.45.0

Bump go.opentelemetry.io/otel/exporters/otlp/otlptrace/otlptracehttp from 1.44.0 to 1.45.0

**File**: `go.mod` (modified, +5/-5)
```diff
@@ -248,15 +248,15 @@ require (
 	go.opentelemetry.io/otel v1.45.0 // indirect
 	go.opentelemetry.io/otel/exporters/otlp/otlpmetric/otlpmetricgrpc v1.44.0 // indirect
 	go.opentelemetry.io/otel/exporters/otlp/otlpmetric/otlpmetrichttp v1.44.0 // indirect
-	go.opentelemetry.io/otel/exporters/otlp/otlptrace v1.44.0 // indirect
+	go.opentelemetry.io/otel/exporters/otlp/otlptrace v1.45.0 // indirect
 	go.opentelemetry.io/otel/exporters/otlp/otlptrace/otlptracegrpc v1.44.0 // indirect
-	go.opentelemetry.io/otel/exporters/otlp/otlptrace/otlptracehttp v1.44.0 // indirect
+	go.opentelemetry.io/otel/exporters/otlp/otlptrace/otlptracehttp v1.45.0 // indirect
 	go.opentelemetry.io/otel/exporters/prometheus v0.47.0 // indirect
 	go.opentelemetry.io/otel/metric v1.45.0 // indirect
 	go.opentelemetry.io/otel/sdk v1.45.0 // indirect
 	go.opentelemetry.io/otel/sdk/metric v1.45.0 // indirect
 	go.opentelemetry.io/otel/trace v1.45.0 // indirect
-	go.opentelemetry.io/proto/otlp v1.10.0 // indirect
+	go.opentelemetry.io/proto/otlp v1.11.0 // indirect
 	go.uber.org/multierr v1.11.0 // indirect
 	go.yaml.in/yaml/v2 v2.4.4 // indirect
 	go.yaml.in/yaml/v3 v3.0.4 // indirect
@@ -277,8 +277,8 @@ require (
 	golang.org/x/xerrors v0.0.0-20240903120638-7835f813f4da // indirect
 	google.golang.org/api v0.272.0 // indirect
 	google.golang.org/genproto v0.0.0-20260217215200-42d3e9bedb6d // indirect
-	google.golang.org/genproto/googleapis/api v0.0.0-20260526163538-3dc84a4a5aaa // indirect
-	google.golang.org/genproto/googleapis/rpc v0.0.0-20260526163538-3dc84a4a5aaa // indirect
+	google.golang.org/genproto/googleapis/api v0.0.0-20260803160001-6ac0973c030d // indirect
+	google.golang.org/genproto/googleapis/rpc v0.0.0-20260803160001-6ac0973c030d // indirect
 	google.golang.org/grpc v1.83.2 // indirect
 	google.golang.org/protobuf v1.36.11 // indirect
 	gopkg.in/DataDog/dd-trace-go.v1 v1.62.0 // indirect
```

**File**: `go.sum` (modified, +10/-10)
```diff
@@ -814,12 +814,12 @@ go.opentelemetry.io/otel/exporters/otlp/otlpmetric/otlpmetricgrpc v1.44.0 h1:SUp
 go.opentelemetry.io/otel/exporters/otlp/otlpmetric/otlpmetricgrpc v1.44.0/go.mod h1:ho2g4N+ane+swq5I/VBkKWnRDY4kUINH3FuqyZqX/Ug=
 go.opentelemetry.io/otel/exporters/otlp/otlpmetric/otlpmetrichttp v1.44.0 h1:RuynHbfU8JUEw7DyONgkVYg2SVtsoF28y0LGIr69jgA=
 go.opentelemetry.io/otel/exporters/otlp/otlpmetric/otlpmetrichttp v1.44.0/go.mod h1:qZF+/lBs71APw8mlnEZcqZHMzqrYrsFiJOv83lX1OGo=
-go.opentelemetry.io/otel/exporters/otlp/otlptrace v1.44.0 h1:4YsVu3B8+3qtWYYrsUYgn0OG78pN0rnNPRGX4SbokQI=
-go.opentelemetry.io/otel/exporters/otlp/otlptrace v1.44.0/go.mod h1:+wnlSn0mD1ADVMe3v9Z/WIaiz6q6gL2J/ejaAmdmv80=
+go.opentelemetry.io/otel/exporters/otlp/otlptrace v1.45.0 h1:QRefszxJmfPdjXUUm3j6iDzY03mTPXMjqErFqQ67vUg=
+go.opentelemetry.io/otel/exporters/otlp/otlptrace v1.45.0/go.mod h1:Tiz03lTBVBrm7eWZBOidzEaYaJa8tjwGUGv6d8mlTyk=
 go.opentelemetry.io/otel/exporters/otlp/otlptrace/otlptracegrpc v1.44.0 h1:qazEJlUOQzhCpzQpFETGby7EdqjI1wsd0W+6Gg1SCTU=
 go.opentelemetry.io/otel/exporters/otlp/otlptrace/otlptracegrpc v1.44.0/go.mod h1:fOD2Yefuxixkx3ahVNf0O/PERb6r4OlbxfATVnYvzCo=
-go.opentelemetry.io/otel/exporters/otlp/otlptrace/otlptracehttp v1.44.0 h1:lgh3PiVrRUWMLOVSkQicxzZll5NjF1r+AtsX1XRIHw0=
-go.opentelemetry.io/otel/exporters/otlp/otlptrace/otlptracehttp v1.44.0/go.mod h1:5Cnhth3m/AgOeTgE3ex12pPmiu/gGtZit03kSzx9X7s=
+go.opentelemetry.io/otel/exporters/otlp/otlptrace/otlptracehttp v1.45.0 h1:QBajQ2SrwQijzHyZbQlPsuIzpl/ll8DY6wPWsajeGcI=
+go.opentelemetry.io/otel/exporters/otlp/otlptrace/otlptracehttp v1.45.0/go.mod h1:08ZQLjrPLQ6R4kAXvuOvODEer5Yh4CoFvll5qB2BCI8=
 go.opentelemetry.io/otel/exporters/prometheus v0.47.0 h1:OL6yk1Z/pEGdDnrBbxSsH+t4FY1zXfBRGd7bjwhlMLU=
 go.opentelemetry.io/otel/exporters/prometheus v0.47.0/go.mod h1:xF3N4OSICZDVbbYZydz9MHFro1RjmkPUKEvar2utG+Q=
 go.opentelemetry.io/otel/metric v1.45.0 h1:7Eg1uH7CJ5cXv9is6tnBe1FI6rj1nwUdbFypRm3br/M=
@@ -832,8 +832,8 @@ go.opentelemetry.io/otel/sdk/metric v1.45.0 h1:oVFszMfyj1Am6s24Vtc7wBb8BKLcwepJj
 go.opentelemetry.io/otel/sdk/metric v1.45.0/go.mod h1:vUWUxDZvu1WVRj8JA8S0AdhsPrZoDpA2DdZauIh4mDA=
 go.opentelemetry.io/otel/trace v1.45.0 h1:l/mP6Uv7oNO7/TblbhpbgMidxhq1uO/rPsikOyVhxag=
 go.opentelemetry.io/otel/trace v1.45.0/go.mod h1:qoJJA2xNMnxRrdISU/kLtfUH2wNeQbiv+jhs/CxI8bc=
-go.opentelemetry.io/proto/otlp v1.10.0 h1:IQRWgT5srOCYfiWnpqUYz9CVmbO8bFmKcwYxpuCSL2g=
-go.opentelemetry.io/proto/otlp v1.10.0/go.mod h1:/CV4QoCR/S9yaPj8utp3lvQPoqMtxXdzn7ozvvozVqk=
+go.opentelemetry.io/proto/otlp v1.11.0 h1:5rrYs0Ykyj50sdU/JU0x8etU+LubXWb+gED6TbEdMIk=
+go.opentelemetry.io/proto/otlp v1.11.0/go.mod h1:SmVizdCOAm3XBtG1g1NnOdhW6jtddT72hLMhv8VwA8E=
 go.uber.org/goleak v1.3.0 h1:2K3zAYmnTNqV73imy9J1T3WC+gmCePx2hEGkimedGto=
 go.uber.org/goleak v1.3.0/go.mod h1:CoHD4mav9JJNrW/WLlf7HGZPjdw8EucARQHekz1X6bE=
 go.uber.org/mock v0.6.0 h1:hyF9dfmbgIX5EfOdasqLsWD6xqpNZlXblLB/Dbnwv3Y=
@@ -1163,10 +1163,10 @@ google.golang.org/genproto v0.0.0-20200804131852-c06518451d9c/go.mod h1:FWY/as6D
 google.golang.org/genproto v0.0.0-20200825200019-8632dd797987/go.mod h1:FWY/as6DDZQgahTzZj3fqbO1CbirC29ZNUFHwi0/+no=
 google.golang.org/genproto v0.0.0-20260217215200-42d3e9bedb6d h1:vsOm753cOAMkt76efriTCDKjpCbK18XGHMJHo0JUKhc=
 google.golang.org/genproto v0.0.0-20260217215200-42d3e9bedb6d/go.mod h1:0oz9d7g9QLSdv9/lgbIjowW1JoxMbxmBVNe8i6tORJI=
-google.golang.org/genproto/googleapis/api v0.0.0-20260526163538-3dc84a4a5aaa h1:Kjn0N0tCrDgiAFW+lGO4JZ3ck44CehvJQMAwj9QF0G8=
-google.golang.org/genproto/googleapis/api v0.0.0-20260526163538-3dc84a4a5aaa/go.mod h1:q4lMZS6kskjT5HvCPrnnypcDPVJqT/f4nfxmkE7gryY=
-google.golang.org/genproto/googleapis/rpc v0.0.0-20260526163538-3dc84a4a5aaa h1:mZHHdPZl0dbGHCflZgAq/Q468DWVFcU2whhB2KAo8fk=
-google.golang.org/genproto/googleapis/rpc v0.0.0-20260526163538-3dc84a4a5aaa/go.mod h1:4Hqkh8ycfw05ld/3BWL7rJOSfebL2Q+DVDeRgYgxUU8=
+google.golang.org/genproto/googleapis/api v0.0.0-20260803160001-6ac0973c030d h1:FarXi840EJWSHYTN3ERkADbPWjl307+FGrA22KAVjjc=
+google.golang.org/genproto/googleapis/api v0.0.0-20260803160001-6ac0973c030d/go.mod h1:K/+WGbmBY7aNW1HDw1fJnKYo10i0DkAX6pows00dLig=
+google.golang.org/genproto/googleapis/rpc v0.0.0-20260803160001-6ac0973c030d h1:IL4hdHzcUv2l/gcg98/Rj3FbtE6axwqslOW8SW0C+S0=
+google.golang.org/genproto/googleapis/rpc v0.0.0-20260803160001-6ac0973c030d/go.mod h1:4Hqkh8ycfw05ld/3BWL7rJOSfebL2Q+DVDeRgYgxUU8=
 google.golang.org/grpc v1.19.0/go.mod h1:mqu4LbDTu4XGKhr4mRzUsmM4RtVoemTSY81AxZiDr8c=
 google.golang.org/grpc v1.20.0/go.mod h1:chYK+tFQF0nDUGJgXMSgLCQk3phJEuONr2DCgLDdAQM=
 google.golang.org/grpc v1.20.1/go.mod h1:10oTOabMzJvdu6/UiuZezV6QK5dSlG84ov/aaiqXj38=
```

---

### Incident Patch 6: `18398f84` (2026-09-18)
**Commit Message**: Bump go.opentelemetry.io/otel/exporters/otlp/otlptrace/otlptracehttp

Bumps [go.opentelemetry.io/otel/exporters/otlp/otlptrace/otlptracehttp](https://github.com/open-telemetry/opentelemetry-go) from 1.44.0 to 1.45.0.
- [Release notes](https://github.com/open-telemetry/opentelemetry-go/releases)
- [Changelog](https://github.com/open-telemetry/opentelemetry-go/blob/main/CHANGELOG.md)
- [Commits](https://github.com/open-telemetry/opentelemetry-go/compare/v1.44.0...v1.45.0)

---
updated-dependencies:
- dependency-name: go.opentelemetry.io/otel/exporters/otlp/otlptrace/otlptracehttp
  dependency-version: 1.45.0
  dependency-type: indirect
...

Signed-off-by: dependabot[bot] <[REDACTED_EMAIL]>

**File**: `go.mod` (modified, +5/-5)
```diff
@@ -248,15 +248,15 @@ require (
 	go.opentelemetry.io/otel v1.45.0 // indirect
 	go.opentelemetry.io/otel/exporters/otlp/otlpmetric/otlpmetricgrpc v1.44.0 // indirect
 	go.opentelemetry.io/otel/exporters/otlp/otlpmetric/otlpmetrichttp v1.44.0 // indirect
-	go.opentelemetry.io/otel/exporters/otlp/otlptrace v1.44.0 // indirect
+	go.opentelemetry.io/otel/exporters/otlp/otlptrace v1.45.0 // indirect
 	go.opentelemetry.io/otel/exporters/otlp/otlptrace/otlptracegrpc v1.44.0 // indirect
-	go.opentelemetry.io/otel/exporters/otlp/otlptrace/otlptracehttp v1.44.0 // indirect
+	go.opentelemetry.io/otel/exporters/otlp/otlptrace/otlptracehttp v1.45.0 // indirect
 	go.opentelemetry.io/otel/exporters/prometheus v0.47.0 // indirect
 	go.opentelemetry.io/otel/metric v1.45.0 // indirect
 	go.opentelemetry.io/otel/sdk v1.45.0 // indirect
 	go.opentelemetry.io/otel/sdk/metric v1.45.0 // indirect
 	go.opentelemetry.io/otel/trace v1.45.0 // indirect
-	go.opentelemetry.io/proto/otlp v1.10.0 // indirect
+	go.opentelemetry.io/proto/otlp v1.11.0 // indirect
 	go.uber.org/multierr v1.11.0 // indirect
 	go.yaml.in/yaml/v2 v2.4.4 // indirect
 	go.yaml.in/yaml/v3 v3.0.4 // indirect
@@ -277,8 +277,8 @@ require (
 	golang.org/x/xerrors v0.0.0-20240903120638-7835f813f4da // indirect
 	google.golang.org/api v0.272.0 // indirect
 	google.golang.org/genproto v0.0.0-20260217215200-42d3e9bedb6d // indirect
-	google.golang.org/genproto/googleapis/api v0.0.0-20260526163538-3dc84a4a5aaa // indirect
-	google.golang.org/genproto/googleapis/rpc v0.0.0-20260526163538-3dc84a4a5aaa // indirect
+	google.golang.org/genproto/googleapis/api v0.0.0-20260803160001-6ac0973c030d // indirect
+	google.golang.org/genproto/googleapis/rpc v0.0.0-20260803160001-6ac0973c030d // indirect
 	google.golang.org/grpc v1.83.2 // indirect
 	google.golang.org/protobuf v1.36.11 // indirect
 	gopkg.in/DataDog/dd-trace-go.v1 v1.62.0 // indirect
```

**File**: `go.sum` (modified, +10/-10)
```diff
@@ -814,12 +814,12 @@ go.opentelemetry.io/otel/exporters/otlp/otlpmetric/otlpmetricgrpc v1.44.0 h1:SUp
 go.opentelemetry.io/otel/exporters/otlp/otlpmetric/otlpmetricgrpc v1.44.0/go.mod h1:ho2g4N+ane+swq5I/VBkKWnRDY4kUINH3FuqyZqX/Ug=
 go.opentelemetry.io/otel/exporters/otlp/otlpmetric/otlpmetrichttp v1.44.0 h1:RuynHbfU8JUEw7DyONgkVYg2SVtsoF28y0LGIr69jgA=
 go.opentelemetry.io/otel/exporters/otlp/otlpmetric/otlpmetrichttp v1.44.0/go.mod h1:qZF+/lBs71APw8mlnEZcqZHMzqrYrsFiJOv83lX1OGo=
-go.opentelemetry.io/otel/exporters/otlp/otlptrace v1.44.0 h1:4YsVu3B8+3qtWYYrsUYgn0OG78pN0rnNPRGX4SbokQI=
-go.opentelemetry.io/otel/exporters/otlp/otlptrace v1.44.0/go.mod h1:+wnlSn0mD1ADVMe3v9Z/WIaiz6q6gL2J/ejaAmdmv80=
+go.opentelemetry.io/otel/exporters/otlp/otlptrace v1.45.0 h1:QRefszxJmfPdjXUUm3j6iDzY03mTPXMjqErFqQ67vUg=
+go.opentelemetry.io/otel/exporters/otlp/otlptrace v1.45.0/go.mod h1:Tiz03lTBVBrm7eWZBOidzEaYaJa8tjwGUGv6d8mlTyk=
 go.opentelemetry.io/otel/exporters/otlp/otlptrace/otlptracegrpc v1.44.0 h1:qazEJlUOQzhCpzQpFETGby7EdqjI1wsd0W+6Gg1SCTU=
 go.opentelemetry.io/otel/exporters/otlp/otlptrace/otlptracegrpc v1.44.0/go.mod h1:fOD2Yefuxixkx3ahVNf0O/PERb6r4OlbxfATVnYvzCo=
-go.opentelemetry.io/otel/exporters/otlp/otlptrace/otlptracehttp v1.44.0 h1:lgh3PiVrRUWMLOVSkQicxzZll5NjF1r+AtsX1XRIHw0=
-go.opentelemetry.io/otel/exporters/otlp/otlptrace/otlptracehttp v1.44.0/go.mod h1:5Cnhth3m/AgOeTgE3ex12pPmiu/gGtZit03kSzx9X7s=
+go.opentelemetry.io/otel/exporters/otlp/otlptrace/otlptracehttp v1.45.0 h1:QBajQ2SrwQijzHyZbQlPsuIzpl/ll8DY6wPWsajeGcI=
+go.opentelemetry.io/otel/exporters/otlp/otlptrace/otlptracehttp v1.45.0/go.mod h1:08ZQLjrPLQ6R4kAXvuOvODEer5Yh4CoFvll5qB2BCI8=
 go.opentelemetry.io/otel/exporters/prometheus v0.47.0 h1:OL6yk1Z/pEGdDnrBbxSsH+t4FY1zXfBRGd7bjwhlMLU=
 go.opentelemetry.io/otel/exporters/prometheus v0.47.0/go.mod h1:xF3N4OSICZDVbbYZydz9MHFro1RjmkPUKEvar2utG+Q=
 go.opentelemetry.io/otel/metric v1.45.0 h1:7Eg1uH7CJ5cXv9is6tnBe1FI6rj1nwUdbFypRm3br/M=
@@ -832,8 +832,8 @@ go.opentelemetry.io/otel/sdk/metric v1.45.0 h1:oVFszMfyj1Am6s24Vtc7wBb8BKLcwepJj
 go.opentelemetry.io/otel/sdk/metric v1.45.0/go.mod h1:vUWUxDZvu1WVRj8JA8S0AdhsPrZoDpA2DdZauIh4mDA=
 go.opentelemetry.io/otel/trace v1.45.0 h1:l/mP6Uv7oNO7/TblbhpbgMidxhq1uO/rPsikOyVhxag=
 go.opentelemetry.io/otel/trace v1.45.0/go.mod h1:qoJJA2xNMnxRrdISU/kLtfUH2wNeQbiv+jhs/CxI8bc=
-go.opentelemetry.io/proto/otlp v1.10.0 h1:IQRWgT5srOCYfiWnpqUYz9CVmbO8bFmKcwYxpuCSL2g=
-go.opentelemetry.io/proto/otlp v1.10.0/go.mod h1:/CV4QoCR/S9yaPj8utp3lvQPoqMtxXdzn7ozvvozVqk=
+go.opentelemetry.io/proto/otlp v1.11.0 h1:5rrYs0Ykyj50sdU/JU0x8etU+LubXWb+gED6TbEdMIk=
+go.opentelemetry.io/proto/otlp v1.11.0/go.mod h1:SmVizdCOAm3XBtG1g1NnOdhW6jtddT72hLMhv8VwA8E=
 go.uber.org/goleak v1.3.0 h1:2K3zAYmnTNqV73imy9J1T3WC+gmCePx2hEGkimedGto=
 go.uber.org/goleak v1.3.0/go.mod h1:CoHD4mav9JJNrW/WLlf7HGZPjdw8EucARQHekz1X6bE=
 go.uber.org/mock v0.6.0 h1:hyF9dfmbgIX5EfOdasqLsWD6xqpNZlXblLB/Dbnwv3Y=
@@ -1163,10 +1163,10 @@ google.golang.org/genproto v0.0.0-20200804131852-c06518451d9c/go.mod h1:FWY/as6D
 google.golang.org/genproto v0.0.0-20200825200019-8632dd797987/go.mod h1:FWY/as6DDZQgahTzZj3fqbO1CbirC29ZNUFHwi0/+no=
 google.golang.org/genproto v0.0.0-20260217215200-42d3e9bedb6d h1:vsOm753cOAMkt76efriTCDKjpCbK18XGHMJHo0JUKhc=
 google.golang.org/genproto v0.0.0-20260217215200-42d3e9bedb6d/go.mod h1:0oz9d7g9QLSdv9/lgbIjowW1JoxMbxmBVNe8i6tORJI=
-google.golang.org/genproto/googleapis/api v0.0.0-20260526163538-3dc84a4a5aaa h1:Kjn0N0tCrDgiAFW+lGO4JZ3ck44CehvJQMAwj9QF0G8=
-google.golang.org/genproto/googleapis/api v0.0.0-20260526163538-3dc84a4a5aaa/go.mod h1:q4lMZS6kskjT5HvCPrnnypcDPVJqT/f4nfxmkE7gryY=
-google.golang.org/genproto/googleapis/rpc v0.0.0-20260526163538-3dc84a4a5aaa h1:mZHHdPZl0dbGHCflZgAq/Q468DWVFcU2whhB2KAo8fk=
-google.golang.org/genproto/googleapis/rpc v0.0.0-20260526163538-3dc84a4a5aaa/go.mod h1:4Hqkh8ycfw05ld/3BWL7rJOSfebL2Q+DVDeRgYgxUU8=
+google.golang.org/genproto/googleapis/api v0.0.0-20260803160001-6ac0973c030d h1:FarXi840EJWSHYTN3ERkADbPWjl307+FGrA22KAVjjc=
+google.golang.org/genproto/googleapis/api v0.0.0-20260803160001-6ac0973c030d/go.mod h1:K/+WGbmBY7aNW1HDw1fJnKYo10i0DkAX6pows00dLig=
+google.golang.org/genproto/googleapis/rpc v0.0.0-20260803160001-6ac0973c030d h1:IL4hdHzcUv2l/gcg98/Rj3FbtE6axwqslOW8SW0C+S0=
+google.golang.org/genproto/googleapis/rpc v0.0.0-20260803160001-6ac0973c030d/go.mod h1:4Hqkh8ycfw05ld/3BWL7rJOSfebL2Q+DVDeRgYgxUU8=
 google.golang.org/grpc v1.19.0/go.mod h1:mqu4LbDTu4XGKhr4mRzUsmM4RtVoemTSY81AxZiDr8c=
 google.golang.org/grpc v1.20.0/go.mod h1:chYK+tFQF0nDUGJgXMSgLCQk3phJEuONr2DCgLDdAQM=
 google.golang.org/grpc v1.20.1/go.mod h1:10oTOabMzJvdu6/UiuZezV6QK5dSlG84ov/aaiqXj38=
```

---

### Incident Patch 7: `f80df547` (2026-09-08)
**Commit Message**: Merge pull request #1115 from krakend/fix_gh_upload_workflow

Replace broken upload artifacts action

**File**: `.github/workflows/manual_release.yml` (modified, +4/-4)
```diff
@@ -92,9 +92,9 @@ jobs:
             checksums.txt
           key: ${{github.ref}}-artifacts
       - name: Upload the artifacts
-        uses: skx/github-action-publish-binaries@master
         env:
           GITHUB_TOKEN: ${{ secrets.GITHUB_TOKEN }}
-        with:
-          releaseId: ${{ github.event.inputs.release-id }}
-          args: '*.tar.gz *.asc *.deb *.rpm checksums.txt'
+          RELEASE_ID: ${{ github.event.inputs.release-id }}
+        run: |
+          TAG=$(gh api "repos/$GITHUB_REPOSITORY/releases/$RELEASE_ID" --jq .tag_name)
+          gh release upload "$TAG" *.tar.gz *.asc *.deb *.rpm checksums.txt --clobber --repo "$GITHUB_REPOSITORY"
```

**File**: `.github/workflows/release.yml` (modified, +1/-3)
```diff
@@ -149,8 +149,6 @@ jobs:
             checksums.txt
           key: ${{github.ref}}-artifacts
       - name: Upload the artifacts
-        uses: skx/github-action-publish-binaries@master
         env:
           GITHUB_TOKEN: ${{ secrets.GITHUB_TOKEN }}
-        with:
-          args: '*.tar.gz *.asc *.deb *.rpm checksums.txt'
+        run: gh release upload "${{ github.event.release.tag_name }}" *.tar.gz *.asc *.deb *.rpm checksums.txt --clobber --repo "$GITHUB_REPOSITORY"
```

**File**: `.github/workflows/upload.yml` (modified, +4/-4)
```diff
@@ -34,9 +34,9 @@ jobs:
           checksums.txt
         key: ${{ github.event.inputs.cache-ref-key }}
     - name: Upload the artifacts
-      uses: skx/github-action-publish-binaries@master
       env:
         GITHUB_TOKEN: ${{ secrets.GITHUB_TOKEN }}
-      with:
-        releaseId: ${{ github.event.inputs.release-id }}
-        args: '*.tar.gz *.asc *.deb *.rpm checksums.txt'
+        RELEASE_ID: ${{ github.event.inputs.release-id }}
+      run: |
+        TAG=$(gh api "repos/$GITHUB_REPOSITORY/releases/$RELEASE_ID" --jq .tag_name)
+        gh release upload "$TAG" *.tar.gz *.asc *.deb *.rpm checksums.txt --clobber --repo "$GITHUB_REPOSITORY"
```

---

### Incident Patch 8: `9c903f92` (2026-08-14)
**Commit Message**: Update fixtures version.

Signed-off-by: Daniel Ortiz <[REDACTED_EMAIL]>

**File**: `tests/fixtures/specs/backend_301.json` (modified, +1/-1)
```diff
@@ -5,7 +5,7 @@
 	},
 	"out": {
 		"status_code": 200,
-		"body": "{\"foo\":42,\"headers\":{\"Accept-Encoding\":[\"gzip\"],\"Referer\":[\"http://127.0.0.1:8081/redirect/?status=301\"],\"User-Agent\":[\"KrakenD Version 2.13.8\"],\"X-Forwarded-Host\":[\"localhost:8080\"]},\"path\":\"/param_forwarding/\",\"query\":{\"status\":[\"301\"]}}",
+		"body": "{\"foo\":42,\"headers\":{\"Accept-Encoding\":[\"gzip\"],\"Referer\":[\"http://127.0.0.1:8081/redirect/?status=301\"],\"User-Agent\":[\"KrakenD Version 2.13.9\"],\"X-Forwarded-Host\":[\"localhost:8080\"]},\"path\":\"/param_forwarding/\",\"query\":{\"status\":[\"301\"]}}",
 		"header": {
 			"content-type": ["application/json; charset=utf-8"],
 			"Cache-Control": ["public, max-age=3600"],
```

**File**: `tests/fixtures/specs/backend_302.json` (modified, +1/-1)
```diff
@@ -5,7 +5,7 @@
 	},
 	"out": {
 		"status_code": 200,
-		"body": "{\"foo\":42,\"headers\":{\"Accept-Encoding\":[\"gzip\"],\"Referer\":[\"http://127.0.0.1:8081/redirect/?status=302\"],\"User-Agent\":[\"KrakenD Version 2.13.8\"],\"X-Forwarded-Host\":[\"localhost:8080\"]},\"path\":\"/param_forwarding/\",\"query\":{\"status\":[\"302\"]}}",
+		"body": "{\"foo\":42,\"headers\":{\"Accept-Encoding\":[\"gzip\"],\"Referer\":[\"http://127.0.0.1:8081/redirect/?status=302\"],\"User-Agent\":[\"KrakenD Version 2.13.9\"],\"X-Forwarded-Host\":[\"localhost:8080\"]},\"path\":\"/param_forwarding/\",\"query\":{\"status\":[\"302\"]}}",
 		"header": {
 			"content-type": ["application/json; charset=utf-8"],
 			"Cache-Control": ["public, max-age=3600"],
```

**File**: `tests/fixtures/specs/backend_303.json` (modified, +1/-1)
```diff
@@ -5,7 +5,7 @@
 	},
 	"out": {
 		"status_code": 200,
-		"body": "{\"foo\":42,\"headers\":{\"Accept-Encoding\":[\"gzip\"],\"Referer\":[\"http://127.0.0.1:8081/redirect/?status=303\"],\"User-Agent\":[\"KrakenD Version 2.13.8\"],\"X-Forwarded-Host\":[\"localhost:8080\"]},\"path\":\"/param_forwarding/\",\"query\":{\"status\":[\"303\"]}}",
+		"body": "{\"foo\":42,\"headers\":{\"Accept-Encoding\":[\"gzip\"],\"Referer\":[\"http://127.0.0.1:8081/redirect/?status=303\"],\"User-Agent\":[\"KrakenD Version 2.13.9\"],\"X-Forwarded-Host\":[\"localhost:8080\"]},\"path\":\"/param_forwarding/\",\"query\":{\"status\":[\"303\"]}}",
 		"header": {
 			"content-type": ["application/json; charset=utf-8"],
 			"Cache-Control": ["public, max-age=3600"],
```

**File**: `tests/fixtures/specs/backend_307.json` (modified, +1/-1)
```diff
@@ -5,7 +5,7 @@
 	},
 	"out": {
 		"status_code": 200,
-		"body": "{\"foo\":42,\"headers\":{\"Accept-Encoding\":[\"gzip\"],\"Referer\":[\"http://127.0.0.1:8081/redirect/?status=307\"],\"User-Agent\":[\"KrakenD Version 2.13.8\"],\"X-Forwarded-Host\":[\"localhost:8080\"]},\"path\":\"/param_forwarding/\",\"query\":{\"status\":[\"307\"]}}",
+		"body": "{\"foo\":42,\"headers\":{\"Accept-Encoding\":[\"gzip\"],\"Referer\":[\"http://127.0.0.1:8081/redirect/?status=307\"],\"User-Agent\":[\"KrakenD Version 2.13.9\"],\"X-Forwarded-Host\":[\"localhost:8080\"]},\"path\":\"/param_forwarding/\",\"query\":{\"status\":[\"307\"]}}",
 		"header": {
 			"content-type": ["application/json; charset=utf-8"],
 			"Cache-Control": ["public, max-age=3600"],
```

**File**: `tests/fixtures/specs/cel-7.json` (modified, +1/-1)
```diff
@@ -12,7 +12,7 @@
 			"foo":42,
 			"headers":{
 				"Accept-Encoding":["gzip"],
-				"User-Agent":["KrakenD Version 2.13.8"],
+				"User-Agent":["KrakenD Version 2.13.9"],
 				"X-Forwarded-Host":["localhost:8080"]
 			},
 			"path":"/param_forwarding/ok/1234567890qwertyuio/foobar",
```

**File**: `tests/fixtures/specs/cors_5.json` (modified, +2/-2)
```diff
@@ -9,12 +9,12 @@
 	},
 	"out": {
 		"status_code": 200,
-		"body": "{\"foo\":42,\"headers\":{\"Accept-Encoding\":[\"gzip\"],\"User-Agent\":[\"KrakenD Version 2.13.8\"],\"X-Forwarded-Host\":[\"localhost:8080\"]},\"path\":\"/param_forwarding/bar\",\"query\":{\"foo\":[\"foo\"]}}",
+		"body": "{\"foo\":42,\"headers\":{\"Accept-Encoding\":[\"gzip\"],\"User-Agent\":[\"KrakenD Version 2.13.9\"],\"X-Forwarded-Host\":[\"localhost:8080\"]},\"path\":\"/param_forwarding/bar\",\"query\":{\"foo\":[\"foo\"]}}",
 		"header": {
 			"content-type": ["application/json; charset=utf-8"],
 			"Cache-Control": ["public, max-age=3600"],
 			"X-Krakend-Completed": ["true"],
-			"X-Krakend": ["Version 2.13.8"],
+			"X-Krakend": ["Version 2.13.9"],
 			"Vary": ["Origin"],
 			"Access-Control-Allow-Origin": ["*"],
 			"Access-Control-Expose-Headers": ["Content-Length"]
```

**File**: `tests/fixtures/specs/detail_error.json` (modified, +1/-1)
```diff
@@ -14,7 +14,7 @@
           "foo": 42,
           "headers": {
             "Accept-Encoding": ["gzip"],
-            "User-Agent": ["KrakenD Version 2.13.8"],
+            "User-Agent": ["KrakenD Version 2.13.9"],
             "X-Forwarded-Host": ["localhost:8080"]
           },
           "path": "/param_forwarding/",
```

**File**: `tests/fixtures/specs/no-op_1.json` (modified, +1/-1)
```diff
@@ -5,7 +5,7 @@
 	},
 	"out": {
 		"status_code": 200,
-		"body": "{\"foo\":42,\"headers\":{\"Accept-Encoding\":[\"gzip\"],\"Content-Length\":[\"0\"],\"User-Agent\":[\"KrakenD Version 2.13.8\"],\"X-Forwarded-Host\":[\"localhost:8080\"]},\"path\":\"/param_forwarding/\",\"query\":{}}\n",
+		"body": "{\"foo\":42,\"headers\":{\"Accept-Encoding\":[\"gzip\"],\"Content-Length\":[\"0\"],\"User-Agent\":[\"KrakenD Version 2.13.9\"],\"X-Forwarded-Host\":[\"localhost:8080\"]},\"path\":\"/param_forwarding/\",\"query\":{}}\n",
 		"header": {
 			"content-type": ["application/json"],
 			"Cache-Control": [""],
```

---

### Incident Patch 9: `27e08155` (2026-07-02)
**Commit Message**: Revert event trigger

**File**: `.github/workflows/go.yml` (modified, +1/-2)
```diff
@@ -4,8 +4,7 @@ on:
   push:
     branches: [ master ]
   pull_request:
-    branches:
-      - '**'
+    branches: [ master ]
 
 jobs:
 
```

---

### Incident Patch 10: `c1cf2b9e` (2026-06-05)
**Commit Message**: Merge pull request #1096 from krakend/dependabot/go_modules/github.com/quic-go/quic-go-0.59.1

Bump github.com/quic-go/quic-go from 0.59.0 to 0.59.1

**File**: `go.mod` (modified, +1/-1)
```diff
@@ -211,7 +211,7 @@ require (
 	github.com/prometheus/prometheus v0.311.3 // indirect
 	github.com/prometheus/statsd_exporter v0.26.1 // indirect
 	github.com/quic-go/qpack v0.6.0 // indirect
-	github.com/quic-go/quic-go v0.59.0 // indirect
+	github.com/quic-go/quic-go v0.59.1 // indirect
 	github.com/rabbitmq/amqp091-go v1.10.0 // indirect
 	github.com/rcrowley/go-metrics v0.0.0-20250401214520-65e299d6c5c9 // indirect
 	github.com/rs/cors v1.11.1 // indirect
```

**File**: `go.sum` (modified, +2/-2)
```diff
@@ -690,8 +690,8 @@ github.com/prometheus/statsd_exporter v0.26.1 h1:ucbIAdPmwAUcA+dU+Opok8Qt81Aw8Ha
 github.com/prometheus/statsd_exporter v0.26.1/go.mod h1:XlDdjAmRmx3JVvPPYuFNUg+Ynyb5kR69iPPkQjxXFMk=
 github.com/quic-go/qpack v0.6.0 h1:g7W+BMYynC1LbYLSqRt8PBg5Tgwxn214ZZR34VIOjz8=
 github.com/quic-go/qpack v0.6.0/go.mod h1:lUpLKChi8njB4ty2bFLX2x4gzDqXwUpaO1DP9qMDZII=
-github.com/quic-go/quic-go v0.59.0 h1:OLJkp1Mlm/aS7dpKgTc6cnpynnD2Xg7C1pwL6vy/SAw=
-github.com/quic-go/quic-go v0.59.0/go.mod h1:upnsH4Ju1YkqpLXC305eW3yDZ4NfnNbmQRCMWS58IKU=
+github.com/quic-go/quic-go v0.59.1 h1:0Gmua0HW1Tv7ANR7hUYwRyD0MG5OJfgvYSZasGZzBic=
+github.com/quic-go/quic-go v0.59.1/go.mod h1:upnsH4Ju1YkqpLXC305eW3yDZ4NfnNbmQRCMWS58IKU=
 github.com/rabbitmq/amqp091-go v1.10.0 h1:STpn5XsHlHGcecLmMFCtg7mqq0RnD+zFr4uzukfVhBw=
 github.com/rabbitmq/amqp091-go v1.10.0/go.mod h1:Hy4jKW5kQART1u+JkDTF9YYOQUHXqMuhrgxOEeS7G4o=
 github.com/rcrowley/go-metrics v0.0.0-20181016184325-3113b8401b8a/go.mod h1:bCqnVzQkZxMG4s8nGwiZ5l3QUCyqpo9Y+/ZMZ9VjZe4=
```

---

### Incident Patch 11: `35bcb68d` (2026-06-03)
**Commit Message**: Bump github.com/quic-go/quic-go from 0.59.0 to 0.59.1

Bumps [github.com/quic-go/quic-go](https://github.com/quic-go/quic-go) from 0.59.0 to 0.59.1.
- [Release notes](https://github.com/quic-go/quic-go/releases)
- [Commits](https://github.com/quic-go/quic-go/compare/v0.59.0...v0.59.1)

---
updated-dependencies:
- dependency-name: github.com/quic-go/quic-go
  dependency-version: 0.59.1
  dependency-type: indirect
...

Signed-off-by: dependabot[bot] <[REDACTED_EMAIL]>

**File**: `go.mod` (modified, +1/-1)
```diff
@@ -211,7 +211,7 @@ require (
 	github.com/prometheus/prometheus v0.311.3 // indirect
 	github.com/prometheus/statsd_exporter v0.26.1 // indirect
 	github.com/quic-go/qpack v0.6.0 // indirect
-	github.com/quic-go/quic-go v0.59.0 // indirect
+	github.com/quic-go/quic-go v0.59.1 // indirect
 	github.com/rabbitmq/amqp091-go v1.10.0 // indirect
 	github.com/rcrowley/go-metrics v0.0.0-20250401214520-65e299d6c5c9 // indirect
 	github.com/rs/cors v1.11.1 // indirect
```

**File**: `go.sum` (modified, +2/-2)
```diff
@@ -690,8 +690,8 @@ github.com/prometheus/statsd_exporter v0.26.1 h1:ucbIAdPmwAUcA+dU+Opok8Qt81Aw8Ha
 github.com/prometheus/statsd_exporter v0.26.1/go.mod h1:XlDdjAmRmx3JVvPPYuFNUg+Ynyb5kR69iPPkQjxXFMk=
 github.com/quic-go/qpack v0.6.0 h1:g7W+BMYynC1LbYLSqRt8PBg5Tgwxn214ZZR34VIOjz8=
 github.com/quic-go/qpack v0.6.0/go.mod h1:lUpLKChi8njB4ty2bFLX2x4gzDqXwUpaO1DP9qMDZII=
-github.com/quic-go/quic-go v0.59.0 h1:OLJkp1Mlm/aS7dpKgTc6cnpynnD2Xg7C1pwL6vy/SAw=
-github.com/quic-go/quic-go v0.59.0/go.mod h1:upnsH4Ju1YkqpLXC305eW3yDZ4NfnNbmQRCMWS58IKU=
+github.com/quic-go/quic-go v0.59.1 h1:0Gmua0HW1Tv7ANR7hUYwRyD0MG5OJfgvYSZasGZzBic=
+github.com/quic-go/quic-go v0.59.1/go.mod h1:upnsH4Ju1YkqpLXC305eW3yDZ4NfnNbmQRCMWS58IKU=
 github.com/rabbitmq/amqp091-go v1.10.0 h1:STpn5XsHlHGcecLmMFCtg7mqq0RnD+zFr4uzukfVhBw=
 github.com/rabbitmq/amqp091-go v1.10.0/go.mod h1:Hy4jKW5kQART1u+JkDTF9YYOQUHXqMuhrgxOEeS7G4o=
 github.com/rcrowley/go-metrics v0.0.0-20181016184325-3113b8401b8a/go.mod h1:bCqnVzQkZxMG4s8nGwiZ5l3QUCyqpo9Y+/ZMZ9VjZe4=
```

---

### Incident Patch 12: `f1002f6f` (2026-06-03)
**Commit Message**: Merge pull request #1093 from krakend/sc-1092/remove-telemetry-influx

Remove deprecated influxdb component.

**File**: `cmd/krakend-ce/main.go` (modified, +0/-1)
```diff
@@ -118,7 +118,6 @@ var aliases = map[string]string{
 	"github_com/devopsfaith/krakend-gologging": "telemetry/logging",
 	"github_com/devopsfaith/krakend-logstash":  "telemetry/logstash",
 	"github_com/devopsfaith/krakend-metrics":   "telemetry/metrics",
-	"github_com/letgoapp/krakend-influx":       "telemetry/influx",
 
 	"github.com/devopsfaith/krakend-lua/router":        "modifier/lua-endpoint",
 	"github.com/devopsfaith/krakend-lua/proxy":         "modifier/lua-proxy",
```

**File**: `executor.go` (modified, +1/-10)
```diff
@@ -20,7 +20,6 @@ import (
 	cors "github.com/krakend/krakend-cors/v2/gin"
 	gelf "github.com/krakend/krakend-gelf/v2"
 	gologging "github.com/krakend/krakend-gologging/v2"
-	influxdb "github.com/krakend/krakend-influx/v2"
 	jose "github.com/krakend/krakend-jose/v2"
 	logstash "github.com/krakend/krakend-logstash/v2"
 	metrics "github.com/krakend/krakend-metrics/v2/gin"
@@ -375,18 +374,10 @@ type MetricsAndTraces struct {
 	shutdownFn func()
 }
 
-// Register registers the metrics, influx packages as required by the given configuration.
+// Register registers the metrics package as required by the given configuration.
 func (m *MetricsAndTraces) Register(ctx context.Context, cfg config.ServiceConfig, l logging.Logger) *metrics.Metrics {
 	metricCollector := metrics.New(ctx, cfg.ExtraConfig, l)
 
-	if err := influxdb.New(ctx, cfg.ExtraConfig, metricCollector, l); err != nil {
-		if err != influxdb.ErrNoConfig {
-			l.Warning("[SERVICE: InfluxDB]", err.Error())
-		}
-	} else {
-		l.Debug("[SERVICE: InfluxDB] Service correctly registered")
-	}
-
 	if shutdownFn, err := kotel.Register(ctx, l, cfg); err == nil {
 		m.shutdownFn = shutdownFn
 	} else {
```

**File**: `go.mod` (modified, +2/-2)
```diff
@@ -18,7 +18,6 @@ require (
 	github.com/krakend/krakend-gologging/v2 v2.1.1
 	github.com/krakend/krakend-httpcache/v2 v2.2.0
 	github.com/krakend/krakend-httpsecure/v2 v2.2.1
-	github.com/krakend/krakend-influx/v2 v2.2.0
 	github.com/krakend/krakend-jose/v2 v2.12.2
 	github.com/krakend/krakend-jsonschema/v2 v2.2.1
 	github.com/krakend/krakend-koanf v0.0.0-20251111142508-ab36eebbcf9b
@@ -37,7 +36,6 @@ require (
 	github.com/luraproject/lura/v2 v2.14.2-0.20260316170719-6d79b4ef723b
 	github.com/santhosh-tekuri/jsonschema/v6 v6.0.2
 	github.com/spf13/cobra v1.8.1
-	go.opentelemetry.io/otel v1.43.0
 	golang.org/x/sync v0.20.0
 )
 
@@ -165,6 +163,7 @@ require (
 	github.com/krakend/flatmap v1.2.0 // indirect
 	github.com/krakend/go-auth0/v2 v2.0.4 // indirect
 	github.com/krakend/httpcache v1.1.1 // indirect
+	github.com/krakend/krakend-influx/v2 v2.2.0 // indirect
 	github.com/krakend/lru v0.0.0-20250121172718-0e3a6eab620d // indirect
 	github.com/kylelemons/godebug v1.1.0 // indirect
 	github.com/leodido/go-urn v1.4.0 // indirect
@@ -224,6 +223,7 @@ require (
 	go.opentelemetry.io/contrib/propagators/b3 v1.33.0 // indirect
 	go.opentelemetry.io/contrib/propagators/jaeger v1.33.0 // indirect
 	go.opentelemetry.io/contrib/propagators/ot v1.33.0 // indirect
+	go.opentelemetry.io/otel v1.43.0 // indirect
 	go.opentelemetry.io/otel/exporters/otlp/otlpmetric/otlpmetricgrpc v1.41.0 // indirect
 	go.opentelemetry.io/otel/exporters/otlp/otlpmetric/otlpmetrichttp v1.43.0 // indirect
 	go.opentelemetry.io/otel/exporters/otlp/otlptrace v1.43.0 // indirect
```

---

### Incident Patch 13: `6719c1ab` (2026-05-20)
**Commit Message**: Remove deprecated influxdb component.

Signed-off-by: Daniel Ortiz <[REDACTED_EMAIL]>

**File**: `cmd/krakend-ce/main.go` (modified, +0/-1)
```diff
@@ -118,7 +118,6 @@ var aliases = map[string]string{
 	"github_com/devopsfaith/krakend-gologging": "telemetry/logging",
 	"github_com/devopsfaith/krakend-logstash":  "telemetry/logstash",
 	"github_com/devopsfaith/krakend-metrics":   "telemetry/metrics",
-	"github_com/letgoapp/krakend-influx":       "telemetry/influx",
 
 	"github.com/devopsfaith/krakend-lua/router":        "modifier/lua-endpoint",
 	"github.com/devopsfaith/krakend-lua/proxy":         "modifier/lua-proxy",
```

**File**: `executor.go` (modified, +1/-10)
```diff
@@ -20,7 +20,6 @@ import (
 	cors "github.com/krakend/krakend-cors/v2/gin"
 	gelf "github.com/krakend/krakend-gelf/v2"
 	gologging "github.com/krakend/krakend-gologging/v2"
-	influxdb "github.com/krakend/krakend-influx/v2"
 	jose "github.com/krakend/krakend-jose/v2"
 	logstash "github.com/krakend/krakend-logstash/v2"
 	metrics "github.com/krakend/krakend-metrics/v2/gin"
@@ -375,18 +374,10 @@ type MetricsAndTraces struct {
 	shutdownFn func()
 }
 
-// Register registers the metrics, influx packages as required by the given configuration.
+// Register registers the metrics package as required by the given configuration.
 func (m *MetricsAndTraces) Register(ctx context.Context, cfg config.ServiceConfig, l logging.Logger) *metrics.Metrics {
 	metricCollector := metrics.New(ctx, cfg.ExtraConfig, l)
 
-	if err := influxdb.New(ctx, cfg.ExtraConfig, metricCollector, l); err != nil {
-		if err != influxdb.ErrNoConfig {
-			l.Warning("[SERVICE: InfluxDB]", err.Error())
-		}
-	} else {
-		l.Debug("[SERVICE: InfluxDB] Service correctly registered")
-	}
-
 	if shutdownFn, err := kotel.Register(ctx, l, cfg); err == nil {
 		m.shutdownFn = shutdownFn
 	} else {
```

**File**: `go.mod` (modified, +2/-2)
```diff
@@ -18,7 +18,6 @@ require (
 	github.com/krakend/krakend-gologging/v2 v2.1.1
 	github.com/krakend/krakend-httpcache/v2 v2.2.0
 	github.com/krakend/krakend-httpsecure/v2 v2.2.1
-	github.com/krakend/krakend-influx/v2 v2.2.0
 	github.com/krakend/krakend-jose/v2 v2.12.2
 	github.com/krakend/krakend-jsonschema/v2 v2.2.1
 	github.com/krakend/krakend-koanf v0.0.0-20251111142508-ab36eebbcf9b
@@ -37,7 +36,6 @@ require (
 	github.com/luraproject/lura/v2 v2.14.2-0.20260316170719-6d79b4ef723b
 	github.com/santhosh-tekuri/jsonschema/v6 v6.0.2
 	github.com/spf13/cobra v1.8.1
-	go.opentelemetry.io/otel v1.43.0
 	golang.org/x/sync v0.20.0
 )
 
@@ -165,6 +163,7 @@ require (
 	github.com/krakend/flatmap v1.2.0 // indirect
 	github.com/krakend/go-auth0/v2 v2.0.4 // indirect
 	github.com/krakend/httpcache v1.1.1 // indirect
+	github.com/krakend/krakend-influx/v2 v2.2.0 // indirect
 	github.com/krakend/lru v0.0.0-20250121172718-0e3a6eab620d // indirect
 	github.com/kylelemons/godebug v1.1.0 // indirect
 	github.com/leodido/go-urn v1.4.0 // indirect
@@ -224,6 +223,7 @@ require (
 	go.opentelemetry.io/contrib/propagators/b3 v1.33.0 // indirect
 	go.opentelemetry.io/contrib/propagators/jaeger v1.33.0 // indirect
 	go.opentelemetry.io/contrib/propagators/ot v1.33.0 // indirect
+	go.opentelemetry.io/otel v1.43.0 // indirect
 	go.opentelemetry.io/otel/exporters/otlp/otlpmetric/otlpmetricgrpc v1.41.0 // indirect
 	go.opentelemetry.io/otel/exporters/otlp/otlpmetric/otlpmetrichttp v1.43.0 // indirect
 	go.opentelemetry.io/otel/exporters/otlp/otlptrace v1.43.0 // indirect
```

---

### Incident Patch 14: `a2e52aef` (2026-05-15)
**Commit Message**: fix integration tests when no body and no schema is defined

Signed-off-by: Narcis <[REDACTED_EMAIL]>

**File**: `tests/fixtures/specs/integration_no_body.json` (added, +21/-0)
```diff
@@ -0,0 +1,21 @@
+{
+    "in": {
+        "method": "GET",
+        "url": "http://localhost:8080/static"
+    },
+    "out": {
+        "status_code": 200,
+        "@comment": "when no body and no schema are defined, body should not be checked",
+        "header": {
+            "content-type": [
+                "application/json; charset=utf-8"
+            ],
+            "Cache-Control": [
+                "public, max-age=3600"
+            ],
+            "X-Krakend-Completed": [
+                "true"
+            ]
+        }
+    }
+}
\ No newline at end of file
```

**File**: `tests/integration.go` (modified, +1/-1)
```diff
@@ -450,7 +450,7 @@ func assertResponse(actual *http.Response, expected Output) error { // skipcq GO
 				errMessage: append(errMsgs, fmt.Sprintf("problem validating the body: %s", sanitizeValidationError(err))),
 			}
 		}
-	} else if expected.Body != "" {
+	} else if expected.Body != nil {
 		if !reflect.DeepEqual(body, expected.Body) {
 			errMsgs = append(errMsgs, fmt.Sprintf("unexpected body.\n\t\thave: %v\n\t\twant: %v", body, expected.Body))
 		}
```

---

### Incident Patch 15: `37257721` (2026-04-28)
**Commit Message**: Merge pull request #1083 from krakend/sc-1163/the-prefix-verb-gets-deleted-for-access-logger

Bump krakend-logstash to v2.1.1

**File**: `go.mod` (modified, +1/-1)
```diff
@@ -23,7 +23,7 @@ require (
 	github.com/krakend/krakend-jsonschema/v2 v2.2.1
 	github.com/krakend/krakend-koanf v0.0.0-20251111142508-ab36eebbcf9b
 	github.com/krakend/krakend-lambda/v2 v2.1.0
-	github.com/krakend/krakend-logstash/v2 v2.1.0
+	github.com/krakend/krakend-logstash/v2 v2.1.1
 	github.com/krakend/krakend-lua/v2 v2.9.1
 	github.com/krakend/krakend-martian/v2 v2.3.0
 	github.com/krakend/krakend-metrics/v2 v2.2.0
```

**File**: `go.sum` (modified, +2/-2)
```diff
@@ -547,8 +547,8 @@ github.com/krakend/krakend-koanf v0.0.0-20251111142508-ab36eebbcf9b h1:D94Zyeg26
 github.com/krakend/krakend-koanf v0.0.0-20251111142508-ab36eebbcf9b/go.mod h1:x02jzsb521azFk5+pmvF2GMwleU/5QXPgl+YZu407DE=
 github.com/krakend/krakend-lambda/v2 v2.1.0 h1:I76j4cp/I8Cd7vQMyIq08aJSr42SDFZWAE48/absu2k=
 github.com/krakend/krakend-lambda/v2 v2.1.0/go.mod h1:a1j6PHQtSwp3gdvpgHNJDSeIzHbHbIjcmVvDw4HU9qg=
-github.com/krakend/krakend-logstash/v2 v2.1.0 h1:z7PSWGk/1y6K8eE+wE/iwF1YBpC1qh2Rm5vZOpVZSNc=
-github.com/krakend/krakend-logstash/v2 v2.1.0/go.mod h1:EFKRnlL1CQ2ubQM1pxApdiNi7gBtdNnDQo0mFA07lMU=
+github.com/krakend/krakend-logstash/v2 v2.1.1 h1:4XFpVsM9HMppzoSsMx3wk3nGaPLaRqLF38alICD3qxY=
+github.com/krakend/krakend-logstash/v2 v2.1.1/go.mod h1:EFKRnlL1CQ2ubQM1pxApdiNi7gBtdNnDQo0mFA07lMU=
 github.com/krakend/krakend-lua/v2 v2.9.1 h1:vlZYOJx2teMQVpm2OKpqvrOgDj1LzonFVTM52o9TmSc=
 github.com/krakend/krakend-lua/v2 v2.9.1/go.mod h1:wzUUaLeHbA+kXaKgP5CgtQEEU+xXcSRZAS8tJGg8Pt0=
 github.com/krakend/krakend-martian/v2 v2.3.0 h1:/rQAfWU1W4PdtnOnCI8714R4puNv8z/vK0rCsgSkuxs=
```

#### Recent Merged Pull Requests:
- **PR #1124** (2026-09-30): Update config version and schema in the configuration example. (@taik0)
- **PR #1123** (2026-09-30): Release 3.0 (@kpacha)
- **PR #1122** (closed): Pin GitHub Actions to commit SHAs and add Dependabot for actions (@gypsy5oul)
- **PR #1120** (closed): Bump go.opentelemetry.io/otel/exporters/otlp/otlptrace from 1.44.0 to 1.45.0 (@dependabot[bot])
- **PR #1119** (2026-09-18): Bump go.opentelemetry.io/otel/exporters/otlp/otlptrace/otlptracegrpc from 1.44.0 to 1.45.0 (@dependabot[bot])
- **PR #1118** (2026-09-18): Bump go.opentelemetry.io/otel/sdk from 1.44.0 to 1.45.0 (@dependabot[bot])
- **PR #1117** (2026-09-18): Bump go.opentelemetry.io/otel/exporters/otlp/otlptrace/otlptracehttp from 1.44.0 to 1.45.0 (@dependabot[bot])
- **PR #1116** (2026-09-09): Bump google.golang.org/grpc from 1.83.1 to 1.83.2 (@dependabot[bot])

---

## 3. Empirical Evidence & Compliance Certification
- **Evidence Provenance**: Fetched directly from verified official GitHub REST API.
- **Zero Disk Footprint**: 0 bytes of unnecessary repository bloat stored locally.
- **TOS & Free-Tier Adherence**: Request pace complied with public API guidelines without fee, penalty, or unauthorized scraping.

---

## 4. Promotion & Integration Status
- **Status**: HARVESTED_DEEP_FORENSIC
- **Master Brain Sync**: Auto-committed to local/remote Master Brain repository.
