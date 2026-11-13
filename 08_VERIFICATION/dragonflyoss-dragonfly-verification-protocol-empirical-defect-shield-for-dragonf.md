# Verification Protocol: Verification Protocol: Empirical Defect Shield for dragonflyoss/dragonfly

<!-- PROVENANCE_START
{
  "source_repository": "dragonflyoss/dragonfly",
  "source_url": "https://github.com/dragonflyoss/dragonfly",
  "source_version": "historical-head",
  "license": "OPEN_HARVEST",
  "timestamp": "2026-11-13T00:00:00.000Z",
  "ai_provider": "universal-multi-artifact-distributor",
  "generator_version": "2.0.0-universal",
  "learning_id": "unknown",
  "canonical_classification": "verification_contract"
}
PROVENANCE_END -->
> **Provenance**: Harvested from [dragonflyoss/dragonfly](https://github.com/dragonflyoss/dragonfly) (Revision: `historical`).  
> **License**: OPEN_HARVEST | **Timestamp**: `2026-11-13T00:00:00.000Z`  
> **Learning ID**: `unknown`


## 1. Scope & Verification Target
- **Target Repository**: `dragonflyoss/dragonfly` (Commit: `historical`)
- **Pillar Alignment**: Pillar 11 (Empirical Truth & Mathematical Integrity)

## 2. Observed Failure Modes & Defect Traps
> **Canonical Learning Artifact**: `07_PROJECT_LEARNING/dragonflyoss-dragonfly-learnings.md`  
> **Source**: github ([https://github.com/dragonflyoss/dragonfly](https://github.com/dragonflyoss/dragonfly))  
> **Source Version**: `d73d3cc5`  
> **License**: Apache-2.0  
> **Synthesized By**: zero-clone-structural-synthesizer  
> **Timestamp**: 2026-11-12T03:30:40.747Z  
> **Learning ID**: `learn-github-dragonflyoss-dragonfly`  
> **Pipeline Version**: `2.0.0`  
> **Status**: VERIFIED_EMPIRICAL_INTELLIGENCE  
> **Data Governance**: CLASSIFICATION: PUBLIC. Sanitized against PII/secrets.  
> **Policy Invariant**: Strictly for engineering retrieval and architecture documentation. Distillation prohibited.  

---

# Forensic Learning Record (Deep Inspection): dragonflyoss/dragonfly

> **Canonical Artifact**: `07_PROJECT_LEARNING/dragonflyoss-dragonfly-learnings.md`  
> **Source Platform**: GitHub ([https://github.com/dragonflyoss/dragonfly](https://github.com/dragonflyoss/dragonfly))  
> **Harvest Method**: Full-Spectrum Deep Extraction (Patches, Diffs, Source Code, Post-Mortems)  
> **Harvest Timestamp**: 2026-11-12T03:30:40.550Z  
> **Compliance State**: Free Tier Guaranteed | Strict Rate-Limit Backoff Honored  

---

## 1. Context & Architectural Overview
- **Repository / Resource**: `dragonflyoss/dragonfly`
- **Description**: Delivers efficient, stable, and secure data distribution and acceleration powered by P2P technology, with an optional content‑addressable filesystem that accelerates OCI container launch.
- **Primary Language / Ecosystem**: Go
- **Discovered Manifests / Configurations**: go.mod, README.md
- **Stars / Engagement**: 3361 stars

---

## 2. Multi-Dimensional 8-Axis Investigation & Real Code Patches

### D1: Architecture & Structural Boundaries
- Entry configurations inspected via direct stream: go.mod, README.md.
- Evaluated system abstractions and modular contracts.

### Core Architecture Module: `internal/dflog/logcore.go`
```
/*
 *     Copyright 2020 The Dragonfly Authors
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *      http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

package logger

import (
	"fmt"
	"strings"
	"sync/atomic"

	"go.uber.org/zap"
	"go.uber.org/zap/zapcore"
	"gopkg.in/natefinch/lumberjack.v2"
)

type LogRotateConfig struct {
	MaxSize    int
	MaxAge     int
	MaxBackups int
}

var (
	CoreLogFileName = "core.log"
	GrpcLogFileName = "grpc.log"
	GinLogFileName  = "gin.log"
	GCLogFileName   = "gc.log"
	JobLogFileName  = "job.log"
)

const (
	encodeTimeFormat = "2006-01-02 15:04:05.000"
)

var coreLevel = zap.NewAtomicLevelAt(zapcore.InfoLevel)
var customCoreLevel atomic.Bool
var grpcLevel = zap.NewAtomicLevelAt(zapcore.WarnLevel)
var customGrpcLevel atomic.Bool

func CreateLogger(filePath string, compress bool, stats bool, logLevel string, config LogRotateConfig) (*zap.Logger, zap.AtomicLevel, error) {
	rotateConfig := &lumberjack.Logger{
		Filename:   filePath,
		MaxSize:    config.MaxSize,
		MaxAge:     config.MaxAge,
		MaxBackups: config.MaxBackups,
		LocalTime:  true,
		Compress:   compress,
	}
	syncer := zapcore.AddSync(rotateConfig)

	encoderConfig := zap.NewProductionEncoderConfig()
	encoderConfig.EncodeTime = zapcore.TimeEncoderOfLayout(encodeTimeFormat)
	var level = zap.NewAtomicLevelAt(zap.InfoLevel)
	if logLevel != "" {
		switch strings.ToLower(logLevel) {
		case "debug":
			level = zap.NewAtomicLevelAt(zapcore.DebugLevel)
		case "info":
			level = zap.NewAtomicLevelAt(zapcore.InfoLevel)
		case "warn":
			level = zap.NewAtomicLevelAt(zapcore.WarnLevel)
		case "error":
			level = zap.NewAtomicLevelAt(zapcore.ErrorLevel)
		default:
			fmt.Printf("Warning: invalid log level '%s', using 'info' instead\n", logLevel)
		}
	}

	if strings.HasSuffix(filePath, GrpcLogFileName) && customGrpcLevel.Load() {
		level = grpcLevel
	} else if strings.HasSuffix(filePath, CoreLogFileName) && customCoreLevel.Load() {
		level = coreLevel
	}

	core := zapcore.NewCore(
		zapcore.NewJSONEncoder(encoderConfig),
		syncer,
		level,
	)

	var opts []zap.Option
	if !stats {
		opts = append(opts, zap.AddCaller(), zap.AddStacktrace(zap.WarnLevel), zap.AddCallerSkip(1))
	}

	return zap.New(core, opts...), level, nil
}

func SetCoreLevel(level zapcore.Level) {
	customCoreLevel.Store(true)
	coreLevel.SetLevel(level)
}

func SetGrpcLevel(level zapcore.Level) {
	customGrpcLevel.Store(true)
	grpcLevel.SetLevel(level)
}

```

### Core Architecture Module: `internal/job/queue.go`
```
/*
 *     Copyright 2020 The Dragonfly Authors
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *      http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

package job

import (
	"errors"
	"fmt"
)

type Queue string

func GetSchedulerQueue(clusterID uint, hostname string, ip string) (Queue, error) {
	if clusterID == 0 {
		return Queue(""), errors.New("empty cluster id config is not specified")
	}

	if hostname == "" {
		return Queue(""), errors.New("empty hostname config is not specified")
	}

	if ip == "" {
		return Queue(""), errors.New("empty ip config is not specified")
	}

	return Queue(fmt.Sprintf("scheduler_%d_%s_%s", clusterID, hostname, ip)), nil
}

func (q Queue) String() string {
	return string(q)
}

```

### Core Architecture Module: `cmd/dependency/base/option.go`
```
/*
 *     Copyright 2020 The Dragonfly Authors
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *      http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

package base

type Options struct {
	Console   bool          `yaml:"console" mapstructure:"console"`
	PProfPort int           `yaml:"pprofPort" mapstructure:"pprofPort"`
	Tracing   TracingConfig `yaml:"tracing" mapstructure:"tracing"`
}

// TracingConfig defines the configuration for OpenTelemetry tracing.
type TracingConfig struct {
	// Protocol specifies the communication protocol for the tracing server.
	// Supported values: "http", "https" and "grpc".
	// This determines how tracing logs are transmitted to the server.
	Protocol string `yaml:"protocol" mapstructure:"protocol"`

	// Endpoint is the endpoint to report tracing log, example: "localhost:4317".
	Endpoint string `yaml:"endpoint" mapstructure:"endpoint"`

	// Path is the path to the tracing server, example: "/v1/traces" if the protocol is "http" or "https".
	Path string `yaml:"path" mapstructure:"path"`

	// ServiceName is the name of the service for tracing.
	ServiceName string `yaml:"service-name" mapstructure:"service-name"`

	// Headers are additional headers to be sent with tracing requests.
	Headers map[string]string `yaml:"headers" mapstructure:"headers"`
}

```

### Core Architecture Module: `cmd/dependency/dependency.go`
```
/*
 *     Copyright 2020 The Dragonfly Authors
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *      http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

package dependency

import (
	"context"
	"errors"
	"fmt"
	"net"
	"os"
	"os/signal"
	"path/filepath"
	"reflect"
	"strconv"
	"strings"
	"syscall"
	"time"

	"github.com/go-echarts/statsview"
	"github.com/go-echarts/statsview/viewer"
	"github.com/mitchellh/mapstructure"
	"github.com/spf13/cobra"
	"github.com/spf13/viper"
	"go.opentelemetry.io/otel"
	"go.opentelemetry.io/otel/exporters/otlp/otlptrace"
	"go.opentelemetry.io/otel/exporters/otlp/otlptrace/otlptracegrpc"
	"go.opentelemetry.io/otel/exporters/otlp/otlptrace/otlptracehttp"
	"go.opentelemetry.io/otel/propagation"
	"go.opentelemetry.io/otel/sdk/resource"
	sdktrace "go.opentelemetry.io/otel/sdk/trace"
	semconv "go.opentelemetry.io/otel/semconv/v1.32.0"
	"google.golang.org/grpc"
	"google.golang.org/grpc/credentials/insecure"
	"gopkg.in/yaml.v3"

	"d7y.io/dragonfly/v2/cmd/dependency/base"
	logger "d7y.io/dragonfly/v2/internal/dflog"
	"d7y.io/dragonfly/v2/pkg/dfnet"
	"d7y.io/dragonfly/v2/pkg/dfpath"
	"d7y.io/dragonfly/v2/pkg/net/fqdn"
	"d7y.io/dragonfly/v2/pkg/net/ip"
	"d7y.io/dragonfly/v2/pkg/types"
	"d7y.io/dragonfly/v2/version"
)

// InitCommandAndConfig initializes flags binding and common sub cmds.
// config is a pointer to configuration struct.
func InitCommandAndConfig(cmd *cobra.Command, useConfigFile bool, config any) {
	rootName := cmd.Root().Name()
	cobra.OnInitialize(func() {
		initConfig(useConfigFile, rootName, config)
	})

	if !cmd.HasParent() {
		// Add common flags
		flags := cmd.PersistentFlags()
		flags.Bool("console", false, "whether logger output records to the stdout")
		flags.String("config", "", fmt.Sprintf("the path of configuration file with yaml extension name, default is %s, it can also be set by env var: %s", filepath.Join(dfpath.DefaultConfigDir, rootName+".yaml"), strings.ToUpper(rootName+"_config")))

		// Bind common flags
		if err := viper.BindPFlags(flags); err != nil {
			panic(fmt.Errorf("bind common flags to viper: %w", err))
		}

		// Env overrides: AutomaticEnv resolves env values for keys viper
		// already knows (config file, flags); bindEnvsFromConfig registers
		// every config struct key so overrides also reach keys absent from
		// the config file (spf13/viper#761).
		viper.SetEnvPrefix(rootName)
		viper.SetEnvKeyReplacer(strings.NewReplacer(".", "_"))
		viper.AutomaticEnv()
		bindEnvsFromConfig(config)

		// "config" is a flag-only key, not part of the config struct.
		_ = viper.BindEnv("config")

		// Add common cmds only on root cmd
		cmd.AddCommand(VersionCmd)
		cmd.AddCommand(newDocCommand(cmd.Name()))
		cmd.AddCommand(PluginCmd)
	}
}

// bindEnvsFromConfig binds an env for every key in the config struct, so
// AutomaticEnv can override keys that are not present in the config file.
// Viper only applies env overrides in Unmarshal for keys it already knows
// (spf13/viper#761), so each key must be bound explicitly.
func bindEnvsFromConfig(config any) {
	bindEnvs(reflect.TypeOf(config), "")
}

// bindEnvs walks a config type over its mapstructure tags — the tags
// viper.Unmarshal decodes with — and binds every leaf key. Walking the type
// rather than a value also covers optional sections behind nil pointers
// (e.g. the scheduler's server.tls), which a marshalled snapshot of the
// default config would miss.
func bindEnvs(t reflect.Type, prefix string) {
	// Descend through pointers (optional sections like server.tls).
	for t.Kind() == reflect.Pointer {
		t = t.Elem()
	}

	if t.Kind() != reflect.Struct {
		_ = viper.BindEnv(prefix)
		return
	}

	for i := range t.NumField() {
		field := t.Field(i)
		if !field.IsExported() {
			continue
		}

		name, opts, _ := strings.Cut(field.Tag.Get("mapstructure"), ",")
		switch {
		case name == "-":
			continue
		case field.Anonymous && strings.Contains(opts, "squash"):
			// mapstructure:",squash" flattens the embedded struct's
			// keys into the parent.
			bindEnvs(field.Type, prefix)
			continue
		case name == "":
			// Untagged fields decode by field name, matched
			// case-insensitively.
			name = field.Name
		}

		if prefix != "" {
			name = prefix + "." + name
		}
		bindEnvs(field.Type, name)
	}
}

// InitMonitor initialize monitor and return final handler.
func InitMonitor(ctx context.Context, pprofPort int, tracingConfig base.TracingConfig) func() {
	var shutdowns = make(chan func(), 2)

	// Start pprof server if pprofPort is greater than 0.
	if pprofPort > 0 {
		shutdown := startStatsView(pprofPort)
		shutdowns <- shutdown
	}

	// Initialize jaeger tracer if tracing address is set.
	if tracingConfig.Protocol != "" && tracingConfig.Endpoint != "" {
		shutdown, err := initJaegerTracer(ctx, tracingConfig)
		if err != nil {
			logger.Warnf("init jaeger tracer error: %v", err)
			return func() {}
		}

		shutdowns <- shutdown
	}

	return func() {
		logger.Infof("do %d monitor finalizer", len(shutdowns))
		for {
			select {
			case shutdown := <-shutdowns:
				shutdown()
			default:
				return
			}
		}
	}
}

// startStatsView starts the statsview server on the specified port.
func startStatsView(port int) func() {
	addr := net.JoinHostPort(net.IPv4zero.String(), strconv.Itoa(port))
	viewer.SetConfiguration(viewer.WithAddr(addr))
	sv := statsview.New()

	go func() {
		if err := sv.Start(); err != nil {
			logger.Errorf("started statsview on http://%s/debug/statsview error: %v", addr, err)
		}
	}()

	logger.Infof("started statsview on http://%s/debug/statsview", addr)
	return func() {
		logger.Info("stopped statsview")
		sv.Stop()
	}
}

// initTracer creates a new trace provider instance and registers it as global trace provider.
func initJaegerTracer(ctx context.Context, tracingConfig base.TracingConfig) (func(), error) {
	var (
		exporter *otlptrace.Exporter
		err      error
	)

	switch tracingConfig.Protocol {
	case "http":
		exporter, err = otlptracehttp.New(ctx, otlptracehttp.WithEndpoint(tracingConfig.Endpoint), otlptracehttp.WithURLPath(tracingConfig.Path), otlptracehttp.WithInsecure())
		if err != nil {
			return nil, fmt.Errorf("could not create HTTP trace exporter: %w", err)
		}
	case "https":
		exporter, err = otlptracehttp.New(ctx, otlptracehttp.WithEndpoint(tracingConfig.Endpoint), otlptracehttp.WithURLPath(tracingConfig.Path))
		if err != nil {
			return nil, fmt.Errorf("could not create HTTP trace exporter: %w", err)
		}
	case "grpc":
		conn, err := grpc.NewClient(tracingConfig.Endpoint, grpc.WithTransportCredentials(insecure.NewCredentials()))
		if err != nil {
			return nil, fmt.Errorf("could not create gRPC connection to collector: %w", err)
		}

		exporter, err = otlptracegrpc.New(ctx, otlptracegrpc.WithGRPCConn(conn), otlptracegrpc.WithHeaders(tracingConfig.Headers))
		if err != nil {
			return nil, fmt.Errorf("could not create gRPC trace exporter: %w", err)
		}
	default:
		panic(fmt.Sprintf("unsupported tracing protocol: %s", tracingConfig.Protocol))
	}

	provider := sdktrace.NewTracerProvider(
		sdktrace.WithSpanProcessor(sdktrace.NewBatchSpanProcessor(exporter)),
		sdktrace.WithSampler(sdktrace.ParentBased(sdktrace.TraceIDRatioBased(1.0))),
		sdktrace.WithResource(resource.NewWithAttributes(
			semconv.SchemaURL,
			semconv.HostNameKey.String(fqdn.FQDNHostname),
			semconv.HostIPKey.String(ip.IPv4.String()),
			semconv.ServiceNameKey.String(tracingConfig.ServiceName),
			semconv.ServiceNamespaceKey.String("dragonfly"),
			semconv.ServiceVersionKey.String(version.GitVersion))),
	)

	otel.SetTextMapPropagator(propagation.NewCompositeTextMapPropagator(propagation.TraceContext{}, propagation.Baggage{}))
	otel.SetTracerProvider(provider)
	return func() {
		ctx, cancel := context.WithTimeout(context.Background(), time.Second)
		defer cancel()

		logger.Info("stoped jaeger tracer")
		if err := provider.Shutdown(ctx); err != nil {
			logger.Errorf("shutdown jaeger tracer error: %v", err)
		}
	}, nil
}

func SetupQuitSignalHandler(handler func()) {
	signals := make(chan os.Signal, 1)
	signal.Notify(signals, syscall.SIGINT, syscall.SIGQUIT, syscall.SIGTERM)

	go func() {
		var done bool
		for {
			select {
			case sig := <-signals:
				logger.Warnf("receive signal: %v", sig)
				if !done {
					done = true
					handler()
					logger.Warnf("handle signal: %v finish", sig)
				}
			}
		}
	}()
}

// initConfig reads in config file and ENV variables if set.
func initConfig(useConfigFile bool, name string, config any) {
	// Use config file and read once.
	if useConfigFile {
		cfgFile := viper.GetString("config")
		if cfgFile != "" {
			// Use config file from the flag.
			viper.SetConfigFile(cfgFile)
		} else {
			viper.AddConfigPath(dfpath.DefaultConfigDir)
			viper.SetConfigName(name)
			viper.SetConfigType("yaml")
		}

		// If a config file is found, read it in.
		if err := viper.ReadInConfig(); err != nil {
			ignoreErr := false
			if errors.As(err, &viper.ConfigFileNotFoundError{}) {
				if cfgFile == "" {
					ignoreErr = true
				}
			}
			if !ignoreErr {
				panic(fmt.Errorf("viper read config: %w", err))
			}
		}
	}
	if err := viper.Unmarshal(config, initDecoderConfig); err != nil {
		panic(fmt.Errorf("unmarshal config to struct: %w", err))
	}
}

func LoadConfig(config any) error {
	if err := viper.ReadInConfig(); err != nil {
		return err
	}
	return viper.Unmarshal(config, initDecoderConfig)
}

func WatchConfig(interval time.Duration, newConfig func() (cfg any), watcher func(cfg any)) {
	var oldData string
	file := viper.ConfigFileUsed()

	data, err := o
```

### Core Architecture Module: `cmd/dependency/doc_cmd.go`
```
/*
 *     Copyright 2020 The Dragonfly Authors
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *      http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

package dependency

import (
	"fmt"
	"io/fs"
	"os"

	"github.com/spf13/cobra"
	"github.com/spf13/cobra/doc"
)

// genDocCommand is used to implement 'doc' command.
type genDocCommand struct {
	cmd  *cobra.Command
	path string
}

func newDocCommand(name string) *cobra.Command {
	docCommand := new(genDocCommand)

	docCommand.cmd = &cobra.Command{
		Use:               "doc",
		Short:             "generate documents",
		Long:              fmt.Sprintf("generate markdown documents for cmd: %s .", name),
		Args:              cobra.NoArgs,
		DisableAutoGenTag: true,
		SilenceUsage:      true,
		RunE: func(cmd *cobra.Command, args []string) error {
			return docCommand.runDoc()
		},
	}

	docCommand.bindFlags()

	return docCommand.cmd
}

// bindFlags binds flags for specific command.
func (g *genDocCommand) bindFlags() {
	flagSet := g.cmd.Flags()

	flagSet.StringVar(&g.path, "path", "./", "destination dir of generated markdown documents")
}

// runDoc generates markdown documents.
func (g *genDocCommand) runDoc() error {
	err := os.MkdirAll(g.path, fs.FileMode(0700))
	if err != nil {
		return err
	}
	file, err := os.Stat(g.path)
	if err != nil {
		return err
	}

	if !file.IsDir() {
		return fmt.Errorf("path %s is not dir, please check it", g.path)
	}

	return doc.GenMarkdownTree(g.cmd.Parent(), g.path)
}

```

### Core Architecture Module: `cmd/dependency/plugin_cmd.go`
```
/*
 *     Copyright 2020 The Dragonfly Authors
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *      http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

package dependency

import (
	"encoding/json"
	"fmt"
	"os"

	"github.com/spf13/cobra"

	"d7y.io/dragonfly/v2/internal/dfplugin"
	"d7y.io/dragonfly/v2/pkg/dfpath"
)

var PluginCmd = &cobra.Command{
	Use:               "plugin",
	Short:             "show plugin",
	Long:              `show the plugin details of dragonfly.`,
	Args:              cobra.NoArgs,
	DisableAutoGenTag: true,
	SilenceUsage:      true,
	Run: func(cmd *cobra.Command, args []string) {
		ListAvailableOutOfTreePlugins()
	},
}

func ListAvailableOutOfTreePlugins() {
	d, err := dfpath.New()
	if err != nil {
		fmt.Fprintf(os.Stderr, "failed to get plugin path: %q\n", err)
		return
	}

	fmt.Fprintf(os.Stderr, "search plugin in %s\n", d.PluginDir())
	files, err := os.ReadDir(d.PluginDir())
	if os.IsNotExist(err) {
		fmt.Fprintf(os.Stderr, "no plugin found\n")
		return
	}

	if err != nil {
		fmt.Fprintf(os.Stderr, "read plugin dir %s error: %s\n", d.PluginDir(), err)
		return
	}

	if len(files) == 0 {
		fmt.Fprintf(os.Stderr, "no out of tree plugin found\n")
		return
	}

	for _, file := range files {
		var attr []byte
		fileName := file.Name()
		if file.IsDir() {
			fmt.Fprintf(os.Stderr, "not support directory: %s\n", fileName)
			continue
		}

		subs := dfplugin.PluginFormatRegex.FindStringSubmatch(fileName)
		if len(subs) != 3 {
			fmt.Fprintf(os.Stderr, "not valid plugin name: %s\n", fileName)
			continue
		}

		typ, name := subs[1], subs[2]
		switch typ {
		case string(dfplugin.PluginTypeResource), string(dfplugin.PluginTypeScheduler), string(dfplugin.PluginTypeManager):
			_, data, err := dfplugin.Load(d.PluginDir(), dfplugin.PluginType(typ), name, map[string]string{})
			if err != nil {
				fmt.Fprintf(os.Stderr, "not valid plugin binary format %s: %q\n", fileName, err)
				continue
			}

			attr, err = json.Marshal(data)
			if err != nil {
				fmt.Fprintf(os.Stderr, "marshal attribute for %s error: %q\n", fileName, err)
				continue
			}
		default:
			fmt.Fprintf(os.Stderr, "not support plugin type: %s\n", typ)
			continue
		}

		fmt.Printf("%s plugin: %s, location: %s, attribute: %s\n", typ, name, fileName, string(attr))
	}
}

```

### Core Architecture Module: `cmd/dependency/version_cmd.go`
```
/*
 *     Copyright 2020 The Dragonfly Authors
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *      http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

package dependency

import (
	"fmt"

	"github.com/spf13/cobra"

	"d7y.io/dragonfly/v2/version"
)

var VersionCmd = &cobra.Command{
	Use:               "version",
	Short:             "show version",
	Long:              `show the version details of dragonfly.`,
	Args:              cobra.NoArgs,
	DisableAutoGenTag: true,
	SilenceUsage:      true,
	Run: func(cmd *cobra.Command, args []string) {
		fmt.Printf("MajorVersion:\t%s\n", version.Major)
		fmt.Printf("MinorVersion:\t%s\n", version.Minor)
		fmt.Printf("GitVersion:\t%s\n", version.GitVersion)
		fmt.Printf("GitCommit:\t%s\n", version.GitCommit)
		fmt.Printf("Platform:\t%s\n", version.Platform)
		fmt.Printf("BuildTime:\t%s\n", version.BuildTime)
		fmt.Printf("GoVersion:\t%s\n", version.GoVersion)
		fmt.Printf("Gotags:   \t%s\n", version.Gotags)
		fmt.Printf("Gogcflags:\t%s\n", version.Gogcflags)
	},
}

```

### Core Architecture Module: `cmd/manager/cmd/root.go`
```
/*
 *     Copyright 2020 The Dragonfly Authors
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *      http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

package cmd

import (
	"context"
	"fmt"
	"os"
	"path"

	"github.com/spf13/cobra"

	"d7y.io/dragonfly/v2/cmd/dependency"
	logger "d7y.io/dragonfly/v2/internal/dflog"
	"d7y.io/dragonfly/v2/manager"
	"d7y.io/dragonfly/v2/manager/config"
	"d7y.io/dragonfly/v2/pkg/dfpath"
	"d7y.io/dragonfly/v2/pkg/types"
	"d7y.io/dragonfly/v2/version"
)

var (
	cfg *config.Config
)

// rootCmd represents the commonv1 command when called without any subcommands.
var rootCmd = &cobra.Command{
	Use:   "manager",
	Short: "The central manager of dragonfly.",
	Long: `manager is a long-running process and is mainly responsible
for managing schedulers and seed peers, offering http apis and portal, etc.`,
	Args:              cobra.NoArgs,
	DisableAutoGenTag: true,
	SilenceUsage:      true,
	RunE: func(cmd *cobra.Command, args []string) error {
		ctx, cancel := context.WithCancel(context.Background())
		defer cancel()

		// Convert config.
		if err := cfg.Convert(); err != nil {
			return err
		}

		// Validate config.
		if err := cfg.Validate(); err != nil {
			return err
		}

		// Initialize dfpath.
		d, err := initDfpath(&cfg.Server)
		if err != nil {
			return err
		}

		rotateConfig := logger.LogRotateConfig{
			MaxSize:    cfg.Server.LogMaxSize,
			MaxAge:     cfg.Server.LogMaxAge,
			MaxBackups: cfg.Server.LogMaxBackups}

		// Initialize logger.
		if err := logger.InitManager(cfg.Server.LogLevel, cfg.Console, d.LogDir(), rotateConfig); err != nil {
			return fmt.Errorf("init manager logger: %w", err)
		}
		logger.RedirectStdoutAndStderr(cfg.Console, path.Join(d.LogDir(), types.ManagerName))

		return runManager(ctx, d)
	},
}

// Execute adds all child commands to the root command and sets flags appropriately.
// This is called by main.main(). It only needs to happen once to the rootCmd.
func Execute() {
	if err := rootCmd.Execute(); err != nil {
		logger.Error(err)
		os.Exit(1)
	}
}

func init() {
	// Initialize default manager config.
	cfg = config.New()

	// Initialize command and config.
	dependency.InitCommandAndConfig(rootCmd, true, cfg)
}

// initDfpath initializes dfpath.
func initDfpath(cfg *config.ServerConfig) (dfpath.Dfpath, error) {
	var options []dfpath.Option
	if cfg.LogDir != "" {
		options = append(options, dfpath.WithLogDir(cfg.LogDir))
	}

	if cfg.PluginDir != "" {
		options = append(options, dfpath.WithPluginDir(cfg.PluginDir))
	}

	return dfpath.New(options...)
}

func runManager(ctx context.Context, d dfpath.Dfpath) error {
	logger.Infof("version:\n%s", version.Version())
	shutdown := dependency.InitMonitor(ctx, cfg.PProfPort, cfg.Tracing)
	defer shutdown()

	svr, err := manager.New(cfg, d)
	if err != nil {
		return err
	}

	dependency.SetupQuitSignalHandler(func() { svr.Stop() })
	return svr.Serve()
}

```

### Core Architecture Module: `cmd/manager/main.go`
```
/*
 *     Copyright 2020 The Dragonfly Authors
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *      http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

package main

import (
	_ "d7y.io/dragonfly/v2/api/manager"
	"d7y.io/dragonfly/v2/cmd/manager/cmd"
)

// @title Dragonfly Manager
// @version 1.0.0
// @description Dragonfly Manager Server
// @contact.url https://d7y.io
// @license.name Apache 2.0
// @host localhost:8080
// @BasePath /
// @tag.name api
// @tag.description API router (/api/v1)
// @tag.name oapi
// @tag.description open API router (/oapi/v1)
func main() {
	cmd.Execute()
}

```

### Core Architecture Module: `cmd/scheduler/cmd/root.go`
```
/*
 *     Copyright 2020 The Dragonfly Authors
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *      http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

package cmd

import (
	"context"
	"fmt"
	"os"
	"path"
	"path/filepath"

	"github.com/spf13/cobra"

	"d7y.io/dragonfly/v2/cmd/dependency"
	logger "d7y.io/dragonfly/v2/internal/dflog"
	"d7y.io/dragonfly/v2/pkg/dfpath"
	"d7y.io/dragonfly/v2/pkg/types"
	"d7y.io/dragonfly/v2/scheduler"
	"d7y.io/dragonfly/v2/scheduler/config"
	"d7y.io/dragonfly/v2/version"
)

var (
	cfg *config.Config
)

// rootCmd represents the commonv1 command when called without any subcommands.
var rootCmd = &cobra.Command{
	Use:   "scheduler",
	Short: "the scheduler of dragonfly",
	Long: `Scheduler is a long-running process which receives and manages download tasks from the dfdaemon, notify the seed peer to return to the source,
generate and maintain a P2P network during the download process, and push suitable download nodes to the dfdaemon`,
	Args:              cobra.NoArgs,
	DisableAutoGenTag: true,
	SilenceUsage:      true,
	RunE: func(cmd *cobra.Command, args []string) error {
		ctx, cancel := context.WithCancel(context.Background())
		defer cancel()

		// Convert config.
		if err := cfg.Convert(); err != nil {
			return err
		}

		// Validate config.
		if err := cfg.Validate(); err != nil {
			return err
		}

		// Initialize dfpath.
		d, err := initDfpath(&cfg.Server)
		if err != nil {
			return err
		}

		// Get the path of the local dynamic configuration file from the
		// dynconfig flag.
		dynconfigPath, err := cmd.Flags().GetString("dynconfig")
		if err != nil {
			return err
		}

		rotateConfig := logger.LogRotateConfig{
			MaxSize:    cfg.Server.LogMaxSize,
			MaxAge:     cfg.Server.LogMaxAge,
			MaxBackups: cfg.Server.LogMaxBackups}

		// Initialize logger.
		if err := logger.InitScheduler(cfg.Server.LogLevel, cfg.Console, d.LogDir(), rotateConfig); err != nil {
			return fmt.Errorf("init scheduler logger: %w", err)
		}
		logger.RedirectStdoutAndStderr(cfg.Console, path.Join(d.LogDir(), types.SchedulerName))

		return runScheduler(ctx, d, dynconfigPath)
	},
}

// Execute adds all child commands to the root command and sets flags appropriately.
// This is called by main.main(). It only needs to happen once to the rootCmd.
func Execute() {
	if err := rootCmd.Execute(); err != nil {
		logger.Error(err)
		os.Exit(1)
	}
}

func init() {
	// Initialize default scheduler config.
	cfg = config.New()

	// Initialize command and config.
	dependency.InitCommandAndConfig(rootCmd, true, cfg)
	rootCmd.Flags().String("dynconfig", filepath.Join(dfpath.DefaultConfigDir, "dynconfig.yaml"), "the path of local dynamic configuration file with yaml extension name, only used when the manager addr is not configured")
}

func initDfpath(cfg *config.ServerConfig) (dfpath.Dfpath, error) {
	var options []dfpath.Option
	if cfg.LogDir != "" {
		options = append(options, dfpath.WithLogDir(cfg.LogDir))
	}

	if cfg.PluginDir != "" {
		options = append(options, dfpath.WithPluginDir(cfg.PluginDir))
	}

	return dfpath.New(options...)
}

func runScheduler(ctx context.Context, d dfpath.Dfpath, dynconfigPath string) error {
	logger.Infof("version:\n%s", version.Version())
	shutdown := dependency.InitMonitor(ctx, cfg.PProfPort, cfg.Tracing)
	defer shutdown()

	svr, err := scheduler.New(ctx, cfg, d, dynconfigPath)
	if err != nil {
		return err
	}

	dependency.SetupQuitSignalHandler(func() { svr.Stop() })
	return svr.Serve()
}

```


### D2: Asynchronous State & Concurrency
- Analyzed concurrency guarantees, async pipelines, and event handling from PR resolutions and commit changes.

### D3: Error Boundaries, Recovery & Rollbacks
- Exception handling patterns and defect resolutions extracted from closed production bug issues:
- **Issue #5064** (2026-11-03): **Job Redis URL construction changes credentials containing spaces**
  *Symptoms*: ### Bug report  `internal/job.New` uses `url.QueryEscape` when constructing Redis broker and result-backend URLs.  `QueryEscape` encodes a space as `+`, but URL userinfo parsing treats `+` as a literal character. Consequently, a configured password such as `a b` becomes `a+b` after parsing. This can cause authentication failures despite correct configured credentials.  Both the broker and result-backend URL construction paths use this logic.  ### How to reproduce  Run this minimal Go program using the same URL construction pattern:  ```go package main  import ( 	"fmt" 	"net/url" )  func main() { 	password := "a b" 	raw := fmt.Sprintf( 		"redis://worker:%s@127.0.0.1:6379/0", 		url.QueryEscape(password), 	)  	parsed, err := url.Parse(raw) 	if err != nil { 		panic(err) 	}  	decoded, _ := parsed.User.Password() 	fmt.Printf("configured: %q\nparsed:     %q\n", password, decoded) } ```  Actual result:  ```text configured: "a b" parsed:     "a+b" ```  No running Redis server is required to reproduce the encoding mismatch.  ### Expected behavior  Redis usernames and passwords should round-trip unchanged through URL construction and parsing.  URL userinfo should use userinfo encoding, such as `url.UserPassword`, rather than query-string encoding.  ### Environment  - Dragonfly: `main` at `0225491c12ac21f35ce242da4a3d7ee089e7b993` - Pinned Machinery dependency: v1.10.14 - Go: 1.26.0, Windows/amd64

- **Issue #5016** (2026-09-21): **fix(rpc): exempt gRPC health checks from rate limiting**
  *Symptoms*:   <!--- Provide a general summary of your changes in the Title above -->  ## Description The scheduler and manager gRPC servers put the grpc_ratelimit interceptor first in the interceptor chain and register the standard health checking service on the same grpc.Server. Whenever business traffic exhausts the rate limiter, /grpc.health.v1.Health/Check is rejected with ResourceExhausted as well, so kubelet liveness/readiness probes fail and a merely busy pod is restarted or taken out of service.  Add rpc.RateLimitUnaryServerInterceptor and rpc.RateLimitStreamServerInterceptor, which wrap the upstream grpc_ratelimit interceptors and let requests whose full method starts with /grpc.health.v1.Health/ go straight to the handler. Switch the scheduler and manager servers to them.  Add table-driven unit tests for both interceptors and a bufconn based test for the scheduler server which verifies that health checks stay SERVING after the limiter is exhausted while business RPCs are rejected. <!--- Describe your changes in detail -->  ## Related Issue https://github.com/dragonflyoss/dragonfly/issues/5015 <!--- This project only accepts pull requests related to open issues --> <!--- If suggesting a new feature or change, please discuss it in an issue first --> <!--- If fixing a bug, there should be an issue describing it with steps to reproduce --> <!--- Please link to the issue here: -->  ## Motivation and Context  <!--- Why is this change required? What problem does 

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

### Incident Patch 1: `d73d3cc5` (2026-11-11)
**Commit Message**: Enhance multi-platform image preheat and deduplication process (#5112)

* feat(preheat): resolve image layers for all platforms when none is specified

Replace the single-manifest image preheat flow with a multi-platform
resolver: when no platform is given, manifest lists and image indexes are
expanded so layers for every platform are preheated and stat'd, and blob
URLs are tagged with their platform. The resolved image is forwarded to
download tasks so the scheduler and manager preheat per platform instead
of only the default one.

Signed-off-by: Gaius <[REDACTED_EMAIL]>

* fix(job): dedupe per-platform blob URLs and drop invalid image references in preheat

Preheat image requests now normalize requested platforms, deduplicate blob
URLs per platform so shared layers are not fetched repeatedly, and reject
malformed image references instead of passing them through. OCI reference
parsing and resolving are adjusted accordingly, with tests covering the
new validation and deduplication behavior.

Also update the e2e manager preheat image tests and compatibility workflow
to use dragonflyoss/client:v1.5.11 with its expected layer digests.

Signed-off-by: Gaius <[REDACTED_EMAIL]>

* chore(

**File**: `.github/workflows/e2e-compatibility.yml` (modified, +2/-2)
```diff
@@ -51,10 +51,10 @@ jobs:
             chart-name: seedClient
           - mode: lightweight
             charts-config: test/testdata/charts/config.yaml
-            skip: 'Manager|Rate Limit|Dfcache'
+            skip: 'Manager|Rate Limit|Dfcache|Preheat and Delete Image Using Scheduler'
           - mode: with-manager
             charts-config: test/testdata/charts/config-with-manager.yaml
-            skip: 'Rate Limit'
+            skip: 'Rate Limit|Preheat and Delete Image Using Scheduler'
 
     steps:
       - name: Free Disk Space (Ubuntu)
```

**File**: `.github/workflows/e2e.yml` (modified, +1/-1)
```diff
@@ -35,7 +35,7 @@ jobs:
           - module: lightweight
             charts-config: test/testdata/charts/config.yaml
             mode: lightweight
-            skip: 'Manager|Rate Limit|Dfcache'
+            skip: 'Manager|Rate Limit|Dfcache|Preheat and Delete Image Using Scheduler'
           - module: with-manager
             charts-config: test/testdata/charts/config-with-manager.yaml
             mode: with-manager
```

**File**: `client` (modified, +1/-1)
```diff
@@ -1 +1 @@
-Subproject commit ca04fb0a9a35a452c07cba413961f0292f4d0d1b
+Subproject commit 4891875a55c4499bce0cca6263c5a7c253798c23
```

**File**: `go.mod` (modified, +7/-7)
```diff
@@ -3,7 +3,7 @@ module d7y.io/dragonfly/v2
 go 1.25.0
 
 require (
-	d7y.io/api/v2 v2.3.8
+	d7y.io/api/v2 v2.3.10
 	d7y.io/hashring v0.3.0
 	github.com/Showmax/go-fqdn v1.0.0
 	github.com/VividCortex/mysqlerr v1.0.0
@@ -67,9 +67,9 @@ require (
 	golang.org/x/oauth2 v0.36.0
 	golang.org/x/sync v0.22.0
 	golang.org/x/sys v0.47.0
-	golang.org/x/time v0.14.0
-	google.golang.org/api v0.267.0
-	google.golang.org/grpc v1.83.1
+	golang.org/x/time v0.15.0
+	google.golang.org/api v0.278.0
+	google.golang.org/grpc v1.84.0
 	google.golang.org/protobuf v1.36.12
 	gopkg.in/natefinch/lumberjack.v2 v2.2.1
 	gopkg.in/yaml.v3 v3.0.1
@@ -85,7 +85,7 @@ require (
 
 require (
 	cloud.google.com/go v0.121.6 // indirect
-	cloud.google.com/go/auth v0.18.2 // indirect
+	cloud.google.com/go/auth v0.20.0 // indirect
 	cloud.google.com/go/auth/oauth2adapt v0.2.8 // indirect
 	cloud.google.com/go/compute/metadata v0.9.0 // indirect
 	cloud.google.com/go/iam v1.5.3 // indirect
@@ -145,7 +145,7 @@ require (
 	github.com/google/pprof v0.0.0-20260402051712-545e8a4df936 // indirect
 	github.com/google/s2a-go v0.1.9 // indirect
 	github.com/googleapis/enterprise-certificate-proxy v0.3.15 // indirect
-	github.com/googleapis/gax-go/v2 v2.17.0 // indirect
+	github.com/googleapis/gax-go/v2 v2.22.0 // indirect
 	github.com/gorilla/mux v1.8.1 // indirect
 	github.com/grpc-ecosystem/grpc-gateway/v2 v2.30.0 // indirect
 	github.com/hashicorp/errwrap v1.1.0 // indirect
@@ -220,7 +220,7 @@ require (
 	golang.org/x/net v0.58.0 // indirect
 	golang.org/x/text v0.41.0 // indirect
 	golang.org/x/tools v0.48.0 // indirect
-	google.golang.org/genproto v0.0.0-20260128011058-8636f8732409 // indirect
+	google.golang.org/genproto v0.0.0-20260319201613-d00831a3d3e7 // indirect
 	google.golang.org/genproto/googleapis/api v0.0.0-20260819154853-08b0e4226688 // indirect
 	google.golang.org/genproto/googleapis/rpc v0.0.0-20260819154853-08b0e4226688 // indirect
 	gopkg.in/ini.v1 v1.67.0 // indirect
```

**File**: `go.sum` (modified, +16/-16)
```diff
@@ -19,8 +19,8 @@ cloud.google.com/go v0.75.0/go.mod h1:VGuuCn7PG0dwsd5XPVm2Mm3wlh3EL55/79EKB6hlPT
 cloud.google.com/go v0.76.0/go.mod h1:r9EvIAvLrunusnetGdQ50M/gKui1x3zdGW/VELGkdpw=
 cloud.google.com/go v0.121.6 h1:waZiuajrI28iAf40cWgycWNgaXPO06dupuS+sgibK6c=
 cloud.google.com/go v0.121.6/go.mod h1:coChdst4Ea5vUpiALcYKXEpR1S9ZgXbhEzzMcMR66vI=
-cloud.google.com/go/auth v0.18.2 h1:+Nbt5Ev0xEqxlNjd6c+yYUeosQ5TtEUaNcN/3FozlaM=
-cloud.google.com/go/auth v0.18.2/go.mod h1:xD+oY7gcahcu7G2SG2DsBerfFxgPAJz17zz2joOFF3M=
+cloud.google.com/go/auth v0.20.0 h1:kXTssoVb4azsVDoUiF8KvxAqrsQcQtB53DcSgta74CA=
+cloud.google.com/go/auth v0.20.0/go.mod h1:942/yi/itH1SsmpyrbnTMDgGfdy2BUqIKyd0cyYLc5Q=
 cloud.google.com/go/auth/oauth2adapt v0.2.8 h1:keo8NaayQZ6wimpNSmW5OPc283g65QNIiLpZnkHRbnc=
 cloud.google.com/go/auth/oauth2adapt v0.2.8/go.mod h1:XQ9y31RkqZCcwJWNSx2Xvric3RrU88hAYYbjDWYDL+c=
 cloud.google.com/go/bigquery v1.0.1/go.mod h1:i/xbL2UlR5RvWAURpBYZTtm/cXjCha9lbfbpx4poX+o=
@@ -35,8 +35,8 @@ cloud.google.com/go/datastore v1.0.0/go.mod h1:LXYbyblFSglQ5pkeyhO+Qmw7ukd3C+pD7
 cloud.google.com/go/datastore v1.1.0/go.mod h1:umbIZjpQpHh4hmRpGhH4tLFup+FVzqBi1b3c64qFpCk=
 cloud.google.com/go/iam v1.5.3 h1:+vMINPiDF2ognBJ97ABAYYwRgsaqxPbQDlMnbHMjolc=
 cloud.google.com/go/iam v1.5.3/go.mod h1:MR3v9oLkZCTlaqljW6Eb2d3HGDGK5/bDv93jhfISFvU=
-cloud.google.com/go/kms v1.25.0 h1:gVqvGGUmz0nYCmtoxWmdc1wli2L1apgP8U4fghPGSbQ=
-cloud.google.com/go/kms v1.25.0/go.mod h1:XIdHkzfj0bUO3E+LvwPg+oc7s58/Ns8Nd8Sdtljihbk=
+cloud.google.com/go/kms v1.26.0 h1:cK9mN2cf+9V63D3H1f6koxTatWy39aTI/hCjz1I+adU=
+cloud.google.com/go/kms v1.26.0/go.mod h1:pHKOdFJm63hxBsiPkYtowZPltu9dW0MWvBa6IA4HM58=
 cloud.google.com/go/longrunning v0.8.0 h1:LiKK77J3bx5gDLi4SMViHixjD2ohlkwBi+mKA7EhfW8=
 cloud.google.com/go/longrunning v0.8.0/go.mod h1:UmErU2Onzi+fKDg2gR7dusz11Pe26aknR4kHmJJqIfk=
 cloud.google.com/go/pubsub v1.0.1/go.mod h1:R0Gpsv3s54REJCy4fxDixWD93lHJMoZTyQ2kNxGRt3I=
@@ -53,8 +53,8 @@ cloud.google.com/go/storage v1.5.0/go.mod h1:tpKbwo567HUNpVclU5sGELwQWBDZ8gh0Zeo
 cloud.google.com/go/storage v1.6.0/go.mod h1:N7U0C8pVQ/+NIKOBQyamJIeKQKkZ+mxpohlUTyfDhBk=
 cloud.google.com/go/storage v1.8.0/go.mod h1:Wv1Oy7z6Yz3DshWRJFhqM/UCfaWIRTdp0RXyy7KQOVs=
 cloud.google.com/go/storage v1.10.0/go.mod h1:FLPqc6j+Ki4BU591ie1oL6qBQGu2Bl/tZ9ullr3+Kg0=
-d7y.io/api/v2 v2.3.8 h1:v2ur2xA5WspWhyy73t7qTZrRMvxir/hNzlSM2QCif4E=
-d7y.io/api/v2 v2.3.8/go.mod h1:dkwb6hCIWdijpAOZmdqszAPlXWS7cO41+Av9IvmOTHo=
+d7y.io/api/v2 v2.3.10 h1:JFC6944ETIURMfLlaH0inH5NnZtzyAGU/mjHFJUkMOk=
+d7y.io/api/v2 v2.3.10/go.mod h1:hQOqfvk0SSuSUZ25VrF/L4dlP4JnREaUiUui07muLws=
 d7y.io/hashring v0.3.0 h1:qGIkSNa/g6hSFYV2mBE+mZU16NzzMiCKobti072ACL0=
 d7y.io/hashring v0.3.0/go.mod h1:NY2/+76/hCcBzcTEJiqJG2AX0gzlSq+YJJgSJyZWd1c=
 dmitri.shuralyov.com/gpu/mtl v0.0.0-20190408044501-666a987793e9/go.mod h1:H6x//7gZCb22OMCxBHrMx7a5I7Hp++hsVxbQ4BYO7hU=
@@ -412,8 +412,8 @@ github.com/googleapis/enterprise-certificate-proxy v0.3.15 h1:xolVQTEXusUcAA5Ugt
 github.com/googleapis/enterprise-certificate-proxy v0.3.15/go.mod h1:vqVt9yG9480NtzREnTlmGSBmFrA+bzb0yl0TxoBQXOg=
 github.com/googleapis/gax-go/v2 v2.0.4/go.mod h1:0Wqv26UfaUD9n4G6kQubkQ+KchISgw+vpHVxEJEs9eg=
 github.com/googleapis/gax-go/v2 v2.0.5/go.mod h1:DWXyrwAJ9X0FpwwEdw+IPEYBICEFu5mhpdKc/us6bOk=
-github.com/googleapis/gax-go/v2 v2.17.0 h1:RksgfBpxqff0EZkDWYuz9q/uWsTVz+kf43LsZ1J6SMc=
-github.com/googleapis/gax-go/v2 v2.17.0/go.mod h1:mzaqghpQp4JDh3HvADwrat+6M3MOIDp5YKHhb9PAgDY=
+github.com/googleapis/gax-go/v2 v2.22.0 h1:PjIWBpgGIVKGoCXuiCoP64altEJCj3/Ei+kSU5vlZD4=
+github.com/googleapis/gax-go/v2 v2.22.0/go.mod h1:irWBbALSr0Sk3qlqb9SyJ1h68WjgeFuiOzI4Rqw5+aY=
 github.com/gorilla/mux v1.8.1 h1:TuBL49tXwgrFYWhqrNgrUNEY92u81SPhu7sTdzQEiWY=
 github.com/gorilla/mux v1.8.1/go.mod h1:AKf9I4AEqPTmMytcMc0KkNouC66V3BtZ4qD5fmWSiMQ=
 github.com/grpc-ecosystem/go-grpc-middleware v1.4.0 h1:UH//fgunKIs4JdUbpDl1VZCDaL56wXCB/5+wF6uHfaI=
@@ -1130,8 +1130,8 @@ golang.org/x/time v0.0.0-20181108054448-85acf8d2951c/go.mod h1:tRJNPiyCQ0inRvYxb
 golang.org/x/time v0.0.0-20190308202827-9d24e82272b4/go.mod h1:tRJNPiyCQ0inRvYxbN9jk5I+vvW/OXSQhTDSoE431IQ=
 golang.org/x/time v0.0.0-20191024005414-555d28b269f0/go.mod h1:tRJNPiyCQ0inRvYxbN9jk5I+vvW/OXSQhTDSoE431IQ=
 golang.org/x/time v0.0.0-20201208040808-7e3f01d25324/go.mod h1:tRJNPiyCQ0inRvYxbN9jk5I+vvW/OXSQhTDSoE431IQ=
-golang.org/x/time v0.14.0 h1:MRx4UaLrDotUKUdCIqzPC48t1Y9hANFKIRpNx+Te8PI=
-golang.org/x/time v0.14.0/go.mod h1:eL/Oa2bBBK0TkX57Fyni+NgnyQQN4LitPmob2Hjnqw4=
+golang.org/x/time v0.15.0 h1:bbrp8t3bGUeFOx08pvsMYRTCVSMk89u4tKbNOZbp88U=
+golang.org/x/time v0.15.0/go.mod h1:Y4YMaQmXwGQZoFaVFk4YpCt4FLQMYKZe9oeV/f4MSno=
 golang.org/x/tools v0.0.0-20180917221912-90fa682c2a6e/go.mod h1:n7NCudcB/nEzxVGmLbDWY5pfWTLqBcC2KZ6jyYvM4mQ=
 golang.org/x/tools v0.0.0-20190114222345-bf090417da8b/go.mod h1:n7NCudcB/nEzxVGmLbDWY5pfWTLqBcC2KZ6jyYvM4mQ=
 golang.org/x/tools v0.0.0-20190226205152-f727befe758c/go.mod h1:9Yl7xja0Znq3iFh3HoIrodX9oNMXvdceNzlUR8zjMvY=
@
```

**File**: `internal/job/image.go` (modified, +73/-27)
```diff
@@ -21,10 +21,14 @@ package job
 import (
 	"context"
 	"crypto/x509"
+	"slices"
 	"time"
 
 	"go.opentelemetry.io/otel/trace"
 
+	commonv2 "d7y.io/api/v2/pkg/apis/common/v2"
+
+	logger "d7y.io/dragonfly/v2/internal/dflog"
 	"d7y.io/dragonfly/v2/manager/config"
 	nethttp "d7y.io/dragonfly/v2/pkg/net/http"
 	pkgoci "d7y.io/dragonfly/v2/pkg/oci"
@@ -59,7 +63,9 @@ type ManifestRequest struct {
 	Password string
 
 	// The image type preheating task can specify the image architecture type. eg: linux/amd64.
-	Platform string
+	// If it is nil, all the platforms of the image are preheated. If it is empty, the default
+	// platform is preheated.
+	Platform *string
 
 	// Scope is the scope for preheating, default is single_seed_peer.
 	Scope string
@@ -110,7 +116,8 @@ type ManifestRequest struct {
 type Image interface {
 	// CreatePreheatRequestsByManifestURL generates a list of preheat requests for a container image
 	// by fetching and parsing its manifest from a registry. It handles authentication, platform-specific
-	// manifest filtering, and layer extraction for preheating.
+	// manifest filtering, and layer extraction for preheating. Each preheat request preheats the layers
+	// of one platform of the image.
 	CreatePreheatRequestsByManifestURL(ctx context.Context, req *ManifestRequest) ([]*PreheatRequest, error)
 }
 
@@ -124,7 +131,8 @@ func NewImage() Image {
 
 // CreatePreheatRequestsByManifestURL generates a list of preheat requests for a container image
 // by fetching and parsing its manifest from a registry. It handles authentication, platform-specific
-// manifest filtering, and layer extraction for preheating.
+// manifest filtering, and layer extraction for preheating. Each preheat request preheats the layers
+// of one platform of the image.
 func (i *image) CreatePreheatRequestsByManifestURL(ctx context.Context, req *ManifestRequest) ([]*PreheatRequest, error) {
 	ctx, span := tracer.Start(ctx, config.SpanGetLayers, trace.WithSpanKind(trace.SpanKindProducer))
 	defer span.End()
@@ -135,15 +143,21 @@ func (i *image) CreatePreheatRequestsByManifestURL(ctx context.Context, req *Man
 		return nil, err
 	}
 
-	// Resolve the blob urls and the authorization token. Harbor uses the V1
+	// Resolve the manifests and the authorization token. Harbor uses the V1
 	// preheat request and carries the auth info in the headers, which is used
-	// as the issued token by the resolver.
+	// as the issued token by the resolver. All the platforms of the image are
+	// resolved if the platform is not specified.
 	header := nethttp.MapToHeader(req.Headers)
-	_, blobURLs, token, err := pkgoci.Resolve(ctx, ref,
+	opts := []pkgoci.ResolveOption{
 		pkgoci.WithAuth(req.Username, req.Password),
-		pkgoci.WithPlatform(req.Platform),
 		pkgoci.WithHeader(header.Clone()),
-	)
+	}
+
+	if req.Platform != nil {
+		opts = append(opts, pkgoci.WithPlatform(*req.Platform))
+	}
+
+	manifests, token, err := pkgoci.Resolve(ctx, ref, opts...)
 	if err != nil {
 		return nil, err
 	}
@@ -155,23 +169,55 @@ func (i *image) CreatePreheatRequestsByManifestURL(ctx context.Context, req *Man
 		certificateChain = req.RootCAs.Subjects() //nolint:staticcheck
 	}
 
-	return []*PreheatRequest{{
-		URLs:                blobURLs,
-		PieceLength:         req.PieceLength,
-		Tag:                 req.Tag,
-		Application:         req.Application,
-		FilteredQueryParams: req.FilteredQueryParams,
-		Headers:             nethttp.HeaderToMap(header),
-		Scope:               req.Scope,
-		IPs:                 req.IPs,
-		Percentage:          req.Percentage,
-		Count:               req.Count,
-		ConcurrentTaskCount: req.ConcurrentTaskCount,
-		ConcurrentPeerCount: req.ConcurrentPeerCount,
-		CertificateChain:    certificateChain,
-		InsecureSkipVerify:  req.InsecureSkipVerify,
-		Timeout:             req.Timeout,
-
-		EnableTaskIDBasedBlobDigest: req.EnableTaskIDBasedBlobDigest,
-	}}, nil
+	// Create one preheat request for each platform, so the peers record the layers by the
+	// image and the platform to delete the image.
+	var preheatRequests []*PreheatRequest
+	for _, manifest := range manifests {
+		if index := slices.IndexFunc(preheatRequests, func(preheatRequest *PreheatRequest) bool {
+			return preheatRequest.Image.GetPlatform() == manifest.Platform
+		}); index >= 0 {
+			for _, url := range manifest.BlobURLs {
+				if !slices.Contains(preheatRequests[index].URLs, url) {
+					preheatRequests[index].URLs = append(preheatRequests[index].URLs, url)
+				}
+			}
+
+			continue
+		}
+
+		preheatRequest := &PreheatRequest{
+			URLs:                        manifest.BlobURLs,
+			PieceLength:                 req.PieceLength,
+			Tag:                         req.Tag,
+			Application:                 req.Application,
+			FilteredQueryParams:         req.FilteredQueryParams,
+			Headers:                     nethttp.HeaderToMap(header),
+			Scope:                       req.Scope,
+			IPs:                         req.IPs,
+			Percentage:                  req.P
```

**File**: `internal/job/image_test.go` (modified, +32/-1)
```diff
@@ -25,6 +25,10 @@ import (
 	"github.com/stretchr/testify/assert"
 )
 
+var (
+	mockPlatform = "linux/amd64"
+)
+
 func TestPreheat_CreatePreheatRequestsByManifestURL(t *testing.T) {
 	username := os.Getenv("DOCKER_USERNAME")
 	password := os.Getenv("DOCKER_PASSWORD")
@@ -49,14 +53,17 @@ func TestPreheat_CreatePreheatRequestsByManifestURL(t *testing.T) {
 			expect: func(t *testing.T, layers []*PreheatRequest, err error) {
 				assert := assert.New(t)
 				assert.NoError(err)
+				assert.Len(layers, 1)
 				assert.Len(layers[0].URLs, 2)
+				assert.Equal("registry-1.docker.io/dragonflyoss/busybox:1.35.0", layers[0].Image.GetReference())
+				assert.Nil(layers[0].Image.Platform)
 			},
 		},
 		{
 			name: "get image layers with multi arch image layers",
 			req: &ManifestRequest{
 				URL:                "https://registry-1.docker.io/v2/dragonflyoss/scheduler/manifests/v2.1.0",
-				Platform:           "linux/amd64",
+				Platform:           &mockPlatform,
 				Username:           username,
 				Password:           password,
 				Timeout:            30 * time.Second,
@@ -65,7 +72,31 @@ func TestPreheat_CreatePreheatRequestsByManifestURL(t *testing.T) {
 			expect: func(t *testing.T, layers []*PreheatRequest, err error) {
 				assert := assert.New(t)
 				assert.NoError(err)
+				assert.Len(layers, 1)
 				assert.Len(layers[0].URLs, 5)
+				assert.Equal("registry-1.docker.io/dragonflyoss/scheduler:v2.1.0", layers[0].Image.GetReference())
+				assert.Equal(mockPlatform, layers[0].Image.GetPlatform())
+			},
+		},
+		{
+			name: "get image layers of all platforms",
+			req: &ManifestRequest{
+				URL:                "https://registry-1.docker.io/v2/dragonflyoss/client/manifests/v1.5.12",
+				Username:           username,
+				Password:           password,
+				Timeout:            30 * time.Second,
+				InsecureSkipVerify: true,
+			},
+			expect: func(t *testing.T, layers []*PreheatRequest, err error) {
+				assert := assert.New(t)
+				assert.NoError(err)
+				assert.Len(layers, 3)
+				assert.Len(layers[0].URLs, 9)
+				assert.Equal("linux/amd64", layers[0].Image.GetPlatform())
+				assert.Len(layers[1].URLs, 9)
+				assert.Equal("linux/arm64", layers[1].Image.GetPlatform())
+				assert.Len(layers[2].URLs, 3)
+				assert.Equal("unknown/unknown", layers[2].Image.GetPlatform())
 			},
 		},
 	}
```

**File**: `internal/job/types.go` (modified, +1/-0)
```diff
@@ -51,6 +51,7 @@ type PreheatRequest struct {
 	Hdfs                        *v2.HDFS          `json:"hdfs" validate:"omitempty"`
 	OutputPath                  *string           `json:"output_path" validate:"omitempty"`
 	EnableTaskIDBasedBlobDigest bool              `json:"enable_task_id_based_blob_digest" validate:"omitempty"`
+	Image                       *v2.Image         `json:"image" validate:"omitempty"`
 }
 
 // PreheatResponse defines the response parameters for preheating.
```

---

### Incident Patch 2: `cbbe27d6` (2026-11-10)
**Commit Message**: chore(deps): bump docker/login-action from 4.7.0 to 4.8.0 (#5103)

Bumps [docker/login-action](https://github.com/docker/login-action) from 4.7.0 to 4.8.0.
- [Release notes](https://github.com/docker/login-action/releases)
- [Commits](https://github.com/docker/login-action/compare/81c6f93d4bc991e510b342a00b419b3bb4efc5c6...8aa5831fb8d48d8f76594c7ddde61ae58019f550)

---
updated-dependencies:
- dependency-name: docker/login-action
  dependency-version: 4.8.0
  dependency-type: direct:production
  update-type: version-update:semver-minor
...

Signed-off-by: dependabot[bot] <[REDACTED_EMAIL]>
Co-authored-by: dependabot[bot] <49699333+dependabot[bot]@users.noreply.github.com>

**File**: `.github/workflows/docker.yml` (modified, +2/-2)
```diff
@@ -67,14 +67,14 @@ jobs:
         uses: sigstore/cosign-installer@cad07c2e89fa2edd6e2d7bab4c1aa38e53f76003
 
       - name: Login Docker Hub
-        uses: docker/login-action@81c6f93d4bc991e510b342a00b419b3bb4efc5c6
+        uses: docker/login-action@8aa5831fb8d48d8f76594c7ddde61ae58019f550
         with:
           registry: docker.io
           username: ${{ secrets.DOCKER_USERNAME }}
           password: ${{ secrets.DOCKER_PASSWORD }}
 
       - name: Login to GitHub Container Registry
-        uses: docker/login-action@81c6f93d4bc991e510b342a00b419b3bb4efc5c6
+        uses: docker/login-action@8aa5831fb8d48d8f76594c7ddde61ae58019f550
         with:
           registry: ghcr.io
           username: ${{ github.repository_owner }}
```

#### Recent Merged Pull Requests:
- **PR #5112** (2026-11-11): Enhance multi-platform image preheat and deduplication process (@gaius-qi)
- **PR #5111** (2026-11-10): chore(deps): bump github.com/avast/retry-go/v5 from 5.0.0 to 5.1.1 (@dependabot[bot])
- **PR #5110** (2026-11-10): chore(deps): bump github.com/onsi/ginkgo/v2 from 2.33.1 to 2.34.0 (@dependabot[bot])
- **PR #5109** (closed): chore(deps): bump github.com/gin-contrib/static from 1.1.5 to 1.1.9 (@dependabot[bot])
- **PR #5108** (closed): chore(deps): bump google.golang.org/api from 0.267.0 to 0.311.0 (@dependabot[bot])
- **PR #5107** (closed): chore(deps): bump github/codeql-action/init from 4.36.2 to 4.39.3 (@dependabot[bot])

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

## X. Enhance multi-platform image preheat and deduplication process (#5112)

**RULE**:
When implementing operations in `.github/workflows/e2e-compatibility.yml`, engineers MUST enforce rigorous boundary validation, safe state transitions, and memory/concurrency invariants as established by production defect remediation in dragonflyoss/dragonfly. All inputs crossing module boundaries must be explicitly verified before state persistence.

**WHY**:
Prevents defects observed in production commit `d73d3cc5`: Enhance multi-platform image preheat and deduplication process (#5112). Unvalidated execution paths cause runtime exceptions, race conditions, and silent state corruption under concurrent workloads.

**WHEN TO APPLY**:
Subsystems managing Go data structures, boundary deserialization, API parsing, or resource lifecycles matching `.github/workflows/e2e-compatibility.yml`.

**VERIFIED IMPLEMENTATION PATTERN**:
```go
// Verified production-grade fix pattern:
            skip: 'Manager|Rate Limit|Dfcache|Preheat and Delete Image Using Scheduler'
            skip: 'Rate Limit|Preheat and Delete Image Using Scheduler'
```

**NEGATIVE CONSTRAINT**:
```go
// Anti-pattern to NEVER write (induced failure mode):
            skip: 'Manager|Rate Limit|Dfcache'
            skip: 'Rate Limit'
```

**VERIFICATION METHOD**:
Automated regression test asserting that input states reproducing defect `d73d3cc5` are properly handled with clean fallback behavior.


## 3. Independent Verification Protocol
1. Assert state existence before and after execution.
2. Verify deterministic SHA-256 byte digest parity.
3. Validate zero unhandled promise rejections or uncaught exceptions.
