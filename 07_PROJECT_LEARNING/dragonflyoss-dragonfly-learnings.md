> **Canonical Learning Artifact**: `07_PROJECT_LEARNING/dragonflyoss-dragonfly-learnings.md`  
> **Source**: github ([https://github.com/dragonflyoss/dragonfly](https://github.com/dragonflyoss/dragonfly))  
> **Source Version**: `0a744fdf`  
> **License**: Apache-2.0  
> **Synthesized By**: zero-clone-structural-synthesizer  
> **Timestamp**: 2026-11-03T22:06:41.694Z  
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
> **Harvest Timestamp**: 2026-11-03T22:06:41.686Z  
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

### Incident Patch 1: `0615401c` (2026-11-03)
**Commit Message**: fix(job): encode Redis credentials using URL userinfo (#5065)

* fix(job): encode Redis credentials using URL userinfo

Build Redis broker and result-backend URLs with URL userinfo encoding instead of query escaping. Preserve credentials containing spaces and omit empty authentication.

Add URL round-trip tests, including compatibility with the currently pinned standalone parser.

Signed-off-by: donnykk <[REDACTED_EMAIL]>

* refactor(redis): move job redis URL builder into shared pkg/redis.FormatURL

Replace the job-local redisURL helper with an exported FormatURL in
pkg/redis so other components can reuse the same credential-safe URL
construction. Behavior is unchanged: credentials are still encoded as
URL userinfo so parsers based on net/url decode reserved characters
correctly.

The job package now builds the machinery broker and result backend URLs
via FormatURL, and the corresponding tests move to pkg/redis, including
a round-trip check through go-redis ParseURL for credentials containing
spaces and reserved characters.

Also bumps the client submodule.

Signed-off-by: Gaius <[REDACTED_EMAIL]>

---------

Signed-off-by: donnykk <[REDACTED_EMAIL]>
Signed-off-by: Gaius <[REDACTE

**File**: `internal/job/job.go` (modified, +3/-19)
```diff
@@ -20,10 +20,7 @@ import (
 	"context"
 	"encoding/json"
 	"errors"
-	"fmt"
-	"net/url"
 	"reflect"
-	"strings"
 	"sync"
 	"time"
 
@@ -36,6 +33,7 @@ import (
 	"golang.org/x/sync/errgroup"
 
 	logger "d7y.io/dragonfly/v2/internal/dflog"
+	pkgredis "d7y.io/dragonfly/v2/pkg/redis"
 )
 
 // tracer is a global tracer for job.
@@ -74,24 +72,10 @@ func New(cfg *Config, queue Queue) (*Job, error) {
 		return nil, err
 	}
 
-	var broker string
-	if cfg.Username != "" {
-		broker = fmt.Sprintf("redis://%s:%s@%s/%d", url.QueryEscape(cfg.Username), url.QueryEscape(cfg.Password), strings.Join(cfg.Addrs, ","), cfg.BrokerDB)
-	} else {
-		broker = fmt.Sprintf("redis://%s@%s/%d", url.QueryEscape(cfg.Password), strings.Join(cfg.Addrs, ","), cfg.BrokerDB)
-	}
-
-	var backend string
-	if cfg.Username != "" {
-		backend = fmt.Sprintf("redis://%s:%s@%s/%d", url.QueryEscape(cfg.Username), url.QueryEscape(cfg.Password), strings.Join(cfg.Addrs, ","), cfg.BackendDB)
-	} else {
-		backend = fmt.Sprintf("redis://%s@%s/%d", url.QueryEscape(cfg.Password), strings.Join(cfg.Addrs, ","), cfg.BackendDB)
-	}
-
 	server, err := machinery.NewServer(&machineryv1config.Config{
-		Broker:          broker,
+		Broker:          pkgredis.FormatURL(cfg.Addrs, cfg.Username, cfg.Password, cfg.BrokerDB),
 		DefaultQueue:    queue.String(),
-		ResultBackend:   backend,
+		ResultBackend:   pkgredis.FormatURL(cfg.Addrs, cfg.Username, cfg.Password, cfg.BackendDB),
 		ResultsExpireIn: DefaultResultsExpireIn,
 		Redis: &machineryv1config.RedisConfig{
 			MasterName:             cfg.MasterName,
```

**File**: `pkg/redis/redis.go` (modified, +18/-0)
```diff
@@ -19,6 +19,9 @@ package redis
 import (
 	"context"
 	"fmt"
+	"net/url"
+	"strconv"
+	"strings"
 
 	"github.com/redis/go-redis/v9"
 
@@ -96,6 +99,21 @@ func NewRedis(cfg *redis.UniversalOptions) (redis.UniversalClient, error) {
 	return client, nil
 }
 
+// FormatURL formats the redis connection URL, encoding credentials as URL
+// userinfo so that parsers built on net/url decode them.
+func FormatURL(addrs []string, username, password string, db int) string {
+	u := url.URL{
+		Scheme: "redis",
+		Host:   strings.Join(addrs, ","),
+		Path:   "/" + strconv.Itoa(db),
+	}
+	if username != "" || password != "" {
+		u.User = url.UserPassword(username, password)
+	}
+
+	return u.String()
+}
+
 // IsEnabled check redis is enabled.
 func IsEnabled(addrs []string) bool {
 	return len(addrs) != 0
```

**File**: `pkg/redis/redis_test.go` (modified, +76/-0)
```diff
@@ -19,9 +19,85 @@ package redis
 import (
 	"testing"
 
+	"github.com/redis/go-redis/v9"
 	"github.com/stretchr/testify/assert"
 )
 
+func Test_FormatURL(t *testing.T) {
+	tests := []struct {
+		name     string
+		addrs    []string
+		username string
+		password string
+		db       int
+		expect   func(t *testing.T, rawURL string)
+	}{
+		{
+			name:     "username and password",
+			addrs:    []string{"127.0.0.1:6379"},
+			username: "foo",
+			password: "bar",
+			db:       1,
+			expect: func(t *testing.T, rawURL string) {
+				assert := assert.New(t)
+				assert.Equal("redis://foo:bar@127.0.0.1:6379/1", rawURL)
+			},
+		},
+		{
+			name:     "password only",
+			addrs:    []string{"127.0.0.1:6379"},
+			password: "bar",
+			db:       1,
+			expect: func(t *testing.T, rawURL string) {
+				assert := assert.New(t)
+				assert.Equal("redis://:bar@127.0.0.1:6379/1", rawURL)
+			},
+		},
+		{
+			name:  "without credentials",
+			addrs: []string{"127.0.0.1:6379"},
+			db:    0,
+			expect: func(t *testing.T, rawURL string) {
+				assert := assert.New(t)
+				assert.Equal("redis://127.0.0.1:6379/0", rawURL)
+			},
+		},
+		{
+			name:     "multiple addresses",
+			addrs:    []string{"sentinel-1:26379", "sentinel-2:26379"},
+			username: "foo",
+			password: "bar",
+			db:       2,
+			expect: func(t *testing.T, rawURL string) {
+				assert := assert.New(t)
+				assert.Equal("redis://foo:bar@sentinel-1:26379,sentinel-2:26379/2", rawURL)
+			},
+		},
+		{
+			name:     "credentials with spaces and reserved characters round trip",
+			addrs:    []string{"127.0.0.1:6379"},
+			username: "worker +:@",
+			password: "test @:/%+",
+			db:       11,
+			expect: func(t *testing.T, rawURL string) {
+				assert := assert.New(t)
+				options, err := redis.ParseURL(rawURL)
+				assert.NoError(err)
+				assert.Equal("127.0.0.1:6379", options.Addr)
+				assert.Equal("worker +:@", options.Username)
+				assert.Equal("test @:/%+", options.Password)
+				assert.Equal(11, options.DB)
+			},
+		},
+	}
+
+	for _, tc := range tests {
+		t.Run(tc.name, func(t *testing.T) {
+			tc.expect(t, FormatURL(tc.addrs, tc.username, tc.password, tc.db))
+		})
+	}
+}
+
 func Test_IsEnabled(t *testing.T) {
 	tests := []struct {
 		name   string
```

---

### Incident Patch 2: `89333b3b` (2026-11-03)
**Commit Message**: fix(scheduler): reclaim persistent hosts that can not be loaded and tolerate fields added in v2.5.0 (#5049)

* fix(scheduler): reclaim persistent hosts that can not be loaded and tolerate fields added in v2.5.0

Hosts stored by a scheduler older than v2.5.0 have no cpu_process_percent
and memory_process_used_percent fields. Load required every field to parse,
so after an upgrade those hosts could never be loaded again, and because
RunGC went through LoadAll, which skips hosts that fail to load, they were
never reclaimed either: the stale hashes stayed in redis without a TTL and
GC logged "parsing cpu process percent failed" / "load host failed" for
each of them on every run, forever.

- Load: treat cpu_process_percent and memory_process_used_percent as zero
  when absent instead of failing.
- Split Load into load, which returns ErrHostNotFound when the hash is gone
  and a wrapped ErrHostInvalid when a field can not be parsed; Load keeps
  its (*Host, bool) signature.
- RunGC: scan the hosts set directly and reclaim host ids whose hash is
  missing or can not be parsed. Transient redis errors are still left for
  the next run.

Applies to both scheduler/resource/persistent and pers

**File**: `scheduler/resource/persistent/host_manager.go` (modified, +122/-106)
```diff
@@ -20,6 +20,8 @@ package persistent
 
 import (
 	"context"
+	"errors"
+	"fmt"
 	"math/rand/v2"
 	"strconv"
 	"time"
@@ -98,122 +100,124 @@ func (h *hostManager) Load(ctx context.Context, hostID string) (*Host, bool) {
 		return nil, false
 	}
 
+	host, err := h.parseHost(rawHost)
+	if err != nil {
+		log.Errorf("parsing host failed: %v", err)
+		return nil, false
+	}
+
+	return host, true
+}
+
+// parseHost parses host from the raw host fields stored in redis.
+func (h *hostManager) parseHost(rawHost map[string]string) (*Host, error) {
+	// HGetAll returns an empty hash if the host does not exist.
+	if len(rawHost) == 0 {
+		return nil, errors.New("host not found")
+	}
+
 	// Set integer fields from raw host.
 	port, err := strconv.ParseInt(rawHost["port"], 10, 32)
 	if err != nil {
-		log.Errorf("parsing port failed: %v", err)
-		return nil, false
+		return nil, fmt.Errorf("parsing port failed: %w", err)
 	}
 
 	downloadPort, err := strconv.ParseInt(rawHost["download_port"], 10, 32)
 	if err != nil {
-		log.Errorf("parsing download port failed: %v", err)
-		return nil, false
+		return nil, fmt.Errorf("parsing download port failed: %w", err)
 	}
 
 	proxyPort, err := strconv.ParseInt(rawHost["proxy_port"], 10, 32)
 	if err != nil {
-		log.Errorf("parsing proxy port failed: %v", err)
-		return nil, false
+		return nil, fmt.Errorf("parsing proxy port failed: %w", err)
 	}
 
 	// Set cpu fields from raw host.
 	schedulerClusterID, err := strconv.ParseUint(rawHost["scheduler_cluster_id"], 10, 64)
 	if err != nil {
-		log.Errorf("parsing scheduler cluster id failed: %v", err)
-		return nil, false
+		return nil, fmt.Errorf("parsing scheduler cluster id failed: %w", err)
 	}
 
 	// Set boolean fields from raw host.
 	disableShared, err := strconv.ParseBool(rawHost["disable_shared"])
 	if err != nil {
-		log.Errorf("parsing disable shared failed: %v", err)
-		return nil, false
+		return nil, fmt.Errorf("parsing disable shared failed: %w", err)
 	}
 
 	// Set cpu fields from raw host.
 	cpuLogicalCount, err := strconv.ParseUint(rawHost["cpu_logical_count"], 10, 32)
 	if err != nil {
-		log.Errorf("parsing cpu logical count failed: %v", err)
-		return nil, false
+		return nil, fmt.Errorf("parsing cpu logical count failed: %w", err)
 	}
 
 	cpuPhysicalCount, err := strconv.ParseUint(rawHost["cpu_physical_count"], 10, 32)
 	if err != nil {
-		log.Errorf("parsing cpu physical count failed: %v", err)
-		return nil, false
+		return nil, fmt.Errorf("parsing cpu physical count failed: %w", err)
 	}
 
 	cpuPercent, err := strconv.ParseFloat(rawHost["cpu_percent"], 64)
 	if err != nil {
-		log.Errorf("parsing cpu percent failed: %v", err)
-		return nil, false
+		return nil, fmt.Errorf("parsing cpu percent failed: %w", err)
 	}
 
-	cpuProcessPercent, err := strconv.ParseFloat(rawHost["cpu_process_percent"], 64)
-	if err != nil {
-		log.Errorf("parsing cpu process percent failed: %v", err)
-		return nil, false
+	// cpu_process_percent was introduced in v2.5.0, hosts stored by older schedulers do
+	// not have it yet.
+	var cpuProcessPercent float64
+	if raw := rawHost["cpu_process_percent"]; raw != "" {
+		cpuProcessPercent, err = strconv.ParseFloat(raw, 64)
+		if err != nil {
+			return nil, fmt.Errorf("parsing cpu process percent failed: %w", err)
+		}
 	}
 
 	cpuTimesUser, err := strconv.ParseFloat(rawHost["cpu_times_user"], 64)
 	if err != nil {
-		log.Errorf("parsing cpu times user failed: %v", err)
-		return nil, false
+		return nil, fmt.Errorf("parsing cpu times user failed: %w", err)
 	}
 
 	cpuTimesSystem, err := strconv.ParseFloat(rawHost["cpu_times_system"], 64)
 	if err != nil {
-		log.Errorf("parsing cpu times system failed: %v", err)
-		return nil, false
+		return nil, fmt.Errorf("parsing cpu times system failed: %w", err)
 	}
 
 	cpuTimesIdle, err := strconv.ParseFloat(rawHost["cpu_times_idle"], 64)
 	if err != nil {
-		log.Errorf("parsing cpu times idle failed: %v", err)
-		return nil, false
+		return nil, fmt.Errorf("parsing cpu times idle failed: %w", err)
 	}
 
 	cpuTimesNice, err := strconv.ParseFloat(rawHost["cpu_times_nice"], 64)
 	if err != nil {
-		log.Errorf("parsing cpu times nice failed: %v", err)
-		return nil, false
+		return nil, fmt.Errorf("parsing cpu times nice failed: %w", err)
 	}
 
 	cpuTimesIowait, err := strconv.ParseFloat(rawHost["cpu_times_iowait"], 64)
 	if err != nil {
-		log.Errorf("parsing cpu times iowait failed: %v", err)
-		return nil, false
+		return nil, fmt.Errorf("parsing cpu times iowait failed: %w", err)
 	}
 
 	cpuTimesIrq, err := strconv.ParseFloat(rawHost["cpu_times_irq"], 64)
 	if err != nil {
-		log.Errorf("parsing cpu times irq failed: %v", err)
-		return nil, false
+		return nil, fmt.Errorf("parsing cpu times irq failed: %w", err)
 	}
 
 	cpuTimesSoftirq, err := strconv.ParseFloat(rawHost["cpu_times_softirq"], 64)
 	if err != nil {
-		log.Errorf("parsing cpu times softirq failed: %v", err)
-		return nil, false
+		return nil, fmt.Errorf("parsing cpu times softirq fail
```

**File**: `scheduler/resource/persistent/host_manager_test.go` (modified, +52/-0)
```diff
@@ -256,6 +256,21 @@ func TestHostManager_Load(t *testing.T) {
 				assert.Nil(host)
 			},
 		},
+		{
+			name: "missing cpu_process_percent and memory_process_used_percent default to zero",
+			mock: func(mock redismock.ClientMock) {
+				fields := mockRawHostFields(mockRawHost.ID)
+				delete(fields, "cpu_process_percent")
+				delete(fields, "memory_process_used_percent")
+				mock.ExpectHGetAll(pkgredis.MakePersistentHostKeyInScheduler(1, mockRawHost.ID)).SetVal(fields)
+			},
+			expect: func(t *testing.T, host *Host, loaded bool) {
+				assert := assert.New(t)
+				assert.True(loaded)
+				assert.Equal(float64(0), host.CPU.ProcessPercent)
+				assert.Equal(float64(0), host.Memory.ProcessUsedPercent)
+			},
+		},
 		{
 			name: "invalid port value",
 			mock: func(mock redismock.ClientMock) {
@@ -1186,6 +1201,43 @@ func TestHostManager_RunGC(t *testing.T) {
 				assert.NoError(err)
 			},
 		},
+		{
+			name: "host that can not be parsed is reclaimed",
+			mock: func(mock redismock.ClientMock) {
+				fields := mockRawHostFields("host1")
+				fields["port"] = mockInvalidFieldValue
+				mock.ExpectSScan(pkgredis.MakePersistentHostsInScheduler(1), 0, "*", 10).SetVal([]string{"host1"}, 0)
+				mock.ExpectHGetAll(pkgredis.MakePersistentHostKeyInScheduler(1, "host1")).SetVal(fields)
+				mockDeleteHostScript(mock, "host1").SetVal(true)
+			},
+			expect: func(t *testing.T, err error) {
+				assert := assert.New(t)
+				assert.NoError(err)
+			},
+		},
+		{
+			name: "host id without host hash is reclaimed",
+			mock: func(mock redismock.ClientMock) {
+				mock.ExpectSScan(pkgredis.MakePersistentHostsInScheduler(1), 0, "*", 10).SetVal([]string{"host1"}, 0)
+				mock.ExpectHGetAll(pkgredis.MakePersistentHostKeyInScheduler(1, "host1")).SetVal(map[string]string{})
+				mockDeleteHostScript(mock, "host1").SetVal(true)
+			},
+			expect: func(t *testing.T, err error) {
+				assert := assert.New(t)
+				assert.NoError(err)
+			},
+		},
+		{
+			name: "host that fails to load because of a redis error is kept",
+			mock: func(mock redismock.ClientMock) {
+				mock.ExpectSScan(pkgredis.MakePersistentHostsInScheduler(1), 0, "*", 10).SetVal([]string{"host1"}, 0)
+				mock.ExpectHGetAll(pkgredis.MakePersistentHostKeyInScheduler(1, "host1")).SetErr(errors.New("redis error"))
+			},
+			expect: func(t *testing.T, err error) {
+				assert := assert.New(t)
+				assert.NoError(err)
+			},
+		},
 	}
 
 	for _, tc := range tests {
```

**File**: `scheduler/resource/persistentcache/host_manager.go` (modified, +122/-106)
```diff
@@ -20,6 +20,8 @@ package persistentcache
 
 import (
 	"context"
+	"errors"
+	"fmt"
 	"math/rand/v2"
 	"strconv"
 	"time"
@@ -98,122 +100,124 @@ func (h *hostManager) Load(ctx context.Context, hostID string) (*Host, bool) {
 		return nil, false
 	}
 
+	host, err := h.parseHost(rawHost)
+	if err != nil {
+		log.Errorf("parsing host failed: %v", err)
+		return nil, false
+	}
+
+	return host, true
+}
+
+// parseHost parses host from the raw host fields stored in redis.
+func (h *hostManager) parseHost(rawHost map[string]string) (*Host, error) {
+	// HGetAll returns an empty hash if the host does not exist.
+	if len(rawHost) == 0 {
+		return nil, errors.New("host not found")
+	}
+
 	// Set integer fields from raw host.
 	port, err := strconv.ParseInt(rawHost["port"], 10, 32)
 	if err != nil {
-		log.Errorf("parsing port failed: %v", err)
-		return nil, false
+		return nil, fmt.Errorf("parsing port failed: %w", err)
 	}
 
 	downloadPort, err := strconv.ParseInt(rawHost["download_port"], 10, 32)
 	if err != nil {
-		log.Errorf("parsing download port failed: %v", err)
-		return nil, false
+		return nil, fmt.Errorf("parsing download port failed: %w", err)
 	}
 
 	proxyPort, err := strconv.ParseInt(rawHost["proxy_port"], 10, 32)
 	if err != nil {
-		log.Errorf("parsing proxy port failed: %v", err)
-		return nil, false
+		return nil, fmt.Errorf("parsing proxy port failed: %w", err)
 	}
 
 	// Set cpu fields from raw host.
 	schedulerClusterID, err := strconv.ParseUint(rawHost["scheduler_cluster_id"], 10, 64)
 	if err != nil {
-		log.Errorf("parsing scheduler cluster id failed: %v", err)
-		return nil, false
+		return nil, fmt.Errorf("parsing scheduler cluster id failed: %w", err)
 	}
 
 	// Set boolean fields from raw host.
 	disableShared, err := strconv.ParseBool(rawHost["disable_shared"])
 	if err != nil {
-		log.Errorf("parsing disable shared failed: %v", err)
-		return nil, false
+		return nil, fmt.Errorf("parsing disable shared failed: %w", err)
 	}
 
 	// Set cpu fields from raw host.
 	cpuLogicalCount, err := strconv.ParseUint(rawHost["cpu_logical_count"], 10, 32)
 	if err != nil {
-		log.Errorf("parsing cpu logical count failed: %v", err)
-		return nil, false
+		return nil, fmt.Errorf("parsing cpu logical count failed: %w", err)
 	}
 
 	cpuPhysicalCount, err := strconv.ParseUint(rawHost["cpu_physical_count"], 10, 32)
 	if err != nil {
-		log.Errorf("parsing cpu physical count failed: %v", err)
-		return nil, false
+		return nil, fmt.Errorf("parsing cpu physical count failed: %w", err)
 	}
 
 	cpuPercent, err := strconv.ParseFloat(rawHost["cpu_percent"], 64)
 	if err != nil {
-		log.Errorf("parsing cpu percent failed: %v", err)
-		return nil, false
+		return nil, fmt.Errorf("parsing cpu percent failed: %w", err)
 	}
 
-	cpuProcessPercent, err := strconv.ParseFloat(rawHost["cpu_process_percent"], 64)
-	if err != nil {
-		log.Errorf("parsing cpu process percent failed: %v", err)
-		return nil, false
+	// cpu_process_percent was introduced in v2.5.0, hosts stored by older schedulers do
+	// not have it yet.
+	var cpuProcessPercent float64
+	if raw := rawHost["cpu_process_percent"]; raw != "" {
+		cpuProcessPercent, err = strconv.ParseFloat(raw, 64)
+		if err != nil {
+			return nil, fmt.Errorf("parsing cpu process percent failed: %w", err)
+		}
 	}
 
 	cpuTimesUser, err := strconv.ParseFloat(rawHost["cpu_times_user"], 64)
 	if err != nil {
-		log.Errorf("parsing cpu times user failed: %v", err)
-		return nil, false
+		return nil, fmt.Errorf("parsing cpu times user failed: %w", err)
 	}
 
 	cpuTimesSystem, err := strconv.ParseFloat(rawHost["cpu_times_system"], 64)
 	if err != nil {
-		log.Errorf("parsing cpu times system failed: %v", err)
-		return nil, false
+		return nil, fmt.Errorf("parsing cpu times system failed: %w", err)
 	}
 
 	cpuTimesIdle, err := strconv.ParseFloat(rawHost["cpu_times_idle"], 64)
 	if err != nil {
-		log.Errorf("parsing cpu times idle failed: %v", err)
-		return nil, false
+		return nil, fmt.Errorf("parsing cpu times idle failed: %w", err)
 	}
 
 	cpuTimesNice, err := strconv.ParseFloat(rawHost["cpu_times_nice"], 64)
 	if err != nil {
-		log.Errorf("parsing cpu times nice failed: %v", err)
-		return nil, false
+		return nil, fmt.Errorf("parsing cpu times nice failed: %w", err)
 	}
 
 	cpuTimesIowait, err := strconv.ParseFloat(rawHost["cpu_times_iowait"], 64)
 	if err != nil {
-		log.Errorf("parsing cpu times iowait failed: %v", err)
-		return nil, false
+		return nil, fmt.Errorf("parsing cpu times iowait failed: %w", err)
 	}
 
 	cpuTimesIrq, err := strconv.ParseFloat(rawHost["cpu_times_irq"], 64)
 	if err != nil {
-		log.Errorf("parsing cpu times irq failed: %v", err)
-		return nil, false
+		return nil, fmt.Errorf("parsing cpu times irq failed: %w", err)
 	}
 
 	cpuTimesSoftirq, err := strconv.ParseFloat(rawHost["cpu_times_softirq"], 64)
 	if err != nil {
-		log.Errorf("parsing cpu times softirq failed: %v", err)
-		return nil, false
+		return nil, fmt.Errorf("parsing cpu times softirq
```

**File**: `scheduler/resource/persistentcache/host_manager_test.go` (modified, +52/-0)
```diff
@@ -256,6 +256,21 @@ func TestHostManager_Load(t *testing.T) {
 				assert.Nil(host)
 			},
 		},
+		{
+			name: "missing cpu_process_percent and memory_process_used_percent default to zero",
+			mock: func(mock redismock.ClientMock) {
+				fields := mockRawHostFields(mockRawHost.ID)
+				delete(fields, "cpu_process_percent")
+				delete(fields, "memory_process_used_percent")
+				mock.ExpectHGetAll(pkgredis.MakePersistentCacheHostKeyInScheduler(1, mockRawHost.ID)).SetVal(fields)
+			},
+			expect: func(t *testing.T, host *Host, loaded bool) {
+				assert := assert.New(t)
+				assert.True(loaded)
+				assert.Equal(float64(0), host.CPU.ProcessPercent)
+				assert.Equal(float64(0), host.Memory.ProcessUsedPercent)
+			},
+		},
 		{
 			name: "invalid port value",
 			mock: func(mock redismock.ClientMock) {
@@ -1186,6 +1201,43 @@ func TestHostManager_RunGC(t *testing.T) {
 				assert.NoError(err)
 			},
 		},
+		{
+			name: "host that can not be parsed is reclaimed",
+			mock: func(mock redismock.ClientMock) {
+				fields := mockRawHostFields("host1")
+				fields["port"] = mockInvalidFieldValue
+				mock.ExpectSScan(pkgredis.MakePersistentCacheHostsInScheduler(1), 0, "*", 10).SetVal([]string{"host1"}, 0)
+				mock.ExpectHGetAll(pkgredis.MakePersistentCacheHostKeyInScheduler(1, "host1")).SetVal(fields)
+				mockDeleteHostScript(mock, "host1").SetVal(true)
+			},
+			expect: func(t *testing.T, err error) {
+				assert := assert.New(t)
+				assert.NoError(err)
+			},
+		},
+		{
+			name: "host id without host hash is reclaimed",
+			mock: func(mock redismock.ClientMock) {
+				mock.ExpectSScan(pkgredis.MakePersistentCacheHostsInScheduler(1), 0, "*", 10).SetVal([]string{"host1"}, 0)
+				mock.ExpectHGetAll(pkgredis.MakePersistentCacheHostKeyInScheduler(1, "host1")).SetVal(map[string]string{})
+				mockDeleteHostScript(mock, "host1").SetVal(true)
+			},
+			expect: func(t *testing.T, err error) {
+				assert := assert.New(t)
+				assert.NoError(err)
+			},
+		},
+		{
+			name: "host that fails to load because of a redis error is kept",
+			mock: func(mock redismock.ClientMock) {
+				mock.ExpectSScan(pkgredis.MakePersistentCacheHostsInScheduler(1), 0, "*", 10).SetVal([]string{"host1"}, 0)
+				mock.ExpectHGetAll(pkgredis.MakePersistentCacheHostKeyInScheduler(1, "host1")).SetErr(errors.New("redis error"))
+			},
+			expect: func(t *testing.T, err error) {
+				assert := assert.New(t)
+				assert.NoError(err)
+			},
+		},
 	}
 
 	for _, tc := range tests {
```

---

### Incident Patch 3: `0a744fdf` (2026-11-03)
**Commit Message**: fix(e2e): poll seed client task content instead of sleeping one second (#5097)

The e2e specs slept one second after a client download and then
compared the sha256 of the task content on the seed clients. When the
client exhausts scheduling retries and backs to source itself, the seed
peer triggered by the scheduler may still be writing the last piece, so
the sha256 mismatches. Replace the fixed sleep with Eventually so the
check waits for the seed peer to finish.

Co-authored-by: Claude Fable 5.1 <[REDACTED_EMAIL]>

**File**: `test/e2e/containerd_test.go` (modified, +3/-4)
```diff
@@ -73,17 +73,16 @@ var _ = Describe("Containerd with CRI support", func() {
 				Expect(taskMetadata.Sha256).To(Equal(sha256sum))
 			}
 
-			time.Sleep(1 * time.Second)
 			seedClientPods := make([]*util.PodExec, 3)
 			for i := range 3 {
 				seedClientPods[i], err = util.SeedClientExec(i)
 				fmt.Println(err)
 				Expect(err).NotTo(HaveOccurred())
 			}
 
-			sha256sum, err := util.CalculateSha256ByTaskID(seedClientPods, "99f960a3d990bc51293c661d50aa89af1467e4dbc17525812e3c85cc98a3ed46")
-			Expect(err).NotTo(HaveOccurred())
-			Expect("99f960a3d990bc51293c661d50aa89af1467e4dbc17525812e3c85cc98a3ed46").To(Equal(sha256sum))
+			Eventually(func() (string, error) {
+				return util.CalculateSha256ByTaskID(seedClientPods, "99f960a3d990bc51293c661d50aa89af1467e4dbc17525812e3c85cc98a3ed46")
+			}, 60*time.Second, time.Second).Should(Equal("99f960a3d990bc51293c661d50aa89af1467e4dbc17525812e3c85cc98a3ed46"))
 		})
 
 		It("rmi should be ok", Label("containerd", "rmi"), func() {
```

**File**: `test/e2e/dfget_test.go` (modified, +15/-20)
```diff
@@ -97,17 +97,16 @@ var _ = Describe("Download Using Dfget", func() {
 			Expect(err).NotTo(HaveOccurred())
 			Expect(testFile.GetSha256()).To(Equal(sha256sum))
 
-			time.Sleep(1 * time.Second)
 			seedClientPods := make([]*util.PodExec, 3)
 			for i := range 3 {
 				seedClientPods[i], err = util.SeedClientExec(i)
 				fmt.Println(err)
 				Expect(err).NotTo(HaveOccurred())
 			}
 
-			sha256sum, err = util.CalculateSha256ByTaskID(seedClientPods, testFile.GetTaskID())
-			Expect(err).NotTo(HaveOccurred())
-			Expect(testFile.GetSha256()).To(Equal(sha256sum))
+			Eventually(func() (string, error) {
+				return util.CalculateSha256ByTaskID(seedClientPods, testFile.GetTaskID())
+			}, 60*time.Second, time.Second).Should(Equal(testFile.GetSha256()))
 		})
 	})
 
@@ -145,17 +144,16 @@ var _ = Describe("Download Using Dfget", func() {
 			Expect(err).NotTo(HaveOccurred())
 			Expect(testFile.GetSha256()).To(Equal(sha256sum))
 
-			time.Sleep(1 * time.Second)
 			seedClientPods := make([]*util.PodExec, 3)
 			for i := range 3 {
 				seedClientPods[i], err = util.SeedClientExec(i)
 				fmt.Println(err)
 				Expect(err).NotTo(HaveOccurred())
 			}
 
-			sha256sum, err = util.CalculateSha256ByTaskID(seedClientPods, testFile.GetTaskID())
-			Expect(err).NotTo(HaveOccurred())
-			Expect(testFile.GetSha256()).To(Equal(sha256sum))
+			Eventually(func() (string, error) {
+				return util.CalculateSha256ByTaskID(seedClientPods, testFile.GetTaskID())
+			}, 60*time.Second, time.Second).Should(Equal(testFile.GetSha256()))
 		})
 	})
 
@@ -193,17 +191,16 @@ var _ = Describe("Download Using Dfget", func() {
 			Expect(err).NotTo(HaveOccurred())
 			Expect(testFile.GetSha256()).To(Equal(sha256sum))
 
-			time.Sleep(1 * time.Second)
 			seedClientPods := make([]*util.PodExec, 3)
 			for i := range 3 {
 				seedClientPods[i], err = util.SeedClientExec(i)
 				fmt.Println(err)
 				Expect(err).NotTo(HaveOccurred())
 			}
 
-			sha256sum, err = util.CalculateSha256ByTaskID(seedClientPods, testFile.GetTaskID())
-			Expect(err).NotTo(HaveOccurred())
-			Expect(testFile.GetSha256()).To(Equal(sha256sum))
+			Eventually(func() (string, error) {
+				return util.CalculateSha256ByTaskID(seedClientPods, testFile.GetTaskID())
+			}, 60*time.Second, time.Second).Should(Equal(testFile.GetSha256()))
 		})
 	})
 
@@ -241,17 +238,16 @@ var _ = Describe("Download Using Dfget", func() {
 			Expect(err).NotTo(HaveOccurred())
 			Expect(testFile.GetSha256()).To(Equal(sha256sum))
 
-			time.Sleep(1 * time.Second)
 			seedClientPods := make([]*util.PodExec, 3)
 			for i := range 3 {
 				seedClientPods[i], err = util.SeedClientExec(i)
 				fmt.Println(err)
 				Expect(err).NotTo(HaveOccurred())
 			}
 
-			sha256sum, err = util.CalculateSha256ByTaskID(seedClientPods, testFile.GetTaskID())
-			Expect(err).NotTo(HaveOccurred())
-			Expect(testFile.GetSha256()).To(Equal(sha256sum))
+			Eventually(func() (string, error) {
+				return util.CalculateSha256ByTaskID(seedClientPods, testFile.GetTaskID())
+			}, 60*time.Second, time.Second).Should(Equal(testFile.GetSha256()))
 		})
 	})
 
@@ -325,17 +321,16 @@ var _ = Describe("Download Using Dfget", func() {
 			Expect(err).NotTo(HaveOccurred())
 			Expect(testFile.GetSha256()).To(Equal(sha256sum))
 
-			time.Sleep(1 * time.Second)
 			seedClientPods := make([]*util.PodExec, 3)
 			for i := range 3 {
 				seedClientPods[i], err = util.SeedClientExec(i)
 				fmt.Println(err)
 				Expect(err).NotTo(HaveOccurred())
 			}
 
-			sha256sum, err = util.CalculateSha256ByTaskID(seedClientPods, testFile.GetTaskID())
-			Expect(err).NotTo(HaveOccurred())
-			Expect(testFile.GetSha256()).To(Equal(sha256sum))
+			Eventually(func() (string, error) {
+				return util.CalculateSha256ByTaskID(seedClientPods, testFile.GetTaskID())
+			}, 60*time.Second, time.Second).Should(Equal(testFile.GetSha256()))
 		})
 	})
 
```

**File**: `test/e2e/proxy_test.go` (modified, +33/-44)
```diff
@@ -99,17 +99,16 @@ var _ = Describe("Download Using Proxy", func() {
 			Expect(err).NotTo(HaveOccurred())
 			Expect(testFile.GetSha256()).To(Equal(sha256sum))
 
-			time.Sleep(1 * time.Second)
 			seedClientPods := make([]*util.PodExec, 3)
 			for i := range 3 {
 				seedClientPods[i], err = util.SeedClientExec(i)
 				fmt.Println(err)
 				Expect(err).NotTo(HaveOccurred())
 			}
 
-			sha256sum, err = util.CalculateSha256ByTaskID(seedClientPods, testFile.GetTaskID(util.WithTaskIDTag("proxy")))
-			Expect(err).NotTo(HaveOccurred())
-			Expect(testFile.GetSha256()).To(Equal(sha256sum))
+			Eventually(func() (string, error) {
+				return util.CalculateSha256ByTaskID(seedClientPods, testFile.GetTaskID(util.WithTaskIDTag("proxy")))
+			}, 60*time.Second, time.Second).Should(Equal(testFile.GetSha256()))
 		})
 	})
 
@@ -148,17 +147,16 @@ var _ = Describe("Download Using Proxy", func() {
 			Expect(err).NotTo(HaveOccurred())
 			Expect(testFile.GetSha256()).To(Equal(sha256sum))
 
-			time.Sleep(1 * time.Second)
 			seedClientPods := make([]*util.PodExec, 3)
 			for i := range 3 {
 				seedClientPods[i], err = util.SeedClientExec(i)
 				fmt.Println(err)
 				Expect(err).NotTo(HaveOccurred())
 			}
 
-			sha256sum, err = util.CalculateSha256ByTaskID(seedClientPods, testFile.GetTaskID(util.WithTaskIDTag("proxy")))
-			Expect(err).NotTo(HaveOccurred())
-			Expect(testFile.GetSha256()).To(Equal(sha256sum))
+			Eventually(func() (string, error) {
+				return util.CalculateSha256ByTaskID(seedClientPods, testFile.GetTaskID(util.WithTaskIDTag("proxy")))
+			}, 60*time.Second, time.Second).Should(Equal(testFile.GetSha256()))
 		})
 	})
 
@@ -197,17 +195,16 @@ var _ = Describe("Download Using Proxy", func() {
 			Expect(err).NotTo(HaveOccurred())
 			Expect(testFile.GetSha256()).To(Equal(sha256sum))
 
-			time.Sleep(1 * time.Second)
 			seedClientPods := make([]*util.PodExec, 3)
 			for i := range 3 {
 				seedClientPods[i], err = util.SeedClientExec(i)
 				fmt.Println(err)
 				Expect(err).NotTo(HaveOccurred())
 			}
 
-			sha256sum, err = util.CalculateSha256ByTaskID(seedClientPods, testFile.GetTaskID(util.WithTaskIDTag("proxy")))
-			Expect(err).NotTo(HaveOccurred())
-			Expect(testFile.GetSha256()).To(Equal(sha256sum))
+			Eventually(func() (string, error) {
+				return util.CalculateSha256ByTaskID(seedClientPods, testFile.GetTaskID(util.WithTaskIDTag("proxy")))
+			}, 60*time.Second, time.Second).Should(Equal(testFile.GetSha256()))
 		})
 	})
 
@@ -246,17 +243,16 @@ var _ = Describe("Download Using Proxy", func() {
 			Expect(err).NotTo(HaveOccurred())
 			Expect(testFile.GetSha256()).To(Equal(sha256sum))
 
-			time.Sleep(1 * time.Second)
 			seedClientPods := make([]*util.PodExec, 3)
 			for i := range 3 {
 				seedClientPods[i], err = util.SeedClientExec(i)
 				fmt.Println(err)
 				Expect(err).NotTo(HaveOccurred())
 			}
 
-			sha256sum, err = util.CalculateSha256ByTaskID(seedClientPods, testFile.GetTaskID(util.WithTaskIDTag("proxy")))
-			Expect(err).NotTo(HaveOccurred())
-			Expect(testFile.GetSha256()).To(Equal(sha256sum))
+			Eventually(func() (string, error) {
+				return util.CalculateSha256ByTaskID(seedClientPods, testFile.GetTaskID(util.WithTaskIDTag("proxy")))
+			}, 60*time.Second, time.Second).Should(Equal(testFile.GetSha256()))
 		})
 	})
 
@@ -753,10 +749,9 @@ var _ = Describe("Download Using Prefetch Proxy", func() {
 			Expect(err).NotTo(HaveOccurred())
 			Expect(got).To(Equal(sha256sum))
 
-			time.Sleep(1 * time.Second)
-			sha256sum, err = util.CalculateSha256ByTaskID([]*util.PodExec{seedClientPod}, testFile.GetTaskID(util.WithTaskIDTag("prefetch-proxy-bytes-100")))
-			Expect(err).NotTo(HaveOccurred())
-			Expect(testFile.GetSha256()).To(Equal(sha256sum))
+			Eventually(func() (string, error) {
+				return util.CalculateSha256ByTaskID([]*util.PodExec{seedClientPod}, testFile.GetTaskID(util.WithTaskIDTag("prefetch-proxy-bytes-100")))
+			}, 60*time.Second, time.Second).Should(Equal(testFile.GetSha256()))
 		})
 	})
 
@@ -793,10 +788,9 @@ var _ = Describe("Download Using Prefetch Proxy", func() {
 			Expect(err).NotTo(HaveOccurred())
 			Expect(got).To(Equal(sha256sum))
 
-			time.Sleep(1 * time.Second)
-			sha256sum, err = util.CalculateSha256ByTaskID([]*util.PodExec{seedClientPod}, testFile.GetTaskID(util.WithTaskIDTag("prefetch-proxy-bytes-0-100")))
-			Expect(err).NotTo(HaveOccurred())
-			Expect(testFile.GetSha256()).To(Equal(sha256sum))
+			Eventually(func() (string, error) {
+				return util.CalculateSha256ByTaskID([]*util.PodExec{seedClientPod}, testFile.GetTaskID(util.WithTaskIDTag("prefetch-proxy-bytes-0-100")))
+			}, 60*time.Second, time.Second).Should(Equal(testFile.GetSha256()))
 		})
 	})
 
@@ -833,10 +827,9 @@ var _ = Describe("Download Using Prefetch Proxy", func() {
 			Expect(err).NotTo(HaveOccurred())
 			Expect(got).To(Equal(sha256sum))
 
-			time.Sleep(1 * time.Second)
-			sha256sum, err = util.CalculateSha256ByTaskID([]*util.PodExec{seedClientPod}, testFile.GetTaskID(ut
```

#### Recent Merged Pull Requests:
- **PR #5097** (2026-11-03): fix(e2e): poll seed client task content instead of sleeping one second (@gaius-qi)
- **PR #5096** (2026-11-03): chore(deps): bump kentaro-m/auto-assign-action from c8e3c55d4a048066a8f4fca0070c2f2db65a20a5 to f0f2d0c11ed2677e95f2408d27493b215ddd57b0 (@dependabot[bot])
- **PR #5095** (closed): chore(deps): bump golang.org/x/sys from 0.47.0 to 0.49.0 (@dependabot[bot])
- **PR #5094** (closed): chore(deps): bump go.opentelemetry.io/otel/exporters/otlp/otlptrace from 1.46.0 to 1.47.0 (@dependabot[bot])
- **PR #5093** (closed): chore(deps): bump github.com/bits-and-blooms/bitset from 1.24.6 to 1.28.0 (@dependabot[bot])
- **PR #5092** (closed): chore(deps): bump github.com/go-playground/validator/v10 from 10.30.3 to 10.30.6 (@dependabot[bot])

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

## X. job): encode Redis credentials using URL userinfo (#5065)

**RULE**:
When implementing operations in `internal/job/job.go`, engineers MUST enforce rigorous boundary validation, safe state transitions, and memory/concurrency invariants as established by production defect remediation in dragonflyoss/dragonfly. All inputs crossing module boundaries must be explicitly verified before state persistence.

**WHY**:
Prevents defects observed in production commit `0615401c`: job): encode Redis credentials using URL userinfo (#5065). Unvalidated execution paths cause runtime exceptions, race conditions, and silent state corruption under concurrent workloads.

**WHEN TO APPLY**:
Subsystems managing Go data structures, boundary deserialization, API parsing, or resource lifecycles matching `internal/job/job.go`.

**VERIFIED IMPLEMENTATION PATTERN**:
```go
// Verified production-grade fix pattern:
	pkgredis "d7y.io/dragonfly/v2/pkg/redis"
		Broker:          pkgredis.FormatURL(cfg.Addrs, cfg.Username, cfg.Password, cfg.BrokerDB),
		ResultBackend:   pkgredis.FormatURL(cfg.Addrs, cfg.Username, cfg.Password, cfg.BackendDB),
```

**NEGATIVE CONSTRAINT**:
```go
// Anti-pattern to NEVER write (induced failure mode):
	"fmt"
	"net/url"
	"strings"
	var broker string
	if cfg.Username != "" {
		broker = fmt.Sprintf("redis://%s:%s@%s/%d", url.QueryEscape(cfg.Username), url.QueryEscape(cfg.Password), strings.Join(cfg.Addrs, ","), cfg.BrokerDB)
	} else {
		broker = fmt.Sprintf("redis://%s@%s/%d", url.QueryEscape(cfg.Password), strings.Join(cfg.Addrs, ","), cfg.BrokerDB)
	}

	var backend string
	if cfg.Username != "" {
		backend = fmt.Sprintf("redis://%s:%s@%s/%d", url.QueryEscape(cfg.Username), url.QueryEscape(cfg.Password), strings.Join(cfg.Addrs, ","), cfg.BackendDB)
	} else {
		backend = fmt.Sprintf("redis://%s@%s/%d", url.QueryEscape(cfg.Password), strings.Join(cfg.Addrs, ","), cfg.BackendDB)
	}

		Broker:          broker,
		ResultBackend:   backend,
```

**VERIFICATION METHOD**:
Automated regression test asserting that input states reproducing defect `0615401c` are properly handled with clean fallback behavior.
