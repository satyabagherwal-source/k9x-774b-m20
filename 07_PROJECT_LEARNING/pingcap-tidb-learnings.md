# Forensic Learning Record (Deep Inspection): pingcap/tidb

> **Canonical Artifact**: `07_PROJECT_LEARNING/pingcap-tidb-learnings.md`  
> **Source Platform**: GitHub ([https://github.com/pingcap/tidb](https://github.com/pingcap/tidb))  
> **Harvest Method**: Full-Spectrum Deep Extraction (Patches, Diffs, Source Code, Post-Mortems)  
> **Harvest Timestamp**: 2026-09-30T14:03:34.890Z  
> **Compliance State**: Free Tier Guaranteed | Strict Rate-Limit Backoff Honored  

---

## 1. Context & Architectural Overview
- **Repository / Resource**: `pingcap/tidb`
- **Description**: TiDB is built for agentic workloads that grow unpredictably, with ACID guarantees and native support for transactions, analytics, and vector search. No data silos. No noisy neighbors. No infrastructure ceiling.
- **Primary Language / Ecosystem**: Go
- **Discovered Manifests / Configurations**: go.mod, README.md, Dockerfile
- **Stars / Engagement**: 40614 stars

---

## 2. Multi-Dimensional 8-Axis Investigation & Real Code Patches

### D1: Architecture & Structural Boundaries
- Entry configurations inspected via direct stream: go.mod, README.md, Dockerfile.
- Evaluated system abstractions and modular contracts.

### Core Architecture Module: `br/cmd/br/abort.go`
```
// Copyright 2025 PingCAP, Inc. Licensed under Apache-2.0.

package main

import (
	"github.com/pingcap/errors"
	"github.com/pingcap/log"
	"github.com/pingcap/tidb/br/pkg/task"
	"github.com/pingcap/tidb/br/pkg/trace"
	"github.com/pingcap/tidb/br/pkg/version/build"
	"github.com/pingcap/tidb/pkg/session"
	"github.com/pingcap/tidb/pkg/util/logutil"
	"github.com/spf13/cobra"
	"go.uber.org/zap"
	"sourcegraph.com/sourcegraph/appdash"
)

// NewAbortCommand returns an abort subcommand
func NewAbortCommand() *cobra.Command {
	command := &cobra.Command{
		Use:          "abort",
		Short:        "abort restore tasks",
		SilenceUsage: true,
		PersistentPreRunE: func(c *cobra.Command, args []string) error {
			if err := Init(c); err != nil {
				return errors.Trace(err)
			}
			build.LogInfo(build.BR)
			logutil.LogEnvVariables()
			task.LogArguments(c)
			// disable stats otherwise takes too much memory
			session.DisableStats4Test()

			return nil
		},
	}

	command.AddCommand(
		newAbortRestoreCommand(),
		// future: newAbortBackupCommand(),
	)
	task.DefineRestoreFlags(command.PersistentFlags())

	return command
}

// newAbortRestoreCommand returns an abort restore subcommand
func newAbortRestoreCommand() *cobra.Command {
	command := &cobra.Command{
		Use:          "restore",
		Short:        "abort restore tasks",
		SilenceUsage: true,
	}

	command.AddCommand(
		newAbortRestoreFullCommand(),
		newAbortRestoreDBCommand(),
		newAbortRestoreTableCommand(),
		newAbortRestorePointCommand(),
	)

	return command
}

func newAbortRestoreFullCommand() *cobra.Command {
	command := &cobra.Command{
		Use:   "full",
		Short: "abort a full restore task",
		Args:  cobra.NoArgs,
		RunE: func(cmd *cobra.Command, _ []string) error {
			return runAbortRestoreCommand(cmd, task.FullRestoreCmd)
		},
	}
	// define flags specific to full restore
	task.DefineFilterFlags(command, filterOutSysAndMemKeepAuthAndBind, false)
	task.DefineRestoreSnapshotFlags(command)
	return command
}

func newAbortRestoreDBCommand() *cobra.Command {
	command := &cobra.Command{
		Use:   "db",
		Short: "abort a database restore task",
		Args:  cobra.NoArgs,
		RunE: func(cmd *cobra.Command, _ []string) error {
			return runAbortRestoreCommand(cmd, task.DBRestoreCmd)
		},
	}
	task.DefineDatabaseFlags(command)
	return command
}

func newAbortRestoreTableCommand() *cobra.Command {
	command := &cobra.Command{
		Use:   "table",
		Short: "abort a table restore task",
		Args:  cobra.NoArgs,
		RunE: func(cmd *cobra.Command, _ []string) error {
			return runAbortRestoreCommand(cmd, task.TableRestoreCmd)
		},
	}
	task.DefineTableFlags(command)
	return command
}

func newAbortRestorePointCommand() *cobra.Command {
	command := &cobra.Command{
		Use:   "point",
		Short: "abort a point-in-time restore task",
		Args:  cobra.NoArgs,
		RunE: func(cmd *cobra.Command, _ []string) error {
			return runAbortRestoreCommand(cmd, task.PointRestoreCmd)
		},
	}
	task.DefineFilterFlags(command, filterOutSysAndMemKeepAuthAndBind, true)
	task.DefineStreamRestoreFlags(command)
	return command
}

func runAbortRestoreCommand(command *cobra.Command, cmdName string) error {
	cfg := task.RestoreConfig{Config: task.Config{LogProgress: HasLogFile()}}
	if err := cfg.ParseFromFlags(command.Flags(), false); err != nil {
		command.SilenceUsage = false
		return errors.Trace(err)
	}

	if task.IsStreamRestore(cmdName) {
		if err := cfg.ParseStreamRestoreFlags(command.Flags()); err != nil {
			return errors.Trace(err)
		}
	}

	ctx := GetDefaultContext()
	if cfg.EnableOpenTracing {
		var store *appdash.MemoryStore
		ctx, store = trace.TracerStartSpan(ctx)
		defer trace.TracerFinishSpan(ctx, store)
	}

	if err := task.RunRestoreAbort(ctx, tidbGlue, cmdName, &cfg); err != nil {
		log.Error("failed to abort restore task", zap.Error(err))
		return errors.Trace(err)
	}
	return nil
}

```

### Core Architecture Module: `br/cmd/br/backup.go`
```
// Copyright 2020 PingCAP, Inc. Licensed under Apache-2.0.

package main

import (
	"github.com/pingcap/errors"
	"github.com/pingcap/log"
	"github.com/pingcap/tidb/br/pkg/gluetidb"
	"github.com/pingcap/tidb/br/pkg/gluetikv"
	"github.com/pingcap/tidb/br/pkg/summary"
	"github.com/pingcap/tidb/br/pkg/task"
	"github.com/pingcap/tidb/br/pkg/trace"
	"github.com/pingcap/tidb/br/pkg/version/build"
	"github.com/pingcap/tidb/pkg/config"
	"github.com/pingcap/tidb/pkg/session"
	"github.com/pingcap/tidb/pkg/util/gctuner"
	"github.com/pingcap/tidb/pkg/util/logutil"
	"github.com/pingcap/tidb/pkg/util/metricsutil"
	"github.com/spf13/cobra"
	"go.uber.org/zap"
	"sourcegraph.com/sourcegraph/appdash"
)

func runBackupCommand(command *cobra.Command, cmdName string) error {
	cfg := task.BackupConfig{Config: task.Config{LogProgress: HasLogFile()}}
	if err := cfg.ParseFromFlags(command.Flags(), false); err != nil {
		command.SilenceUsage = false
		return errors.Trace(err)
	}

	if err := metricsutil.RegisterMetricsForBR(cfg.PD, cfg.TLS, cfg.KeyspaceName); err != nil {
		return errors.Trace(err)
	}

	ctx := GetDefaultContext()
	if cfg.EnableOpenTracing {
		var store *appdash.MemoryStore
		ctx, store = trace.TracerStartSpan(ctx)
		defer trace.TracerFinishSpan(ctx, store)
	}

	if cfg.FullBackupType == task.FullBackupTypeEBS {
		if err := task.RunBackupEBS(ctx, tidbGlue, &cfg); err != nil {
			log.Error("failed to backup", zap.Error(err))
			return errors.Trace(err)
		}
		return nil
	}

	config.UpdateGlobal(func(conf *config.Config) {
		// Need to be skipped when the cluster has TiDB type coprocessor tasks
		conf.AdvertiseAddress = config.UnavailableIP

		// No need to cache the coproceesor result
		conf.TiKVClient.CoprCache.CapacityMB = 0
	})

	// Disable the memory limit tuner. That's because the server memory is get from TiDB node instead of BR node.
	gctuner.GlobalMemoryLimitTuner.DisableAdjustMemoryLimit()
	defer gctuner.GlobalMemoryLimitTuner.EnableAdjustMemoryLimit()

	restore := setTiDBGlueDBFilter(gluetidb.FilterLoadSysDBs)
	defer restore()
	if err := task.RunBackup(ctx, tidbGlue, cmdName, &cfg); err != nil {
		log.Error("failed to backup", zap.Error(err))
		return errors.Trace(err)
	}
	return nil
}

func runBackupRawCommand(command *cobra.Command, cmdName string) error {
	cfg := task.RawKvConfig{Config: task.Config{LogProgress: HasLogFile()}}
	if err := cfg.ParseBackupConfigFromFlags(command.Flags()); err != nil {
		command.SilenceUsage = false
		return errors.Trace(err)
	}

	ctx := GetDefaultContext()
	if cfg.EnableOpenTracing {
		var store *appdash.MemoryStore
		ctx, store = trace.TracerStartSpan(ctx)
		defer trace.TracerFinishSpan(ctx, store)
	}
	if err := task.RunBackupRaw(ctx, gluetikv.Glue{}, cmdName, &cfg); err != nil {
		log.Error("failed to backup raw kv", zap.Error(err))
		return errors.Trace(err)
	}
	return nil
}

func runBackupTxnCommand(command *cobra.Command, cmdName string) error {
	cfg := task.TxnKvConfig{Config: task.Config{LogProgress: HasLogFile()}}
	if err := cfg.ParseBackupConfigFromFlags(command.Flags()); err != nil {
		command.SilenceUsage = false
		return errors.Trace(err)
	}

	ctx := GetDefaultContext()
	if cfg.EnableOpenTracing {
		var store *appdash.MemoryStore
		ctx, store = trace.TracerStartSpan(ctx)
		defer trace.TracerFinishSpan(ctx, store)
	}
	if err := task.RunBackupTxn(ctx, gluetikv.Glue{}, cmdName, &cfg); err != nil {
		log.Error("failed to backup txn kv", zap.Error(err))
		return errors.Trace(err)
	}
	return nil
}

// NewBackupCommand return a full backup subcommand.
func NewBackupCommand() *cobra.Command {
	command := &cobra.Command{
		Use:          "backup",
		Short:        "backup a TiDB/TiKV cluster",
		SilenceUsage: true,
		PersistentPreRunE: func(c *cobra.Command, args []string) error {
			if err := Init(c); err != nil {
				return errors.Trace(err)
			}
			build.LogInfo(build.BR)
			logutil.LogEnvVariables()
			task.LogArguments(c)
			// Do not run stat worker in BR.
			session.DisableStats4Test()

			summary.SetUnit(summary.BackupUnit)
			return nil
		},
	}
	command.AddCommand(
		newFullBackupCommand(),
		newDBBackupCommand(),
		newTableBackupCommand(),
		newRawBackupCommand(),
		newTxnBackupCommand(),
	)

	task.DefineBackupFlags(command.PersistentFlags())
	return command
}

// newFullBackupCommand return a full backup subcommand.
func newFullBackupCommand() *cobra.Command {
	command := &cobra.Command{
		Use:   "full",
		Short: "backup all database",
		// prevents incorrect usage like `--checksum false` instead of `--checksum=false`.
		// the former, according to pflag parsing rules, means `--checksum=true false`.
		Args: cobra.NoArgs,
		RunE: func(command *cobra.Command, _ []string) error {
			// empty db/table means full backup.
			return runBackupCommand(command, task.FullBackupCmd)
		},
	}
	task.DefineFilterFlags(command, acceptAllTables, false)
	task.DefineBackupEBSFlags(command.PersistentFlags())
	return command
}

// newDBBackupCommand return a db backup subcommand.
func newDBBackupCommand() *cobra.Command {
	command := &cobra.Command{
		Use:   "db",
		Short: "backup a database",
		Args:  cobra.NoArgs,
		RunE: func(command *cobra.Command, _ []string) error {
			return runBackupCommand(command, task.DBBackupCmd)
		},
	}
	task.DefineDatabaseFlags(command)
	return command
}

// newTableBackupCommand return a table backup subcommand.
func newTableBackupCommand() *cobra.Command {
	command := &cobra.Command{
		Use:   "table",
		Short: "backup a table",
		Args:  cobra.NoArgs,
		RunE: func(command *cobra.Command, _ []string) error {
			return runBackupCommand(command, task.TableBackupCmd)
		},
	}
	task.DefineTableFlags(command)
	return command
}

// newRawBackupCommand return a raw kv range backup subcommand.
func newRawBackupCommand() *cobra.Command {
	// TODO: remove experimental tag if it's stable
	command := &cobra.Command{
		Use:   "raw",
		Short: "(experimental) backup a raw kv range from TiKV cluster",
		Args:  cobra.NoArgs,
		RunE: func(command *cobra.Command, _ []string) error {
			return runBackupRawCommand(command, task.RawBackupCmd)
		},
	}

	task.DefineRawBackupFlags(command)
	return command
}

// newTxnBackupCommand return a txn kv range backup subcommand.
func newTxnBackupCommand() *cobra.Command {
	command := &cobra.Command{
		Use:   "txn",
		Short: "(experimental) backup a txn kv range from TiKV cluster",
		Args:  cobra.NoArgs,
		RunE: func(command *cobra.Command, _ []string) error {
			return runBackupTxnCommand(command, task.TxnBackupCmd)
		},
	}

	task.DefineTxnBackupFlags(command)
	return command
}

```

### Core Architecture Module: `br/cmd/br/cmd.go`
```
// Copyright 2020 PingCAP, Inc. Licensed under Apache-2.0.

package main

import (
	"context"
	"fmt"
	"math"
	"net/http"
	"os"
	"path/filepath"
	"runtime/debug"
	"sync"
	"sync/atomic"
	"time"

	"github.com/pingcap/errors"
	"github.com/pingcap/log"
	"github.com/pingcap/tidb/br/pkg/gluetidb"
	"github.com/pingcap/tidb/br/pkg/summary"
	"github.com/pingcap/tidb/br/pkg/task"
	"github.com/pingcap/tidb/br/pkg/utils"
	"github.com/pingcap/tidb/br/pkg/version/build"
	"github.com/pingcap/tidb/pkg/config"
	"github.com/pingcap/tidb/pkg/parser/ast"
	tidbutils "github.com/pingcap/tidb/pkg/util"
	"github.com/pingcap/tidb/pkg/util/logutil"
	"github.com/pingcap/tidb/pkg/util/memory"
	"github.com/pingcap/tidb/pkg/util/redact"
	"github.com/pingcap/tidb/pkg/util/size"
	"github.com/spf13/cobra"
	"go.uber.org/zap"
)

func setTiDBGlueDBFilter(newFilter func(dbName ast.CIStr) bool) func() {
	oldFilter := tidbGlue.InfoSchemaFilter
	tidbGlue.InfoSchemaFilter = gluetidb.NewInfoSchemaFilter(newFilter)
	return func() { tidbGlue.InfoSchemaFilter = oldFilter }
}

var (
	initOnce        = sync.Once{}
	defaultContext  context.Context
	hasLogFile      uint64
	tidbGlue        = gluetidb.New()
	envLogToTermKey = "BR_LOG_TO_TERM"
	statusPreparers sync.Map

	filterOutSysAndMemKeepAuthAndBind = []string{
		"*.*",
		fmt.Sprintf("!%s.*", utils.TemporaryDBName("*")),
		"!mysql.*",
		"mysql.bind_info",
		"mysql.user",
		"mysql.db",
		"mysql.tables_priv",
		"mysql.columns_priv",
		"mysql.global_priv",
		"mysql.global_grants",
		"mysql.default_roles",
		"mysql.role_edges",
		"!sys.*",
		"!INFORMATION_SCHEMA.*",
		"!PERFORMANCE_SCHEMA.*",
		"!METRICS_SCHEMA.*",
		"!INSPECTION_SCHEMA.*",
	}
	acceptAllTables = []string{
		"*.*",
	}
)

const (
	// FlagLogLevel is the name of log-level flag.
	FlagLogLevel = "log-level"
	// FlagLogFile is the name of log-file flag.
	FlagLogFile = "log-file"
	// FlagLogFormat is the name of log-format flag.
	FlagLogFormat = "log-format"
	// FlagStatusAddr is the name of status-addr flag.
	FlagStatusAddr = "status-addr"
	// FlagSlowLogFile is the name of slow-log-file flag.
	FlagSlowLogFile = "slow-log-file"
	// FlagRedactLog is whether to redact sensitive information in log, already deprecated by FlagRedactInfoLog
	FlagRedactLog = "redact-log"
	// FlagRedactInfoLog is whether to redact sensitive information in log.
	FlagRedactInfoLog = "redact-info-log"

	flagVersion      = "version"
	flagVersionShort = "V"

	// Memory management related constants
	quarterGiB uint64 = 256 * size.MB
	halfGiB    uint64 = 512 * size.MB
	fourGiB    uint64 = 4 * size.GB

	// Environment variables
	envBRHeapDumpDir = "BR_HEAP_DUMP_DIR"

	// Default heap dump paths
	defaultHeapDumpDir = "/tmp/br_heap_dumps"
)

type statusServerRegistrar func(*http.ServeMux)
type statusServerPreparer func(*cobra.Command) (statusServerRegistrar, error)

func timestampLogFileName() string {
	return filepath.Join(os.TempDir(), time.Now().Format("br.log.2006-01-02T15.04.05Z0700"))
}

func registerStatusServerPreparer(cmd *cobra.Command, preparer statusServerPreparer) {
	statusPreparers.Store(cmd, preparer)
}

func prepareStatusServer(cmd *cobra.Command) (statusServerRegistrar, error) {
	preparer, ok := statusPreparers.Load(cmd)
	if !ok {
		return nil, nil
	}
	return preparer.(statusServerPreparer)(cmd)
}

// DefineCommonFlags defines the common flags for all BR cmd operation.
func DefineCommonFlags(cmd *cobra.Command) {
	cmd.Version = build.Info()
	cmd.Flags().BoolP(flagVersion, flagVersionShort, false, "Display version information about BR")
	cmd.SetVersionTemplate("{{printf \"%s\" .Version}}\n")

	cmd.PersistentFlags().StringP(FlagLogLevel, "L", "info",
		"Set the log level")
	cmd.PersistentFlags().String(FlagLogFile, timestampLogFileName(),
		"Set the log file path. If not set, logs will output to temp file")
	cmd.PersistentFlags().String(FlagLogFormat, "text",
		"Set the log format")
	cmd.PersistentFlags().Bool(FlagRedactLog, false,
		"Set whether to redact sensitive info in log, already deprecated by --redact-info-log")
	cmd.PersistentFlags().Bool(FlagRedactInfoLog, false,
		"Set whether to redact sensitive info in log")
	cmd.PersistentFlags().String(FlagStatusAddr, "",
		"Set the HTTP listening address for the status report service. Set to empty string to disable")

	// defines BR task common flags, this is shared by cmd and sql(brie)
	task.DefineCommonFlags(cmd.PersistentFlags())

	cmd.PersistentFlags().StringP(FlagSlowLogFile, "", "",
		"Set the slow log file path. If not set, discard slow logs")
	_ = cmd.PersistentFlags().MarkHidden(FlagSlowLogFile)
	_ = cmd.PersistentFlags().MarkHidden(FlagRedactLog)
}

func calculateMemoryLimit(memleft uint64) uint64 {
	// Special case: if no memory left, return 0
	if memleft == 0 {
		return 0
	}

	// memreserved = f(memleft) = 512MB * memleft / (memleft + 4GB)
	//  * f(0) = 0
	//  * f(4GB) = 256MB
	//  * f(+inf) -> 512MB
	memreserved := halfGiB / (1 + fourGiB/(memleft|1))

	// Prevent uint64 underflow when memreserved >= memleft
	// This can happen when available memory is very low (< 256MB)
	if memreserved >= memleft {
		log.Warn("insufficient memory left for BR, capping to available",
			zap.Uint64("memleft", memleft),
			zap.Uint64("memreserved", memreserved))
		// Return available memory instead of forcing a minimum
		return memleft
	}

	// 0     memused          memtotal-memreserved  memtotal
	// +--------+--------------------+----------------+
	//          ^            br mem upper limit
	//          +--------------------^
	//             GOMEMLIMIT range
	memlimit := memleft - memreserved
	return memlimit
}

// setupMemoryMonitoring configures memory limits and starts the memory monitor.
// It returns an error if the setup fails.
func setupMemoryMonitoring(ctx context.Context, memTotal, memUsed uint64) error {
	if memUsed >= memTotal {
		log.Warn("failed to obtain memory size, skip setting memory limit",
			zap.Uint64("memused", memUsed), zap.Uint64("memtotal", memTotal))
		return nil
	}

	memleft := memTotal - memUsed
	memlimit := calculateMemoryLimit(memleft)
	// BR command needs 256 MiB at least, if the left memory is less than 256 MiB,
	// the memory limit cannot limit anyway and then finally OOM.
	memlimit = max(memlimit, quarterGiB)

	log.Info("calculate the rest memory",
		zap.Uint64("memtotal", memTotal),
		zap.Uint64("memused", memUsed),
		zap.Uint64("memlimit", memlimit))

	// No need to set memory limit because the left memory is sufficient.
	if memlimit >= uint64(math.MaxInt64) {
		return nil
	}

	debug.SetMemoryLimit(int64(memlimit))

	// Configure and start memory monitoring
	dumpDir := os.Getenv(envBRHeapDumpDir)
	if dumpDir == "" {
		dumpDir = defaultHeapDumpDir
	}

	if err := utils.RunMemoryMonitor(ctx, dumpDir, memlimit); err != nil {
		log.Warn("Failed to start memory monitor", zap.Error(err))
		return err
	}

	return nil
}

// Init initializes BR cli.
func Init(cmd *cobra.Command) (err error) {
	initOnce.Do(func() {
		slowLogFilename, e := cmd.Flags().GetString(FlagSlowLogFile)
		if e != nil {
			err = e
			return
		}
		tidbLogCfg := logutil.LogConfig{}
		if len(slowLogFilename) != 0 {
			tidbLogCfg.SlowQueryFile = slowLogFilename
			// Just for special grpc log file,
			// otherwise the info will be print in stdout...
			tidbLogCfg.File.Filename = timestampLogFileName()
		} else {
			// Don't print slow log in br
			config.GetGlobalConfig().Instance.EnableSlowLog.Store(false)
		}
		e = logutil.InitLogger(&tidbLogCfg)
		if e != nil {
			err = e
			return
		}
		// Initialize the logger.
		conf := new(log.Config)
		conf.Level, err = cmd.Flags().GetString(FlagLogLevel)
		if err != nil {
			return
		}
		conf.File.Filename, err = cmd.Flags().GetString(FlagLogFile)
		if err != nil {
			return
		}
		conf.Format, err = cmd.Flags().GetString(FlagLogFormat)
		if err != nil {
			return
		}
		_, outputLogToTerm := os.LookupEnv(envLogToTermKey)
		if outputLogToTerm {
			// Log to term if env `BR_LOG_TO_TERM` is set.
			conf.File.Filename = ""
		}
		if le
```

### Core Architecture Module: `br/cmd/br/debug.go`
```
// Copyright 2020 PingCAP, Inc. Licensed under Apache-2.0.

package main

import (
	"bytes"
	"context"
	"crypto/sha256"
	"encoding/hex"
	"encoding/json"
	"path"
	"reflect"

	"github.com/gogo/protobuf/proto"
	"github.com/pingcap/errors"
	backuppb "github.com/pingcap/kvproto/pkg/brpb"
	"github.com/pingcap/kvproto/pkg/import_sstpb"
	"github.com/pingcap/log"
	"github.com/pingcap/tidb/br/pkg/conn"
	berrors "github.com/pingcap/tidb/br/pkg/errors"
	"github.com/pingcap/tidb/br/pkg/logutil"
	"github.com/pingcap/tidb/br/pkg/metautil"
	"github.com/pingcap/tidb/br/pkg/mock/mockid"
	restoreutils "github.com/pingcap/tidb/br/pkg/restore/utils"
	"github.com/pingcap/tidb/br/pkg/rtree"
	"github.com/pingcap/tidb/br/pkg/stream"
	"github.com/pingcap/tidb/br/pkg/task"
	"github.com/pingcap/tidb/br/pkg/utils"
	"github.com/pingcap/tidb/br/pkg/version/build"
	"github.com/pingcap/tidb/pkg/meta/model"
	tidblogutil "github.com/pingcap/tidb/pkg/util/logutil"
	"github.com/spf13/cobra"
	"go.uber.org/zap"
)

// NewDebugCommand return a debug subcommand.
func NewDebugCommand() *cobra.Command {
	meta := &cobra.Command{
		Use:          "debug <subcommand>",
		Short:        "commands to check/debug backup data",
		SilenceUsage: false,
		PersistentPreRunE: func(c *cobra.Command, args []string) error {
			if err := Init(c); err != nil {
				return errors.Trace(err)
			}
			build.LogInfo(build.BR)
			tidblogutil.LogEnvVariables()
			task.LogArguments(c)
			return nil
		},
		// To be compatible with older BR.
		Aliases: []string{"validate"},
	}
	meta.AddCommand(newCheckSumCommand())
	meta.AddCommand(newBackupMetaCommand())
	meta.AddCommand(decodeBackupMetaCommand())
	meta.AddCommand(encodeBackupMetaCommand())
	meta.AddCommand(setPDConfigCommand())
	meta.AddCommand(searchStreamBackupCommand())
	meta.Hidden = true

	return meta
}

func newCheckSumCommand() *cobra.Command {
	command := &cobra.Command{
		Use:   "checksum",
		Short: "check the backup data",
		Args:  cobra.NoArgs,
		RunE: func(cmd *cobra.Command, _ []string) error {
			ctx, cancel := context.WithCancel(GetDefaultContext())
			defer cancel()

			var cfg task.Config
			if err := cfg.ParseFromFlags(cmd.Flags()); err != nil {
				return errors.Trace(err)
			}

			_, s, backupMeta, err := task.ReadBackupMeta(ctx, metautil.MetaFile, &cfg)
			if err != nil {
				return errors.Trace(err)
			}

			reader := metautil.NewMetaReader(backupMeta, s, &cfg.CipherInfo)
			dbs, err := metautil.LoadBackupTables(ctx, reader, false)
			if err != nil {
				return errors.Trace(err)
			}

			for _, db := range dbs {
				for _, tbl := range db.Tables {
					var calCRC64 uint64
					var totalKVs uint64
					var totalBytes uint64
					for _, files := range tbl.FilesOfPhysicals {
						for _, file := range files {
							calCRC64 ^= file.Crc64Xor
							totalKVs += file.GetTotalKvs()
							totalBytes += file.GetTotalBytes()
							log.Info("file info", zap.Stringer("table", tbl.Info.Name),
								zap.String("file", file.GetName()),
								zap.Uint64("crc64xor", file.GetCrc64Xor()),
								zap.Uint64("totalKvs", file.GetTotalKvs()),
								zap.Uint64("totalBytes", file.GetTotalBytes()),
								zap.Uint64("startVersion", file.GetStartVersion()),
								zap.Uint64("endVersion", file.GetEndVersion()),
								logutil.Key("startKey", file.GetStartKey()),
								logutil.Key("endKey", file.GetEndKey()),
							)

							var data []byte
							data, err = s.ReadFile(ctx, file.Name)
							if err != nil {
								return errors.Trace(err)
							}
							s := sha256.Sum256(data)
							if !bytes.Equal(s[:], file.Sha256) {
								return errors.Annotatef(berrors.ErrBackupChecksumMismatch, `
backup data checksum failed: %s may be changed
calculated sha256 is %s,
origin sha256 is %s`,
									file.Name, hex.EncodeToString(s[:]), hex.EncodeToString(file.Sha256))
							}
						}
					}
					if tbl.Info == nil {
						log.Info("table info(empty)", zap.Stringer("db", db.Info.Name))
					} else {
						log.Info("table info", zap.Stringer("table", tbl.Info.Name),
							zap.Uint64("CRC64", calCRC64),
							zap.Uint64("totalKvs", totalKVs),
							zap.Uint64("totalBytes", totalBytes),
							zap.Uint64("schemaTotalKvs", tbl.TotalKvs),
							zap.Uint64("schemaTotalBytes", tbl.TotalBytes),
							zap.Uint64("schemaCRC64", tbl.Crc64Xor))
					}
				}
			}
			cmd.Println("backup data checksum succeed!")
			return nil
		},
	}
	command.Hidden = true
	return command
}

func newBackupMetaCommand() *cobra.Command {
	command := &cobra.Command{
		Use:          "backupmeta",
		Short:        "utilities of backupmeta",
		SilenceUsage: false,
	}
	command.AddCommand(newBackupMetaValidateCommand())
	return command
}

func newBackupMetaValidateCommand() *cobra.Command {
	command := &cobra.Command{
		Use:   "validate",
		Short: "validate key range and rewrite rules of backupmeta",
		RunE: func(cmd *cobra.Command, _ []string) error {
			ctx, cancel := context.WithCancel(GetDefaultContext())
			defer cancel()

			tableIDOffset, err := cmd.Flags().GetUint64("offset")
			if err != nil {
				return errors.Trace(err)
			}

			var cfg task.Config
			if err = cfg.ParseFromFlags(cmd.Flags()); err != nil {
				return errors.Trace(err)
			}
			_, s, backupMeta, err := task.ReadBackupMeta(ctx, metautil.MetaFile, &cfg)
			if err != nil {
				log.Error("read backupmeta failed", zap.Error(err))
				return errors.Trace(err)
			}
			reader := metautil.NewMetaReader(backupMeta, s, &cfg.CipherInfo)
			dbs, err := metautil.LoadBackupTables(ctx, reader, false)
			if err != nil {
				log.Error("load tables failed", zap.Error(err))
				return errors.Trace(err)
			}
			files := make([]*backuppb.File, 0)
			tables := make([]*metautil.Table, 0)
			for _, db := range dbs {
				for _, table := range db.Tables {
					for _, fs := range table.FilesOfPhysicals {
						files = append(files, fs...)
					}
				}
				tables = append(tables, db.Tables...)
			}
			// Check if the ranges of files overlapped
			rangeTree := rtree.NewRangeTree()
			for _, file := range files {
				if out := rangeTree.InsertRange(rtree.Range{
					KeyRange: rtree.KeyRange{
						StartKey: file.GetStartKey(),
						EndKey:   file.GetEndKey(),
					},
				}); out != nil {
					log.Error(
						"file ranges overlapped",
						zap.Stringer("out", out),
						logutil.File(file),
					)
				}
			}

			tableIDAllocator := mockid.NewIDAllocator()
			// Advance table ID allocator to the offset.
			for range tableIDOffset {
				_, _ = tableIDAllocator.Alloc() // Ignore error
			}
			rewriteRules := &restoreutils.RewriteRules{
				Data: make([]*import_sstpb.RewriteRule, 0),
			}
			tableIDMap := make(map[int64]int64)
			// Simulate to create table
			for _, table := range tables {
				if table.Info == nil {
					// empty database.
					continue
				}
				indexIDAllocator := mockid.NewIDAllocator()
				newTable := new(model.TableInfo)
				tableID, _ := tableIDAllocator.Alloc()
				newTable.ID = int64(tableID)
				newTable.Name = table.Info.Name
				newTable.Indices = make([]*model.IndexInfo, len(table.Info.Indices))
				for i, indexInfo := range table.Info.Indices {
					indexID, _ := indexIDAllocator.Alloc()
					newTable.Indices[i] = &model.IndexInfo{
						ID:   int64(indexID),
						Name: indexInfo.Name,
					}
				}
				if table.Info.Partition != nil {
					if table.Info.Partition != nil {
						newTable.Partition = &model.PartitionInfo{
							Definitions: make([]model.PartitionDefinition, len(table.Info.Partition.Definitions)),
						}
					}
					for _, old := range table.Info.Partition.Definitions {
						partitionID, _ := tableIDAllocator.Alloc()
						newTable.Partition.Definitions = append(newTable.Partition.Definitions, model.PartitionDefinition{
							ID:   int64(partitionID),
							Name: old.Name,
						})
					}
				}

				rules := restoreutils.GetRewriteRules(newTable, table.Info, 0, true)
				rewriteRules.Data = append(rewriteRules.Data, rules.Data...)
				tableIDMap[table.Info.ID] = int64(tableID)
			}
			// Validate rewrite rule
```

### Core Architecture Module: `br/cmd/br/fips.go`
```
// Copyright 2023 PingCAP, Inc.
//
// Licensed under the Apache License, Version 2.0 (the "License");
// you may not use this file except in compliance with the License.
// You may obtain a copy of the License at
//
//     http://www.apache.org/licenses/LICENSE-2.0
//
// Unless required by applicable law or agreed to in writing, software
// distributed under the License is distributed on an "AS IS" BASIS,
// WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
// See the License for the specific language governing permissions and
// limitations under the License.

//go:build boringcrypto

package main

import _ "crypto/tls/fipsonly"

```

### Core Architecture Module: `br/cmd/br/main.go`
```
package main

import (
	"context"
	"os"

	"github.com/pingcap/log"
	"github.com/pingcap/tidb/br/pkg/utils"
	"github.com/pingcap/tidb/pkg/config"
	"github.com/spf13/cobra"
	"go.uber.org/zap"
)

func main() {
	gCtx := context.Background()
	ctx, cancel := utils.StartExitSingleListener(gCtx)
	defer cancel()

	rootCmd := &cobra.Command{
		Use:              "br",
		Short:            "br is a TiDB/TiKV cluster backup restore tool.",
		TraverseChildren: true,
		SilenceUsage:     true,
	}
	DefineCommonFlags(rootCmd)
	SetDefaultContext(ctx)

	config.GetGlobalConfig().Instance.TiDBEnableDDL.Store(false)

	rootCmd.AddCommand(
		NewDebugCommand(),
		NewBackupCommand(),
		NewRestoreCommand(),
		NewStreamCommand(),
		newOperatorCommand(),
		NewAbortCommand(),
	)
	// Outputs cmd.Print to stdout.
	rootCmd.SetOut(os.Stdout)

	rootCmd.SetArgs(os.Args[1:])
	if err := rootCmd.Execute(); err != nil {
		log.Error("br failed", zap.Error(err))
		os.Exit(1) // nolint:gocritic
	}
}

```

### Core Architecture Module: `br/cmd/br/operator.go`
```
// Copyright 2023 PingCAP, Inc. Licensed under Apache-2.0.

package main

import (
	"context"

	"github.com/pingcap/errors"
	"github.com/pingcap/tidb/br/pkg/stream/crr/service"
	"github.com/pingcap/tidb/br/pkg/task"
	"github.com/pingcap/tidb/br/pkg/task/operator"
	"github.com/pingcap/tidb/br/pkg/version/build"
	"github.com/pingcap/tidb/pkg/util/logutil"
	"github.com/spf13/cobra"
)

type crrCheckpointServiceStateKey struct{}

type crrCheckpointServiceState struct {
	service *service.Service
	cleanup func()
}

func newOperatorCommand() *cobra.Command {
	cmd := &cobra.Command{
		Use:   "operator <subcommand>",
		Short: "utilities for operators like tidb-operator.",
		PersistentPreRunE: func(c *cobra.Command, args []string) error {
			if err := Init(c); err != nil {
				return errors.Trace(err)
			}
			build.LogInfo(build.BR)
			logutil.LogEnvVariables()
			task.LogArguments(c)
			return nil
		},
		Hidden: true,
	}
	cmd.AddCommand(newPrepareForSnapshotBackupCommand(
		"pause-gc-and-schedulers",
		"(Will be replaced with `prepare-for-snapshot-backup`) pause gc, schedulers and importing until the program exits."))
	cmd.AddCommand(newPrepareForSnapshotBackupCommand(
		"prepare-for-snapshot-backup",
		"pause gc, schedulers and importing until the program exits, for snapshot backup."))
	cmd.AddCommand(newBase64ifyCommand())
	cmd.AddCommand(newListMigrationsCommand())
	cmd.AddCommand(newMigrateToCommand())
	cmd.AddCommand(newForceFlushCommand())
	cmd.AddCommand(newCRRCheckpointCommand())
	cmd.AddCommand(newChecksumCommand())
	cmd.AddCommand(newTestStorageCommand())
	cmd.AddCommand(newPitrChecksumCommand())
	cmd.AddCommand(newUpstreamChecksumCommand())
	return cmd
}

func newPrepareForSnapshotBackupCommand(use string, short string) *cobra.Command {
	cmd := &cobra.Command{
		Use:   use,
		Short: short,
		Args:  cobra.NoArgs,
		RunE: func(cmd *cobra.Command, args []string) error {
			cfg := operator.PauseGcConfig{}
			if err := cfg.ParseFromFlags(cmd.Flags()); err != nil {
				return err
			}
			ctx := GetDefaultContext()
			return operator.AdaptEnvForSnapshotBackup(ctx, &cfg)
		},
	}
	operator.DefineFlagsForPrepareSnapBackup(cmd.Flags())
	return cmd
}

func newBase64ifyCommand() *cobra.Command {
	cmd := &cobra.Command{
		Use:   "base64ify [-r] -s <storage>",
		Short: "generate base64 for a storage. this may be passed to `tikv-ctl compact-log-backup`.",
		Args:  cobra.NoArgs,
		RunE: func(cmd *cobra.Command, args []string) error {
			cfg := operator.Base64ifyConfig{}
			if err := cfg.ParseFromFlags(cmd.Flags()); err != nil {
				return err
			}
			ctx := GetDefaultContext()
			return operator.Base64ify(ctx, cfg)
		},
	}
	operator.DefineFlagsForBase64ifyConfig(cmd.Flags())
	return cmd
}

func newListMigrationsCommand() *cobra.Command {
	cmd := &cobra.Command{
		Use:   "list-migrations",
		Short: "list all migrations",
		Args:  cobra.NoArgs,
		RunE: func(cmd *cobra.Command, args []string) error {
			cfg := operator.ListMigrationConfig{}
			if err := cfg.ParseFromFlags(cmd.Flags()); err != nil {
				return err
			}
			ctx := GetDefaultContext()
			return operator.RunListMigrations(ctx, cfg)
		},
	}
	operator.DefineFlagsForListMigrationConfig(cmd.Flags())
	return cmd
}

func newMigrateToCommand() *cobra.Command {
	cmd := &cobra.Command{
		Use: "unsafe-migrate-to",
		Short: "migrate to a specific version, use truncate will auto migrate to correct version, " +
			"you should never use this command unless you know what you are doing",
		Args: cobra.NoArgs,
		RunE: func(cmd *cobra.Command, args []string) error {
			cfg := operator.MigrateToConfig{}
			if err := cfg.ParseFromFlags(cmd.Flags()); err != nil {
				return err
			}
			ctx := GetDefaultContext()
			return operator.RunMigrateTo(ctx, cfg)
		},
	}
	operator.DefineFlagsForMigrateToConfig(cmd.Flags())
	cmd.Hidden = true
	return cmd
}

func newChecksumCommand() *cobra.Command {
	cmd := &cobra.Command{
		Use:   "checksum-as",
		Short: "calculate the checksum with rewrite rules",
		Long: "Calculate the checksum of the current cluster (specified by `-u`) " +
			"with applying the rewrite rules generated from a backup (specified by `-s`). " +
			"This can be used when you have the checksum of upstream elsewhere.",
		Args: cobra.NoArgs,
		RunE: func(cmd *cobra.Command, args []string) error {
			cfg := operator.ChecksumWithRewriteRulesConfig{}
			if err := cfg.ParseFromFlags(cmd.Flags()); err != nil {
				return err
			}
			ctx := GetDefaultContext()
			return operator.RunChecksumTable(ctx, tidbGlue, cfg)
		},
	}
	task.DefineFilterFlags(cmd, []string{"!*.*"}, false)
	operator.DefineFlagsForChecksumTableConfig(cmd.Flags())
	return cmd
}

func newPitrChecksumCommand() *cobra.Command {
	cmd := &cobra.Command{
		Use:   "checksum-pitr",
		Short: "calculate the checksum with pitr id map",
		Long: "Calculate the checksum of the current cluster (specified by `-u`) " +
			"with applying the rewrite rules generated from pitr id map (specified by `-s` if saved in external storage). " +
			"This can be used when you have the checksum of upstream elsewhere.",
		Args: cobra.NoArgs,
		RunE: func(cmd *cobra.Command, args []string) error {
			cfg := operator.ChecksumWithPitrIdMapConfig{}
			if err := cfg.ParseFromFlags(cmd.Flags()); err != nil {
				return err
			}
			ctx := GetDefaultContext()
			return operator.RunPitrChecksumTable(ctx, tidbGlue, cfg)
		},
	}
	task.DefineFilterFlags(cmd, []string{"!*.*"}, false)
	operator.DefineFlagsForChecksumPitrTableConfig(cmd.Flags())
	return cmd
}

func newUpstreamChecksumCommand() *cobra.Command {
	cmd := &cobra.Command{
		Use:   "checksum-upstream",
		Short: "calculate the checksum",
		Long: "Calculate the checksum of the current cluster (specified by `-u`). " +
			"This can be used when you have the checksum of upstream elsewhere",
		Args: cobra.NoArgs,
		RunE: func(cmd *cobra.Command, args []string) error {
			cfg := operator.ChecksumUpstreamConfig{}
			if err := cfg.ParseFromFlags(cmd.Flags()); err != nil {
				return err
			}
			ctx := GetDefaultContext()
			return operator.RunUpstreamChecksumTable(ctx, tidbGlue, cfg)
		},
	}
	task.DefineFilterFlags(cmd, []string{"!*.*"}, false)
	operator.DefineFlagsForChecksumUpstreamTableConfig(cmd.Flags())
	return cmd
}

func newForceFlushCommand() *cobra.Command {
	cmd := &cobra.Command{
		Use:   "force-flush",
		Short: "force a log backup task to flush",
		Args:  cobra.NoArgs,
		RunE: func(cmd *cobra.Command, args []string) error {
			cfg := operator.ForceFlushConfig{}
			if err := cfg.ParseFromFlags(cmd.Flags()); err != nil {
				return err
			}
			ctx := GetDefaultContext()
			return operator.RunForceFlush(ctx, &cfg)
		},
	}
	operator.DefineFlagsForForceFlushConfig(cmd.Flags())
	return cmd
}

func newCRRCheckpointCommand() *cobra.Command {
	cmd := &cobra.Command{
		Use:   "crr-checkpoint",
		Short: "run the CRR checkpoint service",
		Args:  cobra.NoArgs,
		RunE: func(cmd *cobra.Command, args []string) error {
			state, err := getCRRCheckpointServiceState(cmd)
			if err != nil {
				return err
			}
			defer state.cleanup()
			return state.service.Run(GetDefaultContext())
		},
	}
	operator.DefineFlagsForCRRCheckpointConfig(cmd.Flags())
	registerStatusServerPreparer(cmd, prepareCRRCheckpointStatusServer)
	return cmd
}

func prepareCRRCheckpointStatusServer(cmd *cobra.Command) (statusServerRegistrar, error) {
	cfg := operator.CRRCheckpointConfig{}
	if err := cfg.ParseFromFlags(cmd.Flags()); err != nil {
		return nil, err
	}
	svc, cleanup, err := operator.NewCRRCheckpointService(GetDefaultContext(), tidbGlue, cfg)
	if err != nil {
		return nil, err
	}

	baseCtx := cmd.Context()
	if baseCtx == nil {
		baseCtx = context.Background()
	}
	cmd.SetContext(context.WithValue(baseCtx, crrCheckpointServiceStateKey{}, &crrCheckpointServiceState{
		service: svc,
		cleanup: cleanup,
	}))
	return svc.Register, nil
}

func getCRRCheckpointServiceState(cmd *cobra.Command) (*crrCheckpointServiceState, error) {
	if cmd.Context() == nil {
		return nil, errors.New("crr checkp
```

### Core Architecture Module: `br/cmd/br/restore.go`
```
// Copyright 2020 PingCAP, Inc. Licensed under Apache-2.0.

package main

import (
	"fmt"

	"github.com/pingcap/errors"
	"github.com/pingcap/log"
	berrors "github.com/pingcap/tidb/br/pkg/errors"
	"github.com/pingcap/tidb/br/pkg/gluetidb"
	"github.com/pingcap/tidb/br/pkg/gluetikv"
	"github.com/pingcap/tidb/br/pkg/summary"
	"github.com/pingcap/tidb/br/pkg/task"
	"github.com/pingcap/tidb/br/pkg/trace"
	"github.com/pingcap/tidb/br/pkg/utils"
	"github.com/pingcap/tidb/br/pkg/version/build"
	"github.com/pingcap/tidb/pkg/config"
	"github.com/pingcap/tidb/pkg/kv"
	"github.com/pingcap/tidb/pkg/session"
	"github.com/pingcap/tidb/pkg/util/gctuner"
	"github.com/pingcap/tidb/pkg/util/logutil"
	"github.com/pingcap/tidb/pkg/util/metricsutil"
	"github.com/spf13/cobra"
	"go.uber.org/zap"
	"sourcegraph.com/sourcegraph/appdash"
)

func runRestoreCommand(command *cobra.Command, cmdName string) error {
	cfg := task.RestoreConfig{Config: task.Config{LogProgress: HasLogFile()}}
	if err := cfg.ParseFromFlags(command.Flags(), false); err != nil {
		command.SilenceUsage = false
		return errors.Trace(err)
	}

	if err := metricsutil.RegisterMetricsForBR(cfg.PD, cfg.TLS, cfg.KeyspaceName); err != nil {
		return errors.Trace(err)
	}

	if task.IsStreamRestore(cmdName) {
		if err := cfg.ParseStreamRestoreFlags(command.Flags()); err != nil {
			return errors.Trace(err)
		}
	}

	// have to skip grant table, in order to NotifyUpdatePrivilege in binary mode
	config.GetGlobalConfig().Security.SkipGrantTable = true

	ctx := GetDefaultContext()
	if cfg.EnableOpenTracing {
		var store *appdash.MemoryStore
		ctx, store = trace.TracerStartSpan(ctx)
		defer trace.TracerFinishSpan(ctx, store)
	}

	if cfg.FullBackupType == task.FullBackupTypeEBS {
		if cfg.Prepare {
			if err := task.RunRestoreEBSMeta(GetDefaultContext(), gluetikv.Glue{}, cmdName, &cfg); err != nil {
				log.Error("failed to restore EBS meta", zap.Error(err))
				return errors.Trace(err)
			}
		} else {
			if err := task.RunResolveKvData(GetDefaultContext(), tidbGlue, cmdName, &cfg); err != nil {
				log.Error("failed to restore data", zap.Error(err))
				return errors.Trace(err)
			}
		}
		return nil
	}

	config.UpdateGlobal(func(conf *config.Config) {
		// Need to be skipped when the cluster has TiDB type coprocessor tasks
		conf.AdvertiseAddress = config.UnavailableIP

		// No need to cache the coproceesor result
		conf.TiKVClient.CoprCache.CapacityMB = 0
	})

	// Disable the memory limit tuner. That's because the server memory is get from TiDB node instead of BR node.
	gctuner.GlobalMemoryLimitTuner.DisableAdjustMemoryLimit()
	defer gctuner.GlobalMemoryLimitTuner.EnableAdjustMemoryLimit()

	if len(cfg.Schemas) > 0 {
		extraDBNames := make([]string, 0, len(cfg.Schemas))
		for schema := range cfg.Schemas {
			extraDBNames = append(extraDBNames, utils.UnquoteName(schema))
		}
		filter := gluetidb.FilterLoadSpecifiedDBAndSysDBs(extraDBNames)
		restore := setTiDBGlueDBFilter(filter)
		defer restore()
	}
	if err := task.RunRestore(GetDefaultContext(), tidbGlue, cmdName, &cfg); err != nil {
		log.Error("failed to restore", zap.Error(err))
		printWorkaroundOnFullRestoreError(err)
		return errors.Trace(err)
	}
	return nil
}

// print workaround when we met not fresh or incompatible cluster error on full cluster restore
func printWorkaroundOnFullRestoreError(err error) {
	if !errors.ErrorEqual(err, berrors.ErrRestoreNotFreshCluster) &&
		!errors.ErrorEqual(err, berrors.ErrRestoreIncompatibleSys) {
		return
	}
	fmt.Println("#######################################################################")
	switch {
	case errors.ErrorEqual(err, berrors.ErrRestoreNotFreshCluster):
		fmt.Println("# the target cluster is not fresh, cannot restore.")
		fmt.Println("# you can drop existing databases and tables and start restore again")
	case errors.ErrorEqual(err, berrors.ErrRestoreIncompatibleSys):
		fmt.Println("# the target cluster is not compatible with the backup data,")
		fmt.Println("# you can use '--with-sys-table=false' to skip restoring system tables")
	}
	fmt.Println("#######################################################################")
}

func runRestoreRawCommand(command *cobra.Command, cmdName string) error {
	cfg := task.RestoreRawConfig{
		RawKvConfig: task.RawKvConfig{Config: task.Config{LogProgress: HasLogFile()}},
	}
	if err := cfg.ParseFromFlags(command.Flags()); err != nil {
		command.SilenceUsage = false
		return errors.Trace(err)
	}

	ctx := GetDefaultContext()
	if cfg.EnableOpenTracing {
		var store *appdash.MemoryStore
		ctx, store = trace.TracerStartSpan(ctx)
		defer trace.TracerFinishSpan(ctx, store)
	}
	if err := task.RunRestoreRaw(GetDefaultContext(), gluetikv.Glue{}, cmdName, &cfg); err != nil {
		log.Error("failed to restore raw kv", zap.Error(err))
		return errors.Trace(err)
	}
	return nil
}

func runRestoreTxnCommand(command *cobra.Command, cmdName string) error {
	cfg := task.Config{LogProgress: HasLogFile()}
	if err := cfg.ParseFromFlags(command.Flags()); err != nil {
		command.SilenceUsage = false
		return errors.Trace(err)
	}

	ctx := GetDefaultContext()
	if cfg.EnableOpenTracing {
		var store *appdash.MemoryStore
		ctx, store = trace.TracerStartSpan(ctx)
		defer trace.TracerFinishSpan(ctx, store)
	}
	if err := task.RunRestoreTxn(GetDefaultContext(), gluetikv.Glue{}, cmdName, &cfg); err != nil {
		log.Error("failed to restore txn kv", zap.Error(err))
		return errors.Trace(err)
	}
	return nil
}

// NewRestoreCommand returns a restore subcommand.
func NewRestoreCommand() *cobra.Command {
	command := &cobra.Command{
		Use:          "restore",
		Short:        "restore a TiDB/TiKV cluster",
		SilenceUsage: true,
		PersistentPreRunE: func(c *cobra.Command, args []string) error {
			if err := Init(c); err != nil {
				return errors.Trace(err)
			}
			build.LogInfo(build.BR)
			logutil.LogEnvVariables()
			task.LogArguments(c)
			session.DisableStats4Test()
			kv.TxnTotalSizeLimit.Store(config.SuperLargeTxnSize)

			summary.SetUnit(summary.RestoreUnit)
			return nil
		},
	}
	command.AddCommand(
		newFullRestoreCommand(),
		newDBRestoreCommand(),
		newTableRestoreCommand(),
		newRawRestoreCommand(),
		newTxnRestoreCommand(),
		newStreamRestoreCommand(),
	)
	task.DefineRestoreFlags(command.PersistentFlags())

	return command
}

func newFullRestoreCommand() *cobra.Command {
	command := &cobra.Command{
		Use:   "full",
		Short: "restore all tables",
		Args:  cobra.NoArgs,
		RunE: func(cmd *cobra.Command, _ []string) error {
			return runRestoreCommand(cmd, task.FullRestoreCmd)
		},
	}
	task.DefineFilterFlags(command, filterOutSysAndMemKeepAuthAndBind, false)
	task.DefineRestoreSnapshotFlags(command)
	return command
}

func newDBRestoreCommand() *cobra.Command {
	command := &cobra.Command{
		Use:   "db",
		Short: "restore tables in a database from the backup data",
		Args:  cobra.NoArgs,
		RunE: func(cmd *cobra.Command, _ []string) error {
			return runRestoreCommand(cmd, task.DBRestoreCmd)
		},
	}
	task.DefineDatabaseFlags(command)
	return command
}

func newTableRestoreCommand() *cobra.Command {
	command := &cobra.Command{
		Use:   "table",
		Short: "restore a table from the backup data",
		Args:  cobra.NoArgs,
		RunE: func(cmd *cobra.Command, _ []string) error {
			return runRestoreCommand(cmd, task.TableRestoreCmd)
		},
	}
	task.DefineTableFlags(command)
	return command
}

func newRawRestoreCommand() *cobra.Command {
	command := &cobra.Command{
		Use:   "raw",
		Short: "(experimental) restore a raw kv range to TiKV cluster",
		Args:  cobra.NoArgs,
		RunE: func(cmd *cobra.Command, _ []string) error {
			return runRestoreRawCommand(cmd, task.RawRestoreCmd)
		},
	}

	task.DefineRawRestoreFlags(command)
	return command
}

func newTxnRestoreCommand() *cobra.Command {
	command := &cobra.Command{
		Use:   "txn",
		Short: "(experimental) restore txn kv to TiKV cluster",
		Args:  cobra.NoArgs,
		RunE: func(cmd *cobra.Command, _ []string) error {
			return runRestoreTxnCommand(cmd, task.TxnRestoreCmd)
		},
	}

	task.DefineRaw
```


### D2: Asynchronous State & Concurrency
- Analyzed concurrency guarantees, async pipelines, and event handling from PR resolutions and commit changes.

### D3: Error Boundaries, Recovery & Rollbacks
- Exception handling patterns and defect resolutions extracted from closed production bug issues:
- **Issue #71699** (2026-09-30): **parser: support WITH DEFAULT NDVRATE in ANALYZE**
  *Symptoms*: <!--  Thank you for contributing to TiDB!  PR Title Format: 1. pkg [, pkg2, pkg3]: what's changed 2. *: what's changed  -->  ### What problem does this PR solve? <!--  Please create an issue first to describe the problem.  There MUST be one line starting with "Issue Number:  " and linking the relevant issues via the "close" or "ref".  For more info, check https://pingcap.github.io/tidb-dev-guide/contribute-to-tidb/contribute-code.html#referring-to-an-issue.  -->  Issue Number: ref #67449  Problem Summary:  ANALYZE accepts `WITH DEFAULT` for its other options to reset a saved value, but not for `NDVRATE`.  ### What changed and how does it work?  Split from #71520.  - Parse `WITH DEFAULT NDVRATE` as an `NDVRATE` option without a value. - ANALYZE ignores it until `NDVRATE` can be saved.  ### Check List  Tests <!-- At least one of them must be included. -->  - [x] Unit test - [ ] Integration test - [ ] Manual test (add detailed scripts or steps below) - [ ] No need to test   > - [ ] I checked and no code files have been changed.   > <!-- Or your custom  "No need to test" reasons -->  Side effects  - [ ] Performance regression: Consumes more CPU - [ ] Performance regression: Consumes more Memory - [ ] Breaking backward compatibility  Documentation  - [ ] Affects user behaviors - [x] Contains syntax changes - [ ] Contains variable changes - [ ] Contains experimental features - [ ] Changes MySQL compatibility  ### Release note  <!-- compatibility change, improvement, bugfix, and new
  **Post-Mortem & Fix Analysis**:
  > <!-- This is an auto-generated comment: summarize by coderabbit.ai --> <!-- review_stack_entry_start -->  <a href="https://app.coderabbit.ai/change-stack/pingcap/tidb/pull/71699?cs_source=review_comment"><img src="https://storage.googleapis.com/coderabbit_public_assets/review-stack-in-coderabbit-ui-dark.svg?v=2" alt="Review in Change Stack →" width="220" height="32"></a>  Navigate logical layers of code changes, visualize relationships, and explore their blast radius.  <!-- review_stack_entry_end --> <!-- recent_review_start -->  No actionable comments were generated in the recent review. 🎉  <details> <summary>ℹ️ Recent review info</summary>  <details> <summary>⚙️ Run configuration</summary>  **Configuration used**: Repository UI  **Review profile**: CHILL  **Plan**: Advanced  **Run ID**: `579b92c1-c260-4a04-a8c8-d638e35e08bb`  </details>  <details> <summary>📥 Commits</summary>  Reviewing files that changed from the base of the PR and between 12b639a1161cd5a60126a47277f5ad14c320fd4a 
  > ## [Codecov](https://app.codecov.io/gh/pingcap/tidb/pull/71699?dropdown=coverage&src=pr&el=h1&utm_medium=referral&utm_source=github&utm_content=comment&utm_campaign=pr+comments&utm_term=pingcap) Report :white_check_mark: All modified and coverable lines are covered by tests. :white_check_mark: Project coverage is 71.9952%. Comparing base ([`12b639a`](https://app.codecov.io/gh/pingcap/tidb/commit/12b639a1161cd5a60126a47277f5ad14c320fd4a?dropdown=coverage&el=desc&utm_medium=referral&utm_source=github&utm_content=comment&utm_campaign=pr+comments&utm_term=pingcap)) to head ([`93f6294`](https://app.codecov.io/gh/pingcap/tidb/commit/93f62948995a2285c539b4c573eb4ce31b5dfd87?dropdown=coverage&el=desc&utm_medium=referral&utm_source=github&utm_content=comment&utm_campaign=pr+comments&utm_term=pingcap)). :warning: Report is 3 commits behind head on master.  <details><summary>Additional details and impacted files</summary>    ```diff @@               Coverage Diff                @@ ##             
  > /retest

- **Issue #71696** (2026-09-30): **dumpling: make --pd optional for premium keyspace clusters**
  *Symptoms*: <!--  Thank you for contributing to TiDB!  PR Title Format: 1. pkg [, pkg2, pkg3]: what's changed 2. *: what's changed  -->  ### What problem does this PR solve? <!--  Please create an issue first to describe the problem.  There MUST be one line starting with "Issue Number:  " and linking the relevant issues via the "close" or "ref".  For more info, check https://pingcap.github.io/tidb-dev-guide/contribute-to-tidb/contribute-code.html#referring-to-an-issue.  -->  Issue Number: ref #66882  Problem Summary:  For premium keyspace clusters, Dumpling resolved keyspace metadata from `information_schema.KEYSPACE_META` and then hard-required `--pd` to set up keyspace-level GC protection. When `--pd` was missing it failed the whole dump with `premium keyspace cluster requires --pd`, so cloud control (or a user) had to always supply PD endpoints even when GC protection was not wanted or the PD endpoints were not reachable.  By making `--pd` optional, a user can now build Dumpling from master and connect it to a TiDB Cloud Premium (keyspace) cluster, which previously failed unless PD endpoints that are not reachable from the user's environment were supplied.  ### What changed and how does it work?  `--pd` is now optional for premium keyspace clusters:  - `tidbResolveKeyspaceMetaForGC` still resolves and records the keyspace name   and ID for a premium cluster, but no longer fails when `--pd` is absent. - `tidbSetPDClientForGC` treats an empty/blank `--pd` for a premium cluster as   "ski
  **Post-Mortem & Fix Analysis**:
  > <!-- This is an auto-generated comment: summarize by coderabbit.ai --> <!-- review_stack_entry_start -->  <a href="https://app.coderabbit.ai/change-stack/pingcap/tidb/pull/71696?cs_source=review_comment"><img src="https://storage.googleapis.com/coderabbit_public_assets/review-stack-in-coderabbit-ui-dark.svg?v=2" alt="Review in Change Stack →" width="220" height="32"></a>  Navigate logical layers of code changes, visualize relationships, and explore their blast radius.  <!-- review_stack_entry_end --> <!-- recent_review_start -->  No actionable comments were generated in the recent review. 🎉  <details> <summary>ℹ️ Recent review info</summary>  <details> <summary>⚙️ Run configuration</summary>  **Configuration used**: Repository UI  **Review profile**: CHILL  **Plan**: Advanced  **Run ID**: `2483dedc-78bd-4843-bbb6-73118c27ebe1`  </details>  <details> <summary>📥 Commits</summary>  Reviewing files that changed from the base of the PR and between 0ea194c1d7b1f27c4e8360278d1606dfa93a9f7e 
  > ## [Codecov](https://app.codecov.io/gh/pingcap/tidb/pull/71696?dropdown=coverage&src=pr&el=h1&utm_medium=referral&utm_source=github&utm_content=comment&utm_campaign=pr+comments&utm_term=pingcap) Report :x: Patch coverage is `0%` with `3 lines` in your changes missing coverage. Please review. :white_check_mark: Project coverage is 73.2384%. Comparing base ([`12b639a`](https://app.codecov.io/gh/pingcap/tidb/commit/12b639a1161cd5a60126a47277f5ad14c320fd4a?dropdown=coverage&el=desc&utm_medium=referral&utm_source=github&utm_content=comment&utm_campaign=pr+comments&utm_term=pingcap)) to head ([`86e7c77`](https://app.codecov.io/gh/pingcap/tidb/commit/86e7c77256232d7b2bbceb892236a7d58429f73a?dropdown=coverage&el=desc&utm_medium=referral&utm_source=github&utm_content=comment&utm_campaign=pr+comments&utm_term=pingcap)). :warning: Report is 1 commits behind head on master.  <details><summary>Additional details and impacted files</summary>    ```diff @@               Coverage Diff                @
  > 🔍 Starting code review for this PR...

- **Issue #71695** (2026-09-29): **build: resolve Bazel Go deps through GOPROXY (#69503)**
  *Symptoms*: This is an automated cherry-pick of #69503  Issue Number: close #69513  ## Summary  - change `cmd/mirror` to generate `go_repository` entries with `sum` and `version` instead of mirrored `urls`, `sha256`, and `strip_prefix` - remove the `pingcapmirror` Go module upload path and deprecated `bazel_mirror_upload` - regenerate `DEPS.bzl` so Bazel Go dependencies are resolved by rules_go through the configured Go module environment, e.g. `GOPROXY=...|...,direct`  ## Test Plan  - `make tidy` - `go test ./cmd/mirror` - `PATH=/tmp/tidb-bazel-shim:$PATH make bazel_prepare` - `PATH=/tmp/tidb-bazel-shim:$PATH make bazel_mirror_upload` - `PATH=/tmp/tidb-bazel-shim:$PATH make lint` - `git -c core.whitespace=-tab-in-indent diff --check` - verified `DEPS.bzl` has no `pingcapmirror`, `cache.hawkingrei.com`, `urls`, `sha256`, or `strip_prefix` entries for Go modules  Tests <!-- At least one of them must be included. -->  - [x] Unit test - [x] Integration test - [x] Manual test (add detailed scripts or steps below)  ## Release note  ```release-note None ```   <!-- This is an auto-generated comment: release notes by coderabbit.ai --> ## Summary by CodeRabbit  * **Build Tools**   * Bazel mirror preparation targets no longer pass the legacy `-- --mirror` argument, and `bazel_mirror` skips validation checks.   * `bazel_mirror_upload` no longer performs uploads; it displays a deprecation notice directing you to use `bazel_mirror` to regenerate `DEPS.bzl`.   * The `--mirror` and `--upload` options r
  **Post-Mortem & Fix Analysis**:
  > @wuhuizuo This PR has conflicts, I have hold it. Please resolve them or ask others to resolve them, then comment `/unhold` to remove the hold label.
  > @ti-chi-bot: ## If you want to know how to resolve it, please read the guide in [TiDB Dev Guide](https://pingcap.github.io/tidb-dev-guide/contribute-to-tidb/cherrypick-a-pr.html#troubleshoot-cherry-pick).   <details>  Instructions for interacting with me using PR comments are available [here](https://prow.tidb.net/command-help).  If you have questions or suggestions related to my behavior, please file an issue against the [ti-community-infra/tichi](https://github.com/ti-community-infra/tichi/issues/new?title=Prow%20issue:) repository. </details>
  > <!-- This is an auto-generated comment: summarize by coderabbit.ai --> <!-- review_stack_entry_start -->  <a href="https://app.coderabbit.ai/change-stack/pingcap/tidb/pull/71695?cs_source=review_comment"><img src="https://storage.googleapis.com/coderabbit_public_assets/review-stack-in-coderabbit-ui-dark.svg?v=2" alt="Review in Change Stack →" width="220" height="32"></a>  Navigate logical layers of code changes, visualize relationships, and explore their blast radius.  <!-- review_stack_entry_end --> <!-- recent_review_start -->  No actionable comments were generated in the recent review. 🎉  <details> <summary>ℹ️ Recent review info</summary>  <details> <summary>⚙️ Run configuration</summary>  **Configuration used**: Repository UI  **Review profile**: CHILL  **Plan**: Advanced  **Run ID**: `9ab4f373-f473-44d7-a403-d8b4acc0f905`  </details>  <details> <summary>📥 Commits</summary>  Reviewing files that changed from the base of the PR and between 31dfd0d25e2de908c06f9e4f2537f7f0f77c6b27 

- **Issue #71692** (2026-09-29): **deps: replace 'sourcegraph.com/sourcegraph/appdash*' in go.mod**
  *Symptoms*: ### Release note  Please refer to [Release Notes Language Style Guide](https://pingcap.github.io/tidb-dev-guide/contribute-to-tidb/release-notes-style-guide.html) to write a quality release note.  ```release-note None ```   <!-- This is an auto-generated comment: release notes by coderabbit.ai -->  ## Summary by CodeRabbit  * **Chores**   * Updated references for two supporting components to use their current project locations; their versions remain unchanged.   * The update affects project configuration only. It does not change available features or user-facing workflows. No other end-user-visible changes are included.  <!-- end of auto-generated comment: release notes by coderabbit.ai -->
  **Post-Mortem & Fix Analysis**:
  > <!-- This is an auto-generated comment: summarize by coderabbit.ai --> <!-- review_stack_entry_start -->  <a href="https://app.coderabbit.ai/change-stack/pingcap/tidb/pull/71692?cs_source=review_comment"><img src="https://storage.googleapis.com/coderabbit_public_assets/review-stack-in-coderabbit-ui-dark.svg?v=2" alt="Review in Change Stack →" width="220" height="32"></a>  Navigate logical layers of code changes, visualize relationships, and explore their blast radius.  <!-- review_stack_entry_end --> <!-- recent_review_start -->  No actionable comments were generated in the recent review. 🎉  <details> <summary>ℹ️ Recent review info</summary>  <details> <summary>⚙️ Run configuration</summary>  **Configuration used**: Repository UI  **Review profile**: CHILL  **Plan**: Advanced  **Run ID**: `fb737688-33df-4ee3-a74c-c52a4bef5895`  </details>  <details> <summary>📥 Commits</summary>  Reviewing files that changed from the base of the PR and between 8f3f6c6a689e7bd34ac2ddc51bbe63a03bc845a2 
  > [APPROVALNOTIFIER] This PR is **APPROVED**  This pull-request has been approved by: *<a href="https://github.com/pingcap/tidb/pull/71692#pullrequestreview-5349910174" title="Approved">bb7133</a>*, *<a href="https://github.com/pingcap/tidb/pull/71692#pullrequestreview-5349969825" title="Approved">wjhuang2016</a>*  The full list of commands accepted by this bot can be found [here](https://prow.tidb.net/command-help?repo=pingcap%2Ftidb).  The pull request process is described [here](https://book.prow.tidb.net/#/workflows/pr)  <details > Needs approval from an approver in each of these files:  - ~~[OWNERS](https://github.com/pingcap/tidb/blob/release-6.5-20260921-v6.5.1/OWNERS)~~ [bb7133,wjhuang2016]  Approvers can indicate their approval by writing `/approve` in a comment Approvers can cancel approval by writing `/approve cancel` in a comment </details> <!-- META={"approvers":[]} -->
  > [LGTM Timeline notifier] --- Timeline:  - `2026-09-29 08:43:34.305146956 +0000 UTC m=+699139.530368053`: :ballot_box_with_check: agreed by [bb7133](https://github.com/bb7133). - `2026-09-29 08:48:32.354111593 +0000 UTC m=+699437.579332700`: :ballot_box_with_check: agreed by [wjhuang2016](https://github.com/wjhuang2016).

- **Issue #71691** (2026-09-29): **deps: replace 'sourcegraph.com/sourcegraph/appdash*' in go.mod**
  *Symptoms*: ### Release note  Please refer to [Release Notes Language Style Guide](https://pingcap.github.io/tidb-dev-guide/contribute-to-tidb/release-notes-style-guide.html) to write a quality release note.  ```release-note None ```   <!-- This is an auto-generated comment: release notes by coderabbit.ai -->  ## Summary by CodeRabbit  * **Chores**   * Updated the source references for Appdash and its data package to use their corresponding GitHub-hosted locations. Existing versions remain unchanged. This maintenance update does not add, remove, or change product features or behavior, and end-user workflows are unaffected. The references are now consistent across the project’s dependency configurations.  <!-- end of auto-generated comment: release notes by coderabbit.ai -->
  **Post-Mortem & Fix Analysis**:
  > <!-- This is an auto-generated comment: summarize by coderabbit.ai --> <!-- review_stack_entry_start -->  <a href="https://app.coderabbit.ai/change-stack/pingcap/tidb/pull/71691?cs_source=review_comment"><img src="https://storage.googleapis.com/coderabbit_public_assets/review-stack-in-coderabbit-ui-dark.svg?v=2" alt="Review in Change Stack →" width="220" height="32"></a>  Navigate logical layers of code changes, visualize relationships, and explore their blast radius.  <!-- review_stack_entry_end --> <!-- recent_review_start -->  No actionable comments were generated in the recent review. 🎉  <details> <summary>ℹ️ Recent review info</summary>  <details> <summary>⚙️ Run configuration</summary>  **Configuration used**: Repository UI  **Review profile**: CHILL  **Plan**: Advanced  **Run ID**: `b671fb6c-4b73-4991-850d-05319cdb4b98`  </details>  <details> <summary>📥 Commits</summary>  Reviewing files that changed from the base of the PR and between ca04f9280f507008d844bdde4a499608b5a09257 
  > [APPROVALNOTIFIER] This PR is **APPROVED**  This pull-request has been approved by: *<a href="https://github.com/pingcap/tidb/pull/71691#pullrequestreview-5349908122" title="Approved">bb7133</a>*, *<a href="https://github.com/pingcap/tidb/pull/71691#pullrequestreview-5349969309" title="Approved">wjhuang2016</a>*  The full list of commands accepted by this bot can be found [here](https://prow.tidb.net/command-help?repo=pingcap%2Ftidb).  The pull request process is described [here](https://book.prow.tidb.net/#/workflows/pr)  <details > Needs approval from an approver in each of these files:  - ~~[OWNERS](https://github.com/pingcap/tidb/blob/release-6.5-20260921-v6.5.0/OWNERS)~~ [bb7133,wjhuang2016]  Approvers can indicate their approval by writing `/approve` in a comment Approvers can cancel approval by writing `/approve cancel` in a comment </details> <!-- META={"approvers":[]} -->
  > [LGTM Timeline notifier] --- Timeline:  - `2026-09-29 08:43:25.933134388 +0000 UTC m=+699131.158355495`: :ballot_box_with_check: agreed by [bb7133](https://github.com/bb7133). - `2026-09-29 08:48:29.005410717 +0000 UTC m=+699434.230631825`: :ballot_box_with_check: agreed by [wjhuang2016](https://github.com/wjhuang2016).

- **Issue #71690** (2026-09-29): **deps: replace 'sourcegraph.com/sourcegraph/appdash*' in go.mod**
  *Symptoms*: ### Release note  Please refer to [Release Notes Language Style Guide](https://pingcap.github.io/tidb-dev-guide/contribute-to-tidb/release-notes-style-guide.html) to write a quality release note.  ```release-note None ```   <!-- This is an auto-generated comment: release notes by coderabbit.ai -->  ## Summary by CodeRabbit  * **Chores**   * Updated internal source configuration and verification values. The referenced software versions remain unchanged.   * No user-facing changes are included in this release.  <!-- end of auto-generated comment: release notes by coderabbit.ai -->
  **Post-Mortem & Fix Analysis**:
  > <!-- This is an auto-generated comment: summarize by coderabbit.ai --> <!-- review_stack_entry_start -->  <a href="https://app.coderabbit.ai/change-stack/pingcap/tidb/pull/71690?cs_source=review_comment"><img src="https://storage.googleapis.com/coderabbit_public_assets/review-stack-in-coderabbit-ui-dark.svg?v=2" alt="Review in Change Stack →" width="220" height="32"></a>  Navigate logical layers of code changes, visualize relationships, and explore their blast radius.  <!-- review_stack_entry_end --> <!-- recent_review_start -->  No actionable comments were generated in the recent review. 🎉  <details> <summary>ℹ️ Recent review info</summary>  <details> <summary>⚙️ Run configuration</summary>  **Configuration used**: Repository UI  **Review profile**: CHILL  **Plan**: Advanced  **Run ID**: `9b489e79-decd-49a6-926d-42723bfe456a`  </details>  <details> <summary>📥 Commits</summary>  Reviewing files that changed from the base of the PR and between 846c6960c408767f1b78c2cc37426fe0fc85012d 
  > [APPROVALNOTIFIER] This PR is **APPROVED**  This pull-request has been approved by: *<a href="https://github.com/pingcap/tidb/pull/71690#pullrequestreview-5349905378" title="Approved">bb7133</a>*, *<a href="https://github.com/pingcap/tidb/pull/71690#pullrequestreview-5349968625" title="Approved">wjhuang2016</a>*  The full list of commands accepted by this bot can be found [here](https://prow.tidb.net/command-help?repo=pingcap%2Ftidb).  The pull request process is described [here](https://book.prow.tidb.net/#/workflows/pr)  <details > Needs approval from an approver in each of these files:  - ~~[OWNERS](https://github.com/pingcap/tidb/blob/release-6.5-20260928-v6.5.4/OWNERS)~~ [bb7133,wjhuang2016]  Approvers can indicate their approval by writing `/approve` in a comment Approvers can cancel approval by writing `/approve cancel` in a comment </details> <!-- META={"approvers":[]} -->
  > [LGTM Timeline notifier] --- Timeline:  - `2026-09-29 08:43:06.844881832 +0000 UTC m=+699112.070102939`: :ballot_box_with_check: agreed by [bb7133](https://github.com/bb7133). - `2026-09-29 08:48:18.763054964 +0000 UTC m=+699423.988276081`: :ballot_box_with_check: agreed by [wjhuang2016](https://github.com/wjhuang2016).

- **Issue #71686** (2026-09-29): **executor, statistics: avoid analyze hang on save error (#66169)**
  *Symptoms*: This is an automated cherry-pick of #66169  <!--  Thank you for contributing to TiDB!  PR Title Format: 1. pkg [, pkg2, pkg3]: what's changed 2. *: what's changed  -->  ### What problem does this PR solve? <!--  Please create an issue first to describe the problem.  There MUST be one line starting with "Issue Number:  " and linking the relevant issues via the "close" or "ref".  For more info, check https://pingcap.github.io/tidb-dev-guide/contribute-to-tidb/contribute-code.html#referring-to-an-issue.  -->  Issue Number: close #65915  Problem Summary: ANALYZE on heavily partitioned tables can hang when saving stats fails (for example, lock wait timeout), because save workers exit early and analyze workers block on result channels.  ### What changed and how does it work? - Add a failpoint to simulate save errors and a unit test that asserts ANALYZE returns an error instead of hanging. - Keep analyze save workers draining results after a save failure while reporting the first error.  ### Check List  Tests <!-- At least one of them must be included. -->  - [x] Unit test - [ ] Integration test - [ ] Manual test (add detailed scripts or steps below) - [ ] No need to test   > - [ ] I checked and no code files have been changed.   > <!-- Or your custom  "No need to test" reasons -->  Unit test: - `make failpoint-enable && ( pushd pkg/executor >/dev/null; go test -run TestAnalyzeSaveResultErrorDoesNotHang --tags=intest; rc=$?; popd >/dev/null; make failpoint-disable; exit $rc )`  Side
  **Post-Mortem & Fix Analysis**:
  > @0xPoe This PR has conflicts, I have hold it. Please resolve them or ask others to resolve them, then comment `/unhold` to remove the hold label.
  > @ti-chi-bot: ## If you want to know how to resolve it, please read the guide in [TiDB Dev Guide](https://pingcap.github.io/tidb-dev-guide/contribute-to-tidb/cherrypick-a-pr.html#troubleshoot-cherry-pick).   <details>  Instructions for interacting with me using PR comments are available [here](https://prow.tidb.net/command-help).  If you have questions or suggestions related to my behavior, please file an issue against the [ti-community-infra/tichi](https://github.com/ti-community-infra/tichi/issues/new?title=Prow%20issue:) repository. </details>
  > <!-- This is an auto-generated comment: summarize by coderabbit.ai --> <!-- review_stack_entry_start -->  <a href="https://app.coderabbit.ai/change-stack/pingcap/tidb/pull/71686?cs_source=review_comment"><img src="https://storage.googleapis.com/coderabbit_public_assets/review-stack-in-coderabbit-ui-dark.svg?v=2" alt="Review in Change Stack →" width="220" height="32"></a>  Navigate logical layers of code changes, visualize relationships, and explore their blast radius.  <!-- review_stack_entry_end --> <!-- recent_review_start -->  No actionable comments were generated in the recent review. 🎉  <details> <summary>ℹ️ Recent review info</summary>  <details> <summary>⚙️ Run configuration</summary>  **Configuration used**: Repository UI  **Review profile**: CHILL  **Plan**: Advanced  **Run ID**: `780618f6-2fd1-42a6-a0a6-6afbe6b1ced3`  </details>  <details> <summary>📥 Commits</summary>  Reviewing files that changed from the base of the PR and between 6a8108d067c3110fc07b6ba5edf2291e232582d8 

- **Issue #71685** (2026-09-29): **deps: replace 'sourcegraph.com/sourcegraph/appdash*' in go.mod**
  *Symptoms*: ### Release note  Please refer to [Release Notes Language Style Guide](https://pingcap.github.io/tidb-dev-guide/contribute-to-tidb/release-notes-style-guide.html) to write a quality release note.  ```release-note None ```   <!-- This is an auto-generated comment: release notes by coderabbit.ai --> ## Summary by CodeRabbit  * **Chores**   * Updated internal dependency references to use their corresponding GitHub module paths. The versions remain unchanged, and there are no changes to user-facing features or behavior. <!-- end of auto-generated comment: release notes by coderabbit.ai -->
  **Post-Mortem & Fix Analysis**:
  > <!-- This is an auto-generated comment: summarize by coderabbit.ai --> <!-- review_stack_entry_start -->  <a href="https://app.coderabbit.ai/change-stack/pingcap/tidb/pull/71685?cs_source=review_comment"><img src="https://storage.googleapis.com/coderabbit_public_assets/review-stack-in-coderabbit-ui-dark.svg?v=2" alt="Review in Change Stack →" width="220" height="32"></a>  Navigate logical layers of code changes, visualize relationships, and explore their blast radius.  <!-- review_stack_entry_end --> <!-- recent_review_start -->  No actionable comments were generated in the recent review. 🎉  <details> <summary>ℹ️ Recent review info</summary>  <details> <summary>⚙️ Run configuration</summary>  **Configuration used**: Repository UI  **Review profile**: CHILL  **Plan**: Advanced  **Run ID**: `85d1d60a-db44-4570-9764-1009796bacdb`  </details>  <details> <summary>📥 Commits</summary>  Reviewing files that changed from the base of the PR and between 1a6bebf90da81823b99bc0a9a28701fbf92f80fb 
  > /test build
  > [APPROVALNOTIFIER] This PR is **APPROVED**  This pull-request has been approved by: *<a href="https://github.com/pingcap/tidb/pull/71685#pullrequestreview-5349912184" title="Approved">bb7133</a>*, *<a href="https://github.com/pingcap/tidb/pull/71685#pullrequestreview-5349970370" title="Approved">wjhuang2016</a>*  The full list of commands accepted by this bot can be found [here](https://prow.tidb.net/command-help?repo=pingcap%2Ftidb).  The pull request process is described [here](https://book.prow.tidb.net/#/workflows/pr)  <details > Needs approval from an approver in each of these files:  - ~~[OWNERS](https://github.com/pingcap/tidb/blob/release-6.5-20260928-v6.5.6/OWNERS)~~ [bb7133,wjhuang2016]  Approvers can indicate their approval by writing `/approve` in a comment Approvers can cancel approval by writing `/approve cancel` in a comment </details> <!-- META={"approvers":[]} -->

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

### Incident Patch 1: `12b639a1` (2026-09-29)
**Commit Message**: test: take 128+SIGINT as graceful exit in graceshutdown test (#71651)

ref pingcap/tidb#67765

**File**: `tests/graceshutdown/graceshutdown_test.go` (modified, +9/-0)
```diff
@@ -21,6 +21,7 @@ import (
 	"fmt"
 	"os"
 	"os/exec"
+	"syscall"
 	"testing"
 	"time"
 
@@ -60,6 +61,14 @@ func stopService(name string, cmd *exec.Cmd) (err error) {
 	}
 	log.Info("service Interrupt", zap.String("name", name))
 	if err = cmd.Wait(); err != nil {
+		// Since https://github.com/pingcap/tidb/pull/68096, tidb-server exits with
+		// 128+SIGINT instead of 0 when gracefully shutting down on SIGINT, and
+		// SIGINT is exactly the signal used here to stop the service, so treat
+		// it as a graceful stop.
+		if cmd.ProcessState.ExitCode() == 128+int(syscall.SIGINT) {
+			log.Info("service stopped gracefully", zap.String("name", name))
+			return nil
+		}
 		return errors.Trace(err)
 	}
 	log.Info("service stopped gracefully", zap.String("name", name))
```

---

### Incident Patch 2: `633a9e37` (2026-09-24)
**Commit Message**: metrics, server: fix multi-statement latency attribution (#71584)

close pingcap/tidb#71511

**File**: `pkg/executor/BUILD.bazel` (modified, +1/-0)
```diff
@@ -258,6 +258,7 @@ go_library(
         "//pkg/util/logutil/consistency",
         "//pkg/util/mathutil",
         "//pkg/util/memory",
+        "//pkg/util/metricsutil",
         "//pkg/util/parser",
         "//pkg/util/password-validation",
         "//pkg/util/plancodec",
```

**File**: `pkg/executor/adapter.go` (modified, +14/-0)
```diff
@@ -71,6 +71,7 @@ import (
 	"github.com/pingcap/tidb/pkg/util/hint"
 	"github.com/pingcap/tidb/pkg/util/intest"
 	"github.com/pingcap/tidb/pkg/util/logutil"
+	"github.com/pingcap/tidb/pkg/util/metricsutil"
 	"github.com/pingcap/tidb/pkg/util/plancodec"
 	"github.com/pingcap/tidb/pkg/util/redact"
 	"github.com/pingcap/tidb/pkg/util/replayer"
@@ -1832,6 +1833,19 @@ func (a *ExecStmt) FinishExecuteStmt(txnTS uint64, err error, hasMoreResults boo
 	} else {
 		executor_metrics.SessionExecuteRunDurationGeneral.Observe(executeDuration.Seconds())
 	}
+	// Restricted SQL helpers already record query durations. Their session flag may be
+	// restored before the result set closes, so also check the statement's snapshot.
+	if !sessVars.InRestrictedSQL && !sessVars.StmtCtx.InRestrictedSQL {
+		sqlType := sessVars.StmtCtx.StmtType
+		if sqlType == "" {
+			sqlType = metrics.LblGeneral
+		}
+		// Include parsing before DurationParse is reset, and use one duration for all DB labels.
+		cost := sessVars.GetTotalCostDuration().Seconds()
+		for _, dbName := range metricsutil.GetDBNames(sessVars) {
+			metrics.QueryDurationHistogram.WithLabelValues(sqlType, dbName, sessVars.StmtCtx.ResourceGroupName).Observe(cost)
+		}
+	}
 	// Reset DurationParse due to the next statement may not need to be parsed (not a text protocol query).
 	sessVars.DurationParse = 0
 	// Clean the stale read flag when statement execution finish
```

**File**: `pkg/infoschema/metric_table_def.go` (modified, +1/-1)
```diff
@@ -29,7 +29,7 @@ var MetricTableMap = map[string]MetricTableDef{
 		Comment: "TiDB query processing numbers per second",
 	},
 	"tidb_qps_ideal": {
-		PromQL: `sum(tidb_server_connections) * sum(rate(tidb_server_handle_query_duration_seconds_count[$RANGE_DURATION])) / sum(rate(tidb_server_handle_query_duration_seconds_sum[$RANGE_DURATION]))`,
+		PromQL: `sum(tidb_server_connections) * sum(rate(tidb_server_handle_command_duration_seconds_count[$RANGE_DURATION])) / sum(rate(tidb_server_handle_command_duration_seconds_sum[$RANGE_DURATION]))`,
 	},
 	"tidb_ops_statement": {
 		PromQL:  `sum(rate(tidb_executor_statement_total{$LABEL_CONDITIONS}[$RANGE_DURATION])) by (instance,type)`,
```

**File**: `pkg/metrics/grafana/tidb.json` (modified, +438/-268)
```diff
@@ -282,7 +282,7 @@
               "step": 90
             },
             {
-              "expr": "sum(tidb_server_connections{k8s_cluster=\"$k8s_cluster\", tidb_cluster=\"$tidb_cluster\", instance=~\"$instance\"}) * sum(rate(tidb_server_handle_query_duration_seconds_count{k8s_cluster=\"$k8s_cluster\", tidb_cluster=\"$tidb_cluster\", instance=~\"$instance\"}[1m])) / sum(rate(tidb_server_handle_query_duration_seconds_sum{k8s_cluster=\"$k8s_cluster\", tidb_cluster=\"$tidb_cluster\", instance=~\"$instance\"}[1m]))",
+              "expr": "sum(tidb_server_connections{k8s_cluster=\"$k8s_cluster\", tidb_cluster=\"$tidb_cluster\", instance=~\"$instance\"}) * sum(rate(tidb_server_handle_command_duration_seconds_count{k8s_cluster=\"$k8s_cluster\", tidb_cluster=\"$tidb_cluster\", instance=~\"$instance\"}[1m])) / sum(rate(tidb_server_handle_command_duration_seconds_sum{k8s_cluster=\"$k8s_cluster\", tidb_cluster=\"$tidb_cluster\", instance=~\"$instance\"}[1m]))",
               "format": "time_series",
               "hide": true,
               "instant": false,
@@ -2132,14 +2132,184 @@
       "title": "Query Detail",
       "type": "row"
     },
+    {
+      "collapsed": true,
+      "datasource": null,
+      "gridPos": {"h": 1, "w": 24, "x": 0, "y": 2},
+      "id": 23763575000,
+      "panels": [
+        {
+          "datasource": "${DS_TEST-CLUSTER}",
+          "description": "Average duration of MySQL commands by SQL type, preserving request-level timing; a command can contain multiple SQL statements. Older TiDB versions show no data; mixed-version clusters include only reporting instances (partial coverage).",
+          "fill": 0,
+          "gridPos": {"h": 7, "w": 24, "x": 0, "y": 3},
+          "id": 23763575003,
+          "legend": {"show": true, "hideEmpty": false, "hideZero": false},
+          "lines": true,
+          "linewidth": 1,
+          "nullPointMode": "null",
+          "pluginVersion": "7.5.11",
+          "points": false,
+          "renderer": "flot",
+          "stack": false,
+          "targets": [
+            {
+              "expr": "sum(rate(tidb_server_handle_command_duration_seconds_sum{k8s_cluster=\"$k8s_cluster\", tidb_cluster=\"$tidb_cluster\", instance=~\"$instance\"}[1m])) by (sql_type) / sum(rate(tidb_server_handle_command_duration_seconds_count{k8s_cluster=\"$k8s_cluster\", tidb_cluster=\"$tidb_cluster\", instance=~\"$instance\"}[1m])) by (sql_type)",
+              "format": "time_series",
+              "intervalFactor": 2,
+              "legendFormat": "{{sql_type}}",
+              "refId": "A"
+            }
+          ],
+          "title": "Average Command Duration By Type",
+          "tooltip": {"shared": true, "sort": 0, "value_type": "individual"},
+          "type": "graph",
+          "xaxis": {"mode": "time", "show": true, "values": []},
+          "yaxes": [
+            {"format": "s", "label": null, "logBase": 1, "min": 0, "max": null, "show": true},
+            {"format": "short", "label": null, "logBase": 1, "min": null, "max": null, "show": false}
+          ]
+        },
+        {
+          "datasource": "${DS_TEST-CLUSTER}",
+          "description": "P999 duration of MySQL commands by SQL type, preserving request-level timing; a command can contain multiple SQL statements. Older TiDB versions show no data; mixed-version clusters include only reporting instances (partial coverage).",
+          "fill": 0,
+          "gridPos": {"h": 7, "w": 12, "x": 0, "y": 10},
+          "id": 23763575005,
+          "legend": {"show": true, "hideEmpty": false, "hideZero": false},
+          "lines": true,
+          "linewidth": 1,
+          "nullPointMode": "null",
+          "pluginVersion": "7.5.11",
+          "points": false,
+          "renderer": "flot",
+          "stack": false,
+          "targets": [
+            {
+              "expr": "histogram_quantile(0.999, sum(rate(tidb_server_handle_command_duration_seconds_bucket{k8s_cluster=\"$k8s_cluster\", tidb_clust
```

**File**: `pkg/metrics/grafana/tidb_summary.json` (modified, +1/-1)
```diff
@@ -667,7 +667,7 @@
                      "refId": "B"
                   },
                   {
-                     "expr": "sum(tidb_server_connections{k8s_cluster=\"$k8s_cluster\", tidb_cluster=\"$tidb_cluster\", instance=~\"$instance\"}) * sum(rate(tidb_server_handle_query_duration_seconds_count{k8s_cluster=\"$k8s_cluster\", tidb_cluster=\"$tidb_cluster\", instance=~\"$instance\"}[1m])) / sum(rate(tidb_server_handle_query_duration_seconds_sum{k8s_cluster=\"$k8s_cluster\", tidb_cluster=\"$tidb_cluster\", instance=~\"$instance\"}[1m]))",
+                     "expr": "sum(tidb_server_connections{k8s_cluster=\"$k8s_cluster\", tidb_cluster=\"$tidb_cluster\", instance=~\"$instance\"}) * sum(rate(tidb_server_handle_command_duration_seconds_count{k8s_cluster=\"$k8s_cluster\", tidb_cluster=\"$tidb_cluster\", instance=~\"$instance\"}[1m])) / sum(rate(tidb_server_handle_command_duration_seconds_sum{k8s_cluster=\"$k8s_cluster\", tidb_cluster=\"$tidb_cluster\", instance=~\"$instance\"}[1m]))",
                      "format": "time_series",
                      "hide": true,
                      "intervalFactor": 2,
```

---

### Incident Patch 3: `8a37ef2b` (2026-09-22)
**Commit Message**: memory: reduce overhead of global memory arbitration (#71346)

ref pingcap/tidb#58194, close pingcap/tidb#71141

**File**: `pkg/executor/join/row_table_builder.go` (modified, +12/-1)
```diff
@@ -26,6 +26,7 @@ import (
 	"github.com/pingcap/tidb/pkg/types"
 	"github.com/pingcap/tidb/pkg/util/chunk"
 	"github.com/pingcap/tidb/pkg/util/codec"
+	"github.com/pingcap/tidb/pkg/util/memory"
 	"github.com/pingcap/tidb/pkg/util/serialization"
 )
 
@@ -517,7 +518,17 @@ func (b *rowTableBuilder) preAllocForSegments(segs []*rowTableSegment, chk *chun
 		totalMemUsage += b.helpers[i].rawDataLen + (b.helpers[i].totalRowNum+b.helpers[i].totalRowNum)*serialization.Uint64Len + b.helpers[i].validRowNum*serialization.IntLen
 	}
 
-	hashJoinCtx.hashTableContext.memoryTracker.Consume(totalMemUsage)
+	tracer := hashJoinCtx.hashTableContext.memoryTracker
+	if memory.UsingGlobalMemArbitration() {
+		// The tracker is charged before the backing slices are materialized
+		// below. Temporarily offset the global arbitrator's accounting during
+		// this allocation window so it is not classified as out of control
+		// before the physical allocation is fully materialized.
+		reversal := tracer.AddReversal(totalMemUsage)
+		defer reversal.Release()
+	}
+
+	tracer.Consume(totalMemUsage)
 
 	for partIdx, seg := range segs {
 		seg.rawData = make([]byte, 0, b.helpers[partIdx].rawDataLen)
```

**File**: `pkg/session/BUILD.bazel` (modified, +0/-1)
```diff
@@ -206,7 +206,6 @@ go_test(
         "//pkg/session/metrics",
         "//pkg/session/sessionapi",
         "//pkg/sessionctx",
-        "//pkg/sessionctx/stmtctx",
         "//pkg/sessionctx/vardef",
         "//pkg/sessionctx/variable",
         "//pkg/sessiontxn",
```

**File**: `pkg/session/session.go` (modified, +28/-40)
```diff
@@ -1714,15 +1714,29 @@ func (s *session) ParseSQL(ctx context.Context, sql string, params ...parser.Par
 		uid := s.sessionVars.ConnectionID
 
 		if globalMemArbitrator.AtMemRisk() {
-			if s.sessionPlanCache != nil {
+			// ParseSQL is the first memory-sensitive stage of statement execution:
+			// the parser and AST have not been created yet. During a transient
+			// memory-risk period, wait for the arbitrator to reclaim memory instead
+			// of admitting more parser work. Returning an error immediately could
+			// cause clients to retry concurrently and amplify the memory pressure.
+			if s.sessionPlanCache != nil && s.sessionPlanCache.Size() > 0 {
 				s.sessionPlanCache.DeleteAll()
 			}
+			// Once OOM risk is reached, do not wait indefinitely. The bounded
+			// grace period gives ongoing reclamation a chance to finish while
+			// ensuring that new parse requests are eventually rejected.
+			timeout := time.Now().Add(time.Second * 30)
+			dur := defOOMRiskCheckDur
 			for globalMemArbitrator.AtMemRisk() {
-				if globalMemArbitrator.AtOOMRisk() {
+				if globalMemArbitrator.AtOOMRisk() && time.Now().After(timeout) {
 					metrics.GlobalMemArbitratorSubTasks.ForceKillParse.Inc()
 					return nil, nil, exeerrors.ErrQueryExecStopped.GenWithStackByArgs(memory.ArbitratorOOMRiskKill.String()+defSuffixParseSQL, uid)
 				}
-				time.Sleep(defOOMRiskCheckDur)
+				if e := ctx.Err(); e != nil {
+					return nil, nil, e
+				}
+				time.Sleep(dur)
+				dur = min(dur*2, time.Second)
 			}
 		}
 
@@ -2573,26 +2587,28 @@ func (s *session) executeStmtImpl(ctx context.Context, stmtNode ast.StmtNode) (r
 
 	if execUseArbitrator {
 		if globalMemArbitrator.AtMemRisk() {
-			if s.sessionPlanCache != nil {
+			if s.sessionPlanCache != nil && s.sessionPlanCache.Size() > 0 {
 				s.sessionPlanCache.DeleteAll()
 			}
+			dur := defOOMRiskCheckDur
 			for globalMemArbitrator.AtMemRisk() {
 				if globalMemArbitrator.AtOOMRisk() {
 					metrics.GlobalMemArbitratorSubTasks.ForceKillPlan.Inc()
 					return nil, exeerrors.ErrQueryExecStopped.GenWithStackByArgs(memory.ArbitratorOOMRiskKill.String()+defSuffixCompilePlan, sessVars.ConnectionID)
 				}
-				time.Sleep(defOOMRiskCheckDur)
+				if e := ctx.Err(); e != nil {
+					return nil, e
+				}
+				time.Sleep(dur)
+				dur = min(dur*2, time.Second)
 			}
 		}
 
 		ok := globalMemArbitrator.ConsumeQuotaFromAwaitFreePool(sessVars.ConnectionID, compilePlanMemQuota)
 		quotaReserved += compilePlanMemQuota
 		defer releaseCommonQuota()
-
-		if !ok { // for SQL which needs to be controlled by mem-arbitrator
-			if s.sessionPlanCache != nil && s.sessionPlanCache.Size() > 0 {
-				s.sessionPlanCache.DeleteAll()
-			}
+		if !ok && s.sessionPlanCache != nil && s.sessionPlanCache.Size() > 0 {
+			s.sessionPlanCache.DeleteAll()
 		}
 	}
 
@@ -2682,7 +2698,6 @@ func (s *session) executeStmtImpl(ctx context.Context, stmtNode ast.StmtNode) (r
 
 		digestID := buildMemArbitratorDigestID(
 			normalizedSQL,
-			sessVars.StmtCtx.Tables,
 			sessVars.CurrentDB,
 		)
 
@@ -2787,43 +2802,16 @@ func (s *session) executeStmtImpl(ctx context.Context, stmtNode ast.StmtNode) (r
 
 func buildMemArbitratorDigestID(
 	normalizedSQL string,
-	tables []stmtctx.TableEntry,
 	currentDB string,
 ) uint64 {
 	if normalizedSQL == "" {
 		return memory.InvalidDigestID
 	}
 
 	builder := memory.NewDigestIDBuilder()
-	builder.AddString("v1")
+	builder.AddString("db")
+	builder.AddString(strings.ToLower(currentDB))
 	builder.AddString(normalizedSQL)
-
-	// The planner already deduplicates StmtCtx.Tables. Keep its order here to
-	// avoid allocating and sorting a copy; an order change only causes a harmless
-	// profile cache miss.
-	hasResolvedTable := false
-	for _, tbl := range tables {
-		db := strings.ToLower(tbl.DB)
-		table := strings.ToLower(tbl.Table)
-		if db == "" && table == "" {
-			continue
-		}
-
-		if !hasResolvedTable {
-			builder.AddString("resolved-tables")
-			hasResolvedTable = true
-		}
-		builder.AddString(d
```

**File**: `pkg/session/session_test.go` (modified, +10/-12)
```diff
@@ -37,7 +37,6 @@ import (
 	"github.com/pingcap/tidb/pkg/meta/metadef"
 	"github.com/pingcap/tidb/pkg/parser/mysql"
 	"github.com/pingcap/tidb/pkg/parser/terror"
-	"github.com/pingcap/tidb/pkg/sessionctx/stmtctx"
 	"github.com/pingcap/tidb/pkg/sessionctx/variable"
 	kvstore "github.com/pingcap/tidb/pkg/store"
 	"github.com/pingcap/tidb/pkg/store/mockstore"
@@ -349,21 +348,20 @@ func TestMemArbitratorSession(t *testing.T) {
 	require.Equal(t, int64(3), approxCompilePlanTokenCnt("select @@version @a", false))
 
 	normalizedSQL := "select * from `t` where `a` = ?"
-	db1DigestID := buildMemArbitratorDigestID(normalizedSQL, []stmtctx.TableEntry{{DB: "db1", Table: "t"}}, "db1")
-	db2DigestID := buildMemArbitratorDigestID(normalizedSQL, []stmtctx.TableEntry{{DB: "db2", Table: "t"}}, "db2")
+	db1DigestID := buildMemArbitratorDigestID(normalizedSQL, "db1")
+	db2DigestID := buildMemArbitratorDigestID(normalizedSQL, "db2")
 	require.NotEqual(t, db1DigestID, db2DigestID)
 
 	explicitDBSQL := "select * from `db3`.`t` where `a` = ?"
-	db3Table := []stmtctx.TableEntry{{DB: "db3", Table: "t"}}
-	require.Equal(t,
-		buildMemArbitratorDigestID(explicitDBSQL, db3Table, "db1"),
-		buildMemArbitratorDigestID(explicitDBSQL, db3Table, "db2"))
+	require.NotEqual(t,
+		buildMemArbitratorDigestID(explicitDBSQL, "db1"),
+		buildMemArbitratorDigestID(explicitDBSQL, "db2"))
 	require.Equal(t,
-		buildMemArbitratorDigestID(explicitDBSQL, db3Table, "db1"),
-		buildMemArbitratorDigestID(explicitDBSQL, []stmtctx.TableEntry{{DB: "DB3", Table: "T"}}, "db1"))
+		buildMemArbitratorDigestID(explicitDBSQL, "DB1"),
+		buildMemArbitratorDigestID(explicitDBSQL, "db1"))
 
 	require.NotEqual(t,
-		buildMemArbitratorDigestID(normalizedSQL, nil, "db1"),
-		buildMemArbitratorDigestID(normalizedSQL, nil, "db2"))
-	require.Equal(t, memory.InvalidDigestID, buildMemArbitratorDigestID("", db3Table, "db1"))
+		buildMemArbitratorDigestID(normalizedSQL, "db1"),
+		buildMemArbitratorDigestID(normalizedSQL, "db2"))
+	require.Equal(t, memory.InvalidDigestID, buildMemArbitratorDigestID("", "db1"))
 }
```

**File**: `pkg/util/memory/BUILD.bazel` (modified, +2/-1)
```diff
@@ -6,6 +6,7 @@ go_library(
         "action.go",
         "arbitrator.go",
         "global_arbitrator.go",
+        "heap_profile.go",
         "meminfo.go",
         "memstats.go",
         "pool.go",
@@ -39,6 +40,7 @@ go_test(
     srcs = [
         "arbitrator_test.go",
         "bench_test.go",
+        "heap_profile_test.go",
         "main_test.go",
         "pool_test.go",
         "tracker_test.go",
@@ -52,6 +54,5 @@ go_test(
         "//pkg/util/sqlkiller",
         "@com_github_stretchr_testify//require",
         "@org_uber_go_goleak//:goleak",
-        "@org_uber_go_zap//:zap",
     ],
 )
```

---

### Incident Patch 4: `a989206f` (2026-09-22)
**Commit Message**: executor, ddl: fix unparseable region split policy in SHOW CREATE TABLE (#71470)

close pingcap/tidb#71467, close pingcap/tidb#71468

**File**: `pkg/ddl/table_split_test.go` (modified, +147/-24)
```diff
@@ -395,31 +395,154 @@ func TestTableSplitPolicyMultipleIndexes(t *testing.T) {
 
 func TestTableSplitPolicyShowCreateRoundTrip(t *testing.T) {
 	store := testkit.CreateMockStore(t)
-	tk := testkit.NewTestKit(t, store)
-	tk.MustExec("use test")
-	tk.MustExec("drop table if exists t_src, t_dst")
-	tk.MustExec(`create table t_src (
-		id bigint primary key,
-		user_id bigint,
-		index idx_user_id (user_id)
-	)
-	split between (0) and (1000000) regions 4
-	split index idx_user_id between (1000) and (100000) regions 3`)
-
-	createSQL := tk.MustQuery("show create table t_src").Rows()[0][1].(string)
-	require.Contains(t, createSQL, "/*T![region_split]")
-
-	roundTripSQL := strings.Replace(createSQL, "CREATE TABLE `t_src`", "CREATE TABLE `t_dst`", 1)
-	tk.MustExec(roundTripSQL)
 
-	tbl := external.GetTableByName(t, tk, "test", "t_dst")
-	require.NotNil(t, tbl.Meta().TableSplitPolicy)
-	require.Equal(t, int64(4), tbl.Meta().TableSplitPolicy.Regions)
-
-	idxInfo := tbl.Meta().FindIndexByName("idx_user_id")
-	require.NotNil(t, idxInfo)
-	require.NotNil(t, idxInfo.RegionSplitPolicy)
-	require.Equal(t, int64(3), idxInfo.RegionSplitPolicy.Regions)
+	t.Run("table-level-policy", func(t *testing.T) {
+		tk := testkit.NewTestKit(t, store)
+		tk.MustExec("use test")
+		tk.MustExec("drop table if exists t_src, t_dst")
+		tk.MustExec(`create table t_src (
+			id bigint primary key,
+			user_id bigint,
+			index idx_user_id (user_id)
+		)
+		split between (0) and (1000000) regions 4
+		split index idx_user_id between (1000) and (100000) regions 3`)
+
+		createSQL := tk.MustQuery("show create table t_src").Rows()[0][1].(string)
+		require.Contains(t, createSQL, "/*T![region_split]")
+
+		roundTripSQL := strings.Replace(createSQL, "CREATE TABLE `t_src`", "CREATE TABLE `t_dst`", 1)
+		tk.MustExec(roundTripSQL)
+
+		tbl := external.GetTableByName(t, tk, "test", "t_dst")
+		require.NotNil(t, tbl.Meta().TableSplitPolicy)
+		require.Equal(t, int64(4), tbl.Meta().TableSplitPolicy.Regions)
+
+		idxInfo := tbl.Meta().FindIndexByName("idx_user_id")
+		require.NotNil(t, idxInfo)
+		require.NotNil(t, idxInfo.RegionSplitPolicy)
+		require.Equal(t, int64(3), idxInfo.RegionSplitPolicy.Regions)
+	})
+
+	// The primary key branch of the grammar does not take an index name, so the
+	// non-clustered primary key policy must be emitted as `SPLIT PRIMARY KEY
+	// BETWEEN`, otherwise the output is not parseable
+	// (https://github.com/pingcap/tidb/issues/71467).
+	t.Run("primary-key-policy", func(t *testing.T) {
+		tk := testkit.NewTestKit(t, store)
+		tk.MustExec("use test")
+		tk.MustExec("drop table if exists t_pk_src, t_pk_dst")
+		tk.MustExec(`create table t_pk_src (
+			id bigint not null,
+			user_id bigint,
+			primary key (id) nonclustered,
+			index idx_user_id (user_id)
+		)`)
+		tk.MustExec("alter table t_pk_src split primary key between (0) and (1000000) regions 4")
+		tk.MustExec("alter table t_pk_src split index idx_user_id between (1000) and (100000) regions 3")
+
+		createSQL := tk.MustQuery("show create table t_pk_src").Rows()[0][1].(string)
+		require.Contains(t, createSQL, "/*T![region_split]")
+		require.Contains(t, createSQL, "SPLIT PRIMARY KEY BETWEEN (0) AND (1000000) REGIONS 4")
+		require.NotContains(t, createSQL, "SPLIT PRIMARY KEY `PRIMARY`")
+
+		roundTripSQL := strings.Replace(createSQL, "CREATE TABLE `t_pk_src`", "CREATE TABLE `t_pk_dst`", 1)
+		tk.MustExec(roundTripSQL)
+
+		tbl := external.GetTableByName(t, tk, "test", "t_pk_dst")
+		require.Nil(t, tbl.Meta().TableSplitPolicy)
+
+		pkInfo := tbl.Meta().FindIndexByName("primary")
+		require.NotNil(t, pkInfo)
+		require.NotNil(t, pkInfo.RegionSplitPolicy)
+		require.Equal(t, int64(4), pkInfo.RegionSplitPolicy.Regions)
+
+		idxInfo := tbl.Meta().FindIndexByName("idx_user_id")
+		require.NotNil(t, idxInfo)
+		require.NotNil(t, idxInfo.RegionSplitPolicy)
+		require.Equal(t, int64(3), idxInfo.RegionSplitPolicy.Regions)
+	})
+
+	// A clustered primary key is the row handle itself, so there is 
```

**File**: `pkg/executor/show.go` (modified, +79/-65)
```diff
@@ -1471,6 +1471,80 @@ func constructResultOfShowCreateTable(ctx sessionctx.Context, dbName *ast.CIStr,
 		fmt.Fprintf(buf, " /* CACHED ON */")
 	}
 
+	if tableInfo.TTLInfo != nil {
+		restoreFlags := parserformat.RestoreStringSingleQuotes | parserformat.RestoreNameBackQuotes | parserformat.RestoreTiDBSpecialComment
+		restoreCtx := parserformat.NewRestoreCtx(restoreFlags, buf)
+
+		restoreCtx.WritePlain(" ")
+		err = restoreCtx.WriteWithSpecialComments(tidb.FeatureIDTTL, func() error {
+			columnName := ast.ColumnName{Name: tableInfo.TTLInfo.ColumnName}
+			timeUnit := ast.TimeUnitExpr{Unit: ast.TimeUnitType(tableInfo.TTLInfo.IntervalTimeUnit)}
+			restoreCtx.WriteKeyWord("TTL")
+			restoreCtx.WritePlain("=")
+			restoreCtx.WriteName(columnName.String())
+			restoreCtx.WritePlainf(" + INTERVAL %s ", tableInfo.TTLInfo.IntervalExprStr)
+			return timeUnit.Restore(restoreCtx)
+		})
+
+		if err != nil {
+			return err
+		}
+
+		restoreCtx.WritePlain(" ")
+		err = restoreCtx.WriteWithSpecialComments(tidb.FeatureIDTTL, func() error {
+			restoreCtx.WriteKeyWord("TTL_ENABLE")
+			restoreCtx.WritePlain("=")
+			if tableInfo.TTLInfo.Enable {
+				restoreCtx.WriteString("ON")
+			} else {
+				restoreCtx.WriteString("OFF")
+			}
+			return nil
+		})
+
+		if err != nil {
+			return err
+		}
+
+		restoreCtx.WritePlain(" ")
+		err = restoreCtx.WriteWithSpecialComments(tidb.FeatureIDTTL, func() error {
+			restoreCtx.WriteKeyWord("TTL_JOB_INTERVAL")
+			restoreCtx.WritePlain("=")
+			if len(tableInfo.TTLInfo.JobInterval) == 0 {
+				// This only happens when the table is created from 6.5 in which the `tidb_job_interval` is not introduced yet.
+				// We use `OldDefaultTTLJobInterval` as the return value to ensure a consistent behavior for the
+				// upgrades: v6.5 -> v8.5(or previous version) -> newer version than v8.5.
+				restoreCtx.WriteString(model.OldDefaultTTLJobInterval)
+			} else {
+				restoreCtx.WriteString(tableInfo.TTLInfo.JobInterval)
+			}
+			return nil
+		})
+
+		if err != nil {
+			return err
+		}
+	}
+
+	if tableInfo.Affinity != nil {
+		fmt.Fprintf(buf, " /*T![%s] AFFINITY='%s' */", tidb.FeatureIDAffinity, tableInfo.Affinity.Level)
+	}
+
+	// add partition info here.
+	ddl.AppendPartitionInfo(tableInfo.Partition, buf, sqlMode)
+
+	// Region split policies follow the partition clause in the CREATE TABLE
+	// grammar: `CreateTableStmt: ... PartitionOpt SplitIndexListOpt ...`.
+	// Emitting them before `PARTITION BY` produces DDL that cannot be parsed
+	// again, so they are appended after the partition info
+	// (https://github.com/pingcap/tidb/issues/71468).
+	return appendRegionSplitPolicies(buf, tableInfo, sqlMode)
+}
+
+// appendRegionSplitPolicies writes the table-level and index-level region split
+// policies of a table using the `SPLIT ...` clause form accepted by the CREATE
+// TABLE grammar.
+func appendRegionSplitPolicies(buf *bytes.Buffer, tableInfo *model.TableInfo, sqlMode mysql.SQLMode) error {
 	var parse *parser.Parser
 	// Show table region split policy
 	if tableInfo.TableSplitPolicy != nil {
@@ -1515,13 +1589,14 @@ func constructResultOfShowCreateTable(ctx sessionctx.Context, dbName *ast.CIStr,
 		policy := indexInfo.RegionSplitPolicy
 		buf.WriteString("\n/*T![region_split] ")
 
-		fmt.Fprintf(buf, "SPLIT ")
+		// Note: the primary key branch of the region split policy grammar does not
+		// accept an index name, so only non-PRIMARY indexes are emitted as
+		// `SPLIT INDEX <name>`.
 		if indexInfo.Name.O == mysql.PrimaryKeyName {
-			fmt.Fprintf(buf, "PRIMARY KEY ")
+			buf.WriteString("SPLIT PRIMARY KEY BETWEEN (")
 		} else {
-			fmt.Fprintf(buf, "INDEX ")
+			fmt.Fprintf(buf, "SPLIT INDEX %s BETWEEN (", stringutil.Escape(indexInfo.Name.O, sqlMode))
 		}
-		fmt.Fprintf(buf, "%s BETWEEN (", stringutil.Escape(indexInfo.Name.O, sqlMode))
 
 		for i, val := range policy.Lower {
 			if i > 0 {
@@ -1546,67 +1621,6 @@ func constructResultOfShowCreateTable(ctx sessionctx.Context, dbName *ast.CIStr,
 		bu
```

**File**: `tests/integrationtest/r/executor/split_table.result` (modified, +9/-9)
```diff
@@ -132,7 +132,7 @@ t	CREATE TABLE `t` (
   KEY `idx_user_id` (`user_id`),
   PRIMARY KEY (`id`) /*T![clustered_index] NONCLUSTERED */
 ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_bin
-/*T![region_split] SPLIT PRIMARY KEY `PRIMARY` BETWEEN (0) AND (1000000) REGIONS 4 */
+/*T![region_split] SPLIT PRIMARY KEY BETWEEN (0) AND (1000000) REGIONS 4 */
 alter table t split index idx_user_id between (1000) and (100000) regions 3;
 show create table t;
 Table	Create Table
@@ -144,7 +144,7 @@ t	CREATE TABLE `t` (
   PRIMARY KEY (`id`) /*T![clustered_index] NONCLUSTERED */
 ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_bin
 /*T![region_split] SPLIT INDEX `idx_user_id` BETWEEN (1000) AND (100000) REGIONS 3 */
-/*T![region_split] SPLIT PRIMARY KEY `PRIMARY` BETWEEN (0) AND (1000000) REGIONS 4 */
+/*T![region_split] SPLIT PRIMARY KEY BETWEEN (0) AND (1000000) REGIONS 4 */
 drop table if exists t;
 create table t (
 id bigint primary key nonclustered,
@@ -168,7 +168,7 @@ t	CREATE TABLE `t` (
   PRIMARY KEY (`id`) /*T![clustered_index] NONCLUSTERED */
 ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_bin
 /*T![region_split] SPLIT INDEX `idx_user_id` BETWEEN (-1000) AND (100000) REGIONS 3 */
-/*T![region_split] SPLIT PRIMARY KEY `PRIMARY` BETWEEN (-10000) AND (1000000) REGIONS 4 */
+/*T![region_split] SPLIT PRIMARY KEY BETWEEN (-10000) AND (1000000) REGIONS 4 */
 set tidb_enable_clustered_index=ON;
 drop table if exists t;
 create table t (
@@ -295,13 +295,13 @@ t	CREATE TABLE `t` (
   KEY `idx_status` (`status`),
   PRIMARY KEY (`id`) /*T![clustered_index] NONCLUSTERED */
 ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_bin
-/*T![region_split] SPLIT INDEX `idx_user_id` BETWEEN (1000) AND (100000) REGIONS 3 */
-/*T![region_split] SPLIT INDEX `idx_status` BETWEEN ('a') AND ('z') REGIONS 2 */
-/*T![region_split] SPLIT PRIMARY KEY `PRIMARY` BETWEEN (0) AND (1000000) REGIONS 4 */
 PARTITION BY RANGE (`id`)
 (PARTITION `p0` VALUES LESS THAN (100000),
  PARTITION `p1` VALUES LESS THAN (200000),
  PARTITION `pmax` VALUES LESS THAN (MAXVALUE))
+/*T![region_split] SPLIT INDEX `idx_user_id` BETWEEN (1000) AND (100000) REGIONS 3 */
+/*T![region_split] SPLIT INDEX `idx_status` BETWEEN ('a') AND ('z') REGIONS 2 */
+/*T![region_split] SPLIT PRIMARY KEY BETWEEN (0) AND (1000000) REGIONS 4 */
 drop table if exists t;
 create table t (
 id bigint primary key,
@@ -320,10 +320,10 @@ t	CREATE TABLE `t` (
   KEY `idx_val` (`val`),
   PRIMARY KEY (`id`) /*T![clustered_index] NONCLUSTERED */
 ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_bin
-/*T![region_split] SPLIT PRIMARY KEY `PRIMARY` BETWEEN (0) AND (10000) REGIONS 5 */
 PARTITION BY RANGE (`id`)
 (PARTITION `p0` VALUES LESS THAN (1000),
  PARTITION `p1` VALUES LESS THAN (2000))
+/*T![region_split] SPLIT PRIMARY KEY BETWEEN (0) AND (10000) REGIONS 5 */
 alter table t split index idx_val between (0) and (10000) regions 5;
 show create table t;
 Table	Create Table
@@ -333,11 +333,11 @@ t	CREATE TABLE `t` (
   KEY `idx_val` (`val`),
   PRIMARY KEY (`id`) /*T![clustered_index] NONCLUSTERED */
 ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_bin
-/*T![region_split] SPLIT INDEX `idx_val` BETWEEN (0) AND (10000) REGIONS 5 */
-/*T![region_split] SPLIT PRIMARY KEY `PRIMARY` BETWEEN (0) AND (10000) REGIONS 5 */
 PARTITION BY RANGE (`id`)
 (PARTITION `p0` VALUES LESS THAN (1000),
  PARTITION `p1` VALUES LESS THAN (2000))
+/*T![region_split] SPLIT INDEX `idx_val` BETWEEN (0) AND (10000) REGIONS 5 */
+/*T![region_split] SPLIT PRIMARY KEY BETWEEN (0) AND (10000) REGIONS 5 */
 drop table if exists t;
 create table t (
 id bigint primary key,
```

---

### Incident Patch 5: `56ee5bb2` (2026-09-21)
**Commit Message**: ddl, dxf: fix transition completion and scheduler cleanup (#71176)

ref pingcap/tidb#69625

**File**: `pkg/ddl/BUILD.bazel` (modified, +1/-0)
```diff
@@ -323,6 +323,7 @@ go_test(
         "stat_test.go",
         "storage_class_partition_test.go",
         "storage_class_test.go",
+        "storage_class_transition_poll_test.go",
         "storage_class_transition_test.go",
         "table_mode_test.go",
         "table_modify_test.go",
```

**File**: `pkg/ddl/storage_class_transition.go` (modified, +7/-3)
```diff
@@ -957,8 +957,13 @@ func (m *storageClassTransitionManager) poll(
 			delete(active, key)
 			continue
 		}
-		eligible[key] = operation
-		if storageClassTransitionTargetsExist(tbl.Meta(), operation) || !storageClassTransitionTopologyIsStable(tbl.Meta()) {
+		if storageClassTransitionTargetsExist(tbl.Meta(), operation) {
+			eligible[key] = operation
+			continue
+		}
+		// Obsolete physical ranges cannot prove completion, even while the
+		// partition topology is changing or reconciliation needs to retry.
+		if !storageClassTransitionTopologyIsStable(tbl.Meta()) {
 			continue
 		}
 		if err := reconcileStorageClassTransitionTopology(ctx, se, tbl.Meta(), operation, latestSchemaVersion); err != nil {
@@ -967,7 +972,6 @@ func (m *storageClassTransitionManager) poll(
 			continue
 		}
 		delete(active, key)
-		delete(eligible, key)
 	}
 	m.setActive(active)
 	if len(eligible) == 0 {
```

**File**: `pkg/ddl/storage_class_transition_poll_test.go` (added, +147/-0)
```diff
@@ -0,0 +1,147 @@
+// Copyright 2026 PingCAP, Inc.
+//
+// Licensed under the Apache License, Version 2.0 (the "License");
+// you may not use this file except in compliance with the License.
+// You may obtain a copy of the License at
+//
+//     http://www.apache.org/licenses/LICENSE-2.0
+//
+// Unless required by applicable law or agreed to in writing, software
+// distributed under the License is distributed on an "AS IS" BASIS,
+// WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
+// See the License for the specific language governing permissions and
+// limitations under the License.
+
+package ddl_test
+
+import (
+	"context"
+	"net/http"
+	"net/http/httptest"
+	"strings"
+	"sync/atomic"
+	"testing"
+
+	"github.com/pingcap/tidb/pkg/ddl"
+	ddlsess "github.com/pingcap/tidb/pkg/ddl/session"
+	"github.com/pingcap/tidb/pkg/domain/infosync"
+	"github.com/pingcap/tidb/pkg/infoschema"
+	"github.com/pingcap/tidb/pkg/meta/metadef"
+	"github.com/pingcap/tidb/pkg/meta/model"
+	"github.com/pingcap/tidb/pkg/parser/ast"
+	"github.com/pingcap/tidb/pkg/testkit"
+	"github.com/pingcap/tidb/pkg/testkit/testfailpoint"
+	"github.com/stretchr/testify/require"
+	pdhttp "github.com/tikv/pd/client/http"
+)
+
+func TestStorageClassTransitionPollWaitsForTopology(t *testing.T) {
+	for _, reconciliationFails := range []bool{false, true} {
+		name := "partition reorganization"
+		if reconciliationFails {
+			name = "reconciliation failure"
+		}
+		t.Run(name, func(t *testing.T) {
+			store, dom := testkit.CreateMockStoreAndDomain(t)
+			tk := testkit.NewTestKit(t, store)
+			tk.MustExec(metadef.CreateTiDBStorageClassTransitionHistoryTable)
+			// Poll explicitly against controlled schema snapshots. The domain's
+			// background owner must not reconcile the synthetic table as orphaned.
+			require.NoError(t, dom.DDL().Stop())
+			tk.MustExec(`INSERT INTO mysql.tidb_storage_class_transition_history
+				(table_schema, table_name, table_id, partition_name, partition_id,
+				 direction, state, schema_version, start_ts, start_time, physical_targets)
+				VALUES ('test', 't', 500, 'p0', 501, 'TO_IA', 'RUNNING', 1, 100,
+				 '2020-01-01 00:00:00',
+				 '[{"physical_id":501,"partition_id":501,"partition_name":"p0"}]')`)
+
+			oldPartition := model.PartitionDefinition{
+				ID: 501, Name: ast.NewCIStr("p0"), StorageClassTier: model.StorageClassTierIA,
+			}
+			newPartition := model.PartitionDefinition{
+				ID: 502, Name: ast.NewCIStr("p1"), StorageClassTier: model.StorageClassTierIA,
+			}
+			tblInfo := &model.TableInfo{
+				ID: 500, Name: ast.NewCIStr("t"),
+				Partition: &model.PartitionInfo{
+					Definitions: []model.PartitionDefinition{newPartition},
+				},
+			}
+			if !reconciliationFails {
+				// REORGANIZE has switched the public definitions, but retains the
+				// old physical range for double writes until the final DDL steps.
+				tblInfo.Partition.DDLState = model.StateDeleteReorganization
+				tblInfo.Partition.AddingDefinitions = []model.PartitionDefinition{newPartition}
+				tblInfo.Partition.DroppingDefinitions = []model.PartitionDefinition{oldPartition}
+			}
+			infoCache := infoschema.NewCache(nil, 1)
+			infoCache.Insert(infoschema.MockInfoSchemaWithSchemaVer([]*model.TableInfo{tblInfo}, 2), 0)
+			d, _ := ddl.NewDDL(context.Background(), ddl.WithStore(store), ddl.WithInfoCache(infoCache))
+			t.Cleanup(func() { require.NoError(t, d.Stop()) })
+
+			var oldRequests, newRequests atomic.Int32
+			var newTargetReady atomic.Bool
+			server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
+				switch r.URL.Query().Get("table_id") {
+				case "501":
+					oldRequests.Add(1)
+					_, _ = w.Write([]byte(`{"ready":1,"total":1}`))
+				case "502":
+					newRequests.Add(1)
+					if newTargetReady.Load() {
+						_, _ = w.Write([]byte(`{"ready":1,"total":1}`))
+					} else {
+						_, _ = w.Write([]byte(`{"ready":0,"total":1}`))
+					}
+				default:
+					http.Error(w, "unexpect
```

**File**: `pkg/dxf/importinto/BUILD.bazel` (modified, +1/-0)
```diff
@@ -119,6 +119,7 @@ go_test(
     flaky = True,
     shard_count = 38,
     deps = [
+        "//br/pkg/utils",
         "//pkg/config",
         "//pkg/config/configtypes",
         "//pkg/config/deploymode",
```

**File**: `pkg/dxf/importinto/scheduler.go` (modified, +12/-1)
```diff
@@ -132,9 +132,13 @@ func (t *taskInfo) close(ctx context.Context) {
 		}
 		t.taskRegister = nil
 	}
+	t.closeEtcdClient()
+}
+
+func (t *taskInfo) closeEtcdClient() {
 	if t.etcdClient != nil {
 		if err := t.etcdClient.Close(); err != nil {
-			logger.Warn("close etcd client failed", zap.Error(err))
+			t.logger.Warn("close etcd client failed", zap.Error(err))
 		}
 		t.etcdClient = nil
 	}
@@ -209,6 +213,13 @@ func (sch *importScheduler) Init() (err error) {
 }
 
 func (sch *importScheduler) Close() {
+	// A new owner may have adopted the same registration lease. Release only
+	// local clients here; terminal job paths are responsible for revoking leases.
+	sch.taskInfoMap.Range(func(key, value any) bool {
+		value.(*taskInfo).closeEtcdClient()
+		sch.taskInfoMap.Delete(key)
+		return true
+	})
 	metricsManager.unregister(sch.GetTask().ID)
 	sch.BaseScheduler.Close()
 }
```

---

### Incident Patch 6: `0a42bea5` (2026-09-21)
**Commit Message**: stmtsummary: surface logger init failures, drop leaked time-excluded FDs, fix absolute-path file pruning (#70175)

close pingcap/tidb#70174

**File**: `pkg/util/stmtsummary/v2/BUILD.bazel` (modified, +1/-1)
```diff
@@ -49,7 +49,7 @@ go_test(
     ],
     embed = [":stmtsummary"],
     flaky = True,
-    shard_count = 24,
+    shard_count = 27,
     deps = [
         "//pkg/config",
         "//pkg/meta/model",
```

**File**: `pkg/util/stmtsummary/v2/logger.go` (modified, +10/-4)
```diff
@@ -35,19 +35,25 @@ type stmtLogStorage struct {
 	logger *zap.Logger
 }
 
-func newStmtLogStorage(cfg *log.Config) *stmtLogStorage {
+// newStmtLogStorage builds the file-backed logger used to persist statement
+// summary window rotations. Backpressure-free behavior here is critical: when
+// logger initialization fails we MUST surface the error to the caller (the
+// static Setup path in main). A silent fallback to zap.NewNop() would make
+// persistent mode look enabled while silently dropping every rotated window,
+// so we fail closed instead and let Setup refuse to register the global
+// StmtSummary instance.
+func newStmtLogStorage(cfg *log.Config) (*stmtLogStorage, error) {
 	// Create the stmt logger
 	logger, prop, err := log.InitLogger(cfg)
 	if err != nil {
-		logutil.BgLogger().Error("failed to init logger", zap.Error(err))
-		return &stmtLogStorage{logger: zap.NewNop()}
+		return nil, fmt.Errorf("stmtsummary: init statement summary logger: %w", err)
 	}
 	// Replace 2018-12-19-unified-log-format text encoder with statements encoder
 	newCore := log.NewTextCore(&stmtLogEncoder{}, prop.Syncer, prop.Level)
 	logger = logger.WithOptions(zap.WrapCore(func(zapcore.Core) zapcore.Core {
 		return newCore
 	}))
-	return &stmtLogStorage{logger}
+	return &stmtLogStorage{logger: logger}, nil
 }
 
 func (s *stmtLogStorage) persist(w *stmtWindow, end time.Time) {
```

**File**: `pkg/util/stmtsummary/v2/reader.go` (modified, +6/-5)
```diff
@@ -544,15 +544,16 @@ func parseBeginTsAndReseek(file *os.File) (int64, error) {
 }
 
 func parseEndTs(file *os.File) (int64, error) {
-	// tidb-statements.log
-	filename := config.GetGlobalConfig().Instance.StmtSummaryFilename
+	// The rotated filename is compared by basename, so derive its prefix from
+	// the configured basename as well when the configured path is absolute.
+	configured := filepath.Base(config.GetGlobalConfig().Instance.StmtSummaryFilename)
 	// .log
-	ext := filepath.Ext(filename)
+	ext := filepath.Ext(configured)
 	// tidb-statements
-	prefix := filename[:len(filename)-len(ext)]
+	prefix := configured[:len(configured)-len(ext)]
 
 	// tidb-statements-2022-12-27T16-21-20.245.log
-	filename = filepath.Base(file.Name())
+	filename := filepath.Base(file.Name())
 	// .log
 	ext = filepath.Ext(file.Name())
 	// tidb-statements-2022-12-27T16-21-20.245
```

**File**: `pkg/util/stmtsummary/v2/reader_test.go` (modified, +23/-0)
```diff
@@ -96,6 +96,29 @@ func TestStmtFileInvalidLine(t *testing.T) {
 	require.Equal(t, time.Date(2022, 12, 27, 16, 21, 20, 245000000, time.Local).Unix(), f.end)
 }
 
+func TestStmtFileAbsoluteConfiguredFilename(t *testing.T) {
+	restore := config.RestoreFunc()
+	t.Cleanup(restore)
+
+	dir := t.TempDir()
+	config.UpdateGlobal(func(conf *config.Config) {
+		conf.Instance.StmtSummaryFilename = filepath.Join(dir, "tidb-statements.log")
+	})
+
+	end := time.Date(2022, 12, 27, 16, 21, 20, 245000000, time.Local)
+	rotated := filepath.Join(dir, "tidb-statements-2022-12-27T16-21-20.245.log")
+	content := fmt.Sprintf("{\"begin\":%d,\"end\":%d}\n", end.Unix()-10, end.Unix())
+	require.NoError(t, os.WriteFile(rotated, []byte(content), 0o600))
+
+	f, err := openStmtFile(rotated)
+	require.NoError(t, err)
+	t.Cleanup(func() { require.NoError(t, f.close()) })
+	require.Equal(t, end.Unix(), f.end)
+
+	checker := stmtChecker{timeRanges: []*StmtTimeRange{{Begin: end.Unix() + 1, End: end.Unix() + 2}}}
+	require.False(t, checker.isTimeValid(f.begin, f.end))
+}
+
 type stmtDirEntryInfoError struct {
 	os.DirEntry
 }
```

**File**: `pkg/util/stmtsummary/v2/stmtsummary.go` (modified, +45/-12)
```diff
@@ -17,6 +17,7 @@ package stmtsummary
 import (
 	"context"
 	"errors"
+	"fmt"
 	"math"
 	"sync"
 	"sync/atomic"
@@ -64,9 +65,32 @@ var (
 )
 
 // Setup initializes the GlobalStmtSummary.
-func Setup(cfg *Config) (err error) {
-	GlobalStmtSummary, err = NewStmtSummary(cfg)
-	return
+//
+// If NewStmtSummary fails the cluster config still advertises
+// `tidb_stmt_summary_enable_persistent = true`, while every v2 proxy (Add,
+// Enabled, ...) dereferences GlobalStmtSummary unconditionally on that flag.
+// A boot that "kept going" in that state would crash on the first SQL with a
+// nil pointer dereference: V2-11 traded silent data loss for a hard boot
+// loop. To avoid that half-initialized state Setup explicitly switches
+// persistent mode off on init failure, so the proxies fall back to the
+// always-available in-memory v1 aggregation (stmtsummary.StmtSummaryByDigestMap).
+// The error is returned with fallback context so the caller can emit one
+// actionable log entry rather than logging the same failure at every layer.
+func Setup(cfg *Config) error {
+	stmtSummary, err := NewStmtSummary(cfg)
+	if err != nil {
+		// Keep the failed result private and disable persistent mode before
+		// returning so proxies continue through the v1 implementation.
+		config.UpdateGlobal(func(conf *config.Config) {
+			conf.Instance.StmtSummaryEnablePersistent = false
+		})
+		return fmt.Errorf(
+			"stmtsummary v2 persistent mode disabled; falling back to v1 in-memory aggregation: %w",
+			err,
+		)
+	}
+	GlobalStmtSummary = stmtSummary
+	return nil
 }
 
 // Close closes the GlobalStmtSummary.
@@ -123,6 +147,22 @@ func NewStmtSummary(cfg *Config) (*StmtSummary, error) {
 		return nil, errors.New("stmtsummary: empty filename")
 	}
 
+	// Fail closed: a broken persistent logger makes persistent mode look
+	// enabled while silently dropping every rotated window (V2-11). Construct
+	// the storage before starting any goroutines so there are no background
+	// contexts to clean up on this early error path.
+	storage, err := newStmtLogStorage(&log.Config{
+		File: log.FileLogConfig{
+			Filename:   cfg.Filename,
+			MaxSize:    cfg.FileMaxSize,
+			MaxDays:    cfg.FileMaxDays,
+			MaxBackups: cfg.FileMaxBackups,
+		},
+	})
+	if err != nil {
+		return nil, err
+	}
+
 	ctx, cancel := context.WithCancel(context.Background())
 	s := &StmtSummary{
 		ctx:    ctx,
@@ -138,15 +178,8 @@ func NewStmtSummary(cfg *Config) (*StmtSummary, error) {
 		optRefreshInterval:     atomic2.NewUint32(defaultRefreshInterval),
 		optPersistEvicted:      atomic2.NewBool(false),
 		optGroupByUser:         atomic2.NewBool(false),
-		storage: newStmtLogStorage(&log.Config{
-			File: log.FileLogConfig{
-				Filename:   cfg.Filename,
-				MaxSize:    cfg.FileMaxSize,
-				MaxDays:    cfg.FileMaxDays,
-				MaxBackups: cfg.FileMaxBackups,
-			},
-		}),
-		evictedCh: make(chan *StmtRecord, evictedLogChanCap),
+		storage:                storage,
+		evictedCh:              make(chan *StmtRecord, evictedLogChanCap),
 	}
 	s.window = newStmtWindow(timeNow(), uint(defaultMaxStmtCount), s.onEvict)
 
```

---

### Incident Patch 7: `33555af6` (2026-09-20)
**Commit Message**: *: update client-go to fix shared-lock decoding warnings (#71367)

close pingcap/tidb#71368

**File**: `DEPS.bzl` (modified, +2/-2)
```diff
@@ -4527,8 +4527,8 @@ def go_deps():
         build_tags = ["nextgen", "intest"],
         build_file_proto_mode = "disable_global",
         importpath = "github.com/tikv/client-go/v2",
-        sum = "h1:OFhRCzHqFeARZMIum85M3PTLLmEIDeLXVG+jrRNI76w=",
-        version = "v2.0.8-0.20260903102657-08cbf831121a",
+        sum = "h1:e2GcofWhqtCKREy73l6oX6SbJxzwmS9Wl4LRzXfHzDQ=",
+        version = "v2.0.8-0.20260918070520-787f20af357c",
     )
     go_repository(
         name = "com_github_tikv_pd_client",
```

**File**: `go.mod` (modified, +1/-1)
```diff
@@ -121,7 +121,7 @@ require (
 	github.com/stretchr/testify v1.11.1
 	github.com/tencentcloud/tencentcloud-sdk-go/tencentcloud/common v1.3.142
 	github.com/tiancaiamao/appdash v0.0.0-20181126055449-889f96f722a2
-	github.com/tikv/client-go/v2 v2.0.8-0.20260903102657-08cbf831121a
+	github.com/tikv/client-go/v2 v2.0.8-0.20260918070520-787f20af357c
 	github.com/tikv/pd/client v0.0.0-20260805103528-afa43111d149
 	github.com/timakin/bodyclose v0.0.0-20241222091800-1db5c5ca4d67
 	github.com/twmb/murmur3 v1.1.6
```

**File**: `go.sum` (modified, +2/-2)
```diff
@@ -2368,8 +2368,8 @@ github.com/tidwall/pretty v1.2.1 h1:qjsOFOWWQl+N3RsoF5/ssm1pHmJJwhjlSbZ51I6wMl4=
 github.com/tidwall/pretty v1.2.1/go.mod h1:ITEVvHYasfjBbM0u2Pg8T2nJnzm8xPwvNhhsoaGGjNU=
 github.com/tidwall/sjson v1.2.5 h1:kLy8mja+1c9jlljvWTlSazM7cKDRfJuR/bOJhcY5NcY=
 github.com/tidwall/sjson v1.2.5/go.mod h1:Fvgq9kS/6ociJEDnK0Fk1cpYF4FIW6ZF7LAe+6jwd28=
-github.com/tikv/client-go/v2 v2.0.8-0.20260903102657-08cbf831121a h1:OFhRCzHqFeARZMIum85M3PTLLmEIDeLXVG+jrRNI76w=
-github.com/tikv/client-go/v2 v2.0.8-0.20260903102657-08cbf831121a/go.mod h1:4pMn4TwlKD9CIiRXT3d6d+iNVf3PPBoxYw/LSnYmS9g=
+github.com/tikv/client-go/v2 v2.0.8-0.20260918070520-787f20af357c h1:e2GcofWhqtCKREy73l6oX6SbJxzwmS9Wl4LRzXfHzDQ=
+github.com/tikv/client-go/v2 v2.0.8-0.20260918070520-787f20af357c/go.mod h1:4pMn4TwlKD9CIiRXT3d6d+iNVf3PPBoxYw/LSnYmS9g=
 github.com/tikv/pd/client v0.0.0-20260805103528-afa43111d149 h1:q5NgKsvuOdEHspG/pZEpKhWlPLrIfmO8P/lDFjTEdok=
 github.com/tikv/pd/client v0.0.0-20260805103528-afa43111d149/go.mod h1:sfdha4LXeUkSs2Z7N5jLzDEtm0GE7x+Glm2pW3UgEpA=
 github.com/timakin/bodyclose v0.0.0-20241222091800-1db5c5ca4d67 h1:9LPGD+jzxMlnk5r6+hJnar67cgpDIz/iyD+rfl5r2Vk=
```

---

### Incident Patch 8: `6884fa5e` (2026-09-18)
**Commit Message**: ddl, globalsort: bound global sort merge memory (#70756)

ref pingcap/tidb#62853

**File**: `pkg/ddl/backfilling_merge_sort.go` (modified, +1/-4)
```diff
@@ -107,14 +107,12 @@ func (m *mergeSortExecutor) RunSubtask(ctx context.Context, subtask *proto.Subta
 
 	prefix := path.Join(strconv.Itoa(int(subtask.TaskID)), strconv.Itoa(int(subtask.ID)))
 	res := m.GetResource()
-	memSizePerCon := res.MemoryPerCore()
-	partSize := max(simplesst.MinUploadPartSize, memSizePerCon*int64(globalsort.MaxMergingFilesPerThread)/simplesst.MaxUploadPartCount)
 
 	wctx := workerpool.NewContext(ctx)
 	op := globalsort.NewMergeOperator(
 		wctx,
 		objStore,
-		partSize,
+		res.MemoryPerCore(),
 		prefix,
 		simplesst.DefaultBlockSize,
 		onWriterClose,
@@ -132,7 +130,6 @@ func (m *mergeSortExecutor) RunSubtask(ctx context.Context, subtask *proto.Subta
 	err = globalsort.MergeOverlappingFiles(
 		wctx,
 		sm.DataFiles,
-		int(m.GetResource().CPU.Capacity()), // the concurrency used to split subtask
 		op,
 	)
 
```

**File**: `pkg/dxf/importinto/task_executor.go` (modified, +5/-25)
```diff
@@ -450,30 +450,14 @@ type mergeSortStepExecutor struct {
 	// subtask of a task is run in serial now, so we don't need lock here.
 	// change to SyncMap when we support parallel subtask in the future.
 	subtaskSortedKVMeta *globalsort.SortedKVMeta
-	// part-size for uploading merged files, it's calculated by:
-	// 	max(max-merged-files * max-file-size / max-part-num(10000), min-part-size)
-	dataKVPartSize  int64
-	indexKVPartSize int64
-	store           tidbkv.Storage
-	indicesGenKV    map[int64]importer.GenKVIndex
+	store               tidbkv.Storage
+	indicesGenKV        map[int64]importer.GenKVIndex
 
 	summary execute.SubtaskSummary
 }
 
 var _ execute.StepExecutor = &mergeSortStepExecutor{}
 
-func (m *mergeSortStepExecutor) Init(context.Context) error {
-	dataKVMemSizePerCon, perIndexKVMemSizePerCon := getWriterMemorySizeLimit(m.GetResource(), &m.taskMeta.Plan)
-	m.dataKVPartSize = max(simplesst.MinUploadPartSize, int64(dataKVMemSizePerCon*uint64(globalsort.MaxMergingFilesPerThread)/simplesst.MaxUploadPartCount))
-	m.indexKVPartSize = max(simplesst.MinUploadPartSize, int64(perIndexKVMemSizePerCon*uint64(globalsort.MaxMergingFilesPerThread)/simplesst.MaxUploadPartCount))
-
-	m.logger.Info("merge sort partSize",
-		zap.String("data-kv", units.BytesSize(float64(m.dataKVPartSize))),
-		zap.String("index-kv", units.BytesSize(float64(m.indexKVPartSize))),
-	)
-	return nil
-}
-
 func (m *mergeSortStepExecutor) RunSubtask(ctx context.Context, subtask *proto.Subtask) (err error) {
 	defer func() {
 		err = normalizeSubtaskErr(err)
@@ -516,10 +500,6 @@ func (m *mergeSortStepExecutor) RunSubtask(ctx context.Context, subtask *proto.S
 
 	prefix := subtaskPrefix(m.task.ID, subtask.ID)
 
-	partSize := m.dataKVPartSize
-	if sm.KVGroup != globalsort.DataKVGroup {
-		partSize = m.indexKVPartSize
-	}
 	onDup, err := getOnDupForKVGroup(
 		m.indicesGenKV,
 		sm.KVGroup,
@@ -530,23 +510,23 @@ func (m *mergeSortStepExecutor) RunSubtask(ctx context.Context, subtask *proto.S
 	}
 
 	wctx := workerpool.NewContext(ctx)
+	res := m.GetResource()
 	op := globalsort.NewMergeOperator(
 		wctx,
 		objStore,
-		partSize,
+		res.MemoryPerCore(),
 		prefix,
 		simplesst.DefaultOneWriterBlockSize,
 		onWriterClose,
 		globalsort.NewMergeCollector(ctx, &m.summary),
-		int(m.GetResource().CPU.Capacity()),
+		int(res.CPU.Capacity()),
 		false,
 		onDup,
 	)
 
 	if err = globalsort.MergeOverlappingFiles(
 		wctx,
 		sm.DataFiles,
-		int(m.GetResource().CPU.Capacity()), // the concurrency used to split subtask
 		op,
 	); err != nil {
 		return errors.Trace(err)
```

**File**: `pkg/ingestor/globalsort/bench_test.go` (modified, +10/-3)
```diff
@@ -374,7 +374,15 @@ func readMergeIter(t *testing.T, s *readTestSuite) {
 	var totalSize int
 	readBufSize := s.memoryLimit / len(files)
 	zeroOffsets := make([]uint64, len(files))
-	iter, err := simplesst.NewMergeKVIter(ctx, files, zeroOffsets, s.store, readBufSize, s.mergeIterHotspot, 1)
+	iter, err := simplesst.NewMergeKVIter(
+		ctx,
+		files,
+		zeroOffsets,
+		s.store,
+		readBufSize,
+		s.mergeIterHotspot,
+		maxMergeReaderMemoryPerCore,
+	)
 	intest.AssertNoError(err)
 
 	kvCnt := 0
@@ -529,7 +537,7 @@ func mergeStep(t *testing.T, s *mergeTestSuite) {
 	op := NewMergeOperator(
 		wctx,
 		s.store,
-		int64(5*size.MB),
+		5*maxMergeReaderMemoryPerCore,
 		mergeOutput,
 		simplesst.DefaultBlockSize,
 		onClose,
@@ -542,7 +550,6 @@ func mergeStep(t *testing.T, s *mergeTestSuite) {
 	err = MergeOverlappingFiles(
 		wctx,
 		datas,
-		s.concurrency,
 		op,
 	)
 
```

**File**: `pkg/ingestor/globalsort/merge.go` (modified, +78/-43)
```diff
@@ -43,6 +43,12 @@ var (
 	MaxMergingFilesPerThread = 250
 )
 
+const (
+	// maxMergeReaderMemoryPerCore allows 32 concurrent 8 MiB range reads per CPU;
+	// AWS S3 benchmarks showed this was sufficient for merge throughput.
+	maxMergeReaderMemoryPerCore = 256 * units.MiB
+)
+
 var _ execute.Collector = &mergeCollector{}
 
 // mergeCollector collects the bytes and row count in merge step.
@@ -76,9 +82,9 @@ func (c *mergeCollector) Processed(bytes, rowCnt int64) {
 }
 
 type mergeMinimalTask struct {
-	files        []string
-	fileGroupNum int
-	writerID     string
+	files            []string
+	activeGroupCount int
+	writerID         string
 }
 
 // RecoverArgs implements workerpool.TaskMayPanic interface.
@@ -89,13 +95,21 @@ func (*mergeMinimalTask) RecoverArgs() (metricsLabel string, funcInfo string, er
 // MergeOperator is the operator that merges overlapping files.
 type MergeOperator struct {
 	*operator.AsyncOperator[*mergeMinimalTask, workerpool.None]
+	concurrency int
+}
+
+// getMergeReaderMemory returns the concurrent-reader budget for one merge subtask.
+// It gives each CPU up to 256 MiB and uses 20% of the memory per core as a
+// safety limit for memory-constrained workers.
+func getMergeReaderMemory(memoryPerCore int64, concurrency int) int64 {
+	return min(maxMergeReaderMemoryPerCore, memoryPerCore/5) * int64(concurrency)
 }
 
 // NewMergeOperator creates a new MergeOperator instance.
 func NewMergeOperator(
 	ctx *workerpool.Context,
 	store storeapi.Storage,
-	partSize int64,
+	memoryPerCore int64,
 	newFilePrefix string,
 	blockSize int,
 	onWriterClose simplesst.OnWriterCloseFunc,
@@ -104,34 +118,33 @@ func NewMergeOperator(
 	checkHotspot bool,
 	onDup engineapi.OnDuplicateKey,
 ) *MergeOperator {
-	// during encode&sort step, the writer-limit is aligned to block size, so we
-	// need align this too. the max additional written size per file is max-block-size.
-	// for max-block-size = 32MiB, adding (max-block-size * MaxMergingFilesPerThread)/10000 ~ 1MiB
-	// to part-size is enough.
-	partSize = max(simplesst.MinUploadPartSize, partSize+units.MiB)
+	concurrency = max(concurrency, 1)
+	totalReaderMemorySize := getMergeReaderMemory(memoryPerCore, concurrency)
 	logutil.Logger(ctx).Info("create merge operator",
-		zap.Int64("part-size", partSize))
+		zap.Int64("memory-per-core", memoryPerCore),
+		zap.Int64("total-reader-memory-size", totalReaderMemorySize))
 	pool := workerpool.NewWorkerPool(
 		"mergeOperator",
 		util.ImportInto,
 		concurrency,
 		func() workerpool.Worker[*mergeMinimalTask, workerpool.None] {
 			return &mergeWorker{
-				ctx:           ctx,
-				store:         store,
-				partSize:      partSize,
-				newFilePrefix: newFilePrefix,
-				blockSize:     blockSize,
-				onWriterClose: onWriterClose,
-				collector:     collector,
-				checkHotspot:  checkHotspot,
-				onDup:         onDup,
+				ctx:                   ctx,
+				store:                 store,
+				totalReaderMemorySize: totalReaderMemorySize,
+				newFilePrefix:         newFilePrefix,
+				blockSize:             blockSize,
+				onWriterClose:         onWriterClose,
+				collector:             collector,
+				checkHotspot:          checkHotspot,
+				onDup:                 onDup,
 			}
 		},
 	)
 
 	return &MergeOperator{
 		AsyncOperator: operator.NewAsyncOperator(ctx, pool),
+		concurrency:   concurrency,
 	}
 }
 
@@ -143,30 +156,30 @@ func (*MergeOperator) String() string {
 type mergeWorker struct {
 	ctx context.Context
 
-	store         storeapi.Storage
-	partSize      int64
-	newFilePrefix string
-	blockSize     int
-	onWriterClose simplesst.OnWriterCloseFunc
-	collector     execute.Collector
-	checkHotspot  bool
-	onDup         engineapi.OnDuplicateKey
+	store                 storeapi.Storage
+	totalReaderMemorySize int64
+	newFilePrefix         string
+	blockSize             int
+	onWriterClose         simplesst.OnWriterCloseFunc
+	collector             execute.Collector
+	checkHotspot          bool
+	onDup               
```

**File**: `pkg/ingestor/globalsort/merge_test.go` (modified, +40/-7)
```diff
@@ -148,6 +148,36 @@ func TestSplitDataFiles(t *testing.T) {
 }
 
 func TestMergeOperator(t *testing.T) {
+	t.Run("memory-plan", func(t *testing.T) {
+		const gib = int64(1024 * 1024 * 1024)
+		const mib = int64(1024 * 1024)
+		lowMemoryPerCore := 9 * gib / 10
+		lowMemoryReaderBudget := getMergeReaderMemory(lowMemoryPerCore, 1)
+		standardReaderBudget := getMergeReaderMemory(4*gib, 1)
+		threeCPUReaderBudget := getMergeReaderMemory(4*gib, 3)
+		sevenCPUReaderBudget := getMergeReaderMemory(4*gib, 7)
+		require.Equal(t, lowMemoryPerCore/5, lowMemoryReaderBudget)
+		require.Equal(t, 256*mib, standardReaderBudget)
+		require.Equal(t, int64(23), lowMemoryReaderBudget/int64(simplesst.ConcurrentReaderBufferSizePerConc))
+		require.Equal(t, int64(32), standardReaderBudget/int64(simplesst.ConcurrentReaderBufferSizePerConc))
+		require.Equal(t, 3*256*mib, threeCPUReaderBudget)
+		require.Equal(t, 7*256*mib, sevenCPUReaderBudget)
+		require.Equal(t, int64(32), sevenCPUReaderBudget/7/int64(simplesst.ConcurrentReaderBufferSizePerConc))
+
+		inputSize := 80 * gib
+		partSize := getMergePartSize(inputSize, 33, 16*int(mib))
+		maxOutputSize := inputSize + 33*16*mib
+		expectedPartSize := maxOutputSize / simplesst.MaxUploadPartCount
+		if maxOutputSize%simplesst.MaxUploadPartCount != 0 {
+			expectedPartSize++
+		}
+		require.Equal(t, expectedPartSize, partSize)
+		require.LessOrEqual(t, (maxOutputSize+partSize-1)/partSize, int64(simplesst.MaxUploadPartCount))
+
+		partSize = getMergePartSize(mib, 1, int(mib))
+		require.Equal(t, simplesst.MinUploadPartSize, partSize)
+	})
+
 	oldMaxMergingFilesPerThread := MaxMergingFilesPerThread
 	MaxMergingFilesPerThread = 2
 	defer func() {
@@ -158,22 +188,27 @@ func TestMergeOperator(t *testing.T) {
 	testcases := []struct {
 		failpointValue string
 		expectError    error
+		concurrency    int
 	}{
 		{
 			failpointValue: "return(0)",
 			expectError:    nil,
+			concurrency:    0,
 		},
 		{
 			failpointValue: "return(1)",
 			expectError:    errors.Errorf("mock error in mergeOverlappingFilesInternal"),
+			concurrency:    1,
 		},
 		{
 			failpointValue: "return(2)",
 			expectError:    errors.Errorf("task panic: merge_sort, func info: mergeMinimalTask"),
+			concurrency:    1,
 		},
 		{
 			failpointValue: "return(3)",
 			expectError:    context.DeadlineExceeded,
+			concurrency:    1,
 		},
 	}
 
@@ -189,15 +224,16 @@ func TestMergeOperator(t *testing.T) {
 		op := NewMergeOperator(
 			wctx,
 			nil,
-			0,
+			5*maxMergeReaderMemoryPerCore,
 			"",
 			0,
 			nil,
 			nil,
-			1,
+			tc.concurrency,
 			false,
 			engineapi.OnDuplicateKeyIgnore,
 		)
+		require.Equal(t, max(tc.concurrency, 1), op.concurrency)
 
 		datas := []string{
 			"/tmp/1",
@@ -211,7 +247,6 @@ func TestMergeOperator(t *testing.T) {
 		err := MergeOverlappingFiles(
 			wctx,
 			datas,
-			1,
 			op,
 		)
 
@@ -271,15 +306,14 @@ func TestMergeOverlappingFilesInternal(t *testing.T) {
 		ctx,
 		dataFiles,
 		memStore,
-		int64(5*size.MB),
 		"/test2",
 		"mergeID",
 		1000,
 		func(summary *simplesst.WriterSummary) { onefile = summary.MultipleFilesStats[0].Filenames[0] },
 		collector,
 		true,
 		engineapi.OnDuplicateKeyIgnore,
-		1,
+		int64(10*size.MB),
 	))
 
 	require.EqualValues(t, kvCount, collector.Rows.Load())
@@ -374,15 +408,14 @@ func TestOnefileWriterManyRows(t *testing.T) {
 		ctx,
 		[]string{kvAndStat[0]},
 		memStore,
-		int64(5*size.MB),
 		"/test2",
 		"mergeID",
 		1000,
 		onClose,
 		nil,
 		true,
 		engineapi.OnDuplicateKeyIgnore,
-		1,
+		int64(10*size.MB),
 	))
 
 	bufSize := rand.Intn(100) + 1
```

---

### Incident Patch 9: `e80270eb` (2026-09-16)
**Commit Message**: importinto: fix flaky expired conflict row cleanup test (#71085)

close pingcap/tidb#69772, close pingcap/tidb#70977

**File**: `tests/realtikvtest/importintotest4/conflict_resolution_test.go` (modified, +9/-3)
```diff
@@ -61,14 +61,20 @@ func (s *mockGCSSuite) TestNextGenExpiredConflictRowCleanup() {
 	)
 	ctx := s.ctx
 	baseSortURI := fmt.Sprintf("gs://%s?endpoint=%s", sortBucket, gcsEndpoint)
-	originalCloudStorageURI := vardef.CloudStorageURI.Load()
+	originalCloudStorageURIRows := s.tk.MustQuery(`select variable_value from mysql.global_variables
+		where variable_name = ?`, vardef.TiDBCloudStorageURI).Rows()
+	require.Len(t, originalCloudStorageURIRows, 1)
+	originalCloudStorageURI := originalCloudStorageURIRows[0][0]
 	t.Cleanup(func() {
-		vardef.CloudStorageURI.Store(originalCloudStorageURI)
+		s.tk.MustExec("set global tidb_cloud_storage_uri = ?", originalCloudStorageURI)
 	})
 
 	s.server.CreateBucketWithOpts(fakestorage.CreateBucketOpts{Name: sourceBucket})
 	s.server.CreateBucketWithOpts(fakestorage.CreateBucketOpts{Name: sortBucket})
-	vardef.CloudStorageURI.Store(baseSortURI)
+	s.tk.MustExec("set global tidb_cloud_storage_uri = ?", baseSortURI)
+	s.tk.MustQuery(`select variable_value from mysql.global_variables
+		where variable_name = ?`, vardef.TiDBCloudStorageURI).
+		Check(testkit.Rows(baseSortURI))
 	rootedSortURI := handle.GetCloudStorageURI(ctx, s.store)
 	sortStore, err := importer.GetSortStore(ctx, rootedSortURI)
 	require.NoError(t, err)
```

**File**: `tests/realtikvtest/testkit.go` (modified, +1/-0)
```diff
@@ -304,6 +304,7 @@ func CreateMockStoreAndDomainAndSetup(t *testing.T, opts ...RealTiKVStoreOption)
 	tk.MustExec("use test")
 
 	if !option.retainData {
+		tk.MustExec("delete from mysql.tidb_import_jobs;")
 		tk.MustExec("delete from mysql.tidb_global_task;")
 		tk.MustExec("delete from mysql.tidb_background_subtask;")
 		tk.MustExec("delete from mysql.tidb_ddl_job;")
```

---

### Incident Patch 10: `0386d784` (2026-09-15)
**Commit Message**: executor: fix statement RU accounting for wrapped and locking statements (#71067)

ref pingcap/tidb#70747

**File**: `pkg/executor/adapter.go` (modified, +6/-3)
```diff
@@ -1152,6 +1152,8 @@ func (a *ExecStmt) runPessimisticSelectForUpdate(ctx context.Context, e exec.Exe
 			break
 		}
 		if req.NumRows() == 0 {
+			// The returned record set only drains buffered rows; execution ends here.
+			a.recordStatementRURootEOF()
 			return &chunkRowRecordSet{rows: rows, e: e, execStmt: a}, nil
 		}
 		iter := chunk.NewIterator4Chunk(req)
@@ -1193,9 +1195,10 @@ func (a *ExecStmt) handleNoDelayExecutor(ctx context.Context, e exec.Executor) (
 	if err != nil {
 		return nil, err
 	}
-	if _, ok := a.Plan.(*plannercore.Analyze); ok || statementRUIsWritePlan(a.Plan) || statementRUIsCommitPlan(a.Plan) {
-		// ANALYZE, DML and COMMIT complete in their only Next call, so there
-		// is no RecordSet EOF callback to record later.
+	switch classifyStatementRUPlan(a.Plan).kind {
+	case statementRUPlanAnalyze, statementRUPlanWrite, statementRUPlanCommit:
+		// These targets complete in their only Next call. Any EXPLAIN result
+		// set reports work that has already finished executing.
 		a.recordStatementRURootEOF()
 	}
 	err = a.handleStmtForeignKeyTrigger(ctx, e)
```

**File**: `pkg/executor/statement_ru_plan_walk.go` (modified, +16/-22)
```diff
@@ -21,6 +21,7 @@ import (
 
 	"github.com/pingcap/tidb/pkg/expression"
 	"github.com/pingcap/tidb/pkg/kv"
+	"github.com/pingcap/tidb/pkg/parser/ast"
 	"github.com/pingcap/tidb/pkg/parser/mysql"
 	plannercore "github.com/pingcap/tidb/pkg/planner/core"
 	"github.com/pingcap/tidb/pkg/planner/core/base"
@@ -188,9 +189,10 @@ func (a *ExecStmt) finishStatementRU(terminalErr error) float64 {
 			}
 			return
 		}
-		// a.Plan remains the statement eligibility guard even though the flat-plan
-		// view below comes from StatementContext.
-		if a.Ctx == nil || a.Plan == nil {
+		// Match the executed target, including EXPLAIN ANALYZE, against the
+		// flat-plan view borrowed from StatementContext.
+		planInfo := classifyStatementRUPlan(a.Plan)
+		if a.Ctx == nil || planInfo.plan == nil {
 			finalized.failure = statementRUInvalid
 			return
 		}
@@ -203,7 +205,7 @@ func (a *ExecStmt) finishStatementRU(terminalErr error) float64 {
 			finalized.failure = statementRUIneligible
 			return
 		}
-		if statementRUIsCommitPlan(a.Plan) {
+		if planInfo.kind == statementRUPlanCommit {
 			if !owner.rootEOF.Load() {
 				return
 			}
@@ -218,19 +220,9 @@ func (a *ExecStmt) finishStatementRU(terminalErr error) float64 {
 			return
 		}
 
-		switch plan := a.Plan.(type) {
-		case *physicalop.PointGetPlan:
+		if planInfo.kind == statementRUPlanPointLookup {
 			finalized, publishFinalized = calculateStatementRUPointLookup(
-				plan.ID(),
-				sessVars.StmtCtx.RuntimeStatsColl,
-				sessVars.RUV2Metrics,
-				calculationSetup,
-				owner.rootEOF.Load(),
-			)
-			return
-		case *physicalop.BatchPointGetPlan:
-			finalized, publishFinalized = calculateStatementRUPointLookup(
-				plan.ID(),
+				planInfo.plan.ID(),
 				sessVars.StmtCtx.RuntimeStatsColl,
 				sessVars.RUV2Metrics,
 				calculationSetup,
@@ -244,9 +236,9 @@ func (a *ExecStmt) finishStatementRU(terminalErr error) float64 {
 			return
 		}
 
-		// The fresh-session slice must use a flat plan rooted at this ExecStmt.
+		// The flat plan must be rooted at this statement's executed target.
 		// General flat-plan generation identity is not statement-RU evidence.
-		if len(flat.Main) == 0 || flat.Main[0] == nil || flat.Main[0].Origin != a.Plan {
+		if len(flat.Main) == 0 || flat.Main[0] == nil || flat.Main[0].Origin != planInfo.plan {
 			finalized.failure = statementRUInvalid
 			return
 		}
@@ -356,7 +348,8 @@ func calculateStatementRUInternal(
 	if !ok {
 		return statementRUTerminalFailure(rootEOF), false
 	}
-	if statementRUIsWritePlan(flat.Main[0].Origin) || statementRUIsCommitPlan(flat.Main[0].Origin) {
+	planInfo := classifyStatementRUPlan(flat.Main[0].Origin)
+	if planInfo.kind == statementRUPlanWrite || planInfo.kind == statementRUPlanCommit {
 		calculator.units.WriteKeys = float64(writes.keys)
 		calculator.units.WriteBytes = float64(writes.bytes)
 	}
@@ -366,7 +359,7 @@ func calculateStatementRUInternal(
 	// are not all available yet, so the finalized calibration
 	// remains Incomplete and the result is neither exact nor a mathematical upper
 	// or lower bound. Invalid values and malformed tree structure still fail closed.
-	if statementRUIsWritePlan(flat.Main[0].Origin) {
+	if planInfo.kind == statementRUPlanWrite {
 		calculator.units.WriteStatement = 1
 	}
 	mainRootUnits := calculator.units
@@ -412,7 +405,7 @@ func calculateStatementRUInternal(
 	}
 	finalized, ok := calculator.finalize()
 	if ok {
-		finalized.sqlType = statementRUSQLTypeForPlan(flat.Main[0].Origin)
+		finalized.sqlType = planInfo.sqlType
 	}
 	return finalized, ok
 }
@@ -618,7 +611,8 @@ func calculateStatementRUPlanChildFirst(
 			return statementRUOperatorResult{state: statementRUOperatorInvalid}
 		}
 	case *plannercore.Simple:
-		if !operator.IsRoot || len(children) != 0 || !statementRUIsCommitPlan(origin) {
+		_, isCommit := origin.Statement.(*ast.CommitStmt)
+		if !operator.IsRoot || len(children) != 0 || !isCommit {
 			return statementRUOperatorResult{state: statementRUOperatorUnsupported}
 		
```

**File**: `pkg/executor/statement_ru_plan_walk_integration_test.go` (modified, +244/-5)
```diff
@@ -209,6 +209,181 @@ func TestStatementRUAnalyzeNoDelayLifecycle(t *testing.T) {
 	require.Contains(t, decodedBySQL, "cop_task:")
 }
 
+func TestStatementRUWrappedStatements(t *testing.T) {
+	enableStatementRUExecutionInfo(t)
+	store := testkit.CreateMockStore(t)
+	tk := testkit.NewTestKit(t, store)
+	tk.MustExec("use test")
+	tk.MustExec("create table ru_wrapped(id int primary key, v int)")
+	tk.MustExec("insert into ru_wrapped values (1, 10), (2, 20)")
+
+	// UniStore Get responses need explicit scan details for point RU accounting.
+	responseHook := func(_ *tikvrpc.Request, resp *tikvrpc.Response) {
+		if get, ok := resp.Resp.(*kvrpcpb.GetResponse); ok {
+			get.ExecDetailsV2 = &kvrpcpb.ExecDetailsV2{ScanDetailV2: &kvrpcpb.ScanDetailV2{
+				TotalVersions: 2, ProcessedVersions: 1, ProcessedVersionsSize: 37,
+			}}
+		}
+	}
+	unistore.UnistoreRPCClientResponseHook.Store(&responseHook)
+	t.Cleanup(func() { unistore.UnistoreRPCClientResponseHook.Store(nil) })
+	testfailpoint.Enable(t,
+		"github.com/pingcap/tidb/pkg/store/mockstore/unistore/unistoreRPCClientResponseHook", "return(true)")
+
+	var observation *statementRUObservation
+	testfailpoint.EnableCall(t, statementRUOwnerInstallFailpoint, func(stmt *executor.ExecStmt) {
+		if stmt.Ctx == tk.Session() {
+			observation = observeInstalledStatementRUOwner(stmt)
+		}
+	})
+	var count int
+	var writeStatement, writeKeys, writeBytes, scanBytes, operatorNum float64
+	connectionID := tk.Session().GetSessionVars().ConnectionID
+	testfailpoint.EnableCall(t, statementRUCalibrationUnitsFailpoint, func(
+		observedID uint64, _ string, _, scan, _, _, _, _, ws, operators, keys, bytes float64,
+	) {
+		if observedID == connectionID {
+			count++
+			writeStatement, writeKeys, writeBytes, scanBytes, operatorNum = ws, keys, bytes, scan, operators
+		}
+	})
+
+	for _, binary := range []bool{false, true} {
+		t.Run(fmt.Sprintf("prepared analyze binary=%v", binary), func(t *testing.T) {
+			var run func()
+			if binary {
+				id, _, _, err := tk.Session().PrepareStmt("analyze table ru_wrapped")
+				require.NoError(t, err)
+				run = func() {
+					rs, err := tk.Session().ExecutePreparedStmt(context.Background(), id, nil)
+					require.NoError(t, err)
+					require.Nil(t, rs)
+				}
+				defer func() { require.NoError(t, tk.Session().DropPreparedStmt(id)) }()
+			} else {
+				tk.MustExec("prepare ru_analyze from 'analyze table ru_wrapped'")
+				defer tk.MustExec("deallocate prepare ru_analyze")
+				run = func() { tk.MustExec("execute ru_analyze") }
+			}
+			for range 2 {
+				before := count
+				run()
+				require.NotNil(t, observation.owner)
+				require.True(t, observation.owner.ConsumedForTest())
+				require.Equal(t, before+1, count)
+				require.Positive(t, operatorNum)
+				require.Zero(t, writeStatement)
+			}
+		})
+	}
+
+	for _, format := range []string{"", "format='brief' ", "format='ru' "} {
+		for _, explicitTxn := range []bool{false, true} {
+			for _, tc := range []struct {
+				sql   string
+				write bool
+			}{
+				{"select sum(v) from ru_wrapped", false},
+				{"select v from ru_wrapped where id=1", false},
+				{"insert into ru_wrapped values (3, 30)", true},
+				{"replace into ru_wrapped values (1, 11)", true},
+				{"update ru_wrapped set v=v+1 where id=1", true},
+				{"delete from ru_wrapped where id=2", true},
+			} {
+				t.Run(fmt.Sprintf("%s%s explicitTxn=%v", format, tc.sql, explicitTxn), func(t *testing.T) {
+					tk.MustExec("delete from ru_wrapped")
+					tk.MustExec("insert into ru_wrapped values (1, 10), (2, 20)")
+					if explicitTxn {
+						tk.MustExec("begin")
+						defer tk.MustExec("rollback")
+					}
+					before := count
+					tk.MustQuery("explain analyze " + format + tc.sql)
+					require.NotNil(t, observation.owner)
+					require.True(t, observation.owner.ConsumedForTest())
+					require.Equal(t, before+1, count)
+					require.Positive(t, operatorNum)
+					if tc.write {
+						require.Equal(t, float64(1), writeStatement)
+					} else {
+		
```

**File**: `pkg/executor/statement_ru_reporting.go` (modified, +0/-24)
```diff
@@ -178,30 +178,6 @@ func (report *statementRUFullReport) addStatementUnits(units ruv2.StmtUnits) {
 	}
 }
 
-// statementRUSQLTypeForPlan classifies a successfully calculated statement by
-// its executed plan. Prepared statements have already been unwrapped, and the
-// type is independent of affected rows or whether a transaction wrote any keys.
-func statementRUSQLTypeForPlan(plan base.Plan) string {
-	switch plan := plan.(type) {
-	case *physicalop.Insert:
-		if plan.IsReplace {
-			return "replace"
-		}
-		return "insert"
-	case *physicalop.Update:
-		return "update"
-	case *physicalop.Delete:
-		return "delete"
-	case *plannercore.Analyze:
-		return "analyze"
-	case *plannercore.Simple:
-		// COMMIT is the only supported Simple plan.
-		return "commit"
-	default:
-		return "select"
-	}
-}
-
 func publishStatementRUFullMetrics(finalized statementRUFinalizedSnapshot) {
 	for engine, operators := range finalized.report.units {
 		for operator, units := range operators {
```

**File**: `pkg/executor/statement_ru_result.go` (modified, +55/-19)
```diff
@@ -115,11 +115,13 @@ func newStatementRUCalculationSetup(stmt *ExecStmt) (statementRUCalculationSetup
 		return statementRUCalculationSetup{}, false
 	}
 	sessVars := stmt.Ctx.GetSessionVars()
-	_, isAnalyze := stmt.Plan.(*plannercore.Analyze)
+	planInfo := classifyStatementRUPlan(stmt.Plan)
 	if sessVars == nil || sessVars.StmtCtx == nil {
 		return statementRUCalculationSetup{}, false
 	}
-	eligible := sessVars.StmtCtx.IsReadOnly || isAnalyze || statementRUIsWritePlan(stmt.Plan) || statementRUIsCommitPlan(stmt.Plan)
+	// Locking SELECTs still perform reads even though they are not read-only.
+	eligible := sessVars.StmtCtx.IsReadOnly || sessVars.StmtCtx.InSelectStmt ||
+		planInfo.kind == statementRUPlanAnalyze || planInfo.kind == statementRUPlanWrite || planInfo.kind == statementRUPlanCommit
 	if !eligible ||
 		sessVars.InRestrictedSQL || sessVars.HasStatusFlag(mysql.ServerStatusCursorExists) ||
 		sessVars.StmtCtx.GetFlatPlan() != nil {
@@ -131,26 +133,60 @@ func newStatementRUCalculationSetup(stmt *ExecStmt) (statementRUCalculationSetup
 	}, true
 }
 
-// statementRUIsWritePlan classifies DML independently of affected rows.
-func statementRUIsWritePlan(plan base.Plan) bool {
-	// Prepared statements are unwrapped by Exec after owner installation.
-	if execute, ok := plan.(*plannercore.Execute); ok {
-		plan = execute.Plan
-	}
-	switch plan.(type) {
-	case *physicalop.Insert, *physicalop.Update, *physicalop.Delete:
-		return true
-	}
-	return false
+type statementRUPlanKind uint8
+
+const (
+	statementRUPlanOther statementRUPlanKind = iota
+	statementRUPlanWrite
+	statementRUPlanCommit
+	statementRUPlanAnalyze
+	statementRUPlanPointLookup
+)
+
+// statementRUPlanInfo is local to an execution phase: retries can rebuild the plan.
+// Other plans still use the statement context for read eligibility.
+type statementRUPlanInfo struct {
+	plan    base.Plan
+	kind    statementRUPlanKind
+	sqlType string
 }
 
-func statementRUIsCommitPlan(plan base.Plan) bool {
-	simple, ok := plan.(*plannercore.Simple)
-	if !ok {
-		return false
+// classifyStatementRUPlan resolves executing wrappers and classifies the target
+// in one traversal, independently of affected rows or committed keys. A plain
+// EXPLAIN only renders a plan and must never charge its unexecuted target.
+func classifyStatementRUPlan(plan base.Plan) statementRUPlanInfo {
+	info := statementRUPlanInfo{plan: plan, sqlType: "select"}
+	for {
+		switch plan := info.plan.(type) {
+		case *plannercore.Execute:
+			// Owner installation happens before Exec unwraps prepared statements.
+			info.plan = plan.Plan
+			continue
+		case *plannercore.Explain:
+			if plan.Analyze {
+				info.plan = plan.TargetPlan
+				continue
+			}
+		case *physicalop.Insert:
+			info.kind, info.sqlType = statementRUPlanWrite, "insert"
+			if plan.IsReplace {
+				info.sqlType = "replace"
+			}
+		case *physicalop.Update:
+			info.kind, info.sqlType = statementRUPlanWrite, "update"
+		case *physicalop.Delete:
+			info.kind, info.sqlType = statementRUPlanWrite, "delete"
+		case *plannercore.Analyze:
+			info.kind, info.sqlType = statementRUPlanAnalyze, "analyze"
+		case *plannercore.Simple:
+			if _, ok := plan.Statement.(*ast.CommitStmt); ok {
+				info.kind, info.sqlType = statementRUPlanCommit, "commit"
+			}
+		case *physicalop.PointGetPlan, *physicalop.BatchPointGetPlan:
+			info.kind = statementRUPlanPointLookup
+		}
+		return info
 	}
-	_, ok = simple.Statement.(*ast.CommitStmt)
-	return ok
 }
 
 func statementRUFrontendCompileBytes(stmt *ExecStmt) float64 {
```

#### Recent Merged Pull Requests:
- **PR #71699** (2026-09-30): parser: support WITH DEFAULT NDVRATE in ANALYZE (@0xPoe)
- **PR #71696** (2026-09-30): dumpling: make --pd optional for premium keyspace clusters (@D3Hunter)
- **PR #71695** (2026-09-29): build: resolve Bazel Go deps through GOPROXY (#69503) (@ti-chi-bot)
- **PR #71692** (2026-09-29): deps: replace 'sourcegraph.com/sourcegraph/appdash*' in go.mod (@ti-chi-bot)
- **PR #71691** (2026-09-29): deps: replace 'sourcegraph.com/sourcegraph/appdash*' in go.mod (@ti-chi-bot)
- **PR #71690** (2026-09-29): deps: replace 'sourcegraph.com/sourcegraph/appdash*' in go.mod (@ti-chi-bot)
- **PR #71686** (2026-09-29): executor, statistics: avoid analyze hang on save error (#66169) (@ti-chi-bot)
- **PR #71685** (2026-09-29): deps: replace 'sourcegraph.com/sourcegraph/appdash*' in go.mod (@ti-chi-bot)

---

## 3. Empirical Evidence & Compliance Certification
- **Evidence Provenance**: Fetched directly from verified official GitHub REST API.
- **Zero Disk Footprint**: 0 bytes of unnecessary repository bloat stored locally.
- **TOS & Free-Tier Adherence**: Request pace complied with public API guidelines without fee, penalty, or unauthorized scraping.

---

## 4. Promotion & Integration Status
- **Status**: HARVESTED_DEEP_FORENSIC
- **Master Brain Sync**: Auto-committed to local/remote Master Brain repository.
