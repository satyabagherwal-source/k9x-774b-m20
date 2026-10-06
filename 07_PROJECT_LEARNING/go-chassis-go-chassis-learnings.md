# Forensic Learning Record (Deep Inspection): go-chassis/go-chassis

> **Canonical Artifact**: `07_PROJECT_LEARNING/go-chassis-go-chassis-learnings.md`  
> **Source Platform**: GitHub ([https://github.com/go-chassis/go-chassis](https://github.com/go-chassis/go-chassis))  
> **Harvest Method**: Full-Spectrum Deep Extraction (Patches, Diffs, Source Code, Post-Mortems)  
> **Harvest Timestamp**: 2026-10-06T02:08:41.850Z  
> **Compliance State**: Free Tier Guaranteed | Strict Rate-Limit Backoff Honored  

---

## 1. Context & Architectural Overview
- **Repository / Resource**: `go-chassis/go-chassis`
- **Description**: a cloud native application framework for Go with rich eco-system
- **Primary Language / Ecosystem**: Go
- **Discovered Manifests / Configurations**: go.mod, README.md
- **Stars / Engagement**: 2726 stars

---

## 2. Multi-Dimensional 8-Axis Investigation & Real Code Patches

### D1: Architecture & Structural Boundaries
- Entry configurations inspected via direct stream: go.mod, README.md.
- Evaluated system abstractions and modular contracts.

### Core Architecture Module: `core/client/client.go`
```
// Package client is an interface for any protocol's client
package client

import (
	"context"
	"errors"

	"github.com/go-chassis/go-chassis/v2/core/invocation"
)

// ErrCanceled means Request is canceled by context management
var ErrCanceled = errors.New("request cancelled")

// TransportFailure is caused by client call failure
// for example:  resp, err = client.Do(req)
// if err is not nil then should wrap original error with TransportFailure
type TransportFailure struct {
	Message string
}

// Error return error message
func (e TransportFailure) Error() string {
	return e.Message
}

// ProtocolClient is a interface to communicate with one kind of ProtocolServer, it is used in transport handler.
// this handler orchestrate client implementation.
// gRPC protocol client, http protocol client, or you can implement your own.
type ProtocolClient interface {
	// TODO use invocation.Response as rsp
	// Call is the key function you must implement
	Call(ctx context.Context, addr string, inv *invocation.Invocation, rsp interface{}) error
	// if your protocol has response status(such as http return 200, 500 status code),
	// you need to return it according to response
	Status(rsp interface{}) (status int, err error)
	String() string
	Close() error
	// if you want to reload client settings on-fly, such as timeout, TLS config,
	// you need to implement it
	ReloadConfigs(Options)
	GetOptions() Options
}

```

### Core Architecture Module: `core/client/client_manager.go`
```
package client

import (
	"crypto/tls"
	"errors"
	"fmt"
	"net/http"
	"strings"
	"sync"
	"time"

	"github.com/go-chassis/go-chassis/v2/core/common"
	"github.com/go-chassis/go-chassis/v2/core/config"
	"github.com/go-chassis/go-chassis/v2/core/config/model"
	"github.com/go-chassis/go-chassis/v2/core/invocation"
	chassisTLS "github.com/go-chassis/go-chassis/v2/core/tls"
	"github.com/go-chassis/openlog"
)

var clients = make(map[string]ProtocolClient)
var sl sync.RWMutex

// ErrClientNotExist happens if client do not exist
var ErrClientNotExist = errors.New("client not exists")

// DefaultPoolSize is 500
const DefaultPoolSize = 512

// Options is configs for client creation
type Options struct {
	Service       string
	PoolSize      int
	Timeout       time.Duration
	Endpoint      string
	PoolTTL       time.Duration
	TLSConfig     *tls.Config
	Failure       map[string]bool
	CheckRedirect func(req *http.Request, via []*http.Request) error
}

// GetFailureMap return failure map
func GetFailureMap(p string) map[string]bool {
	failureList := strings.Split(config.GlobalDefinition.ServiceComb.Transport.Failure[p], ",")
	failureMap := make(map[string]bool)
	for _, v := range failureList {
		if v == "" {
			continue
		}
		failureMap[v] = true
	}
	return failureMap
}

// GetMaxIdleCon get max idle connection number you defined
// default is 512
func GetMaxIdleCon(p string) int {
	n, ok := config.GetTransportConf().MaxIdlCons[p]
	if !ok {
		return DefaultPoolSize
	}
	return n
}

// CreateClient is for to create client based on protocol and the service name
func CreateClient(protocol, service, endpoint string, sslEnable bool, checkRedirect func(req *http.Request, via []*http.Request) error) (ProtocolClient, error) {
	f, err := GetClientNewFunc(protocol)
	if err != nil {
		openlog.Error(fmt.Sprintf("do not support [%s] client", protocol))
		return nil, err
	}
	tlsConfig, sslConfig, err := chassisTLS.GetTLSConfigByService(service, protocol, common.Consumer)
	//it will set tls config when provider's endpoint has sslEnable=true suffix or
	// consumer had set provider tls config
	if err != nil {
		if sslEnable || !chassisTLS.IsSSLConfigNotExist(err) {
			return nil, err
		}
	} else {
		// client verify target micro service's name in mutual tls
		// remember to set SAN (Subject Alternative Name) as server's micro service name
		// when generating server.csr
		tlsConfig.ServerName = service
		openlog.Warn(fmt.Sprintf("%s %s TLS mode, verify peer: %t, cipher plugin: %s.",
			protocol, service, sslConfig.VerifyPeer, sslConfig.CipherPlugin))
	}
	var command string
	if service != "" {
		command = strings.Join([]string{common.Consumer, service}, ".")
	}
	return f(Options{
		Service:       service,
		TLSConfig:     tlsConfig,
		PoolSize:      GetMaxIdleCon(protocol),
		Failure:       GetFailureMap(protocol),
		Timeout:       config.GetTimeoutDurationFromArchaius(command, common.Consumer),
		Endpoint:      endpoint,
		CheckRedirect: checkRedirect,
	})
}
func generateKey(protocol, service, endpoint string) string {
	return protocol + service + endpoint
}

// GetClient is to get the client based on protocol, service,endpoint name
func GetClient(i *invocation.Invocation) (ProtocolClient, error) {
	var c ProtocolClient
	var err error
	key := generateKey(i.Protocol, i.MicroServiceName, i.Endpoint)
	sl.RLock()
	c, ok := clients[key]
	sl.RUnlock()
	if !ok {
		openlog.Info("Create client for " + i.Protocol + ":" + i.MicroServiceName + ":" + i.Endpoint)
		c, err = CreateClient(i.Protocol, i.MicroServiceName, i.Endpoint, i.SSLEnable, i.CheckRedirect)
		if err != nil {
			return nil, err
		}
		sl.Lock()
		clients[key] = c
		sl.Unlock()
	}
	return c, nil
}

// Close close a client conn
func Close(protocol, service, endpoint string) error {
	key := generateKey(protocol, service, endpoint)
	sl.RLock()
	c, ok := clients[key]
	sl.RUnlock()
	if !ok {
		return ErrClientNotExist
	}
	if err := c.Close(); err != nil {
		openlog.Error(fmt.Sprintf("can not close client %s:%s%s, err [%s]", protocol, service, endpoint, err.Error()))
		return err
	}
	sl.Lock()
	delete(clients, key)
	sl.Unlock()
	return nil
}

// SetTimeoutToClientCache set timeout to client
func SetTimeoutToClientCache(spec *model.IsolationWrapper) {
	sl.Lock()
	defer sl.Unlock()
	for _, client := range clients {
		if client != nil {
			if v, ok := spec.Consumer.AnyService[client.GetOptions().Service]; ok {
				client.ReloadConfigs(Options{Timeout: time.Duration(v.TimeoutInMilliseconds) * time.Millisecond})
			} else {
				client.ReloadConfigs(Options{Timeout: time.Duration(spec.Consumer.TimeoutInMilliseconds) * time.Millisecond})
			}
		}
	}
}

// EqualOpts equal newOpts and oldOpts
func EqualOpts(oldOpts, newOpts Options) Options {
	if newOpts.Timeout != oldOpts.Timeout {
		oldOpts.Timeout = newOpts.Timeout
	}

	if newOpts.PoolSize != 0 {
		oldOpts.PoolSize = newOpts.PoolSize
	}
	if newOpts.PoolTTL != 0 {
		oldOpts.PoolTTL = newOpts.PoolTTL
	}
	if newOpts.TLSConfig != nil {
		oldOpts.TLSConfig = newOpts.TLSConfig
	}
	oldOpts.Failure = newOpts.Failure
	oldOpts.CheckRedirect = newOpts.CheckRedirect
	return oldOpts
}

```

### Core Architecture Module: `core/client/client_plugins.go`
```
package client

import (
	"fmt"
	"github.com/go-chassis/openlog"
)

// NewFunc is function for the client
type NewFunc func(Options) (ProtocolClient, error)

var plugins = make(map[string]NewFunc)

// GetClientNewFunc is to get the client
func GetClientNewFunc(name string) (NewFunc, error) {
	f := plugins[name]
	if f == nil {
		return nil, fmt.Errorf("don't have client plugin %s", name)
	}
	return f, nil
}

// InstallPlugin is plugin for the new function
func InstallPlugin(protocol string, f NewFunc) {
	openlog.Info("Install client plugin, protocol: " + protocol)
	plugins[protocol] = f
}

```

### Core Architecture Module: `core/client/transport_handler.go`
```
package client

import (
	"context"
	"errors"
	"fmt"
	"net/http"
	"time"

	"github.com/go-chassis/go-chassis/v2/core/common"
	"github.com/go-chassis/go-chassis/v2/core/config"
	"github.com/go-chassis/go-chassis/v2/core/handler"
	"github.com/go-chassis/go-chassis/v2/core/invocation"
	"github.com/go-chassis/go-chassis/v2/core/loadbalancer"
	"github.com/go-chassis/go-chassis/v2/session"
	"github.com/go-chassis/openlog"
)

// TransportHandler transport handler
type TransportHandler struct{}

// Name returns transport string
func (th *TransportHandler) Name() string {
	return "transport"
}
func errNotNil(err error, cb invocation.ResponseCallBack) {
	r := &invocation.Response{
		Err: err,
	}
	openlog.Error("GetClient got Error: " + err.Error())
	cb(r)
}

// Handle is to handle transport related things
func (th *TransportHandler) Handle(chain *handler.Chain, i *invocation.Invocation, cb invocation.ResponseCallBack) {

	c, err := GetClient(i)
	if err != nil {
		errNotNil(err, cb)
		return
	}

	r := &invocation.Response{}

	//taking the time elapsed to check for latency aware strategy
	timeBefore := time.Now()
	err = c.Call(i.Ctx, i.Endpoint, i, i.Reply)
	if err != nil {
		r.Err = err
		if !errors.Is(err, ErrCanceled) {
			openlog.Error(fmt.Sprintf("call err [%s]", err.Error()))
		}
		if i.Strategy == loadbalancer.StrategySessionStickiness {
			ProcessSpecialProtocol(i)
			ProcessSuccessiveFailure(i)
		}
		r.Status, _ = c.Status(i.Reply)
		cb(r)
		return
	}
	r.Status, err = c.Status(i.Reply)
	if err != nil {
		r.Err = err
		cb(r)
		return
	}
	if i.Strategy == loadbalancer.StrategyLatency {
		timeAfter := time.Since(timeBefore)
		loadbalancer.SetLatency(timeAfter, i.Endpoint, i.MicroServiceName, i.RouteTags, i.Protocol)
	}

	if i.Strategy == loadbalancer.StrategySessionStickiness {
		ProcessSpecialProtocol(i)
	}

	r.Result = i.Reply
	cb(r)
}

// ProcessSpecialProtocol handles special logic for protocol
func ProcessSpecialProtocol(inv *invocation.Invocation) {
	switch inv.Protocol {
	case common.ProtocolRest:
		var reply *http.Response
		if inv.Reply != nil && inv.Args != nil {
			reply = inv.Reply.(*http.Response)
			req := inv.Args.(*http.Request)
			session.SaveSessionIDFromHTTP(inv.Endpoint, config.GetSessionTimeout(inv.SourceMicroService, inv.MicroServiceName), reply, req)
		}
	case common.ProtocolHighway:
		inv.Ctx = session.SaveSessionIDFromContext(inv.Ctx, inv.Endpoint, config.GetSessionTimeout(inv.SourceMicroService, inv.MicroServiceName))
	}
}

// ProcessSuccessiveFailure handles special logic for protocol
func ProcessSuccessiveFailure(i *invocation.Invocation) {
	var cookie string
	var reply *http.Response

	switch i.Protocol {
	case common.ProtocolRest:
		if i.Reply != nil && i.Args != nil {
			reply = i.Reply.(*http.Response)
		}
		cookie = session.GetSessionCookie(context.TODO(), reply)
		if cookie != "" {
			loadbalancer.IncreaseSuccessiveFailureCount(cookie)
			errCount := loadbalancer.GetSuccessiveFailureCount(cookie)
			if errCount == config.StrategySuccessiveFailedTimes(i.SourceServiceID, i.MicroServiceName) {
				session.DeletingKeySuccessiveFailure(reply)
				loadbalancer.DeleteSuccessiveFailureCount(cookie)
			}
		}
	default:
		cookie = session.GetSessionCookie(i.Ctx, nil)
		if cookie != "" {
			loadbalancer.IncreaseSuccessiveFailureCount(cookie)
			errCount := loadbalancer.GetSuccessiveFailureCount(cookie)
			if errCount == config.StrategySuccessiveFailedTimes(i.SourceServiceID, i.MicroServiceName) {
				session.DeletingKeySuccessiveFailure(nil)
				loadbalancer.DeleteSuccessiveFailureCount(cookie)
			}
		}
	}
}

func newTransportHandler() handler.Handler {
	return &TransportHandler{}
}
func init() {
	err := handler.RegisterHandler(handler.Transport, newTransportHandler)
	if err != nil {
		openlog.Fatal("can not init chassis" + err.Error())
	}
}

```

### Core Architecture Module: `core/common/common.go`
```
package common

import (
	"context"
	"encoding/json"
	"fmt"
	"net/http"

	"github.com/go-chassis/go-archaius/source/remote"
	"github.com/go-chassis/openlog"
)

// constant for provider and consumer
const (
	Provider = "Provider"
	Consumer = "Consumer"
)

const (
	// ScopeFull means service is able to access to another app's service
	ScopeFull = "full"
	// ScopeApp means service is not able to access to another app's service
	ScopeApp = "app"
)

// constant for micro service environment parameters
const (
	EnvCSEEndpoint = "PAAS_CSE_ENDPOINT"
	EnvNodeIP      = "HOSTING_SERVER_IP"
	EnvSchemaRoot  = "SCHEMA_ROOT"
	EnvSCEndpoint  = "PAAS_CSE_SC_ENDPOINT"
	EnvCCEndpoint  = "PAAS_CSE_CC_ENDPOINT"
)

// env connect with "." like servicecomb.service.name and servicecomb.service.version which can not be used in k8s.
// So we can not use archaius to set env.
// To support this declaring constant for service name and version
// constant for service name and version.
const (
	ServiceName = "CAS_COMPONENT_NAME"
	Version     = "CAS_INSTANCE_VERSION"
	App         = "CAS_APPLICATION_NAME"
	Env         = "ENVIRONMENT"
)

// constant for microservice environment
const (
	EnvValueDev  = "development"
	EnvValueProd = "production"
)

// constant for secure socket layer parameters
const (
	SslCipherPluginKey = "cipherPlugin"
	SslVerifyPeerKey   = "verifyPeer"
	SslCipherSuitsKey  = "cipherSuits"
	SslProtocolKey     = "protocol"
	SslCaFileKey       = "caFile"
	SslCertFileKey     = "certFile"
	SslKeyFileKey      = "keyFile"
	SslCertPwdFilePath = "certPwdFile"
	AKSKCustomCipher   = "servicecomb.credentials.akskCustomCipher"
	SslServerNameKey   = "serverName"
)

// constant for protocol types
const (
	ProtocolRest    = "rest"
	ProtocolHighway = "highway"
	LBSessionID     = "go-chassisLB"
)

// configuration placeholders
const (
	PlaceholderInternalIP = "$INTERNAL_IP"
)

// SessionNameSpaceKey metadata session namespace key
const SessionNameSpaceKey = "_Session_Namespace"

// SessionNameSpaceDefaultValue default session namespace value
const SessionNameSpaceDefaultValue = "default"

// DefaultKey default key
const DefaultKey = "default"

// DefaultValue default value
const DefaultValue = "default"

// BuildinTagApp build tag for the application
const BuildinTagApp = "app"

// BuildinTagVersion build tag version
const BuildinTagVersion = "version"

// BuildinLabelVersion build label for version
const BuildinLabelVersion = BuildinTagVersion + ":" + LatestVersion

// CallerKey caller key
const CallerKey = "caller"

// service comb headers
const (
	HeaderSourceName = "x-cse-src-microservice"
	// HeaderXCseContent is constant for header , get some json msg about HeaderSourceName like {"k":"v"}
	HeaderXCseContent = "x-cse-context"

	HeaderMark = "X-Mark"
)

// Rest metadata key for restful protocol
const (
	RestMethod    = "method"
	RestRoutePath = "url_pattern"
)

// constant for default application name and version
const (
	DefaultApp        = "default"
	DefaultVersion    = "0.0.1"
	LatestVersion     = "latest"
	AllVersion        = "0+"
	DefaultStatus     = "UP"
	TESTINGStatus     = "TESTING"
	DefaultLevel      = "BACK"
	DefaultHBInterval = 30
)

// constant used
const (
	HTTP   = "http"
	HTTPS  = "https"
	JSON   = "application/json"
	Create = "CREATE"
	Update = "UPDATE"
	Delete = "DELETE"

	Client           = "client"
	File             = "File"
	DefaultTenant    = "default"
	DefaultChainName = "default"

	FileRegistry      = "File"
	DefaultUserName   = "default"
	DefaultDomainName = "default"
	DefaultProvider   = "default"

	TRUE  = "true"
	FALSE = "false"
)

// const default config for config-server
const (
	DefaultRefreshMode = remote.ModeInterval
)

// ContextHeaderKey is the unified key of header value in context
// all protocol integrated with go chassis must set protocol header into context in this context key
type ContextHeaderKey struct{}

// NewContext transforms a metadata to context object
func NewContext(m map[string]string) context.Context {
	if m == nil {
		return context.WithValue(context.Background(), ContextHeaderKey{}, make(map[string]string))
	}
	return context.WithValue(context.Background(), ContextHeaderKey{}, m)
}

// WithContext sets the KV and returns the context object
func WithContext(ctx context.Context, key, val string) context.Context {
	if ctx == nil {
		return context.WithValue(context.Background(), ContextHeaderKey{}, map[string]string{
			key: val,
		})
	}
	at, ok := ctx.Value(ContextHeaderKey{}).(map[string]string)
	if !ok {
		openlog.Debug("context header key does not has map, re-create new context")
		return context.WithValue(ctx, ContextHeaderKey{}, map[string]string{
			key: val,
		})
	}
	at[key] = val
	return ctx
}

// FromContext return the headers which should be send to provider
// through transport
func FromContext(ctx context.Context) map[string]string {
	if ctx == nil {
		return make(map[string]string)
	}
	at, ok := ctx.Value(ContextHeaderKey{}).(map[string]string)
	if !ok {
		return make(map[string]string)
	}
	return at
}

// GetXCSEContext  get x-cse-context from req.header
func GetXCSEContext(k string, r *http.Request) string {
	if r == nil || r.Header == nil {
		openlog.Debug("get x-cse-header failed , request(request.Header) is nil or  key is empty, please check its")
		return ""
	}
	cseContextStr := r.Header.Get(HeaderXCseContent)
	if cseContextStr == "" {
		return r.Header.Get(k)
	}

	var m map[string]string
	err := json.Unmarshal([]byte(cseContextStr), &m)
	if err != nil {
		openlog.Debug(fmt.Sprintf("get x-cse-header form req failed , error : %v", err))
		return ""
	}
	return m[k]
}

// SetXCSEContext  set value into x-cse-context
func SetXCSEContext(vm map[string]string, r *http.Request) {
	if len(vm) <= 0 || vm == nil || r == nil {
		openlog.Debug("set x-cse-header into req failed ,because one of key,value and request is empty(nil) or all empty(nil)")
		return
	}
	if r.Header == nil {
		r.Header = make(map[string][]string)
	}
	b, err := json.Marshal(vm)
	if err != nil {
		openlog.Debug(fmt.Sprintf("set value to x-cse-context failed , error : %s", err))
		return
	}
	r.Header.Set(HeaderXCseContent, string(b))
}

```

### Core Architecture Module: `core/config/archaius.go`
```
package config

import (
	"github.com/go-chassis/go-archaius"
	"github.com/go-chassis/go-chassis/v2/pkg/util/fileutil"
	"time"
)

// InitArchaius initialize the archaius
func InitArchaius() error {
	var err error

	requiredFiles := []string{
		fileutil.GlobalConfigPath(),
		fileutil.MicroServiceConfigPath(),
	}
	optionalFiles := []string{
		fileutil.CircuitBreakerConfigPath(),
		fileutil.LoadBalancingConfigPath(),
		fileutil.RateLimitingFile(),
		fileutil.TLSConfigPath(),
		fileutil.MonitoringConfigPath(),
		fileutil.AuthConfigPath(),
		fileutil.TracingPath(),
		fileutil.LogConfigPath(),
		fileutil.RouterConfigPath(),
	}

	err = archaius.Init(
		archaius.WithCommandLineSource(),
		archaius.WithMemorySource(),
		archaius.WithENVSource(),
		archaius.WithRequiredFiles(requiredFiles),
		archaius.WithOptionalFiles(optionalFiles))

	return err
}

// GetTimeoutDurationFromArchaius get timeout durations from archaius
func GetTimeoutDurationFromArchaius(service, t string) time.Duration {
	timeout := archaius.GetInt(GetTimeoutKey(service), archaius.GetInt(GetDefaultTimeoutKey(t), DefaultTimeout))
	return time.Duration(timeout) * time.Millisecond
}

```

### Core Architecture Module: `core/config/cb_config.go`
```
package config

import (
	"sync"

	"github.com/go-chassis/go-archaius"
	"github.com/go-chassis/go-chassis/v2/core/common"
	"github.com/go-chassis/go-chassis/v2/core/config/model"
	"time"
)

// constant for hystrix parameters
const (
	DefaultForceFallback                 = false
	DefaultTimeoutEnabled                = false
	DefaultConsumerCircuitBreakerEnabled = false
	DefaultProviderCircuitBreakerEnabled = false
	DefaultCircuitBreakerForceOpen       = false
	DefaultCircuitBreakerForceClosed     = false
	DefaultFallbackEnable                = true
	DefaultMaxConcurrent                 = 1000
	DefaultSleepWindow                   = 15000
	DefaultTimeout                       = 30000
	DefaultErrorPercentThreshold         = 50
	DefaultRequestVolumeThreshold        = 20
	PolicyNull                           = "returnnull"
	PolicyThrowException                 = "throwexception"
)

var cbMutex = sync.RWMutex{}

// GetFallbackEnabled get fallback enabled
func GetFallbackEnabled(command, t string) bool {
	return archaius.GetBool(GetFallbackEnabledKey(command),
		archaius.GetBool(GetDefaultGetFallbackEnabledKey(t), DefaultFallbackEnable))
}

// GetCircuitBreakerEnabled get circuit breaker enabled
func GetCircuitBreakerEnabled(command, t string) bool {
	if common.Consumer == command {
		return archaius.GetBool(GetCircuitBreakerEnabledKey(command),
			archaius.GetBool(GetDefaultCircuitBreakerEnabledKey(t), DefaultConsumerCircuitBreakerEnabled))
	}

	return archaius.GetBool(GetCircuitBreakerEnabledKey(command),
		archaius.GetBool(GetDefaultCircuitBreakerEnabledKey(t), DefaultProviderCircuitBreakerEnabled))
}

// GetForceClose get force close
func GetForceClose(service, t string) bool {
	cbMutex.RLock()
	cbspec := getCircuitBreakerSpec(t)
	if cb, ok := cbspec.AnyService[service]; ok {
		cbMutex.RUnlock()
		return cb.ForceClose
	}
	cbMutex.RUnlock()
	return cbspec.ForceClose
}

// GetForceOpen get foce open
func GetForceOpen(service, t string) bool {
	cbMutex.RLock()
	cbspec := getCircuitBreakerSpec(t)
	if cb, ok := cbspec.AnyService[service]; ok {
		cbMutex.RUnlock()
		return cb.ForceOpen
	}
	cbMutex.RUnlock()
	return cbspec.ForceOpen
}

// GetTimeout get timeout durations
func GetTimeout(service, t string) int {
	cbMutex.RLock()
	global := getIsolationSpec(t).TimeoutInMilliseconds
	if global == 0 {
		global = DefaultTimeout
	}
	m := archaius.GetInt(GetTimeoutKey(service), global)
	cbMutex.RUnlock()
	return m
}

// GetTimeoutDuration get timeout durations from cache first, then get from archaius
func GetTimeoutDuration(service, t string) time.Duration {
	timeout := GetTimeout(service, t)
	return time.Duration(timeout) * time.Millisecond
}

// GetMaxConcurrentRequests get max concurrent requests
func GetMaxConcurrentRequests(command, t string) int {
	cbMutex.RLock()
	global := getIsolationSpec(t).MaxConcurrentRequests
	if global == 0 {
		global = DefaultMaxConcurrent
	}
	m := archaius.GetInt(GetMaxConcurrentKey(command), global)
	cbMutex.RUnlock()
	return m
}

// GetErrorPercentThreshold get error percent threshold
func GetErrorPercentThreshold(command, t string) int {
	cbMutex.RLock()
	global := getCircuitBreakerSpec(t).ErrorThresholdPercentage
	if global == 0 {
		global = DefaultErrorPercentThreshold
	}
	m := archaius.GetInt(GetErrorPercentThresholdKey(command), global)
	cbMutex.RUnlock()
	return m
}

// GetRequestVolumeThreshold get request volume threshold
func GetRequestVolumeThreshold(command, t string) int {
	cbMutex.RLock()
	global := getCircuitBreakerSpec(t).RequestVolumeThreshold
	if global == 0 {
		global = DefaultRequestVolumeThreshold
	}
	m := archaius.GetInt(GetRequestVolumeThresholdKey(command), global)
	cbMutex.RUnlock()
	return m
}

// GetSleepWindow get sleep window
func GetSleepWindow(command, t string) int {
	cbMutex.RLock()
	global := getCircuitBreakerSpec(t).SleepWindowInMilliseconds
	if global == 0 {
		global = DefaultSleepWindow
	}
	m := archaius.GetInt(GetSleepWindowKey(command), global)
	cbMutex.RUnlock()
	return m
}

// GetPolicy get fallback policy
func GetPolicy(service, t string) string {
	cbMutex.RLock()
	policy := getFallbackPolicySpec(t).AnyService[service].Policy
	if policy == "" {
		policy = getFallbackPolicySpec(t).Policy
		if policy == "" {
			policy = PolicyThrowException
		}
	}
	cbMutex.RUnlock()
	return policy
}

func getIsolationSpec(command string) *model.IsolationSpec {
	if command == common.Consumer {
		return GetHystrixConfig().IsolationProperties.Consumer
	}
	return GetHystrixConfig().IsolationProperties.Provider
}

func getCircuitBreakerSpec(command string) *model.CircuitBreakerSpec {
	if command == common.Consumer {
		return GetHystrixConfig().CircuitBreakerProperties.Consumer
	}
	return GetHystrixConfig().CircuitBreakerProperties.Provider
}

func getFallbackSpec(command string) *model.FallbackSpec {
	if command == common.Consumer {
		return GetHystrixConfig().FallbackProperties.Consumer
	}
	return GetHystrixConfig().FallbackProperties.Provider
}

func getFallbackPolicySpec(command string) *model.FallbackPolicySpec {
	if command == common.Consumer {
		return GetHystrixConfig().FallbackPolicyProperties.Consumer
	}
	return GetHystrixConfig().FallbackPolicyProperties.Provider
}

// GetForceFallback get force fallback
func GetForceFallback(service, t string) bool {
	cbMutex.RLock()
	fallback := getFallbackSpec(t)
	if en, ok := fallback.AnyService[service]; ok {
		cbMutex.RUnlock()
		return en.Force
	}
	cbMutex.RUnlock()
	return fallback.Force
}

```

### Core Architecture Module: `core/config/cd_config.go`
```
package config

import "github.com/go-chassis/go-archaius"

// GetContractDiscoveryType returns the Type of contract discovery registry
func GetContractDiscoveryType() string {
	return GlobalDefinition.ServiceComb.Registry.Type
}

// GetContractDiscoveryAddress returns the Address of contract discovery registry
func GetContractDiscoveryAddress() string {
	return GlobalDefinition.ServiceComb.Registry.Address
}

// GetContractDiscoveryAPIVersion returns the APIVersion of contract discovery registry
func GetContractDiscoveryAPIVersion() string {
	return GlobalDefinition.ServiceComb.Registry.APIVersion.Version
}

// GetContractDiscoveryDisable returns the Disable of contract discovery registry
func GetContractDiscoveryDisable() bool {
	return archaius.GetBool("servicecomb.registry.disabled", false)
}

```

### Core Architecture Module: `core/config/config.go`
```
package config

import (
	"errors"
	"fmt"
	"log"
	"os"

	"github.com/go-chassis/go-archaius"
	"github.com/go-chassis/go-chassis/v2/core/common"
	"github.com/go-chassis/go-chassis/v2/core/config/model"
	"github.com/go-chassis/go-chassis/v2/core/config/schema"
	"github.com/go-chassis/go-chassis/v2/pkg/runtime"
	"github.com/go-chassis/go-chassis/v2/pkg/util/fileutil"
	"github.com/go-chassis/go-chassis/v2/pkg/util/iputil"
	"github.com/go-chassis/openlog"
)

// GlobalDefinition is having the information about region, load balancing, service center, config server,
// protocols, and handlers for the micro service
var GlobalDefinition *model.GlobalCfg
var lbConfig *model.LBWrapper

// MicroserviceDefinition has info about application id, provider info, description of the service,
// and description of the instance
var MicroserviceDefinition *model.ServiceSpec

// MonitorCfgDef has monitor info, including zipkin and apm.
var MonitorCfgDef *model.MonitorCfg

// HystrixConfig is having info about isolation, circuit breaker, fallback properities of the micro service
var HystrixConfig *model.HystrixConfigWrapper

// ErrNoName is used to represent the service name missing error
var ErrNoName = errors.New("micro service name is missing in description file")

// GetConfigServerConf return config server conf
func GetConfigServerConf() model.ConfigClient {
	return GlobalDefinition.ServiceComb.Config.Client
}

// GetTransportConf return transport settings
func GetTransportConf() model.Transport {
	return GlobalDefinition.ServiceComb.Transport
}

// GetDataCenter return data center info
func GetDataCenter() *model.DataCenterInfo {
	return GlobalDefinition.DataCenter
}

// GetAPM return monitor config info
func GetAPM() model.APMStruct {
	return MonitorCfgDef.ServiceComb.APM
}

// readFromArchaius unmarshal configurations to expected pointer
func readFromArchaius() error {
	openlog.Debug("read from archaius")
	err := ReadGlobalConfigFromArchaius()
	if err != nil {
		return err
	}
	err = ReadLBFromArchaius()
	if err != nil {
		return err
	}

	err = ReadHystrixFromArchaius()
	if err != nil {
		return err
	}

	populateConfigServerAddress()
	populateServiceRegistryAddress()
	err = ReadMonitorFromArchaius()
	if err != nil {
		return err
	}

	populateServiceEnvironment()
	populateServiceName()
	populateVersion()
	populateApp()

	return nil
}

// populateServiceRegistryAddress populate service registry address
func populateServiceRegistryAddress() {
	//Registry Address , higher priority for environment variable
	registryAddrFromEnv := readEndpoint(common.EnvSCEndpoint)
	if registryAddrFromEnv != "" {
		openlog.Debug("detect env", openlog.WithTags(
			openlog.Tags{
				"ep": registryAddrFromEnv,
			}))
		GlobalDefinition.ServiceComb.Registry.Address = registryAddrFromEnv
	}
}

// populateConfigServerAddress populate config server address
func populateConfigServerAddress() {
	//config server Address , higher priority for environment variable
	configServerAddrFromEnv := readEndpoint(common.EnvCCEndpoint)
	if configServerAddrFromEnv != "" {
		GlobalDefinition.ServiceComb.Config.Client.ServerURI = configServerAddrFromEnv
	}
}

// readEndpoint
func readEndpoint(env string) string {
	addrFromEnv := archaius.GetString(env, archaius.GetString(common.EnvCSEEndpoint, ""))
	if addrFromEnv != "" {
		openlog.Info("read config " + addrFromEnv)
		return addrFromEnv
	}
	return addrFromEnv
}

// populateServiceEnvironment populate service environment
func populateServiceEnvironment() {
	if e := archaius.GetString(common.Env, ""); e != "" {
		MicroserviceDefinition.Environment = e
	}
}

// populateServiceName populate service name
func populateServiceName() {
	if e := archaius.GetString(common.ServiceName, ""); e != "" {
		MicroserviceDefinition.Name = e
	}
}

// populateVersion populate version
func populateVersion() {
	if e := archaius.GetString(common.Version, ""); e != "" {
		MicroserviceDefinition.Version = e
	}
}

func populateApp() {
	if e := archaius.GetString(common.App, ""); e != "" {
		MicroserviceDefinition.AppID = e
	}
}

// ReadGlobalConfigFromArchaius for to unmarshal the global config file(chassis.yaml) information
func ReadGlobalConfigFromArchaius() error {
	GlobalDefinition = &model.GlobalCfg{}
	err := archaius.UnmarshalConfig(&GlobalDefinition)
	if err != nil {
		return err
	}
	MicroserviceDefinition = &GlobalDefinition.ServiceComb.ServiceDescription
	return nil
}

// ReadLBFromArchaius for to unmarshal the global config file(chassis.yaml) information
func ReadLBFromArchaius() error {
	lbConfig = &model.LBWrapper{}
	err := archaius.UnmarshalConfig(lbConfig)
	if err != nil {
		return err
	}
	log.Println(fmt.Printf("%+v", lbConfig))
	return nil
}

// ReadMonitorFromArchaius read monitor config from archauis pkg
func ReadMonitorFromArchaius() error {
	MonitorCfgDef = &model.MonitorCfg{}
	err := archaius.UnmarshalConfig(&MonitorCfgDef)
	if err != nil {
		openlog.Error("Config init failed. " + err.Error())
		return err
	}
	return nil
}

// ReadHystrixFromArchaius is unmarshal hystrix configuration file(circuit_breaker.yaml)
func ReadHystrixFromArchaius() error {
	hystrixCnf := model.HystrixConfigWrapper{}
	err := archaius.UnmarshalConfig(&hystrixCnf)
	if err != nil {
		return err
	}
	HystrixConfig = &hystrixCnf
	return nil
}

// GetLoadBalancing return lb config
func GetLoadBalancing() *model.LoadBalancing {
	if lbConfig != nil {
		return &lbConfig.Prefix.LBConfig
	}
	return nil
}

// GetHystrixConfig return cb config
func GetHystrixConfig() *model.HystrixConfig {
	if HystrixConfig != nil {
		return HystrixConfig.HystrixConfig
	}
	return nil
}

// Init is initialize the configuration directory, archaius, route rule, and schema
func Init() error {
	err := InitArchaius()
	if err != nil {
		return err
	}

	//Upload schemas using environment variable SCHEMA_ROOT
	schemaPath := archaius.GetString(common.EnvSchemaRoot, "")
	if schemaPath == "" {
		schemaPath = fileutil.GetConfDir()
	}

	schemaError := schema.LoadSchema(schemaPath)
	if schemaError != nil {
		return schemaError
	}

	//set micro service names
	err = schema.SetMicroServiceNames(schemaPath)
	if err != nil {
		return err
	}

	runtime.NodeIP = archaius.GetString(common.EnvNodeIP, "")

	err = readFromArchaius()
	if err != nil {
		return err
	}

	runtime.ServiceName = MicroserviceDefinition.Name
	runtime.Version = MicroserviceDefinition.Version
	runtime.Environment = MicroserviceDefinition.Environment
	runtime.MD = MicroserviceDefinition.Properties
	runtime.App = MicroserviceDefinition.AppID
	if runtime.App == "" {
		runtime.App = common.DefaultApp
	}

	runtime.HostName = MicroserviceDefinition.Hostname
	if runtime.HostName == "" {
		runtime.HostName, err = os.Hostname()
		if err != nil {
			openlog.Error("Get hostname failed:" + err.Error())
			return err
		}
	} else if runtime.HostName == common.PlaceholderInternalIP {
		runtime.HostName = iputil.GetLocalIP()
	}
	openlog.Info("Host name is " + runtime.HostName)
	return err
}

```

### Core Architecture Module: `core/config/fault_injection_config.go`
```
package config

import (
	"github.com/go-chassis/go-archaius"

	"strconv"
	"time"
)

// constant for default values of abort and delay
const (
	DefaultAbortPercent = 0
	DefaultAbortStatus  = 0
	DefaultDelayPercent = 0
)

// GetAbortPercent get abort percentage
func GetAbortPercent(protocol, microServiceName, schema, operation string) int {

	var key string
	var abortPercent int
	if microServiceName != "" && schema != "" && operation != "" {
		key = GetFaultInjectionOperationKey(microServiceName, schema, operation)
		abortPercent = archaius.GetInt(GetFaultAbortPercentKey(key, protocol), DefaultAbortPercent)
	}
	if abortPercent == 0 && microServiceName != "" && schema != "" {
		key = GetFaultInjectionSchemaKey(microServiceName, schema)
		abortPercent = archaius.GetInt(GetFaultAbortPercentKey(key, protocol), DefaultAbortPercent)
	}
	if abortPercent == 0 && microServiceName != "" {
		key = GetFaultInjectionServiceKey(microServiceName)
		abortPercent = archaius.GetInt(GetFaultAbortPercentKey(key, protocol), DefaultAbortPercent)
	}
	if abortPercent == 0 {
		key = GetFaultInjectionGlobalKey()
		abortPercent = archaius.GetInt(GetFaultAbortPercentKey(key, protocol), DefaultAbortPercent)
	}

	return abortPercent
}

// GetAbortStatus get abort status
func GetAbortStatus(protocol, microServiceName, schema, operation string) int {

	var key string
	var abortHTTPStatus int
	if microServiceName != "" && schema != "" && operation != "" {
		key = GetFaultInjectionOperationKey(microServiceName, schema, operation)
		abortHTTPStatus = archaius.GetInt(GetFaultAbortHTTPStatusKey(key, protocol), DefaultAbortStatus)
	}
	if abortHTTPStatus == 0 && microServiceName != "" && schema != "" {
		key = GetFaultInjectionSchemaKey(microServiceName, schema)
		abortHTTPStatus = archaius.GetInt(GetFaultAbortHTTPStatusKey(key, protocol), DefaultAbortStatus)
	}
	if abortHTTPStatus == 0 && microServiceName != "" {
		key = GetFaultInjectionServiceKey(microServiceName)
		abortHTTPStatus = archaius.GetInt(GetFaultAbortHTTPStatusKey(key, protocol), DefaultAbortStatus)
	}
	if abortHTTPStatus == 0 {
		key = GetFaultInjectionGlobalKey()
		abortHTTPStatus = archaius.GetInt(GetFaultAbortHTTPStatusKey(key, protocol), DefaultAbortStatus)
	}

	return abortHTTPStatus
}

// GetDelayPercent get delay percentage
func GetDelayPercent(protocol, microServiceName, schema, operation string) int {

	var key string
	var delayPercent int
	if microServiceName != "" && schema != "" && operation != "" {
		key = GetFaultInjectionOperationKey(microServiceName, schema, operation)
		delayPercent = archaius.GetInt(GetFaultDelayPercentKey(key, protocol), DefaultDelayPercent)
	}
	if delayPercent == 0 && microServiceName != "" && schema != "" {
		key = GetFaultInjectionSchemaKey(microServiceName, schema)
		delayPercent = archaius.GetInt(GetFaultDelayPercentKey(key, protocol), DefaultDelayPercent)
	}
	if delayPercent == 0 && microServiceName != "" {
		key = GetFaultInjectionServiceKey(microServiceName)
		delayPercent = archaius.GetInt(GetFaultDelayPercentKey(key, protocol), DefaultDelayPercent)
	}
	if delayPercent == 0 {
		key = GetFaultInjectionGlobalKey()
		delayPercent = archaius.GetInt(GetFaultDelayPercentKey(key, protocol), DefaultDelayPercent)
	}

	return delayPercent
}

// GetFixedDelay get fixed delay
func GetFixedDelay(protocol, microServiceName, schema, operation string) time.Duration {
	var key string
	var fixedDelayTime time.Duration
	var fixedDelay interface{}
	if microServiceName != "" && schema != "" && operation != "" {
		key = GetFaultInjectionOperationKey(microServiceName, schema, operation)
		fixedDelay = archaius.Get(GetFaultFixedDelayKey(key, protocol))
	}
	if fixedDelay == nil && microServiceName != "" && schema != "" {
		key = GetFaultInjectionSchemaKey(microServiceName, schema)
		fixedDelay = archaius.Get(GetFaultFixedDelayKey(key, protocol))
	}
	if fixedDelay == nil && microServiceName != "" {
		key = GetFaultInjectionServiceKey(microServiceName)
		fixedDelay = archaius.Get(GetFaultFixedDelayKey(key, protocol))
	}
	if fixedDelay == nil {
		key = GetFaultInjectionGlobalKey()
		fixedDelay = archaius.Get(GetFaultFixedDelayKey(key, protocol))
	}
	switch fixedDelay := fixedDelay.(type) {
	case int:
		fixedDelayInt := fixedDelay
		fixedDelayTime = time.Duration(fixedDelayInt) * time.Millisecond
	case string:
		fixedDelayInt, _ := strconv.Atoi(fixedDelay)
		fixedDelayTime = time.Duration(fixedDelayInt) * time.Millisecond
	}
	return fixedDelayTime
}

```

### Core Architecture Module: `core/config/key_generator.go`
```
package config

import "strings"

// constant for hystrix keys
const (
	FixedPrefix                       = "cse"
	NamespaceIsolation                = "isolation"
	NamespaceCircuitBreaker           = "circuitBreaker"
	NamespaceFallback                 = "fallback" //降级
	NamespaceFallbackpolicy           = "fallbackpolicy"
	PropertyTimeoutInMilliseconds     = "timeoutInMilliseconds"
	PropertyTimeoutEnabled            = "timeout.enabled"
	PropertyMaxConcurrentRequests     = "maxConcurrentRequests"
	PropertyErrorThresholdPercentage  = "errorThresholdPercentage"  //失败率
	PropertyRequestVolumeThreshold    = "requestVolumeThreshold"    //窗口请求数
	PropertySleepWindowInMilliseconds = "sleepWindowInMilliseconds" //熔断时间窗
	PropertyEnabled                   = "enabled"
	PropertyForce                     = "force"
	PropertyPolicy                    = "policy"
	PropertyForceClosed               = "forceClosed"
	PropertyForceOpen                 = "forceOpen"
	PropertyFault                     = "fault"
	PropertyGlobal                    = "_global"
	PropertyGovernance                = "governance"
	PropertyConsumer                  = "Consumer"
	PropertySchema                    = "schemas"
	PropertyOperations                = "operations"
	PropertyProtocol                  = "protocols"
	PropertyAbort                     = "abort"
	PropertyPercent                   = "percent"
	PropertyFixedDelay                = "fixedDelay"
	PropertyDelay                     = "delay"
	PropertyHTTPStatus                = "httpStatus"

	LoadBalance = "loadbalance"
)

/*
Hystrix Keys
*/

// GetHystrixSpecificKey get hystrix specific key
func GetHystrixSpecificKey(namespace, cmd, property string) string {
	return strings.Join([]string{FixedPrefix, namespace, cmd, property}, ".")
}

// GetForceFallbackKey get force fallback key
func GetForceFallbackKey(command string) string {
	return GetHystrixSpecificKey(NamespaceFallback, command, PropertyForce)
}

// GetDefaultForceFallbackKey get default force fallback key
func GetDefaultForceFallbackKey(t string) string {
	return GetHystrixSpecificKey(NamespaceFallback, t, PropertyForce)
}

// GetTimeoutKey get timeout key
func GetTimeoutKey(command string) string {
	return GetHystrixSpecificKey(NamespaceIsolation, command, PropertyTimeoutInMilliseconds)
}

// GetDefaultTimeoutKey get default timeout key
func GetDefaultTimeoutKey(t string) string {
	return GetHystrixSpecificKey(NamespaceIsolation, t, PropertyTimeoutInMilliseconds)
}

// GetMaxConcurrentKey get maximum concurrent key
func GetMaxConcurrentKey(command string) string {
	return GetHystrixSpecificKey(NamespaceIsolation, command, PropertyMaxConcurrentRequests)
}

// GetDefaultMaxConcurrentKey get default maximum concurrent key
func GetDefaultMaxConcurrentKey(t string) string {
	return GetHystrixSpecificKey(NamespaceIsolation, t, PropertyMaxConcurrentRequests)
}

// GetErrorPercentThresholdKey get error percentage threshold key
func GetErrorPercentThresholdKey(command string) string {
	return GetHystrixSpecificKey(NamespaceCircuitBreaker, command, PropertyErrorThresholdPercentage)
}

// GetDefaultErrorPercentThreshold get default error percentage threshold value
func GetDefaultErrorPercentThreshold(t string) string {
	return GetHystrixSpecificKey(NamespaceCircuitBreaker, t, PropertyErrorThresholdPercentage)
}

// GetRequestVolumeThresholdKey get request volume threshold key
func GetRequestVolumeThresholdKey(command string) string {
	return GetHystrixSpecificKey(NamespaceCircuitBreaker, command, PropertyRequestVolumeThreshold)
}

// GetDefaultRequestVolumeThresholdKey get default request volume threshold key
func GetDefaultRequestVolumeThresholdKey(t string) string {
	return GetHystrixSpecificKey(NamespaceCircuitBreaker, t, PropertyRequestVolumeThreshold)
}

// GetSleepWindowKey get sleep window key
func GetSleepWindowKey(command string) string {
	return GetHystrixSpecificKey(NamespaceCircuitBreaker, command, PropertySleepWindowInMilliseconds)
}

// GetDefaultSleepWindowKey get default sleep window key
func GetDefaultSleepWindowKey(t string) string {
	return GetHystrixSpecificKey(NamespaceCircuitBreaker, t, PropertySleepWindowInMilliseconds)
}

// GetForceCloseKey get force close key
func GetForceCloseKey(command string) string {
	return GetHystrixSpecificKey(NamespaceCircuitBreaker, command, PropertyForceClosed)
}

// GetDefaultForceCloseKey get default force close key
func GetDefaultForceCloseKey(t string) string {
	return GetHystrixSpecificKey(NamespaceCircuitBreaker, t, PropertyForceClosed)
}

// GetForceOpenKey get force open key
func GetForceOpenKey(command string) string {
	return GetHystrixSpecificKey(NamespaceCircuitBreaker, command, PropertyForceOpen)
}

// GetDefaultForceOpenKey get default force open key
func GetDefaultForceOpenKey(t string) string {
	return GetHystrixSpecificKey(NamespaceCircuitBreaker, t, PropertyForceOpen)
}

// GetCircuitBreakerEnabledKey get circuit breaker enabled key
func GetCircuitBreakerEnabledKey(command string) string {
	return GetHystrixSpecificKey(NamespaceCircuitBreaker, command, PropertyEnabled)
}

// GetDefaultCircuitBreakerEnabledKey get default circuit breaker enabled key
func GetDefaultCircuitBreakerEnabledKey(t string) string {
	return GetHystrixSpecificKey(NamespaceCircuitBreaker, t, PropertyEnabled)
}

// GetFallbackEnabledKey get fallback enabled key
func GetFallbackEnabledKey(command string) string {
	return GetHystrixSpecificKey(NamespaceFallback, command, PropertyEnabled)
}

// GetDefaultGetFallbackEnabledKey get default fallback enabled key
func GetDefaultGetFallbackEnabledKey(t string) string {
	return GetHystrixSpecificKey(NamespaceFallback, t, PropertyEnabled)
}

// GetFallbackPolicyKey get fallback policy key
func GetFallbackPolicyKey(command string) string {
	return GetHystrixSpecificKey(NamespaceFallbackpolicy, command, PropertyPolicy)
}

// GetDefaultFallbackPolicyKey get default fallback policy key
func GetDefaultFallbackPolicyKey(t string) string {
	return GetHystrixSpecificKey(NamespaceFallbackpolicy, t, PropertyPolicy)
}

// GetFilterNamesKey get filer name and key
func GetFilterNamesKey() string {
	return strings.Join([]string{FixedPrefix, LoadBalance, "serverListFilters"}, ".")
}

// GetFaultInjectionOperationKey get fault injection operation key
func GetFaultInjectionOperationKey(microServiceName, schema, operation string) string {
	return strings.Join([]string{FixedPrefix, PropertyGovernance, PropertyConsumer, microServiceName,
		PropertySchema, schema, PropertyOperations, operation, PropertyPolicy, PropertyFault}, ".")
}

// GetFaultInjectionSchemaKey get fault injection schema key
func GetFaultInjectionSchemaKey(microServiceName, schema string) string {
	return strings.Join([]string{FixedPrefix, PropertyGovernance, PropertyConsumer, microServiceName,
		PropertySchema, schema, PropertyPolicy, PropertyFault}, ".")
}

// GetFaultInjectionServiceKey get fault injection service key
func GetFaultInjectionServiceKey(microServiceName string) string {
	return strings.Join([]string{FixedPrefix, PropertyGovernance, PropertyConsumer, microServiceName, PropertyPolicy, PropertyFault}, ".")
}

// GetFaultInjectionGlobalKey get fault injection global key
func GetFaultInjectionGlobalKey() string {
	return strings.Join([]string{FixedPrefix, PropertyGovernance, PropertyConsumer, PropertyGlobal, PropertyPolicy, PropertyFault}, ".")
}

// GetFaultAbortPercentKey get fault abort percentage key
func GetFaultAbortPercentKey(key, protocol string) string {
	return strings.Join([]string{key, PropertyProtocol, protocol, PropertyAbort, PropertyPercent}, ".")
}

// GetFaultAbortHTTPStatusKey get fault abort http status key
func GetFaultAbortHTTPStatusKey(key, protocol string) string {
	return strings.Join([]string{key, PropertyProtocol, protocol, PropertyAbort, PropertyHTTPStatus}, ".")
}

// GetFaultDelayPercentKey get fault daley percentage key
func GetFaultDelayPercentKey(key, protocol string) string {
	return strings.Join([]string{key, PropertyProtocol, protocol, PropertyDelay, PropertyPercent}, ".")
}

// GetFaultFixedDelayKey get fault fixed delay key
func GetFaultFixedDelayKey(key, protocol string) string {
	return strings.Join([]string{key, PropertyProtocol, protocol, PropertyDelay, PropertyFixedDelay}, ".")
}

```

### Core Architecture Module: `core/config/lb_config.go`
```
package config

import (
	"github.com/go-chassis/go-archaius"
	"github.com/go-chassis/go-chassis/v2/resilience/retry"
	"strings"
	"sync"
)

const (
	lbPrefix                                 = "cse.loadbalance"
	propertySessionStickinessRuleTimeout     = "SessionStickinessRule.sessionTimeoutInSeconds"
	propertySessionStickinessRuleFailedTimes = "SessionStickinessRule.successiveFailedTimes"
	propertyRetryEnabled                     = "retryEnabled"
	propertyRetryOnNext                      = "retryOnNext"
	propertyRetryOnSame                      = "retryOnSame"
	propertyBackoffMinMs                     = "backoff.minMs"
	propertyBackoffMaxMs                     = "backoff.maxMs"

	//DefaultStrategy is default value for strategy
	DefaultStrategy = "RoundRobin"
	//DefaultSessionTimeout is default value for timeout
	DefaultSessionTimeout = 30
	//DefaultFailedTimes is default value for failed times
	DefaultFailedTimes = 5
)

var lbMutex = sync.RWMutex{}

func genKey(s ...string) string {
	return strings.Join(s, ".")
}

// GetServerListFilters get server list filters
func GetServerListFilters() (filters []string) {
	lbMutex.RLock()
	filters = strings.Split(GetLoadBalancing().Filters, ",")
	lbMutex.RUnlock()
	return
}

// GetStrategyName get strategy name
func GetStrategyName(service string) string {
	lbMutex.RLock()
	r := GetLoadBalancing().AnyService[service].Strategy["name"]
	if r == "" {
		r = GetLoadBalancing().Strategy["name"]
		if r == "" {
			r = DefaultStrategy
		}
	}
	lbMutex.RUnlock()
	return r
}

// GetSessionTimeout return session timeout
func GetSessionTimeout(source, service string) int {
	lbMutex.RLock()
	global := GetLoadBalancing().SessionStickinessRule.SessionTimeoutInSeconds
	if global == 0 {
		global = DefaultSessionTimeout
	}
	ms := archaius.GetInt(genKey(lbPrefix, service, propertySessionStickinessRuleTimeout), global)
	lbMutex.RUnlock()
	return ms
}

// StrategySuccessiveFailedTimes strategy successive failed times
func StrategySuccessiveFailedTimes(source, service string) int {
	lbMutex.RLock()
	global := GetLoadBalancing().SessionStickinessRule.SuccessiveFailedTimes
	if global == 0 {
		global = DefaultFailedTimes
	}
	ms := archaius.GetInt(genKey(lbPrefix, service, propertySessionStickinessRuleFailedTimes), global)
	lbMutex.RUnlock()
	return ms
}

// RetryEnabled retry enabled
func RetryEnabled(source, service string) bool {
	lbMutex.RLock()
	global := GetLoadBalancing().RetryEnabled
	ms := archaius.GetBool(genKey(lbPrefix, service, propertyRetryEnabled), global)
	lbMutex.RUnlock()
	return ms
}

// GetRetryOnNext return value of GetRetryOnNext
func GetRetryOnNext(source, service string) int {
	lbMutex.RLock()
	global := GetLoadBalancing().RetryOnNext
	ms := archaius.GetInt(genKey(lbPrefix, service, propertyRetryOnNext), global)
	lbMutex.RUnlock()
	return ms
}

// GetRetryOnSame return value of RetryOnSame
func GetRetryOnSame(source, service string) int {
	lbMutex.RLock()
	global := GetLoadBalancing().RetryOnSame
	ms := archaius.GetInt(genKey(lbPrefix, service, propertyRetryOnSame), global)
	lbMutex.RUnlock()
	return ms
}

// BackOffKind get kind
func BackOffKind(service string) string {
	r := GetLoadBalancing().AnyService[service].Backoff.Kind
	if r == "" {
		r = GetLoadBalancing().Backoff.Kind
		if r == "" {
			r = retry.DefaultBackOffKind
		}
	}
	return r
}

// BackOffMinMs get min time
func BackOffMinMs(source, service string) int {
	global := GetLoadBalancing().Backoff.MinMs
	ms := archaius.GetInt(genKey(lbPrefix, service, propertyBackoffMinMs), global)
	return ms
}

// BackOffMaxMs get max time
func BackOffMaxMs(source, service string) int {
	global := GetLoadBalancing().Backoff.MaxMs
	ms := archaius.GetInt(genKey(lbPrefix, service, propertyBackoffMaxMs), global)
	return ms
}

```


### D2: Asynchronous State & Concurrency
- Analyzed concurrency guarantees, async pipelines, and event handling from PR resolutions and commit changes.

### D3: Error Boundaries, Recovery & Rollbacks
- Exception handling patterns and defect resolutions extracted from closed production bug issues:
- **Issue #1044** (2022-07-14): **无法读取到http Body的内容**
  *Symptoms*: 如题。验证代码： ```golang 	ctx := context.TODO() 	resp, err := core.NewRestInvoker().ContextDo(ctx, creq) 	if err != nil { 		log.Error("do request failed.") 		return nil, errs.FromErr(err) 	} 	defer resp.Body.Close() 	if resp.StatusCode != 200 { 		return nil, errs.News(fmt.Sprintf("request %s failed: %d:%v", url, resp.StatusCode, resp.Status)) 	} 	rbody := httputil.ReadBody(resp) ``` ```rbody := httputil.ReadBody(resp)```读取内容返回nil，因为Body被close掉了。  原因： client/rest/rest_client.go:95,  `func()`被执行，直接关闭了body。 代码如下： ```golang // If a request fails, we generate an error. func (c *Client) failure2Error(e error, r *http.Response, addr string) error { 	defer func() { 		if r == nil || r.Body == nil { 			return 		} 		r.Body.Close() 	}() 	if e != nil { 		return e 	} 	if c.opts.Failure == nil { 		return nil 	} 	if r == nil { 		return nil 	}  	codeStr := strconv.Itoa(r.StatusCode) 	// The Failure map defines whether or not a request fail. 	if c.opts.Failure["http_"+codeStr] { 		return fmt.Errorf("http error status [%d], server addr: [%s], will not print response body, to protect service sensitive data", r.StatusCode, addr) 	}  	return nil } ```  这段代码是新增的，不太明白目的，请检查。 ```golang 	defer func() { 		if r == nil || r.Body == nil { 			return 		} 		r.Body.Close() 	}() ```  
  **Post-Mortem & Fix Analysis**:
  > https://github.com/go-chassis/go-chassis/issues/1029  起因是服务网格功能，需要忠实的返回请求，而不是自动处理重定向
  > @chenwei113524 请看下为何要把response关闭？
  > 不应该关闭response，需要删除这段代码

- **Issue #1043** (2022-07-07): **go-chassis框架不支持多端口https的server，TLS证书只对一个端口生效，其他端口不生效**
  *Symptoms*: **Describe the bug** A clear and concise description of what the bug is.  **Version of go chassis**  **To Reproduce** Steps to reproduce the behavior:  **Logs** 
  **Post-Mortem & Fix Analysis**:
  > 比如你配置如下 ```yaml servicecomb:   protocols:     rest:       listenAddress: 0.0.0.0:5000     rest-admin:       listenAddress: 0.0.0.0:5001     grpc:       listenAddress: 0.0.0.0:6000 ssl:   rest.Provider.xxx: xxx   grpc.Provider.xxx: xxx ```  grpc和rest是可以正常接到tls配置的，因为他们使用了rest和grpc的字符串匹配去load TLS配置文件配置，这并不是bug，你需要多配置一条rest-admin的tls配置。理论上每个server都应该有自己独有的tls配置，而不该共享。正确的配置如下： ```yaml servicecomb:   protocols:     rest:       listenAddress: 0.0.0.0:5000     rest-admin:       listenAddress: 0.0.0.0:5001     grpc:       listenAddress: 0.0.0.0:6000 ssl:   rest.Provider.xxx: xxx   rest-admin.Provider.xxx: xxx //额外增加   grpc.Provider.xxx: xxx ``` 但是你可以进行一次体验提升，如果你希望复用一套tls，就是针对包含-的字符串，中间切完了，如果是2个字符串，取索引0内的字符串再load一次，即是默认tls配。你就不必配置2回重复的tls内容了
  > 好的，问题已解决

- **Issue #1039** (2022-06-20): **当NoRefreshSchema为true时，schema被覆盖**
  *Symptoms*: NoRefreshSchema=true的原意是自定义schema，但即便为true，也会被生成的schema所覆盖，导致不生效。  上述情况已修正： https://github.com/armersong/go-chassis.git 
  **Post-Mortem & Fix Analysis**:
  > 感谢，可以提个PR合入么
  > ok
  > 感谢贡献

- **Issue #1035** (2022-07-07): **关于v2.3.0版本中commit 注册实例时候默认不注册schema到service-center #999 (#1000)，建议文档补充介绍该开关**
  *Symptoms*: **Describe the bug** 1. 我们的产品在升级go-chassis版本时遇到问题，从v2.1.1升级至v2.3.0，升级后服务不注册schema。 经定位，是这次合入引进的开关导致默认没有完成该动作。 **个人认为这样的开关对新服务很不友好。这种应该是影响基本功能的开关，建议补充介绍文档并在版本更新日志与Get Started里描述一下。**  2. 另外，我认为这次MR引入的servicecomb.registry.uploadSchema这样的配置项，也应该在 \github.com\go-chassis\go-chassis\v2@v2.3.0\core\config\model\registry.go里的这个结构RegistryStruct中补充一下吧。  当然也可能是我个人的理解不足，欢迎讨论。  **Version of go chassis** 问题出现是v2.1.1升级至v2.3.0，分析是v2.3.0引入  **To Reproduce** 服务在v2.1.1正常工作，升级v2.3.0，没有对chassis.yaml做变动。 Steps to reproduce the behavior:  附相关链接： commit 注册实例时候默认不注册schema到service-center:  [https://github.com/go-chassis/go-chassis/commit/3cc32f870d8d624df4d5dbebd37e546da4c3890a](https://github.com/go-chassis/go-chassis/commit/3cc32f870d8d624df4d5dbebd37e546da4c3890a)  issue 注册实例时候默认不注册schema到service-center: [https://github.com/go-chassis/go-chassis/issues/999 ](https://github.com/go-chassis/go-chassis/issues/999 )
  **Post-Mortem & Fix Analysis**:
  > 感谢建议，这种确实属于breaking change，另外在RN中我们会标明本次的变化，后续我会改进成对有变化的地方做一个专门的breaking change章节，而不是improvements ![image](https://user-images.githubusercontent.com/1610890/173586845-632c455c-40a1-476c-8a7f-58a252b462dc.png) 
  > 欢迎加我的微信，深度交流tianxiaoliang2017
  > 感谢回复！其实我也是华为的开发。我们产品推动的版本火车引入v2.3.0,，然后遇到这个问题了。考虑后面其他产品升级时候如果不知道这里的话也会有问题，不如我自己先趟一遍水，提一下这个点。再次感谢大佬啦。方便的话可以加你微信吗？（申请大佬好友位0.0）

- **Issue #1029** (2022-04-28): **支持禁止Go客户端自动重定向**
  *Symptoms*: **Describe the bug** 背景：服务A通过mesher调用服务B,返回302，mesher对返回请求进行了自动重定向  **Version of go chassis**  **To Reproduce** Steps to reproduce the behavior:  **Logs** 

- **Issue #1023** (2022-03-10): ** handle l4 proxy err : lb: No available instance, key: dataaccess-mqtts.default.svc.cluster.local:1883()**
  *Symptoms*: **Describe the bug**  - edgemesh-gateway  ``` I0308 03:31:14.867253       1 log.go:184] ERROR: lb: No available instance, key: dataaccess-mqtts.default.svc.cluster.local:1883() E0308 03:31:14.867261       1 tcp.go:67] handle l4 proxy err : lb: No available instance, key: dataaccess-mqtts.default.svc.cluster.local:1883() I0308 03:31:14.867340       1 log.go:184] DEBUG: add [2] handlers for chain [tcp] I0308 03:31:14.867363       1 log.go:184] ERROR: lb: No available instance, key: dataaccess-mqtts.default.svc.cluster.local:1883() E0308 03:31:14.867370       1 tcp.go:67] handle l4 proxy err : lb: No available instance, key: dataaccess-mqtts.default.svc.cluster.local:1883() I0308 03:31:15.897310       1 log.go:184] DEBUG: add [2] handlers for chain [tcp] I0308 03:31:15.897411       1 log.go:184] ERROR: lb: No available instance, key: dataaccess-mqtts.default.svc.cluster.local:1883() E0308 03:31:15.897428       1 tcp.go:67] handle l4 proxy err : lb: No available instance, key: dataaccess-mqtts.default.svc.cluster.local:1883() I0308 03:31:15.897490       1 log.go:184] DEBUG: add [2] handlers for chain [tcp] I0308 03:31:15.897600       1 log.go:184] ERROR: lb: No available instance, key: dataaccess-mqtts.default.svc.cluster.local:1883() E0308 03:31:15.897615       1 tcp.go:67] handle l4 proxy err : lb: No available instance, key: dataaccess-mqtts.default.svc.cluster.local:1883() I0308 03:31:16.944899       1 log.go:184] DEBUG: add [2] handlers for chain [tcp] I0308
  **Post-Mortem & Fix Analysis**:
  > https://go-chassis.readthedocs.io/en/latest/user-guides/invoker.html  如果你需要去掉注册发现中心，直接使用原生k8s，看下Native Call这个章节

- **Issue #1020** (2022-01-22): **不同app（应用）之间的服务无法调用成**
  *Symptoms*: **Describe the bug** 在app为web的服务中调用app为chassis的服务接口 tag := map[string]string{"app": "chassis", "version": "1.0.2"} resp, err := core.NewRestInvoker().ContextDo(context.TODO(), req, core.WithRouteTags(tag))  不知道是不是哪里设置有问题，服务发现找不到web对应的服务实例，是不是服务依赖过滤掉了  目前修改是在 servicecenter.go 的 FindMicroServiceInstances 方法加上：  if appID != runtime.App{     consumerID = "" } 
  **Post-Mortem & Fix Analysis**:
  > 不同app其实应该走网关，我不建议直接走微服务的客户端负载均衡
  > 嗯 最好是不要这么用，只是在测试WithRouteTags这个方法的时候发现了这个问题

- **Issue #1015** (2021-12-20): **context deadline exceeded (Client.Timeout exceeded while awaiting headers)**
  *Symptoms*: **Describe the bug** 服务间调用，发现大约会30秒超时，但是没用找到这个超时的配置在哪  **Version of go chassis** -  gochassis 1.8.3   **Logs** >: context deadline exceeded (Client.Timeout exceeded while awaiting headers)  
  **Post-Mortem & Fix Analysis**:
  > 服务提供方 postman 可以请求到，单次调用耗时30多秒，但是代码里面的服务间的调用会超时 
  > 提供下详细的日志
  > ``` {"level":"[0;31mERROR[0m","timestamp":"2021-12-17 15:07:30.423 +08:00","file":"service/datahub.go:46","msg":"serviceName:datahub path:/xxx/xx params:{\"app\":\"\",\"cc_app_id\":0,\"svrIP\":\"xxx\"}, err:Post \"http://6.16.37.3:9090/xxx/xxx/xxx\": context deadline exceeded (Client.Timeout exceeded while awaiting headers)"} ``` @tianxiaoliang 只有这个日志 

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

### Incident Patch 1: `226457d1` (2024-03-02)
**Commit Message**: fix:update go-lint version

**File**: `.github/workflows/golangci-lint.yml` (modified, +1/-1)
```diff
@@ -15,5 +15,5 @@ jobs:
       - name: golangci-lint
         uses: golangci/golangci-lint-action@v2
         with:
-          version: v1.48.0
+          version: v1.55.2
           args: --skip-dirs=examples --skip-files=.*_test.go$ --disable=nilerr
```

**File**: `pkg/metrics/prometheus.go` (modified, +6/-5)
```diff
@@ -2,13 +2,14 @@ package metrics
 
 import (
 	"fmt"
-	"github.com/go-chassis/openlog"
-	"github.com/prometheus/client_golang/prometheus"
-	"github.com/prometheus/client_golang/prometheus/collectors"
 	"strings"
 	"sync"
 	"time"
 
+	"github.com/go-chassis/openlog"
+	"github.com/prometheus/client_golang/prometheus"
+	"github.com/prometheus/client_golang/prometheus/collectors"
+
 	dto "github.com/prometheus/client_model/go"
 )
 
@@ -297,7 +298,7 @@ func getValue(name string, labels map[string]string, getV func(m *dto.Metric) fl
 	}
 	matchAll := len(labels) == 0
 	var sum float64
-	for _, m := range f.Metric {
+	for _, m := range f.GetMetric() {
 		if !matchAll && !matchLabels(m, labels) {
 			continue
 		}
@@ -314,7 +315,7 @@ func getSummaryValue(name string, labels map[string]string, getV func(m *dto.Met
 	var count uint64
 	var sum float64
 	matchAll := len(labels) == 0
-	for _, m := range f.Metric {
+	for _, m := range f.GetMetric() {
 		if !matchAll && !matchLabels(m, labels) {
 			continue
 		}
```

---

### Incident Patch 2: `36d988e9` (2024-03-02)
**Commit Message**: fix:change the burst of limiter which used to limit the qps of urls that are mot matched

**File**: `middleware/ratelimiter/handler.go` (modified, +6/-4)
```diff
@@ -18,11 +18,13 @@
 package ratelimiter
 
 import (
+	"math"
+
+	"github.com/go-chassis/openlog"
+
 	"github.com/go-chassis/go-chassis/v2/core/handler"
 	"github.com/go-chassis/go-chassis/v2/core/invocation"
 	"github.com/go-chassis/go-chassis/v2/resilience/rate"
-	"github.com/go-chassis/openlog"
-	"math"
 )
 
 func init() {
@@ -37,11 +39,11 @@ type Handler struct{}
 
 // Handle limit request rate according to marker
 func (h *Handler) Handle(chain *handler.Chain, inv *invocation.Invocation, cb invocation.ResponseCallBack) {
-	if inv.GetMark() == "" { //if some user do not use invocation marker feature, then should skip rate limiter
+	if inv.GetMark() == "" { // if some user do not use invocation marker feature, then should skip rate limiter
 		chain.Next(inv, cb)
 		return
 	}
-	if rate.GetRateLimiters().TryAccept(inv.GetMark(), math.MaxInt32, 1) {
+	if rate.GetRateLimiters().TryAccept(inv.GetMark(), math.MaxInt32, math.MaxInt32) {
 		chain.Next(inv, cb)
 		return
 	}
```

---

### Incident Patch 3: `c2a10fa3` (2022-11-10)
**Commit Message**: Fix: put the claims in context after jwt handler (#1069)

**File**: `middleware/jwt/handler.go` (modified, +4/-0)
```diff
@@ -24,6 +24,7 @@ import (
 	"strings"
 
 	"github.com/emicklei/go-restful"
+	"github.com/go-chassis/cari/rbac"
 	"github.com/go-chassis/go-chassis/v2/core/handler"
 	"github.com/go-chassis/go-chassis/v2/core/invocation"
 	"github.com/go-chassis/go-chassis/v2/core/status"
@@ -76,6 +77,9 @@ func (h *Handler) Handle(chain *handler.Chain, i *invocation.Invocation, cb invo
 			handler.WriteBackErr(ErrNoHeader, status.Status(i.Protocol, status.Unauthorized), cb)
 			return
 		}
+		if i.Ctx != nil {
+			i.Ctx = rbac.NewContext(i.Ctx, payload)
+		}
 		if auth.Authorize != nil {
 			err = auth.Authorize(payload, req)
 			if err != nil {
```

---

### Incident Patch 4: `99133084` (2022-09-21)
**Commit Message**: bug: if no instances find, should set empty instance to cache (#1067)

* bug: if no instances find, should set empty instance to cache

* bug: if no instances find, should set empty instance to cache

**File**: `core/registry/servicecenter/cache.go` (modified, +18/-2)
```diff
@@ -230,7 +230,7 @@ func (c *CacheManager) pullMicroServiceInstance() error {
 		}
 	}
 	instances := RegroupInstances(services, response)
-	filter(instances)
+	filterAndCache(serviceNameSet, instances)
 
 	return nil
 }
@@ -276,9 +276,14 @@ func getServiceSet(exist []*scregistry.FindService) (sets.String, map[string]set
 
 // set app into instance metadata, split instances into ups and downs
 // set instance to cache by service name
-func filter(providerInstances map[string][]*registry.MicroServiceInstance) {
+func filterAndCache(services sets.String, providerInstances map[string][]*registry.MicroServiceInstance) {
 	//append instances from different app and same service name into one unified slice
 	downs := make(map[string]struct{})
+	if len(providerInstances) == 0 {
+		setEmptyCache(services)
+		return
+	}
+
 	for serviceName, instances := range providerInstances {
 		up := make([]*registry.MicroServiceInstance, 0)
 		for _, ins := range instances {
@@ -300,6 +305,17 @@ func filter(providerInstances map[string][]*registry.MicroServiceInstance) {
 
 }
 
+func setEmptyCache(services sets.String) {
+	for service := range services {
+		_, ok := registry.MicroserviceInstanceIndex.Get(service, nil)
+		if !ok {
+			openlog.Warn(fmt.Sprintf("set [%s] cache to avoid frequent call to service center", service))
+			registry.MicroserviceInstanceIndex.Set(service, make([]*registry.MicroServiceInstance, 0))
+		}
+
+	}
+}
+
 // watch watching micro-service instance status
 func watch(response *sc.MicroServiceInstanceChangedEvent) {
 	if response.Instance.Status != sc.MSInstanceUP {
```

**File**: `core/registry/servicecenter/cache_test.go` (modified, +24/-15)
```diff
@@ -21,7 +21,7 @@ import (
 
 func init() {
 	lager.Init(&lager.Options{
-		LoggerLevel: "INFO",
+		LoggerLevel: "DEBUG",
 	})
 	archaius.Init(archaius.WithMemorySource())
 	archaius.Set("servicecomb.registry.address", "http://127.0.0.1:30100")
@@ -62,21 +62,30 @@ func TestCacheManager_AutoSync(t *testing.T) {
 	assert.Equal(t, "event1", instanceID)
 	time.Sleep(time.Second * 1)
 	tags := utiltags.NewDefaultTag("0.1", "default")
-	instances, err := registry.DefaultServiceDiscoveryService.FindMicroServiceInstances(sid, "Server", tags)
-	assert.NotZero(t, len(instances))
-	assert.NoError(t, err)
-	var ok = false
-	for _, ins := range instances {
-		t.Log(ins.InstanceID)
-		if ins.InstanceID == "event1" {
-			ok = true
-			break
-		}
-	}
-	assert.True(t, ok)
-	t.Log("新增实例感知成功")
-	t.Log("测试EVT_CREATE操作")
 
+	t.Run("find instances, should has response", func(t *testing.T) {
+		instances, err := registry.DefaultServiceDiscoveryService.FindMicroServiceInstances(sid, "Server", tags)
+		assert.NotZero(t, len(instances))
+		assert.NoError(t, err)
+		var ok = false
+		for _, ins := range instances {
+			t.Log(ins.InstanceID)
+			if ins.InstanceID == "event1" {
+				ok = true
+				break
+			}
+		}
+		assert.True(t, ok)
+	})
+	t.Run("find instances with service do not exists in service center", func(t *testing.T) {
+		instances, err := registry.DefaultServiceDiscoveryService.FindMicroServiceInstances(sid, "NotExistServer", tags)
+		assert.NoError(t, err)
+		assert.Equal(t, 0, len(instances))
+
+		instances2, err2 := registry.DefaultServiceDiscoveryService.FindMicroServiceInstances(sid, "NotExistServer", tags)
+		assert.NoError(t, err2)
+		assert.Equal(t, 0, len(instances2))
+	})
 	var exist = false
 	pro := make(map[string]string)
 	pro["attr1"] = "b"
```

**File**: `core/registry/servicecenter/servicecenter.go` (modified, +2/-1)
```diff
@@ -4,6 +4,7 @@ import (
 	"fmt"
 	scregistry "github.com/go-chassis/cari/discovery"
 	"github.com/go-chassis/sc-client"
+	"k8s.io/apimachinery/pkg/util/sets"
 
 	"github.com/go-chassis/go-chassis/v2/core/registry"
 	"github.com/go-chassis/go-chassis/v2/pkg/runtime"
@@ -263,7 +264,7 @@ func (r *ServiceDiscovery) FindMicroServiceInstances(consumerID, microServiceNam
 			return nil, fmt.Errorf("FindMicroServiceInstances failed, ProviderID: %s, err: %w", microServiceName, err)
 		}
 		providerInstances := RegroupInstances(criteria, providerInstancesResponse)
-		filter(providerInstances)
+		filterAndCache(sets.NewString(microServiceName), providerInstances)
 		microServiceInstance, boo = registry.MicroserviceInstanceIndex.Get(microServiceName, tags.KV)
 		if !boo || microServiceInstance == nil {
 			openlog.Debug(fmt.Sprintf("Find no micro service instances for %s from cache", microServiceName))
```

---

### Incident Patch 5: `b0c25da4` (2022-08-30)
**Commit Message**: fix some typos (#1066)

Signed-off-by: cui fliter <[REDACTED_EMAIL]>

Signed-off-by: cui fliter <[REDACTED_EMAIL]>

**File**: `README.md` (modified, +1/-1)
```diff
@@ -11,7 +11,7 @@
 
 Go-Chassis is a microservice framework for rapid development of microservices in Go.
 it focus on helping developer to deliver cloud native application more easily. 
-The idea of logo is, developer can recreate and customize their own "wheel"(a framework) by go chassis to accelarate the delivery of software.
+The idea of logo is, developer can recreate and customize their own "wheel"(a framework) by go chassis to accelerate the delivery of software.
 
 ### Why use Go chassis
 - powerful middleware "handler chain": 
```

**File**: `client/rest/rest_client.go` (modified, +1/-1)
```diff
@@ -53,7 +53,7 @@ func (c *Client) Status(rsp interface{}) (status int, err error) {
 	if resp, ok := rsp.(*http.Response); ok {
 		return resp.StatusCode, nil
 	}
-	return 0, fmt.Errorf("imcompatible type: %s", reflect.TypeOf(rsp))
+	return 0, fmt.Errorf("incompatible type: %s", reflect.TypeOf(rsp))
 }
 
 // NewRestClient is a function
```

---

### Incident Patch 6: `d2b453c4` (2022-08-23)
**Commit Message**: bug: fix nil panic (#1064)

**File**: `core/server/options.go` (modified, +6/-1)
```diff
@@ -74,6 +74,11 @@ type RunOption func(*RunOptions)
 // WithServerMask you can specify do not start a protocol server
 func WithServerMask(serverNames ...string) RunOption {
 	return func(o *RunOptions) {
-		o.serverMasks.Insert(serverNames...)
+		if o.serverMasks == nil {
+			o.serverMasks = sets.NewString(serverNames...)
+		} else {
+			o.serverMasks.Insert(serverNames...)
+		}
+
 	}
 }
```

**File**: `core/server/server_test.go` (modified, +1/-1)
```diff
@@ -68,7 +68,7 @@ func TestSrcMgr(t *testing.T) {
 	assert.NotNil(t, srv)
 	err := server.UnRegistrySelfInstances()
 	assert.NoError(t, err)
-	err = server.StartServer()
+	err = server.StartServer(server.WithServerMask("fake"))
 	assert.NoError(t, err)
 
 	sr, err := server.GetServer("rest")
```

---

### Incident Patch 7: `c951cd0a` (2022-03-29)
**Commit Message**: fix test: exec Unsetenv after test complete (#1026)

**File**: `bootstrap/bootstrap_test.go` (modified, +5/-2)
```diff
@@ -21,8 +21,11 @@ type bootstrapPlugin struct {
 	Name string
 }
 
-func initialize() {
+func initialize(t *testing.T) {
 	os.Setenv("CHASSIS_HOME", "/tmp/")
+	t.Cleanup(func() {
+		os.Unsetenv("CHASSIS_HOME")
+	})
 	chassisConf := filepath.Join("/tmp/", "conf")
 	os.MkdirAll(chassisConf, 0700)
 	os.Create(filepath.Join(chassisConf, "chassis.yaml"))
@@ -35,7 +38,7 @@ func (b *bootstrapPlugin) Init() error {
 }
 
 func TestBootstrap(t *testing.T) {
-	initialize()
+	initialize(t)
 	config.Init()
 	time.Sleep(1 * time.Second)
 	config.GlobalDefinition = &model.GlobalCfg{}
```

**File**: `chassis_api_test.go` (modified, +6/-3)
```diff
@@ -12,9 +12,10 @@ import (
 	"github.com/go-chassis/go-chassis/v2/core/server"
 	"github.com/go-chassis/go-chassis/v2/pkg/util/fileutil"
 
+	"syscall"
+
 	"github.com/go-chassis/go-chassis/v2/core/config/model"
 	"github.com/stretchr/testify/assert"
-	"syscall"
 )
 
 const (
@@ -26,9 +27,10 @@ func TestInit(t *testing.T) {
 	defer syscall.Umask(mask)
 	t.Log("Testing Chassis Init function")
 	os.Setenv("CHASSIS_HOME", filepath.Join(os.Getenv("GOPATH"), "test", "chassisInit"))
+	defer os.Unsetenv("CHASSIS_HOME")
 	err := os.MkdirAll(fileutil.GetConfDir(), 0700)
 	assert.NoError(t, err)
-	globalDefFile, err := os.OpenFile(fileutil.GlobalConfigPath(), os.O_CREATE|os.O_RDWR|os.O_TRUNC, 0700)
+	globalDefFile, _ := os.OpenFile(fileutil.GlobalConfigPath(), os.O_CREATE|os.O_RDWR|os.O_TRUNC, 0700)
 	defer globalDefFile.Close()
 
 	// write some text line-by-line to file
@@ -85,7 +87,7 @@ ssl:
 	msDefFile, err := os.OpenFile(fileutil.MicroServiceConfigPath(), os.O_CREATE|os.O_RDWR|os.O_TRUNC, 0700)
 	assert.NoError(t, err)
 	defer msDefFile.Close()
-	_, err = msDefFile.WriteString(`---
+	msDefFile.WriteString(`---
 #微服务的私有属性
 servicecomb:
   service:
@@ -145,6 +147,7 @@ func TestInitError(t *testing.T) {
 	t.Log("Testing chassis Init function for errors")
 	p := filepath.Join(os.Getenv("GOPATH"), "src", "github.com", "go-chassis", "go-chassis", "examples", "communication/client")
 	os.Setenv("CHASSIS_HOME", p)
+	defer os.Unsetenv("CHASSIS_HOME")
 
 	lager.Init(&lager.Options{
 		LoggerLevel: "INFO",
```

**File**: `control/servicecomb/panel_test.go` (modified, +7/-2)
```diff
@@ -1,6 +1,9 @@
 package servicecomb_test
 
 import (
+	"os"
+	"testing"
+
 	"github.com/go-chassis/go-archaius"
 	"github.com/go-chassis/go-chassis/v2/control"
 	_ "github.com/go-chassis/go-chassis/v2/control/servicecomb"
@@ -11,8 +14,6 @@ import (
 	"github.com/go-chassis/go-chassis/v2/core/loadbalancer"
 	_ "github.com/go-chassis/go-chassis/v2/initiator"
 	"github.com/stretchr/testify/assert"
-	"os"
-	"testing"
 )
 
 func init() {
@@ -123,6 +124,7 @@ func TestPanel_GetLoadBalancing(t *testing.T) {
 func BenchmarkPanel_GetLoadBalancing(b *testing.B) {
 	gopath := os.Getenv("GOPATH")
 	os.Setenv("CHASSIS_HOME", gopath+"/src/github.com/go-chassis/go-chassis/v2/examples/discovery/client/")
+	defer os.Unsetenv("CHASSIS_HOME")
 	config.Init()
 	config.GlobalDefinition.Panel.Infra = "archaius"
 	opts := control.Options{
@@ -141,6 +143,7 @@ func BenchmarkPanel_GetLoadBalancing(b *testing.B) {
 func BenchmarkPanel_GetLoadBalancing2(b *testing.B) {
 	gopath := os.Getenv("GOPATH")
 	os.Setenv("CHASSIS_HOME", gopath+"/src/github.com/go-chassis/go-chassis/v2/examples/discovery/client/")
+	defer os.Unsetenv("CHASSIS_HOME")
 	config.Init()
 	config.GlobalDefinition.Panel.Infra = "archaius"
 	opts := control.Options{
@@ -161,6 +164,7 @@ func BenchmarkPanel_GetLoadBalancing2(b *testing.B) {
 func BenchmarkPanel_GetCircuitBreaker(b *testing.B) {
 	gopath := os.Getenv("GOPATH")
 	os.Setenv("CHASSIS_HOME", gopath+"/src/github.com/go-chassis/go-chassis/v2/examples/discovery/client/")
+	defer os.Unsetenv("CHASSIS_HOME")
 	config.Init()
 	config.GlobalDefinition.Panel.Infra = "archaius"
 	opts := control.Options{
@@ -181,6 +185,7 @@ func BenchmarkPanel_GetCircuitBreaker(b *testing.B) {
 func BenchmarkPanel_GetRateLimiting(b *testing.B) {
 	gopath := os.Getenv("GOPATH")
 	os.Setenv("CHASSIS_HOME", gopath+"/src/github.com/go-chassis/go-chassis/v2/examples/discovery/client/")
+	defer os.Unsetenv("CHASSIS_HOME")
 	config.Init()
 	config.GlobalDefinition.Panel.Infra = "archaius"
 	opts := control.Options{
```

**File**: `core/config/cb_config_test.go` (modified, +5/-3)
```diff
@@ -6,13 +6,14 @@ import (
 
 	_ "github.com/go-chassis/go-chassis/v2/initiator"
 
+	"io"
+	"path/filepath"
+	"time"
+
 	"github.com/go-chassis/go-chassis/v2/core/common"
 	"github.com/go-chassis/go-chassis/v2/core/config"
 	"github.com/go-chassis/go-chassis/v2/pkg/util/fileutil"
 	"github.com/stretchr/testify/assert"
-	"io"
-	"path/filepath"
-	"time"
 )
 
 func TestCBInit(t *testing.T) {
@@ -106,6 +107,7 @@ servicecomb:
 	assert.NoError(t, err)
 
 	os.Setenv(fileutil.ChassisConfDir, d)
+	defer os.Unsetenv(fileutil.ChassisConfDir)
 	err = config.Init()
 	assert.NoError(t, err)
 
```

**File**: `core/config/cd_config_test.go` (modified, +5/-2)
```diff
@@ -8,11 +8,12 @@ import (
 
 	"github.com/go-chassis/go-chassis/v2/core/config"
 
-	"github.com/go-chassis/go-chassis/v2/pkg/util/fileutil"
-	"github.com/stretchr/testify/assert"
 	"io"
 	"path/filepath"
 	"time"
+
+	"github.com/go-chassis/go-chassis/v2/pkg/util/fileutil"
+	"github.com/stretchr/testify/assert"
 )
 
 func TestCDInit(t *testing.T) {
@@ -52,6 +53,7 @@ servicecomb:
 	assert.NoError(t, err)
 
 	os.Setenv(fileutil.ChassisConfDir, d)
+	defer os.Unsetenv(fileutil.ChassisConfDir)
 	err = config.Init()
 	assert.NoError(t, err)
 
@@ -89,6 +91,7 @@ servicecomb:
 		defer f1.Close()
 
 		os.Setenv(fileutil.ChassisConfDir, d)
+		defer os.Unsetenv(fileutil.ChassisConfDir)
 		time.Sleep(1 * time.Second)
 		config.ReadGlobalConfigFromArchaius()
 		check := config.GetContractDiscoveryType()
```

**File**: `core/config/config_test.go` (modified, +9/-4)
```diff
@@ -3,16 +3,17 @@ package config_test
 import (
 	"testing"
 
+	"io"
+	"os"
+	"path/filepath"
+	"time"
+
 	"github.com/go-chassis/go-chassis/v2/core/config"
 	"github.com/go-chassis/go-chassis/v2/core/config/model"
 	"github.com/go-chassis/go-chassis/v2/core/loadbalancer"
 	"github.com/go-chassis/go-chassis/v2/pkg/util/fileutil"
 	"github.com/stretchr/testify/assert"
 	"gopkg.in/yaml.v2"
-	"io"
-	"os"
-	"path/filepath"
-	"time"
 )
 
 func TestInit1(t *testing.T) {
@@ -63,6 +64,7 @@ servicecomb:
 	assert.NoError(t, err)
 
 	os.Setenv(fileutil.ChassisConfDir, d)
+	defer os.Unsetenv(fileutil.ChassisConfDir)
 	err = config.Init()
 	assert.NoError(t, err)
 	time.Sleep(1 * time.Second)
@@ -182,7 +184,10 @@ cse:
 
 func TestInitErrorWithBlankEnv(t *testing.T) {
 	os.Setenv("CHASSIS_HOME", "")
+	defer os.Unsetenv("CHASSIS_HOME")
 	os.Setenv("CHASSIS_CONF_DIR", "")
+	defer os.Unsetenv("CHASSIS_CONF_DIR")
+
 	err := config.Init()
 	t.Log(err)
 	assert.Error(t, err)
```

**File**: `core/config/schema/loader_test.go` (modified, +6/-3)
```diff
@@ -1,14 +1,15 @@
 package schema
 
 import (
+	"os"
+	"path/filepath"
+	"testing"
+
 	"github.com/emicklei/go-restful"
 	"github.com/go-chassis/go-chassis/v2/pkg/runtime"
 	"github.com/go-chassis/go-chassis/v2/pkg/util/fileutil"
 	swagger "github.com/go-chassis/go-restful-swagger20"
 	"github.com/stretchr/testify/assert"
-	"os"
-	"path/filepath"
-	"testing"
 )
 
 func TestLoadSchema(t *testing.T) {
@@ -27,6 +28,7 @@ func TestLoadSchema(t *testing.T) {
 
 	//Fix the root directory otherwise the Schema dir will be created inside /tmp/go-buildXXX///
 	os.Setenv("CHASSIS_HOME", os.Getenv("GOPATH"))
+	defer os.Unsetenv("CHASSIS_HOME")
 
 	schemaDirOfMs1 := fileutil.SchemaDir(microserviceName1)
 
@@ -66,6 +68,7 @@ func TestLoadSchema(t *testing.T) {
 func TestSetSchemaIDs(t *testing.T) {
 	p := os.Getenv("GOPATH")
 	os.Setenv("CHASSIS_HOME", filepath.Join(p, "src", "github.com", "go-chassis", "go-chassis", "examples", "discovery", "server"))
+	defer os.Unsetenv("CHASSIS_HOME")
 	config := swagger.Config{
 		WebServices: restful.DefaultContainer.RegisteredWebServices(),
 		OpenService: true,
```

**File**: `core/handler/handler_chain_test.go` (modified, +6/-4)
```diff
@@ -1,17 +1,18 @@
 package handler_test
 
 import (
+	"log"
+	"os"
+	"path/filepath"
+	"testing"
+
 	"github.com/go-chassis/go-chassis/v2/core/common"
 	"github.com/go-chassis/go-chassis/v2/core/config"
 	"github.com/go-chassis/go-chassis/v2/core/config/model"
 	"github.com/go-chassis/go-chassis/v2/core/handler"
 	"github.com/go-chassis/go-chassis/v2/core/invocation"
 	"github.com/go-chassis/go-chassis/v2/core/lager"
 	"github.com/stretchr/testify/assert"
-	"log"
-	"os"
-	"path/filepath"
-	"testing"
 )
 
 func init() {
@@ -49,6 +50,7 @@ func TestCreateChain(t *testing.T) {
 func BenchmarkChain_Next(b *testing.B) {
 	path := os.Getenv("GOPATH")
 	os.Setenv("CHASSIS_HOME", filepath.Join(path, "src", "github.com", "go-chassis", "go-chassis", "examples", "discovery", "client"))
+	defer os.Unsetenv("CHASSIS_HOME")
 	config.GlobalDefinition = &model.GlobalCfg{}
 	config.Init()
 	iv := &invocation.Invocation{}
```

---

### Incident Patch 8: `a2ba0980` (2022-03-28)
**Commit Message**: fix test: clean log dir after test complete. (#1025)

**File**: `core/lager/lager_test.go` (modified, +9/-7)
```diff
@@ -1,21 +1,23 @@
 package lager_test
 
 import (
-	"github.com/go-chassis/go-chassis/v2/core/lager"
-	"github.com/go-chassis/openlog"
 	"os"
 	"path/filepath"
 	"testing"
 	"time"
+
+	"github.com/go-chassis/go-chassis/v2/core/lager"
+	"github.com/go-chassis/openlog"
 )
 
 func TestInitialize1(t *testing.T) {
+	logDir := t.TempDir()
 	lager.Init(&lager.Options{
-		LoggerFile: filepath.Join("./log", "chassis.log"),
+		LoggerFile: filepath.Join(logDir, "chassis.log"),
 		Writers:    "file",
 	})
 
-	if _, err := os.Stat("log"); err != nil {
+	if _, err := os.Stat(logDir); err != nil {
 		if os.IsNotExist(err) {
 			t.Error(err)
 		}
@@ -26,9 +28,9 @@ func TestInitialize1(t *testing.T) {
 }
 
 func TestInitialize2(t *testing.T) {
-	path := os.Getenv("GOPATH")
-	logDir := filepath.Join(path, "src", "github.com", "go-chassis", "go-chassis", "examples", "discovery", "server")
-	os.Setenv("CHASSIS_HOME", logDir)
+	homeDir := t.TempDir()
+	os.Setenv("CHASSIS_HOME", homeDir)
+	logDir := filepath.Join(homeDir, "log")
 
 	//initializing config for to initialize PassLagerDefinition variable
 	t.Log("initializing config for to initialize PassLagerDefinition variable")
```

---

### Incident Patch 9: `f9f7c9de` (2022-03-26)
**Commit Message**: fix spell error:reslut (#1024)

**File**: `examples/schemas/restful_hello.go` (modified, +8/-8)
```diff
@@ -46,16 +46,16 @@ func (r *RestFulHello) Sayhi(b *rf.Context) {
 
 // SayJSON is a method used to reply user hello in json format
 func (r *RestFulHello) SayJSON(b *rf.Context) {
-	reslut := struct {
+	result := struct {
 		Name string
 	}{}
-	err := b.ReadEntity(&reslut)
+	err := b.ReadEntity(&result)
 	if err != nil {
-		b.WriteHeaderAndJSON(http.StatusInternalServerError, reslut, "application/json")
+		b.WriteHeaderAndJSON(http.StatusInternalServerError, result, "application/json")
 		return
 	}
-	reslut.Name = "hello " + reslut.Name
-	b.WriteJSON(reslut, "application/json")
+	result.Name = "hello " + result.Name
+	b.WriteJSON(result, "application/json")
 	return
 }
 
@@ -93,15 +93,15 @@ func (r *RestFulMessage) Saymessage(b *rf.Context) {
 
 //Sayhi is a method used to reply request user with hello world text
 func (r *RestFulMessage) Sayhi(b *rf.Context) {
-	reslut := struct {
+	result := struct {
 		Name string
 	}{}
-	err := b.ReadEntity(&reslut)
+	err := b.ReadEntity(&result)
 	if err != nil {
 		b.Write([]byte(err.Error() + ":hello world"))
 		return
 	}
-	b.Write([]byte(reslut.Name + ":hello world"))
+	b.Write([]byte(result.Name + ":hello world"))
 	return
 }
 
```

**File**: `examples/schemas/restful_router_V1.go` (modified, +4/-4)
```diff
@@ -36,18 +36,18 @@ func (r *RestFulRouterA) Equal(context *restful.Context) {
 
 // Say is method to reply version A say some info
 func (r *RestFulRouterA) Say(context *restful.Context) {
-	reslut := struct {
+	result := struct {
 		Name string
 		Addr string
 		Age  int
 	}{}
-	err := context.ReadEntity(&reslut)
+	err := context.ReadEntity(&result)
 	if err != nil {
 		context.Write([]byte(err.Error()))
 		return
 	}
-	context.Write([]byte("version V1 : " + reslut.Name + " say : he is " +
-		strconv.Itoa(reslut.Age) + " years ago ,live in " + reslut.Addr))
+	context.Write([]byte("version V1 : " + result.Name + " say : he is " +
+		strconv.Itoa(result.Age) + " years ago ,live in " + result.Addr))
 }
 
 // Operation is method to add two num sum
```

**File**: `examples/schemas/restful_router_V2.go` (modified, +6/-6)
```diff
@@ -37,22 +37,22 @@ func (r *RestFulRouterB) Equal(context *restful.Context) {
 
 // Say is method to reply version B say some info
 func (r *RestFulRouterB) Say(context *restful.Context) {
-	reslut := struct {
+	result := struct {
 		Name  string
 		Addr  string
 		Age   int
 		Phone string
 	}{}
-	err := context.ReadEntity(&reslut)
+	err := context.ReadEntity(&result)
 	if err != nil {
 		context.Write([]byte(err.Error()))
 		return
 	}
-	if reslut.Phone == "" {
-		reslut.Phone = "13800138000"
+	if result.Phone == "" {
+		result.Phone = "13800138000"
 	}
-	context.Write([]byte("version V2 : " + reslut.Name + " say : he is " + strconv.Itoa(reslut.Age) +
-		" years ago , live in " + reslut.Addr + " ,phone is " + reslut.Phone))
+	context.Write([]byte("version V2 : " + result.Name + " say : he is " + strconv.Itoa(result.Age) +
+		" years ago , live in " + result.Addr + " ,phone is " + result.Phone))
 }
 
 // Operation is method to calculate  two num product
```

---

### Incident Patch 10: `0a97efcf` (2021-11-22)
**Commit Message**: bugfix: Parse services from config failed: input must be an ptr (#1012)

**File**: `control/panel_test.go` (modified, +2/-2)
```diff
@@ -40,8 +40,8 @@ func TestInit(t *testing.T) {
 
 func TestNewCircuitCmd(t *testing.T) {
 	config.HystrixConfig = &model.HystrixConfigWrapper{
-		HystrixConfig: model.HystrixConfig{
-			CircuitBreakerProperties: model.CircuitWrapper{
+		HystrixConfig: &model.HystrixConfig{
+			CircuitBreakerProperties: &model.CircuitWrapper{
 				Scope: "",
 			},
 		},
```

**File**: `control/servicecomb/panel_test.go` (modified, +13/-13)
```diff
@@ -17,37 +17,37 @@ import (
 
 func init() {
 	config.HystrixConfig = &model.HystrixConfigWrapper{
-		HystrixConfig: model.HystrixConfig{
-			FallbackPolicyProperties: model.FallbackPolicyWrapper{
-				Consumer: model.FallbackPolicySpec{
+		HystrixConfig: &model.HystrixConfig{
+			FallbackPolicyProperties: &model.FallbackPolicyWrapper{
+				Consumer: &model.FallbackPolicySpec{
 					AnyService: map[string]model.FallbackPolicyPropertyStruct{},
 				},
-				Provider: model.FallbackPolicySpec{
+				Provider: &model.FallbackPolicySpec{
 					AnyService: map[string]model.FallbackPolicyPropertyStruct{},
 				},
 			},
-			FallbackProperties: model.FallbackWrapper{
-				Consumer: model.FallbackSpec{
+			FallbackProperties: &model.FallbackWrapper{
+				Consumer: &model.FallbackSpec{
 					AnyService: map[string]model.FallbackPropertyStruct{},
 				},
-				Provider: model.FallbackSpec{
+				Provider: &model.FallbackSpec{
 					AnyService: map[string]model.FallbackPropertyStruct{},
 				},
 			},
-			IsolationProperties: model.IsolationWrapper{
-				Consumer: model.IsolationSpec{
+			IsolationProperties: &model.IsolationWrapper{
+				Consumer: &model.IsolationSpec{
 					AnyService:            map[string]model.IsolationSpec{},
 					MaxConcurrentRequests: 100,
 				},
-				Provider: model.IsolationSpec{
+				Provider: &model.IsolationSpec{
 					AnyService: map[string]model.IsolationSpec{},
 				},
 			},
-			CircuitBreakerProperties: model.CircuitWrapper{
-				Consumer: model.CircuitBreakerSpec{
+			CircuitBreakerProperties: &model.CircuitWrapper{
+				Consumer: &model.CircuitBreakerSpec{
 					AnyService: map[string]model.CircuitBreakPropertyStruct{},
 				},
-				Provider: model.CircuitBreakerSpec{
+				Provider: &model.CircuitBreakerSpec{
 					AnyService: map[string]model.CircuitBreakPropertyStruct{},
 				},
 			},
```

**File**: `core/client/client_manager.go` (modified, +1/-1)
```diff
@@ -139,7 +139,7 @@ func Close(protocol, service, endpoint string) error {
 }
 
 // SetTimeoutToClientCache set timeout to client
-func SetTimeoutToClientCache(spec model.IsolationWrapper) {
+func SetTimeoutToClientCache(spec *model.IsolationWrapper) {
 	sl.Lock()
 	defer sl.Unlock()
 	for _, client := range clients {
```

**File**: `core/client/client_manager_test.go` (modified, +5/-5)
```diff
@@ -22,9 +22,9 @@ func init() {
 		LoggerLevel: "INFO",
 	})
 	config.HystrixConfig = &model.HystrixConfigWrapper{
-		HystrixConfig: model.HystrixConfig{
-			IsolationProperties: model.IsolationWrapper{
-				Consumer: model.IsolationSpec{},
+		HystrixConfig: &model.HystrixConfig{
+			IsolationProperties: &model.IsolationWrapper{
+				Consumer: &model.IsolationSpec{},
 			},
 		},
 	}
@@ -179,8 +179,8 @@ func TestSetTimeoutToClientCache(t *testing.T) {
 	assert.NotEmpty(t, c)
 	assert.Nil(t, err)
 
-	spec := model.IsolationWrapper{
-		Consumer: model.IsolationSpec{
+	spec := &model.IsolationWrapper{
+		Consumer: &model.IsolationSpec{
 			TimeoutInMilliseconds: config.DefaultTimeout,
 		},
 	}
```

**File**: `core/config/cb_config.go` (modified, +4/-4)
```diff
@@ -150,28 +150,28 @@ func GetPolicy(service, t string) string {
 	return policy
 }
 
-func getIsolationSpec(command string) model.IsolationSpec {
+func getIsolationSpec(command string) *model.IsolationSpec {
 	if command == common.Consumer {
 		return GetHystrixConfig().IsolationProperties.Consumer
 	}
 	return GetHystrixConfig().IsolationProperties.Provider
 }
 
-func getCircuitBreakerSpec(command string) model.CircuitBreakerSpec {
+func getCircuitBreakerSpec(command string) *model.CircuitBreakerSpec {
 	if command == common.Consumer {
 		return GetHystrixConfig().CircuitBreakerProperties.Consumer
 	}
 	return GetHystrixConfig().CircuitBreakerProperties.Provider
 }
 
-func getFallbackSpec(command string) model.FallbackSpec {
+func getFallbackSpec(command string) *model.FallbackSpec {
 	if command == common.Consumer {
 		return GetHystrixConfig().FallbackProperties.Consumer
 	}
 	return GetHystrixConfig().FallbackProperties.Provider
 }
 
-func getFallbackPolicySpec(command string) model.FallbackPolicySpec {
+func getFallbackPolicySpec(command string) *model.FallbackPolicySpec {
 	if command == common.Consumer {
 		return GetHystrixConfig().FallbackPolicyProperties.Consumer
 	}
```

**File**: `core/config/config.go` (modified, +4/-3)
```diff
@@ -180,11 +180,12 @@ func ReadMonitorFromArchaius() error {
 
 // ReadHystrixFromArchaius is unmarshal hystrix configuration file(circuit_breaker.yaml)
 func ReadHystrixFromArchaius() error {
-	HystrixConfig = &model.HystrixConfigWrapper{}
-	err := archaius.UnmarshalConfig(&HystrixConfig)
+	hystrixCnf := model.HystrixConfigWrapper{}
+	err := archaius.UnmarshalConfig(&hystrixCnf)
 	if err != nil {
 		return err
 	}
+	HystrixConfig = &hystrixCnf
 	return nil
 }
 
@@ -199,7 +200,7 @@ func GetLoadBalancing() *model.LoadBalancing {
 //GetHystrixConfig return cb config
 func GetHystrixConfig() *model.HystrixConfig {
 	if HystrixConfig != nil {
-		return &HystrixConfig.HystrixConfig
+		return HystrixConfig.HystrixConfig
 	}
 	return nil
 }
```

**File**: `core/config/model/circuit_breaker.go` (modified, +14/-14)
```diff
@@ -6,40 +6,40 @@ import (
 
 // HystrixConfigWrapper hystrix configuration wrapper structure
 type HystrixConfigWrapper struct {
-	HystrixConfig HystrixConfig `yaml:"cse"`
+	HystrixConfig *HystrixConfig `yaml:"cse"`
 }
 
 // HystrixConfig is hystrix configuration structure
 type HystrixConfig struct {
-	IsolationProperties      IsolationWrapper      `yaml:"isolation"`
-	CircuitBreakerProperties CircuitWrapper        `yaml:"circuitBreaker"`
-	FallbackProperties       FallbackWrapper       `yaml:"fallback"`
-	FallbackPolicyProperties FallbackPolicyWrapper `yaml:"fallbackpolicy"`
+	IsolationProperties      *IsolationWrapper      `yaml:"isolation"`
+	CircuitBreakerProperties *CircuitWrapper        `yaml:"circuitBreaker"`
+	FallbackProperties       *FallbackWrapper       `yaml:"fallback"`
+	FallbackPolicyProperties *FallbackPolicyWrapper `yaml:"fallbackpolicy"`
 }
 
 // IsolationWrapper isolation wrapper structure
 type IsolationWrapper struct {
-	Consumer IsolationSpec `yaml:"Consumer"`
-	Provider IsolationSpec `yaml:"Provider"`
+	Consumer *IsolationSpec `yaml:"Consumer"`
+	Provider *IsolationSpec `yaml:"Provider"`
 }
 
 // CircuitWrapper circuit wrapper structure
 type CircuitWrapper struct {
-	Scope    string             `yaml:"scope"`
-	Consumer CircuitBreakerSpec `yaml:"Consumer"`
-	Provider CircuitBreakerSpec `yaml:"Provider"`
+	Scope    string              `yaml:"scope"`
+	Consumer *CircuitBreakerSpec `yaml:"Consumer"`
+	Provider *CircuitBreakerSpec `yaml:"Provider"`
 }
 
 // FallbackWrapper fallback wrapper structure
 type FallbackWrapper struct {
-	Consumer FallbackSpec `yaml:"Consumer"`
-	Provider FallbackSpec `yaml:"Provider"`
+	Consumer *FallbackSpec `yaml:"Consumer"`
+	Provider *FallbackSpec `yaml:"Provider"`
 }
 
 // FallbackPolicyWrapper fallback policy wrapper
 type FallbackPolicyWrapper struct {
-	Consumer FallbackPolicySpec `yaml:"Consumer"`
-	Provider FallbackPolicySpec `yaml:"Provider"`
+	Consumer *FallbackPolicySpec `yaml:"Consumer"`
+	Provider *FallbackPolicySpec `yaml:"Provider"`
 }
 
 // IsolationSpec isolation speciafications
```

---

### Incident Patch 11: `f05dd479` (2021-08-31)
**Commit Message**: rename metrics name to have an unified prefix to distinguish from other system metrics (#1003)

**File**: `docs/middleware/access-log.md` (modified, +5/-0)
```diff
@@ -29,3 +29,8 @@ accessLogFile: xxx
 // should import after import go-chassis
 	_ "github.com/go-chassis/go-chassis/v2/middleware/accesslog"
 ```
+
+4.verify
+```shell
+2021-08-30 10:02:56.684 +08:00 INFO accesslog/access_log.go:90 POST /v1/default/kie/kv from 127.0.0.1 409 5ms
+```
\ No newline at end of file
```

**File**: `docs/middleware/monitoring.md` (modified, +11/-10)
```diff
@@ -9,6 +9,7 @@ it records 3 different metrics:
 - request_process_duration
 - error_response_count
 
+all the metrics name starts with "scb_", it stands for servicecomb system
 ## **Usage**
 
 
@@ -31,16 +32,16 @@ import _ github.com/go-chassis/go-chassis/v2/middleware/monitoring
 
 metrics API response looks like below：
 ```text
-# HELP request_count 
-# TYPE request_count counter
-request_count{app="default",env="",instance="",service="servicecomb-kie",version="0.1.0"} 14
-# HELP request_process_duration 
-# TYPE request_process_duration summary
-request_process_duration{app="default",env="",instance="",service="servicecomb-kie",version="0.1.0",quantile="0.5"} 3
-request_process_duration{app="default",env="",instance="",service="servicecomb-kie",version="0.1.0",quantile="0.9"} 80
-request_process_duration{app="default",env="",instance="",service="servicecomb-kie",version="0.1.0",quantile="0.99"} 80
-request_process_duration_sum{app="default",env="",instance="",service="servicecomb-kie",version="0.1.0"} 315
-request_process_duration_count{app="default",env="",instance="",service="servicecomb-kie",version="0.1.0"} 14
+# HELP scb_request_count 
+# TYPE scb_request_count counter
+scb_request_count{app="default",env="",instance="",service="servicecomb-kie",version="0.1.0"} 14
+# HELP scb_request_process_duration 
+# TYPE scb_request_process_duration summary
+scb_request_process_duration{app="default",env="",instance="",service="servicecomb-kie",version="0.1.0",quantile="0.5"} 3
+scb_request_process_duration{app="default",env="",instance="",service="servicecomb-kie",version="0.1.0",quantile="0.9"} 80
+scb_request_process_duration{app="default",env="",instance="",service="servicecomb-kie",version="0.1.0",quantile="0.99"} 80
+scb_request_process_duration_sum{app="default",env="",instance="",service="servicecomb-kie",version="0.1.0"} 315
+scb_request_process_duration_count{app="default",env="",instance="",service="servicecomb-kie",version="0.1.0"} 14
 ```
 
 
```

**File**: `docs/user-guides/metrics.md` (modified, +9/-9)
```diff
@@ -8,27 +8,27 @@ user can custom metrics plugin to replace prometheus.
 
 ## 配置
 
-**cse.metrics.enable**
+**servicecomb.metrics.enable**
 > *(optional, bool)* if it is true, 
-a new http API defined in "cse.metrics.apiPath" will serve for client
+a new http API defined in "servicecomb.metrics.apiPath" will serve for client
 default is *false*
 
-**cse.metrics.apiPath**
+**servicecomb.metrics.apiPath**
 > *(optional, string)* metrics接口，默认为*/metrics*
 
-**cse.metrics.enableGoRuntimeMetrics**
+**servicecomb.metrics.enableGoRuntimeMetrics**
 >*(optional, bool)* 是否开启go runtime监测，默认为*true*
 
-**cse.metrics.enableCircuitMetrics**
+**servicecomb.metrics.enableCircuitMetrics**
 >*(optional, bool)* report circuit breaker metrics to go-metrics, default is *true*
 
-**cse.metrics.flushInterval**
+**servicecomb.metrics.flushInterval**
 > *(optional, string)* interval flush metrics from go-metrics to prometheus exporter, 
 for example 10s, 1m
 
-**cse.metrics.circuitMetricsConsumerNum**
+**servicecomb.metrics.circuitMetricsConsumerNum**
 > *(optional, int)* should be careful about this option, default is 3, 
-there is 3 go routines consume metrics, if there is so many consumers, during high concurrency, 
+there is 3 go routines consume metrics, if there is so many consumers, during a high concurrency, 
 it will affect service performance
 
 ## Custom Metrics
@@ -38,7 +38,7 @@ github.com/go-chassis/go-chassis/v2/pkg/metrics/metrics.go
 ``` 
 
 
-## 示例
+## Example
 
 ```yaml
 servicecomb:
```

**File**: `middleware/monitoring/handler.go` (modified, +3/-3)
```diff
@@ -32,9 +32,9 @@ import (
 
 //errors
 const (
-	MetricsLatency = "request_process_duration"
-	MetricsRequest = "request_count"
-	MetricsErrors  = "error_response_count"
+	MetricsLatency = "scb_request_process_duration"
+	MetricsRequest = "scb_request_count"
+	MetricsErrors  = "scb_error_response_count"
 	Name           = "monitoring"
 )
 
```

---

### Incident Patch 12: `0f02f95d` (2021-07-01)
**Commit Message**: fix doc build failed (#988)

**File**: `.readthedocs.yaml` (added, +16/-0)
```diff
@@ -0,0 +1,16 @@
+# .readthedocs.yaml
+# Read the Docs configuration file
+# See https://docs.readthedocs.io/en/stable/config-file/v2.html for details
+
+# Required
+version: 2
+
+# Build documentation in the docs/ directory with Sphinx
+sphinx:
+  configuration: docs/conf.py
+
+# Optionally set the version of Python and requirements required to build your docs
+python:
+  version: 3.7
+  install:
+    - requirements: docs/requirements.txt
\ No newline at end of file
```

**File**: `docs/conf.py` (modified, +1/-0)
```diff
@@ -50,6 +50,7 @@
     'sphinx.ext.imgconverter',
     'sphinx.ext.viewcode',
     'sphinx_markdown_tables',
+    'myst_parser',
 ]
 
 # Add any paths that contain templates here, relative to this directory.
```

**File**: `docs/requirements.txt` (added, +4/-0)
```diff
@@ -0,0 +1,4 @@
+# Defining the exact version will make sure things don't break
+sphinx
+myst_parser
+sphinx_markdown_tables
\ No newline at end of file
```

---

### Incident Patch 13: `74106a09` (2021-03-06)
**Commit Message**: bug fix: burst is the max number of bucket size, must not be 0 (#965)

**File**: `control/panel.go` (modified, +4/-0)
```diff
@@ -24,6 +24,10 @@ const (
 	ScopeInstanceAPI = "instance-api"
 )
 
+var (
+	DefaultBurst = 10
+)
+
 //Panel is a abstraction of pulling configurations from various of systems, and transfer different configuration into standardized model
 //you can use different panel implementation to pull different of configs from Istio or Archaius
 //TODO able to set configs
```

**File**: `control/servicecomb/qps_event_listener.go` (modified, +7/-2)
```diff
@@ -2,6 +2,7 @@ package servicecomb
 
 import (
 	"github.com/go-chassis/go-archaius/event"
+	"github.com/go-chassis/go-chassis/v2/control"
 	"github.com/go-chassis/go-chassis/v2/resilience/rate"
 	"github.com/go-chassis/openlog"
 	"strconv"
@@ -47,11 +48,15 @@ func (el *QPSEventListener) Event(e *event.Event) {
 		"event":  e.EventType,
 		"value":  qps,
 	}))
+	burst := qps / 5
+	if burst == 0 {
+		burst = control.DefaultBurst
+	}
 	switch e.EventType {
 	case common.Update:
-		qpsLimiter.UpdateRateLimit(e.Key, qps, qps/5)
+		qpsLimiter.UpdateRateLimit(e.Key, qps, burst)
 	case common.Create:
-		qpsLimiter.UpdateRateLimit(e.Key, qps, qps/5)
+		qpsLimiter.UpdateRateLimit(e.Key, qps, burst)
 	case common.Delete:
 		qpsLimiter.DeleteRateLimiter(e.Key)
 	}
```

**File**: `middleware/ratelimiter/qps_consumer_flow_control_handler.go` (modified, +5/-2)
```diff
@@ -36,8 +36,11 @@ func (rl *ConsumerRateLimiterHandler) Handle(chain *handler.Chain, i *invocation
 		cb(r)
 		return
 	}
-	//get operation meta info ms.schema, ms.schema.operation, ms
-	if rate.GetRateLimiters().TryAccept(rlc.Key, rlc.Rate, rlc.Rate/5) {
+	burst := rlc.Rate / 5
+	if burst == 0 {
+		burst = control.DefaultBurst
+	}
+	if rate.GetRateLimiters().TryAccept(rlc.Key, rlc.Rate, burst) {
 		chain.Next(i, cb)
 	} else {
 		r := newErrResponse(i)
```

**File**: `middleware/ratelimiter/qps_provider_flow_control_handler.go` (modified, +5/-1)
```diff
@@ -25,7 +25,11 @@ func (rl *ProviderRateLimiterHandler) Handle(chain *handler.Chain, i *invocation
 		cb(r)
 		return
 	}
-	if rate.GetRateLimiters().TryAccept(rlc.Key, rlc.Rate, rlc.Rate/5) {
+	burst := rlc.Rate / 5
+	if burst == 0 {
+		burst = control.DefaultBurst
+	}
+	if rate.GetRateLimiters().TryAccept(rlc.Key, rlc.Rate, burst) {
 		chain.Next(i, cb)
 	} else {
 		r := newErrResponse(i)
```

**File**: `resilience/rate/limiter_test.go` (modified, +1/-1)
```diff
@@ -48,7 +48,7 @@ func TestLimiters_TryAccept(t *testing.T) {
 			fmt.Println(count)
 			stop = true
 		default:
-			pass := rate.GetRateLimiters().TryAccept("serviceName", 100, 2)
+			pass := rate.GetRateLimiters().TryAccept("serviceName", 1000, 10)
 			if pass {
 				count++
 			}
```

---

### Incident Patch 14: `ad085f56` (2021-02-27)
**Commit Message**: revert prefix (#961)

**File**: `core/config/key_generator.go` (modified, +1/-2)
```diff
@@ -4,8 +4,7 @@ import "strings"
 
 // constant for hystrix keys
 const (
-	FixedPrefix = "servicecomb"
-
+	FixedPrefix                       = "cse"
 	NamespaceIsolation                = "isolation"
 	NamespaceCircuitBreaker           = "circuitBreaker"
 	NamespaceFallback                 = "fallback" //降级
```

**File**: `core/handler/fault_inject_handler_test.go` (modified, +1/-1)
```diff
@@ -16,7 +16,7 @@ import (
 )
 
 var yamlContent = `---
-servicecomb:
+cse:
   governance:
     Consumer:
       service1:
```

**File**: `examples/discovery/server/conf/chassis.yaml` (modified, +0/-18)
```diff
@@ -3,24 +3,6 @@ region:
   name: us-east
   availableZone: us-east-1
 servicecomb:
-#  flowcontrol:
-#    Provider:
-#      qps:
-#        enabled: true  # enable rate limiting or not
-#        global:
-#          limit: 100   # default limit of provider
-#        limit:
-#          benchmark: 200  # rate limit for request from a consumer
-  loadbalance:
-    strategy:
-      name: RoundRobin
-    retryEnabled: false
-    retryOnNext: 2
-    retryOnSame: 3
-    backoff:
-      kind: constant
-      minMs: 200
-      maxMs: 400
   registry:
     type: servicecenter           #optional:可选zookeeper/servicecenter，zookeeper供中软使用，不配置的情况下默认为servicecenter
     scope: full                   #optional:scope不为full时，只允许在本app间访问，不允许跨app访问；为full就是注册时允许跨app，并且发现本租户全部微服务
```

**File**: `go.mod` (modified, +2/-2)
```diff
@@ -5,8 +5,8 @@ require (
 	github.com/dgrijalva/jwt-go v3.2.0+incompatible
 	github.com/emicklei/go-restful v2.12.0+incompatible
 	github.com/go-chassis/cari v0.0.0-20201210041921-7b6fbef2df11
-	github.com/go-chassis/foundation v0.2.2-0.20201210043510-9f6d3de40234
-	github.com/go-chassis/go-archaius v1.3.6-0.20201210061741-7450779aaeb8
+	github.com/go-chassis/foundation v0.2.2
+	github.com/go-chassis/go-archaius v1.5.0
 	github.com/go-chassis/go-restful-swagger20 v1.0.3-0.20200310030431-17d80f34264f
 	github.com/go-chassis/openlog v1.1.2
 	github.com/go-chassis/sc-client v0.5.1-0.20210122055720-44b8ac6a939d
```

**File**: `go.sum` (modified, +151/-1)
```diff
@@ -1,61 +1,112 @@
 cloud.google.com/go v0.26.0/go.mod h1:aQUYkXzVsufM+DwF1aE+0xfcU+56JwCaLick0ClmMTw=
 cloud.google.com/go v0.34.0/go.mod h1:aQUYkXzVsufM+DwF1aE+0xfcU+56JwCaLick0ClmMTw=
+cloud.google.com/go v0.38.0 h1:ROfEUZz+Gh5pa62DJWXSaonyu3StP6EA6lPEXPI6mCo=
 cloud.google.com/go v0.38.0/go.mod h1:990N+gfupTy94rShfmMCWGDn0LpTmnzTp2qbd1dvSRU=
+github.com/Azure/go-autorest/autorest v0.9.0 h1:MRvx8gncNaXJqOoLmhNjUAKh33JJF8LyxPhomEtOsjs=
 github.com/Azure/go-autorest/autorest v0.9.0/go.mod h1:xyHB1BMZT0cuDHU7I0+g046+BFDTQ8rEZB0s4Yfa6bI=
+github.com/Azure/go-autorest/autorest/adal v0.5.0 h1:q2gDruN08/guU9vAjuPWff0+QIrpH6ediguzdAzXAUU=
 github.com/Azure/go-autorest/autorest/adal v0.5.0/go.mod h1:8Z9fGy2MpX0PvDjB1pEgQTmVqjGhiHBW7RJJEciWzS0=
+github.com/Azure/go-autorest/autorest/date v0.1.0 h1:YGrhWfrgtFs84+h0o46rJrlmsZtyZRg470CqAXTZaGM=
 github.com/Azure/go-autorest/autorest/date v0.1.0/go.mod h1:plvfp3oPSKwf2DNjlBjWF/7vwR+cUD/ELuzDCXwHUVA=
 github.com/Azure/go-autorest/autorest/mocks v0.1.0/go.mod h1:OTyCOPRA2IgIlWxVYxBee2F5Gr4kF2zd2J5cFRaIDN0=
+github.com/Azure/go-autorest/autorest/mocks v0.2.0 h1:Ww5g4zThfD/6cLb4z6xxgeyDa7QDkizMkJKe0ysZXp0=
 github.com/Azure/go-autorest/autorest/mocks v0.2.0/go.mod h1:OTyCOPRA2IgIlWxVYxBee2F5Gr4kF2zd2J5cFRaIDN0=
+github.com/Azure/go-autorest/logger v0.1.0 h1:ruG4BSDXONFRrZZJ2GUXDiUyVpayPmb1GnWeHDdaNKY=
 github.com/Azure/go-autorest/logger v0.1.0/go.mod h1:oExouG+K6PryycPJfVSxi/koC6LSNgds39diKLz7Vrc=
+github.com/Azure/go-autorest/tracing v0.5.0 h1:TRn4WjSnkcSy5AEG3pnbtFSwNtwzjr4VYyQflFE619k=
 github.com/Azure/go-autorest/tracing v0.5.0/go.mod h1:r/s2XiOKccPW3HrqB+W0TQzfbtp2fGCgRFtBroKn4Dk=
+github.com/BurntSushi/toml v0.3.1 h1:WXkYYl6Yr3qBf1K79EBnL4mak0OimBfB0XUf9Vl28OQ=
 github.com/BurntSushi/toml v0.3.1/go.mod h1:xHWCNGjB5oqiDr8zfno3MHue2Ht5sIBksp03qcyfWMU=
+github.com/NYTimes/gziphandler v0.0.0-20170623195520-56545f4a5d46 h1:lsxEuwrXEAokXB9qhlbKWPpo3KMLZQ5WB5WLQRW1uq0=
 github.com/NYTimes/gziphandler v0.0.0-20170623195520-56545f4a5d46/go.mod h1:3wb06e3pkSAbeQ52E9H9iFoQsEEwGN64994WTCIhntQ=
+github.com/OneOfOne/xxhash v1.2.2 h1:KMrpdQIwFcEqXDklaen+P1axHaj9BSKzvpUUfnHldSE=
 github.com/OneOfOne/xxhash v1.2.2/go.mod h1:HSdplMjZKSmBqAxg5vPj2TmRDmfkzw+cTzAElWljhcU=
+github.com/PuerkitoBio/purell v1.0.0 h1:0GoNN3taZV6QI81IXgCbxMyEaJDXMSIjArYBCYzVVvs=
 github.com/PuerkitoBio/purell v1.0.0/go.mod h1:c11w/QuzBsJSee3cPx9rAFu61PvFxuPbtSwDGJws/X0=
+github.com/PuerkitoBio/urlesc v0.0.0-20160726150825-5bd2802263f2 h1:JCHLVE3B+kJde7bIEo5N4J+ZbLhp0J1Fs+ulyRws4gE=
 github.com/PuerkitoBio/urlesc v0.0.0-20160726150825-5bd2802263f2/go.mod h1:uGdkoq3SwY9Y+13GIhn11/XLaGBb4BfwItxLd5jeuXE=
+github.com/Shonminh/apollo-client v0.4.0 h1:AXGp4wOahrEKjheMXehgsG9B8dEfLQHttRLHeEefvus=
 github.com/Shonminh/apollo-client v0.4.0/go.mod h1:Jk6K99uIGxQm7Uyy1gCQTvM/kc1YLp4Qo9/jtGkEXvI=
+github.com/alecthomas/template v0.0.0-20160405071501-a0175ee3bccc h1:cAKDfWh5VpdgMhJosfJnn5/FoN2SRZ4p7fJNX58YPaU=
 github.com/alecthomas/template v0.0.0-20160405071501-a0175ee3bccc/go.mod h1:LOuyumcjzFXgccqObfd/Ljyb9UuFJ6TxHnclSeseNhc=
+github.com/alecthomas/units v0.0.0-20151022065526-2efee857e7cf h1:qet1QNfXsQxTZqLG4oE62mJzwPIB8+Tee4RNCL9ulrY=
 github.com/alecthomas/units v0.0.0-20151022065526-2efee857e7cf/go.mod h1:ybxpYRFXyAe+OPACYpWeL0wqObRcbAqCMya13uyzqw0=
+github.com/beorn7/perks v0.0.0-20180321164747-3a771d992973 h1:xJ4a3vCFaGF/jqvzLMYoU8P317H5OQ+Via4RmuPwCS0=
 github.com/beorn7/perks v0.0.0-20180321164747-3a771d992973/go.mod h1:Dwedo/Wpr24TaqPxmxbtue+5NUziq4I4S80YR8gNf3Q=
+github.com/cenkalti/backoff v2.0.0+incompatible h1:5IIPUHhlnUZbcHQsQou5k1Tn58nJkeJL9U+ig5CHJbY=
 github.com/cenkalti/backoff v2.0.0+incompatible/go.mod h1:90ReRw6GdpyfrHakVjL/QHaoyV4aDUVVkXQJJJ3NXXM=
+github.com/cespare/xxhash v1.1.0 h1:a6HrQnmkObjyL+Gs60czilIUGqrzKutQD6XZog3p+ko=
 github.com/cespare/xxhash v1.1.0/go.mod h1:XrSqR1VqqWfGrhpAt58auRo0WTKS1nRRg3ghfAqPWnc=
+github.com/client9/misspell v0.3.4 h1:ta993UF76GwbvJcIo3Y68y/M3WxlpEHPWIGDkJYwzJI=
 github.com/client9/misspell v0.3.4/go.mod h1:qj6jICC3Q7zFZvVWo7KLAzC3yx5G7kyvSDkc90ppPyw=
+github.com/coocood/freecache v1.0.1 h1:oFyo4msX2c0QIKU+kuMJUwsKamJ+AKc2JJrKcMszJ5M=
 github.com/coocood/freecache v1.0.1/go.mod h1:ePwxCDzOYvARfHdr1pByNct1at3CoKnsipOHwKlNbzI=
 github.com/davecgh/go-spew v0.0.0-20151105211317-5215b55f46b2/go.mod h1:J7Y8YcW2NihsgmVo/mv3lAwl/skON4iLHjSsI+c5H38=
 github.com/davecgh/go-spew v1.1.0/go.mod h1:J7Y8YcW2NihsgmVo/mv3lAwl/skON4iLHjSsI+c5H38=
+github.com/davecgh/go-spew v1.1.1 h1:vj9j/u1bqnvCEfJOwUhtlOARqs3+rkHYY13jYWTU97c=
 github.com/davecgh/go-spew v1.1.1/go.mod h1:J7Y8YcW2NihsgmVo/mv3lAwl/skON4iLHjSsI+c5H38=
+github.com/dgrijalva/jwt-go v3.2.0+incompatible h1:7qlOGliEKZXTDg6OTjfoBKDXWrumCAMpl/TFQ4/5kLM=
 github.com/dgrijalva/jwt-go v3.2.0+incompatible/go.mod h1:E3ru+11k8xSBh+hMPgOLZmtrrCbhqsmaPHjLKYnJCaQ=
+github.com/docker/spdystream v0.0.0-20160310174837-449fdfce4d96 h1:cenwrSVm+Z7QLSV/BsnenAOcDXdX4cMv4wP0B/5QbPg=
 github.com/docker/spdystream v0.0.0-20160310174837-449
```

---

### Incident Patch 15: `93feb76f` (2020-12-08)
**Commit Message**: Fix/typo/registry config (#946)

* fix: fix a typo in registry doc. (set registry.disabled to true means disable auto service registration).

* fix: fix a typo in registry doc. (set registry.disabled to true means disable auto service registration).

Co-authored-by: Guang Yang <[REDACTED_EMAIL]>

**File**: `docs/user-guides/registry.md` (modified, +1/-1)
```diff
@@ -13,7 +13,7 @@ chassis.yaml中配置使用的注册中心类型、注册中心的地址信息
 
 
 **disabled**
-> *(optional, bool)* 是否开启服务注册发现模块，默认为false
+> *(optional, bool)* 是否关闭服务注册发现模块，默认为false, 设为 true 之后关闭服务自动注册。
 
 **type**
 > *(optional, string)* 对接的服务中心类型，默认为servicecenter，
```

#### Recent Merged Pull Requests:
- **PR #1100** (2025-12-30): serviceId 变更导致心跳失败问题修复 (@yanghao605)
- **PR #1098** (2025-12-05): support listen ipv6 address (@hzp-excellent)
- **PR #1094** (closed): Bump golang.org/x/net from 0.23.0 to 0.38.0 (@dependabot[bot])
- **PR #1093** (closed): Bump golang.org/x/net from 0.23.0 to 0.36.0 (@dependabot[bot])
- **PR #1090** (2024-09-10): Bump google.golang.org/protobuf from 1.26.0 to 1.33.0 (@dependabot[bot])
- **PR #1089** (2024-09-10): Bump golang.org/x/net from 0.0.0-20210525063256-abc453219eb5 to 0.23.0 (@dependabot[bot])
- **PR #1087** (2024-03-20): [feat] the ratelimiter support match traffic with queryparams (@tornado-ssy)
- **PR #1086** (2024-03-18): [feat] the size of log support 500M (@tornado-ssy)

---

## 3. Empirical Evidence & Compliance Certification
- **Evidence Provenance**: Fetched directly from verified official GitHub REST API.
- **Zero Disk Footprint**: 0 bytes of unnecessary repository bloat stored locally.
- **TOS & Free-Tier Adherence**: Request pace complied with public API guidelines without fee, penalty, or unauthorized scraping.

---

## 4. Promotion & Integration Status
- **Status**: HARVESTED_DEEP_FORENSIC
- **Master Brain Sync**: Auto-committed to local/remote Master Brain repository.
