# Forensic Learning Record (Deep Inspection): dolthub/dolt

> **Canonical Artifact**: `07_PROJECT_LEARNING/dolthub-dolt-learnings.md`  
> **Source Platform**: GitHub ([https://github.com/dolthub/dolt](https://github.com/dolthub/dolt))  
> **Harvest Method**: Full-Spectrum Deep Extraction (Patches, Diffs, Source Code, Post-Mortems)  
> **Harvest Timestamp**: 2026-10-06T01:46:22.190Z  
> **Compliance State**: Free Tier Guaranteed | Strict Rate-Limit Backoff Honored  

---

## 1. Context & Architectural Overview
- **Repository / Resource**: `dolthub/dolt`
- **Description**: Dolt – Git for Data
- **Primary Language / Ecosystem**: Go
- **Discovered Manifests / Configurations**: README.md
- **Stars / Engagement**: 24573 stars

---

## 2. Multi-Dimensional 8-Axis Investigation & Real Code Patches

### D1: Architecture & Structural Boundaries
- Entry configurations inspected via direct stream: README.md.
- Evaluated system abstractions and modular contracts.

### Core Architecture Module: `go/cmd/dolt/commands/engine/jwtplugin.go`
```
// Copyright 2022 Dolthub, Inc.
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

package engine

import (
	"errors"
	"fmt"
	"strings"
	"time"

	"github.com/dolthub/go-mysql-server/sql/mysql_db"
	"github.com/sirupsen/logrus"

	"github.com/dolthub/dolt/go/libraries/doltcore/servercfg"
	"github.com/dolthub/dolt/go/libraries/utils/jwtauth"
)

// authenticateDoltJWTPlugin is used to authenticate plaintext user plugins
type authenticateDoltJWTPlugin struct {
	jwksConfig []servercfg.JwksConfig
}

func NewAuthenticateDoltJWTPlugin(jwksConfig []servercfg.JwksConfig) mysql_db.PlaintextAuthPlugin {
	return &authenticateDoltJWTPlugin{jwksConfig: jwksConfig}
}

func (p *authenticateDoltJWTPlugin) Authenticate(db *mysql_db.MySQLDb, user string, userEntry *mysql_db.User, pass string) (bool, error) {
	return validateJWT(p.jwksConfig, userEntry.Identity, pass, time.Now())
}

// validateJWT authenticates a token against the claims declared in the user's
// identity string. The identity string is a comma-separated set of expected
// claims (jwks, iss, aud, sub); the token authenticates iff it satisfies all
// of them. The connecting username is deliberately not consulted here: if an
// operator wants to bind the token subject to the account name, they set
// sub=<username> in the identity, which is then enforced against the token's
// sub claim like any other claim.
func validateJWT(config []servercfg.JwksConfig, identity, token string, reqTime time.Time) (bool, error) {
	if len(config) == 0 {
		return false, errors.New("ValidateJWT: JWKS server config not found")
	}

	expectedClaimsMap, err := parseUserIdentity(identity)
	if err != nil {
		return false, err
	}

	jwksConfig, err := getMatchingJwksConfig(config, expectedClaimsMap["jwks"])
	if err != nil {
		return false, err
	}

	pr, err := getJWTProvider(expectedClaimsMap, jwksConfig.LocationUrl)
	if err != nil {
		return false, err
	}
	vd, err := jwtauth.NewJWTValidator(pr)
	if err != nil {
		return false, err
	}
	claims, err := vd.ValidateJWT(token, reqTime)
	if err != nil {
		return false, err
	}

	logString := "Authenticating with JWT: "
	for _, field := range jwksConfig.FieldsToLog {
		logString += fmt.Sprintf("%s: %s,", field, getClaimFromKey(claims, field))
	}
	logrus.Info(logString)
	return true, nil
}

func getJWTProvider(expectedClaimsMap map[string]string, url string) (jwtauth.JWTProvider, error) {
	pr := jwtauth.JWTProvider{URL: url}
	for name, claim := range expectedClaimsMap {
		switch name {
		case "iss":
			pr.Issuer = claim
		case "aud":
			pr.Audience = claim
		case "sub":
			pr.Subject = claim
		case "jwks":
			continue
		default:
			return pr, errors.New("ValidateJWT: Unexpected expected claim found in user identity")
		}
	}
	return pr, nil
}

func getClaimFromKey(claims *jwtauth.Claims, field string) string {
	switch field {
	case "id":
		return claims.ID
	case "iss":
		return claims.Issuer
	case "sub":
		return claims.Subject
	case "on_behalf_of":
		return claims.OnBehalfOf
	}
	return ""
}

func getMatchingJwksConfig(config []servercfg.JwksConfig, name string) (*servercfg.JwksConfig, error) {
	for _, item := range config {
		if item.Name == name {
			return &item, nil
		}
	}
	return nil, errors.New("ValidateJWT: Matching JWKS config not found")
}

func parseUserIdentity(identity string) (map[string]string, error) {
	idMap := make(map[string]string)
	items := strings.Split(identity, ",")
	for _, item := range items {
		name, value, ok := strings.Cut(item, "=")
		if !ok {
			return nil, fmt.Errorf("ValidateJWT: malformed identity %q: expected comma-separated key=value pairs", identity)
		}
		idMap[name] = value
	}
	return idMap, nil
}

```

### Core Architecture Module: `go/cmd/dolt/commands/engine/sql_print.go`
```
// Copyright 2020 Dolthub, Inc.
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

package engine

import (
	"context"
	"errors"
	"fmt"
	"io"
	"time"

	"github.com/dolthub/go-mysql-server/sql"
	"github.com/dolthub/go-mysql-server/sql/types"
	"github.com/dolthub/vitess/go/sqltypes"
	"github.com/fatih/color"

	"github.com/dolthub/dolt/go/cmd/dolt/cli"
	"github.com/dolthub/dolt/go/libraries/doltcore/row"
	"github.com/dolthub/dolt/go/libraries/doltcore/sqle/sqlutil"
	"github.com/dolthub/dolt/go/libraries/doltcore/table"
	"github.com/dolthub/dolt/go/libraries/doltcore/table/typed/json"
	"github.com/dolthub/dolt/go/libraries/doltcore/table/typed/parquet"
	"github.com/dolthub/dolt/go/libraries/doltcore/table/untyped/csv"
	"github.com/dolthub/dolt/go/libraries/doltcore/table/untyped/tabular"
	"github.com/dolthub/dolt/go/libraries/utils/iohelp"
	"github.com/dolthub/dolt/go/store/util/outputpager"
)

type PrintResultFormat byte

const (
	FormatTabular PrintResultFormat = iota
	FormatCsv
	FormatJson
	FormatJsonl
	FormatNull // used for profiling
	FormatVertical
	FormatParquet
)

type PrintSummaryBehavior byte

const (
	PrintNoSummary         PrintSummaryBehavior = 0
	PrintRowCountAndTiming                      = 1
)

// PrettyPrintResults prints the result of a query in the format provided
func PrettyPrintResults(ctx *sql.Context, resultFormat PrintResultFormat, sqlSch sql.Schema, rowIter sql.RowIter, pageResults, showWarnings, printOkResult, binaryAsHex bool) (rerr error) {
	return prettyPrintResultsWithSummary(ctx, resultFormat, sqlSch, rowIter, PrintNoSummary, pageResults, showWarnings, printOkResult, binaryAsHex)
}

// PrettyPrintResultsExtended prints the result of a query in the format provided, including row count and timing info
func PrettyPrintResultsExtended(ctx *sql.Context, resultFormat PrintResultFormat, sqlSch sql.Schema, rowIter sql.RowIter, pageResults, showWarnings, printOkResult, binaryAsHex bool) (rerr error) {
	return prettyPrintResultsWithSummary(ctx, resultFormat, sqlSch, rowIter, PrintRowCountAndTiming, pageResults, showWarnings, printOkResult, binaryAsHex)
}

func prettyPrintResultsWithSummary(ctx *sql.Context, resultFormat PrintResultFormat, sqlSch sql.Schema, rowIter sql.RowIter, summary PrintSummaryBehavior, pageResults, showWarnings, printOkResult, binaryAsHex bool) (rerr error) {
	defer func() {
		closeErr := rowIter.Close(ctx)
		if rerr == nil && closeErr != nil {
			rerr = closeErr
		}
	}()

	start := ctx.QueryTime()

	// TODO: this isn't appropriate for JSON, CSV, other structured result formats
	if isOkResult(sqlSch) {
		// OkResult is only printed when we are in interactive terminal (TTY)
		if !printOkResult {
			return nil
		}
		return printOKResult(ctx, rowIter, start)
	}

	var wr table.SqlRowWriter
	var err error
	var numRows int

	// Function to print results. A function is required because we need to wrap the whole process in a swap of
	// IO streams. This is done with cli.ExecuteWithStdioRestored, which requires a resultless function. As
	// a result, we need to depend on side effects to numRows and err to determine if it was successful.
	printEm := func() {
		writerStream := cli.CliOut
		if pageResults {
			pager := outputpager.Start()
			defer pager.Stop()
			writerStream = pager.Writer
		}

		switch resultFormat {
		case FormatCsv:
			var err error
			wr, err = csv.NewCSVSqlWriter(iohelp.NopWrCloser(writerStream), sqlSch, csv.NewCSVInfo())
			if err != nil {
				return
			}
		case FormatJson:
			var err error
			wr, err = json.NewJSONSqlWriter(iohelp.NopWrCloser(writerStream), sqlSch)
			if err != nil {
				return
			}
		case FormatJsonl:
			wr, err = json.NewJSONLSqlWriter(iohelp.NopWrCloser(writerStream), sqlSch)
			if err != nil {
				return
			}
		case FormatTabular:
			wr = tabular.NewFixedWidthTableWriter(sqlSch, iohelp.NopWrCloser(writerStream), 100)
		case FormatNull:
			wr = nullWriter{}
		case FormatVertical:
			wr = newVerticalRowWriter(iohelp.NopWrCloser(writerStream), sqlSch)
		case FormatParquet:
			var err error
			wr, err = parquet.NewParquetRowWriter(sqlSch, iohelp.NopWrCloser(writerStream))
			if err != nil {
				return
			}
		}

		// Wrap iterator with binary-to-hex transformation if needed
		if binaryAsHex {
			rowIter = newBinaryHexIterator(rowIter, sqlSch)
		}

		numRows, err = writeResultSet(ctx, rowIter, wr)
	}

	if pageResults {
		cli.ExecuteWithStdioRestored(printEm)
	} else {
		printEm()
	}
	if err != nil {
		return err
	}

	// if there is no row data and result format is JSON, then create empty JSON.
	if resultFormat == FormatJson && numRows == 0 {
		iohelp.WriteLine(cli.CliOut, "{}")
	}

	if summary == PrintRowCountAndTiming {
		warnings := ""
		if showWarnings {
			warnings = "\n"
			for _, warn := range ctx.Session.Warnings() {
				warnings += color.YellowString(fmt.Sprintf("\nWarning (Code %d): %s", warn.Code, warn.Message))
			}
		}

		err = printResultSetSummary(numRows, ctx.WarningCount(), warnings, start)
		if err != nil {
			return err
		}
	}

	// Some output formats need a final newline printed, others do not
	switch resultFormat {
	case FormatJson, FormatTabular, FormatVertical:
		return iohelp.WriteLine(cli.CliOut, "")
	default:
		return nil
	}
}

func printResultSetSummary(numRows int, numWarnings uint16, warningsList string, start time.Time) error {

	warning := ""
	if numWarnings > 0 {
		plural := ""
		if numWarnings > 1 {
			plural = "s"
		}
		warning = fmt.Sprintf(", %d warning%s", numWarnings, plural)
	}

	if numRows == 0 {
		printEmptySetResult(start, warning)
		return nil
	}

	noun := "rows"
	if numRows == 1 {
		noun = "row"
	}

	secondsSinceStart := secondsSince(start, time.Now())
	err := iohelp.WriteLine(cli.CliOut, fmt.Sprintf("%d %s in set%s (%.2f sec) %s", numRows, noun, warning, secondsSinceStart, warningsList))
	if err != nil {
		return err
	}

	return nil
}

// binaryHexIterator wraps a row iterator and transforms binary data to hex format
type binaryHexIterator struct {
	inner  sql.RowIter
	schema sql.Schema
}

var _ sql.RowIter = (*binaryHexIterator)(nil)

// newBinaryHexIterator creates a new iterator that transforms binary data to hex format
func newBinaryHexIterator(inner sql.RowIter, schema sql.Schema) sql.RowIter {
	return &binaryHexIterator{
		inner:  inner,
		schema: schema,
	}
}

// Next returns the next row with binary data transformed to hex format
func (iter *binaryHexIterator) Next(ctx *sql.Context) (sql.Row, error) {
	rowData, err := iter.inner.Next(ctx)
	if err != nil {
		return nil, err
	}

	// TODO: Add support for BLOB types (TINYBLOB, BLOB, MEDIUMBLOB, LONGBLOB) and BIT type
	for i, val := range rowData {
		if val != nil && i < len(iter.schema) {
			switch iter.schema[i].Type.Type() {
			case sqltypes.Binary, sqltypes.VarBinary:
				switch v := val.(type) {
				case []byte: // hex fmt is explicitly upper case
					rowData[i] = sqlutil.BinaryAsHexDisplayValue(fmt.Sprintf("0x%X", v))
				case string: // handles results from sql-server; MySQL wire protocol returns strings
					rowData[i] = sqlutil.BinaryAsHexDisplayValue(fmt.Sprintf("0x%X", []byte(v)))
				default:
					return nil, fmt.Errorf("unexpected type %T for binary column %s", val, iter.schema[i].Name)
				}
			}
		}
	}

	return rowData, nil
}

// Close closes the wrapped iterator and releases any resources.
func (iter *binaryHexIterator) Close(ctx *sql.Context) error {
	return iter.inner.Close(ctx)
}

// writeResultSet drains the iterator given, printing rows from it to the writer given. Returns the number of rows.
func writeResultSet(ctx *sql.Context, rowIter sql.RowIter, wr table.SqlRowWriter) (int, error) {
	i := 0
	for {
		r, err := rowIter.Next(ctx)
		if err == io.EOF {
			break
		} else if err != nil {
			return 0, err
		}

		err = wr.WriteSqlRow(ctx, r)
		if err != nil {
			return 0, err
		}

		i++
	}

	err := wr.Close(ctx)
	if err != nil {
		return 0, err
	}

	return i, nil
}

// secondsSince returns the number of full and partial seconds since the time given
func secondsSince(start time.Time, end time.Time) float64 {
	runTime := end.Sub(start)
	seconds := runTime / time.Second
	milliRemainder := (runTime - seconds*time.Second) / time.Millisecond
	timeDisplay := float64(seconds) + float64(milliRemainder)*.001
	return timeDisplay
}

// nullWriter is a no-op SqlRowWriter implementation
type nullWriter struct{}

func (n nullWriter) WriteSqlRow(ctx *sql.Context, r sql.Row) error { return nil }
func (n nullWriter) Close(ctx context.Context) error               { return nil }

func printEmptySetResult(start time.Time, warning string) {
	seconds := secondsSince(start, time.Now())
	cli.Printf("Empty set%s (%.2f sec)\n", warning, seconds)
}

func printOKResult(ctx *sql.Context, iter sql.RowIter, start time.Time) error {
	row, err := iter.Next(ctx)
	if err != nil {
		return err
	}

	if okResult, ok := row[0].(types.OkResult); ok {
		rowNoun := "row"
		if okResult.RowsAffected != 1 {
			rowNoun = "rows"
		}

		seconds := secondsSince(start, time.Now())
		cli.Printf("Query OK, %d %s affected (%.2f sec)\n", okResult.RowsAffected, rowNoun, seconds)

		if okResult.Info != nil {
			cli.Printf("%s\n", okResult.Info)
		}
	}

	return nil
}

func isOkResult(sch sql.Schema) bool {
	return sch.Equals(types.OkResultSchema)
}

type verticalRowWriter struct {
	wr      io.WriteCloser
	sch     sql.Schema
	idx     int
	offsets []int
}

func newVerticalRowWriter(wr io.WriteCloser, sch sql.Schema) *verticalRowWriter {
	return &verticalRowWriter{
		wr:      wr,
		sch:    
```

### Core Architecture Module: `go/cmd/dolt/commands/engine/sqlengine.go`
```
// Copyright 2021 Dolthub, Inc.
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

package engine

import (
	"context"
	"fmt"
	"maps"
	"os"
	"strconv"
	"strings"

	gms "github.com/dolthub/go-mysql-server"
	"github.com/dolthub/go-mysql-server/eventscheduler"
	"github.com/dolthub/go-mysql-server/sql"
	"github.com/dolthub/go-mysql-server/sql/analyzer"
	"github.com/dolthub/go-mysql-server/sql/binlogreplication"
	"github.com/dolthub/go-mysql-server/sql/mysql_db"
	"github.com/dolthub/go-mysql-server/sql/rowexec"
	_ "github.com/dolthub/go-mysql-server/sql/variables"
	"github.com/dolthub/vitess/go/vt/sqlparser"
	"github.com/sirupsen/logrus"

	"github.com/dolthub/dolt/go/cmd/dolt/cli"
	"github.com/dolthub/dolt/go/libraries/doltcore/branch_control"
	"github.com/dolthub/dolt/go/libraries/doltcore/dconfig"
	"github.com/dolthub/dolt/go/libraries/doltcore/doltdb"
	"github.com/dolthub/dolt/go/libraries/doltcore/doltdb/gcctx"
	"github.com/dolthub/dolt/go/libraries/doltcore/env"
	"github.com/dolthub/dolt/go/libraries/doltcore/servercfg"
	"github.com/dolthub/dolt/go/libraries/doltcore/sqle"
	dblr "github.com/dolthub/dolt/go/libraries/doltcore/sqle/binlogreplication"
	"github.com/dolthub/dolt/go/libraries/doltcore/sqle/cluster"
	"github.com/dolthub/dolt/go/libraries/doltcore/sqle/dprocedures"
	"github.com/dolthub/dolt/go/libraries/doltcore/sqle/dsess"
	"github.com/dolthub/dolt/go/libraries/doltcore/sqle/kvexec"
	"github.com/dolthub/dolt/go/libraries/doltcore/sqle/mysql_file_handler"
	"github.com/dolthub/dolt/go/libraries/doltcore/sqle/statspro"
	"github.com/dolthub/dolt/go/libraries/doltcore/sqle/writer"
	"github.com/dolthub/dolt/go/libraries/utils/config"
	dherrors "github.com/dolthub/dolt/go/libraries/utils/errors"
	"github.com/dolthub/dolt/go/libraries/utils/filesys"
	"github.com/dolthub/dolt/go/libraries/utils/valctx"
)

// SqlEngine packages up the context necessary to run sql queries against dsqle.
type SqlEngine struct {
	provider          *sqle.DoltDatabaseProvider
	ContextFactory    sql.ContextFactory
	dsessFactory      sessionFactory
	engine            *gms.Engine
	fs                filesys.Filesys
	clusterController *cluster.Controller
}

type sessionFactory func(mysqlSess *sql.BaseSession, pro sql.DatabaseProvider) (*dsess.DoltSession, error)
type contextFactory func(ctx context.Context, session sql.Session) (*sql.Context, error)

type SystemVariables map[string]interface{}

type SqlEngineConfig struct {
	IsReadOnly                 bool
	IsServerLocked             bool
	DoltCfgDirPath             string
	PrivFilePath               string
	BranchCtrlFilePath         string
	ServerUser                 string
	ServerPass                 string
	ServerHost                 string
	SkipRootUserInitialization bool
	Autocommit                 bool
	DoltTransactionCommit      bool
	Bulk                       bool
	JwksConfig                 []servercfg.JwksConfig
	SystemVariables            SystemVariables
	ClusterController          *cluster.Controller
	AutoGCController           *sqle.AutoGCController
	BinlogReplicaController    binlogreplication.BinlogReplicaController
	EventSchedulerStatus       eventscheduler.SchedulerStatus
	BranchActivityTracking     bool
	EngineOverrides            sql.EngineOverrides

	// DBLoadParams are optional parameters passed through to database loading for local file-backed databases.
	// These are merged into the params map used by doltdb/env load routines.
	//
	// Intended for embedded-driver use-cases that need to influence dbfactory / storage open behavior.
	DBLoadParams map[string]interface{}

	// ProviderFactory controls how the DatabaseProvider is created. If nil, sqle.DoltProviderFactory is used.
	ProviderFactory sqle.ProviderFactory

	FatalBehavior dherrors.FatalBehavior
}

type SqlEngineConfigOption func(*SqlEngineConfig)

// NewSqlEngine returns a SqlEngine
func NewSqlEngine(
	ctx context.Context,
	mrEnv *env.MultiRepoEnv,
	config *SqlEngineConfig,
) (*SqlEngine, error) {
	// Context validation is a testing mode that we run Dolt in
	// during integration tests. It asserts that `context.Context`
	// instances which reach the storage layer have gone through
	// GC session lifecycle callbacks. This is only relevant in
	// sql mode, so we only enable it here. This is potentially
	// relevant in non-sql-server contexts, because things like
	// replication and events can still cause concurrency during a
	// GC, so we put this here instead of in sql-server.
	const contextValidationEnabledEnvVar = "DOLT_CONTEXT_VALIDATION_ENABLED"
	if val := os.Getenv(contextValidationEnabledEnvVar); val != "" && val != "0" && strings.ToLower(val) != "false" {
		valctx.EnableContextValidation()
	}

	gcSafepointController := gcctx.NewGCSafepointController()
	ctx = gcctx.WithGCSafepointController(ctx, gcSafepointController)

	defer gcctx.SessionEnd(ctx)
	gcctx.SessionCommandBegin(ctx)
	defer gcctx.SessionCommandEnd(ctx)

	// Thread DB load params into each environment before any DB is loaded.
	// (For already-loaded envs, these will not affect the existing instance.)
	if config != nil && len(config.DBLoadParams) > 0 {
		_ = mrEnv.Iter(func(_ string, dEnv *env.DoltEnv) (stop bool, err error) {
			if dEnv.DBLoadParams == nil {
				dEnv.DBLoadParams = maps.Clone(config.DBLoadParams)
			} else {
				maps.Copy(dEnv.DBLoadParams, config.DBLoadParams)
			}
			return false, nil
		})
	}

	// Some database initialization logic depends on system variables, load them before the databases
	err := applySystemVariables(sql.SystemVariables, config.SystemVariables)
	if err != nil {
		return nil, err
	}

	dbs, locations, err := CollectDBs(ctx, mrEnv)
	if err != nil {
		return nil, err
	}

	bThreads := sql.NewBackgroundThreads()
	var runAsyncThreads sqle.RunAsyncThreads
	dbs, runAsyncThreads, err = sqle.ApplyReplicationConfig(ctx, mrEnv, cli.CliOut, dbs...)
	if err != nil {
		return nil, err
	}

	config.ClusterController.ManageSystemVariables(sql.SystemVariables)

	err = config.ClusterController.ApplyStandbyReplicationConfig(ctx, mrEnv, dbs...)
	if err != nil {
		return nil, err
	}

	// Make a copy of the databases. |all| is going to be provided
	// as the set of all initial databases to dsqle
	// DatabaseProvider. |dbs| is only the databases that came
	// from MultiRepoEnv, and they are all real databases based on
	// DoltDB instances. |all| is going to include some extension,
	// informational databases like |dolt_cluster| sometimes,
	// depending on config.
	all := make([]dsess.SqlDatabase, len(dbs))
	copy(all, dbs)

	clusterDB := config.ClusterController.ClusterDatabase()
	if clusterDB != nil {
		all = append(all, clusterDB.(dsess.SqlDatabase))
		locations = append(locations, nil)
	}

	factory := config.ProviderFactory
	if factory == nil {
		factory = sqle.DoltProviderFactory{}
	}

	b := env.GetDefaultInitBranch(mrEnv.Config())
	engineProvider, err := factory.NewProvider(ctx, b, mrEnv.FileSystem(), all, locations, config.EngineOverrides)
	if err != nil {
		return nil, err
	}

	// Extract the underlying *DoltDatabaseProvider for Dolt-specific configuration. For the
	// default DoltProviderFactory the result IS a *DoltDatabaseProvider; custom factories
	// (e.g. Doltgres) return a wrapper and implement DoltProviderUnwrapper to expose it.
	var pro *sqle.DoltDatabaseProvider
	switch p := engineProvider.(type) {
	case *sqle.DoltDatabaseProvider:
		pro = p
	case sqle.DoltProviderUnwrapper:
		pro = p.UnderlyingDoltProvider()
	default:
		return nil, fmt.Errorf("provider %T must be or wrap a *sqle.DoltDatabaseProvider", engineProvider)
	}

	pro.SetRemoteDialer(mrEnv.RemoteDialProvider())
	if config != nil && len(config.DBLoadParams) > 0 {
		pro.SetDBLoadParams(config.DBLoadParams)
	}

	config.ClusterController.RegisterStoredProcedures(pro)
	if config.ClusterController != nil {
		pro.InitDatabaseHooks = append(pro.InitDatabaseHooks, cluster.NewInitDatabaseHook(config.ClusterController, bThreads))
		pro.DropDatabaseHooks = append(pro.DropDatabaseHooks, config.ClusterController.DropDatabaseHook())
		config.ClusterController.SetDropDatabase(pro.DropDatabase)
	}

	sqlEngine := &SqlEngine{}
	// Create the engine
	engine := gms.New(analyzer.NewBuilder(engineProvider).AddOverrides(config.EngineOverrides).Build(), &gms.Config{
		IsReadOnly:     config.IsReadOnly,
		IsServerLocked: config.IsServerLocked,
	}).WithBackgroundThreads(bThreads)

	if err := configureBinlogPrimaryController(engine); err != nil {
		return nil, err
	}

	config.ClusterController.SetIsStandbyCallback(func(isStandby bool) {
		pro.SetIsStandby(isStandby)

		// Standbys are read only, primaries respect the config. Update both engine.ReadOnly and the read_only system
		// variable.
		readOnly := isStandby || config.IsReadOnly
		engine.ReadOnly.Store(readOnly)

		readOnlyInt := int8(0)
		if readOnly {
			readOnlyInt = 1
		}
		sql.SystemVariables.AssignValues(map[string]interface{}{
			"read_only": readOnlyInt,
		})
	})

	// Load in privileges from file, if it exists
	var persister cluster.AuthDbPersister
	persister = mysql_file_handler.NewPersister(config.PrivFilePath, config.DoltCfgDirPath)

	persister = config.ClusterController.HookMySQLDbPersister(persister, engine.Analyzer.Catalog.MySQLDb)
	data, err := persister.LoadData(ctx)
	if err != nil {
		return nil, err
	}

	// Load the branch control permissions, if they exist
	var bcController *branch_control.Controller
	if bcController, err = branch_control.LoadData(ctx, config.BranchCtrlFilePath, config.DoltCfgDirPath); err !=
```

### Core Architecture Module: `go/cmd/dolt/commands/engine/utils.go`
```
// Copyright 2021 Dolthub, Inc.
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

package engine

import (
	"context"
	"errors"
	"fmt"

	"github.com/dolthub/dolt/go/libraries/doltcore/env"
	"github.com/dolthub/dolt/go/libraries/doltcore/sqle"
	"github.com/dolthub/dolt/go/libraries/doltcore/sqle/dsess"
	"github.com/dolthub/dolt/go/libraries/doltcore/table/editor"
	"github.com/dolthub/dolt/go/libraries/utils/filesys"
)

// CollectDBs takes a MultiRepoEnv and creates Database objects from each environment and returns a slice of these
// objects.
func CollectDBs(ctx context.Context, mrEnv *env.MultiRepoEnv) ([]dsess.SqlDatabase, []filesys.Filesys, error) {
	var dbs []dsess.SqlDatabase
	var locations []filesys.Filesys
	var db dsess.SqlDatabase

	err := mrEnv.Iter(func(name string, dEnv *env.DoltEnv) (stop bool, err error) {
		db, err = newDatabase(ctx, name, dEnv)
		if err != nil {
			return false, err
		}

		dbs = append(dbs, db)
		locations = append(locations, dEnv.FS)

		return false, nil
	})

	if err != nil {
		return nil, nil, err
	}

	return dbs, locations, nil
}

func newDatabase(ctx context.Context, name string, dEnv *env.DoltEnv) (sqle.Database, error) {
	dbdata := dEnv.DbData(ctx)
	if !dEnv.Valid() {
		return sqle.Database{}, fmt.Errorf("failed to load database %q: %w", name, errors.Join(dEnv.CfgLoadErr, dEnv.RSLoadErr, dEnv.DBLoadError))
	}
	return sqle.NewDatabase(ctx, name, dbdata, editor.Options{})
}

```

### Core Architecture Module: `go/cmd/dolt/commands/sql_statement_scanner.go`
```
// Copyright 2020 Dolthub, Inc.
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

package commands

import (
	"bytes"
	"fmt"
	"io"
	"unicode"
)

const maxStatementBufferBytes = 100*1024*1024 + 4096
const pageSize = 2 << 11

const (
	sQuote    byte = '\''
	dQuote         = '"'
	backslash      = '\\'
	backtick       = '`'
	hyphen         = '-'
	asterisk       = '*'
	slash          = '/'
	newline        = '\n'
)

const delimPrefixLen = 10

var delimPrefix = []byte("delimiter ")

// StreamScanner is an iterator that reads bytes from |inp| until either
// (1) we match a DELIMITER statement, (2) we match the |delimiter| token,
// or (3) we EOF the file. After each Scan() call, the valid token will
// span from the buffer beginning to |state.end|.
type StreamScanner struct {
	inp       io.Reader
	err       error
	state     *qState
	buf       []byte
	delimiter []byte
	maxSize   int
	i         int // current byte pointer
	fill      int
	lineNum   int
	isEOF     bool
}

// NewStreamScanner returns a new StreamScanner
func NewStreamScanner(r io.Reader) *StreamScanner {
	return &StreamScanner{inp: r, buf: make([]byte, pageSize), maxSize: maxStatementBufferBytes, delimiter: []byte(";"), state: new(qState)}
}

type qState struct {
	start                          int
	end                            int // token end, usually i - len(delimiter)
	numConsecutiveBackslashes      int // the number of consecutive backslashes encountered
	numConsecutiveDelimiterMatches int // the consecutive number of characters that have been matched to the delimiter
	statementStartLine             int
	lineCommentStart               int
	quoteChar                      byte // the opening quote character of the current quote being parsed, or 0 if the current parse location isn't inside a quoted string
	lastChar                       byte // the last character parsed
	ignoreNextChar                 bool // whether to ignore the next character
	seenNonWhitespaceChar          bool // whether we have encountered a non-whitespace character since we returned the last token
	insideBlockComment             bool
	insideLineComment              bool
}

func (qs qState) insideComment() bool {
	return qs.insideLineComment || qs.insideBlockComment
}

func (qs qState) insideQuote() bool {
	return qs.quoteChar != 0
}

// ignoreDelimiters returns if delimiters should be ignored. If inside a comment or a quote, delimiters, including
// comment delimiters, should be ignored
func (qs qState) ignoreDelimiters() bool {
	return qs.insideComment() || qs.insideQuote()
}

func (s *StreamScanner) Scan() bool {
	s.resetState()

	if s.i >= s.fill {
		// initialize buffer
		if err := s.read(); err != nil {
			s.err = err
			return false
		}
	}

	if s.isEOF || s.i == s.fill {
		// no token
		return false
	}

	// discard leading whitespace
	if !s.skipWhitespace() {
		return false
	}
	s.truncate()

	s.state.statementStartLine = s.lineNum + 1

	if err, ok := s.isDelimiterExpr(); err != nil {
		s.err = err
		return false
	} else if ok {
		// empty token acks DELIMITER
		return true
	}

	for {
		if err, ok := s.seekDelimiter(); err != nil {
			s.err = err
			return false
		} else if ok {
			// delimiter found, scanner holds valid token state
			return true
		} else if s.isEOF && s.i == s.fill {
			// token terminates with file
			s.state.end = s.fill
			return true
		}
		// haven't found delimiter yet, keep reading
		if err := s.read(); err != nil {
			s.err = err
			return false
		}
	}
}

func (s *StreamScanner) skipWhitespace() bool {
	for {
		if s.i >= s.fill {
			if err := s.read(); err != nil {
				s.err = err
				return false
			}
		}
		if s.isEOF {
			return true
		}
		if !unicode.IsSpace(rune(s.buf[s.i])) {
			break
		}
		if s.buf[s.i] == '\n' {
			s.lineNum++
		}
		s.i++
	}
	return true
}

func (s *StreamScanner) truncate() {
	// copy size should be 4k or less
	s.state.start = s.i
	s.state.end = s.i
}

func (s *StreamScanner) resetState() {
	s.state = &qState{}
}

func (s *StreamScanner) read() error {
	if s.fill >= s.maxSize {
		// if script exceeds buffer that's OK, if
		// a single query exceeds buffer that's not OK
		if s.state.start == 0 {
			return fmt.Errorf("exceeded max query size")
		}
		// discard previous queries, resulting buffer will start
		// at the current |start|
		s.fill -= s.state.start
		s.i -= s.state.start
		s.state.end = s.state.start
		copy(s.buf[:], s.buf[s.state.start:])
		s.state.start = 0
		return s.read()
	}
	if s.fill == len(s.buf) {
		newBufSize := min(len(s.buf)*2, s.maxSize)
		newBuf := make([]byte, newBufSize)
		copy(newBuf, s.buf)
		s.buf = newBuf
	}
	n, err := s.inp.Read(s.buf[s.fill:])
	if err == io.EOF {
		s.isEOF = true
	} else if err != nil {
		return err
	}
	s.fill += n
	return nil
}

func (s *StreamScanner) Err() error {
	return s.err
}

func (s *StreamScanner) Bytes() []byte {
	return s.buf[s.state.start:s.state.end]
}

// Text returns the most recent token generated by a call to [Scanner.Scan]
// as a newly allocated string holding its bytes.
func (s *StreamScanner) Text() string {
	return string(s.Bytes())
}

func (s *StreamScanner) isDelimiterExpr() (error, bool) {
	if s.i == 0 && s.fill-s.i < delimPrefixLen {
		// need to see first |delimPrefixLen| characters
		if err := s.read(); err != nil {
			s.err = err
			return err, false
		}
	}

	// valid delimiter state machine check
	//  "DELIMITER " -> 0+ spaces -> <delimiter string> -> 1 space
	if s.fill-s.i >= delimPrefixLen && bytes.EqualFold(s.buf[s.i:s.i+delimPrefixLen], delimPrefix) {
		delimTokenIdx := s.i
		s.i += delimPrefixLen
		if !s.skipWhitespace() {
			return nil, false
		}
		if s.isEOF {
			// invalid delimiter
			s.i = delimTokenIdx
			return nil, false
		}
		delimStart := s.i
		for ; !s.isEOF && !unicode.IsSpace(rune(s.buf[s.i])); s.i++ {
			if s.i >= s.fill {
				if err := s.read(); err != nil {
					s.err = err
					return err, false
				}
			}
		}
		delimEnd := s.i
		s.delimiter = make([]byte, delimEnd-delimStart)
		copy(s.delimiter, s.buf[delimStart:delimEnd])

		// discard delimiter token, return empty token
		s.truncate()
		return nil, true
	}
	return nil, false
}

func (s *StreamScanner) seekDelimiter() (error, bool) {
	for ; s.i < s.fill; s.i++ {
		i := s.i
		if !s.state.ignoreNextChar {
			// this doesn't handle unicode characters correctly and will break on some things, but it's only used for line
			// number reporting.
			if !s.state.seenNonWhitespaceChar && !unicode.IsSpace(rune(s.buf[i])) {
				s.state.seenNonWhitespaceChar = true
			}

			// check if we've matched the delimiter string
			if !s.state.ignoreDelimiters() && s.buf[i] == s.delimiter[s.state.numConsecutiveDelimiterMatches] {
				s.state.numConsecutiveDelimiterMatches++
				if s.state.numConsecutiveDelimiterMatches == len(s.delimiter) {
					s.state.end = s.i - len(s.delimiter) + 1
					s.i++
					s.state.lastChar = 0
					return nil, true
				}
				s.state.lastChar = s.buf[i]
				continue
			} else {
				s.state.numConsecutiveDelimiterMatches = 0
			}

			switch s.buf[i] {
			case newline:
				s.lineNum++
				if s.state.insideLineComment {
					s.state.insideLineComment = false
					// if the entire statement is a line comment, truncate and return as empty
					if s.state.start == s.state.lineCommentStart {
						s.i++
						s.truncate()
						s.state.lastChar = 0
						return nil, true
					}
				}
			case hyphen:
				// If inside quote or already inside comment, ignore. Otherwise, if previous character is also a hyphen,
				// ie "--", begin line comment.
				if !s.state.ignoreDelimiters() && s.state.lastChar == hyphen {
					s.state.lineCommentStart = i - 1
					s.state.insideLineComment = true
				}
			case asterisk:
				// If inside quote or already inside comment, ignore. Otherwise, if previous character is a slash, ie
				// "/*", begin block comment.
				if !s.state.ignoreDelimiters() && s.state.lastChar == slash {
					s.state.insideBlockComment = true
				}
			case slash:
				// If previous character is an asterisk, ie "*/", end block comment.
				if s.state.insideBlockComment && s.state.lastChar == asterisk {
					s.state.insideBlockComment = false
				}
			case backslash:
				s.state.numConsecutiveBackslashes++
			case sQuote, dQuote, backtick:
				// ignore quotes inside comments
				if s.state.insideComment() {
					break
				}

				prevNumConsecutiveBackslashes := s.state.numConsecutiveBackslashes
				s.state.numConsecutiveBackslashes = 0

				// escaped quote character
				if s.state.lastChar == backslash && prevNumConsecutiveBackslashes%2 == 1 {
					break
				}

				// currently in a quoted string
				if s.state.insideQuote() {
					if i+1 >= s.fill {
						// require lookahead or EOF
						if err := s.read(); err != nil {
							return err, false
						}
					}

					// end quote or two consecutive quote characters (a form of escaping quote chars)
					if s.state.quoteChar == s.buf[i] {
						var nextChar byte = 0
						if i+1 < s.fill {
							nextChar = s.buf[i+1]
						}

						if nextChar == s.state.quoteChar {
							// escaped quote. skip the next character
							s.state.ignoreNextChar = true
						} else {
							// end quote
							s.state.quoteChar = 0
						}
					}

					// embedded quote ('"' or "'")
					break
				}

				// open quote
				s.state.quoteChar = s.buf[i]
			default:
				s.state.numConsecutiveBackslashes = 0
			}
		} else {
			s.state.ignoreNextChar = false
		}

		s.state.lastChar = s.buf[i]
	}
	return nil, false
}

```

### Core Architecture Module: `go/cmd/dolt/commands/sqlserver/queryist_utils.go`
```
// Copyright 2023 Dolthub, Inc.
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

package sqlserver

import (
	"context"
	"crypto/tls"
	sql2 "database/sql"
	"errors"
	"fmt"
	"io"
	"net"
	"regexp"
	"strings"

	"github.com/dolthub/go-mysql-server/sql"
	"github.com/dolthub/vitess/go/vt/sqlparser"
	"github.com/go-sql-driver/mysql"
	"github.com/gocraft/dbr/v2"
	"github.com/gocraft/dbr/v2/dialect"

	"github.com/dolthub/dolt/go/cmd/dolt/cli"
	"github.com/dolthub/dolt/go/cmd/dolt/commands/engine"
	"github.com/dolthub/dolt/go/libraries/doltcore/doltdb"
	"github.com/dolthub/dolt/go/libraries/doltcore/servercfg"
	"github.com/dolthub/dolt/go/libraries/doltcore/sqle/sqlutil"
	"github.com/dolthub/dolt/go/libraries/utils/argparser"
	"github.com/dolthub/dolt/go/libraries/utils/filesys"
)

type QueryistTLSMode int

const (
	QueryistTLSMode_Disabled QueryistTLSMode = iota
	// Require TLS, verify the server certificate using the system
	// trust store, do not allow fallback to plaintext.
	//
	// Used for `dolt --host ... sql ...` when `--no-tls-` is not
	// specified. Often used for connecting to Hosted DoltDB
	// instances using the CLI commands posted on
	// hosted.doltdb.com.
	QueryistTLSMode_Enabled
	// Used for local Dolt CLI queryist connecting to the running
	// local server. In this mode, TLS is allowed but not required
	// and the client does not verify the remote TLS
	// certificate. It is assumed connecting to the port locally
	// is secure and lands the client in the correct place, given
	// the contents of sql-server.info, for example.
	//
	// This mode still does not allow the Dolt CLI to connect to a
	// server which requires a client certificate.
	QueryistTLSMode_NoVerify_FallbackToPlaintext
)

// ErrServerConnectionFailed is returned when the late-binding
// queryist fails to connect to the sql-server.
var ErrServerConnectionFailed = errors.New("failed to connect to the dolt sql-server")

// BuildConnectionStringQueryist returns a [cli.LateBindQueryist]
// that opens a connection to the server at |host|:|port| using
// |creds| and |tlsMode|, and selects |dbRev| as the default
// database.
//
// |configName| and |configEmail| are used as the commit identity
// when the client connects over a loopback address. Non-loopback
// connections read the identity from CURRENT_USER() so the grant
// host matches whatever the server assigned.
func BuildConnectionStringQueryist(_ context.Context, cwdFS filesys.Filesys, creds *cli.UserPassword, apr *argparser.ArgParseResults, host string, port int, tlsMode QueryistTLSMode, dbRev string, configName, configEmail string) (cli.LateBindQueryist, error) {
	clientConfig, err := GetClientConfig(cwdFS, creds, apr)
	if err != nil {
		return nil, err
	}

	// ParseDSN currently doesn't support `/` in the db name
	dbName, _ := doltdb.SplitRevisionDbName(dbRev)
	parsedMySQLConfig, err := mysql.ParseDSN(servercfg.ConnectionString(clientConfig, dbName))
	if err != nil {
		return nil, err
	}

	parsedMySQLConfig.DBName = dbRev
	parsedMySQLConfig.Addr = fmt.Sprintf("%s:%d", host, port)

	switch tlsMode {
	case QueryistTLSMode_Disabled:
	case QueryistTLSMode_Enabled:
		parsedMySQLConfig.TLS = &tls.Config{}
	case QueryistTLSMode_NoVerify_FallbackToPlaintext:
		parsedMySQLConfig.TLS = &tls.Config{InsecureSkipVerify: true}
		parsedMySQLConfig.AllowFallbackToPlaintext = true
	}

	mysqlConnector, err := mysql.NewConnector(parsedMySQLConfig)
	if err != nil {
		return nil, err
	}

	conn := &dbr.Connection{DB: sql2.OpenDB(mysqlConnector), EventReceiver: nil, Dialect: dialect.MySQL}

	gatherWarnings := false
	queryist := ConnectionQueryist{connection: conn, gatherWarnings: &gatherWarnings}

	var lateBind cli.LateBindQueryist = func(ctx context.Context, opts ...cli.LateBindQueryistOption) (res cli.LateBindQueryistResult, err error) {
		if err := conn.DB.PingContext(ctx); err != nil {
			_ = conn.Close()
			return res, fmt.Errorf("%w at %s:%d: %w", ErrServerConnectionFailed, host, port, err)
		}

		sqlCtx := sql.NewContext(ctx)
		sqlCtx.SetCurrentDatabase(dbRev)

		ip := net.ParseIP(host)
		if host == "localhost" || (ip != nil && ip.IsLoopback()) {
			if err := engine.InitClientCommitIdentSession(queryist, sqlCtx, configName, configEmail); err != nil {
				cli.PrintErr(err.Error())
			}
		}

		res.Queryist = queryist
		res.Context = sqlCtx
		res.Closer = func() {
			conn.Close()
		}
		res.IsRemote = true
		return res, nil
	}

	return lateBind, nil
}

// ConnectionQueryist executes queries by connecting to a running mySql server.
type ConnectionQueryist struct {
	connection     *dbr.Connection
	gatherWarnings *bool
}

var _ cli.Queryist = &ConnectionQueryist{}

func (c ConnectionQueryist) EnableGatherWarnings() {
	*c.gatherWarnings = true
}

func (c ConnectionQueryist) Query(ctx *sql.Context, query string) (sql.Schema, sql.RowIter, *sql.QueryFlags, error) {
	rows, err := c.connection.QueryContext(ctx, query)
	if err != nil {
		return nil, nil, nil, err
	}

	rowIter, err := NewMysqlRowWrapper(rows)
	if err != nil {
		return nil, nil, nil, err
	}

	if c.gatherWarnings != nil && *c.gatherWarnings == true {
		ctx.ClearWarnings()

		re := regexp.MustCompile(`\s+`)
		noSpace := strings.TrimSpace(re.ReplaceAllString(query, " "))
		isShowWarnings := strings.EqualFold(noSpace, "show warnings")

		if !isShowWarnings {
			warnRows, err := c.connection.QueryContext(ctx, "show warnings")
			if err != nil {
				return nil, nil, nil, err
			}

			for warnRows.Next() {
				var code int
				var msg string
				var level string

				err = warnRows.Scan(&level, &code, &msg)
				if err != nil {
					return nil, nil, nil, err
				}

				ctx.Warn(code, "%s", msg)
			}
		}
	}

	return rowIter.Schema(ctx), rowIter, nil, nil
}

func (c ConnectionQueryist) QueryWithBindings(ctx *sql.Context, query string, _ sqlparser.Statement, _ map[string]sqlparser.Expr, _ *sql.QueryFlags) (sql.Schema, sql.RowIter, *sql.QueryFlags, error) {
	return c.Query(ctx, query)
}

type MysqlRowWrapper struct {
	rows    []sql.Row
	schema  sql.Schema
	numRows int
	curRow  int
}

var _ sql.RowIter = (*MysqlRowWrapper)(nil)

func NewMysqlRowWrapper(sqlRows *sql2.Rows) (*MysqlRowWrapper, error) {
	colTypes, err := sqlRows.ColumnTypes()
	if err != nil {
		return nil, err
	}
	schema := make(sql.Schema, len(colTypes))
	vRow := make([]*string, len(colTypes))
	iRow := make([]interface{}, len(colTypes))
	rows := make([]sql.Row, 0)
	for i, colType := range colTypes {
		schema[i] = &sql.Column{
			Name:     colType.Name(),
			Type:     sqlutil.DatabaseTypeNameToSqlType(colType.DatabaseTypeName()),
			Nullable: true,
		}
		iRow[i] = &vRow[i]
	}

	for sqlRows.Next() {
		err := sqlRows.Scan(iRow...)
		if err != nil {
			return nil, err
		}
		sqlRow := make(sql.Row, len(vRow))
		for i, val := range vRow {
			if val != nil {
				sqlRow[i] = *val
			}
		}

		rows = append(rows, sqlRow)
	}

	closeErr := sqlRows.Close()
	if closeErr != nil {
		return nil, err
	}

	return &MysqlRowWrapper{
		rows:    rows,
		schema:  schema,
		numRows: len(rows),
		curRow:  0,
	}, nil
}

func (s *MysqlRowWrapper) Schema(ctx *sql.Context) sql.Schema {
	return s.schema
}

func (s *MysqlRowWrapper) Next(*sql.Context) (sql.Row, error) {
	if s.NoMoreRows() {
		return nil, io.EOF
	}

	s.curRow++
	return s.rows[s.curRow-1], nil
}

func (s *MysqlRowWrapper) NoMoreRows() bool {
	return s.curRow >= s.numRows
}

func (s *MysqlRowWrapper) Close(*sql.Context) error {
	s.curRow = s.numRows
	return nil
}

```

### Core Architecture Module: `go/cmd/dolt/commands/utils.go`
```
// Copyright 2019 Dolthub, Inc.
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

package commands

import (
	"context"
	"crypto/sha1"
	"fmt"
	"io"
	"net"
	"os"
	"path/filepath"
	"strconv"
	"strings"
	"time"

	"github.com/dolthub/go-mysql-server/sql"
	"github.com/dolthub/go-mysql-server/sql/mysql_db"
	"github.com/dolthub/vitess/go/mysql"
	"github.com/fatih/color"
	"github.com/gocraft/dbr/v2"
	"github.com/gocraft/dbr/v2/dialect"
	"github.com/sirupsen/logrus"

	"github.com/dolthub/dolt/go/cmd/dolt/cli"
	"github.com/dolthub/dolt/go/cmd/dolt/commands/engine"
	"github.com/dolthub/dolt/go/cmd/dolt/errhand"
	"github.com/dolthub/dolt/go/libraries/doltcore/dconfig"
	"github.com/dolthub/dolt/go/libraries/doltcore/doltdb"
	"github.com/dolthub/dolt/go/libraries/doltcore/env"
	"github.com/dolthub/dolt/go/libraries/doltcore/env/actions"
	"github.com/dolthub/dolt/go/libraries/doltcore/sqle"
	"github.com/dolthub/dolt/go/libraries/doltcore/sqle/dsess"
	"github.com/dolthub/dolt/go/libraries/utils/argparser"
	"github.com/dolthub/dolt/go/libraries/utils/config"
	"github.com/dolthub/dolt/go/libraries/utils/editor"
	"github.com/dolthub/dolt/go/libraries/utils/filesys"
	"github.com/dolthub/dolt/go/store/chunks"
	"github.com/dolthub/dolt/go/store/datas"
	"github.com/dolthub/dolt/go/store/util/outputpager"
)

type CommitInfo struct {
	commitMeta        *datas.CommitMeta
	commitHash        string
	isHead            bool
	parentHashes      []string
	height            uint64
	localBranchNames  []string
	remoteBranchNames []string
	tagNames          []string
}

var fwtStageName = "fwt"

func GetWorkingWithVErr(dEnv *env.DoltEnv) (doltdb.RootValue, errhand.VerboseError) {
	working, err := dEnv.WorkingRoot(context.Background())

	if err != nil {
		return nil, errhand.BuildDError("Unable to get working.").AddCause(err).Build()
	}

	return working, nil
}

func GetStagedWithVErr(dEnv *env.DoltEnv) (doltdb.RootValue, errhand.VerboseError) {
	staged, err := dEnv.StagedRoot(context.Background())

	if err != nil {
		return nil, errhand.BuildDError("Unable to get staged.").AddCause(err).Build()
	}

	return staged, nil
}

func UpdateWorkingWithVErr(dEnv *env.DoltEnv, updatedRoot doltdb.RootValue) errhand.VerboseError {
	err := dEnv.UpdateWorkingRoot(context.Background(), updatedRoot)

	switch err {
	case doltdb.ErrNomsIO:
		return errhand.BuildDError("fatal: failed to write value").Build()
	case env.ErrStateUpdate:
		return errhand.BuildDError("fatal: failed to update the working root state").Build()
	}

	return nil
}

func MaybeGetCommitWithVErr(dEnv *env.DoltEnv, maybeCommit string) (*doltdb.Commit, errhand.VerboseError) {
	cm, err := actions.MaybeGetCommit(context.TODO(), dEnv, maybeCommit)

	if err != nil {
		bdr := errhand.BuildDError("fatal: Unable to read from data repository.")
		return nil, bdr.AddCause(err).Build()
	}

	return cm, nil
}

// NewArgFreeCliContext creates a new CliContext instance with no arguments using a local SqlEngine. This is useful for testing primarily
func NewArgFreeCliContext(ctx context.Context, dEnv *env.DoltEnv, cwd filesys.Filesys) (cli.CliContext, errhand.VerboseError) {
	mrEnv, err := env.MultiEnvForSingleEnv(ctx, dEnv)
	if err != nil {
		return nil, errhand.VerboseErrorFromError(err)
	}

	emptyArgs := argparser.NewEmptyResults()
	emptyArgs, creds, _ := cli.BuildUserPasswordPrompt(emptyArgs)
	lateBind, verr := BuildSqlEngineQueryist(ctx, dEnv.FS, mrEnv, creds, emptyArgs)

	if err != nil {
		return nil, verr
	}
	return cli.NewCliContext(argparser.NewEmptyResults(), dEnv.Config, cwd, lateBind)
}

// BuildSqlEngineQueryist Utility function to build a local SQLEngine for use interacting with data on disk using
// SQL queries. ctx, cwdFS, mrEnv, and apr must all be non-nil.
func BuildSqlEngineQueryist(ctx context.Context, cwdFS filesys.Filesys, mrEnv *env.MultiRepoEnv, creds *cli.UserPassword, apr *argparser.ArgParseResults) (cli.LateBindQueryist, errhand.VerboseError) {
	if ctx == nil || cwdFS == nil || mrEnv == nil || creds == nil || apr == nil {
		return nil, errhand.VerboseErrorFromError(fmt.Errorf("Invariant violated. Nil argument provided to BuildSqlEngineQueryist"))
	}

	// We want to know if the user provided us the data-dir flag, but we want to use the abs value used to
	// create the DoltEnv. This is a little messy.
	dataDir, dataDirGiven := apr.GetValue(DataDirFlag)
	dataDir, err := cwdFS.Abs(dataDir)
	if err != nil {
		return nil, errhand.VerboseErrorFromError(err)
	}

	// need to return cfgdirpath and error
	var cfgDirPath string
	cfgDir, cfgDirSpecified := apr.GetValue(CfgDirFlag)
	if cfgDirSpecified {
		cfgDirPath, err = cwdFS.Abs(cfgDir)
		if err != nil {
			return nil, errhand.VerboseErrorFromError(err)
		}
	} else if dataDirGiven {
		cfgDirPath = filepath.Join(dataDir, DefaultCfgDirName)
	} else {
		// Look in CWD parent directory for doltcfg
		parentDirCfg := filepath.Join("..", DefaultCfgDirName)
		parentExists, isDir := cwdFS.Exists(parentDirCfg)
		parentDirExists := parentExists && isDir

		// Look in data directory for doltcfg
		dataDirCfg := filepath.Join(dataDir, DefaultCfgDirName)
		dataDirCfgExists, isDir := cwdFS.Exists(dataDirCfg)
		currDirExists := dataDirCfgExists && isDir

		// Error if both CWD/../.doltcfg and dataDir/.doltcfg exist because it's unclear which to use.
		if currDirExists && parentDirExists {
			p1, err := cwdFS.Abs(dataDirCfg)
			if err != nil {
				return nil, errhand.VerboseErrorFromError(err)
			}
			p2, err := cwdFS.Abs(parentDirCfg)
			if err != nil {
				return nil, errhand.VerboseErrorFromError(err)
			}
			return nil, errhand.VerboseErrorFromError(ErrMultipleDoltCfgDirs.New(p1, p2))
		}

		// Assign the one that exists, defaults to current if neither exist
		if parentDirExists {
			cfgDirPath = parentDirCfg
		} else {
			cfgDirPath = dataDirCfg
		}
	}

	// If no privilege filepath specified, default to doltcfg directory
	privsFp, hasPrivsFp := apr.GetValue(PrivsFilePathFlag)
	if !hasPrivsFp {
		privsFp, err = cwdFS.Abs(filepath.Join(cfgDirPath, DefaultPrivsName))
		if err != nil {
			return nil, errhand.VerboseErrorFromError(err)
		}
	} else {
		privsFp, err = cwdFS.Abs(privsFp)
		if err != nil {
			return nil, errhand.VerboseErrorFromError(err)
		}
	}

	// If no branch control file path is specified, default to doltcfg directory
	branchControlFilePath, hasBCFilePath := apr.GetValue(BranchCtrlPathFlag)
	if !hasBCFilePath {
		branchControlFilePath, err = cwdFS.Abs(filepath.Join(cfgDirPath, DefaultBranchCtrlName))
		if err != nil {
			return nil, errhand.VerboseErrorFromError(err)
		}
	} else {
		branchControlFilePath, err = cwdFS.Abs(branchControlFilePath)
		if err != nil {
			return nil, errhand.VerboseErrorFromError(err)
		}
	}

	// Whether we're running in shell mode or some other mode, sql commands from the command line always have a current
	// database set when you begin using them.
	database, hasDB := apr.GetValue(UseDbFlag)
	useBranch, hasBranch := apr.GetValue(cli.BranchParam)
	if !hasDB {
		database = mrEnv.GetFirstDatabase()
	}
	if hasBranch {
		dbName, _ := doltdb.SplitRevisionDbName(database)
		database = dbName + "/" + useBranch
	}

	binder, err := newLateBindingEngine(cfgDirPath, privsFp, branchControlFilePath, creds, database, mrEnv)
	if err != nil {
		return nil, errhand.VerboseErrorFromError(err)
	}

	return binder, nil
}

func newLateBindingEngine(
	cfgDirPath string,
	privsFp string,
	branchControlFilePath string,
	creds *cli.UserPassword,
	database string,
	mrEnv *env.MultiRepoEnv,
) (cli.LateBindQueryist, error) {

	config := &engine.SqlEngineConfig{
		DoltCfgDirPath:     cfgDirPath,
		PrivFilePath:       privsFp,
		BranchCtrlFilePath: branchControlFilePath,
		ServerUser:         creds.Username,
		ServerPass:         creds.Password,
		ServerHost:         "localhost",
		Autocommit:         true,
	}

	var lateBinder cli.LateBindQueryist = func(ctx context.Context, opts ...cli.LateBindQueryistOption) (res cli.LateBindQueryistResult, err error) {
		// We've deferred loading the database as long as we can.
		// If we're binding the Queryist, that means that engine is actually
		// going to be used.
		mrEnv.ReloadDBs(ctx)

		queryistConfig := &cli.LateBindQueryistConfig{}
		for _, opt := range opts {
			opt(queryistConfig)
		}

		gcSch := os.Getenv("DOLT_GC_SCHEDULER")
		if queryistConfig.EnableAutoGC {
			// We use a null logger here, as we do not want `dolt sql` output
			// to include auto-gc log lines.
			nullLgr := logrus.New()
			nullLgr.SetOutput(io.Discard)
			config.AutoGCController = sqle.NewAutoGCController(chunks.SimpleArchive, chunks.IncrementalGCTablesDisabled, sqle.NewGCScheduler(gcSch), nullLgr)
		}

		se, err := engine.NewSqlEngine(
			ctx,
			mrEnv,
			config,
		)
		if err != nil {
			return res, err
		}

		if err := se.InitStats(ctx); err != nil {
			se.Close()
			return res, err
		}

		rawDb := se.GetUnderlyingEngine().Analyzer.Catalog.MySQLDb
		salt, err := mysql.NewSalt()
		if err != nil {
			se.Close()
			return res, err
		}

		var dbUser string
		if creds.Specified {
			dbUser = creds.Username

			// When running in local mode, we want to attempt respect the user/pwd they provided. If they didn't provide
			// one, we'll give then super user privs. Respecting the user/pwd is not a security stance - it's there
			// to enable testing of application settings.

			authResponse := buildAuthResponse(salt, config.ServerPass)

			// This engine runs in-process for the CLI, so the client really is local.
			err := passwordValidate
```

### Core Architecture Module: `go/cmd/dolt/errhand/panic_utils.go`
```
// Copyright 2019 Dolthub, Inc.
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

package errhand

import "fmt"

func PanicToVError(errMsg string, f func() VerboseError) VerboseError {
	var err VerboseError

	func() {
		defer func() {
			if r := recover(); r != nil {
				bdr := BuildDError("%s", errMsg)

				if recErr, ok := r.(error); ok {
					bdr.AddCause(recErr)
				} else {
					bdr.AddDetails("%s", fmt.Sprint(r))
				}

				err = bdr.Build()
			}
		}()
		err = f()
	}()

	return err
}

```

### Core Architecture Module: `go/libraries/doltcore/branch_control/access.go`
```
// Copyright 2022 Dolthub, Inc.
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

package branch_control

import (
	"fmt"
	"math"
	"strings"
	"sync"

	flatbuffers "github.com/dolthub/flatbuffers/v23/go"

	"github.com/dolthub/dolt/go/gen/fb/serial"
)

// Permissions are a set of flags that denote a user's allowed functionality on a branch.
type Permissions uint64

const (
	Permissions_Admin Permissions = 1 << iota // Permissions_Admin grants unrestricted control over a branch, including modification of table entries
	Permissions_Write                         // Permissions_Write allows for all modifying operations on a branch, but does not allow modification of table entries
	Permissions_Merge                         // Permissions_Merge allows for merging into this branch with dolt_merge, but does not allow for arbitrary writes.
	Permissions_Read                          // Permissions_Read allows for reading from a branch, which is equivalent to having no permissions

	Permissions_None Permissions = 0 // Permissions_None represents a lack of permissions, which defaults to allowing reading
)

// Access contains all of the expressions that comprise the "dolt_branch_control" table, which handles write Access to
// branches, along with write access to the branch control system tables.
type Access struct {
	Root     *MatchNode
	RWMutex  *sync.RWMutex
	binlog   *Binlog
	rows     []AccessRow
	freeRows []uint32
}

// AccessRow contains the user-facing values of a particular row, along with the permissions for a row.
type AccessRow struct {
	Database    string
	Branch      string
	User        string
	Host        string
	Permissions Permissions
}

// AccessRowIter is an iterator over all valid rows.
type AccessRowIter struct {
	access *Access
	idx    uint32
}

// newAccess returns a new Access.
func newAccess() *Access {
	return &Access{
		RWMutex: &sync.RWMutex{},
	}
}

// Match returns whether any entries match the given database, branch, user, and host, along with their permissions.
// This will match subsets against their superset as well. Requires external synchronization handling, therefore
// manually manage the RWMutex.
func (tbl *Access) Match(database string, branch string, user string, host string) (bool, Permissions) {
	return tbl.MatchIgnoringRow(database, branch, user, host, -1)
}

// MatchIgnoringRow returns whether any entries match the given database, branch, user, and host, along with their
// permissions. This will match subsets against their superset as well. If `rowToIgnore` is >= 0, then that row is
// ignored from the match results. Requires external synchronization handling, therefore manually manage the RWMutex.
func (tbl *Access) MatchIgnoringRow(database string, branch string, user string, host string, rowToIgnore int64) (bool, Permissions) {
	results := tbl.Root.Match(database, branch, user, host)
	// We use the result(s) with the longest length
	length := uint32(0)
	perms := Permissions_None
	for _, result := range results {
		if int64(result.RowIndex) == rowToIgnore {
			continue
		}
		if result.Length > length {
			perms = result.Permissions
			length = result.Length
		} else if result.Length == length {
			perms |= result.Permissions
		}
	}
	// Higher permissions imply lower ones: Admin > Write > Merge > Read.
	if perms&Permissions_Admin == Permissions_Admin {
		perms |= Permissions_Write | Permissions_Merge | Permissions_Read
	} else if perms&Permissions_Write == Permissions_Write {
		perms |= Permissions_Merge | Permissions_Read
	} else if perms&Permissions_Merge == Permissions_Merge {
		perms |= Permissions_Read
	}
	return len(results) > 0, perms
}

// ExactMatch returns whether any entries exactly match the given database, branch, user, and host. Returns nil if an
// exact match is not found. Requires external synchronization handling, therefore manually manage the RWMutex.
func (tbl *Access) ExactMatch(database string, branch string, user string, host string) *MatchNode {
	return tbl.Root.ExactMatch(database, branch, user, host)
}

// GetBinlog returns the table's binlog.
func (tbl *Access) GetBinlog() *Binlog {
	return tbl.binlog
}

// Serialize returns the offset for the Access table written to the given builder.
func (tbl *Access) Serialize(b *flatbuffers.Builder) flatbuffers.UOffsetT {
	// Serialize the binlog
	binlog := tbl.binlog.Serialize(b)
	serial.BranchControlAccessStart(b)
	serial.BranchControlAccessAddBinlog(b, binlog)
	return serial.BranchControlAccessEnd(b)
}

func (tbl *Access) reinit() {
	tbl.Root = &MatchNode{
		SortOrders: []int32{columnMarker},
		Children:   make(map[int32]*MatchNode),
		Data:       nil,
	}
	tbl.binlog = NewAccessBinlog(nil)
	tbl.rows = nil
	tbl.freeRows = nil
}

// Deserialize populates the table with the data from the flatbuffers representation.
func (tbl *Access) Deserialize(fb *serial.BranchControlAccess) error {
	// Read the binlog
	fbBinlog, err := fb.TryBinlog(nil)
	if err != nil {
		return err
	}
	binlog := NewAccessBinlog(nil)
	if err = binlog.Deserialize(fbBinlog); err != nil {
		return err
	}

	tbl.reinit()

	// Recreate the table from the binlog
	for _, binlogRow := range binlog.rows {
		if binlogRow.IsInsert {
			tbl.Insert(binlogRow.Database, binlogRow.Branch, binlogRow.User, binlogRow.Host, Permissions(binlogRow.Permissions))
		} else {
			tbl.Delete(binlogRow.Database, binlogRow.Branch, binlogRow.User, binlogRow.Host)
		}
	}
	return nil
}

// insertDefaultRow adds a row that allows all users to access and modify all branches, but does not allow them to
// modify any branch control tables. This was the default behavior of Dolt before the introduction of branch permissions.
func (tbl *Access) insertDefaultRow() {
	tbl.reinit()
	tbl.Insert("%", "%", "%", "%", Permissions_Write)
}

// Insert adds the given expressions to the table. This does not perform any sort of validation whatsoever, so it is
// important to ensure that the expressions are valid before insertion. Folds all strings that are given. Overwrites any
// existing entries with the new permissions. Requires external synchronization handling, therefore manually manage the
// RWMutex.
func (tbl *Access) Insert(database string, branch string, user string, host string, perms Permissions) {
	// Database, Branch, and Host are case-insensitive, while User is case-sensitive
	database = strings.ToLower(FoldExpression(database))
	branch = strings.ToLower(FoldExpression(branch))
	user = FoldExpression(user)
	host = strings.ToLower(FoldExpression(host))
	// Each expression is capped at 2¹⁶-1 values, so we truncate to 2¹⁶-2 and add the any-match character at the end if it's over
	if len(database) > math.MaxUint16 {
		database = string(append([]byte(database[:math.MaxUint16-1]), byte('%')))
	}
	if len(branch) > math.MaxUint16 {
		branch = string(append([]byte(branch[:math.MaxUint16-1]), byte('%')))
	}
	if len(user) > math.MaxUint16 {
		user = string(append([]byte(user[:math.MaxUint16-1]), byte('%')))
	}
	if len(host) > math.MaxUint16 {
		host = string(append([]byte(host[:math.MaxUint16-1]), byte('%')))
	}
	// Add the insertion entry to the binlog
	tbl.binlog.Insert(database, branch, user, host, uint64(perms))
	// Add to the rows and grab the insertion index
	var index uint32
	if len(tbl.freeRows) > 0 {
		index = tbl.freeRows[len(tbl.freeRows)-1]
		tbl.freeRows = tbl.freeRows[:len(tbl.freeRows)-1]
		tbl.rows[index] = AccessRow{
			Database:    database,
			Branch:      branch,
			User:        user,
			Host:        host,
			Permissions: perms,
		}
	} else {
		if len(tbl.rows) >= math.MaxUint32 {
			// If someone has this many branches in Dolt then they're doing something very interesting, we'll probably
			// fail elsewhere way before this point
			panic(fmt.Errorf("branch control has a maximum limit of %d branches", math.MaxUint32-1))
		}
		index = uint32(len(tbl.rows))
		tbl.rows = append(tbl.rows, AccessRow{
			Database:    database,
			Branch:      branch,
			User:        user,
			Host:        host,
			Permissions: perms,
		})
	}
	// Add the entry to the root node
	tbl.Root.Add(database, branch, user, host, MatchNodeData{
		Permissions: perms,
		RowIndex:    index,
	})
}

// Delete removes the given expressions from the table. This does not perform any sort of validation whatsoever, so it
// is important to ensure that the expressions are valid before deletion. Folds all strings that are given. Requires
// external synchronization handling, therefore manually manage the RWMutex.
func (tbl *Access) Delete(database string, branch string, user string, host string) {
	// Database, Branch, and Host are case-insensitive, while User is case-sensitive
	database = strings.ToLower(FoldExpression(database))
	branch = strings.ToLower(FoldExpression(branch))
	user = FoldExpression(user)
	host = strings.ToLower(FoldExpression(host))
	// Each expression is capped at 2¹⁶-1 values, so we truncate to 2¹⁶-2 and add the any-match character at the end if it's over
	if len(database) > math.MaxUint16 {
		database = string(append([]byte(database[:math.MaxUint16-1]), byte('%')))
	}
	if len(branch) > math.MaxUint16 {
		branch = string(append([]byte(branch[:math.MaxUint16-1]), byte('%')))
	}
	if len(user) > math.MaxUint16 {
		user = string(append([]byte(user[:math.MaxUint16-1]), byte('%')))
	}
	if len(host) > math.MaxUint16 {
		host = string(append([]byte(host[:math.MaxUint16-1]), byte('%')))
	}
	// Remove the entry from the root node
	removedIndex, success := tbl.Root.Remove(database, branch, user, host)
	// Ad
```

### Core Architecture Module: `go/libraries/doltcore/branch_control/binlog.go`
```
// Copyright 2022 Dolthub, Inc.
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

package branch_control

import (
	"fmt"
	"sync"

	flatbuffers "github.com/dolthub/flatbuffers/v23/go"

	"github.com/dolthub/dolt/go/gen/fb/serial"
)

//TODO: add stored procedure functions for modifying the binlog

// Binlog is a running log file that tracks changes to tables within branch control. This is used for history purposes,
// as well as transactional purposes through the use of the BinlogOverlay.
type Binlog struct {
	rows    []BinlogRow
	RWMutex *sync.RWMutex
}

// BinlogRow is a row within the Binlog.
type BinlogRow struct {
	IsInsert    bool
	Database    string
	Branch      string
	User        string
	Host        string
	Permissions uint64
}

// BinlogOverlay enables transactional use cases over Binlog. Unlike a Binlog, a BinlogOverlay requires external
// synchronization.
type BinlogOverlay struct {
	parentLength int
	rows         []BinlogRow
}

// NewAccessBinlog returns a new Binlog that represents the construction of the given Access values. May be used to
// truncate the Binlog's history.
func NewAccessBinlog(vals []AccessRow) *Binlog {
	rows := make([]BinlogRow, len(vals))
	for i, val := range vals {
		rows[i] = BinlogRow{
			IsInsert:    true,
			Database:    val.Database,
			Branch:      val.Branch,
			User:        val.User,
			Host:        val.Host,
			Permissions: uint64(val.Permissions),
		}
	}
	return &Binlog{
		rows:    rows,
		RWMutex: &sync.RWMutex{},
	}
}

// NewNamespaceBinlog returns a new Binlog that represents the construction of the given Namespace values. May be used
// to truncate the Binlog's history.
func NewNamespaceBinlog(vals []NamespaceValue) *Binlog {
	rows := make([]BinlogRow, len(vals))
	for i, val := range vals {
		rows[i] = BinlogRow{
			IsInsert:    true,
			Database:    val.Database,
			Branch:      val.Branch,
			User:        val.User,
			Host:        val.Host,
			Permissions: 0,
		}
	}
	return &Binlog{
		rows:    rows,
		RWMutex: &sync.RWMutex{},
	}
}

// Serialize returns the offset for the Binlog written to the given builder.
func (binlog *Binlog) Serialize(b *flatbuffers.Builder) flatbuffers.UOffsetT {
	binlog.RWMutex.RLock()
	defer binlog.RWMutex.RUnlock()

	// Initialize row offset slice
	rowOffsets := make([]flatbuffers.UOffsetT, len(binlog.rows))
	// Get each row's offset
	for i, row := range binlog.rows {
		rowOffsets[i] = row.Serialize(b)
	}
	// Get the row vector
	serial.BranchControlBinlogStartRowsVector(b, len(binlog.rows))
	for i := len(rowOffsets) - 1; i >= 0; i-- {
		b.PrependUOffsetT(rowOffsets[i])
	}
	rows := b.EndVector(len(binlog.rows))
	// Write the binlog
	serial.BranchControlBinlogStart(b)
	serial.BranchControlBinlogAddRows(b, rows)
	serial.BranchControlBinlogAddVersion(b, 1)
	return serial.BranchControlBinlogEnd(b)
}

// Deserialize populates the binlog with the data from the flatbuffers representation.
func (binlog *Binlog) Deserialize(fb *serial.BranchControlBinlog) error {
	binlog.RWMutex.Lock()
	defer binlog.RWMutex.Unlock()

	// Verify that the binlog is empty
	if len(binlog.rows) != 0 {
		return fmt.Errorf("cannot deserialize to a non-empty binlog")
	}
	// Initialize the rows
	version := fb.Version()
	binlog.rows = make([]BinlogRow, fb.RowsLength())
	// Read the rows
	for i := 0; i < fb.RowsLength(); i++ {
		serialBinlogRow := &serial.BranchControlBinlogRow{}
		_, err := fb.TryRows(serialBinlogRow, i)
		if err != nil {
			return fmt.Errorf("cannot deserialize binlog, it was created with a later version of Dolt")
		}
		perms := serialBinlogRow.Permissions()
		if version == 0 {
			perms = migratePermissionsV0(perms)
		}
		binlog.rows[i] = BinlogRow{
			IsInsert:    serialBinlogRow.IsInsert(),
			Database:    string(serialBinlogRow.Database()),
			Branch:      string(serialBinlogRow.Branch()),
			User:        string(serialBinlogRow.User()),
			Host:        string(serialBinlogRow.Host()),
			Permissions: perms,
		}
	}
	return nil
}

// Insert adds an insert entry to the Binlog.
func (binlog *Binlog) Insert(database string, branch string, user string, host string, permissions uint64) {
	binlog.RWMutex.Lock()
	defer binlog.RWMutex.Unlock()

	binlog.rows = append(binlog.rows, BinlogRow{
		IsInsert:    true,
		Database:    database,
		Branch:      branch,
		User:        user,
		Host:        host,
		Permissions: permissions,
	})
}

// Delete adds a delete entry to the Binlog.
func (binlog *Binlog) Delete(database string, branch string, user string, host string, permissions uint64) {
	binlog.RWMutex.Lock()
	defer binlog.RWMutex.Unlock()

	binlog.rows = append(binlog.rows, BinlogRow{
		IsInsert:    false,
		Database:    database,
		Branch:      branch,
		User:        user,
		Host:        host,
		Permissions: permissions,
	})
}

// Rows returns the underlying rows.
func (binlog *Binlog) Rows() []BinlogRow {
	return binlog.rows
}

// migratePermissionsV0 remaps permissions from v0 (pre-merge-permission) format.
// In v0: Admin=1, Write=2, Read=4. In v1: Admin=1, Write=2, Merge=4, Read=8.
// Bit 2 (value 4) meant Read in v0 but means Merge in v1, so we shift it to bit 3.
func migratePermissionsV0(perms uint64) uint64 {
	const oldRead = uint64(4)
	const newRead = uint64(8)
	if perms&oldRead != 0 {
		perms = (perms &^ oldRead) | newRead
	}
	return perms
}

// Serialize returns the offset for the BinlogRow written to the given builder.
func (row *BinlogRow) Serialize(b *flatbuffers.Builder) flatbuffers.UOffsetT {
	database := b.CreateSharedString(row.Database)
	branch := b.CreateSharedString(row.Branch)
	user := b.CreateSharedString(row.User)
	host := b.CreateSharedString(row.Host)

	serial.BranchControlBinlogRowStart(b)
	serial.BranchControlBinlogRowAddIsInsert(b, row.IsInsert)
	serial.BranchControlBinlogRowAddDatabase(b, database)
	serial.BranchControlBinlogRowAddBranch(b, branch)
	serial.BranchControlBinlogRowAddUser(b, user)
	serial.BranchControlBinlogRowAddHost(b, host)
	serial.BranchControlBinlogRowAddPermissions(b, row.Permissions)
	return serial.BranchControlBinlogRowEnd(b)
}

```

### Core Architecture Module: `go/libraries/doltcore/branch_control/branch_control.go`
```
// Copyright 2022 Dolthub, Inc.
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

package branch_control

import (
	"context"
	goerrors "errors"
	"fmt"
	"os"
	"strings"
	"sync/atomic"

	flatbuffers "github.com/dolthub/flatbuffers/v23/go"
	"github.com/dolthub/go-mysql-server/sql"
	"gopkg.in/src-d/go-errors.v1"

	"github.com/dolthub/dolt/go/gen/fb/serial"
	"github.com/dolthub/dolt/go/libraries/utils/filesys"
)

var (
	ErrIncorrectPermissions  = errors.NewKind("`%s`@`%s` does not have the correct permissions on branch `%s`")
	ErrCannotCreateBranch    = errors.NewKind("`%s`@`%s` cannot create a branch named `%s`")
	ErrCannotDeleteBranch    = errors.NewKind("`%s`@`%s` cannot delete the branch `%s`")
	ErrExpressionsTooLong    = errors.NewKind("expressions are too long [%q, %q, %q, %q]")
	ErrInsertingAccessRow    = errors.NewKind("`%s`@`%s` cannot add the row [%q, %q, %q, %q, %q]")
	ErrInsertingNamespaceRow = errors.NewKind("`%s`@`%s` cannot add the row [%q, %q, %q, %q]")
	ErrUpdatingRow           = errors.NewKind("`%s`@`%s` cannot update the row [%q, %q, %q, %q]")
	ErrUpdatingToRow         = errors.NewKind("`%s`@`%s` cannot update the row [%q, %q, %q, %q] to the new branch expression [%q, %q]")
	ErrDeletingRow           = errors.NewKind("`%s`@`%s` cannot delete the row [%q, %q, %q, %q]")
	ErrMissingController     = errors.NewKind("a context has a non-nil session but is missing its branch controller")
)

// Context represents the interface that must be inherited from the context.
type Context interface {
	GetBranch() (string, error)
	GetCurrentDatabase() string
	GetUser() string
	GetHost() string
	GetPrivilegeSet() (sql.PrivilegeSet, uint64)
	GetController() *Controller
	GetFileSystem() filesys.Filesys
}

// Controller is the central hub for branch control functions. This is passed within a context.
type Controller struct {
	Access    *Access
	Namespace *Namespace

	Serialized atomic.Pointer[[]byte]

	// A callback which we call when we successfully save new data.
	// The new data will be available in |Serialized|.
	SavedCallback func(context.Context)

	branchControlFilePath string
	doltConfigDirPath     string
}

// CreateDefaultController returns a default controller, which only has a single entry allowing all users to have write
// permissions on all branches (only the super user has admin, if a super user has been set). This is equivalent to
// passing empty strings to LoadData.
func CreateDefaultController(ctx context.Context) *Controller {
	controller, err := LoadData(ctx, "", "")
	if err != nil {
		panic(err) // should never happen
	}
	return controller
}

// LoadData loads the data from the given location and returns a controller. Returns the default controller if the
// `branchControlFilePath` is empty.
func LoadData(ctx context.Context, branchControlFilePath string, doltConfigDirPath string) (*Controller, error) {
	accessTbl := newAccess()
	controller := &Controller{
		Access:                accessTbl,
		Namespace:             newNamespace(accessTbl),
		branchControlFilePath: branchControlFilePath,
		doltConfigDirPath:     doltConfigDirPath,
	}

	// Do not attempt to load from an empty file path
	if len(branchControlFilePath) == 0 {
		// If the path is empty, then we should populate the controller with the default row to ensure normal (expected) operation
		controller.Access.insertDefaultRow()
		return controller, nil
	}

	data, err := os.ReadFile(branchControlFilePath)
	if err != nil && !goerrors.Is(err, os.ErrNotExist) {
		return nil, err
	}

	err = controller.LoadData(ctx, data /* isFirstLoad */, true)
	if err != nil {
		return nil, fmt.Errorf("failed to deserialize config at '%s': %w", branchControlFilePath, err)
	}
	return controller, nil
}

func (controller *Controller) LoadData(ctx context.Context, data []byte, isFirstLoad bool) error {
	controller.Access.RWMutex.Lock()
	defer controller.Access.RWMutex.Unlock()

	// Nothing to load so we can return
	if len(data) == 0 {
		// As there is nothing to load, we should populate the controller with the default row to ensure normal (expected) operation
		controller.Access.insertDefaultRow()
		controller.Serialized.Store(&data)
		if controller.SavedCallback != nil {
			controller.SavedCallback(ctx)
		}
		return nil
	}
	// Load the tables
	if serial.GetFileID(data) != serial.BranchControlFileID {
		return fmt.Errorf("unable to deserialize branch controller, unknown file ID `%s`", serial.GetFileID(data))
	}
	bc, err := serial.TryGetRootAsBranchControl(data, serial.MessagePrefixSz)
	if err != nil {
		return err
	}
	access, err := bc.TryAccessTbl(nil)
	if err != nil {
		return err
	}
	namespace, err := bc.TryNamespaceTbl(nil)
	if err != nil {
		return err
	}

	rollback := controller.Serialized.Load()

	// TODO: Better concurrency control here. We see |Namespace| and
	// |Access| in different views of the data here.

	// The Deserialize functions acquire write locks, so we don't acquire them here
	if err = controller.Access.Deserialize(access); err != nil {
		// TODO: More principaled rollback. Hopefully this does not fail.
		if rollback != nil {
			_ = controller.LoadData(ctx, *rollback, isFirstLoad)
		}
		return err
	}
	if err = controller.Namespace.Deserialize(namespace); err != nil {
		// TODO: More principaled rollback. Hopefully this does not fail.
		if rollback != nil {
			_ = controller.LoadData(ctx, *rollback, isFirstLoad)
		}
		return err
	}

	controller.Serialized.Store(&data)
	if controller.SavedCallback != nil {
		controller.SavedCallback(ctx)
	}

	return nil
}

// SaveData saves the data from the context's controller to the location pointed by it.
func SaveData(ctx context.Context) error {
	branchAwareSession := GetBranchAwareSession(ctx)
	// A nil session means we're not in the SQL context, so we've got nothing to serialize
	if branchAwareSession == nil {
		return nil
	}
	controller := branchAwareSession.GetController()
	// If there is no controller in the context, then we have nothing to serialize
	if controller == nil {
		return nil
	}

	return controller.SaveData(ctx, branchAwareSession.GetFileSystem())
}

func (controller *Controller) SaveData(ctx context.Context, fs filesys.Filesys) error {
	// If we never set a save location then we just return
	if len(controller.branchControlFilePath) == 0 {
		return nil
	}

	// Create the doltcfg directory if it doesn't exist
	if len(controller.doltConfigDirPath) != 0 {
		if mkErr := fs.MkDirs(controller.doltConfigDirPath); mkErr != nil {
			return mkErr
		}
	}

	controller.Access.RWMutex.Lock()
	defer controller.Access.RWMutex.Unlock()

	b := flatbuffers.NewBuilder(1024)
	// The Serialize functions acquire read locks, so we don't acquire them here
	accessOffset := controller.Access.Serialize(b)
	namespaceOffset := controller.Namespace.Serialize(b)
	serial.BranchControlStart(b)
	serial.BranchControlAddAccessTbl(b, accessOffset)
	serial.BranchControlAddNamespaceTbl(b, namespaceOffset)
	root := serial.BranchControlEnd(b)
	// serial.FinishMessage() limits files to 2^24 bytes, so this works around it while maintaining read compatibility
	b.Prep(1, flatbuffers.SizeInt32+4+serial.MessagePrefixSz)
	b.FinishWithFileIdentifier(root, []byte(serial.BranchControlFileID))
	data := b.Bytes[b.Head()-serial.MessagePrefixSz:]

	err := fs.WriteFile(controller.branchControlFilePath, data, 0660)
	if err != nil {
		return err
	}

	controller.Serialized.Store(&data)
	if controller.SavedCallback != nil {
		controller.SavedCallback(ctx)
	}
	return nil
}

// CheckAccess returns whether the given context has the correct permissions on its selected branch. In general, SQL
// statements will almost always return a *sql.Context, so any checks from the SQL path will correctly check for branch
// permissions. However, not all CLI commands use *sql.Context, and therefore will not have any user associated with
// the context. In these cases, CheckAccess will pass as we want to allow all local commands to ignore branch
// permissions.
func CheckAccess(ctx context.Context, flags Permissions) error {
	branchAwareSession := GetBranchAwareSession(ctx)
	// A nil session means we're not in the SQL context, so we allow all operations
	if branchAwareSession == nil {
		return nil
	}
	controller := branchAwareSession.GetController()
	// Any context that has a non-nil session should always have a non-nil controller, so this is an error
	if controller == nil {
		return ErrMissingController.New()
	}
	controller.Access.RWMutex.RLock()
	defer controller.Access.RWMutex.RUnlock()

	user := branchAwareSession.GetUser()
	host := branchAwareSession.GetHost()
	database := getDatabaseNameOnly(branchAwareSession.GetCurrentDatabase())
	branch, err := branchAwareSession.GetBranch()
	if err != nil {
		return err
	}
	// Get the permissions for the branch, user, and host combination
	_, perms := controller.Access.Match(database, branch, user, host)
	if perms&flags == flags {
		return nil
	}
	return ErrIncorrectPermissions.New(user, host, branch)
}

// CanCreateBranch returns whether the given context can create a branch with the given name. In general, SQL statements
// will almost always return a *sql.Context, so any checks from the SQL path will be able to validate a branch's name.
// However, not all CLI commands use *sql.Context, and therefore will not have any user associated with the context. In
// these cases, CanCreateBranch will pass as we want to allow all local commands to freely create branches.
func CanCreateBranch(ctx context.Context, branchName string) er
```

### Core Architecture Module: `go/libraries/doltcore/branch_control/expr_parser.go`
```
// Copyright 2022 Dolthub, Inc.
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

package branch_control

import (
	"math"
	"sync"
	"unicode/utf8"

	flatbuffers "github.com/dolthub/flatbuffers/v23/go"
	"github.com/dolthub/go-mysql-server/sql"

	"github.com/dolthub/dolt/go/gen/fb/serial"
)

const (
	singleMatch  = -1 // Equivalent to the single match character '_'
	anyMatch     = -2 // Equivalent to the any-length match character '%'
	columnMarker = -3 // Marks the start of a new column
)

// invalidMatchExpression is a match expression that does not match anything
var invalidMatchExpression = MatchExpression{math.MaxUint32, nil}

// matchExprPool is a pool for MatchExpression slices. Provides a significant performance benefit.
var matchExprPool = &sync.Pool{
	New: func() any {
		return make([]MatchExpression, 0, 32)
	},
}

// indexPool is a pool for index slices (such as those returned by Match). Provides a decent performance benefit.
var indexPool = &sync.Pool{
	New: func() any {
		return make([]uint32, 0, 32)
	},
}

// MatchExpression represents a parsed expression that may be matched against. It contains a list of sort orders, which
// each represent a comparable value to determine whether any given character is a match. A character's sort order is
// obtained from a collation. Also contains its index in the table. MatchExpression contents are not meant to be
// comparable to one another, therefore please use the index to compare equivalence.
type MatchExpression struct {
	CollectionIndex uint32  // CollectionIndex represents this expression's index in its parent slice.
	SortOrders      []int32 // These are the sort orders that will be compared against when matching a given rune.
}

// FoldExpression folds the given expression into its smallest form. Expressions have two wildcard operators:
// '_' and '%'. '_' matches exactly one character, and it can be any character. '%' can match zero or more of any
// character. Taking these two ops into account, the configurations "%_" and "_%" both resolve to matching one or more
// of any character. However, the "_%" form is more economical, as you enforce the single match first before checking
// for remaining matches. Similarly, "%%" is equivalent to a single '%'. Both of these rules are applied in this
// function, guaranteeing that the returned expression is the smallest form that still exactly represents the original.
//
// This also assumes that '\' is the escape character.
func FoldExpression(str string) string {
	// This loop only terminates when we complete a run where no substitutions were made. Substitutions are applied
	// linearly, therefore it's possible that one substitution may create an opportunity for another substitution.
	// To keep the code simple, we continue looping until we have nothing more to do.
	for true {
		newStrRunes := make([]rune, 0, len(str))
		// Skip next is set whenever we encounter the escape character, which is used to explicitly match against '_' and '%'
		skipNext := false
		// Consider next is set whenever we encounter an unescaped '%', indicating we may need to apply the substitutions
		considerNext := false
		for _, r := range str {
			if skipNext {
				skipNext = false
				newStrRunes = append(newStrRunes, r)
				continue
			} else if considerNext {
				considerNext = false
				switch r {
				case '\\':
					newStrRunes = append(newStrRunes, '%', r) // False alarm, reinsert % before this rune
					skipNext = true                           // We also need to ignore the next rune
				case '_':
					newStrRunes = append(newStrRunes, r, '%') // Replacing %_ with _%
				case '%':
					newStrRunes = append(newStrRunes, r) // Replacing %% with %
				default:
					newStrRunes = append(newStrRunes, '%', r) // False alarm, reinsert % before this rune
				}
				continue
			}

			switch r {
			case '\\':
				newStrRunes = append(newStrRunes, r)
				skipNext = true
			case '%':
				considerNext = true
			default:
				newStrRunes = append(newStrRunes, r)
			}
		}
		// If the very last rune is '%', then this will be true and we need to append it to the end
		if considerNext {
			newStrRunes = append(newStrRunes, '%')
		}
		newStr := string(newStrRunes)
		if str == newStr {
			break
		}
		str = newStr
	}
	return str
}

// ParseExpression parses the given string expression into a slice of sort ints, which will be used in a MatchExpression.
// Returns nil if the string is too long. Assumes that the given string expression has already been folded.
func ParseExpression(str string, collation sql.CollationID) []int32 {
	if len(str) > math.MaxUint16 {
		return nil
	}

	sortFunc := collation.Sorter()
	var orders []int32
	escaped := false
	for _, r := range str {
		if escaped {
			escaped = false
			orders = append(orders, sortFunc(r))
		} else {
			switch r {
			case '\\':
				escaped = true
			case '%':
				orders = append(orders, anyMatch)
			case '_':
				orders = append(orders, singleMatch)
			default:
				orders = append(orders, sortFunc(r))
			}
		}
	}
	return orders
}

// Match takes the match expression collection, and returns a slice of which collection indexes matched against the
// given string. The given indices may be used to further reduce the match expression collection, which will also reduce
// the total number of comparisons as they're narrowed down.
//
// It is vastly more performant to return a slice of collection indexes here, rather than a slice of match expressions.
// This is true even when the match expressions are pooled. The reason is unknown, but as we only need the collection
// indexes anyway, we discard the match expressions and return only their indexes.
func Match(matchExprCollection []MatchExpression, str string, collation sql.CollationID) []uint32 {
	sortFunc := collation.Sorter()
	// Grab the first rune and also remove it from the string
	r, rSize := utf8.DecodeRuneInString(str)
	str = str[rSize:]
	// Grab a slice from the pool, which reduces the GC pressure.
	matchSubset := matchExprPool.Get().([]MatchExpression)[:0]
	// We do a pass using the first rune over all expressions to get the subset that we'll be testing against
	for _, testExpr := range matchExprCollection {
		if matched, next, extra := testExpr.Matches(sortFunc(r)); matched {
			if extra.IsValid() {
				matchSubset = append(matchSubset, next, extra)
			} else {
				matchSubset = append(matchSubset, next)
			}
		}
	}
	// Bail early if there are no matches here
	if len(matchSubset) == 0 {
		matchExprPool.Put(matchSubset)
		// We return a slice from the index pool as we later will return it to the pool. We don't want to stick a
		// nil/empty slice into the pool.
		return indexPool.Get().([]uint32)[:0]
	}

	// This is the slice that we'll put matches into. This will also flip to become the match subset. This way we reuse
	// the underlying arrays. We also grab this from the pool.
	matches := matchExprPool.Get().([]MatchExpression)[:0]
	// Now that we have our set of expressions to test, we loop over the remainder of the input string
	for _, r = range str {
		for _, testExpr := range matchSubset {
			if matched, next, extra := testExpr.Matches(sortFunc(r)); matched {
				if extra.IsValid() {
					matches = append(matches, next, extra)
				} else {
					matches = append(matches, next)
				}
			}
		}
		// Swap the two, and put the slice of matches to be at the beginning of the previous subset array to reuse it
		matches, matchSubset = matchSubset[:0], matches
	}
	matchExprPool.Put(matches)

	// Grab the indices of all valid matches
	validMatches := indexPool.Get().([]uint32)[:0]
	for _, match := range matchSubset {
		if match.IsAtEnd() && (len(validMatches) == 0 ||
			(len(validMatches) > 0 && match.CollectionIndex != validMatches[len(validMatches)-1])) {
			validMatches = append(validMatches, match.CollectionIndex)
		}
	}
	matchExprPool.Put(matchSubset)
	return validMatches
}

// Matches returns true when the given sort order matches the expectation of the calling match expression. Returns a
// reduced match expression as `next`, which should take the place of the calling match function. In the event of a
// branch, returns the branching match expression as `extra`.
//
// Branches occur when the '%' operator sees that the given sort order matches the sort order after the '%'. As it
// cannot be determined which path is the correct one (whether to consume the '%' or continue using it), a branch is
// created. The `extra` should be checked for validity by calling IsValid.
func (matchExpr MatchExpression) Matches(sortOrder int32) (matched bool, next MatchExpression, extra MatchExpression) {
	if len(matchExpr.SortOrders) == 0 {
		return false, invalidMatchExpression, invalidMatchExpression
	}
	switch matchExpr.SortOrders[0] {
	case singleMatch:
		if sortOrder < singleMatch {
			return false, invalidMatchExpression, invalidMatchExpression
		}
		return true, MatchExpression{matchExpr.CollectionIndex, matchExpr.SortOrders[1:]}, invalidMatchExpression
	case anyMatch:
		if len(matchExpr.SortOrders) > 1 && matchExpr.SortOrders[1] == sortOrder {
			return true, matchExpr, MatchExpression{matchExpr.CollectionIndex, matchExpr.SortOrders[2:]}
		}
		return true, matchExpr, invalidMatchExpression
	default:
		if sortOrder == matchExpr.SortOrders[0] {
			return true, MatchExpression{matchExpr.CollectionIndex, matchExpr.SortOrders[1:]}, invalidMatchExpression
		} else {
			return false, invalidMatchExpression, invalidMatchExpression
		}
	}
}

// IsValid returns whether th
```


### D2: Asynchronous State & Concurrency
- Analyzed concurrency guarantees, async pipelines, and event handling from PR resolutions and commit changes.

### D3: Error Boundaries, Recovery & Rollbacks
- Exception handling patterns and defect resolutions extracted from closed production bug issues:
- **Issue #12011** (2026-10-02): **sql-server: git remotes with the same URL but different `--ref` share one ref — a push from one database overwrites another database's data**
  *Symptoms*: ### Summary Two databases served by the same `dolt sql-server`, both with a git remote pointing at the **same repository URL** but different `--ref` values (`refs/dolt/db1`, `refs/dolt/db2`), are not isolated. `dolt_remotes.params` correctly shows `{"git_ref": "refs/dolt/db2"}` for db2, but the server behaves as if db2 used db1's ref:  - `dolt_fetch` from db2 returns db1's head (`refs/dolt/db2` does not exist yet). - `dolt_push --force` from db2 **overwrites `refs/dolt/db1`**; `refs/dolt/db2` is never created. - A fresh `dolt clone --ref refs/dolt/db1` then contains db2's tables — db1's remote data is lost.  The same steps run as separate `dolt sql` CLI processes (no server) behave correctly: db2's fetch finds nothing, its push creates `refs/dolt/db2`, `refs/dolt/db1` is untouched. So this looks like the server reusing one remote/blobstore handle per URL and ignoring `git_ref` (possibly the git remote cache from #11141).  ### Repro (self-contained, uses a local bare repo) ```sh #!/bin/sh # Two databases in one dolt sql-server, both using the SAME git remote URL # with different --ref values. Expected: each database reads/writes only its own ref. set -e W=$(mktemp -d); cd "$W"; PORT=${PORT:-33071}  git init -q --bare hub.git git init -q seed && git -C seed commit -q --allow-empty -m init && git -C seed push -q "$W/hub.git" HEAD:main  mkdir srv && cd srv for d in db1 db2; do   mkdir $d && (cd $d && dolt init --name t --email t@t >/dev/null &&     dolt sql -q "create table t_$d(
  **Post-Mortem & Fix Analysis**:
  > Hi @chhh, thanks for the report I've assigned @coffeegoddd to work on this.

- **Issue #11997** (2026-10-03): **unable to find global table at overridden schema root**
  *Symptoms*: Hi,  We have some global tables, established with something like:  ``` CALL DOLT_CHECKOUT('main'); INSERT INTO dolt_nonlocal_tables (table_name, target_ref, options) VALUES ('global_*', 'main', 'immediate'); INSERT INTO dolt_ignore (pattern, ignored) VALUES ('global_*', true); CALL DOLT_ADD('dolt_nonlocal_tables', 'dolt_ignore'); CALL DOLT_COMMIT('-m', 'Initialize dolt_nonlocal_tables and dolt_ignore system tables', '--author', '...'); ```  Following https://www.dolthub.com/blog/2025-10-06-nonlocal-tables/. In this example, I have a table named `global_change`.  We are considering enabling schema overrides on some connections. When I then try to select from a global table, though, I get an error, with the following mysql terminal input/output:  ``` mysql> select count(*) from global_change; +----------+ | count(*) | +----------+ |       22 | +----------+ 1 row in set (0.00 sec)  mysql> set @@dolt_override_schema='main'; Query OK, 0 rows affected (0.00 sec)  mysql> select count(*) from global_change; ERROR 1105 (HY000): unable to find table 'global_change' at overridden schema root ```  I expect that the global tables would still be readable when the schema is overridden.  Thoughts?  Cheers, Luke
  **Post-Mortem & Fix Analysis**:
  > Thanks, Luke. We've reproduced this and am assigning @fulghum to look into this for you.
  > Hi @lkp80877984 , thanks for using Dolt and filing an issue. We'd love to learn about your use case if you are able to share. Feel free to [email me](mailto:brianf@dolthub.com) or swing by our [Discord](https://discord.gg/gqr7K4VNKe) if you can.
  > He's one of ours @bpf120 - Gerry @ Wtg :)

- **Issue #11995** (2026-10-02): **Creating a table that matches a dolt_nonlocal_tables rule fails on the rule's target branch, depending on how the primary key is declared**
  *Symptoms*: ## Description  Once a `dolt_nonlocal_tables` rule exists, `CREATE TABLE` for a matching name is rejected — including on the rule's own `target_ref` branch, where the table isn't redirected anywhere:  ``` Cannot create table name global_a because it matches a name present in dolt_nonlocal_tables. ```  The same table succeeds if the primary key is declared as a named table-level constraint. So whether creation is allowed depends on the DDL form, not on the table.  Reproduced on 2.4.0.  ## Steps to reproduce  ```sql CREATE DATABASE db; USE db;  INSERT INTO dolt_nonlocal_tables (table_name, target_ref, options)   VALUES ('global_*', 'main', 'immediate'); CALL DOLT_ADD('-A'); CALL DOLT_COMMIT('-m', 'add nonlocal rule');  -- on main (the rule's target_ref):  CREATE TABLE global_a (id INT PRIMARY KEY); -- ERROR: Cannot create table name global_a because it matches a name present in dolt_nonlocal_tables.  CREATE TABLE global_b (id INT, CONSTRAINT pk_b PRIMARY KEY (id)); -- succeeds ```  ## Expected  Both statements behave the same way. Ideally, creating a matching table is allowed on the rule's `target_ref` branch, since that's where the nonlocal table actually lives. On other branches it's reasonable to reject it, because a local table there would be hidden by the rule.  We rely on creating these tables on `main` (via migrations) and need that to keep working. 
  **Post-Mortem & Fix Analysis**:
  > Hi @dtminnaar, we have a reproduction on this and are working on a fix!
  > Fix is in #12002, I'm just waiting on review.

- **Issue #11968** (2026-10-01): **WHERE returns a row for an IN predicate that evaluates to FALSE**
  *Symptoms*: ## Summary  Dolt returns a row from a `WHERE ... IN (...)` query even though the same `IN` expression evaluates to `FALSE` for that row when selected as a projected expression.  The issue reproduces with an `INT` column and a mixed integer/fractional numeric list. The table has no indexes.  ## Environment  - Dolt versions tested: 2.3.2 and 2.3.4 - OS: Windows x64  ## Steps to Reproduce  Run the following SQL in a Dolt database:  ```sql CREATE DATABASE dolt_in_fractional_repro; USE dolt_in_fractional_repro;  CREATE TABLE t (v INT) ENGINE=InnoDB; INSERT INTO t VALUES (0), (9);  SELECT v, v IN (9, 0.49) AS in_result FROM t ORDER BY v;  SELECT v FROM t WHERE v IN (9, 0.49) ORDER BY v; ``` ## Expected Result The first query returns:  | v | in_result | |---|---| | 0 | 0 | | 9 | 1 |  Since the predicate is false for v = 0, the second query should return only: v 9 ## Actual Result On Dolt 2.3.2 and 2.3.4, the first query returns the expected projected predicate values, but the second query returns both rows: v 0 9 Thus, WHERE v IN (9, 0.49) includes v = 0, even though the same predicate evaluates to FALSE for that row in the projection.  Additionally，the same reproducer returns only 9 on MySQL 8.0.46, MySQL 8.4.7, and MariaDB 12.3.2. 
  **Post-Mortem & Fix Analysis**:
  > Hi @Zhs17, I have a fix in the works for this today.
  > i've tried https://github.com/dolthub/go-mysql-server/pull/3967 

- **Issue #11949** (2026-10-01): **git remote: since v2.1.2 a pull can re-download the whole database, because each process deletes its fetch ref**
  *Symptoms*: Since v2.1.2 (#11150, the fix for #11141), [`Teardown()`](https://github.com/dolthub/dolt/blob/ad65af6cc937d10fa3c88e2041fed4325968b581/go/store/blobstore/git_blobstore.go#L698-L734) deletes each process's tracking ref when it exits. A later `git fetch` into the same git remote cache then has no local ref that reaches the data history, so it sends no usable `have`, and the remote sends the whole object closure of `refs/dolt/data`. In a database that was created locally and then pushed, every `dolt pull` of a one-row change receives the whole database. On 1.86.6, before #11150, the same pulls received only the new objects. A `dolt clone` is affected less: its clone-time ref is never deleted, so its pulls receive everything pushed since the clone.  ### Reproduction  dolt 2.3.5, git 2.54.0, macOS arm64, a `git+file://` remote. Dolt will not push to a repository with no branches, so the first lines seed one.  ```sh git init -q --bare hub.git empty=$(git --git-dir hub.git hash-object -t tree -w /dev/null) git --git-dir hub.git update-ref refs/heads/main "$(git --git-dir hub.git commit-tree "$empty" -m seed)" { echo id,txt; head -c 15000000 /dev/urandom | base64 | tr -d '\n' | fold -w 1000 | head -n 20000 | awk '{print NR "," $0}'; } > data.csv mkdir A && cd A && dolt init dolt sql -q "create table t (id int primary key, txt varchar(1000))" dolt table import -u t ../data.csv dolt add -A && dolt commit -m seed dolt remote add origin "git+file://$PWD/../hub.git" dolt push --set-upstr
  **Post-Mortem & Fix Analysis**:
  > Hi @ak2k, we have the regression tested so far, we'll let you know once we start work on this.
  > @ak2k I merged a fix for this in #11991 and it will go out in the next Dolt release. This release will need to be propogated to dolthub/driver and then to Beads as well.
  > Thank you!

- **Issue #11942** (2026-09-28): **Dolt panics on a `NULL` DECIMAL in a `VALUES`-derived table**
  *Symptoms*: # Dolt panics on a `NULL` DECIMAL in a `VALUES`-derived table  ## What happened  A typed `NULL` in a DECIMAL column of a `VALUES`-derived table terminates the Dolt CLI.  ## Environment  Dolt `main` commit `4a2e8ce2f155f621cd904944c200ad356c758519`, `dolt version 2.3.5`, go-mysql-server `13a83f1e6133`; MySQL Server 9.6.0 for reference.  ## How to reproduce  Run this SQL in a fresh Dolt repository.  ```sql SELECT * FROM (VALUES ROW(CAST(NULL AS DECIMAL(20,6)))) AS t(x); ```  ## Expected result  A fresh MySQL 9.6.0 server accepts the same statement and returns one typed DECIMAL `NULL`:  ```text x NULL ```  ## Actual result  Dolt produces no rows and exits with the following panic:  ```text panic: interface conversion: interface {} is nil, not *apd.Decimal github.com/dolthub/go-mysql-server/sql/rowexec.(*BaseBuilder).buildValueDerivedTable ```  ## Controls  - `SELECT CAST(NULL AS DECIMAL(20,6))` succeeds and returns `NULL`. - The same `VALUES ROW`-derived table with `CAST(1 AS DECIMAL(20,6))` succeeds and returns `1.000000`. - Adding `ROW_NUMBER() OVER ()` does not change the panic. 

- **Issue #11941** (2026-09-25): **Dolt panics when CTAS materializes an untyped `NULL`**
  *Symptoms*: ## What happened  Dolt terminates with a panic when `CREATE TABLE ... AS SELECT` materializes `FIRST_VALUE(NULL)`. The same window expression succeeds in a direct `SELECT` and returns `NULL`.  ## Environment  Dolt `main` commit `4a2e8ce2f155f621cd904944c200ad356c758519`, `dolt version 2.3.5`; MySQL Server 9.6.0 for reference.   ## How to reproduce  Run this SQL in a fresh Dolt repository.  ```sql CREATE TABLE t(id INT PRIMARY KEY, g INT); INSERT INTO t VALUES (1,1),(2,2);  CREATE TABLE out_t AS SELECT id,        FIRST_VALUE(NULL) OVER (          PARTITION BY g          RANGE BETWEEN CURRENT ROW AND CURRENT ROW        ) AS wf FROM t; ```  ## Expected result  MySQL 9.6.0 creates `out_t`, with `wf` as nullable `varbinary(0)`, and returns:  ```text id  wf 1   NULL 2   NULL ```  A direct `SELECT` of the same window expression also returns these two rows on Dolt.  ## Actual result  Dolt creates no `out_t` table and exits with:  ```text panic: unknown type info does not have a relevant SQL type github.com/dolthub/dolt/go/libraries/doltcore/schema/typeinfo.(*unknownType).ToSqlType ```  ## Reduced control  The window function is not required to reach the same panic:  ```sql CREATE TABLE out_null AS SELECT NULL AS wf; ```

- **Issue #11919** (2026-09-30): **STR_TO_DATE() with BLOB argument errors with "invalid type: []uint8"**
  *Symptoms*:  ## Version  v2.3.5 — reproduced on the official `dolthub/dolt-sql-server:2.3.5` docker image and with a binary built from the v2.3.5 source tag.   ## Repro (no table needed)  ```sql SELECT STR_TO_DATE(UNHEX('31323a33343a3536'), '%h:%i:%s'); -- ERROR 1105: invalid type: []uint8  SELECT STR_TO_DATE('12:34:56', '%h:%i:%s'); -- OK, returns 12:34:56  (identical content passed as string works)  SELECT STR_TO_DATE(CAST(UNHEX('31323a33343a3536') AS CHAR), '%h:%i:%s'); -- OK, returns 12:34:56 ```  The only difference is the argument type (bytes vs string). A BLOB column fails the same way for any non-NULL value, e.g. `SELECT STR_TO_DATE(b, '%h:%i:%s') FROM t;`  ## Expected (MySQL 8)  BLOB is implicitly cast to string: the query returns TIME `12:34:56` for parseable content, NULL otherwise — never an internal error.  ## Related cases (possibly the same binary→string conversion path; feel free to split)  ```sql CREATE TABLE t(b BLOB); INSERT INTO t VALUES (UNHEX('FFD8FFE000104A464946'));  SELECT INET_ATON(UNHEX('372e302e302e31'));  -- OK: 117440513 (valid-text bytes work) SELECT INET_ATON(b) FROM t;                 -- ERROR 1105: invalid type: []uint8 SELECT REGEXP_LIKE('a', b) FROM t;          -- ERROR 1105: Incorrect string value '\xFF\xD8...' ```  INET_ATON succeeds when the bytes are valid text but errors on non-UTF-8 content (MySQL returns NULL instead); the REGEXP family behaves similarly (MySQL matches byte-wise).  I'm not sure whether the behavioral difference from MySQL itself
  **Post-Mortem & Fix Analysis**:
  > Hi @awusan125, we've gotten a confirmation on this and will work on a fix.

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

### Incident Patch 1: `dd5bad53` (2026-10-02)
**Commit Message**: Merge pull request #12016 from dolthub/db/fix-gr

/{go,integration-tests}: use a more specific cache key

**File**: `go/libraries/doltcore/dbfactory/git_remote.go` (modified, +20/-9)
```diff
@@ -199,15 +199,7 @@ func (fact GitRemoteFactory) CreateDB(ctx context.Context, nbf *types.NomsBinFor
 		return nil, nil, nil, err
 	}
 
-	cacheRoot, ok, err := resolveGitCacheRoot(params)
-	if err != nil {
-		return nil, nil, nil, err
-	}
-	if !ok {
-		return nil, nil, nil, fmt.Errorf("%s is required for git remotes", GitCacheRootParam)
-	}
-
-	cacheRepo, err := cacheRepoPath(cacheRoot, remoteURL.String(), ref)
+	cacheRepo, err := GitRemoteCacheKey(urlObj, params)
 	if err != nil {
 		return nil, nil, nil, err
 	}
@@ -421,6 +413,25 @@ func resolveGitCacheRoot(params map[string]interface{}) (root string, ok bool, e
 	return s, true, nil
 }
 
+// GitRemoteCacheKey returns the local bare repository path used as the cache key
+// by both GitRemoteFactory and the SQL database provider. It identifies a remote
+// by its local database cache root, underlying URL, and effective Git ref.
+// URL paths and refs retain their case; omitted or blank refs use the default.
+func GitRemoteCacheKey(urlObj *url.URL, params map[string]interface{}) (string, error) {
+	remoteURL, ref, err := parseGitRemoteFactoryURL(urlObj, params)
+	if err != nil {
+		return "", err
+	}
+	cacheRoot, ok, err := resolveGitCacheRoot(params)
+	if err != nil {
+		return "", err
+	}
+	if !ok {
+		return "", fmt.Errorf("%s is required for git remotes", GitCacheRootParam)
+	}
+	return cacheRepoPath(cacheRoot, remoteURL.String(), ref)
+}
+
 func cacheRepoPath(cacheBase, remoteURL, ref string) (string, error) {
 	if strings.TrimSpace(cacheBase) == "" {
 		return "", fmt.Errorf("empty git cache base")
```

**File**: `go/libraries/doltcore/dbfactory/git_remote_test.go` (modified, +39/-0)
```diff
@@ -51,6 +51,45 @@ func shortTempDir(t *testing.T) string {
 	return dir
 }
 
+func TestGitRemoteCacheKey(t *testing.T) {
+	root := t.TempDir()
+	key := func(root, rawURL string, ref interface{}) string {
+		t.Helper()
+		u, err := url.Parse(rawURL)
+		require.NoError(t, err)
+		params := map[string]interface{}{GitCacheRootParam: root}
+		if ref != nil {
+			params[GitRefParam] = ref
+		}
+		got, err := GitRemoteCacheKey(u, params)
+		require.NoError(t, err)
+		return got
+	}
+	const remoteURL = "git+https://example.com/repo.git"
+	base := key(root, remoteURL, nil)
+	for _, ref := range []interface{}{"", "  ", "refs/dolt/data", " refs/dolt/data "} {
+		require.Equal(t, base, key(root, remoteURL, ref))
+	}
+	require.NotEqual(t, base, key(filepath.Join(root, "other-db"), remoteURL, nil))
+	require.NotEqual(t, base, key(root, "git+https://example.com/other.git", nil))
+	require.NotEqual(t, base, key(root, "git+https://example.com/Repo.git", nil))
+	require.NotEqual(t, base, key(root, remoteURL, "refs/dolt/other"))
+	require.NotEqual(t, base, key(root, remoteURL, "refs/dolt/Data"))
+	// Query and fragment handling must match the factory's URL parsing.
+	require.Equal(t, base, key(root, remoteURL+"?ref=ignored#ignored", nil))
+
+	u, err := url.Parse(remoteURL)
+	require.NoError(t, err)
+	for _, params := range []map[string]interface{}{
+		nil,
+		{GitCacheRootParam: ""},
+		{GitCacheRootParam: 42},
+	} {
+		_, err := GitRemoteCacheKey(u, params)
+		require.ErrorContains(t, err, GitCacheRootParam)
+	}
+}
+
 func TestGitRemoteURLString(t *testing.T) {
 	tests := []struct {
 		name     string
```

**File**: `go/libraries/doltcore/env/remotes.go` (modified, +15/-40)
```diff
@@ -102,7 +102,9 @@ func (r *Remote) GetParamOrDefault(pName, defVal string) string {
 	return val
 }
 
-func (r *Remote) GetRemoteDB(ctx context.Context, nbf *types.NomsBinFormat, dialer dbfactory.GRPCDialProvider) (*doltdb.DoltDB, error) {
+// DBFactoryParams returns a fresh parameter map for opening or identifying this
+// remote. Git cache lookups and database opens must use the same cache root.
+func (r *Remote) DBFactoryParams(dialer dbfactory.GRPCDialProvider) (map[string]interface{}, error) {
 	params := make(map[string]interface{})
 	for k, v := range r.Params {
 		params[k] = v
@@ -125,34 +127,24 @@ func (r *Remote) GetRemoteDB(ctx context.Context, nbf *types.NomsBinFormat, dial
 		}
 	}
 
+	return params, nil
+}
+
+func (r *Remote) GetRemoteDB(ctx context.Context, nbf *types.NomsBinFormat, dialer dbfactory.GRPCDialProvider) (*doltdb.DoltDB, error) {
+	params, err := r.DBFactoryParams(dialer)
+	if err != nil {
+		return nil, err
+	}
 	return doltdb.LoadDoltDBWithParams(ctx, nbf, r.Url, filesys2.LocalFS, params)
 }
 
 // Prepare does whatever work is necessary to prepare the remote given to receive pushes. Not all remote types can
 // support this operations and must be prepared manually. For existing remotes, no work is done.
 func (r *Remote) Prepare(ctx context.Context, nbf *types.NomsBinFormat, dialer dbfactory.GRPCDialProvider) error {
-	params := make(map[string]interface{})
-	for k, v := range r.Params {
-		params[k] = v
-	}
-
-	params[dbfactory.GRPCDialProviderParam] = dialer
-	u, err := earl.Parse(r.Url)
+	params, err := r.DBFactoryParams(dialer)
 	if err != nil {
 		return err
 	}
-	if strings.HasPrefix(strings.ToLower(u.Scheme), "git+") {
-		params[dbfactory.GitRemoteNameParam] = r.Name
-		if err := addGitRemoteHistoryConfig(params, dialer); err != nil {
-			return err
-		}
-		if p, ok := dialer.(dbfactory.GitCacheRootProvider); ok {
-			if root, ok := p.GitCacheRoot(); ok {
-				params[dbfactory.GitCacheRootParam] = filepath.Join(root, dbfactory.DoltDir, dbfactory.GitRemoteCacheDirName)
-			}
-		}
-	}
-
 	return dbfactory.PrepareDB(ctx, nbf, r.Url, params)
 }
 
@@ -169,29 +161,12 @@ func (r *Remote) Prepare(ctx context.Context, nbf *types.NomsBinFormat, dialer d
 // for closing the returned [doltdb.DoltDB] when done to release file descriptors and other
 // associated resources.
 func (r *Remote) GetRemoteDBWithoutCaching(ctx context.Context, nbf *types.NomsBinFormat, dialer dbfactory.GRPCDialProvider) (*doltdb.DoltDB, error) {
-	params := make(map[string]interface{})
-	for k, v := range r.Params {
-		params[k] = v
-	}
-	params[dbfactory.DisableSingletonCacheParam] = "true"
-	params[dbfactory.NoCachingParameter] = "true"
-	params[dbfactory.GRPCDialProviderParam] = dialer
-	u, err := earl.Parse(r.Url)
+	params, err := r.DBFactoryParams(dialer)
 	if err != nil {
 		return nil, err
 	}
-	if strings.HasPrefix(strings.ToLower(u.Scheme), "git+") {
-		params[dbfactory.GitRemoteNameParam] = r.Name
-		if err := addGitRemoteHistoryConfig(params, dialer); err != nil {
-			return nil, err
-		}
-		if p, ok := dialer.(dbfactory.GitCacheRootProvider); ok {
-			if root, ok := p.GitCacheRoot(); ok {
-				params[dbfactory.GitCacheRootParam] = filepath.Join(root, dbfactory.DoltDir, dbfactory.GitRemoteCacheDirName)
-			}
-		}
-	}
-
+	params[dbfactory.DisableSingletonCacheParam] = "true"
+	params[dbfactory.NoCachingParameter] = "true"
 	return doltdb.LoadDoltDBWithParams(ctx, nbf, r.Url, filesys2.LocalFS, params)
 }
 
```

**File**: `go/libraries/doltcore/sqle/database_provider.go` (modified, +16/-2)
```diff
@@ -43,6 +43,7 @@ import (
 	"github.com/dolthub/dolt/go/libraries/doltcore/sqlserver"
 	"github.com/dolthub/dolt/go/libraries/doltcore/table/editor"
 	"github.com/dolthub/dolt/go/libraries/utils/concurrentmap"
+	"github.com/dolthub/dolt/go/libraries/utils/earl"
 	"github.com/dolthub/dolt/go/libraries/utils/filesys"
 	"github.com/dolthub/dolt/go/libraries/utils/keymutex"
 	"github.com/dolthub/dolt/go/libraries/utils/lockutil"
@@ -616,10 +617,23 @@ func (p *DoltDatabaseProvider) GetRemoteDB(ctx context.Context, format *types.No
 		}
 	}
 
-	key := strings.ToLower(r.Url)
-	isGit := strings.HasPrefix(key, "git+")
+	isGit := strings.HasPrefix(strings.ToLower(r.Url), "git+")
+	var key string
 
 	if isGit {
+		params, err := r.DBFactoryParams(dialer)
+		if err != nil {
+			return nil, err
+		}
+		u, err := earl.Parse(r.Url)
+		if err != nil {
+			return nil, err
+		}
+		key, err = dbfactory.GitRemoteCacheKey(u, params)
+		if err != nil {
+			return nil, err
+		}
+
 		p.gitRemotesMu.Lock()
 		cached, ok := p.gitRemotes[key]
 		p.gitRemotesMu.Unlock()
```

**File**: `integration-tests/bats/sql-remotes-git.bats` (modified, +253/-1)
```diff
@@ -1,5 +1,6 @@
 #!/usr/bin/env bats
 load $BATS_TEST_DIRNAME/helper/common.bash
+load $BATS_TEST_DIRNAME/helper/query-server-common.bash
 
 setup() {
     skiponwindows "tests are flaky on Windows"
@@ -13,10 +14,262 @@ setup() {
 }
 
 teardown() {
+    stop_sql_server 1
     assert_feature_version
     teardown_common
 }
 
+@test "sql-remotes-git: sql-server isolates databases sharing a URL with different refs" {
+    # Regression for https://github.com/dolthub/dolt/issues/12011.
+    git init --bare remote.git
+    seed_git_remote_branch remote.git main
+    local remote_dir="$PWD/remote.git"
+    local remote_url="git+file://$remote_dir"
+
+    mkdir srv client
+    for db in db1 db2; do
+        mkdir "srv/$db"
+        (
+            cd "srv/$db"
+            dolt init
+            dolt sql -q "create table t_$db(id int primary key);
+                insert into t_$db values (1);
+                call dolt_commit('-Am', '$db initial');"
+        )
+    done
+
+    cd srv
+    start_sql_server db1 server.log
+    # Run clients outside the server's data directory to avoid database locks.
+    cd ../client
+    local client_args=(--host 127.0.0.1 --port "$PORT" --user root --password "" --no-tls)
+
+    dolt "${client_args[@]}" --use-db db1 sql -q "
+        call dolt_remote('add', '--ref', 'refs/dolt/db1', 'origin', '$remote_url');
+        call dolt_push('origin', 'main');"
+    local db1_head
+    db1_head=$(git --git-dir "$remote_dir" rev-parse refs/dolt/db1)
+
+    dolt "${client_args[@]}" --use-db db2 sql -q "
+        call dolt_remote('add', '--ref', 'refs/dolt/db2', 'origin', '$remote_url');"
+    # Fetching an absent ref succeeds without fetching any branches from db1.
+    run dolt "${client_args[@]}" --use-db db2 sql -r csv -q "call dolt_fetch('origin');"
+    [ "$status" -eq 0 ]
+    [ "$output" = $'status\n0' ]
+    run dolt "${client_args[@]}" --use-db db2 sql -r csv -q "select count(*) from dolt_remote_branches;"
+    [ "$status" -eq 0 ]
+    local fetched_branch_count="${lines[1]}"
+
+    run dolt "${client_args[@]}" --use-db db2 sql -q "call dolt_push('--force', 'origin', 'main');"
+    [ "$status" -eq 0 ]
+
+    # Check the remote itself, not the server's potentially shared cached handle.
+    run git --git-dir "$remote_dir" rev-parse refs/dolt/db1
+    [ "$status" -eq 0 ]
+    [ "$output" = "$db1_head" ]
+    run git --git-dir "$remote_dir" show-ref --verify refs/dolt/db2
+    [ "$status" -eq 0 ]
+    [ "$fetched_branch_count" = "0" ]
+
+    for db in db1 db2; do
+        dolt clone --ref "refs/dolt/$db" "$remote_url" "$db"
+        run dolt --data-dir "$db" sql -r csv -q "show tables;"
+        [ "$status" -eq 0 ]
+        [ "${#lines[@]}" -eq 2 ]
+        [ "${lines[1]}" = "t_$db" ]
+        run dolt --data-dir "$db" sql -r csv -q "select id from t_$db;"
+        [ "$status" -eq 0 ]
+        [ "$output" = $'id\n1' ]
+    done
+
+    # Independent clients advance each ref, then the long-lived server must
+    # fetch the right update through its already-cached remote handles.
+    for db in db2 db1; do
+        dolt --data-dir "$db" sql -q "
+            insert into t_$db values (2);
+            call dolt_commit('-Am', 'external update');
+            call dolt_push('origin', 'main');"
+        pull_until_rows "$db" "t_$db" $'id\n1\n2'
+    done
+}
+
+@test "sql-remotes-git: one database isolates remotes sharing a URL with different refs" {
+    git init --bare remote.git
+    seed_git_remote_branch remote.git main
+    local remote_url="git+file://$PWD/remote.git"
+
+    # A single SQL process keeps the provider cache alive across both pushes.
+    dolt sql -q "
+        create table t1(id int primary key);
+        insert into t1 values (1);
+        call dolt_commit('-Am', 'first table');
+        call dolt_remote('add', '--ref', 'refs/dolt/first', 'first', '$remote_url');
+        call dolt_push('first', 'main');
+        create table t2(id int primary key);
+        insert into t1 values (2);
+        call dolt_commit('-Am', 'second table');
+        call dolt_remote('add', '--ref', 'refs/dolt/second', 'second', '$remote_url');
+        call dolt_push('second', 'main');
+        call dolt_fetch('second');
+        call dolt_fetch('first');"
+
+    run dolt sql -r csv -q "select count(*) from t1 as of hashof('first/main');"
+    [ "$status" -eq 0 ]
+    [ "${lines[1]}" = "1" ]
+    run dolt sql -r csv -q "select count(*) from t1 as of hashof('second/main');"
+    [ "$status" -eq 0 ]
+    [ "${lines[1]}" = "2" ]
+
+    dolt clone --ref refs/dolt/first "$remote_url" first
+    dolt clone --ref refs/dolt/second "$remote_url" second
+    run dolt --data-dir first sql -r csv -q 'show tables;'
+    [ "$status" -eq 0 ]
+    [ "${#lines[@]}" -eq 2 ]
+    [ "${lines[1]}" = "t1" ]
+    run dolt --data-dir second sql -r csv -q 'show tables;'
+    [ "$status" -eq 0 ]
+    [ "${#lines[@]}" -eq 3 ]
+    [ "${lines[1]}" = "t1" ]
+    [ "${lines[2]}" = "t2" ]
+}
+
+@test "sql-remotes-git: sql-ser
```

---

### Incident Patch 2: `2c649dc1` (2026-10-02)
**Commit Message**: Fix schema overrides for nonlocal tables

**File**: `go/libraries/doltcore/sqle/database.go` (modified, +108/-64)
```diff
@@ -308,10 +308,6 @@ func (db Database) GetGlobalState() globalstate.GlobalState {
 // GetTableInsensitive is used when resolving tables in queries. It returns a best-effort case-insensitive match for
 // the table name given.
 func (db Database) GetTableInsensitive(ctx *sql.Context, tblName string) (sql.Table, bool, error) {
-	return db.getTableInsensitive(ctx, tblName, doReadNonlocalTables)
-}
-
-func (db Database) getTableInsensitive(ctx *sql.Context, tblName string, readNonlocalTables readNonlocalTablesFlag) (sql.Table, bool, error) {
 	// We start by first checking whether the input table is a temporary table. Temporary tables with name `x` take
 	// priority over persisted tables of name `x`.
 	ds := dsess.DSessFromSess(ctx.Session)
@@ -324,7 +320,7 @@ func (db Database) getTableInsensitive(ctx *sql.Context, tblName string, readNon
 		return nil, false, err
 	}
 
-	return db.getTableInsensitiveWithRoot(ctx, nil, ds, root, tblName, "", readNonlocalTables)
+	return db.getTableInsensitiveWithRoot(ctx, nil, ds, root, tblName, "")
 }
 
 func (db Database) getDoltDBTableInsensitive(ctx *sql.Context, tblName doltdb.TableName, readNonlocalTables readNonlocalTablesFlag) (doltdb.TableName, *doltdb.Table, bool, error) {
@@ -336,12 +332,8 @@ func (db Database) getDoltDBTableInsensitive(ctx *sql.Context, tblName doltdb.Ta
 	return db.getDoltDBTableInsensitiveWithRoot(ctx, root, tblName, readNonlocalTables)
 }
 
+// GetTableInsensitiveAsOf implements sql.VersionedDatabase.
 func (db Database) GetTableInsensitiveAsOf(ctx *sql.Context, tableName string, asOf interface{}) (sql.Table, bool, error) {
-	return db.getTableInsensitiveAsOf(ctx, tableName, asOf, doReadNonlocalTables)
-}
-
-// GetTableInsensitiveAsOf implements sql.VersionedDatabase
-func (db Database) getTableInsensitiveAsOf(ctx *sql.Context, tableName string, asOf interface{}, readNonlocalTables readNonlocalTablesFlag) (sql.Table, bool, error) {
 	if asOf == nil {
 		return db.GetTableInsensitive(ctx, tableName)
 	}
@@ -354,36 +346,39 @@ func (db Database) getTableInsensitiveAsOf(ctx *sql.Context, tableName string, a
 
 	sess := dsess.DSessFromSess(ctx.Session)
 
-	table, ok, err := db.getTableInsensitiveWithRoot(ctx, head, sess, root, tableName, asOf, readNonlocalTables)
+	table, ok, err := db.getTableInsensitiveWithRoot(ctx, head, sess, root, tableName, asOf)
 	if err != nil {
 		return nil, false, err
 	}
 	if !ok {
 		return nil, false, nil
 	}
 
+	table, err = db.lockTableToRoot(ctx, tableName, table, root)
+	return table, err == nil, err
+}
+
+// lockTableToRoot pins table data to a root; read-only system tables and empty tables need no pinning.
+// tableName identifies system tables whose data is already bound to the requested root.
+func (db Database) lockTableToRoot(ctx *sql.Context, tableName string, table sql.Table, root doltdb.RootValue) (sql.Table, error) {
 	if doltdb.IsReadOnlySystemTable(doltdb.TableName{Name: tableName, Schema: db.schemaName}) {
 		// currently, system tables do not need to be "locked to root"
-		//  see comment below in getTableInsensitiveWithRoot
-		return table, ok, nil
+		//  see comment below in getSystemTableInsensitiveWithRoot
+		return table, nil
 	}
 
 	switch t := table.(type) {
 	case dtables.VersionableTable:
-		versionedTable, err := t.LockedToRoot(ctx, root)
-		if err != nil {
-			return nil, false, err
-		}
-		return versionedTable, true, nil
+		return t.LockedToRoot(ctx, root)
 
 	case *plan.EmptyTable:
 		// getTableInsensitive returns *plan.EmptyTable if the table doesn't exist in the data root, but
 		// schemas have been locked to a commit where the table does exist. Since the table is empty,
 		// there's no need to lock it to a root.
-		return t, true, nil
+		return t, nil
 
 	default:
-		return nil, false, fmt.Errorf("unexpected table type %T", table)
+		return nil, fmt.Errorf("unexpected table type %T", table)
 	}
 }
 
@@ -401,22 +396,35 @@ func (db Database) getDoltTableInsensitiveAsOf(ctx *sql.Context, tableName doltd
 	return db.getDoltDBTableInsensitiveWithRoot(ctx, root, tableName, readNonlocalTables)
 }
 
-func (db Database) getTableInsensitiveWithRoot(ctx *sql.Context, head *doltdb.Commit, ds *dsess.DoltSession, root doltdb.RootValue, tblName string, asOf interface{}, readNonlocalTables readNonlocalTablesFlag) (sql.Table, bool, error) {
+func (db Database) getTableInsensitiveWithRoot(ctx *sql.Context, head *doltdb.Commit, ds *dsess.DoltSession, root doltdb.RootValue, tblName string, asOf interface{}) (sql.Table, bool, error) {
 	lwrName := strings.ToLower(tblName)
-
-	if readNonlocalTables {
-		nonlocalTable, exists, err := db.getNonlocalTable(ctx, root, lwrName)
-		if err != nil {
-			return nil, false, err
-		}
-		if exists {
-			return nonlocalTable, true, nil
-		}
+	nonlocalTable, exists, err := db.getNonlocalTable(ctx, root, lwrName)
+	if err != nil {
+		return nil, false, err
+	}
+	if exists {
+		return nonlocalTable, true, nil
+	}
+	table, found, err := db.getSystemTableInsensitiveWithR
```

**File**: `go/libraries/doltcore/sqle/enginetest/dolt_queries_nonlocal.go` (modified, +163/-0)
```diff
@@ -209,6 +209,169 @@ var NonlocalScripts = []queries.ScriptTest{
 			},
 		},
 	},
+	{
+		// https://github.com/dolthub/dolt/issues/11997
+		Name: "schema override permits ignored nonlocal tables",
+		SetUpScript: []string{
+			"SET @initial_commit = (SELECT commit_hash FROM dolt_log('--parents') WHERE parents = '');",
+			"CREATE TABLE global_test (id int primary key, name varchar(100), INDEX (name));",
+			"INSERT INTO global_test VALUES (1, 'one'), (2, NULL);",
+			"CREATE TABLE global_empty (id int primary key);",
+			"CREATE TABLE local_only (id int primary key);",
+			"INSERT INTO dolt_ignore VALUES ('global_*', true), ('local_only', true);",
+			"INSERT INTO dolt_nonlocal_tables (table_name, target_ref, options) VALUES ('global_*', 'main', 'immediate');",
+			"CALL dolt_commit('-Am', 'configure nonlocal tables');",
+		},
+		Assertions: []queries.ScriptTestAssertion{
+			{
+				Query:    "SELECT @initial_commit IS NOT NULL;",
+				Expected: []sql.Row{{true}},
+			},
+			{
+				Query: "SET @@dolt_override_schema='main';",
+			},
+			{
+				Query:    "SELECT COUNT(*) FROM global_test;",
+				Expected: []sql.Row{{2}},
+			},
+			{
+				Query:    "SELECT * FROM global_test ORDER BY id;",
+				Expected: []sql.Row{{1, "one"}, {2, nil}},
+			},
+			{
+				Query:    "SELECT id FROM global_test WHERE name = 'one';",
+				Expected: []sql.Row{{1}},
+			},
+			{
+				Query:    "SELECT * FROM global_empty;",
+				Expected: []sql.Row{},
+			},
+			{
+				Query:          "SELECT * FROM local_only;",
+				ExpectedErrStr: "unable to find table 'local_only' at overridden schema root",
+			},
+			{
+				Query: "SET @@dolt_override_schema=@initial_commit;",
+			},
+			{
+				Query:    "SELECT COUNT(*) FROM global_test;",
+				Expected: []sql.Row{{2}},
+			},
+			{
+				Query: "SET @@dolt_override_schema='doesNotExist';",
+			},
+			{
+				Query:          "SELECT * FROM global_test;",
+				ExpectedErrStr: "unable to resolve schema override value: branch not found: doesNotExist",
+			},
+		},
+	},
+	{
+		Name: "schema override permits ignored nonlocal aliases on another branch",
+		SetUpScript: []string{
+			"INSERT INTO dolt_ignore VALUES ('global_*', true);",
+			"INSERT INTO dolt_nonlocal_tables (table_name, target_ref, ref_table, options) VALUES ('alias', 'main', 'global_test', 'immediate');",
+			"CALL dolt_commit('-Am', 'configure nonlocal alias');",
+			"CALL dolt_branch('other');",
+			"CREATE TABLE global_test (id int primary key, name varchar(100));",
+			"INSERT INTO global_test VALUES (1, 'one');",
+			"CALL dolt_checkout('other');",
+		},
+		Assertions: []queries.ScriptTestAssertion{
+			{
+				Query: "SET @@dolt_override_schema='main';",
+			},
+			{
+				Query:    "SELECT * FROM alias;",
+				Expected: []sql.Row{{1, "one"}},
+			},
+			{
+				Query:          "SELECT * FROM `mydb/main`.global_test;",
+				ExpectedErrStr: "unable to find table 'global_test' at overridden schema root",
+			},
+		},
+	},
+	{
+		Name: "schema override maps committed nonlocal tables",
+		SetUpScript: []string{
+			"SET @empty_commit = hashof('HEAD');",
+			"CREATE TABLE target (id int primary key, name varchar(100));",
+			"INSERT INTO target VALUES (1, 'one');",
+			"CALL dolt_commit('-Am', 'create target');",
+			"SET @schema_commit = hashof('HEAD');",
+			"CALL dolt_tag('original');",
+			"ALTER TABLE target ADD COLUMN extra int;",
+			"INSERT INTO target VALUES (2, 'two', 20);",
+			"CALL dolt_commit('-am', 'extend target');",
+			"CALL dolt_checkout('-b', 'other');",
+			"INSERT INTO dolt_nonlocal_tables (table_name, target_ref, ref_table, options) VALUES ('alias', 'main', 'target', 'immediate'), ('tag_alias', 'original', 'target', 'immediate');",
+		},
+		Assertions: []queries.ScriptTestAssertion{
+			{
+				Query: "SET @@dolt_override_schema=@schema_commit;",
+			},
+			{
+				Query:    "SELECT * FROM alias ORDER BY id;",
+				Expected: []sql.Row{{1, "one"}, {2, "two"}},
+			},
+			{
+				Query:    "SELECT * FROM tag_alias;",
+				Expected: []sql.Row{{1, "one"}},
+			},
+			{
+				Query: "SET @@dolt_override_schema=@empty_commit;",
+			},
+			{
+				Query:    "SELECT * FROM tag_alias;",
+				Expected: []sql.Row{{1, "one"}},
+			},
+			{
+				Query:    "SELECT * FROM alias ORDER BY id;",
+				Expected: []sql.Row{{1, "one", nil}, {2, "two", 20}},
+			},
+		},
+	},
+	{
+		Name: "conflict updates use the local backing table despite a nonlocal rule",
+		SetUpScript: []string{
+			"CREATE TABLE target (id int primary key, value int);",
+			"INSERT INTO target VALUES (1, 0);",
+			"CALL dolt_commit('-Am', 'create target');",
+			"CALL dolt_checkout('-b', 'other');",
+			"UPDATE target SET value = 10;",
+			"CALL dolt_commit('-am', 'other value');",
+			"CALL dolt_checkout('main');",
+			"UPDATE target SET value = 20;",
+			"CALL dolt_commit('-am', 'main value');",
+			"SET @@dolt_force_transaction_commit = 1;",
+			"CALL dolt_merge('other');",
+			"INSERT INTO dolt_nonlocal_tables (table_name, target_ref, options) VALUES ('target
```

**File**: `go/libraries/doltcore/sqle/schema_override.go` (modified, +8/-7)
```diff
@@ -68,27 +68,28 @@ func resolveOverriddenNonexistentTable(ctx *sql.Context, tblName string, db Data
 	return emptyTable.(sql.Table), true, nil
 }
 
-// overrideSchemaForTable loads the schema from |overriddenSchemaRoot| for the table named |tableName| and sets the
-// override on |tbl|. If there are any problems loading the overridden schema, this function returns an error.
-func overrideSchemaForTable(ctx *sql.Context, tableName string, tbl *doltdb.Table, overriddenSchemaRoot doltdb.RootValue) error {
+// overrideSchemaForTable applies the schema from |overriddenSchemaRoot| for |tableName| to |tbl|.
+// It returns false without changing the table if the override table is absent. Other lookup or schema-loading
+// failures return an error.
+func overrideSchemaForTable(ctx *sql.Context, tableName string, tbl *doltdb.Table, overriddenSchemaRoot doltdb.RootValue) (bool, error) {
 	overriddenTable, _, ok, err := doltdb.GetTableInsensitive(ctx, overriddenSchemaRoot, doltdb.TableName{Name: tableName})
 	if err != nil {
-		return fmt.Errorf("unable to find table '%s' at overridden schema root: %s", tableName, err.Error())
+		return false, fmt.Errorf("unable to find table '%s' at overridden schema root: %s", tableName, err.Error())
 	}
 	if !ok {
-		return fmt.Errorf("unable to find table '%s' at overridden schema root", tableName)
+		return false, nil
 	}
 
 	// TODO: Loading the schema is an expensive operation, so it would be more
 	//       efficient to use the same schema cache from getTable() here. The
 	//       schemas are cached by root value, so it's safe to use the cache.
 	overriddenSchema, err := overriddenTable.GetSchema(ctx)
 	if err != nil {
-		return fmt.Errorf("unable to load overridden schema for table '%s': %s", tableName, err.Error())
+		return true, fmt.Errorf("unable to load overridden schema for table '%s': %s", tableName, err.Error())
 	}
 
 	tbl.OverrideSchema(overriddenSchema)
-	return nil
+	return true, nil
 }
 
 // getOverriddenSchemaValue returns a string value of the Dolt schema override session variable. If the
```

---

### Incident Patch 3: `8aa5748f` (2026-10-02)
**Commit Message**: Merge pull request #11980 from dolthub/zachmu/fix-insert-trigger-server

Test update triggers during CSV imports

**File**: `go/go.mod` (modified, +1/-1)
```diff
@@ -65,7 +65,7 @@ require (
 	github.com/dolthub/eventsapi_schema v0.0.0-20260715220557-d9b4a1c6b4d4
 	github.com/dolthub/file-locks v0.1.1
 	github.com/dolthub/flatbuffers/v23 v23.3.3-dh.2
-	github.com/dolthub/go-mysql-server v0.20.1-0.20261001161429-0b7903b32e6c
+	github.com/dolthub/go-mysql-server v0.20.1-0.20261001232740-19405eb6f203
 	github.com/dolthub/gozstd v0.0.0-20240423170813-23a2903bca63
 	github.com/edsrzf/mmap-go v1.2.0
 	github.com/esote/minmaxheap v1.0.0
```

**File**: `go/go.sum` (modified, +2/-2)
```diff
@@ -215,8 +215,8 @@ github.com/dolthub/flatbuffers/v23 v23.3.3-dh.2 h1:u3PMzfF8RkKd3lB9pZ2bfn0qEG+1G
 github.com/dolthub/flatbuffers/v23 v23.3.3-dh.2/go.mod h1:mIEZOHnFx4ZMQeawhw9rhsj+0zwQj7adVsnBX7t+eKY=
 github.com/dolthub/go-icu-regex v0.0.0-20260610153742-72563bc7ca83 h1:FEMjCGEroDnY/BXyAffVZxUpXhP2GpoUJyyq5KaLn8c=
 github.com/dolthub/go-icu-regex v0.0.0-20260610153742-72563bc7ca83/go.mod h1:F3cnm+vMRK1HaU6+rNqQrOCyR03HHhR1GWG2gnPOqaE=
-github.com/dolthub/go-mysql-server v0.20.1-0.20261001161429-0b7903b32e6c h1:AG1MsrEBPa7gKa9H0ReNIU3UlT8kk3/TekWiZ8AsXe4=
-github.com/dolthub/go-mysql-server v0.20.1-0.20261001161429-0b7903b32e6c/go.mod h1:8yhQsTiaXTn5/q9DCc1RJoOkVvGgDvvVrylW9EFjv/A=
+github.com/dolthub/go-mysql-server v0.20.1-0.20261001232740-19405eb6f203 h1:Q1q3rmpxwHNU3u0uUXM9Zd+VSXtsGiXjU1ohY5z0+pU=
+github.com/dolthub/go-mysql-server v0.20.1-0.20261001232740-19405eb6f203/go.mod h1:8yhQsTiaXTn5/q9DCc1RJoOkVvGgDvvVrylW9EFjv/A=
 github.com/dolthub/gozstd v0.0.0-20240423170813-23a2903bca63 h1:OAsXLAPL4du6tfbBgK0xXHZkOlos63RdKYS3Sgw/dfI=
 github.com/dolthub/gozstd v0.0.0-20240423170813-23a2903bca63/go.mod h1:lV7lUeuDhH5thVGDCKXbatwKy2KW80L4rMT46n+Y2/Q=
 github.com/dolthub/ishell v0.0.0-20260414231531-5f031e3e9037 h1:oIW9HwuWrhxv+4HZxA+QQSKHLqWFyXZ2FmNjUYwkdiM=
```

**File**: `go/libraries/doltcore/dbfactory/git_remote_history_test.go` (modified, +10/-1)
```diff
@@ -1,7 +1,16 @@
 // Copyright 2026 Dolthub, Inc.
+//
 // Licensed under the Apache License, Version 2.0 (the "License");
 // you may not use this file except in compliance with the License.
-// You may obtain a copy of the License at http://www.apache.org/licenses/LICENSE-2.0
+// You may obtain a copy of the License at
+//
+//     http://www.apache.org/licenses/LICENSE-2.0
+//
+// Unless required by applicable law or agreed to in writing, software
+// distributed under the License is distributed on an "AS IS" BASIS,
+// WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
+// See the License for the specific language governing permissions and
+// limitations under the License.
 
 package dbfactory
 
```

**File**: `go/libraries/doltcore/env/git_remote_history_test.go` (modified, +10/-1)
```diff
@@ -1,7 +1,16 @@
 // Copyright 2026 Dolthub, Inc.
+//
 // Licensed under the Apache License, Version 2.0 (the "License");
 // you may not use this file except in compliance with the License.
-// You may obtain a copy of the License at http://www.apache.org/licenses/LICENSE-2.0
+// You may obtain a copy of the License at
+//
+//     http://www.apache.org/licenses/LICENSE-2.0
+//
+// Unless required by applicable law or agreed to in writing, software
+// distributed under the License is distributed on an "AS IS" BASIS,
+// WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
+// See the License for the specific language governing permissions and
+// limitations under the License.
 
 package env
 
```

**File**: `go/store/blobstore/git_blobstore_history_test.go` (modified, +10/-1)
```diff
@@ -1,7 +1,16 @@
 // Copyright 2026 Dolthub, Inc.
+//
 // Licensed under the Apache License, Version 2.0 (the "License");
 // you may not use this file except in compliance with the License.
-// You may obtain a copy of the License at http://www.apache.org/licenses/LICENSE-2.0
+// You may obtain a copy of the License at
+//
+//     http://www.apache.org/licenses/LICENSE-2.0
+//
+// Unless required by applicable law or agreed to in writing, software
+// distributed under the License is distributed on an "AS IS" BASIS,
+// WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
+// See the License for the specific language governing permissions and
+// limitations under the License.
 
 package blobstore
 
```

**File**: `integration-tests/bats/triggers.bats` (modified, +44/-0)
```diff
@@ -119,6 +119,50 @@ SQL
     [[ "$output" =~ "trigger1,INSERT,test,1,,SET new.v1 = new.v1 + 1,BEFORE,root@localhost,utf8mb4,utf8mb4_0900_bin,utf8mb4_0900_bin" ]] || false
 }
 
+@test "triggers: CSV update imports fire update triggers with omitted columns" {
+    # Regression for https://github.com/dolthub/dolt/issues/5925.
+    dolt sql <<SQL
+CREATE TABLE test (pk INT PRIMARY KEY, c1 INT, ts TIMESTAMP);
+CREATE TRIGGER test_bi BEFORE INSERT ON test FOR EACH ROW SET NEW.ts = '2000-01-01 00:00:00';
+CREATE TRIGGER test_bu BEFORE UPDATE ON test FOR EACH ROW SET NEW.ts = TIMESTAMPADD(SECOND, 1, OLD.ts);
+INSERT INTO test (pk, c1) VALUES (5, 5);
+SQL
+
+    cat <<CSV > in.csv
+pk,c1
+0,0
+1,1
+CSV
+    run dolt table import -u test in.csv
+    [ "$status" -eq 0 ]
+
+    run dolt sql -r csv -q "SELECT * FROM test ORDER BY pk"
+    [ "$status" -eq 0 ]
+    [ "$output" = $'pk,c1,ts\n0,0,2000-01-01 00:00:00\n1,1,2000-01-01 00:00:00\n5,5,2000-01-01 00:00:00' ]
+
+    # Even identical CSV values must run the update trigger for existing keys.
+    run dolt table import -u test in.csv
+    [ "$status" -eq 0 ]
+
+    run dolt sql -r csv -q "SELECT * FROM test ORDER BY pk"
+    [ "$status" -eq 0 ]
+    [ "$output" = $'pk,c1,ts\n0,0,2000-01-01 00:00:01\n1,1,2000-01-01 00:00:01\n5,5,2000-01-01 00:00:00' ]
+
+    cat <<CSV > in.csv
+pk,c1
+0,1
+1,2
+2,3
+CSV
+    run dolt table import -u test in.csv
+    [ "$status" -eq 0 ]
+
+    # Updates preserve OLD.ts for the update trigger; new keys use the insert trigger.
+    run dolt sql -r csv -q "SELECT * FROM test ORDER BY pk"
+    [ "$status" -eq 0 ]
+    [ "$output" = $'pk,c1,ts\n0,1,2000-01-01 00:00:02\n1,2,2000-01-01 00:00:02\n2,3,2000-01-01 00:00:00\n5,5,2000-01-01 00:00:00' ]
+}
+
 @test "triggers: Writing directly into dolt_schemas is forbidden" {
     dolt sql -q "CREATE TABLE test(pk BIGINT PRIMARY KEY, v1 BIGINT);"
     dolt sql -q "CREATE VIEW view1 AS SELECT v1 FROM test;"
```

---

### Incident Patch 4: `36ebdb62` (2026-10-01)
**Commit Message**: /go/store/blobstore: fix copyright header

**File**: `go/store/blobstore/git_blobstore_anchor_test.go` (modified, +10/-1)
```diff
@@ -1,7 +1,16 @@
 // Copyright 2026 Dolthub, Inc.
+//
 // Licensed under the Apache License, Version 2.0 (the "License");
 // you may not use this file except in compliance with the License.
-// You may obtain a copy of the License at http://www.apache.org/licenses/LICENSE-2.0
+// You may obtain a copy of the License at
+//
+//     http://www.apache.org/licenses/LICENSE-2.0
+//
+// Unless required by applicable law or agreed to in writing, software
+// distributed under the License is distributed on an "AS IS" BASIS,
+// WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
+// See the License for the specific language governing permissions and
+// limitations under the License.
 
 package blobstore
 
```

---

### Incident Patch 5: `cffd98e4` (2026-09-30)
**Commit Message**: Merge pull request #11985 from dolthub/timsehn-fix-license-link

Fix License Link

**File**: `README.md` (modified, +1/-1)
```diff
@@ -845,5 +845,5 @@ thankful to the Noms team for making this code freely available,
 without which we would not have been able to build Dolt so rapidly.
 
 Dolt is licensed under the Apache License, Version 2.0. See
-[LICENSE](https://github.com/dolthub/dolt/blob/master/LICENSE) for
+[LICENSE](https://github.com/dolthub/dolt/blob/main/LICENSE) for
 details.
```

---

### Incident Patch 6: `4b3eb1f8` (2026-09-30)
**Commit Message**: Merge pull request #11956 from dolthub/zachmu/insert-security

Fix upsert authorization and add protocol regression coverage

**File**: `go/go.mod` (modified, +1/-1)
```diff
@@ -65,7 +65,7 @@ require (
 	github.com/dolthub/eventsapi_schema v0.0.0-20260715220557-d9b4a1c6b4d4
 	github.com/dolthub/file-locks v0.1.1
 	github.com/dolthub/flatbuffers/v23 v23.3.3-dh.2
-	github.com/dolthub/go-mysql-server v0.20.1-0.20260929213643-0c0ebff14743
+	github.com/dolthub/go-mysql-server v0.20.1-0.20260929233927-f35678aaf3b7
 	github.com/dolthub/gozstd v0.0.0-20240423170813-23a2903bca63
 	github.com/edsrzf/mmap-go v1.2.0
 	github.com/esote/minmaxheap v1.0.0
```

**File**: `go/go.sum` (modified, +2/-2)
```diff
@@ -215,8 +215,8 @@ github.com/dolthub/flatbuffers/v23 v23.3.3-dh.2 h1:u3PMzfF8RkKd3lB9pZ2bfn0qEG+1G
 github.com/dolthub/flatbuffers/v23 v23.3.3-dh.2/go.mod h1:mIEZOHnFx4ZMQeawhw9rhsj+0zwQj7adVsnBX7t+eKY=
 github.com/dolthub/go-icu-regex v0.0.0-20260610153742-72563bc7ca83 h1:FEMjCGEroDnY/BXyAffVZxUpXhP2GpoUJyyq5KaLn8c=
 github.com/dolthub/go-icu-regex v0.0.0-20260610153742-72563bc7ca83/go.mod h1:F3cnm+vMRK1HaU6+rNqQrOCyR03HHhR1GWG2gnPOqaE=
-github.com/dolthub/go-mysql-server v0.20.1-0.20260929213643-0c0ebff14743 h1:4iyHwLCKpommapKwAEhr59r/JeoC6TBIGxNI8c9rr78=
-github.com/dolthub/go-mysql-server v0.20.1-0.20260929213643-0c0ebff14743/go.mod h1:Qnp0PJNtR8JPjkmRDMShYh7Fy9jiSYLFgfQCe6Gmnxg=
+github.com/dolthub/go-mysql-server v0.20.1-0.20260929233927-f35678aaf3b7 h1:GPrHwFCInKGJ8VL/yylVpbxDF7E1m8QgXJESuIseXqE=
+github.com/dolthub/go-mysql-server v0.20.1-0.20260929233927-f35678aaf3b7/go.mod h1:Qnp0PJNtR8JPjkmRDMShYh7Fy9jiSYLFgfQCe6Gmnxg=
 github.com/dolthub/gozstd v0.0.0-20240423170813-23a2903bca63 h1:OAsXLAPL4du6tfbBgK0xXHZkOlos63RdKYS3Sgw/dfI=
 github.com/dolthub/gozstd v0.0.0-20240423170813-23a2903bca63/go.mod h1:lV7lUeuDhH5thVGDCKXbatwKy2KW80L4rMT46n+Y2/Q=
 github.com/dolthub/ishell v0.0.0-20260414231531-5f031e3e9037 h1:oIW9HwuWrhxv+4HZxA+QQSKHLqWFyXZ2FmNjUYwkdiM=
```

**File**: `integration-tests/mysql-client-tests/Dockerfile` (modified, +1/-0)
```diff
@@ -76,6 +76,7 @@ RUN pip install --no-cache-dir mysql-connector-python==8.0.33 PyMySQL==1.0.2 sql
 COPY dolt/integration-tests/mysql-client-tests/python/ /build/python/
 WORKDIR /build/python/
 RUN pyinstaller --onefile pymysql-test.py
+RUN pyinstaller --onefile insert-security-test.py
 RUN pyinstaller --onefile --collect-all mysql.connector sqlalchemy-test.py
 RUN pyinstaller --onefile --collect-all mysql.connector mysql-connector-test.py
 RUN pyinstaller --onefile mariadb-connector-test.py
```

**File**: `integration-tests/mysql-client-tests/mysql-client-tests.bats` (modified, +4/-0)
```diff
@@ -89,6 +89,10 @@ assert_mariadb_version_auth_and_db_selection() {
     /build/bin/python/pymysql-test $USER $PORT $REPO_NAME
 }
 
+@test "python upsert privileges" {
+    /build/bin/python/insert-security-test $USER $PORT $REPO_NAME
+}
+
 @test "python sqlachemy client" {
     /build/bin/python/sqlalchemy-test $USER $PORT $REPO_NAME
 }
```

**File**: `integration-tests/mysql-client-tests/python/insert-security-test.py` (added, +74/-0)
```diff
@@ -0,0 +1,74 @@
+"""Upsert privilege regressions, runnable against Dolt or MySQL.
+
+Usage: python insert-security-test.py ROOT_USER PORT DATABASE
+The database must already exist. The test creates and removes its own tables/users.
+"""
+
+import sys
+
+import pymysql
+
+
+def connect(user, port, database, password=""):
+    return pymysql.connect(host="127.0.0.1", port=port, user=user,
+                           password=password, database=database, autocommit=True)
+
+
+def denied(cursor, query, code, message):
+    try:
+        cursor.execute(query)
+    except pymysql.MySQLError as error:
+        assert error.args[0] == code, (query, error)
+        assert message in error.args[1], (query, error)
+    else:
+        raise AssertionError("Unexpectedly accepted: " + query)
+
+
+def rows(cursor, query, expected):
+    cursor.execute(query)
+    actual = cursor.fetchall()
+    assert actual == expected, (query, expected, actual)
+
+
+def main():
+    user, port, database = sys.argv[1], int(sys.argv[2]), sys.argv[3]
+    db_identifier = "`" + database.replace("`", "``") + "`"
+    with connect(user, port, database) as root, root.cursor() as admin:
+        try:
+            admin.execute("CREATE TABLE insert_security_h (id INT PRIMARY KEY, body VARCHAR(32), writer VARCHAR(64))")
+            admin.execute("INSERT INTO insert_security_h (id, body) VALUES (1, 'original'), (2, 'original2')")
+            admin.execute("SELECT * FROM insert_security_h ORDER BY id")
+            original = admin.fetchall()
+            for name, privileges in (("insert_security_attacker", "SELECT, INSERT"),
+                                     ("insert_security_updater", "SELECT, INSERT, UPDATE")):
+                admin.execute(f"CREATE USER '{name}'@'%' IDENTIFIED BY 'test-password'")
+                admin.execute(f"GRANT {privileges} ON {db_identifier}.insert_security_h TO '{name}'@'%'")
+
+            with connect("insert_security_attacker", port, database, "test-password") as conn, conn.cursor() as cur:
+                denied(cur, "UPDATE insert_security_h SET body = 'x' WHERE id = 1", 1142, "command denied")
+                denied(cur, "REPLACE INTO insert_security_h (id, body) VALUES (1, 'x')", 1142, "command denied")
+                # Privileges are checked even if no duplicate would be found.
+                for row_id in (1, 99):
+                    denied(cur, f"INSERT INTO insert_security_h (id, body) VALUES ({row_id}, 'ignored') "
+                           "ON DUPLICATE KEY UPDATE body = 'REWRITTEN', writer = 'victim@%'", 1142, "command denied")
+                rows(cur, "SELECT * FROM insert_security_h ORDER BY id", original)
+                cur.execute("INSERT INTO insert_security_h (id, body) VALUES (3, 'allowed')")
+                rows(cur, "SELECT body FROM insert_security_h WHERE id = 3", (("allowed",),))
+
+            with connect("insert_security_updater", port, database, "test-password") as conn, conn.cursor() as cur:
+                cur.execute("INSERT INTO insert_security_h (id, body) VALUES (2, 'ignored') "
+                            "ON DUPLICATE KEY UPDATE body = 'updated'")
+                rows(cur, "SELECT body FROM insert_security_h WHERE id = 2", (("updated",),))
+                cur.execute("INSERT INTO insert_security_h (id, body) VALUES (5, 'new') "
+                            "ON DUPLICATE KEY UPDATE body = 'updated'")
+                rows(cur, "SELECT body FROM insert_security_h WHERE id = 5", (("new",),))
+
+            admin.execute("SELECT VERSION()")
+            print("Upsert privilege checks passed:", admin.fetchone()[0])
+        finally:
+            admin.execute("DROP TABLE IF EXISTS insert_security_h")
+            admin.execute("DROP USER IF EXISTS 'insert_security_attacker'@'%', 'insert_security_updater'@'%'")
+
+
+if __name__ == "__main__":
+    main()
```

---

### Incident Patch 7: `cccdaaa6` (2026-09-29)
**Commit Message**: Update GMS from main and revert README changes

**File**: `go/go.mod` (modified, +1/-1)
```diff
@@ -65,7 +65,7 @@ require (
 	github.com/dolthub/dolt-mcp v0.3.4
 	github.com/dolthub/eventsapi_schema v0.0.0-20260715220557-d9b4a1c6b4d4
 	github.com/dolthub/flatbuffers/v23 v23.3.3-dh.2
-	github.com/dolthub/go-mysql-server v0.20.1-0.20260929192110-88be445c7e14
+	github.com/dolthub/go-mysql-server v0.20.1-0.20260929233927-f35678aaf3b7
 	github.com/dolthub/gozstd v0.0.0-20240423170813-23a2903bca63
 	github.com/edsrzf/mmap-go v1.2.0
 	github.com/esote/minmaxheap v1.0.0
```

**File**: `go/go.sum` (modified, +2/-2)
```diff
@@ -215,8 +215,8 @@ github.com/dolthub/fslock v0.0.5 h1:QoXhBhgY1oumHE26qyE7tgmXUT8qjJwxsIzo54O/B/k=
 github.com/dolthub/fslock v0.0.5/go.mod h1:sdofYYqE0D79zNZyB4/kmlnsQOVap1C2yByjGKSirEM=
 github.com/dolthub/go-icu-regex v0.0.0-20260610153742-72563bc7ca83 h1:FEMjCGEroDnY/BXyAffVZxUpXhP2GpoUJyyq5KaLn8c=
 github.com/dolthub/go-icu-regex v0.0.0-20260610153742-72563bc7ca83/go.mod h1:F3cnm+vMRK1HaU6+rNqQrOCyR03HHhR1GWG2gnPOqaE=
-github.com/dolthub/go-mysql-server v0.20.1-0.20260929192110-88be445c7e14 h1:UaHMIgaOGUd1ajnpZDMRmnh2LaWi2UWARj6YSgu0yeQ=
-github.com/dolthub/go-mysql-server v0.20.1-0.20260929192110-88be445c7e14/go.mod h1:Qnp0PJNtR8JPjkmRDMShYh7Fy9jiSYLFgfQCe6Gmnxg=
+github.com/dolthub/go-mysql-server v0.20.1-0.20260929233927-f35678aaf3b7 h1:GPrHwFCInKGJ8VL/yylVpbxDF7E1m8QgXJESuIseXqE=
+github.com/dolthub/go-mysql-server v0.20.1-0.20260929233927-f35678aaf3b7/go.mod h1:Qnp0PJNtR8JPjkmRDMShYh7Fy9jiSYLFgfQCe6Gmnxg=
 github.com/dolthub/gozstd v0.0.0-20240423170813-23a2903bca63 h1:OAsXLAPL4du6tfbBgK0xXHZkOlos63RdKYS3Sgw/dfI=
 github.com/dolthub/gozstd v0.0.0-20240423170813-23a2903bca63/go.mod h1:lV7lUeuDhH5thVGDCKXbatwKy2KW80L4rMT46n+Y2/Q=
 github.com/dolthub/ishell v0.0.0-20260414231531-5f031e3e9037 h1:oIW9HwuWrhxv+4HZxA+QQSKHLqWFyXZ2FmNjUYwkdiM=
```

**File**: `integration-tests/mysql-client-tests/README.md` (modified, +0/-17)
```diff
@@ -60,20 +60,3 @@ $ docker run --rm -it --entrypoint /bin/bash mysql-client-tests:mariadb-clients
 # /usr/local/mariadb-11.8/bin/mariadb --version
 # ldd /usr/local/mariadb-11.8/bin/mariadb
 ```
-
-## Compare Upsert Security Behavior With MySQL
-
-`python/insert-security-test.py` runs the same privilege assertions over
-PyMySQL against either Dolt or MySQL. Start a server, create a dedicated test database,
-and use an administrator account with an empty password:
-
-```bash
-python3 -m venv /tmp/mysql-client-venv
-/tmp/mysql-client-venv/bin/pip install PyMySQL cryptography
-/tmp/mysql-client-venv/bin/python python/insert-security-test.py root 3306 test_db
-```
-
-The test creates and removes its own tables and restricted users. It covers
-rejected upserts without UPDATE privilege and successful inserts and upserts with
-the required privileges.
-Authorization denials must return MySQL error 1142 with a `command denied` message.
```

---

### Incident Patch 8: `50b040c1` (2026-09-29)
**Commit Message**: Keep upsert security regression focused on authorization

**File**: `go/go.mod` (modified, +1/-1)
```diff
@@ -65,7 +65,7 @@ require (
 	github.com/dolthub/dolt-mcp v0.3.4
 	github.com/dolthub/eventsapi_schema v0.0.0-20260715220557-d9b4a1c6b4d4
 	github.com/dolthub/flatbuffers/v23 v23.3.3-dh.2
-	github.com/dolthub/go-mysql-server v0.20.1-0.20260929043808-f899397f9d3b
+	github.com/dolthub/go-mysql-server v0.20.1-0.20260929192110-88be445c7e14
 	github.com/dolthub/gozstd v0.0.0-20240423170813-23a2903bca63
 	github.com/edsrzf/mmap-go v1.2.0
 	github.com/esote/minmaxheap v1.0.0
```

**File**: `go/go.sum` (modified, +2/-2)
```diff
@@ -215,8 +215,8 @@ github.com/dolthub/fslock v0.0.5 h1:QoXhBhgY1oumHE26qyE7tgmXUT8qjJwxsIzo54O/B/k=
 github.com/dolthub/fslock v0.0.5/go.mod h1:sdofYYqE0D79zNZyB4/kmlnsQOVap1C2yByjGKSirEM=
 github.com/dolthub/go-icu-regex v0.0.0-20260610153742-72563bc7ca83 h1:FEMjCGEroDnY/BXyAffVZxUpXhP2GpoUJyyq5KaLn8c=
 github.com/dolthub/go-icu-regex v0.0.0-20260610153742-72563bc7ca83/go.mod h1:F3cnm+vMRK1HaU6+rNqQrOCyR03HHhR1GWG2gnPOqaE=
-github.com/dolthub/go-mysql-server v0.20.1-0.20260929043808-f899397f9d3b h1:EEC7shNWpRcVzFlqcPJfkoOWZKQ1FeUqnfBYzgyvRs4=
-github.com/dolthub/go-mysql-server v0.20.1-0.20260929043808-f899397f9d3b/go.mod h1:Qnp0PJNtR8JPjkmRDMShYh7Fy9jiSYLFgfQCe6Gmnxg=
+github.com/dolthub/go-mysql-server v0.20.1-0.20260929192110-88be445c7e14 h1:UaHMIgaOGUd1ajnpZDMRmnh2LaWi2UWARj6YSgu0yeQ=
+github.com/dolthub/go-mysql-server v0.20.1-0.20260929192110-88be445c7e14/go.mod h1:Qnp0PJNtR8JPjkmRDMShYh7Fy9jiSYLFgfQCe6Gmnxg=
 github.com/dolthub/gozstd v0.0.0-20240423170813-23a2903bca63 h1:OAsXLAPL4du6tfbBgK0xXHZkOlos63RdKYS3Sgw/dfI=
 github.com/dolthub/gozstd v0.0.0-20240423170813-23a2903bca63/go.mod h1:lV7lUeuDhH5thVGDCKXbatwKy2KW80L4rMT46n+Y2/Q=
 github.com/dolthub/ishell v0.0.0-20260414231531-5f031e3e9037 h1:oIW9HwuWrhxv+4HZxA+QQSKHLqWFyXZ2FmNjUYwkdiM=
```

**File**: `integration-tests/mysql-client-tests/README.md` (modified, +4/-4)
```diff
@@ -63,7 +63,7 @@ $ docker run --rm -it --entrypoint /bin/bash mysql-client-tests:mariadb-clients
 
 ## Compare Upsert Security Behavior With MySQL
 
-`python/insert-security-test.py` runs the same privilege and trigger assertions over
+`python/insert-security-test.py` runs the same privilege assertions over
 PyMySQL against either Dolt or MySQL. Start a server, create a dedicated test database,
 and use an administrator account with an empty password:
 
@@ -73,7 +73,7 @@ python3 -m venv /tmp/mysql-client-venv
 /tmp/mysql-client-venv/bin/python python/insert-security-test.py root 3306 test_db
 ```
 
-The test creates and removes its own tables, triggers, and restricted users. It covers
-rejected upserts without UPDATE privilege, update-trigger rejection and statement
-rollback, successful inserts, and trigger ordering and row images for mixed upserts.
+The test creates and removes its own tables and restricted users. It covers
+rejected upserts without UPDATE privilege and successful inserts and upserts with
+the required privileges.
 Authorization denials must return MySQL error 1142 with a `command denied` message.
```

**File**: `integration-tests/mysql-client-tests/mysql-client-tests.bats` (modified, +1/-1)
```diff
@@ -89,7 +89,7 @@ assert_mariadb_version_auth_and_db_selection() {
     /build/bin/python/pymysql-test $USER $PORT $REPO_NAME
 }
 
-@test "python upsert privileges and triggers" {
+@test "python upsert privileges" {
     /build/bin/python/insert-security-test $USER $PORT $REPO_NAME
 }
 
```

**File**: `integration-tests/mysql-client-tests/python/insert-security-test.py` (modified, +7/-31)
```diff
@@ -1,4 +1,4 @@
-"""Upsert privilege and trigger regressions, runnable against Dolt or MySQL.
+"""Upsert privilege regressions, runnable against Dolt or MySQL.
 
 Usage: python insert-security-test.py ROOT_USER PORT DATABASE
 The database must already exist. The test creates and removes its own tables/users.
@@ -36,10 +36,6 @@ def main():
     with connect(user, port, database) as root, root.cursor() as admin:
         try:
             admin.execute("CREATE TABLE insert_security_h (id INT PRIMARY KEY, body VARCHAR(32), writer VARCHAR(64))")
-            admin.execute("CREATE TRIGGER insert_security_bi BEFORE INSERT ON insert_security_h "
-                          "FOR EACH ROW SET NEW.writer = USER()")
-            admin.execute("CREATE TRIGGER insert_security_bu BEFORE UPDATE ON insert_security_h "
-                          "FOR EACH ROW BEGIN SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'append-only'; END")
             admin.execute("INSERT INTO insert_security_h (id, body) VALUES (1, 'original'), (2, 'original2')")
             admin.execute("SELECT * FROM insert_security_h ORDER BY id")
             original = admin.fetchall()
@@ -57,40 +53,20 @@ def main():
                            "ON DUPLICATE KEY UPDATE body = 'REWRITTEN', writer = 'victim@%'", 1142, "command denied")
                 rows(cur, "SELECT * FROM insert_security_h ORDER BY id", original)
                 cur.execute("INSERT INTO insert_security_h (id, body) VALUES (3, 'allowed')")
-                rows(cur, "SELECT body, writer = USER() FROM insert_security_h WHERE id = 3", (("allowed", 1),))
+                rows(cur, "SELECT body FROM insert_security_h WHERE id = 3", (("allowed",),))
 
             with connect("insert_security_updater", port, database, "test-password") as conn, conn.cursor() as cur:
-                denied(cur, "UPDATE insert_security_h SET body = 'y' WHERE id = 2", 1644, "append-only")
-                denied(cur, "INSERT INTO insert_security_h (id, body) VALUES (2, 'ignored') "
-                       "ON DUPLICATE KEY UPDATE body = 'REWRITTEN2'", 1644, "append-only")
-                # Failure on the second row must roll back the first insert too.
-                denied(cur, "INSERT INTO insert_security_h (id, body) VALUES (4, 'new'), (2, 'ignored') "
-                       "ON DUPLICATE KEY UPDATE body = 'REWRITTEN2'", 1644, "append-only")
-                rows(cur, "SELECT * FROM insert_security_h WHERE id <= 2 ORDER BY id", original)
-                rows(cur, "SELECT id FROM insert_security_h WHERE id IN (4, 99)", ())
+                cur.execute("INSERT INTO insert_security_h (id, body) VALUES (2, 'ignored') "
+                            "ON DUPLICATE KEY UPDATE body = 'updated'")
+                rows(cur, "SELECT body FROM insert_security_h WHERE id = 2", (("updated",),))
                 cur.execute("INSERT INTO insert_security_h (id, body) VALUES (5, 'new') "
                             "ON DUPLICATE KEY UPDATE body = 'updated'")
                 rows(cur, "SELECT body FROM insert_security_h WHERE id = 5", (("new",),))
 
-            # Verify all four trigger types, row images, order, and a mixed batch.
-            admin.execute("CREATE TABLE insert_security_rows (id INT PRIMARY KEY, v INT)")
-            admin.execute("CREATE TABLE insert_security_audit (seq INT AUTO_INCREMENT PRIMARY KEY, event VARCHAR(2), old_v INT, new_v INT)")
-            admin.execute("INSERT INTO insert_security_rows VALUES (1, 10)")
-            for name, timing, event, body in (
-                ("bi", "BEFORE", "INSERT", "BEGIN SET NEW.v = NEW.v + 1; INSERT INTO insert_security_audit(event, old_v, new_v) VALUES ('bi', NULL, NEW.v); END"),
-                ("ai", "AFTER", "INSERT", "INSERT INTO insert_security_audit(event, old_v, new_v) VALUES ('ai', NULL, NEW.v)"),
-                ("bu", "BEFORE", "UPDATE", "BEGIN SET NEW.v = NEW.v + OLD.v; INSERT INTO insert_security_audit(event, old_v, new_v) VALUES ('bu', OLD.v, NEW.v); END"),
-                ("au", "AFTER", "UPDATE", "INSERT INTO insert_security_audit(event, old_v, new_v) VALUES ('au', OLD.v, NEW.v)"),
-            ):
-                admin.execute(f"CREATE TRIGGER insert_security_rows_{name} {timing} {event} ON insert_security_rows FOR EACH ROW {body}")
-            admin.execute("INSERT INTO insert_security_rows VALUES (1, 20), (2, 30) ON DUPLICATE KEY UPDATE v = VALUES(v)")
-            rows(admin, "SELECT * FROM insert_security_rows ORDER BY id", ((1, 31), (2, 31)))
-            rows(admin, "SELECT event, old_v, new_v FROM insert_security_audit ORDER BY seq",
-                 (("bi", None, 21), ("bu", 10, 31), ("au", 10, 31), ("bi", None, 31), ("ai", None, 31)))
             admin.execute("SELECT VERSION()")
-            print("Upsert privilege and trigger checks passed:", admin.fetchone()[0])
+            print("Upsert privilege checks passed:", admin.fetchone()[0])
         finally:
-            admin.execute("DROP TABLE IF EXISTS insert_security_h, inser
```

---

### Incident Patch 9: `c8c1e5f6` (2026-09-29)
**Commit Message**: Require MySQL-compatible privilege error codes in integration tests

**File**: `go/go.mod` (modified, +1/-1)
```diff
@@ -65,7 +65,7 @@ require (
 	github.com/dolthub/dolt-mcp v0.3.4
 	github.com/dolthub/eventsapi_schema v0.0.0-20260715220557-d9b4a1c6b4d4
 	github.com/dolthub/flatbuffers/v23 v23.3.3-dh.2
-	github.com/dolthub/go-mysql-server v0.20.1-0.20260929040229-566852420254
+	github.com/dolthub/go-mysql-server v0.20.1-0.20260929043808-f899397f9d3b
 	github.com/dolthub/gozstd v0.0.0-20240423170813-23a2903bca63
 	github.com/edsrzf/mmap-go v1.2.0
 	github.com/esote/minmaxheap v1.0.0
```

**File**: `go/go.sum` (modified, +2/-2)
```diff
@@ -215,8 +215,8 @@ github.com/dolthub/fslock v0.0.5 h1:QoXhBhgY1oumHE26qyE7tgmXUT8qjJwxsIzo54O/B/k=
 github.com/dolthub/fslock v0.0.5/go.mod h1:sdofYYqE0D79zNZyB4/kmlnsQOVap1C2yByjGKSirEM=
 github.com/dolthub/go-icu-regex v0.0.0-20260610153742-72563bc7ca83 h1:FEMjCGEroDnY/BXyAffVZxUpXhP2GpoUJyyq5KaLn8c=
 github.com/dolthub/go-icu-regex v0.0.0-20260610153742-72563bc7ca83/go.mod h1:F3cnm+vMRK1HaU6+rNqQrOCyR03HHhR1GWG2gnPOqaE=
-github.com/dolthub/go-mysql-server v0.20.1-0.20260929040229-566852420254 h1:W4h0DpkO/372iSJG353NKPhWz1asoJuzYivACxnyDsE=
-github.com/dolthub/go-mysql-server v0.20.1-0.20260929040229-566852420254/go.mod h1:Qnp0PJNtR8JPjkmRDMShYh7Fy9jiSYLFgfQCe6Gmnxg=
+github.com/dolthub/go-mysql-server v0.20.1-0.20260929043808-f899397f9d3b h1:EEC7shNWpRcVzFlqcPJfkoOWZKQ1FeUqnfBYzgyvRs4=
+github.com/dolthub/go-mysql-server v0.20.1-0.20260929043808-f899397f9d3b/go.mod h1:Qnp0PJNtR8JPjkmRDMShYh7Fy9jiSYLFgfQCe6Gmnxg=
 github.com/dolthub/gozstd v0.0.0-20240423170813-23a2903bca63 h1:OAsXLAPL4du6tfbBgK0xXHZkOlos63RdKYS3Sgw/dfI=
 github.com/dolthub/gozstd v0.0.0-20240423170813-23a2903bca63/go.mod h1:lV7lUeuDhH5thVGDCKXbatwKy2KW80L4rMT46n+Y2/Q=
 github.com/dolthub/ishell v0.0.0-20260414231531-5f031e3e9037 h1:oIW9HwuWrhxv+4HZxA+QQSKHLqWFyXZ2FmNjUYwkdiM=
```

**File**: `integration-tests/mysql-client-tests/README.md` (modified, +1/-2)
```diff
@@ -76,5 +76,4 @@ python3 -m venv /tmp/mysql-client-venv
 The test creates and removes its own tables, triggers, and restricted users. It covers
 rejected upserts without UPDATE privilege, update-trigger rejection and statement
 rollback, successful inserts, and trigger ordering and row images for mixed upserts.
-Dolt currently returns authorization error 1105 where MySQL returns 1142; the test
-accepts either code only with a `command denied` message.
+Authorization denials must return MySQL error 1142 with a `command denied` message.
```

**File**: `integration-tests/mysql-client-tests/python/insert-security-test.py` (modified, +7/-9)
```diff
@@ -15,12 +15,10 @@ def connect(user, port, database, password=""):
 
 
 def denied(cursor, query, code, message):
-    # Dolt currently reports authorization denials as 1105; MySQL uses 1142.
-    # Check the denial message as well, so unrelated errors cannot pass.
     try:
         cursor.execute(query)
     except pymysql.MySQLError as error:
-        assert error.args[0] in code, (query, error)
+        assert error.args[0] == code, (query, error)
         assert message in error.args[1], (query, error)
     else:
         raise AssertionError("Unexpectedly accepted: " + query)
@@ -51,23 +49,23 @@ def main():
                 admin.execute(f"GRANT {privileges} ON {db_identifier}.insert_security_h TO '{name}'@'%'")
 
             with connect("insert_security_attacker", port, database, "test-password") as conn, conn.cursor() as cur:
-                denied(cur, "UPDATE insert_security_h SET body = 'x' WHERE id = 1", (1142, 1105), "command denied")
-                denied(cur, "REPLACE INTO insert_security_h (id, body) VALUES (1, 'x')", (1142, 1105), "command denied")
+                denied(cur, "UPDATE insert_security_h SET body = 'x' WHERE id = 1", 1142, "command denied")
+                denied(cur, "REPLACE INTO insert_security_h (id, body) VALUES (1, 'x')", 1142, "command denied")
                 # Privileges are checked even if no duplicate would be found.
                 for row_id in (1, 99):
                     denied(cur, f"INSERT INTO insert_security_h (id, body) VALUES ({row_id}, 'ignored') "
-                           "ON DUPLICATE KEY UPDATE body = 'REWRITTEN', writer = 'victim@%'", (1142, 1105), "command denied")
+                           "ON DUPLICATE KEY UPDATE body = 'REWRITTEN', writer = 'victim@%'", 1142, "command denied")
                 rows(cur, "SELECT * FROM insert_security_h ORDER BY id", original)
                 cur.execute("INSERT INTO insert_security_h (id, body) VALUES (3, 'allowed')")
                 rows(cur, "SELECT body, writer = USER() FROM insert_security_h WHERE id = 3", (("allowed", 1),))
 
             with connect("insert_security_updater", port, database, "test-password") as conn, conn.cursor() as cur:
-                denied(cur, "UPDATE insert_security_h SET body = 'y' WHERE id = 2", (1644,), "append-only")
+                denied(cur, "UPDATE insert_security_h SET body = 'y' WHERE id = 2", 1644, "append-only")
                 denied(cur, "INSERT INTO insert_security_h (id, body) VALUES (2, 'ignored') "
-                       "ON DUPLICATE KEY UPDATE body = 'REWRITTEN2'", (1644,), "append-only")
+                       "ON DUPLICATE KEY UPDATE body = 'REWRITTEN2'", 1644, "append-only")
                 # Failure on the second row must roll back the first insert too.
                 denied(cur, "INSERT INTO insert_security_h (id, body) VALUES (4, 'new'), (2, 'ignored') "
-                       "ON DUPLICATE KEY UPDATE body = 'REWRITTEN2'", (1644,), "append-only")
+                       "ON DUPLICATE KEY UPDATE body = 'REWRITTEN2'", 1644, "append-only")
                 rows(cur, "SELECT * FROM insert_security_h WHERE id <= 2 ORDER BY id", original)
                 rows(cur, "SELECT id FROM insert_security_h WHERE id IN (4, 99)", ())
                 cur.execute("INSERT INTO insert_security_h (id, body) VALUES (5, 'new') "
```

---

### Incident Patch 10: `f210bc5f` (2026-09-29)
**Commit Message**: Fix upsert authorization and trigger bypasses with protocol regression tests

**File**: `go/go.mod` (modified, +1/-1)
```diff
@@ -65,7 +65,7 @@ require (
 	github.com/dolthub/dolt-mcp v0.3.4
 	github.com/dolthub/eventsapi_schema v0.0.0-20260715220557-d9b4a1c6b4d4
 	github.com/dolthub/flatbuffers/v23 v23.3.3-dh.2
-	github.com/dolthub/go-mysql-server v0.20.1-0.20260925205857-cd69bf0b55e9
+	github.com/dolthub/go-mysql-server v0.20.1-0.20260929040229-566852420254
 	github.com/dolthub/gozstd v0.0.0-20240423170813-23a2903bca63
 	github.com/edsrzf/mmap-go v1.2.0
 	github.com/esote/minmaxheap v1.0.0
```

**File**: `go/go.sum` (modified, +2/-2)
```diff
@@ -215,8 +215,8 @@ github.com/dolthub/fslock v0.0.5 h1:QoXhBhgY1oumHE26qyE7tgmXUT8qjJwxsIzo54O/B/k=
 github.com/dolthub/fslock v0.0.5/go.mod h1:sdofYYqE0D79zNZyB4/kmlnsQOVap1C2yByjGKSirEM=
 github.com/dolthub/go-icu-regex v0.0.0-20260610153742-72563bc7ca83 h1:FEMjCGEroDnY/BXyAffVZxUpXhP2GpoUJyyq5KaLn8c=
 github.com/dolthub/go-icu-regex v0.0.0-20260610153742-72563bc7ca83/go.mod h1:F3cnm+vMRK1HaU6+rNqQrOCyR03HHhR1GWG2gnPOqaE=
-github.com/dolthub/go-mysql-server v0.20.1-0.20260925205857-cd69bf0b55e9 h1:pjzY1rxlJL4hnyuBdoJyeWoNVoAJaGlsUOgCfjQ5yUE=
-github.com/dolthub/go-mysql-server v0.20.1-0.20260925205857-cd69bf0b55e9/go.mod h1:Qnp0PJNtR8JPjkmRDMShYh7Fy9jiSYLFgfQCe6Gmnxg=
+github.com/dolthub/go-mysql-server v0.20.1-0.20260929040229-566852420254 h1:W4h0DpkO/372iSJG353NKPhWz1asoJuzYivACxnyDsE=
+github.com/dolthub/go-mysql-server v0.20.1-0.20260929040229-566852420254/go.mod h1:Qnp0PJNtR8JPjkmRDMShYh7Fy9jiSYLFgfQCe6Gmnxg=
 github.com/dolthub/gozstd v0.0.0-20240423170813-23a2903bca63 h1:OAsXLAPL4du6tfbBgK0xXHZkOlos63RdKYS3Sgw/dfI=
 github.com/dolthub/gozstd v0.0.0-20240423170813-23a2903bca63/go.mod h1:lV7lUeuDhH5thVGDCKXbatwKy2KW80L4rMT46n+Y2/Q=
 github.com/dolthub/ishell v0.0.0-20260414231531-5f031e3e9037 h1:oIW9HwuWrhxv+4HZxA+QQSKHLqWFyXZ2FmNjUYwkdiM=
```

**File**: `integration-tests/mysql-client-tests/Dockerfile` (modified, +1/-0)
```diff
@@ -76,6 +76,7 @@ RUN pip install --no-cache-dir mysql-connector-python==8.0.33 PyMySQL==1.0.2 sql
 COPY dolt/integration-tests/mysql-client-tests/python/ /build/python/
 WORKDIR /build/python/
 RUN pyinstaller --onefile pymysql-test.py
+RUN pyinstaller --onefile insert-security-test.py
 RUN pyinstaller --onefile --collect-all mysql.connector sqlalchemy-test.py
 RUN pyinstaller --onefile --collect-all mysql.connector mysql-connector-test.py
 RUN pyinstaller --onefile mariadb-connector-test.py
```

**File**: `integration-tests/mysql-client-tests/README.md` (modified, +18/-0)
```diff
@@ -60,3 +60,21 @@ $ docker run --rm -it --entrypoint /bin/bash mysql-client-tests:mariadb-clients
 # /usr/local/mariadb-11.8/bin/mariadb --version
 # ldd /usr/local/mariadb-11.8/bin/mariadb
 ```
+
+## Compare Upsert Security Behavior With MySQL
+
+`python/insert-security-test.py` runs the same privilege and trigger assertions over
+PyMySQL against either Dolt or MySQL. Start a server, create a dedicated test database,
+and use an administrator account with an empty password:
+
+```bash
+python3 -m venv /tmp/mysql-client-venv
+/tmp/mysql-client-venv/bin/pip install PyMySQL cryptography
+/tmp/mysql-client-venv/bin/python python/insert-security-test.py root 3306 test_db
+```
+
+The test creates and removes its own tables, triggers, and restricted users. It covers
+rejected upserts without UPDATE privilege, update-trigger rejection and statement
+rollback, successful inserts, and trigger ordering and row images for mixed upserts.
+Dolt currently returns authorization error 1105 where MySQL returns 1142; the test
+accepts either code only with a `command denied` message.
```

**File**: `integration-tests/mysql-client-tests/mysql-client-tests.bats` (modified, +4/-0)
```diff
@@ -89,6 +89,10 @@ assert_mariadb_version_auth_and_db_selection() {
     /build/bin/python/pymysql-test $USER $PORT $REPO_NAME
 }
 
+@test "python upsert privileges and triggers" {
+    /build/bin/python/insert-security-test $USER $PORT $REPO_NAME
+}
+
 @test "python sqlachemy client" {
     /build/bin/python/sqlalchemy-test $USER $PORT $REPO_NAME
 }
```

**File**: `integration-tests/mysql-client-tests/python/insert-security-test.py` (added, +100/-0)
```diff
@@ -0,0 +1,100 @@
+"""Upsert privilege and trigger regressions, runnable against Dolt or MySQL.
+
+Usage: python insert-security-test.py ROOT_USER PORT DATABASE
+The database must already exist. The test creates and removes its own tables/users.
+"""
+
+import sys
+
+import pymysql
+
+
+def connect(user, port, database, password=""):
+    return pymysql.connect(host="127.0.0.1", port=port, user=user,
+                           password=password, database=database, autocommit=True)
+
+
+def denied(cursor, query, code, message):
+    # Dolt currently reports authorization denials as 1105; MySQL uses 1142.
+    # Check the denial message as well, so unrelated errors cannot pass.
+    try:
+        cursor.execute(query)
+    except pymysql.MySQLError as error:
+        assert error.args[0] in code, (query, error)
+        assert message in error.args[1], (query, error)
+    else:
+        raise AssertionError("Unexpectedly accepted: " + query)
+
+
+def rows(cursor, query, expected):
+    cursor.execute(query)
+    actual = cursor.fetchall()
+    assert actual == expected, (query, expected, actual)
+
+
+def main():
+    user, port, database = sys.argv[1], int(sys.argv[2]), sys.argv[3]
+    db_identifier = "`" + database.replace("`", "``") + "`"
+    with connect(user, port, database) as root, root.cursor() as admin:
+        try:
+            admin.execute("CREATE TABLE insert_security_h (id INT PRIMARY KEY, body VARCHAR(32), writer VARCHAR(64))")
+            admin.execute("CREATE TRIGGER insert_security_bi BEFORE INSERT ON insert_security_h "
+                          "FOR EACH ROW SET NEW.writer = USER()")
+            admin.execute("CREATE TRIGGER insert_security_bu BEFORE UPDATE ON insert_security_h "
+                          "FOR EACH ROW BEGIN SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'append-only'; END")
+            admin.execute("INSERT INTO insert_security_h (id, body) VALUES (1, 'original'), (2, 'original2')")
+            admin.execute("SELECT * FROM insert_security_h ORDER BY id")
+            original = admin.fetchall()
+            for name, privileges in (("insert_security_attacker", "SELECT, INSERT"),
+                                     ("insert_security_updater", "SELECT, INSERT, UPDATE")):
+                admin.execute(f"CREATE USER '{name}'@'%' IDENTIFIED BY 'test-password'")
+                admin.execute(f"GRANT {privileges} ON {db_identifier}.insert_security_h TO '{name}'@'%'")
+
+            with connect("insert_security_attacker", port, database, "test-password") as conn, conn.cursor() as cur:
+                denied(cur, "UPDATE insert_security_h SET body = 'x' WHERE id = 1", (1142, 1105), "command denied")
+                denied(cur, "REPLACE INTO insert_security_h (id, body) VALUES (1, 'x')", (1142, 1105), "command denied")
+                # Privileges are checked even if no duplicate would be found.
+                for row_id in (1, 99):
+                    denied(cur, f"INSERT INTO insert_security_h (id, body) VALUES ({row_id}, 'ignored') "
+                           "ON DUPLICATE KEY UPDATE body = 'REWRITTEN', writer = 'victim@%'", (1142, 1105), "command denied")
+                rows(cur, "SELECT * FROM insert_security_h ORDER BY id", original)
+                cur.execute("INSERT INTO insert_security_h (id, body) VALUES (3, 'allowed')")
+                rows(cur, "SELECT body, writer = USER() FROM insert_security_h WHERE id = 3", (("allowed", 1),))
+
+            with connect("insert_security_updater", port, database, "test-password") as conn, conn.cursor() as cur:
+                denied(cur, "UPDATE insert_security_h SET body = 'y' WHERE id = 2", (1644,), "append-only")
+                denied(cur, "INSERT INTO insert_security_h (id, body) VALUES (2, 'ignored') "
+                       "ON DUPLICATE KEY UPDATE body = 'REWRITTEN2'", (1644,), "append-only")
+                # Failure on the second row must roll back the first insert too.
+                denied(cur, "INSERT INTO insert_security_h (id, body) VALUES (4, 'new'), (2, 'ignored') "
+                       "ON DUPLICATE KEY UPDATE body = 'REWRITTEN2'", (1644,), "append-only")
+                rows(cur, "SELECT * FROM insert_security_h WHERE id <= 2 ORDER BY id", original)
+                rows(cur, "SELECT id FROM insert_security_h WHERE id IN (4, 99)", ())
+                cur.execute("INSERT INTO insert_security_h (id, body) VALUES (5, 'new') "
+                            "ON DUPLICATE KEY UPDATE body = 'updated'")
+                rows(cur, "SELECT body FROM insert_security_h WHERE id = 5", (("new",),))
+
+            # Verify all four trigger types, row images, order, and a mixed batch.
+            admin.execute("CREATE TABLE insert_security_rows (id INT PRIMARY KEY, v INT)")
+            admin.execute("CREATE TABLE insert_security_audit (seq INT AUTO_INCREMENT PRIMARY KEY, event VARCHAR(2), old_v INT, new_v INT)")
+            admin.execute("INSERT INTO insert_security_rows VALUES (1, 10)")
+      
```

---

### Incident Patch 11: `d0b9d642` (2026-09-17)
**Commit Message**: Revert notification test and README changes.

**File**: `.github/actions/check-deferred-ci/README.md` (modified, +4/-7)
```diff
@@ -69,12 +69,9 @@ Sources: [GitHub CLI creation and metadata calls](https://github.com/cli/cli/blo
   or tests. Deferred workflows are canceled, freeing those runners until release.
   Matrix members can each briefly allocate a runner; there is no separate
   admission job or admission check.
-- Bot comments record deferral or release only when `defer-ci-after-hours`,
-  `defer-ci-review`, or `force-draft-ci` is added or removed, or the PR
-  transitions between draft and ready. Deferral comments include conditions and
-  overrides. Pushes, polling, and reviews reconcile CI silently. Existing comments are never edited, and
-  repeated notifications for the same event, label state, and draft state are deduplicated
-  across commits.
+- A new bot comment records each deferral, including its conditions and overrides,
+  and another records release. Existing comments are never edited. Repeated
+  notifications for the same event and revision do not add duplicate comments.
   The separate `ci-deferred` label tracks postponed work until release.
   The scheduler manages this queue label; users choose the two `defer-ci-*` labels.
 - Label additions/removals and draft-ready transitions trigger reconciliation.
@@ -200,7 +197,7 @@ are not automatically retried; use their original workflow controls.
   decisions, time, run state, and attempt. It does not release obsolete commits.
 - A per-PR concurrency group serializes event and timer reconciliation. Polling
   recovers invocations replaced in GitHub's single pending concurrency slot.
-- Event comments contain only hidden label/draft state and an event identifier for
+- Event comments contain only a hidden revision and event identifier for
   deduplication. No workflow results are cached in comments. Successful test
   completions do not trigger reconciliation; unsuccessful attempts are inspected
   only to identify deferrals or admission errors. The scheduler never reports
```

**File**: `.github/actions/check-deferred-ci/index.test.js` (modified, +4/-55)
```diff
@@ -62,7 +62,7 @@ function fixture(options = {}) {
     },
   }, paginate: async (endpoint, args) => (await endpoint(args)).data };
   return { state, github, calls: name => state.calls.filter(c => c[0] === name),
-    reconcile: (now, eventContext = context) => reconcile({ github, context: eventContext, pullNumber: 12, now: now || day }) };
+    reconcile: now => reconcile({ github, context, pullNumber: 12, now: now || day }) };
 }
 
 test('admission composes draft, after-hours and review conditions using live PR state', async () => {
@@ -100,20 +100,14 @@ test('new and renamed workflows are discovered from the PR; unrelated runs are i
   assert.equal(f.state.statuses[0].state, 'success');
 });
 
-test('relevant label changes append deferral and release comments once across commits', async () => {
+test('deferral and release append brief events once, without completion monitoring', async () => {
   const f = fixture();
-  const labeled = { ...context, eventName: 'pull_request_target',
-    payload: { action: 'labeled', label: { name: AFTER_HOURS_LABEL } } };
-  await f.reconcile(day, labeled);
-  f.state.pr.head.sha = f.state.runs[0].head_sha = 'new-head';
-  await f.reconcile(day, labeled);
+  await f.reconcile(); await f.reconcile();
   const original = f.state.comments[0].body;
   assert.match(original, /9pm–5am/);
   assert.match(original, /remove `defer-ci-after-hours`/);
   assert.equal(f.state.statuses[0].state, 'pending');
-  f.state.pr.labels = [{ name: LABEL }];
-  const unlabeled = { ...labeled, payload: { ...labeled.payload, action: 'unlabeled' } };
-  await f.reconcile(day, unlabeled); await f.reconcile(day, unlabeled);
+  await f.reconcile(night); await f.reconcile(night);
   assert.equal(f.calls('runs.rerun').length, 1);
   assert.equal(f.state.statuses[0].state, 'success');
   assert.equal(f.state.runs[0].status, 'queued');
@@ -165,48 +159,3 @@ test('review notifications and polling wake reconciliation; successful CI does n
   assert.deepEqual(await candidates({ github: f.github, context: { ...context, eventName: 'schedule' }, now: night }), [12]);
   assert.deepEqual(await candidates({ github: f.github, context: { ...context, eventName: 'schedule' }, now: day }), []);
 });
-
-test('pushes and other events without label or draft changes reconcile without reading or adding comments', async () => {
-  const contexts = [
-    ...['opened', 'synchronize', 'reopened'].map(action =>
-      ({ ...context, eventName: 'pull_request_target', payload: { action } })),
-    ...[LABEL, 'unrelated'].map(name => ({ ...context, eventName: 'pull_request_target',
-      payload: { action: 'labeled', label: { name } } })),
-    ...['schedule', 'workflow_dispatch', 'workflow_run'].map(eventName => ({ ...context, eventName })),
-  ];
-  for (const eventContext of contexts) {
-    const f = fixture({ pr: { ...structuredClone(pr), draft: true } });
-    await f.reconcile(day, eventContext);
-    f.state.pr.head.sha = f.state.runs[0].head_sha = 'new-head';
-    await f.reconcile(day, eventContext);
-    assert.equal(f.state.statuses[0].state, 'pending');
-    f.state.pr.draft = false;
-    await f.reconcile(night, eventContext);
-    assert.equal(f.calls('runs.rerun').length, 1);
-    assert.equal(f.calls('comments.list').length, 0);
-    assert.equal(f.state.comments.length, 0);
-  }
-  for (const name of [REVIEW_LABEL, FORCE_DRAFT_LABEL]) {
-    const f = fixture({ pr: { ...structuredClone(pr), draft: true, labels: [{ name: REVIEW_LABEL }] } });
-    await f.reconcile(day, { ...context, eventName: 'pull_request_target',
-      payload: { action: 'labeled', label: { name } } });
-    assert.equal(f.state.comments.length, 1);
-  }
-});
-
-test('draft-ready transitions comment while commits on a draft remain silent', async () => {
-  const f = fixture({ pr: { ...structuredClone(pr), draft: true, labels: [] } });
-  const event = action => ({ ...context, eventName: 'pull_request_target', payload: { action } });
-  await f.reconcile(day, event('converted_to_draft'));
-  assert.equal(f.state.comments.length, 1);
-  f.state.pr.head.sha = f.state.runs[0].head_sha = 'new-head';
-  await f.reconcile(day, event('synchronize'));
-  assert.equal(f.state.comments.length, 1);
-  f.state.pr.draft = false;
-  await f.reconcile(day, event('ready_for_review'));
-  assert.equal(f.calls('runs.rerun').length, 1);
-  assert.equal(f.state.comments.length, 2);
-  assert.match(f.state.comments[1].body, /Released postponed CI/);
-  await f.reconcile(day, event('ready_for_review'));
-  assert.equal(f.state.comments.length, 2);
-});
```

#### Recent Merged Pull Requests:
- **PR #12026** (closed): [auto-bump] [no-release-notes] dependency by fulghum (@coffeegoddd)
- **PR #12022** (closed): fix: timeout and record failed `dolt version` release checks (@YodHeVauHe)
- **PR #12020** (2026-10-06): [no-release-notes] Bump GMS (@nicktobey)
- **PR #12019** (closed): [auto-bump] [no-release-notes] dependency by elianddb (@coffeegoddd)
- **PR #12018** (2026-10-03): Allow schema overrides with ignored nonlocal tables (@fulghum)
- **PR #12016** (2026-10-02): /{go,integration-tests}: use a more specific cache key (@coffeegoddd)
- **PR #12015** (closed): [auto-bump] [no-release-notes] dependency by elianddb (@coffeegoddd)
- **PR #12014** (closed): [auto-bump] [no-release-notes] dependency by elianddb (@coffeegoddd)

---

## 3. Empirical Evidence & Compliance Certification
- **Evidence Provenance**: Fetched directly from verified official GitHub REST API.
- **Zero Disk Footprint**: 0 bytes of unnecessary repository bloat stored locally.
- **TOS & Free-Tier Adherence**: Request pace complied with public API guidelines without fee, penalty, or unauthorized scraping.

---

## 4. Promotion & Integration Status
- **Status**: HARVESTED_DEEP_FORENSIC
- **Master Brain Sync**: Auto-committed to local/remote Master Brain repository.
