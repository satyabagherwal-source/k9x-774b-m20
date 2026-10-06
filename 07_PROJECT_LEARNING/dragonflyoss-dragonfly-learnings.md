# Forensic Learning Record (Deep Inspection): dragonflyoss/dragonfly

> **Canonical Artifact**: `07_PROJECT_LEARNING/dragonflyoss-dragonfly-learnings.md`  
> **Source Platform**: GitHub ([https://github.com/dragonflyoss/dragonfly](https://github.com/dragonflyoss/dragonfly))  
> **Harvest Method**: Full-Spectrum Deep Extraction (Patches, Diffs, Source Code, Post-Mortems)  
> **Harvest Timestamp**: 2026-10-06T01:57:41.082Z  
> **Compliance State**: Free Tier Guaranteed | Strict Rate-Limit Backoff Honored  

---

## 1. Context & Architectural Overview
- **Repository / Resource**: `dragonflyoss/dragonfly`
- **Description**: Delivers efficient, stable, and secure data distribution and acceleration powered by P2P technology, with an optional content‑addressable filesystem that accelerates OCI container launch.
- **Primary Language / Ecosystem**: Go
- **Discovered Manifests / Configurations**: go.mod, README.md
- **Stars / Engagement**: 3341 stars

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

### Core Architecture Module: `cmd/scheduler/main.go`
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
	"d7y.io/dragonfly/v2/cmd/scheduler/cmd"
)

func main() {
	cmd.Execute()
}

```

### Core Architecture Module: `internal/dferrors/error.go`
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

package dferrors

import (
	"errors"
	"fmt"

	"google.golang.org/grpc/status"

	commonv1 "d7y.io/api/v2/pkg/apis/common/v1"
)

// common and framework errors
var (
	ErrInvalidArgument = errors.New("invalid argument")
	ErrInvalidHeader   = errors.New("invalid Header")
	ErrDataNotFound    = errors.New("data not found")
	ErrEmptyValue      = errors.New("empty value")
	ErrConvertFailed   = errors.New("convert failed")
	ErrNoCandidateNode = errors.New("no candidate server node")
)

type DfError struct {
	Code    commonv1.Code
	Message string
}

func (s *DfError) Error() string {
	return fmt.Sprintf("[%d]%s", s.Code, s.Message)
}

func New(code commonv1.Code, msg string) *DfError {
	return &DfError{
		Code:    code,
		Message: msg,
	}
}

// ConvertGRPCErrorToDfError converts grpc error to DfError, if it exists.
func ConvertGRPCErrorToDfError(err error) error {
	for _, d := range status.Convert(err).Details() {
		switch internal := d.(type) {
		case *commonv1.GrpcDfError:
			return &DfError{
				Code:    internal.Code,
				Message: internal.Message,
			}
		}
	}

	return err
}

// ConvertDfErrorToGRPCError converts DfError to grpc error, if it is.
func ConvertDfErrorToGRPCError(err error) error {
	if v, ok := err.(*DfError); ok {
		s, e := status.Convert(err).WithDetails(
			&commonv1.GrpcDfError{
				Code:    v.Code,
				Message: v.Message,
			})
		if e == nil {
			err = s.Err()
		}
	}
	return err
}

```


### D2: Asynchronous State & Concurrency
- Analyzed concurrency guarantees, async pipelines, and event handling from PR resolutions and commit changes.

### D3: Error Boundaries, Recovery & Rollbacks
- Exception handling patterns and defect resolutions extracted from closed production bug issues:
- **Issue #5016** (2026-09-21): **fix(rpc): exempt gRPC health checks from rate limiting**
  *Symptoms*:   <!--- Provide a general summary of your changes in the Title above -->  ## Description The scheduler and manager gRPC servers put the grpc_ratelimit interceptor first in the interceptor chain and register the standard health checking service on the same grpc.Server. Whenever business traffic exhausts the rate limiter, /grpc.health.v1.Health/Check is rejected with ResourceExhausted as well, so kubelet liveness/readiness probes fail and a merely busy pod is restarted or taken out of service.  Add rpc.RateLimitUnaryServerInterceptor and rpc.RateLimitStreamServerInterceptor, which wrap the upstream grpc_ratelimit interceptors and let requests whose full method starts with /grpc.health.v1.Health/ go straight to the handler. Switch the scheduler and manager servers to them.  Add table-driven unit tests for both interceptors and a bufconn based test for the scheduler server which verifies that health checks stay SERVING after the limiter is exhausted while business RPCs are rejected. <!--- Describe your changes in detail -->  ## Related Issue https://github.com/dragonflyoss/dragonfly/issues/5015 <!--- This project only accepts pull requests related to open issues --> <!--- If suggesting a new feature or change, please discuss it in an issue first --> <!--- If fixing a bug, there should be an issue describing it with steps to reproduce --> <!--- Please link to the issue here: -->  ## Motivation and Context  <!--- Why is this change required? What problem does 
  **Post-Mortem & Fix Analysis**:
  > ## [Codecov](https://app.codecov.io/gh/dragonflyoss/dragonfly/pull/5016?dropdown=coverage&src=pr&el=h1&utm_medium=referral&utm_source=github&utm_content=comment&utm_campaign=pr+comments&utm_term=dragonflyoss) Report :x: Patch coverage is `66.66667%` with `2 lines` in your changes missing coverage. Please review. :white_check_mark: Project coverage is 62.44%. Comparing base ([`109a393`](https://app.codecov.io/gh/dragonflyoss/dragonfly/commit/109a393fa2aa3144c382fc97004056fc0a59fd24?dropdown=coverage&el=desc&utm_medium=referral&utm_source=github&utm_content=comment&utm_campaign=pr+comments&utm_term=dragonflyoss)) to head ([`858ec45`](https://app.codecov.io/gh/dragonflyoss/dragonfly/commit/858ec458896bc2bd11694fa5ddafd807942901e1?dropdown=coverage&el=desc&utm_medium=referral&utm_source=github&utm_content=comment&utm_campaign=pr+comments&utm_term=dragonflyoss)).  | [Files with missing lines](https://app.codecov.io/gh/dragonflyoss/dragonfly/pull/5016?dropdown=coverage&src=pr&el=tree&utm_med

- **Issue #5015** (2026-09-22): **scheduler/manager: gRPC health checks are rejected by the request rate limiter, so kubelet restarts pods that are merely busy**
  *Symptoms*:  ---  ### Bug report:  In the scheduler (and manager) gRPC server the `grpc_ratelimit` interceptor is the first interceptor of the chain and applies to **every** RPC of the server, while the standard gRPC health service is registered on the **same** `grpc.Server`:  - `pkg/rpc/scheduler/server/server.go` (`main` @ 109a393f): L57 `limiter := rpc.NewRateLimiterInterceptor(requestRateLimit, int64(requestRateLimit))`, L72 `grpc_ratelimit.UnaryServerInterceptor(limiter)`, L80 `grpc_ratelimit.StreamServerInterceptor(limiter)`, L96 `healthpb.RegisterHealthServer(grpcServer, health.NewServer())`. - `pkg/rpc/manager/server/server.go`: same structure (L57 / L72 / L79 / L94).  As a result, once business RPCs (`AnnouncePeer`, `AnnounceHost`, `StatTask`, ...) exhaust the token bucket configured by `server.requestRateLimit` (default 4000/s, burst = same value), `/grpc.health.v1.Health/Check` is rejected as well:  ``` rpc error: code = ResourceExhausted desc = /grpc.health.v1.Health/Check is rejected by grpc_ratelimit middleware, please retry later. ```  The Helm chart uses exactly this RPC for the startup/readiness/liveness probes (`charts/dragonfly/templates/scheduler/scheduler-statefulset.yaml`: `/bin/grpc_health_probe -addr=:<containerPort>`; the manager deployment does the same). So under load:  1. readiness fails -> the scheduler is removed from the Service / DNS -> the remaining schedulers receive even more traffic -> they hit the limiter too; 2. liveness fails `failureThreshold` time

- **Issue #4961** (2026-08-27): **fix(scheduler): clear stale seed peer snapshots**
  *Symptoms*: Refresh and atomically publish an empty seed peer snapshot when no seeds remain, preventing stale hosts from being selected.  <!--- Provide a general summary of your changes in the Title above -->  ## Description This pull request improves the thread safety and reliability of the seed peer selection mechanism in the scheduler by introducing proper synchronization and enhancing test coverage. The main changes include adding a mutex to protect shared state, ensuring atomic updates during refresh, and adding tests to verify correct behavior under concurrent access and when the host manager is empty.  **Thread safety improvements:**  * Added a `sync.RWMutex` (`snapshotMutex`) to the `seedPeer` struct and used it to protect access to the `hosts` and `hashring` fields in `Select`, `HasAvailable`, and `refresh` methods, preventing data races during concurrent operations. [[1]](diffhunk://#diff-3a2c4c6ea7497d3cc956eafaf6b9d7434e2db45b76be2baea52cf2ca0f1121a2R103-R104) [[2]](diffhunk://#diff-3a2c4c6ea7497d3cc956eafaf6b9d7434e2db45b76be2baea52cf2ca0f1121a2L289-R305) [[3]](diffhunk://#diff-3a2c4c6ea7497d3cc956eafaf6b9d7434e2db45b76be2baea52cf2ca0f1121a2L308-R318) [[4]](diffhunk://#diff-3a2c4c6ea7497d3cc956eafaf6b9d7434e2db45b76be2baea52cf2ca0f1121a2L362-R380)  **Atomic updates and correctness:**  * Modified the `refresh` method to update `hosts` and `hashring` atomically under a write lock, ensuring that selection operations always see a consistent snapshot of seed peers. 
  **Post-Mortem & Fix Analysis**:
  > ## [Codecov](https://app.codecov.io/gh/dragonflyoss/dragonfly/pull/4961?dropdown=coverage&src=pr&el=h1&utm_medium=referral&utm_source=github&utm_content=comment&utm_campaign=pr+comments&utm_term=dragonflyoss) Report :white_check_mark: All modified and coverable lines are covered by tests. :white_check_mark: Project coverage is 29.95%. Comparing base ([`66db456`](https://app.codecov.io/gh/dragonflyoss/dragonfly/commit/66db456409d6c510713a427427b72415d6cfa468?dropdown=coverage&el=desc&utm_medium=referral&utm_source=github&utm_content=comment&utm_campaign=pr+comments&utm_term=dragonflyoss)) to head ([`b18a4e7`](https://app.codecov.io/gh/dragonflyoss/dragonfly/commit/b18a4e79d8c5ae4af1188e5308ac83cf4d4bb6e0?dropdown=coverage&el=desc&utm_medium=referral&utm_source=github&utm_content=comment&utm_campaign=pr+comments&utm_term=dragonflyoss)). :warning: Report is 10 commits behind head on main.  <details><summary>Additional details and impacted files</summary>    [![Impacted file tree graph](ht

- **Issue #4960** (2026-09-08): **Scheduler continue selecting removed seed peer for new tasks.**
  *Symptoms*: ### Bug report:  When the last super seed peer is removed from Scheduler's `HostManager`, Scheduler may continue selecting that removed seed peer for new tasks.  `SeedPeer.refresh()` returns early when `HostManager.LoadAllSeeds()` returns an empty list. As a result, the cached seed peer hosts and consistent hash ring are not cleared. `HasAvailable()` still reports an available seed peer, and `Select()` can return the stale address until Scheduler restarts.  ### Expected behavior:  When no seed peers remain in `HostManager`, the next seed peer refresh should publish an empty host snapshot and an empty hash ring. New tasks should not select or trigger the removed seed peer.  ### How to reproduce it:  1. Start Scheduler with one super seed peer registered. 2. Wait for the periodic seed peer refresh and confirm that new tasks select the seed peer. 3. Stop or unregister the seed peer without restarting Scheduler. 4. Wait until the host is removed from `HostManager` and another seed peer refresh runs. 5. Start a new task. 6. Observe that Scheduler still logs `selected seed peer <old-address>` and attempts to trigger the removed seed peer.  ### Environment:  - Dragonfly version: latest `main` (`66db456409d6c510713a427427b72415d6cfa468`) - OS: Linux - Kernel (e.g. `uname -a`): N/A - Others: Reproduced with the local development environment. The seed peer refresh interval is 30 seconds. 

- **Issue #4956** (2026-08-20): **fix(time): avoid panic for nanosecond jitter delay**
  *Symptoms*: ## Description  Avoid calling `rand.Int64N` with a zero bound when `baseDelay / 2` truncates to zero. For durations with a representable jitter range, behavior is unchanged. A regression case covers the one-nanosecond input.  ## Related Issue  Fixes #4955  ## Motivation and Context  `RandomDelayWithJitter` returns early only for non-positive durations, so positive durations should not panic. Before this change, `time.Nanosecond` produced a zero jitter bound and panicked with `invalid argument to Int64N`.  ## Screenshots (if appropriate)  Not applicable.  ## Types of changes  - [x] Bug fix (non-breaking change which fixes an issue) - [ ] New feature (non-breaking change which adds functionality) - [ ] Breaking change (fix or feature that would cause existing functionality to change) - [ ] Documentation Update (if none of the other choices apply)  ## Validation  - `go test ./pkg/time -run TestRandomDelayWithJitter -count=1` - `go vet ./pkg/time`  ## Checklist  - [ ] My change requires a change to the documentation. - [ ] I have updated the documentation accordingly. - [x] I have read the **CONTRIBUTING** document. - [x] I have added tests to cover my changes.  > AI assistance disclosure: Codex was used to help identify the edge case, draft the implementation and regression test, and run the validations above. This PR is intentionally left as a draft pending the submitter's manual review.
  **Post-Mortem & Fix Analysis**:
  > ## [Codecov](https://app.codecov.io/gh/dragonflyoss/dragonfly/pull/4956?dropdown=coverage&src=pr&el=h1&utm_medium=referral&utm_source=github&utm_content=comment&utm_campaign=pr+comments&utm_term=dragonflyoss) Report :white_check_mark: All modified and coverable lines are covered by tests. :white_check_mark: Project coverage is 29.49%. Comparing base ([`d43a06a`](https://app.codecov.io/gh/dragonflyoss/dragonfly/commit/d43a06a68585cbcff26a60b239d1ccf77f3e914c?dropdown=coverage&el=desc&utm_medium=referral&utm_source=github&utm_content=comment&utm_campaign=pr+comments&utm_term=dragonflyoss)) to head ([`8c837b5`](https://app.codecov.io/gh/dragonflyoss/dragonfly/commit/8c837b57b835521b481a887326e07c2fa79a6bfe?dropdown=coverage&el=desc&utm_medium=referral&utm_source=github&utm_content=comment&utm_campaign=pr+comments&utm_term=dragonflyoss)).  <details><summary>Additional details and impacted files</summary>    [![Impacted file tree graph](https://app.codecov.io/gh/dragonflyoss/dragonfly/pull/
  > @544129603 Is ready for reviewing?
  > Yes, it is ready for review now. Could you also add the `bug` label to satisfy the Classify PR check? Thanks!

- **Issue #4925** (2026-08-05): **fix(manager): grant the root role on every startup**
  *Symptoms*: ## Description  `InitRBAC` added the root user-to-role grant only inside the `rootUserCount <= 0` branch that seeds the root user. This moves the grant out of that branch: look the root user up by name, and call `AddRoleForUser` on every startup.  An enforcer loads its policy once when it is constructed and nothing reloads it afterwards, so a replica that built its enforcer before another replica seeded never held the grant, and denied every RBAC-protected request from root until it restarted. `AddRoleForUser` is idempotent against a replica's own in-memory model, so applying it unconditionally lets replicas converge no matter which one seeded.  If no root user exists (deleted while other users remain, so the seeding branch does not run), the lookup returns `gorm.ErrRecordNotFound` and `InitRBAC` returns without error, as it did before.  Two notes for reviewers:  - Each replica whose in-memory model lacks the rule inserts its own `g` row, so `casbin_rule` can pick up one duplicate `g` row per replica within a single cold-start window. It converges rather than growing per restart: a restarting replica loads the duplicated policy, finds the rule in memory, and `AddRoleForUser` then returns false without inserting. This is the same thing the `AddPermissionForUser` loop above already does with `p` rows, which duplicate per replica on unmodified code. Enforcement is unaffected either way, since the matcher ORs over allow policies. I am happy to add a unique index on `casbin_rule` 
  **Post-Mortem & Fix Analysis**:
  > ## [Codecov](https://app.codecov.io/gh/dragonflyoss/dragonfly/pull/4925?dropdown=coverage&src=pr&el=h1&utm_medium=referral&utm_source=github&utm_content=comment&utm_campaign=pr+comments&utm_term=dragonflyoss) Report :x: Patch coverage is `14.28571%` with `6 lines` in your changes missing coverage. Please review. :white_check_mark: Project coverage is 28.86%. Comparing base ([`237fcc5`](https://app.codecov.io/gh/dragonflyoss/dragonfly/commit/237fcc53dbc0a53ff9bd3953f8ec3f9e370c1574?dropdown=coverage&el=desc&utm_medium=referral&utm_source=github&utm_content=comment&utm_campaign=pr+comments&utm_term=dragonflyoss)) to head ([`92edafe`](https://app.codecov.io/gh/dragonflyoss/dragonfly/commit/92edafe1ec9099a2c82aed311c2874ad3dd2146c?dropdown=coverage&el=desc&utm_medium=referral&utm_source=github&utm_content=comment&utm_campaign=pr+comments&utm_term=dragonflyoss)).  | [Files with missing lines](https://app.codecov.io/gh/dragonflyoss/dragonfly/pull/4925?dropdown=coverage&src=pr&el=tree&utm_med
  > Thanks for merging this! Which release will this go into -- is it possible this will be a part of a patch release? @gaius-qi 

- **Issue #4880** (2026-07-28): **scheduler重启后，seed节点上的数据，无法注册到scheduler中**
  *Symptoms*: 复现过程： 1. seed节点上使用dfget下载数据到本地做种 2. 重启scheduler 3. 在client节点上使用dfget下载同样的数据  现象： 1. seed节点日志显示收到来自client的请求 2. scheduler上没有收到注册task的信息，多次can not find candidate parent后，触发client回源

- **Issue #4877** (2026-07-21): **fix(manager): format RBAC subject from integer user id**
  *Symptoms*:   The RBAC middleware built the Casbin enforcement subject with `fmt.Sprint` on the id read from the JWT claims. Because JWT claims are JSON, the id decodes as a `float64`, and `fmt.Sprint` renders any `float64` value >= 1000000 in scientific notation (for example `1.234567e+06`).  The grouping policies are written from the integer user id (a `uint`), so the scientific-notation subject never matched any policy and `Enforce` returned false. Every request from a user whose id is >= 1000000 was rejected with `HTTP 401` on every manager API endpoint.  This converts the id back to `uint` before formatting, matching how the audit middleware already reads the same `"id"` claim (`manager/middlewares/audit.go` uses `uint(id)`), so the request subject equals the policy subject across the full id range.  A regression test drives the real `RBAC` handler through `httptest` with ids around the scientific-notation boundary (1, 999999, 1000000, 1234567, 4294967295). Before the fix the ids >= 1000000 return 401; after the fix all pass.  ## Related Issue  Fixes #<ISSUE_NUMBER>  ## Motivation and Context  `RBAC` uses the Casbin grouping matcher `g(r.sub, p.sub)`, so the request subject string must equal the policy subject byte-for-byte. Policies are always stored from the integer id (`fmt.Sprint(user.ID)` where `User.ID` is `uint`), while the request subject was formatted from the `float64` claim. The two strings diverge for every id >= 1000000, which silently lo
  **Post-Mortem & Fix Analysis**:
  > ## [Codecov](https://app.codecov.io/gh/dragonflyoss/dragonfly/pull/4877?dropdown=coverage&src=pr&el=h1&utm_medium=referral&utm_source=github&utm_content=comment&utm_campaign=pr+comments&utm_term=dragonflyoss) Report :x: Patch coverage is `0%` with `1 line` in your changes missing coverage. Please review. :white_check_mark: Project coverage is 28.11%. Comparing base ([`530a1d2`](https://app.codecov.io/gh/dragonflyoss/dragonfly/commit/530a1d223001293c5cd00b455ddbaaf70025418a?dropdown=coverage&el=desc&utm_medium=referral&utm_source=github&utm_content=comment&utm_campaign=pr+comments&utm_term=dragonflyoss)) to head ([`8efcee6`](https://app.codecov.io/gh/dragonflyoss/dragonfly/commit/8efcee6db892436dbae2d574bef797fdede03f3b?dropdown=coverage&el=desc&utm_medium=referral&utm_source=github&utm_content=comment&utm_campaign=pr+comments&utm_term=dragonflyoss)).  | [Files with missing lines](https://app.codecov.io/gh/dragonflyoss/dragonfly/pull/4877?dropdown=coverage&src=pr&el=tree&utm_medium=refe

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

### Incident Patch 1: `fc605d40` (2026-09-29)
**Commit Message**: chore(deps): bump go.opentelemetry.io/otel/exporters/otlp/otlptrace/otlptracehttp from 1.41.0 to 1.46.0 (#5031)

chore(deps): bump go.opentelemetry.io/otel/exporters/otlp/otlptrace/otlptracehttp

Bumps [go.opentelemetry.io/otel/exporters/otlp/otlptrace/otlptracehttp](https://github.com/open-telemetry/opentelemetry-go) from 1.41.0 to 1.46.0.
- [Release notes](https://github.com/open-telemetry/opentelemetry-go/releases)
- [Changelog](https://github.com/open-telemetry/opentelemetry-go/blob/main/CHANGELOG.md)
- [Commits](https://github.com/open-telemetry/opentelemetry-go/compare/v1.41.0...v1.46.0)

---
updated-dependencies:
- dependency-name: go.opentelemetry.io/otel/exporters/otlp/otlptrace/otlptracehttp
  dependency-version: 1.46.0
  dependency-type: direct:production
  update-type: version-update:semver-minor
...

Signed-off-by: dependabot[bot] <[REDACTED_EMAIL]>
Co-authored-by: dependabot[bot] <49699333+dependabot[bot]@users.noreply.github.com>

**File**: `go.mod` (modified, +1/-1)
```diff
@@ -57,7 +57,7 @@ require (
 	go.opentelemetry.io/otel v1.46.0
 	go.opentelemetry.io/otel/exporters/otlp/otlptrace v1.46.0
 	go.opentelemetry.io/otel/exporters/otlp/otlptrace/otlptracegrpc v1.46.0
-	go.opentelemetry.io/otel/exporters/otlp/otlptrace/otlptracehttp v1.41.0
+	go.opentelemetry.io/otel/exporters/otlp/otlptrace/otlptracehttp v1.46.0
 	go.opentelemetry.io/otel/sdk v1.46.0
 	go.opentelemetry.io/otel/trace v1.46.0
 	go.uber.org/mock v0.6.0
```

**File**: `go.sum` (modified, +2/-2)
```diff
@@ -805,8 +805,8 @@ go.opentelemetry.io/otel/exporters/otlp/otlptrace v1.46.0 h1:OFnwLJr+pF3iHrlGSzb
 go.opentelemetry.io/otel/exporters/otlp/otlptrace v1.46.0/go.mod h1:716wFneO0ov19A2beH5hjfh9AK5z/VWNAtDijp1Y0/g=
 go.opentelemetry.io/otel/exporters/otlp/otlptrace/otlptracegrpc v1.46.0 h1:w53CDeOA/Kurp7yRsegSr6pbbr759dOvJ+yNmWM6Hxs=
 go.opentelemetry.io/otel/exporters/otlp/otlptrace/otlptracegrpc v1.46.0/go.mod h1:BOmGMCbAtvcJiSJ+hLuhgPLdDbimnraSl8irz3iY8sY=
-go.opentelemetry.io/otel/exporters/otlp/otlptrace/otlptracehttp v1.41.0 h1:inYW9ZhgqiDqh6BioM7DVHHzEGVq76Db5897WLGZ5Go=
-go.opentelemetry.io/otel/exporters/otlp/otlptrace/otlptracehttp v1.41.0/go.mod h1:Izur+Wt8gClgMJqO/cZ8wdeeMryJ/xxiOVgFSSfpDTY=
+go.opentelemetry.io/otel/exporters/otlp/otlptrace/otlptracehttp v1.46.0 h1:KrC1YrQeSt46ITMWAbgQx1M1eV1/1TKzttrBzymPmss=
+go.opentelemetry.io/otel/exporters/otlp/otlptrace/otlptracehttp v1.46.0/go.mod h1:zDSEzoEqsOrgBeGvH66KRgxh90VonFyJqBHA0Pk3+rM=
 go.opentelemetry.io/otel/exporters/stdout/stdouttrace v1.45.0 h1:lsA/S1bxgdbyFGkTj+3meEdJ6ADVU7QoFstV6MXgE68=
 go.opentelemetry.io/otel/exporters/stdout/stdouttrace v1.45.0/go.mod h1:L7u+MirGoB1bjeLH66+xDykF4RC8C3RN7lIFpBiewUo=
 go.opentelemetry.io/otel/metric v1.46.0 h1:yBnkXvgV7AXFILZc5K6IZe/CBFF3OS7BJ8ov6/lj0K8=
```

---

### Incident Patch 2: `4c3c2836` (2026-09-22)
**Commit Message**: chore(deps): bump go.opentelemetry.io/otel/exporters/otlp/otlptrace/otlptracegrpc from 1.41.0 to 1.46.0 (#5021)

chore(deps): bump go.opentelemetry.io/otel/exporters/otlp/otlptrace/otlptracegrpc

Bumps [go.opentelemetry.io/otel/exporters/otlp/otlptrace/otlptracegrpc](https://github.com/open-telemetry/opentelemetry-go) from 1.41.0 to 1.46.0.
- [Release notes](https://github.com/open-telemetry/opentelemetry-go/releases)
- [Changelog](https://github.com/open-telemetry/opentelemetry-go/blob/main/CHANGELOG.md)
- [Commits](https://github.com/open-telemetry/opentelemetry-go/compare/v1.41.0...v1.46.0)

---
updated-dependencies:
- dependency-name: go.opentelemetry.io/otel/exporters/otlp/otlptrace/otlptracegrpc
  dependency-version: 1.46.0
  dependency-type: direct:production
  update-type: version-update:semver-minor
...

Signed-off-by: dependabot[bot] <[REDACTED_EMAIL]>
Co-authored-by: dependabot[bot] <49699333+dependabot[bot]@users.noreply.github.com>

**File**: `go.mod` (modified, +21/-23)
```diff
@@ -53,12 +53,12 @@ require (
 	github.com/swaggo/gin-swagger v1.6.1
 	github.com/swaggo/swag v1.16.6
 	go.opentelemetry.io/contrib/instrumentation/github.com/gin-gonic/gin/otelgin v0.66.0
-	go.opentelemetry.io/contrib/instrumentation/google.golang.org/grpc/otelgrpc v0.66.0
+	go.opentelemetry.io/contrib/instrumentation/google.golang.org/grpc/otelgrpc v0.70.0
 	go.opentelemetry.io/otel v1.46.0
-	go.opentelemetry.io/otel/exporters/otlp/otlptrace v1.41.0
-	go.opentelemetry.io/otel/exporters/otlp/otlptrace/otlptracegrpc v1.41.0
+	go.opentelemetry.io/otel/exporters/otlp/otlptrace v1.46.0
+	go.opentelemetry.io/otel/exporters/otlp/otlptrace/otlptracegrpc v1.46.0
 	go.opentelemetry.io/otel/exporters/otlp/otlptrace/otlptracehttp v1.41.0
-	go.opentelemetry.io/otel/sdk v1.41.0
+	go.opentelemetry.io/otel/sdk v1.46.0
 	go.opentelemetry.io/otel/trace v1.46.0
 	go.uber.org/mock v0.6.0
 	go.uber.org/zap v1.27.1
@@ -68,7 +68,7 @@ require (
 	golang.org/x/sys v0.47.0
 	golang.org/x/time v0.14.0
 	google.golang.org/api v0.267.0
-	google.golang.org/grpc v1.80.0
+	google.golang.org/grpc v1.83.1
 	google.golang.org/protobuf v1.36.12
 	gopkg.in/natefinch/lumberjack.v2 v2.2.1
 	gopkg.in/yaml.v3 v3.0.1
@@ -116,18 +116,16 @@ require (
 	github.com/go-echarts/go-echarts/v2 v2.2.4 // indirect
 	github.com/go-logr/logr v1.4.4 // indirect
 	github.com/go-logr/stdr v1.2.2 // indirect
-	github.com/go-openapi/jsonpointer v0.22.5 // indirect
-	github.com/go-openapi/jsonreference v0.21.5 // indirect
-	github.com/go-openapi/spec v0.22.4 // indirect
-	github.com/go-openapi/swag/conv v0.25.5 // indirect
-	github.com/go-openapi/swag/jsonname v0.25.5 // indirect
-	github.com/go-openapi/swag/jsonutils v0.25.5 // indirect
-	github.com/go-openapi/swag/loading v0.25.5 // indirect
-	github.com/go-openapi/swag/stringutils v0.25.5 // indirect
-	github.com/go-openapi/swag/typeutils v0.25.5 // indirect
-	github.com/go-openapi/swag/yamlutils v0.25.5 // indirect
-	github.com/go-openapi/testify/enable/yaml/v2 v2.4.1 // indirect
-	github.com/go-openapi/testify/v2 v2.4.1 // indirect
+	github.com/go-openapi/jsonpointer v1.0.0 // indirect
+	github.com/go-openapi/jsonreference v1.0.0 // indirect
+	github.com/go-openapi/spec v0.22.9 // indirect
+	github.com/go-openapi/swag/conv v0.28.0 // indirect
+	github.com/go-openapi/swag/jsonutils v0.28.0 // indirect
+	github.com/go-openapi/swag/loading v0.28.0 // indirect
+	github.com/go-openapi/swag/pools v0.28.0 // indirect
+	github.com/go-openapi/swag/stringutils v0.28.0 // indirect
+	github.com/go-openapi/swag/typeutils v0.28.0 // indirect
+	github.com/go-openapi/swag/yamlutils v0.28.0 // indirect
 	github.com/go-playground/locales v0.14.1 // indirect
 	github.com/go-playground/universal-translator v0.18.1 // indirect
 	github.com/go-redsync/redsync/v4 v4.13.0 // indirect
@@ -147,7 +145,7 @@ require (
 	github.com/googleapis/enterprise-certificate-proxy v0.3.15 // indirect
 	github.com/googleapis/gax-go/v2 v2.17.0 // indirect
 	github.com/gorilla/mux v1.8.1 // indirect
-	github.com/grpc-ecosystem/grpc-gateway/v2 v2.28.0 // indirect
+	github.com/grpc-ecosystem/grpc-gateway/v2 v2.30.0 // indirect
 	github.com/hashicorp/errwrap v1.1.0 // indirect
 	github.com/hashicorp/go-multierror v1.1.1 // indirect
 	github.com/hashicorp/hcl v1.0.0 // indirect
@@ -208,21 +206,21 @@ require (
 	go.mongodb.org/mongo-driver/v2 v2.8.0 // indirect
 	go.opencensus.io v0.24.0 // indirect
 	go.opentelemetry.io/auto/sdk v1.2.1 // indirect
-	go.opentelemetry.io/contrib/instrumentation/net/http/otelhttp v0.66.0 // indirect
+	go.opentelemetry.io/contrib/instrumentation/net/http/otelhttp v0.70.0 // indirect
 	go.opentelemetry.io/otel/metric v1.46.0 // indirect
-	go.opentelemetry.io/proto/otlp v1.10.0 // indirect
+	go.opentelemetry.io/proto/otlp v1.11.0 // indirect
 	go.uber.org/atomic v1.11.0 // indirect
 	go.uber.org/multierr v1.11.0 // indirect
 	go.yaml.in/yaml/v3 v3.0.5 // indirect
 	golang.org/x/arch v0.29.0 // indirect
 	golang.org/x/exp v0.0.0-20250620022241-b7579e27df2b // indirect
 	golang.org/x/mod v0.38.0 // indirect
-	golang.org/x/net v0.57.0 // indirect
+	golang.org/x/net v0.58.0 // indirect
 	golang.org/x/text v0.41.0 // indirect
 	golang.org/x/tools v0.48.0 // indirect
 	google.golang.org/genproto v0.0.0-20260128011058-8636f8732409 // indirect
-	google.golang.org/genproto/googleapis/api v0.0.0-20260209200024-4cfbd4190f57 // indirect
-	google.golang.org/genproto/googleapis/rpc v0.0.0-20260209200024-4cfbd4190f57 // indirect
+	google.golang.org/genproto/googleapis/api v0.0.0-20260819154853-08b0e4226688 // indirect
+	google.golang.org/genproto/googleapis/rpc v0.0.0-20260819154853-08b0e4226688 // indirect
 	gopkg.in/ini.v1 v1.67.0 // indirect
 	gopkg.in/yaml.v2 v2.4.0 // indirect
 	gorm.io/driver/sqlserver v1.4.1 // indirect
```

**File**: `go.sum` (modified, +57/-57)
```diff
@@ -135,8 +135,8 @@ github.com/cloudwego/base64x v0.1.7/go.mod h1:Cu1PV9zfrSf7ET2tIbWbbEy7jO7HHJ13q4
 github.com/cncf/udpa/go v0.0.0-20191209042840-269d4d468f6f/go.mod h1:M8M6+tZqaGXZJjfX53e64911xZQV5JYwmTeXPW+k8Sc=
 github.com/cncf/udpa/go v0.0.0-20200629203442-efcf912fb354/go.mod h1:WmhPx2Nbnhtbo57+VJT5O0JRkEi1Wbu0z5j0R8u5Hbk=
 github.com/cncf/udpa/go v0.0.0-20201120205902-5459f2c99403/go.mod h1:WmhPx2Nbnhtbo57+VJT5O0JRkEi1Wbu0z5j0R8u5Hbk=
-github.com/cncf/xds/go v0.0.0-20251210132809-ee656c7534f5 h1:6xNmx7iTtyBRev0+D/Tv1FZd4SCg8axKApyNyRsAt/w=
-github.com/cncf/xds/go v0.0.0-20251210132809-ee656c7534f5/go.mod h1:KdCmV+x/BuvyMxRnYBlmVaq4OLiKW6iRQfvC62cvdkI=
+github.com/cncf/xds/go v0.0.0-20260202195803-dba9d589def2 h1:aBangftG7EVZoUb69Os8IaYg++6uMOdKK83QtkkvJik=
+github.com/cncf/xds/go v0.0.0-20260202195803-dba9d589def2/go.mod h1:qwXFYgsP6T7XnJtbKlf1HP8AjxZZyzxMmc+Lq5GjlU4=
 github.com/cockroachdb/apd v1.1.0/go.mod h1:8Sl8LxpKi29FqWXR16WEFZRNSz3SoPzUzeMeY4+DwBQ=
 github.com/containerd/log v0.1.0 h1:TCJt7ioM2cr/tfR8GPbGf9/VRAX8D2B4PjzCpfX540I=
 github.com/containerd/log v0.1.0/go.mod h1:VRRf09a7mHDIRezVKTRCrOq78v577GXq3bSa3EhrzVo=
@@ -183,8 +183,8 @@ github.com/envoyproxy/go-control-plane v0.9.4/go.mod h1:6rpuAdCZL397s3pYoYcLgu1m
 github.com/envoyproxy/go-control-plane v0.9.7/go.mod h1:cwu0lG7PUMfa9snN8LXBig5ynNVH9qI8YYLbd1fK2po=
 github.com/envoyproxy/go-control-plane v0.9.9-0.20201210154907-fd9021fe5dad/go.mod h1:cXg6YxExXjJnVBQHBLXeUAgxn2UodCpnH306RInaBQk=
 github.com/envoyproxy/go-control-plane v0.14.0 h1:hbG2kr4RuFj222B6+7T83thSPqLjwBIfQawTkC++2HA=
-github.com/envoyproxy/go-control-plane/envoy v1.36.0 h1:yg/JjO5E7ubRyKX3m07GF3reDNEnfOboJ0QySbH736g=
-github.com/envoyproxy/go-control-plane/envoy v1.36.0/go.mod h1:ty89S1YCCVruQAm9OtKeEkQLTb+Lkz0k8v9W0Oxsv98=
+github.com/envoyproxy/go-control-plane/envoy v1.37.0 h1:u3riX6BoYRfF4Dr7dwSOroNfdSbEPe9Yyl09/B6wBrQ=
+github.com/envoyproxy/go-control-plane/envoy v1.37.0/go.mod h1:DReE9MMrmecPy+YvQOAOHNYMALuowAnbjjEMkkWOi6A=
 github.com/envoyproxy/protoc-gen-validate v0.1.0/go.mod h1:iSmxcyjqTsJpI2R4NaDN7+kN2VEUnK/pcBlmesArF7c=
 github.com/envoyproxy/protoc-gen-validate v1.3.3 h1:MVQghNeW+LZcmXe7SY1V36Z+WFMDjpqGAGacLe2T0ds=
 github.com/envoyproxy/protoc-gen-validate v1.3.3/go.mod h1:TsndJ/ngyIdQRhMcVVGDDHINPLWB7C82oDArY51KfB0=
@@ -237,33 +237,33 @@ github.com/go-logr/logr v1.4.4 h1:tG4xh9yMsRCAiodLVTxyrkzSZ9+o0L1Kg/+cPVcbP/8=
 github.com/go-logr/logr v1.4.4/go.mod h1:9T104GzyrTigFIr8wt5mBrctHMim0Nb2HLGrmQ40KvY=
 github.com/go-logr/stdr v1.2.2 h1:hSWxHoqTgW2S2qGc0LTAI563KZ5YKYRhT3MFKZMbjag=
 github.com/go-logr/stdr v1.2.2/go.mod h1:mMo/vtBO5dYbehREoey6XUKy/eSumjCCveDpRre4VKE=
-github.com/go-openapi/jsonpointer v0.22.5 h1:8on/0Yp4uTb9f4XvTrM2+1CPrV05QPZXu+rvu2o9jcA=
-github.com/go-openapi/jsonpointer v0.22.5/go.mod h1:gyUR3sCvGSWchA2sUBJGluYMbe1zazrYWIkWPjjMUY0=
-github.com/go-openapi/jsonreference v0.21.5 h1:6uCGVXU/aNF13AQNggxfysJ+5ZcU4nEAe+pJyVWRdiE=
-github.com/go-openapi/jsonreference v0.21.5/go.mod h1:u25Bw85sX4E2jzFodh1FOKMTZLcfifd1Q+iKKOUxExw=
-github.com/go-openapi/spec v0.22.4 h1:4pxGjipMKu0FzFiu/DPwN3CTBRlVM2yLf/YTWorYfDQ=
-github.com/go-openapi/spec v0.22.4/go.mod h1:WQ6Ai0VPWMZgMT4XySjlRIE6GP1bGQOtEThn3gcWLtQ=
-github.com/go-openapi/swag v0.19.15 h1:D2NRCBzS9/pEY3gP9Nl8aDqGUcPFrwG2p+CNFrLyrCM=
-github.com/go-openapi/swag/conv v0.25.5 h1:wAXBYEXJjoKwE5+vc9YHhpQOFj2JYBMF2DUi+tGu97g=
-github.com/go-openapi/swag/conv v0.25.5/go.mod h1:CuJ1eWvh1c4ORKx7unQnFGyvBbNlRKbnRyAvDvzWA4k=
-github.com/go-openapi/swag/jsonname v0.25.5 h1:8p150i44rv/Drip4vWI3kGi9+4W9TdI3US3uUYSFhSo=
-github.com/go-openapi/swag/jsonname v0.25.5/go.mod h1:jNqqikyiAK56uS7n8sLkdaNY/uq6+D2m2LANat09pKU=
-github.com/go-openapi/swag/jsonutils v0.25.5 h1:XUZF8awQr75MXeC+/iaw5usY/iM7nXPDwdG3Jbl9vYo=
-github.com/go-openapi/swag/jsonutils v0.25.5/go.mod h1:48FXUaz8YsDAA9s5AnaUvAmry1UcLcNVWUjY42XkrN4=
-github.com/go-openapi/swag/jsonutils/fixtures_test v0.25.5 h1:SX6sE4FrGb4sEnnxbFL/25yZBb5Hcg1inLeErd86Y1U=
-github.com/go-openapi/swag/jsonutils/fixtures_test v0.25.5/go.mod h1:/2KvOTrKWjVA5Xli3DZWdMCZDzz3uV/T7bXwrKWPquo=
-github.com/go-openapi/swag/loading v0.25.5 h1:odQ/umlIZ1ZVRteI6ckSrvP6e2w9UTF5qgNdemJHjuU=
-github.com/go-openapi/swag/loading v0.25.5/go.mod h1:I8A8RaaQ4DApxhPSWLNYWh9NvmX2YKMoB9nwvv6oW6g=
-github.com/go-openapi/swag/stringutils v0.25.5 h1:NVkoDOA8YBgtAR/zvCx5rhJKtZF3IzXcDdwOsYzrB6M=
-github.com/go-openapi/swag/stringutils v0.25.5/go.mod h1:PKK8EZdu4QJq8iezt17HM8RXnLAzY7gW0O1KKarrZII=
-github.com/go-openapi/swag/typeutils v0.25.5 h1:EFJ+PCga2HfHGdo8s8VJXEVbeXRCYwzzr9u4rJk7L7E=
-github.com/go-openapi/swag/typeutils v0.25.5/go.mod h1:itmFmScAYE1bSD8C4rS0W+0InZUBrB2xSPbWt6DLGuc=
-github.com/go-openapi/swag/yamlutils v0.25.5 h1:kASCIS+oIeoc55j28T4o8KwlV2S4ZLPT6G0iq2SSbVQ=
-github.com/go-openapi/swag/yamlutils v0.25.5/go.mod h1:Gek1/SjjfbYvM+Iq4QGwa/2lEXde9n2j4a3wI3pNuOQ=
-github.com/go-openapi/testify/enable/yaml/v2 v2.4.1 h1:NZOrZmIb6PTv5LTFxr5/mKV/FjbUzGE7E6gLz7vFoOQ=
-github.com/go-o
```

---

### Incident Patch 3: `ba405327` (2026-09-21)
**Commit Message**: fix(rpc): exempt gRPC health checks from rate limiting (#5016)

* fix(rpc): let gRPC health checks bypass the server rate limiter

The scheduler and manager gRPC servers put the grpc_ratelimit interceptor
first in the interceptor chain and register the standard health checking
service on the same grpc.Server. Whenever business traffic exhausts the
rate limiter, /grpc.health.v1.Health/Check is rejected with
ResourceExhausted as well, so kubelet liveness/readiness probes fail and
a merely busy pod is restarted or taken out of service.

Add rpc.RateLimitUnaryServerInterceptor and
rpc.RateLimitStreamServerInterceptor, which wrap the upstream
grpc_ratelimit interceptors and let requests whose full method starts with
/grpc.health.v1.Health/ go straight to the handler. Switch the scheduler
and manager servers to them.

Add table-driven unit tests for both interceptors and a bufconn based test
for the scheduler server which verifies that health checks stay SERVING
after the limiter is exhausted while business RPCs are rejected.

Co-authored-by: Sisyphus <[REDACTED_EMAIL]>
Signed-off-by: Yang Kaiyong <[REDACTED_EMAIL]>

* refactor(rpc): exempt health checks from rate limiting with go-grpc-m

**File**: `go.mod` (modified, +2/-1)
```diff
@@ -35,6 +35,7 @@ require (
 	github.com/google/go-github/v83 v83.0.0
 	github.com/google/uuid v1.6.0
 	github.com/grpc-ecosystem/go-grpc-middleware v1.4.0
+	github.com/grpc-ecosystem/go-grpc-middleware/v2 v2.3.4
 	github.com/grpc-ecosystem/go-grpc-prometheus v1.2.0
 	github.com/looplab/fsm v1.0.2
 	github.com/mcuadros/go-gin-prometheus v0.1.0
@@ -215,7 +216,7 @@ require (
 	go.yaml.in/yaml/v2 v2.4.3 // indirect
 	go.yaml.in/yaml/v3 v3.0.5 // indirect
 	golang.org/x/arch v0.29.0 // indirect
-	golang.org/x/exp v0.0.0-20240719175910-8a7402abbf56 // indirect
+	golang.org/x/exp v0.0.0-20250620022241-b7579e27df2b // indirect
 	golang.org/x/mod v0.38.0 // indirect
 	golang.org/x/net v0.57.0 // indirect
 	golang.org/x/text v0.41.0 // indirect
```

**File**: `go.sum` (modified, +4/-2)
```diff
@@ -415,6 +415,8 @@ github.com/gorilla/mux v1.8.1 h1:TuBL49tXwgrFYWhqrNgrUNEY92u81SPhu7sTdzQEiWY=
 github.com/gorilla/mux v1.8.1/go.mod h1:AKf9I4AEqPTmMytcMc0KkNouC66V3BtZ4qD5fmWSiMQ=
 github.com/grpc-ecosystem/go-grpc-middleware v1.4.0 h1:UH//fgunKIs4JdUbpDl1VZCDaL56wXCB/5+wF6uHfaI=
 github.com/grpc-ecosystem/go-grpc-middleware v1.4.0/go.mod h1:g5qyo/la0ALbONm6Vbp88Yd8NsDy6rZz+RcrMPxvld8=
+github.com/grpc-ecosystem/go-grpc-middleware/v2 v2.3.4 h1:9ZJYjPEJpcleIKcqysXOo14NLQYwu23fzmKRFpIjPjc=
+github.com/grpc-ecosystem/go-grpc-middleware/v2 v2.3.4/go.mod h1:0xydIeg2omQ9DH6zYMP24Kk57793rnLUvP8fwdbFvz8=
 github.com/grpc-ecosystem/go-grpc-prometheus v1.2.0 h1:Ovs26xHkKqVztRpIrF/92BcuyuQ/YW4NSIpoGtfXNho=
 github.com/grpc-ecosystem/go-grpc-prometheus v1.2.0/go.mod h1:8NvIoxWQoOIhqOTXgfV/d3M/q6VIi02HzZEHgUlZvzk=
 github.com/grpc-ecosystem/grpc-gateway/v2 v2.28.0 h1:HWRh5R2+9EifMyIHV7ZV+MIZqgz+PMpZ14Jynv3O2Zs=
@@ -886,8 +888,8 @@ golang.org/x/exp v0.0.0-20191227195350-da58074b4299/go.mod h1:2RIsYlXP63K8oxa1u0
 golang.org/x/exp v0.0.0-20200119233911-0405dc783f0a/go.mod h1:2RIsYlXP63K8oxa1u096TMicItID8zy7Y6sNkU49FU4=
 golang.org/x/exp v0.0.0-20200207192155-f17229e696bd/go.mod h1:J/WKrq2StrnmMY6+EHIKF9dgMWnmCNThgcyBT1FY9mM=
 golang.org/x/exp v0.0.0-20200224162631-6cc2880d07d6/go.mod h1:3jZMyOhIsHpP37uCMkUooju7aAi5cS1Q23tOzKc+0MU=
-golang.org/x/exp v0.0.0-20240719175910-8a7402abbf56 h1:2dVuKD2vS7b0QIHQbpyTISPd0LeHDbnYEryqj5Q1ug8=
-golang.org/x/exp v0.0.0-20240719175910-8a7402abbf56/go.mod h1:M4RDyNAINzryxdtnbRXRL/OHtkFuWGRjvuhBJpk2IlY=
+golang.org/x/exp v0.0.0-20250620022241-b7579e27df2b h1:M2rDM6z3Fhozi9O7NWsxAkg/yqS/lQJ6PmkyIV3YP+o=
+golang.org/x/exp v0.0.0-20250620022241-b7579e27df2b/go.mod h1:3//PLf8L/X+8b4vuAfHzxeRUl04Adcb341+IGKfnqS8=
 golang.org/x/image v0.0.0-20190227222117-0694c2d4d067/go.mod h1:kZ7UVZpmo3dzQBMxlp+ypCbDeSB+sBbTgSJuh5dn5js=
 golang.org/x/image v0.0.0-20190802002840-cff245a6509b/go.mod h1:FeLwcggjj3mMvU+oOTbSwawSJRM1uh48EjtB4UJZlP0=
 golang.org/x/lint v0.0.0-20181026193005-c67002cb31c3/go.mod h1:UVdnD1Gm6xHRNCYTkRU2/jEulfH38KcIWyp/GAMgvoE=
```

**File**: `pkg/rpc/interceptor.go` (modified, +8/-0)
```diff
@@ -19,8 +19,10 @@ package rpc
 import (
 	"context"
 
+	"github.com/grpc-ecosystem/go-grpc-middleware/v2/interceptors"
 	"golang.org/x/time/rate"
 	"google.golang.org/grpc"
+	healthpb "google.golang.org/grpc/health/grpc_health_v1"
 
 	"d7y.io/dragonfly/v2/internal/dferrors"
 )
@@ -43,6 +45,12 @@ func (r *RateLimiterInterceptor) Limit() bool {
 	return !r.limiter.Allow()
 }
 
+// AllButHealth is a selector matcher that matches every call except the gRPC health checking service,
+// so that liveness and readiness probes are not affected by the selected interceptor.
+func AllButHealth(_ context.Context, callMeta interceptors.CallMeta) bool {
+	return callMeta.Service != healthpb.Health_ServiceDesc.ServiceName
+}
+
 // ConvertErrorUnaryServerInterceptor returns a new unary server interceptor that convert error when trigger custom error.
 func ConvertErrorUnaryServerInterceptor(ctx context.Context, req any, info *grpc.UnaryServerInfo, handler grpc.UnaryHandler) (any, error) {
 	h, err := handler(ctx, req)
```

**File**: `pkg/rpc/interceptor_test.go` (modified, +41/-0)
```diff
@@ -22,9 +22,11 @@ import (
 	"testing"
 	"time"
 
+	"github.com/grpc-ecosystem/go-grpc-middleware/v2/interceptors"
 	"github.com/stretchr/testify/assert"
 	"google.golang.org/grpc"
 	"google.golang.org/grpc/codes"
+	healthpb "google.golang.org/grpc/health/grpc_health_v1"
 	"google.golang.org/grpc/status"
 
 	commonv1 "d7y.io/api/v2/pkg/apis/common/v1"
@@ -47,6 +49,45 @@ func TestRateLimiterInterceptor_Limit(t *testing.T) {
 	assert.False(limiter.Limit())
 }
 
+func TestAllButHealth(t *testing.T) {
+	tests := []struct {
+		name       string
+		fullMethod string
+		expect     func(t *testing.T, matched bool)
+	}{
+		{
+			name:       "health check is not matched",
+			fullMethod: healthpb.Health_Check_FullMethodName,
+			expect: func(t *testing.T, matched bool) {
+				assert := assert.New(t)
+				assert.False(matched)
+			},
+		},
+		{
+			name:       "health watch is not matched",
+			fullMethod: healthpb.Health_Watch_FullMethodName,
+			expect: func(t *testing.T, matched bool) {
+				assert := assert.New(t)
+				assert.False(matched)
+			},
+		},
+		{
+			name:       "scheduler method is matched",
+			fullMethod: "/scheduler.v2.Scheduler/AnnounceHost",
+			expect: func(t *testing.T, matched bool) {
+				assert := assert.New(t)
+				assert.True(matched)
+			},
+		},
+	}
+
+	for _, tc := range tests {
+		t.Run(tc.name, func(t *testing.T) {
+			tc.expect(t, AllButHealth(context.Background(), interceptors.NewServerCallMeta(tc.fullMethod, nil, nil)))
+		})
+	}
+}
+
 func TestConvertErrorUnaryServerInterceptor(t *testing.T) {
 	plainErr := errors.New("plain error")
 
```

**File**: `pkg/rpc/manager/server/server.go` (modified, +3/-2)
```diff
@@ -24,6 +24,7 @@ import (
 	grpc_zap "github.com/grpc-ecosystem/go-grpc-middleware/logging/zap"
 	grpc_ratelimit "github.com/grpc-ecosystem/go-grpc-middleware/ratelimit"
 	grpc_recovery "github.com/grpc-ecosystem/go-grpc-middleware/recovery"
+	"github.com/grpc-ecosystem/go-grpc-middleware/v2/interceptors/selector"
 	grpc_validator "github.com/grpc-ecosystem/go-grpc-middleware/validator"
 	grpc_prometheus "github.com/grpc-ecosystem/go-grpc-prometheus"
 	"go.opentelemetry.io/contrib/instrumentation/google.golang.org/grpc/otelgrpc"
@@ -69,14 +70,14 @@ func New(managerServerV1 managerv1.ManagerServer, managerServerV2 managerv2.Mana
 			MaxConnectionAgeGrace: DefaultMaxConnectionAgeGrace,
 		}),
 		grpc.UnaryInterceptor(grpc_middleware.ChainUnaryServer(
-			grpc_ratelimit.UnaryServerInterceptor(limiter),
+			selector.UnaryServerInterceptor(grpc_ratelimit.UnaryServerInterceptor(limiter), selector.MatchFunc(rpc.AllButHealth)),
 			grpc_prometheus.UnaryServerInterceptor,
 			grpc_zap.UnaryServerInterceptor(logger.GrpcLogger.Desugar()),
 			grpc_validator.UnaryServerInterceptor(),
 			grpc_recovery.UnaryServerInterceptor(),
 		)),
 		grpc.StreamInterceptor(grpc_middleware.ChainStreamServer(
-			grpc_ratelimit.StreamServerInterceptor(limiter),
+			selector.StreamServerInterceptor(grpc_ratelimit.StreamServerInterceptor(limiter), selector.MatchFunc(rpc.AllButHealth)),
 			grpc_prometheus.StreamServerInterceptor,
 			grpc_zap.StreamServerInterceptor(logger.GrpcLogger.Desugar()),
 			grpc_validator.StreamServerInterceptor(),
```

**File**: `pkg/rpc/scheduler/server/server.go` (modified, +3/-2)
```diff
@@ -24,6 +24,7 @@ import (
 	grpc_zap "github.com/grpc-ecosystem/go-grpc-middleware/logging/zap"
 	grpc_ratelimit "github.com/grpc-ecosystem/go-grpc-middleware/ratelimit"
 	grpc_recovery "github.com/grpc-ecosystem/go-grpc-middleware/recovery"
+	"github.com/grpc-ecosystem/go-grpc-middleware/v2/interceptors/selector"
 	grpc_validator "github.com/grpc-ecosystem/go-grpc-middleware/validator"
 	grpc_prometheus "github.com/grpc-ecosystem/go-grpc-prometheus"
 	"go.opentelemetry.io/contrib/instrumentation/google.golang.org/grpc/otelgrpc"
@@ -69,15 +70,15 @@ func New(schedulerServerV1 schedulerv1.SchedulerServer, schedulerServerV2 schedu
 			MaxConnectionAgeGrace: DefaultMaxConnectionAgeGrace,
 		}),
 		grpc.UnaryInterceptor(grpc_middleware.ChainUnaryServer(
-			grpc_ratelimit.UnaryServerInterceptor(limiter),
+			selector.UnaryServerInterceptor(grpc_ratelimit.UnaryServerInterceptor(limiter), selector.MatchFunc(rpc.AllButHealth)),
 			rpc.ConvertErrorUnaryServerInterceptor,
 			grpc_prometheus.UnaryServerInterceptor,
 			grpc_zap.UnaryServerInterceptor(logger.GrpcLogger.Desugar()),
 			grpc_validator.UnaryServerInterceptor(),
 			grpc_recovery.UnaryServerInterceptor(),
 		)),
 		grpc.StreamInterceptor(grpc_middleware.ChainStreamServer(
-			grpc_ratelimit.StreamServerInterceptor(limiter),
+			selector.StreamServerInterceptor(grpc_ratelimit.StreamServerInterceptor(limiter), selector.MatchFunc(rpc.AllButHealth)),
 			rpc.ConvertErrorStreamServerInterceptor,
 			grpc_prometheus.StreamServerInterceptor,
 			grpc_zap.StreamServerInterceptor(logger.GrpcLogger.Desugar()),
```

**File**: `pkg/rpc/scheduler/server/server_test.go` (added, +100/-0)
```diff
@@ -0,0 +1,100 @@
+/*
+ *     Copyright 2026 The Dragonfly Authors
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
+package server
+
+import (
+	"context"
+	"net"
+	"testing"
+
+	"github.com/stretchr/testify/assert"
+	"google.golang.org/grpc"
+	"google.golang.org/grpc/codes"
+	"google.golang.org/grpc/credentials/insecure"
+	healthpb "google.golang.org/grpc/health/grpc_health_v1"
+	"google.golang.org/grpc/status"
+
+	schedulerv1 "d7y.io/api/v2/pkg/apis/scheduler/v1"
+	schedulerv2 "d7y.io/api/v2/pkg/apis/scheduler/v2"
+
+	logger "d7y.io/dragonfly/v2/internal/dflog"
+)
+
+func TestNew(t *testing.T) {
+	tests := []struct {
+		name   string
+		expect func(t *testing.T, conn *grpc.ClientConn)
+	}{
+		{
+			name: "health check bypasses exhausted rate limiter",
+			expect: func(t *testing.T, conn *grpc.ClientConn) {
+				assert := assert.New(t)
+				resp, err := healthpb.NewHealthClient(conn).Check(context.Background(), &healthpb.HealthCheckRequest{})
+				assert.NoError(err)
+				assert.Equal(healthpb.HealthCheckResponse_SERVING, resp.GetStatus())
+			},
+		},
+		{
+			name: "unary request is rejected by exhausted rate limiter",
+			expect: func(t *testing.T, conn *grpc.ClientConn) {
+				assert := assert.New(t)
+				_, err := schedulerv2.NewSchedulerClient(conn).AnnounceHost(context.Background(), &schedulerv2.AnnounceHostRequest{})
+				assert.Equal(codes.ResourceExhausted, status.Code(err))
+			},
+		},
+		{
+			name: "stream request is rejected by exhausted rate limiter",
+			expect: func(t *testing.T, conn *grpc.ClientConn) {
+				assert := assert.New(t)
+				stream, err := schedulerv2.NewSchedulerClient(conn).AnnouncePeer(context.Background())
+				assert.NoError(err)
+
+				_, err = stream.Recv()
+				assert.Equal(codes.ResourceExhausted, status.Code(err))
+			},
+		},
+	}
+
+	for _, tc := range tests {
+		t.Run(tc.name, func(t *testing.T) {
+			lis, err := net.Listen("tcp", "127.0.0.1:0")
+			if err != nil {
+				t.Fatal(err)
+			}
+
+			svr := New(&schedulerv1.UnimplementedSchedulerServer{}, &schedulerv2.UnimplementedSchedulerServer{}, 1)
+			go func() {
+				if err := svr.Serve(lis); err != nil {
+					logger.Errorf("failed to serve the scheduler: %v", err)
+				}
+			}()
+			t.Cleanup(svr.Stop)
+
+			conn, err := grpc.NewClient(lis.Addr().String(), grpc.WithTransportCredentials(insecure.NewCredentials()))
+			if err != nil {
+				t.Fatal(err)
+			}
+			t.Cleanup(func() { conn.Close() })
+
+			if _, err := schedulerv2.NewSchedulerClient(conn).AnnounceHost(context.Background(), &schedulerv2.AnnounceHostRequest{}); status.Code(err) == codes.ResourceExhausted {
+				t.Fatal(err)
+			}
+
+			tc.expect(t, conn)
+		})
+	}
+}
```

---

### Incident Patch 4: `e05ae1d2` (2026-09-16)
**Commit Message**: chore(deps): bump go.opentelemetry.io/otel/trace from 1.41.0 to 1.46.0 (#5007)

Bumps [go.opentelemetry.io/otel/trace](https://github.com/open-telemetry/opentelemetry-go) from 1.41.0 to 1.46.0.
- [Release notes](https://github.com/open-telemetry/opentelemetry-go/releases)
- [Changelog](https://github.com/open-telemetry/opentelemetry-go/blob/main/CHANGELOG.md)
- [Commits](https://github.com/open-telemetry/opentelemetry-go/compare/v1.41.0...v1.46.0)

---
updated-dependencies:
- dependency-name: go.opentelemetry.io/otel/trace
  dependency-version: 1.46.0
  dependency-type: direct:production
  update-type: version-update:semver-minor
...

Signed-off-by: dependabot[bot] <[REDACTED_EMAIL]>
Co-authored-by: dependabot[bot] <49699333+dependabot[bot]@users.noreply.github.com>

**File**: `go.mod` (modified, +3/-3)
```diff
@@ -53,12 +53,12 @@ require (
 	github.com/swaggo/swag v1.16.6
 	go.opentelemetry.io/contrib/instrumentation/github.com/gin-gonic/gin/otelgin v0.66.0
 	go.opentelemetry.io/contrib/instrumentation/google.golang.org/grpc/otelgrpc v0.66.0
-	go.opentelemetry.io/otel v1.41.0
+	go.opentelemetry.io/otel v1.46.0
 	go.opentelemetry.io/otel/exporters/otlp/otlptrace v1.41.0
 	go.opentelemetry.io/otel/exporters/otlp/otlptrace/otlptracegrpc v1.41.0
 	go.opentelemetry.io/otel/exporters/otlp/otlptrace/otlptracehttp v1.41.0
 	go.opentelemetry.io/otel/sdk v1.41.0
-	go.opentelemetry.io/otel/trace v1.41.0
+	go.opentelemetry.io/otel/trace v1.46.0
 	go.uber.org/mock v0.6.0
 	go.uber.org/zap v1.27.1
 	golang.org/x/crypto v0.55.0
@@ -208,7 +208,7 @@ require (
 	go.opencensus.io v0.24.0 // indirect
 	go.opentelemetry.io/auto/sdk v1.2.1 // indirect
 	go.opentelemetry.io/contrib/instrumentation/net/http/otelhttp v0.66.0 // indirect
-	go.opentelemetry.io/otel/metric v1.41.0 // indirect
+	go.opentelemetry.io/otel/metric v1.46.0 // indirect
 	go.opentelemetry.io/proto/otlp v1.10.0 // indirect
 	go.uber.org/atomic v1.11.0 // indirect
 	go.uber.org/multierr v1.11.0 // indirect
```

**File**: `go.sum` (modified, +6/-6)
```diff
@@ -797,8 +797,8 @@ go.opentelemetry.io/contrib/instrumentation/net/http/otelhttp v0.66.0 h1:PnV4kVn
 go.opentelemetry.io/contrib/instrumentation/net/http/otelhttp v0.66.0/go.mod h1:ofAwF4uinaf8SXdVzzbL4OsxJ3VfeEg3f/F6CeF49/Y=
 go.opentelemetry.io/contrib/propagators/b3 v1.41.0 h1:yzplYIx9maUG/KIq6YhLm2jXOFP+2fdiXGYmubV7l1M=
 go.opentelemetry.io/contrib/propagators/b3 v1.41.0/go.mod h1:7wqcPkVIx1LaxMD5LwqvQ4OUXjusQGOnD/hrGBl6rws=
-go.opentelemetry.io/otel v1.41.0 h1:YlEwVsGAlCvczDILpUXpIpPSL/VPugt7zHThEMLce1c=
-go.opentelemetry.io/otel v1.41.0/go.mod h1:Yt4UwgEKeT05QbLwbyHXEwhnjxNO6D8L5PQP51/46dE=
+go.opentelemetry.io/otel v1.46.0 h1:FHt5/CDyVxi/8IM1CH7VE/rRgq3kLHa2mSTVMO8AWyc=
+go.opentelemetry.io/otel v1.46.0/go.mod h1:Gj3SEScelsNC45tp4nSxRYlS+f5iez7W8XPMCt905kE=
 go.opentelemetry.io/otel/exporters/otlp/otlptrace v1.41.0 h1:ao6Oe+wSebTlQ1OEht7jlYTzQKE+pnx/iNywFvTbuuI=
 go.opentelemetry.io/otel/exporters/otlp/otlptrace v1.41.0/go.mod h1:u3T6vz0gh/NVzgDgiwkgLxpsSF6PaPmo2il0apGJbls=
 go.opentelemetry.io/otel/exporters/otlp/otlptrace/otlptracegrpc v1.41.0 h1:mq/Qcf28TWz719lE3/hMB4KkyDuLJIvgJnFGcd0kEUI=
@@ -807,14 +807,14 @@ go.opentelemetry.io/otel/exporters/otlp/otlptrace/otlptracehttp v1.41.0 h1:inYW9
 go.opentelemetry.io/otel/exporters/otlp/otlptrace/otlptracehttp v1.41.0/go.mod h1:Izur+Wt8gClgMJqO/cZ8wdeeMryJ/xxiOVgFSSfpDTY=
 go.opentelemetry.io/otel/exporters/stdout/stdouttrace v1.41.0 h1:61oRQmYGMW7pXmFjPg1Muy84ndqMxQ6SH2L8fBG8fSY=
 go.opentelemetry.io/otel/exporters/stdout/stdouttrace v1.41.0/go.mod h1:c0z2ubK4RQL+kSDuuFu9WnuXimObon3IiKjJf4NACvU=
-go.opentelemetry.io/otel/metric v1.41.0 h1:rFnDcs4gRzBcsO9tS8LCpgR0dxg4aaxWlJxCno7JlTQ=
-go.opentelemetry.io/otel/metric v1.41.0/go.mod h1:xPvCwd9pU0VN8tPZYzDZV/BMj9CM9vs00GuBjeKhJps=
+go.opentelemetry.io/otel/metric v1.46.0 h1:yBnkXvgV7AXFILZc5K6IZe/CBFF3OS7BJ8ov6/lj0K8=
+go.opentelemetry.io/otel/metric v1.46.0/go.mod h1:iPmdWqifKUdzziPkvvzIJXITl56fQx2mGM/DHLB3/2o=
 go.opentelemetry.io/otel/sdk v1.41.0 h1:YPIEXKmiAwkGl3Gu1huk1aYWwtpRLeskpV+wPisxBp8=
 go.opentelemetry.io/otel/sdk v1.41.0/go.mod h1:ahFdU0G5y8IxglBf0QBJXgSe7agzjE4GiTJ6HT9ud90=
 go.opentelemetry.io/otel/sdk/metric v1.41.0 h1:siZQIYBAUd1rlIWQT2uCxWJxcCO7q3TriaMlf08rXw8=
 go.opentelemetry.io/otel/sdk/metric v1.41.0/go.mod h1:HNBuSvT7ROaGtGI50ArdRLUnvRTRGniSUZbxiWxSO8Y=
-go.opentelemetry.io/otel/trace v1.41.0 h1:Vbk2co6bhj8L59ZJ6/xFTskY+tGAbOnCtQGVVa9TIN0=
-go.opentelemetry.io/otel/trace v1.41.0/go.mod h1:U1NU4ULCoxeDKc09yCWdWe+3QoyweJcISEVa1RBzOis=
+go.opentelemetry.io/otel/trace v1.46.0 h1:OULy7ccdJnZtJ0UDYFOIGaCmiWzJ8Vi2G/Rsu60qs1c=
+go.opentelemetry.io/otel/trace v1.46.0/go.mod h1:J7GAXweO77XSFkB/rmAqk9D6ihszhFjLU+d9WuUxDLI=
 go.opentelemetry.io/proto/otlp v1.10.0 h1:IQRWgT5srOCYfiWnpqUYz9CVmbO8bFmKcwYxpuCSL2g=
 go.opentelemetry.io/proto/otlp v1.10.0/go.mod h1:/CV4QoCR/S9yaPj8utp3lvQPoqMtxXdzn7ozvvozVqk=
 go.uber.org/atomic v1.3.2/go.mod h1:gD2HeocX3+yG+ygLZcrzQJaqmWj9AIm7n08wl/qW/PE=
```

---

### Incident Patch 5: `d78e9a2d` (2026-09-02)
**Commit Message**: chore(deps): bump go.opentelemetry.io/otel/exporters/otlp/otlptrace/otlptracegrpc from 1.45.0 to 1.46.0 (#4980)

chore(deps): bump go.opentelemetry.io/otel/exporters/otlp/otlptrace/otlptracegrpc

Bumps [go.opentelemetry.io/otel/exporters/otlp/otlptrace/otlptracegrpc](https://github.com/open-telemetry/opentelemetry-go) from 1.45.0 to 1.46.0.
- [Release notes](https://github.com/open-telemetry/opentelemetry-go/releases)
- [Changelog](https://github.com/open-telemetry/opentelemetry-go/blob/main/CHANGELOG.md)
- [Commits](https://github.com/open-telemetry/opentelemetry-go/compare/v1.45.0...v1.46.0)

---
updated-dependencies:
- dependency-name: go.opentelemetry.io/otel/exporters/otlp/otlptrace/otlptracegrpc
  dependency-version: 1.46.0
  dependency-type: direct:production
  update-type: version-update:semver-minor
...

Signed-off-by: dependabot[bot] <[REDACTED_EMAIL]>
Co-authored-by: dependabot[bot] <49699333+dependabot[bot]@users.noreply.github.com>

**File**: `go.mod` (modified, +22/-18)
```diff
@@ -53,12 +53,12 @@ require (
 	github.com/swaggo/swag v1.16.6
 	go.opentelemetry.io/contrib/instrumentation/github.com/gin-gonic/gin/otelgin v0.70.0
 	go.opentelemetry.io/contrib/instrumentation/google.golang.org/grpc/otelgrpc v0.70.0
-	go.opentelemetry.io/otel v1.45.0
-	go.opentelemetry.io/otel/exporters/otlp/otlptrace v1.45.0
-	go.opentelemetry.io/otel/exporters/otlp/otlptrace/otlptracegrpc v1.45.0
+	go.opentelemetry.io/otel v1.46.0
+	go.opentelemetry.io/otel/exporters/otlp/otlptrace v1.46.0
+	go.opentelemetry.io/otel/exporters/otlp/otlptrace/otlptracegrpc v1.46.0
 	go.opentelemetry.io/otel/exporters/otlp/otlptrace/otlptracehttp v1.44.0
-	go.opentelemetry.io/otel/sdk v1.45.0
-	go.opentelemetry.io/otel/trace v1.45.0
+	go.opentelemetry.io/otel/sdk v1.46.0
+	go.opentelemetry.io/otel/trace v1.46.0
 	go.uber.org/mock v0.6.0
 	go.uber.org/zap v1.27.1
 	golang.org/x/crypto v0.55.0
@@ -108,17 +108,23 @@ require (
 	github.com/docker/go-metrics v0.0.1 // indirect
 	github.com/docker/libtrust v0.0.0-20150114040149-fa567046d9b1 // indirect
 	github.com/envoyproxy/protoc-gen-validate v1.3.3 // indirect
-	github.com/felixge/httpsnoop v1.0.4 // indirect
+	github.com/felixge/httpsnoop v1.1.0 // indirect
 	github.com/fsnotify/fsnotify v1.7.0 // indirect
 	github.com/gabriel-vasile/mimetype v1.4.15 // indirect
 	github.com/gin-contrib/sse v1.1.1 // indirect
 	github.com/go-echarts/go-echarts/v2 v2.2.4 // indirect
 	github.com/go-logr/logr v1.4.4 // indirect
 	github.com/go-logr/stdr v1.2.2 // indirect
-	github.com/go-openapi/jsonpointer v0.21.0 // indirect
-	github.com/go-openapi/jsonreference v0.20.2 // indirect
-	github.com/go-openapi/spec v0.20.6 // indirect
-	github.com/go-openapi/swag v0.23.0 // indirect
+	github.com/go-openapi/jsonpointer v1.0.0 // indirect
+	github.com/go-openapi/jsonreference v1.0.0 // indirect
+	github.com/go-openapi/spec v0.22.9 // indirect
+	github.com/go-openapi/swag/conv v0.28.0 // indirect
+	github.com/go-openapi/swag/jsonutils v0.28.0 // indirect
+	github.com/go-openapi/swag/loading v0.28.0 // indirect
+	github.com/go-openapi/swag/pools v0.28.0 // indirect
+	github.com/go-openapi/swag/stringutils v0.28.0 // indirect
+	github.com/go-openapi/swag/typeutils v0.28.0 // indirect
+	github.com/go-openapi/swag/yamlutils v0.28.0 // indirect
 	github.com/go-playground/locales v0.14.1 // indirect
 	github.com/go-playground/universal-translator v0.18.1 // indirect
 	github.com/go-redsync/redsync/v4 v4.13.0 // indirect
@@ -138,7 +144,7 @@ require (
 	github.com/googleapis/enterprise-certificate-proxy v0.3.20 // indirect
 	github.com/googleapis/gax-go/v2 v2.23.0 // indirect
 	github.com/gorilla/mux v1.8.1 // indirect
-	github.com/grpc-ecosystem/grpc-gateway/v2 v2.29.0 // indirect
+	github.com/grpc-ecosystem/grpc-gateway/v2 v2.30.0 // indirect
 	github.com/hashicorp/errwrap v1.1.0 // indirect
 	github.com/hashicorp/go-multierror v1.1.1 // indirect
 	github.com/hashicorp/hcl v1.0.0 // indirect
@@ -150,15 +156,13 @@ require (
 	github.com/jinzhu/inflection v1.0.0 // indirect
 	github.com/jinzhu/now v1.1.5 // indirect
 	github.com/jmespath/go-jmespath v0.4.0 // indirect
-	github.com/josharian/intern v1.0.0 // indirect
 	github.com/json-iterator/go v1.1.12 // indirect
 	github.com/kelseyhightower/envconfig v1.4.0 // indirect
 	github.com/klauspost/compress v1.19.1 // indirect
 	github.com/klauspost/cpuid/v2 v2.4.0 // indirect
 	github.com/leodido/go-urn v1.5.0 // indirect
 	github.com/lib/pq v1.10.9 // indirect
 	github.com/magiconair/properties v1.8.7 // indirect
-	github.com/mailru/easyjson v0.7.7 // indirect
 	github.com/mattn/go-isatty v0.0.24 // indirect
 	github.com/mattn/go-sqlite3 v1.14.15 // indirect
 	github.com/microsoft/go-mssqldb v0.17.0 // indirect
@@ -201,21 +205,21 @@ require (
 	go.mongodb.org/mongo-driver/v2 v2.8.0 // indirect
 	go.opencensus.io v0.24.0 // indirect
 	go.opentelemetry.io/auto/sdk v1.2.1 // indirect
-	go.opentelemetry.io/contrib/instrumentation/net/http/otelhttp v0.67.0 // indirect
-	go.opentelemetry.io/otel/metric v1.45.0 // indirect
+	go.opentelemetry.io/contrib/instrumentation/net/http/otelhttp v0.70.0 // indirect
+	go.opentelemetry.io/otel/metric v1.46.0 // indirect
 	go.opentelemetry.io/proto/otlp v1.11.0 // indirect
 	go.uber.org/atomic v1.11.0 // indirect
 	go.uber.org/multierr v1.11.0 // indirect
 	go.yaml.in/yaml/v3 v3.0.5 // indirect
 	golang.org/x/arch v0.29.0 // indirect
 	golang.org/x/exp v0.0.0-20240719175910-8a7402abbf56 // indirect
 	golang.org/x/mod v0.38.0 // indirect
-	golang.org/x/net v0.57.0 // indirect
+	golang.org/x/net v0.58.0 // indirect
 	golang.org/x/text v0.41.0 // indirect
 	golang.org/x/tools v0.48.0 // indirect
 	google.golang.org/genproto v0.0.0-20260319201613-d00831a3d3e7 // indirect
-	google.golang.org/genproto/googleapis/api v0.0.0-20260803160001-6ac0973c030d // indirect
-	google.golang.org/genproto/googleapis/rpc v0.0.0-20260807164820-c8921c73eeea // indirect
+	google.golang.org/genproto/googleapis/api v0.0.0-20260819154853-08b0e4226688 // 
```

**File**: `go.sum` (modified, +53/-51)
```diff
@@ -188,8 +188,8 @@ github.com/envoyproxy/go-control-plane/envoy v1.37.0/go.mod h1:DReE9MMrmecPy+YvQ
 github.com/envoyproxy/protoc-gen-validate v0.1.0/go.mod h1:iSmxcyjqTsJpI2R4NaDN7+kN2VEUnK/pcBlmesArF7c=
 github.com/envoyproxy/protoc-gen-validate v1.3.3 h1:MVQghNeW+LZcmXe7SY1V36Z+WFMDjpqGAGacLe2T0ds=
 github.com/envoyproxy/protoc-gen-validate v1.3.3/go.mod h1:TsndJ/ngyIdQRhMcVVGDDHINPLWB7C82oDArY51KfB0=
-github.com/felixge/httpsnoop v1.0.4 h1:NFTV2Zj1bL4mc9sqWACXbQFVBBg2W3GPvqp8/ESS2Wg=
-github.com/felixge/httpsnoop v1.0.4/go.mod h1:m8KPJKqk1gH5J9DgRY2ASl2lWCfGKXixSwevea8zH2U=
+github.com/felixge/httpsnoop v1.1.0 h1:3YtUj32ZZkqZtt3sZZsClsymw/QDuVfpNhoA31zeORc=
+github.com/felixge/httpsnoop v1.1.0/go.mod h1:Zqxgdd+1Rkcz8euOqdr7lqgCRJztwr5hp9vDSi5UZCE=
 github.com/frankban/quicktest v1.14.6 h1:7Xjx+VpznH+oBnejlPUj8oUpdxnVs4f8XU8WnHkI4W8=
 github.com/frankban/quicktest v1.14.6/go.mod h1:4ptaffx2x8+WTWXmUCuVU6aPUX1/Mz7zb5vbUoiM6w0=
 github.com/fsnotify/fsnotify v1.4.7/go.mod h1:jwhsz4b93w/PPRr/qN1Yymfu8t87LnFCMoQvtojpjFo=
@@ -237,21 +237,33 @@ github.com/go-logr/logr v1.4.4 h1:tG4xh9yMsRCAiodLVTxyrkzSZ9+o0L1Kg/+cPVcbP/8=
 github.com/go-logr/logr v1.4.4/go.mod h1:9T104GzyrTigFIr8wt5mBrctHMim0Nb2HLGrmQ40KvY=
 github.com/go-logr/stdr v1.2.2 h1:hSWxHoqTgW2S2qGc0LTAI563KZ5YKYRhT3MFKZMbjag=
 github.com/go-logr/stdr v1.2.2/go.mod h1:mMo/vtBO5dYbehREoey6XUKy/eSumjCCveDpRre4VKE=
-github.com/go-openapi/jsonpointer v0.19.3/go.mod h1:Pl9vOtqEWErmShwVjC8pYs9cog34VGT37dQOVbmoatg=
-github.com/go-openapi/jsonpointer v0.19.5/go.mod h1:Pl9vOtqEWErmShwVjC8pYs9cog34VGT37dQOVbmoatg=
-github.com/go-openapi/jsonpointer v0.19.6/go.mod h1:osyAmYz/mB/C3I+WsTTSgw1ONzaLJoLCyoi6/zppojs=
-github.com/go-openapi/jsonpointer v0.21.0 h1:YgdVicSA9vH5RiHs9TZW5oyafXZFc6+2Vc1rr/O9oNQ=
-github.com/go-openapi/jsonpointer v0.21.0/go.mod h1:IUyH9l/+uyhIYQ/PXVA41Rexl+kOkAPDdXEYns6fzUY=
-github.com/go-openapi/jsonreference v0.20.0/go.mod h1:Ag74Ico3lPc+zR+qjn4XBUmXymS4zJbYVCZmcgkasdo=
-github.com/go-openapi/jsonreference v0.20.2 h1:3sVjiK66+uXK/6oQ8xgcRKcFgQ5KXa2KvnJRumpMGbE=
-github.com/go-openapi/jsonreference v0.20.2/go.mod h1:Bl1zwGIM8/wsvqjsOQLJ/SH+En5Ap4rVB5KVcIDZG2k=
-github.com/go-openapi/spec v0.20.6 h1:ich1RQ3WDbfoeTqTAb+5EIxNmpKVJZWBNah9RAT0jIQ=
-github.com/go-openapi/spec v0.20.6/go.mod h1:2OpW+JddWPrpXSCIX8eOx7lZ5iyuWj3RYR6VaaBKcWA=
-github.com/go-openapi/swag v0.19.5/go.mod h1:POnQmlKehdgb5mhVOsnJFsivZCEZ/vjK9gh66Z9tfKk=
-github.com/go-openapi/swag v0.19.15/go.mod h1:QYRuS/SOXUCsnplDa677K7+DxSOj6IPNl/eQntq43wQ=
-github.com/go-openapi/swag v0.22.3/go.mod h1:UzaqsxGiab7freDnrUUra0MwWfN/q7tE4j+VcZ0yl14=
-github.com/go-openapi/swag v0.23.0 h1:vsEVJDUo2hPJ2tu0/Xc+4noaxyEffXNIs3cOULZ+GrE=
-github.com/go-openapi/swag v0.23.0/go.mod h1:esZ8ITTYEsH1V2trKHjAN8Ai7xHb8RV+YSZ577vPjgQ=
+github.com/go-openapi/jsonpointer v1.0.0 h1:kR9tHqY0CtZaOPVFm622dPVNhrvYpwr4uCxgL3h1H8s=
+github.com/go-openapi/jsonpointer v1.0.0/go.mod h1:Z3rw7dWu1p9IgitXCFamSlA5lmDiklEB6vkaxcNZW5Y=
+github.com/go-openapi/jsonreference v1.0.0 h1:jlmTr6torcd1YgDQvSfNmRtKzYDO4FGBkrAdlAVWnpY=
+github.com/go-openapi/jsonreference v1.0.0/go.mod h1:jtwdyGbJk0Xhe5Y+rwtglQP6Sb1WZST4rT32LWB+sv0=
+github.com/go-openapi/spec v0.22.9 h1:/vKIFDcGKp0ktZWGbym/tJEWbk6/XOEmAVU0kqKMH+w=
+github.com/go-openapi/spec v0.22.9/go.mod h1:b/mNUYIOQOyIiUzUzXEE8xzyZqf93KvM9hQGP91yfl0=
+github.com/go-openapi/swag v0.28.0 h1:xkgbOSKj6DZziNpyqRRAOt3GJGtgjgsd2RoyT30VWuw=
+github.com/go-openapi/swag/conv v0.28.0 h1:GtqqbyFe7vR5Y7ehxG9W6/OvrSFdf1OLeTGp40TqxH8=
+github.com/go-openapi/swag/conv v0.28.0/go.mod h1:mbUE+mzctnhxi864m0Q07SpN8OowD9JhxmxuYvZZD/k=
+github.com/go-openapi/swag/jsonutils v0.28.0 h1:YIch6FwO7RXzeAnbO8Tu7dWBZeUEH+4nA0HXltVTnv4=
+github.com/go-openapi/swag/jsonutils v0.28.0/go.mod h1:CYM3WlTUcagR2ZoHdz54di/cbBqt82tuxuXgAjxw+mg=
+github.com/go-openapi/swag/jsonutils/fixtures_test v0.28.0 h1:qV+VVUAx5Oro8WjVWpZeql7YReTKhT4smR4zhcOQZr0=
+github.com/go-openapi/swag/jsonutils/fixtures_test v0.28.0/go.mod h1:mofwUWx70wvskwESqRJ//k/9kURmCgyJl5m5Ppoh5kY=
+github.com/go-openapi/swag/loading v0.28.0 h1:td8QZdZC9MIYGGSnSPKShKiK22I2tU5UQvuUhIBPRLU=
+github.com/go-openapi/swag/loading v0.28.0/go.mod h1:rXB0QiQX5mMveXEA7ouM4KiiM9jVJe4K6BVbwhD1M4k=
+github.com/go-openapi/swag/pools v0.28.0 h1:HPMZWSAfce3rdVTFcjFiCIBtDg9h4x2QlRrHipwhxeU=
+github.com/go-openapi/swag/pools v0.28.0/go.mod h1:kVQefhSK5RWuRe7BXsL8htgBPAMpN7HDGpGEknqugeE=
+github.com/go-openapi/swag/stringutils v0.28.0 h1:ixsc9iYgDPubHL/8nSkbnryEHpD2VRlBMLKpQyPXcDU=
+github.com/go-openapi/swag/stringutils v0.28.0/go.mod h1:lzRN95CxXmA03XcDWHLOb6nOMcxCqR5rGY0lOgsfRoM=
+github.com/go-openapi/swag/typeutils v0.28.0 h1:nRBKSBXjDgf01VDPB3fWeD9nQuhCOVeIYAkUx2tbkyY=
+github.com/go-openapi/swag/typeutils v0.28.0/go.mod h1:Srm0xFNRZ1Y+vCxJclo5qzx8aj+1pAKda/YfFPrG0dQ=
+github.com/go-openapi/swag/yamlutils v0.28.0 h1:TV3JXH6DS46KUroDtMLAYHGkdWf5VDq3wVWFirmzROY=
+github.com/go-openapi/swag/yamlutils v0.28.0/go.mod h1:x0q/yndZHEgk9Rx3DyDqzFUmHy55KTvIZldvF2dTJXs=
+g
```

---

### Incident Patch 6: `bbe7f794` (2026-08-27)
**Commit Message**: fix(scheduler): clear stale seed peer snapshots (#4961)

* fix(scheduler): clear stale seed peer snapshots

Refresh and atomically publish an empty seed peer snapshot when no seeds remain, preventing stale hosts from being selected.

Co-authored-by: Sisyphus <[REDACTED_EMAIL]>
Signed-off-by: Yang Kaiyong <[REDACTED_EMAIL]>

* refactor(scheduler): rename snapshotMutex to mu and improve seed peer tests

Rename `snapshotMutex` to `mu` with a clearer comment, update error message from "no seed peer available" to "no available seed peer", and restructure tests to use table-driven setup with real gRPC health servers for healthy/unhealthy host scenarios.

Signed-off-by: Gaius <[REDACTED_EMAIL]>

---------

Signed-off-by: Yang Kaiyong <[REDACTED_EMAIL]>
Signed-off-by: Gaius <[REDACTED_EMAIL]>
Co-authored-by: Sisyphus <[REDACTED_EMAIL]>
Co-authored-by: Gaius <[REDACTED_EMAIL]>

**File**: `scheduler/resource/standard/seed_peer.go` (modified, +16/-6)
```diff
@@ -94,6 +94,9 @@ type seedPeer struct {
 	// dialOpts is the options for grpc dial.
 	dialOptions []grpc.DialOption
 
+	// mu protects hosts and hashring, which are replaced together by refresh.
+	mu sync.RWMutex
+
 	// hosts is the list of seed peers.
 	hosts *sync.Map
 
@@ -285,9 +288,11 @@ func (s *seedPeer) TriggerTask(ctx context.Context, rg *http.Range, task *Task)
 
 // Select selects a seed peer by the task id.
 func (s *seedPeer) Select(ctx context.Context, taskID string) (*Host, error) {
-	// The synchronization of the hash ring is handled by the refreshSeedPeers periodically and asynchronously.
+	s.mu.RLock()
+	defer s.mu.RUnlock()
+
 	if len(s.hashring.Members()) == 0 {
-		return nil, fmt.Errorf("no seed peer available")
+		return nil, fmt.Errorf("no available seed peer")
 	}
 
 	addr, err := s.hashring.Get(taskID)
@@ -305,6 +310,9 @@ func (s *seedPeer) Select(ctx context.Context, taskID string) (*Host, error) {
 
 // HasAvailable returns whether there is any available seed peer.
 func (s *seedPeer) HasAvailable() bool {
+	s.mu.RLock()
+	defer s.mu.RUnlock()
+
 	return len(s.hashring.Members()) > 0
 }
 
@@ -342,15 +350,15 @@ func (s *seedPeer) initSeedPeer(ctx context.Context, rg *http.Range, task *Task,
 	return peer, nil
 }
 
+// refresh refreshes the hosts and hashring of seed peers, and clears
+// them when no seed peer is found in host manager.
 func (s *seedPeer) refresh(ctx context.Context) {
 	hosts := s.hostManager.LoadAllSeeds()
 	if len(hosts) == 0 {
 		logger.Warnf("no seed peer found in host manager")
-		return
 	}
 
 	healthyHosts := &sync.Map{}
-	// Do the health check for each seed peer.
 	for _, host := range hosts {
 		addr := net.JoinHostPort(host.IP, strconv.Itoa(int(host.Port)))
 		if err := healthclient.Check(ctx, addr, s.dialOptions...); err != nil {
@@ -359,15 +367,17 @@ func (s *seedPeer) refresh(ctx context.Context) {
 			healthyHosts.Store(addr, host)
 		}
 	}
-	s.hosts = healthyHosts
 
 	hashring := consistent.New()
-	s.hosts.Range(func(addr, _ any) bool {
+	healthyHosts.Range(func(addr, _ any) bool {
 		hashring.Add(addr.(string))
 		return true
 	})
 
+	s.mu.Lock()
+	s.hosts = healthyHosts
 	s.hashring = hashring
+	s.mu.Unlock()
 }
 
 // Serve serves the seed peer service.
```

**File**: `scheduler/resource/standard/seed_peer_test.go` (modified, +167/-2)
```diff
@@ -18,18 +18,67 @@ package standard
 
 import (
 	"context"
+	"net"
 	"reflect"
+	"sync"
 	"testing"
 
 	"github.com/stretchr/testify/assert"
 	gomock "go.uber.org/mock/gomock"
+	"google.golang.org/grpc"
+	"google.golang.org/grpc/credentials/insecure"
+	"google.golang.org/grpc/health"
+	healthpb "google.golang.org/grpc/health/grpc_health_v1"
 
 	commonv2 "d7y.io/api/v2/pkg/apis/common/v2"
 	dfdaemonv2 "d7y.io/api/v2/pkg/apis/dfdaemon/v2"
 	schedulerv1 "d7y.io/api/v2/pkg/apis/scheduler/v1"
+	logger "d7y.io/dragonfly/v2/internal/dflog"
 	dfdaemonclientmocks "d7y.io/dragonfly/v2/pkg/rpc/dfdaemon/client/mocks"
 )
 
+func mockSeedHost(port int32) *Host {
+	return NewHost(
+		mockRawSeedHost.ID, mockRawSeedHost.IP, mockRawSeedHost.Name, mockRawSeedHost.Hostname,
+		port, mockRawSeedHost.DownloadPort, mockRawSeedHost.ProxyPort, mockRawSeedHost.Type)
+}
+
+func mockSeedHostServer(t *testing.T) *Host {
+	t.Helper()
+
+	lis, err := net.Listen("tcp", "127.0.0.1:0")
+	if err != nil {
+		t.Fatal(err)
+	}
+
+	svr := grpc.NewServer()
+	healthpb.RegisterHealthServer(svr, health.NewServer())
+	go func() {
+		if err := svr.Serve(lis); err != nil {
+			logger.Errorf("failed to serve the health service: %v", err)
+		}
+	}()
+	t.Cleanup(svr.Stop)
+
+	return mockSeedHost(int32(lis.Addr().(*net.TCPAddr).Port))
+}
+
+func mockUnreachableSeedHost(t *testing.T) *Host {
+	t.Helper()
+
+	lis, err := net.Listen("tcp", "127.0.0.1:0")
+	if err != nil {
+		t.Fatal(err)
+	}
+
+	port := int32(lis.Addr().(*net.TCPAddr).Port)
+	if err := lis.Close(); err != nil {
+		t.Fatal(err)
+	}
+
+	return mockSeedHost(port)
+}
+
 func TestSeedPeer_newSeedPeer(t *testing.T) {
 	tests := []struct {
 		name   string
@@ -57,6 +106,122 @@ func TestSeedPeer_newSeedPeer(t *testing.T) {
 	}
 }
 
+func TestSeedPeer_refresh(t *testing.T) {
+	tests := []struct {
+		name   string
+		hosts  func(t *testing.T) []*Host
+		mock   func(m *MockHostManagerMockRecorder, hosts []*Host)
+		expect func(t *testing.T, seedPeer *seedPeer, hosts []*Host)
+	}{
+		{
+			name: "refresh healthy seed peer",
+			hosts: func(t *testing.T) []*Host {
+				return []*Host{mockSeedHostServer(t)}
+			},
+			mock: func(m *MockHostManagerMockRecorder, hosts []*Host) {
+				m.LoadAllSeeds().Return(hosts)
+			},
+			expect: func(t *testing.T, seedPeer *seedPeer, hosts []*Host) {
+				assert := assert.New(t)
+				seedPeer.refresh(context.Background())
+				assert.True(seedPeer.HasAvailable())
+
+				host, err := seedPeer.Select(context.Background(), mockTaskID)
+				assert.NoError(err)
+				assert.Equal(hosts[0].ID, host.ID)
+			},
+		},
+		{
+			name: "filter unhealthy seed peer",
+			hosts: func(t *testing.T) []*Host {
+				return []*Host{mockUnreachableSeedHost(t)}
+			},
+			mock: func(m *MockHostManagerMockRecorder, hosts []*Host) {
+				m.LoadAllSeeds().Return(hosts)
+			},
+			expect: func(t *testing.T, seedPeer *seedPeer, hosts []*Host) {
+				assert := assert.New(t)
+				seedPeer.refresh(context.Background())
+				assert.False(seedPeer.HasAvailable())
+
+				_, err := seedPeer.Select(context.Background(), mockTaskID)
+				assert.EqualError(err, "no available seed peer")
+			},
+		},
+		{
+			name: "clear stale seed peers when host manager is empty",
+			hosts: func(t *testing.T) []*Host {
+				return []*Host{}
+			},
+			mock: func(m *MockHostManagerMockRecorder, hosts []*Host) {
+				m.LoadAllSeeds().Return(hosts)
+			},
+			expect: func(t *testing.T, seedPeer *seedPeer, hosts []*Host) {
+				assert := assert.New(t)
+				mockAddr := "127.0.0.1:4000"
+				seedPeer.hosts.Store(mockAddr, &Host{})
+				seedPeer.hashring.Add(mockAddr)
+
+				seedPeer.refresh(context.Background())
+				_, loaded := seedPeer.hosts.Load(mockAddr)
+				assert.False(loaded)
+				assert.False(seedPeer.HasAvailable())
+
+				_, err := seedPeer.Select(context.Background(), mockTaskID)
+				assert.EqualError(err, "no available seed peer")
+			},
+		},
+		{
+			name: "refresh and select concurrently",
+			hosts: func(t *testing.T) []*Host {
+				return []*Host{}
+			},
+			mock: func(m *MockHostManagerMockRecorder, hosts []*Host) {
+				m.LoadAllSeeds().Return(hosts).AnyTimes()
+			},
+			expect: func(t *testing.T, seedPeer *seedPeer, hosts []*Host) {
+				var wg sync.WaitGroup
+				wg.Add(2)
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
+						seedPeer.HasAvailable()
+						if _, err := seedPeer.Select(context.Background(), mockTaskID); err == nil {
+							assert.Fail(t, "select should fail when no seed peer is available")
+						}
+					}
+				}()
+
+				wg.Wait()
+			},
+		},
+	}
+
+	for _, tc := range tests {
+		t.Run(tc.name, func(t *testing.T) {
+			ctl := gomock.NewController(t)
+			defer ctl.Finish()
+			hostManager := NewMockHostManager(ctl)
+			peerManager := NewMockPeerManager(ctl)
+			clientPool := dfdaemonclientmocks.NewMockPool(ctl)
+
+			hosts := tc.hosts(t)
+			tc
```

---

### Incident Patch 7: `26f1f47e` (2026-08-25)
**Commit Message**: Fix task ID generation error handling in StatImage (#4973)

fix(scheduler): propagate task ID generation errors in StatImage

Previously, task ID generation errors in StatImage goroutines were silently swallowed, causing the request to proceed with an empty task ID. Now errors are returned immediately with an InvalidArgument status before spawning goroutines.

Signed-off-by: Gaius <[REDACTED_EMAIL]>

**File**: `pkg/idgen/task_id_test.go` (modified, +48/-0)
```diff
@@ -166,6 +166,54 @@ func TestTaskIDV2ByURLBased(t *testing.T) {
 				assert.Equal(d, "b171331534b80e0bf91da38ebbfcdbf4d177898f4b9beac44f14733e3f004d4e")
 			},
 		},
+		{
+			name:        "generate taskID with sorted query params",
+			url:         "https://example.com/file.txt?z=9&b=2&a=1",
+			tag:         "foo",
+			application: "bar",
+			filters:     []string{"z"},
+			expect: func(t *testing.T, d any) {
+				assert := assert.New(t)
+				assert.Equal(d, "8b3f6e9b9b8fe20903bced565cfd1d0aaef354a4c17573f0c2c1979210443f9d")
+			},
+		},
+		{
+			name:    "generate taskID with same key query params keeping order",
+			url:     "https://example.com/file.txt?b=2&a=1&b=1",
+			filters: []string{"c"},
+			expect: func(t *testing.T, d any) {
+				assert := assert.New(t)
+				assert.Equal(d, "7c8801d0596be5e8f9449d5c4af23866c72fe5205119c0e5912981f3b16a37aa")
+			},
+		},
+		{
+			name:        "generate taskID with escaped query params",
+			url:         "https://example.com/file.txt?k=a b&m=x*y&n=c~d",
+			pieceLength: &pieceLength,
+			filters:     []string{"none"},
+			expect: func(t *testing.T, d any) {
+				assert := assert.New(t)
+				assert.Equal(d, "6196a6846023f6d3c1e4d30f6c86f3d4186e4c664a33e5692b0e04e49b26a9af")
+			},
+		},
+		{
+			name:    "generate taskID with all query params filtered",
+			url:     "https://example.com/file.txt?a=1&b=2",
+			tag:     "foo",
+			filters: []string{"a", "b"},
+			expect: func(t *testing.T, d any) {
+				assert := assert.New(t)
+				assert.Equal(d, "c8f4b41117329d54af920010394f6f607bac707e933ab2f18d372e3dd4c7fcb3")
+			},
+		},
+		{
+			name: "generate taskID with raw url when no filters",
+			url:  "https://example.com/file.txt?b=2&a=1",
+			expect: func(t *testing.T, d any) {
+				assert := assert.New(t)
+				assert.Equal(d, "980ee327518ccc5a7c30703e1a2232e8ba9047b39431f940636c85b6146f8b9a")
+			},
+		},
 	}
 
 	for _, tc := range tests {
```

**File**: `pkg/net/url/url_test.go` (modified, +20/-0)
```diff
@@ -31,6 +31,26 @@ func TestFilterQuery(t *testing.T) {
 	assert.Nil(t, err)
 	assert.Equal(t, "http://www.xx.yy/path?u=f&x=y&m=z&x=s#size", url)
 
+	url, err = FilterQueryParams("https://example.com/file.txt?z=9&b=2&a=1", []string{"z"})
+	assert.Nil(t, err)
+	assert.Equal(t, "https://example.com/file.txt?a=1&b=2", url)
+
+	url, err = FilterQueryParams("https://example.com/file.txt?b=2&a=1&b=1", []string{"c"})
+	assert.Nil(t, err)
+	assert.Equal(t, "https://example.com/file.txt?a=1&b=2&b=1", url)
+
+	url, err = FilterQueryParams("https://example.com?foo=foo", []string{"foo"})
+	assert.Nil(t, err)
+	assert.Equal(t, "https://example.com", url)
+
+	url, err = FilterQueryParams("https://example.com/file.txt?k=a b&m=x*y&n=c~d", []string{"none"})
+	assert.Nil(t, err)
+	assert.Equal(t, "https://example.com/file.txt?k=a+b&m=x%2Ay&n=c~d", url)
+
+	url, err = FilterQueryParams("https://example.com/file.txt?a=1;x&b=2", []string{"none"})
+	assert.Nil(t, err)
+	assert.Equal(t, "https://example.com/file.txt?b=2", url)
+
 	url, err = FilterQueryParams(":error_url", []string{"x", "m"})
 	assert.NotNil(t, err)
 	assert.Equal(t, "", url)
```

**File**: `scheduler/service/service_v2.go` (modified, +11/-6)
```diff
@@ -4681,19 +4681,24 @@ func (v *V2) StatImage(ctx context.Context, req *schedulerv2.StatImageRequest) (
 	scope := req.GetScope()
 	enableTaskIDBasedBlobDigest := req.GetEnableTaskIdBasedBlobDigest()
 
+	taskIDs := make(map[string]string, len(layers[0].URLs))
+	for _, url := range layers[0].URLs {
+		taskID, err := idgen.TaskIDV2(url, pieceLength, tag, application, filteredQueryParams, "", enableTaskIDBasedBlobDigest)
+		if err != nil {
+			return nil, status.Errorf(codes.InvalidArgument, "failed to generate task id for layer %s: %s", url, err)
+		}
+
+		taskIDs[url] = taskID
+	}
+
 	var mu sync.Mutex
 	peers := map[string]*schedulerv2.PeerImage{}
 	eg, ctx := errgroup.WithContext(ctx)
 	eg.SetLimit(int(req.GetConcurrentLayerCount()))
 	for _, url := range layers[0].URLs {
 		resp.Image.Layers = append(resp.Image.Layers, &schedulerv2.Layer{Url: url})
 		eg.Go(func() error {
-			taskID, err := idgen.TaskIDV2(url, pieceLength, tag, application, filteredQueryParams, "", enableTaskIDBasedBlobDigest)
-			if err != nil {
-				log.Errorf("generate task id failed: %s", err.Error())
-				return nil
-			}
-
+			taskID := taskIDs[url]
 			getTaskRequest := &internaljob.GetTaskRequest{
 				TaskID:              taskID,
 				Timeout:             timeout,
```

**File**: `scheduler/service/service_v2_test.go` (modified, +16/-0)
```diff
@@ -4028,6 +4028,22 @@ func TestServiceV2_StatImage(t *testing.T) {
 				assert.Equal(1, len(resp.Peers))
 			},
 		},
+		{
+			name: "stat layer by peer with invalid blob digest",
+			req: &schedulerv2.StatImageRequest{
+				Url:                         "https://example.com/v2/image/manifests/latest",
+				EnableTaskIdBasedBlobDigest: true,
+			},
+			run: func(t *testing.T, svc *V2, req *schedulerv2.StatImageRequest, mj *jobmocks.MockJobMockRecorder, mi *internaljobmocks.MockImageMockRecorder) {
+				mi.CreatePreheatRequestsByManifestURL(gomock.Any(), gomock.Any()).Return([]*internaljob.PreheatRequest{{URLs: []string{"https://example.com/v2/image/latest/blobs/md5:8a04994a666b4e4b20a2fd9e5a44f44c"}}}, nil).Times(1)
+
+				resp, err := svc.StatImage(context.Background(), req)
+				assert := assert.New(t)
+				assert.Nil(resp)
+				assert.ErrorContains(err, "failed to generate task id for layer https://example.com/v2/image/latest/blobs/md5:8a04994a666b4e4b20a2fd9e5a44f44c")
+				assert.Equal(codes.InvalidArgument, status.Code(err))
+			},
+		},
 		{
 			name: "stat layer by peer failed",
 			req: &schedulerv2.StatImageRequest{
```

---

### Incident Patch 8: `0a27b05e` (2026-08-25)
**Commit Message**: chore(deps): bump docker/setup-buildx-action from 4.2.0 to 4.3.0 (#4967)

Bumps [docker/setup-buildx-action](https://github.com/docker/setup-buildx-action) from 4.2.0 to 4.3.0.
- [Release notes](https://github.com/docker/setup-buildx-action/releases)
- [Commits](https://github.com/docker/setup-buildx-action/compare/bb05f3f5519dd87d3ba754cc423b652a5edd6d2c...37fe631027851001ddb9b187196cc803df7f5f0e)

---
updated-dependencies:
- dependency-name: docker/setup-buildx-action
  dependency-version: 4.3.0
  dependency-type: direct:production
  update-type: version-update:semver-minor
...

Signed-off-by: dependabot[bot] <[REDACTED_EMAIL]>
Co-authored-by: dependabot[bot] <49699333+dependabot[bot]@users.noreply.github.com>

**File**: `.github/workflows/ci.yml` (modified, +1/-1)
```diff
@@ -74,7 +74,7 @@ jobs:
         uses: docker/setup-qemu-action@96fe6ef7f33517b61c61be40b68a1882f3264fb8
 
       - name: Setup Docker Buildx
-        uses: docker/setup-buildx-action@bb05f3f5519dd87d3ba754cc423b652a5edd6d2c
+        uses: docker/setup-buildx-action@37fe631027851001ddb9b187196cc803df7f5f0e
 
       - name: Cache Docker layers
         uses: actions/cache@55cc8345863c7cc4c66a329aec7e433d2d1c52a9
```

**File**: `.github/workflows/docker.yml` (modified, +1/-1)
```diff
@@ -53,7 +53,7 @@ jobs:
         uses: docker/setup-qemu-action@96fe6ef7f33517b61c61be40b68a1882f3264fb8
 
       - name: Setup Docker Buildx
-        uses: docker/setup-buildx-action@bb05f3f5519dd87d3ba754cc423b652a5edd6d2c
+        uses: docker/setup-buildx-action@37fe631027851001ddb9b187196cc803df7f5f0e
 
       - name: Cache Docker layers
         uses: actions/cache@55cc8345863c7cc4c66a329aec7e433d2d1c52a9
```

**File**: `.github/workflows/e2e-compatibility.yml` (modified, +1/-1)
```diff
@@ -85,7 +85,7 @@ jobs:
           mkdir -p /tmp/artifact
 
       - name: Setup buildx
-        uses: docker/setup-buildx-action@bb05f3f5519dd87d3ba754cc423b652a5edd6d2c
+        uses: docker/setup-buildx-action@37fe631027851001ddb9b187196cc803df7f5f0e
         id: buildx
         with:
           install: true
```

**File**: `.github/workflows/e2e-nydus.yml` (modified, +1/-1)
```diff
@@ -44,7 +44,7 @@ jobs:
           fetch-depth: 0
 
       - name: Setup buildx
-        uses: docker/setup-buildx-action@bb05f3f5519dd87d3ba754cc423b652a5edd6d2c
+        uses: docker/setup-buildx-action@37fe631027851001ddb9b187196cc803df7f5f0e
         id: buildx
         with:
           install: true
```

**File**: `.github/workflows/e2e-rate-limit.yml` (modified, +1/-1)
```diff
@@ -62,7 +62,7 @@ jobs:
           mkdir -p /tmp/artifact
 
       - name: Setup buildx
-        uses: docker/setup-buildx-action@bb05f3f5519dd87d3ba754cc423b652a5edd6d2c
+        uses: docker/setup-buildx-action@37fe631027851001ddb9b187196cc803df7f5f0e
         id: buildx
         with:
           install: true
```

**File**: `.github/workflows/e2e.yml` (modified, +1/-1)
```diff
@@ -74,7 +74,7 @@ jobs:
           mkdir -p /tmp/artifact
 
       - name: Setup buildx
-        uses: docker/setup-buildx-action@bb05f3f5519dd87d3ba754cc423b652a5edd6d2c
+        uses: docker/setup-buildx-action@37fe631027851001ddb9b187196cc803df7f5f0e
         id: buildx
         with:
           install: true
```

---

### Incident Patch 9: `66db4564` (2026-08-20)
**Commit Message**: fix(time): avoid panic for nanosecond jitter delay (#4956)

* fix(time): avoid panic for nanosecond jitter delay

Signed-off-by: 544129603 <[REDACTED_EMAIL]>

* fix(time): ensure delay defaults to baseDelay when jitterRange is zero

Previously, if `baseDelay` was too small for jitter to apply, the delay
would be calculated as `baseDelay*3/4 + 0`, which is less than intended.
Now `delay` defaults to `baseDelay` and is only adjusted when a valid
jitter range exists.

Signed-off-by: Gaius <[REDACTED_EMAIL]>

---------

Signed-off-by: 544129603 <[REDACTED_EMAIL]>
Signed-off-by: Gaius <[REDACTED_EMAIL]>
Co-authored-by: Gaius <[REDACTED_EMAIL]>

**File**: `pkg/time/delay.go` (modified, +5/-2)
```diff
@@ -54,8 +54,11 @@ func RandomDelayWithJitter(ctx context.Context, baseDelay time.Duration) {
 		return
 	}
 
-	jitter := time.Duration(rand.Int64N(int64(baseDelay) / 2))
-	delay := baseDelay*3/4 + jitter
+	delay := baseDelay
+	if jitterRange := int64(baseDelay) / 2; jitterRange > 0 {
+		jitter := time.Duration(rand.Int64N(jitterRange))
+		delay = baseDelay*3/4 + jitter // delay is now between [baseDelay*3/4, baseDelay*5/4)
+	}
 
 	select {
 	case <-time.After(delay):
```

**File**: `pkg/time/delay_test.go` (modified, +6/-0)
```diff
@@ -181,6 +181,12 @@ func TestRandomDelayWithJitter(t *testing.T) {
 			expectedMin: 0,
 			expectedMax: 100 * time.Millisecond,
 		},
+		{
+			name:        "one nanosecond base delay",
+			baseDelay:   time.Nanosecond,
+			expectedMin: 0,
+			expectedMax: 100 * time.Millisecond,
+		},
 	}
 
 	for _, tt := range tests {
```

---

### Incident Patch 10: `65f9fd35` (2026-08-18)
**Commit Message**: chore(deps): bump go.opentelemetry.io/otel/exporters/otlp/otlptrace/otlptracegrpc from 1.43.0 to 1.45.0 (#4948)

chore(deps): bump go.opentelemetry.io/otel/exporters/otlp/otlptrace/otlptracegrpc

Bumps [go.opentelemetry.io/otel/exporters/otlp/otlptrace/otlptracegrpc](https://github.com/open-telemetry/opentelemetry-go) from 1.43.0 to 1.45.0.
- [Release notes](https://github.com/open-telemetry/opentelemetry-go/releases)
- [Changelog](https://github.com/open-telemetry/opentelemetry-go/blob/main/CHANGELOG.md)
- [Commits](https://github.com/open-telemetry/opentelemetry-go/compare/v1.43.0...v1.45.0)

---
updated-dependencies:
- dependency-name: go.opentelemetry.io/otel/exporters/otlp/otlptrace/otlptracegrpc
  dependency-version: 1.45.0
  dependency-type: direct:production
  update-type: version-update:semver-minor
...

Signed-off-by: dependabot[bot] <[REDACTED_EMAIL]>
Co-authored-by: dependabot[bot] <49699333+dependabot[bot]@users.noreply.github.com>

**File**: `go.mod` (modified, +4/-4)
```diff
@@ -54,8 +54,8 @@ require (
 	go.opentelemetry.io/contrib/instrumentation/github.com/gin-gonic/gin/otelgin v0.69.0
 	go.opentelemetry.io/contrib/instrumentation/google.golang.org/grpc/otelgrpc v0.70.0
 	go.opentelemetry.io/otel v1.45.0
-	go.opentelemetry.io/otel/exporters/otlp/otlptrace v1.44.0
-	go.opentelemetry.io/otel/exporters/otlp/otlptrace/otlptracegrpc v1.43.0
+	go.opentelemetry.io/otel/exporters/otlp/otlptrace v1.45.0
+	go.opentelemetry.io/otel/exporters/otlp/otlptrace/otlptracegrpc v1.45.0
 	go.opentelemetry.io/otel/exporters/otlp/otlptrace/otlptracehttp v1.44.0
 	go.opentelemetry.io/otel/sdk v1.45.0
 	go.opentelemetry.io/otel/trace v1.45.0
@@ -205,7 +205,7 @@ require (
 	go.opentelemetry.io/auto/sdk v1.2.1 // indirect
 	go.opentelemetry.io/contrib/instrumentation/net/http/otelhttp v0.67.0 // indirect
 	go.opentelemetry.io/otel/metric v1.45.0 // indirect
-	go.opentelemetry.io/proto/otlp v1.10.0 // indirect
+	go.opentelemetry.io/proto/otlp v1.11.0 // indirect
 	go.uber.org/atomic v1.11.0 // indirect
 	go.uber.org/multierr v1.11.0 // indirect
 	go.yaml.in/yaml/v3 v3.0.4 // indirect
@@ -216,7 +216,7 @@ require (
 	golang.org/x/text v0.40.0 // indirect
 	golang.org/x/tools v0.47.0 // indirect
 	google.golang.org/genproto v0.0.0-20260319201613-d00831a3d3e7 // indirect
-	google.golang.org/genproto/googleapis/api v0.0.0-20260630182238-925bb5da69e7 // indirect
+	google.golang.org/genproto/googleapis/api v0.0.0-20260803160001-6ac0973c030d // indirect
 	google.golang.org/genproto/googleapis/rpc v0.0.0-20260803160001-6ac0973c030d // indirect
 	gopkg.in/ini.v1 v1.67.0 // indirect
 	gopkg.in/yaml.v2 v2.4.0 // indirect
```

**File**: `go.sum` (modified, +8/-8)
```diff
@@ -792,10 +792,10 @@ go.opentelemetry.io/contrib/propagators/b3 v1.44.0 h1:1IFH4oFKK8KupzIelCl3u+bkxp
 go.opentelemetry.io/contrib/propagators/b3 v1.44.0/go.mod h1:JqWFXsc7VDaqIyubFhEd2cPHqsrzqP0Lvn783SUwyro=
 go.opentelemetry.io/otel v1.45.0 h1:pdrWmLHofpubmArBv1LgFSv1Z0Ie/ppdZzu+kUN5EeU=
 go.opentelemetry.io/otel v1.45.0/go.mod h1:XZxIqPapzEYnhNSScF5DIqXhm/rYi0FzCe2XddAwZfQ=
-go.opentelemetry.io/otel/exporters/otlp/otlptrace v1.44.0 h1:4YsVu3B8+3qtWYYrsUYgn0OG78pN0rnNPRGX4SbokQI=
-go.opentelemetry.io/otel/exporters/otlp/otlptrace v1.44.0/go.mod h1:+wnlSn0mD1ADVMe3v9Z/WIaiz6q6gL2J/ejaAmdmv80=
-go.opentelemetry.io/otel/exporters/otlp/otlptrace/otlptracegrpc v1.43.0 h1:RAE+JPfvEmvy+0LzyUA25/SGawPwIUbZ6u0Wug54sLc=
-go.opentelemetry.io/otel/exporters/otlp/otlptrace/otlptracegrpc v1.43.0/go.mod h1:AGmbycVGEsRx9mXMZ75CsOyhSP6MFIcj/6dnG+vhVjk=
+go.opentelemetry.io/otel/exporters/otlp/otlptrace v1.45.0 h1:QRefszxJmfPdjXUUm3j6iDzY03mTPXMjqErFqQ67vUg=
+go.opentelemetry.io/otel/exporters/otlp/otlptrace v1.45.0/go.mod h1:Tiz03lTBVBrm7eWZBOidzEaYaJa8tjwGUGv6d8mlTyk=
+go.opentelemetry.io/otel/exporters/otlp/otlptrace/otlptracegrpc v1.45.0 h1:fG5MCxGz8+2VtrN/WgqSpJFctVz24gpxj8CxkKmc8Ww=
+go.opentelemetry.io/otel/exporters/otlp/otlptrace/otlptracegrpc v1.45.0/go.mod h1:BmAYTn+3ysbRe+IU2msxmf5Rx3g6DHvex+tWI3LdhYI=
 go.opentelemetry.io/otel/exporters/otlp/otlptrace/otlptracehttp v1.44.0 h1:lgh3PiVrRUWMLOVSkQicxzZll5NjF1r+AtsX1XRIHw0=
 go.opentelemetry.io/otel/exporters/otlp/otlptrace/otlptracehttp v1.44.0/go.mod h1:5Cnhth3m/AgOeTgE3ex12pPmiu/gGtZit03kSzx9X7s=
 go.opentelemetry.io/otel/exporters/stdout/stdouttrace v1.44.0 h1:bl2S7Ubua0Nms+D/gAmznQTd4dxxMA93aKbcpKqiTCs=
@@ -808,8 +808,8 @@ go.opentelemetry.io/otel/sdk/metric v1.45.0 h1:oVFszMfyj1Am6s24Vtc7wBb8BKLcwepJj
 go.opentelemetry.io/otel/sdk/metric v1.45.0/go.mod h1:vUWUxDZvu1WVRj8JA8S0AdhsPrZoDpA2DdZauIh4mDA=
 go.opentelemetry.io/otel/trace v1.45.0 h1:l/mP6Uv7oNO7/TblbhpbgMidxhq1uO/rPsikOyVhxag=
 go.opentelemetry.io/otel/trace v1.45.0/go.mod h1:qoJJA2xNMnxRrdISU/kLtfUH2wNeQbiv+jhs/CxI8bc=
-go.opentelemetry.io/proto/otlp v1.10.0 h1:IQRWgT5srOCYfiWnpqUYz9CVmbO8bFmKcwYxpuCSL2g=
-go.opentelemetry.io/proto/otlp v1.10.0/go.mod h1:/CV4QoCR/S9yaPj8utp3lvQPoqMtxXdzn7ozvvozVqk=
+go.opentelemetry.io/proto/otlp v1.11.0 h1:5rrYs0Ykyj50sdU/JU0x8etU+LubXWb+gED6TbEdMIk=
+go.opentelemetry.io/proto/otlp v1.11.0/go.mod h1:SmVizdCOAm3XBtG1g1NnOdhW6jtddT72hLMhv8VwA8E=
 go.uber.org/atomic v1.3.2/go.mod h1:gD2HeocX3+yG+ygLZcrzQJaqmWj9AIm7n08wl/qW/PE=
 go.uber.org/atomic v1.4.0/go.mod h1:gD2HeocX3+yG+ygLZcrzQJaqmWj9AIm7n08wl/qW/PE=
 go.uber.org/atomic v1.5.0/go.mod h1:sABNBOSYdrvTF6hTgEIbc7YasKWGhgEQZyfxyTvoXHQ=
@@ -1265,8 +1265,8 @@ google.golang.org/genproto v0.0.0-20210202153253-cf70463f6119/go.mod h1:FWY/as6D
 google.golang.org/genproto v0.0.0-20210207032614-bba0dbe2a9ea/go.mod h1:FWY/as6DDZQgahTzZj3fqbO1CbirC29ZNUFHwi0/+no=
 google.golang.org/genproto v0.0.0-20260319201613-d00831a3d3e7 h1:XzmzkmB14QhVhgnawEVsOn6OFsnpyxNPRY9QV01dNB0=
 google.golang.org/genproto v0.0.0-20260319201613-d00831a3d3e7/go.mod h1:L43LFes82YgSonw6iTXTxXUX1OlULt4AQtkik4ULL/I=
-google.golang.org/genproto/googleapis/api v0.0.0-20260630182238-925bb5da69e7 h1:jQ9p21COKWjP3VwuFrNRiiOTMh3mPpN45R7SLrH/HUU=
-google.golang.org/genproto/googleapis/api v0.0.0-20260630182238-925bb5da69e7/go.mod h1:KqHwBx2upmfa1XSi1WuRvC+2VGCLtooKkfmyvRbUmqA=
+google.golang.org/genproto/googleapis/api v0.0.0-20260803160001-6ac0973c030d h1:FarXi840EJWSHYTN3ERkADbPWjl307+FGrA22KAVjjc=
+google.golang.org/genproto/googleapis/api v0.0.0-20260803160001-6ac0973c030d/go.mod h1:K/+WGbmBY7aNW1HDw1fJnKYo10i0DkAX6pows00dLig=
 google.golang.org/genproto/googleapis/rpc v0.0.0-20260803160001-6ac0973c030d h1:IL4hdHzcUv2l/gcg98/Rj3FbtE6axwqslOW8SW0C+S0=
 google.golang.org/genproto/googleapis/rpc v0.0.0-20260803160001-6ac0973c030d/go.mod h1:4Hqkh8ycfw05ld/3BWL7rJOSfebL2Q+DVDeRgYgxUU8=
 google.golang.org/grpc v1.19.0/go.mod h1:mqu4LbDTu4XGKhr4mRzUsmM4RtVoemTSY81AxZiDr8c=
```

---

### Incident Patch 11: `3aa219cc` (2026-08-14)
**Commit Message**: perf(scheduler): log per-piece events at debug level (#4942)

* perf(scheduler): log per-piece events at debug level

The scheduler receives one DownloadPiece*Request per piece on the
AnnouncePeer stream, and ReportPieceResult receives one result per
piece. Logging each of them at info level produces tens of thousands
of log lines per large download and dominates the hot path cost, while
piece counts and traffic are already covered by metrics. Demote the
per-piece receive logs to debug.

Co-Authored-By: Claude Fable 5 <[REDACTED_EMAIL]>
Signed-off-by: Gaius <[REDACTED_EMAIL]>

* chore(scheduler): promote piece download failure log messages from Debug to Info

Elevates `DownloadPieceFailedRequest` and `DownloadPieceBackToSourceFailedRequest` log entries to Info level so that piece download failures are visible without enabling debug logging.

Signed-off-by: Gaius <[REDACTED_EMAIL]>

---------

Signed-off-by: Gaius <[REDACTED_EMAIL]>
Co-authored-by: Claude Fable 5 <[REDACTED_EMAIL]>

**File**: `scheduler/service/service_v1.go` (modified, +1/-1)
```diff
@@ -235,7 +235,7 @@ func (v *V1) ReportPieceResult(stream schedulerv1.Scheduler_ReportPieceResultSer
 
 		// Handle piece download successfully.
 		if piece.Success {
-			peer.Log.Infof("receive success piece: %#v %#v", piece, piece.PieceInfo)
+			peer.Log.Debugf("receive success piece: %#v %#v", piece, piece.PieceInfo)
 			v.handlePieceSuccess(ctx, peer, piece)
 
 			// Collect host traffic metrics.
```

**File**: `scheduler/service/service_v2.go` (modified, +2/-2)
```diff
@@ -260,13 +260,13 @@ func (v *V2) AnnouncePeer(stream schedulerv2.Scheduler_AnnouncePeerServer) error
 			return nil
 		case *schedulerv2.AnnouncePeerRequest_DownloadPieceFinishedRequest:
 			piece := announcePeerRequest.DownloadPieceFinishedRequest.Piece
-			log.Infof("receive DownloadPieceFinishedRequest, piece number: %d, piece length: %d, traffic type: %s, cost: %s, parent id: %s", piece.GetNumber(), piece.GetLength(), piece.GetTrafficType(), piece.GetCost().AsDuration().String(), piece.GetParentId())
+			log.Debugf("receive DownloadPieceFinishedRequest, piece number: %d, piece length: %d, traffic type: %s, cost: %s, parent id: %s", piece.GetNumber(), piece.GetLength(), piece.GetTrafficType(), piece.GetCost().AsDuration().String(), piece.GetParentId())
 			if err := v.handleDownloadPieceFinishedRequest(req.GetPeerId(), announcePeerRequest.DownloadPieceFinishedRequest); err != nil {
 				log.Error(err)
 			}
 		case *schedulerv2.AnnouncePeerRequest_DownloadPieceBackToSourceFinishedRequest:
 			piece := announcePeerRequest.DownloadPieceBackToSourceFinishedRequest.Piece
-			log.Infof("receive DownloadPieceBackToSourceFinishedRequest, piece number: %d, piece length: %d, traffic type: %s, cost: %s, parent id: %s", piece.GetNumber(), piece.GetLength(), piece.GetTrafficType(), piece.GetCost().AsDuration().String(), piece.GetParentId())
+			log.Debugf("receive DownloadPieceBackToSourceFinishedRequest, piece number: %d, piece length: %d, traffic type: %s, cost: %s, parent id: %s", piece.GetNumber(), piece.GetLength(), piece.GetTrafficType(), piece.GetCost().AsDuration().String(), piece.GetParentId())
 			if err := v.handleDownloadPieceBackToSourceFinishedRequest(ctx, req.GetPeerId(), announcePeerRequest.DownloadPieceBackToSourceFinishedRequest); err != nil {
 				log.Error(err)
 			}
```

---

### Incident Patch 12: `fa7488ef` (2026-08-05)
**Commit Message**: fix(manager): grant the root role on every startup (#4925)

* fix(manager): grant the root role on every startup

InitRBAC only added the root user-to-role grant inside the branch that seeds
the root user, so with multiple manager replicas only the replica that won the
seeding race ended up holding the mapping.

An enforcer loads the policy once when it is constructed and nothing reloads it
afterwards, so a replica that built its enforcer before another replica seeded
never picks the grant up. It counts one user, skips the seeding branch, and
Enforce returns false for the root subject from then on: every RBAC-protected
request answers 401 "permission deny" until that replica restarts. Sign-in does
not go through the enforcer, so the replica keeps answering sign-in with 200 and
still looks healthy to probes.

Look the root user up and apply the grant on every startup instead. AddRoleForUser
is idempotent, so replicas converge regardless of which one seeded.

The test builds two enforcers before either calls InitRBAC, which reproduces the
interleaving without relying on timing.

Signed-off-by: Charlie Gruenwald <[REDACTED_EMAIL]>

* chore(rbac): consolidate RBAC test helpers into a s

**File**: `go.mod` (modified, +1/-0)
```diff
@@ -72,6 +72,7 @@ require (
 	gopkg.in/yaml.v3 v3.0.1
 	gorm.io/driver/mysql v1.4.7
 	gorm.io/driver/postgres v1.4.8
+	gorm.io/driver/sqlite v1.5.0
 	gorm.io/gorm v1.25.0
 	gorm.io/plugin/soft_delete v1.2.1
 	k8s.io/utils v0.0.0-20260707023825-cf1189d6abe3
```

**File**: `go.sum` (modified, +3/-1)
```diff
@@ -1338,8 +1338,9 @@ gorm.io/driver/mysql v1.4.7/go.mod h1:SxzItlnT1cb6e1e4ZRpgJN2VYtcqJgqnHxWr4wsP8o
 gorm.io/driver/postgres v1.2.2/go.mod h1:Ik3tK+a3FMp8ORZl29v4b3M0RsgXsaeMXh9s9eVMXco=
 gorm.io/driver/postgres v1.4.8 h1:NDWizaclb7Q2aupT0jkwK8jx1HVCNzt+PQ8v/VnxviA=
 gorm.io/driver/postgres v1.4.8/go.mod h1:O9MruWGNLUBUWVYfWuBClpf3HeGjOoybY0SNmCs3wsw=
-gorm.io/driver/sqlite v1.1.3 h1:BYfdVuZB5He/u9dt4qDpZqiqDJ6KhPqs5QUqsr/Eeuc=
 gorm.io/driver/sqlite v1.1.3/go.mod h1:AKDgRWk8lcSQSw+9kxCJnX/yySj8G3rdwYlU57cB45c=
+gorm.io/driver/sqlite v1.5.0 h1:zKYbzRCpBrT1bNijRnxLDJWPjVfImGEn0lSnUY5gZ+c=
+gorm.io/driver/sqlite v1.5.0/go.mod h1:kDMDfntV9u/vuMmz8APHtHF0b4nyBB7sfCieC6G8k8I=
 gorm.io/driver/sqlserver v1.2.1/go.mod h1:nixq0OB3iLXZDiPv6JSOjWuPgpyaRpOIIevYtA4Ulb4=
 gorm.io/driver/sqlserver v1.4.1 h1:t4r4r6Jam5E6ejqP7N82qAJIJAht27EGT41HyPfXRw0=
 gorm.io/driver/sqlserver v1.4.1/go.mod h1:DJ4P+MeZbc5rvY58PnmN1Lnyvb5gw5NPzGshHDnJLig=
@@ -1355,6 +1356,7 @@ gorm.io/gorm v1.23.6/go.mod h1:l2lP/RyAtc1ynaTjFksBde/O8v9oOGIApu2/xRitmZk=
 gorm.io/gorm v1.23.8/go.mod h1:l2lP/RyAtc1ynaTjFksBde/O8v9oOGIApu2/xRitmZk=
 gorm.io/gorm v1.24.0/go.mod h1:DVrVomtaYTbqs7gB/x2uVvqnXzv0nqjB396B8cG4dBA=
 gorm.io/gorm v1.24.2/go.mod h1:DVrVomtaYTbqs7gB/x2uVvqnXzv0nqjB396B8cG4dBA=
+gorm.io/gorm v1.24.7-0.20230306060331-85eaf9eeda11/go.mod h1:L4uxeKpfBml98NYqVqwAdmV1a2nBtAec/cf3fpucW/k=
 gorm.io/gorm v1.25.0 h1:+KtYtb2roDz14EQe4bla8CbQlmb9dN3VejSai3lprfU=
 gorm.io/gorm v1.25.0/go.mod h1:L4uxeKpfBml98NYqVqwAdmV1a2nBtAec/cf3fpucW/k=
 gorm.io/plugin/dbresolver v1.1.0/go.mod h1:tpImigFAEejCALOttyhWqsy4vfa2Uh/vAUVnL5IRF7Y=
```

**File**: `manager/permission/rbac/rbac.go` (modified, +15/-2)
```diff
@@ -165,10 +165,23 @@ func InitRBAC(e *casbin.Enforcer, g *gin.Engine, db *gorm.DB) error {
 		if err := db.Create(&rootUser).Error; err != nil {
 			return err
 		}
+	}
 
-		if _, err := e.AddRoleForUser(fmt.Sprint(rootUser.ID), RootRole); err != nil {
-			return err
+	// Grant the root role on every startup, not only when the root user is
+	// seeded. An enforcer loads the policy once at construction, so an instance
+	// that started before another one seeded the root user would otherwise never
+	// hold the grant and would deny every request from root.
+	var rootUser managermodels.User
+	if err := db.Where(&managermodels.User{Name: RootUserName}).First(&rootUser).Error; err != nil {
+		if errors.Is(err, gorm.ErrRecordNotFound) {
+			return nil
 		}
+
+		return err
+	}
+
+	if _, err := e.AddRoleForUser(fmt.Sprint(rootUser.ID), RootRole); err != nil {
+		return err
 	}
 
 	return nil
```

**File**: `manager/permission/rbac/rbac_test.go` (modified, +67/-0)
```diff
@@ -17,11 +17,22 @@
 package rbac
 
 import (
+	"fmt"
+	"net/http"
 	"os"
+	"path/filepath"
 	"strings"
 	"testing"
 
+	"github.com/casbin/casbin/v2"
+	"github.com/gin-gonic/gin"
 	"github.com/stretchr/testify/assert"
+	"gorm.io/driver/sqlite"
+	"gorm.io/gorm"
+	gormlogger "gorm.io/gorm/logger"
+	"gorm.io/gorm/schema"
+
+	managermodels "d7y.io/dragonfly/v2/manager/models"
 )
 
 func TestInitialRootPassword(t *testing.T) {
@@ -196,3 +207,59 @@ func TestHTTPMethodToAction(t *testing.T) {
 		}
 	}
 }
+
+func TestInitRBAC(t *testing.T) {
+	gin.SetMode(gin.TestMode)
+	db, err := gorm.Open(sqlite.Open(filepath.Join(t.TempDir(), "rbac.db")), &gorm.Config{
+		NamingStrategy: schema.NamingStrategy{SingularTable: true},
+		Logger:         gormlogger.Discard,
+	})
+	assert.NoError(t, err)
+	assert.NoError(t, db.AutoMigrate(&managermodels.User{}, &managermodels.CasbinRule{}))
+
+	router := gin.New()
+	router.GET("/api/v1/users", func(c *gin.Context) {
+		c.Status(http.StatusOK)
+	})
+
+	router.POST("/api/v1/clusters", func(c *gin.Context) {
+		c.Status(http.StatusOK)
+	})
+
+	enforcers := make([]*casbin.Enforcer, 2)
+	for i := range enforcers {
+		enforcer, err := NewEnforcer(db)
+		assert.NoError(t, err)
+		enforcers[i] = enforcer
+	}
+
+	for _, enforcer := range enforcers {
+		assert.NoError(t, InitRBAC(enforcer, router, db))
+	}
+
+	var rootUser managermodels.User
+	assert.NoError(t, db.Where(&managermodels.User{Name: RootUserName}).First(&rootUser).Error)
+
+	tests := []struct {
+		name     string
+		enforcer *casbin.Enforcer
+	}{
+		{
+			name:     "enforcer that seeded the root user",
+			enforcer: enforcers[0],
+		},
+		{
+			name:     "enforcer built before the root user was seeded",
+			enforcer: enforcers[1],
+		},
+	}
+
+	for _, tc := range tests {
+		t.Run(tc.name, func(t *testing.T) {
+			assert := assert.New(t)
+			ok, err := tc.enforcer.Enforce(fmt.Sprint(rootUser.ID), "clusters", AllAction)
+			assert.NoError(err)
+			assert.True(ok)
+		})
+	}
+}
```

---

### Incident Patch 13: `237fcc53` (2026-08-04)
**Commit Message**: Fix overflow issues, improve logging, and refactor APIs (#4923)

**File**: `.github/workflows/e2e-compatibility.yml` (modified, +5/-0)
```diff
@@ -181,6 +181,11 @@ jobs:
           files: ./coverage.txt
           flags: e2etests
 
+      - name: Export logs
+        if: always()
+        run: |
+          sudo chown -R $USER:$USER /tmp/artifact
+
       - name: Upload Logs
         uses: actions/upload-artifact@043fb46d1a93c77aae656e7c1c64a875d1fc6a0a
         if: always()
```

**File**: `.github/workflows/e2e-rate-limit.yml` (modified, +5/-0)
```diff
@@ -152,6 +152,11 @@ jobs:
           files: ./coverage.txt
           flags: e2etests
 
+      - name: Export logs
+        if: always()
+        run: |
+          sudo chown -R $USER:$USER /tmp/artifact
+
       - name: Upload Logs
         uses: actions/upload-artifact@043fb46d1a93c77aae656e7c1c64a875d1fc6a0a
         if: always()
```

**File**: `.github/workflows/e2e.yml` (modified, +5/-0)
```diff
@@ -170,6 +170,11 @@ jobs:
           files: ./coverage.txt
           flags: e2etests
 
+      - name: Export logs
+        if: always()
+        run: |
+          sudo chown -R $USER:$USER /tmp/artifact
+
       - name: Upload Logs
         uses: actions/upload-artifact@043fb46d1a93c77aae656e7c1c64a875d1fc6a0a
         if: always()
```

**File**: `.golangci.yml` (modified, +0/-4)
```diff
@@ -20,10 +20,6 @@ linters:
       - common-false-positives
       - legacy
       - std-error-handling
-    rules:
-      - linters:
-          - staticcheck
-        text: 'SA1019:'
     paths:
       - third_party$
       - builtin$
```

**File**: `client` (modified, +1/-1)
```diff
@@ -1 +1 @@
-Subproject commit a1394cb24cb48654df43d4558e110a19f36af4fc
+Subproject commit f5736121608ae9b9c67671a0d3a6f86c09ca62a5
```

**File**: `go.mod` (modified, +5/-8)
```diff
@@ -12,7 +12,7 @@ require (
 	github.com/casbin/casbin/v2 v2.81.0
 	github.com/casbin/gorm-adapter/v3 v3.5.0
 	github.com/cespare/xxhash/v2 v2.3.0
-	github.com/containerd/containerd v1.7.34
+	github.com/containerd/platforms v0.2.1
 	github.com/docker/distribution v2.8.3+incompatible
 	github.com/docker/docker v25.0.16+incompatible
 	github.com/docker/go-connections v0.8.1
@@ -35,8 +35,6 @@ require (
 	github.com/google/uuid v1.6.0
 	github.com/grpc-ecosystem/go-grpc-middleware v1.4.0
 	github.com/grpc-ecosystem/go-grpc-prometheus v1.2.0
-	github.com/hashicorp/go-multierror v1.1.1
-	github.com/juju/ratelimit v1.0.2
 	github.com/looplab/fsm v1.0.2
 	github.com/mcuadros/go-gin-prometheus v0.1.0
 	github.com/mitchellh/mapstructure v1.5.0
@@ -52,7 +50,6 @@ require (
 	github.com/swaggo/files v1.0.1
 	github.com/swaggo/gin-swagger v1.6.1
 	github.com/swaggo/swag v1.16.6
-	github.com/yl2chen/cidranger v1.0.2
 	go.opentelemetry.io/contrib/instrumentation/github.com/gin-gonic/gin/otelgin v0.69.0
 	go.opentelemetry.io/contrib/instrumentation/google.golang.org/grpc/otelgrpc v0.68.0
 	go.opentelemetry.io/otel v1.44.0
@@ -67,10 +64,11 @@ require (
 	golang.org/x/oauth2 v0.36.0
 	golang.org/x/sync v0.22.0
 	golang.org/x/sys v0.47.0
+	golang.org/x/time v0.15.0
 	google.golang.org/api v0.291.0
 	google.golang.org/grpc v1.82.1
 	google.golang.org/protobuf v1.36.11
-	gopkg.in/natefinch/lumberjack.v2 v2.0.0
+	gopkg.in/natefinch/lumberjack.v2 v2.2.1
 	gopkg.in/yaml.v3 v3.0.1
 	gorm.io/driver/mysql v1.4.7
 	gorm.io/driver/postgres v1.4.8
@@ -92,7 +90,6 @@ require (
 	filippo.io/edwards25519 v1.1.1 // indirect
 	github.com/KyleBanks/depth v1.2.1 // indirect
 	github.com/Masterminds/semver/v3 v3.4.0 // indirect
-	github.com/Microsoft/hcsshim v0.11.7 // indirect
 	github.com/RichardKnop/logging v0.0.0-20190827224416-1a693bdd4fae // indirect
 	github.com/aws/aws-sdk-go v1.55.8 // indirect
 	github.com/beorn7/perks v1.0.1 // indirect
@@ -104,7 +101,6 @@ require (
 	github.com/cenkalti/backoff/v5 v5.0.3 // indirect
 	github.com/cloudwego/base64x v0.1.7 // indirect
 	github.com/containerd/log v0.1.0 // indirect
-	github.com/containerd/platforms v0.2.1 // indirect
 	github.com/cpuguy83/go-md2man/v2 v2.0.6 // indirect
 	github.com/davecgh/go-spew v1.1.2-0.20180830191138-d8f796af33cc // indirect
 	github.com/deckarep/golang-set v1.8.0 // indirect
@@ -132,6 +128,7 @@ require (
 	github.com/golang-jwt/jwt/v4 v4.5.2 // indirect
 	github.com/golang-sql/civil v0.0.0-20220223132316-b832511892a9 // indirect
 	github.com/golang-sql/sqlexp v0.1.0 // indirect
+	github.com/golang/mock v1.6.0 // indirect
 	github.com/golang/protobuf v1.5.4 // indirect
 	github.com/golang/snappy v0.0.4 // indirect
 	github.com/google/go-cmp v0.7.0 // indirect
@@ -143,6 +140,7 @@ require (
 	github.com/gorilla/mux v1.8.1 // indirect
 	github.com/grpc-ecosystem/grpc-gateway/v2 v2.29.0 // indirect
 	github.com/hashicorp/errwrap v1.1.0 // indirect
+	github.com/hashicorp/go-multierror v1.1.1 // indirect
 	github.com/hashicorp/hcl v1.0.0 // indirect
 	github.com/inconshreveable/mousetrap v1.1.0 // indirect
 	github.com/jackc/pgpassfile v1.0.0 // indirect
@@ -215,7 +213,6 @@ require (
 	golang.org/x/mod v0.37.0 // indirect
 	golang.org/x/net v0.57.0 // indirect
 	golang.org/x/text v0.40.0 // indirect
-	golang.org/x/time v0.15.0 // indirect
 	golang.org/x/tools v0.47.0 // indirect
 	google.golang.org/genproto v0.0.0-20260319201613-d00831a3d3e7 // indirect
 	google.golang.org/genproto/googleapis/api v0.0.0-20260630182238-925bb5da69e7 // indirect
```

**File**: `go.sum` (modified, +3/-11)
```diff
@@ -62,7 +62,6 @@ github.com/Azure/azure-sdk-for-go/sdk/azcore v1.0.0/go.mod h1:uGG2W01BaETf0Ozp+Q
 github.com/Azure/azure-sdk-for-go/sdk/azidentity v1.0.0/go.mod h1:+6sju8gk8FRmSajX3Oz4G5Gm7P+mbqE9FVaXXFYTkCM=
 github.com/Azure/azure-sdk-for-go/sdk/internal v1.0.0/go.mod h1:eWRD7oawr1Mu1sLCawqVc0CUiF43ia3qQMxLscsKQ9w=
 github.com/AzureAD/microsoft-authentication-library-for-go v0.4.0/go.mod h1:Vt9sXTKwMyGcOxSmLDMnGPgqsUg7m8pe215qMLrDXw4=
-github.com/BurntSushi/toml v0.3.1 h1:WXkYYl6Yr3qBf1K79EBnL4mak0OimBfB0XUf9Vl28OQ=
 github.com/BurntSushi/toml v0.3.1/go.mod h1:xHWCNGjB5oqiDr8zfno3MHue2Ht5sIBksp03qcyfWMU=
 github.com/BurntSushi/xgb v0.0.0-20160522181843-27f122750802/go.mod h1:IVnqGOEym/WlBOVXweHU+Q+/VP0lqqI8lqeDx9IjBqo=
 github.com/Knetic/govaluate v3.0.1-0.20171022003610-9aa49832a739+incompatible/go.mod h1:r7JcOSlj0wfOMncg0iLm8Leh48TZaKVeNIfJntJ2wa0=
@@ -71,8 +70,6 @@ github.com/KyleBanks/depth v1.2.1/go.mod h1:jzSb9d0L43HxTQfT+oSA1EEp2q+ne2uh6Xge
 github.com/Masterminds/semver/v3 v3.1.1/go.mod h1:VPu/7SZ7ePZ3QOrcuXROw5FAcLl4a0cBrbBpGY/8hQs=
 github.com/Masterminds/semver/v3 v3.4.0 h1:Zog+i5UMtVoCU8oKka5P7i9q9HgrJeGzI9SA1Xbatp0=
 github.com/Masterminds/semver/v3 v3.4.0/go.mod h1:4V+yj/TJE1HU9XfppCwVMZq3I84lprf4nC11bSS5beM=
-github.com/Microsoft/hcsshim v0.11.7 h1:vl/nj3Bar/CvJSYo7gIQPyRWc9f3c6IeSNavBTSZNZQ=
-github.com/Microsoft/hcsshim v0.11.7/go.mod h1:MV8xMfmECjl5HdO7U/3/hFVnkmSBjAjmA09d4bExKcU=
 github.com/RichardKnop/logging v0.0.0-20190827224416-1a693bdd4fae h1:DcFpTQBYQ9Ct2d6sC7ol0/ynxc2pO1cpGUM+f4t5adg=
 github.com/RichardKnop/logging v0.0.0-20190827224416-1a693bdd4fae/go.mod h1:rJJ84PyA/Wlmw1hO+xTzV2wsSUon6J5ktg0g8BF2PuU=
 github.com/Showmax/go-fqdn v1.0.0 h1:0rG5IbmVliNT5O19Mfuvna9LL7zlHyRfsSvBPZmF9tM=
@@ -141,8 +138,6 @@ github.com/cncf/udpa/go v0.0.0-20201120205902-5459f2c99403/go.mod h1:WmhPx2Nbnht
 github.com/cncf/xds/go v0.0.0-20260202195803-dba9d589def2 h1:aBangftG7EVZoUb69Os8IaYg++6uMOdKK83QtkkvJik=
 github.com/cncf/xds/go v0.0.0-20260202195803-dba9d589def2/go.mod h1:qwXFYgsP6T7XnJtbKlf1HP8AjxZZyzxMmc+Lq5GjlU4=
 github.com/cockroachdb/apd v1.1.0/go.mod h1:8Sl8LxpKi29FqWXR16WEFZRNSz3SoPzUzeMeY4+DwBQ=
-github.com/containerd/containerd v1.7.34 h1:Q35B4FUECxcoaMz9QrOlqp+0s72w8/0NWawVMhVdf5g=
-github.com/containerd/containerd v1.7.34/go.mod h1:ozI//0TomTCLPhQREnx0IXDIQMg+Fk7yTtg9fNvU8EQ=
 github.com/containerd/log v0.1.0 h1:TCJt7ioM2cr/tfR8GPbGf9/VRAX8D2B4PjzCpfX540I=
 github.com/containerd/log v0.1.0/go.mod h1:VRRf09a7mHDIRezVKTRCrOq78v577GXq3bSa3EhrzVo=
 github.com/containerd/platforms v0.2.1 h1:zvwtM3rz2YHPQsF2CHYM8+KtB5dvhISiXh5ZpSBQv6A=
@@ -493,8 +488,6 @@ github.com/json-iterator/go v1.1.12 h1:PV8peI4a0ysnczrg+LtxykD8LfKY9ML6u2jnxaEnr
 github.com/json-iterator/go v1.1.12/go.mod h1:e30LSqwooZae/UwlEbR2852Gd8hjQvJoHmT4TnhNGBo=
 github.com/jstemmer/go-junit-report v0.0.0-20190106144839-af01ea7f8024/go.mod h1:6v2b51hI/fHJwM22ozAgKL4VKDeJcHhJFhtBdhmNjmU=
 github.com/jstemmer/go-junit-report v0.9.1/go.mod h1:Brl9GWCQeLvo8nXZwPNNblvFj/XSXhF0NWZEnDohbsk=
-github.com/juju/ratelimit v1.0.2 h1:sRxmtRiajbvrcLQT7S+JbqU0ntsb9W2yhSdNN8tWfaI=
-github.com/juju/ratelimit v1.0.2/go.mod h1:qapgC/Gy+xNh9UxzV13HGGl/6UXNN+ct+vwSgWNm/qk=
 github.com/julienschmidt/httprouter v1.2.0/go.mod h1:SYymIcj16QtmaHHD7aYtjjsJG7VTCxuUUipMqKk8s4w=
 github.com/kelseyhightower/envconfig v1.4.0 h1:Im6hONhd3pLkfDFsbRgu68RDNkGF1r3dvMUtDTo2cv8=
 github.com/kelseyhightower/envconfig v1.4.0/go.mod h1:cccZRl6mQpaq41TPp5QxidR+Sa3axMbJDNb//FQX6Gg=
@@ -759,8 +752,6 @@ github.com/xdg-go/scram v1.2.0 h1:bYKF2AEwG5rqd1BumT4gAnvwU/M9nBp2pTSxeZw7Wvs=
 github.com/xdg-go/scram v1.2.0/go.mod h1:3dlrS0iBaWKYVt2ZfA4cj48umJZ+cAEbR6/SjLA88I8=
 github.com/xdg-go/stringprep v1.0.4 h1:XLI/Ng3O1Atzq0oBs3TWm+5ZVgkq2aqdlvP9JtoZ6c8=
 github.com/xdg-go/stringprep v1.0.4/go.mod h1:mPGuuIYwz7CmR2bT9j4GbQqutWS1zV24gijq1dTyGkM=
-github.com/yl2chen/cidranger v1.0.2 h1:lbOWZVCG1tCRX4u24kuM1Tb4nHqWkDxwLdoS+SevawU=
-github.com/yl2chen/cidranger v1.0.2/go.mod h1:9U1yz7WPYDwf0vpNWFaeRh0bjwz5RVgRy/9UEQfHl0g=
 github.com/youmark/pkcs8 v0.0.0-20240726163527-a2c0da244d78 h1:ilQV1hzziu+LLM3zUTJ0trRztfwgjqKnBWNtSRkbmwM=
 github.com/youmark/pkcs8 v0.0.0-20240726163527-a2c0da244d78/go.mod h1:aL8wCCfTfSfmXjznFBSZNN13rSJjlIOI1fUNAtF7rmI=
 github.com/yuin/goldmark v1.1.25/go.mod h1:3hX8gzYuyVAZsxl0MRgGTJEmQBFcNTphYh9decYSb74=
@@ -1186,6 +1177,7 @@ golang.org/x/tools v0.0.0-20210105154028-b0ab187a4818/go.mod h1:emZCQorbCU4vsT4f
 golang.org/x/tools v0.0.0-20210106214847-113979e3529a/go.mod h1:emZCQorbCU4vsT4fOWvOPXz4eW1wZW4PmDk9uLelYpA=
 golang.org/x/tools v0.0.0-20210108195828-e2f9c7f1fc8e/go.mod h1:emZCQorbCU4vsT4fOWvOPXz4eW1wZW4PmDk9uLelYpA=
 golang.org/x/tools v0.1.0/go.mod h1:xkSsbof2nBLbhDlRMhhhyNLN/zl3eTqcnHD5viDpcZ0=
+golang.org/x/tools v0.1.1/go.mod h1:o0xws9oXOQQZyjljx8fwUC0k7L1pTE6eaCbjGeHmOkk=
 golang.org/x/tools v0.1.5/go.mod h1:o0xws9oXOQQZyjljx8fwUC0k7L1pTE6eaCbjGeHmOkk=
 golang.org/x/tools v0.1.10/go.mod h1:Uh6Zz+xoGYZom868N8YTex3t7RhtHDBrE8Gzo9bV56E=
 golang.
```

**File**: `internal/dferrors/error.go` (modified, +0/-44)
```diff
@@ -32,15 +32,9 @@ var (
 	ErrDataNotFound    = errors.New("data not found")
 	ErrEmptyValue      = errors.New("empty value")
 	ErrConvertFailed   = errors.New("convert failed")
-	ErrEndOfStream     = errors.New("end of stream")
 	ErrNoCandidateNode = errors.New("no candidate server node")
 )
 
-// IsEndOfStream returns true if the error is end of stream.
-func IsEndOfStream(err error) bool {
-	return err == ErrEndOfStream
-}
-
 type DfError struct {
 	Code    commonv1.Code
 	Message string
@@ -57,23 +51,6 @@ func New(code commonv1.Code, msg string) *DfError {
 	}
 }
 
-func Newf(code commonv1.Code, format string, a ...any) *DfError {
-	return &DfError{
-		Code:    code,
-		Message: fmt.Sprintf(format, a...),
-	}
-}
-
-func CheckError(err error, code commonv1.Code) bool {
-	if err == nil {
-		return false
-	}
-
-	e, ok := err.(*DfError)
-
-	return ok && e.Code == code
-}
-
 // ConvertGRPCErrorToDfError converts grpc error to DfError, if it exists.
 func ConvertGRPCErrorToDfError(err error) error {
 	for _, d := range status.Convert(err).Details() {
@@ -89,27 +66,6 @@ func ConvertGRPCErrorToDfError(err error) error {
 	return err
 }
 
-// IsGRPCDfError checks if the error is a GRPCDfError.
-func IsGRPCDfError(err error) (*DfError, bool) {
-	for _, d := range status.Convert(err).Details() {
-		switch internal := d.(type) {
-		case *commonv1.GrpcDfError:
-			return &DfError{
-				Code:    internal.Code,
-				Message: internal.Message,
-			}, true
-		}
-	}
-
-	var de *DfError
-	ok := errors.As(err, &de)
-	if ok {
-		return de, true
-	}
-
-	return nil, false
-}
-
 // ConvertDfErrorToGRPCError converts DfError to grpc error, if it is.
 func ConvertDfErrorToGRPCError(err error) error {
 	if v, ok := err.(*DfError); ok {
```

---

### Incident Patch 14: `ed76f22e` (2026-08-04)
**Commit Message**: fix(time): prevent overflow in ExponentialDelayWithJitter backoff (#4852)

ExponentialDelayWithJitter computed `baseDelay * (1 << attempt)` before
applying `min(delay, maxDelay)`, so a large attempt overflowed the int64
time.Duration ahead of the cap. The wrapped negative or zero value passed
the cap unchanged, making `delay > 0` false and skipping the sleep.

In the scheduler this `attempt` is a host's ConcurrentRegisterCount, not a
retry counter. With the production constants (baseDelay 30ms, maxDelay 1s)
the backoff breaks once a host has >= 39 concurrent registrations, which is
exactly the thundering herd the delay exists to dampen.

Compute the shift only when it cannot overflow time.Duration (using the
leading-zero count of baseDelay); otherwise the result would exceed maxDelay
anyway, so clamp to maxDelay directly. Also guard a non-positive baseDelay,
matching the existing guard in RandomDelayWithJitter. Behavior is unchanged
for the existing small-attempt cases. Add regression cases covering the
overflow regime.

Signed-off-by: Anas Khan <[REDACTED_EMAIL]>

**File**: `pkg/time/delay.go` (modified, +12/-2)
```diff
@@ -18,15 +18,25 @@ package time
 
 import (
 	"context"
+	"math/bits"
 	"math/rand"
 	"time"
 )
 
 // ExponentialDelayWithJitter is an exponential backoff strategy with jitter for retries. It calculates delay based on the attempt number,
 // adds jitter, and sleeps for that duration, capped at maxDelay.
 func ExponentialDelayWithJitter(ctx context.Context, attempt uint, baseDelay, maxDelay time.Duration) error {
-	delay := baseDelay * time.Duration(1<<attempt)
-	delay = min(delay, maxDelay)
+	// Compute baseDelay * 2^attempt, capped at maxDelay. The shift is only applied when it
+	// cannot overflow time.Duration; otherwise the result would exceed maxDelay anyway, so
+	// the cap is used directly. Without this guard a large attempt overflows int64 before the
+	// cap is applied, yielding a negative or zero delay that silently skips the backoff.
+	var delay time.Duration
+	if baseDelay > 0 {
+		delay = maxDelay
+		if attempt < uint(bits.LeadingZeros64(uint64(baseDelay))) {
+			delay = min(baseDelay<<attempt, maxDelay)
+		}
+	}
 
 	if delay > 0 {
 		jitter := time.Duration(rand.Int63n(int64(delay)))
```

**File**: `pkg/time/delay_test.go` (modified, +24/-0)
```diff
@@ -79,6 +79,30 @@ func TestExponentialDelayWithJitter(t *testing.T) {
 			expectedMin: 650 * time.Millisecond,
 			expectedMax: 3000 * time.Millisecond,
 		},
+		{
+			name:        "overflow attempt stays capped at maxDelay",
+			attempt:     39,
+			baseDelay:   30 * time.Millisecond,
+			maxDelay:    1 * time.Second,
+			expectedMin: 380 * time.Millisecond,
+			expectedMax: 1500 * time.Millisecond,
+		},
+		{
+			name:        "shift overflow attempt stays capped at maxDelay",
+			attempt:     62,
+			baseDelay:   30 * time.Millisecond,
+			maxDelay:    1 * time.Second,
+			expectedMin: 380 * time.Millisecond,
+			expectedMax: 1500 * time.Millisecond,
+		},
+		{
+			name:        "huge attempt stays capped at maxDelay",
+			attempt:     100,
+			baseDelay:   30 * time.Millisecond,
+			maxDelay:    1 * time.Second,
+			expectedMin: 380 * time.Millisecond,
+			expectedMax: 1500 * time.Millisecond,
+		},
 		{
 			name:        "zero baseDelay with jitter",
 			attempt:     5,
```

---

### Incident Patch 15: `fe42b247` (2026-07-23)
**Commit Message**: fix(scheduling): use addedParents instead of candidateParents in responses

- Send `addedParents` instead of `candidateParents` in responses to
  reflect edges actually added to the DAG
- Skip sending response and retry when no edges were successfully added
- Adds test cases for zero-edge and partial-edge scenarios, covering
  cycle-prevention during concurrent scheduling

Signed-off-by: Gaius <[REDACTED_EMAIL]>

**File**: `scheduler/scheduling/scheduling.go` (modified, +20/-2)
```diff
@@ -201,6 +201,15 @@ func (s *scheduling) ScheduleCandidateParents(ctx context.Context, peer *standar
 			peer.Log.Warnf("peer adds %d of %d edges", len(addedParents), len(candidateParents))
 		}
 
+		if len(addedParents) == 0 {
+			n++
+			peer.Log.Infof("scheduling failed in %d times, because of no candidate parent edges could be added", n)
+
+			// Sleep with context-aware timeout to avoid blocking on cancellation.
+			pkgtime.RandomDelayWithJitter(s.config.RetryInterval)
+			continue
+		}
+
 		stream, loaded := peer.LoadAnnouncePeerStream()
 		if !loaded {
 			if err := peer.Task.DeletePeerInEdges(peer.ID); err != nil {
@@ -215,7 +224,7 @@ func (s *scheduling) ScheduleCandidateParents(ctx context.Context, peer *standar
 
 		peer.Log.Info("send NormalTaskResponse")
 		if err := stream.Send(&schedulerv2.AnnouncePeerResponse{
-			Response: constructSuccessNormalTaskResponse(candidateParents),
+			Response: constructSuccessNormalTaskResponse(addedParents),
 		}); err != nil {
 			if err := peer.Task.DeletePeerInEdges(peer.ID); err != nil {
 				err = fmt.Errorf("peer deletes inedges failed: %w", err)
@@ -355,6 +364,15 @@ func (s *scheduling) ScheduleParentAndCandidateParents(ctx context.Context, peer
 			peer.Log.Debugf("peer adds %d of %d edges", len(addedParents), len(candidateParents))
 		}
 
+		if len(addedParents) == 0 {
+			n++
+			peer.Log.Infof("scheduling failed in %d times, because of no candidate parent edges could be added", n)
+
+			// Sleep with context-aware timeout to avoid blocking on cancellation.
+			pkgtime.RandomDelayWithJitter(s.config.RetryInterval)
+			continue
+		}
+
 		stream, loaded := peer.LoadReportPieceResultStream()
 		if !loaded {
 			n++
@@ -370,7 +388,7 @@ func (s *scheduling) ScheduleParentAndCandidateParents(ctx context.Context, peer
 		}
 
 		peer.Log.Info("send PeerPacket to peer")
-		if err := stream.Send(constructSuccessPeerPacket(peer, candidateParents[0], candidateParents[1:])); err != nil {
+		if err := stream.Send(constructSuccessPeerPacket(peer, addedParents[0], addedParents[1:])); err != nil {
 			n++
 			err = fmt.Errorf("send PeerPacket to peer failed in %d times, because of %w", n, err)
 			peer.Log.Error(err)
```

**File**: `scheduler/scheduling/scheduling_test.go` (modified, +161/-0)
```diff
@@ -430,6 +430,88 @@ func TestScheduling_ScheduleCandidateParents(t *testing.T) {
 				assert.True(peer.Task.FSM.Is(standard.TaskStatePending))
 			},
 		},
+		{
+			name: "schedule failed when no edges can be added and falls back to source",
+			mock: func(cancel context.CancelFunc, peer *standard.Peer, seedPeer *standard.Peer, blocklist set.SafeSet[string], stream schedulerv2.Scheduler_AnnouncePeerServer, ma *schedulerv2mocks.MockScheduler_AnnouncePeerServerMockRecorder, md *configmocks.MockDynconfigInterfaceMockRecorder) {
+				task := peer.Task
+				task.StorePeer(peer)
+				task.StorePeer(seedPeer)
+				peer.FSM.SetState(standard.PeerStateRunning)
+				seedPeer.FSM.SetState(standard.PeerStateRunning)
+				peer.StoreAnnouncePeerStream(stream)
+
+				gomock.InOrder(
+					md.GetSchedulerClusterConfig().Return(types.SchedulerClusterConfig{}, errors.New("foo")).Times(1),
+					md.GetSchedulerClusterConfig().DoAndReturn(func() (types.SchedulerClusterConfig, error) {
+						if err := task.AddPeerEdge(peer, seedPeer); err != nil {
+							return types.SchedulerClusterConfig{}, err
+						}
+
+						return types.SchedulerClusterConfig{}, errors.New("foo")
+					}).Times(1),
+					ma.Send(gomock.Eq(&schedulerv2.AnnouncePeerResponse{
+						Response: &schedulerv2.AnnouncePeerResponse_NeedBackToSourceResponse{
+							NeedBackToSourceResponse: &schedulerv2.NeedBackToSourceResponse{
+								Description: &exceededLimitDescription,
+							},
+						},
+					})).Return(nil).Times(1),
+				)
+			},
+			expect: func(t *testing.T, peer *standard.Peer, err error) {
+				assert := assert.New(t)
+				assert.NoError(err)
+				assert.Equal(len(peer.Parents()), 0)
+				assert.True(peer.FSM.Is(standard.PeerStateRunning))
+				assert.True(peer.Task.FSM.Is(standard.TaskStatePending))
+			},
+		},
+		{
+			name: "schedule succeeded with partially added edges",
+			mock: func(cancel context.CancelFunc, peer *standard.Peer, seedPeer *standard.Peer, blocklist set.SafeSet[string], stream schedulerv2.Scheduler_AnnouncePeerServer, ma *schedulerv2mocks.MockScheduler_AnnouncePeerServerMockRecorder, md *configmocks.MockDynconfigInterfaceMockRecorder) {
+				task := peer.Task
+				candidateParent := standard.NewPeer(idgen.PeerIDV2(), task, seedPeer.Host)
+				task.StorePeer(peer)
+				task.StorePeer(seedPeer)
+				task.StorePeer(candidateParent)
+				peer.FSM.SetState(standard.PeerStateRunning)
+				seedPeer.FSM.SetState(standard.PeerStateRunning)
+				candidateParent.FSM.SetState(standard.PeerStateRunning)
+				peer.StoreAnnouncePeerStream(stream)
+
+				gomock.InOrder(
+					md.GetSchedulerClusterConfig().Return(types.SchedulerClusterConfig{}, errors.New("foo")).Times(1),
+					md.GetSchedulerClusterConfig().DoAndReturn(func() (types.SchedulerClusterConfig, error) {
+						if err := task.AddPeerEdge(peer, candidateParent); err != nil {
+							return types.SchedulerClusterConfig{}, err
+						}
+
+						return types.SchedulerClusterConfig{}, errors.New("foo")
+					}).Times(1),
+					ma.Send(gomock.Any()).DoAndReturn(func(resp *schedulerv2.AnnouncePeerResponse) error {
+						normalTaskResponse := resp.GetNormalTaskResponse()
+						if normalTaskResponse == nil {
+							return errors.New("expected NormalTaskResponse")
+						}
+
+						if len(normalTaskResponse.CandidateParents) != 1 || normalTaskResponse.CandidateParents[0].Id != seedPeer.ID {
+							return fmt.Errorf("unexpected candidate parents in response")
+						}
+
+						return nil
+					}).Times(1),
+				)
+			},
+			expect: func(t *testing.T, peer *standard.Peer, err error) {
+				assert := assert.New(t)
+				assert.NoError(err)
+				if assert.Equal(len(peer.Parents()), 1) {
+					assert.Equal(peer.Parents()[0].ID, mockSeedPeerID)
+				}
+				assert.True(peer.FSM.Is(standard.PeerStateRunning))
+				assert.True(peer.Task.FSM.Is(standard.TaskStatePending))
+			},
+		},
 	}
 
 	for _, tc := range tests {
@@ -702,6 +784,85 @@ func TestScheduling_ScheduleParentAndCandidateParents(t *testing.T) {
 				assert.True(peer.Task.FSM.Is(standard.TaskStatePending))
 			},
 		},
+		{
+			name: "schedule failed when no edges can be added and falls back to source",
+			mock: func(cancel context.CancelFunc, peer *standard.Peer, seedPeer *standard.Peer, blocklist set.SafeSet[string], stream schedulerv1.Scheduler_ReportPieceResultServer, mr *schedulerv1mocks.MockScheduler_ReportPieceResultServerMockRecorder, md *configmocks.MockDynconfigInterfaceMockRecorder) {
+				task := peer.Task
+				task.StorePeer(peer)
+				task.StorePeer(seedPeer)
+				peer.FSM.SetState(standard.PeerStateRunning)
+				seedPeer.FSM.SetState(standard.PeerStateRunning)
+				peer.StoreReportPieceResultStream(stream)
+
+				gomock.InOrder(
+					md.GetSchedulerClusterConfig().Return(types.SchedulerClusterConfig{}, errors.New("foo")).Times(1),
+					md.GetSchedulerClusterConfig().DoAndReturn(func() (types.SchedulerClusterConfig, error) {
+						// Simulate concurrent scheduling that makes the candidate a successor
+						//
```

#### Recent Merged Pull Requests:
- **PR #5037** (closed): chore(deps): bump github/codeql-action/autobuild from 4.36.2 to 4.38.2 (@dependabot[bot])
- **PR #5036** (closed): chore(deps): bump github/codeql-action/init from 4.36.2 to 4.38.2 (@dependabot[bot])
- **PR #5035** (closed): chore(deps): bump github/codeql-action/analyze from 4.36.2 to 4.38.2 (@dependabot[bot])
- **PR #5034** (2026-09-29): chore(deps): bump github/codeql-action/upload-sarif from 4.37.9 to 4.38.2 (@dependabot[bot])
- **PR #5033** (closed): chore(deps): bump github.com/onsi/gomega from 1.42.0 to 1.44.0 (@dependabot[bot])
- **PR #5032** (closed): chore(deps): bump github.com/gin-contrib/zap from 1.1.6 to 1.1.9 (@dependabot[bot])
- **PR #5031** (2026-09-29): chore(deps): bump go.opentelemetry.io/otel/exporters/otlp/otlptrace/otlptracehttp from 1.41.0 to 1.46.0 (@dependabot[bot])
- **PR #5030** (2026-09-29): chore(deps): bump github.com/go-sql-driver/mysql from 1.9.2 to 1.10.1 (@dependabot[bot])

---

## 3. Empirical Evidence & Compliance Certification
- **Evidence Provenance**: Fetched directly from verified official GitHub REST API.
- **Zero Disk Footprint**: 0 bytes of unnecessary repository bloat stored locally.
- **TOS & Free-Tier Adherence**: Request pace complied with public API guidelines without fee, penalty, or unauthorized scraping.

---

## 4. Promotion & Integration Status
- **Status**: HARVESTED_DEEP_FORENSIC
- **Master Brain Sync**: Auto-committed to local/remote Master Brain repository.
