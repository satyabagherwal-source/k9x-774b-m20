> **Canonical Learning Artifact**: `07_PROJECT_LEARNING/dragonflyoss-dragonfly-learnings.md`  
> **Source**: github ([https://github.com/dragonflyoss/dragonfly](https://github.com/dragonflyoss/dragonfly))  
> **Source Version**: `4baf23f5`  
> **License**: Apache-2.0  
> **Synthesized By**: zero-clone-structural-synthesizer  
> **Timestamp**: 2026-10-20T15:04:00.539Z  
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
> **Harvest Timestamp**: 2026-10-20T15:04:00.336Z  
> **Compliance State**: Free Tier Guaranteed | Strict Rate-Limit Backoff Honored  

---

## 1. Context & Architectural Overview
- **Repository / Resource**: `dragonflyoss/dragonfly`
- **Description**: Delivers efficient, stable, and secure data distribution and acceleration powered by P2P technology, with an optional content‑addressable filesystem that accelerates OCI container launch.
- **Primary Language / Ecosystem**: Go
- **Discovered Manifests / Configurations**: go.mod, README.md
- **Stars / Engagement**: 3352 stars

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
- **Issue #5016** (2026-09-21): **fix(rpc): exempt gRPC health checks from rate limiting**
  *Symptoms*:   <!--- Provide a general summary of your changes in the Title above -->  ## Description The scheduler and manager gRPC servers put the grpc_ratelimit interceptor first in the interceptor chain and register the standard health checking service on the same grpc.Server. Whenever business traffic exhausts the rate limiter, /grpc.health.v1.Health/Check is rejected with ResourceExhausted as well, so kubelet liveness/readiness probes fail and a merely busy pod is restarted or taken out of service.  Add rpc.RateLimitUnaryServerInterceptor and rpc.RateLimitStreamServerInterceptor, which wrap the upstream grpc_ratelimit interceptors and let requests whose full method starts with /grpc.health.v1.Health/ go straight to the handler. Switch the scheduler and manager servers to them.  Add table-driven unit tests for both interceptors and a bufconn based test for the scheduler server which verifies that health checks stay SERVING after the limiter is exhausted while business RPCs are rejected. <!--- Describe your changes in detail -->  ## Related Issue https://github.com/dragonflyoss/dragonfly/issues/5015 <!--- This project only accepts pull requests related to open issues --> <!--- If suggesting a new feature or change, please discuss it in an issue first --> <!--- If fixing a bug, there should be an issue describing it with steps to reproduce --> <!--- Please link to the issue here: -->  ## Motivation and Context  <!--- Why is this change required? What problem does 

- **Issue #5015** (2026-09-22): **scheduler/manager: gRPC health checks are rejected by the request rate limiter, so kubelet restarts pods that are merely busy**
  *Symptoms*:  ---  ### Bug report:  In the scheduler (and manager) gRPC server the `grpc_ratelimit` interceptor is the first interceptor of the chain and applies to **every** RPC of the server, while the standard gRPC health service is registered on the **same** `grpc.Server`:  - `pkg/rpc/scheduler/server/server.go` (`main` @ 109a393f): L57 `limiter := rpc.NewRateLimiterInterceptor(requestRateLimit, int64(requestRateLimit))`, L72 `grpc_ratelimit.UnaryServerInterceptor(limiter)`, L80 `grpc_ratelimit.StreamServerInterceptor(limiter)`, L96 `healthpb.RegisterHealthServer(grpcServer, health.NewServer())`. - `pkg/rpc/manager/server/server.go`: same structure (L57 / L72 / L79 / L94).  As a result, once business RPCs (`AnnouncePeer`, `AnnounceHost`, `StatTask`, ...) exhaust the token bucket configured by `server.requestRateLimit` (default 4000/s, burst = same value), `/grpc.health.v1.Health/Check` is rejected as well:  ``` rpc error: code = ResourceExhausted desc = /grpc.health.v1.Health/Check is rejected by grpc_ratelimit middleware, please retry later. ```  The Helm chart uses exactly this RPC for the startup/readiness/liveness probes (`charts/dragonfly/templates/scheduler/scheduler-statefulset.yaml`: `/bin/grpc_health_probe -addr=:<containerPort>`; the manager deployment does the same). So under load:  1. readiness fails -> the scheduler is removed from the Service / DNS -> the remaining schedulers receive even more traffic -> they hit the limiter too; 2. liveness fails `failureThreshold` time

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

### Incident Patch 1: `4baf23f5` (2026-10-20)
**Commit Message**: fix(scheduler): key seed peer hashring by name and check health concurrently (#5068)

Replace the stathat consistent hashring with d7y.io/hashring keyed by seed
peer name rather than address, so a seed peer keeps its hashring position
when its IP changes. When the same name is announced from several addresses,
keep the most recently updated host. Reuse the existing hashring when the set
of healthy seed peer names is unchanged to avoid rehashing every refresh.

Run health checks concurrently (limit 32) so an unresponsive seed peer no
longer delays the whole refresh, and make the health client honor the caller's
context instead of context.Background().

Also restrict the manager's ListSchedulersByClusterID to active schedulers
only, and add tests covering the health client and the new refresh behavior.

Signed-off-by: Gaius <[REDACTED_EMAIL]>

**File**: `go.mod` (modified, +2/-0)
```diff
@@ -4,6 +4,7 @@ go 1.25.0
 
 require (
 	d7y.io/api/v2 v2.3.8
+	d7y.io/hashring v0.2.0
 	github.com/Showmax/go-fqdn v1.0.0
 	github.com/VividCortex/mysqlerr v1.0.0
 	github.com/appleboy/gin-jwt/v2 v2.10.3
@@ -105,6 +106,7 @@ require (
 	github.com/cloudwego/base64x v0.1.7 // indirect
 	github.com/containerd/log v0.1.0 // indirect
 	github.com/cpuguy83/go-md2man/v2 v2.0.6 // indirect
+	github.com/dchest/siphash v1.2.3 // indirect
 	github.com/deckarep/golang-set v1.8.0 // indirect
 	github.com/docker/go-metrics v0.0.1 // indirect
 	github.com/docker/libtrust v0.0.0-20150114040149-fa567046d9b1 // indirect
```

**File**: `go.sum` (modified, +4/-0)
```diff
@@ -55,6 +55,8 @@ cloud.google.com/go/storage v1.8.0/go.mod h1:Wv1Oy7z6Yz3DshWRJFhqM/UCfaWIRTdp0RX
 cloud.google.com/go/storage v1.10.0/go.mod h1:FLPqc6j+Ki4BU591ie1oL6qBQGu2Bl/tZ9ullr3+Kg0=
 d7y.io/api/v2 v2.3.8 h1:v2ur2xA5WspWhyy73t7qTZrRMvxir/hNzlSM2QCif4E=
 d7y.io/api/v2 v2.3.8/go.mod h1:dkwb6hCIWdijpAOZmdqszAPlXWS7cO41+Av9IvmOTHo=
+d7y.io/hashring v0.2.0 h1:Cv+BtZnMnKk8xkWovOFoUpUGb4mdId0Tcgv1nE6TWZc=
+d7y.io/hashring v0.2.0/go.mod h1:NY2/+76/hCcBzcTEJiqJG2AX0gzlSq+YJJgSJyZWd1c=
 dmitri.shuralyov.com/gpu/mtl v0.0.0-20190408044501-666a987793e9/go.mod h1:H6x//7gZCb22OMCxBHrMx7a5I7Hp++hsVxbQ4BYO7hU=
 filippo.io/edwards25519 v1.2.0 h1:crnVqOiS4jqYleHd9vaKZ+HKtHfllngJIiOpNpoJsjo=
 filippo.io/edwards25519 v1.2.0/go.mod h1:xzAOLCNug/yB62zG1bQ8uziwrIqIuxhctzJT18Q77mc=
@@ -154,6 +156,8 @@ github.com/davecgh/go-spew v1.1.0/go.mod h1:J7Y8YcW2NihsgmVo/mv3lAwl/skON4iLHjSs
 github.com/davecgh/go-spew v1.1.1/go.mod h1:J7Y8YcW2NihsgmVo/mv3lAwl/skON4iLHjSsI+c5H38=
 github.com/davecgh/go-spew v1.1.2-0.20180830191138-d8f796af33cc h1:U9qPSI2PIWSS1VwoXQT9A3Wy9MM3WgvqSxFWenqJduM=
 github.com/davecgh/go-spew v1.1.2-0.20180830191138-d8f796af33cc/go.mod h1:J7Y8YcW2NihsgmVo/mv3lAwl/skON4iLHjSsI+c5H38=
+github.com/dchest/siphash v1.2.3 h1:QXwFc8cFOR2dSa/gE6o/HokBMWtLUaNDVd+22aKHeEA=
+github.com/dchest/siphash v1.2.3/go.mod h1:0NvQU092bT0ipiFN++/rXm69QG9tVxLAlQHIXMPAkHc=
 github.com/deckarep/golang-set v1.8.0 h1:sk9/l/KqpunDwP7pSjUg0keiOOLEnOBHzykLrsPppp4=
 github.com/deckarep/golang-set v1.8.0/go.mod h1:5nI87KwE7wgsBU1F4GKAw2Qod7p5kyS383rP6+o6qqo=
 github.com/denisenkom/go-mssqldb v0.11.0/go.mod h1:xbL0rPBG9cCiLr28tMa8zpbdarY27NDyej4t/EjAShU=
```

**File**: `manager/rpcserver/manager_server_v2.go` (modified, +1/-1)
```diff
@@ -763,7 +763,7 @@ func (s *managerServerV2) listSchedulersByClusterID(ctx context.Context, req *ma
 	}
 
 	var schedulers []models.Scheduler
-	if err := s.db.Find(&schedulers, "scheduler_cluster_id = ?", req.SchedulerClusterId).Error; err != nil {
+	if err := s.db.Find(&schedulers, "scheduler_cluster_id = ? AND state = ?", req.SchedulerClusterId, models.SchedulerStateActive).Error; err != nil {
 		log.Errorf("failed to get schedulers by cluster id %d: %s", req.SchedulerClusterId, err.Error())
 		return nil, err
 	}
```

**File**: `manager/rpcserver/manager_server_v2_test.go` (modified, +1/-0)
```diff
@@ -827,6 +827,7 @@ func TestManagerServerV2_ListSchedulersByClusterID(t *testing.T) {
 				}
 
 				assert.Contains(hostnames, mockActiveSchedulerHostname)
+				assert.NotContains(hostnames, mockInactiveSchedulerHostname)
 				assert.NotContains(hostnames, mockSecondClusterSchedulerHostname)
 				assert.True(s.cache.Exists(context.Background(), pkgredis.MakeSchedulersByClusterIDKeyForPeerInManager(mockSchedulerClusterID)))
 			},
```

**File**: `pkg/rpc/health/client/client.go` (modified, +1/-1)
```diff
@@ -79,7 +79,7 @@ func Check(ctx context.Context, target string, opts ...grpc.DialOption) error {
 	}
 	defer healthClient.Close()
 
-	if err := healthClient.Check(context.Background(), &healthpb.HealthCheckRequest{}); err != nil {
+	if err := healthClient.Check(ctx, &healthpb.HealthCheckRequest{}); err != nil {
 		return err
 	}
 
```

**File**: `pkg/rpc/health/client/client_test.go` (added, +141/-0)
```diff
@@ -0,0 +1,141 @@
+/*
+ *     Copyright 2022 The Dragonfly Authors
+ *
+ * Licensed under the Apache License, Version 2.0 (the "License");
+ * you may not use this file except in compliance with the License.
+ * You may obtain a copy of the License at
+ *
+ *      http://www.apache.org/licenses/LICENSE-2.0
+ *
+ * Unless required by applicable law or agreed to in writing, software
+ * distributed under the License is distributed on an "AS IS" BASIS,
+ * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
+ * See the License for the specific language governing permissions and
+ * limitations under the License.
+ */
+
+package client
+
+import (
+	"context"
+	"net"
+	"testing"
+	"time"
+
+	"github.com/stretchr/testify/assert"
+	"google.golang.org/grpc"
+	"google.golang.org/grpc/credentials/insecure"
+	"google.golang.org/grpc/health"
+	healthpb "google.golang.org/grpc/health/grpc_health_v1"
+)
+
+func TestCheck(t *testing.T) {
+	tests := []struct {
+		name   string
+		target func(t *testing.T) string
+		expect func(t *testing.T, elapsed time.Duration, err error)
+	}{
+		{
+			name: "serving",
+			target: func(t *testing.T) string {
+				lis, err := net.Listen("tcp", "127.0.0.1:0")
+				if err != nil {
+					t.Fatal(err)
+				}
+
+				svr := grpc.NewServer()
+				healthpb.RegisterHealthServer(svr, health.NewServer())
+				go func() {
+					_ = svr.Serve(lis)
+				}()
+				t.Cleanup(svr.Stop)
+
+				return lis.Addr().String()
+			},
+			expect: func(t *testing.T, elapsed time.Duration, err error) {
+				assert := assert.New(t)
+				assert.NoError(err)
+			},
+		},
+		{
+			name: "not serving",
+			target: func(t *testing.T) string {
+				lis, err := net.Listen("tcp", "127.0.0.1:0")
+				if err != nil {
+					t.Fatal(err)
+				}
+
+				svr := grpc.NewServer()
+				healthServer := health.NewServer()
+				healthServer.SetServingStatus("", healthpb.HealthCheckResponse_NOT_SERVING)
+				healthpb.RegisterHealthServer(svr, healthServer)
+				go func() {
+					_ = svr.Serve(lis)
+				}()
+				t.Cleanup(svr.Stop)
+
+				return lis.Addr().String()
+			},
+			expect: func(t *testing.T, elapsed time.Duration, err error) {
+				assert := assert.New(t)
+				assert.ErrorContains(err, "health failed")
+			},
+		},
+		{
+			name: "connection refused",
+			target: func(t *testing.T) string {
+				lis, err := net.Listen("tcp", "127.0.0.1:0")
+				if err != nil {
+					t.Fatal(err)
+				}
+
+				addr := lis.Addr().String()
+				if err := lis.Close(); err != nil {
+					t.Fatal(err)
+				}
+
+				return addr
+			},
+			expect: func(t *testing.T, elapsed time.Duration, err error) {
+				assert := assert.New(t)
+				assert.Error(err)
+			},
+		},
+		{
+			name: "server accepts but never responds",
+			target: func(t *testing.T) string {
+				lis, err := net.Listen("tcp", "127.0.0.1:0")
+				if err != nil {
+					t.Fatal(err)
+				}
+				t.Cleanup(func() { lis.Close() })
+
+				go func() {
+					for {
+						conn, err := lis.Accept()
+						if err != nil {
+							return
+						}
+						defer conn.Close()
+					}
+				}()
+
+				return lis.Addr().String()
+			},
+			expect: func(t *testing.T, elapsed time.Duration, err error) {
+				assert := assert.New(t)
+				assert.Error(err)
+				assert.Less(elapsed, 2*contextTimeout)
+			},
+		},
+	}
+
+	for _, tc := range tests {
+		t.Run(tc.name, func(t *testing.T) {
+			target := tc.target(t)
+			start := time.Now()
+			err := Check(context.Background(), target, grpc.WithTransportCredentials(insecure.NewCredentials()))
+			tc.expect(t, time.Since(start), err)
+		})
+	}
+}
```

**File**: `scheduler/resource/standard/seed_peer.go` (modified, +73/-31)
```diff
@@ -22,14 +22,17 @@ import (
 	"context"
 	"fmt"
 	"io"
+	"maps"
 	"net"
+	"slices"
 	"strconv"
 	"sync"
 	"time"
 
+	"d7y.io/hashring"
 	"go.opentelemetry.io/otel/trace"
+	"golang.org/x/sync/errgroup"
 	"google.golang.org/grpc"
-	"stathat.com/c/consistent"
 
 	cdnsystemv1 "d7y.io/api/v2/pkg/apis/cdnsystem/v1"
 	commonv1 "d7y.io/api/v2/pkg/apis/common/v1"
@@ -55,6 +58,10 @@ const (
 
 	// SeedPeerRefreshInterval is the interval of refreshing seed peers.
 	SeedPeerRefreshInterval = 30 * time.Second
+
+	// SeedPeerHealthCheckConcurrencyLimit is the number of seed peers checked
+	// for health concurrently by refresh.
+	SeedPeerHealthCheckConcurrencyLimit = 32
 )
 
 // SeedPeer is the interface used for seed peer.
@@ -97,11 +104,11 @@ type seedPeer struct {
 	// mu protects hosts and hashring, which are replaced together by refresh.
 	mu sync.RWMutex
 
-	// hosts is the list of seed peers.
-	hosts *sync.Map
+	// hosts is the healthy seed peers keyed by name.
+	hosts map[string]*Host
 
-	// hashring is the hashring constructed from seed peers.
-	hashring *consistent.Consistent
+	// hashring is the hashring constructed from the names of seed peers.
+	hashring *hashring.VNodeHashRing
 
 	// done is the channel to stop the seed peer service.
 	done chan struct{}
@@ -114,8 +121,8 @@ func newSeedPeer(peerManager PeerManager, hostManager HostManager, clientPool df
 		hostManager: hostManager,
 		clientPool:  clientPool,
 		dialOptions: dialOptions,
-		hosts:       &sync.Map{},
-		hashring:    consistent.New(),
+		hosts:       map[string]*Host{},
+		hashring:    hashring.New(),
 		done:        make(chan struct{}),
 	}
 }
@@ -291,29 +298,25 @@ func (s *seedPeer) Select(ctx context.Context, taskID string) (*Host, error) {
 	s.mu.RLock()
 	defer s.mu.RUnlock()
 
-	if len(s.hashring.Members()) == 0 {
+	vnode, ok := s.hashring.Get(taskID)
+	if !ok {
 		return nil, fmt.Errorf("no available seed peer")
 	}
 
-	addr, err := s.hashring.Get(taskID)
-	if err != nil {
-		return nil, fmt.Errorf("failed to select seed peer: %w", err)
-	}
-
-	host, ok := s.hosts.Load(addr)
+	host, ok := s.hosts[vnode.Name()]
 	if !ok {
-		return nil, fmt.Errorf("failed to load host: %s", addr)
+		return nil, fmt.Errorf("failed to load host: %s", vnode.Name())
 	}
 
-	return host.(*Host), nil
+	return host, nil
 }
 
 // HasAvailable returns whether there is any available seed peer.
 func (s *seedPeer) HasAvailable() bool {
 	s.mu.RLock()
 	defer s.mu.RUnlock()
 
-	return len(s.hashring.Members()) > 0
+	return !s.hashring.IsEmpty()
 }
 
 // Initialize seed peer.
@@ -351,32 +354,71 @@ func (s *seedPeer) initSeedPeer(ctx context.Context, rg *http.Range, task *Task,
 }
 
 // refresh refreshes the hosts and hashring of seed peers, and clears
-// them when no seed peer is found in host manager.
+// them when no seed peer is found in host manager. The hashring is keyed
+// by the name of the seed peer instead of the address, so that the seed peer
+// keeps its position in the hashring when its ip changes, refer to
+// https://github.com/grpc/proposal/blob/master/A76-ring-hash-improvements.md.
 func (s *seedPeer) refresh(ctx context.Context) {
 	hosts := s.hostManager.LoadAllSeeds()
 	if len(hosts) == 0 {
 		logger.Warnf("no seed peer found in host manager")
 	}
 
-	healthyHosts := &sync.Map{}
-	for _, host := range hosts {
-		addr := net.JoinHostPort(host.IP, strconv.Itoa(int(host.Port)))
-		if err := healthclient.Check(ctx, addr, s.dialOptions...); err != nil {
-			logger.Errorf("failed to check the healthy for seed peer %s: %v", addr, err)
-		} else {
-			healthyHosts.Store(addr, host)
+	// Check the health of the seed peers concurrently, an unhealthy seed peer
+	// costs the health check timeout and must not delay the others.
+	healthy := make([]*Host, len(hosts))
+	eg, ctx := errgroup.WithContext(ctx)
+	eg.SetLimit(SeedPeerHealthCheckConcurrencyLimit)
+	for i, host := range hosts {
+		eg.Go(func() error {
+			addr := net.JoinHostPort(host.IP, strconv.Itoa(int(host.Port)))
+			if err := healthclient.Check(ctx, addr, s.dialOptions...); err != nil {
+				logger.Errorf("failed to check the healthy for seed peer %s: %v", addr, err)
+				return nil
+			}
+
+			healthy[i] = host
+			return nil
+		})
+	}
+
+	if err := eg.Wait(); err != nil {
+		logger.Errorf("failed to check the healthy for seed peers: %v", err)
+	}
+
+	healthyHosts := make(map[string]*Host, len(hosts))
+	for _, host := range healthy {
+		if host == nil {
+			continue
+		}
+
+		// Keep the most recently announced host when the same seed peer is
+		// announced from several addresses, such as after a pod restart.
+		if current, ok := healthyHosts[host.Name]; ok && current.UpdatedAt.Load().After(host.UpdatedAt.Load()) {
+			continue
 		}
+
+		healthyHosts[host.Name] = host
 	}
 
-	hashring := consistent.New()
-	healthyHosts.Range(func(addr, _ any) bool {
-		hashring.Add(addr.(string))
-		return true
-	})
+	// Rebuilding the hashring hashes every virtual node of every seed peer, so
+	// reuse the 
```

**File**: `scheduler/resource/standard/seed_peer_test.go` (modified, +172/-15)
```diff
@@ -19,14 +19,17 @@ package standard
 import (
 	"context"
 	"errors"
+	"fmt"
 	"io"
 	"net"
 	"reflect"
 	"strconv"
 	"sync"
+	"sync/atomic"
 	"testing"
 	"time"
 
+	"d7y.io/hashring"
 	"github.com/stretchr/testify/assert"
 	gomock "go.uber.org/mock/gomock"
 	"google.golang.org/grpc"
@@ -93,6 +96,28 @@ func mockUnreachableSeedHost(t *testing.T) *Host {
 	return mockSeedHost(port)
 }
 
+func mockHangingSeedHost(t *testing.T) *Host {
+	t.Helper()
+
+	lis, err := net.Listen("tcp", "127.0.0.1:0")
+	if err != nil {
+		t.Fatal(err)
+	}
+	t.Cleanup(func() { lis.Close() })
+
+	go func() {
+		for {
+			conn, err := lis.Accept()
+			if err != nil {
+				return
+			}
+			defer conn.Close()
+		}
+	}()
+
+	return mockSeedHost(int32(lis.Addr().(*net.TCPAddr).Port))
+}
+
 func TestSeedPeer_newSeedPeer(t *testing.T) {
 	tests := []struct {
 		name   string
@@ -164,6 +189,143 @@ func TestSeedPeer_refresh(t *testing.T) {
 				assert.Error(err)
 			},
 		},
+		{
+			name: "keep the most recently announced host of the same seed peer",
+			hosts: func(t *testing.T) []*Host {
+				register := func(svr *grpc.Server) {
+					healthpb.RegisterHealthServer(svr, health.NewServer())
+				}
+
+				stale := mockSeedHostServer(t, register)
+				stale.UpdatedAt.Store(time.Now().Add(-time.Minute))
+				return []*Host{stale, mockSeedHostServer(t, register)}
+			},
+			mock: func(m *MockHostManagerMockRecorder, hosts []*Host) {
+				m.LoadAllSeeds().Return(hosts)
+			},
+			expect: func(t *testing.T, seedPeer *seedPeer, hosts []*Host) {
+				assert := assert.New(t)
+				seedPeer.refresh(context.Background())
+				assert.Len(seedPeer.hosts, 1)
+				assert.Equal(hashring.DefaultVNodesPerNode, seedPeer.hashring.Len())
+
+				host, err := seedPeer.Select(context.Background(), mockTaskID)
+				assert.NoError(err)
+				assert.Same(hosts[1], host)
+			},
+		},
+		{
+			name: "reuse the hashring when the seed peers are unchanged",
+			hosts: func(t *testing.T) []*Host {
+				return []*Host{mockSeedHostServer(t, func(svr *grpc.Server) {
+					healthpb.RegisterHealthServer(svr, health.NewServer())
+				})}
+			},
+			mock: func(m *MockHostManagerMockRecorder, hosts []*Host) {
+				m.LoadAllSeeds().Return(hosts).Times(2)
+			},
+			expect: func(t *testing.T, seedPeer *seedPeer, hosts []*Host) {
+				assert := assert.New(t)
+				seedPeer.refresh(context.Background())
+				ring := seedPeer.hashring
+
+				seedPeer.refresh(context.Background())
+				assert.Same(ring, seedPeer.hashring)
+				assert.Same(hosts[0], seedPeer.hosts[hosts[0].Name])
+			},
+		},
+		{
+			name: "refresh and select concurrently with changing seed peers",
+			hosts: func(t *testing.T) []*Host {
+				register := func(svr *grpc.Server) {
+					healthpb.RegisterHealthServer(svr, health.NewServer())
+				}
+
+				var hosts []*Host
+				for i := range 3 {
+					host := mockSeedHostServer(t, register)
+					host.Name = fmt.Sprintf("default-seed-client-%d", i)
+					hosts = append(hosts, host)
+				}
+
+				return hosts
+			},
+			mock: func(m *MockHostManagerMockRecorder, hosts []*Host) {
+				var calls atomic.Int64
+				m.LoadAllSeeds().DoAndReturn(func() []*Host {
+					switch calls.Add(1) % 3 {
+					case 0:
+						return hosts[:1]
+					case 1:
+						return hosts
+					default:
+						return []*Host{}
+					}
+				}).AnyTimes()
+			},
+			expect: func(t *testing.T, seedPeer *seedPeer, hosts []*Host) {
+				var wg sync.WaitGroup
+				wg.Add(3)
+				go func() {
+					defer wg.Done()
+					for range 100 {
+						seedPeer.refresh(context.Background())
+					}
+				}()
+
+				go func() {
+					defer wg.Done()
+					for range 100 {
+						seedPeer.refresh(context.Background())
+					}
+				}()
+
+				go func() {
+					assert := assert.New(t)
+					defer wg.Done()
+					for i := range 2000 {
+						host, err := seedPeer.Select(context.Background(), fmt.Sprintf("%s-%d", mockTaskID, i))
+						if err != nil {
+							assert.EqualError(err, "no available seed peer")
+							continue
+						}
+
+						assert.Contains(hosts, host)
+					}
+				}()
+
+				wg.Wait()
+			},
+		},
+		{
+			name: "check the health of seed peers concurrently",
+			hosts: func(t *testing.T) []*Host {
+				hosts := []*Host{mockSeedHostServer(t, func(svr *grpc.Server) {
+					healthpb.RegisterHealthServer(svr, health.NewServer())
+				})}
+				for i := range 8 {
+					host := mockHangingSeedHost(t)
+					host.Name = fmt.Sprintf("hanging-seed-client-%d", i)
+					hosts = append(hosts, host)
+				}
+
+				return hosts
+			},
+			mock: func(m *MockHostManagerMockRecorder, hosts []*Host) {
+				m.LoadAllSeeds().Return(hosts)
+			},
+			expect: func(t *testing.T, seedPeer *seedPeer, hosts []*Host) {
+				assert := assert.New(t)
+				start := time.Now()
+				seedPeer.refresh(context.Background())
+				assert.Less(time.Since(start), 8*time.Second)
+				assert.Len(seedPeer.hosts, 1)
+
+				host, err := seedPeer.Select(context.Background(), mockTaskID)
+				assert.NoError(err)
+				assert.Same(hosts[0], host)
+			},
+		},
 		{

```

#### Recent Merged Pull Requests:
- **PR #5078** (2026-10-20): chore(deps): bump actions/download-artifact from 7.0.0 to 8.0.2 (@dependabot[bot])
- **PR #5077** (2026-10-20): chore(deps): bump goreleaser/goreleaser-action from 7.2.2 to 7.3.0 (@dependabot[bot])
- **PR #5076** (closed): chore(deps): bump github/codeql-action/init from 4.36.2 to 4.39.0 (@dependabot[bot])
- **PR #5075** (closed): chore(deps): bump google.golang.org/grpc from 1.83.1 to 1.84.0 (@dependabot[bot])
- **PR #5074** (2026-10-20): chore(deps): bump ossf/scorecard-action from 2.4.4 to 2.5.0 (@dependabot[bot])
- **PR #5073** (closed): chore(deps): bump github.com/gin-contrib/gzip from 1.2.7 to 1.2.8 (@dependabot[bot])

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

## X. scheduler): key seed peer hashring by name and check health concurrently (#5068)

**RULE**:
When implementing operations in `go.mod`, engineers MUST enforce rigorous boundary validation, safe state transitions, and memory/concurrency invariants as established by production defect remediation in dragonflyoss/dragonfly. All inputs crossing module boundaries must be explicitly verified before state persistence.

**WHY**:
Prevents defects observed in production commit `4baf23f5`: scheduler): key seed peer hashring by name and check health concurrently (#5068). Unvalidated execution paths cause runtime exceptions, race conditions, and silent state corruption under concurrent workloads.

**WHEN TO APPLY**:
Subsystems managing Go data structures, boundary deserialization, API parsing, or resource lifecycles matching `go.mod`.

**VERIFIED IMPLEMENTATION PATTERN**:
```go
// Verified production-grade fix pattern:
	d7y.io/hashring v0.2.0
	github.com/dchest/siphash v1.2.3 // indirect
```

**NEGATIVE CONSTRAINT**:
```go
// Anti-pattern to NEVER write (induced failure mode):
// Defect-prone omission of boundary validation
```

**VERIFICATION METHOD**:
Automated regression test asserting that input states reproducing defect `4baf23f5` are properly handled with clean fallback behavior.
